// The facts a card shows (25d). Pure: read from the route's analysis and what the planner says of a point, so a
// missing one says so in its place, in the same words on every card. 1b adds the route's, by sport.
import { fmtDist } from './geo.js';

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
