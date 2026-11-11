// The day's graph in the weather card (#869's step 3), yr's way in the weather timeline's colours: an hour a column, the
// sky every other hour, the temperature a line, rain as bars, the wind and its gusts in a band of their own, the dark
// shaded and your trip in the route's colour between two marks, as the timeline marks your ride. Labelled where nothing
// can collide: the warmest and coldest hour over the line, the strongest wind over its band (the rain's peak is in the
// key, under it). An SVG on the chart's tokens and the card's (css/app.css), so it follows the theme.
import { icon } from './ui.js';

// `hours`: [{ t, x, night, on, sky }] from the planner's dayHours(), x null past the forecast; `trip`: { t0, t1 }
export function dayGraph(hours, trip, label) {
  const n = hours.length, W = 300, cw = W / n, H = 136, T0 = 34, T1 = 60, R0 = 64, R1 = 84, W0 = 100, W1 = 118;
  const known = hours.map((h, k) => ({ ...h, k })).filter((h) => h.x), ts = known.map((h) => h.x.temp);
  let lo = Math.min(...ts), hi = Math.max(...ts);
  if (hi - lo < 4) { const m = (hi + lo) / 2; lo = m - 2; hi = m + 2; } // (a flat day stays a flat line, not a zigzag)
  const wMax = Math.max(1, ...known.map((h) => h.x.gust)), rMax = Math.max(1, ...known.map((h) => h.x.precip));
  const cx = (k) => k * cw + cw / 2, ty = (t) => T0 + (1 - (t - lo) / (hi - lo)) * (T1 - T0), wy = (v) => W1 - (v / wMax) * (W1 - W0);
  const clampX = (x) => Math.max(12, Math.min(W - 12, x));
  const deg = (t) => `${Math.round(t) < 0 ? '−' : ''}${Math.abs(Math.round(t))}°`;
  const hh = (t) => String(new Date(t * 1000).getHours()).padStart(2, '0');
  // a line through the known hours, broken where the forecast ends
  const line = (y) => hours.map((h, k) => (h.x ? `${k && hours[k - 1].x ? 'L' : 'M'}${cx(k).toFixed(1)},${y(h.x).toFixed(1)}` : '')).join('');
  let s = `<svg class="wx-graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">`;
  hours.forEach((h, k) => { if (h.night) s += `<rect class="night" x="${k * cw}" y="0" width="${cw}" height="${W1 + 6}"/>`; });
  // your trip: at least 6 wide, so a short ride shows, between two marks and over a bar at the foot
  const at = (t) => Math.max(0, Math.min(W, ((t - hours[0].t) / 3600) * cw));
  let x0 = at(trip.t0), x1 = at(trip.t1);
  if (x1 - x0 < 6) { const m = (x0 + x1) / 2; x0 = Math.max(0, m - 3); x1 = Math.min(W, m + 3); }
  s += `<rect class="trip" x="${x0}" y="0" width="${x1 - x0}" height="${W1 + 6}"/><rect class="trip-mark" x="${x0}" y="0" width="2" height="${W1 + 6}"/><rect class="trip-mark" x="${x1 - 2}" y="0" width="2" height="${W1 + 6}"/>`;
  s += `<line class="grid" x1="0" x2="${W}" y1="${R1 + 0.5}" y2="${R1 + 0.5}"/><line class="grid" x1="0" x2="${W}" y1="${W1 + 0.5}" y2="${W1 + 0.5}"/>`;
  // rain: bars up from the rain's foot
  known.forEach((h) => { if (h.x.precip >= 0.1) { const bh = 3 + (h.x.precip / rMax) * (R1 - R0 - 3); s += `<rect class="rain" x="${h.k * cw + 3}" y="${R1 - bh}" width="${cw - 6}" height="${bh}" rx="1.5"/>`; } });
  // the temperature, its warmest and coldest hours labelled over the line
  s += `<path class="temp" d="${line((x) => ty(x.temp))}"/>`;
  const warm = known.reduce((b, h) => (h.x.temp > b.x.temp ? h : b), known[0]), cold = known.reduce((b, h) => (h.x.temp < b.x.temp ? h : b), known[0]);
  s += `<text x="${clampX(cx(warm.k))}" y="${ty(warm.x.temp) - 6}" text-anchor="middle">${deg(warm.x.temp)}</text>`;
  if (Math.round(cold.x.temp) !== Math.round(warm.x.temp) && Math.abs(cold.k - warm.k) > 1) s += `<text x="${clampX(cx(cold.k))}" y="${ty(cold.x.temp) - 6}" text-anchor="middle">${deg(cold.x.temp)}</text>`;
  // the wind and its gusts, the strongest labelled over the band
  s += `<path class="gust" d="${line((x) => wy(x.gust))}"/><path class="wind" d="${line((x) => wy(x.speed))}"/>`;
  const strong = known.reduce((b, h) => (h.x.speed > b.x.speed ? h : b), known[0]);
  s += `<text x="${clampX(cx(strong.k))}" y="${W0 - 4}" text-anchor="middle">${Math.round(strong.x.speed)} m/s</text>`;
  // the sky every other hour, the hours every third
  hours.forEach((h, k) => { if (h.x && k % 2 === 0) s += `<g transform="translate(${cx(k) - 8},4)" class="wx-sky ${h.sky}">${icon(h.sky, 16).replace('<svg', '<svg x="0" y="0"')}</g>`; });
  hours.forEach((h, k) => { if (k % 3 === 0) s += `<text x="${clampX(cx(k))}" y="${H - 3}" text-anchor="middle">${hh(h.t)}</text>`; });
  return `${s}</svg>`;
}
