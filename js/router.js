// Segment routing. Each leg between two waypoints is routed on its own so that
// legs can mix modes (auto / straight / water) and be cached independently.

import { BROUTER } from './config.js';
import { routeWater } from './water.js';
import { request } from './net.js';

const cache = new Map();
// Requests in flight, shared: a drag's live preview and the commit that follows
// it ask for the same leg, and that must cost one BRouter call, not two. The
// fetch is cancelled only when everyone who asked for it has given up.
const inflight = new Map();

function shared(key, run, signal) {
  let e = inflight.get(key);
  if (!e) {
    const ctrl = new AbortController();
    e = { ctrl, users: 0 };
    e.promise = run(ctrl.signal).finally(() => { if (inflight.get(key) === e) inflight.delete(key); });
    inflight.set(key, e);
  }
  e.users++;
  if (!signal) return e.promise;
  return new Promise((ok, fail) => {
    const quit = () => { if (--e.users === 0) { e.ctrl.abort(); inflight.delete(key); } fail(new DOMException('Aborted', 'AbortError')); };
    if (signal.aborted) { quit(); return; }
    signal.addEventListener('abort', quit, { once: true });
    e.promise.then(ok, fail).finally(() => signal.removeEventListener('abort', quit));
  });
}

export function parseTags(str) {
  const tags = {};
  for (const kv of (str || '').split(' ')) {
    const i = kv.indexOf('=');
    if (i > 0) tags[kv.slice(0, i)] = kv.slice(i + 1);
  }
  return tags;
}

// nogos: [{ll:[lon,lat], r: metres}] — BRouter routes around these circles.
const nogoParam = (nogos) => (nogos && nogos.length
  ? `&nogos=${nogos.map((n) => `${n.ll[0].toFixed(6)},${n.ll[1].toFixed(6)},${Math.round(n.r)}`).join('|')}`
  : '');

async function brouter(a, b, profile, signal, nogos) {
  const url = `${BROUTER}?lonlats=${a[0].toFixed(6)},${a[1].toFixed(6)}|${b[0].toFixed(6)},${b[1].toFixed(6)}` +
    `&profile=${profile}&alternativeidx=0&format=geojson${nogoParam(nogos)}`;
  const res = await request('brouter', url, { signal });
  const text = await res.text();
  if (!res.ok) throw new Error(text.trim().split('\n')[0] || `BRouter ${res.status}`);
  const gj = JSON.parse(text);
  const f = gj.features[0];
  const coords = f.geometry.coordinates;
  const msgs = f.properties.messages || [];
  // messages[i] describes the stretch that ends at (lon,lat); map every
  // coordinate interval to the way tags of the stretch it belongs to.
  const head = msgs[0] || [];
  const iLon = head.indexOf('Longitude'), iLat = head.indexOf('Latitude'), iTags = head.indexOf('WayTags');
  const stretches = msgs.slice(1).map((m) => ({ lon: +m[iLon] / 1e6, lat: +m[iLat] / 1e6, tags: parseTags(m[iTags]) }));
  const tags = [];
  let si = 0;
  for (let i = 1; i < coords.length; i++) {
    const st = stretches[Math.min(si, stretches.length - 1)];
    tags.push(st ? st.tags : {});
    if (st && Math.abs(coords[i][0] - st.lon) < 2e-6 && Math.abs(coords[i][1] - st.lat) < 2e-6) si++;
  }
  return { coords: coords.map((c) => [c[0], c[1]]), tags };
}

/**
 * @param {object} seg  {from, to, mode, profile, opts}
 * @returns {Promise<{coords, tags, portage, note}>}
 */
export async function routeLeg({ from, to, mode, profile, opts = {} }, signal) {
  const key = `${mode}|${profile}|${opts.portage}|${from.join(',')}|${to.join(',')}|${nogoParam(opts.nogos)}`;
  if (cache.has(key)) return cache.get(key);
  let result;
  if (mode === 'line') {
    result = { coords: [from, to], tags: [{}], portage: [] };
  } else if (mode === 'water') {
    result = await routeWater(from, to, { allowPortage: opts.portage !== false });
  } else {
    const r = await shared(key, (sig) => brouter(from, to, profile, sig, opts.nogos), signal);
    result = { ...r, portage: [] };
  }
  cache.set(key, result);
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return result;
}
