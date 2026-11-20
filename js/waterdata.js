// What the paddling router keeps out of, or clear of, beyond land (js/water.js):
//
// - fairways: Väylävirasto's fairway areas (CC BY 4.0), shipping lanes apart
//   from small-boat routes and harbour basins (nautical.js waterwaysIn);
// - marked dangers: Väylävirasto's isolated-danger and cardinal marks, and the
//   rocks, reefs, shoals and wrecks mapped in OpenStreetMap (ODbL, Overpass);
// - stones in the water at and above the surface, stone fields and shoals on the National Land Survey's
//   background map (CC BY 4.0), in Finland (#153);
// - lake depths: Syke's soundings under 0.5 m, and where Syke surveyed (CC BY 4.0), from Polku's own
//   files made by tools/syke_depths.py (#1184): about 1,900 lakes, none of the sea;
// - the wind at the leg, from the forecast Polku already uses (Open-Meteo).
//
// Traficom's depths are not used: they are licensed for "other than navigational
// purposes", and the licence counts route planning as navigation.
//
// Each source is optional: if one doesn't answer, the leg is routed without
// it and Heads-up says so.

import { waterwaysIn } from './nautical.js';
import { request } from './net.js';
import { cachedOverpass } from './osm.js';
import { hostedTile, forgetHostedFailures } from './osm-data.js';
import { OSM_DATA_MANIFEST, MML_TERRAIN_TILES, FINLAND_BOUNDS, mmlApiKey } from './config.js';
import { decodeTile } from './vectortile.js';
import { pointForecasts, sampleAt } from './weather.js';
import { lonLatToTile, tileBounds } from './geo.js';

// A source gets this long before the leg is routed without it. Its answer still
// comes, goes into the cache, and tells onWaterData listeners (the planner
// re-routes the legs that went without it; a leg still being routed then is
// routed again in water.js).
const WAIT_MS = 2500;
const inTime = (p, ms = WAIT_MS) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('slow')), ms))]);
// A source that just made a leg wait in vain isn't waited for again for a little
// while: a round trip's twelve legs would otherwise wait 2.5 s each for the same
// slow answer. The answer still comes and the planner's legs are routed again then.
const SLOW_FOR = 20e3;
const slowUntil = {};
// (an answer that has come in meanwhile still counts: a moment's grace)
const waitFor = (src, p) => (Date.now() < (slowUntil[src] || 0)
  ? inTime(p, 30)
  : inTime(p).catch((e) => { slowUntil[src] = Date.now() + SLOW_FOR; throw e; }));
const late = new Set();
let lateCount = 0; // late answers so far: water.js routes a leg again if one came while it was being routed
export function onWaterData(fn) { late.add(fn); return () => late.delete(fn); }
export const lateAnswers = () => lateCount;
// (also when a source that failed may be asked again: the planner routes the legs that went without it, which asks)
const tell = () => { for (const fn of late) fn(); };
const lateArrived = () => { lateCount++; tell(); };
const AGAIN_MS = 120e3; // a source that failed is asked again after this (#129)

// Rocks, reefs, shoals and wrecks in OSM (points; reefs and shoals also as
// areas), one Overpass query per z11 tile (about 10 × 10 km), kept a week.
const HZ = 11;
const hazTiles = new Map(); // "x/y" -> Promise<{ points, areas }>
const failedHaz = new Set(); // the ones that didn't answer, asked again in a couple of minutes (or on Retry)
function hazTile(x, y) {
  const id = `${x}/${y}`;
  if (hazTiles.has(id)) return hazTiles.get(id);
  const [w, s, e, n] = tileBounds(x, y, HZ);
  const bb = [s, w, n, e].map((v) => +v.toFixed(5));
  const q = `[out:json][timeout:25];(
node["seamark:type"~"^(rock|obstruction|wreck)$"](${bb});
node["natural"~"^(rock|reef|shoal)$"](${bb});
way["natural"~"^(reef|shoal)$"](${bb});
way["seamark:type"~"^(rock|obstruction)$"](${bb});
);out geom;`;
  const slim = (json) => {
    const points = [], areas = [];
    for (const el of json.elements || []) {
      const t = el.tags || {};
      // a charted rock always above the water is kept as clear as MML's stones above the surface (#153); one that may
      // be awash or under it, or doesn't say, as a stone at the surface
      const dry = /^(always_)?dry$/.test(t['seamark:rock:water_level'] || t['seamark:obstruction:water_level'] || '');
      const kind = dry ? 'above' : t['seamark:type'] || t.natural || 'rock';
      if (el.type === 'node') points.push([+el.lon.toFixed(6), +el.lat.toFixed(6), kind]);
      else if (el.geometry && el.geometry.length > 1) areas.push({ kind, coords: el.geometry.map((g) => [+g.lon.toFixed(6), +g.lat.toFixed(6)]) });
    }
    return { points, areas };
  };
  const p = hostedTile(OSM_DATA_MANIFEST, 'hazards', HZ, [x, y],
    () => cachedOverpass(`waterhaz/${HZ}/${id}`, q, slim, { race: true, oneRound: true, timeoutMs: 15000 }), { slim });
  p.catch(() => { failedHaz.add(id); setTimeout(() => { if (hazTiles.get(id) === p) { hazTiles.delete(id); tell(); } failedHaz.delete(id); }, AGAIN_MS); }); // ask again in a couple of minutes
  hazTiles.set(id, p);
  return p;
}
// Lake depths: one file per z10 tile where Syke surveyed, listed in index.json (tools/syke_depths.py)
const DEPTHS = new URL('../data/depths/', import.meta.url);
const DZ = 10;
const depthFiles = new Map(); // "index" or "x-y" -> Promise<json>
const failedDepth = new Set();
function depthFile(name) {
  if (depthFiles.has(name)) return depthFiles.get(name);
  // Polku's own files: one that fails pauses nothing else of Polku's (no back-off), and one that hangs fails in time,
  // so Retry and AGAIN_MS ask again
  const p = request('polku', new URL(`${name}.json`, DEPTHS), { credentials: 'omit', backoff: false, timeoutMs: 10000 }).then((r) => {
    if (!r.ok) throw new Error(`${name}.json: ${r.status}`);
    return r.json();
  });
  p.catch(() => { failedDepth.add(name); setTimeout(() => { if (depthFiles.get(name) === p) { depthFiles.delete(name); tell(); } failedDepth.delete(name); }, AGAIN_MS); });
  depthFiles.set(name, p);
  return p;
}
// the tiles over the box Syke surveyed: [{ x, y, shallow, surveyed }], none over the sea; null: too many tiles to ask for
function depthsIn([w, s, e, n], max) {
  const [x0, y0] = lonLatToTile(w, n, DZ).map(Math.floor);
  const [x1, y1] = lonLatToTile(e, s, DZ).map(Math.floor);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > max) return null;
  return depthFile('index').then((ix) => {
    const have = new Set(ix.tiles.map(([x, y]) => `${x}-${y}`)), list = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (have.has(`${x}-${y}`)) list.push(depthFile(`${x}-${y}`).then((t) => ({ x, y, ...t })));
    return Promise.all(list);
  });
}
async function lakeDepths(box) {
  const all = depthsIn(box, 24); // as many tiles as Väylävirasto's
  if (!all) return null;
  try {
    return await waitFor('depths', all);
  } catch (err) {
    all.then(lateArrived, () => {});
    throw err;
  }
}

// Stones in the water, stone fields and shoals on MML's background map (#153): its zoom-14 tiles, the only ones with
// the stones, at the map's own address and key, so the browser's cache has those the map has shown. A tile with no
// features at all is outside MML's map, as every tile outside Finland is.
const MZ = 14;
const MML_KINDS = { 38512: 'rock', 38513: 'above', 38600: 'stonefield', 38700: 'shoal' }; // a stone at the surface, above it
let mmlOwn = '';
/** The person's own MML key (Settings), or none for Polku's. */
export const useMmlKey = (key) => { mmlOwn = key || ''; };
const mmlTiles = new Map(); // "x/y" -> Promise<{ x, y, covered, points, areas }>
const failedMml = new Set();
function mmlTile(x, y) {
  const id = `${x}/${y}`;
  if (mmlTiles.has(id)) return mmlTiles.get(id);
  const url = `${MML_TERRAIN_TILES.replace('{z}', MZ).replace('{y}', y).replace('{x}', x)}?api-key=${encodeURIComponent(mmlApiKey(mmlOwn))}`;
  const ll = (fx, fy) => { const [lon, , , lat] = tileBounds(x + fx, y + fy, MZ); return [+lon.toFixed(6), +lat.toFixed(6)]; };
  const ring = (r) => { const c = []; for (let i = 0; i < r.length; i += 2) c.push(ll(r[i], r[i + 1])); c.push(c[0]); return c; };
  // as the depth files: one that fails pauses nothing else, and one that hangs fails in time
  const p = request('mml', url, { backoff: false, timeoutMs: 10000 }).then(async (r) => {
    if (!r.ok) throw new Error(`MML ${id}: ${r.status}`);
    const t = decodeTile(new Uint8Array(await r.arrayBuffer()), ['maasto_piste', 'maasto_alue']), points = [], areas = [];
    for (const f of t.layers.maasto_piste || []) { const kind = MML_KINDS[f.props.kohdeluokka]; if (kind) for (const r of f.rings) points.push([...ll(r[0], r[1]), kind]); }
    for (const f of t.layers.maasto_alue || []) { const kind = MML_KINDS[f.props.kohdeluokka]; if (kind) areas.push({ kind, rings: f.rings.map(ring) }); }
    return { x, y, covered: t.n > 0, points, areas };
  });
  p.catch(() => { failedMml.add(id); setTimeout(() => { if (mmlTiles.get(id) === p) { mmlTiles.delete(id); tell(); } failedMml.delete(id); }, AGAIN_MS); });
  mmlTiles.set(id, p);
  return p;
}
// the tiles over the box and Finland's (none outside it); null: too many to ask for
function mmlTilesIn([w, s, e, n], max) {
  const [W, S, E, N] = FINLAND_BOUNDS;
  if (e < W || w > E || n < S || s > N) return [];
  const [x0, y0] = lonLatToTile(Math.max(w, W), Math.min(n, N), MZ).map(Math.floor);
  const [x1, y1] = lonLatToTile(Math.min(e, E), Math.max(s, S), MZ).map(Math.floor);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > max) return null;
  const list = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) list.push(mmlTile(x, y));
  return list;
}
async function mmlStones(box) {
  const tiles = mmlTilesIn(box, 64); // legs up to about 5 km
  if (!tiles) return null;
  const all = Promise.all(tiles);
  try {
    return await waitFor('mml', all);
  } catch (err) {
    all.then(lateArrived, () => {});
    throw err;
  }
}

/** Retry: ask again now for what didn't answer, and wait for it as long as the first time. */
export function forgetWaterFailures() {
  forgetHostedFailures(OSM_DATA_MANIFEST);
  for (const id of failedHaz) hazTiles.delete(id);
  failedHaz.clear();
  for (const name of failedDepth) depthFiles.delete(name);
  failedDepth.clear();
  for (const id of failedMml) mmlTiles.delete(id);
  failedMml.clear();
  for (const k of Object.keys(slowUntil)) delete slowUntil[k];
}
function hazTilesIn([w, s, e, n], max) {
  const [x0, y0] = lonLatToTile(w, n, HZ).map(Math.floor);
  const [x1, y1] = lonLatToTile(e, s, HZ).map(Math.floor);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > max) return null;
  const list = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) list.push(hazTile(x, y));
  return list;
}
async function osmHazards(box) {
  const tiles = hazTilesIn(box, 16); // a very long leg: skip rather than ask for half a province (null: skipped)
  if (!tiles) return null;
  const all = Promise.all(tiles);
  try {
    const got = await waitFor('osm', all);
    return { points: got.flatMap((t) => t.points), areas: got.flatMap((t) => t.areas) };
  } catch (err) {
    all.then(lateArrived, () => {});
    throw err;
  }
}

/**
 * Fetch what the router will want for the map's view ahead of time (paddling,
 * zoomed in): OSM's hazards, MML's stones, Väylävirasto's fairways and marks, and the lake depths.
 */
export function prefetchWater(view) {
  hazTilesIn(view, 6);
  mmlTilesIn(view, 16);
  waterwaysIn(view, 8).catch(() => {});
  depthsIn(view, 8)?.catch(() => {});
}

// the wind at `at`: from the 10-day forecast more than two days ahead; past its last hour none, so no wave is judged
// by that hour's wind repeated (#465: Not checked says the waves aren't checked from there)
async function windAt(mid, at) {
  const t = at || Date.now() / 1000;
  const [s] = await pointForecasts([mid], { long: t > Date.now() / 1000 + 46 * 3600 });
  if (t > s.time[s.time.length - 1]) return null;
  const v = sampleAt(s, t);
  return { speed: v.speed, gust: v.gust, dir: v.dir };
}

/**
 * What to draw into the router's grid for a leg's box. `want`: { fairways, hazards, mml,
 * depths, wind } (booleans) and `at` (epoch seconds, for the wind). Returns GeoJSON for
 * the grid plus the lake depths' tiles (`depths`, null when not asked or not answered),
 * MML's tiles (`mml`: [{ x, y, covered }], null likewise; none outside Finland),
 * the wind, `missing`: sources that didn't answer, and `skipped`: sources not asked,
 * the box being too big for them (#490).
 */
// Tests answer from recorded files: fn(box, want, at) → what waterInputs returns, or null to ask the services.
let seeded = null;
export function seedWater(fn) { seeded = fn; }

export async function waterInputs(box, want, at) {
  const fx = seeded && seeded(box, want, at);
  if (fx) return fx;
  const [w, s, e, n] = box;
  const mid = [(w + e) / 2, (s + n) / 2];
  const missing = [], skipped = [];
  const skip = (src) => (got) => { if (!got) skipped.push(src); return got; };
  const [ways, osm, mml, depths, wind] = await Promise.all([
    want.fairways || want.hazards ? (() => { const p = waterwaysIn(box); return waitFor('vayla', p).then(skip('Väylävirasto'), () => { missing.push('Väylävirasto'); p.then(lateArrived, () => setTimeout(tell, AGAIN_MS)); return null; }); })() : null,
    want.hazards ? osmHazards(box).then(skip('OpenStreetMap'), () => { missing.push('OpenStreetMap'); return null; }) : null,
    want.mml ? mmlStones(box).then(skip('the National Land Survey'), () => { missing.push('the National Land Survey'); return null; }) : null,
    want.depths ? lakeDepths(box).then(skip('Syke'), () => { missing.push('Syke'); return null; }) : null,
    want.wind ? waitFor('wind', windAt(mid, at)).catch(() => { missing.push('the wind forecast'); return null; }) : null,
  ]);
  const fc = (features) => ({ type: 'FeatureCollection', features });
  const fairways = want.fairways && ways ? fc(ways.fairways) : fc([]);
  const hazards = [];
  if (want.hazards) {
    for (const f of (ways && ways.marks) || []) hazards.push({ type: 'Feature', properties: { kind: f.properties.kind, src: 'mark' }, geometry: f.geometry });
    for (const [lon, lat, kind] of (osm && osm.points) || []) hazards.push({ type: 'Feature', properties: { kind, src: 'osm' }, geometry: { type: 'Point', coordinates: [lon, lat] } });
    for (const a of (osm && osm.areas) || []) {
      const c = a.coords;
      const closed = c.length > 3 && c[0][0] === c[c.length - 1][0] && c[0][1] === c[c.length - 1][1];
      hazards.push({ type: 'Feature', properties: { kind: a.kind, src: 'osm' }, geometry: closed ? { type: 'Polygon', coordinates: [c] } : { type: 'LineString', coordinates: c } });
    }
    for (const t of mml || []) {
      for (const [lon, lat, kind] of t.points) hazards.push({ type: 'Feature', properties: { kind, src: 'mml' }, geometry: { type: 'Point', coordinates: [lon, lat] } });
      for (const a of t.areas) hazards.push({ type: 'Feature', properties: { kind: a.kind, src: 'mml' }, geometry: { type: 'Polygon', coordinates: a.rings } });
    }
  }
  return { fairways, hazards: fc(hazards), mml, depths, wind, missing, skipped };
}

// Waves a craft is comfortable in (significant height, m), from the wind over open water
export const COMFORT_WAVE = { kayak: 0.35, canoe: 0.25, sup: 0.2, swim: 0.15 };

/**
 * Significant wave height (m) from wind (m/s) blowing over `fetch` metres of open
 * water: the fetch-limited JONSWAP relation, Hs = 0.0016 · U · √(F/g). It is a
 * guide to how rough it gets, not a forecast.
 */
export const waveHeight = (wind, fetch) => 0.0016 * wind * Math.sqrt(Math.max(0, fetch) / 9.81);
// the wind that makes them (m/s): the mean wind and a quarter of its gusts over it
export const waveWind = ({ speed, gust }) => speed + 0.25 * Math.max(0, (gust || speed) - speed);
