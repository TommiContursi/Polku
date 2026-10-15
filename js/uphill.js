// Uphill difficulty for every trail in view.
//
// OSM rarely carries mtb:scale:uphill, so we compute it: each path/track in the
// loaded vector tiles is resampled, its elevation profile is read from the lidar
// DEM, and it is cut into ~25 m pieces graded ↑S0–↑S5 by climbing gradient
// (bumped for loose surface / technical mtb:scale). Pieces are oriented uphill
// so the arrow symbols point the way you'd be climbing. Where OSM does have an
// explicit mtb:scale:uphill tag, that wins: it comes with the trail details
// (js/trails.js, one Overpass query per z13 tile, shared).

import { densify } from './geo.js';
import { elevations, smooth } from './dem.js';
import { uphillClass, techBump } from './analysis.js';
import { trailTile, tilesIn } from './trails.js';

const PIECE = 25;
const MIN_ZOOM = 13;

export class UphillLayer {
  constructor(map, onData) {
    this.map = map;
    this.onData = onData;
    this.enabled = false;
    this.fc = { type: 'FeatureCollection', features: [] };
    // feature key -> features; `partial` on the list when a terrain tile didn't load for it
    this.done = new Map();
    this.osmTiles = new Map(); // z13 trail-details tile -> { result, partial }
    this.timer = 0;
    this.run = 0;
    map.on('moveend', () => this.schedule());
    map.on('sourcedata', (e) => { if (e.sourceId === 'ofm' && e.isSourceLoaded) this.schedule(); });
  }

  setEnabled(on) {
    const was = this.enabled;
    this.enabled = on;
    if (on) {
      // back on: show what's already graded right away (update() only publishes
      // when it grades something new, so a cached view would stay blank)
      if (!was) this.publish();
      this.schedule();
    } else { this.fc = { type: 'FeatureCollection', features: [] }; this.onData(this.fc); }
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
        const had = this.done.get(key);
        if (had && !had.partial) continue; // graded without some of its terrain: again, once it loads
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
        const list = grade(s, e, t.props);
        // a tile that failed leaves its points without heights (dem.js asks for it again after a while)
        if (ele.failed && e.some(Number.isNaN)) list.partial = true;
        this.done.set(t.key, list);
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

  // Explicit mtb:scale:uphill tags from OSM, from the trail-details tiles.
  async loadOsm(view, run) {
    const list = tilesIn(view);
    if (list.length > 12) return;
    for (const [x, y] of list) {
      const key = `${x}/${y}`;
      const had = this.osmTiles.get(key);
      if (had && !had.partial) continue;
      const entry = { result: had ? had.result : null }; // what's shown stays until it's graded again
      this.osmTiles.set(key, entry);
      trailTile(x, y)
        .then(async (data) => {
          const out = [];
          let failed = 0;
          for (const [, t, flat] of data.w) {
            const forced = parseInt(t['mtb:scale:uphill'], 10);
            if (!Number.isFinite(forced)) continue;
            const line = [];
            for (let i = 0; i < flat.length; i += 2) line.push([flat[i], flat[i + 1]]);
            const s2 = densify(line, 8);
            const el = await elevations(s2.pts, 14);
            failed += el.failed;
            out.push(...grade(s2, el, { 'mtb_scale': t['mtb:scale'] }, forced));
          }
          entry.result = out;
          entry.partial = failed > 0; // graded again on a later map move
          if (run === this.run || this.enabled) this.publish();
        })
        .catch(() => { this.osmTiles.delete(key); }); // trailTile waits 2 min before asking again
    }
  }
}

/**
 * Incline and uphill grade of the ~25 m of way under a point, from the DEM, for
 * hover and click when the uphill layer is off. Same smoothing and grading as
 * the layer. Reads DEM tiles (usually already cached), never Overpass.
 */
export async function gradeHere(f, ll) {
  const g = f.geometry;
  const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
  const k = Math.cos((ll[1] * Math.PI) / 180);
  let best = null;
  for (const line of lines) {
    if (line.length < 2) continue;
    const s = densify(line, 8);
    s.pts.forEach((p, i) => {
      const d = ((p[0] - ll[0]) * k) ** 2 + (p[1] - ll[1]) ** 2;
      if (!best || d < best.d) best = { d, i, s };
    });
  }
  if (!best) return null;
  const { s, i } = best;
  const at = s.along[i];
  const lo = s.along.findIndex((a) => a >= at - 40);
  let hi = s.along.length - 1;
  while (hi > i && s.along[hi] > at + 40) hi--;
  const along = s.along.slice(lo, hi + 1);
  if (along[along.length - 1] - along[0] < 12) return null;
  const ele = smooth(await elevations(s.pts.slice(lo, hi + 1), 14), along, 24);
  const j = i - lo;
  let a = j, b = j;
  while (a > 0 && along[j] - along[a] < 12.5) a--;
  while (b < along.length - 1 && along[b] - along[j] < 12.5) b++;
  const dh = ele[b] - ele[a];
  if (!Number.isFinite(dh) || along[b] - along[a] < 8) return null;
  const grade = Math.abs(dh / (along[b] - along[a])) * 100;
  const p = f.properties;
  const tags = { highway: p.class === 'track' ? 'track' : 'path', 'mtb:scale': p.mtb_scale, surface: p.surface };
  return { grade: Math.round(grade), cls: p.subclass === 'steps' ? 5 : uphillClass(grade, grade, techBump(tags, grade)) };
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
