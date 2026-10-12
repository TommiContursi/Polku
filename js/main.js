// Polku — app bootstrap: map, state, panels and wiring between modules.

import {
  ACTIVITIES, ACTIVITY_OVERLAYS, RASTER_OVERLAYS, OVERLAY_GROUPS, DEM_URL, DEM_MAXZOOM,
  DIFF_COLORS, MTB_SCALE_TEXT, UPHILL_TEXT, GRADE_BANDS, LIPAS_TYPES,
} from './config.js';
import { buildStyle } from './style.js';
import { installIcons } from './icons.js';
import { Planner, parseShared } from './planner.js';
import { UphillLayer } from './uphill.js';
import { LipasLayer } from './lipas.js';
import { initInspector } from './inspect.js';
import { initSearch } from './search.js';
import { parseTrackFile } from './gpx.js';
import { lineLength, bbox, fmtDist } from './geo.js';
import { $, $$, h, icon, toast, store } from './ui.js';
import { initGestures } from './gestures.js';
import { initView3d } from './view3d.js';
import { WeatherOverlay } from './wxmap.js';
import { isAerial } from './style.js';
import { WIND_CLASSES } from './weather.js';

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
  labelsDown: false,
  labelsUp: false,
  weather: { wind: false, temp: false, rain: false },
  exaggeration: 1.4,
  mmlKey: '',
  overlaysByActivity: {},
};
const state = { ...DEFAULTS, ...store.get('settings', {}) };
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
initGestures(map, { trackpadTilt: () => state.terrain3d && state.trackpadTilt });
const view3d = initView3d(map, $('#view3d'));
// Rotation and tilt stay available in 2D too (right-drag, Ctrl+drag, two fingers);
// the on-screen pad appears whenever the view is tilted or 3D terrain is on.
const syncView3d = () => view3d.show(state.terrain3d || map.getPitch() > 5);
map.on('pitchend', syncView3d);
map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Polku' }), 'bottom-right');
map.addControl(new maplibregl.ScaleControl({ maxWidth: 110 }), 'bottom-left');
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
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
  $('#btn-3d').setAttribute('aria-pressed', String(state.terrain3d));
  syncView3d();
  saveSettings();
}

// ------------------------------------------------------------------ modules
const uphill = new UphillLayer(map, (fc) => setData('uphill', fc));
const lipas = new LipasLayer(map, (routes, points) => { setData('lipasRoutes', routes); setData('lipasPoints', points); });

const planner = new Planner(map, {
  activity: () => state.activity,
  setData,
  onActiveChange: (on) => {
    $('#btn-plan').setAttribute('aria-pressed', String(on));
    syncPlannerPadding();
  },
});

initInspector(map, {
  isPlanning: () => planner.active,
  routeFrom: (ll, mode) => {
    planner.setActive(true);
    if (mode) planner.setMode(mode);
    planner.clear();
    planner.addPoint(ll);
    toast('Now click where you want to go');
  },
  routeTo: (ll) => { planner.setActive(true); planner.addPoint(ll); },
});

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
});
function setWeather(patch) {
  Object.assign(state.weather, patch);
  weather.set(state.weather);
  $('#btn-wind').setAttribute('aria-pressed', String(state.weather.wind));
  applyStyle();
  renderLayersPanel();
}
// Console debugging: polku.set({ base: 'night' }) etc.
window.polku = {
  map, planner, state, uphill, lipas, weather,
  set(patch) {
    if (patch.activity) { setActivity(patch.activity); delete patch.activity; }
    Object.assign(state, patch); applyStyle(); configureLayers(); renderLayersPanel(); renderLegend();
  },
};

function syncPlannerPadding() {
  const sheet = $('#planner');
  const pad = planner.active && !sheet.hidden ? sheet.offsetHeight : 0;
  document.documentElement.style.setProperty('--sheet-h', `${pad}px`);
}
new ResizeObserver(syncPlannerPadding).observe($('#planner'));

function configureLayers() {
  const a = ACTIVITIES[state.activity];
  lipas.configure({ routes: a.lipas.routes, points: a.lipas.points, showRoutes: !!state.overlays.lipasRoutes, showPoints: !!state.overlays.lipasPoints });
  uphill.setEnabled(state.activity === 'mtb' && (state.trailColors !== 'down' || state.labelsUp));
}

// ------------------------------------------------------------------ activity bar
function renderActivityBar() {
  const bar = $('#activity-bar');
  bar.innerHTML = '';
  const icons = { mtb: 'bike', gravel: 'gravel', hike: 'hike', paddle: 'paddle' };
  for (const [k, a] of Object.entries(ACTIVITIES)) {
    bar.append(h('button', {
      type: 'button', class: 'act', 'aria-pressed': String(state.activity === k), title: a.label,
      onclick: () => setActivity(k), html: `${icon(icons[k], 20)}<span>${a.label}</span>`,
    }));
  }
}

function setActivity(k) {
  if (state.activity === k) return;
  state.activity = k;
  state.overlays = overlaysFor(k);
  document.body.dataset.activity = k;
  renderActivityBar();
  renderLayersPanel();
  renderLegend();
  applyStyle();
  configureLayers();
  planner.onActivityChange();
}

// ------------------------------------------------------------------ layers panel
function setOverlay(id, on) {
  state.overlays[id] = on;
  state.overlaysByActivity[state.activity] = { ...(state.overlaysByActivity[state.activity] || {}), [id]: on };
  applyStyle();
  configureLayers();
}

const OVERLAY_LABEL = {
  lipasRoutes: 'Official routes (LIPAS)',
  lipasPoints: 'Lean-tos, huts, campfire & landing sites (LIPAS)',
  pois: 'OSM outdoor places',
};

function renderLayersPanel() {
  const p = $('#layers-body');
  const keepScroll = p.scrollTop; // re-rendering after a toggle must not jump to the top
  requestAnimationFrame(() => { p.scrollTop = keepScroll; });
  p.innerHTML = '';
  const section = (title, ...kids) => h('section', { class: 'lp-sec' }, h('h3', {}, title), ...kids);
  const toggle = (label, on, fn, note = '') => {
    const id = `t-${Math.random().toString(36).slice(2, 8)}`;
    return h('label', { class: 'tg', for: id },
      h('span', { class: 'tg-text' }, label, note ? h('small', {}, note) : null),
      h('input', { type: 'checkbox', id, checked: on, role: 'switch', onchange: (e) => fn(e.target.checked) }),
      h('span', { class: 'tg-ui', 'aria-hidden': 'true' }));
  };
  const seg = (options, value, fn) => h('div', { class: 'seg small full' },
    ...options.map(([v, label, disabled]) => h('button', { type: 'button', 'aria-pressed': String(value === v), disabled: !!disabled, onclick: () => fn(v) }, label)));

  p.append(section('Base map',
    seg([['trail', 'Trail map'], ['maasto', 'Maastokartta'], ['aerial', 'Aerial'], ['ortofi', 'Aerial FI'], ['plain', 'Plain'], ['night', 'Night'], ...(state.mmlKey ? [['mml', 'MML WMTS']] : [])], state.base, (v) => {
      state.base = v; applyStyle(); renderLayersPanel();
    }),
    h('p', { class: 'note' }, {
      trail: 'Polku’s own trail map from OpenStreetMap, with lidar hillshade and contours.',
      maasto: 'The National Land Survey terrain map (via Kapsi), with Polku’s trails, difficulty and routes drawn on top. Finland only.',
      aerial: 'Esri world imagery with trails on top.',
      ortofi: 'National Land Survey aerial photos (via Kapsi) — sharper than global imagery in Finland.',
      plain: 'Muted base for reading routes and overlays.',
      night: 'Dark map for dusk and night use.',
      mml: 'Official MML WMTS terrain map with your own API key.',
    }[state.base] || '')));

  if (state.activity === 'mtb') {
    p.append(section('Trail colours',
      seg([['down', 'Difficulty'], ['up', 'Uphill'], ['both', 'Both']], state.trailColors, (v) => {
        state.trailColors = v; applyStyle(); configureLayers(); renderLayersPanel(); renderLegend();
        if (v !== 'down' && map.getZoom() < 13) toast('Zoom in to level 13+ to see uphill grades');
      }),
      h('p', { class: 'note' }, {
        down: 'Halo colour is the regular MTB difficulty from OSM mtb:scale (S0 green → S5 purple). White halo = not graded yet.',
        up: 'Uphill grade (↑S0–↑S5) computed from the lidar elevation model for every trail in view, bumped for loose or technical surface. OSM mtb:scale:uphill tags override it. Arrows point uphill.',
        both: 'Halo = regular MTB difficulty (mtb:scale). Thin stripe beside it = uphill grade, with arrows pointing uphill on climbs of 8 %+.',
      }[state.trailColors]),
      toggle('Difficulty numbers', state.labelsDown, (v) => { state.labelsDown = v; applyStyle(); }, 'S0–S6 beside graded trails (zoom 15+)'),
      toggle('Uphill numbers', state.labelsUp, (v) => {
        state.labelsUp = v; applyStyle(); configureLayers();
        if (v && map.getZoom() < 14.5) toast('Zoom in to level 15 to see the numbers');
      }, '↑S0–↑S5 on climbs of 6 %+ (zoom 15+)')));
  }

  p.append(section('Terrain',
    toggle('Hillshade', state.hillshade, (v) => { state.hillshade = v; applyStyle(); }, 'Lidar-based, multidirectional'),
    toggle('Contour lines', state.contours, (v) => { state.contours = v; applyStyle(); }, '5 m, 2.5 m when zoomed in'),
    toggle('3D terrain', state.terrain3d, (v) => { state.terrain3d = v; applyStyle(); if (v && map.getPitch() < 30) map.easeTo({ pitch: 60, duration: 800 }); if (!v) map.easeTo({ pitch: 0 }); renderLayersPanel(); }),
    state.terrain3d ? toggle('Trackpad scroll tilts & rotates', state.trackpadTilt, (v) => { state.trackpadTilt = v; saveSettings(); }, 'Two-finger scroll: up/down tilts, sideways rotates; pinch zooms') : null,
    state.terrain3d ? h('label', { class: 'range' }, 'Exaggeration',
      h('input', { type: 'range', min: '1', max: '3', step: '0.1', value: String(state.exaggeration), oninput: (e) => { state.exaggeration = +e.target.value; map.setTerrain({ source: 'terrain', exaggeration: state.exaggeration }); saveSettings(); } })) : null,
    toggle('High contrast', state.highContrast, (v) => { state.highContrast = v; applyStyle(); }, 'Thicker trails for bright sunlight')));

  p.append(section('Weather',
    toggle('Wind', state.weather.wind, (v) => setWeather({ wind: v }), 'Animated wind and speed, 48 h forecast'),
    toggle('Temperature', state.weather.temp, (v) => setWeather({ temp: v }), 'Colour field with °C labels'),
    toggle('Rain', state.weather.rain, (v) => setWeather({ rain: v }), 'Radar now (FMI / RainViewer), forecast later'),
    h('p', { class: 'note' }, 'Forecast by Open-Meteo. Use the time bar to scrub or play the next 48 hours.')));

  for (const g of OVERLAY_GROUPS) {
    p.append(section(g.title, ...g.ids.map((id) => {
      const o = RASTER_OVERLAYS[id];
      const label = OVERLAY_LABEL[id] || (o && o.label) || id;
      const note = o ? o.attribution.replace('© ', '') : id.startsWith('lipas') ? 'LIPAS, Finland' : 'OpenStreetMap';
      return toggle(label, !!state.overlays[id], (v) => setOverlay(id, v), note);
    })));
  }

  const keyInput = h('input', { type: 'password', placeholder: 'Paste your MML API key', value: state.mmlKey, autocomplete: 'off', spellcheck: 'false' });
  p.append(section('MML API key (optional)',
    h('p', { class: 'note' }, 'Maastokartta works without a key via Kapsi. A key adds the official MML WMTS service as an extra base and overlay. Keys are free from ',
      h('a', { href: 'https://www.maanmittauslaitos.fi/rajapinnat/api-avaimen-ohje', target: '_blank', rel: 'noopener' }, 'maanmittauslaitos.fi'),
      ' and is stored only in this browser.'),
    h('div', { class: 'key-row' }, keyInput, h('button', { type: 'button', class: 'btn', onclick: () => {
      state.mmlKey = keyInput.value.trim();
      if (!state.mmlKey && state.base === 'mml') state.base = 'trail';
      applyStyle(); renderLayersPanel(); toast(state.mmlKey ? 'MML key saved' : 'MML key removed');
    } }, 'Save')),
    state.mmlKey ? toggle(RASTER_OVERLAYS.mmlMaastoOverlay.label, !!state.overlays.mmlMaastoOverlay, (v) => setOverlay('mmlMaastoOverlay', v)) : null));
}

// ------------------------------------------------------------------ legend
function renderLegend() {
  const p = $('#legend-body');
  p.innerHTML = '';
  const item = (swatch, label) => h('div', { class: 'lg-item' }, swatch, h('span', {}, label));
  const line = (style) => h('span', { class: 'lg-line', style });
  const sec = (title, ...items) => h('section', { class: 'lp-sec' }, h('h3', {}, title), ...items);
  if (state.activity === 'mtb' && state.trailColors !== 'up') {
    p.append(sec('MTB difficulty (halo)', ...MTB_SCALE_TEXT.slice(0, 6).map((t, i) => item(line(`background:${DIFF_COLORS[i]};height:8px`), t)),
      item(line('background:#fff;height:8px;box-shadow:inset 0 0 0 1px #ccc'), 'Not graded in OSM')));
  }
  if (state.activity === 'mtb' && state.trailColors !== 'down') {
    p.append(sec(state.trailColors === 'both' ? 'Uphill difficulty (stripe)' : 'Uphill difficulty', ...UPHILL_TEXT.map((t, i) => item(line(`background:${DIFF_COLORS[i]};height:${state.trailColors === 'both' ? 4 : 8}px`), t)),
      item(h('span', { class: 'lg-arrow' }, '»'), 'Uphill direction (8 %+)')));
  }
  p.append(sec('Ways',
    item(line('border-top:2px dashed #1f1f1f'), 'Path / trail'),
    item(line('border-top:2px dashed #6b4f2a;border-image:repeating-linear-gradient(90deg,#6b4f2a 0 12px,transparent 12px 15px) 1'), 'Forest road / track'),
    item(line('background:#5b7fa8;height:2px'), 'Cycleway (paved)'),
    item(line('border-top:3px dotted #dc2626'), 'No bikes (beside a path)'),
    state.activity === 'gravel' ? item(line('background:#fde7c1;height:6px;box-shadow:0 0 0 2px #c4842d'), 'Unpaved road') : null,
    item(line('background:#3f8f3f;height:2px;opacity:.7'), 'Protected area boundary')));
  p.append(sec('Route',
    item(line('background:#e11d48;height:5px'), 'Follows paths'),
    item(line('background:#0369a1;height:5px'), 'Over water'),
    item(line('border-top:5px dotted #ea580c'), 'Carry / portage'),
    item(line('border-top:4px dashed #be123c'), 'Straight line')));
  p.append(sec('Gradient (profile)', ...GRADE_BANDS.map(([, c, l]) => item(line(`background:${c};height:8px`), l))));
  p.append(sec('Wind along the route', ...WIND_CLASSES.map((c) => item(line(`background:${c.color};height:8px`), c.label)),
    item(h('span', { class: 'lg-arrow' }, '➜'), 'Arrow = where the wind blows')));
  p.append(sec('LIPAS places', ...Object.values(LIPAS_TYPES).filter((t) => t.icon).map((t) => item(h('span', { class: 'lg-dot', style: `background:${t.color}` }), t.name))));
}

// ------------------------------------------------------------------ panels & buttons
function openPanel(id) {
  for (const el of $$('.panel')) {
    const on = el.id === id && el.hidden;
    el.hidden = !on;
    const btn = $(`[data-panel="${el.id}"]`);
    if (btn) btn.setAttribute('aria-pressed', String(on));
  }
}
for (const btn of $$('[data-panel]')) btn.addEventListener('click', () => openPanel(btn.dataset.panel));
for (const btn of $$('.panel .panel-close')) btn.addEventListener('click', () => openPanel(null));

$('#btn-plan').addEventListener('click', () => planner.setActive(!planner.active));
$('#btn-wind').addEventListener('click', () => setWeather({ wind: !state.weather.wind }));
$('#btn-3d').addEventListener('click', () => {
  state.terrain3d = !state.terrain3d;
  applyStyle();
  map.easeTo({ pitch: state.terrain3d ? 60 : 0, duration: 800 });
  renderLayersPanel();
});

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
  else if (e.key === 'l' && !mod) openPanel('layers-panel');
  else if (e.key === 'Escape') { openPanel(null); if (planner.menu) planner.menu.remove(); }
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

// ------------------------------------------------------------------ boot
document.body.dataset.activity = state.activity;
renderActivityBar();
renderLayersPanel();
renderLegend();
$('#btn-3d').setAttribute('aria-pressed', String(state.terrain3d));
map.on('load', () => {
  // Start with the attribution collapsed to its (i) button on small screens.
  if (window.innerWidth < 720) $('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
  configureLayers();
  syncZoomHint();
  syncView3d();
  if (state.weather.wind || state.weather.temp || state.weather.rain) weather.set(state.weather);
  $('#btn-wind').setAttribute('aria-pressed', String(state.weather.wind));
  if (shared && shared.points.length) {
    planner.restore(shared);
    planner.setActive(true);
    const b = bbox(shared.points);
    if (b[0] !== b[2]) map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 90, bottom: 320, left: 60, right: 60 }, duration: 0 });
    history.replaceState(null, '', location.pathname + location.hash);
  } else if (planner.loadSaved()) {
    /* restored last session's route (planner stays closed until opened) */
  }
});
