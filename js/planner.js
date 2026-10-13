// Route planner: waypoints, per-leg routing modes, undo/redo, the bottom sheet
// with stats, elevation profile, climbs, warnings and (for paddling) wind.

import { ACTIVITIES, CRAFT, DIFF_COLORS, UPHILL_TEXT, SURFACE_COLORS, GRADE_BANDS, MTB_SCALE_TEXT, gradeColor } from './config.js';
import { routeLeg } from './router.js';
import { analyse, estimateTime } from './analysis.js';
import { ProfileChart, COLOR_MODES, COLOR_GROUPS, WAY_COLORS, colorAt, routeReadout } from './chart.js';
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
    this.panel = $('#planner');
    this.buildPanel();
    this.chart = new ProfileChart($('#profile-canvas'), $('#profile-tip'));
    this.chart.onHover = (i) => this.hoverAt(i);
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
    if (!on) { this.closeMore(); delete document.body.dataset.sheet; delete document.body.dataset.pl; }
    // an empty route opens small, so the map is there to tap; otherwise as you left it
    if (on) this.setSheetState(!this.points.length && this.layout() === 'sheet' ? 'peek' : store.get('sheetState', {})[this.layout()], { remember: false });
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
    if (!this.active) return;
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
    if (!a || this.panel.hidden) return;
    const hit = this.map.queryRenderedFeatures([[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]], { layers: ['route-casing'] }).length;
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
    const onMap = this.app.routeTip(e.originalEvent, routeReadout(a, best));
    this.chart.setHover(best, !onMap);
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
      m.on('dragstart', () => this.autoPeek());
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

  // The whole route including routed geometry, so it can be reopened offline
  // (no BRouter call: routeAll() keeps legs whose key and result match).
  // Not snapshot(): that one is the undo history's, and a second method of the
  // same name silently replaced it (undo after adding a point did nothing).
  routeSnapshot() {
    return {
      activity: this.app.activity(),
      routeName: this.routeName || '',
      points: this.points,
      nogos: this.nogos,
      legs: this.legs.map((l) => ({ mode: l.mode, key: l.key, result: l.status === 'ok' || l.mode === 'fixed' ? l.result : null })),
    };
  }

  restoreSnapshot(s) {
    this.points = s.points;
    this.nogos = s.nogos || [];
    this.routeName = s.routeName || '';
    this.legs = s.legs.map((l) => (l.result ? { mode: l.mode, key: l.key, status: 'ok', result: l.result } : { mode: l.mode }));
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
      h('div', { class: 'sheet-row tools-row' }, modes, h('div', { class: 'tools' }, this.els.undo, this.els.redo,
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
    this.els.craft = h('div', { class: 'seg small craft', role: 'group', 'aria-label': 'Craft' },
      ...Object.entries(CRAFT).map(([k, v]) => h('button', { type: 'button', 'data-craft': k, 'aria-pressed': String(this.craft === k), onclick: () => this.setCraft(k) }, v.label)));
    this.els.modesBar = h('div', { class: 'chip-groups' });
    this.els.mapToggle = h('input', { type: 'checkbox', role: 'switch', checked: this.colorOnMap, onchange: (e) => {
      this.colorOnMap = e.target.checked;
      store.set('colorOnMap', this.colorOnMap);
      this.drawColored();
    } });
    this.els.mapToggleRow = h('label', { class: 'tg tg-inline', title: 'Colour the route line on the map the same way as the profile' },
      h('span', { class: 'tg-text' }, 'Colour on map'), this.els.mapToggle, h('span', { class: 'tg-ui', 'aria-hidden': 'true' }));
    this.els.breakdown = h('div', { class: 'breakdown' });
    this.els.climbs = h('div', { class: 'list climbs' });
    this.els.warnings = h('div', { class: 'list warnings' });
    this.els.wind = h('div', { class: 'list wind' });
    this.els.hint = h('p', { class: 'hint' }, matchMedia('(pointer: coarse)').matches
      ? 'Tap the map to add points · drag a point to move it · tap the route line to add a via point'
      : 'Click the map to add points · drag a point to move it · click the route line to add a via point');
    this.els.dock = h('div', { class: 'dock' }); // the timeline docks here while planning (main.js)
    this.els.body = h('div', { class: 'sheet-body' }, this.els.stats, h('div', { class: 'sheet-cols' },
      this.section('profile', 'Profile',
        h('div', { class: 'profile-top' }, this.els.modesBar, this.els.craft),
        h('div', { class: 'profile-box' }, h('canvas', { id: 'profile-canvas' }), h('div', { id: 'profile-tip', class: 'profile-tip', hidden: true })),
        this.els.breakdown),
      this.section('depart', 'Departure & weather', this.els.dock, this.els.wind),
      this.section('climbs', 'Climbs', this.els.climbs),
      this.section('warnings', 'Heads-up', this.els.warnings)),
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
    const ok = lay === 'side' ? ['open', 'min'] : ['peek', 'half', 'full'];
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
    this.els.handle.title = { peek: 'Show more', half: 'Drag up for everything, down for the map', full: 'Drag down for the map' }[st] || '';
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
    // the summary rows are always visible: the peek height is theirs
    new ResizeObserver(() => {
      const hd = this.els.head;
      this.panel.style.setProperty('--peek-h', `${Math.ceil(hd.offsetTop + hd.offsetHeight + 6)}px`);
    }).observe(this.els.head);
    const heights = () => {
      const r = this.panel.getBoundingClientRect();
      const peek = this.els.head.offsetTop + this.els.head.offsetHeight + 6;
      return { peek, half: innerHeight * 0.5, full: r.bottom - 72, now: r.height };
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
      if (!moved) next = st === 'peek' ? 'half' : 'peek'; // a tap toggles
      else {
        const now = this.panel.getBoundingClientRect().height;
        next = Object.entries({ peek: H.peek, half: H.half, full: H.full }).sort((a, b) => Math.abs(a[1] - now) - Math.abs(b[1] - now))[0][0];
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
      const order = ['peek', 'half', 'full'];
      const i = order.indexOf(this.panel.dataset.state);
      if (e.key === 'ArrowUp') { e.preventDefault(); this.setSheetState(order[Math.min(2, i + 1)]); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); this.setSheetState(order[Math.max(0, i - 1)]); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.setSheetState(order[(i + 1) % 3]); }
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
    if (!this.active || this.panel.hidden) return { top: 120, bottom: m + 20, left: m, right: m + 50 };
    const r = this.panel.getBoundingClientRect();
    if (this.layout() === 'side') return { top: 90, bottom: m, left: r.right + m, right: m + 70 };
    return { top: 130, bottom: innerHeight - r.top + m / 2, left: m / 2, right: m + 30 };
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
    for (const b of this.els.craft.children) b.setAttribute('aria-pressed', String(b.dataset.craft === k));
    this.runAnalysis(this.gen);
  }

  renderModeChips() {
    const act = this.app.activity();
    const applies = act === 'paddle'
      ? (k) => ['way', 'wind', 'temp', 'rain'].includes(k)
      : (k) => (k === 'down' || k === 'uphill' ? act === 'mtb' || act === 'gravel' : true);
    if (!applies(this.colorMode)) this.colorMode = act === 'paddle' ? 'wind' : 'grade';
    this.els.modesBar.innerHTML = '';
    for (const [title, keys] of COLOR_GROUPS) {
      const shown = keys.filter(applies);
      if (!shown.length) continue;
      this.els.modesBar.append(h('div', { class: 'chip-group', role: 'group', 'aria-label': `Colour the profile by ${title.toLowerCase()}` },
        h('span', { class: 'chip-group-label', 'aria-hidden': 'true' }, title),
        ...shown.map((k) => h('button', {
          type: 'button', class: 'chip', 'aria-pressed': String(this.colorMode === k),
          onclick: () => this.showMode(k),
        }, COLOR_MODES[k]))));
    }
    // a separate switch, in the same row so it wraps with the chips: the line on the map takes the same colours
    this.els.mapToggle.checked = this.colorOnMap;
    this.els.modesBar.append(this.els.mapToggleRow);
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
    if (this.layout() === 'sheet' && this.panel.dataset.state === 'peek') this.setSheetState('half');
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
    const stat = (label, value, sub = '') => st.append(h('div', { class: 'stat' }, h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-value', html: value }), sub ? h('span', { class: 'stat-sub' }, sub) : null));
    const key = (label, value, title = '') => sum.append(h('div', { class: 'sum-item', title }, h('b', {}, value), h('small', {}, label)));
    for (const id of ['profile', 'climbs', 'warnings']) this.setSection(id, { empty: !a });
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
      key('ascent', `${Math.round(a.up)} m`);
      stat('Descent', `${Math.round(a.down)} m`);
    }
    if (act === 'mtb' || act === 'gravel') {
      const hardest = a.climbs.reduce((m, c) => (c.cls > (m ? m.cls : -1) ? c : m), null);
      stat('Hardest climb', hardest ? `<i class="dot" style="background:${DIFF_COLORS[hardest.cls]}"></i>↑S${hardest.cls}` : '—', hardest ? `${Math.round(hardest.gain)} m at ${Math.round(hardest.avg)} %` : '');
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
    this.chart.placeholder = a.windError ? (typeof a.windError === 'string' ? a.windError : 'Wind forecast unavailable right now.') : '';
    this.chart.setData(a, this.colorMode, paddle ? 'conditions' : 'elevation');
    this.setSection('profile', { title: paddle ? 'Conditions' : 'Profile', summary: this.profileSummary() });
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
    const bike = ['mtb', 'gravel'].includes(this.app.activity());
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
    const all = [...a.warnings, ...(a.hazards || [])].sort((x, y) => x.at - y.at);
    this.setSection('warnings', { count: all.length || '', empty: !all.length, summary: all.length ? all[0].text + (all.length > 1 ? ` · +${all.length - 1} more` : '') : '' });
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
    return { points, modes: (params.get('m') || '').split(''), activity: params.get('a') };
  } catch {
    return null;
  }
}
