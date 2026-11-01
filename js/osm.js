// Overpass, the live OpenStreetMap query service: public mirrors that come and
// go, and answers cached in IndexedDB (a week fresh; an older copy still beats
// nothing when every mirror is down). Used by the trail details, the uphill
// layer and the click inspector.

import { OVERPASS } from './config.js';
import { idb } from './idb.js';
import { request } from './net.js';

export const OSM_TTL = 7 * 864e5;
const cache = idb('overpass');
cache.prune((v) => v && Date.now() - v.at < 4 * OSM_TTL).catch(() => {});

// Background queries try one mirror at a time (preferring the last one that
// worked); interactive ones race a few and keep the first answer.
let preferred = 0;
async function ask(i, query, signal, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  if (signal) signal.addEventListener('abort', () => ctrl.abort());
  try {
    // mirrors take turns, so no back-off here; still counted for the usage readout
    const res = await request('overpass', OVERPASS[i], { method: 'POST', body: new URLSearchParams({ data: query }), signal: ctrl.signal, backoff: false });
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const json = await res.json();
    if (!json || json.remark || !Array.isArray(json.elements)) throw new Error(json?.remark || 'Overpass returned incomplete data');
    preferred = i;
    return json;
  } finally {
    clearTimeout(t);
  }
}

export async function overpass(query, { race = false, timeoutMs = race ? 25000 : 20000 } = {}) {
  const order = OVERPASS.map((_, k) => (preferred + k) % OVERPASS.length);
  if (race) {
    const stop = new AbortController();
    try {
      try {
        return await Promise.any(order.slice(0, 3).map((i) => ask(i, query, stop.signal, timeoutMs)));
      } catch (err) {
        for (const i of order.slice(3)) {
          try { return await ask(i, query, stop.signal, timeoutMs); } catch (e) { err = e; }
        }
        throw err;
      }
    } finally {
      stop.abort();
    }
  }
  let lastErr;
  for (const i of order) {
    try { return await ask(i, query, null, timeoutMs); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

/** An Overpass answer through the cache; `slim` keeps only what the caller needs. */
export async function cachedOverpass(key, query, slim = (json) => json, opts = {}) {
  let hit = null;
  try { hit = await cache.get(key); } catch { /* storage blocked */ }
  if (hit && Date.now() - hit.at < OSM_TTL) return hit.json;
  try {
    const small = slim(await overpass(query, opts));
    cache.set(key, { at: Date.now(), json: small }).catch(() => {});
    return small;
  } catch (err) {
    if (hit) return hit.json;
    throw err;
  }
}
