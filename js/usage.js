// "Data sources" in Layers: calls per free service this session and today,
// counted the way each provider counts them, against their published limits.

import { usage, clock } from './net.js';
import { h } from './ui.js';

const fmt = (n) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString();

export function renderUsage(box) {
  box.innerHTML = '';
  const rows = usage().filter((u) => u.id === 'openmeteo' || u.today || u.session || u.status).sort((a, b) => b.today - a.today);
  for (const u of rows) {
    const near = u.windows.some((w) => w.used >= 0.8 * w.max);
    box.append(h('div', { class: `use-row${near ? ' near' : ''}${u.status ? ' limited' : ''}` },
      h('div', { class: 'use-head' },
        h('b', {}, u.label), h('small', {}, u.what),
        h('span', { class: 'use-count', title: 'Calls this session · today (UTC day)' }, `${fmt(u.session)} · ${fmt(u.today)} today`)),
      u.status ? h('p', { class: 'use-status' }, `${u.status.reason === 'limit' ? 'Limiting requests' : 'Not responding'} — trying again at ${clock(u.status.until)}`) : null,
      ...u.windows.map((w) => {
        const pct = Math.min(100, (w.used / w.max) * 100);
        return h('div', { class: 'use-win', title: `${fmt(w.used)} of ${w.max.toLocaleString()} calls per ${w.name}` },
          h('span', {}, `per ${w.name}`),
          h('div', { class: `use-bar${pct >= 80 ? ' hot' : ''}` }, h('i', { style: `width:${pct.toFixed(1)}%` })),
          h('small', {}, `${fmt(w.used)} / ${w.max.toLocaleString()}`));
      })));
  }
  box.append(h('p', { class: 'note' }, 'Counted on this device. Open-Meteo counts every location as a call. The providers count per internet connection, so other devices on the same network add to their totals.'));
}
