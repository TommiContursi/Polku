// Polku service worker: keeps the app and saved offline areas working without
// a connection.
//
// - App files (same origin): network first, the last copy seen after 3 s or offline.
// - Versioned CDN files (unpkg): cache first.
// - OpenFreeMap TileJSON, sprites and fonts: network first, cached copy as fallback.
// - Map and terrain tiles saved with "Save offline" (js/offline.js): network
//   first, the saved copy after 4 s or offline. Unsaved tiles pass straight through.
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

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (e) => {
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
    // navigations are stored without the query (?r=… share links) and hash
    const key = req.mode === 'navigate' ? url.origin + url.pathname : req;
    e.respondWith(networkFirst(req, key, 3000));
  } else if (url.hostname === 'unpkg.com') e.respondWith(cacheFirst(req));
  else if (OFM_TILE.test(req.url)) e.respondWith(tile(req, ofmKey(req.url)));
  else if (DEM_TILE.test(req.url)) e.respondWith(tile(req, req.url));
  else if (url.hostname === 'tiles.openfreemap.org') e.respondWith(networkFirst(req, req, 4000));
  else if (previewNow !== false) e.respondWith(previewOn().then((on) => (on ? Response.error() : fetch(req))));
});

async function networkFirst(req, key, ms) {
  const cache = await caches.open(SHELL);
  const saved = () => cache.match(key);
  if (await previewOn()) return (await saved()) || fetch(req);
  const net = fetch(req).then((res) => {
    if (res.ok) cache.put(key, res.clone()).catch(() => {});
    return res;
  });
  if (!navigator.onLine) return (await saved()) || net;
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    const timer = setTimeout(async () => { const s = await saved(); if (s) finish(s); }, ms);
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

async function tile(req, key) {
  const cache = await caches.open(TILES);
  const saved = await cache.match(key);
  if (await previewOn()) return saved || Response.error();
  if (!saved) return fetch(req);
  if (!navigator.onLine) return saved;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(saved), 4000);
    fetch(req).then((r) => { clearTimeout(timer); resolve(r.ok ? r : saved); }, () => { clearTimeout(timer); resolve(saved); });
  });
}
