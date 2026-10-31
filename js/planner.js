// Route planner: waypoints, per-leg routing modes, undo/redo, the bottom sheet
// with stats, elevation profile, climbs, warnings and (for paddling) wind.

import { ACTIVITIES, CRAFT, DIFF_COLORS, UPHILL_TEXT, OFFROAD_BIKE, gradeColor, groupOf, isWater, ROUTE_COLORS } from './config.js';
import { routeLeg, routeRun, routeLoop, routerHeadroom, routerRoomThisMinute } from './router.js';
import { roundTripSports, radiusFor, reach, waterOf, plan, planWater, nearestWater, waterLoop, resize, twiceShare, score as loopScore, distanceForTime } from './roundtrip.js';
import { analyse, estimateTime, surfaceClass, trailWarnings, sportSplit, accessOf, accessRow, OSM } from './analysis.js';
import { retryFailed as retryTerrainTiles } from './dem.js';
import { detailsAlong, forgetFailures as forgetTrailFailures, obstacleText } from './trails.js';
import { iconUrl, warnMarkId } from './icons.js';
import { speedsFor, speedSummary, renderSpeedEditor, pace } from './speeds.js';
import { ProfileChart, COLOR_MODES, COLOR_GROUPS, colorAt, routeReadout, breakdownKey, breakdownRows } from './chart.js';
import { dist, encodePolyline, decodePolyline, fmtDist, fmtDuration, compass, bbox, nearestOnLine, simplify, lineLength, pointSegment } from './geo.js';
import { lipasPlace, stitch, clipAlong } from './lipas.js';
import { onWaterData, prefetchWater, forgetWaterFailures } from './waterdata.js';
import { sunTimes, darkness } from './sun.js';
import { winterAlong, windChill, WINTER_TEXT, forgetWinterFailures } from './winter.js';
import { isNight, nightsWord, restSec, stopLabel, cleanStop, encodeStops, decodeStops, tripDays, dayWeather, gearChecks, GEAR, DEFAULT_BREAK, DEFAULT_ON, hhmm, parseHhmm } from './stops.js';
import { toGPX, download } from './gpx.js';
import { windAlong, windClass, windRating, recentRain, pointForecasts, sampleAt, LONG_HOURS, forecastKnown } from './weather.js';
import { keyFacts, factLine, sportFacts, hardestClimb, climbWords, tileTags, wayExtras } from './facts.js';
import { icon, h, $, toast, store, escapeHtml, popMenu, tooltip } from './ui.js';
import { osmDetails, OSM_KEYS, hitBox, inspectLayers, pickFeature, winterAt, keepInView } from './inspect.js';
import { describe } from './hover.js';
import { CardHost, item, rows, foldFacts } from './card.js';
import { darkWords } from './palette.js';
import { pointCard, itemCard, routeCard, stretchCard, editCard, leaveBlock, spotCard, lipasCard, pickLine, thingCard } from './cards.js';
import { pickData } from './pick.js';
import { FIX_THE_MAP } from './valhalla.js';
import { initNames } from './names.js';
import { STYLES, routerOf, valuesOf, styleName, defaultStyle, encodeStyle, decodeStyle, hasWet, isCustom, keepOff, shortCuts } from './styles.js';
import { swipeSheet, SWIPE, dvh } from './sheet.js';
import { inFinland } from './safety.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
const MODE_LABEL = { auto: 'Follow paths', line: 'Straight line', water: 'Over water' };
const MODE_ICON = { auto: 'auto', line: 'straight', water: 'water' };
const MODE_SHORT = { auto: 'Follow', line: 'Straight', water: 'Water' };
const MODES = ['auto', 'line', 'water'];
const MODE_KEY = { auto: 'P', line: 'S', water: 'W' };
// what the desktop toolbar shortens where room runs out (placeTools()): the style's caption, the names of
// the modes not in use, then all the modes' names, then the style's name (the longest beside a 1024 px window's panel);
// last, beside the side panel, a second row
const FOLDS = ['fold1', 'fold2', 'foldS', 'fold3', 'fold4', 'tb-rows'];
// how a sport goes along a line, for "MTB legs can't be paddled on the same line"
const VERB = { mtb: 'ridden', gravel: 'ridden', road: 'ridden', hike: 'walked', trailrun: 'run', run: 'run', paddle: 'paddled', swim: 'swum' };
const MODE_DESC = { auto: 'Along paths and roads, in the route style', line: 'Straight: off the trail, or across a gap', water: 'Polku’s water router: round land and marked hazards' };
// the desktop toolbar's tooltips: the name, the keys, one sentence
const TIPS = {
  auto: { name: 'Follow paths', keys: 'P', text: 'The next leg follows paths and roads, chosen by the route style.' },
  line: { name: 'Straight line', keys: 'S', text: 'The next leg is drawn straight: off the trail, or across a gap the router can’t take.' },
  water: { name: 'Over water', keys: 'W', text: 'The next leg is routed on the water by Polku: round land and marked hazards.' },
  style: { name: 'Route style', text: 'Which ways Follow paths prefers, for the whole route. Changing it routes the route again.' },
  sport: { name: 'Sport', text: 'The sport for the legs you draw next, and your speed in it. Legs already drawn keep theirs.' },
  undo: { name: 'Undo', keys: 'Ctrl Z', text: 'Takes back the last change.' },
  redo: { name: 'Redo', keys: 'Ctrl Shift Z', text: 'Does it again.' },
  reverse: { name: 'Reverse', text: 'The end becomes the start; each leg keeps its mode and style.' },
  backToStart: { name: 'Back to start', text: 'A leg from the end back to where you started.' },
  fit: { name: 'Show the whole route', keys: 'F', text: 'Frames the whole route on the map, clear of the planner.' },
  share: { name: 'Share link', text: 'Copies a link to this route.' },
  gpx: { name: 'Export GPX', text: 'A file of the route for a GPS watch or another app.' },
  offline: { name: 'Save offline', text: 'Saves the map and terrain along the route, for no signal.' },
  clear: { name: 'Clear route', text: 'Takes the route off the map. Undo brings it back.' },
  more: { name: 'More', text: 'The whole route’s actions that aren’t on the toolbar: a round trip, import and the rest.' },
  done: { name: 'Done', keys: 'E', text: 'Ends editing: the route stays open to read, check and take along.' },
  edit: { name: 'Edit', keys: 'E', text: 'Back to drawing: a click on the map adds a point.' },
};
// the places a tap or a hold shows instead of adding a point (25d part 5), and how near the line a spot is on it
const PLACE_LAYERS = ['poi-outdoor', 'poi-minor', 'label-peak', 'lipas-point', 'td-points'];
const NEAR_LINE = 30;
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
// other ways for a leg (#95): not the route's red, the water's blue, or the purple of ways marked private
// other ways (#95, #211): blue, a colour the trail map doesn't use; the way you had grey; the
// short cut through a way marked private in the private dots' purple; the route's own label in the route's red
const ALT_COLOR = '#2563eb', ALT_BEFORE = '#64748b', ALT_CUT = '#7c3aed';
const ALT_ROUTE_ID = 1000; // the route's label among the ways' (feature ids: a way's index)
const ALT_PAUSE = 1500; // ms after a new leg is in, with no point added, before its other ways (no calls while you sketch)
const ALT_PAUSE_OWN = 500; // …with your own routing server, which has no limit
const ALT_MORE = 5000; // …and ms more before the second one, when it doesn't come with the first
const ALT_CALM = 10e3; // ms since the point before: you're planning, not sketching, and both ways can come together
const ALT_MIN = 300; // m: a shorter new leg gets none on its own (rarely one 100 m apart)
const LOOP_COLORS = ['#2563eb', '#ea580c', '#9333ea', '#0d9488', '#db2777', '#65a30d', '#0891b2', '#b45309', '#4f46e5'];
const LOOP_LETTERS = 'ABCDEFGHI';
const LOOP_MAX = 9;
const LOOP_CALLS = 6; // per generation
const LOOP_CAP = 5; // generations per 10 minutes
// bottom sheet sizes: folded to one line, the summary, + the elevation profile, half the screen, nearly all of it
const SHEET_STATES = ['folded', 'peek', 'half', 'full'];
// a token from css/app.css (--t-sheet: 260ms), and how far a move has slid the sheet down over its foot
const cssVar = (k) => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
const token = (k) => parseFloat(cssVar(k));
const slid = (el) => parseFloat(getComputedStyle(el).translate.split(' ')[1]) || 0;
// where the planner sits on a wide screen: on the left, unless you moved it to the bottom
export const dockOf = () => store.get('plannerDock', 'left');
// The drawer's tabs (22a): drawing, what's on the way, setting off. Each section lives in one.
const TABS = [
  { id: 'route', label: 'Route', icon: 'route', title: 'Draw and change the route: points, legs, round trips, how you go' },
  { id: 'check', label: 'Check', icon: 'warn', title: 'What’s on the way: heads-up, climbs, the ground' },
  { id: 'go', label: 'Go', icon: 'clock', title: 'When and how long, the weather, taking it along' },
];
const TAB_OF = { points: 'route', style: 'route', warnings: 'check', climbs: 'check', colours: 'check', speed: 'go', depart: 'go', take: 'go' };
// "wet ground: auto" turns on after this much rain in the last 24 hours (mm)
const WET_MM = 3;
const MODE_CODE = { auto: 'a', line: 'l', water: 'w', fixed: 'a' };
const CODE_MODE = { a: 'auto', l: 'line', w: 'water' };
// a leg's own sport in share links (s=): one letter per leg, '-' for the route's
const SPORT_CODE = { mtb: 'm', gravel: 'g', road: 'r', hike: 'h', trailrun: 't', run: 'u', paddle: 'p', swim: 's' };
const CODE_SPORT = Object.fromEntries(Object.entries(SPORT_CODE).map(([k, v]) => [v, k]));
// the LIPAS route types a sport has (Swim has none: #306)
const markedFor = (sp) => (ACTIVITIES[sp] && ACTIVITIES[sp].lipas && ACTIVITIES[sp].lipas.routes) || [];

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

// Trail obstacles that repeat (three fallen trees…) become one heads-up row.
const GROUP_TEXT = { tree: 'Fallen trees and logs', stile: 'Stiles and kissing gates', cycle: 'Cycle barriers', 'gate-no': 'Gates with no access', ford: 'Fords' };
function groupTrail(list) {
  const by = new Map();
  for (const w of list) if (w.group) by.set(w.group, [...(by.get(w.group) || []), w]);
  const out = list.filter((w) => !w.group || by.get(w.group).length < 3);
  for (const [g, items] of by) {
    if (items.length < 3) continue;
    out.push({ at: items[0].at, len: 0, text: `${GROUP_TEXT[g] || items[0].text} ×${items.length}`, note: items[0].note, kind: 'trail', icon: items[0].icon, lngLat: items[0].lngLat, items, osm: items[0].osm, tier: items[0].tier, src: items[0].src });
  }
  return out;
}

// Heads-up kinds you can hide (the ⋯ on a row): by the row's own key, its obstacle icon or its
// kind, else the start of its text ("Wet or muddy", "Snow on the way", "Steep climb").
const HIDE_LABEL = { ...GROUP_TEXT, 'Goes round': 'Ways marked private the route goes round', gate: 'Gates', dark: 'Darkness and twilight', roadwork: 'Road works', incident: 'Traffic incidents', roadcond: 'Road conditions', busy: 'Busy roads', gear: 'Gear left behind' };
// a routed line's share on paths and tracks (from its ways' tags), in %
function trailShare(r) {
  let trail = 0, all = 0;
  r.coords.forEach((c, j) => { if (!j) return; const d = dist(r.coords[j - 1], c); all += d; if (['path', 'track', 'bridleway'].includes(((r.tags || [])[j - 1] || {}).highway)) trail += d; });
  return all ? Math.round((trail / all) * 100) : 0;
}
const trailsText = (share) => (share === 100 ? 'all on trails' : `${share} % trails`);

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
    this.readKeys = new Set(); // Check's items marked read (25d part 3): with the saved route on this device, not in links
    // (the peek's row as a count beside the numbers: narrow, 200 % on a phone; short, a phone on its side at 150 or 200 %)
    this.narrowMQ = matchMedia('(max-width: 300px)');
    this.shortMQ = matchMedia('(max-height: 300px)');
    for (const mq of [this.narrowMQ, this.shortMQ]) mq.addEventListener('change', () => this.renderReadRow());
    this.mode = ACTIVITIES[app.activity()].mode;
    this.craft = store.get('craft', 'kayak');
    this.past = [];
    this.future = [];
    this.active = false;
    this.editing = !(store.get('plannerOpen', null) || {}).view; // editing, or the route's view as it was left (25c)
    this.markers = [];
    this.ghosts = []; // drag handles in the middle of each leg
    this.pname = new WeakMap(); // point → the name you gave it (points move as arrays, so names follow them)
    this.pchange = new WeakMap(); // point → your changeover minutes there (where the sport changes)
    this.pstop = new WeakMap(); // point → a stop there: { min } a break, { on } a night (go on at that minute of the day)
    this.pcarry = new WeakMap(); // point → true: the gear of the sport you change out of there goes along
    this.pspot = new WeakMap(); // point → the spot you put it at, when the router moved it off a way marked private or closed (#104)
    this.pid = new WeakMap(); // point → who it is: the same through a move, Undo and Redo (a point's card follows it, 25d)
    this.pidN = 0;
    this.marks = { km: true, time: true, duration: true, ...store.get('routeMarks', {}) }; // distance marks on the route, and the times at them
    this.loop = { open: false, start: null, mode: 'km', km: null, min: null, dir: null, results: [], on: 0, busy: false, spin: 0, gens: [] }; // round trips
    this.way = null; // the way to begin picked, before there's a route: 'draw' or 'find' (renderStart(), A)
    this.marked = { list: [], on: 0, state: 'loading' }; // Marked routes in view (listMarked())
    this.unfolded = new Set(); // Route's list: the stretches whose shaping points are unfolded (their first point's pid), in memory only
    this.reordering = false; // Route's list in Reorder
    this.wxOpen = new Set(); // Route's list: the sections whose weather at their end is said in full (their first point's pid)
    this.roads = initNames(map); // road and path names from the loaded tiles
    this.styles = {}; // the route's own style per sport, else yours for it (styleOf()); a leg may have its own (leg.style)
    this.next = null; // the next leg's sport: null is the map's (nextSport())
    this.styleLeg = null; // the leg the Route style section edits (null: the whole route)
    this.styleSport = null; // whose legs' style it edits then (null: the main sport's, howSport())
    this.wet = { mm: null, on: false, at: null }; // rain in the last 24 h at the start, for "wet ground: auto"
    this.edit = null; // a drag in progress (see beginEdit)
    this.noClickUntil = 0;
    this.analysis = null;
    this.colorMode = store.get('colorMode', 'grade');
    this.colorOnMap = store.get('colorOnMap', false);
    this.leaveAt = null; // when you leave (#364): epoch seconds, or null to leave now
    this.leavePassed = null; // a planned departure that had passed when its route was opened (said under Leave until a new one)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.expireLeave(); });
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
      // (zooming the chart in a full sheet doesn't lower it)
      this.frame(bbox(a.pts.slice(i0, i1 + 1)), { lower: false, duration: 600 });
    };
    map.on('click', (e) => this.onMapClick(e));
    map.on('movestart', (e) => { if (e.originalEvent) { this.refit = false; this.fitAt = null; } }); // you moved the map
    // …or pressed it, the route or a marker on it: no framing the route again under your finger later either (#446)
    for (const t of ['mousedown', 'touchstart']) map.getContainer().addEventListener(t, () => { this.fitAt = null; }, { capture: true, passive: true });
    // Marked routes list the view: again after you move the map (not after framing a picked one)
    map.on('moveend', () => { if (this.startView() !== 'find') return; if (this.marked.framed) this.marked.framed = false; else this.listMarkedSoon(); });
    map.on('mousemove', (e) => this.onMapMove(e));
    map.on('mouseout', () => this.mapUnhover()); // off the map (onto the planner, say): nothing under the pointer
    map.on('touchstart', () => { this.lastTouchAt = Date.now(); });
    // was a menu or card open when this press began? (MapLibre closes it on the click; the click shouldn't add a point too)
    const pressed = () => { this.popupAtPress = !this.picking && (!!this.map.getContainer().querySelector('.maplibregl-popup') || !!this.cards.current); };
    map.on('mousedown', pressed);
    map.on('touchstart', pressed);
    map.on('mousedown', 'route-casing', (e) => this.onLinePress(e));
    map.on('touchstart', 'route-casing', (e) => this.onLinePress(e));
    map.on('zoom', () => this.fitGhosts());
    map.on('zoomend', () => this.drawHeads()); // (Check's markers kept clear of the points and the legs' handles)
    // a source the water router waited for in vain has answered: route those legs again
    onWaterData(() => this.retryWater({ ask: false }));
    // back online: the terrain that didn't load, now
    addEventListener('online', () => { if (this.analysis && this.analysis.terrain && this.analysis.terrain.retry) this.retryTerrain(this.analysis, 0, true); });
    // names of roads come with the tiles: when new ones arrive, the list may know more
    map.on('idle', () => {
      if (!this.active || !this.points.length) return;
      const names = this.points.map((_, i) => this.autoName(i)).join('|');
      if (names !== this.shownNames) this.renderWaypoints();
    });
    this.bindHold();
    this.bindWayHistory();
  }

  // ---------------------------------------------------------------- state
  // `sports`: a change of the whole route's sport, whose undo brings back the map's sport too
  snapshot({ sports = false } = {}) {
    return {
      map: this.app.activity(), next: this.next, sports,
      points: this.points.map((p) => p.slice()),
      ids: this.points.map((p) => this.pidOf(p)),
      names: this.points.map((p) => this.pname.get(p) || ''),
      changes: this.points.map((p) => this.pchange.get(p) ?? null),
      stops: this.points.map((p) => this.pstop.get(p) || null),
      carry: this.points.map((p) => !!this.pcarry.get(p)),
      spots: this.points.map((p) => this.pspot.get(p) || null),
      legs: this.legs.map((l) => ({ mode: l.mode, result: l.result, key: l.key, status: l.status, style: l.style, src: l.src, sport: l.sport, alt: l.alt, altBase: l.altBase, ice: l.ice })),
      nogos: this.nogos.map((n) => ({ ...n })),
      routeName: this.routeName || '',
      styles: { ...this.styles },
    };
  }
  commit(opts) {
    this.refit = false; // you've changed the route: no framing it later
    this.fitAt = null; // (nor again when the peek grows, #446)
    this.past.push(this.snapshot(opts));
    if (this.past.length > 100) this.past.shift();
    this.future = [];
  }
  restoreSnap(s) {
    const map = this.app.activity();
    // the whole route's sport: the map's and the next leg's come back with it
    if (s.sports && s.map !== map && ACTIVITIES[s.map]) this.app.setSport(s.map, { from: 'route' });
    this.points = s.points;
    if (s.ids) this.points.forEach((p, k) => { if (s.ids[k] != null) this.pid.set(p, s.ids[k]); });
    this.nameAll(s.names);
    this.changeAll(s.changes);
    this.stopAll(s.stops);
    this.carryAll(s.carry);
    this.spotAll(s.spots);
    this.legs = s.legs.map((l) => ({ ...l }));
    // legs that followed the map's sport then keep that sport, if the map has moved on since
    const now = this.app.activity();
    if (s.map && s.map !== now) {
      this.legs.forEach((l) => { if (!l.sport) l.sport = l.mode === 'water' && !isWater(s.map) ? 'paddle' : s.map; if (l.sport === now) l.sport = undefined; });
    }
    // the next leg's sport, unless you've picked another one for the map since
    if (s.sports || s.map === now) { const nx = s.next || s.map; this.next = nx && nx !== now ? nx : null; }
    this.nogos = s.nogos || [];
    this.routeName = s.routeName || '';
    if (s.styles) this.styles = { ...s.styles };
    if (s.read) this.readKeys = new Set(s.read);
    if ('leave' in s) this.openLeave(s.leave);
    this.matchMode();
    this.update();
  }

  // ---------------------------------------------------------------- waypoint names & order
  nameAll(names) { this.points.forEach((p, i) => { if (names && names[i]) this.pname.set(p, names[i]); else this.pname.delete(p); }); }
  changeAll(list) { this.points.forEach((p, i) => { if (list && list[i] != null) this.pchange.set(p, list[i]); else this.pchange.delete(p); }); }
  stopAll(list) { this.points.forEach((p, i) => { const st = cleanStop(list && list[i]); if (st) this.pstop.set(p, st); else this.pstop.delete(p); }); }
  carryAll(list) { this.points.forEach((p, i) => { if (list && list[i]) this.pcarry.set(p, true); else this.pcarry.delete(p); }); }
  // older saved routes and snapshots have none
  spotAll(list) { this.points.forEach((p, i) => { const q = list && list[i]; if (Array.isArray(q) && q.length === 2 && q.every(Number.isFinite)) this.pspot.set(p, q); else this.pspot.delete(p); }); }

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
    this.legInSport(i, sport);
    this.update();
  }
  // (leg i's sport changed, and how it's drawn with it: no step of Undo, no routing yet)
  legInSport(i, sport) {
    const leg = this.legs[i];
    const route = this.app.activity();
    const fixed = leg.mode === 'fixed';
    const mode = fixed ? 'fixed' : isWater(sport) ? (leg.mode === 'line' ? 'line' : 'water') : leg.mode === 'water' ? 'auto' : leg.mode;
    this.legs[i] = { ...(fixed ? leg : {}), mode, style: null, sport: sport === route ? undefined : sport };
    // the last leg: the next one goes on in its sport (after a change, you keep paddling)
    if (i === this.legs.length - 1) { this.next = sport === route ? null : sport; this.matchMode(); }
  }

  // Change sport on point i (25d): the legs from it to the next change of sport, or to the finish (or to leg `last`,
  // when Sport from here picks again). One step of Undo. Returns the last leg it changed (null: none).
  setSportFrom(i, sport, { last = null } = {}) {
    if (!this.legs[i] || !ACTIVITIES[sport]) return null;
    const was = this.legSport(i);
    let j = i;
    if (last != null) j = Math.min(last, this.legs.length - 1);
    else while (j + 1 < this.legs.length && this.legSport(j + 1) === was) j++;
    if (this.legs.slice(i, j + 1).every((_, k) => this.legSport(i + k) === sport)) return null;
    this.commit();
    for (let k = i; k <= j; k++) if (this.legSport(k) !== sport) this.legInSport(k, sport);
    this.update();
    return j;
  }

  label(i) { return i === 0 ? 'Start' : i === this.points.length - 1 ? 'End' : `Via ${i}`; } // (End, not Finish, on every card and note: #353)

  // the road or path a point is on: from Valhalla's tags if it routed a leg there, else the map tiles
  autoName(i) {
    const near = [this.legs[i - 1] && this.legs[i - 1].result && this.legs[i - 1].result.tags.at(-1), this.legs[i] && this.legs[i].result && this.legs[i].result.tags[0]];
    const t = near.find((x) => x && x.name);
    return t ? t.name : this.roads.nameAt(this.points[i], 30);
  }

  /** What to call point i: your name, else the road it's on, else Start / Via n / End. */
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

  // Point i to ll without dragging (Move on its card): one step of Undo, its two legs routed again
  movePoint(i, ll) {
    if (!this.points[i]) return;
    this.beginEdit(i, this.snapshot());
    this.editTo(ll);
    this.endEdit();
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
  // (across another route put in place: each comes back with what was read on it, freshRead(); across one opened, with
  // when it leaves, restoreSnapshot())
  undo() { if (this.past.length) { const s = this.past.pop(), t = this.snapshot({ sports: s.sports }); if (s.read) t.read = [...this.readKeys]; if ('leave' in s) t.leave = this.leaveAt ?? this.leavePassed; this.future.push(t); this.restoreSnap(s); } }
  redo() { if (this.future.length) { const s = this.future.pop(), t = this.snapshot({ sports: s.sports }); if (s.read) t.read = [...this.readKeys]; if ('leave' in s) t.leave = this.leaveAt ?? this.leavePassed; this.past.push(t); this.restoreSnap(s); } }

  addPoint(ll) {
    this.commit();
    if (!this.points.length) this.readKeys = new Set(); // a new route: nothing read yet
    this.points.push(ll);
    const since = Date.now() - (this.lastAddAt || 0);
    this.lastAddAt = Date.now();
    if (this.points.length > 1) {
      this.altFor = this.points.length - 2; // a new leg at the end: other ways for it once it's routed (#95)
      this.altCalm = since >= ALT_CALM; // and both together, if you're taking your time (#211)
      // a new leg in the next leg's sport, as the toolbox says (the mode follows it: matchMode())
      this.legs.push({ mode: this.mode, sport: this.next || undefined });
    }
    this.update();
  }

  // exact: the point at ll itself, its two legs routed again (Add to my route); else on the line nearest it (no call)
  insertPoint(legIdx, ll, { exact = false } = {}) {
    if (!this.legs[legIdx]) return this.addPoint(ll);
    this.commit();
    this.splitLeg(legIdx, ll, null, { exact });
    this.update();
  }

  // A new via point on leg `li`, at the spot of the line nearest `ll`. The two
  // halves keep the geometry they had (a route through a point on it is the
  // same route), so adding a point on the line costs no routing request.
  // Returns the new point's index.
  splitLeg(li, ll, near = null, { exact = false } = {}) {
    const leg = this.legs[li];
    const r = leg.result;
    if (!exact && r && leg.status === 'ok' && leg.mode !== 'water' && r.coords.length > 1) {
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
      const half = (coords, tags, k) => ({ mode: leg.mode, status: 'ok', style: leg.style, sport: leg.sport, ice: leg.ice, src: src[k], result: { coords, tags, portage: [] } });
      this.points.splice(li + 1, 0, p);
      this.legs.splice(li, 1, half(c.slice(0, near.i + 1).concat([p]), r.tags.slice(0, near.i + 1), 0), half([p].concat(c.slice(near.i + 1)), r.tags.slice(near.i), 1));
      for (const k of [li, li + 1]) if (this.legs[k].mode !== 'fixed') this.legs[k].key = this.legKey(k).key;
    } else {
      this.points.splice(li + 1, 0, ll);
      this.legs.splice(li, 1, { mode: leg.mode === 'fixed' ? 'auto' : leg.mode, style: leg.style, sport: leg.sport, ice: leg.ice }, { mode: leg.mode === 'fixed' ? 'auto' : leg.mode, style: leg.style, sport: leg.sport, ice: leg.ice });
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
    toast('The route ends here now — undo brings back the rest');
    this.update();
  }

  // metres along the route to point i
  // the leg at m metres along the route (-1: none)
  legAt(m) {
    for (let i = 0; i < this.legs.length; i++) if (m < this.lengthTo(i + 1) + 0.5) return i;
    return this.legs.length - 1;
  }

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
      : { mode: l.mode, style: l.style, sport: l.sport, ice: l.ice }));
    this.update();
  }

  backToStart() {
    if (this.points.length < 2 || this.isLoop()) return;
    this.addPoint(this.points[0].slice());
  }

  clear() {
    if (!this.points.length) return;
    this.commit();
    this.freshRead(); // (Undo brings it back with what was read on it, #439)
    this.leavePassed = null;
    this.points = [];
    this.legs = [];
    this.next = null; // a new route starts in the map's sport
    this.matchMode();
    this.litLeg(null);
    this.update();
    toast('Route cleared', { ms: 7000, action: { label: 'Undo', fn: () => this.undo() } });
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
    // never wider than the screen less 8 px each side (a phone at 200 %, #440); pan it in sight, over the map's buttons if need be
    this.menu = new maplibregl.Popup({ maxWidth: `${Math.min(258, window.innerWidth - 16)}px`, offset: 8, closeButton: true, className: 'polku-popup' }).setLngLat(lngLat).setDOMContent(body).addTo(this.map);
    const pad = this.cards.pad();
    keepInView(this.map, this.menu, { left: (pad.left || 0) + 8, bottom: (pad.bottom || 0) + 8 });
  }

  setLegMode(i, mode) {
    if (!this.legs[i] || this.legs[i].mode === mode) return;
    this.commit();
    this.legs[i] = { mode, style: this.legs[i].style, sport: this.legs[i].sport };
    this.update();
  }

  setMode(mode) {
    this.mode = mode;
    this.renderTools();
    if (this.startView() === 'draw') this.renderStart(); // Draw it's line follows the mode
  }

  // ---------------------------------------------------------------- the next leg's sport (B of #233)
  // The planner's own, apart from the map's and the drawn legs': null follows the map's.
  nextSport() { return this.next || this.app.activity(); }
  // the sport the next leg is really in: Over water in a land sport is paddled
  nextLegSport() { const s = this.nextSport(); return this.mode === 'water' && !isWater(s) ? 'paddle' : s; }
  // how the next leg is drawn follows its sport: on the water Over water (or a straight line), on land not Over water
  matchMode(sport = this.nextSport()) {
    const m = this.mode, to = isWater(sport) ? (m === 'line' ? 'line' : 'water') : m === 'water' ? 'auto' : m;
    if (to !== m) this.setMode(to);
  }
  // after a route is opened: the next leg goes on in its last leg's sport
  nextFromLast() {
    const l = this.legs[this.legs.length - 1];
    this.next = l && l.sport && l.sport !== this.app.activity() ? l.sport : null;
    this.matchMode();
  }

  loadTrack(coords, name) {
    this.commit();
    this.freshRead();
    const c = simplify(coords, 2);
    this.points = [c[0], c[c.length - 1]];
    this.legs = [{ mode: 'fixed', status: 'ok', result: { coords: c, tags: c.slice(1).map(() => ({})), portage: [] } }];
    this.routeName = name;
    this.setActive(true, { edit: true }); // (a track to plan on)
    this.update();
    this.fitRoute(); // above the sheet that just opened
  }

  restore({ points, modes, style, legStyles, lipas, sports, changes, stops, carry, nogos, nogosLost, alts, ice, leave }) {
    const sport = this.app.activity();
    this.points = points;
    this.readKeys = new Set(); // (what's been read isn't in links)
    // the link's places to avoid (none in links from before av=)
    this.nogos = (nogos || []).map((n) => ({ ...n }));
    if (nogosLost) toast('Some places to avoid in this link couldn’t be read, so the route may go through them', { tone: 'warn', ms: 8000 });
    this.legs = points.slice(1).map((_, i) => ({ mode: CODE_MODE[modes[i]] || modes[i] || 'auto', sport: (sports && sports[i]) || undefined }))
      .map((l) => (l.mode === 'fixed' ? { mode: 'auto', sport: l.sport } : l));
    for (const [i, m] of changes || []) if (this.points[i]) this.pchange.set(this.points[i], m);
    for (const [i, st] of stops || []) if (this.points[i]) this.pstop.set(this.points[i], st);
    for (const i of carry || []) if (this.points[i]) this.pcarry.set(this.points[i], true);
    // legs that ride a LIPAS route: its line comes from LIPAS, not from a router
    for (const r of lipas || []) if (this.legs[r.i]) this.legs[r.i] = { mode: 'fixed', status: 'loading', result: null, sport: this.legs[r.i].sport, src: { t: r.t, id: r.id, seq: r.seq, a: r.a, b: r.b } };
    // a shared link's style is the route's, not yours: your own per-sport choice stays as it was
    this.styles = style != null ? { [sport]: decodeStyle(sport, style) } : {};
    for (const part of (legStyles || '').split(',')) {
      const [i, code] = part.split(':');
      if (this.legs[+i] && code) this.legs[+i].style = decodeStyle(this.legSport(+i), code);
    }
    for (const [i, k] of alts || []) if (this.legs[i] && this.legs[i].mode === 'auto') this.legs[i].alt = k;
    for (const i of ice || []) if (this.legs[i] && this.legs[i].mode === 'line') this.legs[i].ice = true;
    this.openLeave(leave);
    this.nextFromLast();
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
  // following it costs no routing call. Only the gaps between its parts, and the
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
      this.legs.push({ mode: this.mode, sport: this.next || undefined });
      this.points.push(...pts);
      this.legs.push(...legs);
    } else {
      this.points = pts;
      this.legs = legs;
      this.freshRead();
      this.routeName = p.name;
      // a loop on one leg gets two via points, so it can be dragged and has a finish of its own
      if (ride.loop && this.legs.length === 1) {
        const L = lineLength(this.legs[0].result.coords);
        this.splitLeg(0, null, alongAt(this.legs[0].result.coords, L / 3));
        this.splitLeg(1, null, alongAt(this.legs[1].result.coords, L / 3));
      }
    }
    this.setActive(true, { edit: true });
    this.update();
    this.frame(bbox(this.legs.flatMap((l, i) => (l.result ? l.result.coords : [this.points[i], this.points[i + 1]]))), { maxZoom: 15, duration: 700 });
    const km = fmtDist(ride.km * 1000);
    // in words for every sport (#306): you follow a marked route, whether you ride, walk or paddle it
    const what = ride.network ? `${p.name} is a network of trails: ${end ? 'added' : 'following'} the stretch ${end ? 'you picked' : 'you chose'} (${km})`
      : `${end ? 'Added' : 'Following'} ${p.name} · ${km}${ride.loop ? ' loop' : ''}${ride.left >= 0.3 ? ` (${fmtDist(ride.left * 1000)} of side trails left out)` : ''}`;
    toast(`${what}${!end && had ? ' — undo brings back your route' : ''}`, { ms: 7000, action: { label: 'Undo', fn: () => this.undo() } });
  }

  // The map's sport changed (`prev` the one before): the map and the legs you draw next are in it
  // (Only the legs you draw next, B of #233). A drawn route keeps its sports and its style: the legs
  // that followed the old sport have it as their own now, so nothing is routed again behind your
  // back. `from: 'route'`: the planner changes the route itself (The whole route, its Undo), so the
  // legs are left to it. Returns true when it told you something.
  onActivityChange(prev = null, { from = 'map' } = {}) {
    const sport = this.app.activity();
    // a round trip being set up follows the sport: its lengths and step (loops made for the old one go)
    if (this.loop.open) {
      const L = this.loop, pre = LOOP_PRESETS[sport] || LOOP_PRESETS.mtb;
      Object.assign(L, { km: pre.km[1], min: pre.min[1], sport, results: [], editing: false, note: '' });
      this.app.setData('loops', EMPTY);
    }
    this.styleLeg = null;
    const route = this.points.length > 1 && prev && prev !== sport && ACTIVITIES[prev];
    if (from !== 'route') {
      if (route) for (let i = 0; i < this.legs.length; i++) if (!this.legs[i].sport) this.legs[i].sport = this.legSportAs(i, prev);
      for (const l of this.legs) if (l.sport === sport) l.sport = undefined; // already in the new sport: follows it
      this.next = null; // the next legs are in the map's sport
      this.matchMode();
    }
    this.panel.classList.toggle('is-paddle', isWater(this.mainSport()));
    this.renderToolbarState();
    if (this.way === 'find') this.listMarked(); // Marked routes for the new sport
    this.renderStart(); // the start's ways, lines, chips and lengths are the sport's
    if (from === 'route') return true;
    if (!route) { if (this.points.length > 1) this.update(); return false; }
    this.update(); // the same legs (their keys match): only drawn again
    if (this.routeSports().every((k) => k === sport)) return false; // the route's own sport: the map's note says the rest
    toast(`The map and the legs you draw next are ${ACTIVITIES[sport].label} now. Your route stays ${this.sportsLabel()}.`, { ms: 7000 });
    return true;
  }

  // "MTB", "MTB and Paddle": the route's sports, in words
  sportsLabel(list = this.routeSports()) {
    const L = list.map((k) => ACTIVITIES[k].label);
    return L.length > 1 ? `${L.slice(0, -1).join(', ')} and ${L.at(-1)}` : L[0] || '';
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

  // What a sport picked with a route drawn would change (option A of B, #233): null when there's nothing to
  // ask (no route, or the route's own sport: one tap); else the menu's question in words, for the map's pill.
  sportQuestion(k) {
    if (this.points.length < 2 || !ACTIVITIES[k] || k === this.mainSport()) return null;
    const L = (x) => ACTIVITIES[x].label, R = this.mainSport(), S = L(k), legs = this.wholeRouteLegs(k);
    const n = legs.filter(Boolean).length, cross = isWater(k) !== isWater(R);
    const kept = [...new Set(this.legs.map((_, i) => this.legSport(i)).filter((_, i) => !legs[i]))];
    const fixed = this.legs.filter((l, i) => legs[i] && l.mode === 'fixed').length;
    const styled = this.legs.filter((l, i) => legs[i] && l.style).length;
    // one routing call per run of Follow paths legs, as routeAll() batches them; paced through request()
    let calls = 0;
    this.legs.forEach((l, i) => { if (legs[i] && l.mode === 'auto' && (!legs[i - 1] || this.legs[i - 1].mode !== 'auto' || this.nogosNear(this.points[i], this.points[i + 1]).length)) calls++; });
    const s = (m, one, many) => (m === 1 ? one : many);
    const all = cross
      ? `Not for this route: its ${L(R)} legs are ${isWater(R) ? 'on the water' : 'on land'} and can’t be ${VERB[k]}. To change a single leg, tap it on the map.`
      : [`Polku plans the ${n === 1 ? '' : `${n} `}${L(R)} ${s(n, 'leg', 'legs')} again as ${S}, with new times and checks${calls ? ` (${calls} routing ${s(calls, 'call', 'calls')})` : ''}.`,
        calls > 10 ? `The calls are spaced out, so this takes about ${Math.ceil(calls / 12)} minutes, a leg at a time.` : '',
        styled ? `${s(styled, 'A leg with a style of its own takes', 'Legs with a style of their own take')} the route’s ${S} style.` : '',
        kept.length ? `The ${this.sportsLabel(kept)} legs stay as they are.` : '',
        fixed ? `${s(fixed, 'A line from a file or LIPAS keeps its shape', 'Lines from a file or LIPAS keep their shape')}.` : '',
        `Undo brings the ${L(R)} route back.`].filter(Boolean).join(' ');
    return {
      title: `Use ${S} for…`, all, cross,
      next: `The legs you’ve drawn stay ${this.sportsLabel()}. The map switches to ${S}, and so do the legs you draw from now on.`,
      already: k === this.nextSport() && k === this.app.activity(),
      keep: `Keep ${L(this.app.activity())}`,
    };
  }

  // the legs The whole route changes for sport k: those in the route's sport, or in k already (a leg in
  // another sport, the paddle across in a ride, keeps it)
  wholeRouteLegs(k) {
    const R = this.mainSport();
    return this.legs.map((_, i) => this.legSport(i) === R || this.legSport(i) === k);
  }

  // The whole route in sport k: its legs in the route's sport follow k (fixed lines keep their line), their
  // own styles go (styles are per sport), and the map and the next legs are in k. One undo step brings
  // back the legs, the styles, the lines and the map's and the next leg's sport (restoreSnap()).
  wholeRoute(k) {
    const R = this.mainSport();
    if (!ACTIVITIES[k] || this.points.length < 2 || k === R || isWater(k) !== isWater(R)) return;
    const change = this.wholeRouteLegs(k), was = this.legs.map((_, i) => this.legSport(i));
    this.commit({ sports: true });
    this.app.setSport(k, { from: 'route' });
    let styled = 0;
    this.legs.forEach((l, i) => {
      if (change[i]) { if (l.style) styled++; l.sport = undefined; l.style = null; } // follows the map's: k
      else l.sport = was[i] === k ? undefined : was[i];
    });
    this.next = null;
    this.matchMode();
    this.update();
    const n = change.filter(Boolean).length;
    toast(`Your route is ${ACTIVITIES[k].label} now: ${n} ${n === 1 ? 'leg' : 'legs'} planned again${styled ? ' in the route’s style' : ''}.`, { ms: 7000, action: { label: 'Undo', fn: () => this.undo() } });
  }

  // A sport picked for the next leg (the drawing menu, the water note): Only the legs you draw next.
  // What's drawn stays, the map follows (nothing to undo), and Paddle and Swim draw Over water.
  pickNext(k) {
    if (!ACTIVITIES[k] || k === this.nextSport()) return;
    if (k !== this.app.activity()) { this.app.setSport(k); return; } // onActivityChange() says what changed
    this.next = null; // back to the map's sport
    this.matchMode();
    this.renderTools();
  }

  // The planner open or put away (25c, #233). Open, it's editing or the route's view (setEditing()): `edit` says
  // which, else it opens as it was left. Either is remembered, so a reload opens it again as it was (#238).
  // instant: at once (the page loading); on a phone it slides in and out otherwise (showSheet())
  setActive(on, { edit = null, instant = false } = {}) {
    if (!on) this.clearCategoryPreview();
    this.active = on;
    if (on && edit != null) this.editing = edit;
    this.remember();
    if (on) this.toolsShown = null; // (the toolbox coming back with it isn't new: it doesn't fade in)
    this.showSheet(on, { instant });
    if (!on) {
      this.cards.close(); this.stopPicking();
      this.closeMore(); this.litLeg(null); this.clearAlts(); delete document.body.dataset.sheet; delete document.body.dataset.pl;
      // the start opens at the ways to begin next time
      if (this.loop.open && this.loop.fromWays) this.closeLoop();
      this.leaveWay();
      this.dropWayHist();
    }
    // an empty route opens small, so the map is there to tap; otherwise as you left it (its peek is its line where the peek
    // would cover more than half the screen)
    if (on) {
      const st = !this.points.length && this.layout() === 'sheet' ? 'peek' : store.get('sheetState', {})[this.layout()];
      this.setSheetState(st === 'peek' && this.layout() === 'sheet' ? this.restSize() : st, { remember: false, rest: true, instant });
    }
    document.body.classList.toggle('planning', on);
    for (const m of this.markers) m.getElement().hidden = !on;
    this.drawHeads(); // (put away: what to read before you go stays marked on the route)
    this.renderState();
    this.app.onActiveChange(on);
    if (on && !this.analysis) this.renderAnalysis(); // the empty planner's first words (and its round-trip button)
    if (!on) { this.modesMenu?.close(); }
    this.renderToolbarState(); // the toolbox, and Show the whole route in the map's column
    this.drawColored();
    if (on) requestAnimationFrame(() => this.chart.draw());
    // opened far from the route (you browsed elsewhere): bring it back into view
    if (on && this.points.length && !this.routeInView()) requestAnimationFrame(() => this.fitRoute());
  }

  // Done and Edit (25c): Done ends editing for the route's view, to read, check and take along. The drawing tools go
  // (More stays), the markers stay put, and a tap on the map shows what's there (the map's own cards) instead of
  // adding a point. Edit goes back, where Done was. Nothing is lost: the route is kept on this device all along,
  // and undo outlives both.
  setEditing(on) {
    if ((!on && this.points.length < 2) || this.editing === on) return;
    const had = [this.els.done, this.els.edit, this.els.toolDone, this.els.toolEdit].indexOf(document.activeElement);
    this.editing = on;
    this.remember();
    if (!on) { if (this.menu) this.menu.remove(); this.cards.close(); this.stopPicking(); this.modesMenu?.close(); this.closeMore(); this.clearAlts(); clearTimeout(this.altTimer); }
    this.renderState();
    this.renderWaypoints();
    this.renderTools();
    this.els.said.textContent = on ? 'Editing: a tap on the map adds a point.' : 'Done editing: a tap on the map shows what’s there.';
    // the keyboard's focus stays where it was: on Edit where Done was, and back
    if (had >= 0) [this.els.edit, this.els.done, this.els.toolEdit, this.els.toolDone][had].focus();
  }
  // the route's view: the planner open, a route, not editing
  inView() { return this.active && !this.editing && this.points.length > 1; }
  // Done (the route's numbers on phones, the toolbar on desktops, E): the route's view; with only a first point there's
  // nothing to view yet, and Done puts the planner away, as ✕ does
  done() { if (this.points.length > 1) this.setEditing(false); else this.close(); }
  // ✕: the planner put away, with a note that offers it back as it was; the route stays on the map
  close() {
    this.setActive(false);
    if (this.points.length) toast('Planner closed · your route stays', { ms: 6000, action: { label: 'Open', fn: () => { if (!this.active) this.setActive(true); } } });
  }
  // open or put away, and editing or the route's view, for the next visit (#238; main.js opens it again)
  remember() { store.set('plannerOpen', { open: this.active, view: !this.editing }); }

  // What editing and the route's view change around the panel: its title row and Done or Edit, the markers (they
  // stay put in the view), the leg's handles, the pointer
  renderState() {
    const view = this.inView();
    this.panel.classList.toggle('viewing', view);
    this.panel.setAttribute('aria-label', view ? 'Route planner: your route' : 'Route planner');
    this.map.getCanvas().style.cursor = this.active && !view ? 'crosshair' : '';
    for (const m of this.markers) m.setDraggable(!view);
    this.renderGhosts();
    this.renderTitle();
  }
  // The route's view's top row: the route's name, its sports and that it's kept on this device, and ✕; and Edit in
  // Done's place (the toolbar's on desktops)
  renderTitle() {
    if (!this.els || !this.els.title) return;
    this.renderTopSum(); // (the names come with the map's tiles)
    const view = this.inView();
    this.els.title.hidden = !view;
    this.els.done.hidden = view;
    this.els.edit.hidden = !view;
    if (!view) return;
    this.els.titleName.textContent = this.routeTitle();
    this.els.titleSub.innerHTML = `${escapeHtml(this.sportsLabel())} · ${icon('check', 13)}<span>Kept on this device</span>`;
  }

  // ---------------------------------------------------------------- routing
  update() {
    // a route (or its first point) ends the start's steps; Undo back to none starts at the ways
    if (this.points.length && (this.way || this.wayDepth)) { this.leaveWay(); this.dropWayHist(); }
    // a round trip from your first point goes with it (Undo, Clear): the ways to begin come back
    if (this.loop.open && !this.loop.fromWays && !this.points.length) this.closeLoop();
    // no route to view (Clear, Undo back to a point): editing, at the start or the first point
    if (!this.editing && this.points.length < 2) { this.editing = true; this.remember(); this.renderState(); }
    this.clearAlts();
    this.clearCategoryPreview();
    this.drawNogos();
    this.renderMarkers();
    this.renderWaypoints();
    this.checkWet();
    this.renderToolbarState();
    this.renderStart();
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
    const base = `${leg.mode}|${profile}|${from.join(',')}|${to.join(',')}|${nogos.map((n) => n.ll.join(',') + n.r).join(';')}|${styleKey}${waterKey}`;
    // another way picked (#95): BRouter's alternative k; added only then, so older keys still match
    const alt = leg.mode === 'auto' && leg.alt ? leg.alt : 0;
    return { key: alt ? `${base}|alt${alt}` : base, base, alt, from, to, nogos, profile, rp, at };
  }

  // When leg i starts, roughly: the departure plus the way so far at your paddling speed (for the wind on water legs)
  legStartSec(i) {
    const kmh = (CRAFT[this.craft] || CRAFT.kayak).kmh;
    return this.startSec() + (this.lengthTo(i) / 1000 / kmh) * 3600;
  }

  // the router parameters for leg i: its own style, else its sport's (the route's, or your saved one for another sport)
  routerFor(i) {
    return routerOf(this.legSport(i), this.legStyle(i), this.wet.on);
  }
  legStyle(i) { const leg = this.legs[i]; return (leg && leg.style) || this.styleOf(this.legSport(i)); }

  // Heads-up's Short cut (#106): this leg's style with Short cuts ok, and its points that the
  // router moved off the private way put back where you picked them, so it can take it. One
  // step of Undo.
  useShortCut(li, picks = []) {
    if (!this.legs[li]) return;
    const base = this.legStyle(li);
    this.commit();
    for (const k of picks) {
      // a new array, as a drag makes (Undo's legs still hold the old one), with what belongs to the point
      const old = this.points[k], spot = old && this.pspot.get(old);
      if (!spot) continue;
      const q = spot.slice();
      for (const m of [this.pname, this.pchange, this.pstop, this.pcarry]) if (m.has(old)) m.set(q, m.get(old));
      this.points[k] = q;
    }
    this.legs[li].style = { p: base.p, v: { ...(base.v || {}), a: 'cuts' }, wet: base.wet || 'auto' };
    this.renderStyle();
    this.renderToolbarState();
    this.update();
    toast('Short cuts through ways marked private on this leg: only where you may go', { ms: 7000, action: { label: 'Undo', fn: () => this.undo() } });
  }

  // ---------------------------------------------------------------- other ways (#95)
  // Other ways for leg li, from BRouter's alternatives (one call each; BRouter runs k+1
  // searches for alternative k). On its own, a leg you've just added gets them a moment after
  // it's routed (not after the terrain), if you haven't added the next point by then
  // (ALT_PAUSE: no calls while you sketch). Alternatives 1 and 2 come together when you're
  // taking your time (ALT_CALM since the point before) and the pacing is quiet (only this leg
  // in the last 10 s, 8 calls free in the minute), or always with your own routing server;
  // else alternative 1 and, if you're still looking a while later (ALT_MORE), alternative 2.
  // Points every 2 s fill brouter.de's pacing on their own, so the pause stays: with a
  // shorter one, legs would wait (the table in #211's pull request). Only for a leg at least
  // ALT_MIN long, and only with room under the pacing (headroom 3, maxWait 0: never ahead of
  // your next point's leg; the second on its own also needs 6 calls free in the minute, so it
  // doesn't use up the next legs' first ones). The leg's menu has Other ways for any leg, any
  // time: both, which may wait their turn. A way within 100 m of the leg (and of the ways shown) all
  // along is left out. They're drawn like the route, in blue, under it, where they differ; a
  // tap takes one (leg.alt), and the way you had stays, grey, to go back to, until the next
  // point. The short cut through a way marked private (#104) is one more, where Heads-up has
  // it for the leg.
  offerAltsSoon(li) {
    const leg = this.legs[li];
    if (!leg) return; // gone before it was in: Undo or Clear right after its point (#351)
    const key = leg.key;
    const same = () => this.legs[li] === leg && leg.key === key;
    const own = routerHeadroom() === Infinity, calm = this.altCalm;
    clearTimeout(this.altTimer);
    this.altTimer = setTimeout(async () => {
      if (!same() || this.inView()) return; // (none on their own after Done: 25c)
      const both = own || (calm && routerHeadroom() >= 4 && routerRoomThisMinute() >= 8);
      await this.offerAlts(li, false, both ? [1, 2] : [1]);
      if (both || !same()) return;
      // still looking: alternative 2 (also when 1 was too close to show)
      this.altTimer = setTimeout(() => { if (same()) this.offerAlts(li, false, [2]); }, ALT_MORE);
    }, own ? ALT_PAUSE_OWN : ALT_PAUSE);
  }

  async offerAlts(li, asked = false, ks = null) {
    const leg = this.legs[li];
    if (!this.active || !leg || leg.mode !== 'auto' || leg.status !== 'ok' || !leg.result || leg.result.provider === 'valhalla') return;
    if (!asked && (li !== this.legs.length - 1 || lineLength(leg.result.coords) < ALT_MIN || routerHeadroom() < 3)) return;
    // the second one comes last: only with plenty of room left this minute, so the next legs still get their first
    if (!asked && ks && ks.includes(2) && routerRoomThisMinute() < 6) return;
    // the ways already shown for this leg stay; more are added to them
    let mine = this.alts && this.alts.li === li && this.alts.key === leg.key ? this.alts : null;
    if (!mine) { this.clearAlts(); mine = this.alts = { li, key: leg.key, base: this.legKey(li).base, ways: [], ctrl: new AbortController() }; }
    const t = { i: li, leg, ...this.legKey(li) };
    const want = (ks || [0, 1, 2]).filter((k) => k !== (leg.alt || 0) && !mine.ways.some((w) => w.k === k));
    if (asked) toast('Looking for other ways for this part…', { ms: 2500 });
    const n0 = mine.ways.length;
    const got = await Promise.all(want.map(async (k) => {
      try {
        const r = await routeLeg({ from: t.from, to: t.to, mode: 'auto', profile: t.profile, opts: { portage: true, nogos: t.nogos, maxWait: asked ? 20000 : 0, fallback: false, ...this.styleOpts(t), alt: k } }, mine.ctrl.signal);
        return { k, r };
      } catch { return null; } // no room, or no such way: just fewer of them
    }));
    // the short cut comes from this route's analysis, which may still be on its way
    if (this.analysing) await this.analysing.catch(() => {});
    if (this.alts !== mine || leg.key !== mine.key) return;
    for (const g of got) {
      const w = g && !g.r.note && this.altWay(g.r, g.k, leg.result.coords, mine.ways, 'Other way');
      if (w) mine.ways.push(w);
    }
    const cut = this.analysis && (this.analysis.accessWarn || []).find((w) => w.cutLeg === li);
    if (cut && !mine.ways.some((w) => w.cut)) mine.ways.push({ cut, parts: [cut.cut], label: `Short cut, marked private\n${cut.note.match(/save about [^·]+/) ? cut.note.match(/save about [^·]+/)[0].trim().replace('save', 'saves') : 'only where you may go'}` });
    if (!mine.ways.length) { if (asked) toast('No other way here that’s more than 100 m apart from this one'); this.clearAlts(); return; }
    if (mine.ways.length === n0) return;
    this.drawAlts();
    const n = mine.ways.length;
    if (!n0 || asked) toast(n === 1 ? 'Another way for this part: tap it on the map to take it' : `${n} other ways for this part: tap one on the map to take it`, { ms: 6000 });
  }

  // way k (its line r) beside the leg's line `now`: where it's more than 15 m from it and from
  // the ways already shown, if that's 100 m or more; labelled with its length against the leg
  // and its share of trails (the leg's own share is on the route's label: drawAlts). null: too
  // close to show.
  altWay(r, k, now, shown, title) {
    const parts = this.altParts(r.coords, [now, ...shown.filter((w) => w.r).map((w) => w.r.coords)]);
    if (parts.reduce((m, c) => m + lineLength(c), 0) < 100) return null;
    const d = lineLength(r.coords) - lineLength(now);
    const diff = Math.abs(d) < 10 ? 'about as long' : `${d >= 0 ? '+' : '−'}${fmtDist(Math.abs(Math.round(d / 10) * 10))}`;
    return { k, r, parts, label: `${title}\n${diff} · ${trailsText(trailShare(r))}` };
  }

  // the stretches of `coords` more than 15 m from all of `lines` (at least two points each)
  altParts(coords, lines) {
    const far = coords.map((c) => lines.every((l) => nearestOnLine(c, l).d > 15));
    const out = [];
    let cur = null;
    coords.forEach((c, j) => {
      if (far[j]) { if (!cur) { cur = j ? [coords[j - 1]] : []; out.push(cur); } cur.push(c); }
      else if (cur) { cur.push(c); cur = null; }
    });
    return out.filter((c) => c.length > 1);
  }

  // the ways on offer, drawn like the route where they leave it (style.js: under it, the same
  // width and white casing), each labelled; and a label on the route's own leg in the same
  // form, so the two compare (its share of trails, where it differs from them)
  drawAlts() {
    const A = this.alts, leg = A && this.legs[A.li];
    this.altHover(null);
    const mid = (parts) => { const c = parts.reduce((x, p) => (lineLength(p) > lineLength(x) ? p : x), parts[0]); return c[Math.floor(c.length / 2)]; };
    const features = A ? A.ways.flatMap((w, i) => {
      const color = w.cut ? ALT_CUT : w.before || !w.k ? ALT_BEFORE : ALT_COLOR;
      return [
        { type: 'Feature', properties: { i, color, kind: 'line' }, geometry: { type: 'MultiLineString', coordinates: w.parts } },
        { type: 'Feature', properties: { i, color, kind: 'label', label: w.label }, geometry: { type: 'Point', coordinates: mid(w.parts) } },
      ];
    }) : [];
    if (A && A.ways.length && leg && leg.result) {
      const own = this.altParts(leg.result.coords, A.ways.map((w) => (w.r ? w.r.coords : w.parts.flat())));
      const at = own.length ? mid(own) : leg.result.coords[Math.floor(leg.result.coords.length / 2)];
      features.push({ type: 'Feature', properties: { i: ALT_ROUTE_ID, color: ROUTE_COLORS.route, kind: 'label', route: true, label: `This way\n${trailsText(trailShare(leg.result))}` }, geometry: { type: 'Point', coordinates: at } });
    }
    this.app.setData('routeAlts', { type: 'FeatureCollection', features });
  }

  // the way under the pointer (its index, or null) shows brighter
  altHover(i) {
    if (this.altLit === i || !this.map.getSource('routeAlts')) return;
    if (this.altLit != null) this.map.setFeatureState({ source: 'routeAlts', id: this.altLit }, { hover: false });
    this.altLit = i;
    if (i != null) this.map.setFeatureState({ source: 'routeAlts', id: i }, { hover: true });
  }

  clearAlts() {
    clearTimeout(this.altTimer); // a point added, a drag, Undo…: no other way for the leg before
    if (!this.alts) return;
    this.alts.ctrl.abort();
    this.alts = null;
    this.altHover(null);
    this.app.setData('routeAlts', EMPTY);
  }

  // way i of the ones on offer taken: the leg keeps BRouter's alternative k (its line is in
  // already, so nothing is routed again), or takes the short cut. One step of Undo. The way
  // you had stays as a ghost, with the others, to go back to until the next point.
  pickAlt(i) {
    const A = this.alts, w = A && A.ways[i], leg = A && this.legs[A.li];
    if (!w || !leg || leg.key !== A.key) return;
    const li = A.li;
    this.clearAlts();
    if (w.cut) { this.useShortCut(li, w.cut.picks || []); return; }
    const before = { k: leg.alt || 0, r: leg.result };
    this.commit();
    leg.alt = w.k || 0;
    leg.altBase = A.base;
    leg.result = w.r;
    leg.status = 'ok';
    leg.key = this.legKey(li).key;
    this.update();
    // what's still on offer, against the way taken: the way you had first, then the others
    const mine = this.alts = { li, key: leg.key, base: A.base, ways: [], ctrl: new AbortController() };
    for (const o of [{ ...before, title: 'Way before' }, ...A.ways.filter((x, j) => j !== i).map((x) => ({ ...x, title: x.before ? 'Way before' : 'Other way' }))]) {
      if (o.cut) { mine.ways.push(o); continue; }
      const g = this.altWay(o.r, o.k, leg.result.coords, mine.ways, o.title);
      if (g) mine.ways.push(o.title === 'Way before' ? { ...g, before: true } : g);
    }
    if (mine.ways.length) this.drawAlts(); else this.alts = null;
    toast(`This part takes ${w.k ? 'the other way' : 'its first way'} now${mine.ways.some((x) => x.before) ? ': the way before is still on the map' : ''}`, { ms: 5000, action: { label: 'Undo', fn: () => this.undo() } });
  }

  // what's on the water on leg i: a swimmer, or your craft
  craftOf(i) { return this.legSport(i) === 'swim' ? 'swim' : this.craft; }

  // what the routers get for a leg (styles.js)
  styleOpts(t) { return { params: t.rp.params, valhalla: t.rp.valhalla, water: { ...t.rp.water, craft: this.craftOf(t.i), at: t.at, nogos: t.nogos } }; }

  // a leg is being routed: the bar on the sheet's top edge, and Routing… on the folded line (#580)
  setBusy(on) {
    if (this.panel.classList.contains('busy') === on) return;
    this.panel.classList.toggle('busy', on);
    this.renderFold();
  }

  async routeAll() {
    const gen = ++this.gen;
    const todo = []; // legs to route: { leg, key, from, to, nogos, profile }
    this.legs.forEach((leg, i) => {
      if (leg.mode === 'fixed') { if (leg.result) leg.status = 'ok'; return; } // a LIPAS leg from a link may still be on its way
      let k = this.legKey(i);
      // another way picked for it (#95) stands while the leg stays the same: its points, sport, style, mode
      if (leg.alt && !leg.altBase) leg.altBase = k.base; // from a saved route or a link
      if (leg.alt && leg.altBase !== k.base) { leg.alt = 0; leg.altBase = null; k = this.legKey(i); }
      if (leg.key === k.key && leg.result) return;
      leg.key = k.key;
      leg.result = null;
      leg.status = 'loading';
      todo.push({ i, leg, ...k });
    });
    // Consecutive auto legs with nothing to avoid near them go to BRouter in one
    // call (a new sport, a shared link, both legs of a drag): it counts the calls.
    const jobs = [];
    const batchable = (t) => t.leg.mode === 'auto' && !t.nogos.length && !t.alt; // BRouter picks "alternative k" for a whole call
    for (let j = 0; j < todo.length;) {
      let e = j;
      while (batchable(todo[j]) && e + 1 < todo.length && todo[e + 1].i === todo[e].i + 1 && batchable(todo[e + 1]) && todo[e + 1].rp.key === todo[e].rp.key && todo[e + 1].profile === todo[e].profile) e++;
      const run = todo.slice(j, e + 1);
      j = e + 1;
      jobs.push(run.length > 1 ? () => this.routeRunOf(run) : () => this.routeOne(run[0]));
    }
    this.drawRoute();
    this.setBusy(jobs.length > 0);
    await pool(jobs, 3);
    if (gen !== this.gen) return;
    this.setBusy(false);
    if (this.refit && this.legs.every((l) => l.result && l.status !== 'waiting')) { this.refit = false; this.fitRoute(); }
    if (this.snapPoints()) { this.renderMarkers(); this.drawRoute(); }
    if (jobs.length) this.save(); // now with the routed geometry
    // the leg you've just added: other ways for it, if there's room (#95); they don't wait for
    // the analysis (terrain), only the short cut among them does (offerAlts)
    if (this.altFor != null) { const li = this.altFor; this.altFor = null; this.offerAltsSoon(li); }
    this.analysing = this.runAnalysis(gen);
    await this.analysing;
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
      this.legDone(t, await routeLeg({ from: t.from, to: t.to, mode: t.leg.mode, profile: t.profile, opts: { portage: true, nogos: t.nogos, maxWait: STAND_IN_AFTER, ...this.styleOpts(t), alt: t.alt } }));
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
      toast(`Couldn't route this leg (${e.message}) — drawn as a straight line. Check has a Retry.`, { tone: 'warn', ms: 6000 });
    }
  }

  drawRoute() {
    const features = [];
    this.legs.forEach((leg, i) => {
      const from = this.points[i], to = this.points[i + 1];
      const loading = !leg.result || leg.status === 'waiting';
      const coords = this.legLine(i);
      const mode = drawnMode(leg);
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
    if (this.litSpan && this.legs[this.litSpan.to - 1]) this.showSpan(this.litSpan);
    if (!this.edit) this.renderGhosts();
  }

  // ---------------------------------------------------------------- round trips
  // Loops of about a chosen length from a start (js/roundtrip.js does the
  // shapes and the water). Three candidates, each one routing call; a bad one
  // is replaced by the next direction and a near miss resized once, at most
  // six calls in all. Picking one makes it a normal route.
  // The round trip's form, in the peek (#232): from the first point (`start`), from the route's start (More,
  // Route's tools), or from the ways to begin (`fromWays`: no start until a tap on the map or Where I am).
  // `len`: a length picked in the first point's peek, in the form's unit. Opening it makes no routing calls.
  openLoop(start = null, { fromWays = false, len = null } = {}) {
    const L = this.loop;
    if (!this.active) this.setActive(true, { edit: true });
    else this.setEditing(true); // (from the route's view's More: a round trip is drawn)
    const sport = this.app.activity();
    const pre = LOOP_PRESETS[sport] || LOOP_PRESETS.mtb;
    if (L.km == null || L.sport !== sport) { L.km = pre.km[1]; L.min = pre.min[1]; L.sport = sport; }
    if (len != null) { if (L.mode === 'min') L.min = len; else L.km = len; L.other = false; }
    L.open = true;
    L.results = [];
    L.editing = false;
    L.note = '';
    L.styleOpen = false;
    L.fromWays = fromWays && !this.points.length;
    if (L.fromWays) this.pushWay();
    if (start) this.setLoopStart(start, this.points.length === 1 ? 'your first point' : 'the spot you chose', false);
    else if (this.points.length) this.setLoopStart(this.points[0].slice(), this.points.length === 1 ? 'your first point' : 'your route’s start', false);
    else this.clearLoopStart();
    if (this.layout() === 'sheet') this.setSheetState('peek', { remember: false }); // the form is the peek
    this.renderLoop();
    if (!this.analysis) this.renderAnalysis();
  }

  closeLoop() {
    const L = this.loop;
    const had = L.open;
    L.open = false;
    L.results = [];
    L.busy = false;
    L.other = false; // the length's field closes with the form
    if (L.fromWays) { L.fromWays = false; this.dropWayHist(); }
    this.clearLoopStart();
    this.app.setData('loops', EMPTY);
    // back to the size you had for the route
    if (had && this.active && this.points.length > 1 && this.layout() === 'sheet') this.setSheetState(store.get('sheetState', {}).sheet || 'peek', { remember: false });
    this.renderLoop();
    if (!this.analysis) this.renderAnalysis();
  }

  clearLoopStart() {
    this.loop.start = null;
    this.loop.startLabel = '';
    if (this.loopMarker) { this.loopMarker.remove(); this.loopMarker = null; }
  }

  setLoopStart(ll, label, render = true) {
    const L = this.loop;
    L.start = ll;
    L.startLabel = label;
    L.results = [];
    L.note = '';
    this.app.setData('loops', EMPTY);
    if (!this.loopMarker) this.loopMarker = new maplibregl.Marker({ element: h('div', { class: 'wp-hit' }, h('div', { class: 'wp wp-start' })) }).setLngLat(ll).addTo(this.map);
    else this.loopMarker.setLngLat(ll);
    if (render) { this.renderLoop(); this.startInView(ll, label === 'your position'); }
  }

  // The form grows when the start is chosen: the start stays in sight above it (and Where I am centres on it there)
  startInView(ll, centre = false) {
    requestAnimationFrame(() => {
      const pad = this.viewPadding(), q = this.map.project(ll), c = this.map.getContainer();
      if (!centre && q.x > pad.left && q.x < c.clientWidth - pad.right && q.y > pad.top && q.y < c.clientHeight - pad.bottom) return;
      this.map.easeTo({ center: ll, offset: [(pad.left - pad.right) / 2, (pad.top - pad.bottom) / 2], duration: 500 });
    });
  }

  // Where I am: the browser’s position, once, as the loops' start. It's sent to the router like any
  // point, so the form says so where it's chosen, and only as precise as routing needs: five
  // decimals, about a metre, as share links keep every point (#281).
  async loopFromHere() {
    if (!navigator.geolocation) { toast('This browser can’t tell where you are'); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      if (!this.loop.open) return;
      const ll = [+pos.coords.longitude.toFixed(5), +pos.coords.latitude.toFixed(5)];
      this.setLoopStart(ll, 'your position');
    }, () => toast(`Couldn’t get your position — ${this.coarse() ? 'tap' : 'click'} the map for the start`), { enableHighAccuracy: true, timeout: 10000 });
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
        this.frame(b, { duration: 0, maxZoom: 15 });
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
        try { const [s] = await pointForecasts([start]); direction = Math.round(sampleAt(s, this.startSec()).dir); } catch { direction = null; }
      }
      const rp = routerOf(sport, keepOff(this.styleOf(sport)), this.wet.on); // round trips keep off ways marked private (#106)
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
        r.a = await analyse({ coords: r.line.coords, attrs: r.line.tags.map((t) => ({ mode: wet ? 'water' : 'auto', tags: t || {} })) }, this.timeOpt(sport));
        if (!wet) r.carry = 0;
        r.events = wet ? r.legs.flatMap((l) => (l.water && l.water.events) || []) : [];
        r.score = loopScore({ km: r.a.total / 1000, targetKm: targetM / 1000, twice: r.twice, warnings: r.a.warnings.filter((w) => !/^Carry/.test(w.text)).length + (r.a.trailWarn || []).length + r.events.length, carryM: wet ? r.carry : 0 }) + (r.o.outBack ? 10 : 0); // a ring, where there's room for one
      }
      lap('analyse');
      if (!L.open) return; // put away meanwhile (Close, Back, the point it started from undone): nothing to show
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
      if (ok.length) this.frame(bbox(L.results.flatMap((r) => r.line.coords)), { duration: 600, maxZoom: 15 });
    } finally {
      L.busy = false;
      L.progress = 0;
      this.renderLoop();
      // after "More loops", the new ones into view
      if (more) requestAnimationFrame(() => this.cardIntoView(this.els.loopBox.querySelectorAll('.loop-card')[L.on]));
    }
  }

  drawLoops() {
    const L = this.loop;
    this.app.setData('loops', { type: 'FeatureCollection', features: L.results.map((r, i) => ({ type: 'Feature', properties: { color: r.color, on: i === L.on, i }, geometry: { type: 'LineString', coordinates: r.line.coords } })) });
  }

  // Loop i picked (a tap on its line or its card): drawn on top, its card marked and in view.
  // `frame`: the map frames it too (not on hover, which also picks).
  showLoop(i, { frame = false } = {}) {
    const L = this.loop, r = L.results[i];
    if (!r) return;
    L.on = i;
    this.drawLoops();
    this.markLoopCards();
    if (!frame) return;
    this.frame(bbox(r.line.coords), { duration: 600, maxZoom: 15 });
    this.cardIntoView(this.els.loopBox.querySelectorAll('.loop-card:not(.loop-more)')[i]);
  }

  // A loop picked: a normal route. Its via points move onto the line (the
  // nearest spot, in order), so the legs split exactly and nothing is routed again.
  pickLoop(k) {
    const r = this.loop.results[k];
    if (!r) return;
    if (r.legs) { // on the water: its legs as they were routed, start → via points → start
      this.commit();
      this.points = r.o.points.map((p) => p.slice());
      this.freshRead();
      this.legs = r.legs.map((res) => ({ mode: 'water', status: 'ok', result: res }));
      // a leg routed without a source that was slow then is routed again (its answer is in the cache by now)
      this.legs.forEach((l, i) => { l.key = l.result.water && l.result.water.missing && l.result.water.missing.length ? null : this.legKey(i).key; });
      this.routeName = '';
      this.closeLoop();
      this.update();
      this.fitRoute();
      toast(`Loop ${r.letter} is your route now — drag it or its points to change it`, { ms: 7000, action: { label: 'Undo', fn: () => this.undo() } });
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
    this.freshRead();
    this.points = pts;
    this.legs = cuts.slice(1).map((b, i) => ({ mode: 'auto', status: 'ok', result: { coords: c.slice(cuts[i], b + 1), tags: tags.slice(cuts[i], b), portage: [], provider: r.line.provider } }));
    this.legs.forEach((l, i) => { l.key = this.legKey(i).key; });
    this.routeName = '';
    this.closeLoop();
    this.update();
    this.fitRoute();
    toast(`Loop ${r.letter} is your route now — drag it or its points to change it`, { ms: 7000, action: { label: 'Undo', fn: () => this.undo() } });
  }

  // The round trip is in the header, the peek (#232): renderStart() draws it with the rest of the start.
  renderLoop() { this.renderStart(); }

  // Something in the form changed: the loops shown were made for the old one
  loopChanged() {
    const L = this.loop;
    L.results = [];
    L.note = '';
    this.app.setData('loops', EMPTY);
    this.renderStart();
  }

  // The form: where it starts, and once it has a start, distance or time, the lengths, − / +, the direction, the
  // sport and route style, and Make 3 loops with what it costs. With loops made: the loops, side by side.
  loopView() {
    const L = this.loop, sport = this.app.activity(), tap = this.coarse() ? 'tap' : 'click', desk = this.sideMQ.matches;
    const top = L.fromWays ? [this.backRow()] : [];
    const close = L.fromWays ? null : h('button', { type: 'button', class: 'tool way-x', 'data-k': 'loop-x', 'aria-label': 'Close the round trip', title: 'Close the round trip', onclick: () => this.closeLoop(), html: icon('close', 20) });
    // the form's top: the sport's row right under the top row, as in every step (2026-10-21)
    const lead = (head) => (L.fromWays ? [...top, this.sportRow(), head] : [head, this.sportRow()]);
    if (!roundTripSports.includes(sport)) return [...lead(h('div', { class: 'way-head' }, h('div', { class: 'way-hint' }, h('b', {}, 'Round trip')), close)), h('p', { class: 'note' }, `No round trips for ${ACTIVITIES[sport].label} yet.`)];
    if (L.results.length && !L.editing) return [...top, ...this.loopResults(close)];
    if (L.busy) return [...top, ...this.loopMaking(close)];
    const pre = LOOP_PRESETS[sport] || LOOP_PRESETS.mtb, min = L.mode === 'min', val = min ? L.min : L.km;
    const step = min ? 15 : groupOf(sport) === 'bike' ? 5 : 1; // 5 km for bikes, 1 km on foot or water, 15 minutes by time
    const set = (v) => {
      v = Math.max(1, Math.min(min ? 600 : 300, Math.round(v)));
      if (min) L.min = v; else L.km = v;
      this.loopChanged();
    };
    // How long: by distance or by time, a switch on its heading's line (2026-10-21)
    const seg = h('div', { class: 'rt-how' }, h('b', { id: 'rt-how-h' }, 'How long'),
      h('div', { class: 'seg rt-unit', role: 'group', 'aria-labelledby': 'rt-how-h' }, ...[['km', 'Distance'], ['min', 'Time']].map(([k, t]) => h('button', {
        type: 'button', 'data-k': `unit-${k}`, 'aria-pressed': String(L.mode === k), onclick: () => { if (L.mode !== k) { L.mode = k; this.loopChanged(); } },
        html: `${L.mode === k ? icon('check', 15) : ''}<span>${t}</span>`,
      }))));
    const DIRS = [['', 'Any direction'], ['0', 'North'], ['45', 'North-east'], ['90', 'East'], ['135', 'South-east'], ['180', 'South'], ['225', 'South-west'], ['270', 'West'], ['315', 'North-west']];
    if (sport !== 'hike' && sport !== 'run') DIRS.push(['wind', 'Into the wind first']);
    const cur = L.dir == null ? '' : String(L.dir), name = { '': 'Any', wind: 'Into the wind' }[cur] || DIRS.find(([v]) => v === cur)?.[1] || 'Any';
    // the direction: a button like the route style's beside it, the browser's own list under it (2026-10-21)
    const dir = h('label', { class: 'stylebtn rt-dir', title: 'Which way the loop heads out (into the wind first: back with it behind you)' },
      h('span', { class: 'two', 'aria-hidden': 'true' }, h('small', {}, 'Direction'), h('span', {}, name)),
      h('span', { class: 'rt-dir-chev', 'aria-hidden': 'true', html: icon('chevronDown', 12) }),
      h('select', { 'aria-label': 'Direction', 'data-k': 'dir', onchange: (e) => { const v = e.target.value; L.dir = v === '' ? null : v === 'wind' ? 'wind' : +v; this.loopChanged(); } },
        ...DIRS.map(([v, t]) => h('option', { value: v, selected: v === cur }, t))));
    const fmt = (v) => (min ? (v >= 60 ? `${Math.floor(v / 60)} h${v % 60 ? ` ${v % 60}` : ''}` : `${v} min`) : `${v} km`);
    // the sport's lengths (three on a phone, in one row, as the first point's peek has them; four on a desktop) and
    // Other…, which opens the field (also open for a length of your own)
    const lens = (min ? pre.min : pre.km).slice(0, desk ? 4 : 3), own = L.other || !lens.includes(val);
    const chips = h('div', { class: 'rt-chips', role: 'group', 'aria-label': 'Lengths' }, ...lens.map((v) => h('button', {
      type: 'button', class: 'chip', 'data-k': `len-${v}`, 'aria-pressed': String(!own && v === val), onclick: () => { L.other = false; set(v); }, html: `${!own && v === val ? icon('check', 15) : ''}<span>${fmt(v)}</span>`,
    })), h('button', { type: 'button', class: 'chip rt-other', 'data-k': 'len-other', 'aria-pressed': String(own), 'aria-expanded': String(own),
      onclick: () => { L.other = true; this.refocus = 'len'; this.renderStart(); }, html: `${own ? icon('check', 15) : ''}<span>Other…</span>` }));
    const unit = min ? 'min' : 'km';
    const stepper = !own ? null : h('div', { class: 'rt-step' }, h('div', { class: 'rt-len' },
      h('button', { type: 'button', class: 'tool', 'data-k': 'dec', 'aria-label': min ? '15 minutes shorter' : `${step} km shorter`, disabled: val <= 1, onclick: () => set(val - step), html: icon('minus', 20) }),
      h('input', { type: 'text', inputmode: 'numeric', enterkeyhint: 'done', value: String(val), 'data-k': 'len', 'aria-label': min ? 'Length in minutes' : 'Length in kilometres',
        onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
        onchange: (e) => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (Number.isFinite(v) && v > 0) set(v); else e.target.value = String(val); } }), h('span', {}, unit),
      h('button', { type: 'button', class: 'tool', 'data-k': 'inc', 'aria-label': min ? '15 minutes longer' : `${step} km longer`, onclick: () => set(val + step), html: icon('plus', 20) })));
    // where it starts: with no point of yours yet, a tap on the map or Where I am (which says that it sends your
    // position, #281), until the start is your position
    const here = !this.points.length && L.startLabel !== 'your position';
    const where = here ? h('button', { type: 'button', class: 'chip', 'data-k': 'where', onclick: () => this.loopFromHere(), html: `${icon('locate', 16)}<span>Where I am</span>` }) : null;
    // what Where I am sends, said by it (#281); what the loops cost, said by Make 3 loops (decided 2026-10-21)
    const whereNote = here ? h('p', { class: 'rt-cost rt-where' }, 'Where I am sends your position to the router, rounded to about a metre.') : null;
    // no start yet: only that, so the map has the room for it; the rest comes with the start (2026-10-21)
    if (!L.start) return [...lead(h('div', { class: 'way-head' }, h('div', { class: 'way-hint' }, h('b', {}, `${tap === 'tap' ? 'Tap' : 'Click'} the map where the loop starts`)), close)),
      where ? h('div', { class: 'rt-start' }, where) : null, whereNote,
      L.note ? h('p', { class: 'note' }, L.note) : null];
    const startLine = h('div', { class: 'rt-start' }, h('span', {}, `From ${L.startLabel} · ${tap} the map to move it`), where);
    const wet = waterLoop(sport), used = L.gens.filter((t) => Date.now() - t < 600e3).length;
    const cost = wet ? 'No routing calls' : `3 routing calls, up to 6${used ? ` · ${used} of ${LOOP_CAP} round trips in 10 minutes` : ''}`;
    const style = this.styleBlock(L.styleOpen ? 'full' : 'row', { view: 'loop', raise: () => { L.styleOpen = true; this.renderStart(); }, fold: () => { L.styleOpen = false; this.wayTune = false; this.renderStart(); } });
    const making = L.busy ? `Making loops…${L.progress ? ` ${L.progress} of 3` : ''}` : '';
    const make = h('button', { type: 'button', class: 'btn primary big rt-make', 'data-k': 'make', disabled: L.busy || !L.start, onclick: () => this.generateLoops(),
      html: L.busy ? `<span class="rt-making">${making}${L.progress ? `<span class="rt-progress" style="--p:${Math.round((L.progress / 3) * 100)}%"><i></i></span>` : ''}</span>` : `${icon('roundtrip', 20)}<span class="rt-make-t"><span>Make 3 loops</span><small>${cost}</small></span>` });
    // in the order it's chosen: the sport, where it starts, how long, then the style and which way: side by side, or a
    // row each in the side panel and while the style's choices are open (2026-10-21; a wide panel at the bottom has
    // the form in two columns, css/app.css)
    const ways = h('div', { class: `way-pair rt-pair${this.layout() === 'side' || L.styleOpen ? ' stack' : ''}` }, style, dir);
    return [...lead(h('div', { class: 'way-head' }, h('div', { class: 'way-hint' }, h('b', {}, 'Round trip from your start')), close)),
      startLine, whereNote, seg, chips, stepper, ways,
      L.note ? h('p', { class: 'note' }, L.note) : null, make,
      h('span', { class: 'sr-only', role: 'status' }, making)];
  }

  // While the loops are made the map waits (#109) and the choices can't change: the form folds to what's being
  // made and how far it's got, so the map above it has the room to show the loops' area (a 360 × 740 phone too)
  loopMaking(close) {
    const L = this.loop, DIR_NAME = { 0: 'north', 45: 'north-east', 90: 'east', 135: 'south-east', 180: 'south', 225: 'south-west', 270: 'west', 315: 'north-west', wind: 'into the wind first' };
    const len = L.mode === 'min' ? (L.min >= 60 ? `${Math.floor(L.min / 60)} h${L.min % 60 ? ` ${L.min % 60} min` : ''}` : `${L.min} min`) : `${L.km} km`;
    const making = `Making loops…${L.progress ? ` ${L.progress} of 3` : ''}`;
    return [
      h('div', { class: 'way-head' }, h('div', { class: 'way-hint' }, h('b', {}, 'Round trip from your start'), h('small', {}, `${len} · ${L.dir == null ? 'any direction' : DIR_NAME[L.dir]} · from ${L.startLabel}`)), close),
      h('button', { type: 'button', class: 'btn primary big rt-make', 'data-k': 'make', disabled: true,
        html: `<span class="rt-making">${making}${L.progress ? `<span class="rt-progress" style="--p:${Math.round((L.progress / 3) * 100)}%"><i></i></span>` : ''}</span>` }),
      h('span', { class: 'sr-only', role: 'status' }, making)];
  }

  loopResults(close) {
    const L = this.loop, sport = this.app.activity();
    const DIR_NAME = { 0: 'north', 45: 'north-east', 90: 'east', 135: 'south-east', 180: 'south', 225: 'south-west', 270: 'west', 315: 'north-west', wind: 'into the wind first' };
    const len = L.mode === 'min' ? (L.min >= 60 ? `${Math.floor(L.min / 60)} h${L.min % 60 ? ` ${L.min % 60} min` : ''}` : `${L.min} min`) : `${L.km} km`;
    return [
      h('div', { class: 'way-head' },
        h('div', { class: 'way-hint' }, h('b', {}, `${L.results.length} loop${L.results.length > 1 ? 's' : ''} from your start`), h('small', {}, `${len} · ${L.dir == null ? 'any direction' : DIR_NAME[L.dir]}`)),
        h('button', { type: 'button', class: 'btn small', 'data-k': 'loop-change', onclick: () => { L.editing = true; this.renderStart(); } }, 'Change'), close),
      L.note ? h('p', { class: 'note' }, L.note) : null,
      this.loopCards(sport)];
  }

  // The loops as cards side by side (a list on desktops): a tap on a card or its line picks it, and the picked
  // one has Use loop A (#89)
  loopCards(sport) {
    const L = this.loop, wet = waterLoop(sport);
    const list = h('div', { class: 'loop-cards', role: 'list', 'aria-label': 'Loops' });
    const best = L.results.reduce((m, r, i) => (m < 0 || r.score < L.results[m].score ? i : m), -1);
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
      const line1 = `${fmtDuration(a.time)} · ${wet ? '' : `↑${Number.isFinite(a.up) ? Math.round(a.up) : '?'} m · `}${what}`, line2 = notes.filter(Boolean).join(' · ');
      const on = i === L.on;
      // a tap anywhere on the card picks it (its Use loop button takes it)
      list.append(h('div', { class: `loop-card${on ? ' on' : ''}`, role: 'listitem', onclick: (e) => { if (!e.target.closest('.loop-use')) this.showLoop(i, { frame: true }); } },
        h('button', { type: 'button', class: 'loop-pick', 'data-k': `loop-${i}`, 'aria-pressed': String(on), 'aria-label': `Loop ${r.letter}: ${fmtDist(a.total)}, ${line1}, ${line2}`,
          onmouseenter: () => this.showLoop(i) },
        h('span', { class: 'loop-card-head' }, h('span', { class: `loop-dot${darkWords(r.color) ? ' ink' : ''}`, style: `background:${r.color}` }, r.letter), h('b', {}, fmtDist(a.total)), i === best ? h('span', { class: 'loop-best' }, 'Closest match') : null),
        h('span', { class: 'loop-card-line' }, line1),
        h('span', { class: 'loop-card-line muted' }, line2)),
        h('button', { type: 'button', class: 'btn primary loop-use', 'data-k': `use-${i}`, onclick: () => this.pickLoop(i) }, `Use loop ${r.letter}`)));
    });
    // none of them? three more, in other directions (the ones there are stay)
    if (L.results.length < LOOP_MAX) {
      list.append(h('button', { type: 'button', class: 'loop-card loop-more', 'data-k': 'loop-more', disabled: L.busy, onclick: () => this.generateLoops({ more: true }),
        title: wet ? 'Three more loops in other directions (on this device: no routing calls)' : 'Three more loops in other directions: up to six routing calls' },
      h('span', { html: icon('roundtrip', 18) }), h('b', {}, L.busy ? this.loopBusyText() : 'More loops'), h('small', {}, L.busy ? '' : 'three more, other ways')));
    }
    return list;
  }

  loopBusyText() {
    const L = this.loop;
    return L.progress ? `Making loops… ${L.progress} of 3` : 'Making loops…';
  }

  markLoopCards() {
    this.els.loopBox.querySelectorAll('.loop-card:not(.loop-more)').forEach((c, i) => {
      const on = i === this.loop.on;
      c.classList.toggle('on', on);
      c.querySelector('.loop-pick')?.setAttribute('aria-pressed', String(on));
    });
  }

  // a card in the strip into view, sideways: only the strip scrolls, never the page
  cardIntoView(card) {
    const strip = card && card.parentElement;
    if (!strip || strip.scrollWidth <= strip.clientWidth) return;
    const left = Math.max(0, card.offsetLeft - strip.offsetLeft - 12);
    strip.scrollTo({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  // ---------------------------------------------------------------- route style
  savedStyle(sport) { return store.get('styles', {})[sport] || defaultStyle(); }
  // the style a leg in `sport` is routed with (unless it has its own): the route's for that sport, else yours for it.
  // The route's, whatever the map's sport is (#71).
  styleOf(sport) { return this.styles[sport] || this.savedStyle(sport); }
  // the sport whose style How you go shows: on a multisport route, the one picked there
  howSport() { return this.routeSports().includes(this.styleSport) ? this.styleSport : this.mainSport(); }

  wetFor(style) { const w = (style && style.wet) || 'auto'; return w === 'yes' || (w === 'auto' && this.wet.on); }

  // The Route style section: presets, the sport's controls, wet ground, and
  // what the last change did. Scoped to one leg when opened from a point.
  renderStyle() {
    const box = this.els && this.els.styleBox;
    if (!box) return;
    const route = this.mainSport(), rs = this.styleOf(route); // the route's sport: the map's may have moved on
    this.renderTools(); // the style's name in the toolbox
    if (this.styleLeg != null && !this.legs[this.styleLeg]) this.styleLeg = null;
    const leg = this.styleLeg;
    // a leg in another sport is styled in that sport's terms, from your style for it
    const sport = leg != null ? this.legSport(leg) : this.howSport();
    const base = this.styleOf(sport);
    const cat = STYLES[sport] || STYLES.mtb;
    const own = leg != null ? this.legs[leg].style : null;
    const st = (leg != null && own) || base;
    const vals = valuesOf(sport, st);
    const custom = isCustom(sport, st);
    const set = (next) => this.setStyle(next, leg, sport);
    const ownCount = this.legs.filter((l) => l.style).length;
    this.setSection('style', { summary: `${styleName(route, rs)}${ownCount ? ` · ${ownCount} leg${ownCount > 1 ? 's' : ''} with their own` : ''}` });
    this.renderHow();
    box.innerHTML = '';
    if (leg != null) {
      box.append(h('div', { class: 'seg small full style-scope', role: 'group', 'aria-label': 'What the style is for' },
        h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => { this.styleLeg = null; this.renderStyle(); } }, 'Whole route'),
        h('button', { type: 'button', 'aria-pressed': 'true' }, `${this.nameOf(leg)} → ${this.nameOf(leg + 1)}`)),
      h('p', { class: 'note' }, own ? 'This leg has its own style; the rest of the route keeps the route’s.' : sport === route ? `This leg follows the route’s style (${styleName(sport, rs)}). Pick one to give it its own.` : `This ${ACTIVITIES[sport].label.toLowerCase()} leg follows the route’s ${ACTIVITIES[sport].label} style (${styleName(sport, base)}). Pick one to give it its own.`));
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
  // `sport`: whose legs the whole route's style is for (the route's own; the drawing menu's, the next leg's)
  setStyle(style, leg = null, sport = this.mainSport()) {
    const routed = this.legs.length > 0; // before there's a route it routes nothing: no note, no Undo (A)
    // the route's style as it is, so Undo brings it back even when it was only yours until now
    if (leg == null && !this.styles[sport]) this.styles = { ...this.styles, [sport]: this.styleOf(sport) };
    if (routed) {
      this.commit();
      this.styleBefore = { stats: this.styleStats(), a: this.analysis }; // compared once the new route is in
    }
    if (leg == null) {
      this.styles = { ...this.styles, [sport]: style };
      store.set('styles', { ...store.get('styles', {}), [sport]: style });
    } else if (this.legs[leg]) {
      this.legs[leg].style = style; // null: back to the route's
    }
    this.renderStyle();
    this.renderToolbarState();
    this.renderStart(); // the start's chips
    if (!routed) return;
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

  // Legs on the water routed without a source that didn't answer: route them again. Retry asks the
  // sources again now; a late answer (`ask: false`) has come in already.
  retryWater({ ask = true } = {}) {
    if (ask) forgetWaterFailures();
    let n = 0;
    for (const l of this.legs) if (l.mode === 'water' && l.result && l.result.water && l.result.water.missing.length) { l.key = null; n++; }
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
        attrs.push({ mode, tags: r.tags[k - 1] || {}, sport, by: r.provider, ...(leg.ice ? { ice: true } : {}) });
      }
    });
    return { coords, attrs };
  }

  async runAnalysis(gen) {
    const line = this.mergedLine();
    if (line.coords.length < 2) {
      // no route (Clear route, a point left): what was picked on it goes, its short cut too (#126), and Check's items
      // with it, so an open item's card closes
      this.analysis = null;
      this.headsList = null;
      this.unlightItem();
      this.renderAnalysis();
      return;
    }
    const a = await analyse(line, this.timeOpt());
    if (gen !== this.gen) return;
    this.useAnalysis(a);
  }

  useAnalysis(a) {
    this.analysis = a;
    a.gen = this.gen; // (the routing it's of: both callers checked it's this one; analysisFits())
    Object.assign(a, (({ total, tAt, waits }) => ({ time: total, tAt, waits }))(this.timed(a)));
    a.waterWarn = this.waterWarnings();
    a.darkWarn = this.darkWarnings(a);
    a.accessWarn = [...this.standInAccess(a), ...this.detourWarnings(a)];
    for (const w of a.warnings) if (w.hide === 'Private or no access' && /^Marked private/.test(w.text)) {
      const li = this.legAt(w.at);
      if (li >= 0 && shortCuts(this.legSport(li), this.legStyle(li))) w.note += ' · you allowed short cuts on this leg: only where you may go';
    }
    this.app.setData('accessCut', EMPTY);
    if (this.focusLit && !(this.cards.current && this.cards.current.kind === 'item')) this.unfocusRange(); // (another route: an open item lights its own again)
    // sources that answered for this route: the terrain, and the water's on every water leg
    if (!a.terrain) this.answered('terrain');
    this.answered('water', new Set(this.legs.flatMap((l) => (l.mode === 'water' && l.result && l.result.water && l.result.water.missing) || [])));
    this.watchTerrain(a);
    this.renderAnalysis();
    this.loadWind(a);
    this.loadTrail(a);
  }

  // Terrain tiles that didn't load are asked for again after a while (dem.js): analyse the
  // route again then, more rarely each time, and take the new analysis once more terrain is in.
  watchTerrain(a, tries = 0) {
    clearTimeout(this.terrainTimer);
    if (!a.terrain || !a.terrain.retry) return;
    const ms = Math.min(5 * 60e3, 20e3 * 2 ** tries);
    a.terrain.next = Date.now() + ms;
    this.terrainTimer = setTimeout(() => this.retryTerrain(a, tries + 1), ms);
  }

  async retryTerrain(a, tries = 0, now = false) {
    if (this.analysis !== a) return;
    clearTimeout(this.terrainTimer);
    if (!now && !navigator.onLine) { this.watchTerrain(a, tries); this.renderWarnings(); return; } // offline: when it's back ('online')
    if (now) retryTerrainTiles();
    const gen = this.gen;
    const b = await analyse(this.mergedLine(), this.timeOpt());
    if (gen !== this.gen || this.analysis !== a) return;
    if (b.terrain && b.terrain.missing >= a.terrain.missing - 1) {
      this.watchTerrain(a, tries);
      this.renderWarnings(); // when it tries next
      return;
    }
    this.useAnalysis(b);
  }

  // The ways the map's tiles mark private or closed (the tiles fold access=private into no),
  // and on foot foot=no: segments [p0, p1, tags] near the box [w, s, e, n] (degrees of pad).
  closedSegments(box, pad = 0.0005) {
    if (!this.map.getSource('ofm')) return [];
    const [w, s, e, n] = box, out = [];
    for (const f of this.map.querySourceFeatures('ofm', { sourceLayer: 'transportation', filter: ['any', ['==', ['get', 'access'], 'no'], ['==', ['get', 'foot'], 'no']] })) {
      const g = f.geometry, lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      const tags = { access: f.properties.access, foot: f.properties.foot, bicycle: f.properties.bicycle };
      for (const c of lines) {
        for (let k = 1; k < c.length; k++) {
          const p0 = c[k - 1], p1 = c[k];
          if (Math.max(p0[0], p1[0]) < w - pad || Math.min(p0[0], p1[0]) > e + pad || Math.max(p0[1], p1[1]) < s - pad || Math.min(p0[1], p1[1]) > n + pad) continue;
          out.push({ p0, p1, tags });
        }
      }
    }
    return out;
  }
  // a spot on (within 8 m of) a way closed to the sport, as the map says
  closedAt(ll, sport) {
    return this.closedSegments([ll[0], ll[1], ll[0], ll[1]], 0.0002).some((g) => accessOf(g.tags, sport) && pointSegment(ll, g.p0, g.p1).d < 8);
  }

  // Where a leg goes round a way marked private or closed for its sport (#104), from the map's
  // tiles, no calls: a way through such ways between two spots near the leg (or the spots you
  // picked, where the router moved a point off one) that's much shorter than the leg between
  // them. And a point moved off one says so. Only where the tiles are loaded (zoom 14 carries
  // access); a short cut joined to the leg by open paths isn't seen.
  detourWarnings(a) {
    const out = [];
    const row = (o) => ({ len: 0, kind: 'access', ic: 'warn', noAvoid: true, osm: true, fix: 'Tagged wrong? Leave a note on OpenStreetMap', hide: 'Goes round', tier: 'look', src: OSM, ...o });
    const said = new Set(); // points whose move a short cut's row explains
    this.legs.forEach((leg, li) => {
      const sport = this.legSport(li);
      if (leg.mode !== 'auto' || leg.status !== 'ok' || !leg.result || isWater(sport) || shortCuts(sport, this.legStyle(li))) return;
      const from = this.lengthTo(li), to = this.lengthTo(li + 1);
      const spots = [];
      for (let i = 0; i < a.along.length; i++) if (a.along[i] >= from - 0.5 && a.along[i] <= to + 0.5) spots.push({ ll: a.pts[i], at: a.along[i] });
      if (spots.length < 2) return;
      const s0 = this.pspot.get(this.points[li]), s1 = this.pspot.get(this.points[li + 1]);
      if (s0) spots.unshift({ ll: s0, at: from - dist(s0, this.points[li]), pick: li });
      if (s1) spots.push({ ll: s1, at: to + dist(s1, this.points[li + 1]), pick: li + 1 });
      const segs = this.closedSegments(bbox(spots.map((x) => x.ll)), 0.003).filter((g) => accessOf(g.tags, sport));
      if (!segs.length) return;
      // the closed ways as a graph (vertices joined to about a metre: tiles cut ways at their edges)
      const key = (q) => `${q[0].toFixed(5)},${q[1].toFixed(5)}`, nodes = new Map();
      const node = (q) => { const k = key(q); if (!nodes.has(k)) nodes.set(k, { ll: q, e: [] }); return k; };
      for (const g of segs) { const u = node(g.p0), v = node(g.p1), d = dist(g.p0, g.p1); nodes.get(u).e.push([v, d]); nodes.get(v).e.push([u, d]); }
      // where they touch the leg: within 25 m of it (the nearest spot along it), found through a
      // grid of about 55 m cells, so a long leg in a town stays quick
      const C = 0.0005, cell = (q) => `${Math.floor(q[0] / (C * 2))},${Math.floor(q[1] / C)}`, grid = new Map();
      for (const x of spots) { const c = cell(x.ll); if (!grid.has(c)) grid.set(c, []); grid.get(c).push(x); }
      const touch = [];
      for (const [k, nd] of nodes) {
        let best = null;
        const cx = Math.floor(nd.ll[0] / (C * 2)), cy = Math.floor(nd.ll[1] / C);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          for (const x of grid.get(`${cx + dx},${cy + dy}`) || []) { const d = dist(nd.ll, x.ll); if (d < 25 && (!best || d < best.d)) best = { d, at: x.at, pick: x.pick }; }
        }
        if (best) touch.push({ k, ...best });
      }
      // only ways that touch the leg twice can be a short cut: each touch's group of joined ways
      const group = new Map();
      for (const k of nodes.keys()) {
        if (group.has(k)) continue;
        const stack = [k];
        group.set(k, k);
        while (stack.length) for (const [v] of nodes.get(stack.pop()).e) if (!group.has(v)) { group.set(v, k); stack.push(v); }
      }
      const twice = new Map();
      for (const t of touch) twice.set(group.get(t.k), (twice.get(group.get(t.k)) || 0) + 1);
      let best = null;
      for (const t of touch) {
        if (twice.get(group.get(t.k)) < 2) continue;
        // the shortest way through the closed ways from t (a small graph: a plain Dijkstra)
        const D = new Map([[t.k, 0]]), prev = new Map(), done = new Set(), queue = [[0, t.k]];
        while (queue.length) {
          queue.sort((x, y) => x[0] - y[0]);
          const [du, u] = queue.shift();
          if (done.has(u)) continue;
          done.add(u);
          if (du > 3000) break; // a short cut, not a way of its own
          for (const [v, w] of nodes.get(u).e) if (du + w < (D.get(v) ?? Infinity)) { D.set(v, du + w); prev.set(v, u); queue.push([du + w, v]); }
        }
        for (const v of touch) {
          if (v.k === t.k || !D.has(v.k) || v.at <= t.at) continue;
          const through = D.get(v.k) + t.d + v.d, round = v.at - t.at, saved = round - through;
          if (saved >= 100 && saved >= 0.25 * round && (!best || saved > best.saved)) {
            const cut = [];
            for (let k = v.k; k; k = prev.get(k)) cut.unshift(nodes.get(k).ll);
            best = { saved, at: Math.max(0, t.at), cut, picks: [t.pick, v.pick].filter((k) => k != null) };
          }
        }
      }
      if (!best) return;
      best.picks.forEach((k) => said.add(k));
      const by = best.picks.map((k, j) => `${j ? '' : `${this.label(k).toLowerCase()} was moved `}${j ? `the ${this.label(k).toLowerCase()} ` : ''}${fmtDist(dist(this.pspot.get(this.points[k]), this.points[k]))}`);
      const moved = by.length ? ` · the ${by.join(' and ')} off it` : '';
      out.push(row({ at: best.at, lngLat: best.cut[0], cut: best.cut, cutLeg: li, picks: best.picks, text: 'Goes round a way marked private or closed', note: `a short cut through it would save about ${fmtDist(Math.round(best.saved / 10) * 10)}${moved} · from the map: routes keep off it` }));
    });
    // a point moved off one, where no short cut says so
    this.points.forEach((p, i) => {
      const spot = this.pspot.get(p);
      if (spot && !said.has(i)) out.push(row({ at: this.lengthTo(i), lngLat: spot, text: `${this.label(i)} moved ${fmtDist(dist(spot, p))} off a way marked private or closed`, note: 'the spot you picked is on it, and routes keep off it · from the map' }));
    });
    return out;
  }

  // Valhalla's answer carries no access tags, and it walks through ways marked private where
  // BRouter goes round: on its legs, the stretches along a way that the map's tiles mark private
  // or no access (OpenMapTiles folds private into no). Only where the tiles are loaded: the
  // Valhalla row in Heads-up says it may take others.
  standInAccess(a) {
    const out = [];
    const on = a.attr.map((x) => !!x && x.by === 'valhalla' && x.mode === 'auto');
    if (!on.some(Boolean) || !this.map.getSource('ofm')) return out;
    const segs = this.closedSegments(bbox(a.pts.filter((_, i) => on[i])));
    if (!segs.length) return out;
    // a sample on such a way: within 4 m of one, and the way not open to the sample's sport
    const marked = (i) => {
      if (!on[i]) return false;
      const sport = a.attr[i].sport || a.activity;
      return segs.some((g) => pointSegment(a.pts[i], g.p0, g.p1).d < 4 && accessOf(g.tags, sport));
    };
    let s0 = -1;
    for (let i = 0; i <= a.pts.length; i++) {
      const m = i < a.pts.length && marked(i);
      if (m && s0 < 0) s0 = i;
      if (!m && s0 >= 0) {
        const len = a.along[i - 1] - a.along[s0];
        // a crossing touches one for a metre or two: only stretches along one
        if (len >= 10) out.push(accessRow({ no: false }, a.along[s0], len, a.pts[s0], 'from the map · Valhalla stood in and took it; Use BRouter goes round', 'Marked private or no access in OpenStreetMap'));
        s0 = -1;
      }
    }
    return out;
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
    const out = [], src = { kind: 'calculated', by: 'the sun’s times' };
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
        ? { at: a.along[i], len, kind: 'dark', noAvoid: true, text: evening ? `After sunset (${fmt(x.sunFrom)}) for ${fmtDist(len)}` : `Before sunrise (${fmt(x.sunTo)}) for ${fmtDist(len)}`, note: evening ? 'twilight: light fading' : 'twilight: getting light', tier: 'look', src }
        : { at: a.along[i], len, kind: 'dark', noAvoid: true, text: `In the dark for ${fmtDist(len)}`, note: `${evening ? `${already ? 'dark since' : 'dark from'} ${fmt(x.sunFrom)}` : `light from ${fmt(x.sunTo)}`}${lit}${water ? ' · on the water a light is required after dark' : ' · take a light'}`, tier: 'read', src });
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

  // Heads-up from the water router (water.js events): shipping lanes and
  // harbours on the way, keep-clear zones it had to pass, rough water.
  // Positions along the whole route. (A source that didn't answer: notChecked().)
  waterWarnings() {
    const out = [];
    // (shipping lanes are Väylävirasto's fairway areas; harbours and rocks OpenStreetMap's too)
    const MAP = { kind: 'map', by: 'Väylävirasto and OpenStreetMap' }, LANES = { kind: 'map', by: 'Väylävirasto' }, WAVES = { kind: 'estimate', by: 'the waves, from the forecast' };
    this.legs.forEach((leg, i) => {
      const wr = leg.mode === 'water' && leg.status === 'ok' && leg.result && leg.result.water;
      if (!wr) return;
      const base = this.lengthTo(i);
      for (const e of wr.events || []) {
        const at = base + e.at, len = e.len;
        if (e.kind === 'ship') {
          out.push(len > 600
            ? { at, len, kind: 'water', hide: 'Shipping lanes', noAvoid: true, text: `Along a shipping lane for ${fmtDist(len)}`, note: `${e.name ? `${e.name} · ` : ''}no way round it here: keep to its edge, ships can’t stop or turn`, tier: 'read', src: LANES }
            : { at, len, kind: 'water', hide: 'Shipping lanes', noAvoid: true, text: `Crosses ${e.name ? `the ${e.name}` : 'a shipping lane'}`, note: 'cross quickly and straight, after looking both ways: ships can’t stop or turn', tier: 'read', src: LANES });
        } else if (e.kind === 'harbour') out.push({ at, len, kind: 'water', hide: 'Harbour basins', noAvoid: true, text: 'Through a harbour basin', note: 'boats coming and going', tier: 'look', src: MAP });
        else if (e.kind === 'hazard') out.push({ at, len, kind: 'water', hide: 'Rocks and shoals', text: 'Close to a marked rock or shoal', note: 'the only way here passes near a danger mark or a rock in OpenStreetMap', tier: 'look', src: MAP });
        else if (e.kind === 'rough') {
          // for the departure the timeline shows (moving it routes the leg again) [jc-paddle-step]
          const w = wr.wind, when = wr.at ? ` for ${clock(wr.at * 1000)}` : '';
          out.push({ at, len, kind: 'water', hide: 'Rough water', noAvoid: true, text: `Rough for a ${(CRAFT[wr.craft] || CRAFT.kayak).label.toLowerCase()}${wr.at ? `, at ${clock(wr.at * 1000)}` : ''}: waves up to about ${e.max.toFixed(1)} m`, note: w ? `${Math.round(w.speed)} m/s from the ${compass(w.dir)} over open water · an estimate from the forecast${when}` : `an estimate from the forecast${when}`, tier: 'read', src: when ? { ...WAVES, by: `${WAVES.by}${when}` } : WAVES });
        }
      }
    });
    return out;
  }

  // Trail details along the route: the router's tags gave the first heads-up
  // (analysis.js); the trail-detail tiles (Overpass, the same as the map's Trail
  // details) add width and fallen trees mapped as points (js/trails.js), and it's
  // re-checked for boardwalks once we know whether it has rained. For every sport
  // on land, whether or not the map shows the layer: a fallen tree is in the way
  // of a gravel bike too.
  async loadTrail(a) {
    const opt = () => ({ activity: this.mainSport(), wet: this.wetFor(this.styleOf(this.mainSport())) });
    a.trailWarn = trailWarnings(a, opt());
    const land = !this.routeSports().every(isWater);
    a.trailAsking = land; // (What Polku looked at: being asked)
    this.renderWarnings();
    if (!land) return;
    let more = false, failed = false;
    try { more = await detailsAlong(a); } catch { failed = true; } // the router's tags still stand
    a.trailAsking = false;
    if (this.analysis !== a) return;
    a.trailLong = !failed && !more && !a.tdLost; // too long a route to ask (or no tile to ask): the router's tags only
    // where the tiles didn't answer: Not checked, until they do (25d part 2)
    a.trailError = failed ? [[0, a.along[a.along.length - 1]]] : a.tdLost || null;
    if (!a.trailError && more) this.answered('trail');
    if (!more) { this.renderWarnings(); return; }
    a.trailWarn = trailWarnings(a, opt());
    a.trailMore = true; // width and points from OSM are in
    if (this.colorMode === 'width' || this.colorMode === 'vis') this.renderAnalysis();
    else { this.renderWarnings(); this.renderBreakdown(); }
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
    let cls = null, failed = false;
    try { cls = await winterAlong(a); } catch { failed = true; } // without: by surface only
    if (this.analysis !== a) return;
    a.winterError = failed || (cls && cls.lost > 0); // Not checked until they answer (25d part 2)
    if (cls && !a.winterError) this.answered('winter');
    if (!cls || !a.wind) { this.renderWarnings(); return; }
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
    const known = (i) => !(w.beyond >= 0 && i >= w.beyond); // (past the forecast its values are its last hour's: #465)
    const bikeAt = (i) => groupOf((a.attr[i] && a.attr[i].sport) || a.activity) === 'bike';
    const FORECAST = { kind: 'estimate', by: 'the forecast' }, TAGS = { kind: 'map', by: 'winter tags' };
    const read = { tier: 'read', src: FORECAST }, look = { tier: 'look', src: FORECAST }, readTags = { tier: 'read', src: TAGS }, lookTags = { tier: 'look', src: TAGS };
    if (winter && a.snow) {
      let lo = Infinity, hi = 0;
      for (let i = 1; i < n; i++) if (!water(i) && known(i) && Number.isFinite(a.snow.cm[i])) { lo = Math.min(lo, a.snow.cm[i]); hi = Math.max(hi, a.snow.cm[i]); }
      if (hi >= 3) {
        const range = Math.round(lo) === Math.round(hi) ? `${Math.round(hi)} cm` : `${Math.round(Math.max(0, lo))}–${Math.round(hi)} cm`;
        out.push({ at: 0, len: 0, kind: 'winter', ic: 'snow', noAvoid: true, text: `Snow on the way: ${range}`, note: `the forecast's depth${a.snowSec >= 60 ? ` · slower going: about ${fmtDuration(a.snowSec)} more, in the time` : ''}${a.winterCls ? '' : ' · ploughed ways not known yet'}`, ...look });
      }
    }
    // snowing while you're out
    if (winter && w.snowfall) {
      let cm = 0;
      for (let i = 1; i < n; i++) if (known(i) && Number.isFinite(w.snowfall[i])) cm += (w.snowfall[i] * (tAt[i] - tAt[i - 1])) / 3600;
      if (cm >= 2) out.push({ at: 0, len: 0, kind: 'winter', ic: 'snow', noAvoid: true, text: `Snowing on the way: about ${Math.round(cm)} cm while you’re out`, note: 'tracks fill in and trails close up as it falls', ...look });
    }
    // slippery: rain or sleet around freezing, on land
    const slip = stretches((i) => known(i) && !water(i) && w.temp[i] >= -2 && w.temp[i] <= 1.5 && w.precip[i] >= 0.1);
    if (sum(slip) >= 100) out.push({ at: a.along[slip[0].i0], len: sum(slip), kind: 'winter', ic: 'warn', noAvoid: true, text: `Slippery: rain or sleet around 0 °C for ${fmtDist(sum(slip))}`, note: 'water on ice is the worst: care on bridges, boardwalks and slopes; studded tyres if you have them', ...read });
    // the cold, as it feels at your own speed (on land)
    let wc = Infinity, wcAt = 0;
    for (let i = 1; i < n; i++) {
      if (water(i) || !known(i)) continue;
      const kmh = ((a.along[i] - a.along[i - 1]) / Math.max(1, tAt[i] - tAt[i - 1])) * 3.6;
      const f = windChill(w.temp[i], w.speed[i], Math.min(40, kmh));
      if (f < wc) { wc = f; wcAt = i; }
    }
    if (wc <= -27) out.push({ at: a.along[wcAt], len: 0, kind: 'cold', ic: 'temp', noAvoid: true, text: `Frostbite risk: feels like ${Math.round(wc)} °C`, note: 'with the wind and your own speed · bare skin can freeze within half an hour: cover face and fingers', ...read });
    else if (wc <= -15) out.push({ at: a.along[wcAt], len: 0, kind: 'cold', ic: 'temp', noAvoid: true, text: `Very cold: feels like ${Math.round(wc)} °C`, note: 'with the wind and your own speed · cover up, and keep a dry layer for stops', ...read });
    // the ways in winter (OSM's winter tags along the route)
    if (winter && a.winterCls) {
      const c = a.winterCls, cls = (k) => (i) => c[i] === k && !water(i);
      const closed = stretches(cls('closed'));
      for (const x of closed.slice(0, 3)) if (x.len >= 20) out.push({ at: a.along[x.i0], len: x.len, kind: 'winter', ic: 'warn', osm: true, lngLat: a.pts[x.i0], text: `No access in winter: ${fmtDist(x.len)}`, note: 'marked closed to walking or cycling in winter (usually a ski track): Avoid routes round it', ...readTags });
      const groomed = stretches(cls('groomed'));
      if (sum(groomed) >= 100) out.push({ at: a.along[groomed[0].i0], len: sum(groomed), kind: 'winter', ic: 'snow', noAvoid: true, osm: true, lngLat: a.pts[groomed[0].i0], text: `Beside a ski track for ${fmtDist(sum(groomed))}`, note: 'walking and cycling allowed: keep off the groomed track itself', ...lookTags });
      const unploughed = stretches((i) => c[i] === 'unploughed' && bikeAt(i));
      if (sum(unploughed) >= 100) out.push({ at: a.along[unploughed[0].i0], len: sum(unploughed), kind: 'winter', ic: 'snow', noAvoid: true, osm: true, lngLat: a.pts[unploughed[0].i0], text: `Not ploughed in winter: ${fmtDist(sum(unploughed))}`, note: 'snow and ruts: slow going by bike', ...lookTags });
      const slowOpen = stretches((i) => c[i] === 'open3' && bikeAt(i) && a.snow && a.snow.cm[i] >= 5);
      if (sum(slowOpen) >= 100) out.push({ at: a.along[slowOpen[0].i0], len: sum(slowOpen), kind: 'winter', ic: 'snow', noAvoid: true, osm: true, lngLat: a.pts[slowOpen[0].i0], text: `Opens slowly after snow: ${fmtDist(sum(slowOpen))}`, note: 'little travelled in winter: maybe not packed down yet', ...lookTags });
    }
    // on the water in the ice season
    const wet = stretches(water);
    if (sum(wet) > 0) {
      let cold = Infinity;
      for (let i = 1; i < n; i++) if (water(i) && known(i)) cold = Math.min(cold, w.temp[i]);
      if (set.on || cold <= 0.5) out.push({ at: a.along[wet[0].i0], len: sum(wet), kind: 'water', ic: 'warn', noAvoid: true, text: 'Ice season: the water may be frozen or partly frozen', note: 'Polku can’t see the ice: check FMI’s ice chart (Layers → Winter → Sea ice) and local reports, and never trust ice you haven’t checked', ...read });
    }
    return out;
  }

  // what the time estimate needs: the sport, the craft and your speeds
  // `activity`: the sport for what has none of its own: the route's (#71), or a round trip's
  timeOpt(activity = this.mainSport()) {
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
    const d = new Date(sec * 1000), t = this.timeOf(sec);
    return d.toDateString() === new Date(this.startSec() * 1000).toDateString() ? t : `${d.toLocaleDateString([], { weekday: 'short' })} ${t}`;
  }
  timeOf(sec) { return new Date(sec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  // when you leave, in words: "now", "07:30" today, "Sun 1 Nov, 07:30" on another day
  leaveWords() {
    const at = this.leaveAt;
    return at == null ? 'now' : new Date(at * 1000).toDateString() === new Date().toDateString() ? this.timeOf(at) : `${this.dayOf(at)}, ${this.timeOf(at)}`;
  }
  // a day in words, as the phone's language writes it ("Sat 31 Oct"); `near`: "Today, …" and "Tomorrow, …" too
  dayOf(sec, near = false) {
    const d = new Date(sec * 1000), day = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    const ahead = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);
    return near && ahead === 0 ? `Today, ${day}` : near && ahead === 1 ? `Tomorrow, ${day}` : day;
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

  startSec() { return this.leaveAt ?? Math.round(Date.now() / 60000) * 60; }

  // the weather's timeline hour for the departure (one clock, within its 48 hours): 0 leaving now, null past them
  leaveHour() {
    if (this.leaveAt == null) return 0;
    const k = Math.floor((this.leaveAt - Math.floor(Date.now() / 3600000) * 3600) / 3600);
    return k <= 48 ? Math.max(0, k) : null;
  }

  // When you leave (#364's C): epoch seconds, or null to leave now; a time that has passed is now. Shared with the
  // weather's timeline: `fromMap` means its slider moved, so it isn't told again.
  setLeave(sec, { fromMap = false } = {}) {
    sec = sec != null && sec > Date.now() / 1000 ? Math.round(sec / 60) * 60 : null;
    const was = this.leaveAt, passed = this.leavePassed;
    this.leavePassed = null; // (a time of your own: the note on the one that had passed goes)
    if (sec === was) { if (passed) this.renderLeave(); return; }
    this.clearCategoryPreview();
    this.leaveAt = sec;
    this.renderLeave();
    if (!fromMap && this.app.onStartChange) this.app.onStartChange(this.leaveHour());
    this.drawMarks(); // the clock times move immediately while the new forecast loads
    if (this.analysis) { this.renderSpeed(); this.renderTabTimes(); this.renderWaypoints(); this.renderTake(); } // (the list's times and the share link's line too)
    this.expireLeave();
    clearTimeout(this.windTimer);
    // playback moves an hour a second; let it settle a little before re-fetching (and keeping it with the route)
    this.windTimer = setTimeout(() => {
      this.save();
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
    a.darkWarn = this.darkWarnings(a); // the departure may have moved (without the wind's times, these do)
    try {
      let w = await windAlong(a.pts, a.along, a.tAt, startSec);
      let t = this.timed(a, w.head, this.snowOf(a, w));
      w = await windAlong(a.pts, a.along, t.tAt, startSec); // same forecast, cached
      const snow = this.snowOf(a, w);
      t = this.timed(a, w.head, snow);
      if (this.analysis !== a) return;
      a.wind = { ...w, startSec };
      a.windError = false; // (a failure stays until the forecast answers: 25d part 2)
      this.answered('weather');
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

  // Road works, incidents, slippery roads and busy roads along the route. No answer: Not checked, until
  // Fintraffic answers (25d part 2), where it counts: a route on land in Finland.
  async loadHazards(a) {
    if (!this.app.hazards) return;
    try {
      const hz = await this.app.hazards(a, { activity: this.mainSport(), startSec: this.startSec() }); // each leg's own sport (#71)
      if (this.analysis !== a) return;
      a.hazards = hz;
      a.hazardsAt = hz.answeredAt || Date.now();
      a.hazardsError = false;
      this.answered('hazards');
    } catch {
      if (this.analysis !== a) return;
      a.hazardsError = this.fintrafficHere(a); // (the items it gave before, if any, stay)
    }
    this.renderWarnings();
  }
  // whether Fintraffic's road works and incidents count for this route: some of it on land in Finland
  fintrafficHere(a) {
    return !!this.app.hazards && a.pts.some((q, i) => inFinland(q) && !isWater((a.attr[i] && a.attr[i].sport) || a.activity));
  }

  // ---------------------------------------------------------------- map interaction
  onMapClick(e) {
    if (!this.active || Date.now() < this.noClickUntil) return; // the click that ends a drag or a long-press
    // Move on a card asked where: this is the answer
    if (this.picking) { this.popupAtPress = false; this.picking.done([+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)]); return; }
    // a menu or card was open: this click (a tap beside it) closes it, and adds nothing
    if (this.popupAtPress) { this.popupAtPress = false; this.cards.close(); return; }
    const touch = this.isTouch();
    const r = touch ? 12 : 6;
    // Map taps inside a way to begin belong to it (A): in the round trip a tap picks a loop or sets the start
    if (this.loop.open) {
      if (this.loop.busy) return; // the map waits while the loops are made (#109)
      // a loop's line picks that loop (the others and the start stay); anywhere else moves the start
      const loop = this.loop.results.length && this.map.getLayer('loops-line') && this.map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], { layers: ['loops-line', 'loops-casing'] })[0];
      if (loop) this.showLoop(loop.properties.i, { frame: true });
      else this.setLoopStart([+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)], touch ? 'the spot you tapped' : 'the spot you clicked');
      return;
    }
    // …and in Marked routes it picks the route under it
    if (this.startView() === 'find') { this.pickMarkedAt(e.point, r); return; }
    // a marker of Check's (25d part 3): its card (in the route's view too: the map's card doesn't open as well)
    const head = this.headAt(e.point, r + 6);
    if (head) { if (this.inView()) this.tookClick = e.originalEvent; this.openHead(head); return; }
    // a way on offer for a leg (#95): a tap takes it
    const alt = this.alts && this.map.getLayer('route-alts-line') && this.map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], { layers: ['route-alts-line', 'route-alts-casing', 'route-alts-glow', 'route-alts-label'] }).find((f) => !f.properties.route);
    const ng = !alt && this.map.getLayer('nogo-fill') && this.map.queryRenderedFeatures(e.point, { layers: ['nogo-fill'] })[0];
    if (this.inView() && (alt || ng)) this.tookClick = e.originalEvent; // (so the map's card doesn't open too)
    if (alt) { this.pickAlt(alt.properties.i); return; }
    if (ng) { this.openNogoMenu(ng.properties.i, e.lngLat); return; }
    // The route's view (25c): the rest is the map's, its own cards (initInspector(), js/main.js), and a tap on the
    // route that part's menu, as with the planner put away. Nothing is added or moved.
    if (this.inView()) return;
    const hit = this.map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], { layers: ['route-casing'] }).find((x) => x.properties.kind === 'leg');
    const ll = [+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)];
    // the line itself: a click or a tap shows the route's card there, mouse and finger alike (a point added by mistake
    // is easy, and most taps on the route are to check something); "Add a point here" is at the spot, and a drag still
    // reshapes the route (25d's 1b)
    if (hit && !hit.properties.loading) { this.openRouteCard(hit.properties.leg, e.lngLat); return; }
    // a place's icon (a campfire site, a toilet, a lean-to, a LIPAS place, an obstacle): its card, not a point (part 5)
    const place = this.placeAt(e.point, touch);
    if (place) { this.openPlaceCard(place, ll); return; }
    else {
      const wet = this.points.length > 0 && this.onOpenWater(e.point); // (a first point has no leg to get there by)
      this.addPoint(ll); // (the first point's peek offers a round trip from it: #232)
      // the note first (no other ways for a leg into the water), and the spot you tapped kept for its answer
      if (wet) { this.altFor = null; this.waterTap = { pt: ll, at: ll.slice() }; this.offerPaddle(); } else this.sportHint();
    }
    this.autoPeek();
  }

  // A point on open water while the next leg is in a land sport (B of #233): water all round where you tapped, as the
  // map draws it (no request), and no bridge or ferry there. A tap by the shore isn't one: a finger's width of land.
  onOpenWater(pt) {
    if (isWater(this.nextLegSport()) || !this.map.getLayer('water')) return false;
    const water = (x, y) => this.map.queryRenderedFeatures([x, y], { layers: ['water'] }).length > 0;
    const R = 16;
    if (!water(pt.x, pt.y)) return false;
    for (let k = 0; k < 8; k++) if (!water(pt.x + R * Math.cos((k * Math.PI) / 4), pt.y + R * Math.sin((k * Math.PI) / 4))) return false;
    const near = this.map.queryRenderedFeatures([[pt.x - 12, pt.y - 12], [pt.x + 12, pt.y + 12]]);
    return !near.some((f) => { const p = f.properties || {}; return p.brunnel === 'bridge' || p.bridge === 'yes' || p.class === 'ferry' || p.route === 'ferry' || /bridge|ferry/.test(f.layer.id); });
  }
  // "This point is on the water. How do you get there?" Paddle, Swim, in winter on the ice, or Stay on land
  offerPaddle() {
    const land = this.nextLegSport(), craft = (CRAFT[this.craft] || CRAFT.kayak).label;
    const winter = this.app.winter && this.app.winter().on;
    const onIce = { bike: 'Ride on the ice' }[groupOf(land)] || (land === 'run' || land === 'trailrun' ? 'Run on the ice' : 'Walk on the ice');
    toast('This point is on the water. How do you get there?', { ms: 10000, action: [
      { label: `Paddle (${craft === 'SUP' ? craft : craft.toLowerCase()})`, fn: () => this.waterFrom('paddle') },
      { label: 'Swim', fn: () => this.waterFrom('swim') },
      winter ? { label: onIce, fn: () => this.waterFrom('ice') } : null,
      { label: 'Stay on land', fn: () => { this.waterTap = null; } },
    ].filter(Boolean) });
  }

  // The note's answer: the leg to the spot you tapped goes over the water, paddled or swum, or in winter straight onto
  // the ice, and ends where you tapped, not where the router put it; the legs after it follow. No step of Undo of
  // its own: Undo takes the tap back.
  waterFrom(k) {
    const t = this.waterTap, i = t ? this.points.indexOf(t.pt) : -1;
    this.waterTap = null;
    if (i < 0) return; // the point has gone meanwhile
    t.pt[0] = t.at[0]; t.pt[1] = t.at[1];
    const leg = this.legs[i - 1], own = leg && leg.mode !== 'fixed';
    if (k === 'ice') {
      if (own) this.legs[i - 1] = { mode: 'line', sport: leg.sport, ice: true };
      this.setMode('line'); // on the ice there are no paths to follow
      this.update();
      toast('On the ice: straight lines from here on. Polku can’t see whether the ice holds. Check FMI’s ice chart (Layers → Winter → Sea ice) and local reports, and never go on ice you haven’t checked.', { tone: 'warn', ms: 12000 });
      return;
    }
    // the map and the legs you draw next are in k; the legs drawn keep theirs, and the one to this point is k
    const was = this.legs.map((_, j) => this.legSport(j));
    if (own) { this.legs[i - 1] = { mode: this.mode === 'line' ? 'line' : 'water', sport: k }; was[i - 1] = k; }
    this.app.setSport(k, { from: 'route' });
    this.legs.forEach((l, j) => { l.sport = was[j] === k ? undefined : was[j]; });
    this.next = null;
    this.matchMode();
    this.update();
    toast(`${ACTIVITIES[k].label} to this point, and on from here. Undo takes the point back.`, { ms: 7000, action: { label: 'Undo', fn: () => this.undo() } });
  }

  // a leg drawn straight onto the ice (the water note, in winter): Polku can't see the ice
  iceWarnings(a) {
    let i0 = -1, len = 0;
    for (let i = 1; i < a.along.length; i++) if ((a.attr[i] || {}).ice) { if (i0 < 0) i0 = i - 1; len += a.along[i] - a.along[i - 1]; }
    return i0 < 0 ? [] : [{ at: a.along[i0], len, kind: 'water', ic: 'warn', noAvoid: true, text: 'On the ice: Polku can’t see whether it holds', note: 'check FMI’s ice chart (Layers → Winter → Sea ice) and local reports, and never trust ice you haven’t checked', tier: 'read', src: { kind: 'calculated', by: 'your route over the ice' } }];
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
    const way = this.alts && this.map.getLayer('route-alts-line') && !this.edit
      && this.map.queryRenderedFeatures([[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]], { layers: ['route-alts-line', 'route-alts-casing', 'route-alts-glow', 'route-alts-label'] }).find((f) => !f.properties.route);
    if (this.alts) this.altHover(way ? way.properties.i : null);
    if (way) {
      this.map.getCanvas().style.cursor = 'pointer'; // a way on offer: a click takes it
      if (this.app.hoverLeg) this.app.hoverLeg(null);
      this.mapUnhover();
      return;
    }
    const a = this.analysis;
    const glow = (leg) => this.app.hoverLeg && this.app.hoverLeg(leg); // the leg under the pointer glows brighter (#198)
    if (!a || this.panel.hidden || this.edit) { glow(null); return; }
    const over = this.map.queryRenderedFeatures([[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]], { layers: ['route-casing'] }).find((f) => f.properties.kind !== 'gap');
    const hit = !!over;
    glow(over ? over.properties.leg : null);
    const view = this.inView();
    this.map.getCanvas().style.cursor = hit ? (view ? 'pointer' : 'grab') : (view ? '' : 'crosshair'); // the line can be dragged (not in the route's view)
    if (!hit) { this.mapUnhover(); return; }
    // the leg under the pointer lit, as a click lights it (#83)
    const li = over.properties.leg, s = { from: li, to: li + 1 }, l = this.litSpan;
    if (!l || l.from !== s.from || l.to !== s.to) this.lightStretchHover(s);
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
    d.lines.push(`<i class="tip-hint">${view ? 'Click for options' : 'Click for options · drag to reshape'}</i>`);
    const onMap = this.app.routeTip(e.originalEvent, d);
    this.chart.setHover(best, !onMap);
    this.hoverAt(best, true);
  }

  // the pointer off the route: its dot, tip and lit stretch go (back to what a card lights)
  mapUnhover() {
    if (!this.mapHover) return;
    this.mapHover = false; this.chart.setHover(-1); this.app.setData('routeHover', EMPTY); this.app.routeTip(null); this.unlitLeg();
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

  // Route's list (25d's part 4, D [jd-multi, jd-days, jd-long]): sections, a new one where the sport changes, at a stop
  // and at a night (then each is a day, the night with its morning's start); in each, its numbers, a short forecast for
  // its end and its warnings, then a row for each point you see and each stretch between them, the points that only
  // shape a stretch folded under it. A tap opens the point's or the stretch's card, and Back finds the list as it was
  // (the cards keep its scroll; what's unfolded is `unfolded`, in memory). Reorder [jd-reorder] lists every point.
  renderWaypoints() {
    const box = this.els && this.els.points;
    if (!box) return;
    this.cards.refresh(); // an open card follows its point, or closes when it's gone
    const n = this.points.length;
    this.shownNames = this.points.map((_, i) => this.autoName(i)).join('|');
    this.setSection('points', { count: n || '', empty: !n, summary: n > 1 ? `${this.nameOf(0)} → ${this.nameOf(n - 1)}` : '' });
    this.renderTitle(); // (the route's view's title: the names come with the map's tiles)
    // the route's view (25c): the same sections, without Reorder; a card shows what works there
    const ro = this.inView();
    this.els.viewNote.hidden = !ro;
    this.els.hint.hidden = ro;
    if (ro || n < 2) this.reordering = false;
    const loops = roundTripSports.includes(this.app.activity());
    this.els.pointsFoot.replaceChildren(...[
      loops ? h('button', { type: 'button', class: 'btn', title: 'Loops of the length you choose, from your start', onclick: () => this.openLoop(), html: `${icon('roundtrip', 16)} Round trip` }) : null,
      n > 1 ? h('button', { type: 'button', class: 'btn', title: 'The end becomes the start; each leg keeps its mode', onclick: () => this.reverse(), html: `${icon('reverse', 16)} Reverse` }) : null,
      n > 1 ? h('button', { type: 'button', class: 'btn', title: 'Route back to where you started', disabled: this.isLoop(), onclick: () => this.backToStart(), html: `${icon('loop', 16)} Back to start` }) : null,
      h('button', { type: 'button', class: 'btn', title: 'Import a GPX or KML file (or drop it on the map)', onclick: () => $('#file-input').click(), html: `${icon('upload', 16)} Import` }),
    ].filter(Boolean)); // (replaceChildren would write a null as "null")
    // what had the focus, found again in the list drawn anew (a row by its point or stretch, a button by its words)
    const was = box.contains(document.activeElement) ? document.activeElement : null;
    const wasKey = was && (was.dataset.i != null ? `i${was.dataset.i}` : was.dataset.from != null ? `s${was.dataset.from}${was.classList.contains('wpl-unfold') ? 'u' : ''}` : was.textContent.trim());
    const top = this.els.pointsTop;
    top.replaceChildren();
    box.replaceChildren();
    box.classList.toggle('reorder', !!this.reordering);
    if (n >= 2 && !ro) {
      top.append(h('p', { class: 'wpl-hint' }, this.reordering ? 'Drag a point, or move it earlier or later.' : 'Tap a point or a stretch to change it.'),
        h('button', { type: 'button', class: 'btn small quiet', 'aria-pressed': String(!!this.reordering), onclick: () => { this.reordering = !this.reordering; this.renderWaypoints(); top.querySelector('.btn')?.focus(); },
          html: this.reordering ? '' : icon('grip', 16) }, this.reordering ? 'Done' : 'Reorder'));
    }
    if (this.reordering) this.reorderRows(box);
    else this.sectionRows(box, ro);
    if (wasKey) {
      const again = [...box.querySelectorAll('button')].find((b) => (b.dataset.i != null ? `i${b.dataset.i}` : b.dataset.from != null ? `s${b.dataset.from}${b.classList.contains('wpl-unfold') ? 'u' : ''}` : b.textContent.trim()) === wasKey);
      if (again) again.focus({ preventScroll: true });
    }
    this.litRows();
    // an open leg stays lit (on a phone that's how a leg shows itself); otherwise nothing is
    if (!box.matches(':hover') && !this.mapHover) this.unlitLeg(); // (not the leg under the pointer on the map)
  }

  // The open card's row in Route's list, lit: a point's own row, or the stretch's it folds into; a stretch's cards
  // light the stretch's row
  litRows() {
    const box = this.els.points, c = this.cards.current;
    const i = c && c.key && this.points.includes(c.key) ? this.points.indexOf(c.key) : -1, s = c && c.kind !== 'item' ? c.stretch || c.s || null : null;
    const own = i >= 0 && box.querySelector(`.wpl-point[data-i="${i}"]`);
    for (const r of box.querySelectorAll('.wpl-point, .wpl-stretch')) {
      const on = own ? r === own : r.classList.contains('wpl-stretch') && (i >= 0 ? +r.dataset.from < i && i < +r.dataset.to : !!s && +r.dataset.from === s.from);
      if (on) r.setAttribute('aria-current', 'true'); else r.removeAttribute('aria-current');
    }
  }

  // The sections: where they start and end, their sport, why they end, and their stretches (point indices)
  sections() {
    const n = this.points.length, out = [];
    let from = 0;
    for (let i = 1; i < n; i++) {
      const stop = i < n - 1 ? this.stopAt(i) : null, ends = i === n - 1 ? 'end' : stop ? (isNight(stop) ? 'night' : 'stop') : this.changeAt(i) ? 'sport' : null;
      if (!ends) continue;
      const stretches = [];
      for (let a = from; a < i;) { const b = Math.min(this.stretchAt(a).to, i); stretches.push({ from: a, to: b }); a = b; }
      out.push({ from, to: i, sport: this.legSport(from), ends, stretches });
      from = i;
    }
    return out;
  }

  sectionRows(box, ro) {
    const secs = this.sections(), days = secs.some((s) => s.ends === 'night'), a = this.analysis, fits = this.analysisFits();
    const nums = (s) => { const x = this.stretchNums(s); return x ? [fmtDist(x.len), fmtDuration(x.sec), x.up == null ? '' : `↑${Math.round(x.up)} m`].filter(Boolean).join(' · ') : fmtDist(this.lengthTo(s.to) - this.lengthTo(s.from)); };
    let day = 1;
    secs.forEach((sec, k) => {
      const title = `${days ? `Day ${day} · ` : ''}${ACTIVITIES[sec.sport].label} · ${this.nameOf(sec.from)} → ${this.nameOf(sec.to)}`;
      if (sec.ends === 'night') day += this.stopAt(sec.to).n || 1;
      // a short forecast for its end; a tap says the rest under it [kf2-multi-tap]
      const w = fits && a.wind && a.wind.temp ? this.sampleAtM(this.lengthTo(sec.to)) : -1, id = this.pidOf(this.points[sec.from]), open = this.wxOpen.has(id);
      // (past the forecast's reach: none yet, never its last hour's, #465) [tabs-c-days]
      const nofc = w >= 0 && a.wind.beyond >= 0 && w >= a.wind.beyond;
      const wx = nofc ? h('span', { class: 'btn small quiet sec2-wx', html: icon('cloudSun', 15) }, 'No forecast yet') : w >= 0 ? h('button', { type: 'button', class: 'btn small quiet sec2-wx', 'aria-expanded': String(open), 'aria-label': `The weather at its end: ${Math.round(a.wind.temp[w])}°, wind ${Math.round(a.wind.speed[w])} m/s`,
        onclick: () => { if (open) this.wxOpen.delete(id); else this.wxOpen.add(id); this.renderWaypoints(); }, html: icon('cloudSun', 15) }, `${Math.round(a.wind.temp[w])}° · ${Math.round(a.wind.speed[w])} m/s`) : null;
      const at = open && w >= 0 ? this.atSample(w) : null;
      const head = h('div', { class: 'sec2-head' }, h('span', { 'aria-hidden': 'true', html: icon(this.sportIcon(sec.sport), 20) }), h('b', {}, title));
      const line = h('div', { class: 'sec2-nums' }, h('span', {}, nums(sec)), wx);
      const more = open && w >= 0 && !nofc ? h('p', { class: 'sec2-wx-at' }, `At its end${at ? `, ${this.clockOf(at)}` : ''}: ${Math.round(a.wind.temp[w])}°, wind ${Math.round(a.wind.speed[w])} m/s from the ${compass(a.wind.dir ? a.wind.dir[w] : 0)}`) : null;
      const rows = h('div', { class: 'rows', role: 'group', 'aria-label': title });
      if (k === 0) rows.append(this.pointRow(sec.from, ro));
      for (const s of sec.stretches) {
        rows.append(this.stretchRow(s, ro));
        const pid = this.pidOf(this.points[s.from]);
        if (this.unfolded.has(pid)) for (let i = s.from + 1; i < s.to; i++) rows.append(this.pointRow(i, ro, true));
        rows.append(this.pointRow(s.to, ro));
      }
      box.append(h('li', { class: `sec2${this.secLit === id ? ' lit' : ''}`, 'data-from': String(sec.from), 'data-to': String(sec.to) }, head, line, more, this.sectionWarn(sec), rows));
    });
  }

  // the analysis sample at m metres along the route
  sampleAtM(m) {
    const a = this.analysis;
    let i = 0;
    while (i < a.along.length - 1 && a.along[i] < m - 1) i++;
    return i;
  }

  // a section's warnings: what's to read before you go and what wasn't checked there, as the peek's row says it; a tap
  // shows the first on the route
  sectionWarn(sec) {
    const on = this.itemsOn(sec), read = on.filter((x) => x.g === 'read'), not = on.filter((x) => x.g === 'not');
    if (!read.length && !not.length) return null;
    const first = read[0] || not[0], k = read.length || not.length;
    const box = h('button', { type: 'button', class: `warn-row ${read.length ? 'danger' : 'unk'}`, onclick: () => this.openItemCard(first, { from: 'section', el: box }) },
      h('span', { 'aria-hidden': 'true', html: icon(read.length ? 'warnf' : 'unk', 20) }),
      h('span', {}, h('b', {}, `${k} ${read.length ? 'to read before you go' : 'not checked'}`), h('small', {}, `${first.w.text}${k > 1 ? ` and ${k - 1} more` : ''}${read.length && not.length ? ` · ${not.length} not checked` : ''}`)),
      h('span', { 'aria-hidden': 'true', html: icon('chevronRight', 18) }));
    return box;
  }

  // a point's row: its marker, its name, there at · how far · Via n; a stop, a night or a change of sport under it
  pointRow(i, ro, shape = false) {
    const p = this.points[i], n = this.points.length, last = i === n - 1 && i > 0, loop = last && this.isLoop();
    const name = this.nameOf(i), lab = this.label(i), arrive = i > 0 && this.analysisFits() ? this.arriveAt(i) : null;
    const sub = shape ? [fmtDist(this.lengthTo(i)), lab] : [i === 0 ? `Leave ${this.leaveWords()}` : arrive ? `there at ${this.clockOf(arrive)}` : '', fmtDist(i ? this.lengthTo(i) : 0), name === lab ? '' : lab, loop ? 'back at the start' : ''];
    const stop = this.stopAt(i), ch = this.changeAt(i);
    const extra = stop ? (isNight(stop) ? `${nightsWord(stop)} · go on at ${hhmm(stop.on)}` : `Stop · ${stop.min} min`) : ch ? `${ACTIVITIES[ch.to].label} from here · changeover ${ch.min} min` : '';
    // (a row as the cards' rows: its mark, its name, its lines, ›; Revision 5's list)
    const b = h('button', { type: 'button', class: `row wpl-point${shape ? ' shape' : ''}`, 'data-i': String(i), onclick: () => this.openPointCard(p, { from: 'list', el: b }) },
      h('span', { 'aria-hidden': 'true' }, h('span', { class: `wp wp-mini ${i === 0 ? 'wp-start' : last ? 'wp-end' : 'wp-via'}${loop ? ' wp-loop' : ''}` }, i === 0 || last ? '' : String(i))),
      h('span', {}, h('b', { class: 'wpl-name' }, name), extra ? h('small', { class: 'wpl-tag', html: `${icon(stop ? (isNight(stop) ? 'moon' : 'pause') : this.sportIcon(ch.to), 15)}<span>${escapeHtml(extra)}</span>` }) : null, h('small', {}, sub.filter(Boolean).join(' · '))),
      h('span', { class: 'way-chev', 'aria-hidden': 'true', html: icon('chevronRight', 18) }));
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.litLeg(i < n - 1 ? i : i - 1); });
    b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.unlitLeg(); });
    return b;
  }

  // a stretch's row: its distance, time and climb, how it's drawn and the points that only shape it, which unfold
  stretchRow(s, ro) {
    const legs = this.legs.slice(s.from, s.to), leg = legs[0], shaping = s.to - s.from - 1, x = this.stretchNums(s);
    const head = x ? [fmtDist(x.len), fmtDuration(x.sec), x.up ? `↑${Math.round(x.up)} m` : ''] : [fmtDist(this.lengthTo(s.to) - this.lengthTo(s.from))];
    const how = leg.mode === 'fixed' ? `Its own line: ${this.routeName || (leg.src ? 'a LIPAS route' : 'an imported track')}${leg.src ? ' (LIPAS)' : ''}` : MODE_LABEL[leg.mode] || MODE_LABEL.auto;
    const b = h('button', { type: 'button', class: 'row wpl-stretch', 'data-from': String(s.from), 'data-to': String(s.to), onclick: () => this.openStretchCard(s, { from: 'list', el: b }) },
      h('span', { 'aria-hidden': 'true', html: icon(leg.mode === 'fixed' ? 'sign' : MODE_ICON[leg.mode] || 'auto', 18) }),
      h('span', {}, h('b', {}, head.filter(Boolean).join(' · ')), h('small', {}, [how, shaping ? `via ${shaping} shaping point${shaping > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · '))),
      h('span', { class: 'way-chev', 'aria-hidden': 'true', html: icon('chevronRight', 16) }));
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.lightStretchHover(s); });
    b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.unlitLeg(); });
    const pid = this.pidOf(this.points[s.from]), open = this.unfolded.has(pid);
    const fold = shaping ? h('button', { type: 'button', class: 'tool wpl-unfold', 'data-from': String(s.from), 'aria-expanded': String(open), 'aria-label': open ? `Fold the ${shaping} shaping points` : `Show the ${shaping} shaping points`,
      onclick: () => { if (open) this.unfolded.delete(pid); else this.unfolded.add(pid); this.renderWaypoints(); }, html: icon(open ? 'chevronUp' : 'chevronDown', 18) }) : null;
    return h('div', { class: 'wpl-strow' }, b, fold);
  }
  // a stretch under the mouse in the list: lit on the map, as a leg's row was
  lightStretchHover(s) {
    this.showSpan(s);
    if (this.chart && this.analysis) this.chart.setHighlight([this.lengthTo(s.from), this.lengthTo(s.to)]);
  }

  // Reorder [jd-reorder]: every point with its grip, Earlier and Later. A mouse drags by the grip; a finger holds the
  // row 0.45 s first, so a scroll never drags. Each move is one step of Undo.
  reorderRows(box) {
    const n = this.points.length, loop = this.isLoop();
    this.points.forEach((p, i) => {
      const last = i === n - 1, name = this.nameOf(i), lab = this.label(i);
      const btn = (ic, label, fn, disabled) => h('button', { type: 'button', class: 'tool', 'aria-label': label, title: label, disabled, onclick: (e) => { e.stopPropagation(); fn(); }, html: icon(ic, 18) });
      const row = h('li', { class: 'wpl-row', 'data-i': String(i) },
        h('span', { class: 'wpl-grip', title: 'Drag to reorder', 'aria-hidden': 'true', html: icon('grip', 16) }),
        h('span', { class: `wp wp-mini ${i === 0 ? 'wp-start' : last ? 'wp-end' : 'wp-via'}${last && loop ? ' wp-loop' : ''}`, 'aria-hidden': 'true' }, i === 0 || last ? '' : String(i)),
        h('span', { class: 'wpl-main' }, h('b', { class: 'wpl-name' }, name), h('small', {}, [fmtDist(i ? this.lengthTo(i) : 0), name === lab ? '' : lab].filter(Boolean).join(' · '))),
        btn('chevronUp', `Move ${name} earlier`, () => this.movePointTo(i, i - 1), i === 0),
        btn('chevronDown', `Move ${name} later`, () => this.movePointTo(i, i + 1), last));
      row.querySelector('.wpl-grip').addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') this.dragRow(e, row, i); });
      row.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !e.target.closest('button')) this.holdRow(e, row, i); });
      box.append(row);
    });
  }

  // a finger on a row of Reorder: held 0.45 s without moving 10 px it drags the point; a move sooner scrolls the list.
  // The hold is by the touch's own times, as the map's holds are (#293): on a busy page a move can reach the page before
  // the timer runs, and a move after 0.45 s is the drag all the same; once held, the list doesn't scroll under it.
  holdRow(e, row, i) {
    const x0 = e.clientX, y0 = e.clientY, id = e.pointerId, t0 = e.timeStamp, HOLD = 450;
    const held = (ev) => ev.timeStamp - t0 >= HOLD;
    const still = (ev) => { if (held(ev)) ev.preventDefault(); };
    const done = () => { clearTimeout(t); row.removeEventListener('pointermove', move); row.removeEventListener('pointerup', done); row.removeEventListener('pointercancel', done); row.removeEventListener('touchmove', still); };
    const go = () => { done(); this.dragRow({ clientY: y0, pointerId: id, preventDefault() {}, stopPropagation() {} }, row, i, { touch: true }); };
    const move = (ev) => { if (ev.pointerId !== id) return; if (held(ev)) go(); else if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) done(); };
    const t = setTimeout(go, HOLD);
    row.addEventListener('pointermove', move);
    row.addEventListener('pointerup', done);
    row.addEventListener('pointercancel', done);
    row.addEventListener('touchmove', still, { passive: false });
  }

  // Drag a row of Reorder (by its grip, or by a finger held on it); the gap it would drop into is marked, and the drop is
  // one step of Undo. While a finger drags, the list doesn't scroll under it.
  dragRow(e, row, i, { touch = false } = {}) {
    e.preventDefault();
    e.stopPropagation();
    const box = this.els.points, rows = [...box.querySelectorAll('.wpl-row')];
    const y0 = e.clientY;
    let to = i;
    row.classList.add('dragging');
    try { row.setPointerCapture(e.pointerId); } catch { /* the finger already up */ }
    const still = (ev) => ev.preventDefault();
    if (touch) row.addEventListener('touchmove', still, { passive: false });
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
      row.removeEventListener('touchmove', still);
      row.classList.remove('dragging');
      row.style.transform = '';
      rows.forEach((r) => r.classList.remove('drop-before', 'drop-after'));
      if (to !== i) this.movePointTo(i, to);
    };
    row.addEventListener('pointermove', move);
    row.addEventListener('pointerup', up);
    row.addEventListener('pointercancel', up);
  }

  // The list's keys (desktops): ↑ ↓ between rows, Enter opens (the row is a button), Alt+↑ Alt+↓ move a point, Delete
  // removes it with Undo in the note
  listKeys(e) {
    const t = e.target, box = this.els.points;
    if (!t.matches('.wpl-point, .wpl-stretch') || this.reordering) return;
    const all = [...box.querySelectorAll('.wpl-point, .wpl-stretch')], k = all.indexOf(t), i = t.dataset.i != null ? +t.dataset.i : null;
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.altKey) {
      if (i == null) return;
      e.preventDefault();
      const j = i + (e.key === 'ArrowDown' ? 1 : -1);
      if (j < 0 || j >= this.points.length) return;
      this.movePointTo(i, j);
      box.querySelector(`.wpl-point[data-i="${j}"]`)?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      all[Math.max(0, Math.min(all.length - 1, k + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && i != null) {
      e.preventDefault();
      const name = this.nameOf(i);
      this.removePoint(i);
      toast(`${name} removed`, { ms: 7000, action: { label: 'Undo', fn: () => this.undo() } });
      (box.querySelector(`.wpl-point[data-i="${Math.min(i, this.points.length - 1)}"]`) || box.querySelector('.wpl-point'))?.focus();
    }
  }

  // Points: the visible dot sits in a bigger, invisible touch target (44 px on
  // touch screens). Dragging one re-routes its two legs live.
  renderMarkers() {
    for (const m of this.markers) m.remove();
    this.markers = this.points.map((p, i) => {
      const last = i === this.points.length - 1 && i > 0;
      const loopEnd = last && dist(p, this.points[0]) < 3;
      const ch = this.changeAt(i);
      const el = h('div', { class: 'wp-hit', title: `${this.nameOf(i)}${ch ? ` · change to ${ACTIVITIES[ch.to].label} (${ch.min} min)` : ''}${this.stopAt(i) ? ` · ${stopLabel(this.stopAt(i))}` : ''}${this.inView() ? '' : ' · drag to move'} · click for options` }, h('div', {
        class: `wp ${i === 0 ? 'wp-start' : last ? 'wp-end' : 'wp-via'}${loopEnd ? ' wp-loop' : ''}`,
      }, i === 0 ? '' : last ? '' : String(i)), ch ? h('span', { class: 'wp-sport', html: icon(this.sportIcon(ch.to), 12) }) : null,
      this.stopAt(i) ? h('span', { class: `wp-stop${isNight(this.stopAt(i)) ? ' night' : ''}`, html: icon(isNight(this.stopAt(i)) ? 'moon' : 'pause', 11) }) : null);
      el.hidden = !this.active;
      const m = new maplibregl.Marker({ element: el, draggable: !this.inView() }).setLngLat(p).addTo(this.map); // (they stay put in the route's view)
      m.on('dragstart', () => this.beginEdit(i, this.snapshot(), m));
      m.on('drag', () => { const ll = m.getLngLat(); this.editTo([+ll.lng.toFixed(6), +ll.lat.toFixed(6)]); });
      m.on('dragend', () => this.endEdit());
      el.addEventListener('click', (ev) => { ev.stopPropagation(); if (Date.now() >= this.noClickUntil) this.openPointCard(p); });
      return m;
    });
  }

  // A handle in the middle of each leg: drag it to pull the route somewhere
  // else, or click it for that part's menu, as on the line. Hidden where the leg
  // is short on screen, so the handles never crowd the points.
  renderGhosts() {
    for (const g of this.ghosts) g.remove();
    this.ghosts = [];
    if (!this.active || this.inView()) return; // (the route's view changes nothing by touch: 25c)
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
      el.addEventListener('click', (ev) => { ev.stopPropagation(); if (Date.now() >= this.noClickUntil) this.openRouteCard(li, mid); });
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
    this.clearCategoryPreview();
    this.edit = { i, snap, t0: Date.now(), timers: {}, reqs: {}, last: {} };
    if (this.menu) this.menu.remove();
    this.clearAlts();
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
    for (const m of [this.pname, this.pchange, this.pstop, this.pcarry, this.pid]) if (m.has(old)) m.set(ll, m.get(old)); // (its card goes with it: findPoint())
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

  // An edit begun by mistake: the route as it was before it, with no step in Undo.
  dropEdit() {
    const ed = this.edit;
    if (!ed) return;
    this.edit = null;
    for (const t of Object.values(ed.timers)) clearTimeout(t);
    for (const q of Object.values(ed.reqs)) if (!q.done) q.ctrl.abort();
    document.body.classList.remove('route-editing');
    this.restoreSnap(ed.snap);
  }

  // Press on the route and drag: a new via point under the pointer. With a mouse the drag starts as soon as it moves;
  // on a touch screen hold the line for a moment first (0.3 s), so a swipe across it still pans the map, and the split
  // waits for the first move after it. Held still to 0.5 s, Edit this stretch opens and nothing is split (25d part 5).
  onLinePress(e) {
    if (!this.active || this.edit || this.panel.hidden || this.inView()) return; // (in the route's view a tap on the line is its menu)
    // Marker presses bubble through the map too: their own drag must be the
    // only edit, even when the marker sits directly over the route.
    if (e.originalEvent.target?.closest?.('.maplibregl-marker, .maplibregl-popup')) return;
    if (this.headAt(e.point, this.isTouch() ? 18 : 10)) return; // a marker of Check's over the line: the press is its
    const f = (e.features || []).find((x) => x.properties.kind === 'leg');
    if (!f || f.properties.loading) return;
    const touch = e.type === 'touchstart';
    if (touch ? e.points.length !== 1 : e.originalEvent.button !== 0) return;
    const map = this.map, li = f.properties.leg, p0 = e.point, t0 = e.originalEvent.timeStamp, HOLD = 300, STILL = 500;
    const ll0 = [+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)];
    let dot = null, hold = 0, still = 0, armed = false, card = null;
    const start = () => {
      if (this.edit) return;
      const snap = this.snapshot();
      const k = this.splitLeg(li, ll0);
      dot = new maplibregl.Marker({ element: h('div', { class: 'wp-hit' }, h('div', { class: 'wp wp-via' })) }).setLngLat(this.points[k]).addTo(map);
      this.beginEdit(k, snap);
      this.drawRoute();
    };
    // held for the line: the map stays still under the finger; held still on, Edit this stretch
    const arm = () => {
      armed = true;
      map.dragPan.disable();
      if (navigator.vibrate) navigator.vibrate(10);
      still = setTimeout(() => { still = setTimeout(() => { map.dragPan.enable(); edit(); }, 60); }, STILL - HOLD); // (a moment more for a late lift, as the hold's)
    };
    const move = (ev) => {
      if (!dot) {
        const d = Math.hypot(ev.point.x - p0.x, ev.point.y - p0.y);
        if (touch && ev.points && ev.points.length > 1) { stop(); return; } // a second finger, held or not: a pinch, the map's
        if (touch && !armed) {
          // held long enough by the finger's own times, though a busy page hasn't run the hold's timer yet: held after all
          if (ev.originalEvent.timeStamp - t0 >= HOLD) { clearTimeout(hold); arm(); } else { if (d > 10) stop(); return; } // (a swipe: the map's)
        }
        if (d < (touch ? 10 : 4)) return;
        // Edit this stretch is open: the finger moved before its time, though a busy page saw it late, so it's a drag
        // after all (#293); else the card is the hold's, and the move nothing
        if (card) {
          if (ev.originalEvent.timeStamp - t0 >= STILL) return;
          if (this.cards.current === card) this.cards.close();
          card = null;
          this.noClickUntil = 0;
          map.dragPan.disable();
        }
        clearTimeout(still);
        start();
      }
      const ll = [+ev.lngLat.lng.toFixed(6), +ev.lngLat.lat.toFixed(6)];
      dot.setLngLat(ll);
      this.editTo(ll);
    };
    const edit = () => {
      if (navigator.vibrate) navigator.vibrate(10);
      this.noClickUntil = Date.now() + 700;
      this.openStretchCard(this.stretchAt(li), { edit: true, at: ll0 });
      card = this.cards.current;
    };
    const stop = (ev) => {
      clearTimeout(hold);
      clearTimeout(still);
      map.off(touch ? 'touchmove' : 'mousemove', move);
      if (touch) { map.off('touchend', stop); map.off('touchcancel', stop); } else window.removeEventListener('mouseup', stop);
      if (armed) map.dragPan.enable();
      // held still long enough by the finger's own times, though a busy page hasn't run the timers yet: Edit this stretch
      if (touch && !dot && !card && ev && ev.type === 'touchend' && ev.originalEvent.timeStamp - t0 >= STILL) { edit(); ev.originalEvent.preventDefault(); this.noClickUntil = Date.now() + 400; return; }
      // the finger was up before the hold's time, though a busy page saw it late: a tap after all, so the route's card
      // (#293), whether or not a click follows
      if (card) {
        if (ev) ev.originalEvent.preventDefault(); // (no click as the finger lifts)
        this.noClickUntil = Date.now() + 400;
        if (ev && ev.type === 'touchend' && ev.originalEvent.timeStamp - t0 < STILL) this.openRouteCard(li, ll0);
        return;
      }
      if (!dot) return;
      dot.remove();
      this.endEdit();
    };
    if (touch) hold = setTimeout(arm, HOLD);
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
      // put on a way marked private or closed, and moved off it: remember where (#104)
      if (d > 15 && this.closedAt(p, this.legSport(legs[1] ? i : i - 1))) this.pspot.set(p, [p[0], p[1]]);
      else this.pspot.delete(p);
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

  // ---------------------------------------------------------------- the route's card and its stretches (25d's 1b)
  // A tap on the route (25d's 1b, #345): its card, at the spot. `ll` a [lng, lat] or MapLibre's LngLat. It replaces the
  // leg's menu: every action of it is on the route's card, This stretch, or Edit this stretch.
  openRouteCard(li, ll, { from = 'map' } = {}) {
    if (!this.legs[li]) return;
    if (this.menu) this.menu.remove();
    this.stopPicking();
    const at = Array.isArray(ll) ? ll : [+ll.lng.toFixed(6), +ll.lat.toFixed(6)];
    this.cards.open(routeCard(this, li, at), { at, from });
  }
  // a stretch's card (from a point's Next stretch, the list); `edit`: straight to Edit this stretch
  openStretchCard(s, { edit = false, at = null, from = 'map', el = null } = {}) {
    if (!this.legs[s.from]) return;
    if (this.menu) this.menu.remove();
    this.stopPicking();
    const beside = this.besideRow(el);
    if (beside) this.frame(bbox(this.legs.slice(s.from, s.to).flatMap((l, k) => (l.result ? l.result.coords : [this.points[s.from + k], this.points[s.from + k + 1]]))), { maxZoom: 16, duration: 600 }); // (in sight)
    this.cards.open(edit ? editCard(this, s, { spot: at }) : stretchCard(this, s, { spot: at }), { at: at || this.stretchMiddle(s), beside, from });
  }

  // A point you see (D): the start, the end, a stop or a night, a change of sport, a point you named, or where the legs'
  // settings change (how they're drawn, their style, their sport). The others only shape the line.
  keyPoint(i) {
    const n = this.points.length;
    if (i <= 0 || i >= n - 1) return true;
    if (this.stopAt(i) || this.changeAt(i) || this.pname.get(this.points[i])) return true;
    const a = this.legs[i - 1], b = this.legs[i];
    return !a || !b || a.mode !== b.mode || (a.mode === 'fixed' && a.src !== b.src) || JSON.stringify(a.style || null) !== JSON.stringify(b.style || null) || this.legSport(i - 1) !== this.legSport(i);
  }
  // the stretch leg li is on: from the point you see at or before it to the next one after it (point indices)
  stretchAt(li) {
    let from = Math.max(0, Math.min(li, this.points.length - 2)), to = from + 1;
    while (from > 0 && !this.keyPoint(from)) from--;
    while (to < this.points.length - 1 && !this.keyPoint(to)) to++;
    return { from, to };
  }
  // the leg the route passes a spot on (40 m at most), or null: a card at that spot finds its leg again by it
  legNear(ll) { const n = this.nearLine(ll); return n && n.d < 40 ? n.li : null; }
  // the route at a spot: its analysis sample, how far along, the way and its tags; null while the route is worked out
  routeSpot(ll) {
    const a = this.analysis;
    if (!a || !this.analysisFits()) return null;
    const m = this.spotMemo;
    if (m && m.a === a && m.ll === ll) return m.x;
    const k = Math.cos((ll[1] * Math.PI) / 180);
    let i = 0, best = Infinity;
    for (let j = 0; j < a.pts.length; j++) { const d = ((a.pts[j][0] - ll[0]) * k) ** 2 + (a.pts[j][1] - ll[1]) ** 2; if (d < best) { best = d; i = j; } }
    const kind = a.way[i] === 'portage' ? 'carry' : a.way[i] === 'water' ? 'open water' : a.way[i];
    const x = { i, along: a.along[i], kind, name: ['straight line', 'water'].includes(a.way[i]) ? '' : this.roadAt(i), tags: (a.attr[i] && a.attr[i].tags) || {} };
    this.spotMemo = { a, ll, x };
    return x;
  }
  // when you'd be at analysis sample i (epoch seconds), or null
  atSample(i) {
    const a = this.analysis, tAt = a && (a.tAtWind || a.tAt);
    return tAt ? (a.wind ? a.wind.startSec : this.startSec()) + tAt[i] : null;
  }
  // a stretch's distance, moving time and climb, from the analysis (null while it's worked out)
  stretchNums(s) {
    const a = this.analysis;
    if (!a || !this.analysisFits()) return null;
    const m0 = this.lengthTo(s.from), m1 = this.lengthTo(s.to), tAt = a.tAtWind || a.tAt;
    let k0 = 0;
    while (k0 < a.along.length - 1 && a.along[k0] < m0 - 1) k0++;
    let k1 = k0;
    while (k1 < a.along.length - 1 && a.along[k1] < m1 - 1) k1++;
    let wait = 0;
    for (let k = k0 + 1; k <= k1; k++) wait += a.waitAt ? a.waitAt[k] : 0;
    // the climb as the route's: 2 m before it counts, nothing on open water, unknown where the terrain is
    let up = 0, ref = a.ele[k0], gap = false;
    for (let k = k0 + 1; k <= k1; k++) {
      if (a.eleGap && a.eleGap[k]) gap = true;
      if (a.surf[k] === 'water') { ref = a.ele[k]; continue; }
      if (a.ele[k] - ref > 2) { up += a.ele[k] - ref; ref = a.ele[k]; } else if (ref - a.ele[k] > 2) ref = a.ele[k];
    }
    return { len: m1 - m0, sec: Math.max(0, tAt[k1] - tAt[k0] - wait), up: gap && !up ? null : up };
  }
  // the middle of a stretch along its line, for its card's place when it wasn't opened at a spot
  stretchMiddle(s) {
    const c = this.legs.slice(s.from, s.to).flatMap((l, k) => (l.result ? l.result.coords : [this.points[s.from + k], this.points[s.from + k + 1]]));
    let L = 0;
    for (let j = 1; j < c.length; j++) L += dist(c[j - 1], c[j]);
    let at = L / 2;
    for (let j = 1; j < c.length; j++) { const d = dist(c[j - 1], c[j]); if (at <= d) { const f = d ? at / d : 0; return [+(c[j - 1][0] + (c[j][0] - c[j - 1][0]) * f).toFixed(6), +(c[j - 1][1] + (c[j][1] - c[j - 1][1]) * f).toFixed(6)]; } at -= d; }
    return this.points[s.from];
  }
  // what Check has on a stretch, the most serious first, then along the route (a whole route's isn't on one stretch)
  itemsOn(s) {
    if (!this.analysis || !s) return [];
    const a0 = this.lengthTo(s.from), a1 = this.lengthTo(s.to), rank = { read: 0, not: 1, look: 2 };
    return (this.headsList || this.itemsAlong()).filter((x) => x.w.ranges !== null && x.w.at != null && x.w.at <= a1 && x.w.at + (x.w.len || 0) >= a0)
      .sort((x, y) => rank[x.g] - rank[y.g] || x.w.at - y.w.at);
  }

  // Add a point here, on the route's card: a point at the spot, on its line (no routing call), one step of Undo, and a
  // note saying where (the points' numbers)
  addOnCard(card) {
    const li = this.legNear(card.key);
    if (li == null) return;
    this.cards.close();
    this.insertPoint(li, card.key);
    toast(`Point added after ${li === 0 ? 'the start' : this.label(li)}`, { ms: 7000, action: { label: 'Undo', fn: () => this.undo() } });
  }
  // Every leg of a stretch in a sport, drawn a way, or in a style (null: the route's), in one step of Undo. In a water
  // sport its legs go over the water, back on land they follow paths again; a fixed line keeps its line.
  setStretch(s, { sport, mode, style } = {}) {
    const legs = this.legs.slice(s.from, s.to);
    if (!legs.length) return;
    this.commit();
    for (let k = s.from; k < s.to; k++) {
      if (sport && this.legSport(k) !== sport) {
        this.legInSport(k, sport);
        const l = this.legs[k];
        if (l.mode !== 'fixed') l.mode = isWater(sport) ? 'water' : l.mode === 'water' ? 'auto' : l.mode;
      }
      if (mode && this.legs[k].mode !== 'fixed' && this.legs[k].mode !== mode) this.legs[k] = { mode, style: this.legs[k].style, sport: this.legs[k].sport };
      if (style !== undefined) this.legs[k].style = style;
    }
    this.update();
  }
  // the profile zoomed to a stretch (on a phone the card gives the peek back to the profile)
  showStretchOnProfile(s) {
    if (!this.analysis) return;
    if (this.cards.where() === 'peek') this.cards.close({ restore: false });
    this.reveal('profile');
    requestAnimationFrame(() => this.chart.setView([this.lengthTo(s.from), this.lengthTo(s.to)], true));
  }
  // Stop here: a point with a break at the spot on the line (picked on the map when the card has none), and its card
  async stopOnStretch(card) {
    const ll = card.spot || await this.pickOnMap(`${this.coarse() ? 'Tap' : 'Click'} where to stop`);
    const li = ll && this.legNear(ll);
    if (li == null) return;
    this.cards.close();
    this.stopHere(li, ll);
  }
  // Avoid this spot, or a spot picked on the map: a place the route goes around
  async avoidOnStretch(card) {
    const ll = card.spot || await this.pickOnMap(`${this.coarse() ? 'Tap' : 'Click'} the spot to avoid`);
    if (!ll) return;
    this.cards.close();
    this.addNogo(ll, 40, 'Avoided place');
  }
  // What's here's All OpenStreetMap details (25d part 6): the way or the place at the spot, asked once a card (Overpass,
  // osmDetails()); its tags then fill the card's facts too (Last checked, a toilet's fee). `what`: { type, id } or null
  // for the way nearest the spot. An answer after the card closed changes nothing.
  async osmOnCard(card, ll, what = null) {
    if (card.osm && (card.osm.rows || card.osm.asking)) return;
    card.osm = { state: 'Asking OpenStreetMap…', asking: true };
    this.cards.refresh();
    try {
      const w = await osmDetails({ ll, type: what ? what.type : 'way', id: what ? what.id : null });
      card.osm = w ? { w, rows: [...OSM_KEYS.filter(([k]) => w.tags[k]).map(([k, label]) => [label, String(w.tags[k])]), ...(w.len ? [['Length', `${Math.round(w.len)} m`]] : []), ['OpenStreetMap', `${w.type} ${w.id}`]] }
        : { state: `No OpenStreetMap ${what && what.type === 'place' ? 'place' : 'way'} found here` };
    } catch { card.osm = { state: 'OpenStreetMap didn’t answer: try again' }; }
    if (this.cards.stack.some((e) => e.card === card)) this.cards.refresh();
  }
  // Share link's line: what the link carries beyond the route, the date once one is set (#364's C; to share without it,
  // set Now first)
  shareSub() { return this.leaveAt == null ? '' : `Includes when you leave: ${this.dayOf(this.leaveAt)}, ${this.timeOf(this.leaveAt)}`; }
  loopsHere() { return roundTripSports.includes(this.app.activity()); }
  importFile() { $('#file-input').click(); }

  // Hold the map still for 0.5 s (within 10 px), or right-click it: what's there and what you can do there (25d part 5).
  // A ring fills under the finger from 0.15 s; let go sooner and it's a tap. A move or a second finger is the map's own.
  // While drawing, a hold on the line is the line's own (onLinePress()), and a right-click there is Edit this stretch.
  bindHold() {
    const map = this.map, HOLD = 500, RING = 150, LATE = 60;
    let timers = [], p0 = null, lastTouch = 0, t0 = 0, held = null, ring = null, open = null, cam = null;
    const cancel = () => { timers.forEach(clearTimeout); timers = []; if (ring) { ring.remove(); ring = null; } };
    const onUi = (e) => { const t = e.originalEvent && e.originalEvent.target; return !!(t && t.closest && t.closest('.maplibregl-marker, .maplibregl-popup')); };
    map.on('touchstart', (e) => {
      lastTouch = Date.now();
      cancel();
      if (e.points.length !== 1 || this.edit || this.picking || onUi(e)) return;
      if (this.drawing() && this.lineAt(e.point, 0) != null) return; // the line's own hold
      p0 = e.point;
      t0 = e.originalEvent.timeStamp;
      held = null;
      const ll = e.lngLat, pt = e.point, R = map.getCanvas().getBoundingClientRect();
      open = () => {
        cancel();
        if (navigator.vibrate) navigator.vibrate(10);
        this.noClickUntil = Date.now() + 700;
        cam = { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
        this.openSpotCard(ll, { pt, touch: true, hold: true });
        held = this.cards.current;
      };
      timers = [
        setTimeout(() => { ring = h('div', { class: 'hold-ring', style: `left:${R.left + pt.x}px;top:${R.top + pt.y}px`, 'aria-hidden': 'true' }); document.body.append(ring); }, RING),
        // (on a busy page this timer can run before the touchend the finger's lift sent has been handled: it waits a moment
        // for it, and a lift that comes cancels it, so no card is opened and moved for a tap)
        setTimeout(() => timers.push(setTimeout(open, LATE)), HOLD),
      ];
    });
    map.on('touchmove', (e) => {
      if (!p0 || (e.points.length < 2 && Math.hypot(e.point.x - p0.x, e.point.y - p0.y) <= 10)) return;
      if (timers.length) cancel();
      // …and a move before the hold's time that a busy page saw late: the map's after all (#293)
      else if (held && e.originalEvent.timeStamp - t0 < HOLD) {
        if (this.cards.current === held) this.cards.close();
        this.noClickUntil = 0;
        held = null;
      }
    });
    map.on('touchend', (e) => {
      // held long enough by the finger's own times, though a busy page hasn't run the hold's timer yet: the hold's card
      if (timers.length && e.originalEvent.timeStamp - t0 >= HOLD) { open(); e.originalEvent.preventDefault(); this.noClickUntil = Date.now() + 400; held = null; return; }
      cancel();
      // the finger was up before the hold's time, though a busy page saw it late (its timer ran first): a tap after
      // all, so no card, and its click goes through (#293)
      if (held && e.originalEvent.timeStamp - t0 < HOLD) {
        if (this.cards.current === held) this.cards.close();
        // the card may have moved the map to make room: put it back, and replay the tap once the map has drawn again, since
        // the click that follows would be judged by what it drew moved, not by what's under the finger (the browser's own
        // click is held off meanwhile)
        map.jumpTo(cam);
        this.noClickUntil = Date.now() + 1500;
        const at = p0, ev = e.originalEvent;
        let sent = false;
        const replay = () => {
          if (sent) return;
          sent = true;
          this.noClickUntil = 0;
          map.fire('click', { point: at, lngLat: map.unproject(at), originalEvent: ev });
          this.noClickUntil = Date.now() + 400; // (the browser's own click may still come: on what the tap just put there, the new point's marker)
        };
        map.once('idle', replay); // (its symbols are placed again by then: a marker of Check's is found under the finger)
        setTimeout(replay, 250);
      } else if (held) {
        // no click as the finger lifts, however long it was held: it would land on the card, moved under the finger
        e.originalEvent.preventDefault();
        this.noClickUntil = Date.now() + 400;
      }
      held = null;
    });
    map.on('touchcancel', () => { cancel(); held = null; });
    // right-drag (and Ctrl+drag) turns the map: no card after a drag (Windows sends it on release); Android sends one
    // after a hold, which has its card already
    let down = null;
    map.on('mousedown', (e) => { down = e.originalEvent.button === 2 || e.originalEvent.ctrlKey ? e.point : null; });
    map.on('contextmenu', (e) => {
      const d = down;
      down = null; // (a press of its own each time: the keyboard's has none, 5b)
      if (Date.now() - lastTouch < 1000 || this.edit || this.picking || onUi(e) || (d && Math.hypot(e.point.x - d.x, e.point.y - d.y) > 4)) return;
      const li = this.active ? this.lineAt(e.point, 6) : null;
      if (li != null) { if (this.drawing()) this.openStretchCard(this.stretchAt(li), { edit: true, at: [+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)] }); else this.openRouteCard(li, e.lngLat); return; }
      this.openSpotCard(e.lngLat, { pt: e.point, hold: true });
    });
    map.on('rotatestart', () => { const c = this.cards.current; if (c && (c.kind === 'spot' || c.kind === 'place')) this.cards.close(); });
  }
  drawing() { return this.active && !this.inView(); }
  // the leg whose line is under a spot of the screen (r px around it), or null; not while it's routed
  lineAt(pt, r) {
    if (!this.map.getLayer('route-casing')) return null;
    const f = this.map.queryRenderedFeatures([[pt.x - r, pt.y - r], [pt.x + r, pt.y + r]], { layers: ['route-casing'] }).find((x) => x.properties.kind === 'leg');
    return f && !f.properties.loading ? f.properties.leg : null;
  }
  // a place's icon under a tap or a hold (12 px by touch, 6 px with a mouse): a campfire site, a toilet, a lean-to, a
  // peak, a LIPAS place, an obstacle; or null
  placeAt(pt, touch) {
    const r = touch ? 12 : 6, layers = PLACE_LAYERS.filter((id) => this.map.getLayer(id));
    return layers.length ? this.map.queryRenderedFeatures([[pt.x - r, pt.y - r], [pt.x + r, pt.y + r]], { layers })[0] || null : null;
  }

  // What's there (part 5): a place's card on its icon, else the spot's, with the way or what else the map has there.
  // `place`: a place to show (from search, part 6); `from`: the card it's opened from (Back goes back to it)
  openSpotCard(lngLat, { pt = null, touch = false, place = null, from = 'map', pin = false, name = '', hold = false } = {}) {
    const ll = Array.isArray(lngLat) ? lngLat : [+lngLat.lng.toFixed(6), +lngLat.lat.toFixed(6)], p = pt || this.map.project(ll);
    place = place || this.placeAt(p, touch);
    if (place) { this.openPlaceCard(place, ll, { from, pin }); return; }
    const feats = this.map.queryRenderedFeatures(hitBox(p, touch), { layers: inspectLayers(this.map) });
    const f = pickFeature(feats), way = feats.find((x) => /^(path|track|cycleway|road)-/.test(x.layer.id)), bike = groupOf(this.app.activity()) === 'bike';
    const d = f && describe(f, feats, { ll, bike, mtb: this.app.activity() === 'mtb' });
    const text = (html) => { const e = document.createElement('span'); e.innerHTML = html; return e.textContent; };
    const water = !d && this.map.getLayer('water') && this.map.queryRenderedFeatures(p, { layers: ['water'] }).length;
    const route = feats.find((x) => x.layer.id === 'lipas-route');
    const card = spotCard(this, { ll, pin, title: d ? text(d.title) : water ? 'Water' : name || 'This spot', line: d ? d.bits.filter((b) => !b.startsWith('<i class="dot"')).map(text).join(', ') : water ? '' : 'Nothing is mapped right here',
      tags: way ? tileTags(way.properties) : {}, way: !!way, osm: way && way.properties.osm ? { type: 'way', id: way.properties.osm } : way ? { type: 'way', id: null } : null,
      ...wayExtras(way ? way.properties : {}, { winter: winterAt(feats, ll), uphill: feats.find((x) => x.layer.id === 'uphill-line'), bike }),
      partOf: route && route.properties.name ? { props: route.properties, ll } : null, hold, touch });
    // a phone's tap while browsing: the line at the spot first (#574); a hold, a click and the rest: the card
    if (card.kind === 'spot' && touch && !hold && !pin && from === 'map' && this.cards.where() === 'peek') { this.showLine(card); return; }
    this.hideLine();
    this.openCard(card, ll, from);
  }
  // What a tap picked, drawn on the map like a route (#574): its colours along it, a street's other side, an area's outline;
  // nothing drawn with no pick
  drawPick(pick) {
    const d = pick ? pickData(pick) : { pick: EMPTY, side: EMPTY, area: EMPTY };
    this.app.setData('pick', d.pick);
    this.app.setData('pickSide', d.side);
    this.app.setData('pickArea', d.area);
    this.app.setData('pickRing', EMPTY);
  }
  // The map's other things (#564): their card, the thing highlighted (a line in amber, an area's outline, a ring at a point)
  openThing(f, ll) {
    this.hideLine();
    this.openCard(thingCard(this, f, ll), ll);
    this.drawThing(f);
  }
  drawThing(f) {
    const g = f && f.geometry, fc = (geometry, properties = {}) => ({ type: 'FeatureCollection', features: [{ type: 'Feature', properties, geometry }] });
    const line = g && /LineString/.test(g.type), area = g && /Polygon/.test(g.type) && f.layer.id !== 'water';
    this.app.setData('pick', line ? fc(g, { color: '#f59e0b' }) : EMPTY);
    this.app.setData('pickSide', EMPTY);
    this.app.setData('pickArea', area ? fc(g) : EMPTY);
    this.app.setData('pickRing', g && !line && !area ? fc({ type: 'Point', coordinates: g.type === 'Point' ? g.coordinates : this.cards.current.key }) : EMPTY);
  }
  // Paddle from here, on the water's card: a new route over the water from the spot
  paddleFrom(ll) {
    this.cards.close();
    this.setActive(true, { edit: true });
    this.setMode('water');
    this.clear();
    this.addPoint(ll);
    toast('Now click where you want to go');
  }
  // A desktop's hover (#574): the way under the pointer drawn plainly, while no pick of its own is shown
  hoverPick(coords) {
    if (this.picked || this.cards.current) return;
    this.app.setData('pick', coords ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { color: '#374151' }, geometry: { type: 'LineString', coordinates: coords } }] } : EMPTY);
  }
  // The line at the spot (#574): a phone's tap while browsing shows what it picked, with a pin at the spot; a tap on the
  // line opens its card, and a tap elsewhere, Escape or the next pick takes it away
  showLine(card) {
    this.hideLine();
    this.picked = card;
    this.line = pickLine(card, () => this.openLine());
    this.lineMk = new maplibregl.Marker({ element: this.line.el, anchor: 'bottom', offset: [0, -22] }).setLngLat(card.spot.ll).addTo(this.map);
    this.linePin = new maplibregl.Marker({ element: h('div', { class: 'card-pin', 'aria-hidden': 'true' }) }).setLngLat(card.spot.ll).addTo(this.map);
    this.drawPick(card.pick);
  }
  renderLine() { if (this.line) this.line.update(); }
  // keep: its card is opening, so the pick stays
  hideLine({ keep = false } = {}) {
    const c = this.picked;
    if (!c) return false;
    this.picked = this.line = null;
    this.lineMk.remove();
    this.linePin.remove();
    if (!keep) c.gone();
    return true;
  }
  openLine() {
    const c = this.picked;
    this.hideLine({ keep: true });
    this.openCard(c, c.spot.ll);
  }
  // A place's card (part 5) [p-place]: its own icon, its name and kind, where it comes from, its facts as plain lines
  openPlaceCard(f, ll, { from = 'map', pin = false } = {}) {
    const p = f.properties, id = f.layer.id, at = f.geometry && f.geometry.type === 'Point' ? f.geometry.coordinates.map((x) => +x.toFixed(6)) : ll;
    const kind = id === 'label-peak' ? 'peak' : p.subclass || p.class || '', words = (s) => { const t = String(s).replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
    const o = /^td-/.test(id) ? obstacleText(p, groupOf(this.app.activity()) === 'bike') : null;
    const spot = id === 'lipas-point' ? { title: p.name, line: [p.typeName, p.city].filter(Boolean).join(', '), src: 'From LIPAS', image: p.icon ? `lipas-${p.icon}` : null, lipas: p }
      : o ? { title: o.title, line: o.note, src: 'From OpenStreetMap', image: `td-${p.kind}`, osm: { type: p.kind ? 'node' : 'way', id: p.osm || null } }
        : { title: p.name || words(kind || 'place'), line: p.name && kind ? words(kind) : '', src: 'From OpenStreetMap', osm: { type: 'place', id: null } };
    this.openCard(spotCard(this, { ...spot, ll: at, pin, kind, place: true, tags: p }), at, from);
  }
  // A LIPAS route's card (part 6): Follow it, add it to your route, the trail under it, What's here
  openLipasCard(props, ll, { click = null, near = null } = {}) {
    const at = Array.isArray(ll) ? ll : [ll.lng, ll.lat];
    const p = this.map.project(at), under = click ? this.map.queryRenderedFeatures(hitBox(p, false), { layers: inspectLayers(this.map) }).some((x) => /^(path|track|cycleway)-|^road-/.test(x.layer.id)) : false;
    this.openCard(lipasCard(this, props, at, { click, near, under }), at);
  }
  openCard(card, at, from = 'map') {
    if (this.menu) this.menu.remove();
    this.stopPicking();
    this.cards.open(card, { at, from });
  }

  // How far a spot is from the route's line, and the leg it's nearest ({ li, d }), or null with no legs
  nearLine(ll) {
    let best = null;
    this.legs.forEach((l, k) => {
      const c = l.result ? l.result.coords : [this.points[k], this.points[k + 1]];
      for (let j = 1; j < c.length; j++) { const d = pointSegment(ll, c[j - 1], c[j]).d; if (!best || d < best.d) best = { li: k, d }; }
    });
    return best;
  }
  byTheLine(ll) { const n = this.nearLine(ll); return !!n && n.d <= NEAR_LINE; }
  // Where a new point fits best: after the point it follows, where it adds the least distance, between two points or
  // after the end, never before the start (straight-line distances). { after }
  bestInsert(ll) {
    const P = this.points, n = P.length;
    let after = n - 1, cost = n ? dist(P[n - 1], ll) : 0;
    for (let k = 0; k < n - 1; k++) { const c = dist(P[k], ll) + dist(ll, P[k + 1]) - dist(P[k], P[k + 1]); if (c < cost) { cost = c; after = k; } }
    return { after };
  }
  // Share on a card (part 6b) [p-shared]: a phone opens its share sheet with a link to the spot, its name and its
  // coordinates; elsewhere the link is copied and the note says so
  async shareSpot(spot) {
    const name = spot.title === 'This spot' ? '' : spot.title, z = Math.max(13, Math.min(17, Math.round(this.map.getZoom())));
    const url = spotUrl(spot.ll, name, z), at = `${spot.ll[1].toFixed(5)}, ${spot.ll[0].toFixed(5)}`;
    if (navigator.share) {
      try { await navigator.share({ title: name || 'A spot on Polku', text: `${name ? `${name}, ` : ''}${at}`, url }); } catch { /* it was closed */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); toast('Link to this spot copied'); } catch { prompt('Copy this link', url); }
  }
  // Weather here › (part 6b): the timeline, held at the spot
  weatherHere(ll) {
    this.cards.close();
    this.app.weatherHere(ll);
  }

  // + Add to my route (part 5) [p-added]: by the line (30 m) a point on it, as Add a point here (no call); else where it
  // fits (bestInsert()), its two new legs routed. One step of Undo; the note names the point it follows.
  addWhereItFits(ll) {
    this.cards.close();
    if (!this.active || !this.editing) this.setActive(true, { edit: true });
    const near = this.nearLine(ll), on = near && near.d <= NEAR_LINE, k = on ? near.li : this.bestInsert(ll).after;
    const name = this.nameOf(k);
    if (on) this.insertPoint(k, ll);
    else if (k >= this.points.length - 1) this.addPoint(ll);
    else this.insertPoint(k, ll, { exact: true });
    toast(`Added after ${name}`, { ms: 7000, action: { label: 'Undo', fn: () => this.undo() } });
  }
  // + Start a route here, with no route: its first point, drawing
  startRouteAt(ll) {
    this.cards.close();
    this.setActive(true, { edit: true });
    this.addPoint(ll);
    this.autoPeek();
  }
  // Start here on a spot: a new start before the old one, which is Via 1 now; nothing is removed
  startFrom(ll) {
    this.cards.close();
    if (!this.active || !this.editing) this.setActive(true, { edit: true });
    this.commit();
    this.points.unshift(ll);
    this.legs.unshift({ mode: this.mode, sport: this.legs[0] ? this.legs[0].sport : this.next || undefined });
    this.update();
    toast('A new start is added', { ms: 7000, action: { label: 'Undo', fn: () => this.undo() } });
  }
  // End here on a spot: a new end after the old one
  endAt(ll) {
    if (!this.active || !this.editing) this.setActive(true, { edit: true });
    this.addPoint(ll);
  }

  // A point's card (25d, #345, Revision 4 of #355): built in js/cards.js. `p` is the point itself, not its index: the
  // card follows it through a move, Undo and a new order, and closes when it's gone. From the map there's no Back.
  openPointCard(p, { from = 'map', el = null } = {}) {
    if (!this.points.includes(p)) return;
    if (this.menu) this.menu.remove();
    this.stopPicking();
    const beside = this.besideRow(el);
    if (beside) this.focusPoint(this.points.indexOf(p)); // (from the list: the point in sight, the card at its row)
    this.cards.open(pointCard(this, p), { at: p, beside, from });
  }
  // a desktop's card from the list (part 4): beside the panel, level with its row; elsewhere null (at its place)
  besideRow(el) {
    if (!el || this.cards.where() !== 'float' || this.layout() !== 'side' || !this.active) return null;
    const panel = this.panel.getBoundingClientRect();
    return { right: panel.right + 4, top: el.getBoundingClientRect().top };
  }

  // who point p is: a number that stays with it through a move (editTo()), Undo and Redo (snapshot(), restoreSnap())
  pidOf(p) {
    let id = this.pid.get(p);
    if (id == null) { id = ++this.pidN; this.pid.set(p, id); }
    return id;
  }
  // is the card's point still on the route? After a move, Undo or Redo it's another array: the one that's the same point
  findPoint(card) {
    if (this.points.includes(card.key)) return true;
    const id = this.pid.get(card.key), p = id != null && this.points.find((q) => this.pid.get(q) === id);
    if (!p) return false;
    card.key = p;
    return true;
  }
  // the analysis is of the route as it is now: made after its last routing (routeAll()'s `gen`), and no leg's request on
  // its way. A leg that couldn't be routed, or waits for the router, counts with its straight stand-in, as the list's
  // numbers do. (Not by comparing lengths: a routed leg may start a few metres from its point, #352's review.)
  analysisFits() {
    const a = this.analysis;
    return !!a && a.gen === this.gen && this.legs.every((l) => l.status !== 'loading' && l.result);
  }

  // Move: the card gives way to "Tap where it goes"; the next tap on the map moves the point there (Cancel, Escape: it stays)
  async moveOnCard(card) {
    const ll = await this.pickOnMap(`${this.coarse() ? 'Tap' : 'Click'} where it goes`);
    const i = this.points.indexOf(card.key);
    if (ll && i >= 0) this.movePoint(i, ll);
  }

  // A spot on the map, asked for by a card: it folds to `text` with Cancel, and the next tap answers (null: cancelled)
  pickOnMap(text) {
    this.stopPicking();
    return new Promise((resolve) => {
      const pick = {
        done: (ll) => {
          if (this.picking !== pick) return;
          this.picking = null;
          this.map.getCanvas().style.cursor = this.active && !this.inView() ? 'crosshair' : '';
          resolve(ll);
          // the card unfolds once the answer has been used (the point moved), so it opens where the point is now
          if (ll) setTimeout(() => this.cards.unfold(), 0); else this.cards.unfold();
        },
      };
      this.picking = pick;
      this.map.getCanvas().style.cursor = 'crosshair';
      this.cards.fold(text, () => pick.done(null));
    });
  }
  stopPicking() { if (this.picking) this.picking.done(null); }

  // Remove, with Undo in its note
  removeOnCard(card) {
    const i = this.points.indexOf(card.key);
    if (i < 0) return;
    const name = this.nameOf(i);
    this.removePoint(i);
    toast(`${name} removed`, { ms: 7000, action: { label: 'Undo', fn: () => this.undo() } });
  }

  // point i moved to a place to sleep, named after it (its legs are routed again)
  moveToStay(i, x) {
    if (!this.points[i]) return;
    this.beginEdit(i, this.snapshot());
    this.editTo(x.at.slice());
    this.pname.set(this.points[i], x.name);
    this.endEdit();
  }

  // "Stop here" on the line: a point there with a break, and its menu to make it a night
  stopHere(li, ll) {
    if (!this.legs[li]) return;
    this.commit();
    const k = this.splitLeg(li, ll);
    this.pstop.set(this.points[k], { min: DEFAULT_BREAK });
    this.update();
    this.openPointCard(this.points[k]);
  }

  // At a changeover out of a bike or a boat, what's left there unless it's taken along ("the bike"); null: nothing
  gearAt(i) {
    const c = this.changeAt(i), g = c && GEAR[c.from];
    if (!g || GEAR[c.to] === g) return null;
    return g === 'bike' ? 'the bike' : `the ${(CRAFT[this.craft] || CRAFT.kayak).label.toLowerCase()}`;
  }

  // Heads-up from the stops: gear left behind, and a night too short to sleep
  stopWarnings(a) {
    const out = [], src = { kind: 'calculated', by: 'your stops and times' };
    const sports = this.legs.map((_, i) => this.legSport(i));
    if (new Set(sports).size > 1) {
      for (const w of gearChecks({ sports, points: this.points, carry: (i) => this.carryAt(i), along: (i) => this.lengthTo(i), name: (i) => this.nameOf(i), label: (g) => this.gearLabel(g) })) {
        out.push({ at: w.at, len: 0, kind: 'gear', ic: w.gear === 'bike' ? 'bike' : 'paddle', noAvoid: true, text: w.text, note: w.note, tier: 'look', src });
      }
    }
    for (const w of a.waits || []) {
      if (!isNight(w.stop) || w.rest >= 5 * 3600) continue;
      out.push({ at: w.at, len: 0, kind: 'dark', hide: 'Short night', ic: 'moon', noAvoid: true, text: `A short night at ${this.nameOf(w.i)}: ${fmtDuration(w.rest)}`, note: `you’d get there ${this.clockOf(w.arrive)} and go on at ${hhmm(w.stop.on)}`, tier: 'look', src });
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
    const nights = (a.waits || []).filter((w) => isNight(w.stop));
    return h('div', { class: 'days' }, ...days.map((d, k) => {
      const wx = dayWeather(a.wind, a, d.i0, d.i1);
      const t = wx && (Math.round(wx.tMin) === Math.round(wx.tMax) ? `${Math.round(wx.tMin)} °C` : `${Math.round(wx.tMin)}…${Math.round(wx.tMax)} °C`);
      const weather = wx && wx.none ? 'no forecast yet' : wx ? [t, `wind up to ${Math.round(wx.wind)} m/s`, wx.wetM > 0 ? `rain on ${fmtDist(wx.wetM)}` : 'dry', wx.beyond ? 'past the forecast' : wx.unsure ? 'less certain' : ''].filter(Boolean).join(' · ') : '';
      const night = nights[k];
      return h('button', { type: 'button', class: 'day', title: 'Show this day on the profile and the map', onclick: () => this.focusRange(d.i0, d.i1, null) },
        h('b', {}, `Day ${d.n}`), h('span', { class: 'day-when' }, `${date(d.t0)} · ${time(d.t0)}–${time(d.t1)}`),
        h('span', { class: 'day-what' }, `${fmtDist(d.to - d.from)} · ${fmtDuration(d.moving)} moving${d.up >= 20 ? ` · ↑${Math.round(d.up)} m` : ''}${night ? ` · night at ${this.nameOf(night.i)}` : ''}`),
        weather ? h('span', { class: 'day-wx' }, weather) : null);
    }));
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
      spots: this.points.map((p) => this.pspot.get(p) || null),
      sports: this.legs.map((l) => l.sport || null),
      style: encodeStyle(this.app.activity(), this.styleOf(this.app.activity())),
      styles: this.otherStyles(), // the route's style for its other sports (#71); none in older saved routes
      legStyles: this.legs.map((l, i) => (l.style ? encodeStyle(this.legSport(i), l.style) || 'balanced' : null)),
      modes: this.legs.map((l) => l.mode),
      alts: this.legs.map((l) => l.alt || 0), // another way picked (#95)
      ice: this.legs.map((l) => !!l.ice), // straight onto the ice (the water note in winter); none in older saved routes
      fixed: this.legs.map((l) => (l.mode === 'fixed' && l.result ? encodePolyline(l.result.coords) : null)),
      src: this.legs.map((l) => (l.mode === 'fixed' && l.src) || null),
      routed: this.legs.map((l) => (l.mode !== 'fixed' && l.status === 'ok' && l.key && l.result
        ? { key: l.key, line: encodePolyline(l.result.coords), tags: l.result.tags.map(tagId), portage: l.result.portage || [], provider: l.result.provider, water: l.result.water ? { ...l.result.water, times: undefined } : undefined } : null)),
      tags: table,
      read: [...this.readKeys], // Check's items marked read: on this device only, not in share links; none in older saved routes
      leave: this.leaveAt, // when you leave (#364), null: now
    });
  }

  loadSaved() {
    const r = store.get('route', null);
    if (r && r.nogos) { this.nogos = r.nogos; this.drawNogos(); }
    if (!r || !r.points || !r.points.length) return false;
    this.points = r.points;
    this.readKeys = new Set(r.read || []);
    this.nameAll(r.names);
    this.changeAll(r.changes);
    this.stopAll(r.stops);
    this.carryAll(r.carry);
    this.spotAll(r.spots);
    this.readStyles(this.app.activity(), r.style, r.styles);
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
    (r.alts || []).forEach((k, i) => { if (k > 0 && k <= 3 && this.legs[i] && this.legs[i].mode === 'auto') this.legs[i].alt = k; });
    (r.ice || []).forEach((on, i) => { if (on && this.legs[i] && this.legs[i].mode === 'line') this.legs[i].ice = true; });
    this.openLeave(r.leave);
    this.nextFromLast();
    this.update();
    return true;
  }

  // A route opened (saved, saved offline, a link) leaves when it was planned to; one whose time has passed leaves now,
  // saying when it was planned for
  openLeave(sec) {
    const ahead = sec > Date.now() / 1000;
    this.leaveAt = ahead ? sec : null;
    this.leavePassed = sec && !ahead ? sec : null;
    this.renderLeave();
    if (this.app.onStartChange) this.app.onStartChange(this.leaveHour());
    this.expireLeave();
  }

  // A planned departure that passes while Polku stays open leaves now, saying when it was planned for, as a reload
  // says: on a timer, when the page is shown again, and before a link or a file is made (the review of #475)
  expireLeave() {
    clearTimeout(this.leaveTimer);
    if (this.leaveAt == null) return;
    const left = this.leaveAt - Date.now() / 1000;
    if (left > 0) { this.leaveTimer = setTimeout(() => this.expireLeave(), Math.min(left * 1000 + 500, 864e5)); return; }
    const was = this.leaveAt;
    this.setLeave(null);
    this.leavePassed = was;
    this.renderLeave();
  }

  // the route's style for each sport but the map's (whose is `style`, as before), as codes
  otherStyles() {
    const map = this.app.activity();
    return Object.fromEntries(Object.entries(this.styles).filter(([sp, st]) => sp !== map && st && ACTIVITIES[sp]).map(([sp, st]) => [sp, encodeStyle(sp, st) || 'balanced']));
  }
  readStyles(map, style, others) {
    this.styles = {};
    if (style != null) this.styles[map] = decodeStyle(map, style);
    for (const [sp, code] of Object.entries(others || {})) if (sp !== map && ACTIVITIES[sp] && code) this.styles[sp] = decodeStyle(sp, code);
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
      spots: this.points.map((p) => this.pspot.get(p) || null),
      style: encodeStyle(this.app.activity(), this.styleOf(this.app.activity())),
      styles: this.otherStyles(),
      legStyles: this.legs.map((l, i) => (l.style ? encodeStyle(this.legSport(i), l.style) || 'balanced' : null)),
      nogos: this.nogos,
      legs: this.legs.map((l) => ({ mode: l.mode, key: l.key, src: l.src || null, sport: l.sport || null, alt: l.alt || 0, ice: !!l.ice, result: l.status === 'ok' || l.mode === 'fixed' ? l.result : null })),
      leave: this.leaveAt,
    };
  }

  restoreSnapshot(s) {
    const had = this.points.length > 0;
    if (had) { this.commit(); this.past[this.past.length - 1].leave = this.leaveAt ?? this.leavePassed; } // (Undo brings back the route you had, leaving when it did)
    this.points = s.points;
    this.freshRead(had);
    this.nameAll(s.names);
    this.changeAll(s.changes);
    this.stopAll(s.stops);
    this.carryAll(s.carry);
    this.spotAll(s.spots);
    this.nogos = s.nogos || [];
    this.routeName = s.routeName || '';
    this.readStyles(s.activity || this.app.activity(), s.style, s.styles);
    this.legs = s.legs.map((l, i) => {
      const sport = l.sport && ACTIVITIES[l.sport] ? l.sport : undefined;
      const style = s.legStyles && s.legStyles[i] ? decodeStyle(sport || s.activity || this.app.activity(), s.legStyles[i]) : null;
      const alt = l.mode === 'auto' && l.alt > 0 && l.alt <= 3 ? l.alt : 0, ice = l.mode === 'line' && !!l.ice;
      return l.result ? { mode: l.mode, key: l.key, status: 'ok', result: l.result, style, src: l.src || null, sport, alt, ice } : { mode: l.mode === 'fixed' ? 'auto' : l.mode, style, sport, alt, ice };
    });
    this.openLeave(s.leave);
    this.nextFromLast();
    this.update();
  }

  offlinePayload() {
    const a = this.analysis;
    if (!a || this.legs.some((l) => !l.result)) return null;
    const line = this.mergedLine().coords;
    const b = bbox(line);
    const name = this.routeName || `${ACTIVITIES[this.mainSport()].label} ${fmtDist(a.total)} · ${new Date().toLocaleDateString()}`;
    return { name, line, bbox: b, km: a.total / 1000, route: this.routeSnapshot() };
  }

  shareUrl() {
    this.expireLeave();
    const u = new URL(location.href);
    u.search = '';
    u.hash = ''; // the map's view isn't shared (the link fits the route): while it follows you, it's where you are
    u.searchParams.set('r', encodePolyline(this.points));
    u.searchParams.set('m', this.legs.map((l) => MODE_CODE[l.mode]).join(''));
    u.searchParams.set('a', this.app.activity());
    // the style shapes the line, so it travels with it (left out when it's the default)
    const sport = this.app.activity();
    const p = encodeStyle(sport, this.styleOf(sport));
    if (p) u.searchParams.set('p', p);
    // a leg in another sport than the map's travels with the route's style for it as its own (#71): the link stays as it was
    const legStyle = (l, i) => l.style || (this.legSport(i) !== sport && this.styles[this.legSport(i)]) || null;
    const ps = this.legs.map((l, i) => (legStyle(l, i) ? `${i}:${encodeStyle(this.legSport(i), legStyle(l, i)) || 'balanced'}` : '')).filter(Boolean).join(',');
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
    // places to avoid, so whoever opens it is routed around them too
    if (this.nogos.length) u.searchParams.set('av', encodeAvoid(this.nogos));
    // another way picked for a leg (#95): BRouter's alternative k; older links take the first
    const al = this.legs.map((l, i) => (l.mode === 'auto' && l.alt ? `${i}:${l.alt}` : '')).filter(Boolean).join(',');
    if (al) u.searchParams.set('al', al);
    // legs straight onto the ice, so whoever opens it is told Polku can't see the ice; older links have none
    const ic = this.legs.map((l, i) => (l.mode === 'line' && l.ice ? String(i) : '')).filter(Boolean).join(',');
    if (ic) u.searchParams.set('ic', ic);
    // when you leave, in minutes since 1970 (#364's C); older links have none, and leave now
    if (this.leaveAt != null) u.searchParams.set('lv', String(Math.round(this.leaveAt / 60)));
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
    this.expireLeave();
    const a = this.analysis;
    if (!a) { toast('Nothing to export yet'); return; }
    const name = this.routeName || `Polku ${ACTIVITIES[this.mainSport()].label} ${new Date().toISOString().slice(0, 10)}`;
    // Export the routed geometry (not the 10 m resampling) with DEM elevations.
    const line = this.mergedLine();
    download(`${name.replace(/[^\w\- ]+/g, '').trim() || 'route'}.gpx`, toGPX({ name, coords: line.coords, ele: sampleEle(a, line.coords), waypoints: this.points, names: this.points.map((_, i) => this.nameOf(i)), descs: this.plannedTimes() }));
  }

  // Each point's planned times in words, for GPX's waypoints (#364's C): "Leave Sat 31 Oct, 07:30", "There at 09:12",
  // "There at 18:40. Night, go on Sun 1 Nov, 07:00". None go on the track's points: apps such as Strava read a GPX with
  // times as a recorded activity. Leave is the moment the route is timed from, as in arriveAt(): leaving now, when the
  // forecast came, not the export's minute (#506)
  plannedTimes() {
    const a = this.analysis, start = a && a.wind ? a.wind.startSec : this.startSec(), waits = (a && a.waits) || [];
    const at = (sec) => (new Date(sec * 1000).toDateString() === new Date(start * 1000).toDateString() ? this.timeOf(sec) : `${this.dayOf(sec)}, ${this.timeOf(sec)}`);
    return this.points.map((_, i) => {
      if (i === 0) return `Leave ${this.dayOf(start)}, ${this.timeOf(start)}`;
      const arrive = this.arriveAt(i), w = waits.find((x) => x.i === i && x.stop), go = w && w.arrive + w.sec;
      return [arrive != null ? `There at ${at(arrive)}` : '', w ? (isNight(w.stop) ? `${nightsWord(w.stop)}, go on ${this.dayOf(go)}, ${this.timeOf(go)}` : `Stop ${w.stop.min} min, go on at ${at(go)}`) : ''].filter(Boolean).join('. ');
    });
  }

  // ---------------------------------------------------------------- panel
  // One panel, two layouts: a side panel on wide screens (open / folded down to its line) and
  // a bottom sheet elsewhere (folded / peek / profile / half / full). The summary row — distance,
  // time, ascent, routing mode, undo — is always visible; the rest scrolls in
  // collapsible sections whose open state is remembered.
  buildPanel() {
    const p = this.panel;
    p.innerHTML = '';
    const tool = (name, label, fn, cls = '') => h('button', { type: 'button', class: `tool ${cls}`, title: label, 'aria-label': label, onclick: fn, html: icon(name, 19) });
    this.els = {};
    this.sec = {};
    this.els.sum = h('div', { class: 'sheet-sum', 'aria-live': 'polite' });
    // ⌄ folds the planner, or the card it holds, down to one line (step 3 of #233, Fold, then away): in the header row on
    // desktops (the side panel's line at the foot of its side, a bottom panel's at its own), in a row of its own on phones
    // (from the keyboard, a click with no pointer, at once: nothing animates for it)
    // With a mouse or trackpad ⌃ beside it, and each moves one size (A of the sheet's stops, #233; renderFold() says so)
    this.arrowsMQ = matchMedia('(hover: hover) and (pointer: fine)');
    const lower = (e) => (this.arrowsMQ.matches && this.layout() === 'sheet' && this.cards.place !== 'peek' ? this.stepSheet(-1, !e.detail) : this.fold({ instant: !e.detail }));
    this.els.min = tool('chevronDown', 'Fold the planner down to a line', lower, 'sheet-min');
    this.els.foldBtn = tool('chevronDown', 'Fold the planner to a line', lower, 'sheet-fold');
    this.els.upMin = tool('chevronUp', 'Raise the planner one size', (e) => this.stepSheet(1, !e.detail), 'sheet-up-min');
    this.els.up = tool('chevronUp', 'Raise the planner one size', (e) => this.stepSheet(1, !e.detail), 'sheet-up');
    // folded: the line, one button that opens it as it was, and ✕ at its end
    this.els.foldGo = h('button', { type: 'button', class: 'fold-go', onclick: (e) => this.unfold({ instant: !e.detail }), onkeydown: (e) => { if (e.key === 'ArrowUp') { e.preventDefault(); this.unfold({ instant: true }); } } });
    this.els.foldX = tool('close', 'Put the planner away: your route stays', () => this.foldAway(), 'fold-x');
    this.els.fold = h('div', { class: 'fold-line' }, this.els.foldGo, this.els.foldX);
    this.els.topSum = h('div', { class: 'top-sum', 'aria-hidden': 'true' }); // (D: the numbers in the top row, renderTopSum())
    this.els.dockBtn = tool('panelBottom', 'Move to the bottom', () => this.setDock(this.layout() === 'side' ? 'bottom' : 'left'), 'sheet-dock');
    this.els.handle = h('button', { type: 'button', class: 'sheet-handle', 'aria-label': 'Planner size: drag, or press to change', 'aria-controls': 'planner' });
    // The header shows the route: its numbers, and on phones Done at their right, at the thumb (25a), Edit in the
    // route's view (25c), whose name and ✕ are a row above them (renderTitle()). How the next leg is drawn, undo,
    // redo and More are in the toolbox (buildTools()). Before there's a route, and while a round trip is open,
    // it holds the start instead (renderStart(), A with 25b).
    this.els.done = h('button', { type: 'button', class: 'btn done', title: 'Done editing (E): the route stays open to read and take along', onclick: () => this.done() }, 'Done');
    this.els.edit = h('button', { type: 'button', class: 'btn done edit', title: 'Edit the route (E)', onclick: () => this.setEditing(true), hidden: true }, 'Edit');
    // (wider screens: ✕ at the header row's end while editing, as the mock-up of step 3 has it; the route's view has its own)
    this.els.row = h('div', { class: 'sheet-row' }, this.els.sum, this.els.dockBtn, this.els.upMin, this.els.min, this.els.done, this.els.edit, this.closeX());
    this.els.titleName = h('b');
    this.els.titleSub = h('small');
    this.els.title = h('div', { class: 'pl-title', hidden: true }, h('h2', { class: 'pl-ttl' }, this.els.titleName, this.els.titleSub), this.closeX());
    this.els.said = h('span', { class: 'sr-only', role: 'status' }); // Done and Edit, said
    this.els.way = this.els.loopBox = h('div', { class: 'pl-way', role: 'region', 'aria-label': 'Start a route', hidden: true });
    this.els.card = h('div', { class: 'card-peek', hidden: true });
    // the peek's row: what to read before you go, and what wasn't checked (25d part 3)
    this.els.readRow = h('div', { class: 'warn-row pl-readrow', hidden: true });
    // key facts (#471's A2): what stands out on this route, under its numbers
    this.els.facts = h('div', { class: 'kf', role: 'group', 'aria-label': 'Key facts', hidden: true });
    this.els.head = h('div', { class: 'sheet-head' }, h('div', { class: 'sheet-head-in' }, this.els.card, this.els.title, this.els.readRow, this.els.row, this.els.facts, this.els.way), this.els.said);
    // One card at a time for a point (and, in later parts, the route, a warning, a spot): in the peek on a phone, the
    // planner put away too, at its spot elsewhere (js/card.js, 25d)
    this.cards = new CardHost(this.map, {
      peek: this.els.card,
      where: () => (this.layout() === 'sheet' && !this.sideMQ.matches ? 'peek' : 'float'),
      onChange: (card, fresh) => {
        this.panel.classList.toggle('carded', !!card && this.cards.place === 'peek');
        // the planner put away: the sheet comes for the card alone, and goes with it (#570)
        if (!this.active) {
          this.showSheet(this.cards.place === 'peek');
          if (this.cards.place !== 'peek') { delete document.body.dataset.sheet; delete document.body.dataset.pl; }
        }
        // leaving, the sheet keeps the card it had until it has gone, taking no taps (showSheet() clears it): not the
        // planner's numbers under it
        if (!card && this.cardSeen && this.panel.classList.contains('leaving')) {
          this.cardSeen.inert = true;
          this.els.card.replaceChildren(this.cardSeen);
          this.els.card.hidden = false;
          this.panel.classList.add('carded');
        }
        this.cardSeen = this.cards.place === 'peek' ? this.cards.box : null;
        // a card opens at its own size; tapped on the map while the sheet is folded, it opens folded (its line), so the map
        // stays (step 3 of #233); with the planner put away, at its own size whatever size the planner had
        const st = this.panel.dataset.state, entry = this.cards.stack[this.cards.stack.length - 1];
        if (card && fresh && this.cards.place === 'peek' && (!this.active || (st !== 'peek' && !(st === 'folded' && entry.from === 'map')))) this.setSheetState('peek', { remember: false });
        // (opened on the line, the line opens it at its own size: the planner's comes back with the planner, restore())
        else if (card && fresh && this.cards.place === 'peek' && st === 'folded') this.unfoldTo = null;
        // the card's point ringed on the map, while its card (or Move's banner) is open
        const ringed = card && card.key && this.points.includes(card.key) ? card.key : null;
        this.markers.forEach((m, k) => { const el = m.getElement(); if (this.points[k] === ringed) el.dataset.card = ''; else delete el.dataset.card; });
        // …and its row in the list lit, where the card leaves it in sight (desktops)
        this.litRows();
        // an item's card (25d part 3): its row or box in Check lit; closed, its stretch on the route unlit
        const key = card && card.kind === 'item' ? card.itemKey : null;
        for (const r of this.els.warnings.querySelectorAll('[data-key]')) { if (r.dataset.key === key) r.setAttribute('aria-current', 'true'); else r.removeAttribute('aria-current'); }
        if (!key && this.itemLit) this.unlightItem();
        // a stretch's cards (the route's, the stretch's, Edit this stretch and its steps): the stretch lit, end to end (1b)
        this.lightStretch(card && card.kind !== 'item' ? card.lit || card.stretch || card.s || null : null);
        if (key !== this.headsOpen) { this.headsOpen = key; this.drawHeads(); } // (the open one ringed, Worth a look's shown)
        this.renderTools(); // undo and redo stay while a card is open; the rest of the toolbox steps aside (phones)
        this.renderFold();
        this.measureSheet?.();
      },
      onPop: () => this.keepView(),
      pad: () => { const v = this.viewPadding(0); return { left: this.layout() === 'side' && this.active ? v.left : 0, bottom: v.bottom }; },
      // Back and ✕ leave the planner as it was before the card: its sheet's size, its list's scroll
      keep: () => ({ sheet: this.panel.dataset.state, scroll: this.listScroller().scrollTop, unfoldTo: this.unfoldTo }),
      restore: (was) => {
        if (!this.active) return;
        if (this.layout() === 'sheet' && was.sheet && was.sheet !== this.panel.dataset.state) this.setSheetState(was.sheet, { remember: false });
        this.unfoldTo = was.unfoldTo; // (its line opens to the size it left, not to a card's)
        requestAnimationFrame(() => { this.listScroller().scrollTop = was.scroll; });
      },
      // a narrow card (200 %) has undo and redo in its top row, as 25a docks the toolbox
      dock: () => (this.active && this.layout() === 'sheet' && !this.sideMQ.matches && !this.inView()
        ? { undo: () => this.undo(), redo: () => this.redo(), canUndo: !!this.past.length, canRedo: !!this.future.length } : null),
    });
    this.buildTools();
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
    this.els.dock = h('div', { class: 'dock' }); // (the timeline stays over the map while planning: #225)

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
    }, h('span', { html: icon(t.icon, 15), 'aria-hidden': 'true' }), t.label, h('span', { class: 'pl-tab-n' }), h('span', { class: 'pl-tab-unk', hidden: true, 'aria-hidden': 'true' }, '?'), h('span', { class: 'pl-tab-t' })))));
    const pane = (id, ...kids) => h('div', { class: 'pl-pane sheet-cols', role: 'tabpanel', id: `pl-pane-${id}`, 'aria-labelledby': `pl-tab-${id}`, 'data-tab': id }, ...kids);
    // the marks on the map: Layers' Your route group shows them while a route is drawn (#424's C) [tabs-c-layers]
    this.els.onMap = h('div', { class: 'onmap' });
    this.els.speedWrap = h('div', { class: 'speed-wrap' }, h('h4', { class: 'how-h' }, 'Your speed', h('small', {}, 'how fast the time is counted')), this.els.speedBox = h('div', { class: 'speed-box' }));
    this.els.panes = {
      route: pane('route',
        // How you go › and Your speed ›, each a step of its own with Back to Route (#424's C) [tabs-c-route, tabs-c-how, tabs-c-speed]
        this.els.howRows = h('div', { class: 'rows how-rows' }),
        this.els.stepHead = h('div', { class: 'step-head' }, h('button', { type: 'button', class: 'btn small quiet way-back', onclick: () => this.openStep(null), html: icon('chevronLeft', 18) }, h('span', {}, 'Route')),
          this.els.stepTitle = h('h3', {}), this.els.stepLine = h('p', {})),
        // the route's view (25c): the list and the map stay as they are, until Edit
        this.els.viewNote = h('div', { class: 'pl-viewnote', hidden: true },
          h('span', { html: icon('info', 18), 'aria-hidden': 'true' }), h('span', {}, 'You’re not editing: the list and the map stay as they are.'),
          h('button', { type: 'button', class: 'btn small', onclick: () => this.setEditing(true), html: `${icon('pencil', 16)}<span>Edit</span>` })),
        this.section('points', 'Waypoints', this.els.pointsTop = h('div', { class: 'wpl-top' }),
          this.els.points = h('ol', { class: 'wpl', 'aria-label': 'Waypoints, in order', onkeydown: (e) => this.listKeys(e) }), this.els.pointsFoot = h('div', { class: 'wpl-foot' })),
        // how you go: which ways the router prefers, and how fast the time is counted (shown in a start step's
        // Fine-tune too, the same elements: borrowHow())
        this.section('style', 'How you go', this.els.styleH = h('h4', { class: 'how-h' }, 'Route style', h('small', {}, 'which ways the router prefers')), this.els.styleBox = h('div', { class: 'style-box' }), this.els.speedWrap),
        this.els.hint),
      check: pane('check',
        this.els.checkEmpty = h('p', { class: 'note pl-empty' }, 'Draw a route to see what’s on the way: heads-up, climbs, the ground.'),
        this.els.stats,
        // the two short lists share a column in a wide panel
        h('div', { class: 'sec-stack' }, this.checksSection(), this.section('climbs', 'Climbs', this.els.climbs)),
        this.section('colours', 'On the route', this.els.colourPreviewStatus = h('span', { class: 'sr-only', id: 'colour-preview-status', role: 'status' }), this.els.breakdown)),
      go: pane('go',
        this.section('speed', 'Time',
          (this.els.leave = leaveBlock(this)).el,
          this.els.speedRoute = h('div', { class: 'speed-route' })),
        this.section('depart', 'Departure & weather', this.els.dock, this.els.wind),
        this.section('take', 'Take it along', this.els.take = h('div', { class: 'take-along' }))),
    };
    this.els.body = h('div', { class: 'sheet-body' }, this.els.panes.route, this.els.panes.check, this.els.panes.go);
    p.addEventListener('scroll', () => { // (the body's, or the sheet's where it scrolls as one)
      const owner = this.categoryPreview?.owner;
      if (!owner) return;
      const r = owner.getBoundingClientRect(), b = this.listScroller().getBoundingClientRect();
      if (owner !== document.activeElement || r.bottom <= b.top || r.top >= b.bottom) this.clearCategoryPreview();
    }, true);
    window.addEventListener('blur', () => this.clearCategoryPreview());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clearCategoryPreview(); });
    this.els.grip = h('div', { class: 'sheet-resize', role: 'separator', tabindex: '0', 'aria-orientation': 'vertical', 'aria-controls': 'planner',
      'aria-label': 'Planner width', title: 'Drag to resize · double-click: narrow ↔ wide' });
    this.els.top = h('div', { class: 'sheet-top' }, h('span'), this.els.handle, h('span', { class: 'sheet-top-end' }, this.els.up, this.els.foldBtn), this.els.topSum);
    this.els.bar = h('div', { class: 'route-bar', 'aria-hidden': 'true' }, h('i'));
    p.append(this.els.top, this.els.fold, this.els.head, this.els.profZone, this.els.tabs, this.els.body, this.els.bar);
    p.after(this.els.grip); // (beside the panel, not in it: the side panel scrolls as one, which would clip it and scroll it away)
    this.setTab(this.tab);
    this.els.leave.put();
    this.renderOnMap();
    this.renderTake();
    this.renderLoop();
    this.renderStyle();
    this.renderModeChips();
    this.bindSheet();
    this.bindResize();
  }

  // Check's groups (25d part 2): they lead the Check tab, with no header of their own and no fold
  checksSection() {
    const el = h('section', { class: 'sec checks', 'data-sec': 'warnings', 'aria-label': 'What’s on the way' }, this.els.warnings);
    this.sec.warnings = { el, head: null, titleEl: h('span'), count: h('span'), sum: h('span') };
    return el;
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
    if (id === 'colours' && !open) this.clearCategoryPreview();
    s.el.dataset.open = String(open);
    if (id === 'points') this.renderReadRow(); // (the list's warnings in sight or not)
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
  }

  // ---------------------------------------------------------------- the tabs (22a)
  // `user`: a tap on a tab, which opens a folded sheet at it
  setTab(id, { user = false } = {}) {
    if (!this.els.panes[id]) id = 'route';
    const changed = id !== this.tab;
    if (changed) this.clearCategoryPreview();
    this.tab = id;
    store.set('plannerTab', id);
    for (const t of TABS) {
      const on = t.id === id;
      this.els.tabBtn[t.id].setAttribute('aria-selected', String(on));
      this.els.tabBtn[t.id].tabIndex = on ? 0 : -1;
      this.els.panes[t.id].hidden = !on;
    }
    if (changed) this.listToTop();
    if (user) {
      const st = this.panel.dataset.state;
      if (this.layout() === 'sheet' && ['folded', 'peek'].includes(st)) this.setSheetState('half');
      else if (this.layout() === 'side' && st === 'folded') this.setSheetState('open');
    }
    this.renderOnRoute(); // (the row gone while Check is in sight; Worth a look's markers with it)
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
    const sw = (label, on, fn, disabled = false, line = '') => h('label', { class: `tg${disabled ? ' off' : ''}` },
      h('span', { class: 'tg-text' }, label, h('small', {}, line)), h('input', { type: 'checkbox', role: 'switch', checked: on, disabled, onchange: (e) => fn(e.target.checked) }), h('span', { class: 'tg-ui', 'aria-hidden': 'true' }));
    box.replaceChildren(
      sw('Distance marks', !!this.marks.km, (v) => this.setMarks({ km: v }), false, 'Every 1, 5, 10 or 25 km along the route, by its length'),
      sw('Arrival times at marks', !!this.marks.time, (v) => this.setMarks({ time: v }), !this.marks.km, 'The clock time you reach each mark'),
      sw('Elapsed time at marks', !!this.marks.duration, (v) => this.setMarks({ duration: v }), !this.marks.km, 'Hours, minutes and seconds from departure, including stops and changeovers'));
  }

  // Go › Take it along: the route as a file, a link, or the map saved for offline
  renderTake() {
    const box = this.els.take;
    if (!box) return;
    const b = (ic, label, title, fn) => h('button', { type: 'button', class: 'btn', title, onclick: fn, html: `${icon(ic, 16)} ${label}` });
    box.replaceChildren(
      b('download', 'Export GPX', 'The route as a GPX file, for a GPS device or another app', () => this.exportGpx()),
      h('button', { type: 'button', class: 'btn take-share', title: 'A link that opens this route in Polku', onclick: () => this.share(), html: icon('share', 16) },
        h('span', {}, 'Copy share link', this.shareSub() ? h('small', {}, this.shareSub()) : null)),
      b('offline', 'Save offline…', 'The map, terrain and this route on this device, for when there’s no signal', () => this.app.saveOffline()));
    this.setSection('take', { empty: this.points.length < 2 });
  }

  // The leg you open or point at in the waypoint list, lit up on the map and in the profile
  litLeg(i) {
    const leg = i == null ? null : this.legs[i];
    if (!leg) {
      // (what was picked stays lit: a climb, an item of Check, the stretch a card is about)
      const s = this.stretchLit && this.legs[this.stretchLit.from] ? this.stretchLit : null;
      if (s) this.showSpan(s);
      else if (this.focusLit) this.showLit(this.focusLit, this.legAt(this.focusHl[0]), this.legAt(this.focusHl[1]) + 1);
      else { this.litSpan = null; this.app.setData('routeLit', EMPTY); }
      if (this.chart) this.chart.setHighlight(s && this.analysis ? [this.lengthTo(s.from), this.lengthTo(s.to)] : this.focusHl || null);
      return;
    }
    this.showSpan({ from: i, to: i + 1 });
    if (this.chart && this.analysis) this.chart.setHighlight([this.lengthTo(i), this.lengthTo(i + 1)]);
  }
  // routeLit: `coords` over legs from…to−1, in their colour when they go the same way (style.js route-lit)
  showLit(coords, from, to) {
    this.litSpan = null;
    const modes = new Set(this.legs.slice(from, to).map(drawnMode));
    this.app.setData('routeLit', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: modes.size === 1 ? { mode: [...modes][0] } : {}, geometry: { type: 'LineString', coordinates: coords } }] });
  }
  // a leg or a stretch {from, to} lit, end to end: drawn again with the route (drawRoute), so it follows a new line
  showSpan(s) {
    this.showLit(this.stretchCoords(s), s.from, s.to);
    this.litSpan = { from: s.from, to: s.to };
  }
  stretchCoords(s) {
    return this.legs.slice(s.from, s.to).flatMap((l, k) => { const c = this.legLine(s.from + k); return k ? c.slice(1) : c; });
  }
  // leg i's line as the map draws it: while it's worked out, straight, or (while dragging) a route a moment behind the
  // pointer, joined to it
  legLine(i) {
    const leg = this.legs[i], from = this.points[i], to = this.points[i + 1];
    return !leg.result || leg.status === 'waiting' ? (leg.preview ? [from, ...leg.preview, to] : [from, to]) : leg.result.coords;
  }
  // back to the open leg (if one is open), else nothing lit
  unlitLeg() { this.litLeg(null); }
  // the stretch a card is about, lit on the map and the profile (null: none, back to what was lit before it)
  lightStretch(s) {
    const was = this.stretchLit;
    this.stretchLit = s ? { from: s.from, to: s.to } : null;
    if (s || was) this.litLeg(null);
  }

  // ---------------------------------------------------------------- the start (A with 25b, #233)
  // What the header shows before there's a route, and while a round trip is open: 'ways' the ways to begin;
  // 'draw' and 'find' a way picked; 'loop' the round trip; 'first' the first point's peek; null the route's numbers.
  startView() {
    if (!this.active) return null;
    if (this.loop.open) return 'loop';
    const n = this.points.length;
    if (!n) return this.way || 'ways';
    return n === 1 ? 'first' : null;
  }
  // the start's views that are the sheet's whole height on a phone (the peek): all but the first point's
  peekOnly() { const v = this.startView(); return !!v && v !== 'first'; }
  coarse() { return matchMedia('(pointer: coarse)').matches; }

  renderStart() {
    const box = this.els && this.els.way;
    if (!box) return;
    const view = this.startView();
    // a length being typed keeps its text
    if (view && view === box.dataset.view && box.contains(document.activeElement) && document.activeElement.matches('input')) return;
    const focus = box.contains(document.activeElement) || this.refocus ? this.refocus || document.activeElement.dataset.k : null;
    this.refocus = null;
    // the same view drawn again keeps where it was scrolled to, and its cards where they were
    const same = view && view === box.dataset.view, top = same ? box.scrollTop : 0, left = same ? box.querySelector('.loop-cards')?.scrollLeft || 0 : 0;
    this.returnHow();
    box.dataset.view = view || '';
    box.setAttribute('aria-label', { ways: 'Start a route', draw: 'Draw it', find: 'Marked routes', loop: 'Round trip', first: 'Your first point' }[view] || 'Start a route');
    box.hidden = !view;
    this.els.row.hidden = !!view;
    this.panel.classList.toggle('starting', !!view && !this.points.length); // no route yet: the start is all there is
    this.panel.classList.toggle('way-only', this.peekOnly());
    box.replaceChildren(...(view ? this[`${view}View`]().filter(Boolean) : []));
    if (top) box.scrollTop = top;
    if (left) box.querySelector('.loop-cards')?.scrollTo({ left });
    if (focus) (box.querySelector(`[data-k="${focus}"]`) || box.querySelector('.way-back'))?.focus({ preventScroll: true });
    this.renderFold(); // (⌄ only with a route to fold: Clear route takes it away)
    this.measureSheet?.(); // the peek is the view's height (its box may not change when the sheet holds it)
    if (this.peekOnly() && this.layout() === 'sheet' && this.panel.dataset.state !== 'peek') this.setSheetState('peek', { remember: false });
    this.renderTools(); // Done waits for the first point
  }

  // The sport at the start (decided with the user, 2026-10-21): a row of its own right under the top row in the ways
  // to begin and every step, so new people see it before the first point and it never moves: the drawing menu's
  // sport row, with the sport's line (and Paddle's craft). It opens the same menu as the top bar's pill (#245).
  sportRow() {
    const sp = this.app.activity(), label = ACTIVITIES[sp].label;
    const line = sp === 'paddle' ? `${(CRAFT[this.craft] || CRAFT.kayak).label} · ${ACTIVITIES[sp].line}` : ACTIVITIES[sp].line;
    const b = h('button', { type: 'button', class: 'row sport-chip sport-row', 'data-k': 'sport', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': `Sport: ${label}. ${line}`,
      html: `<span>${icon(this.sportIcon(sp), 20)}</span><span><b>${escapeHtml(label)}</b><small>${escapeHtml(line)}</small></span><span class="way-chev">${icon('chevronDown', 16)}</span>` });
    b.onclick = () => this.app.sportMenu && this.app.sportMenu(b);
    return b;
  }
  // a step's top row: Back on the left; on the right the panel's place (desktops) and ✕
  backRow(label = 'Ways to begin', fn = () => this.wayBack()) {
    return h('div', { class: 'way-bar' }, h('button', { type: 'button', class: 'btn small quiet way-back', 'data-k': 'back', onclick: fn, html: `${icon('chevronLeft', 18)}<span>${escapeHtml(label)}</span>` }), this.dockX(), this.closeX());
  }
  // ✕ closes the planner, as the other panels have it (decided 2026-10-21: it replaces the ways' Close and the first
  // point's Done, and is in every step too)
  closeX() {
    return h('button', { type: 'button', class: 'tool way-x', 'data-k': 'close', 'aria-label': 'Close the planner', title: 'Close the planner (R): your route stays', onclick: () => this.close(), html: icon('close', 20) });
  }
  // desktops: the header's button that moves the panel, here too (the header waits while the start shows)
  dockX() {
    if (!this.sideMQ.matches) return null;
    const side = this.layout() === 'side', label = side ? 'Move the planner to the bottom' : 'Move the planner to the left';
    return h('button', { type: 'button', class: 'tool way-x way-dock', 'data-k': 'dock', 'aria-label': label, title: label, onclick: () => this.setDock(this.layout() === 'side' ? 'bottom' : 'left'), html: icon(side ? 'panelBottom' : 'panelLeft', 19) });
  }

  // The four ways to begin, equal: phones two by two in the peek, desktops a row each. A tap on the map
  // starts drawing at once. Swim has no marked routes in LIPAS (#306).
  waysView() {
    const sp = this.app.activity(), desk = this.sideMQ.matches, tap = this.coarse() ? 'tap' : 'click';
    const way = (k, ic, title, line, fn) => h('button', { type: 'button', class: 'way-tile', 'data-way': k, 'data-k': `way-${k}`, onclick: fn },
      h('span', { class: 'way-ic', 'aria-hidden': 'true', html: icon(ic, 22) }), h('span', { class: 'way-t' }, h('b', {}, title), h('small', {}, line)),
      desk ? h('span', { class: 'way-chev', 'aria-hidden': 'true', html: icon('chevronRight', 16) }) : null);
    return [
      // the same top row as each step's: the title where a step has ‹ Ways to begin, ✕ on the right; then the sport
      h('div', { class: 'way-bar way-top' }, h('h2', { class: 'way-name' }, 'Start a route'), this.dockX(), this.closeX()),
      this.sportRow(),
      h('div', { class: 'way-tiles', role: 'group', 'aria-label': 'Ways to begin' }, ...[
        // (a tap on the map starts drawing at once: Draw it's line says so, 2026-10-21)
        way('draw', 'route', 'Draw it', `${tap === 'tap' ? 'Tap' : 'Click'} the map${desk ? ' where you start, then each place on the way: Polku follows the paths between them.' : ', point by point'}`, () => this.openWay('draw')),
        roundTripSports.includes(sp) ? way('loop', 'roundtrip', 'Round trip', desk ? 'A loop of the length or time you pick: three to choose from.' : 'A loop of a length you pick', () => this.openLoop(null, { fromWays: true })) : null,
        markedFor(sp).length ? way('find', 'sign', 'Marked routes', desk ? 'Routes from LIPAS in the map’s view: follow one as it is.' : 'From LIPAS, in view', () => this.openWay('find')) : null,
        way('file', 'upload', desk ? 'A GPX or KML file' : 'A file', desk ? 'Plan on a track from a file, or drop it on the map.' : 'GPX or KML', () => $('#file-input').click()),
      ].filter(Boolean)),
    ];
  }

  // Draw it: what to do, a line that follows the next leg's mode, and the route style before the first leg.
  // Phones keep the card low, one row for the style; it raises the sheet to the chips, and Back lowers it.
  drawView() {
    const desk = this.sideMQ.matches, raised = !desk && this.wayRaised;
    const LINE = { auto: 'Polku follows the paths', line: 'Polku joins your points with straight lines', water: 'Polku finds a way over the water' };
    return [
      raised ? this.backRow('Draw it', () => this.wayBack()) : this.backRow(),
      this.sportRow(),
      h('div', { class: 'way-hint' }, h('b', {}, `${this.coarse() ? 'Tap' : 'Click'} the map where you start`), h('small', { class: 'way-line' }, `${LINE[this.mode]}, and the sport can change on the way.`)),
      this.styleBlock(desk || raised ? 'full' : 'row', { raise: () => { this.wayRaised = true; this.pushWay(); this.renderStart(); } }),
    ];
  }

  // The route style before the first leg or the loops: the route's sport's presets as chips, and Fine-tune, which
  // opens How you go's own section in place (renderStyle()'s, moved here: borrowHow()). The same style as the mode's
  // menu and How you go, so a change anywhere shows everywhere; with no route yet it routes nothing (setStyle()).
  // 'row': one line that opens it. `fold`: the heading folds it again (the round trip's).
  styleBlock(how, { view = 'draw', raise = null, fold = null } = {}) {
    const route = this.mainSport(), m = this.mode;
    if (view === 'draw' && m === 'line') return h('p', { class: 'way-nostyle', html: `${icon('straight', 16)}<span>Straight lines don’t use a route style</span>` });
    if (view === 'draw' && m === 'water' && !isWater(route)) return h('p', { class: 'way-nostyle', html: `${icon('water', 16)}<span>Legs over water are paddled, in your Paddle style</span>` });
    const st = this.styleOf(route), name = styleName(route, st);
    // one button like the toolbar's (2026-10-21), which opens the choices
    if (how === 'row') return h('button', { type: 'button', class: 'stylebtn', 'data-k': 'srow', 'aria-expanded': 'false', onclick: raise, html: `<span class="two"><small>Route style</small><span>${escapeHtml(name)}</span></span>${icon('chevronDown', 12)}` });
    const cat = STYLES[route] || STYLES.mtb, custom = isCustom(route, st);
    const pick = (k) => { this.styleLeg = null; this.setStyle({ p: k, v: {}, wet: st.wet || 'auto' }); };
    const head = fold ? h('button', { type: 'button', class: 'way-sh', 'data-k': 'sfold', 'aria-expanded': 'true', onclick: fold, html: `<span>Route style · the whole route</span>${icon('chevronUp', 16)}` })
      : h('div', { class: 'way-sh' }, 'Route style · the whole route');
    const out = h('div', { class: 'way-style' }, head,
      h('div', { class: 'style-presets way-chips', role: 'group', 'aria-label': 'Route style' }, ...cat.presets.map(([k, label]) => h('button', {
        type: 'button', class: 'chip', 'data-k': `style-${k}`, 'aria-pressed': String(!custom && st.p === k), onclick: () => pick(k), html: `${!custom && st.p === k ? icon('check', 15) : ''}<span>${escapeHtml(label)}</span>`,
      })), custom ? h('span', { class: 'chip chip-on', 'aria-hidden': 'true' }, 'Custom') : null),
      h('button', { type: 'button', class: 'row way-srow way-tune', 'data-k': 'tune', 'aria-expanded': String(!!this.wayTune), onclick: () => { this.wayTune = !this.wayTune; this.renderStart(); },
        html: `<span>${icon('sliders', 20)}</span><span><b>Fine-tune in How you go</b></span><span class="way-chev">${icon(this.wayTune ? 'chevronUp' : 'chevronDown', 16)}</span>` }));
    if (this.wayTune) {
      const box = h('div', { class: 'way-how' });
      out.append(box);
      this.borrowHow(box);
    }
    return out;
  }

  // How you go's style section and your speeds, shown in a start step: the same elements, moved in and back
  borrowHow(into) {
    this.renderStyle();
    this.renderSpeed(); // (your speeds, before there's a route)
    into.append(this.els.styleBox, this.els.speedWrap);
    this.howOut = true;
  }
  returnHow() {
    if (!this.howOut) return;
    this.howOut = false;
    this.els.styleH.after(this.els.styleBox, this.els.speedWrap);
  }

  // A way picked from the ways to begin: one step of history, so a phone's back gesture does what Back does
  openWay(k) {
    this.way = k;
    this.wayRaised = false;
    this.wayTune = false;
    this.pushWay();
    if (k === 'find') this.listMarked();
    this.renderStart();
  }
  pushWay() {
    history.pushState({ ...(history.state || {}), polkuWay: (this.wayDepth || 0) + 1 }, '');
    this.wayDepth = (this.wayDepth || 0) + 1;
  }
  // Back: with steps in history, the browser's (its popstate does the step), else the step at once
  wayBack() {
    if (this.wayDepth > 0) history.back();
    else this.wayStepBack();
  }
  // one step back: Draw it's raised style lowers; a step goes back to the ways as they were
  wayStepBack() {
    // (focus goes back to what opened the step: its way, or Draw it's style row)
    if (this.way === 'draw' && this.wayRaised) { this.wayRaised = false; this.wayTune = false; this.refocus = 'srow'; }
    else if (this.loop.open && this.loop.fromWays) { this.loop.fromWays = false; this.refocus = 'way-loop'; this.closeLoop(); }
    else { this.refocus = this.way ? `way-${this.way}` : null; this.leaveWay(); }
    this.renderStart();
  }
  leaveWay() {
    if (this.way === 'find') this.clearMarked();
    this.way = null;
    this.wayRaised = false;
    this.wayTune = false;
  }
  // The steps ended some other way (a first point, a loop or a route taken, the planner closed): their
  // history goes too, so the next Back isn't spent on a step that's gone
  dropWayHist() {
    const n = this.wayDepth || 0;
    if (!n) return;
    this.wayDepth = 0;
    this.skipPop = true;
    history.go(-n);
  }
  bindWayHistory() {
    this.wayDepth = 0;
    addEventListener('popstate', () => {
      if (this.skipPop) { this.skipPop = false; this.keepView(); return; }
      if (!this.wayDepth) return;
      this.wayDepth--;
      this.keepView();
      this.wayStepBack();
    });
  }
  // The map stays where it is: going back a step also takes the address back to where the map was when the step
  // began (its view is in the hash), and MapLibre moves the map there on the hashchange after the popstate. Its
  // listener runs before any of ours (on window they run in the order added, capture or not), so the address
  // follows the map here, in the popstate, and MapLibre finds the map already there.
  keepView() {
    const c = this.map.getCenter(), z = this.map.getZoom(), b = this.map.getBearing(), pt = this.map.getPitch();
    const d = Math.ceil((z * Math.LN2 + Math.log(512 / 360 / 0.5)) / Math.LN10); // (MapLibre's own hash: a pixel's worth of degrees at this zoom)
    history.replaceState(history.state, '', `#${z.toFixed(2)}/${c.lat.toFixed(d)}/${c.lng.toFixed(d)}${b || pt ? `/${Math.round(b * 10) / 10}/${Math.round(pt)}` : ''}`);
  }

  // The first point's peek: the next point first, then a round trip from here, any length one tap (#232)
  firstView() {
    const sport = this.app.activity(), L = this.loop, min = L.mode === 'min';
    const pre = LOOP_PRESETS[sport] || LOOP_PRESETS.mtb;
    const fmt = (v) => (min ? (v >= 60 ? `${v / 60} h` : `${v} min`) : `${v} km`);
    return [
      // ✕ at the top right, as in the start and its steps (2026-10-21: it replaces Done here too)
      h('div', { class: 'way-head' }, h('div', { class: 'way-hint' }, h('b', {}, `${this.coarse() ? 'Tap' : 'Click'} the map for your next point`)), this.dockX(), this.closeX()),
      roundTripSports.includes(sport) ? h('div', { class: 'rt-here' },
        h('span', { class: 'way-cap', html: `${icon('roundtrip', 14)}<span>Round trip from here</span>` }),
        h('div', { class: 'rt-chips', role: 'group', 'aria-label': 'Round trip from here' },
          ...(min ? pre.min : pre.km).slice(0, 3).map((v) => h('button', { type: 'button', class: 'chip', 'data-k': `rt-${v}`, 'aria-label': `Round trip from here: ${fmt(v)}`, onclick: () => this.openLoop(this.points[0].slice(), { len: v }) }, fmt(v))),
          h('button', { type: 'button', class: 'chip', 'data-k': 'rt-other', 'aria-label': 'Round trip from here: another length or a time', onclick: () => { this.loop.other = true; this.openLoop(this.points[0].slice()); } }, 'Other…'))) : null,
    ];
  }

  // Marked routes: LIPAS's routes for the sport in the map's view, as cards like the loops' (#89). A tap on a
  // card or its line picks it and its line glows; Follow this route makes it the route on its own line
  // (rideLipas(), no routing). When it can't list them, it says why. No position leaves the device for it:
  // it asks LIPAS for the view, as the layer does, through request().
  findView() {
    const M = this.marked, sp = this.app.activity(), label = ACTIVITIES[sp].label, desk = this.sideMQ.matches;
    // the sport's row, as in the ways: it decides what's listed, and says so (2026-10-21)
    const out = [this.backRow(), this.sportRow(), h('div', { class: 'way-hint' }, h('b', {}, 'Marked routes in view'), h('small', {}, `From LIPAS · ${this.coarse() ? 'tap' : 'click'} a card or a coloured line`))];
    const note = (state, ic, text, btn = null) => h('div', { class: `mr-state${state === 'fail' ? ' fail' : ''}`, 'data-state': state, role: 'status' },
      h('span', { class: 'mr-ic', 'aria-hidden': 'true', html: icon(ic, 18) }), h('span', { class: 'mr-text' }, text), btn);
    const act = (k, label, fn) => h('button', { type: 'button', class: 'btn small', 'data-k': k, onclick: fn }, label);
    const byName = () => h('div', { class: 'rt-chips' }, h('button', { type: 'button', class: 'chip', 'data-k': 'byname', onclick: () => this.findByName(), html: `${icon('search', 16)}<span>Find by name${desk ? ' · in all of Finland' : ''}</span>` }));
    if (!markedFor(sp).length) return [...out, note('swim', 'info', `No marked routes for ${sp === 'swim' ? 'swimming' : label} in LIPAS.`)];
    if (this.app.overlayOn && !this.app.overlayOn('lipasRoutes')) out.push(note('off', 'info', 'Marked routes are off in Layers, so the map doesn’t show them.', act('show', 'Show them', () => { this.app.setOverlay('lipasRoutes', true); this.renderStart(); })));
    if (M.state === 'fail') out.push(note('fail', 'warn', `LIPAS isn’t answering: the marked routes can’t be listed right now.${M.until > Date.now() ? ` Polku asks again at ${new Date(M.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : ''}`, act('retry', 'Retry', () => this.listMarked())));
    else if (M.state === 'far') out.push(note('far', 'search', 'Zoom in on Finland to list the marked routes in view, or find one by name.'), byName());
    else if (M.state === 'loading' && !M.list.length) out.push(note('loading', 'sign', 'Looking for marked routes in view…'));
    else if (!M.list.length) out.push(note('none', 'info', `No marked routes for ${label} in view. Zoom out, or find one by name.`), byName());
    else {
      if (M.partial) out.push(note('partial', 'warn', 'Part of the view didn’t load from LIPAS, so some may be missing.', act('retry', 'Retry', () => this.listMarked())));
      out.push(this.markedCards(desk));
      if (desk) out.push(byName());
    }
    return out;
  }

  markedCards(desk) {
    const M = this.marked;
    const list = h('div', { class: 'loop-cards mr-cards', role: 'list', 'aria-label': 'Marked routes in view' });
    M.list.forEach((r, i) => {
      const on = i === M.on, p = r.props;
      const km = `${r.km >= 10 ? Math.round(r.km) : r.km.toFixed(1)} km`;
      const what = [km, on && M.ride && M.ride.key === r.key ? M.ride.text : '', 'in view'].filter(Boolean).join(' · ');
      list.append(h('div', { class: `loop-card mr-card${on ? ' on' : ''}`, role: 'listitem', 'data-key': r.key, onclick: (e) => { if (!e.target.closest('.loop-use')) this.pickMarked(i, { frame: true }); } },
        h('button', { type: 'button', class: 'loop-pick', 'data-k': `mr-${r.key}`, 'aria-pressed': String(on), 'aria-label': `${p.name}: ${p.typeName}, ${what}` },
          h('span', { class: 'mr-type' }, h('span', { class: 'mr-swatch', style: `background:${r.color}`, 'aria-hidden': 'true' }), h('span', {}, p.typeName)),
          h('b', { class: 'mr-name' }, p.name),
          h('span', { class: 'loop-card-line' }, what)),
        h('button', { type: 'button', class: 'btn primary loop-use', 'data-k': `follow-${r.key}`, onclick: () => this.followMarked(i), html: `${icon('route', 16)}<span>Follow this route</span>` })));
    });
    if (!desk) list.append(h('button', { type: 'button', class: 'loop-card loop-more mr-byname', 'data-k': 'byname-card', onclick: () => this.findByName() },
      h('span', { html: icon('search', 20) }), h('b', {}, 'Find by name'), h('small', {}, 'in all of Finland')));
    return list;
  }

  // the free map's view: what you can see beside the panel or above the sheet
  freeBounds() {
    const v = this.viewPadding(0), c = this.map.getCanvas();
    const a = this.map.unproject([v.left, v.top]), b = this.map.unproject([c.clientWidth - v.right, c.clientHeight - v.bottom]);
    return [Math.min(a.lng, b.lng), Math.min(a.lat, b.lat), Math.max(a.lng, b.lng), Math.max(a.lat, b.lat)];
  }

  // The list for the map's view, again after each move (an answer for an older view is dropped)
  async listMarked() {
    const M = this.marked, sp = this.app.activity(), types = markedFor(sp);
    const gen = (M.gen = (M.gen || 0) + 1);
    const keep = M.list[M.on] && M.list[M.on].key;
    if (!types.length) { M.list = []; M.state = 'none'; this.showMarked(); this.renderStart(); return; }
    const c = this.map.getCenter();
    const fin = c.lng > 19 && c.lng < 32 && c.lat > 59.4 && c.lat < 70.2;
    if (this.map.getZoom() < 8 || !fin || !this.app.lipasRoutesIn) { M.list = []; M.state = 'far'; this.showMarked(); this.renderStart(); return; }
    M.state = 'loading';
    this.renderStart();
    let res;
    try {
      res = await this.app.lipasRoutesIn(this.freeBounds(), types, [c.lng, c.lat]);
    } catch (e) {
      if (gen !== M.gen) return;
      M.list = [];
      M.state = e.name === 'Wide' ? 'far' : 'fail';
      M.until = e.name === 'Limited' ? e.until : 0; // a pause: when it asks again (lipasBack())
      this.showMarked();
      this.renderStart();
      return;
    }
    if (gen !== M.gen || this.startView() !== 'find') return;
    M.list = res.routes.slice(0, 20);
    M.on = Math.max(0, M.list.findIndex((r) => r.key === keep));
    M.partial = res.failed > 0 && M.list.length > 0;
    M.state = !M.list.length && res.failed ? 'fail' : 'ok';
    this.showMarked();
    this.renderStart();
  }
  listMarkedSoon() { clearTimeout(this.markedTimer); this.markedTimer = setTimeout(() => this.listMarked(), 400); }
  // LIPAS answers again after a pause (net.js): a list that couldn't be made is made now
  lipasBack() { if (this.startView() === 'find' && (this.marked.state === 'fail' || this.marked.partial)) this.listMarked(); }

  // the picked route's line glows (the layer search's pick uses)
  showMarked() {
    const r = this.marked.list[this.marked.on];
    this.app.setData('lipasPick', { type: 'FeatureCollection', features: r && this.startView() === 'find'
      ? r.parts.map((c) => ({ type: 'Feature', properties: { type: r.props.type, lipasId: r.props.lipasId }, geometry: { type: 'LineString', coordinates: c } })) : [] });
  }

  // a card or a line picked: it glows, and from its card the map frames it; what following it gives comes once
  // LIPAS has sent all its parts (one request, kept for the session, as the route's card on the map asks)
  pickMarked(i, { frame = false } = {}) {
    const M = this.marked, r = M.list[i];
    if (!r) return;
    M.on = i;
    this.showMarked();
    this.renderStart();
    this.cardIntoView(this.els.way.querySelector(`.mr-card[data-key="${r.key}"]`));
    if (frame) { M.framed = true; this.frame(bbox(r.parts.flat()), { maxZoom: 15, duration: 600 }); }
    if (this.app.lipasRide && !(M.ride && M.ride.key === r.key)) {
      this.app.lipasRide(r.props).then((ride) => {
        if (!ride) return;
        const km = `${ride.km >= 10 ? Math.round(ride.km) : ride.km.toFixed(1)} km`;
        M.ride = { key: r.key, text: ride.network ? `a network: follows ${km} of it` : ride.loop ? 'a loop' : 'one way' };
        if (this.startView() === 'find') this.renderStart();
      }).catch(() => {});
    }
  }

  pickMarkedAt(pt, r) {
    const layers = ['lipas-route', 'lipas-pick'].filter((l) => this.map.getLayer(l));
    const f = layers.length && this.map.queryRenderedFeatures([[pt.x - r, pt.y - r], [pt.x + r, pt.y + r]], { layers })[0];
    if (!f) return;
    const i = this.marked.list.findIndex((x) => x.key === `${f.properties.type}/${f.properties.lipasId}`);
    if (i >= 0) this.pickMarked(i);
  }

  followMarked(i) {
    const r = this.marked.list[i];
    if (!r || !this.app.rideLipas) return;
    const c = this.map.getCenter();
    this.app.rideLipas(r.props, { near: [c.lng, c.lat] });
  }

  findByName() {
    const i = $('#search-input');
    if (i) { i.focus(); toast('Type a route’s name: search finds marked routes in all of Finland', { ms: 5000 }); }
  }

  clearMarked() {
    const M = this.marked;
    M.gen = (M.gen || 0) + 1; // an answer still on its way is dropped
    M.list = [];
    M.on = 0;
    M.ride = null;
    M.state = 'loading';
    this.app.setData('lipasPick', EMPTY);
  }


  // ---------------------------------------------------------------- panel layout & states
  // Wide screens choose: a side panel on the left (the default since the tabs, 22a) or a bottom
  // panel (the button beside the fold, ⋯, or Settings). Phones and narrow windows always get the sheet.
  layout() { return this.sideMQ.matches && dockOf() === 'left' ? 'side' : 'sheet'; }

  setDock(where) {
    store.set('plannerDock', where);
    this.renderDockBtn();
    this.setSheetState(store.get('sheetState', {})[this.layout()], { remember: false });
    this.app.onActiveChange(this.active); // padding vars, button states
    this.renderStart(); // the start's own button says where the panel goes next
    requestAnimationFrame(() => this.chart.draw());
    // the map it leaves free has moved: the route is framed in it again (#387)
    if (this.active && this.points.length > 1) requestAnimationFrame(() => this.fitRoute());
  }

  renderDockBtn() {
    const side = this.layout() === 'side', b = this.els.dockBtn;
    if (!b) return;
    b.innerHTML = icon(side ? 'panelBottom' : 'panelLeft', 19);
    b.title = side ? 'Move the planner to the bottom' : 'Move the planner to the left';
    b.setAttribute('aria-label', b.title);
  }

  // rest: the planner's own choice of the peek (opening, drawing), not one you asked for: it's the line where the peek turns
  // out to cover more than half the screen (sizes())
  // instant: at once, nothing moving (the keyboard)
  setSheetState(st, { remember = true, rest = false, instant = false } = {}) {
    if (!this.restingSheet) this.sheetSwipe?.stop(); // changed some other way while a swipe moved it
    instant ||= this.keyed;
    if (instant) this.panel.classList.add('instant');
    const from = this.shownHeight();
    this.panel.dispatchEvent(new Event('sheetchange')); // (main.js: where what rides above it is, before anything moves)
    this.resting = rest;
    if (['folded', 'peek'].includes(st)) this.clearCategoryPreview();
    const lay = this.layout();
    this.renderDockBtn();
    const ok = lay === 'side' ? ['open', 'folded'] : SHEET_STATES;
    if (!ok.includes(st)) st = lay === 'side' ? 'open' : 'half';
    if (st === 'folded' && !this.foldable()) st = lay === 'side' ? 'open' : 'peek';
    // the start's views are the sheet's whole height: its peek grows with them (A); a card over them has its own sizes
    if (lay === 'sheet' && this.peekOnly() && this.cards.place !== 'peek') { st = 'peek'; remember = false; }
    const p = this.panel, was = p.dataset.state;
    // folded is never remembered: the planner opens as it was before, and the line opens to the size it left
    if (st === 'folded') { remember = false; if (was && was !== 'folded') this.unfoldTo = was; }
    this.panel.dataset.layout = lay;
    this.panel.dataset.state = st;
    if (!['folded', 'peek'].includes(st) && this.cards.place !== 'peek') this.lastOpen = st;
    if (!p.hidden) { // (the planner open, or a card's sheet with it put away)
      document.body.dataset.sheet = st; // a full sheet hides the map chrome under it
      document.body.dataset.pl = lay;
    }
    if (remember && this.cards.place !== 'peek') store.set('sheetState', { ...store.get('sheetState', {}), [lay]: st }); // (a card's sizes are its own, not the planner's)
    this.els.handle.setAttribute('aria-valuetext', st);
    this.els.handle.title = { folded: 'Open it as it was', peek: 'Show more', half: 'Drag up for everything, down for the map', full: 'Drag down for the map' }[st] || '';
    this.renderOnRoute(); // (the row gone while Check is in sight; Worth a look's markers with it; and the folded line)
    if (!['folded', 'peek'].includes(st)) requestAnimationFrame(() => this.chart.draw());
    // (folded, the toolbox is the mode, undo and redo; what comes back when it opens isn't new, so it doesn't fade in)
    if ((st === 'folded') !== (was === 'folded')) { this.toolsShown = null; this.renderTools(); }
    this.scrollAll();
    // a card at its peek or line is at its top, its name and numbers in sight (a finger there moves the sheet, so it couldn't
    // scroll it back); as the planner's numbers do (scrollAll()), it fades in there, but not from the keyboard. A swipe has
    // already scrolled it back
    const c = p.classList.contains('carded') && this.cards.box;
    if (c && c.scrollTop > 0 && !['half', 'full'].includes(st)) {
      c.scrollTop = 0;
      if (!instant) c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: token('--t-open'), easing: cssVar('--ease-out') });
    }
    this.placeTools(); // at once: a camera move in the same step frames above it (viewPadding())
    // its sizes measured for this size first, so it moves there once (not to one measured at the last size, then on)
    this.stopSheet();
    this.measureSheet?.();
    this.moveSheet(from);
    p.dispatchEvent(new Event('sheetstate')); // (main.js: --sheet-h, the size it's going to, at once)
    if (instant) { void p.offsetHeight; p.classList.remove('instant'); }
  }

  // While drawing or dragging on the map, the phone sheet gets out of the way: to its peek, or its line where the peek
  // would cover more than half the screen (200 %). Folded, it stays so. Not remembered, so the planner reopens at the
  // size you chose.
  autoPeek() {
    if (this.active && this.layout() === 'sheet' && !this.sideMQ.matches && !['folded', 'peek'].includes(this.panel.dataset.state)) this.setSheetState(this.restSize(), { remember: false, rest: true });
  }
  // The whole sheet scrolls as one under its top row, which stays: on a phone at half and full and on the side panel (D of
  // the sheet's stops, #233), so a finger on the numbers scrolls it too; wider, at full where the header, the profile and the tabs take more
  // than half of it (#453), so the list can be reached; and a peek cut below the top bar
  scrollAll() {
    const p = this.panel, st = p.dataset.state, on = this.layout() === 'side' ? st === 'open' && !this.peekOnly()
      : !this.cards.current && ((st === 'peek' && this.peekCut)
        || (innerWidth <= 720 && st === 'half')
        || (st === 'full' && (innerWidth <= 720 || this.els.head.offsetHeight + this.els.profZone.offsetHeight + this.els.tabs.offsetHeight > (dvh() - 76) / 2)));
    if (p.classList.contains('scroll-all') === on) return;
    const was = p.scrollTop; // (before: a sheet that no longer scrolls reads 0)
    p.classList.toggle('scroll-all', on);
    if (on) return;
    // (scrolled: the size it goes to hides the list at once, so the content can't scroll back with the sheet's move; the
    // numbers fade in where the list was instead of appearing at once, but not from the keyboard. A swipe has already
    // scrolled it back, bindSheet()'s unscroll)
    if (was > 0 && !this.keyed && !p.classList.contains('instant')) this.els.head.animate([{ opacity: 0 }, { opacity: 1 }], { duration: token('--t-open'), easing: cssVar('--ease-out') });
    p.scrollTop = 0;
    p.classList.remove('sum-on');
  }
  // one stop up or down (the line from the peek, never away); from a size as tall as a stop under it, from that one
  stepSheet(dir, instant) {
    const S = this.stops(), now = this.settledHeight(), i = Math.max(0, S.findLastIndex((z) => z.at <= now + 1));
    const st = this.panel.dataset.state, to = S[Math.max(0, Math.min(S.length - 1, i + dir))].name;
    if (to === 'folded' && st !== 'folded') this.fold({ instant });
    else if (to !== st) this.setSheetState(to, { instant });
  }
  // The sheet's stops, lowest first, at the heights they rest at: the line, the peek, half and full; the start's views have
  // their peek alone. A card's are the planner's, each as tall as the card at most (sizes(), #603). Only ever up: a stop no
  // taller than one under it isn't one (a peek as tall as the screen has none above it, a short card its peek alone)
  stops() {
    const px = (v) => parseFloat(this.panel.style.getPropertyValue(v)) || 0, D = dvh(), card = this.cards.place === 'peek', peek = px('--peek-h');
    const S = this.peekOnly() && !card ? [{ name: 'peek', at: peek }]
      : [...(this.foldable() ? [{ name: 'folded', at: px('--fold-h') }] : []), { name: 'peek', at: peek },
        { name: 'half', at: card ? px('--card-half') : D * 0.5 }, { name: 'full', at: card ? px('--card-full') : D - 76 }];
    return S.filter((z, i) => i === 0 || z.at > Math.max(...S.slice(0, i).map((y) => y.at)) + 1);
  }
  // what scrolls the list: its body, or the sheet where it scrolls as one
  listScroller() { return this.panel.classList.contains('scroll-all') ? this.panel : this.els.body; }
  // a tab or a step from its start: the body at its top, or where the sheet scrolls as one, the tabs back under the top row
  // once they've gone past it (not the sheet's own top, which at 200 % would take the tab's content out of sight)
  listToTop() {
    const p = this.panel;
    if (!p.classList.contains('scroll-all')) { this.els.body.scrollTop = 0; return; }
    const at = this.els.tabs.offsetTop - this.els.top.offsetHeight;
    if (p.scrollTop > at) p.scrollTop = at;
  }
  // the peek, or the line where the peek would cover more than half the screen (#453: 200 %, long words)
  restSize() {
    this.measureSheet?.();
    return this.peekTooTall() ? 'folded' : 'peek';
  }
  peekTooTall() { return this.foldable() && !this.cards.current && (parseFloat(this.panel.style.getPropertyValue('--peek-h')) || 0) > dvh() / 2; }

  // Fold, then away (step 3 of #233): what folds to a line is the planner with a route (the start's views keep their
  // peek) and a card in the peek, over them too. ⌄ or a swipe down folds it; the line opens it as it was; ✕ at the line, or a second
  // swipe, puts the planner away (with its note) or closes the card (the planner as it was under it).
  foldable() { return this.cards.place === 'peek' || (this.points.length > 1 && !this.peekOnly()); }
  // the keyboard's focus goes with it: from ⌄ or the handle to the line, and back to where it came from
  fold({ instant = false } = {}) {
    this.foldFocus = [this.els.foldBtn, this.els.min, this.els.handle].find((b) => b === document.activeElement) || null;
    this.setSheetState('folded', { instant });
    if (this.foldFocus) this.els.foldGo.focus({ preventScroll: true });
  }
  unfold({ instant = false } = {}) {
    const had = this.els.fold.contains(document.activeElement), to = this.unfoldTo;
    this.setSheetState(to && to !== 'folded' ? to : this.layout() === 'side' ? 'open' : 'peek', { instant });
    if (had) [this.foldFocus, this.els.foldBtn, this.els.min].find((b) => b && b.offsetParent)?.focus({ preventScroll: true });
    // a card opened again: its spot in sight above it, as when it opened
    const e = this.cards.place === 'peek' && this.cards.stack[this.cards.stack.length - 1], at = e && (e.card.at ? e.card.at() : e.at);
    if (at) this.cards.inSight(at);
  }
  foldAway() { if (this.cards.place === 'peek') this.cards.close(); else this.close(); }
  // The folded line: the planner's numbers, with the count of what's to read before you go, or the card's mark, its
  // name (whole, never cut) and the open card's first two numbers; one button that opens it as it was. Its words are a
  // screen reader's too.
  renderFold() {
    const go = this.els && this.els.foldGo;
    if (!go) return;
    this.renderTopSum();
    const card = this.cards.place === 'peek' ? this.cards.current : null;
    this.panel.classList.toggle('foldable', this.foldable());
    // nothing left to fold (Undo on the line down to one point): it opens as it was, as setSheetState() won't fold it then
    if (!this.foldable() && this.panel.dataset.state === 'folded') return this.unfold();
    this.panel.classList.toggle('fold-card', !!card);
    // each number whole, with its unit: the line breaks only between them, at " · " (200 %)
    const line = (items) => items.flatMap((t, i) => [i ? ' ' : '', h('span', {}, i < items.length - 1 ? `${t} ·` : t)]);
    const x = card ? 'Close' : 'Put the planner away: your route stays';
    this.els.foldX.setAttribute('aria-label', x);
    this.els.foldX.title = x;
    const st = this.panel.dataset.state, steps = !card && this.arrowsMQ.matches && this.panel.dataset.layout === 'sheet' && st !== 'peek';
    const f = card ? 'Fold the card to a line' : steps ? 'Lower the planner one size' : 'Fold the planner to a line';
    const m = steps ? f : 'Fold the planner down to a line';
    this.els.foldBtn.setAttribute('aria-label', f);
    this.els.foldBtn.title = f;
    this.els.min.setAttribute('aria-label', m);
    this.els.min.title = m;
    this.els.up.disabled = this.els.upMin.disabled = st === 'full'; // (dimmed, so ⌄ stays where it is)
    if (card) {
      const name = typeof card.title === 'string' ? card.title : card.title.textContent;
      // (its words wrap with its name: a place's line can be long; its numbers stay whole)
      const { nums, words } = foldFacts(card, this.cards.box), head = [name, ...words].join(' · ');
      go.replaceChildren(card.mark ? h('span', { class: 'card-mark', 'aria-hidden': 'true' }, card.mark()) : '',
        h('b', { class: 'name', 'aria-hidden': 'true' }, h('span', { class: 'fold-name' }, nums.length ? `${head} ·` : head), ' ', ...line(nums)));
      go.setAttribute('aria-label', `${[name, ...words, ...nums].join(', ')}: open the card`);
      return;
    }
    const R1 = this.unread(this.heads, 'read'), R3 = this.unread(this.heads, 'not'), n = R1.length || R3.length;
    const busy = this.panel.classList.contains('busy'), nums = [...this.els.sum.querySelectorAll('.sum-item > b')].map((b) => b.textContent.trim());
    go.replaceChildren(
      n ? h('span', { class: `fold-warn ${R1.length ? 'danger' : 'unk'}`, 'aria-hidden': 'true', html: icon(R1.length ? 'warnf' : 'unk', 16) }, String(n)) : '',
      h('b', { 'aria-hidden': 'true' }, ...line(busy ? ['Routing…', ...nums] : nums)));
    go.setAttribute('aria-label', `${n ? `${n} ${R1.length ? 'to read before you go' : 'not checked'}, ` : ''}${busy ? 'routing, ' : ''}${nums.join(', ')}: open the planner as it was`);
  }

  // D's top row, once the numbers have scrolled under it: the numbers, as the folded line has them, then the route's name
  renderTopSum() {
    const nums = [...this.els.sum.querySelectorAll('.sum-item > b')].map((b) => b.textContent.trim()), name = this.points.length > 1 ? this.routeTitle() : '';
    this.els.topSum.replaceChildren(...nums.map((t, i) => h('b', {}, i ? `· ${t}` : t)), name ? h('i', {}, name) : '');
  }

  // A swipe has come to rest at a size (or was stopped, name null): the size changes while transitions
  // are still off, so nothing moves twice; then main.js moves the map's buttons (sheetrest).
  restSheet(name) {
    const p = this.panel;
    this.restingSheet = true;
    for (const el of [this.els.fold, this.els.top, this.els.head, this.els.profZone, this.els.tabs, this.els.body]) el.style.opacity = '';
    if (name === 'closed') this.foldAway();
    else if (name) this.setSheetState(name);
    p.style.height = '';
    p.style.removeProperty('--card-drag');
    void p.offsetHeight;
    p.classList.remove('dragging');
    this.restingSheet = false;
    p.dispatchEvent(new Event('sheetrest'));
  }

  bindSheet() {
    this.sideMQ = matchMedia('(min-width: 900px)');
    // what a key does happens at once, nothing animates for the keyboard: from a key's own events (Space
    // presses a button on keyup), until what they changed has been drawn (its sizes are measured again in that frame)
    for (const t of ['keydown', 'keyup']) addEventListener(t, () => { this.keyed = true; cancelAnimationFrame(this.keyedOff); this.keyedOff = requestAnimationFrame(() => { this.keyedOff = requestAnimationFrame(() => { this.keyed = false; }); }); }, true);
    this.sideMQ.addEventListener('change', () => this.setSheetState(store.get('sheetState', {})[this.layout()]));
    // the summary rows are always visible: the peek height is theirs,
    // under the peek's last row, 14 px (the header's padding and 6 px more). With ⌄'s row (40 px, the handle's alone is 18),
    // none under a row with room of its own, the key facts' line or a card (whose header has none, css/app.css), so the row
    // costs the map 8 px, not 22; the header's 8 px under the numbers where a short phone has no key facts (step 3 of #233)
    const under = () => (this.els.top.offsetHeight <= 18 ? 6 : this.els.facts.offsetParent ? -8 : 0);
    const sizes = () => {
      const hd = this.els.head, w = this.els.way, from = this.shownHeight();
      // the start's view as tall as it is, not as tall as the sheet let it be: it scrolls inside only once the
      // sheet stops below the top bar (css/app.css .way-only)
      const grow = w && !w.hidden ? w.scrollHeight - w.clientHeight : 0;
      // the route's view on a short screen (200 %, a long name): the name scrolls in its place, whole, so the sheet stops
      // below the top bar as the start's views do, and its sports and "Kept on this device" stay in sight (25c)
      const t = this.els.title, n = this.els.titleName;
      if (n) n.style.maxHeight = '';
      // the toolbox in it as the peek has it, whatever size the sheet is at (docked into a full sheet but floating over the
      // peek, or floating over the line and docked into the peek), so a swipe lands where the sheet rests (#586); its room
      // as it was last docked (placeToolsNow() says whether the peek docks it)
      const box = this.tools, shown = !!box && !box.hidden, take = shown && box.parentElement === this.panel ? hd.offsetTop - this.els.top.offsetHeight : 0;
      if (take) this.dockTake = take;
      // …and the row of what to read, which goes above the peek while Check or the list says it (renderReadRow()): shown
      // for the measure, with nothing drawn in between; not the count beside the numbers (narrow or short), which adds none
      const rr = this.els.readRow, readRow = rr && rr.hidden && this.panel.dataset.state !== 'peek' && !this.narrowMQ.matches && !this.shortMQ.matches
        && this.readRowWanted() && !this.checkInSight('peek') && !this.listInSight('peek');
      if (readRow) rr.hidden = false;
      // (a card is measured from what it holds, as it fills the sheet at half and full: its peek is the same at every size)
      const c = this.cards.place === 'peek' && this.cards.box, cardAt = c ? c.getBoundingClientRect().top - hd.getBoundingClientRect().top : 0;
      this.peekBare = Math.ceil(hd.offsetTop - take + (c ? cardAt : hd.offsetHeight + grow) + under());
      if (readRow) rr.hidden = true;
      let h = this.peekBare + (this.panel.dataset.state === 'peek' ? take : shown && this.peekDocks ? this.dockTake || 0 : 0);
      // a card's peek is no taller than the planner's own with a route, nor than 52 % of the window: the rest of it is a swipe
      // up, at half (#603). It always has the card's name and numbers, as the planner's has its route's: where the planner's
      // is shorter (no key facts' line yet), and before the planner has had a route (not a share of the screen, which text
      // outgrows at 200 %). A card that fits in less is as tall as it is
      if (c) {
        const end = c.querySelector(':scope > .sheet-sum') || c.querySelector(':scope > .way-head');
        const named = end.getBoundingClientRect().bottom - c.getBoundingClientRect().top + c.scrollTop + parseFloat(getComputedStyle(c).paddingBottom);
        const room = Math.floor(Math.min(dvh() * 0.52 - 8, Math.max(named, (this.planPeek || 0) - h))), card = Math.min(c.scrollHeight, room);
        this.panel.style.setProperty('--card-peek', `${room}px`);
        this.peekBare += card;
        h += card;
      }
      const over = t && !t.hidden && this.layout() === 'sheet' ? h - (dvh() - 76) : 0;
      if (over > 0) { const nh = n.offsetHeight, to = Math.max(38, nh - over); n.style.maxHeight = `${to}px`; h -= nh - to; }
      if (n) n.classList.toggle('scrolls', over > 0);
      // never under the top bar (a phone on its side at 200 %, ⌄'s row too): the peek stops below it, and scrolls as one
      this.peekCut = this.layout() === 'sheet' && h > dvh() - 76;
      if (this.peekCut) h = Math.floor(dvh() - 76);
      if (!c && this.active && this.layout() === 'sheet' && this.foldable()) this.planPeek = h;
      const peek = `${h}px`;
      this.panel.style.setProperty('--peek-h', peek);
      // a phone's timeline over a raised sheet goes under its header: the planner's numbers, or a card's title row (#572)
      const ch = this.cards.place === 'peek' && this.cards.box && this.cards.box.querySelector('.way-head');
      document.documentElement.style.setProperty('--sheet-head', ch ? `${Math.round(ch.getBoundingClientRect().bottom - this.panel.getBoundingClientRect().top)}px` : peek);
      // the route's numbers came in just after it was framed and wrap onto a second line (#242), or the row of what
      // to read came once a source didn't answer (25d part 3, which can take a while): the peek is taller now, so
      // frame it once more, unless the map has been moved or framed on something else since, or a card is open:
      // asked again once the task that changed it is done, so a press or a card opened in it stops it, and before the
      // next frame is drawn, so none shows the route under the sheet (step 3 of #233, ⌄'s row coming with a route)
      const f = this.fitAt;
      const wanted = () => this.fitAt === f && this.panel.dataset.state === 'peek' && !this.cards.current;
      if (f && f.peek !== peek && wanted() && Date.now() - f.t < 60000) queueMicrotask(() => { if (wanted()) this.fitRoute({ animate: false }); else if (this.fitAt === f) this.fitAt = null; }); // (used once, as asked or not)
      this.scrollAll();
      // the planner resting at its peek, which turns out taller than half the screen (its toolbox docked into it): its line
      if (this.resting && this.panel.dataset.state === 'peek' && this.layout() === 'sheet' && this.peekTooTall()) requestAnimationFrame(() => { if (this.resting && this.panel.dataset.state === 'peek' && this.peekTooTall()) this.setSheetState('folded'); });
      // the folded line, over the top row: one row, the handle drawn in its top padding
      this.panel.style.setProperty('--fold-h', `${this.els.fold.offsetHeight}px`);
      // a card swiped up: half and full, each as tall as the card at most (step 3 of #233, #603)
      if (c) {
        const own = hd.offsetTop + cardAt + c.scrollHeight;
        this.panel.style.setProperty('--card-half', `${Math.round(Math.min(dvh() * 0.5, own))}px`);
        this.panel.style.setProperty('--card-full', `${Math.round(Math.min(dvh() - 76, own))}px`);
      }
      // only what you asked for moves: a size that changes from its content alone (a point added) changes at once, and
      // one that changes while the sheet moves turns that move to it, what rides above it with it
      if (this.sheetMove) { this.moveSheet(from); this.panel.dispatchEvent(new Event('sheetstate')); }
    };
    this.measureSheet = sizes;
    // D: the top row takes the numbers once they've scrolled under it
    const sumOn = () => this.panel.classList.toggle('sum-on', this.panel.classList.contains('scroll-all') && this.panel.scrollTop > 0 && !!this.els.sum.offsetParent
      && this.els.sum.getBoundingClientRect().bottom <= (this.layout() === 'side' ? this.els.topSum : this.els.top).getBoundingClientRect().bottom + 1);
    this.panel.addEventListener('scroll', sumOn, { passive: true });
    this.panel.addEventListener('sheetstate', sumOn);
    new ResizeObserver(sizes).observe(this.els.head);
    new ResizeObserver(sizes).observe(this.els.profZone);
    new ResizeObserver(sizes).observe(this.els.fold);
    new ResizeObserver(sizes).observe(this.els.top); // (⌄'s row comes with a route: the header moves down without changing its size)
    addEventListener('resize', sizes);
    // One swipe for every sheet (js/sheet.js, #96): from the handle, the header (its buttons too), the
    // profile's top row and the tabs, and from the body where it can't scroll that way itself. While it
    // moves, the sheet is as tall as its full size and follows the finger with transform; its size, and
    // --sheet-h that the map's buttons follow, change once, when it comes to rest (restSheet()).
    const px = (v) => parseFloat(this.panel.style.getPropertyValue(v)) || 0;
    // While a finger drags it, the sheet's stops are marked at the screen's left edge, and a line names the one a release
    // now would go to (C of the sheet's stops, #233). They fade in as the drag starts and out as it lets go; the line moves
    // from stop to stop at once, as it says where the sheet will go.
    const marks = h('div', { class: 'sheet-marks', 'aria-hidden': 'true' }), named = h('b');
    document.body.append(marks);
    let foot = 0;
    const markTo = (name) => {
      const i = [...marks.children].find((m) => m.dataset.n === name);
      if (!i || i.classList.contains('to')) return;
      for (const m of marks.children) m.classList.toggle('to', m === i);
      named.textContent = { closed: 'Away', folded: 'Line', peek: 'Peek', half: 'Half', full: 'Full' }[name];
      named.style.transform = `translate(-50%, ${Math.round(Math.min(parseFloat(i.style.top), foot - 24)) - 26}px)`;
    };
    const unmark = () => marks.classList.remove('on');
    // let go towards the peek or the line with the sheet scrolled as one: its content goes back to its top with the spring,
    // so it lands there and nothing jumps at rest (scrollAll()). A scrolled card does too, and at half and full as far as it
    // scrolls there (to its top where it fits whole)
    let unscroll = null;
    this.sheetSwipe = swipeSheet(this.panel, {
      enabled: () => (this.active || this.cards.place === 'peek') && this.layout() === 'sheet', // (a card's sheet with the planner put away too, #570)
      // not what has its own drag: the profile, a waypoint's grip, the timeline; a mouse only by the top rows, not a card (a
      // finger on a card moves the sheet at its peek and where the card can't scroll that way itself, js/sheet.js, #603)
      grab: (t, type) => !t.closest('#profile-canvas, .wpl-grip, .wpl.reorder .wpl-row, .tl-strip, .tl-grip, .orbit, .hours, .sheet-resize')
        && (type !== 'mouse' || (!!t.closest('.sheet-handle, .fold-line, .sheet-head, .pl-tabs') && !t.closest('.card'))),
      // the sizes, lowest first (stops(): the start's views are the peek only, so a swipe up springs back). From the line a
      // second swipe down puts the planner away, or closes the card (Fold, then away): a single swipe stops at the line
      start: () => {
        sizes();
        const full = dvh() - 76, now = this.shownHeight(), from = this.panel.dataset.state;
        this.stopSheet(); // (caught mid-move: the finger takes it from where it is)
        // dragged, a card shows itself from where it's scrolled to its end: never the sheet empty under it, and its content
        // stays where it was, under the finger (grown whole, a scrolled card jumped to its top; css/app.css)
        const c = this.panel.classList.contains('carded') && this.cards.box;
        if (c) this.panel.style.setProperty('--card-drag', `${c.offsetHeight + c.scrollHeight - c.clientHeight - c.scrollTop}px`);
        this.panel.classList.add('dragging');
        this.panel.style.height = `${full}px`;
        const up = this.stops();
        if (from === 'folded' && this.foldable()) up.unshift({ name: 'closed', at: -14 });
        foot = this.panel.getBoundingClientRect().bottom;
        named.textContent = '';
        marks.replaceChildren(...up.filter((z) => z.at > 0).map((z) => h('i', { 'data-n': z.name, style: `top:${Math.round(foot - z.at)}px` })), named);
        marks.classList.add('on');
        // (from a size as tall as a stop under it, that stop; above the last stop it resists: the start's views above their
        // peek, a card above its own height)
        return { H: full, now, from: up.some((z) => z.name === from) ? from : (up.findLast((z) => z.at <= now + 1) || up[0]).name, sizes: up, min: up[0].at, max: up[up.length - 1].at };
      },
      // A flick moves one stop: to the next one past where it's let go, its way (and at least one from where it began,
      // js/sheet.js). A slow release goes to the stop nearest where it would come to rest; a closing size needs SWIPE.closeAt
      // of the way, as a sheet that closes by a swipe does
      pick: (aim, ride, v) => {
        const S = ride.sizes, near = (list) => list.reduce((b, z) => (Math.abs(z.at - aim) < Math.abs(b.at - aim) ? z : b)).name;
        if (v >= SWIPE.flick) return (S.find((z) => z.at > ride.v + 1) || S[S.length - 1]).name;
        if (v <= -SWIPE.flick) return (S.findLast((z) => z.at < ride.v - 1) || S[0]).name;
        return S[0].name === 'closed' ? (aim < S[1].at * (1 - SWIPE.closeAt) ? 'closed' : near(S.slice(1))) : near(S);
      },
      // the line and what it folds cross-fade as the sheet passes between them, so nothing jumps at rest
      moved: (v, ride) => {
        if (ride.to && marks.classList.contains('on')) markTo(ride.to);
        if (unscroll) { const u = unscroll, d = u.v0 - u.to; u.el.scrollTop = u.T + (u.S - u.T) * (Math.abs(d) < 1 ? 0 : Math.max(0, Math.min(1, (v - u.to) / d))); }
        if (!this.foldable()) return;
        const top = px('--peek-h'), line = px('--fold-h'), f = Math.max(0, Math.min(1, (top - v) / Math.max(1, top - line)));
        this.els.fold.style.opacity = f;
        for (const el of [this.els.top, this.els.head, this.els.profZone, this.els.tabs, this.els.body]) el.style.opacity = 1 - f;
      },
      aim: (name, ride) => {
        unmark();
        const p = this.panel, to = ride.sizes.find((z) => z.name === name), open = ['half', 'full'].includes(name), c = p.classList.contains('carded') && this.cards.box;
        // (a card scrolls at most its whole height, from its top in the sheet, less the stop's)
        const el = c || p, S = el.scrollTop, T = c && open && to ? Math.min(S, Math.max(0, c.getBoundingClientRect().top - p.getBoundingClientRect().top + c.scrollHeight - to.at)) : 0;
        unscroll = to && S > T && (c || (p.classList.contains('scroll-all') && !open)) ? { el, S, T, v0: ride.v, to: to.at } : null;
      },
      end: (name) => { unscroll = null; this.restSheet(name); },
      cancel: () => { unscroll = null; unmark(); this.restSheet(null); },
    });
    // a tap on the handle, or on the header outside its buttons, folds the sheet or opens it again; folded, the handle
    // opens it as it was (not when the target has gone from it: a control that re-rendered itself, #251)
    const tap = (e, instant = false) => {
      if (this.layout() !== 'sheet' || !e.currentTarget.contains(e.target) || (e.currentTarget === this.els.head && (e.target.closest('button, input, select, a, label, .pl-way') || this.panel.classList.contains('carded')))) return; // (a card in the peek keeps its taps)
      const st = this.panel.dataset.state;
      if (st === 'folded') this.unfold({ instant });
      else if (this.cards.place !== 'peek') this.setSheetState(st === 'peek' ? (this.lastOpen || 'half') : 'peek', { instant });
    };
    this.els.handle.addEventListener('click', tap);
    this.els.head.addEventListener('click', tap);
    // the arrows step through the sizes (down to the line, never away); Enter and Space are a tap. At once, all of them
    this.els.handle.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); this.stepSheet(e.key === 'ArrowUp' ? 1 : -1, true); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap({ currentTarget: this.els.handle, target: this.els.handle }, true); }
    });
    this.arrowsMQ.addEventListener('change', () => this.renderFold());
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

  // Padding for camera moves so routes and climbs land in the visible part of the map: below
  // the top bar, beside the side panel or above the sheet as it settles. Never more than the
  // map has room for: MapLibre skips a fit that can't be made, with only a console warning.
  viewPadding(m = 40) {
    const top = Math.max(80, $('.topbar').getBoundingClientRect().bottom + 16);
    let v;
    if (!this.active || this.panel.hidden) v = { top, bottom: m + 20, left: m, right: m + 50 };
    // beside the side panel, above its toolbar at the map's foot (#468)
    else if (this.layout() === 'side') v = { top, bottom: this.tools.hidden ? m : innerHeight - this.tools.getBoundingClientRect().top + 16, left: this.panel.getBoundingClientRect().right + m, right: m + 70 };
    else v = { top, bottom: innerHeight - this.sheetTop() + this.overSheet() + m / 2, left: m / 2, right: m + 30 };
    const room = 0.25; // of the map's height and width, at least, to fit into
    v.bottom = Math.max(0, Math.min(v.bottom, innerHeight * (1 - room) - v.top));
    // an import's card sits over the map's corner (main.js showTrackCard()): its height and its 40 px gap above the stack
    // again, into the room above a half sheet on a phone too (120 px of map left at least)
    const card = $('#track-card');
    if (!card.hidden) v.bottom = Math.min(v.bottom + card.offsetHeight + 40, Math.max(v.bottom, innerHeight - v.top - 120));
    v.right = Math.max(0, Math.min(v.right, innerWidth * (1 - room) - v.left));
    return v;
  }

  // How far what floats above the sheet reaches over the map: the toolbox floating on a phone (or the toolbar
  // on a bottom panel's edge) and, on a phone, an open timeline under it (css/app.css's offsets). Worked out
  // from the sheet's settled top, since they follow the sheet as it moves.
  overSheet() {
    this.placeTools();
    const box = this.tools, wx = $('#wx-bar');
    const tools = box && !box.hidden && !box.classList.contains('docked') ? box.offsetHeight : 0;
    if (box && box.classList.contains('desk')) return tools; // (docked into a raised bottom panel: none)
    const time = wx && !wx.hidden && !document.body.classList.contains('wx-over') ? wx.offsetHeight : 0;
    return tools ? (time ? time + 20 : 8) + tools : time ? time + 8 : 0;
  }

  // The sheet's height once it has settled, from the heights in css/app.css. It changes height over --t-sheet (longer when
  // frames are slow), so a fit made in the same step as a size change would measure the old height, and what rides
  // above the sheet would chase it (#540): they take the size it's going to, at once.
  settledHeight() {
    const pl = this.panel, css = (k, d) => parseFloat(pl.style.getPropertyValue(k)) || d;
    const card = pl.classList.contains('carded');
    return { folded: css('--fold-h', 64), peek: css('--peek-h', 116), half: card ? css('--card-half', dvh() * 0.5) : dvh() * 0.5, full: card ? css('--card-full', dvh() - 76) : dvh() - 76 }[pl.dataset.state] ?? pl.offsetHeight;
  }
  sheetTop() {
    const pl = this.panel, r = pl.getBoundingClientRect();
    if (!this.sheetMove) return r.top;
    return r.bottom - slid(pl) - this.settledHeight();
  }

  // The sheet moves with transform, as a swipe does (DESIGN.md's Motion, #569): for a move it's as tall as the larger of
  // what shows and what it's going to, and slides between the two over its foot, growing on --t-sheet and shrinking on
  // --t-open, on --ease-drawer; at rest it's its own height again. A second change takes it from where it is. Only a
  // change you asked for moves (setSheetState(); sizes() only turns a running move). From the keyboard, with reduced
  // motion and while a swipe holds it, it changes at once.
  shownHeight() { return this.panel.hidden ? 0 : this.panel.offsetHeight - slid(this.panel); }
  moveSheet(from) {
    const p = this.panel, a = this.sheetMove;
    if (p.classList.contains('dragging')) return;
    const held = p.style.height;
    p.style.height = '';
    const to = p.offsetHeight;
    if (a && to === this.sheetTo) { p.style.height = held; return; } // (already going there)
    this.stopSheet();
    if (Math.abs(to - from) < 1 || p.hidden || this.sheetSlide || this.layout() !== 'sheet' || p.classList.contains('instant') || this.keyed || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const M = Math.max(from, to);
    p.style.height = `${M}px`;
    const m = this.sheetMove = p.animate([{ translate: `0 ${M - from}px` }, { translate: `0 ${M - to}px` }],
      { id: 'sheet', duration: token(to > from ? '--t-sheet' : '--t-open'), easing: cssVar('--ease-drawer'), fill: 'forwards' });
    this.sheetTo = to;
    m.onfinish = () => { if (this.sheetMove === m) this.stopSheet(); };
  }
  stopSheet() {
    this.sheetMove?.cancel();
    this.sheetMove = null;
    this.panel.style.height = '';
  }
  // the card a leaving sheet kept (onChange), once it's gone or turned back
  dropCardSeen() {
    if (this.cards.box || !this.els.card.firstChild) return;
    this.els.card.replaceChildren();
    this.els.card.hidden = true;
    this.panel.classList.remove('carded');
    this.cardSeen = null;
  }
  // The planner, or a card's sheet with it put away, comes and goes on a phone as Layers' drawer does: up from below the
  // screen on --t-sheet, down on --t-open, on --ease-drawer, from where it is when it turns back; with reduced motion it
  // fades; from the keyboard, as the page loads and on a wider screen, at once. Leaving, it takes no taps and the map's
  // room is back at once (main.js), so what rides above it goes down with it.
  showSheet(on, { instant = false } = {}) {
    const p = this.panel, a = this.sheetSlide;
    if (on === (!p.hidden && !p.classList.contains('leaving'))) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, prop = reduce ? 'opacity' : 'translate';
    const now = a && getComputedStyle(p)[prop];
    p.dispatchEvent(new Event('sheetchange'));
    a?.cancel();
    this.sheetSlide = null;
    this.stopSheet();
    if (on) this.dropCardSeen(); // (turned back, or the planner opening: not the card that was leaving)
    // (a swipe away has already taken it off the screen: it's gone at once)
    const slides = !instant && !this.keyed && !p.classList.contains('dragging') && this.layout() === 'sheet' && !this.sideMQ.matches;
    p.classList.toggle('leaving', !on && slides);
    if (this.tools) this.tools.inert = !on && slides; // (the toolbox goes down with it, and takes no taps either)
    p.hidden = !on && !slides;
    if (!slides) return;
    const away = reduce ? '0' : '0 calc(100% + 12px)', here = reduce ? '1' : '0 0'; // (12 px: the sheet's foot over the screen's)
    const s = this.sheetSlide = p.animate([{ [prop]: now || (on ? away : here) }, { [prop]: on ? here : away }],
      { id: 'sheet', duration: reduce ? 150 : token(on ? '--t-sheet' : '--t-open'), easing: cssVar(reduce ? '--ease-out' : '--ease-drawer'), fill: 'forwards' });
    s.onfinish = () => {
      if (this.sheetSlide !== s) return;
      this.sheetSlide = null;
      if (!on) { p.hidden = true; p.classList.remove('leaving'); this.tools.inert = false; this.dropCardSeen(); this.placeTools(); } // (the toolbox went down with it)
      s.cancel();
    };
    p.dispatchEvent(new Event('sheetstate')); // (main.js: the map's room, and what rides above the sheet)
  }

  /** Frame bounds [w, s, e, n] in the map the planner leaves free. A full sheet leaves no map
   *  to frame in, so it comes down to half first (not remembered), unless `lower` is false. */
  frame(b, { lower = true, ...opts } = {}) {
    this.fitAt = null; // (framed on something: fitRoute() says again when it's the whole route)
    if (lower && this.active && this.layout() === 'sheet' && this.panel.dataset.state === 'full') this.setSheetState('half', { remember: false });
    this.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: this.viewPadding(), maxZoom: 16, ...opts });
  }

  // ---------------------------------------------------------------- the toolbox (25a)
  // How the next leg is drawn, undo, redo and More, outside the panel (#pl-tools). Phones float it
  // above the sheet beside the map's buttons, or dock it into the sheet as its first row where it
  // doesn't fit; desktops hang it off the panel's edge as a labelled toolbar (placeTools()).
  buildTools() {
    const box = this.tools = $('#pl-tools');
    box.innerHTML = '';
    const tb = (name, label, fn, cls = '') => h('button', { type: 'button', class: `tbtn ${cls}`, 'aria-label': label, onclick: fn, html: icon(name, 20) });
    const sep = (cls = '') => h('span', { class: `tb-sep tb-desk ${cls}`, 'aria-hidden': 'true' });
    // phones: one drop-down for the modes, the route style under the mode's name
    this.els.modeBtn = h('button', { type: 'button', class: 'modebtn tb-phone', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: () => this.toggleModes(this.els.modeBtn) });
    // desktops: the modes with their names and keys, then the route style
    this.els.modeSeg = h('div', { class: 'seg tb-modes tb-desk', role: 'radiogroup', 'aria-label': 'Draw the next leg' },
      ...MODES.map((m) => h('button', { type: 'button', role: 'radio', 'data-mode': m, 'aria-keyshortcuts': MODE_KEY[m], onclick: () => this.setMode(m), html: `${icon(MODE_ICON[m], 19)}<span>${MODE_LABEL[m]}</span>` })));
    this.els.styleBtn = h('button', { type: 'button', class: 'stylebtn tb-desk', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: () => this.toggleModes(this.els.styleBtn) });
    // desktops: the next leg's sport, before the style it decides (as the phones' "Hike · Balanced"); its menu is
    // the phones' Next leg (B of #233; beside the style rather than first, decided while building, 2026-10-20)
    this.els.sportBtn = h('button', { type: 'button', class: 'sportbtn tb-desk', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: () => this.toggleModes(this.els.sportBtn, { next: true }) });
    this.els.undo = tb('undo', 'Undo', () => this.undo(), 'tb-hist');
    this.els.undo.setAttribute('aria-keyshortcuts', 'Control+Z');
    this.els.redo = tb('redo', 'Redo', () => this.redo(), 'tb-hist');
    this.els.redo.setAttribute('aria-keyshortcuts', 'Control+Shift+Z');
    // The route's actions that show where there's room, by `data-opt` (the lowest stays longest); the rest are
    // in More, never both (placeTools()). Show the whole route only on desktops: phones have it in the map's column.
    const opt = (b, k, group) => { b.dataset.opt = k; b.dataset.group = group; return b; };
    this.els.fit = opt(tb('fit', 'Show the whole route', () => this.fitRoute(), 'tb-desk'), 0, 'nav');
    this.els.fit.setAttribute('aria-keyshortcuts', 'F');
    this.els.reverse = opt(tb('reverse', 'Reverse', () => this.reverse()), 1, 'nav');
    this.els.backToStart = opt(tb('loop', 'Back to start', () => this.backToStart()), 2, 'nav');
    this.els.share = opt(tb('link', 'Share link', () => this.share()), 3, 'take');
    this.els.gpx = opt(tb('download', 'Export GPX', () => this.exportGpx()), 4, 'take');
    this.els.offline = opt(tb('offline', 'Save offline…', () => this.app.saveOffline()), 5, 'take');
    this.els.clearTool = opt(tb('trash', 'Clear route', () => this.clear(), 'danger'), 6, 'clear');
    this.els.more = tb('more', 'More: the whole route’s actions', () => this.toggleMore());
    this.els.more.setAttribute('aria-haspopup', 'menu');
    this.els.more.setAttribute('aria-expanded', 'false');
    this.els.toolDone = h('button', { type: 'button', class: 'btn done tb-desk', 'aria-keyshortcuts': 'E', onclick: () => this.done() }, 'Done');
    // the route's view (25c): Edit where Done was
    this.els.toolEdit = h('button', { type: 'button', class: 'btn done edit tb-desk', 'aria-keyshortcuts': 'E', onclick: () => this.setEditing(true), html: `${icon('pencil', 18)}<span>Edit</span>` });
    const gsep = (group) => { const el = sep(); el.dataset.group = group; return el; };
    box.append(this.els.modeBtn, this.els.modeSeg, sep(), this.els.sportBtn, this.els.styleBtn, sep('tb-hist'), this.els.undo, this.els.redo,
      gsep('nav'), this.els.fit, this.els.reverse, this.els.backToStart, gsep('take'), this.els.share, this.els.gpx, this.els.offline,
      gsep('clear'), this.els.clearTool, sep(), this.els.more, this.els.toolDone, this.els.toolEdit);
    for (const b of this.els.modeSeg.children) tooltip(b, TIPS[b.dataset.mode]);
    for (const k of ['undo', 'redo', 'reverse', 'backToStart', 'fit', 'share', 'gpx', 'offline', 'more']) tooltip(this.els[k], TIPS[k]);
    tooltip(this.els.clearTool, TIPS.clear);
    tooltip(this.els.styleBtn, TIPS.style);
    tooltip(this.els.sportBtn, TIPS.sport);
    tooltip(this.els.toolDone, TIPS.done);
    tooltip(this.els.toolEdit, TIPS.edit);
    // a toolbar: one stop for Tab, the arrows move along it
    box.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      const list = this.toolItems(), k = list.indexOf(document.activeElement);
      if (k < 0) return;
      e.preventDefault();
      const next = list[e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (k + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
      this.rove(next);
      next.focus();
    });
    box.addEventListener('focusin', (e) => { if (e.target.closest('button')) this.rove(e.target.closest('button')); });
    new ResizeObserver(() => this.placeToolsSoon()).observe(this.panel);
    addEventListener('resize', () => this.placeToolsSoon());
    this.renderTools();
  }

  toolItems() { return [...this.tools.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent !== null); }

  rove(to) {
    const list = this.toolItems();
    if (!list.includes(to)) to = list[0];
    for (const b of this.tools.querySelectorAll('button')) b.tabIndex = b === to ? 0 : -1;
  }

  // The toolbox's words and states: the mode in use (filled, and ticked in its menu), the style it
  // routes with, and undo and redo, there from the first change and disabled when they can't (#241).
  renderTools() {
    if (!this.els || !this.els.modeBtn) return;
    // the next leg as it will be drawn: its mode, its sport (from the first point, B of #233) and the style it's routed in
    const m = this.mode, ns = this.nextLegSport(), sport = ACTIVITIES[ns].label, name = styleName(ns, this.styleOf(ns));
    // the style is what Follow paths (or the water router, paddling) prefers; a straight line has none
    const styled = m === 'auto' || (m === 'water' && isWater(ns));
    // the sport stays whole and the style shortens when there's no room (css/app.css)
    this.els.modeBtn.innerHTML = `${icon(MODE_ICON[m], 20)}<span class="two"><b>${MODE_LABEL[m]}</b><small><span class="tb-sport">${escapeHtml(sport)}</span>${styled ? `<span class="tb-style">&nbsp;· ${escapeHtml(name)}</span>` : ''}</small></span>${icon('chevronDown', 14)}`;
    this.els.modeBtn.setAttribute('aria-label', `Draw the next leg: ${MODE_LABEL[m]}, ${sport}${styled ? `, route style ${name}` : ''}`);
    this.els.sportBtn.innerHTML = `${icon(this.sportIcon(ns), 18)}<span>${escapeHtml(sport)}</span>${icon('chevronDown', 12)}`;
    this.els.sportBtn.setAttribute('aria-label', `Next leg: ${sport}`);
    for (const b of this.els.modeSeg.children) b.setAttribute('aria-checked', String(b.dataset.mode === m));
    this.els.styleBtn.innerHTML = `<span class="two"><small>Route style</small><span>${escapeHtml(name)}</span></span>${icon('chevronDown', 12)}`;
    this.els.styleBtn.setAttribute('aria-label', `Route style: ${name}`);
    const n = this.points.length, hist = !!(this.past.length || this.future.length);
    // It grows with the route (2026-10-20): before the first point nothing of it can do anything yet (the first
    // tap only puts the start down), so only undo and redo show, and only with something to undo or redo; at the
    // first point how the next leg is drawn and More (Clear route); with a leg the route's actions too, as far
    // as there's room (placeTools()). New buttons fade in where they are (fadeNewTools()).
    // While a round trip is open nothing is drawn: only undo and redo stay, until a loop is taken or the form closes (#311)
    // In the route's view nothing is drawn (25c): phones keep only More, desktops Show the whole route, More and Edit
    // A card in a phone's peek: only undo and redo too, until it closes (25d)
    // The planner folded on a phone: how the next leg is drawn (its icon) beside undo and redo, since a tap on the map
    // still adds a point (step 3 of #233)
    const carded = this.cards.place === 'peek' && !this.sideMQ?.matches, loop = this.loop.open || carded, view = this.inView();
    const folded = this.panel.dataset.state === 'folded' && !this.sideMQ?.matches && !loop;
    this.tools.dataset.stage = view ? 'view' : carded ? 'card' : loop ? 'loop' : folded ? 'folded' : String(Math.min(n, 2));
    this.tools.setAttribute('aria-label', view ? 'Your route' : 'Drawing tools');
    this.els.modeBtn.hidden = !n || loop || view;
    for (const el of [this.els.sportBtn, this.els.modeSeg, this.els.styleBtn, ...this.tools.querySelectorAll('.tb-sep:not([data-group])')]) el.hidden = !n || loop || view || folded;
    this.els.more.hidden = !n || loop || folded;
    for (const el of this.tools.querySelectorAll('.tbtn.tb-hist')) el.hidden = !(hist || n) || view;
    this.els.undo.disabled = !this.past.length;
    this.els.redo.disabled = !this.future.length;
    this.els.reverse.disabled = n < 2;
    this.els.backToStart.disabled = n < 2 || this.isLoop();
    this.els.fit.disabled = n < 2;
    for (const k of ['share', 'gpx', 'offline']) this.els[k].disabled = n < 2;
    this.els.clearTool.disabled = !n;
    this.els.toolDone.hidden = !n || loop || view || folded; // no Done before the first point (Back is the way out of a start step, A), nor in a round trip
    this.els.toolEdit.hidden = !view;
    // Show the whole route in the map's column: whenever a route is on the map, but on desktops
    // the toolbar has it while planning
    const col = document.getElementById('btn-fit');
    if (col) col.hidden = n < 2 || (this.active && !!this.sideMQ?.matches);
    if (!this.tools.contains(document.activeElement)) this.rove(this.tools.querySelector('button[tabindex="0"]'));
    this.placeToolsSoon();
  }

  placeToolsSoon() {
    cancelAnimationFrame(this.toolsFrame);
    this.toolsFrame = requestAnimationFrame(() => this.placeTools());
  }

  // Where the toolbox goes, and which of the route's actions it shows (the rest are in More). Phones:
  // floating at the bottom left, above the sheet, while it clears the map's buttons and the top bar;
  // otherwise docked into the sheet as its first row (a narrow phone, long words, 200 % zoom, a raised
  // sheet), with the actions that fit without another row. Desktops: on the panel's edge, with the actions
  // that fit before the map's buttons, then shortened (FOLDS).
  placeTools() {
    this.placeToolsNow();
    this.fadeNewTools();
  }

  // What has just appeared on the toolbox fades in where it is: nothing slides or pushes, its left edge and the
  // map's buttons stay put (it grows to the right). With reduced motion it simply appears (css/app.css).
  fadeNewTools() {
    const box = this.tools;
    if (!box) return;
    const now = new Set(box.hidden ? [] : [box, ...[...box.children].filter((el) => !el.hidden && el.offsetParent !== null)]);
    const fresh = this.toolsShown ? [...now].filter((el) => !this.toolsShown.has(el)) : [];
    for (const el of fresh) {
      el.classList.remove('tb-new');
      void el.offsetWidth;
      el.classList.add('tb-new');
      setTimeout(() => el.classList.remove('tb-new'), 400);
    }
    if (fresh.length) this.toolsFaded = fresh; // (the tests read what came last)
    this.toolsShown = now;
  }

  placeToolsNow() {
    const box = this.tools;
    if (!box || !this.sideMQ) return;
    // no toolbox until there's something it can do: a point, or something to undo or redo
    const desk = this.sideMQ.matches;
    // (a card in a phone's peek keeps undo and redo here, or in its own top row when it's narrow; none in the route's view, 25d,
    // nor with the planner folded there)
    const carded = this.cards.place === 'peek' && !desk, folded = !desk && this.panel.dataset.state === 'folded';
    const show = (this.active || this.panel.classList.contains('leaving')) && !this.panel.hidden && !!(this.points.length || this.past.length || this.future.length) && !(carded && ((this.cards.narrow && !folded) || this.inView())) && !(folded && this.inView());
    box.hidden = !show;
    box.classList.toggle('desk', desk);
    if (!show) this.dockTools(false);
    // the room it takes above the sheet, or the window's foot beside a side panel, for what sits there too
    // (--tools-h: the scale, notes, the 3D pad, a track's card, the timeline)
    const toolsH = (px) => document.documentElement.style.setProperty('--tools-h', `${px}px`);
    if ((!show || desk) && document.documentElement.style.getPropertyValue('--col-lift') !== '0px') { document.documentElement.style.setProperty('--col-lift', '0px'); requestAnimationFrame(() => this.app.fitColumn?.()); }
    if (!show) { toolsH(0); return; }
    const colLeft = $('#map-ctrls').getBoundingClientRect().left;
    // the route's actions once there's a leg (Back to start not on a loop); in turn, as far as there's room
    const view = this.inView(); // (the route's view: of them only Show the whole route, on desktops, 25c)
    const can = (b) => this.points.length > 1 && !this.loop.open && !carded && !folded && !(b === this.els.backToStart && this.isLoop()) && (desk || !b.classList.contains('tb-desk')) && (!view || b === this.els.fit);
    for (const b of box.querySelectorAll('[data-opt]')) if (!can(b)) b.hidden = true;
    const opts = [...box.querySelectorAll('[data-opt]')].filter(can).sort((a, b) => a.dataset.opt - b.dataset.opt);
    // the first n of them on the toolbar (in `root`, the toolbox or a copy of it), each group's separator with them
    const setOpts = (root, n) => {
      opts.forEach((b, i) => { (root === box ? b : root.querySelector(`[data-opt="${b.dataset.opt}"]`)).hidden = i >= n; });
      for (const g of root.querySelectorAll('.tb-sep[data-group]')) g.hidden = !root.querySelector(`button[data-group="${g.dataset.group}"]:not([hidden])`);
    };
    if (desk) {
      const r = this.panel.getBoundingClientRect(), side = this.layout() === 'side';
      // a bottom panel raised up to the top bar has no room above it: the toolbar is its first row then
      const inPanel = !side && r.top - 56 < $('.topbar').getBoundingClientRect().bottom + 8;
      this.peekDocks = this.panel.dataset.state === 'peek' ? inPanel : !side && innerHeight - this.peekBare - 56 < $('.topbar').getBoundingClientRect().bottom + 8;
      this.dockTools(inPanel);
      box.classList.toggle('at-side', side);
      box.classList.toggle('at-bottom', !side && !inPanel);
      // beside a side panel at the map's foot, however tall the panel is (#468)
      Object.assign(box.style, { maxWidth: '' }, inPanel ? { left: '', top: '', bottom: '' } : side ? { left: `${r.right}px`, top: '', bottom: '12px' } : { left: `${r.left}px`, top: '', bottom: `${innerHeight - r.top}px` });
      // the map's buttons only count where they're level with the toolbar
      const col = $('#map-ctrls').getBoundingClientRect(), b = box.getBoundingClientRect();
      const limit = col.top < b.bottom + 8 ? colLeft - 12 : innerWidth - 12;
      const over = () => (inPanel ? box.scrollWidth > box.clientWidth + 1 : box.getBoundingClientRect().right > limit);
      // in turn: the route's actions from the last, the style's caption, the names of the modes not in use, the
      // sport's name (its icon stays), Show the whole route (an action to keep in sight), all the modes' names,
      // then the style's name shortens; last, beside the side panel of a narrow window, a second row above the first
      box.classList.remove(...FOLDS);
      setOpts(box, opts.length);
      const steps = [];
      for (let n = opts.length - 1; n >= 1; n--) steps.push(() => setOpts(box, n));
      steps.push(() => box.classList.add('fold1'), () => box.classList.add('fold2'), () => box.classList.add('foldS'), () => setOpts(box, 0), () => box.classList.add('fold3'), () => box.classList.add('fold4'));
      if (side) steps.push(() => { box.classList.add('tb-rows'); box.style.maxWidth = `${limit - r.right}px`; });
      for (const step of steps) {
        if (!over()) break;
        step();
      }
      // (a bottom panel's own height is --sheet-h already)
      const tb = box.getBoundingClientRect();
      toolsH(inPanel ? 0 : Math.round(side ? innerHeight - tb.top : innerHeight - r.bottom + tb.height));
      return;
    }
    box.classList.remove('at-side', 'at-bottom', ...FOLDS);
    Object.assign(box.style, { left: '', top: '', bottom: '', maxWidth: '' });
    // measured as it would float: a copy, so the sheet's size doesn't change while measuring
    const probe = box.cloneNode(true);
    probe.classList.remove('docked');
    probe.classList.add('probe');
    document.body.append(probe);
    let n = opts.length;
    setOpts(probe, n);
    while (n > 0 && 8 + probe.offsetWidth + 8 > colLeft) setOpts(probe, --n);
    const w = probe.offsetWidth, th = probe.offsetHeight;
    probe.remove();
    if (!w) return; // not laid out (a hidden pane): leave it where it is
    // the sheet's height without a docked toolbox in it (the peek's, peekBare)
    const px = (v) => parseFloat(this.panel.style.getPropertyValue(v)) || 0;
    const st = this.panel.dataset.state;
    const sheetH = { folded: px('--fold-h'), peek: this.peekBare, half: carded ? px('--card-half') : innerHeight * 0.5, full: carded ? px('--card-full') : innerHeight - 76 }[st] ?? this.panel.offsetHeight;
    const wxH = parseFloat(document.documentElement.style.getPropertyValue('--wx-h')) || 0; // an open timeline under it
    const topBar = $('.topbar').getBoundingClientRect().bottom, docks = (sh) => 8 + w + 8 > colLeft || innerHeight - sh - wxH - 16 - th < topBar + 8;
    if (!folded) this.peekDocks = docks(this.peekBare); // (at any size but the line, whose toolbox is smaller: the peek is measured with it there or not, #586)
    // (folded, it floats: the line has no room for it; a card swiped up is as tall as it is, so it floats while there's room)
    const dock = !folded && ((st === 'full' && !carded) || docks(sheetH));
    this.dockTools(dock);
    if (dock) {
      // as many as fit without another row (the sheet's size follows once, below)
      setOpts(box, 0);
      const rows = box.offsetHeight;
      let k = 0;
      while (k < opts.length) { setOpts(box, k + 1); if (box.offsetHeight > rows + 1) break; k++; }
      setOpts(box, k);
      this.measureSheet?.();
    } else setOpts(box, n);
    toolsH(dock ? 0 : 16 + th); // from the sheet (and an open timeline) to the toolbox's top
    // folded on a narrow screen (200 %) it floats where it doesn't clear the map's buttons: they rise above its row
    const lift = `${!dock && 8 + w + 8 > Math.min(colLeft, innerWidth - 66) ? th + 8 : 0}px`; // (66: the column's widest button, whatever it shows now)
    if (document.documentElement.style.getPropertyValue('--col-lift') !== lift) { document.documentElement.style.setProperty('--col-lift', lift); requestAnimationFrame(() => this.app.fitColumn?.()); }
  }

  dockTools(on) {
    const box = this.tools;
    // a single button, the route's view's ⋯, joins ⌄'s row at its left (step 3 of #233); the whole toolbox gets a row
    const where = !on ? document.body : this.inView() && this.els.top.offsetHeight > 18 ? this.els.top.firstElementChild : this.panel;
    if (box.classList.contains('docked') === on && box.parentElement === where) return;
    box.classList.toggle('docked', on);
    if (where === this.panel) this.panel.insertBefore(box, this.els.head);
    else if (on) where.append(box);
    else document.body.insertBefore(box, this.panel.nextSibling);
    this.measureSheet?.(); // the peek includes a docked toolbox
  }

  // More's title: the route's own name (an imported track's, a picked loop's), else its first and
  // last points' (named, or the road they're on)
  routeTitle() {
    const n = this.points.length;
    if (!n) return '';
    if (this.routeName) return this.routeName;
    if (n === 1) return this.nameOf(0);
    return this.isLoop() ? `Round trip from ${this.nameOf(0)}` : `${this.nameOf(0)} → ${this.nameOf(n - 1)}`;
  }

  // Phones: the mode's menu: "Draw the next leg", the next leg's sport and speed, and the route style for the
  // whole route. Desktops: the style button's menu (the modes are in the toolbar itself), and the sport
  // button's (`next`), the phones' sport part. The styles are the next leg's sport's: the ones its button names.
  toggleModes(anchor, { next = false } = {}) {
    if (this.modesMenu) { this.modesMenu.close(); return; }
    this.closeMore();
    const desk = this.tools.classList.contains('desk');
    this.nlOpen = false;
    this.nlSpeed = false;
    const items = () => {
      if (next) return [{ group: 'Sport · the legs you draw next', items: this.nextLegItems(refill) }];
      const ns = this.nextLegSport(), rs = this.styleOf(ns), cat = STYLES[ns] || STYLES.mtb, custom = isCustom(ns, rs);
      const pick = (k, label) => {
        this.styleLeg = null;
        this.setStyle({ p: k, v: {}, wet: rs.wet || 'auto' }, null, ns);
        const own = this.legs.some((l) => l.style);
        if (this.points.length > 1) toast(`Route style: ${label} · the route is routed again${own ? '; legs with their own style keep it' : ''}`, { ms: 6000, action: { label: 'Undo', fn: () => this.undo() } });
      };
      const styles = { group: 'Route style · the whole route', items: [
        { chips: [...cat.presets.map(([k, label]) => ({ label: escapeHtml(label), radio: true, checked: !custom && rs.p === k, fn: () => pick(k, label) })),
          custom ? { label: 'Custom', radio: true, checked: true, disabled: true, fn: () => {} } : null] },
        { icon: 'sliders', label: 'Fine-tune in How you go', fn: () => { this.styleLeg = null; this.openStep('how', ns); } },
      ] };
      // in the order the button reads: how it's drawn, its sport ("Hike · Balanced") and the style
      // three parts, apart: how the next leg is drawn (and its note), its sport and speed, the whole route's style
      return [
        desk ? null : { group: 'Draw the next leg', items: MODES.map((m) => ({ icon: MODE_ICON[m], label: MODE_LABEL[m], desc: MODE_DESC[m], radio: true, checked: this.mode === m, fn: () => this.setMode(m) })) },
        desk || !this.legs.length ? null : { note: 'Only the legs you draw next. To change a drawn leg, tap it on the map.' },
        desk ? null : 'hr',
        desk ? null : { group: 'Sport · the legs you draw next', items: this.nextLegItems(refill) },
        desk ? null : 'hr',
        styles,
      ];
    };
    // a choice inside it changes what it lists: drawn again in place, the focus where it was
    const refill = (focus) => {
      if (!this.modesMenu) return;
      this.modesMenu.refill(items());
      const el = focus && this.modesMenu.el.querySelector(focus);
      if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }); }
    };
    this.modesMenu = popMenu(anchor, items(), { label: next ? 'Next leg' : desk ? 'Route style' : 'Draw the next leg', align: 'left', maxRight: $('#map-ctrls').getBoundingClientRect().left - 8, sheet: !desk,
      onClose: () => { this.modesMenu = null; anchor.setAttribute('aria-expanded', 'false'); } });
    anchor.setAttribute('aria-expanded', 'true');
  }

  // Next leg (B of #233): the next leg's sport, which opens the sport menu's own items for every sport (picking one
  // is Only the legs you draw next: pickNext()), and its speed, whose editor (Your speed's) opens in place
  nextLegItems(refill) {
    const ns = this.nextLegSport(), out = [];
    // the sport, which opens the list of sports in its place (yours ticked); a pick folds it again
    if (this.nlOpen) {
      out.push(...this.app.sportItems({ checked: ns, route: this.points.length > 1 ? this.routeSports() : [], fn: (k) => { this.nlOpen = false; this.pickNext(k); refill('.nl-sport'); } })
        .map((it) => ({ ...it, keep: true, cls: 'nl-pick' })));
    } else {
      out.push({ icon: this.sportIcon(ns), label: escapeHtml(ACTIVITIES[ns].label), desc: 'Legs already drawn keep their sport', keep: true, expanded: false, cls: 'nl-sport',
        after: icon('chevronDown', 16), fn: () => { this.nlOpen = true; this.nlSpeed = false; refill('.nl-pick[aria-checked="true"]'); } });
    }
    out.push({ icon: 'clock', label: `<span class="nl-line">Your speed: ${escapeHtml(this.speedLine(ns))}</span>`, keep: true, expanded: !!this.nlSpeed, cls: 'nl-speed',
      after: `<span class="nl-speeds">Change</span>${icon(this.nlSpeed ? 'chevronUp' : 'chevronDown', 16)}`, fn: () => { this.nlSpeed = !this.nlSpeed; this.nlOpen = false; refill('.nl-speed'); } });
    if (this.nlSpeed) {
      const box = h('div', { class: 'nl-editor' });
      const line = () => { const el = box.closest('.menu')?.querySelector('.nl-line'); if (el) el.textContent = `Your speed: ${this.speedLine(ns)}`; };
      renderSpeedEditor(box, ns, { craft: this.craft, onCraft: (c) => this.setCraft(c), onChange: () => { this.retime(); line(); } });
      out.push({ node: box });
    }
    return out;
  }

  // a sport's speed in one line: "Normal · 20 / 16 / 11 km/h · 600 m/h up"; paddling, its craft: "Sea kayak · 6.5 km/h"
  speedLine(sport) { const s = speedSummary(sport, this.craft); return sport === 'paddle' ? s.txt : `${s.name} · ${s.txt}`; }

  // ---------------------------------------------------------------- More (⋯)
  // The whole route's actions: take it along, the whole route, and Clear apart (with Undo in a note).
  // Moving the panel stays at the end of the tabs' row and in Settings.
  toggleMore() {
    if (this.moreMenu) { this.moreMenu.close(); return; }
    this.modesMenu?.close();
    const n = this.points.length, none = n < 2;
    const desk = this.tools.classList.contains('desk');
    // what's on the toolbar isn't repeated here
    const off = (el) => (el && !el.hidden && el.offsetParent !== null ? null : true);
    const group = (title, items) => (items.some(Boolean) ? { group: title, items } : null);
    const take = group('Take it along', [
      !none && off(this.els.share) && { icon: 'link', label: 'Share link', desc: this.shareSub() || 'Copies a link to this route', fn: () => this.share() },
      !none && off(this.els.gpx) && { icon: 'download', label: 'Export GPX', desc: 'For a GPS watch or another app', fn: () => this.exportGpx() },
      !none && off(this.els.offline) && { icon: 'offline', label: 'Save offline…', desc: 'The map and terrain, for no signal', fn: () => this.app.saveOffline() },
    ]);
    const whole = group('The whole route', [
      (desk || $('#map-ctrls').classList.contains('no-fit')) && !none && off(this.els.fit) && { icon: 'fit', label: 'Show the whole route', fn: () => this.fitRoute() }, // (phones: where the map's column let go of it, #344)
      roundTripSports.includes(this.app.activity()) ? { icon: 'roundtrip', label: n ? 'Round trip from the start' : 'Round trip', fn: () => this.openLoop() } : null,
      !none && off(this.els.reverse) && { icon: 'reverse', label: 'Reverse', fn: () => this.reverse() },
      !none && !this.isLoop() && off(this.els.backToStart) && { icon: 'loop', label: 'Back to start', fn: () => this.backToStart() },
      { icon: 'upload', label: 'Import GPX or KML…', desc: 'Shows a file’s track, to plan on', fn: () => $('#file-input').click() },
    ]);
    const clear = off(this.els.clearTool) && { icon: 'trash', label: 'Clear route', desc: 'Undo brings it back', fn: () => this.clear(), cls: 'danger menu-apart', disabled: !n };
    this.moreMenu = popMenu(this.els.more, [
      n ? { head: this.routeTitle(), sub: 'Kept on this device' } : null,
      take, take && whole ? 'hr' : null, whole, clear ? 'hr' : null, clear,
    ], { label: 'More', maxRight: desk ? null : $('#map-ctrls').getBoundingClientRect().left - 8, sheet: !desk,
      onClose: () => { this.moreMenu = null; this.els.more.setAttribute('aria-expanded', 'false'); } });
    this.els.more.setAttribute('aria-expanded', 'true');
  }

  closeMore() {
    if (this.moreMenu) this.moreMenu.close();
  }

  setCraft(k) {
    this.craft = k;
    store.set('craft', k);
    this.renderStart(); // the start's sport row names the craft
    if (this.legs.some((l) => l.mode === 'water')) this.routeAll(); // how rough is too rough depends on the craft
    else this.retime();
  }

  // "Time & speed": your speeds for this sport (editable) and where the time goes on this route.
  // your speeds for the route's sports (the main one first), in `box`: How you go's, and Go › Time's Change
  speedEditors(box) {
    const act = this.mainSport();
    renderSpeedEditor(box, act, { craft: this.craft, onCraft: (k) => this.setCraft(k), onChange: () => this.retime() });
    // a multisport route: the other sports' speeds too
    for (const sp of this.routeSports().filter((x) => x !== act)) {
      const sub = h('div', { class: 'speed-other' });
      box.append(h('h4', { class: 'speed-sport', html: `${icon(this.sportIcon(sp), 14)} ${escapeHtml(ACTIVITIES[sp].label)}` }), sub);
      renderSpeedEditor(sub, sp, { craft: this.craft, onCraft: (k) => this.setCraft(k), onChange: () => this.retime() });
    }
  }

  renderSpeed() {
    const a = this.analysis;
    const act = this.mainSport();
    // your speeds: in Route › How you go, beside the route style (there before there's a route too)
    this.speedEditors(this.els.speedBox);
    this.renderHow();
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
    // There at, under Leave (#424's C) [tabs-c-go]
    box.append(h('div', { class: 'time-head' }, h('b', {}, `${this.isLoop() ? 'Back' : 'There'} at ${this.clockOf(t0 + total)}`), h('span', {}, `${fmtDuration(total)} on the way`)),
      h('div', { class: 'speed-table' },
        ...rows.map((k) => h('div', { class: 'speed-row' }, h('span', {}, LABEL[k]), h('b', {}, fmtDist(cats[k].d)), h('b', {}, fmtDuration(cats[k].t)), h('small', {}, speedTxt(cats[k].d, cats[k].t)))),
        up > 30 && !isWater(act) ? h('div', { class: 'speed-row sub' }, h('span', {}, 'of which uphill (over 3 %)'), h('b', {}, ''), h('b', {}, fmtDuration(up)), h('small', {}, '')) : null,
        a.timeWind ? h('div', { class: 'speed-row sub' }, h('span', {}, a.snowSec >= 60 ? 'the wind and the snow' : 'the wind'), h('b', {}, ''), h('b', {}, Math.abs(a.timeWind - a.time) < 60 ? 'about ±0' : `${a.timeWind > a.time ? '+' : '−'}${fmtDuration(Math.abs(a.timeWind - a.time))}`), h('small', {}, 'included above')) : null,
        a.snowSec >= 60 ? h('div', { class: 'speed-row sub' }, h('span', {}, 'of which the snow'), h('b', {}, ''), h('b', {}, `+${fmtDuration(a.snowSec)}`), h('small', {}, `${Math.round(a.snow.max)} cm at most (forecast)`)) : null,
        ...this.sportRows(a, tAt, speedTxt),
        h('div', { class: 'speed-row total' }, h('span', {}, waitSec ? 'Total time' : 'Moving time'), h('b', {}, fmtDist(a.total)), h('b', {}, fmtDuration(a.timeWind || a.time)), h('small', {}, speedTxt(a.total, (a.timeWind || a.time) - waitSec)))));
    // what the time is based on: Your speed ›, its step in Route (#424's C)
    box.append(h('div', { class: 'rows' }, this.speedRow()));
  }

  // why the weather isn't known, for the key facts (null: it is, or it's on its way)
  noWeather(a) {
    if ((this.leaveAt != null && this.leaveAt - Date.now() / 1000 >= LONG_HOURS * 3600) || (a.wind && a.wind.beyond === 0)) return 'no forecast yet';
    return a.windError ? 'couldn’t be loaded' : null;
  }
  keyFacts(a) {
    const days = a.waits ? tripDays(a, a.tAtWind || a.tAt, a.wind ? a.wind.startSec : this.startSec(), a.waits) : [];
    return keyFacts(a, { sport: this.mainSport(), days, noWeather: this.noWeather(a) });
  }

  // Key facts (#471's A2) [kf2-gravel, kf2-multi, kf2-days]: one line under the route's numbers saying what stands out on
  // this route, else the sport's usual fact; a row a sport on a route of two. A tap opens where it's told in full.
  renderFacts(a) {
    const box = this.els.facts, multi = !!a && this.isMulti();
    box.hidden = !a;
    box.classList.toggle('legs', multi);
    if (!a) { box.replaceChildren(); return; }
    const list = multi ? sportFacts(a, { noWeather: this.noWeather(a) }) : factLine(this.keyFacts(a));
    const ICON = { wind: 'wind', rain: 'rain', bwind: 'wind', unpaved: 'route', day: 'moon', climb: 'mountain', high: 'mountain', wx: 'cloudSun' };
    box.replaceChildren(...list.map((x) => h('button', { type: 'button', class: `kf-b${x.miss ? ' miss' : ''}`, 'aria-label': x.aria, onclick: () => this.openFact(x) },
      h('span', { 'aria-hidden': 'true', html: icon(ICON[x.k] || this.sportIcon(x.sport), 16) }), h('span', { html: x.html }),
      h('span', { 'aria-hidden': 'true', html: icon('chevronRight', 14) }))));
  }
  openFact(x) {
    const a = this.analysis;
    if (x.k === 'climb') { this.reveal('climbs'); this.focusRange(x.v.start, x.v.end, x.v); return; }
    if (x.k === 'unpaved') { this.showMode('surface'); this.reveal('colours'); return; }
    if (x.k === 'high') { this.reveal('profile'); return; }
    if (x.k === 'day' || x.sport) {
      // its part of the list, lit: a day's section, or the first of the sport's (its weather open on the water)
      const sec = this.sections().find((s) => (x.sport ? s.sport === x.sport : Math.abs(this.lengthTo(s.from) - x.v.from) < 2));
      if (!sec) return;
      this.secLit = this.pidOf(this.points[sec.from]);
      if (x.sport && isWater(x.sport)) this.wxOpen.add(this.secLit);
      this.renderWaypoints();
      this.reveal('points', { flash: false }); // (the part lights up, not the whole list: its scroll would win)
      // in sight once a rising sheet has its size (--t-sheet), then lit up: one scroll, as a smooth one still on its way
      // took the list past the part's heading
      setTimeout(() => { const el = this.els.points.querySelector('.sec2.lit'); if (el) { el.scrollIntoView({ block: 'nearest' }); this.flash(el); } }, 400);
      return;
    }
    if (a) this.reveal('depart'); // the wind, the rain, a headwind, the weather not known: the weather along the route
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
    const split = sportSplit(a, tAt, a.activity, a.waitAt);
    return [
      h('div', { class: 'speed-row sub head' }, h('span', {}, this.isMulti() ? 'By sport' : 'Moving and stops'), h('b', {}, ''), h('b', {}, ''), h('small', {}, '')),
      ...split.map((x) => h('div', { class: 'speed-row sub' }, h('span', { html: `${icon(this.sportIcon(x.sport), 13)} ${escapeHtml(ACTIVITIES[x.sport].label)}` }), h('b', {}, fmtDist(x.dist)), h('b', {}, fmtDuration(Math.max(0, x.time))), h('small', {}, speedTxt(x.dist, x.time)))),
      ...[['change', 'Changeovers', 'yours to set on each point'], ['break', 'Breaks', ''], ['night', 'Nights', 'until the hour you go on']].map(([k, label, note]) => {
        const ws = waits.filter((w) => (k === 'change' ? w.change > 0 : k === 'night' ? isNight(w.stop) : w.stop && !isNight(w.stop)));
        const t = ws.reduce((sum, w) => sum + (k === 'change' ? w.change : w.rest || 0), 0), count = k === 'night' ? ws.reduce((c, w) => c + (w.stop.n || 1), 0) : ws.length;
        return ws.length ? h('div', { class: 'speed-row sub' }, h('span', {}, `${label} (${count})`), h('b', {}, ''), h('b', {}, fmtDuration(t)), h('small', {}, note)) : null;
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
  }

  // From Check's breakdowns and the profile: a mode colours the line and the profile; "plain" leaves the line red.
  pickColor(k) {
    if (k === 'plain') { this.setColorOnMap(false); return; }
    this.colorOnMap = true;
    store.set('colorOnMap', true);
    if (this.els.mapToggle) this.els.mapToggle.checked = true;
    this.showMode(k); // redraws the line and re-renders the chip
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
        if (!forecastKnown(a.wind, k)) break; // (none past the forecast's reach, #465)
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
  reveal(id, { flash = true } = {}) {
    if (id === 'style') { this.openStep('how'); return; }
    if (TAB_OF[id] && TAB_OF[id] !== this.tab) this.setTab(TAB_OF[id]);
    this.toggleSection(id, true);
    const st = this.panel.dataset.state;
    if (this.layout() === 'sheet' && ['folded', 'peek'].includes(st)) this.setSheetState('half');
    else if (this.layout() === 'side' && st === 'folded') this.setSheetState('open');
    // and show where: the section lights up for a moment (the Weather button, Speed, Style, a link…)
    if (flash) requestAnimationFrame(() => this.flash(this.sec[id].el));
  }

  // Route's rows, each sport's style and your speed, each opening its step (#424's C)
  renderHow() {
    const box = this.els.howRows;
    if (!box) return;
    const main = this.mainSport();
    box.replaceChildren(
      ...[main, ...this.routeSports().filter((x) => x !== main)].map((sport) => item({ icon: 'sliders', label: 'How you go', line: `The ways Polku picks for ${ACTIVITIES[sport].label}`, val: styleName(sport, this.styleOf(sport)), chev: true, k: `how-${sport}`, onclick: () => { this.styleLeg = null; this.openStep('how', sport); } })),
      this.speedRow());
  }
  speedRow() {
    const act = this.mainSport(), sp = speedSummary(act, this.craft);
    const line = this.isMulti() ? [act, ...this.routeSports().filter((x) => x !== act)].map((x) => `${ACTIVITIES[x].label}: ${this.speedLine(x)}`).join('; ') : sp.txt;
    return item({ icon: 'gauge', label: 'Your speed', line, val: sp.name, chev: true, k: 'speed', onclick: () => this.openStep('speed') });
  }
  // A step of Route's (null: back to Route): How you go's style alone, or your speeds alone [tabs-c-how, tabs-c-speed]
  // `sport`: whose legs How you go styles (null: the main sport's)
  openStep(k, sport = null) {
    const pane = this.els.panes.route, was = pane.dataset.step, row = was === 'how' ? `how-${this.howSport()}` : was;
    if (k) {
      if (k === 'how') { this.styleSport = sport; this.renderStyle(); }
      const label = ACTIVITIES[this.howSport()].label;
      this.els.stepTitle.textContent = k === 'how' ? 'How you go' : 'Your speed';
      this.els.stepLine.textContent = k === 'speed' ? 'How fast the times are counted. A change only times the route again; the route stays.'
        : this.isMulti() ? `${label}, for the route’s ${label} legs. A change routes them again.` : `${label}, for the whole route. A change routes the route again.`;
      if (k === 'speed') this.renderSpeed();
      pane.dataset.step = k;
      if (this.tab !== 'route') this.setTab('route');
      if (this.layout() === 'sheet' && ['folded', 'peek'].includes(this.panel.dataset.state)) this.setSheetState('half');
      else if (this.layout() === 'side' && this.panel.dataset.state === 'folded') this.setSheetState('open');
      this.listToTop();
      requestAnimationFrame(() => this.els.stepHead.querySelector('.way-back').focus({ preventScroll: true }));
    } else {
      delete pane.dataset.step;
      if (this.styleSport) { this.styleSport = null; this.renderStyle(); }
      if (was) requestAnimationFrame(() => this.els.howRows.querySelector(`[data-k="${row}"]`)?.focus({ preventScroll: true }));
    }
  }

  // The summary's estimate opens Go at Leave.
  revealDeparture() {
    this.reveal('speed');
    requestAnimationFrame(() => {
      this.flash(this.els.leave.el);
      this.els.leave.el.querySelector('input').focus({ preventScroll: true });
    });
  }
  // Leave's rows say when you leave: Go's, and an open card's
  renderLeave() {
    this.els.leave.put();
    this.cards.refresh();
  }

  flash(el) {
    if (!el) return;
    el.scrollIntoView({ block: 'nearest', behavior: this.keyed || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
    return `${COLOR_MODES[this.colorMode]} · ${Number.isFinite(a.minE) ? `${Math.round(a.minE)}–${Math.round(a.maxE)} m` : 'no terrain'}`;
  }

  renderToolbarState() {
    if (!this.els) return;
    this.renderTools();
    this.renderModeChips();
  }

  // Distance marks along the route: every 1, 5, 10 or 25 km by its length, with the
  // arrival and elapsed times (including stops, with the wind once it's in).
  drawMarks() {
    const a = this.analysis;
    const empty = { type: 'FeatureCollection', features: [] };
    if (!a || !this.marks.km || a.total < 1500) { this.app.setData('routeMarks', empty); return; }
    const step = a.total <= 12000 ? 1000 : a.total <= 50000 ? 5000 : a.total <= 160000 ? 10000 : 25000;
    const tAt = a.tAtWind || a.tAt, start = this.startSec();
    const features = [];
    let i = 1;
    for (let d = step; d < a.total - step * 0.3; d += step) {
      while (i < a.along.length - 1 && a.along[i] < d) i++;
      const t = (d - a.along[i - 1]) / ((a.along[i] - a.along[i - 1]) || 1);
      const p = a.pts[i - 1], q = a.pts[i];
      const ll = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      const sec = tAt ? tAt[i - 1] + (tAt[i] - tAt[i - 1]) * t : 0;
      const timed = tAt && Number.isFinite(sec);
      const elapsed = Math.max(0, Math.round(sec)), hours = Math.floor(elapsed / 3600), minutes = Math.floor((elapsed % 3600) / 60), seconds = elapsed % 60;
      const duration = hours ? `${hours} h ${minutes} min ${seconds} s` : minutes ? `${minutes} min ${seconds} s` : `${seconds} s`;
      const label = `${d / 1000} km${this.marks.time && timed ? ` · ${this.clockOf(start + sec)}` : ''}${this.marks.duration && timed ? `\n${duration} elapsed` : ''}`;
      features.push({ type: 'Feature', properties: { label }, geometry: { type: 'Point', coordinates: ll } });
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
    this.renderFacts(a);
    this.els.leave.put(); // ("Tomorrow" becomes "Today" overnight)
    // the clock stays reachable before there's a route: set the time, then draw
    if (!a) this.setSection('depart', { summary: `Depart ${this.leaveWords()}` });
    if (!a) {
      const tap = matchMedia('(pointer: coarse)').matches ? 'tap' : 'click';
      sum.append(h('p', { class: 'sum-empty' }, this.loop.open ? `Round trip: ${tap} the map to move its start`
        : this.points.length ? 'Add another point to make a route' : `${tap[0].toUpperCase()}${tap.slice(1)} the map to add a start point`,
        // the first point's: how to see what's on the map, where a phone has no hover (part 5) [r-first]
        this.points.length === 1 && !this.loop.open ? h('small', {}, tap === 'tap' ? 'Hold the map to see what’s there.' : 'Right-click the map to see what’s there.') : null));

      this.chart.setData(null);
      this.renderBreakdown();
      this.renderSpeed(); // your speeds for the sport, before there's a route and after Clear (#87)
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
    const nights = (a.waits || []).reduce((c, w) => c + (isNight(w.stop) ? w.stop.n || 1 : 0), 0);
    key('distance', fmtDist(a.total));
    // the time is from your departure: tapping it opens the clock (one control for both)
    const dep = this.leaveWords();
    const time = h('button', { type: 'button', class: 'sum-item sum-time', title: `Estimated ${waitSec ? `time with ${fmtDuration(waitSec)} of ${nights ? 'nights, ' : ''}stops and changeovers (moving ${fmtDuration((a.timeWind || a.time) - waitSec)})` : 'moving time'}${a.timeWind ? ', with the wind' : ''}${act === 'paddle' ? ` (${CRAFT[this.craft].label})` : ''}${a.terrain ? (a.terrain.all ? `, ${a.ways.some(([k]) => k === 'water') ? 'on land ' : ''}by distance only: no terrain` : `, estimated for the ${fmtDist(a.terrain.missing)} without terrain`) : ''} · set the departure`, onclick: () => this.revealDeparture() },
      // over days: the time on the move, and how many days it's spread over
      h('b', {}, nights ? shortDuration((a.timeWind || a.time) - waitSec) : fmtDuration(a.timeWind || a.time)), h('small', {}, nights ? `${nights + 1} days` : `from ${dep}`));
    sum.append(time);
    const carry = a.ways.find(([k]) => k === 'portage');
    if (paddle) key('carry', carry ? fmtDist(carry[1]) : '0 m');
    else {
      // climbing and descent together, in the line that's always visible (unknown without terrain, not 0 m)
      const ter = a.terrain;
      if (ter && ter.all) {
        sum.append(h('div', { class: 'sum-item sum-elev', title: `${terrainTitle(ter)}: the climbing isn’t known` },
          h('b', {}, '↑? ', h('span', { class: 'sum-down' }, '↓?'), ' m'), h('small', {}, 'no terrain')));
      } else {
        sum.append(h('div', { class: 'sum-item sum-elev', title: `${Math.round(a.up)} m of climbing, ${Math.round(a.down)} m of descent${ter ? `; terrain missing for ${fmtDist(ter.missing)}, estimated there` : ''}` },
          h('b', {}, `↑${Math.round(a.up)} `, h('span', { class: 'sum-down' }, `↓${Math.round(a.down)}`), ' m'), h('small', {}, ter ? 'part estimated' : 'ascent · descent')));
      }
    }
    if (OFFROAD_BIKE.has(act)) {
      const hardest = hardestClimb(a.climbs, act);
      stat('Hardest climb', hardest ? `<i class="dot" style="background:${DIFF_COLORS[hardest.cls]}"></i>↑S${hardest.cls}` : '—', hardest ? `${Math.round(hardest.gain)} m at ${Math.round(hardest.avg)} %` : a.terrain && a.terrain.all ? 'no terrain' : '');
    } else if (act === 'road') {
      // road cyclists read climbs by height and average gradient
      const hardest = hardestClimb(a.climbs, act);
      stat('Hardest climb', hardest ? `<i class="dot" style="background:${gradeColor(hardest.avg)}"></i>${Math.round(hardest.avg)} %` : '—', hardest ? `${Math.round(hardest.gain)} m over ${fmtDist(hardest.len)}` : a.terrain && a.terrain.all ? 'no terrain' : '');
    } else if (paddle) {
      const w = a.wind;
      // (as far as the forecast reaches, #465)
      const reach = w ? (w.beyond >= 0 ? w.beyond : a.pts.length) : 0, upTo = w && w.beyond > 0 ? ` · to km ${(a.along[w.beyond] / 1000).toFixed(1)}` : '';
      if (reach > 1) {
        let head = 0, maxS = 0, maxG = 0;
        for (let i = 1; i < reach; i++) {
          if (w.head[i] > 1) head += a.along[i] - a.along[i - 1];
          maxS = Math.max(maxS, w.speed[i]); maxG = Math.max(maxG, w.gust[i]);
        }
        stat('Headwind', `${Math.round((head / (a.along[reach - 1] || 1)) * 100)} %`, `of the distance${upTo}`);
        stat('Strongest wind', `${maxS.toFixed(0)} m/s`, `gusts ${maxG.toFixed(0)}${upTo}`);
      }
      if (a.up >= 5) stat('Carry ascent', `${Math.round(a.up)} m`);
    } else {
      stat('High point', Number.isFinite(a.maxE) ? `${Math.round(a.maxE)} m` : '—', Number.isFinite(a.maxE) ? '' : 'no terrain');
    }
    // and what the key facts' line can say (#471's A2: Check's top keeps every fact)
    for (const x of this.keyFacts(a)) {
      if (x.k === 'rain') stat('Rain', fmtDist(x.v.m), 'of the way');
      if (x.k === 'bwind') stat('Headwind', `+${x.v.add} min`, 'to the time');
      if (x.k === 'unpaved') stat('Unpaved', fmtDist(x.v.m), `${x.v.p} % of the way`);
      if (x.k === 'day') stat('Hardest day', `Day ${x.v.n}`, `${fmtDist(x.v.to - x.v.from)}, ↑${Math.round(x.v.up)} m`);
      if (x.k === 'wx' || (x.k === 'wind' && x.miss)) stat(x.k === 'wx' ? 'Weather' : 'Wind', '?', this.noWeather(a));
    }
    st.hidden = !st.children.length; // (Speed and Style are Route's own rows now, #424's C)
    // after a style change: what it did, compared with the route before
    if (this.styleBefore && this.styleBefore.a !== a) {
      const b = this.styleBefore.stats, n = this.styleStats();
      this.styleBefore = null;
      if (b && n) {
        const sg = (v, unit, dp = 0) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(dp)} ${unit}`;
        const what = n.what[0] === 'carries' ? `carries ${b.what[1]} → ${n.what[1]} m` : `${n.what[0]} ${b.what[1]} → ${n.what[1]} %`;
        this.styleDelta = `${sg(n.km - b.km, 'km', 1)} · ${what}${Number.isFinite(n.up - b.up) ? ` · climbing ${sg(n.up - b.up, 'm')}` : ''}`;
        toast(`${styleName(act, this.styleOf(act))}: ${this.styleDelta}`, { ms: 5000 });
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

  // Every applicable kind with data, independent of the current profile colour.
  // Keep the controls in place during updates so focus and folded bars stay put.
  renderBreakdown() {
    this.clearCategoryPreview();
    const a = this.analysis, box = this.els.breakdown;
    if (!a) { box.replaceChildren(); this.breakdownKinds = {}; this.breakdownGroups = null; return; }
    this.breakdownKinds ||= {};
    this.breakdownGroups ||= COLOR_GROUPS.map(([title, modes]) => {
      const id = `colour-group-${title.toLowerCase()}`;
      const list = h('div', { class: 'bd-group-list', id });
      const fold = h('button', { type: 'button', class: 'bd-group-toggle', 'aria-controls': id }, title, h('span', { html: icon('chevronDown', 16), 'aria-hidden': 'true' }));
      const setOpen = (open) => {
        if (!open) this.clearCategoryPreview();
        list.hidden = !open;
        fold.setAttribute('aria-expanded', String(open));
        fold.setAttribute('aria-label', `${open ? 'Fold' : 'Expand'} ${title.toLowerCase()} group`);
      };
      fold.addEventListener('click', () => {
        setOpen(list.hidden);
        store.set('sections', { ...store.get('sections', {}), [id]: !list.hidden });
      });
      const el = h('section', { class: 'bd-group', 'aria-label': title }, fold, list);
      box.append(el);
      return { el, list, modes, id, setOpen, initialized: false };
    });
    let count = 0;
    for (const group of this.breakdownGroups) {
      let shown = 0;
      for (const mode of group.modes) {
        const label = COLOR_MODES[mode];
        const rows = this.modeApplies(mode) ? this.breakdownRows(mode) : [];
        let kind = this.breakdownKinds[mode];
        if (!rows.length) { if (kind) kind.el.hidden = true; continue; }
        count++;
        if (!kind) {
          const active = h('small', { class: 'bd-active' }, 'Use colours');
          const bar = h('span', { class: 'bd-bar', 'aria-hidden': 'true' });
          const pick = h('button', { type: 'button', class: 'bd-title', title: `Colour the route and profile by ${label.toLowerCase()}`,
            'aria-describedby': 'colour-preview-status', 'aria-description': 'Left and right arrow keys preview categories on the map. Escape clears the preview. Enter selects these colours.',
            onclick: () => this.pickColor(mode) }, h('span', { class: 'bd-heading' }, h('span', {}, label), active), bar);
          let pointerFocus = false;
          pick.addEventListener('pointerdown', () => { pointerFocus = true; this.clearCategoryPreview(); });
          for (const type of ['pointerup', 'pointercancel', 'pointerleave']) pick.addEventListener(type, () => { pointerFocus = false; });
          pick.addEventListener('focus', () => { if (!pointerFocus && pick.matches(':focus-visible')) this.previewCategory(mode, this.breakdownRows(mode)[0]?.[3], pick, true); });
          pick.addEventListener('blur', () => this.clearCategoryPreview(pick));
          pick.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.categoryPreview) { e.preventDefault(); e.stopPropagation(); this.clearCategoryPreview(); return; }
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault(); e.stopPropagation();
            const rows = this.breakdownRows(mode), current = this.categoryPreview;
            if (!rows.length) return;
            const at = current?.mode === mode ? rows.findIndex((r) => r[3] === current.key) : -1;
            const origin = at < 0 && e.key === 'ArrowLeft' ? 0 : at;
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : (origin + (e.key === 'ArrowLeft' ? -1 : 1) + rows.length) % rows.length;
            this.previewCategory(mode, rows[next][3], pick, true);
          });
          const legend = h('div', { class: 'bd-legend' });
          const body = h('div', { class: 'bd-body' }, legend);
          const el = h('section', { class: 'bd-kind', 'data-colour': mode, 'aria-label': `${label} on the route` },
            pick, body);
          kind = this.breakdownKinds[mode] = { el, pick, active, body, bar, legend };
        }
        kind.el.hidden = false;
        // Insert in the same order as Colour by, including kinds whose data arrived late.
        const next = group.list.children[shown++];
        if (next !== kind.el) group.list.insertBefore(kind.el, next || null);
        const selected = this.colorMode === mode;
        kind.pick.setAttribute('aria-pressed', String(selected));
        kind.active.textContent = selected ? 'Selected' : 'Use colours';
        const { bar, legend } = kind;
        bar.replaceChildren();
        legend.replaceChildren();
        for (const [label, d, color, key] of rows) {
          if (!(d > 0)) continue;
          const pct = (d / a.total) * 100;
          const segment = h('span', { style: `width:${pct}%;background:${color}`, 'data-category': String(key), title: `${label}: ${fmtDist(d)}` });
          this.bindCategoryPreview(segment, mode, key);
          bar.append(segment);
          const text = String(label);
          const item = h('span', { class: 'bd-item', 'data-category': String(key) }, h('i', { style: `background:${color}`, 'aria-hidden': 'true' }),
            h('span', {}, `${text[0].toUpperCase()}${text.slice(1)} `), h('b', {}, fmtDist(d)));
          this.bindCategoryPreview(item, mode, key);
          legend.append(item);
        }
      }
      group.el.hidden = !shown;
      if (shown && !group.initialized) {
        const saved = store.get('sections', {});
        // A previous group choice wins; migrate a fully folded set of old individual bars.
        const open = saved[group.id] ?? [...group.list.children].some((el) => !el.hidden && saved[`colour-${el.dataset.colour}`] !== false);
        group.setOpen(open);
        group.initialized = true;
      }
    }
    this.setSection('colours', { title: 'On the route', count, empty: !count });
  }

  bindCategoryPreview(el, mode, key) {
    el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') this.previewCategory(mode, key, el); });
    el.addEventListener('pointerleave', () => this.clearCategoryPreview(el));
    el.addEventListener('pointercancel', () => this.clearCategoryPreview(el));
  }

  clearCategoryPreview(owner = null) {
    const current = this.categoryPreview;
    if (!current || (owner && owner !== current.owner)) return;
    this.categoryPreview = null;
    for (const el of current.marked) el.classList.remove('bd-preview');
    this.app.setData('routePreview', EMPTY);
    this.els.colourPreviewStatus.textContent = '';
  }

  // A category can occur in several disconnected stretches, and share a colour with another category.
  previewCategory(mode, key, owner, announce = false) {
    this.clearCategoryPreview();
    const a = this.analysis;
    if (!a || this.panel.hidden || this.tab !== 'check' || this.sec.colours.el.dataset.open !== 'true' || !owner?.isConnected || owner.closest('[hidden]')) return;
    const row = this.breakdownRows(mode).find((r) => r[3] === key);
    if (!row) return;
    const features = [];
    let run = [];
    const finish = () => {
      if (run.length > 1) features.push({ type: 'Feature', properties: { color: row[2] }, geometry: { type: 'LineString', coordinates: run } });
      run = [];
    };
    for (let i = 1; i < a.pts.length; i++) {
      if (a.along[i] > a.along[i - 1] && this.breakdownKey(mode, i) === key) {
        if (!run.length) run.push(a.pts[i - 1]);
        run.push(a.pts[i]);
      } else finish();
    }
    finish();
    if (!features.length) return;
    const marked = [...this.breakdownKinds[mode].el.querySelectorAll('[data-category]')].filter((el) => el.dataset.category === String(key));
    for (const el of marked) el.classList.add('bd-preview');
    this.categoryPreview = { mode, key, owner, marked };
    this.app.setData('routePreview', { type: 'FeatureCollection', features });
    if (announce) this.els.colourPreviewStatus.textContent = `${COLOR_MODES[mode]}: ${row[0]}, ${fmtDist(row[1])} highlighted on the map.`;
  }

  // The same category key drives totals, bar segments and map previews.
  breakdownKey(mode, i) { return breakdownKey(this.analysis, mode, i); }

  // Full distance accounting, including unknown stretches once a kind has data.
  breakdownRows(mode) { return breakdownRows(this.analysis, mode); }

  renderClimbs() {
    const a = this.analysis;
    const box = this.els.climbs;
    box.innerHTML = '';
    const sport = this.mainSport(), bike = OFFROAD_BIKE.has(sport); // uphill grades; others read the average gradient
    const hardest = hardestClimb(a.climbs, sport);
    this.setSection('climbs', { count: a.climbs.length || '', empty: !a.climbs.length, summary: hardest ? `Hardest: ${climbWords(hardest, sport)}` : '' });
    if (hardest) box.append(h('p', { class: 'climbs-hardest' }, `Hardest: ${climbWords(hardest, sport)}`));
    if (!a.climbs.length) return;
    a.climbs.forEach((c, k) => {
      // Bikes get the uphill difficulty grade; on foot the average gradient says more.
      const bg = bike ? DIFF_COLORS[c.cls] : gradeColor(c.avg);
      const badge = h('span', { class: `badge${darkWords(bg) ? ' ink' : ''}`, style: `background:${bg}` }, bike ? `↑S${c.cls}` : `${Math.round(c.avg)}%`);
      // (a column of one width for the badges, so every climb's words start in line, the Hardest tag under its badge)
      const item = h('button', { type: 'button', class: `li${this.selected === c ? ' sel' : ''}` },
        h('span', { class: 'li-badge' }, badge, c === hardest ? h('small', { class: 'li-tag' }, 'Hardest') : null),
        h('span', { class: 'li-main' },
          h('b', {}, `${k + 1}. +${Math.round(c.gain)} m in ${fmtDist(c.len)}`),
          h('span', {}, `km ${(c.from / 1000).toFixed(1)}–${(c.to / 1000).toFixed(1)} · avg ${c.avg.toFixed(0)} % · max ${c.max.toFixed(0)} %${c.osm ? ' · OSM-tagged' : ''}`)),
      );
      if (bike) item.title = UPHILL_TEXT[c.cls];
      item.addEventListener('click', () => this.focusRange(c.start, c.end, c));
      box.append(item);
    });
  }

  // ---------------------------------------------------------------- Check's groups (25d part 2)
  // Every Heads-up item in Check's groups: Read before you go and Worth a look, each item's own (set where it's made;
  // one without goes to Read, so a forgotten one looks more serious, never less), in order along the route; Not
  // checked, the sources that didn't answer (notChecked()); and how many of each kind you've hidden.
  headsUp(a = this.analysis) {
    const out = { read: [], look: [], not: [], hidden: new Map() };
    if (!a) return out;
    // a stand-in for a leg not routed yet is its own item, not a Straight line too
    const standIn = this.legs.map((l, i) => (l.status === 'error' || l.status === 'waiting' ? [this.lengthTo(i) - 5, this.lengthTo(i + 1) + 5] : null)).filter(Boolean);
    const all = [...a.warnings.filter((w) => !(/^Straight line/.test(w.text) && standIn.some(([s0, s1]) => w.at >= s0 && w.at + w.len <= s1))), ...(a.hazards || []), ...groupTrail(a.trailWarn || []), ...(a.waterWarn || []), ...(a.darkWarn || []), ...(a.accessWarn || []), ...this.stopWarnings(a), ...this.winterWarnings(a), ...this.iceWarnings(a), ...this.routerWarnings()].sort((x, y) => x.at - y.at);
    const hidden = hiddenKinds();
    for (const w of all) {
      const k = hideKind(w);
      if (k && hidden[k.key]) { out.hidden.set(k.key, (out.hidden.get(k.key) || 0) + 1); continue; }
      if (w.tier !== 'read' && w.tier !== 'look') console.error(`Heads-up item without a group: ${w.text}`);
      (w.tier === 'look' ? out.look : out.read).push(w);
    }
    out.not = this.notChecked(a);
    return out;
  }

  // The router's own items: legs not routed yet (drawn as straight lines meanwhile), and legs Valhalla stood in for.
  routerWarnings() {
    const out = [];
    const span = (pred) => {
      const i0 = this.legs.findIndex(pred), i1 = this.legs.findLastIndex(pred);
      return { at: this.lengthTo(i0), len: this.lengthTo(i1 + 1) - this.lengthTo(i0) };
    };
    const unrouted = (l) => l.status === 'error' || l.status === 'waiting';
    const n = this.legs.filter(unrouted).length;
    if (n) {
      const w = (this.legs.find((l) => l.status === 'waiting') || {}).wait;
      const waiting = w && (w.reason === 'limit'
        ? `The routing service asked for a short pause; ${n === 1 ? 'it follows' : 'they follow'} on their own`
        : `${w.own ? 'Your routing server' : 'The routing service'} isn’t answering — trying again at ${clock(w.until)}${w.own ? ' (Settings → Routing server)' : ''}`);
      out.push({ ...span(unrouted), kind: 'router', noHide: true, noAvoid: true, text: `${n === 1 ? 'One leg isn’t' : `${n} legs aren’t`} routed yet`, note: waiting || `Drawn as straight line${n === 1 ? '' : 's'}`,
        tier: 'read', src: { kind: 'router', by: 'the routing service' }, retry: () => this.retryFailed() });
    }
    const valhalla = (l) => l.status === 'ok' && l.result && l.result.provider === 'valhalla';
    const v = this.legs.filter(valhalla).length;
    if (v) {
      out.push({ ...span(valhalla), kind: 'router', noHide: true, noAvoid: true, text: `${v === 1 ? 'One leg' : `${v} legs`} routed by Valhalla`,
        note: 'brouter.de asked for a pause, so the OpenStreetMap routing service stood in. It may take ways marked private, and doesn’t say which: Check lists those found on the map.',
        tier: 'look', src: { kind: 'router', by: 'Valhalla, on FOSSGIS servers', url: 'https://valhalla.github.io/valhalla/' }, fixUrl: FIX_THE_MAP, useBrouter: () => this.rerouteWithBrouter() });
    }
    return out;
  }

  // Not checked: each source that didn't answer for this route ({ key, by, text, note, retry }), and where it left
  // a gap when that's known (`ranges` of [at, len], the first as `at` and `len`; null: the whole route). Each stays
  // on the analysis until its source answers, so a late note can't replace it (#265); places first, along the route.
  notChecked(a) {
    const out = [], end = a.along[a.along.length - 1];
    const place = (ranges) => (ranges && ranges.length ? { ranges, at: ranges[0][0], len: ranges[0][1] } : { ranges: null });
    // Retry: asked again at once, its card saying "Asking…" until it's answered, a card built again meanwhile too
    const ask = (key, fn) => async () => {
      (a.asking || (a.asking = new Set())).add(key);
      this.renderWarnings();
      try { return await fn(); } finally { a.asking.delete(key); if (this.analysis === a) this.renderWarnings(); }
    };
    const ter = a.terrain;
    if (ter) {
      const onWater = (i) => (a.attr[i] || {}).mode === 'water' && !((a.attr[i] || {}).tags || {}).portage;
      out.push({ key: 'terrain', by: 'the terrain model', text: terrainTitle(ter),
        note: `${ter.all ? `${a.ways.some(([k]) => k === 'water') ? 'On land the time' : 'The time'} is by distance only, and the climbing isn’t known` : 'The climbing and the time there are estimates'}.${ter.retry && ter.next ? ` Trying again at ${clock(ter.next)}.` : ''}`,
        ...place(!ter.all && a.eleGap ? runsAlong(a.along, (i) => a.eleGap[i] && !onWater(i)) : null),
        retry: ter.retry ? async () => { await this.retryTerrain(a, 0, true); if (this.analysis === a) toast('The terrain still didn’t load: Polku keeps trying'); } : null });
    }
    // the water router's sources: the legs routed without each
    const lost = new Map();
    this.legs.forEach((l, i) => {
      const wr = l.mode === 'water' && l.result && l.result.water; // (being routed again: until the new answer)
      for (const m of (wr && wr.missing) || []) { if (!lost.has(m)) lost.set(m, []); lost.get(m).push([this.lengthTo(i), this.lengthTo(i + 1) - this.lengthTo(i)]); }
    });
    for (const [m, legs] of lost) {
      const [text, note] = WATER_LOST[m] || [`${m} didn’t answer on the water`, 'Routed without it.'];
      const ranges = legs.reduce((r, [at, len]) => { const p = r[r.length - 1]; if (p && at - (p[0] + p[1]) < 1) p[1] = at + len - p[0]; else r.push([at, len]); return r; }, []);
      const whole = ranges.length === 1 && ranges[0][0] < 1 && ranges[0][0] + ranges[0][1] >= end - 1; // (every leg: the whole route, no place)
      out.push({ key: 'water', by: m, text, note: `${note} Polku tries again on its own.`, ...place(whole ? null : ranges), retry: () => this.retryWater() });
    }
    if (a.hazardsError) out.push({ key: 'hazards', by: 'Fintraffic', text: 'Road works and incidents: Fintraffic didn’t answer', note: 'Road works, traffic incidents and road conditions on the way aren’t known.', ranges: null, retry: ask('hazards', () => this.loadHazards(a)) });
    if (a.trailError) {
      const sum = a.trailError.reduce((t, [, len]) => t + len, 0), whole = sum >= end - 20;
      out.push({ key: 'trail', by: 'OpenStreetMap, through Overpass', who: 'Overpass (OpenStreetMap)', text: whole ? 'Trail details didn’t load' : `Trail details didn’t load for ${fmtDist(sum)}`,
        note: 'Overpass didn’t answer: fallen trees, fords, gates and how wide or wet the way is aren’t known there.', ...place(whole ? null : a.trailError),
        retry: ask('trail', () => { forgetTrailFailures(); return this.loadTrail(a); }) });
    }
    if (a.winterError) out.push({ key: 'winter', by: 'OpenStreetMap, through Overpass', who: 'Overpass (OpenStreetMap)', text: 'Winter ways didn’t load', note: 'Overpass didn’t answer: ski tracks, and ways closed or not ploughed in winter, aren’t known.', ranges: null, retry: ask('winter', () => { forgetWinterFailures(); return this.loadWinterAlong(a); }) });
    if (a.windError) out.push({ key: 'weather', by: 'Open-Meteo', text: 'The forecast didn’t answer', note: `${typeof a.windError === 'string' ? `${a.windError}. ` : ''}The wind, the rain and the cold on the way aren’t known, and the time is without the wind.`, ranges: null, retry: ask('weather', () => this.loadWind(a)) });
    // past the forecast's reach (10 days, #465): its last hour isn't used, so wind, rain and waves aren't known there
    const w = a.wind;
    if (w && w.beyond === 0) out.push({ key: 'beyond', by: 'Open-Meteo', text: 'No forecast yet for this trip', note: 'Wind, rain and waves aren’t checked: the forecast reaches 10 days ahead. Sunset and the dark still count.', ranges: null });
    else if (w && w.beyond > 0) out.push({ key: 'beyond', by: 'Open-Meteo', text: `No forecast yet from km ${(a.along[w.beyond] / 1000).toFixed(1)}, ${this.clockOf(w.beyondSec)}`, note: 'Wind, rain and waves aren’t checked from there.', ...place([[a.along[w.beyond], end - a.along[w.beyond]]]) });
    const at = (x) => (x.ranges ? x.at : Infinity);
    return out.sort((x, y) => (at(x) === at(y) ? 0 : at(x) < at(y) ? -1 : 1));
  }

  // What Polku looked at for this route, at Check's end: each source and whether it answered ('ok', with its name and
  // time), didn't ('bad', what's missing), is still being asked ('wait') or doesn't apply here ('na').
  lookedAt(a = this.analysis) {
    if (!a) return [];
    const rows = [], row = (what, by, state) => rows.push({ what, by, state });
    const onWater = (l, i) => l.mode === 'water' || isWater(this.legSport(i));
    const water = this.legs.some(onWater), land = !this.legs.length || this.legs.some((l, i) => !onWater(l, i));
    const end = a.along[a.along.length - 1];
    if (land) {
      const te = a.trailError, gap = te ? te.reduce((t, [, len]) => t + len, 0) : 0;
      row('Trail details along the route', te ? (gap >= end - 20 ? 'didn’t load' : `missing for ${fmtDist(gap)}`) : a.trailAsking ? 'asking OpenStreetMap…' : a.trailLong ? 'the route’s own tags only: too long to ask for more' : a.trailMore ? 'OpenStreetMap' : 'asking OpenStreetMap…',
        te ? 'bad' : a.trailAsking || (!a.trailLong && !a.trailMore) ? 'wait' : a.trailLong ? 'na' : 'ok');
      const ter = a.terrain;
      row('Heights and climbs', ter ? (ter.all ? (ter.retry ? 'didn’t load' : 'none here') : `missing for ${fmtDist(ter.missing)}`) : 'the terrain model', ter ? 'bad' : 'ok');
      if (this.fintrafficHere(a)) row('Road works and incidents', a.hazardsError ? 'Fintraffic didn’t answer' : a.hazards ? `Fintraffic, ${clock(a.hazardsAt)}` : 'asking Fintraffic…', a.hazardsError ? 'bad' : a.hazards ? 'ok' : 'wait');
      if (a.snow) row('Winter ways', a.winterError ? 'didn’t load' : a.winterCls ? 'OpenStreetMap' : 'loading…', a.winterError ? 'bad' : a.winterCls ? 'ok' : 'wait');
    }
    const wr = this.legs.filter((l) => l.mode === 'water' && l.result && l.result.water).map((l) => l.result.water);
    const asked = (k) => wr.some((w) => (w.checked || {})[k]), missing = (m) => wr.some((w) => (w.missing || []).includes(m));
    const source = (what, k, name) => row(what, !asked(k) ? 'not used for this route' : missing(name) ? `${name} didn’t answer` : name, !asked(k) ? 'na' : missing(name) ? 'bad' : 'ok');
    if (water) {
      source('Rocks and shoals', 'hazards', 'OpenStreetMap');
      source('Fairways and marks', 'fairways', 'Väylävirasto');
    }
    // the forecast: the weather on the way, and on the water the wind for the waves
    const windLost = a.windError || missing('the wind forecast'), startSec = a.wind ? a.wind.startSec : this.startSec();
    row(land ? 'Weather on the way' : 'Wind and waves', windLost ? 'Open-Meteo didn’t answer' : a.wind ? `Open-Meteo, ${clock(startSec * 1000)}` : 'loading…', windLost ? 'bad' : a.wind ? 'ok' : 'wait');
    const sun = sunTimes(startSec, this.points[0] || a.pts[0]);
    row('Daylight', sun.set ? `sunset ${clock(sun.set * 1000)}` : sun.day === 'polar-day' ? 'the sun doesn’t set' : 'the sun doesn’t rise', 'ok');
    if (water) row('Depths', 'shown on the map, never used for routes', 'na');
    else row('Water hazards', 'no water on this route', 'na');
    return rows;
  }

  // Check's groups (25d part 2) [jc-check, chk-phone, chk-desk]: Read before you go (the red warning box), Not checked
  // and Worth a look (rows, each with its group's icon), each in order along the route and lit while its card is open;
  // then What Polku looked at, and the kinds you've hidden, to bring back. A tap shows the item on the route (its card).
  renderWarnings() {
    const a = this.analysis;
    const box = this.els.warnings;
    box.replaceChildren();
    const H = this.heads = this.headsUp(a);
    // an open card's item, waiting while its sources are asked again (itemKept()): in its place along the route
    // meanwhile, so ‹ ›, its ring and Got it find it
    const L = this.itemsAlong(H), c = this.cards.current, w0 = c && c.kind === 'item' && c.last;
    if (w0 && !L.some((x) => itemKey(x) === c.itemKey) && this.itemKept(w0)) {
      const placed = (x) => x.g !== 'not' || x.w.ranges, i = placed(w0) ? L.findIndex((x) => !placed(x) || x.w.at > w0.w.at) : -1;
      L.splice(i < 0 ? L.length : i, 0, w0);
    }
    this.headsList = L;
    this.renderBadge(H);
    this.renderWaypoints(); // (each section of Route's list says its own, part 4)
    this.renderOnRoute();
    if (!a) return;
    this.setSection('warnings', { count: H.read.length + H.look.length + H.not.length });
    const open = this.cards.current && this.cards.current.kind === 'item' ? this.cards.current.itemKey : null;
    const row = (it) => {
      const k = itemKey(it), where = `${this.whereOf(it.w)}${this.isRead(it) ? ' · ✓ Read' : ''}`, go = (e) => this.openItemCard(it, { from: 'check', el: e.currentTarget });
      const el = it.g === 'read'
        ? h('button', { type: 'button', class: 'warn-row danger', onclick: go },
          h('span', { 'aria-hidden': 'true', html: icon('warnf', 20) }), h('span', {}, h('b', {}, it.w.text), h('small', {}, where)), h('span', { class: 'way-chev', 'aria-hidden': 'true', html: icon('chevronRight', 18) }))
        : item({ icon: it.g === 'not' ? 'unk' : 'eye', label: it.w.text, line: where, chev: true, onclick: go });
      el.dataset.key = k;
      if (k === open) el.setAttribute('aria-current', 'true');
      return el;
    };
    const MAX = 40; // (‹ › on a card steps through the rest)
    const tier = (g, ic, title, sub, list) => {
      if (!list.length) return null;
      const els = list.slice(0, MAX).map((w) => row({ g, w })), unread = list.map((w) => ({ g, w })).filter((it) => !this.isRead(it));
      return h('section', { class: `tier tier-${g}`, 'aria-labelledby': `tier-${g}` },
        h('div', { class: 'tier-top' },
          h('h3', { class: 'tier-h', id: `tier-${g}` }, h('span', { 'aria-hidden': 'true', html: icon(ic, 20) }), h('span', {}, title), h('span', { class: 'tier-n' }, String(list.length))),
          unread.length ? h('button', { type: 'button', class: 'btn small quiet tier-all', 'aria-label': `All read: ${title}`, onclick: () => this.markRead(unread, { note: true }), html: icon('check', 16) }, h('span', {}, 'All read')) : null),
        h('p', { class: 'tier-sub' }, sub),
        g === 'read' ? h('div', { class: 'tier-boxes' }, ...els) : rows(...els),
        list.length > MAX ? h('p', { class: 'tier-sub' }, `And ${list.length - MAX} more along the route: ‹ › on a card steps through them`) : null);
    };
    box.append(...[
      tier('read', 'warnf', 'Read before you go', 'What can stop you, turn you back or hurt', H.read),
      tier('not', 'unk', 'Not checked', 'A source didn’t answer: the route may miss something', H.not),
      tier('look', 'eye', 'Worth a look', 'Sections to know about', H.look),
    ].filter(Boolean));
    // what was looked at, from where, and what that doesn't mean
    const SAY = { ok: ['check', 'Checked'], bad: ['unk', 'Not checked'], wait: ['clock', 'Being asked'], na: ['minus', 'Not used'] };
    box.append(h('div', { class: 'looked' },
      h('h4', { class: 'looked-h' }, 'What Polku looked at'),
      h('ul', {}, ...this.lookedAt(a).map((r) => h('li', { class: r.state },
        h('span', { 'aria-hidden': 'true', html: icon(SAY[r.state][0], 16) }), h('span', {}, h('span', { class: 'sr-only' }, `${SAY[r.state][1]}: `), r.what), h('small', {}, r.by)))),
      h('p', {}, 'Nothing listed doesn’t mean a way is open, safe or allowed. Polku checks only what its sources know; signs on the ground win.')));
    if (H.hidden.size) {
      const hidden = hiddenKinds();
      box.append(h('div', { class: 'hidden-kinds' },
        h('span', {}, 'Hidden:'),
        ...[...H.hidden].map(([k, n]) => h('button', { type: 'button', class: 'on-chip', title: 'Show these in Check again', 'aria-label': `Show “${hidden[k]}” in Check again`, html: `<span>${escapeHtml(hidden[k])}${n > 1 ? ` ×${n}` : ''}</span>${icon('close', 12)}`, onclick: () => this.hideWarnKind({ key: k }, false) }))));
    }
    if (open) this.cards.refresh(); // (its "2 of 5", or closed when it's gone)
  }

  // What shows Check's items outside Check: the peek's row and the markers on the route (25d part 3)
  renderOnRoute() {
    this.renderReadRow();
    this.drawHeads();
    this.renderFold();
  }
  // whether Route's list is in sight with a section's warning in it (then the peek's row doesn't say it again)
  listInSight(st = this.panel.dataset.state) {
    return this.active && this.tab === 'route' && (this.layout() !== 'sheet' || this.sideMQ.matches || !['folded', 'peek'].includes(st))
      && this.sec.points && this.sec.points.el.dataset.open !== 'false' && !!this.els.points.querySelector('.sec2 .warn-row');
  }
  // whether Check is in sight: a desktop's Check tab, a phone's with the sheet above its peek
  checkInSight(st = this.panel.dataset.state) {
    return this.active && this.tab === 'check' && (this.layout() !== 'sheet' || this.sideMQ.matches || !['folded', 'peek'].includes(st));
  }

  // Check's items on the map [jc-peek, jc-check, jc-worst, jc-step]: Read before you go and Not checked with a place
  // always (with the planner put away too), Worth a look while Check or an item is in view; the open one apart and
  // ringed, with its obstacle's own icon (#85); the stretches a source didn't cover, dashed (a source missing for the
  // whole route says so in words, with no marker)
  drawHeads() {
    // (only what changed is set: the map rebuilds a source's tiles each time, and Check is drawn again often)
    const a = this.analysis, H = this.heads, shown = this.headsShown || (this.headsShown = {});
    const set = (id, features) => { const j = JSON.stringify(features); if (shown[id] === j) return; shown[id] = j; this.app.setData(id, { type: 'FeatureCollection', features }); };
    if (!a || !H || this.points.length < 2) { set('heads', []); set('headsOn', []); set('headsGaps', []); return; }
    const open = this.cards.current && this.cards.current.kind === 'item' ? this.cards.current.itemKey : null;
    const looks = !!open || this.checkInSight();
    const SEV = { read: 3, not: 2, look: 1 }, pt = (c, properties) => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: c } });
    // clear of the points and the legs' handles, which sit over the map and would hide a marker and take its tap: along
    // the route to the nearest spot 22 px from them, at this zoom (again at the next: zoomend)
    const dom = this.active && !this.panel.hidden ? [...this.points, ...this.ghosts.map((g) => g.getLngLat().toArray())].map((c) => this.map.project(c)) : [];
    const clear = (c) => { const q = this.map.project(c); return dom.every((d) => Math.hypot(d.x - q.x, d.y - q.y) >= 22); };
    const spot = (w) => {
      const at = this.itemPlace(w);
      if (!at || !dom.length || clear(at)) return at;
      const i0 = this.itemSpan(w)[0];
      for (let d = 1; d < 400; d++) for (const i of [i0 + d, i0 - d]) if (a.pts[i] && clear(a.pts[i])) return a.pts[i];
      return at;
    };
    const marks = [], on = [];
    for (const it of this.headsList || []) {
      const at = spot(it.w), k = itemKey(it);
      if (!at || (it.g === 'look' && !looks)) continue;
      const props = { key: k, g: it.g, sev: SEV[it.g], img: warnMarkId(it.g), text: it.w.text };
      if (k !== open) { marks.push(pt(at, props)); continue; }
      on.push(pt(at, { ...props, kind: 'item' }));
      for (const o of it.w.items || [it.w]) if (o.icon && o.lngLat) on.push(pt(o.lngLat, { kind: 'obstacle', img: o.icon })); // (a group: each of them)
    }
    set('heads', marks);
    set('headsOn', on);
    const at = (m) => Math.max(0, a.along.findIndex((d) => d >= m)), gaps = [];
    for (const x of H.not) for (const [m, len] of x.ranges || []) {
      let i1 = at(m + len);
      if (i1 <= 0) i1 = a.along.length - 1;
      const c = a.pts.slice(at(m), i1 + 1);
      if (c.length > 1) gaps.push({ type: 'Feature', properties: { key: x.key }, geometry: { type: 'LineString', coordinates: c } });
    }
    set('headsGaps', gaps);
  }
  // a marker under a tap or a click (r: px around it), the most serious first; and its card (merged ones: the most
  // serious of them, the first along the route)
  headAt(point, r = 8) {
    if (!this.map.getLayer('heads-icon')) return null;
    let hits;
    try { hits = this.map.queryRenderedFeatures([[point.x - r, point.y - r], [point.x + r, point.y + r]], { layers: ['heads-on-icon', 'heads-icon'] }); } catch { return null; } // (its tiles being rebuilt)
    hits = hits.filter((f) => f.properties.key || f.properties.cluster_id != null);
    return hits.sort((x, y) => (y.properties.sev || 0) - (x.properties.sev || 0))[0] || null;
  }
  async openHead(f) {
    let key = f.properties.key;
    if (!key && f.properties.cluster_id != null) {
      const leaves = await this.map.getSource('heads').getClusterLeaves(f.properties.cluster_id, 100, 0);
      const L = this.headsList || [], pos = (k) => L.findIndex((it) => itemKey(it) === k);
      key = leaves.map((l) => l.properties).sort((x, y) => y.sev - x.sev || pos(x.key) - pos(y.key))[0]?.key;
    }
    const it = key && this.itemByKey(key);
    if (it) this.openItemCard(it, { from: 'marker' });
  }
  // the card with the planner put away: Open the planner at it [jc-closed]
  openPlannerAt(card) {
    const k = card.itemKey;
    this.cards.close({ restore: false });
    if (!this.active) this.setActive(true);
    this.setTab('check');
    if (this.layout() === 'sheet' && ['folded', 'peek'].includes(this.panel.dataset.state)) this.setSheetState('half');
    setTimeout(() => {
      const it = this.itemByKey(k), el = this.els.warnings.querySelector(`[data-key="${CSS.escape(k)}"]`);
      if (el) el.scrollIntoView({ block: 'nearest' });
      if (it) this.openItemCard(it, { from: 'check', el });
    }, 120);
  }

  // The peek's row [jc-peek, jc-desk]: what to read before you go, else what wasn't checked, in words, in the warning
  // box; a tap shows the first of them on the route. Not while Check is in sight (a phone's sheet above its peek, a
  // desktop's Check tab); an item's card in the peek takes the head (.carded).
  // Only what's still unread: ✕ marks it all read, with Undo, and the row goes until something new or changed comes.
  // whether the peek's row has something to say: something to read before you go, or not checked
  readRowWanted() { return !!this.analysis && !!(this.unread(this.heads, 'read').length || this.unread(this.heads, 'not').length); }
  renderReadRow() {
    const el = this.els.readRow, H = this.heads;
    if (!el) return;
    el.hidden = !this.readRowWanted() || this.checkInSight() || this.listInSight();
    const R1 = this.unread(H, 'read'), R3 = this.unread(H, 'not'), n1 = R1.length, n3 = R3.length;
    // narrow (200 %, a small phone): the count alone, beside the numbers above Done; short (a phone on its side at 150 or
    // 200 %, #438): before Done, in the numbers' line. Either way it takes none of the map (the review of #416); its name
    // says the rest, a tap shows the first, and Check's All read marks them all
    const narrow = this.narrowMQ.matches, inline = narrow || this.shortMQ.matches, row = this.els.row;
    if (inline !== (el.parentNode === row)) { if (inline) this.els.sum.after(el); else row.before(el); }
    row.classList.toggle('with-count', narrow && !el.hidden);
    row.classList.toggle('count-inline', inline && !narrow && !el.hidden);
    if (el.hidden) return;
    const first = n1 ? R1[0] : R3[0], n = n1 || n3;
    const go = (...kids) => h('button', { type: 'button', class: 'pl-readrow-go', 'aria-label': `${[n1 && `${n1} to read before you go`, n3 && `${n3} not checked`].filter(Boolean).join(', ')}: ${first.w.text}. Show it on the route`, onclick: () => this.openFromRow() },
      h('span', { 'aria-hidden': 'true', html: icon(n1 ? 'warnf' : 'unk', 22) }), ...kids);
    el.className = `warn-row pl-readrow ${n1 ? 'danger' : 'unk'}${inline ? ' compact' : ''}`;
    if (inline) { el.replaceChildren(go(h('b', { 'aria-hidden': 'true' }, String(n)))); return; }
    el.replaceChildren(
      go(h('span', {}, h('b', {}, `${n} ${n1 ? 'to read before you go' : 'not checked'}`),
        h('small', {}, `${first.w.text}${n > 1 ? ` and ${n - 1} more` : ''}${n1 && n3 ? ` · ${n3} not checked` : ''}`)),
      h('span', { class: 'way-chev', 'aria-hidden': 'true', html: icon('chevronRight', 18) })),
      h('button', { type: 'button', class: 'tool pl-readrow-x', title: 'Mark all read: they stay in Check and on the map', 'aria-label': `Mark all ${n1 + n3} read`, onclick: () => this.markRead([...R1, ...R3], { note: true }), html: icon('close', 20) }));
  }
  // the row: the first unread one's card; on a desktop in Check, beside its box, the two together [jc-desk-sel]
  openFromRow() {
    const H = this.heads, first = this.unread(H, 'read')[0] || this.unread(H, 'not')[0];
    if (!first) return;
    if (this.cards.where() === 'peek') { this.openItemCard(first, { from: 'row' }); return; }
    this.setTab('check', { user: true });
    requestAnimationFrame(() => {
      const el = this.els.warnings.querySelector(`[data-key="${CSS.escape(itemKey(first))}"]`);
      if (el) { el.scrollIntoView({ block: 'nearest' }); el.focus({ preventScroll: true }); } // (Escape and ✕ bring the focus back to it: the row is gone)
      this.openItemCard(first, { from: 'row', el });
    });
  }

  // Marking read (chosen 2026-10-23): an item is read by its group, its words and its place, so it stays read while it's
  // the same through an edit of the route, and a new or changed one (a new road work, a later time) is unread.
  readKey({ g, w }) {
    if (g === 'not') return `not|${w.key}|${w.by}`;
    const ll = w.lngLat || this.itemPlace(w);
    return `${g}|${w.text}|${ll ? `${ll[0].toFixed(4)},${ll[1].toFixed(4)}` : Math.round((w.at || 0) / 100)}`;
  }
  isRead(it) { return this.readKeys.has(this.readKey(it)); }
  // a source answered: what was read of it not answering goes, so a later failure is new again (the review of #416)
  answered(key, keep = null) {
    let gone = false;
    for (const k of this.readKeys) if (k.startsWith(`not|${key}|`) && !(keep && keep.has(k.slice(key.length + 5)))) { this.readKeys.delete(k); gone = true; }
    if (gone) this.save(); // (the saved route too: after a reload, its next failure is new)
  }
  // another route put in place of this one (an import, a round trip, a LIPAS route, a saved area): nothing read on it
  // yet; the step Undo goes back to (`committed` just now) keeps what was read on the one before (undo())
  freshRead(committed = true) { const s = committed && this.past[this.past.length - 1]; if (s) s.read = [...this.readKeys]; this.readKeys = new Set(); }
  unread(H, g) { return H ? (H[g] || []).map((w) => ({ g, w })).filter((it) => !this.isRead(it)) : []; }
  // `note`: say how many, with Undo (the row's ✕, All read)
  markRead(list, { note = false, read = true } = {}) {
    const was = new Set(this.readKeys);
    for (const it of list) { if (read) this.readKeys.add(this.readKey(it)); else this.readKeys.delete(this.readKey(it)); }
    this.save();
    this.renderWarnings();
    if (note && list.length) toast(`${list.length} marked read: they stay in Check and on the map`, { ms: 6000, action: { label: 'Undo', fn: () => { this.readKeys = was; this.save(); this.renderWarnings(); } } });
  }
  // Got it on an item's card: read, and on a phone the next unread one along the route
  gotIt(c) {
    const it = this.itemByKey(c.itemKey);
    if (!it) return;
    const read = !this.isRead(it);
    this.markRead([it], { read });
    if (!read || this.cards.where() !== 'peek') return;
    const L = this.headsList || [], k = L.findIndex((x) => itemKey(x) === c.itemKey);
    const next = L.slice(k + 1).find((x) => !this.isRead(x)) || L.slice(0, k).find((x) => !this.isRead(x));
    if (next) this.openItemCard(next, { from: c.from });
  }

  // The Check tab's badge [chk-phone]: Read before you go's count with a triangle in the warning colour, else Worth a
  // look's count, neutral; "?" beside it while something wasn't checked. Its name says all three.
  renderBadge(H) {
    const tab = this.els.tabBtn && this.els.tabBtn.check;
    if (!tab) return;
    const n = tab.querySelector('.pl-tab-n'), unk = tab.querySelector('.pl-tab-unk');
    const r = H.read.length, l = H.look.length, q = H.not.length;
    n.classList.toggle('read', !!r);
    n.innerHTML = r ? `${icon('warnf', 11)}${r}` : l ? String(l) : '';
    unk.hidden = !q;
    const say = [r && `${r} to read before you go`, q && `${q} not checked`, l && `${l} worth a look`].filter(Boolean).join(', ');
    if (say) tab.setAttribute('aria-label', `Check: ${say}`); else tab.removeAttribute('aria-label');
  }

  // Every item along the route, for ‹ › on its card and the markers (25d part 3): [{ g: 'read' | 'look' | 'not', w }],
  // in order along the route; Not checked for the whole route last
  itemsAlong(H = this.headsUp()) {
    const placed = [...H.read.map((w) => ({ g: 'read', w })), ...H.look.map((w) => ({ g: 'look', w })), ...H.not.filter((w) => w.ranges).map((w) => ({ g: 'not', w }))];
    return [...placed.sort((x, y) => x.w.at - y.w.at), ...H.not.filter((w) => !w.ranges).map((w) => ({ g: 'not', w }))];
  }
  itemByKey(k) { return (this.headsList || this.itemsAlong()).find((it) => itemKey(it) === k) || null; }
  // the sources being asked again for this analysis (a new one of the same route: the terrain came, Undo): an item
  // missing meanwhile may come back, so its card waits rather than closes, unless its kind was hidden
  itemKept(x) {
    const a = this.analysis, kind = x.g !== 'not' && hideKind(x.w);
    if (kind && hiddenKinds()[kind.key]) return false;
    return !!a && ((!a.wind && !a.windError) || (this.fintrafficHere(a) && !a.hazards && !a.hazardsError) || !!a.trailAsking);
  }
  itemIndex(k) { const L = this.headsList || this.itemsAlong(); return [L.findIndex((it) => itemKey(it) === k), L.length]; }

  // where an item is, in words: "at 300 m · 60 m", "at km 1.4, 2.0", "The whole route"
  whereOf(w) {
    const a = this.analysis;
    if (w.ranges === null) return 'The whole route';
    const atKm = (m) => (m < 10 ? 'the start' : a.along[a.along.length - 1] < 2000 ? `${Math.round(m / 10) * 10} m` : `km ${(m / 1000).toFixed(1)}`);
    return w.items ? `at ${w.items.map((p) => atKm(p.at)).join(', ')}` : `at ${atKm(w.at)}${w.len > 5 ? ` · ${fmtDist(w.len)}` : ''}`;
  }
  // the samples [i0, i1] of an item's stretch (at least 30 m), and its place on the route (null: the whole route)
  itemSpan(w) {
    const a = this.analysis, i0 = Math.max(0, a.along.findIndex((d) => d >= w.at));
    let i1 = a.along.findIndex((d) => d >= w.at + Math.max(w.len || 0, 30));
    if (i1 < 0) i1 = a.along.length - 1;
    return [i0, i1];
  }
  itemPlace(w) { return !this.analysis || w.ranges === null || w.at == null ? null : this.analysis.pts[this.itemSpan(w)[0]]; }

  // An item's card [r-item, jc-step, jc-desk-sel]: in the peek on a phone, beside the panel at its row on a desktop
  // (from Check), else at its place on the route. `x`: an entry of itemsAlong() or the item itself. `from`: 'check',
  // 'row' (the peek's), 'marker' or 'section'; Back, Escape and ✕ go back to where it was opened.
  openItemCard(x, { from = 'check', el = null, step = 0 } = {}) {
    const L = this.headsList || this.itemsAlong(), it = x.w ? x : L.find((y) => y.w === x) || L.find((y) => itemKey(y) === itemKey({ g: x.tier === 'look' ? 'look' : 'read', w: x }));
    if (!it || !this.analysis) return;
    if (this.menu) this.menu.remove();
    const at = this.itemPlace(it.w);
    const side = this.cards.where() === 'float' && this.layout() === 'side' && this.active;
    // (beside the panel's edge, level with its row; with no row and no place, at the panel's top)
    const panel = this.panel.getBoundingClientRect(), beside = side && (el || !at) ? { right: panel.right + 4, top: el ? el.getBoundingClientRect().top : panel.top + 60 } : null;
    this.cards.open(itemCard(this, itemKey(it), from), { at, beside, from });
    // its stretch lit, once the card has its place (the peek is smaller than the sheet was)
    // (with the planner put away its marker was tapped where it is: lit, not framed, so its card stays where it opened)
    requestAnimationFrame(() => { if (this.cards.current && this.cards.current.itemKey === itemKey(it)) this.lightItem(it.w, { frame: this.active }); });
    if (step) requestAnimationFrame(() => { const b = this.cards.box && [...this.cards.box.querySelectorAll('.heads-step .tool')]; if (b) (b[step > 0 ? 1 : 0].disabled ? b[step > 0 ? 0 : 1] : b[step > 0 ? 1 : 0]).focus({ preventScroll: true }); });
  }
  // ‹ ›: the item before or after along the route
  stepItem(d) {
    const c = this.cards.current;
    if (!c || c.kind !== 'item') return;
    const L = this.headsList || this.itemsAlong(), k = L.findIndex((it) => itemKey(it) === c.itemKey);
    if (k >= 0 && L[k + d]) this.openItemCard(L[k + d], { from: c.from, step: d });
  }
  // All in Check ›: Check at half, the item's row in sight
  allInCheck(c) {
    this.cards.close({ restore: false });
    this.reveal('warnings');
    requestAnimationFrame(() => { const r = this.els.warnings.querySelector(`[data-key="${CSS.escape(c.itemKey)}"]`); if (r) { r.scrollIntoView({ block: 'center' }); this.flash(r); } });
  }
  // an item in view: its stretch lit (#84) and in sight, no closer than the map was (the route around it stays in view),
  // unless the card is only built again
  lightItem(w, { frame = true } = {}) {
    if (!this.analysis || w.ranges === null || w.at == null) { this.unlightItem(); return; }
    const [i0, i1] = this.itemSpan(w);
    this.itemLit = true;
    this.focusRange(i0, i1, w, { frame, maxZoom: Math.min(16, Math.max(12, this.map.getZoom())) });
  }
  unlightItem() {
    this.itemLit = false;
    this.unfocusRange();
  }

  // What an item's card offers: its one main action (Avoid it, Short cut, Use BRouter or Retry; `edits` when it changes
  // the route), and the rest of what its ⋯ offered (hide this kind, correct the map)
  itemActions({ g, w }) {
    const a = this.analysis;
    let main = null;
    if (w.retry) main = { label: 'Retry', icon: 'retry', fn: () => w.retry(), edits: g !== 'not' };
    else if (w.useBrouter) main = { label: 'Use BRouter', icon: 'route', fn: () => w.useBrouter(), edits: true };
    else if (w.cutLeg != null) main = { label: 'Short cut', icon: 'straight', fn: () => this.useShortCut(w.cutLeg, w.picks), edits: true, line: 'Lets this leg take the short cut: only where you may go' };
    else if (this.legs.some((l) => l.mode === 'auto' || l.mode === 'water')) {
      // anything with a place can be avoided: a circle over it (each of them, for a group)
      const [i0, i1] = this.itemSpan(w);
      const avoid = w.items ? w.items.map((p) => ({ ll: p.lngLat, r: 25, label: p.text }))
        : w.avoid ? [{ ...w.avoid, label: w.text }]
          : w.noAvoid || /^(Straight line|Carry)/.test(w.text) || w.ranges === null ? null : [{ ll: a.pts[Math.round((i0 + i1) / 2)], r: Math.max(25, Math.min(150, (w.len || 50) / 2 + 15)), label: w.text }];
      if (avoid) main = { label: avoid.length > 1 ? `Avoid all ${avoid.length}` : 'Avoid it', icon: 'avoid', fn: () => this.addNogos(avoid), edits: true };
    }
    const kind = g === 'not' ? null : hideKind(w), more = [];
    if (kind) more.push({ icon: 'eyeOff', label: `Hide “${kind.label}” in Check`, line: 'Listed at the end of Check, to show again', fn: () => this.hideWarnKind(kind) });
    if (w.osm && w.osm.id) more.push({ icon: 'external', label: 'Gone? Fix the map', line: 'OpenStreetMap’s editor, at this way', fn: () => open(`https://www.openstreetmap.org/edit?${w.osm.type}=${w.osm.id}`, '_blank', 'noopener') });
    if (w.osm && w.lngLat) more.push({ icon: 'external', label: w.fix || 'Not right? Leave a note on OpenStreetMap', line: 'Its mappers can fix what you tell them', fn: () => open(osmNote(w.lngLat), '_blank', 'noopener') });
    if (w.fixUrl) more.push({ icon: 'external', label: 'Fix the map', line: 'What Valhalla routes on comes from OpenStreetMap', fn: () => open(w.fixUrl, '_blank', 'noopener') });
    // …and a way to check or correct where it comes from, so every card ends alike (an idea from testing, 2026-10-23)
    const by = (w.src && w.src.by) || '', go = (sec) => () => { this.cards.close({ restore: false }); this.reveal(sec); };
    if (g === 'not' || more.some((m) => m.icon === 'external')) { /* (its own: the OpenStreetMap note, Fix the map) */ }
    else if (/^Fintraffic($|’s road weather)/.test(by)) more.push({ icon: 'external', label: 'See it at Fintraffic', line: 'Fintraffic’s traffic situation, live', fn: () => open('https://liikennetilanne.fintraffic.fi/', '_blank', 'noopener') });
    else if (w.src && w.src.kind === 'map' && /OpenStreetMap/.test(by) && this.itemPlace(w)) more.push({ icon: 'external', label: 'Not right? Leave a note on OpenStreetMap', line: 'Its mappers can fix what you tell them', fn: () => open(osmNote(this.itemPlace(w)), '_blank', 'noopener') });
    else if (/forecast/.test(by)) more.push({ icon: 'cloudSun', label: 'The weather on the way', line: 'In Go: the forecast along the route, for when you leave', fn: go('depart') });
    else if (by === 'the terrain model') more.push({ icon: 'mountain', label: 'The climbs', line: 'In Check: how steep each one is, from the terrain model', fn: go('climbs') });
    else if (/sun/.test(by)) more.push({ icon: 'sun', label: 'Sunrise and sunset', line: 'In Go, with the weather on the way', fn: go('depart') });
    else if (/stops/.test(by)) more.push({ icon: 'pause', label: 'Your stops', line: 'In Route: each stop and night in the list', fn: go('points') });
    return { main, more };
  }

  // Hide a kind of item everywhere (it's yours: kept on this device), or show it again
  hideWarnKind(kind, hide = true) {
    const all = { ...hiddenKinds() };
    if (hide) all[kind.key] = kind.label; else delete all[kind.key];
    store.set('hideWarn', all);
    this.renderWarnings();
    if (hide) toast(`“${kind.label}” hidden in Check: it’s listed at the end to show again`, { ms: 5000, action: { label: 'Undo', fn: () => this.hideWarnKind(kind, false) } });
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
    this.frame(b, { duration: animate ? 700 : 0 });
    this.fitAt = { t: Date.now(), peek: this.panel.style.getPropertyValue('--peek-h') };
  }

  // A share link frames its points at once, and its routed line once every leg is in,
  // unless you move the map or change the route before that.
  frameWhenRouted() { this.refit = true; }

  // Is any of the route on screen?
  routeInView() {
    const b = this.routeBounds();
    if (!b) return true;
    const v = this.map.getBounds();
    return !(b[2] < v.getWest() || b[0] > v.getEast() || b[3] < v.getSouth() || b[1] > v.getNorth());
  }

  // A stretch of the route picked (a climb, an item of Check): lit in the profile and on the map (#84), and framed
  // unless `frame` is false (an item's card built again); `maxZoom`: no closer than this
  focusRange(i0, i1, sel, { frame = true, maxZoom = 16 } = {}) {
    const a = this.analysis;
    this.selected = sel;
    this.focusHl = [a.along[i0], a.along[i1]];
    this.chart.setHighlight(this.focusHl);
    this.focusLit = a.pts.slice(i0, i1 + 1);
    this.showLit(this.focusLit.length > 1 ? this.focusLit : [a.pts[i0], a.pts[i0]], this.legAt(a.along[i0]), this.legAt(a.along[i1]) + 1);
    // a short cut the route didn't take (#104): drawn while its row is the one picked
    const cut = sel && sel.cut;
    this.app.setData('accessCut', cut ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: cut } }] } : EMPTY);
    if (frame) this.frame(bbox([...a.pts.slice(i0, i1 + 1), ...(cut || [])]), { duration: 700, maxZoom });
  }
  // nothing picked: the profile and the route unlit (an open leg stays lit)
  unfocusRange() {
    this.selected = null;
    this.focusHl = null;
    this.focusLit = null;
    this.app.setData('accessCut', EMPTY);
    this.unlitLeg();
  }

  renderWind() {
    const a = this.analysis;
    const box = this.els.wind;
    const act = this.mainSport();
    box.innerHTML = '';
    if (!a) return;
    // departure → back, for the section summary
    const start = this.startSec();
    const when = `Depart ${this.leaveWords()} → ${this.isLoop() ? 'back' : 'there'} ${this.clockOf(start + (a.timeWind || a.time))}`;
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
    // a start past the forecast's reach: nothing of it to show (#465) [tabs-c-far-check]
    if (w.beyond === 0) {
      box.append(h('p', { class: 'wind-body note' }, `No forecast yet for ${this.dayOf(this.startSec())}. Sunset and the dark still count; the forecast reaches 10 days ahead.`));
      this.setSection('depart', { summary: `${when} · no forecast yet` });
      return;
    }
    // (as far as the forecast reaches: past it the values are its last hour's)
    const reach = w.beyond > 0 ? w.beyond : a.pts.length;
    const s0 = w.start;
    const r = windRating(s0.speed, s0.gust, act);
    // distance share per class, and the strongest headwind stretch
    const share = { head: 0, cross: 0, tail: 0, calm: 0 };
    let worst = null;
    for (let i = 1; i < reach; i++) {
      const d = a.along[i] - a.along[i - 1];
      const c = windClass(w.head[i], w.speed[i]).key;
      share[c === 'strongHead' ? 'head' : c === 'strongTail' ? 'tail' : c] += d;
      if (!worst || w.head[i] > worst.v) worst = { v: w.head[i], i };
    }
    const tot = a.along[reach - 1] || 1;
    // temperature range and where / how much it rains, at arrival times
    let tMin = Infinity, tMax = -Infinity, wetM = 0, peak = 0, mm = 0, firstWet = -1, lastWet = -1, snowM = 0;
    const tAt = a.tAtWind || a.tAt;
    for (let i = 1; i < reach; i++) {
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
      w.beyond > 0 ? h('p', { class: 'note' }, `No forecast yet from km ${(a.along[w.beyond] / 1000).toFixed(1)}, ${this.clockOf(w.beyondSec)}: the weather here is up to there, and the time leaves the wind out after it.`) : null,
      w.unsure >= 0 && (w.beyond < 0 || w.unsure < w.beyond) ? h('p', { class: 'note' }, `From km ${(a.along[w.unsure] / 1000).toFixed(0)} (${this.clockOf(w.startSec + (a.tAtWind || a.tAt)[w.unsure])}) it’s more than three days ahead: the forecast is less certain.`) : null,
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

// DEM elevation for each routed vertex, taken from the nearest analysed sample (none where
// the terrain is missing: the GPX gets no height there rather than an estimate).
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
    out[i] = a.eleGap && a.eleGap[j] ? NaN : a.ele[j];
  }
  return out;
}

// what's missing of the terrain (analysis.js), for Heads-up and the summary
const terrainTitle = (t) => (t.all ? (t.retry ? 'Terrain didn’t load' : 'No terrain here') : `Terrain missing for ${fmtDist(t.missing)}`);
const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
// the stretches [at, len] (metres along the route) where on(i) holds for the samples i of `along`
function runsAlong(along, on) {
  const out = [];
  let s = -1;
  for (let i = 1; i < along.length; i++) {
    if (on(i)) { if (s < 0) s = i - 1; } else if (s >= 0) { out.push([along[s], along[i - 1] - along[s]]); s = -1; }
  }
  if (s >= 0) out.push([along[s], along[along.length - 1] - along[s]]);
  return out;
}
// who an item of Check is, through a new analysis (its objects are made again): its group, its words and its place
const itemKey = ({ g, w }) => (g === 'not' ? `not|${w.key}|${w.by}` : `${g}|${w.text}|${Math.round(w.at)}`);
// Not checked's what and why, for each of the water router's sources that didn't answer (waterdata.js)
const WATER_LOST = {
  OpenStreetMap: ['Rocks and shoals from OpenStreetMap didn’t answer', 'Routed without them: the line may pass close to a rock the map knows.'],
  Väylävirasto: ['Fairways and marks from Väylävirasto didn’t answer', 'Routed without them: the line may cross a shipping lane or pass a danger mark without saying so.'],
  'the wind forecast': ['The wind forecast didn’t answer on the water', 'Routed without the wind: how rough the water gets isn’t known.'],
};

// "2 h 13" or "54 min": a duration where there's little room
const shortDuration = (sec) => { const hr = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60); return hr ? `${hr} h ${String(m).padStart(2, '0')}` : `${m} min`; };

// A LIPAS leg's place along LIPAS's line, the other way round
const flipSrc = (src) => (src ? { ...src, a: src.b, b: src.a } : null);

// how a leg is drawn (style.js): a leg that couldn't be routed as a straight line, a fixed one as any routed one
const drawnMode = (leg) => (leg.status === 'error' ? 'line' : leg.mode === 'fixed' ? 'auto' : leg.mode);
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

// Places to avoid in a share link (av=): lon_lat_metres, comma-separated, the
// centre to 5 decimals (about a metre, like the route's points). A link holds at
// most AVOID_MAX; anything that doesn't read as a circle is left out, and `lost` says so.
const AVOID_MAX = 200;
const encodeAvoid = (nogos) => nogos.map((n) => `${+n.ll[0].toFixed(5)}_${+n.ll[1].toFixed(5)}_${Math.round(n.r)}`).join(',');
function decodeAvoid(s) {
  const nogos = [];
  let lost = false;
  for (const part of s ? s.split(',') : []) {
    const m = part.match(/^(-?\d{1,3}(?:\.\d{1,7})?)_(-?\d{1,2}(?:\.\d{1,7})?)_(\d{1,5})$/);
    if (m && Math.abs(+m[1]) <= 180 && Math.abs(+m[2]) <= 90 && +m[3] >= 1 && +m[3] <= 10000 && nogos.length < AVOID_MAX) {
      nogos.push({ ll: [+m[1], +m[2]], r: +m[3], label: 'Avoided place' });
    } else lost = true;
  }
  return { nogos, lost };
}

// A link to a spot (25d part 6b): only the spot and the map's view, never the route and never where you are. Five
// decimals (about a metre), the name up to 80 characters.
export function spotUrl(ll, name = '', zoom = 15) {
  const at = `${ll[1].toFixed(5)},${ll[0].toFixed(5)}`;
  return `${location.origin}${location.pathname}?pin=${at}${name ? `&pn=${encodeURIComponent(name.slice(0, 80))}` : ''}#${zoom}/${ll[1].toFixed(5)}/${ll[0].toFixed(5)}`;
}
// …and its reading: { ll: [lng, lat], name } or null for anything but two numbers on the earth
export function parsePin(params) {
  const m = /^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/.exec(params.get('pin') || '');
  if (!m || Math.abs(+m[1]) > 90 || Math.abs(+m[2]) > 180) return null;
  return { ll: [+m[2], +m[1]], name: (params.get('pn') || '').slice(0, 80) };
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
    const avoid = decodeAvoid(params.get('av'));
    const alts = (params.get('al') || '').split(',').map((x) => x.split(':').map(Number)).filter(([i, k]) => Number.isInteger(i) && Number.isInteger(k) && k >= 1 && k <= 3);
    const ice = (params.get('ic') || '').split(',').filter((x) => /^\d+$/.test(x)).map(Number);
    const lv = /^\d{1,10}$/.test(params.get('lv') || '') ? +params.get('lv') * 60 : null;
    return { points, modes: (params.get('m') || '').split(''), activity: params.get('a'), style: params.get('p') || '', legStyles: params.get('ps') || '', lipas, sports, changes, stops, carry, nogos: avoid.nogos, nogosLost: avoid.lost, alts, ice, leave: lv };
  } catch {
    return null;
  }
}
