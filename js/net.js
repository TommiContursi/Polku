// Requests to the free public services Polku relies on, through one door:
//
// - Back-off: when a service refuses (429) or fails (5xx, unreachable), it is
//   left alone for a while — its Retry-After if it sends one, Open-Meteo's own
//   "minutely / hourly / daily limit" wording, else 1 → 2 → 5 → 15 min — and
//   calls fail fast with a Limited error meanwhile, so callers fall back to the
//   last good data instead of hammering it.
// - One quiet notice per episode says which service is limited and until when
//   (see onStatus); listeners hear again when it may be used again.
// - Usage: calls per source this session and today, weighted the way the
//   provider counts them (Open-Meteo: one per location), for the readout. Every
//   call that goes out counts, the retry after a dropped connection too; one
//   that's cancelled or refused before it goes doesn't.
// - Pacing: a service with limits it enforces by refusing (`pace: [[ms, max],
//   …]`) gets at most `max` calls per `ms` from this tab, for each window;
//   calls beyond that wait for a slot instead of being refused, in the order
//   they were made. A slot is taken in the same step as it's found free, so
//   calls made together can't all see the same one. `refused`
//   names the answer the service gives when it's over its limit anyway (other
//   tabs, a shared connection): a back-off that grows if it happens again.

export const SOURCES = {
  polku: { label: 'Polku', what: 'release notes and routing profiles' },
  openmeteo: { label: 'Open-Meteo', what: 'weather', limits: [[60e3, 600, 'minute'], [3600e3, 5000, 'hour'], [864e5, 10000, 'day']] },
  overpass: { label: 'Overpass', what: 'OSM trail details, lit ways, uphill tags, click details and rocks on the water', limits: [[864e5, 10000, 'day']] },
  // brouter.de refuses with 403 "Please, retry later!" when one address calls too often. Measured 2026-10-13:
  // the 22nd call in 8 s was refused for 40 s; after more bursts that day, for over 9 minutes. Its rules aren't
  // published, so stay well below: 5 calls in 10 s, 12 a minute (the planner batches legs and keeps routes).
  brouter: { label: 'BRouter', what: 'routing', pace: [[10e3, 5], [60e3, 12]], refused: { status: 403, text: /retry later/i, wait: 60e3 } },
  brouterOwn: { label: 'Your BRouter', what: 'routing', steps: [5e3, 15e3, 60e3] }, // on this computer: back soon
  // FOSSGIS's terms: one request a second at most, no heavy use (routing.openstreetmap.de/about.html)
  valhalla: { label: 'Valhalla (FOSSGIS)', what: 'routing while BRouter pauses', pace: [[1100, 1], [60e3, 30]] },
  photon: { label: 'Photon', what: 'search' },
  digitraffic: { label: 'Digitraffic', what: 'traffic, cameras & ships', limits: [[60e3, 60, 'minute']] },
  digiroad: { label: 'Digiroad', what: 'traffic volumes' },
  lipas: { label: 'LIPAS', what: 'routes & places, and search' },
  vayla: { label: 'Väylävirasto', what: 'nautical chart' },
  traficom: { label: 'Traficom', what: 'water depth' },
  rainviewer: { label: 'RainViewer', what: 'rain radar' },
  fmi: { label: 'FMI', what: 'rain radar and measured snow (Finland)', limits: [[300e3, 600, '5 minutes'], [864e5, 20000, 'day']] },
  copernicus: { label: 'Copernicus Marine', what: 'sea ice (FMI’s ice charts)' },
};

const STEPS = [60e3, 120e3, 300e3, 900e3];
const status = new Map(); // source -> { until, fails, reason }
const listeners = new Set();

export class Limited extends Error {
  constructor(source, until, reason) {
    const s = SOURCES[source] || { label: source };
    super(reason === 'limit' ? `${s.label} is limiting requests — try again at ${clock(until)}`
      : reason === 'pacing' ? `${s.label} is busy with this device's earlier calls until ${clock(until)}`
        : `${s.label} isn't responding — trying again at ${clock(until)}`);
    this.name = 'Limited';
    this.source = source;
    this.until = until;
    this.reason = reason;
  }
}

export const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const sourceStatus = (source) => { const s = status.get(source); return s && s.until > Date.now() ? s : null; };
export function onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = (source, s) => { for (const fn of listeners) fn(source, s); };

/**
 * fetch() for a known source. opts.weight: calls this request counts as;
 * opts.backoff: false to only count, or a response predicate to exempt expected 5xx errors;
 * opts.maxWait: ms this call may wait for a paced slot, else Limited ('pacing').
 * opts.timeoutMs: a separate deadline per dispatched attempt, including its response body.
 */
export async function request(source, url, opts = {}) {
  const { weight = 1, backoff = true, maxWait = Infinity, timeoutMs = 0, ...init } = opts;
  if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (backoff && sourceStatus(source)) { const s = status.get(source); throw new Limited(source, s.until, s.reason); }
  // runs the moment the call may go: a back-off that began while it waited stops it, else it's counted
  let s;
  const take = () => {
    s = status.get(source);
    if (backoff && s && s.until > Date.now()) throw new Limited(source, s.until, s.reason);
    count(source, weight);
  };
  await slot(source, init.signal, maxWait, take);
  const send = () => {
    if (!timeoutMs) return fetch(url, init);
    const deadline = AbortSignal.timeout(timeoutMs);
    return fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, deadline]) : deadline });
  };
  let res;
  try {
    res = await send().catch(async (err) => {
      // a dropped connection gets one more try before it counts as a failure: a call like any other, paced and counted
      if (init.signal?.aborted || err.name === 'AbortError' || err.name === 'TimeoutError' || !navigator.onLine) throw err;
      await sleep(800, init.signal);
      await slot(source, init.signal, maxWait, take);
      return send();
    });
  } catch (err) {
    if (!init.signal?.aborted && err.name !== 'AbortError' && err.name !== 'TimeoutError' && err.name !== 'Limited' && backoff && navigator.onLine) fail(source, 'down');
    throw err;
  }
  const ref = SOURCES[source] && SOURCES[source].refused;
  if (backoff && ref && res.status === ref.status && ref.text.test(await res.clone().text().catch(() => ''))) {
    const prev = status.get(source);
    const e = fail(source, 'limit', Math.min(600e3, ref.wait * 2 ** (prev ? prev.fails : 0))); // 1, 2, 4… minutes
    throw new Limited(source, e.until, e.reason);
  }
  if (res.status === 429 || (res.status >= 500 && res.status !== 501)) {
    if (!backoff || (res.status >= 500 && typeof backoff === 'function' && !await backoff(res))) return res;
    let wait = null;
    const ra = res.headers.get('Retry-After');
    if (ra) wait = /^\d+$/.test(ra) ? +ra * 1000 : Date.parse(ra) - Date.now();
    if (source === 'openmeteo' && res.status === 429) {
      // {"reason": "Minutely / Hourly / Daily API request limit exceeded…"}
      const reason = await res.clone().json().then((j) => j.reason || '').catch(() => '');
      const now = new Date();
      if (/minut/i.test(reason)) wait = 60e3;
      else if (/hour/i.test(reason)) wait = (60 - now.getMinutes()) * 60e3;
      else if (/dai|day/i.test(reason)) wait = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now;
    }
    const e = fail(source, res.status === 429 ? 'limit' : 'down', wait);
    throw new Limited(source, e.until, e.reason);
  }
  if (s && status.get(source) === s) { // a back-off set while this call was out stays
    status.delete(source);
    emit(source, null);
  }
  return res;
}

// ------------------------------------------------------------------ pacing
const sleep = (ms, signal) => new Promise((ok, no) => {
  if (signal && signal.aborted) { no(new DOMException('Aborted', 'AbortError')); return; }
  const t = setTimeout(ok, ms);
  if (signal) signal.addEventListener('abort', () => { clearTimeout(t); no(new DOMException('Aborted', 'AbortError')); }, { once: true });
});
const inWindow = (source, ms) => (recent[source] || []).filter(([t]) => Date.now() - t < ms);

const queues = {}; // source -> calls waiting for a paced slot, first come first served
const timers = {}; // source -> the timer that lets the first of them go

/** Calls this source can take right now without waiting (Infinity if it isn't paced). */
export function headroom(source) {
  const p = SOURCES[source] && SOURCES[source].pace;
  const waiting = (queues[source] || []).length;
  return p ? Math.max(0, Math.min(...p.map(([ms, max]) => max - inWindow(source, ms).length)) - waiting) : Infinity;
}

/** Calls this source can still make in its pacing window of `ms` (Infinity if it has none). */
export function roomIn(source, ms) {
  const w = SOURCES[source] && SOURCES[source].pace && SOURCES[source].pace.find(([m]) => m === ms);
  return w ? Math.max(0, w[1] - inWindow(source, ms).length - (queues[source] || []).length) : Infinity;
}

// ms until a call fits every window, behind `ahead` calls already waiting for one
function waitFor(source, ahead = 0) {
  const now = Date.now(), sent = (recent[source] || []).map(([t]) => t);
  let at = now;
  for (let k = 0; k <= ahead; k++) {
    for (let moved = true; moved;) {
      moved = false;
      for (const [ms, max] of SOURCES[source].pace) {
        const first = sent[sent.length - max]; // must leave the window before another call fits
        if (first !== undefined && at - first < ms) { at = first + ms + 50; moved = true; }
      }
    }
    sent.push(at);
  }
  return at - now;
}

// Take the source's next slot: `take` runs (and counts the call) in the same
// step as the check that the slot is free, so calls made together can't all see
// the same one. Paced calls that must wait queue in the order they were made;
// one that would wait more than maxWait is refused at once (Limited 'pacing').
function slot(source, signal, maxWait, take) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const q = (queues[source] ||= []);
  if (!(SOURCES[source] && SOURCES[source].pace) || (!q.length && waitFor(source) <= 0)) return take();
  const wait = waitFor(source, q.length);
  if (wait > maxWait) throw new Limited(source, Date.now() + wait, 'pacing');
  return new Promise((ok, no) => {
    // a call that's cancelled while it waits leaves the queue, and its place to the next
    const quit = () => { q.splice(q.indexOf(me), 1); no(new DOMException('Aborted', 'AbortError')); pump(source); };
    const me = () => {
      if (signal) signal.removeEventListener('abort', quit);
      try { take(); ok(); } catch (e) { no(e); }
    };
    if (signal) signal.addEventListener('abort', quit, { once: true });
    q.push(me);
    pump(source);
  });
}

let pacingSaid = 0;
// let waiting calls go while their slots are free, then wait for the next one
function pump(source) {
  const q = queues[source];
  clearTimeout(timers[source]);
  while (q.length) {
    const wait = waitFor(source);
    if (wait > 0) {
      // say it once in a while, so a dashed line that waits isn't a mystery
      const last = Date.now() - pacingSaid > 120e3 ? waitFor(source, q.length - 1) : 0;
      if (last > 1500) { pacingSaid = Date.now(); emit(source, { pacing: true, until: Date.now() + last }); }
      timers[source] = setTimeout(() => pump(source), wait);
      return;
    }
    q.shift()();
  }
}

function fail(source, reason, wait = null) {
  const prev = status.get(source);
  const fails = (prev ? prev.fails : 0) + 1;
  const steps = (SOURCES[source] && SOURCES[source].steps) || STEPS;
  const until = Date.now() + Math.max(steps[0] < 15e3 ? steps[0] : 15e3, wait != null && wait > 0 ? wait : steps[Math.min(fails, steps.length) - 1]);
  const s = { until, fails, reason };
  status.set(source, s);
  emit(source, s);
  // say when it may be used again, so views can refresh on their own
  setTimeout(() => { if (status.get(source) === s) emit(source, { ...s, retry: true }); }, until - Date.now() + 200);
  return s;
}

// ------------------------------------------------------------------ usage
const session = {}; // source -> weighted calls
let today = loadToday();
// source -> [[ms, weight], …] of the last hour, for the per-minute/hour bars (kept across reloads)
const recent = today.recent || {};

function loadToday() {
  const day = new Date().toISOString().slice(0, 10); // providers reset on UTC days
  try {
    const t = JSON.parse(localStorage.getItem('polku.usage') || 'null');
    if (t && t.day === day) return t;
    if (t && t.recent) return { day, counts: {}, recent: t.recent }; // a new UTC day, but the last hour still counts
  } catch { /* storage blocked */ }
  return { day, counts: {} };
}

function count(source, weight) {
  const day = new Date().toISOString().slice(0, 10);
  if (today.day !== day) today = { day, counts: {}, recent };
  session[source] = (session[source] || 0) + weight;
  today.counts[source] = (today.counts[source] || 0) + weight;
  const r = (recent[source] ||= []);
  r.push([Date.now(), weight]);
  while (r.length && Date.now() - r[0][0] > 3600e3) r.shift();
  today.recent = recent;
  try { localStorage.setItem('polku.usage', JSON.stringify(today)); } catch { /* fine */ }
  // warn once per window when 80 % of a published limit is used
  for (const [ms, max, name] of SOURCES[source] && SOURCES[source].limits || []) {
    const used = name === 'day' ? today.counts[source] : r.reduce((sum, [t, w]) => sum + (Date.now() - t < ms ? w : 0), 0);
    const key = `${source}:${name}:${name === 'day' ? today.day : Math.floor(Date.now() / ms)}`;
    if (used >= 0.8 * max && !warned.has(key)) {
      warned.add(key);
      emit(source, { near: true, name, used, max });
    }
  }
}
const warned = new Set();

/** Per source: calls this session, today, and use against each known limit window. */
export function usage() {
  const now = Date.now();
  return Object.entries(SOURCES).map(([id, s]) => ({
    id, ...s,
    session: session[id] || 0,
    today: today.counts[id] || 0,
    windows: (s.limits || []).map(([ms, max, name]) => ({
      name, max,
      used: name === 'day' ? today.counts[id] || 0 : (recent[id] || []).reduce((sum, [t, w]) => sum + (now - t < ms ? w : 0), 0),
    })),
    status: sourceStatus(id),
  }));
}
