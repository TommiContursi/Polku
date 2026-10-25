// The facts a card shows (25d). Pure: read from the route's analysis and what the planner says of a point, so a
// missing one says so in its place, in the same words on every card. 1b adds the route's, by sport.
import { fmtDist, fmtDuration } from './geo.js';
import { OFFROAD_BIKE, isWater, ACTIVITIES } from './config.js';
import { surfaceClass } from './analysis.js';
import { forecastKnown } from './weather.js';

// ------------------------------------------------------------------ the route's facts, by sport (1b)
// The three numbers a tap on the route shows, your sport's first: when you'd be there, how steep, and what the sport
// asks of the way. The sport orders the facts, never hides them: What's here has the others (wayFacts()).
export const SPORT_FACTS = { mtb: ['clock', 'grade', 'mtb'], gravel: ['clock', 'grade', 'surface'], road: ['clock', 'grade', 'surface'], hike: ['clock', 'grade', 'sac'], trailrun: ['clock', 'grade', 'sac'], run: ['clock', 'grade', 'surface'], paddle: ['clock', 'wind', 'temp'], swim: ['clock', 'wind', 'temp'] };

// one short word a grade, on its own line under it
const MTB_WORDS = ['easy', 'fairly easy', 'medium', 'hard', 'very hard', 'extreme', 'extreme'];
const SAC = { hiking: ['T1', 'easy'], mountain_hiking: ['T2', 'medium'], demanding_mountain_hiking: ['T3', 'hard'], alpine_hiking: ['T4', 'alpine'], demanding_alpine_hiking: ['T5', 'alpine'], difficult_alpine_hiking: ['T6', 'alpine'] };
// a way's MTB grade (mtb:scale, or the uphill one), as "S1" and its word; null when it isn't mapped
export function mtbGrade(tags, key = 'mtb:scale') {
  const n = parseInt(tags && tags[key], 10);
  return n >= 0 && n <= 6 ? { value: `S${n}`, word: MTB_WORDS[n] } : null;
}
// a way's trail grade (sac_scale), as "T1" and its word; null when it isn't mapped
export function sacGrade(tags) {
  const g = tags && SAC[tags.sac_scale];
  return g ? { value: g[0], word: g[1] } : null;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const plain = (v) => String(v).replace(/_/g, ' ');

// The route's three numbers at analysis sample i, for `sport`: [{ key, value, word, label, missing }]. `when`: the time
// you'd be there (seconds), `clock(sec)` the planner's clock.
export function headline(a, i, sport, { when = null, clock = String } = {}) {
  const tags = (a.attr[i] && a.attr[i].tags) || {}, w = a.wind;
  const miss = (key, label) => ({ key, value: '?', label, missing: true });
  return (SPORT_FACTS[sport] || SPORT_FACTS.mtb).map((key) => {
    if (key === 'clock') return when != null ? { key, value: clock(when), label: 'there at' } : miss(key, 'there at not known yet');
    if (key === 'grade') {
      if (a.eleGap && a.eleGap[i]) return miss(key, 'no terrain here');
      const g = Math.round(a.grade[i]) || 0; // (no "−0 %")
      return { key, value: `${g >= 0 ? '+' : '−'}${Math.abs(g)} %`, label: g >= 0 ? 'uphill' : 'downhill' };
    }
    if (key === 'mtb') { const m = mtbGrade(tags); return m ? { key, ...m, label: 'difficulty' } : miss(key, 'difficulty not mapped'); }
    if (key === 'sac') { const m = sacGrade(tags); return m ? { key, ...m, label: 'trail grade' } : miss(key, 'trail grade not mapped'); }
    if (key === 'surface') return a.surf[i] && a.surf[i] !== 'unknown' ? { key, value: cap(plain(a.surf[i])), label: 'surface' } : miss(key, 'surface not mapped');
    // (past the forecast's reach its values are its last hour's: none yet, #465)
    if (key === 'wind') return forecastKnown(w, i) ? { key, value: `${Math.round(w.speed[i])} m/s`, label: 'wind' } : miss(key, w ? 'wind: no forecast yet' : 'wind not known yet');
    return forecastKnown(w, i) ? { key, value: `${Math.round(w.temp[i])} °C`, label: 'temperature' } : miss(key, w ? 'temperature: no forecast yet' : 'temperature not known yet');
  });
}

// What's here (1b): the way as the map knows it, from the route's own tags, in groups, your sport's first, then the
// others; winter and when it was last checked only where the map says so. [{ group, label, value, missing }]
const GRADE_TEXT = (g) => (g ? `${g.value}, ${g.word}` : null);
const WAY_GROUPS = {
  mtb: ['For MTB', [['Difficulty', (t) => GRADE_TEXT(mtbGrade(t))], ['Uphill difficulty', (t) => GRADE_TEXT(mtbGrade(t, 'mtb:scale:uphill'))], ['Surface', (t) => t.surface && cap(plain(t.surface))], ['Width', (t) => t.width && `${t.width}${/[a-z]/i.test(t.width) ? '' : ' m'}`]]],
  bike: ['For cycling', [['Surface', (t) => t.surface && cap(plain(t.surface))], ['Smoothness', (t) => t.smoothness && cap(plain(t.smoothness))], ['Track grade', (t) => t.tracktype && plain(t.tracktype)]]],
  hike: ['For hiking', [['Trail grade', (t) => GRADE_TEXT(sacGrade(t))], ['Visibility', (t) => t.trail_visibility && cap(plain(t.trail_visibility))]]],
};
const GROUP_OF = { mtb: 'mtb', gravel: 'bike', road: 'bike', hike: 'hike', trailrun: 'hike', run: 'hike' };
export function wayFacts(tags, sport) {
  const t = tags || {}, own = GROUP_OF[sport];
  const order = [own, 'mtb', 'hike'].filter((g, k, all) => g && all.indexOf(g) === k);
  const out = order.flatMap((g) => WAY_GROUPS[g][1].map(([label, get]) => { const v = get(t); return { group: WAY_GROUPS[g][0], label, value: v || 'not mapped', missing: !v }; }));
  const plough = t.snowplowing || t.winter_service;
  if (plough) out.push({ group: 'In winter', label: 'Ploughed', value: plough === 'yes' ? 'Yes' : plough === 'no' ? 'Not ploughed' : cap(plain(plough)) });
  if (t['piste:type'] === 'nordic') out.push({ group: 'In winter', label: 'Ski track', value: t['piste:grooming'] ? `Groomed, ${plain(t['piste:grooming'])}` : 'Yes' });
  const checked = t.check_date || t['survey:date'];
  if (checked) out.push({ group: 'Last checked', label: 'OpenStreetMap', value: checked });
  return out;
}

// the terrain's height `along` metres along the route (null: no terrain there yet)
export function heightAt(a, along) {
  if (!a || !a.ele || !a.along) return null;
  let k = 0;
  while (k < a.along.length - 1 && a.along[k] < along - 1) k++;
  return (a.eleGap && a.eleGap[k]) || !Number.isFinite(a.ele[k]) ? null : a.ele[k];
}

// A point's three numbers: when you'd get there (the start: when you leave), how far along, how high.
// `when` is the time in seconds, `along` metres from the start, `clock(sec)` the planner's clock; `a` the analysis.
// `pending`: a leg up to the point is being routed, or the analysis is of the route before it: what isn't known yet
// is a "–" in its place, at its size, so the card doesn't jump while the route is worked out; a dashed box is for
// what isn't there at all (no terrain, no analysis yet).
export function pointNums(a, i, { when, along, clock, pending = false }) {
  const start = i === 0, label = start ? 'you leave' : 'there at', ele = pending ? null : heightAt(a, along);
  const wait = (l) => ({ value: '–', label: l, wait: true });
  return [
    when != null && !(pending && !start) ? { value: clock(when), label } : pending ? wait(label) : { value: '?', label: `${label} not known yet`, missing: true },
    start ? null : pending ? wait('from the start') : { value: fmtDist(along), label: 'from the start' },
    ele != null ? { value: `${Math.round(ele)} m`, label: 'height' } : pending ? wait('height')
      : { value: '?', label: a && a.ele ? 'no terrain here' : 'height not known yet', missing: true },
  ].filter(Boolean);
}

// ------------------------------------------------------------------ the hardest climb (Journey D)
// One measure a sport, everywhere: the uphill grade on an MTB or gravel bike (the bigger climb of the same grade), else
// height × gradient. How it's said: "↑S2, 21 m at 12 %", "45 m at 9 %".
export function hardestClimb(climbs, sport) {
  const grade = OFFROAD_BIKE.has(sport), score = (c) => (grade ? c.cls * 1e6 + c.gain : c.gain * c.avg);
  return (climbs || []).reduce((m, c) => (!m || score(c) > score(m) ? c : m), null);
}
export const climbWords = (c, sport) => `${OFFROAD_BIKE.has(sport) ? `↑S${c.cls}, ` : ''}${Math.round(c.gain)} m at ${Math.round(c.avg)} %`;

// ------------------------------------------------------------------ key facts (#471's A2)
// What stands out on a route, for the line under its numbers, in the order it picks: what can change whether you go
// (a water leg's wind, always; rain on the way), what changes how long (a headwind that adds 15 min or a tenth of the
// time), the hardest bit (unpaved on a road bike); else the sport's usual fact (a trip's hardest day, the hardest climb on
// a bike, the high point on foot). `noWeather`: why the weather isn't known ("no forecast yet"), said beside it, never
// taken as calm. Each: { k, html, aria, stand, usual, miss }; html has <b> for its number.
export const STANDS = { rainMm: 0.5, rainM: 1000, headMin: 15, headShare: 0.1, unpavedM: 1000 };
export function keyFacts(a, { sport, days = [], noWeather = null }) {
  const out = [], w = noWeather ? null : a.wind, km = (m) => fmtDist(m), reach = forecastReach(a, w);
  const water = waterWind(a, w, (sp) => isWater(sp)), why = noWeather || (w ? 'no forecast yet' : 'not known yet');
  const past = water && water.past ? ` · no forecast yet from km ${(a.along[w.beyond] / 1000).toFixed(1)}` : '';
  if (water) out.push(water.none ? { k: 'wind', miss: true, stand: true, html: `Wind: <b>${why}</b>`, aria: `Wind: ${why}` }
    : { k: 'wind', stand: true, html: `Wind up to <b>${water.sp} m/s</b>, gusts ${water.g} · headwind <b>${water.head} %</b>${past}`, aria: `Wind up to ${water.sp} m/s, gusts ${water.g}, headwind ${water.head} % of the way${past}: the weather along the route` });
  if (w && w.precip) {
    let wet = 0;
    for (let i = 1; i < reach; i++) if (w.precip[i] >= STANDS.rainMm) wet += a.along[i] - a.along[i - 1];
    if (wet >= STANDS.rainM) out.push({ k: 'rain', stand: true, v: { m: wet }, html: `Rain on <b>${km(wet)}</b> of the way`, aria: `Rain on ${km(wet)} of the way: the weather along the route` });
  }
  const add = a.timeWind && !water ? (a.timeWind - a.time) / 60 : 0;
  if (add >= STANDS.headMin || (add > 1 && add * 60 >= STANDS.headShare * a.time)) out.push({ k: 'bwind', stand: true, v: { add: Math.round(add) }, html: `Headwind adds <b>${Math.round(add)} min</b>`, aria: `Headwind adds ${Math.round(add)} min to the time: the weather along the route` });
  if (sport === 'road') {
    let rough = 0;
    for (let i = 1; i < a.along.length; i++) if (['unpaved', 'trail'].includes(surfaceClass(a, i))) rough += a.along[i] - a.along[i - 1];
    if (rough >= STANDS.unpavedM) { const p = Math.round((rough / a.total) * 100); out.push({ k: 'unpaved', stand: true, v: { m: rough, p }, html: `Unpaved <b>${km(rough)}</b>, ${p} % of the way`, aria: `Unpaved ${km(rough)}, ${p} % of the way: show it in On the route` }); }
  }
  // the usual: a trip's hardest day, then the sport's own
  const day = days.reduce((m, d) => (!m || d.moving > m.moving ? d : m), null);
  if (days.length > 1) out.push({ k: 'day', usual: true, v: day, html: `Day ${day.n} is the hardest: <b>${km(day.to - day.from)}</b>, <b>↑${Math.round(day.up)} m</b>`, aria: `Day ${day.n} is the hardest: ${km(day.to - day.from)}, ↑${Math.round(day.up)} m, ${fmtDuration(day.moving)} moving: show it in the list` });
  const c = hardestClimb(a.climbs, sport);
  if (['mtb', 'gravel', 'road'].includes(sport) && c) out.push({ k: 'climb', usual: true, v: c, html: `Hardest climb ${OFFROAD_BIKE.has(sport) ? `<b>↑S${c.cls}</b>, ` : ''}${Math.round(c.gain)} m at <b>${Math.round(c.avg)} %</b>`, aria: `Hardest climb ${climbWords(c, sport)}: show it in Climbs` });
  else if (!isWater(sport) && Number.isFinite(a.maxE)) out.push({ k: 'high', usual: true, html: `High point <b>${Math.round(a.maxE)} m</b>`, aria: `High point ${Math.round(a.maxE)} m: show it on the profile` });
  if (noWeather && !water) out.push({ k: 'wx', miss: true, html: `Weather: <b>${noWeather}</b>`, aria: `Weather: ${noWeather}` });
  return out;
}
// what the line shows: the first that stands out, else the usual fact, and the missing weather beside either
export function factLine(facts) {
  const pick = facts.find((x) => x.stand) || facts.find((x) => x.usual), miss = facts.find((x) => x.miss && x !== pick);
  return [pick, miss].filter(Boolean);
}

// a route of two sports: a row for each (its legs together), its distance and its own fact: on the water its wind, on
// land its climbing
export function sportFacts(a, { noWeather = null }) {
  const by = new Map(), w = noWeather ? null : a.wind;
  for (let i = 1; i < a.along.length; i++) {
    const sp = (a.attr[i] && a.attr[i].sport) || a.activity, v = by.get(sp) || { sport: sp, m: 0, up: 0 };
    v.m += a.along[i] - a.along[i - 1];
    const d = a.ele ? a.ele[i] - a.ele[i - 1] : 0;
    if (d > 0) v.up += d;
    by.set(sp, v);
  }
  return [...by.values()].map(({ sport, m, up }) => {
    const label = ACTIVITIES[sport].label, wind = isWater(sport) ? waterWind(a, w, (sp) => sp === sport) : null, why = noWeather || (w ? 'no forecast yet' : 'not known yet');
    const fact = wind ? (wind.none ? [`wind: <b>${why}</b>`, `wind: ${why}`] : [`wind up to <b>${wind.sp} m/s</b>, gusts ${wind.g}`, `wind up to ${wind.sp} m/s, gusts ${wind.g}`])
      : [`<b>↑${Math.round(up)} m</b>`, `↑${Math.round(up)} m`];
    return { k: `sport:${sport}`, sport, miss: !!wind && wind.none, html: `${label} <span class="kf-d">${fmtDist(m)}</span> · ${fact[0]}`, aria: `${label}, ${fmtDist(m)}, ${fact[1]}: show this part in the list` };
  });
}

// the samples the forecast reaches (past them its values are its last hour's, #465)
const forecastReach = (a, w) => (w && w.beyond >= 0 ? w.beyond : a.along.length);

// the wind over a route's water (its samples in a water sport), as far as the forecast reaches: strongest, gusts, and
// how much of it is into the wind; none: there is water but no wind for it; past: water past the forecast's reach
function waterWind(a, w, wet) {
  let n = 0, known = 0, sp = 0, g = 0, head = 0, m = 0, past = false;
  const reach = forecastReach(a, w);
  for (let i = 1; i < a.along.length; i++) {
    if (!wet((a.attr[i] && a.attr[i].sport) || a.activity)) continue;
    n++;
    if (!w) continue;
    if (i >= reach) { past = true; continue; }
    const d = a.along[i] - a.along[i - 1];
    known++; m += d;
    sp = Math.max(sp, w.speed[i]); g = Math.max(g, w.gust[i]);
    if (w.head[i] > 1) head += d;
  }
  if (!n) return null;
  return known ? { sp: Math.round(sp), g: Math.round(g), head: Math.round((head / m) * 100), past } : { none: true };
}

// ------------------------------------------------------------------ a spot and a place on the map (part 5)
// a way's tile properties as the OpenStreetMap tags they come from, so What's here says them as the route's tags
export const tileTags = (p) => ({ 'mtb:scale': p.mtb_scale, surface: p.surface, sac_scale: p.sac, width: p.width, trail_visibility: p.tv, smoothness: p.smooth, name: p.name });

// The spot's three numbers: how far from your route (none with no route), its height, and your sport's fact of the way
// there. `fromRoute` metres or null; `ele` metres, undefined while it's asked, null when there's none; `tags` the way's,
// null with no way there.
export function spotNums({ fromRoute, ele, tags, sport }) {
  const key = (SPORT_FACTS[sport] || SPORT_FACTS.mtb)[2], miss = (label) => ({ value: '?', label, missing: true });
  const fact = !tags && ['mtb', 'sac', 'surface'].includes(key) ? miss('no trail here')
    : key === 'mtb' ? (mtbGrade(tags) ? { ...mtbGrade(tags), label: 'difficulty' } : miss('difficulty not mapped'))
    : key === 'sac' ? (sacGrade(tags) ? { ...sacGrade(tags), label: 'trail grade' } : miss('trail grade not mapped'))
      : key === 'surface' ? (tags && tags.surface ? { value: cap(plain(tags.surface)), label: 'surface' } : miss('surface not mapped'))
        : null; // (on the water the wind is Weather here's, part 6)
  return [
    fromRoute != null ? { value: fmtDist(fromRoute), label: 'from your route' } : null,
    ele === undefined ? { value: '–', label: 'height', wait: true } : ele == null ? miss('height not known') : { value: `${Math.round(ele)} m`, label: 'height' },
    fact,
  ].filter(Boolean);
}

// A place's facts, as plain lines: three at most, from what the map has (a tile's properties, OpenStreetMap's tags once
// they're asked for, LIPAS's)
const PLACE_FACTS = [
  (t) => (t.fee === 'no' ? 'Free' : t.fee === 'yes' ? 'A fee' : null),
  (t) => (t.opening_hours ? (t.opening_hours === '24/7' ? 'Open all the time' : `Open ${t.opening_hours}`) : null),
  (t) => (t.toilets === 'yes' || t.wc === 'true' ? 'A toilet' : null),
  (t) => (t.fireplace === 'yes' || ['firepit', 'bbq'].includes(t.subclass) ? 'A fireplace' : null),
  (t) => (t.drinking_water === 'yes' ? 'Drinking water' : null),
  (t) => (t.wheelchair === 'yes' ? 'Wheelchair access' : t.wheelchair === 'no' ? 'No wheelchair access' : null),
  (t) => (t.ele ? `${Math.round(t.ele)} m high` : null),
  (t) => (t.length ? `${t.length} km long` : null),
  (t) => (t.surface ? cap(plain(t.surface)) : null),
];
export const placeFacts = (tags) => PLACE_FACTS.map((f) => f(tags || {})).filter(Boolean).slice(0, 3);
