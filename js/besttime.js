// Best time to leave (#273, #856; docs/plans/best-time-to-leave.md): for a day, what each hour's departure makes of the
// trip. It only reads: every departure is timed through the planner's timing(), never through When, and its weather is
// windAlong()'s, from the forecasts the route already has (past two days, the route's ten-day one, asked for once).
// The dark sorts the departures and the weather ranks them (the plan's rule, decided 2026-11-15): a bar is the minutes
// in the rain (heavy rain double), feeling hot, lost to a headwind on a bike, or in a strong wind on the water, over the
// time on the move. Thunder, a frostbite risk and waves over the craft's comfort rule an hour out, as Check's limits do.
import { isWater, groupOf } from './config.js';
import { windAlong, forecastKnown, skyKind } from './weather.js';
import { darkness, nightAt } from './sun.js';
import { feelsLike } from './winter.js';
import { isNight } from './stops.js';
import { sampleAt } from './trip.js';
import { waveHeight, waveWind, COMFORT_WAVE } from './waterdata.js';
import { dirIndex } from './water.js';

const HOT = 27; // °C as it feels (the weather card's limit)
const WATER_WIND = 5; // m/s on the water (the card's)
const FROST = -27; // feels like, on land (Check's frostbite risk)
const HEAVY = 4; // mm an hour

// Local midnight `k` days from today (epoch seconds)
export function dayStart(k) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + k); return d.getTime() / 1000; }
// …and back: how many days from today epoch second `t` is
export const dayOffset = (t) => Math.round((new Date(t * 1000).setHours(0, 0, 0, 0) / 1000 - dayStart(0)) / 86400);

// The open water on the route's water legs, as the water router left it (water.js's `reach`): each sample's place along
// the route, the leg's craft and the fetch from eight directions; the crossing, the longest stretch with a kilometre or
// more of open water on some side ({ from, to } in metres); and whether any water was drawn or imported, its waves unknown
export function openWater(pl, a) {
  const pts = [], covered = [];
  pl.legs.forEach((l, li) => {
    const r = l.mode === 'water' && l.status === 'ok' && l.result?.water?.reach;
    if (!r) return;
    const base = pl.lengthTo(li);
    covered.push([base, pl.lengthTo(li + 1)]);
    r.f.forEach((f, j) => { const m = base + (j + 0.5) * r.step; if (f) pts.push({ m, i: sampleAt(a, m), f, comfort: COMFORT_WAVE[pl.craftOf(li)] || 0.3, step: r.step }); });
  });
  let cross = null, run = null;
  for (const p of pts) {
    const open = Math.max(...p.f) >= 1000;
    if (open && run && p.m - run.to <= p.step * 1.5) run.to = p.m;
    else if (open) run = { from: p.m, to: p.m };
    else run = null;
    if (run && (!cross || run.to - run.from > cross.to - cross.from)) cross = { ...run };
  }
  const sport = (i) => (a.attr[i] && a.attr[i].sport) || a.activity;
  const unrouted = a.along.some((m, i) => i && isWater(sport(i)) && !(a.attr[i].tags || {}).portage && !covered.some(([x, y]) => m >= x - 1 && m <= y + 1));
  return { pts, cross, unrouted };
}

// One departure at `start` (epoch seconds): the trip timed from it, the dark, and with the forecast `w` (null: none, or
// it failed) its weather. On a trip with nights, the first day only (a night ends at its Go on at, so later days don't move)
function score(pl, a, start, t, t0, w, water) {
  const n = a.along.length, night = t.waits.find((x) => isNight(x.stop));
  const e = night ? Math.max(1, a.along.findIndex((m) => m >= night.at - 1)) : n - 1;
  const to = t.tAt[e] - (night ? t.waitAt[e] : 0), end = start + to, dur = Math.max(60, to); // (there at the night, before its wait)
  // the dark: minutes in it (dusk half), from the sun
  const dk = darkness(start, end, a.pts[0]);
  const darkS = dk.reduce((s, x) => s + (x.to - x.from) * (x.kind === 'dark' ? 1 : 0.5), 0);
  let darkWords = '';
  if (dk.length) {
    let to = dk[0].to;
    for (const x of dk.slice(1)) if (x.from <= to + 60) to = x.to;
    darkWords = dk[0].from > start + 60 ? `from:${dk[0].from}` : to >= end - 60 ? 'all' : `until:${to}`;
  }
  const x = { t: start, back: end, dur, dark: darkS / dur, darkWords, e };
  if (!w) return x;
  const sport = (i) => (a.attr[i] && a.attr[i].sport) || a.activity;
  const wet = (i) => (a.attr[i] || {}).mode === 'water' || isWater(sport(i));
  let move = 0, rain = 0, mm = 0, snow = false, heat = 0, lost = 0, windy = 0, head = 0, speed = 0, out = null, none = false;
  for (let i = 1; i <= e; i++) {
    if (!forecastKnown(w, i)) { none = true; break; }
    const dt = t.tAt[i] - t.tAt[i - 1] - t.waitAt[i], kmh = ((a.along[i] - a.along[i - 1]) / Math.max(1, dt)) * 3.6;
    move += dt; head += w.head[i] * dt; speed += w.speed[i] * dt;
    if (w.precip[i] >= 0.1) { rain += dt * (w.precip[i] >= HEAVY ? 2 : 1); mm += (w.precip[i] * dt) / 3600; if (w.temp[i] < 0.5) snow = true; }
    const feel = feelsLike(w, i, kmh);
    if (feel >= HOT) heat += dt;
    if (w.thunder && w.thunder[i] === 1) out = out || 'thunder';
    if (!wet(i) && feel != null && feel <= FROST) out = out || 'frost';
    if (groupOf(sport(i)) === 'bike') lost += dt - (t0.tAt[i] - t0.tAt[i - 1] - t0.waitAt[i]);
    if (wet(i) && w.speed[i] >= WATER_WIND) windy += dt;
  }
  if (none) return { ...x, none: true };
  // the waves on the open water, from the hour's wind where you are then
  let wave = null, rough = false;
  for (const p of water.pts) {
    const i = p.i;
    if (i > e) continue;
    const v = waveHeight(waveWind({ speed: w.speed[i], gust: w.gust[i] }), p.f[dirIndex(w.dir[i])]);
    wave = Math.max(wave ?? 0, v);
    if (v > p.comfort) { out = out || 'waves'; rough = true; }
  }
  const mid = sampleAt(a, a.along[e] / 2), cost = rain + heat + Math.max(0, lost) + windy; // (a tailwind never makes up for rain)
  return { ...x, bar: Math.min(1, cost / Math.max(60, move)), rain, mm, snow, heat, lost, windy, out, wave, rough,
    head: head / Math.max(1, move), speed: speed / Math.max(1, move), temp: w.temp[mid],
    sky: skyKind(w.precip[mid], w.temp[mid], w.cloud ? w.cloud[mid] : NaN, nightAt(start + t.tAt[mid], a.pts[mid]), w.thunder?.[mid] === 1) };
}

// A day's 24 departures, from local midnight `day0`: a passed hour has only its dark; the current hour is Leave now,
// from this minute. `failed`: true, or a back-off's words. `stale()`: the route or the forecast changed, so the answer is dropped (null). The forecast is asked
// for an hour at a time, so a failure stops the day at once (one failed request, not 24): the rest are the dark alone.
export async function sweepDay(pl, a, day0, stale) {
  const now = Math.round(Date.now() / 60000) * 60, water = openWater(pl, a), hrs = [];
  let failed = false;
  for (let j = 0; j < 24; j++) {
    const h0 = day0 + j * 3600;
    if (h0 + 3600 <= now) { const t = pl.timing(a, null, null, h0); hrs.push({ ...score(pl, a, h0, t, t, null, water), h0, past: true }); continue; } // (its dark, for the shade)
    const start = Math.max(h0, now), t0 = pl.timing(a, null, null, start);
    let w = null, t = t0;
    if (!failed) {
      try {
        w = await windAlong(a.pts, a.along, t0.tAt, start);
        t = pl.timing(a, w.head, pl.snowOf(a, w), start);
        w = await windAlong(a.pts, a.along, t.tAt, start); // (sampled again at the wind's times, as loadWind() does)
      } catch (err) { failed = err?.name === 'Limited' ? err.message : true; w = null; t = t0; } // (a back-off says which service, and when)
      if (stale()) return null;
    }
    hrs.push({ ...score(pl, a, start, t, t0, w, water), h0, now: start === now, unknown: !w });
    await new Promise((r) => setTimeout(r)); // (the page keeps answering while it works)
    if (stale()) return null;
  }
  return { day0, hrs, failed, water };
}

// The departures to name (the plan's rule): each hour sorted into the light (at most a tenth of the trip in the dark; on
// a trip too long for the day's light, within a tenth of the day's least: the most in the light), the dark (half or more)
// or neither (running into it: never named). Up to two stretches in the light and the best one in the dark, leaving
// between 05:00 and 23:00, each named once by its best hour; hours within 5 % are about the same, and between two about
// the same the one nearer `anchor` (minutes into the day: the departure when the row was opened) wins, so the choices
// stay put while you pick. Good: a tenth of the trip or less. A day when every hour is poor names the least bad.
export function nameDay(day, anchor) {
  const hrs = day.hrs, live = hrs.filter((x) => !x.past);
  const least = Math.min(...live.map((x) => x.dark)), lim = least < 0.4 ? Math.max(0.1, least + 0.1) : 0.1;
  for (const x of live) x.grp = x.dark <= lim ? 'light' : x.dark >= 0.5 ? 'dark' : 'into';
  const used = new Set();
  const mins = (x) => Math.round((x.t - day.day0) / 60);
  const usable = (x, lit) => x && !x.past && !x.none && !x.unknown && !x.out && x.grp === (lit ? 'light' : 'dark') && (lit || mins(x) >= 300);
  const near = (x) => { const d = Math.abs(mins(x) - anchor); return Math.min(d, 1440 - d); };
  const windows = (lit, max) => {
    const all = hrs.filter((x) => usable(x, lit)), poor = all.length && all.every((x) => x.bar > 0.4), out = [];
    for (const c of [...all].sort((p, q) => Math.round(p.bar * 20) - Math.round(q.bar * 20) || near(p) - near(q))) {
      if (out.length >= max) break;
      const i = hrs.indexOf(c);
      if (used.has(i) || (c.bar > 0.4 && !(poor && !out.length))) continue;
      let a = i, b = i;
      while (a > 0 && usable(hrs[a - 1], lit) && hrs[a - 1].bar <= c.bar + 0.05) a--;
      while (b < 23 && usable(hrs[b + 1], lit) && hrs[b + 1].bar <= c.bar + 0.05) b++;
      for (let j = a - 2; j <= b + 2; j++) used.add(j); // (two named departures at least two hours apart)
      out.push({ best: c, a, b, i, least: c.bar > 0.4 });
    }
    return out;
  };
  const lit = windows(true, 2);
  return { lit, dark: windows(false, 1) };
}
// whether a named stretch is good: no worse than a tenth of the trip
export const good = (w) => !!w && !w.least && w.best.bar <= 0.1;
