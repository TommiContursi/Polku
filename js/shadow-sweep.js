// The shadows' sweep (#910, #919), run in a worker so a screen of tiles doesn't stall the map: js/shadows.js
// sends a tile's grid of heights, this sends back its picture.

const SHADE = [20, 30, 50, 110]; // RGBA where the sun is hidden

/**
 * Which pixels of the middle tile the surface keeps from the sun, sweeping from the sun's side:
 * `top` is how high a ray from the sun still is over each pixel, carried one pixel at a time
 * (stepping a whole pixel along the sun's main axis, between two pixels across it).
 * `grid` is N × N, 3 × 3 tiles; `az` and `alt` in degrees, `m` metres a pixel. With `ground`, the bare ground
 * under the grid's trees and buildings, a pixel the ground alone keeps from the sun isn't marked: the hills'
 * own shadows show it. Returns (N / 3)², 1 where in shadow; `top` is left in the array given as `top`, if any.
 */
export function castShadows(grid, N, az, alt, m, ground, top = new Float32Array(N * N)) {
  const S = N / 3;
  const dx = Math.sin((az * Math.PI) / 180), dy = -Math.cos((az * Math.PI) / 180);
  const k = Math.max(Math.abs(dx), Math.abs(dy)), sx = dx / k, sy = dy / k;
  const drop = m * Math.hypot(sx, sy) * Math.tan((alt * Math.PI) / 180);
  const topG = ground && new Float32Array(N * N), out = new Uint8Array(S * S);
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
 * of them, so they stay smooth when the map zooms past the tile. With `roofs` (each building's id, height `h` and
 * footprint in the grid's pixels), how much of each is in shadow, for js/style.js to darken it by: see shadeOf().
 */
export function shadowPicture(grid, N, az, alt, m, ground, roofs = []) {
  const M = 2 * N, S = M / 3, top = new Float32Array(M * M), g2 = ground && twice(ground, N);
  const shade = castShadows(twice(grid, N), M, az, alt, m / 2, g2, top);
  const img = new ImageData(S, S), c = (v) => Math.min(S - 1, Math.max(0, v));
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let a = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) a += shade[c(y + dy) * S + c(x + dx)] * (2 - Math.abs(dx)) * (2 - Math.abs(dy));
      if (a) img.data.set([SHADE[0], SHADE[1], SHADE[2], Math.round((SHADE[3] * a) / 16)], (y * S + x) * 4);
    }
  }
  const sun = [Math.round(Math.sin((az * Math.PI) / 180)), Math.round(-Math.cos((az * Math.PI) / 180))];
  const out = roofs.map((b) => ({ id: b.id, ...shadeOf({ shade, top, ground: g2, S, sun }, b.h, b.rings.map((r) => r.map((v) => (v - S / 2) * 2))) }));
  return { img, roofs: out.filter((r) => r.n || r.k) };
}

/**
 * How much of a building is in the shadows of the others and of trees, in the picture's pixels: its roof, s of n
 * pixels in shadow (its edge left out: the heights there are between the roof's and the ground's, so the roof would
 * shade its own edge), and the wall facing the sun, the shadow's height on it over the building's, summed as w over
 * the k pixels at its foot (the ground just outside, on the sun's side, `sun` the step towards it).
 */
function shadeOf({ shade, top, ground, S, sun }, h, rings) {
  const xs = rings.flatMap((r) => r.filter((_, i) => !(i % 2))), ys = rings.flatMap((r) => r.filter((_, i) => i % 2));
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 1), x1 = Math.min(S - 1, Math.ceil(Math.max(...xs)) + 1);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - 1), y1 = Math.min(S - 1, Math.ceil(Math.max(...ys)) + 1);
  const W = x1 - x0 + 1, H = y1 - y0 + 1, inside = new Uint8Array(Math.max(0, W * H));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      let k = 0;
      for (const r of rings) {
        for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
          if ((r[i + 1] > py) !== (r[j + 1] > py) && px < ((r[j] - r[i]) * (py - r[i + 1])) / (r[j + 1] - r[i + 1]) + r[i]) k ^= 1;
        }
      }
      inside[(y - y0) * W + x - x0] = k;
    }
  }
  const at = (x, y) => (x >= x0 && x <= x1 && y >= y0 && y <= y1 ? inside[(y - y0) * W + x - x0] : 0);
  let s = 0, n = 0, w = 0, k = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (at(x, y)) {
        if (at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1)) { n++; s += shade[y * S + x]; }
      } else if (at(x - sun[0], y - sun[1]) && h > 0) {
        // (a pixel further out, past the footprint's edge, which the heights' blending blurs; in the whole grid)
        const i = (y + sun[1] + S) * 3 * S + x + sun[0] + S;
        k++; w += Math.min(1, Math.max(0, (top[i] - (ground ? ground[i] : 0) - 1) / h));
      }
    }
  }
  return { s, n, w, k };
}

// as the worker js/shadows.js starts (imported on a page, for its tests, it only exports the sweep)
if (typeof window === 'undefined') {
  onmessage = async ({ data: { id, grid, ground, N, az, alt, m, roofs } }) => {
    try {
      const out = shadowPicture(grid, N, az, alt, m, ground, roofs), canvas = new OffscreenCanvas(out.img.width, out.img.height);
      canvas.getContext('2d').putImageData(out.img, 0, 0);
      const png = await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer();
      postMessage({ id, png, roofs: out.roofs }, [png]);
    } catch (e) {
      postMessage({ id, error: String(e) });
    }
  };
}
