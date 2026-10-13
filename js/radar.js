// Finnish rain radar from FMI's open data *download* service: one GeoTIFF of the
// national reflectivity composite per update, read here and drawn in Polku's
// own rain colours. FMI asks apps to fetch radar this way and draw it
// themselves; its WMS map tiles are for evaluation only (and the old layers go
// away in November 2026). Requested in Web Mercator, so the image lines up
// with the map with no reprojection.

import { request } from './net.js';

const FMI = 'https://openwms.fmi.fi/geoserver/Radar/wms';
const LAYER = 'Radar:radar_finland_cappi_dbzh'; // national CAPPI composite, raw 8-bit: dBZ = 0.5 × v − 32
export const FI_BOUNDS = [19, 59.3, 32.5, 70.3];

const mx = (lon) => (lon * 20037508.34) / 180;
const my = (lat) => (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * 20037508.34) / Math.PI;

/**
 * Radar for box [w, s, e, n] at width × height px → { url, coordinates } for an
 * image source, plus rateAt(lon, lat) in mm/h (null outside coverage).
 */
export async function fmiRadar(box, width, height, colour) {
  const url = `${FMI}?service=WMS&version=1.1.1&request=GetMap&layers=${LAYER}&styles=raster&srs=EPSG:3857` +
    `&bbox=${mx(box[0]).toFixed(0)},${my(box[1]).toFixed(0)},${mx(box[2]).toFixed(0)},${my(box[3]).toFixed(0)}` +
    `&width=${width}&height=${height}&format=image/geotiff`;
  const res = await request('fmi', url);
  if (!res.ok) throw new Error(`FMI radar ${res.status}`);
  const px = readTiff(await res.arrayBuffer(), width, height);
  // value → mm/h: Marshall–Palmer (Z = 200 R^1.6); 0–1 no echo, 255 outside coverage
  const rate = new Float32Array(256);
  const lut = new Uint8ClampedArray(256 * 4);
  for (let v = 2; v < 255; v++) {
    const mmh = (10 ** ((0.5 * v - 32) / 10) / 200) ** 0.625;
    if (mmh < 0.3) continue; // below this: barely damp, and mostly birds, insects and clutter
    rate[v] = mmh;
    const [r, g, b] = colour(mmh);
    lut.set([r, g, b, Math.round(Math.min(235, 150 + mmh * 45))], v * 4);
  }
  const keep = despeckle(px, rate, width, height);
  const lut32 = new Uint32Array(lut.buffer);
  const raw = document.createElement('canvas');
  raw.width = width;
  raw.height = height;
  const img = raw.getContext('2d').createImageData(width, height);
  const out = new Uint32Array(img.data.buffer);
  let rain = 0;
  for (let i = 0; i < px.length; i++) if (keep[i]) { out[i] = lut32[px[i]]; rain++; }
  raw.getContext('2d').putImageData(img, 0, 0);
  // soft edges, like the forecast layer (browsers without canvas filters just skip it)
  const cv = document.createElement('canvas');
  cv.width = width;
  cv.height = height;
  const ctx = cv.getContext('2d');
  ctx.filter = 'blur(1.2px)';
  ctx.drawImage(raw, 0, 0);
  const x0 = mx(box[0]), x1 = mx(box[2]), y0 = my(box[3]), y1 = my(box[1]);
  const rateAt = (lon, lat) => {
    const x = Math.floor(((mx(lon) - x0) / (x1 - x0)) * width), y = Math.floor(((y0 - my(lat)) / (y0 - y1)) * height);
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    const i = y * width + x;
    return px[i] === 255 ? null : keep[i] ? rate[px[i]] : 0;
  };
  return { url: cv.toDataURL('image/png'), coordinates: [[box[0], box[3]], [box[2], box[3]], [box[2], box[1]], [box[0], box[1]]], rain, rateAt };
}

// Ships, wind turbines, waves and the like echo as dots and thin lines; rain
// comes in areas. Keep a wet pixel when ≥ 5 of its 8 neighbours are wet (that
// drops dots, lines and tiny clusters), then give back the edge pixels next to
// what was kept, so real rain keeps its shape.
function despeckle(px, rate, w, h) {
  const wet = new Uint8Array(px.length);
  for (let i = 0; i < px.length; i++) wet[i] = rate[px[i]] > 0 ? 1 : 0;
  const core = new Uint8Array(px.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!wet[i]) continue;
      const n = wet[i - w - 1] + wet[i - w] + wet[i - w + 1] + wet[i - 1] + wet[i + 1] + wet[i + w - 1] + wet[i + w] + wet[i + w + 1];
      if (n >= 5) core[i] = 1;
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

// Just enough TIFF for GeoServer's output: one 8-bit band, uncompressed strips.
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
  if (tags[256][0] !== width || tags[257][0] !== height || tags[258][0] !== 8 || (tags[259] || [1])[0] !== 1) throw new Error('Unexpected radar file');
  const px = new Uint8Array(width * height);
  let o = 0;
  tags[273].forEach((off, i) => { const len = tags[279][i]; px.set(new Uint8Array(buf, off, Math.min(len, px.length - o)), o); o += len; });
  return px;
}
