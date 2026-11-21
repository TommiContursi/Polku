// The shadows' sweep (#910, #919), run in a worker so a screen of tiles doesn't stall the map: js/shadows.js
// sends a tile's grid of heights, this sends back its picture.

const SHADE = [20, 30, 50, 110]; // RGBA where the sun is hidden

/**
 * Which pixels of the middle tile the surface keeps from the sun, sweeping from the sun's side:
 * `top` is how high a ray from the sun still is over each pixel, carried one pixel at a time
 * (stepping a whole pixel along the sun's main axis, between two pixels across it).
 * `grid` is N × N, 3 × 3 tiles; `az` and `alt` in degrees, `m` metres a pixel. With `ground`, the bare ground
 * under the grid's trees and buildings, a pixel the ground alone keeps from the sun isn't marked: the hills'
 * own shadows show it. Returns (N / 3)², 1 where in shadow.
 */
export function castShadows(grid, N, az, alt, m, ground) {
  const S = N / 3;
  const dx = Math.sin((az * Math.PI) / 180), dy = -Math.cos((az * Math.PI) / 180);
  const k = Math.max(Math.abs(dx), Math.abs(dy)), sx = dx / k, sy = dy / k;
  const drop = m * Math.hypot(sx, sy) * Math.tan((alt * Math.PI) / 180);
  const top = new Float32Array(N * N), topG = ground && new Float32Array(N * N), out = new Uint8Array(S * S);
  const xMajor = Math.abs(sx) === 1;
  // one line (a column when the sun is east or west, else a row) after another, from the sun's side
  for (let i0 = 0; i0 < N; i0++) {
    const i = (xMajor ? sx : sy) > 0 ? N - 1 - i0 : i0;
    for (let j = 0; j < N; j++) {
      const x = xMajor ? i : j, y = xMajor ? j : i, at = y * N + x, e = grid[at], g = ground ? ground[at] : 0;
      const qx = x + sx, qy = y + sy;
      let ray = -Infinity, rayG = -Infinity;
      if (qx >= 0 && qx <= N - 1 && qy >= 0 && qy <= N - 1) {
        // between two pixels of the line already swept
        const f = xMajor ? qy : qx, a = Math.floor(f), b = Math.min(a + 1, N - 1), w = f - a;
        const ia = xMajor ? a * N + qx : qy * N + a, ib = xMajor ? b * N + qx : qy * N + b;
        ray = top[ia] + (top[ib] - top[ia]) * w - drop;
        if (ground) rayG = topG[ia] + (topG[ib] - topG[ia]) * w - drop;
      }
      top[at] = Math.max(e, ray);
      if (ground) topG[at] = Math.max(g, rayG);
      if (ray > e + 1 && !(rayG > g + 1) && x >= S && x < 2 * S && y >= S && y < 2 * S) out[(y - S) * S + (x - S)] = 1;
    }
  }
  return out;
}

// The heights at twice the grid's pixels, each between its four nearest, so the crowns and roofs have round
// edges, not the grid's steps.
function twice(a, N) {
  const M = 2 * N, o = new Float32Array(M * M), at = (v) => Math.min(N - 1, Math.max(0, (v - 0.5) / 2));
  for (let y = 0; y < M; y++) {
    const fy = at(y), y0 = Math.floor(fy), y1 = Math.min(N - 1, y0 + 1), wy = fy - y0;
    for (let x = 0; x < M; x++) {
      const fx = at(x), x0 = Math.floor(fx), x1 = Math.min(N - 1, x0 + 1), wx = fx - x0;
      const a0 = a[y0 * N + x0] + (a[y0 * N + x1] - a[y0 * N + x0]) * wx, a1 = a[y1 * N + x0] + (a[y1 * N + x1] - a[y1 * N + x0]) * wx;
      o[y * M + x] = a0 + (a1 - a0) * wy;
    }
  }
  return o;
}

/**
 * The middle tile's picture, (2N / 3)² pixels: the sweep at twice the grid's pixels, its edges softened over 3 × 3
 * of them, so they stay smooth when the map zooms past the tile.
 */
export function shadowPicture(grid, N, az, alt, m, ground) {
  const M = 2 * N, S = M / 3, shade = castShadows(twice(grid, N), M, az, alt, m / 2, ground && twice(ground, N));
  const img = new ImageData(S, S), c = (v) => Math.min(S - 1, Math.max(0, v));
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let a = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) a += shade[c(y + dy) * S + c(x + dx)] * (2 - Math.abs(dx)) * (2 - Math.abs(dy));
      if (a) img.data.set([SHADE[0], SHADE[1], SHADE[2], Math.round((SHADE[3] * a) / 16)], (y * S + x) * 4);
    }
  }
  return img;
}

// as the worker js/shadows.js starts (imported on a page, for its tests, it only exports the sweep)
if (typeof window === 'undefined') {
  onmessage = async ({ data: { id, grid, ground, N, az, alt, m } }) => {
    try {
      const img = shadowPicture(grid, N, az, alt, m, ground), canvas = new OffscreenCanvas(img.width, img.height);
      canvas.getContext('2d').putImageData(img, 0, 0);
      const png = await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer();
      postMessage({ id, png }, [png]);
    } catch (e) {
      postMessage({ id, error: String(e) });
    }
  };
}
