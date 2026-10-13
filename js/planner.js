// Route planner: waypoints, per-leg routing modes, undo/redo, the bottom sheet
// with stats, elevation profile, climbs, warnings and (for paddling) wind.

import { ACTIVITIES, CRAFT, DIFF_COLORS, UPHILL_TEXT, SURFACE_COLORS, GRADE_BANDS, MTB_SCALE_TEXT, gradeColor } from './config.js';
import { routeLeg } from './router.js';
import { analyse, estimateTime } from './analysis.js';
import { ProfileChart, COLOR_MODES, WAY_COLORS, colorAt } from './chart.js';
import { dist, encodePolyline, decodePolyline, fmtDist, fmtDuration, compass, bbox, nearestOnLine, simplify } from './geo.js';
import { toGPX, download } from './gpx.js';
import { windAlong, windClass, windRating, WIND_CLASSES, TEMP_BANDS, tempBand, RAIN_BANDS, rainBand } from './weather.js';
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
    this.colorOnMap = store.get('colorOnMap', false);
    this.startOffsetH = 0; // departure: hours from now
    this.nogos = []; // places to avoid: [{ll, r, label}]
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
      nogos: this.nogos.map((n) => ({ ...n })),
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
    this.nogos = s.nogos || [];
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
    this.drawColored();
    if (on) requestAnimationFrame(() => this.chart.draw());
  }

  // ---------------------------------------------------------------- routing
  update() {
    this.drawNogos();
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
      const nogos = leg.mode === 'auto' ? this.nogosNear(from, to) : [];
      const key = `${leg.mode}|${profile}|${from.join(',')}|${to.join(',')}|${nogos.map((n) => n.ll.join(',') + n.r).join(';')}`;
      if (leg.key === key && leg.result) return;
      leg.key = key;
      leg.result = null;
      leg.status = 'loading';
      jobs.push(async () => {
        try {
          const r = await routeLeg({ from, to, mode: leg.mode, profile, opts: { portage: true, nogos } });
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
    this.loadWind(a);
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
    const opt = { activity: this.app.activity(), craft: this.craft };
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
    } catch {
      if (this.analysis !== a) return;
      a.windError = true;
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
    if (!this.active) return;
    const ng = this.map.getLayer('nogo-fill') && this.map.queryRenderedFeatures(e.point, { layers: ['nogo-fill'] })[0];
    if (ng) { this.openNogoMenu(ng.properties.i, e.lngLat); return; }
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
      nogos: this.nogos,
      points: this.points,
      modes: this.legs.map((l) => l.mode),
      fixed: this.legs.map((l) => (l.mode === 'fixed' && l.result ? encodePolyline(l.result.coords) : null)),
    });
  }

  loadSaved() {
    const r = store.get('route', null);
    if (r && r.nogos) { this.nogos = r.nogos; this.drawNogos(); }
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
        onclick: () => { this.colorMode = k; store.set('colorMode', k); this.renderModeChips(); this.chart.setMode(k); this.renderBreakdown(); this.drawColored(); },
      }, label));
    }
    this.els.modesBar.append(h('button', {
      type: 'button', class: 'chip chip-map', 'aria-pressed': String(this.colorOnMap), title: 'Colour the route line on the map the same way',
      onclick: () => { this.colorOnMap = !this.colorOnMap; store.set('colorOnMap', this.colorOnMap); this.renderModeChips(); this.drawColored(); },
      html: `${icon('route', 14)} On map`,
    }));
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

  showMode(k) {
    this.colorMode = k;
    store.set('colorMode', k);
    this.renderModeChips();
    this.chart.setMode(k);
    this.renderBreakdown();
    this.drawColored();
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
      if (this.app.onAnalysis) this.app.onAnalysis(null);
      return;
    }
    this.els.hint.hidden = this.points.length > 2;
    stat('Distance', fmtDist(a.total));
    stat('Ascent', `${Math.round(a.up)} m`);
    stat('Descent', `${Math.round(a.down)} m`);
    const timeSub = [act === 'paddle' ? CRAFT[this.craft].label : '', a.timeWind ? 'with wind' : ''].filter(Boolean).join(' · ');
    stat('Est. time', fmtDuration(a.timeWind || a.time), timeSub);
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
    this.renderWind();
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
      if (!a.wind) { box.append(h('p', { class: 'note' }, a.windError ? 'Weather forecast unavailable right now.' : 'Loading the forecast…')); return; }
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
    if (!a) return;
    const all = [...a.warnings, ...(a.hazards || [])].sort((x, y) => x.at - y.at);
    if (!all.length) return;
    box.append(h('h4', {}, `Heads-up (${all.length})`));
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

  focusRange(i0, i1, sel) {
    const a = this.analysis;
    this.selected = sel;
    this.chart.setHighlight([a.along[i0], a.along[i1]]);
    const b = bbox(a.pts.slice(i0, i1 + 1));
    this.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 80, bottom: this.panel.offsetHeight + 40, left: 60, right: 60 }, maxZoom: 16, duration: 700 });
  }

  renderWind() {
    const a = this.analysis;
    const box = this.els.wind;
    const act = this.app.activity();
    box.innerHTML = '';
    if (!a) return;
    const select = h('select', { class: 'start-select', 'aria-label': 'Departure time (linked with the weather time bar)', title: 'Linked with the weather time bar on the map', onchange: (e) => this.setStartOffset(+e.target.value) });
    const now = new Date();
    for (let k = 0; k <= 48; k++) {
      const d = new Date((Math.floor(now.getTime() / 3600000) + k) * 3600000);
      const day = d.getDate() === now.getDate() ? '' : d.getDate() === new Date(now.getTime() + 86400000).getDate() ? 'Tomorrow ' : `${d.toLocaleDateString([], { weekday: 'short' })} `;
      select.append(h('option', { value: String(k), selected: k === this.startOffsetH }, k === 0 ? 'Now' : `${day}${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`));
    }
    box.append(h('h4', {}, act === 'paddle' ? 'Weather on the water' : 'Weather on the route', h('label', { class: 'start' }, 'Start ', select)));
    if (!a.wind) {
      box.append(h('div', { class: 'wind-body note' }, a.windError ? 'Wind forecast unavailable right now.' : 'Loading forecast…'));
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
    const body = h('div', { class: 'wind-body' },
      h('div', { class: 'wind-now' },
        h('span', { class: 'wind-arrow', style: `transform:rotate(${s0.dir + 180}deg)`, title: `from ${compass(s0.dir)}`, html: '&#8593;' }),
        h('span', {}, h('b', {}, `${s0.speed.toFixed(1)} m/s`), ` gusts ${s0.gust.toFixed(1)} · from ${compass(s0.dir)} · ${Math.round(s0.temp)} °C${s0.precip > 0.1 ? ` · rain ${s0.precip.toFixed(1)} mm/h` : ''}`),
        h('span', { class: `pill ${r.tone}` }, r.label)),
      h('div', { class: 'wx-sum' },
        h('span', {}, h('b', {}, 'Temperature '), tMin === tMax || Math.round(tMin) === Math.round(tMax) ? `${Math.round(tMin)} °C` : `${Math.round(tMin)}…${Math.round(tMax)} °C`),
        h('button', { type: 'button', class: 'link', onclick: () => this.showMode(wetM > 0 ? 'rain' : 'temp') }, rainLine),
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
        ...[['wind', 'Wind'], ['temp', 'Temperature'], ['rain', 'Rain']].map(([k, l]) => h('button', { type: 'button', class: 'link', onclick: () => this.showMode(k) }, `${l} along the route ↑`))),
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
    return { points, modes: (params.get('m') || '').split(''), activity: params.get('a') };
  } catch {
    return null;
  }
}
