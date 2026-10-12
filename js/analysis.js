// Route analysis: elevation profile from the lidar DEM, grades, climbs with an
// uphill-difficulty grade, surface / way-type breakdown, warnings and timing.

import { densify, dist, bearing } from './geo.js';
import { elevations, smooth } from './dem.js';
import { CRAFT } from './config.js';

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

  // Ascent with a 2 m hysteresis (lidar DEM is clean, so this stays honest)
  let up = 0, down = 0, ref = ele[0];
  for (let i = 1; i < n; i++) {
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
  const time = estimateTime(along, grade, sAttr, surf, opt);

  return {
    activity: opt.activity,
    pts, along, ele, grade, surf, way, down6, upCls,
    total, up, down, minE, maxE, time, climbs, warnings,
    surfaces: breakdown(surf),
    ways: breakdown(way),
  };
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
  const bike = activity === 'mtb' || activity === 'gravel';
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
  } else if (activity === 'hike') {
    pushRun((i) => /^(demanding_alpine|difficult_alpine|alpine)/.test(t(i).sac_scale || ''), 'Alpine terrain (SAC T4+)');
    pushRun((i) => grade[i] >= 25, 'Very steep section', 40);
  }
  pushRun((i) => sAttr[i].mode === 'line', 'Straight line — not following paths', 150);
  pushRun((i) => t(i).portage === 'yes', (s, e) => `Carry / portage ${Math.round(along[e] - along[s])} m`);
  pushRun((i) => ['private', 'no'].includes(t(i).access), 'Private or no access');
  pushRun((i) => t(i).route === 'ferry', 'Ferry crossing');
  return out.sort((a, b) => a.at - b.at);
}

function estimateTime(along, grade, sAttr, surf, opt) {
  const a = opt.activity;
  let secs = 0;
  for (let i = 1; i < along.length; i++) {
    const d = along[i] - along[i - 1];
    const g = grade[i] / 100;
    const at = sAttr[i];
    const tags = at.tags || {};
    let kmh;
    if (at.mode === 'water' || tags.route === 'water') {
      kmh = tags.portage ? 2.5 : (CRAFT[opt.craft] || CRAFT.kayak).kmh;
    } else if (a === 'hike' || a === 'paddle') {
      kmh = 6 * Math.exp(-3.5 * Math.abs(g + 0.05)); // Tobler
      if (['path', 'bridleway'].includes(tags.highway)) kmh *= 0.88;
    } else {
      const s = surf[i];
      const trail = ['path', 'bridleway', 'footway'].includes(tags.highway);
      const flat = a === 'gravel'
        ? (PAVED.has(s) ? 25 : trail ? 12 : 20)
        : (PAVED.has(s) ? 20 : trail ? 11 + Math.max(0, 2 - mtbScale(tags)) * 1.5 : 16);
      const vam = a === 'gravel' ? 700 : 600; // vertical metres per hour when climbing
      if (g > 0.01) {
        const tFlat = d / (flat / 3.6);
        const tClimb = (d * g) / (vam / 3600);
        secs += Math.max(tFlat, tClimb);
        continue;
      }
      kmh = g < -0.03 ? Math.min(flat * 1.25, trail ? 16 : 35) : flat;
    }
    secs += d / (Math.max(kmh, 0.5) / 3.6);
  }
  return secs;
}

/** Wind exposure along the route: share of distance with head/cross/tail wind. */
export function windExposure(pts, along, windFromDeg) {
  let head = 0, cross = 0, tail = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = along[i] - along[i - 1];
    const heading = bearing(pts[i - 1], pts[i]);
    let diff = Math.abs(((heading - windFromDeg + 540) % 360) - 180); // 180 = wind from behind
    if (diff < 45) head += d; else if (diff > 135) tail += d; else cross += d;
  }
  const t = head + cross + tail || 1;
  return { head: head / t, cross: cross / t, tail: tail / t };
}
