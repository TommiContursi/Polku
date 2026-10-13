// Offline areas: Polku's trail map and terrain along a planned route, saved in
// the browser so the map, the route, its profile and uphill grades work with no
// signal. Tiles go into Cache Storage, where the service worker (sw.js) finds
// them; the list of areas (with the routed line itself) lives in IndexedDB.
//
// Only sources whose terms allow it are saved: OpenFreeMap vector tiles and
// Mapterhorn terrain. Aerial imagery (Esri doesn't allow offline caching) and the
// Kapsi raster maps (a volunteer-run service) are left out.

import { OFM_TILEJSON, OFM_SPRITE, OFM_GLYPHS, DEM_URL } from './config.js';
import { densify, lonLatToTile, fmtDist } from './geo.js';
import { idb } from './idb.js';
import { openModal, closeModal } from './modal.js';
import { h, icon, toast } from './ui.js';

const TILES = 'polku-offline-tiles';
const SHELL = 'polku-shell-v1';
const FLAG = '/__polku/offline-preview';
const OFM_TILE = /^https:\/\/tiles\.openfreemap\.org\/planet\/[^/]+\/(\d+)\/(\d+)\/(\d+)\.pbf$/;
const ofmKey = (url) => url.replace(OFM_TILE, 'https://tiles.openfreemap.org/planet/offline/$1/$2/$3.pbf'); // same as sw.js
// typical tile bytes per zoom, for the estimate (low zooms are big, a z14 trail tile is small)
const SIZE = { ofm: (z) => (z <= 9 ? 250e3 : z <= 11 ? 130e3 : z === 12 ? 70e3 : 40e3), dem: (z) => (z <= 9 ? 110e3 : 65e3) };
const MAX_TILES = 8000;
const ZOOMS = [5, 14]; // vector tiles stop at 14 (overzoomed beyond); 512 px terrain at 14 serves map zoom 15+
const FONTS = ['Noto Sans Regular', 'Noto Sans Bold', 'Noto Sans Italic'];
const RANGES = ['0-255', '256-511', '8192-8447', '8448-8703']; // Latin, Finnish/Nordic letters, punctuation, arrows
const areas = idb('offline');

export const offlineSupported = () => 'serviceWorker' in navigator && 'caches' in window && window.isSecureContext;

export function registerServiceWorker() {
  if (offlineSupported()) navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ------------------------------------------------------------------ planning
let tilejson = null;
const ofmTemplate = () => (tilejson ||= fetch(OFM_TILEJSON).then((r) => r.json()).then((j) => j.tiles[0]).catch((e) => { tilejson = null; throw e; }));

/** Tiles covering `buffer` metres either side of the line, zoom 5–14. */
export async function planArea(line, { buffer = 1000, terrain = true } = {}) {
  const tiles = new Map(); // cache key -> { url, kind }
  const sources = [[await ofmTemplate(), 'ofm']];
  if (terrain) sources.push([DEM_URL, 'dem']);
  const pts = densify(line, Math.max(80, buffer / 2)).pts;
  for (let z = ZOOMS[0]; z <= ZOOMS[1]; z++) {
    const ranges = new Set();
    for (const [lon, lat] of pts) {
      const dLat = buffer / 111195;
      const dLon = buffer / (111195 * Math.cos((lat * Math.PI) / 180));
      const [x0, y0] = lonLatToTile(lon - dLon, lat + dLat, z).map(Math.floor);
      const [x1, y1] = lonLatToTile(lon + dLon, lat - dLat, z).map(Math.floor);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) ranges.add(`${x}/${y}`);
    }
    for (const xy of ranges) {
      const [x, y] = xy.split('/');
      for (const [tpl, kind] of sources) {
        const url = tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y);
        tiles.set(kind === 'ofm' ? ofmKey(url) : url, { url, kind, z });
      }
    }
  }
  let bytes = 0;
  for (const t of tiles.values()) bytes += SIZE[t.kind](t.z);
  return { tiles, bytes };
}

// The app itself, fonts, sprites and the TileJSON, so Polku starts offline.
async function saveShell() {
  const cache = await caches.open(SHELL);
  const urls = new Set([new URL('./', location.href).href, OFM_TILEJSON]);
  for (const e of performance.getEntriesByType('resource')) {
    const u = new URL(e.name);
    if ((u.origin === location.origin && /\.(js|css)$/.test(u.pathname)) || u.hostname === 'unpkg.com') urls.add(u.origin + u.pathname);
  }
  for (const s of ['', '@2x']) for (const ext of ['.json', '.png']) urls.add(`${OFM_SPRITE}${s}${ext}`);
  for (const f of FONTS) for (const r of RANGES) urls.add(OFM_GLYPHS.replace('{fontstack}', f).replace('{range}', r));
  await Promise.all([...urls].map(async (u) => {
    try {
      const res = await fetch(u, { cache: 'no-store' });
      if (res.ok) await cache.put(u, res);
    } catch { /* keep going: the worker also caches what the app loads */ }
  }));
}

// ------------------------------------------------------------------ saving
export async function saveArea({ name, line, bbox, route }, { buffer, terrain }, onProgress, signal) {
  const plan = await planArea(line, { buffer, terrain });
  if (plan.tiles.size > MAX_TILES) throw new Error('This area is too big to save. Try a narrower corridor.');
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  await saveShell();
  const cache = await caches.open(TILES);
  const list = [...plan.tiles];
  const fresh = [];
  let next = 0, done = 0, bytes = 0, failed = 0;
  const worker = async () => {
    while (next < list.length && !signal.aborted) {
      const [key, t] = list[next++];
      try {
        const hit = await cache.match(key);
        if (hit) bytes += +(hit.headers.get('x-size') || 0);
        else {
          const res = await fetch(t.url, { signal });
          if (res.ok) {
            const blob = await res.blob();
            bytes += blob.size;
            await cache.put(key, new Response(blob, { headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream', 'X-Size': String(blob.size) } }));
            fresh.push(key);
          } else if (res.status !== 404) failed++; // 404: no terrain there (sea)
        }
      } catch {
        if (signal.aborted) break;
        failed++;
      }
      onProgress(++done, list.length, bytes);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  if (signal.aborted) {
    await dropUnused(fresh);
    throw new DOMException('Cancelled', 'AbortError');
  }
  const area = { id: `a${Date.now().toString(36)}`, name, created: Date.now(), bbox, keys: [...plan.tiles.keys()], tiles: list.length, bytes, failed, buffer, terrain, route };
  await areas.set(area.id, area);
  return area;
}

export async function listAreas() {
  try { return (await areas.all()).sort((a, b) => b.created - a.created); } catch { return []; }
}

export async function removeArea(id) {
  const all = await listAreas();
  const area = all.find((a) => a.id === id);
  if (!area) return;
  await areas.del(id);
  await dropUnused(area.keys);
}

// Delete tiles no saved area refers to any more (areas can overlap).
async function dropUnused(keys) {
  const used = new Set((await listAreas()).flatMap((a) => a.keys));
  const cache = await caches.open(TILES);
  await Promise.all(keys.filter((k) => !used.has(k)).map((k) => cache.delete(k)));
}

// ------------------------------------------------------------------ preview
export async function previewActive() {
  try { return !!(await (await caches.open(SHELL)).match(FLAG)); } catch { return false; }
}

export async function setPreview(on) {
  const reg = await navigator.serviceWorker.ready;
  const ack = new Promise((resolve) => {
    const onMsg = (e) => { if (e.data && e.data.type === 'offline-preview') { navigator.serviceWorker.removeEventListener('message', onMsg); resolve(); } };
    navigator.serviceWorker.addEventListener('message', onMsg);
    setTimeout(resolve, 2000);
  });
  reg.active.postMessage({ type: 'offline-preview', on });
  await ack;
  location.reload();
}

/** Banner while previewing, and a toast when the connection drops or returns. */
export async function initOfflineStatus() {
  if (!offlineSupported()) return;
  if (await previewActive()) {
    document.body.append(h('div', { class: 'offline-banner', role: 'status' },
      h('span', { html: `${icon('offline', 16)} Offline preview: only saved areas load` }),
      h('button', { type: 'button', class: 'btn', onclick: () => setPreview(false) }, 'Exit')));
  }
  window.addEventListener('offline', async () => {
    const n = (await listAreas()).length;
    toast(n ? 'You’re offline — saved areas and their routes still work' : 'You’re offline — the map needs a connection (save an area from the route panel next time)', { ms: 6000 });
  });
  window.addEventListener('online', () => toast('Back online'));
}

// ------------------------------------------------------------------ UI
const mb = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(b < 1e7 ? 1 : 0)} MB` : `${Math.max(1, Math.round(b / 1e3))} kB`);

/** The "Save offline" dialog for a planned route. payload: { name, line, bbox, route, km } */
export function openSaveOffline(payload, { onSaved } = {}) {
  if (!offlineSupported()) { toast('This browser can’t save maps for offline use'); return; }
  let buffer = 1000;
  let terrain = true;
  let ctrl = null;
  openModal({ title: 'Save offline', subtitle: `Along your ${fmtDist(payload.km * 1000)} route`, onClose: () => ctrl && ctrl.abort() }, (body) => {
    const name = h('input', { type: 'text', value: payload.name, 'aria-label': 'Name', maxlength: '80' });
    const est = h('p', { class: 'off-est' }, 'Working out the size…');
    const bar = h('progress', { max: '1', value: '0', hidden: true });
    const status = h('p', { class: 'note', 'aria-live': 'polite' });
    const save = h('button', { type: 'button', class: 'btn primary' }, 'Save');
    const corridor = h('div', { class: 'seg small' }, ...[[500, '0.5 km'], [1000, '1 km'], [2000, '2 km'], [5000, '5 km']].map(([v, label]) => h('button', {
      type: 'button', 'aria-pressed': String(v === buffer), onclick: (e) => {
        buffer = v;
        for (const b of corridor.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
        estimate();
      },
    }, label)));
    const terrainBox = h('input', { type: 'checkbox', checked: true, onchange: (e) => { terrain = e.target.checked; estimate(); } });
    let seq = 0;
    const estimate = async () => {
      const my = ++seq;
      try {
        const p = await planArea(payload.line, { buffer, terrain });
        if (my !== seq) return;
        const big = p.tiles.size > MAX_TILES;
        est.textContent = big ? `${p.tiles.size.toLocaleString()} tiles — too big. Try a narrower corridor.` : `${p.tiles.size.toLocaleString()} tiles · about ${mb(p.bytes)}`;
        save.disabled = big;
      } catch { est.textContent = 'Can’t reach the map server right now.'; save.disabled = true; }
    };
    save.onclick = async () => {
      ctrl = new AbortController();
      save.disabled = true;
      bar.hidden = false;
      for (const el of [name, terrainBox, ...corridor.children]) el.disabled = true;
      try {
        const area = await saveArea({ ...payload, name: name.value.trim() || payload.name }, { buffer, terrain }, (done, total, bytes) => {
          bar.max = total;
          bar.value = done;
          status.textContent = `${done.toLocaleString()} / ${total.toLocaleString()} tiles · ${mb(bytes)}`;
        }, ctrl.signal);
        ctrl = null;
        closeModal();
        toast(`Saved for offline use · ${mb(area.bytes)}${area.failed ? ` (${area.failed} tiles failed — save again to retry)` : ''}`, { ms: 5000 });
        if (onSaved) onSaved(area);
      } catch (err) {
        ctrl = null;
        if (err.name === 'AbortError') return;
        status.textContent = err.message || 'Saving failed.';
        save.disabled = false;
        bar.hidden = true;
        for (const el of [name, terrainBox, ...corridor.children]) el.disabled = false;
      }
    };
    body.append(
      h('p', {}, 'Saves Polku’s trail map and terrain (hillshade, contours, 3D, uphill grades) along this route, with the route itself, so the map, route and profile work without signal.'),
      h('label', { class: 'off-field' }, h('span', {}, 'Name'), name),
      h('div', { class: 'off-field' }, h('span', {}, 'Corridor either side'), corridor),
      h('label', { class: 'off-check' }, terrainBox, h('span', {}, 'Terrain', h('small', {}, 'Hillshade, contours, 3D and uphill grades. About three quarters of the size.'))),
      est, bar, status,
      h('p', { class: 'note' }, 'Routing, search, weather, traffic and aerial maps still need a connection.'),
      h('div', { class: 'off-actions' }, save));
    estimate();
  });
}

/** The Offline maps section in Layers. */
export async function renderOfflineSection(box, { open }) {
  if (!offlineSupported()) { box.append(h('p', { class: 'note' }, 'This browser can’t save maps for offline use.')); return; }
  const [list, preview, est] = await Promise.all([listAreas(), previewActive(), navigator.storage && navigator.storage.estimate ? navigator.storage.estimate().catch(() => null) : null]);
  box.innerHTML = '';
  if (!list.length) box.append(h('p', { class: 'note', html: `Plan a route, then press ${icon('offline', 14)} <b>Save offline</b> in the route panel. The trail map, terrain and the route then work without signal.` }));
  for (const a of list) {
    box.append(h('div', { class: 'off-area' },
      h('div', { class: 'off-area-text' }, h('b', {}, a.name), h('small', {}, `${new Date(a.created).toLocaleDateString()} · ${mb(a.bytes)}${a.failed ? ` · ${a.failed} tiles missing` : ''}`)),
      h('button', { type: 'button', class: 'btn', onclick: () => open(a) }, 'Open'),
      h('button', { type: 'button', class: 'tool danger', 'aria-label': `Delete ${a.name}`, title: 'Delete', html: icon('trash', 17), onclick: async (e) => {
        e.currentTarget.disabled = true;
        await removeArea(a.id);
        renderOfflineSection(box, { open });
      } })));
  }
  if (list.length || preview) {
    box.append(h('label', { class: 'tg' },
      h('span', { class: 'tg-text' }, 'Preview offline', h('small', {}, 'Load only what’s saved, to check an area before you go (reloads)')),
      h('input', { type: 'checkbox', role: 'switch', checked: preview, onchange: (e) => setPreview(e.target.checked) }),
      h('span', { class: 'tg-ui', 'aria-hidden': 'true' })));
  }
  if (est && est.usage != null) box.append(h('p', { class: 'note' }, `Polku uses ${mb(est.usage)} on this device${est.quota ? ` (up to ${mb(est.quota)} available)` : ''}.`));
}
