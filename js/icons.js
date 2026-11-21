// Map icons drawn on canvas at runtime (no extra sprite sheet needed).
// Registered lazily through the map's `styleimagemissing` event.

import { LIPAS_TYPES, WARN_COLORS } from './config.js';

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

// a wetland's fill: rows of short horizontal dashes on the wetland colour, as on Finnish maps (#1144).
// `wetland-<fill>-<dashes>`, both hex without '#', so each map's palette has its own image
function wetland(id) {
  const [, fill, dash] = id.split('-');
  const [c, ctx] = canvas(8, 8);
  ctx.fillStyle = `#${fill}`;
  ctx.fillRect(0, 0, 8, 8);
  ctx.fillStyle = `#${dash}`;
  // 6 on, 2 off; the second row half a dash along
  ctx.fillRect(0, 3, 2, 1); ctx.fillRect(4, 3, 4, 1);
  ctx.fillRect(0, 7, 6, 1);
  return ctx.getImageData(0, 0, c.width, c.height);
}

// MML's bogs (#1147) beside wetland(): `bog-hard-<fill>-<lines>`, a bog MML's survey classes hard to cross, in unbroken
// lines every 3 px; `bog-paludified-<dashes>`, paludified land, short dashes far apart on a clear ground, so the land
// under it shows
function bog(id) {
  const [, kind, a, b] = id.split('-');
  if (kind === 'hard') {
    const [c, ctx] = canvas(8, 6);
    ctx.fillStyle = `#${a}`;
    ctx.fillRect(0, 0, 8, 6);
    ctx.fillStyle = `#${b}`;
    ctx.fillRect(0, 1, 8, 1); ctx.fillRect(0, 4, 8, 1);
    return ctx.getImageData(0, 0, c.width, c.height);
  }
  const [c, ctx] = canvas(16, 8);
  ctx.fillStyle = `#${a}`;
  ctx.fillRect(2, 3, 4, 1); ctx.fillRect(10, 7, 4, 1);
  return ctx.getImageData(0, 0, c.width, c.height);
}

// a tuft of reeds, three strokes from (x, y) at the foot, as Finnish maps draw reeds
function tufts(ctx, colour, feet) {
  ctx.strokeStyle = `#${colour}`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [x, y] of feet) {
    ctx.moveTo(x, y); ctx.lineTo(x, y - 4.5);
    ctx.moveTo(x - 0.4, y); ctx.lineTo(x - 2.4, y - 3.5);
    ctx.moveTo(x + 0.4, y); ctx.lineTo(x + 2.4, y - 3.5);
  }
  ctx.stroke();
}

// reeds in the water, OSM's reedbeds (#1144) and MML's overgrowing water: tufts on an opaque ground, the water's colour
// (#1248). `reedbed-<fill>-<reeds>`, both hex without '#'
function reedbed(id) {
  const [, fill, reed] = id.split('-');
  const [c, ctx] = canvas(12, 12);
  ctx.fillStyle = `#${fill}`;
  ctx.fillRect(0, 0, 12, 12);
  // two tufts a row apart, the second half a tile along
  tufts(ctx, reed, [[3, 5.5], [9, 11.5]]);
  return ctx.getImageData(0, 0, c.width, c.height);
}

// MML's reeds (#1147), a point: one tuft on a clear ground. `reed-<reeds>`
function reed(id) {
  const [c, ctx] = canvas(8, 7);
  tufts(ctx, id.slice(5), [[4, 6]]);
  return ctx.getImageData(0, 0, c.width, c.height);
}

// MML's rock and stone (#1147). `boulders-<ground>-<dots>`, a boulder field's fill: dots on the rock's grey, set unevenly
// so they don't read as a grid; `rock-<kind>-<colour>`, a point: `spot-<colour>-<edge>`, a rock too small for an area,
// a speck in the rock's grey with an edge; `stone`, one dot; `rocks`, sparse boulders, three dots; and stones in the
// water (#1170) as MML's and Traficom's maps draw them: `under`, under the surface, a T; `awash`, at the surface, a cross;
// `above`, above it, an upside-down T
function rock(id) {
  const [what, kind, colour, edge] = id.split('-');
  const dot = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  if (what === 'boulders') {
    const [c, ctx] = canvas(10, 10);
    ctx.fillStyle = `#${kind}`;
    ctx.fillRect(0, 0, 10, 10);
    ctx.fillStyle = `#${colour}`;
    for (const [x, y, r] of [[2, 2.5, 0.9], [7, 4, 0.7], [4, 7.5, 0.8], [8.5, 8.5, 0.6]]) dot(ctx, x, y, r);
    return ctx.getImageData(0, 0, c.width, c.height);
  }
  if (kind === 'under' || kind === 'awash' || kind === 'above') {
    // larger than the land's stones: they're a hazard on the water
    const [c, ctx] = canvas(11, 11);
    ctx.strokeStyle = `#${colour}`; ctx.lineWidth = 1.4; ctx.beginPath();
    if (kind === 'awash') { ctx.moveTo(1.5, 5.5); ctx.lineTo(9.5, 5.5); ctx.moveTo(5.5, 1.5); ctx.lineTo(5.5, 9.5); } else if (kind === 'above') { ctx.moveTo(1.5, 9); ctx.lineTo(9.5, 9); ctx.moveTo(5.5, 1.5); ctx.lineTo(5.5, 9); } else { ctx.moveTo(1.5, 2); ctx.lineTo(9.5, 2); ctx.moveTo(5.5, 2); ctx.lineTo(5.5, 9.5); }
    ctx.stroke();
    return ctx.getImageData(0, 0, c.width, c.height);
  }
  const [c, ctx] = canvas(8, 8);
  ctx.fillStyle = `#${colour}`;
  if (kind === 'spot') {
    ctx.beginPath(); ctx.ellipse(4, 4, 2.6, 2, -0.4, 0, Math.PI * 2);
    ctx.fill(); ctx.strokeStyle = `#${edge}`; ctx.lineWidth = 0.8; ctx.stroke();
  } else if (kind === 'stone') dot(ctx, 4, 4, 1.3);
  else for (const [x, y] of [[2.2, 5.2], [5.8, 5.2], [4, 2.4]]) dot(ctx, x, y, 1);
  return ctx.getImageData(0, 0, c.width, c.height);
}

// MML's shoals and stone fields in the water (#1170), on a clear ground so the water and its depths show:
// `shoal-<lines>`, light lines across; `stonefield-<lines>-<marks>`, the same with MML's small triangles
function shoal(id) {
  const [what, lines, marks] = id.split('-');
  const [c, ctx] = canvas(12, 12);
  ctx.fillStyle = `#${lines}`;
  ctx.globalAlpha = 0.75;
  for (const y of [1, 5, 9]) ctx.fillRect(0, y, 12, 1);
  ctx.globalAlpha = 1;
  if (what === 'stonefield') {
    ctx.fillStyle = `#${marks}`;
    for (const [x, y] of [[3, 4], [9, 10]]) { ctx.beginPath(); ctx.moveTo(x - 1.4, y); ctx.lineTo(x + 1.4, y); ctx.lineTo(x, y - 2.4); ctx.fill(); }
  }
  return ctx.getImageData(0, 0, c.width, c.height);
}

// which way a river flows (#1170): an arrow pointing east on a light edge, so it shows on the water and the land; the layer
// turns it. `flow-<colour>-<edge>`
function flow(id) {
  const [, colour, edge] = id.split('-');
  const [c, ctx] = canvas(14, 9);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [w, col] of [[3.2, edge], [1.4, colour]]) {
    ctx.strokeStyle = `#${col}`; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(2, 4.5); ctx.lineTo(12, 4.5); ctx.moveTo(8.5, 1.8); ctx.lineTo(12, 4.5); ctx.lineTo(8.5, 7.2);
    ctx.stroke();
  }
  return ctx.getImageData(0, 0, c.width, c.height);
}

// rapids (#1170), a line's pattern: a row of white ovals along the river, as on MML's Maastokartta, with a faint edge
// so they show on the light water. `rapids-<fill>-<edge>`; the pattern's height is the line's width
function rapids(id) {
  const [, fill, edge] = id.split('-');
  const [c, ctx] = canvas(16, 8);
  ctx.beginPath(); ctx.ellipse(8, 4, 3.4, 2.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = `#${fill}`; ctx.fill();
  ctx.globalAlpha = 0.6; ctx.strokeStyle = `#${edge}`; ctx.lineWidth = 0.8; ctx.stroke();
  return ctx.getImageData(0, 0, c.width, c.height);
}

// MML's open forest land (#1169), mostly clear-cuts, and OSM's scrub: the Maastokartta's diagonal hatch, rising to the
// right, on an opaque ground so the forest under it doesn't show. `open-forest-<ground>-<lines>`
function openForest(id) {
  const [, , ground, line] = id.split('-');
  const [c, ctx] = canvas(10, 10);
  ctx.fillStyle = `#${ground}`;
  ctx.fillRect(0, 0, 10, 10);
  ctx.strokeStyle = `#${line}`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (const o of [-10, 0, 10]) { ctx.moveTo(o, 10); ctx.lineTo(o + 10, 0); }
  ctx.stroke();
  return ctx.getImageData(0, 0, c.width, c.height);
}

// MML's forest symbols (#1169), as the Maastokartta draws them. `tree-<kind>-<colour>`: `conifer` Λ, `broadleaf` a ring
// open at its foot, `mixed` the ring over Λ, `heath` the dwarf-shrub heath's \ /
function tree(id) {
  const [, kind, colour] = id.split('-');
  const [c, ctx] = canvas(10, 12);
  ctx.strokeStyle = `#${colour}`;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const ring = (y, r) => { ctx.moveTo(5 + r * Math.cos(0.5 * Math.PI + 0.45), y + r * Math.sin(0.5 * Math.PI + 0.45)); ctx.arc(5, y, r, 0.5 * Math.PI + 0.45, 0.5 * Math.PI - 0.45); };
  const peak = (top) => { ctx.moveTo(2.4, 11); ctx.lineTo(5, top); ctx.lineTo(7.6, 11); };
  if (kind === 'conifer') peak(3.5);
  else if (kind === 'broadleaf') ring(6.5, 3);
  else if (kind === 'mixed') { ring(3.2, 2.2); peak(6.6); }
  else { ctx.moveTo(2.4, 4.5); ctx.lineTo(3.8, 9); ctx.moveTo(7.6, 4.5); ctx.lineTo(6.2, 9); }
  ctx.stroke();
  return ctx.getImageData(0, 0, c.width, c.height);
}

// a power line's pylon (#1147): a small cross. `pylon-<colour>`
function pylon(id) {
  const [c, ctx] = canvas(7, 7);
  ctx.strokeStyle = `#${id.slice(6)}`;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(1.5, 1.5); ctx.lineTo(5.5, 5.5); ctx.moveTo(5.5, 1.5); ctx.lineTo(1.5, 5.5);
  ctx.stroke();
  return ctx.getImageData(0, 0, c.width, c.height);
}

// a mountain pass (#1178): OSM's standard map's saddle, a block with a notch in its top. `saddle-<colour>`
function saddle(id) {
  const [c, ctx] = canvas(8, 8);
  ctx.fillStyle = `#${id.slice(7)}`;
  ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(0, 8); ctx.lineTo(8, 8); ctx.lineTo(8, 3); ctx.lineTo(4, 5); ctx.closePath(); ctx.fill();
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
const TRAIL_ICONS = { tree: '#a16207', ford: '#0284c7' };
function trailIcon(kind) {
  const [c, ctx] = canvas(22, 22);
  ctx.beginPath();
  ctx.arc(11, 11, 9.8, 0, Math.PI * 2);
  ctx.fillStyle = TRAIL_ICONS[kind];
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
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
  } else if (kind === 'ford') {
    const wave = (y) => line([[4.5, y], [7, y - 1.8], [9.5, y], [12, y - 1.8], [14.5, y], [17, y - 1.8]], 1.6);
    wave(10);
    wave(14.5);
  }
  return ctx.getImageData(0, 0, c.width, c.height);
}

// Gates and barriers (#1232): a mark for each kind on a disc coloured by who may pass, `td-<mark>-<unknown|closed|open>`. A closed
// one also has a white padlock out of its lower right corner and an open one a white ✓, so neither is told by colour alone, on a
// canvas 4 px larger each side, so the disc stays on the point.
const WHO = { unknown: '#334155', closed: '#dc2626', open: '#15803d' };
function barrierIcon(mark, who) {
  const pad = who === 'unknown' ? 0 : 4, [c, ctx] = canvas(22 + 2 * pad, 22 + 2 * pad);
  ctx.translate(pad, pad);
  ctx.beginPath();
  ctx.arc(11, 11, 9.8, 0, Math.PI * 2);
  ctx.fillStyle = WHO[who];
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (pts, w = 1.8) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  if (mark === 'gate') { // two posts and two rails
    line([[6.5, 6], [6.5, 16]]);
    line([[15.5, 6], [15.5, 16]]);
    line([[6.5, 9], [15.5, 9]], 1.5);
    line([[6.5, 13], [15.5, 13]], 1.5);
  } else if (mark === 'lift') { // a post, a short counterweight and the boom, with two of its stripes
    line([[6.5, 9.5], [6.5, 17]], 2);
    line([[3.6, 9.5], [6.5, 9.5]], 3.2);
    line([[6.5, 9.5], [18, 9.5]], 2.4);
    ctx.strokeStyle = WHO[who];
    ctx.lineCap = 'butt';
    line([[10.4, 9.5], [11.9, 9.5]], 2.8);
    line([[14.1, 9.5], [15.6, 9.5]], 2.8);
  } else if (mark === 'chain') { // two posts and the chain sagging between them
    line([[5.5, 7], [5.5, 16]], 2);
    line([[16.5, 7], [16.5, 16]], 2);
    ctx.lineWidth = 1.4;
    ctx.setLineDash([1.6, 1.2]);
    ctx.beginPath();
    ctx.moveTo(5.5, 8.5);
    ctx.quadraticCurveTo(11, 15, 16.5, 8.5);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (mark === 'blocks') {
    for (const x of [4.6, 9.6, 14.6]) ctx.fillRect(x, 9, 2.8, 5.5);
  } else if (mark === 'stile') {
    line([[6, 16.5], [11, 5.5], [16, 16.5]], 1.6);
    line([[7.6, 13], [14.4, 13]], 1.4);
    line([[9.2, 9.4], [12.8, 9.4]], 1.4);
  } else if (mark === 'turnstile') { // from above: the rotor's ring and its three arms
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(11, 11, 5.8, 0, Math.PI * 2);
    ctx.stroke();
    for (const a of [-90, 30, 150]) line([[11, 11], [11 + 5.8 * Math.cos(a * Math.PI / 180), 11 + 5.8 * Math.sin(a * Math.PI / 180)]], 1.6);
  } else if (mark === 'cycle') {
    line([[5, 9], [13, 9]], 2);
    line([[9, 13.5], [17, 13.5]], 2);
  }
  if (who === 'closed') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = WHO.closed;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(19.5, 19.5, 5.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = WHO.closed;
    ctx.beginPath();
    ctx.roundRect(16.9, 19, 5.2, 3.9, 0.8);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(19.5, 19, 1.8, Math.PI, 0);
    ctx.stroke();
  } else if (who === 'open') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = WHO.open;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(19.5, 19.5, 5.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineCap = 'round';
    line([[16.9, 19.6], [18.8, 21.5], [22.2, 17.6]], 1.6);
  }
  return ctx.getImageData(0, 0, c.width, c.height);
}
// the trail details' kinds, as Heads-up names them: a gate with no access is a closed gate
const KIND_MARK = { gate: ['gate', 'unknown'], 'gate-no': ['gate', 'closed'], stile: ['stile', 'unknown'], cycle: ['cycle', 'unknown'] };

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

// Check's markers on the route (25d part 3): a disc in the surface colour, ringed in its group's colour, with its sign: a
// filled triangle for a warning, an eye for good to know, a dashed ring and "?" not checked. The colours are the
// CSS's (WARN_COLORS) and in the name, so a new theme asks for new ones.
const MARK = { read: ['danger', 'M12 2.5 1.5 20.5h21L12 2.5ZM11 9.2v5.6h2V9.2h-2Zm0 7.4v2h2v-2h-2Z', true], look: ['look', 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z', false], not: ['unk', 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.4M12 16.8v.4', false] };
export const warnMarkId = (g) => `wm-${g}~${(WARN_COLORS[MARK[g][0]] + WARN_COLORS.surface).replace(/[^0-9a-z]/gi, '')}`;
function warnMark(g) {
  const [key, path, fill] = MARK[g], col = WARN_COLORS[key], R = g === 'look' ? 11 : 13, W = (R + 2) * 2;
  const [c, ctx] = canvas(W, W);
  ctx.beginPath();
  ctx.arc(W / 2, W / 2, R, 0, Math.PI * 2);
  ctx.fillStyle = WARN_COLORS.surface;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = col;
  if (g === 'not') ctx.setLineDash([3, 2.4]);
  ctx.stroke();
  ctx.setLineDash([]);
  const size = g === 'look' ? 14 : 16;
  ctx.translate(W / 2 - size / 2, W / 2 - size / 2);
  ctx.scale(size / 24, size / 24);
  const p = new Path2D(path);
  if (fill) { ctx.fillStyle = col; ctx.fill(p, 'evenodd'); } else { ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(p); }
  return ctx.getImageData(0, 0, c.width, c.height);
}

// a lightning strike (#182): a cross in its age's colour (yr's: under 1, 10 and 60 minutes) on a dark edge
export const STRIKE_COLOURS = { a: '#f97316', b: '#a855f7', c: '#d8b4fe' };
function strike(age) {
  const [c, ctx] = canvas(14, 14);
  ctx.lineCap = 'round';
  for (const [w, col] of [[4.2, '#1f2937'], [2.2, STRIKE_COLOURS[age]]]) {
    ctx.beginPath(); ctx.moveTo(2.5, 7); ctx.lineTo(11.5, 7); ctx.moveTo(7, 2.5); ctx.lineTo(7, 11.5);
    ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
  }
  return ctx.getImageData(0, 0, c.width, c.height);
}

const SDF = new Set(['wind-arrow', 'ship']);

// a ridge (#1178): OSM's standard map's band of dots, dense along the crest and thinning out to either side, drawn
// along the line by line-pattern. A fixed seed, so every tile's band is the same. `ridge-<colour>`
function ridge(id) {
  const [c, ctx] = canvas(16, 16);
  ctx.fillStyle = `#${id.slice(6)}`;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 60; i++) {
    const off = (rnd() + rnd() + rnd() - 1.5) * (i < 30 ? 1.4 : 5);
    ctx.beginPath(); ctx.arc(rnd() * 16, 8 + off, 0.4 + rnd() * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  return ctx.getImageData(0, 0, c.width, c.height);
}

export function makeIcon(id) {
  if (id.startsWith('wm-') && MARK[id.slice(3).split('~')[0]]) return warnMark(id.slice(3).split('~')[0]);
  if (/^wetland-[0-9a-f]{6}-[0-9a-f]{6}$/.test(id)) return wetland(id);
  if (/^reedbed-[0-9a-f]{6}-[0-9a-f]{6}$/.test(id)) return reedbed(id);
  if (/^bog-(hard-[0-9a-f]{6}|paludified)-[0-9a-f]{6}$/.test(id)) return bog(id);
  if (/^reed-[0-9a-f]{6}$/.test(id)) return reed(id);
  if (/^(boulders-[0-9a-f]{6}|rock-spot-[0-9a-f]{6}|rock-(stone|rocks|under|awash|above))-[0-9a-f]{6}$/.test(id)) return rock(id);
  if (/^(shoal|stonefield-[0-9a-f]{6})-[0-9a-f]{6}$/.test(id)) return shoal(id);
  if (/^flow-[0-9a-f]{6}-[0-9a-f]{6}$/.test(id)) return flow(id);
  if (/^rapids-[0-9a-f]{6}-[0-9a-f]{6}$/.test(id)) return rapids(id);
  if (/^pylon-[0-9a-f]{6}$/.test(id)) return pylon(id);
  if (/^open-forest-[0-9a-f]{6}-[0-9a-f]{6}$/.test(id)) return openForest(id);
  if (/^tree-(conifer|broadleaf|mixed|heath)-[0-9a-f]{6}$/.test(id)) return tree(id);
  if (/^saddle-[0-9a-f]{6}$/.test(id)) return saddle(id);
  if (/^ridge-[0-9a-f]{6}$/.test(id)) return ridge(id);
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
  if (id.startsWith('strike-')) return strike(id.slice(7));
  if (id === 'uphill-arrow') return doubleChevron();
  if (id.startsWith('td-') && TRAIL_ICONS[id.slice(3)]) return trailIcon(id.slice(3));
  if (id.startsWith('td-') && KIND_MARK[id.slice(3)]) return barrierIcon(...KIND_MARK[id.slice(3)]);
  const barrier = /^td-(gate|lift|chain|blocks|stile|turnstile|cycle)-(unknown|closed|open)$/.exec(id);
  if (barrier) return barrierIcon(barrier[1], barrier[2]);
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
