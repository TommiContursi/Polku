// Trail details from OpenStreetMap: how wide a trail is, how visible it is on
// the ground, overgrown and wet stretches, and what's in the way (fallen trees,
// gates, stiles, cycle barriers, fords). OpenFreeMap's tiles don't carry these,
// so they come from Overpass, one query per z13 tile (about 2.3 km here),
// cached in the browser for a week.
//
// Inside the tiles that have loaded, style.js draws the trails from this data
// instead of the vector tiles (a `within` filter hides the tiles' own trail
// lines there), so a narrow path can look narrow and a faint one faint, in the
// visual language of Trailmap.fi and the MTB-TrailMap JOSM style. The uphill
// layer reads its OSM mtb:scale:uphill tags from the same tiles.

import { lonLatToTile, tileBounds, pointSegment, dist } from './geo.js';
import { cachedOverpass } from './osm.js';

export const TILE_Z = 13;
export const MIN_ZOOM = 14; // tiles load from here; loaded ones still draw down to z13
const RETRY = 120e3; // a failed tile is left alone for 2 minutes
const MAX_VIEW = 12; // more tiles than this in view: zoomed out too far to load
const MAX_KEPT = 80;
const WAY_KEEP = ['highway', 'barrier', 'width', 'trail_visibility', 'obstacle', 'smoothness', 'sac_scale', 'informal', 'ford', 'surface', 'bridge', 'tunnel',
  'mtb:scale', 'mtb:scale:uphill', 'bicycle', 'foot', 'horse', 'access', 'name'];
const NODE_KEEP = ['barrier', 'obstacle', 'ford', 'access', 'bicycle', 'foot', 'locked', 'name'];

// What you'd have to stop for, cross or go round: the barrier values drawn as icons
const BARRIER_NODES = 'gate|lift_gate|swing_gate|sliding_gate|wicket_gate|hampshire_gate|bump_gate|chain|rope|bar|block|stile|kissing_gate|turnstile'
  + '|horse_stile|full-height_turnstile|cycle_barrier|motorcycle_barrier|log|fallen_tree|windfall|debris';

// Every trail (so the map can draw them all from OSM), the tracks, footways and
// cycleways that have something worth showing, fences, walls and hedges, and
// the gates, stiles, fallen trees and fords anywhere in the tile (a gate is as
// often on a service road or in a fence as on a trail).
export function tileQuery(x, y) {
  const [w, s, e, n] = tileBounds(x, y, TILE_Z);
  const bb = `${s.toFixed(6)},${w.toFixed(6)},${n.toFixed(6)},${e.toFixed(6)}`;
  return `[out:json][timeout:25];way[highway~"^(path|bridleway|steps|footway|track|cycleway)$"](${bb})->.all;`
    + '(way.all[highway~"^(path|bridleway|steps)$"];way.all[highway=footway]["mtb:scale"];'
    + 'way.all[~"^(obstacle|ford|mtb:scale:uphill)$"~"."];way.all[surface=mud];way.all[highway=track][trail_visibility];'
    + `way[barrier~"^(fence|wall|hedge|city_wall)$"](${bb}););out tags geom qt;`
    + `(node[barrier~"^(${BARRIER_NODES})$"](${bb});node[obstacle](${bb});node[ford][ford!=no](${bb}););out qt;`;
}

const pick = (t = {}, keys) => {
  const o = {};
  for (const k of keys) if (t[k] != null) o[k] = t[k];
  return o;
};

/** Overpass's answer, cut to what's drawn and shown (and stored). */
export function slimTile(json) {
  // a query that ran out of time or memory answers 200 with a remark and partial data: that's a failure,
  // or the tile would hide the map's own trails with too few of its own
  if (json.remark && /error|timed out|out of memory/i.test(json.remark)) throw new Error(`Overpass: ${json.remark}`);
  const w = [], n = [];
  for (const el of json.elements || []) {
    if (el.type === 'way' && el.geometry) w.push([el.id, pick(el.tags, WAY_KEEP), el.geometry.flatMap((p) => [+p.lon.toFixed(6), +p.lat.toFixed(6)])]);
    else if (el.type === 'node') n.push([el.id, +el.lon.toFixed(6), +el.lat.toFixed(6), pick(el.tags, NODE_KEEP)]);
  }
  return { v: 1, w, n };
}

// ---------------------------------------------------------------- tiles
const tiles = new Map(); // "x/y" -> { promise, data }
const failed = new Map(); // "x/y" -> retry after (ms)
const listeners = new Set();
let fetching = true, failing = false;
/** Tests and screenshots: never ask Overpass (tiles come from seedTile; asking for any other fails quietly, or
 * with `fail`, as if Overpass didn't answer). */
export function holdFetches(on = true, fail = false) { fetching = !on; failing = on && fail; }
/** Retry: ask again now for the tiles that failed, not in a couple of minutes. */
export function forgetFailures() { failed.clear(); }
const arrived = (key) => { for (const fn of listeners) fn(key); };
export const onTile = (fn) => listeners.add(fn);

/** One z13 tile of trail details (from the browser's cache when it's fresh). */
export function trailTile(x, y) {
  const key = `${x}/${y}`;
  const have = tiles.get(key);
  if (have && (have.data || fetching)) return have.promise; // (held, one on its way counts as held)
  if (!fetching) return Promise.reject(failing ? new Error('Overpass didn’t answer') : Object.assign(new Error('held'), { held: true })); // (held: whatever it did before, as a test asks)
  if ((failed.get(key) || 0) > Date.now()) return Promise.reject(new Error('Overpass busy'));
  const entry = { data: null };
  entry.promise = cachedOverpass(`trails2/${TILE_Z}/${key}`, tileQuery(x, y), slimTile, { timeoutMs: 30000 })
    .then((data) => { entry.data = data; arrived(key); return data; })
    .catch((err) => { tiles.delete(key); failed.set(key, Date.now() + RETRY); throw err; });
  tiles.set(key, entry);
  // keep memory bounded: forget the oldest loaded tiles (IndexedDB still has them)
  if (tiles.size > MAX_KEPT) for (const [k, t] of tiles) { if (tiles.size <= MAX_KEPT) break; if (t.data) tiles.delete(k); }
  return entry.promise;
}

export const loadedTile = (x, y) => (tiles.get(`${x}/${y}`) || {}).data || null;

/** Put a tile in place without asking Overpass (tests and screenshots, from a recorded answer). */
export function seedTile(x, y, json) {
  const data = json.v ? json : slimTile(json);
  tiles.set(`${x}/${y}`, { promise: Promise.resolve(data), data });
  failed.delete(`${x}/${y}`);
  arrived(`${x}/${y}`);
}

/** The z13 tiles covering a bounding box [w, s, e, n]. */
export function tilesIn([w, s, e, n]) {
  const [x0, y0] = lonLatToTile(w, n, TILE_Z).map(Math.floor);
  const [x1, y1] = lonLatToTile(e, s, TILE_Z).map(Math.floor);
  const out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([x, y]);
  return out;
}

// ---------------------------------------------------------------- what the tags mean
// metres, from "0.5", "0,5", "50 cm", "1 m", "0.3-0.5" (the first number)
function metres(v) {
  if (v == null) return NaN;
  const s = String(v).replace(',', '.');
  const m = s.match(/\d+(\.\d+)?/);
  if (!m) return NaN;
  let x = parseFloat(m[0]);
  if (/cm/.test(s)) x /= 100;
  else if (/mm/.test(s)) x /= 1000;
  else if (x > 15) x /= 100; // bare centimetres
  return x;
}
/** 0 narrow (< 0.6 m), 1 usual (0.6–0.9 m, or not tagged), 2 wide (0.9–1.8 m), 3 very wide (≥ 1.8 m): the Trailmap guide's classes. */
export function widthClass(t) {
  const m = metres(t.width);
  if (!Number.isFinite(m)) return 1;
  return m < 0.6 ? 0 : m < 0.9 ? 1 : m < 1.8 ? 2 : 3;
}
const VIS = { excellent: 0, good: 0, intermediate: 1, medium: 1, moderate: 1, bad: 2, poor: 2, low: 2, horrible: 3, very_bad: 3, no: 3 };
/** 0 clear (or not tagged), 1 faint in places (intermediate), 2 hard to see (bad), 3 barely or not visible (horrible, no). */
export const visClass = (t) => VIS[String(t.trail_visibility || '').toLowerCase()] ?? 0;
export const VIS_TEXT = ['clear', 'faint in places', 'hard to see', 'barely visible'];

const mtbIdx = (v) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n >= 0 && n <= 6 ? n : -1;
};
const obstacles = (t) => String(t.obstacle || '').toLowerCase();
const yes = (v) => v != null && v !== 'no';
// the trails style.js draws from OSM (the same set it hides from the vector tiles)
const isTrail = (t) => ['path', 'bridleway', 'steps'].includes(t.highway) || (t.highway === 'footway' && t['mtb:scale'] != null);

/** What's on a node, as an icon: tree, gate, gate-no, stile, cycle, ford (or null). */
export function obstacleKind(t) {
  const b = t.barrier;
  if (/fallen.?trees?/.test(obstacles(t)) || ['log', 'fallen_tree', 'windfall', 'debris'].includes(b)) return 'tree';
  if (['stile', 'kissing_gate', 'turnstile', 'horse_stile', 'full-height_turnstile'].includes(b)) return 'stile';
  if (['cycle_barrier', 'motorcycle_barrier'].includes(b)) return 'cycle';
  if (['gate', 'lift_gate', 'swing_gate', 'sliding_gate', 'wicket_gate', 'hampshire_gate', 'bump_gate', 'chain', 'rope', 'bar', 'block'].includes(b)) {
    return ['no', 'private'].includes(t.access) || t.locked === 'yes' ? 'gate-no' : 'gate';
  }
  if (yes(t.ford)) return 'ford';
  return null;
}

// width factors for the halo (band) and the dashed centre line
const HALO_W = [0.62, 1, 1.32, 1.6];
const CENTRE_W = [0.8, 1, 1.35, 1.6];

function wayFeature(id, t, flat) {
  const coords = [];
  for (let i = 0; i < flat.length; i += 2) coords.push([flat[i], flat[i + 1]]);
  const o = obstacles(t);
  const w = widthClass(t);
  const track = t.highway === 'track';
  const props = {
    // the vector tiles' own names, so hover, click and the uphill grade treat these like tile trails
    class: track ? 'track' : 'path', subclass: t.highway, mtb_scale: t['mtb:scale'], surface: t.surface, bicycle: t.bicycle, foot: t.foot, horse: t.horse,
    brunnel: yes(t.bridge) ? 'bridge' : yes(t.tunnel) ? 'tunnel' : undefined,
    osm: id, trail: isTrail(t), mtb: mtbIdx(t['mtb:scale']),
    w, vis: visClass(t), wf: track ? 1 : HALO_W[w], cf: CENTRE_W[w],
    veg: /vegetation/.test(o), mud: t.surface === 'mud' || /mud/.test(o), tree: /fallen.?trees?/.test(o), wayford: yes(t.ford),
    boardwalk: t.bridge === 'boardwalk',
    width: t.width, tv: t.trail_visibility, smooth: t.smoothness, sac: t.sac_scale, informal: t.informal === 'yes', name: t.name,
  };
  // no undefined values: MapLibre's `has` would count them as there
  for (const k of Object.keys(props)) if (props[k] === undefined) delete props[k];
  return { type: 'Feature', id, geometry: { type: 'LineString', coordinates: coords }, properties: props };
}

// fences, walls and hedges: just the line (style.js draws them from zoom 15)
function fenceFeature(id, t, flat) {
  const coords = [];
  for (let i = 0; i < flat.length; i += 2) coords.push([flat[i], flat[i + 1]]);
  return { type: 'Feature', id, geometry: { type: 'LineString', coordinates: coords }, properties: { osm: id, fence: t.barrier === 'city_wall' ? 'wall' : t.barrier } };
}

const built = new WeakMap(); // tile data -> its features
function featuresOf(data) {
  let f = built.get(data);
  if (!f) {
    f = {
      ways: data.w.map(([id, t, g]) => (t.highway ? wayFeature(id, t, g) : fenceFeature(id, t, g))),
      points: data.n.map(([id, lon, lat, t]) => ({ id, kind: obstacleKind(t), lon, lat, t })).filter((p) => p.kind).map((p) => ({
        type: 'Feature', id: p.id, geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: { osm: p.id, kind: p.kind, barrier: p.t.barrier, obstacle: p.t.obstacle, ford: p.t.ford, access: p.t.access, name: p.t.name },
      })),
    };
    built.set(data, f);
  }
  return f;
}

// ---------------------------------------------------------------- the layer
export class TrailDetails {
  /**
   * @param {object} app onData(ways, points) for the map sources; onCoverage(multiPolygon|null)
   *   when the area drawn from OSM changes; onBusy() when Overpass fails.
   */
  constructor(map, app) {
    this.map = map;
    this.app = app;
    this.enabled = false;
    this.shown = null;
    this.timer = 0;
    map.on('moveend', () => this.schedule());
    onTile(() => this.schedule(60));
  }

  setEnabled(on) {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) this.schedule(0);
    else this.publish([]);
  }

  schedule(ms = 300) {
    if (!this.enabled) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.update(), ms);
  }

  update() {
    if (!this.enabled) return;
    const map = this.map;
    const z = map.getZoom();
    // below zoom 13 the details don't show anyway: the map's own trails are enough there. And no tiles are listed:
    // the world on a phone at zoom 1 is millions, 0.4 s and 840 MB on every move (#667)
    if (z < 13) { this.publish([]); return; }
    const b = map.getBounds();
    const want = tilesIn([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    if (z >= MIN_ZOOM && want.length <= MAX_VIEW) {
      for (const [x, y] of want) {
        if (!loadedTile(x, y)) trailTile(x, y).catch((err) => { if (!err.held && this.app.onBusy) this.app.onBusy(); });
      }
    }
    this.publish(want.filter(([x, y]) => loadedTile(x, y)).slice(0, 24));
  }

  publish(list) {
    const key = list.map((t) => t.join('/')).join(';');
    if (key === this.shown) return;
    this.shown = key;
    const ways = new Map(), points = new Map();
    for (const [x, y] of list) {
      const f = featuresOf(loadedTile(x, y));
      for (const w of f.ways) ways.set(w.id, w); // a way crossing tiles comes once
      for (const p of f.points) points.set(p.id, p);
    }
    this.app.onData({ type: 'FeatureCollection', features: [...ways.values()] }, { type: 'FeatureCollection', features: [...points.values()] });
    this.app.onCoverage(list.length ? {
      type: 'MultiPolygon',
      coordinates: list.map(([x, y]) => {
        const [w, s, e, n] = tileBounds(x, y, TILE_Z);
        return [[[w, s], [e, s], [e, n], [w, n], [w, s]]];
      }),
    } : null);
  }
}

// ---------------------------------------------------------------- in words (hover and click)
const GATE_NAME = { lift_gate: 'Boom barrier', chain: 'Chain across', rope: 'Rope across', block: 'Blocks across', bar: 'Bar across', swing_gate: 'Swing gate', wicket_gate: 'Small gate', sliding_gate: 'Sliding gate' };
/** An obstacle feature (a node, or a way with fallen trees or a ford) as a title and a short note. */
export function obstacleText(p, bike = false) {
  if (p.kind == null) {
    return p.tree ? { title: 'Fallen trees on this trail', note: 'Mapped in OpenStreetMap: they may have been cleared since' }
      : { title: 'Ford', note: 'No bridge: the trail crosses the water' };
  }
  switch (p.kind) {
    case 'tree': return { title: p.barrier === 'log' ? 'Log across the trail' : 'Fallen tree', note: 'Mapped in OpenStreetMap: it may have been cleared since' };
    case 'gate': return { title: GATE_NAME[p.barrier] || 'Gate', note: bike ? 'You may need to stop or lift the bike' : '' };
    case 'gate-no': return { title: `${GATE_NAME[p.barrier] || 'Gate'}: no access`, note: `access=${p.access || 'no'} · locked or private` };
    case 'stile': return { title: p.barrier === 'kissing_gate' ? 'Kissing gate' : p.barrier === 'turnstile' ? 'Turnstile' : 'Stile', note: bike ? 'Lift the bike over or through' : 'Step over or through' };
    case 'cycle': return { title: 'Cycle barrier', note: bike ? 'Slow down: staggered bars, you may need to walk through' : 'Staggered bars' };
    case 'ford': return { title: p.ford === 'stepping_stones' ? 'Stepping stones' : 'Ford', note: 'No bridge: expect wet feet' };
    default: return { title: 'Obstacle', note: '' };
  }
}

/** A trail's details as short phrases ("0.4 m wide", "hard to see", "overgrown"…). */
export function detailBits(p) {
  const width = p.width != null ? `${String(p.width).trim()}${/[a-z]/i.test(String(p.width)) ? '' : ' m'} wide` : '';
  return [width, p.vis ? VIS_TEXT[p.vis] : '', p.veg ? 'overgrown' : '', p.mud ? 'wet or muddy' : '', p.tree ? 'fallen trees' : '',
    p.boardwalk ? 'boardwalk' : '', p.wayford ? 'ford' : ''].filter(Boolean);
}

// ---------------------------------------------------------------- along a route
const bearing = (a, b) => (Math.atan2((b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), b[1] - a[1]) * 180) / Math.PI;
const skew = (x, y) => { const d = Math.abs(((x - y) % 180 + 180) % 180); return Math.min(d, 180 - d); }; // 0 parallel … 90 crossing
const CELL = 0.0005; // degrees: about 55 × 25 m here

/**
 * What OSM has along a route beyond the router's tags: width (BRouter has no
 * width), fallen trees and other obstacles mapped as points (its node table
 * has no `obstacle`), and visibility, overgrown and wet stretches where the
 * router said nothing (a Valhalla leg, a route saved before). From the same
 * z13 tiles the map draws; fills `a.td` (js/analysis.js) in place. False when
 * the route crosses too many tiles or none would load. `a.tdLost`: where along
 * the route the tiles that didn't answer lie, as [at, len] stretches, or null.
 */
export async function detailsAlong(a, { maxTiles = 40 } = {}) {
  const { pts, along, td } = a;
  if (!td) return false;
  const want = new Map();
  for (let i = 0; i < pts.length; i += 2) {
    const [x, y] = lonLatToTile(pts[i][0], pts[i][1], TILE_Z).map(Math.floor);
    want.set(`${x}/${y}`, [x, y]);
  }
  if (want.size > maxTiles) return false;
  const got = await Promise.allSettled([...want.values()].map(([x, y]) => trailTile(x, y)));
  const loaded = got.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  // the tiles that didn't answer (a test's held ones aren't asked): where they lie along the route
  const keys = [...want.keys()], lost = new Set(keys.filter((k, j) => got[j].status === 'rejected' && !(got[j].reason || {}).held));
  a.tdLost = null;
  if (lost.size) {
    a.tdLost = [];
    let s0 = -1;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = lonLatToTile(pts[i][0], pts[i][1], TILE_Z).map(Math.floor);
      if (lost.has(`${x}/${y}`)) { if (s0 < 0) s0 = Math.max(0, i - 1); } else if (s0 >= 0) { a.tdLost.push([along[s0], along[i] - along[s0]]); s0 = -1; }
    }
    if (s0 >= 0) a.tdLost.push([along[s0], along[pts.length - 1] - along[s0]]);
  }
  if (!loaded.length) return false;

  // the tiles' ways as segments in a grid, and their obstacle nodes
  const grid = new Map();
  const cell = (lon, lat) => `${Math.floor(lon / CELL)},${Math.floor(lat / CELL)}`;
  const seenWay = new Set(), seenNode = new Set(), nodes = [];
  for (const d of loaded) {
    for (const [id, t, flat] of d.w) {
      if (!t.highway || seenWay.has(id)) continue;
      seenWay.add(id);
      for (let j = 2; j < flat.length; j += 2) {
        const p0 = [flat[j - 2], flat[j - 1]], p1 = [flat[j], flat[j + 1]];
        const seg = { p0, p1, t, ang: bearing(p0, p1) };
        const x0 = Math.floor(Math.min(p0[0], p1[0]) / CELL), x1 = Math.floor(Math.max(p0[0], p1[0]) / CELL);
        const y0 = Math.floor(Math.min(p0[1], p1[1]) / CELL), y1 = Math.floor(Math.max(p0[1], p1[1]) / CELL);
        if ((x1 - x0 + 1) * (y1 - y0 + 1) > 36) continue; // a stray long segment
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
          const k = `${x},${y}`;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(seg);
        }
      }
    }
    for (const [id, lon, lat, t] of d.n) {
      if (seenNode.has(id)) continue;
      seenNode.add(id);
      const kind = obstacleKind(t);
      if (kind && kind !== 'gate') nodes.push({ ll: [lon, lat], kind, barrier: t.barrier, ford: t.ford, access: t.access, obstacle: t.obstacle, osm: id });
    }
  }

  // each sample to the way it runs along (within 5 m, roughly the same way)
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const at = a.attr[i] || {};
    if (at.mode === 'water' || at.mode === 'line') continue;
    const dir = bearing(pts[Math.max(0, i - 1)], pts[Math.min(n - 1, i + 1)]);
    const cx = Math.floor(pts[i][0] / CELL), cy = Math.floor(pts[i][1] / CELL);
    let best = null, bd = 5;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const seg of grid.get(`${cx + dx},${cy + dy}`) || []) {
        if (skew(dir, seg.ang) > 35) continue;
        const d = pointSegment(pts[i], seg.p0, seg.p1).d;
        if (d < bd) { bd = d; best = seg; }
      }
    }
    if (!best) continue;
    const t = best.t;
    // the router's way type wins: a road beside a muddy footway stays a dry road
    const hw = at.tags && at.tags.highway;
    if (hw && hw !== t.highway) continue;
    if (['path', 'bridleway', 'footway', 'steps'].includes(t.highway)) {
      td.trail[i] = 1;
      if (td.width[i] < 0) td.width[i] = t.width != null ? widthClass(t) : -1;
      if (td.vis[i] < 0) td.vis[i] = t.trail_visibility != null ? visClass(t) : -1;
    }
    const o = obstacles(t);
    if (/vegetation/.test(o)) td.veg[i] = 1;
    if (t.surface === 'mud' || /mud/.test(o)) td.mud[i] = 1;
    if (/fallen.?trees?/.test(o)) td.tree[i] = 1;
    if (t.bridge === 'boardwalk') td.boardwalk[i] = 1;
  }

  // obstacle nodes within 10 m of the route, unless the router already reported the same kind there
  const sgrid = new Map();
  for (let i = 0; i < n; i++) {
    const k = cell(pts[i][0], pts[i][1]);
    if (!sgrid.has(k)) sgrid.set(k, []);
    sgrid.get(k).push(i);
  }
  for (const nd of nodes) {
    const cx = Math.floor(nd.ll[0] / CELL), cy = Math.floor(nd.ll[1] / CELL);
    let bi = -1, bd = 10;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const i of sgrid.get(`${cx + dx},${cy + dy}`) || []) {
        const d = pointSegment(nd.ll, pts[i], pts[Math.min(n - 1, i + 1)]).d;
        if (d < bd) { bd = d; bi = i; }
      }
    }
    // the router may have reported the same node (barrier=log): one place, one heads-up, with
    // the node's OSM id (so the heads-up can link to it)
    if (bi < 0) continue;
    const same = td.points.find((p) => p.kind === nd.kind && p.ll && dist(p.ll, nd.ll) < 15);
    if (same) { same.osm ||= nd.osm; continue; }
    td.points.push({ i: bi, at: along[bi], ll: nd.ll, kind: nd.kind, barrier: nd.barrier, ford: nd.ford, access: nd.access, osm: nd.osm });
  }
  td.points.sort((p, q) => p.at - q.at);
  return true;
}
