// Which way you face: the phone's compass while you stand, the GPS's own course
// while you move (above about 1 m/s, where a compass in a pocket is unreliable).
// The location dot's cone and the map's facing-ahead mode both read it.
//
// The compass is listened to only while something shows it and the page is
// visible. Readings stay in this page's memory: nothing is stored or sent.

import { dist, bearing } from './geo.js';

const MOVING = 1; // m/s: above this the GPS course wins
const STILL = 0.7; // m/s: below this the compass takes over again
const COMPASS_STALE = 3000; // ms without a reading: no compass
const COURSE_STALE = 6000; // ms after its fix: no course
const COURSE_STEP = 8; // m: a course worked out from fixes needs this much way

// A device with a compass the browser can read (phones and tablets).
export const hasCompass = () => typeof DeviceOrientationEvent !== 'undefined' && matchMedia('(pointer: coarse)').matches;

const screenAngle = () => (screen.orientation && screen.orientation.angle) || window.orientation || 0;
const R = Math.PI / 180;

// Degrees clockwise from north that the top of the screen faces, from one event; null if it
// doesn't say. iOS works it out itself; elsewhere, from an absolute alpha, beta and gamma:
// the screen's up over the ground (lost when the phone stands upright) plus the way its back
// looks (lost when it lies flat), so any way you hold it gives a heading.
export function compassOf(e) {
  if (e.webkitCompassHeading != null && e.webkitCompassHeading >= 0) {
    return { deg: (e.webkitCompassHeading + screenAngle() + 360) % 360, acc: e.webkitCompassAccuracy >= 0 ? e.webkitCompassAccuracy : null };
  }
  if (!e.absolute || e.alpha == null) return null;
  const a = e.alpha * R, b = (e.beta || 0) * R, g = (e.gamma || 0) * R, t = screenAngle() * R;
  const X = Math.sin(t) * Math.cos(g), Y = Math.cos(t) * Math.cos(b) + Math.sin(t) * Math.sin(g) * Math.sin(b);
  const east = X * Math.cos(a) - Y * Math.sin(a) - Math.sin(g) * Math.cos(a) - Math.cos(g) * Math.sin(b) * Math.sin(a);
  const north = X * Math.sin(a) + Y * Math.cos(a) - Math.sin(g) * Math.sin(a) + Math.cos(g) * Math.sin(b) * Math.cos(a);
  if (Math.hypot(east, north) < 0.2) return null;
  return { deg: (Math.atan2(east, north) / R + 360) % 360, acc: null };
}

export class Heading {
  constructor() {
    this.users = new Set(); // what needs the compass now ('dot', 'map')
    this.subs = new Set();
    this.compass = null; // { x, y (smoothed unit vector), acc, t }
    this.course = null; // { deg, t }
    this.moving = false;
    this.anchor = null; // a fix at least COURSE_STEP back, for a course worked out by hand
    this.permission = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function' ? 'ask' : 'granted';
    this.evt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    this.onOrient = (e) => this.reading(e);
    this.listening = false;
    this.last = null;
    document.addEventListener('visibilitychange', () => this.listen());
  }

  // iOS asks before a page may read the compass, and only from a tap: call this from the
  // tap's own handler, before anything awaits. Resolves to 'granted' or 'denied'.
  ask() {
    if (this.permission !== 'ask') return Promise.resolve(this.permission);
    let p;
    try { p = DeviceOrientationEvent.requestPermission(); } catch { p = Promise.resolve('denied'); }
    this.permission = 'asking';
    return Promise.resolve(p).catch(() => 'denied').then((r) => {
      this.permission = r === 'granted' ? 'granted' : 'denied';
      this.listen();
      return this.permission;
    });
  }

  need(who, on) {
    if (on) this.users.add(who); else this.users.delete(who);
    this.listen();
  }

  // Only while something shows it, the page is visible and the browser allows it.
  listen() {
    const want = this.users.size > 0 && !document.hidden && this.permission !== 'denied';
    if (want === this.listening) return;
    this.listening = want;
    if (want) window.addEventListener(this.evt, this.onOrient);
    else { window.removeEventListener(this.evt, this.onOrient); this.compass = null; this.changed(); }
  }

  reading(e) {
    const r = compassOf(e);
    if (!r) return;
    const x = Math.sin(r.deg * R), y = Math.cos(r.deg * R), now = Date.now();
    // a light smoothing (the sensor's own jitter), quicker after a pause
    const c = this.compass && now - this.compass.t < 500 ? this.compass : null;
    const k = c ? 0.3 : 1;
    this.compass = { x: c ? c.x + (x - c.x) * k : x, y: c ? c.y + (y - c.y) * k : y, acc: r.acc, t: now };
    clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => this.changed(), COMPASS_STALE + 50);
    this.changed();
  }

  // Every GPS fix: its course and speed, or both worked out from the way covered.
  fix(coords, t = Date.now()) {
    const here = [coords.longitude, coords.latitude];
    let speed = Number.isFinite(coords.speed) ? coords.speed : null;
    let course = Number.isFinite(coords.heading) && coords.heading >= 0 ? coords.heading : null;
    const a = this.anchor;
    if (!a || t - a.t > 30e3) this.anchor = { ll: here, t };
    else {
      const d = dist(a.ll, here);
      if (d >= Math.max(COURSE_STEP, (coords.accuracy || 0) / 2)) {
        if (speed == null) speed = d / Math.max(1, (t - a.t) / 1000);
        if (course == null) course = bearing(a.ll, here);
        this.anchor = { ll: here, t };
      } else if (speed == null && t - a.t > 5000) speed = d / ((t - a.t) / 1000);
    }
    if (speed != null) this.moving = speed > (this.moving ? STILL : MOVING);
    if (this.moving && course != null) this.course = { deg: course, t };
    else if (!this.moving) this.course = null;
    clearTimeout(this.courseTimer);
    this.courseTimer = setTimeout(() => this.changed(), COURSE_STALE + 50);
    this.changed();
  }

  // { deg, source: 'course' | 'compass', spread } or null when nothing knows.
  current() {
    const now = Date.now();
    if (this.moving && this.course && now - this.course.t < COURSE_STALE) return { deg: this.course.deg, source: 'course', spread: 22 };
    const c = this.compass;
    if (c && now - c.t < COMPASS_STALE) {
      return { deg: (Math.atan2(c.x, c.y) / R + 360) % 360, source: 'compass', spread: Math.min(45, Math.max(20, c.acc || 28)) };
    }
    return null;
  }

  // Whether facing ahead can work here: a compass, or a course seen already.
  possible() { return hasCompass() || !!this.current(); }

  on(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }

  // at most once a frame, and only when it moved by a degree or changed source
  changed() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const h = this.current(), l = this.last;
      if (!h && !l) return;
      if (h && l && h.source === l.source && Math.abs(((h.deg - l.deg + 540) % 360) - 180) < 1 && Math.abs(h.spread - l.spread) < 3) return;
      this.last = h;
      for (const fn of this.subs) fn(h);
    });
  }
}
