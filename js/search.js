// Place search (Photon / OSM), biased to the current view. Also accepts
// coordinates like "61.497, 23.761".

import { PHOTON } from './config.js';
import { request } from './net.js';

export function initSearch(map, input, list) {
  let timer = 0;
  let ctrl = null;
  let results = [];
  let active = -1;

  const close = () => { list.hidden = true; active = -1; };
  const choose = (r) => {
    close();
    input.value = r.label;
    input.blur();
    if (r.bbox) map.fitBounds(r.bbox, { padding: 60, maxZoom: 15, duration: 900 });
    else map.flyTo({ center: r.center, zoom: Math.max(map.getZoom(), r.zoom || 14), duration: 900 });
  };

  const render = () => {
    list.innerHTML = '';
    results.forEach((r, i) => {
      const li = document.createElement('li');
      li.role = 'option';
      li.className = i === active ? 'active' : '';
      li.innerHTML = `<span class="r-name"></span><span class="r-sub"></span>`;
      li.querySelector('.r-name').textContent = r.label;
      li.querySelector('.r-sub').textContent = r.sub;
      li.addEventListener('pointerdown', (e) => { e.preventDefault(); choose(r); });
      list.appendChild(li);
    });
    list.hidden = !results.length;
  };

  const run = async (q) => {
    const m = q.match(/^\s*(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)\s*$/);
    if (m) {
      let lat = +m[1], lon = +m[2];
      if (Math.abs(lat) > 90) [lat, lon] = [lon, lat];
      results = [{ label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, sub: 'Coordinates', center: [lon, lat], zoom: 15 }];
      active = 0;
      render();
      return;
    }
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    const c = map.getCenter();
    const url = `${PHOTON}?q=${encodeURIComponent(q)}&limit=7&lat=${c.lat.toFixed(3)}&lon=${c.lng.toFixed(3)}&location_bias_scale=0.4`;
    try {
      const res = await request('photon', url, { signal: ctrl.signal });
      const gj = await res.json();
      results = gj.features.map((f) => {
        const p = f.properties;
        const sub = [p.osm_value && p.osm_value.replace(/_/g, ' '), p.city || p.county, p.country].filter(Boolean).join(' · ');
        const ext = p.extent; // [w, n, e, s]
        return {
          label: p.name || p.street || 'Unnamed',
          sub,
          center: f.geometry.coordinates,
          bbox: ext ? [[ext[0], ext[3]], [ext[2], ext[1]]] : null,
          zoom: p.osm_key === 'place' ? 12 : 15,
        };
      });
      active = results.length ? 0 : -1;
      render();
    } catch (e) {
      if (e.name !== 'AbortError') { results = []; render(); }
    }
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { results = []; render(); return; }
    timer = setTimeout(() => run(q), 220);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { active = Math.min(results.length - 1, active + 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && results[active]) choose(results[active]);
    else if (e.key === 'Escape') { close(); input.blur(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('focus', () => { if (results.length) list.hidden = false; });
}
