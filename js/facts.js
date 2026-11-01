// The facts a card shows (25d). Pure: read from the route's analysis and what the planner says of a point, so a
// missing one says so in its place, in the same words on every card. 1b adds the route's, by sport.
import { fmtDist, fmtDuration } from './geo.js';
import { OFFROAD_BIKE, isWater, ACTIVITIES, UPHILL_TEXT, MTB_SCALE_TEXT } from './config.js';
import { surfaceClass } from './analysis.js';
import { VIS_TEXT, visClass } from './trails.js';
import { forecastKnown } from './weather.js';
import { fromCss } from './palette.js';

// ------------------------------------------------------------------ the route's facts, by sport (1b)
// The three numbers a tap on the route shows, your sport's first: when you'd be there, how steep, and what the sport
// asks of the way. The sport orders the facts, never hides them: What's here has the others (wayFacts()).
export const SPORT_FACTS = { mtb: ['clock', 'grade', 'mtb'], gravel: ['clock', 'grade', 'surface'], road: ['clock', 'grade', 'surface'], hike: ['clock', 'grade', 'sac'], trailrun: ['clock', 'grade', 'sac'], run: ['clock', 'grade', 'surface'], paddle: ['clock', 'wind', 'temp'], swim: ['clock', 'wind', 'temp'] };

// one short word a grade, on its own line under it
const MTB_WORDS = MTB_SCALE_TEXT.map((t) => t.split(' · ')[1].toLowerCase()); // "easy path", "intermediate path"…
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
const plain = (v) => String(v).replace(/_/g, ' ').replace(/;/g, ', ');

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

// A place's facts on its card (#574; What's here's before): at the site, getting there, when it's open, when it was last
// checked, as far as the map knows. `known`: OpenStreetMap's tags are in (All OpenStreetMap details), so what a place of its kind would have
// and doesn't says "not mapped"; before that, only what's there shows. [{ group, label, value, missing }]
const YES = (v) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : v && cap(plain(v)));
const PLACE_ROWS = [
  ['At the site', 'Fee', (t) => (t.fee === 'no' ? 'Free' : t.fee === 'yes' ? 'A fee' : t.fee && cap(plain(t.fee))), 'fee'],
  ['At the site', 'Toilet', (t) => (t['toilets:disposal'] ? cap(plain(t['toilets:disposal'])) : t.wc === 'true' ? 'Yes' : YES(t.toilets)), 'toilets'],
  ['At the site', 'Fireplace', (t) => YES(t.fireplace), 'fireplace'],
  ['At the site', 'Drinking water', (t) => YES(t.drinking_water), 'drinking_water'],
  ['At the site', 'Shelter', (t) => t.shelter_type && cap(plain(t.shelter_type)), null],
  ['At the site', 'Wheelchair access', (t) => (t.wheelchair === 'limited' ? 'Limited' : YES(t.wheelchair)), 'wheelchair'],
  ['At the site', 'Run by', (t) => t.operator, 'operator'],
  ['Getting there', 'Access', (t) => t.access && cap(plain(t.access)), null],
  ['When', 'Open', (t) => (t.opening_hours === '24/7' ? 'All the time' : t.opening_hours), 'opening_hours'],
  ['When', 'Seasons', (t) => t.seasonal && cap(plain(t.seasonal)), 'seasonal'],
  ['Last checked', 'OpenStreetMap', (t) => t.check_date || t['survey:date'], null],
];
// what a place of each kind would have, said "not mapped" once OpenStreetMap's tags are in
const PLACE_WANTS = { toilets: ['fee', 'opening_hours', 'seasonal', 'wheelchair', 'operator'], shelter: ['fireplace', 'toilets'], campsite: ['toilets', 'drinking_water', 'fee'], picnic_site: ['fireplace'], firepit: ['fireplace'], drinking_water: ['seasonal'] };
export function placeGroups(tags, kind, { known = false } = {}) {
  const t = tags || {}, wants = new Set(known ? PLACE_WANTS[kind] || [] : []);
  return PLACE_ROWS.flatMap(([group, label, get, key]) => {
    const v = get(t);
    return v ? [{ group, label, value: v }] : key && wants.has(key) ? [{ group, label, value: 'not mapped', missing: true }] : [];
  });
}

// ------------------------------------------------------------------ one pick: a way joined from its pieces (#574)
// What a person would call one thing, as the pieces' tags say it. Each fact that changes along a way is also a scale
// (`WAY_SCALES`): the class of a piece, its words and its colour, so the card's facts, its Colour by, the profile and the
// map's line say the same thing.
export const KIND_NAME = { path: 'Path', footway: 'Footpath', cycleway: 'Cycleway', track: 'Track', steps: 'Steps', street: 'Street', road: 'Road', bridleway: 'Bridleway', pedestrian: 'Pedestrian street' };
const bikeOn = (t) => ['designated', 'yes'].includes(t.bicycle);
export function kindOf(t) {
  const hw = String(t.highway || '').replace(/_link$/, '');
  if (hw === 'path') return 'path';
  if (hw === 'footway' || hw === 'pedestrian') return bikeOn(t) ? 'cycleway' : hw === 'pedestrian' ? 'pedestrian' : 'footway';
  if (['cycleway', 'track', 'steps', 'bridleway'].includes(hw)) return hw;
  if (['residential', 'living_street', 'unclassified', 'service'].includes(hw)) return 'street';
  return 'road';
}
function bikesOf(t) {
  const hw = String(t.highway || '').replace(/_link$/, '');
  if (t.bicycle === 'no' || t.bicycle === 'dismount') return 'no';
  if (hw === 'cycleway' || (['footway', 'path', 'pedestrian'].includes(hw) && t.bicycle === 'designated')) return t.segregated === 'yes' ? 'separate' : t.segregated === 'no' ? 'shared' : 'cycleway';
  const sides = [t.cycleway, t['cycleway:both'], t['cycleway:left'], t['cycleway:right']];
  if (sides.includes('lane') || sides.includes('exclusive')) return 'lane';
  if (sides.includes('track')) return 'track';
  if (sides.includes('separate')) return 'beside';
  if (['path', 'track', 'bridleway'].includes(hw)) return 'trail';
  if (['footway', 'steps', 'pedestrian'].includes(hw)) return 'walk';
  return 'traffic';
}
const SAC_KEY = { hiking: 'T1', mountain_hiking: 'T2', demanding_mountain_hiking: 'T3', alpine_hiking: 'T4', demanding_alpine_hiking: 'T5', difficult_alpine_hiking: 'T6' };
const SMOOTH_KEY = { excellent: 'excellent', good: 'good', intermediate: 'intermediate', bad: 'bad', very_bad: 'very_bad', horrible: 'horrible', very_horrible: 'horrible', impassable: 'horrible' };
const speedOf = (t) => { const n = parseInt(t.maxspeed, 10); return n > 0 ? String(n <= 20 ? 20 : n <= 30 ? 30 : n <= 40 ? 40 : n <= 50 ? 50 : n <= 60 ? 60 : 70) : null; };
const oneWayOf = (t) => (['yes', '-1'].includes(t.oneway) ? (t['oneway:bicycle'] === 'no' ? 'cars' : 'one') : t.oneway === 'no' ? 'both' : null);
const winterOf = (t) => (t['piste:type'] === 'nordic' ? 'ski' : /no @ \(winter\)/.test(t['bicycle:conditional'] || '') ? 'nobikes'
  : t.snowplowing === 'yes' || t.winter_service === 'yes' ? 'ploughed' : t.snowplowing === 'no' || t.winter_service === 'no' ? 'not' : null);
// the legend's order; `of(tags)` is the class (null: not mapped), items [words, colour]; the smoothness, speed and
// hiking grades take the difficulty scale's colours
export const WAY_SCALES = fromCss({
  hiking: { of: (t) => SAC_KEY[t.sac_scale] || null, items: { T1: ['T1 easy', '--diff-s0'], T2: ['T2 medium', '--diff-s1'], T3: ['T3 hard', '--diff-s2'], T4: ['T4 alpine', '--diff-s3'], T5: ['T5 alpine', '--diff-s4'], T6: ['T6 alpine', '--diff-s5'] } },
  // (words that follow "Cycling": the card's row and Colour by say it, and the way's line starts "Cycling: …", wayLine())
  bikes: { of: bikesOf, quiet: ['trail', 'walk', 'traffic'], items: { separate: ['Separated from walkers', '--bikes-separate'], shared: ['Shared with walkers', '--bikes-shared'], cycleway: ['Bike path', '--bikes-cycleway'],
    lane: ['Bicycle lane', '--bikes-lane'], track: ['Protected bicycle lane', '--bikes-track'], beside: ['Bike path beside the road', '--bikes-beside'], trail: ['On a path or trail', '--bikes-trail'], walk: ['Footway, for walking', '--bikes-walk'],
    traffic: ['With traffic, no bicycle lane', '--bikes-traffic'], no: ['Not allowed', '--bikes-no'] } },
  oneway: { of: oneWayOf, quiet: ['both'], items: { one: ['One way, bikes too', '--oneway-one'], cars: ['One way for cars, both ways for bikes', '--oneway-bikes'], both: ['Both ways', '--oneway-both'] } },
  lit: { of: (t) => (t.lit === 'no' ? 'no' : t.lit ? 'yes' : null), items: { yes: ['Lit', '--lit-yes'], no: ['Not lit', '--lit-no'] } },
  speed: { of: speedOf, items: { 20: ['20 km/h or less', '--diff-s0'], 30: ['30 km/h', '--diff-s1'], 40: ['40 km/h', '--diff-s2'], 50: ['50 km/h', '--diff-s3'], 60: ['60 km/h', '--diff-s4'], 70: ['70 km/h or more', '--diff-s5'] } },
  smooth: { of: (t) => SMOOTH_KEY[t.smoothness] || null, items: { excellent: ['Excellent', '--diff-s0'], good: ['Good', '--diff-s1'], intermediate: ['Intermediate', '--diff-s2'], bad: ['Bad', '--diff-s3'], very_bad: ['Very bad', '--diff-s4'], horrible: ['Horrible or worse', '--diff-s5'] } },
  winter: { of: winterOf, items: { ploughed: ['Ploughed', '--winter-ploughed'], not: ['Not ploughed', '--winter-not'], nobikes: ['No bikes in winter', '--winter-nobikes'], ski: ['Ski track', '--winter-ski'] } },
});
export const NOT_MAPPED = '#d6dde3';
const SMOOTH_TEXT = { excellent: 'Excellent: thin road tyres', good: 'Good: road tyres', intermediate: 'Intermediate: city bikes', bad: 'Bad: sturdy tyres', very_bad: 'Very bad: a mountain bike', horrible: 'Horrible: off-road', very_horrible: 'Very horrible', impassable: 'Impassable' };

// length by value along a chain: [[value, metres]], the most first (null: not mapped)
export function byLen(chain, fn) {
  const m = new Map();
  for (const { w } of chain) { const v = fn(w.tags); m.set(v, (m.get(v) || 0) + w.len); }
  return [...m].sort((a, b) => b[1] - a[1]);
}
// a fact's value: one value, or how much of each; what isn't mapped, said as much. `parts`: [value, its words] each, for a
// picture before each (js/cards.js)
function valueOf(list, words = plain) {
  const known = list.filter(([v]) => v != null);
  if (!known.length) return null;
  const total = list.reduce((s, [, m]) => s + m, 0), unknown = total - known.reduce((s, [, m]) => s + m, 0);
  const parts = known.length === 1 ? [[known[0][0], words(known[0][0])]] : known.map(([v, m]) => [v, `${words(v)} ${fmtDist(m)}`]);
  parts[0][1] = cap(parts[0][1]);
  return { value: parts.map(([, t]) => t).join(', '), parts, note: unknown > 20 ? `Not mapped for ${fmtDist(unknown)} of ${fmtDist(total)}` : '' };
}
const first = (chain, fn) => (byLen(chain, fn).find(([v]) => v) || [])[0];
export const wayKind = (chain) => byLen(chain, kindOf)[0][0];
export const wayTitle = (chain) => (chain.find((x) => x.w.rel) || {}).w?.rel || (chain.find((x) => x.w.tags.name) || {}).w?.tags.name || KIND_NAME[wayKind(chain)] || 'Way';

// the way's line, at the spot and under the card's name: "Cycling: shared with walkers · S0 · fine gravel · 3 m wide · lit"
export function wayLine(chain) {
  const bits = [], kind = wayKind(chain), bikes = byLen(chain, bikesOf)[0][0];
  // (said what it's about: the bare words, first in the line, read as the way's name or kind)
  if (bikes && !['trail', 'traffic'].includes(bikes) || kind === 'road') bits.push(`Cycling: ${WAY_SCALES.bikes.items[bikes][0].toLowerCase()}`);
  // (a grade with its topic: a bare "S0" says nothing here)
  const mtb = first(chain, (t) => (mtbGrade(t) || {}).word || null), sac = !mtb && first(chain, (t) => (sacGrade(t) ? `${sacGrade(t).value} ${sacGrade(t).word}` : null));
  if (mtb || sac) bits.push(mtb ? `MTB: ${mtb}` : `Hiking: ${sac}`);
  const surface = first(chain, (t) => t.surface || null), width = first(chain, (t) => t.width || null), lit = first(chain, WAY_SCALES.lit.of);
  if (surface) bits.push(plain(surface));
  if (width && ['path', 'track', 'cycleway'].includes(kind)) bits.push(`${width}\u00a0m wide`);
  if (lit) bits.push(lit === 'yes' ? 'lit' : 'not lit');
  return bits.length ? cap(bits.join(' · ')) : 'Little is mapped about it';
}

// What a way of its kind would have, and this one doesn't: the card's quiet "Not mapped" line
const WANT = { path: [['surface', 'surface'], ['width', 'width'], ['mtb:scale', 'MTB grade'], ['trail_visibility', 'visibility']], track: [['surface', 'surface'], ['width', 'width'], ['tracktype', 'track grade']],
  cycleway: [['surface', 'surface'], ['width', 'width'], ['lit', 'lit'], ['segregated', 'whether bikes and walkers are separated'], ['smoothness', 'smoothness']], footway: [['surface', 'surface'], ['width', 'width'], ['lit', 'lit']],
  street: [['surface', 'surface'], ['lit', 'lit'], ['maxspeed', 'speed limit']], road: [['surface', 'surface'], ['lit', 'lit'], ['maxspeed', 'speed limit'], ['cycleway', 'bicycle lane']] };
export const unmapped = (chain) => (WANT[wayKind(chain)] || [['surface', 'surface']]).filter(([k]) => !chain.some(({ w }) => w.tags[k] != null || (k === 'cycleway' && Object.keys(w.tags).some((x) => x.startsWith('cycleway'))))).map(([, word]) => word);

// ------------------------------------------------------------------ an area (#574: a lake, a park): its name or kind, its own facts
const AREA_KIND = { lake: 'Lake', pond: 'Pond', reservoir: 'Reservoir', river: 'River', oxbow: 'Oxbow lake', lagoon: 'Lagoon', park: 'Park', nature_reserve: 'Nature reserve', recreation_ground: 'Recreation ground', protected_area: 'Protected area' };
export const areaKind = (t) => (t.natural === 'water' ? AREA_KIND[t.water] || 'Water' : t.boundary === 'national_park' ? 'National park' : AREA_KIND[t.leisure] || AREA_KIND[t.boundary] || 'Area');
export const areaTitle = (t) => t.name || areaKind(t);
/** Its facts as rows, and what an area of its kind would have and this one doesn't. */
export function areaFacts(t) {
  const rows = [t.access ? ['Access', cap(plain(t.access))] : null, t.operator ? ['Run by', t.operator] : null, t.opening_hours ? ['Open', t.opening_hours] : null, t.salt === 'yes' ? ['Water', 'Salt'] : null].filter(Boolean);
  return { rows, missing: (t.natural === 'water' ? [['access', 'access']] : [['access', 'access'], ['operator', 'who runs it']]).filter(([k]) => !t[k]).map(([, word]) => word) };
}

// The card's facts in groups, by length along the way (a fact that changes says how much of each), the same for every
// sport: The way, Surface, Difficulty. [label, value, note, parts] rows (`parts` where each value has its picture: valueOf());
// `a` is the pick's analysis, once it's in.
export function wayGroups(chain, a = null) {
  const total = chain.reduce((s, { w }) => s + w.len, 0), v = (fn, words) => valueOf(byLen(chain, fn), words);
  const row = (label, x) => (x ? [label, x.value, x.note, x.parts] : null);
  const notOn = (fn, word) => { const m = chain.reduce((s, { w }) => s + (fn(w.tags) ? w.len : 0), 0); return m ? (m > total - 20 ? word : `${word} on ${fmtDist(m)}`) : null; };
  const apart = chain.some(({ w }) => /separate/.test(w.tags.sidewalk || w.tags['sidewalk:both'] || ''));
  const no = [notOn((x) => x.bicycle === 'no', 'bikes'), notOn((x) => x.foot === 'no', apart ? 'walking (the pavement is mapped apart)' : 'walking'), notOn((x) => x.horse === 'no', 'horses'),
    notOn((x) => x.access === 'private' || (x.access === 'no' && !['yes', 'designated'].includes(x.bicycle) && !['yes', 'designated'].includes(x.foot)), 'marked private')].filter(Boolean);
  const one = chain.some(({ w }) => w.tags.oneway === 'yes') ? v(oneWayOf, (k) => WAY_SCALES.oneway.items[k][0]) : null;
  const steepest = (() => {
    if (!a) return 0;
    let s = 0;
    for (let i = 0, j = 0; i < a.pts.length; i++) { while (j < a.pts.length - 1 && a.along[j] - a.along[i] < 50) j++; const d = a.along[j] - a.along[i]; if (d >= 30) s = Math.max(s, Math.abs(((a.ele[j] - a.ele[i]) / d) * 100)); }
    return s;
  })();
  const upCls = a ? Math.max(-1, ...a.upCls) : -1, up = upCls >= 0 && UPHILL_TEXT[upCls].split(/ · |, /); // ["↑S0", "Easy uphill", …]
  const winter = v(winterOf, (k) => ({ ski: 'a ski track: keep off on foot and by bike', nobikes: 'no bikes in winter', ploughed: 'ploughed', not: 'not ploughed' }[k]));
  return {
    along: [row('Cycling', v(bikesOf, (k) => WAY_SCALES.bikes.items[k][0].toLowerCase())), one ? ['One way', one.value, '', one.parts] : null, row('Width', v((x) => x.width || null, (x) => `${x}\u00a0m`)), row('Lit', v(WAY_SCALES.lit.of, (k) => (k === 'yes' ? 'yes' : 'no'))),
      row('Speed limit', v((x) => x.maxspeed || null, (x) => `${x} km/h`)), no.length ? ['Not allowed', cap(no.join(', ')), ''] : null].filter(Boolean),
    surface: [row('Surface', v((x) => x.surface || null)), row('Smoothness', v((x) => x.smoothness || null, (x) => SMOOTH_TEXT[x] || plain(x))), row('Winter care', winter)].filter(Boolean),
    diff: [row('MTB', v((x) => (mtbGrade(x) ? `${mtbGrade(x).value} ${mtbGrade(x).word}` : null), String)),
      up ? ['Uphill', `${up[0]} ${up[1]}`, `Steepest ${Math.round(steepest)} % over 50 m, worked out from the terrain`, [[up[0], `${up[0]} ${up[1]}`]]] : steepest >= 3 ? ['Steepest', `${Math.round(steepest)} % over 50 m`, ''] : null,
      row('Hiking', v((x) => (sacGrade(x) ? `${sacGrade(x).value} ${sacGrade(x).word}` : null), String)), row('Visibility', v((x) => (x.trail_visibility ? VIS_TEXT[visClass(x)] : null), String))].filter(Boolean),
  };
}
