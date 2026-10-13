// Route analysis: elevation profile from the lidar DEM, grades, climbs with an
// uphill-difficulty grade, surface / way-type breakdown, warnings and timing.

import { densify, dist } from './geo.js';
import { elevations, smooth } from './dem.js';
import { CRAFT, groupOf } from './config.js';

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

function fillGaps(arr) {
  let last = NaN;
  for (let i = 0; i < arr.length; i++) {
    if (Number.isFinite(arr[i])) last = arr[i];
    else if (Number.isFinite(last)) arr[i] = last;
  }
  last = NaN;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (Number.isFinite(arr[i])) last = arr[i];
    else if (Number.isFinite(last)) arr[i] = last;
  }
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
  const raw = fillGaps(await elevations(pts, z));
  const ele = smooth(raw, along, 30);
  const sAttr = src.map((i) => attrs[Math.min(i, attrs.length - 1)] || {});

  // Grades over ±20 m
  const grade = new Float32Array(n);
  let lo = 0, hi = 0;
  for (let i = 0; i < n; i++) {
    while (lo < i && along[i] - along[lo] > 20) lo++;
    while (hi < n - 1 && along[hi] - along[i] < 20) hi++;
    const d = along[hi] - along[lo];
    grade[i] = d > 0 ? ((ele[hi] - ele[lo]) / d) * 100 : 0;
    if (sAttr[i].tags && (sAttr[i].tags.route === 'water')) grade[i] = 0;
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

  // Per-sample categories
  const surf = sAttr.map((a) => (a.mode === 'water' ? (a.tags && a.tags.portage ? 'ground' : 'water') : a.mode === 'line' ? 'unknown' : surfaceOf(a.tags)));
  const way = sAttr.map((a) => (a.mode === 'line' ? 'straight line' : wayOf(a.tags || {})));
  const down6 = sAttr.map((a) => mtbScale(a.tags));
  const upCls = new Int8Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const g = grade[i];
    if (g >= 3) upCls[i] = uphillClass(g, g, techBump(sAttr[i].tags, g));
  }

  const breakdown = (cats) => {
    const m = new Map();
    for (let i = 1; i < n; i++) m.set(cats[i], (m.get(cats[i]) || 0) + along[i] - along[i - 1]);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const climbs = findClimbs(along, ele, grade, sAttr, pts);
  const warnings = findWarnings(along, grade, sAttr, pts, opt.activity);
  const out = {
    activity: opt.activity,
    pts, along, ele, grade, surf, way, down6, upCls,
    total, up, down, minE, maxE, climbs, warnings,
    surfaces: breakdown(surf),
    ways: breakdown(way),
    attr: sAttr,
  };
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
  const bike = groupOf(activity) === 'bike';
  const out = [];
  const pushRun = (test, text, minLen = 0) => {
    let s = -1;
    for (let i = 0; i <= along.length; i++) {
      const on = i < along.length && test(i);
      if (on && s < 0) s = i;
      if (!on && s >= 0) {
        const len = along[i - 1] - along[s];
        if (len >= minLen) out.push({ at: along[s], len, text: typeof text === 'function' ? text(s, i - 1) : text, lngLat: pts[s] });
        s = -1;
      }
    }
  };
  const t = (i) => sAttr[i].tags || {};
  if (bike) {
    pushRun((i) => t(i).highway === 'steps', 'Steps — carry the bike');
    pushRun((i) => ['no', 'dismount'].includes(t(i).bicycle), 'Cycling not allowed here');
    pushRun((i) => mtbScale(t(i)) >= 3, (s) => `Technical trail S${mtbScale(t(s))}`);
    pushRun((i) => grade[i] >= 15, (s, e) => `Steep climb, up to ${Math.round(Math.max(...Array.from(grade.slice(s, e + 1))))} %`, 50);
    pushRun((i) => grade[i] <= -18, 'Steep descent', 40);
    // road tyres: anything that isn't paved, over a stretch worth mentioning
    if (activity === 'road') pushRun((i) => sAttr[i].mode !== 'water' && !PAVED.has(surfaceOf(t(i))) && surfaceOf(t(i)) !== 'unknown', (s, e) => `Unpaved for ${Math.round(along[e] - along[s])} m — rough on road tyres`, 150);
  } else if (activity === 'hike' || activity === 'trailrun') {
    pushRun((i) => /^(demanding_alpine|difficult_alpine|alpine)/.test(t(i).sac_scale || ''), 'Alpine terrain (SAC T4+)');
    pushRun((i) => grade[i] >= 25, activity === 'trailrun' ? 'Very steep — walk it' : 'Very steep section', 40);
  }
  pushRun((i) => sAttr[i].mode === 'line', 'Straight line — not following paths', 150);
  pushRun((i) => t(i).portage === 'yes', (s, e) => `Carry / portage ${Math.round(along[e] - along[s])} m`);
  pushRun((i) => ['private', 'no'].includes(t(i).access), 'Private or no access');
  pushRun((i) => t(i).route === 'ferry', 'Ferry crossing');
  return out.sort((a, b) => a.at - b.at);
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
export function estimateTime(a, opt, head = null) {
  const { along, grade, surf } = a;
  const sAttr = a.attr;
  const act = opt.activity;
  const tAt = new Float32Array(along.length);
  const windAdj = (kmh, i, k, lo, hi) => {
    if (!head) return kmh;
    return Math.max(kmh * lo, Math.min(kmh * hi, kmh - k * head[i]));
  };
  let secs = 0;
  for (let i = 1; i < along.length; i++) {
    const d = along[i] - along[i - 1];
    const g = grade[i] / 100;
    const at = sAttr[i];
    const tags = at.tags || {};
    let kmh;
    // the user's speeds (speeds.js) over the model's own numbers
    const bike = BIKE[act] && { ...BIKE[act], ...pick(opt.speeds, ['paved', 'unpaved', 'trail', 'vam']) };
    const run = RUN[act] && { ...RUN[act], ...pick(opt.speeds, ['paved', 'trail']) };
    if (at.mode === 'water' || tags.route === 'water') {
      const craftKmh = (act === 'paddle' && opt.speeds && opt.speeds[opt.craft]) || (CRAFT[opt.craft] || CRAFT.kayak).kmh;
      kmh = tags.portage ? 2.5 : windAdj(craftKmh, i, 0.35, 0.25, 1.35);
    } else if (run) {
      const trail = ['path', 'bridleway', 'track'].includes(tags.highway) || !PAVED.has(surf[i]);
      kmh = (trail ? run.trail : run.paved) * gradeFactor(g);
      if (run.hikeFloor && g > 0.08) kmh = Math.max(kmh, tobler(g) * 1.15); // power-hike the steep bits
      kmh = windAdj(kmh, i, 0.1, 0.85, 1.05);
    } else if (bike) {
      const s = surf[i];
      const trail = ['path', 'bridleway', 'footway'].includes(tags.highway);
      let flat = PAVED.has(s) ? bike.paved : trail ? bike.trail + (bike.mtbScale ? Math.max(0, 2 - mtbScale(tags)) * 1.5 : 0) : bike.unpaved;
      // ~1.2 km/h slower per m/s of headwind in the open, less on sheltered trails
      flat = windAdj(flat, i, trail ? 0.5 : 1.2, 0.45, 1.3);
      if (g > 0.01) {
        secs += Math.max(d / (flat / 3.6), (d * g) / (bike.vam / 3600));
        tAt[i] = secs;
        continue;
      }
      kmh = g < -0.03 ? Math.min(flat * 1.25, trail ? bike.down[0] : bike.down[1]) : flat;
    } else {
      // walking (hike, and carries / land legs when paddling)
      kmh = tobler(g) * (act === 'hike' && opt.speeds && opt.speeds.walk ? opt.speeds.walk / TOBLER_FLAT : 1);
      if (['path', 'bridleway'].includes(tags.highway)) kmh *= 0.88;
      kmh = windAdj(kmh, i, 0.06, 0.8, 1.08);
    }
    secs += d / (Math.max(kmh, 0.5) / 3.6);
    tAt[i] = secs;
  }
  return { total: secs, tAt };
}
