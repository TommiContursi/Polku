// One pick (#574): what a tap or a hold picks, from the spot to everything known about it. A pick fills in as the data
// comes, and each step says so (`changed()`), so the card shows what the map's own tile knows at once and never sits
// empty: the ways of its tile from Overpass (js/ways.js) joined into one thing, then its heights (js/analysis.js), then
// the weather (js/weather.js) and the places at the spot. The map draws it like a route, coloured by Colour by.

import { analyse } from './analysis.js';
import { windAlong, pointForecasts, sampleAt } from './weather.js';
import { loadWays, nearestWay, joinWay, lineOf, wayTile, walk, waysLoaded } from './ways.js';
import { wayTitle, wayLine } from './facts.js';
import { breakdownRows, colorAt, PICK_GROUPS } from './chart.js';
import { lipasNear } from './lipas.js';
import { elevation } from './dem.js';
import { LIPAS_TYPES } from './config.js';
import { store } from './ui.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
const PLAIN = '#374151'; // the pick before its heights are in
const metresPerPixel = (ll, zoom) => (40075016.686 * Math.cos((ll[1] * Math.PI) / 180)) / (512 * 2 ** zoom);

/**
 * A new pick at `spot` (the planner's: where, the map's own words for it). `hold`: opened by a hold or a right-click, so
 * it has the actions; `sec`: the hour the map's weather shows; `zoom`, `touch`: how far a finger or a pointer reaches.
 * ways, a, wx, places: undefined while asked, 'failed', 'none' (no way there), or the answer.
 */
export const newPick = (spot, { hold = false, sport, sec, zoom, touch = false } = {}) => ({
  spot, ll: spot.ll, hold, sport, sec, zoom, touch, at: Date.now(), ways: undefined, a: undefined, wx: undefined, places: undefined, ele: undefined, dead: false,
});

/** Asks for the pick's ways and what follows; `changed()` after each answer. A closed pick (`dead`) stops. */
export async function resolvePick(pick, changed) {
  const step = (fn) => { if (!pick.dead) { fn(); changed(); } };
  // the weather here and the places at the spot don't wait for the ways
  pointForecasts([pick.ll]).then(([s]) => sampleAt(s, pick.sec), () => 'failed').then((w) => step(() => { pick.wx = w; }));
  nearPlaces(pick.ll).then((p) => step(() => { pick.places = p; }), () => step(() => { pick.places = 'failed'; }));
  try { await loadWays(wayTile(pick.ll), { force: true }); } catch { step(() => { pick.ways = 'failed'; }); return; }
  const seed = nearestWay(pick.ll, (pick.touch ? 18 : 9) * metresPerPixel(pick.ll, pick.zoom));
  if (!seed) { step(() => { pick.ways = 'none'; }); elevation(pick.ll).then((e) => step(() => { pick.ele = Number.isFinite(e) ? e : null; }), () => step(() => { pick.ele = null; })); return; }
  // (drawn and measured from the tiles in, and grown as the tiles its ends run into come: `growing` till then)
  const put = (j, growing) => {
    pick.ways = { seed, ...j, geo: lineOf(j.chain), len: j.chain.reduce((s, { w }) => s + w.len, 0), growing };
    pick.title = wayTitle(j.chain);
    pick.line = wayLine(j.chain);
  };
  const j = await joinWay(seed, (part) => step(() => put({ ...part, side: [] }, true)));
  if (pick.dead) return;
  step(() => put(j, false));
  try {
    pick.a = await analyse(pick.ways.geo, { activity: pick.sport });
  } catch { pick.a = 'failed'; }
  step(() => {});
  if (pick.a !== 'failed') await loadWeather(pick, changed);
}

// the weather along it, all at the map's hour (nothing is "when you get there": it isn't going anywhere)
export async function loadWeather(pick, changed) {
  const a = pick.a;
  if (!a || a === 'failed') return;
  try {
    const w = await windAlong(a.pts, a.along, new Float32Array(a.pts.length), pick.sec);
    if (pick.dead || pick.a !== a) return;
    a.wind = { ...w, startSec: pick.sec };
  } catch { a.windError = true; }
  changed();
}

/**
 * The way under a desktop's pointer, said as its pick would say it (#574: hover and card say the same): { title, line,
 * coords }, or null where there's none, or while its tile loads (once, as a tap's would; `loaded()` after it has).
 */
export function wayUnder(ll, zoom, loaded) {
  if (!waysLoaded(ll)) { loadWays(wayTile(ll)).then(loaded, () => {}); return null; }
  const w = nearestWay(ll, 9 * metresPerPixel(ll, zoom));
  if (!w) return null;
  const { chain } = walk(w);
  return { title: wayTitle(chain), line: wayLine(chain), coords: lineOf(chain).coords };
}

// LIPAS's places within about 100 m, as the rows at the spot (places only; the routes have their own cards)
const nearPlaces = (ll) => lipasNear(ll, 0.12, Object.keys(LIPAS_TYPES).map(Number).filter((t) => t < 4000)).then((list) => list.slice(0, 8));

// ------------------------------------------------------------------ Colour by
/** The groups of Colour by with the modes this pick has data for: [[title, [mode…]]]. */
export const modesOf = (a) => (a && a !== 'failed' ? PICK_GROUPS.map(([title, modes]) => [title, modes.filter((m) => breakdownRows(a, m).length)]).filter(([, modes]) => modes.length) : []);
/** The mode drawn: the last choice (remembered), else Gradient, as far as this pick has it. */
export function modeOf(a) {
  const all = modesOf(a).flatMap(([, modes]) => modes), want = store.get('pickColour', 'grade');
  return all.includes(want) ? want : all.includes('grade') ? 'grade' : all[0];
}
export const setMode = (mode) => store.set('pickColour', mode);

// ------------------------------------------------------------------ what the map draws
/** The pick's lines for the map: its colours along it, the other carriageway, and an area's outline. */
export function pickData(pick) {
  const w = pick.ways, a = pick.a;
  if (!w || typeof w === 'string') return { pick: EMPTY, side: EMPTY, area: EMPTY };
  const line = (color, coords) => ({ type: 'Feature', properties: { color }, geometry: { type: 'LineString', coordinates: coords } });
  const feats = [];
  if (!a || a === 'failed') feats.push(line(PLAIN, w.geo.coords));
  else {
    const mode = modeOf(a);
    let cur = null;
    for (let i = 1; i < a.pts.length; i++) {
      const c = colorAt(a, i, mode);
      if (!cur || cur.properties.color !== c) { cur = line(c, [a.pts[i - 1]]); feats.push(cur); }
      cur.geometry.coordinates.push(a.pts[i]);
    }
  }
  return { pick: { type: 'FeatureCollection', features: feats }, side: { type: 'FeatureCollection', features: w.side.map((p) => line('#6b7280', p.coords)) }, area: EMPTY };
}
