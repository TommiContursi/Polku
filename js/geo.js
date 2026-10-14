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
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
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
