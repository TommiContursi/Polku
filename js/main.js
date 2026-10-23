// Polku — app bootstrap: map, state, panels and wiring between modules.

import {
  ACTIVITIES, ACTIVITY_OVERLAYS, RASTER_OVERLAYS, DEM_URL, DEM_MAXZOOM,
  DIFF_COLORS, MTB_SCALE_TEXT, UPHILL_TEXT, LIPAS_TYPES, SAFETY_OVERLAYS, BROUTER, isWater, WINTER_LIPAS,
  QUICK_TILES, QUICK_TILE, QUICK_MAX, QUICK_PLACES, ESRI_IMAGERY, CRAFT,
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
import { $, $$, h, icon, toast, store, popMenu } from './ui.js';
import { initGestures } from './gestures.js';
import { initView3d } from './view3d.js';
import { CompassControl } from './compass.js';
import { Heading } from './heading.js';
import { Locate } from './locate.js';
import { onStatus, SOURCES, clock, sourceStatus } from './net.js';
import { swipeSheet, SWIPE } from './sheet.js';
import { renderUsage } from './usage.js';
import { renderSpeedEditor } from './speeds.js';
import { WeatherOverlay, timeAtHour } from './wxmap.js';
import { isAerial } from './style.js';
import { RouteFlow } from './routeflow.js';
import { openChangelog } from './changelog.js';
import { onTheme } from './palette.js';

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
  quickTiles: {}, // the quick drawer's tiles you chose, per sport (#123); a sport you haven't edited has its own
  depthsBack: {}, // per sport: the depth layers the Depths tile brings back when it's turned on again
};
const state = { ...DEFAULTS, ...store.get('settings', {}) };
if (!ACTIVITIES[state.activity]) state.activity = 'mtb'; // a sport this version doesn't know
state.weather = { ...DEFAULTS.weather, ...(state.weather || {}) };
for (const k of ['quickTiles', 'depthsBack']) if (!state[k] || typeof state[k] !== 'object') state[k] = {};
const shared = parseShared(new URLSearchParams(location.search));
if (shared && ACTIVITIES[shared.activity]) state.activity = shared.activity;

const overlaysFor = (act) => ({ ...ACTIVITY_OVERLAYS[act], ...(state.overlaysByActivity[act] || {}) });
// Trail colours and numbers: on in every sport if you want them; MTB starts with difficulty, the rest plain.
// Trail details (width, visibility, obstacles) start on where they matter most.
const TRAIL_DEFAULTS = (act) => ({ trailColors: act === 'mtb' ? 'down' : 'off', labelsDown: false, labelsUp: false, trailDetails: ['mtb', 'hike', 'trailrun'].includes(act) });
// (colorsBack: the colours the Trail colours tile brings back; it stays in trailsByActivity, not in state)
const trailsFor = (act) => { const { colorsBack, ...mine } = state.trailsByActivity[act] || {}; return { ...TRAIL_DEFAULTS(act), ...mine }; };
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
// the planner left open (25c, #238): it opens again after a reload, as it was (editing or the route's view)
const leftOpen = !!(store.get('plannerOpen', null) || {}).open;
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
// The 3D button in the map's column (#226) is pressed while 3D terrain is on.
const btn3d = $('#btn-3d');
btn3d.addEventListener('click', () => set3d(!state.terrain3d));
const syncView3d = () => {
  view3d.show(state.terrain3d || map.getPitch() > 5);
  btn3d.setAttribute('aria-pressed', String(!!state.terrain3d));
};
syncView3d();
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
    detailsBusyAt = Date.now();
    refreshQuickSoon();
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
  if (layersOpen()) renderLayersPanel();
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
// each sport's icon (the planner's toolbox asks for it as it's built)
const ACT_ICONS = { mtb: 'bike', gravel: 'gravel', road: 'roadbike', hike: 'hike', trailrun: 'trailrun', run: 'run', paddle: 'paddle', swim: 'swim' };
const planner = new Planner(map, {
  activity: () => state.activity,
  hoverLeg: routeHoverLeg,
  winter: () => ({ on: !!state.winterOn, setting: winterSetting() }), // winter on the route (15b): snow in the time, Heads-up
  sports: () => Object.entries(ACTIVITIES).map(([k, x]) => ({ k, label: x.label, icon: ACT_ICONS[k] })),
  // the map's sport, from the planner: Next leg and the water note (the next legs), or a whole route's change and its Undo ('route')
  setSport: (k, opts) => setActivity(k, opts),
  // the sports as menu items, for the planner's Next leg: the same as the pill's menu and the start's chip
  sportItems: (opts) => sportItems(opts),
  // the start's sport chip: the pill's own choices (#245)
  sportMenu: (anchor) => openSportMenu(anchor),
  // Marked routes (A): LIPAS's routes in a view, whether the map shows them, and turning them on
  lipasRoutesIn: (b, types, centre) => lipas.routesIn(b, types, centre),
  overlayOn: (id) => !!state.overlays[id],
  setOverlay: (id, on) => setOverlay(id, on),
  rideLipas: (props, opts) => rideLipas(props, opts),
  lipasRide: (props) => lipasPlace(props.type, props.lipasId).then((place) => rideOf(place, {})),
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
    syncWxH(); // the timeline stays over the map while planning (#225): on a phone, just above the sheet
    // the long attribution line would run into the planner: keep it behind its (i)
    if (on) $('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    syncPlannerPadding();
  },
});
// The theme changed: the route and the colour scales are read from the CSS again (js/palette.js), so the
// map and the planner draw with them again.
onTheme(() => {
  map.setStyle(buildStyle(state, ctx), { diff: true });
  if (planner.analysis) planner.showMode(planner.colorMode);
});

// Where you are: the dot, its cone and Follow me. While following, the dot sits in the middle
// of the map the planner leaves free.
const locate = new Locate(map, {
  button: $('#btn-locate'), heading, compass, toast,
  room: () => (planner.active && !planner.panel.hidden ? planner.viewPadding(0) : null),
  onFix: (ll) => { lastFix = { ll, t: Date.now() }; },
});
// the planner opening, closing or changing size moves the free map: the dot goes with it
new ResizeObserver(() => { if (!$('#planner').classList.contains('dragging')) locate.kick(); }).observe($('#planner'));
$('#planner').addEventListener('sheetrest', () => locate.kick());

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
  // the map's own cards: with the planner put away, and in the route's view for what the planner doesn't take (25c)
  isPlanning: (e) => planner.active && (!planner.inView() || (!!e && planner.tookClick === e.originalEvent)),
  activity: () => state.activity,
  difficulty: showsDifficulty,
  bike: isBike,
  routeFrom: (ll, mode) => {
    planner.setActive(true, { edit: true });
    if (mode) planner.setMode(mode);
    planner.clear();
    planner.addPoint(ll);
    toast('Now click where you want to go');
  },
  routeTo: (ll) => { planner.setActive(true, { edit: true }); planner.addPoint(ll); },
  avoid: (ll, label) => { planner.setActive(true); planner.addNogo(ll, 40, label || 'Avoided place'); },
  rideLipas,
  // a click on your route with the planner closed: open it, with that part's choices
  // (in the route's view too, where the planner leaves map taps to the map: 25c)
  openRoute: (leg, lngLat) => { planner.noClickUntil = Date.now() + 400; if (!planner.active) planner.setActive(true); setTimeout(() => planner.openLegMenu(leg, lngLat), 60); }, // (the same click mustn't add a point too)
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

// Plan sits where the planner opens: in the search bar on desktop (side panel below it), and last in the
// map's column, where the planner put away comes back. While planning both stay where they are, pressed,
// and close it again (on phones the sheet takes the column's place). Done ends editing since 25c.
function syncPlanButton(on) {
  for (const b of $$('#btn-plan, #btn-plan-search')) {
    b.setAttribute('aria-expanded', String(on));
    b.title = on ? 'Close the planner (R): your route stays' : planner.points.length ? 'Plan: open your route (R)' : 'Plan a route (R)';
  }
}

// What the planner covers: --sheet-h for the bottom sheet, --pl-left for the side panel.
function syncPlannerPadding() {
  const sheet = $('#planner');
  if (sheet.classList.contains('dragging')) return; // a swipe moves it: the room changes once, when it comes to rest
  const open = planner.active && !sheet.hidden;
  const side = open && planner.layout() === 'side';
  document.documentElement.style.setProperty('--sheet-h', `${open && !side ? sheet.offsetHeight : 0}px`);
  document.documentElement.style.setProperty('--pl-left', `${side ? sheet.getBoundingClientRect().right : 0}px`);
  placePanels();
  if (quickOpen()) placeQuick();
  syncWxH(); // (and the map's column)
}
new ResizeObserver(syncPlannerPadding).observe($('#planner'));

// Short phones with the sheet raised (25a): the map's column keeps what fits between the top bar and
// the sheet, leaving out the compass first while north is up (it's back once the map turns), then 3D
// (still in Layers). Its bottom moves with a transition, so its top is worked out, not measured.
// whether the column, with what it can leave out, fits between the top bar and the sheet plus `extra`
function columnFits(extra) {
  const col = $('#map-ctrls'), had = [...col.classList];
  col.classList.add('no-compass', 'no-3d');
  const h = col.offsetHeight;
  col.className = had.join(' ');
  const sheet = parseFloat(document.documentElement.style.getPropertyValue('--sheet-h')) || 0;
  return innerHeight - sheet - extra - 12 - h >= $('.topbar').getBoundingClientRect().bottom + 8;
}
function fitColumn() {
  const col = $('#map-ctrls');
  col.classList.remove('no-compass', 'no-3d');
  if (!phoneMQ.matches) return;
  const css = (k) => parseFloat(document.documentElement.style.getPropertyValue(k)) || 0;
  const room = () => innerHeight - css('--sheet-h') - css('--wx-h') - 12 - col.offsetHeight >= $('.topbar').getBoundingClientRect().bottom + 8;
  if (room()) return;
  if (Math.abs(map.getBearing()) < 0.5) col.classList.add('no-compass');
  if (!room()) col.classList.add('no-3d');
}
new ResizeObserver(fitColumn).observe($('#map-ctrls'));
map.on('rotateend', fitColumn);
$('#planner').addEventListener('sheetrest', syncPlannerPadding);

// On a phone Settings sits above the planner's sheet while that leaves it 320 px under the top bar, as the
// quick layers do above a bottom planner on a desktop; with less (a full sheet, a short or turned phone) it
// covers the sheet instead (#240). The sheet keeps its size either way.
function placePanels() {
  const sheet = parseFloat(document.documentElement.style.getPropertyValue('--sheet-h')) || 0;
  document.body.classList.toggle('panels-over', phoneMQ.matches && sheet > 0 && innerHeight - sheet - 12 - 64 < 320);
}

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
const hoverPointer = matchMedia('(hover: hover) and (pointer: fine)');
function renderActivityBar() {
  const box = $('#activity-bar');
  box.innerHTML = '';
  const cur = ACTIVITIES[state.activity];
  const menu = h('div', { class: 'act-menu', hidden: true });
  const btn = h('button', {
    type: 'button', class: 'act-current', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', title: `Activity: ${cur.label}`,
    // a click just after the hover opened the menu keeps it open (#245); a click on a menu it opened closes it
    onclick: () => { if (menu.hidden) openActs(); else if (actHovered) actHovered = false; else closeActs(); },
    html: `${icon(ACT_ICONS[state.activity], 20)}<span>${cur.label}</span>${state.winterOn ? `<span class="act-winter" title="${escapeAttr(winterNote())}">${icon('snow', 14)}</span>` : ''}${icon('chevronDown', 16)}`,
  });
  box.append(btn, menu);
  sportList(menu);
}
// The sports, each with its icon, its name, one line on what the map shows for it, and "your route" where the
// route has it (B of #233): the pill's menu, the start's chip and the planner's Next leg are made of these
function sportItems({ checked, route = [], fn }) {
  return Object.entries(ACTIVITIES).map(([k, a]) => ({
    k, icon: ACT_ICONS[k], label: `<span>${escapeAttr(a.label)}${route.includes(k) ? ' <span class="cur">your route</span>' : ''}</span>`, desc: escapeAttr(a.line), radio: true, checked: checked === k, fn: () => fn(k),
  }));
}
const SPORT_LEAD = 'The map shows what matters for the sport you pick, and the legs you draw are planned for it.';
// The pill's menu: the sports, with Paddle its craft, and with a route in another sport what a change is for
// (option A of B, #233)
const CRAFT_NOTE = 'Polku keeps a canoe or a SUP to calmer water than a sea kayak, and times the route at its speed.';
function sportList(menu) {
  const route = planner.points.length > 1 ? planner.routeSports() : [];
  menu.removeAttribute('role');
  menu.removeAttribute('aria-labelledby');
  const list = h('div', { class: 'act-list', role: 'listbox', 'aria-label': 'Sport', 'aria-describedby': 'act-lead' },
    ...sportItems({ checked: state.activity, route, fn: (k) => pickSport(k, menu) }).map((it) => h('button', {
      type: 'button', role: 'option', class: 'act two', 'aria-selected': String(it.checked), 'data-k': it.k,
      onclick: it.fn, html: `${icon(it.icon, 20)}<span><b>${it.label}</b><small>${it.desc}</small></span>${it.checked ? icon('check', 18) : ''}`,
    })));
  // the craft, which the water routes and the time depend on: as in the start's sport menu
  const craft = state.activity !== 'paddle' ? null : h('div', { class: 'act-craft', role: 'group', 'aria-labelledby': 'act-craft-h' },
    h('div', { class: 'act-head', id: 'act-craft-h' }, 'Craft'),
    h('div', { class: 'act-chips' }, ...Object.entries(CRAFT).map(([k, c]) => h('button', { type: 'button', class: 'act-chip', 'data-craft': k, 'aria-pressed': String(planner.craft === k),
      onclick: () => { planner.setCraft(k); sportList(menu); menu.querySelector(`[data-craft="${k}"]`)?.focus(); }, html: `${planner.craft === k ? icon('check', 15) : ''}<span>${escapeAttr(c.label)}</span>` }))),
    h('p', { class: 'act-lead' }, CRAFT_NOTE));
  menu.replaceChildren(h('div', { class: 'act-head', 'aria-hidden': 'true' }, 'Sport'),
    h('p', { class: 'act-lead', id: 'act-lead' }, route.length ? `Your route: ${planner.sportsLabel()}, ${planner.legs.length} ${planner.legs.length === 1 ? 'leg' : 'legs'}` : SPORT_LEAD),
    list, craft);
}
// one tap with no route or for the route's own sport; otherwise the menu asks: The whole route, or Only the legs
// you draw next. Keep, ‹ Sports and a tap outside change nothing.
function pickSport(k, menu) {
  const q = planner.sportQuestion(k);
  // Paddle keeps the menu open at its craft (the bar is drawn again for the sport)
  if (!q && k === 'paddle' && state.activity !== k) { setActivity(k); openActs(); $('#activity-bar .act-chip[aria-pressed="true"]')?.focus(); return; }
  if (!q) { closeActs(); setActivity(k); return; }
  const back = () => { sportList(menu); menu.querySelector(`[data-k="${k}"]`)?.focus(); };
  const opt = (cls, ic, title, line, fn, disabled = false) => h('button', { type: 'button', class: `act two act-opt ${cls}`, 'aria-disabled': disabled ? 'true' : null,
    onclick: () => { if (!disabled) fn(); }, html: `${icon(ic, 20)}<span><b>${title}</b><small>${escapeAttr(line)}</small></span>` });
  menu.setAttribute('role', 'dialog');
  menu.removeAttribute('aria-label');
  menu.removeAttribute('aria-describedby');
  menu.setAttribute('aria-labelledby', 'act-q');
  menu.replaceChildren(
    h('button', { type: 'button', class: 'act act-back', onclick: back, html: `${icon('chevronLeft', 18)}<span>Sports</span>` }),
    h('div', { class: 'act-q', id: 'act-q', html: `${icon(ACT_ICONS[k], 20)}<span>${escapeAttr(q.title)}</span>` }),
    h('div', { role: 'group', 'aria-labelledby': 'act-q', class: 'act-opts' },
      opt('act-all', 'route', 'The whole route', q.all, () => { closeActs(); planner.wholeRoute(k); }, q.cross),
      opt('act-next', isWater(k) ? 'water' : 'auto', `Only the legs you draw next${q.already ? ' <span class="cur">already</span>' : ''}`, q.next, () => { closeActs(); setActivity(k); })),
    h('button', { type: 'button', class: 'act act-keep', onclick: () => { closeActs(); $('#activity-bar .act-current').focus(); } }, q.keep));
  menu.querySelector('.act-opt:not([aria-disabled])').focus();
}
// The same choice from the planner's start (A, #233): "Start a route · MTB ▾" opens the pill's own sports,
// picked with the same setActivity(), so the pill and the chip always match: one control, two ways in (#245)
// For Paddle it has the craft too, which the round trip's loops and the time depend on: picking Paddle keeps it open
// at the craft (the start is drawn again for the sport, so it opens again at the new chip).
let sportPop = null;
function openSportMenu(anchor, { craft = false } = {}) {
  if (sportPop) { sportPop.close(); return; }
  closeActs();
  anchor.setAttribute('aria-expanded', 'true');
  const again = (opts) => { sportPop?.close(); const chip = $('.pl-way .sport-chip'); if (chip) openSportMenu(chip, opts); };
  const paddle = state.activity === 'paddle';
  sportPop = popMenu(anchor, [
    { group: 'Sport', items: [{ note: SPORT_LEAD }, ...sportItems({ checked: state.activity, fn: (k) => {
      setActivity(k);
      if (k === 'paddle') again({ craft: true }); else $('.pl-way .sport-chip')?.focus({ preventScroll: true });
    } }).map((it) => (it.k === 'paddle' && !paddle ? { ...it, keep: true } : it))] },
    paddle ? 'hr' : null,
    paddle ? { group: 'Craft', items: [
      { chips: Object.entries(CRAFT).map(([k, c]) => ({ label: escapeAttr(c.label), radio: true, checked: planner.craft === k, keep: true, fn: () => { planner.setCraft(k); again({ craft: true }); } })) },
      { note: CRAFT_NOTE },
    ] } : null,
  ], { label: 'Sport', align: 'left', sheet: true, onClose: () => { sportPop = null; anchor.setAttribute('aria-expanded', 'false'); } });
  if (craft) sportPop.el.querySelector('.chip[aria-checked="true"]')?.focus({ preventScroll: true });
}
let actTimer = 0;
let actHovered = false; // the hover opened the menu, and no click on the pill since
function openActs() {
  const box = $('#activity-bar');
  clearTimeout(actTimer);
  if (box.querySelector('.act-menu').hidden) sportList(box.querySelector('.act-menu')); // the route as it is now
  box.querySelector('.act-menu').hidden = false;
  box.querySelector('.act-current').setAttribute('aria-expanded', 'true');
  box.classList.add('open');
}
function closeActs() {
  const box = $('#activity-bar');
  const m = box.querySelector('.act-menu');
  actHovered = false;
  if (!m || m.hidden) return;
  m.hidden = true;
  box.querySelector('.act-current').setAttribute('aria-expanded', 'false');
  box.classList.remove('open');
}
{
  const box = $('#activity-bar');
  box.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse' || !hoverPointer.matches) return;
    if (box.querySelector('.act-menu').hidden) actHovered = true;
    openActs();
  });
  // (not the question about a route: it closes with an answer, Keep, Escape or a click outside, B of #233)
  box.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && hoverPointer.matches && box.querySelector('.act-menu').getAttribute('role') !== 'dialog') { clearTimeout(actTimer); actTimer = setTimeout(closeActs, 250); } });
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
// Aerial's picture is Esri's own tile of the same spot (its imagery isn't stored here); offline, Aerial FI's
const AERIAL_THUMB = ESRI_IMAGERY.replace('{z}', '15').replace('{y}', '9234').replace('{x}', '18552');
const thumb = (k) => (k === 'aerial' ? AERIAL_THUMB : `img/base/${{ mml: 'maasto' }[k] || k}.jpg`);
document.addEventListener('error', (e) => { if (e.target.src === AERIAL_THUMB) e.target.src = thumb('ortofi'); }, true);
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

// The map's sport, and the legs you draw next: a drawn route keeps its sports and its style (B of #233).
// `from: 'route'`: the planner is changing the whole route itself (The whole route, its Undo).
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
  if (key === 'trailColors' && value !== 'off') state.trailsByActivity[state.activity].colorsBack = value;
  applyStyle();
  configureLayers();
  saveSettings();
}

function setOverlay(id, on) { setOverlays({ [id]: on }); }
function setOverlays(patch) {
  Object.assign(state.overlays, patch);
  state.overlaysByActivity[state.activity] = { ...(state.overlaysByActivity[state.activity] || {}), ...patch };
  applyStyle();
  configureLayers();
  if ('lipasRoutes' in patch) planner.renderStart(); // Marked routes says whether the map shows them
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
    keyItem(keyLine('background:var(--route);height:5px'), 'Follows paths'),
    keyItem(keyLine('background:var(--route-water);height:5px'), 'Over water'),
    keyItem(keyLine('border-top:5px dotted #ea580c'), 'Carry / portage'),
    keyItem(keyLine('border-top:4px dashed var(--route-line)'), 'Straight line'),
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

// The full panel's switches, built by the same functions for the panel and for a tile's settings in the
// quick drawer (#123), so the two are always the same switches. A change renders both again.
const rerender = (fn) => (v) => { fn(v); renderLayersPanel(); };
const terrain3dControls = () => [
  toggle('3D terrain', state.terrain3d, (v) => set3d(v), 'Tilt with right-drag or two fingers; the pad on the map tilts and turns'),
  state.terrain3d ? h('label', { class: 'range' }, 'Exaggeration',
    h('input', { type: 'range', min: '1', max: '3', step: '0.1', value: String(state.exaggeration), 'aria-label': '3D exaggeration', oninput: (e) => { state.exaggeration = +e.target.value; map.setTerrain({ source: 'terrain', exaggeration: state.exaggeration }); saveSettings(); } })) : null,
];
function trailControls() {
  const act = ACTIVITIES[state.activity];
  return [
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
    mapKey(...(state.trailColors === 'winter' ? KEYS.winter() : KEYS.trails())),
  ];
}
// one overlay's switch, with its opacity under it while it's on
const overlayToggle = (id) => {
  const o = RASTER_OVERLAYS[id], sf = SAFETY_OVERLAYS[id];
  return withOpacity(id, toggle(overlayLabel(id), !!state.overlays[id], rerender((v) => {
    setOverlay(id, v);
    if (v && id === 'sfTraffic' && map.getZoom() < 10) toast('Zoom in to level 10+ to see traffic volumes');
    if (v && id === 'sfShips' && map.getZoom() < 8) toast('Zoom in to level 8+ to see ships');
  }), sf ? sf.note : o ? o.attribution.replace('© ', '') : OVERLAY_NOTE[id] || ''));
};
// weather on the map: the same switches as on the Weather button's timeline
const timelineToggle = () => toggle('Timeline', state.timeline, rerender((v) => setTimeline(v)), '48 h clock for weather, road conditions and your route · also the Weather button (T)');
const wxToggle = (k) => ({
  wind: () => toggle('Wind', state.weather.wind, (v) => setWeather({ wind: v }), 'Animated wind and speed'),
  temp: () => withOpacity('wx:temp', toggle('Temperature', state.weather.temp, (v) => setWeather({ temp: v }), 'Colour field with °C labels')),
  rain: () => withOpacity('wx:rain', toggle('Rain', state.weather.rain, (v) => setWeather({ rain: v }), 'Radar now (FMI / RainViewer), forecast later')),
  snow: () => withOpacity('wx:snow', toggle('Snow depth', state.weather.snow, (v) => setWeather({ snow: v }), 'Snow on the ground: the forecast as a wash, FMI’s measured depths on top')),
})[k]();
const DEPTHS = ['depthAreas', 'depthContours', 'soundings'];
// What the On now chips list and More counts: the layers drawn over the base map
const onNowIds = () => [
  ...(state.trailColors !== 'off' ? ['trailColors'] : []),
  ...(state.trailDetails ? ['trailDetails'] : []),
  ...[...LAYER_GROUPS.flatMap((g) => g.ids), 'maastoOverlay', 'mmlMaastoOverlay'].filter((id) => state.overlays[id]),
  ...['wind', 'temp', 'rain', 'snow'].filter((k) => state.weather[k]).map((k) => `wx:${k}`),
];

function renderLayersPanel() {
  syncLayersButton();
  renderQuickLayers();
  const p = $('#layers-body');
  const keepScroll = p.scrollTop; // re-rendering after a toggle must not jump to the top
  requestAnimationFrame(() => { p.scrollTop = keepScroll; });
  p.innerHTML = '';
  const act = ACTIVITIES[state.activity];

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
  const onCount = onNowIds().length;
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
    ...terrain3dControls()));

  // terrain shading right after the base maps and 3D, open unless you close it
  p.append(layerGroup('terrain', 'Terrain', state.overlays.maastoOverlay ? 1 : 0, true,
    toggle('Hillshade', state.hillshade, (v) => { state.hillshade = v; applyStyle(); }, 'Lidar-based, multidirectional'),
    toggle('Contour lines', state.contours, (v) => { state.contours = v; applyStyle(); }, '5 m, 2.5 m when zoomed in'),
    withOpacity('maastoOverlay', toggle(RASTER_OVERLAYS.maastoOverlay.label, !!state.overlays.maastoOverlay, rerender((v) => setOverlay('maastoOverlay', v)), RASTER_OVERLAYS.maastoOverlay.attribution.replace('© ', ''))),
    state.mmlKey ? withOpacity('mmlMaastoOverlay', toggle(RASTER_OVERLAYS.mmlMaastoOverlay.label, !!state.overlays.mmlMaastoOverlay, rerender((v) => setOverlay('mmlMaastoOverlay', v)))) : null));

  // trails & difficulty (and the map key for the base map's lines): in every sport
  p.append(layerGroup('trails', 'Trails & difficulty', (state.trailColors !== 'off' ? 1 : 0) + (state.trailDetails ? 1 : 0) + (state.labelsDown ? 1 : 0) + (state.labelsUp ? 1 : 0), ...trailControls()));

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
    const kids = g.ids.map(overlayToggle);
    if (g.id === 'safety') kids.push(h('p', { class: 'note' }, 'Planned routes are checked against these too: road works, incidents, slippery and busy roads show up under Heads-up, each with an Avoid button.'));
    if (KEYS[g.id]) kids.push(mapKey(...KEYS[g.id]()));
    p.append(layerGroup(g.id, g.title, g.ids.filter((id) => state.overlays[id]).length, ...kids));
  }

  // weather on the map — the same switches as on the Weather button's timeline
  p.append(layerGroup('weather', 'Weather on the map', wx.length + (state.timeline ? 1 : 0),
    timelineToggle(), wxToggle('wind'), wxToggle('temp'), wxToggle('rain'), wxToggle('snow'),
    h('p', { class: 'note' }, 'Forecast by Open-Meteo. Scrub or play the next 48 hours on the timeline.')));


}

// ------------------------------------------------------------------ quick layer drawer (#123)
// Layers (and L) open it: the base maps, five tiles for your sport, and More, the full panel above.
// On a phone it's a sheet from the bottom with the one swipe (js/sheet.js), modal, and a tap on the
// map closes it; on a desktop a card beside the Layers button that stays while you use the map.
// Its steps: a tile's settings (its ›) and Edit (your own tiles); More opens the full panel.
const phoneMQ = matchMedia('(max-width: 720px)');
let quickView = 'quick'; // while it's open: 'quick', 'opts:<tile>' or 'edit'
const quickOpen = () => $('#quick-layers').classList.contains('open');
const layersOpen = () => quickOpen() || !$('#layers-panel').hidden;
const plain = (t) => t.replace(/­/g, ''); // a label without its soft hyphens, for screen readers
const COLOR_KIND = { down: 'Difficulty', up: 'Uphill', both: 'Difficulty & uphill', winter: 'Winter' };
const TRAIL_KEYS = ['trailDetails', 'labelsDown', 'labelsUp'];

// The tiles for a sport: yours once you've edited them, else the sport's, whose weather tile is
// winter's while it's winter (Winter ways on land, Sea ice on water). Ids this version doesn't know are skipped.
function quickTiles(act = state.activity) {
  const mine = Array.isArray(state.quickTiles[act]) ? state.quickTiles[act] : null;
  if (mine) return mine.filter((id, i) => QUICK_TILE[id] && mine.indexOf(id) === i && (id !== 'mmlMaastoOverlay' || state.mmlKey)).slice(0, QUICK_MAX);
  const t = [...QUICK_TILES[act]];
  const cold = isWater(act) ? 'seaIce' : 'winterWays', i = t.findLastIndex((id) => id.startsWith('wx:'));
  if (state.winterOn && i >= 0 && !t.includes(cold)) t[i] = cold;
  return t;
}
const tileLabel = (id) => (id === 'lipasPoints' && QUICK_PLACES[state.activity]) || QUICK_TILE[id].label;
// a tile is on while its switch in the full panel is (Depths: while any of its three is)
function tileOn(id) {
  if (id === 'trailColors') return state.trailColors !== 'off';
  if (id === 'depths') return DEPTHS.some((d) => state.overlays[d]);
  if (id.startsWith('wx:')) return !!state.weather[id.slice(3)];
  if (TRAIL_KEYS.includes(id) || ['hillshade', 'contours'].includes(id)) return !!state[id];
  return !!state.overlays[id];
}
// turns the same switch as the full panel; Trail colours comes back as you had it, Depths with the ones you had
function setTile(id, on) {
  const act = state.activity;
  if (id === 'trailColors') setTrail('trailColors', on ? (state.trailsByActivity[act]?.colorsBack || (act === 'trailrun' ? 'up' : 'down')) : 'off');
  else if (id === 'depths') {
    const had = DEPTHS.filter((d) => state.overlays[d]), mine = DEPTHS.filter((d) => ACTIVITY_OVERLAYS[act][d]);
    if (!on && had.length) state.depthsBack = { ...state.depthsBack, [act]: had };
    const back = on ? (state.depthsBack[act] || (mine.length ? mine : DEPTHS)) : [];
    setOverlays(Object.fromEntries(DEPTHS.map((d) => [d, back.includes(d)])));
  } else if (id === 'hillshade' || id === 'contours') { state[id] = on; applyStyle(); }
  else if (TRAIL_KEYS.includes(id)) setTrail(id, on);
  else if (id.startsWith('wx:')) setWeather({ [id.slice(3)]: on });
  else setOverlay(id, on);
  renderLayersPanel();
}

// What a tile says under its name: its status first (missing data never looks complete), then its note
const TILE_SOURCES = {
  lipasRoutes: ['lipas'], lipasPoints: ['lipas'], lipasWinter: ['lipas'], nautical: ['vayla'], sfTraffic: ['digiroad'],
  sfIncidents: ['digitraffic'], sfRoadworks: ['digitraffic'], sfRoadcond: ['digitraffic'], sfShips: ['digitraffic'], sfCameras: ['digitraffic'],
  'wx:wind': ['openmeteo'], 'wx:temp': ['openmeteo'], 'wx:snow': ['openmeteo'], 'wx:rain': ['fmi', 'rainviewer'], seaIce: ['copernicus'],
};
const tileTrouble = {}; // a map source → { bad, ok }: when its tiles last failed, and last came in
let detailsBusyAt = 0; // Overpass, which takes turns between mirrors, says so to the trail details
const rasterDown = (src) => { const t = tileTrouble[src]; return !!t && t.bad > (t.ok || 0) && Date.now() - t.bad < 120e3; };
function tileZoom(id) {
  if (id === 'trailDetails') return DETAILS_ZOOM;
  if (id === 'winterWays') return WINTER_MIN_ZOOM;
  if (id === 'trailColors') return state.trailColors === 'winter' ? WINTER_MIN_ZOOM : state.trailColors === 'up' || state.trailColors === 'both' ? 13 : 0;
  if (id === 'depths') return Math.min(...DEPTHS.filter((d) => state.overlays[d]).map((d) => RASTER_OVERLAYS[d].minzoom || 0));
  return (RASTER_OVERLAYS[id] && RASTER_OVERLAYS[id].minzoom) || QUICK_TILE[id].zoom || 0;
}
function tileFailing(id) {
  const raster = id === 'depths' ? DEPTHS.filter((d) => state.overlays[d]) : RASTER_OVERLAYS[id] ? [id] : [];
  if (raster.length && raster.every((d) => rasterDown(`ov-${d}`))) return true;
  if (id === 'trailDetails') return Date.now() - detailsBusyAt < 120e3;
  const src = TILE_SOURCES[id];
  return !!src && src.every((s) => sourceStatus(s));
}
function tileStatus(id) {
  if (!tileOn(id)) return '';
  if (QUICK_TILE[id].winter && !state.winterOn) return 'Shows in winter';
  if (map.getZoom() < tileZoom(id)) return 'Zoom in to see';
  return tileFailing(id) ? 'No data now' : '';
}
function tileSmall(id) {
  const status = tileStatus(id), note = id === 'trailColors' ? COLOR_KIND[state.trailColors] : QUICK_TILE[id].note;
  if (id === 'depths') return { text: status ? `${status} · not for navigation` : note, warn: status === 'No data now' };
  return { text: status || note || '', warn: status === 'No data now' };
}
// in place, on the tiles that show: a zoom, a source failing or coming back
function refreshQuickStatus() {
  if (!quickOpen() || quickView !== 'quick') return;
  for (const t of $$('#quick-layers .qt[data-id]')) {
    const id = t.dataset.id, s = tileSmall(id), small = t.querySelector('.qt-l small'), tog = t.querySelector('.qt-tog');
    small.textContent = s.text;
    small.hidden = !s.text;
    small.classList.toggle('warn', s.warn);
    tog.setAttribute('aria-label', `${plain(tileLabel(id))}${s.text ? `, ${s.text}` : ''}`);
  }
}
let quickStatusTimer = 0;
const refreshQuickSoon = () => { clearTimeout(quickStatusTimer); quickStatusTimer = setTimeout(refreshQuickStatus, 250); };
map.on('zoomend', refreshQuickStatus);
map.on('error', (e) => {
  if (!e.sourceId || !/^ov-/.test(e.sourceId) || (e.error && e.error.name === 'AbortError')) return;
  (tileTrouble[e.sourceId] ||= {}).bad = Date.now();
  refreshQuickSoon();
});
map.on('data', (e) => {
  if (e.dataType !== 'source' || !e.tile || !tileTrouble[e.sourceId]) return;
  tileTrouble[e.sourceId].ok = Date.now();
  refreshQuickSoon();
});
onStatus(() => refreshQuickSoon());
// LIPAS back after a pause: Marked routes lists the view again (A)
onStatus((src, s) => { if (src === 'lipas' && (!s || s.retry)) planner.lipasBack(); });

// The six maps: with an MML key, MML WMTS takes Maastokartta's place while it's the map you have on
const QUICK_BASE_LABEL = { maasto: 'Maasto­kartta' };
const quickBases = () => BASES.filter(([k]) => (state.base === 'mml' ? k !== 'maasto' : k !== 'mml'));
function setBase(k) {
  state.base = k;
  applyStyle();
  renderLayersPanel();
}

// A tile's settings, one step in: the same switches as its group in the full panel
const QUICK_OPTS = {
  trailColors: trailControls,
  depths: () => [...DEPTHS.map(overlayToggle), h('p', { class: 'note' }, 'Traficom’s nautical chart data: shown, never used for routing. Not for navigation.')],
  'wx:rain': () => [wxToggle('rain'), timelineToggle()],
  'wx:temp': () => [wxToggle('temp'), timelineToggle()],
};

function renderQuickLayers(dir = null) {
  const qd = $('#quick-layers');
  if (!quickOpen()) return;
  // a change renders it again: focus and the body's scroll stay where they were
  const focusables = () => [...qd.querySelectorAll('button:not(:disabled), input, select, summary')];
  const had = !dir && qd.contains(document.activeElement) ? focusables().indexOf(document.activeElement) : -1;
  const old = qd.querySelector('.qd-body'), keep = !dir && old ? old.scrollTop : 0;
  const act = ACTIVITIES[state.activity], v = quickView;
  const head = (title, { back = false, close = true } = {}) => [
    h('div', { class: 'qd-grab', 'aria-hidden': 'true' }),
    h('div', { class: 'qd-head' },
      back ? h('button', { type: 'button', class: 'qd-back', 'aria-label': 'Back to quick layers', onclick: () => quickStep('quick'), html: icon('chevronLeft', 22) }) : null,
      h('h2', {}, title),
      close ? h('button', { type: 'button', class: 'qd-x', 'aria-label': 'Close', onclick: () => openPanel(null), html: icon('close', 18) }) : null),
  ];
  let parts;
  if (v === 'edit') {
    // your own tiles: a tap on one takes it off, a chip adds one, five at most
    const tiles = quickTiles(), full = tiles.length >= QUICK_MAX;
    const set = (list) => { state.quickTiles = { ...state.quickTiles, [state.activity]: list }; saveSettings(); renderQuickLayers(); };
    const groups = [];
    for (const [id, t] of Object.entries(QUICK_TILE)) {
      if (tiles.includes(id) || (id === 'mmlMaastoOverlay' && !state.mmlKey)) continue;
      if (!groups.length || groups[groups.length - 1][0] !== t.group) groups.push([t.group, []]);
      groups[groups.length - 1][1].push(id);
    }
    parts = [...head(`Your tiles for ${act.label}`, { close: false }),
      h('div', { class: 'qd-body qd-edit' },
        h('h3', { class: 'qd-lab' }, `On the drawer · ${tiles.length} of ${QUICK_MAX}`),
        h('div', { class: 'qd-tiles' },
          ...tiles.map((id) => h('div', { class: 'qt' }, h('button', {
            type: 'button', class: 'qt-rm', 'data-rm': id, 'aria-label': `Take off ${plain(tileLabel(id))}`, onclick: () => set(tiles.filter((x) => x !== id)),
          }, h('span', { class: 'qt-ic', html: icon(QUICK_TILE[id].icon, 20) }), h('span', { class: 'qt-l' }, tileLabel(id)), h('span', { class: 'rm', html: icon('minus', 16) })))),
          ...Array.from({ length: QUICK_MAX - tiles.length }, () => h('div', { class: 'qd-slot' }, 'Room for one more: add it below'))),
        h('h3', { class: 'qd-lab' }, full ? 'Add a tile · take one off first' : 'Add a tile'),
        ...groups.flatMap(([g, ids]) => [h('h4', { class: 'qd-grp' }, g), h('div', { class: 'qd-add' },
          ...ids.map((id) => h('button', { type: 'button', class: 'qd-chip', 'data-add': id, disabled: full, onclick: () => set([...tiles, id]), html: `${icon('plus', 16)}<span>${tileLabel(id)}</span>` })))])),
      h('div', { class: 'qd-foot' },
        h('button', { type: 'button', class: 'qd-link', onclick: () => {
          const { [state.activity]: _, ...rest } = state.quickTiles;
          state.quickTiles = rest;
          saveSettings();
          renderQuickLayers();
        } }, `Reset to ${act.label}’s tiles`),
        h('button', { type: 'button', class: 'qd-done', onclick: () => quickStep('quick') }, 'Done'))];
  } else if (v.startsWith('opts:')) {
    const id = v.slice(5);
    parts = [...head(tileLabel(id), { back: true }), h('div', { class: 'qd-body qd-opts' }, ...QUICK_OPTS[id]())];
  } else {
    const tiles = quickTiles();
    const covered = new Set(tiles.flatMap((id) => (id === 'depths' ? DEPTHS : [id])));
    const more = onNowIds().filter((id) => !covered.has(id)).length;
    const bases = quickBases(), chosen = bases.some(([k]) => k === state.base) ? state.base : bases[0][0];
    parts = [...head('Map layers'),
      h('div', { class: 'qd-body' },
        h('h3', { class: 'qd-lab', id: 'qd-maps' }, 'Map'),
        h('div', { class: 'qd-bases', role: 'radiogroup', 'aria-labelledby': 'qd-maps', onkeydown: (e) => {
          const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
          if (!step) return;
          e.preventDefault();
          const k = bases[(bases.findIndex(([b]) => b === e.target.dataset.base) + step + bases.length) % bases.length][0];
          setBase(k);
          $(`#quick-layers [data-base="${k}"]`)?.focus();
        } }, ...bases.map(([k, label]) => h('button', {
          type: 'button', class: 'qd-base', role: 'radio', 'aria-checked': String(state.base === k), tabindex: k === chosen ? '0' : '-1', 'data-base': k, title: plain(BASE_NOTE[k] || ''),
          onclick: () => setBase(k),
        }, h('img', { src: thumb(k), alt: '', width: '120', height: '80' }), h('span', {}, QUICK_BASE_LABEL[k] || label)))),
        h('div', { class: 'qd-lab' }, h('h3', {}, 'On the map · ', h('b', {}, act.label)),
          h('button', { type: 'button', class: 'qd-edit-btn', 'aria-label': `Edit the tiles for ${act.label}`, onclick: () => quickStep('edit') }, 'Edit')),
        h('div', { class: 'qd-tiles' },
          ...tiles.map((id) => {
            const on = tileOn(id), s = tileSmall(id), label = tileLabel(id);
            return h('div', { class: `qt${on ? ' on' : ''}`, 'data-id': id },
              h('button', { type: 'button', class: 'qt-tog', 'aria-pressed': String(on), 'data-tile': id, 'aria-label': `${plain(label)}${s.text ? `, ${s.text}` : ''}`, onclick: () => setTile(id, !tileOn(id)) },
                h('span', { class: 'qt-ic', html: icon(QUICK_TILE[id].icon, 20) }),
                h('span', { class: 'qt-l' }, label, h('small', { class: s.warn ? 'warn' : null, hidden: !s.text }, s.text))),
              QUICK_TILE[id].opts ? h('button', { type: 'button', class: 'qt-opt', 'data-opts': id, 'aria-label': `${plain(label)}: settings`, onclick: () => quickStep(`opts:${id}`), html: icon('chevronRight', 18) }) : null);
          }),
          h('button', { type: 'button', class: 'qt qt-more', 'aria-label': `More: all layers${more ? `, ${more} more on` : ''}`, onclick: () => openPanel('layers-panel', { step: true }) },
            h('span', { class: 'qt-ic', html: icon('layers', 20) }), h('span', { class: 'qt-l' }, 'More', h('small', {}, more ? `${more} more on` : 'All layers')),
            h('span', { class: 'chev', html: icon('chevronRight', 18) }))))];
  }
  qd.replaceChildren(...parts);
  const body = qd.querySelector('.qd-body');
  if (dir) body.classList.add(dir === 'in' ? 'from-right' : 'from-left');
  else body.scrollTop = keep;
  if (had >= 0) (focusables()[had] || focusables()[0])?.focus({ preventScroll: true });
}

// One step in (a tile's settings, Edit) or back to the tiles. A tile's settings keep the drawer's
// height, so nothing jumps (their body scrolls); Edit grows past it, up to the room there is.
// Focus goes in, and back to what opened it.
function quickStep(view) {
  const qd = $('#quick-layers'), from = quickView, h0 = `${Math.round(qd.offsetHeight)}px`;
  if (view === from) return;
  quickView = view;
  qd.style.height = view.startsWith('opts:') ? h0 : '';
  qd.style.minHeight = view === 'edit' ? h0 : '';
  renderQuickLayers(view === 'quick' ? 'out' : 'in');
  const opener = from.startsWith('opts:') ? qd.querySelector(`[data-opts="${from.slice(5)}"]`) : qd.querySelector('.qd-edit-btn');
  (view === 'quick' ? opener : qd.querySelector('.qd-back, .qd-body button, .qd-body input'))?.focus({ preventScroll: true });
}

// On a desktop the card sits beside the Layers button, its bottom level with the button's; in a window
// under 560 px high it reaches down to the bottom, like the full panel. Above a bottom planner while
// that leaves it 320 px, else over it.
function placeQuick() {
  const qd = $('#quick-layers');
  if (phoneMQ.matches) { qd.style.removeProperty('--qd-bottom'); qd.classList.remove('tail'); return; }
  const sheet = parseFloat(document.documentElement.style.getPropertyValue('--sheet-h')) || 0;
  const level = Math.round(innerHeight - $('#btn-layers').getBoundingClientRect().bottom);
  let bottom = innerHeight < 560 ? 12 : level;
  if (sheet && innerHeight - sheet - 12 - 64 >= 320) bottom = Math.max(bottom, sheet + 12);
  qd.style.setProperty('--qd-bottom', `${bottom}px`);
  qd.classList.toggle('tail', bottom === level && innerHeight >= 560);
}
addEventListener('resize', () => { placePanels(); if (quickOpen()) placeQuick(); });

function showQuick(open, { instant = false, back = false } = {}) {
  const qd = $('#quick-layers');
  if (open === quickOpen() && !back) return;
  qdSwipe.stop();
  if (instant) qd.classList.add('instant'); // L, Enter or a step: at once, nothing animates for the keyboard
  if (open) { quickView = 'quick'; qd.style.height = ''; qd.style.minHeight = ''; placeQuick(); }
  qd.classList.toggle('open', open);
  qd.setAttribute('aria-modal', String(phoneMQ.matches));
  if (open) renderQuickLayers(back ? 'out' : null);
  if (instant) { void qd.offsetWidth; qd.classList.remove('instant'); }
}

// The swipe on a phone: down past 40 % (or a flick) closes the drawer, or steps back from a tile's
// settings and Edit (it's Done there); up (or a flick) is More. The full panel's swipe down is ‹.
const qdSwipe = swipeSheet($('#quick-layers'), {
  enabled: () => phoneMQ.matches && quickOpen(),
  start: () => {
    const qd = $('#quick-layers'), H = qd.offsetHeight, step = quickView !== 'quick';
    qd.classList.add('dragging');
    return {
      H, now: H, min: 0, max: H, from: step ? 'here' : 'quick',
      sizes: step ? [{ name: 'back', at: 0, rest: H }, { name: 'here', at: H }] : [{ name: 'closed', at: 0 }, { name: 'quick', at: H }, { name: 'all', at: H + 140, rest: H }],
    };
  },
  pick: (aim, r) => (aim < r.H * (1 - SWIPE.closeAt) ? (r.from === 'quick' ? 'closed' : 'back') : aim > r.H + 70 && r.from === 'quick' ? 'all' : r.from),
  aim: (name) => {
    if (name === 'back') quickStep('quick');
    if (name === 'all') openPanel('layers-panel', { step: true });
  },
  end: (name) => { $('#quick-layers').classList.remove('dragging'); if (name === 'closed') openPanel(null, { instant: true }); },
  cancel: () => $('#quick-layers').classList.remove('dragging'),
});
const lpSwipe = swipeSheet($('#layers-panel'), {
  enabled: () => phoneMQ.matches && !$('#layers-panel').hidden,
  start: () => {
    const lp = $('#layers-panel'), H = lp.offsetHeight;
    lp.classList.add('dragging');
    return { H, now: H, min: 0, max: H, from: 'all', sizes: [{ name: 'back', at: 0, rest: H }, { name: 'all', at: H }] };
  },
  pick: (aim, r) => (aim < r.H * (1 - SWIPE.closeAt) ? 'back' : 'all'),
  aim: (name) => { if (name === 'back') openPanel('quick-layers', { back: true }); },
  end: () => $('#layers-panel').classList.remove('dragging'),
  cancel: () => $('#layers-panel').classList.remove('dragging'),
});

// Esc steps back (a tile's settings, Edit, the full panel), then closes, with focus back on Layers
function layersEscape() {
  if (quickOpen() && quickView !== 'quick') { quickStep('quick'); return true; }
  if (!$('#layers-panel').hidden) { openPanel('quick-layers', { back: true }); return true; }
  if (quickOpen()) { openPanel(null); return true; }
  return false;
}
for (const el of $$('#quick-layers, #layers-panel')) el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && layersEscape()) { e.preventDefault(); e.stopPropagation(); } });
// a tap on the map closes the phone sheet, and does nothing else (no waypoint while planning)
$('#quick-scrim').addEventListener('click', () => openPanel(null));
phoneMQ.addEventListener('change', () => {
  $('#quick-scrim').hidden = !(layersOpen() && phoneMQ.matches);
  $('#quick-layers').setAttribute('aria-modal', String(phoneMQ.matches));
  if (quickOpen()) placeQuick();
});
// the pictures for the maps, while the app is idle: the service worker keeps them for offline use
map.once('idle', () => (window.requestIdleCallback || setTimeout)(() => { for (const [k] of BASES) new Image().src = thumb(k); }));

// ------------------------------------------------------------------ settings panel
// How Polku behaves (not what the map shows): your speeds, the planner, display, offline, data (#321).
let speedOpen = null; // the sport whose speeds Settings shows opened (none at first)
function renderSettingsPanel() {
  const p = $('#settings-body');
  const keepScroll = p.scrollTop;
  requestAnimationFrame(() => { p.scrollTop = keepScroll; });
  p.innerHTML = '';
  p.append(section('About Polku',
    h('button', { type: 'button', class: 'btn', id: 'btn-changelog', onclick: (e) => openChangelog(e.currentTarget) }, 'What’s new'),
    h('p', { class: 'note' }, 'Read recent changes without leaving your route.')));

  // Your speeds: every sport in a row of its own, its speeds in one line; a tap opens the planner's own editor in
  // place, one sport at a time. A change re-times the route when it has legs in that sport, whatever the map's
  // sport is (#87). The sport itself is the pill's (and the next leg's, the planner's drawing menu): Settings holds
  // settings, not the map's choices (#321).
  const inRoute = planner.points.length > 1 ? planner.routeSports() : [];
  const speeds = h('div', { class: 'speed-list' });
  for (const [k, a] of Object.entries(ACTIVITIES)) {
    const open = speedOpen === k;
    const row = h('button', { type: 'button', class: 'speed-sport-row', 'data-k': k, 'aria-expanded': String(open),
      onclick: () => { speedOpen = open ? null : k; renderSettingsPanel(); $(`#settings-body .speed-sport-row[data-k="${k}"]`)?.focus(); },
      html: `${icon(ACT_ICONS[k], 18)}<span><b>${a.label}${inRoute.includes(k) ? ' <span class="cur">your route</span>' : ''}</b><small>${escapeAttr(planner.speedLine(k))}</small></span>${icon(open ? 'chevronUp' : 'chevronDown', 16)}` });
    speeds.append(row);
    if (!open) continue;
    const box = h('div', { class: 'speed-box' });
    speeds.append(box);
    renderSpeedEditor(box, k, {
      craft: planner.craft, onCraft: (c) => planner.setCraft(c),
      onChange: () => { row.querySelector('small').textContent = planner.speedLine(k); if (planner.routeSports().includes(k)) planner.retime(); },
    });
  }
  p.append(section('Your speeds', speeds,
    h('p', { class: 'note' }, 'Polku times your route with these speeds, so they also decide when you reach each place and the weather you meet there. A change applies at once to your route’s legs in that sport. The planner has the same speeds in its drawing menu and in Route › How you go. Kept on this device only.')));

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
// id: 'quick-layers' (Layers and L: the drawer, or closing whatever of it is open), 'layers-panel'
// (the full panel: More, a step from the drawer), 'settings-panel', or null to close them all.
// instant: no animation (the keyboard); step: More's step in; back: from the full panel to the drawer.
function openPanel(id, { instant = false, step = false, back = false } = {}) {
  if (id === 'settings-panel') renderSettingsPanel(); // fresh: speeds may have changed in the planner
  const wasLayers = layersOpen(), focusIn = $$('#quick-layers, #layers-panel').some((el) => el.contains(document.activeElement));
  if (id === 'quick-layers' && wasLayers && !back) id = null;
  lpSwipe.stop();
  for (const el of $$('.panel')) {
    const on = el.id === id && (el.hidden || step);
    el.hidden = !on;
    if (on && step) { el.classList.add('step-in'); el.addEventListener('animationend', () => el.classList.remove('step-in'), { once: true }); }
    const btn = $(`[data-panel="${el.id}"]`);
    if (btn) btn.setAttribute('aria-pressed', String(on));
  }
  // a step to and from the full panel changes the drawer at once: the step's own slide is the motion
  showQuick(id === 'quick-layers', { instant: instant || step || back, back });
  const lay = layersOpen();
  $('#btn-layers').setAttribute('aria-expanded', String(lay));
  $('#quick-scrim').hidden = !(lay && phoneMQ.matches);
  if (id === 'quick-layers' && !back) $('#quick-layers .qd-base[tabindex="0"]')?.focus({ preventScroll: true });
  else if (back) $('#quick-layers .qt-more')?.focus({ preventScroll: true });
  else if (step && id === 'layers-panel') $('#layers-panel .panel-back')?.focus({ preventScroll: true });
  else if (!lay && focusIn) $('#btn-layers').focus({ preventScroll: true });
}
// a button pressed from the keyboard (detail 0) opens its panel at once
for (const btn of $$('[data-panel]')) btn.addEventListener('click', (e) => openPanel(btn.dataset.panel, { instant: e.detail === 0 }));
for (const btn of $$('.panel .panel-close')) btn.addEventListener('click', () => openPanel(null));
$('#layers-panel .panel-back').addEventListener('click', () => openPanel('quick-layers', { back: true }));

for (const b of $$('#btn-plan, #btn-plan-search')) b.addEventListener('click', () => planner.setActive(!planner.active));
// The button and T open and close the timeline over the map, while planning too (#225).
const toggleTimeline = () => {
  setTimeline(!state.timeline);
  renderLayersPanel();
};
$('#btn-time').addEventListener('click', toggleTimeline);
$('#btn-zoom-in').addEventListener('click', () => map.zoomIn());
$('#btn-fit').innerHTML = icon('fit', 20);
$('#btn-fit').addEventListener('click', () => planner.fitRoute());
$('#btn-zoom-out').addEventListener('click', () => map.zoomOut());

// Phones: the floating timeline sits above the Plan pill, or 16 px above the planner's sheet while
// planning; the map's buttons and the planner's toolbox ride above it. Where they wouldn't fit above it
// (a half or full sheet, or a short phone), it's on the sheet under its header instead (body.wx-over).
function syncWxH() {
  const b = $('#wx-bar'), st = planner.panel.dataset.state, phone = matchMedia('(max-width: 720px)').matches;
  const shown = !b.hidden && !b.classList.contains('docked'), open = shown && phone;
  const css = (k) => parseFloat(document.documentElement.style.getPropertyValue(k)) || 0;
  // desktops: a bottom panel raised too high for it above (unless you've placed it yourself)
  const deskOver = shown && !phone && planner.active && planner.layout() === 'sheet' && !b.classList.contains('placed')
    && innerHeight - css('--sheet-h') - Math.max(40, css('--tools-h') + 8) - b.offsetHeight < $('.topbar').getBoundingClientRect().bottom + 8;
  const over = deskOver || (open && planner.active && (st === 'half' || st === 'full' || (st === 'profile' && !columnFits(b.offsetHeight + 12))));
  document.body.classList.toggle('wx-over', over);
  const floating = open && !over;
  // the column normally sits 12 px up; above the timeline it needs its height plus the timeline's offset (less those 12, plus 8 apart)
  document.documentElement.style.setProperty('--wx-h', `${floating && b.offsetHeight ? b.offsetHeight + (planner.active ? 12 : 40) : 0}px`);
  planner.placeToolsSoon();
  fitColumn();
}
new ResizeObserver(syncWxH).observe($('#wx-bar'));

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
  // E: Done or Edit, where the button is (25c)
  else if (e.key === 'e' && !mod && !e.altKey && planner.active && planner.points.length && !planner.loop.open) { if (planner.inView()) planner.setEditing(true); else planner.done(); }
  else if (planner.active && !planner.inView() && !mod && !e.altKey && { p: 1, s: 1, w: 1 }[e.key]) planner.setMode({ p: 'auto', s: 'line', w: 'water' }[e.key]); // the next leg's mode
  else if (e.key === 'l' && !mod) openPanel('quick-layers', { instant: true });
  else if (e.key === 't' && !mod) toggleTimeline();
  else if (e.key === 'Escape') {
    if (layersEscape()) return;
    if (planner.cards.escape()) return; // a card: one back (from the first, closed); Move: cancelled
    openPanel(null); if (planner.menu) planner.menu.remove(); planner.closeMore(); closeActs();
  }
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
  planner.setActive(true, { edit: false }); // (the route's view: 25c)
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
// The weather layers and the timeline left on start now, not on the map's load: on phones the map's
// buttons ride above the timeline, and they'd move up under a finger once the map had loaded (#292).
// The forecast needs only the view. The buttons show once the timeline has its rows (a frame of its
// own, before this one), in their place, without sliding there.
if (state.weather.wind || state.weather.temp || state.weather.rain) weather.set(state.weather);
if (state.timeline) setTimeline(true);
requestAnimationFrame(() => { syncWxH(); document.body.classList.add('ready'); });
// MapLibre fires `load` (and `idle`) at the end of a frame it draws once every tile is in or has failed, but a tile
// that fails with anything but a 404 asks for no frame. When it was the last one, the load step below waited until
// the map was moved (#393): one more frame. (The quick drawer's "No data now" comes from the same errors.)
map.on('error', (e) => { if (e.tile) map.triggerRepaint(); });
map.on('load', () => {
  // Start with the attribution collapsed to its (i) button on small screens (and it stays so: above).
  if (window.innerWidth < 720) $('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
  configureLayers();
  syncZoomHint();
  syncView3d();
  // a first visit: show where you are, if the browser may tell (Helsinki stays otherwise)
  if (firstVisit && navigator.geolocation) setTimeout(() => locate.start({ quiet: true }), 600);
  if (shared && shared.points.length) {
    planner.restore(shared);
    planner.setActive(true, { edit: false }); // a shared route opens in the route's view, to read it first (25c)
    // its points now, its routed line once the legs are in
    const b = bbox(shared.points);
    if (b[0] !== b[2]) planner.frame(b, { duration: 0, maxZoom: map.getMaxZoom() });
    planner.frameWhenRouted();
    history.replaceState(null, '', location.pathname + location.hash);
  } else {
    planner.loadSaved(); // last session's route
    if (leftOpen) planner.setActive(true); // and the planner, if it was left open (#238)
  }
});
