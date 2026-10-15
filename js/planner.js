// Route planner: waypoints, per-leg routing modes, undo/redo, the bottom sheet
// with stats, elevation profile, climbs, warnings and (for paddling) wind.

import { ACTIVITIES, CRAFT, DIFF_COLORS, UPHILL_TEXT, SURFACE_COLORS, GRADE_BANDS, MTB_SCALE_TEXT, OFFROAD_BIKE, gradeColor, groupOf, isWater, SPORT_COLORS } from './config.js';
import { routeLeg, routeRun, routeLoop, routerHeadroom } from './router.js';
import { roundTripSports, radiusFor, reach, waterOf, plan, planWater, nearestWater, waterLoop, resize, twiceShare, score as loopScore, distanceForTime } from './roundtrip.js';
import { analyse, estimateTime, surfaceClass, trailWarnings, sportSplit } from './analysis.js';
import { detailsAlong } from './trails.js';
import { iconUrl } from './icons.js';
import { speedsFor, speedSummary, renderSpeedEditor, pace } from './speeds.js';
import { ProfileChart, COLOR_MODES, COLOR_GROUPS, WAY_COLORS, TRAIL_SCALES, colorAt, routeReadout } from './chart.js';
import { dist, encodePolyline, decodePolyline, fmtDist, fmtDuration, compass, bbox, nearestOnLine, simplify, lineLength } from './geo.js';
import { lipasPlace, stitch, clipAlong } from './lipas.js';
import { onWaterData, prefetchWater } from './waterdata.js';
import { sunTimes, darkness } from './sun.js';
import { winterAlong, windChill, WINTER_TEXT } from './winter.js';
import { isNight, restSec, stopLabel, cleanStop, encodeStops, decodeStops, tripDays, dayWeather, gearChecks, GEAR, staysNear, DEFAULT_BREAK, DEFAULT_ON, hhmm, parseHhmm } from './stops.js';
import { toGPX, download } from './gpx.js';
import { windAlong, windClass, windRating, WIND_CLASSES, TEMP_BANDS, tempBand, RAIN_BANDS, rainBand, recentRain, pointForecasts, sampleAt } from './weather.js';
import { icon, h, $, toast, store, escapeHtml, popMenu } from './ui.js';
import { keepInView } from './inspect.js';
import { FIX_THE_MAP } from './valhalla.js';
import { initNames } from './names.js';
import { STYLES, routerOf, valuesOf, styleName, defaultStyle, encodeStyle, decodeStyle, hasWet, isCustom } from './styles.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
const MODE_LABEL = { auto: 'Follow paths', line: 'Straight line', water: 'Over water' };
const MODE_ICON = { auto: 'auto', line: 'straight', water: 'water' };
const MODE_SHORT = { auto: 'Follow', line: 'Straight', water: 'Water' };
// a leg waits this long for a BRouter slot before Valhalla routes it instead (router.js)
const STAND_IN_AFTER = 6000;
// round trips: lengths to pick from per sport, the candidates' colours, and how many calls they may take
const LOOP_PRESETS = {
  mtb: { km: [10, 20, 30, 50], min: [60, 90, 120, 180] }, gravel: { km: [25, 40, 60, 90], min: [60, 120, 180, 240] },
  road: { km: [30, 50, 80, 120], min: [60, 120, 180, 240] }, hike: { km: [5, 10, 15, 20], min: [60, 120, 180, 240] },
  trailrun: { km: [5, 10, 15, 25], min: [30, 60, 90, 120] }, run: { km: [5, 8, 10, 15], min: [30, 45, 60, 90] },
  paddle: { km: [5, 10, 15, 25], min: [60, 120, 180, 240] }, swim: { km: [1, 2, 3, 5], min: [30, 45, 60, 90] },
};
// up to nine loops ("More loops" makes three at a time): a letter and a colour each
const LOOP_COLORS = ['#2563eb', '#ea580c', '#9333ea', '#0d9488', '#db2777', '#65a30d', '#0891b2', '#b45309', '#4f46e5'];
const LOOP_LETTERS = 'ABCDEFGHI';
const LOOP_MAX = 9;
const LOOP_CALLS = 6; // per generation
const LOOP_CAP = 5; // generations per 10 minutes
// bottom sheet sizes: the summary, + the elevation profile, half the screen, nearly all of it
const SHEET_STATES = ['peek', 'profile', 'half', 'full'];
// where the planner sits on a wide screen: on the left, unless you moved it to the bottom
export const dockOf = () => store.get('plannerDock', 'left');
// The drawer's tabs (22a): drawing, what's on the way, setting off. Each section lives in one.
const TABS = [
  { id: 'route', label: 'Route', icon: 'route', title: 'Draw and change the route: points, legs, round trips, how you go' },
  { id: 'check', label: 'Check', icon: 'warn', title: 'What’s on the way: heads-up, climbs, the ground' },
  { id: 'go', label: 'Go', icon: 'clock', title: 'When and how long, the weather, taking it along' },
];
const TAB_OF = { loop: 'route', points: 'route', style: 'route', warnings: 'check', climbs: 'check', colours: 'check', onmap: 'check', speed: 'go', depart: 'go', take: 'go' };
// "wet ground: auto" turns on after this much rain in the last 24 hours (mm)
const WET_MM = 3;
const MODE_CODE = { auto: 'a', line: 'l', water: 'w', fixed: 'a' };
const CODE_MODE = { a: 'auto', l: 'line', w: 'water' };
// a leg's own sport in share links (s=): one letter per leg, '-' for the route's
const SPORT_CODE = { mtb: 'm', gravel: 'g', road: 'r', hike: 'h', trailrun: 't', run: 'u', paddle: 'p', swim: 's' };
const CODE_SPORT = Object.fromEntries(Object.entries(SPORT_CODE).map(([k, v]) => [v, k]));

// Minutes to change from one sport to the next, before you set your own: lock or
// load the bike, launch or land the boat, wetsuit on or off.
export function changeoverMin(a, b) {
  if (a === b) return 0;
  const ga = groupOf(a), gb = groupOf(b);
  if (ga === gb) return ga === 'water' ? 5 : 2; // paddle ↔ swim; one bike for another
  const pair = new Set([a, b]);
  if (pair.has('swim')) return pair.has('run') || pair.has('trailrun') ? 1 : ga === 'bike' || gb === 'bike' ? 3 : 5; // swimrun, triathlon
  if (ga === 'water' || gb === 'water') return ga === 'bike' || gb === 'bike' ? 15 : 10; // the boat in or out
  return 5; // bike ↔ on foot
}

async function pool(jobs, n) {
  const queue = jobs.slice();
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    while (queue.length) await queue.shift()();
  }));
}

// A tiny strip of each colour mode's colours, for the header's colour button.
const SWATCH = {
  plain: ['#e11d48', '#e11d48'],
  grade: ['#3b82f6', '#8fb996', '#facc15', '#f97316', '#dc2626'],
  uphill: DIFF_COLORS.slice(0, 5), down: DIFF_COLORS.slice(0, 5), both: DIFF_COLORS.slice(0, 5),
  surface: ['#64748b', '#d4a017', '#8b5e34'],
  way: [WAY_COLORS.cycleway, WAY_COLORS.track, WAY_COLORS.path],
  width: TRAIL_SCALES.width.colors.slice(2), vis: TRAIL_SCALES.vis.colors.slice(2),
  wind: WIND_CLASSES.map((c) => c.color), temp: TEMP_BANDS.slice(1, 7).map((b) => b.color), rain: RAIN_BANDS.slice(1).map((b) => b.color),
};
const swatchOf = (k) => `linear-gradient(90deg, ${(SWATCH[k] || SWATCH.plain).join(', ')})`;

// Trail obstacles that repeat (three fallen trees…) become one heads-up row.
const GROUP_TEXT = { tree: 'Fallen trees and logs', stile: 'Stiles and kissing gates', cycle: 'Cycle barriers', 'gate-no': 'Gates with no access', ford: 'Fords' };
function groupTrail(list) {
  const by = new Map();
  for (const w of list) if (w.group) by.set(w.group, [...(by.get(w.group) || []), w]);
  const out = list.filter((w) => !w.group || by.get(w.group).length < 3);
  for (const [g, items] of by) {
    if (items.length < 3) continue;
    out.push({ at: items[0].at, len: 0, text: `${GROUP_TEXT[g] || items[0].text} ×${items.length}`, note: items[0].note, kind: 'trail', icon: items[0].icon, lngLat: items[0].lngLat, items, osm: items[0].osm });
  }
  return out;
}

// Heads-up kinds you can hide (the ⋯ on a row): by the row's own key, its obstacle icon or its
// kind, else the start of its text ("Wet or muddy", "Snow on the way", "Steep climb").
const HIDE_LABEL = { ...GROUP_TEXT, gate: 'Gates', dark: 'Darkness and twilight', roadwork: 'Road works', incident: 'Traffic incidents', roadcond: 'Road conditions', busy: 'Busy roads', gear: 'Gear left behind' };
function hideKind(w) {
  if (w.noHide) return null;
  const key = w.hide || (w.icon && w.icon.startsWith('td-') ? w.icon.slice(3) : null) || (HIDE_LABEL[w.kind] ? w.kind : null)
    || w.text.split(/ — |[:(,×]| for | up to | S\d| \d/)[0].trim();
  return key ? { key, label: HIDE_LABEL[key] || key } : null;
}
const hiddenKinds = () => store.get('hideWarn', {}); // { key: label }
// "Not right?": a note on OpenStreetMap at the place asks its mappers to look; fixing the
// map yourself needs an OpenStreetMap account
const osmNote = ([lon, lat]) => `https://www.openstreetmap.org/note/new#map=19/${lat.toFixed(6)}/${lon.toFixed(6)}`;

export class Planner {
  constructor(map, app) {
    this.map = map;
    this.app = app; // { activity(), setData(id, fc), onActiveChange(bool) }
    this.points = [];
    this.legs = [];
    this.mode = ACTIVITIES[app.activity()].mode;
    this.craft = store.get('craft', 'kayak');
    this.past = [];
    this.future = [];
    this.active = false;
    this.markers = [];
    this.ghosts = []; // drag handles in the middle of each leg
    this.pname = new WeakMap(); // point → the name you gave it (points move as arrays, so names follow them)
    this.pchange = new WeakMap(); // point → your changeover minutes there (where the sport changes)
    this.pstop = new WeakMap(); // point → a stop there: { min } a break, { on } a night (go on at that minute of the day)
    this.pcarry = new WeakMap(); // point → true: the gear of the sport you change out of there goes along
    this.marks = { km: true, time: false, ...store.get('routeMarks', {}) }; // distance marks on the route, and the times at them
    this.loop = { open: false, start: null, mode: 'km', km: null, min: null, dir: null, results: [], on: 0, busy: false, spin: 0, gens: [] }; // round trips
    this.openLegs = new Set(); // waypoint rows whose leg settings are open (by point index)
    this.roads = initNames(map); // road and path names from the loaded tiles
    this.style = this.savedStyle(app.activity()); // the route's style; a leg may have its own (leg.style)
    this.styleLeg = null; // the leg the Route style section edits (null: the whole route)
    this.wet = { mm: null, on: false, at: null }; // rain in the last 24 h at the start, for "wet ground: auto"
    this.edit = null; // a drag in progress (see beginEdit)
    this.noClickUntil = 0;
    this.analysis = null;
    this.colorMode = store.get('colorMode', 'grade');
    this.colorOnMap = store.get('colorOnMap', false);
    this.startOffsetH = 0; // departure: hours from now
    this.nogos = []; // places to avoid: [{ll, r, label}]
    this.gen = 0;
    this.selected = null;
    this.panel = $('#planner');
    this.buildPanel();
    this.chart = new ProfileChart($('#profile-canvas'), $('#profile-tip'));
    this.chart.onHover = (i) => this.hoverAt(i);
    this.chart.nameAt = (i) => this.roadAt(i);
    this.chart.onClick = (i) => this.analysis && this.map.easeTo({ center: this.analysis.pts[i], duration: 500 });
    // zooming the profile frames that stretch on the map (zooming out: the whole route)
    this.chart.onZoom = (v) => {
      const a = this.analysis;
      if (!a) return;
      const [i0, i1] = v ? [this.chart.idxOfDist(v[0]), this.chart.idxOfDist(v[1])] : [0, a.pts.length - 1];
      const b = bbox(a.pts.slice(i0, i1 + 1));
      this.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: this.viewPadding(), maxZoom: 16, duration: 600 });
    };
    map.on('click', (e) => this.onMapClick(e));
    map.on('mousemove', (e) => this.onMapMove(e));
    map.on('touchstart', () => { this.lastTouchAt = Date.now(); });
    // was a menu or card open when this press began? (MapLibre closes it on the click; the click shouldn't add a point too)
    const pressed = () => { this.popupAtPress = !!this.map.getContainer().querySelector('.maplibregl-popup:not(.start-tip)'); };
    map.on('mousedown', pressed);
    map.on('touchstart', pressed);
    map.on('mousedown', 'route-casing', (e) => this.onLinePress(e));
    map.on('touchstart', 'route-casing', (e) => this.onLinePress(e));
    map.on('zoom', () => this.fitGhosts());
    // a source the water router waited for in vain has answered: route those legs again
    onWaterData(() => {
      let again = false;
      for (const l of this.legs) if (l.mode === 'water' && l.result && l.result.water && l.result.water.missing.length) { l.key = null; again = true; }
      if (again) this.routeAll();
    });
    // names of roads come with the tiles: when new ones arrive, the list may know more
    map.on('idle', () => {
      if (!this.active || !this.points.length) return;
      const names = this.points.map((_, i) => this.autoName(i)).join('|');
      if (names !== this.shownNames) this.renderWaypoints();
    });
    this.bindSpotMenu();
  }

  // ---------------------------------------------------------------- state
  snapshot() {
    return {
      points: this.points.map((p) => p.slice()),
      names: this.points.map((p) => this.pname.get(p) || ''),
      changes: this.points.map((p) => this.pchange.get(p) ?? null),
      stops: this.points.map((p) => this.pstop.get(p) || null),
      carry: this.points.map((p) => !!this.pcarry.get(p)),
      legs: this.legs.map((l) => ({ mode: l.mode, result: l.result, key: l.key, status: l.status, style: l.style, src: l.src, sport: l.sport })),
      nogos: this.nogos.map((n) => ({ ...n })),
      routeName: this.routeName || '',
      style: this.style,
    };
  }
  commit() {
    this.past.push(this.snapshot());
    if (this.past.length > 100) this.past.shift();
    this.future = [];
  }
  restoreSnap(s) {
    this.points = s.points;
    this.nameAll(s.names);
    this.changeAll(s.changes);
    this.stopAll(s.stops);
    this.carryAll(s.carry);
    this.legs = s.legs.map((l) => ({ ...l }));
    this.nogos = s.nogos || [];
    this.routeName = s.routeName || '';
    if (s.style) this.style = s.style;
    this.update();
  }

  // ---------------------------------------------------------------- waypoint names & order
  nameAll(names) { this.points.forEach((p, i) => { if (names && names[i]) this.pname.set(p, names[i]); else this.pname.delete(p); }); }
  changeAll(list) { this.points.forEach((p, i) => { if (list && list[i] != null) this.pchange.set(p, list[i]); else this.pchange.delete(p); }); }
  stopAll(list) { this.points.forEach((p, i) => { const st = cleanStop(list && list[i]); if (st) this.pstop.set(p, st); else this.pstop.delete(p); }); }
  carryAll(list) { this.points.forEach((p, i) => { if (list && list[i]) this.pcarry.set(p, true); else this.pcarry.delete(p); }); }

  // ---------------------------------------------------------------- a sport per leg (multisport)
  // A leg's own sport, else the route's. A water leg in a land sport has always
  // been paddled (its time, its router), so it counts as Paddle.
  legSport(i) {
    const leg = this.legs[i], route = this.app.activity();
    if (!leg) return route;
    if (leg.sport) return leg.sport;
    return leg.mode === 'water' && !isWater(route) ? 'paddle' : route;
  }
  isMulti() { return this.routeSports().length > 1; }
  sportIcon(sp) { const x = this.app.sports && this.app.sports().find((y) => y.k === sp); return (x && x.icon) || 'route'; }
  // the sports in the route, in order (each once)
  routeSports() { return [...new Set(this.legs.map((_, i) => this.legSport(i)))]; }

  // Is point i a changeover (the sport changes there)? Its minutes: yours, or the usual for the pair.
  changeAt(i) {
    if (i <= 0 || i >= this.legs.length) return null;
    const from = this.legSport(i - 1), to = this.legSport(i);
    if (from === to) return null;
    const own = this.pchange.get(this.points[i]);
    return { from, to, min: own != null ? own : changeoverMin(from, to), own: own != null };
  }

  setChangeMin(i, min) {
    const p = this.points[i];
    if (!p) return;
    min = Math.max(0, Math.min(600, Math.round(+min || 0)));
    const c = this.changeAt(i);
    if (!c || min === c.min) return;
    this.commit();
    if (min === changeoverMin(c.from, c.to)) this.pchange.delete(p); else this.pchange.set(p, min);
    this.retime();
    this.renderWaypoints();
    this.renderMarkers();
    this.save();
  }

  // ---------------------------------------------------------------- stops and nights
  // A stop at via point i: a break, or a night. Not at the start (that's the
  // departure) or the finish.
  stopAt(i) { return i > 0 && i < this.points.length - 1 ? this.pstop.get(this.points[i]) || null : null; }

  setStop(i, stop) {
    const p = this.points[i];
    if (!p || i <= 0 || i >= this.points.length - 1) return;
    stop = cleanStop(stop);
    const old = this.stopAt(i);
    if (JSON.stringify(old) === JSON.stringify(stop)) return;
    this.commit();
    if (stop) this.pstop.set(p, stop); else this.pstop.delete(p);
    this.retime();
    this.renderWaypoints();
    this.renderMarkers();
    this.save();
  }

  // the gear of the sport you change out of at point i: left there (the default), or taken along
  carryAt(i) { return !!this.pcarry.get(this.points[i]); }
  setCarry(i, on) {
    const p = this.points[i];
    if (!p || this.carryAt(i) === !!on) return;
    this.commit();
    if (on) this.pcarry.set(p, true); else this.pcarry.delete(p);
    this.renderWarnings();
    this.renderWaypoints();
    this.save();
  }
  // what's left at a changeover: "Your bike", "Your sea kayak"
  gearLabel(g) { return g === 'bike' ? 'Your bike' : `Your ${(CRAFT[this.craft] || CRAFT.kayak).label.toLowerCase()}`; }

  // Leg i in another sport: it's routed again with that sport's router, style and speed.
  setLegSport(i, sport) {
    const leg = this.legs[i];
    if (!leg || !ACTIVITIES[sport] || this.legSport(i) === sport) return;
    this.commit();
    const route = this.app.activity();
    const fixed = leg.mode === 'fixed';
    const mode = fixed ? 'fixed' : isWater(sport) ? (leg.mode === 'line' ? 'line' : 'water') : leg.mode === 'water' ? 'auto' : leg.mode;
    this.legs[i] = { ...(fixed ? leg : {}), mode, style: null, sport: sport === route ? undefined : sport };
    this.update();
  }

  label(i) { return i === 0 ? 'Start' : i === this.points.length - 1 ? 'Finish' : `Via ${i}`; }

  // the road or path a point is on: from Valhalla's tags if it routed a leg there, else the map tiles
  autoName(i) {
    const near = [this.legs[i - 1] && this.legs[i - 1].result && this.legs[i - 1].result.tags.at(-1), this.legs[i] && this.legs[i].result && this.legs[i].result.tags[0]];
    const t = near.find((x) => x && x.name);
    return t ? t.name : this.roads.nameAt(this.points[i], 30);
  }

  /** What to call point i: your name, else the road it's on, else Start / Via n / Finish. */
  nameOf(i) { return this.pname.get(this.points[i]) || this.autoName(i) || this.label(i); }

  setName(i, name) {
    const p = this.points[i];
    name = String(name || '').trim().slice(0, 60);
    if (!p || name === (this.pname.get(p) || '')) return;
    this.commit();
    if (name) this.pname.set(p, name); else this.pname.delete(p);
    this.update(); // no routing: the legs haven't changed
  }

  // Move point i to position j. Legs whose two ends stay neighbours are kept
  // (an imported track the other way round is turned round); new neighbours
  // get a new leg in the mode the point's outgoing leg had.
  movePointTo(i, j) {
    const n = this.points.length;
    if (i === j || i < 0 || j < 0 || i >= n || j >= n) return;
    this.commit();
    const pts = this.points.slice();
    pts.splice(j, 0, pts.splice(i, 1)[0]);
    const out = new Map();
    this.legs.forEach((l, k) => out.set(this.points[k], { l, to: this.points[k + 1] }));
    this.legs = pts.slice(1).map((to, k) => {
      const from = pts[k], o = out.get(from), r = out.get(to);
      if (o && o.to === to) return o.l;
      if (r && r.to === from && r.l.mode === 'fixed' && r.l.result) {
        const c = r.l.result;
        return { mode: 'fixed', status: 'ok', src: flipSrc(r.l.src), sport: r.l.sport, result: { coords: c.coords.slice().reverse(), tags: c.tags.slice().reverse(), portage: [] } };
      }
      const m = (o || r) ? (o || r).l.mode : this.mode;
      return { mode: m === 'fixed' ? 'auto' : m, style: o ? o.l.style : null, sport: (o || r) ? (o || r).l.sport : undefined };
    });
    this.points = pts;
    this.update();
  }

  // Show point i on the map, and make its marker pulse.
  focusPoint(i) {
    const p = this.points[i];
    if (!p) return;
    if (this.layout() === 'sheet' && this.panel.dataset.state === 'full') this.setSheetState('half');
    // centred in the map the planner leaves free; an offset, not `padding`, which MapLibre would keep for every later move
    const v = this.viewPadding(0);
    this.map.easeTo({ center: p, zoom: Math.max(this.map.getZoom(), 15), offset: [(v.left - v.right) / 2, (v.top - v.bottom) / 2], duration: 600 });
    const el = this.markers[i] && this.markers[i].getElement();
    if (el) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
  }
  undo() { if (this.past.length) { this.future.push(this.snapshot()); this.restoreSnap(this.past.pop()); this.renderQuickSport(); } }
  redo() { if (this.future.length) { this.past.push(this.snapshot()); this.restoreSnap(this.future.pop()); this.renderQuickSport(); } }

  addPoint(ll) {
    this.commit();
    this.points.push(ll);
    if (this.points.length > 1) {
      // a new leg goes on in the sport of the one before (after a change, you keep paddling)
      const prev = this.legs[this.legs.length - 1], sport = prev && prev.sport;
      const mode = !sport ? this.mode : isWater(sport) ? (this.mode === 'line' ? 'line' : 'water') : this.mode === 'water' ? 'auto' : this.mode;
      this.legs.push({ mode, sport });
    }
    this.update();
  }

  insertPoint(legIdx, ll) {
    if (!this.legs[legIdx]) return this.addPoint(ll);
    this.commit();
    this.splitLeg(legIdx, ll);
    this.update();
  }

  // A new via point on leg `li`, at the spot of the line nearest `ll`. The two
  // halves keep the geometry they had (a route through a point on it is the
  // same route), so adding a point on the line costs no routing request.
  // Returns the new point's index.
  splitLeg(li, ll, near = null) {
    const leg = this.legs[li];
    const r = leg.result;
    if (r && leg.status === 'ok' && leg.mode !== 'water' && r.coords.length > 1) {
      const c = r.coords;
      near = near || nearestOnLine(ll, c);
      const q = c[near.i], q2 = c[near.i + 1];
      const p = [+(q[0] + (q2[0] - q[0]) * near.t).toFixed(6), +(q[1] + (q2[1] - q[1]) * near.t).toFixed(6)];
      // a LIPAS leg's halves remember where they are along LIPAS's line (share links)
      let src = [null, null];
      if (leg.src) {
        const m = lineLength(c.slice(0, near.i + 1)) + dist(q, p), dir = leg.src.b >= leg.src.a ? 1 : -1, mid = leg.src.a + dir * m;
        src = [{ ...leg.src, b: mid }, { ...leg.src, a: mid }];
      }
      const half = (coords, tags, k) => ({ mode: leg.mode, status: 'ok', style: leg.style, sport: leg.sport, src: src[k], result: { coords, tags, portage: [] } });
      this.points.splice(li + 1, 0, p);
      this.legs.splice(li, 1, half(c.slice(0, near.i + 1).concat([p]), r.tags.slice(0, near.i + 1), 0), half([p].concat(c.slice(near.i + 1)), r.tags.slice(near.i), 1));
      for (const k of [li, li + 1]) if (this.legs[k].mode !== 'fixed') this.legs[k].key = this.legKey(k).key;
    } else {
      this.points.splice(li + 1, 0, ll);
      this.legs.splice(li, 1, { mode: leg.mode === 'fixed' ? 'auto' : leg.mode, style: leg.style, sport: leg.sport }, { mode: leg.mode === 'fixed' ? 'auto' : leg.mode, style: leg.style, sport: leg.sport });
    }
    return li + 1;
  }

  isLoop() { const n = this.points.length; return n > 2 && dist(this.points[0], this.points[n - 1]) < 3; }

  // Make point i the start. A loop turns round (the same route, a new start);
  // otherwise the part before it goes. Undo brings it back.
  startAt(i) {
    if (i <= 0 || i >= this.points.length - 1) return;
    this.commit();
    if (this.isLoop()) {
      const pts = this.points.slice(0, -1);
      this.points = pts.slice(i).concat(pts.slice(0, i), [pts[i].slice()]);
      this.legs = this.legs.slice(i).concat(this.legs.slice(0, i));
      toast('The loop starts here now');
    } else {
      this.points = this.points.slice(i);
      this.legs = this.legs.slice(i);
      toast('The route starts here now — undo brings back the part before');
    }
    this.update();
  }

  finishAt(i) {
    if (i <= 0 || i >= this.points.length - 1) return;
    this.commit();
    this.points = this.points.slice(0, i + 1);
    this.legs = this.legs.slice(0, i);
    toast('The route finishes here now — undo brings back the rest');
    this.update();
  }

  // metres along the route to point i
  lengthTo(i) {
    let m = 0;
    for (let k = 0; k < i && k < this.legs.length; k++) {
      const c = this.legs[k].result ? this.legs[k].result.coords : [this.points[k], this.points[k + 1]];
      for (let j = 1; j < c.length; j++) m += dist(c[j - 1], c[j]);
    }
    return m;
  }

  removePoint(i) {
    this.commit();
    this.points.splice(i, 1);
    if (!this.legs.length) { /* single point */ }
    else if (i === 0) this.legs.shift();
    else if (i >= this.legs.length) this.legs.pop();
    else {
      const a = this.legs[i - 1], b = this.legs[i];
      const sa = a.src, sb = b.src;
      const src = sa && sb && sa.t === sb.t && sa.id === sb.id && sa.seq === sb.seq && Math.abs(sa.b - sb.a) < 2 ? { ...sa, b: sb.b } : null;
      const merged = a.mode === 'fixed' && b.mode === 'fixed' && a.result && b.result
        ? { mode: 'fixed', status: 'ok', src, sport: a.sport, result: { coords: a.result.coords.concat(b.result.coords.slice(1)), tags: a.result.tags.concat(b.result.tags), portage: [] } }
        : { mode: a.mode === 'fixed' ? 'auto' : a.mode, style: a.style, sport: a.sport };
      this.legs.splice(i - 1, 2, merged);
    }
    this.update();
  }

  reverse() {
    if (this.points.length < 2) return;
    this.commit();
    this.points.reverse();
    this.legs = this.legs.reverse().map((l) => (l.mode === 'fixed' && l.result
      ? { mode: 'fixed', status: 'ok', src: flipSrc(l.src), sport: l.sport, result: { coords: l.result.coords.slice().reverse(), tags: l.result.tags.slice().reverse(), portage: [] } }
      : { mode: l.mode, style: l.style, sport: l.sport }));
    this.update();
  }

  backToStart() {
    if (this.points.length < 2) return;
    this.addPoint(this.points[0].slice());
  }

  clear() {
    if (!this.points.length) return;
    this.commit();
    this.points = [];
    this.legs = [];
    this.closeStartTip();
    this.litLeg(null);
    this.update();
  }

  // ---------------------------------------------------------------- places to avoid
  nogosNear(a, b) {
    const pad = Math.max(2000, dist(a, b) * 0.6);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return this.nogos.filter((n) => dist(n.ll, mid) < pad + dist(a, b) / 2);
  }

  addNogo(ll, r = 40, label = 'Avoid') {
    this.commit();
    this.nogos.push({ ll: [+ll[0].toFixed(6), +ll[1].toFixed(6)], r: Math.round(r), label });
    this.drawNogos();
    this.update();
    toast(this.points.length > 1 ? 'Re-routing around it…' : 'Marked — routes will go around it');
  }

  // several at once (a group of fallen trees): one undo step, one re-route
  addNogos(list) {
    if (list.length === 1) { this.addNogo(list[0].ll, list[0].r, list[0].label); return; }
    this.commit();
    for (const n of list) this.nogos.push({ ll: [+n.ll[0].toFixed(6), +n.ll[1].toFixed(6)], r: Math.round(n.r), label: n.label });
    this.drawNogos();
    this.update();
    toast(`Re-routing around ${list.length} places…`);
  }

  removeNogo(i) {
    this.commit();
    this.nogos.splice(i, 1);
    this.drawNogos();
    this.update();
  }

  drawNogos() {
    const features = this.nogos.map((n, i) => {
      const ring = [];
      const k = Math.cos((n.ll[1] * Math.PI) / 180);
      for (let j = 0; j <= 48; j++) {
        const t = (j / 48) * Math.PI * 2;
        ring.push([n.ll[0] + (Math.cos(t) * n.r) / (111195 * k), n.ll[1] + (Math.sin(t) * n.r) / 111195]);
      }
      return { type: 'Feature', properties: { i, label: n.label }, geometry: { type: 'Polygon', coordinates: [ring] } };
    });
    this.app.setData('nogo', { type: 'FeatureCollection', features });
  }

  openNogoMenu(i, lngLat) {
    if (this.menu) this.menu.remove();
    const n = this.nogos[i];
    const body = h('div', { class: 'pt-menu' },
      h('div', { class: 'pt-title' }, 'Avoided place'),
      h('div', { class: 'pt-label' }, n.label),
      h('button', { type: 'button', class: 'btn danger-text', onclick: () => { this.menu.remove(); this.removeNogo(i); }, html: `${icon('trash', 16)} Stop avoiding` }));
    this.menu = new maplibregl.Popup({ offset: 8, closeButton: true, className: 'polku-popup' }).setLngLat(lngLat).setDOMContent(body).addTo(this.map);
  }

  setLegMode(i, mode) {
    if (!this.legs[i] || this.legs[i].mode === mode) return;
    this.commit();
    this.legs[i] = { mode, style: this.legs[i].style, sport: this.legs[i].sport };
    this.update();
  }

  setMode(mode) {
    this.mode = mode;
    for (const b of this.panel.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  }

  loadTrack(coords, name) {
    this.commit();
    const c = simplify(coords, 2);
    this.points = [c[0], c[c.length - 1]];
    this.legs = [{ mode: 'fixed', status: 'ok', result: { coords: c, tags: c.slice(1).map(() => ({})), portage: [] } }];
    this.routeName = name;
    this.setActive(true);
    this.update();
  }

  restore({ points, modes, style, legStyles, lipas, sports, changes, stops, carry }) {
    const sport = this.app.activity();
    this.points = points;
    this.legs = points.slice(1).map((_, i) => ({ mode: CODE_MODE[modes[i]] || modes[i] || 'auto', sport: (sports && sports[i]) || undefined }))
      .map((l) => (l.mode === 'fixed' ? { mode: 'auto', sport: l.sport } : l));
    for (const [i, m] of changes || []) if (this.points[i]) this.pchange.set(this.points[i], m);
    for (const [i, st] of stops || []) if (this.points[i]) this.pstop.set(this.points[i], st);
    for (const i of carry || []) if (this.points[i]) this.pcarry.set(this.points[i], true);
    // legs that ride a LIPAS route: its line comes from LIPAS, not from a router
    for (const r of lipas || []) if (this.legs[r.i]) this.legs[r.i] = { mode: 'fixed', status: 'loading', result: null, sport: this.legs[r.i].sport, src: { t: r.t, id: r.id, seq: r.seq, a: r.a, b: r.b } };
    // a shared link's style is the route's, not yours: your own per-sport choice stays as it was
    if (style != null) this.style = decodeStyle(sport, style);
    for (const part of (legStyles || '').split(',')) {
      const [i, code] = part.split(':');
      if (this.legs[+i] && code) this.legs[+i].style = decodeStyle(this.legSport(+i), code);
    }
    this.update();
    this.loadSources();
  }

  // Legs that came as LIPAS references (a share link): their line from LIPAS,
  // clipped to where the leg starts and ends. If LIPAS can't answer, routed.
  async loadSources() {
    const todo = this.legs.filter((l) => l.mode === 'fixed' && l.src && !l.result);
    if (!todo.length) return;
    await Promise.all(todo.map(async (l) => {
      let c = null;
      try {
        const line = stitch(await lipasPlace(l.src.t, l.src.id), l.src.seq);
        c = line && clipAlong(line, l.src.a, l.src.b);
      } catch { /* routed instead */ }
      const i = this.legs.indexOf(l);
      if (i < 0) return;
      if (c && c.length > 1) {
        c[0] = this.points[i]; c[c.length - 1] = this.points[i + 1];
        Object.assign(l, { status: 'ok', result: { coords: c, tags: c.slice(1).map(() => ({})), portage: [] } });
      } else this.legs[i] = { mode: 'auto', style: l.style };
    }));
    this.update();
  }

  // ---------------------------------------------------------------- LIPAS routes
  // A LIPAS route as the plan, or added to its end (lipas.js rideOf makes one
  // line of its parts). Its line goes in as fixed legs, like an imported track:
  // riding it costs no routing call. Only the gaps between its parts, and the
  // way to it when adding, are routed.
  rideLipas(place, ride, { add = false } = {}) {
    const p = place.props;
    const fixed = (coords, seq, a, b) => ({ mode: 'fixed', status: 'ok', src: { t: p.type, id: p.lipasId, seq, a, b }, result: { coords, tags: coords.slice(1).map(() => ({})), portage: [] } });
    let pieces = ride.pieces.map((pc) => ({ ...pc, coords: pc.coords.slice() }));
    const end = add && this.points.length ? this.points[this.points.length - 1] : null;
    // added loop: join it where it comes nearest your route, ride round, and come back there
    if (end && ride.loop && !ride.closeGap && pieces.length === 1) {
      const pc = pieces[0], near = nearestOnLine(end, pc.coords);
      const m = lineLength(pc.coords.slice(0, near.i + 1));
      if (m > 50 && pc.b - m > 50) {
        pieces = [
          { coords: pc.coords.slice(near.i), seq: pc.seq, a: m, b: pc.b },
          { coords: pc.coords.slice(0, near.i + 1), seq: pc.seq, a: 0, b: m },
        ];
        pieces[0].coords[pieces[0].coords.length - 1] = pieces[1].coords[0];
      }
    }
    const pts = [], legs = [];
    pieces.forEach((pc, k) => {
      const c = pc.coords;
      if (k) {
        if (dist(pts[pts.length - 1], c[0]) > 0.5) { pts.push(c[0]); legs.push({ mode: 'auto' }); }
        else c[0] = pts[pts.length - 1];
      } else pts.push(c[0]);
      legs.push(fixed(c, pc.seq, pc.a, pc.b));
      pts.push(c[c.length - 1]);
    });
    if (ride.closeGap) { pts.push(pts[0].slice()); legs.push({ mode: 'auto' }); }
    else if (ride.loop) { pts[pts.length - 1] = pts[0].slice(); legs[legs.length - 1].result.coords[legs[legs.length - 1].result.coords.length - 1] = pts[0].slice(); }
    const had = this.points.length > 1;
    this.commit();
    if (end) {
      this.legs.push({ mode: this.mode });
      this.points.push(...pts);
      this.legs.push(...legs);
    } else {
      this.points = pts;
      this.legs = legs;
      this.routeName = p.name;
      // a loop on one leg gets two via points, so it can be dragged and has a finish of its own
      if (ride.loop && this.legs.length === 1) {
        const L = lineLength(this.legs[0].result.coords);
        this.splitLeg(0, null, alongAt(this.legs[0].result.coords, L / 3));
        this.splitLeg(1, null, alongAt(this.legs[1].result.coords, L / 3));
      }
    }
    this.setActive(true);
    this.update();
    const b = bbox(this.legs.flatMap((l, i) => (l.result ? l.result.coords : [this.points[i], this.points[i + 1]])));
    this.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: this.viewPadding(), maxZoom: 15, duration: 700 });
    const km = fmtDist(ride.km * 1000);
    const what = ride.network ? `${p.name} is a network of trails: ${end ? 'added' : 'riding'} the stretch ${end ? 'you picked' : 'you clicked'} (${km})`
      : `${end ? 'Added' : 'Riding'} ${p.name} · ${km}${ride.loop ? ' loop' : ''}${ride.left >= 0.3 ? ` (${fmtDist(ride.left * 1000)} of side trails left out)` : ''}`;
    toast(`${what}${!end && had ? ' — undo brings back your route' : ''}`, { ms: 5000 });
  }

  // The header in the first arrangement that fits. Labels change with the sport and the
  // style, so this measures rather than trusting breakpoints: one line → one slim line →
  // two lines → the quick buttons on a line of their own → compact labels (the colour as
  // its swatch, the sport's icon, the style without "Style:") → the modes as icons.
  // CSS (.sheet-head.slim / .two-line / .stack / .tight / .tighter) does the rest.
  fitHeader() {
    const head = this.els.head;
    if (!head || this.panel.hidden) return;
    const over = (el) => el && el.offsetParent !== null && el.scrollWidth > el.clientWidth + 1;
    head.classList.remove('two-line', 'slim', 'stack', 'tight', 'tightest', 'tighter');
    head.classList.add('measuring');
    // one line, then one line with only the active mode's label and the extra tools in ⋯, then two lines
    if (over(head.firstChild)) {
      head.classList.add('slim');
      if (over(head.firstChild)) { head.classList.remove('slim'); head.classList.add('two-line'); }
    }
    if (over(this.els.toolsRow)) head.classList.add('stack');
    // the quick line doesn't shrink (a line of its own), so it's measured against the row's width
    // (on one line the row is `display: contents` and has no width of its own)
    const qpOver = () => this.els.quickPair.offsetParent !== null && this.els.quickPair.scrollWidth > Math.min(this.els.quickPair.clientWidth, this.els.toolsRow.clientWidth || Infinity) + 1;
    if (qpOver() || over(this.els.toolsRow)) head.classList.add('tight');
    if (qpOver()) head.classList.add('tightest'); // the smallest phones: Round trip as its icon
    // the tools fell to a line of their own under the modes: the modes go icon-only
    const modes = this.els.toolsRow.querySelector('.modes'), tools = this.els.toolsRow.querySelector('.tools');
    if (modes && tools && tools.offsetTop > modes.offsetTop + modes.offsetHeight / 2) head.classList.add('tighter');
    head.classList.remove('measuring');
    this.fitW = head.clientWidth;
  }

  fitHeaderSoon() {
    cancelAnimationFrame(this.fitFrame);
    this.fitFrame = requestAnimationFrame(() => this.fitHeader());
  }

  renderQuickSport() {
    const sports = this.app.sports ? this.app.sports() : [];
    // the route's sport (most of its length), which may not be the map's (the sport pill changed it)
    const k = this.points.length > 1 && this.legs.length ? this.mainSport() : this.app.activity();
    const cur = sports.find((x) => x.k === k);
    if (!cur) { this.els.quickSport.hidden = true; return; }
    this.els.sportSel.innerHTML = '';
    for (const x of sports) this.els.sportSel.append(h('option', { value: x.k }, x.label));
    this.els.sportSel.value = cur.k;
    this.els.quickSport.innerHTML = `${icon(cur.icon, 16)}<span>${escapeHtml(cur.label)}</span>${icon('chevronDown', 12)}`;
    this.els.quickSport.append(this.els.sportSel);
    this.fitHeaderSoon();
  }

  // The sport changed (`prev` the one before). A drawn route keeps its sports: the legs
  // that followed the old one have it as their own now, so nothing is routed again behind
  // your back. From the planner's own picker (`from: 'planner'`) the route goes with the
  // sport, and Undo brings it back. Returns true when it told you something.
  onActivityChange(prev = null, { from = 'map' } = {}) {
    const sport = this.app.activity();
    if (this.loop.open) this.closeLoop(); // lengths and styles are per sport
    this.style = this.savedStyle(sport);
    this.styleLeg = null;
    const route = this.points.length > 1 && prev && prev !== sport && ACTIVITIES[prev];
    if (route) for (let i = 0; i < this.legs.length; i++) if (!this.legs[i].sport) this.legs[i].sport = this.legSportAs(i, prev);
    for (const l of this.legs) if (l.sport === sport) l.sport = undefined; // already in the new sport: follows it
    this.renderQuickSport(); // the route's sport, now that its legs keep theirs
    this.setMode(ACTIVITIES[sport].mode);
    this.panel.classList.toggle('is-paddle', isWater(this.mainSport()));
    this.renderToolbarState();
    if (!route) { if (this.points.length > 1) this.update(); return false; }
    if (from === 'planner') { this.routeAs(sport); return true; }
    this.update(); // the same legs (their keys match): only drawn again
    const L = (k) => ACTIVITIES[k].label;
    toast(`The map is for ${L(sport)} now: your route stays ${L(this.mainSport())}.`, { ms: 9000, action: { label: `Route it as ${L(sport)}`, fn: () => this.routeAs(sport) } });
    return true;
  }

  // the sport most of the route is in (by length)
  mainSport() {
    const by = {};
    this.legs.forEach((_, i) => { const sp = this.legSport(i); by[sp] = (by[sp] || 0) + (this.lengthTo(i + 1) - this.lengthTo(i)); });
    return Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k]) => k)[0] || this.app.activity();
  }

  // what leg i's sport is when the route's sport is `act` (a water leg in a land sport is paddled)
  legSportAs(i, act) {
    const leg = this.legs[i];
    if (leg.sport) return leg.sport;
    return leg.mode === 'water' && !isWater(act) ? 'paddle' : act;
  }

  // The route in `sport`: the legs in its main sport follow it (a leg in another sport, the
  // paddle across in a ride, keeps it), and their own styles go (styles are per sport).
  // One undo step back to the route before.
  routeAs(sport) {
    if (this.app.activity() !== sport) return; // the sport moved on meanwhile
    const prev = this.mainSport();
    if (prev === sport) { this.update(); return; } // it is already
    const main = this.legs.map((_, i) => this.legSport(i) === prev || this.legSport(i) === sport);
    this.commit();
    let styled = false;
    this.legs.forEach((l, i) => {
      if (!main[i]) return;
      if (l.style) styled = true;
      l.sport = undefined;
      l.style = null;
    });
    this.update();
    this.renderQuickSport();
    const L = (k) => ACTIVITIES[k].label;
    toast(`Your route is ${L(sport)} now${styled ? ' (legs with their own style follow the route’s)' : ''} · Undo brings back the ${L(prev)} route`, { ms: 7000, action: { label: 'Undo', fn: () => this.undo() } });
  }

  setActive(on) {
    this.active = on;
    this.panel.hidden = !on;
    if (!on) { this.closeMore(); this.closeStartTip(); this.litLeg(null); delete document.body.dataset.sheet; delete document.body.dataset.pl; }
    if (on) this.renderQuickSport();
    // an empty route opens small, so the map is there to tap; otherwise as you left it
    if (on) this.setSheetState(!this.points.length && this.layout() === 'sheet' ? 'peek' : store.get('sheetState', {})[this.layout()], { remember: false });
    document.body.classList.toggle('planning', on);
    this.map.getCanvas().style.cursor = on ? 'crosshair' : '';
    for (const m of this.markers) m.getElement().hidden = !on;
    this.renderGhosts();
    this.app.onActiveChange(on);
    if (on && !this.analysis) this.renderAnalysis(); // the empty planner's first words (and its round-trip button)
    this.drawColored();
    if (on) requestAnimationFrame(() => this.chart.draw());
    // opened far from the route (you browsed elsewhere): bring it back into view
    if (on && this.points.length && !this.routeInView()) requestAnimationFrame(() => this.fitRoute());
  }

  // ---------------------------------------------------------------- routing
  update() {
    this.drawNogos();
    this.renderMarkers();
    this.renderWaypoints();
    this.checkWet();
    this.renderToolbarState();
    this.save();
    this.routeAll();
  }

  // what a leg's route depends on: when this changes, it needs routing again
  legKey(i) {
    const leg = this.legs[i];
    const from = this.points[i], to = this.points[i + 1];
    const nogos = leg.mode === 'auto' || leg.mode === 'water' ? this.nogosNear(from, to) : [];
    const rp = this.routerFor(i); // the leg's route style, as the routers take it
    const profile = rp.profile || ACTIVITIES[this.legSport(i)].brouter;
    const styleKey = leg.mode === 'line' ? '' : rp.key;
    // a water leg also depends on the craft and, keeping out of the wind, on the hour it starts
    const at = leg.mode === 'water' ? this.legStartSec(i) : 0;
    const waterKey = leg.mode === 'water' ? `|${this.craftOf(i)}|${rp.water.wind === 'ignore' ? '' : Math.floor(at / 3600)}` : '';
    return { key: `${leg.mode}|${profile}|${from.join(',')}|${to.join(',')}|${nogos.map((n) => n.ll.join(',') + n.r).join(';')}|${styleKey}${waterKey}`, from, to, nogos, profile, rp, at };
  }

  // When leg i starts, roughly: the departure plus the way so far at your paddling speed (for the wind on water legs)
  legStartSec(i) {
    const kmh = (CRAFT[this.craft] || CRAFT.kayak).kmh;
    return this.startSec() + (this.lengthTo(i) / 1000 / kmh) * 3600;
  }

  // the router parameters for leg i: its own style, else its sport's (the route's, or your saved one for another sport)
  routerFor(i) {
    const leg = this.legs[i], sport = this.legSport(i);
    const base = this.styleOf(sport);
    return routerOf(sport, (leg && leg.style) || base, this.wet.on);
  }

  // what's on the water on leg i: a swimmer, or your craft
  craftOf(i) { return this.legSport(i) === 'swim' ? 'swim' : this.craft; }

  // what the routers get for a leg (styles.js)
  styleOpts(t) { return { params: t.rp.params, valhalla: t.rp.valhalla, water: { ...t.rp.water, craft: this.craftOf(t.i), at: t.at, nogos: t.nogos } }; }

  async routeAll() {
    const gen = ++this.gen;
    const todo = []; // legs to route: { leg, key, from, to, nogos, profile }
    this.legs.forEach((leg, i) => {
      if (leg.mode === 'fixed') { if (leg.result) leg.status = 'ok'; return; } // a LIPAS leg from a link may still be on its way
      const k = this.legKey(i);
      if (leg.key === k.key && leg.result) return;
      leg.key = k.key;
      leg.result = null;
      leg.status = 'loading';
      todo.push({ i, leg, ...k });
    });
    // Consecutive auto legs with nothing to avoid near them go to BRouter in one
    // call (a new sport, a shared link, both legs of a drag): it counts the calls.
    const jobs = [];
    const batchable = (t) => t.leg.mode === 'auto' && !t.nogos.length;
    for (let j = 0; j < todo.length;) {
      let e = j;
      while (batchable(todo[j]) && e + 1 < todo.length && todo[e + 1].i === todo[e].i + 1 && batchable(todo[e + 1]) && todo[e + 1].rp.key === todo[e].rp.key && todo[e + 1].profile === todo[e].profile) e++;
      const run = todo.slice(j, e + 1);
      j = e + 1;
      jobs.push(run.length > 1 ? () => this.routeRunOf(run) : () => this.routeOne(run[0]));
    }
    this.drawRoute();
    this.panel.classList.toggle('busy', jobs.length > 0);
    await pool(jobs, 3);
    if (gen !== this.gen) return;
    this.panel.classList.remove('busy');
    if (this.snapPoints()) { this.renderMarkers(); this.drawRoute(); }
    if (jobs.length) this.save(); // now with the routed geometry
    await this.runAnalysis(gen);
  }

  async routeRunOf(run) {
    let res = null;
    try {
      res = await routeRun({ points: [run[0].from, ...run.map((t) => t.to)], profile: run[0].profile, opts: { portage: true, nogos: [], maxWait: STAND_IN_AFTER, ...this.styleOpts(run[0]) } });
    } catch (e) {
      if (e.name === 'Limited') { for (const t of run) this.legFailed(t, e); this.drawRoute(); return; }
      // anything else: one by one, so only the leg that can't be routed is left straight
    }
    if (res) { run.forEach((t, k) => this.legDone(t, res[k])); this.drawRoute(); return; }
    await pool(run.map((t) => () => this.routeOne(t)), 2);
  }

  async routeOne(t) {
    try {
      this.legDone(t, await routeLeg({ from: t.from, to: t.to, mode: t.leg.mode, profile: t.profile, opts: { portage: true, nogos: t.nogos, maxWait: STAND_IN_AFTER, ...this.styleOpts(t) } }));
    } catch (e) {
      this.legFailed(t, e);
    }
    this.drawRoute();
  }

  legDone({ leg, key }, r) {
    if (leg.key !== key) return; // moved on meanwhile
    leg.result = r;
    leg.preview = null;
    leg.status = 'ok';
    if (r.note && this.active) toast(r.note, { tone: 'warn' });
  }

  legFailed({ leg, key, from, to }, e) {
    if (leg.key !== key || e.name === 'AbortError') return;
    // a straight stand-in keeps the totals whole until it's routed
    leg.result = { coords: [from, to], tags: [{}], portage: [] };
    leg.preview = null;
    if (e.name === 'Limited') {
      // the service asked for a pause (net.js says so once): wait, dashed, and route when it's free (retryFailed)
      leg.status = 'waiting';
      leg.wait = { reason: e.reason, until: e.until, own: e.source !== 'brouter' };
      leg.key = null;
    } else {
      leg.status = 'error';
      toast(`Couldn't route this leg (${e.message}) — drawn as a straight line. Heads-up has a Retry.`, { tone: 'warn', ms: 6000 });
    }
  }

  drawRoute() {
    const features = [];
    this.legs.forEach((leg, i) => {
      const from = this.points[i], to = this.points[i + 1];
      const loading = !leg.result || leg.status === 'waiting';
      // while dragging, a route that's a moment behind the pointer, joined to it
      const coords = loading ? (leg.preview ? [from, ...leg.preview, to] : [from, to]) : leg.result.coords;
      const mode = leg.status === 'error' ? 'line' : leg.mode === 'fixed' ? 'auto' : leg.mode;
      features.push({ type: 'Feature', properties: { leg: i, mode, loading, kind: 'leg' }, geometry: { type: 'LineString', coordinates: coords } });
      // a point the route couldn't reach (too far from a path to snap): a thin dashed line to it
      if (!loading && coords.length > 1) {
        if (dist(from, coords[0]) > 3) features.push({ type: 'Feature', properties: { leg: i, kind: 'gap' }, geometry: { type: 'LineString', coordinates: [from, coords[0]] } });
        if (dist(to, coords[coords.length - 1]) > 3) features.push({ type: 'Feature', properties: { leg: i, kind: 'gap' }, geometry: { type: 'LineString', coordinates: [coords[coords.length - 1], to] } });
      }
      if (!loading) {
        for (const [a, b] of leg.result.portage || []) {
          features.push({ type: 'Feature', properties: { leg: i, mode, loading: false, kind: 'portage' }, geometry: { type: 'LineString', coordinates: coords.slice(a, b + 1) } });
        }
      }
    });
    this.app.setData('route', { type: 'FeatureCollection', features });
    if (!this.edit) this.renderGhosts();
  }

  // ---------------------------------------------------------------- round trips
  // Loops of about a chosen length from a start (js/roundtrip.js does the
  // shapes and the water). Three candidates, each one routing call; a bad one
  // is replaced by the next direction and a near miss resized once, at most
  // six calls in all. Picking one makes it a normal route.
  openLoop(start = null) {
    const L = this.loop;
    if (!this.active) this.setActive(true);
    L.open = true;
    L.results = [];
    const sport = this.app.activity();
    const pre = LOOP_PRESETS[sport] || LOOP_PRESETS.mtb;
    if (L.km == null || L.sport !== sport) { L.km = pre.km[1]; L.min = pre.min[1]; L.sport = sport; }
    this.closeStartTip();
    if (start) this.setLoopStart(start, 'the spot you chose', false);
    else if (this.points.length) this.setLoopStart(this.points[0].slice(), 'your route’s start', false);
    else { const c = this.map.getCenter(); this.setLoopStart([+c.lng.toFixed(6), +c.lat.toFixed(6)], 'the map centre', false); }
    this.renderLoop();
    if (!this.analysis) this.renderAnalysis(); // the empty planner's round-trip button goes
    this.reveal('loop');
  }

  closeLoop() {
    const L = this.loop;
    L.open = false;
    L.results = [];
    if (this.loopMarker) { this.loopMarker.remove(); this.loopMarker = null; }
    this.app.setData('loops', EMPTY);
    this.renderLoop();
    if (!this.analysis) this.renderAnalysis();
  }

  setLoopStart(ll, label, render = true) {
    const L = this.loop;
    L.start = ll;
    L.startLabel = label;
    L.results = [];
    this.app.setData('loops', EMPTY);
    if (!this.loopMarker) this.loopMarker = new maplibregl.Marker({ element: h('div', { class: 'wp-hit' }, h('div', { class: 'wp wp-start' })) }).setLngLat(ll).addTo(this.map);
    else this.loopMarker.setLngLat(ll);
    if (render) this.renderLoop();
  }

  async loopFromHere() {
    if (!navigator.geolocation) { toast('This browser can’t tell where you are'); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const ll = [+pos.coords.longitude.toFixed(6), +pos.coords.latitude.toFixed(6)];
      this.setLoopStart(ll, 'your location');
      this.map.easeTo({ center: ll, duration: 500 });
    }, () => toast('Couldn’t get your location — click the map to choose the start'), { enableHighAccuracy: true, timeout: 10000 });
  }

  // `more`: three more loops in directions not tried yet, after the ones there are
  async generateLoops({ more = false } = {}) {
    const L = this.loop;
    const sport = this.app.activity();
    if (L.busy || !L.start || !roundTripSports.includes(sport)) return;
    if (more && L.results.length >= LOOP_MAX) return;
    const wet = waterLoop(sport); // Polku's own water router: no routing service to spare
    if (!wet) {
      // the routing service is free and shared: a few at a time
      L.gens = L.gens.filter((t) => Date.now() - t < 600e3);
      if (L.gens.length >= LOOP_CAP) {
        toast(`That’s ${LOOP_CAP} round trips in 10 minutes — the free routing service needs a breather. Try again at ${new Date(L.gens[0] + 600e3).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`, { tone: 'warn', ms: 6000 });
        return;
      }
      L.gens.push(Date.now());
    }
    L.busy = true;
    L.editing = false;
    L.note = '';
    if (!more) { L.results = []; L.used = []; L.calls = 0; this.app.setData('loops', EMPTY); }
    this.renderLoop();
    const T = { t: performance.now() }; // where the time goes (L.timing, for tools/loop_probe.py and the tests)
    const lap = (k) => { const n = performance.now(); T[k] = Math.round(n - T.t); T.t = n; };
    try {
      const targetM = more ? L.targetM : L.mode === 'min' ? distanceForTime(sport, L.min, speedsFor(sport), this.craft) : L.km * 1000;
      const start = L.start;
      if (!more || !L.water) {
        // frame the loops' reach first: its water comes from the tiles the map loads
        const b = reach(start, radiusFor(sport, targetM));
        if (wet) prefetchWater(b); // fairways, marks and rocks for the whole area while the map loads (cached per tile)
        this.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: this.viewPadding(), duration: 0, maxZoom: 15 });
        await new Promise((ok) => { const t = setTimeout(ok, 8000); this.map.once('idle', () => { clearTimeout(t); ok(); }); });
        L.water = waterOf(this.map);
      }
      lap('frame');
      const water = L.water;
      // on the water: from the water nearest the start (a click on the shore, a beach, a car park by the lake)
      const from = wet ? nearestWater(L.start, water, 1000) : L.start;
      if (!from) {
        L.note = 'That start is over a kilometre from the water: click a shore, a beach or a landing for the loops to start from.';
        return;
      }
      let direction = L.dir;
      if (direction === 'wind') {
        try { const [s] = await pointForecasts([start]); direction = Math.round(sampleAt(s, Date.now() / 1000 + this.startOffsetH * 3600).dir); } catch { direction = null; }
      }
      const rp = routerOf(sport, this.style, this.wet.on);
      // directions not tried yet; when every one has been, the same ones turned a little
      let options = [];
      for (let k = 0; k < 3 && options.length < 3; k++) {
        const ask = { start: from, sport, targetM, direction, count: 12, water, spin: L.spin, skip: L.used };
        options = wet ? planWater({ ...ask, shore: rp.water.shore || 'open' }) : plan(ask);
        if (options.length < 3) { L.spin = (L.spin + 10) % 30; L.used = []; }
      }
      let calls = 0;
      // on land: one BRouter call a loop
      const profile = rp.profile || ACTIVITIES[sport].brouter;
      const opts = { portage: true, nogos: this.nogos, params: { ...rp.params, correctMisplacedViaPoints: 1 }, valhalla: rp.valhalla, maxWait: STAND_IN_AFTER };
      const length = (c) => { let m = 0; for (let i = 1; i < c.length; i++) m += dist(c[i - 1], c[i]); return m; };
      const runLand = async (o) => {
        calls++;
        try {
          const line = await routeLoop({ points: o.points, profile, opts });
          const m = length(line.coords);
          return { o, line, m, ratio: m / targetM, twice: twiceShare(line.coords) };
        } catch (err) { return { o, err }; }
      };
      // on the water: each leg by Polku's own router (CPU, no network but the water data)
      const waterOpts = { ...rp.water, craft: sport === 'swim' ? 'swim' : this.craft, at: this.startSec(), nogos: this.nogos };
      const runWater = async (o) => {
        try {
          const legs = [];
          for (let i = 1; i < o.points.length; i++) legs.push(await routeLeg({ from: o.points[i - 1], to: o.points[i], mode: 'water', opts: { portage: true, water: waterOpts } }));
          const coords = [], tags = [];
          legs.forEach((r, k) => { coords.push(...(k ? r.coords.slice(1) : r.coords)); tags.push(...r.tags); });
          const m = length(coords);
          let carry = 0;
          for (let k = 1; k < coords.length; k++) if (tags[k - 1] && tags[k - 1].portage) carry += dist(coords[k - 1], coords[k]);
          return { o, legs, line: { coords, tags, provider: 'water' }, m, ratio: m / targetM, twice: o.outBack ? 0 : twiceShare(coords), carry };
        } catch (err) { return { o, err }; }
      };
      const run = wet ? runWater : runLand;
      const budget = wet ? 9 : LOOP_CALLS; // loops tried in all (on the water: CPU time)
      const deadline = performance.now() + (wet ? 12e3 : 90e3); // and no more replacing after this
      const canTry = () => tried < budget && performance.now() < deadline;
      let tried = 0;
      const go = (o) => { tried++; L.used.push(o.bearing); return run(o); };
      const CARRY = 200; // m: on the water, a loop that carries more than this tries another way first
      const bad = (r) => r.err || r.ratio > 1.6 || r.twice > 0.55 || (wet && r.carry > CARRY);
      const queue = options.slice(3);
      // on land the three go at once (the router paces them); on the water one after another (one CPU)
      const found = wet ? [] : await Promise.all(options.slice(0, 3).map(go));
      if (wet) for (const o of options.slice(0, 3)) { found.push(await go(o)); L.progress = found.length; this.renderLoop(); }
      for (let k = 0; k < found.length; k++) {
        let r = found[k];
        while (bad(r) && queue.length && canTry()) r = await go(queue.shift());
        if (!r.err && (r.ratio < 0.8 || r.ratio > 1.25) && canTry()) {
          tried++;
          const again = await run(resize(r.o, r.m, targetM, from, water));
          const worse = again.err || (wet && again.carry > CARRY);
          if (!worse && Math.abs(again.ratio - 1) < Math.abs(r.ratio - 1)) r = again;
        }
        found[k] = r;
      }
      lap('route');
      const ok = found.filter((r) => !r.err && r.ratio < 2 && !(wet && r.carry > Math.max(400, 0.25 * r.m)));
      const limited = found.find((r) => r.err && r.err.name === 'Limited');
      // the same analysis as a route: time, climbing, heads-up
      for (const r of ok) {
        r.a = await analyse({ coords: r.line.coords, attrs: r.line.tags.map((t) => ({ mode: wet ? 'water' : 'auto', tags: t || {} })) }, this.timeOpt());
        if (!wet) r.carry = 0;
        r.events = wet ? r.legs.flatMap((l) => (l.water && l.water.events) || []) : [];
        r.score = loopScore({ km: r.a.total / 1000, targetKm: targetM / 1000, twice: r.twice, warnings: r.a.warnings.filter((w) => !/^Carry/.test(w.text)).length + (r.a.trailWarn || []).length + r.events.length, carryM: wet ? r.carry : 0 }) + (r.o.outBack ? 10 : 0); // a ring, where there's room for one
      }
      lap('analyse');
      L.timing = { ...T, t: undefined, tried };
      ok.sort((x, y) => x.score - y.score);
      const n0 = L.results.length;
      L.results = L.results.concat(ok.slice(0, LOOP_MAX - n0).map((r, i) => ({ ...r, letter: LOOP_LETTERS[n0 + i], color: LOOP_COLORS[n0 + i] })));
      L.targetM = targetM;
      L.calls = (L.calls || 0) + calls;
      L.on = ok.length ? n0 : L.on;
      L.note = !ok.length ? (limited ? limited.err.message : more ? 'No more loops worked out here — try another length or start.'
        : wet ? 'No loop worked out on the water here — try another length, or a start on a bigger lake or the sea.' : 'No loop worked out here — try another length or start, or click the map nearer to paths.') : '';
      this.drawLoops();
      if (ok.length) {
        const bb = bbox(L.results.flatMap((r) => r.line.coords));
        this.map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: this.viewPadding(), duration: 600, maxZoom: 15 });
      }
    } finally {
      L.busy = false;
      L.progress = 0;
      this.renderLoop();
      // the cards into view (a phone's half sheet starts at the choices); after "More loops", the new ones
      requestAnimationFrame(() => {
        const cards = this.els.loopBox.querySelectorAll('.loop-card');
        const c = (more && cards[L.on]) || this.els.loopBox.querySelector('.loop-cards, .note');
        if (c) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }
  }

  drawLoops() {
    const L = this.loop;
    this.app.setData('loops', { type: 'FeatureCollection', features: L.results.map((r, i) => ({ type: 'Feature', properties: { color: r.color, on: i === L.on }, geometry: { type: 'LineString', coordinates: r.line.coords } })) });
  }

  // A loop picked: a normal route. Its via points move onto the line (the
  // nearest spot, in order), so the legs split exactly and nothing is routed again.
  pickLoop(k) {
    const r = this.loop.results[k];
    if (!r) return;
    if (r.legs) { // on the water: its legs as they were routed, start → via points → start
      this.commit();
      this.points = r.o.points.map((p) => p.slice());
      this.legs = r.legs.map((res) => ({ mode: 'water', status: 'ok', result: res }));
      // a leg routed without a source that was slow then is routed again (its answer is in the cache by now)
      this.legs.forEach((l, i) => { l.key = l.result.water && l.result.water.missing && l.result.water.missing.length ? null : this.legKey(i).key; });
      this.routeName = '';
      this.closeLoop();
      this.update();
      this.fitRoute();
      toast(`Loop ${r.letter} is your route now — drag it or its points to change it`);
      return;
    }
    const c = r.line.coords, tags = r.line.tags;
    const start = r.o.points[0];
    const pts = [start.slice()], cuts = [0];
    for (const v of r.o.points.slice(1, -1)) {
      let best = -1, bd = Infinity;
      for (let i = cuts[cuts.length - 1] + 1; i < c.length - 1; i++) { const d = dist(c[i], v); if (d < bd) { bd = d; best = i; } }
      if (best < 0 || bd > 600) continue; // trimmed away: one point fewer
      cuts.push(best);
      pts.push([+c[best][0].toFixed(6), +c[best][1].toFixed(6)]);
    }
    cuts.push(c.length - 1);
    pts.push(start.slice());
    this.commit();
    this.points = pts;
    this.legs = cuts.slice(1).map((b, i) => ({ mode: 'auto', status: 'ok', result: { coords: c.slice(cuts[i], b + 1), tags: tags.slice(cuts[i], b), portage: [], provider: r.line.provider } }));
    this.legs.forEach((l, i) => { l.key = this.legKey(i).key; });
    this.routeName = '';
    this.closeLoop();
    this.update();
    this.fitRoute();
    toast(`Loop ${r.letter} is your route now — drag it or its points to change it`);
  }

  renderLoop() {
    const box = this.els && this.els.loopBox;
    if (!box) return;
    const L = this.loop;
    this.els.quickLoop.setAttribute('aria-pressed', String(L.open));
    this.els.quickLoop.hidden = !roundTripSports.includes(this.app.activity());
    this.setSection('loop', { empty: !L.open, summary: L.results.length ? `${L.results.length} loops` : '' });
    this.renderStart();
    if (!L.open) { box.innerHTML = ''; return; }
    const sport = this.app.activity();
    box.innerHTML = '';
    const close = h('button', { type: 'button', class: 'btn', onclick: () => this.closeLoop() }, 'Close');
    if (!roundTripSports.includes(sport)) {
      box.append(h('p', { class: 'note' }, 'No round trips for this sport yet.'), close);
      return;
    }
    const pre = LOOP_PRESETS[sport] || LOOP_PRESETS.mtb;
    const row = (label, ...kids) => h('div', { class: 'style-ctl' }, h('span', { class: 'style-label' }, label), ...kids);
    const DIR_NAME = { 0: 'north', 45: 'north-east', 90: 'east', 135: 'south-east', 180: 'south', 225: 'south-west', 270: 'west', 315: 'north-west', wind: 'into the wind first' };
    // with loops to look at, the choices fold into one line (results first, on a phone too)
    if (L.results.length && !L.editing) {
      box.append(h('div', { class: 'loop-sum' },
        h('span', {}, `${L.mode === 'min' ? `${L.min} min` : `${L.km} km`} · ${L.dir == null ? 'any direction' : DIR_NAME[L.dir]} · from ${L.startLabel}`),
        h('button', { type: 'button', class: 'btn', onclick: () => { L.editing = true; this.renderLoop(); } }, 'Change'),
        close));
      this.renderLoopCards(box, sport);
      return;
    }
    // where from
    box.append(row('Start', h('span', { class: 'loop-start' }, `From ${L.startLabel || 'the map centre'}`)),
      h('div', { class: 'loop-starts' },
        h('button', { type: 'button', class: 'chip', onclick: () => { const c = this.map.getCenter(); this.setLoopStart([+c.lng.toFixed(6), +c.lat.toFixed(6)], 'the map centre'); } }, 'Map centre'),
        h('button', { type: 'button', class: 'chip', onclick: () => this.loopFromHere() }, 'My location'),
        this.points.length ? h('button', { type: 'button', class: 'chip', onclick: () => this.setLoopStart(this.points[0].slice(), 'your route’s start') }, 'Route start') : null,
        h('span', { class: 'style-help loop-hint' }, 'or click the map')));
    // how long
    const unit = L.mode === 'min' ? 'min' : 'km';
    const val = L.mode === 'min' ? L.min : L.km;
    const input = h('input', { type: 'number', class: 'loop-len', min: '1', step: L.mode === 'min' ? '5' : '1', value: String(val), 'aria-label': L.mode === 'min' ? 'Length in minutes' : 'Length in kilometres',
      onchange: (e) => { const v = Math.max(1, Math.min(L.mode === 'min' ? 600 : 300, +e.target.value || val)); if (L.mode === 'min') L.min = v; else L.km = v; L.results = []; this.app.setData('loops', EMPTY); this.renderLoop(); } });
    box.append(row(L.mode === 'min' ? 'Time' : 'Distance',
      h('div', { class: 'seg small', role: 'group', 'aria-label': 'Distance or time' }, ...[['km', 'km'], ['min', 'Time']].map(([k, t]) => h('button', { type: 'button', 'aria-pressed': String(L.mode === k), onclick: () => { L.mode = k; L.results = []; this.renderLoop(); } }, t))),
      h('label', { class: 'loop-len-box' }, input, h('span', {}, unit))),
      h('div', { class: 'loop-starts' }, ...(L.mode === 'min' ? pre.min : pre.km).map((v) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(v === val), onclick: () => { if (L.mode === 'min') L.min = v; else L.km = v; L.results = []; this.app.setData('loops', EMPTY); this.renderLoop(); } },
        L.mode === 'min' ? (v >= 60 ? `${v / 60} h` : `${v} min`) : `${v} km`))));
    // which way
    const dirs = [[null, 'Any'], [0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
    if (sport !== 'hike' && sport !== 'run') dirs.push(['wind', 'Into the wind first']);
    box.append(row('Direction', h('div', { class: 'style-flags', role: 'group', 'aria-label': 'Direction' }, ...dirs.map(([d, t]) => h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(L.dir === d), title: d === 'wind' ? 'Head out into the wind and come back with it behind you' : '',
      onclick: () => { L.dir = d; L.results = []; this.app.setData('loops', EMPTY); this.renderLoop(); },
    }, t)))));
    // go
    const used = L.gens.filter((t) => Date.now() - t < 600e3).length;
    box.append(h('div', { class: 'loop-go' },
      h('button', { type: 'button', class: 'btn primary', disabled: L.busy, onclick: () => this.generateLoops(), html: L.busy ? this.loopBusyText() : `${icon('roundtrip', 16)} ${L.results.length ? 'Make new loops' : 'Make 3 loops'}` }),
      close),
    h('p', { class: 'style-help loop-cost' }, waterLoop(sport)
      ? `No routing calls: Polku’s own water router works the loops out on this device, a few seconds each. In your route style (${styleName(sport, this.style)}).`
      : `Three routing calls, up to six if loops need adjusting${used ? ` · ${used} of ${LOOP_CAP} round trips in the last 10 minutes` : ''}. In your route style (${styleName(sport, this.style)}).`));
    if (L.note) box.append(h('p', { class: 'note' }, L.note));
    if (L.results.length) this.renderLoopCards(box, sport);
  }

  renderLoopCards(box, sport) {
    const L = this.loop;
    const wet = waterLoop(sport);
    const list = h('div', { class: 'loop-cards' });
    const best = L.results.reduce((m, r, i) => (m < 0 || r.score < L.results[m].score ? i : m), -1);
    const pick = (i) => { L.on = i; this.drawLoops(); this.markLoopCards(); };
    L.results.forEach((r, i) => {
      const a = r.a;
      let what, notes;
      if (wet) {
        // on the water: carrying, and what the water router noted (shipping lanes, rough water, rocks)
        const n = (k) => r.events.filter((e) => e.kind === k).length;
        what = r.carry > 30 ? `carry ${fmtDist(r.carry)}` : 'no carries';
        notes = [n('ship') ? `${n('ship')} shipping lane${n('ship') > 1 ? 's' : ''}` : '', n('rough') ? 'rough water' : '', n('hazard') ? 'near rocks' : '', n('harbour') ? 'a harbour' : ''].filter(Boolean);
        notes = [r.o.outBack ? 'out and back' : '', notes.length ? notes.join(' · ') : 'nothing to note on the water', r.twice > 0.05 ? `${Math.round(r.twice * 100)} % paddled twice` : ''];
      } else {
        const trails = a.ways.filter(([k]) => k === 'path' || k === 'track').reduce((m, [, d]) => m + d, 0);
        const PAVED_S = ['asphalt', 'paved', 'concrete', 'paving_stones', 'sett', 'chipseal', 'concrete:plates', 'unknown'];
        const unpaved = a.surfaces.filter(([k]) => !PAVED_S.includes(k)).reduce((m, [, d]) => m + d, 0);
        what = `${sport === 'road' || sport === 'gravel' ? `unpaved ${Math.round((100 * unpaved) / a.total)} %` : `trails ${Math.round((100 * trails) / a.total)} %`}`;
        const hu = a.warnings.length + (a.trailWarn || []).length;
        notes = [r.twice > 0.05 ? `${Math.round(r.twice * 100)} % ridden twice` : 'no stretch twice', hu ? `${hu} heads-up` : 'no heads-up', r.line.provider === 'valhalla' ? 'via Valhalla' : ''];
      }
      const card = h('div', { class: `loop-card${i === L.on ? ' on' : ''}`, role: 'button', tabindex: '0', onmouseenter: () => pick(i), onfocus: () => pick(i), onclick: () => pick(i) },
        h('div', { class: 'loop-card-head' }, h('span', { class: 'loop-dot', style: `background:${r.color}` }, r.letter), h('b', {}, fmtDist(a.total)), i === best ? h('span', { class: 'loop-best' }, 'Closest match') : null),
        h('div', { class: 'loop-card-line' }, `${fmtDuration(a.time)} · ${wet ? '' : `↑${Math.round(a.up)} m · `}${what}`),
        h('div', { class: 'loop-card-line muted' }, notes.filter(Boolean).join(' · ')),
        h('button', { type: 'button', class: 'btn', onclick: (e) => { e.stopPropagation(); this.pickLoop(i); } }, 'Use this loop'));
      list.append(card);
    });
    // none of them? three more, in other directions (the ones there are stay)
    if (L.results.length < LOOP_MAX) {
      list.append(h('button', { type: 'button', class: 'loop-card loop-more', disabled: L.busy, onclick: () => this.generateLoops({ more: true }),
        title: wet ? 'Three more loops in other directions (on this device: no routing calls)' : 'Three more loops in other directions: up to six routing calls' },
      h('span', { html: icon('roundtrip', 18) }), h('b', {}, L.busy ? this.loopBusyText() : 'More loops'), h('small', {}, L.busy ? '' : 'three more, in other directions')));
    }
    box.append(list);
  }

  loopBusyText() {
    const L = this.loop;
    return L.progress ? `Making loops… ${L.progress} of 3` : 'Making loops…';
  }

  markLoopCards() { this.els.loopBox.querySelectorAll('.loop-card:not(.loop-more)').forEach((c, i) => c.classList.toggle('on', i === this.loop.on)); }

  // ---------------------------------------------------------------- route style
  savedStyle(sport) { return store.get('styles', {})[sport] || defaultStyle(); }
  // the style a leg in `sport` is routed with (unless it has its own): the route's for the map's sport, else yours for that sport
  styleOf(sport) { return sport === this.app.activity() ? this.style : this.savedStyle(sport); }

  wetFor(style) { const w = (style && style.wet) || 'auto'; return w === 'yes' || (w === 'auto' && this.wet.on); }

  // The Route style section: presets, the sport's controls, wet ground, and
  // what the last change did. Scoped to one leg when opened from a point.
  renderStyle() {
    const box = this.els && this.els.styleBox;
    if (!box) return;
    const route = this.mainSport(), rs = this.styleOf(route); // the route's sport: the map's may have moved on
    this.els.quickStyle.innerHTML = `${icon('sliders', 16)}<span><span class="q-pre">Style: </span><b>${escapeHtml(styleName(route, rs))}</b></span>`;
    this.fitHeaderSoon();
    if (this.styleLeg != null && !this.legs[this.styleLeg]) this.styleLeg = null;
    const leg = this.styleLeg;
    // a leg in another sport is styled in that sport's terms, from your style for it
    const sport = leg != null ? this.legSport(leg) : route;
    const base = this.styleOf(sport);
    const cat = STYLES[sport] || STYLES.mtb;
    const own = leg != null ? this.legs[leg].style : null;
    const st = (leg != null && own) || base;
    const vals = valuesOf(sport, st);
    const custom = isCustom(sport, st);
    const set = (next) => this.setStyle(next, leg);
    const ownCount = this.legs.filter((l) => l.style).length;
    this.setSection('style', { summary: `${styleName(route, rs)}${ownCount ? ` · ${ownCount} leg${ownCount > 1 ? 's' : ''} with their own` : ''}` });
    box.innerHTML = '';
    if (leg != null) {
      box.append(h('div', { class: 'seg small full style-scope', role: 'group', 'aria-label': 'What the style is for' },
        h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => { this.styleLeg = null; this.renderStyle(); } }, 'Whole route'),
        h('button', { type: 'button', 'aria-pressed': 'true' }, `${this.nameOf(leg)} → ${this.nameOf(leg + 1)}`)),
      h('p', { class: 'note' }, own ? 'This leg has its own style; the rest of the route keeps the route’s.' : sport === route ? `This leg follows the route’s style (${styleName(sport, rs)}). Pick one to give it its own.` : `This ${ACTIVITIES[sport].label.toLowerCase()} leg has your ${ACTIVITIES[sport].label} style (${styleName(sport, base)}). Pick one to give it its own.`));
    }
    // presets, in the sport's words
    box.append(h('div', { class: 'style-presets', role: 'group', 'aria-label': 'Route style' },
      ...cat.presets.map(([k, label]) => h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(!custom && st.p === k && (leg == null || !!own)),
        onclick: () => set({ p: k, v: {}, wet: st.wet || 'auto' }),
      }, label)),
      custom ? h('span', { class: 'chip chip-on', 'aria-hidden': 'true' }, 'Custom') : null));
    // the controls this sport's router really has
    for (const ctl of cat.controls) {
      const row = h('div', { class: 'style-ctl' }, h('span', { class: 'style-label' }, ctl.label));
      if (ctl.type === 'flags') {
        row.append(h('div', { class: 'style-flags', role: 'group', 'aria-label': ctl.label }, ...ctl.flags.map((f) => {
          const on = vals[ctl.id].includes(f.key);
          return h('button', { type: 'button', class: 'chip', 'aria-pressed': String(on), onclick: () => set({ ...st, v: { ...st.v, [ctl.id]: on ? vals[ctl.id].filter((x) => x !== f.key) : [...vals[ctl.id], f.key] } }) }, f.text);
        })));
      } else {
        row.append(h('div', { class: 'seg small', role: 'group', 'aria-label': ctl.label }, ...ctl.steps.map((sp) => h('button', {
          type: 'button', 'aria-pressed': String(vals[ctl.id] === sp.key), onclick: () => set({ ...st, v: { ...st.v, [ctl.id]: sp.key } }),
        }, sp.text))));
      }
      box.append(row, h('p', { class: 'style-help' }, ctl.help));
    }
    if (hasWet(sport)) {
      const w = st.wet || 'auto';
      box.append(h('div', { class: 'style-ctl' }, h('span', { class: 'style-label' }, 'Wet ground'),
        h('div', { class: 'seg small', role: 'group', 'aria-label': 'Wet ground' }, ...[['auto', 'Auto'], ['yes', 'Wet'], ['no', 'Dry']].map(([k, label]) => h('button', {
          type: 'button', 'aria-pressed': String(w === k), onclick: () => set({ ...st, wet: k }),
        }, label)))), this.els.wetNote = h('p', { class: 'style-help' }));
      this.renderStyleWet(st);
    }
    if (this.styleDelta) box.append(h('p', { class: 'style-delta', 'aria-live': 'polite' }, `Last change: ${this.styleDelta}`));
    box.append(h('p', { class: 'note' }, leg != null ? 'Only this leg is routed again.'
      : `${cat.note || `“${cat.presets[0][1]}” is the routing service’s own profile for the sport.`} A change re-routes the route, usually in one call. To give one leg a different style, open a point’s menu.`));
  }

  renderStyleWet(st = (this.styleLeg != null && this.legs[this.styleLeg] && this.legs[this.styleLeg].style) || this.styleOf(this.mainSport())) {
    const el = this.els && this.els.wetNote;
    if (!el) return;
    const w = (st && st.wet) || 'auto';
    const mm = this.wet.mm;
    el.textContent = w === 'yes' ? 'Muddy paths and wet roots cost more.'
      : w === 'no' ? 'Treated as dry, whatever the weather.'
        : mm == null ? 'Auto: checks the rain of the last 24 hours at the start.'
          : this.wet.on ? `Auto: ${mm} mm of rain in the last 24 hours here — muddy paths cost more.` : `Auto: dry enough (${mm} mm in the last 24 hours).`;
  }

  /**
   * Set the style of the whole route (leg null) or of one leg. The route's
   * style is also remembered for the sport. Re-routing waits 700 ms, so
   * clicking through a few controls costs one batch of calls, not several.
   */
  setStyle(style, leg = null) {
    const sport = this.mainSport(); // the route's (the map's sport may have moved on)
    this.commit();
    this.styleBefore = { stats: this.styleStats(), a: this.analysis }; // compared once the new route is in
    if (leg == null) {
      if (sport === this.app.activity()) this.style = style;
      store.set('styles', { ...store.get('styles', {}), [sport]: style });
    } else if (this.legs[leg]) {
      this.legs[leg].style = style; // null: back to the route's
    }
    this.renderStyle();
    this.renderToolbarState();
    clearTimeout(this.styleTimer);
    this.styleTimer = setTimeout(() => this.update(), 700);
  }

  // Wet ground "auto": rain in the last 24 h at the start (one cached call an hour).
  async checkWet() {
    const sport = this.mainSport();
    if (!hasWet(sport) || !this.points.length) return;
    const uses = [this.styleOf(sport), ...this.legs.map((l) => l.style)].some((st) => st && (st.wet || 'auto') === 'auto');
    if (!uses) return;
    try {
      const mm = await recentRain(this.points[0]);
      const on = mm >= WET_MM;
      const was = this.wet.on;
      this.wet = { mm, on, at: Date.now() };
      if (on !== was) { this.renderStyle(); if (this.legs.length) this.update(); } else this.renderStyleWet();
    } catch { /* no forecast: keep the last known */ }
  }

  // what the comparison line measures: distance, climbing, and what the style is about for the sport
  styleStats() {
    const a = this.analysis;
    if (!a) return null;
    const share = (pairs, keys) => { const m = pairs.filter(([k]) => keys.includes(k)).reduce((s, [, d]) => s + d, 0); return Math.round((100 * m) / a.total); };
    const sport = this.mainSport();
    const PAVED_S = ['asphalt', 'paved', 'concrete', 'paving_stones', 'sett', 'chipseal', 'concrete:plates'];
    let what = null;
    if (sport === 'road' || sport === 'gravel') what = ['unpaved', 100 - share(a.surfaces, PAVED_S.concat(['unknown', 'water']))];
    else if (isWater(sport)) what = ['carries', Math.round(a.ways.filter(([k]) => k === 'portage').reduce((s, [, d]) => s + d, 0))];
    else what = ['trails', share(a.ways, ['path', 'track'])];
    return { km: a.total / 1000, up: a.up, what };
  }

  // Legs Valhalla routed while BRouter paused: ask BRouter again.
  rerouteWithBrouter() {
    let n = 0;
    for (const l of this.legs) if (l.result && l.result.provider === 'valhalla') { l.key = null; n++; }
    if (n) this.routeAll();
  }

  // Legs that waited for the service, or failed: route them again.
  retryFailed() {
    let n = 0;
    for (const l of this.legs) if (l.status === 'waiting' || l.status === 'error') { l.key = null; n++; }
    if (n) this.routeAll();
  }

  mergedLine() {
    const coords = [];
    const attrs = [];
    this.legs.forEach((leg, i) => {
      const r = leg.result;
      if (!r) return;
      const mode = leg.status === 'error' || leg.status === 'waiting' ? 'line' : leg.mode; // a stand-in is a straight line
      const sport = this.legSport(i);
      if (!coords.length) coords.push(r.coords[0]);
      for (let k = 1; k < r.coords.length; k++) {
        coords.push(r.coords[k]);
        attrs.push({ mode, tags: r.tags[k - 1] || {}, sport });
      }
    });
    return { coords, attrs };
  }

  async runAnalysis(gen) {
    const line = this.mergedLine();
    if (line.coords.length < 2) {
      this.analysis = null;
      this.renderAnalysis();
      return;
    }
    const a = await analyse(line, this.timeOpt());
    if (gen !== this.gen) return;
    this.analysis = a;
    Object.assign(a, (({ total, tAt, waits }) => ({ time: total, tAt, waits }))(this.timed(a)));
    a.waterWarn = this.waterWarnings();
    a.darkWarn = this.darkWarnings(a);
    this.renderAnalysis();
    this.loadWind(a);
    this.loadTrail(a);
  }

  // Heads-up when part of the trip is after sunset, or in the dark (past civil dusk), at
  // the times you'd be there (sun.js, no service). Before sunrise counts the same.
  darkWarnings(a) {
    const tAt = a.tAtWind || a.tAt;
    if (!tAt || !this.points.length) return [];
    const start = this.startSec(), n = a.along.length;
    const ll = this.points[0];
    const fmt = (sec) => new Date(sec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const water = this.routeSports().some(isWater);
    const out = [];
    for (const x of darkness(start, start + tAt[n - 1], ll)) {
      let i = 0;
      while (i < n - 1 && start + tAt[i] < x.from) i++;
      let j = i;
      while (j < n - 1 && start + tAt[j] < x.to) j++;
      const len = a.along[j] - a.along[i];
      if (len < 50) continue;
      // the sun's own times (sunset, dusk, sunrise), not where the trip happens to start or end in them
      const evening = new Date(x.sunFrom * 1000).getHours() >= 12;
      const already = x.sunFrom < x.from - 60; // dark (or after sunset) already when that part begins
      // how much of it is lit, where OSM says (lit=yes on the ways the router took)
      let litM = 0;
      for (let k = i + 1; k <= j; k++) if (((a.attr[k] || {}).tags || {}).lit === 'yes') litM += a.along[k] - a.along[k - 1];
      const lit = x.kind === 'dark' ? (litM >= 50 ? ` · ${fmtDist(litM)} of it lit` : ' · none of it lit, as far as OpenStreetMap says') : '';
      out.push(x.kind === 'twilight'
        ? { at: a.along[i], len, kind: 'dark', noAvoid: true, text: evening ? `After sunset (${fmt(x.sunFrom)}) for ${fmtDist(len)}` : `Before sunrise (${fmt(x.sunTo)}) for ${fmtDist(len)}`, note: evening ? 'twilight: light fading' : 'twilight: getting light' }
        : { at: a.along[i], len, kind: 'dark', noAvoid: true, text: `In the dark for ${fmtDist(len)}`, note: `${evening ? `${already ? 'dark since' : 'dark from'} ${fmt(x.sunFrom)}` : `light from ${fmt(x.sunTo)}`}${lit}${water ? ' · on the water a light is required after dark' : ' · take a light'}` });
    }
    return out;
  }

  // the sun at the start on the departure day, for "Departure & weather"
  sunLine() {
    if (!this.points.length) return '';
    const s = sunTimes(this.startSec(), this.points[0]);
    const fmt = (sec) => new Date(sec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (s.day === 'polar-day') return 'Midnight sun: the sun doesn’t set';
    if (s.day === 'polar-night') return s.dawn ? `Polar night: twilight ${fmt(s.dawn)}–${fmt(s.dusk)}` : 'Polar night: no daylight';
    return `Sunrise ${fmt(s.rise)} · sunset ${fmt(s.set)} · dark from ${fmt(s.dusk)}`;
  }

  // Departure in whole hours from now (the timeline's steps), as a select for the start's menu and row
  departSelect(done = () => {}) {
    const now = Date.now() / 1000, today = new Date().toDateString();
    const sel = h('select', { 'aria-label': 'Departure', onchange: (e) => { done(); this.setStartOffset(+e.target.value); } });
    for (let k = 0; k <= 48; k++) {
      const d = new Date((k ? (Math.floor(now / 3600) + k) * 3600 : now) * 1000);
      const day = d.toDateString() === today ? '' : `${d.toLocaleDateString([], { weekday: 'short' })} `;
      sel.append(h('option', { value: String(k) }, k ? `${day}${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Now'));
    }
    sel.value = String(this.startOffsetH);
    return sel;
  }

  // Heads-up from the water router (water.js events): shipping lanes and
  // harbours on the way, keep-clear zones it had to pass, rough water, and any
  // source that didn't answer. Positions along the whole route.
  waterWarnings() {
    const out = [];
    const missing = new Set();
    this.legs.forEach((leg, i) => {
      const wr = leg.mode === 'water' && leg.status === 'ok' && leg.result && leg.result.water;
      if (!wr) return;
      for (const m of wr.missing || []) missing.add(m);
      const base = this.lengthTo(i);
      for (const e of wr.events || []) {
        const at = base + e.at, len = e.len;
        if (e.kind === 'ship') {
          out.push(len > 600
            ? { at, len, kind: 'water', hide: 'Shipping lanes', noAvoid: true, text: `Along a shipping lane for ${fmtDist(len)}`, note: `${e.name ? `${e.name} · ` : ''}no way round it here: keep to its edge, ships can’t stop or turn` }
            : { at, len, kind: 'water', hide: 'Shipping lanes', noAvoid: true, text: `Crosses ${e.name ? `the ${e.name}` : 'a shipping lane'}`, note: 'cross quickly and straight, after looking both ways: ships can’t stop or turn' });
        } else if (e.kind === 'harbour') out.push({ at, len, kind: 'water', hide: 'Harbour basins', noAvoid: true, text: 'Through a harbour basin', note: 'boats coming and going' });
        else if (e.kind === 'hazard') out.push({ at, len, kind: 'water', hide: 'Rocks and shoals', text: 'Close to a marked rock or shoal', note: 'the only way here passes near a danger mark or a rock in OpenStreetMap' });
        else if (e.kind === 'rough') {
          const w = wr.wind;
          out.push({ at, len, kind: 'water', hide: 'Rough water', noAvoid: true, text: `Rough for a ${(CRAFT[wr.craft] || CRAFT.kayak).label.toLowerCase()}: waves up to about ${e.max.toFixed(1)} m`, note: w ? `${Math.round(w.speed)} m/s from the ${compass(w.dir)} over open water · an estimate from the forecast` : 'an estimate from the forecast' });
        }
      }
    });
    if (missing.size) out.push({ at: 0, len: 0, kind: 'water', noHide: true, noAvoid: true, text: `Not checked on the water: ${[...missing].join(', ')} didn’t answer`, note: 'routed without it; Retry by moving a point' });
    return out;
  }

  // Trail details along the route: the router's tags gave the first heads-up
  // (analysis.js); the trail-detail tiles (Overpass, the same as the map's Trail
  // details) add width and fallen trees mapped as points (js/trails.js), and it's
  // re-checked for boardwalks once we know whether it has rained. For every sport
  // on land, whether or not the map shows the layer: a fallen tree is in the way
  // of a gravel bike too.
  async loadTrail(a) {
    const opt = () => ({ activity: this.app.activity(), wet: this.wetFor(this.style) });
    a.trailWarn = trailWarnings(a, opt());
    this.renderWarnings();
    if (this.routeSports().every(isWater)) return;
    try {
      if (!(await detailsAlong(a)) || this.analysis !== a) return;
      a.trailWarn = trailWarnings(a, opt());
      a.trailMore = true; // width and points from OSM are in
      if (this.colorMode === 'width' || this.colorMode === 'vis') this.renderAnalysis();
      else this.renderWarnings();
    } catch { /* the router's tags still stand */ }
  }

  // ---------------------------------------------------------------- winter on the route (15b)
  // The snow on the ground along the route (the forecast's, at the hour you'd be there) when it
  // counts: 3 cm or more somewhere on it, and winter isn't set Off. With the winter classes of
  // the ways (OSM, winterAlong) once they're in. null: no snow to reckon with.
  snowOf(a, w) {
    const set = this.app.winter ? this.app.winter().setting : 'auto';
    if (set === 'off' || !w || !w.snow) return null;
    let max = 0;
    for (const v of w.snow) if (v > max) max = v;
    if (!(max >= 3)) return null;
    return { cm: w.snow, cls: a.winterCls || null, max };
  }
  // how much longer the snow makes the moving time (seconds), for Time & speed and Heads-up
  setSnow(a, snow) {
    a.snow = snow;
    a.snowSec = snow && a.wind ? estimateTime(a, this.timeOpt(), a.wind.head, snow).total - estimateTime(a, this.timeOpt(), a.wind.head).total : 0;
  }
  // the ways' winter classes along the route (Overpass's winter tiles, cached a week): the time
  // and Heads-up again with them
  async loadWinterAlong(a) {
    a.winterLoading = true;
    let cls = null;
    try { cls = await winterAlong(a); } catch { /* without: by surface only */ }
    if (this.analysis !== a || !cls || !a.wind) return;
    a.winterCls = cls;
    const snow = this.snowOf(a, a.wind);
    const t = this.timed(a, a.wind.head, snow);
    a.timeWind = t.total;
    a.tAtWind = t.tAt;
    a.waits = t.waits;
    this.setSnow(a, snow);
    this.renderAnalysis();
  }

  // Heads-up in winter: snow and fresh snow, slippery, the cold, the ways in winter, ice on the water
  winterWarnings(a) {
    const set = this.app.winter ? this.app.winter() : { on: false, setting: 'auto' };
    const w = a.wind;
    if (set.setting === 'off' || !w) return [];
    const winter = set.on || !!a.snow;
    const n = a.along.length, out = [];
    const tAt = a.tAtWind || a.tAt;
    const water = (i) => { const at = a.attr[i] || {}; return at.mode === 'water' || (at.tags || {}).route === 'water'; };
    // stretches where pred(i) holds: [{ i0, i1, len }]
    const stretches = (pred) => {
      const list = [];
      let cur = null;
      for (let i = 1; i < n; i++) {
        if (pred(i)) { if (!cur) cur = { i0: i - 1, i1: i, len: 0 }; cur.i1 = i; cur.len += a.along[i] - a.along[i - 1]; }
        else if (cur) { list.push(cur); cur = null; }
      }
      if (cur) list.push(cur);
      return list;
    };
    const sum = (list) => list.reduce((t, x) => t + x.len, 0);
    const bikeAt = (i) => groupOf((a.attr[i] && a.attr[i].sport) || this.app.activity()) === 'bike';
    if (winter && a.snow) {
      let lo = Infinity, hi = 0;
      for (let i = 1; i < n; i++) if (!water(i) && Number.isFinite(a.snow.cm[i])) { lo = Math.min(lo, a.snow.cm[i]); hi = Math.max(hi, a.snow.cm[i]); }
      if (hi >= 3) {
        const range = Math.round(lo) === Math.round(hi) ? `${Math.round(hi)} cm` : `${Math.round(Math.max(0, lo))}–${Math.round(hi)} cm`;
        out.push({ at: 0, len: 0, kind: 'winter', ic: 'snow', noAvoid: true, text: `Snow on the way: ${range}`, note: `the forecast's depth${a.snowSec >= 60 ? ` · slower going: about ${fmtDuration(a.snowSec)} more, in the time` : ''}${a.winterCls ? '' : ' · ploughed ways not known yet'}` });
      }
    }
    // snowing while you're out
    if (winter && w.snowfall) {
      let cm = 0;
      for (let i = 1; i < n; i++) if (Number.isFinite(w.snowfall[i])) cm += (w.snowfall[i] * (tAt[i] - tAt[i - 1])) / 3600;
      if (cm >= 2) out.push({ at: 0, len: 0, kind: 'winter', ic: 'snow', noAvoid: true, text: `Snowing on the way: about ${Math.round(cm)} cm while you’re out`, note: 'tracks fill in and trails close up as it falls' });
    }
    // slippery: rain or sleet around freezing, on land
    const slip = stretches((i) => !water(i) && w.temp[i] >= -2 && w.temp[i] <= 1.5 && w.precip[i] >= 0.1);
    if (sum(slip) >= 100) out.push({ at: a.along[slip[0].i0], len: sum(slip), kind: 'winter', ic: 'warn', noAvoid: true, text: `Slippery: rain or sleet around 0 °C for ${fmtDist(sum(slip))}`, note: 'water on ice is the worst: care on bridges, boardwalks and slopes; studded tyres if you have them' });
    // the cold, as it feels at your own speed (on land)
    let wc = Infinity, wcAt = 0;
    for (let i = 1; i < n; i++) {
      if (water(i)) continue;
      const kmh = ((a.along[i] - a.along[i - 1]) / Math.max(1, tAt[i] - tAt[i - 1])) * 3.6;
      const f = windChill(w.temp[i], w.speed[i], Math.min(40, kmh));
      if (f < wc) { wc = f; wcAt = i; }
    }
    if (wc <= -27) out.push({ at: a.along[wcAt], len: 0, kind: 'cold', ic: 'temp', noAvoid: true, text: `Frostbite risk: feels like ${Math.round(wc)} °C`, note: 'with the wind and your own speed · bare skin can freeze within half an hour: cover face and fingers' });
    else if (wc <= -15) out.push({ at: a.along[wcAt], len: 0, kind: 'cold', ic: 'temp', noAvoid: true, text: `Very cold: feels like ${Math.round(wc)} °C`, note: 'with the wind and your own speed · cover up, and keep a dry layer for stops' });
    // the ways in winter (OSM's winter tags along the route)
    if (winter && a.winterCls) {
      const c = a.winterCls, cls = (k) => (i) => c[i] === k && !water(i);
      const closed = stretches(cls('closed'));
      for (const x of closed.slice(0, 3)) if (x.len >= 20) out.push({ at: a.along[x.i0], len: x.len, kind: 'winter', ic: 'warn', osm: true, lngLat: a.pts[x.i0], text: `No access in winter: ${fmtDist(x.len)}`, note: 'marked closed to walking or cycling in winter (usually a ski track): Avoid routes round it' });
      const groomed = stretches(cls('groomed'));
      if (sum(groomed) >= 100) out.push({ at: a.along[groomed[0].i0], len: sum(groomed), kind: 'winter', ic: 'snow', noAvoid: true, osm: true, lngLat: a.pts[groomed[0].i0], text: `Beside a ski track for ${fmtDist(sum(groomed))}`, note: 'walking and cycling allowed: keep off the groomed track itself' });
      const unploughed = stretches((i) => c[i] === 'unploughed' && bikeAt(i));
      if (sum(unploughed) >= 100) out.push({ at: a.along[unploughed[0].i0], len: sum(unploughed), kind: 'winter', ic: 'snow', noAvoid: true, osm: true, lngLat: a.pts[unploughed[0].i0], text: `Not ploughed in winter: ${fmtDist(sum(unploughed))}`, note: 'snow and ruts: slow going by bike' });
      const slowOpen = stretches((i) => c[i] === 'open3' && bikeAt(i) && a.snow && a.snow.cm[i] >= 5);
      if (sum(slowOpen) >= 100) out.push({ at: a.along[slowOpen[0].i0], len: sum(slowOpen), kind: 'winter', ic: 'snow', noAvoid: true, osm: true, lngLat: a.pts[slowOpen[0].i0], text: `Opens slowly after snow: ${fmtDist(sum(slowOpen))}`, note: 'little travelled in winter: maybe not packed down yet' });
    }
    // on the water in the ice season
    const wet = stretches(water);
    if (sum(wet) > 0) {
      let cold = Infinity;
      for (let i = 1; i < n; i++) if (water(i)) cold = Math.min(cold, w.temp[i]);
      if (set.on || cold <= 0.5) out.push({ at: a.along[wet[0].i0], len: sum(wet), kind: 'water', ic: 'warn', noAvoid: true, text: 'Ice season: the water may be frozen or partly frozen', note: 'Polku can’t see the ice: check FMI’s ice chart (Layers → Winter → Sea ice) and local reports, and never trust ice you haven’t checked' });
    }
    return out;
  }

  // what the time estimate needs: the sport, the craft and your speeds
  timeOpt() {
    const activity = this.app.activity();
    const speedsBy = Object.fromEntries([activity, ...this.routeSports()].map((sp) => [sp, speedsFor(sp)]));
    return { activity, craft: this.craft, speeds: speedsFor(activity), speedsBy };
  }

  // Changeovers and stops along the route: where (metres), the changeover's seconds
  // and the stop. How long a night lasts depends on when you get there (timed()).
  waitsAlong() {
    const out = [];
    for (let i = 1; i < this.legs.length; i++) {
      const c = this.changeAt(i), stop = this.stopAt(i);
      const change = c ? c.min * 60 : 0;
      if (change > 0 || stop) out.push({ i, at: this.lengthTo(i), change, stop, from: c && c.from, to: c && c.to });
    }
    return out;
  }

  // The time along the route: moving at each stretch's own sport, plus the changeovers
  // and stops (so arrival times, and the weather when you get there, move on by them).
  // A night lasts until its morning hour after you arrive, so it's timed on the way.
  timed(a, head = null, snow = null) {
    const t = estimateTime(a, this.timeOpt(), head, snow);
    const waits = this.waitsAlong();
    // waitAt[i]: the wait that starts with sample i (so breakdowns can leave it out of moving time)
    const waitAt = new Float32Array(a.along.length);
    let k = 0, add = 0;
    if (waits.length) {
      const start = this.startSec();
      for (let i = 0; i < a.along.length; i++) {
        while (k < waits.length && a.along[i] >= waits[k].at - 1) {
          const w = waits[k++];
          w.arrive = start + t.tAt[i] + add;
          w.rest = restSec(w.stop, w.arrive, w.change);
          w.sec = w.change + w.rest;
          add += w.sec;
          waitAt[i] += w.sec;
        }
        t.tAt[i] += add;
      }
      t.total = t.tAt[a.along.length - 1];
    }
    t.waits = waits;
    a.waitAt = waitAt;
    return t;
  }

  // when you'd reach point i (epoch seconds, before any stop there), or null
  arriveAt(i) {
    const a = this.analysis;
    const tAt = a && (a.tAtWind || a.tAt);
    if (!tAt) return null;
    const start = a.wind ? a.wind.startSec : this.startSec();
    if (i <= 0) return start;
    const at = this.lengthTo(i);
    let k = 0;
    while (k < a.along.length - 1 && a.along[k] < at - 1) k++;
    return start + tAt[k] - (a.waitAt ? a.waitAt[k] : 0);
  }
  // a clock time on the trip: "13:40", with the day when it isn't the day you leave ("Thu 08:00")
  clockOf(sec) {
    const d = new Date(sec * 1000), t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date(this.startSec() * 1000).toDateString() ? t : `${d.toLocaleDateString([], { weekday: 'short' })} ${t}`;
  }

  // Speeds changed: re-time the route (no routing, no DEM), then the route
  // weather, since arrival times move.
  retime() {
    const a = this.analysis;
    if (!a) return;
    const t = this.timed(a);
    a.time = t.total;
    a.tAt = t.tAt;
    a.waits = t.waits;
    a.timeWind = null;
    a.tAtWind = null;
    this.renderAnalysis();
    clearTimeout(this.retimeTimer);
    this.retimeTimer = setTimeout(() => { if (this.analysis === a) this.loadWind(a); }, 400);
  }

  startSec() {
    const now = Date.now() / 1000;
    if (!this.startOffsetH) return Math.round(now / 60) * 60;
    return (Math.floor(now / 3600) + this.startOffsetH) * 3600;
  }

  // Departure in whole hours from now. Shared with the weather time bar:
  // `fromMap` means the map slider moved, so don't echo it back.
  setStartOffset(k, { fromMap = false } = {}) {
    k = Math.max(0, Math.min(48, Math.round(k)));
    if (k === this.startOffsetH) return;
    this.startOffsetH = k;
    for (const sel of this.panel.querySelectorAll('.wpl-depart select')) sel.value = String(k);
    const sel = this.els.wind.querySelector('.start-select');
    if (sel) sel.value = String(k);
    if (!fromMap && this.app.onStartChange) this.app.onStartChange(k);
    clearTimeout(this.windTimer);
    // playback moves an hour a second; let it settle a little before re-fetching
    this.windTimer = setTimeout(() => {
      // water legs that keep out of the wind follow the forecast for the new hour (water.js keeps routes per wind class)
      if (this.legs.some((l, i) => l.mode === 'water' && this.routerFor(i).water.wind !== 'ignore')) { this.routeAll(); return; }
      if (this.analysis) this.loadWind(this.analysis);
    }, fromMap ? 600 : 0);
  }

  // Wind at the time each part of the route is reached: time the route without
  // wind, fetch the forecast, re-time it with the wind, and sample again.
  async loadWind(a) {
    const opt = this.timeOpt();
    const startSec = this.startSec();
    a.windError = false;
    a.darkWarn = this.darkWarnings(a); // the departure may have moved (without the wind's times, these do)
    try {
      let w = await windAlong(a.pts, a.along, a.tAt, startSec);
      let t = this.timed(a, w.head, this.snowOf(a, w));
      w = await windAlong(a.pts, a.along, t.tAt, startSec); // same forecast, cached
      const snow = this.snowOf(a, w);
      t = this.timed(a, w.head, snow);
      if (this.analysis !== a) return;
      a.wind = { ...w, startSec };
      a.timeWind = t.total;
      a.tAtWind = t.tAt;
      a.waits = t.waits; // nights timed with the wind's arrival times
      this.setSnow(a, snow);
      if (snow && !a.winterCls && !a.winterLoading) this.loadWinterAlong(a);
      a.darkWarn = this.darkWarnings(a);
    } catch (err) {
      if (this.analysis !== a) return;
      a.windError = err && err.name === 'Limited' ? err.message : true; // says which service and when
    }
    this.renderAnalysis();
    this.loadHazards(a);
  }

  // Road works, incidents, slippery roads and busy roads along the route.
  async loadHazards(a) {
    if (!this.app.hazards) return;
    try {
      const hz = await this.app.hazards(a, { activity: this.app.activity(), startSec: this.startSec() });
      if (this.analysis !== a) return;
      a.hazards = hz;
      this.renderWarnings();
    } catch { /* keep the static warnings */ }
  }

  // ---------------------------------------------------------------- map interaction
  onMapClick(e) {
    if (!this.active || Date.now() < this.noClickUntil) return; // the click that ends a drag or a long-press
    // a menu or card was open: this click (a tap beside it) closes it, and adds nothing
    if (this.popupAtPress) { this.popupAtPress = false; return; }
    if (this.loop.open && !this.loop.busy) { this.setLoopStart([+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)], 'the spot you clicked'); return; }
    const ng = this.map.getLayer('nogo-fill') && this.map.queryRenderedFeatures(e.point, { layers: ['nogo-fill'] })[0];
    if (ng) { this.openNogoMenu(ng.properties.i, e.lngLat); return; }
    const touch = this.isTouch();
    const r = touch ? 12 : 6;
    const hit = this.map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], { layers: ['route-casing'] }).find((x) => x.properties.kind === 'leg');
    const ll = [+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)];
    // the line itself: a click or a tap gets that part's menu, mouse and finger alike (a point
    // added by mistake is easy, and there's more to do with a part of the route than add one);
    // "Add a point here" comes first in it, and a drag still reshapes the route
    if (hit && !hit.properties.loading) this.openLegMenu(hit.properties.leg, e.lngLat);
    else {
      const first = !this.points.length;
      this.closeStartTip();
      this.addPoint(ll);
      this.sportHint();
      if (first) this.startTip(ll); // the start is down: a loop from here is one tap more
    }
    this.autoPeek();
  }

  // A new leg that is mostly water in a land sport (shore to shore across a lake), or
  // mostly land on a water leg: offer the other sport for it, one tap, instead of a
  // long way round or a long carry. Reads the water drawn on the map (no request).
  sportHint() {
    const i = this.legs.length - 1;
    if (i < 0 || !this.map.getLayer('water')) return;
    const leg = this.legs[i], sp = this.legSport(i);
    if (leg.mode === 'line' || leg.mode === 'fixed') return;
    const a = this.points[i], b = this.points[i + 1];
    if (dist(a, b) < 150) return;
    let wet = 0, n = 0;
    for (let k = 1; k < 24; k++) {
      const q = this.map.project([a[0] + ((b[0] - a[0]) * k) / 24, a[1] + ((b[1] - a[1]) * k) / 24]);
      if (q.x < 0 || q.y < 0 || q.x > this.map.getCanvas().clientWidth || q.y > this.map.getCanvas().clientHeight) continue;
      n++;
      if (this.map.queryRenderedFeatures([q.x, q.y], { layers: ['water'] }).length) wet++;
    }
    if (n < 8) return;
    const share = wet / n;
    if (share > 0.6 && !isWater(sp)) {
      toast('This leg is mostly water.', { ms: 7000, action: { label: 'Paddle it', fn: () => this.setLegSport(this.legs.indexOf(leg), 'paddle') } });
    } else if (share < 0.25 && isWater(sp) && leg.mode === 'water') {
      const land = !isWater(this.app.activity()) ? this.app.activity() : 'hike';
      toast(`This leg is mostly land: the ${ACTIVITIES[sp].label.toLowerCase()} leg would carry over it.`, { ms: 7000, action: { label: `${ACTIVITIES[land].label} instead`, fn: () => this.setLegSport(this.legs.indexOf(leg), land) } });
    }
  }

  onMapMove(e) {
    const a = this.analysis;
    if (!a || this.panel.hidden || this.edit) return;
    const hit = this.map.queryRenderedFeatures([[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]], { layers: ['route-casing'] }).length;
    this.map.getCanvas().style.cursor = hit ? 'grab' : 'crosshair'; // the line can be dragged
    if (!hit) {
      if (this.mapHover) { this.mapHover = false; this.chart.setHover(-1); this.app.setData('routeHover', EMPTY); this.app.routeTip(null); }
      return;
    }
    const p = [e.lngLat.lng, e.lngLat.lat];
    const k = Math.cos((p[1] * Math.PI) / 180);
    let best = -1, bd = Infinity;
    for (let i = 0; i < a.pts.length; i++) {
      const dx = (a.pts[i][0] - p[0]) * k, dy = a.pts[i][1] - p[1];
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    this.mapHover = true;
    const d = routeReadout(a, best, this.roadAt(best));
    d.lines.push('<i class="tip-hint">Click for options · drag to reshape</i>');
    const onMap = this.app.routeTip(e.originalEvent, d);
    this.chart.setHover(best, !onMap);
    this.hoverAt(best, true);
  }

  // the name of the road or path at analysis sample i ('' if none known)
  roadAt(i) {
    const a = this.analysis;
    if (!a || i < 0) return '';
    const t = a.attr[i] && a.attr[i].tags;
    if (t && t.name) return t.name;
    if (a.way[i] === 'water') return '';
    const p0 = a.pts[Math.max(0, i - 2)], p1 = a.pts[Math.min(a.pts.length - 1, i + 2)];
    const dir = (Math.atan2((p1[0] - p0[0]) * Math.cos((p0[1] * Math.PI) / 180), p1[1] - p0[1]) * 180) / Math.PI;
    return this.roads.nameAt(a.pts[i], 15, dir);
  }

  hoverAt(i, fromMap = false) {
    if (i == null || i < 0 || !this.analysis) { this.app.setData('routeHover', EMPTY); return; }
    this.app.setData('routeHover', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: this.analysis.pts[i] } }] });
    if (!fromMap) this.mapHover = false;
  }

  // The Waypoints section: every point in order with its name and distance.
  // Rename in place; reorder by dragging the grip or with ↑/↓ (keyboard and
  // screen readers); remove; click a row to see the point on the map.
  renderWaypoints() {
    const box = this.els && this.els.points;
    if (!box) return;
    if (box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return; // don't take a name you're typing
    const n = this.points.length;
    this.shownNames = this.points.map((_, i) => this.autoName(i)).join('|');
    this.setSection('points', { count: n || '', empty: !n, summary: n > 1 ? `${this.nameOf(0)} → ${this.nameOf(n - 1)}` : '' });
    box.innerHTML = '';
    // the whole list the other way round (the same as Reverse in the tools)
    const showLegs = n > 1 && store.get('legSettings', false);
    for (const k of this.openLegs) if (k >= n - 1) this.openLegs.delete(k); // rows that are gone
    const loops = roundTripSports.includes(this.app.activity());
    this.els.pointsFoot.replaceChildren(...[
      loops ? h('button', { type: 'button', class: 'btn', title: 'Loops of the length you choose, from your start', onclick: () => this.openLoop(), html: `${icon('roundtrip', 16)} Round trip` }) : null,
      n > 1 ? h('button', { type: 'button', class: 'btn', title: 'The finish becomes the start; each leg keeps its mode', onclick: () => this.reverse(), html: `${icon('reverse', 16)} Reverse` }) : null,
      n > 1 ? h('button', { type: 'button', class: 'btn', title: 'Route back to where you started', disabled: this.isLoop(), onclick: () => this.backToStart(), html: `${icon('loop', 16)} Back to start` }) : null,
      h('button', { type: 'button', class: 'btn', title: 'Import a GPX or KML file (or drop it on the map)', onclick: () => $('#file-input').click(), html: `${icon('upload', 16)} Import` }),
      // each leg's routing and style, between its points (folded away by default)
      n > 1 ? h('button', { type: 'button', class: 'btn', 'aria-pressed': String(showLegs), title: 'Every leg’s routing and style (or open one with the route button on its row)', onclick: () => { store.set('legSettings', !showLegs); this.openLegs.clear(); this.renderWaypoints(); }, html: `${icon('route', 16)} All leg settings` }) : null,
    ].filter(Boolean)); // (replaceChildren would write a null as "null")
    const loop = this.isLoop();
    const btn = (ic, label, fn, disabled = false, cls = '') => h('button', { type: 'button', class: `tool small ${cls}`, title: label, 'aria-label': label, disabled, onclick: (e) => { e.stopPropagation(); fn(); }, html: icon(ic, 16) });
    this.points.forEach((p, i) => {
      const last = i === n - 1 && i > 0;
      const own = this.pname.get(p) || '';
      const auto = this.autoName(i);
      const input = h('input', {
        class: 'wpl-name', type: 'text', value: own, placeholder: auto || this.label(i), maxlength: 60, spellcheck: 'false',
        'aria-label': `Name of ${i === 0 ? 'the start' : last ? 'the finish' : `via point ${i}`}`,
        onclick: (e) => e.stopPropagation(),
        onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); else if (e.key === 'Escape') { e.target.value = own; e.target.blur(); } },
        onblur: (e) => this.setName(i, e.target.value),
      });
      // the label only when a name stands in its place; the distance always
      const arrive = i > 0 && this.analysis ? this.arriveAt(i) : null;
      const sub = [own || auto ? this.label(i) : '', fmtDist(i ? this.lengthTo(i) : 0), arrive ? this.clockOf(arrive) : '', last && loop ? 'back at the start' : '', own && auto ? auto : ''].filter(Boolean).join(' · ');
      // a changeover: into which sport, and the minutes it takes (yours to change)
      const ch = this.changeAt(i);
      const change = ch ? h('span', { class: 'wpl-change', onclick: (e) => e.stopPropagation() },
        h('span', { html: icon(this.sportIcon(ch.to), 13) }), `${ACTIVITIES[ch.to].label} · `,
        h('input', { type: 'number', min: 0, max: 600, step: 1, value: ch.min, 'aria-label': `Minutes to change to ${ACTIVITIES[ch.to].label} at ${this.nameOf(i)}`, onchange: (e) => this.setChangeMin(i, e.target.value) }),
        ' min to change') : null;
      const stop = this.stopAt(i);
      const row = h('li', { class: 'wpl-row', 'data-i': String(i), title: 'Show on the map', onclick: () => this.focusPoint(i) },
        h('span', { class: 'wpl-grip', title: 'Drag to reorder', 'aria-hidden': 'true', html: icon('grip', 16) }),
        h('span', { class: `wp wp-mini ${i === 0 ? 'wp-start' : last ? 'wp-end' : 'wp-via'}${last && loop ? ' wp-loop' : ''}`, 'aria-hidden': 'true' }, i === 0 || last ? '' : String(i)),
        h('span', { class: 'wpl-main' }, input, h('small', {}, sub), change, stop ? this.stopChip(i, stop) : null,
          i === 0 && n > 1 ? h('label', { class: 'wpl-depart', onclick: (e) => e.stopPropagation() }, h('span', { html: icon('clock', 12) }), 'Depart ', this.departSelect()) : null),
        h('span', { class: 'wpl-tools' },
          // this one leg's settings, under its point
          i < n - 1 ? h('button', { type: 'button', class: 'tool small', title: `The leg after ${this.nameOf(i)}: routing and style`, 'aria-label': `Settings of the leg after ${this.nameOf(i)}`, 'aria-pressed': String(showLegs || this.openLegs.has(i)), 'aria-expanded': String(showLegs || this.openLegs.has(i)),
            onclick: (e) => { e.stopPropagation(); if (showLegs) { store.set('legSettings', false); for (let k = 0; k < n - 1; k++) if (k !== i) this.openLegs.add(k); this.openLegs.delete(i); } else if (this.openLegs.has(i)) this.openLegs.delete(i); else this.openLegs.add(i); this.renderWaypoints(); },
            html: icon('route', 16) }) : h('span', { class: 'tool small', 'aria-hidden': 'true' }),
          // a stop here: a break, or the night (the start is the departure, the finish the end)
          i > 0 && !last ? h('button', { type: 'button', class: 'tool small', title: stop ? `No stop at ${this.nameOf(i)}` : `A stop at ${this.nameOf(i)}: a break or a night`, 'aria-label': stop ? `Remove the stop at ${this.nameOf(i)}` : `Stop at ${this.nameOf(i)}`, 'aria-pressed': String(!!stop),
            onclick: (e) => { e.stopPropagation(); this.setStop(i, stop ? null : { min: DEFAULT_BREAK }); }, html: icon(isNight(stop) ? 'moon' : 'pause', 16) }) : h('span', { class: 'tool small', 'aria-hidden': 'true' }),
          btn('chevronUp', `Move ${this.nameOf(i)} earlier`, () => this.movePointTo(i, i - 1), i === 0),
          btn('chevronDown', `Move ${this.nameOf(i)} later`, () => this.movePointTo(i, i + 1), i === n - 1),
          btn('trash', `Remove ${this.nameOf(i)}`, () => this.removePoint(i), false, 'danger')));
      row.querySelector('.wpl-grip').addEventListener('pointerdown', (e) => this.dragRow(e, row, i));
      row.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.litLeg(i < n - 1 ? i : i - 1); });
      row.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.unlitLeg(); });
      box.append(row);
      const leg = this.legs[i];
      if (!leg) return;
      if (showLegs || this.openLegs.has(i)) {
        const legRow = this.legSettingsRow(i);
        legRow.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.litLeg(i); });
        legRow.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.unlitLeg(); });
        box.append(legRow);
      } else {
        // folded: only what differs from the defaults
        const bits = [];
        const sp = this.legSport(i), main = this.mainSport(); // differs from the route's sport
        if (sp !== main) bits.push(ACTIVITIES[sp].label);
        else if (leg.mode === 'line' || (leg.mode === 'water') !== isWater(main)) bits.push(MODE_LABEL[leg.mode] || 'Imported track');
        if (leg.mode === 'line' && sp !== main) bits.push(MODE_LABEL.line);
        if (leg.mode === 'fixed') bits.push(leg.src ? 'LIPAS route' : 'Imported track');
        if (leg.style) bits.push(`style: ${styleName(sp, leg.style)}`);
        if (bits.length) {
          box.append(h('li', { class: 'wpl-leg', title: 'This leg differs from the rest — click for its settings', onclick: () => { this.openLegs.add(i); this.renderWaypoints(); },
            onpointerenter: (e) => { if (e.pointerType === 'mouse') this.litLeg(i); }, onpointerleave: (e) => { if (e.pointerType === 'mouse') this.unlitLeg(); } },
            h('span', { html: icon('route', 14) }), [...new Set(bits)].join(' · ')));
        }
      }
    });
    // an open leg stays lit (on a phone that's how a leg shows itself); otherwise nothing is
    if (!box.matches(':hover')) this.unlitLeg();
  }

  // Which sport leg i is in (a native select, with the sport's icon): the route's, or its own.
  legSportPicker(i, done = () => {}) {
    const sports = this.app.sports ? this.app.sports() : Object.entries(ACTIVITIES).map(([k, x]) => ({ k, label: x.label, icon: 'route' }));
    const cur = this.legSport(i), route = this.app.activity();
    const sel = h('select', { 'aria-label': `Sport of the leg after ${this.nameOf(i)}`, onchange: (e) => { done(); this.setLegSport(i, e.target.value); } },
      ...sports.map((x) => h('option', { value: x.k }, x.k === route ? `${x.label} (the route’s)` : x.label)));
    sel.value = cur;
    const ic = (sports.find((x) => x.k === cur) || {}).icon || 'route';
    return h('label', { class: 'mode-select pt-sport' }, h('span', { class: 'mode-select-label', html: icon(ic, 14) }),
      h('span', { class: 'mode-select-box' }, sel, h('span', { class: 'mode-select-chev', 'aria-hidden': 'true', html: icon('chevronDown', 14) })));
  }

  // One leg's settings, between its two points: its sport, how it's routed, and its style.
  legSettingsRow(i) {
    const leg = this.legs[i];
    const modes = leg.mode === 'fixed'
      ? h('span', { class: 'wpl-legnote' }, leg.src ? 'LIPAS route (its own line)' : 'Imported track')
      : h('div', { class: 'seg small', role: 'group', 'aria-label': `How the leg after ${this.nameOf(i)} is routed` }, ...['auto', 'line', 'water'].map((m) =>
        h('button', { type: 'button', 'aria-pressed': String(leg.mode === m), title: MODE_LABEL[m], onclick: () => this.setLegMode(i, m), html: `${icon(MODE_ICON[m], 14)}<span>${MODE_SHORT[m]}</span>` })));
    return h('li', { class: 'wpl-legset' }, h('span', { class: 'wpl-legline', 'aria-hidden': 'true' }), this.legSportPicker(i), modes,
      leg.mode === 'auto' || leg.mode === 'water' ? this.legStylePicker(i, () => {}) : null);
  }

  // Drag a row by its grip; the gap it would drop into is marked, and the
  // drop is one undo step.
  dragRow(e, row, i) {
    e.preventDefault();
    e.stopPropagation();
    const box = this.els.points, rows = [...box.querySelectorAll('.wpl-row')]; // not the leg-style lines between them
    const y0 = e.clientY;
    let to = i;
    row.classList.add('dragging');
    row.setPointerCapture(e.pointerId);
    const move = (ev) => {
      row.style.transform = `translateY(${ev.clientY - y0}px)`;
      // its new place: how many of the other rows have their middle above the pointer
      to = rows.filter((r, j) => { if (j === i) return false; const b = r.getBoundingClientRect(); return ev.clientY > b.top + b.height / 2; }).length;
      rows.forEach((r, j) => { r.classList.toggle('drop-before', j === to && to < i); r.classList.toggle('drop-after', j === to && to > i); });
    };
    const up = () => {
      row.removeEventListener('pointermove', move);
      row.removeEventListener('pointerup', up);
      row.removeEventListener('pointercancel', up);
      row.classList.remove('dragging');
      row.style.transform = '';
      rows.forEach((r) => r.classList.remove('drop-before', 'drop-after'));
      if (to !== i) this.movePointTo(i, to);
    };
    row.addEventListener('pointermove', move);
    row.addEventListener('pointerup', up);
    row.addEventListener('pointercancel', up);
  }

  // Points: the visible dot sits in a bigger, invisible touch target (44 px on
  // touch screens). Dragging one re-routes its two legs live.
  renderMarkers() {
    for (const m of this.markers) m.remove();
    this.markers = this.points.map((p, i) => {
      const last = i === this.points.length - 1 && i > 0;
      const loopEnd = last && dist(p, this.points[0]) < 3;
      const ch = this.changeAt(i);
      const el = h('div', { class: 'wp-hit', title: `${this.nameOf(i)}${ch ? ` · change to ${ACTIVITIES[ch.to].label} (${ch.min} min)` : ''}${this.stopAt(i) ? ` · ${stopLabel(this.stopAt(i))}` : ''} · drag to move · click for options` }, h('div', {
        class: `wp ${i === 0 ? 'wp-start' : last ? 'wp-end' : 'wp-via'}${loopEnd ? ' wp-loop' : ''}`,
      }, i === 0 ? '' : last ? '' : String(i)), ch ? h('span', { class: 'wp-sport', html: icon(this.sportIcon(ch.to), 12) }) : null,
      this.stopAt(i) ? h('span', { class: `wp-stop${isNight(this.stopAt(i)) ? ' night' : ''}`, html: icon(isNight(this.stopAt(i)) ? 'moon' : 'pause', 11) }) : null);
      el.hidden = !this.active;
      const m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(p).addTo(this.map);
      m.on('dragstart', () => this.beginEdit(i, this.snapshot(), m));
      m.on('drag', () => { const ll = m.getLngLat(); this.editTo([+ll.lng.toFixed(6), +ll.lat.toFixed(6)]); });
      m.on('dragend', () => this.endEdit());
      el.addEventListener('click', (ev) => { ev.stopPropagation(); if (Date.now() >= this.noClickUntil) this.openPointMenu(i, m); });
      return m;
    });
  }

  // A handle in the middle of each leg: drag it to pull the route somewhere
  // else, or click it for that part's menu, as on the line. Hidden where the leg
  // is short on screen, so the handles never crowd the points.
  renderGhosts() {
    for (const g of this.ghosts) g.remove();
    this.ghosts = [];
    if (!this.active) return;
    this.legs.forEach((leg, li) => {
      if (!leg.result || leg.status !== 'ok') return;
      const c = leg.result.coords;
      let len = 0;
      for (let j = 1; j < c.length; j++) len += dist(c[j - 1], c[j]);
      if (len < 30) return;
      let at = 0, mid = c[0];
      for (let j = 1; j < c.length; j++) {
        const d = dist(c[j - 1], c[j]);
        if (at + d >= len / 2) { const t = d ? (len / 2 - at) / d : 0; mid = [c[j - 1][0] + (c[j][0] - c[j - 1][0]) * t, c[j - 1][1] + (c[j][1] - c[j - 1][1]) * t]; break; }
        at += d;
      }
      mid = [+mid[0].toFixed(6), +mid[1].toFixed(6)];
      const mode = leg.mode === 'fixed' ? 'auto' : leg.mode;
      const el = h('div', { class: `wp-hit ghost ghost-${mode}`, title: 'Drag to reshape the route · click for options' }, h('div', { class: 'wp-ghost' }));
      const m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(mid).addTo(this.map);
      m.len = len;
      m.on('dragstart', () => {
        const snap = this.snapshot();
        el.classList.add('dragging');
        this.beginEdit(this.splitLeg(li, mid), snap, m);
      });
      m.on('drag', () => { const ll = m.getLngLat(); this.editTo([+ll.lng.toFixed(6), +ll.lat.toFixed(6)]); });
      m.on('dragend', () => this.endEdit());
      el.addEventListener('click', (ev) => { ev.stopPropagation(); if (Date.now() >= this.noClickUntil) this.openLegMenu(li, { lng: mid[0], lat: mid[1] }); });
      this.ghosts.push(m);
    });
    this.fitGhosts();
  }

  fitGhosts() {
    if (!this.ghosts.length) return;
    const z = this.map.getZoom();
    for (const g of this.ghosts) {
      const lat = g.getLngLat().lat;
      const px = g.len / ((40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** z));
      g.getElement().hidden = !this.active || !!this.edit || px < 120;
    }
  }

  // ---------------------------------------------------------------- live editing
  // While a point or the line is dragged, its two legs are re-routed live, but
  // only their geometry is drawn: the analysis waits for the release. Each leg
  // asks BRouter when the pointer rests for a moment, or every 0.7 s at most
  // while it keeps moving; one request per leg is in flight, and the cache
  // answers repeats. Releasing is one undo step, and a request still in flight
  // for the final spot is shared with it, not repeated.
  beginEdit(i, snap, keep = null) {
    if (this.edit) return;
    this.edit = { i, snap, t0: Date.now(), timers: {}, reqs: {}, last: {} };
    if (this.menu) this.menu.remove();
    this.app.setData('routeColor', EMPTY);
    this.app.setData('routeWind', EMPTY);
    this.app.setData('routeHover', EMPTY);
    this.app.routeTip(null);
    this.chart.setHover(-1);
    this.mapHover = false;
    for (const g of this.ghosts) if (g !== keep) g.getElement().hidden = true;
    document.body.classList.add('route-editing');
    this.autoPeek();
  }

  editTo(ll) {
    const ed = this.edit;
    if (!ed) return;
    const old = this.points[ed.i];
    this.points[ed.i] = ll;
    // what belongs to the point goes with it: its name, changeover minutes, stop and gear
    for (const m of [this.pname, this.pchange, this.pstop, this.pcarry]) if (m.has(old)) m.set(ll, m.get(old));
    for (const li of [ed.i - 1, ed.i]) if (this.legs[li]) this.previewLeg(li);
    this.drawRoute();
  }

  previewLeg(li) {
    const ed = this.edit, leg = this.legs[li];
    const { key, from, to, nogos, profile } = this.legKey(li);
    if (leg.mode === 'fixed') { // an imported track keeps its shape; only the end moves
      if (!leg.result) return;
      const c = leg.result.coords.slice();
      if (li === ed.i - 1) c[c.length - 1] = to; else c[0] = from;
      leg.result = { ...leg.result, coords: c };
      return;
    }
    if (leg.key === key && leg.result) return;
    leg.key = key;
    if (leg.mode === 'line') { leg.result = { coords: [from, to], tags: [{}], portage: [] }; leg.status = 'ok'; return; }
    leg.result = null; // drawn as a dashed straight line until the route arrives
    leg.status = 'loading';
    clearTimeout(ed.timers[li]);
    if (leg.mode === 'water') return; // Polku's own water router runs on release: it's too heavy for every move
    const since = Date.now() - (ed.last[li] || ed.t0);
    ed.timers[li] = setTimeout(() => this.fetchPreview(ed, li), Math.max(0, Math.min(250, 700 - since)));
  }

  // One request per leg at a time, each allowed to finish (so the route shows
  // while you drag); the newest position goes next, at most every 0.7 s, and
  // only while there's budget to spare (net.js paces BRouter).
  fetchPreview(ed, li) {
    const leg = this.legs[li];
    if (this.edit !== ed || !leg || leg.result) return;
    // brouter.de takes about a dozen calls a minute: previews stop while fewer than 4 are left, so the release never waits
    if (routerHeadroom() < 4) return;
    const busy = ed.reqs[li];
    if (busy && !busy.done) { busy.again = true; return; }
    const t = this.legKey(li);
    const { key, from, to, nogos, profile } = t;
    const q = ed.reqs[li] = { ctrl: new AbortController(), key, t: Date.now() };
    ed.last[li] = q.t;
    routeLeg({ from, to, mode: leg.mode, profile, opts: { portage: true, nogos, fallback: false, ...this.styleOpts(t) } }, q.ctrl.signal)
      .then((r) => {
        if (leg.result) return;
        if (leg.key === key) { leg.result = r; leg.status = 'ok'; leg.preview = null; }
        else leg.preview = r.coords; // for a spot the pointer has since left: still better than a straight line
        this.drawRoute();
      })
      .catch(() => {}) // cancelled, or failed: the release routes it again and says so
      .finally(() => {
        q.done = true;
        if (q.again) ed.timers[li] = setTimeout(() => this.fetchPreview(ed, li), Math.max(0, 700 - (Date.now() - q.t)));
      });
  }

  endEdit() {
    const ed = this.edit;
    if (!ed) return;
    this.edit = null;
    for (const t of Object.values(ed.timers)) clearTimeout(t);
    for (const [li, q] of Object.entries(ed.reqs)) if (!q.done && (!this.legs[li] || this.legs[li].key !== q.key)) q.ctrl.abort(); // for a spot already left
    document.body.classList.remove('route-editing');
    this.noClickUntil = Date.now() + 450;
    this.past.push(ed.snap);
    if (this.past.length > 100) this.past.shift();
    this.future = [];
    this.update();
  }

  // Press on the route and drag: a new via point under the pointer. With a
  // mouse the drag starts as soon as it moves; on a touch screen hold the line
  // for a moment first, so a swipe across it still pans the map.
  onLinePress(e) {
    if (!this.active || this.edit || this.panel.hidden) return;
    const f = (e.features || []).find((x) => x.properties.kind === 'leg');
    if (!f || f.properties.loading) return;
    const touch = e.type === 'touchstart';
    if (touch ? e.points.length !== 1 : e.originalEvent.button !== 0) return;
    const map = this.map, li = f.properties.leg, p0 = e.point;
    const ll0 = [+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)];
    let dot = null, hold = 0;
    const start = () => {
      if (this.edit) return;
      if (touch) { map.dragPan.disable(); if (navigator.vibrate) navigator.vibrate(10); }
      const snap = this.snapshot();
      const k = this.splitLeg(li, ll0);
      dot = new maplibregl.Marker({ element: h('div', { class: 'wp-hit' }, h('div', { class: 'wp wp-via' })) }).setLngLat(this.points[k]).addTo(map);
      this.beginEdit(k, snap);
      this.drawRoute();
    };
    const move = (ev) => {
      if (!dot) {
        const d = Math.hypot(ev.point.x - p0.x, ev.point.y - p0.y);
        if (touch) { if (d > 10 || (ev.points && ev.points.length > 1)) stop(); return; } // a swipe or a pinch: the map's
        if (d < 4) return;
        start();
      }
      const ll = [+ev.lngLat.lng.toFixed(6), +ev.lngLat.lat.toFixed(6)];
      dot.setLngLat(ll);
      this.editTo(ll);
    };
    const stop = () => {
      clearTimeout(hold);
      map.off(touch ? 'touchmove' : 'mousemove', move);
      if (touch) { map.off('touchend', stop); map.off('touchcancel', stop); } else window.removeEventListener('mouseup', stop);
      if (!dot) return;
      if (touch) map.dragPan.enable();
      dot.remove();
      this.endEdit();
    };
    if (touch) hold = setTimeout(start, 300);
    else e.preventDefault(); // no panning: this press may become a drag
    map.on(touch ? 'touchmove' : 'mousemove', move);
    if (touch) { map.on('touchend', stop); map.on('touchcancel', stop); } else window.addEventListener('mouseup', stop);
  }

  isTouch() { return Date.now() - (this.lastTouchAt || 0) < 800; }

  // "Follow paths" joins the way where the router can: a point clicked beside a path
  // moves onto it, where the route met it, so the points sit on their line. Only where
  // every leg at the point follows paths and they agree (a straight, water or imported
  // leg keeps the spot you chose), and not from further than 400 m. The leg keys follow,
  // so nothing is routed again.
  snapPoints() {
    let moved = false;
    for (let i = 0; i < this.points.length; i++) {
      const legs = [this.legs[i - 1], this.legs[i]];
      if (!legs.some(Boolean) || legs.some((l) => l && (l.mode !== 'auto' || l.status !== 'ok' || !l.result || l.result.coords.length < 2))) continue;
      const ends = [];
      if (legs[0]) ends.push(legs[0].result.coords[legs[0].result.coords.length - 1]);
      if (legs[1]) ends.push(legs[1].result.coords[0]);
      if (ends.length === 2 && dist(ends[0], ends[1]) > 5) continue;
      const p = this.points[i], q = ends[0], d = dist(p, q);
      if (d < 1 || d > 400) continue;
      p[0] = +q[0].toFixed(6); p[1] = +q[1].toFixed(6); // the same point (names and changeovers stay with it)
      if (legs[0]) legs[0].result.coords[legs[0].result.coords.length - 1] = p;
      if (legs[1]) legs[1].result.coords[0] = p;
      moved = true;
    }
    if (moved) {
      this.legs.forEach((l, k) => { if (l.mode === 'auto' && l.status === 'ok') l.key = this.legKey(k).key; });
      this.save();
    }
    return moved;
  }

  // A part of the route (one leg), clicked, tapped or right-clicked: what you can do
  // with it there. Adding a point comes first; then the leg's own settings (its sport,
  // how it's routed, its style), avoiding the spot, and finding it on the profile.
  openLegMenu(li, lngLat) {
    if (this.menu) this.menu.remove();
    const leg = this.legs[li];
    if (!leg) return;
    const ll = [+lngLat.lng.toFixed(6), +lngLat.lat.toFixed(6)];
    const sp = this.legSport(li);
    const from = this.lengthTo(li), len = this.lengthTo(li + 1) - from;
    const act = (ic, label, title, fn, cls = 'btn') => h('button', { type: 'button', class: cls, title, onclick: () => { this.menu.remove(); fn(); }, html: `${icon(ic, 16)} ${label}` });
    const body = h('div', { class: 'pt-menu' },
      h('div', { class: 'pt-head' },
        h('div', { class: 'pt-title' }, `${this.nameOf(li)} → ${this.nameOf(li + 1)}`),
        h('div', { class: 'pt-sub' }, `${ACTIVITIES[sp].label} · ${fmtDist(len)} · from km ${(from / 1000).toFixed(1)}`)),
      act('plus', 'Add a point here', 'A via point at this spot: drag it to change the way', () => this.insertPoint(li, ll), 'btn primary'),
      h('div', { class: 'pt-label' }, 'This part'),
      this.legSportPicker(li, () => this.menu.remove()),
      leg.mode === 'fixed'
        ? h('div', { class: 'pt-sub' }, leg.src ? 'A LIPAS route: its own line' : 'An imported track: its own line')
        : h('div', { class: 'seg small' }, ...['auto', 'line', 'water'].map((m) =>
          h('button', { type: 'button', 'aria-pressed': String(leg.mode === m), title: MODE_LABEL[m], onclick: () => { this.menu.remove(); this.setLegMode(li, m); }, html: `${icon(MODE_ICON[m], 16)}<span>${MODE_SHORT[m]}</span>` }))),
      leg.mode === 'auto' || leg.mode === 'water' ? this.legStylePicker(li, () => this.menu.remove()) : null,
      h('div', { class: 'pt-row' },
        act('pause', 'Stop here', 'A break or a night at this spot: a point with a stop', () => this.stopHere(li, ll)),
        act('close', 'Avoid this spot', 'The route goes around it (40 m)', () => this.addNogo(ll, 40, 'Avoided place'))),
      this.analysis ? act('mountain', 'On the profile', 'Zoom the profile to this part', () => this.showLegOnProfile(li)) : null);
    this.menu = new maplibregl.Popup({ offset: 10, closeButton: true, maxWidth: '320px', className: 'polku-popup' }).setLngLat(lngLat).setDOMContent(body).addTo(this.map);
    this.keepMenuInView();
  }

  // the profile zoomed to leg i (the map follows it)
  showLegOnProfile(li) {
    if (!this.analysis) return;
    this.reveal('profile');
    if (this.layout() === 'sheet' && this.panel.dataset.state === 'peek') this.setSheetState('half');
    requestAnimationFrame(() => this.chart.setView([this.lengthTo(li), this.lengthTo(li + 1)], true));
  }

  // Long-press (touch) or right-click elsewhere on the map: what you can do at that spot.
  bindSpotMenu() {
    const map = this.map;
    let hold = 0, p0 = null, lastTouch = 0;
    const cancel = () => { clearTimeout(hold); hold = 0; };
    const onUi = (e) => { const t = e.originalEvent && e.originalEvent.target; return !!(t && t.closest && t.closest('.maplibregl-marker, .maplibregl-popup')); };
    map.on('touchstart', (e) => {
      lastTouch = Date.now();
      cancel();
      if (e.points.length !== 1 || this.edit || onUi(e)) return;
      if (this.map.getLayer('route-casing') && this.map.queryRenderedFeatures(e.point, { layers: ['route-casing'] }).length && this.active) return; // the line's own hold
      p0 = e.point;
      const ll = e.lngLat;
      hold = setTimeout(() => {
        hold = 0;
        if (navigator.vibrate) navigator.vibrate(10);
        this.noClickUntil = Date.now() + 700;
        this.openSpotMenu(ll);
      }, 550);
    });
    map.on('touchmove', (e) => { if (hold && (e.points.length > 1 || Math.hypot(e.point.x - p0.x, e.point.y - p0.y) > 10)) cancel(); });
    map.on('touchend', cancel);
    map.on('touchcancel', cancel);
    // right-drag (and Ctrl+drag) rotates the map: no menu after a drag (Windows sends it on release)
    let down = null;
    map.on('mousedown', (e) => { down = e.originalEvent.button === 2 || e.originalEvent.ctrlKey ? e.point : null; });
    map.on('contextmenu', (e) => {
      if (Date.now() - lastTouch < 1000 || onUi(e) || (down && Math.hypot(e.point.x - down.x, e.point.y - down.y) > 4)) return;
      // on the route: that part of it
      const leg = this.active && map.getLayer('route-casing') && map.queryRenderedFeatures([[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]], { layers: ['route-casing'] }).find((x) => x.properties.kind === 'leg');
      if (leg && !leg.properties.loading) { this.openLegMenu(leg.properties.leg, e.lngLat); return; }
      this.openSpotMenu(e.lngLat);
    });
    map.on('rotatestart', () => { if (this.menu && this.menu.spot) this.menu.remove(); });
  }

  openSpotMenu(lngLat) {
    if (this.menu) this.menu.remove();
    const ll = [+lngLat.lng.toFixed(6), +lngLat.lat.toFixed(6)];
    const act = (ic, label, title, fn) => h('button', { type: 'button', class: 'btn', title, onclick: () => { this.menu.remove(); fn(); }, html: `${icon(ic, 16)} ${label}` });
    const body = h('div', { class: 'pt-menu' },
      h('div', { class: 'pt-title' }, 'This spot'),
      this.active
        ? act('plus', 'Add a point here', 'The route goes on to here', () => { this.addPoint(ll); this.autoPeek(); })
        : act('flag', 'Route from here', 'Start a new route here', () => { this.setActive(true); this.clear(); this.addPoint(ll); toast('Now tap or click where you want to go'); }),
      !this.active && this.points.length ? act('plus', 'Add to my route', 'Your route goes on to here', () => { this.setActive(true); this.addPoint(ll); }) : null,
      roundTripSports.includes(this.app.activity()) ? act('roundtrip', 'Round trip from here', 'Loops of the length you choose, starting and ending here', () => this.openLoop(ll)) : null,
      act('close', 'Avoid this spot', 'Routes go around it (40 m)', () => { if (!this.active) this.setActive(true); this.addNogo(ll, 40, 'Avoided place'); }));
    this.menu = new maplibregl.Popup({ offset: 6, closeButton: true, maxWidth: '320px', className: 'polku-popup' }).setLngLat(lngLat).setDOMContent(body).addTo(this.map);
    this.menu.spot = true;
    this.keepMenuInView();
  }

  // "Style: the route's / a preset / fine-tune…" for the leg after point i
  legStylePicker(i, done) {
    const route = this.app.activity(), sport = this.legSport(i);
    const base = sport === route ? this.style : this.savedStyle(sport);
    const cat = STYLES[sport] || STYLES.mtb;
    const own = this.legs[i].style;
    const sel = h('select', { 'aria-label': 'Style of the next leg', onchange: (e) => {
      const v = e.target.value;
      done();
      if (v === '~tune') { this.styleLeg = i; this.renderStyle(); this.reveal('style'); return; }
      this.setStyle(v ? { p: v, v: {}, wet: base.wet || 'auto' } : null, i);
    } },
    h('option', { value: '' }, sport === route ? `The route’s (${styleName(sport, this.style)})` : `Your ${ACTIVITIES[sport].label} style (${styleName(sport, base)})`),
    ...cat.presets.map(([k, label]) => h('option', { value: k }, label)),
    h('option', { value: '~tune' }, 'Fine-tune…'));
    if (own && isCustom(sport, own)) { sel.prepend(h('option', { value: '~own', disabled: true }, 'Custom')); sel.value = '~own'; } else sel.value = own ? own.p : '';
    return h('label', { class: 'mode-select pt-style' }, h('span', { class: 'mode-select-label' }, 'Style'),
      h('span', { class: 'mode-select-box' }, sel, h('span', { class: 'mode-select-chev', 'aria-hidden': 'true', html: icon('chevronDown', 14) })));
  }

  openPointMenu(i, marker) {
    if (this.menu) this.menu.remove();
    const n = this.points.length;
    const legOut = this.legs[i];
    const last = i === n - 1 && i > 0, via = i > 0 && !last, loop = this.isLoop();
    const act = (ic, label, title, fn, cls = 'btn') => h('button', { type: 'button', class: cls, title, onclick: () => { this.menu.remove(); fn(); }, html: `${icon(ic, 16)} ${label}` });
    const body = h('div', { class: 'pt-menu' },
      h('div', { class: 'pt-head' },
        h('div', { class: 'pt-title' }, this.nameOf(i)),
        h('div', { class: 'pt-sub' }, [this.nameOf(i) !== this.label(i) ? this.label(i) : '', i > 0 ? `${fmtDist(this.lengthTo(i))} from the start` : ''].filter(Boolean).join(' · ') || 'Where the route begins')),
      i === 0 ? h('label', { class: 'pt-depart' }, h('span', { html: icon('clock', 15) }), 'Depart', h('span', { class: 'mode-select-box' }, this.departSelect(), h('span', { class: 'mode-select-chev', 'aria-hidden': 'true', html: icon('chevronDown', 14) }))) : null,
      legOut ? h('div', { class: 'pt-label' }, 'Next leg') : null,
      legOut ? this.legSportPicker(i, () => this.menu.remove()) : null,
      this.changeAt(i) ? h('label', { class: 'pt-change' }, `Change to ${ACTIVITIES[this.changeAt(i).to].label}`,
        h('input', { type: 'number', min: 0, max: 600, step: 1, value: this.changeAt(i).min, onchange: (e) => this.setChangeMin(i, e.target.value) }), 'min') : null,
      legOut ? h('div', { class: 'seg small' }, ...['auto', 'line', 'water'].map((m) =>
        h('button', { type: 'button', 'aria-pressed': String(legOut.mode === m), title: MODE_LABEL[m], onclick: () => { this.menu.remove(); this.setLegMode(i, m); }, html: `${icon(MODE_ICON[m], 16)}<span>${MODE_SHORT[m]}</span>` }))) : null,
      legOut && legOut.mode !== 'line' && legOut.mode !== 'fixed' ? this.legStylePicker(i, () => this.menu.remove()) : null,
      via ? this.stopEditor(i) : null,
      this.gearToggle(i),
      via ? h('div', { class: 'pt-row' },
        act('flag', 'Start here', loop ? 'Start the loop from this point: the same route' : 'Make this the start: the part before it is removed', () => this.startAt(i)),
        loop ? null : act('check', 'Finish here', 'Make this the finish: the rest is removed', () => this.finishAt(i))) : null,
      last && !loop && n > 1 ? act('loop', 'Back to start', 'Add a leg back to the start', () => this.backToStart()) : null,
      act('trash', 'Remove point', '', () => this.removePoint(i), 'btn danger-text'));
    this.menu = new maplibregl.Popup({ offset: 16, closeButton: true, maxWidth: '320px', className: 'polku-popup' })
      .setLngLat(marker.getLngLat()).setDOMContent(body).addTo(this.map);
    this.keepMenuInView();
  }

  // A stop in a waypoint row: Break / Night / no stop, and its minutes or morning hour
  stopChip(i, stop) {
    const night = isNight(stop);
    const kind = h('select', { 'aria-label': `Stop at ${this.nameOf(i)}`, onchange: (e) => this.setStop(i, e.target.value === 'night' ? { on: DEFAULT_ON } : e.target.value === 'break' ? { min: DEFAULT_BREAK } : null) },
      h('option', { value: 'break' }, 'Break'), h('option', { value: 'night' }, 'Night'), h('option', { value: '' }, 'No stop'));
    kind.value = night ? 'night' : 'break';
    const w = this.analysis && (this.analysis.waits || []).find((x) => x.i === i);
    return h('span', { class: `wpl-stop${night ? ' night' : ''}`, onclick: (e) => e.stopPropagation() },
      h('span', { html: icon(night ? 'moon' : 'pause', 13) }), kind,
      night
        ? h('span', {}, ' on at ', h('input', { type: 'time', step: 900, value: hhmm(stop.on), 'aria-label': `Go on from ${this.nameOf(i)} at`, onchange: (e) => { const on = parseHhmm(e.target.value); if (on != null) this.setStop(i, { on }); } }),
          w && w.rest ? ` · ${fmtDuration(w.rest)}` : '')
        : h('span', {}, ' ', h('input', { type: 'number', min: 1, max: 1440, step: 5, value: stop.min, 'aria-label': `Minutes of the break at ${this.nameOf(i)}`, onchange: (e) => this.setStop(i, { min: +e.target.value }) }), ' min'));
  }

  // The point menu's stop: none, a break or a night; for a night, places to sleep near it
  stopEditor(i) {
    const stop = this.stopAt(i), night = isNight(stop);
    const reopen = () => { if (this.markers[i]) this.openPointMenu(i, this.markers[i]); };
    const set = (st) => { this.setStop(i, st); reopen(); };
    const w = this.analysis && (this.analysis.waits || []).find((x) => x.i === i);
    const arrive = this.analysis ? this.arriveAt(i) : null;
    const box = h('div', { class: 'pt-stop' },
      h('div', { class: 'pt-label' }, 'Stop here'),
      h('div', { class: 'seg small', role: 'group', 'aria-label': `Stop at ${this.nameOf(i)}` },
        ...[['', 'No stop', 'close'], ['break', 'Break', 'pause'], ['night', 'Night', 'moon']].map(([k, label, ic]) =>
          h('button', { type: 'button', 'aria-pressed': String(k === (night ? 'night' : stop ? 'break' : '')), onclick: () => set(k === 'night' ? { on: (stop && stop.on) ?? DEFAULT_ON } : k === 'break' ? { min: (stop && stop.min) || DEFAULT_BREAK } : null), html: `${icon(ic, 15)}<span>${label}</span>` }))),
      stop && !night ? h('label', { class: 'pt-change' }, 'For', h('input', { type: 'number', min: 1, max: 1440, step: 5, value: stop.min, onchange: (e) => this.setStop(i, { min: +e.target.value }) }), 'min') : null,
      night ? h('label', { class: 'pt-change' }, 'Go on at', h('input', { type: 'time', step: 900, value: hhmm(stop.on), onchange: (e) => { const on = parseHhmm(e.target.value); if (on != null) set({ on }); } })) : null,
      stop && arrive ? h('div', { class: 'pt-sub' }, `You’d get here ${this.clockOf(arrive)}${w ? ` · on ${this.clockOf(arrive + w.sec)}` : ''}`) : null);
    if (night) {
      const list = h('div', { class: 'stay-list' });
      const find = h('button', { type: 'button', class: 'btn', onclick: () => this.listStays(i, list, find), html: `${icon('search', 15)} Places to sleep nearby` });
      box.append(find, list);
    }
    return box;
  }

  // Lean-tos, huts and campsites within 3 km of point i (LIPAS and OpenStreetMap): move the point to one
  async listStays(i, list, btn) {
    const p = this.points[i];
    btn.disabled = true;
    list.replaceChildren(h('div', { class: 'pt-sub' }, 'Looking in LIPAS and OpenStreetMap…'));
    // what's in so far (LIPAS usually answers first), then the whole list
    const show = (found, done) => {
      if (this.points[i] !== p) return; // the route changed meanwhile
      const rows = found.map((x) => h('div', { class: 'stay' },
        x.icon ? h('img', { class: 'li-ico', src: iconUrl(x.icon), alt: '' }) : h('span', { html: icon('moon', 14) }),
        h('span', { class: 'stay-main' }, h('b', {}, x.name), h('small', {}, `${x.kind} · ${fmtDist(x.d)} · ${x.src}`)),
        h('button', { type: 'button', class: 'btn small', title: `Move ${this.nameOf(i)} to ${x.name}`, onclick: () => this.moveToStay(i, x) }, 'Go here')));
      if (!done) rows.push(h('div', { class: 'pt-sub' }, 'Still looking…'));
      else if (!found.length) rows.push(h('div', { class: 'pt-sub' }, 'No lean-tos, huts or campsites within 3 km in LIPAS or OpenStreetMap.'));
      list.replaceChildren(...rows);
      if (this.menu && this.menu.getElement() && this.menu.getElement().contains(list)) this.keepMenuInView(); // wider and taller now
    };
    try {
      show(await staysNear(p, 3, (part) => show(part, false)), true);
      btn.hidden = true;
    } catch {
      list.replaceChildren(h('div', { class: 'pt-sub' }, 'LIPAS and OpenStreetMap didn’t answer. Try again in a moment.'));
      btn.disabled = false;
    }
  }

  // point i moved to a place to sleep, named after it (its legs are routed again)
  moveToStay(i, x) {
    if (this.menu) this.menu.remove();
    if (!this.points[i]) return;
    this.beginEdit(i, this.snapshot());
    this.editTo(x.at.slice());
    this.pname.set(this.points[i], x.name);
    this.endEdit();
    if (this.menu) this.menu.remove();
  }

  // "Stop here" on the line: a point there with a break, and its menu to make it a night
  stopHere(li, ll) {
    if (!this.legs[li]) return;
    this.commit();
    const k = this.splitLeg(li, ll);
    this.pstop.set(this.points[k], { min: DEFAULT_BREAK });
    this.update();
    if (this.markers[k]) this.openPointMenu(k, this.markers[k]);
  }

  // At a changeover out of a bike or a boat: is it left here, or taken along?
  gearToggle(i) {
    const c = this.changeAt(i), g = c && GEAR[c.from];
    if (!g || GEAR[c.to] === g) return null;
    const what = g === 'bike' ? 'the bike' : `the ${(CRAFT[this.craft] || CRAFT.kayak).label.toLowerCase()}`;
    return h('label', { class: 'tg tg-inline pt-gear', title: `Off: ${what} stays here, and Heads-up checks the route comes back for it. On: it goes along (a packraft, a folding bike).` },
      h('span', { class: 'tg-text' }, `Take ${what} along`),
      h('input', { type: 'checkbox', role: 'switch', checked: this.carryAt(i), onchange: (e) => this.setCarry(i, e.target.checked) }),
      h('span', { class: 'tg-ui', 'aria-hidden': 'true' }));
  }

  // Heads-up from the stops: gear left behind, and a night too short to sleep
  stopWarnings(a) {
    const out = [];
    const sports = this.legs.map((_, i) => this.legSport(i));
    if (new Set(sports).size > 1) {
      for (const w of gearChecks({ sports, points: this.points, carry: (i) => this.carryAt(i), along: (i) => this.lengthTo(i), name: (i) => this.nameOf(i), label: (g) => this.gearLabel(g) })) {
        out.push({ at: w.at, len: 0, kind: 'gear', ic: w.gear === 'bike' ? 'bike' : 'paddle', noAvoid: true, text: w.text, note: w.note });
      }
    }
    for (const w of a.waits || []) {
      if (!isNight(w.stop) || w.rest >= 5 * 3600) continue;
      out.push({ at: w.at, len: 0, kind: 'dark', hide: 'Short night', ic: 'moon', noAvoid: true, text: `A short night at ${this.nameOf(w.i)}: ${fmtDuration(w.rest)}`, note: `you’d get there ${this.clockOf(w.arrive)} and go on at ${hhmm(w.stop.on)}` });
    }
    return out;
  }

  // A trip with nights, day by day: when, how far, how long, and that day's weather
  daysList(a) {
    const tAt = a.tAtWind || a.tAt, start = a.wind ? a.wind.startSec : this.startSec();
    const days = tripDays(a, tAt, start, a.waits);
    if (!days.length) return null;
    const date = (sec) => new Date(sec * 1000).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'numeric' });
    const time = (sec) => new Date(sec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return h('div', { class: 'days' }, ...days.map((d) => {
      const wx = dayWeather(a.wind, a, d.i0, d.i1);
      const t = wx && (Math.round(wx.tMin) === Math.round(wx.tMax) ? `${Math.round(wx.tMin)} °C` : `${Math.round(wx.tMin)}…${Math.round(wx.tMax)} °C`);
      const weather = wx ? [t, `wind up to ${Math.round(wx.wind)} m/s`, wx.wetM > 0 ? `rain on ${fmtDist(wx.wetM)}` : 'dry', wx.beyond ? 'past the forecast' : wx.unsure ? 'less certain' : ''].filter(Boolean).join(' · ') : '';
      const night = d.n <= (a.waits || []).filter((w) => isNight(w.stop)).length ? (a.waits || []).filter((w) => isNight(w.stop))[d.n - 1] : null;
      return h('button', { type: 'button', class: 'day', title: 'Show this day on the profile and the map', onclick: () => this.focusRange(d.i0, d.i1, null) },
        h('b', {}, `Day ${d.n}`), h('span', { class: 'day-when' }, `${date(d.t0)} · ${time(d.t0)}–${time(d.t1)}`),
        h('span', { class: 'day-what' }, `${fmtDist(d.to - d.from)} · ${fmtDuration(d.moving)} moving${d.up >= 20 ? ` · ↑${Math.round(d.up)} m` : ''}${night ? ` · night at ${this.nameOf(night.i)}` : ''}`),
        weather ? h('span', { class: 'day-wx' }, weather) : null);
    }));
  }

  // clear of the top bar, the controls and the planner
  keepMenuInView() {
    const pad = this.viewPadding(0);
    // a tall menu (a night's places to sleep) scrolls inside the room there is: under the top bar, over the planner
    const body = this.menu && this.menu.getElement() && this.menu.getElement().querySelector('.pt-menu');
    if (body) body.style.maxHeight = `${Math.max(220, window.innerHeight - pad.bottom - 8 - 120 - 40)}px`;
    keepInView(this.map, this.menu, { left: this.layout() === 'side' && this.active ? pad.left + 8 : 8, bottom: pad.bottom + 8 });
  }

  // ---------------------------------------------------------------- persistence & sharing
  // The route is kept on this device with its routed geometry and way tags
  // (a table of distinct tag sets), so reopening Polku asks BRouter nothing.
  save() {
    const table = [], idx = new Map();
    const tagId = (t) => { const j = JSON.stringify(t || {}); if (!idx.has(j)) { idx.set(j, table.length); table.push(t || {}); } return idx.get(j); };
    store.set('route', {
      nogos: this.nogos,
      points: this.points,
      names: this.points.map((p) => this.pname.get(p) || ''), // on this device only: not in share links
      changes: this.points.map((p) => this.pchange.get(p) ?? null),
      stops: this.points.map((p) => this.pstop.get(p) || null),
      carry: this.points.map((p) => !!this.pcarry.get(p)),
      sports: this.legs.map((l) => l.sport || null),
      style: encodeStyle(this.app.activity(), this.style),
      legStyles: this.legs.map((l, i) => (l.style ? encodeStyle(this.legSport(i), l.style) || 'balanced' : null)),
      modes: this.legs.map((l) => l.mode),
      fixed: this.legs.map((l) => (l.mode === 'fixed' && l.result ? encodePolyline(l.result.coords) : null)),
      src: this.legs.map((l) => (l.mode === 'fixed' && l.src) || null),
      routed: this.legs.map((l) => (l.mode !== 'fixed' && l.status === 'ok' && l.key && l.result
        ? { key: l.key, line: encodePolyline(l.result.coords), tags: l.result.tags.map(tagId), portage: l.result.portage || [], provider: l.result.provider, water: l.result.water ? { ...l.result.water, times: undefined } : undefined } : null)),
      tags: table,
    });
  }

  loadSaved() {
    const r = store.get('route', null);
    if (r && r.nogos) { this.nogos = r.nogos; this.drawNogos(); }
    if (!r || !r.points || !r.points.length) return false;
    this.points = r.points;
    this.nameAll(r.names);
    this.changeAll(r.changes);
    this.stopAll(r.stops);
    this.carryAll(r.carry);
    if (r.style != null) this.style = decodeStyle(this.app.activity(), r.style);
    this.legs = r.points.slice(1).map((_, i) => {
      if (r.modes[i] === 'fixed' && r.fixed && r.fixed[i]) {
        const c = decodePolyline(r.fixed[i]);
        return { mode: 'fixed', status: 'ok', src: (r.src && r.src[i]) || null, result: { coords: c, tags: c.slice(1).map(() => ({})), portage: [] } };
      }
      const k = r.routed && r.routed[i];
      if (k && r.tags) {
        const c = decodePolyline(k.line);
        c[0] = r.points[i]; c[c.length - 1] = r.points[i + 1]; // exact ends, so the leg's key still matches
        return { mode: r.modes[i], key: k.key, status: 'ok', result: { coords: c, tags: k.tags.map((t) => r.tags[t] || {}), portage: k.portage || [], provider: k.provider, water: k.water } };
      }
      return { mode: r.modes[i] === 'fixed' ? 'auto' : r.modes[i] || 'auto' };
    });
    (r.sports || []).forEach((sp, i) => { if (sp && ACTIVITIES[sp] && this.legs[i]) this.legs[i].sport = sp; });
    (r.legStyles || []).forEach((c, i) => { if (c && this.legs[i]) this.legs[i].style = decodeStyle(this.legSport(i), c); });
    this.update();
    return true;
  }

  // The whole route including routed geometry, so it can be reopened offline
  // (no BRouter call: routeAll() keeps legs whose key and result match).
  // Not snapshot(): that one is the undo history's, and a second method of the
  // same name silently replaced it (undo after adding a point did nothing).
  routeSnapshot() {
    return {
      activity: this.app.activity(),
      routeName: this.routeName || '',
      points: this.points,
      names: this.points.map((p) => this.pname.get(p) || ''),
      changes: this.points.map((p) => this.pchange.get(p) ?? null),
      stops: this.points.map((p) => this.pstop.get(p) || null),
      carry: this.points.map((p) => !!this.pcarry.get(p)),
      style: encodeStyle(this.app.activity(), this.style),
      legStyles: this.legs.map((l, i) => (l.style ? encodeStyle(this.legSport(i), l.style) || 'balanced' : null)),
      nogos: this.nogos,
      legs: this.legs.map((l) => ({ mode: l.mode, key: l.key, src: l.src || null, sport: l.sport || null, result: l.status === 'ok' || l.mode === 'fixed' ? l.result : null })),
    };
  }

  restoreSnapshot(s) {
    this.points = s.points;
    this.nameAll(s.names);
    this.changeAll(s.changes);
    this.stopAll(s.stops);
    this.carryAll(s.carry);
    this.nogos = s.nogos || [];
    this.routeName = s.routeName || '';
    if (s.style != null) this.style = decodeStyle(s.activity || this.app.activity(), s.style);
    this.legs = s.legs.map((l, i) => {
      const sport = l.sport && ACTIVITIES[l.sport] ? l.sport : undefined;
      const style = s.legStyles && s.legStyles[i] ? decodeStyle(sport || s.activity || this.app.activity(), s.legStyles[i]) : null;
      return l.result ? { mode: l.mode, key: l.key, status: 'ok', result: l.result, style, src: l.src || null, sport } : { mode: l.mode === 'fixed' ? 'auto' : l.mode, style, sport };
    });
    this.update();
  }

  offlinePayload() {
    const a = this.analysis;
    if (!a || this.legs.some((l) => !l.result)) return null;
    const line = this.mergedLine().coords;
    const b = bbox(line);
    const name = this.routeName || `${ACTIVITIES[this.app.activity()].label} ${fmtDist(a.total)} · ${new Date().toLocaleDateString()}`;
    return { name, line, bbox: b, km: a.total / 1000, route: this.routeSnapshot() };
  }

  shareUrl() {
    const u = new URL(location.href);
    u.search = '';
    u.searchParams.set('r', encodePolyline(this.points));
    u.searchParams.set('m', this.legs.map((l) => MODE_CODE[l.mode]).join(''));
    u.searchParams.set('a', this.app.activity());
    // the style shapes the line, so it travels with it (left out when it's the default)
    const sport = this.app.activity();
    const p = encodeStyle(sport, this.style);
    if (p) u.searchParams.set('p', p);
    const ps = this.legs.map((l, i) => (l.style ? `${i}:${encodeStyle(this.legSport(i), l.style) || 'balanced'}` : '')).filter(Boolean).join(',');
    if (ps) u.searchParams.set('ps', ps);
    // multisport: each leg's own sport, and your changeover minutes
    if (this.legs.some((l) => l.sport)) u.searchParams.set('s', this.legs.map((l) => (l.sport && SPORT_CODE[l.sport]) || '-').join(''));
    const cw = this.points.map((q, i) => (this.pchange.has(q) ? `${i}:${this.pchange.get(q)}` : '')).filter(Boolean).join(',');
    if (cw) u.searchParams.set('cw', cw);
    // stops and nights, and gear taken along at a changeover
    const st = encodeStops(this.points.map((_, i) => this.stopAt(i)));
    if (st) u.searchParams.set('st', st);
    const cg = this.points.map((q, i) => (this.pcarry.get(q) && this.changeAt(i) ? String(i) : '')).filter(Boolean).join(',');
    if (cg) u.searchParams.set('cg', cg);
    // LIPAS legs as references (a few characters, not their line); older links route these legs
    const lr = this.legs.map((l, i) => (l.mode === 'fixed' && l.src ? `${i}:${l.src.t}.${l.src.id}.${l.src.seq}.${Math.round(l.src.a)}.${Math.round(l.src.b)}` : '')).filter(Boolean).join(',');
    if (lr) u.searchParams.set('lr', lr);
    return u.toString();
  }

  async share() {
    if (this.points.length < 2) { toast('Add at least two points first'); return; }
    const url = this.shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied — anyone with it sees this route');
    } catch {
      prompt('Copy this link', url);
    }
  }

  exportGpx() {
    const a = this.analysis;
    if (!a) { toast('Nothing to export yet'); return; }
    const name = this.routeName || `Polku ${ACTIVITIES[this.app.activity()].label} ${new Date().toISOString().slice(0, 10)}`;
    // Export the routed geometry (not the 10 m resampling) with DEM elevations.
    const line = this.mergedLine();
    download(`${name.replace(/[^\w\- ]+/g, '').trim() || 'route'}.gpx`, toGPX({ name, coords: line.coords, ele: sampleEle(a, line.coords), waypoints: this.points, names: this.points.map((_, i) => this.nameOf(i)), descs: this.points.map((_, i) => stopLabel(this.stopAt(i))) }));
  }

  // ---------------------------------------------------------------- panel
  // One panel, two layouts: a side panel on wide screens (open / minimised) and
  // a bottom sheet elsewhere (peek / half / full). The summary row — distance,
  // time, ascent, routing mode, undo — is always visible; the rest scrolls in
  // collapsible sections whose open state is remembered.
  buildPanel() {
    const p = this.panel;
    p.innerHTML = '';
    const tool = (name, label, fn, cls = '') => h('button', { type: 'button', class: `tool ${cls}`, title: label, 'aria-label': label, onclick: fn, html: icon(name, 19) });
    this.els = {};
    this.sec = {};
    const modes = h('div', { class: 'seg modes', role: 'group', 'aria-label': 'Routing for new legs' },
      ...['auto', 'line', 'water'].map((m) => h('button', {
        type: 'button', 'data-mode': m, 'aria-pressed': String(this.mode === m), title: MODE_LABEL[m], 'aria-label': MODE_LABEL[m],
        onclick: () => this.setMode(m), html: `${icon(MODE_ICON[m], 17)}<span>${MODE_LABEL[m]}</span>`,
      })));
    this.els.fit = tool('fit', 'Show the whole route (F)', () => this.fitRoute());
    this.els.undo = tool('undo', 'Undo (Ctrl+Z)', () => this.undo());
    this.els.redo = tool('redo', 'Redo', () => this.redo());
    this.els.more = tool('more', 'More: import, export, share, save offline, clear, the panel’s place', () => this.toggleMore());
    this.els.more.setAttribute('aria-haspopup', 'menu');
    this.els.sum = h('div', { class: 'sheet-sum', 'aria-live': 'polite' });
    this.els.min = tool('chevronUp', 'Minimise', () => {
      const st = this.panel.dataset.state;
      if (this.layout() === 'side') this.setSheetState(st === 'min' ? 'open' : 'min');
      else this.setSheetState(st === 'peek' ? (this.lastOpen || 'half') : 'peek');
    }, 'sheet-min');
    this.els.dockBtn = tool('panelBottom', 'Move to the bottom', () => this.setDock(this.layout() === 'side' ? 'bottom' : 'left'), 'sheet-dock');
    this.els.handle = h('div', { class: 'sheet-handle', role: 'button', tabindex: '0', 'aria-label': 'Planner size: drag, or press to change', 'aria-controls': 'planner' });
    // the two big choices, always in sight: let Polku make loops, and how the route is chosen
    this.els.quickLoop = h('button', { type: 'button', class: 'btn quick quick-loop', 'aria-pressed': 'false', 'aria-label': 'Round trip', title: 'Let Polku make loops of the length you choose', onclick: () => (this.loop.open ? this.closeLoop() : this.openLoop()), html: `${icon('roundtrip', 16)}<span>Round trip</span>` });
    this.els.quickStyle = h('button', { type: 'button', class: 'btn quick', title: 'How the route is chosen for this sport', onclick: () => { this.styleLeg = null; this.renderStyle(); this.reveal('style'); } });
    // the sport, right where the route is edited: a native list, so it opens at the button everywhere
    this.els.sportSel = h('select', { 'aria-label': 'Sport', onchange: (e) => { if (this.app.setSport) this.app.setSport(e.target.value); } });
    this.els.quickSport = h('label', { class: 'btn quick quick-sel quick-sport', title: 'Sport: routing, speeds and heads-up follow it' });
    // the route's colours, beside the drawing modes: the same setting as the profile's
    // "Colour by" and "On map" (both stay there, in step)
    this.els.colorSel = h('select', { 'aria-label': 'Colour the route by', onchange: (e) => this.pickColor(e.target.value) });
    this.els.quickColor = h('label', { class: 'btn quick quick-sel quick-color', title: 'Colour of the route on the map (the profile follows)' });
    this.els.head = h('div', { class: 'sheet-head' }, h('div', { class: 'sheet-head-in' },
      h('div', { class: 'sheet-row' }, this.els.sum, this.els.min,
        h('button', { type: 'button', class: 'btn done', title: 'Close the planner (R) — the route stays', onclick: () => this.setActive(false) }, 'Done')),
      this.els.toolsRow = h('div', { class: 'sheet-row tools-row' }, modes, this.els.quickPair = h('span', { class: 'quick-pair' }, this.els.quickColor, this.els.quickSport, this.els.quickLoop, this.els.quickStyle), h('div', { class: 'tools' }, this.els.fit, this.els.undo, this.els.redo,
        // a wide bottom bar has room for the common tools; elsewhere they live in ⋯
        h('span', { class: 'tool-sep tool-wide' }),
        tool('reverse', 'Reverse direction', () => this.reverse(), 'tool-wide'),
        tool('loop', 'Back to start', () => this.backToStart(), 'tool-wide'),
        tool('download', 'Export GPX', () => this.exportGpx(), 'tool-wide'),
        tool('share', 'Copy share link', () => this.share(), 'tool-wide'),
        tool('offline', 'Save offline', () => this.app.saveOffline(), 'tool-wide'),
        tool('trash', 'Clear route', () => this.clear(), 'tool-wide danger'),
        this.els.more))));
    this.els.stats = h('div', { class: 'stats' });
    this.els.modesBar = h('div', { class: 'chip-groups' });
    this.els.modeSel = h('select', { 'aria-label': 'Colour the profile by', onchange: (e) => this.showMode(e.target.value) });
    this.els.modeSelect = h('label', { class: 'mode-select', title: 'What the colours of the profile show' },
      h('span', { class: 'mode-select-label' }, 'Colour by'),
      h('span', { class: 'mode-select-box' }, this.els.modeSel, h('span', { class: 'mode-select-chev', 'aria-hidden': 'true', html: icon('chevronDown', 14) })));
    this.els.mapToggle = h('input', { type: 'checkbox', role: 'switch', checked: this.colorOnMap, onchange: (e) => this.setColorOnMap(e.target.checked) });
    this.els.mapToggleRow = h('label', { class: 'tg tg-inline', title: 'Colour the route line on the map the same way as the profile' },
      h('span', { class: 'tg-text' }, 'On map'), this.els.mapToggle, h('span', { class: 'tg-ui', 'aria-hidden': 'true' }));
    this.els.breakdown = h('div', { class: 'breakdown' });
    this.els.climbs = h('div', { class: 'list climbs' });
    this.els.warnings = h('div', { class: 'list warnings' });
    this.els.wind = h('div', { class: 'list wind' });
    this.els.hint = h('p', { class: 'hint' }, matchMedia('(pointer: coarse)').matches
      ? 'Tap the map to add points · drag a point, or hold the line and drag, to reshape · tap a point or the line for options · hold the map for more'
      : 'Click the map to add points · drag a point or the line to reshape · click a point or the line for options · right-click the map for more');
    this.els.dock = h('div', { class: 'dock' }); // the timeline docks here while planning (main.js)

    // The profile, one, under the header: always in sight (but at the summary size), with the
    // legs and their points on it and what colours it right above it (22a)
    this.profCompact = store.get('profileCompact', false);
    this.els.profSize = h('button', { type: 'button', class: 'tool small prof-size', onclick: () => this.setProfileCompact(!this.profCompact) });
    const profTitle = h('span', { class: 'sr-only' }, 'Profile');
    this.els.profZone = h('section', { class: `pl-profile${this.profCompact ? ' compact' : ''}`, 'data-sec': 'profile', 'aria-label': 'Profile' },
      h('div', { class: 'profile-top' }, profTitle, this.els.modeSelect, this.els.modesBar, this.els.mapToggleRow, this.els.profSize),
      h('div', { class: 'profile-box' }, h('canvas', { id: 'profile-canvas' }), h('div', { id: 'profile-tip', class: 'profile-tip', hidden: true })));
    this.sec.profile = { el: this.els.profZone, head: null, titleEl: profTitle, count: h('span'), sum: h('span') };
    this.renderProfileSize();

    // Three tabs for three moments: drawing (Route), what's on the way (Check), setting off (Go)
    this.tab = TABS.some((t) => t.id === store.get('plannerTab', 'route')) ? store.get('plannerTab', 'route') : 'route';
    this.els.tabBtn = {};
    this.els.tabs = h('div', { class: 'pl-tabs', role: 'tablist', 'aria-label': 'Planner',
      onkeydown: (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const k = TABS.findIndex((t) => t.id === this.tab), next = TABS[(k + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id;
        this.setTab(next, { user: true });
        this.els.tabBtn[next].focus();
      } },
    ...TABS.map((t) => (this.els.tabBtn[t.id] = h('button', {
      type: 'button', role: 'tab', class: 'pl-tab', id: `pl-tab-${t.id}`, 'aria-controls': `pl-pane-${t.id}`, title: t.title,
      onclick: () => this.setTab(t.id, { user: true }),
    }, h('span', { html: icon(t.icon, 15), 'aria-hidden': 'true' }), t.label, h('span', { class: 'pl-tab-n' }), h('span', { class: 'pl-tab-t' })))),
    // the panel's place, at the end of the tabs' row (wide screens; dragging it comes in 22b)
    h('span', { class: 'pl-tabs-gap', 'aria-hidden': 'true' }), this.els.dockBtn);
    const pane = (id, ...kids) => h('div', { class: 'pl-pane sheet-cols', role: 'tabpanel', id: `pl-pane-${id}`, 'aria-labelledby': `pl-tab-${id}`, 'data-tab': id }, ...kids);
    // the start, before there's a route: what you can do (Round trip is one of the first choices)
    this.els.start = h('div', { class: 'pl-start' });
    this.els.speedWrap = h('div', { class: 'speed-wrap' }, h('h4', { class: 'how-h' }, 'Your speed', h('small', {}, 'how fast the time is counted')), this.els.speedBox = h('div', { class: 'speed-box' }));
    this.els.panes = {
      route: pane('route',
        this.els.start,
        // a round trip being made (shown only then)
        this.section('loop', 'Round trip', this.els.loopBox = h('div', { class: 'loop-box' })),
        this.section('points', 'Waypoints', this.els.points = h('ol', { class: 'wpl', 'aria-label': 'Waypoints, in order' }), this.els.pointsFoot = h('div', { class: 'wpl-foot' })),
        // how you go: which ways the router prefers, and how fast the time is counted
        this.section('style', 'How you go', h('h4', { class: 'how-h' }, 'Route style', h('small', {}, 'which ways the router prefers')), this.els.styleBox = h('div', { class: 'style-box' }), this.els.speedWrap),
        this.els.hint),
      check: pane('check',
        this.els.checkEmpty = h('p', { class: 'note pl-empty' }, 'Draw a route to see what’s on the way: heads-up, climbs, the ground.'),
        this.els.stats,
        // the two short lists share a column in a wide panel
        h('div', { class: 'sec-stack' }, this.section('warnings', 'Heads-up', this.els.warnings), this.section('climbs', 'Climbs', this.els.climbs)),
        this.section('colours', 'On the route', this.els.breakdown),
        this.section('onmap', 'On the map', this.els.onMap = h('div', { class: 'onmap' }))),
      go: pane('go',
        this.section('speed', 'Time', this.els.speedRoute = h('div', { class: 'speed-route' })),
        this.section('depart', 'Departure & weather', this.els.dock, this.els.wind),
        this.section('take', 'Take it along', this.els.take = h('div', { class: 'take-along' }))),
    };
    this.els.body = h('div', { class: 'sheet-body' }, this.els.panes.route, this.els.panes.check, this.els.panes.go);
    this.els.grip = h('div', { class: 'sheet-resize', role: 'separator', tabindex: '0', 'aria-orientation': 'vertical', 'aria-controls': 'planner',
      'aria-label': 'Planner width', title: 'Drag to resize · double-click: narrow ↔ wide' });
    p.append(this.els.handle, this.els.head, this.els.profZone, this.els.tabs, this.els.body, this.els.grip);
    this.setTab(this.tab);
    this.renderOnMap();
    this.renderTake();
    this.renderLoop();
    this.renderStyle();
    this.renderModeChips();
    this.bindSheet();
    this.bindResize();
  }

  // A collapsible section; its open state is remembered across visits.
  section(id, title, ...kids) {
    const open = (store.get('sections', {})[id]) !== false;
    const titleEl = h('span', { class: 'sec-title' }, title);
    const count = h('span', { class: 'sec-count' });
    const sum = h('span', { class: 'sec-sum' });
    const head = h('button', { type: 'button', class: 'sec-head', 'aria-expanded': String(open), onclick: () => this.toggleSection(id) },
      titleEl, count, sum, h('span', { class: 'sec-chev', 'aria-hidden': 'true', html: icon('chevronDown', 16) }));
    const el = h('section', { class: 'sec', 'data-sec': id, 'data-open': String(open) }, head, h('div', { class: 'sec-body' }, ...kids));
    this.sec[id] = { el, head, titleEl, count, sum };
    return el;
  }

  toggleSection(id, open) {
    const s = this.sec[id];
    if (!s.head) return; // the profile: always open (its size is the sheet's)
    open = open ?? s.el.dataset.open !== 'true';
    s.el.dataset.open = String(open);
    s.head.setAttribute('aria-expanded', String(open));
    store.set('sections', { ...store.get('sections', {}), [id]: open });
    if (open && id === 'profile') requestAnimationFrame(() => this.chart.draw());
  }

  // title, count ("4"), one-line summary shown while collapsed, hidden when empty
  setSection(id, { title, count = '', summary = '', empty = false }) {
    const s = this.sec[id];
    if (title) s.titleEl.textContent = title;
    s.count.textContent = count === '' ? '' : String(count);
    s.sum.textContent = summary;
    s.el.hidden = empty;
    if (id === 'warnings' && this.els.tabBtn) this.els.tabBtn.check.querySelector('.pl-tab-n').textContent = empty || !count ? '' : String(count);
  }

  // ---------------------------------------------------------------- the tabs (22a)
  // `user`: a tap on a tab, which opens a folded sheet at it
  setTab(id, { user = false } = {}) {
    if (!this.els.panes[id]) id = 'route';
    const changed = id !== this.tab;
    this.tab = id;
    store.set('plannerTab', id);
    for (const t of TABS) {
      const on = t.id === id;
      this.els.tabBtn[t.id].setAttribute('aria-selected', String(on));
      this.els.tabBtn[t.id].tabIndex = on ? 0 : -1;
      this.els.panes[t.id].hidden = !on;
    }
    if (changed) this.els.body.scrollTop = 0;
    if (user) {
      const st = this.panel.dataset.state;
      if (this.layout() === 'sheet' && (st === 'peek' || st === 'profile')) this.setSheetState('half');
      else if (this.layout() === 'side' && st === 'min') this.setSheetState('open');
    }
  }

  // The profile at its size, or smaller (yours, kept)
  setProfileCompact(on) {
    this.profCompact = on;
    store.set('profileCompact', on);
    this.renderProfileSize();
  }
  renderProfileSize() {
    this.els.profZone.classList.toggle('compact', this.profCompact);
    this.els.profSize.innerHTML = icon(this.profCompact ? 'chevronDown' : 'chevronUp', 16);
    this.els.profSize.title = this.profCompact ? 'A taller profile' : 'A smaller profile';
    this.els.profSize.setAttribute('aria-label', this.els.profSize.title);
  }

  // Check › On the map: what the route shows on the map besides its line (once in ⋯)
  renderOnMap() {
    const box = this.els.onMap;
    if (!box) return;
    const sw = (label, on, fn, disabled = false, title = '') => h('label', { class: `tg${disabled ? ' off' : ''}`, title },
      h('span', { class: 'tg-text' }, label), h('input', { type: 'checkbox', role: 'switch', checked: on, disabled, onchange: (e) => fn(e.target.checked) }), h('span', { class: 'tg-ui', 'aria-hidden': 'true' }));
    box.replaceChildren(
      sw('Distance marks', !!this.marks.km, (v) => this.setMarks({ km: v }), false, 'Every 1, 5, 10 or 25 km along the route, by its length'),
      sw('Times at the marks', !!this.marks.time, (v) => this.setMarks({ time: v }), !this.marks.km, 'When you’d be at each mark, from your departure'));
    this.setSection('onmap', { summary: [this.marks.km ? 'distance marks' : '', this.marks.km && this.marks.time ? 'times' : ''].filter(Boolean).join(' · ') || 'the line only', empty: !this.analysis });
  }

  // Go › Take it along: the route as a file, a link, or the map saved for offline
  renderTake() {
    const box = this.els.take;
    if (!box) return;
    const b = (ic, label, title, fn) => h('button', { type: 'button', class: 'btn', title, onclick: fn, html: `${icon(ic, 16)} ${label}` });
    box.replaceChildren(
      b('download', 'Export GPX', 'The route as a GPX file, for a GPS device or another app', () => this.exportGpx()),
      b('share', 'Copy share link', 'A link that opens this route in Polku', () => this.share()),
      b('offline', 'Save offline…', 'The map, terrain and this route on this device, for when there’s no signal', () => this.app.saveOffline()));
    this.setSection('take', { empty: this.points.length < 2 });
  }

  // Route, before there's a route: the ways to begin (Round trip among the first)
  renderStart() {
    const box = this.els.start;
    if (!box) return;
    const show = !this.points.length && !this.loop.open;
    box.hidden = !show;
    if (!show) { box.innerHTML = ''; return; }
    const tap = matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click';
    const choice = (ic, title, text, extra = null, fn = null, cls = '') => h(fn ? 'button' : 'div', { type: fn ? 'button' : null, class: `pl-choice ${cls}`, onclick: fn },
      h('span', { class: 'pl-choice-ic', html: icon(ic, 20) }), h('span', { class: 'pl-choice-main' }, h('b', {}, title), h('small', {}, text), extra));
    const loops = roundTripSports.includes(this.app.activity());
    box.replaceChildren(...[
      choice('route', 'Draw it', `${tap} the map where you start, then each place on the way. Polku follows the paths between them.`, null, () => { this.autoPeek(); toast(`${tap} the map where you start`); }),
      loops ? choice('roundtrip', 'Round trip', 'A loop from a start you pick: its length or time, and a direction. Three to choose from, then more.',
        h('span', { class: 'pl-choice-acts' },
          h('button', { type: 'button', class: 'chip', onclick: (e) => { e.stopPropagation(); this.openLoop(); this.loopFromHere(); } }, 'From where I am'),
          h('button', { type: 'button', class: 'chip', onclick: (e) => { e.stopPropagation(); this.openLoop(); } }, 'Pick the start on the map')), null, 'main') : null,
      choice('search', 'Ride a marked route', 'LIPAS routes near you: click one on the map, or find one by name in search', null, () => { const i = $('#search-input'); if (i) i.focus(); }),
      choice('upload', 'Import a GPX or KML', 'or drop the file on the map', null, () => $('#file-input').click()),
    ].filter(Boolean));
  }

  // The leg you open or point at in the waypoint list, lit up on the map and in the profile
  litLeg(i) {
    const leg = i == null ? null : this.legs[i];
    if (!leg) {
      this.app.setData('routeLit', EMPTY);
      if (this.chart) this.chart.setHighlight(this.focusHl || null);
      return;
    }
    const coords = leg.result ? leg.result.coords : [this.points[i], this.points[i + 1]];
    this.app.setData('routeLit', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] });
    if (this.chart && this.analysis) this.chart.setHighlight([this.lengthTo(i), this.lengthTo(i + 1)]);
  }
  // back to the open leg (if one is open), else nothing lit
  unlitLeg() { this.litLeg(this.openLegs.size ? [...this.openLegs].pop() : null); }

  // The first click put the start down: a loop from there is one more tap (drawing goes on as usual)
  startTip(ll) {
    this.closeStartTip();
    const sport = this.app.activity();
    if (!roundTripSports.includes(sport)) return;
    const pre = LOOP_PRESETS[sport] || LOOP_PRESETS.mtb;
    const tap = this.isTouch() ? 'Tap' : 'Click';
    const go = (km) => {
      this.closeStartTip();
      this.openLoop(ll);
      const L = this.loop;
      L.mode = 'km'; L.km = km; L.results = [];
      this.renderLoop();
      this.generateLoops();
    };
    const body = h('div', { class: 'start-menu' },
      h('div', { class: 'st-title' }, 'Start'),
      h('div', { class: 'st-sub' }, `${tap} the next place on the way, or make a loop from here:`),
      h('div', { class: 'st-acts' }, ...pre.km.slice(0, 3).map((km) => h('button', { type: 'button', class: 'chip', title: `Three round trips of about ${km} km from here`, onclick: () => go(km), html: `${icon('roundtrip', 14)}<span>${km} km</span>` }))));
    this.startPopup = new maplibregl.Popup({ offset: 14, closeButton: true, maxWidth: '300px', className: 'polku-popup start-tip' }).setLngLat(ll).setDOMContent(body).addTo(this.map);
  }
  closeStartTip() { if (this.startPopup) { this.startPopup.remove(); this.startPopup = null; } }


  // ---------------------------------------------------------------- panel layout & states
  // Wide screens choose: a side panel on the left (the default since the tabs, 22a) or a bottom
  // panel (the button beside the fold, ⋯, or Settings). Phones and narrow windows always get the sheet.
  layout() { return this.sideMQ.matches && dockOf() === 'left' ? 'side' : 'sheet'; }

  setDock(where) {
    store.set('plannerDock', where);
    this.renderDockBtn();
    this.setSheetState(store.get('sheetState', {})[this.layout()], { remember: false });
    this.app.onActiveChange(this.active); // padding vars, button states
    requestAnimationFrame(() => this.chart.draw());
  }

  renderDockBtn() {
    const side = this.layout() === 'side', b = this.els.dockBtn;
    if (!b) return;
    b.innerHTML = icon(side ? 'panelBottom' : 'panelLeft', 19);
    b.title = side ? 'Move the planner to the bottom' : 'Move the planner to the left';
    b.setAttribute('aria-label', b.title);
  }

  setSheetState(st, { remember = true } = {}) {
    const lay = this.layout();
    this.renderDockBtn();
    const ok = lay === 'side' ? ['open', 'min'] : SHEET_STATES;
    if (!ok.includes(st)) st = lay === 'side' ? 'open' : 'half';
    this.panel.dataset.layout = lay;
    this.panel.dataset.state = st;
    if (st !== 'peek' && st !== 'min') this.lastOpen = st;
    if (this.active) {
      document.body.dataset.sheet = st; // a full sheet hides the map chrome under it
      document.body.dataset.pl = lay;
    }
    if (remember) store.set('sheetState', { ...store.get('sheetState', {}), [lay]: st });
    const folded = st === 'min' || st === 'peek';
    this.els.min.innerHTML = icon(lay === 'side' ? (folded ? 'chevronDown' : 'chevronUp') : (folded ? 'chevronUp' : 'chevronDown'), 19);
    this.els.min.title = folded ? 'Show the details' : lay === 'side' ? 'Minimise' : 'Fold down to the summary';
    this.els.handle.setAttribute('aria-valuetext', st);
    this.els.handle.title = { peek: 'Show more', profile: 'Drag up for the details, down for the map', half: 'Drag up for everything, down for the profile', full: 'Drag down for the map' }[st] || '';
    if (st !== 'peek' && st !== 'min') requestAnimationFrame(() => this.chart.draw());
  }

  // While drawing or dragging on the map, the phone sheet gets out of the way.
  // Not remembered, so the planner reopens at the size you chose.
  autoPeek() {
    if (this.active && this.layout() === 'sheet' && !this.sideMQ.matches && this.panel.dataset.state !== 'peek') this.setSheetState('peek', { remember: false });
  }

  bindSheet() {
    this.sideMQ = matchMedia('(min-width: 900px)');
    this.sideMQ.addEventListener('change', () => this.setSheetState(store.get('sheetState', {})[this.layout()]));
    // the summary rows are always visible: the peek height is theirs; the
    // profile size adds the elevation chart and its colours (the stats row
    // folds away there), measured, so it fits whatever the sport shows
    // the profile zone's height at the profile size: measured while it's in sight at that size
    const profileH = () => {
      const hd = this.els.head, z = this.els.profZone;
      const peek = hd.offsetTop + hd.offsetHeight + 6;
      const st = this.panel.dataset.state;
      if (z.offsetHeight && (st === 'profile' || st === 'full')) this.profZoneH = z.offsetHeight;
      return Math.round(Math.min(innerHeight * 0.45, peek + (this.profZoneH || (this.profCompact ? 120 : 190)) + 6));
    };
    const sizes = () => {
      const hd = this.els.head;
      this.panel.style.setProperty('--peek-h', `${Math.ceil(hd.offsetTop + hd.offsetHeight + 6)}px`);
      this.panel.style.setProperty('--profile-h', `${profileH()}px`);
    };
    new ResizeObserver(sizes).observe(this.els.head);
    new ResizeObserver(() => { if (this.els.head.clientWidth !== this.fitW) this.fitHeaderSoon(); }).observe(this.els.head);
    new ResizeObserver(sizes).observe(this.els.profZone);
    addEventListener('resize', sizes);
    const heights = () => {
      const r = this.panel.getBoundingClientRect();
      const peek = this.els.head.offsetTop + this.els.head.offsetHeight + 6;
      return { peek, profile: profileH(), half: innerHeight * 0.5, full: r.bottom - 72, now: r.height };
    };
    let drag = null;
    const down = (e) => {
      if (this.layout() !== 'sheet' || e.button > 0) return;
      // drag by the handle, or by the summary rows outside their buttons
      if (!e.target.closest('.sheet-handle') && e.target.closest('button, input, select, a, label')) return;
      drag = { y: e.clientY, h: heights(), moved: false, el: e.currentTarget };
      try { drag.el.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    };
    const move = (e) => {
      if (!drag) return;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dy) < 6) return;
      if (!drag.moved) { drag.moved = true; this.panel.classList.add('dragging'); }
      const H = drag.h;
      this.panel.style.height = `${Math.max(H.peek, Math.min(H.full, H.now - dy))}px`;
    };
    const up = () => {
      if (!drag) return;
      const { moved, h: H } = drag;
      drag = null;
      const st = this.panel.dataset.state;
      let next = st;
      if (!moved) next = st === 'peek' ? (this.lastOpen || 'profile') : 'peek'; // a tap toggles
      else {
        const now = this.panel.getBoundingClientRect().height;
        next = Object.entries({ peek: H.peek, profile: H.profile, half: H.half, full: H.full }).sort((a, b) => Math.abs(a[1] - now) - Math.abs(b[1] - now))[0][0];
      }
      this.panel.classList.remove('dragging');
      this.panel.style.height = '';
      this.setSheetState(next);
    };
    for (const el of [this.els.handle, this.els.head]) {
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    }
    this.els.handle.addEventListener('keydown', (e) => {
      const order = SHEET_STATES;
      const i = order.indexOf(this.panel.dataset.state);
      if (e.key === 'ArrowUp') { e.preventDefault(); this.setSheetState(order[Math.min(order.length - 1, i + 1)]); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); this.setSheetState(order[Math.max(0, i - 1)]); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.setSheetState(order[(i + 1) % order.length]); }
    });
    // panning the map while planning counts as "working on the map"
    this.map.on('dragstart', (e) => { if (e.originalEvent) this.autoPeek(); });
    this.setSheetState(store.get('sheetState', {})[this.layout()], { remember: false });
  }

  // Side panel width: drag the grip on its right edge (remembered), double-click
  // to switch between narrow and wide, arrow keys when focused. A wider panel
  // gives the profile room on long routes.
  bindResize() {
    const NARROW = 392;
    const max = () => Math.max(NARROW, Math.min(innerWidth * 0.62, innerWidth - 84 - 12 - 240));
    const apply = (w, save = true) => {
      if (w == null) { this.panel.style.removeProperty('--pl-w'); w = NARROW; } else {
        w = Math.round(Math.max(340, Math.min(max(), w)));
        this.panel.style.setProperty('--pl-w', `${w}px`);
      }
      this.els.grip.setAttribute('aria-valuenow', String(w));
      if (save) store.set('panelWidth', w === NARROW ? null : w);
    };
    const g = this.els.grip;
    let drag = null;
    g.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, w: this.panel.getBoundingClientRect().width };
      this.panel.classList.add('resizing');
      try { g.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
      e.preventDefault();
    });
    g.addEventListener('pointermove', (e) => { if (drag) apply(drag.w + e.clientX - drag.x, false); });
    const end = () => {
      if (!drag) return;
      drag = null;
      this.panel.classList.remove('resizing');
      apply(this.panel.getBoundingClientRect().width);
    };
    g.addEventListener('pointerup', end);
    g.addEventListener('pointercancel', end);
    g.addEventListener('dblclick', () => apply(this.panel.getBoundingClientRect().width > NARROW + 40 ? null : max()));
    g.addEventListener('keydown', (e) => {
      const w = this.panel.getBoundingClientRect().width;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); apply(w + (e.key === 'ArrowRight' ? 32 : -32)); }
      else if (e.key === 'Enter') { e.preventDefault(); apply(w > NARROW + 40 ? null : max()); }
    });
    const saved = store.get('panelWidth', null);
    apply(saved, false);
    addEventListener('resize', () => { const w = store.get('panelWidth', null); if (w) apply(w, false); });
  }

  // Padding for camera moves so routes and climbs land in the visible part of the map.
  viewPadding(m = 40) {
    if (!this.active || this.panel.hidden) return { top: 80, bottom: m + 20, left: m, right: m + 50 };
    const r = this.panel.getBoundingClientRect();
    if (this.layout() === 'side') return { top: 80, bottom: m, left: r.right + m, right: m + 70 };
    return { top: 80, bottom: innerHeight - r.top + m / 2, left: m / 2, right: m + 30 };
  }

  // ---------------------------------------------------------------- the ⋯ menu
  toggleMore() {
    if (this.moreMenu) { this.moreMenu.close(); return; }
    const side = this.layout() === 'side';
    this.moreMenu = popMenu(this.els.more, [
      this.sideMQ.matches ? { icon: side ? 'panelBottom' : 'panelLeft', label: side ? 'Move to the bottom' : 'Move to the left', fn: () => this.setDock(side ? 'bottom' : 'left') } : null,
      this.sideMQ.matches ? 'hr' : null,
      { icon: 'upload', label: 'Import GPX / KML…', fn: () => $('#file-input').click() },
      { icon: 'download', label: 'Export GPX', fn: () => this.exportGpx(), disabled: this.points.length < 2 },
      { icon: 'share', label: 'Copy share link', fn: () => this.share(), disabled: this.points.length < 2 },
      { icon: 'offline', label: 'Save offline…', fn: () => this.app.saveOffline(), disabled: this.points.length < 2 },
      'hr',
      { icon: 'trash', label: 'Clear route', fn: () => this.clear(), cls: 'danger', disabled: !this.points.length },
    ], { label: 'Route actions', onClose: () => { this.moreMenu = null; this.els.more.setAttribute('aria-expanded', 'false'); } });
    this.els.more.setAttribute('aria-expanded', 'true');
  }

  closeMore() {
    if (this.moreMenu) this.moreMenu.close();
  }

  setCraft(k) {
    this.craft = k;
    store.set('craft', k);
    if (this.legs.some((l) => l.mode === 'water')) this.routeAll(); // how rough is too rough depends on the craft
    else this.retime();
  }

  // "Time & speed": your speeds for this sport (editable) and where the time goes on this route.
  renderSpeed() {
    const a = this.analysis;
    const act = this.mainSport();
    const sum = speedSummary(act, this.craft);
    // your speeds: in Route › How you go, beside the route style (there before there's a route too)
    renderSpeedEditor(this.els.speedBox, act, { craft: this.craft, onCraft: (k) => this.setCraft(k), onChange: () => this.retime() });
    // a multisport route: the other sports' speeds too
    for (const sp of this.routeSports().filter((x) => x !== act)) {
      const sub = h('div', { class: 'speed-other' });
      this.els.speedBox.append(h('h4', { class: 'speed-sport', html: `${icon(this.sportIcon(sp), 14)} ${escapeHtml(ACTIVITIES[sp].label)}` }), sub);
      renderSpeedEditor(sub, sp, { craft: this.craft, onCraft: (k) => this.setCraft(k), onChange: () => this.retime() });
    }
    // Go › Time: how long, and where the time goes
    const total = a ? a.timeWind || a.time : 0;
    this.setSection('speed', { summary: a ? `${fmtDuration(total)} · arrive ${this.clockOf(this.startSec() + total)}` : '', empty: !a });
    if (!a) return;
    const box = this.els.speedRoute;
    box.innerHTML = '';
    const tAt = a.tAtWind || a.tAt;
    const waitSec = (a.waits || []).reduce((t, w) => t + w.sec, 0);
    const cats = {};
    let up = 0;
    for (let i = 1; i < a.pts.length; i++) {
      const c = surfaceClass(a, i);
      const dt = tAt[i] - tAt[i - 1] - (a.waitAt ? a.waitAt[i] : 0), dd = a.along[i] - a.along[i - 1];
      (cats[c] ||= { d: 0, t: 0 });
      cats[c].d += dd; cats[c].t += dt;
      if (a.grade[i] > 3 && c !== 'water') up += dt;
    }
    const runner = act === 'run' || act === 'trailrun';
    const LABEL = { paved: 'Paved', unpaved: 'Gravel & unpaved', trail: act === 'hike' || runner ? 'Paths & trails' : 'Trails', water: 'On the water', carry: 'Carries' };
    const speedTxt = (d, t) => (t > 0 ? (runner ? `${pace((d / 1000) / (t / 3600))} /km` : `${((d / 1000) / (t / 3600)).toFixed(1)} km/h`) : '');
    const rows = ['paved', 'unpaved', 'trail', 'water', 'carry'].filter((k) => cats[k] && cats[k].d > 20);
    // the total first: how long, and from when to when
    const t0 = this.startSec();
    box.append(h('div', { class: 'time-head' }, h('b', {}, fmtDuration(total)),
      h('span', {}, `${this.startOffsetH ? `depart ${this.clockOf(t0)}` : 'from now'} → ${this.isLoop() ? 'back' : 'there'} ${this.clockOf(t0 + total)}`)),
      h('div', { class: 'speed-table' },
        ...rows.map((k) => h('div', { class: 'speed-row' }, h('span', {}, LABEL[k]), h('b', {}, fmtDist(cats[k].d)), h('b', {}, fmtDuration(cats[k].t)), h('small', {}, speedTxt(cats[k].d, cats[k].t)))),
        up > 30 && !isWater(act) ? h('div', { class: 'speed-row sub' }, h('span', {}, 'of which uphill (over 3 %)'), h('b', {}, ''), h('b', {}, fmtDuration(up)), h('small', {}, '')) : null,
        a.timeWind ? h('div', { class: 'speed-row sub' }, h('span', {}, a.snowSec >= 60 ? 'the wind and the snow' : 'the wind'), h('b', {}, ''), h('b', {}, Math.abs(a.timeWind - a.time) < 60 ? 'about ±0' : `${a.timeWind > a.time ? '+' : '−'}${fmtDuration(Math.abs(a.timeWind - a.time))}`), h('small', {}, 'included above')) : null,
        a.snowSec >= 60 ? h('div', { class: 'speed-row sub' }, h('span', {}, 'of which the snow'), h('b', {}, ''), h('b', {}, `+${fmtDuration(a.snowSec)}`), h('small', {}, `${Math.round(a.snow.max)} cm at most (forecast)`)) : null,
        ...this.sportRows(a, tAt, speedTxt),
        h('div', { class: 'speed-row total' }, h('span', {}, waitSec ? 'Total time' : 'Moving time'), h('b', {}, fmtDist(a.total)), h('b', {}, fmtDuration(a.timeWind || a.time)), h('small', {}, speedTxt(a.total, (a.timeWind || a.time) - waitSec)))));
    // what the time is counted at, a tap from changing it (Route › How you go)
    box.append(h('p', { class: 'note speed-at' }, `Counted at your speed: ${sum.name} · ${sum.txt} · `,
      h('button', { type: 'button', class: 'link', onclick: () => { this.reveal('style'); requestAnimationFrame(() => requestAnimationFrame(() => this.flash(this.els.speedWrap))); } }, 'change it')));
  }

  // Go's tab shows when you'd be back; Check's, the heads-up count (setSection)
  renderTabTimes() {
    const a = this.analysis, t = this.els.tabBtn && this.els.tabBtn.go.querySelector('.pl-tab-t');
    if (!t) return;
    t.textContent = a ? this.clockOf(this.startSec() + (a.timeWind || a.time)) : '';
    this.els.tabBtn.go.title = a ? `When and how long: back at ${t.textContent} · the weather, taking it along` : TABS[2].title;
  }

  // A multisport route: each sport's distance and time, then the changeovers.
  sportRows(a, tAt, speedTxt) {
    const waits = a.waits || [];
    if (!this.isMulti() && !waits.length) return [];
    // moving time per sport: the time between samples, less a changeover or stop that falls in it
    const split = sportSplit(a, tAt, this.app.activity(), a.waitAt);
    return [
      h('div', { class: 'speed-row sub head' }, h('span', {}, this.isMulti() ? 'By sport' : 'Moving and stops'), h('b', {}, ''), h('b', {}, ''), h('small', {}, '')),
      ...split.map((x) => h('div', { class: 'speed-row sub' }, h('span', { html: `${icon(this.sportIcon(x.sport), 13)} ${escapeHtml(ACTIVITIES[x.sport].label)}` }), h('b', {}, fmtDist(x.dist)), h('b', {}, fmtDuration(Math.max(0, x.time))), h('small', {}, speedTxt(x.dist, x.time)))),
      ...[['change', 'Changeovers', 'yours to set on each point'], ['break', 'Breaks', ''], ['night', 'Nights', 'until the hour you go on']].map(([k, label, note]) => {
        const ws = waits.filter((w) => (k === 'change' ? w.change > 0 : k === 'night' ? isNight(w.stop) : w.stop && !isNight(w.stop)));
        const t = ws.reduce((sum, w) => sum + (k === 'change' ? w.change : w.rest || 0), 0);
        return ws.length ? h('div', { class: 'speed-row sub' }, h('span', {}, `${label} (${ws.length})`), h('b', {}, ''), h('b', {}, fmtDuration(t)), h('small', {}, note)) : null;
      }),
    ].filter(Boolean);
  }

  // which colour modes make sense for the sport
  modeApplies(k) {
    const act = this.mainSport();
    if (k === 'sport') return this.isMulti(); // only a route that mixes sports
    if (isWater(act)) return ['way', 'wind', 'temp', 'rain'].includes(k);
    return k === 'down' || k === 'uphill' || k === 'both' ? OFFROAD_BIKE.has(act) : k === 'width' || k === 'vis' ? act !== 'road' : true;
  }

  // The route line on the map coloured like the profile, or plain (the profile keeps its colours).
  setColorOnMap(on) {
    this.colorOnMap = on;
    store.set('colorOnMap', on);
    if (this.els.mapToggle) this.els.mapToggle.checked = on;
    this.drawColored();
    this.renderQuickColor();
  }

  // From the header: a mode colours the line and the profile; "plain" leaves the line red.
  pickColor(k) {
    if (k === 'plain') { this.setColorOnMap(false); return; }
    this.colorOnMap = true;
    store.set('colorOnMap', true);
    if (this.els.mapToggle) this.els.mapToggle.checked = true;
    this.showMode(k); // redraws the line and re-renders the chip
  }

  renderQuickColor() {
    if (!this.els || !this.els.quickColor) return;
    const sel = this.els.colorSel;
    sel.innerHTML = '';
    sel.append(h('option', { value: 'plain' }, 'Plain line'));
    for (const [title, keys] of COLOR_GROUPS) {
      const shown = keys.filter((k) => this.modeApplies(k));
      if (shown.length) sel.append(h('optgroup', { label: title }, ...shown.map((k) => h('option', { value: k }, COLOR_MODES[k]))));
    }
    const k = this.colorOnMap ? this.colorMode : 'plain';
    sel.value = k;
    this.els.quickColor.innerHTML = `<span class="q-swatch" style="background:${swatchOf(k)}"></span><span class="q-label">${escapeHtml(k === 'plain' ? 'Plain line' : COLOR_MODES[k])}</span>${icon('chevronDown', 12)}`;
    this.els.quickColor.append(sel);
    this.fitHeaderSoon();
  }

  renderModeChips() {
    const act = this.mainSport();
    const applies = (k) => this.modeApplies(k);
    if (!applies(this.colorMode)) this.colorMode = isWater(act) ? 'wind' : 'grade';
    this.els.modesBar.innerHTML = '';
    this.els.modeSel.innerHTML = '';
    for (const [title, keys] of COLOR_GROUPS) {
      const shown = keys.filter(applies);
      if (!shown.length) continue;
      this.els.modeSel.append(h('optgroup', { label: title }, ...shown.map((k) => h('option', { value: k }, COLOR_MODES[k]))));
      this.els.modesBar.append(h('div', { class: 'chip-group', role: 'group', 'aria-label': `Colour the profile by ${title.toLowerCase()}` },
        h('span', { class: 'chip-group-label', 'aria-hidden': 'true' }, title),
        ...shown.map((k) => h('button', {
          type: 'button', class: 'chip', 'aria-pressed': String(this.colorMode === k),
          onclick: () => this.showMode(k),
        }, COLOR_MODES[k]))));
    }
    this.els.modeSel.value = this.colorMode;
    this.els.mapToggle.checked = this.colorOnMap;
    this.renderQuickColor();
  }

  // Route line on the map coloured like the profile, plus wind arrows in wind mode.
  drawColored() {
    const a = this.analysis;
    const EMPTY_FC = { type: 'FeatureCollection', features: [] };
    if (!a || this.panel.hidden) {
      this.app.setData('routeColor', EMPTY_FC);
      this.app.setData('routeWind', EMPTY_FC);
      return;
    }
    const features = [];
    const n = a.pts.length;
    let i = 0;
    while (this.colorOnMap && i < n - 1) {
      const color = colorAt(a, i + 1, this.colorMode);
      let j = i + 1;
      while (j < n - 1 && colorAt(a, j + 1, this.colorMode) === color) j++;
      features.push({ type: 'Feature', properties: { color }, geometry: { type: 'LineString', coordinates: a.pts.slice(i, j + 1) } });
      i = j;
    }
    this.app.setData('routeColor', { type: 'FeatureCollection', features });
    const arrows = [];
    if (this.colorMode === 'wind' && a.wind) {
      const step = Math.max(200, a.total / 28);
      for (let k = 0, next = step / 2; k < n; k++) {
        if (a.along[k] < next) continue;
        next += step;
        const c = windClass(a.wind.head[k], a.wind.speed[k]);
        arrows.push({ type: 'Feature', properties: { rot: (a.wind.dir[k] + 180) % 360, color: c.color, size: Math.min(1.3, 0.6 + a.wind.speed[k] / 12) }, geometry: { type: 'Point', coordinates: a.pts[k] } });
      }
    }
    this.app.setData('routeWind', { type: 'FeatureCollection', features: arrows });
  }

  showMode(k, { reveal = false } = {}) {
    this.colorMode = k;
    store.set('colorMode', k);
    this.renderModeChips();
    this.chart.setMode(k);
    this.renderBreakdown();
    this.drawColored();
    if (this.analysis) this.setSection('profile', { summary: this.profileSummary() });
    // links from the weather section: open the profile and bring it into view
    if (reveal) this.reveal('profile');
  }

  // Open a section and bring it into view (expanding a peeking sheet).
  reveal(id) {
    if (TAB_OF[id] && TAB_OF[id] !== this.tab) this.setTab(TAB_OF[id]);
    this.toggleSection(id, true);
    const st = this.panel.dataset.state;
    if (this.layout() === 'sheet' && id === 'profile' && st === 'peek') this.setSheetState('profile');
    else if (this.layout() === 'sheet' && (st === 'peek' || (st === 'profile' && id !== 'profile'))) this.setSheetState('half');
    else if (this.layout() === 'side' && this.panel.dataset.state === 'min') this.setSheetState('open');
    // and show where: the section lights up for a moment (the Weather button, Speed, Style, a link…)
    requestAnimationFrame(() => this.flash(this.sec[id].el));
  }

  flash(el) {
    if (!el) return;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    el.classList.remove('sec-flash');
    void el.offsetWidth; // restart the animation
    el.classList.add('sec-flash');
    clearTimeout(el.flashTimer);
    el.flashTimer = setTimeout(() => el.classList.remove('sec-flash'), 1600);
  }

  profileSummary() {
    const a = this.analysis;
    if (isWater(a.activity)) {
      if (!a.wind) return 'wind along the route';
      return `${COLOR_MODES[this.colorMode]} · up to ${Math.max(...a.wind.speed).toFixed(0)} m/s`;
    }
    return `${COLOR_MODES[this.colorMode]} · ${Math.round(a.minE)}–${Math.round(a.maxE)} m`;
  }

  renderToolbarState() {
    if (!this.els) return;
    this.els.undo.disabled = !this.past.length;
    this.els.redo.disabled = !this.future.length;
    this.renderModeChips();
  }

  // Distance marks along the route: every 1, 5, 10 or 25 km by its length, with the
  // time you'd be there if you like (from the departure, with the wind once it's in).
  drawMarks() {
    const a = this.analysis;
    const empty = { type: 'FeatureCollection', features: [] };
    if (!a || !this.marks.km || a.total < 1500) { this.app.setData('routeMarks', empty); return; }
    const step = a.total <= 12000 ? 1000 : a.total <= 50000 ? 5000 : a.total <= 160000 ? 10000 : 25000;
    const tAt = a.tAtWind || a.tAt, start = a.wind ? a.wind.startSec : this.startSec();
    const features = [];
    let i = 1;
    for (let d = step; d < a.total - step * 0.3; d += step) {
      while (i < a.along.length - 1 && a.along[i] < d) i++;
      const t = (d - a.along[i - 1]) / ((a.along[i] - a.along[i - 1]) || 1);
      const p = a.pts[i - 1], q = a.pts[i];
      const ll = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      const sec = tAt ? tAt[i - 1] + (tAt[i] - tAt[i - 1]) * t : 0;
      const at = this.clockOf(start + sec);
      features.push({ type: 'Feature', properties: { label: `${d / 1000} km${this.marks.time && tAt ? ` · ${at}` : ''}` }, geometry: { type: 'Point', coordinates: ll } });
    }
    this.app.setData('routeMarks', { type: 'FeatureCollection', features });
  }

  setMarks(change) {
    this.marks = { ...this.marks, ...change };
    store.set('routeMarks', this.marks);
    this.drawMarks();
    this.renderOnMap();
  }

  renderAnalysis() {
    this.drawMarks();
    const a = this.analysis;
    const act = this.mainSport(); // the route's (the map's sport may have moved on)
    const st = this.els.stats;
    const sum = this.els.sum;
    st.innerHTML = '';
    sum.innerHTML = '';
    const stat = (label, value, sub = '') => st.append(h('div', { class: 'stat' }, h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-value', html: value }), sub ? h('span', { class: 'stat-sub', title: sub }, sub) : null));
    const key = (label, value, title = '') => sum.append(h('div', { class: 'sum-item', title }, h('b', {}, value), h('small', {}, label)));
    for (const id of ['profile', 'climbs', 'warnings', 'speed', 'colours']) this.setSection(id, { empty: !a });
    this.els.checkEmpty.hidden = !!a;
    this.els.stats.hidden = !a;
    this.renderWaypoints(); // distances along the route
    this.renderStart();
    this.renderOnMap();
    this.renderTake();
    this.renderTabTimes();
    // the clock stays reachable before there's a route: set the time, then draw
    if (!a) this.setSection('depart', { summary: this.startOffsetH ? `Depart ${new Date(this.startSec() * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Depart now' });
    if (!a) {
      const tap = matchMedia('(pointer: coarse)').matches ? 'tap' : 'click';
      sum.append(h('p', { class: 'sum-empty' }, this.loop.open ? `Round trip: ${tap} the map to move its start`
        : this.points.length ? 'Add another point to make a route' : `${tap[0].toUpperCase()}${tap.slice(1)} the map to add a start point`));

      this.chart.setData(null);
      this.els.breakdown.innerHTML = '';
      this.els.climbs.innerHTML = '';
      this.els.warnings.innerHTML = '';
      this.els.wind.innerHTML = '';
      this.els.hint.hidden = false;
      this.drawColored(); // no route: its colours and wind arrows go from the map too
      if (this.app.onAnalysis) this.app.onAnalysis(null);
      return;
    }
    this.els.hint.hidden = this.points.length > 2;
    const paddle = isWater(act);
    const waitSec = (a.waits || []).reduce((t, w) => t + w.sec, 0);
    const nights = (a.waits || []).filter((w) => isNight(w.stop)).length;
    key('distance', fmtDist(a.total));
    // the time is from your departure: tapping it opens the clock (one control for both)
    const dep = this.startOffsetH ? new Date(this.startSec() * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now';
    const time = h('button', { type: 'button', class: 'sum-item sum-time', title: `Estimated ${waitSec ? `time with ${fmtDuration(waitSec)} of ${nights ? 'nights, ' : ''}stops and changeovers (moving ${fmtDuration((a.timeWind || a.time) - waitSec)})` : 'moving time'}${a.timeWind ? ', with the wind' : ''}${act === 'paddle' ? ` (${CRAFT[this.craft].label})` : ''} · set the departure`, onclick: () => this.reveal('depart') },
      // over days: the time on the move, and how many days it's spread over
      h('b', {}, nights ? shortDuration((a.timeWind || a.time) - waitSec) : fmtDuration(a.timeWind || a.time)), h('small', {}, nights ? `${nights + 1} days` : `from ${dep}`));
    sum.append(time);
    const carry = a.ways.find(([k]) => k === 'portage');
    if (paddle) key('carry', carry ? fmtDist(carry[1]) : '0 m');
    else {
      // climbing and descent together, in the line that's always visible
      sum.append(h('div', { class: 'sum-item sum-elev', title: `${Math.round(a.up)} m of climbing, ${Math.round(a.down)} m of descent` },
        h('b', {}, `↑${Math.round(a.up)} `, h('span', { class: 'sum-down' }, `↓${Math.round(a.down)}`), ' m'), h('small', {}, 'ascent · descent')));
    }
    if (OFFROAD_BIKE.has(act)) {
      const hardest = a.climbs.reduce((m, c) => (c.cls > (m ? m.cls : -1) ? c : m), null);
      stat('Hardest climb', hardest ? `<i class="dot" style="background:${DIFF_COLORS[hardest.cls]}"></i>↑S${hardest.cls}` : '—', hardest ? `${Math.round(hardest.gain)} m at ${Math.round(hardest.avg)} %` : '');
    } else if (act === 'road') {
      // road cyclists read climbs by height and average gradient
      const hardest = a.climbs.reduce((m, c) => (!m || c.gain * c.avg > m.gain * m.avg ? c : m), null);
      stat('Hardest climb', hardest ? `<i class="dot" style="background:${gradeColor(hardest.avg)}"></i>${Math.round(hardest.avg)} %` : '—', hardest ? `${Math.round(hardest.gain)} m over ${fmtDist(hardest.len)}` : '');
    } else if (paddle) {
      const w = a.wind;
      if (w) {
        let head = 0, maxS = 0, maxG = 0;
        for (let i = 1; i < a.pts.length; i++) {
          if (w.head[i] > 1) head += a.along[i] - a.along[i - 1];
          maxS = Math.max(maxS, w.speed[i]); maxG = Math.max(maxG, w.gust[i]);
        }
        stat('Headwind', `${Math.round((head / a.total) * 100)} %`, 'of the distance');
        stat('Strongest wind', `${maxS.toFixed(0)} m/s`, `gusts ${maxG.toFixed(0)}`);
      }
      if (a.up >= 5) stat('Carry ascent', `${Math.round(a.up)} m`);
    } else {
      stat('High point', `${Math.round(a.maxE)} m`);
    }
    // what the time assumes, one tap from changing it
    const sp = speedSummary(act, this.craft);
    st.append(h('button', { type: 'button', class: 'stat stat-btn', title: 'Your speeds for this sport — tap to see or change them', onclick: () => { this.reveal('style'); requestAnimationFrame(() => requestAnimationFrame(() => this.flash(this.els.speedWrap))); } },
      h('span', { class: 'stat-label' }, 'Speed'), h('span', { class: 'stat-value' }, sp.name), h('span', { class: 'stat-sub' }, sp.txt)));
    // and how the route is chosen
    const ownStyles = this.legs.filter((l) => l.style).length;
    st.append(h('button', { type: 'button', class: 'stat stat-btn', title: 'How the route is chosen for this sport — tap to see or change it', onclick: () => { this.styleLeg = null; this.renderStyle(); this.reveal('style'); } },
      h('span', { class: 'stat-label' }, 'Style'), h('span', { class: 'stat-value' }, styleName(act, this.style)),
      h('span', { class: 'stat-sub' }, [ownStyles ? `${ownStyles} leg${ownStyles > 1 ? 's' : ''} with their own` : '', hasWet(act) && this.wetFor(this.style) ? 'wet ground' : ''].filter(Boolean).join(' · ') || 'tap to change')));
    // after a style change: what it did, compared with the route before
    if (this.styleBefore && this.styleBefore.a !== a) {
      const b = this.styleBefore.stats, n = this.styleStats();
      this.styleBefore = null;
      if (b && n) {
        const sg = (v, unit, dp = 0) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(dp)} ${unit}`;
        const what = n.what[0] === 'carries' ? `carries ${b.what[1]} → ${n.what[1]} m` : `${n.what[0]} ${b.what[1]} → ${n.what[1]} %`;
        this.styleDelta = `${sg(n.km - b.km, 'km', 1)} · ${what} · climbing ${sg(n.up - b.up, 'm')}`;
        toast(`${styleName(act, this.style)}: ${this.styleDelta}`, { ms: 5000 });
      }
    }
    this.chart.placeholder = a.windError ? (typeof a.windError === 'string' ? a.windError : 'Wind forecast unavailable right now.') : '';
    // the route's points on the profile where they are along it (a loop's finish at its end, not at its start)
    const last = this.points.length - 1;
    this.chart.setPoints(this.points.map((_, i) => ({ d: this.lengthTo(i), kind: i === 0 ? 'start' : i === last ? 'end' : 'via', n: i })));
    this.chart.setData(a, this.colorMode, paddle ? 'conditions' : 'elevation');
    this.setSection('profile', { title: paddle ? 'Conditions' : 'Profile', summary: this.profileSummary() });
    this.renderBreakdown();
    this.renderClimbs();
    this.renderWarnings();
    this.renderWind();
    this.renderSpeed();
    this.renderStyle();
    this.drawColored();
    if (this.app.onAnalysis) this.app.onAnalysis(a);
  }

  renderBreakdown() {
    const a = this.analysis;
    const box = this.els.breakdown;
    box.innerHTML = '';
    if (!a) return;
    // Check: the profile's colours in kilometres, named by what they show
    this.setSection('colours', { title: `${COLOR_MODES[this.colorMode] || 'The colours'} on the route`, summary: '' });
    let rows;
    const n = a.along.length;
    const sumBy = (fn) => {
      const m = new Map();
      for (let i = 1; i < n; i++) {
        const k = fn(i);
        if (k == null) continue;
        m.set(k, (m.get(k) || 0) + a.along[i] - a.along[i - 1]);
      }
      return m;
    };
    if (this.colorMode === 'sport') {
      const m = sumBy((i) => (a.attr[i] && a.attr[i].sport) || a.activity);
      rows = [...m.entries()].map(([k, d]) => [ACTIVITIES[k] ? ACTIVITIES[k].label : k, d, SPORT_COLORS[k] || '#64748b']);
    } else if (this.colorMode === 'surface') rows = a.surfaces.map(([k, d]) => [k.replace('_', ' '), d, SURFACE_COLORS[k] || SURFACE_COLORS.unknown]);
    else if (this.colorMode === 'way') rows = a.ways.map(([k, d]) => [k, d, WAY_COLORS[k] || WAY_COLORS.other]);
    else if ((this.colorMode === 'width' || this.colorMode === 'vis') && a.td) {
      const sc = TRAIL_SCALES[this.colorMode];
      const m = sumBy((i) => a.td[this.colorMode][i]);
      // narrow → wide (clear → barely visible), then the not-mapped and the roads
      rows = [...m.entries()].sort((x, y) => (x[0] < 0) - (y[0] < 0) || (x[0] < 0 ? y[0] - x[0] : x[0] - y[0])).map(([k, d]) => [sc.labels[k + 2], d, sc.colors[k + 2]]);
    }
    else if (['wind', 'temp', 'rain'].includes(this.colorMode)) {
      if (!a.wind) { box.append(h('p', { class: 'note' }, a.windError ? (typeof a.windError === 'string' ? a.windError : 'Weather forecast unavailable right now.') : 'Loading the forecast…')); return; }
      const w = a.wind;
      const [classes, fn] = {
        wind: [WIND_CLASSES, (i) => windClass(w.head[i], w.speed[i]).key],
        temp: [TEMP_BANDS, (i) => tempBand(w.temp[i]).key],
        rain: [RAIN_BANDS, (i) => rainBand(w.precip[i], w.temp[i]).key],
      }[this.colorMode];
      const m = sumBy(fn);
      rows = classes.filter((c) => m.has(c.key)).map((c) => [c.label, m.get(c.key), c.color]);
    }
    else if (this.colorMode === 'uphill') {
      const m = sumBy((i) => (a.upCls[i] >= 0 ? a.upCls[i] : 'flat / down'));
      rows = [...m.entries()].sort((x, y) => (x[0] === 'flat / down' ? 1 : y[0] === 'flat / down' ? -1 : x[0] - y[0]))
        .map(([k, d]) => [k === 'flat / down' ? k : UPHILL_TEXT[k], d, k === 'flat / down' ? '#d6dde3' : DIFF_COLORS[k]]);
    } else if (this.colorMode === 'both') {
      // climbs by uphill grade, the rest by MTB difficulty: S0…S6, then ↑S0…↑S5, then not graded
      const m = sumBy((i) => (a.upCls[i] >= 0 ? 10 + a.upCls[i] : a.down6[i] >= 0 ? a.down6[i] : 99));
      rows = [...m.entries()].sort((x, y) => x[0] - y[0]).map(([k, d]) => (k === 99 ? ['not graded', d, '#d6dde3']
        : k >= 10 ? [`${UPHILL_TEXT[k - 10].split(' · ')[0]} climbs`, d, DIFF_COLORS[k - 10]] : [MTB_SCALE_TEXT[k].split(':')[0], d, DIFF_COLORS[k]]));
    } else if (this.colorMode === 'down') {
      const m = sumBy((i) => (a.down6[i] >= 0 ? a.down6[i] : 'not graded'));
      rows = [...m.entries()].sort((x, y) => (x[0] === 'not graded' ? 1 : y[0] === 'not graded' ? -1 : x[0] - y[0]))
        .map(([k, d]) => [k === 'not graded' ? k : MTB_SCALE_TEXT[k].split(':')[0], d, k === 'not graded' ? '#d6dde3' : DIFF_COLORS[k]]);
    } else {
      const m = sumBy((i) => GRADE_BANDS.findIndex(([min]) => a.grade[i] >= min));
      rows = [...m.entries()].sort((x, y) => x[0] - y[0]).map(([k, d]) => [GRADE_BANDS[k][2], d, GRADE_BANDS[k][1]]);
    }
    const bar = h('div', { class: 'bd-bar' });
    const legend = h('div', { class: 'bd-legend' });
    for (const [label, d, color] of rows) {
      const pct = (d / a.total) * 100;
      if (pct < 0.3) continue;
      bar.append(h('span', { style: `width:${pct}%;background:${color}`, title: `${label}: ${fmtDist(d)}` }));
      const text = String(label);
      legend.append(h('span', { class: 'bd-item' }, h('i', { style: `background:${color}` }), `${text[0].toUpperCase()}${text.slice(1)} `, h('b', {}, fmtDist(d))));
    }
    box.append(bar, legend);
  }

  renderClimbs() {
    const a = this.analysis;
    const box = this.els.climbs;
    box.innerHTML = '';
    const bike = OFFROAD_BIKE.has(this.mainSport()); // uphill grades; others read the average gradient
    const hardest = a.climbs.reduce((m, c) => (!m || c.gain > m.gain ? c : m), null);
    this.setSection('climbs', {
      count: a.climbs.length || '', empty: !a.climbs.length,
      summary: hardest ? `biggest +${Math.round(hardest.gain)} m at ${Math.round(hardest.avg)} %${bike ? ` · ↑S${hardest.cls}` : ''}` : '',
    });
    if (!a.climbs.length) return;
    a.climbs.forEach((c, k) => {
      // Bikes get the uphill difficulty grade; on foot the average gradient says more.
      const badge = bike
        ? h('span', { class: 'badge', style: `background:${DIFF_COLORS[c.cls]}` }, `↑S${c.cls}`)
        : h('span', { class: 'badge', style: `background:${gradeColor(c.avg)}` }, `${Math.round(c.avg)}%`);
      const item = h('button', { type: 'button', class: `li${this.selected === c ? ' sel' : ''}` },
        badge,
        h('span', { class: 'li-main' },
          h('b', {}, `${k + 1}. +${Math.round(c.gain)} m in ${fmtDist(c.len)}`),
          h('span', {}, `km ${(c.from / 1000).toFixed(1)}–${(c.to / 1000).toFixed(1)} · avg ${c.avg.toFixed(0)} % · max ${c.max.toFixed(0)} %${c.osm ? ' · OSM-tagged' : ''}`)),
      );
      if (bike) item.title = UPHILL_TEXT[c.cls];
      item.addEventListener('click', () => this.focusRange(c.start, c.end, c));
      box.append(item);
    });
  }

  renderWarnings() {
    const a = this.analysis;
    const box = this.els.warnings;
    box.innerHTML = '';
    if (!a) return;
    const standIn = this.legs.map((l, i) => (l.status === 'error' || l.status === 'waiting' ? [this.lengthTo(i) - 5, this.lengthTo(i + 1) + 5] : null)).filter(Boolean);
    const all = [...a.warnings.filter((w) => !(/^Straight line/.test(w.text) && standIn.some(([s0, s1]) => w.at >= s0 && w.at + w.len <= s1))), ...(a.hazards || []), ...groupTrail(a.trailWarn || []), ...(a.waterWarn || []), ...(a.darkWarn || []), ...this.stopWarnings(a), ...this.winterWarnings(a)].sort((x, y) => x.at - y.at);
    // the kinds you've hidden stay out (and are listed at the end, to bring back)
    const hidden = hiddenKinds(), hiddenHere = new Map();
    const shown = all.filter((w) => {
      const k = hideKind(w);
      if (!k || !hidden[k.key]) return true;
      hiddenHere.set(k.key, (hiddenHere.get(k.key) || 0) + 1);
      return false;
    });
    const unrouted = this.legs.filter((l) => l.status === 'error' || l.status === 'waiting').length;
    const count = shown.length + (unrouted ? 1 : 0) + (this.legs.some((l) => l.result && l.result.provider === 'valhalla' && l.status === 'ok') ? 1 : 0);
    const nHidden = all.length - shown.length;
    this.setSection('warnings', { count: count || '', empty: !count && !nHidden, summary: unrouted ? `${unrouted} leg${unrouted > 1 ? 's' : ''} not routed` : shown.length ? shown[0].text + (shown.length > 1 ? ` · +${shown.length - 1} more` : '') + (nHidden ? ` · ${nHidden} hidden` : '') : nHidden ? `${nHidden} hidden` : '' });
    if (unrouted) {
      const w = (this.legs.find((l) => l.status === 'waiting') || {}).wait;
      const waiting = w && (w.reason === 'limit'
        ? `The routing service asked for a short pause; ${unrouted === 1 ? 'it follows' : 'they follow'} on their own`
        : `${w.own ? 'Your routing server' : 'The routing service'} isn’t answering — trying again at ${new Date(w.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${w.own ? ' (Settings → Routing server)' : ''}`);
      box.append(h('div', { class: 'li-row kind-route' },
        h('div', { class: 'li', html: `${icon('warn', 16)}<span class="li-main"><b>${unrouted === 1 ? 'One leg isn’t' : `${unrouted} legs aren’t`} routed yet</b><span>${waiting || `Drawn as straight line${unrouted === 1 ? '' : 's'}`}</span></span>` }),
        h('button', { type: 'button', class: 'btn', title: 'Ask the router again', onclick: () => this.retryFailed() }, 'Retry')));
    }
    const byValhalla = this.legs.filter((l) => l.status === 'ok' && l.result && l.result.provider === 'valhalla').length;
    if (byValhalla) {
      box.append(h('div', { class: 'li-row kind-route' },
        h('div', { class: 'li', html: `${icon('info', 16)}<span class="li-main"><b>${byValhalla === 1 ? 'One leg' : `${byValhalla} legs`} routed by Valhalla</b><span>brouter.de asked for a pause, so the OpenStreetMap routing service stood in. Routing: <a href="https://valhalla.github.io/valhalla/" target="_blank" rel="noopener">Valhalla</a> on FOSSGIS servers · <a href="${FIX_THE_MAP}" target="_blank" rel="noopener">fix the map</a></span></span>` }),
        h('button', { type: 'button', class: 'btn', title: 'Route these legs with BRouter (its trail profiles) once it’s free', onclick: () => this.rerouteWithBrouter() }, 'Use BRouter')));
    }
    if (!all.length) return;
    const KIND_ICON = { roadwork: 'warn', incident: 'warn', roadcond: 'warn', busy: 'warn', dark: 'moon' };
    // where along: in metres on a short route ("at 40 m"), else "at km 12.3"
    const atKm = (m) => (m < 10 ? 'the start' : a.along[a.along.length - 1] < 2000 ? `${Math.round(m / 10) * 10} m` : `km ${(m / 1000).toFixed(1)}`);
    for (const w of shown.slice(0, 40)) {
      const i0 = Math.max(0, a.along.findIndex((d) => d >= w.at));
      let i1 = a.along.findIndex((d) => d >= w.at + Math.max(w.len, 30));
      if (i1 < 0) i1 = a.along.length - 1;
      // anything with a place can be avoided: a circle over the hazard (each of them, for a group)
      const avoid = w.items ? w.items.map((p) => ({ ll: p.lngLat, r: 25, label: p.text }))
        : w.avoid ? [{ ...w.avoid, label: w.text }]
          : w.noAvoid || /^(Straight line|Carry)/.test(w.text) ? null : [{ ll: a.pts[Math.round((i0 + i1) / 2)], r: Math.max(25, Math.min(150, (w.len || 50) / 2 + 15)), label: w.text }];
      const where = w.items ? `at ${w.items.map((p) => atKm(p.at)).join(', ')}` : `at ${atKm(w.at)}${w.len > 5 ? ` · ${fmtDist(w.len)}` : ''}`;
      const ico = w.icon ? `<img class="li-ico" src="${iconUrl(w.icon)}" alt="">` : icon(w.ic || KIND_ICON[w.kind] || 'warn', 16);
      const kind = hideKind(w);
      const row = h('div', { class: `li-row kind-${w.kind || 'route'}` },
        h('button', { type: 'button', class: 'li', html: `${ico}<span class="li-main"><b>${escapeHtml(w.text)}</b><span>${where}${w.note ? ` · ${escapeHtml(w.note)}` : ''}</span></span>`, onclick: () => this.focusRange(i0, i1, w) }),
        avoid && this.legs.some((l) => l.mode === 'auto' || l.mode === 'water') ? h('button', { type: 'button', class: 'btn avoid', title: avoid.length > 1 ? `Route around all ${avoid.length}` : 'Route around this place', onclick: () => this.addNogos(avoid) }, 'Avoid') : null,
        kind || (w.osm && w.lngLat) ? h('button', {
          type: 'button', class: 'tool small li-more', title: 'More: hide this kind, or correct the map', 'aria-label': `More for “${w.text}”`, 'aria-haspopup': 'menu', html: icon('more', 16),
          onclick: (e) => {
            const at = e.currentTarget, open1 = this.rowMenu;
            if (open1) { open1.close(); if (open1.at === at) return; } // its own ⋯ again: just closed
            this.rowMenu = popMenu(at, [
              kind ? { icon: 'eyeOff', label: `Hide “${escapeHtml(kind.label)}” in Heads-up`, fn: () => this.hideWarnKind(kind) } : null,
              w.osm && w.osm.id ? { icon: 'external', label: 'Gone? Fix the map (OpenStreetMap)', fn: () => open(`https://www.openstreetmap.org/edit?${w.osm.type}=${w.osm.id}`, '_blank', 'noopener') } : null,
              w.osm && w.lngLat ? { icon: 'external', label: 'Not right? Leave a note on OpenStreetMap', fn: () => open(osmNote(w.lngLat), '_blank', 'noopener') } : null,
            ], { label: w.text, onClose: () => { this.rowMenu = null; } });
            this.rowMenu.at = at;
          },
        }) : null);
      box.append(row);
    }
    if (hiddenHere.size) {
      box.append(h('div', { class: 'hidden-kinds' },
        h('span', {}, 'Hidden:'),
        ...[...hiddenHere].map(([k, n]) => h('button', { type: 'button', class: 'on-chip', title: 'Show these in Heads-up again', 'aria-label': `Show “${hidden[k]}” in Heads-up again`, html: `<span>${escapeHtml(hidden[k])}${n > 1 ? ` ×${n}` : ''}</span>${icon('close', 12)}`, onclick: () => this.hideWarnKind({ key: k }, false) }))));
    }
  }

  // Hide a kind of heads-up everywhere (it's yours: kept on this device), or show it again
  hideWarnKind(kind, hide = true) {
    const all = { ...hiddenKinds() };
    if (hide) all[kind.key] = kind.label; else delete all[kind.key];
    store.set('hideWarn', all);
    this.renderWarnings();
    if (hide) toast(`“${kind.label}” hidden in Heads-up: it’s listed at the end to show again`, { ms: 5000, action: { label: 'Undo', fn: () => this.hideWarnKind(kind, false) } });
  }

  // the route's extent: its points and routed lines
  routeBounds() {
    const all = this.points.concat(...this.legs.map((l) => (l.result ? l.result.coords : [])));
    return all.length ? bbox(all) : null;
  }

  /** Frame the whole route in the part of the map the planner leaves free. */
  fitRoute({ animate = true } = {}) {
    const b = this.routeBounds();
    if (!b) { toast('No route yet — click the map to start one'); return; }
    this.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: this.viewPadding(), maxZoom: 16, duration: animate ? 700 : 0 });
  }

  // Is any of the route on screen?
  routeInView() {
    const b = this.routeBounds();
    if (!b) return true;
    const v = this.map.getBounds();
    return !(b[2] < v.getWest() || b[0] > v.getEast() || b[3] < v.getSouth() || b[1] > v.getNorth());
  }

  focusRange(i0, i1, sel) {
    const a = this.analysis;
    this.selected = sel;
    this.focusHl = [a.along[i0], a.along[i1]];
    this.chart.setHighlight(this.focusHl);
    const b = bbox(a.pts.slice(i0, i1 + 1));
    this.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: this.viewPadding(), maxZoom: 16, duration: 700 });
  }

  renderWind() {
    const a = this.analysis;
    const box = this.els.wind;
    const act = this.mainSport();
    box.innerHTML = '';
    if (!a) return;
    // departure → back, for the section summary
    const fmt = (sec) => new Date(sec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const start = this.startSec();
    const when = `${this.startOffsetH ? `Depart ${fmt(start)}` : 'Depart now'} → ${this.isLoop() ? 'back' : 'there'} ${this.clockOf(start + (a.timeWind || a.time))}`;
    box.append(h('h4', { class: 'wind-title' }, isWater(act) ? 'Weather on the water' : 'Weather on the route'));
    const sun = this.sunLine();
    if (sun) box.append(h('p', { class: 'sun-line', html: `${icon('sun', 15)} ${escapeHtml(sun)}` }));
    const days = this.daysList(a); // with nights: day by day (each day's weather once it's in)
    if (days) box.append(days);
    if (a.wind && a.wind.stale) box.append(h('p', { class: 'note stale-note' }, `Older forecast (from ${new Date(a.wind.from).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) — Open-Meteo couldn’t be reached.`));
    if (!a.wind) {
      box.append(h('div', { class: 'wind-body note' }, a.windError ? (typeof a.windError === 'string' ? a.windError : 'Wind forecast unavailable right now.') : 'Loading forecast…'));
      this.setSection('depart', { summary: `${when} · ${a.windError ? 'forecast unavailable' : 'loading the forecast…'}` });
      return;
    }
    const w = a.wind;
    const s0 = w.start;
    const r = windRating(s0.speed, s0.gust, act);
    // distance share per class, and the strongest headwind stretch
    const share = { head: 0, cross: 0, tail: 0, calm: 0 };
    let worst = null;
    for (let i = 1; i < a.pts.length; i++) {
      const d = a.along[i] - a.along[i - 1];
      const c = windClass(w.head[i], w.speed[i]).key;
      share[c === 'strongHead' ? 'head' : c === 'strongTail' ? 'tail' : c] += d;
      if (!worst || w.head[i] > worst.v) worst = { v: w.head[i], i };
    }
    const tot = a.along[a.along.length - 1] || 1;
    // temperature range and where / how much it rains, at arrival times
    let tMin = Infinity, tMax = -Infinity, wetM = 0, peak = 0, mm = 0, firstWet = -1, lastWet = -1, snowM = 0;
    const tAt = a.tAtWind || a.tAt;
    for (let i = 1; i < a.pts.length; i++) {
      tMin = Math.min(tMin, w.temp[i]); tMax = Math.max(tMax, w.temp[i]);
      if (w.precip[i] >= 0.1) {
        const d = a.along[i] - a.along[i - 1];
        wetM += d; if (w.temp[i] < 0.5) snowM += d;
        if (firstWet < 0) firstWet = i; lastWet = i;
        peak = Math.max(peak, w.precip[i]);
      }
      mm += (w.precip[i] * (tAt[i] - tAt[i - 1])) / 3600;
    }
    const rainLine = wetM > 0
      ? `${snowM > wetM / 2 ? 'Snow' : 'Rain'} on ${fmtDist(wetM)} (${Math.round((wetM / tot) * 100)} %, km ${(a.along[firstWet] / 1000).toFixed(0)}–${(a.along[lastWet] / 1000).toFixed(0)}), up to ${peak.toFixed(1)} mm/h · about ${mm < 0.5 ? mm.toFixed(1) : Math.round(mm)} mm on you`
      : 'Dry the whole way';
    const icy = tMin <= 0.5 && wetM > 0;
    this.setSection('depart', { summary: `${when} · ${Math.round(tMin) === Math.round(tMax) ? Math.round(tMin) : `${Math.round(tMin)}…${Math.round(tMax)}`} °C · ${r.label.toLowerCase()} · ${wetM > 0 ? (snowM > wetM / 2 ? 'snow' : 'rain') : 'dry'}` });
    const body = h('div', { class: 'wind-body' },
      h('div', { class: 'wind-now' },
        h('span', { class: 'wind-arrow', style: `transform:rotate(${s0.dir + 180}deg)`, title: `from ${compass(s0.dir)}`, html: '&#8593;' }),
        h('span', {}, h('b', {}, `${s0.speed.toFixed(1)} m/s`), ` gusts ${s0.gust.toFixed(1)} · from ${compass(s0.dir)} · ${Math.round(s0.temp)} °C${s0.precip > 0.1 ? ` · rain ${s0.precip.toFixed(1)} mm/h` : ''}`),
        h('span', { class: `pill ${r.tone}` }, r.label)),
      h('div', { class: 'wx-sum' },
        h('span', {}, h('b', {}, 'Temperature '), tMin === tMax || Math.round(tMin) === Math.round(tMax) ? `${Math.round(tMin)} °C` : `${Math.round(tMin)}…${Math.round(tMax)} °C`),
        h('button', { type: 'button', class: 'link', onclick: () => this.showMode(wetM > 0 ? 'rain' : 'temp', { reveal: true }) }, rainLine),
        icy ? h('span', { class: 'pill warn' }, 'Wet and near freezing — slippery roots and rocks') : null),
      h('div', { class: 'exposure' },
        ...[['Headwind', share.head, '#ef4444'], ['Crosswind', share.cross, '#f59e0b'], ['Tailwind', share.tail, '#22a447'], ['Calm', share.calm, '#94a3b8']]
          .filter(([, v]) => v > 0)
          .map(([l, v, c]) => h('span', { class: 'ex-item' }, h('i', { style: `background:${c};width:${Math.max(4, (v / tot) * 100)}%` }), `${l} ${Math.round((v / tot) * 100)} %`))),
      worst && worst.v >= 1.5 ? h('button', { type: 'button', class: 'link', onclick: () => {
        const i0 = Math.max(0, worst.i - 20), i1 = Math.min(a.pts.length - 1, worst.i + 20);
        this.focusRange(i0, i1, null);
      } }, `Strongest headwind ${worst.v.toFixed(1)} m/s at km ${(a.along[worst.i] / 1000).toFixed(1)} →`) : null,
      w.beyond >= 0 ? h('p', { class: 'note' }, `The forecast reaches ${this.clockOf(w.beyondSec)} (km ${(a.along[w.beyond] / 1000).toFixed(0)}); after that the weather shown is its last hour.`)
        : w.unsure >= 0 ? h('p', { class: 'note' }, `From km ${(a.along[w.unsure] / 1000).toFixed(0)} (${this.clockOf(w.startSec + (a.tAtWind || a.tAt)[w.unsure])}) it’s more than three days ahead: the forecast is less certain.`) : null,
      h('div', { class: 'hours' }, ...hourStrip(w.hourly, w.startSec)),
      h('div', { class: 'wx-links' },
        ...[['wind', 'Wind'], ['temp', 'Temperature'], ['rain', 'Rain']].map(([k, l]) => h('button', { type: 'button', class: 'link', onclick: () => this.showMode(k, { reveal: true }) }, `${l} along the route ↑`))),
    );
    box.append(body);
  }
}

function hourStrip(s, startSec) {
  const out = [];
  for (let i = 0; i < s.time.length && out.length < 8; i++) {
    if (s.time[i] < startSec - 1800 || (out.length && i % 2)) continue;
    const t = new Date(s.time[i] * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    out.push(h('span', { class: 'hour', title: `${s.speed[i].toFixed(1)} m/s, gusts ${s.gust[i].toFixed(1)}, ${Math.round(s.temp[i])} °C` },
      h('i', { style: `transform:rotate(${s.dir[i] + 180}deg)`, html: '&#8593;' }), h('b', {}, s.speed[i].toFixed(0)), h('small', {}, t)));
  }
  return out;
}

// DEM elevation for each routed vertex, taken from the nearest analysed sample.
function sampleEle(a, coords) {
  const out = new Float32Array(coords.length);
  let j = 0;
  for (let i = 0; i < coords.length; i++) {
    let best = Infinity;
    for (let k = Math.max(0, j - 2); k < Math.min(a.pts.length, j + 400); k++) {
      const d = Math.abs(a.pts[k][0] - coords[i][0]) + Math.abs(a.pts[k][1] - coords[i][1]);
      if (d < best) { best = d; j = k; }
      if (d === 0) break;
    }
    out[i] = a.ele[j];
  }
  return out;
}

// "2 h 13" or "54 min": a duration where there's little room
const shortDuration = (sec) => { const hr = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60); return hr ? `${hr} h ${String(m).padStart(2, '0')}` : `${m} min`; };

// A LIPAS leg's place along LIPAS's line, the other way round
const flipSrc = (src) => (src ? { ...src, a: src.b, b: src.a } : null);

// {i, t} of the spot `m` metres along a line (for splitLeg)
function alongAt(c, m) {
  let s = 0;
  for (let i = 1; i < c.length; i++) {
    const d = dist(c[i - 1], c[i]);
    if (s + d >= m) return { i: i - 1, t: d ? (m - s) / d : 0 };
    s += d;
  }
  return { i: c.length - 2, t: 1 };
}

export function parseShared(params) {
  const r = params.get('r');
  if (!r) return null;
  try {
    const points = decodePolyline(r);
    if (points.length < 1) return null;
    const lipas = (params.get('lr') || '').split(',').map((x) => {
      const m = x.match(/^(\d+):(\d+)\.(\d+)\.([\w-]+)\.(\d+)\.(\d+)$/);
      return m && { i: +m[1], t: +m[2], id: +m[3], seq: m[4], a: +m[5], b: +m[6] };
    }).filter(Boolean);
    const sports = (params.get('s') || '').split('').map((c) => CODE_SPORT[c] || null);
    const changes = (params.get('cw') || '').split(',').map((x) => x.split(':').map(Number)).filter(([i, m]) => Number.isFinite(i) && Number.isFinite(m));
    const stops = decodeStops(params.get('st'));
    const carry = (params.get('cg') || '').split(',').filter((x) => /^\d+$/.test(x)).map(Number);
    return { points, modes: (params.get('m') || '').split(''), activity: params.get('a'), style: params.get('p') || '', legStyles: params.get('ps') || '', lipas, sports, changes, stops, carry };
  } catch {
    return null;
  }
}
