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
  swim: 'M15 4 A2.2 2.2 0 1 1 14.99 4 Z M5 12 L10 8.5 L13.5 11 L10 13.5 Z M3 16 C5.5 14.5 8 14.5 10.5 16 C13 17.5 15.5 17.5 18 16 C19 15.4 20 15.2 21 15.4 V18 C20 17.8 19 18 18 18.6 C15.5 20 13 20 10.5 18.6 C8 17.2 5.5 17.2 3 18.6 Z',
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

// ---------------------------------------------------------------- nautical marks
// IALA region A (Finland): body colour bands top → bottom and topmarks.
const RED = '#dc2626', GREEN = '#16a34a', YEL = '#facc15', BLK = '#111827', MAG = '#c026d3';
const MARKS = {
  port: { bands: [RED], top: 'can', topColor: RED },
  starboard: { bands: [GREEN], top: 'cone', topColor: GREEN },
  north: { bands: [BLK, YEL], top: 'upup' },
  south: { bands: [YEL, BLK], top: 'downdown' },
  east: { bands: [BLK, YEL, BLK], top: 'diamond' },
  west: { bands: [YEL, BLK, YEL], top: 'hourglass' },
  danger: { bands: [BLK, RED, BLK], top: 'balls', topColor: BLK },
  safe: { bands: [RED, '#ffffff', RED, '#ffffff'], vertical: true, top: 'ball', topColor: RED },
  special: { bands: [YEL], top: 'x', topColor: YEL },
};

function tri(ctx, x, y, w, hh, up) {
  ctx.beginPath();
  if (up) { ctx.moveTo(x, y + hh); ctx.lineTo(x + w / 2, y); ctx.lineTo(x + w, y + hh); }
  else { ctx.moveTo(x, y); ctx.lineTo(x + w / 2, y + hh); ctx.lineTo(x + w, y); }
  ctx.closePath();
}

function navMark(kind) {
  const m = MARKS[kind];
  const [c, ctx] = canvas(18, 32);
  ctx.lineWidth = 1;
  ctx.strokeStyle = BLK;
  // pole
  ctx.beginPath(); ctx.moveTo(9, 9); ctx.lineTo(9, 31); ctx.stroke();
  // body with bands
  const x = 5, y = 14, w = 8, hgt = 15;
  m.bands.forEach((col, i) => {
    ctx.fillStyle = col;
    if (m.vertical) ctx.fillRect(x + (w / m.bands.length) * i, y, w / m.bands.length, hgt);
    else ctx.fillRect(x, y + (hgt / m.bands.length) * i, w, hgt / m.bands.length);
  });
  ctx.strokeRect(x, y, w, hgt);
  // topmark
  const tc = m.topColor || BLK;
  ctx.fillStyle = tc;
  const T = m.top;
  if (T === 'can') { ctx.fillRect(6, 4, 6, 6); ctx.strokeRect(6, 4, 6, 6); }
  else if (T === 'cone') { tri(ctx, 5, 3, 8, 8, true); ctx.fill(); ctx.stroke(); }
  else if (T === 'upup') { tri(ctx, 5, 1, 8, 5.5, true); ctx.fill(); tri(ctx, 5, 7, 8, 5.5, true); ctx.fill(); }
  else if (T === 'downdown') { tri(ctx, 5, 1, 8, 5.5, false); ctx.fill(); tri(ctx, 5, 7, 8, 5.5, false); ctx.fill(); }
  else if (T === 'diamond') { tri(ctx, 5, 1, 8, 5.5, true); ctx.fill(); tri(ctx, 5, 7, 8, 5.5, false); ctx.fill(); }
  else if (T === 'hourglass') { tri(ctx, 5, 1, 8, 5.5, false); ctx.fill(); tri(ctx, 5, 7, 8, 5.5, true); ctx.fill(); }
  else if (T === 'balls') { for (const yy of [3.5, 9]) { ctx.beginPath(); ctx.arc(9, yy, 2.6, 0, Math.PI * 2); ctx.fill(); } }
  else if (T === 'ball') { ctx.beginPath(); ctx.arc(9, 6, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  else if (T === 'x') {
    ctx.strokeStyle = YEL; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(5, 2); ctx.lineTo(13, 10); ctx.moveTo(13, 2); ctx.lineTo(5, 10); ctx.stroke();
    ctx.strokeStyle = BLK; ctx.lineWidth = 0.6; ctx.stroke();
  }
  return ctx.getImageData(0, 0, c.width, c.height);
}

// Chart light flare: magenta teardrop pointing up-right from the position.
function flarePath(ctx, x, y, len) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + len * 0.15, y - len * 0.85, x + len * 0.72, y - len * 0.72);
  ctx.quadraticCurveTo(x + len * 0.85, y - len * 0.15, x, y);
  ctx.closePath();
}

function light(lighthouse = false) {
  const [c, ctx] = canvas(26, 26);
  ctx.fillStyle = MAG;
  ctx.globalAlpha = 0.9;
  flarePath(ctx, 9, 17, 16);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (lighthouse) {
    // small tower with red band
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = BLK; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(6, 25); ctx.lineTo(8, 12); ctx.lineTo(10, 12); ctx.lineTo(12, 25); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = RED; ctx.fillRect(7.2, 17, 3.6, 3);
  } else {
    ctx.fillStyle = BLK;
    ctx.beginPath(); ctx.arc(9, 17, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  return ctx.getImageData(0, 0, c.width, c.height);
}

function flareOnly() {
  const [c, ctx] = canvas(16, 16);
  ctx.fillStyle = MAG;
  flarePath(ctx, 2, 14, 13);
  ctx.fill();
  return ctx.getImageData(0, 0, c.width, c.height);
}

function leading() {
  const [c, ctx] = canvas(16, 30);
  ctx.strokeStyle = BLK; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(8, 12); ctx.lineTo(8, 29); ctx.stroke();
  ctx.fillStyle = '#f97316';
  tri(ctx, 2, 1, 12, 11, true); ctx.fill(); ctx.stroke();
  ctx.fillStyle = BLK; ctx.fillRect(6.5, 6, 3, 5);
  return ctx.getImageData(0, 0, c.width, c.height);
}

function cairn() {
  const [c, ctx] = canvas(16, 16);
  ctx.fillStyle = '#e5e7eb'; ctx.strokeStyle = '#374151'; ctx.lineWidth = 1.2;
  tri(ctx, 2, 2, 12, 12, true); ctx.fill(); ctx.stroke();
  return ctx.getImageData(0, 0, c.width, c.height);
}

function ring(color, r = 6, w = 1.6) {
  const n = (r + w) * 2 + 2;
  const [c, ctx] = canvas(n, n);
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.arc(n / 2, n / 2, r, 0, Math.PI * 2); ctx.stroke();
  return ctx.getImageData(0, 0, c.width, c.height);
}

function signIcon() {
  const [c, ctx] = canvas(20, 20);
  ctx.fillStyle = '#1d4ed8'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.roundRect(2, 2, 16, 16, 3); ctx.fill(); ctx.stroke();
  return ctx.getImageData(0, 0, c.width, c.height);
}

function cameraIcon() {
  const [c, ctx] = canvas(24, 24);
  ctx.fillStyle = '#0f172a'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(12, 12, 10.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(5.5, 8.5, 9, 7, 1.5); ctx.fill();
  ctx.beginPath(); ctx.moveTo(14.5, 11); ctx.lineTo(18.5, 8.8); ctx.lineTo(18.5, 15.2); ctx.lineTo(14.5, 13); ctx.closePath(); ctx.fill();
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

// Trail details (js/trails.js): what's in the way, on a small disc. Brown for
// fallen trees, slate for barriers, red for a gate you may not pass, blue for fords.
const TRAIL_ICONS = {
  tree: '#a16207', gate: '#334155', 'gate-no': '#dc2626', stile: '#334155', cycle: '#334155', ford: '#0284c7',
};
function trailIcon(kind) {
  const [c, ctx] = canvas(22, 22);
  ctx.beginPath();
  ctx.arc(11, 11, 9.8, 0, Math.PI * 2);
  ctx.fillStyle = TRAIL_ICONS[kind];
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (pts, w = 1.8) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  if (kind === 'tree') {
    line([[5, 14.5], [17, 9]], 3.4); // the trunk, lying across
    line([[9.5, 12.4], [8.5, 8.6]], 1.4); // two branches
    line([[13.2, 10.7], [13.6, 6.8]], 1.4);
  } else if (kind === 'gate' || kind === 'gate-no') {
    line([[6.5, 6], [6.5, 16]]);
    line([[15.5, 6], [15.5, 16]]);
    line([[6.5, 9], [15.5, 9]], 1.5);
    line([[6.5, 13], [15.5, 13]], 1.5);
  } else if (kind === 'stile') {
    line([[6, 16.5], [11, 5.5], [16, 16.5]], 1.6);
    line([[7.6, 13], [14.4, 13]], 1.4);
    line([[9.2, 9.4], [12.8, 9.4]], 1.4);
  } else if (kind === 'cycle') {
    line([[5, 9], [13, 9]], 2);
    line([[9, 13.5], [17, 13.5]], 2);
  } else if (kind === 'ford') {
    const wave = (y) => line([[4.5, y], [7, y - 1.8], [9.5, y], [12, y - 1.8], [14.5, y], [17, y - 1.8]], 1.6);
    wave(10);
    wave(14.5);
  }
  return ctx.getImageData(0, 0, c.width, c.height);
}

/** An icon as an image URL, for keys and lists (the same drawing the map uses). */
export function iconUrl(id) {
  const img = makeIcon(id);
  if (!img) return '';
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d').putImageData(img, 0, 0);
  return c.toDataURL();
}

const SDF = new Set(['wind-arrow', 'ship']);

export function makeIcon(id) {
  if (id === 'wind-arrow') return windArrow();
  if (id === 'ship') return ship();
  if (id === 'sf-incident') return sign('triangle', '#ef4444', '!');
  if (id.startsWith('nm-') && MARKS[id.slice(3)]) return navMark(id.slice(3));
  if (id === 'nm-light') return light(false);
  if (id === 'nm-lighthouse') return light(true);
  if (id === 'nm-flare') return flareOnly();
  if (id === 'nm-leading') return leading();
  if (id === 'nm-cairn') return cairn();
  if (id === 'nm-racon') return ring(MAG, 5, 1.4);
  if (id === 'nm-other') return ring('#475569', 3.5, 1.6);
  if (id === 'nm-fault') return ring('#dc2626', 11, 2.4);
  if (id === 'nm-sign') return signIcon();
  if (id === 'camera') return cameraIcon();
  if (id === 'sf-roadwork') return sign('diamond', '#f59e0b', '⚒');
  if (id === 'sf-slippery') return sign('triangle', '#a855f7', '❄');
  if (id === 'route-arrow') return chevron('#ffffff', 'rgba(0,0,0,0.35)');
  if (id === 'uphill-arrow') return doubleChevron();
  if (id.startsWith('td-') && TRAIL_ICONS[id.slice(3)]) return trailIcon(id.slice(3));
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
