// Data sources, activity profiles and palettes. Everything here is free and keyless,
// except the optional MML layers that need the user's own (free) API key.

export const OFM_TILEJSON = 'https://tiles.openfreemap.org/planet';
export const OFM_SPRITE = 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm';
export const OFM_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

// Mapterhorn terrarium DEM, 512 px tiles. Finland has lidar-derived data to z15.
export const DEM_URL = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
export const DEM_MAXZOOM = 14;
export const DEM_TILESIZE = 512;

export const ESRI_IMAGERY =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const BROUTER = 'https://brouter.de/brouter';
export const PHOTON = 'https://photon.komoot.io/api/';
export const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
export const LIPAS_WFS = 'https://lipas.fi/geoserver/lipas/ows';
export const TRAFICOM_WMS = 'https://julkinen.traficom.fi/inspirepalvelu/rajoitettu/wms';
export const DIGIROAD_WMS = 'https://avoinapi.vaylapilvi.fi/vaylatiedot/digiroad/ows';
export const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

export const mmlTiles = (layer, key) =>
  `https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/${layer}/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.png?api-key=${encodeURIComponent(key)}`;

// Kapsi ry mirrors the National Land Survey maps without an API key.
export const kapsiTiles = (layer) =>
  `https://tiles.kartat.kapsi.fi/${layer}?service=WMS&request=GetMap&format=image%2Fjpeg&version=1.1.1` +
  `&srs=EPSG%3A3857&bbox={bbox-epsg-3857}&width=512&height=512&layers=${layer}`;

export const wmsTiles = (url, layers, styles = '') =>
  `${url}?service=WMS&request=GetMap&version=1.1.1&layers=${encodeURIComponent(layers)}` +
  `&styles=${encodeURIComponent(styles)}&srs=EPSG:3857&bbox={bbox-epsg-3857}` +
  `&width=512&height=512&format=image/png&transparent=true`;

// ---------------------------------------------------------------------------
// Activities

export const ACTIVITIES = {
  mtb: {
    label: 'MTB',
    brouter: 'mtb',
    mode: 'auto',
    lipas: { routes: [4411, 4412, 4405], points: [301, 206, 302] },
  },
  gravel: {
    label: 'Gravel',
    brouter: 'gravel',
    mode: 'auto',
    lipas: { routes: [4412], points: [301, 206] },
  },
  hike: {
    label: 'Hike & run',
    brouter: 'hiking-mountain',
    mode: 'auto',
    lipas: { routes: [4405, 4404, 4403], points: [301, 302, 304, 206, 202, 204] },
  },
  paddle: {
    label: 'Paddle',
    brouter: 'river',
    mode: 'water',
    lipas: { routes: [4451, 4452], points: [205, 301, 206, 202, 203] },
  },
};

export const CRAFT = {
  kayak: { label: 'Sea kayak', kmh: 6.5 },
  canoe: { label: 'Canoe', kmh: 5.5 },
  sup: { label: 'SUP', kmh: 4.5 },
};

// ---------------------------------------------------------------------------
// Difficulty palettes. Same hue ladder for downhill (mtb:scale) and uphill
// (mtb:scale:uphill) so the two views read the same way.

export const DIFF_COLORS = ['#22a447', '#c7c100', '#f59e0b', '#ef4444', '#c026d3', '#7e22ce', '#4c1d95'];

export const MTB_SCALE_TEXT = [
  'S0 · Easy: firm surface, no obstacles',
  'S1 · Small obstacles, roots and stones',
  'S2 · Larger roots and rocks, steps',
  'S3 · Blocky, tight switchbacks, steep',
  'S4 · Very steep, technical, rock gardens',
  'S5 · Extreme: drops, boulders',
  'S6 · Barely rideable',
];

export const UPHILL_TEXT = [
  'U0 · Under 10 %, good grip',
  'U1 · Under 15 %, few obstacles',
  'U2 · Under 20 %, loose stones or roots',
  'U3 · Under 25 %, varying surface',
  'U4 · Under 30 %, mostly pushing',
  'U5 · Over 30 %, carry the bike',
];

// Grade bands for the profile and route-colour mode. [min grade %, colour, label]
export const GRADE_BANDS = [
  [20, '#6d28d9', '20 %+'],
  [15, '#dc2626', '15–20 %'],
  [10, '#f97316', '10–15 %'],
  [6, '#facc15', '6–10 %'],
  [3, '#a3d977', '3–6 %'],
  [-3, '#8fb996', 'flat'],
  [-10, '#7cb7f2', 'down'],
  [-Infinity, '#3b82f6', 'steep down'],
];

export const gradeColor = (g) => GRADE_BANDS.find(([min]) => g >= min)[1];

export const SURFACE_COLORS = {
  paved: '#64748b',
  asphalt: '#64748b',
  concrete: '#64748b',
  paving_stones: '#94a3b8',
  sett: '#94a3b8',
  compacted: '#d4a017',
  fine_gravel: '#e0b84a',
  gravel: '#c58b2b',
  unpaved: '#b07d3a',
  dirt: '#8b5e34',
  ground: '#8b5e34',
  earth: '#8b5e34',
  grass: '#65a30d',
  sand: '#eab308',
  rock: '#57534e',
  wood: '#a16207',
  water: '#0ea5e9',
  unknown: '#cbd5e1',
};

// ---------------------------------------------------------------------------
// LIPAS (national sports & outdoor facility register) feature types

export const LIPAS_TYPES = {
  4403: { name: 'Walking / outdoor route', color: '#ea580c', layer: 'lipas_4403_kavelyreitti' },
  4404: { name: 'Nature trail', color: '#15803d', layer: 'lipas_4404_luontopolku' },
  4405: { name: 'Hiking route', color: '#dc2626', layer: 'lipas_4405_retkeilyreitti' },
  4411: { name: 'MTB route', color: '#7c3aed', layer: 'lipas_4411_maastopyorailyreitti' },
  4412: { name: 'Cycling route', color: '#2563eb', layer: 'lipas_4412_pyorailyreitti' },
  4451: { name: 'Paddling route', color: '#0284c7', layer: 'lipas_4451_melontareitti' },
  4452: { name: 'Water trekking route', color: '#0369a1', layer: 'lipas_4452_vesiretkeilyreitti' },
  301: { name: 'Lean-to / kota', color: '#b45309', icon: 'laavu', layer: 'lipas_301_laavu_kota_kammi' },
  302: { name: 'Wilderness hut', color: '#92400e', icon: 'hut', layer: 'lipas_302_tupa' },
  304: { name: 'Outdoor lodge', color: '#78350f', icon: 'hut', layer: 'lipas_304_ulkoilumaja_hiihtomaja' },
  202: { name: 'Camping site', color: '#166534', icon: 'tent', layer: 'lipas_202_telttailu_ja_leiriytyminen' },
  203: { name: 'Boating service point', color: '#0369a1', icon: 'anchor', layer: 'lipas_203_veneilyn_palvelupaikka' },
  204: { name: 'Nature tower', color: '#4d7c0f', icon: 'tower', layer: 'lipas_204_luontotorni' },
  205: { name: 'Landing place', color: '#0284c7', icon: 'landing', layer: 'lipas_205_rantautumispaikka' },
  206: { name: 'Campfire site', color: '#dc2626', icon: 'fire', layer: 'lipas_206_ruoanlaittopaikka' },
  207: { name: 'Info point', color: '#475569', icon: 'info', layer: 'lipas_207_opastuspiste' },
};

// ---------------------------------------------------------------------------
// Overlay catalogue (raster). Built-in vector overlays live in style.js.

export const RASTER_OVERLAYS = {
  depthAreas: {
    label: 'Depth areas',
    attribution: '© Traficom',
    tiles: [wmsTiles(TRAFICOM_WMS, 'DepthArea_A', 'syvyysalue_a')],
    tileSize: 512,
    minzoom: 10,
    opacity: 0.45,
    slot: 'water',
  },
  depthContours: {
    label: 'Depth contours',
    attribution: '© Traficom',
    tiles: [wmsTiles(TRAFICOM_WMS, 'DepthContour_L', 'syvyyskayra')],
    tileSize: 512,
    minzoom: 11,
    opacity: 0.75,
    slot: 'water',
  },
  soundings: {
    label: 'Depth soundings',
    attribution: '© Traficom',
    tiles: [wmsTiles(TRAFICOM_WMS, 'Sounding_P', 'Syvyyspiste_point')],
    tileSize: 512,
    minzoom: 14,
    opacity: 0.85,
    slot: 'water',
  },
  fairways: {
    label: 'Shipping lanes',
    attribution: '© Traficom',
    tiles: [wmsTiles(TRAFICOM_WMS, 'TwoWayRoutePart_A,DeepWaterRoutePart_A,TrafficSeparationSchemeLanePart_A')],
    tileSize: 512,
    minzoom: 9,
    opacity: 0.55,
    slot: 'water',
  },
  wmtHiking: {
    label: 'Waymarked hiking routes',
    attribution: '© waymarkedtrails.org',
    tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 18,
    opacity: 0.75,
    slot: 'overlay',
  },
  wmtMtb: {
    label: 'Waymarked MTB routes',
    attribution: '© waymarkedtrails.org',
    tiles: ['https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 18,
    opacity: 0.75,
    slot: 'overlay',
  },
  wmtCycling: {
    label: 'Waymarked cycling routes',
    attribution: '© waymarkedtrails.org',
    tiles: ['https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 18,
    opacity: 0.7,
    slot: 'overlay',
  },
  drPaved: {
    label: 'Paved roads',
    attribution: '© Fintraffic / Digiroad',
    tiles: [wmsTiles(DIGIROAD_WMS, 'dr_paallystetty_tie', 'dr_paallystetty_tie')],
    tileSize: 512,
    minzoom: 8,
    opacity: 0.8,
    slot: 'overlay',
  },
  drPrivate: {
    label: 'Private roads (road associations)',
    attribution: '© Fintraffic / Digiroad',
    tiles: [wmsTiles(DIGIROAD_WMS, 'tiekunnalliset_yksityistiet', 'dr_yksityistietieto')],
    tileSize: 512,
    minzoom: 8,
    opacity: 0.8,
    slot: 'overlay',
  },
  drSpeed: {
    label: 'Speed limits',
    attribution: '© Fintraffic / Digiroad',
    tiles: [wmsTiles(DIGIROAD_WMS, 'dr_nopeusrajoitus')],
    tileSize: 512,
    minzoom: 8,
    opacity: 0.8,
    slot: 'overlay',
  },
  maastoOverlay: {
    label: 'Maastokartta (MML, transparent)',
    attribution: '© Maanmittauslaitos, Kapsi ry',
    tiles: [kapsiTiles('peruskartta')],
    tileSize: 512,
    minzoom: 8,
    opacity: 0.4,
    slot: 'overlay',
  },
  mmlMaastoOverlay: {
    label: 'MML terrain map (transparent)',
    attribution: '© Maanmittauslaitos',
    mml: 'maastokartta',
    tileSize: 256,
    maxzoom: 16,
    opacity: 0.35,
    slot: 'overlay',
  },
};

export const OVERLAY_GROUPS = [
  { title: 'Water', ids: ['depthAreas', 'depthContours', 'soundings', 'fairways'] },
  { title: 'Marked routes', ids: ['lipasRoutes', 'wmtHiking', 'wmtMtb', 'wmtCycling'] },
  { title: 'Terrain map', ids: ['maastoOverlay'] },
  { title: 'Places', ids: ['lipasPoints', 'pois'] },
  { title: 'Roads (Digiroad)', ids: ['drPaved', 'drPrivate', 'drSpeed'] },
];

// Defaults per activity; the user's choices are remembered per activity.
export const ACTIVITY_OVERLAYS = {
  mtb: { lipasRoutes: true, lipasPoints: true, pois: true, wmtMtb: false },
  gravel: { lipasRoutes: false, lipasPoints: true, pois: true, drPaved: false },
  hike: { lipasRoutes: true, lipasPoints: true, pois: true, wmtHiking: true },
  paddle: { lipasRoutes: true, lipasPoints: true, pois: true, depthAreas: true, depthContours: true, fairways: true },
};
