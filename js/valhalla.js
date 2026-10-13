// Valhalla on the FOSSGIS servers (the routing openstreetmap.org itself uses):
// Polku's stand-in when brouter.de asks for a pause. Free and keyless; the
// terms are at most one request a second, no heavy use, and attribution with
// a "fix the map" link (the planner's Heads-up shows it next to such legs).
// Answers are translated into the OSM-style way tags the analysis reads.

import { request } from './net.js';

export const VALHALLA = 'https://valhalla1.openstreetmap.de';
export const FIX_THE_MAP = 'https://www.openstreetmap.org/fixthemap';

// BRouter profile → Valhalla costing (paddling has no stand-in: Valhalla doesn't route on water)
const COSTING = {
  mtb: ['bicycle', { bicycle_type: 'Mountain', avoid_bad_surfaces: 0 }],
  gravel: ['bicycle', { bicycle_type: 'Cross', avoid_bad_surfaces: 0.25 }],
  'fastbike-lowtraffic': ['bicycle', { bicycle_type: 'Road', avoid_bad_surfaces: 0.9 }],
  'hiking-mountain': ['pedestrian', { max_hiking_difficulty: 3 }],
};
export const valhallaCovers = (profile) => !!COSTING[profile];

const USE = {
  cycleway: 'cycleway', mountain_bike: 'path', footway: 'footway', sidewalk: 'footway', pedestrian: 'pedestrian',
  pedestrian_crossing: 'footway', steps: 'steps', elevator: 'steps', path: 'path', track: 'track', bridleway: 'bridleway',
  living_street: 'living_street', service_road: 'service', driveway: 'service', alley: 'service', parking_aisle: 'service',
  emergency_access: 'service', drive_through: 'service', culdesac: 'residential',
};
const ROAD_CLASS = {
  motorway: 'motorway', trunk: 'trunk', primary: 'primary', secondary: 'secondary', tertiary: 'tertiary',
  unclassified: 'unclassified', residential: 'residential', service_other: 'service',
};
const SURFACE = { paved_smooth: 'asphalt', paved: 'asphalt', paved_rough: 'paving_stones', compacted: 'compacted', dirt: 'dirt', gravel: 'gravel', path: 'ground', impassable: 'mud' };
const SAC = ['', 'hiking', 'mountain_hiking', 'demanding_mountain_hiking', 'alpine_hiking', 'demanding_alpine_hiking', 'difficult_alpine_hiking'];

function tagsOf(e) {
  const t = { highway: USE[e.use] || ROAD_CLASS[e.road_class] || 'road' };
  if (SURFACE[e.surface]) t.surface = SURFACE[e.surface];
  if (e.names && e.names.length) t.name = e.names[0];
  if (e.sac_scale) t.sac_scale = SAC[e.sac_scale] || 'hiking';
  return t;
}

function decode6(str) {
  const out = [];
  let i = 0, lat = 0, lon = 0;
  const dec = () => {
    let r = 0, s = 0, b;
    do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
    return r & 1 ? ~(r >> 1) : r >> 1;
  };
  while (i < str.length) { lat += dec(); lon += dec(); out.push([lon / 1e6, lat / 1e6]); }
  return out;
}

// routes go around places to avoid: each circle as a 12-sided polygon
const excludes = (nogos) => (nogos || []).map((n) => {
  const k = Math.cos((n.ll[1] * Math.PI) / 180);
  return Array.from({ length: 13 }, (_, j) => {
    const a = (j / 12) * Math.PI * 2;
    return [+(n.ll[0] + (Math.cos(a) * n.r) / (111195 * k)).toFixed(6), +(n.ll[1] + (Math.sin(a) * n.r) / 111195).toFixed(6)];
  });
});

/**
 * Route points[0] → … → points[n]: one result per leg, { coords, tags, portage, provider }.
 * Two calls: the route, then the way attributes along it (without those the
 * legs still come back, just with unknown surfaces).
 */
export async function valhallaRoute(points, profile, signal, nogos = []) {
  const [costing, options] = COSTING[profile];
  const base = { costing, costing_options: { [costing]: options }, ...(nogos.length ? { exclude_polygons: excludes(nogos) } : {}) };
  const body = { ...base, locations: points.map(([lon, lat]) => ({ lon, lat })), directions_type: 'none', shape_format: 'polyline6' };
  const res = await request('valhalla', `${VALHALLA}/route?json=${encodeURIComponent(JSON.stringify(body))}`, { signal });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.trip) throw new Error(d.error || `Valhalla ${res.status}`);
  const legs = d.trip.legs.map((l) => decode6(l.shape));
  if (legs.length !== points.length - 1) throw new Error('Valhalla answered a different number of legs');
  // the legs end to end, then which edge each stretch lies on
  const all = [], off = [];
  legs.forEach((c, k) => { off.push(Math.max(0, all.length - 1)); all.push(...(k ? c.slice(1) : c)); });
  const seg = new Array(Math.max(0, all.length - 1)).fill(null);
  try {
    const ta = await request('valhalla', `${VALHALLA}/trace_attributes`, {
      method: 'POST', signal, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, // a "simple" request: no preflight
      body: JSON.stringify({
        ...base, shape: all.map(([lon, lat]) => ({ lon, lat })), shape_match: 'edge_walk',
        filters: { attributes: ['edge.use', 'edge.road_class', 'edge.surface', 'edge.names', 'edge.sac_scale', 'edge.begin_shape_index', 'edge.end_shape_index'], action: 'include' },
      }),
    });
    const a = await ta.json();
    for (const e of a.edges || []) {
      const t = tagsOf(e);
      for (let j = e.begin_shape_index; j < e.end_shape_index && j < seg.length; j++) seg[j] = t;
    }
  } catch (e) {
    if (e.name === 'AbortError') throw e; // otherwise: the route without way tags
  }
  return legs.map((c, k) => ({
    coords: c.length > 1 ? c : [c[0], c[0]],
    tags: c.length > 1 ? seg.slice(off[k], off[k] + c.length - 1).map((t) => t || {}) : [{}],
    portage: [],
    provider: 'valhalla',
  }));
}
