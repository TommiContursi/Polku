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
import { forecastCells, cellSize, latticePoint, alignSeries, uncached } from './weather.js';
import { compass } from './geo.js';
import { h, icon, store } from './ui.js';
import { request, onStatus, sourceStatus, clock as hhmm, usage } from './net.js';
import { fmiRadar, FI_BOUNDS } from './radar.js';

const MAX_CELLS = 60; // forecast points per grid (the view plus a margin); the field is smooth
const IMG = 72; // field image resolution
const HOURS = 48;
const CELL = 24; // px, screen cache resolution

const WIND_RAMP = [[0, '#3b82f6'], [3, '#22d3ee'], [6, '#4ade80'], [9, '#facc15'], [12, '#fb923c'], [16, '#ef4444'], [22, '#a855f7']];
// snow on the ground, cm (the model): a cool wash that leaves bare ground clear
const SNOW_RAMP = [[1, '#e0f2fe'], [10, '#bae6fd'], [25, '#7dd3fc'], [50, '#60a5fa'], [80, '#6366f1'], [120, '#7c3aed']];
const TEMP_RAMP = [[-25, '#7c3aed'], [-15, '#2563eb'], [-5, '#38bdf8'], [0, '#e0f2fe'], [5, '#a7f3d0'], [10, '#fde047'], [18, '#fb923c'], [25, '#ef4444'], [32, '#9f1239']];
export const RAIN_RAMP = [[0.1, '#93c5fd'], [0.5, '#3b82f6'], [2, '#1d4ed8'], [5, '#7c3aed'], [10, '#db2777']];
export { TEMP_RAMP, SNOW_RAMP };

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

// Sun altitude in degrees (good to ~0.5°), for night shading on the timeline.
function sunAltitude(lat, lon, tSec) {
  const R = Math.PI / 180;
  const d = tSec / 86400 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * R;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * R;
  const e = (23.439 - 0.00000036 * d) * R;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
  const ha = (gmst * 15 + lon) * R - ra;
  return Math.asin(Math.sin(lat * R) * Math.sin(dec) + Math.cos(lat * R) * Math.cos(dec) * Math.cos(ha)) / R;
}

// Web Mercator helpers (0..1 world units)
const mx = (lon) => (lon + 180) / 360;
const my = (lat) => { const s = Math.sin((lat * Math.PI) / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
const lonOf = (x) => x * 360 - 180;
const latOf = (y) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

export class WeatherOverlay {
  constructor(map, app) {
    this.map = map;
    this.app = app; // { setImage(id, img|null), setRadar(r|null), setData(id, fc), dark() }
    this.on = { wind: false, temp: false, rain: false, snow: false };
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
    this.buildCanvases();
    this.buildBar();
    map.on('movestart', () => this.onMoveStart());
    map.on('moveend', () => this.onMoveEnd());
    map.on('resize', () => { this.resizeCanvases(); this.onMoveEnd(); });
    // the card shows the spot under the mouse, else the map centre
    map.on('mousemove', (e) => { this.pointerLL = [e.lngLat.lng, e.lngLat.lat]; this.readout(); });
    map.on('mouseout', () => { this.pointerLL = null; this.readout(); });
    map.on('touchend', () => { this.pointerLL = null; this.readout(); });
    // Open-Meteo may be used again (or works again): refresh an old or missing forecast
    onStatus((src, s) => { if (src === 'openmeteo' && (!s || s.retry) && this.active) this.maybeFetch(); });
  }

  get layersOn() { return this.on.wind || this.on.temp || this.on.rain || this.on.snow; }
  // forecast data is needed for the weather layers and for the timeline strip
  get active() { return this.open || !!this.docked || this.layersOn; }
  get animated() { return this.on.wind || this.on.rain; }

  set(layers) {
    Object.assign(this.on, layers);
    this.windCv.hidden = !this.on.wind;
    this.rainCv.hidden = !this.on.rain;
    this.renderChips();
    this.clearLayers();
    if (!this.active) { this.stopClock(); return; }
    this.renderLegend();
    if (this.grid) { this.buildCam(); this.applyHour(true); }
    this.maybeFetch();
    if (this.animated) this.startAnim();
    if (this.on.rain) this.loadRadarMeta();
    if (this.on.snow) this.loadSnowObs();
    this.readout();
  }

  // Show / hide the floating timeline. Layers keep their selected time either way.
  // While docked in the planner it stays there; this only sets what comes back.
  setOpen(on) {
    this.open = on;
    if (!this.docked) this.bar.hidden = !on;
    this.wake();
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
      this.renderChips();
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
    this.fetchTimer = setTimeout(() => { this.maybeFetch(); this.loadFiRadar(); }, out ? 1200 : 600);
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
    this.renderTime();
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
      if (req === this.req) { this.loading = false; this.renderTime(); this.readout(); }
    }
  }

  // Interpolate every grid point to the selected hour.
  applyHour(images = false) {
    const g = this.grid;
    if (!g) return;
    const t = timeAtHour(this.hour);
    const N = g.series.length;
    const u = new Float32Array(N), v = new Float32Array(N), gust = new Float32Array(N), temp = new Float32Array(N), rain = new Float32Array(N), cloud = new Float32Array(N), snow = new Float32Array(N);
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
    }
    this.cur = { u, v, gust, temp, rain, cloud, snow, t, i, f };
    this.buildField();
    if (images) this.stripData = null; // new grid → rebuild the strip
    this.renderStrip();
    if (images || Math.abs((this.lastImgHour ?? -9) - this.hour) >= 0.25) {
      this.lastImgHour = this.hour;
      this.renderImages();
    }
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
    const g = this.grid;
    if (!g) return;
    const coords = [[g.box[0], g.box[3]], [g.box[2], g.box[3]], [g.box[2], g.box[1]], [g.box[0], g.box[1]]];
    const [x0, y0, x1, y1] = g.merc;
    const draw = (fn) => {
      const cv = document.createElement('canvas');
      cv.width = IMG; cv.height = IMG;
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(IMG, IMG);
      for (let py = 0; py < IMG; py++) {
        for (let px = 0; px < IMG; px++) {
          const s = this.sample([lonOf(x0 + ((x1 - x0) * (px + 0.5)) / IMG), latOf(y0 + ((y1 - y0) * (py + 0.5)) / IMG)]);
          const rgba = s ? fn(s) : null;
          if (!rgba) continue;
          const o = (py * IMG + px) * 4;
          img.data[o] = rgba[0]; img.data[o + 1] = rgba[1]; img.data[o + 2] = rgba[2]; img.data[o + 3] = rgba[3];
        }
      }
      ctx.putImageData(img, 0, 0);
      return { url: cv.toDataURL('image/png'), coordinates: coords };
    };
    const fieldOn = this.on.temp || this.on.wind;
    this.app.setImage('wxField', fieldOn ? draw((s) => (this.on.temp ? [...ramp(TEMP_RAMP, s.temp), 255] : [...ramp(WIND_RAMP, s.speed), 255])) : null);
    // snow on the ground: a wash where there's 1 cm or more (bare ground stays clear)
    this.app.setImage('wxSnow', this.on.snow ? draw((x) => (!(x.snow >= 1) ? null : [...ramp(SNOW_RAMP, x.snow), Math.round(Math.min(220, 120 + x.snow * 2))])) : null);
    const forecastRain = this.on.rain && this.hour >= 0.5;
    this.app.setImage('wxRain', forecastRain ? draw((s) => (s.rain < 0.05 ? null : [...ramp(RAIN_RAMP, s.rain), Math.round(Math.min(235, 150 + s.rain * 45))])) : null);
    this.syncRadar();
    this.renderLabels();
  }

  // labels: °C on a sparse grid, and precipitation amounts where it rains. At "now" the
  // amounts are the radar's (FMI's, where it covers), so they match what the map draws;
  // RainViewer has no amounts, so outside FMI's radar there are none at "now"
  renderLabels() {
    const g = this.grid;
    if (!g || !this.cur) return;
    const feats = [];
    const nowRain = this.on.rain && this.hour < 0.5;
    for (let r = 1; r < g.rows - 1; r++) {
      for (let c = 1; c < g.cols - 1; c++) {
        const k = r * g.cols + c;
        if (this.on.temp) feats.push({ type: 'Feature', properties: { kind: 'temp', t: `${Math.round(this.cur.temp[k])}°` }, geometry: { type: 'Point', coordinates: g.pts[k] } });
        const rr = nowRain ? (this.fiRate ? this.fiRate(g.pts[k][0], g.pts[k][1]) : null) : this.cur.rain[k];
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

  // Radar "now": FMI's composite over Finland (sharp, our colours) and RainViewer
  // for everywhere else; RainViewer is left out when Finland's image covers the view.
  syncRadar() {
    const now = this.on.rain && this.hour < 0.5;
    if (!now) { this.app.setRadar(null); this.app.setImage('wxRadarFi', null); this.fi = null; this.fiRate = null; return; }
    this.syncRadarRv();
    this.loadFiRadar();
  }

  async loadFiRadar() {
    if (!this.on.rain || this.hour >= 0.5) return;
    const v = this.viewBox();
    const fi = FI_BOUNDS;
    if (v[2] < fi[0] || v[0] > fi[2] || v[3] < fi[1] || v[1] > fi[3]) return; // not over Finland
    const z = this.map.getZoom();
    // Zoomed out: all of Finland. Zoomed in: the view and a margin, sharper.
    let box = fi;
    if (z >= 7.5) {
      const px = (v[2] - v[0]) * 0.5, py = (v[3] - v[1]) * 0.5;
      box = [Math.max(fi[0], v[0] - px), Math.max(fi[1], v[1] - py), Math.min(fi[2], v[2] + px), Math.min(fi[3], v[3] + py)];
    }
    const c = this.fi;
    const inside = c && v[0] >= c.box[0] && v[2] <= c.box[2] && v[1] >= c.box[1] && v[3] <= c.box[3];
    // the all-Finland image serves every zoomed-out view; a zoomed-in one, views inside it
    if (c && (c.zoomed ? inside && z >= 7.5 : z < 7.5) && Date.now() - c.t < 5 * 60e3) return;
    if (this.fiLoading || Date.now() - (this.fiFailed || 0) < 60e3) return; // one try a minute after a failure
    this.fiLoading = true;
    try {
      // ~1 km per pixel, about the radar's own resolution: finer would just repeat
      // its cells (and let false echoes pass the speckle filter); the map smooths it
      const aspect = (my(box[1]) - my(box[3])) / (mx(box[2]) - mx(box[0]));
      const km = (box[2] - box[0]) * 111.32 * Math.cos((((box[1] + box[3]) / 2) * Math.PI) / 180);
      const width = Math.max(24, Math.min(1024, Math.round(km)));
      const height = Math.max(24, Math.min(2048, Math.round(width * Math.abs(aspect))));
      const img = await fmiRadar(box, width, height, (mmh) => ramp(RAIN_RAMP, mmh));
      if (!this.on.rain || this.hour >= 0.5) return;
      const full = box === fi;
      this.fi = { box, t: Date.now(), zoomed: z >= 7.5, rv: full }; // rv: RainViewer still needed around it
      this.app.setImage('wxRadarFi', img);
      this.fiRate = img.rateAt;
      this.renderLabels(); // the amounts at "now" are the radar's
      this.renderTime();
      this.buildField();
      this.syncRadarRv();
      clearTimeout(this.fiTimer);
      this.fiTimer = setTimeout(() => { if (this.fi) this.fi.t = 0; this.loadFiRadar(); }, 5 * 60e3); // new scans every 5 min
      this.fiFailed = 0;
    } catch {
      this.fiFailed = Date.now(); // RainViewer still shows; net.js has the notice
    } finally {
      this.fiLoading = false;
    }
  }

  syncRadarRv() {
    const v = this.viewBox();
    const c = this.fi;
    const covers = c && !c.rv && v[0] >= c.box[0] && v[2] <= c.box[2] && v[1] >= c.box[1] && v[3] <= c.box[3];
    this.app.setRadar(this.on.rain && this.hour < 0.5 && !covers ? this.radar || {} : null);
  }

  async loadRadarMeta() {
    if (this.radar && Date.now() - this.radar.t < 5 * 60 * 1000) return;
    try {
      const j = await request('rainviewer', 'https://api.rainviewer.com/public/weather-maps.json').then((r) => r.json());
      const last = j.radar.past[j.radar.past.length - 1];
      this.radar = { t: Date.now(), rv: `${j.host}${last.path}/512/{z}/{x}/{y}/2/1_1.png`, time: last.time };
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
      const radar = this.fiRate ? this.fiRate(cam.ll[2 * i], cam.ll[2 * i + 1]) : null;
      rain[i] = radar != null ? radar : s.rain;
      snow[i] = s.temp < 0.5 ? 1 : 0;
      if (rain[i] >= 0.05) wet++;
    }
    this.field = { vx, vy, rain, snow, wet: wet / n };
  }

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
      if (this.moving || !this.field) return;
      const f = this.field, cols = this.cam.cols;
      const cellAt = (x, y) => Math.round(y / CELL) * cols + Math.round(x / CELL);

      if (this.on.wind) {
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

      if (this.on.rain) this.drawPrecip(k, f, cellAt);
    };
    this.anim = requestAnimationFrame(tick);
  }

  // Falling rain streaks (slanted by the wind) and drifting snowflakes. How many
  // follows the rate: drizzle is a few short, faint streaks; from about 4 mm/h
  // it's the full shower (before, drizzle looked like pouring: four tries a drop
  // at a fixed 15 % floor filled the screen).
  drawPrecip(k, f, cellAt) {
    const ctx = this.rainCtx;
    ctx.clearRect(0, 0, this.W, this.H);
    if (f.wet <= 0) return;
    const n = Math.min(1600, Math.round((this.W * this.H) / 650));
    while (this.drops.length < n) this.drops.push({ age: 1, max: 0 });
    this.drops.length = n;
    const dark = this.app.dark();
    const spawn = (d) => {
      const x = Math.random() * this.W, y = Math.random() * this.H;
      const i = cellAt(x, y);
      const r = f.rain[i];
      // 0.1 mm/h ≈ 5 % of the drops, 1 mm/h ≈ 33 %, 2 mm/h ≈ 57 %, 4 mm/h and up: all
      if (r >= 0.05 && Math.random() < Math.min(1, Math.max(0.02, r / 4) ** 0.8)) {
        d.x = x; d.y = y; d.age = 0; d.snow = !!f.snow[i]; d.light = r < 1;
        d.max = d.snow ? 90 + Math.random() * 90 : 18 + Math.random() * 22;
        d.len = (r < 1 ? 3.5 : r < 4 ? 6 : 8) + Math.random() * 4;
        d.fall = d.snow ? 0.7 + Math.random() * 0.6 : (r < 1 ? 5.5 : 7) + Math.random() * 4;
        d.phase = Math.random() * 6.28;
        return true;
      }
      d.age = 0; d.max = 4 + Math.random() * 10; d.x = -1; // dormant: try again soon
      return false;
    };
    ctx.lineCap = 'round';
    const heavy = new Path2D(), light = new Path2D();
    const flakes = [];
    for (const d of this.drops) {
      if ((d.age += k) > d.max) { spawn(d); continue; }
      if (d.x < 0) continue;
      const i = cellAt(d.x, d.y);
      const wx = (f.vx[i] || 0) * (d.snow ? 2 : 3);
      if (d.snow) {
        d.x += (wx + Math.sin(d.phase + d.age * 0.08) * 0.4) * k;
        d.y += d.fall * k;
        flakes.push(d);
      } else {
        const dx = wx * 1.5, dy = d.fall;
        const l = d.len / Math.hypot(dx, dy);
        const path = d.light ? light : heavy;
        path.moveTo(d.x, d.y);
        path.lineTo(d.x - dx * l, d.y - dy * l);
        d.x += dx * k; d.y += dy * k;
      }
      if (d.y > this.H || d.x < 0 || d.x > this.W) d.age = d.max + 1;
    }
    // drizzle and light rain fainter and thinner than a real shower
    ctx.lineWidth = 1;
    ctx.strokeStyle = dark ? 'rgba(186,230,253,0.45)' : 'rgba(29,78,216,0.32)';
    ctx.stroke(light);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = dark ? 'rgba(186,230,253,0.8)' : 'rgba(29,78,216,0.6)';
    ctx.stroke(heavy);
    if (flakes.length) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.4)' : 'rgba(51,65,85,0.55)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (const d of flakes) { ctx.moveTo(d.x + 1.8, d.y); ctx.arc(d.x, d.y, 1.8, 0, Math.PI * 2); }
      ctx.fill();
      ctx.stroke();
    }
  }

  // Remove what the switched-off layers drew (images, labels, particles).
  clearLayers() {
    if (!this.on.wind) { this.clearCanvas(this.windCtx, this.windCv); this.windCv.hidden = true; }
    if (!this.on.rain) { this.clearCanvas(this.rainCtx, this.rainCv); this.rainCv.hidden = true; }
    if (!this.on.temp && !this.on.wind) this.app.setImage('wxField', null);
    if (!this.on.snow) this.app.setImage('wxSnow', null);
    if (!this.on.rain) { this.app.setImage('wxRain', null); this.app.setRadar(null); this.app.setImage('wxRadarFi', null); this.fi = null; this.fiRate = null; }
    if (!this.layersOn) this.app.setData('wxLabels', { type: 'FeatureCollection', features: [] });
  }

  // Nothing needs the clock running: stop playback and the animation loop.
  stopClock() {
    this.playing = false;
    this.syncPlay();
    cancelAnimationFrame(this.anim);
    this.anim = 0;
  }

  stop() { this.on = { wind: false, temp: false, rain: false, snow: false }; this.clearLayers(); this.stopClock(); }

  // ------------------------------------------------------------------ time bar
  buildBar() {
    const bar = document.getElementById('wx-bar');
    this.bar = bar;
    bar.hidden = true;
    this.playBtn = h('button', { type: 'button', class: 'tool', 'aria-label': 'Play forecast', onclick: () => this.togglePlay(), html: icon('play', 18) });
    this.slider = h('input', { type: 'range', min: '0', max: String(HOURS), step: '1', value: '0', 'aria-label': 'Time, hours from now', oninput: (e) => { this.playing = false; this.syncPlay(); this.setHour(+e.target.value); } });
    this.timeEl = h('div', { class: 'wx-time' });
    this.legendEl = h('div', { class: 'wx-legend' });
    this.readEl = h('div', { class: 'wx-read' });
    // weather layers right on the timeline
    this.chipsEl = h('div', { class: 'chips tl-layers', role: 'group', 'aria-label': 'Weather layers' },
      ...[['wind', 'wind', 'Wind'], ['temp', 'temp', 'Temperature'], ['rain', 'rain', 'Rain'], ['snow', 'snow', 'Snow']].map(([k, ic, label]) =>
        h('button', { type: 'button', class: 'chip', 'data-k': k, 'aria-pressed': 'false', onclick: () => this.app.onToggle({ [k]: !this.on[k] }), html: `${icon(ic, 14)}${label}` })));
    this.noteEl = h('div', { class: 'tl-note' });
    this.stripCv = h('canvas', { class: 'tl-strip', role: 'img', 'aria-label': '48-hour forecast here: temperature, rain and wind. Drag to change the time.' });
    this.nowEl = h('div', { class: 'tl-now' });
    this.bindStrip();
    bar.append(
      h('div', { class: 'tl-head' },
        h('span', { class: 'tl-title', html: `${icon('clock', 15)} Timeline` }),
        this.chipsEl,
        h('button', { type: 'button', class: 'tool tl-close', 'aria-label': 'Close timeline', onclick: () => this.app.onClose(), html: icon('close', 16) })),
      h('div', { class: 'tl-main' }, this.stripCv, this.nowEl),
      h('div', { class: 'wx-row' }, this.playBtn, this.slider, this.timeEl),
      this.infoEl = h('div', { class: 'wx-row wx-info', hidden: true }, this.legendEl, this.readEl),
      this.noteEl,
    );
    new ResizeObserver(() => this.renderStrip()).observe(this.stripCv);
    this.bindFloat();
  }

  renderChips() {
    if (!this.chipsEl) return;
    for (const b of this.chipsEl.children) b.setAttribute('aria-pressed', String(!!this.on[b.dataset.k]));
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
    const accent = css.getPropertyValue('--route').trim() || '#e11d48';
    const d = this.stripSeries();
    const PAD = 9; // matches the range thumb so strip and slider line up
    const X = (hr) => PAD + (hr / HOURS) * (W - 2 * PAD);
    ctx.font = '10px system-ui, sans-serif';
    if (!d) { ctx.fillStyle = muted; ctx.fillText(this.loading ? 'Loading the forecast…' : 'Zoom in to see the forecast here', PAD, H / 2); return; }
    // night
    ctx.fillStyle = this.app.dark() || matchMedia('(prefers-color-scheme: dark)').matches ? 'rgba(0,0,0,0.28)' : 'rgba(30,41,59,0.07)';
    for (let hr = 0; hr < HOURS; hr++) {
      if (sunAltitude(d.lat, d.lon, (d.t[hr] + d.t[hr + 1]) / 2) < -0.8) ctx.fillRect(X(hr), 0, X(hr + 1) - X(hr) + 0.5, H);
    }
    // your ride, from departure to arrival
    const ride = this.app.routeHours && this.app.routeHours();
    if (ride > 0) {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.16;
      ctx.fillRect(X(this.hour), 0, Math.max(3, X(Math.min(HOURS, this.hour + ride)) - X(this.hour)), H);
      ctx.globalAlpha = 1;
      ctx.fillRect(X(this.hour), H - 3, Math.max(3, X(Math.min(HOURS, this.hour + ride)) - X(this.hour)), 3);
    }
    // rain bars
    const top = 14, bottom = H - 14;
    for (let hr = 0; hr < HOURS; hr++) {
      const r = (d.rain[hr] + d.rain[hr + 1]) / 2;
      if (r < 0.05) continue;
      const bh = Math.min(1, r / 3) * (bottom - top) * 0.75 + 2;
      ctx.fillStyle = (d.temp[hr] < 0.5 ? 'rgba(167,139,250,' : 'rgba(59,130,246,') + Math.min(0.9, 0.35 + r / 4) + ')';
      ctx.fillRect(X(hr) + 0.5, bottom - bh, X(hr + 1) - X(hr) - 1, bh);
    }
    // temperature line
    let tMin = Math.min(...d.temp), tMax = Math.max(...d.temp);
    if (tMax - tMin < 4) { const m = (tMax + tMin) / 2; tMin = m - 2; tMax = m + 2; }
    const Y = (t) => top + 4 + (1 - (t - tMin) / (tMax - tMin)) * (bottom - top - 14);
    ctx.beginPath();
    d.temp.forEach((t, hr) => { const x = X(hr), y = Y(t); if (hr) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // labels at the warmest / coldest hour
    const iMax = d.temp.indexOf(Math.max(...d.temp)), iMin = d.temp.indexOf(Math.min(...d.temp));
    ctx.fillStyle = '#c2410c';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(d.temp[iMax])}°`, Math.min(W - 12, Math.max(12, X(iMax))), Y(d.temp[iMax]) - 4);
    if (iMin !== iMax) ctx.fillText(`${Math.round(d.temp[iMin])}°`, Math.min(W - 12, Math.max(12, X(iMin))), Math.min(bottom, Y(d.temp[iMin]) + 11));
    // wind arrows every 3 h
    ctx.strokeStyle = muted;
    ctx.fillStyle = muted;
    for (let hr = 0; hr <= HOURS; hr += 3) {
      const x = X(hr), y = 7, a = ((d.dir[hr] + 180) * Math.PI) / 180, l = Math.min(6, 2.5 + d.speed[hr] / 2);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.lineWidth = d.speed[hr] > 8 ? 1.8 : 1.1;
      ctx.beginPath(); ctx.moveTo(0, l); ctx.lineTo(0, -l); ctx.moveTo(-2.4, -l + 2.6); ctx.lineTo(0, -l); ctx.lineTo(2.4, -l + 2.6); ctx.stroke();
      ctx.restore();
    }
    // day ticks and labels
    ctx.textAlign = 'left';
    ctx.fillStyle = muted;
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    // hour labels every 6 h, or only at noon when the strip is narrow (phones)
    const every = (X(HOURS) - X(0)) / HOURS * 6 < 34 ? 12 : 6;
    for (let hr = 1; hr <= HOURS; hr++) {
      const dt = new Date(d.t[hr] * 1000);
      if (dt.getHours() === 0) {
        ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(X(hr), 0); ctx.lineTo(X(hr), H); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillText(dt.toLocaleDateString([], { weekday: 'short' }), X(hr) + 3, H - 4);
      } else if (dt.getHours() % every === 0 && X(hr) > 30) {
        ctx.fillText(String(dt.getHours()), X(hr) - 4, H - 4);
      }
    }
    ctx.fillText('Now', 2, H - 4);
    // cursor
    const cx = X(this.hour);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
    const ti = Math.min(HOURS, Math.round(this.hour));
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.arc(cx, Y(d.temp[ti]), 3.2, 0, Math.PI * 2); ctx.fill();
  }

  bindStrip() {
    const cv = this.stripCv;
    let down = false;
    const at = (e) => {
      const r = cv.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - r.left - 9) / (r.width - 18)));
      this.playing = false;
      this.syncPlay();
      this.setHour(Math.round(x * HOURS));
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

  // `silent`: change came from the route's departure picker, don't echo back
  setHour(hr, { silent = false } = {}) {
    this.hour = Math.max(0, Math.min(HOURS, hr));
    this.slider.value = String(Math.round(this.hour));
    if (this.grid) this.applyHour(); else this.renderTime();
    this.readout();
    if (!silent) this.emitHour();
  }

  // Tell the app (and so the planner) whenever the whole hour changes.
  emitHour() {
    const k = Math.round(this.hour);
    if (k === this.lastEmit) return;
    this.lastEmit = k;
    if (this.app.onHour) this.app.onHour(k);
  }

  togglePlay() {
    this.playing = !this.playing;
    if (this.playing && this.hour >= HOURS) this.hour = 0;
    this.syncPlay();
    if (!this.anim) this.startAnim();
  }
  syncPlay() {
    if (!this.playBtn) return;
    this.playBtn.innerHTML = icon(this.playing ? 'pause' : 'play', 18);
    this.playBtn.setAttribute('aria-label', this.playing ? 'Pause' : 'Play forecast');
  }

  advancePlay(k = 1) {
    const next = this.hour + k / 60; // ~1 s per forecast hour
    if (next >= HOURS) { this.playing = false; this.syncPlay(); }
    this.hour = Math.min(HOURS, next);
    this.slider.value = String(Math.round(this.hour));
    this.applyHour();
    this.emitHour();
  }

  // the view's centre in Finland: FMI's radar draws "now" there (its image may still be on the way)
  inFinland() {
    const c = this.map.getCenter();
    return c.lng >= FI_BOUNDS[0] && c.lng <= FI_BOUNDS[2] && c.lat >= FI_BOUNDS[1] && c.lat <= FI_BOUNDS[3];
  }

  renderTime() {
    if (!this.timeEl) return;
    const t = new Date(timeAtHour(this.hour) * 1000);
    const day = t.toLocaleDateString([], { weekday: 'short' });
    const clock = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let label = this.hour < 0.5 ? `Now · ${clock}` : `${day} ${clock} · +${Math.round(this.hour)} h`;
    if (this.on.rain && this.hour < 0.5) label += this.fi || (this.inFinland() && !this.fiFailed) ? ' · FMI radar' : ' · radar';
    if (this.loading) label += ' · loading…';
    this.timeEl.textContent = label;
    // linked with the route's departure time
    const route = !!(this.app.hasRoute && this.app.hasRoute());
    this.timeEl.title = route ? 'Also the departure time of your route' : '';
    this.timeEl.classList.toggle('linked', route);
    if (this.noteEl) {
      const g = this.grid;
      const st = sourceStatus('openmeteo');
      const problem = this.status && !this.loading ? this.status
        : g && g.stale ? `Showing the forecast from ${hhmm(g.from)} — Open-Meteo couldn’t be reached${st ? `; trying again at ${hhmm(st.until)}` : ''}.` : null;
      this.noteEl.classList.toggle('warn', !!problem);
      this.noteEl.textContent = problem ? `⚠ ${problem}`
        : this.docked ? 'This is your departure: drag the strip or press play. The shaded band is your ride; road works and road conditions follow this time too.'
          : route ? 'Also your route’s departure — the shaded band is your ride. Road works and road conditions follow this time too.' : 'Also sets road works and road conditions, and the departure of a planned route.';
    }
    if (this.app.onTime) this.app.onTime(this.hour);
  }

  renderLegend() {
    const parts = [];
    if (this.on.temp) parts.push(['°C', TEMP_RAMP]);
    else if (this.on.wind) parts.push(['m/s', WIND_RAMP]);
    if (this.on.rain) parts.push(['mm/h', RAIN_RAMP]);
    if (this.on.snow) parts.push(['cm snow', SNOW_RAMP]);
    const key = parts.map((p) => p[0]).join();
    if (key === this.legendKey) return;
    this.legendKey = key;
    this.legendEl.innerHTML = '';
    for (const [unit, stops] of parts) {
      this.legendEl.append(h('span', { class: 'wx-lg' },
        h('i', { style: `background:${rampCss(stops)}` }),
        h('small', {}, `${stops[0][0]}–${stops[stops.length - 1][0]} ${unit}`)));
    }
  }

  // The weather card beside the strip: the selected time at the spot under the
  // mouse (or the map centre). At most once per frame.
  readout() {
    if (this.readFrame) return;
    this.readFrame = requestAnimationFrame(() => {
      this.readFrame = 0;
      if (!this.active || !this.nowEl) return;
      this.renderLegend();
      this.infoEl.hidden = !this.legendKey;
      const ll = this.pointerLL || this.map.getCenter().toArray();
      const s = this.sample(ll);
      if (!s) {
        this.nowEl.innerHTML = `<small>${this.loading ? 'Loading forecast…' : this.status || 'No forecast here'}</small>`;
        return;
      }
      const night = sunAltitude(ll[1], ll[0], this.cur.t) < -3;
      const snow = s.temp < 0.5;
      const kind = s.rain >= 0.1 ? (snow ? 'snow' : 'rain')
        : !(s.cloud >= 0) ? (night ? 'moon' : 'cloudSun')
          : s.cloud >= 70 ? 'cloud' : s.cloud >= 25 ? (night ? 'cloud' : 'cloudSun') : night ? 'moon' : 'sun';
      const sky = { snow: 'Snow', rain: 'Rain', cloud: 'Cloudy', cloudSun: 'Partly cloudy', moon: 'Clear', sun: 'Sunny' }[kind];
      const sum = this.accum(ll, 6);
      const rainTxt = s.rain >= 0.05 ? `${s.rain.toFixed(1)} mm/h` : 'dry';
      const gust = s.gust > s.speed + 2 ? ` <span>gusts ${s.gust.toFixed(0)}</span>` : '';
      this.nowEl.title = `${sky} · ${this.pointerLL ? 'under the mouse' : 'at the map centre'}`;
      this.nowEl.innerHTML =
        `<div class="tl-now-main">${icon(kind, 24)}<b>${Math.round(s.temp)}°</b><small>${this.pointerLL ? 'here' : 'map centre'}</small></div>` +
        `<div><svg class="tl-arrow" viewBox="0 0 12 12" style="transform:rotate(${(s.dir + 180) % 360}deg)" aria-hidden="true"><path d="M6 1 10 10 6 8 2 10Z"/></svg>${s.speed < 0.5 ? 'calm' : `${s.speed.toFixed(s.speed < 3 ? 1 : 0)} m/s ${compass(s.dir)}`}${gust}</div>` +
        `<div>${icon('drop', 12)}${rainTxt}${sum != null && sum >= 0.05 ? ` <span>· 6 h ${sum.toFixed(1)} mm</span>` : ''}</div>` +
        (this.on.snow && Number.isFinite(s.snow) ? `<div>${icon('snow', 12)}${s.snow >= 1 ? `${Math.round(s.snow)} cm of snow` : 'no snow'}</div>` : '');
    });
  }
}
