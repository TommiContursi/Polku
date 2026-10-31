// Lit ways: which ways OpenStreetMap says are lit after dark (lit=yes and the
// like), and which it says aren't (lit=no). A way it says nothing about gets no
// line: unknown isn't unlit. OpenFreeMap's tiles don't carry `lit`, so it comes
// from Overpass, one query per z13 tile (the trail details' grid, about 2.3 km
// here), cached a week, and only while the overlay is on (#638).

import { tileBounds } from './geo.js';
import { cachedOverpass } from './osm.js';
import { tilesIn } from './trails.js';

export const LIT_Z = 13;
export const LIT_MIN_ZOOM = 14; // tiles load from here; loaded ones still draw down to z13
const RETRY = 120e3; // a failed tile is left alone for 2 minutes
const MAX_VIEW = 12; // more tiles than this in view: zoomed out too far to load
const LIT = /^(yes|24\/7|automatic|sunset-sunrise|limited|interval)$/;
const UNLIT = /^(no|disused)$/;

export function litQuery(x, y) {
  const [w, s, e, n] = tileBounds(x, y, LIT_Z);
  return `[out:json][timeout:25];way[highway][lit](${s.toFixed(6)},${w.toFixed(6)},${n.toFixed(6)},${e.toFixed(6)});out tags geom qt;`;
}

/** Overpass's answer as [id, 1 lit or 0 unlit, flat coordinates]; any other `lit` value counts as no tag. */
export function slimLit(json) {
  if (json.remark && /error|timed out|out of memory/i.test(json.remark)) throw new Error(`Overpass: ${json.remark}`);
  const w = [];
  for (const el of json.elements || []) {
    const v = (el.tags || {}).lit, lit = LIT.test(v) ? 1 : UNLIT.test(v) ? 0 : -1;
    if (el.type === 'way' && el.geometry && lit >= 0) w.push([el.id, lit, el.geometry.flatMap((p) => [+p.lon.toFixed(6), +p.lat.toFixed(6)])]);
  }
  return { v: 1, w };
}

const tiles = new Map(); // "x/y" -> { promise, data }
const failed = new Map(); // "x/y" -> retry after (ms)
const listeners = new Set();
let fetching = true, failing = false;
/** Tests and screenshots: never ask Overpass (seed tiles instead; with `fail`, as if it didn't answer). */
export function holdLitFetches(on = true, fail = false) { fetching = !on; failing = on && fail; }
/** Retry: ask again now for the tiles that failed. */
export function forgetLitFailures() { failed.clear(); }

export function litTile(x, y) {
  const key = `${x}/${y}`;
  const have = tiles.get(key);
  if (have && (have.data || fetching)) return have.promise; // (held, one on its way counts as held)
  if (!fetching) return Promise.reject(failing ? new Error('Overpass didn’t answer') : Object.assign(new Error('held'), { held: true }));
  if ((failed.get(key) || 0) > Date.now()) return Promise.reject(new Error('Overpass busy'));
  const entry = { data: null };
  entry.promise = cachedOverpass(`lit1/${LIT_Z}/${key}`, litQuery(x, y), slimLit, { timeoutMs: 30000 })
    .then((data) => { entry.data = data; for (const fn of listeners) fn(key); return data; })
    .catch((err) => { tiles.delete(key); failed.set(key, Date.now() + RETRY); throw err; });
  tiles.set(key, entry);
  if (tiles.size > 60) for (const [k, t] of tiles) { if (tiles.size <= 60) break; if (t.data) tiles.delete(k); }
  return entry.promise;
}

/** Put a tile in place without asking Overpass (tests and screenshots, from a recorded answer). */
export function seedLitTile(x, y, json) {
  const data = json.v ? json : slimLit(json);
  tiles.set(`${x}/${y}`, { promise: Promise.resolve(data), data });
  failed.delete(`${x}/${y}`);
  for (const fn of listeners) fn(`${x}/${y}`);
}

const loaded = (x, y) => (tiles.get(`${x}/${y}`) || {}).data;

/** The tiles' lit and unlit ways as GeoJSON, one feature per way (`lit`: 1 or 0). */
export function litFeatures(list) {
  const seen = new Set(), features = [];
  for (const [x, y] of list) {
    for (const [id, lit, flat] of (loaded(x, y) || { w: [] }).w) {
      if (seen.has(id)) continue; // a way crossing tiles comes once
      seen.add(id);
      const coords = [];
      for (let i = 0; i < flat.length; i += 2) coords.push([flat[i], flat[i + 1]]);
      features.push({ type: 'Feature', id, properties: { lit }, geometry: { type: 'LineString', coordinates: coords } });
    }
  }
  return { type: 'FeatureCollection', features };
}

/** Keeps the lit ways of the view loaded and published while on; `failing` while a tile in view didn't answer. */
export class LitWays {
  constructor(map, { onData, onFail }) {
    this.map = map;
    this.onData = onData;
    this.onFail = onFail;
    this.on = false;
    this.failing = false;
    this.shown = null;
    this.timer = 0;
    map.on('moveend', () => this.schedule());
    listeners.add(() => this.schedule(60));
  }
  setEnabled(on) {
    if (on === this.on) return;
    this.on = on;
    this.failing = false;
    this.schedule(0);
  }
  schedule(ms = 300) { clearTimeout(this.timer); this.timer = setTimeout(() => this.update(), ms); }
  update() {
    const z = this.map.getZoom(), b = this.map.getBounds();
    const want = this.on ? tilesIn([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]) : [];
    if (z >= LIT_MIN_ZOOM && want.length <= MAX_VIEW) {
      for (const [x, y] of want) {
        if (loaded(x, y)) continue;
        litTile(x, y).catch((err) => {
          if (err.held || !this.on) return;
          this.failing = true;
          this.onFail();
        });
      }
      if (want.every(([x, y]) => loaded(x, y))) this.failing = false;
    }
    this.publish(z >= LIT_Z ? want.filter(([x, y]) => loaded(x, y)) : []);
  }
  publish(list) {
    const key = list.map((t) => t.join('/')).join(';');
    if (key === this.shown) return;
    this.shown = key;
    this.onData(litFeatures(list));
  }
}
