// Route planner: waypoints, per-leg routing modes, undo/redo, the bottom sheet
// with stats, elevation profile, climbs, warnings and (for paddling) wind.

import { ACTIVITIES, CRAFT, DIFF_COLORS, UPHILL_TEXT, SURFACE_COLORS, GRADE_BANDS, MTB_SCALE_TEXT, gradeColor } from './config.js';
import { routeLeg } from './router.js';
import { analyse, windExposure } from './analysis.js';
import { ProfileChart, COLOR_MODES, WAY_COLORS } from './chart.js';
import { dist, encodePolyline, decodePolyline, fmtDist, fmtDuration, compass, bbox, nearestOnLine, simplify } from './geo.js';
import { toGPX, download } from './gpx.js';
import { wind, windRating } from './weather.js';
import { icon, h, $, toast, store, escapeHtml } from './ui.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
const MODE_LABEL = { auto: 'Follow paths', line: 'Straight line', water: 'Over water' };
const MODE_ICON = { auto: 'auto', line: 'straight', water: 'water' };
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
    this.analysis = null;
    this.colorMode = store.get('colorMode', 'grade');
    this.gen = 0;
    this.selected = null;
    this.collapsed = false;
    this.panel = $('#planner');
    this.buildPanel();
    this.chart = new ProfileChart($('#profile-canvas'), $('#profile-tip'));
    this.chart.onHover = (i) => this.hoverAt(i);
    this.chart.onClick = (i) => this.analysis && this.map.easeTo({ center: this.analysis.pts[i], duration: 500 });
    map.on('click', (e) => this.onMapClick(e));
    map.on('mousemove', (e) => this.onMapMove(e));
  }

  // ---------------------------------------------------------------- state
  snapshot() {
    return {
      points: this.points.map((p) => p.slice()),
      legs: this.legs.map((l) => ({ mode: l.mode, result: l.result, key: l.key, status: l.status })),
    };
  }
  commit() {
    this.past.push(this.snapshot());
    if (this.past.length > 100) this.past.shift();
    this.future = [];
  }
  restoreSnap(s) {
    this.points = s.points;
    this.legs = s.legs.map((l) => ({ ...l }));
    this.update();
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
    const leg = this.legs[legIdx];
    if (!leg) return this.addPoint(ll);
    this.commit();
    if (leg.mode === 'fixed' && leg.result) {
      const c = leg.result.coords;
      const near = nearestOnLine(ll, c);
      const k = Math.max(1, Math.min(c.length - 2, near.i + (near.t > 0.5 ? 1 : 0)));
      const a = { mode: 'fixed', status: 'ok', result: { coords: c.slice(0, k + 1), tags: leg.result.tags.slice(0, k), portage: [] } };
      const b = { mode: 'fixed', status: 'ok', result: { coords: c.slice(k), tags: leg.result.tags.slice(k), portage: [] } };
      this.points.splice(legIdx + 1, 0, c[k]);
      this.legs.splice(legIdx, 1, a, b);
    } else {
      this.points.splice(legIdx + 1, 0, ll);
      this.legs.splice(legIdx, 1, { mode: leg.mode }, { mode: leg.mode });
    }
    this.update();
  }

  movePoint(i, ll) {
    this.commit();
    this.points[i] = ll;
    for (const li of [i - 1, i]) {
      const leg = this.legs[li];
      if (leg && leg.mode === 'fixed' && leg.result) {
        const c = leg.result.coords.slice();
        if (li === i - 1) c[c.length - 1] = ll; else c[0] = ll;
        leg.result = { ...leg.result, coords: c };
      }
    }
    this.update();
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
        : { mode: a.mode === 'fixed' ? 'auto' : a.mode };
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
      : { mode: l.mode }));
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

  setLegMode(i, mode) {
    if (!this.legs[i] || this.legs[i].mode === mode) return;
    this.commit();
    this.legs[i] = { mode };
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

  restore({ points, modes }) {
    this.points = points;
    this.legs = points.slice(1).map((_, i) => ({ mode: CODE_MODE[modes[i]] || modes[i] || 'auto' }))
      .map((l) => (l.mode === 'fixed' ? { mode: 'auto' } : l));
    this.update();
  }

  onActivityChange() {
    this.setMode(ACTIVITIES[this.app.activity()].mode);
    this.panel.classList.toggle('is-paddle', this.app.activity() === 'paddle');
    this.renderToolbarState();
    if (this.points.length > 1) this.update();
  }

  setActive(on) {
    this.active = on;
    this.panel.hidden = !on;
    document.body.classList.toggle('planning', on);
    this.map.getCanvas().style.cursor = on ? 'crosshair' : '';
    for (const m of this.markers) m.getElement().hidden = !on;
    this.app.onActiveChange(on);
    if (on) requestAnimationFrame(() => this.chart.draw());
  }

  // ---------------------------------------------------------------- routing
  update() {
    this.renderMarkers();
    this.renderToolbarState();
    this.save();
    this.routeAll();
  }

  async routeAll() {
    const gen = ++this.gen;
    const act = this.app.activity();
    const profile = ACTIVITIES[act].brouter;
    const jobs = [];
    this.legs.forEach((leg, i) => {
      if (leg.mode === 'fixed') { leg.status = 'ok'; return; }
      const from = this.points[i], to = this.points[i + 1];
      const key = `${leg.mode}|${profile}|${from.join(',')}|${to.join(',')}`;
      if (leg.key === key && leg.result) return;
      leg.key = key;
      leg.result = null;
      leg.status = 'loading';
      jobs.push(async () => {
        try {
          const r = await routeLeg({ from, to, mode: leg.mode, profile, opts: { portage: true } });
          if (leg.key !== key) return;
          leg.result = r;
          leg.status = 'ok';
          if (r.note && this.active) toast(r.note, { tone: 'warn' });
        } catch (e) {
          if (leg.key !== key) return;
          leg.result = { coords: [from, to], tags: [{}], portage: [] };
          leg.status = 'error';
          toast(`Couldn't route this leg: ${e.message}. Drawn as a straight line.`, { tone: 'warn', ms: 5000 });
        }
        this.drawRoute();
      });
    });
    this.drawRoute();
    this.panel.classList.toggle('busy', jobs.length > 0);
    await pool(jobs, 3);
    if (gen !== this.gen) return;
    this.panel.classList.remove('busy');
    await this.runAnalysis(gen);
  }

  drawRoute() {
    const features = [];
    this.legs.forEach((leg, i) => {
      const from = this.points[i], to = this.points[i + 1];
      const loading = !leg.result;
      const coords = loading ? [from, to] : leg.result.coords;
      const mode = leg.status === 'error' ? 'line' : leg.mode === 'fixed' ? 'auto' : leg.mode;
      features.push({ type: 'Feature', properties: { leg: i, mode, loading, kind: 'leg' }, geometry: { type: 'LineString', coordinates: coords } });
      if (!loading) {
        for (const [a, b] of leg.result.portage || []) {
          features.push({ type: 'Feature', properties: { leg: i, mode, loading: false, kind: 'portage' }, geometry: { type: 'LineString', coordinates: coords.slice(a, b + 1) } });
        }
      }
    });
    this.app.setData('route', { type: 'FeatureCollection', features });
  }

  mergedLine() {
    const coords = [];
    const attrs = [];
    for (const leg of this.legs) {
      const r = leg.result;
      if (!r) continue;
      const mode = leg.status === 'error' ? 'line' : leg.mode;
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
    const a = await analyse(line, { activity: this.app.activity(), craft: this.craft });
    if (gen !== this.gen) return;
    this.analysis = a;
    this.renderAnalysis();
  }

  // ---------------------------------------------------------------- map interaction
  onMapClick(e) {
    if (!this.active) return;
    const hit = this.map.queryRenderedFeatures([[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]], { layers: ['route-casing'] })[0];
    const ll = [+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)];
    if (hit && hit.properties.kind === 'leg' && !hit.properties.loading) this.insertPoint(hit.properties.leg, ll);
    else this.addPoint(ll);
  }

  onMapMove(e) {
    const a = this.analysis;
    if (!a || this.panel.hidden) return;
    const hit = this.map.queryRenderedFeatures([[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]], { layers: ['route-casing'] }).length;
    if (!hit) {
      if (this.mapHover) { this.mapHover = false; this.chart.setHover(-1); this.app.setData('routeHover', EMPTY); }
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
    this.chart.setHover(best);
    this.hoverAt(best, true);
  }

  hoverAt(i, fromMap = false) {
    if (i == null || i < 0 || !this.analysis) { this.app.setData('routeHover', EMPTY); return; }
    this.app.setData('routeHover', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: this.analysis.pts[i] } }] });
    if (!fromMap) this.mapHover = false;
  }

  renderMarkers() {
    for (const m of this.markers) m.remove();
    this.markers = this.points.map((p, i) => {
      const last = i === this.points.length - 1 && i > 0;
      const loopEnd = last && dist(p, this.points[0]) < 3;
      const el = h('div', {
        class: `wp ${i === 0 ? 'wp-start' : last ? 'wp-end' : 'wp-via'}${loopEnd ? ' wp-loop' : ''}`,
        title: 'Drag to move · click for options',
      }, i === 0 ? '' : last ? '' : String(i));
      el.hidden = !this.active;
      const m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(p).addTo(this.map);
      m.on('dragend', () => {
        const ll = m.getLngLat();
        this.movePoint(i, [+ll.lng.toFixed(6), +ll.lat.toFixed(6)]);
      });
      el.addEventListener('click', (ev) => { ev.stopPropagation(); this.openPointMenu(i, m); });
      return m;
    });
  }

  openPointMenu(i, marker) {
    if (this.menu) this.menu.remove();
    const legOut = this.legs[i];
    const body = h('div', { class: 'pt-menu' },
      h('div', { class: 'pt-title' }, i === 0 ? 'Start' : i === this.points.length - 1 ? 'Finish' : `Via point ${i}`),
      legOut ? h('div', { class: 'pt-label' }, 'Next leg') : null,
      legOut ? h('div', { class: 'seg small' }, ...['auto', 'line', 'water'].map((m) =>
        h('button', { type: 'button', 'aria-pressed': String(legOut.mode === m), onclick: () => { this.menu.remove(); this.setLegMode(i, m); }, html: `${icon(MODE_ICON[m], 16)}<span>${MODE_LABEL[m].split(' ')[0]}</span>` }))) : null,
      h('button', { type: 'button', class: 'btn danger-text', onclick: () => { this.menu.remove(); this.removePoint(i); }, html: `${icon('trash', 16)} Remove point` }),
    );
    this.menu = new maplibregl.Popup({ offset: 16, closeButton: false, className: 'polku-popup' })
      .setLngLat(marker.getLngLat()).setDOMContent(body).addTo(this.map);
  }

  // ---------------------------------------------------------------- persistence & sharing
  save() {
    store.set('route', {
      points: this.points,
      modes: this.legs.map((l) => l.mode),
      fixed: this.legs.map((l) => (l.mode === 'fixed' && l.result ? encodePolyline(l.result.coords) : null)),
    });
  }

  loadSaved() {
    const r = store.get('route', null);
    if (!r || !r.points || !r.points.length) return false;
    this.points = r.points;
    this.legs = r.points.slice(1).map((_, i) => {
      if (r.modes[i] === 'fixed' && r.fixed && r.fixed[i]) {
        const c = decodePolyline(r.fixed[i]);
        return { mode: 'fixed', status: 'ok', result: { coords: c, tags: c.slice(1).map(() => ({})), portage: [] } };
      }
      return { mode: r.modes[i] === 'fixed' ? 'auto' : r.modes[i] || 'auto' };
    });
    this.update();
    return true;
  }

  shareUrl() {
    const u = new URL(location.href);
    u.search = '';
    u.searchParams.set('r', encodePolyline(this.points));
    u.searchParams.set('m', this.legs.map((l) => MODE_CODE[l.mode]).join(''));
    u.searchParams.set('a', this.app.activity());
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
    download(`${name.replace(/[^\w\- ]+/g, '').trim() || 'route'}.gpx`, toGPX({ name, coords: line.coords, ele: sampleEle(a, line.coords), waypoints: this.points }));
  }

  // ---------------------------------------------------------------- panel
  buildPanel() {
    const p = this.panel;
    p.innerHTML = '';
    const tool = (name, label, fn, cls = '') => h('button', { type: 'button', class: `tool ${cls}`, title: label, 'aria-label': label, onclick: fn, html: icon(name, 19) });
    this.els = {};
    const modes = h('div', { class: 'seg', role: 'group', 'aria-label': 'Routing for new legs' },
      ...['auto', 'line', 'water'].map((m) => h('button', {
        type: 'button', 'data-mode': m, 'aria-pressed': String(this.mode === m), title: MODE_LABEL[m],
        onclick: () => this.setMode(m), html: `${icon(MODE_ICON[m], 17)}<span>${MODE_LABEL[m]}</span>`,
      })));
    this.els.undo = tool('undo', 'Undo (Ctrl+Z)', () => this.undo());
    this.els.redo = tool('redo', 'Redo', () => this.redo());
    const head = h('div', { class: 'sheet-head' },
      modes,
      h('div', { class: 'tools' },
        this.els.undo, this.els.redo,
        tool('reverse', 'Reverse direction', () => this.reverse()),
        tool('loop', 'Back to start', () => this.loop()),
        h('span', { class: 'tool-sep' }),
        tool('upload', 'Import GPX / KML', () => $('#file-input').click()),
        tool('download', 'Export GPX', () => this.exportGpx()),
        tool('share', 'Copy share link', () => this.share()),
        tool('trash', 'Clear route', () => this.clear(), 'danger'),
        h('span', { class: 'tool-sep' }),
        this.els.collapse = tool('chevronDown', 'Collapse', () => this.toggleCollapse()),
        tool('close', 'Close planner', () => this.setActive(false)),
      ));
    this.els.stats = h('div', { class: 'stats' });
    this.els.craft = h('div', { class: 'seg small craft', role: 'group', 'aria-label': 'Craft' },
      ...Object.entries(CRAFT).map(([k, v]) => h('button', { type: 'button', 'data-craft': k, 'aria-pressed': String(this.craft === k), onclick: () => this.setCraft(k) }, v.label)));
    this.els.modesBar = h('div', { class: 'chips', role: 'group', 'aria-label': 'Colour the profile by' });
    this.els.breakdown = h('div', { class: 'breakdown' });
    const profile = h('div', { class: 'profile' },
      h('div', { class: 'profile-top' }, this.els.modesBar, this.els.craft),
      h('div', { class: 'profile-box' }, h('canvas', { id: 'profile-canvas' }), h('div', { id: 'profile-tip', class: 'profile-tip', hidden: true })),
      this.els.breakdown);
    this.els.climbs = h('div', { class: 'list climbs' });
    this.els.warnings = h('div', { class: 'list warnings' });
    this.els.wind = h('div', { class: 'list wind' });
    this.els.hint = h('p', { class: 'hint' }, 'Click the map to add points · drag a point to move it · click the route line to add a via point');
    const body = h('div', { class: 'sheet-body' }, this.els.stats, profile, h('div', { class: 'lists' }, this.els.climbs, this.els.warnings, this.els.wind), this.els.hint);
    p.append(head, body);
    this.renderModeChips();
  }

  toggleCollapse() {
    this.collapsed = !this.collapsed;
    this.panel.classList.toggle('collapsed', this.collapsed);
    this.els.collapse.innerHTML = icon(this.collapsed ? 'chevronUp' : 'chevronDown', 19);
    if (!this.collapsed) requestAnimationFrame(() => this.chart.draw());
  }

  setCraft(k) {
    this.craft = k;
    store.set('craft', k);
    for (const b of this.els.craft.children) b.setAttribute('aria-pressed', String(b.dataset.craft === k));
    this.runAnalysis(this.gen);
  }

  renderModeChips() {
    const act = this.app.activity();
    const modes = Object.entries(COLOR_MODES).filter(([k]) => (k === 'down' || k === 'uphill' ? act === 'mtb' || act === 'gravel' : true));
    if (!modes.some(([k]) => k === this.colorMode)) this.colorMode = 'grade';
    this.els.modesBar.innerHTML = '';
    for (const [k, label] of modes) {
      this.els.modesBar.append(h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(this.colorMode === k),
        onclick: () => { this.colorMode = k; store.set('colorMode', k); this.renderModeChips(); this.chart.setMode(k); this.renderBreakdown(); },
      }, label));
    }
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
    st.innerHTML = '';
    const stat = (label, value, sub = '') => st.append(h('div', { class: 'stat' }, h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-value', html: value }), sub ? h('span', { class: 'stat-sub' }, sub) : null));
    if (!a) {
      stat('Distance', '0 km');
      stat('Ascent', '0 m');
      stat('Descent', '0 m');
      this.chart.setData(null);
      this.els.breakdown.innerHTML = '';
      this.els.climbs.innerHTML = '';
      this.els.warnings.innerHTML = '';
      this.els.wind.innerHTML = '';
      this.els.hint.hidden = false;
      return;
    }
    this.els.hint.hidden = this.points.length > 2;
    stat('Distance', fmtDist(a.total));
    stat('Ascent', `${Math.round(a.up)} m`);
    stat('Descent', `${Math.round(a.down)} m`);
    stat('Est. time', fmtDuration(a.time), act === 'paddle' ? CRAFT[this.craft].label : '');
    if (act === 'mtb' || act === 'gravel') {
      const hardest = a.climbs.reduce((m, c) => (c.cls > (m ? m.cls : -1) ? c : m), null);
      stat('Hardest climb', hardest ? `<i class="dot" style="background:${DIFF_COLORS[hardest.cls]}"></i>↑S${hardest.cls}` : '—', hardest ? `${Math.round(hardest.gain)} m at ${Math.round(hardest.avg)} %` : '');
    } else if (act === 'paddle') {
      const carry = a.ways.find(([k]) => k === 'portage');
      stat('Carry', carry ? fmtDist(carry[1]) : '0 m');
    } else {
      stat('High point', `${Math.round(a.maxE)} m`);
    }
    this.chart.setData(a, this.colorMode);
    this.renderBreakdown();
    this.renderClimbs();
    this.renderWarnings();
    if (act === 'paddle') this.renderWind(); else this.els.wind.innerHTML = '';
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
      legend.append(h('span', { class: 'bd-item' }, h('i', { style: `background:${color}` }), `${label} `, h('b', {}, fmtDist(d))));
    }
    box.append(bar, legend);
  }

  renderClimbs() {
    const a = this.analysis;
    const box = this.els.climbs;
    box.innerHTML = '';
    if (!a.climbs.length) return;
    box.append(h('h4', {}, `Climbs (${a.climbs.length})`));
    const bike = ['mtb', 'gravel'].includes(this.app.activity());
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
    if (!a.warnings.length) return;
    box.append(h('h4', {}, `Heads-up (${a.warnings.length})`));
    for (const w of a.warnings.slice(0, 30)) {
      const item = h('button', { type: 'button', class: 'li', html: `${icon('warn', 16)}<span class="li-main"><b>${escapeHtml(w.text)}</b><span>at km ${(w.at / 1000).toFixed(1)}${w.len > 5 ? ` · ${fmtDist(w.len)}` : ''}</span></span>` });
      item.addEventListener('click', () => {
        const i0 = a.along.findIndex((d) => d >= w.at);
        const i1 = a.along.findIndex((d) => d >= w.at + Math.max(w.len, 30));
        this.focusRange(i0, i1 < 0 ? a.along.length - 1 : i1, w);
      });
      box.append(item);
    }
  }

  focusRange(i0, i1, sel) {
    const a = this.analysis;
    this.selected = sel;
    this.chart.setHighlight([a.along[i0], a.along[i1]]);
    const b = bbox(a.pts.slice(i0, i1 + 1));
    this.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 80, bottom: this.panel.offsetHeight + 40, left: 60, right: 60 }, maxZoom: 16, duration: 700 });
  }

  async renderWind() {
    const a = this.analysis;
    const box = this.els.wind;
    const mid = a.pts[Math.floor(a.pts.length / 2)];
    box.innerHTML = '';
    box.append(h('h4', {}, 'Wind on the water'));
    const body = h('div', { class: 'wind-body' }, 'Loading forecast…');
    box.append(body);
    try {
      const w = await wind(mid[1], mid[0]);
      if (this.analysis !== a) return;
      const ex = windExposure(a.pts, a.along, w.dir);
      const r = windRating(w.speed, w.gust);
      body.innerHTML = '';
      body.append(
        h('div', { class: 'wind-now' },
          h('span', { class: 'wind-arrow', style: `transform:rotate(${w.dir + 180}deg)`, title: `from ${compass(w.dir)}`, html: '&#8593;' }),
          h('span', {}, h('b', {}, `${w.speed.toFixed(1)} m/s`), ` gusts ${w.gust.toFixed(1)} · from ${compass(w.dir)} · ${Math.round(w.temp)} °C`),
          h('span', { class: `pill ${r.tone}` }, r.label)),
        h('div', { class: 'exposure' },
          ...[['Headwind', ex.head, '#ef4444'], ['Crosswind', ex.cross, '#f59e0b'], ['Tailwind', ex.tail, '#22a447']].map(([l, v, c]) =>
            h('span', { class: 'ex-item' }, h('i', { style: `background:${c};width:${Math.max(4, v * 100)}%` }), `${l} ${Math.round(v * 100)} %`))),
        h('div', { class: 'hours' }, ...w.hourly.filter((_, i) => i % 2 === 0).map((x) =>
          h('span', { class: 'hour', title: `${x.speed.toFixed(1)} m/s, gusts ${x.gust.toFixed(1)}` },
            h('i', { style: `transform:rotate(${x.dir + 180}deg)`, html: '&#8593;' }), h('b', {}, x.speed.toFixed(0)), h('small', {}, x.time)))),
      );
    } catch {
      body.textContent = 'Wind forecast unavailable right now.';
    }
  }
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
    return { points, modes: (params.get('m') || '').split(''), activity: params.get('a') };
  } catch {
    return null;
  }
}
