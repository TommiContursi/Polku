// On-screen tilt & rotate controls. MapLibre supports right-drag / Ctrl+drag /
// two-finger drag, but those are hard to discover (and awkward on a trackpad),
// so 3D mode gets an orbit pad: drag sideways to rotate, up/down to tilt.

import { h, icon, toast, store } from './ui.js';

export function initView3d(map, root) {
  const pad = h('div', { class: 'orbit', role: 'slider', tabindex: '0', 'aria-label': 'Tilt and rotate: drag, or use the arrow keys', title: 'Drag to tilt and rotate' },
    h('span', { class: 'orbit-dot' }), h('span', { class: 'orbit-label' }, 'Drag'));
  const btn = (name, label, fn) => h('button', { type: 'button', class: 'tool', title: label, 'aria-label': label, onclick: fn, html: icon(name, 18) });
  const ease = (o) => map.easeTo({ duration: 350, ...o });
  root.append(
    pad,
    h('div', { class: 'v3-row' },
      btn('rotL', 'Rotate left', () => ease({ bearing: map.getBearing() - 30 })),
      btn('tiltUp', 'Tilt more', () => ease({ pitch: Math.min(map.getMaxPitch(), map.getPitch() + 15) })),
      btn('tiltDown', 'Tilt less', () => ease({ pitch: Math.max(0, map.getPitch() - 15) })),
      btn('rotR', 'Rotate right', () => ease({ bearing: map.getBearing() + 30 }))),
    btn('compass', 'Reset to north, flat', () => ease({ bearing: 0, pitch: 0, duration: 600 })),
  );

  const dot = pad.firstChild;
  const sync = () => {
    // The dot shows the current view: angle = bearing, distance from centre = pitch.
    const r = (map.getPitch() / map.getMaxPitch()) * 26;
    const a = (map.getBearing() * Math.PI) / 180;
    dot.style.transform = `translate(${Math.sin(a) * r}px, ${-Math.cos(a) * r}px)`;
  };
  map.on('rotate', sync);
  map.on('pitch', sync);
  sync();

  let drag = null;
  pad.addEventListener('pointerdown', (e) => {
    pad.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, b: map.getBearing(), p: map.getPitch() };
    pad.classList.add('active');
  });
  pad.addEventListener('pointermove', (e) => {
    if (!drag) return;
    map.jumpTo({
      bearing: drag.b + (e.clientX - drag.x) * 0.8,
      pitch: Math.max(0, Math.min(map.getMaxPitch(), drag.p - (e.clientY - drag.y) * 0.5)),
    });
  });
  const end = () => { drag = null; pad.classList.remove('active'); };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: [-15, 0], ArrowRight: [15, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] }[e.key];
    if (!k) return;
    e.preventDefault();
    ease({ bearing: map.getBearing() + k[0], pitch: Math.max(0, Math.min(map.getMaxPitch(), map.getPitch() + k[1])) });
  });

  return {
    show(on) {
      root.hidden = !on;
      if (on && !store.get('seen3dHint', false)) {
        store.set('seen3dHint', true);
        toast('Tilt & rotate: drag the pad, right-drag or Ctrl+drag the map, or use two fingers on touch', { ms: 6000 });
      }
    },
  };
}
