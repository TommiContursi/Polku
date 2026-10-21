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
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  roundtrip: '<circle cx="12" cy="12" r="7.5" stroke-dasharray="3 2.2"/><circle cx="12" cy="4.5" r="2.2" fill="currentColor" stroke="none"/><path d="m15.5 9.5 2-1.6.4 2.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  offline: '<path d="M7 18.5a4.5 4.5 0 1 1 1-8.9 6 6 0 0 1 11.3 1.9 3.8 3.8 0 0 1-1.3 7"/><path d="M12 11v9M8.8 16.8 12 20l3.2-3.2"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
  mountain: '<path d="m3 20 6.5-11 4 6.5L16 12l5 8H3Z"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronUp: '<path d="m6 15 6-6 6 6"/>',
  locate: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  bike: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 9h6l3.5 7.5M9 9l3 7.5L15 9M13 5h3l1 4"/>',
  gravel: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 10 9h5l3.5 7.5M10 9l2.5 7.5M14 6h2.5l-1.5 3"/><path d="M2 22h2M7 22h2M12 22h2M17 22h2" opacity=".6"/>',
  roadbike: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 10 9.5h6.5l2 7M10 9.5l2.5 7 4-7M14 5.5h3.2a1.4 1.4 0 0 1 .4 2.7"/>',
  run: '<circle cx="15" cy="4.5" r="2"/><path d="M13.6 7.6 11 13l2.6 3.2-1 4.8M11 13l-2.6 3.5H5M8 10.2l3.6-2 2.6 2.6 3-1.2"/>',
  trailrun: '<circle cx="13" cy="4.5" r="2"/><path d="M11.6 7.6 9 13l2.6 3.2-1 4.8M9 13l-2.6 3.5H3M6 10.2l3.6-2 2.6 2.6 3-1.2"/><path d="m14.5 21 3.5-5 1.6 2 1.4-1.6 1.5 4.6"/>',
  hike: '<circle cx="13" cy="4.5" r="2"/><path d="m9 21 2.5-7 3 3V21M11.5 14 12 9l-3 2v3M12 9l3 3 2.5-1"/><path d="M18 9v12"/>',
  paddle: '<path d="M2 17c2.5 1.5 5 1.5 7.5 0s5-1.5 7.5 0 3.5 1 5 .5"/><path d="M5 13.5h14l-2 2.5H7Z"/><path d="m6 5 12 9M4.5 3.8 7 5.7M17 13.3l2.5 1.9"/>',
  swim: '<circle cx="16" cy="6" r="2"/><path d="m4 13 5-3.5 3.5 2.5"/><path d="M2 17c2.5 1.5 5 1.5 7.5 0s5-1.5 7.5 0 3.5 1 5 .5"/><path d="M2 21c2.5 1.5 5 1.5 7.5 0s5-1.5 7.5 0 3.5 1 5 .5" opacity=".55"/>',
  // Over water: waves under a dashed line (a drop read as rain)
  water: '<path d="M2.5 17c2 1.4 4 1.4 6 0s4-1.4 6 0 4 1.4 6.5 0"/><path d="M2.5 21c2 1.4 4 1.4 6 0s4-1.4 6 0 4 1.4 6.5 0"/><circle cx="5" cy="9" r="1.8"/><circle cx="19" cy="5" r="1.8"/><path d="M6.6 8.2c3-1.5 6.8-2.2 10.6-2.6" stroke-dasharray="2.2 2"/>',
  straight: '<circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M6.5 17.5 17.5 6.5"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
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
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  grip: '<circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
  fit: '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/><path d="M8 15.5c2-1 2.5-4 4.5-4.5s2.5 2 3.5 1"/>',
  panelLeft: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9.5 4v16"/>',
  panelBottom: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 13.5h18"/>',
  more: '<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  cloud: '<path d="M7 19a5 5 0 1 1 1.6-9.7A6 6 0 0 1 20 13a3.5 3.5 0 0 1-2 6H7Z"/>',
  cloudSun: '<path d="M8 2.5v1.5M2.5 8H4M3.9 3.9l1 1M12.1 3.9l-1 1"/><path d="M5 10.5a3.5 3.5 0 0 1 6.3-3.4"/><path d="M8 20a4 4 0 1 1 1.3-7.8A5 5 0 0 1 19 14a3 3 0 0 1-1 6H8Z"/>',
  snow: '<path d="M7 15a5 5 0 1 1 1.6-9.7A6 6 0 0 1 20 9a4 4 0 0 1-2 6"/><path d="M8 18.5h.01M12 18h.01M16 18.5h.01M10 21.5h.01M14 21.5h.01" stroke-width="2.6"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  minus: '<path d="M5 12h14"/>',
  // the quick layer drawer's tiles (#123)
  trailcolors: '<path d="M3 20c2.5-.5 4-2.6 5.6-4.6" stroke="#22a447" stroke-width="2.6"/><path d="M8.6 15.4c1.5-1.9 2.7-3.7 5-4.6" stroke="#f59e0b" stroke-width="2.6"/><path d="M13.6 10.8C16.5 9.6 18 6.5 21 4" stroke="#ef4444" stroke-width="2.6"/>',
  details: '<path d="M3 20.5c1.8-1 3-2.6 4.4-4.4" stroke-width="3.6"/><path d="M7.4 16.1c1.5-2 3-4 5.6-5.2"/><path d="M13 10.9c2.8-1.3 4.6-3.8 7.5-6.6" stroke-dasharray=".1 3.4" stroke-width="2.5"/>',
  sign: '<path d="M12 22V3"/><path d="M5 5.5h11.5l2.5 2.5-2.5 2.5H5Z"/><path d="M19 13H7.5L5 15.5 7.5 18H19Z"/>',
  hut: '<path d="M2 20h20"/><path d="M4 20 12 5l8 15"/><path d="M9 20l3-6 3 6"/>',
  buoy: '<path d="M2 20c2.5 1.4 5 1.4 7.5 0s5-1.4 7.5 0 3.5 1 5 .5"/><path d="M8 17h8l-1.6-8H9.6Z"/><path d="M12 9V3.5M9.5 3.5h5"/>',
  depth: '<path d="M3 6.5c3 2 6 2 9 0s6-2 9 0"/><path d="M3 12c3 2 6 2 9 0s6-2 9 0" opacity=".75"/><path d="M3 17.5c3 2 6 2 9 0s6-2 9 0" opacity=".5"/>',
  ship: '<path d="M3 15h18l-2.6 5H5.6Z"/><path d="M6 15V9.5h9.5L18 15"/><path d="M9 9.5V5.5h3.5v4"/>',
  car: '<path d="M4 16.5v-4.3L6 7h12l2 5.2v4.3Z"/><path d="M4 12.2h16"/><circle cx="7.8" cy="16.6" r="1.7"/><circle cx="16.2" cy="16.6" r="1.7"/>',
  road: '<path d="M8 3 4 21M16 3l4 18"/><path d="M12 4v3M12 10.5v3M12 17v3"/>',
  cone: '<path d="M9.5 4h5l4 15h-13Z"/><path d="M7.3 12h9.4M3 19h18"/>',
  camera: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="m16 11 5-3v8l-5-3"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  flake: '<path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10"/><path d="m9.5 3.8 2.5 2 2.5-2M9.5 20.2l2.5-2 2.5 2"/>',
  zone: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="3 2.4"/><path d="m8 8 8 8"/>',
  num: '<path d="M4 20c4-1 6-6 9-8s5-4 7-8" opacity=".5"/><rect x="11" y="4" width="10" height="7" rx="2"/><path d="M14 7.5h4"/>',
  contours: '<path d="M4 17c2-4 5-6 8-6s6 2 8 6"/><path d="M7.5 17c1.4-2.6 2.9-3.6 4.5-3.6s3.1 1 4.5 3.6" opacity=".7"/><path d="M3 20.5h18"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1Q11.3 5 12 5c5 0 9 4.5 10 7a12.6 12.6 0 0 1-2.7 3.8M6.6 6.6C4.3 8 2.7 10.2 2 12c1 2.5 5 7 10 7 1.9 0 3.6-.6 5-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
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

/**
 * A small menu at `anchor`: below it when it fits, else above, else on the roomier side with
 * its own scroll, so its last items never fall off the window. It closes on a pick, a click
 * outside, Escape or a resize. Returns { el, close }.
 * items: [{ icon, label, desc, fn, disabled, cls, checked, radio } | 'hr' | null
 *   | { head, sub } (a title, e.g. the route's name) | { group, items } (a labelled group)
 *   | { note } | { chips: [items] } (small choices on one wrapping line)]
 * Options: align 'right' (to the anchor's right edge) or 'left'; maxRight keeps the menu left of
 * a line (the map's buttons); sheet: with no room above or below, it opens as a sheet of its own.
 */
let menuIds = 0;
export function popMenu(anchor, items, { label = '', onClose = null, align = 'right', maxRight = null, sheet = false } = {}) {
  const el = h('div', { class: 'menu menu-pop', role: 'menu', 'aria-label': label || null });
  let open = true;
  const close = (refocus = false) => {
    if (!open) return;
    open = false;
    el.remove();
    document.removeEventListener('pointerdown', off, true);
    document.removeEventListener('keydown', key, true);
    removeEventListener('resize', onResize);
    if (refocus) anchor.focus();
    if (onClose) onClose();
  };
  const off = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) close(); };
  const onResize = () => close();
  const key = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const list = [...el.querySelectorAll('.menu-item:not(:disabled)')];
    if (!list.length) return;
    e.preventDefault();
    const k = list.indexOf(document.activeElement);
    list[(k + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length].focus();
  };
  const add = (to, it, chip = false) => {
    if (!it) return;
    if (it === 'hr') { to.append(h('hr')); return; }
    if (it.head != null) { to.append(h('div', { class: 'menu-head' }, h('b', {}, it.head), it.sub ? h('small', { html: `${icon('check', 13)}${escapeHtml(it.sub)}` }) : null)); return; }
    if (it.note) { to.append(h('p', { class: 'menu-note' }, it.note)); return; }
    if (it.node) { to.append(it.node); return; } // a part of its own (the drawing menu's Next leg)
    if (it.group) {
      const id = `menu-h-${++menuIds}`, g = h('div', { role: 'group', 'aria-labelledby': id });
      to.append(h('div', { class: 'menu-h', id }, it.group), g);
      for (const x of it.items) add(g, x);
      return;
    }
    if (it.chips) { const c = h('div', { class: 'menu-chips' }); for (const x of it.chips) add(c, x, true); to.append(c); return; }
    const role = it.radio ? 'menuitemradio' : it.checked != null ? 'menuitemcheckbox' : 'menuitem';
    const html = chip ? `${it.checked ? icon('check', 15) : ''}<span>${it.label}</span>`
      : `${icon(it.icon, 17)}<span>${it.label}${it.desc ? `<small>${it.desc}</small>` : ''}</span>${it.radio && it.checked ? `<span class="menu-tick">${icon('check', 17)}</span>` : ''}${it.after || ''}`;
    // `keep`: the menu stays open (a part that opens in place, a choice that changes what it lists)
    const b = h('button', { type: 'button', role, class: `menu-item${chip ? ' chip' : ''}${it.desc ? ' two-line' : ''} ${it.cls || ''}`, html, onclick: () => { if (!it.keep) close(); it.fn(); } });
    if (it.disabled) b.disabled = true;
    if (it.checked != null) b.setAttribute('aria-checked', String(!!it.checked));
    if (it.expanded != null) b.setAttribute('aria-expanded', String(!!it.expanded));
    to.append(b);
  };
  for (const it of items) add(el, it);
  document.body.append(el);
  // where it goes: beside its button, on screen, scrolling inside when taller than the room; again when it grows
  const place = () => {
    Object.assign(el.style, { width: '', minWidth: '', top: '', left: '', maxHeight: '' });
    el.classList.remove('menu-sheet', 'menu-up');
    const r = anchor.getBoundingClientRect(), gap = 8;
    const right = Math.min(innerWidth - gap, maxRight ?? Infinity);
    if (el.offsetWidth > right - gap) Object.assign(el.style, { width: `${right - gap}px`, minWidth: '0' });
    const mh = el.scrollHeight, mw = el.offsetWidth;
    const below = innerHeight - r.bottom - gap - 4, above = r.top - gap - 4;
    if (sheet && (Math.max(below, above) < Math.min(mh, 240) || right - gap < 240)) {
      Object.assign(el.style, { width: '', minWidth: '' });
      el.classList.add('menu-sheet'); // no room beside its button (enlarged text, a raised sheet): a sheet of its own
    } else {
      if (mh <= below || (mh > above && below >= above)) {
        el.style.top = `${r.bottom + 4}px`;
        if (mh > below) el.style.maxHeight = `${below}px`;
      } else {
        el.style.top = `${Math.max(gap, r.top - 4 - mh)}px`;
        if (mh > above) el.style.maxHeight = `${above}px`;
        el.classList.add('menu-up');
      }
      el.style.left = `${Math.max(gap, Math.min(right - mw, align === 'left' ? r.left : r.right - mw))}px`;
    }
  };
  place();
  (el.querySelector('.menu-item[aria-checked="true"]:not(:disabled)') || el.querySelector('.menu-item:not(:disabled)'))?.focus({ preventScroll: true });
  setTimeout(() => {
    if (!open) return;
    document.addEventListener('pointerdown', off, true);
    document.addEventListener('keydown', key, true);
    addEventListener('resize', onResize);
  });
  // the same menu with new contents, where it is (a choice inside it that changes what it lists)
  const refill = (next) => { const top = el.scrollTop; el.replaceChildren(); for (const it of next) add(el, it); place(); el.scrollTop = top; };
  return { el, close, refill };
}

/**
 * A toolbar button's tooltip: its name, its keys and one sentence. The first one waits about
 * 450 ms; while one was just shown, the next comes at once. Keyboard focus shows it too; it stays
 * while the pointer is on it, and Escape hides it (WCAG 1.4.13). Mouse only: a tap shows none.
 */
let tipEl = null, tipShow = 0, tipHide = 0, tipLast = 0, tipFor = null;
export function tooltip(el, { name, keys = '', text = '' }) {
  if (!tipEl) {
    tipEl = h('div', { class: 'tip', role: 'tooltip', id: 'tip', hidden: true });
    tipEl.addEventListener('pointerenter', () => clearTimeout(tipHide));
    tipEl.addEventListener('pointerleave', () => hideTip());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !tipEl.hidden) hideTip(0); }, true);
    document.body.append(tipEl);
  }
  const show = () => {
    clearTimeout(tipHide);
    tipFor = el;
    tipEl.innerHTML = `<b>${escapeHtml(name)}${keys ? keys.split(' ').map((k) => `<kbd>${escapeHtml(k)}</kbd>`).join('') : ''}</b>${escapeHtml(text)}`;
    tipEl.hidden = false;
    el.setAttribute('aria-describedby', 'tip');
    const r = el.getBoundingClientRect(), w = tipEl.offsetWidth;
    tipEl.style.left = `${Math.max(8, Math.min(innerWidth - 8 - w, r.left + r.width / 2 - w / 2))}px`;
    tipEl.style.top = `${r.bottom + 8}px`;
  };
  const later = () => {
    clearTimeout(tipShow);
    if (el.getAttribute('aria-expanded') === 'true') return; // its menu is open: nothing over it
    tipShow = setTimeout(show, Date.now() - tipLast < 900 ? 0 : 450);
  };
  el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !el.disabled) later(); });
  el.addEventListener('pointerleave', () => { clearTimeout(tipShow); if (tipFor === el) hideTip(); });
  el.addEventListener('focus', () => { if (el.matches(':focus-visible')) show(); });
  el.addEventListener('blur', () => { if (tipFor === el) hideTip(0); });
  el.addEventListener('pointerdown', () => { clearTimeout(tipShow); if (tipFor === el) hideTip(0); });
}
function hideTip(ms = 120) {
  clearTimeout(tipHide);
  tipHide = setTimeout(() => {
    if (!tipEl || tipEl.hidden) return;
    tipEl.hidden = true;
    tipLast = Date.now();
    tipFor?.removeAttribute('aria-describedby');
    tipFor = null;
  }, ms);
}

let toastTimer = 0;
export function toast(msg, { tone = 'info', ms = 3500, action = null } = {}) {
  const t = $('#toast');
  t.textContent = msg;
  // one thing to do about it ("Paddle this leg"), right in the message; or a choice of a few ("Paddle", "Swim", "Stay on land")
  t.classList.toggle('choice', [].concat(action || []).length > 1);
  for (const act of [].concat(action || [])) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-act';
    b.textContent = act.label;
    b.addEventListener('click', () => { t.classList.remove('show'); setTimeout(() => { t.hidden = true; }, 250); act.fn(); });
    t.append(' ', b);
  }
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
