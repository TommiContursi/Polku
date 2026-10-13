// Segment routing. Each leg between two waypoints is routed on its own so that
// legs can mix modes (auto / straight / water) and be cached independently;
// runs of legs that all need routing go to BRouter in one call (routeRun).

import { BROUTER } from './config.js';
import { routeWater } from './water.js';
import { request, headroom } from './net.js';
import { valhallaRoute, valhallaCovers } from './valhalla.js';
import { dist } from './geo.js';
import { store } from './ui.js';

// Settings → Routing server: your own BRouter (no limits but your computer's), or brouter.de.
export const routerUrl = () => (store.get('brouterUrl', '') || '').trim().replace(/\/+$/, '') || BROUTER;
const routerSource = () => (routerUrl() === BROUTER ? 'brouter' : 'brouterOwn');
/** Calls the router takes right now without waiting (Infinity for your own). */
export const routerHeadroom = () => headroom(routerSource());

const cache = new Map();
// Requests in flight, shared: a drag's live preview and the commit that follows
// it ask for the same leg, and that must cost one BRouter call, not two. The
// fetch is cancelled only when everyone who asked for it has given up.
const inflight = new Map();

// wait for a request someone else made (never cancels it)
function join(key) {
  const e = inflight.get(key);
  e.users++;
  return e.promise;
}

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

async function brouter(pts, profile, signal, nogos, maxWait) {
  const url = `${routerUrl()}?lonlats=${pts.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join('|')}` +
    `&profile=${profile}&alternativeidx=0&format=geojson${nogoParam(nogos)}`;
  const res = await request(routerSource(), url, { signal, maxWait });
  const text = await res.text();
  if (!res.ok) throw Object.assign(new Error(explain(text) || `BRouter ${res.status}`), { busy: /killed by thread-priority-watchdog|timeout|retry later/i.test(text) });
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

// BRouter's error lines, in words a rider understands
function explain(text) {
  const t = text.trim().split('\n')[0];
  if (/target island|not mapped|position not mapped|no track found/i.test(t)) return 'no path the router can use near one of the points';
  if (/killed by thread-priority-watchdog|timeout|retry later/i.test(t)) return 'the router was too busy';
  return t;
}
const pause = (ms, signal) => new Promise((ok, no) => {
  const t = setTimeout(ok, ms);
  if (signal) signal.addEventListener('abort', () => { clearTimeout(t); no(new DOMException('Aborted', 'AbortError')); }, { once: true });
});

const legKey = (mode, profile, opts, from, to) => `${mode}|${profile}|${opts.portage}|${from.join(',')}|${to.join(',')}|${nogoParam(opts.nogos)}|${routerUrl()}`;
// a busy server drops the oldest request it's running: one more try after a moment
const brouterRetry = (pts, profile, sig, nogos, maxWait) => brouter(pts, profile, sig, nogos, maxWait)
  .catch((e) => (e.busy ? pause(2000, sig).then(() => brouter(pts, profile, sig, nogos, maxWait)) : Promise.reject(e)));

// When BRouter can't take the call now (a pause, a long wait for a paced slot,
// an outage) or can't route it, Valhalla does (not for paddling, and never for
// a drag's preview: opts.fallback false). Its legs are cached apart from
// BRouter's, so asking BRouter again later really asks BRouter. If Valhalla
// fails too, the original reason stands.
async function standIn(err, points, profile, opts, signal) {
  if (err.name === 'AbortError' || opts.fallback === false || !valhallaCovers(profile)) throw err;
  const key = `vh|${profile}|${points.map((p) => p.join(',')).join('|')}|${nogoParam(opts.nogos)}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const legs = await shared(key, (sig) => valhallaRoute(points, profile, sig, opts.nogos), signal);
    cache.set(key, legs);
    return legs;
  } catch (e) {
    throw e.name === 'AbortError' ? e : err;
  }
}

/**
 * One leg. opts: portage, nogos, maxWait (ms to wait for a BRouter slot before
 * Valhalla stands in), fallback (false: BRouter or nothing).
 * @param {object} seg  {from, to, mode, profile, opts}
 * @returns {Promise<{coords, tags, portage, note, provider?}>}
 */
export async function routeLeg({ from, to, mode, profile, opts = {} }, signal) {
  const key = legKey(mode, profile, opts, from, to);
  if (cache.has(key)) return cache.get(key);
  let result;
  if (mode === 'line') {
    result = { coords: [from, to], tags: [{}], portage: [] };
  } else if (mode === 'water') {
    result = await routeWater(from, to, { allowPortage: opts.portage !== false });
  } else {
    let r;
    try {
      r = await shared(key, (sig) => brouterRetry([from, to], profile, sig, opts.nogos, opts.maxWait), signal);
    } catch (e) {
      return (await standIn(e, [from, to], profile, opts, signal))[0];
    }
    result = { ...r, portage: [] };
  }
  cache.set(key, result);
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return result;
}

/**
 * Several consecutive auto legs in one BRouter call (points[0] → … → points[n]),
 * split back into legs at the track point nearest each via point. Returns one
 * result per leg, or null when the split doesn't hold up (a via point the
 * track doesn't come near): then route them one by one. Each leg is cached
 * as if it had been asked for alone.
 */
export async function routeRun({ points, profile, opts = {} }, signal) {
  const keys = points.slice(1).map((to, i) => legKey('auto', profile, opts, points[i], to));
  // all known already, or on their way (a drag's preview asked for them): no new call
  if (keys.every((k) => cache.has(k) || inflight.has(k))) {
    return Promise.all(keys.map((k) => (cache.has(k) ? cache.get(k) : join(k).then((r) => ({ ...r, portage: [] })))));
  }
  let r;
  try {
    r = await shared(keys.join('#'), (sig) => brouterRetry(points, profile, sig, opts.nogos, opts.maxWait), signal);
  } catch (e) {
    return standIn(e, points, profile, opts, signal);
  }
  const c = r.coords, cut = [0];
  for (let k = 1; k < points.length - 1; k++) {
    // the earliest closest track point from the previous cut on (a route can pass a point twice)
    let best = -1, bd = Infinity;
    for (let i = cut[k - 1]; i < c.length; i++) { const d = dist(c[i], points[k]); if (d < bd - 0.5) { bd = d; best = i; } }
    if (best < 0 || bd > 80) return null;
    cut.push(best);
  }
  cut.push(c.length - 1);
  const legs = keys.map((key, k) => {
    const a = cut[k], b = cut[k + 1];
    const res = b > a
      ? { coords: c.slice(a, b + 1), tags: r.tags.slice(a, b), portage: [] }
      : { coords: [c[a], c[a]], tags: [r.tags[Math.max(0, a - 1)] || {}], portage: [] };
    cache.set(key, res);
    return res;
  });
  while (cache.size > 400) cache.delete(cache.keys().next().value);
  return legs;
}
