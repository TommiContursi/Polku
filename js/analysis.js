// Route analysis: elevation profile from the lidar DEM, grades, climbs with an
// uphill-difficulty grade, surface / way-type breakdown, warnings and timing.

import { snowFactor } from './winter.js';
import { densify, dist } from './geo.js';
import { elevations, smooth } from './dem.js';
import { CRAFT, groupOf, isWater } from './config.js';
import { obstacleKind, widthClass, visClass, obstacleText } from './trails.js';

const LOOSE = new Set(['gravel', 'sand', 'rock', 'pebblestone', 'ground', 'dirt', 'earth', 'mud', 'grass', 'unpaved', 'wood', 'roots']);
const PAVED = new Set(['asphalt', 'paved', 'concrete', 'paving_stones', 'sett', 'chipseal', 'concrete:plates']);

export function surfaceOf(t) {
  if (!t) return 'unknown';
  if (t.surface === 'water' || t.route === 'water') return 'water';
  if (t.surface) return t.surface;
  if (t.highway === 'track') return 'unpaved';
  if (['path', 'footway', 'bridleway'].includes(t.highway)) return 'ground';
  if (t.highway) return 'paved';
  return 'unknown';
}

export function wayOf(t) {
  if (!t) return 'other';
  if (t.portage) return 'portage';
  if (t.route === 'water') return 'water';
  const h = t.highway;
  if (!h) return 'other';
  if (['path', 'bridleway'].includes(h)) return 'path';
  if (h === 'footway' || h === 'pedestrian' || h === 'steps') return h === 'steps' ? 'steps' : 'footway';
  if (h === 'cycleway') return 'cycleway';
  if (h === 'track') return 'track';
  if (['residential', 'unclassified', 'service', 'living_street'].includes(h)) return 'minor road';
  if (['tertiary', 'secondary', 'primary', 'trunk'].includes(h.replace('_link', ''))) return 'main road';
  return h;
}

const mtbScale = (t) => {
  const v = t && t['mtb:scale'];
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : -1;
};

/** Uphill difficulty 0–5 from average/max grade (mtb:scale:uphill style). */
export function uphillClass(avg, max, tech = 0) {
  const lim = [[10, 15], [15, 20], [20, 25], [25, 30], [30, 40]];
  let c = 5;
  for (let i = 0; i < lim.length; i++) {
    if (avg < lim[i][0] && max < lim[i][1]) { c = i; break; }
  }
  return Math.min(5, c + tech);
}

/** Technical bump for climbing on a given surface / mtb:scale. */
export function techBump(t, grade) {
  if (grade < 6) return 0;
  const s = mtbScale(t);
  if (s >= 3) return 2;
  if (s >= 2) return 1;
  const surf = surfaceOf(t);
  if (grade >= 10 && LOOSE.has(surf) && (t && ['path', 'track', 'bridleway'].includes(t.highway))) return 1;
  return 0;
}

// Heights where the terrain is missing: across a gap, a straight line between the heights
// either side (a step there would read as a cliff); before the first and after the last
// height, level with it. Nothing known: stays NaN.
function fillGaps(arr, along) {
  const n = arr.length;
  let prev = -1;
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(arr[i])) continue;
    if (prev < 0) arr.fill(arr[i], 0, i);
    else {
      const d = along[i] - along[prev];
      for (let k = prev + 1; k < i; k++) arr[k] = arr[prev] + (d > 0 ? ((arr[i] - arr[prev]) * (along[k] - along[prev])) / d : 0);
    }
    prev = i;
  }
  if (prev >= 0) arr.fill(arr[prev], prev + 1);
  return arr;
}

/**
 * @param {{coords:number[][], attrs:object[]}} line  attrs[i] describes coords[i]→coords[i+1]
 * @param {object} opt {activity, craft}
 */
export async function analyse(line, opt) {
  const { coords, attrs } = line;
  const total = coords.reduce((s, c, i) => (i ? s + dist(coords[i - 1], c) : 0), 0);
  const step = total < 20000 ? 10 : total < 80000 ? 25 : 50;
  const { pts, along, src } = densify(coords, step);
  const n = pts.length;
  const z = total < 40000 ? 14 : total < 150000 ? 13 : 12;
  const raw = await elevations(pts, z);
  // where the terrain is missing (a tile that didn't load): estimated, and said so
  const gap = new Uint8Array(n);
  let known = 0;
  for (let i = 0; i < n; i++) if (Number.isFinite(raw[i])) known++; else gap[i] = 1;
  const ele = smooth(fillGaps(raw, along), along, 30);
  const sAttr = src.map((i) => attrs[Math.min(i, attrs.length - 1)] || {});

  // Grades over ±20 m
  const grade = new Float32Array(n);
  let lo = 0, hi = 0;
  for (let i = 0; i < n; i++) {
    while (lo < i && along[i] - along[lo] > 20) lo++;
    while (hi < n - 1 && along[hi] - along[i] < 20) hi++;
    const d = along[hi] - along[lo];
    grade[i] = d > 0 ? ((ele[hi] - ele[lo]) / d) * 100 : 0;
    if (!Number.isFinite(grade[i]) || (sAttr[i].tags && (sAttr[i].tags.route === 'water'))) grade[i] = 0; // no terrain: timed as flat
  }

  // Ascent with a 2 m hysteresis (lidar DEM is clean, so this stays honest).
  // On open water the DEM only wiggles: the reference follows the surface and
  // nothing counts until a carry or the shore.
  const onWater = (i) => sAttr[i].mode === 'water' && !(sAttr[i].tags && sAttr[i].tags.portage);
  let up = 0, down = 0, ref = ele[0];
  for (let i = 1; i < n; i++) {
    if (onWater(i)) { ref = ele[i]; continue; }
    if (ele[i] - ref > 2) { up += ele[i] - ref; ref = ele[i]; }
    else if (ref - ele[i] > 2) { down += ref - ele[i]; ref = ele[i]; }
  }
  let minE = Infinity, maxE = -Infinity;
  for (const e of ele) { if (e < minE) minE = e; if (e > maxE) maxE = e; }
  // no terrain anywhere: the climbing and the heights are unknown, not 0 m
  if (!known) up = down = minE = maxE = NaN;
  // how much of the land has no terrain (on open water it isn't needed)
  let gapM = 0;
  for (let i = 1; i < n; i++) if (gap[i] && !onWater(i)) gapM += along[i] - along[i - 1];

  // Per-sample categories
  const surf = sAttr.map((a) => (a.mode === 'water' ? (a.tags && a.tags.portage ? 'ground' : 'water') : a.mode === 'line' ? 'unknown' : surfaceOf(a.tags)));
  const way = sAttr.map((a) => (a.mode === 'line' ? 'straight line' : wayOf(a.tags || {})));
  const down6 = sAttr.map((a) => mtbScale(a.tags));
  const upCls = new Int8Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const g = grade[i];
    if (g >= 3 && !gap[i]) upCls[i] = uphillClass(g, g, techBump(sAttr[i].tags, g));
  }

  const breakdown = (cats) => {
    const m = new Map();
    for (let i = 1; i < n; i++) m.set(cats[i], (m.get(cats[i]) || 0) + along[i] - along[i - 1]);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const climbs = known ? findClimbs(along, ele, grade, sAttr, pts) : [];
  const warnings = findWarnings(along, grade, sAttr, pts, opt.activity);
  const out = {
    activity: opt.activity,
    pts, along, ele, grade, surf, way, down6, upCls,
    total, up, down, minE, maxE, climbs, warnings,
    // terrain missing on land: how many metres, none at all, and whether a tile didn't load
    // (asked for again later) rather than there being none; eleGap: 1 where it's missing
    terrain: gapM ? { missing: gapM, all: !known, retry: raw.failed > 0 } : null,
    eleGap: gapM ? gap : null,
    surfaces: breakdown(surf),
    ways: breakdown(way),
    attr: sAttr,
    td: trailDetailsOf(coords, attrs, src, along),
  };
  out.trailWarn = trailWarnings(out, opt);
  const t = estimateTime(out, opt);
  out.time = t.total;
  out.tAt = t.tAt;
  return out;
}

function findClimbs(along, ele, grade, sAttr, pts) {
  const out = [];
  const n = ele.length;
  let i = 0;
  while (i < n - 1) {
    // start at a local minimum
    while (i < n - 1 && ele[i + 1] <= ele[i]) i++;
    const start = i;
    let top = i;
    let j = i;
    while (j < n - 1) {
      j++;
      if (ele[j] > ele[top]) top = j;
      const gain = ele[top] - ele[start];
      if (ele[top] - ele[j] > Math.max(6, gain * 0.2)) break;
    }
    const gain = ele[top] - ele[start];
    const len = along[top] - along[start];
    if (gain >= 15 && len >= 120 && gain / len >= 0.03) {
      // steepest 50 m inside
      let max = 0;
      for (let a = start, b = start; a < top; a++) {
        while (b < top && along[b] - along[a] < 50) b++;
        const d = along[b] - along[a];
        if (d >= 30) max = Math.max(max, ((ele[b] - ele[a]) / d) * 100);
      }
      const avg = (gain / len) * 100;
      let tech = 0;
      let osmUp = -1;
      for (let k = start; k < top; k++) {
        tech = Math.max(tech, techBump(sAttr[k].tags, grade[k]));
        const u = sAttr[k].tags && parseInt(sAttr[k].tags['mtb:scale:uphill'], 10);
        if (Number.isFinite(u)) osmUp = Math.max(osmUp, u);
      }
      const cls = osmUp >= 0 ? osmUp : uphillClass(avg, max, tech);
      out.push({ start, end: top, from: along[start], to: along[top], len, gain, avg, max, cls, osm: osmUp >= 0, lngLat: pts[start] });
      i = top;
    } else {
      i = Math.max(top, start + 1);
    }
  }
  return out;
}

function findWarnings(along, grade, sAttr, pts, activity) {
  // each stretch by its own sport (a multisport route: a leg may have its own)
  const sp = (i) => sAttr[i].sport || activity;
  const bikeAt = (i) => groupOf(sp(i)) === 'bike';
  const out = [];
  // osm: a fact from OpenStreetMap's tags (the row can say where to correct it), not from the terrain model
  const pushRun = (test, text, minLen = 0, osm = true) => {
    let s = -1;
    for (let i = 0; i <= along.length; i++) {
      const on = i < along.length && test(i);
      if (on && s < 0) s = i;
      if (!on && s >= 0) {
        const len = along[i - 1] - along[s];
        if (len >= minLen) out.push({ at: along[s], len, text: typeof text === 'function' ? text(s, i - 1) : text, lngLat: pts[s], osm });
        s = -1;
      }
    }
  };
  const t = (i) => sAttr[i].tags || {};
  pushRun((i) => bikeAt(i) && t(i).highway === 'steps', 'Steps — carry the bike');
  pushRun((i) => bikeAt(i) && ['no', 'dismount'].includes(t(i).bicycle), 'Cycling not allowed here');
  pushRun((i) => bikeAt(i) && mtbScale(t(i)) >= 3, (s) => `Technical trail S${mtbScale(t(s))}`);
  pushRun((i) => bikeAt(i) && grade[i] >= 15, (s, e) => `Steep climb, up to ${Math.round(Math.max(...Array.from(grade.slice(s, e + 1))))} %`, 50, false);
  pushRun((i) => bikeAt(i) && grade[i] <= -18, 'Steep descent', 40, false);
  // road tyres: anything that isn't paved, over a stretch worth mentioning
  pushRun((i) => sp(i) === 'road' && sAttr[i].mode !== 'water' && !PAVED.has(surfaceOf(t(i))) && surfaceOf(t(i)) !== 'unknown', (s, e) => `Unpaved for ${Math.round(along[e] - along[s])} m — rough on road tyres`, 150);
  const footAt = (i) => sp(i) === 'hike' || sp(i) === 'trailrun';
  pushRun((i) => footAt(i) && /^(demanding_alpine|difficult_alpine|alpine)/.test(t(i).sac_scale || ''), 'Alpine terrain (SAC T4+)');
  pushRun((i) => footAt(i) && grade[i] >= 25, (s) => (sp(s) === 'trailrun' ? 'Very steep — walk it' : 'Very steep section'), 40, false);
  pushRun((i) => sAttr[i].mode === 'line', 'Straight line — not following paths', 150, false);
  pushRun((i) => t(i).portage === 'yes', (s, e) => `Carry / portage ${Math.round(along[e] - along[s])} m`);
  // ways marked private or closed for the stretch's sport (bikes' "no" has its own row above)
  const marked = (i) => {
    if (sAttr[i].mode === 'water' || sAttr[i].mode === 'line') return null;
    const m = accessOf(t(i), sp(i));
    return m && !(m.tag === 'bicycle=no') ? m : null;
  };
  let s = -1;
  for (let i = 0; i <= along.length; i++) {
    const m = i < along.length ? marked(i) : null, cur = s >= 0 ? marked(s) : null;
    if (cur && (!m || m.tag !== cur.tag)) { out.push(accessRow(cur, along[s], along[i - 1] - along[s], pts[s])); s = -1; }
    if (m && s < 0) s = i;
  }
  pushRun((i) => t(i).route === 'ferry', 'Ferry crossing');
  return out.sort((a, b) => a.at - b.at);
}

// What OpenStreetMap's tags say about going this way in a sport: null (nothing against it),
// or { no, tag } with the tag that says so. The sport's own tag wins over access=*, as in the
// routers: access=no with foot=yes is a footway open to walkers. Only what the map says, never
// what the law is: Finnish mappers keep access=private for factory and military sites, house
// yards and roads closed by a sign, but a private road or an apartment-block yard (open to
// walking and cycling) is sometimes tagged private by mistake.
const OPEN_ACCESS = new Set(['yes', 'designated', 'permissive']);
export function accessOf(tags, sport) {
  if (!tags) return null;
  const mode = groupOf(sport) === 'bike' ? 'bicycle' : 'foot';
  const own = tags[mode];
  if (own === 'no' || own === 'private') return { no: own === 'no', tag: `${mode}=${own}` };
  if (OPEN_ACCESS.has(own)) return null;
  if (tags.access === 'no' || tags.access === 'private') return { no: tags.access === 'no', tag: `access=${tags.access}` };
  return null;
}

// A Heads-up row for a stretch marked private or closed (hidden as one kind, the key it always had)
export function accessRow(m, at, len, lngLat, note, said) {
  const text = said || (!m.no ? 'Marked private in OpenStreetMap' : m.tag === 'foot=no' ? 'Marked no walking in OpenStreetMap' : 'Marked no access in OpenStreetMap');
  const why = !m.no ? 'usually closed: factory and military sites, house yards, roads closed by a sign' : 'closed unless a sign says otherwise';
  return { at, len, text, note: note || `${m.tag} · ${why}`, lngLat, osm: true, hide: 'Private or no access', fix: 'Tagged wrong? Leave a note on OpenStreetMap' };
}

// ---------------------------------------------------------------- trail details along the route
const TRAIL_WAYS = new Set(['path', 'bridleway', 'footway', 'steps']);
const yes = (v) => v != null && v !== 'no';

/**
 * Per sample: is it a trail, its width class and visibility (-2 not a trail,
 * -1 not tagged, else as js/trails.js), overgrown, wet, fallen trees, ford,
 * boardwalk; and the barriers, fallen trees and fords at nodes on the route.
 * From the router's tags; js/trails.js (detailsAlong) fills in what OSM has
 * beyond them (width; fallen trees mapped as points).
 */
function trailDetailsOf(coords, attrs, src, along) {
  const n = src.length;
  const td = {
    trail: new Uint8Array(n), width: new Int8Array(n).fill(-2), vis: new Int8Array(n).fill(-2),
    veg: new Uint8Array(n), mud: new Uint8Array(n), tree: new Uint8Array(n), ford: new Uint8Array(n), boardwalk: new Uint8Array(n),
    points: [],
  };
  for (let i = 0; i < n; i++) {
    const a = attrs[Math.min(src[i], attrs.length - 1)] || {};
    if (a.mode === 'water' || a.mode === 'line') continue;
    const t = a.tags || {};
    const o = String(t.obstacle || '').toLowerCase();
    if (TRAIL_WAYS.has(t.highway)) {
      td.trail[i] = 1;
      td.width[i] = t.width != null ? widthClass(t) : -1;
      td.vis[i] = t.trail_visibility != null ? visClass(t) : -1;
    }
    td.veg[i] = /vegetation/.test(o) ? 1 : 0;
    td.mud[i] = t.surface === 'mud' || /mud/.test(o) ? 1 : 0;
    td.tree[i] = /fallen.?trees?/.test(o) ? 1 : 0;
    td.ford[i] = yes(t.ford) ? 1 : 0;
    td.boardwalk[i] = t.bridge === 'boardwalk' ? 1 : 0;
  }
  // a node at the end of interval k: at the first sample past it
  let i = 0;
  for (let k = 0; k < attrs.length; k++) {
    const t = (attrs[k] && attrs[k].tags) || {};
    if (!t['node:barrier'] && !t['node:ford']) continue;
    const kind = obstacleKind({ barrier: t['node:barrier'], ford: t['node:ford'], access: t['node:access'] });
    if (!kind || kind === 'gate') continue; // ordinary gates are everywhere on forest roads: not a heads-up
    while (i < n - 1 && src[i] <= k) i++;
    td.points.push({ i, at: along[i], ll: coords[k + 1], kind, barrier: t['node:barrier'], ford: t['node:ford'], access: t['node:access'] });
  }
  return td;
}

/** Heads-up items from the trail details: faint, overgrown, wet stretches; fallen trees, barriers, fords. */
export function trailWarnings(a, opt = {}) {
  const td = a.td;
  if (!td) return [];
  const { along, pts } = a;
  // by each stretch's sport: nothing on the water, bike wording on bike legs
  const sp = (i) => (a.attr && a.attr[i] && a.attr[i].sport) || opt.activity;
  if (along.every((_, i) => isWater(sp(i)))) return [];
  const out = [];
  const m = (s, e) => `${Math.round(along[e] - along[s])} m`;
  const run = (test, minLen, text, icon = null) => {
    let s = -1;
    for (let i = 0; i <= along.length; i++) {
      const on = i < along.length && !isWater(sp(i)) && test(i);
      if (on && s < 0) s = i;
      if (!on && s >= 0) {
        const len = along[i - 1] - along[s];
        if (len >= minLen) out.push({ at: along[s], len, text: text(s, i - 1), lngLat: pts[s], kind: 'trail', icon, osm: true });
        s = -1;
      }
    }
  };
  run((i) => td.vis[i] >= 2, 100, (s, e) => `${td.vis.slice(s, e + 1).some((v) => v >= 3) ? 'Barely visible path' : 'Hard to follow'} for ${m(s, e)}`);
  run((i) => td.veg[i], 100, (s, e) => `Overgrown for ${m(s, e)}`);
  run((i) => td.mud[i], 50, (s, e) => `Wet or muddy for ${m(s, e)}`);
  run((i) => td.tree[i], 0, () => 'Fallen trees on the trail', 'td-tree');
  run((i) => td.ford[i], 0, () => 'Ford: no bridge', 'td-ford');
  if (opt.wet) run((i) => td.boardwalk[i], 100, (s, e) => `Boardwalk for ${m(s, e)}: slippery when wet`);
  for (const p of td.points) {
    if (isWater(sp(p.i))) continue;
    const { title, note } = obstacleText(p, groupOf(sp(p.i)) === 'bike');
    out.push({ at: p.at, len: 0, text: title, note, lngLat: p.ll || pts[p.i], kind: 'trail', icon: `td-${p.kind}`, group: p.kind, osm: p.osm ? { type: 'node', id: p.osm } : true });
  }
  return out.sort((x, y) => x.at - y.at);
}

// Bikes: flat speed (km/h) on paved, unpaved and trail, climbing rate (m/h),
// and the top speed downhill on trails and roads. The MTB trail speed gains
// 1.5 km/h for each step below S2 (smooth trails roll faster).
const BIKE = {
  mtb: { paved: 20, unpaved: 16, trail: 11, vam: 600, down: [16, 35], mtbScale: true },
  gravel: { paved: 25, unpaved: 20, trail: 12, vam: 700, down: [16, 35] },
  road: { paved: 27, unpaved: 15, trail: 8, vam: 800, down: [14, 50] },
};
// Running: flat speed (km/h) on paved and on trail, adjusted for the gradient
// by the metabolic cost of running uphill and downhill (Minetti et al. 2002).
// Trail runners walk the steep bits: never slower than a brisk hike there.
const RUN = {
  run: { paved: 10.5, trail: 9.5 },
  trailrun: { paved: 10, trail: 8.5, hikeFloor: true },
};
const runCost = (i) => 155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6;
const gradeFactor = (g) => Math.max(0.3, Math.min(1.12, 3.6 / runCost(Math.max(-0.4, Math.min(0.4, g)))));
const tobler = (g) => 6 * Math.exp(-3.5 * Math.abs(g + 0.05));
const TOBLER_FLAT = tobler(0); // ≈ 5.04 km/h: "walking speed on the flat" scales the curve
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && Number.isFinite(o[k])).map((k) => [k, o[k]]));

/** What a stretch is for the time breakdown: paved / unpaved / trail / water / carry. */
export function surfaceClass(a, i) {
  const at = a.attr[i] || {};
  const tags = at.tags || {};
  if (tags.portage) return 'carry';
  if (at.mode === 'water' || tags.route === 'water') return 'water';
  if (['path', 'bridleway', 'footway', 'steps'].includes(tags.highway)) return 'trail';
  return PAVED.has(a.surf[i]) ? 'paved' : a.surf[i] === 'unknown' ? 'paved' : 'unpaved';
}

/**
 * Moving time per sample. With `head` (headwind component in m/s per sample,
 * negative = tailwind) the pace is adjusted for wind, which matters a lot on a
 * bike or in a kayak and a little on foot.
 * @returns {{total:number, tAt:Float32Array}} tAt = seconds from start at each sample
 */
// `snow` (phase 15b): { cm: snow on the ground per sample, cls: each sample's winter class or null },
// which slows land stretches by winter.js snowFactor (water and carries aren't changed).
export function estimateTime(a, opt, head = null, snow = null) {
  const { along, grade, surf } = a;
  const sAttr = a.attr;
  // each stretch at its own sport's speeds (opt.speedsBy: { sport: speeds } for a multisport route)
  const sportAt = (i) => sAttr[i].sport || opt.activity;
  const speedsOf = (sp) => (opt.speedsBy && opt.speedsBy[sp]) || (sp === opt.activity ? opt.speeds : null);
  const tAt = new Float32Array(along.length);
  const windAdj = (kmh, i, k, lo, hi) => {
    if (!head) return kmh;
    return Math.max(kmh * lo, Math.min(kmh * hi, kmh - k * head[i]));
  };
  let secs = 0;
  const slow = (i, way, how) => (snow && snow.cm ? snowFactor(snow.cm[i], way, snow.cls ? snow.cls[i] : null, how) : 1);
  for (let i = 1; i < along.length; i++) {
    const d = along[i] - along[i - 1];
    const g = grade[i] / 100;
    const at = sAttr[i];
    const tags = at.tags || {};
    let kmh;
    const act = sportAt(i), sps = speedsOf(act);
    // the user's speeds (speeds.js) over the model's own numbers
    const bike = BIKE[act] && { ...BIKE[act], ...pick(sps, ['paved', 'unpaved', 'trail', 'vam']) };
    const run = RUN[act] && { ...RUN[act], ...pick(sps, ['paved', 'trail']) };
    if (at.mode === 'water' || tags.route === 'water') {
      if (act === 'swim') kmh = tags.portage ? tobler(g) : windAdj((sps && sps.swim) || 2.5, i, 0.05, 0.6, 1.1);
      else {
        const craftKmh = (sps && sps[opt.craft]) || (CRAFT[opt.craft] || CRAFT.kayak).kmh;
        kmh = tags.portage ? 2.5 : windAdj(craftKmh, i, 0.35, 0.25, 1.35);
      }
    } else if (run) {
      const trail = ['path', 'bridleway', 'track'].includes(tags.highway) || !PAVED.has(surf[i]);
      kmh = (trail ? run.trail : run.paved) * gradeFactor(g);
      if (run.hikeFloor && g > 0.08) kmh = Math.max(kmh, tobler(g) * 1.15); // power-hike the steep bits
      kmh = windAdj(kmh, i, 0.1, 0.85, 1.05) * slow(i, trail ? 'trail' : 'paved', 'foot');
    } else if (bike) {
      const s = surf[i];
      const trail = ['path', 'bridleway', 'footway'].includes(tags.highway);
      let flat = PAVED.has(s) ? bike.paved : trail ? bike.trail + (bike.mtbScale ? Math.max(0, 2 - mtbScale(tags)) * 1.5 : 0) : bike.unpaved;
      // ~1.2 km/h slower per m/s of headwind in the open, less on sheltered trails
      flat = windAdj(flat, i, trail ? 0.5 : 1.2, 0.45, 1.3);
      const f = slow(i, PAVED.has(s) ? 'paved' : trail ? 'trail' : 'unpaved', 'bike');
      if (g > 0.01) {
        secs += Math.max(d / (flat / 3.6), (d * g) / (bike.vam / 3600)) / f;
        tAt[i] = secs;
        continue;
      }
      kmh = (g < -0.03 ? Math.min(flat * 1.25, trail ? bike.down[0] : bike.down[1]) : flat) * f;
    } else {
      // walking (hike, and carries / land legs when paddling)
      kmh = tobler(g) * (act === 'hike' && sps && sps.walk ? sps.walk / TOBLER_FLAT : 1);
      if (['path', 'bridleway'].includes(tags.highway)) kmh *= 0.88;
      kmh = windAdj(kmh, i, 0.06, 0.8, 1.08) * slow(i, ['path', 'bridleway'].includes(tags.highway) ? 'trail' : PAVED.has(surf[i]) ? 'paved' : 'unpaved', 'foot');
    }
    secs += d / (Math.max(kmh, 0.5) / 3.6);
    tAt[i] = secs;
  }
  return { total: secs, tAt };
}

/**
 * Distance and moving time per sport, in the order the route meets them
 * (a sport that comes back is counted together), for a multisport summary.
 */
export function sportSplit(a, tAt, fallback, waitAt = null) {
  const by = new Map();
  for (let i = 1; i < a.along.length; i++) {
    const sp = (a.attr[i] && a.attr[i].sport) || fallback;
    const v = by.get(sp) || { sport: sp, dist: 0, time: 0 };
    v.dist += a.along[i] - a.along[i - 1];
    v.time += tAt[i] - tAt[i - 1] - (waitAt ? waitAt[i] : 0); // moving time: not the changeovers
    by.set(sp, v);
  }
  return [...by.values()];
}
