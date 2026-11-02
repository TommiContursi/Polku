// Immutable OSM releases: only the selected tiles are downloaded, through the app's network door.
import { request } from './net.js';
import { idb } from './idb.js';
import { tileBounds } from './geo.js';

const cache = idb('overpass');
const TIMEOUT = 8000;
const releases = new Map(); // one release per URL/page, shared by the ways and lighting readers
let finlandCoverage;
const readers = new Map(), pending = new Map();

function deadline(run) {
  const ctrl = new AbortController();
  let timer;
  const expired = new Promise((_, no) => { timer = setTimeout(() => {
    ctrl.abort(); no(new Error('Hosted OSM request timed out'));
  }, TIMEOUT); });
  return Promise.race([run(ctrl.signal), expired]).finally(() => clearTimeout(timer));
}

/** Share raw reads; each caller keeps its adapter and public fallback shape. */
export function hostedTile(url, dataset, zoom, xy, fallback, { force = false, slim = (j) => j } = {}) {
  const key = `${url}/${dataset}/${zoom}/${xy.join('/')}`;
  let entry = !force && pending.get(key);
  if (!entry) {
    const readerKey = `${url}/${dataset}/${zoom}`;
    if (!readers.has(readerKey)) readers.set(readerKey, new StaticOSM(url, dataset, zoom));
    entry = { raw: url ? readers.get(readerKey).tile(xy, { force }) : Promise.reject(new Error('Hosted OSM unavailable')), fallbacks: new Map() };
    pending.set(key, entry);
  }
  return entry.raw.then((json) => ({ ...slim(json), source: json.source })).catch((err) => {
    if (!entry.fallbacks.has(fallback)) entry.fallbacks.set(fallback, Promise.resolve().then(() => fallback(err)));
    return entry.fallbacks.get(fallback);
  }).finally(() => { if (pending.get(key) === entry) pending.delete(key); });
}

function validateTile(json) {
  if (json?.schema !== 1 || !Array.isArray(json.elements)) throw new Error('Invalid OSM tile schema');
  const point = (p) => p && Number.isFinite(p.lon) && Number.isFinite(p.lat) && Math.abs(p.lon) <= 180 && Math.abs(p.lat) <= 90;
  for (const e of json.elements) {
    if (!Number.isSafeInteger(e?.id) || !e.tags || typeof e.tags !== 'object') throw new Error('Invalid OSM object');
    if (e.type === 'way' && (!Array.isArray(e.nodes) || e.nodes.length < 2 || e.nodes.length !== e.geometry?.length
      || !e.nodes.every(Number.isSafeInteger) || !e.geometry.every(point))) throw new Error('Incomplete OSM way geometry');
    if (e.type === 'node' && !point(e)) throw new Error('Incomplete OSM node geometry');
    if (e.type === 'relation' && (!Array.isArray(e.members) || e.center && !point(e.center))) throw new Error('Incomplete OSM relation');
    if (!['node', 'way', 'relation'].includes(e.type)) throw new Error('Invalid OSM object type');
  }
  return json;
}

function coversTile(coverage, bounds) {
  const [w,s,e,n] = bounds;
  const polygons = coverage.type === 'Polygon' ? [coverage.coordinates] : coverage.type === 'MultiPolygon' ? coverage.coordinates : null;
  if (!Array.isArray(polygons) || !polygons.length || !polygons.every((rings) => Array.isArray(rings) && rings.length && rings.every((r) => Array.isArray(r) && r.length >= 4
    && r.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)
    && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]))) throw new Error('Invalid OSM coverage');
  // Corners alone miss a hole or concave border through the tile; any border contact uses Overpass.
  const covered = polygons.some((rings) => {
    const corners = [[w, s], [e, s], [e, n], [w, n]].every(([x, y]) => {
      const inside = rings.map((ring) => {
        let yes = false;
        for (let i = 1; i < ring.length; i++) {
          const [a, b] = ring[i - 1], [c, d] = ring[i];
          if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) yes = !yes;
        }
        return yes;
      });
      return inside[0] && !inside.slice(1).some(Boolean);
    });
    return corners && !rings.some((r) => r.slice(1).some((b, i) => {
      const a = r[i];
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
    }));
  });
  return covered;
}

export class StaticOSM {
  constructor(url, dataset = 'ways', zoom = 14) {
    this.url = url;
    this.dataset = dataset;
    this.zoom = zoom;
    this.readers = new Map();
    this.tiles = new Map();
  }

  async ready(xy = null) {
    const old = releases.get(this.url);
    if (old?.failedAt && Date.now() - old.failedAt >= 120e3) releases.delete(this.url);
    if (!releases.has(this.url)) {
      const entry = {};
      entry.promise = deadline(async (signal) => {
        const key = `static/manifest/${this.url}`;
        const hit = await cache.get(key).catch(() => null);
        let manifest, fetched = false;
        try {
          if (hit && Date.now() - hit.at < 3600e3) manifest = hit.json;
          else {
            const res = await request('osmdata', this.url, { signal, timeoutMs: TIMEOUT, cache: 'no-store', credentials: 'omit' });
            if (!res.ok) throw new Error(`OSM manifest: HTTP ${res.status}`);
            manifest = await res.json();
            fetched = true;
          }
        } catch (err) {
          if (!hit) throw err;
          manifest = hit.json;
        }
        if (manifest?.schema !== 1 || !manifest.release || !Number.isFinite(Date.parse(manifest.source?.timestamp))
          || !Array.isArray(manifest.bounds) || manifest.bounds.length !== 4 || !manifest.bounds.every(Number.isFinite)
          || !manifest.datasets) throw new Error('Unsupported OSM manifest schema');
        if (fetched) cache.set(key, { at: Date.now(), json: manifest }).catch(() => {});
        return manifest;
      }).catch((err) => { entry.failedAt = Date.now(); throw err; });
      releases.set(this.url, entry);
    }
    const manifest = await releases.get(this.url).promise;
    const records = Object.entries(manifest.datasets).filter(([name,d])=>name===this.dataset || d.kind===this.dataset).map(([,d])=>d);
    if (!records.length) throw new Error('Unsupported OSM dataset');
    let selected;
    for (const d of records) {
      if (d?.format!=='pmtiles-json' || d.schema!==1 || d.zoom!==this.zoom || !Number.isSafeInteger(d.bytes) || d.bytes<127) throw new Error('Unsupported OSM dataset');
      const effective = {...manifest,bounds:d.bounds || manifest.bounds,coverage:d.coverage || manifest.coverage,source:d.source || manifest.source};
      if (xy && records.length>1) {
        const bounds=tileBounds(...xy,this.zoom);
        if (effective.coverage ? !coversTile(effective.coverage,bounds) : bounds[2]<effective.bounds[0] || bounds[0]>effective.bounds[2] || bounds[3]<effective.bounds[1] || bounds[1]>effective.bounds[3]) continue;
      }
      selected={d,effective};break;
    }
    if (!selected) throw new Error('Outside static OSM coverage');
    const {d,effective}=selected;
    const url = new URL(d.url,this.url), base = new URL(this.url);
    if (url.origin!==base.origin || !['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid OSM archive URL');
    return {manifest:effective,url:url.href,bytes:d.bytes,nearby_complete:d.nearby_complete};
  }

  tile(xy, options = {}) { return deadline((signal) => this.readTile(xy, options, signal)); }

  async readTile([x, y], { force = false }, signal) {
    if (![x, y].every((v) => Number.isInteger(v) && v >= 0 && v < 2 ** this.zoom)) throw new Error('Invalid OSM tile');
    const { manifest, url, bytes, nearby_complete } = await this.ready([x,y]);
    const bounds = tileBounds(x, y, this.zoom), [w, s, e, n] = bounds, [west, south, east, north] = manifest.bounds;
    if (!manifest.coverage && (e < west || w > east || n < south || s > north)) throw new Error('Outside static OSM coverage');
    const key = `static/${url}/${manifest.release}/${this.zoom}/${x}/${y}`;
    if (force) { this.tiles.delete(key); this.readers.delete(url); }
    if (this.tiles.has(key)) return this.tiles.get(key);
    const promise = (async () => {
      const hit = await cache.get(key).catch(() => null);
      if (hit) return { ...validateTile(hit.json), nearby_complete, source: { ...manifest.source, provider: 'Polku OSM data', attribution: manifest.attribution } };
      signal.throwIfAborted();
      let coverage = manifest.coverage;
      if (!coverage && manifest.source.url === 'https://download.geofabrik.de/europe/finland-latest.osm.pbf') {
        // The first published release predates embedded coverage; cached tiles still work without this asset.
        if (!finlandCoverage) finlandCoverage = request('polku', new URL('../data/finland-coverage.geojson', import.meta.url), { credentials: 'omit', timeoutMs: TIMEOUT })
          .then((r) => { if (!r.ok) throw new Error('OSM coverage unavailable'); return r.json(); })
          .catch((err) => { finlandCoverage = null; throw err; });
        coverage = await finlandCoverage;
      }
      if (coverage && !coversTile(coverage,bounds)) throw new Error('Outside static OSM coverage');
      signal.throwIfAborted();
      const { PMTiles } = await import('./vendor/pmtiles-4.5.0.js');
      if (!this.readers.has(url)) this.readers.set(url,new PMTiles({
        getKey: () => url,
        getBytes: async (offset, length, rangeSignal) => {
          const end = Math.min(bytes, offset + length) - 1;
          if (offset < 0 || end < offset || length > 8 * 1024 * 1024) throw new Error('Invalid OSM Range');
          const res = await request('osmdata', url, { headers: { Range: `bytes=${offset}-${end}` }, signal: rangeSignal, timeoutMs: TIMEOUT, credentials: 'omit' });
          if (res.status !== 206 || res.headers.get('Content-Range') !== `bytes ${offset}-${end}/${bytes}` || res.headers.get('Content-Encoding')) {
            await res.body?.cancel();
            throw new Error('OSM hosting needs exact HTTP Range responses without HTTP compression');
          }
          const data = await res.arrayBuffer();
          if (data.byteLength !== end - offset + 1) throw new Error('Incomplete OSM Range');
          return { data };
        },
      }));
      const header = await this.readers.get(url).getHeader();
      if (header.minZoom!==this.zoom || header.maxZoom!==this.zoom || header.tileType!==0 || header.tileCompression!==2) throw new Error('Unsupported OSM archive zoom or format');
      const tile = await this.readers.get(url).getZxy(this.zoom, x, y, signal);
      if (tile && tile.data.byteLength > 32 * 1024 * 1024) throw new Error('OSM tile too large');
      const json = tile ? JSON.parse(new TextDecoder().decode(tile.data)) : { schema: 1, elements: [] };
      validateTile(json);
      signal.throwIfAborted();
      json.nearby_complete = nearby_complete;
      json.source = { ...manifest.source, provider: 'Polku OSM data', attribution: manifest.attribution };
      cache.set(key, { at: Date.now(), json }).catch(() => {});
      return json;
    })().catch((err) => { if (this.tiles.get(key) === promise) { this.tiles.delete(key); this.readers.delete(url); } throw err; });
    signal.addEventListener('abort', () => {
      if (this.tiles.get(key) === promise) { this.tiles.delete(key); this.readers.delete(url); }
    }, { once: true });
    this.tiles.set(key, promise);
    if (this.tiles.size > 64) this.tiles.delete(this.tiles.keys().next().value);
    return promise;
  }
}
