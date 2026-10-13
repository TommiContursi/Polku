// Segment routing. Each leg between two waypoints is routed on its own so that
// legs can mix modes (auto / straight / water) and be cached independently;
// runs of legs that all need routing go to BRouter in one call (routeRun).

import { BROUTER } from './config.js';
import { routeWater } from './water.js';
import { request, headroom } from './net.js';
import { valhallaRoute, valhallaCovers } from './valhalla.js';
import { CUSTOM_PROFILES } from './styles.js';
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

// a route style's BRouter variables (styles.js)
const paramStr = (params) => Object.keys(params || {}).sort().map((k) => `&profile:${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('');

// Polku's own profiles go to the routing server once per session (one fixed id
// each, so it's one file there, not one per visitor); a 500 for one of them
// means the server has dropped it: upload again and retry, once.
const uploaded = new Map();
function ensureProfile(profile, signal, again = false) {
  const def = CUSTOM_PROFILES[profile];
  if (!def) return Promise.resolve();
  const k = `${routerUrl()}|${profile}`;
  if (again) uploaded.delete(k);
  if (!uploaded.has(k)) {
    uploaded.set(k, (async () => {
      const text = await (await fetch(def.file)).text(); // Polku's own file, next to the app
      const res = await request(routerSource(), `${routerUrl()}/profile/${profile}`, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: text, signal });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.error || j.profileid !== profile) throw new Error(j.error || `the router didn't take Polku's profile (${res.status})`);
    })().catch((e) => { uploaded.delete(k); throw e; }));
  }
  return uploaded.get(k);
}

async function brouter(pts, profile, signal, nogos, maxWait, params, retried = false) {
  const custom = !!CUSTOM_PROFILES[profile];
  if (custom) {
    try {
      await ensureProfile(profile, signal);
    } catch (e) {
      if (e.name === 'AbortError' || e.name === 'Limited') throw e;
      // can't use Polku's profile: the stock one it's made from, without its own variable
      const r = await brouter(pts, CUSTOM_PROFILES[profile].stock, signal, nogos, maxWait, {});
      return { ...r, note: 'Paved only isn’t available right now (the routing server didn’t take Polku’s road profile), so gravel main roads may be used.' };
    }
  }
  const url = `${routerUrl()}?lonlats=${pts.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join('|')}` +
    `&profile=${profile}&alternativeidx=0&format=geojson${nogoParam(nogos)}${paramStr(params)}`;
  // a dropped custom profile answers 500: not an outage, so no back-off for those
  const res = await request(routerSource(), url, { signal, maxWait, ...(custom ? { backoff: false } : {}) });
  if (custom && res.status >= 500 && !retried) {
    await ensureProfile(profile, signal, true);
    return brouter(pts, profile, signal, nogos, maxWait, params, true);
  }
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

const legKey = (mode, profile, opts, from, to) => `${mode}|${profile}|${opts.portage}|${from.join(',')}|${to.join(',')}|${nogoParam(opts.nogos)}|${paramStr(opts.params)}|${JSON.stringify(opts.water || {})}|${routerUrl()}`;
// a busy server drops the oldest request it's running: one more try after a moment
const brouterRetry = (pts, profile, sig, opts) => brouter(pts, profile, sig, opts.nogos, opts.maxWait, opts.params)
  .catch((e) => (e.busy ? pause(2000, sig).then(() => brouter(pts, profile, sig, opts.nogos, opts.maxWait, opts.params)) : Promise.reject(e)));

// When BRouter can't take the call now (a pause, a long wait for a paced slot,
// an outage) or can't route it, Valhalla does (not for paddling, and never for
// a drag's preview: opts.fallback false). Its legs are cached apart from
// BRouter's, so asking BRouter again later really asks BRouter. If Valhalla
// fails too, the original reason stands.
async function standIn(err, points, profile, opts, signal) {
  const base = CUSTOM_PROFILES[profile] ? CUSTOM_PROFILES[profile].stock : profile;
  if (err.name === 'AbortError' || opts.fallback === false || !valhallaCovers(base)) throw err;
  const key = `vh|${base}|${points.map((p) => p.join(',')).join('|')}|${nogoParam(opts.nogos)}|${JSON.stringify(opts.valhalla || {})}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const legs = await shared(key, (sig) => valhallaRoute(points, base, sig, opts.nogos, opts.valhalla), signal);
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
    result = await routeWater(from, to, { allowPortage: opts.portage !== false, ...(opts.water || {}) });
  } else {
    let r;
    try {
      r = await shared(key, (sig) => brouterRetry([from, to], profile, sig, opts), signal);
    } catch (e) {
      return (await standIn(e, [from, to], profile, opts, signal))[0];
    }
    result = { ...r, portage: [] };
    if (r.note) { cache.delete(key); return result; } // a fallback: ask again next time
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
    r = await shared(keys.join('#'), (sig) => brouterRetry(points, profile, sig, opts), signal);
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
    if (r.note) { if (k === 0) res.note = r.note; } else cache.set(key, res); // a fallback isn't kept: ask again next time
    return res;
  });
  while (cache.size > 400) cache.delete(cache.keys().next().value);
  return legs;
}

/**
 * A round trip's whole line in one BRouter call (start → via points → start),
 * not split into legs: a generated via point can sit off the track (BRouter
 * catches the nearest way, and correctMisplacedViaPoints trims spurs), so the
 * planner moves the via points onto the line only when a loop is picked.
 * Returns { coords, tags, provider? }.
 */
export async function routeLoop({ points, profile, opts = {} }, signal) {
  const key = `loop|${profile}|${points.map((p) => p.join(',')).join('|')}|${paramStr(opts.params)}|${nogoParam(opts.nogos)}|${routerUrl()}`;
  if (cache.has(key)) return cache.get(key);
  let r;
  try {
    r = await shared(key, (sig) => brouterRetry(points, profile, sig, opts), signal);
  } catch (e) {
    const legs = await standIn(e, points, profile, opts, signal);
    r = { coords: legs.flatMap((l, i) => (i ? l.coords.slice(1) : l.coords)), tags: legs.flatMap((l) => l.tags), provider: 'valhalla' };
  }
  if (!r.note) cache.set(key, r);
  return r;
}
