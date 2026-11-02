// Immutable OSM releases: only the selected tiles are downloaded, through the app's network door.
import { request } from './net.js';
import { idb } from './idb.js';
import { tileBounds } from './geo.js';

const cache = idb('overpass');
const TIMEOUT = 8000;
const releases = new Map(); // one release per URL/page, shared by the ways and lighting readers
let finlandCoverage;

// Corners alone miss a hole or a concave border passing through a tile. Any border contact uses Overpass.
function covers(geometry, [w, s, e, n]) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : null;
  if (!Array.isArray(polygons) || !polygons.length || !polygons.every((rings) => Array.isArray(rings) && rings.length && rings.every((r) => Array.isArray(r) && r.length >= 4
    && r.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)
    && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]))) throw new Error('Invalid OSM coverage');
  const inside = ([x, y], ring) => {
    let yes = false;
    for (let i = 1; i < ring.length; i++) {
      const [a, b] = ring[i - 1], [c, d] = ring[i];
      if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) yes = !yes;
    }
    return yes;
  };
  const crosses = (a, b) => {
    let lo = 0, hi = 1;
    for (const [axis, min, max] of [[0, w, e], [1, s, n]]) {
      const delta = b[axis] - a[axis];
      if (!delta) { if (a[axis] < min || a[axis] > max) return false; }
      else {
        const t = [(min - a[axis]) / delta, (max - a[axis]) / delta].sort((x, y) => x - y);
        lo = Math.max(lo, t[0]); hi = Math.min(hi, t[1]);
        if (lo > hi) return false;
      }
    }
    return true;
  };
  return polygons.some((rings) => [[w, s], [e, s], [e, n], [w, n]].every((p) => inside(p, rings[0]) && !rings.slice(1).some((r) => inside(p, r)))
    && !rings.some((r) => r.slice(1).some((p, i) => crosses(r[i], p))));
}

export class StaticOSM {
  constructor(url, dataset = 'ways', zoom = 14) {
    this.url = url;
    this.dataset = dataset;
    this.zoom = zoom;
    this.reader = null;
    this.tiles = new Map();
  }

  async ready() {
    if (!releases.has(this.url)) releases.set(this.url, (async () => {
      const key = `static/manifest/${this.url}`;
      const hit = await cache.get(key).catch(() => null);
      let manifest;
      try {
        const res = await request('osmdata', this.url, { timeoutMs: TIMEOUT, cache: 'no-store', credentials: 'omit' });
        if (!res.ok) throw new Error(`OSM manifest: HTTP ${res.status}`);
        manifest = await res.json();
      } catch (err) {
        if (!hit) throw err;
        manifest = hit.json;
      }
      if (manifest?.schema !== 1 || !manifest.release || !Number.isFinite(Date.parse(manifest.source?.timestamp))
        || !Array.isArray(manifest.bounds) || manifest.bounds.length !== 4 || !manifest.bounds.every(Number.isFinite)
        || !manifest.datasets) throw new Error('Unsupported OSM manifest schema');
      cache.set(key, { at: Date.now(), json: manifest }).catch(() => {});
      return manifest;
    })().catch((err) => { releases.delete(this.url); throw err; }));
    const manifest = await releases.get(this.url), d = manifest.datasets[this.dataset];
    if (d?.format !== 'pmtiles-json' || d.schema !== 1 || d.zoom !== this.zoom || !Number.isSafeInteger(d.bytes) || d.bytes < 127) throw new Error('Unsupported OSM dataset');
    const url = new URL(d.url, this.url), base = new URL(this.url);
    if (url.origin !== base.origin || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid OSM archive URL');
    return { manifest, url: url.href, bytes: d.bytes };
  }

  async tile([x, y], { force = false } = {}) {
    if (![x, y].every((v) => Number.isInteger(v) && v >= 0 && v < 2 ** this.zoom)) throw new Error('Invalid OSM tile');
    const { manifest, url, bytes } = await this.ready();
    const bounds = tileBounds(x, y, this.zoom), [w, s, e, n] = bounds, [west, south, east, north] = manifest.bounds;
    if (e < west || w > east || n < south || s > north) throw new Error('Outside static OSM coverage');
    const key = `static/${url}/${manifest.release}/${this.zoom}/${x}/${y}`;
    if (force) { this.tiles.delete(key); this.reader = null; }
    if (this.tiles.has(key)) return this.tiles.get(key);
    const promise = (async () => {
      const hit = await cache.get(key).catch(() => null);
      if (hit) return hit.json;
      let coverage = manifest.coverage;
      if (!coverage && manifest.source.url === 'https://download.geofabrik.de/europe/finland-latest.osm.pbf') {
        // The first published release predates embedded coverage; cached tiles still work without this asset.
        if (!finlandCoverage) finlandCoverage = request('polku', new URL('../data/finland-coverage.geojson', import.meta.url), { credentials: 'omit', timeoutMs: TIMEOUT })
          .then((r) => { if (!r.ok) throw new Error('OSM coverage unavailable'); return r.json(); })
          .catch((err) => { finlandCoverage = null; throw err; });
        coverage = await finlandCoverage;
      }
      if (coverage && !covers(coverage, bounds)) throw new Error('Outside static OSM coverage');
      const { PMTiles } = await import('./vendor/pmtiles-4.5.0.js');
      if (!this.reader) this.reader = new PMTiles({
        getKey: () => url,
        getBytes: async (offset, length, signal) => {
          const end = Math.min(bytes, offset + length) - 1;
          if (offset < 0 || end < offset || length > 8 * 1024 * 1024) throw new Error('Invalid OSM Range');
          const res = await request('osmdata', url, { headers: { Range: `bytes=${offset}-${end}` }, signal, timeoutMs: TIMEOUT, credentials: 'omit' });
          if (res.status !== 206 || res.headers.get('Content-Range') !== `bytes ${offset}-${end}/${bytes}` || res.headers.get('Content-Encoding')) {
            await res.body?.cancel();
            throw new Error('OSM hosting needs exact HTTP Range responses without HTTP compression');
          }
          const data = await res.arrayBuffer();
          if (data.byteLength !== end - offset + 1) throw new Error('Incomplete OSM Range');
          return { data };
        },
      });
      const tile = await this.reader.getZxy(this.zoom, x, y);
      if (tile && tile.data.byteLength > 32 * 1024 * 1024) throw new Error('OSM tile too large');
      const json = tile ? JSON.parse(new TextDecoder().decode(tile.data)) : { schema: 1, elements: [] };
      if (json.schema !== 1 || !Array.isArray(json.elements)) throw new Error('Invalid OSM tile schema');
      for (const w of json.elements) if (w.type === 'way' && (!Number.isSafeInteger(w.id) || !w.tags
        || !Array.isArray(w.nodes) || w.nodes.length < 2 || w.nodes.length !== w.geometry?.length
        || !w.nodes.every(Number.isSafeInteger) || !w.geometry.every((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat)))) throw new Error('Incomplete OSM way geometry');
      cache.set(key, { at: Date.now(), json }).catch(() => {});
      return json;
    })().catch((err) => { if (this.tiles.get(key) === promise) { this.tiles.delete(key); this.reader = null; } throw err; });
    this.tiles.set(key, promise);
    if (this.tiles.size > 64) this.tiles.delete(this.tiles.keys().next().value);
    return promise;
  }
}
