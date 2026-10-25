// Stops on a route: a break at a waypoint ("Lunch, 1 h") or a night ("go on at
// 08:00"), the days a trip with nights falls into, places to sleep near a
// point (LIPAS and OpenStreetMap), and the gear check: a bike or a boat left at
// a changeover that the route doesn't come back to.
//
// A stop is { min } for a break or { on } for a night, `on` being the minutes
// after local midnight when you go on again, and `n` the nights when you stay
// more than one (#364). Nights depend on the clock, so the planner times them as
// it goes along the route (planner.timed).

import { LIPAS_TYPES } from './config.js';
import { dist } from './geo.js';
import { lipasNear } from './lipas.js';
import { cachedOverpass } from './osm.js';

export const isNight = (s) => !!s && s.on != null;
export const DEFAULT_BREAK = 30;
export const DEFAULT_ON = 8 * 60; // 08:00

export const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const parseHhmm = (s) => { const m = /^(\d{1,2}):?(\d{2})$/.exec(String(s || '').trim()); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };

export const MAX_NIGHTS = 30;
/** A stop made safe: a break of 1–1440 min, or a night with a clock time and 2–30 nights or one; anything else is no stop. */
export function cleanStop(s) {
  if (!s || typeof s !== 'object') return null;
  if (s.on != null) {
    const on = Math.round(+s.on), n = Math.round(+s.n);
    if (!(Number.isFinite(on) && on >= 0 && on < 1440)) return null;
    return n > 1 && n <= MAX_NIGHTS ? { on, n } : { on };
  }
  const min = Math.round(+s.min);
  return Number.isFinite(min) && min > 0 ? { min: Math.min(1440, min) } : null;
}

/**
 * How long you stay (seconds) after arriving at epoch second `arrive`, the
 * changeover there (`changeSec`) not counted: a break's minutes, or for a night
 * the time until you go on, at the next `on` o'clock once the changeover is done
 * (and the mornings after it, for a stay of several nights).
 */
export function restSec(stop, arrive, changeSec = 0) {
  if (!stop) return 0;
  if (!isNight(stop)) return Math.max(0, stop.min || 0) * 60;
  const ready = new Date((arrive + changeSec) * 1000);
  const go = new Date(ready);
  go.setHours(Math.floor(stop.on / 60), stop.on % 60, 0, 0);
  if (go <= ready) go.setDate(go.getDate() + 1); // the next morning (local time, so summer time is right)
  go.setDate(go.getDate() + (stop.n || 1) - 1);
  return go.getTime() / 1000 - arrive - changeSec;
}

// "Night", or "3 nights" for a stay of several
export const nightsWord = (s) => (s.n > 1 ? `${s.n} nights` : 'Night');

export function stopLabel(s) {
  if (!s) return '';
  if (isNight(s)) return `${nightsWord(s)} · on at ${hhmm(s.on)}`;
  return `Break · ${s.min < 60 ? `${s.min} min` : `${Math.floor(s.min / 60)} h${s.min % 60 ? ` ${String(s.min % 60).padStart(2, '0')}` : ''}`}`;
}

// ---------------------------------------------------------------- share links
// st=3:60,5:n0800,7:n0700x2 → a 60 min break at point 3, a night at point 5 (on at 08:00), two nights at point 7
export function encodeStops(list) {
  return list.map((s, i) => (s ? `${i}:${isNight(s) ? `n${hhmm(s.on).replace(':', '')}${s.n > 1 ? `x${s.n}` : ''}` : s.min}` : '')).filter(Boolean).join(',');
}
export function decodeStops(str) {
  const out = [];
  for (const part of String(str || '').split(',')) {
    const m = /^(\d+):(?:n(\d{4})(?:x(\d+))?|(\d+))$/.exec(part);
    if (!m) continue;
    const s = cleanStop(m[2] ? { on: parseHhmm(m[2]), n: m[3] } : { min: +m[4] });
    if (s) out.push([+m[1], s]);
  }
  return out;
}

// ---------------------------------------------------------------- days
/**
 * The days of a trip with nights: [{ n, from, to, i0, i1, t0, t1, moving, rest, up }], n the day's number (a stay
 * of several nights counts each)
 * (metres along, sample indexes, epoch seconds from leaving to arriving, moving
 * seconds, breaks and changeovers in seconds, climbing in metres). `waits` are the
 * planner's timed waits (`arrive`, `sec`, `stop`); `tAt` seconds from `start`.
 */
export function tripDays(a, tAt, start, waits) {
  const nights = (waits || []).filter((w) => isNight(w.stop));
  if (!nights.length) return [];
  const n = a.along.length;
  const idx = (m) => { let i = 0; while (i < n - 1 && a.along[i] < m - 1) i++; return i; };
  const days = [];
  let day = 1;
  for (let k = 0; k <= nights.length; k++) {
    const from = k ? nights[k - 1].at : 0, to = k < nights.length ? nights[k].at : a.along[n - 1];
    const i0 = idx(from), i1 = k < nights.length ? idx(to) : n - 1;
    const t0 = k ? nights[k - 1].arrive + nights[k - 1].sec : start;
    const t1 = k < nights.length ? nights[k].arrive : start + tAt[n - 1];
    // breaks and changeovers that day (a night's own changeover is inside the night)
    const rest = (waits || []).filter((w) => !isNight(w.stop) && w.at > from + 1 && w.at < to - 1).reduce((t, w) => t + w.sec, 0);
    let up = 0;
    for (let i = i0 + 1; i <= i1; i++) { const d = a.ele[i] - a.ele[i - 1]; if (d > 0) up += d; }
    days.push({ n: day, from, to, i0, i1, t0, t1, moving: Math.max(0, t1 - t0 - rest), rest, up });
    if (k < nights.length) day += nights[k].stop.n || 1;
  }
  return days;
}

/**
 * The weather of one day from the route's wind samples, as far as the forecast reaches (null without them; `none`
 * when the whole day is past it: its values there are the forecast's last hour's, #465).
 */
export function dayWeather(w, a, i0, i1) {
  if (!w) return null;
  let tMin = Infinity, tMax = -Infinity, wind = 0, gust = 0, wetM = 0, peak = 0;
  const end = w.beyond >= 0 ? Math.min(i1, w.beyond - 1) : i1;
  for (let i = Math.max(1, i0); i <= end; i++) {
    tMin = Math.min(tMin, w.temp[i]); tMax = Math.max(tMax, w.temp[i]);
    wind = Math.max(wind, w.speed[i]); gust = Math.max(gust, w.gust[i]);
    if (w.precip[i] >= 0.1) { wetM += a.along[i] - a.along[i - 1]; peak = Math.max(peak, w.precip[i]); }
  }
  if (!Number.isFinite(tMin)) return w.beyond >= 0 && w.beyond <= i1 ? { none: true, beyond: true } : null;
  return { tMin, tMax, wind, gust, wetM, peak, beyond: w.beyond >= 0 && w.beyond <= i1, unsure: w.unsure >= 0 && w.unsure <= i1 };
}

// ---------------------------------------------------------------- the gear check
// Gear you ride or paddle stays where you change out of that sport, unless
// you take it along (a packraft, a folding bike). On foot and swimming there's
// nothing to leave.
export const GEAR = { mtb: 'bike', gravel: 'bike', road: 'bike', paddle: 'boat' };
const BACK = 300; // m: close enough to the gear to pick it up again

/**
 * Heads-up for gear left behind: [{ i, at, gear, text, note }].
 * sports[k]: leg k's sport; carry(i): taken along from point i; along(i): metres;
 * name(i): the point's name; label(gear): "Your bike", "Your sea kayak".
 */
export function gearChecks({ sports, points, carry, along, name, label }) {
  const out = [];
  const left = new Map(); // gear → the point it was left at
  for (let i = 1; i < sports.length; i++) {
    const from = sports[i - 1], to = sports[i];
    const g0 = GEAR[from], g1 = GEAR[to];
    if (from === to || g0 === g1) continue; // MTB → gravel: the same bike
    if (g0 && !carry(i)) left.set(g0, i);
    if (g1 && left.has(g1)) {
      const j = left.get(g1);
      left.delete(g1);
      if (dist(points[j], points[i]) > BACK) {
        out.push({ i, at: along(i), gear: g1, text: `${label(g1)} is still at ${name(j)}`, note: `left there at km ${(along(j) / 1000).toFixed(1)}, ${fmtKm(dist(points[j], points[i]))} from where the route goes on with it · taken along? Switch it on in ${name(j)}’s menu` });
      }
    }
  }
  const end = points[points.length - 1];
  for (const [g, j] of left) {
    if (dist(points[j], end) <= BACK) continue; // you finish where it is
    out.push({ i: j, at: along(j), gear: g, text: `${label(g)} stays at ${name(j)}`, note: `the route doesn’t come back for it · taken along? Switch it on in ${name(j)}’s menu` });
  }
  return out;
}
const fmtKm = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

// ---------------------------------------------------------------- places to sleep
const STAY_TYPES = [301, 302, 304, 202]; // lean-to / kota, wilderness hut, outdoor lodge, camping site
const OSM_STAY = {
  camp_site: 'Campsite', wilderness_hut: 'Wilderness hut', alpine_hut: 'Hut', lean_to: 'Lean-to', basic_hut: 'Hut', shelter: 'Shelter',
};

/**
 * Places to spend the night within `km` of [lon, lat]: LIPAS lean-tos, huts and
 * campsites, and OpenStreetMap's campsites, huts and lean-tos (not mapped in
 * LIPAS everywhere). Nearest first, one entry where both have the same place.
 * `onUpdate(list)` gets what's in so far as each source answers (LIPAS is
 * usually quicker than Overpass). Either source may fail; with both down this throws.
 */
export async function staysNear(ll, km = 3, onUpdate = null) {
  const lip = [], osm = [];
  let failed = 0, last = null;
  const merged = () => {
    const out = lip.filter((p) => p.at).map((p) => ({ src: 'LIPAS', name: p.name, kind: (LIPAS_TYPES[p.type] || {}).name || 'Place', icon: `lipas-${(LIPAS_TYPES[p.type] || {}).icon || 'laavu'}`, at: p.at, d: dist(ll, p.at) }));
    for (const p of osm) if (!out.some((q) => q.src === 'LIPAS' && dist(q.at, p.at) < 80)) out.push({ ...p, d: dist(ll, p.at) }); // the same place once
    return out.filter((p) => p.d <= km * 1000).sort((x, y) => x.d - y.d).slice(0, 8);
  };
  const take = (into) => (v) => { into.push(...v); if (onUpdate) onUpdate(merged()); };
  const miss = (e) => { failed++; last = e; };
  await Promise.all([
    lipasNear(ll, km, STAY_TYPES).then(take(lip), miss),
    osmStays(ll, km).then(take(osm), miss),
  ]);
  if (failed === 2) throw last;
  return merged();
}

async function osmStays([lon, lat], km) {
  const r = Math.round(km * 1000);
  const q = `[out:json][timeout:20];(nwr(around:${r},${lat},${lon})[tourism~"^(camp_site|wilderness_hut|alpine_hut)$"];nwr(around:${r},${lat},${lon})[amenity=shelter][shelter_type~"^(lean_to|basic_hut)$"];);out center tags 40;`;
  const key = `stays/${lon.toFixed(3)}/${lat.toFixed(3)}/${r}`;
  const json = await cachedOverpass(key, q, (j) => ({ elements: (j.elements || []).map((e) => ({ lat: e.lat ?? (e.center && e.center.lat), lon: e.lon ?? (e.center && e.center.lon), tags: e.tags || {} })) }), { race: true });
  return (json.elements || []).filter((e) => Number.isFinite(e.lat)).map((e) => {
    const t = e.tags, kind = OSM_STAY[t.tourism] || OSM_STAY[t.shelter_type] || 'Shelter';
    return { src: 'OpenStreetMap', name: t.name || kind, kind, icon: `lipas-${t.tourism === 'camp_site' ? 'tent' : kind === 'Lean-to' ? 'laavu' : 'hut'}`, at: [+e.lon.toFixed(6), +e.lat.toFixed(6)] };
  });
}
