// Weather from Open-Meteo (no key): hourly wind, gusts, temperature and
// precipitation for many points per request. Used along planned routes and for
// the wind/temperature/rain map overlay.

import { OPEN_METEO } from './config.js';
import { bearing } from './geo.js';

const cache = new Map(); // url -> {t, v}
const TTL = 20 * 60 * 1000;
const rad = (d) => (d * Math.PI) / 180;

/**
 * Hourly forecast for many points in one request.
 * @returns {Promise<Array<{lat,lon,time:number[],speed,dir,gust,temp,precip}>>}  time in epoch seconds
 */
export async function forecastPoints(points, hours = 48) {
  const lat = points.map((p) => p[1].toFixed(3)).join(',');
  const lon = points.map((p) => p[0].toFixed(3)).join(',');
  const url = `${OPEN_METEO}?latitude=${lat}&longitude=${lon}` +
    '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation' +
    `&forecast_hours=${hours}&past_hours=1&wind_speed_unit=ms&timeformat=unixtime&timezone=UTC`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
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
  }));
  cache.set(url, { t: Date.now(), v });
  if (cache.size > 60) cache.delete(cache.keys().next().value);
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
  const series = await forecastPoints(idx.map((i) => pts[i]));
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
