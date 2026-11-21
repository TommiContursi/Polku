// Builds the complete MapLibre style from app state. The same function is used
// for every change (activity, base map, overlays) and applied with diff:true,
// so only the parts that actually changed are touched.

import {
  OFM_TILEJSON, OFM_SPRITE, OFM_GLYPHS, ESRI_IMAGERY, DEM_MAXZOOM, DEM_TILESIZE,
  DIFF_COLORS, MTB_COLORS, MTB_GRADES, ROUTE_COLORS, RASTER_OVERLAYS, RASTER_RATIO, LIPAS_TYPES, mmlTiles, mmlApiKey, MML_PROPERTY_TILES, MML_TERRAIN_TILES, FINLAND_BOUNDS, kapsiTiles, groupOf,
  isWater, isLipasRoute, WARN_COLORS,
} from './config.js';
import { warnMarkId } from './icons.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
const FONT = ['Noto Sans Regular'];
const FONT_B = ['Noto Sans Bold'];
const FONT_I = ['Noto Sans Italic'];

const zi = (...stops) => ['interpolate', ['linear'], ['zoom'], ...stops];
const ze = (base, ...stops) => ['interpolate', ['exponential', base], ['zoom'], ...stops];

// The sky in 3D (#644), [top, horizon]: from the sun's height and, only where a forecast is loaded, its weather.
// With no forecast, day is the pale sky that claims no weather; the night map's sky is dark at any hour.
const SKIES = {
  night: ['#0b1426', '#24344c'],
  dusk: ['#2c3e66', '#f2a35e'], // the sun within 6° of the horizon
  duskGrey: ['#4b5566', '#b9a698'], // the same under cloud, rain or snow
  day: ['#bcd8f0', '#eef4f8'],
  sun: ['#5f9cdb', '#dcebf5'],
  cloud: ['#a3aeb8', '#dde2e6'],
  rain: ['#8d969e', '#c4cacf'],
  snow: ['#c3cad1', '#edf0f3'],
};
const skyOf = ({ alt, wx }, nightMap) => {
  if (nightMap || alt < -6) return 'night';
  const grey = wx === 'cloud' || wx === 'rain' || wx === 'snow';
  if (alt < 6) return grey ? 'duskGrey' : 'dusk';
  return !wx ? 'day' : grey ? wx : 'sun';
};

// a building's height in metres: one place, for when a better source than OSM's comes (#648)
const BUILDING_HEIGHT = ['get', 'render_height'];

const PALETTES = {
  trail: {
    bg: '#f5f3ee', wood: '#dbeacd', woodOpacity: 0.9, grass: '#e8f1d9', farmland: '#f7f0cf',
    wetland: '#dce5e3', wetlandDash: '#8fb0d3', bogWood: '#deebd0', reed: '#5f8a5a', heath: '#ebe6c4', openForest: '#c6dcb2', treeMark: '#6b8a5c', sand: '#f3e7bb', rock: '#e2dfd8', cliff: '#5e574e', ice: '#f4fbff',
    residential: '#ece8e2', industrial: '#e8e2e8', cemetery: '#dde7d3', sport: '#dcefd3', cityPark: '#d3ebbf', parking: '#dcdcd8', parkingLine: '#9a9488', bridge: '#2c2721', oneway: '#6b6458', onewayBike: '#1f2fa0',
    park: '#3f8f3f', water: '#a8d1ef', waterLine: '#6fa9d6', waterText: '#24618f', shoal: '#ffffff',
    building: '#d9d1c8', buildingLine: '#c4b9ad',
    motorway: '#f2a35e', trunk: '#f6c46b', primary: '#fbd77b', secondary: '#fde7a2', tertiary: '#fff3c9',
    road: '#ffffff', roadCase: '#b5ad9f', track: '#6b4f2a', path: '#1f1f1f', cycleway: '#5b7fa8',
    rail: '#7b7b7b', power: '#8a8a8a', text: '#2c2721', halo: '#ffffff', contour: '#b38b5d', contourText: '#8a6640',
    boundary: '#8f72ad', hillshade: true,
  },
  plain: {
    bg: '#f7f7f5', wood: '#eef3ea', woodOpacity: 0.7, grass: '#f1f4ed', farmland: '#f7f6ef',
    wetland: '#eef4f2', wetlandDash: '#b4c9de', bogWood: '#f1f4ed', reed: '#9bb796', heath: '#f2efdf', openForest: '#dde8d4', treeMark: '#9bb796', sand: '#f4f1e6', rock: '#efeeec', cliff: '#948d83', ice: '#fafdff',
    residential: '#f0efed', industrial: '#efedf0', cemetery: '#eaefe6', sport: '#eaf1e6', cityPark: '#e4f0d8', parking: '#ebeae7', parkingLine: '#c4c0b8', bridge: '#5a554e', oneway: '#8a847a', onewayBike: '#4a6890',
    park: '#7aa27a', water: '#c3dcef', waterLine: '#9bbfdc', waterText: '#4a7ca3', shoal: '#ffffff',
    building: '#e6e3df', buildingLine: '#d6d1cb',
    motorway: '#e9c8a5', trunk: '#eed6ad', primary: '#f3e2b8', secondary: '#f6eccb', tertiary: '#faf5e4',
    road: '#ffffff', roadCase: '#cdc8c0', track: '#7f6a4c', path: '#3a3a3a', cycleway: '#7d96b3',
    rail: '#9a9a9a', power: '#acacac', text: '#45403a', halo: '#ffffff', contour: '#c9ad8c', contourText: '#9a8264',
    boundary: '#a895bd', hillshade: false,
  },
  night: {
    bg: '#161a1f', wood: '#1b2620', woodOpacity: 1, grass: '#1d241f', farmland: '#23231d',
    wetland: '#18232a', wetlandDash: '#2f5679', bogWood: '#1b2620', reed: '#4f7a55', heath: '#26261c', openForest: '#26362a', treeMark: '#567a5c', sand: '#2a271f', rock: '#22221f', cliff: '#a39a8c', ice: '#20262b',
    residential: '#1e2126', industrial: '#211f25', cemetery: '#1c231d', sport: '#1b241d', cityPark: '#1e3524', parking: '#25282d', parkingLine: '#454a52', bridge: '#c9c2b5', oneway: '#aaa498', onewayBike: '#a9c4ea',
    park: '#4e8f5b', water: '#10304a', waterLine: '#1f5a85', waterText: '#7fb6e3', shoal: '#2f6f9e',
    building: '#272b31', buildingLine: '#30353c',
    motorway: '#8a5a2f', trunk: '#80633a', primary: '#6f6040', secondary: '#5b5443', tertiary: '#4a4740',
    road: '#3b3f46', roadCase: '#22252a', track: '#c9a874', path: '#e9e6df', cycleway: '#7ea4cf',
    rail: '#5d5d5d', power: '#73777d', text: '#d8dde3', halo: '#0f1215', contour: '#6a5845', contourText: '#a08a70',
    boundary: '#9b84c4', hillshade: true,
  },
};
// Aerial and MML bases reuse the trail palette but hide our own fills.
PALETTES.aerial = { ...PALETTES.trail, path: '#ffffff', track: '#ffe4b5', waterText: '#bfe0ff', text: '#ffffff', halo: '#1a1a1a', hillshade: false };
PALETTES.ortofi = PALETTES.aerial;
PALETTES.mml = { ...PALETTES.trail, hillshade: false };
PALETTES.maasto = PALETTES.mml;
export const isAerial = (base) => base === 'aerial' || base === 'ortofi';
export const isTopo = (base) => base === 'mml' || base === 'maasto';
// the route's opacities, faded while a stretch of it is lit (main.js sets them again when routeLit changes); at once, as
// the lit stretch comes and goes with the pointer
export const routeDim = (lit) => ({ 'route-glow': lit ? 0.1 : 0.3, 'route-casing': lit ? 0.6 : 0.9, 'route-line': lit ? 0.5 : 1, 'route-color': lit ? 0.5 : 1 });

// Raw suffixes keep their whole grade except 0−; missing/invalid values match no class.
const MTB_IDX = ['match', ['to-string', ['get', 'mtb_scale']], ...MTB_GRADES.flatMap((k) => [k === '0-' ? '0-' : [String(k), `${k}+`, ...(k > 0 ? [`${k}-`] : [])], String(k)]), ''];
const diffColor = (idxExpr, none) => ['match', idxExpr, ...DIFF_COLORS.flatMap((c, i) => [i, c]), none];
const mtbColor = (idxExpr, none) => ['match', ['to-string', idxExpr], ...MTB_GRADES.flatMap((k) => [String(k), MTB_COLORS[k]]), none];

const isPathClass = ['==', ['get', 'class'], 'path'];
// the trail colours' own opacities (Layers → Trails & difficulty), 0.1–1: 'down' difficulty, 'up' uphill
// yours, or full; in winter with the winter ways on, faint (difficulty matters little under snow, as on Trailmap's winter map)
const trailColorOpacity = (s, which) => (s.overlayOpacity && s.overlayOpacity[`trail:${which}`] != null ? s.overlayOpacity[`trail:${which}`] : 1) * (s.winterOn && s.overlays.winterWays ? 0.3 : 1);
const k0 = (hc) => (hc ? 1.35 : 1);
const TRAIL_SUB = ['path', 'bridleway', 'steps', 'footway', 'pedestrian'];

export function buildStyle(s, ctx) {
  const P = PALETTES[s.base] || PALETTES.trail;
  const hc = !!s.highContrast;
  const act = s.activity;
  const vectorFills = s.base === 'trail' || s.base === 'plain' || s.base === 'night';
  const aerialBase = isAerial(s.base);
  const topoBase = isTopo(s.base);
  const raised = s.terrain3d && s.raiseHills; // the hills raised in 3D, or 3D flat, only tilted
  // MML's tiles (#1147, #1148): your own key, or Polku's unscrambled (config.js)
  const mmlKey = mmlApiKey(s.mmlKey);
  const sources = {
    ofm: { type: 'vector', url: OFM_TILEJSON },
    // the same tiles again (from the HTTP cache), for the trail and track lines alone: with trail details on,
    // their filter changes as detail tiles load, and MapLibre lays out a source's tiles again when
    // a filter changes; on their own source that's only the trails, not the whole map (it froze the page)
    ofmTrails: { type: 'vector', url: OFM_TILEJSON },
    dem: { type: 'raster-dem', tiles: [ctx.demTiles], tileSize: DEM_TILESIZE, maxzoom: DEM_MAXZOOM, encoding: 'terrarium', attribution: '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>' },
    terrain: { type: 'raster-dem', tiles: [ctx.demTiles], tileSize: DEM_TILESIZE, maxzoom: 13, encoding: 'terrarium' },
    contours: { type: 'vector', tiles: [ctx.contourTiles], maxzoom: 16 },
    route: { type: 'geojson', data: ctx.data.route || EMPTY, promoteId: 'leg' }, // the leg as the feature id: the glow under the pointer is its feature state
    routeMarks: { type: 'geojson', data: ctx.data.routeMarks || EMPTY }, // distance (and time) marks along the route
    routeHover: { type: 'geojson', data: ctx.data.routeHover || EMPTY },
    routeColor: { type: 'geojson', data: ctx.data.routeColor || EMPTY },
    routePreview: { type: 'geojson', data: ctx.data.routePreview || EMPTY }, // a breakdown category, while hovered or keyboard-previewed
    routeLit: { type: 'geojson', data: ctx.data.routeLit || EMPTY }, // the leg you open or point at in the waypoint list
    // what a tap picked (#574), drawn like a route: its colours along it, the street's other side, an area's outline, a ring
    pick: { type: 'geojson', data: ctx.data.pick || EMPTY },
    pickSide: { type: 'geojson', data: ctx.data.pickSide || EMPTY },
    pickArea: { type: 'geojson', data: ctx.data.pickArea || EMPTY },
    pickRing: { type: 'geojson', data: ctx.data.pickRing || EMPTY },
    // Check's items on the route (25d part 3): close ones merged, keeping the most serious one's sign (sev: 3 a warning,
    // 2 not checked, 1 good to know); the open one apart, with its obstacle's own icon (#85); the stretches a
    // source didn't cover
    heads: { type: 'geojson', data: ctx.data.heads || EMPTY, cluster: true, clusterRadius: 24, clusterMaxZoom: 17, clusterProperties: { sev: ['max', ['get', 'sev']] } },
    headsOn: { type: 'geojson', data: ctx.data.headsOn || EMPTY },
    headsGaps: { type: 'geojson', data: ctx.data.headsGaps || EMPTY },
    accessCut: { type: 'geojson', data: ctx.data.accessCut || EMPTY }, // a short cut through a way marked private, the one picked in Heads-up (#104)
    loops: { type: 'geojson', data: ctx.data.loops || EMPTY }, // round-trip candidates
    routeAlts: { type: 'geojson', data: ctx.data.routeAlts || EMPTY, promoteId: 'i' }, // other ways for a leg, where they differ (#95); i: the way (hover)
    routeWind: { type: 'geojson', data: ctx.data.routeWind || EMPTY },
    uphill: { type: 'geojson', data: ctx.data.uphill || EMPTY },
    trailWays: { type: 'geojson', data: ctx.data.trailWays || EMPTY }, // trail details (js/trails.js)
    trailPoints: { type: 'geojson', data: ctx.data.trailPoints || EMPTY },
    lipasRoutes: { type: 'geojson', data: ctx.data.lipasRoutes || EMPTY, attribution: '© LIPAS', promoteId: 'lipasId' }, // the LIPAS id as the feature id: the route under the mouse is lit by its feature state
    winterWays: { type: 'geojson', data: ctx.data.winterWays || EMPTY }, // OSM's winter tags (js/winter.js)
    reedbeds: { type: 'geojson', data: ctx.data.reedbeds || EMPTY }, // OSM's reedbeds (Reedbeds in js/osm-data.js)
    litWays: { type: 'geojson', data: ctx.data.litWays || EMPTY }, // OSM's lit and unlit ways (js/lit.js)
    litCover: { type: 'geojson', data: ctx.data.litCover || EMPTY }, // the lit tiles that came in: In the dark's veil
    lipasPoints: { type: 'geojson', data: ctx.data.lipasPoints || EMPTY },
    tracks: { type: 'geojson', data: ctx.data.tracks || EMPTY },
    lipasPick: { type: 'geojson', data: ctx.data.lipasPick || EMPTY }, // a route picked in search, while its card is open
    wxLabels: { type: 'geojson', data: ctx.data.wxLabels || EMPTY },
    wxThunder: { type: 'geojson', data: ctx.data.wxThunder || EMPTY },
    wxStrikes: { type: 'geojson', data: ctx.data.wxStrikes || EMPTY },
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
    sources.aerial = { type: 'raster', tiles: [ESRI_IMAGERY], tileSize: 256 / RASTER_RATIO, maxzoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' };
    add({ id: 'aerial', type: 'raster', source: 'aerial', paint: { 'raster-fade-duration': 150 } });
  }
  if (s.base === 'ortofi') {
    sources.ortofi = { type: 'raster', tiles: [kapsiTiles('ortokuva', 512 * RASTER_RATIO)], tileSize: 512, minzoom: 5, maxzoom: 19, attribution: 'Ortokuva © Maanmittauslaitos, Kapsi ry' };
    add({ id: 'ortofi', type: 'raster', source: 'ortofi', paint: { 'raster-fade-duration': 150 } });
  }
  if (s.base === 'maasto') {
    sources.maasto = { type: 'raster', tiles: [kapsiTiles('peruskartta', 1024)], tileSize: 256, minzoom: 5, maxzoom: 19, attribution: 'Maastokartta © Maanmittauslaitos, Kapsi ry' };
    add({ id: 'maasto-base', type: 'raster', source: 'maasto', paint: { 'raster-fade-duration': 150 } });
  }
  if (s.base === 'mml' && s.mmlKey) {
    sources.mmlBase = { type: 'raster', tiles: [mmlTiles('maastokartta', s.mmlKey)], tileSize: 128, maxzoom: 16, attribution: '© Maanmittauslaitos' };
    add({ id: 'mml-base', type: 'raster', source: 'mmlBase' });
  }

  const waterColor = isWater(act) ? (s.base === 'night' ? '#0d3b5e' : '#93c6ec') : P.water;

  // ---- Land ---------------------------------------------------------------
  if (vectorFills) {
    const lc = (id, cls, color, extra = {}) =>
      add({ id, type: 'fill', source: 'ofm', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', cls]], paint: { 'fill-color': color, 'fill-antialias': false, ...extra } });
    // the town's land use under the land cover (#1220), so a park or a lawn in a block shows (whole parks in Tallinn's and
    // Stockholm's districts, which are mapped as land use)
    const lu = (id, cls, color, minzoom = 8) =>
      add({ id, type: 'fill', source: 'ofm', 'source-layer': 'landuse', minzoom, filter: ['in', ['get', 'class'], ['literal', cls]], paint: { 'fill-color': color } });
    lu('lu-residential', ['residential', 'suburb', 'neighbourhood'], P.residential, 9);
    lu('lu-industrial', ['industrial', 'commercial', 'retail', 'railway', 'garages', 'quarry'], P.industrial, 11);
    lu('lu-cemetery', ['cemetery'], P.cemetery, 12);
    lc('lc-farmland', ['farmland'], P.farmland);
    lc('lc-grass', ['grass'], P.grass);
    // parks, gardens, village greens and recreation grounds (#1220) in a clearer green than lawns, under the forest, so a wooded
    // park keeps its trees
    add({ id: 'lc-park', type: 'fill', source: 'ofm', 'source-layer': 'landcover', filter: ['in', ['get', 'subclass'], ['literal', ['park', 'garden', 'village_green', 'recreation_ground']]], paint: { 'fill-color': P.cityPark, 'fill-antialias': false } });
    lc('lc-wood', ['wood'], P.wood, { 'fill-opacity': P.woodOpacity });
    // MML's terrain in Finland (#1147): its background map's tiles, from zoom 11
    sources.mml = { type: 'vector', tiles: [`${MML_TERRAIN_TILES}?api-key=${encodeURIComponent(mmlKey)}`], minzoom: 11, maxzoom: 14, bounds: FINLAND_BOUNDS, attribution: '© Maanmittauslaitos, Maastotietokanta, CC BY 4.0' };
    const hex = (c) => c.slice(1), dashes = (ground) => `wetland-${hex(ground)}-${hex(P.wetlandDash)}`, hard = (ground) => `bog-hard-${hex(ground)}-${hex(P.wetlandDash)}`;
    const cls = ['get', 'kohdeluokka'], openForest = `open-forest-${hex(P.bg)}-${hex(P.openForest)}`;
    // open ground over the forest (#1169): OSM's heath and scrub, which a forest around them would hide (whole fells at
    // Pallas), and over them MML's in Finland, in the same looks: heath a flat tint, open forest land (mostly clear-cuts)
    // and scrub the Maastokartta's hatch, meadows, open shores, fields and sand in OSM's own colours
    const sub = ['get', 'subclass'];
    add({ id: 'lc-heath', type: 'fill', source: 'ofm', 'source-layer': 'landcover', filter: ['==', sub, 'heath'], paint: { 'fill-color': P.heath, 'fill-antialias': false } });
    add({ id: 'lc-scrub', type: 'fill', source: 'ofm', 'source-layer': 'landcover', filter: ['==', sub, 'scrub'], paint: { 'fill-pattern': openForest } });
    add({ id: 'mml-open', type: 'fill', source: 'mml', 'source-layer': 'maasto_alue', minzoom: 11, filter: ['in', cls, ['literal', [39120, 39130, 34300]]], paint: { 'fill-color': ['match', cls, 39120, P.heath, 39130, P.grass, P.sand], 'fill-antialias': false } });
    add({ id: 'mml-landuse', type: 'fill', source: 'mml', 'source-layer': 'maankaytto', minzoom: 11, filter: ['in', cls, ['literal', [32611, 32612, 32800, 34300]]], paint: { 'fill-color': ['match', cls, [32611, 32612], P.farmland, 32800, P.grass, P.sand], 'fill-antialias': false } });
    add({ id: 'mml-open-forest', type: 'fill', source: 'mml', 'source-layer': 'maasto_alue', minzoom: 13, filter: ['==', cls, 39110], paint: { 'fill-pattern': openForest } });
    // paludified land from zoom 13: sparse dashes on a clear ground, so the land shows; under OSM's wetlands, as it isn't a bog
    add({ id: 'mml-paludified', type: 'fill', source: 'mml', 'source-layer': 'maasto_alue', minzoom: 13, filter: ['==', cls, 35300], paint: { 'fill-pattern': `bog-paludified-${hex(P.wetlandDash)}` } });
    lc('lc-wetland', ['wetland'], P.wetland);
    // blue dashes from zoom 11 (js/icons.js): the tiles' wetlands are all one kind, so nothing about trees or footing (#1144)
    add({ id: 'lc-wetland-pattern', type: 'fill', source: 'ofm', 'source-layer': 'landcover', minzoom: 11, filter: ['==', ['get', 'class'], 'wetland'], paint: { 'fill-pattern': `wetland-${P.wetland.slice(1)}-${P.wetlandDash.slice(1)}` } });
    // MML's lakes in Finland over OSM's wetlands: OSM's lakes leave a hole for each marsh in them, and MML's lake covers it,
    // so the lake doesn't show land-coloured patches where MML has no overgrowing water (Rautpohja, Jyväskylä)
    add({ id: 'mml-lake', type: 'fill', source: 'mml', 'source-layer': 'vesisto_alue', filter: ['in', cls, ['literal', [36200, 36211, 36313]]], paint: { 'fill-color': waterColor } });
    // MML's bogs in Finland (#1147), over OSM's wetlands: where MML has a bog its class shows, and OSM's wetland stays
    // where MML has none, abroad and wherever MML's tiles don't come. Their grounds are opaque, so no dashes show through.
    // Zoom 11's tiles only say open or wooded (35401/35402); a bog MML's survey classes hard to cross (35421/35422) gets
    // unbroken lines where the tiles carry the class, large ones from zoom 12 and the rest from 13.
    add({
      id: 'mml-bog', type: 'fill', source: 'mml', 'source-layer': 'maasto_alue', minzoom: 11,
      filter: ['in', cls, ['literal', [35401, 35402, 35411, 35412, 35421, 35422]]],
      paint: { 'fill-pattern': ['match', cls, [35401, 35411], dashes(P.wetland), [35402, 35412], dashes(P.bogWood), 35421, hard(P.wetland), hard(P.bogWood)] },
    });
    lc('lc-sand', ['sand'], P.sand);
    lc('lc-rock', ['rock'], P.rock);
    // MML's rock in Finland (#1147), from zoom 13, over OSM's in the same grey, so the two read as one: OSM's stays where
    // MML has none, abroad and wherever MML's tiles don't come. Boulder fields are dotted. (Its points are over the water.)
    add({ id: 'mml-rock', type: 'fill', source: 'mml', 'source-layer': 'maasto_alue', minzoom: 13, filter: ['==', cls, 34100], paint: { 'fill-color': P.rock, 'fill-antialias': false } });
    add({ id: 'mml-boulders', type: 'fill', source: 'mml', 'source-layer': 'maasto_alue', minzoom: 13, filter: ['==', cls, 34700], paint: { 'fill-pattern': `boulders-${hex(P.rock)}-${hex(P.cliff)}` } });
    // OSM's scree (#1178) dotted the same, over MML's rock so it shows where MML calls it rock
    add({ id: 'lc-scree', type: 'fill', source: 'ofm', 'source-layer': 'landcover', minzoom: 13, filter: ['==', ['get', 'subclass'], 'scree'], paint: { 'fill-pattern': `boulders-${hex(P.rock)}-${hex(P.cliff)}` } });
    lc('lc-ice', ['ice'], P.ice);
    // pitches and playgrounds over the land cover: they're often in a park
    lu('lu-sport', ['pitch', 'stadium', 'playground', 'track'], P.sport, 13);
    // car parks in Finland (#1219): MML's motor traffic areas (public car parks of 1,000 m² and more, larger private ones, rest
    // and loading areas) from zoom 14, in OSM's grey, which is close to the town's ground: the edge and the P carry it
    add({ id: 'mml-parking', type: 'fill', source: 'mml', 'source-layer': 'liikenne', minzoom: 14, filter: ['all', ['==', cls, 32421], ['==', ['geometry-type'], 'Polygon']], paint: { 'fill-color': P.parking, 'fill-outline-color': P.parkingLine } });
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
    const night = s.base === 'night';
    // lit by the sun at the map's hour (#910) while it's up, else by the map's own light
    const sun = s.hillLight === 'sun' && ctx.sunAt ? ctx.sunAt() : null, sunUp = sun && sun.alt > 0.5;
    // (no fade between one light's colours and four lights' lists: MapLibre can't blend them, it throws)
    const now = { 'hillshade-shadow-color-transition': { duration: 0 }, 'hillshade-highlight-color-transition': { duration: 0 } };
    add({
      id: 'hillshade', type: 'hillshade', source: 'dem', minzoom: 4,
      paint: sunUp || raised ? {
        ...now,
        // one light, fixed to the map: the sun, or in 3D the north-west, so a tilted slope facing away from it is darker
        'hillshade-method': sunUp ? 'combined' : 'standard',
        'hillshade-illumination-direction': sunUp ? Math.round(sun.az) : 315,
        ...(sunUp && { 'hillshade-illumination-altitude': Math.round(sun.alt) }),
        'hillshade-illumination-anchor': 'map',
        'hillshade-shadow-color': night ? 'rgba(0,0,0,0.7)' : 'rgba(45,35,25,0.6)',
        'hillshade-highlight-color': night ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,240,0.4)',
        'hillshade-accent-color': night ? 'rgba(0,0,0,0.35)' : 'rgba(45,35,25,0.3)',
        'hillshade-exaggeration': 1,
      } : {
        ...now,
        'hillshade-method': 'multidirectional',
        'hillshade-illumination-direction': [270, 315, 0, 45],
        'hillshade-illumination-altitude': [30, 30, 30, 30],
        'hillshade-shadow-color': night
          ? ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.5)']
          : ['rgba(70,50,35,0.32)', 'rgba(70,50,35,0.32)', 'rgba(70,50,35,0.22)', 'rgba(70,50,35,0.22)'],
        'hillshade-highlight-color': night
          ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.03)']
          : ['rgba(255,255,240,0.35)', 'rgba(255,255,240,0.35)', 'rgba(255,255,240,0.2)', 'rgba(255,255,240,0.2)'],
        'hillshade-exaggeration': zi(5, 0.75, 11, 0.55, 15, 0.45),
      },
    });
    // the shadows the hills cast (js/shadows.js), from zoom 10: drawn with the buildings, below
    // and the trees' and buildings' (#919) from zoom 14: each its own setting
    const shade = sunUp && `sunshadow://{z}/{x}/{y}?t=${sun.t}`;
    if (shade && s.hillShadows) sources.sunshadow = { type: 'raster', tiles: [shade], tileSize: 512, minzoom: 10, maxzoom: 13 };
    if (shade && s.objectShadows) sources.objshadow = { type: 'raster', tiles: [`${shade}&objects`], tileSize: 512, minzoom: 14, maxzoom: 15, attribution: 'Tree heights © Meta & WRI, via TGE Labs' };
  }

  // ---- Water --------------------------------------------------------------
  if (!aerialBase && !topoBase) {
    // a stream wider than a ditch or drain, so the two read apart (#1138); the tiles have them from zoom 13.
    // Under the water's fill, so a river's line doesn't show through a lake or strait it runs across.
    const ww = (river, stream, ditch) => ['match', ['get', 'class'], ['river', 'canal'], river, ['ditch', 'drain'], ditch, stream];
    add({
      id: 'waterway', type: 'line', source: 'ofm', 'source-layer': 'waterway', minzoom: 8,
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      paint: {
        'line-color': P.waterLine,
        'line-width': zi(8, ww(0.6, 0, 0), 11, ww(1.2, 0, 0), 13, ww(2.2, 0.8, 0.4), 14, ww(3, 1.5, 0.7), 16, ww(5.5, 4, 1.6), 18, ww(9, 8, 3)),
        'line-dasharray': ['case', ['==', ['get', 'intermittent'], 1], ['literal', [4, 3]], ['literal', [1, 0]]],
      },
    });
    add({ id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water', filter: ['!=', ['get', 'class'], 'swimming_pool'], paint: { 'fill-color': waterColor, 'fill-antialias': true } });
    // reeds in the water, one look from both sources (#1248): tufts on the water's own blue (paddling's too), over the
    // lake, which would hide them, so a reedbed never reads as land. OSM's reedbeds from Polku's own OSM data
    // (js/osm-data.js), then MML's overgrowing water in Finland (#1147), whose tap card wins where both are.
    const reeds = `reedbed-${waterColor.slice(1)}-${P.reed.slice(1)}`;
    add({ id: 'lc-reedbed', type: 'fill', source: 'reedbeds', minzoom: 12, paint: { 'fill-pattern': reeds } });
    if (sources.mml) add({ id: 'mml-overgrowing', type: 'fill', source: 'mml', 'source-layer': 'maasto_alue', minzoom: 11, filter: ['==', ['get', 'kohdeluokka'], 38300], paint: { 'fill-pattern': reeds } });
    add({ id: 'water-shore', type: 'line', source: 'ofm', 'source-layer': 'water', minzoom: 11, filter: ['!=', ['get', 'class'], 'swimming_pool'], paint: { 'line-color': P.waterLine, 'line-width': zi(11, 0.3, 15, act === 'paddle' ? 1.4 : 0.8), 'line-opacity': 0.8 } });
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
    const cls = ['get', 'kohdeluokka'], tick = zi(13, 2, 16, 3.5, 18, 5), edge = zi(13, 0.8, 16, 1.3, 18, 1.8);
    const hex = (c) => c.slice(1);
    // MML's lake and river depths (#1170) with Traficom's, under the same switches, from zoom 13 (its tiles have none at sea):
    // the contours with Depth contours, their depths and the depth points with Depth soundings (below). In Traficom's
    // look (its WMS draws #1f4d6b lines about 2 px wide and black soundings, at the overlays' 0.75 and 0.85), so the two read
    // as one; on the Night map light, as dark lines would vanish on its dark water, which MML's lakes have no depth areas to lighten.
    // and at the rows' Opacity, yours or the default
    const night = s.base === 'night', depthLine = night ? P.waterText : '#1f4d6b';
    const depthOp = (id) => (s.overlayOpacity && s.overlayOpacity[id] != null ? s.overlayOpacity[id] : RASTER_OVERLAYS[id].opacity);
    if (s.overlays.depthContours) add({ id: 'mml-depth', type: 'line', source: 'mml', 'source-layer': 'korkeus', minzoom: 13, filter: ['==', cls, 54100], paint: { 'line-color': depthLine, 'line-width': zi(13, 1, 16, 1.5, 18, 2), 'line-opacity': depthOp('depthContours') } });
    // MML's water (#1170), over Traficom's depths too. Shoals and stone fields from zoom 13, as light lines on a clear
    // ground, so the water's colour and the depths show; stone fields with MML's triangles.
    add({ id: 'mml-shoal', type: 'fill', source: 'mml', 'source-layer': 'maasto_alue', minzoom: 13, filter: ['in', cls, ['literal', [38600, 38700]]], paint: { 'fill-pattern': ['match', cls, 38600, `stonefield-${hex(P.shoal)}-${hex(P.cliff)}`, `shoal-${hex(P.shoal)}`] } });
    // rapids along the river from zoom 11, as white bars across it (zoom 12's tiles also have some as points, which 13 and
    // 14's lack: not drawn)
    add({ id: 'mml-rapids', type: 'line', source: 'mml', 'source-layer': 'vesisto_viiva', minzoom: 11, filter: ['all', ['==', cls, 38200], ['==', ['geometry-type'], 'LineString']], paint: { 'line-pattern': `rapids-${hex(P.shoal)}-${hex(P.waterText)}`, 'line-width': zi(11, 3, 14, 6, 16, 9, 18, 13) } });
    // jetties from zoom 14: MML's in Finland, OSM's piers everywhere, in one look, so where both have one they read as one
    const pier = ['==', ['get', 'class'], 'pier'], wide = (w) => ['match', cls, 45112, w * 1.6, w];
    add({ id: 'pier-area', type: 'fill', source: 'ofm', 'source-layer': 'transportation', minzoom: 14, filter: ['all', pier, ['==', ['geometry-type'], 'Polygon']], paint: { 'fill-color': P.bg, 'fill-outline-color': P.cliff } });
    add({ id: 'pier', type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 14, filter: ['all', pier, ['==', ['geometry-type'], 'LineString']], paint: { 'line-color': P.cliff, 'line-width': zi(14, 1, 16, 2, 18, 4) } });
    // dams and breakwaters (#1172) in the same dark line: built across or into the water, where a boat doesn't pass
    add({ id: 'mml-jetty', type: 'line', source: 'mml', 'source-layer': 'rakennelma', minzoom: 14, filter: ['in', cls, ['literal', [45111, 45112, 30300, 44100]]], paint: { 'line-color': P.cliff, 'line-width': zi(14, wide(1), 16, wide(2), 18, wide(4)) } });
    // MML's cliffs, power lines and points in Finland (#1147), over the water, so a shore's cliff, a line across a lake
    // and the reeds show.
    // A cliff is a line with ticks on its lower side: MML draws its cliffs with the lower side on the right (37 of 37 by
    // the elevations either side, 2026-11-20), and a positive line-offset is the right. The ticks are dashes of a wider
    // line beside it. OSM's cliffs (#1178) have their lower side on the right too, and are drawn the same, everywhere:
    // OSM and MML each have cliffs the other lacks, so where both have one it's drawn twice, close together.
    // a ridge (#1178) is OSM's standard map's band of dots along its crest, in the peaks' brown, under the cliffs
    add({ id: 'osm-ridge', type: 'line', source: 'ofm', 'source-layer': 'mountain_peak', minzoom: 14, filter: ['==', ['get', 'class'], 'ridge'], paint: { 'line-pattern': 'ridge-6b4b2b', 'line-width': zi(14, 10, 16, 16, 18, 22), 'line-opacity': 0.7 } });
    for (const [id, source, layer, filter] of [['osm-cliff', 'ofm', 'mountain_peak', ['==', ['get', 'class'], 'cliff']], ['mml-cliff', 'mml', 'maasto_viiva', ['==', cls, 34400]]]) {
      add({ id, type: 'line', source, 'source-layer': layer, minzoom: 13, filter, paint: { 'line-color': P.cliff, 'line-width': edge } });
      add({ id: `${id}-ticks`, type: 'line', source, 'source-layer': layer, minzoom: 13, filter, paint: { 'line-color': P.cliff, 'line-width': tick, 'line-offset': zi(13, 1.4, 16, 2.4, 18, 3.4), 'line-dasharray': [0.4, 1.4] } });
    }
    // power lines as thin grey lines from zoom 13 (110 kV and up, and under 110 kV)
    // ski lifts and cableways from zoom 13 (#1172): OSM's everywhere and MML's in Finland, a dark line in one look, the two within
    // a metre of each other where both have one (2026-11-21), so they read as one line; a chair along it, from the marks below
    const aerialway = ['==', ['get', 'class'], 'aerialway'], liftLine = { 'line-color': P.cliff, 'line-width': zi(13, 1, 16, 1.6, 18, 2.2) };
    add({ id: 'lift', type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 13, filter: aerialway, paint: liftLine });
    add({ id: 'mml-lift', type: 'line', source: 'mml', 'source-layer': 'rakennelma', minzoom: 13, filter: ['==', cls, 44500], paint: liftLine });
    add({ id: 'mml-power', type: 'line', source: 'mml', 'source-layer': 'rakennelma', minzoom: 13, filter: ['in', cls, ['literal', [22311, 22312]]], paint: { 'line-color': P.power, 'line-width': zi(13, 0.6, 16, 1, 18, 1.4) } });
    // MML's points, side by side (each symbol layer splits 3D's draped layers): from zoom 14, as only zoom 14's tiles have
    // them, flat on the ground and never hiding a label or a place. Rocks too small for an area, stones and sparse
    // boulders; reeds, one tuft each (MML's reed points lie in the water, so a tuft under it wouldn't show); pylons from 15.
    // Stones in the water (#1170) too, under the surface, at it and above it, as MML's and Traficom's maps draw them.
    const flat = { 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-pitch-alignment': 'map', 'icon-rotation-alignment': 'map' };
    add({
      id: 'mml-rock-point', type: 'symbol', source: 'mml', 'source-layer': 'maasto_piste', minzoom: 14, filter: ['in', cls, ['literal', [34100, 34200, 34600, 38511, 38512, 38513]]],
      layout: { 'icon-image': ['match', cls, 34100, `rock-spot-${hex(P.rock)}-${hex(P.cliff)}`, 34200, `rock-rocks-${hex(P.cliff)}`, 38511, `rock-under-${hex(P.cliff)}`, 38512, `rock-awash-${hex(P.cliff)}`, 38513, `rock-above-${hex(P.cliff)}`, `rock-stone-${hex(P.cliff)}`], 'icon-size': zi(14, 0.75, 17, 1.2), ...flat },
    });
    // which way a river flows, from zoom 14: MML's `suunta` is in 1/10,000 radian, counter-clockwise from east (it
    // pointed downhill at 8 of 8 arrows where the elevations differ, 2026-11-20); icon-rotate is clockwise degrees
    // depths in metres (syvyysarvo is in millimetres): along the contours from zoom 14, and MML's depth points from 13
    const metres = (k) => ['number-format', ['/', ['get', k], 1000], { 'max-fraction-digits': 1, locale: 'en' }];
    if (s.overlays.depthContours) add({ id: 'mml-depth-label', type: 'symbol', source: 'mml', 'source-layer': 'korkeus', minzoom: 14, filter: ['==', cls, 54100], layout: { 'symbol-placement': 'line', 'symbol-spacing': 300, 'text-field': metres('syvyysarvo'), 'text-font': FONT, 'text-size': 10, 'text-optional': true }, paint: { 'text-color': depthLine, 'text-halo-color': P.halo, 'text-halo-width': 1, 'text-opacity': depthOp('depthContours') } });
    if (s.overlays.soundings) add({ id: 'mml-sounding', type: 'symbol', source: 'mml', 'source-layer': 'korkeus', minzoom: 13, filter: ['==', cls, 54210], layout: { 'text-field': metres('syvyysarvo'), 'text-font': FONT_B, 'text-size': zi(13, 10, 16, 12), 'text-optional': true }, paint: { 'text-color': night ? P.text : '#000000', 'text-opacity': depthOp('soundings') } });
    // a lake's surface height above the sea, from zoom 13, in the water names' italic: in the basemap, as a peak's height is
    add({ id: 'mml-lake-height', type: 'symbol', source: 'mml', 'source-layer': 'korkeus', minzoom: 13, filter: ['all', ['==', cls, 36291], ['has', 'keskikorkeus']], layout: { 'text-field': ['concat', metres('keskikorkeus'), ' m a.s.l.'], 'text-font': FONT_I, 'text-size': 10.5, 'text-optional': true }, paint: { 'text-color': P.waterText, 'text-halo-color': P.halo, 'text-halo-width': 1 } });
    add({ id: 'mml-flow', type: 'symbol', source: 'mml', 'source-layer': 'symboli', minzoom: 14, filter: ['in', cls, ['literal', [36392, 36393]]], layout: { 'icon-image': `flow-${hex(P.waterText)}-${hex(P.halo)}`, 'icon-rotate': ['*', ['get', 'suunta'], -180 / Math.PI / 10000], 'icon-size': zi(14, 1, 17, 1.5), ...flat } });
    add({ id: 'mml-reed', type: 'symbol', source: 'mml', 'source-layer': 'maasto_piste', minzoom: 14, filter: ['==', cls, 38100], layout: { 'icon-image': `reed-${hex(P.reed)}`, 'icon-size': zi(14, 1, 17, 1.5), ...flat } });
    // the forest's kind, and dwarf-shrub heath, from zoom 14 (#1169): the Maastokartta's symbols, in a dark green
    add({
      id: 'mml-forest', type: 'symbol', source: 'mml', 'source-layer': 'symboli', minzoom: 14, filter: ['in', cls, ['literal', [32710, 32713, 32714, 32715]]],
      layout: { 'icon-image': ['match', cls, 32710, `tree-conifer-${hex(P.treeMark)}`, 32713, `tree-broadleaf-${hex(P.treeMark)}`, 32714, `tree-mixed-${hex(P.treeMark)}`, `tree-heath-${hex(P.treeMark)}`], 'icon-size': zi(14, 0.8, 18, 1.3), ...flat },
    });
    // a lift's chair, upright, every so often along it; the two sources' chairs give way to each other, so a lift both have
    // shows one row of them
    const chair = { 'symbol-placement': 'line', 'symbol-spacing': 300, 'icon-image': `lift-${hex(P.cliff)}`, 'icon-rotation-alignment': 'viewport', 'icon-pitch-alignment': 'viewport', 'icon-size': zi(14, 0.9, 18, 1.1) };
    add({ id: 'lift-chair', type: 'symbol', source: 'ofm', 'source-layer': 'transportation', minzoom: 14, filter: aerialway, layout: chair });
    add({ id: 'mml-lift-chair', type: 'symbol', source: 'mml', 'source-layer': 'rakennelma', minzoom: 14, filter: ['==', cls, 44500], layout: chair });
    // masts and chimneys (#1172), in zoom 14's tiles only, standing up as the Maastokartta draws them; the height (`korkeus`,
    // 44803 a mast's, 45303 a chimney's) sits where MML sets it, its dx and dy (millimetres on the ground) from the mark: up to
    // 120 m, a few dozen pixels at zooms 14 and 15, so it isn't drawn closer in
    add({ id: 'mml-mast', type: 'symbol', source: 'mml', 'source-layer': 'poi', minzoom: 14, filter: ['in', cls, ['literal', [44800, 45300]]], layout: { 'icon-image': ['match', cls, 44800, `mast-${hex(P.cliff)}`, `chimney-${hex(P.cliff)}`], 'icon-anchor': 'bottom', 'icon-size': zi(14, 1, 17, 1.3), 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
    add({ id: 'mml-mast-height', type: 'symbol', source: 'mml', 'source-layer': 'korkeus', minzoom: 14, maxzoom: 16, filter: ['in', cls, ['literal', [44803, 45303]]], layout: { 'text-field': ['concat', metres('korkeusarvo'), ' m'], 'text-font': FONT, 'text-size': 10, 'text-optional': true }, paint: { 'text-color': P.cliff, 'text-halo-color': P.halo, 'text-halo-width': 1 } });
    add({ id: 'mml-pylon', type: 'symbol', source: 'mml', 'source-layer': 'rakennelma', minzoom: 15, filter: ['==', cls, 22392], layout: { 'icon-image': `pylon-${hex(P.power)}`, 'icon-size': zi(15, 1, 18, 1.5), ...flat } });
    add({ id: 'building', type: 'fill', source: 'ofm', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': s.base === 'trail' ? '#bdb8b0' : P.building, 'fill-outline-color': s.base === 'trail' ? '#918b81' : P.buildingLine, 'fill-opacity': zi(13, 0.5, 15, 1) } });
    add({ id: 'aeroway', type: 'line', source: 'ofm', 'source-layer': 'aeroway', minzoom: 11, filter: ['in', ['get', 'class'], ['literal', ['runway', 'taxiway']]], paint: { 'line-color': '#c9c6c0', 'line-width': ze(1.5, 11, 1, 16, 30) } });
  }
  // the hills' shadows, and the trees' and buildings' (js/shadows.js, #919) from zoom 14: over water, fields and roofs
  if (sources.sunshadow) add({ id: 'sun-shadow', type: 'raster', source: 'sunshadow', minzoom: 10, paint: { 'raster-fade-duration': 0 } });
  if (sources.objshadow) add({ id: 'obj-shadow', type: 'raster', source: 'objshadow', minzoom: 14, paint: { 'raster-fade-duration': 0 } });

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

  // Property boundaries in Finland (#1148): MML's property map from zoom 14, the property IDs from 16. In their own
  // orange, apart from the route's magenta, danger's red and the trails' colours. (ov-: its failures show as a layer's.)
  if (s.overlays.propertyLines) {
    const dark = s.base === 'night' || aerialBase;
    const color = dark ? '#fdba74' : '#c2410c', op = s.overlayOpacity && s.overlayOpacity.propertyLines != null ? s.overlayOpacity.propertyLines : 0.9;
    sources['ov-propertyLines'] = { type: 'vector', tiles: [`${MML_PROPERTY_TILES}?api-key=${encodeURIComponent(mmlKey)}`], promoteId: { PalstanSijaintitiedot: 'id' }, minzoom: 14, maxzoom: 14, bounds: FINLAND_BOUNDS, attribution: '© Maanmittauslaitos, kiinteistörekisteri, CC BY 4.0' };
    // a plot under the pointer, or picked with its card open, tinted (#1148): by feature state, so its pieces in every tile;
    // otherwise clear, there for a tap to find; with Property details off, not there at all (#1199)
    const plot = (k) => ['boolean', ['feature-state', k], false];
    if (s.plotSelect) add({ id: 'property-plot', type: 'fill', source: 'ov-propertyLines', 'source-layer': 'PalstanSijaintitiedot', minzoom: 14, paint: { 'fill-color': color, 'fill-opacity': ['case', plot('lit'), 0.24, plot('hover'), 0.12, 0] } });
    add({ id: 'property-line', type: 'line', source: 'ov-propertyLines', 'source-layer': 'KiinteistorajanSijaintitiedot', minzoom: 14, paint: { 'line-color': color, 'line-width': zi(14, 0.8, 17, 1.6, 19, 2.5), 'line-opacity': op } });
    add({ id: 'property-id', type: 'symbol', source: 'ov-propertyLines', 'source-layer': 'KiinteistotunnuksenSijaintitiedot', minzoom: 16,
      layout: { 'text-field': ['get', 'kiinteistotunnuksenEsitysmuoto'], 'text-font': FONT, 'text-size': 11, 'text-optional': true },
      paint: { 'text-opacity': op, 'text-color': color, 'text-halo-color': dark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)', 'text-halo-width': 1.4 } });
  }

  // In 3D the buildings stand up (#643), over the roads and trails, under the routes, the names and your route.
  // Their heights are OpenFreeMap's from OSM's height or floors, about 5 m where it has neither; they rise from zoom 14.
  if (vectorFills && s.terrain3d && s.buildings3d) {
    add({ id: 'building-3d', type: 'fill-extrusion', source: 'ofm', 'source-layer': 'building', minzoom: 14, paint: {
      'fill-extrusion-color': P.building, 'fill-extrusion-opacity': 0.92, 'fill-extrusion-vertical-gradient': true,
      'fill-extrusion-height': zi(14, 0, 15, BUILDING_HEIGHT), 'fill-extrusion-base': zi(14, 0, 15, ['get', 'render_min_height']),
    } });
  }

  // ---- Official routes (LIPAS) -----------------------------------------
  if (s.overlays.lipasRoutes || (s.winterOn && s.overlays.lipasWinter)) {
    const typeColor = ['match', ['get', 'type'], ...Object.entries(LIPAS_TYPES).filter(([k]) => isLipasRoute(k)).flatMap(([k, v]) => [+k, v.color]), '#555'];
    add({ id: 'lipas-route-casing', type: 'line', source: 'lipasRoutes', minzoom: 8, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-opacity': 0.75, 'line-width': zi(8, 2, 14, 6, 18, 10) } });
    add({
      id: 'lipas-route', type: 'line', source: 'lipasRoutes', minzoom: 8, layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': typeColor, 'line-width': zi(8, 1, 14, 3, 18, 5), 'line-opacity': 0.85,
        'line-dasharray': ['case', ['in', ['get', 'type'], ['literal', [4451, 4452, 4421]]], ['literal', [2, 1.2]], ['literal', [1, 0]]],
      },
    });
    // a ski track as a double line, as on Trailmap's winter map: keep off it on foot and by bike
    add({ id: 'lipas-ski-gap', type: 'line', source: 'lipasRoutes', minzoom: 11, filter: ['==', ['get', 'type'], 4402], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': zi(11, 0.6, 14, 1.4, 18, 2.4) } });
  }

  // ---- Winter ways (OSM: js/winter.js) ------------------------------------
  // How soon a way opens after snow, ploughing, no access in winter, ski tracks: Trailmap's winter classes
  if ((s.winterOn && s.overlays.winterWays) || s.trailColors === 'winter') { // winter, or the Winter trail colours any time
    const W = zi(11, 1.6, 14, 3.4, 18, 6);
    const cls = (c) => ['==', ['get', 'cls'], c];
    add({ id: 'winter-casing', type: 'line', source: 'winterWays', minzoom: 11, filter: ['!', cls('ski')], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-opacity': 0.8, 'line-width': zi(11, 3, 14, 6, 18, 10) } });
    add({
      id: 'winter-way', type: 'line', source: 'winterWays', minzoom: 11, filter: ['!', ['in', ['get', 'cls'], ['literal', ['ski', 'closed']]]], layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['match', ['get', 'cls'], 'ploughed', '#0d9488', 'groomed', '#0d9488', 'open1', '#65a30d', 'open2', '#a3b10e', 'open3', '#d39b46', 'unploughed', '#94a3b8', 'seasonal', '#0891b2', '#64748b'],
        'line-width': W,
        'line-dasharray': ['match', ['get', 'cls'], 'unploughed', ['literal', [1.5, 1.2]], 'seasonal', ['literal', [0.6, 1.4]], ['literal', [1, 0]]],
      },
    });
    // no access in winter: red and white, like a closed ski base
    add({ id: 'winter-closed', type: 'line', source: 'winterWays', minzoom: 11, filter: cls('closed'), layout: { 'line-join': 'round' }, paint: { 'line-color': '#dc2626', 'line-width': W } });
    add({ id: 'winter-closed-dash', type: 'line', source: 'winterWays', minzoom: 11, filter: cls('closed'), layout: { 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': zi(11, 1, 14, 2, 18, 3.5), 'line-dasharray': ['literal', [1, 1]] } });
    // ski tracks from OSM: the double line in pink (LIPAS's in its own blue-violet)
    add({ id: 'winter-ski', type: 'line', source: 'winterWays', minzoom: 11, filter: cls('ski'), layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#f472b6', 'line-width': zi(11, 2.4, 14, 4.4, 18, 7) } });
    add({ id: 'winter-ski-gap', type: 'line', source: 'winterWays', minzoom: 11, filter: cls('ski'), layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': zi(11, 0.8, 14, 1.6, 18, 2.6) } });
  }

  // ---- Lit ways (OSM: js/lit.js) ------------------------------------------
  // Lines: lit a bright line with an edge that stands out on the map (as the route's: dark on the light maps, white on
  // the night map and the aerial photos); unlit a thin dashed grey line, so the two don't differ by colour alone; no tag:
  // none. In the dark (#638's look A): a navy veil over the lit tiles that came in, so where none did the map isn't
  // dimmed and missing data never looks like no lights, lit ways glowing warm white over it, unlit still dashed. Your
  // opacity scales either look; no transitions, so nothing fades.
  if (s.overlays.lit) {
    const darkMap = aerialBase || s.base === 'night', dark = s.litLook === 'dark';
    const k = s.overlayOpacity && s.overlayOpacity.lit != null ? s.overlayOpacity.lit : 1;
    const lit = (v) => ['==', ['get', 'lit'], v];
    const still = { duration: 0, delay: 0 };
    if (dark) add({ id: 'lit-veil', type: 'fill', source: 'litCover', minzoom: 13, paint: { 'fill-color': '#0b1a33', 'fill-opacity': k * (s.base === 'night' ? 0.45 : darkMap ? 0.55 : 0.7), 'fill-opacity-transition': still, 'fill-antialias': false } });
    add({ id: 'lit-unlit', type: 'line', source: 'litWays', minzoom: 13, filter: lit(0), layout: { 'line-join': 'round' }, paint: { 'line-color': dark ? '#cbd5e1' : darkMap ? '#9ca3af' : '#6b7280', 'line-width': zi(13, 1.2, 16, 2.2, 18, 3), 'line-dasharray': ['literal', [2, 1.5]], 'line-opacity': k, 'line-opacity-transition': still } });
    if (dark) {
      add({ id: 'lit-glow', type: 'line', source: 'litWays', minzoom: 13, filter: lit(1), layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffe6a8', 'line-width': zi(13, 8, 16, 18, 18, 28), 'line-blur': zi(13, 4, 16, 10, 18, 16), 'line-opacity': k * 0.6, 'line-opacity-transition': still } });
      add({ id: 'lit-core', type: 'line', source: 'litWays', minzoom: 13, filter: lit(1), layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#fffaf0', 'line-width': zi(13, 1.2, 16, 2.4, 18, 3.5), 'line-opacity': k, 'line-opacity-transition': still } });
    } else {
      add({ id: 'lit-casing', type: 'line', source: 'litWays', minzoom: 13, filter: lit(1), layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': darkMap ? '#ffffff' : '#111827', 'line-width': zi(13, 3, 16, 5.5, 18, 8), 'line-opacity': k, 'line-opacity-transition': still } });
      add({ id: 'lit-line', type: 'line', source: 'litWays', minzoom: 13, filter: lit(1), layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#facc15', 'line-width': zi(13, 1.6, 16, 3.2, 18, 5), 'line-opacity': k, 'line-opacity-transition': still } });
    }
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
    if (!both) for (const id of ['track-ground', 'track-osm-ground', 'path-ground', 'path-osm-ground']) {
      const l = layers.find((x) => x.id === id);
      if (l) add({ ...l, id: `${id}-over` });
    }
    add({
      id: 'uphill-arrow', type: 'symbol', source: 'uphill', minzoom: 14,
      filter: ['>=', ['get', 'grade'], 8],
      layout: { 'symbol-placement': 'line', 'symbol-spacing': zi(14, 45, 18, 90), 'icon-image': 'uphill-arrow', 'icon-size': zi(14, 0.55, 18, 1), 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'map' },
    });
  }

  // House numbers (#1223) from 17, small and quiet, under the places and the labels, so they give way to every other name
  if (!topoBase) add({ id: 'label-housenumber', type: 'symbol', source: 'ofm', 'source-layer': 'housenumber', minzoom: 17, layout: { 'text-field': ['get', 'housenumber'], 'text-font': FONT, 'text-size': 10, 'text-padding': 2 }, paint: { 'text-color': aerialBase ? P.text : s.base === 'night' ? '#9aa1a9' : '#7d7468', 'text-halo-color': P.halo, 'text-halo-width': 1 } });

  // ---- Places / POIs ------------------------------------------------------
  if (s.overlays.pois) {
    // Things you plan an outing around show early; everyday services only up close.
    const outdoor = ['campsite', 'shelter', 'picnic_site', 'drinking_water', 'lodging', 'swimming', 'harbor', 'ranger_station'];
    const minor = ['toilets', 'information', 'attraction', 'bicycle_rental', 'bicycle'];
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
    // car parks (#1219): the named ones from 15.5 and the rest from 17, as OSM's standard map; the tiles can't tell a kerbside one
    poi('poi-parking', 15.5, ['all', ['==', ['get', 'class'], 'parking'], ['has', 'name']]);
    poi('poi-parking-all', 17, ['all', ['==', ['get', 'class'], 'parking'], ['!', ['has', 'name']]]);
    // and a P on each of MML's car parks in Finland from 15, placed before them, so OSM's P on the same car park gives way
    if (vectorFills) add({ id: 'mml-parking-p', type: 'symbol', source: 'mml', 'source-layer': 'liikenne', minzoom: 15, filter: ['all', ['==', ['get', 'kohdeluokka'], 32421], ['==', ['geometry-type'], 'Polygon']], layout: { 'icon-image': 'parking', 'icon-size': hc ? 1.05 : 0.8, 'icon-padding': 12 }, paint: { 'icon-opacity': s.base === 'night' ? 0.85 : 1 } });
  }
  // Shops and food (#1222), a layer of its own: from 17, the tiles' rank first where they crowd; none upstairs or indoors, where
  // a shopping centre's shops would pile up on its roof. Names in OSM's standard map's purple, apart from the outdoor places.
  if (s.overlays.shops) {
    add({
      id: 'poi-shops', type: 'symbol', source: 'ofm', 'source-layer': 'poi', minzoom: 17,
      filter: ['all', ['in', ['get', 'class'], ['literal', ['shop', 'grocery', 'clothing_store', 'alcohol_shop', 'bakery', 'restaurant', 'cafe', 'fast_food', 'bar', 'beer', 'ice_cream', 'pharmacy', 'hairdresser', 'laundry']]],
        ['has', 'name'], ['!', ['has', 'indoor']], ['<=', ['coalesce', ['get', 'level'], 0], 0]],
      layout: {
        'symbol-sort-key': ['get', 'rank'], 'icon-image': ['coalesce', ['image', ['get', 'class']], ['image', 'shop']], 'icon-size': hc ? 1 : 0.75,
        'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': 10.5, 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-optional': true, 'text-max-width': 7,
      },
      // (a light purple on the dark halo of the Night map and the aerial photos, 9.8:1 or more; the dark one on a white halo, 8.1:1)
      paint: { 'text-color': s.base === 'night' || isAerial(s.base) ? '#d6b8e6' : '#7a2e8a', 'text-halo-color': P.halo, 'text-halo-width': 1.2, 'icon-opacity': s.base === 'night' ? 0.85 : 1 },
    });
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
      filter: ['all', ['!=', MTB_IDX, ''], ['in', ['get', 'class'], ['literal', ['path', 'track']]]],
      layout: {
        'symbol-placement': 'line', 'text-pitch-alignment': 'viewport', 'symbol-spacing': zi(14.5, 170, 18, 320),
        'text-field': ['concat', 'S', ['case', ['==', MTB_IDX, '0-'], '0−', ['to-string', ['get', 'mtb_scale']]]],
        'text-font': FONT_B, 'text-size': zi(14.5, 10, 18, 14), 'text-offset': [0, -1.1],
        'text-keep-upright': true, 'text-max-angle': 40, 'text-padding': 1,
      },
      paint: { 'text-color': mtbColor(MTB_IDX, '#ffffff'), 'text-halo-color': '#111111', 'text-halo-width': 1.6 },
    });
  }
  if (s.labelsUp) {
    add({
      id: 'uphill-label', type: 'symbol', source: 'uphill', minzoom: 14.5,
      filter: ['>=', ['get', 'grade'], 6],
      layout: {
        'symbol-placement': 'line', 'text-pitch-alignment': 'viewport', 'symbol-spacing': zi(14.5, 170, 18, 320),
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
    add({ id: 'nm-navline-label', type: 'symbol', source: 'nmLines', minzoom: 13, filter: ['!=', ['get', 'depth'], ''], layout: { 'symbol-placement': 'line-center', 'text-pitch-alignment': 'viewport', 'text-field': ['get', 'depth'], 'text-font': FONT_I, 'text-size': 11, 'text-keep-upright': true }, paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 1.6 } });
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

  // ---- A LIPAS route picked in search or by a tap (drawn at any zoom, until its card closes), and the one under the
  // mouse (its feature state in the route's own source: every part of it shares its LIPAS id; hover.js sets it)
  const pickColor = ['match', ['get', 'type'], ...Object.entries(LIPAS_TYPES).filter(([k]) => +k > 4000).flatMap(([k, v]) => [+k, v.color]), '#555'];
  for (const [id, source, opacity] of [['lipas-pick', 'lipasPick', (o) => o], ['lipas-hover', 'lipasRoutes', (o) => ['case', ['boolean', ['feature-state', 'hover'], false], o, 0]]]) {
    add({ id: `${id}-casing`, type: 'line', source, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': zi(6, 4, 14, 9, 18, 13), 'line-opacity': opacity(0.9) } });
    add({ id, type: 'line', source, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': pickColor, 'line-width': zi(6, 2, 14, 5, 18, 8), 'line-opacity': opacity(1) } });
  }

  // ---- Imported tracks & the planned route (always on top) --------------
  add({ id: 'tracks-casing', type: 'line', source: 'tracks', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': zi(8, 4, 16, 9), 'line-opacity': 0.8 } });
  add({ id: 'tracks', type: 'line', source: 'tracks', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#7c3aed', 'line-width': zi(8, 2, 16, 5) } });

  // a point the route couldn't reach: a thin dashed line to it (planner.js drawRoute)
  add({ id: 'route-gap', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'gap'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#64748b', 'line-width': zi(8, 1, 16, 2), 'line-dasharray': [1, 2] } });
  // the short cut through a way marked private or closed that the route goes round: dashed, in the private dots' purple
  add({ id: 'access-cut', type: 'line', source: 'accessCut', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': aerialBase || s.base === 'night' ? '#c4b5fd' : '#7c3aed', 'line-width': zi(8, 3, 16, 6), 'line-dasharray': [1.5, 1.2] } });
  // other ways for a leg (#95, #211): drawn like the route where they leave it (the same width,
  // white casing and glow), in their own colour, under it; the one under the pointer brighter.
  // A tap takes one (planner.js pickAlt); their labels are further up
  const altLine = ['==', ['get', 'kind'], 'line'];
  const altLit = (on, off) => ['case', ['boolean', ['feature-state', 'hover'], false], on, off];
  add({ id: 'route-alts-glow', type: 'line', source: 'routeAlts', filter: altLine, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': zi(8, 12, 16, 26), 'line-blur': zi(8, 5, 16, 11), 'line-opacity': altLit(0.55, 0.3), 'line-opacity-transition': { duration: 150, delay: 0 } } });
  add({ id: 'route-alts-casing', type: 'line', source: 'routeAlts', filter: altLine, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': zi(8, 5, 16, 11), 'line-opacity': 0.9 } });
  add({ id: 'route-alts-line', type: 'line', source: 'routeAlts', filter: altLine, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': zi(8, 3, 16, 6.5), 'line-opacity': altLit(1, 0.75), 'line-opacity-transition': { duration: 150, delay: 0 } } });
  // the route's glow (#198): a soft halo in its colour so it stands out on a busy map, and a
  // brighter one on the leg under the pointer (ctx.hoverLeg, set while you point at it)
  const routeGlowColor = ['case', ['==', ['get', 'mode'], 'water'], ROUTE_COLORS.water, ROUTE_COLORS.route];
  const legColor = ['case', ['==', ['get', 'mode'], 'water'], ROUTE_COLORS.water, ['==', ['get', 'mode'], 'line'], ROUTE_COLORS.line, ROUTE_COLORS.route];
  const dim = routeDim((ctx.data.routeLit || EMPTY).features.length > 0);
  // an edge that stands out on the map: dark on the light maps, white on the night map and the aerial photos. A leg over water has it
  // too on the light maps, where its white one is lost on the sea's pale blue (#611); a leg over land keeps the white one
  const darkMap = aerialBase || s.base === 'night';
  const edge = darkMap ? '#ffffff' : '#111827';
  const glowable = ['all', ['!=', ['get', 'kind'], 'gap'], ['!', ['boolean', ['get', 'loading'], false]]];
  add({ id: 'route-glow', type: 'line', source: 'route', filter: glowable, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': routeGlowColor, 'line-width': zi(8, 12, 16, 26), 'line-blur': zi(8, 5, 16, 11), 'line-opacity': dim['route-glow'], 'line-opacity-transition': { duration: 0, delay: 0 } } });
  // fades in and out in 150 ms (a hover, often seen: short and soft)
  add({ id: 'route-glow-hover', type: 'line', source: 'route', filter: glowable, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': routeGlowColor, 'line-width': zi(8, 16, 16, 34), 'line-blur': zi(8, 6, 16, 13), 'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.55, 0], 'line-opacity-transition': { duration: 150, delay: 0 } } });
  add({ id: 'route-casing', type: 'line', source: 'route', filter: ['!=', ['get', 'kind'], 'gap'], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': darkMap ? '#ffffff' : ['case', ['==', ['get', 'mode'], 'water'], edge, '#ffffff'], 'line-width': zi(8, 5, 16, 11), 'line-opacity': dim['route-casing'], 'line-opacity-transition': { duration: 0, delay: 0 } } });
  add({
    id: 'route-line', type: 'line', source: 'route', filter: ['all', ['!=', ['get', 'kind'], 'portage'], ['!=', ['get', 'kind'], 'gap']],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['case', ['get', 'loading'], ROUTE_COLORS.loading, legColor],
      'line-width': zi(8, 3, 16, 6.5),
      'line-opacity': dim['route-line'], 'line-opacity-transition': { duration: 0, delay: 0 },
      'line-dasharray': ['case', ['get', 'loading'], ['literal', [1, 1.5]], ['==', ['get', 'mode'], 'line'], ['literal', [2.5, 1.2]], ['literal', [1, 0]]],
    },
  });
  add({ id: 'route-color', type: 'line', source: 'routeColor', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': zi(8, 3, 16, 6.5), 'line-opacity': dim['route-color'], 'line-opacity-transition': { duration: 0, delay: 0 } } });
  // the stretch you pick or point at (a leg, a stretch, a climb, an item of Check; planner.js litLeg): drawn over the
  // route, wider, in its leg's colour, with an edge that stands out on the map, while the rest of the route fades;
  // under the carries' dots and Not checked's dashes, which stay on it
  add({ id: 'route-lit-casing', type: 'line', source: 'routeLit', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': edge, 'line-width': zi(8, 9, 16, 17) } });
  add({ id: 'route-lit', type: 'line', source: 'routeLit', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': legColor, 'line-width': zi(8, 5, 16, 10) } });
  add({ id: 'route-portage', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'portage'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ea580c', 'line-width': zi(8, 3, 16, 6.5), 'line-dasharray': [0.1, 1.8] } });
  // a stretch a source didn't cover (25d part 3): dashed over the line in Not checked's colour
  add({ id: 'route-unchecked', type: 'line', source: 'headsGaps', layout: { 'line-cap': 'butt' }, paint: { 'line-color': WARN_COLORS.unk, 'line-width': zi(8, 3, 16, 6.5), 'line-dasharray': [1.2, 1.2] } });
  add({ id: 'route-preview-casing', type: 'line', source: 'routePreview', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': edge, 'line-width': zi(8, 9, 16, 15) } });
  add({ id: 'route-preview', type: 'line', source: 'routePreview', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': zi(8, 5, 16, 9) } });
  // what a tap picked (#574): a soft dark shadow, a white casing and its colours, so it reads apart from the red route
  add({ id: 'pick-area-fill', type: 'fill', source: 'pickArea', paint: { 'fill-color': '#111827', 'fill-opacity': 0.06 } });
  add({ id: 'pick-area-casing', type: 'line', source: 'pickArea', layout: { 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.9 } });
  add({ id: 'pick-area-line', type: 'line', source: 'pickArea', layout: { 'line-join': 'round' }, paint: { 'line-color': '#111827', 'line-width': 2.5 } });
  for (const [src, w] of [['pickSide', 0.75], ['pick', 1]]) {
    add({ id: `${src}-shadow`, type: 'line', source: src, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#0b1220', 'line-width': zi(10, 9 * w, 16, 20 * w), 'line-blur': zi(10, 3, 16, 6), 'line-opacity': 0.35 } });
    add({ id: `${src}-casing`, type: 'line', source: src, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': zi(10, 6 * w, 16, 13 * w) } });
    add({ id: `${src}-line`, type: 'line', source: src, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': ['coalesce', ['get', 'color'], '#374151'], 'line-width': zi(10, 3.5 * w, 16, 7.5 * w) } });
  }
  add({ id: 'pick-ring', type: 'circle', source: 'pickRing', paint: { 'circle-radius': 13, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#111827', 'circle-stroke-width': 3 } });
  // static arrows: hidden while the moving chevrons show the way instead (js/routeflow.js, ctx.flowMoving)
  add({ id: 'route-arrows', type: 'symbol', source: 'route', minzoom: 12, filter: ['all', ['!', ['get', 'loading']], ['!=', ['get', 'kind'], 'gap']], layout: { visibility: ctx.flowMoving ? 'none' : 'visible', 'symbol-placement': 'line', 'symbol-spacing': 110, 'icon-image': 'route-arrow', 'icon-size': 0.7, 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'map' } });
  add({
    id: 'route-wind', type: 'symbol', source: 'routeWind',
    layout: { 'icon-image': 'wind-arrow', 'icon-rotate': ['get', 'rot'], 'icon-rotation-alignment': 'map', 'icon-size': ['get', 'size'], 'icon-allow-overlap': true, 'icon-ignore-placement': true },
    paint: { 'icon-color': ['get', 'color'], 'icon-halo-color': '#111827', 'icon-halo-width': 1.5 },
  });
  // round-trip candidates (planner): the one you're looking at wider and on top
  add({ id: 'loops-casing', type: 'line', source: 'loops', layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['case', ['get', 'on'], 1, 0] }, paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, ['case', ['get', 'on'], 6, 4], 16, ['case', ['get', 'on'], 12, 8]], 'line-opacity': 0.9 } });
  add({ id: 'loops-line', type: 'line', source: 'loops', layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['case', ['get', 'on'], 1, 0] }, paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 8, ['case', ['get', 'on'], 3.5, 2], 16, ['case', ['get', 'on'], 7, 4]], 'line-opacity': ['case', ['get', 'on'], 1, 0.7] } });
  // distance marks: distance and arrival on the first line, elapsed time below
  add({ id: 'route-marks-dot', type: 'circle', source: 'routeMarks', minzoom: 9, paint: { 'circle-radius': zi(9, 2.5, 16, 4), 'circle-color': '#ffffff', 'circle-stroke-color': '#111827', 'circle-stroke-width': 1.5 } });
  add({
    id: 'route-marks', type: 'symbol', source: 'routeMarks', minzoom: 9,
    layout: { 'text-field': ['get', 'label'], 'text-font': FONT_B, 'text-size': 11, 'text-anchor': 'left', 'text-offset': [0.7, 0], 'text-padding': 4, 'text-optional': true, 'text-max-width': 18, 'text-justify': 'left' },
    paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
  });
  // the labels of the other ways for a leg (#95, #211): what it is, its length and trails; over
  // everything, distance marks too (they step aside), always shown. Under them the route's own label, in the same form, so the two
  // compare: it moves to a side of its line where it doesn't cover theirs, and gives way if
  // there's no room
  const altLabel = { 'text-field': ['get', 'label'], 'text-font': FONT_B, 'text-size': 12.5, 'text-line-height': 1.25 };
  const altLabelPaint = { 'text-color': ['get', 'color'], 'text-halo-color': '#ffffff', 'text-halo-width': 2.5 };
  add({ id: 'route-alts-label-route', type: 'symbol', source: 'routeAlts', filter: ['all', ['==', ['get', 'kind'], 'label'], ['boolean', ['get', 'route'], false]],
    layout: { ...altLabel, 'text-variable-anchor': ['bottom', 'top', 'left', 'right', 'bottom-left', 'bottom-right', 'top-left', 'top-right'], 'text-radial-offset': 1.1, 'text-justify': 'auto', 'text-padding': 3 },
    paint: altLabelPaint });
  add({ id: 'route-alts-label', type: 'symbol', source: 'routeAlts', filter: ['all', ['==', ['get', 'kind'], 'label'], ['!', ['boolean', ['get', 'route'], false]]],
    layout: { ...altLabel, 'text-offset': [0, -1.6], 'text-allow-overlap': true },
    paint: altLabelPaint });
  // Check's markers (25d part 3) [jc-peek, jc-worst, jc-step]: above the route and its glow (#198), so the glow never washes
  // them out; merged ones with their count; the open one ringed, its obstacle's icon above it whatever Layers says (#85)
  const sevImg = ['match', ['get', 'sev'], 3, warnMarkId('read'), 2, warnMarkId('not'), warnMarkId('look')];
  add({ id: 'heads-icon', type: 'symbol', source: 'heads', layout: { 'icon-image': ['coalesce', ['get', 'img'], sevImg], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'symbol-sort-key': ['get', 'sev'] } });
  add({ id: 'heads-count', type: 'symbol', source: 'heads', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': FONT_B, 'text-size': 12.5, 'text-offset': [1.2, -1], 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': WARN_COLORS.ink, 'text-halo-color': WARN_COLORS.surface, 'text-halo-width': 2.5 } });
  // (the route's hover point above the markers, under the open one: a tap on it leaves no dot on its sign)
  add({ id: 'route-hover', type: 'circle', source: 'routeHover', paint: { 'circle-radius': 7, 'circle-color': '#111827', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } });
  add({ id: 'heads-ring', type: 'circle', source: 'headsOn', filter: ['==', ['get', 'kind'], 'item'], paint: { 'circle-radius': 21, 'circle-color': WARN_COLORS.surface, 'circle-stroke-color': WARN_COLORS.ink, 'circle-stroke-width': 3 } });
  add({ id: 'heads-on-icon', type: 'symbol', source: 'headsOn', layout: { 'icon-image': ['get', 'img'], 'icon-size': ['case', ['==', ['get', 'kind'], 'item'], 1.25, 1], 'icon-anchor': ['case', ['==', ['get', 'kind'], 'obstacle'], 'bottom', 'center'], 'icon-offset': ['case', ['==', ['get', 'kind'], 'obstacle'], ['literal', [0, -22]], ['literal', [0, 0]]], 'icon-allow-overlap': true, 'icon-ignore-placement': true } });

  const style = {
    version: 8,
    name: 'Polku',
    sprite: OFM_SPRITE,
    glyphs: OFM_GLYPHS,
    sources,
    layers,
  };
  if (s.terrain3d) {
    if (raised) style.terrain = { source: 'terrain', exaggeration: s.exaggeration || 1.5 };
    const sky = ctx.skyAt ? ctx.skyAt() : { alt: 30, az: 180, wx: null }; // (the first style, before the timeline: day)
    const [top, horizon] = SKIES[skyOf(sky, s.base === 'night')], wet = sky.wx === 'rain' || sky.wx === 'snow';
    style.sky = { 'sky-color': top, 'horizon-color': horizon, 'fog-color': horizon, 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': wet ? 0.35 : 0.85 };
    // the buildings lit from where the sun is while it's up, from straight above when it's down: never from the
    // camera, as MapLibre's own light is (the hillshade keeps its own light: #642)
    style.light = { anchor: 'map', position: sky.alt > 0 ? [1.15, sky.az, Math.min(85, 90 - sky.alt)] : [1.15, 0, 0] };
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
  if (wx.snow && d.wxSnow) {
    sources.wxSnow = { type: 'image', url: d.wxSnow.url, coordinates: d.wxSnow.coordinates };
    layers.push({ id: 'wx-snow', type: 'raster', source: 'wxSnow', paint: { 'raster-opacity': op('wx:snow', 0.5), 'raster-resampling': 'linear', 'raster-fade-duration': 0 } });
  }
  if (wx.cloud && d.wxCloud) { // (under the rain)
    sources.wxCloud = { type: 'image', url: d.wxCloud.url, coordinates: d.wxCloud.coordinates };
    layers.push({ id: 'wx-cloud', type: 'raster', source: 'wxCloud', paint: { 'raster-opacity': 1, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } });
  }
  // the forecast's thunder (#182): a light amber area with a dashed edge, a forecast's
  if (wx.thunder && d.wxThunderArea) {
    sources.wxThunderArea = { type: 'image', url: d.wxThunderArea.url, coordinates: d.wxThunderArea.coordinates };
    layers.push({ id: 'wx-thunder-area', type: 'raster', source: 'wxThunderArea', paint: { 'raster-opacity': 1, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } });
    layers.push({ id: 'wx-thunder-edge', type: 'line', source: 'wxThunder', paint: { 'line-color': isAerial(s.base) || s.base === 'night' ? '#fbbf24' : '#b45309', 'line-width': 1.6, 'line-dasharray': [3, 2] } });
  }
  if (wx.rain && d.wxRain) {
    sources.wxRain = { type: 'image', url: d.wxRain.url, coordinates: d.wxRain.coordinates };
    layers.push({ id: 'wx-rain', type: 'raster', source: 'wxRain', paint: { 'raster-opacity': op('wx:rain', 0.55), 'raster-resampling': 'linear', 'raster-fade-duration': 0 } });
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
    layers.push({ id: 'wx-radar-fi', type: 'raster', source: 'wxRadarFi', paint: { 'raster-opacity': op('wx:rain', 0.55), 'raster-resampling': 'linear', 'raster-fade-duration': 0 } });
  }
  // where no radar reaches, at Now: hatched (#182, js/wxmap.js)
  if (wx.rain && d.wxNoRadar) {
    sources.wxNoRadar = { type: 'image', url: d.wxNoRadar.url, coordinates: d.wxNoRadar.coordinates };
    layers.push({ id: 'wx-noradar', type: 'raster', source: 'wxNoRadar', paint: { 'raster-opacity': 1, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } });
  }
}

function addRasterOverlays(s, sources, layers, slot) {
  for (const [id, o] of Object.entries(RASTER_OVERLAYS)) {
    if (o.slot !== slot || !s.overlays[id] || (o.winter && !s.winterOn)) continue;
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
  const mmlTerrain = !aerial && !mmlBase; // the bases with MML's terrain (the `mml` source)
  const plainHalo = darkBase ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.85)';
  const roadsDim = isWater(act) ? 0.55 : 1;
  const k = hc ? 1.35 : 1;
  const trail = s.base === 'trail';
  const roadCase = trail ? '#817a6d' : P.roadCase;

  const roadStops = {
    motorway: [6, 0.8, 12, 3, 18, 22],
    trunk: [6, 0.6, 12, 2.6, 18, 20],
    primary: [7, 0.5, 12, 2.2, 18, 18],
    secondary: [8, 0.4, 12, 1.8, 18, 16],
    tertiary: [9, 0.4, 12, 1.4, 18, 14],
    minor: [11, 0.3, 14, trail ? 2.2 : 1.8, 18, 11],
    service: [13, 0.3, 15, trail ? 1.6 : 1.4, 18, 7],
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
  // MTB-graded footways keep their trail halo, even with explicit bicycle permission.
  const cyclingPath = ['any', ['==', ['get', 'subclass'], 'cycleway'], ['all',
    ['in', ['get', 'subclass'], ['literal', ['footway', 'pedestrian']]],
    ['in', ['get', 'bicycle'], ['literal', ['yes', 'designated']]], ['!', ['has', 'mtb_scale']]]];
  const noBike = ['==', ['get', 'bicycle'], 'no'];
  // Access restrictions (#1162): everyone's, in any sport, while the Layers choice is on; each mark's shape says whose.
  const accessOn = !!s.overlays.access;
  const allows = (mode) => ['in', ['coalesce', ['get', mode], ''], ['literal', ['yes', 'designated', 'permissive']]];
  const closed = ['in', ['get', 'access'], ['literal', ['no', 'private']]];
  // no bikes: bicycle=no, or closed to all but people on foot; a way closed to people on foot too is No entry instead
  const noBikeMark = ['any', ['all', noBike, ['any', ['!', closed], allows('foot')]], ['all', closed, allows('foot'), ['!', allows('bicycle')]]];
  // No bikes (#1137): short red bars across the line, the trail's halo wide plus 2 px a side,
  // drawn over the centre line, so the marks beside the line (overgrown, wet, private) keep their sides.
  const noBikeBars = (id, source, filter, maxzoom = 24) => {
    if (!accessOn) return;
    const bar = (halo) => (source === 'trailWays' ? ['+', ['*', halo, ['get', 'wf']], 4] : halo + 4);
    add({
      id, type: 'line', source, ...(source === 'trailWays' ? {} : { 'source-layer': 'transportation' }), minzoom: 13.3, maxzoom,
      filter: ['all', filter, ['!=', ['get', 'subclass'], 'footway']],
      paint: {
        'line-color': '#ff003c',
        'line-width': zi(14, bar(4 * k), 16, bar(7 * k), 18, bar(12 * k)),
        // in bar lengths: a quarter of one thick, two apart (thicker in high contrast)
        'line-dasharray': hc ? [0.35, 2] : [0.25, 2],
        'line-opacity': zi(13.3, 0, 14, ['case', ['==', ['get', 'brunnel'], 'tunnel'], 0.3, 1]),
      },
    });
  };

  for (const brunnel of ['tunnel', 'ground', 'bridge']) {
    const bf = brunnel === 'ground'
      ? ['!', ['in', ['get', 'brunnel'], ['literal', ['tunnel', 'bridge']]]]
      : ['==', ['get', 'brunnel'], brunnel];
    const op = (brunnel === 'tunnel' ? 0.5 : 1) * roadsDim;
    // Bridges (#1218): a dark edge, as OSM's standard map's and MML's black bridges: the roads' casing from zoom 14, and from 15 a
    // line 1 px outside the band of paths, footways, cycle paths and tracks (its gap is the band's width); decks mapped as areas
    // in the ground's colour with the edge, under the bridge's ways
    const bridged = brunnel === 'bridge' && !aerial && !mmlBase;
    const bridgeEdge = (id, src, filter, band) => bridged && add({ id, type: 'line', ...src, minzoom: 15, filter, paint: { 'line-color': P.bridge, 'line-width': 1, 'line-gap-width': band, 'line-opacity': roadsDim } });
    if (bridged) add({ id: 'bridge-deck', type: 'fill', source: 'ofm', 'source-layer': 'transportation', minzoom: 15, filter: ['all', ['==', ['get', 'class'], 'bridge'], ['==', ['geometry-type'], 'Polygon']], paint: { 'fill-color': P.bg, 'fill-outline-color': P.bridge } });
    // in a tunnel, footways, steps and paths at half strength, as cycle paths
    const tun = brunnel === 'tunnel' ? 0.5 : 1;

    // casings
    for (const cls of ['service', 'minor', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway']) {
      if (aerial && (cls === 'service')) continue;
      const casingColor = gravel ? ['case', unpaved, '#c4842d', roadCase] : roadCase;
      add({
        id: `road-${brunnel}-${cls}-casing`, type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: roadMin[cls],
        filter: ['all', ['==', ['get', 'class'], cls], bf],
        layout: { 'line-join': 'round', 'line-cap': brunnel === 'ground' ? 'round' : 'butt' },
        paint: {
          'line-color': aerial ? 'rgba(0,0,0,0.5)' : brunnel === 'bridge' ? ['step', ['zoom'], casingColor, 14, P.bridge] : casingColor,
          'line-width': trail && !gravel && cls === 'minor' ? ze(1.4, 11, 0.6, 14, 3.6, 18, 14.85)
            : trail && !gravel && cls === 'service' ? ze(1.4, 13, 0.6, 15, 2.7, 18, 9.45)
            : gravel && cls !== 'motorway' && cls !== 'trunk'
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

    // Tracks (forest roads, metsäautotie-ish): long dashes like the Finnish terrain map. OpenFreeMap's zoom 13
    // tiles hold only some, so from 13 to 14 the trail details draw them inside their tiles (#1128), and the
    // tiles' own are hidden there (a filter's zoom is the tile's); from 14 the tiles draw them all.
    const trackLayers = (id, source, filter, idx, zooms = {}) => {
      const src = source === 'trailWays' ? { source } : { source, 'source-layer': 'transportation' };
      const haloW = zi(11, 2, 14, 4 * k, 16, 7 * k, 18, 12 * k);
      if (!zooms.maxzoom) bridgeEdge(`${id}-edge`, src, filter, haloW);
      add({
        id: `${id}-halo`, type: 'line', ...src, minzoom: 11, ...zooms, filter,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': diffOn
            ? mtbColor(idx, plainHalo)
            : gravel ? (darkBase ? '#8a5a22' : '#e9b56c') : plainHalo,
          'line-width': haloW,
          'line-opacity': (diffOn ? 0.9 * trailColorOpacity(s, 'down') : gravel ? 0.9 : 0.7) * roadsDim,
        },
      });
      add({
        id, type: 'line', ...src, minzoom: 10, ...zooms, filter,
        paint: {
          'line-color': P.track,
          'line-width': zi(10, 0.6, 14, 1.4 * k, 16, 2.6 * k, 18, 4.5 * k),
          'line-dasharray': [5, 1.4],
          'line-opacity': zi(10, 0, 10.5, 0.8 * roadsDim, 14, roadsDim),
        },
      });
      noBikeBars(`${id}-nobike`, source, ['all', filter, noBikeMark], zooms.maxzoom);
    };
    const isTrack = ['all', ['==', ['get', 'class'], 'track'], bf];
    trackLayers(`track-${brunnel}`, 'ofmTrails', covered ? ['all', isTrack, ['!', ['all', ['<', ['zoom'], 14], ['within', ctx.trailCoverage]]]] : isTrack, MTB_IDX);
    if (s.trailDetails) trackLayers(`track-osm-${brunnel}`, 'trailWays', isTrack, ['get', 'mtb'], { minzoom: 13, maxzoom: 14 });

    // Paths: a difficulty-coloured halo (MTB) under a black dashed centre line.
    // With trail details on, the trails inside the loaded detail tiles are
    // drawn from OSM instead (below), so they're hidden from the tiles there.
    const trailSet = ['any', ['in', ['coalesce', ['get', 'subclass'], 'path'], ['literal', ['path', 'bridleway']]], ['all', ['in', ['get', 'subclass'], ['literal', ['footway', 'steps']]], ['has', 'mtb_scale']]];
    const trailFilter = ['all', isPathClass, ['in', ['coalesce', ['get', 'subclass'], 'path'], ['literal', TRAIL_SUB]], ['!', cyclingPath], bf,
      ...(covered ? [['!', ['all', trailSet, ['within', ctx.trailCoverage]]]] : [])];
    const noFoot = ['==', ['get', 'foot'], 'no'];
    const sidewalkish = ['all', ['in', ['get', 'subclass'], ['literal', ['footway', 'pedestrian']]], ['!', ['has', 'mtb_scale']]];
    const haloOf = (idx) => (diffOn ? mtbColor(idx, plainHalo) : footAct ? (darkBase ? 'rgba(255,170,110,0.32)' : 'rgba(255,214,170,0.95)') : plainHalo);
    const haloOpacity0 = [
      'case',
      bikeAct ? noBike : noFoot, 0.25,
      isWater(act) || roadBike ? 0.5 : 0.95,
    ];
    // difficulty colours fade with their slider; the plain halo doesn't
    const haloOpacity = diffOn && trailColorOpacity(s, 'down') !== 1 ? ['*', haloOpacity0, trailColorOpacity(s, 'down')] : haloOpacity0;
    // widths per zoom, times a per-trail factor (1 for the tiles; the trail's width class for OSM)
    const times = (v, f) => (f === 1 ? v : ['*', v, f]);
    const haloW = (f) => zi(12, times(2.2, f), 14, times(4 * k, f), 16, times(7 * k, f), 18, times(12 * k, f));
    const centreW = (f) => zi(12, times(0.6 * k, f), 14, times(1.15 * k, f), 16, times(1.8 * k, f), 18, times(3 * k, f));
    const centreColor = footAct && !aerial ? '#b42318' : P.path;
    const centreOpacity = isWater(act) || roadBike ? 0.6 : 1;
    // Footways and pedestrian streets (#1163): a thin brown dashed line, on the Trail map on a white band 1 px wider a side, apart from trails.
    const footColor = darkBase ? '#d6725c' : '#a2381f';
    const footW = hc ? ze(1.2, 12, 0.9, 14, 2.5, 16, 4, 18, 6) : ze(1.2, 12, 0.8, 14, 1.5, 16, 2.5, 18, 4);
    const footBandW = hc ? ze(1.2, 14, 4.5, 16, 6, 18, 8) : ze(1.2, 14, 3.5, 16, 4.5, 18, 6);
    bridgeEdge(`path-${brunnel}-foot-edge`, { source: 'ofmTrails', 'source-layer': 'transportation' }, ['all', trailFilter, sidewalkish], trail ? footBandW : footW);
    if (trail && brunnel !== 'tunnel') add({
      id: `path-${brunnel}-foot-casing`, type: 'line', source: 'ofmTrails', 'source-layer': 'transportation', minzoom: 12,
      filter: ['all', trailFilter, sidewalkish],
      paint: {
        'line-color': '#ffffff',
        'line-width': footBandW,
        'line-opacity': brunnel === 'ground' ? zi(13, 0, 14, centreOpacity) : centreOpacity,
      },
    });
    add({
      id: `path-${brunnel}-foot`, type: 'line', source: 'ofmTrails', 'source-layer': 'transportation', minzoom: 12,
      filter: ['all', trailFilter, sidewalkish],
      paint: {
        'line-color': footColor,
        'line-width': footW,
        'line-dasharray': [1.5, 0.7],
        'line-opacity': centreOpacity * tun,
      },
    });
    // Steps without an MTB grade: a wide brown ladder, so they stand out from the footways.
    const steps = ['all', ['==', ['get', 'subclass'], 'steps'], ['!', ['has', 'mtb_scale']]];
    add({
      id: `path-${brunnel}-steps`, type: 'line', source: 'ofmTrails', 'source-layer': 'transportation', minzoom: 13,
      filter: ['all', trailFilter, steps],
      paint: {
        'line-color': footColor,
        'line-width': hc ? ze(1.2, 14, 4, 16, 9) : ze(1.2, 14, 3, 17, 9),
        'line-dasharray': hc ? [0.4, 0.4] : [0.2, 0.2],
        'line-opacity': centreOpacity * tun,
      },
    });
    const pathFilter = ['all', trailFilter, ['!', sidewalkish], ['!', steps]];
    bridgeEdge(`path-${brunnel}-edge`, { source: 'ofmTrails', 'source-layer': 'transportation' }, pathFilter, haloW(1));
    add({
      id: `path-${brunnel}-halo`, type: 'line', source: 'ofmTrails', 'source-layer': 'transportation', minzoom: 12,
      filter: pathFilter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': haloOf(MTB_IDX), 'line-width': haloW(1), 'line-opacity': tun === 1 ? haloOpacity : ['*', haloOpacity, tun] },
    });
    add({
      id: `path-${brunnel}`, type: 'line', source: 'ofmTrails', 'source-layer': 'transportation', minzoom: 12,
      filter: pathFilter,
      paint: {
        'line-color': centreColor,
        'line-width': centreW(1),
        'line-dasharray': ['match', ['get', 'subclass'], 'steps', ['literal', [0.4, 0.4]], ['literal', [2.4, 1.3]]],
        'line-opacity': centreOpacity * tun,
      },
    });
    noBikeBars(`path-${brunnel}-nobike`, 'ofmTrails', ['all', trailFilter, noBikeMark]);
    // The same trails from OSM, in the Trailmap / JOSM language: the band is as
    // wide as the trail, faint trails get a dotted centre line, and the barely
    // visible ones only their colour.
    if (s.trailDetails) {
      const vis = ['get', 'vis'];
      const osmFilter = ['all', ['==', ['get', 'trail'], true], bf];
      bridgeEdge(`path-osm-${brunnel}-edge`, { source: 'trailWays' }, osmFilter, haloW(['get', 'wf']));
      add({
        id: `path-osm-${brunnel}-halo`, type: 'line', source: 'trailWays', minzoom: 12,
        filter: osmFilter,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': haloOf(['get', 'mtb']),
          'line-width': haloW(['get', 'wf']),
          'line-opacity': ['*', haloOpacity, ['match', vis, 1, 0.9 * tun, 2, 0.75 * tun, 3, 0.55 * tun, tun]],
        },
      });
      add({
        id: `path-osm-${brunnel}`, type: 'line', source: 'trailWays', minzoom: 12,
        filter: osmFilter,
        paint: {
          'line-color': centreColor,
          'line-width': centreW(['get', 'cf']),
          'line-dasharray': ['case', ['==', ['get', 'subclass'], 'steps'], ['literal', [0.4, 0.4]], ['>=', vis, 1], ['literal', [0.6, 1.6]], ['literal', [2.4, 1.3]]],
          'line-opacity': ['case', ['>=', vis, 3], 0, centreOpacity * tun],
        },
      });
      noBikeBars(`path-osm-${brunnel}-nobike`, 'trailWays', ['all', osmFilter, noBikeMark]);
    }
    // Cycling infrastructure: surface patterns use only the tiles' known coarse class.
    const surfaceWidth = (paved, rough) => ['case', unpaved, rough, paved];
    // Shared stops preserve the two exponential surface curves; avoid duplicate zoom stops.
    const paved17 = 1.8 + (6 - 1.8) * (1.2 ** 3 - 1) / (1.2 ** 4 - 1);
    const cycleWidth = !trail ? zi(12, 1.4 * k, 14, 3 * k * (roadBike ? 1.5 : 1), 16, 5.5 * k * (roadBike ? 1.5 : 1), 18, 9 * k * (roadBike ? 1.4 : 1))
      : brunnel === 'tunnel' ? ze(1.2, 14, 1.5, 16, 2.5, 18, 6)
      : hc ? ze(1.2, 12, surfaceWidth(1.5, 2), 14, surfaceWidth(2.5, 3), 16, surfaceWidth(4, 5), 18, 10)
      : brunnel === 'bridge' ? ze(1.2, 14, surfaceWidth(1.5, 2), 16, surfaceWidth(2.5, 3.5), 18, 6)
      : ze(1.2, 12, surfaceWidth(1.5, 2), 14, surfaceWidth(1.8, 2.4), 17, surfaceWidth(paved17, 6), 18, 6);
    const cycleBand = brunnel === 'bridge'
      ? hc ? ze(1.2, 14, 6, 16, 9, 18, 22.5) : ze(1.2, 14, 1.2, 16, 10, 18, 15)
      : hc ? ze(1.2, 14, 2.2, 15, 4, 16, 7, 18, 16) : ze(1.2, 14, 2.2, 15, 3, 16, 6, 18, 12);
    bridgeEdge(`cycleway-${brunnel}-edge`, { source: 'ofm', 'source-layer': 'transportation' }, ['all', isPathClass, cyclingPath, bf], trail ? cycleBand : cycleWidth);
    if (trail && brunnel !== 'tunnel') add({
      id: `cycleway-${brunnel}-casing`, type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 12,
      filter: ['all', isPathClass, cyclingPath, bf],
      paint: {
        'line-color': '#ffffff',
        'line-width': cycleBand,
        'line-opacity': brunnel === 'ground' ? zi(13, 0, 14, roadsDim) : roadsDim,
      },
    });
    add({
      id: `cycleway-${brunnel}`, type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 12,
      filter: ['all', isPathClass, cyclingPath, bf],
      paint: {
        'line-color': aerial ? '#bfe0ff' : trail ? (hc && brunnel !== 'tunnel' ? '#001bc7' : '#3148d8') : P.cycleway,
        'line-dasharray': trail && brunnel === 'tunnel' ? [6, 1.5] : ['match', ['get', 'surface'], 'paved', ['literal', [6, 1.5]], 'unpaved', ['literal', [1, trail && (hc || brunnel === 'bridge') ? 0.8 : 0.5]], ['literal', [2.5, 1.5]]],
        'line-width': cycleWidth,
        'line-opacity': (trail ? (brunnel === 'tunnel' ? 0.5 : 1) : 0.85) * roadsDim,
      },
    });
    noBikeBars(`cycleway-${brunnel}-nobike`, 'ofm', ['all', isPathClass, cyclingPath, bf, noBikeMark]);
  }

  // One-way streets (#1217): the water's flow arrow along the street from zoom 16, the way traffic goes (the tiles' oneway: 1
  // along the line, -1 against it), giving way to names; on one-way cycle paths in their blue. For traffic: the tiles have no
  // oneway:bicycle, which a way's card says. None on parking aisles or driveways, which would fill a car park with arrows.
  if (!aerial && !mmlBase) {
    const arrow = (id, filter, colour) => add({
      id, type: 'symbol', source: 'ofm', 'source-layer': 'transportation', minzoom: 16,
      filter: ['all', ['in', ['get', 'oneway'], ['literal', [1, -1]]], ['!', ['in', ['coalesce', ['get', 'service'], ''], ['literal', ['parking_aisle', 'driveway']]]], filter],
      layout: {
        'symbol-placement': 'line', 'symbol-spacing': 200, 'icon-image': `flow-${colour.slice(1)}-${P.halo.slice(1)}`, 'icon-rotate': ['match', ['get', 'oneway'], -1, 180, 0],
        'icon-rotation-alignment': 'map', 'icon-size': zi(16, 0.85, 18, 1.15), 'icon-padding': 0,
      },
      paint: { 'icon-opacity': roadsDim },
    });
    arrow('road-oneway', ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']]], P.oneway);
    arrow('cycleway-oneway', ['all', isPathClass, cyclingPath], P.onewayBike);
  }

  // Ways marked private or closed for your sport (#104): purple dots beside the line. The tiles fold access=private into access=no; the
  // sport's own yes wins (a footway closed to cars is open on foot), and on foot, foot=no.
  // Routes keep off them, so this is why a route goes round. It says what the map says, not
  // the law: Finnish private roads and apartment-block yards are open on foot and by bike.
  if (accessOn) {
    // No entry (closed to people on foot and on bikes): purple dots on both sides; no walking only: on one side
    const noEntry = ['all', closed, ['!', allows('foot')], ['!', allows('bicycle')]];
    const noWalk = ['any', ['==', ['get', 'foot'], 'no'], ['all', closed, ['!', allows('foot')], allows('bicycle')]];
    const dots = (id, filter, sign) => add({
      id, type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 14,
      filter: ['all', ['in', ['get', 'class'], ['literal', ['path', 'track', 'service', 'minor', 'tertiary']]], filter],
      paint: { 'line-color': darkBase ? '#c4b5fd' : '#7c3aed', 'line-width': zi(14, 2, 18, 4), 'line-offset': zi(14, sign * 3, 18, sign * 8), 'line-dasharray': [0.4, 1.6] },
    });
    dots('way-noaccess', ['any', noEntry, noWalk], -1);
    dots('way-noaccess-2', noEntry, 1);
  }

  // Trail details beside and on the line: overgrown (green dots) on one side,
  // wet or muddy (blue dots) on the other; fallen trees and fords as icons from
  // zoom 15. Gates and barriers are Access restrictions' (below).
  const tdIcon = { 'icon-size': zi(15, 0.72, 18, 1), 'icon-allow-overlap': true, 'icon-rotation-alignment': 'viewport', 'icon-pitch-alignment': 'viewport' };
  if (s.trailDetails) {
    // fences, walls and hedges (the vector tiles have none): where you can't go through
    // MML's fences and hedges in Finland (#1172) under OSM's, in their look: where both have one, they lie within 1–2 m
    if (mmlTerrain) {
      add({
        id: 'mml-fence', type: 'line', source: 'mml', 'source-layer': 'rakennelma', minzoom: 15, filter: ['in', ['get', 'kohdeluokka'], ['literal', [44211, 44213]]],
        paint: {
          'line-color': ['match', ['get', 'kohdeluokka'], 44213, darkBase ? '#6fbf6f' : '#4d8a3a', darkBase ? '#b0b0b0' : '#545454'],
          'line-width': zi(15, 1, 18, 2.4),
          'line-dasharray': ['match', ['get', 'kohdeluokka'], 44211, ['literal', [2.4, 1.2]], ['literal', [1, 0]]],
        },
      });
    }
    add({
      id: 'td-fence', type: 'line', source: 'trailWays', minzoom: 15, filter: ['has', 'fence'],
      paint: {
        'line-color': ['match', ['get', 'fence'], 'hedge', darkBase ? '#6fbf6f' : '#4d8a3a', 'wall', darkBase ? '#9ca3af' : '#6b7280', darkBase ? '#b0b0b0' : '#545454'],
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
    add({
      id: 'td-way-tree', type: 'symbol', source: 'trailWays', minzoom: 15, filter: ['==', ['get', 'tree'], true],
      layout: { 'symbol-placement': 'line', 'symbol-spacing': zi(15, 70, 18, 140), 'icon-image': 'td-tree', ...tdIcon },
    });
    add({
      id: 'td-way-ford', type: 'symbol', source: 'trailWays', minzoom: 15, filter: ['==', ['get', 'wayford'], true],
      layout: { 'symbol-placement': 'line-center', 'icon-image': 'td-ford', ...tdIcon },
    });
    add({ id: 'td-points', type: 'symbol', source: 'trailPoints', minzoom: 15, filter: ['in', ['get', 'kind'], ['literal', ['tree', 'ford']]], layout: { 'icon-image': ['get', 'icon'], ...tdIcon } });
  }
  // Gates and barriers with Access restrictions (#1232): a mark for each kind, coloured by who may pass (js/trails.js markOf()).
  // Stiles and cycle barriers from 15; gates from 16 (#1221): a town's courtyard gates covered a phone's streets at 15 (130 of
  // 165 marks in Helsinki's centre); at 16 they give way to each other and to names, and from 17 every one is drawn
  if (accessOn) {
    const gate = ['in', ['get', 'kind'], ['literal', ['gate', 'gate-no']]], mark = { 'icon-image': ['get', 'icon'], ...tdIcon };
    // MML's gates in Finland (#1172): points with no say on who may pass, so the plain gate's unmapped mark; under OSM's, giving
    // way to them, as where both have one they lie a few metres apart (0–6 m, 2026-11-21)
    if (mmlTerrain) add({ id: 'mml-gate', type: 'symbol', source: 'mml', 'source-layer': 'rakennelma', minzoom: 16, filter: ['==', ['get', 'kohdeluokka'], 45200], layout: { 'icon-image': 'td-gate-unknown', ...tdIcon, 'icon-allow-overlap': false } });
    add({ id: 'td-barriers', type: 'symbol', source: 'trailPoints', minzoom: 15, filter: ['in', ['get', 'kind'], ['literal', ['stile', 'cycle']]], layout: mark });
    add({ id: 'td-gates', type: 'symbol', source: 'trailPoints', minzoom: 16, maxzoom: 17, filter: gate, layout: { ...mark, 'icon-allow-overlap': false } });
    add({ id: 'td-gates-all', type: 'symbol', source: 'trailPoints', minzoom: 17, filter: gate, layout: mark });
  }
}

// ---------------------------------------------------------------------------
// Labels

function addLabels(s, P, hc, layers) {
  const topo = isTopo(s.base);
  // On the MML rasters only our own overlays get labels; the map has the rest.
  const add = (l) => { if (!topo || /^(contour|lipas)/.test(l.id)) layers.push(l); };
  const halo = { 'text-halo-color': P.halo, 'text-halo-width': hc ? 2 : 1.4, 'text-halo-blur': 0.3 };

  add({ id: 'label-waterway', type: 'symbol', source: 'ofm', 'source-layer': 'waterway', minzoom: 12, filter: ['has', 'name'], layout: { 'symbol-placement': 'line', 'text-pitch-alignment': 'viewport', 'text-field': ['get', 'name'], 'text-font': FONT_I, 'text-size': 11, 'text-letter-spacing': 0.1 }, paint: { 'text-color': P.waterText, ...halo } });
  add({ id: 'label-water', type: 'symbol', source: 'ofm', 'source-layer': 'water_name', minzoom: 6, filter: ['all', ['has', 'name'], ['==', ['geometry-type'], 'Point']], layout: { 'text-field': ['get', 'name'], 'text-font': FONT_I, 'text-size': zi(6, 10, 12, 13, 15, 15), 'text-max-width': 6, 'text-letter-spacing': 0.08 }, paint: { 'text-color': P.waterText, ...halo } });
  add({ id: 'label-water-line', type: 'symbol', source: 'ofm', 'source-layer': 'water_name', minzoom: 6, filter: ['all', ['has', 'name'], ['==', ['geometry-type'], 'LineString']], layout: { 'symbol-placement': 'line', 'text-pitch-alignment': 'viewport', 'text-field': ['get', 'name'], 'text-font': FONT_I, 'text-size': zi(6, 10, 12, 13, 15, 15), 'text-letter-spacing': 0.15 }, paint: { 'text-color': P.waterText, ...halo } });
  add({ id: 'label-park', type: 'symbol', source: 'ofm', 'source-layer': 'park', minzoom: 9, filter: ['all', ['has', 'name'], ['==', ['geometry-type'], 'Point']], layout: { 'text-field': ['get', 'name'], 'text-font': FONT_I, 'text-size': 12, 'text-max-width': 8 }, paint: { 'text-color': isAerial(s.base) ? P.text : '#2f6b2f', ...halo } });
  add({ id: 'label-road', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name', minzoom: 13, filter: ['has', 'name'], layout: { 'symbol-placement': 'line', 'text-pitch-alignment': 'viewport', 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': zi(13, 10, 17, 13), 'text-rotation-alignment': 'map' }, paint: { 'text-color': P.text, ...halo } });
  add({
    id: 'label-peak', type: 'symbol', source: 'ofm', 'source-layer': 'mountain_peak', minzoom: 11,
    // a saddle (#1178) is a pass's mark in the same brown; the tiles have them up to zoom 13
    filter: ['in', ['get', 'class'], ['literal', ['peak', 'saddle']]],
    layout: {
      'icon-image': ['match', ['get', 'class'], 'saddle', 'saddle-6b4b2b', 'triangle_11'], 'icon-size': ['match', ['get', 'class'], 'saddle', 1, 0.75],
      'text-field': ['case', ['has', 'name'], ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'ele']], ' m'], ['concat', ['to-string', ['get', 'ele']], ' m']],
      'text-font': FONT, 'text-size': 11, 'text-offset': [0, 0.8], 'text-anchor': 'top', 'text-optional': true,
    },
    paint: { 'text-color': isAerial(s.base) ? P.text : '#6b4b2b', ...halo },
  });
  if (s.contours && !isTopo(s.base)) {
    add({ id: 'contour-label', type: 'symbol', source: 'contours', 'source-layer': 'contours', minzoom: 13, filter: ['>', ['get', 'level'], 0], layout: { 'symbol-placement': 'line', 'text-pitch-alignment': 'viewport', 'text-field': ['to-string', ['get', 'ele']], 'text-font': FONT, 'text-size': 10, 'symbol-spacing': 350 }, paint: { 'text-color': isAerial(s.base) ? '#ffeccc' : P.contourText, ...halo } });
  }
  if (s.overlays.lipasRoutes) {
    add({ id: 'lipas-route-label', type: 'symbol', source: 'lipasRoutes', minzoom: 13, layout: { 'symbol-placement': 'line', 'text-pitch-alignment': 'viewport', 'text-field': ['get', 'name'], 'text-font': FONT_B, 'text-size': 11, 'symbol-spacing': 400 }, paint: { 'text-color': ['match', ['get', 'type'], ...Object.entries(LIPAS_TYPES).filter(([k]) => +k > 4000).flatMap(([k, v]) => [+k, v.color]), '#444'], ...halo } });
  }
  // city parks' names from 15 (#1220): OSM's parks and gardens are points in the tiles' poi layer, as the park layer holds
  // protected areas only
  add({ id: 'label-city-park', type: 'symbol', source: 'ofm', 'source-layer': 'poi', minzoom: 15, filter: ['all', ['in', ['get', 'class'], ['literal', ['park', 'garden']]], ['has', 'name']], layout: { 'symbol-sort-key': ['get', 'rank'], 'text-field': ['get', 'name'], 'text-font': FONT_I, 'text-size': 12, 'text-max-width': 8 }, paint: { 'text-color': isAerial(s.base) ? P.text : s.base === 'night' ? '#8fd18f' : '#2f6b2f', ...halo } });
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
  if (s.weather && s.weather.snow) {
    // the snow FMI's stations measured: the real thing beside the model's wash
    // (a bare station is a small grey 0: measured, no snow)
    layers.push({ id: 'wx-snow-label', type: 'symbol', source: 'wxLabels', filter: ['==', ['get', 'kind'], 'snowobs'], layout: { 'text-field': ['get', 't'], 'text-font': FONT_B, 'text-size': ['case', ['==', ['get', 'bare'], 1], 10, 12], 'text-padding': 12, 'symbol-sort-key': ['get', 'bare'] }, paint: { 'text-color': ['case', ['==', ['get', 'bare'], 1], '#94a3b8', '#4338ca'], 'text-halo-color': 'rgba(255,255,255,0.95)', 'text-halo-width': 2 } });
  }
  if (s.weather && s.weather.thunder) {
    // FMI's lightning: a cross by its age, over the words; a new one fades in (its feature-state, js/wxmap.js)
    layers.push({ id: 'wx-strikes', type: 'symbol', source: 'wxStrikes', layout: { 'icon-image': ['concat', 'strike-', ['get', 'age']], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'symbol-sort-key': ['get', 'sort'] }, paint: { 'icon-opacity': ['coalesce', ['feature-state', 'a'], 1] } });
  }
  if (s.weather && s.weather.rain) {
    // precipitation amount where it rains, nudged below the °C label
    layers.push({ id: 'wx-rain-label', type: 'symbol', source: 'wxLabels', filter: ['==', ['get', 'kind'], 'rain'], layout: { 'text-field': ['get', 't'], 'text-font': FONT_B, 'text-size': 12, 'text-offset': [0, 1.3], 'text-padding': 20 }, paint: { 'text-color': '#1d4ed8', 'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 2 } });
  }
}
