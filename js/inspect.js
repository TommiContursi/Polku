// Click-to-inspect: trails, roads, POIs, LIPAS places/routes and water depth.
// Shows what the vector tiles know instantly, then enriches from Overpass /
// Traficom on demand.

import { DIFF_COLORS, MTB_SCALE_TEXT, UPHILL_TEXT, TRAFICOM_WMS, LIPAS_TYPES, isLipasRoute } from './config.js';

// LIPAS's winter lines aren't to ride: what each one is for instead
const WINTER_LIPAS_NOTE = {
  4402: 'A ski track: keep off it on foot and by bike. Whether it’s groomed: the operator’s website.',
  4421: 'A snowmobile route: for snowmobiles, not a way to walk or ride.',
  1550: 'A skating route on natural ice. Polku never says ice is safe: check the operator’s status before you go.',
};
import { elevation } from './dem.js';
import { gradeHere } from './uphill.js';
import { overpass } from './osm.js';
import { obstacleText, VIS_TEXT } from './trails.js';
import { dist, pointSegment } from './geo.js';
import { h, icon, escapeHtml } from './ui.js';
import { NAV_TEXT } from './nautical.js';
import { WINTER_TEXT } from './winter.js';
import { request } from './net.js';

export const WAY_NAMES = {
  path: 'Path', footway: 'Footpath', bridleway: 'Bridleway', steps: 'Steps', cycleway: 'Cycleway',
  pedestrian: 'Pedestrian street', track: 'Forest road / track', service: 'Service road', minor: 'Minor road',
  tertiary: 'Local road', secondary: 'Regional road', primary: 'Main road', trunk: 'Highway', motorway: 'Motorway',
};

const OSM_KEYS = [
  ['name', 'Name'], ['highway', 'Type'], ['surface', 'Surface'], ['smoothness', 'Smoothness'], ['tracktype', 'Track grade'],
  ['mtb:scale', 'MTB difficulty'], ['mtb:scale:uphill', 'MTB uphill'], ['mtb:scale:imba', 'IMBA'], ['sac_scale', 'Hiking (SAC)'],
  ['trail_visibility', 'Trail visibility'], ['width', 'Width'], ['incline', 'Incline'], ['bicycle', 'Bicycle'], ['foot', 'Foot'],
  ['horse', 'Horse'], ['access', 'Access'], ['lit', 'Lit'], ['winter_road', 'Winter road'], ['operator', 'Operator'], ['note', 'Note'],
  ['mtb:winter', 'In winter (opens after snow)'], ['snowplowing', 'Ploughed'], ['winter_service', 'Winter maintenance'], ['bicycle:winter', 'Bicycle in winter'], ['foot:winter', 'Foot in winter'], ['seasonal', 'Seasonal'], ['piste:type', 'Piste'], ['piste:grooming', 'Grooming'],
];

const isHttp = (u) => /^https?:\/\//i.test(u) ? u : /^www\./i.test(u) ? `https://${u}` : '';

// Layers a click can inspect, and the order it picks from when several are
// under the pointer. The hover tooltip uses the same order, so it previews
// exactly what a click opens.
const INSPECTABLE = /^(cameras$|td-points$|td-way-tree$|td-way-ford$|winter-way$|winter-ski$|winter-closed$|nm-marks|nm-navline$|nm-sector|nm-restrict-fill|nm-fairway|sf-ships|sf-points|sf-lines|sf-aadt|military-fill|lipas-point|poi-outdoor|poi-minor|label-peak|lipas-route$|uphill-line|path-|track-|cycleway-|road-|water$)/;
// An official (LIPAS) route drawn over a trail is what a click there means: its card
// links to the trail under it, and the trail's card back to the route.
const PRIORITY = [/^cameras$/, /^sf-ships/, /^nm-marks/, /^sf-points/, /^td-/, /^lipas-point/, /^poi-|^label-peak/, /^sf-lines/, /^lipas-route/, /^uphill-line/, /^(path|track|cycleway)-/, /^winter-/,
  /^sf-aadt/, /^road-/, /^nm-sector/, /^nm-navline/, /^nm-restrict/, /^military/, /^nm-fairway/, /^water$/];

// a finger covers more than a mouse pointer: a wider box to find what's under it
export const hitBox = (pt, touch) => { const r = touch ? 14 : 7; return [[pt.x - r, pt.y - r], [pt.x + r, pt.y + r]]; };

export const inspectLayers = (map) => map.getLayersOrder().filter((id) => INSPECTABLE.test(id) && !id.endsWith('-casing') && !id.endsWith('-nobike'));

// The winter way at the spot: the nearest drawn one within about 10 m (a hit box also catches a
// ski track beside a cycleway, which isn't what the cycleway is like). { cls, beside } or null:
// `beside` when it's a ski track of its own next to the way you're looking at.
export function winterAt(feats, ll) {
  let best = null;
  for (const f of feats) {
    if (!/^winter-(way|ski|closed)$/.test(f.layer.id)) continue;
    const g = f.geometry, lines = g.type === 'MultiLineString' ? g.coordinates : [g.coordinates];
    let d = Infinity;
    for (const c of lines) for (let i = 1; i < c.length; i++) d = Math.min(d, pointSegment(ll, c[i - 1], c[i]).d);
    if (d <= 10 && (!best || d < best.d)) best = { d, cls: f.properties.cls };
  }
  return best && WINTER_TEXT[best.cls] ? { cls: best.cls, beside: best.cls === 'ski' } : null;
}

export function pickFeature(feats) {
  for (const re of PRIORITY) {
    const f = feats.find((x) => re.test(x.layer.id));
    if (f) return f;
  }
  return null;
}

export function initInspector(map, app) {
  let popup = null;

  // the card for a feature (a click, or a pick in search)
  async function show(f, ll, feats = []) {
    if (popup) popup.remove();
    const body = h('div', { class: 'insp' });
    popup = new maplibregl.Popup({ maxWidth: '320px', className: 'polku-popup', offset: 8 }).setLngLat(ll).setDOMContent(body).addTo(map);
    keepInView(map, popup);
    const pop = popup;
    const actions = h('div', { class: 'insp-actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => { pop.remove(); app.routeFrom(ll); }, html: `${icon('flag', 15)} Route from here` }),
      h('button', { type: 'button', class: 'btn', onclick: () => { pop.remove(); app.routeTo(ll); }, html: `${icon('plus', 15)} Add to route` }),
      h('button', { type: 'button', class: 'btn avoid', title: 'Routes will go around this spot (40 m)', onclick: () => { pop.remove(); app.avoid(ll, body.querySelector('.insp-title')?.textContent); }, html: `${icon('close', 15)} Avoid` }));

    if (/^nm-/.test(f.layer.id)) { renderNautical(body, f, map); body.append(actions); return; }
    if (/^sf-|^military/.test(f.layer.id)) { await renderSafety(body, f, app); body.append(actions); return; }
    if (/^td-/.test(f.layer.id)) renderObstacle(body, f, app);
    else if (f.layer.id === 'lipas-route') {
      renderLipas(body, f.properties);
      const under = feats.find((x) => /^(path|track|cycleway)-|^road-/.test(x.layer.id));
      if (under) body.append(h('button', { type: 'button', class: 'link insp-switch', onclick: () => show(under, ll, feats), html: `The ${(WAY_NAMES[under.properties.class === 'path' ? under.properties.subclass || 'path' : under.properties.class] || 'way').toLowerCase()} under it ${icon('chevronRight', 13)}` }));
      const wt = LIPAS_TYPES[f.properties.type];
      if (wt && wt.winter) body.append(h('p', { class: 'insp-info insp-winter', html: `${icon('snow', 14)} ${escapeHtml(WINTER_LIPAS_NOTE[f.properties.type] || '')}` }));
      else body.append(rideActions(f.properties, f.click || null, pop, f.near));
    }
    else if (/^lipas/.test(f.layer.id)) renderLipas(body, f.properties);
    else if (/^winter-/.test(f.layer.id)) renderWinter(body, f.properties);
    else if (/^poi|^label-peak/.test(f.layer.id)) renderPoi(body, f);
    else if (f.layer.id === 'water') { await renderWater(body, ll, map, app); return; }
    else renderWay(body, f, feats, ll, app.difficulty ? app.difficulty() : app.activity() === 'mtb', (g) => { g.click = ll; show(g, ll, feats); });
    if (f.layer.id !== 'lipas-route') body.append(actions);
    const ele = await elevation(ll);
    const slot = body.querySelector('[data-ele]');
    if (slot && Number.isFinite(ele)) slot.textContent = `${Math.round(ele)} m`;
  }

  // A LIPAS route's card: ride it (its own line, no routing), add all of it to
  // your route, or start a route here. What riding gives is said once LIPAS has
  // sent all its parts (one request, kept).
  function rideActions(p, click, pop, near) {
    const note = h('div', { class: 'insp-ride' }, 'Checking the route…');
    const ride = h('button', { type: 'button', class: 'btn primary', onclick: () => { pop.remove(); app.rideLipas(p, { click, near }); }, html: `${icon('route', 15)} Ride this route` });
    const add = h('button', { type: 'button', class: 'btn', title: 'Your route goes to this one and follows it', onclick: () => { pop.remove(); app.rideLipas(p, { click, near, add: true }); }, html: `${icon('plus', 15)} Add to route` });
    app.lipasRide(p, click).then((r) => {
      if (!r) { note.textContent = ''; return; }
      const km = r.km >= 10 ? Math.round(r.km) : r.km.toFixed(1);
      if (r.network) {
        note.textContent = `A network of trails: riding takes the ${click ? 'stretch you clicked' : 'longest stretch'} (${km} km). Click another to ride that one.`;
        ride.innerHTML = `${icon('route', 15)} Ride this stretch`;
      } else {
        const bits = [`${km} km`, r.loop ? 'a loop' : 'one way'];
        if (r.left >= 0.3) bits.push(`side trails (${r.left.toFixed(1)} km) left out`);
        note.textContent = `${bits.join(' · ')}. Follows LIPAS's line: no routing needed.`;
      }
    }).catch(() => { note.textContent = 'LIPAS isn\'t answering: riding may not work right now.'; });
    return h('div', {}, note, h('div', { class: 'insp-actions' }, ride, add,
      h('button', { type: 'button', class: 'btn', onclick: () => { pop.remove(); app.routeFrom(click || pop.getLngLat().toArray()); }, html: `${icon('flag', 15)} Route from here` })));
  }

  let lastTouch = 0, openAtPress = false;
  map.on('touchstart', () => { lastTouch = Date.now(); openAtPress = !!popup && popup.isOpen(); });
  map.on('click', async (e) => {
    if (app.isPlanning()) return;
    const touch = Date.now() - lastTouch < 800;
    // a finger beside an open card closes it; another tap opens the next one
    if (touch && openAtPress) { openAtPress = false; if (popup) popup.remove(); return; }
    const box = hitBox(e.point, touch);
    const ll = [e.lngLat.lng, e.lngLat.lat];
    // your route, with the planner closed: open it there
    const leg = map.getLayer('route-casing') && map.queryRenderedFeatures(box, { layers: ['route-casing'] }).find((x) => x.properties.kind === 'leg');
    if (leg && app.openRoute) { if (popup) popup.remove(); app.openRoute(leg.properties.leg, e.lngLat); return; }
    const feats = map.queryRenderedFeatures(box, { layers: inspectLayers(map) });
    const f = pickFeature(feats);
    if (popup) popup.remove();
    if (!f) return;
    // cameras and ships open their own modal / live card
    if (f.layer.id === 'cameras') { app.openCamera(f.properties.id, f.properties.name); return; }
    if (/^sf-ships/.test(f.layer.id)) { app.openShip(f.properties.mmsi); return; }
    if (f.layer.id === 'lipas-route') f.click = ll;
    show(f, ll, feats);
  });
  // the other card for the same spot: the trail under a LIPAS route, or the route a trail is part of
  app.switchCard = (f, ll, feats) => show(f, ll, feats);

  return {
    /** A LIPAS route's or stop's card (from search): props as the map layer has them. */
    openLipas(props, ll, near) {
      show({ layer: { id: isLipasRoute(props.type) ? 'lipas-route' : 'lipas-point' }, properties: props, near }, ll);
      return popup; // made before show() first waits
    },
  };
}

// Pan so the popup clears the floating buttons on the right and the top bar.
// Pan so the popup clears the top bar and the control column; `pad` also keeps
// it off a panel ({left, bottom} in px from the window's edges).
export function keepInView(map, popup, pad = {}) {
  const check = () => {
    const el = popup.getElement();
    if (!el || !popup.isOpen()) return; // closed already
    const r = el.getBoundingClientRect();
    const right = window.innerWidth - (window.innerWidth < 720 ? 64 : 84);
    const left = Math.max(8, pad.left || 0), bottom = window.innerHeight - Math.max(8, pad.bottom || 0);
    const dx = r.right > right ? r.right - right : r.left < left ? r.left - left : 0;
    const dy = r.top < 120 ? r.top - 120 : r.bottom > bottom ? Math.min(r.bottom - bottom, r.top - 120) : 0;
    if (dx || dy) map.panBy([dx, dy], { duration: 250 });
  };
  requestAnimationFrame(check);
  // a card that grows once its details are in (a LIPAS route's, with Ride) grows upwards from
  // the point it marks: look again then, so its top stays clear of the top bar
  const el = popup.getElement && popup.getElement();
  if (!el || el.polkuKeep || typeof ResizeObserver === 'undefined') return;
  let h0 = el.offsetHeight, timer = 0;
  const ro = new ResizeObserver(() => {
    if (Math.abs(el.offsetHeight - h0) < 8) return;
    h0 = el.offsetHeight;
    clearTimeout(timer);
    timer = setTimeout(check, 60);
  });
  ro.observe(el);
  el.polkuKeep = ro;
  popup.once('close', () => { ro.disconnect(); clearTimeout(timer); });
}

function row(label, value, html = false) {
  return h('div', { class: 'insp-row' }, h('span', {}, label), html ? h('b', { html: value }) : h('b', {}, value));
}

function chip(color, text) {
  return `<i class="dot" style="background:${color}"></i>${escapeHtml(text)}`;
}

function renderWay(body, f, feats, ll, mtb, open = null) {
  const p = f.properties;
  const isUphill = f.layer.id === 'uphill-line';
  const way = isUphill ? (feats.find((x) => /^(path|track)-/.test(x.layer.id)) || f) : f;
  const wp = way.properties;
  const kind = wp.class === 'path' ? (wp.subclass || 'path') : wp.class;
  body.append(h('div', { class: 'insp-title' }, WAY_NAMES[kind] || kind || 'Way'));
  const route = feats.find((x) => x.layer.id === 'lipas-route');
  if (route && route.properties.name) {
    const r = row('Part of', route.properties.name);
    if (open) { r.classList.add('insp-link'); r.title = 'Open the route’s card'; r.addEventListener('click', () => open(route)); r.lastChild.append(' ', h('span', { html: icon('chevronRight', 13) })); }
    body.append(r);
  }
  const idx = wp.mtb_scale != null ? parseInt(String(wp.mtb_scale), 10) : NaN;
  if (Number.isFinite(idx)) body.append(row('MTB difficulty', chip(DIFF_COLORS[idx], MTB_SCALE_TEXT[idx]), true));
  // what winter means on it, where the winter ways are drawn (OSM's winter tags, js/winter.js)
  const win = winterAt(feats, ll);
  if (win) body.append(win.beside ? row('Beside it', 'A ski track: keep off it on foot and by bike') : row('In winter', WINTER_TEXT[win.cls]));
  const up = feats.find((x) => x.layer.id === 'uphill-line');
  if (up) body.append(row('Uphill', chip(DIFF_COLORS[up.properties.cls], `${UPHILL_TEXT[up.properties.cls]} (${up.properties.grade} %)`), true));
  else {
    // uphill layer off: grade the ~25 m under the click from the DEM
    const trail = /^(path|track|cycleway)-/.test(way.layer.id);
    const slot = row(mtb && trail ? 'Uphill' : 'Incline', '…');
    body.append(slot);
    gradeHere(way, ll).then((r) => {
      if (!r) { slot.remove(); return; }
      slot.lastChild.innerHTML = mtb && trail ? chip(DIFF_COLORS[r.cls], `${UPHILL_TEXT[r.cls]} (${r.grade} %)`) : `${r.grade} %`;
    }).catch(() => slot.remove());
  }
  if (wp.surface) body.append(row('Surface', wp.surface));
  const access = ['bicycle', 'foot', 'horse'].filter((k) => wp[k]).map((k) => `${k} ${wp[k]}`).join(', ');
  if (access) body.append(row('Access', access));
  if (wp.brunnel) body.append(row('Structure', wp.boardwalk ? 'boardwalk (pitkospuut)' : wp.brunnel));
  if (wp.osm) trailRows(body, wp);
  body.append(h('div', { class: 'insp-row' }, h('span', {}, 'Elevation'), h('b', { 'data-ele': '' }, '…')));
  const more = h('div', { class: 'insp-more' });
  const btn = h('button', {
    type: 'button', class: 'link',
    onclick: async () => {
      btn.disabled = true;
      btn.textContent = 'Loading OSM details…';
      try {
        // a trail drawn from OSM knows its way; otherwise the nearest way to the click
        const q = wp.osm ? `[out:json][timeout:15];way(${wp.osm});out tags geom;` : `[out:json][timeout:15];way(around:12,${ll[1]},${ll[0]})[highway];out tags geom;`;
        const json = await overpass(q, { race: true });
        const ways = (json.elements || []).filter((w) => w.geometry);
        if (!ways.length) { btn.textContent = 'No OSM way found here'; return; }
        const near = ways.map((w) => {
          const g = w.geometry.map((c) => [c.lon, c.lat]);
          let d = Infinity;
          for (let i = 1; i < g.length; i++) d = Math.min(d, pointSegment(ll, g[i - 1], g[i]).d);
          return { w, d, len: g.reduce((s, c, i) => (i ? s + dist(g[i - 1], c) : 0), 0) };
        }).sort((a, b) => a.d - b.d)[0];
        btn.remove();
        const t = near.w.tags || {};
        for (const [k, label] of OSM_KEYS) if (t[k]) more.append(row(label, t[k]));
        more.append(row('Length', `${Math.round(near.len)} m`));
        more.append(h('div', { class: 'insp-links' },
          h('a', { href: `https://www.openstreetmap.org/way/${near.w.id}`, target: '_blank', rel: 'noopener', html: `OSM way ${near.w.id} ${icon('external', 13)}` }),
          h('a', { href: `https://www.openstreetmap.org/edit?way=${near.w.id}`, target: '_blank', rel: 'noopener', html: `Improve it ${icon('external', 13)}` })));
      } catch {
        btn.disabled = false;
        btn.textContent = 'Overpass is busy — try again';
      }
    },
  }, 'Show all OSM tags (sac_scale, uphill, visibility…)');
  more.append(btn);
  body.append(more);
}

// What trail details know about a trail (js/trails.js), without asking Overpass.
function trailRows(body, p) {
  if (p.width != null) body.append(row('Width', `${p.width}${/[a-z]/i.test(String(p.width)) ? '' : ' m'}`));
  if (p.tv) body.append(row('Visibility', `${p.vis ? VIS_TEXT[p.vis] : 'clear'} (${p.tv})`));
  const issues = [p.veg && 'overgrown', p.mud && 'wet or muddy', p.tree && 'fallen trees', p.wayford && 'ford'].filter(Boolean);
  if (issues.length) body.append(row('On the way', issues.join(', ')));
  if (p.smooth) body.append(row('Smoothness', String(p.smooth).replace(/_/g, ' ')));
  if (p.sac) body.append(row('Hiking (SAC)', String(p.sac).replace(/_/g, ' ')));
  if (p.informal) body.append(row('Path', 'informal (not an official trail)'));
}

function renderObstacle(body, f, app) {
  const p = f.properties;
  const { title, note } = obstacleText(p, app.bike ? app.bike() : false);
  body.append(h('div', { class: 'insp-title' }, title));
  if (note) body.append(h('div', { class: 'insp-sub' }, note));
  if (p.barrier) body.append(row('OSM', `barrier=${p.barrier}${p.obstacle ? ` · obstacle=${p.obstacle}` : ''}`));
  else if (p.obstacle) body.append(row('OSM', `obstacle=${p.obstacle}`));
  const kind = p.kind ? 'node' : 'way';
  const ll = f.geometry && f.geometry.type === 'Point' ? f.geometry.coordinates : null;
  body.append(h('div', { class: 'insp-links' },
    h('a', { href: `https://www.openstreetmap.org/${kind}/${p.osm}`, target: '_blank', rel: 'noopener', html: `OSM ${kind} ${p.osm} ${icon('external', 13)}` }),
    h('a', { href: `https://www.openstreetmap.org/edit?${kind}=${p.osm}`, target: '_blank', rel: 'noopener', html: `Gone? Fix the map ${icon('external', 13)}` }),
    // without an OpenStreetMap account to edit with: a note asks the mappers to look
    ll ? h('a', { href: `https://www.openstreetmap.org/note/new#map=19/${ll[1].toFixed(6)}/${ll[0].toFixed(6)}`, target: '_blank', rel: 'noopener', title: 'A note on the map asks OpenStreetMap’s mappers to check it', html: `or leave a note ${icon('external', 13)}` }) : null));
  body.append(h('div', { class: 'insp-row' }, h('span', {}, 'Elevation'), h('b', { 'data-ele': '' }, '…')));
}

function renderPoi(body, f) {
  const p = f.properties;
  const title = p.name || (p.subclass || p.class || 'Place').replace(/_/g, ' ');
  body.append(h('div', { class: 'insp-title' }, title));
  if (p.subclass || p.class) body.append(row('Type', (p.subclass || p.class).replace(/_/g, ' ')));
  if (p.ele) body.append(row('Height', `${p.ele} m`));
  body.append(h('div', { class: 'insp-row' }, h('span', {}, 'Elevation'), h('b', { 'data-ele': '' }, '…')));
}

// A way drawn by its winter tags with no trail of the map's under it (a ski track over a field or a lake)
function renderWinter(body, p) {
  body.append(h('div', { class: 'insp-title' }, p.name || (p.cls === 'ski' ? 'Ski track' : 'Winter way')));
  body.append(h('div', { class: 'insp-sub' }, 'OpenStreetMap, winter tags'));
  body.append(row('In winter', WINTER_TEXT[p.cls] || ''));
  if (p.grooming) body.append(row('Groomed for', String(p.grooming).replace(/\+|;/g, ' and ')));
  if (p.lit) body.append(row('Lit', 'yes'));
  if (p.cls === 'ski') body.append(h('p', { class: 'insp-info insp-winter', html: `${icon('snow', 14)} Keep off it on foot and by bike: footprints and tyre tracks spoil the track.` }));
  body.append(h('div', { class: 'insp-row' }, h('span', {}, 'Elevation'), h('b', { 'data-ele': '' }, '…')));
}

function renderLipas(body, p) {
  body.append(h('div', { class: 'insp-title' }, p.name));
  body.append(h('div', { class: 'insp-sub' }, `${p.typeName}${p.city ? ` · ${p.city}` : ''}`));
  if (p.length) body.append(row('Length', `${p.length} km`));
  if (p.surface) body.append(row('Surface', p.surface));
  if (p.wc === 'true') body.append(row('Toilet', 'yes'));
  if (p.info) body.append(h('p', { class: 'insp-info' }, p.info.length > 280 ? `${p.info.slice(0, 280)}…` : p.info));
  const www = isHttp(p.www);
  body.append(h('div', { class: 'insp-links' },
    www ? h('a', { href: www, target: '_blank', rel: 'noopener', html: `Website ${icon('external', 13)}` }) : null,
    h('a', { href: `https://www.lipas.fi/liikuntapaikat/${p.lipasId}`, target: '_blank', rel: 'noopener', html: `LIPAS ${icon('external', 13)}` })));
  body.append(h('div', { class: 'insp-row' }, h('span', {}, 'Elevation'), h('b', { 'data-ele': '' }, '…')));
}

const when = (iso) => (iso ? new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

async function renderSafety(body, f, app) {
  const p = f.properties;
  const kind = f.layer.id === 'military-fill' ? 'military' : p.kind;
  if (kind === 'incident' || kind === 'roadwork') {
    body.append(h('div', { class: 'insp-title' }, kind === 'incident' ? 'Traffic incident' : 'Road works'));
    if (p.title) body.append(h('div', { class: 'insp-sub' }, p.title));
    if (p.details) body.append(row('Effect', p.details));
    if (p.start) body.append(row('From', when(p.start)));
    if (p.end) body.append(row('Until', when(p.end)));
    if (p.where) body.append(h('p', { class: 'insp-info' }, p.where.length > 240 ? `${p.where.slice(0, 240)}…` : p.where));
    body.append(h('div', { class: 'insp-links' }, h('a', { href: 'https://liikennetilanne.fintraffic.fi/', target: '_blank', rel: 'noopener', html: `Fintraffic traffic situation ${icon('external', 13)}` })));
  } else if (kind === 'roadcond') {
    body.append(h('div', { class: 'insp-title' }, p.label));
    if (p.reasons) body.append(row('Why', p.reasons));
    if (p.roadTemp != null) body.append(row('Road surface', `${Math.round(p.roadTemp)} °C (air ${Math.round(p.temp)} °C)`));
    body.append(row('Forecast for', `${when(p.at)}${p.forecast ? ` (${p.forecast})` : ''}`));
  } else if (kind === 'aadt') {
    body.append(h('div', { class: 'insp-title' }, 'Busy road'));
    body.append(row('Traffic', `about ${Math.round(p.aadt).toLocaleString('fi-FI')} vehicles/day`));
    body.append(h('p', { class: 'insp-info' }, p.aadt >= 5000 ? 'Heavy traffic for cycling — look for a cycleway or a quieter road.' : p.aadt >= 2000 ? 'Steady traffic; often fast cars on rural roads.' : 'Moderate traffic.'));
  } else if (kind === 'ship') {
    body.append(h('div', { class: 'insp-title' }, 'Ship'));
    body.append(row('Speed', `${(p.sog || 0).toFixed(1)} kn${p.moving ? '' : ' (stopped)'}`));
    body.append(row('Position', `${p.age} min ago`));
    const v = await app.vessel(p.mmsi);
    if (v) {
      body.querySelector('.insp-title').textContent = v.name || 'Ship';
      if (v.destination) body.append(row('Destination', v.destination));
      if (v.draught) body.append(row('Draught', `${(v.draught / 10).toFixed(1)} m`));
    }
    body.append(h('p', { class: 'insp-info' }, 'Big ships can’t stop or turn quickly — cross fairways fast and well ahead of them.'));
  } else if (kind === 'military') {
    body.append(h('div', { class: 'insp-title' }, 'Military area'));
    body.append(h('p', { class: 'insp-info' }, 'May be closed or have live firing. Check the Defence Forces’ notices before you go.'));
  }
}

export const MARK_TYPE = {
  Viitta: 'Spar buoy', Poiju: 'Buoy', Reunamerkki: 'Edge mark (fixed)', Linjamerkki: 'Leading mark', Kummeli: 'Cairn',
  Sektoriloisto: 'Sector light', Merimajakka: 'Lighthouse', Tunnusmajakka: 'Landmark lighthouse', Apuloisto: 'Auxiliary light',
  Suuntaloisto: 'Directional light', Tutkamerkki: 'Radar reflector mark', 'Muu merkki': 'Other mark',
};
export const SECTOR_NAME = { p: 'red', vi: 'green', v: 'white', k: 'yellow' };

function renderNautical(body, f, map) {
  const p = f.properties;
  if (p.kind === 'mark') {
    body.append(h('div', { class: 'insp-title' }, p.name || MARK_TYPE[p.type] || p.type || 'Mark'));
    body.append(h('div', { class: 'insp-sub' }, [MARK_TYPE[p.type] || p.type, p.sub === 'KELLUVA' ? 'floating' : p.sub ? 'fixed' : ''].filter(Boolean).join(' · ')));
    if (p.nav && NAV_TEXT[p.nav]) body.append(row('Meaning', NAV_TEXT[p.nav]));
    const lt = p.num ? map.querySourceFeatures('nmLights', { filter: ['==', ['get', 'num'], p.num] })[0] : null;
    if (lt) {
      const q = lt.properties;
      body.append(row('Light', `${q.char}${q.charFi && q.charFi !== q.char ? ` (${q.charFi})` : ''}`));
      if (q.range) body.append(row('Range', `${q.range} nm`));
      if (q.height) body.append(row('Height', `${q.height} m above water`));
    } else body.append(row('Light', p.lit ? 'Lit at night' : 'Unlit'));
    if (p.fault) body.append(row('Status', '<span class="pill bad">Reported fault</span>', true));
    if (p.where) body.append(row('Location', p.where));
    if (p.owner) body.append(row('Maintained by', p.owner.trim()));
    if (p.num) body.append(row('Number', p.num));
  } else if (p.kind === 'fault') {
    body.append(h('div', { class: 'insp-title' }, p.name || 'Aid to navigation'));
    body.append(h('div', { class: 'insp-sub' }, 'Reported fault'));
    body.append(row('Fault', p.fault));
    if (p.atonType) body.append(row('Type', p.atonType));
    if (p.fairway) body.append(row('Fairway', p.fairway));
    if (p.since) body.append(row('Since', new Date(p.since).toLocaleDateString()));
    body.append(h('p', { class: 'insp-info' }, 'Don’t rely on this mark — the light may be out or the buoy moved.'));
  } else if (p.kind === 'sign') {
    body.append(h('div', { class: 'insp-title' }, 'Waterway sign'));
    if (p.label) body.append(row('Value', p.label));
    if (p.extra) body.append(row('Plate', p.extra));
    if (p.where) body.append(row('Location', p.where));
  } else if (p.kind === 'navline') {
    body.append(h('div', { class: 'insp-title' }, p.fairway || 'Navigation line'));
    body.append(h('div', { class: 'insp-sub' }, p.type || 'Navigation line'));
    if (p.swept) body.append(row('Swept depth', `${(+p.swept).toFixed(1)} m`));
    if (p.draught) body.append(row('Design draught', `${(+p.draught).toFixed(1)} m`));
    if (p.bearing != null) body.append(row('Direction', `${Math.round(p.bearing)}°`));
  } else if (p.kind === 'fairway') {
    body.append(h('div', { class: 'insp-title' }, p.fairway || 'Fairway area'));
    if (p.depth) body.append(row('Swept depth', `${(+p.depth).toFixed(1)} m`));
    if (p.marking) body.append(row('Marking', p.marking));
    if (p.traffic) body.append(row('Traffic', p.traffic));
    body.append(h('p', { class: 'insp-info' }, 'Ships use this fairway. Paddle along its edge, cross it quickly and at right angles.'));
  } else if (p.kind === 'speed' || p.kind === 'restrict') {
    body.append(h('div', { class: 'insp-title' }, p.place || 'Restriction area'));
    if (p.limit) body.append(row('Speed limit', p.limit));
    if (p.what) body.append(row('Rules', p.what));
    if (p.info) body.append(h('p', { class: 'insp-info' }, p.info.length > 220 ? `${p.info.slice(0, 220)}…` : p.info));
  } else if (p.kind === 'sector') {
    body.append(h('div', { class: 'insp-title' }, `${(SECTOR_NAME[p.code] || 'Light').replace(/^./, (c) => c.toUpperCase())} light sector`));
    body.append(row('Bearings', `${p.from}° – ${p.to}° (towards the light)`));
    body.append(h('p', { class: 'insp-info' }, 'White = safe passage, red / green = off the fairway on that side.'));
  }
}

async function renderWater(body, ll, map, app) {
  body.append(h('div', { class: 'insp-title' }, 'Water'));
  const depthRow = row('Depth', '…');
  body.append(depthRow);
  body.append(h('div', { class: 'insp-actions' },
    h('button', { type: 'button', class: 'btn', onclick: () => app.routeFrom(ll, 'water'), html: `${icon('paddle', 15)} Paddle from here` })));
  try {
    const R = 400;
    const k = 20037508.34;
    const x = (ll[0] * k) / 180;
    const y = (Math.log(Math.tan(((90 + ll[1]) * Math.PI) / 360)) * k) / Math.PI;
    const url = `${TRAFICOM_WMS}?service=WMS&request=GetFeatureInfo&version=1.1.1&layers=DepthArea_A&query_layers=DepthArea_A&styles=` +
      `&srs=EPSG:3857&bbox=${x - R},${y - R},${x + R},${y + R}&width=101&height=101&x=50&y=50&info_format=application/json&feature_count=1`;
    const res = await request('traficom', url);
    const j = await res.json();
    const pr = j.features && j.features[0] && j.features[0].properties;
    depthRow.lastChild.textContent = pr ? `${pr.DRVAL1}–${pr.DRVAL2} m (Traficom chart)` : 'Not charted here';
  } catch {
    depthRow.lastChild.textContent = 'Unavailable';
  }
}
