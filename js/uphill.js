// Uphill difficulty for every trail in view.
//
// OSM rarely carries mtb:scale:uphill, so we compute it: each path/track in the
// loaded vector tiles is resampled, its elevation profile is read from the lidar
// DEM, and it is cut into ~25 m pieces graded ↑S0–↑S5 by climbing gradient
// (bumped for loose surface / technical mtb:scale). Pieces are oriented uphill
// so the arrow symbols point the way you'd be climbing. Where OSM does have an
// explicit mtb:scale:uphill tag (fetched from Overpass), that wins.

import { densify, lonLatToTile, tileBounds } from './geo.js';
import { elevations, smooth } from './dem.js';
import { uphillClass, techBump } from './analysis.js';
import { OVERPASS } from './config.js';
import { idb } from './idb.js';

const PIECE = 25;
const MIN_ZOOM = 13;
const OSM_TTL = 7 * 864e5; // OSM uphill tags kept in the browser for a week
const OSM_RETRY = 120e3; // after a failed Overpass call, leave that tile alone for 2 min
const osmCache = idb('overpass');
osmCache.prune((v) => v && Date.now() - v.at < 4 * OSM_TTL).catch(() => {});

export class UphillLayer {
  constructor(map, onData) {
    this.map = map;
    this.onData = onData;
    this.enabled = false;
    this.fc = { type: 'FeatureCollection', features: [] };
    this.done = new Map(); // feature key -> features
    this.osmTiles = new Map(); // z12 tile -> { result }
    this.osmFailed = new Map(); // z12 tile -> retry after (ms)
    this.timer = 0;
    this.run = 0;
    map.on('moveend', () => this.schedule());
    map.on('sourcedata', (e) => { if (e.sourceId === 'ofm' && e.isSourceLoaded) this.schedule(); });
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.schedule();
    else { this.fc = { type: 'FeatureCollection', features: [] }; this.onData(this.fc); }
  }

  schedule() {
    if (!this.enabled) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.update(), 350);
  }

  async update() {
    const map = this.map;
    if (!this.enabled || map.getZoom() < MIN_ZOOM || !map.getSource('ofm')) return;
    const run = ++this.run;
    const b = map.getBounds();
    const view = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    const feats = map.querySourceFeatures('ofm', {
      sourceLayer: 'transportation',
      // Real trails only: tracks, paths/bridleways/steps, and footways that are
      // unpaved or MTB-graded (so city sidewalks don't light up).
      filter: ['any',
        ['==', ['get', 'class'], 'track'],
        ['all', ['==', ['get', 'class'], 'path'], ['any',
          ['in', ['coalesce', ['get', 'subclass'], 'path'], ['literal', ['path', 'bridleway', 'steps']]],
          ['has', 'mtb_scale'],
          ['==', ['get', 'surface'], 'unpaved'],
        ]],
      ],
    });
    const todo = [];
    for (const f of feats) {
      const geom = f.geometry;
      const lines = geom.type === 'LineString' ? [geom.coordinates] : geom.type === 'MultiLineString' ? geom.coordinates : [];
      for (const line of lines) {
        if (line.length < 2) continue;
        const a = line[0], z = line[line.length - 1];
        const key = `${a[0].toFixed(5)},${a[1].toFixed(5)},${z[0].toFixed(5)},${z[1].toFixed(5)},${line.length}`;
        if (this.done.has(key)) continue;
        if (!intersects(line, view)) continue;
        todo.push({ key, line, props: f.properties });
      }
    }
    const zDem = map.getZoom() >= 14 ? 14 : 13;
    // Process in chunks so the UI stays responsive.
    for (let k = 0; k < todo.length; k += 120) {
      if (run !== this.run) return;
      const chunk = todo.slice(k, k + 120);
      const samples = chunk.map((t) => densify(t.line, 8));
      const flat = samples.flatMap((s) => s.pts);
      const ele = await elevations(flat, zDem);
      let off = 0;
      chunk.forEach((t, ci) => {
        const s = samples[ci];
        const e = ele.subarray(off, off + s.pts.length);
        off += s.pts.length;
        this.done.set(t.key, grade(s, e, t.props));
      });
      this.publish();
    }
    this.loadOsm(view, run);
    // keep the cache bounded
    if (this.done.size > 6000) {
      const drop = this.done.size - 5000;
      let i = 0;
      for (const key of this.done.keys()) { if (i++ >= drop) break; this.done.delete(key); }
    }
  }

  publish() {
    const features = [];
    for (const list of this.done.values()) for (const f of list) features.push(f);
    for (const [, p] of this.osmTiles) if (p.result) for (const f of p.result) features.push(f);
    this.fc = { type: 'FeatureCollection', features };
    this.onData(this.fc);
  }

  // Explicit mtb:scale:uphill tags from OSM, cached per z12 tile.
  async loadOsm(view, run) {
    const z = 12;
    const [x0, y0] = lonLatToTile(view[0], view[3], z).map(Math.floor);
    const [x1, y1] = lonLatToTile(view[2], view[1], z).map(Math.floor);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 6) return;
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const key = `${x}/${y}`;
        if (this.osmTiles.has(key) || (this.osmFailed.get(key) || 0) > Date.now()) continue;
        const [w, s, e, n] = tileBounds(x, y, z);
        const q = `[out:json][timeout:20];way["mtb:scale:uphill"](${s},${w},${n},${e});out tags geom;`;
        const entry = { result: null };
        this.osmTiles.set(key, entry);
        cachedOverpass(`uphill/${z}/${key}`, q)
          .then(async (json) => {
            const ways = (json.elements || []).filter((el) => el.geometry);
            const out = [];
            for (const way of ways) {
              const line = way.geometry.map((p) => [p.lon, p.lat]);
              const s2 = densify(line, 8);
              const el = await elevations(s2.pts, 14);
              const forced = parseInt(way.tags['mtb:scale:uphill'], 10);
              out.push(...grade(s2, el, { 'mtb_scale': way.tags['mtb:scale'] }, Number.isFinite(forced) ? forced : null));
            }
            entry.result = out;
            if (run === this.run || this.enabled) this.publish();
          })
          .catch(() => { this.osmTiles.delete(key); this.osmFailed.set(key, Date.now() + OSM_RETRY); });
      }
    }
  }
}

// Overpass answers cached in IndexedDB: fresh for a week, and an older copy
// still beats nothing when every mirror is down.
async function cachedOverpass(key, query) {
  let hit = null;
  try { hit = await osmCache.get(key); } catch { /* storage blocked */ }
  if (hit && Date.now() - hit.at < OSM_TTL) return hit.json;
  try {
    const json = await overpass(query);
    const slim = {
      elements: (json.elements || []).filter((el) => el.geometry).map((el) => ({
        geometry: el.geometry, tags: { 'mtb:scale:uphill': el.tags['mtb:scale:uphill'], 'mtb:scale': el.tags['mtb:scale'] },
      })),
    };
    osmCache.set(key, { at: Date.now(), json: slim }).catch(() => {});
    return slim;
  } catch (err) {
    if (hit) return hit.json;
    throw err;
  }
}

function intersects(line, [w, s, e, n]) {
  for (const c of line) if (c[0] >= w && c[0] <= e && c[1] >= s && c[1] <= n) return true;
  return false;
}

function grade(sample, raw, props, forced = null) {
  const { pts, along } = sample;
  const out = [];
  if (pts.length < 2) return out;
  const ele = smooth(raw, along, 24);
  const tags = { highway: props.class === 'track' ? 'track' : 'path', 'mtb:scale': props.mtb_scale, surface: props.surface };
  let i = 0;
  while (i < pts.length - 1) {
    let j = i + 1;
    while (j < pts.length - 1 && along[j] - along[i] < PIECE) j++;
    const d = along[j] - along[i];
    const dh = ele[j] - ele[i];
    if (d >= 8 && Number.isFinite(dh)) {
      const g = Math.abs(dh / d) * 100;
      {
        // Flat pieces are ↑S0 too, so every trail stays continuously coloured.
        const cls = props.subclass === 'steps' ? 5 : forced != null && g >= 4 ? forced : uphillClass(g, g, techBump(tags, g));
        const seg = pts.slice(i, j + 1);
        out.push({
          type: 'Feature',
          properties: { cls, grade: Math.round(g), osm: forced != null },
          geometry: { type: 'LineString', coordinates: dh >= 0 ? seg : seg.reverse() },
        });
      }
    }
    i = j;
  }
  // Merge neighbours with the same class & direction to keep the source small.
  const merged = [];
  for (const f of out) {
    const prev = merged[merged.length - 1];
    if (prev && prev.properties.cls === f.properties.cls) {
      const pc = prev.geometry.coordinates, fc = f.geometry.coordinates;
      const pEnd = pc[pc.length - 1], fStart = fc[0];
      if (pEnd[0] === fStart[0] && pEnd[1] === fStart[1]) {
        pc.push(...fc.slice(1));
        prev.properties.grade = Math.max(prev.properties.grade, f.properties.grade);
        continue;
      }
    }
    merged.push(f);
  }
  return merged;
}

// Public Overpass mirrors come and go. Background queries try one mirror at a
// time (preferring the last one that worked); interactive ones race a few and
// keep the first answer.
let preferred = 0;
async function ask(i, query, signal, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  if (signal) signal.addEventListener('abort', () => ctrl.abort());
  try {
    const res = await fetch(OVERPASS[i], { method: 'POST', body: new URLSearchParams({ data: query }), signal: ctrl.signal });
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const json = await res.json();
    preferred = i;
    return json;
  } finally {
    clearTimeout(t);
  }
}

export async function overpass(query, { race = false } = {}) {
  const order = OVERPASS.map((_, k) => (preferred + k) % OVERPASS.length);
  if (race) {
    const stop = new AbortController();
    try {
      return await Promise.any(order.slice(0, 3).map((i) => ask(i, query, stop.signal, 25000)));
    } finally {
      stop.abort();
    }
  }
  let lastErr;
  for (const i of order) {
    try { return await ask(i, query, null, 20000); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
