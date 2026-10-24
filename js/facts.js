// The facts a card shows (25d). Pure: read from the route's analysis and what the planner says of a point, so a
// missing one says so in its place, in the same words on every card. 1b adds the route's, by sport.
import { fmtDist } from './geo.js';

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
    if (key === 'wind') return w ? { key, value: `${Math.round(w.speed[i])} m/s`, label: 'wind' } : miss(key, 'wind not known yet');
    return w ? { key, value: `${Math.round(w.temp[i])} °C`, label: 'temperature' } : miss(key, 'temperature not known yet');
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
