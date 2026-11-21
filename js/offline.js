// Offline areas: Polku's trail map and terrain along a planned route, saved in
// the browser so the map, the route, its profile and uphill grades work with no
// signal. Tiles go into Cache Storage, where the service worker (sw.js) finds
// them; the list of areas (with the routed line itself) lives in IndexedDB.
//
// Only sources whose terms allow it are saved: OpenFreeMap vector tiles and
// Mapterhorn terrain, and in Finland the National Land Survey's (MML) vector tiles,
// whose CC BY 4.0 licence allows copies (its service's terms say nothing on storing
// them, so they're asked for gently, #1176). Aerial imagery (Esri doesn't allow
// offline caching) and the Kapsi raster maps (a volunteer-run service) are left out.

import { OFM_TILEJSON, OFM_SPRITE, OFM_GLYPHS, DEM_URL, MML_TERRAIN_TILES, MML_PROPERTY_TILES, FINLAND_BOUNDS, mmlApiKey } from './config.js';
import { densify, lonLatToTile, tileBounds, fmtDist } from './geo.js';
import { idb } from './idb.js';
import { openModal, closeModal } from './modal.js';
import { h, icon, toast } from './ui.js';

const TILES = 'polku-offline-tiles';
const SHELL = 'polku-shell-v1';
const FLAG = '/__polku/offline-preview';
const OFM_TILE = /^https:\/\/tiles\.openfreemap\.org\/planet\/[^/]+\/(\d+)\/(\d+)\/(\d+)\.pbf$/;
const ofmKey = (url) => url.replace(OFM_TILE, 'https://tiles.openfreemap.org/planet/offline/$1/$2/$3.pbf'); // same as sw.js
const isMml = (kind) => kind === 'mml' || kind === 'property';
const inFinland = ([w, s, e, n]) => e > FINLAND_BOUNDS[0] && w < FINLAND_BOUNDS[2] && n > FINLAND_BOUNDS[1] && s < FINLAND_BOUNDS[3];
// typical tile bytes per zoom, for the estimate (low zooms are big, a z14 trail tile is small; MML's z13 is its biggest, #1176)
const SIZE = { ofm: (z) => (z <= 9 ? 250e3 : z <= 11 ? 130e3 : z === 12 ? 70e3 : 40e3), dem: (z) => (z <= 9 ? 110e3 : 65e3),
  mml: (z) => (z <= 11 ? 60e3 : z === 12 ? 30e3 : z === 13 ? 100e3 : 40e3), property: () => 7e3 };
const MAX_TILES = 8000;
const ZOOMS = [5, 14]; // vector tiles stop at 14 (overzoomed beyond); 512 px terrain at 14 serves map zoom 15+
const FONTS = ['Noto Sans Regular', 'Noto Sans Bold', 'Noto Sans Italic'];
const RANGES = ['0-255', '256-511', '1024-1279', '8192-8447', '8448-8703']; // Latin, Finnish/Nordic letters, Cyrillic (names over the border), punctuation, arrows
const GLYPHS = FONTS.flatMap((f) => RANGES.map((r) => OFM_GLYPHS.replace('{fontstack}', f).replace('{range}', r)));
const areas = idb('offline');

export const offlineSupported = () => 'serviceWorker' in navigator && 'caches' in window && window.isSecureContext;

export function registerServiceWorker() {
  if (offlineSupported()) navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ------------------------------------------------------------------ planning
let tilejson = null;
/** OpenFreeMap's tile URL, from its TileJSON (as the map's), asked for once. */
export const ofmTemplate = () => (tilejson ||= fetch(OFM_TILEJSON).then((r) => r.json()).then((j) => j.tiles[0]).catch((e) => { tilejson = null; throw e; }));

/** Tiles covering `buffer` metres either side of the line, zoom 5–14; MML's in Finland with `mml` ({ key, property }:
 * your own key or none, and whether property boundaries are on). */
export async function planArea(line, { buffer = 1000, terrain = true, mml = null } = {}) {
  const tiles = new Map(); // cache key -> { url, kind }
  const sources = [[await ofmTemplate(), 'ofm', 5]];
  if (terrain) sources.push([DEM_URL, 'dem', 5]);
  // at their sources' zooms (js/style.js): the terrain from 11, property boundaries at 14 while their layer is on
  if (mml) {
    const key = `?api-key=${encodeURIComponent(mmlApiKey(mml.key))}`;
    sources.push([MML_TERRAIN_TILES + key, 'mml', 11]);
    if (mml.property) sources.push([MML_PROPERTY_TILES + key, 'property', 14]);
  }
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
      const fi = inFinland(tileBounds(+x, +y, z));
      for (const [tpl, kind, minzoom] of sources) {
        if (z < minzoom || (isMml(kind) && !fi)) continue;
        const url = tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y);
        // MML's kept under their address without the API key (as sw.js), so your own key added or removed later finds them
        tiles.set(kind === 'ofm' ? ofmKey(url) : isMml(kind) ? url.split('?')[0] : url, { url, kind, z });
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
  for (const u of GLYPHS) urls.add(u);
  await Promise.all([...urls].map(async (u) => {
    try {
      const res = await fetch(u, { cache: 'no-store' });
      if (res.ok) await cache.put(u, res);
    } catch { /* keep going: the worker also caches what the app loads */ }
  }));
}

// ------------------------------------------------------------------ saving
export async function saveArea({ name, line, bbox, route }, { buffer, terrain, mml }, onProgress, signal) {
  const plan = await planArea(line, { buffer, terrain, mml });
  if (plan.tiles.size > MAX_TILES) throw new Error('This area is too big to save. Try a narrower corridor.');
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  await saveShell();
  const cache = await caches.open(TILES);
  const list = [...plan.tiles];
  const fresh = [];
  let done = 0, bytes = 0, failed = 0, mmlFailed = 0;
  // `gap`: at least this many ms between one worker's requests, failed ones too
  const worker = async (queue, gap = 0) => {
    for (let item; !signal.aborted && (item = queue.pop());) {
      const [key, t] = item;
      const fail = () => { failed++; if (t.kind === 'mml') mmlFailed++; };
      let asked = 0;
      try {
        const hit = await cache.match(key);
        if (hit) bytes += +(hit.headers.get('x-size') || 0);
        else {
          asked = Date.now();
          const res = await fetch(t.url, { signal });
          if (res.ok) {
            const n = await keep(cache, key, res); // (not `bytes += await …`: six workers would overwrite each other's sums)
            bytes += n;
            fresh.push(key);
          } else if (res.status !== 404 || isMml(t.kind)) fail(); // 404: no terrain there (sea); MML answers every tile in its bounds
        }
      } catch {
        if (signal.aborted) break;
        fail();
      }
      onProgress(++done, list.length, bytes);
      if (gap && asked) await new Promise((r) => setTimeout(r, gap - (Date.now() - asked)));
    }
  };
  // MML's tiles two at a time, ten a second at most, beside the rest: its open service is shared by everyone without a
  // key of their own (#1176)
  const others = list.filter(([, t]) => !isMml(t.kind)), mmls = list.filter(([, t]) => isMml(t.kind));
  await Promise.all([...Array.from({ length: 6 }, () => worker(others)), ...Array.from({ length: 2 }, () => worker(mmls, 200))]);
  if (signal.aborted) {
    await dropUnused(fresh);
    throw new DOMException('Cancelled', 'AbortError');
  }
  const mmlTiles = list.filter(([, t]) => t.kind === 'mml').length;
  const area = { id: `a${Date.now().toString(36)}`, name, created: Date.now(), bbox, keys: [...plan.tiles.keys()], tiles: list.length, bytes, failed, buffer, terrain, mml: { tiles: mmlTiles, failed: mmlFailed }, route };
  await areas.set(area.id, area);
  return area;
}

// A tile kept in the offline cache, with its size for the areas' totals; its bytes.
async function keep(cache, key, res) {
  const blob = await res.blob();
  await cache.put(key, new Response(blob, { headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream', 'X-Size': String(blob.size) } }));
  return blob.size;
}

// Finland's overview (#1091's C): OpenFreeMap's 15 tiles at zoom 6, kept once, so the coarse map underneath
// (js/main.js) is there at once anywhere in Finland, offline too, and the worker answers them from here at once.
const OVERVIEW = (() => {
  const [x0, y0] = lonLatToTile(19.0, 70.1, 6).map(Math.floor), [x1, y1] = lonLatToTile(31.6, 59.6, 6).map(Math.floor), out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([x, y]);
  return out;
})();
const overviewKeys = OVERVIEW.map(([x, y]) => `https://tiles.openfreemap.org/planet/offline/6/${x}/${y}.pbf`);

/** Saves what's missing of Finland's overview and the names' letters it needs (MapLibre draws a tile only once its
 * names' glyphs have come); one that fails is asked for again on the next start. */
export async function saveOverview() {
  if (!offlineSupported()) return;
  const shell = await caches.open(SHELL);
  for (const u of GLYPHS) {
    if (await shell.match(u)) continue;
    const res = await fetch(u, { cache: 'no-store' });
    if (res.ok) await shell.put(u, res);
  }
  const cache = await caches.open(TILES), tpl = await ofmTemplate();
  for (const [i, [x, y]] of OVERVIEW.entries()) {
    if (await cache.match(overviewKeys[i])) continue;
    const res = await fetch(tpl.replace('{z}', 6).replace('{x}', x).replace('{y}', y));
    if (res.ok) await keep(cache, overviewKeys[i], res);
  }
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
  const used = new Set([...overviewKeys, ...(await listAreas()).flatMap((a) => a.keys)]);
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

let previewing = false;
/** Whether the map has only what's saved: the device offline, or Preview offline on. */
export const savedOnly = () => previewing || !navigator.onLine;

/** Banner while previewing, and a toast when Polku opens offline or the connection drops or returns. */
export async function initOfflineStatus() {
  if (!offlineSupported()) return;
  if ((previewing = await previewActive())) {
    document.body.append(h('div', { class: 'offline-banner', role: 'status' },
      h('span', { html: `${icon('offline', 16)} Offline preview: saved areas, and a coarse map of Finland` }),
      h('button', { type: 'button', class: 'btn', onclick: () => setPreview(false) }, 'Exit')));
  }
  // the app itself from the saved copy (the server didn't answer within 3 s): it may be an older Polku
  const sw = navigator.serviceWorker;
  if (sw.controller) {
    const onMsg = (e) => {
      if (!e.data || e.data.type !== 'saved-copy') return;
      sw.removeEventListener('message', onMsg);
      if (!e.data.saved) return;
      const bar = h('div', { class: 'offline-banner saved-copy', role: 'status' },
        h('span', { html: `${icon('offline', 16)} Saved copy: the server didn’t answer, so this may be an older Polku` }),
        h('button', { type: 'button', class: 'btn', onclick: () => location.reload() }, 'Reload'),
        h('button', { type: 'button', class: 'tool small', 'aria-label': 'Close', onclick: () => bar.remove(), html: icon('close', 14) }));
      document.body.append(bar);
    };
    sw.addEventListener('message', onMsg);
    sw.controller.postMessage({ type: 'saved-copy?' });
  }
  const offline = async () => {
    const n = (await listAreas()).length;
    toast(n ? 'You’re offline — saved areas and their routes still work; elsewhere only a coarse map of Finland' : 'You’re offline — only a coarse map of Finland, without trails (save an area from the route panel next time)', { ms: 6000 });
  };
  window.addEventListener('offline', offline);
  if (!navigator.onLine) offline(); // opened offline: the coarse map alone mustn't look like the whole map
  window.addEventListener('online', () => toast('Back online'));
}

// ------------------------------------------------------------------ UI
const mb = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(b < 1e7 ? 1 : 0)} MB` : `${Math.max(1, Math.round(b / 1e3))} kB`);

/** The "Save offline" dialog for a planned route. payload: { name, line, bbox, route, km }; mml: as planArea()'s */
export function openSaveOffline(payload, { onSaved, mml } = {}) {
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
        const p = await planArea(payload.line, { buffer, terrain, mml });
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
        const area = await saveArea({ ...payload, name: name.value.trim() || payload.name }, { buffer, terrain, mml }, (done, total, bytes) => {
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
      h('p', {}, 'Saves Polku’s trail map and terrain (hillshade, contours, 3D, uphill grades) along this route, with the route itself, so the map, route and profile work without signal. '
        + `In Finland it keeps the National Land Survey’s terrain too (bogs, rock, cliffs and the water’s marks)${mml && mml.property ? ', and property boundaries, as their layer is on' : ''}.`),
      h('label', { class: 'off-field' }, h('span', {}, 'Name'), name),
      h('div', { class: 'off-field' }, h('span', {}, 'Corridor either side'), corridor),
      h('label', { class: 'off-check' }, terrainBox, h('span', {}, 'Terrain', h('small', {}, 'Hillshade, contours, 3D and uphill grades. Half to three quarters of the size.'))),
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
    // what it lacks of MML's terrain (#1176): saved before it was kept, in Finland, or with some of its tiles failing
    const lacks = !a.mml ? (inFinland(a.bbox) ? 'Saved without the National Land Survey’s terrain' : '')
      : !a.mml.failed ? '' : a.mml.failed < a.mml.tiles ? 'The National Land Survey’s terrain is missing in parts' : 'The National Land Survey’s terrain didn’t load';
    box.append(h('div', { class: 'off-area' },
      h('div', { class: 'off-area-text' }, h('b', {}, a.name), h('small', {}, `${new Date(a.created).toLocaleDateString()} · ${mb(a.bytes)}${a.failed ? ` · ${a.failed} tiles missing` : ''}`),
        lacks ? h('small', {}, `${lacks}: save the area again to add it.`) : null),
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
