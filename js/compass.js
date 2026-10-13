// Compass button: the needle always points north (and leans with the tilt).
// Click: north up. Drag the needle sideways to rotate. On a phone, tapping it
// while north is up makes the map follow the direction the phone points
// (heading up, from the device compass); rotating by hand or tapping again ends it.

import { h } from './ui.js';

const NEEDLE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2.5 15.6 12H8.4Z" fill="#e5484d"/><path d="M12 21.5 8.4 12h7.2Z" fill="currentColor" opacity=".5"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/></svg>';
const phoneCompass = () => 'DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches;

export class CompassControl {
  constructor({ toast }) {
    this.toast = toast;
    this.mode = 'north'; // north | free | heading
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
    const label = this.mode === 'heading' ? 'Map follows your phone — tap for north up'
      : this.mode === 'free' ? 'North up (drag to rotate)'
        : phoneCompass() ? 'North is up — tap to follow your phone’s direction' : 'North is up — drag here or scroll sideways with two fingers to rotate';
    this.btn.title = label;
    this.btn.setAttribute('aria-label', label);
  }

  click() {
    if (this.dragged) { this.dragged = false; return; }
    if (this.mode === 'north' && phoneCompass()) { this.startHeading(); return; }
    this.stopHeading();
    this.map.easeTo({ bearing: 0, duration: 400 });
  }

  async startHeading() {
    try {
      // iOS asks for permission, and only from a tap
      if (typeof DeviceOrientationEvent.requestPermission === 'function' && (await DeviceOrientationEvent.requestPermission()) !== 'granted') {
        this.toast('Compass access was declined');
        return;
      }
    } catch {
      this.toast('The compass isn’t available here');
      return;
    }
    this.mode = 'heading';
    this.sync();
    let got = false;
    let target = null;
    this.evt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    this.onOrient = (e) => {
      // iOS: webkitCompassHeading (clockwise from north); others: absolute alpha (counter-clockwise)
      let hd = e.webkitCompassHeading != null ? e.webkitCompassHeading : e.absolute && e.alpha != null ? 360 - e.alpha : null;
      if (hd == null) return;
      hd += (screen.orientation && screen.orientation.angle) || 0;
      got = true;
      target = hd;
      if (!this.raf) this.raf = requestAnimationFrame(step);
    };
    // ease towards the reading so the map doesn't jitter
    const step = () => {
      this.raf = 0;
      if (this.mode !== 'heading' || target == null) return;
      const b = this.map.getBearing();
      const diff = ((target - b + 540) % 360) - 180;
      if (Math.abs(diff) < 0.8) return;
      this.map.jumpTo({ bearing: b + diff * 0.3 });
      this.raf = requestAnimationFrame(step);
    };
    window.addEventListener(this.evt, this.onOrient);
    setTimeout(() => {
      if (this.mode === 'heading' && !got) { this.stopHeading(); this.toast('No compass reading from this device'); }
    }, 2500);
  }

  stopHeading() {
    if (this.onOrient) window.removeEventListener(this.evt, this.onOrient);
    this.onOrient = null;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.mode === 'heading') { this.mode = 'free'; this.sync(); }
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
