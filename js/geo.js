/*! © 2026 Tommi Contursi. All rights reserved. See https://polku.si/LICENSE */
// Small geodesy helpers. Coordinates are [lon, lat] everywhere.

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

export function dist(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function lineLength(coords) {
  let d = 0;
  for (let i = 1; i < coords.length; i++) d += dist(coords[i - 1], coords[i]);
  return d;
}

export function bearing(a, b) {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x =
    Math.cos(rad(a[1])) * Math.sin(rad(b[1])) -
    Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Resample a line every `step` metres. Returns points plus, for each point,
// its distance along the line and the index of the source vertex it follows.
export function densify(coords, step) {
  const pts = [];
  const along = [];
  const src = [];
  if (!coords.length) return { pts, along, src };
  pts.push(coords[0]);
  along.push(0);
  src.push(0);
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const d = dist(a, b);
    if (d === 0) continue;
    const n = Math.max(1, Math.ceil(d / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      pts.push(lerp(a, b, t));
      along.push(acc + d * t);
      src.push(i - 1);
    }
    acc += d;
  }
  return { pts, along, src };
}

export function bbox(coords) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const c of coords) {
    if (c[0] < w) w = c[0];
    if (c[0] > e) e = c[0];
    if (c[1] < s) s = c[1];
    if (c[1] > n) n = c[1];
  }
  return [w, s, e, n];
}

// Whether point p is inside a GeoJSON Polygon or MultiPolygon (even–odd, so holes count).
export function inPolygon(p, g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return polys.some((rings) => {
    let inside = false;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  });
}

// Finland with its waters (#1200): Geofabrik's outline (data/finland-coverage.geojson) to two decimals, here so the
// check answers at once, offline too. The sources that stop at the border (MML, LIPAS, Väylävirasto, Fintraffic's
// roads, Digiroad) have data inside it, and none outside; Traficom's charts reach farther out to sea (js/main.js).
const FINLAND = { type: 'Polygon', coordinates: [[
  [27.97, 70.1], [28, 70.02], [28.16, 69.93], [28.35, 69.88], [28.35, 69.85], [29.14, 69.7], [29.35, 69.48],
  [29.25, 69.4], [28.86, 69.22], [28.82, 69.11], [28.87, 69.08], [28.96, 69.06], [28.43, 68.91], [28.82, 68.87],
  [28.72, 68.72], [28.64, 68.66], [28.54, 68.61], [28.54, 68.6], [28.45, 68.54], [28.66, 68.2], [29.33, 68.07],
  [30.03, 67.68], [29.96, 67.52], [29.66, 67.33], [29.1, 67], [29.07, 66.95], [29.07, 66.87], [29.34, 66.67],
  [29.48, 66.55], [29.72, 66.28], [29.93, 66.13], [30.08, 65.9], [30.12, 65.79], [30.15, 65.66], [29.74, 65.64],
  [29.88, 65.56], [29.74, 65.45], [29.77, 65.33], [29.62, 65.25], [29.89, 65.22], [29.91, 65.19], [29.84, 65.15],
  [29.93, 65.1], [29.64, 65.05], [29.65, 64.87], [29.72, 64.84], [29.7, 64.82], [30.06, 64.8], [30.11, 64.76],
  [30.05, 64.74], [30.19, 64.64], [30.02, 64.59], [30.09, 64.39], [30.14, 64.36], [30.23, 64.35], [30.49, 64.26],
  [30.51, 64.22], [30.48, 64.2], [30.57, 64.13], [30.54, 64.04], [30.27, 63.82], [29.98, 63.75], [30.61, 63.44],
  [30.83, 63.4], [31.25, 63.22], [31.51, 63.01], [31.62, 62.91], [31.48, 62.77], [31.41, 62.67], [31.2, 62.44],
  [30.97, 62.3], [30.72, 62.19], [30.08, 61.76], [29.62, 61.49], [29.35, 61.34], [29.19, 61.24], [28.97, 61.15],
  [28.84, 61.11], [28.67, 60.94], [28.54, 60.94], [28.25, 60.78], [27.88, 60.59], [27.86, 60.56], [27.8, 60.54],
  [27.75, 60.4], [27.58, 60.2], [26.93, 60.13], [26.49, 60.02], [25.06, 59.85], [20.58, 59.29], [19.78, 59.58],
  [19.02, 60.19], [20.22, 63.33], [21.97, 64.02], [24.05, 65.51], [24.15, 65.72], [24.12, 65.79], [24.15, 65.81],
  [24.14, 65.84], [24.12, 65.85], [23.85, 66.16], [23.66, 66.2], [23.6, 66.45], [23.76, 66.53], [23.79, 66.55],
  [23.86, 66.57], [23.86, 66.78], [23.96, 66.82], [23.52, 67.17], [23.56, 67.2], [23.51, 67.25], [23.73, 67.31],
  [23.71, 67.37], [23.67, 67.43], [23.46, 67.45], [23.36, 67.47], [23.45, 67.54], [23.44, 67.56], [23.53, 67.62],
  [23.47, 67.67], [23.46, 67.87], [23.6, 67.95], [23.37, 68.05], [23.28, 68.15], [23.13, 68.12], [23.13, 68.24],
  [22.64, 68.39], [22.03, 68.47], [21.37, 68.69], [20.77, 68.91], [20.88, 68.96], [20.57, 69.04], [20.54, 69.06],
  [20.71, 69.13], [21.03, 69.06], [21.06, 69.09], [20.92, 69.22], [21.26, 69.33], [21.65, 69.28], [22.35, 68.86],
  [22.38, 68.73], [22.56, 68.76], [23.04, 68.7], [23.17, 68.63], [23.69, 68.76], [23.77, 68.82], [23.92, 68.86],
  [24.17, 68.79], [24.17, 68.76], [24.78, 68.66], [24.91, 68.61], [25.07, 68.64], [25.11, 68.8], [25.35, 68.89],
  [25.64, 68.93], [25.73, 69.03], [25.67, 69.23], [25.79, 69.4], [25.78, 69.42], [25.82, 69.45], [25.85, 69.53],
  [25.82, 69.55], [25.96, 69.61], [25.87, 69.67], [26.51, 69.97], [27.29, 69.96], [27.25, 69.98], [27.58, 70.08],
  [27.97, 70.1]
]] };
export const inFinland = (p) => inPolygon(p, FINLAND);
// Any of the box [w, s, e, n] in a Polygon or MultiPolygon: a corner of the box in it, or a corner of it in the box.
// shortcut: a strip narrower than the box, crossing it with no corner in it, counts as outside; test the edges if one turns up.
export const polygonInView = (g, [w, s, e, n]) => [[w, s], [w, n], [e, s], [e, n]].some((p) => inPolygon(p, g))
  || (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).flat(2).some(([x, y]) => x >= w && x <= e && y >= s && y <= n);
export const finlandInView = (b) => polygonInView(FINLAND, b);
// Whether two boxes [w, s, e, n] overlap.
export const boxesMeet = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
// Any of the box where Digitraffic's AIS sees ships: Finland and the northern Baltic round it (as checked on 2026-11-20, #1200).
export const shipsInView = (b) => finlandInView(b) || boxesMeet(b, [17.8, 58.5, 30.5, 66]);

// Distance (m) from point p to segment ab, using a local equirectangular projection.
export function pointSegment(p, a, b) {
  const k = Math.cos(rad(p[1]));
  const ax = (a[0] - p[0]) * k, ay = a[1] - p[1];
  const bx = (b[0] - p[0]) * k, by = b[1] - p[1];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? -(ax * dx + ay * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = ax + dx * t, y = ay + dy * t;
  return { d: Math.sqrt(x * x + y * y) * 111195, t };
}

export function nearestOnLine(p, coords) {
  let best = { d: Infinity, i: 0, t: 0 };
  for (let i = 1; i < coords.length; i++) {
    const r = pointSegment(p, coords[i - 1], coords[i]);
    if (r.d < best.d) best = { d: r.d, i: i - 1, t: r.t };
  }
  return best;
}

// Ramer–Douglas–Peucker, tolerance in metres.
export function simplify(coords, tol) {
  if (coords.length < 3) return coords.slice();
  const keep = new Uint8Array(coords.length);
  keep[0] = keep[coords.length - 1] = 1;
  const stack = [[0, coords.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let max = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = pointSegment(coords[i], coords[s], coords[e]).d;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

// Google polyline encoding (precision 5) for compact share links.
export function encodePolyline(coords) {
  let out = '', plat = 0, plon = 0;
  const enc = (v) => {
    v = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
    return s + String.fromCharCode(v + 63);
  };
  for (const [lon, lat] of coords) {
    const la = Math.round(lat * 1e5), lo = Math.round(lon * 1e5);
    out += enc(la - plat) + enc(lo - plon);
    plat = la; plon = lo;
  }
  return out;
}

export function decodePolyline(str) {
  const coords = [];
  let i = 0, lat = 0, lon = 0;
  const dec = () => {
    let r = 0, s = 0, b;
    do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
    return r & 1 ? ~(r >> 1) : r >> 1;
  };
  while (i < str.length) {
    lat += dec();
    lon += dec();
    coords.push([lon / 1e5, lat / 1e5]);
  }
  return coords;
}

export function fmtDist(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
}

export function fmtDuration(s) {
  const t = Math.round(s / 60), h = Math.floor(t / 60), m = t % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

export const compass = (deg) =>
  ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((deg % 360) + 360) % 360 / 45) % 8];

// Tile maths (Web Mercator, XYZ)
export function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const s = Math.sin(rad(lat));
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
  return [x, y];
}

export function tileBounds(x, y, z) {
  const n = 2 ** z;
  const lon = (t) => (t / n) * 360 - 180;
  const lat = (t) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * t) / n))) * 180) / Math.PI;
  return [lon(x), lat(y + 1), lon(x + 1), lat(y)];
}

// ETRS-TM35FIN (EPSG:3067, Finland's grid) to [lon, lat]: Krüger's series on
// GRS80, good to a millimetre. LIPAS answers in its own grid at full precision
// (its EPSG:4326 output is rounded to 4 decimals, up to 11 m off).
const TM = (() => {
  const f = 1 / 298.257222101, n = f / (2 - f), n2 = n * n, n3 = n2 * n;
  return {
    A: (6378137 / (1 + n)) * (1 + n2 / 4 + (n2 * n2) / 64),
    b: [n / 2 - (2 / 3) * n2 + (37 / 96) * n3, n2 / 48 + n3 / 15, (17 / 480) * n3],
    d: [2 * n - (2 / 3) * n2 - 2 * n3, (7 / 3) * n2 - (8 / 5) * n3, (56 / 15) * n3],
  };
})();
export function tm35ToLonLat(x, y) {
  const k0 = 0.9996, xi = y / (k0 * TM.A), eta = (x - 500000) / (k0 * TM.A);
  let xp = xi, ep = eta;
  for (let j = 1; j <= 3; j++) {
    xp -= TM.b[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    ep -= TM.b[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const chi = Math.asin(Math.sin(xp) / Math.cosh(ep));
  let lat = chi;
  for (let j = 1; j <= 3; j++) lat += TM.d[j - 1] * Math.sin(2 * j * chi);
  const lon = 27 + (Math.atan2(Math.sinh(ep), Math.cos(xp)) * 180) / Math.PI;
  return [+lon.toFixed(6), +((lat * 180) / Math.PI).toFixed(6)];
}
