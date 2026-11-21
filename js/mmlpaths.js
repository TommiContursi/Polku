// MML's paths, forest tracks and drives that OpenStreetMap lacks (#1171), from the app's own distance test on the tiles the
// map has already loaded: no request of its own. In each zoom-14 tile, MML's lines (`liikenne`) are cut where an OSM way of any
// kind (OpenFreeMap's `transportation`: roads, tracks, paths; not railways, ferries or lifts) is within 15 m, and the pieces of
// 50 m or more are kept. Once per tile, when both sources' tile is in: OpenFreeMap's zoom-13 tiles are thinned (#1128), so only
// zoom 14's, and a feature of a lower tile (far off in 3D) is left out. Routes follow OSM's ways only, so these are drawn in a
// look of their own (js/style.js) and their card says so.

export const MML_PATH_CLASSES = [12313, 12316, 12141]; // path, forest track, drive (ajotie: private and forest roads)
const NEAR = 15, MIN = 50, STEP = 5, TWICE = 3; // metres
const NOT_WAYS = ['rail', 'transit', 'ferry', 'aerialway'];
const EMPTY = { type: 'FeatureCollection', features: [] };
const lines = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);

/**
 * The pieces of MML's lines with no OSM way within 15 m, 50 m long or more: features with `kohdeluokka`. `mml`: [{ cls,
 * coords }], `osm`: [coords], [lon, lat] each; `bounds` [w, s, e, n]: the tile, as a feature in its buffer is in the next
 * tile's too (a piece runs over the edge by one step at most, so the two meet).
 */
export function missingPieces(mml, osm, bounds) {
  const lat0 = (bounds[1] + bounds[3]) / 2, kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110574;
  const xy = ([lon, lat]) => [lon * kx, lat * ky], cell = (v) => Math.floor(v / NEAR);
  // OSM's segments by the cells of NEAR metres they come within NEAR of
  const grid = new Map();
  for (const c of osm) {
    for (let i = 1; i < c.length; i++) {
      const [ax, ay] = xy(c[i - 1]), [bx, by] = xy(c[i]);
      for (let gx = cell(Math.min(ax, bx) - NEAR); gx <= cell(Math.max(ax, bx) + NEAR); gx++)
        for (let gy = cell(Math.min(ay, by) - NEAR); gy <= cell(Math.max(ay, by) + NEAR); gy++) {
          const k = `${gx}/${gy}`;
          (grid.get(k) || grid.set(k, []).get(k)).push([ax, ay, bx, by]);
        }
    }
  }
  const near = (x, y) => (grid.get(`${cell(x)}/${cell(y)}`) || []).some(([ax, ay, bx, by]) => {
    const dx = bx - ax, dy = by - ay, t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
    return Math.hypot(x - ax - t * dx, y - ay - t * dy) <= NEAR;
  });
  const inside = ([lon, lat]) => lon >= bounds[0] && lon <= bounds[2] && lat >= bounds[1] && lat <= bounds[3];
  // a line MML has twice (a feature split in the tile, two classes on one way) is drawn once
  const drawn = new Map(), at = (x, y) => `${Math.floor(x / STEP)}/${Math.floor(y / STEP)}`;
  const seen = (x, y) => {
    const gx = Math.floor(x / STEP), gy = Math.floor(y / STEP);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if ((drawn.get(`${gx + i}/${gy + j}`) || []).some(([px, py]) => Math.hypot(x - px, y - py) <= TWICE)) return true;
    return false;
  };
  const claim = (pts) => { for (const [x, y] of pts) (drawn.get(at(x, y)) || drawn.set(at(x, y), []).get(at(x, y))).push([x, y]); };
  const out = [];
  for (const { cls, coords } of mml) {
    // the line every STEP metres at most, with its own points
    const pts = [];
    for (let i = 0; i < coords.length; i++) {
      if (i) {
        const [ax, ay] = xy(coords[i - 1]), [bx, by] = xy(coords[i]), n = Math.ceil(Math.hypot(bx - ax, by - ay) / STEP);
        for (let s = 1; s < n; s++) pts.push([coords[i - 1][0] + ((coords[i][0] - coords[i - 1][0]) * s) / n, coords[i - 1][1] + ((coords[i][1] - coords[i - 1][1]) * s) / n]);
      }
      pts.push(coords[i]);
    }
    // a point is kept with no OSM way near it, not drawn already, in the tile or one step past its edge
    const keep = pts.map((p, i) => { const [x, y] = xy(p); return !near(x, y) && !seen(x, y) && (inside(p) || inside(pts[i - 1] || p) || inside(pts[i + 1] || p)); });
    let run = [];
    const end = () => {
      let len = 0;
      for (let i = 1; i < run.length; i++) { const [ax, ay] = xy(run[i - 1]), [bx, by] = xy(run[i]); len += Math.hypot(bx - ax, by - ay); }
      if (len >= MIN) { out.push({ type: 'Feature', properties: { kohdeluokka: cls }, geometry: { type: 'LineString', coordinates: run } }); claim(run.map(xy)); }
      run = [];
    };
    pts.forEach((p, i) => { if (keep[i]) run.push(p); else end(); });
    end();
  }
  return out;
}

/** Keeps the map's `mmlPaths` source to the missing pieces of the zoom-14 tiles loaded, each worked out once. */
export class MmlPaths {
  constructor(map, onData) {
    this.map = map;
    this.onData = onData;
    this.done = new Map(); // 'x/y' → its pieces
    this.osmIn = new Set(); // OpenFreeMap's zoom-14 tiles come in: 'x/y'
    this.timer = 0;
    map.on('sourcedata', (e) => {
      const t = e.tile && e.tile.tileID.canonical;
      if (!t || t.z !== 14 || (e.sourceId !== 'mml' && e.sourceId !== 'ofm')) return;
      if (e.sourceId === 'ofm') this.osmIn.add(`${t.x}/${t.y}`);
      this.schedule();
    });
    map.on('moveend', () => this.schedule());
  }
  schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => { this.timer = 0; this.update(); }, 300); }
  // a test still to run: what comes after the map stops waits for it (#1091)
  get busy() { return !!this.timer; }
  update() {
    const m = this.map;
    if (m.getZoom() < 14 || !m.getSource('mml')) { this.onData(EMPTY); return; }
    const byTile = (list, f) => {
      if (f._z !== 14) return list; // (a lower tile, far off in 3D)
      const k = `${f._x}/${f._y}`;
      (list.get(k) || list.set(k, []).get(k)).push(f);
      return list;
    };
    const mml = m.querySourceFeatures('mml', { sourceLayer: 'liikenne', filter: ['in', ['get', 'kohdeluokka'], ['literal', MML_PATH_CLASSES]] }).reduce(byTile, new Map());
    const osm = m.querySourceFeatures('ofm', { sourceLayer: 'transportation', filter: ['!', ['in', ['get', 'class'], ['literal', NOT_WAYS]]] }).reduce(byTile, new Map());
    const lon = (v) => (v / 2 ** 14) * 360 - 180, lat = (v) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * v) / 2 ** 14))) * 180) / Math.PI;
    for (const [k, feats] of mml) {
      if (this.done.has(k) || !this.osmIn.has(k)) continue;
      const [x, y] = k.split('/').map(Number);
      this.done.set(k, missingPieces(feats.flatMap((f) => lines(f.geometry).map((coords) => ({ cls: f.properties.kohdeluokka, coords }))),
        (osm.get(k) || []).flatMap((f) => lines(f.geometry)), [lon(x), lat(y + 1), lon(x + 1), lat(y)]));
    }
    // (kept for when the map comes back to them, a few hundred tiles at most)
    for (const k of this.done.keys()) if (this.done.size > 300 && !mml.has(k)) this.done.delete(k);
    this.onData({ type: 'FeatureCollection', features: [...mml.keys()].flatMap((k) => this.done.get(k) || []) });
  }
}
