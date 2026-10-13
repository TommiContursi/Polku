// Polku — app bootstrap: map, state, panels and wiring between modules.

import {
  ACTIVITIES, ACTIVITY_OVERLAYS, RASTER_OVERLAYS, DEM_URL, DEM_MAXZOOM,
  DIFF_COLORS, MTB_SCALE_TEXT, UPHILL_TEXT, LIPAS_TYPES, SAFETY_OVERLAYS, BROUTER,
} from './config.js';
import { SafetyLayers, AADT_STEPS } from './safety.js';
import { CameraLayer } from './cameras.js';
import { NauticalLayer } from './nautical.js';
import { buildStyle } from './style.js';
import { installIcons } from './icons.js';
import { Planner, parseShared } from './planner.js';
import { UphillLayer } from './uphill.js';
import { LipasLayer } from './lipas.js';
import { initInspector } from './inspect.js';
import { initHover, hoverCapable } from './hover.js';
import { registerServiceWorker, initOfflineStatus, openSaveOffline, renderOfflineSection } from './offline.js';
import { initSearch } from './search.js';
import { parseTrackFile } from './gpx.js';
import { lineLength, bbox, fmtDist } from './geo.js';
import { $, $$, h, icon, toast, store } from './ui.js';
import { initGestures } from './gestures.js';
import { initView3d } from './view3d.js';
import { CompassControl } from './compass.js';
import { onStatus, SOURCES, clock } from './net.js';
import { renderUsage } from './usage.js';
import { renderSpeedEditor } from './speeds.js';
import { WeatherOverlay, timeAtHour } from './wxmap.js';
import { isAerial } from './style.js';

// ------------------------------------------------------------------ state
const DEFAULTS = {
  activity: 'mtb',
  base: 'trail',
  trailColors: 'down',
  highContrast: false,
  hillshade: true,
  contours: true,
  terrain3d: false,
  trackpadTilt: true,
  hoverInfo: true,
  timeline: false,
  labelsDown: false,
  labelsUp: false,
  weather: { wind: false, temp: false, rain: false },
  exaggeration: 1.4,
  mmlKey: '',
  overlaysByActivity: {},
};
const state = { ...DEFAULTS, ...store.get('settings', {}) };
if (!ACTIVITIES[state.activity]) state.activity = 'mtb'; // a sport this version doesn't know
state.weather = { ...DEFAULTS.weather, ...(state.weather || {}) };
const shared = parseShared(new URLSearchParams(location.search));
if (shared && ACTIVITIES[shared.activity]) state.activity = shared.activity;

const overlaysFor = (act) => ({ ...ACTIVITY_OVERLAYS[act], ...(state.overlaysByActivity[act] || {}) });
state.overlays = overlaysFor(state.activity);

const data = {}; // live GeoJSON per app source, so style rebuilds keep it
const saveSettings = () => {
  const { overlays, ...rest } = state;
  store.set('settings', rest);
};

// ------------------------------------------------------------------ DEM + contours
const demSource = new mlcontour.DemSource({
  url: DEM_URL,
  encoding: 'terrarium',
  maxzoom: DEM_MAXZOOM,
  worker: true,
  cacheSize: 120,
  timeoutMs: 15000,
});
demSource.setupMaplibre(maplibregl);
const ctx = {
  demTiles: demSource.sharedDemProtocolUrl,
  contourTiles: demSource.contourProtocolUrl({
    multiplier: 1,
    // Finnish terrain-map style: 5 m contours with 25 m index lines up close.
    thresholds: { 9: [100, 500], 10: [50, 250], 11: [20, 100], 12: [10, 50], 13: [5, 25], 14: [5, 25], 15: [2.5, 10], 16: [2.5, 10] },
    elevationKey: 'ele',
    levelKey: 'level',
    contourLayer: 'contours',
    overzoom: 1,
  }),
  data,
};

// ------------------------------------------------------------------ map
const map = new maplibregl.Map({
  container: 'map',
  style: buildStyle(state, ctx),
  hash: true,
  center: [23.735, 61.493],
  zoom: 13.5,
  maxPitch: 80,
  attributionControl: false,
  cooperativeGestures: false,
});
installIcons(map);
initGestures(map, { trackpadTilt: () => state.terrain3d && state.trackpadTilt, trackpadRotate: () => state.trackpadTilt });
const view3d = initView3d(map, $('#view3d'));
// Rotation and tilt stay available in 2D too (right-drag, Ctrl+drag, two fingers);
// the on-screen pad appears whenever the view is tilted or 3D terrain is on.
const syncView3d = () => view3d.show(state.terrain3d || map.getPitch() > 5);
map.on('pitchend', syncView3d);
// bottom left, beside the scale bar: the bottom-right corner belongs to the map controls
map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Polku' }), 'bottom-left');
map.addControl(new maplibregl.ScaleControl({ maxWidth: 110 }), 'bottom-left');
// Zoom, compass and locate live in Polku's own control column (bottom right);
// MapLibre's geolocate stays for the location dot, out of sight.
$('.ctrl-compass').append(new CompassControl({ toast }).onAdd(map));
const geolocate = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showAccuracyCircle: true });
map.addControl(geolocate, 'top-right');
map.on('error', (e) => {
  // Tile 404s outside DEM coverage are expected; surface everything else in the console only.
  if (e && e.error && !/404|Failed to fetch|AbortError/.test(String(e.error.message || e.error))) console.warn(e.error);
});

function setData(id, fc) {
  data[id] = fc;
  const src = map.getSource(id);
  if (src) src.setData(fc);
}

function applyStyle() {
  map.setStyle(buildStyle(state, ctx), { diff: true });
  syncView3d();
  saveSettings();
}

// ------------------------------------------------------------------ modules
const uphill = new UphillLayer(map, (fc) => setData('uphill', fc));
const lipas = new LipasLayer(map, (routes, points) => { setData('lipasRoutes', routes); setData('lipasPoints', points); });

const safety = new SafetyLayers(map, { setData, time: () => timeAtHour(planner.startOffsetH) });
const cameras = new CameraLayer(map, { setData });
const nautical = new NauticalLayer(map, { setData });

const planner = new Planner(map, {
  activity: () => state.activity,
  setData,
  onStartChange: (k) => { weather.setHour(k, { silent: true }); safety.publish(); },
  onAnalysis: () => { weather.renderTime(); weather.renderStrip(); },
  hazards: (a, opt) => safety.hazardsAlong(a, opt),
  routeTip: (ev, d) => hover.route(ev, d),
  saveOffline: () => {
    const p = planner.offlinePayload();
    if (!p) { toast('Plan a route first — the area along it is what gets saved'); return; }
    openSaveOffline(p, { onSaved: () => renderSettingsPanel() });
  },
  onActiveChange: (on) => {
    syncPlanButton(on);
    // one clock: while planning, the timeline is the planner's departure section
    weather.dock(on ? planner.els.dock : null); // (planner only opens after boot, so weather exists)
    // the long attribution line would run into the planner: keep it behind its (i)
    if (on) $('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    syncPlannerPadding();
  },
});

initInspector(map, {
  isPlanning: () => planner.active,
  activity: () => state.activity,
  routeFrom: (ll, mode) => {
    planner.setActive(true);
    if (mode) planner.setMode(mode);
    planner.clear();
    planner.addPoint(ll);
    toast('Now click where you want to go');
  },
  routeTo: (ll) => { planner.setActive(true); planner.addPoint(ll); },
  avoid: (ll, label) => { planner.setActive(true); planner.addNogo(ll, 40, label || 'Avoided place'); },
  vessel: (mmsi) => safety.vessel(mmsi),
  openShip: (mmsi) => safety.openShip(mmsi),
  openCamera: (id, name) => cameras.open(id, name),
});
const hover = initHover(map, { enabled: () => state.hoverInfo && hoverCapable() && !planner.edit, isPlanning: () => planner.active, activity: () => state.activity });

initSearch(map, $('#search-input'), $('#search-results'));

// Weather overlay: image sources are swapped in place when possible; adding or
// removing one goes through a (diffed) style rebuild.
const weather = new WeatherOverlay(map, {
  setData,
  setImage(id, img) {
    const had = !!data[id];
    data[id] = img;
    const src = map.getSource(id);
    if (img && src && had) src.updateImage(img);
    else if (!!img !== had || (img && !src)) applyStyle();
  },
  setRadar(r) {
    const before = JSON.stringify(data.wxRadar || null);
    data.wxRadar = r;
    if (JSON.stringify(r || null) !== before) applyStyle();
  },
  dark: () => isAerial(state.base) || state.base === 'night',
  // the timeline and the route's departure time are one clock
  onHour: (k) => { planner.setStartOffset(k, { fromMap: true }); safety.publish(); },
  hasRoute: () => planner.points.length > 1,
  routeHours: () => (planner.analysis && planner.points.length > 1 ? (planner.analysis.timeWind || planner.analysis.time) / 3600 : 0),
  onToggle: (patch) => setWeather(patch),
  onClose: () => setTimeline(false),
  onTime: (hr) => {
    // the Weather button shows how far ahead the map is looking
    const k = Math.round(hr);
    $('.fab-time-label').textContent = k ? `+${k} h` : 'Weather';
    $('#btn-time').classList.toggle('ahead', k > 0);
    $('#btn-time').setAttribute('aria-label', k ? `Time & weather, ${k} h ahead` : 'Time & weather');
  },
});

function setTimeline(on) {
  state.timeline = on;
  weather.setOpen(on);
  if (on && planner.startOffsetH) weather.setHour(planner.startOffsetH, { silent: true });
  $('#btn-time').setAttribute('aria-pressed', String(on));
  saveSettings();
}

function setWeather(patch) {
  Object.assign(state.weather, patch);
  weather.set(state.weather);
  if (planner.startOffsetH) weather.setHour(planner.startOffsetH, { silent: true });
  // weather layers live on the timeline: switching one on opens it
  if (Object.values(patch).some(Boolean) && !state.timeline) setTimeline(true);
  applyStyle();
  renderLayersPanel();
}
// Console debugging: polku.set({ base: 'night' }) etc.
window.polku = {
  map, planner, state, uphill, lipas, weather, safety, cameras, nautical,
  set(patch) {
    if (patch.activity) { setActivity(patch.activity); delete patch.activity; }
    Object.assign(state, patch); applyStyle(); configureLayers(); renderLayersPanel(); renderSettingsPanel();
  },
};

// Plan sits where the planner opens: in the search bar on desktop (side panel
// below it), at the bottom on phones (the sheet takes its place, with its own Done).
function syncPlanButton(on) {
  for (const b of $$('#btn-plan, #btn-plan-search')) {
    b.setAttribute('aria-expanded', String(on));
    b.title = on ? 'Done — close the planner (R), the route stays' : 'Plan a route (R)';
  }
  // the column's button stays in its place: Plan, or Done while planning
  $('#btn-plan').innerHTML = on ? `${icon('check', 22)}<span>Done</span>` : `${icon('route', 22)}<span>Plan<span class="plan-more"> route</span></span>`;
}

// What the planner covers: --sheet-h for the bottom sheet, --pl-left for the side panel.
function syncPlannerPadding() {
  const sheet = $('#planner');
  const open = planner.active && !sheet.hidden;
  const side = open && planner.layout() === 'side';
  document.documentElement.style.setProperty('--sheet-h', `${open && !side ? sheet.offsetHeight : 0}px`);
  document.documentElement.style.setProperty('--pl-left', `${side ? sheet.getBoundingClientRect().right : 0}px`);
}
new ResizeObserver(syncPlannerPadding).observe($('#planner'));

const DANGER_TYPES = Object.entries(LIPAS_TYPES).filter(([, t]) => t.danger).map(([k]) => +k);

function configureLayers() {
  const a = ACTIVITIES[state.activity];
  const o = state.overlays;
  lipas.configure({
    routes: a.lipas.routes,
    points: [...(o.lipasPoints ? a.lipas.points : []), ...(o.restricted ? DANGER_TYPES : [])],
    showRoutes: !!o.lipasRoutes,
    showPoints: !!(o.lipasPoints || o.restricted),
  });
  safety.configure({ traffic: !!o.sfTraffic, incidents: !!o.sfIncidents, roadworks: !!o.sfRoadworks, roadcond: !!o.sfRoadcond, ships: !!o.sfShips });
  cameras.setEnabled(!!o.sfCameras);
  nautical.setEnabled(!!o.nautical);
  uphill.setEnabled(state.activity === 'mtb' && (state.trailColors !== 'down' || state.labelsUp));
}

// ------------------------------------------------------------------ activity pill
// Only the active sport shows, beside the search. Hover (mouse) or tap opens the
// others; picking one, Escape or leaving closes it.
const ACT_ICONS = { mtb: 'bike', gravel: 'gravel', road: 'roadbike', hike: 'hike', trailrun: 'trailrun', run: 'run', paddle: 'paddle' };
const hoverPointer = matchMedia('(hover: hover) and (pointer: fine)');
function renderActivityBar() {
  const box = $('#activity-bar');
  box.innerHTML = '';
  const cur = ACTIVITIES[state.activity];
  const menu = h('div', { class: 'act-menu', role: 'listbox', 'aria-label': 'Activity', hidden: true },
    ...Object.entries(ACTIVITIES).map(([k, a]) => h('button', {
      type: 'button', role: 'option', class: 'act', 'aria-selected': String(state.activity === k), 'data-k': k,
      onclick: () => { closeActs(); setActivity(k); }, html: `${icon(ACT_ICONS[k], 20)}<span>${a.label}</span>`,
    })));
  const btn = h('button', {
    type: 'button', class: 'act-current', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', title: `Activity: ${cur.label}`,
    onclick: () => (menu.hidden ? openActs() : closeActs()),
    html: `${icon(ACT_ICONS[state.activity], 20)}<span>${cur.label}</span>${icon('chevronDown', 16)}`,
  });
  box.append(btn, menu);
}
let actTimer = 0;
function openActs() {
  const box = $('#activity-bar');
  clearTimeout(actTimer);
  box.querySelector('.act-menu').hidden = false;
  box.querySelector('.act-current').setAttribute('aria-expanded', 'true');
  box.classList.add('open');
}
function closeActs() {
  const box = $('#activity-bar');
  const m = box.querySelector('.act-menu');
  if (!m || m.hidden) return;
  m.hidden = true;
  box.querySelector('.act-current').setAttribute('aria-expanded', 'false');
  box.classList.remove('open');
}
{
  const box = $('#activity-bar');
  box.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && hoverPointer.matches) openActs(); });
  box.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && hoverPointer.matches) { clearTimeout(actTimer); actTimer = setTimeout(closeActs, 250); } });
  box.addEventListener('keydown', (e) => {
    const opts = [...box.querySelectorAll('.act-menu .act')];
    const i = opts.indexOf(document.activeElement);
    if (e.key === 'Escape') { closeActs(); box.querySelector('.act-current').focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openActs();
      const n = opts.length;
      opts[i < 0 ? (e.key === 'ArrowDown' ? 0 : n - 1) : (i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n].focus();
    }
  });
  document.addEventListener('pointerdown', (e) => { if (!box.contains(e.target)) closeActs(); }, true);
}

// ------------------------------------------------------------------ base maps
const BASES = [['trail', 'Trail map'], ['maasto', 'Maastokartta'], ['aerial', 'Aerial'], ['ortofi', 'Aerial FI'], ['plain', 'Plain'], ['night', 'Night'], ['mml', 'MML WMTS']];
const BASE_NOTE = {
  trail: 'Polku’s own trail map from OpenStreetMap, with lidar hillshade and contours.',
  maasto: 'The National Land Survey terrain map (via Kapsi), with Polku’s trails on top. Finland only.',
  aerial: 'Esri world imagery with trails on top.',
  ortofi: 'National Land Survey aerial photos (via Kapsi) — sharper than global imagery in Finland.',
  plain: 'Muted base for reading routes and overlays.',
  night: 'Dark map for dusk and night use.',
  mml: 'Official MML WMTS terrain map with your own API key.',
};
const thumb = (k) => `img/base/${{ aerial: 'ortofi', mml: 'maasto' }[k] || k}.jpg`;
// The Layers button shows the current base map: what the map looks like and
// what is drawn on it are one place.
function syncLayersButton() {
  const b = BASES.find(([k]) => k === state.base) || BASES[0];
  $('#btn-layers .fab-thumb').src = thumb(b[0]);
  $('#btn-layers').title = `Layers — ${b[1]}, trails, weather, traffic… (L)`;
}

// What switching sport changes, said once so the connection is clear.
const SPORT_NOTE = {
  mtb: 'trails coloured by MTB difficulty, MTB routing, MTB routes and lean-tos',
  gravel: 'unpaved roads highlighted, gravel routing, traffic and road works',
  road: 'paved routing on quieter roads, unpaved stretches marked, traffic, road works and road conditions',
  hike: 'paths highlighted, walking routes, hiking trails and huts',
  trailrun: 'paths highlighted, trail routing, running times that walk the steep bits, trails and huts',
  run: 'footways and paths, running pace, lit fitness trails (kuntorata) and walking routes',
  paddle: 'water routing, depths, nautical marks and ships',
};

function setActivity(k) {
  if (state.activity === k) return;
  state.activity = k;
  state.overlays = overlaysFor(k);
  document.body.dataset.activity = k;
  renderActivityBar();
  renderLayersPanel();
  renderSettingsPanel();
  applyStyle();
  configureLayers();
  planner.onActivityChange();
  toast(`${ACTIVITIES[k].label}: ${SPORT_NOTE[k]}. Change any of it in Layers.`, { ms: 5000 });
}

function set3d(on) {
  state.terrain3d = on;
  applyStyle();
  map.easeTo({ pitch: on ? Math.max(60, map.getPitch()) : 0, duration: 800 });
  renderLayersPanel();
}

// ------------------------------------------------------------------ layers panel
function setOverlay(id, on) {
  state.overlays[id] = on;
  state.overlaysByActivity[state.activity] = { ...(state.overlaysByActivity[state.activity] || {}), [id]: on };
  applyStyle();
  configureLayers();
}

const OVERLAY_LABEL = {
  nautical: 'Nautical marks & fairways',
  lipasRoutes: 'Official routes (LIPAS)',
  lipasPoints: 'Lean-tos, huts, campfire & landing sites (LIPAS)',
  pois: 'OSM outdoor places',
};
const OVERLAY_NOTE = {
  nautical: 'Buoys, lights & sectors, fairways, depths, speed limits · Väylävirasto · zoom 11+',
  lipasRoutes: 'LIPAS, Finland',
  lipasPoints: 'LIPAS, Finland',
  pois: 'OpenStreetMap',
};
const overlayLabel = (id) => OVERLAY_LABEL[id] || (RASTER_OVERLAYS[id] && RASTER_OVERLAYS[id].label) || (SAFETY_OVERLAYS[id] && SAFETY_OVERLAYS[id].label) || id;

// Groups of the Layers panel (base maps sit above them; weather and terrain are state, not overlays).
const LAYER_GROUPS = [
  { id: 'routes', title: 'Marked routes', ids: ['lipasRoutes', 'wmtHiking', 'wmtMtb', 'wmtCycling'] },
  { id: 'places', title: 'Places', ids: ['lipasPoints', 'pois'] },
  { id: 'water', title: 'Water & nautical', ids: ['nautical', 'depthAreas', 'depthContours', 'soundings', 'fairways'] },
  { id: 'safety', title: 'Traffic & safety', ids: Object.keys(SAFETY_OVERLAYS) },
  { id: 'roads', title: 'Roads (Digiroad)', ids: ['drPaved', 'drPrivate', 'drSpeed'] },
];

// Map keys, next to the layers they explain.
const keyItem = (swatch, label) => h('div', { class: 'lg-item' }, swatch, h('span', {}, label));
const keyLine = (style) => h('span', { class: 'lg-line', style });
const keyDot = (style) => h('span', { class: 'lg-dot', style });
const mapKey = (...items) => h('details', { class: 'lg-key' }, h('summary', {}, 'Map key'), h('div', {}, ...items));
const KEYS = {
  trails: () => [
    ...(state.activity === 'mtb' && state.trailColors !== 'up'
      ? [h('h4', {}, 'MTB difficulty (halo)'), ...MTB_SCALE_TEXT.slice(0, 6).map((t, i) => keyItem(keyLine(`background:${DIFF_COLORS[i]};height:8px`), t)), keyItem(keyLine('background:#fff;height:8px;box-shadow:inset 0 0 0 1px #ccc'), 'Not graded in OSM')] : []),
    ...(state.activity === 'mtb' && state.trailColors !== 'down'
      ? [h('h4', {}, state.trailColors === 'both' ? 'Uphill difficulty (stripe)' : 'Uphill difficulty'), ...UPHILL_TEXT.map((t, i) => keyItem(keyLine(`background:${DIFF_COLORS[i]};height:${state.trailColors === 'both' ? 4 : 8}px`), t)), keyItem(h('span', { class: 'lg-arrow' }, '»'), 'Uphill direction (8 %+)')] : []),
    h('h4', {}, 'Ways'),
    keyItem(keyLine('border-top:2px dashed #1f1f1f'), 'Path / trail'),
    keyItem(keyLine('border-top:2px dashed #6b4f2a;border-image:repeating-linear-gradient(90deg,#6b4f2a 0 12px,transparent 12px 15px) 1'), 'Forest road / track'),
    keyItem(keyLine('background:#5b7fa8;height:2px'), 'Cycleway (paved)'),
    keyItem(keyLine('border-top:3px dotted #dc2626'), 'No bikes (beside a path)'),
    state.activity === 'gravel' || state.activity === 'road' ? keyItem(keyLine('background:#fde7c1;height:6px;box-shadow:0 0 0 2px #c4842d'), 'Unpaved road') : null,
    keyItem(keyLine('background:#3f8f3f;height:2px;opacity:.7'), 'Protected area boundary'),
    h('h4', {}, 'Your route'),
    keyItem(keyLine('background:#e11d48;height:5px'), 'Follows paths'),
    keyItem(keyLine('background:#0369a1;height:5px'), 'Over water'),
    keyItem(keyLine('border-top:5px dotted #ea580c'), 'Carry / portage'),
    keyItem(keyLine('border-top:4px dashed #be123c'), 'Straight line'),
  ],
  places: () => Object.values(LIPAS_TYPES).filter((t) => t.icon).map((t) => keyItem(keyDot(`background:${t.color}`), t.name)),
  water: () => [
    keyItem(keyDot('background:#dc2626;border-radius:2px'), 'Port-hand mark — keep left going in'),
    keyItem(keyDot('background:#16a34a;border-radius:2px'), 'Starboard-hand mark — keep right going in'),
    keyItem(keyDot('background:linear-gradient(#111827 50%,#facc15 50%);border-radius:2px'), 'Cardinal marks: pass on the side they name'),
    keyItem(keyDot('background:#c026d3'), 'Light (with sectors: red / green / white)'),
    keyItem(keyLine('border-top:2px dashed #111827'), 'Navigation line with swept depth'),
    keyItem(keyLine('background:rgba(168,85,247,.25);height:10px'), 'Fairway area'),
    keyItem(keyLine('border-top:2px dashed #be185d'), 'Speed limit / restriction area'),
  ],
  safety: () => [
    ...AADT_STEPS.map(([min, c], i) => keyItem(keyLine(`background:${c};height:6px`), `${min.toLocaleString('fi-FI')}${AADT_STEPS[i + 1] ? `–${AADT_STEPS[i + 1][0].toLocaleString('fi-FI')}` : '+'} vehicles/day`)),
    keyItem(keyLine('background:#dc2626;height:5px'), 'Accident / incident'),
    keyItem(keyLine('border-top:5px dashed #f59e0b'), 'Road works'),
    keyItem(keyLine('background:#f97316;height:5px'), 'Poor road conditions (red/purple: worse)'),
    keyItem(keyLine('background:rgba(220,38,38,.15);height:12px;box-shadow:inset 0 0 0 2px #dc2626'), 'Military area / your avoided places'),
  ],
};

let usageBox = null;
const toggle = (label, on, fn, note = '') => {
  const id = `t-${Math.random().toString(36).slice(2, 8)}`;
  return h('label', { class: 'tg', for: id },
    h('span', { class: 'tg-text' }, label, note ? h('small', {}, note) : null),
    h('input', { type: 'checkbox', id, checked: on, role: 'switch', onchange: (e) => fn(e.target.checked) }),
    h('span', { class: 'tg-ui', 'aria-hidden': 'true' }));
};
const seg = (options, value, fn) => h('div', { class: 'seg small full' },
  ...options.map(([v, label, disabled]) => h('button', { type: 'button', 'aria-pressed': String(value === v), disabled: !!disabled, onclick: () => fn(v) }, label)));
const section = (title, ...kids) => h('section', { class: 'lp-sec' }, h('h3', {}, title), ...kids);

// A folding group; it opens by itself while something in it is on, until you choose.
function layerGroup(id, title, count, ...kids) {
  const openByDefault = kids[0] === true ? kids.shift() : false; // optional flag before the children
  const saved = store.get('layerGroups', {})[id];
  const d = h('details', { class: 'lg-group', open: saved ?? (openByDefault || count > 0) },
    h('summary', {}, h('span', { class: 'lg-title' }, title), count ? h('span', { class: 'lg-count' }, `${count} on`) : null), ...kids);
  d.addEventListener('toggle', () => store.set('layerGroups', { ...store.get('layerGroups', {}), [id]: d.open }));
  return d;
}

function renderLayersPanel() {
  syncLayersButton();
  const p = $('#layers-body');
  const keepScroll = p.scrollTop; // re-rendering after a toggle must not jump to the top
  requestAnimationFrame(() => { p.scrollTop = keepScroll; });
  p.innerHTML = '';
  const act = ACTIVITIES[state.activity];
  const rerender = (fn) => (v) => { fn(v); renderLayersPanel(); };

  // whose map this is: the sport sets the starting layers
  p.append(h('div', { class: 'lp-sport' },
    h('span', { html: icon(ACT_ICONS[state.activity], 18) }),
    h('span', {}, h('span', {}, 'Map for ', h('b', {}, act.label)), h('small', {}, 'Your sport sets the trail colours and which layers start on.')),
    h('button', { type: 'button', class: 'link', onclick: () => { openPanel(null); openActs(); $('#activity-bar .act-menu .act[aria-selected="true"]')?.focus(); } }, 'Change')));

  // base maps as thumbnails
  p.append(section('Base map',
    h('div', { class: 'base-grid' }, ...BASES.filter(([k]) => k !== 'mml' || state.mmlKey).map(([k, label]) => h('button', {
      type: 'button', class: 'base-opt', 'aria-pressed': String(state.base === k), title: BASE_NOTE[k],
      onclick: () => { state.base = k; applyStyle(); renderLayersPanel(); },
    }, h('img', { src: thumb(k), alt: '', width: '64', height: '64', loading: 'lazy' }), h('span', {}, label)))),
    h('p', { class: 'note' }, BASE_NOTE[state.base] || ''),
    toggle('3D terrain', state.terrain3d, (v) => set3d(v), 'Tilt with right-drag or two fingers; the pad on the map tilts and turns'),
    state.terrain3d ? h('label', { class: 'range' }, 'Exaggeration',
      h('input', { type: 'range', min: '1', max: '3', step: '0.1', value: String(state.exaggeration), oninput: (e) => { state.exaggeration = +e.target.value; map.setTerrain({ source: 'terrain', exaggeration: state.exaggeration }); saveSettings(); } })) : null));

  // terrain shading right after the base maps and 3D, open unless you close it
  p.append(layerGroup('terrain', 'Terrain', state.overlays.maastoOverlay ? 1 : 0, true,
    toggle('Hillshade', state.hillshade, (v) => { state.hillshade = v; applyStyle(); }, 'Lidar-based, multidirectional'),
    toggle('Contour lines', state.contours, (v) => { state.contours = v; applyStyle(); }, '5 m, 2.5 m when zoomed in'),
    toggle(RASTER_OVERLAYS.maastoOverlay.label, !!state.overlays.maastoOverlay, rerender((v) => setOverlay('maastoOverlay', v)), RASTER_OVERLAYS.maastoOverlay.attribution.replace('© ', '')),
    state.mmlKey ? toggle(RASTER_OVERLAYS.mmlMaastoOverlay.label, !!state.overlays.mmlMaastoOverlay, rerender((v) => setOverlay('mmlMaastoOverlay', v))) : null));

  // what is on right now, at a glance
  const on = [...LAYER_GROUPS.flatMap((g) => g.ids), 'maastoOverlay', 'mmlMaastoOverlay'].filter((id) => state.overlays[id]);
  const wx = [['wind', 'Wind'], ['temp', 'Temperature'], ['rain', 'Rain']].filter(([k]) => state.weather[k]);
  const custom = Object.keys(state.overlaysByActivity[state.activity] || {}).length > 0;
  p.append(section('On now',
    on.length || wx.length ? h('div', { class: 'on-chips' },
      ...on.map((id) => h('button', { type: 'button', class: 'on-chip', title: `Turn off ${overlayLabel(id)}`, onclick: () => { setOverlay(id, false); renderLayersPanel(); }, html: `<span>${overlayLabel(id)}</span>${icon('close', 12)}` })),
      ...wx.map(([k, l]) => h('button', { type: 'button', class: 'on-chip wx', title: `Turn off ${l.toLowerCase()} on the map`, onclick: () => setWeather({ [k]: false }), html: `<span>${l}</span>${icon('close', 12)}` })))
      : h('p', { class: 'note' }, 'No extra layers — just the base map and trails.'),
    custom ? h('button', { type: 'button', class: 'link', onclick: () => {
      state.overlaysByActivity[state.activity] = {};
      state.overlays = overlaysFor(state.activity);
      applyStyle(); configureLayers(); renderLayersPanel(); saveSettings();
      toast(`Layers back to the ${act.label} defaults`);
    } }, `Reset to ${act.label} defaults`) : null));

  // trails & difficulty (and the map key for the base map's lines)
  const trailKids = [];
  if (state.activity === 'mtb') {
    trailKids.push(
      seg([['down', 'Difficulty'], ['up', 'Uphill'], ['both', 'Both']], state.trailColors, (v) => {
        state.trailColors = v; applyStyle(); configureLayers(); renderLayersPanel();
        if (v !== 'down' && map.getZoom() < 13) toast('Zoom in to level 13+ to see uphill grades');
      }),
      h('p', { class: 'note' }, {
        down: 'Halo colour is the regular MTB difficulty from OSM mtb:scale (S0 green → S5 purple). White halo = not graded yet.',
        up: 'Uphill grade (↑S0–↑S5) computed from the lidar elevation model for every trail in view, bumped for loose or technical surface. OSM mtb:scale:uphill tags override it. Arrows point uphill.',
        both: 'Halo = regular MTB difficulty (mtb:scale). Thin stripe beside it = uphill grade, with arrows pointing uphill on climbs of 8 %+.',
      }[state.trailColors]),
      toggle('Difficulty numbers', state.labelsDown, rerender((v) => { state.labelsDown = v; applyStyle(); }), 'S0–S6 beside graded trails (zoom 15+)'),
      toggle('Uphill numbers', state.labelsUp, rerender((v) => {
        state.labelsUp = v; applyStyle(); configureLayers();
        if (v && map.getZoom() < 14.5) toast('Zoom in to level 15 to see the numbers');
      }), '↑S0–↑S5 on climbs of 6 %+ (zoom 15+)'));
  } else trailKids.push(h('p', { class: 'note' }, `Trails and roads are drawn for ${act.label.toLowerCase()}: what matters for it stands out.`));
  p.append(layerGroup('trails', state.activity === 'mtb' ? 'Trails & difficulty' : 'Trails', (state.labelsDown ? 1 : 0) + (state.labelsUp ? 1 : 0), ...trailKids, mapKey(...KEYS.trails())));

  for (const g of LAYER_GROUPS) {
    const kids = g.ids.map((id) => {
      const o = RASTER_OVERLAYS[id], sf = SAFETY_OVERLAYS[id];
      return toggle(overlayLabel(id), !!state.overlays[id], rerender((v) => {
        setOverlay(id, v);
        if (v && id === 'sfTraffic' && map.getZoom() < 10) toast('Zoom in to level 10+ to see traffic volumes');
        if (v && id === 'sfShips' && map.getZoom() < 8) toast('Zoom in to level 8+ to see ships');
      }), sf ? sf.note : o ? o.attribution.replace('© ', '') : OVERLAY_NOTE[id] || '');
    });
    if (g.id === 'safety') kids.push(h('p', { class: 'note' }, 'Planned routes are checked against these too: road works, incidents, slippery and busy roads show up under Heads-up, each with an Avoid button.'));
    if (KEYS[g.id]) kids.push(mapKey(...KEYS[g.id]()));
    p.append(layerGroup(g.id, g.title, g.ids.filter((id) => state.overlays[id]).length, ...kids));
  }

  // weather on the map — the same switches as on the Weather button's timeline
  p.append(layerGroup('weather', 'Weather on the map', wx.length + (state.timeline ? 1 : 0),
    toggle('Timeline', state.timeline, rerender((v) => setTimeline(v)), '48 h clock for weather, road conditions and your route · also the Weather button (T)'),
    toggle('Wind', state.weather.wind, (v) => setWeather({ wind: v }), 'Animated wind and speed'),
    toggle('Temperature', state.weather.temp, (v) => setWeather({ temp: v }), 'Colour field with °C labels'),
    toggle('Rain', state.weather.rain, (v) => setWeather({ rain: v }), 'Radar now (FMI / RainViewer), forecast later'),
    h('p', { class: 'note' }, 'Forecast by Open-Meteo. Scrub or play the next 48 hours on the timeline.')));


}

// ------------------------------------------------------------------ settings panel
// How Polku behaves (not what the map shows): sport, planner, display, offline, data.
let speedSport = null; // which sport's speeds Settings shows (defaults to the current one)
function renderSettingsPanel() {
  const p = $('#settings-body');
  const keepScroll = p.scrollTop;
  requestAnimationFrame(() => { p.scrollTop = keepScroll; });
  p.innerHTML = '';
  p.append(section('Sport',
    h('div', { class: 'seg small full sport-seg' }, ...Object.entries(ACTIVITIES).map(([k, a]) => h('button', {
      type: 'button', 'aria-pressed': String(state.activity === k), onclick: () => setActivity(k), html: `${icon(ACT_ICONS[k], 16)}<span>${a.label}</span>`,
    }))),
    h('p', { class: 'note' }, `Also the pill beside the search. ${ACTIVITIES[state.activity].label} gives you ${SPORT_NOTE[state.activity]}; the planner routes and times the route for it.`)));

  // speeds: the same editor as the planner's Time & speed, for any sport
  speedSport = ACTIVITIES[speedSport] ? speedSport : state.activity;
  const speedBox = h('div', { class: 'speed-box' });
  const pickSport = h('select', { class: 'start-select', 'aria-label': 'Sport for these speeds', onchange: (e) => { speedSport = e.target.value; renderSettingsPanel(); } },
    ...Object.entries(ACTIVITIES).map(([k, a]) => h('option', { value: k, selected: k === speedSport }, a.label)));
  p.append(section('Speeds',
    h('label', { class: 'speed-sport' }, 'Speeds for ', pickSport),
    speedBox,
    h('p', { class: 'note' }, 'They set the time estimate (and so the weather along the route). The planner’s Time & speed section shows the same, and where the time goes on your route. Kept on this device only.')));
  renderSpeedEditor(speedBox, speedSport, {
    craft: planner.craft, onCraft: (k) => planner.setCraft(k),
    onChange: () => { if (speedSport === state.activity) planner.retime(); },
  });

  if (planner.sideMQ && planner.sideMQ.matches) {
    p.append(section('Route planner',
      seg([['left', 'Side panel (left)'], ['bottom', 'Bottom panel']], store.get('plannerDock', 'left'), (v) => { planner.setDock(v); renderSettingsPanel(); }),
      h('p', { class: 'note' }, 'Open it with Plan or R. Its ⋯ menu has the same switch. While planning, the departure clock lives inside it.')));
  }

  p.append(section('Display',
    toggle('High contrast', state.highContrast, (v) => { state.highContrast = v; applyStyle(); }, 'Thicker trails for bright sunlight'),
    hoverCapable() ? toggle('Details on hover', state.hoverInfo, (v) => { state.hoverInfo = v; saveSettings(); }, 'Difficulty, surface or name under the mouse · click for everything') : null,
    hoverCapable() ? toggle('Trackpad rotates & tilts', state.trackpadTilt, (v) => { state.trackpadTilt = v; saveSettings(); }, 'Two-finger sideways scroll rotates; in 3D, up/down tilts. Pinch zooms') : null));

  const offlineBox = h('div', { class: 'off-list' });
  p.append(section('Offline maps', offlineBox));
  renderOfflineSection(offlineBox, { open: openOfflineArea });

  usageBox = h('div', { class: 'use-list' });
  p.append(section('Data sources', usageBox));
  renderUsage(usageBox);

  // your own BRouter: no shared limits (tools/brouter-local.sh starts one on this computer)
  const routerInput = h('input', { type: 'url', placeholder: BROUTER, value: store.get('brouterUrl', ''), autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Routing server address' });
  const routerNote = h('p', { class: 'note' });
  p.append(section('Routing server (optional)',
    h('p', { class: 'note' }, 'Routes come from brouter.de, a free public server that takes about a dozen routes a minute from one device. If you run BRouter yourself, enter its address — for one on this computer, http://localhost:17777/brouter (see tools/brouter-local.sh). Empty means brouter.de.'),
    h('div', { class: 'key-row' }, routerInput, h('button', { type: 'button', class: 'btn', onclick: async () => {
      const v = routerInput.value.trim().replace(/\/+$/, '');
      if (v && !/^https?:\/\/[^\s]+$/.test(v)) { routerNote.textContent = 'That doesn’t look like an address (http://… or https://…).'; return; }
      if (v && v !== BROUTER) {
        routerNote.textContent = 'Checking…';
        try {
          const c = map.getCenter();
          const r = await fetch(`${v}?lonlats=${c.lng.toFixed(5)},${c.lat.toFixed(5)}|${(c.lng + 0.003).toFixed(5)},${(c.lat + 0.002).toFixed(5)}&profile=trekking&alternativeidx=0&format=geojson`);
          if (!r.ok) throw new Error(((await r.text()).split('\n')[0] || `HTTP ${r.status}`).slice(0, 120));
          await r.json();
        } catch (e) { routerNote.textContent = `It didn’t answer like BRouter: ${e.message}. Not saved.`; return; }
      }
      store.set('brouterUrl', v === BROUTER ? '' : v);
      routerNote.textContent = v && v !== BROUTER ? 'Saved — routes now come from your server.' : 'Saved — routes come from brouter.de.';
      planner.retryFailed();
    } }, 'Save')), routerNote));

  const keyInput = h('input', { type: 'password', placeholder: 'Paste your MML API key', value: state.mmlKey, autocomplete: 'off', spellcheck: 'false' });
  p.append(section('MML API key (optional)',
    h('p', { class: 'note' }, 'Maastokartta works without a key via Kapsi. A key adds the official MML WMTS service as an extra base and overlay. Keys are free from ',
      h('a', { href: 'https://www.maanmittauslaitos.fi/rajapinnat/api-avaimen-ohje', target: '_blank', rel: 'noopener' }, 'maanmittauslaitos.fi'),
      ' and is stored only in this browser.'),
    h('div', { class: 'key-row' }, keyInput, h('button', { type: 'button', class: 'btn', onclick: () => {
      state.mmlKey = keyInput.value.trim();
      if (!state.mmlKey && state.base === 'mml') state.base = 'trail';
      applyStyle(); renderLayersPanel(); renderSettingsPanel(); toast(state.mmlKey ? 'MML key saved' : 'MML key removed');
    } }, 'Save'))));
}

// ------------------------------------------------------------------ panels & buttons
function openPanel(id) {
  if (id === 'settings-panel') { speedSport = state.activity; renderSettingsPanel(); } // fresh: speeds may have changed in the planner
  for (const el of $$('.panel')) {
    const on = el.id === id && el.hidden;
    el.hidden = !on;
    const btn = $(`[data-panel="${el.id}"]`);
    if (btn) btn.setAttribute('aria-pressed', String(on));
  }
}
for (const btn of $$('[data-panel]')) btn.addEventListener('click', () => openPanel(btn.dataset.panel));
for (const btn of $$('.panel .panel-close')) btn.addEventListener('click', () => openPanel(null));

for (const b of $$('#btn-plan, #btn-plan-search')) b.addEventListener('click', () => planner.setActive(!planner.active));
// While planning, the timeline is docked in the planner: the button and T open it there.
const toggleTimeline = () => {
  if (planner.active) { planner.reveal('depart'); return; }
  setTimeline(!state.timeline);
  renderLayersPanel();
};
$('#btn-time').addEventListener('click', toggleTimeline);
$('#btn-zoom-in').addEventListener('click', () => map.zoomIn());
$('#btn-zoom-out').addEventListener('click', () => map.zoomOut());

// Locate drives MapLibre's geolocate control (kept for the location dot, hidden).
$('#btn-locate').addEventListener('click', () => geolocate.trigger());
{
  const sync = () => {
    const g = $('.maplibregl-ctrl-geolocate');
    if (!g) return;
    const b = $('#btn-locate');
    const on = g.classList.contains('maplibregl-ctrl-geolocate-active') || g.classList.contains('maplibregl-ctrl-geolocate-background');
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('waiting', g.classList.contains('maplibregl-ctrl-geolocate-waiting'));
    b.classList.toggle('background', g.classList.contains('maplibregl-ctrl-geolocate-background'));
  };
  map.once('load', () => { const g = $('.maplibregl-ctrl-geolocate'); if (g) new MutationObserver(sync).observe(g, { attributes: true, attributeFilter: ['class'] }); });
}

// Phones: the floating timeline sits above the Plan pill; the map controls ride above it.
new ResizeObserver(() => {
  const b = $('#wx-bar');
  const floating = !b.hidden && !b.classList.contains('docked') && matchMedia('(max-width: 720px)').matches;
  // the column normally sits 12 px up; above the timeline (at 44 px) it needs its height plus that offset
  document.documentElement.style.setProperty('--wx-h', `${floating ? b.offsetHeight + 40 : 0}px`);
}).observe($('#wx-bar'));

// ------------------------------------------------------------------ GPX / KML import (button + drag & drop)
async function importFile(file) {
  try {
    const text = await file.text();
    const t = parseTrackFile(text, file.name);
    const coords = t.lines.flat();
    const features = t.lines.map((c) => ({ type: 'Feature', properties: { name: t.name }, geometry: { type: 'LineString', coordinates: c } }));
    setData('tracks', { type: 'FeatureCollection', features });
    const b = bbox(coords);
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 70, duration: 800 });
    showTrackCard(t.name || file.name, coords);
  } catch (e) {
    toast(e.message || 'Could not import that file', { tone: 'warn' });
  }
}
function showTrackCard(name, coords) {
  const card = $('#track-card');
  card.innerHTML = '';
  card.append(
    h('div', { class: 'tc-main' }, h('b', {}, name), h('span', {}, fmtDist(lineLength(coords)))),
    h('button', { type: 'button', class: 'btn primary', onclick: () => { planner.loadTrack(coords, name); card.hidden = true; setData('tracks', { type: 'FeatureCollection', features: [] }); } }, 'Analyse & edit'),
    h('button', { type: 'button', class: 'tool', 'aria-label': 'Remove track', onclick: () => { card.hidden = true; setData('tracks', { type: 'FeatureCollection', features: [] }); }, html: icon('close', 18) }));
  card.hidden = false;
}
$('#file-input').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; });
window.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('dropping'); });
window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
window.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('dropping');
  const f = e.dataTransfer.files[0];
  if (f) importFile(f);
});

// ------------------------------------------------------------------ keyboard
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? planner.redo() : planner.undo(); }
  else if (e.key === '/') { e.preventDefault(); $('#search-input').focus(); }
  else if (e.key === 'r' && !mod) planner.setActive(!planner.active);
  else if (e.key === 'f' && !mod && planner.points.length) { if (!planner.active) planner.setActive(true); planner.fitRoute(); }
  else if (e.key === 'l' && !mod) openPanel('layers-panel');
  else if (e.key === 't' && !mod) toggleTimeline();
  else if (e.key === 'Escape') { openPanel(null); if (planner.menu) planner.menu.remove(); planner.closeMore(); closeActs(); }
});

// The free vector tiles only carry the full trail network from zoom 14.
const zoomHint = $('#zoom-hint');
const syncZoomHint = () => { const z = map.getZoom(); zoomHint.hidden = !(z >= 10.5 && z < 13.8); };
map.on('zoomend', syncZoomHint);
zoomHint.addEventListener('click', () => map.easeTo({ zoom: 14.2, duration: 600 }));

// The page itself never scrolls: focus() on a control can otherwise scroll the
// document (it has overflow:hidden, not no-scroll) and shift the whole UI.
window.addEventListener('scroll', () => { if (window.scrollY || window.scrollX) window.scrollTo(0, 0); });
document.addEventListener('scroll', () => {
  const se = document.scrollingElement;
  if (se && (se.scrollTop || se.scrollLeft)) { se.scrollTop = 0; se.scrollLeft = 0; }
}, true);

// A saved offline area: its route comes back with the routed line (no routing
// server needed) and the map frames it.
function openOfflineArea(area) {
  openPanel(null);
  const r = area.route;
  if (r.activity && r.activity !== state.activity) setActivity(r.activity);
  planner.setActive(true);
  planner.restoreSnapshot(r);
  const b = area.bbox;
  map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: planner.viewPadding(), duration: 0 });
}

// A free service is limiting or failing: say so once per episode (which one,
// what it affects, when it's tried again); route weather retries on its own.
const limitedNoticed = new Set();
// keep the readout current while Layers is open
setInterval(() => { if (usageBox && !usageBox.closest('[hidden]')) renderUsage(usageBox); }, 5000);
onStatus((src, s) => {
  const info = SOURCES[src] || { label: src, what: '' };
  if (usageBox && !usageBox.closest('[hidden]')) renderUsage(usageBox);
  if (!s) { limitedNoticed.delete(src); return; }
  if (s.near) {
    toast(`${info.label}: ${Math.round((s.used / s.max) * 100)} % of its ${{ minute: 'per-minute', '5 minutes': 'five-minute', hour: 'hourly', day: 'daily' }[s.name]} limit used from this device — ${info.what} may pause soon.`, { tone: 'warn', ms: 6000 });
    return;
  }
  if (s.pacing) {
    const perMin = (SOURCES[src].pace.find(([ms]) => ms === 60e3) || [0, '?'])[1];
    if (planner.active) toast(`Routing waits a few seconds: ${info.label} is a free service and takes about ${perMin} routes a minute from one device. The dashed legs follow on their own.`, { ms: 6000 });
    return;
  }
  if (s.retry) {
    const a = planner.analysis;
    if (src === 'openmeteo' && a && (a.windError || (a.wind && a.wind.stale))) planner.loadWind(a);
    if (src === 'brouter') planner.retryFailed();
    return;
  }
  if (limitedNoticed.has(src)) return;
  limitedNoticed.add(src);
  toast(src === 'brouter'
    ? `${info.label} asks for a short pause — the dashed legs are routed at ${clock(s.until)} on their own.`
    : s.reason === 'limit'
      ? `${info.label} (${info.what}) is limiting requests — showing saved data where there is some. Trying again at ${clock(s.until)}.`
      : `${info.label} (${info.what}) isn’t responding — trying again at ${clock(s.until)}.`, { tone: 'warn', ms: 7000 });
});

// ------------------------------------------------------------------ boot
registerServiceWorker();
initOfflineStatus();
document.body.dataset.activity = state.activity;
renderActivityBar();
renderLayersPanel();
renderSettingsPanel();
map.on('load', () => {
  // Start with the attribution collapsed to its (i) button on small screens.
  if (window.innerWidth < 720) $('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
  configureLayers();
  syncZoomHint();
  syncView3d();
  if (state.weather.wind || state.weather.temp || state.weather.rain) weather.set(state.weather);
  if (state.timeline) setTimeline(true);
  if (shared && shared.points.length) {
    planner.restore(shared);
    planner.setActive(true);
    const b = bbox(shared.points);
    if (b[0] !== b[2]) map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: planner.viewPadding(), duration: 0 });
    history.replaceState(null, '', location.pathname + location.hash);
  } else if (planner.loadSaved()) {
    /* restored last session's route (planner stays closed until opened) */
  }
});
