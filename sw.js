// Polku service worker: keeps the app and saved offline areas working without
// a connection.
//
// - App files (same origin): network first, the last copy seen after 3 s or offline. After the 3 s, a file other than
//   the page itself takes its saved copy only when it's from the page's own deploy, where that's known (#481), so a
//   slow file doesn't put an older version beside newer ones; on a page given saved copies already, at once. A network
//   failure takes any saved copy. The typefaces are kept when the worker installs.
// - Versioned CDN files (unpkg): cache first.
// - OpenFreeMap TileJSON and sprites: network first, cached copy as fallback. Its fonts (the names'
//   letters, which a tile waits for before it's drawn): cache first.
// - Map and terrain tiles saved with "Save offline" (js/offline.js): network
//   first, the saved copy after 4 s or offline. Unsaved tiles pass straight through.
//   A saved OpenFreeMap tile at zoom 6 or lower (Finland's overview, a saved area's)
//   is the saved copy at once, refreshed behind it: it stands in while the detail loads.
// - "Preview offline" (set from the page) answers only from what's saved, so you
//   can check an area before a trip.

const SHELL = 'polku-shell-v1';
const TILES = 'polku-offline-tiles';
const FLAG = '/__polku/offline-preview';
const OFM_TILE = /^https:\/\/tiles\.openfreemap\.org\/planet\/[^/]+\/(\d+)\/(\d+)\/(\d+)\.pbf$/;
const DEM_TILE = /^https:\/\/tiles\.mapterhorn\.com\/\d+\/\d+\/\d+\.webp$/;

// OpenFreeMap's tile URLs carry a weekly version; saved tiles are stored under a
// version-free key so they still match after the TileJSON moves on.
const ofmKey = (url) => url.replace(OFM_TILE, 'https://tiles.openfreemap.org/planet/offline/$1/$2/$3.pbf');

let preview = null; // Promise<boolean>
let previewNow = null; // the same, once known (so other requests can skip the worker)
const previewOn = () => (preview ||= caches.open(SHELL).then((c) => c.match(FLAG)).then((r) => (previewNow = !!r)).catch(() => (previewNow = false)));
previewOn();

// Polku's typefaces, kept from the start: a page fetches a face only for the characters it shows, so one first seen
// offline would otherwise be missing (a failure leaves them to their first fetch rather than stopping the worker)
const FONTS = ['fonts/atkinson-hyperlegible-next.woff2', 'fonts/bricolage-grotesque.woff2'];
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FONTS)).catch(() => {}));
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// pages that got the saved copy of an app file (the server didn't answer in time), so the
// page can say it may be an older Polku
const savedFor = new Set();
// each page's deploy: the Last-Modified of the page it got (GitHub Pages gives every file the deploy's time); not known
// for a page the worker didn't open (claimed, or after the worker restarted)
const deployOf = new Map();

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'saved-copy?') {
    if (e.source) e.source.postMessage({ type: 'saved-copy', saved: savedFor.has(e.source.id) });
    return;
  }
  if (!e.data || e.data.type !== 'offline-preview') return;
  const on = !!e.data.on;
  preview = Promise.resolve(on);
  previewNow = on;
  e.waitUntil(caches.open(SHELL).then((c) => (on ? c.put(FLAG, new Response('1')) : c.delete(FLAG)))
    .then(() => e.source && e.source.postMessage({ type: 'offline-preview', on })));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname === FLAG) return;
    if (req.mode === 'navigate') {
      // stored without the query (?r=… share links) and hash
      const page = e.resultingClientId || e.clientId;
      e.respondWith(networkFirst(req, url.origin + url.pathname, 3000, page).then((r) => {
        if (page) { deployOf.set(page, r.headers.get('last-modified')); if (deployOf.size > 50) deployOf.delete(deployOf.keys().next().value); }
        return r;
      }));
    // one version of the app per page (#481): after the wait, only a saved copy from the page's own deploy (an older
    // file beside newer ones stopped the app); at once on a page that's already been given saved copies
    } else e.respondWith(networkFirst(req, req, savedFor.has(e.clientId) ? 0 : 3000, e.clientId, deployOf.get(e.clientId)));
  } else if (url.hostname === 'unpkg.com') e.respondWith(cacheFirst(req));
  else if (OFM_TILE.test(req.url)) e.respondWith(tile(req, ofmKey(req.url), +req.url.match(OFM_TILE)[1] <= 6));
  else if (DEM_TILE.test(req.url)) e.respondWith(tile(req, req.url));
  else if (url.hostname === 'tiles.openfreemap.org' && url.pathname.startsWith('/fonts/')) e.respondWith(cacheFirst(req));
  else if (url.hostname === 'tiles.openfreemap.org') e.respondWith(networkFirst(req, req, 4000));
  else if (previewNow !== false) e.respondWith(previewOn().then((on) => (on ? Response.error() : fetch(req))));
});

// `deploy`, when known: after the wait, only a saved copy with this Last-Modified
async function networkFirst(req, key, ms, client = '', deploy = null) {
  const cache = await caches.open(SHELL);
  const match = () => cache.match(key);
  if (await previewOn()) return (await match()) || fetch(req);
  // the saved copy instead of the network's: remember which page got it
  const saved = async (late) => {
    const r = await match();
    if (!r || (late && deploy && r.headers.get('last-modified') !== deploy)) return null;
    if (client) { savedFor.add(client); if (savedFor.size > 50) savedFor.delete(savedFor.values().next().value); }
    return r;
  };
  const net = fetch(req).then((res) => {
    if (res.ok) cache.put(key, res.clone()).catch(() => {});
    return res;
  });
  if (!navigator.onLine) return (await saved()) || net;
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    const timer = setTimeout(async () => { const s = await saved(true); if (s) finish(s); }, ms);
    net.then((r) => { clearTimeout(timer); finish(r); }, async (err) => {
      clearTimeout(timer);
      const s = await saved();
      if (s) finish(s); else if (!done) { done = true; reject(err); }
    });
  });
}

async function cacheFirst(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone()).catch(() => {});
  return res;
}

const refreshed = new Set(); // coarse tiles asked for again since the worker started
async function tile(req, key, coarse = false) {
  const cache = await caches.open(TILES);
  const saved = await cache.match(key);
  if (await previewOn()) return saved || Response.error();
  if (!saved) return fetch(req);
  if (!navigator.onLine) return saved;
  if (coarse) {
    if (!refreshed.has(key)) {
      refreshed.add(key);
      fetch(req).then(async (r) => {
        if (!r.ok) return;
        const blob = await r.blob();
        await cache.put(key, new Response(blob, { headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/octet-stream', 'X-Size': String(blob.size) } }));
      }).catch(() => refreshed.delete(key));
    }
    return saved;
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(saved), 4000);
    fetch(req).then((r) => { clearTimeout(timer); resolve(r.ok ? r : saved); }, () => { clearTimeout(timer); resolve(saved); });
  });
}
