// Open-water routing for kayak / canoe / SUP.
//
// Road routers can't cross lakes, so we build our own: a hidden MapLibre map
// renders only the water polygons (white on black) for the leg's area, we read
// the pixels back as a navigability grid, run A* on it and then "string-pull"
// the cell path into straight paddling lines. Land cells are passable at a high
// cost, which yields portages (carries) when there's no water connection.
//
// Phase 13: a second render of the same view draws what else costs: fairway
// areas (shipping lanes are crossed straight, not followed), a clear zone round
// marked dangers and OSM's rocks and shoals, and places you avoid. With a wind,
// each water cell's fetch (open water upwind) gives a wave height, and rough
// water costs more for the craft. String-pulling keeps to the costs too, so a
// straightened line can't cut through a rock's clear zone. See js/waterdata.js
// for the sources (and why depths aren't one of them).

import { OFM_TILEJSON } from './config.js';
import { dist } from './geo.js';
import { waterInputs, lateAnswers, waveHeight, COMFORT_WAVE } from './waterdata.js';

const MAX_PX = 1400;
const MIN_RES_M = 3; // never rasterise finer than this (ground metres per pixel)

let hidden = null;

function waterStyle() {
  return {
    version: 8,
    sources: { ofm: { type: 'vector', url: OFM_TILEJSON } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#000000' } },
      { id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water', filter: ['!=', ['get', 'class'], 'swimming_pool'], paint: { 'fill-color': '#ffffff', 'fill-antialias': false } },
      { id: 'rivers', type: 'line', source: 'ofm', 'source-layer': 'waterway', filter: ['all', ['in', ['get', 'class'], ['literal', ['river', 'canal']]], ['!=', ['get', 'brunnel'], 'tunnel']], paint: { 'line-color': '#ffffff', 'line-width': 3 } },
      // Streams are paddleable sometimes: grey = "marginal" water with extra cost.
      { id: 'streams', type: 'line', source: 'ofm', 'source-layer': 'waterway', filter: ['==', ['get', 'class'], 'stream'], paint: { 'line-color': '#808080', 'line-width': 2 } },
      // Piers and dams block the way.
      { id: 'piers', type: 'line', source: 'ofm', 'source-layer': 'transportation', filter: ['==', ['get', 'class'], 'pier'], paint: { 'line-color': '#000000', 'line-width': 2 } },
    ],
  };
}

// clear zones (m): isolated danger marks, cardinal marks (centred this far to their danger side), OSM points, reef edges
const CLEAR = { danger: 45, cardinal: 55, shift: 35, point: 25, edge: 15 };
const EMPTY_FC = { type: 'FeatureCollection', features: [] };

function ensureHidden() {
  if (hidden) return hidden;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:-30000px;top:0;width:800px;height:800px;pointer-events:none;visibility:visible;';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  const map = new maplibregl.Map({
    container: el,
    style: waterStyle(),
    interactive: false,
    attributionControl: false,
    pixelRatio: 1,
    fadeDuration: 0,
    preserveDrawingBuffer: true,
    canvasContextAttributes: { preserveDrawingBuffer: true, antialias: false },
    center: [24, 61],
    zoom: 5,
  });
  hidden = { map, el, ready: new Promise((r) => map.once('load', r)) };
  return hidden;
}

const waitIdle = (map) =>
  new Promise((res) => {
    const t = setTimeout(res, 20000);
    map.once('idle', () => { clearTimeout(t); res(); });
    map.triggerRepaint();
  });

// One hidden map draws every leg's water, so legs routed side by side take turns
// to draw (a loop's legs, or a paddle route's), and each grid keeps the projection
// it was drawn with, not the map's, which the next leg moves.
let turn = Promise.resolve();
function rasterise(bounds) {
  const run = turn.then(() => rasteriseNow(bounds));
  turn = run.catch(() => {});
  return run;
}

const mercX = (lon) => (lon + 180) / 360;
const mercY = (lat) => { const s = Math.sin((lat * Math.PI) / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };

async function rasteriseNow(bounds) {
  const h = ensureHidden();
  await h.ready;
  const [w, s, e, n] = bounds;
  const midLat = (s + n) / 2;
  const groundW = dist([w, midLat], [e, midLat]);
  const groundH = dist([w, s], [w, n]);
  const res = Math.max(MIN_RES_M, Math.max(groundW, groundH) / MAX_PX);
  const W = Math.max(64, Math.ceil(groundW / res));
  const H = Math.max(64, Math.ceil(groundH / res));
  h.el.style.width = `${W}px`;
  h.el.style.height = `${H}px`;
  h.map.resize();
  h.map.fitBounds([[w, s], [e, n]], { padding: 0, animate: false });
  await waitIdle(h.map);
  const src = h.map.getCanvas();
  const cw = src.width, ch = src.height;
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  const px = ctx.getImageData(0, 0, cw, ch).data;
  const type = new Uint8Array(cw * ch); // 0 land, 1 water, 2 marginal
  let waterCells = 0;
  for (let i = 0, j = 0; i < type.length; i++, j += 4) {
    const r = px[j];
    if (r > 200) { type[i] = 1; waterCells++; } else if (r > 60) type[i] = 2;
  }
  // Web Mercator, north up: the view's corners pin it down
  const nw = h.map.unproject([0, 0]), se = h.map.unproject([cw, ch]);
  const x0 = mercX(nw.lng), x1 = mercX(se.lng), y0 = mercY(nw.lat), y1 = mercY(se.lat);
  return {
    W: cw, H: ch, type, waterCells, res,
    project: ([lon, lat]) => ({ x: ((mercX(lon) - x0) / (x1 - x0)) * cw, y: ((mercY(lat) - y0) / (y1 - y0)) * ch }),
    unproject: (x, y) => {
      const X = x0 + (x / cw) * (x1 - x0), Y = y0 + (y / ch) * (y1 - y0);
      return [X * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - 2 * Y))) * 180) / Math.PI];
    },
  };
}

// The costs, drawn straight onto canvases in the same view (no tiling, no waiting
// for the map): fairways by class into one (red small-boat route, green harbour,
// blue shipping lane), keep-clear zones (red) and avoided places (green) into
// another. Read back as grid.fair (0 none, 1 small, 2 harbour, 3 ship), grid.haz
// and grid.nogo.
function rasteriseCosts(grid, { fairways, hazards, nogos }) {
  const { W, H, res } = grid;
  const px = (metres) => Math.max(1.5, metres / res);
  const xy = (ll) => { const p = grid.project(ll); return [p.x, p.y]; };
  const canvas = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c.getContext('2d', { willReadFrequently: true }); };
  const ring = (ctx, coords) => { coords.forEach((ll, k) => { const [x, y] = xy(ll); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); };
  const polys = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
  const fill = (ctx, g) => { ctx.beginPath(); for (const rings of polys(g)) for (const r of rings) ring(ctx, r); ctx.fill('evenodd'); };
  const disc = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill(); };

  const fc = canvas();
  fc.globalCompositeOperation = 'lighter'; // classes add up in their own channels
  for (const f of (fairways && fairways.features) || []) {
    fc.fillStyle = f.properties.cls === 'ship' ? '#0000ff' : f.properties.cls === 'harbour' ? '#00ff00' : '#ff0000';
    fill(fc, f.geometry);
  }
  const hc = canvas();
  hc.globalCompositeOperation = 'lighter';
  hc.fillStyle = '#ff0000';
  hc.strokeStyle = '#ff0000';
  const SHIFT = { north: [0, 1], south: [0, -1], east: [-1, 0], west: [1, 0] }; // a cardinal's danger lies on the side it doesn't name
  for (const f of (hazards && hazards.features) || []) {
    const g = f.geometry, kind = f.properties.kind;
    if (g.type === 'Point') {
      const [x, y] = xy(g.coordinates), sh = SHIFT[kind];
      if (sh) disc(hc, x + sh[0] * px(CLEAR.shift), y + sh[1] * px(CLEAR.shift), px(CLEAR.cardinal));
      else disc(hc, x, y, px(kind === 'danger' ? CLEAR.danger : CLEAR.point));
    } else {
      if (g.type === 'Polygon') fill(hc, g);
      const lines = g.type === 'LineString' ? [g.coordinates] : polys(g).flat();
      hc.lineWidth = 2 * px(CLEAR.edge);
      for (const l of lines) { hc.beginPath(); l.forEach((ll, k) => { const [x, y] = xy(ll); if (k) hc.lineTo(x, y); else hc.moveTo(x, y); }); hc.stroke(); }
    }
  }
  hc.fillStyle = '#00ff00';
  for (const n of nogos || []) { const [x, y] = xy(n.ll); disc(hc, x, y, Math.max(1.5, n.r / res)); }
  const fd = fc.getImageData(0, 0, W, H).data, hd = hc.getImageData(0, 0, W, H).data;
  const n = W * H;
  grid.fair = new Uint8Array(n);
  grid.haz = new Uint8Array(n);
  grid.nogo = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    grid.haz[i] = hd[j] > 128 ? 1 : 0;
    grid.nogo[i] = hd[j + 1] > 128 ? 1 : 0;
    grid.fair[i] = grid.haz[i] ? 0 : fd[j + 2] > 128 ? 3 : fd[j + 1] > 128 ? 2 : fd[j] > 128 ? 1 : 0;
  }
}

// Fetch (metres of open water upwind, to 8 km) for every water cell, along the
// nearest of eight directions, then a wave height from the wind over it. The
// window's edge counts as 2 km more water: the lake usually goes on.
function exposure(grid, wind) {
  const { W, H, type, res } = grid;
  const k = Math.round(((wind.dir % 360) + 360) % 360 / 45) % 8; // where the wind comes from
  const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]; // N, NE, E … in pixels (y down)
  const [dx, dy] = DIRS[k];
  const step = (dx && dy ? Math.SQRT2 : 1) * res;
  const F = new Float32Array(W * H);
  const ys = dy > 0 ? [H - 1, -1, -1] : [0, H, 1];
  const xs = dx > 0 ? [W - 1, -1, -1] : [0, W, 1];
  for (let y = ys[0]; y !== ys[1]; y += ys[2]) {
    for (let x = xs[0]; x !== xs[1]; x += xs[2]) {
      const i = y * W + x;
      if (type[i] !== 1) continue;
      const ux = x + dx, uy = y + dy;
      const up = ux < 0 || uy < 0 || ux >= W || uy >= H ? 2000 : F[uy * W + ux];
      F[i] = Math.min(8000, up + step);
    }
  }
  const u = wind.speed + 0.25 * Math.max(0, (wind.gust || wind.speed) - wind.speed);
  const wave = new Float32Array(W * H);
  for (let i = 0; i < F.length; i++) if (F[i]) wave[i] = waveHeight(u, F[i]);
  grid.wave = wave;
}

// Chamfer distance (in cells, capped) from every water cell to the nearest land.
function shoreDistance(type, W, H, cap = 6) {
  const d = new Uint8Array(W * H);
  for (let i = 0; i < d.length; i++) d[i] = type[i] === 0 ? 0 : cap;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) v = Math.min(v, d[i - W] + 1);
      d[i] = v;
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) v = Math.min(v, d[i + W] + 1);
      d[i] = v;
    }
  }
  return d;
}

class Heap {
  constructor() { this.idx = new Int32Array(1 << 16); this.pri = new Float32Array(1 << 16); this.n = 0; }
  push(i, p) {
    if (this.n === this.idx.length) {
      const ni = new Int32Array(this.n * 2); ni.set(this.idx); this.idx = ni;
      const np = new Float32Array(this.n * 2); np.set(this.pri); this.pri = np;
    }
    let k = this.n++;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (this.pri[parent] <= p) break;
      this.idx[k] = this.idx[parent]; this.pri[k] = this.pri[parent]; k = parent;
    }
    this.idx[k] = i; this.pri[k] = p;
  }
  pop() {
    const top = this.idx[0];
    const li = this.idx[--this.n], lp = this.pri[this.n];
    let k = 0;
    for (;;) {
      let c = 2 * k + 1;
      if (c >= this.n) break;
      if (c + 1 < this.n && this.pri[c + 1] < this.pri[c]) c++;
      if (this.pri[c] >= lp) break;
      this.idx[k] = this.idx[c]; this.pri[k] = this.pri[c]; k = c;
    }
    this.idx[k] = li; this.pri[k] = lp;
    return top;
  }
}

// Route style "near the shore" (styles.js): within about this far of land
const NEAR_SHORE_M = 250;

// how much more a cell costs in a fairway (by class: small-boat route, harbour basin, shipping lane);
// 'avoid' (swimmers: boats can't see you) keeps out of all of them where it can
const FAIR_COST = { cross: [1, 1.1, 2, 4], avoid: [1, 4, 8, 14] };

function astar(grid, sx, sy, tx, ty, landCost, near = false, comfort = 0, fairCost = FAIR_COST.cross) {
  const { W, H, type } = grid;
  // near the shore: distances in metres matter, so count further, and open water costs more the further out
  const lim = near ? Math.max(2, Math.round(NEAR_SHORE_M / grid.res)) : 0;
  const shore = shoreDistance(type, W, H, near ? Math.min(120, 2 * lim + 2) : 6);
  grid.shore = shore;
  grid.nearCells = lim;
  const N = W * H;
  const g = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = new Heap();
  const start = sy * W + sx, goal = ty * W + tx;
  const hfun = (i) => {
    const dx = Math.abs((i % W) - tx), dy = Math.abs(((i / W) | 0) - ty);
    return Math.max(dx, dy) + 0.41421356 * Math.min(dx, dy);
  };
  const { fair, haz, nogo, wave } = grid;
  const base = (i) => {
    const t = type[i];
    if (t === 1) {
      const d = shore[i];
      if (lim) return d <= 1 ? 1.5 : d <= lim ? 1 : 1 + Math.min(1.5, (d - lim) / lim);
      return d <= 1 ? 1.8 : d === 2 ? 1.25 : 1;
    }
    if (t === 2) return 3;
    return landCost;
  };
  const cellCost = (i) => {
    let c = base(i);
    if (nogo && nogo[i]) c *= 60;
    if (type[i] === 0) return c;
    if (haz && haz[i]) c *= 10;
    if (fair && fair[i]) c *= fairCost[fair[i]];
    // rough water: from half the craft's comfortable wave height up
    if (wave && comfort && wave[i] > comfort / 2) c *= 1 + 0.8 * Math.min(2.5, wave[i] / comfort - 0.5);
    return c;
  };
  grid.cellCost = cellCost;
  grid.special = !!(fair || haz || nogo || (wave && comfort));
  const DX = [1, -1, 0, 0, 1, 1, -1, -1];
  const DY = [0, 0, 1, -1, 1, -1, 1, -1];
  const DL = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];
  g[start] = 0;
  heap.push(start, hfun(start));
  let found = false;
  while (heap.n) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    if (cur === goal) { found = true; break; }
    closed[cur] = 1;
    const cx = cur % W, cy = (cur / W) | 0;
    for (let k = 0; k < 8; k++) {
      const nx = cx + DX[k], ny = cy + DY[k];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (closed[ni]) continue;
      const ng = g[cur] + DL[k] * cellCost(ni);
      if (ng < g[ni]) {
        g[ni] = ng;
        came[ni] = cur;
        heap.push(ni, ng + hfun(ni));
      }
    }
  }
  if (!found) return null;
  const path = [];
  for (let i = goal; i !== -1; i = came[i]) path.push(i);
  grid.g = g;
  return path.reverse();
}

// What the straight cell line a→b costs (the cells entered), Infinity if it leaves the water.
function lineCost(grid, a, b) {
  const { W, type, cellCost } = grid;
  let x0 = a % W, y0 = (a / W) | 0;
  const x1 = b % W, y1 = (b / W) | 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, cost = 0;
  while (x0 !== x1 || y0 !== y1) {
    const e2 = 2 * err;
    let diag = 0;
    if (e2 >= dy) { err += dy; x0 += sx; diag++; }
    if (e2 <= dx) { err += dx; y0 += sy; diag++; }
    const i = y0 * W + x0;
    if (type[i] === 0) return Infinity;
    cost += (diag === 2 ? Math.SQRT2 : 1) * cellCost(i);
  }
  return cost;
}

// Is the straight cell line a→b all of the wanted kind?
function lineOfSight(grid, a, b, water) {
  const { W, type } = grid;
  let x0 = a % W, y0 = (a / W) | 0;
  const x1 = b % W, y1 = (b / W) | 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    const t = type[y0 * W + x0];
    if (water ? t !== 1 : false) return false;
    // near the shore: a straight line mustn't cut out across open water either
    if (water && grid.nearCells && grid.shore[y0 * W + x0] > grid.nearCells * 1.3) return false;
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function stringPull(grid, path) {
  const isWater = (i) => grid.type[i] !== 0;
  const out = [{ i: path[0], water: isWater(path[0]) }];
  let anchor = 0;
  for (let k = 1; k < path.length; k++) {
    const w = isWater(path[k]);
    const runChanged = w !== isWater(path[anchor]);
    // with costs (fairways, keep-clear zones, wind) a straight line may not cost more than the way A* found
    const dearer = () => grid.special && lineCost(grid, path[anchor], path[k]) > (grid.g[path[k]] - grid.g[path[anchor]]) * 1.03 + 0.5;
    const blocked = !runChanged && w && (!lineOfSight(grid, path[anchor], path[k], true) || dearer());
    if (runChanged || blocked) {
      anchor = k - 1;
      out.push({ i: path[anchor], water: isWater(path[anchor]) });
      if (runChanged) {
        anchor = k;
        out.push({ i: path[k], water: w });
      }
    }
  }
  const last = path[path.length - 1];
  if (out[out.length - 1].i !== last) out.push({ i: last, water: isWater(last) });
  return out;
}

async function attempt(from, to, padFactor, allowPortage, style = {}, inputs = null) {
  const span = dist(from, to);
  const pad = Math.max(span * padFactor, 900);
  const midLat = (from[1] + to[1]) / 2;
  const dLat = pad / 111195;
  const dLon = pad / (111195 * Math.cos((midLat * Math.PI) / 180));
  const bounds = [
    Math.min(from[0], to[0]) - dLon, Math.min(from[1], to[1]) - dLat,
    Math.max(from[0], to[0]) + dLon, Math.max(from[1], to[1]) + dLat,
  ];
  const T = { t: performance.now() }; // where the time goes (tools/water_probe.py)
  const lap = (k) => { const n = performance.now(); T[k] = Math.round(n - T.t); T.t = n; };
  const [grid, got] = await Promise.all([rasterise(bounds), inputs ? inputs(bounds) : null]); // the data comes while the water renders
  lap('render+data');
  if (!grid.waterCells) throw new Error('No water found here — zoom to a lake, river or the sea.');
  if (got) {
    if (got.fairways.features.length || got.hazards.features.length || (style.nogos && style.nogos.length)) rasteriseCosts(grid, { fairways: got.fairways, hazards: got.hazards, nogos: style.nogos });
    lap('costs');
    if (got.wind && style.wind === 'shelter' && got.wind.speed >= 3) exposure(grid, got.wind);
    lap('wind');
  }
  const comfort = grid.wave ? COMFORT_WAVE[style.craft] || 0.3 : 0;
  const toCell = (ll) => {
    const p = grid.project(ll);
    const x = Math.max(0, Math.min(grid.W - 1, Math.round(p.x - 0.5)));
    const y = Math.max(0, Math.min(grid.H - 1, Math.round(p.y - 0.5)));
    return [x, y];
  };
  const [sx, sy] = toCell(from);
  const [tx, ty] = toCell(to);
  const path = astar(grid, sx, sy, tx, ty, allowPortage ? style.carry || 22 : 400, style.shore === 'near', comfort, FAIR_COST[style.fairways] || FAIR_COST.cross);
  lap('astar');
  if (!path) throw new Error('No water connection found.');
  const pulled = stringPull(grid, path);
  lap('pull');

  const coords = [from];
  const tags = [];
  const portage = [];
  let portageM = 0;
  for (let k = 1; k < pulled.length; k++) {
    const p = pulled[k];
    const ll = k === pulled.length - 1 ? to : grid.unproject((p.i % grid.W) + 0.5, ((p.i / grid.W) | 0) + 0.5);
    const onLand = !pulled[k - 1].water || !p.water;
    const seg = dist(coords[coords.length - 1], ll);
    if (onLand && seg > grid.res * 1.5) {
      portage.push([coords.length - 1, coords.length]);
      portageM += seg;
    }
    tags.push(onLand && seg > grid.res * 1.5 ? { portage: 'yes', surface: 'ground' } : { route: 'water', surface: 'water' });
    coords.push(ll);
  }
  const events = eventsAlong(grid, coords, comfort, got);
  lap('events');
  delete T.t;
  return { coords, tags, portage, portageM, resolution: grid.res, cells: grid.W * grid.H, events, wind: got && got.wind, missing: got ? got.missing : [], times: T };
}

// Where the finished line meets what costs: shipping lanes and harbours it
// crosses or follows, keep-clear zones it passes through, rough water. In
// metres from the leg's start, for Heads-up.
function eventsAlong(grid, coords, comfort, got) {
  if (!grid.fair && !grid.wave) return [];
  const out = [];
  const runs = {}; // kind -> open run { at, len, max }
  let m = 0;
  const close = (kind) => { const r = runs[kind]; if (r) { out.push({ kind, ...r }); runs[kind] = null; } };
  for (let k = 1; k < coords.length; k++) {
    const a = coords[k - 1], b = coords[k], d = dist(a, b);
    const n = Math.max(1, Math.ceil(d / grid.res));
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n;
      const p = grid.project([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      const x = Math.floor(p.x), y = Math.floor(p.y);
      const at = m + d * t, len = d / n;
      const i = x >= 0 && y >= 0 && x < grid.W && y < grid.H ? y * grid.W + x : -1;
      const water = i >= 0 && grid.type[i] === 1;
      const on = {
        ship: water && grid.fair && grid.fair[i] === 3,
        harbour: water && grid.fair && grid.fair[i] === 2,
        hazard: water && grid.haz && grid.haz[i] === 1,
        rough: water && comfort && grid.wave && grid.wave[i] > comfort,
      };
      for (const kind of Object.keys(on)) {
        if (on[kind]) {
          if (!runs[kind]) runs[kind] = { at, len: 0, max: 0 };
          runs[kind].len += len;
          if (kind === 'rough') runs[kind].max = Math.max(runs[kind].max, grid.wave[i]);
        } else if (runs[kind] && at - (runs[kind].at + runs[kind].len) > 3 * grid.res) close(kind);
      }
    }
    m += d;
  }
  for (const kind of Object.keys(runs)) close(kind);
  // names: the shipping lane under each crossing
  const names = got && got.fairways ? got.fairways.features : [];
  for (const e of out) e.name = e.kind === 'ship' ? nameAt(names, coords, e.at + e.len / 2) : '';
  return out.filter((e) => e.len >= 2 * grid.res || e.kind === 'hazard');
}

function nameAt(fairways, coords, at) {
  let m = 0, p = coords[0];
  for (let k = 1; k < coords.length; k++) {
    const d = dist(coords[k - 1], coords[k]);
    if (m + d >= at) { const t = (at - m) / (d || 1); p = [coords[k - 1][0] + (coords[k][0] - coords[k - 1][0]) * t, coords[k - 1][1] + (coords[k][1] - coords[k - 1][1]) * t]; break; }
    m += d;
  }
  const f = fairways.find((x) => x.properties.cls === 'ship' && inPolygon(p, x.geometry));
  return f ? f.properties.name : '';
}

function inPolygon(p, g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return polys.some((rings) => {
    let inside = false;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  });
}

const memo = new Map(); // same leg, same costs, same wind class: the same route (re-timing a trip doesn't re-run A*)

/**
 * Route a paddling leg over water. Route style (styles.js): shore 'near' keeps
 * within reach of land; carry is the cost of a cell of land (22 = carry when
 * it's shorter, higher = avoid carrying); fairways 'cross' crosses shipping
 * lanes straight (else 'ignore'); hazards 'clear' keeps clear of marked rocks
 * and shoals; wind 'shelter' keeps out of rough water for `craft` at `at`
 * (epoch seconds); nogos are places you avoid.
 */
export async function routeWater(from, to, { allowPortage = true, shore, carry, fairways = 'cross', hazards = 'clear', wind = 'shelter', craft = 'kayak', at = 0, nogos = [] } = {}) {
  const t0 = performance.now();
  const style = { shore, carry, wind, craft, nogos, fairways };
  const want = { fairways: fairways !== 'ignore', hazards: hazards !== 'ignore', wind: wind === 'shelter' };
  let inputsOf = null;
  if (want.fairways || want.hazards || want.wind) {
    // one fetch per window; a wider retry asks again for its own box
    inputsOf = async (box) => {
      const got = await waterInputs(box, want, at);
      if (!want.fairways) got.fairways = EMPTY_FC;
      return got;
    };
  }
  // the wind decides the route only by class (direction to 45°, speed to 2 m/s): look it up first for the memo
  let windKey = '';
  if (want.wind) {
    try {
      const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
      const w = (await waterInputs([mid[0], mid[1], mid[0], mid[1]], { wind: true }, at)).wind;
      windKey = w ? `${Math.round(w.dir / 45) % 8}/${Math.round(w.speed / 2)}` : '';
    } catch { /* routed without */ }
  }
  const tWind = Math.round(performance.now() - t0);
  const key = JSON.stringify([from, to, allowPortage, shore, carry, fairways, hazards, wind, craft, windKey, nogos.map((n) => [n.ll, n.r])]);
  if (memo.has(key)) return memo.get(key);
  const route = async () => {
    let best = await attempt(from, to, 0.35, allowPortage, style, inputsOf);
    best.times.tries = 1;
    const total = best.coords.length > 1 ? best.coords.reduce((s, c, i, a) => (i ? s + dist(a[i - 1], c) : 0), 0) : 0;
    // A large carry often means the real water route leaves the search window
    // (around a long peninsula). Look wider once before accepting it.
    if (best.portageM > Math.max(150, total * 0.12)) {
      try {
        const wide = await attempt(from, to, 1.1, allowPortage, style, inputsOf);
        if (wide.portageM < best.portageM * 0.7) { wide.times.tries = 2; best = wide; } else best.times.tries = 2;
      } catch { /* keep first result */ }
    }
    return best;
  };
  const seen = lateAnswers();
  let best = await route();
  // A source it went without answered while it was being routed (the planner
  // routes again only the legs done by then): once more, with the answer.
  if (best.missing.length && lateAnswers() !== seen) {
    try { best = await route(); best.times.again = 1; } catch { /* keep the first */ }
  }
  best.times.windKey = tWind;
  const note = best.portageM > 30 ? `Includes ${Math.round(best.portageM)} m of carrying` : '';
  const out = {
    coords: best.coords, tags: best.tags, portage: best.portage, note,
    water: { events: best.events, wind: want.wind ? best.wind : null, craft, missing: best.missing, checked: want, ms: Math.round(performance.now() - t0), cells: best.cells, times: best.times },
  };
  if (!best.missing.length) memo.set(key, out); // a leg routed without a source is routed again when it answers
  if (memo.size > 60) memo.delete(memo.keys().next().value);
  return out;
}
