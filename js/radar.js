// Finnish rain radar from FMI's open data *download* service: one GeoTIFF of the
// national rain-rate composite per update, read here and drawn in Polku's
// own rain colours. FMI asks apps to fetch radar this way and draw it
// themselves; its WMS map tiles are for evaluation only. Requested in Web
// Mercator, so the image lines up with the map with no client reprojection.

import { request } from './net.js';

const FMI = 'https://openwms.fmi.fi/geoserver/Radar/wms';
// The replacement for suomi_rr_eureffin. Its default "raster" style stretches
// float measurements to bytes per view: those bytes are NOT mm/h. Request our
// fixed colour encoding as a GeoTIFF download, then invert its explicit palette.
// Palette indexes themselves are arbitrary. The spare white background means
// missing coverage; zero rain has its own colour. Extended retains drizzle.
const RATE = 'Radar:radar_finland_cappi_rate';
const RATE_LEVELS = [0, 0.01, 0.1, 1, 10, 100, 1000];
const DBZ_LEVELS = [-32, -20, -10, 0, 10, 30, 95];
const CODES = ['000001', '0000ff', '00ffff', '00ff00', 'ffff00', 'ff0000', 'ff00ff'];
const numericStyle = (layer, levels) => '<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld"><NamedLayer>' +
  `<Name>${layer}</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><ColorMap extended="true">` +
  [[levels[0] - 1, CODES[0]], ...levels.map((q, i) => [q, CODES[i]]), ...(layer === RATE ? [] : [[255, 'ffffff']])]
    .map(([q, c]) => `<ColorMapEntry color="#${c}" quantity="${q}"/>`).join('') +
  '</ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>';
// National CAPPI reflectivity, decoded to dBZ and turned into mm/h with
// Marshall–Palmer. That is an approximation, especially in mixed precipitation,
// so the rain-rate measurement remains the first choice.
const DBZ = 'Radar:radar_finland_cappi_dbzh';
// GetFeatureInfo exposes dBZ for valid cells but leaves the raw no-data 255
// unscaled. Encode it as white explicitly, otherwise it saturates as heavy rain.
export const FI_BOUNDS = [19, 59.3, 32.5, 70.3];

const mx = (lon) => (lon * 20037508.34) / 180;
const my = (lat) => (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * 20037508.34) / Math.PI;
const latOf = (y) => (2 * Math.atan(Math.exp((y * Math.PI) / 20037508.34)) * 180) / Math.PI - 90;

/**
 * Radar for box [w, s, e, n] at width × height px → { coordinates, paint() } for an
 * image source, plus rateAt(lon, lat) in mm/h (null outside coverage).
 */
const fetchLayer = async (layer, box, width, height) => {
  const url = `${FMI}?service=WMS&version=1.1.1&request=GetMap&layers=${layer}&styles=raster&srs=EPSG:3857` +
    `&bbox=${mx(box[0]).toFixed(0)},${my(box[1]).toFixed(0)},${mx(box[2]).toFixed(0)},${my(box[3]).toFixed(0)}` +
    `&width=${width}&height=${height}&format=image/geotiff`;
  const query = new URL(url);
  query.searchParams.set('styles', '');
  query.searchParams.set('SLD_BODY', numericStyle(layer, layer === RATE ? RATE_LEVELS : DBZ_LEVELS));
  query.searchParams.set('interpolations', 'nearest neighbor');
  query.searchParams.set('bgcolor', '0xffffff');
  query.searchParams.set('transparent', 'false');
  const res = await request('fmi', query);
  if (!res.ok) throw new Error(`FMI radar ${res.status}`);
  return readTiff(await res.arrayBuffer(), width, height);
};

// The fixed path around RGB's edges encodes each interval in a different channel.
// Invert the palette colours, never their indexes; the server can reorder them.
// Quantization is at most 1/255 of each interval's span.
function measurements({ px, palette, photo }, levels) {
  if (!(px instanceof Uint16Array) || photo !== 3 || !palette || palette.length !== 3 * 65536) throw new Error('rain rate: no extended encoded palette');
  const n = palette.length / 3, rate = new Float32Array(n).fill(NaN), valid = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = palette[i] / 257, g = palette[n + i] / 257, b = palette[2 * n + i] / 257;
    if (![r, g, b].every(Number.isInteger)) continue;
    let segment, t;
    if (r === 255 && g === 255 && b === 255) { valid[i] = 1; continue; } // missing, not dry
    if (r === 0 && g === 0 && b >= 1) { segment = 0; t = (b - 1) / 254; }
    else if (r === 0 && b === 255) { segment = 1; t = g / 255; }
    else if (r === 0 && g === 255) { segment = 2; t = (255 - b) / 255; }
    else if (g === 255 && b === 0) { segment = 3; t = r / 255; }
    else if (r === 255 && b === 0) { segment = 4; t = (255 - g) / 255; }
    else if (r === 255 && g === 0) { segment = 5; t = b / 255; }
    else continue;
    valid[i] = 1;
    rate[i] = levels[segment] + t * (levels[segment + 1] - levels[segment]);
  }
  // Reject an ignored style or an unexpected encoding instead of painting
  // arbitrary byte values as rainfall. Unused palette slots may be padding.
  for (const v of px) if (!valid[v]) throw new Error('rain rate: unexpected palette colour');
  return rate;
}

export async function fmiRadar(box, width, height) {
  // value → mm/h for each source, and which value means "outside coverage"
  let px, rate, speckle;
  try {
    const image = await fetchLayer(RATE, box, width, height);
    rate = measurements(image, RATE_LEVELS);
    for (let i = 0; i < rate.length; i++) if (Number.isFinite(rate[i])) {
      const rounded = Math.round(rate[i] * 100) / 100;
      rate[i] = rounded >= 0.03 ? rounded : 0;
    }
    px = image.px;
    speckle = 3; // FMI has already cleaned this product: only lone dots go
  } catch {
    const image = await fetchLayer(DBZ, box, width, height);
    px = image.px;
    rate = measurements(image, DBZ_LEVELS);
    for (let v = 0; v < rate.length; v++) if (Number.isFinite(rate[v])) {
      const mmh = (10 ** (rate[v] / 10) / 200) ** 0.625; // Marshall–Palmer, Z = 200 R^1.6
      rate[v] = mmh >= 0.3 ? mmh : 0; // retain the fallback's stricter clutter threshold
    }
    speckle = 5; // raw reflectivity: ships, turbines and waves echo as dots and lines
  }
  const keep = despeckle(px, rate, width, height, speckle);
  let rain = 0;
  for (let i = 0; i < px.length; i++) if (keep[i] && rate[px[i]]) rain++;
  const x0 = mx(box[0]), x1 = mx(box[2]), y0 = my(box[3]), y1 = my(box[1]);
  const rateAt = (lon, lat) => {
    const x = Math.floor(((mx(lon) - x0) / (x1 - x0)) * width), y = Math.floor(((y0 - my(lat)) / (y0 - y1)) * height);
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    const i = y * width + x;
    return Number.isNaN(rate[px[i]]) ? null : keep[i] ? rate[px[i]] : 0;
  };
  // Drawn in the caller's colours: colour(mm/h, snow) → [r, g, b, a] or null; snowAt(lon, lat) says where it
  // falls as snow (asked for each 8 px block); blur softens the edges (browsers without canvas filters skip it).
  // Again when the colours' inputs change (Effects, the forecast's temperatures), with no new request.
  const paint = (colour, { snowAt = null, blur = 0.5 } = {}) => {
    const lut = (snow) => {
      const t = new Uint8ClampedArray(rate.length * 4);
      for (let v = 0; v < rate.length; v++) {
        const c = rate[v] ? colour(Math.min(rate[v], 100), snow) : null; // palette indexes need not be in rate order
        if (c) t.set(c, v * 4);
      }
      return new Uint32Array(t.buffer);
    };
    const wet = lut(false), white = snowAt ? lut(true) : wet;
    const B = 8, bw = Math.ceil(width / B), snowy = new Uint8Array(snowAt ? bw * Math.ceil(height / B) : 0);
    for (let k = 0; k < snowy.length; k++) {
      const x = ((k % bw) * B + B / 2) / width, y = (Math.floor(k / bw) * B + B / 2) / height;
      snowy[k] = snowAt(box[0] + (box[2] - box[0]) * x, latOf(y0 + (y1 - y0) * y)) ? 1 : 0;
    }
    const raw = document.createElement('canvas');
    raw.width = width;
    raw.height = height;
    const img = raw.getContext('2d').createImageData(width, height);
    const out = new Uint32Array(img.data.buffer);
    for (let i = 0; i < px.length; i++) {
      if (!keep[i]) continue;
      const x = i % width, y = (i - x) / width;
      out[i] = (snowy.length && snowy[Math.floor(y / B) * bw + Math.floor(x / B)] ? white : wet)[px[i]];
    }
    raw.getContext('2d').putImageData(img, 0, 0);
    const cv = document.createElement('canvas');
    cv.width = width;
    cv.height = height;
    const ctx = cv.getContext('2d');
    ctx.filter = `blur(${blur}px)`; // at ~1 km a pixel, much more smears scattered drizzle cells away
    ctx.drawImage(raw, 0, 0);
    return cv.toDataURL('image/png');
  };
  return { coordinates: [[box[0], box[3]], [box[2], box[3]], [box[2], box[1]], [box[0], box[1]]], rain, rateAt, paint };
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
  if (dv.byteLength < 8 || ![0x4949, 0x4d4d].includes(dv.getUint16(0))) throw new Error('Not a TIFF');
  const le = dv.getUint16(0) === 0x4949;
  const u16 = (o) => dv.getUint16(o, le);
  const u32 = (o) => dv.getUint32(o, le);
  if (u16(2) !== 42) throw new Error('Not a classic TIFF');
  const ifd = u32(4);
  const tags = {};
  const NEED = new Set([256, 257, 258, 259, 262, 273, 277, 279, 320, 339]); // size, layout, strips, palette
  for (let k = 0, n = u16(ifd); k < n; k++) {
    const e = ifd + 2 + k * 12;
    const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
    if (!NEED.has(tag) || (type !== 3 && type !== 4)) continue; // GeoTIFF keys, doubles, text: not needed
    const size = type === 3 ? 2 : 4;
    const at = size * count <= 4 ? e + 8 : u32(e + 8);
    tags[tag] = Array.from({ length: count }, (_, i) => (type === 3 ? u16(at + i * 2) : u32(at + i * 4)));
  }
  const bits = tags[258][0];
  if (tags[256][0] !== width || tags[257][0] !== height || (bits !== 8 && bits !== 16) ||
      (tags[259] || [1])[0] !== 1 || (tags[277] || [1])[0] !== 1 || (tags[339] || [1])[0] !== 1) throw new Error('Unexpected radar file');
  const n = width * height;
  if (!tags[273] || !tags[279] || tags[273].length !== tags[279].length ||
      tags[279].reduce((a, b) => a + b, 0) !== n * bits / 8 ||
      tags[273].some((off, i) => off + tags[279][i] > dv.byteLength || tags[279][i] % (bits / 8))) throw new Error('Incomplete radar strips');
  const meta = { photo: tags[262]?.[0], palette: tags[320] };
  if (bits === 8) {
    const px = new Uint8Array(n);
    let o = 0;
    tags[273].forEach((off, i) => { const len = tags[279][i]; px.set(new Uint8Array(buf, off, Math.min(len, n - o)), o); o += len; });
    return { px, ...meta };
  }
  const px = new Uint16Array(n);
  let k = 0;
  tags[273].forEach((off, i) => { for (let b = 0; b + 1 < tags[279][i] && k < n; b += 2) px[k++] = dv.getUint16(off + b, le); });
  return { px, ...meta };
}

// RainViewer's coverage (#182): a tile is opaque where no radar reaches and clear where one does. For the hatch where
// there's no radar, where RainViewer's radar is the one drawn. 256 px tiles at zoom z, kept for the session (a failed
// one is asked for again next time). → (lon, lat) → true covered, false not, null not known.
const coverTiles = new Map();
const coverTile = (k) => {
  if (!coverTiles.has(k)) {
    coverTiles.set(k, (async () => {
      const res = await request('rainviewer', `https://tilecache.rainviewer.com/v2/coverage/0/256/${k}/0/0_0.png`);
      if (!res.ok) throw new Error(`RainViewer coverage ${res.status}`);
      const cv = new OffscreenCanvas(256, 256), ctx = cv.getContext('2d');
      ctx.drawImage(await createImageBitmap(await res.blob()), 0, 0);
      const d = ctx.getImageData(0, 0, 256, 256).data, a = new Uint8Array(256 * 256);
      for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
      return a;
    })().catch(() => { coverTiles.delete(k); return null; }));
  }
  return coverTiles.get(k);
};

export async function rainviewerCoverage(box, z) {
  const n = 2 ** z, tx = (lon) => ((lon + 180) / 360) * n;
  const ty = (lat) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
  const keys = [];
  for (let x = Math.floor(tx(box[0])); x <= Math.floor(tx(box[2])); x++) {
    for (let y = Math.max(0, Math.floor(ty(box[3]))); y <= Math.min(n - 1, Math.floor(ty(box[1]))); y++) keys.push(`${z}/${((x % n) + n) % n}/${y}`);
  }
  const got = new Map(await Promise.all(keys.map(async (k) => [k, await coverTile(k)])));
  return (lon, lat) => {
    const fx = tx(lon), fy = ty(lat), x = Math.floor(fx), y = Math.floor(fy), a = got.get(`${z}/${((x % n) + n) % n}/${y}`);
    return a ? a[Math.min(255, Math.floor((fy - y) * 256)) * 256 + Math.min(255, Math.floor((fx - x) * 256))] < 128 : null;
  };
}
