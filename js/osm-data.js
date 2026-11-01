// Immutable OSM releases: only the selected tiles are downloaded, through the app's network door.
import { request } from './net.js';
import { idb } from './idb.js';

const cache = idb('overpass');
const TIMEOUT = 8000;

export class StaticOSM {
  constructor(url) {
    this.url = url;
    this.release = null;
    this.reader = null;
    this.tiles = new Map();
  }

  async ready() {
    if (!this.release) this.release = (async () => {
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
      const d = manifest?.datasets?.ways;
      if (manifest?.schema !== 1 || !manifest.release || !Number.isFinite(Date.parse(manifest.source?.timestamp))
        || d?.format !== 'pmtiles-json' || d.schema !== 1 || d.zoom !== 14 || !Number.isSafeInteger(d.bytes) || d.bytes < 127) throw new Error('Unsupported OSM manifest schema');
      const url = new URL(d.url, this.url), base = new URL(this.url);
      if (url.origin !== base.origin || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid OSM archive URL');
      cache.set(key, { at: Date.now(), json: manifest }).catch(() => {});
      return { manifest, url: url.href, bytes: d.bytes };
    })().catch((err) => { this.release = null; throw err; });
    return this.release;
  }

  async ways([x, y]) {
    if (![x, y].every((v) => Number.isInteger(v) && v >= 0 && v < 2 ** 14)) throw new Error('Invalid OSM tile');
    const { manifest, url, bytes } = await this.ready();
    const key = `static/${url}/${manifest.release}/14/${x}/${y}`;
    if (this.tiles.has(key)) return this.tiles.get(key);
    const promise = (async () => {
      const hit = await cache.get(key).catch(() => null);
      if (hit) return hit.json;
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
      const tile = await this.reader.getZxy(14, x, y);
      if (tile && tile.data.byteLength > 32 * 1024 * 1024) throw new Error('OSM tile too large');
      const json = tile ? JSON.parse(new TextDecoder().decode(tile.data)) : { schema: 1, elements: [] };
      if (json.schema !== 1 || !Array.isArray(json.elements)) throw new Error('Invalid OSM tile schema');
      for (const w of json.elements) if (w.type === 'way' && (!Number.isSafeInteger(w.id) || !w.tags
        || !Array.isArray(w.nodes) || w.nodes.length < 2 || w.nodes.length !== w.geometry?.length
        || !w.nodes.every(Number.isSafeInteger) || !w.geometry.every((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat)))) throw new Error('Incomplete OSM way geometry');
      cache.set(key, { at: Date.now(), json }).catch(() => {});
      return json;
    })().catch((err) => { this.tiles.delete(key); this.reader = null; throw err; });
    this.tiles.set(key, promise);
    if (this.tiles.size > 64) this.tiles.delete(this.tiles.keys().next().value);
    return promise;
  }
}
