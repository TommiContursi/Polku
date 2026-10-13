// Route planner: waypoints, per-leg routing modes, undo/redo, the bottom sheet
// with stats, elevation profile, climbs, warnings and (for paddling) wind.

import { ACTIVITIES, CRAFT, DIFF_COLORS, UPHILL_TEXT, SURFACE_COLORS, GRADE_BANDS, MTB_SCALE_TEXT, OFFROAD_BIKE, gradeColor } from './config.js';
import { routeLeg, routeRun, routerHeadroom } from './router.js';
import { analyse, estimateTime, surfaceClass } from './analysis.js';
import { speedsFor, speedSummary, renderSpeedEditor, pace } from './speeds.js';
import { ProfileChart, COLOR_MODES, COLOR_GROUPS, WAY_COLORS, colorAt, routeReadout } from './chart.js';
import { dist, encodePolyline, decodePolyline, fmtDist, fmtDuration, compass, bbox, nearestOnLine, simplify } from './geo.js';
import { toGPX, download } from './gpx.js';
import { windAlong, windClass, windRating, WIND_CLASSES, TEMP_BANDS, tempBand, RAIN_BANDS, rainBand, recentRain } from './weather.js';
import { icon, h, $, toast, store, escapeHtml } from './ui.js';
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
// bottom sheet sizes: the summary, + the elevation profile, half the screen, nearly all of it
const SHEET_STATES = ['peek', 'profile', 'half', 'full'];
// "wet ground: auto" turns on after this much rain in the last 24 hours (mm)
const WET_MM = 3;
const MODE_CODE = { auto: 'a', line: 'l', water: 'w', fixed: 'a' };
const CODE_MODE = { a: 'auto', l: 'line', w: 'water' };

async function pool(jobs, n) {
  const queue = jobs.slice();
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    while (queue.length) await queue.shift()();
  }));
}

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
    map.on('mousedown', 'route-casing', (e) => this.onLinePress(e));
    map.on('touchstart', 'route-casing', (e) => this.onLinePress(e));
    map.on('zoom', () => this.fitGhosts());
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
      legs: this.legs.map((l) => ({ mode: l.mode, result: l.result, key: l.key, status: l.status, style: l.style })),
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
    this.legs = s.legs.map((l) => ({ ...l }));
    this.nogos = s.nogos || [];
    this.routeName = s.routeName || '';
    if (s.style) this.style = s.style;
    this.update();
  }

  // ---------------------------------------------------------------- waypoint names & order
  nameAll(names) { this.points.forEach((p, i) => { if (names && names[i]) this.pname.set(p, names[i]); else this.pname.delete(p); }); }

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
        return { mode: 'fixed', status: 'ok', result: { coords: c.coords.slice().reverse(), tags: c.tags.slice().reverse(), portage: [] } };
      }
      const m = (o || r) ? (o || r).l.mode : this.mode;
      return { mode: m === 'fixed' ? 'auto' : m, style: o ? o.l.style : null };
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
  undo() { if (this.past.length) { this.future.push(this.snapshot()); this.restoreSnap(this.past.pop()); } }
  redo() { if (this.future.length) { this.past.push(this.snapshot()); this.restoreSnap(this.future.pop()); } }

  addPoint(ll) {
    this.commit();
    this.points.push(ll);
    if (this.points.length > 1) this.legs.push({ mode: this.mode });
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
  splitLeg(li, ll) {
    const leg = this.legs[li];
    const r = leg.result;
    if (r && leg.status === 'ok' && leg.mode !== 'water' && r.coords.length > 1) {
      const c = r.coords;
      const near = nearestOnLine(ll, c);
      const q = c[near.i], q2 = c[near.i + 1];
      const p = [+(q[0] + (q2[0] - q[0]) * near.t).toFixed(6), +(q[1] + (q2[1] - q[1]) * near.t).toFixed(6)];
      const half = (coords, tags) => ({ mode: leg.mode, status: 'ok', style: leg.style, result: { coords, tags, portage: [] } });
      this.points.splice(li + 1, 0, p);
      this.legs.splice(li, 1, half(c.slice(0, near.i + 1).concat([p]), r.tags.slice(0, near.i + 1)), half([p].concat(c.slice(near.i + 1)), r.tags.slice(near.i)));
      for (const k of [li, li + 1]) if (this.legs[k].mode !== 'fixed') this.legs[k].key = this.legKey(k).key;
    } else {
      this.points.splice(li + 1, 0, ll);
      this.legs.splice(li, 1, { mode: leg.mode === 'fixed' ? 'auto' : leg.mode, style: leg.style }, { mode: leg.mode === 'fixed' ? 'auto' : leg.mode, style: leg.style });
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
      const merged = a.mode === 'fixed' && b.mode === 'fixed' && a.result && b.result
        ? { mode: 'fixed', status: 'ok', result: { coords: a.result.coords.concat(b.result.coords.slice(1)), tags: a.result.tags.concat(b.result.tags), portage: [] } }
        : { mode: a.mode === 'fixed' ? 'auto' : a.mode, style: a.style };
      this.legs.splice(i - 1, 2, merged);
    }
    this.update();
  }

  reverse() {
    if (this.points.length < 2) return;
    this.commit();
    this.points.reverse();
    this.legs = this.legs.reverse().map((l) => (l.mode === 'fixed' && l.result
      ? { mode: 'fixed', status: 'ok', result: { coords: l.result.coords.slice().reverse(), tags: l.result.tags.slice().reverse(), portage: [] } }
      : { mode: l.mode, style: l.style }));
    this.update();
  }

  loop() {
    if (this.points.length < 2) return;
    this.addPoint(this.points[0].slice());
  }

  clear() {
    if (!this.points.length) return;
    this.commit();
    this.points = [];
    this.legs = [];
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
    this.menu = new maplibregl.Popup({ offset: 8, closeButton: false, className: 'polku-popup' }).setLngLat(lngLat).setDOMContent(body).addTo(this.map);
  }

  setLegMode(i, mode) {
    if (!this.legs[i] || this.legs[i].mode === mode) return;
    this.commit();
    this.legs[i] = { mode, style: this.legs[i].style };
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

  restore({ points, modes, style, legStyles }) {
    const sport = this.app.activity();
    this.points = points;
    this.legs = points.slice(1).map((_, i) => ({ mode: CODE_MODE[modes[i]] || modes[i] || 'auto' }))
      .map((l) => (l.mode === 'fixed' ? { mode: 'auto' } : l));
    // a shared link's style is the route's, not yours: your own per-sport choice stays as it was
    if (style != null) this.style = decodeStyle(sport, style);
    for (const part of (legStyles || '').split(',')) {
      const [i, code] = part.split(':');
      if (this.legs[+i] && code) this.legs[+i].style = decodeStyle(sport, code);
    }
    this.update();
  }

  onActivityChange() {
    const sport = this.app.activity();
    this.style = this.savedStyle(sport);
    this.styleLeg = null;
    if (this.legs.some((l) => l.style)) {
      for (const l of this.legs) l.style = null;
      toast('Legs with their own style now follow the route’s — styles are per sport');
    }
    this.setMode(ACTIVITIES[sport].mode);
    this.panel.classList.toggle('is-paddle', this.app.activity() === 'paddle');
    this.renderToolbarState();
    if (this.points.length > 1) this.update();
  }

  setActive(on) {
    this.active = on;
    this.panel.hidden = !on;
    if (!on) { this.closeMore(); delete document.body.dataset.sheet; delete document.body.dataset.pl; }
    // an empty route opens small, so the map is there to tap; otherwise as you left it
    if (on) this.setSheetState(!this.points.length && this.layout() === 'sheet' ? 'peek' : store.get('sheetState', {})[this.layout()], { remember: false });
    document.body.classList.toggle('planning', on);
    this.map.getCanvas().style.cursor = on ? 'crosshair' : '';
    for (const m of this.markers) m.getElement().hidden = !on;
    this.renderGhosts();
    this.app.onActiveChange(on);
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
    const nogos = leg.mode === 'auto' ? this.nogosNear(from, to) : [];
    const rp = this.routerFor(i); // the leg's route style, as the routers take it
    const profile = rp.profile || ACTIVITIES[this.app.activity()].brouter;
    const styleKey = leg.mode === 'line' ? '' : rp.key;
    return { key: `${leg.mode}|${profile}|${from.join(',')}|${to.join(',')}|${nogos.map((n) => n.ll.join(',') + n.r).join(';')}|${styleKey}`, from, to, nogos, profile, rp };
  }

  // the router parameters for leg i: its own style, or the route's
  routerFor(i) {
    const leg = this.legs[i];
    return routerOf(this.app.activity(), (leg && leg.style) || this.style, this.wet.on);
  }

  // what the routers get for a leg (styles.js)
  styleOpts(t) { return { params: t.rp.params, valhalla: t.rp.valhalla, water: t.rp.water }; }

  async routeAll() {
    const gen = ++this.gen;
    const todo = []; // legs to route: { leg, key, from, to, nogos, profile }
    this.legs.forEach((leg, i) => {
      if (leg.mode === 'fixed') { leg.status = 'ok'; return; }
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
      if (!loading) {
        for (const [a, b] of leg.result.portage || []) {
          features.push({ type: 'Feature', properties: { leg: i, mode, loading: false, kind: 'portage' }, geometry: { type: 'LineString', coordinates: coords.slice(a, b + 1) } });
        }
      }
    });
    this.app.setData('route', { type: 'FeatureCollection', features });
    if (!this.edit) this.renderGhosts();
  }

  // ---------------------------------------------------------------- route style
  savedStyle(sport) { return store.get('styles', {})[sport] || defaultStyle(); }

  wetFor(style) { const w = (style && style.wet) || 'auto'; return w === 'yes' || (w === 'auto' && this.wet.on); }

  // The Route style section: presets, the sport's controls, wet ground, and
  // what the last change did. Scoped to one leg when opened from a point.
  renderStyle() {
    const box = this.els && this.els.styleBox;
    if (!box) return;
    const sport = this.app.activity();
    const cat = STYLES[sport] || STYLES.mtb;
    if (this.styleLeg != null && !this.legs[this.styleLeg]) this.styleLeg = null;
    const leg = this.styleLeg;
    const own = leg != null ? this.legs[leg].style : null;
    const st = (leg != null && own) || this.style;
    const vals = valuesOf(sport, st);
    const custom = isCustom(sport, st);
    const set = (next) => this.setStyle(next, leg);
    const ownCount = this.legs.filter((l) => l.style).length;
    this.setSection('style', { summary: `${styleName(sport, this.style)}${ownCount ? ` · ${ownCount} leg${ownCount > 1 ? 's' : ''} with their own` : ''}` });
    box.innerHTML = '';
    if (leg != null) {
      box.append(h('div', { class: 'seg small full style-scope', role: 'group', 'aria-label': 'What the style is for' },
        h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => { this.styleLeg = null; this.renderStyle(); } }, 'Whole route'),
        h('button', { type: 'button', 'aria-pressed': 'true' }, `${this.nameOf(leg)} → ${this.nameOf(leg + 1)}`)),
      h('p', { class: 'note' }, own ? 'This leg has its own style; the rest of the route keeps the route’s.' : `This leg follows the route’s style (${styleName(sport, this.style)}). Pick one to give it its own.`));
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

  renderStyleWet(st = (this.styleLeg != null && this.legs[this.styleLeg] && this.legs[this.styleLeg].style) || this.style) {
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
    const sport = this.app.activity();
    this.commit();
    this.styleBefore = { stats: this.styleStats(), a: this.analysis }; // compared once the new route is in
    if (leg == null) {
      this.style = style;
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
    const sport = this.app.activity();
    if (!hasWet(sport) || !this.points.length) return;
    const uses = [this.style, ...this.legs.map((l) => l.style)].some((st) => st && (st.wet || 'auto') === 'auto');
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
    const sport = this.app.activity();
    const PAVED_S = ['asphalt', 'paved', 'concrete', 'paving_stones', 'sett', 'chipseal', 'concrete:plates'];
    let what = null;
    if (sport === 'road' || sport === 'gravel') what = ['unpaved', 100 - share(a.surfaces, PAVED_S.concat(['unknown', 'water']))];
    else if (sport === 'paddle') what = ['carries', Math.round(a.ways.filter(([k]) => k === 'portage').reduce((s, [, d]) => s + d, 0))];
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
    for (const leg of this.legs) {
      const r = leg.result;
      if (!r) continue;
      const mode = leg.status === 'error' || leg.status === 'waiting' ? 'line' : leg.mode; // a stand-in is a straight line
      if (!coords.length) coords.push(r.coords[0]);
      for (let k = 1; k < r.coords.length; k++) {
        coords.push(r.coords[k]);
        attrs.push({ mode, tags: r.tags[k - 1] || {} });
      }
    }
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
    this.renderAnalysis();
    this.loadWind(a);
  }

  // what the time estimate needs: the sport, the craft and your speeds
  timeOpt() {
    const activity = this.app.activity();
    return { activity, craft: this.craft, speeds: speedsFor(activity) };
  }

  // Speeds changed: re-time the route (no routing, no DEM), then the route
  // weather, since arrival times move.
  retime() {
    const a = this.analysis;
    if (!a) return;
    const t = estimateTime(a, this.timeOpt());
    a.time = t.total;
    a.tAt = t.tAt;
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
    const sel = this.els.wind.querySelector('.start-select');
    if (sel) sel.value = String(k);
    if (!fromMap && this.app.onStartChange) this.app.onStartChange(k);
    clearTimeout(this.windTimer);
    // playback moves an hour a second; let it settle a little before re-fetching
    this.windTimer = setTimeout(() => { if (this.analysis) this.loadWind(this.analysis); }, fromMap ? 250 : 0);
  }

  // Wind at the time each part of the route is reached: time the route without
  // wind, fetch the forecast, re-time it with the wind, and sample again.
  async loadWind(a) {
    const opt = this.timeOpt();
    const startSec = this.startSec();
    a.windError = false;
    try {
      let w = await windAlong(a.pts, a.along, a.tAt, startSec);
      let t = estimateTime(a, opt, w.head);
      w = await windAlong(a.pts, a.along, t.tAt, startSec); // same forecast, cached
      t = estimateTime(a, opt, w.head);
      if (this.analysis !== a) return;
      a.wind = { ...w, startSec };
      a.timeWind = t.total;
      a.tAtWind = t.tAt;
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
    const ng = this.map.getLayer('nogo-fill') && this.map.queryRenderedFeatures(e.point, { layers: ['nogo-fill'] })[0];
    if (ng) { this.openNogoMenu(ng.properties.i, e.lngLat); return; }
    const hit = this.map.queryRenderedFeatures([[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]], { layers: ['route-casing'] })[0];
    const ll = [+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)];
    if (hit && hit.properties.kind === 'leg' && !hit.properties.loading) this.insertPoint(hit.properties.leg, ll);
    else this.addPoint(ll);
    this.autoPeek();
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
    const onMap = this.app.routeTip(e.originalEvent, routeReadout(a, best, this.roadAt(best)));
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
    this.els.pointsFoot.replaceChildren(...(n > 1 ? [
      h('button', { type: 'button', class: 'btn', title: 'The finish becomes the start; each leg keeps its mode', onclick: () => this.reverse(), html: `${icon('reverse', 16)} Reverse direction` }),
      // each leg's routing and style, between its points (folded away by default)
      h('button', { type: 'button', class: 'btn', 'aria-pressed': String(showLegs), title: 'Every leg’s routing and style (or open one with the route button on its row)', onclick: () => { store.set('legSettings', !showLegs); this.openLegs.clear(); this.renderWaypoints(); }, html: `${icon('route', 16)} All leg settings` }),
    ] : []));
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
      const sub = [own || auto ? this.label(i) : '', fmtDist(i ? this.lengthTo(i) : 0), last && loop ? 'back at the start' : '', own && auto ? auto : ''].filter(Boolean).join(' · ');
      const row = h('li', { class: 'wpl-row', 'data-i': String(i), title: 'Show on the map', onclick: () => this.focusPoint(i) },
        h('span', { class: 'wpl-grip', title: 'Drag to reorder', 'aria-hidden': 'true', html: icon('grip', 16) }),
        h('span', { class: `wp wp-mini ${i === 0 ? 'wp-start' : last ? 'wp-end' : 'wp-via'}${last && loop ? ' wp-loop' : ''}`, 'aria-hidden': 'true' }, i === 0 || last ? '' : String(i)),
        h('span', { class: 'wpl-main' }, input, h('small', {}, sub)),
        h('span', { class: 'wpl-tools' },
          // this one leg's settings, under its point
          i < n - 1 ? h('button', { type: 'button', class: 'tool small', title: `The leg after ${this.nameOf(i)}: routing and style`, 'aria-label': `Settings of the leg after ${this.nameOf(i)}`, 'aria-pressed': String(showLegs || this.openLegs.has(i)), 'aria-expanded': String(showLegs || this.openLegs.has(i)),
            onclick: (e) => { e.stopPropagation(); if (showLegs) { store.set('legSettings', false); for (let k = 0; k < n - 1; k++) if (k !== i) this.openLegs.add(k); this.openLegs.delete(i); } else if (this.openLegs.has(i)) this.openLegs.delete(i); else this.openLegs.add(i); this.renderWaypoints(); },
            html: icon('route', 16) }) : h('span', { class: 'tool small', 'aria-hidden': 'true' }),
          btn('chevronUp', `Move ${this.nameOf(i)} earlier`, () => this.movePointTo(i, i - 1), i === 0),
          btn('chevronDown', `Move ${this.nameOf(i)} later`, () => this.movePointTo(i, i + 1), i === n - 1),
          btn('trash', `Remove ${this.nameOf(i)}`, () => this.removePoint(i), false, 'danger')));
      row.querySelector('.wpl-grip').addEventListener('pointerdown', (e) => this.dragRow(e, row, i));
      box.append(row);
      const leg = this.legs[i];
      if (!leg) return;
      if (showLegs || this.openLegs.has(i)) box.append(this.legSettingsRow(i));
      else {
        // folded: only what differs from the defaults
        const bits = [];
        if (leg.mode === 'line' || (leg.mode === 'water') !== (this.app.activity() === 'paddle')) bits.push(MODE_LABEL[leg.mode] || 'Imported track');
        if (leg.mode === 'fixed') bits.push('Imported track');
        if (leg.style) bits.push(`style: ${styleName(this.app.activity(), leg.style)}`);
        if (bits.length) {
          box.append(h('li', { class: 'wpl-leg', title: 'This leg differs from the rest — click for its settings', onclick: () => { this.openLegs.add(i); this.renderWaypoints(); } },
            h('span', { html: icon('route', 14) }), [...new Set(bits)].join(' · ')));
        }
      }
    });
  }

  // One leg's settings, between its two points: how it's routed, and its style.
  legSettingsRow(i) {
    const leg = this.legs[i];
    const modes = leg.mode === 'fixed'
      ? h('span', { class: 'wpl-legnote' }, 'Imported track')
      : h('div', { class: 'seg small', role: 'group', 'aria-label': `How the leg after ${this.nameOf(i)} is routed` }, ...['auto', 'line', 'water'].map((m) =>
        h('button', { type: 'button', 'aria-pressed': String(leg.mode === m), title: MODE_LABEL[m], onclick: () => this.setLegMode(i, m), html: `${icon(MODE_ICON[m], 14)}<span>${MODE_SHORT[m]}</span>` })));
    return h('li', { class: 'wpl-legset' }, h('span', { class: 'wpl-legline', 'aria-hidden': 'true' }), modes,
      leg.mode === 'auto' ? this.legStylePicker(i, () => {}) : null);
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
      const el = h('div', { class: 'wp-hit', title: `${this.nameOf(i)} · drag to move · click for options` }, h('div', {
        class: `wp ${i === 0 ? 'wp-start' : last ? 'wp-end' : 'wp-via'}${loopEnd ? ' wp-loop' : ''}`,
      }, i === 0 ? '' : last ? '' : String(i)));
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
  // else, or click it for a via point there. Hidden where the leg is short on
  // screen, so the handles never crowd the points.
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
      const el = h('div', { class: `wp-hit ghost ghost-${mode}`, title: 'Drag to reshape the route · click to add a point here' }, h('div', { class: 'wp-ghost' }));
      const m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(mid).addTo(this.map);
      m.len = len;
      m.on('dragstart', () => {
        const snap = this.snapshot();
        el.classList.add('dragging');
        this.beginEdit(this.splitLeg(li, mid), snap, m);
      });
      m.on('drag', () => { const ll = m.getLngLat(); this.editTo([+ll.lng.toFixed(6), +ll.lat.toFixed(6)]); });
      m.on('dragend', () => this.endEdit());
      el.addEventListener('click', (ev) => { ev.stopPropagation(); if (Date.now() >= this.noClickUntil) this.insertPoint(li, mid); });
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
    const nm = this.pname.get(this.points[ed.i]);
    this.points[ed.i] = ll;
    if (nm) this.pname.set(ll, nm);
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

  // Long-press (touch) or right-click elsewhere on the map: what you can do at that spot.
  bindSpotMenu() {
    const map = this.map;
    let hold = 0, p0 = null, lastTouch = 0;
    const cancel = () => { clearTimeout(hold); hold = 0; };
    const onUi = (e) => e.originalEvent && e.originalEvent.target.closest && e.originalEvent.target.closest('.maplibregl-marker, .maplibregl-popup');
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
      act('close', 'Avoid this spot', 'Routes go around it (40 m)', () => { if (!this.active) this.setActive(true); this.addNogo(ll, 40, 'Avoided place'); }));
    this.menu = new maplibregl.Popup({ offset: 6, closeButton: false, maxWidth: '320px', className: 'polku-popup' }).setLngLat(lngLat).setDOMContent(body).addTo(this.map);
    this.menu.spot = true;
    this.keepMenuInView();
  }

  // "Style: the route's / a preset / fine-tune…" for the leg after point i
  legStylePicker(i, done) {
    const sport = this.app.activity();
    const cat = STYLES[sport] || STYLES.mtb;
    const own = this.legs[i].style;
    const sel = h('select', { 'aria-label': 'Style of the next leg', onchange: (e) => {
      const v = e.target.value;
      done();
      if (v === '~tune') { this.styleLeg = i; this.renderStyle(); this.reveal('style'); return; }
      this.setStyle(v ? { p: v, v: {}, wet: this.style.wet || 'auto' } : null, i);
    } },
    h('option', { value: '' }, `The route’s (${styleName(sport, this.style)})`),
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
      legOut ? h('div', { class: 'pt-label' }, 'Next leg') : null,
      legOut ? h('div', { class: 'seg small' }, ...['auto', 'line', 'water'].map((m) =>
        h('button', { type: 'button', 'aria-pressed': String(legOut.mode === m), title: MODE_LABEL[m], onclick: () => { this.menu.remove(); this.setLegMode(i, m); }, html: `${icon(MODE_ICON[m], 16)}<span>${MODE_SHORT[m]}</span>` }))) : null,
      legOut && legOut.mode !== 'line' && legOut.mode !== 'fixed' ? this.legStylePicker(i, () => this.menu.remove()) : null,
      via ? h('div', { class: 'pt-row' },
        act('flag', 'Start here', loop ? 'Start the loop from this point: the same route' : 'Make this the start: the part before it is removed', () => this.startAt(i)),
        loop ? null : act('check', 'Finish here', 'Make this the finish: the rest is removed', () => this.finishAt(i))) : null,
      last && !loop && n > 1 ? act('loop', 'Back to start', 'Add a leg back to the start', () => this.loop()) : null,
      act('trash', 'Remove point', '', () => this.removePoint(i), 'btn danger-text'));
    this.menu = new maplibregl.Popup({ offset: 16, closeButton: false, maxWidth: '320px', className: 'polku-popup' })
      .setLngLat(marker.getLngLat()).setDOMContent(body).addTo(this.map);
    this.keepMenuInView();
  }

  // clear of the top bar, the controls and the planner
  keepMenuInView() {
    const pad = this.viewPadding(0);
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
      style: encodeStyle(this.app.activity(), this.style),
      legStyles: this.legs.map((l) => (l.style ? encodeStyle(this.app.activity(), l.style) || 'balanced' : null)),
      modes: this.legs.map((l) => l.mode),
      fixed: this.legs.map((l) => (l.mode === 'fixed' && l.result ? encodePolyline(l.result.coords) : null)),
      routed: this.legs.map((l) => (l.mode !== 'fixed' && l.status === 'ok' && l.key && l.result
        ? { key: l.key, line: encodePolyline(l.result.coords), tags: l.result.tags.map(tagId), portage: l.result.portage || [], provider: l.result.provider } : null)),
      tags: table,
    });
  }

  loadSaved() {
    const r = store.get('route', null);
    if (r && r.nogos) { this.nogos = r.nogos; this.drawNogos(); }
    if (!r || !r.points || !r.points.length) return false;
    this.points = r.points;
    this.nameAll(r.names);
    if (r.style != null) this.style = decodeStyle(this.app.activity(), r.style);
    this.legs = r.points.slice(1).map((_, i) => {
      if (r.modes[i] === 'fixed' && r.fixed && r.fixed[i]) {
        const c = decodePolyline(r.fixed[i]);
        return { mode: 'fixed', status: 'ok', result: { coords: c, tags: c.slice(1).map(() => ({})), portage: [] } };
      }
      const k = r.routed && r.routed[i];
      if (k && r.tags) {
        const c = decodePolyline(k.line);
        c[0] = r.points[i]; c[c.length - 1] = r.points[i + 1]; // exact ends, so the leg's key still matches
        return { mode: r.modes[i], key: k.key, status: 'ok', result: { coords: c, tags: k.tags.map((t) => r.tags[t] || {}), portage: k.portage || [], provider: k.provider } };
      }
      return { mode: r.modes[i] === 'fixed' ? 'auto' : r.modes[i] || 'auto' };
    });
    (r.legStyles || []).forEach((c, i) => { if (c && this.legs[i]) this.legs[i].style = decodeStyle(this.app.activity(), c); });
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
      style: encodeStyle(this.app.activity(), this.style),
      legStyles: this.legs.map((l) => (l.style ? encodeStyle(this.app.activity(), l.style) || 'balanced' : null)),
      nogos: this.nogos,
      legs: this.legs.map((l) => ({ mode: l.mode, key: l.key, result: l.status === 'ok' || l.mode === 'fixed' ? l.result : null })),
    };
  }

  restoreSnapshot(s) {
    this.points = s.points;
    this.nameAll(s.names);
    this.nogos = s.nogos || [];
    this.routeName = s.routeName || '';
    if (s.style != null) this.style = decodeStyle(s.activity || this.app.activity(), s.style);
    this.legs = s.legs.map((l, i) => {
      const style = s.legStyles && s.legStyles[i] ? decodeStyle(s.activity || this.app.activity(), s.legStyles[i]) : null;
      return l.result ? { mode: l.mode, key: l.key, status: 'ok', result: l.result, style } : { mode: l.mode, style };
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
    const ps = this.legs.map((l, i) => (l.style ? `${i}:${encodeStyle(sport, l.style) || 'balanced'}` : '')).filter(Boolean).join(',');
    if (ps) u.searchParams.set('ps', ps);
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
    download(`${name.replace(/[^\w\- ]+/g, '').trim() || 'route'}.gpx`, toGPX({ name, coords: line.coords, ele: sampleEle(a, line.coords), waypoints: this.points, names: this.points.map((_, i) => this.nameOf(i)) }));
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
    this.els.more = tool('more', 'More: reverse, back to start, import, export, share, offline, clear', () => this.toggleMore());
    this.els.more.setAttribute('aria-haspopup', 'menu');
    this.els.sum = h('div', { class: 'sheet-sum', 'aria-live': 'polite' });
    this.els.min = tool('chevronUp', 'Minimise', () => {
      const st = this.panel.dataset.state;
      if (this.layout() === 'side') this.setSheetState(st === 'min' ? 'open' : 'min');
      else this.setSheetState(st === 'peek' ? (this.lastOpen || 'half') : 'peek');
    }, 'sheet-min');
    this.els.handle = h('div', { class: 'sheet-handle', role: 'button', tabindex: '0', 'aria-label': 'Planner size: drag, or press to change', 'aria-controls': 'planner' });
    this.els.head = h('div', { class: 'sheet-head' }, h('div', { class: 'sheet-head-in' },
      h('div', { class: 'sheet-row' }, this.els.sum, this.els.min,
        h('button', { type: 'button', class: 'btn done', title: 'Close the planner (R) — the route stays', onclick: () => this.setActive(false) }, 'Done')),
      h('div', { class: 'sheet-row tools-row' }, modes, h('div', { class: 'tools' }, this.els.fit, this.els.undo, this.els.redo,
        // a wide bottom bar has room for the common tools; elsewhere they live in ⋯
        h('span', { class: 'tool-sep tool-wide' }),
        tool('reverse', 'Reverse direction', () => this.reverse(), 'tool-wide'),
        tool('loop', 'Back to start', () => this.loop(), 'tool-wide'),
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
    this.els.mapToggle = h('input', { type: 'checkbox', role: 'switch', checked: this.colorOnMap, onchange: (e) => {
      this.colorOnMap = e.target.checked;
      store.set('colorOnMap', this.colorOnMap);
      this.drawColored();
    } });
    this.els.mapToggleRow = h('label', { class: 'tg tg-inline', title: 'Colour the route line on the map the same way as the profile' },
      h('span', { class: 'tg-text' }, 'On map'), this.els.mapToggle, h('span', { class: 'tg-ui', 'aria-hidden': 'true' }));
    this.els.breakdown = h('div', { class: 'breakdown' });
    this.els.climbs = h('div', { class: 'list climbs' });
    this.els.warnings = h('div', { class: 'list warnings' });
    this.els.wind = h('div', { class: 'list wind' });
    this.els.hint = h('p', { class: 'hint' }, matchMedia('(pointer: coarse)').matches
      ? 'Tap the map to add points · drag a point, or hold the line and drag, to reshape · tap a point for options · hold the map for more'
      : 'Click the map to add points · drag a point or the line to reshape · click a point for options · right-click for more');
    this.els.dock = h('div', { class: 'dock' }); // the timeline docks here while planning (main.js)
    this.els.body = h('div', { class: 'sheet-body' }, this.els.stats, h('div', { class: 'sheet-cols' },
      // the chart first; then one line to choose what colours it (a menu, or chips where they fit in a row)
      this.section('profile', 'Profile',
        h('div', { class: 'profile-box' }, h('canvas', { id: 'profile-canvas' }), h('div', { id: 'profile-tip', class: 'profile-tip', hidden: true })),
        h('div', { class: 'profile-top' }, this.els.modeSelect, this.els.modesBar, this.els.mapToggleRow),
        this.els.breakdown),
      // one reading order, in a column or in rows (wide panel): your points and what the route is like, then the settings
      h('div', { class: 'sec-break', 'aria-hidden': 'true' }), // wide panel: a new row
      this.section('points', 'Waypoints', this.els.points = h('ol', { class: 'wpl', 'aria-label': 'Waypoints, in order' }), this.els.pointsFoot = h('div', { class: 'wpl-foot' })),
      // the two short lists share a column in a wide panel
      h('div', { class: 'sec-stack' }, this.section('warnings', 'Heads-up', this.els.warnings), this.section('climbs', 'Climbs', this.els.climbs)),
      this.section('depart', 'Departure & weather', this.els.dock, this.els.wind),
      h('div', { class: 'sec-break', 'aria-hidden': 'true' }), // wide panel: a new row
      this.section('style', 'Route style', this.els.styleBox = h('div', { class: 'style-box' })),
      this.section('speed', 'Time & speed', this.els.speedBox = h('div', { class: 'speed-box' }), this.els.speedRoute = h('div', { class: 'speed-route' }))),
      this.els.hint);
    this.els.grip = h('div', { class: 'sheet-resize', role: 'separator', tabindex: '0', 'aria-orientation': 'vertical', 'aria-controls': 'planner',
      'aria-label': 'Planner width', title: 'Drag to resize · double-click: narrow ↔ wide' });
    p.append(this.els.handle, this.els.head, this.els.body, this.els.grip);
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
  }

  // ---------------------------------------------------------------- panel layout & states
  // Wide screens choose: a side panel on the left (default) or a bottom panel
  // (⋯ → Move to the bottom). Phones and narrow windows always get the bottom sheet.
  layout() { return this.sideMQ.matches && store.get('plannerDock', 'left') === 'left' ? 'side' : 'sheet'; }

  setDock(where) {
    store.set('plannerDock', where);
    this.setSheetState(store.get('sheetState', {})[this.layout()], { remember: false });
    this.app.onActiveChange(this.active); // padding vars, button states
    requestAnimationFrame(() => this.chart.draw());
  }

  setSheetState(st, { remember = true } = {}) {
    const lay = this.layout();
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
    const profileH = () => {
      const hd = this.els.head, sec = this.sec.profile.el, top = sec.querySelector('.profile-top');
      const peek = hd.offsetTop + hd.offsetHeight + 6;
      if (sec.hidden || !top.offsetHeight) return Math.round(Math.min(innerHeight * 0.36, peek + 230));
      return Math.round(Math.min(innerHeight * 0.45, peek + top.getBoundingClientRect().bottom - sec.getBoundingClientRect().top + 12));
    };
    const sizes = () => {
      const hd = this.els.head;
      this.panel.style.setProperty('--peek-h', `${Math.ceil(hd.offsetTop + hd.offsetHeight + 6)}px`);
      this.panel.style.setProperty('--profile-h', `${profileH()}px`);
    };
    new ResizeObserver(sizes).observe(this.els.head);
    new ResizeObserver(sizes).observe(this.sec.profile.el);
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
    if (this.moreEl) { this.closeMore(); return; }
    const item = (name, label, fn, cls = '') => h('button', { type: 'button', role: 'menuitem', class: `menu-item ${cls}`, onclick: () => { this.closeMore(); fn(); }, html: `${icon(name, 17)}<span>${label}</span>` });
    const two = this.points.length > 1;
    const side = this.layout() === 'side';
    const el = h('div', { class: 'menu', role: 'menu', 'aria-label': 'Route actions' },
      this.sideMQ.matches ? item(side ? 'panelBottom' : 'panelLeft', side ? 'Move to the bottom' : 'Move to the left', () => this.setDock(side ? 'bottom' : 'left')) : null,
      this.sideMQ.matches ? h('hr') : null,
      Object.assign(item('reverse', 'Reverse direction', () => this.reverse()), { disabled: !two }),
      Object.assign(item('loop', 'Back to start', () => this.loop()), { disabled: !two }),
      h('hr'),
      item('upload', 'Import GPX / KML…', () => $('#file-input').click()),
      Object.assign(item('download', 'Export GPX', () => this.exportGpx()), { disabled: !two }),
      Object.assign(item('share', 'Copy share link', () => this.share()), { disabled: !two }),
      Object.assign(item('offline', 'Save offline…', () => this.app.saveOffline()), { disabled: !two }),
      h('hr'),
      Object.assign(item('trash', 'Clear route', () => this.clear(), 'danger'), { disabled: !this.points.length }));
    this.panel.append(el);
    const b = this.els.more.getBoundingClientRect(), pr = this.panel.getBoundingClientRect();
    const below = b.bottom + 260 < innerHeight;
    el.style.right = `${Math.max(8, pr.right - b.right)}px`;
    if (below) el.style.top = `${b.bottom - pr.top + 4}px`; else el.style.bottom = `${pr.bottom - b.top + 4}px`;
    this.moreEl = el;
    this.els.more.setAttribute('aria-expanded', 'true');
    el.querySelector('.menu-item:not(:disabled)')?.focus();
    this.offMore = (e) => { if (!el.contains(e.target) && !this.els.more.contains(e.target)) this.closeMore(); };
    setTimeout(() => document.addEventListener('pointerdown', this.offMore, true));
  }

  closeMore() {
    if (!this.moreEl) return;
    this.moreEl.remove();
    this.moreEl = null;
    this.els.more.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', this.offMore, true);
  }

  setCraft(k) {
    this.craft = k;
    store.set('craft', k);
    this.retime();
  }

  // "Time & speed": your speeds for this sport (editable) and where the time goes on this route.
  renderSpeed() {
    const a = this.analysis;
    const act = this.app.activity();
    const sum = speedSummary(act, this.craft);
    this.setSection('speed', { summary: `${sum.name} · ${sum.txt}`, empty: !a });
    if (!a) return;
    renderSpeedEditor(this.els.speedBox, act, { craft: this.craft, onCraft: (k) => this.setCraft(k), onChange: () => this.retime() });
    const box = this.els.speedRoute;
    box.innerHTML = '';
    const tAt = a.tAtWind || a.tAt;
    const cats = {};
    let up = 0;
    for (let i = 1; i < a.pts.length; i++) {
      const c = surfaceClass(a, i);
      const dt = tAt[i] - tAt[i - 1], dd = a.along[i] - a.along[i - 1];
      (cats[c] ||= { d: 0, t: 0 });
      cats[c].d += dd; cats[c].t += dt;
      if (a.grade[i] > 3 && c !== 'water') up += dt;
    }
    const runner = act === 'run' || act === 'trailrun';
    const LABEL = { paved: 'Paved', unpaved: 'Gravel & unpaved', trail: act === 'hike' || runner ? 'Paths & trails' : 'Trails', water: 'On the water', carry: 'Carries' };
    const speedTxt = (d, t) => (t > 0 ? (runner ? `${pace((d / 1000) / (t / 3600))} /km` : `${((d / 1000) / (t / 3600)).toFixed(1)} km/h`) : '');
    const rows = ['paved', 'unpaved', 'trail', 'water', 'carry'].filter((k) => cats[k] && cats[k].d > 20);
    box.append(h('h4', {}, 'On this route'),
      h('div', { class: 'speed-table' },
        ...rows.map((k) => h('div', { class: 'speed-row' }, h('span', {}, LABEL[k]), h('b', {}, fmtDist(cats[k].d)), h('b', {}, fmtDuration(cats[k].t)), h('small', {}, speedTxt(cats[k].d, cats[k].t)))),
        up > 30 && act !== 'paddle' ? h('div', { class: 'speed-row sub' }, h('span', {}, 'of which uphill (over 3 %)'), h('b', {}, ''), h('b', {}, fmtDuration(up)), h('small', {}, '')) : null,
        a.timeWind ? h('div', { class: 'speed-row sub' }, h('span', {}, 'the wind'), h('b', {}, ''), h('b', {}, Math.abs(a.timeWind - a.time) < 60 ? 'about ±0' : `${a.timeWind > a.time ? '+' : '−'}${fmtDuration(Math.abs(a.timeWind - a.time))}`), h('small', {}, 'included above')) : null,
        h('div', { class: 'speed-row total' }, h('span', {}, 'Moving time'), h('b', {}, fmtDist(a.total)), h('b', {}, fmtDuration(a.timeWind || a.time)), h('small', {}, speedTxt(a.total, a.timeWind || a.time)))));
  }

  renderModeChips() {
    const act = this.app.activity();
    const applies = act === 'paddle'
      ? (k) => ['way', 'wind', 'temp', 'rain'].includes(k)
      : (k) => (k === 'down' || k === 'uphill' ? OFFROAD_BIKE.has(act) : true);
    if (!applies(this.colorMode)) this.colorMode = act === 'paddle' ? 'wind' : 'grade';
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
    this.toggleSection(id, true);
    const st = this.panel.dataset.state;
    if (this.layout() === 'sheet' && (st === 'peek' || (st === 'profile' && id !== 'profile'))) this.setSheetState('half');
    else if (this.layout() === 'side' && this.panel.dataset.state === 'min') this.setSheetState('open');
    requestAnimationFrame(() => this.sec[id].el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  profileSummary() {
    const a = this.analysis;
    if (a.activity === 'paddle') {
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

  renderAnalysis() {
    const a = this.analysis;
    const act = this.app.activity();
    const st = this.els.stats;
    const sum = this.els.sum;
    st.innerHTML = '';
    sum.innerHTML = '';
    const stat = (label, value, sub = '') => st.append(h('div', { class: 'stat' }, h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-value', html: value }), sub ? h('span', { class: 'stat-sub', title: sub }, sub) : null));
    const key = (label, value, title = '') => sum.append(h('div', { class: 'sum-item', title }, h('b', {}, value), h('small', {}, label)));
    for (const id of ['profile', 'climbs', 'warnings', 'speed']) this.setSection(id, { empty: !a });
    this.renderWaypoints(); // distances along the route
    // the clock stays reachable before there's a route: set the time, then draw
    if (!a) this.setSection('depart', { summary: this.startOffsetH ? `Depart ${new Date(this.startSec() * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Depart now' });
    if (!a) {
      sum.append(h('p', { class: 'sum-empty' }, this.points.length
        ? 'Add another point to make a route'
        : `${matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click'} the map to add a start point`));
      this.chart.setData(null);
      this.els.breakdown.innerHTML = '';
      this.els.climbs.innerHTML = '';
      this.els.warnings.innerHTML = '';
      this.els.wind.innerHTML = '';
      this.els.hint.hidden = false;
      if (this.app.onAnalysis) this.app.onAnalysis(null);
      return;
    }
    this.els.hint.hidden = this.points.length > 2;
    const paddle = act === 'paddle';
    key('distance', fmtDist(a.total));
    // the time is from your departure: tapping it opens the clock (one control for both)
    const dep = this.startOffsetH ? new Date(this.startSec() * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now';
    const time = h('button', { type: 'button', class: 'sum-item sum-time', title: `Estimated moving time${a.timeWind ? ', with the wind' : ''}${paddle ? ` (${CRAFT[this.craft].label})` : ''} · set the departure`, onclick: () => this.reveal('depart') },
      h('b', {}, fmtDuration(a.timeWind || a.time)), h('small', {}, `from ${dep}`));
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
    st.append(h('button', { type: 'button', class: 'stat stat-btn', title: 'Your speeds for this sport — tap to see or change them', onclick: () => this.reveal('speed') },
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
    if (this.colorMode === 'surface') rows = a.surfaces.map(([k, d]) => [k.replace('_', ' '), d, SURFACE_COLORS[k] || SURFACE_COLORS.unknown]);
    else if (this.colorMode === 'way') rows = a.ways.map(([k, d]) => [k, d, WAY_COLORS[k] || WAY_COLORS.other]);
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
    const bike = OFFROAD_BIKE.has(this.app.activity()); // uphill grades; others read the average gradient
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
    const all = [...a.warnings.filter((w) => !(/^Straight line/.test(w.text) && standIn.some(([s0, s1]) => w.at >= s0 && w.at + w.len <= s1))), ...(a.hazards || [])].sort((x, y) => x.at - y.at);
    const unrouted = this.legs.filter((l) => l.status === 'error' || l.status === 'waiting').length;
    const count = all.length + (unrouted ? 1 : 0) + (this.legs.some((l) => l.result && l.result.provider === 'valhalla' && l.status === 'ok') ? 1 : 0);
    this.setSection('warnings', { count: count || '', empty: !count, summary: unrouted ? `${unrouted} leg${unrouted > 1 ? 's' : ''} not routed` : all.length ? all[0].text + (all.length > 1 ? ` · +${all.length - 1} more` : '') : '' });
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
    const KIND_ICON = { roadwork: 'warn', incident: 'warn', roadcond: 'warn', busy: 'warn' };
    for (const w of all.slice(0, 40)) {
      const i0 = Math.max(0, a.along.findIndex((d) => d >= w.at));
      let i1 = a.along.findIndex((d) => d >= w.at + Math.max(w.len, 30));
      if (i1 < 0) i1 = a.along.length - 1;
      // anything with a place can be avoided: a circle over the hazard
      const avoid = w.avoid || (/^(Straight line|Carry)/.test(w.text) ? null : { ll: a.pts[Math.round((i0 + i1) / 2)], r: Math.max(25, Math.min(150, (w.len || 50) / 2 + 15)) });
      const row = h('div', { class: `li-row kind-${w.kind || 'route'}` },
        h('button', { type: 'button', class: 'li', html: `${icon(KIND_ICON[w.kind] || 'warn', 16)}<span class="li-main"><b>${escapeHtml(w.text)}</b><span>at km ${(w.at / 1000).toFixed(1)}${w.len > 5 ? ` · ${fmtDist(w.len)}` : ''}</span></span>`, onclick: () => this.focusRange(i0, i1, w) }),
        avoid && this.legs.some((l) => l.mode === 'auto') ? h('button', { type: 'button', class: 'btn avoid', title: 'Route around this place', onclick: () => this.addNogo(avoid.ll, avoid.r, w.text) }, 'Avoid') : null);
      box.append(row);
    }
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
    this.chart.setHighlight([a.along[i0], a.along[i1]]);
    const b = bbox(a.pts.slice(i0, i1 + 1));
    this.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: this.viewPadding(), maxZoom: 16, duration: 700 });
  }

  renderWind() {
    const a = this.analysis;
    const box = this.els.wind;
    const act = this.app.activity();
    box.innerHTML = '';
    if (!a) return;
    // departure → back, for the section summary
    const fmt = (sec) => new Date(sec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const start = this.startSec();
    const when = `${this.startOffsetH ? `Depart ${fmt(start)}` : 'Depart now'} → back ${fmt(start + (a.timeWind || a.time))}`;
    box.append(h('h4', { class: 'wind-title' }, act === 'paddle' ? 'Weather on the water' : 'Weather on the route'));
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

export function parseShared(params) {
  const r = params.get('r');
  if (!r) return null;
  try {
    const points = decodePolyline(r);
    if (points.length < 1) return null;
    return { points, modes: (params.get('m') || '').split(''), activity: params.get('a'), style: params.get('p') || '', legStyles: params.get('ps') || '' };
  } catch {
    return null;
  }
}
