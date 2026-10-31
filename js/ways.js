// Every way, for a tap (#574): what one thing is, from OpenStreetMap's own ways. The map's tiles don't carry every tag,
// and the trail details (js/trails.js) only load trails, so a tap asks Overpass for all the ways of a z14 tile (about
// 1.2 km here) once, cached a week as the trail details' z13 tiles are (js/osm.js), and joins the pieces that continue
// each other into one pick. A tile's ways are cut at every junction, so a walk can stop at one.

import { cachedOverpass } from './osm.js';
import { lonLatToTile, tileBounds, pointSegment, lineLength, bearing } from './geo.js';
import { kindOf } from './facts.js';

export const WAYS_Z = 14;
const KINDS = '^(trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian|track|path|footway|cycleway|bridleway|steps)(_link)?$';
const ROUTES = '^(hiking|foot|bicycle|mtb|running|ski|fitness_trail)$';
const KEEP = ['highway', 'name', 'ref', 'surface', 'smoothness', 'tracktype', 'lit', 'width', 'bicycle', 'foot', 'horse', 'access', 'motor_vehicle', 'segregated',
  'cycleway', 'cycleway:left', 'cycleway:right', 'cycleway:both', 'oneway', 'oneway:bicycle', 'mtb:scale', 'mtb:scale:uphill', 'sac_scale', 'trail_visibility',
  'winter_service', 'snowplowing', 'piste:type', 'piste:grooming', 'bicycle:conditional', 'bridge', 'tunnel', 'maxspeed', 'sidewalk', 'sidewalk:both',
  'junction', 'service', 'footway', 'informal', 'check_date', 'survey:date'];
const LONG = 25000; // m: a pick stops here at the longest
const RETRY = 120e3; // a tile that didn't answer is left alone for 2 minutes (a tap asks again at once)

export const wayTile = ([lon, lat]) => lonLatToTile(lon, lat, WAYS_Z).map(Math.floor);

// ------------------------------------------------------------------ the tiles
const waysQuery = (x, y) => {
  const [w, s, e, n] = tileBounds(x, y, WAYS_Z);
  return `[out:json][timeout:40];way[highway~"${KINDS}"](${s.toFixed(6)},${w.toFixed(6)},${n.toFixed(6)},${e.toFixed(6)})->.w;.w out body geom qt;`
    + `rel(bw.w)[type=route][route~"${ROUTES}"][name];out body;`;
};

/** Overpass's answer, cut to what's shown and joined: each way in pieces at its junctions, [id, piece, tags, [first node, last node], lon/lat flat, route name]. */
export function slimWays(json) {
  if (json.remark && /error|timed out|out of memory/i.test(json.remark)) throw new Error(`Overpass: ${json.remark}`);
  const els = json.elements || [], route = new Map(), uses = new Map();
  for (const r of els) if (r.type === 'relation') for (const m of r.members || []) if (m.type === 'way' && !route.has(m.ref)) route.set(m.ref, r.tags.name);
  const ways = els.filter((el) => el.type === 'way' && el.geometry && el.nodes && el.nodes.length > 1);
  for (const el of ways) for (const n of el.nodes) uses.set(n, (uses.get(n) || 0) + 1);
  const tags = (t = {}) => Object.fromEntries(KEEP.filter((k) => t[k] != null).map((k) => [k, t[k]]));
  const out = [];
  for (const el of ways) {
    const g = el.geometry, t = tags(el.tags), cuts = [0];
    for (let i = 1; i < el.nodes.length - 1; i++) if (uses.get(el.nodes[i]) > 1) cuts.push(i);
    cuts.push(el.nodes.length - 1);
    for (let k = 0; k + 1 < cuts.length; k++) {
      const [a, b] = [cuts[k], cuts[k + 1]];
      out.push([el.id, k, t, [el.nodes[a], el.nodes[b]], g.slice(a, b + 1).flatMap((p) => [+p.lon.toFixed(5), +p.lat.toFixed(5)]), route.get(el.id) || null]);
    }
  }
  return { v: 2, w: out };
}

let held = false, heldFail = false; // for checks: every tile that isn't seeded has no ways (or fails), and Overpass isn't asked
export const holdWays = (on = true, fail = false) => { held = on; heldFail = on && fail; };
const tiles = new Map(); // 'x/y' → { at, promise, ok }
const pieces = new Map(); // 'id.k' → a piece
const ends = new Map(); // a node → the pieces that start or end at it
const inTile = new Map(); // 'x/y' → its pieces

function index(x, y, d) {
  const list = inTile.get(`${x}/${y}`) || [];
  inTile.set(`${x}/${y}`, list);
  for (const [id, k, tags, nodes, flat, rel] of d.w) {
    if (pieces.has(`${id}.${k}`)) continue;
    const coords = [];
    for (let i = 0; i < flat.length; i += 2) coords.push([flat[i], flat[i + 1]]);
    const lon = coords.map((p) => p[0]), lat = coords.map((p) => p[1]);
    const w = { id, k, tags, nodes, coords, rel, len: lineLength(coords), box: [Math.min(...lon), Math.min(...lat), Math.max(...lon), Math.max(...lat)] };
    pieces.set(`${id}.${k}`, w);
    list.push(w);
    for (const n of new Set(nodes)) ends.set(n, [...(ends.get(n) || []), w]);
  }
}

/** The ways of a z14 tile, as a promise; one that failed is asked again after 2 minutes, or at once with `force` (a tap). */
export function loadWays([x, y], { force = false } = {}) {
  const key = `${x}/${y}`, t = tiles.get(key);
  if (t && (t.ok !== false || (!force && Date.now() - t.at < RETRY))) return t.promise;
  const entry = { at: Date.now(), ok: null };
  entry.promise = (held ? (heldFail ? Promise.reject(new Error('Overpass')) : Promise.resolve({ v: 2, w: [] })) : cachedOverpass(`ways2/${WAYS_Z}/${key}`, waysQuery(x, y), slimWays, { race: true }))
    .then((d) => { index(x, y, d); entry.ok = true; return d; }, (err) => { entry.ok = false; throw err; });
  tiles.set(key, entry);
  return entry.promise;
}
export const waysLoaded = (ll) => (tiles.get(wayTile(ll).join('/')) || {}).ok === true;
/** For checks: a tile's ways given, no request. */
export function seedWays(x, y, d) {
  tiles.set(`${x}/${y}`, { at: Date.now(), ok: true, promise: Promise.resolve(d) });
  index(x, y, d);
}

/** The nearest piece within `metres` of a spot, from the tiles that have loaded, or null. */
export function nearestWay(ll, metres) {
  const [x, y] = wayTile(ll), m = metres / 111320, mx = m / Math.cos((ll[1] * Math.PI) / 180);
  let best = null;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    for (const w of inTile.get(`${x + dx}/${y + dy}`) || []) {
      const c = w.coords, b = w.box;
      if (ll[0] < b[0] - mx || ll[0] > b[2] + mx || ll[1] < b[1] - m || ll[1] > b[3] + m) continue;
      for (let i = 1; i < c.length; i++) {
        const r = pointSegment(ll, c[i - 1], c[i]);
        if (r.d < metres && (!best || r.d < best.d)) best = { w, d: r.d };
      }
    }
  }
  return best && best.w;
}

// ------------------------------------------------------------------ what one thing is (#574's rule 3)
// Pieces that continue each other (one ends where the next begins) join when they belong to the same marked route, else
// have the same name; unnamed ones join while their kind stays the same, and stop at every junction. At a fork the pick
// goes straight on. A road stops where its number changes, a loop where it began, and everything at 25 km.
const joinKey = (w) => (w.rel ? `r:${w.rel}` : w.tags.name ? `n:${w.tags.name}` : `k:${kindOf(w.tags)}`);
const turn = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const sameRef = (a, b) => !(a.tags.ref && b.tags.ref && a.tags.ref !== b.tags.ref);

/** { chain: [{ w, rev }], stops: { start, end: { why, at } } }: `why` is end, junction, loop or long (joinWay() adds `unloaded`). */
export function walk(seed) {
  const key = joinKey(seed), used = new Set([seed]), stops = {};
  const chain = [{ w: seed, rev: false }];
  let total = seed.len;
  for (const side of ['end', 'start']) {
    const c0 = seed.coords;
    let node = side === 'end' ? seed.nodes[1] : seed.nodes[0], last = seed;
    let at = side === 'end' ? c0[c0.length - 1] : c0[0], from = side === 'end' ? c0[c0.length - 2] : c0[1];
    for (;;) {
      const here = ends.get(node) || [];
      if (key.startsWith('k:') && here.length > 2) { stops[side] = { why: 'junction', at }; break; }
      const cands = here.filter((w) => !used.has(w) && joinKey(w) === key && sameRef(last, w));
      if (!cands.length) { stops[side] = { why: 'end', at }; break; }
      if (total > LONG) { stops[side] = { why: 'long', at }; break; }
      const out = bearing(from, at);
      const best = cands.map((w) => { const fwd = w.nodes[0] === node; return { w, fwd, turn: turn(out, bearing(at, fwd ? w.coords[1] : w.coords[w.coords.length - 2])) }; })
        .sort((a, b) => a.turn - b.turn)[0];
      used.add(best.w);
      total += best.w.len;
      last = best.w;
      const wc = best.w.coords;
      if (side === 'end') chain.push({ w: best.w, rev: !best.fwd }); else chain.unshift({ w: best.w, rev: best.fwd });
      node = best.fwd ? best.w.nodes[1] : best.w.nodes[0];
      at = best.fwd ? wc[wc.length - 1] : wc[0];
      from = best.fwd ? wc[wc.length - 2] : wc[1];
      if (node === (side === 'end' ? seed.nodes[0] : seed.nodes[1])) { stops[side] = { why: 'loop', at }; break; } // round the block
    }
  }
  return { chain, stops };
}

// A street with two carriageways is one street: the other side is the same name, one way, running the other way, within
// 70 m of the tapped side's middle. Its own walk, drawn too; the card counts only the side you tapped.
function otherSide(seed, chain) {
  const t = seed.tags;
  if (!t.name || !['yes', '-1'].includes(t.oneway)) return [];
  const mid = seed.coords[Math.floor(seed.coords.length / 2)], dir = (w) => { const c = w.coords, b = bearing(c[0], c[c.length - 1]); return w.tags.oneway === '-1' ? (b + 180) % 360 : b; };
  const mine = new Set(chain.map((x) => x.w));
  let best = null;
  const [x, y] = wayTile(mid);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    for (const w of inTile.get(`${x + dx}/${y + dy}`) || []) {
      if (mine.has(w) || w.tags.name !== t.name || !['yes', '-1'].includes(w.tags.oneway) || turn(dir(w), dir(seed)) < 120) continue;
      let d = Infinity;
      for (let i = 1; i < w.coords.length; i++) d = Math.min(d, pointSegment(mid, w.coords[i - 1], w.coords[i]).d);
      if (d < 70 && (!best || d < best.d)) best = { w, d };
    }
  }
  return best ? walk(best.w).chain.map((x) => x.w).filter((w) => !mine.has(w)) : [];
}

// west to east (or south to north where it runs straight north), so "the way it runs" is the same each time
function oriented(chain) {
  const a = chain[0], z = chain[chain.length - 1], p = a.rev ? a.w.coords[a.w.coords.length - 1] : a.w.coords[0], q = z.rev ? z.w.coords[0] : z.w.coords[z.w.coords.length - 1];
  return q[0] < p[0] || (q[0] === p[0] && q[1] < p[1]) ? chain.slice().reverse().map((x) => ({ w: x.w, rev: !x.rev })) : chain;
}

/**
 * The pick for a tapped piece: the chain, the other carriageway and where it stopped; the tiles its ends run into are
 * loaded first (up to six), and `grew(walk)` has the chain so far before each.
 */
export async function joinWay(seed, grew = () => {}) {
  let j = walk(seed);
  for (let k = 0; k < 6; k++) {
    const out = Object.values(j.stops).filter((s) => s.why === 'end' && !waysLoaded(s.at));
    if (!out.length) break;
    grew(j);
    await Promise.all(out.map((s) => loadWays(wayTile(s.at)).catch(() => null)));
    j = walk(seed);
  }
  // (an end in a tile that didn't load: the way may go on, and the card says so)
  for (const s of Object.values(j.stops)) s.unloaded = s.why === 'end' && !waysLoaded(s.at);
  return { chain: oriented(j.chain), side: otherSide(seed, j.chain), stops: j.stops };
}

/** A chain as one line for the analysis: its points, and the tags of the piece each segment is on. */
export function lineOf(chain) {
  const coords = [], attrs = [];
  for (const { w, rev } of chain) {
    const c = rev ? [...w.coords].reverse() : w.coords;
    c.forEach((p, i) => { if (i === 0 && coords.length) return; if (coords.length) attrs.push({ tags: w.tags }); coords.push(p); });
  }
  return { coords, attrs };
}
