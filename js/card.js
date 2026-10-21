// One card at a time for what's on the map (25d, #345): a point, and in later parts a stretch, a warning, a spot.
// Phones with the planner open show it in the planner's peek, at the thumb; elsewhere it floats at its spot, its
// corner at the point, opening the other way near an edge. Opening a card is a step of history, so the phone's
// back gesture, Back and Escape go back one card, and from the first one close it, leaving the planner as it was.
// The focus goes to the card's title, and back where it was when the card closes.
//
// A card is built from the app's own controls, with their classes (DEVELOPING, "Shared controls"): the start's top
// row and heading (way-bar, way-head, way-hint), the route's numbers (sheet-sum, sum-item), the ⋯ menu's headings
// (menu-h), the one main action (btn primary big) and the "You're not editing" note (pl-viewnote). New for the cards:
// card-mark (the thing's own mark), row (a plain row in a list of rows), seg icons (a switch with icons), sum-item
// miss (a number the map doesn't have) and card-pill (the action at the spot, on a phone).
import { icon, h } from './ui.js';
import { keepInView } from './inspect.js';

// ------------------------------------------------------------------ the parts

// Three numbers, each with what it is under it ("10:09", "there at"); a missing one dashed, saying so
export function nums(list) {
  return h('div', { class: 'sheet-sum' }, ...list.filter(Boolean).map(({ value, label, missing }) =>
    h('span', { class: `sum-item${missing ? ' miss' : ''}` }, h('b', {}, value), h('small', {}, label))));
}

// A group's heading, as the ⋯ menu's (it names the rows under it for screen readers too)
export function group(title, ...items) {
  const list = rows(...items);
  if (!list) return null;
  const head = h('h4', { class: 'menu-h' }, title);
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', title);
  return [head, list];
}

// Rows in a list: a hairline between them
export function rows(...items) {
  const kept = items.flat().filter(Boolean);
  return kept.length ? h('div', { class: 'rows' }, ...kept) : null;
}
// Actions in a list: rows on a phone; on a desktop buttons with their icon and name, two a row, each line its tooltip,
// and a red one on a row of its own (Revision 5)
export function acts(...items) {
  const list = rows(...items);
  if (list) list.classList.add('acts');
  return list;
}

// A plain row: its icon, its name, one line on what it does, a value in the accent colour and › when it opens a
// choice. On a desktop the line is the row's tooltip instead.
export function item({ icon: ic, label, line = '', val = null, chev = false, danger = false, role = null, checked = null, cur = null, k = null, onclick, el = 'button' }) {
  const b = h(el, { type: el === 'button' ? 'button' : null, class: `row${danger ? ' danger' : ''}`, role, 'aria-checked': checked == null ? null : String(checked), 'data-k': k, title: line || null, onclick },
    h('span', { 'aria-hidden': 'true', html: icon(ic, 20) }),
    h('span', {}, h('b', {}, label), line ? h('small', {}, line) : null),
    val != null || cur ? h('span', { class: 'val' }, val ?? cur) : null,
    checked ? h('span', { class: 'menu-tick', 'aria-hidden': 'true', html: icon('check', 20) }) : null,
    chev ? h('span', { class: 'way-chev', 'aria-hidden': 'true', html: icon('chevronRight', 18) }) : null);
  return b;
}

// The card's one main action, as Make 3 loops
export function mainButton(label, ic, onclick) {
  return h('button', { type: 'button', class: 'btn primary big', onclick, html: icon(ic, 20) }, h('span', {}, label));
}

// The route's view: the planner's own note, with Edit (25c)
export function lockNote(text, onEdit) {
  return h('div', { class: 'pl-viewnote', role: 'note' },
    h('span', { html: icon('info', 18), 'aria-hidden': 'true' }), h('span', {}, text),
    h('button', { type: 'button', class: 'btn small', onclick: onEdit, html: `${icon('pencil', 16)}<span>Edit</span>` }));
}

// A switch whose choices have icons over (or beside) their words; the chosen one has aria-checked. The arrow keys
// move along it and choose, as a radio group does.
export function segIcons(label, choices, pick) {
  const seg = h('div', { class: 'seg icons', role: 'radiogroup', 'aria-label': label },
    ...choices.map(({ k, label: l, icon: ic, on }) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(!!on), tabindex: on ? '0' : '-1', 'data-k': k,
      onclick: () => { if (!on) pick(k); }, html: icon(ic, 20) }, h('span', {}, l))));
  if (!seg.querySelector('[tabindex="0"]')) seg.firstElementChild.tabIndex = 0;
  seg.addEventListener('keydown', (e) => {
    const bs = [...seg.children], i = bs.indexOf(document.activeElement), d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (i < 0 || !d) return;
    e.preventDefault();
    const next = bs[(i + d + bs.length) % bs.length];
    next.focus();
    next.click();
  });
  return seg;
}

// ------------------------------------------------------------------ the host

const OFFSET = 14; // the float's corner from its spot, so the point stays in sight beside it
const NARROW = 290; // px: a card this narrow (200 %, a small phone) has its top row of its own, and undo and redo in it

export class CardHost {
  // peek: where a phone's card goes; where(): 'peek' or 'float' now; onChange(card | null) after it changes.
  // onPop: a step of history went back (the map stays where it is); pad(): the room the planner takes { left, bottom }.
  // keep(): how the planner is before the first card opens (its sheet, its list's scroll); restore(it) puts it back.
  // dock(): undo and redo for a narrow card's top row ({ undo, redo, canUndo, canRedo }), or null.
  constructor(map, { peek, where, onChange = () => {}, onPop = () => {}, pad = () => ({}), keep = () => null, restore = () => {}, dock = () => null }) {
    Object.assign(this, { map, peek, where, onChange, onPop, pad, keepState: keep, restoreState: restore, dock });
    this.stack = []; // [{ card, at, beside, from }], the open one last
    this.depth = 0; // steps of history the cards pushed
    this.skip = 0; // steps back of our own still to come (history.go() is asynchronous)
    this.popup = null;
    this.pill = null;
    this.folded = null;
    this.focusBack = null;
    this.saved = null;
    // how the last card was opened: its title's focus ring shows only for the keyboard
    this.byKey = false;
    addEventListener('keydown', () => { this.byKey = true; }, true);
    addEventListener('pointerdown', () => { this.byKey = false; }, true);
    addEventListener('popstate', () => {
      if (this.skip) { this.skip--; this.onPop(); this.syncHistory(); return; }
      if (!this.depth) return;
      this.depth--;
      this.onPop();
      this.stepBack();
    });
  }

  get current() { return this.stack.length ? this.stack[this.stack.length - 1].card : null; }
  // where the open card is: 'peek', 'float', or null (none, or folded to its banner)
  get place() { return this.box && !this.folded ? (this.popup ? 'float' : 'peek') : null; }
  get narrow() { return !!this.box && this.box.offsetWidth > 0 && this.box.offsetWidth <= NARROW; }

  // One step of history for each card open, no more and no fewer: pushed for a card opened, gone back over for one
  // closed. While a step back of our own is on its way, nothing is pushed: it would be the one gone back over.
  syncHistory() {
    if (this.skip) return;
    const want = this.stack.length;
    while (this.depth < want) {
      history.pushState({ ...(history.state || {}), polkuCard: this.depth + 1 }, '');
      this.depth++;
    }
    if (this.depth > want) {
      this.skip++;
      history.go(want - this.depth);
      this.depth = want;
    }
  }

  // `from`: the card it came from (Back goes back to it), or the place it was opened from ('map', 'list', 'check', 'row',
  // 'section'): from the map there's no Back, only ✕
  open(card, { at = null, beside = null, from = 'map' } = {}) {
    if (!this.stack.length) {
      const a = document.activeElement;
      this.focusBack = a && a !== document.body ? a : null;
      this.saved = this.keepState();
    }
    this.folded = null;
    const entry = { card, at, beside, from };
    // from the card open now: Back goes back to it; else a card of its own, and the ones before it go (their history too)
    if (from && typeof from === 'object' && this.stack.some((e) => e.card === from)) this.stack.push(entry);
    else this.stack = [entry];
    this.syncHistory();
    this.render({ fresh: true });
  }

  // Back, Escape: one card back; from the first, closed. With steps in history, the browser's (its popstate does it)
  back() {
    if (!this.stack.length) return;
    if (this.depth > 0 && !this.skip) history.back();
    else { this.stepBack(); this.syncHistory(); }
  }
  stepBack() {
    if (this.folded) { const f = this.folded; this.folded = null; f.cancel(); }
    if (this.stack.length > 1) { this.stack.pop(); this.render({ fresh: true }); return; }
    this.closeNow();
  }

  // restore: false when the planner itself changed (the sheet raised past its peek), so it isn't put back
  close({ restore = true } = {}) {
    if (!this.stack.length && !this.box) return;
    this.closeNow({ restore });
    this.syncHistory();
  }
  closeNow({ restore = true } = {}) {
    const f = this.folded, saved = this.saved;
    this.folded = null;
    this.saved = null;
    this.stack = [];
    this.remove();
    if (f) f.cancel();
    const back = this.focusBack;
    this.focusBack = null;
    if (back && back.isConnected && document.activeElement && (document.activeElement === document.body || !document.activeElement.isConnected)) back.focus({ preventScroll: true });
    this.onChange(null);
    if (restore && saved) this.restoreState(saved);
  }

  // the open card built again (its point moved, a number came in); closed when what it shows is gone
  refresh() {
    const card = this.current;
    if (!card) return;
    if (card.alive && !card.alive()) { this.close(); return; }
    if (this.folded) return; // (built again when it unfolds)
    // not while you type in it (a name)
    if (this.box && this.box.contains(document.activeElement) && document.activeElement.matches('input:not([type=checkbox]), textarea')) return;
    this.render();
  }

  // The card gives way to a banner under the top bar while the map answers (Move: "Tap where it goes", Cancel);
  // unfold() shows the card again
  fold(text, cancel) {
    this.folded = { text, cancel };
    this.render({ fresh: true });
  }
  unfold() {
    if (!this.folded) return;
    this.folded = null;
    if (this.current) this.render({ fresh: true });
  }

  // Escape: a fold is cancelled, else one card back. True when it did something.
  escape() {
    if (this.folded) { const f = this.folded; this.folded = null; f.cancel(); if (this.current) this.render({ fresh: true }); return true; }
    if (!this.current) return false;
    this.back();
    return true;
  }

  // ------------------------------------------------------------------ drawing
  render({ fresh = false } = {}) {
    const entry = this.stack[this.stack.length - 1];
    if (!entry) return;
    const { card } = entry;
    const at = card.at ? card.at() : entry.at;
    if (this.folded) {
      this.remove();
      this.box = this.bannerBox();
      document.body.append(this.box);
      this.onChange(card);
      if (fresh) this.box.querySelector('[role=status]').focus({ preventScroll: true });
      return;
    }
    if (this.box && this.box.classList.contains('card-banner')) { this.box.remove(); this.box = null; }
    const prev = this.stack[this.stack.length - 2];
    const back = prev ? prev.card.title : { list: 'Route', check: 'Check', row: 'Back', section: 'Route' }[entry.from] || null;
    const box = this.cardBox(card, back);
    const where = entry.beside ? 'float' : this.where();
    if (where === 'peek') {
      if (this.popup) { const p = this.popup; this.popup = null; p.remove(); }
      this.peek.replaceChildren(box);
      this.peek.hidden = false;
    } else {
      this.peek.replaceChildren();
      this.peek.hidden = true;
      if (entry.beside || !at) this.besideAt(box, entry.beside);
      else this.floatAt(box, at, fresh);
    }
    this.box = box;
    this.placePill(card, at, where);
    this.onChange(card);
    if (fresh) {
      const t = box.querySelector('.way-hint');
      if (t) t.focus({ preventScroll: true });
      if (where === 'peek' && at) this.inSight(at);
    }
  }

  // the top row: Back (in words, when there's somewhere to go back to), undo and redo (narrow), ✕; then the thing's
  // own mark and its name with its line. Wide and without Back, ✕ is in the name's row.
  cardBox(card, back) {
    const x = () => h('button', { type: 'button', class: 'tool way-x', 'aria-label': 'Close', title: 'Close (Esc)', onclick: () => this.close(), html: icon('close', 20) });
    const d = this.dock();
    const bar = h('div', { class: 'way-bar' },
      back ? h('button', { type: 'button', class: 'btn small quiet way-back', title: 'Back (Esc)', onclick: () => this.back(), html: icon('chevronLeft', 18) }, h('span', {}, back)) : null,
      d ? h('button', { type: 'button', class: 'tool', 'data-k': 'undo', 'aria-label': 'Undo', disabled: !d.canUndo, onclick: d.undo, html: icon('undo', 20) }) : null,
      d ? h('button', { type: 'button', class: 'tool', 'data-k': 'redo', 'aria-label': 'Redo', disabled: !d.canRedo, onclick: d.redo, html: icon('redo', 20) }) : null,
      x());
    const name = card.title instanceof Node ? card.title : h('b', {}, card.title);
    const head = h('div', { class: 'way-head' },
      h('h3', { class: 'way-hint', tabindex: '-1' }, name, card.sub ? h('small', {}, card.sub) : null),
      card.mark ? h('span', { class: 'card-mark', 'aria-hidden': 'true' }, card.mark()) : null,
      card.save || null,
      x());
    const body = h('div', { class: 'pl-way card', role: 'region', 'aria-label': typeof card.title === 'string' ? card.title : card.label || '' }, bar, head);
    body.dataset.kind = card.kind;
    body.dataset.back = back ? 'yes' : 'no';
    if (!this.byKey) body.dataset.pointer = '';
    card.build(body);
    return body;
  }

  bannerBox() {
    const f = this.folded;
    return h('div', { class: 'card-banner pl-viewnote' },
      h('span', { html: icon('move', 18), 'aria-hidden': 'true' }),
      h('span', { role: 'status', tabindex: '-1' }, f.text),
      h('button', { type: 'button', class: 'btn small', onclick: () => this.escape() }, 'Cancel'));
  }

  // The pill: the card's one action at the spot. On a phone it sits just above the spot, clear of the finger; on a
  // desktop it's the card's first button (1b and 5 give cards one).
  placePill(card, at, where) {
    if (this.pill) { this.pill.remove(); this.pill = null; }
    if (!card.pill || !at) return;
    const p = card.pill;
    if (where !== 'peek') {
      this.box.insertBefore(mainButton(p.label, p.icon, () => p.fn()), this.box.children[2] || null);
      return;
    }
    const el = h('button', { type: 'button', class: 'card-pill', onclick: () => p.fn(), html: icon(p.icon, 20) }, h('span', {}, p.label));
    this.pill = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -22] }).setLngLat(at).addTo(this.map);
  }

  // at the spot: the corner at the point, opening to the left or upwards where there's no room
  floatAt(box, at, fresh) {
    if (!this.popup || this.popup.besideEl) {
      this.remove();
      this.popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: 'none', anchor: 'top-left', className: 'polku-popup card-float',
        offset: { 'top-left': [OFFSET, OFFSET], 'top-right': [-OFFSET, OFFSET], 'bottom-left': [OFFSET, -OFFSET], 'bottom-right': [-OFFSET, -OFFSET] } });
      this.popup.setLngLat(at).setDOMContent(box).addTo(this.map);
      fresh = true;
    } else this.popup.setLngLat(at).setDOMContent(box);
    if (!fresh) return;
    const pt = this.map.project(at), R = this.map.getCanvas().getBoundingClientRect(), x = R.left + pt.x, y = R.top + pt.y;
    const w = box.offsetWidth, ht = box.offsetHeight;
    const right = innerWidth - x - (innerWidth < 720 ? 64 : 84), below = innerHeight - 8 - (this.pad().bottom || 0) - y;
    const anchor = `${below < ht + OFFSET && y - 120 > below ? 'bottom' : 'top'}-${right < w + OFFSET && x - (this.pad().left || 0) > right ? 'right' : 'left'}`;
    if (anchor !== this.popup.options.anchor) { this.popup.options.anchor = anchor; this.popup.setLngLat(at); }
    this.keep();
  }

  // beside a row of the panel (desktops: a card from the list), its top level with the row
  besideAt(box, rect) {
    if (!this.popup || !this.popup.besideEl) {
      this.remove();
      const el = h('div', { class: 'card-float card-beside' });
      this.popup = { besideEl: el, remove: () => el.remove(), getElement: () => el, isOpen: () => el.isConnected };
      document.body.append(el);
    }
    const el = this.popup.besideEl;
    el.replaceChildren(box);
    if (rect) {
      el.style.left = `${Math.round(rect.right + 8)}px`;
      el.style.top = `${Math.round(Math.max(72, Math.min(rect.top, innerHeight - el.offsetHeight - 8)))}px`;
    }
  }

  // clear of the top bar, the map's buttons and the planner
  keep() {
    if (!this.popup || this.popup.besideEl) return;
    const pad = this.pad();
    const el = this.popup.getElement();
    if (el) el.style.setProperty('--card-max', `${Math.max(220, innerHeight - (pad.bottom || 0) - 8 - 120 - 16)}px`);
    keepInView(this.map, this.popup, { left: (pad.left || 0) + 8, bottom: (pad.bottom || 0) + 8 });
  }

  // a card in the peek: the map moves so its spot is in sight above it (and under the top bar)
  inSight(at) {
    let moved = false; // (once you move the map yourself, it's yours)
    const mine = (e) => { if (e.originalEvent) moved = true; };
    this.map.on('movestart', mine);
    setTimeout(() => this.map.off('movestart', mine), 1200);
    const go = () => {
      if (moved || !this.box || !this.box.isConnected || this.popup || this.folded) return;
      const sheet = this.peek.closest('.sheet') || this.peek, R = this.map.getCanvas().getBoundingClientRect();
      const top = (document.querySelector('.topbar')?.getBoundingClientRect().bottom || 56) + 24, wx = document.getElementById('wx-bar');
      // above the sheet, and above the timeline when it's open over the map
      const bottom = Math.min(sheet.getBoundingClientRect().top, wx && wx.offsetParent && !wx.hidden ? wx.getBoundingClientRect().top : Infinity) - 24;
      const pt = this.map.project(at), x = R.left + pt.x, y = R.top + pt.y;
      const dy = y > bottom || y < top ? y - (bottom > top ? (top + bottom) / 2 : top) : 0;
      let dx = x < 24 ? x - 24 : x > innerWidth - 72 ? x - (innerWidth - 72) : 0;
      // …and clear of what floats over the map there: the toolbox's undo and redo, the zoom note, the map's buttons
      const ny = y - dy;
      for (const el of [document.getElementById('pl-tools'), document.getElementById('zoom-hint'), document.getElementById('map-ctrls')]) {
        const b = el && !el.hidden && el.offsetParent ? el.getBoundingClientRect() : null, nx = x - dx;
        if (!b || nx < b.left - 20 || nx > b.right + 20 || ny < b.top - 20 || ny > b.bottom + 20) continue;
        // beside it, on whichever side keeps the point on the screen (none: it stays where it is)
        const side = [b.right + 32, b.left - 32].find((to) => to >= 24 && to <= innerWidth - 72);
        if (side != null) dx = x - side;
      }
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) this.map.panBy([dx, dy], { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250 });
    };
    requestAnimationFrame(() => requestAnimationFrame(go));
    setTimeout(go, 320); // once the sheet has come to its new size
    setTimeout(go, 900); // …and the timeline over the map to its place above it
  }

  remove() {
    if (this.popup) { const p = this.popup; this.popup = null; p.remove(); }
    if (this.pill) { this.pill.remove(); this.pill = null; }
    if (this.box && this.peek.contains(this.box)) { this.peek.replaceChildren(); this.peek.hidden = true; }
    if (this.box && this.box.classList.contains('card-banner')) this.box.remove();
    this.box = null;
  }
}
