// One card at a time for what's on the map (25d, #345): a point, and in later parts a stretch, a warning, a spot.
// Phones with the planner open show it in the planner's peek, at the thumb; elsewhere it floats at its spot, its
// corner at the point, opening the other way near an edge. Opening a card is a step of history, so the phone's
// back gesture, Back and Escape go back one card, and from the first one close it. The focus goes to the card's
// title, and back where it was when the card closes.
import { icon, h } from './ui.js';
import { keepInView } from './inspect.js';

// a number with what it is under it ("10:09", "there at"); a missing one is dashed and says so
export function num(value, label, { missing = false } = {}) {
  return h('span', { class: `card-num${missing ? ' missing' : ''}` }, h('b', {}, value), h('small', {}, label));
}

const OFFSET = 14; // the float's corner from its spot, so the point stays in sight beside it

export class CardHost {
  // peek: where a phone's card goes; where(): 'peek' or 'float' now; onChange(card | null) after it changes.
  // onPop: a step of history went back (the map stays where it is); pad(): the room the planner takes { left, bottom }
  constructor(map, { peek, where, onChange = () => {}, onPop = () => {}, pad = () => ({}) }) {
    this.map = map;
    this.peek = peek;
    this.where = where;
    this.onChange = onChange;
    this.onPop = onPop;
    this.pad = pad;
    this.stack = []; // [{ card, at, beside, from }], the open one last
    this.depth = 0; // steps of history the cards pushed
    this.skip = 0; // steps back of our own still to come (history.go() is asynchronous)
    this.popup = null;
    this.folded = null;
    this.focusBack = null;
    addEventListener('popstate', () => {
      if (this.skip) { this.skip--; this.onPop(); this.syncHistory(); return; }
      if (!this.depth) return;
      this.depth--;
      this.onPop();
      this.stepBack();
    });
  }

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

  get current() { return this.stack.length ? this.stack[this.stack.length - 1].card : null; }
  get place() { return this.box ? (this.popup ? 'float' : 'peek') : null; }

  // `from`: the card it came from (Back goes back to it), or the place it was opened from ('map', 'list', 'check', 'row',
  // 'section'): from the map there's no Back, only ✕
  open(card, { at = null, beside = null, from = 'map' } = {}) {
    if (!this.stack.length) {
      const a = document.activeElement;
      this.focusBack = a && a !== document.body ? a : null;
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

  close() {
    if (!this.stack.length && !this.box) return;
    this.closeNow();
    this.syncHistory();
  }
  closeNow() {
    const f = this.folded;
    this.folded = null;
    this.stack = [];
    this.remove();
    if (f) f.cancel();
    const back = this.focusBack;
    this.focusBack = null;
    if (back && back.isConnected && document.activeElement && (document.activeElement === document.body || !document.activeElement.isConnected)) back.focus({ preventScroll: true });
    this.onChange(null);
  }

  // the open card built again (its point moved, a number came in); closed when what it shows is gone
  refresh() {
    const card = this.current;
    if (!card) return;
    if (card.alive && !card.alive()) { this.close(); return; }
    // not while you type in it (a name), nor while a list in it is open
    if (this.box && this.box.contains(document.activeElement) && document.activeElement.matches('input:not([type=checkbox]), textarea')) return;
    this.render();
  }

  // the card folds to one line while the map answers (Move: "Tap where it goes"); unfold() shows it again
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
    const back = this.stack.length > 1 || (entry.from && entry.from !== 'map');
    const box = this.folded ? this.foldBox() : this.cardBox(card, back);
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
    this.onChange(card);
    if (fresh) {
      const t = box.querySelector('.card-ttl, .card-fold-text');
      if (t) t.focus({ preventScroll: true });
      if (where === 'peek' && at) this.inSight(at);
    }
  }

  cardBox(card, back) {
    const ttl = h('h3', { class: 'card-ttl', tabindex: '-1' }, h('b', {}, card.title), card.sub ? h('small', {}, card.sub) : null);
    const top = h('div', { class: 'card-top' },
      back ? h('button', { type: 'button', class: 'tool card-back', 'aria-label': 'Back', title: 'Back (Esc)', onclick: () => this.back(), html: icon('chevronLeft', 20) }) : null,
      ttl,
      h('button', { type: 'button', class: 'tool card-x', 'aria-label': 'Close', title: 'Close (Esc)', onclick: () => this.close(), html: icon('close', 20) }));
    const body = h('div', { class: 'card-body' });
    card.build(body);
    return h('section', { class: `card card-${card.kind}`, role: 'region', 'aria-label': card.title }, top, body);
  }

  foldBox() {
    const f = this.folded;
    return h('section', { class: 'card card-fold', role: 'region', 'aria-label': f.text },
      h('span', { class: 'card-fold-text', role: 'status', tabindex: '-1' }, h('span', { 'aria-hidden': 'true', html: icon('move', 18) }), f.text),
      h('button', { type: 'button', class: 'btn', onclick: () => this.escape() }, 'Cancel'));
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
      const el = h('div', { class: 'card-beside polku-popup' });
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
    const go = () => {
      if (!this.box || !this.box.isConnected || this.popup) return;
      const sheet = this.peek.closest('.sheet') || this.peek, R = this.map.getCanvas().getBoundingClientRect();
      const top = (document.querySelector('.topbar')?.getBoundingClientRect().bottom || 56) + 24, bottom = sheet.getBoundingClientRect().top - 24;
      const pt = this.map.project(at), x = R.left + pt.x, y = R.top + pt.y;
      const dy = y > bottom || y < top ? y - (bottom > top ? (top + bottom) / 2 : top) : 0;
      const dx = x < 24 ? x - 24 : x > innerWidth - 72 ? x - (innerWidth - 72) : 0;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) this.map.panBy([dx, dy], { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250 });
    };
    requestAnimationFrame(() => requestAnimationFrame(go));
    setTimeout(go, 320); // once the sheet has come to its new size
  }

  remove() {
    if (this.popup) { const p = this.popup; this.popup = null; p.remove(); }
    if (this.box && this.peek.contains(this.box)) { this.peek.replaceChildren(); this.peek.hidden = true; }
    this.box = null;
  }
}
