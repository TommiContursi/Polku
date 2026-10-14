// Builds the complete MapLibre style from app state. The same function is used
// for every change (activity, base map, overlays) and applied with diff:true,
// so only the parts that actually changed are touched.

import {
  OFM_TILEJSON, OFM_SPRITE, OFM_GLYPHS, ESRI_IMAGERY, DEM_MAXZOOM, DEM_TILESIZE,
  DIFF_COLORS, RASTER_OVERLAYS, LIPAS_TYPES, mmlTiles, kapsiTiles, groupOf,
} from './config.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
const FONT = ['Noto Sans Regular'];
const FONT_B = ['Noto Sans Bold'];
const FONT_I = ['Noto Sans Italic'];

const zi = (...stops) => ['interpolate', ['linear'], ['zoom'], ...stops];
const ze = (base, ...stops) => ['interpolate', ['exponential', base], ['zoom'], ...stops];

const PALETTES = {
  trail: {
    bg: '#f5f3ee', wood: '#dbeacd', woodOpacity: 0.9, grass: '#e8f1d9', farmland: '#f7f0cf',
    wetland: '#d9ebe3', sand: '#f3e7bb', rock: '#e2dfd8', ice: '#f4fbff',
    residential: '#ece8e2', industrial: '#e8e2e8', cemetery: '#dde7d3', sport: '#dcefd3',
    park: '#3f8f3f', water: '#a8d1ef', waterLine: '#6fa9d6', waterText: '#24618f',
    building: '#d9d1c8', buildingLine: '#c4b9ad',
    motorway: '#f2a35e', trunk: '#f6c46b', primary: '#fbd77b', secondary: '#fde7a2', tertiary: '#fff3c9',
    road: '#ffffff', roadCase: '#b5ad9f', track: '#6b4f2a', path: '#1f1f1f', cycleway: '#5b7fa8',
    rail: '#7b7b7b', text: '#2c2721', halo: '#ffffff', contour: '#b38b5d', contourText: '#8a6640',
    boundary: '#8f72ad', hillshade: true,
  },
  plain: {
    bg: '#f7f7f5', wood: '#eef3ea', woodOpacity: 0.7, grass: '#f1f4ed', farmland: '#f7f6ef',
    wetland: '#eef4f2', sand: '#f4f1e6', rock: '#efeeec', ice: '#fafdff',
    residential: '#f0efed', industrial: '#efedf0', cemetery: '#eaefe6', sport: '#eaf1e6',
    park: '#7aa27a', water: '#c3dcef', waterLine: '#9bbfdc', waterText: '#4a7ca3',
    building: '#e6e3df', buildingLine: '#d6d1cb',
    motorway: '#e9c8a5', trunk: '#eed6ad', primary: '#f3e2b8', secondary: '#f6eccb', tertiary: '#faf5e4',
    road: '#ffffff', roadCase: '#cdc8c0', track: '#7f6a4c', path: '#3a3a3a', cycleway: '#7d96b3',
    rail: '#9a9a9a', text: '#45403a', halo: '#ffffff', contour: '#c9ad8c', contourText: '#9a8264',
    boundary: '#a895bd', hillshade: false,
  },
  night: {
    bg: '#161a1f', wood: '#1b2620', woodOpacity: 1, grass: '#1d241f', farmland: '#23231d',
    wetland: '#18232a', sand: '#2a271f', rock: '#22221f', ice: '#20262b',
    residential: '#1e2126', industrial: '#211f25', cemetery: '#1c231d', sport: '#1b241d',
    park: '#4e8f5b', water: '#10304a', waterLine: '#1f5a85', waterText: '#7fb6e3',
    building: '#272b31', buildingLine: '#30353c',
    motorway: '#8a5a2f', trunk: '#80633a', primary: '#6f6040', secondary: '#5b5443', tertiary: '#4a4740',
    road: '#3b3f46', roadCase: '#22252a', track: '#c9a874', path: '#e9e6df', cycleway: '#7ea4cf',
    rail: '#5d5d5d', text: '#d8dde3', halo: '#0f1215', contour: '#6a5845', contourText: '#a08a70',
    boundary: '#9b84c4', hillshade: true,
  },
};
// Aerial and MML bases reuse the trail palette but hide our own fills.
PALETTES.aerial = { ...PALETTES.trail, path: '#ffffff', track: '#ffe4b5', text: '#ffffff', halo: '#1a1a1a', hillshade: false };
PALETTES.ortofi = PALETTES.aerial;
PALETTES.mml = { ...PALETTES.trail, hillshade: false };
PALETTES.maasto = PALETTES.mml;
export const isAerial = (base) => base === 'aerial' || base === 'ortofi';
export const isTopo = (base) => base === 'mml' || base === 'maasto';

// mtb:scale → 0..6, or -1 when missing. (to-number("") is 0, hence the has-guard.)
const MTB_IDX = ['case', ['has', 'mtb_scale'], ['to-number', ['slice', ['to-string', ['get', 'mtb_scale']], 0, 1], -1], -1];
const diffColor = (idxExpr, none) => ['match', idxExpr, ...DIFF_COLORS.flatMap((c, i) => [i, c]), none];

const isPathClass = ['==', ['get', 'class'], 'path'];
// the trail colours' own opacities (Layers → Trails & difficulty), 0.1–1: 'down' difficulty, 'up' uphill
const trailColorOpacity = (s, which) => (s.overlayOpacity && s.overlayOpacity[`trail:${which}`] != null ? s.overlayOpacity[`trail:${which}`] : 1);
const k0 = (hc) => (hc ? 1.35 : 1);
const TRAIL_SUB = ['path', 'bridleway', 'steps', 'footway'];

export function buildStyle(s, ctx) {
  const P = PALETTES[s.base] || PALETTES.trail;
  const hc = !!s.highContrast;
  const act = s.activity;
  const vectorFills = s.base === 'trail' || s.base === 'plain' || s.base === 'night';
  const aerialBase = isAerial(s.base);
  const topoBase = isTopo(s.base);
  const sources = {
    ofm: { type: 'vector', url: OFM_TILEJSON },
    // the same tiles again (from the HTTP cache), for the trail lines alone: with trail details on,
    // their filter changes as detail tiles load, and MapLibre lays out a source's tiles again when
    // a filter changes; on their own source that's only the trails, not the whole map (it froze the page)
    ofmTrails: { type: 'vector', url: OFM_TILEJSON },
    dem: { type: 'raster-dem', tiles: [ctx.demTiles], tileSize: DEM_TILESIZE, maxzoom: DEM_MAXZOOM, encoding: 'terrarium', attribution: '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>' },
    terrain: { type: 'raster-dem', tiles: [ctx.demTiles], tileSize: DEM_TILESIZE, maxzoom: 13, encoding: 'terrarium' },
    contours: { type: 'vector', tiles: [ctx.contourTiles], maxzoom: 16 },
    route: { type: 'geojson', data: ctx.data.route || EMPTY },
    routeHover: { type: 'geojson', data: ctx.data.routeHover || EMPTY },
    routeColor: { type: 'geojson', data: ctx.data.routeColor || EMPTY },
    loops: { type: 'geojson', data: ctx.data.loops || EMPTY }, // round-trip candidates
    routeWind: { type: 'geojson', data: ctx.data.routeWind || EMPTY },
    uphill: { type: 'geojson', data: ctx.data.uphill || EMPTY },
    trailWays: { type: 'geojson', data: ctx.data.trailWays || EMPTY }, // trail details (js/trails.js)
    trailPoints: { type: 'geojson', data: ctx.data.trailPoints || EMPTY },
    lipasRoutes: { type: 'geojson', data: ctx.data.lipasRoutes || EMPTY, attribution: '© LIPAS' },
    lipasPoints: { type: 'geojson', data: ctx.data.lipasPoints || EMPTY },
    tracks: { type: 'geojson', data: ctx.data.tracks || EMPTY },
    lipasPick: { type: 'geojson', data: ctx.data.lipasPick || EMPTY }, // a route picked in search, while its card is open
    wxLabels: { type: 'geojson', data: ctx.data.wxLabels || EMPTY },
    sfAadt: { type: 'geojson', data: ctx.data.sfAadt || EMPTY, attribution: '© Fintraffic / Digiroad' },
    sfLines: { type: 'geojson', data: ctx.data.sfLines || EMPTY, attribution: '© Fintraffic / Digitraffic' },
    sfPoints: { type: 'geojson', data: ctx.data.sfPoints || EMPTY },
    sfShips: { type: 'geojson', data: ctx.data.sfShips || EMPTY },
    nogo: { type: 'geojson', data: ctx.data.nogo || EMPTY },
    sfShipTrails: { type: 'geojson', data: ctx.data.sfShipTrails || EMPTY },
    cameras: { type: 'geojson', data: ctx.data.cameras || EMPTY, attribution: '© Fintraffic' },
    nmMarks: { type: 'geojson', data: ctx.data.nmMarks || EMPTY, attribution: '© Väylävirasto' },
    nmLights: { type: 'geojson', data: ctx.data.nmLights || EMPTY },
    nmSectors: { type: 'geojson', data: ctx.data.nmSectors || EMPTY },
    nmLines: { type: 'geojson', data: ctx.data.nmLines || EMPTY },
    nmAreas: { type: 'geojson', data: ctx.data.nmAreas || EMPTY },
  };
  const layers = [];
  const add = (l) => layers.push(l);

  add({ id: 'background', type: 'background', paint: { 'background-color': P.bg } });

  // ---- Raster bases -------------------------------------------------------
  if (s.base === 'aerial') {
    sources.aerial = { type: 'raster', tiles: [ESRI_IMAGERY], tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' };
    add({ id: 'aerial', type: 'raster', source: 'aerial', paint: { 'raster-fade-duration': 150 } });
  }
  if (s.base === 'ortofi') {
    sources.ortofi = { type: 'raster', tiles: [kapsiTiles('ortokuva')], tileSize: 512, minzoom: 5, maxzoom: 19, attribution: 'Ortokuva © Maanmittauslaitos, Kapsi ry' };
    add({ id: 'ortofi', type: 'raster', source: 'ortofi', paint: { 'raster-fade-duration': 150 } });
  }
  if (s.base === 'maasto') {
    sources.maasto = { type: 'raster', tiles: [kapsiTiles('peruskartta')], tileSize: 512, minzoom: 5, maxzoom: 19, attribution: 'Maastokartta © Maanmittauslaitos, Kapsi ry' };
    add({ id: 'maasto-base', type: 'raster', source: 'maasto', paint: { 'raster-fade-duration': 150 } });
  }
  if (s.base === 'mml' && s.mmlKey) {
    sources.mmlBase = { type: 'raster', tiles: [mmlTiles('maastokartta', s.mmlKey)], tileSize: 256, maxzoom: 16, attribution: '© Maanmittauslaitos' };
    add({ id: 'mml-base', type: 'raster', source: 'mmlBase' });
  }

  // ---- Land ---------------------------------------------------------------
  if (vectorFills) {
    const lc = (id, cls, color, extra = {}) =>
      add({ id, type: 'fill', source: 'ofm', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', cls]], paint: { 'fill-color': color, 'fill-antialias': false, ...extra } });
    lc('lc-farmland', ['farmland'], P.farmland);
    lc('lc-grass', ['grass'], P.grass);
    lc('lc-wood', ['wood'], P.wood, { 'fill-opacity': P.woodOpacity });
    lc('lc-wetland', ['wetland'], P.wetland);
    add({ id: 'lc-wetland-pattern', type: 'fill', source: 'ofm', 'source-layer': 'landcover', minzoom: 12, filter: ['==', ['get', 'class'], 'wetland'], paint: { 'fill-pattern': 'wetland_bg_11', 'fill-opacity': s.base === 'night' ? 0.25 : 0.55 } });
    lc('lc-sand', ['sand'], P.sand);
    lc('lc-rock', ['rock'], P.rock);
    lc('lc-ice', ['ice'], P.ice);

    const lu = (id, cls, color, minzoom = 8) =>
      add({ id, type: 'fill', source: 'ofm', 'source-layer': 'landuse', minzoom, filter: ['in', ['get', 'class'], ['literal', cls]], paint: { 'fill-color': color } });
    lu('lu-residential', ['residential', 'suburb', 'neighbourhood'], P.residential, 9);
    lu('lu-industrial', ['industrial', 'commercial', 'retail', 'railway', 'garages', 'quarry'], P.industrial, 11);
    lu('lu-cemetery', ['cemetery'], P.cemetery, 12);
    lu('lu-sport', ['pitch', 'stadium', 'playground', 'track'], P.sport, 13);
  }

  // Protected areas (national parks, nature reserves)
  add({ id: 'park-fill', type: 'fill', source: 'ofm', 'source-layer': 'park', minzoom: 7, paint: { 'fill-color': P.park, 'fill-opacity': aerialBase || topoBase ? 0 : zi(7, 0.07, 12, 0.04) } });
  add({ id: 'park-line', type: 'line', source: 'ofm', 'source-layer': 'park', minzoom: 7, paint: { 'line-color': P.park, 'line-width': zi(7, 0.8, 14, 2.2), 'line-dasharray': [3, 2], 'line-opacity': 0.7 } });

  // Military areas (often with restricted access or live firing)
  if (s.overlays.restricted) {
    const mil = ['==', ['get', 'class'], 'military'];
    add({ id: 'military-fill', type: 'fill', source: 'ofm', 'source-layer': 'landuse', minzoom: 8, filter: mil, paint: { 'fill-color': '#dc2626', 'fill-opacity': zi(8, 0.12, 14, 0.08) } });
    add({ id: 'military-line', type: 'line', source: 'ofm', 'source-layer': 'landuse', minzoom: 8, filter: mil, paint: { 'line-color': '#b91c1c', 'line-width': zi(8, 1, 14, 2.5), 'line-dasharray': [4, 2] } });
  }

  if (s.hillshade && !aerialBase) {
    add({
      id: 'hillshade', type: 'hillshade', source: 'dem', minzoom: 4,
      paint: {
        'hillshade-method': 'multidirectional',
        'hillshade-illumination-direction': [270, 315, 0, 45],
        'hillshade-illumination-altitude': [30, 30, 30, 30],
        'hillshade-shadow-color': s.base === 'night'
          ? ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.5)']
          : ['rgba(70,50,35,0.32)', 'rgba(70,50,35,0.32)', 'rgba(70,50,35,0.22)', 'rgba(70,50,35,0.22)'],
        'hillshade-highlight-color': s.base === 'night'
          ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.03)']
          : ['rgba(255,255,240,0.35)', 'rgba(255,255,240,0.35)', 'rgba(255,255,240,0.2)', 'rgba(255,255,240,0.2)'],
        'hillshade-exaggeration': zi(5, 0.75, 11, 0.55, 15, 0.45),
      },
    });
  }

  // ---- Water --------------------------------------------------------------
  if (!aerialBase && !topoBase) {
    const waterColor = act === 'paddle' ? (s.base === 'night' ? '#0d3b5e' : '#93c6ec') : P.water;
    add({ id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water', filter: ['!=', ['get', 'class'], 'swimming_pool'], paint: { 'fill-color': waterColor, 'fill-antialias': true } });
    add({ id: 'water-shore', type: 'line', source: 'ofm', 'source-layer': 'water', minzoom: 11, filter: ['!=', ['get', 'class'], 'swimming_pool'], paint: { 'line-color': P.waterLine, 'line-width': zi(11, 0.3, 15, act === 'paddle' ? 1.4 : 0.8), 'line-opacity': 0.8 } });
    add({
      id: 'waterway', type: 'line', source: 'ofm', 'source-layer': 'waterway', minzoom: 8,
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      paint: {
        'line-color': P.waterLine,
        'line-width': zi(
          8, ['match', ['get', 'class'], ['river', 'canal'], 0.6, 0],
          11, ['match', ['get', 'class'], ['river', 'canal'], 1.2, 0.3],
          14, ['match', ['get', 'class'], ['river', 'canal'], 2.4, 1],
          18, ['match', ['get', 'class'], ['river', 'canal'], 6, 2.5],
        ),
        'line-dasharray': ['case', ['==', ['get', 'intermittent'], 1], ['literal', [3, 2]], ['literal', [1, 0]]],
      },
    });
  }

  // Depth & water overlays sit directly on the water.
  addRasterOverlays(s, sources, layers, 'water');

  // Nautical chart: fairway areas, speed / restriction areas, navigation lines
  if (s.overlays.nautical) {
    const kind = ['get', 'kind'];
    add({ id: 'nm-fairway', type: 'fill', source: 'nmAreas', minzoom: 10, filter: ['==', kind, 'fairway'], paint: { 'fill-color': '#a855f7', 'fill-opacity': zi(10, 0.05, 14, 0.09) } });
    add({ id: 'nm-restrict-fill', type: 'fill', source: 'nmAreas', minzoom: 11, filter: ['in', kind, ['literal', ['speed', 'restrict']]], paint: { 'fill-color': '#db2777', 'fill-opacity': 0.05 } });
    add({ id: 'nm-restrict-line', type: 'line', source: 'nmAreas', minzoom: 11, filter: ['in', kind, ['literal', ['speed', 'restrict']]], paint: { 'line-color': '#be185d', 'line-width': zi(11, 0.8, 15, 1.6), 'line-dasharray': [3, 2], 'line-opacity': 0.8 } });
    add({ id: 'nm-navline', type: 'line', source: 'nmLines', minzoom: 10.5, paint: { 'line-color': s.base === 'night' || isAerial(s.base) ? '#f5f5f5' : '#111827', 'line-width': zi(10.5, 0.7, 15, 1.4, 18, 2), 'line-dasharray': [4, 2.5], 'line-opacity': 0.85 } });
    add({ id: 'nm-sector', type: 'line', source: 'nmSectors', minzoom: 12.5, layout: { 'line-cap': 'butt' }, paint: { 'line-color': ['get', 'color'], 'line-width': zi(12.5, 2, 16, 5), 'line-opacity': 0.9 } });
  }

  // ---- Contours -----------------------------------------------------------
  // MML terrain maps already carry 5 m contours.
  if (s.contours && !topoBase) {
    const dark = aerialBase;
    const cColor = dark ? 'rgba(255,240,210,0.55)' : P.contour;
    add({ id: 'contour-minor', type: 'line', source: 'contours', 'source-layer': 'contours', minzoom: 11, filter: ['==', ['get', 'level'], 0], paint: { 'line-color': cColor, 'line-width': zi(11, 0.3, 15, 0.6, 18, 1), 'line-opacity': zi(11, 0.35, 14, 0.6) } });
    add({ id: 'contour-major', type: 'line', source: 'contours', 'source-layer': 'contours', minzoom: 9, filter: ['>', ['get', 'level'], 0], paint: { 'line-color': cColor, 'line-width': zi(9, 0.5, 15, 1.2, 18, 1.8), 'line-opacity': zi(9, 0.4, 13, 0.8) } });
  }

  // ---- Buildings ----------------------------------------------------------
  if (vectorFills) {
    add({ id: 'building', type: 'fill', source: 'ofm', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': P.building, 'fill-outline-color': P.buildingLine, 'fill-opacity': zi(13, 0.5, 15, 1) } });
    add({ id: 'aeroway', type: 'line', source: 'ofm', 'source-layer': 'aeroway', minzoom: 11, filter: ['in', ['get', 'class'], ['literal', ['runway', 'taxiway']]], paint: { 'line-color': '#c9c6c0', 'line-width': ze(1.5, 11, 1, 16, 30) } });
  }

  addRoads(s, P, hc, layers, ctx);

  // Busy roads: Digiroad average daily traffic as a heat line over the roads
  if (s.overlays.sfTraffic) {
    const aadt = ['get', 'aadt'];
    add({
      id: 'sf-aadt', type: 'line', source: 'sfAadt', minzoom: 10,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['step', aadt, '#facc15', 2000, '#fb923c', 5000, '#ef4444', 10000, '#991b1b'],
        'line-width': zi(10, 2, 13, ['step', aadt, 3, 5000, 5], 17, ['step', aadt, 8, 5000, 13]),
        'line-opacity': zi(10, 0.55, 14, 0.7),
        'line-blur': 0.6,
      },
    });
  }

  // Rail & ferries (topo rasters already draw these)
  if (!topoBase) add({ id: 'rail', type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 9, filter: ['all', ['in', ['get', 'class'], ['literal', ['rail', 'transit']]], ['!=', ['get', 'brunnel'], 'tunnel']], paint: { 'line-color': P.rail, 'line-width': zi(9, 0.6, 16, 2) } });
  if (!topoBase) add({ id: 'rail-hatch', type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 13, filter: ['all', ['==', ['get', 'class'], 'rail'], ['!=', ['get', 'brunnel'], 'tunnel']], paint: { 'line-color': P.rail, 'line-width': zi(13, 3, 18, 8), 'line-dasharray': [0.15, 2.5] } });
  if (!topoBase) add({ id: 'ferry', type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 8, filter: ['==', ['get', 'class'], 'ferry'], paint: { 'line-color': '#4a83b8', 'line-width': 1.2, 'line-dasharray': [2, 2] } });

  // Boundaries
  if (!topoBase) add({ id: 'boundary', type: 'line', source: 'ofm', 'source-layer': 'boundary', filter: ['all', ['<=', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]], paint: { 'line-color': P.boundary, 'line-width': zi(3, 0.8, 10, 2), 'line-dasharray': [3, 1.5, 1, 1.5] } });

  addRasterOverlays(s, sources, layers, 'overlay');

  // ---- Official routes (LIPAS) -----------------------------------------
  if (s.overlays.lipasRoutes) {
    const typeColor = ['match', ['get', 'type'], ...Object.entries(LIPAS_TYPES).filter(([k]) => +k > 4000).flatMap(([k, v]) => [+k, v.color]), '#555'];
    add({ id: 'lipas-route-casing', type: 'line', source: 'lipasRoutes', minzoom: 8, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-opacity': 0.75, 'line-width': zi(8, 2, 14, 6, 18, 10) } });
    add({
      id: 'lipas-route', type: 'line', source: 'lipasRoutes', minzoom: 8, layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': typeColor, 'line-width': zi(8, 1, 14, 3, 18, 5), 'line-opacity': 0.85,
        'line-dasharray': ['case', ['in', ['get', 'type'], ['literal', [4451, 4452]]], ['literal', [2, 1.2]], ['literal', [1, 0]]],
      },
    });
  }

  // ---- Uphill difficulty (computed overlay) -----------------------------
  // (in any sport: the trail colours are yours to turn on; the sport only sets the default)
  if (s.trailColors === 'up' || s.trailColors === 'both') {
    // 'up': uphill grade replaces the halo. 'both': the mtb:scale halo stays and
    // the uphill grade runs as a stripe alongside it.
    const both = s.trailColors === 'both';
    const tc = trailColorOpacity(s, 'up');
    add({
      id: 'uphill-line', type: 'line', source: 'uphill', minzoom: 12,
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: {
        'line-color': diffColor(['get', 'cls'], '#999'),
        // 'up': as wide as the difficulty band, so it reads the same way
        'line-width': both ? zi(12, 1.4, 14, 2.4 * k0(hc), 16, 3.6 * k0(hc), 18, 5.5) : zi(12, 2.2, 14, 4 * k0(hc), 16, 7 * k0(hc), 18, 12 * k0(hc)),
        'line-offset': both ? zi(12, 2.4, 14, 4.2 * k0(hc), 16, 7 * k0(hc), 18, 11) : 0,
        'line-opacity': ['*', ['case', ['get', 'osm'], 1, 0.9], tc],
      },
    });
    // 'up' colours the band like difficulty does, so the trails' centre lines go back on top
    // (dashed, thinner or dotted where trail details know the width and visibility)
    if (!both) for (const id of ['track-ground', 'path-ground', 'path-osm-ground']) {
      const l = layers.find((x) => x.id === id);
      if (l) add({ ...l, id: `${id}-over` });
    }
    add({
      id: 'uphill-arrow', type: 'symbol', source: 'uphill', minzoom: 14,
      filter: ['>=', ['get', 'grade'], 8],
      layout: { 'symbol-placement': 'line', 'symbol-spacing': zi(14, 45, 18, 90), 'icon-image': 'uphill-arrow', 'icon-size': zi(14, 0.55, 18, 1), 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'map' },
    });
  }

  // ---- Places / POIs ------------------------------------------------------
  if (s.overlays.pois) {
    // Things you plan an outing around show early; everyday services only up close.
    const outdoor = ['campsite', 'shelter', 'picnic_site', 'drinking_water', 'lodging', 'swimming', 'harbor', 'ranger_station'];
    const minor = ['toilets', 'information', 'attraction', 'bicycle_rental', 'parking', 'bicycle'];
    const poi = (id, minzoom, filter) => add({
      id, type: 'symbol', source: 'ofm', 'source-layer': 'poi', minzoom, filter,
      layout: {
        'icon-image': ['match', ['get', 'subclass'], 'viewpoint', 'attraction', ['firepit', 'bbq'], 'lipas-fire', ['coalesce', ['image', ['get', 'class']], ['image', 'circle_11']]],
        'icon-size': ['match', ['get', 'subclass'], ['firepit', 'bbq'], 0.6, hc ? 1.05 : 0.8],
        'text-field': ['step', ['zoom'], '', 15, ['get', 'name']],
        'text-font': FONT_I, 'text-size': 11, 'text-offset': [0, 1], 'text-anchor': 'top', 'text-optional': true, 'text-max-width': 8,
      },
      paint: { 'text-color': P.text, 'text-halo-color': P.halo, 'text-halo-width': 1.2, 'icon-opacity': s.base === 'night' ? 0.85 : 1 },
    });
    poi('poi-outdoor', 13, ['any', ['in', ['get', 'class'], ['literal', outdoor]], ['in', ['get', 'subclass'], ['literal', ['viewpoint', 'firepit', 'bbq']]]]);
    poi('poi-minor', 15.5, ['all', ['in', ['get', 'class'], ['literal', minor]], ['!', ['in', ['get', 'subclass'], ['literal', ['viewpoint', 'firepit', 'bbq']]]]]);
  }
  if (s.overlays.lipasPoints || s.overlays.restricted) {
    add({
      id: 'lipas-point', type: 'symbol', source: 'lipasPoints', minzoom: 10,
      layout: {
        'icon-image': ['concat', 'lipas-', ['get', 'icon']], 'icon-size': zi(10, 0.55, 14, 0.9), 'icon-allow-overlap': true,
        'text-field': ['step', ['zoom'], '', 13, ['get', 'name']], 'text-font': FONT, 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-optional': true, 'text-max-width': 8,
      },
      paint: { 'text-color': P.text, 'text-halo-color': P.halo, 'text-halo-width': 1.4 },
    });
  }

  // ---- Weather overlay (images rendered by wxmap.js, radar tiles) -------
  addWeather(s, ctx, sources, layers);

  // ---- Traffic & safety: incidents, road works, road conditions, ships --
  add({
    id: 'sf-lines', type: 'line', source: 'sfLines', minzoom: 6,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['match', ['get', 'kind'], 'incident', '#dc2626', 'roadwork', '#f59e0b', ['coalesce', ['get', 'color'], '#a855f7']],
      'line-width': zi(6, 2, 12, 4, 16, 8),
      'line-opacity': 0.85,
      'line-dasharray': ['match', ['get', 'kind'], 'roadwork', ['literal', [1.5, 1]], ['literal', [1, 0]]],
    },
  });
  add({ id: 'sf-points', type: 'symbol', source: 'sfPoints', minzoom: 6, layout: { 'icon-image': ['get', 'icon'], 'icon-size': zi(6, 0.6, 12, 0.85, 16, 1), 'icon-allow-overlap': true, 'symbol-sort-key': ['match', ['get', 'kind'], 'incident', 0, 'roadcond', 1, 2] } });
  add({ id: 'sf-ship-trail', type: 'line', source: 'sfShipTrails', minzoom: 7, filter: ['==', ['get', 'kind'], 'trail'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['get', 'selected'], 3, 1.6], 'line-opacity': ['case', ['get', 'selected'], 0.9, 0.5] } });
  add({ id: 'sf-ship-vector', type: 'line', source: 'sfShipTrails', minzoom: 9, filter: ['==', ['get', 'kind'], 'vector'], paint: { 'line-color': ['get', 'color'], 'line-width': 1.6, 'line-dasharray': [2, 1.5], 'line-opacity': 0.85 } });
  add({
    id: 'sf-ships', type: 'symbol', source: 'sfShips', minzoom: 7,
    layout: {
      'icon-image': 'ship', 'icon-rotate': ['get', 'rot'], 'icon-rotation-alignment': 'map', 'icon-size': zi(7, 0.5, 13, 0.9, 16, 1.2), 'icon-allow-overlap': true, 'icon-ignore-placement': true,
      'text-field': ['step', ['zoom'], '', 12.5, ['get', 'name']], 'text-font': FONT_B, 'text-size': 10.5, 'text-anchor': 'left', 'text-offset': [1, 0], 'text-optional': true,
    },
    paint: {
      'icon-color': ['get', 'color'], 'icon-opacity': ['case', ['get', 'moving'], 1, 0.6],
      'icon-halo-color': ['case', ['get', 'selected'], '#facc15', '#ffffff'], 'icon-halo-width': ['case', ['get', 'selected'], 3, 1.5],
      'text-color': '#0f172a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6,
    },
  });

  // ---- Difficulty numbers along trails (own toggles; JOSM MTB-Trailmap style)
  if (s.labelsDown) {
    add({
      id: 'mtb-label', type: 'symbol', source: 'ofm', 'source-layer': 'transportation', minzoom: 14.5,
      filter: ['all', ['has', 'mtb_scale'], ['in', ['get', 'class'], ['literal', ['path', 'track']]]],
      layout: {
        'symbol-placement': 'line', 'symbol-spacing': zi(14.5, 170, 18, 320),
        'text-field': ['concat', 'S', ['to-string', ['get', 'mtb_scale']]],
        'text-font': FONT_B, 'text-size': zi(14.5, 10, 18, 14), 'text-offset': [0, -1.1],
        'text-keep-upright': true, 'text-max-angle': 40, 'text-padding': 1,
      },
      paint: { 'text-color': diffColor(MTB_IDX, '#ffffff'), 'text-halo-color': '#111111', 'text-halo-width': 1.6 },
    });
  }
  if (s.labelsUp) {
    add({
      id: 'uphill-label', type: 'symbol', source: 'uphill', minzoom: 14.5,
      filter: ['>=', ['get', 'grade'], 6],
      layout: {
        'symbol-placement': 'line', 'symbol-spacing': zi(14.5, 170, 18, 320),
        'text-field': ['concat', '↑S', ['to-string', ['get', 'cls']]],
        'text-font': FONT_B, 'text-size': zi(14.5, 10, 18, 14), 'text-offset': [0, 1.1],
        'text-keep-upright': true, 'text-max-angle': 40, 'text-padding': 1,
      },
      paint: { 'text-color': diffColor(['get', 'cls'], '#ffffff'), 'text-halo-color': '#111111', 'text-halo-width': 1.6 },
    });
  }

  // ---- Nautical marks (IALA A), lights, signs; road cameras ------------
  if (s.overlays.nautical) {
    const kind = ['get', 'kind'];
    const ink = s.base === 'night' || isAerial(s.base) ? '#f5f5f5' : '#111827';
    const halo = s.base === 'night' || isAerial(s.base) ? '#0f172a' : '#ffffff';
    add({ id: 'nm-navline-label', type: 'symbol', source: 'nmLines', minzoom: 13, filter: ['!=', ['get', 'depth'], ''], layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'depth'], 'text-font': FONT_I, 'text-size': 11, 'text-keep-upright': true }, paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 1.6 } });
    add({ id: 'nm-area-label', type: 'symbol', source: 'nmAreas', minzoom: 12.5, filter: ['all', ['in', kind, ['literal', ['speed', 'restrict']]], ['!=', ['get', 'label'], '']], layout: { 'text-field': ['get', 'label'], 'text-font': FONT_B, 'text-size': 11, 'text-padding': 40 }, paint: { 'text-color': '#be185d', 'text-halo-color': halo, 'text-halo-width': 1.8 } });
    add({
      id: 'nm-marks', type: 'symbol', source: 'nmMarks', minzoom: 11,
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': zi(11, 0.5, 13, 0.72, 16, 1, 18, 1.25),
        'icon-anchor': ['match', ['get', 'icon'], ['nm-port', 'nm-starboard', 'nm-north', 'nm-south', 'nm-east', 'nm-west', 'nm-danger', 'nm-safe', 'nm-special', 'nm-leading'], 'bottom', ['nm-light', 'nm-lighthouse'], 'bottom-left', 'center'],
        'icon-allow-overlap': ['step', ['zoom'], false, 13.5, true],
        'symbol-sort-key': ['match', kind, 'fault', 0, 'mark', 1, 2],
        'text-field': ['case', ['==', kind, 'sign'], ['get', 'label'], ''],
        'text-font': FONT_B, 'text-size': 9, 'text-allow-overlap': true,
      },
      paint: { 'text-color': '#ffffff' },
    });
    add({ id: 'nm-lit', type: 'symbol', source: 'nmMarks', minzoom: 12, filter: ['all', ['==', kind, 'mark'], ['get', 'lit'], ['!', ['in', ['get', 'icon'], ['literal', ['nm-light', 'nm-lighthouse']]]]], layout: { 'icon-image': 'nm-flare', 'icon-size': zi(12, 0.5, 16, 0.9), 'icon-anchor': 'bottom-left', 'icon-offset': [3, -14], 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
    add({ id: 'nm-light-label', type: 'symbol', source: 'nmLights', minzoom: 14, filter: ['!=', ['get', 'char'], ''], layout: { 'text-field': ['get', 'char'], 'text-font': FONT_I, 'text-size': 10.5, 'text-anchor': 'left', 'text-offset': [1.2, -0.8], 'text-max-width': 12 }, paint: { 'text-color': '#a21caf', 'text-halo-color': halo, 'text-halo-width': 1.6 } });
    add({ id: 'nm-mark-label', type: 'symbol', source: 'nmMarks', minzoom: 15, filter: ['all', ['==', kind, 'mark'], ['!=', ['get', 'name'], '']], layout: { 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': 10, 'text-anchor': 'top', 'text-offset': [0, 0.4], 'text-max-width': 8, 'text-optional': true }, paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 1.4 } });
  }
  if (s.overlays.sfCameras) {
    add({ id: 'cameras', type: 'symbol', source: 'cameras', minzoom: 7, layout: { 'icon-image': 'camera', 'icon-size': zi(7, 0.5, 12, 0.8, 16, 1), 'icon-allow-overlap': ['step', ['zoom'], false, 11, true] } });
  }

  addLabels(s, P, hc, layers);

  // ---- Places to avoid (route planner no-go areas) ------------------------
  add({ id: 'nogo-fill', type: 'fill', source: 'nogo', paint: { 'fill-color': '#dc2626', 'fill-opacity': 0.14 } });
  add({ id: 'nogo-line', type: 'line', source: 'nogo', paint: { 'line-color': '#dc2626', 'line-width': 2, 'line-dasharray': [2, 1.5] } });

  // ---- A LIPAS route picked in search (drawn at any zoom, until its card closes)
  const pickColor = ['match', ['get', 'type'], ...Object.entries(LIPAS_TYPES).filter(([k]) => +k > 4000).flatMap(([k, v]) => [+k, v.color]), '#555'];
  add({ id: 'lipas-pick-casing', type: 'line', source: 'lipasPick', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': zi(6, 4, 14, 9, 18, 13), 'line-opacity': 0.9 } });
  add({ id: 'lipas-pick', type: 'line', source: 'lipasPick', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': pickColor, 'line-width': zi(6, 2, 14, 5, 18, 8) } });

  // ---- Imported tracks & the planned route (always on top) --------------
  add({ id: 'tracks-casing', type: 'line', source: 'tracks', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': zi(8, 4, 16, 9), 'line-opacity': 0.8 } });
  add({ id: 'tracks', type: 'line', source: 'tracks', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#7c3aed', 'line-width': zi(8, 2, 16, 5) } });

  add({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': zi(8, 5, 16, 11), 'line-opacity': 0.9 } });
  add({
    id: 'route-line', type: 'line', source: 'route', filter: ['!=', ['get', 'kind'], 'portage'],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['case', ['get', 'loading'], '#9ca3af', ['==', ['get', 'mode'], 'water'], '#0369a1', ['==', ['get', 'mode'], 'line'], '#be123c', '#e11d48'],
      'line-width': zi(8, 3, 16, 6.5),
      'line-dasharray': ['case', ['get', 'loading'], ['literal', [1, 1.5]], ['==', ['get', 'mode'], 'line'], ['literal', [2.5, 1.2]], ['literal', [1, 0]]],
    },
  });
  add({ id: 'route-color', type: 'line', source: 'routeColor', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': zi(8, 3, 16, 6.5) } });
  add({ id: 'route-portage', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'portage'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ea580c', 'line-width': zi(8, 3, 16, 6.5), 'line-dasharray': [0.1, 1.8] } });
  add({ id: 'route-arrows', type: 'symbol', source: 'route', minzoom: 12, filter: ['!', ['get', 'loading']], layout: { 'symbol-placement': 'line', 'symbol-spacing': 110, 'icon-image': 'route-arrow', 'icon-size': 0.7, 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'map' } });
  add({
    id: 'route-wind', type: 'symbol', source: 'routeWind',
    layout: { 'icon-image': 'wind-arrow', 'icon-rotate': ['get', 'rot'], 'icon-rotation-alignment': 'map', 'icon-size': ['get', 'size'], 'icon-allow-overlap': true, 'icon-ignore-placement': true },
    paint: { 'icon-color': ['get', 'color'], 'icon-halo-color': '#111827', 'icon-halo-width': 1.5 },
  });
  // round-trip candidates (planner): the one you're looking at wider and on top
  add({ id: 'loops-casing', type: 'line', source: 'loops', layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['case', ['get', 'on'], 1, 0] }, paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, ['case', ['get', 'on'], 6, 4], 16, ['case', ['get', 'on'], 12, 8]], 'line-opacity': 0.9 } });
  add({ id: 'loops-line', type: 'line', source: 'loops', layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['case', ['get', 'on'], 1, 0] }, paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 8, ['case', ['get', 'on'], 3.5, 2], 16, ['case', ['get', 'on'], 7, 4]], 'line-opacity': ['case', ['get', 'on'], 1, 0.7] } });
  add({ id: 'route-hover', type: 'circle', source: 'routeHover', paint: { 'circle-radius': 7, 'circle-color': '#111827', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } });

  const style = {
    version: 8,
    name: 'Polku',
    sprite: OFM_SPRITE,
    glyphs: OFM_GLYPHS,
    sources,
    layers,
  };
  if (s.terrain3d) {
    style.terrain = { source: 'terrain', exaggeration: s.exaggeration || 1.4 };
    style.sky = { 'sky-color': '#bcd8f0', 'horizon-color': '#eef4f8', 'fog-color': '#eef2f3', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.85 };
  }
  return style;
}

function addWeather(s, ctx, sources, layers) {
  const wx = s.weather || {};
  const d = ctx.data;
  const op = (k, dflt) => (s.overlayOpacity && s.overlayOpacity[k] != null ? s.overlayOpacity[k] : dflt); // yours, or the default
  if ((wx.temp || wx.wind) && d.wxField) {
    sources.wxField = { type: 'image', url: d.wxField.url, coordinates: d.wxField.coordinates };
    layers.push({ id: 'wx-field', type: 'raster', source: 'wxField', paint: { 'raster-opacity': wx.temp ? op('wx:temp', 0.5) : 0.38, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } });
  }
  if (wx.rain && d.wxRain) {
    sources.wxRain = { type: 'image', url: d.wxRain.url, coordinates: d.wxRain.coordinates };
    layers.push({ id: 'wx-rain', type: 'raster', source: 'wxRain', paint: { 'raster-opacity': op('wx:rain', 0.85), 'raster-resampling': 'linear', 'raster-fade-duration': 0 } });
  }
  if (wx.rain && d.wxRadar) {
    if (d.wxRadar.rv) {
      sources.wxRadarRv = { type: 'raster', tiles: [d.wxRadar.rv], tileSize: 512, maxzoom: 7, attribution: 'Radar © RainViewer' };
      layers.push({ id: 'wx-radar-rv', type: 'raster', source: 'wxRadarRv', paint: { 'raster-opacity': op('wx:rain', 0.7), 'raster-fade-duration': 0 } });
    }
  }
  // Finland: FMI's composite, fetched as data and drawn by js/radar.js
  if (wx.rain && d.wxRadarFi) {
    sources.wxRadarFi = { type: 'image', url: d.wxRadarFi.url, coordinates: d.wxRadarFi.coordinates };
    layers.push({ id: 'wx-radar-fi', type: 'raster', source: 'wxRadarFi', paint: { 'raster-opacity': op('wx:rain', 0.85), 'raster-resampling': 'linear', 'raster-fade-duration': 0 } });
  }
}

function addRasterOverlays(s, sources, layers, slot) {
  for (const [id, o] of Object.entries(RASTER_OVERLAYS)) {
    if (o.slot !== slot || !s.overlays[id]) continue;
    let tiles = o.tiles;
    if (o.mml) {
      if (!s.mmlKey) continue;
      tiles = [mmlTiles(o.mml, s.mmlKey)];
    }
    sources[`ov-${id}`] = { type: 'raster', tiles, tileSize: o.tileSize, minzoom: o.minzoom || 0, maxzoom: o.maxzoom || 18, attribution: o.attribution };
    const op = s.overlayOpacity && s.overlayOpacity[id] != null ? s.overlayOpacity[id] : o.opacity; // yours, or the layer's own
    layers.push({ id: `ov-${id}`, type: 'raster', source: `ov-${id}`, minzoom: o.minzoom || 0, paint: { 'raster-opacity': op, 'raster-fade-duration': 150 } });
  }
}

// ---------------------------------------------------------------------------
// Roads and trails

function addRoads(s, P, hc, layers, ctx) {
  const add = (l) => layers.push(l);
  const act = s.activity;
  const aerial = isAerial(s.base);
  const mmlBase = isTopo(s.base);
  const darkBase = aerial || s.base === 'night';
  const plainHalo = darkBase ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.85)';
  const roadsDim = act === 'paddle' ? 0.55 : 1;
  const k = hc ? 1.35 : 1;

  const roadStops = {
    motorway: [6, 0.8, 12, 3, 18, 22],
    trunk: [6, 0.6, 12, 2.6, 18, 20],
    primary: [7, 0.5, 12, 2.2, 18, 18],
    secondary: [8, 0.4, 12, 1.8, 18, 16],
    tertiary: [9, 0.4, 12, 1.4, 18, 14],
    minor: [11, 0.3, 14, 1.8, 18, 11],
    service: [13, 0.3, 15, 1.4, 18, 7],
  };
  // Zoom expressions can't be wrapped in arithmetic, so scale each stop instead.
  const roadW = (cls, f = 1) =>
    ze(1.4, ...roadStops[cls].map((v, i) => (i % 2 === 0 ? v : typeof f === 'number' ? v * f : ['*', v, f])));
  const roadColor = {
    motorway: P.motorway, trunk: P.trunk, primary: P.primary, secondary: P.secondary,
    tertiary: P.tertiary, minor: P.road, service: P.road,
  };
  const roadMin = { motorway: 5, trunk: 5, primary: 7, secondary: 8, tertiary: 9, minor: 11, service: 13 };

  // Gravel: unpaved roads get a warm gravel casing so the network pops out
  // (road cycling marks them the same way — there, so you can avoid them).
  const group = groupOf(act);
  const bikeAct = group === 'bike', footAct = group === 'foot';
  // the difficulty halo: on whenever you've chosen Difficulty or Both, in any sport
  const diffOn = s.trailColors === 'down' || s.trailColors === 'both';
  // trail details: inside the loaded tiles, trails are drawn from OSM (js/trails.js)
  const covered = !!(s.trailDetails && ctx.trailCoverage);
  const gravel = act === 'gravel' || act === 'road';
  const roadBike = act === 'road';
  const unpaved = ['==', ['get', 'surface'], 'unpaved'];

  for (const brunnel of ['tunnel', 'ground', 'bridge']) {
    const bf = brunnel === 'ground'
      ? ['!', ['in', ['get', 'brunnel'], ['literal', ['tunnel', 'bridge']]]]
      : ['==', ['get', 'brunnel'], brunnel];
    const op = (brunnel === 'tunnel' ? 0.5 : 1) * roadsDim;

    // casings
    for (const cls of ['service', 'minor', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway']) {
      if (aerial && (cls === 'service')) continue;
      const casingColor = gravel ? ['case', unpaved, '#c4842d', P.roadCase] : P.roadCase;
      add({
        id: `road-${brunnel}-${cls}-casing`, type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: roadMin[cls],
        filter: ['all', ['==', ['get', 'class'], cls], bf],
        layout: { 'line-join': 'round', 'line-cap': brunnel === 'ground' ? 'round' : 'butt' },
        paint: {
          'line-color': aerial ? 'rgba(0,0,0,0.5)' : casingColor,
          'line-width': gravel && cls !== 'motorway' && cls !== 'trunk'
            ? roadW(cls, ['case', unpaved, 2.5, 1.35])
            : roadW(cls, 1.35),
          'line-opacity': zi(roadMin[cls], 0, roadMin[cls] + 0.5, mmlBase ? 0 : op),
          ...(brunnel === 'tunnel' ? { 'line-dasharray': [0.6, 0.4] } : {}),
        },
      });
    }
    // fills
    for (const cls of ['service', 'minor', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway']) {
      if (aerial && cls === 'service') continue;
      let color = roadColor[cls];
      if (gravel && !['motorway', 'trunk'].includes(cls)) color = ['case', unpaved, '#fbd9a0', color];
      add({
        id: `road-${brunnel}-${cls}`, type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: roadMin[cls],
        filter: ['all', ['==', ['get', 'class'], cls], bf],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': aerial ? 'rgba(255,255,255,0.55)' : color,
          'line-width': roadW(cls),
          'line-opacity': (mmlBase ? 0 : 1) * op,
        },
      });
    }

    // Tracks (forest roads, metsäautotie-ish): long dashes like the Finnish terrain map.
    add({
      id: `track-${brunnel}-halo`, type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 11,
      filter: ['all', ['==', ['get', 'class'], 'track'], bf],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': diffOn
          ? diffColor(MTB_IDX, plainHalo)
          : gravel ? (darkBase ? '#8a5a22' : '#e9b56c') : plainHalo,
        'line-width': zi(11, 2, 14, 4 * k, 16, 7 * k, 18, 12 * k),
        'line-opacity': (diffOn ? 0.9 * trailColorOpacity(s, 'down') : gravel ? 0.9 : 0.7) * roadsDim,
      },
    });
    add({
      id: `track-${brunnel}`, type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 10,
      filter: ['all', ['==', ['get', 'class'], 'track'], bf],
      paint: {
        'line-color': P.track,
        'line-width': zi(10, 0.6, 14, 1.4 * k, 16, 2.6 * k, 18, 4.5 * k),
        'line-dasharray': [5, 1.4],
        'line-opacity': zi(10, 0, 10.5, 0.8 * roadsDim, 14, roadsDim),
      },
    });

    // Paths: a difficulty-coloured halo (MTB) under a black dashed centre line.
    // With trail details on, the trails inside the loaded detail tiles are
    // drawn from OSM instead (below), so they're hidden from the tiles there.
    const trailSet = ['any', ['in', ['coalesce', ['get', 'subclass'], 'path'], ['literal', ['path', 'bridleway', 'steps']]], ['all', ['==', ['get', 'subclass'], 'footway'], ['has', 'mtb_scale']]];
    const trailFilter = ['all', isPathClass, ['in', ['coalesce', ['get', 'subclass'], 'path'], ['literal', TRAIL_SUB]], bf,
      ...(covered ? [['!', ['all', trailSet, ['within', ctx.trailCoverage]]]] : [])];
    const noBike = ['==', ['get', 'bicycle'], 'no'];
    const noFoot = ['==', ['get', 'foot'], 'no'];
    const sidewalkish = ['all', ['==', ['get', 'subclass'], 'footway'], ['!', ['has', 'mtb_scale']]];
    const haloOf = (idx) => (diffOn ? diffColor(idx, plainHalo) : footAct ? (darkBase ? 'rgba(255,170,110,0.32)' : 'rgba(255,214,170,0.95)') : plainHalo);
    const haloOpacity0 = [
      'case',
      bikeAct ? noBike : noFoot, 0.25,
      act === 'mtb' ? sidewalkish : ['literal', false], 0.35,
      act === 'paddle' || roadBike ? 0.5 : 0.95,
    ];
    // difficulty colours fade with their slider; the plain halo doesn't
    const haloOpacity = diffOn && trailColorOpacity(s, 'down') !== 1 ? ['*', haloOpacity0, trailColorOpacity(s, 'down')] : haloOpacity0;
    // widths per zoom, times a per-trail factor (1 for the tiles; the trail's width class for OSM)
    const times = (v, f) => (f === 1 ? v : ['*', v, f]);
    const haloW = (f) => zi(12, times(2.2, f), 14, times(4 * k, f), 16, times(7 * k, f), 18, times(12 * k, f));
    const centreW = (f) => zi(12, times(0.6 * k, f), 14, times(1.15 * k, f), 16, times(1.8 * k, f), 18, times(3 * k, f));
    const centreColor = footAct && !aerial ? '#b42318' : P.path;
    const centreOpacity = [
      'case',
      act === 'mtb' ? sidewalkish : ['literal', false], 0.5,
      act === 'paddle' || roadBike ? 0.6 : 1,
    ];
    add({
      id: `path-${brunnel}-halo`, type: 'line', source: 'ofmTrails', 'source-layer': 'transportation', minzoom: 12,
      filter: trailFilter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': haloOf(MTB_IDX), 'line-width': haloW(1), 'line-opacity': haloOpacity },
    });
    // Explicit no-bike marker: small red ticks beside the line.
    const noBikeTicks = (id, source, filter) => add({
      id, type: 'line', source, ...(source === 'ofmTrails' ? { 'source-layer': 'transportation' } : {}), minzoom: 14, filter,
      paint: { 'line-color': '#dc2626', 'line-width': zi(14, 2, 18, 4), 'line-offset': zi(14, 3, 18, 8), 'line-dasharray': [0.4, 1.6] },
    });
    if (bikeAct) noBikeTicks(`path-${brunnel}-nobike`, 'ofmTrails', ['all', trailFilter, noBike]);
    add({
      id: `path-${brunnel}`, type: 'line', source: 'ofmTrails', 'source-layer': 'transportation', minzoom: 12,
      filter: trailFilter,
      paint: {
        'line-color': centreColor,
        'line-width': centreW(1),
        'line-dasharray': ['match', ['get', 'subclass'], 'steps', ['literal', [0.4, 0.4]], ['literal', [2.4, 1.3]]],
        'line-opacity': centreOpacity,
      },
    });
    // The same trails from OSM, in the Trailmap / JOSM language: the band is as
    // wide as the trail, faint trails get a dotted centre line, and the barely
    // visible ones only their colour.
    if (s.trailDetails) {
      const vis = ['get', 'vis'];
      const osmFilter = ['all', ['==', ['get', 'trail'], true], bf];
      add({
        id: `path-osm-${brunnel}-halo`, type: 'line', source: 'trailWays', minzoom: 12,
        filter: osmFilter,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': haloOf(['get', 'mtb']),
          'line-width': haloW(['get', 'wf']),
          'line-opacity': ['*', haloOpacity, ['match', vis, 1, 0.9, 2, 0.75, 3, 0.55, 1]],
        },
      });
      if (bikeAct) noBikeTicks(`path-osm-${brunnel}-nobike`, 'trailWays', ['all', osmFilter, noBike]);
      add({
        id: `path-osm-${brunnel}`, type: 'line', source: 'trailWays', minzoom: 12,
        filter: osmFilter,
        paint: {
          'line-color': centreColor,
          'line-width': centreW(['get', 'cf']),
          'line-dasharray': ['case', ['==', ['get', 'subclass'], 'steps'], ['literal', [0.4, 0.4]], ['>=', vis, 1], ['literal', [0.6, 1.6]], ['literal', [2.4, 1.3]]],
          'line-opacity': ['case', ['>=', vis, 3], 0, centreOpacity],
        },
      });
    }
    // Cycleways (kevyen liikenteen väylä): thin solid line.
    add({
      id: `cycleway-${brunnel}`, type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 12,
      filter: ['all', isPathClass, ['in', ['get', 'subclass'], ['literal', ['cycleway', 'pedestrian']]], bf],
      paint: {
        'line-color': aerial ? '#bfe0ff' : P.cycleway,
        // road cycling: cycleways are where you ride, so they stand out
        'line-width': zi(12, 0.6, 15, 1.6 * k * (roadBike ? 1.5 : 1), 18, 3.5 * k * (roadBike ? 1.4 : 1)),
        'line-opacity': 0.85 * roadsDim,
      },
    });
  }

  // Trail details beside and on the line: overgrown (green dots) on one side,
  // wet or muddy (blue dots) on the other; fallen trees, gates, stiles, cycle
  // barriers and fords as icons from zoom 15.
  if (s.trailDetails) {
    // fences, walls and hedges (the vector tiles have none): where you can't go through
    add({
      id: 'td-fence', type: 'line', source: 'trailWays', minzoom: 15, filter: ['has', 'fence'],
      paint: {
        'line-color': ['match', ['get', 'fence'], 'hedge', darkBase ? '#6fbf6f' : '#4d8a3a', 'wall', darkBase ? '#9ca3af' : '#6b7280', darkBase ? '#c08a6a' : '#8b4a2b'],
        'line-width': zi(15, 1, 18, 2.4),
        'line-dasharray': ['match', ['get', 'fence'], 'fence', ['literal', [2.4, 1.2]], ['literal', [1, 0]]],
      },
    });
    const wf = ['get', 'wf'];
    // round dots right at the edge of the band (Trailmap draws these boldly too)
    const side = (sign) => zi(14, ['*', sign * 3, wf], 16, ['*', sign * 5, wf], 18, ['*', sign * 8.2, wf]);
    const dots = { 'line-width': zi(14, 2.6, 16, 3.6, 18, 5.2), 'line-dasharray': [0.01, 1.7] };
    add({
      id: 'td-veg', type: 'line', source: 'trailWays', minzoom: 14, filter: ['==', ['get', 'veg'], true], layout: { 'line-cap': 'round' },
      paint: { 'line-color': darkBase ? '#5ee07a' : '#15a34a', 'line-offset': side(1), ...dots },
    });
    add({
      id: 'td-wet', type: 'line', source: 'trailWays', minzoom: 14, filter: ['==', ['get', 'mud'], true], layout: { 'line-cap': 'round' },
      paint: { 'line-color': darkBase ? '#7cb4ff' : '#1d5fe0', 'line-offset': side(-1), ...dots },
    });
    const icon = { 'icon-size': zi(15, 0.72, 18, 1), 'icon-allow-overlap': true, 'icon-rotation-alignment': 'viewport', 'icon-pitch-alignment': 'viewport' };
    add({
      id: 'td-way-tree', type: 'symbol', source: 'trailWays', minzoom: 15, filter: ['==', ['get', 'tree'], true],
      layout: { 'symbol-placement': 'line', 'symbol-spacing': zi(15, 70, 18, 140), 'icon-image': 'td-tree', ...icon },
    });
    add({
      id: 'td-way-ford', type: 'symbol', source: 'trailWays', minzoom: 15, filter: ['==', ['get', 'wayford'], true],
      layout: { 'symbol-placement': 'line-center', 'icon-image': 'td-ford', ...icon },
    });
    add({ id: 'td-points', type: 'symbol', source: 'trailPoints', minzoom: 15, layout: { 'icon-image': ['concat', 'td-', ['get', 'kind']], ...icon } });
  }
}

// ---------------------------------------------------------------------------
// Labels

function addLabels(s, P, hc, layers) {
  const topo = isTopo(s.base);
  // On the MML rasters only our own overlays get labels; the map has the rest.
  const add = (l) => { if (!topo || /^(contour|lipas)/.test(l.id)) layers.push(l); };
  const halo = { 'text-halo-color': P.halo, 'text-halo-width': hc ? 2 : 1.4, 'text-halo-blur': 0.3 };

  add({ id: 'label-waterway', type: 'symbol', source: 'ofm', 'source-layer': 'waterway', minzoom: 12, filter: ['has', 'name'], layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': FONT_I, 'text-size': 11, 'text-letter-spacing': 0.1 }, paint: { 'text-color': P.waterText, ...halo } });
  add({ id: 'label-water', type: 'symbol', source: 'ofm', 'source-layer': 'water_name', minzoom: 6, filter: ['all', ['has', 'name'], ['==', ['geometry-type'], 'Point']], layout: { 'text-field': ['get', 'name'], 'text-font': FONT_I, 'text-size': zi(6, 10, 12, 13, 15, 15), 'text-max-width': 6, 'text-letter-spacing': 0.08 }, paint: { 'text-color': P.waterText, ...halo } });
  add({ id: 'label-water-line', type: 'symbol', source: 'ofm', 'source-layer': 'water_name', minzoom: 6, filter: ['all', ['has', 'name'], ['==', ['geometry-type'], 'LineString']], layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': FONT_I, 'text-size': zi(6, 10, 12, 13, 15, 15), 'text-letter-spacing': 0.15 }, paint: { 'text-color': P.waterText, ...halo } });
  add({ id: 'label-park', type: 'symbol', source: 'ofm', 'source-layer': 'park', minzoom: 9, filter: ['all', ['has', 'name'], ['==', ['geometry-type'], 'Point']], layout: { 'text-field': ['get', 'name'], 'text-font': FONT_I, 'text-size': 12, 'text-max-width': 8 }, paint: { 'text-color': '#2f6b2f', ...halo } });
  add({ id: 'label-road', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name', minzoom: 13, filter: ['has', 'name'], layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': zi(13, 10, 17, 13), 'text-rotation-alignment': 'map' }, paint: { 'text-color': P.text, ...halo } });
  add({
    id: 'label-peak', type: 'symbol', source: 'ofm', 'source-layer': 'mountain_peak', minzoom: 11,
    filter: ['==', ['get', 'class'], 'peak'],
    layout: {
      'icon-image': 'triangle_11', 'icon-size': 0.75,
      'text-field': ['case', ['has', 'name'], ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'ele']], ' m'], ['concat', ['to-string', ['get', 'ele']], ' m']],
      'text-font': FONT, 'text-size': 11, 'text-offset': [0, 0.8], 'text-anchor': 'top', 'text-optional': true,
    },
    paint: { 'text-color': '#6b4b2b', ...halo },
  });
  if (s.contours && !isTopo(s.base)) {
    add({ id: 'contour-label', type: 'symbol', source: 'contours', 'source-layer': 'contours', minzoom: 13, filter: ['>', ['get', 'level'], 0], layout: { 'symbol-placement': 'line', 'text-field': ['to-string', ['get', 'ele']], 'text-font': FONT, 'text-size': 10, 'symbol-spacing': 350 }, paint: { 'text-color': isAerial(s.base) ? '#ffeccc' : P.contourText, ...halo } });
  }
  if (s.overlays.lipasRoutes) {
    add({ id: 'lipas-route-label', type: 'symbol', source: 'lipasRoutes', minzoom: 13, layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': FONT_B, 'text-size': 11, 'symbol-spacing': 400 }, paint: { 'text-color': ['match', ['get', 'type'], ...Object.entries(LIPAS_TYPES).filter(([k]) => +k > 4000).flatMap(([k, v]) => [+k, v.color]), '#444'], ...halo } });
  }
  const place = (id, classes, minzoom, size, font = FONT) =>
    add({ id, type: 'symbol', source: 'ofm', 'source-layer': 'place', minzoom, filter: ['in', ['get', 'class'], ['literal', classes]], layout: { 'text-field': ['get', 'name'], 'text-font': font, 'text-size': size, 'text-max-width': 8 }, paint: { 'text-color': P.text, ...halo } });
  place('label-place-minor', ['hamlet', 'isolated_dwelling', 'locality', 'neighbourhood'], 13, 11);
  place('label-island', ['island', 'islet'], 11, 11, FONT_I);
  place('label-suburb', ['suburb', 'quarter'], 11, zi(11, 11, 15, 14));
  place('label-village', ['village'], 9, zi(9, 11, 14, 15));
  place('label-town', ['town'], 7, zi(7, 11, 13, 17), FONT_B);
  place('label-city', ['city'], 4, zi(4, 11, 12, 20), FONT_B);
  if (s.weather && s.weather.temp) {
    layers.push({ id: 'wx-temp-label', type: 'symbol', source: 'wxLabels', filter: ['==', ['get', 'kind'], 'temp'], layout: { 'text-field': ['get', 't'], 'text-font': FONT_B, 'text-size': 13, 'text-padding': 30 }, paint: { 'text-color': '#111827', 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 2 } });
  }
  if (s.weather && s.weather.rain) {
    // precipitation amount where it rains, nudged below the °C label
    layers.push({ id: 'wx-rain-label', type: 'symbol', source: 'wxLabels', filter: ['==', ['get', 'kind'], 'rain'], layout: { 'text-field': ['get', 't'], 'text-font': FONT_B, 'text-size': 12, 'text-offset': [0, 1.3], 'text-padding': 20 }, paint: { 'text-color': '#1d4ed8', 'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 2 } });
  }
}
