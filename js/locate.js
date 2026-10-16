// Where you are: the location dot, its accuracy circle and a cone for the way you
// face, and Follow me.
//
// Locate goes off → following you (the map keeps you in view, north stays up) →
// facing ahead (the map turns with you, where there's a compass or a GPS course) → off.
// A pan, or anything else that takes the map away from you, stops following; the
// button then reads Follow, one tap back. Zooming and turning the map keep it.
//
// Polku watches the GPS itself (not MapLibre's geolocate control), so it can stop
// while the page is hidden. Your position stays in this page's memory: nothing
// stores or sends it. While it's on, main.js doesn't keep the map's view either, and
// the moves made for you are flagged (FOLLOW).

import { h } from './ui.js';

export const FOLLOW = { polkuFollow: true }; // event data on the map moves made to follow you
const STALE = 60e3; // ms without a fix: the dot greys out
const R = Math.PI / 180;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const CROSSHAIR = '<svg class="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
const AHEAD = '<svg class="ic" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 18.5 20 12 16.2 5.5 20Z"/></svg>';
const LABELS = {
  off: 'Show my location',
  waiting: 'Finding where you are… (tap to stop)',
  follow: 'Following you, north up — tap to face ahead',
  followOnly: 'Following you — tap to stop showing your location',
  ahead: 'Following you, facing ahead — tap to stop showing your location',
  free: 'Follow me: back to where you are',
};

export class Locate {
  constructor(map, { button, heading, compass, toast, room = () => null, onFix = () => {} }) {
    this.map = map;
    this.btn = button;
    this.heading = heading;
    this.compass = compass;
    this.toast = toast;
    this.room = room; // the map's free area while a panel covers part of it (padding), or null
    this.onFix = onFix;
    this.on = false;
    this.follow = false;
    this.fix = null; // { ll, acc, t }: the latest, in memory only
    this.shown = null; // where the dot is drawn: it glides to each new fix
    this.watchId = null;
    this.raf = 0;

    this.accEl = h('div', { class: 'you-acc', 'aria-hidden': 'true' });
    this.coneEl = h('div', { class: 'you-cone', 'aria-hidden': 'true', html: '<svg viewBox="-60 -60 120 120" width="120" height="120"><defs><radialGradient id="you-cone-fill" cx="0" cy="0" r="56" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="currentColor" stop-opacity=".85"/><stop offset=".45" stop-color="currentColor" stop-opacity=".5"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs><path fill="url(#you-cone-fill)"/></svg>' });
    this.dotEl = h('div', { class: 'you-dot', 'aria-hidden': 'true' });
    // the circle and the cone lie on the ground (they turn and tilt with the map); the dot faces you
    this.acc = new maplibregl.Marker({ element: this.accEl, pitchAlignment: 'map', rotationAlignment: 'map' });
    this.cone = new maplibregl.Marker({ element: this.coneEl, pitchAlignment: 'map', rotationAlignment: 'map' });
    this.dot = new maplibregl.Marker({ element: this.dotEl });
    this.coneEl.hidden = true;

    compass.pivot = () => (this.follow && this.shown ? this.shown : null);
    compass.onMode = () => this.sync();
    heading.on((hd) => this.showHeading(hd));
    button.addEventListener('click', () => this.click());

    // a pan stops following (a pinch's own drift doesn't)
    map.on('dragstart', (e) => {
      const t = e.originalEvent && e.originalEvent.touches;
      if (this.follow && !(t && t.length > 1)) this.setFollow(false);
    });
    // so does any other move that takes the map somewhere else (a fit to the route, a search);
    // a zoom or a turn about the middle keeps it, and the dot is brought back. (By movestart
    // a jump has already happened, so the middle is kept from the end of the move before.)
    this.lastCenter = map.getCenter();
    map.on('moveend', (e) => {
      const from = this.lastCenter;
      this.lastCenter = map.getCenter();
      if (e.polkuFollow || !this.follow || !this.shown) return;
      const byHand = e.originalEvent && e.originalEvent.type !== 'keydown';
      if (!byHand && from && map.project(from).dist(map.project(map.getCenter())) > 40) { this.setFollow(false); return; }
      this.kick();
    });
    map.on('zoom', () => this.sizeAccuracy());
    map.on('resize', () => this.kick());
    // nothing runs while the page is hidden: no GPS, no frames; back, it starts again
    document.addEventListener('visibilitychange', () => {
      if (!this.on) return;
      if (document.hidden) {
        this.unwatch();
        cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.tPrev = 0;
        clearTimeout(this.staleTimer);
      } else {
        this.watch();
        this.markStale();
      }
    });
    this.sync();
  }

  // off | waiting | follow | ahead | free
  state() {
    if (!this.on) return 'off';
    if (!this.fix) return 'waiting';
    if (!this.follow) return 'free';
    return this.compass.mode === 'heading' ? 'ahead' : 'follow';
  }

  following() { return this.on && this.follow; }

  click() {
    const st = this.state();
    if (st === 'off') {
      this.heading.ask(); // iOS: the compass may only be asked for from a tap
      this.start();
    } else if (st === 'free') this.setFollow(true);
    else if (st === 'follow' && this.heading.possible()) this.compass.startHeading();
    else this.stop();
  }

  // quiet: not asked for by a tap (a first visit), so a refusal or a slow GPS says nothing
  start({ quiet = false } = {}) {
    if (!navigator.geolocation || !window.isSecureContext) {
      if (quiet) return;
      this.toast(window.isSecureContext ? 'This browser can’t tell where you are' : 'Your location needs a secure (https) connection');
      return;
    }
    this.on = true;
    this.follow = true;
    this.fix = null;
    this.shown = null;
    this.toldSlow = quiet;
    this.quiet = quiet;
    this.heading.need('dot', true);
    this.watch();
    clearTimeout(this.slowTimer);
    this.slowTimer = setTimeout(() => this.slow(), 15000);
    this.sync();
  }

  stop() {
    const ahead = this.state() === 'ahead';
    this.on = false;
    this.follow = false;
    this.unwatch();
    this.fix = null;
    this.shown = null;
    this.heading.need('dot', false);
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    clearTimeout(this.slowTimer);
    clearTimeout(this.staleTimer);
    for (const m of [this.acc, this.cone, this.dot]) m.remove();
    this.placed = false;
    if (ahead) {
      this.compass.stopHeading();
      this.map.easeTo({ bearing: 0, duration: 400 }, FOLLOW); // still around where you are: not kept as the view
    }
    this.sync();
  }

  watch() {
    if (this.watchId != null || document.hidden) return;
    this.watchId = navigator.geolocation.watchPosition((p) => this.got(p), (e) => this.failed(e), { enableHighAccuracy: true, maximumAge: 1000 });
  }

  unwatch() {
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }

  got(p) {
    if (!this.on) return;
    const c = p.coords, ll = [c.longitude, c.latitude], first = !this.fix;
    this.fix = { ll, acc: c.accuracy || 0, t: Date.now() };
    this.heading.fix(c, this.fix.t);
    this.onFix(ll);
    clearTimeout(this.slowTimer);
    this.markStale();
    // the first fix, one after a pause, or a jump: no gliding across the map
    if (!this.shown || this.map.project(this.shown).dist(this.map.project(ll)) > 200) this.shown = ll;
    this.place();
    if (first) {
      if (this.follow) this.goTo(true);
      this.sync();
    }
    this.kick();
  }

  failed(e) {
    if (!this.on) return;
    if (e.code === 1) {
      if (!this.quiet) this.toast('Polku isn’t allowed to see where you are. Allow location for this site in the browser’s settings.');
      this.stop();
      return;
    }
    if (!this.fix) this.slow();
  }

  slow() {
    if (!this.on || this.fix || this.toldSlow) return;
    this.toldSlow = true;
    this.toast('Still looking for where you are…');
  }

  // A dot with no newer position for a minute says so: grey, and Locate's label.
  markStale() {
    clearTimeout(this.staleTimer);
    if (!this.fix) return;
    const age = Date.now() - this.fix.t;
    this.stale = age >= STALE;
    this.dotEl.classList.toggle('stale', this.stale);
    if (!this.stale && !document.hidden) this.staleTimer = setTimeout(() => this.markStale(), STALE - age + 50);
    this.sync();
  }

  setFollow(on) {
    if (this.follow === on) return;
    this.follow = on;
    if (on && this.shown) this.goTo(false);
    this.sync();
  }

  // Where the dot sits while following: the middle of the map that no panel covers.
  followPoint() {
    const el = this.map.getContainer(), w = el.clientWidth, ht = el.clientHeight, p = this.room();
    return p ? [(p.left + w - p.right) / 2, (p.top + ht - p.bottom) / 2] : [w / 2, ht / 2];
  }

  // To you (and, the first time, close enough to see where you are, the accuracy circle in view).
  goTo(zoomIn) {
    const m = this.map, [fx, fy] = this.followPoint(), c = m.project(m.getCenter());
    let zoom = m.getZoom();
    if (zoomIn) {
      const el = m.getContainer(), side = 0.4 * Math.min(el.clientWidth, el.clientHeight);
      const fits = Math.log2((40075016.686 * Math.cos(this.shown[1] * R) * side) / (512 * Math.max(5, this.fix.acc)));
      zoom = Math.min(Math.max(zoom, 15), fits);
    }
    m.easeTo({ center: this.shown, zoom, offset: [fx - c.x, fy - c.y], duration: reduced() ? 0 : 700 }, FOLLOW);
  }

  kick() {
    if (!this.raf && this.on && !document.hidden) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  // One frame: the dot glides towards the latest fix, and while following, the map keeps it
  // in place. Runs only until both have arrived (and never during a gesture or an animation).
  frame(now) {
    this.raf = 0;
    if (!this.on || !this.fix || !this.shown) return;
    const m = this.map, fast = reduced(), dt = Math.min(100, now - (this.tPrev || now - 16));
    this.tPrev = now;
    let busy = false;
    const to = this.fix.ll;
    if (!fast && m.project(this.shown).dist(m.project(to)) > 0.3) {
      const k = 1 - Math.exp(-dt / 250);
      this.shown = [this.shown[0] + (to[0] - this.shown[0]) * k, this.shown[1] + (to[1] - this.shown[1]) * k];
      busy = true;
    } else this.shown = to;
    this.place();
    if (this.follow && !m.isMoving()) {
      const [fx, fy] = this.followPoint(), p = m.project(this.shown), dx = p.x - fx, dy = p.y - fy, d = Math.hypot(dx, dy);
      if (d > 0.5) {
        const k = fast || d < 2 ? 1 : 1 - Math.exp(-dt / 150), c = m.project(m.getCenter());
        m.jumpTo({ center: m.unproject([c.x + dx * k, c.y + dy * k]) }, FOLLOW);
        busy = busy || k < 1;
      }
    } else if (this.follow) busy = true; // wait for the gesture or animation to end
    if (busy) this.kick();
    else this.tPrev = 0;
  }

  place() {
    if (!this.placed) {
      for (const m of [this.acc, this.cone, this.dot]) m.setLngLat(this.shown).addTo(this.map);
      this.placed = true;
      this.showHeading(this.heading.current());
    }
    for (const m of [this.acc, this.cone, this.dot]) m.setLngLat(this.shown);
    this.sizeAccuracy();
  }

  sizeAccuracy() {
    if (!this.fix || !this.shown) return;
    const mpp = (40075016.686 * Math.cos(this.shown[1] * R)) / (512 * 2 ** this.map.getZoom());
    const d = Math.round((2 * this.fix.acc) / mpp);
    if (d === this.accPx) return;
    this.accPx = d;
    this.accEl.style.width = this.accEl.style.height = `${d}px`;
    this.accEl.hidden = d < 28;
  }

  // The cone: its direction, and how sure it is (narrow on a GPS course, wider on a compass).
  showHeading(hd) {
    if (!this.placed) return;
    this.coneEl.hidden = !hd;
    if (!hd) return;
    this.cone.setRotation(hd.deg);
    this.coneEl.dataset.source = hd.source;
    if (hd.spread !== this.spread) {
      this.spread = hd.spread;
      const s = hd.spread * R, x = (56 * Math.sin(s)).toFixed(1), y = (-56 * Math.cos(s)).toFixed(1);
      this.coneEl.querySelector('path').setAttribute('d', `M0 0L${-x} ${y}A56 56 0 0 1 ${x} ${y}Z`);
    }
  }

  sync() {
    const st = this.state();
    const key = st === 'follow' && !this.heading.possible() ? 'followOnly' : st;
    const old = !!(this.on && this.fix && this.stale);
    if (key + old === this.shownKey) return;
    this.shownKey = key + old;
    const b = this.btn, label = LABELS[key] + (old ? ' (no newer position for a minute: the grey dot is where you were)' : '');
    b.dataset.state = st;
    b.setAttribute('aria-pressed', String(st === 'follow' || st === 'ahead'));
    b.title = label;
    b.setAttribute('aria-label', label);
    b.innerHTML = (st === 'ahead' ? AHEAD : CROSSHAIR) + (st === 'free' ? '<span class="locate-label">Follow</span>' : '');
  }
}
