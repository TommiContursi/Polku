// Elevation profile on canvas (or, for paddling, wind along the route). The
// fill is coloured by the selected mode, hover is synced both ways with the
// map, and dragging across the chart zooms into a stretch.

import { gradeColor, DIFF_COLORS, SURFACE_COLORS, MTB_SCALE_TEXT, UPHILL_TEXT, OFFROAD_BIKE, isWater, SPORT_COLORS, ACTIVITIES } from './config.js';
import { fmtDist, fmtDuration, compass } from './geo.js';
import { windClass, tempBand, rainBand } from './weather.js';
import { escapeHtml, icon } from './ui.js';
import { fromCss } from './palette.js';

export const WAY_COLORS = fromCss({
  path: '--way-path', footway: '--way-footway', steps: '--way-steps', track: '--way-track', cycleway: '--way-cycleway',
  'minor road': '--way-minor-road', 'main road': '--way-main-road', water: '--way-water', portage: '--way-portage',
  'straight line': '--way-straight', other: '--way-other',
});

export const COLOR_MODES = {
  grade: 'Gradient',
  uphill: 'Uphill difficulty',
  down: 'MTB difficulty',
  both: 'Both',
  surface: 'Surface',
  way: 'Way type',
  width: 'Width',
  vis: 'Visibility',
  wind: 'Wind',
  temp: 'Temperature',
  rain: 'Rain',
  sport: 'Sport',
};

// The profile's colour chips, grouped by what they describe.
export const COLOR_GROUPS = [
  ['Terrain', ['grade', 'uphill', 'down', 'both']],
  ['Ground', ['surface', 'way', 'width', 'vis']],
  ['Weather', ['wind', 'temp', 'rain']],
  ['Route', ['sport']],
];

// Trail width and visibility along the route (analysis.js a.td): index = class + 2
// (-2 not a trail, -1 a trail without the tag, then js/trails.js's classes).
export const TRAIL_SCALES = fromCss({
  width: {
    colors: ['--trail-width-road', '--trail-width-none', '--trail-width-narrowest', '--trail-width-narrow', '--trail-width-wide', '--trail-width-widest'],
    labels: ['road or track', 'width not mapped', 'under 0.6 m', '0.6–0.9 m', '0.9–1.8 m', '1.8 m or more'],
  },
  vis: {
    colors: ['--trail-vis-road', '--trail-vis-none', '--trail-vis-clear', '--trail-vis-faint', '--trail-vis-hard', '--trail-vis-barely'],
    labels: ['road or track', 'visibility not mapped', 'clear', 'faint in places', 'hard to see', 'barely visible'],
  },
});

// where the terrain is missing (analysis.js): no height or grade to give there
export const noTerrain = (a, i) => !!(a.eleGap && a.eleGap[i]);
export const NO_TERRAIN = '#d6dde3';

export function colorAt(a, i, mode) {
  if ((mode === 'grade' || mode === 'uphill') && noTerrain(a, i)) return NO_TERRAIN; // no grade to colour by
  switch (mode) {
    case 'width': case 'vis': return a.td ? TRAIL_SCALES[mode].colors[a.td[mode][i] + 2] : '#d6dde3';
    case 'uphill': return a.upCls[i] >= 0 ? DIFF_COLORS[a.upCls[i]] : '#d6dde3';
    case 'surface': return SURFACE_COLORS[a.surf[i]] || SURFACE_COLORS.unknown;
    case 'way': return WAY_COLORS[a.way[i]] || WAY_COLORS.other;
    case 'down': return a.down6[i] >= 0 ? DIFF_COLORS[a.down6[i]] : '#d6dde3';
    // as on the map: climbs by their uphill grade, the rest by MTB difficulty
    case 'both': return a.upCls[i] >= 0 ? DIFF_COLORS[a.upCls[i]] : a.down6[i] >= 0 ? DIFF_COLORS[a.down6[i]] : '#d6dde3';
    case 'wind': return a.wind ? windClass(a.wind.head[i], a.wind.speed[i]).color : '#e2e8f0';
    case 'temp': return a.wind ? tempBand(a.wind.temp[i]).color : '#e2e8f0';
    case 'rain': return a.wind ? rainBand(a.wind.precip[i], a.wind.temp[i]).color : '#e2e8f0';
    case 'sport': return SPORT_COLORS[(a.attr[i] && a.attr[i].sport) || a.activity] || '#64748b';
    default: return gradeColor(a.grade[i]);
  }
}

const clock = (sec) => new Date(sec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dot = (color) => `<i class="dot" style="background:${color}"></i>`;

// One profile point, compact, for the tooltip beside the cursor when the
// route line is hovered on the map: where, how steep, what's underfoot, and
// the weather when you get there.
export function routeReadout(a, i, road = '') {
  const g = Math.round(a.grade[i] * 10) / 10 || 0; // no "-0.0 %"
  const trail = [];
  if (a.upCls[i] >= 0) trail.push(`${dot(DIFF_COLORS[a.upCls[i]])}${UPHILL_TEXT[a.upCls[i]].split(' · ')[0]}`);
  if (a.down6[i] >= 0) trail.push(`${dot(DIFF_COLORS[a.down6[i]])}${MTB_SCALE_TEXT[a.down6[i]].split(' · ')[0]}`);
  trail.push((road ? `${escapeHtml(road)} · ` : '') + (a.surf[i] && a.surf[i] !== 'unknown' ? `${a.way[i]} · ${a.surf[i].replace('_', ' ')}` : a.way[i]));
  // trail details where OSM has them
  if (a.td && a.td.trail[i]) {
    if (a.td.width[i] >= 0) trail.push(`${TRAIL_SCALES.width.labels[a.td.width[i] + 2]} wide`);
    if (a.td.vis[i] >= 1) trail.push(TRAIL_SCALES.vis.labels[a.td.vis[i] + 2]);
    const t = (a.attr[i] && a.attr[i].tags) || {};
    if (t.smoothness) trail.push(`smoothness ${escapeHtml(String(t.smoothness).replace(/_/g, ' '))}`);
  }
  const when = [];
  if (a.wind) {
    const w = a.wind;
    const c = windClass(w.head[i], w.speed[i]);
    when.push(`${dot(c.color)}${c.label}${c.key === 'calm' ? '' : ` ${w.speed[i].toFixed(0)} m/s`}`, `${w.temp[i].toFixed(0)} °C`,
      w.precip[i] >= 0.1 ? `${w.temp[i] < 0.5 ? 'snow' : 'rain'} ${w.precip[i].toFixed(1)} mm/h` : 'dry');
  }
  if (a.wind && a.tAtWind) when.push(`at ${clock(a.wind.startSec + a.tAtWind[i])}`);
  else if (a.tAt) when.push(`${fmtDuration(a.tAt[i])} in`);
  if (isWater(a.activity)) {
    return { title: `${fmtDist(a.along[i])} · ${a.way[i] === 'portage' ? 'carry' : a.way[i] === 'water' ? 'on the water' : a.way[i]}`, lines: [when.join(' · ')].filter(Boolean) };
  }
  return {
    title: `${fmtDist(a.along[i])} · ${noTerrain(a, i) ? 'no terrain here' : `${Math.round(a.ele[i])} m · ${g >= 0 ? '+' : ''}${g.toFixed(1)} %`}`,
    lines: [trail.join(' · '), when.join(' · ')].filter(Boolean),
  };
}

function niceStep(range, target) {
  const raw = range / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export class ProfileChart {
  constructor(canvas, tip) {
    this.canvas = canvas;
    this.tip = tip;
    this.a = null;
    this.mode = 'grade';
    // 'elevation': the usual profile; 'conditions': wind along the route (paddling,
    // where the water surface has no profile worth drawing)
    this.kind = 'elevation';
    this.placeholder = '';
    this.view = null; // [from, to] metres when zoomed in
    this.hoverIdx = -1;
    this.highlight = null;
    this.onHover = () => {};
    this.onClick = () => {};
    this.onZoom = () => {};
    this.pad = { l: 40, r: 10, t: 10, b: 20 };
    this.resetBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'chart-reset', textContent: 'Whole route', hidden: true, title: 'Zoom the profile back out' });
    this.resetBtn.addEventListener('click', () => this.setView(null, true));
    canvas.parentElement.append(this.resetBtn);
    new ResizeObserver(() => this.draw()).observe(canvas);
    this.bindPointer();
  }

  // Mouse: drag across the chart to zoom into that stretch, click to centre the
  // map there. Touch: drag scrubs, double-tap zooms in around the tap.
  bindPointer() {
    const c = this.canvas;
    let down = null, lastTap = 0;
    c.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      down = { x: e.clientX, mouse: e.pointerType === 'mouse' };
      if (down.mouse) try { c.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    });
    c.addEventListener('pointermove', (e) => {
      if (down && down.mouse && Math.abs(e.clientX - down.x) > 6) {
        const r = c.getBoundingClientRect();
        this.sel = [down.x - r.left, e.clientX - r.left];
        this.draw();
        return;
      }
      this.pointer(e);
    });
    c.addEventListener('pointerup', (e) => {
      const d = down;
      down = null;
      if (!d) return;
      if (this.sel) {
        const [x0, x1] = this.sel.slice().sort((p, q) => p - q);
        this.sel = null;
        if (x1 - x0 > 10) this.setView([this.distAt(x0), this.distAt(x1)], true); else this.draw();
        return;
      }
      if (Math.abs(e.clientX - d.x) > 6) return;
      const i = this.indexAt(e);
      if (i < 0) return;
      const now = Date.now();
      if (!d.mouse && now - lastTap < 320) {
        const [v0, v1] = this.domain();
        const at = this.a.along[i], half = (v1 - v0) / 4;
        this.setView([at - half, at + half], true);
        lastTap = 0;
        return;
      }
      lastTap = now;
      this.onClick(i);
    });
    c.addEventListener('pointercancel', () => { down = null; this.sel = null; this.draw(); });
    // pinch on a trackpad (ctrl+wheel) zooms the profile around the pointer; the map follows once it settles
    c.addEventListener('wheel', (e) => {
      if (!e.ctrlKey || !this.a) return;
      e.preventDefault();
      const [v0, v1] = this.domain();
      const at = this.distAt(e.clientX - this.geom().rect.left);
      const f = Math.exp(Math.max(-0.5, Math.min(0.5, e.deltaY * 0.01)));
      this.setView([at - (at - v0) * f, at + (v1 - at) * f]);
      clearTimeout(this.zoomTimer);
      this.zoomTimer = setTimeout(() => this.onZoom(this.view), 350);
    }, { passive: false });
    c.addEventListener('pointerleave', () => { if (!down) { this.setHover(-1); this.onHover(null); } });
  }

  setData(a, mode = this.mode, kind = this.kind) {
    // a new route zooms back out; the same one (e.g. its forecast arrived) keeps the zoom
    if (a !== this.a || kind !== this.kind) { this.view = null; this.resetBtn.hidden = true; }
    this.a = a; this.mode = mode; this.kind = kind; this.hoverIdx = -1;
    this.segs = sportSegments(a);
    this.draw();
  }
  setMode(mode) { this.mode = mode; this.draw(); }
  // the route's points along it (metres), drawn as on the map: the start, the numbered vias, the finish
  setPoints(list) { this.points = list || []; }
  // (drawn again only when it changes: the list asks for it each time it's drawn)
  setHighlight(range) {
    const was = this.highlight;
    if ((range == null && was == null) || (range && was && range[0] === was[0] && range[1] === was[1])) return;
    this.highlight = range;
    this.draw();
  }

  domain() { return this.view || [0, this.a ? this.a.total : 1]; }

  // Zoom to [from, to] metres (null: the whole route). `user`: tell the planner, so the map follows.
  setView(v, user = false) {
    const a = this.a;
    if (!a) return;
    if (v) {
      let [d0, d1] = v;
      const span = Math.max(Math.min(150, a.total), d1 - d0);
      const mid = (d0 + d1) / 2;
      d0 = Math.max(0, Math.min(a.total - span, mid - span / 2));
      d1 = d0 + span;
      v = d1 - d0 >= a.total * 0.98 ? null : [d0, d1];
    }
    this.view = v;
    this.resetBtn.hidden = !v;
    this.draw();
    if (user) this.onZoom(v);
  }

  geom() {
    const r = this.canvas.getBoundingClientRect();
    const { l, r: pr, t } = this.pad;
    const b = this.pad.b + (this.segs && this.segs.length > 1 ? 12 : 0); // room for the sport strip
    return { w: r.width, h: r.height, x0: l, x1: r.width - pr, y0: t, y1: r.height - b, rect: r };
  }

  distAt(x) {
    const g = this.geom();
    const [v0, v1] = this.domain();
    return v0 + Math.max(0, Math.min(1, (x - g.x0) / (g.x1 - g.x0))) * (v1 - v0);
  }

  idxOfDist(d) {
    const al = this.a.along;
    let lo = 0, hi = al.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (al[m] < d) lo = m; else hi = m; }
    return d - al[lo] < al[hi] - d ? lo : hi;
  }

  indexAt(e) {
    if (!this.a) return -1;
    const g = this.geom();
    const x = e.clientX - g.rect.left;
    if (x < g.x0 - 2 || x > g.x1 + 2) return -1;
    return this.idxOfDist(this.distAt(x));
  }

  pointer(e) {
    const i = this.indexAt(e);
    this.setHover(i);
    this.onHover(i >= 0 ? i : null);
  }

  // tip=false: just the marker line (the map shows its own readout)
  setHover(i, tip = true) {
    this.hoverIdx = i;
    this.draw();
    const a = this.a;
    if (i < 0 || !a || !tip) { this.tip.hidden = true; return; }
    const g = this.geom();
    const [v0, v1] = this.domain();
    const x = g.x0 + ((a.along[i] - v0) / (v1 - v0)) * (g.x1 - g.x0);
    const rows = this.kind === 'conditions'
      ? [`<b>${fmtDist(a.along[i])}</b> · ${a.way[i] === 'portage' ? 'carry' : a.way[i] === 'water' ? 'on the water' : a.way[i]}`]
      : noTerrain(a, i) ? [`<b>${fmtDist(a.along[i])}</b> · no terrain here`]
        : [`<b>${fmtDist(a.along[i])}</b> · ${Math.round(a.ele[i])} m`, `Grade ${a.grade[i] >= 0 ? '+' : ''}${a.grade[i].toFixed(1)} %`];
    if (this.kind !== 'conditions') {
      if (a.upCls[i] >= 0) rows.push(`Uphill ${UPHILL_TEXT[a.upCls[i]].split(' · ')[0]}`);
      if (a.down6[i] >= 0) rows.push(MTB_SCALE_TEXT[a.down6[i]].split(' · ')[0] + ' downhill');
      const road = this.nameAt ? this.nameAt(i) : '';
      rows.push(`${road ? `<b>${escapeHtml(road)}</b> · ` : ''}${a.way[i]} · ${a.surf[i].replace('_', ' ')}`);
    }
    if (a.wind) {
      const w = a.wind;
      const c = windClass(w.head[i], w.speed[i]);
      rows.push(`${c.label} · ${w.speed[i].toFixed(1)} m/s from ${compass(w.dir[i])}${w.gust[i] > w.speed[i] + 2 ? `, gusts ${w.gust[i].toFixed(0)}` : ''}`);
      rows.push(`${w.temp[i].toFixed(0)} °C · ${w.precip[i] >= 0.1 ? `${w.temp[i] < 0.5 ? 'snow' : 'rain'} ${w.precip[i].toFixed(1)} mm/h` : 'dry'}`);
      if (a.tAtWind) rows.push(`Reached ${clock(a.wind.startSec + a.tAtWind[i])}`);
    }
    this.tip.innerHTML = rows.join('<br>');
    this.tip.hidden = false;
    const tw = this.tip.offsetWidth;
    this.tip.style.left = `${Math.min(Math.max(4, x - tw / 2), g.w - tw - 4)}px`;
  }

  draw() {
    const c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const g = this.geom();
    if (!g.w || !g.h) return;
    c.width = Math.round(g.w * dpr);
    c.height = Math.round(g.h * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, g.w, g.h);
    const a = this.a;
    const css = getComputedStyle(c);
    const ink = css.getPropertyValue('--chart-ink').trim() || '#334155';
    const grid = css.getPropertyValue('--chart-grid').trim() || 'rgba(100,116,139,0.18)';
    const muted = css.getPropertyValue('--muted').trim() || '#64748b';
    const cond = this.kind === 'conditions';
    const note = (text) => { ctx.fillStyle = muted; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(text, g.x0, g.h / 2); };
    if (!a || a.pts.length < 2) { note('Add points on the map to see the elevation profile'); return; }
    if (cond && !a.wind) { note(this.placeholder || 'Loading the wind along the route…'); return; }
    const [v0, v1] = this.domain();
    const iA = Math.max(0, this.idxOfDist(v0) - 1), iB = Math.min(a.pts.length - 1, this.idxOfDist(v1) + 1);
    // the value drawn: elevation, or wind speed for conditions
    const val = cond ? a.wind.speed : a.ele;
    let lo = Infinity, hi = -Infinity;
    for (let k = iA; k <= iB; k++) {
      const v = cond ? Math.max(val[k], a.wind.gust[k]) : val[k];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (!cond && !(hi >= lo)) { note(a.terrain && !a.terrain.retry ? 'No terrain here: no elevation profile' : 'The terrain didn’t load: no elevation profile yet'); return; }
    let yMin, yMax;
    if (cond) { yMin = 0; yMax = Math.max(4, hi * 1.15); } else {
      const span = Math.max(20, hi - lo);
      yMin = lo - span * 0.08;
      yMax = hi + span * 0.12;
    }
    const X = (d) => g.x0 + ((d - v0) / (v1 - v0)) * (g.x1 - g.x0);
    const Y = (e) => g.y1 - ((e - yMin) / (yMax - yMin)) * (g.y1 - g.y0);

    // grid + labels
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = muted;
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    const ys = niceStep(yMax - yMin, cond ? 3 : 4);
    const top = Math.floor(yMax / ys) * ys;
    for (let v = Math.ceil(yMin / ys) * ys; v <= yMax; v += ys) {
      const y = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(g.x0, y); ctx.lineTo(g.x1, y); ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(cond && Math.abs(v - top) < 1e-6 ? `${Math.round(v)} m/s` : `${Math.round(v)}`, g.x0 - 6, y + 3);
    }
    const span = v1 - v0;
    const xs = niceStep(span / 1000, 6) * 1000;
    ctx.textAlign = 'center';
    // a label that would touch the one before it, or run off the profile, is left out (a narrow profile, #242)
    let after = -Infinity;
    for (let d = Math.ceil(v0 / xs) * xs; d <= v1 + 1; d += xs) {
      const t = d >= 1000 || xs >= 1000 ? `${(d / 1000).toFixed(xs < 1000 ? 1 : 0)} km` : `${d} m`, x = X(d), half = ctx.measureText(t).width / 2;
      if (x - half < after + 6 || x + half > g.w) continue;
      ctx.fillText(t, x, g.h - 5);
      after = x + half;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(g.x0, 0, g.x1 - g.x0, g.h);
    ctx.clip();

    // highlighted range (selected climb / warning)
    if (this.highlight) {
      ctx.fillStyle = 'rgba(17,24,39,0.07)';
      const [d0, d1] = this.highlight;
      ctx.fillRect(X(d0), g.y0, Math.max(2, X(d1) - X(d0)), g.y1 - g.y0);
    }

    // coloured fill, batched by colour
    let i = iA;
    while (i < iB) {
      const col = colorAt(a, i + 1, this.mode);
      let j = i + 1;
      while (j < iB && colorAt(a, j + 1, this.mode) === col) j++;
      ctx.beginPath();
      ctx.moveTo(X(a.along[i]), g.y1);
      for (let k = i; k <= j; k++) ctx.lineTo(X(a.along[k]), Y(val[k]));
      ctx.lineTo(X(a.along[j]), g.y1);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      i = j;
    }
    // outline, dashed where the terrain is missing (a straight line across: an estimate)
    const est = (k) => !cond && noTerrain(a, k);
    for (let k0 = iA; k0 < iB;) {
      const dash = est(k0 + 1);
      let k1 = k0 + 1;
      while (k1 < iB && est(k1 + 1) === dash) k1++;
      ctx.beginPath();
      for (let k = k0; k <= k1; k++) {
        const x = X(a.along[k]), y = Y(val[k]);
        if (k > k0) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.setLineDash(dash ? [4, 3] : []);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      k0 = k1;
    }
    ctx.setLineDash([]);

    if (cond) {
      const w = a.wind;
      // gusts, dashed
      ctx.beginPath();
      for (let k = iA; k <= iB; k++) {
        const x = X(a.along[k]), y = Y(w.gust[k]);
        if (k > iA) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = muted;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      // rain as bars from the bottom, carries as an orange band on the baseline
      for (let k = iA + 1; k <= iB; k++) {
        const x0 = X(a.along[k - 1]), x1 = X(a.along[k]);
        if (w.precip[k] >= 0.1) {
          ctx.fillStyle = 'rgba(37, 99, 235, 0.35)';
          const hh = Math.min(1, w.precip[k] / 3) * (g.y1 - g.y0) * 0.3;
          ctx.fillRect(x0, g.y1 - hh, Math.max(1, x1 - x0), hh);
        }
        if (a.way[k] === 'portage') {
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(x0, g.y1 - 4, Math.max(2, x1 - x0), 4);
        }
      }
      // where the wind blows, along the top
      const n = Math.max(2, Math.floor((g.x1 - g.x0) / 46));
      ctx.fillStyle = ink;
      for (let s = 0; s < n; s++) {
        const d = v0 + ((s + 0.5) / n) * span;
        const k = this.idxOfDist(d);
        const x = X(a.along[k]), y = g.y0 + 6;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(((w.dir[k] + 180) * Math.PI) / 180);
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3.5, 4); ctx.lineTo(0, 2); ctx.lineTo(-3.5, 4); ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else {
      // climb markers: a tag with an arrow ("↑1"), coloured by the climb, so they don't look like
      // the route's numbered points (those are round, below); the biggest climbs first, and a tag that would cover
      // one already drawn is left out (many climbs, a narrow profile: #242)
      ctx.font = '700 10px system-ui, sans-serif';
      const tags = [];
      a.climbs.map((cl, k) => [cl, k]).sort(([p], [q]) => q.gain - p.gain).forEach(([cl, k]) => {
        const label = `↑${k + 1}`, w = ctx.measureText(label).width + 8;
        const x = Math.min(Math.max(X((cl.from + cl.to) / 2), g.x0 + w / 2), g.x1 - w / 2); // (whole, inside the plot)
        const y = Y(a.ele[cl.end]) - 9;
        if (tags.some((t) => Math.abs(t.x - x) < (t.w + w) / 2 + 2 && Math.abs(t.y - y) < 16)) return;
        tags.push({ x, y, w });
        ctx.fillStyle = OFFROAD_BIKE.has(a.activity) ? DIFF_COLORS[cl.cls] : gradeColor(cl.avg);
        roundRect(ctx, x - w / 2, y - 7, w, 14, 4); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y + 3.5);
      });
    }


    // a multisport route: each stretch's sport, as a band under the profile (whatever the colours above)
    this.drawSports(ctx, g, X);

    // drag selection
    if (this.sel) {
      const [p, q] = this.sel.slice().sort((m, n2) => m - n2);
      ctx.fillStyle = 'rgba(31, 111, 74, 0.14)';
      ctx.fillRect(p, g.y0, q - p, g.y1 - g.y0);
      ctx.strokeStyle = 'rgba(31, 111, 74, 0.6)';
      ctx.strokeRect(p + 0.5, g.y0 + 0.5, q - p - 1, g.y1 - g.y0 - 1);
    }

    // hover
    if (this.hoverIdx >= 0) {
      const x = X(a.along[this.hoverIdx]);
      ctx.strokeStyle = ink;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, g.y0); ctx.lineTo(x, g.y1); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.arc(x, Y(val[this.hoverIdx]), 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // the route's points where they are along it: a faint line, and the point as on the map
    // (the start green, the vias numbered, the finish a dark square) on the baseline; a via too near the mark before
    // it or the finish to tell them apart (a mark is 14 px across) is left out, the start and the finish never (#242)
    const shown = (this.points || []).filter((p) => p.d >= v0 - 1 && p.d <= v1 + 1), end = shown.find((p) => p.kind === 'end'), pts = [];
    for (const p of shown) {
      const x = X(p.d), prev = pts[pts.length - 1];
      if (p.kind === 'via' && ((prev && x - X(prev.d) < 16) || (end && X(end.d) - x < 16))) continue;
      pts.push(p);
    }
    if (pts.length) {
      ctx.save();
      ctx.font = '700 9.5px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const p of pts) {
        const x = Math.round(X(p.d)) + 0.5, y = g.y1 - 8;
        ctx.strokeStyle = ink; ctx.globalAlpha = 0.35; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, g.y0); ctx.lineTo(x, y - 7); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.lineWidth = 1.5;
        if (p.kind === 'end') {
          ctx.fillStyle = '#111827'; ctx.strokeStyle = '#fff';
          roundRect(ctx, x - 6, y - 6, 12, 12, 3); ctx.fill(); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(x, y, p.kind === 'start' ? 6.5 : 7, 0, Math.PI * 2);
          ctx.fillStyle = p.kind === 'start' ? '#16a34a' : '#fff'; ctx.fill();
          ctx.strokeStyle = p.kind === 'start' ? '#fff' : '#111827'; ctx.stroke();
          if (p.kind === 'via') { ctx.fillStyle = '#111827'; ctx.fillText(String(p.n), x, y + 3.5); }
        }
      }
      ctx.restore();
    }
  }

  // The sport strip: a band under the plot in each stretch's sport colour, its icon over it
  // (HTML, beside the canvas) where the stretch is wide enough to hold one.
  drawSports(ctx, g, X) {
    if (!this.sportBox) {
      this.sportBox = Object.assign(document.createElement('div'), { className: 'chart-sports' });
      this.canvas.parentElement.append(this.sportBox);
    }
    const segs = this.segs || [];
    this.sportBox.innerHTML = '';
    if (segs.length < 2) return;
    const y = g.y1 + 3;
    for (const sg of segs) {
      const x0 = Math.max(g.x0, X(sg.d0)), x1 = Math.min(g.x1, X(sg.d1));
      if (x1 <= x0) continue;
      ctx.fillStyle = SPORT_COLORS[sg.sport] || '#64748b';
      ctx.fillRect(x0, y, Math.max(1, x1 - x0 - 1), 6);
      if (x1 - x0 >= 22) {
        const el = document.createElement('span');
        el.className = 'chart-sport';
        el.title = ACTIVITIES[sg.sport] ? ACTIVITIES[sg.sport].label : sg.sport;
        el.style.left = `${(x0 + x1) / 2}px`;
        el.style.top = `${y + 3}px`;
        el.style.background = SPORT_COLORS[sg.sport] || '#64748b';
        el.innerHTML = icon(SPORT_ICONS[sg.sport] || 'route', 11);
        this.sportBox.append(el);
      }
    }
  }
}

// the sports along a route, as stretches [{ d0, d1, sport }]
const SPORT_ICONS = { mtb: 'bike', gravel: 'gravel', road: 'roadbike', hike: 'hike', trailrun: 'trailrun', run: 'run', paddle: 'paddle', swim: 'swim' };
function sportSegments(a) {
  if (!a || !a.attr) return [];
  const out = [];
  for (let i = 1; i < a.along.length; i++) {
    const sp = (a.attr[i] && a.attr[i].sport) || a.activity;
    const last = out[out.length - 1];
    if (last && last.sport === sp) last.d1 = a.along[i];
    else out.push({ d0: a.along[i - 1], d1: a.along[i], sport: sp });
  }
  return out;
}
