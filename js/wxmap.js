// Weather overlay in the spirit of windy.app: animated wind particles, a
// wind-speed or temperature field, rain (radar now, forecast later) and a 48 h
// time slider. Data: Open-Meteo on a grid over the view; FMI radar in Finland,
// RainViewer elsewhere.

import { forecastPoints } from './weather.js';
import { compass } from './geo.js';
import { h, icon } from './ui.js';

const COLS = 9;
const ROWS = 9;
const IMG = 72; // field image resolution
const HOURS = 48;

const WIND_RAMP = [[0, '#3b82f6'], [3, '#22d3ee'], [6, '#4ade80'], [9, '#facc15'], [12, '#fb923c'], [16, '#ef4444'], [22, '#a855f7']];
const TEMP_RAMP = [[-25, '#7c3aed'], [-15, '#2563eb'], [-5, '#38bdf8'], [0, '#e0f2fe'], [5, '#a7f3d0'], [10, '#fde047'], [18, '#fb923c'], [25, '#ef4444'], [32, '#9f1239']];
const RAIN_RAMP = [[0.1, '#93c5fd'], [0.5, '#3b82f6'], [2, '#1d4ed8'], [5, '#7c3aed'], [10, '#db2777']];

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
function ramp(stops, v) {
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
const rampCss = (stops) => `linear-gradient(90deg, ${stops.map(([, c], i) => `${c} ${(i / (stops.length - 1)) * 100}%`).join(', ')})`;

// Web Mercator helpers (0..1 world units)
const mx = (lon) => (lon + 180) / 360;
const my = (lat) => { const s = Math.sin((lat * Math.PI) / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
const lonOf = (x) => x * 360 - 180;
const latOf = (y) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

export class WeatherOverlay {
  constructor(map, app) {
    this.map = map;
    this.app = app; // { setImage(id, {url, coordinates}|null), setData(id, fc), refreshStyle(), dark() }
    this.on = { wind: false, temp: false, rain: false };
    this.hour = 0;
    this.grid = null;
    this.cur = null;
    this.loading = false;
    this.playing = false;
    this.particles = [];
    this.field = null;
    this.moving = false;
    this.buildCanvas();
    this.buildBar();
    map.on('moveend', () => this.maybeFetch());
    map.on('movestart', () => { this.moving = true; });
    map.on('moveend', () => { this.moving = false; this.screenField(); this.clearTrails(); });
    map.on('move', () => { this.needField = true; });
    map.on('resize', () => this.resizeCanvas());
    map.on('mousemove', (e) => this.readout([e.lngLat.lng, e.lngLat.lat]));
    // touch screens have no hover: read out the map centre instead
    map.on('touchend', () => this.readout(this.map.getCenter().toArray()));
  }

  get active() { return this.on.wind || this.on.temp || this.on.rain; }

  set(layers) {
    Object.assign(this.on, layers);
    this.bar.hidden = !this.active;
    this.canvas.hidden = !this.on.wind;
    if (!this.active) { this.stop(); return; }
    this.renderLegend();
    if (this.grid) this.applyHour(true);
    this.maybeFetch();
    this.startAnim();
    if (this.on.rain) this.loadRadarMeta();
  }

  // ------------------------------------------------------------------ data
  viewBox() {
    const b = this.map.getBounds();
    let s = Math.max(-80, b.getSouth()), n = Math.min(80, b.getNorth());
    let w = b.getWest(), e = b.getEast();
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
    const u = new Float32Array(N), v = new Float32Array(N), spd = new Float32Array(N), gust = new Float32Array(N), temp = new Float32Array(N), rain = new Float32Array(N), dir = new Float32Array(N);
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
      u[k] = (ux / len) * sp; v[k] = (vy / len) * sp; spd[k] = sp;
      dir[k] = ((Math.atan2(-ux, -vy) * 180) / Math.PI + 360) % 360;
      gust[k] = lin(s.gust); temp[k] = lin(s.temp); rain[k] = lin(s.precip);
    }
    this.cur = { u, v, spd, gust, temp, rain, dir, t };
    this.screenField();
    if (images || Math.abs((this.lastImgHour ?? -9) - this.hour) >= 0.25) {
      this.lastImgHour = this.hour;
      this.renderImages();
    }
    this.renderTime();
  }

  sample(lngLat) {
    const g = this.grid, c = this.cur;
    if (!g || !c) return null;
    const [x0, y0, x1, y1] = g.merc;
    const gx = ((mx(lngLat[0]) - x0) / (x1 - x0)) * (COLS - 1);
    const gy = ((my(lngLat[1]) - y0) / (y1 - y0)) * (ROWS - 1);
    if (gx < 0 || gy < 0 || gx > COLS - 1 || gy > ROWS - 1) return null;
    const cx = Math.min(COLS - 2, Math.floor(gx)), cy = Math.min(ROWS - 2, Math.floor(gy));
    const tx = gx - cx, ty = gy - cy;
    const at = (arr) => {
      const a = arr[cy * COLS + cx], b = arr[cy * COLS + cx + 1], d = arr[(cy + 1) * COLS + cx], e = arr[(cy + 1) * COLS + cx + 1];
      return (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
    };
    const u = at(c.u), v = at(c.v);
    return { u, v, speed: Math.hypot(u, v), gust: at(c.gust), temp: at(c.temp), rain: at(c.rain), dir: ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360 };
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
          const lng = lonOf(x0 + ((x1 - x0) * (px + 0.5)) / IMG);
          const lat = latOf(y0 + ((y1 - y0) * (py + 0.5)) / IMG);
          const s = this.sample([lng, lat]);
          const o = (py * IMG + px) * 4;
          const rgba = s ? fn(s) : null;
          if (rgba) { img.data[o] = rgba[0]; img.data[o + 1] = rgba[1]; img.data[o + 2] = rgba[2]; img.data[o + 3] = rgba[3]; }
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
    // temperature labels on a sparse grid
    const feats = [];
    if (this.on.temp) {
      for (let r = 1; r < ROWS - 1; r++) {
        for (let c = 1; c < COLS - 1; c++) {
          const k = r * COLS + c;
          feats.push({ type: 'Feature', properties: { t: `${Math.round(this.cur.temp[k])}°` }, geometry: { type: 'Point', coordinates: g.pts[k] } });
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

  // ------------------------------------------------------------------ particles
  buildCanvas() {
    const cv = document.createElement('canvas');
    cv.className = 'wx-particles';
    cv.hidden = true;
    const host = this.map.getCanvasContainer();
    host.insertBefore(cv, this.map.getCanvas().nextSibling);
    this.canvas = cv;
    this.ctx = cv.getContext('2d');
    this.resizeCanvas();
  }

  resizeCanvas() {
    const r = this.map.getContainer().getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.canvas.style.width = `${r.width}px`;
    this.canvas.style.height = `${r.height}px`;
    this.dpr = dpr;
    this.W = r.width; this.H = r.height;
    this.needField = true;
  }

  // Screen-space velocity field (px/frame) on a coarse grid, rebuilt when the
  // camera or the hour changes. Handles rotation and pitch for free.
  screenField() {
    if (!this.on.wind || !this.cur) return;
    const CELL = 22;
    const cols = Math.ceil(this.W / CELL) + 1, rows = Math.ceil(this.H / CELL) + 1;
    const vx = new Float32Array(cols * rows), vy = new Float32Array(cols * rows), sp = new Float32Array(cols * rows);
    const horizon = this.map.getPitch() > 50 ? this.H * 0.25 : -1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * CELL, y = r * CELL;
        if (y < horizon) continue;
        const ll = this.map.unproject([x, y]);
        const s = this.sample([ll.lng, ll.lat]);
        if (!s || s.speed < 0.05) continue;
        const k = Math.cos((ll.lat * Math.PI) / 180) || 1;
        const step = 0.0015;
        const p2 = this.map.project([ll.lng + ((s.u / s.speed) * step) / k, ll.lat + (s.v / s.speed) * step]);
        const dx = p2.x - x, dy = p2.y - y;
        const len = Math.hypot(dx, dy) || 1;
        const v = 0.25 + s.speed * 0.13; // px per frame: constant on screen like windy
        const i = r * cols + c;
        vx[i] = (dx / len) * v; vy[i] = (dy / len) * v; sp[i] = s.speed;
      }
    }
    this.field = { cols, rows, CELL, vx, vy, sp };
    this.needField = false;
  }

  clearTrails() { this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }

  startAnim() {
    if (this.anim) return;
    const count = () => Math.min(2400, Math.round((this.W * this.H) / 750));
    const spawn = (p) => { p.x = Math.random() * this.W; p.y = Math.random() * this.H; p.age = 0; p.max = 40 + Math.random() * 80; return p; };
    let last = performance.now();
    const tick = (now) => {
      this.anim = requestAnimationFrame(tick);
      // speeds are tuned for 60 fps; scale by real frame time (120 Hz screens, dropped frames)
      const k = Math.min(3, Math.max(0.25, (now - last) / 16.7));
      last = now;
      if (this.playing) this.advancePlay(k);
      if (!this.on.wind) return;
      if (this.needField) this.screenField();
      const f = this.field;
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      // fade trails (clear completely while the camera moves to avoid smearing)
      if (this.moving) ctx.clearRect(0, 0, this.W, this.H);
      else {
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = `rgba(0,0,0,${Math.pow(0.86, k).toFixed(3)})`;
        ctx.fillRect(0, 0, this.W, this.H);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (!f) return;
      const n = count();
      while (this.particles.length < n) this.particles.push(spawn({}));
      this.particles.length = n;
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = this.app.dark() ? 'rgba(255,255,255,0.75)' : 'rgba(15,23,42,0.55)';
      ctx.beginPath();
      for (const p of this.particles) {
        const c = Math.round(p.x / f.CELL), r = Math.round(p.y / f.CELL);
        const i = r * f.cols + c;
        const vx = f.vx[i], vy = f.vy[i];
        if ((p.age += k) > p.max || !(vx || vy) || p.x < 0 || p.y < 0 || p.x > this.W || p.y > this.H) { spawn(p); continue; }
        ctx.moveTo(p.x, p.y);
        p.x += vx * k; p.y += vy * k;
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    };
    this.anim = requestAnimationFrame(tick);
  }

  stop() {
    this.playing = false;
    cancelAnimationFrame(this.anim);
    this.anim = 0;
    this.clearTrails();
    this.canvas.hidden = true;
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
  syncPlay() { this.playBtn.innerHTML = icon(this.playing ? 'pause' : 'play', 18); this.playBtn.setAttribute('aria-label', this.playing ? 'Pause' : 'Play forecast'); }

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
    if (this.on.rain && this.hour >= 0.5) parts.push(['mm/h', RAIN_RAMP]);
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
    const s = this.sample(ll);
    if (!s) { this.readEl.textContent = ''; return; }
    const parts = [];
    if (this.on.wind) parts.push(`${s.speed.toFixed(1)} m/s ${compass(s.dir)}${s.gust > s.speed + 2 ? ` (gusts ${s.gust.toFixed(0)})` : ''}`);
    if (this.on.temp || this.on.wind) parts.push(`${s.temp.toFixed(0)} °C`);
    if (this.on.rain) parts.push(s.rain >= 0.05 ? `${s.rain.toFixed(1)} mm/h` : 'dry');
    this.readEl.textContent = `Here: ${parts.join(' · ')}`;
    this.renderLegend();
  }
}
