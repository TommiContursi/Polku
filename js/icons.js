// Map icons drawn on canvas at runtime (no extra sprite sheet needed).
// Registered lazily through the map's `styleimagemissing` event.

import { LIPAS_TYPES } from './config.js';

const S = 2; // pixel ratio of generated images

// 24×24 pictograms, drawn white on a coloured disc.
const GLYPHS = {
  laavu: 'M12 4 L21 19 H17 L12 10 L7 19 H3 Z',
  hut: 'M12 4 L21 11 V20 H14 V15 H10 V20 H3 V11 Z',
  tent: 'M12 4 L21 20 H14 L12 15 L10 20 H3 Z',
  fire: 'M12 3 C15 8 18 10 18 14.5 C18 18 15.3 21 12 21 C8.7 21 6 18 6 14.5 C6 12 7.5 10.5 9 9.5 C9 12 10 13.5 11.5 14 C11 10 11.5 7 12 3 Z',
  anchor: 'M11 3 H13 V6 H16 V8 H13 V18.5 C15.5 18 17.5 16.4 18.4 14 H16 L19.5 10.5 L23 14 H20.6 C19.4 18 15.9 21 12 21 C8.1 21 4.6 18 3.4 14 H1 L4.5 10.5 L8 14 H5.6 C6.5 16.4 8.5 18 11 18.5 V8 H8 V6 H11 Z',
  tower: 'M9 3 H15 V6 H14 L16.5 21 H14.5 L13.6 15 H10.4 L9.5 21 H7.5 L10 6 H9 Z',
  landing: 'M3 15 C6 13 9 13 12 15 C15 17 18 17 21 15 V18 C18 20 15 20 12 18 C9 16 6 16 3 18 Z M12 3 L16 8 H13 V13 H11 V8 H8 Z',
  info: 'M11 10 H13 V19 H11 Z M12 5 A1.6 1.6 0 1 1 11.99 5 Z',
  target: 'M12 3 A9 9 0 1 1 11.99 3 Z M12 6 A6 6 0 1 0 12.01 6 Z M12 9 A3 3 0 1 1 11.99 9 Z M11 1 H13 V7 H11 Z M11 17 H13 V23 H11 Z M1 11 H7 V13 H1 Z M17 11 H23 V13 H17 Z',
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w * S;
  c.height = h * S;
  const ctx = c.getContext('2d');
  ctx.scale(S, S);
  return [c, ctx];
}

function lipasIcon(name, color) {
  const [c, ctx] = canvas(28, 28);
  ctx.beginPath();
  ctx.arc(14, 14, 12.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.translate(4, 4);
  ctx.scale(20 / 24, 20 / 24);
  ctx.fillStyle = '#ffffff';
  ctx.fill(new Path2D(GLYPHS[name] || GLYPHS.info));
  return ctx.getImageData(0, 0, c.width, c.height);
}

function chevron(color, outline, w = 18, h = 14) {
  const [c, ctx] = canvas(w, h);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(4, 2);
    ctx.lineTo(w - 5, h / 2);
    ctx.lineTo(4, h - 2);
  };
  path();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 5;
  ctx.stroke();
  path();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  return ctx.getImageData(0, 0, c.width, c.height);
}

function doubleChevron() {
  const [c, ctx] = canvas(22, 14);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const [stroke, width] of [['rgba(255,255,255,0.95)', 5], ['#111827', 2.2]]) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    for (const dx of [0, 7]) {
      ctx.beginPath();
      ctx.moveTo(4 + dx, 2.5);
      ctx.lineTo(10 + dx, 7);
      ctx.lineTo(4 + dx, 11.5);
      ctx.stroke();
    }
  }
  return ctx.getImageData(0, 0, c.width, c.height);
}

// Warning signs for traffic & safety points: triangle / diamond with a glyph.
function sign(shape, fill, glyph) {
  const [c, ctx] = canvas(28, 28);
  ctx.beginPath();
  if (shape === 'triangle') { ctx.moveTo(14, 2.5); ctx.lineTo(26, 24.5); ctx.lineTo(2, 24.5); }
  else { ctx.moveTo(14, 1.5); ctx.lineTo(26.5, 14); ctx.lineTo(14, 26.5); ctx.lineTo(1.5, 14); }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = '#111111';
  ctx.font = '900 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, 14, shape === 'triangle' ? 17 : 14.5);
  return ctx.getImageData(0, 0, c.width, c.height);
}

// Ship seen from above, bow up; SDF so moving / anchored ships can be tinted.
function ship() {
  const [c, ctx] = canvas(16, 28);
  ctx.beginPath();
  ctx.moveTo(8, 1.5);
  ctx.quadraticCurveTo(14.5, 8, 14, 26);
  ctx.lineTo(2, 26);
  ctx.quadraticCurveTo(1.5, 8, 8, 1.5);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  return ctx.getImageData(0, 0, c.width, c.height);
}

// Plain white arrow pointing up; drawn as SDF so it can be tinted per feature.
function windArrow() {
  const [c, ctx] = canvas(22, 30);
  ctx.beginPath();
  ctx.moveTo(11, 2);
  ctx.lineTo(20, 15);
  ctx.lineTo(14, 13.5);
  ctx.lineTo(14, 28);
  ctx.lineTo(8, 28);
  ctx.lineTo(8, 13.5);
  ctx.lineTo(2, 15);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  return ctx.getImageData(0, 0, c.width, c.height);
}

const SDF = new Set(['wind-arrow', 'ship']);

export function makeIcon(id) {
  if (id === 'wind-arrow') return windArrow();
  if (id === 'ship') return ship();
  if (id === 'sf-incident') return sign('triangle', '#ef4444', '!');
  if (id === 'sf-roadwork') return sign('diamond', '#f59e0b', '⚒');
  if (id === 'sf-slippery') return sign('triangle', '#a855f7', '❄');
  if (id === 'route-arrow') return chevron('#ffffff', 'rgba(0,0,0,0.35)');
  if (id === 'uphill-arrow') return doubleChevron();
  if (id.startsWith('lipas-')) {
    const name = id.slice(6);
    const type = Object.values(LIPAS_TYPES).find((t) => t.icon === name);
    return lipasIcon(name, type ? type.color : '#475569');
  }
  return null;
}

export function installIcons(map) {
  map.on('styleimagemissing', (e) => {
    if (map.hasImage(e.id)) return;
    const img = makeIcon(e.id);
    if (img) map.addImage(e.id, img, { pixelRatio: S, sdf: SDF.has(e.id) });
  });
}
