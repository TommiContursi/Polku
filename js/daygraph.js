// The day's graph in the weather card (#869's step 3), yr's way: an hour a column, the sky every other hour, the
// temperature a line, rain as bars with their mm, and the wind and its gusts in a band of their own; the dark shaded and
// the trip in green between two marks. An SVG in the card's colours (css/app.css, --wx-*), so it follows the theme.
import { icon } from './ui.js';

// `hours`: [{ t, x, night, on, sky }] from the planner's wxHours(), x null past the forecast; `trip`: { t0, t1 }
export function dayGraph(hours, trip, label) {
  const n = hours.length, W = 340, cw = W / n, H = 132, T0 = 24, T1 = 68, W0 = 84, W1 = 112;
  const known = hours.filter((x) => x.x), ts = known.map((x) => x.x.temp), lo = Math.min(...ts) - 1, hi = Math.max(...ts) + 1;
  const wMax = Math.max(1, ...known.map((x) => x.x.gust));
  const ty = (t) => T0 + (1 - (t - lo) / (hi - lo)) * (T1 - T0), wy = (v) => W1 - (v / wMax) * (W1 - W0), cx = (k) => k * cw + cw / 2;
  const hh = (t) => String(new Date(t * 1000).getHours()).padStart(2, '0');
  // a line through the known hours, broken where the forecast ends
  const line = (y) => hours.map((h, k) => (h.x ? `${k && hours[k - 1].x ? 'L' : 'M'}${cx(k).toFixed(1)},${y(h.x).toFixed(1)}` : '')).join('');
  let s = `<svg class="wx-graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">`;
  hours.forEach((h, k) => { if (h.night) s += `<rect x="${k * cw}" y="0" width="${cw}" height="${W1}" fill="var(--wx-dark)"/>`; });
  const at = (t) => Math.max(0, Math.min(W, ((t - hours[0].t) / 3600) * cw)), x0 = at(trip.t0), x1 = Math.max(x0 + 3, at(trip.t1));
  s += `<rect x="${x0}" y="0" width="${x1 - x0}" height="${W1}" fill="var(--accent)" opacity=".16"/><rect x="${x0}" y="0" width="2" height="${W1}" fill="var(--accent)"/><rect x="${x1 - 2}" y="0" width="2" height="${W1}" fill="var(--accent)"/>`;
  s += `<line x1="0" x2="${W}" y1="${W0 - 6}" y2="${W0 - 6}" stroke="var(--line)"/>`;
  hours.forEach((h, k) => {
    if (!h.x || h.x.precip < 0.1) return;
    const bh = Math.min(T1 - T0, 4 + h.x.precip * 16);
    s += `<rect x="${k * cw + 4}" y="${T1 - bh}" width="${cw - 8}" height="${bh}" rx="2" fill="var(--wx-rain)" opacity=".85"/><text x="${cx(k)}" y="${T1 - bh - 3}" text-anchor="middle" class="wx-rain">${h.x.precip.toFixed(1)}</text>`;
  });
  s += `<path d="${line((x) => ty(x.temp))}" fill="none" stroke="var(--wx-warm)" stroke-width="2"/>`;
  hours.forEach((h, k) => { if (h.x && k % 3 === 1) s += `<text x="${cx(k)}" y="${ty(h.x.temp) - 5}" text-anchor="middle" class="${h.x.temp < 0 ? 'wx-cold' : 'wx-warm'}">${Math.round(h.x.temp) < 0 ? '−' : ''}${Math.abs(Math.round(h.x.temp))}°</text>`; });
  s += `<path d="${line((x) => wy(x.gust))}" fill="none" stroke="var(--wx-wind)" stroke-width="1.4" stroke-dasharray="3 3"/>`;
  s += `<path d="${line((x) => wy(x.speed))}" fill="none" stroke="var(--wx-wind)" stroke-width="2"/>`;
  hours.forEach((h, k) => { if (h.x && k % 2 === 0) s += `<g transform="translate(${cx(k) - 8},2)" class="wx-sky ${h.sky}">${icon(h.sky, 16).replace('<svg', '<svg x="0" y="0"')}</g>`; });
  hours.forEach((h, k) => { if (k % 3 === 0) s += `<text x="${cx(k)}" y="${H - 6}" text-anchor="middle">${hh(h.t)}</text>`; });
  s += `<text x="2" y="${W0 - 9}" class="wx-wind">${Math.round(wMax)} m/s</text></svg>`; // (at the left: rain's bars end at the right)
  return s;
}
