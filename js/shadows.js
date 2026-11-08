// The shadows the hills cast at an hour (#910): worked out here from the same DEM tiles as the
// hillshade (the contour library's DemSource, its cache shared), so nothing is asked of a server
// but those tiles. A raster source 'sunshadow://{z}/{x}/{y}?t=<epoch s>' gets, for each tile, a
// picture dark where the terrain hides the sun.

import { sunPosition } from './sun.js';
import { DEM_TILESIZE as T } from './config.js';

const S = T / 2; // a tile's own pixels: one DEM tile a zoom out covers 2 × 2 tiles, so 9 m a pixel at zoom 13 in southern Finland
const SHADE = [20, 30, 50, 110]; // RGBA where the sun is hidden

const tileLonLat = (z, x, y) => {
  const n = 2 ** z, lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n)));
  return [((x + 0.5) / n) * 360 - 180, (lat * 180) / Math.PI];
};

// The heights from one tile beyond (x, y) on every side, a grid of 3 × 3 tiles: from the DEM a zoom out, so
// it's 2 × 2 of its tiles, which the tiles around share (and fewer for the DEM's queue: 3 × 3 at the same zoom timed out).
async function heights(dem, z, x, y, abort) {
  const N = 3 * S, grid = new Float32Array(N * N), n = 2 ** (z - 1);
  const gx = (x - 1) * S, gy = (y - 1) * S, tx = Math.floor(gx / T), ty = Math.floor(gy / T);
  await Promise.all([0, 1].flatMap((j) => [0, 1].map(async (i) => {
    const t = await dem.getDemTile(z - 1, (tx + i + n) % n, Math.min(n - 1, Math.max(0, ty + j)), abort);
    const ox = (tx + i) * T - gx, oy = (ty + j) * T - gy; // where its first pixel is in the grid
    for (let r = Math.max(0, -oy); r < Math.min(T, N - oy); r++) {
      for (let c = Math.max(0, -ox); c < Math.min(T, N - ox); c++) grid[(oy + r) * N + ox + c] = t.data[r * T + c];
    }
  })));
  return grid;
}

/**
 * Which pixels of the middle tile the terrain keeps from the sun, sweeping from the sun's side:
 * `top` is how high a ray from the sun still is over each pixel, carried one pixel at a time
 * (stepping a whole pixel along the sun's main axis, between two pixels across it).
 * `az` and `alt` in degrees, `m` metres a pixel. Returns S × S, 1 where in shadow.
 */
export function castShadows(grid, N, az, alt, m) {
  const dx = Math.sin((az * Math.PI) / 180), dy = -Math.cos((az * Math.PI) / 180);
  const k = Math.max(Math.abs(dx), Math.abs(dy)), sx = dx / k, sy = dy / k;
  const drop = m * Math.hypot(sx, sy) * Math.tan((alt * Math.PI) / 180);
  const top = new Float32Array(N * N), out = new Uint8Array(S * S);
  const xMajor = Math.abs(sx) === 1;
  // one line (a column when the sun is east or west, else a row) after another, from the sun's side
  for (let i0 = 0; i0 < N; i0++) {
    const i = (xMajor ? sx : sy) > 0 ? N - 1 - i0 : i0;
    for (let j = 0; j < N; j++) {
      const x = xMajor ? i : j, y = xMajor ? j : i, e = grid[y * N + x];
      const qx = x + sx, qy = y + sy;
      let ray = -Infinity;
      if (qx >= 0 && qx <= N - 1 && qy >= 0 && qy <= N - 1) {
        // between two pixels of the line already swept
        const f = xMajor ? qy : qx, a = Math.floor(f), b = Math.min(a + 1, N - 1), w = f - a;
        const ta = xMajor ? top[a * N + qx] : top[qy * N + a], tb = xMajor ? top[b * N + qx] : top[qy * N + b];
        ray = ta + (tb - ta) * w - drop;
      }
      top[y * N + x] = Math.max(e, ray);
      if (ray > e + 1 && x >= S && x < 2 * S && y >= S && y < 2 * S) out[(y - S) * S + (x - S)] = 1;
    }
  }
  return out;
}

/** Registers the protocol; `onFail()` hears of a tile whose heights didn't load. */
export function shadowProtocol(maplibre, dem, onFail) {
  maplibre.addProtocol('sunshadow', async (params, abort) => {
    const [, z, x, y, t] = params.url.match(/sunshadow:\/\/(\d+)\/(\d+)\/(\d+)\?t=(\d+)/).map(Number);
    const ll = tileLonLat(z, x, y), sun = sunPosition(t, ll);
    const canvas = new OffscreenCanvas(S, S);
    if (sun.alt > 0.5) {
      let grid;
      try {
        grid = await heights(dem, z, x, y, abort);
      } catch (e) {
        if (!abort.signal.aborted) onFail();
        throw e;
      }
      const m = (40075016 * Math.cos((ll[1] * Math.PI) / 180)) / 2 ** z / S;
      const shade = castShadows(grid, 3 * S, sun.az, sun.alt, m);
      const img = new ImageData(S, S);
      for (let i = 0; i < shade.length; i++) if (shade[i]) img.data.set(SHADE, i * 4);
      canvas.getContext('2d').putImageData(img, 0, 0);
    }
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return { data: await blob.arrayBuffer() };
  });
}
