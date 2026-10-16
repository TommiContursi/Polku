// Polku — app bootstrap: map, state, panels and wiring between modules.

import {
  ACTIVITIES, ACTIVITY_OVERLAYS, RASTER_OVERLAYS, DEM_URL, DEM_MAXZOOM,
  DIFF_COLORS, MTB_SCALE_TEXT, UPHILL_TEXT, LIPAS_TYPES, SAFETY_OVERLAYS, BROUTER, isWater, WINTER_LIPAS,
} from './config.js';
import { WinterWays, measuredSnow, snowNear, isWinter, winterSetting, setWinterSetting, seaIceProtocol, WINTER_TEXT, WINTER_MIN_ZOOM, SNOW_ON } from './winter.js';
import { pointForecasts, sampleAt } from './weather.js';
import { SafetyLayers, AADT_STEPS } from './safety.js';
import { CameraLayer } from './cameras.js';
import { NauticalLayer } from './nautical.js';
import { buildStyle } from './style.js';
import { installIcons, iconUrl } from './icons.js';
import { Planner, parseShared, dockOf } from './planner.js';
import { UphillLayer } from './uphill.js';
import { TrailDetails, MIN_ZOOM as DETAILS_ZOOM } from './trails.js';
import { LipasLayer, lipasPlace, rideOf } from './lipas.js';
import { prefetchWater } from './waterdata.js';
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
import { Heading } from './heading.js';
import { Locate } from './locate.js';
import { onStatus, SOURCES, clock } from './net.js';
import { renderUsage } from './usage.js';
import { renderSpeedEditor } from './speeds.js';
import { WeatherOverlay, timeAtHour } from './wxmap.js';
import { isAerial } from './style.js';
import { RouteFlow } from './routeflow.js';

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
  routeFlow: true, // the route's moving chevrons (#198)
  timeline: false,
  labelsDown: false,
  labelsUp: false,
  weather: { wind: false, temp: false, rain: false },
  exaggeration: 1.4,
  mmlKey: '',
  overlaysByActivity: {},
  trailsByActivity: {}, // trail colours and numbers you chose, per sport (the sport only sets the defaults)
  overlayOpacity: {}, // raster overlay → opacity you set (0.1–1)
};
const state = { ...DEFAULTS, ...store.get('settings', {}) };
if (!ACTIVITIES[state.activity]) state.activity = 'mtb'; // a sport this version doesn't know
state.weather = { ...DEFAULTS.weather, ...(state.weather || {}) };
const shared = parseShared(new URLSearchParams(location.search));
if (shared && ACTIVITIES[shared.activity]) state.activity = shared.activity;

const overlaysFor = (act) => ({ ...ACTIVITY_OVERLAYS[act], ...(state.overlaysByActivity[act] || {}) });
// Trail colours and numbers: on in every sport if you want them; MTB starts with difficulty, the rest plain.
// Trail details (width, visibility, obstacles) start on where they matter most.
const TRAIL_DEFAULTS = (act) => ({ trailColors: act === 'mtb' ? 'down' : 'off', labelsDown: false, labelsUp: false, trailDetails: ['mtb', 'hike', 'trailrun'].includes(act) });
const trailsFor = (act) => ({ ...TRAIL_DEFAULTS(act), ...(state.trailsByActivity[act] || {}) });
// settings from before trail colours were per sport: they were MTB's
if (!store.get('settings', {}).trailsByActivity) {
  const old = store.get('settings', {});
  const mtb = {};
  for (const k of ['trailColors', 'labelsDown', 'labelsUp']) if (old[k] != null && old[k] !== TRAIL_DEFAULTS('mtb')[k]) mtb[k] = old[k];
  if (Object.keys(mtb).length) state.trailsByActivity = { mtb };
}
state.overlays = overlaysFor(state.activity);
Object.assign(state, trailsFor(state.activity));

const data = {}; // live GeoJSON per app source, so style rebuilds keep it
let flow = null; // the route's moving chevrons (js/routeflow.js), made once the planner's map is up
const saveSettings = () => {
  const { overlays, winterOn, winterSnow, ...rest } = state; // the overlays (per sport) and winter (found again) aren't saved here
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
seaIceProtocol(maplibregl); // FMI's sea-ice charts with the open water left clear (winter.js)
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
// Where the map opens: a link's view (#zoom/lat/lon, MapLibre reads it), else where
// you left it last time, else (a first visit) Helsinki, and Polku asks for your location.
const lastView = store.get('view', null);
const firstVisit = !/^#\d/.test(location.hash) && !lastView && !shared;
const map = new maplibregl.Map({
  container: 'map',
  style: buildStyle(state, ctx),
  hash: true,
  center: lastView ? lastView.c : [24.9384, 60.1699],
  zoom: lastView ? lastView.z : 12,
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
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
// Polku (its source) and its maker first, then the data credits MapLibre collects from the
// sources. MapLibre sorts its own list by length and rewrites it, so this sits just before it.
{
  const attrib = $('.maplibregl-ctrl-attrib');
  attrib.insertBefore(h('span', { class: 'attrib-own', html: '<a href="https://github.com/TommiContursi/Polku" target="_blank" rel="noopener">Polku</a> © <a href="https://github.com/TommiContursi" target="_blank" rel="noopener">TommiContursi</a> | ' }), attrib.querySelector('.maplibregl-ctrl-attrib-inner'));
  // On a phone-wide window the credits stay folded behind their ⓘ until you open them: MapLibre
  // opens them by itself when their text first comes in (often after the map has loaded), and
  // a window narrowed to phone width folds them too
  const narrow = () => innerWidth < 720;
  let tapped = 0;
  const fold = () => { if (attrib.classList.contains('maplibregl-compact-show')) { attrib.classList.remove('maplibregl-compact-show'); attrib.setAttribute('open', ''); } };
  attrib.querySelector('.maplibregl-ctrl-attrib-button')?.addEventListener('click', () => { tapped = Date.now(); }, true);
  new MutationObserver(() => { if (narrow() && Date.now() - tapped > 600) fold(); }).observe(attrib, { attributes: true, attributeFilter: ['class'] });
  let wasNarrow = narrow();
  addEventListener('resize', () => { const n = narrow(); if (n && !wasNarrow) fold(); wasNarrow = n; });
}
map.addControl(new maplibregl.ScaleControl({ maxWidth: 110 }), 'bottom-left');
// Zoom, compass and locate live in Polku's own control column (bottom right).
// Which way you face (heading.js) turns the dot's cone and, heading up, the map.
const heading = new Heading();
const compass = new CompassControl({ toast, heading });
$('.ctrl-compass').append(compass.onAdd(map));
let viewTimer = 0;
map.on('moveend', (e) => {
  // while your location is on, the view isn't kept (it's around where you are): your position is never stored
  if (locate.on || e.polkuFollow) return;
  clearTimeout(viewTimer);
  const c = map.getCenter(), view = { c: [+c.lng.toFixed(5), +c.lat.toFixed(5)], z: +map.getZoom().toFixed(2) };
  viewTimer = setTimeout(() => store.set('view', view), 800);
});
// paddling, zoomed in: what the water router will want (rocks, fairways) comes ahead, cached
map.on('moveend', () => {
  if (!isWater(state.activity) || map.getZoom() < 11) return;
  const b = map.getBounds();
  prefetchWater([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
});
// where you were last seen (a LIPAS route you ride starts at the end nearer you), in memory only
let lastFix = null;
const whereYouAre = () => (lastFix && Date.now() - lastFix.t < 30 * 60e3 ? lastFix.ll : null);
map.on('error', (e) => {
  // Tile 404s outside DEM coverage are expected; surface everything else in the console only.
  if (e && e.error && !/404|Failed to fetch|AbortError/.test(String(e.error.message || e.error))) console.warn(e.error);
});

function setData(id, fc) {
  data[id] = fc;
  const src = map.getSource(id);
  if (src) src.setData(fc);
  if (id === 'route' && flow) flow.setData(fc);
}

// The route's moving chevrons (#198, js/routeflow.js; `flow`, made below). While they move,
// the style's static arrows give way; the leg under the pointer glows brighter (route-glow-hover).
function routeHoverLeg(leg) {
  const v = leg == null ? null : leg;
  if (ctx.hoverLeg === v || !map.getSource('route')) return;
  if (ctx.hoverLeg != null) map.setFeatureState({ source: 'route', id: ctx.hoverLeg }, { hover: false });
  ctx.hoverLeg = v;
  if (v != null) map.setFeatureState({ source: 'route', id: v }, { hover: true });
}

function applyStyle() {
  map.setStyle(buildStyle(state, ctx), { diff: true });
  syncView3d();
  saveSettings();
}

// ------------------------------------------------------------------ modules
const uphill = new UphillLayer(map, (fc) => setData('uphill', fc));
// Trail details from OSM; inside the tiles that have loaded, trails are drawn from them.
let busyToldAt = 0;
const details = new TrailDetails(map, {
  onData: (ways, points) => { setData('trailWays', ways); setData('trailPoints', points); },
  onCoverage: (area) => {
    ctx.trailCoverage = area;
    if (state.trailDetails) map.setStyle(buildStyle(state, ctx), { diff: true }); // only the trail filters change
  },
  onBusy: () => {
    if (Date.now() - busyToldAt < 10 * 60e3) return;
    busyToldAt = Date.now();
    toast('Trail details: the OpenStreetMap server is busy — trying again in a couple of minutes');
  },
});
const lipas = new LipasLayer(map, (routes, points) => { setData('lipasRoutes', routes); setData('lipasPoints', points); });
const winterWays = new WinterWays(map, (fc) => setData('winterWays', fc));

// ------------------------------------------------------------------ winter
// Winter switches itself on where there's snow (Auto), or is yours to set.
// The snow: FMI's measurement at the nearest station (within 60 km), else the
// forecast model's at the map centre. Looked at again when the map stops moving.
state.winterOn = winterSetting() === 'on';
state.winterSnow = null; // { cm, src: 'FMI' | 'forecast', km }
let winterAt = null; // where it was last looked at
async function checkWinter(force = false) {
  const c = map.getCenter(), ll = [c.lng, c.lat];
  if (!force && winterAt && Math.hypot((ll[0] - winterAt[0]) * Math.cos((ll[1] * Math.PI) / 180), ll[1] - winterAt[1]) * 111 < 8) return; // under 8 km away: as it was
  if (!force && map.getZoom() < 6) return;
  winterAt = ll;
  let snow = null;
  try {
    const near = snowNear(await measuredSnow(), ll, 60);
    if (near) snow = { cm: near.cm, src: 'FMI', km: Math.round(near.d / 1000) };
  } catch { /* FMI didn't answer: the forecast's */ }
  if (!snow) {
    try {
      const [s] = await pointForecasts([ll]);
      const v = sampleAt(s, Date.now() / 1000).snow;
      if (v != null) snow = { cm: v, src: 'forecast' };
    } catch { /* not known */ }
  }
  state.winterSnow = snow;
  setWinter(isWinter(snow ? snow.cm : null, state.winterOn));
}
function setWinter(on) {
  const changed = on !== state.winterOn;
  state.winterOn = on;
  if (changed) { applyStyle(); configureLayers(); }
  renderActivityBar();
  if (!$('#layers-panel').hidden) renderLayersPanel();
}
// "Winter: 12 cm of snow (FMI, 14 km away)" and the like
function winterNote() {
  const w = state.winterSnow, set = winterSetting();
  const snow = w ? (w.cm >= 1 ? `${Math.round(w.cm)} cm of snow` : 'no snow') + (w.src === 'FMI' ? ` (FMI, ${w.km} km away)` : ' (forecast)') : '';
  if (set === 'on') return `Winter: on (yours)${snow ? ` · ${snow}` : ''}`;
  if (set === 'off') return `Winter: off (yours)${snow ? ` · ${snow}` : ''}`;
  return state.winterOn ? `Winter: ${snow || 'snow where you look'}` : snow ? `Not winter here: ${snow}` : 'Winter: looking for the snow…';
}
const escapeAttr = (t) => String(t).replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[c]);
let winterTimer = 0;
map.on('moveend', () => { clearTimeout(winterTimer); winterTimer = setTimeout(() => checkWinter(), 1500); });
map.once('load', () => checkWinter(true));

const safety = new SafetyLayers(map, { setData, time: () => timeAtHour(planner.startOffsetH) });
const cameras = new CameraLayer(map, { setData });
const nautical = new NauticalLayer(map, { setData });

flow = new RouteFlow(map, {
  enabled: () => state.routeFlow,
  onMoving: (on) => {
    ctx.flowMoving = on;
    if (map.getLayer('route-arrows')) map.setLayoutProperty('route-arrows', 'visibility', on ? 'none' : 'visible');
  },
});
if (data.route) flow.setData(data.route);
map.on('mouseout', () => routeHoverLeg(null)); // off the map (onto the planner, say): no leg is under the pointer
const planner = new Planner(map, {
  activity: () => state.activity,
  hoverLeg: routeHoverLeg,
  winter: () => ({ on: !!state.winterOn, setting: winterSetting() }), // winter on the route (15b): snow in the time, Heads-up
  sports: () => Object.entries(ACTIVITIES).map(([k, x]) => ({ k, label: x.label, icon: ACT_ICONS[k] })),
  // the planner's own picker: the route's sport (the map's too); the map in it already: just the route
  setSport: (k) => (state.activity === k ? planner.routeAs(k) : setActivity(k, { from: 'planner' })),
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

// Where you are: the dot, its cone and Follow me. While following, the dot sits in the middle
// of the map the planner leaves free.
const locate = new Locate(map, {
  button: $('#btn-locate'), heading, compass, toast,
  room: () => (planner.active && !planner.panel.hidden ? planner.viewPadding(0) : null),
  onFix: (ll) => { lastFix = { ll, t: Date.now() }; },
});
// the planner opening, closing or changing size moves the free map: the dot goes with it
new ResizeObserver(() => locate.kick()).observe($('#planner'));

// MTB difficulty in hover and click details: in MTB, and in any sport with trail colours on
const showsDifficulty = () => state.activity === 'mtb' || state.trailColors !== 'off';
const isBike = () => ACTIVITIES[state.activity].group === 'bike';
// Ride a LIPAS route, or add it to yours (its own line: no routing, js/lipas.js rideOf)
async function rideLipas(props, { click = null, near = null, add = false } = {}) {
  try {
    const place = await lipasPlace(props.type, props.lipasId);
    const end = add && planner.points.length ? planner.points[planner.points.length - 1] : null;
    const ride = rideOf(place, { near: end || whereYouAre() || near || map.getCenter().toArray(), click });
    if (!ride || !ride.pieces.length) throw new Error('LIPAS has no line for this route');
    planner.rideLipas(place, ride, { add: !!end });
  } catch (e) {
    toast(e.name === 'Limited' ? e.message : `Couldn't load the route from LIPAS (${e.message})`, { tone: 'warn' });
  }
}
const inspector = initInspector(map, {
  isPlanning: () => planner.active,
  activity: () => state.activity,
  difficulty: showsDifficulty,
  bike: isBike,
  routeFrom: (ll, mode) => {
    planner.setActive(true);
    if (mode) planner.setMode(mode);
    planner.clear();
    planner.addPoint(ll);
    toast('Now click where you want to go');
  },
  routeTo: (ll) => { planner.setActive(true); planner.addPoint(ll); },
  avoid: (ll, label) => { planner.setActive(true); planner.addNogo(ll, 40, label || 'Avoided place'); },
  rideLipas,
  // a click on your route with the planner closed: open it, with that part's choices
  openRoute: (leg, lngLat) => { planner.noClickUntil = Date.now() + 400; planner.setActive(true); setTimeout(() => planner.openLegMenu(leg, lngLat), 60); }, // (the same click mustn't add a point too)
  lipasRide: (props, click) => lipasPlace(props.type, props.lipasId).then((place) => rideOf(place, { click })),
  vessel: (mmsi) => safety.vessel(mmsi),
  openShip: (mmsi) => safety.openShip(mmsi),
  openCamera: (id, name) => cameras.open(id, name),
});
const hover = initHover(map, { enabled: () => state.hoverInfo && hoverCapable() && !planner.edit, isPlanning: () => planner.active, activity: () => state.activity, difficulty: showsDifficulty, bike: isBike, hoverLeg: routeHoverLeg });

initSearch(map, $('#search-input'), $('#search-results'), {
  sportTypes: () => ACTIVITIES[state.activity].lipas.routes,
  padding: () => (planner.active ? planner.viewPadding() : 70),
  // the picked route stands out (and shows at any zoom) while its card is open
  openLipas: (props, ll, near, parts) => {
    setData('lipasPick', { type: 'FeatureCollection', features: (parts || []).map((p) => ({ type: 'Feature', properties: { type: props.type }, geometry: { type: 'LineString', coordinates: p.coords } })) });
    inspector.openLipas(props, ll, near).on('close', () => setData('lipasPick', { type: 'FeatureCollection', features: [] }));
  },
});

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
  map, planner, state, uphill, trailDetails: details, flow, lipas, weather, safety, cameras, nautical, locate, heading, compass,
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
  // in winter: ski tracks, skating and snowmobile routes too (so feet and bikes keep off ski tracks)
  const routes = [...(o.lipasRoutes ? a.lipas.routes : []), ...(state.winterOn && o.lipasWinter ? WINTER_LIPAS : [])];
  lipas.configure({
    routes,
    points: [...(o.lipasPoints ? a.lipas.points : []), ...(o.restricted ? DANGER_TYPES : [])],
    showRoutes: routes.length > 0,
    showPoints: !!(o.lipasPoints || o.restricted),
  });
  winterWays.setEnabled(!!(state.winterOn && o.winterWays) || state.trailColors === 'winter'); // or the Winter trail colours, any time
  safety.configure({ traffic: !!o.sfTraffic, incidents: !!o.sfIncidents, roadworks: !!o.sfRoadworks, roadcond: !!o.sfRoadcond, ships: !!o.sfShips });
  cameras.setEnabled(!!o.sfCameras);
  nautical.setEnabled(!!o.nautical);
  uphill.setEnabled(state.trailColors === 'up' || state.trailColors === 'both' || state.labelsUp);
  details.setEnabled(!!state.trailDetails);
}

// ------------------------------------------------------------------ activity pill
// Only the active sport shows, beside the search. Hover (mouse) or tap opens the
// others; picking one, Escape or leaving closes it.
const ACT_ICONS = { mtb: 'bike', gravel: 'gravel', road: 'roadbike', hike: 'hike', trailrun: 'trailrun', run: 'run', paddle: 'paddle', swim: 'swim' };
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
    html: `${icon(ACT_ICONS[state.activity], 20)}<span>${cur.label}</span>${state.winterOn ? `<span class="act-winter" title="${escapeAttr(winterNote())}">${icon('snow', 14)}</span>` : ''}${icon('chevronDown', 16)}`,
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
  swim: 'open-water routes near the shore, shipping lanes avoided, beaches and swimming places',
};

// `from`: 'map' (the sport pill: the map's sport; a drawn route keeps its sports) or
// 'planner' (the planner's picker: the route goes with it, and Undo brings it back)
function setActivity(k, { from = 'map' } = {}) {
  if (state.activity === k) return;
  const prev = state.activity;
  state.activity = k;
  state.overlays = overlaysFor(k);
  Object.assign(state, trailsFor(k));
  document.body.dataset.activity = k;
  renderActivityBar();
  renderLayersPanel();
  renderSettingsPanel();
  applyStyle();
  configureLayers();
  // the planner says what happened to a drawn route; otherwise what the map shows now
  if (!planner.onActivityChange(prev, { from })) toast(`${ACTIVITIES[k].label}: ${SPORT_NOTE[k]}. Change any of it in Layers.`, { ms: 5000 });
}

function set3d(on) {
  state.terrain3d = on;
  applyStyle();
  map.easeTo({ pitch: on ? Math.max(60, map.getPitch()) : 0, duration: 800 });
  renderLayersPanel();
}

// ------------------------------------------------------------------ layers panel
function setTrail(key, value) {
  state[key] = value;
  state.trailsByActivity[state.activity] = { ...(state.trailsByActivity[state.activity] || {}), [key]: value };
  applyStyle();
  configureLayers();
  saveSettings();
}

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
  winter: () => [
    keyItem(keyLine('background:#0d9488;height:4px'), `${WINTER_TEXT.ploughed}, or groomed (walking and cycling allowed)`),
    keyItem(keyLine('border-top:4px dashed #94a3b8'), WINTER_TEXT.unploughed),
    keyItem(keyLine('background:#65a30d;height:4px'), WINTER_TEXT.open1),
    keyItem(keyLine('background:#a3b10e;height:4px'), WINTER_TEXT.open2),
    keyItem(keyLine('background:#d39b46;height:4px'), WINTER_TEXT.open3),
    keyItem(keyLine('background:repeating-linear-gradient(90deg,#dc2626 0 5px,#fff 5px 9px);height:5px'), WINTER_TEXT.closed),
    keyItem(keyLine('background:#f472b6;height:6px;box-shadow:inset 0 0 0 2px #f472b6,inset 0 -2px 0 2px #fff'), 'Ski track (OpenStreetMap; LIPAS in magenta)'),
    keyItem(keyLine('background:#7c3aed;height:4px'), 'Skating route on natural ice (LIPAS)'),
    keyItem(keyLine('border-top:4px dashed #ea580c'), 'Snowmobile route (LIPAS)'),
    keyItem(keyLine('border-top:4px dotted #0891b2'), WINTER_TEXT.seasonal),
  ],
  trails: () => [
    ...(state.trailColors === 'down' || state.trailColors === 'both'
      ? [h('h4', {}, 'MTB difficulty (halo)'), ...MTB_SCALE_TEXT.slice(0, 6).map((t, i) => keyItem(keyLine(`background:${DIFF_COLORS[i]};height:8px`), t)), keyItem(keyLine('background:#fff;height:8px;box-shadow:inset 0 0 0 1px #ccc'), 'Not graded in OSM')] : []),
    ...(state.trailColors === 'up' || state.trailColors === 'both'
      ? [h('h4', {}, state.trailColors === 'both' ? 'Uphill difficulty (stripe)' : 'Uphill difficulty'), ...UPHILL_TEXT.map((t, i) => keyItem(keyLine(`background:${DIFF_COLORS[i]};height:${state.trailColors === 'both' ? 4 : 8}px`), t)), keyItem(h('span', { class: 'lg-arrow' }, '»'), 'Uphill direction (8 %+)')] : []),
    ...(state.trailDetails ? [
      h('h4', {}, 'Trail details (OpenStreetMap, where mapped)'),
      keyItem(keyLine('background:#feb13e;height:4px;box-shadow:inset 0 0 0 1.5px #feb13e'), 'Narrow, under 0.6 m (thinner)'),
      keyItem(keyLine('background:#feb13e;height:11px'), 'Wide, 0.9 m or more (thicker)'),
      keyItem(keyLine('height:7px;background:repeating-linear-gradient(90deg,#1f1f1f 0 2px,transparent 2px 5px) center/100% 2px no-repeat,#feb13e'), 'Faint on the ground (dotted)'),
      keyItem(keyLine('background:#feb13e;height:6px;opacity:.55'), 'Barely or not visible (colour only)'),
      keyItem(keyLine('border-top:3px dotted #2f9e44'), 'Overgrown (beside the line)'),
      keyItem(keyLine('border-top:3px dotted #1d6fd1'), 'Wet or muddy (beside the line)'),
      keyItem(keyLine('border-top:2px dashed #8b4a2b'), 'Fence (hedge green, wall grey)'),
      ...[['td-tree', 'Fallen tree or log across'], ['td-gate', 'Gate or barrier'], ['td-gate-no', 'Gate, no access'], ['td-stile', 'Stile or kissing gate'], ['td-cycle', 'Cycle barrier'], ['td-ford', 'Ford (no bridge)']]
        .map(([id, label]) => keyItem(h('img', { class: 'lg-icon', src: iconUrl(id), alt: '' }), label)),
    ] : []),
    h('h4', {}, 'Ways'),
    keyItem(keyLine('border-top:2px dashed #1f1f1f'), 'Path / trail'),
    keyItem(keyLine('border-top:2px dashed #6b4f2a;border-image:repeating-linear-gradient(90deg,#6b4f2a 0 12px,transparent 12px 15px) 1'), 'Forest road / track'),
    keyItem(keyLine('background:#5b7fa8;height:2px'), 'Cycleway (paved)'),
    keyItem(keyLine('border-top:3px dotted #dc2626'), 'No bikes (beside a path)'),
    keyItem(keyLine('border-top:3px dotted #7c3aed'), 'Marked private or no access for your sport (beside the way): routes keep off it'),
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
// A raster layer's opacity, right under its switch while it's on; remembered per layer
// (overlays by id, the weather fields as wx:rain and wx:temp; style.js reads the same keys).
const WX_OPACITY = {
  'wx:rain': { label: 'Rain', opacity: 0.85, layers: ['wx-rain', 'wx-radar-rv', 'wx-radar-fi'], on: () => state.weather.rain },
  'wx:temp': { label: 'Temperature', opacity: 0.5, layers: ['wx-field'], on: () => state.weather.temp },
  'wx:snow': { label: 'Snow depth', opacity: 0.7, layers: ['wx-snow'], on: () => state.weather.snow },
};
const opacitySpec = (id) => (RASTER_OVERLAYS[id]
  ? { label: RASTER_OVERLAYS[id].label, opacity: RASTER_OVERLAYS[id].opacity, layers: [`ov-${id}`], on: () => !!state.overlays[id] }
  : WX_OPACITY[id]);
const opacityOf = (id) => (state.overlayOpacity[id] != null ? state.overlayOpacity[id] : opacitySpec(id).opacity);
const opacityRow = (id) => {
  const o = opacitySpec(id);
  if (!o || !o.on()) return null;
  const pct = h('span', { class: 'op-val' }, `${Math.round(opacityOf(id) * 100)} %`);
  return h('label', { class: 'range op-row' }, h('span', {}, 'Opacity'),
    h('input', { type: 'range', min: '10', max: '100', step: '5', value: String(Math.round(opacityOf(id) * 100)), 'aria-label': `${o.label} opacity`,
      oninput: (e) => {
        const v = +e.target.value / 100;
        state.overlayOpacity[id] = v;
        pct.textContent = `${e.target.value} %`;
        for (const l of o.layers) if (map.getLayer(l)) map.setPaintProperty(l, 'raster-opacity', v); // live, no style rebuild
      },
      onchange: () => saveSettings() }), pct);
};
// The trail colours' opacities, difficulty and uphill each: paint only, so a style
// diff per frame at most while dragging; saved on release.
let tcFrame = 0;
const trailColorOpacityRow = (which, label) => {
  const key = `trail:${which}`;
  const v0 = Math.round((state.overlayOpacity[key] ?? 1) * 100);
  const pct = h('span', { class: 'op-val' }, `${v0} %`);
  return h('label', { class: 'range op-row' }, h('span', {}, label),
    h('input', { type: 'range', min: '10', max: '100', step: '5', value: String(v0), 'aria-label': `${label} opacity`,
      oninput: (e) => {
        state.overlayOpacity[key] = +e.target.value / 100;
        pct.textContent = `${e.target.value} %`;
        cancelAnimationFrame(tcFrame);
        tcFrame = requestAnimationFrame(() => map.setStyle(buildStyle(state, ctx), { diff: true }));
      },
      onchange: () => saveSettings() }), pct);
};
const withOpacity = (id, tg) => { const row = opacityRow(id); return row ? h('div', { class: 'tg-group' }, tg, row) : tg; };

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

  // what is on right now, at a glance
  const on = [...LAYER_GROUPS.flatMap((g) => g.ids), 'maastoOverlay', 'mmlMaastoOverlay'].filter((id) => state.overlays[id]);
  const wx = [['wind', 'Wind'], ['temp', 'Temperature'], ['rain', 'Rain'], ['snow', 'Snow depth']].filter(([k]) => state.weather[k]);
  const trailOn = state.trailColors !== 'off';
  const custom = Object.keys(state.overlaysByActivity[state.activity] || {}).length > 0 || Object.keys(state.trailsByActivity[state.activity] || {}).length > 0;
  // On now and Base map fold away like the other groups (open unless you close them)
  const onCount = on.length + wx.length + (trailOn ? 1 : 0) + (state.trailDetails ? 1 : 0);
  p.append(layerGroup('onnow', 'On now', onCount, true,
    on.length || wx.length || trailOn || state.trailDetails ? h('div', { class: 'on-chips' },
      trailOn ? h('button', { type: 'button', class: 'on-chip', title: 'Turn off the trail colours', onclick: () => { setTrail('trailColors', 'off'); renderLayersPanel(); }, html: `<span>${{ down: 'Difficulty colours', up: 'Uphill colours', both: 'Difficulty & uphill', winter: 'Winter colours' }[state.trailColors]}</span>${icon('close', 12)}` }) : null,
      state.trailDetails ? h('button', { type: 'button', class: 'on-chip', title: 'Turn off the trail details', onclick: () => { setTrail('trailDetails', false); renderLayersPanel(); }, html: `<span>Trail details</span>${icon('close', 12)}` }) : null,
      ...on.map((id) => h('button', { type: 'button', class: 'on-chip', title: `Turn off ${overlayLabel(id)}`, onclick: () => { setOverlay(id, false); renderLayersPanel(); }, html: `<span>${overlayLabel(id)}</span>${icon('close', 12)}` })),
      ...wx.map(([k, l]) => h('button', { type: 'button', class: 'on-chip wx', title: `Turn off ${l.toLowerCase()} on the map`, onclick: () => setWeather({ [k]: false }), html: `<span>${l}</span>${icon('close', 12)}` })))
      : h('p', { class: 'note' }, 'No extra layers — just the base map and trails.'),
    custom ? h('button', { type: 'button', class: 'link', onclick: () => {
      state.overlaysByActivity[state.activity] = {};
      state.trailsByActivity[state.activity] = {};
      state.overlays = overlaysFor(state.activity);
      Object.assign(state, trailsFor(state.activity));
      applyStyle(); configureLayers(); renderLayersPanel(); saveSettings();
      toast(`Layers back to the ${act.label} defaults`);
    } }, `Reset to ${act.label} defaults`) : null));

  // base maps as thumbnails
  p.append(layerGroup('base', 'Base map', 0, true,
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
    withOpacity('maastoOverlay', toggle(RASTER_OVERLAYS.maastoOverlay.label, !!state.overlays.maastoOverlay, rerender((v) => setOverlay('maastoOverlay', v)), RASTER_OVERLAYS.maastoOverlay.attribution.replace('© ', ''))),
    state.mmlKey ? withOpacity('mmlMaastoOverlay', toggle(RASTER_OVERLAYS.mmlMaastoOverlay.label, !!state.overlays.mmlMaastoOverlay, rerender((v) => setOverlay('mmlMaastoOverlay', v)))) : null));

  // trails & difficulty (and the map key for the base map's lines): in every sport
  const trailKids = [
    seg([['off', 'Off'], ['down', 'Difficulty'], ['up', 'Uphill'], ['both', 'Both'], ['winter', 'Winter']], state.trailColors, (v) => {
      setTrail('trailColors', v); renderLayersPanel();
      if (v === 'winter' && map.getZoom() < WINTER_MIN_ZOOM) toast(`Zoom in to level ${WINTER_MIN_ZOOM}+ to see the winter colours`);
      if ((v === 'up' || v === 'both') && map.getZoom() < 13) toast('Zoom in to level 13+ to see uphill grades');
    }),
    h('p', { class: 'note' }, {
      off: `Trails and roads drawn for ${act.label.toLowerCase()}: what matters for it stands out. Turn on difficulty or uphill colours here.`,
      down: 'Halo colour is the MTB difficulty from OSM mtb:scale (S0 green → S5 purple). White halo = not graded yet.',
      up: 'Uphill grade (↑S0–↑S5) computed from the lidar elevation model for every trail in view, bumped for loose or technical surface. OSM mtb:scale:uphill tags override it. Arrows point uphill.',
      both: 'Halo = MTB difficulty (mtb:scale). Thin stripe beside it = uphill grade, with arrows pointing uphill on climbs of 8 %+.',
      winter: 'Trails by how soon they open after snow (OSM mtb:winter), ploughed and unploughed paths, no access in winter, ski tracks: Trailmap’s winter classes, from OpenStreetMap where mapped (zoom 11+). In winter they show by themselves (the Winter group).',
    }[state.trailColors] || ''),
    state.winterOn && state.trailColors !== 'winter' && state.trailColors !== 'off' ? h('p', { class: 'note' }, '❄ It’s winter here: the difficulty colours are faded, and the winter ways show over them (Winter, below).') : null,
    state.trailColors === 'down' || state.trailColors === 'both' ? trailColorOpacityRow('down', 'Difficulty') : null,
    state.trailColors === 'up' || state.trailColors === 'both' ? trailColorOpacityRow('up', 'Uphill') : null,
    toggle('Trail details', state.trailDetails, rerender((v) => {
      setTrail('trailDetails', v);
      if (v && map.getZoom() < DETAILS_ZOOM) toast(`Zoom in to level ${DETAILS_ZOOM}+ to see trail details`);
    }), `Width, faint trails, overgrown and wet stretches, fallen trees, gates, fords · zoom ${DETAILS_ZOOM}+ · from OpenStreetMap, where mapped`),
    toggle('Difficulty numbers', state.labelsDown, rerender((v) => setTrail('labelsDown', v)), 'S0–S6 beside graded trails (zoom 15+)'),
    toggle('Uphill numbers', state.labelsUp, rerender((v) => {
      setTrail('labelsUp', v);
      if (v && map.getZoom() < 14.5) toast('Zoom in to level 15 to see the numbers');
    }), '↑S0–↑S5 on climbs of 6 %+ (zoom 15+)'),
  ];
  p.append(layerGroup('trails', 'Trails & difficulty', (state.trailColors !== 'off' ? 1 : 0) + (state.trailDetails ? 1 : 0) + (state.labelsDown ? 1 : 0) + (state.labelsUp ? 1 : 0), ...trailKids, mapKey(...(state.trailColors === 'winter' ? KEYS.winter() : KEYS.trails()))));

  // winter: on by itself where there's snow (or yours to set), and what it shows
  const wset = winterSetting(), wOn = state.winterOn;
  const wIds = ['winterWays', 'lipasWinter', 'seaIce'];
  p.append(layerGroup('winter', wOn ? 'Winter ❄' : 'Winter', wOn ? wIds.filter((id) => state.overlays[id]).length : 0, wOn,
    seg([['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], wset, (v) => {
      setWinterSetting(v);
      if (v === 'auto') { winterAt = null; checkWinter(true); }
      setWinter(isWinter(state.winterSnow ? state.winterSnow.cm : null, state.winterOn));
      renderLayersPanel();
    }),
    h('p', { class: 'note' }, `${winterNote()}. Auto turns winter on from ${SNOW_ON} cm of snow where you look (FMI’s nearest station, else the forecast).`),
    toggle('Winter ways', !!state.overlays.winterWays, rerender((v) => {
      setOverlay('winterWays', v);
      if (v && wOn && map.getZoom() < WINTER_MIN_ZOOM) toast(`Zoom in to level ${WINTER_MIN_ZOOM}+ to see the winter ways`);
    }), 'How soon trails open after snow, ploughing, no access in winter, ski tracks · OpenStreetMap, where mapped · zoom 11+'),
    toggle('Ski tracks, skating & snowmobile routes', !!state.overlays.lipasWinter, rerender((v) => setOverlay('lipasWinter', v)), 'LIPAS · keep off ski tracks on foot and by bike'),
    withOpacity('seaIce', toggle('Sea ice', !!state.overlays.seaIce, rerender((v) => setOverlay('seaIce', v)), 'FMI’s daily ice charts (Copernicus Marine) · never a sign that ice is safe')),
    withOpacity('wx:snow', toggle('Snow depth on the map', state.weather.snow, (v) => setWeather({ snow: v }), 'On the timeline, with FMI’s measured depths')),
    wOn ? null : h('p', { class: 'note' }, 'These show while it’s winter.'),
    mapKey(...KEYS.winter())));

  for (const g of LAYER_GROUPS) {
    const kids = g.ids.map((id) => {
      const o = RASTER_OVERLAYS[id], sf = SAFETY_OVERLAYS[id];
      return withOpacity(id, toggle(overlayLabel(id), !!state.overlays[id], rerender((v) => {
        setOverlay(id, v);
        if (v && id === 'sfTraffic' && map.getZoom() < 10) toast('Zoom in to level 10+ to see traffic volumes');
        if (v && id === 'sfShips' && map.getZoom() < 8) toast('Zoom in to level 8+ to see ships');
      }), sf ? sf.note : o ? o.attribution.replace('© ', '') : OVERLAY_NOTE[id] || ''));
    });
    if (g.id === 'safety') kids.push(h('p', { class: 'note' }, 'Planned routes are checked against these too: road works, incidents, slippery and busy roads show up under Heads-up, each with an Avoid button.'));
    if (KEYS[g.id]) kids.push(mapKey(...KEYS[g.id]()));
    p.append(layerGroup(g.id, g.title, g.ids.filter((id) => state.overlays[id]).length, ...kids));
  }

  // weather on the map — the same switches as on the Weather button's timeline
  p.append(layerGroup('weather', 'Weather on the map', wx.length + (state.timeline ? 1 : 0),
    toggle('Timeline', state.timeline, rerender((v) => setTimeline(v)), '48 h clock for weather, road conditions and your route · also the Weather button (T)'),
    toggle('Wind', state.weather.wind, (v) => setWeather({ wind: v }), 'Animated wind and speed'),
    withOpacity('wx:temp', toggle('Temperature', state.weather.temp, (v) => setWeather({ temp: v }), 'Colour field with °C labels')),
    withOpacity('wx:rain', toggle('Rain', state.weather.rain, (v) => setWeather({ rain: v }), 'Radar now (FMI / RainViewer), forecast later')),
    withOpacity('wx:snow', toggle('Snow depth', state.weather.snow, (v) => setWeather({ snow: v }), 'Snow on the ground: the forecast as a wash, FMI’s measured depths on top')),
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
      seg([['left', 'Side panel (left)'], ['bottom', 'Bottom panel']], dockOf(), (v) => { planner.setDock(v); renderSettingsPanel(); }),
      h('p', { class: 'note' }, 'Open it with Plan or R. The button beside its fold, and its ⋯ menu, have the same switch. While planning, the departure clock lives inside it.')));
  }

  p.append(section('Display',
    toggle('High contrast', state.highContrast, (v) => { state.highContrast = v; applyStyle(); }, 'Thicker trails for bright sunlight'),
    hoverCapable() ? toggle('Details on hover', state.hoverInfo, (v) => { state.hoverInfo = v; saveSettings(); }, 'Difficulty, surface or name under the mouse · click for everything') : null,
    toggle('Moving arrows on the route', state.routeFlow, (v) => { state.routeFlow = v; saveSettings(); flow.check(); }, 'Chevrons drift along your route the way it goes. They rest when you leave the map alone; off saves a little battery'),
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
    // above the planner when it's open (its ⋯ menu imports too)
    if (planner.active) planner.frame(b, { duration: 800 });
    else map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 70, duration: 800 });
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
  if (e.target.matches && e.target.matches('input, textarea')) return; // (a key sent to the document has no .matches)
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
  planner.frame(area.bbox, { duration: 0, maxZoom: map.getMaxZoom() });
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
  // Start with the attribution collapsed to its (i) button on small screens (and it stays so: above).
  if (window.innerWidth < 720) $('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
  configureLayers();
  syncZoomHint();
  syncView3d();
  if (state.weather.wind || state.weather.temp || state.weather.rain) weather.set(state.weather);
  // a first visit: show where you are, if the browser may tell (Helsinki stays otherwise)
  if (firstVisit && navigator.geolocation) setTimeout(() => locate.start({ quiet: true }), 600);
  if (state.timeline) setTimeline(true);
  if (shared && shared.points.length) {
    planner.restore(shared);
    planner.setActive(true);
    // its points now, its routed line once the legs are in
    const b = bbox(shared.points);
    if (b[0] !== b[2]) planner.frame(b, { duration: 0, maxZoom: map.getMaxZoom() });
    planner.frameWhenRouted();
    history.replaceState(null, '', location.pathname + location.hash);
  } else if (planner.loadSaved()) {
    /* restored last session's route (planner stays closed until opened) */
  }
});
