// Compass button: the needle always points north (and leans with the tilt).
// Click: north up. Drag the needle sideways to rotate. On a phone, tapping it
// while north is up turns the map to face the way you face (heading up: the
// compass, or the GPS's course while you move, from heading.js); rotating by
// hand or tapping again ends it. While the map follows you (locate.js) it turns
// about your dot, not the middle of the map.

import { h } from './ui.js';
import { hasCompass } from './heading.js';
import { FOLLOW } from './locate.js';

const NEEDLE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2.5 15.6 12H8.4Z" fill="#e5484d"/><path d="M12 21.5 8.4 12h7.2Z" fill="currentColor" opacity=".5"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/></svg>';

export class CompassControl {
  constructor({ toast, heading }) {
    this.toast = toast;
    this.heading = heading;
    this.mode = 'north'; // north | free | heading
    this.pivot = () => null; // where the map turns about: you, while it follows you
    this.onMode = () => {};
  }

  onAdd(map) {
    this.map = map;
    this.btn = h('button', { type: 'button', class: 'compass-btn', html: NEEDLE });
    this.el = h('div', { class: 'maplibregl-ctrl maplibregl-ctrl-group compass-ctrl' }, this.btn);
    this.needle = this.btn.firstChild;
    map.on('rotate', () => this.sync());
    map.on('pitch', () => this.sync());
    // a hand rotation (mouse, touch, trackpad) ends heading-up
    map.on('rotatestart', (e) => { if (e.originalEvent && this.mode === 'heading') this.stopHeading(); });
    this.btn.addEventListener('click', () => this.click());
    this.bindDrag();
    this.sync();
    return this.el;
  }

  onRemove() {
    this.stopHeading();
    this.el.remove();
  }

  sync() {
    const b = this.map.getBearing();
    this.needle.style.transform = `rotateX(${this.map.getPitch() * 0.6}deg) rotate(${-b}deg)`;
    if (this.mode !== 'heading') this.mode = Math.abs(b) < 0.5 ? 'north' : 'free';
    this.btn.classList.toggle('heading', this.mode === 'heading');
    const label = this.mode === 'heading' ? 'The map faces the way you face — tap for north up'
      : this.mode === 'free' ? 'North up (drag to rotate)'
        : hasCompass() ? 'North is up — tap to face the way you face' : 'North is up — drag here or scroll sideways with two fingers to rotate';
    if (label !== this.label) {
      this.label = label;
      this.btn.title = label;
      this.btn.setAttribute('aria-label', label);
    }
    this.onMode(this.mode);
  }

  around() {
    const p = this.pivot();
    return p ? { around: p } : {};
  }

  click() {
    if (this.dragged) { this.dragged = false; return; }
    if (this.mode === 'north' && hasCompass()) { this.startHeading(); return; }
    this.stopHeading();
    this.map.easeTo({ bearing: 0, duration: 400, ...this.around() }, this.pivot() ? FOLLOW : undefined);
  }

  // Heading up. Called from a tap: heading.ask() reaches iOS's permission request before any await.
  async startHeading() {
    const allowed = await this.heading.ask();
    if (allowed !== 'granted' && !this.heading.current()) {
      this.toast('Compass access was declined');
      return;
    }
    if (this.mode === 'heading') return;
    this.mode = 'heading';
    this.seen = false;
    this.heading.need('map', true);
    this.unsub = this.heading.on(() => this.kick());
    this.sync();
    this.kick();
    clearTimeout(this.noneTimer);
    this.noneTimer = setTimeout(() => {
      if (this.mode === 'heading' && !this.seen && !this.heading.current()) { this.stopHeading(); this.toast('No compass reading from this device'); }
    }, 2500);
  }

  stopHeading() {
    clearTimeout(this.noneTimer);
    if (this.unsub) { this.unsub(); this.unsub = null; }
    if (this.heading) this.heading.need('map', false);
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.turning = false;
    if (this.mode === 'heading') { this.mode = 'free'; this.sync(); }
  }

  kick() {
    if (!this.raf && this.mode === 'heading') this.raf = requestAnimationFrame(() => this.step());
  }

  // Ease towards the reading so the map doesn't jitter. A small dead band keeps a hand's
  // tremble from redrawing the map all the time; it waits while a gesture or animation runs.
  step() {
    this.raf = 0;
    const hd = this.mode === 'heading' && this.heading.current();
    if (!hd) return;
    this.seen = true;
    const b = this.map.getBearing();
    const diff = ((hd.deg - b + 540) % 360) - 180;
    if (!this.turning && Math.abs(diff) < 3) return;
    this.turning = Math.abs(diff) > 0.6;
    if (!this.turning) return;
    if (!this.map.isMoving()) this.map.easeTo({ bearing: b + diff * 0.3, duration: 0, ...this.around() }, FOLLOW);
    this.kick();
  }

  // Drag the needle sideways to rotate (MapLibre's compass did this too, but hid it).
  bindDrag() {
    let start = null;
    this.btn.addEventListener('pointerdown', (e) => {
      start = { x: e.clientX, b: this.map.getBearing() };
      this.dragged = false;
      try { this.btn.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    });
    this.btn.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      if (!this.dragged && Math.abs(dx) < 4) return;
      if (!this.dragged) this.stopHeading();
      this.dragged = true;
      this.map.setBearing(start.b + dx * 0.8);
    });
    const end = () => { start = null; };
    this.btn.addEventListener('pointerup', end);
    this.btn.addEventListener('pointercancel', end);
  }
}
