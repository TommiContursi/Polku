// Local original fragments and containment seeds. Seeds are never display geometry.
import { tileBounds, lonLatToTile } from './geo.js';

const id = v => Number.isSafeInteger(v) && v > 0;
const hash = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const point = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
const box = b => Array.isArray(b) && b.length === 4 && point(b.slice(0, 2)) && point(b.slice(2)) && b[0] <= b[2] && b[1] <= b[3];
const types = ['node', 'way', 'relation'];
const integer = v => Number.isSafeInteger(v) && v >= 0;
function requireGeometry(ok) { if (!ok) throw new Error('Invalid OSM geometry'); }

/** Validate the optional schema independently of complete-way schema 1. */
export function validateGeometry(json, tile) {
  requireGeometry(json?.schema === 2 && Array.isArray(json.elements) && Array.isArray(json.tile)
    && json.tile.length === 3 && json.tile[0] === 13 && json.tile.slice(1).every(v => integer(v) && v < 8192)
    && Array.isArray(tile) && tile.length === 3 && json.tile.every((v, i) => v === tile[i]));
  const objects = new Set();
  for (const e of json.elements) {
    requireGeometry(e && types.includes(e.type) && id(e.id) && hash(e.identity) && e.tags && typeof e.tags === 'object'
      && !Array.isArray(e.tags) && Object.values(e.tags).every(v => typeof v === 'string')
      && typeof e.inspection === 'boolean' && typeof e.incomplete === 'boolean'
      && (e.incomplete ? e.bounds === null : box(e.bounds)) && Array.isArray(e.fragments));
    const key = `${e.type}/${e.id}`;
    requireGeometry(!objects.has(key)); objects.add(key);
    if (e.type === 'relation') requireGeometry(integer(e.member_count));
    for (const f of e.fragments) {
      requireGeometry(f && ['node', 'way'].includes(f.type) && id(f.ref) && hash(f.identity) && Array.isArray(f.path));
      if (e.type === 'relation') {
        requireGeometry(f.path.length > 0);
        for (const [i, p] of f.path.entries()) {
          requireGeometry(Array.isArray(p) && p.length === 6 && id(p[0]) && integer(p[1]) && types.includes(p[2])
            && id(p[3]) && typeof p[4] === 'string' && integer(p[5]) && p[1] < p[5]);
          if (i === 0) requireGeometry(p[0] === e.id && p[5] === e.member_count);
          else requireGeometry(f.path[i - 1][2] === 'relation' && f.path[i - 1][3] === p[0]);
        }
        requireGeometry(f.path.at(-1)[2] === f.type && f.path.at(-1)[3] === f.ref);
      } else requireGeometry(f.path.length === 0 && f.type === e.type && f.ref === e.id && f.identity === e.identity);
      if (f.type === 'node') requireGeometry(point(f.point));
      else requireGeometry(Array.isArray(f.nodes) && f.nodes.length >= 2 && f.nodes.every(id)
        && Array.isArray(f.geometry) && f.geometry.length === f.nodes.length && f.geometry.every(point)
        && integer(f.start) && integer(f.node_count) && f.start + f.nodes.length <= f.node_count);
    }
    if (e.area !== undefined) {
      const a = e.area;
      requireGeometry(e.type !== 'node' && a && typeof a.complete === 'boolean' && (box(a.bounds) || !a.complete && a.bounds === null)
        && Array.isArray(a.polygons) && (a.complete || a.polygons.length === 0));
      const polygons = new Set();
      for (const p of a.polygons) {
        requireGeometry(p && hash(p.id) && !polygons.has(p.id) && Array.isArray(p.right) && Array.isArray(p.edges));
        polygons.add(p.id);
        requireGeometry(p.right.every(r => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite) && r[0] >= -90 && r[1] <= 90 && r[0] <= r[1])
          && p.right.every((r, i) => !i || p.right[i - 1][1] <= r[0]));
        const edges = new Set();
        for (const edge of p.edges) {
          requireGeometry(Array.isArray(edge) && edge.length === 3 && integer(edge[0]) && integer(edge[1]) && typeof edge[2] === 'boolean');
          const f = e.fragments[edge[0]], key = `${edge[0]}/${edge[1]}`;
          requireGeometry(f?.type === 'way' && edge[1] + 1 < f.nodes.length && !edges.has(key)
            && f.path.every(m => ['', 'outer', 'inner'].includes(m[4])));
          edges.add(key);
        }
      }
    }
  }
  return json;
}

/** Exact original-ring ray parity, starting at the tile's certified east edge. */
export function containsArea(element, [z, tx, ty], [x, y]) {
  const a = element.area;
  if (!a?.complete) throw new Error('Incomplete OSM area geometry');
  const east = tileBounds(tx, ty, z)[2];
  for (const p of a.polygons) {
    let inside = p.right.some(([lo, hi]) => lo <= y && y < hi);
    for (const [fi, offset] of p.edges) {
      const [a, b] = element.fragments[fi].geometry.slice(offset, offset + 2);
      if ((a[1] > y) !== (b[1] > y)) {
        const at = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
        if (x < at && at <= east) inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

/** Match the existing named-first, then smallest-original-bounds area choice. */
export function selectArea(json, ll) {
  if (json.areas_complete !== true) throw new Error('Incomplete OSM area coverage');
  const candidates = [];
  for (const e of json.elements) {
    if (!e.area) continue;
    const b = e.area.bounds;
    if (!e.area.complete && (!b || ll[0]>=b[0] && ll[0]<=b[2] && ll[1]>=b[1] && ll[1]<=b[3])) throw new Error('Incomplete OSM area geometry');
    if (e.area.complete && containsArea(e,json.tile,ll)) candidates.push(e);
  }
  const size = e => (e.area.bounds[2]-e.area.bounds[0])*(e.area.bounds[3]-e.area.bounds[1]);
  return candidates.sort((a,b)=>!a.tags.name-!b.tags.name || size(a)-size(b))[0] || null;
}

/** Draw real source edges only; tile seeds and clipping-box sides are never lines. */
export function areaOutline(tiles, selected, window) {
  const bounds=selected.area.bounds;
  const clipped=[Math.max(bounds[0],window[0]),Math.max(bounds[1],window[1]),Math.min(bounds[2],window[2]),Math.min(bounds[3],window[3])];
  const [x0,y0]=lonLatToTile(clipped[0],clipped[3],13).map(Math.floor), [x1,y1]=lonLatToTile(clipped[2],clipped[1],13).map(Math.floor);
  const covered=new Set(tiles.filter(t=>t.tile[0]===13 && t.tile[1]>=x0 && t.tile[1]<=x1 && t.tile[2]>=y0 && t.tile[2]<=y1).map(t=>t.tile.join('/')));
  if (covered.size!==(x1-x0+1)*(y1-y0+1)) throw new Error('Incomplete OSM outline window');
  const segments = new Map();
  for (const tile of tiles) {
    if (tile.areas_complete !== true) throw new Error('Incomplete OSM area coverage');
    for (const e of tile.elements) {
      if (e.type!==selected.type || e.id!==selected.id) continue;
      if (e.identity!==selected.identity || !e.area?.complete) throw new Error('Conflicting OSM area geometry');
      for (const p of e.area.polygons) for (const [fi,offset,inner] of p.edges) {
        const f=e.fragments[fi], key=`${f.ref}/${f.start+offset}`, a=f.geometry[offset], b=f.geometry[offset+1];
        const original={identity:f.identity,nodes:f.nodes.slice(offset,offset+2),a,b,inner}, prev=segments.get(key);
        if (prev && (prev.identity!==original.identity || prev.nodes.some((v,i)=>v!==original.nodes[i])
          || prev.a.some((v,i)=>v!==a[i]) || prev.b.some((v,i)=>v!==b[i]))) throw new Error('Conflicting original OSM segment');
        segments.set(key,{...original,inner:prev ? prev.inner && inner : inner});
      }
    }
  }
  const lines=[], outer=[];
  for (const {a,b,inner} of segments.values()) {
    let lo=0, hi=1;
    for (const axis of [0,1]) {
      const delta=b[axis]-a[axis];
      if (!delta) { if(a[axis]<window[axis] || a[axis]>window[axis+2]) hi=-1; }
      else {
        const ts=[(window[axis]-a[axis])/delta,(window[axis+2]-a[axis])/delta].sort((x,y)=>x-y);
        lo=Math.max(lo,ts[0]);hi=Math.min(hi,ts[1]);
      }
    }
    if (lo>=hi) continue;
    const line=[lo,hi].map(t=>a.map((v,i)=>Math.max(window[i],Math.min(window[i+2],v+t*(b[i]-v)))));
    lines.push(line);if(!inner)outer.push(line);
  }
  const b=selected.area.bounds;
  return {lines,outer,whole:b[0]>window[0] && b[1]>window[1] && b[2]<window[2] && b[3]<window[3]};
}
