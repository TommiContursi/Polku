// Names of roads and paths near a point, from the vector tiles already loaded
// (OpenMapTiles' transportation_name layer): no extra requests. BRouter's
// answers carry no names; legs Valhalla routed bring their own (tags.name),
// which callers prefer. The index is rebuilt lazily after the map moves or
// new tiles arrive, at most once per change.

import { pointSegment } from './geo.js';

const CELL = 0.002; // degrees: about 110 × 220 m here
let index = null;
let dirty = true;

export function initNames(map) {
  const mark = () => { dirty = true; };
  map.on('moveend', mark);
  map.on('sourcedata', (e) => { if (e.sourceId === 'ofm' && e.isSourceLoaded) mark(); });
  return {
    /**
     * The name of the nearest named road or path within maxM metres, or ''.
     * With `dir` (degrees, the way you're going), only ways running roughly
     * the same way count: a street crossing under or over yours isn't it.
     */
    nameAt: (ll, maxM = 20, dir = null) => nameAt(map, ll, maxM, dir),
  };
}

function build(map) {
  index = new Map();
  dirty = false;
  let feats = [];
  try { feats = map.querySourceFeatures('ofm', { sourceLayer: 'transportation_name' }); } catch { return; }
  for (const f of feats) {
    const name = f.properties.name || f.properties['name:latin'] || f.properties.ref;
    if (!name || f.properties.subclass === 'corridor') continue; // indoor passages
    const g = f.geometry;
    const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    for (const c of lines) {
      for (let i = 1; i < c.length; i++) {
        const a = c[i - 1], b = c[i];
        const x0 = Math.floor(Math.min(a[0], b[0]) / CELL), x1 = Math.floor(Math.max(a[0], b[0]) / CELL);
        const y0 = Math.floor(Math.min(a[1], b[1]) / CELL), y1 = Math.floor(Math.max(a[1], b[1]) / CELL);
        if ((x1 - x0 + 1) * (y1 - y0 + 1) > 64) continue; // a stray long segment
        for (let x = x0; x <= x1; x++) {
          for (let y = y0; y <= y1; y++) {
            const k = `${x},${y}`;
            if (!index.has(k)) index.set(k, []);
            index.get(k).push([a, b, name, bearing(a, b)]);
          }
        }
      }
    }
  }
}

const bearing = (a, b) => (Math.atan2((b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), b[1] - a[1]) * 180) / Math.PI;
// 0 for parallel, 90 for crossing (either direction of travel)
const skew = (x, y) => { const d = Math.abs(((x - y) % 180 + 180) % 180); return Math.min(d, 180 - d); };

function nameAt(map, ll, maxM, dir) {
  if (dirty || !index) build(map);
  const x = Math.floor(ll[0] / CELL), y = Math.floor(ll[1] / CELL);
  let best = '', bd = maxM;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (const [a, b, name, ang] of index.get(`${x + dx},${y + dy}`) || []) {
        if (dir != null && skew(dir, ang) > 35) continue;
        const d = pointSegment(ll, a, b).d;
        if (d < bd) { bd = d; best = name; }
      }
    }
  }
  return best;
}
