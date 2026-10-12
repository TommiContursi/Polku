// Zoom gestures over the floating UI.
//
// Panels, the planner sheet and the buttons sit on top of the map, so wheel and
// pinch events over them never reach MapLibre. A trackpad pinch (ctrl+wheel in
// Chromium/Firefox, gesture* events in Safari) or a touch pinch would then zoom
// the whole page and break the layout. Here we (1) never let the page zoom and
// (2) hand those gestures to the map, unless a panel is actually scrolling.

const OVERLAY = '.topbar, .activity-bar, .fab-col, .panel, .sheet, .zoom-hint, .track-card, .toast, .view3d, .wx-bar, .maplibregl-ctrl';

function scrollableAncestor(el, root, dy) {
  for (let n = el; n && n !== root.parentElement; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (!/(auto|scroll)/.test(s.overflowY) || n.scrollHeight <= n.clientHeight + 1) continue;
    if (dy < 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1) return n;
  }
  return null;
}

export function initGestures(map) {
  const canvas = map.getCanvas();

  window.addEventListener('wheel', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t || canvas === t) return; // MapLibre handles its own canvas
    const overlay = t.closest(OVERLAY);
    if (!overlay) {
      if (e.ctrlKey) e.preventDefault(); // never zoom the page
      return;
    }
    // A plain wheel over a panel that can still scroll scrolls the panel.
    if (!e.ctrlKey && scrollableAncestor(t, overlay, e.deltaY)) return;
    e.preventDefault();
    canvas.dispatchEvent(new WheelEvent('wheel', {
      deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ, deltaMode: e.deltaMode,
      clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY,
      ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey,
      bubbles: true, cancelable: true,
    }));
  }, { passive: false, capture: true });

  // Safari trackpad pinch: gesture events instead of ctrl+wheel.
  let z0 = null;
  document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
    z0 = e.target instanceof Element && e.target.closest(OVERLAY) ? map.getZoom() : null;
  }, { passive: false });
  document.addEventListener('gesturechange', (e) => {
    e.preventDefault();
    if (z0 != null && e.scale > 0) map.setZoom(z0 + Math.log2(e.scale));
  }, { passive: false });
  document.addEventListener('gestureend', (e) => { e.preventDefault(); z0 = null; }, { passive: false });

  // Touch pinch over the UI: block page zoom and zoom the map instead.
  let pinch = null;
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  document.addEventListener('touchstart', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (e.touches.length === 2 && t && t.closest(OVERLAY)) pinch = { d: dist(e.touches), z: map.getZoom() };
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    map.setZoom(pinch.z + Math.log2(dist(e.touches) / pinch.d));
  }, { passive: false });
  document.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = null; }, { passive: true });
}
