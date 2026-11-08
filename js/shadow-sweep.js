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

// as the worker js/shadows.js starts (imported on a page, for its tests, it only exports the sweep)
if (typeof window === 'undefined') {
  onmessage = async ({ data: { id, grid, ground, N, az, alt, m } }) => {
    try {
      const S = N / 3, shade = castShadows(grid, N, az, alt, m, ground), img = new ImageData(S, S);
      for (let i = 0; i < shade.length; i++) if (shade[i]) img.data.set(SHADE, i * 4);
      const canvas = new OffscreenCanvas(S, S);
      canvas.getContext('2d').putImageData(img, 0, 0);
      const png = await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer();
      postMessage({ id, png }, [png]);
    } catch (e) {
      postMessage({ id, error: String(e) });
    }
  };
}
