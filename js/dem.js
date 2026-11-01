// Elevation sampling straight from the Mapterhorn terrarium tiles, so the route
// profile and the uphill overlay use the same lidar-grade DEM as the hillshade.

import { DEM_URL, DEM_MAXZOOM } from './config.js';
import { lonLatToTile } from './geo.js';

const MAX_TILES = 220;
// A tile that didn't load (no network, a server error, bad data) is asked for again after this.
const RETRY_MS = 15000;
const FAILED = Object.freeze({ failed: true });
const cache = new Map(); // "z/x/y" -> { p: Promise<{w,h,el}|null|FAILED>, failed: when it failed, or 0 }

function trimTiles() {
  for (const [key, tile] of cache) {
    if (cache.size <= MAX_TILES) break;
    if (tile.done) cache.delete(key);
  }
}

function decode(img) {
  const w = img.width, h = img.height;
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data;
  const el = new Float32Array(w * h);
  for (let i = 0, j = 0; i < el.length; i++, j += 4) {
    el[i] = px[j] * 256 + px[j + 1] + px[j + 2] / 256 - 32768;
  }
  return { w, h, el };
}

// The tile, null where there's none (a coarser one may have it), or FAILED when it didn't
// load: that one is asked for again once RETRY_MS have passed.
function loadTile(z, x, y) {
  const key = `${z}/${x}/${y}`;
  const hit = cache.get(key);
  if (hit && !(hit.failed && Date.now() - hit.failed > RETRY_MS)) {
    cache.delete(key);
    cache.set(key, hit);
    return hit.p;
  }
  const url = DEM_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  const entry = { failed: 0, done: false };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  entry.p = fetch(url, { signal: ctrl.signal })
    .then((r) => {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`terrain tile: HTTP ${r.status}`);
      return r.blob();
    })
    .then((b) => (b ? createImageBitmap(b).then(decode) : null))
    .catch(() => { entry.failed = Date.now(); return FAILED; })
    .finally(() => { clearTimeout(timer); entry.done = true; trimTiles(); });
  cache.delete(key);
  cache.set(key, entry);
  trimTiles();
  return entry.p;
}

/** Ask for the tiles that didn't load again now, not after a while (Retry, or back online). */
export function retryFailed() {
  for (const [key, e] of cache) if (e.failed) cache.delete(key);
}

function sample(tile, fx, fy) {
  // fx, fy: fractional position inside the tile (0..1)
  const { w, h, el } = tile;
  const x = Math.min(w - 1.001, Math.max(0, fx * w - 0.5));
  const y = Math.min(h - 1.001, Math.max(0, fy * h - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = x - x0, ty = y - y0;
  const i = y0 * w + x0;
  const a = el[i], b = el[i + 1], c = el[i + w], d = el[i + w + 1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/**
 * Elevation for many points at once. Points are grouped per tile so each tile
 * is fetched and decoded once. Missing tiles fall back to a coarser zoom.
 * @returns {Promise<Float32Array>} metres, NaN where nothing is available. Its `failed`
 *   counts the points left without because a tile didn't load (worth asking again later).
 */
export async function elevations(points, z = DEM_MAXZOOM) {
  const out = new Float32Array(points.length).fill(NaN);
  const failed = new Uint8Array(points.length);
  let pending = points.map((_, i) => i);
  for (let zz = z; zz >= Math.max(0, z - 4) && pending.length; zz -= 2) {
    const groups = new Map();
    for (const i of pending) {
      const [tx, ty] = lonLatToTile(points[i][0], points[i][1], zz);
      const key = `${Math.floor(tx)}/${Math.floor(ty)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    }
    const next = [];
    const keys = [...groups.keys()];
    // Bounded parallelism keeps the tile server happy on long routes.
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(8, keys.length) }, async () => {
      while (cursor < keys.length) {
        const key = keys[cursor++];
        const [x, y] = key.split('/').map(Number);
        const tile = await loadTile(zz, x, y);
        for (const i of groups.get(key)) {
          if (tile === FAILED) failed[i] = 1;
          if (!tile || tile === FAILED) { next.push(i); continue; }
          const [tx, ty] = lonLatToTile(points[i][0], points[i][1], zz);
          const v = sample(tile, tx - x, ty - y);
          if (Number.isFinite(v) && v > -500) out[i] = v;
          else next.push(i);
        }
      }
    }));
    pending = next;
  }
  out.failed = pending.filter((i) => failed[i]).length;
  return out;
}

export async function elevation(lngLat, z = DEM_MAXZOOM) {
  return (await elevations([lngLat], z))[0];
}

// Centred moving average over a window in metres, for noise-free grades.
export function smooth(values, along, windowM) {
  const n = values.length;
  const out = new Float32Array(n);
  let lo = 0, hi = 0, sum = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    while (hi < n && along[hi] - along[i] <= windowM / 2) {
      if (Number.isFinite(values[hi])) { sum += values[hi]; cnt++; }
      hi++;
    }
    while (along[i] - along[lo] > windowM / 2) {
      if (Number.isFinite(values[lo])) { sum -= values[lo]; cnt--; }
      lo++;
    }
    out[i] = cnt ? sum / cnt : NaN;
  }
  return out;
}
