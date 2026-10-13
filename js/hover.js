// Hover details on desktop: a line or two about what a click would open, read
// from features already drawn on the map. Never calls an API (the incline may
// read a terrain tile); the click popup keeps the full details (OSM tags, depth…).
//
// Cost: one queryRenderedFeatures per pointer rest (~0.3 ms flat, ~10 ms in
// tilted 3D), none while the pointer or the map is moving.

import { DIFF_COLORS, UPHILL_TEXT } from './config.js';
import { inspectLayers, pickFeature, WAY_NAMES, MARK_TYPE, SECTOR_NAME } from './inspect.js';
import { NAV_TEXT } from './nautical.js';
import { aadtColor, fmtAadt } from './safety.js';
import { gradeHere } from './uphill.js';
import { h, escapeHtml } from './ui.js';

const FIRST = 260; // ms the pointer rests before the first tooltip
const WARM = 90; // …and when moving on from one that was just shown
const RADIUS = 5; // px around the pointer
const DRIFT = 16; // px the pointer may move before a shown tooltip hides
const OPENS = ['cameras', 'sf-ships', 'nm-marks', 'sf-points']; // pointer cursor: these open a card

export const hoverCapable = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

/** app: { enabled(), isPlanning() } */
export function initHover(map, app) {
  const canvas = map.getCanvas();
  const tip = h('div', { class: 'hover-tip', 'aria-hidden': 'true', hidden: true });
  document.body.append(tip); // above the floating buttons and the timeline
  let at = null; // pointer in canvas px
  let client = [0, 0]; // …and in the window
  let shownAt = null;
  let size = [0, 0];
  let timer = 0;
  let frame = 0;
  let hiddenAt = 0;
  let pointer = false;
  let route = false; // showing the planner's route readout
  let current = null; // what the tooltip shows

  const hide = () => {
    clearTimeout(timer);
    timer = 0;
    route = false;
    current = null;
    if (tip.hidden) return;
    tip.hidden = true;
    hiddenAt = performance.now();
  };

  const place = () => {
    const W = window.innerWidth, H = window.innerHeight;
    let x = client[0] + 14, y = client[1] + 18;
    if (x + size[0] > W - 8) x = client[0] - 14 - size[0];
    if (y + size[1] > H - 8) y = client[1] - 12 - size[1];
    tip.style.transform = `translate(${Math.max(4, Math.round(x))}px, ${Math.max(4, Math.round(y))}px)`;
  };

  const probe = () => {
    timer = 0;
    if (!at || !app.enabled() || map.isMoving() || map.getContainer().querySelector('.polku-popup')) return;
    const planning = app.isPlanning();
    const layers = inspectLayers(map).filter((id) => id !== 'water' && !id.endsWith('-halo') && !id.startsWith('road-tunnel'));
    if (planning) layers.push(...['route-casing', 'nogo-fill'].filter((id) => map.getLayer(id)));
    const [x, y] = at;
    const feats = map.queryRenderedFeatures([[x - RADIUS, y - RADIUS], [x + RADIUS, y + RADIUS]], { layers });
    let d = null;
    if (planning) {
      // the route line has its own live readout (see route() below)
      if (feats.some((f) => f.layer.id === 'route-casing')) { if (!route) hide(); return; }
      const ng = feats.find((f) => f.layer.id === 'nogo-fill');
      if (ng) d = { title: ng.properties.label || 'Avoided place', bits: ['Routes go around it · click to change'] };
    }
    if (!d) { const f = pickFeature(feats); d = f && describe(f, feats, { ll: map.unproject(at).toArray(), mtb: app.activity() === 'mtb' }); }
    if (!d) { hide(); return; }
    render(d);
    // the incline from the DEM arrives a moment later
    if (d.pending) {
      d.pending.then((bit) => {
        if (bit && current === d && !tip.hidden && !route) { d.bits.splice(d.upAt, 0, bit); render(d); }
      }).catch(() => {});
    }
  };

  const render = (d) => {
    current = d;
    const lines = d.lines || (d.bits.length ? [d.bits.join(' · ')] : []);
    tip.innerHTML = `<b>${escapeHtml(d.title)}</b>${lines.map((l) => `<span>${l}</span>`).join('')}`;
    tip.hidden = false;
    size = [tip.offsetWidth, tip.offsetHeight];
    shownAt = at;
    place();
  };

  // Pointer cursor over things that open a card or modal: one query per frame
  // at most (MapLibre's per-layer mouseenter/leave would run one per layer per move).
  const cursor = () => {
    frame = 0;
    if (!at || app.isPlanning()) { pointer = false; return; }
    const layers = OPENS.filter((id) => map.getLayer(id));
    const hit = layers.length > 0 && map.queryRenderedFeatures(at, { layers }).length > 0;
    if (hit !== pointer) { pointer = hit; canvas.style.cursor = hit ? 'pointer' : ''; }
  };

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    at = [e.clientX - r.left, e.clientY - r.top];
    client = [e.clientX, e.clientY];
    if (e.buttons || map.isMoving()) { hide(); return; }
    if (!frame) frame = requestAnimationFrame(cursor);
    if (!app.enabled()) { hide(); return; }
    if (!tip.hidden && !route) {
      if (Math.hypot(at[0] - shownAt[0], at[1] - shownAt[1]) > DRIFT) hide();
      else place();
    }
    clearTimeout(timer);
    timer = setTimeout(probe, tip.hidden && performance.now() - hiddenAt > 600 ? FIRST : WARM);
  });
  canvas.addEventListener('pointerleave', () => { at = null; hide(); });
  canvas.addEventListener('pointerdown', hide);
  map.on('movestart', hide);

  return {
    hide,
    // The planner's readout for the route point under the cursor: follows the
    // pointer live (no pause). Returns false when hover details are off.
    route(ev, d) {
      if (!d) { if (route) hide(); return false; }
      if (!app.enabled() || !ev || ev.buttons || map.isMoving()) return false;
      const r = canvas.getBoundingClientRect();
      at = [ev.clientX - r.left, ev.clientY - r.top];
      client = [ev.clientX, ev.clientY];
      clearTimeout(timer);
      timer = 0;
      route = true;
      render(d);
      return true;
    },
  };
}

// ------------------------------------------------------------------ text
const dot = (color) => `<i class="dot" style="background:${color}"></i>`;
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const until = (iso) => (iso ? `until ${new Date(iso).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : '');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const e = escapeHtml;

function wayKind(feats) {
  const w = feats.find((x) => /^(path|track|cycleway|road)-/.test(x.layer.id));
  if (!w) return null;
  const p = w.properties;
  const kind = p.class === 'path' ? (p.subclass || 'path') : p.class;
  return { f: w, p, name: WAY_NAMES[kind] || (kind ? cap(String(kind).replace(/_/g, ' ')) : 'Way') };
}

function describe(f, feats, ctx) {
  const p = f.properties;
  const id = f.layer.id;

  if (id === 'cameras') return { title: p.name || 'Road camera', bits: ['Road weather camera · click for live images'] };
  if (id.startsWith('sf-ships')) {
    return { title: p.name || 'Ship', bits: [e(p.group || 'Vessel'), p.moving ? `${(+p.sog || 0).toFixed(1)} kn` : 'stopped', 'click for details'] };
  }
  if (id.startsWith('nm-')) return nautical(p);
  if (id.startsWith('sf-points') || id.startsWith('sf-lines')) {
    if (p.kind === 'roadcond') return { title: p.label || 'Road conditions', bits: [p.reasons ? e(clip(p.reasons, 70)) : ''].filter(Boolean) };
    if (p.kind === 'incident' || p.kind === 'roadwork') {
      return { title: p.kind === 'incident' ? 'Traffic incident' : 'Road works', bits: [p.title ? e(clip(p.title, 60)) : '', until(p.end)].filter(Boolean) };
    }
    return null;
  }
  if (id === 'sf-aadt') {
    const w = wayKind(feats);
    return { title: w ? w.name : 'Road', bits: [`${dot(aadtColor(p.aadt))}about ${fmtAadt(p.aadt)} vehicles/day`] };
  }
  if (id === 'military-fill') return { title: 'Military area', bits: ['May be closed or have live firing'] };
  if (id === 'lipas-point') return { title: p.name || p.typeName || 'Place', bits: [e(p.typeName || ''), e(p.city || '')].filter(Boolean) };
  if (id === 'lipas-route') return { title: p.name || p.typeName || 'Route', bits: [e(p.typeName || ''), p.length ? `${e(p.length)} km` : ''].filter(Boolean) };
  if (/^poi-|^label-peak/.test(id)) {
    const type = (p.subclass || p.class || '').replace(/_/g, ' ');
    return { title: p.name || cap(type || 'Place'), bits: [p.name && type ? e(cap(type)) : '', p.ele ? `${e(p.ele)} m` : ''].filter(Boolean) };
  }
  if (id === 'uphill-line' || /^(path|track|cycleway|road)-/.test(id)) return way(feats, ctx);
  return null;
}

// Trail or road: name (from a LIPAS route on it), difficulty, uphill grade, surface.
function way(feats, ctx) {
  const w = wayKind(feats);
  const route = feats.find((x) => x.layer.id === 'lipas-route');
  const up = feats.find((x) => x.layer.id === 'uphill-line');
  const bits = [];
  const title = (route && route.properties.name) || (w ? w.name : 'Trail');
  if (route && route.properties.name && w) bits.push(e(w.name));
  const wp = w ? w.p : {};
  const idx = wp.mtb_scale != null ? parseInt(String(wp.mtb_scale), 10) : NaN;
  if (Number.isFinite(idx)) bits.push(`${dot(DIFF_COLORS[idx])}S${idx}`);
  if (up) bits.push(`${dot(DIFF_COLORS[up.properties.cls])}${UPHILL_TEXT[up.properties.cls].split(' ')[0]} ${up.properties.grade} %`);
  const upAt = bits.length;
  if (wp.surface) bits.push(e(String(wp.surface).replace(/_/g, ' ')));
  if (wp.bicycle === 'no') bits.push('no bikes');
  if (wp.brunnel === 'bridge') bits.push('bridge');
  const d = { title, bits, upAt };
  // uphill layer off (or not computed here): work out the incline on the spot
  if (!up && w && ctx) {
    const trail = /^(path|track|cycleway)-/.test(w.f.layer.id);
    d.pending = gradeHere(w.f, ctx.ll).then((r) => r && (ctx.mtb && trail
      ? `${dot(DIFF_COLORS[r.cls])}${UPHILL_TEXT[r.cls].split(' ')[0]} ${r.grade} %`
      : `${r.grade} % incline`));
  }
  return d;
}

function nautical(p) {
  const nav = (k) => (NAV_TEXT[k] || '').split(/ \(| — /)[0];
  switch (p.kind) {
    case 'mark': return {
      title: p.name || MARK_TYPE[p.type] || p.type || 'Mark',
      bits: [p.name ? e(MARK_TYPE[p.type] || p.type || '') : '', e(nav(p.nav)), p.fault ? '<em class="bad">fault reported</em>' : p.lit ? 'lit' : ''].filter(Boolean),
    };
    case 'fault': return { title: p.name || 'Aid to navigation', bits: ['<em class="bad">fault reported</em>', e(p.fault || '')].filter(Boolean) };
    case 'sign': return { title: p.name || 'Waterway sign', bits: [e(p.label && p.label !== 'i' ? p.label : ''), e(p.where || '')].filter(Boolean) };
    case 'sector': return { title: `${cap(SECTOR_NAME[p.code] || 'light')} light sector`, bits: [`${p.from}°–${p.to}° towards the light`] };
    case 'navline': return { title: p.fairway || 'Navigation line', bits: [e(p.type || ''), p.swept ? `swept ${(+p.swept).toFixed(1)} m` : ''].filter(Boolean) };
    case 'fairway': return { title: p.fairway || 'Fairway', bits: [p.depth ? `swept ${(+p.depth).toFixed(1)} m` : '', 'ships use it'].filter(Boolean) };
    case 'speed': case 'restrict': return { title: p.place || 'Restriction area', bits: [e(p.limit || p.what || '')].filter(Boolean) };
    default: return null;
  }
}
