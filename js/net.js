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
//   provider counts them (Open-Meteo: one per location), for the readout.

export const SOURCES = {
  openmeteo: { label: 'Open-Meteo', what: 'weather', limits: [[60e3, 600, 'minute'], [3600e3, 5000, 'hour'], [864e5, 10000, 'day']] },
  overpass: { label: 'Overpass', what: 'OSM data', limits: [[864e5, 10000, 'day']] },
  brouter: { label: 'BRouter', what: 'routing' },
  photon: { label: 'Photon', what: 'search' },
  digitraffic: { label: 'Digitraffic', what: 'traffic, cameras & ships', limits: [[60e3, 60, 'minute']] },
  digiroad: { label: 'Digiroad', what: 'traffic volumes' },
  lipas: { label: 'LIPAS', what: 'routes & places' },
  vayla: { label: 'Väylävirasto', what: 'nautical chart' },
  traficom: { label: 'Traficom', what: 'water depth' },
  rainviewer: { label: 'RainViewer', what: 'rain radar' },
  fmi: { label: 'FMI', what: 'rain radar (Finland)', limits: [[300e3, 600, '5 minutes'], [864e5, 20000, 'day']] },
};

const STEPS = [60e3, 120e3, 300e3, 900e3];
const status = new Map(); // source -> { until, fails, reason }
const listeners = new Set();

export class Limited extends Error {
  constructor(source, until, reason) {
    const s = SOURCES[source] || { label: source };
    super(reason === 'limit' ? `${s.label} is limiting requests — try again at ${clock(until)}` : `${s.label} isn't responding — trying again at ${clock(until)}`);
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
 * opts.backoff: false to only count (e.g. Overpass, whose mirrors take turns).
 */
export async function request(source, url, opts = {}) {
  const { weight = 1, backoff = true, ...init } = opts;
  const s = status.get(source);
  if (backoff && s && s.until > Date.now()) throw new Limited(source, s.until, s.reason);
  count(source, weight);
  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    if (err.name !== 'AbortError' && backoff && navigator.onLine) fail(source, 'down');
    throw err;
  }
  if (res.status === 429 || (res.status >= 500 && res.status !== 501)) {
    if (!backoff) return res;
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
  if (s) {
    status.delete(source);
    emit(source, null);
  }
  return res;
}

function fail(source, reason, wait = null) {
  const prev = status.get(source);
  const fails = (prev ? prev.fails : 0) + 1;
  const until = Date.now() + Math.max(15e3, wait != null && wait > 0 ? wait : STEPS[Math.min(fails, STEPS.length) - 1]);
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
