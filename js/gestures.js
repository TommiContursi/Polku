// Map gestures beyond MapLibre's defaults.
//
// 1. Zoom over the floating UI. Panels, the planner sheet and the buttons sit
//    on top of the map, so wheel and pinch events over them never reach
//    MapLibre; a trackpad pinch (ctrl+wheel in Chromium/Firefox, gesture*
//    events in Safari) or a touch pinch would zoom the whole page instead. We
//    never let the page zoom and hand those gestures to the map, unless a
//    panel is actually scrolling.
// 2. Trackpad tilt & rotate. A sideways two-finger scroll on a trackpad
//    rotates; in 3D mode up/down tilts too, while pinch keeps zooming.
//    Shift + two-finger scroll tilts in any mode; Safari's rotate gesture
//    rotates. A real mouse wheel always zooms.

const OVERLAY = '.topbar, .activity-bar, .fab-col, .plan-btn, .panel, .sheet, .zoom-hint, .track-card, .toast, .view3d, .wx-bar, .maplibregl-ctrl';

function scrollableAncestor(el, root, dy) {
  for (let n = el; n && n !== root.parentElement; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (!/(auto|scroll)/.test(s.overflowY) || n.scrollHeight <= n.clientHeight + 1) continue;
    if (dy < 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1) return n;
  }
  return null;
}

// Same idea as MapLibre's own wheel/trackpad detection: mouse wheels report
// big or line-based steps (multiples of 4.000244 in Chrome on macOS).
function looksLikeTrackpad(e) {
  if (e.deltaMode !== 0) return false;
  if (e.deltaX !== 0) return true;
  const d = Math.abs(e.deltaY);
  if (!d) return false;
  if (d % 4.000244140625 === 0 || d >= 100) return false;
  return true;
}

export function initGestures(map, { trackpadTilt = () => false, trackpadRotate = () => false } = {}) {
  const canvas = map.getCanvas();
  let lastCtrlWheel = 0;
  let tiltUntil = 0;
  let turnUntil = 0;

  window.addEventListener('wheel', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (e.ctrlKey) lastCtrlWheel = performance.now();

    if (t === canvas) {
      // trackpad tilt / rotate on the map itself
      const now = performance.now();
      const pad = looksLikeTrackpad(e);
      const tilt = !e.ctrlKey && (e.shiftKey || (trackpadTilt() && (pad || now < tiltUntil)));
      // 2D: a mostly sideways two-finger scroll rotates; up/down keeps zooming
      if (!tilt && !e.ctrlKey && trackpadRotate() && pad && (now < turnUntil || Math.abs(e.deltaX) > 2 * Math.abs(e.deltaY) + 1)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        turnUntil = now + 250;
        map.jumpTo({ bearing: map.getBearing() + e.deltaX * 0.3 });
        return;
      }
      if (!tilt) return; // MapLibre zooms
      e.preventDefault();
      e.stopImmediatePropagation();
      tiltUntil = now + 250; // keep momentum scrolling in tilt mode
      const scale = e.deltaMode === 1 ? 16 : 1;
      let dy = e.deltaY * scale, dx = e.deltaX * scale;
      if (e.shiftKey && !dx && !dy) dy = e.deltaX; // some browsers turn shift+scroll sideways
      map.jumpTo({
        pitch: Math.max(0, Math.min(map.getMaxPitch(), map.getPitch() - dy * 0.25)),
        bearing: map.getBearing() + dx * 0.3,
      });
      return;
    }

    const overlay = t && t.closest(OVERLAY);
    if (!overlay) {
      if (e.ctrlKey && t && !map.getCanvasContainer().contains(t)) e.preventDefault(); // never zoom the page
      return;
    }
    // A plain wheel over a panel that can still scroll scrolls the panel.
    if (!e.ctrlKey && scrollableAncestor(t, overlay, e.deltaY)) return;
    e.preventDefault();
    canvas.dispatchEvent(new WheelEvent('wheel', {
      deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ, deltaMode: e.deltaMode,
      clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY,
      ctrlKey: e.ctrlKey, shiftKey: false, altKey: e.altKey, metaKey: e.metaKey,
      bubbles: true, cancelable: true,
    }));
  }, { passive: false, capture: true });

  // Safari trackpad: pinch and rotate arrive as gesture events. Pinch zooms
  // (unless the browser already sent ctrl+wheel), rotate turns the map.
  let g0 = null;
  document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
    g0 = { z: map.getZoom(), b: map.getBearing() };
  }, { passive: false });
  document.addEventListener('gesturechange', (e) => {
    e.preventDefault();
    if (!g0) return;
    const opts = {};
    if (performance.now() - lastCtrlWheel > 300 && e.scale > 0) opts.zoom = g0.z + Math.log2(e.scale);
    if (Math.abs(e.rotation) > 2) opts.bearing = g0.b - e.rotation;
    map.jumpTo(opts);
  }, { passive: false });
  document.addEventListener('gestureend', (e) => { e.preventDefault(); g0 = null; }, { passive: false });

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
