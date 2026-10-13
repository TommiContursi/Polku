// Weather from Open-Meteo (no key): hourly wind, gusts, temperature and
// precipitation for many points per request. Used along planned routes and for
// the wind/temperature/rain map overlay.

import { OPEN_METEO } from './config.js';
import { bearing } from './geo.js';
import { idb } from './idb.js';

const rad = (d) => (d * Math.PI) / 180;

// ------------------------------------------------------------------ forecast cells
// Forecasts are fetched and cached per cell of a fixed lattice, so small map or
// route changes reuse what's already here instead of asking again. Level 0
// cells are 0.05° × 0.025° (≈ 2.8 × 2.8 km at 60° N, about the forecast
// model's own resolution); each level up doubles both sides. A cell stays
// fresh for an hour (the models update hourly), in memory and in IndexedDB so
// it survives reloads; copies up to a day old stand in when Open-Meteo can't
// be reached. Open-Meteo counts every location as a call, so this is what
// keeps Polku under its limits.
const LON0 = 0.05;
const LAT0 = 0.025;
const FRESH = 3600e3;
const KEEP = 24 * 3600e3;
const BATCH = 100; // locations per request
const cells = new Map(); // "L/i/j" -> { at, s }
const store = idb('weather');
store.prune((v) => v && Date.now() - v.at < KEEP).catch(() => {});

export const cellSize = (L) => [LON0 * 2 ** L, LAT0 * 2 ** L];
export function cellAt([lon, lat], L = 0) {
  const [dx, dy] = cellSize(L);
  return { L, i: Math.floor(lon / dx), j: Math.floor(lat / dy) };
}
export function cellCenter({ L, i, j }) {
  const [dx, dy] = cellSize(L);
  return [+((i + 0.5) * dx).toFixed(4), +((j + 0.5) * dy).toFixed(4)];
}
const keyOf = (c) => `${c.L}/${c.i}/${c.j}`;

/**
 * Hourly forecasts (−1 h … +49 h) for a list of cells, in the same order.
 * Only cells without a fresh copy are fetched. The result has `.stale = true`
 * when an older copy had to stand in for a failed request.
 */
export async function forecastCells(list) {
  const now = Date.now();
  const keys = list.map(keyOf);
  const out = new Array(list.length);
  const fallback = new Map(); // key -> older copy
  let need = [];
  keys.forEach((k, n) => {
    const c = cells.get(k);
    if (c && now - c.at < FRESH) out[n] = c.s;
    else { need.push(n); if (c) fallback.set(k, c); }
  });
  if (need.length) {
    const missing = [...new Set(need.map((n) => keys[n]))];
    const saved = await store.getMany(missing).catch(() => []);
    missing.forEach((k, m) => {
      const v = saved[m];
      if (!v || now - v.at >= KEEP) return;
      if (now - v.at < FRESH) cells.set(k, v);
      else if (!fallback.has(k) || fallback.get(k).at < v.at) fallback.set(k, v);
    });
    need = need.filter((n) => {
      const c = cells.get(keys[n]);
      if (c && now - c.at < FRESH) { out[n] = c.s; return false; }
      return true;
    });
  }
  let error = null;
  const fetchKeys = [...new Set(need.map((n) => keys[n]))];
  for (let b = 0; b < fetchKeys.length && !error; b += BATCH) {
    const batch = fetchKeys.slice(b, b + BATCH);
    try {
      const series = await fetchPoints(batch.map((k) => { const [L, i, j] = k.split('/').map(Number); return cellCenter({ L, i, j }); }));
      const at = Date.now();
      batch.forEach((k, m) => {
        const v = { at, s: series[m] };
        cells.set(k, v);
        store.set(k, v).catch(() => {});
      });
    } catch (err) { error = err; }
  }
  for (const n of need) {
    const c = cells.get(keys[n]);
    if (c && Date.now() - c.at < FRESH) out[n] = c.s;
    else if (fallback.has(keys[n])) { out[n] = fallback.get(keys[n]).s; out.stale = true; }
  }
  for (let n = 0; n < list.length; n++) if (!out[n]) throw error || new Error('Weather unavailable'); // (some() skips holes)
  if (cells.size > 4000) for (const k of [...cells.keys()].slice(0, 1000)) cells.delete(k);
  return out;
}

/** One forecast per point, via its level-0 cell (points in the same cell share it). */
export async function pointForecasts(points) {
  const list = points.map((p) => cellAt(p, 0));
  return forecastCells(list);
}

/** A series re-indexed to `n` hours from epoch second `t0` (cells fetched at different times line up). */
export function alignSeries(s, t0, n) {
  const off = Math.round((t0 - s.time[0]) / 3600);
  const pick = (a) => Array.from({ length: n }, (_, k) => a[Math.max(0, Math.min(a.length - 1, off + k))]);
  return {
    lat: s.lat, lon: s.lon,
    time: Array.from({ length: n }, (_, k) => t0 + k * 3600),
    speed: pick(s.speed), dir: pick(s.dir), gust: pick(s.gust), temp: pick(s.temp), precip: pick(s.precip),
    cloud: s.cloud ? pick(s.cloud) : null, // cells cached before cloud cover was asked for
  };
}

/**
 * Hourly forecast for many points in one request (no caching: see forecastCells).
 * @returns {Promise<Array<{lat,lon,time:number[],speed,dir,gust,temp,precip}>>}  time in epoch seconds
 */
async function fetchPoints(points, hours = 49) {
  const lat = points.map((p) => p[1].toFixed(3)).join(',');
  const lon = points.map((p) => p[0].toFixed(3)).join(',');
  const url = `${OPEN_METEO}?latitude=${lat}&longitude=${lon}` +
    '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation,cloud_cover' +
    `&forecast_hours=${hours}&past_hours=1&wind_speed_unit=ms&timeformat=unixtime&timezone=UTC`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather unavailable');
  let j = await res.json();
  if (!Array.isArray(j)) j = [j];
  const v = j.map((r) => ({
    lat: r.latitude,
    lon: r.longitude,
    time: r.hourly.time,
    speed: r.hourly.wind_speed_10m,
    dir: r.hourly.wind_direction_10m,
    gust: r.hourly.wind_gusts_10m,
    temp: r.hourly.temperature_2m,
    precip: r.hourly.precipitation,
    cloud: r.hourly.cloud_cover,
  }));
  return v;
}

/** Values of one series at epoch second t (linear in time; direction via vectors). */
export function sampleAt(s, t) {
  const n = s.time.length;
  let i = 0;
  while (i < n - 2 && s.time[i + 1] <= t) i++;
  const span = s.time[i + 1] - s.time[i] || 3600;
  const f = Math.max(0, Math.min(1, (t - s.time[i]) / span));
  const lin = (a) => (a[i] ?? 0) * (1 - f) + (a[i + 1] ?? a[i] ?? 0) * f;
  // average the "from" direction as unit vectors so 350°→10° doesn't pass through 180°
  const x = Math.sin(rad(s.dir[i])) * (1 - f) + Math.sin(rad(s.dir[i + 1] ?? s.dir[i])) * f;
  const y = Math.cos(rad(s.dir[i])) * (1 - f) + Math.cos(rad(s.dir[i + 1] ?? s.dir[i])) * f;
  return {
    speed: lin(s.speed),
    gust: lin(s.gust),
    dir: ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360,
    temp: lin(s.temp),
    precip: lin(s.precip),
  };
}

/**
 * Wind along a route at the time each part is reached.
 * @param pts   sampled route points
 * @param along distance (m) per point
 * @param tAt   seconds from start per point
 * @param startSec departure (epoch seconds)
 */
export async function windAlong(pts, along, tAt, startSec) {
  const n = pts.length;
  const total = along[n - 1] || 1;
  // one forecast point per ~4 km, up to 12 (≈ every 10–20 km on long rides)
  const k = Math.max(2, Math.min(12, Math.ceil(total / 4000) + 1));
  const idx = Array.from({ length: k }, (_, j) => Math.round((j / (k - 1)) * (n - 1)));
  const series = await pointForecasts(idx.map((i) => pts[i]));
  const speed = new Float32Array(n), gust = new Float32Array(n), dir = new Float32Array(n);
  const head = new Float32Array(n), cross = new Float32Array(n);
  const temp = new Float32Array(n), precip = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = series[Math.min(k - 1, Math.round((along[i] / total) * (k - 1)))];
    const w = sampleAt(s, startSec + (tAt[i] || 0));
    // heading over ±2 samples keeps tiny zig-zags from flipping head/tail
    const a = pts[Math.max(0, i - 2)], b = pts[Math.min(n - 1, i + 2)];
    const hdg = bearing(a, b);
    const d = rad(hdg - w.dir);
    speed[i] = w.speed; gust[i] = w.gust; dir[i] = w.dir;
    temp[i] = w.temp; precip[i] = w.precip;
    head[i] = w.speed * Math.cos(d); // >0 wind against you
    cross[i] = w.speed * Math.sin(d);
  }
  const first = sampleAt(series[0], startSec);
  return {
    speed, gust, dir, head, cross, temp, precip,
    start: { ...first, time: startSec },
    hourly: series[Math.floor(k / 2)],
  };
}

// Temperature and precipitation bands for the route profile.
export const TEMP_BANDS = [
  { key: 'frost', min: -Infinity, label: 'below −5 °C', color: '#6d28d9' },
  { key: 'cold', min: -5, label: '−5…0 °C', color: '#3b82f6' },
  { key: 'cool', min: 0, label: '0…5 °C', color: '#7dd3fc' },
  { key: 'mild', min: 5, label: '5…10 °C', color: '#86efac' },
  { key: 'warm', min: 10, label: '10…15 °C', color: '#fde047' },
  { key: 'warmer', min: 15, label: '15…20 °C', color: '#fdba74' },
  { key: 'hot', min: 20, label: '20…25 °C', color: '#f97316' },
  { key: 'hotter', min: 25, label: 'over 25 °C', color: '#dc2626' },
];
export const tempBand = (t) => TEMP_BANDS.slice().reverse().find((b) => t >= b.min);

export const RAIN_BANDS = [
  { key: 'dry', label: 'Dry', color: '#a3acb9' },
  { key: 'drizzle', label: 'Drizzle < 0.5 mm/h', color: '#93c5fd' },
  { key: 'rain', label: 'Rain 0.5–2 mm/h', color: '#3b82f6' },
  { key: 'heavy', label: 'Heavy > 2 mm/h', color: '#1e3a8a' },
  { key: 'snow', label: 'Snow', color: '#a78bfa' },
];
const rainByKey = Object.fromEntries(RAIN_BANDS.map((b) => [b.key, b]));
export function rainBand(mm, t) {
  if (mm < 0.1) return rainByKey.dry;
  if (t < 0.5) return rainByKey.snow;
  if (mm < 0.5) return rainByKey.drizzle;
  if (mm < 2) return rainByKey.rain;
  return rainByKey.heavy;
}

export const WIND_CLASSES = [
  { key: 'strongHead', label: 'Strong headwind', color: '#b91c1c' },
  { key: 'head', label: 'Headwind', color: '#f87171' },
  { key: 'cross', label: 'Crosswind', color: '#f59e0b' },
  { key: 'tail', label: 'Tailwind', color: '#4ade80' },
  { key: 'strongTail', label: 'Strong tailwind', color: '#15803d' },
  { key: 'calm', label: 'Calm', color: '#a3acb9' },
];
const byKey = Object.fromEntries(WIND_CLASSES.map((c) => [c.key, c]));

export function windClass(head, speed) {
  if (speed < 1.5) return byKey.calm;
  if (head >= 4) return byKey.strongHead;
  if (head >= 1.5) return byKey.head;
  if (head <= -4) return byKey.strongTail;
  if (head <= -1.5) return byKey.tail;
  return byKey.cross;
}

// How the wind feels for the activity.
export function windRating(speed, gust, activity) {
  const g = Math.max(speed, gust * 0.7);
  if (activity === 'paddle') {
    if (g < 4) return { label: 'Calm water', tone: 'good' };
    if (g < 7) return { label: 'Moderate', tone: 'ok' };
    if (g < 10) return { label: 'Fresh — experienced paddlers', tone: 'warn' };
    return { label: 'Strong — stay near shore', tone: 'bad' };
  }
  if (g < 4) return { label: 'Light wind', tone: 'good' };
  if (g < 8) return { label: 'Breezy', tone: 'ok' };
  if (g < 12) return { label: 'Windy — open sections feel it', tone: 'warn' };
  return { label: 'Very windy — watch for fallen trees', tone: 'bad' };
}
