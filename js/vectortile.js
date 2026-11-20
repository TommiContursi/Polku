// A vector tile (Mapbox Vector Tile, protobuf) read by hand: the buildings' shadows read OpenFreeMap's
// (js/shadows.js), the water router MML's stones and shoals (js/waterdata.js).

const text = new TextDecoder();

/**
 * The features of the layers named in `want`: { n, layers: { name: [{ props, rings }] } }. `n` counts the features
 * of every layer, wanted or not. Each ring is flat [x, y, x, y…] in tile units scaled to `size` (a point is a ring of
 * one; a polygon's rings aren't closed). Only numbers are read in `props`: a string is null.
 */
export function decodeTile(buf, want, size = 1) {
  let p = 0;
  const varint = () => {
    let v = 0, s = 1, b;
    do { b = buf[p++]; v += (b & 0x7f) * s; s *= 128; } while (b & 0x80);
    return v;
  };
  const zigzag = () => { const n = varint(); return n % 2 ? -(n + 1) / 2 : n / 2; };
  const end = () => { const n = varint(); return p + n; };
  const skip = (w) => { if (w === 0) varint(); else { const n = w === 1 ? 8 : w === 5 ? 4 : varint(); p += n; } };
  // each field of a message up to `stop`: `on(field, wire)` reads the ones it wants and says so
  const each = (stop, on) => { while (p < stop) { const k = varint(); if (!on(k >> 3, k & 7)) skip(k & 7); } };
  const str = () => { const e = end(), s = text.decode(buf.subarray(p, e)); p = e; return s; };
  const out = { n: 0, layers: {} };
  each(buf.length, (f) => {
    if (f !== 3) return false;
    const layer = end(), keys = [], vals = [], feats = [];
    let name = '', extent = 4096;
    each(layer, (f) => {
      if (f === 1) name = str();
      else if (f === 2) { const e = end(); feats.push([p, e]); p = e; }
      else if (f === 3) keys.push(str());
      else if (f === 4) {
        let v = null;
        each(end(), (f) => {
          if (f === 2) { v = new DataView(buf.buffer, buf.byteOffset + p, 4).getFloat32(0, true); p += 4; }
          else if (f === 3) { v = new DataView(buf.buffer, buf.byteOffset + p, 8).getFloat64(0, true); p += 8; }
          else if (f === 4 || f === 5) v = varint();
          else if (f === 6) v = zigzag();
          else return false;
          return true;
        });
        vals.push(v);
      } else if (f === 5) extent = varint();
      else return false;
      return true;
    });
    out.n += feats.length;
    if (want.includes(name)) {
      const list = (out.layers[name] = []);
      for (const [s, e] of feats) {
        p = s;
        const props = {};
        let rings = null;
        each(e, (f) => {
          if (f === 2) { const t = end(); while (p < t) { const k = keys[varint()]; props[k] = vals[varint()]; } }
          else if (f === 4) {
            // MoveTo starts a ring, LineTo goes on, ClosePath has no point; each point is a step from the last
            const t = end();
            let x = 0, y = 0, ring;
            rings = [];
            while (p < t) {
              const c = varint(), cmd = c & 7;
              for (let i = 0; i < (cmd === 7 ? 0 : c >> 3); i++) {
                x += zigzag(); y += zigzag();
                if (cmd === 1) rings.push((ring = []));
                ring.push((x * size) / extent, (y * size) / extent);
              }
            }
          } else return false;
          return true;
        });
        if (rings) list.push({ props, rings });
      }
    }
    p = layer;
    return true;
  });
  return out;
}
