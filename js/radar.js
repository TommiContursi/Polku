// Finnish rain radar from FMI's open data *download* service: one GeoTIFF of the
// national reflectivity composite per update, read here and drawn in Polku's
// own rain colours. FMI asks apps to fetch radar this way and draw it
// themselves; its WMS map tiles are for evaluation only (and the old layers go
// away in November 2026). Requested in Web Mercator, so the image lines up
// with the map with no reprojection.

import { request } from './net.js';

const FMI = 'https://openwms.fmi.fi/geoserver/Radar/wms';
// FMI's own rain rate (quality controlled, corrected for the melting layer): 16-bit, mm/h × 100.
// One of the old layers FMI phases out in November 2026; when it stops answering, the
// reflectivity below takes over on its own (ROADMAP: find its replacement before then).
const RATE = 'Radar:suomi_rr_eureffin';
// National CAPPI reflectivity, raw 8-bit: dBZ = 0.5 × v − 32, turned into mm/h with
// Marshall–Palmer. It overstates light rain near freezing (in Jyväskylä on 2026-10-14 it said
// 2–9 mm/h while FMI's rain rate said 0.01–0.05 and drizzle fell), so it's only the fallback.
const DBZ = 'Radar:radar_finland_cappi_dbzh';
export const FI_BOUNDS = [19, 59.3, 32.5, 70.3];

const mx = (lon) => (lon * 20037508.34) / 180;
const my = (lat) => (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * 20037508.34) / Math.PI;

/**
 * Radar for box [w, s, e, n] at width × height px → { url, coordinates } for an
 * image source, plus rateAt(lon, lat) in mm/h (null outside coverage).
 */
const fetchLayer = async (layer, box, width, height) => {
  const url = `${FMI}?service=WMS&version=1.1.1&request=GetMap&layers=${layer}&styles=raster&srs=EPSG:3857` +
    `&bbox=${mx(box[0]).toFixed(0)},${my(box[1]).toFixed(0)},${mx(box[2]).toFixed(0)},${my(box[3]).toFixed(0)}` +
    `&width=${width}&height=${height}&format=image/geotiff`;
  const res = await request('fmi', url);
  if (!res.ok) throw new Error(`FMI radar ${res.status}`);
  return readTiff(await res.arrayBuffer(), width, height);
};

// How strongly to paint a rate: the same as the forecast layer (wxmap.js), so "now" and the
// hours after read alike: drizzle a clear light blue, a shower solid (0.03 → 151, 1 → 195, 2+ → 235)
const alphaFor = (mmh) => Math.round(Math.min(235, 150 + mmh * 45));

export async function fmiRadar(box, width, height, colour) {
  // value → mm/h for each source, and which value means "outside coverage"
  let px, rate, outside, speckle;
  try {
    px = await fetchLayer(RATE, box, width, height);
    if (!(px instanceof Uint16Array)) throw new Error('rain rate: not 16-bit');
    rate = new Float32Array(65536);
    // from 0.03 mm/h: drizzle is mostly 0.01–0.1 here, and "a little rain" should show
    for (let v = 3; v < 65535; v++) rate[v] = v / 100;
    outside = 65535;
    speckle = 3; // FMI has already cleaned this product: only lone dots go
  } catch {
    px = await fetchLayer(DBZ, box, width, height);
    rate = new Float32Array(256);
    for (let v = 2; v < 255; v++) {
      const mmh = (10 ** ((0.5 * v - 32) / 10) / 200) ** 0.625; // Marshall–Palmer, Z = 200 R^1.6; 0–1 no echo
      if (mmh >= 0.3) rate[v] = mmh; // below this: barely damp, and mostly birds, insects and clutter
    }
    outside = 255;
    speckle = 5; // raw reflectivity: ships, turbines and waves echo as dots and lines
  }
  const lut = new Uint8ClampedArray(rate.length * 4);
  for (let v = 0; v < rate.length; v++) {
    const mmh = rate[v];
    if (!mmh) continue;
    if (mmh > 100) { lut.copyWithin(v * 4, (v - 1) * 4, v * 4); continue; } // the same colour beyond 100 mm/h
    const [r, g, b] = colour(mmh);
    lut.set([r, g, b, alphaFor(mmh)], v * 4);
  }
  const keep = despeckle(px, rate, width, height, speckle);
  const lut32 = new Uint32Array(lut.buffer);
  const raw = document.createElement('canvas');
  raw.width = width;
  raw.height = height;
  const img = raw.getContext('2d').createImageData(width, height);
  const out = new Uint32Array(img.data.buffer);
  let rain = 0;
  for (let i = 0; i < px.length; i++) if (keep[i]) { out[i] = lut32[px[i]]; rain++; }
  raw.getContext('2d').putImageData(img, 0, 0);
  // soft edges (browsers without canvas filters just skip it); the map's linear resampling does the rest
  const cv = document.createElement('canvas');
  cv.width = width;
  cv.height = height;
  const ctx = cv.getContext('2d');
  ctx.filter = 'blur(0.5px)'; // just the edges: at ~1 km a pixel, more smears scattered drizzle cells away
  ctx.drawImage(raw, 0, 0);
  const x0 = mx(box[0]), x1 = mx(box[2]), y0 = my(box[3]), y1 = my(box[1]);
  const rateAt = (lon, lat) => {
    const x = Math.floor(((mx(lon) - x0) / (x1 - x0)) * width), y = Math.floor(((y0 - my(lat)) / (y0 - y1)) * height);
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    const i = y * width + x;
    return px[i] === outside ? null : keep[i] ? rate[px[i]] : 0;
  };
  return { url: cv.toDataURL('image/png'), coordinates: [[box[0], box[3]], [box[2], box[3]], [box[2], box[1]], [box[0], box[1]]], rain, rateAt };
}

// Ships, wind turbines, waves and the like echo as dots and thin lines; rain
// comes in areas. Keep a wet pixel when ≥ `min` of its 8 neighbours are wet (5
// drops dots, lines and tiny clusters; 3, for FMI's cleaned rain rate, only lone
// dots, so thin drizzle stays), then give back the edge pixels next to what was
// kept, so real rain keeps its shape.
function despeckle(px, rate, w, h, min = 5) {
  const wet = new Uint8Array(px.length);
  for (let i = 0; i < px.length; i++) wet[i] = rate[px[i]] > 0 ? 1 : 0;
  const core = new Uint8Array(px.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!wet[i]) continue;
      const n = wet[i - w - 1] + wet[i - w] + wet[i - w + 1] + wet[i - 1] + wet[i + 1] + wet[i + w - 1] + wet[i + w] + wet[i + w + 1];
      if (n >= min) core[i] = 1;
    }
  }
  const keep = new Uint8Array(px.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (wet[i] && (core[i] || core[i - w - 1] || core[i - w] || core[i - w + 1] || core[i - 1] || core[i + 1] || core[i + w - 1] || core[i + w] || core[i + w + 1])) keep[i] = 1;
    }
  }
  return keep;
}

// Just enough TIFF for GeoServer's output: one 8- or 16-bit band, uncompressed strips.
function readTiff(buf, width, height) {
  const dv = new DataView(buf);
  const le = dv.getUint16(0) === 0x4949;
  const u16 = (o) => dv.getUint16(o, le);
  const u32 = (o) => dv.getUint32(o, le);
  const ifd = u32(4);
  const tags = {};
  const NEED = new Set([256, 257, 258, 259, 273, 279]); // size, bits, compression, strips
  for (let k = 0, n = u16(ifd); k < n; k++) {
    const e = ifd + 2 + k * 12;
    const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
    if (!NEED.has(tag) || (type !== 3 && type !== 4)) continue; // GeoTIFF keys, doubles, text: not needed
    const size = type === 3 ? 2 : 4;
    const at = size * count <= 4 ? e + 8 : u32(e + 8);
    tags[tag] = Array.from({ length: count }, (_, i) => (type === 3 ? u16(at + i * 2) : u32(at + i * 4)));
  }
  const bits = tags[258][0];
  if (tags[256][0] !== width || tags[257][0] !== height || (bits !== 8 && bits !== 16) || (tags[259] || [1])[0] !== 1) throw new Error('Unexpected radar file');
  const n = width * height;
  if (bits === 8) {
    const px = new Uint8Array(n);
    let o = 0;
    tags[273].forEach((off, i) => { const len = tags[279][i]; px.set(new Uint8Array(buf, off, Math.min(len, n - o)), o); o += len; });
    return px;
  }
  const px = new Uint16Array(n);
  let k = 0;
  tags[273].forEach((off, i) => { for (let b = 0; b + 1 < tags[279][i] && k < n; b += 2) px[k++] = dv.getUint16(off + b, le); });
  return px;
}
