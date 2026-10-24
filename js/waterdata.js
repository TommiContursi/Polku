// What the paddling router keeps out of, or clear of, beyond land (js/water.js):
//
// - fairways: Väylävirasto's fairway areas (CC BY 4.0), shipping lanes apart
//   from small-boat routes and harbour basins (nautical.js waterwaysIn);
// - marked dangers: Väylävirasto's isolated-danger and cardinal marks, and the
//   rocks, reefs, shoals and wrecks mapped in OpenStreetMap (ODbL, Overpass);
// - the wind at the leg, from the forecast Polku already uses (Open-Meteo).
//
// Depths are not used. Traficom's depth data is licensed for "other than
// navigational purposes", and its licence counts route planning as
// navigation; SYKE's lake depths (CC BY 4.0) cover small lakes only and start
// at a 0–1.5 m class, too coarse for a kayak. See ROADMAP, phase 13.
//
// Each source is optional: if one doesn't answer, the leg is routed without
// it and Heads-up says so.

import { waterwaysIn } from './nautical.js';
import { cachedOverpass } from './osm.js';
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
const lateArrived = () => { lateCount++; for (const fn of late) fn(); };

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
  const p = cachedOverpass(`waterhaz/${HZ}/${id}`, q, (json) => {
    const points = [], areas = [];
    for (const el of json.elements || []) {
      const t = el.tags || {};
      const kind = t['seamark:type'] || t.natural || 'rock';
      if (el.type === 'node') points.push([+el.lon.toFixed(6), +el.lat.toFixed(6), kind]);
      else if (el.geometry && el.geometry.length > 1) areas.push({ kind, coords: el.geometry.map((g) => [+g.lon.toFixed(6), +g.lat.toFixed(6)]) });
    }
    return { points, areas };
  }, { race: true });
  p.catch(() => { failedHaz.add(id); setTimeout(() => { if (hazTiles.get(id) === p) hazTiles.delete(id); failedHaz.delete(id); }, 120e3); }); // ask again in a couple of minutes
  hazTiles.set(id, p);
  return p;
}
/** Retry: ask again now for what didn't answer, and wait for it as long as the first time. */
export function forgetWaterFailures() {
  for (const id of failedHaz) hazTiles.delete(id);
  failedHaz.clear();
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
  const tiles = hazTilesIn(box, 16); // a very long leg: skip rather than ask for half a province
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
 * zoomed in): OSM's hazards and Väylävirasto's fairways and marks.
 */
export function prefetchWater(view) {
  hazTilesIn(view, 6);
  waterwaysIn(view, 8).catch(() => {});
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
 * What to draw into the router's grid for a leg's box. `want`: { fairways, hazards,
 * wind } (booleans) and `at` (epoch seconds, for the wind). Returns GeoJSON for
 * the grid plus the wind, and `missing`: sources that didn't answer.
 */
// Tests answer from recorded files: fn(box, want, at) → what waterInputs returns, or null to ask the services.
let seeded = null;
export function seedWater(fn) { seeded = fn; }

export async function waterInputs(box, want, at) {
  const fx = seeded && seeded(box, want, at);
  if (fx) return fx;
  const [w, s, e, n] = box;
  const mid = [(w + e) / 2, (s + n) / 2];
  const missing = [];
  const [ways, osm, wind] = await Promise.all([
    want.fairways || want.hazards ? (() => { const p = waterwaysIn(box); return waitFor('vayla', p).catch(() => { missing.push('Väylävirasto'); p.then(lateArrived, () => {}); return null; }); })() : null,
    want.hazards ? osmHazards(box).catch(() => { missing.push('OpenStreetMap'); return null; }) : null,
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
  }
  return { fairways, hazards: fc(hazards), wind, missing };
}

// Waves a craft is comfortable in (significant height, m), from the wind over open water
export const COMFORT_WAVE = { kayak: 0.35, canoe: 0.25, sup: 0.2, swim: 0.15 };

/**
 * Significant wave height (m) from wind (m/s) blowing over `fetch` metres of open
 * water: the fetch-limited JONSWAP relation, Hs = 0.0016 · U · √(F/g). It is a
 * guide to how rough it gets, not a forecast.
 */
export const waveHeight = (wind, fetch) => 0.0016 * wind * Math.sqrt(Math.max(0, fetch) / 9.81);
