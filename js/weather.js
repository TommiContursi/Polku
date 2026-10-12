// Wind for paddlers (Open-Meteo, no key). Cached for 15 minutes per ~5 km cell.

import { OPEN_METEO } from './config.js';

const cache = new Map();

export async function wind(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < 15 * 60 * 1000) return hit.v;
  const url = `${OPEN_METEO}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    '&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m' +
    '&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&forecast_hours=12&wind_speed_unit=ms&timezone=auto';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather unavailable');
  const j = await res.json();
  const v = {
    speed: j.current.wind_speed_10m,
    gust: j.current.wind_gusts_10m,
    dir: j.current.wind_direction_10m,
    temp: j.current.temperature_2m,
    hourly: j.hourly.time.map((t, i) => ({
      time: t.slice(11, 16),
      speed: j.hourly.wind_speed_10m[i],
      gust: j.hourly.wind_gusts_10m[i],
      dir: j.hourly.wind_direction_10m[i],
    })),
  };
  cache.set(key, { t: Date.now(), v });
  return v;
}

// Rough comfort rating for open-water paddling
export function windRating(speed, gust) {
  const g = Math.max(speed, gust * 0.7);
  if (g < 4) return { label: 'Calm', tone: 'good' };
  if (g < 7) return { label: 'Moderate', tone: 'ok' };
  if (g < 10) return { label: 'Fresh — experienced paddlers', tone: 'warn' };
  return { label: 'Strong — stay near shore', tone: 'bad' };
}
