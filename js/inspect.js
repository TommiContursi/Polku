// Click-to-inspect: what the map's own cards show with the planner put away. Ways, places and LIPAS's routes and places
// open on the planner's card (25d part 6: openSpot()); ships, cameras, sea marks, road works and the water's depth keep
// their own cards here, from what the map draws and, on demand, Overpass and Traficom.

import { TRAFICOM_WMS, isLipasRoute } from './config.js';
import { overpass } from './osm.js';
import { dist, pointSegment } from './geo.js';
import { h, icon } from './ui.js';
import { NAV_TEXT } from './nautical.js';
import { WINTER_TEXT } from './winter.js';
import { request } from './net.js';

export const WAY_NAMES = {
  path: 'Path', footway: 'Footpath', bridleway: 'Bridleway', steps: 'Steps', cycleway: 'Cycleway',
  pedestrian: 'Pedestrian street', track: 'Forest road / track', service: 'Service road', minor: 'Minor road',
  tertiary: 'Local road', secondary: 'Regional road', primary: 'Main road', trunk: 'Highway', motorway: 'Motorway',
};

export const OSM_KEYS = [
  ['name', 'Name'], ['highway', 'Type'], ['surface', 'Surface'], ['smoothness', 'Smoothness'], ['tracktype', 'Track grade'],
  ['mtb:scale', 'MTB difficulty'], ['mtb:scale:uphill', 'MTB uphill'], ['mtb:scale:imba', 'IMBA'], ['sac_scale', 'Hiking (SAC)'],
  ['trail_visibility', 'Trail visibility'], ['width', 'Width'], ['incline', 'Incline'], ['bicycle', 'Bicycle'], ['foot', 'Foot'],
  ['horse', 'Horse'], ['access', 'Access'], ['lit', 'Lit'], ['winter_road', 'Winter road'], ['operator', 'Operator'], ['note', 'Note'],
  ['mtb:winter', 'In winter (opens after snow)'], ['snowplowing', 'Ploughed'], ['winter_service', 'Winter maintenance'], ['bicycle:winter', 'Bicycle in winter'], ['foot:winter', 'Foot in winter'], ['seasonal', 'Seasonal'], ['piste:type', 'Piste'], ['piste:grooming', 'Grooming'],
];

// Not right? (25d part 6): a note on OpenStreetMap at the spot asks its mappers to look, with no account; with the way's
// or the place's own id, its editor
export const notRight = ([lon, lat], osm = null) => (osm && osm.id ? `https://www.openstreetmap.org/edit?${osm.type}=${osm.id}` : `https://www.openstreetmap.org/note/new#map=19/${lat.toFixed(6)}/${lon.toFixed(6)}`);
export const isHttp = (u) => /^https?:\/\//i.test(u) ? u : /^www\./i.test(u) ? `https://${u}` : '';

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

  // the card for a ship's, a sea mark's, a road's or the water's feature
  async function show(f, ll) {
    if (popup) popup.remove();
    // as wide as the room beside the map's buttons, or over them where it's too narrow (a phone at 200 %); a tall
    // card scrolls inside the room there is, under the top bar, less its padding and its tip (#435)
    const beside = window.innerWidth - columnWidth() - 8;
    const body = h('div', { class: 'insp', style: `max-height: ${Math.max(220, window.innerHeight - 8 - 120 - 24 - 10)}px` });
    popup = new maplibregl.Popup({ maxWidth: `${beside >= INSP_LEAST ? Math.min(320, beside) : window.innerWidth - 16}px`, className: 'polku-popup', offset: 8 }).setLngLat(ll).setDOMContent(body).addTo(map);
    keepInView(map, popup);
    const pop = popup;
    const actions = h('div', { class: 'insp-actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => { pop.remove(); app.routeFrom(ll); }, html: `${icon('flag', 15)} Route from here` }),
      h('button', { type: 'button', class: 'btn', onclick: () => { pop.remove(); app.routeTo(ll); }, html: `${icon('plus', 15)} Add to route` }),
      h('button', { type: 'button', class: 'btn avoid', title: 'Routes will go around this spot (40 m)', onclick: () => { pop.remove(); app.avoid(ll, body.querySelector('.insp-title')?.textContent); }, html: `${icon('close', 15)} Avoid` }));
    if (/^nm-/.test(f.layer.id)) { renderNautical(body, f, map); body.append(actions); return; }
    if (/^sf-|^military/.test(f.layer.id)) { await renderSafety(body, f, app); body.append(actions); return; }
    await renderWater(body, ll, map, app);
  }

  let lastTouch = 0, openAtPress = false;
  map.on('touchstart', () => { lastTouch = Date.now(); openAtPress = (!!popup && popup.isOpen()) || app.cardOpen(); });
  map.on('click', async (e) => {
    if (app.isPlanning(e)) return; // (the planner's: drawing, or something it took in the route's view)
    const touch = Date.now() - lastTouch < 800;
    // a finger beside an open card closes it; another tap opens the next one
    if (touch && openAtPress) { openAtPress = false; if (popup) popup.remove(); app.closeCard(); return; }
    const box = hitBox(e.point, touch);
    const ll = [e.lngLat.lng, e.lngLat.lat];
    // a marker of Check's on your route (25d part 3): its card
    const head = app.headAt && app.headAt(e.point, touch);
    if (head) { if (popup) popup.remove(); app.openHead(head); return; }
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
    // a way, a place, a LIPAS route or place: the planner's card at the spot (25d part 6)
    if (!/^(nm-|sf-|military|water$)/.test(f.layer.id)) { app.openSpot(f, ll, e.point, touch); return; }
    show(f, ll);
  });

  return {
    /** A LIPAS route's or place's card (from search): props as the map layer has them. */
    openLipas(props, ll, near) {
      app.openSpot({ layer: { id: isLipasRoute(props.type) ? 'lipas-route' : 'lipas-point' }, properties: props, near }, ll, null, false);
    },
  };
}

// Pan so the popup clears the floating buttons on the right and the top bar.
// Pan so the popup clears the top bar and the control column; `pad` also keeps
// it off a panel ({left, bottom} in px from the window's edges). A popup too wide to sit beside the
// column (a phone at 200 %) goes over it, and the map's buttons step aside while it's open (#435).
export function keepInView(map, popup, pad = {}) {
  const check = () => {
    const el = popup.getElement();
    if (!el || !popup.isOpen()) return; // closed already
    const r = el.getBoundingClientRect();
    const left = Math.max(8, pad.left || 0), bottom = window.innerHeight - Math.max(8, pad.bottom || 0);
    const over = r.width > window.innerWidth - columnWidth() - left;
    overColumn(popup, over);
    const right = window.innerWidth - (over ? 8 : columnWidth());
    const dx = r.right > right ? r.right - right : r.left < left ? r.left - left : 0;
    const dy = r.top < 120 ? r.top - 120 : r.bottom > bottom ? Math.min(r.bottom - bottom, r.top - 120) : 0;
    if (dx || dy) map.panBy([dx, dy], { duration: 250 });
  };
  requestAnimationFrame(check);
  // a card that grows once its details are in (a LIPAS route's, with Follow) grows upwards from
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

// what the map's column of buttons takes at the right, its margins included
const columnWidth = () => (window.innerWidth < 720 ? 64 : 84);
// the map's card at its narrowest: .insp's min-width and the popup's padding (css/app.css)
const INSP_LEAST = 258;

// the popups open over the map's column; it hides while there's one
const overIt = new Set();
export function overColumn(popup, on) {
  if (on && !overIt.has(popup)) popup.once('close', () => overColumn(popup, false));
  overIt[on ? 'add' : 'delete'](popup);
  document.body.classList.toggle('card-over', overIt.size > 0);
}

function row(label, value, html = false) {
  return h('div', { class: 'insp-row' }, h('span', {}, label), html ? h('b', { html: value }) : h('b', {}, value));
}

// OpenStreetMap's way at a spot, asked once (Overpass): the way given (a trail drawn from OSM knows its own), else the
// nearest one with a highway tag within 12 m. { id, tags, len } or null.
export async function wayNear(ll, osm = null) {
  const q = osm ? `[out:json][timeout:15];way(${osm});out tags geom;` : `[out:json][timeout:15];way(around:12,${ll[1]},${ll[0]})[highway];out tags geom;`;
  const json = await overpass(q, { race: true });
  const ways = (json.elements || []).filter((w) => w.geometry);
  if (!ways.length) return null;
  const near = ways.map((w) => {
    const g = w.geometry.map((c) => [c.lon, c.lat]);
    let d = Infinity;
    for (let i = 1; i < g.length; i++) d = Math.min(d, pointSegment(ll, g[i - 1], g[i]).d);
    return { id: w.id, tags: w.tags || {}, d, len: g.reduce((s, c, i) => (i ? s + dist(g[i - 1], c) : 0), 0) };
  }).sort((a, b) => a.d - b.d)[0];
  return near;
}

// OpenStreetMap's own data for a way or a place (25d part 6), asked when you press All OpenStreetMap details: the object
// by its own number (a way, a node, a relation) when the map knows it, else a way at the spot, or the place nearest it,
// 40 m at most, with a tag of its kind. { type, id, tags, len } or null when there's none
export async function osmDetails({ type = 'way', id = null, ll }) {
  if (type === 'way') { const w = await wayNear(ll, id); return w && { type: 'way', ...w }; }
  // the object the card is about, by its own number (another may be nearer, or at the same spot)
  if (id && (type === 'node' || type === 'relation')) {
    const json = await overpass(`[out:json][timeout:15];${type}(${+id});out tags center;`, { race: true });
    const x = (json.elements || []).find((e) => e.type === type && e.id === +id);
    return x ? { type, id: x.id, tags: x.tags || {}, len: 0 } : null;
  }
  const json = await overpass(`[out:json][timeout:15];nwr(around:40,${ll[1]},${ll[0]})[~"^(amenity|tourism|leisure|natural|barrier|ford|man_made|historic)$"~"."];out tags center;`, { race: true });
  const at = (x) => (x.center ? [x.center.lon, x.center.lat] : [x.lon, x.lat]);
  const near = (json.elements || []).filter((x) => x.tags && Number.isFinite(at(x)[0])).sort((a, b) => dist(at(a), ll) - dist(at(b), ll))[0];
  return near ? { type: near.type, id: near.id, tags: near.tags, len: 0 } : null;
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
