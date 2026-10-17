// One swipe for every sheet (#96, #123): the planner's sheet and the quick layer drawer use it.
//
// - A drag starts from wherever the sheet allows (grab()), after SWIPE.start px of mostly vertical
//   movement; a tap stays a tap. A drag that starts on a button is a drag: the sheet takes the pointer,
//   so the button isn't pressed. A second finger is ignored.
// - In a scrolling body it starts only where the body can't scroll that way itself: down at its top,
//   or up when there's nothing left to scroll. iOS has no `touch-action: pan-down`, so a touchmove
//   listener that isn't passive keeps the browser from scrolling once the sheet has the gesture.
// - The sheet follows the finger 1:1 with transform (the caller changes its real size once, at the
//   end); past its first or last size it resists (rubber band) instead of stopping dead.
// - On release it aims for where a flick would come to rest (Apple's projection) and goes to the
//   size nearest that; a quick flick moves at least one size in its direction.
// - It settles with a spring that starts at the finger's speed, and can be grabbed again mid-way.
// - Reduced motion: the sheet still follows the finger, but sizes change without travel.

// The swipe's numbers, all in one place. Starting values from #123's plan, to tune on real phones
// (iOS and Android): its "On real phones" list, and the mock-up's Swipe numbers panel.
export const SWIPE = {
  start: 10, // px the finger moves before the sheet follows
  flick: 1.1, // px/ms: a release at least this fast is a flick
  decel: 0.998, // deceleration per ms, for where a flick would come to rest
  closeAt: 0.4, // a sheet that closes by a swipe does so past this share of its height
  damping: 0.85, // the spring's damping ratio (1: no bounce)
  response: 0.3, // the spring's response, s
  rubber: 0.55, // resistance past the first and last size
  peekCloses: false, // #96: a swipe down from the planner's peek closes it (Done does today)
};

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const rubber = (over, dim) => (over * dim * SWIPE.rubber) / (dim + SWIPE.rubber * Math.abs(over));
// where a release at v px/ms comes to rest, px from where it is
export const project = (v) => (v * SWIPE.decel) / (1 - SWIPE.decel);

// The height of 100dvh in px: the sheets' sizes are in dvh, and innerHeight isn't dvh on iOS.
let probe = null;
export function dvh() {
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100vh;height:100dvh;visibility:hidden;pointer-events:none';
    document.body.append(probe);
  }
  return probe.offsetHeight || innerHeight;
}

// What owns its own drag, so it's never the sheet's: a slider; a text field you're typing in, or any with a
// mouse (it selects text). A touch on a field that isn't being edited moves the sheet like the rest.
const own = (t, type) => !!t.closest('input[type=range], [contenteditable=""], [contenteditable=true]')
  || (t.matches('input, textarea') && !/^(checkbox|radio|button|submit)$/.test(t.type) && (type === 'mouse' || t === document.activeElement));

/**
 * Makes `el` follow a swipe. All sizes are visible heights in px, from the sheet's bottom.
 *  enabled()          whether the swipe is on now (a phone layout, the sheet open)
 *  grab(target, type) whether a drag may start at target ('mouse', 'touch' or 'pen'); default: anywhere
 *  start()            a drag begins: the caller gets the sheet ready and returns
 *                     { H: its height during the drag, now: the visible height now, from: the size it's at,
 *                       sizes: [{ name, at, rest }] lowest first (rest: where it settles, if not at),
 *                       min, max: the range it moves freely (rubber band outside) }
 *  pick(aim, ride)    optional: the size for a release that would come to rest at aim; default the nearest
 *  aim(name, ride)    optional: on release, before the spring (a view that changes at once)
 *  end(name, ride)    it has come to rest at that size; the transform is cleared just before
 *  cancel(ride)       stopped from outside (stop()), mid-way
 * Returns { stop(), busy }.
 */
export function swipeSheet(el, o) {
  let g = null; // the finger: { id, x0, y0, on, claim, body, base, hist }
  let ride = null; // the sheet while it moves: start()'s answer, and v (its visible height now)
  let raf = 0;
  let quietUntil = 0; // the click that may follow a drag isn't a tap

  const place = (v) => { ride.v = v; el.style.transform = `translateY(${ride.H - v}px)`; };
  const scroller = (t) => {
    for (let n = t; n && n !== el; n = n.parentElement) {
      if (n.scrollHeight > n.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(n).overflowY)) return n;
    }
    return null;
  };
  const track = (e) => { g.hist.push([e.timeStamp, e.clientY]); if (g.hist.length > 24) g.hist.shift(); };
  // px/ms, + up (the sheet grows), over the last 100 ms: a finger that stopped before it let go has none
  const speed = (t) => {
    const h = g.hist.filter(([ts]) => t - ts <= 100);
    if (h.length < 2) return 0;
    const [t0, y0] = h[0], [t1, y1] = h[h.length - 1];
    return t1 > t0 ? -(y1 - y0) / (t1 - t0) : 0;
  };
  const begin = () => {
    ride = { ...o.start() };
    ride.v = ride.now;
    place(ride.now);
  };

  el.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || e.button > 0) return; // a second finger is ignored
    quietUntil = 0;
    if (ride && raf) { // grabbed while it settles: it stops under the finger
      cancelAnimationFrame(raf);
      raf = 0;
      g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, on: true, claim: true, base: ride.v, hist: [[e.timeStamp, e.clientY]] };
      try { el.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ }
      return;
    }
    if (!o.enabled() || own(e.target, e.pointerType) || (o.grab && !o.grab(e.target, e.pointerType))) return;
    const body = scroller(e.target);
    if (body && e.pointerType === 'mouse') return; // a mouse scrolls the body with its wheel
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, claim: false, body, hist: [[e.timeStamp, e.clientY]] };
  });

  el.addEventListener('pointermove', (e) => {
    if (!g || e.pointerId !== g.id) return;
    track(e);
    const dy = e.clientY - g.y0, dx = e.clientX - g.x0;
    if (!g.on) {
      if (!g.claim) {
        // the first clear move says whose gesture it is: sideways, or a body that can scroll that way, isn't the sheet's
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 3) return;
        const b = g.body;
        if (Math.abs(dx) > Math.abs(dy) || (b && (dy > 0 ? b.scrollTop > 0 : b.scrollTop < b.scrollHeight - b.clientHeight - 1))) { g = null; return; }
        g.claim = true;
      }
      if (Math.abs(dy) < SWIPE.start) return;
      g.on = true;
      begin();
      g.base = ride.v; // from where it was grabbed: the point under the finger stays under it
      try { el.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ }
    }
    const want = g.base - dy;
    place(want > ride.max ? ride.max + rubber(want - ride.max, ride.H) : want < ride.min ? ride.min - rubber(ride.min - want, ride.H) : want);
  });

  const up = (e) => {
    if (!g || e.pointerId !== g.id) return;
    // a touch is captured at first by the element it lands on (a button); when the sheet takes the
    // pointer, that element's lostpointercapture bubbles up here, and must not end the drag
    if (e.type === 'lostpointercapture' && e.target !== el) return;
    const was = g;
    if (e.type === 'pointerup') track(e);
    const v = e.type === 'pointerup' ? speed(e.timeStamp) : 0;
    g = null;
    if (!was.on) return; // a tap stays a tap
    quietUntil = performance.now() + 350;
    release(v);
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  // once the sheet has the gesture, the browser mustn't scroll or zoom with it (iOS: no pan-down)
  el.addEventListener('touchmove', (e) => { if (g && g.claim && e.cancelable) e.preventDefault(); }, { passive: false });
  el.addEventListener('click', (e) => {
    if (performance.now() < quietUntil) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  function release(v) {
    const S = ride.sizes, aim = ride.v + project(v);
    const at = (name) => Math.max(0, S.findIndex((s) => s.name === name));
    let i = o.pick ? at(o.pick(aim, ride)) : S.reduce((b, s, k) => (Math.abs(s.at - aim) < Math.abs(S[b].at - aim) ? k : b), 0);
    const i0 = at(ride.from);
    if (Math.abs(v) >= SWIPE.flick) { // a flick: where it would come to rest, and at least one size its way
      if (v < 0 && i >= i0) i = Math.max(0, i0 - 1);
      if (v > 0 && i <= i0) i = Math.min(S.length - 1, i0 + 1);
    }
    const to = S[i];
    if (o.aim) o.aim(to.name, ride);
    if (ride) settle(to, v); // (unless the change it made stopped the swipe: then it has gone already)
  }

  function settle(to, v0) {
    const target = to.rest ?? to.at;
    const done = () => {
      raf = 0;
      const r = ride;
      ride = null;
      el.style.transform = '';
      o.end(to.name, r);
    };
    if (reduced.matches) { // no travel: the new size fades in
      const moved = Math.abs(ride.v - target) > 1;
      place(target);
      done();
      if (moved && el.animate) el.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' });
      return;
    }
    // a spring with the finger's speed to start with: semi-implicit Euler, four steps a frame
    const k = (2 * Math.PI / SWIPE.response) ** 2, c = (4 * Math.PI * SWIPE.damping) / SWIPE.response;
    let vel = v0 * 1000, last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      let x = ride.v;
      for (let n = 0; n < 4; n++) { vel += (-k * (x - target) - c * vel) * (dt / 4); x += vel * (dt / 4); }
      place(x);
      if (Math.abs(x - target) < 0.5 && Math.abs(vel) < 8) { place(target); done(); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  return {
    // stop a drag or a spring from outside (the sheet changed size or closed some other way)
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (g && g.on) { try { el.releasePointerCapture(g.id); } catch { /* gone */ } }
      g = null;
      if (!ride) return;
      const r = ride;
      ride = null;
      el.style.transform = '';
      if (o.cancel) o.cancel(r);
    },
    get busy() { return !!ride; },
  };
}
