// LIPAS: Finland's national register of sports and outdoor facilities.
// Official hiking / MTB / paddling routes and lean-tos, huts, campfire sites and
// landing places, loaded by bounding box from the open WFS (CC BY 4.0). Also:
// one place with all its parts (to ride a route), and search by name.

import { LIPAS_WFS, LIPAS_TYPES, isLipasRoute } from './config.js';
import { lonLatToTile, tileBounds, tm35ToLonLat, dist, lineLength, nearestOnLine } from './geo.js';
import { request } from './net.js';

// LIPAS answers in EPSG:3067 at full precision (its EPSG:4326 is rounded to ~10 m)
const toLonLat = (g) => {
  const pt = (c) => tm35ToLonLat(c[0], c[1]);
  if (!g) return null;
  if (g.type === 'Point') return { type: 'Point', coordinates: pt(g.coordinates) };
  if (g.type === 'LineString') return { type: 'LineString', coordinates: g.coordinates.map(pt) };
  if (g.type === 'MultiLineString') return { type: 'MultiLineString', coordinates: g.coordinates.map((l) => l.map(pt)) };
  return null;
};

const clean = (v) => (v == null || v === 'None' ? '' : v);
function propsOf(type, p) {
  const t = LIPAS_TYPES[type];
  return {
    lipas: true,
    type,
    typeName: t.name,
    icon: t.icon || '',
    name: clean(p.nimi_fi) || clean(p.nimi_se) || t.name,
    info: clean(p.lisatieto_fi),
    www: clean(p.www),
    city: clean(p.kunta_nimi_fi),
    length: clean(p.reitin_pituus_km),
    surface: clean(p.pintamateriaali),
    wc: clean(p.yleiso_wc),
    lipasId: p.id,
  };
}

// Tests and screenshots answer from recorded files: fn(url) → JSON, or null to ask LIPAS.
let seeded = null;
export function seedLipas(fn) { seeded = fn; }
async function getJson(url, signal) {
  const fx = seeded && seeded(url);
  if (fx) return fx;
  const res = await request('lipas', url, { signal });
  if (!res.ok) throw new Error(`LIPAS ${res.status}`);
  return res.json();
}

const Z = 9; // cache granularity (≈ 60 km tiles at 61°N)

export class LipasLayer {
  constructor(map, onData) {
    this.map = map;
    this.onData = onData;
    this.routeTypes = [];
    this.pointTypes = [];
    this.showRoutes = false;
    this.showPoints = false;
    this.tiles = new Map(); // "type/x/y" -> {features}|Promise
    this.timer = 0;
    map.on('moveend', () => this.schedule());
  }

  configure({ routes, points, showRoutes, showPoints }) {
    this.routeTypes = routes;
    this.pointTypes = points;
    this.showRoutes = showRoutes;
    this.showPoints = showPoints;
    this.schedule(0);
    this.publish();
  }

  schedule(delay = 300) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.update(), delay);
  }

  inFinland() {
    const c = this.map.getCenter();
    return c.lng > 19 && c.lng < 32 && c.lat > 59.4 && c.lat < 70.2;
  }

  update() {
    const zoom = this.map.getZoom();
    if (!this.inFinland() || zoom < 8) return;
    const types = [
      ...(this.showRoutes ? this.routeTypes : []),
      ...(this.showPoints && zoom >= 9.5 ? this.pointTypes : []),
    ];
    if (!types.length) return;
    const b = this.map.getBounds();
    const [x0, y0] = lonLatToTile(b.getWest(), b.getNorth(), Z).map(Math.floor);
    const [x1, y1] = lonLatToTile(b.getEast(), b.getSouth(), Z).map(Math.floor);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 9) return;
    for (const type of types) {
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          const key = `${type}/${x}/${y}`;
          if (this.tiles.has(key)) continue;
          const p = this.fetchTile(type, x, y)
            .then((features) => { this.tiles.set(key, { features }); this.publish(); })
            .catch(() => this.tiles.delete(key));
          this.tiles.set(key, p);
        }
      }
    }
  }

  async fetchTile(type, x, y) {
    const t = LIPAS_TYPES[type];
    const [w, s, e, n] = tileBounds(x, y, Z);
    const url = `${LIPAS_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=lipas:${t.layer}` +
      `&outputFormat=application/json&srsName=EPSG:3067&count=2000&bbox=${s},${w},${n},${e},urn:ogc:def:crs:EPSG::4326`;
    const gj = await getJson(url);
    return (gj.features || [])
      .map((f) => ({ f, g: toLonLat(f.geometry) }))
      .filter(({ g }) => g)
      .map(({ f, g }) => {
        const p = f.properties || {};
        return { type: 'Feature', id: `${type}-${p.id}-${p.reitti_id || ''}`, geometry: g, properties: propsOf(type, p) };
      });
  }

  publish() {
    const routes = [];
    const points = [];
    const seen = new Set();
    for (const [key, v] of this.tiles) {
      if (!v || !v.features) continue;
      const type = +key.split('/')[0];
      const isRoute = isLipasRoute(type);
      if (isRoute ? !(this.showRoutes && this.routeTypes.includes(type)) : !(this.showPoints && this.pointTypes.includes(type))) continue;
      for (const f of v.features) {
        if (seen.has(f.id)) continue;
        seen.add(f.id);
        (isRoute ? routes : points).push(f);
      }
    }
    this.onData({ type: 'FeatureCollection', features: routes }, { type: 'FeatureCollection', features: points });
  }
}

// ---------------------------------------------------------------- one place, all its parts
// A LIPAS "place" is a route (or a network of trails) made of parts (reitti_id),
// each a line. One request for all of them, kept for the session.
const places = new Map(); // "type/id" -> Promise<{ props, parts: [{ rid, coords }], point }>

export function lipasPlace(type, id) {
  const key = `${type}/${id}`;
  if (!places.has(key)) {
    const t = LIPAS_TYPES[type];
    if (!t) return Promise.reject(new Error('Not a LIPAS type Polku knows'));
    const url = `${LIPAS_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=lipas:${t.layer}` +
      `&outputFormat=application/json&srsName=EPSG:3067&count=1000&CQL_FILTER=${encodeURIComponent(`id=${+id}`)}`;
    const p = getJson(url).then((gj) => {
      const feats = (gj.features || []).filter((f) => f.geometry);
      if (!feats.length) throw new Error('LIPAS has no map data for this place');
      const parts = [];
      let point = null;
      feats.sort((a, b) => (a.properties.reitti_id || 0) - (b.properties.reitti_id || 0));
      for (const f of feats) {
        const g = toLonLat(f.geometry);
        if (!g) continue;
        if (g.type === 'Point') { point = point || g.coordinates; continue; }
        const lines = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
        lines.forEach((c, k) => { if (c.length > 1) parts.push({ rid: lines.length > 1 ? `${f.properties.reitti_id}_${k}` : String(f.properties.reitti_id ?? parts.length), coords: c }); });
      }
      return { props: propsOf(type, feats[0].properties), parts, point };
    });
    p.catch(() => places.delete(key)); // ask again next time
    places.set(key, p);
  }
  return places.get(key);
}

// The line of parts in order: "3-7r-8" is part 3, part 7 backwards, part 8.
// Part ends are joined as they are (LIPAS's ends a few metres apart get a short
// connector), so the same parts always give the same line: share links clip it
// by distance along.
export function stitch(place, seq) {
  const byRid = new Map(place.parts.map((p) => [p.rid, p.coords]));
  const out = [];
  for (const tok of seq.split('-')) {
    const rev = tok.endsWith('r');
    const c = byRid.get(rev ? tok.slice(0, -1) : tok);
    if (!c) return null; // LIPAS changed: the caller routes instead
    const cc = rev ? c.slice().reverse() : c;
    for (const q of cc) if (!out.length || dist(out[out.length - 1], q) > 0.5) out.push(q);
  }
  return out;
}

/** The stretch of a stitched line from `a` to `b` metres along it (b < a: backwards). */
export function clipAlong(line, a, b) {
  const rev = b < a;
  const [lo, hi] = rev ? [b, a] : [a, b];
  const out = [];
  let m = 0;
  for (let i = 0; i < line.length; i++) {
    const d = i ? dist(line[i - 1], line[i]) : 0;
    const m0 = m;
    m += d;
    if (i && m0 < lo && m >= lo) out.push(lerpAt(line[i - 1], line[i], (lo - m0) / d));
    if (m >= lo && m <= hi) out.push(line[i]);
    if (i && m0 < hi && m > hi) { out.push(lerpAt(line[i - 1], line[i], (hi - m0) / d)); break; }
  }
  return rev ? out.reverse() : out;
}
const lerpAt = (p, q, t) => [+(p[0] + (q[0] - p[0]) * t).toFixed(6), +(p[1] + (q[1] - p[1]) * t).toFixed(6)];

const SNAP = 20; // part ends this close are one junction
const BRIDGE = 400; // loose ends this close are joined (a routed leg)
const JOIN = 30; // ...and this close, simply drawn across

// The shortest way between two junctions over these edges (bridges count their gap).
function shortest(edges, from, to) {
  const best = new Map([[from, { len: 0, via: null, prev: null }]]);
  const done = new Set();
  for (;;) {
    let at = null;
    for (const [k, v] of best) if (!done.has(k) && (at == null || v.len < best.get(at).len)) at = k;
    if (at == null) return null;
    if (at === to) break;
    done.add(at);
    for (const e of edges) {
      if (e.u !== at && e.v !== at) continue;
      const o = e.u === at ? e.v : e.u, len = best.get(at).len + e.len + (e.gap || 0);
      if (!best.has(o) || len < best.get(o).len) best.set(o, { len, via: e, prev: at });
    }
  }
  const out = [];
  for (let k = to; k !== from; k = best.get(k).prev) out.push(best.get(k).via);
  return { len: best.get(to).len, edges: out };
}

/**
 * How to ride a place. Its parts meet at junctions; loose ends close to each
 * other are bridged. If the parts can be ridden one after another, each once
 * (an Euler path: a chain, a loop, a figure of eight), that's the route, going
 * as straight on as it can at junctions. A network of trails that can't rides
 * the stretch you clicked between junctions, or the longest one. A short part
 * on its own (a shortcut or a spur LIPAS didn't join up) is left out.
 *
 * Returns { pieces: [{ coords, seq, a, b }], loop, closeGap, network, left, km }:
 * consecutive pieces are joined by routed legs; `closeGap` is a routed leg back
 * to the start; `left` is the km of LIPAS line not ridden. `near` makes a
 * one-way route start at its nearer end.
 */
export function rideOf(place, { near = null, click = null } = {}) {
  const parts = place.parts;
  if (!parts.length) return null;
  const lens = parts.map((p) => lineLength(p.coords));
  // junctions
  const nodes = [];
  const nodeAt = (p) => {
    for (let k = 0; k < nodes.length; k++) if (dist(nodes[k], p) < SNAP) return k;
    nodes.push(p);
    return nodes.length - 1;
  };
  // edges: parts, then bridges between loose ends
  const edges = parts.map((pt, i) => ({ i, u: nodeAt(pt.coords[0]), v: nodeAt(pt.coords[pt.coords.length - 1]), len: lens[i] }));
  const deg = new Array(nodes.length).fill(0);
  for (const e of edges) { deg[e.u]++; deg[e.v]++; }
  const loose = nodes.map((_, k) => k).filter((k) => deg[k] === 1);
  const pairs = [];
  for (let x = 0; x < loose.length; x++) for (let y = x + 1; y < loose.length; y++) {
    const d = dist(nodes[loose[x]], nodes[loose[y]]);
    if (d < BRIDGE) pairs.push({ u: loose[x], v: loose[y], d });
  }
  pairs.sort((p, q) => p.d - q.d);
  const bridged = new Set();
  for (const pr of pairs) {
    if (bridged.has(pr.u) || bridged.has(pr.v)) continue;
    bridged.add(pr.u); bridged.add(pr.v);
    edges.push({ i: -1, u: pr.u, v: pr.v, len: 0, gap: pr.d });
    deg[pr.u]++; deg[pr.v]++;
  }
  // components: the one you clicked, else the one with the most line
  const root = nodes.map((_, k) => k);
  const find = (k) => (root[k] === k ? k : (root[k] = find(root[k])));
  for (const e of edges) root[find(e.u)] = find(e.v);
  const size = new Map();
  for (const e of edges) size.set(find(e.u), (size.get(find(e.u)) || 0) + e.len);
  const nearestPart = (pt) => {
    let best = Infinity, k = 0;
    parts.forEach((p, j) => { const d = nearestOnLine(pt, p.coords).d; if (d < best) { best = d; k = j; } });
    return k;
  };
  const clicked = click ? nearestPart(click) : -1;
  let comp = clicked >= 0 ? find(edges[clicked].u) : [...size.entries()].sort((x, y) => y[1] - x[1])[0][0];
  const mine = edges.filter((e) => find(e.u) === comp);
  let odd = [...new Set(mine.flatMap((e) => [e.u, e.v]))].filter((k) => deg[k] % 2);
  // A loop with a spur (to a car park, a tower) or a stretch ridden both ways has two
  // odd junctions close together along the route: ride that stretch twice, out and back.
  if (odd.length === 2) {
    const path = shortest(mine, odd[0], odd[1]);
    const compLen = mine.reduce((t, e) => t + e.len + (e.gap || 0), 0);
    if (path && path.len < 0.25 * compLen) {
      for (const e of path.edges) mine.push({ ...e });
      const tip = odd.find((k) => deg[k] === 1); // a spur's far end is where it's walked from
      odd = [];
      mine.start = tip ?? null;
    }
  }
  // the end of a part next to node k, and the way it heads from there
  const away = (e, from) => {
    if (e.i < 0) return null;
    const c = parts[e.i].coords, fwd = from === e.u;
    const seq = fwd ? c : c.slice().reverse();
    let m = 0, j = 1;
    for (; j < seq.length - 1 && m < 30; j++) m += dist(seq[j - 1], seq[j]);
    return Math.atan2(seq[j][1] - seq[0][1], (seq[j][0] - seq[0][0]) * Math.cos((seq[0][1] * Math.PI) / 180));
  };
  let walk = null;
  if (odd.length === 0 || odd.length === 2) {
    // Fleury: never take a bridge (in the graph sense) when there's another way, and prefer straight on
    const left = new Set(mine);
    const reach = (from, without) => {
      const seen = new Set([from]), todo = [from];
      while (todo.length) {
        const n = todo.pop();
        for (const e of left) {
          if (e === without || (e.u !== n && e.v !== n)) continue;
          const o = e.u === n ? e.v : e.u;
          if (!seen.has(o)) { seen.add(o); todo.push(o); }
        }
      }
      return seen.size;
    };
    let at, first = null;
    if (odd.length === 2) at = near && dist(nodes[odd[1]], near) < dist(nodes[odd[0]], near) ? odd[1] : odd[0];
    else if (mine.start != null) at = mine.start;
    else {
      // a loop starts where LIPAS's first part starts
      first = mine.filter((e) => e.i >= 0).sort((x, y) => x.i - y.i)[0];
      at = first.u;
    }
    walk = [];
    let heading = null;
    while (left.size) {
      const here = [...left].filter((e) => e.u === at || e.v === at);
      if (!here.length) { walk = null; break; } // shouldn't happen: not connected
      let pick = first && here.includes(first) ? first : null;
      first = null;
      if (!pick) {
        const n0 = reach(at, null);
        const safe = here.length === 1 ? here : here.filter((e) => reach(at, e) === n0);
        const opts = safe.length ? safe : here;
        const turn = (e) => { const b = away(e, at); if (b == null || heading == null) return e.i < 0 ? 0.5 : 1; let d = Math.abs(b - heading); if (d > Math.PI) d = 2 * Math.PI - d; return d; };
        pick = opts.sort((x, y) => turn(x) - turn(y))[0];
      }
      left.delete(pick);
      const fwd = pick.u === at;
      walk.push({ e: pick, rev: !fwd });
      const next = fwd ? pick.v : pick.u;
      if (pick.i >= 0) {
        const back = away(pick, next);
        heading = back == null ? null : back + Math.PI; // arriving: the reverse of leaving from the far end
        if (heading > Math.PI) heading -= 2 * Math.PI;
      } else heading = null;
      at = next;
    }
  }
  let network = false;
  if (!walk) {
    // a network: the stretch between junctions under the click, or the longest
    network = true;
    const strandOf = (k) => {
      const out = [{ e: edges[k], rev: false }];
      const used = new Set([k]);
      for (const dir of [1, -1]) {
        let cur = edges[k], at = dir > 0 ? cur.v : cur.u;
        for (;;) {
          if (deg[at] !== 2) break;
          const nx = edges.find((e, j) => e.i >= 0 && !used.has(j) && (e.u === at || e.v === at));
          if (!nx) break;
          used.add(edges.indexOf(nx));
          const fwd = nx.u === at;
          if (dir > 0) out.push({ e: nx, rev: !fwd }); else out.unshift({ e: nx, rev: fwd });
          at = fwd ? nx.v : nx.u;
          cur = nx;
        }
      }
      return out;
    };
    if (clicked >= 0) walk = strandOf(clicked);
    else {
      let best = null, bl = -1;
      const seen = new Set();
      edges.forEach((e, j) => {
        if (e.i < 0 || seen.has(j)) return;
        const s = strandOf(j);
        s.forEach((x) => seen.add(edges.indexOf(x.e)));
        const l = s.reduce((t, x) => t + x.e.len, 0);
        if (l > bl) { bl = l; best = s; }
      });
      walk = best;
    }
    walk = walk.filter((w) => w.e.i >= 0);
    const ends = (w, last) => { const c = parts[w.e.i].coords; return (w.rev !== last) ? c[c.length - 1] : c[0]; };
    if (near && dist(ends(walk[walk.length - 1], true), near) < dist(ends(walk[0], false), near)) walk = walk.reverse().map((w) => ({ e: w.e, rev: !w.rev }));
  }
  // pieces: parts joined directly (and across gaps under JOIN m), else by a routed leg
  const pieces = [];
  let cur = null, pendingGap = 0;
  walk.forEach((w) => {
    if (w.e.i < 0) { pendingGap = w.e.gap; return; }
    const tok = parts[w.e.i].rid + (w.rev ? 'r' : '');
    if (cur && pendingGap < JOIN) cur.seq += `-${tok}`;
    else { cur = { seq: tok }; pieces.push(cur); }
    pendingGap = 0;
  });
  for (const pc of pieces) { pc.coords = stitch(place, pc.seq); pc.a = 0; pc.b = lineLength(pc.coords); }
  const firstPt = pieces[0].coords[0], lastPc = pieces[pieces.length - 1], endPt = lastPc.coords[lastPc.coords.length - 1];
  const loop = dist(firstPt, endPt) < BRIDGE && (!network ? odd.length === 0 : dist(firstPt, endPt) < JOIN);
  let closeGap = false;
  if (loop) {
    const d = dist(firstPt, endPt);
    if (d < JOIN) { if (d > 0.5) { lastPc.coords.push(firstPt.slice()); lastPc.b = lineLength(lastPc.coords); } }
    else closeGap = true;
  }
  const km = pieces.reduce((t, pc) => t + pc.b, 0) / 1000;
  const rode = new Set(walk.map((w) => w.e.i));
  const left = parts.reduce((t, _, i) => t + (rode.has(i) ? 0 : lens[i]), 0) / 1000;
  return { pieces, loop, closeGap, network, left, km };
}

// ---------------------------------------------------------------- near a point
const near = new Map(); // "lon/lat/km/types" -> Promise<places>

/**
 * LIPAS places of `types` within about `km` of [lon, lat] (one small request,
 * names and types only, kept for the session): [{ type, id, name, at }].
 */
export function lipasNear([lon, lat], km, types) {
  const dLat = km / 111, dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
  const box = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((v) => v.toFixed(4));
  const key = `${lon.toFixed(3)}/${lat.toFixed(3)}/${km}/${types.join(',')}`;
  if (near.has(key)) return near.get(key);
  const p = getJson(`${LIPAS_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=lipas:lipas_kaikki_pisteet` +
    '&outputFormat=application/json&count=60&propertyName=id,nimi_fi,tyyppikoodi,x,y' +
    `&CQL_FILTER=${encodeURIComponent(`tyyppikoodi IN (${types.join(',')}) AND BBOX(the_geom,${box.join(',')},'EPSG:4326')`)}`)
    .then((gj) => (gj.features || []).map((f) => f.properties || {}).filter((q) => LIPAS_TYPES[q.tyyppikoodi])
      .map((q) => ({ type: q.tyyppikoodi, id: q.id, name: q.nimi_fi || LIPAS_TYPES[q.tyyppikoodi].name, at: Number.isFinite(q.x) ? tm35ToLonLat(q.x, q.y) : null })));
  p.catch(() => near.delete(key));
  near.set(key, p);
  return p;
}

// ---------------------------------------------------------------- search by name
export const ROUTE_TYPES = Object.keys(LIPAS_TYPES).map(Number).filter((t) => t > 4000 && t < 4800);
export const STOP_TYPES = [301, 302, 304, 202, 206, 205, 204, 203, 3220, 3230];
const found = new Map(); // query|box -> Promise<{routes, stops}>

/**
 * LIPAS routes and stops whose name has `q` in it: routes near `center` (about
 * 80 km) and in all of Finland, stops near it. Three small requests (names and
 * types only), one entry per place, kept for the session.
 */
export function findLipas(q, center, signal) {
  const box = [center[0] - 1.6, center[1] - 0.75, center[0] + 1.6, center[1] + 0.75].map((v) => v.toFixed(1));
  const key = `${q.toLowerCase()}|${box.join(',')}`;
  if (found.has(key)) return found.get(key);
  const like = `nimi_fi ILIKE '%${q.replace(/'/g, "''").replace(/[%_\\]/g, '')}%'`;
  const ask = (layer, types, bbox, count) => getJson(`${LIPAS_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=lipas:${layer}` +
    `&outputFormat=application/json&count=${count}&propertyName=id,nimi_fi,tyyppikoodi,kunta_nimi_fi,x,y` +
    `&CQL_FILTER=${encodeURIComponent(`${like} AND tyyppikoodi IN (${types.join(',')})${bbox ? ` AND BBOX(the_geom,${bbox.join(',')},'EPSG:4326')` : ''}`)}`, signal)
    .then((gj) => gj.features || []);
  const places = (feats, near) => {
    const by = new Map();
    for (const f of feats) {
      const p = f.properties || {};
      if (!LIPAS_TYPES[p.tyyppikoodi] || by.has(p.id)) continue;
      by.set(p.id, { type: p.tyyppikoodi, id: p.id, name: p.nimi_fi || LIPAS_TYPES[p.tyyppikoodi].name, city: p.kunta_nimi_fi || '', typeName: LIPAS_TYPES[p.tyyppikoodi].name, at: Number.isFinite(p.x) ? tm35ToLonLat(p.x, p.y) : null, near });
    }
    return [...by.values()];
  };
  const p = Promise.all([
    ask('lipas_kaikki_reitit', ROUTE_TYPES, box, 300),
    ask('lipas_kaikki_reitit', ROUTE_TYPES, null, 300),
    ask('lipas_kaikki_pisteet', STOP_TYPES, box, 100),
  ]).then(([nearR, allR, nearS]) => {
    const routes = places(nearR, true);
    const have = new Set(routes.map((r) => r.id));
    for (const r of places(allR, false)) if (!have.has(r.id)) routes.push(r);
    return { routes, stops: places(nearS, true) };
  });
  p.catch(() => found.delete(key));
  found.set(key, p);
  return p;
}
