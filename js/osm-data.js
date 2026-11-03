// Immutable OSM releases: only the selected tiles are downloaded, through the app's network door.
import { request } from './net.js';
import { idb } from './idb.js';
import { tileBounds } from './geo.js';

const cache = idb('overpass');
const TIMEOUT = 8000;
const releases = new Map(); // one release per URL/page, shared by the ways and lighting readers
let finlandCoverage;
const readers = new Map(), pending = new Map();

/** An explicit retry resets failed source state, keeping healthy releases pinned. */
export function forgetHostedFailures(url) {
  if (releases.get(url)?.failedAt) releases.set(url, { retry: true });
}

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
    if (e.type === 'relation' && e.member_count !== undefined && (!Number.isSafeInteger(e.member_count) || e.member_count < 0
      || !e.members.every(m => m?.type === 'way' && Number.isSafeInteger(m.ref) && typeof m.role === 'string'
        && Number.isSafeInteger(m.index) && m.index >= 0 && m.index < e.member_count)
      || new Set(e.members.map(m => m.index)).size !== e.members.length)) throw new Error('Incomplete OSM relation membership');
    if (!['node', 'way', 'relation'].includes(e.type)) throw new Error('Invalid OSM object type');
  }
  return json;
}

function coversTile(coverages, [w,s,e,n]) {
  const polygons = coverages.flatMap((coverage) => {
    const p = coverage.type === 'Polygon' ? [coverage.coordinates] : coverage.type === 'MultiPolygon' ? coverage.coordinates : null;
    if (!Array.isArray(p) || !p.length || !p.every((rings) => Array.isArray(rings) && rings.length && rings.every((r) => Array.isArray(r) && r.length >= 4
      && r.every((v) => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90)
      && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]))) throw new Error('Invalid OSM coverage');
    return p.map((rings) => rings.flatMap((r) => r.slice(1).map((b,i) => r[i][0] <= b[0] ? [r[i],b] : [b,r[i]])));
  });
  const events = new Set([w,e]), local = [];
  for (const edges of polygons) for (const [a,b] of edges) {
    let lo=0, hi=1;
    for (const [axis,min,max] of [[0,w,e],[1,s,n]]) {
      const delta=b[axis]-a[axis];
      if (!delta) { if (a[axis]<min || a[axis]>max) { hi=-1; break; } }
      else {
        const t=[(min-a[axis])/delta,(max-a[axis])/delta].sort((x,y)=>x-y);
        lo=Math.max(lo,t[0]); hi=Math.min(hi,t[1]);
      }
    }
    if (lo>hi) continue;
    local.push([a,b]);
    for (const t of [lo,hi]) events.add(Math.max(w,Math.min(e,a[0]+t*(b[0]-a[0]))));
  }
  // Boundary ordering is fixed between vertices, tile-side crossings and edge intersections.
  for (let i=0;i<local.length;i++) for (let j=i+1;j<local.length;j++) {
    const [a,b]=local[i], [c,d]=local[j], u=[b[0]-a[0],b[1]-a[1]], v=[d[0]-c[0],d[1]-c[1]], q=[c[0]-a[0],c[1]-a[1]];
    const cross=(r,t)=>r[0]*t[1]-r[1]*t[0], den=cross(u,v);
    if (!den) continue;
    const t=cross(q,v)/den, k=cross(q,u)/den;
    if (t<0 || t>1 || k<0 || k>1) continue;
    const x=a[0]+t*u[0], y=a[1]+t*u[1];
    if (x>w && x<e && y>=s && y<=n) events.add(x);
  }
  const xs=[...events].sort((a,b)=>a-b);
  for (let i=1;i<xs.length;i++) {
    const x=xs[i-1]+(xs[i]-xs[i-1])/2;
    if (!(x>xs[i-1] && x<xs[i])) return false;
    const intervals=polygons.flatMap((edges) => {
      const ys=edges.filter(([a,b])=>a[0]<x && x<b[0]).map(([a,b])=>a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0])).sort((a,b)=>a-b);
      if (ys.length%2) throw new Error('Invalid OSM coverage crossings');
      return ys.flatMap((y,i)=>i%2 ? [] : [[y,ys[i+1]]]);
    }).sort((a,b)=>a[0]-b[0]);
    let covered=s;
    for (const [lo,hi] of intervals) {
      if (lo>covered) break;
      covered=Math.max(covered,hi);
    }
    if (covered<n) return false;
  }
  return true;
}

function sameObject(a,b) {
  if (a===b) return true;
  if (!a || !b || typeof a!=='object' || typeof b!=='object' || Array.isArray(a)!==Array.isArray(b)) return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length && keys.every(k=>Object.hasOwn(b,k) && sameObject(a[k],b[k]));
}

function mergeTiles(tiles) {
  const elements=new Map();
  for (const tile of tiles) for (const e of tile.elements) {
    const key=`${e.type}/${e.id}`, old=elements.get(key);
    if (old && e.type==='relation' && e.member_count!==undefined) {
      const {members:before,...a}=old, {members:after,...b}=e;
      if (!sameObject(a,b)) throw new Error(`Conflicting OSM object ${key}`);
      const members=new Map(before.map(m=>[m.index,m]));
      for (const m of after) {
        if (members.has(m.index) && !sameObject(members.get(m.index),m)) throw new Error(`Conflicting OSM object ${key}`);
        members.set(m.index,m);
      }
      elements.set(key,{...old,members:[...members.values()].sort((a,b)=>a.index-b.index)});
    } else {
      if (old && !sameObject(old,e)) throw new Error(`Conflicting OSM object ${key}`);
      elements.set(key,e);
    }
  }
  return {schema:1,elements:[...elements.values()],nearby_complete:tiles.every(t=>t.nearby_complete!==false),
    source:{timestamp:tiles[0].source.timestamp,provider:'Polku OSM data',attribution:tiles[0].source.attribution,sources:tiles.map(t=>t.source)}};
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
    if (!releases.get(this.url)?.promise) {
      const retry = releases.get(this.url)?.retry;
      const entry = {};
      entry.promise = deadline(async (signal) => {
        const key = `static/manifest/${this.url}`;
        const hit = await cache.get(key).catch(() => null);
        let manifest, fetched = false;
        try {
          if (hit && Date.now() - hit.at < 3600e3) manifest = hit.json;
          else {
            const res = await request('osmdata', this.url, { signal, timeoutMs: TIMEOUT, cache: 'no-store', credentials: 'omit',
              retryDown: retry === true });
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
        if (manifest.country && !manifest.coverage) throw new Error('Missing country OSM coverage');
        if (fetched) cache.set(key, { at: Date.now(), json: manifest }).catch(() => {});
        return manifest;
      }).catch((err) => { entry.failedAt = Date.now(); throw err; });
      releases.set(this.url, entry);
    }
    const manifest = await releases.get(this.url).promise;
    const records = Object.entries(manifest.datasets).filter(([name,d])=>name===this.dataset || d.kind===this.dataset).map(([,d])=>d);
    if (!records.length) throw new Error('Unsupported OSM dataset');
    let archives=records.map((d) => {
      if (d?.format!=='pmtiles-json' || d.schema!==1 || d.zoom!==this.zoom || !Number.isSafeInteger(d.bytes) || d.bytes<127) throw new Error('Unsupported OSM dataset');
      if (d.kind && (!d.coverage || !Number.isFinite(Date.parse(d.source?.timestamp)))) throw new Error('Incomplete country OSM metadata');
      const effective={...manifest,bounds:d.bounds || manifest.bounds,coverage:d.coverage || manifest.coverage,source:d.source || manifest.source};
      const url=new URL(d.url,this.url), base=new URL(this.url);
      if (url.origin!==base.origin || !['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid OSM archive URL');
      return {manifest:effective,url:url.href,bytes:d.bytes,nearby_complete:d.nearby_complete,country:d.country || manifest.country};
    });
    if (xy) {
      const bounds=tileBounds(...xy,this.zoom);
      const one=archives.find(({manifest:m})=>m.coverage ? coversTile([m.coverage],bounds)
        : !(bounds[2]<m.bounds[0] || bounds[0]>m.bounds[2] || bounds[3]<m.bounds[1] || bounds[1]>m.bounds[3]));
      if (one) archives=[one];
      else {
        if (archives.some(a=>!a.manifest.coverage) || !coversTile(archives.map(a=>a.manifest.coverage),bounds)) throw new Error('Outside static OSM coverage');
        for (let i=archives.length-1;i>=0;i--) {
          const rest=archives.filter((_,j)=>j!==i);
          if (rest.length && coversTile(rest.map(a=>a.manifest.coverage),bounds)) archives=rest;
        }
        if (archives.some(a=>Date.parse(a.manifest.source.timestamp)!==Date.parse(manifest.source.timestamp))) throw new Error('Conflicting OSM source epochs');
      }
    }
    return {...archives[0],archives};
  }

  tile(xy, options = {}) {
    if (options.force) forgetHostedFailures(this.url);
    return deadline((signal) => this.readTile(xy, options, signal));
  }

  async readTile([x, y], { force = false }, signal) {
    if (![x, y].every((v) => Number.isInteger(v) && v >= 0 && v < 2 ** this.zoom)) throw new Error('Invalid OSM tile');
    const {archives}=await this.ready([x,y]);
    const tiles=await Promise.all(archives.map(a=>this.readArchive([x,y],{force},signal,a)));
    return tiles.length===1 ? tiles[0] : mergeTiles(tiles);
  }

  async readArchive([x,y], {force}, signal, {manifest,url,bytes,nearby_complete,country}) {
    const key = `static/${url}/${manifest.release}/${this.zoom}/${x}/${y}`;
    if (force) { this.tiles.delete(key); this.readers.delete(url); }
    if (this.tiles.has(key)) return this.tiles.get(key);
    const promise = (async () => {
      const hit = await cache.get(key).catch(() => null);
      if (hit) return { ...validateTile(hit.json), nearby_complete, source: { ...manifest.source, ...(country ? {country} : {}), provider: 'Polku OSM data', attribution: manifest.attribution } };
      signal.throwIfAborted();
      if (!manifest.coverage && manifest.source.url === 'https://download.geofabrik.de/europe/finland-latest.osm.pbf') {
        // The first published release predates embedded coverage; cached tiles still work without this asset.
        if (!finlandCoverage) finlandCoverage = request('polku', new URL('../data/finland-coverage.geojson', import.meta.url), { credentials: 'omit', timeoutMs: TIMEOUT })
          .then((r) => { if (!r.ok) throw new Error('OSM coverage unavailable'); return r.json(); })
          .catch((err) => { finlandCoverage = null; throw err; });
        if (!coversTile([await finlandCoverage],tileBounds(x,y,this.zoom))) throw new Error('Outside static OSM coverage');
      }
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
      json.source = { ...manifest.source, ...(country ? {country} : {}), provider: 'Polku OSM data', attribution: manifest.attribution };
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
