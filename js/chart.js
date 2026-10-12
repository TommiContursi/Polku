// Elevation profile on canvas. The fill is coloured by the selected mode
// (gradient, uphill difficulty, surface, way type, MTB difficulty) and hover
// is synced both ways with the map.

import { gradeColor, DIFF_COLORS, SURFACE_COLORS, MTB_SCALE_TEXT, UPHILL_TEXT } from './config.js';
import { fmtDist, compass } from './geo.js';
import { windClass, tempBand, rainBand } from './weather.js';

export const WAY_COLORS = {
  path: '#7c2d12', footway: '#b45309', steps: '#dc2626', track: '#a16207', cycleway: '#2563eb',
  'minor road': '#64748b', 'main road': '#f59e0b', water: '#0ea5e9', portage: '#ea580c',
  'straight line': '#be123c', other: '#94a3b8',
};

export const COLOR_MODES = {
  grade: 'Gradient',
  uphill: 'Uphill difficulty',
  surface: 'Surface',
  wind: 'Wind',
  temp: 'Temperature',
  rain: 'Rain',
  way: 'Way type',
  down: 'MTB difficulty',
};

export function colorAt(a, i, mode) {
  switch (mode) {
    case 'uphill': return a.upCls[i] >= 0 ? DIFF_COLORS[a.upCls[i]] : '#d6dde3';
    case 'surface': return SURFACE_COLORS[a.surf[i]] || SURFACE_COLORS.unknown;
    case 'way': return WAY_COLORS[a.way[i]] || WAY_COLORS.other;
    case 'down': return a.down6[i] >= 0 ? DIFF_COLORS[a.down6[i]] : '#d6dde3';
    case 'wind': return a.wind ? windClass(a.wind.head[i], a.wind.speed[i]).color : '#e2e8f0';
    case 'temp': return a.wind ? tempBand(a.wind.temp[i]).color : '#e2e8f0';
    case 'rain': return a.wind ? rainBand(a.wind.precip[i], a.wind.temp[i]).color : '#e2e8f0';
    default: return gradeColor(a.grade[i]);
  }
}

const clock = (sec) => new Date(sec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function niceStep(range, target) {
  const raw = range / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

export class ProfileChart {
  constructor(canvas, tip) {
    this.canvas = canvas;
    this.tip = tip;
    this.a = null;
    this.mode = 'grade';
    this.hoverIdx = -1;
    this.highlight = null;
    this.onHover = () => {};
    this.onClick = () => {};
    this.pad = { l: 40, r: 10, t: 10, b: 20 };
    new ResizeObserver(() => this.draw()).observe(canvas);
    canvas.addEventListener('pointermove', (e) => this.pointer(e));
    canvas.addEventListener('pointerleave', () => { this.setHover(-1); this.onHover(null); });
    canvas.addEventListener('click', (e) => {
      const i = this.indexAt(e);
      if (i >= 0) this.onClick(i);
    });
  }

  setData(a, mode = this.mode) { this.a = a; this.mode = mode; this.hoverIdx = -1; this.draw(); }
  setMode(mode) { this.mode = mode; this.draw(); }
  setHighlight(range) { this.highlight = range; this.draw(); }

  geom() {
    const r = this.canvas.getBoundingClientRect();
    const { l, r: pr, t, b } = this.pad;
    return { w: r.width, h: r.height, x0: l, x1: r.width - pr, y0: t, y1: r.height - b, rect: r };
  }

  indexAt(e) {
    if (!this.a) return -1;
    const g = this.geom();
    const x = e.clientX - g.rect.left;
    const d = ((x - g.x0) / (g.x1 - g.x0)) * this.a.total;
    if (d < 0 || d > this.a.total) return -1;
    const al = this.a.along;
    let lo = 0, hi = al.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (al[m] < d) lo = m; else hi = m; }
    return d - al[lo] < al[hi] - d ? lo : hi;
  }

  pointer(e) {
    const i = this.indexAt(e);
    this.setHover(i);
    this.onHover(i >= 0 ? i : null);
  }

  setHover(i) {
    this.hoverIdx = i;
    this.draw();
    const a = this.a;
    if (i < 0 || !a) { this.tip.hidden = true; return; }
    const g = this.geom();
    const x = g.x0 + (a.along[i] / a.total) * (g.x1 - g.x0);
    const rows = [
      `<b>${fmtDist(a.along[i])}</b> · ${Math.round(a.ele[i])} m`,
      `Grade ${a.grade[i] >= 0 ? '+' : ''}${a.grade[i].toFixed(1)} %`,
    ];
    if (a.upCls[i] >= 0) rows.push(`Uphill ${UPHILL_TEXT[a.upCls[i]].split(' · ')[0]}`);
    if (a.down6[i] >= 0) rows.push(MTB_SCALE_TEXT[a.down6[i]].split(' · ')[0] + ' downhill');
    rows.push(`${a.way[i]} · ${a.surf[i].replace('_', ' ')}`);
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
    if (!a || a.pts.length < 2) {
      ctx.fillStyle = muted;
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('Add points on the map to see the elevation profile', g.x0, g.h / 2);
      return;
    }
    const span = Math.max(20, a.maxE - a.minE);
    const yMin = a.minE - span * 0.08;
    const yMax = a.maxE + span * 0.12;
    const X = (d) => g.x0 + (d / a.total) * (g.x1 - g.x0);
    const Y = (e) => g.y1 - ((e - yMin) / (yMax - yMin)) * (g.y1 - g.y0);

    // grid + labels
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = muted;
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    const ys = niceStep(yMax - yMin, 4);
    for (let v = Math.ceil(yMin / ys) * ys; v <= yMax; v += ys) {
      const y = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(g.x0, y); ctx.lineTo(g.x1, y); ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(v)}`, g.x0 - 6, y + 3);
    }
    const xs = niceStep(a.total / 1000, 6) * 1000;
    ctx.textAlign = 'center';
    for (let d = 0; d <= a.total + 1; d += xs) {
      ctx.fillText(d >= 1000 || xs >= 1000 ? `${(d / 1000).toFixed(xs < 1000 ? 1 : 0)} km` : `${d} m`, X(d), g.h - 5);
    }

    // highlighted range (selected climb / warning)
    if (this.highlight) {
      ctx.fillStyle = 'rgba(17,24,39,0.07)';
      const [d0, d1] = this.highlight;
      ctx.fillRect(X(d0), g.y0, Math.max(2, X(d1) - X(d0)), g.y1 - g.y0);
    }

    // coloured fill, batched by colour
    const n = a.pts.length;
    let i = 0;
    while (i < n - 1) {
      const col = colorAt(a, i + 1, this.mode);
      let j = i + 1;
      while (j < n - 1 && colorAt(a, j + 1, this.mode) === col) j++;
      ctx.beginPath();
      ctx.moveTo(X(a.along[i]), g.y1);
      for (let k = i; k <= j; k++) ctx.lineTo(X(a.along[k]), Y(a.ele[k]));
      ctx.lineTo(X(a.along[j]), g.y1);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      i = j;
    }
    // outline
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const x = X(a.along[k]), y = Y(a.ele[k]);
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // climb markers
    ctx.font = '600 10px system-ui, sans-serif';
    a.climbs.forEach((cl, k) => {
      const x = X((cl.from + cl.to) / 2);
      const y = Y(a.ele[cl.end]) - 6;
      ctx.fillStyle = ['mtb', 'gravel'].includes(a.activity) ? DIFF_COLORS[cl.cls] : gradeColor(cl.avg);
      ctx.beginPath(); ctx.arc(x, y - 3, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(`${k + 1}`, x, y);
    });

    // hover
    if (this.hoverIdx >= 0) {
      const x = X(a.along[this.hoverIdx]);
      ctx.strokeStyle = ink;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, g.y0); ctx.lineTo(x, g.y1); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.arc(x, Y(a.ele[this.hoverIdx]), 4, 0, Math.PI * 2); ctx.fill();
    }
  }
}
