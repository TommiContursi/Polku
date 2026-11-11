// The day's strip in the weather card (#869's step 3; the user's choice of 2026-11-11: the weather timeline's own look),
// drawn as the timeline draws its strip (js/wxmap.js, drawStrip): 66 px high, the night shaded, your trip in the route's
// colour with a bar at its foot, rain as bars from the foot (snow violet), the temperature an orange line with its warmest
// and coldest hour labelled, the wind's arrows along the top and the hours under it. An SVG: its shapes stretch to the
// card's width, its words and arrows keep their size (positioned in %), and it follows the theme (css/app.css .wx-strip).

// `hours`: [{ t, x, night, on }] from the planner's dayHours(), x null past the forecast; `trip`: { t0, t1 }
export function dayStrip(hours, trip, label) {
  const n = hours.length, H = 66, top = 14, bottom = H - 14, pct = (u) => `${((u / n) * 100).toFixed(2)}%`;
  const known = hours.map((h, k) => ({ ...h, k })).filter((h) => h.x);
  let lo = Math.min(...known.map((h) => h.x.temp)), hi = Math.max(...known.map((h) => h.x.temp));
  if (hi - lo < 4) { const m = (hi + lo) / 2; lo = m - 2; hi = m + 2; } // (as the timeline: a flat day stays flat)
  const ty = (t) => top + 4 + (1 - (t - lo) / (hi - lo)) * (bottom - top - 14);
  const deg = (t) => `${Math.round(t) < 0 ? '−' : ''}${Math.abs(Math.round(t))}°`;
  const hh = (t) => String(new Date(t * 1000).getHours()).padStart(2, '0');
  const at = (t) => Math.max(0, Math.min(n, (t - hours[0].t) / 3600));
  let x0 = at(trip.t0), x1 = at(trip.t1);
  if (x1 - x0 < 0.25) { const m = (x0 + x1) / 2; x0 = m - 0.125; x1 = m + 0.125; } // (a short ride still shows)
  // the shapes, in hours across and pixels down, stretched to the width
  let g = `<svg viewBox="0 0 ${n} ${H}" preserveAspectRatio="none" width="100%" height="${H}" aria-hidden="true">`;
  hours.forEach((h, k) => { if (h.night) g += `<rect class="night" x="${k}" y="0" width="1" height="${H}"/>`; });
  g += `<rect class="trip" x="${x0}" y="0" width="${x1 - x0}" height="${H}"/><rect class="trip-bar" x="${x0}" y="${H - 3}" width="${x1 - x0}" height="3"/>`;
  known.forEach((h) => {
    const r = h.x.precip;
    if (r < 0.05) return;
    const bh = Math.min(1, r / 3) * (bottom - top) * 0.75 + 2;
    g += `<rect class="${h.x.temp < 0.5 ? 'snowfall' : 'rain'}" x="${h.k + 0.06}" y="${bottom - bh}" width="0.88" height="${bh}" style="opacity:${Math.min(0.9, 0.35 + r / 4).toFixed(2)}"/>`;
  });
  const pts = hours.map((h, k) => (h.x ? `${(k + 0.5).toFixed(2)},${ty(h.x.temp).toFixed(1)}` : null));
  let run = [];
  for (const p of [...pts, null]) { if (p) run.push(p); else { if (run.length > 1) g += `<polyline class="temp" points="${run.join(' ')}"/>`; run = []; } }
  g += '</svg>';
  // the words and arrows, at their own size
  let s = `<svg class="wx-strip" width="100%" height="${H}" role="img" aria-label="${label}">${g}`;
  const warm = known.reduce((b, h) => (h.x.temp > b.x.temp ? h : b), known[0]), cold = known.reduce((b, h) => (h.x.temp < b.x.temp ? h : b), known[0]);
  s += `<text class="t" x="${pct(warm.k + 0.5)}" y="${ty(warm.x.temp) - 4}" text-anchor="middle">${deg(warm.x.temp)}</text>`;
  if (cold !== warm && Math.round(cold.x.temp) !== Math.round(warm.x.temp)) s += `<text class="t" x="${pct(cold.k + 0.5)}" y="${Math.min(bottom, ty(cold.x.temp) + 11)}" text-anchor="middle">${deg(cold.x.temp)}</text>`;
  known.forEach((h) => {
    if (h.k % 3) return;
    const l = Math.min(6, 2.5 + h.x.speed / 2), w = h.x.speed > 8 ? 1.8 : 1.1;
    s += `<svg x="${pct(h.k + 0.5)}" y="7" width="1" height="1" overflow="visible"><path class="wind" stroke-width="${w}" transform="rotate(${Math.round(h.x.dir + 180)})" d="M0 ${l}V${-l}M-2.4 ${-l + 2.6}L0 ${-l}L2.4 ${-l + 2.6}"/></svg>`;
  });
  hours.forEach((h, k) => { if (k % 3 === 1) s += `<text class="h" x="${pct(k + 0.5)}" y="${H - 5}" text-anchor="middle">${hh(h.t)}</text>`; });
  return `${s}</svg>`;
}
