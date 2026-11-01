// Winter: whether it's winter where you look, the snow FMI measures at its
// stations, and what OpenStreetMap says about ways in winter, drawn the way
// Trailmap's winter map does (wiki.trailmap.fi, "Trailmap MTB Talvikartta"):
//
// - how soon a way opens after snowfall: mtb:winter=1 (quickly, the sure picks),
//   2 / yes (clearly slower), 3 (slowly or not at all, mostly walkers);
// - ploughing on cycleways and paths: snowplowing / winter_service = yes, or no / limited;
// - no access in winter (bicycle:winter / foot:winter / mtb:winter = no), usually
//   a ski track's base;
// - ski tracks (piste:type=nordic), and ways there only in winter (seasonal=winter).
//
// BRouter's data has none of these tags, so they come from Overpass, one query
// per z12 tile (about 5 km), cached a week, and only while winter is on.

import { lonLatToTile, tileBounds, dist } from './geo.js';
import { cachedOverpass } from './osm.js';
import { request } from './net.js';
import { store } from './ui.js';

// ---------------------------------------------------------------- is it winter?
// "auto" (the default) decides from the snow where you look; "on" / "off" are yours.
export const winterSetting = () => store.get('winter', 'auto');
export const setWinterSetting = (v) => store.set('winter', v);
export const SNOW_ON = 5; // cm: winter from here …
export const SNOW_OFF = 2; // … and not until it's below this again (no flicker at the edge)

/**
 * Winter now? `snow`: the depth in cm where you look (null: not known). Auto
 * keeps its last answer between SNOW_OFF and SNOW_ON.
 */
export function isWinter(snow, was = false) {
  const s = winterSetting();
  if (s === 'on') return true;
  if (s === 'off') return false;
  if (snow == null) return was; // not known (yet): as it was
  return was ? snow >= SNOW_OFF : snow >= SNOW_ON;
}

// ---------------------------------------------------------------- FMI's measured snow
// Snow depth at FMI's automatic stations (about 107 in Finland, hourly; −1 when
// there's none), the last value of the past few hours. One request for all of
// Finland, kept an hour. CC BY 4.0, Finnish Meteorological Institute.
const FMI_WFS = 'https://opendata.fmi.fi/wfs';
let snowObs = null; // { at, list: [{ ll, cm, time, name }] }
let snowObsP = null;

export async function measuredSnow() {
  if (snowObs && Date.now() - snowObs.at < 3600e3) return snowObs.list;
  if (snowObsP) return snowObsP;
  const end = new Date(Math.floor(Date.now() / 600e3) * 600e3);
  const start = new Date(end.getTime() - 3 * 3600e3);
  const url = `${FMI_WFS}?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::simple`
    + `&bbox=19,59.5,32,70.2&parameters=snow_aws&timestep=60&starttime=${start.toISOString()}&endtime=${end.toISOString()}`;
  snowObsP = (async () => {
    const res = await request('fmi', url);
    if (!res.ok) throw new Error(`FMI ${res.status}`);
    const list = parseSnow(await res.text());
    snowObs = { at: Date.now(), list };
    return list;
  })().finally(() => { snowObsP = null; });
  return snowObsP;
}

/** FMI's simple WFS answer: the latest value per station (−1 and NaN: no snow / no value). */
export function parseSnow(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const by = new Map();
  for (const el of doc.getElementsByTagNameNS('*', 'BsWfsElement')) {
    const pos = el.getElementsByTagNameNS('*', 'pos')[0];
    const time = el.getElementsByTagNameNS('*', 'Time')[0];
    const val = el.getElementsByTagNameNS('*', 'ParameterValue')[0];
    if (!pos || !time || !val) continue;
    const [lat, lon] = pos.textContent.trim().split(/\s+/).map(Number);
    const v = parseFloat(val.textContent);
    if (!Number.isFinite(v)) continue;
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const t = Date.parse(time.textContent);
    const have = by.get(key);
    if (!have || t > have.time) by.set(key, { ll: [lon, lat], cm: Math.max(0, v), time: t });
  }
  return [...by.values()];
}

/** The nearest station's snow within `km` of [lon, lat], or null. */
export function snowNear(list, ll, km = 60) {
  let best = null;
  for (const o of list || []) {
    const d = dist(o.ll, ll);
    if (d <= km * 1000 && (!best || d < best.d)) best = { ...o, d };
  }
  return best;
}

// ---------------------------------------------------------------- OSM's winter ways
export const WINTER_Z = 12;
export const WINTER_MIN_ZOOM = 11;
const RETRY = 120e3;
const KEEP = ['highway', 'mtb:winter', 'snowplowing', 'winter_service', 'bicycle:winter', 'foot:winter', 'seasonal', 'piste:type', 'piste:grooming', 'piste:name', 'name', 'lit', 'bicycle', 'foot', 'access'];

export function winterQuery(x, y) {
  const [w, s, e, n] = tileBounds(x, y, WINTER_Z);
  const bb = `${s.toFixed(6)},${w.toFixed(6)},${n.toFixed(6)},${e.toFixed(6)}`;
  return `[out:json][timeout:25];(way["mtb:winter"](${bb});way[~"^(snowplowing|winter_service)$"~"."](${bb});`
    + `way[~"^(bicycle|foot):winter$"~"."](${bb});way[seasonal=winter](${bb});way["piste:type"="nordic"](${bb}););out tags geom qt;`;
}

const pick = (t = {}) => { const o = {}; for (const k of KEEP) if (t[k] != null) o[k] = t[k]; return o; };
export function slimWinter(json) {
  if (json.remark && /error|timed out|out of memory/i.test(json.remark)) throw new Error(`Overpass: ${json.remark}`);
  const w = [];
  for (const el of json.elements || []) if (el.type === 'way' && el.geometry) w.push([el.id, pick(el.tags), el.geometry.flatMap((p) => [+p.lon.toFixed(6), +p.lat.toFixed(6)])]);
  return { v: 1, w };
}

/**
 * What winter means on a way, Trailmap's classes:
 * 'closed' no access in winter (a ski track's base, usually), 'ski' a ski track and only that,
 * 'groomed' a ski track on a way still open to walking and cycling,
 * 'ploughed' maintained in winter, 'unploughed' not, 'open1' / 'open2' / 'open3' how soon
 * it opens after snow, 'seasonal' there only in winter; null: nothing said.
 */
export function winterClass(t) {
  const no = (v) => /^(no|private)$/.test(String(v || ''));
  if (no(t['bicycle:winter']) || no(t['foot:winter']) || no(t['mtb:winter'])) return 'closed';
  if (t['piste:type'] === 'nordic' && !t.highway) return 'ski'; // a ski track and nothing else: keep off
  // a ski track along a path, track or cycleway that walking and cycling aren't barred from: groomed,
  // still open to them (Trailmap's "groomed trail"); a barred one was 'closed' above
  if (t['piste:type'] === 'nordic') return 'groomed';
  const plough = String(t.snowplowing || t.winter_service || '');
  if (/^yes$/.test(plough)) return 'ploughed';
  if (/^(no|limited)$/.test(plough)) return 'unploughed';
  const m = String(t['mtb:winter'] || '');
  if (m === '1') return 'open1';
  if (m === '2' || m === 'yes') return 'open2';
  if (m === '3') return 'open3';
  if (t.seasonal === 'winter') return 'seasonal';
  return null;
}

export const WINTER_TEXT = {
  closed: 'No access in winter (usually a ski track)',
  ski: 'Ski track: keep off on foot and by bike',
  groomed: 'Groomed in winter, with a ski track: walking and cycling allowed, off the track itself',
  ploughed: 'Ploughed in winter',
  unploughed: 'Not ploughed in winter',
  open1: 'Opens quickly after snow',
  open2: 'Opens more slowly after snow',
  open3: 'Opens slowly, or not at all, after snow',
  seasonal: 'There only in winter (over ice or bog)',
};

const tiles = new Map(); // "x/y" -> { promise, data }
const failed = new Map();
const listeners = new Set();
let fetching = true, failing = false;
/** Tests and screenshots: never ask Overpass (seed tiles instead; with `fail`, as if it didn't answer). */
export function holdWinterFetches(on = true, fail = false) { fetching = !on; failing = on && fail; }
/** Retry: ask again now for the tiles that failed. */
export function forgetWinterFailures() { failed.clear(); }
export const onWinterTile = (fn) => listeners.add(fn);

export function winterTile(x, y) {
  const key = `${x}/${y}`;
  const have = tiles.get(key);
  if (have && (have.data || fetching)) return have.promise; // (held, one on its way counts as held)
  if (!fetching) return Promise.reject(failing ? new Error('Overpass didn’t answer') : Object.assign(new Error('held'), { held: true })); // (held: whatever it did before, as a test asks)
  if ((failed.get(key) || 0) > Date.now()) return Promise.reject(new Error('Overpass busy'));
  const entry = { data: null };
  entry.promise = cachedOverpass(`winter1/${WINTER_Z}/${key}`, winterQuery(x, y), slimWinter, { timeoutMs: 30000 })
    .then((data) => { entry.data = data; for (const fn of listeners) fn(key); return data; })
    .catch((err) => { tiles.delete(key); failed.set(key, Date.now() + RETRY); throw err; });
  tiles.set(key, entry);
  if (tiles.size > 60) for (const [k, t] of tiles) { if (tiles.size <= 60) break; if (t.data) tiles.delete(k); }
  return entry.promise;
}

export function seedWinterTile(x, y, json) {
  const data = json.v ? json : slimWinter(json);
  tiles.set(`${x}/${y}`, { promise: Promise.resolve(data), data });
  failed.delete(`${x}/${y}`);
  for (const fn of listeners) fn(`${x}/${y}`);
}

export function winterTilesIn([w, s, e, n]) {
  const [x0, y0] = lonLatToTile(w, n, WINTER_Z).map(Math.floor);
  const [x1, y1] = lonLatToTile(e, s, WINTER_Z).map(Math.floor);
  const out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([x, y]);
  return out;
}

/** The loaded tiles' ways with a winter class, as GeoJSON (one feature per way). */
export function winterFeatures(keys) {
  const seen = new Set(), features = [];
  for (const k of keys) {
    const d = (tiles.get(k) || {}).data;
    if (!d) continue;
    for (const [id, t, flat] of d.w) {
      if (seen.has(id)) continue;
      seen.add(id);
      const cls = winterClass(t);
      if (!cls) continue;
      const coords = [];
      for (let i = 0; i < flat.length; i += 2) coords.push([flat[i], flat[i + 1]]);
      features.push({ type: 'Feature', id, properties: { cls, name: t['piste:name'] || t.name || '', lit: t.lit === 'yes' ? 1 : 0, grooming: t['piste:grooming'] || '' }, geometry: { type: 'LineString', coordinates: coords } });
    }
  }
  return { type: 'FeatureCollection', features };
}

/** Keeps the winter ways of the view loaded and published while `on`. */
export class WinterWays {
  constructor(map, onData) {
    this.map = map;
    this.onData = onData;
    this.on = false;
    this.timer = 0;
    map.on('moveend', () => this.schedule());
    onWinterTile(() => this.publish());
  }
  setEnabled(on) { this.on = on; this.schedule(0); this.publish(); }
  schedule(ms = 300) { clearTimeout(this.timer); this.timer = setTimeout(() => this.update(), ms); }
  keys() {
    const b = this.map.getBounds();
    return winterTilesIn([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]).map(([x, y]) => `${x}/${y}`);
  }
  update() {
    if (!this.on || this.map.getZoom() < WINTER_MIN_ZOOM) return;
    const keys = this.keys();
    if (keys.length > 12) return;
    for (const k of keys) { const [x, y] = k.split('/').map(Number); winterTile(x, y).catch(() => {}); }
    this.publish();
  }
  // (below the zoom where they draw, no tiles are listed: zoomed far out, that's millions, #667)
  publish() { this.onData(this.on && this.map.getZoom() >= WINTER_MIN_ZOOM ? winterFeatures(this.keys()) : { type: 'FeatureCollection', features: [] }); }
}

// ---------------------------------------------------------------- sea ice
// FMI's daily Baltic ice charts through Copernicus Marine's WMTS (no account):
// ice concentration on a 1 km grid. Open water would come out solid; the
// `seaice://` protocol fetches the tile and leaves the water clear.
export const SEA_ICE = 'https://wmts.marine.copernicus.eu/teroWmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0'
  + '&LAYER=SEAICE_BAL_SEAICE_L4_NRT_OBSERVATIONS_011_004/FMI-BAL-SEAICE_CONC-L4-NRT-OBS/ice_concentration'
  + '&STYLE=cmap:ice,range:1/100,noClamp&TILEMATRIXSET=EPSG:3857&FORMAT=image/png';

export function seaIceProtocol(maplibre) {
  maplibre.addProtocol('seaice', async (params, abort) => {
    const [, z, x, y] = params.url.match(/seaice:\/\/(\d+)\/(\d+)\/(\d+)/) || [];
    const res = await request('copernicus', `${SEA_ICE}&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`, { signal: abort.signal });
    if (!res.ok) throw new Error(`Copernicus ${res.status}`);
    const bmp = await createImageBitmap(await res.blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    // below the range (open water, under 1 %) comes as near-black: clear it
    for (let i = 0; i < d.length; i += 4) if (d[i] < 40 && d[i + 1] < 40 && d[i + 2] < 60) d[i + 3] = 0;
    ctx.putImageData(img, 0, 0);
    return { data: await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer() };
  });
}

// ---------------------------------------------------------------- winter on a route
/**
 * The winter class at each sample of a route (analysis `a`), from the winter tiles
 * along it: the nearest classed way within 8 m, else null. Loads what's missing
 * (Overpass, cached a week); null when the route spans too many tiles. `lost`
 * on it: how many tiles didn't answer (a test's held ones aren't asked).
 */
export async function winterAlong(a, { maxTiles = 24 } = {}) {
  let w = 180, s = 90, e = -180, n = -90;
  for (const [x, y] of a.pts) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  const list = winterTilesIn([w, s, e, n]);
  if (list.length > maxTiles) return null;
  const got = await Promise.allSettled(list.map(([x, y]) => winterTile(x, y)));
  // segments of the classed ways, in a coarse grid
  const CELL = 0.0006, grid = new Map(), key = (x, y) => `${Math.floor(x / CELL)},${Math.floor(y / (CELL / 2))}`;
  for (const [x, y] of list) {
    const d = (tiles.get(`${x}/${y}`) || {}).data;
    if (!d) continue;
    for (const [, t, flat] of d.w) {
      const cls = winterClass(t);
      if (!cls) continue;
      for (let i = 2; i < flat.length; i += 2) {
        const p = [flat[i - 2], flat[i - 1]], q = [flat[i], flat[i + 1]];
        const k = key((p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push([p, q, cls]);
      }
    }
  }
  const out = new Array(a.pts.length).fill(null);
  a.pts.forEach((pt, i) => {
    const cx = Math.floor(pt[0] / CELL), cy = Math.floor(pt[1] / (CELL / 2));
    let best = 8, cls = null;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const [p, q, c] of grid.get(`${cx + dx},${cy + dy}`) || []) {
        const d = pointSegmentM(pt, p, q);
        if (d < best) { best = d; cls = c; }
      }
    }
    out[i] = cls;
  });
  out.lost = got.filter((r) => r.status === 'rejected' && !(r.reason || {}).held).length;
  return out;
}
function pointSegmentM(p, a, b) {
  const k = Math.cos((p[1] * Math.PI) / 180);
  const ax = (a[0] - p[0]) * k, ay = a[1] - p[1], bx = (b[0] - p[0]) * k, by = b[1] - p[1];
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
  return Math.hypot(ax + dx * t, ay + dy * t) * 111195;
}

/**
 * How much slower snow makes a stretch: a speed factor (1 = as in summer), from the
 * snow on the ground (cm), the kind of way ('paved' | 'unpaved' | 'trail'), how it
 * fares in winter (its class from winterAlong, or null) and how you go ('bike' | 'foot').
 * Rough, and said to be: ploughed ways little, packed trails some, deep snow on a
 * trail a lot (a bike in 20 cm of fresh snow is down to a third, or pushed).
 */
export function snowFactor(cm, way, cls, how) {
  if (!(cm >= 3)) return 1;
  if (cls === 'ploughed' || cls === 'groomed') return how === 'bike' ? 0.88 : 0.95;
  const clamp = (v, lo) => Math.max(lo, Math.min(1, v));
  if (how === 'bike') {
    if (cls === 'open1') return clamp(1 - cm / 50, 0.6);
    if (cls === 'open2') return clamp(1 - cm / 35, 0.45);
    if (cls === 'open3' || cls === 'unploughed') return clamp(1 - cm / 20, 0.3);
    return way === 'paved' ? 0.85 : clamp(1 - cm / 25, 0.35); // streets mostly get ploughed
  }
  if (cls === 'open1') return clamp(1 - cm / 90, 0.75);
  if (cls === 'open3' || cls === 'unploughed') return clamp(1 - cm / 45, 0.5);
  return way === 'paved' ? 0.92 : clamp(1 - cm / 60, 0.55);
}

/**
 * Wind chill (°C), the Environment Canada / FMI formula, for the air moving past you:
 * the wind (m/s) and your own speed (km/h). Only below 10 °C and above 5 km/h of air.
 */
export function windChill(t, windMs, ownKmh = 0) {
  const v = windMs * 3.6 + ownKmh;
  if (t > 10 || v < 4.8) return t;
  const p = v ** 0.16;
  return 13.12 + 0.6215 * t - 11.37 * p + 0.3965 * t * p;
}
