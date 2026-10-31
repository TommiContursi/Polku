// Search, grouped: places (Photon / OSM, biased to the view), LIPAS routes and
// stops by name (js/lipas.js), named trails on the loaded map, and coordinates
// like "61.497, 23.761". Each group shows as it arrives. Picking a route fits it
// and opens its card, where "Follow this route" is one tap away. Recent picks are
// kept on this device.

import { PHOTON, LIPAS_TYPES } from './config.js';
import { request } from './net.js';
import { findLipas, lipasPlace } from './lipas.js';
import { dist, bbox, fmtDist, lineLength } from './geo.js';
import { store, toast } from './ui.js';

const GROUPS = [['coords', 'Coordinates'], ['recent', 'Recent'], ['places', 'Places'], ['routes', 'Routes · LIPAS'], ['stops', 'Stops · LIPAS'], ['trails', 'Trails on the map']];
const MAX = { places: 5, routes: 5, stops: 4, trails: 3, recent: 6 };
const RECENT = 'recentSearches';
// Settings › Saved on this device lists how many, and clears them
export const recentSearches = () => store.get(RECENT, []);
export const clearRecentSearches = () => store.set(RECENT, []);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const shortType = (type) => (LIPAS_TYPES[type] ? LIPAS_TYPES[type].name.replace(/\s*\(.*\)$/, '') : 'LIPAS');

export function initSearch(map, input, list, app) {
  let timer = 0;
  let ctrl = null;
  let groups = {};
  let flat = [];
  let active = -1;
  let run = 0;
  let order = []; // groups in the order they first showed for this query: a late one goes below, so nothing moves under your finger

  const close = () => { list.hidden = true; active = -1; };

  const remember = (r) => {
    if (r.kind === 'coords') return;
    const keep = { kind: r.kind, label: r.label, sub: r.sub, center: r.center, bbox: r.bbox, zoom: r.zoom, lipas: r.lipas };
    const old = store.get(RECENT, []).filter((x) => !(x.label === keep.label && x.sub === keep.sub));
    store.set(RECENT, [keep, ...old].slice(0, MAX.recent));
  };

  const choose = async (r) => {
    close();
    input.value = r.label;
    input.blur();
    remember(r);
    if (r.lipas) {
      const near = map.getCenter().toArray();
      const padding = app.padding ? app.padding() : 70;
      try {
        const place = await lipasPlace(r.lipas.type, r.lipas.id);
        if (place.parts.length) {
          const all = place.parts.flatMap((p) => p.coords), b = bbox(all);
          // the card on the route, near the middle of the view (listening first: with reduced motion the move ends at once)
          const mid = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
          const at = all.reduce((best, c) => (dist(c, mid) < dist(best, mid) ? c : best), all[0]);
          map.once('moveend', () => app.openLipas(place.props, at, near, place.parts));
          map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding, maxZoom: 15, duration: 800 });
        } else if (place.point) {
          map.once('moveend', () => app.openLipas(place.props, place.point, near));
          map.flyTo({ center: place.point, zoom: Math.max(map.getZoom(), 15), duration: 800 });
        }
      } catch (e) {
        toast(e.message || 'LIPAS isn\'t answering — try again in a moment', { tone: 'warn' });
      }
      return;
    }
    if (r.bbox) map.fitBounds(r.bbox, { padding: app.padding ? app.padding() : 60, maxZoom: 15, duration: 900 });
    else map.flyTo({ center: r.center, zoom: Math.max(map.getZoom(), r.zoom || 14), duration: 900 });
  };

  const render = () => {
    list.innerHTML = '';
    flat = [];
    for (const [key] of GROUPS) if ((groups[key] || []).length && !order.includes(key)) order.push(key);
    for (const key of order) {
      const title = GROUPS.find((g) => g[0] === key)[1];
      const items = (groups[key] || []).slice(0, MAX[key] || 5);
      if (!items.length) continue;
      const head = document.createElement('li');
      head.className = 'r-group';
      head.setAttribute('role', 'presentation');
      head.textContent = title;
      list.appendChild(head);
      for (const r of items) {
        const i = flat.length;
        flat.push(r);
        const li = document.createElement('li');
        li.role = 'option';
        li.dataset.kind = r.kind;
        li.className = i === active ? 'active' : '';
        li.innerHTML = '<span class="r-name"></span><span class="r-sub"></span>';
        li.querySelector('.r-name').textContent = r.label;
        li.querySelector('.r-sub').textContent = r.sub;
        li.addEventListener('pointerdown', (e) => { e.preventDefault(); choose(r); });
        list.appendChild(li);
      }
    }
    if (active >= flat.length) active = flat.length - 1;
    list.hidden = !flat.length;
  };

  const showRecent = () => {
    order = [];
    groups = { recent: store.get(RECENT, []) };
    active = -1;
    render();
  };

  const search = async (q) => {
    const my = ++run;
    order = [];
    const m = q.match(/^\s*(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)\s*$/);
    if (m) {
      let lat = +m[1], lon = +m[2];
      if (Math.abs(lat) > 90) [lat, lon] = [lon, lat];
      groups = { coords: [{ kind: 'coords', label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, sub: 'Coordinates', center: [lon, lat], zoom: 15 }] };
      active = 0;
      render();
      return;
    }
    groups = { trails: trailsNamed(map, q) };
    active = groups.trails.length ? 0 : -1;
    render();
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    const c = map.getCenter();
    const center = [c.lng, c.lat];
    const settle = () => { if (my !== run) return; if (active < 0 && flat.length) active = 0; render(); };
    // nearer places first: the map's middle to about a kilometre (while the map follows you, it's where you are)
    const places = request('photon', `${PHOTON}?q=${encodeURIComponent(q)}&limit=7&lat=${c.lat.toFixed(2)}&lon=${c.lng.toFixed(2)}&location_bias_scale=0.4`, { signal })
      .then((res) => res.json())
      .then((gj) => {
        // a path Photon finds is usually one already under "Trails on the map" (both are OSM)
        const shown = new Set((groups.trails || []).map((t) => t.label.toLowerCase()));
        groups.places = gj.features.filter((f) => !(f.properties.osm_key === 'highway' && shown.has(String(f.properties.name || '').toLowerCase()))).map((f) => {
          const p = f.properties;
          const ext = p.extent; // [w, n, e, s]
          return {
            kind: 'places',
            label: p.name || p.street || 'Unnamed',
            sub: [p.osm_value && p.osm_value.replace(/_/g, ' '), p.city || p.county, p.country].filter(Boolean).join(' · '),
            center: f.geometry.coordinates,
            bbox: ext ? [[ext[0], ext[3]], [ext[2], ext[1]]] : null,
            zoom: p.osm_key === 'place' ? 12 : 15,
          };
        });
        settle();
      })
      .catch(() => {});
    const lipas = q.length < 3 ? null : findLipas(q, center, signal)
      .then(({ routes, stops }) => {
        const sport = app.sportTypes ? app.sportTypes() : [];
        groups.routes = rank(routes, q, center, sport).map((r) => lipasItem(r, center));
        groups.stops = rank(stops, q, center, []).map((r) => lipasItem(r, center));
        // an OSM path named like a LIPAS route is that route: the LIPAS one has its card and Follow
        const named = new Set(groups.routes.map((r) => r.label.toLowerCase()));
        if (groups.trails) groups.trails = groups.trails.filter((t) => !named.has(t.label.toLowerCase()));
        settle();
      })
      .catch(() => {});
    await Promise.all([places, lipas]);
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) { run++; showRecent(); return; }
    if (q.length < 2) { run++; groups = {}; order = []; render(); return; }
    timer = setTimeout(() => search(q), 260);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { active = Math.min(flat.length - 1, active + 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && flat[active]) choose(flat[active]);
    else if (e.key === 'Escape') { close(); input.blur(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('focus', () => { if (!input.value.trim()) showRecent(); else if (flat.length) list.hidden = false; });
}

// Better matches first (the whole name, its start, a word's start), then routes
// for your sport, then nearer ones.
function rank(list, q, center, sport) {
  const qq = q.toLowerCase(), word = new RegExp(`(^|[\\s/(\\-–,.])${esc(qq)}`);
  const score = (r) => {
    const n = r.name.toLowerCase();
    return (n === qq ? 4 : n.startsWith(qq) ? 3 : word.test(n) ? 2 : 1) + (sport.includes(r.type) ? 1 : 0) + (r.near ? 1 : 0);
  };
  return list
    .map((r) => ({ r, s: score(r), d: r.at ? dist(r.at, center) : Infinity }))
    .sort((a, b) => b.s - a.s || a.d - b.d)
    .map((x) => x.r);
}

function lipasItem(r, center) {
  const away = r.at ? dist(r.at, center) : null;
  return {
    kind: r.type > 4000 && r.type < 4800 ? 'routes' : 'stops',
    label: r.name,
    sub: [shortType(r.type), r.city, away != null ? `${fmtDist(away)} away` : ''].filter(Boolean).join(' · '),
    lipas: { type: r.type, id: r.id },
  };
}

// Paths and tracks with this name in the map tiles already loaded (no request).
function trailsNamed(map, q) {
  if (!map.getSource('ofm') || q.length < 3) return [];
  const qq = q.toLowerCase();
  let feats = [];
  try {
    feats = map.querySourceFeatures('ofm', { sourceLayer: 'transportation_name', filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]] });
  } catch { return []; }
  const by = new Map();
  for (const f of feats) {
    const name = f.properties.name;
    if (!name || !name.toLowerCase().includes(qq)) continue;
    const g = f.geometry;
    const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    if (!by.has(name)) by.set(name, { pts: [], len: 0, cls: f.properties.class });
    const t = by.get(name);
    for (const l of lines) { t.pts.push(...l); t.len += lineLength(l); }
  }
  return [...by.entries()]
    .sort((a, b) => b[1].len - a[1].len)
    .map(([name, t]) => {
      const b = bbox(t.pts);
      return { kind: 'trails', label: name, sub: `${t.cls === 'track' ? 'Track' : 'Path'} · on the map`, bbox: [[b[0], b[1]], [b[2], b[3]]] };
    });
}
