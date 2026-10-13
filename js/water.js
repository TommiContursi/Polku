// Open-water routing for kayak / canoe / SUP.
//
// Road routers can't cross lakes, so we build our own: a hidden MapLibre map
// renders only the water polygons (white on black) for the leg's area, we read
// the pixels back as a navigability grid, run A* on it and then "string-pull"
// the cell path into straight paddling lines. Land cells are passable at a high
// cost, which yields portages (carries) when there's no water connection.

import { OFM_TILEJSON } from './config.js';
import { dist } from './geo.js';

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

async function rasterise(bounds) {
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
  return {
    W: cw, H: ch, type, waterCells, res,
    project: (ll) => h.map.project(ll),
    unproject: (x, y) => h.map.unproject([x, y]).toArray(),
  };
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

function astar(grid, sx, sy, tx, ty, landCost, near = false) {
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
  const cellCost = (i) => {
    const t = type[i];
    if (t === 1) {
      const d = shore[i];
      if (lim) return d <= 1 ? 1.5 : d <= lim ? 1 : 1 + Math.min(1.5, (d - lim) / lim);
      return d <= 1 ? 1.8 : d === 2 ? 1.25 : 1;
    }
    if (t === 2) return 3;
    return landCost;
  };
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
  return path.reverse();
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
    const blocked = !runChanged && w && !lineOfSight(grid, path[anchor], path[k], true);
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

async function attempt(from, to, padFactor, allowPortage, style = {}) {
  const span = dist(from, to);
  const pad = Math.max(span * padFactor, 900);
  const midLat = (from[1] + to[1]) / 2;
  const dLat = pad / 111195;
  const dLon = pad / (111195 * Math.cos((midLat * Math.PI) / 180));
  const bounds = [
    Math.min(from[0], to[0]) - dLon, Math.min(from[1], to[1]) - dLat,
    Math.max(from[0], to[0]) + dLon, Math.max(from[1], to[1]) + dLat,
  ];
  const grid = await rasterise(bounds);
  if (!grid.waterCells) throw new Error('No water found here — zoom to a lake, river or the sea.');
  const toCell = (ll) => {
    const p = grid.project(ll);
    const x = Math.max(0, Math.min(grid.W - 1, Math.round(p.x - 0.5)));
    const y = Math.max(0, Math.min(grid.H - 1, Math.round(p.y - 0.5)));
    return [x, y];
  };
  const [sx, sy] = toCell(from);
  const [tx, ty] = toCell(to);
  const path = astar(grid, sx, sy, tx, ty, allowPortage ? style.carry || 22 : 400, style.shore === 'near');
  if (!path) throw new Error('No water connection found.');
  const pulled = stringPull(grid, path);

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
  return { coords, tags, portage, portageM, resolution: grid.res };
}

/**
 * Route a paddling leg over water. Route style (styles.js): shore 'near' keeps
 * within reach of land; carry is the cost of a cell of land (22 = carry when
 * it's shorter, higher = avoid carrying).
 */
export async function routeWater(from, to, { allowPortage = true, shore, carry } = {}) {
  const style = { shore, carry };
  let best = await attempt(from, to, 0.35, allowPortage, style);
  const total = best.coords.length > 1 ? best.coords.reduce((s, c, i, a) => (i ? s + dist(a[i - 1], c) : 0), 0) : 0;
  // A large carry often means the real water route leaves the search window
  // (around a long peninsula). Look wider once before accepting it.
  if (best.portageM > Math.max(150, total * 0.12)) {
    try {
      const wide = await attempt(from, to, 1.1, allowPortage, style);
      if (wide.portageM < best.portageM * 0.7) best = wide;
    } catch { /* keep first result */ }
  }
  const note = best.portageM > 30 ? `Includes ${Math.round(best.portageM)} m of carrying` : '';
  return { coords: best.coords, tags: best.tags, portage: best.portage, note };
}
