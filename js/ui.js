// DOM helpers, toasts and a small inline icon set.

const P = {
  layers: '<path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="m2 13 10 5 10-5"/><path d="m2 18 10 5 10-5" opacity=".55"/>',
  route: '<circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="5" r="2.2"/><path d="M8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16"/>',
  legend: '<path d="M4 6h3M4 12h3M4 18h3M10 6h10M10 12h10M10 18h10"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  reverse: '<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/>',
  loop: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  offline: '<path d="M7 18.5a4.5 4.5 0 1 1 1-8.9 6 6 0 0 1 11.3 1.9 3.8 3.8 0 0 1-1.3 7"/><path d="M12 11v9M8.8 16.8 12 20l3.2-3.2"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
  mountain: '<path d="m3 20 6.5-11 4 6.5L16 12l5 8H3Z"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronUp: '<path d="m6 15 6-6 6 6"/>',
  locate: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  bike: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 9h6l3.5 7.5M9 9l3 7.5L15 9M13 5h3l1 4"/>',
  gravel: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 10 9h5l3.5 7.5M10 9l2.5 7.5M14 6h2.5l-1.5 3"/><path d="M2 22h2M7 22h2M12 22h2M17 22h2" opacity=".6"/>',
  hike: '<circle cx="13" cy="4.5" r="2"/><path d="m9 21 2.5-7 3 3V21M11.5 14 12 9l-3 2v3M12 9l3 3 2.5-1"/><path d="M18 9v12"/>',
  paddle: '<path d="M2 17c2.5 1.5 5 1.5 7.5 0s5-1.5 7.5 0 3.5 1 5 .5"/><path d="M5 13.5h14l-2 2.5H7Z"/><path d="m6 5 12 9M4.5 3.8 7 5.7M17 13.3l2.5 1.9"/>',
  water: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>',
  straight: '<circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M6.5 17.5 17.5 6.5" stroke-dasharray="2.5 2"/>',
  auto: '<circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M7 19h4c2 0 3-1 3-3v-2c0-2 1-3 3-3h0c1.5 0 2-1 2-2V7"/>',
  wind: '<path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  warn: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4.5M12 17.5v.5"/>',
  cube: '<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z"/><path d="M12 22V12M21 7l-9 5-9-5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  rotL: '<path d="M4.5 13a7.5 7.5 0 1 0 2.2-6.3"/><path d="M4 4v5h5"/>',
  rotR: '<path d="M19.5 13a7.5 7.5 0 1 1-2.2-6.3"/><path d="M20 4v5h-5"/>',
  tiltUp: '<path d="M3 19 8 9h8l5 10Z"/><path d="M12 7V2M9.5 4.5 12 2l2.5 2.5"/>',
  tiltDown: '<rect x="4" y="9" width="16" height="10" rx="1"/><path d="M12 2v5M9.5 4.5 12 7l2.5-2.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m12 4.5 3 7.5H9l3-7.5Z" fill="currentColor"/><path d="m12 19.5-3-7.5h6l-3 7.5Z"/>',
  temp: '<path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z"/><path d="M12 10v6"/>',
  rain: '<path d="M7 16a5 5 0 1 1 1.6-9.7A6 6 0 0 1 20 10a4 4 0 0 1-2 6"/><path d="m9 19-1 2M13 19l-1 2M17 19l-1 2"/>',
  play: '<path d="M7 4v16l13-8Z" fill="currentColor"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  cloud: '<path d="M7 19a5 5 0 1 1 1.6-9.7A6 6 0 0 1 20 13a3.5 3.5 0 0 1-2 6H7Z"/>',
  cloudSun: '<path d="M8 2.5v1.5M2.5 8H4M3.9 3.9l1 1M12.1 3.9l-1 1"/><path d="M5 10.5a3.5 3.5 0 0 1 6.3-3.4"/><path d="M8 20a4 4 0 1 1 1.3-7.8A5 5 0 0 1 19 14a3 3 0 0 1-1 6H8Z"/>',
  snow: '<path d="M7 15a5 5 0 1 1 1.6-9.7A6 6 0 0 1 20 9a4 4 0 0 1-2 6"/><path d="M8 18.5h.01M12 18h.01M16 18.5h.01M10 21.5h.01M14 21.5h.01" stroke-width="2.6"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>',
};

export const icon = (name, size = 20) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let toastTimer = 0;
export function toast(msg, { tone = 'info', ms = 3500 } = {}) {
  const t = $('#toast');
  t.textContent = msg;
  t.dataset.tone = tone;
  t.hidden = false;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => { t.hidden = true; }, 250); }, ms);
}

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(`polku:${key}`);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`polku:${key}`, JSON.stringify(value)); } catch { /* private mode */ }
  },
};
