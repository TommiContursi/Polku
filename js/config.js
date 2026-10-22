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

// group: bike / foot / water (winter sports will be a "snow" group). It decides
// the map style flavour, the warnings and which timing model applies.
// BRouter: Run and Trail run use hiking-mountain, which keeps to footways,
// cycleways and paths in town (trekking, a bike profile, sent a city run 39 %
// along main roads); a tuned running profile can come with route preferences.
export const ACTIVITIES = {
  mtb: {
    label: 'MTB',
    line: 'Trails by MTB difficulty · MTB routes', // what the map shows for it, in the sport menus
    group: 'bike',
    brouter: 'mtb',
    mode: 'auto',
    lipas: { routes: [4411, 4412, 4405], points: [301, 206, 302] },
  },
  gravel: {
    label: 'Gravel',
    line: 'Unpaved roads highlighted · gravel routing',
    group: 'bike',
    brouter: 'gravel',
    mode: 'auto',
    lipas: { routes: [4412], points: [301, 206] },
  },
  road: {
    label: 'Road cycling',
    line: 'Paved, quieter roads · road works',
    group: 'bike',
    brouter: 'fastbike-lowtraffic',
    mode: 'auto',
    lipas: { routes: [4412], points: [206] },
  },
  hike: {
    label: 'Hike',
    line: 'Paths, hiking trails and huts',
    group: 'foot',
    brouter: 'hiking-mountain',
    mode: 'auto',
    lipas: { routes: [4405, 4404, 4403], points: [301, 302, 304, 206, 202, 204] },
  },
  trailrun: {
    label: 'Trail run',
    line: 'Paths and trails · running times',
    group: 'foot',
    brouter: 'hiking-mountain',
    mode: 'auto',
    lipas: { routes: [4405, 4404, 4401], points: [301, 302, 206] },
  },
  run: {
    label: 'Run',
    line: 'Footways and lit fitness trails',
    group: 'foot',
    brouter: 'hiking-mountain',
    mode: 'auto',
    lipas: { routes: [4401, 4403, 4406], points: [] },
  },
  paddle: {
    label: 'Paddle',
    line: 'Water routing · depths, marks and ships',
    group: 'water',
    brouter: 'river',
    mode: 'water',
    lipas: { routes: [4451, 4452], points: [205, 301, 206, 202, 203] },
  },
  // open water: the water router near the shore; land between swims on foot (swimrun)
  swim: {
    label: 'Swim',
    line: 'Near the shore · beaches',
    group: 'water',
    brouter: 'hiking-mountain',
    mode: 'water',
    lipas: { routes: [], points: [3220, 3230, 205] },
  },
};
export const groupOf = (a) => (ACTIVITIES[a] || ACTIVITIES.mtb).group;
// each sport's colour where a route mixes them (the profile's Sport colours and strip, the map)
export const SPORT_COLORS = { mtb: '#c2410c', gravel: '#a16207', road: '#b91c1c', hike: '#15803d', trailrun: '#4d7c0f', run: '#0f766e', paddle: '#0369a1', swim: '#6d28d9' };
export const isWater = (a) => groupOf(a) === 'water';
// sports where the uphill-difficulty grades (↑S0–↑S5, from mtb:scale:uphill) mean something
export const OFFROAD_BIKE = new Set(['mtb', 'gravel']);

export const CRAFT = {
  kayak: { label: 'Sea kayak', kmh: 6.5 },
  canoe: { label: 'Canoe', kmh: 5.5 },
  sup: { label: 'SUP', kmh: 4.5 },
};
// The crafts a sport has, by sport, for the places that offer them with the sport (a point's Sport from here, 25d).
// Paddle's only for now; another sport's crafts go here once there's one, with a setting of its own like `craft`.
export const CRAFTS = { paddle: CRAFT };

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
  '↑S0 · Under 10 %, good grip',
  '↑S1 · Under 15 %, few obstacles',
  '↑S2 · Under 20 %, loose stones or roots',
  '↑S3 · Under 25 %, varying surface',
  '↑S4 · Under 30 %, mostly pushing',
  '↑S5 · Over 30 %, carry the bike',
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
  4401: { name: 'Fitness trail (kuntorata, often lit)', color: '#0d9488', layer: 'lipas_4401_kuntorata' },
  4403: { name: 'Walking / outdoor route', color: '#ea580c', layer: 'lipas_4403_kavelyreitti' },
  4404: { name: 'Nature trail', color: '#15803d', layer: 'lipas_4404_luontopolku' },
  4405: { name: 'Hiking route', color: '#dc2626', layer: 'lipas_4405_retkeilyreitti' },
  4406: { name: 'Multi-use route', color: '#9333ea', layer: 'lipas_4406_monikayttoreitti' },
  4411: { name: 'MTB route', color: '#7c3aed', layer: 'lipas_4411_maastopyorailyreitti' },
  4412: { name: 'Cycling route', color: '#2563eb', layer: 'lipas_4412_pyorailyreitti' },
  4451: { name: 'Paddling route', color: '#0284c7', layer: 'lipas_4451_melontareitti' },
  4452: { name: 'Water trekking route', color: '#0369a1', layer: 'lipas_4452_vesiretkeilyreitti' },
  // winter (phase 15): shown while it's winter, so feet and bikes keep off ski tracks
  4402: { name: 'Ski track', color: '#db2777', layer: 'lipas_4402_latu', winter: true },
  4421: { name: 'Snowmobile route', color: '#ea580c', layer: 'lipas_4421_moottorikelkkareitti', winter: true },
  1550: { name: 'Skating route (natural ice)', color: '#7c3aed', layer: 'lipas_1550_luistelureitti', winter: true, route: true },
  301: { name: 'Lean-to / kota', color: '#b45309', icon: 'laavu', layer: 'lipas_301_laavu_kota_kammi' },
  302: { name: 'Wilderness hut', color: '#92400e', icon: 'hut', layer: 'lipas_302_tupa' },
  304: { name: 'Outdoor lodge', color: '#78350f', icon: 'hut', layer: 'lipas_304_ulkoilumaja_hiihtomaja' },
  202: { name: 'Camping site', color: '#166534', icon: 'tent', layer: 'lipas_202_telttailu_ja_leiriytyminen' },
  203: { name: 'Boating service point', color: '#0369a1', icon: 'anchor', layer: 'lipas_203_veneilyn_palvelupaikka' },
  204: { name: 'Nature tower', color: '#4d7c0f', icon: 'tower', layer: 'lipas_204_luontotorni' },
  205: { name: 'Landing place', color: '#0284c7', icon: 'landing', layer: 'lipas_205_rantautumispaikka' },
  206: { name: 'Campfire site', color: '#dc2626', icon: 'fire', layer: 'lipas_206_ruoanlaittopaikka' },
  207: { name: 'Info point', color: '#475569', icon: 'info', layer: 'lipas_207_opastuspiste' },
  3220: { name: 'Beach', color: '#0891b2', icon: 'swim', layer: 'lipas_3220_uimaranta' },
  3230: { name: 'Swimming place', color: '#0e7490', icon: 'swim', layer: 'lipas_3230_uimapaikka' },
  4810: { name: 'Shooting range', color: '#b91c1c', icon: 'target', layer: 'lipas_4810_ampumarata', danger: true },
  4820: { name: 'Shooting sports centre', color: '#b91c1c', icon: 'target', layer: 'lipas_4820_ampumaurheilukeskus', danger: true },
  4840: { name: 'Field archery range', color: '#b91c1c', icon: 'target', layer: 'lipas_4840_jousiammuntamaastorata', danger: true },
};

// ---------------------------------------------------------------------------
// Overlay catalogue (raster). Built-in vector overlays live in style.js.

// LIPAS's lines (routes): the 4xxx types, and the ones marked route (a skating route is 1550)
export const isLipasRoute = (type) => +type > 4000 || !!(LIPAS_TYPES[type] && LIPAS_TYPES[type].route);
export const WINTER_LIPAS = [4402, 1550, 4421];

export const RASTER_OVERLAYS = {
  // FMI's daily Baltic ice charts (Copernicus Marine); open water made clear by winter.js's seaice:// protocol
  seaIce: {
    label: 'Sea ice',
    attribution: 'Sea ice: FMI ice charts, E.U. Copernicus Marine Service',
    tiles: ['seaice://{z}/{x}/{y}'],
    tileSize: 256,
    maxzoom: 8,
    opacity: 0.8,
    slot: 'water',
    winter: true, // only while it's winter
  },
  depthAreas: {
    label: 'Depth areas',
    attribution: '© Traficom nautical chart data (not for navigation)',
    tiles: [wmsTiles(TRAFICOM_WMS, 'DepthArea_A', 'syvyysalue_a')],
    tileSize: 512,
    minzoom: 10,
    opacity: 0.45,
    slot: 'water',
  },
  depthContours: {
    label: 'Depth contours',
    attribution: '© Traficom nautical chart data (not for navigation)',
    tiles: [wmsTiles(TRAFICOM_WMS, 'DepthContour_L', 'syvyyskayra')],
    tileSize: 512,
    minzoom: 11,
    opacity: 0.75,
    slot: 'water',
  },
  soundings: {
    label: 'Depth soundings',
    attribution: '© Traficom nautical chart data (not for navigation)',
    tiles: [wmsTiles(TRAFICOM_WMS, 'Sounding_P', 'Syvyyspiste_point')],
    tileSize: 512,
    minzoom: 14,
    opacity: 0.85,
    slot: 'water',
  },
  fairways: {
    label: 'Shipping lanes',
    attribution: '© Traficom nautical chart data (not for navigation)',
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
  { title: 'Water', ids: ['nautical', 'depthAreas', 'depthContours', 'soundings', 'fairways'] },
  { title: 'Marked routes', ids: ['lipasRoutes', 'wmtHiking', 'wmtMtb', 'wmtCycling'] },
  { title: 'Terrain map', ids: ['maastoOverlay'] },
  { title: 'Places', ids: ['lipasPoints', 'pois'] },
  { title: 'Roads (Digiroad)', ids: ['drPaved', 'drPrivate', 'drSpeed'] },
];

// Traffic & safety (see safety.js). Shown as their own Layers section.
export const SAFETY_OVERLAYS = {
  sfTraffic: { label: 'Busy roads (traffic volume)', note: 'Digiroad vehicles/day · zoom 10+' },
  sfIncidents: { label: 'Accidents & incidents', note: 'Fintraffic, live' },
  sfRoadworks: { label: 'Road works', note: 'Fintraffic, at your departure time' },
  sfRoadcond: { label: 'Slippery / poor road conditions', note: 'Fintraffic road weather, 0–12 h forecast' },
  sfShips: { label: 'Ships (live AIS)', note: 'Type colours, names, trails & course · zoom 8+' },
  sfCameras: { label: 'Road weather cameras', note: 'Fintraffic, 800+ cameras · tap for live & 24 h' },
  restricted: { label: 'Military areas & shooting ranges', note: 'OpenStreetMap, LIPAS' },
};

// Defaults per activity; the user's choices are remembered per activity.
export const ACTIVITY_OVERLAYS = {
  // winterWays, lipasWinter and seaIce draw only while it's winter (js/winter.js): on by default where they matter
  mtb: { lipasRoutes: true, lipasPoints: true, pois: true, wmtMtb: false, restricted: true, winterWays: true, lipasWinter: true },
  gravel: { lipasRoutes: false, lipasPoints: true, pois: true, drPaved: false, sfTraffic: true, sfRoadworks: true, sfIncidents: true, sfCameras: true, winterWays: true, lipasWinter: true },
  road: { lipasRoutes: false, lipasPoints: false, pois: false, wmtCycling: true, sfTraffic: true, sfRoadworks: true, sfIncidents: true, sfRoadcond: true, sfCameras: true, winterWays: true },
  hike: { lipasRoutes: true, lipasPoints: true, pois: true, wmtHiking: true, restricted: true, winterWays: true, lipasWinter: true },
  trailrun: { lipasRoutes: true, lipasPoints: true, pois: true, restricted: true, winterWays: true, lipasWinter: true },
  run: { lipasRoutes: true, lipasPoints: false, pois: false, sfRoadworks: true, winterWays: true, lipasWinter: true },
  paddle: { lipasRoutes: true, lipasPoints: true, pois: true, depthAreas: true, depthContours: true, soundings: true, fairways: true, sfShips: true, restricted: true, nautical: true, seaIce: true },
  swim: { lipasRoutes: false, lipasPoints: true, pois: true, depthAreas: true, depthContours: true, fairways: true, sfShips: true, nautical: true, seaIce: true },
};

// ---------------------------------------------------------------------------
// The quick layer drawer (#123): five tiles for each sport, then More (the full Layers panel).
// A tile turns the same switch as in the full panel, so what you choose stays per sport as there.
// Its id says what it turns: an overlay above (per sport), a trail setting (per sport), a weather
// field ('wx:rain'), or the map's own (hillshade, contours, terrain3d); and two that turn more than
// one: trailColors (off, or back to the colours you had) and depths (Traficom's three depth layers).
// 3D terrain has no tile: it has its own button on the map (#226), and its settings are in the full panel.
export const QUICK_TILES = {
  mtb: ['trailColors', 'trailDetails', 'lipasRoutes', 'wmtMtb', 'wx:rain'],
  gravel: ['sfTraffic', 'sfRoadworks', 'drPaved', 'wmtCycling', 'wx:rain'],
  road: ['sfTraffic', 'sfRoadworks', 'sfRoadcond', 'wmtCycling', 'wx:wind'],
  hike: ['wmtHiking', 'lipasRoutes', 'lipasPoints', 'trailDetails', 'wx:rain'],
  trailrun: ['trailColors', 'trailDetails', 'lipasRoutes', 'lipasPoints', 'wx:rain'],
  run: ['lipasRoutes', 'sfRoadworks', 'pois', 'wx:temp', 'wx:rain'],
  paddle: ['nautical', 'depths', 'sfShips', 'lipasPoints', 'wx:wind'],
  swim: ['depths', 'fairways', 'sfShips', 'lipasPoints', 'wx:wind'],
};
export const QUICK_MAX = 5;

// Every tile, in the full panel's groups and order: Edit offers them all. Not offered, as each has its
// own place: the base maps (the drawer's Map row), the timeline (the Weather button), 3D terrain (its
// button on the map), the settings behind a › (the trail colours' kind, opacities) and Depths' three
// switches one by one.
// label: the tile's (soft hyphens, U+00AD, where a long word may break); note: its small print;
// opts: it has a › with more settings; zoom: where its layer starts to show.
export const QUICK_TILE = {
  hillshade: { group: 'Terrain', label: 'Hill­shade', icon: 'mountain' },
  contours: { group: 'Terrain', label: 'Contour lines', icon: 'contours' },
  maastoOverlay: { group: 'Terrain', label: 'Maasto­kartta on top', icon: 'pin', zoom: 8 },
  mmlMaastoOverlay: { group: 'Terrain', label: 'MML terrain map on top', icon: 'pin', mml: true },
  trailColors: { group: 'Trails & difficulty', label: 'Trail colours', icon: 'trailcolors', opts: true },
  trailDetails: { group: 'Trails & difficulty', label: 'Trail details', icon: 'details' },
  labelsDown: { group: 'Trails & difficulty', label: 'Difficulty numbers', icon: 'num', zoom: 15 },
  labelsUp: { group: 'Trails & difficulty', label: 'Uphill numbers', icon: 'num', zoom: 15 },
  winterWays: { group: 'Winter', label: 'Winter ways', icon: 'flake', winter: true },
  lipasWinter: { group: 'Winter', label: 'Ski tracks & snow­mobile routes', icon: 'flake', winter: true },
  seaIce: { group: 'Winter', label: 'Sea ice', icon: 'flake', winter: true },
  'wx:snow': { group: 'Winter', label: 'Snow depth', icon: 'snow' },
  lipasRoutes: { group: 'Marked routes', label: 'Official routes', icon: 'flag', note: 'LIPAS', zoom: 8 },
  wmtHiking: { group: 'Marked routes', label: 'Waymarked hiking', icon: 'sign' },
  wmtMtb: { group: 'Marked routes', label: 'Waymarked MTB', icon: 'sign' },
  wmtCycling: { group: 'Marked routes', label: 'Waymarked cycling', icon: 'sign' },
  lipasPoints: { group: 'Places', label: 'Huts & lean-tos', icon: 'hut', zoom: 10 },
  pois: { group: 'Places', label: 'Outdoor places', icon: 'pin' },
  nautical: { group: 'Water & nautical', label: 'Nautical marks', icon: 'buoy', zoom: 10.5 },
  depths: { group: 'Water & nautical', label: 'Depths', icon: 'depth', opts: true, note: 'Not for navigation', zoom: 10 },
  fairways: { group: 'Water & nautical', label: 'Shipping lanes', icon: 'ship', zoom: 9 },
  sfTraffic: { group: 'Traffic & safety', label: 'Busy roads', icon: 'car', zoom: 10 },
  sfIncidents: { group: 'Traffic & safety', label: 'Accidents & incidents', icon: 'warn' },
  sfRoadworks: { group: 'Traffic & safety', label: 'Road works', icon: 'cone' },
  sfRoadcond: { group: 'Traffic & safety', label: 'Road conditions', icon: 'car' },
  sfShips: { group: 'Traffic & safety', label: 'Ships', icon: 'ship', note: 'Live AIS', zoom: 8 },
  sfCameras: { group: 'Traffic & safety', label: 'Road cameras', icon: 'camera' },
  restricted: { group: 'Traffic & safety', label: 'Military areas', icon: 'zone' },
  drPaved: { group: 'Roads (Digiroad)', label: 'Paved roads', icon: 'road', zoom: 8 },
  drPrivate: { group: 'Roads (Digiroad)', label: 'Private roads', icon: 'road', zoom: 8 },
  drSpeed: { group: 'Roads (Digiroad)', label: 'Speed limits', icon: 'road', zoom: 8 },
  'wx:wind': { group: 'Weather on the map', label: 'Wind', icon: 'wind' },
  'wx:temp': { group: 'Weather on the map', label: 'Tempera­ture', icon: 'temp', opts: true },
  'wx:rain': { group: 'Weather on the map', label: 'Rain radar', icon: 'rain', opts: true },
};
// Places are LIPAS's points for the sport, so the tile says what they are there
export const QUICK_PLACES = { paddle: 'Landing sites & lean-tos', swim: 'Beaches & swimming places', road: 'Campfire sites', gravel: 'Lean-tos & campfire sites' };
