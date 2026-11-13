// Timeline + weather overlay. The timeline (48 h, opened with the Weather button)
// is the app's clock: it moves the weather layers, the planned route's
// departure, road works and road conditions. The weather layers — in the
// spirit of windy.app — are animated wind particles, falling rain / snow, a
// wind-speed or temperature field and rain radar. Data: Open-Meteo on a grid
// over the view; FMI radar in Finland, RainViewer elsewhere.
//
// Performance: the expensive part is mapping screen pixels to geography. That
// happens once per camera stop (moveend) into a coarse cell cache; while the map
// moves the particles simply pause and fade out, and forecast playback only
// re-samples the grid. Particle canvases render at 1× pixel density.

import { measuredSnow } from './winter.js';
import { forecastCells, cellSize, latticePoint, alignSeries, uncached, skyKind, sampleAt, windClass, forecastKnown } from './weather.js';
import { compass, dist } from './geo.js';
import { strikesIn } from './lightning.js';
import { STRIKE_COLOURS } from './icons.js';
import { h, icon, store, popMenu, tooltip, mouseDrag } from './ui.js';
import { request, onStatus, sourceStatus, clock as hhmm, usage } from './net.js';
import { fmiRadar, FI_BOUNDS, rainviewerCoverage } from './radar.js';
import { sunPosition } from './sun.js';

const MAX_CELLS = 60; // forecast points per grid (the view plus a margin); the field is smooth
const IMG = 72; // field image resolution
const STEP_IMG = 360; // the steps' image resolution: their edges stay edges
const HOURS = 48;
const PAST = 1.5; // the radar's last 90 minutes, before Now (#182): its scans every 5 minutes
// The slider's and the strip's units: an hour ahead, and 10 minutes in the radar's past, so its 90 minutes take a slice
// of the strip a thumb can hit (a sixth of it); in the past the strip goes by the radar's 5 minutes
const unitOf = (hr) => (hr < 0 ? hr * 6 : hr);
const hourOf = (u) => (u < 0 ? Math.round(u * 2) / 12 : Math.round(u));
// FMI's scan at a past hour (unix s): a scan is there some minutes after its time, so the newest asked for is 10 minutes old
export const scanAt = (hr) => Math.floor((Date.now() / 1000 - 600) / 300) * 300 + (Math.round(hr * 12) + 1) * 300;
const CELL = 24; // px, screen cache resolution

const WIND_RAMP = [[0, '#3b82f6'], [3, '#22d3ee'], [6, '#4ade80'], [9, '#facc15'], [12, '#fb923c'], [16, '#ef4444'], [22, '#a855f7']];
// snow on the ground, cm (the model): a cool wash that leaves bare ground clear
const TEMP_RAMP = [[-25, '#7c3aed'], [-15, '#2563eb'], [-5, '#38bdf8'], [0, '#e0f2fe'], [5, '#a7f3d0'], [10, '#fde047'], [18, '#fb923c'], [25, '#ef4444'], [32, '#9f1239']];
export { TEMP_RAMP };
// Rain, snowfall and snow on the ground in steps, as the weather services draw them (#182's Weather service look):
// each step one colour, light to dark, and the top step violet (never the route's magenta). [from, colour]
const RAIN_STEPS = [[0.1, '#a5e4fb'], [0.5, '#38bdf8'], [2, '#1d6fe0'], [5, '#1e3a8a'], [15, '#a855f7']]; // mm/h
const SNOWFALL_STEPS = [[0.1, '#ddd6fe'], [0.5, '#a78bfa'], [2, '#7c3aed']]; // mm/h, as water
const SNOW_STEPS = [[1, '#e0f2fe'], [10, '#a5d8fb'], [25, '#5cb8f2'], [50, '#2f7fd6']]; // cm on the ground
const stepRgba = (steps, v) => { let c = null; for (const [from, col] of steps) if (v >= from) c = col; return c && [...hex(c), 255]; };
// what falls: as snow below +0.5 °C (the timeline's and the labels' line too)
const fallRgba = (mmh, snow) => stepRgba(snow ? SNOWFALL_STEPS : RAIN_STEPS, mmh);
const stepsCss = (steps) => `linear-gradient(90deg, ${steps.map(([, c], i) => `${c} ${(i * 100) / steps.length}% ${((i + 1) * 100) / steps.length}%`).join(', ')})`;
const SKY = { snow: 'Snow', rain: 'Rain', cloud: 'Cloudy', cloudSun: 'Partly cloudy', moon: 'Clear', sun: 'Sunny' };
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
// the weather layers, in their buttons' order: [key, its name and its line (a desktop's tooltip), the button's word, icon]
const LAYERS = [
  ['rain', 'Rain and snowfall', 'The radar now, then the forecast', 'Rain', 'rain'],
  ['cloud', 'Clouds', 'A grey veil, thicker where it’s cloudier', 'Clouds', 'cloud'],
  ['thunder', 'Thunder', 'Lightning in the last hour, and the forecast’s thunder', 'Thunder', 'thunder'],
  ['wind', 'Wind', 'Moving lines, coloured by its speed', 'Wind', 'wind'],
  ['temp', 'Temperature', 'A colour field, with °C', 'Temperature', 'temp'],
  ['snow', 'Snow on the ground', 'The forecast’s depth, and FMI’s measured depths', 'Snow depth', 'snow'],
];
// the places Weather at places marks, the larger first: zoomed in, the map names villages and suburbs too
const PLACE_LAYERS = ['label-city', 'label-town', 'label-village', 'label-suburb'];

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
export function ramp(stops, v) {
  if (v <= stops[0][0]) return hex(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i];
      const t = (v - a) / (b - a);
      const x = hex(ca), y = hex(cb);
      return [0, 1, 2].map((k) => Math.round(x[k] + (y[k] - x[k]) * t));
    }
  }
  return hex(stops[stops.length - 1][1]);
}
export const rampHex = (stops, v) => `#${ramp(stops, v).map((x) => x.toString(16).padStart(2, '0')).join('')}`;
const rampCss = (stops) => `linear-gradient(90deg, ${stops.map(([, c], i) => `${c} ${(i / (stops.length - 1)) * 100}%`).join(', ')})`;

// One clock for the whole app: hour 0 is "now", hour k is k full hours ahead
// (on the hour), the same steps as the planner's departure picker.
export function timeAtHour(hr) {
  const now = Date.now() / 1000;
  if (hr < 0.01) return now;
  return Math.max(now, Math.floor(now / 3600) * 3600 + hr * 3600);
}
// and back: a time from now on (unix s) as the timeline's hour
const hourAt = (t) => (t - Math.floor(Date.now() / 3600e3) * 3600) / 3600;
const weekday = (t, long = false) => new Date(t * 1000).toLocaleDateString([], { weekday: long ? 'long' : 'short' });
// the wind where you are in words (windClass()'s keys), and the wind on your way's key: the band under Your trip's hours,
// in the route's wind colours (the darker, the stronger), in the note under the timeline and in the legend
const WIND_WAY = { strongHead: 'against you', head: 'against you', cross: 'from the side', tail: 'behind you', strongTail: 'behind you', calm: 'calm' };
const BAND_KEY = `<span class="wx-key">${[['strong-head', 'head', 'against you'], ['cross', 'cross', 'from the side'], ['strong-tail', 'tail', 'behind you'], ['calm', 'calm', 'calm']]
  .map(([a, b, t]) => `<span style="--k: linear-gradient(90deg, var(--wind-${a}) 50%, var(--wind-${b}) 50%)">${t}</span>`).join('')}</span>`;

// Web Mercator helpers (0..1 world units)
const mx = (lon) => (lon + 180) / 360;
const my = (lat) => { const s = Math.sin((lat * Math.PI) / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
const lonOf = (x) => x * 360 - 180;
const latOf = (y) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

export class WeatherOverlay {
  constructor(map, app) {
    this.map = map;
    this.app = app; // { setImage(id, img|null), setRadar(r|null), setData(id, fc), dark() }
    this.on = { wind: false, temp: false, rain: false, snow: false, cloud: false, thunder: false, towns: false };
    this.townMarks = new Map();
    this.effects = store.get('wxEffects', true); // softer edges and falling rain, over the steps (#182)
    this.open = false; // timeline bar visible
    this.hour = 0;
    this.grid = null;
    this.viewZoom = map.getZoom();
    this.cur = null;
    this.cam = null;
    this.field = null;
    this.loading = false;
    this.playing = false;
    this.moving = false;
    this.particles = [];
    this.drops = [];
    this.span = '48'; // what the timeline shows: '48' hours, or 'trip', zoomed to your trip (#869)
    this.day = 0; // Your trip's day, on a trip of days
    this.stepAt = null; // the stretch against you ‹ › stepped to, while the hour stays at its start
    this.trip = null; // the route's times, from app.trip(): renderTrip()
    this.buildCanvases();
    this.buildBar();
    map.on('movestart', () => this.onMoveStart());
    map.on('moveend', () => this.onMoveEnd());
    map.on('idle', () => this.renderTowns(true)); // (the map's own place labels are placed by then)
    map.on('resize', () => { this.resizeCanvases(); this.onMoveEnd(); });
    // the card shows the spot under the mouse, else the map centre
    map.on('mousemove', (e) => { this.pointerLL = [e.lngLat.lng, e.lngLat.lat]; this.readout(); });
    map.on('mouseout', () => { this.pointerLL = null; this.readout(); });
    map.on('touchend', () => { this.pointerLL = null; this.readout(); });
    // Open-Meteo may be used again (or works again): refresh an old or missing forecast
    onStatus((src, s) => { if (src === 'openmeteo' && (!s || s.retry) && this.active) this.maybeFetch(); });
  }

  get layersOn() { return Object.values(this.on).some(Boolean); }
  // forecast data is needed for the weather layers and for the timeline strip
  get active() { return this.open || !!this.docked || this.layersOn; }
  get animated() { return this.on.wind || this.falling; }
  get fi() { return this.hour < 0 ? this.fiPast : this.fiNow; } // the radar image the map shows: Now's, or a past scan

  get falling() { return this.on.rain && this.effects; } // Effects' thin rain and snow

  // Effects on or off: the steps' edges soft or crisp, rain falling or not; remembered
  setEffects(on) {
    this.effects = on;
    store.set('wxEffects', on);
    this.app.onToggle({}); // (its switches in Layers and Settings drawn again)
  }

  set(layers) {
    Object.assign(this.on, layers);
    this.windCv.hidden = !this.on.wind;
    this.rainCv.hidden = !this.falling;
    this.renderLayers();
    this.clearLayers();
    this.renderLegend();
    if (!this.active) { this.stopClock(); return; }
    if (this.grid) { this.buildCam(); this.applyHour(true); }
    this.maybeFetch();
    if (this.animated) this.startAnim();
    if (this.on.rain) this.loadRadarMeta();
    if (this.on.snow) this.loadSnowObs();
    this.renderTowns(true);
    this.readout();
  }

  // Show / hide the floating timeline. Layers keep their selected time either way.
  // While docked in the planner it stays there; this only sets what comes back.
  // Weather here (25d part 6b): the readout is for a spot of the map you chose, with a pin on it, until the timeline
  // closes or you pick another; the forecast it reads is the grid's, so no request carries the spot
  holdAt(ll) {
    if (this.span === 'trip') { this.span = '48'; this.renderTrip(); } // (the reading goes to the spot, not where you'll be)
    this.heldLL = ll;
    if (this.heldPin) this.heldPin.remove();
    this.heldPin = new maplibregl.Marker({ element: h('div', { class: 'card-pin', 'aria-hidden': 'true' }) }).setLngLat(ll).addTo(this.map);
    this.readout();
  }
  release() {
    if (!this.heldLL) return;
    this.heldLL = null;
    if (this.heldPin) { this.heldPin.remove(); this.heldPin = null; }
    this.readout();
  }

  setOpen(on) {
    if (!on) { this.release(); this.span = '48'; } // (closed, it opens again at 48 hours, at Now)
    this.open = on;
    this.renderTrip();
    if (!this.docked) this.bar.hidden = !on;
    this.wake();
    // a phone's row of layers opens with the first that's on in sight, clear of the fade at its edge (32 px), at once (a
    // desktop's wraps: nothing to scroll)
    if (!on) return;
    this.placeFloat(); // (a place kept while it was hidden, measured now it's shown: on screen)
    const row = this.layerRow, b = row.querySelector('[aria-pressed="true"]');
    row.scrollLeft = b ? Math.max(0, b.getBoundingClientRect().right - row.getBoundingClientRect().left + row.scrollLeft - row.clientWidth + 32) : 0;
  }

  // While planning, the timeline lives in the planner: one departure control,
  // and no second panel over the map. `el` null puts it back on the map.
  dock(el) {
    if (el === (this.docked || null)) return;
    if (!this.home) this.home = { parent: this.bar.parentElement, next: this.bar.nextSibling };
    this.docked = el;
    if (el) el.append(this.bar); else this.home.parent.insertBefore(this.bar, this.home.next);
    this.bar.classList.toggle('docked', !!el);
    this.bar.hidden = !el && !this.open;
    this.placeFloat();
    this.wake();
  }

  wake() {
    if (this.active) {
      this.maybeFetch();
      this.renderLayers();
      this.renderTime();
      requestAnimationFrame(() => this.renderStrip());
      if (!this.anim) this.startAnim();
    } else this.stopClock();
  }

  // Floating on a wide screen: drag the title bar to put the timeline anywhere,
  // the grip on its right edge to make it wider. Both are remembered; a
  // double-click on the title bar puts it back at the bottom centre.
  bindFloat() {
    const bar = this.bar;
    const head = bar.querySelector('.tl-head');
    const grip = h('div', { class: 'tl-grip', title: 'Drag to resize the timeline', 'aria-hidden': 'true' });
    bar.append(grip);
    this.floatMQ = matchMedia('(min-width: 721px)');
    this.floatMQ.addEventListener('change', () => this.placeFloat());
    const can = () => !this.docked && this.floatMQ.matches;
    let drag = null;
    const start = (kind) => (e) => {
      if (!can() || e.button > 0 || (kind === 'move' && e.target.closest('button, input, select, a'))) return;
      const r = bar.getBoundingClientRect();
      drag = { kind, x: e.clientX, y: e.clientY, r };
      bar.classList.add('dragging');
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
      e.preventDefault();
    };
    const move = (e) => {
      if (!drag) return;
      const { r } = drag, dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      const f = drag.kind === 'move' ? { left: r.left + dx, top: r.top + dy, width: r.width } : { left: r.left, top: r.top, width: r.width + dx };
      this.placeFloat(f);
    };
    const end = () => {
      if (!drag) return;
      drag = null;
      bar.classList.remove('dragging');
      if (this.float) store.set('timelineFloat', this.float);
    };
    for (const [el, kind] of [[head, 'move'], [grip, 'size']]) {
      el.addEventListener('pointerdown', start(kind));
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    }
    head.addEventListener('dblclick', (e) => {
      if (!can() || e.target.closest('button, input, select, a')) return;
      store.set('timelineFloat', null);
      this.placeFloat(null);
    });
    addEventListener('resize', () => this.placeFloat());
    this.placeFloat(store.get('timelineFloat', null) || undefined);
  }

  // f: {left, top, width} in px, null: back to the default place, undefined: re-apply (and keep on screen)
  placeFloat(f) {
    if (f !== undefined) this.float = f;
    const bar = this.bar, st = bar.style;
    const on = this.float && !this.docked && this.floatMQ && this.floatMQ.matches;
    bar.classList.toggle('placed', !!on);
    if (!on) { st.left = st.top = st.width = st.bottom = st.transform = ''; return; }
    // anywhere on the map, but never over the button column on the right
    const right = innerWidth - 84;
    const w = Math.round(Math.max(420, Math.min(right - 16, this.float.width)));
    const hgt = bar.offsetHeight || 190;
    const left = Math.round(Math.max(8, Math.min(right - w - 8, this.float.left)));
    const top = Math.round(Math.max(8, Math.min(innerHeight - hgt - 8, this.float.top)));
    this.float = { left, top, width: w };
    Object.assign(st, { left: `${left}px`, top: `${top}px`, width: `${w}px`, bottom: 'auto', transform: 'none' });
  }

  onMoveStart() {
    clearTimeout(this.fetchTimer);
    if (!this.animated) return;
    this.moving = true;
    this.windCv.classList.add('wx-hide');
    this.rainCv.classList.add('wx-hide');
  }

  onMoveEnd() {
    this.moving = false;
    const zoom = this.map.getZoom(), previousZoom = this.viewZoom;
    this.viewZoom = zoom;
    if (!this.active) return;
    // ask once the map has settled, not on every stop of a pan; zooming out
    // usually comes in several steps, so wait a little longer for the last one
    clearTimeout(this.fetchTimer);
    // A slow first forecast has no grid yet: still recognise zooming out.
    const out = zoom < Math.max(previousZoom, this.grid?.zoom ?? zoom) - 0.3;
    this.fetchTimer = setTimeout(() => { this.maybeFetch(); if (this.on.rain) this.syncRadar(); if (this.on.thunder) this.loadStrikes(); }, out ? 1200 : 600);
    this.renderStrip();
    this.readout();
    if (!this.animated) return;
    this.buildCam();
    this.buildField();
    this.clearCanvas(this.windCtx, this.windCv);
    for (const p of this.particles) p.age = p.max + 1; // respawn in the new view
    for (const d of this.drops) d.age = d.max + 1;
    this.windCv.classList.remove('wx-hide');
    this.rainCv.classList.remove('wx-hide');
  }

  // ------------------------------------------------------------------ data
  viewBox() {
    const b = this.map.getBounds();
    let s = Math.max(-80, b.getSouth()), n = Math.min(80, b.getNorth());
    const w = b.getWest(), e = b.getEast();
    // pitched views reach the horizon; keep the grid around the near half
    if (this.map.getPitch() > 45) {
      const c = this.map.getCenter();
      const dLat = Math.min(n - s, (e - w) * 0.6);
      s = Math.max(s, c.lat - dLat); n = Math.min(n, c.lat + dLat);
    }
    return [w, s, e, n];
  }

  covers(box, L) {
    const g = this.grid;
    if (!g || g.L !== L || g.stale) return false;
    const b = g.box;
    return box[0] >= b[0] && box[2] <= b[2] && box[1] >= b[1] && box[3] <= b[3] && Date.now() - g.t < 30 * 60 * 1000;
  }

  async maybeFetch() {
    if (!this.active || this.map.getZoom() < 3) return;
    const box = this.viewBox();
    // The grid is made of points of the shared forecast lattice (see weather.js):
    // the finest level that covers the view plus a margin in ≤ MAX_CELLS points.
    const padX = (box[2] - box[0]) * 0.12, padY = (box[3] - box[1]) * 0.12;
    let L = 0;
    while (L < 11) {
      const [dx, dy] = cellSize(L);
      if (((box[2] - box[0] + 2 * padX) / dx + 2) * ((box[3] - box[1] + 2 * padY) / dy + 2) <= MAX_CELLS) break;
      L++;
    }
    const layout = (lv) => {
      const [dLon, dLat] = cellSize(lv);
      let i0 = Math.floor((box[0] - padX) / dLon), i1 = Math.ceil((box[2] + padX) / dLon);
      let j0 = Math.floor(Math.max(-80, box[1] - padY) / dLat), j1 = Math.ceil(Math.min(80, box[3] + padY) / dLat);
      if (i1 - i0 < 2) { i0 -= 1; i1 = i0 + 2; }
      if (j1 - j0 < 2) { j0 -= 1; j1 = j0 + 2; }
      const cols = i1 - i0 + 1, rows = j1 - j0 + 1;
      const list = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) list.push({ L: lv, i: i0 + c, j: j1 - r }); // north row first
      return { L: lv, dLon, dLat, cols, rows, list };
    };
    // Budget: stay under ~2/3 of Open-Meteo's per-minute limit and 80 % of the
    // hourly and daily ones (counted on this device). Too tight → a coarser grid
    // (a quarter of the points, mostly cached already), else pause briefly.
    const om = usage().find((u) => u.id === 'openmeteo');
    const room = Math.min(...om.windows.map((w) => w.max * (w.name === 'minute' ? 0.66 : 0.8) - w.used));
    let lay = layout(L);
    while (uncached(lay.list) > room && lay.L < L + 2) lay = layout(lay.L + 1);
    if (this.covers(box, lay.L)) return;
    if (uncached(lay.list) > room) {
      this.status = `Weather paused to stay within Open-Meteo’s free limit — resumes about ${hhmm(Date.now() + 60e3)}`;
      clearTimeout(this.budgetTimer);
      this.budgetTimer = setTimeout(() => this.maybeFetch(), 60e3);
      this.renderTime(); this.readout();
      return;
    }
    ({ L } = lay);
    const { dLon, dLat, cols, rows, list } = lay;
    const pts = list.map(latticePoint);
    const req = (this.req = Symbol('wx'));
    this.loading = true;
    this.renderStrip(); // (where there's nothing to show yet, the skeleton: after a pan too)
    this.renderTime();
    this.readout();
    try {
      const raw = await forecastCells(list);
      if (req !== this.req) return;
      // cells fetched at different times share one hourly axis
      const t0 = Math.floor(Date.now() / 3600e3) * 3600 - 3600;
      const series = raw.map((s) => alignSeries(s, t0, HOURS + 2));
      const [w, n] = pts[0], [e, s] = pts[pts.length - 1];
      this.grid = {
        L, cols, rows, lon0: w, lat0: n, dLon, dLat, box: [w, s, e, n], merc: [mx(w), my(n), mx(e), my(s)],
        pts, series, stale: !!raw.stale, from: raw.from || null, zoom: this.map.getZoom(), t: Date.now(), time0: Date.now() / 1000,
      };
      this.status = null;
      if (!this.cam) this.buildCam();
      this.applyHour(true);
    } catch (err) {
      // keep whatever grid we had; say why there's no fresh one
      this.status = err && err.name === 'Limited' ? err.message : 'Weather forecast unavailable right now';
    } finally {
      if (req === this.req) { this.loading = false; this.renderStrip(); this.renderTime(); this.readout(); } // (a failure ends the strip's skeleton too)
    }
  }

  // Interpolate every grid point to the selected hour.
  applyHour(images = false) {
    const g = this.grid;
    if (!g) return;
    const t = timeAtHour(this.hour);
    const N = g.series.length;
    const u = new Float32Array(N), v = new Float32Array(N), gust = new Float32Array(N), temp = new Float32Array(N), rain = new Float32Array(N), cloud = new Float32Array(N), snow = new Float32Array(N), thunder = new Float32Array(N);
    const times = g.series[0].time;
    let i = 0;
    while (i < times.length - 2 && times[i + 1] <= t) i++;
    const f = Math.max(0, Math.min(1, (t - times[i]) / ((times[i + 1] - times[i]) || 3600)));
    for (let k = 0; k < N; k++) {
      const s = g.series[k] || g.series[0];
      const lin = (a) => (a[i] ?? 0) * (1 - f) + (a[i + 1] ?? a[i] ?? 0) * f;
      const sp = lin(s.speed);
      // wind blows *towards* dir+180
      const r0 = ((s.dir[i] + 180) * Math.PI) / 180, r1 = (((s.dir[i + 1] ?? s.dir[i]) + 180) * Math.PI) / 180;
      const ux = Math.sin(r0) * (1 - f) + Math.sin(r1) * f, vy = Math.cos(r0) * (1 - f) + Math.cos(r1) * f;
      const len = Math.hypot(ux, vy) || 1;
      u[k] = (ux / len) * sp; v[k] = (vy / len) * sp;
      gust[k] = lin(s.gust); temp[k] = lin(s.temp); rain[k] = lin(s.precip); cloud[k] = s.cloud ? lin(s.cloud) : NaN;
      snow[k] = s.snow ? lin(s.snow) : NaN; // cm (cells from before snow was asked for: not known)
      const code = s.code ? s.code[f < 0.5 ? i : i + 1] : null; // (WMO's code: the nearer hour's)
      thunder[k] = code == null ? NaN : code >= 95 ? 1 : 0;
    }
    this.cur = { u, v, gust, temp, rain, cloud, snow, thunder, t, i, f };
    this.buildField();
    if (images) this.stripData = null; // new grid → rebuild the strip
    this.renderStrip();
    if (images || Math.abs((this.lastImgHour ?? -9) - this.hour) >= 0.25 || (this.lastImgHour < 0) !== (this.hour < 0)) {
      this.lastImgHour = this.hour;
      this.renderImages();
    } else if (this.hour < 0 && this.on.rain && scanAt(this.hour) !== this.fi?.t) this.syncRadar(); // (the radar's next scan)
    this.renderTowns();
    this.renderTime();
    this.readout();
  }

  // Bilinear weights of a location on the forecast grid.
  weights(lngLat) {
    const g = this.grid;
    if (!g) return null;
    const { cols, rows } = g;
    const gx = (lngLat[0] - g.lon0) / g.dLon;
    const gy = (g.lat0 - lngLat[1]) / g.dLat;
    if (!(gx >= 0 && gy >= 0 && gx <= cols - 1 && gy <= rows - 1)) return null;
    const cx = Math.min(cols - 2, Math.floor(gx)), cy = Math.min(rows - 2, Math.floor(gy));
    const tx = gx - cx, ty = gy - cy;
    const k = cy * cols + cx;
    return [[k, (1 - tx) * (1 - ty)], [k + 1, tx * (1 - ty)], [k + cols, (1 - tx) * ty], [k + cols + 1, tx * ty]];
  }

  sample(lngLat) {
    const c = this.cur;
    const w = c && this.weights(lngLat);
    if (!w) return null;
    const at = (arr) => w.reduce((s, [k, wt]) => s + arr[k] * wt, 0);
    const u = at(c.u), v = at(c.v);
    return { u, v, speed: Math.hypot(u, v), gust: at(c.gust), temp: at(c.temp), rain: at(c.rain), cloud: at(c.cloud), snow: c.snow ? at(c.snow) : NaN, dir: ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360 };
  }

  // Precipitation summed over the next `hours` from the selected time.
  accum(lngLat, hours = 6) {
    const g = this.grid, c = this.cur;
    const w = c && this.weights(lngLat);
    if (!w) return null;
    let sum = 0;
    for (const [k, wt] of w) {
      const p = g.series[k].precip;
      for (let j = c.i + 1; j <= Math.min(p.length - 1, c.i + hours); j++) sum += (p[j] || 0) * wt;
    }
    return sum;
  }

  // ------------------------------------------------------------------ map images
  renderImages() {
    const g = this.grid, c = this.cur;
    if (!g || !c) return;
    const coords = [[g.box[0], g.box[3]], [g.box[2], g.box[3]], [g.box[2], g.box[1]], [g.box[0], g.box[1]]];
    const [x0, y0, x1, y1] = g.merc;
    // fn(at) → [r, g, b, a] or null, where at(array) is the selected hour's value there, bilinear between the grid's
    // points; size: the image's pixels a side (the steps' edges need more than a smooth field)
    const draw = (fn, size = IMG, blur = 0) => {
      const gx = Float32Array.from({ length: size }, (_, px) => (lonOf(x0 + ((x1 - x0) * (px + 0.5)) / size) - g.lon0) / g.dLon);
      const gy = Float32Array.from({ length: size }, (_, py) => (g.lat0 - latOf(y0 + ((y1 - y0) * (py + 0.5)) / size)) / g.dLat);
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(size, size);
      let k = 0, tx = 0, ty = 0;
      const at = (a) => a[k] * (1 - tx) * (1 - ty) + a[k + 1] * tx * (1 - ty) + a[k + g.cols] * (1 - tx) * ty + a[k + g.cols + 1] * tx * ty;
      for (let py = 0; py < size; py++) {
        const y = gy[py];
        if (!(y >= 0 && y <= g.rows - 1)) continue;
        const cy = Math.min(g.rows - 2, Math.floor(y));
        ty = y - cy;
        for (let px = 0; px < size; px++) {
          const x = gx[px];
          if (!(x >= 0 && x <= g.cols - 1)) continue;
          const cx = Math.min(g.cols - 2, Math.floor(x));
          tx = x - cx; k = cy * g.cols + cx;
          const rgba = fn(at);
          if (rgba) img.data.set(rgba, (py * size + px) * 4);
        }
      }
      ctx.putImageData(img, 0, 0);
      if (blur) { // Effects: the steps' edges feathered, their colours as they are
        const soft = document.createElement('canvas');
        soft.width = soft.height = size;
        const sc = soft.getContext('2d');
        sc.filter = `blur(${blur}px)`;
        sc.drawImage(cv, 0, 0);
        return { url: soft.toDataURL('image/png'), coordinates: coords };
      }
      return { url: cv.toDataURL('image/png'), coordinates: coords };
    };
    const on = this.hour < 0 ? { rain: this.on.rain } : this.on; // only the rain has a past (the radar): the rest start at Now
    this.windCv.hidden = !on.wind;
    const fieldOn = on.temp || on.wind;
    this.app.setImage('wxField', fieldOn ? draw((at) => [...(on.temp ? ramp(TEMP_RAMP, at(c.temp)) : ramp(WIND_RAMP, Math.hypot(at(c.u), at(c.v)))), 255]) : null);
    // snow on the ground: its steps where there's 1 cm or more (bare ground stays clear; cells from before snow was asked for aren't known)
    this.app.setImage('wxSnow', on.snow ? draw((at) => stepRgba(SNOW_STEPS, at(c.snow)), STEP_IMG, this.effects ? 1 : 0) : null);
    // clouds: a still grey veil (a pale one on dark maps, where white shows), thicker where the cover is. It doesn't drift: moving an
    // image source makes the map reload it, so the map never settles while it moves (its 'idle' waits, and what waits for it)
    const dark = this.app.dark();
    this.app.setImage('wxCloud', on.cloud ? draw((at) => { const v = at(c.cloud) / 100; return v > 0 ? (dark ? [148, 163, 184, 77 * v ** 1.3] : [71, 85, 105, 97 * v ** 1.3]) : null; }) : null);
    // the forecast's thunder (WMO's 95–99): a light amber area, its dashed edge a line on the map; and FMI's lightning
    this.app.setImage('wxThunderArea', on.thunder ? draw((at) => (at(c.thunder) >= 0.5 ? [245, 158, 11, 46] : null), STEP_IMG) : null);
    this.app.setData('wxThunder', { type: 'FeatureCollection', features: on.thunder ? this.thunderEdge() : [] });
    if (this.on.thunder) this.loadStrikes();
    const forecastRain = this.on.rain && this.hour >= 0.5;
    this.app.setImage('wxRain', forecastRain ? draw((at) => fallRgba(at(c.rain), at(c.temp) < 0.5), STEP_IMG, this.effects ? 1 : 0) : null);
    this.syncRadar();
    this.paintRadar();
    this.renderLabels();
  }

  // labels: °C on a sparse grid, and precipitation amounts where it rains. At "now" the
  // amounts are the radar's (FMI's, where it covers), so they match what the map draws;
  // RainViewer has no amounts, so outside FMI's radar there are none at "now"
  renderLabels() {
    const g = this.grid;
    if (!g || !this.cur) return;
    const feats = [];
    const nowRain = this.on.rain && this.hour < 0.5, rate = this.hour < 0 ? this.fi?.img.rateAt : this.fiRate;
    for (let r = 1; r < g.rows - 1; r++) {
      for (let c = 1; c < g.cols - 1; c++) {
        const k = r * g.cols + c;
        if (this.on.temp && this.hour >= 0) feats.push({ type: 'Feature', properties: { kind: 'temp', t: `${Math.round(this.cur.temp[k])}°` }, geometry: { type: 'Point', coordinates: g.pts[k] } });
        const rr = nowRain ? (rate ? rate(g.pts[k][0], g.pts[k][1]) : null) : this.cur.rain[k];
        if (this.on.rain && rr >= 0.1) {
          const snow = this.cur.temp[k] < 0.5;
          feats.push({ type: 'Feature', properties: { kind: 'rain', t: `${snow ? 'snow ' : ''}${rr < 1 ? rr.toFixed(1) : Math.round(rr)} mm/h` }, geometry: { type: 'Point', coordinates: g.pts[k] } });
        }
      }
    }
    // snow: what FMI's stations measured (now) beside the model's wash
    if (this.on.snow && this.snowObs) {
      for (const o of this.snowObs) feats.push({ type: 'Feature', properties: { kind: 'snowobs', t: o.cm >= 1 ? `${Math.round(o.cm)} cm` : '0', bare: o.cm >= 1 ? 0 : 1 }, geometry: { type: 'Point', coordinates: o.ll } });
    }
    this.app.setData('wxLabels', { type: 'FeatureCollection', features: feats });
  }

  // FMI's measured snow depths, once an hour, while the snow layer is on
  async loadSnowObs() {
    if (!this.on.snow) return;
    try {
      this.snowObs = await measuredSnow();
      if (this.on.snow) this.renderImages();
    } catch { /* the model's wash still shows */ }
  }

  // The forecast thunder's edge, where the grid's thunder (1 or 0, bilinear, as its area's image is drawn) crosses ½:
  // marching squares on a lattice four times finer than the grid's, so the dashes follow the area's own edge, its
  // pieces joined into lines so the dashes run on
  thunderEdge() {
    const g = this.grid, t = this.cur.thunder, F = 4, nx = (g.cols - 1) * F, ny = (g.rows - 1) * F;
    const val = (x, y) => {
      const cx = Math.min(g.cols - 2, Math.floor(x / F)), cy = Math.min(g.rows - 2, Math.floor(y / F)), tx = x / F - cx, ty = y / F - cy, k = cy * g.cols + cx;
      const v = t[k] * (1 - tx) * (1 - ty) + t[k + 1] * tx * (1 - ty) + t[k + g.cols] * (1 - tx) * ty + t[k + g.cols + 1] * tx * ty;
      return v >= 0 ? v : 0; // (not known: no thunder drawn)
    };
    const ll = ([x, y]) => [g.lon0 + (x / F) * g.dLon, g.lat0 - (y / F) * g.dLat];
    // each piece of edge crosses two of a square's sides; a side is named by its corners, so pieces meet by name
    const segs = [], by = new Map();
    const side = (p, q) => (p[1] === q[1] ? `h${Math.min(p[0], q[0])},${p[1]}` : `v${p[0]},${Math.min(p[1], q[1])}`);
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const cs = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], vs = cs.map(([a, b]) => val(a, b)), inn = vs.map((v) => v >= 0.5);
        const s = inn.indexOf(true);
        if (s < 0 || inn.every(Boolean)) continue;
        let exit = null;
        for (let j = 0; j < 4; j++) { // round the square from a corner inside: where the edge leaves it, then where it comes back
          const i = (s + j) % 4, n = (i + 1) % 4;
          if (inn[i] === inn[n]) continue;
          const f = (0.5 - vs[i]) / (vs[n] - vs[i]);
          const pt = { p: [cs[i][0] + (cs[n][0] - cs[i][0]) * f, cs[i][1] + (cs[n][1] - cs[i][1]) * f], k: side(cs[i], cs[n]) };
          if (inn[i]) { exit = pt; continue; }
          const at = segs.push([exit, pt]) - 1;
          for (const e of [exit, pt]) by.set(e.k, [...(by.get(e.k) || []), at]);
        }
      }
    }
    const used = new Uint8Array(segs.length), lines = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = 1;
      const l = [...segs[i]];
      for (const tail of [true, false]) { // grow the line at its tail, then at its head
        for (;;) {
          const end = tail ? l[l.length - 1] : l[0], j = (by.get(end.k) || []).find((n) => !used[n]);
          if (j === undefined) break;
          used[j] = 1;
          const next = segs[j][0].k === end.k ? segs[j][1] : segs[j][0];
          if (tail) l.push(next); else l.unshift(next);
        }
      }
      lines.push(l.map((e) => e.p));
    }
    return lines.map((l) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l.map(ll) } }));
  }

  // FMI's lightning, at Now only (it's seen, not forecast): the view and a quarter around it, again each minute; a strike
  // newer than the last answer's is new (it fades in, and with Effects rings once). Ages are drawn again every 20 s.
  async loadStrikes() {
    clearTimeout(this.strikeTimer);
    if (this.on.thunder && this.hour >= 0 && this.hour < 0.5) {
      this.strikeTimer = setTimeout(() => this.loadStrikes(), 20e3);
      const v = this.viewBox(), L = this.lightning;
      const fresh = L && Date.now() - L.t < 60e3 && v[0] >= L.box[0] && v[2] <= L.box[2] && v[1] >= L.box[1] && v[3] <= L.box[3];
      if (!fresh && !this.strikesLoading) {
        const px = (v[2] - v[0]) / 4, py = (v[3] - v[1]) / 4, box = [v[0] - px, v[1] - py, v[2] + px, v[3] + py];
        this.strikesLoading = true;
        try {
          const list = await strikesIn(box), last = L && !L.failed ? L.latest : Infinity, now = performance.now();
          for (const s of list) if (s.t > last) s.born = now;
          this.lightning = { box, t: Date.now(), list, latest: Math.max(0, ...list.map((s) => s.t)) };
          this.map.removeFeatureState({ source: 'wxStrikes' }); // (the ids are the new list's)
          if (list.some((s) => s.born)) this.startAnim();
        } catch {
          this.lightning = { box, t: Date.now(), list: [], failed: true }; // (the legend says so; again in a minute)
        } finally {
          this.strikesLoading = false;
        }
      }
    }
    this.renderStrikes();
    this.renderLegend();
  }

  renderStrikes() {
    const L = this.on.thunder && this.hour >= 0 && this.hour < 0.5 && this.lightning, now = Date.now(), feats = [];
    if (L) L.list.forEach((s, i) => {
      const m = (now - s.t) / 60e3;
      s.id = i;
      if (m < 60) feats.push({ type: 'Feature', id: i, properties: { age: m < 1 ? 'a' : m < 10 ? 'b' : 'c', sort: s.t / 1e3 - now / 1e3 }, geometry: { type: 'Point', coordinates: s.ll } });
      if (s.born && !s.shown) this.map.setFeatureState({ source: 'wxStrikes', id: i }, { a: 0 }); // (it fades in: flashStrikes())
    });
    this.app.setData('wxStrikes', { type: 'FeatureCollection', features: feats });
  }

  // A new strike fades in over 180 ms, easing out; with Effects (and motion) one white glow and one ring in its age's
  // colour, growing and fading over 600 ms, so the eye finds where it just struck. Over the map, on the rain's canvas.
  flashStrikes(now) {
    const fresh = (this.lightning?.list || []).filter((s) => s.born && !s.shown);
    if (!fresh.length) return false;
    const ring = this.effects && !REDUCED.matches, ctx = this.rainCtx;
    if (ring) { this.rainCv.hidden = false; if (!this.falling) ctx.clearRect(0, 0, this.W, this.H); }
    for (const s of fresh) {
      const t = Math.max(0, now - s.born), out = (p) => 1 - (1 - Math.min(1, p)) ** 3; // (a frame can be timed before the answer came)
      this.map.setFeatureState({ source: 'wxStrikes', id: s.id }, { a: out(t / 180) });
      if (t >= (ring ? 600 : 180)) { s.shown = true; continue; }
      if (!ring) continue;
      const p = this.map.project(s.ll), e = out(t / 600);
      if (t < 260) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26);
        g.addColorStop(0, `rgba(255,255,255,${0.7 * (1 - t / 260)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - 26, p.y - 26, 52, 52);
      }
      ctx.globalAlpha = 0.9 * (1 - t / 600); ctx.lineWidth = 2; ctx.strokeStyle = STRIKE_COLOURS.a;
      ctx.beginPath(); ctx.arc(p.x, p.y, 6 + e * 20, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (ring && !this.falling && fresh.every((s) => s.shown)) { ctx.clearRect(0, 0, this.W, this.H); this.rainCv.hidden = true; }
    return true;
  }

  // Weather at places (#916): the sky, °C and wind at the places the map names (cities and towns, and zoomed in villages
  // and suburbs), at the timeline's hour. The grid is finer zoomed in, so nearby places can differ. From the grid, so a town costs no request; one with no grid near shows nothing rather than a guess.
  // `pick`: choose the towns again (the map's labels have moved): the larger first, kept apart, none over the route.
  renderTowns(pick = false) {
    const marks = this.townMarks;
    if (!this.on.towns || this.hour < 0 || !this.cur) { for (const m of marks.values()) m.remove(); marks.clear(); this.townList = null; return; }
    if (pick || !this.townList) {
      const big = (f) => PLACE_LAYERS.indexOf(f.layer.id) * 100 + (f.properties.rank ?? 50);
      const route = ['route-casing'].filter((id) => this.map.getLayer(id));
      this.townList = [];
      const box = this.map.getContainer().getBoundingClientRect(), cv = this.map.getCanvasContainer();
      const free = (x, y) => { const e = document.elementFromPoint(box.left + x, box.top + y); return !!e && (cv.contains(e) || !!e.closest('.menu-pop, .menu-leaving')); };
      for (const f of this.map.queryRenderedFeatures({ layers: PLACE_LAYERS.filter((id) => this.map.getLayer(id)) }).sort((a, b) => big(a) - big(b))) {
        const name = f.properties.name, ll = f.geometry.coordinates, p = this.map.project(ll);
        if (!name || this.townList.some((t) => t.name === name || (Math.abs(t.p.x - p.x) < 150 && Math.abs(t.p.y - p.y) < 100))) continue; // (a few, not a wall of the same numbers)
        if ([-32, 0, 32].some((dx) => !free(p.x + dx, p.y - 14) || !free(p.x + dx, p.y - 34))) continue; // (not under the map's buttons or panels)
        if (route.length && this.map.queryRenderedFeatures([[p.x - 48, p.y - 40], [p.x + 48, p.y + 2]], { layers: route }).length) continue;
        this.townList.push({ name, ll, p });
      }
    }
    const shown = new Set();
    for (const { name, ll } of this.townList) {
      const s = this.sample(ll);
      if (!s) continue;
      const rain = this.nowRate(...ll) ?? s.rain, kind = skyKind(rain, s.temp, s.cloud, sunPosition(this.cur.t, ll).alt < -3);
      const t = Math.round(s.temp), ms = Math.round(s.speed);
      const label = `${name}: ${SKY[kind].toLowerCase()}, ${t} °C, wind ${ms} m/s from the ${compass(s.dir)}`;
      let m = marks.get(name);
      // a tap pins the timeline's reading there, as a spot on the map does (not the map's click under it: a card)
      if (!m) marks.set(name, m = new maplibregl.Marker({ element: h('button', { type: 'button', class: 'wx-town', onclick: (e) => { e.stopPropagation(); this.holdAt(ll); } }), anchor: 'bottom', offset: [0, -10] }).setLngLat(ll).addTo(this.map));
      const el = m.getElement();
      if (el.getAttribute('aria-label') !== label) {
        el.setAttribute('aria-label', label);
        el.innerHTML = `${icon(`sky-${kind}`, 18)}<b class="${t <= 0 ? 'cold' : ''}">${t}°</b><small><svg class="tl-arrow" viewBox="0 0 12 12" style="transform:rotate(${Math.round(s.dir + 180) % 360}deg)" aria-hidden="true"><path d="M6 1 10 10 6 8 2 10Z"/></svg>${ms} m/s</small>`;
      }
      shown.add(name);
    }
    for (const [name, m] of marks) if (!shown.has(name)) { m.remove(); marks.delete(name); }
  }

  // Radar "now": FMI's composite over Finland (sharp, our colours) and RainViewer
  // for everywhere else; RainViewer is left out when Finland's image covers the view.
  syncRadar() {
    const now = this.on.rain && this.hour < 0.5;
    if (!now) { this.app.setRadar(null); this.app.setImage('wxRadarFi', null); this.fiNow = this.fiPast = this.radarShown = null; this.fiRate = null; this.renderNoRadar(); return; }
    this.syncRadarRv();
    this.loadFiRadar();
  }

  // FMI's image's box and size for the view: zoomed out, all of Finland; zoomed in, the view and a margin, sharper. Not
  // over Finland: null. About 1 km a pixel, the radar's own: finer would just repeat its cells (and let false echoes
  // pass the speckle filter); the map smooths it.
  radarBox() {
    const v = this.viewBox(), fi = FI_BOUNDS, z = this.map.getZoom();
    if (v[2] < fi[0] || v[0] > fi[2] || v[3] < fi[1] || v[1] > fi[3]) return null;
    let box = fi;
    if (z >= 7.5) {
      const px = (v[2] - v[0]) * 0.5, py = (v[3] - v[1]) * 0.5;
      box = [Math.max(fi[0], v[0] - px), Math.max(fi[1], v[1] - py), Math.min(fi[2], v[2] + px), Math.min(fi[3], v[3] + py)];
    }
    const aspect = (my(box[1]) - my(box[3])) / (mx(box[2]) - mx(box[0]));
    const km = (box[2] - box[0]) * 111.32 * Math.cos((((box[1] + box[3]) / 2) * Math.PI) / 180);
    const width = Math.max(24, Math.min(1024, Math.round(km)));
    return { box, zoomed: z >= 7.5, full: box === fi, width, height: Math.max(24, Math.min(2048, Math.round(width * Math.abs(aspect)))) };
  }

  async loadFiRadar() {
    if (this.on.rain && this.hour < 0) { this.loadPastScan(); return; }
    if (!this.on.rain || this.hour >= 0.5) return;
    const v = this.viewBox(), b = this.radarBox(), z = this.map.getZoom();
    if (!b) return; // not over Finland
    const { box } = b;
    const c = this.fiNow;
    const inside = c && v[0] >= c.box[0] && v[2] <= c.box[2] && v[1] >= c.box[1] && v[3] <= c.box[3];
    // the all-Finland image serves every zoomed-out view; a zoomed-in one, views inside it
    if (c && (c.zoomed ? inside && z >= 7.5 : z < 7.5) && Date.now() - c.t < 5 * 60e3) return;
    if (this.fiLoading || Date.now() - (this.fiFailed || 0) < 60e3) return; // one try a minute after a failure
    this.fiLoading = true;
    try {
      const img = await fmiRadar(box, b.width, b.height);
      if (!this.on.rain || this.hour >= 0.5) return;
      this.fiNow = { box, t: Date.now(), zoomed: b.zoomed, rv: b.full, img }; // rv: RainViewer still needed around it
      this.paintRadar();
      this.fiRate = img.rateAt;
      this.renderLabels(); // the amounts at "now" are the radar's
      this.renderTime();
      this.buildField();
      this.syncRadarRv();
      clearTimeout(this.fiTimer);
      this.fiTimer = setTimeout(() => { if (this.fiNow) this.fiNow.t = 0; this.loadFiRadar(); }, 5 * 60e3); // new scans every 5 min
      this.fiFailed = 0;
    } catch {
      this.fiFailed = Date.now(); // RainViewer still shows; net.js has the notice
      this.renderNoRadar();
    } finally {
      this.fiLoading = false;
    }
  }

  // FMI's radar in the steps, as snowfall where the forecast says below +0.5 °C now; drawn again only when
  // Effects or the forecast changes (no new request)
  paintRadar() {
    const fi = this.fi;
    const key = `${this.effects}|${this.grid ? this.grid.t : ''}`;
    if (!fi || (fi === this.radarShown && fi.painted === key)) return;
    if (fi.painted !== key) { // (painted once, so a past scan played again costs nothing)
      const snowAt = this.cur && ((lon, lat) => this.sample([lon, lat])?.temp < 0.5);
      fi.url = fi.img.paint(fallRgba, { snowAt, blur: this.effects ? 1.5 : 0.5 });
      fi.painted = key;
    }
    this.radarShown = fi;
    this.app.setImage('wxRadarFi', { url: fi.url, coordinates: fi.img.coordinates });
  }

  // The radar's past (#182): FMI's scan at the timeline's 5 minutes, at half Now's detail, kept while the view stays in
  // its box (18 of them at most); while playing, the next two are asked for ahead. Until one comes the last stays, and
  // the time says it's loading; one that fails is taken off, and the time says so.
  async loadPastScan() {
    const t = scanAt(this.hour), b = this.radarBox();
    if (!b) { this.fiPast = null; this.app.setImage('wxRadarFi', null); this.radarShown = null; this.syncRadarRv(); return; } // (RainViewer's)
    const key = b.box.join();
    if (this.scans?.key !== key) this.scans = { key, at: new Map() };
    const get = (at) => {
      const m = this.scans.at;
      if (!m.has(at)) m.set(at, fmiRadar(b.box, Math.max(24, b.width >> 1), Math.max(24, b.height >> 1), at).then((img) => ({ box: b.box, t: at, zoomed: b.zoomed, rv: b.full, img }), () => null));
      return m.get(at);
    };
    const want = get(t);
    if (this.playing) for (const n of [1, 2]) if (t + n * 300 <= scanAt(-1 / 12)) get(t + n * 300);
    this.scanLoading = t;
    this.renderTime();
    const scan = await want;
    if (scanAt(this.hour) !== t || this.hour >= 0 || !this.on.rain) return;
    this.scanLoading = 0;
    this.scanFailed = scan ? 0 : t;
    this.fiPast = scan;
    if (scan) this.paintRadar(); else { this.app.setImage('wxRadarFi', null); this.radarShown = null; }
    this.syncRadarRv();
    this.renderLabels(); // (the scan's amounts)
    this.renderTime();
  }

  syncRadarRv() {
    const v = this.viewBox();
    const c = this.fi;
    const covers = c && !c.rv && v[0] >= c.box[0] && v[2] <= c.box[2] && v[1] >= c.box[1] && v[3] <= c.box[3];
    // in the past, RainViewer's frame from before the scan's time (they come every 10 minutes)
    const rv = this.hour < 0 && this.radar?.frames ? [...this.radar.frames].reverse().find((f) => f.time <= scanAt(this.hour)) || this.radar.frames[0] : this.radar;
    this.app.setRadar(this.on.rain && this.hour < 0.5 && !covers ? (rv ? { rv: rv.rv, time: rv.time } : {}) : null);
    this.rvShown = !covers && !!this.radar?.rv;
    this.renderNoRadar();
  }

  // Where no radar reaches (#182), hatched as yr hatches where it has no data, at Now (the forecast covers everywhere):
  // outside FMI's composite (its own no-data pixels) and, where RainViewer's radar is drawn, outside its coverage too.
  // Only once both have answered (or failed): the view and a quarter around it, a pixel of the image a pixel on screen.
  async renderNoRadar() {
    const fi = this.fi || this.fiNow, v = this.viewBox(), z = Math.min(6, Math.max(1, Math.floor(this.map.getZoom()) - 1)); // (a past scan's coverage, or Now's while it loads)
    const f = FI_BOUNDS, overFi = !(v[2] < f[0] || v[0] > f[2] || v[3] < f[1] || v[1] > f[3]);
    const known = this.on.rain && this.hour < 0.5 && this.radar && (fi || this.fiFailed || !overFi);
    const key = known && `${(this.fiNow || fi)?.t || this.fiFailed}|${this.rvShown}|${this.effects}|${this.app.dark()}|${z}`, last = this.noRadarAt;
    if (known && last && last.key === key && v[0] >= last.box[0] && v[2] <= last.box[2] && v[1] >= last.box[1] && v[3] <= last.box[3]) return;
    const token = (this.noRadarToken = (this.noRadarToken || 0) + 1);
    if (!known) { this.noRadarAt = null; this.app.setImage('wxNoRadar', null); this.renderLegend(); return; }
    const px = (v[2] - v[0]) / 4, py = (v[3] - v[1]) / 4, box = [v[0] - px, Math.max(-85, v[1] - py), v[2] + px, Math.min(85, v[3] + py)];
    const rv = this.rvShown ? await rainviewerCoverage(box, z) : null;
    if (token !== this.noRadarToken) return;
    const W = Math.min(2048, Math.round(this.W * 1.5)), H = Math.min(2048, Math.round(this.H * 1.5)), S = 6, mw = Math.ceil(W / S), mh = Math.ceil(H / S);
    const x0 = mx(box[0]), x1 = mx(box[2]), y0 = my(box[3]), y1 = my(box[1]), mask = new ImageData(mw, mh);
    let shown = false;
    for (let j = 0; j < mh; j++) {
      const lat = latOf(y0 + ((y1 - y0) * (j + 0.5)) / mh);
      for (let i = 0; i < mw; i++) {
        const lon = lonOf(x0 + ((x1 - x0) * (i + 0.5)) / mw);
        const byFmi = fi && lon >= fi.box[0] && lon <= fi.box[2] && lat >= fi.box[1] && lat <= fi.box[3] && fi.img.rateAt(lon, lat) !== null;
        if (byFmi || (rv && rv(lon, lat) !== false)) continue; // (RainViewer's coverage not known: not said to be missing)
        mask.data[(j * mw + i) * 4 + 3] = 255;
        shown ||= lon >= v[0] && lon <= v[2] && lat >= v[1] && lat <= v[3];
      }
    }
    let img = null;
    if (shown) {
      const m = Object.assign(document.createElement('canvas'), { width: mw, height: mh }), cv = Object.assign(document.createElement('canvas'), { width: W, height: H });
      m.getContext('2d').putImageData(mask, 0, 0);
      const ctx = cv.getContext('2d'), dark = this.app.dark();
      ctx.fillStyle = dark ? 'rgba(15,23,42,.35)' : 'rgba(71,85,105,.16)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = dark ? 'rgba(226,232,240,.32)' : 'rgba(51,65,85,.38)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = -H; x < W; x += 8) { ctx.moveTo(x, 0); ctx.lineTo(x + H, H); }
      ctx.stroke();
      ctx.globalCompositeOperation = 'destination-in'; // the stripes kept where there's no radar
      if (this.effects) ctx.filter = 'blur(8px)'; // Effects: the hatch fades in over its edge
      ctx.drawImage(m, 0, 0, W, H);
      img = { url: cv.toDataURL('image/png'), coordinates: [[box[0], box[3]], [box[2], box[3]], [box[2], box[1]], [box[0], box[1]]] };
    }
    this.noRadarAt = { key, box, shown };
    this.app.setImage('wxNoRadar', img);
    this.renderLegend();
  }

  async loadRadarMeta() {
    if (this.radar && Date.now() - this.radar.t < 5 * 60 * 1000) return;
    try {
      const j = await request('rainviewer', 'https://api.rainviewer.com/public/weather-maps.json').then((r) => r.json());
      const frames = j.radar.past.map((f) => ({ rv: `${j.host}${f.path}/512/{z}/{x}/{y}/2/1_1.png`, time: f.time }));
      this.radar = { t: Date.now(), ...frames[frames.length - 1], frames }; // (its past, every 10 minutes, for the radar's past)
    } catch {
      this.radar = { t: Date.now() };
    }
    if (this.on.rain && this.hour < 0.5) this.syncRadarRv();
    this.renderTime();
  }

  // ------------------------------------------------------------------ screen caches
  buildCanvases() {
    const host = this.map.getCanvasContainer();
    const make = (cls) => {
      const cv = document.createElement('canvas');
      cv.className = `wx-canvas ${cls}`;
      cv.hidden = true;
      host.insertBefore(cv, this.map.getCanvas().nextSibling);
      return cv;
    };
    this.windCv = make('wx-wind');
    this.rainCv = make('wx-precip');
    this.windCtx = this.windCv.getContext('2d');
    this.rainCtx = this.rainCv.getContext('2d');
    this.resizeCanvases();
  }

  resizeCanvases() {
    const r = this.map.getContainer().getBoundingClientRect();
    this.W = Math.round(r.width);
    this.H = Math.round(r.height);
    for (const cv of [this.windCv, this.rainCv]) {
      cv.width = this.W; // 1× density: thin strokes don't need retina, and it's 4× cheaper
      cv.height = this.H;
      cv.style.width = `${this.W}px`;
      cv.style.height = `${this.H}px`;
    }
  }

  clearCanvas(ctx, cv) { ctx.clearRect(0, 0, cv.width, cv.height); }

  // Geography of every screen cell plus how one metre east / north looks on
  // screen there. Built once per camera stop; rotation and pitch come for free.
  buildCam() {
    const cols = Math.ceil(this.W / CELL) + 1, rows = Math.ceil(this.H / CELL) + 1;
    const n = cols * rows;
    const ll = new Float64Array(n * 2), E = new Float32Array(n * 2), N = new Float32Array(n * 2), ok = new Uint8Array(n);
    const horizon = this.map.getPitch() > 50 ? this.H * 0.22 : -1;
    const D = 30; // metres
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c, x = c * CELL, y = r * CELL;
        if (y < horizon) continue;
        const p = this.map.unproject([x, y]);
        if (!Number.isFinite(p.lat) || Math.abs(p.lat) > 85) continue;
        const dLat = D / 111195, dLon = dLat / Math.cos((p.lat * Math.PI) / 180);
        const pe = this.map.project([p.lng + dLon, p.lat]), pn = this.map.project([p.lng, p.lat + dLat]);
        ll[2 * i] = p.lng; ll[2 * i + 1] = p.lat;
        E[2 * i] = (pe.x - x) / D; E[2 * i + 1] = (pe.y - y) / D;
        N[2 * i] = (pn.x - x) / D; N[2 * i + 1] = (pn.y - y) / D;
        ok[i] = 1;
      }
    }
    this.cam = { cols, rows, ll, E, N, ok };
  }

  // Screen velocity (px/frame at 60 fps) and precipitation per cell for the
  // selected hour: just grid sampling, cheap enough to redo every frame.
  buildField() {
    const cam = this.cam;
    if (!cam || !this.cur || !this.animated) return;
    const n = cam.cols * cam.rows;
    const vx = new Float32Array(n), vy = new Float32Array(n), rain = new Float32Array(n), snow = new Uint8Array(n);
    let wet = 0;
    for (let i = 0; i < n; i++) {
      if (!cam.ok[i]) continue;
      const s = this.sample([cam.ll[2 * i], cam.ll[2 * i + 1]]);
      if (!s) continue;
      const dx = s.u * cam.E[2 * i] + s.v * cam.N[2 * i];
      const dy = s.u * cam.E[2 * i + 1] + s.v * cam.N[2 * i + 1];
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        const v = 0.25 + s.speed * 0.13; // constant on-screen speed, like windy
        vx[i] = (dx / len) * v; vy[i] = (dy / len) * v;
      }
      // "now": the drops follow the radar where it covers, else the forecast
      const radar = this.nowRate(cam.ll[2 * i], cam.ll[2 * i + 1]);
      rain[i] = radar != null ? radar : s.rain;
      snow[i] = s.temp < 0.5 ? 1 : 0;
      if (rain[i] >= 0.1) wet++;
    }
    this.field = { vx, vy, rain, snow, wet: wet / n };
    this.precipStill = false; // (reduced motion: the still rain is drawn again for the new field)
  }

  // FMI's radar rate now (mm/h), or null where it doesn't reach or at a later hour (its fiRate is
  // dropped only in renderImages(), after the field for the new hour is built)
  nowRate(lon, lat) { return this.fiRate && this.hour < 0.5 ? this.fiRate(lon, lat) : null; }

  // ------------------------------------------------------------------ animation
  startAnim() {
    if (this.anim) return;
    let last = performance.now();
    const spawnP = (p) => { p.x = Math.random() * this.W; p.y = Math.random() * this.H; p.age = 0; p.max = 40 + Math.random() * 80; return p; };
    const tick = (now) => {
      this.anim = requestAnimationFrame(tick);
      // tuned for 60 fps; scale by real frame time (120 Hz screens, dropped frames)
      const k = Math.min(3, Math.max(0.25, (now - last) / 16.7));
      last = now;
      if (this.playing) this.advancePlay(k);
      const flashing = this.moving ? !!this.lightning?.list.some((s) => s.born && !s.shown) : this.flashStrikes(now);
      if (!flashing && !this.playing && !this.animated) { cancelAnimationFrame(this.anim); this.anim = 0; return; } // (nothing moves)
      if (this.moving || !this.field) return;
      const f = this.field, cols = this.cam.cols;
      const cellAt = (x, y) => Math.round(y / CELL) * cols + Math.round(x / CELL);

      if (this.on.wind && this.hour >= 0) {
        const ctx = this.windCtx;
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = `rgba(0,0,0,${Math.pow(0.86, k).toFixed(3)})`;
        ctx.fillRect(0, 0, this.W, this.H);
        ctx.globalCompositeOperation = 'source-over';
        const n = Math.min(2200, Math.round((this.W * this.H) / 800));
        while (this.particles.length < n) this.particles.push(spawnP({}));
        this.particles.length = n;
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = this.app.dark() ? 'rgba(255,255,255,0.75)' : 'rgba(15,23,42,0.55)';
        ctx.beginPath();
        for (const p of this.particles) {
          const i = cellAt(p.x, p.y);
          const vx = f.vx[i], vy = f.vy[i];
          if ((p.age += k) > p.max || !(vx || vy) || p.x < 0 || p.y < 0 || p.x > this.W || p.y > this.H) { spawnP(p); continue; }
          ctx.moveTo(p.x, p.y);
          p.x += vx * k; p.y += vy * k;
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      if (this.falling) this.drawPrecip(k, f, cellAt);
    };
    this.anim = requestAnimationFrame(tick);
  }

  // Effects' rain (#182): a few thin white streaks at the wind's angle where it rains, more where it rains
  // harder, and small white flakes where it snows; the steps under them say how much. In reduced motion
  // they're drawn once, still, until the field changes.
  drawPrecip(k, f, cellAt) {
    const still = REDUCED.matches;
    if (still && this.precipStill) return;
    const ctx = this.rainCtx;
    ctx.clearRect(0, 0, this.W, this.H);
    if (f.wet <= 0) return;
    const n = Math.min(1000, Math.round((this.W * this.H) / 1500));
    while (this.drops.length < n) this.drops.push({ age: 1, max: 0, x: -1 });
    this.drops.length = n;
    const spawn = (d) => {
      const x = Math.random() * this.W, y = Math.random() * this.H;
      const i = cellAt(x, y);
      // the radar's scattered echoes are finer than a cell (100 km zoomed out): asked where the drop would be,
      // its place eased between the grid's four corners (in 3D, map.unproject() reads a pixel back from the GPU)
      let r = f.rain[i];
      const { cols, ll, ok } = this.cam, c = Math.floor(x / CELL), w = Math.floor(y / CELL), a = w * cols + c;
      if (r >= 0.1 && this.fiRate && this.hour < 0.5 && ok[a] && ok[a + 1] && ok[a + cols] && ok[a + cols + 1]) {
        const u = x / CELL - c, v = y / CELL - w;
        const mix = (o) => (ll[2 * a + o] * (1 - u) + ll[2 * a + 2 + o] * u) * (1 - v) + (ll[2 * (a + cols) + o] * (1 - u) + ll[2 * (a + cols) + 2 + o] * u) * v;
        r = this.nowRate(mix(0), mix(1)) ?? r;
      }
      // 0.1 mm/h: about one drop in eight tries; 3.6 mm/h and up: all of them
      if (r >= 0.1 && Math.random() < Math.min(1, 0.1 + r / 4)) {
        d.x = x; d.y = y; d.age = 0; d.snow = !!f.snow[i];
        d.max = d.snow ? 150 + Math.random() * 120 : 14 + Math.random() * 16;
        d.len = 3.9 + Math.min(11, r * 1.5);
        d.fall = d.snow ? 0.85 : 5.4 + Math.min(5.8, r * 0.7);
        d.phase = Math.random() * 6.28;
        return;
      }
      d.age = 0; d.max = 4 + Math.random() * 10; d.x = -1; // dormant: try again soon
    };
    const move = (k) => {
      for (const d of this.drops) {
        if ((d.age += k) > d.max) { spawn(d); continue; }
        if (d.x < 0) continue;
        const wx = f.vx[cellAt(d.x, d.y)] || 0;
        if (d.snow) d.x += (wx * 1.5 + Math.sin(d.phase + d.age * 0.06) * 0.35) * k;
        else d.x += wx * 4.5 * k;
        d.y += d.fall * k;
        if (d.y > this.H || d.x < 0 || d.x > this.W) d.age = d.max + 1;
      }
    };
    if (still) { for (let j = 0; j < 70; j++) move(1); this.precipStill = true; } else move(k);
    const dark = this.app.dark(), streaks = new Path2D(), flakes = new Path2D();
    for (const d of this.drops) {
      if (d.x < 0) continue;
      if (d.snow) { flakes.moveTo(d.x + 2.1, d.y); flakes.arc(d.x, d.y, 2.1, 0, Math.PI * 2); continue; }
      const dx = (f.vx[cellAt(d.x, d.y)] || 0) * 4.5, l = d.len / Math.hypot(dx, d.fall);
      streaks.moveTo(d.x, d.y);
      streaks.lineTo(d.x - dx * l, d.y - d.fall * l);
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = dark ? 'rgba(226,232,240,0.5)' : 'rgba(255,255,255,0.75)';
    ctx.stroke(streaks);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill(flakes);
    if (!dark) { ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(71,85,105,0.4)'; ctx.stroke(flakes); }
  }

  // Remove what the switched-off layers drew (images, labels, particles).
  clearLayers() {
    if (!this.on.wind) { this.clearCanvas(this.windCtx, this.windCv); this.windCv.hidden = true; }
    if (!this.falling) { this.clearCanvas(this.rainCtx, this.rainCv); this.rainCv.hidden = true; }
    if (!this.on.temp && !this.on.wind) this.app.setImage('wxField', null);
    if (!this.on.snow) this.app.setImage('wxSnow', null);
    if (!this.on.cloud) this.app.setImage('wxCloud', null);
    if (!this.on.thunder) { this.app.setImage('wxThunderArea', null); this.app.setData('wxThunder', { type: 'FeatureCollection', features: [] }); clearTimeout(this.strikeTimer); this.lightning = null; this.renderStrikes(); }
    if (!this.on.rain) { this.app.setImage('wxRain', null); this.app.setRadar(null); this.app.setImage('wxRadarFi', null); this.fiNow = this.fiPast = this.radarShown = null; this.fiRate = null; this.renderNoRadar(); }
    if (!this.on.towns) this.renderTowns();
    if (!this.layersOn) this.app.setData('wxLabels', { type: 'FeatureCollection', features: [] });
  }

  // Nothing needs the clock running: stop playback and the animation loop.
  stopClock() {
    this.playing = false;
    this.syncPlay();
    cancelAnimationFrame(this.anim);
    this.anim = 0;
  }

  stop() { this.on = { wind: false, temp: false, rain: false, snow: false, cloud: false, thunder: false, towns: false }; this.clearLayers(); this.renderLegend(); this.stopClock(); }

  // ------------------------------------------------------------------ time bar
  buildBar() {
    const bar = document.getElementById('wx-bar');
    this.bar = bar;
    bar.hidden = true;
    this.playBtn = h('button', { type: 'button', class: 'tool', 'aria-label': 'Play forecast', onclick: () => this.togglePlay(), html: icon('play', 18) });
    // (its range and words are set by syncSlider(): the 48 hours by the hour, or Your trip by the 5 minutes)
    this.slider = h('input', { type: 'range', step: '1', oninput: (e) => {
      const z = this.tripWin();
      this.playing = false; this.stepAt = null; this.syncPlay();
      this.setHour(z ? this.hourOn(z, z.tw0 + e.target.value * 300) : hourOf(+e.target.value));
    } });
    this.timeEl = h('div', { class: 'wx-time' });
    // the map's layers: a button each, one tap, any of them at once, their state in sight (#869)
    this.layerRow = h('div', { class: 'tl-layers', role: 'group', 'aria-label': 'Weather layers' });
    for (const [k, name, line, word, ic] of LAYERS) {
      // (Wind holds both its names, so it's as wide when it says Wind lines: renderLayers())
      const b = h('button', { type: 'button', class: 'chip', 'data-k': k, 'aria-pressed': 'false', onclick: () => this.app.onToggle({ [k]: !this.on[k] }),
        html: k === 'wind' ? `<span>${icon(ic, 16)}Wind</span><span>${icon(ic, 16)}Wind lines</span>` : `${icon(ic, 16)}<span>${word}</span>` });
      tooltip(b, { name, text: line });
      this.layerRow.append(b);
    }
    // a row too narrow for them (a narrow window's, a phone's) scrolls sideways and fades at the edge where there's more;
    // a mouse has the arrows there and a drag, as the weather card's hours (a finger and a trackpad scroll it themselves)
    const arrow = (dir) => h('button', { type: 'button', class: `tool wx-hs-arrow ${dir < 0 ? 'l' : 'r'}`, tabindex: '-1', 'aria-label': dir < 0 ? 'Layers to the left' : 'Layers to the right', html: icon(dir < 0 ? 'chevronLeft' : 'chevronRight', 20),
      onclick: () => this.layerRow.scrollBy({ left: dir * (this.layerRow.clientWidth - 64), behavior: REDUCED.matches ? 'auto' : 'smooth' }) });
    const al = arrow(-1), ar = arrow(1);
    this.layerWrap = h('div', { class: 'tl-lwrap' }, al, this.layerRow, ar);
    const edge = () => {
      const r = this.layerRow, l = r.scrollLeft > 2, m = r.scrollLeft + r.clientWidth < r.scrollWidth - 2;
      r.classList.toggle('more-l', l); r.classList.toggle('more-r', m); al.classList.toggle('on', l); ar.classList.toggle('on', m);
    };
    this.layerRow.addEventListener('scroll', edge, { passive: true });
    new ResizeObserver(edge).observe(this.layerRow);
    mouseDrag(this.layerRow);
    this.moreBtn = h('button', { type: 'button', class: 'tool tl-more', 'aria-label': 'More: Weather at places, Effects', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: () => this.moreMenu(), html: icon('more', 18) });
    // the legend over the map, top left, while a layer is on: apart from the timeline, wherever that is
    this.legendEl = h('div', { class: 'wx-legend', role: 'region', 'aria-label': 'Map legend', hidden: true });
    document.querySelector('.map-hints').append(this.legendEl);
    // it folds to its name and opens with a tap; folded at first on a phone (or 200 %), open on a desktop; remembered
    this.foldMQ = matchMedia('(max-width: 720px), (max-height: 480px)');
    this.legendOpen = store.get('wxLegendOpen', null);
    this.foldMQ.addEventListener('change', () => { this.legendKey = null; this.renderLegend(); });
    this.noteEl = h('div', { class: 'tl-note' });
    this.stripCv = h('canvas', { class: 'tl-strip', role: 'img', 'aria-label': 'The radar’s last 90 minutes, then the 48-hour forecast here: temperature, rain and wind. Drag to change the time.' });
    this.nowEl = h('div', { class: 'tl-now' });
    this.bindStrip();
    const head = h('div', { class: 'tl-head' },
      h('span', { class: 'tl-title', html: `${icon('clock', 15)} Timeline` }),
      this.moreBtn,
      h('button', { type: 'button', class: 'tool tl-close', 'aria-label': 'Close timeline', onclick: () => this.app.onClose(), html: icon('close', 16) }));
    // the trip's row, under the slider while the route has times (#869): what the timeline shows (48 hours or Your trip,
    // greyed past the map's 48 hours with the reason), and in Your trip its days and ‹ › between the stretches against you;
    // then the weather card. Its line with the switch is the last, so the switch stays under the finger as rows come and
    // go over it (the timeline grows up from its foot)
    const spanBtn = (k, words) => h('button', { type: 'button', 'data-k': `span-${k}`, 'aria-pressed': 'false', onclick: () => this.setSpan(k) }, words);
    this.spanSeg = h('div', { class: 'seg small', role: 'group', 'aria-label': 'What the timeline shows' }, spanBtn('48', '48 hours'), spanBtn('trip', 'Your trip'));
    this.daysEl = h('div', { class: 'rt-chips wx-days', role: 'group', 'aria-label': 'The day' });
    const stepBtn = (dir) => h('button', { type: 'button', class: 'tool', 'data-k': dir < 0 ? 'step-prev' : 'step-next', 'aria-label': dir < 0 ? 'The stretch against you before' : 'The next stretch against you',
      html: icon(dir < 0 ? 'chevronLeft' : 'chevronRight', 18), onclick: () => this.step(dir) });
    this.stepWords = h('span', { 'aria-live': 'polite' });
    this.stepEl = h('div', { class: 'tl-step', role: 'group', 'aria-label': 'Where the wind is against you' }, stepBtn(-1), this.stepWords, stepBtn(1));
    this.whyEl = h('p', { class: 'tl-why', id: 'tl-why' });
    this.tripRow = h('div', { class: 'tl-trip', hidden: true }, this.spanSeg, this.daysEl, this.stepEl,
      h('button', { type: 'button', class: 'btn small quiet tl-card', onclick: () => this.app.openWeather(this.span === 'trip' ? this.day : 0), html: `Weather card${icon('chevronRight', 16)}` }), this.whyEl);
    bar.append(
      head,
      h('div', { class: 'tl-main' }, this.stripCv, this.nowEl),
      h('div', { class: 'wx-row' }, this.playBtn, this.slider, this.timeEl),
      this.tripRow,
      this.noteEl,
    );
    this.syncSlider();
    new ResizeObserver(() => this.renderStrip()).observe(this.stripCv);
    this.bindFloat();
    // the buttons on a row of their own under the title bar on a desktop, where the title bar is the handle to drag; on a
    // phone in the head's row, before ⋯ and ✕
    const place = () => (this.floatMQ.matches ? head.after(this.layerWrap) : head.insertBefore(this.layerWrap, this.moreBtn));
    this.floatMQ.addEventListener('change', place);
    place();
  }

  // The buttons as the layers are; Wind says Wind lines while Temperature colours the map (the two share its one field)
  renderLayers() {
    for (const b of this.layerRow.children) b.setAttribute('aria-pressed', String(!!this.on[b.dataset.k]));
    this.layerRow.querySelector('[data-k=wind]').classList.toggle('lines', !!this.on.temp);
  }

  // ⋯'s menu: the rest of the weather, and where it comes from; it stays open while you tick. Weather at places (#916;
  // its key `towns` as saved) is at the places the map names at any zoom, and a tap on one pins the reading there
  moreMenu() {
    const items = () => [
      { group: 'Points', items: [{ icon: 'cloudSun', label: 'Weather at places', desc: 'The sky, temperature and wind where the map names a place', checked: this.on.towns, keep: true, cls: 'wx-towns', fn: () => tick('towns', () => this.app.onToggle({ towns: !this.on.towns })) }] },
      'hr',
      { icon: 'sparkle', label: 'Effects', desc: 'Softer edges and falling rain', checked: this.effects, keep: true, cls: 'wx-fx', fn: () => tick('fx', () => this.setEffects(!this.effects)) },
      { note: 'Forecast by Open-Meteo. Radar and measured snow by FMI, and by RainViewer outside Finland.' },
    ];
    const tick = (k, fn) => { fn(); menu.refill(items()); menu.el.querySelector(`.wx-${k}`).focus({ preventScroll: true }); };
    if (this.menu) { this.menu.close(); return; } // (⋯ again: it closes)
    this.moreBtn.setAttribute('aria-expanded', 'true');
    const menu = this.menu = popMenu(this.moreBtn, items(), { label: 'More weather', onClose: () => { this.menu = null; this.moreBtn.setAttribute('aria-expanded', 'false'); } });
  }

  // ------------------------------------------------------------------ your trip (#869's build, PR 2)
  // The trip's row as the route's times are (app.onAnalysis(), on every change of the route, its departure and its
  // forecast, and Leave now's clock): shown while the route has times, Your trip greyed when it starts past the map's 48
  // hours, the trip view left when the trip goes or moves out of reach, and its hour kept inside the trip's window
  renderTrip() {
    const tr = this.trip = this.app.trip ? this.app.trip() : null, days = tr ? tr.days : [];
    this.day = Math.min(this.day, Math.max(0, days.length - 1));
    if (this.span === 'trip' && !(tr && this.reaches(days[this.day]))) this.span = '48';
    const zoomed = this.span === 'trip', far = !!tr && !this.reaches(days[0]), off = days.find((d) => !this.reaches(d));
    if (!zoomed) this.stepAt = null;
    this.tripRow.hidden = !tr;
    const [b48, bTrip] = this.spanSeg.children;
    b48.setAttribute('aria-pressed', String(!zoomed));
    bTrip.setAttribute('aria-pressed', String(zoomed));
    bTrip.disabled = far;
    if (far) bTrip.setAttribute('aria-describedby', 'tl-why'); else bTrip.removeAttribute('aria-describedby');
    // a day at a time on a trip of days, with the weather card's chips; a day past the map's 48 hours greyed
    const chips = zoomed && days.length > 1, had = this.daysEl.contains(document.activeElement) && document.activeElement.dataset.k;
    this.daysEl.hidden = !chips;
    this.daysEl.replaceChildren(...(chips ? days.map((d, j) => h('button', { type: 'button', class: 'chip', 'data-k': `day-${d.n}`, 'aria-pressed': String(j === this.day),
      disabled: !this.reaches(d) || null, 'aria-describedby': this.reaches(d) ? null : 'tl-why', onclick: () => this.setDay(j) }, `Day ${d.n} · ${weekday(d.t0)}`)) : []));
    if (had) this.daysEl.querySelector(`[data-k="${had}"]`)?.focus({ preventScroll: true });
    this.stepEl.hidden = !zoomed;
    const z = this.tripWin(), end = Math.floor(Date.now() / 3600e3) * 3600 + HOURS * 3600, when = (t, long) => `${weekday(t, long)} ${hhmm(t * 1000)}`;
    this.whyEl.textContent = far ? `Your trip starts ${weekday(days[0].t0, true)} at ${hhmm(days[0].t0 * 1000)}, past the map’s 48 hours of weather: you can zoom to it from ${when(days[0].t0 - HOURS * 3600, true)}.`
      : chips && off ? `Day ${off.n} starts ${weekday(off.t0, true)} at ${hhmm(off.t0 * 1000)}, past the map’s 48 hours of weather.`
        : z && z.d.t1 > end ? `The map’s weather reaches ${when(end)}: the rest of ${days.length > 1 ? `day ${z.d.n}` : 'your trip'} isn’t shown.` : '';
    this.whyEl.hidden = !this.whyEl.textContent;
    if (z) { const t = timeAtHour(this.hour); if (t < z.tw0 || t > z.tw1) { this.setHour(this.hourOn(z, t)); this.placeFloat(); return; } }
    this.syncSlider();
    this.renderStrip();
    this.renderTime();
    this.readout();
    this.placeFloat(); // (rows come and go: kept on screen)
  }

  // Your trip's window, by the 5 minutes: its day with an hour either side, from Now to the end of the map's 48 hours; null
  // in the 48 hours
  tripWin() {
    if (this.span !== 'trip' || !this.trip) return null;
    const d = this.trip.days[this.day], now = Date.now() / 1000;
    return { d, tw0: Math.ceil(Math.max(now, d.t0 - 3600) / 300) * 300, tw1: Math.floor(Math.min(Math.floor(now / 3600) * 3600 + HOURS * 3600, d.t1 + 3600) / 300) * 300 };
  }
  // a day the map's 48 hours reach
  reaches(d) { return hourAt(d.t0) < HOURS; }
  // the hour at time t in Your trip, to the 5 minutes, inside its window
  hourOn(z, t) { return hourAt(Math.max(z.tw0, Math.min(z.tw1, Math.round(t / 300) * 300))); }
  // the sample you're at at time t on day d: its first before you set off, its last once you're there
  sampleOn(d, t) {
    const { T } = this.trip;
    let lo = d.i0, hi = d.i1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (T.at(m) < t) lo = m + 1; else hi = m; }
    return lo;
  }
  // the day's stretches against you (the weather card's, from Wind on the way) that start inside the window; a new list (a
  // new forecast, day or window) lets go of the one stepped to
  stretches(z) {
    const { a, T } = this.trip, c = this.stepList;
    if (!a.wind) return [];
    if (c && c.w === a.wind && c.d === z.d && c.tw1 === z.tw1) return c.list;
    this.stepAt = null;
    this.stepList = { w: a.wind, d: z.d, tw1: z.tw1, list: this.trip.against(z.d).filter((r) => T.at(r.i0) <= z.tw1) };
    return this.stepList.list;
  }

  // 48 hours or Your trip, switched at once (nothing moves): Your trip at the day the hour is in, else its first day, and
  // at the day's start unless the hour is already in its window; 48 hours keeps the hour
  setSpan(k) {
    if (k === this.span) return;
    if (k === 'trip') {
      const t = timeAtHour(this.hour), j = this.trip.days.findIndex((d) => t >= d.t0 - 3600 && t <= d.t1 + 3600);
      this.day = j >= 0 && this.reaches(this.trip.days[j]) ? j : 0;
    }
    this.span = k;
    this.stepAt = null;
    this.renderTrip();
    const z = this.tripWin(), t = timeAtHour(this.hour);
    if (z) this.setHour(this.hourOn(z, t >= z.tw0 && t <= z.tw1 ? t : z.d.t0));
  }
  setDay(j) {
    this.day = j;
    this.stepAt = null;
    this.renderTrip();
    this.setHour(this.hourOn(this.tripWin(), this.trip.days[j].t0));
  }

  // where ‹ › put the hour on a stretch against you: its first 5 minutes inside it (its first sample's, or the nearest
  // 5 minutes on a stretch shorter than that)
  stretchHour(z, r) {
    const { T } = this.trip, t = T.at(r.i0 + 1), up = Math.ceil(t / 300) * 300;
    return this.hourOn(z, up <= T.at(r.i1) ? up : t);
  }
  // ‹ and ›: the hour to the stretch against you before or after it, lit on the band and the route
  step(dir) {
    const z = this.tripWin(), list = this.stretches(z), at = list.map((r) => this.stretchHour(z, r));
    const j = dir > 0 ? at.findIndex((x) => x > this.hour + 1e-4) : at.findLastIndex((x) => x < this.hour - 1e-4);
    if (j < 0) return;
    this.playing = false;
    this.syncPlay();
    this.stepAt = j;
    this.setHour(at[j]);
  }

  // What follows the hour in Your trip: your dot on the route, ‹ › and their words (the forecast loading, failed or stopping
  // short said so), and the stretch stepped to lit. The focus stays on the arrow, or goes to the other at the end (to the
  // slider when neither has another)
  syncTrip() {
    const z = this.tripWin(), tr = this.trip;
    if (!z) {
      if (this.youPin) { this.youPin.remove(); this.youPin = null; }
      if (this.litKey) { this.litKey = null; this.app.light(null); }
      return;
    }
    const { a } = tr, w = a.wind, i = this.sampleOn(z.d, timeAtHour(this.hour));
    if (!this.youPin) this.youPin = new maplibregl.Marker({ element: h('div', { class: 'wx-you', 'aria-hidden': 'true' }) }).setLngLat(a.pts[i]).addTo(this.map);
    else this.youPin.setLngLat(a.pts[i]);
    const list = this.stretches(z), n = list.length, at = list[this.stepAt], km = (j) => Math.max(1, Math.round(a.along[j] / 1000));
    const short = w && forecastKnown(w, z.d.i0) && !forecastKnown(w, z.d.i1) ? ` · no forecast past km ${km(w.beyond)}` : '';
    const [b, sm] = !w ? [`The wind on your way: ${a.windError ? 'no forecast' : 'loading'}`, '']
      : !forecastKnown(w, z.d.i0) ? ['The wind on your way: no forecast yet', '']
        : !n ? ['Nowhere against you for long', short.slice(3)]
          : at ? [`Against you, ${this.stepAt + 1} of ${n}`, `km ${km(at.i0)}${km(at.i1) > km(at.i0) ? ` to ${km(at.i1)}` : ''} · up to ${Math.round(at.max)} m/s`]
            : [`Against you on ${n} stretch${n > 1 ? 'es' : ''}`, `up to ${Math.round(Math.max(...list.map((r) => r.max)))} m/s${short}`];
    if (this.stepWords.dataset.said !== b + sm) {
      this.stepWords.dataset.said = b + sm;
      this.stepWords.replaceChildren(h('b', {}, b), sm ? h('small', {}, sm) : '');
    }
    const [prev, next] = this.stepEl.querySelectorAll('button'), had = this.stepEl.contains(document.activeElement), hrs = list.map((r) => this.stretchHour(z, r));
    prev.disabled = !hrs.some((x) => x < this.hour - 1e-4);
    next.disabled = !hrs.some((x) => x > this.hour + 1e-4);
    if (had && document.activeElement.disabled) (prev.disabled ? (next.disabled ? this.slider : next) : prev).focus({ preventScroll: true }); // (one stretch: the slider)
    const key = at ? `${at.i0}-${at.i1}` : null;
    if (key !== (this.litKey || null)) { this.litKey = key; this.app.light(at ? [at.i0, at.i1] : null); }
  }

  // Your trip's columns, every 10 minutes from the window's start: the weather where you'll be then, from the route's own
  // forecast (the weather card's; none past its reach); null while it loads, when it failed, or when it reaches none of the
  // trip
  tripSeries(z) {
    const { a } = this.trip, w = a.wind, c = this.tripData;
    if (!w || !forecastKnown(w, z.d.i0)) return null;
    if (c && c.w === w && c.d === z.d && c.tw0 === z.tw0 && c.tw1 === z.tw1) return c;
    const out = { w, d: z.d, tw0: z.tw0, tw1: z.tw1, t: [], temp: [], rain: [], speed: [], dir: [], ll: [] };
    for (let t = z.tw0; ; t = Math.min(z.tw1, t + 600)) {
      const i = this.sampleOn(z.d, t), s = t <= w.beyondSec ? sampleAt(w.series[w.cell[i]], t) : null;
      out.t.push(t); out.ll.push(a.pts[i]);
      out.temp.push(s ? s.temp : NaN); out.rain.push(s ? s.precip : NaN); out.speed.push(s ? s.speed : NaN); out.dir.push(s ? s.dir : NaN);
      if (t >= z.tw1) break;
    }
    return (this.tripData = out);
  }

  // ------------------------------------------------------------------ timeline strip
  // 48 h at the map centre: night shading, rain bars, temperature line, wind
  // arrows, day ticks, your ride (when a route is planned) and the cursor.
  stripSeries() {
    const g = this.grid;
    const c = this.map.getCenter();
    const w = g && this.weights([c.lng, c.lat]);
    if (!w) return null;
    const key = `${g.t}|${c.lng.toFixed(2)},${c.lat.toFixed(2)}|${Math.floor(Date.now() / 600000)}`;
    if (this.stripData && this.stripData.key === key) return this.stripData;
    const times = g.series[0].time;
    const out = { key, temp: [], rain: [], speed: [], dir: [], t: [], lat: c.lat, lon: c.lng };
    for (let hr = 0; hr <= HOURS; hr++) {
      const t = timeAtHour(hr);
      let i = 0;
      while (i < times.length - 2 && times[i + 1] <= t) i++;
      const f = Math.max(0, Math.min(1, (t - times[i]) / ((times[i + 1] - times[i]) || 3600)));
      let temp = 0, rain = 0, u = 0, v = 0;
      for (const [k, wt] of w) {
        const s = g.series[k];
        const lin = (a) => (a[i] ?? 0) * (1 - f) + (a[i + 1] ?? a[i] ?? 0) * f;
        temp += lin(s.temp) * wt;
        rain += lin(s.precip) * wt;
        const sp = lin(s.speed), d = ((s.dir[i] + 180) * Math.PI) / 180;
        u += Math.sin(d) * sp * wt; v += Math.cos(d) * sp * wt;
      }
      out.temp.push(temp); out.rain.push(rain); out.speed.push(Math.hypot(u, v));
      out.dir.push(((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360); out.t.push(t);
    }
    this.stripData = out;
    return out;
  }

  renderStrip() {
    const cv = this.stripCv;
    if (!cv || this.bar.hidden) return;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const css = getComputedStyle(cv);
    const ink = css.getPropertyValue('--text').trim() || '#1c2420';
    const muted = css.getPropertyValue('--muted').trim() || '#5f6b65';
    const accent = css.getPropertyValue('--route').trim();
    // Your trip: its window, read where you'll be from the route's own forecast, a column every 10 minutes; else the 48
    // hours at the map's centre, a column an hour
    const z = this.tripWin(), a = z && this.trip.a;
    const d = z ? this.tripSeries(z) : this.stripSeries();
    const PAD = 9; // matches the range thumb so strip and slider line up
    const U0 = unitOf(-PAST), Xh = (hr) => PAD + ((unitOf(hr) - U0) / (HOURS - U0)) * (W - 2 * PAD);
    const Xt = z && ((t) => PAD + ((t - z.tw0) / (z.tw1 - z.tw0)) * (W - 2 * PAD));
    const X = z ? (k) => Xt(d.t[k]) : Xh, n = d ? d.t.length - 1 : 0;
    ctx.font = '10px system-ui, sans-serif';
    // while the forecast comes, the strip's shape, as a card's skeleton (pick-skel); the time says it in words
    const loading = z ? !a.wind && !a.windError : this.loading;
    cv.classList.toggle('skel', !d && loading);
    if (!d) {
      if (!loading) { ctx.fillStyle = muted; ctx.fillText(z ? (a.wind ? 'No forecast yet for your trip' : 'The forecast couldn’t be loaded') : 'Zoom in to see the forecast here', PAD, H / 2); }
      return;
    }
    // night
    ctx.fillStyle = this.app.dark() || document.documentElement.dataset.theme === 'dark' ? 'rgba(0,0,0,0.28)' : 'rgba(30,41,59,0.07)';
    for (let k = 0; k < n; k++) {
      if (sunPosition((d.t[k] + d.t[k + 1]) / 2, d.ll ? d.ll[k] : [d.lon, d.lat]).alt < -0.8) ctx.fillRect(X(k), 0, X(k + 1) - X(k) + 0.5, H);
    }
    // your ride, from its departure to arrival, whatever the map's hour (step 6b): in Your trip its day, the wind's band
    // under it
    const ride = z ? 0 : this.app.routeHours && this.app.routeHours(), go = Math.max(0, (this.app.departure() - Math.floor(Date.now() / 3600e3) * 3600) / 3600);
    ctx.fillStyle = accent;
    if (z) {
      ctx.globalAlpha = 0.1;
      ctx.fillRect(Xt(Math.max(z.tw0, z.d.t0)), 0, Xt(Math.min(z.tw1, z.d.t1)) - Xt(Math.max(z.tw0, z.d.t0)), H);
      ctx.globalAlpha = 1;
    } else {
      // the radar's last 90 minutes, before Now: only the rain has a past
      ctx.fillStyle = this.app.dark() || document.documentElement.dataset.theme === 'dark' ? 'rgba(96,165,250,0.16)' : 'rgba(59,130,246,0.08)';
      ctx.fillRect(Xh(-PAST), 0, Xh(0) - Xh(-PAST), H);
      if (ride > 0 && go < HOURS) { // (a departure past the strip's 48 hours: none)
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.16;
        ctx.fillRect(Xh(go), 0, Math.max(3, Xh(Math.min(HOURS, go + ride)) - Xh(go)), H);
        ctx.globalAlpha = 1;
        ctx.fillRect(Xh(go), H - 3, Math.max(3, Xh(Math.min(HOURS, go + ride)) - Xh(go)), 3);
      }
    }
    // rain bars
    const top = 14, bottom = H - (z ? 20 : 14);
    for (let k = 0; k < n; k++) {
      const r = (d.rain[k] + d.rain[k + 1]) / 2;
      if (!(r >= 0.05)) continue; // (none past the forecast's reach)
      const bh = Math.min(1, r / 3) * (bottom - top) * 0.75 + 2;
      ctx.fillStyle = (d.temp[k] < 0.5 ? 'rgba(167,139,250,' : 'rgba(59,130,246,') + Math.min(0.9, 0.35 + r / 4) + ')';
      ctx.fillRect(X(k) + 0.5, bottom - bh, X(k + 1) - X(k) - 1, bh);
    }
    // temperature line
    const known = d.temp.filter(Number.isFinite);
    let tMin = Math.min(...known), tMax = Math.max(...known);
    if (tMax - tMin < 4) { const m = (tMax + tMin) / 2; tMin = m - 2; tMax = m + 2; }
    const Y = (t) => top + 4 + (1 - (t - tMin) / (tMax - tMin)) * (bottom - top - 14);
    ctx.beginPath();
    let pen = false;
    d.temp.forEach((t, k) => { if (!Number.isFinite(t)) { pen = false; return; } if (pen) ctx.lineTo(X(k), Y(t)); else ctx.moveTo(X(k), Y(t)); pen = true; });
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // labels at the warmest / coldest hour
    const iMax = d.temp.indexOf(Math.max(...known)), iMin = d.temp.indexOf(Math.min(...known));
    ctx.fillStyle = '#c2410c';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(d.temp[iMax])}°`, Math.min(W - 12, Math.max(12, X(iMax))), Y(d.temp[iMax]) - 4);
    if (iMin !== iMax) ctx.fillText(`${Math.round(d.temp[iMin])}°`, Math.min(W - 12, Math.max(12, X(iMin))), Math.min(bottom, Y(d.temp[iMin]) + 11));
    // wind arrows every third column: 3 h, or in Your trip 30 minutes
    ctx.strokeStyle = muted;
    ctx.fillStyle = muted;
    for (let k = 0; k <= n; k += 3) {
      if (!Number.isFinite(d.speed[k])) continue;
      const x = X(k), y = 7, ang = ((d.dir[k] + 180) * Math.PI) / 180, l = Math.min(6, 2.5 + d.speed[k] / 2);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.lineWidth = d.speed[k] > 8 ? 1.8 : 1.1;
      ctx.beginPath(); ctx.moveTo(0, l); ctx.lineTo(0, -l); ctx.moveTo(-2.4, -l + 2.6); ctx.lineTo(0, -l); ctx.lineTo(2.4, -l + 2.6); ctx.stroke();
      ctx.restore();
    }
    // day ticks and labels
    ctx.textAlign = 'left';
    ctx.fillStyle = muted;
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    const tick = (x) => { ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); ctx.globalAlpha = 1; };
    if (z) {
      // Your trip: every hour (every other where they'd crowd), over the wind's band
      const every = Xt(z.tw0 + 3600) - Xt(z.tw0) < 24 ? 2 : 1;
      for (let t = Math.ceil(z.tw0 / 3600) * 3600; t <= z.tw1; t += 3600) {
        const dt = new Date(t * 1000), x = Xt(t);
        if (dt.getHours() === 0) { tick(x); ctx.fillText(weekday(t), x + 3, H - 10); } else if (dt.getHours() % every === 0 && x < W - 14) ctx.fillText(String(dt.getHours()), x + 2, H - 10);
      }
    } else {
      // hour labels every 6 h, or only at noon when the strip is narrow (phones)
      const every = (Xh(HOURS) - Xh(0)) / HOURS * 6 < 34 ? 12 : 6;
      for (let hr = 1; hr <= HOURS; hr++) {
        const dt = new Date(d.t[hr] * 1000);
        if (dt.getHours() === 0) { tick(Xh(hr)); ctx.fillText(dt.toLocaleDateString([], { weekday: 'short' }), Xh(hr) + 3, H - 4); } else if (dt.getHours() % every === 0 && Xh(hr) > Xh(0) + 18) ctx.fillText(String(dt.getHours()), Xh(hr) - 4, H - 4);
      }
      ctx.fillText('Radar', Xh(-PAST) - 6, H - 4);
    }
    if (z) {
      // Your trip's wind on your way, a band under the hours by the samples you're at (windClass(): against you, the strong
      // in the darker red, from the side, behind you, calm), none while you wait at a stop; past the forecast's reach, said
      // so; the stretch ‹ › stepped to, ringed
      const { T } = this.trip, w = a.wind, band = H - 7;
      for (let i = z.d.i0 + 1; i <= z.d.i1 && forecastKnown(w, i) && T.at(i - 1) < z.tw1; i++) {
        const x0 = Xt(Math.max(z.tw0, T.at(i - 1))), x1 = Xt(Math.min(z.tw1, T.at(i) - (a.waitAt ? a.waitAt[i] : 0)));
        if (x1 > x0) { ctx.fillStyle = windClass(a, i).color; ctx.fillRect(x0, band, x1 - x0 + 0.5, 7); }
      }
      if (w.beyondSec < z.tw1) {
        const x = Xt(Math.max(z.tw0, w.beyondSec));
        ctx.fillStyle = muted; ctx.globalAlpha = 0.12; ctx.fillRect(x, 0, W - PAD - x, H); ctx.globalAlpha = 1;
        ctx.fillText('No forecast yet', x + 4, H / 2);
      }
      const r = this.stepAt != null && this.stretches(z)[this.stepAt];
      if (r) { ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.strokeRect(Xt(T.at(r.i0)) - 1, band - 2, Xt(T.at(r.i1)) - Xt(T.at(r.i0)) + 2, 10); }
    }
    // cursor, and the temperature where it crosses the line
    const t = timeAtHour(this.hour), cx = z ? Xt(t) : Xh(this.hour);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
    const fk = z ? Math.min(n, (t - z.tw0) / 600) : Math.min(HOURS, Math.round(Math.max(0, this.hour))), k0 = Math.floor(fk), k1 = Math.min(n, k0 + 1);
    const tc = d.temp[k0] + (d.temp[k1] - d.temp[k0]) * (fk - k0);
    ctx.fillStyle = ink;
    if (this.hour >= 0 && Number.isFinite(tc)) { ctx.beginPath(); ctx.arc(cx, Y(tc), 3.2, 0, Math.PI * 2); ctx.fill(); }
  }

  bindStrip() {
    const cv = this.stripCv;
    let down = false;
    const at = (e) => {
      const r = cv.getBoundingClientRect(), z = this.tripWin();
      const x = Math.max(0, Math.min(1, (e.clientX - r.left - 9) / (r.width - 18)));
      this.playing = false;
      this.stepAt = null;
      this.syncPlay();
      this.setHour(z ? this.hourOn(z, z.tw0 + x * (z.tw1 - z.tw0)) : hourOf(unitOf(-PAST) + x * (HOURS - unitOf(-PAST))));
    };
    cv.addEventListener('pointerdown', (e) => {
      down = true;
      try { cv.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      at(e);
    });
    cv.addEventListener('pointermove', (e) => { if (down) at(e); });
    cv.addEventListener('pointerup', () => { down = false; });
    cv.addEventListener('pointercancel', () => { down = false; });
  }

  setHour(hr) {
    // an hour outside Your trip's window (the weather card's Weather on the map, say): the 48 hours again
    const z = this.tripWin(), t = timeAtHour(hr);
    if (z && (t < z.tw0 - 1 || t > z.tw1 + 1)) { this.span = '48'; this.renderTrip(); }
    this.hour = Math.max(-PAST, Math.min(HOURS, hr));
    this.syncSlider();
    if (this.grid) this.applyHour(); else { this.renderStrip(); this.renderTime(); } // (Your trip's strip is the route's: no grid needed)
    this.readout();
    this.emitHour();
  }

  // Tell the app whenever the whole hour changes: road works and road conditions follow it.
  emitHour() {
    const k = Math.max(0, Math.round(this.hour)); // (the radar's past: Now's)
    if (k === this.lastEmit) return;
    this.lastEmit = k;
    if (this.app.onHour) this.app.onHour(k);
  }

  togglePlay() {
    const z = this.tripWin();
    this.playing = !this.playing;
    this.stepAt = null;
    if (this.playing && this.hour >= (z ? hourAt(z.tw1) : HOURS) - 1e-6) this.hour = z ? hourAt(z.tw0) : 0;
    this.syncPlay();
    if (!this.anim) this.startAnim();
  }
  // the slider in the strip's units, and in words: the radar's past and the forecast's hours, or Your trip by the 5 minutes
  // (its range set before its value)
  syncSlider() {
    const z = this.tripWin(), sl = this.slider, [lo, hi] = z ? [0, (z.tw1 - z.tw0) / 300] : [unitOf(-PAST), HOURS];
    if (+sl.min !== lo || +sl.max !== hi || !sl.hasAttribute('aria-label')) {
      sl.min = String(lo); sl.max = String(hi);
      sl.setAttribute('aria-label', z ? 'Time on your trip, by 5 minutes' : 'Time: the radar’s last 90 minutes, then the forecast’s hours');
    }
    const t = new Date((this.hour < 0 ? scanAt(this.hour) : timeAtHour(this.hour)) * 1000), clock = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (z) {
      sl.value = String(Math.round((t / 1000 - z.tw0) / 300));
      sl.setAttribute('aria-valuetext', `${t.toLocaleDateString([], { weekday: 'long' })} ${clock}, ${this.whereOn(z, 'before you set off, at the start', 'after you arrive, at the finish', 'at ')}`);
      return;
    }
    sl.value = String(unitOf(this.hour) < 0 ? Math.round(unitOf(this.hour)) : Math.round(this.hour));
    sl.setAttribute('aria-valuetext', this.hour < 0 ? `${clock}, the radar ${Math.round(-this.hour * 60)} minutes ago` : this.hour < 0.5 ? `Now, ${clock}` : `${t.toLocaleDateString([], { weekday: 'long' })} ${clock}, in ${Math.round(this.hour)} hours`);
  }
  // where you'll be at the hour in Your trip, in words: `before` you set off, (`at`) km …, or `after` you're there
  whereOn(z, before, after, at = '') {
    const t = timeAtHour(this.hour);
    return t < z.d.t0 ? before : t > z.d.t1 ? after : `${at}km ${Math.round(this.trip.a.along[this.sampleOn(z.d, t)] / 1000)}`;
  }

  syncPlay() {
    if (!this.playBtn) return;
    this.playBtn.innerHTML = icon(this.playing ? 'pause' : 'play', 18);
    this.playBtn.setAttribute('aria-label', this.playing ? 'Pause' : 'Play forecast');
  }

  advancePlay(k = 1) {
    const z = this.tripWin(), end = z ? hourAt(z.tw1) : HOURS;
    const next = this.hour + k / (z || this.hour < 0 ? 240 : 60); // ~1 s per forecast hour, and per 15 minutes of the radar's past and of your trip
    if (next >= end) { this.playing = false; this.syncPlay(); }
    this.hour = Math.min(end, next);
    this.syncSlider();
    if (this.grid) this.applyHour(); else { this.renderStrip(); this.renderTime(); this.readout(); }
    this.emitHour();
  }

  // the view's centre in Finland: FMI's radar draws "now" there (its image may still be on the way)
  inFinland() {
    const c = this.map.getCenter();
    return c.lng >= FI_BOUNDS[0] && c.lng <= FI_BOUNDS[2] && c.lat >= FI_BOUNDS[1] && c.lat <= FI_BOUNDS[3];
  }

  renderTime() {
    if (!this.timeEl) return;
    const past = this.hour < 0, t = new Date((past ? scanAt(this.hour) : timeAtHour(this.hour)) * 1000);
    const day = t.toLocaleDateString([], { weekday: 'short' });
    const clock = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let label = past ? `${clock} · radar` : this.hour < 0.5 ? `Now · ${clock}` : `${day} ${clock} · +${Math.round(this.hour)} h`;
    if (past && !this.on.rain) label += ' (Rain is off)';
    else if (past && this.scanFailed === scanAt(this.hour)) label += ' couldn’t be loaded';
    else if (past && this.scanLoading === scanAt(this.hour)) label += ' · loading…';
    else if (this.on.rain && this.hour < 0.5) label += this.fi || (this.inFinland() && !this.fiFailed) ? (past ? '' : ' · FMI radar') : past ? '' : ' · radar';
    if (this.loading) label += ' · loading…';
    // Your trip: the time and where you'll be (the grid's loading is the map's: the strip and the reading are the route's)
    const z = this.tripWin(), w = z && this.trip.a.wind;
    this.timeEl.textContent = z ? `${day} ${clock} · ${this.whereOn(z, 'at the start', 'at the finish')}` : label;
    const route = !!(this.app.hasRoute && this.app.hasRoute());
    if (this.noteEl) {
      const g = this.grid;
      const st = sourceStatus('openmeteo');
      const problem = (z && !w && this.trip.a.windError ? 'The forecast along your route couldn’t be loaded' : null)
        || (w && w.stale ? `Showing the forecast from ${hhmm(w.from)} — Open-Meteo couldn’t be reached.` : null)
        || (this.status && !this.loading ? this.status
          : g && g.stale ? `Showing the forecast from ${hhmm(g.from)} — Open-Meteo couldn’t be reached${st ? `; trying again at ${hhmm(st.until)}` : ''}.` : null);
      this.noteEl.classList.toggle('warn', !!problem);
      if (problem || !z) this.noteEl.textContent = problem ? `⚠ ${problem}` : `${route ? 'The shaded band is your ride. ' : ''}Road works and road conditions follow this time too.`;
      else if (!this.noteEl.querySelector('.wx-key')) this.noteEl.innerHTML = `Under the hours, the wind on your way: ${BAND_KEY}`; // (once, not on every frame of Play)
    }
    this.syncTrip();
    if (this.app.onTime) this.app.onTime(this.hour);
  }

  // What the colours mean, in words, over the map while a layer is on (#182, as yr's app has it). On a small
  // screen or at 200 % it folds to its name until it's opened.
  renderLegend() {
    const c = this.cur, rows = [];
    const scale = (bar, words) => `<span class="wx-lg"><i style="background:${bar}"></i><small>${words}</small></span>`;
    if (this.on.temp) rows.push(scale(rampCss(TEMP_RAMP), `<b>Temperature</b> ${TEMP_RAMP[0][0]}–${TEMP_RAMP[TEMP_RAMP.length - 1][0]} °C`));
    else if (this.on.wind) rows.push(scale(rampCss(WIND_RAMP), `<b>Wind</b> ${WIND_RAMP[0][0]}–${WIND_RAMP[WIND_RAMP.length - 1][0]} m/s`));
    if (this.on.rain) {
      rows.push(scale(stepsCss(RAIN_STEPS), `<b>Rain</b> ${RAIN_STEPS.map(([v]) => v).join(' · ')} mm/h`));
      rows.push('<div class="lgl lg-note">light · moderate · heavy · very heavy</div>');
      if (this.hour < 0.5 && this.noRadarAt?.shown) rows.push('<div class="lgl"><i class="lg-nodata"></i><span><b>No radar</b> here: rain and snow not shown</span></div>');
      // snowfall where it's cold enough somewhere on the map at this hour
      if (c && c.temp.some((t) => t < 0.5)) rows.push(scale(stepsCss(SNOWFALL_STEPS), `<b>Snowfall</b> ${SNOWFALL_STEPS.map(([v]) => v).join(' · ')} mm/h`));
    }
    if (this.on.cloud) rows.push(this.app.dark() ? scale('linear-gradient(90deg, #7d8a84, #f1f5f9)', '<b>Clouds</b> the paler, the cloudier') : scale('linear-gradient(90deg, #f1f5f9, #9aa3ae)', '<b>Clouds</b> the greyer, the cloudier'));
    if (this.on.thunder) {
      const L = this.lightning, mark = (col) => `<svg class="lg-mark" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7h9M7 2.5v9" stroke="#1f2937" stroke-width="4.2" stroke-linecap="round"/><path d="M2.5 7h9M7 2.5v9" stroke="${col}" stroke-width="2.2" stroke-linecap="round"/></svg>`;
      let note;
      if (this.hour >= 0.5 || this.hour < 0) note = 'Shown at Now: it’s seen, not forecast';
      else if (!this.inFinland()) note = 'FMI’s, seen over Finland and nearby only';
      else if (!L) note = 'Loading…';
      else if (L.failed) note = '<span class="warn-text">Lightning couldn’t be loaded</span>';
      else {
        const at = this.heldLL || this.map.getCenter().toArray(), recent = L.list.filter((s) => Date.now() - s.t < 3600e3);
        const n = recent.length && recent.reduce((a, s) => { const d = dist(at, s.ll); return d < a.d ? { d, s } : a; }, { d: Infinity });
        note = n ? `Nearest ${n.d < 10e3 ? (n.d / 1000).toFixed(1) : Math.round(n.d / 1000)} km away, ${Math.max(1, Math.round((Date.now() - n.s.t) / 60e3))} min ago` : 'None in the last hour';
      }
      rows.push(`<div class="lgl">${Object.values(STRIKE_COLOURS).map(mark).join('')}<span><b>Lightning</b> &lt;1 · 10 · 60 min ago<br><small>${note}</small></span></div>`);
      rows.push('<div class="lgl"><i class="lg-dash"></i><span><b>Thunder</b> possible (forecast)</span></div>');
    }
    if (this.on.snow) {
      rows.push(scale(stepsCss(SNOW_STEPS), `<b>Snow</b> on the ground ${SNOW_STEPS.map(([v]) => v).join(' · ')} cm`));
      rows.push('<div class="lgl"><b class="lg-obs">24 cm</b><span>Measured by FMI. The colours are the forecast.</span></div>');
    }
    if (this.tripWin()) rows.push(`<div class="lgl"><span><b>Wind on your way</b>, the band under your trip’s hours${BAND_KEY}</span></div>`); // (a phone hides the note under the timeline)
    if (this.hour < 0 && rows.length) rows.unshift('<div class="lgl lg-note">The radar’s past: only the rain has one, the other layers start at Now</div>');
    const open = this.legendOpen ?? !this.foldMQ.matches;
    const key = `${rows.join('')}|${open}`;
    this.legendEl.hidden = !rows.length;
    if (key === this.legendKey) return;
    this.legendKey = key;
    this.legendEl.innerHTML = `<button type="button" class="lg-fold" aria-expanded="${open}">Legend ${icon(open ? 'chevronUp' : 'chevronDown', 14)}</button>` + (open ? rows.join('') : '');
    this.legendEl.querySelector('.lg-fold').addEventListener('click', () => {
      this.legendOpen = !open;
      store.set('wxLegendOpen', this.legendOpen);
      this.renderLegend();
      this.legendEl.querySelector('.lg-fold').focus();
    });
  }

  // The weather card beside the strip: the selected time at the spot under the mouse (or the map centre); in Your trip,
  // where you'll be then (from the route's own forecast, the weather card's), the wind against you in words. At most once
  // per frame.
  readout() {
    if (this.readFrame) return;
    this.readFrame = requestAnimationFrame(() => {
      this.readFrame = 0;
      if (!this.active || !this.nowEl) return;
      this.renderLegend();
      const z = this.tripWin(), a = z && this.trip.a, w = z && a.wind, t = timeAtHour(this.hour), i = z && this.sampleOn(z.d, t);
      const ll = z ? a.pts[i] : this.heldLL || this.pointerLL || this.map.getCenter().toArray();
      const s = z ? (w && t <= w.beyondSec ? sampleAt(w.series[w.cell[i]], t) : null) : this.sample(ll);
      this.nowEl.style.setProperty('--tl-lines', this.on.snow ? 4 : 3); // (its room from the start: css/app.css, #301)
      if (!s && (z ? !w && !a.windError : this.loading)) {
        // its lines' shapes while the forecast comes (pick-skel), drawn once, so they don't start again as the mouse moves
        const n = this.on.snow ? 4 : 3;
        if (this.nowEl.querySelectorAll('.tl-skel').length !== n) this.nowEl.innerHTML = `<span class="sr-only">Loading the forecast</span>${'<i class="tl-skel"></i>'.repeat(n)}`;
        this.nowEl.title = '';
        return;
      }
      const km = z && Math.round(a.along[i] / 1000);
      if (!s) {
        this.nowEl.innerHTML = `<small>${z ? (w ? `No forecast yet for km ${km}` : 'The forecast couldn’t be loaded') : this.status || 'No forecast here'}</small>`;
        this.nowEl.title = this.nowEl.textContent; // (a long note shows three lines)
        return;
      }
      const rain = z ? s.precip : s.rain, kind = skyKind(rain, s.temp, s.cloud ?? NaN, sunPosition(z ? t : this.cur.t, ll).alt < -3);
      const arrow = `<svg class="tl-arrow" viewBox="0 0 12 12" style="transform:rotate(${(s.dir + 180) % 360}deg)" aria-hidden="true"><path d="M6 1 10 10 6 8 2 10Z"/></svg>`;
      const snow = this.on.snow && Number.isFinite(s.snow ?? NaN) ? `<div>${icon('snow', 12)}${s.snow >= 1 ? `${Math.round(s.snow)} cm of snow` : 'no snow'}</div>` : '';
      if (z) {
        const out = t < z.d.t0 ? 'the start' : t > z.d.t1 ? 'the finish' : null, way = !out && forecastKnown(w, i) && WIND_WAY[windClass(a, i).key];
        this.nowEl.title = `${SKY[kind]} · ${out ? `at ${out}` : `on your route at km ${km}`}${way ? `, the wind ${way}` : ''}${s.gust > s.speed + 2 ? ` · gusts ${Math.round(s.gust)} m/s` : ''}`;
        this.nowEl.innerHTML =
          `<div class="tl-now-main">${icon(`sky-${kind}`, 24)}<b>${Math.round(s.temp)}°</b><small>${out || `km ${km}`}</small></div>` +
          `<div>${arrow}${s.speed < 0.5 ? 'calm' : `${s.speed.toFixed(s.speed < 3 ? 1 : 0)} m/s ${way === 'against you' ? '<b>against you</b>' : compass(s.dir)}`}</div>` +
          `<div>${icon('drop', 12)}${rain >= 0.05 ? `${rain.toFixed(1)} mm/h` : 'dry'}</div>` + snow;
        return;
      }
      const sum = this.accum(ll, 6);
      const rainTxt = rain >= 0.05 ? `${rain.toFixed(1)} mm/h` : 'dry';
      const gust = s.gust > s.speed + 2 ? ` <span>gusts ${s.gust.toFixed(0)}</span>` : '';
      const where = this.heldLL ? 'at the spot' : this.pointerLL ? 'under the mouse' : 'at the map centre';
      this.nowEl.title = `${SKY[kind]} · ${where}`;
      this.nowEl.innerHTML =
        `<div class="tl-now-main">${icon(`sky-${kind}`, 24)}<b>${Math.round(s.temp)}°</b><small>${this.heldLL ? 'the spot' : this.pointerLL ? 'here' : 'map centre'}</small></div>` +
        `<div>${arrow}${s.speed < 0.5 ? 'calm' : `${s.speed.toFixed(s.speed < 3 ? 1 : 0)} m/s ${compass(s.dir)}`}${gust}</div>` +
        `<div>${icon('drop', 12)}${rainTxt}${sum != null && sum >= 0.05 ? ` <span>· 6 h ${sum.toFixed(1)} mm</span>` : ''}</div>` + snow;
    });
  }
}
