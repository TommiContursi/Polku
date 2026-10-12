// Weather overlay in the spirit of windy.app: animated wind particles, falling
// rain / snow, a wind-speed or temperature field, rain radar and a 48 h time
// slider. Data: Open-Meteo on a grid over the view; FMI radar in Finland,
// RainViewer elsewhere.
//
// Performance: the expensive part is mapping screen pixels to geography. That
// happens once per camera stop (moveend) into a coarse cell cache; while the map
// moves the particles simply pause and fade out, and forecast playback only
// re-samples the grid. Particle canvases render at 1× pixel density.

import { forecastPoints } from './weather.js';
import { compass } from './geo.js';
import { h, icon } from './ui.js';

const COLS = 9;
const ROWS = 9;
const IMG = 72; // field image resolution
const HOURS = 48;
const CELL = 24; // px, screen cache resolution

const WIND_RAMP = [[0, '#3b82f6'], [3, '#22d3ee'], [6, '#4ade80'], [9, '#facc15'], [12, '#fb923c'], [16, '#ef4444'], [22, '#a855f7']];
const TEMP_RAMP = [[-25, '#7c3aed'], [-15, '#2563eb'], [-5, '#38bdf8'], [0, '#e0f2fe'], [5, '#a7f3d0'], [10, '#fde047'], [18, '#fb923c'], [25, '#ef4444'], [32, '#9f1239']];
export const RAIN_RAMP = [[0.1, '#93c5fd'], [0.5, '#3b82f6'], [2, '#1d4ed8'], [5, '#7c3aed'], [10, '#db2777']];
export { TEMP_RAMP };

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

// Web Mercator helpers (0..1 world units)
const mx = (lon) => (lon + 180) / 360;
const my = (lat) => { const s = Math.sin((lat * Math.PI) / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
const lonOf = (x) => x * 360 - 180;
const latOf = (y) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

export class WeatherOverlay {
  constructor(map, app) {
    this.map = map;
    this.app = app; // { setImage(id, img|null), setRadar(r|null), setData(id, fc), dark() }
    this.on = { wind: false, temp: false, rain: false };
    this.hour = 0;
    this.grid = null;
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
    map.on('mousemove', (e) => this.readout([e.lngLat.lng, e.lngLat.lat]));
    // touch screens have no hover: read out the map centre instead
    map.on('touchend', () => this.readout(this.map.getCenter().toArray()));
  }

  get active() { return this.on.wind || this.on.temp || this.on.rain; }
  get animated() { return this.on.wind || this.on.rain; }

  set(layers) {
    Object.assign(this.on, layers);
    this.bar.hidden = !this.active;
    this.windCv.hidden = !this.on.wind;
    this.rainCv.hidden = !this.on.rain;
    if (!this.active) { this.stop(); return; }
    this.renderLegend();
    if (this.grid) { this.buildCam(); this.applyHour(true); }
    this.maybeFetch();
    if (this.animated) this.startAnim();
    if (this.on.rain) this.loadRadarMeta();
  }

  onMoveStart() {
    if (!this.animated) return;
    this.moving = true;
    this.windCv.classList.add('wx-hide');
    this.rainCv.classList.add('wx-hide');
  }

  onMoveEnd() {
    this.moving = false;
    if (!this.active) return;
    this.maybeFetch();
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

  covers(box) {
    if (!this.grid) return false;
    const g = this.grid.box;
    const zoomOk = Math.abs(this.grid.zoom - this.map.getZoom()) < 1.6;
    return zoomOk && box[0] >= g[0] && box[2] <= g[2] && box[1] >= g[1] && box[3] <= g[3] && Date.now() - this.grid.t < 30 * 60 * 1000;
  }

  async maybeFetch() {
    if (!this.active || this.map.getZoom() < 3) return;
    const box = this.viewBox();
    if (this.covers(box)) return;
    const padX = (box[2] - box[0]) * 0.25, padY = (box[3] - box[1]) * 0.25;
    const w = box[0] - padX, e = box[2] + padX, s = Math.max(-80, box[1] - padY), n = Math.min(80, box[3] + padY);
    const x0 = mx(w), x1 = mx(e), y0 = my(n), y1 = my(s);
    const pts = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        pts.push([lonOf(x0 + ((x1 - x0) * c) / (COLS - 1)), latOf(y0 + ((y1 - y0) * r) / (ROWS - 1))]);
      }
    }
    const req = (this.req = Symbol('wx'));
    this.loading = true;
    this.renderTime();
    try {
      const series = await forecastPoints(pts, HOURS + 1);
      if (req !== this.req) return;
      this.grid = { box: [w, s, e, n], merc: [x0, y0, x1, y1], pts, series, zoom: this.map.getZoom(), t: Date.now(), time0: Date.now() / 1000 };
      if (!this.cam) this.buildCam();
      this.applyHour(true);
    } catch {
      this.status = 'Weather unavailable';
    } finally {
      if (req === this.req) { this.loading = false; this.renderTime(); }
    }
  }

  // Interpolate every grid point to the selected hour.
  applyHour(images = false) {
    const g = this.grid;
    if (!g) return;
    const t = g.time0 + this.hour * 3600;
    const N = COLS * ROWS;
    const u = new Float32Array(N), v = new Float32Array(N), gust = new Float32Array(N), temp = new Float32Array(N), rain = new Float32Array(N);
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
      gust[k] = lin(s.gust); temp[k] = lin(s.temp); rain[k] = lin(s.precip);
    }
    this.cur = { u, v, gust, temp, rain, t, i, f };
    this.buildField();
    if (images || Math.abs((this.lastImgHour ?? -9) - this.hour) >= 0.25) {
      this.lastImgHour = this.hour;
      this.renderImages();
    }
    this.renderTime();
  }

  // Bilinear weights of a location on the forecast grid.
  weights(lngLat) {
    const g = this.grid;
    if (!g) return null;
    const [x0, y0, x1, y1] = g.merc;
    const gx = ((mx(lngLat[0]) - x0) / (x1 - x0)) * (COLS - 1);
    const gy = ((my(lngLat[1]) - y0) / (y1 - y0)) * (ROWS - 1);
    if (!(gx >= 0 && gy >= 0 && gx <= COLS - 1 && gy <= ROWS - 1)) return null;
    const cx = Math.min(COLS - 2, Math.floor(gx)), cy = Math.min(ROWS - 2, Math.floor(gy));
    const tx = gx - cx, ty = gy - cy;
    const k = cy * COLS + cx;
    return [[k, (1 - tx) * (1 - ty)], [k + 1, tx * (1 - ty)], [k + COLS, (1 - tx) * ty], [k + COLS + 1, tx * ty]];
  }

  sample(lngLat) {
    const c = this.cur;
    const w = c && this.weights(lngLat);
    if (!w) return null;
    const at = (arr) => w.reduce((s, [k, wt]) => s + arr[k] * wt, 0);
    const u = at(c.u), v = at(c.v);
    return { u, v, speed: Math.hypot(u, v), gust: at(c.gust), temp: at(c.temp), rain: at(c.rain), dir: ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360 };
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
    const forecastRain = this.on.rain && this.hour >= 0.5;
    this.app.setImage('wxRain', forecastRain ? draw((s) => (s.rain < 0.05 ? null : [...ramp(RAIN_RAMP, s.rain), Math.round(Math.min(235, 150 + s.rain * 45))])) : null);
    this.app.setRadar(this.on.rain && this.hour < 0.5 ? this.radar || {} : null);
    // labels: °C on a sparse grid, and precipitation amounts where it rains
    const feats = [];
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        const k = r * COLS + c;
        if (this.on.temp) feats.push({ type: 'Feature', properties: { kind: 'temp', t: `${Math.round(this.cur.temp[k])}°` }, geometry: { type: 'Point', coordinates: g.pts[k] } });
        const rr = this.cur.rain[k];
        if (this.on.rain && rr >= 0.1) {
          const snow = this.cur.temp[k] < 0.5;
          feats.push({ type: 'Feature', properties: { kind: 'rain', t: `${snow ? 'snow ' : ''}${rr < 1 ? rr.toFixed(1) : Math.round(rr)} mm/h` }, geometry: { type: 'Point', coordinates: g.pts[k] } });
        }
      }
    }
    this.app.setData('wxLabels', { type: 'FeatureCollection', features: feats });
  }

  async loadRadarMeta() {
    if (this.radar && Date.now() - this.radar.t < 5 * 60 * 1000) return;
    try {
      const j = await fetch('https://api.rainviewer.com/public/weather-maps.json').then((r) => r.json());
      const last = j.radar.past[j.radar.past.length - 1];
      this.radar = { t: Date.now(), rv: `${j.host}${last.path}/512/{z}/{x}/{y}/2/1_1.png`, time: last.time };
    } catch {
      this.radar = { t: Date.now() };
    }
    if (this.on.rain && this.hour < 0.5) this.app.setRadar(this.radar);
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
      rain[i] = s.rain;
      snow[i] = s.temp < 0.5 ? 1 : 0;
      if (s.rain >= 0.05) wet++;
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

  // Falling rain streaks (slanted by the wind) and drifting snowflakes, denser
  // where more precipitation is forecast.
  drawPrecip(k, f, cellAt) {
    const ctx = this.rainCtx;
    ctx.clearRect(0, 0, this.W, this.H);
    if (f.wet <= 0) return;
    const n = Math.min(1600, Math.round((this.W * this.H) / 650));
    while (this.drops.length < n) this.drops.push({ age: 1, max: 0 });
    this.drops.length = n;
    const dark = this.app.dark();
    const spawn = (d) => {
      for (let tries = 0; tries < 4; tries++) {
        const x = Math.random() * this.W, y = Math.random() * this.H;
        const i = cellAt(x, y);
        const r = f.rain[i];
        if (r >= 0.05 && Math.random() < Math.min(1, 0.15 + r / 1.5)) {
          d.x = x; d.y = y; d.age = 0; d.snow = !!f.snow[i];
          d.max = d.snow ? 90 + Math.random() * 90 : 18 + Math.random() * 22;
          d.len = 6 + Math.random() * 6;
          d.fall = d.snow ? 0.7 + Math.random() * 0.6 : 7 + Math.random() * 4;
          d.phase = Math.random() * 6.28;
          return true;
        }
      }
      d.age = 0; d.max = 4 + Math.random() * 10; d.x = -1; // dormant: try again soon
      return false;
    };
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = dark ? 'rgba(186,230,253,0.75)' : 'rgba(29,78,216,0.55)';
    ctx.beginPath();
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
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - dx * l, d.y - dy * l);
        d.x += dx * k; d.y += dy * k;
      }
      if (d.y > this.H || d.x < 0 || d.x > this.W) d.age = d.max + 1;
    }
    ctx.stroke();
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

  stop() {
    this.playing = false;
    this.syncPlay();
    cancelAnimationFrame(this.anim);
    this.anim = 0;
    this.clearCanvas(this.windCtx, this.windCv);
    this.clearCanvas(this.rainCtx, this.rainCv);
    this.windCv.hidden = true;
    this.rainCv.hidden = true;
    this.app.setImage('wxField', null);
    this.app.setImage('wxRain', null);
    this.app.setRadar(null);
    this.app.setData('wxLabels', { type: 'FeatureCollection', features: [] });
  }

  // ------------------------------------------------------------------ time bar
  buildBar() {
    const bar = document.getElementById('wx-bar');
    this.bar = bar;
    this.playBtn = h('button', { type: 'button', class: 'tool', 'aria-label': 'Play forecast', onclick: () => this.togglePlay(), html: icon('play', 18) });
    this.slider = h('input', { type: 'range', min: '0', max: String(HOURS), step: '1', value: '0', 'aria-label': 'Forecast hour', oninput: (e) => { this.playing = false; this.syncPlay(); this.setHour(+e.target.value); } });
    this.timeEl = h('div', { class: 'wx-time' });
    this.legendEl = h('div', { class: 'wx-legend' });
    this.readEl = h('div', { class: 'wx-read' });
    bar.append(h('div', { class: 'wx-row' }, this.playBtn, this.slider, this.timeEl), h('div', { class: 'wx-row wx-info' }, this.legendEl, this.readEl));
  }

  setHour(hr) {
    this.hour = Math.max(0, Math.min(HOURS, hr));
    this.slider.value = String(Math.round(this.hour));
    this.applyHour();
    this.readout();
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
  }

  renderTime() {
    if (!this.timeEl) return;
    const t = new Date(((this.grid ? this.grid.time0 : Date.now() / 1000) + this.hour * 3600) * 1000);
    const day = t.toLocaleDateString([], { weekday: 'short' });
    const clock = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let label = this.hour < 0.5 ? `Now · ${clock}` : `${day} ${clock} · +${Math.round(this.hour)} h`;
    if (this.on.rain && this.hour < 0.5) label += ' · radar';
    if (this.loading) label += ' · loading…';
    this.timeEl.textContent = label;
  }

  renderLegend() {
    const parts = [];
    if (this.on.temp) parts.push(['°C', TEMP_RAMP]);
    else if (this.on.wind) parts.push(['m/s', WIND_RAMP]);
    if (this.on.rain) parts.push(['mm/h', RAIN_RAMP]);
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

  readout(lngLat) {
    if (!this.active || !this.readEl) return;
    const ll = lngLat || this.lastLL || this.map.getCenter().toArray();
    this.lastLL = ll;
    this.renderLegend();
    const s = this.sample(ll);
    if (!s) { this.readEl.textContent = ''; return; }
    const parts = [];
    if (this.on.wind) parts.push(`${s.speed.toFixed(1)} m/s ${compass(s.dir)}${s.gust > s.speed + 2 ? ` (gusts ${s.gust.toFixed(0)})` : ''}`);
    if (this.on.temp || this.on.wind) parts.push(`${s.temp.toFixed(0)} °C`);
    if (this.on.rain) {
      const kind = s.temp < 0.5 ? 'snow' : 'rain';
      parts.push(s.rain >= 0.05 ? `${kind} ${s.rain.toFixed(1)} mm/h` : 'dry');
      const sum = this.accum(ll, 6);
      if (sum != null) parts.push(`next 6 h ${sum < 0.05 ? '0' : sum.toFixed(1)} mm`);
    }
    this.readEl.textContent = `Here: ${parts.join(' · ')}`;
  }
}
