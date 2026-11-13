// The shadows the hills cast at an hour (#910), and from zoom 14 the trees' and buildings' (#919). The hills' are
// worked out from the same DEM tiles as the hillshade (the contour library's DemSource, its cache shared). The
// trees and buildings stand on that ground: the trees' heights from Meta and WRI's canopy height map (about 1.2 m
// pixels, from pictures of 2003–2020), read a piece at a time from Source Cooperative, and the buildings'
// footprints and heights from OpenFreeMap's zoom 14 tiles, the map's own. A raster source
// 'sunshadow://{z}/{x}/{y}?t=<epoch s>' (with '&objects' for the trees and buildings) gets, for each tile, a
// picture dark where the sun is hidden, drawn by the sweep in js/shadow-sweep.js, a worker.

import { sunPosition } from './sun.js';
import { DEM_TILESIZE as T } from './config.js';
import { request } from './net.js';
import { ofmTemplate } from './offline.js';

const S = T / 2; // a tile's own pixels: one DEM tile a zoom out covers 2 × 2 tiles, so 9 m a pixel at zoom 13 in southern Finland
const CANOPY = 'https://data.source.coop/tge-labs/meta-chm-v2/chm/';
const OFM_Z = 14; // OpenFreeMap has its buildings in its zoom 14 tiles only

const tileLonLat = (z, x, y) => {
  const n = 2 ** z, lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n)));
  return [((x + 0.5) / n) * 360 - 180, (lat * 180) / Math.PI];
};

// The heights from one tile beyond (x, y) on every side, a grid of 3 × 3 tiles: from tiles of T × T a zoom out
// (`piece(z, x, y)`), so it's 2 × 2 of them, which the tiles around share (and fewer for the DEM's queue: 3 × 3 at
// the same zoom timed out).
async function heights(piece, z, x, y) {
  const N = 3 * S, grid = new Float32Array(N * N), n = 2 ** (z - 1);
  const gx = (x - 1) * S, gy = (y - 1) * S, tx = Math.floor(gx / T), ty = Math.floor(gy / T);
  await Promise.all([0, 1].flatMap((j) => [0, 1].map(async (i) => {
    const t = await piece(z - 1, (tx + i + n) % n, Math.min(n - 1, Math.max(0, ty + j)));
    const ox = (tx + i) * T - gx, oy = (ty + j) * T - gy; // where its first pixel is in the grid
    for (let r = Math.max(0, -oy); r < Math.min(T, N - oy); r++) {
      for (let c = Math.max(0, -ox); c < Math.min(T, N - ox); c++) grid[(oy + r) * N + ox + c] = t[r * T + c];
    }
  })));
  return grid;
}

// ---- the trees: Meta's canopy heights ---------------------------------------------------------------------
// One cloud-optimised GeoTIFF per zoom 10 tile, named by its quadkey: whole metres as bytes, with a level for each
// zoom 10–16 in 512 px pieces of that zoom's tiles, deflate-compressed. Its first 90 kB say where each piece is.
// Shared by the tiles around, so fetched without a tile's abort, and kept.
const NONE = new Uint8Array(T * T); // no trees
const indexes = new Map(); // quadkey -> Promise of { zoom: { at, n } } (where each piece is and its length), null where there's no file (open water)
const pieces = new Map(); // 'z/x/y' -> Promise of a piece's heights, the last 32

const quadkey = (z, x, y) => {
  let q = '';
  for (let i = z - 1; i >= 0; i--) q += ((x >> i) & 1) + 2 * ((y >> i) & 1);
  return q;
};

async function canopyIndex(q) {
  const res = await request('canopy', `${CANOPY}${q}.tif`, { headers: { Range: 'bytes=0-131071' } });
  if (res.status === 404) return null;
  if (res.status !== 206) throw new Error(`Tree heights: ${res.status}`);
  const v = new DataView(await res.arrayBuffer()), levels = {};
  if (v.getUint32(0) !== 0x49492a00) throw new Error('Tree heights: not a little-endian TIFF');
  // each level's tags: ImageWidth, BitsPerSample, Compression, Predictor, TileWidth, TileOffsets, TileByteCounts
  for (let ifd = v.getUint32(4, true); ifd; ifd = v.getUint32(ifd + 2 + 12 * v.getUint16(ifd, true), true)) {
    const tag = {};
    for (let i = 0; i < v.getUint16(ifd, true); i++) {
      const e = ifd + 2 + 12 * i, id = v.getUint16(e, true);
      if (![256, 258, 259, 317, 322, 324, 325].includes(id)) continue;
      const size = v.getUint16(e + 2, true) === 3 ? 2 : 4, count = v.getUint32(e + 4, true);
      const p = count * size > 4 ? v.getUint32(e + 8, true) : e + 8;
      tag[id] = Array.from({ length: count }, (_, k) => (size === 2 ? v.getUint16(p + 2 * k, true) : v.getUint32(p + 4 * k, true)));
    }
    if (tag[258][0] !== 8) continue; // a level's mask
    if (tag[259][0] !== 8 || (tag[317] && tag[317][0] !== 1) || tag[322][0] !== T) throw new Error('Tree heights: an unknown layout');
    levels[10 + Math.log2(tag[256][0] / T)] = { at: tag[324], n: tag[325] };
  }
  return levels;
}

async function canopyPiece(z, x, y) {
  const d = z - 10, q = quadkey(10, x >> d, y >> d);
  if (!indexes.has(q)) indexes.set(q, canopyIndex(q).catch((e) => { indexes.delete(q); throw e; }));
  const levels = await indexes.get(q);
  if (!levels) return NONE;
  const i = (y - ((y >> d) << d)) * 2 ** d + (x - ((x >> d) << d)), at = levels[z].at[i], n = levels[z].n[i];
  if (!n) return NONE;
  const res = await request('canopy', `${CANOPY}${q}.tif`, { headers: { Range: `bytes=${at}-${at + n - 1}` } });
  if (res.status !== 206) throw new Error(`Tree heights: ${res.status}`);
  return new Uint8Array(await new Response(res.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
}

const canopy = (z, x, y) => {
  const key = `${z}/${x}/${y}`;
  if (!pieces.has(key)) {
    pieces.set(key, canopyPiece(z, x, y).catch((e) => { pieces.delete(key); throw e; }));
    if (pieces.size > 32) pieces.delete(pieces.keys().next().value);
  }
  return pieces.get(key);
};

// ---- the buildings: OpenFreeMap's footprints ---------------------------------------------------------------
const text = new TextDecoder();

/** The `building` layer of a vector tile (protobuf, read by hand): each footprint's id, rings in tile units, and height. */
export function decodeBuildings(buf) {
  let p = 0;
  const varint = () => {
    let v = 0, s = 1, b;
    do { b = buf[p++]; v += (b & 0x7f) * s; s *= 128; } while (b & 0x80);
    return v;
  };
  const zigzag = () => { const n = varint(); return n % 2 ? -(n + 1) / 2 : n / 2; };
  const end = () => { const n = varint(); return p + n; };
  const skip = (w) => { if (w === 0) varint(); else { const n = w === 1 ? 8 : w === 5 ? 4 : varint(); p += n; } };
  // each field of a message up to `stop`: `on(field, wire)` reads the ones it wants and says so
  const each = (stop, on) => { while (p < stop) { const k = varint(); if (!on(k >> 3, k & 7)) skip(k & 7); } };
  const str = () => { const e = end(), s = text.decode(buf.subarray(p, e)); p = e; return s; };
  const out = [];
  each(buf.length, (f) => {
    if (f !== 3) return false;
    const layer = end(), keys = [], vals = [], feats = [];
    let name = '', extent = 4096;
    each(layer, (f) => {
      if (f === 1) name = str();
      else if (f === 2) { const e = end(); feats.push([p, e]); p = e; }
      else if (f === 3) keys.push(str());
      else if (f === 4) {
        let v = null;
        each(end(), (f) => {
          if (f === 2) { v = new DataView(buf.buffer, buf.byteOffset + p, 4).getFloat32(0, true); p += 4; }
          else if (f === 3) { v = new DataView(buf.buffer, buf.byteOffset + p, 8).getFloat64(0, true); p += 8; }
          else if (f === 4 || f === 5) v = varint();
          else if (f === 6) v = zigzag();
          else return false;
          return true;
        });
        vals.push(v);
      } else if (f === 5) extent = varint();
      else return false;
      return true;
    });
    if (name === 'building') {
      for (const [s, e] of feats) {
        p = s;
        let id = 0, h = 0, rings = null;
        each(e, (f) => {
          if (f === 1) id = varint();
          else if (f === 2) { const t = end(); while (p < t) { const k = keys[varint()], v = vals[varint()]; if (k === 'render_height') h = v; } }
          else if (f === 4) {
            // MoveTo starts a ring, LineTo goes on, ClosePath has no point; each point is a step from the last
            const t = end();
            let x = 0, y = 0, ring;
            rings = [];
            while (p < t) {
              const c = varint(), cmd = c & 7;
              for (let i = 0; i < (cmd === 7 ? 0 : c >> 3); i++) {
                x += zigzag(); y += zigzag();
                if (cmd === 1) rings.push((ring = []));
                ring.push((x * T) / extent, (y * T) / extent);
              }
            }
          } else return false;
          return true;
        });
        if (rings) out.push({ id, h, rings });
      }
    }
    p = layer;
    return true;
  });
  return out;
}

// The buildings' heights in the grid of 3 × 3 tiles around (x, y), from the zoom 14 tiles it covers, and the
// footprints of those in the middle tile, in the grid's pixels (their roofs' shade is counted from them).
async function buildings(z, x, y) {
  const tiles = await ofmTemplate(), N = 3 * S, k = S * 2 ** (z - OFM_Z), gx = (x - 1) * S, gy = (y - 1) * S, all = [];
  const at = [];
  for (let ty = Math.floor(gy / k); ty <= Math.floor((gy + N - 1) / k); ty++) for (let tx = Math.floor(gx / k); tx <= Math.floor((gx + N - 1) / k); tx++) at.push([tx, ty]);
  await Promise.all(at.map(async ([tx, ty]) => {
    // the map's own tiles, so the browser's cache (or the offline save) has them: through the map's path, not request()
    const res = await fetch(tiles.replace('{z}', OFM_Z).replace('{x}', tx).replace('{y}', ty));
    if (!res.ok) throw new Error(`Buildings: ${res.status}`);
    for (const b of decodeBuildings(new Uint8Array(await res.arrayBuffer()))) all.push({ ...b, ox: tx * k - gx, oy: ty * k - gy });
  }));
  const canvas = new OffscreenCanvas(N, N), g = canvas.getContext('2d', { willReadFrequently: true }), f = k / T;
  all.sort((a, b) => a.h - b.h); // the taller over the lower
  for (const b of all) {
    g.fillStyle = `rgb(${Math.min(255, Math.round(b.h))},0,0)`;
    g.beginPath();
    for (const r of b.rings) for (let i = 0; i < r.length; i += 2) g[i ? 'lineTo' : 'moveTo'](b.ox + r[i] * f, b.oy + r[i + 1] * f);
    g.fill('evenodd');
  }
  const px = g.getImageData(0, 0, N, N).data, out = new Uint8Array(N * N);
  for (let i = 0; i < out.length; i++) out[i] = px[i * 4];
  const roofs = [];
  for (const b of all) {
    const rings = b.rings.map((r) => r.map((v, i) => (i % 2 ? b.oy : b.ox) + v * f)), xs = rings.flatMap((r) => r.filter((_, i) => !(i % 2))), ys = rings.flatMap((r) => r.filter((_, i) => i % 2));
    if (Math.max(...xs) > S && Math.min(...xs) < 2 * S && Math.max(...ys) > S && Math.min(...ys) < 2 * S) roofs.push({ id: b.id, h: b.h, rings });
  }
  return { heights: out, roofs };
}

// ---- the tiles ------------------------------------------------------------------------------------------
let worker = null, ids = 0;
const waiting = new Map();
const sweep = (msg) => new Promise((ok, no) => {
  if (!worker) {
    worker = new Worker(new URL('./shadow-sweep.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => { const w = waiting.get(data.id); waiting.delete(data.id); if (data.error) w.no(new Error(data.error)); else w.ok(data); };
  }
  const id = ids++;
  waiting.set(id, { ok, no });
  worker.postMessage({ id, ...msg }, msg.ground ? [msg.grid.buffer, msg.ground.buffer] : [msg.grid.buffer]);
});

/**
 * Registers the protocol; `onFail(objects)` hears of a tile whose heights didn't load (`objects`: the trees' and
 * buildings' tiles), and `onRoofs(t, roofs)` of how much of each building in a tile is in shadow at t
 * (`{ id, s, n, w, k }`: shadeOf() in js/shadow-sweep.js).
 */
export function shadowProtocol(maplibre, dem, onFail, onRoofs) {
  maplibre.addProtocol('sunshadow', async (params, abort) => {
    const [, z, x, y, t] = params.url.match(/sunshadow:\/\/(\d+)\/(\d+)\/(\d+)\?t=(\d+)/).map(Number), objects = params.url.endsWith('&objects');
    const ll = tileLonLat(z, x, y), sun = sunPosition(t, ll);
    if (sun.alt <= 0.5) return { data: await (await new OffscreenCanvas(S, S).convertToBlob({ type: 'image/png' })).arrayBuffer() };
    let ground, trees, built;
    try {
      [ground, trees, built] = await Promise.all([
        heights((z, x, y) => dem.getDemTile(z, x, y, abort).then((d) => d.data), z, x, y),
        objects && heights(canopy, z, x, y),
        objects && buildings(z, x, y),
      ]);
    } catch (e) {
      if (!abort.signal.aborted) onFail(objects);
      throw e;
    }
    const m = (40075016 * Math.cos((ll[1] * Math.PI) / 180)) / 2 ** z / S;
    if (!objects) return { data: (await sweep({ grid: ground, N: 3 * S, az: sun.az, alt: sun.alt, m })).png };
    const grid = new Float32Array(ground.length);
    for (let i = 0; i < grid.length; i++) grid[i] = ground[i] + Math.max(trees[i], built.heights[i]);
    const { png, roofs } = await sweep({ grid, ground, N: 3 * S, az: sun.az, alt: sun.alt, m, roofs: built.roofs });
    onRoofs(t, roofs);
    return { data: png };
  });
}
