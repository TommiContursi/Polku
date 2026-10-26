// Hover details on desktop: a line or two about what a click would open, read
// from features already drawn on the map. Never calls an API (the incline may
// read a terrain tile); the click popup keeps the full details (OSM tags, depth…).
//
// Cost: one queryRenderedFeatures per pointer rest (~0.3 ms flat, ~10 ms in
// tilted 3D), none while the pointer or the map is moving.

import { DIFF_COLORS, UPHILL_TEXT, LIPAS_TYPES } from './config.js';
import { WINTER_TEXT } from './winter.js';
import { inspectLayers, overRoutes, pickFeature, hitBox, winterAt, WAY_NAMES, MARK_TYPE, SECTOR_NAME } from './inspect.js';
import { NAV_TEXT } from './nautical.js';
import { aadtColor, fmtAadt } from './safety.js';
import { gradeHere } from './uphill.js';
import { obstacleText, detailBits } from './trails.js';
import { h, escapeHtml } from './ui.js';

const FIRST = 260; // ms the pointer rests before the first tooltip
const WARM = 90; // …and when moving on from one that was just shown
const RADIUS = 5; // px around the pointer
const DRIFT = 16; // px the pointer may move before a shown tooltip hides
const OPENS = ['cameras', 'sf-ships', 'nm-marks', 'sf-points', 'lipas-route']; // pointer cursor: these open a card

export const hoverCapable = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

/** app: { enabled(), isPlanning(), hoverRoute(props | null) } */
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

  let glowing = false; // a leg of your route glows brighter because the pointer rests on it
  const hide = () => {
    clearTimeout(timer);
    timer = 0;
    if (glowing && app.hoverLeg) { app.hoverLeg(null); glowing = false; }
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
    const onRoute = !planning && map.getLayer('route-casing') && map.queryRenderedFeatures([[x - RADIUS, y - RADIUS], [x + RADIUS, y + RADIUS]], { layers: ['route-casing'] }).find((f) => f.properties.kind !== 'gap');
    if (onRoute) {
      d = { title: 'Your route', bits: ['click to edit it'] }; // the planner is closed: a click opens it there
      if (app.hoverLeg) { app.hoverLeg(onRoute.properties.leg); glowing = true; } // that leg glows brighter (#198)
    }
    if (planning) {
      // the route line has its own live readout (see route() below)
      if (feats.some((f) => f.layer.id === 'route-casing')) { if (!route) hide(); return; }
      const ng = feats.find((f) => f.layer.id === 'nogo-fill');
      if (ng) d = { title: ng.properties.label || 'Avoided place', bits: ['Routes go around it · click to change'] };
    }
    if (!d) { const f = pickFeature(feats); d = f && describe(f, feats, { ll: map.unproject(at).toArray(), mtb: app.difficulty ? app.difficulty() : app.activity() === 'mtb', bike: app.bike ? app.bike() : false, planning }); }
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

  // The LIPAS route under the pointer is lit along all its parts (hoverRoute), as the pick is while its card is open
  let lit = '';
  const light = (p) => {
    const k = p ? `${p.type}/${p.lipasId}` : '';
    if (k !== lit) { lit = k; app.hoverRoute(p); }
  };

  // Pointer cursor over things that open a card or modal, and the route lit: one query per frame at most
  // (MapLibre's per-layer mouseenter/leave would run one per layer per move). The box is the click's (hitBox).
  const cursor = () => {
    frame = 0;
    if (!at || app.isPlanning()) { pointer = false; light(null); return; }
    // what a click picks first is what's lit: your route's line and a place's icon win over a LIPAS route (inspect.js)
    const layers = [...overRoutes(map), 'lipas-route', 'route-casing'].filter((id) => map.getLayer(id));
    const feats = map.queryRenderedFeatures(hitBox({ x: at[0], y: at[1] }, false), { layers });
    const hit = feats.some((f) => OPENS.includes(f.layer.id));
    if (hit !== pointer) { pointer = hit; canvas.style.cursor = hit ? 'pointer' : ''; }
    const top = pickFeature(feats), leg = feats.some((f) => f.layer.id === 'route-casing' && f.properties.kind === 'leg');
    light(top && top.layer.id === 'lipas-route' && !leg ? top.properties : null);
  };
  const press = () => { hide(); light(null); };

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
  canvas.addEventListener('pointerleave', () => { at = null; press(); });
  canvas.addEventListener('pointerdown', press);
  map.on('movestart', press);

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

export function describe(f, feats, ctx) {
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
  if (id === 'lipas-route') {
    const t = LIPAS_TYPES[p.type] || {};
    // a ski track, skating or snowmobile route isn't one to ride: what it's for instead
    const winterBit = { 4402: 'keep off on foot and by bike', 4421: 'for snowmobiles', 1550: 'on natural ice: check its status' }[p.type];
    return { title: p.name || p.typeName || 'Route', bits: [e(p.typeName || ''), p.length ? `${e(p.length)} km` : '', t.winter ? winterBit : ctx.planning ? '' : 'click to follow it'].filter(Boolean) };
  }
  if (/^winter-/.test(id)) return { title: p.name || (p.cls === 'ski' ? 'Ski track' : 'Winter way'), bits: [e(WINTER_TEXT[p.cls] || ''), p.grooming ? e(`groomed: ${String(p.grooming).replace(/\+|;/g, ' and ')}`) : '', p.lit ? 'lit' : ''].filter(Boolean) };
  if (/^poi-|^label-peak/.test(id)) {
    const type = (p.subclass || p.class || '').replace(/_/g, ' ');
    return { title: p.name || cap(type || 'Place'), bits: [p.name && type ? e(cap(type)) : '', p.ele ? `${e(p.ele)} m` : ''].filter(Boolean) };
  }
  if (/^td-/.test(id)) {
    const o = obstacleText(p, ctx && ctx.bike);
    return { title: o.title, bits: o.note ? [e(o.note)] : [] };
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
  // marked private or closed for your sport (the tiles fold private into no): routes keep off it
  const own = ctx && ctx.bike ? 'bicycle' : 'foot';
  if (own === 'foot' && wp.foot === 'no') bits.push('no walking');
  else if (wp.access === 'no' && !['yes', 'designated', 'permissive'].includes(wp[own])) bits.push('marked private or no access');
  if (wp.brunnel === 'bridge' && !wp.boardwalk) bits.push('bridge');
  if (wp.osm) bits.push(...detailBits(wp).map(e)); // trail details, drawn from OSM
  // what its winter colour means, where the winter ways are drawn
  const win = ctx && ctx.ll ? winterAt(feats, ctx.ll) : null;
  if (win) bits.push(win.beside ? '❄ a ski track beside it' : `❄ ${e(WINTER_TEXT[win.cls].toLowerCase())}`);
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
