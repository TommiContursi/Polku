// Traffic & safety layers: things worth avoiding on a ride, run or paddle.
//
//  • Busy roads — Digiroad average daily traffic (vehicles/day), as a heat line
//  • Accidents & incidents — Fintraffic traffic announcements (live)
//  • Road works — Fintraffic, active at the selected departure time
//  • Road conditions — Fintraffic road-weather forecast (slippery, poor), 0–12 h
//  • Ships — live AIS positions (Fintraffic / Digitraffic Marine)
//  • Military areas (OSM) and shooting ranges (LIPAS) live in style.js / lipas.js
//
// The same data is checked against planned routes (see `hazardsAlong`).

import { lonLatToTile, tileBounds, pointSegment, dist } from './geo.js';
import { DIGIROAD_WMS } from './config.js';

const ROAD = 'https://tie.digitraffic.fi';
const MARINE = 'https://meri.digitraffic.fi';
const HEADERS = { 'Digitraffic-User': 'Polku/1.0 (polku.si)' };
const EMPTY = { type: 'FeatureCollection', features: [] };

const get = (url) => fetch(url, { headers: HEADERS }).then((r) => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
});

export const AADT_STEPS = [[800, '#facc15'], [2000, '#fb923c'], [5000, '#ef4444'], [10000, '#991b1b']];
export const aadtColor = (v) => [...AADT_STEPS].reverse().find(([min]) => v >= min)?.[1] || '#facc15';

const CONDITION = {
  POOR_CONDITION: { label: 'Poor driving conditions', color: '#f97316', rank: 1 },
  EXTREMELY_POOR_CONDITION: { label: 'Extremely poor conditions', color: '#7e22ce', rank: 3 },
  VERY_POOR_CONDITION: { label: 'Very poor conditions', color: '#dc2626', rank: 2 },
};
const REASONS = {
  roadCondition: 'road', windCondition: 'wind', precipitationCondition: 'precipitation',
  visibilityCondition: 'visibility', frictionCondition: 'friction', winterSlipperiness: 'winter slipperiness',
};

// Fintraffic messages carry their own text; keep what helps someone on a bike.
function messageProps(f, kind) {
  const p = f.properties || {};
  const a = (p.announcements || [])[0] || {};
  const t = a.timeAndDuration || {};
  return {
    kind,
    id: p.situationId,
    title: (a.title || '').trim(),
    where: (a.location && a.location.description) || '',
    details: (a.features || []).map((x) => (x.quantity != null ? `${x.name} ${x.quantity} ${x.unit || ''}`.trim() : x.name)).join(' · '),
    start: t.startTime || '',
    end: t.endTime || '',
    phases: JSON.stringify((a.roadWorkPhases || []).map((ph) => ph.timeAndDuration || {})),
  };
}

function midpoint(geom) {
  const lines = geom.type === 'LineString' ? [geom.coordinates] : geom.type === 'MultiLineString' ? geom.coordinates : null;
  if (!lines) return geom.type === 'Point' ? geom.coordinates : null;
  const all = lines.flat();
  return all[Math.floor(all.length / 2)];
}

// Is a road work going on at time t (seconds)? Uses phases when given.
function activeAt(props, t) {
  const inRange = (s, e) => (!s || Date.parse(s) / 1000 <= t) && (!e || Date.parse(e) / 1000 >= t);
  const phases = props.phases ? JSON.parse(props.phases) : [];
  if (phases.length) return phases.some((ph) => inRange(ph.startTime, ph.endTime));
  return inRange(props.start, props.end);
}

export class SafetyLayers {
  constructor(map, app) {
    this.map = map;
    this.app = app; // { setData(id, fc), time(): seconds }
    this.on = {};
    this.aadtTiles = new Map(); // z11 tile -> features | Promise
    this.roadworkTiles = new Map(); // z8 tile -> features | Promise
    this.incidents = null;
    this.roadcond = null;
    this.ships = [];
    this.timer = 0;
    map.on('moveend', () => this.schedule());
  }

  configure(on) {
    this.on = { ...on };
    clearInterval(this.shipTimer);
    if (this.on.ships) this.shipTimer = setInterval(() => this.loadShips(), 20000);
    this.schedule(0);
    this.publish();
  }

  schedule(delay = 350) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.update(), delay);
  }

  inFinland() {
    const c = this.map.getCenter();
    return c.lng > 19 && c.lng < 32 && c.lat > 59.4 && c.lat < 70.3;
  }

  update() {
    if (!this.inFinland()) return;
    const z = this.map.getZoom();
    const b = this.map.getBounds();
    const view = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    if (this.on.traffic && z >= 10) this.loadAadt(view);
    if (this.on.roadworks && z >= 7) this.loadRoadworks(view);
    if (this.on.incidents) this.loadIncidents();
    if (this.on.roadcond) this.loadRoadcond();
    if (this.on.ships && z >= 8) this.loadShips();
  }

  // ---------------------------------------------------------------- busy roads
  tilesFor(box, z, max) {
    const [x0, y0] = lonLatToTile(box[0], box[3], z).map(Math.floor);
    const [x1, y1] = lonLatToTile(box[2], box[1], z).map(Math.floor);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > max) return null;
    const out = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([x, y]);
    return out;
  }

  async loadAadt(box, { max = 9, publish = true } = {}) {
    const tiles = this.tilesFor(box, 11, max);
    if (!tiles) return false;
    const jobs = tiles.map(async ([x, y]) => {
      const key = `${x}/${y}`;
      if (this.aadtTiles.has(key)) return this.aadtTiles.get(key);
      const [w, s, e, n] = tileBounds(x, y, 11);
      const url = `${DIGIROAD_WMS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=digiroad:dr_liikennemaara` +
        `&outputFormat=application/json&srsName=EPSG:4326&count=20000&propertyName=arvo,geom` +
        `&cql_filter=${encodeURIComponent(`arvo>=800 AND BBOX(geom,${w},${s},${e},${n},'EPSG:4326')`)}`;
      const p = fetch(url).then((r) => r.json()).then((gj) => {
        const feats = (gj.features || []).filter((f) => f.geometry).map((f) => ({ type: 'Feature', properties: { kind: 'aadt', aadt: f.properties.arvo }, geometry: f.geometry }));
        this.aadtTiles.set(key, feats);
        return feats;
      }).catch(() => { this.aadtTiles.delete(key); return []; });
      this.aadtTiles.set(key, p);
      return p;
    });
    await Promise.all(jobs);
    if (this.aadtTiles.size > 80) this.aadtTiles.delete(this.aadtTiles.keys().next().value);
    if (publish) this.publish();
    return true;
  }

  // ---------------------------------------------------------------- incidents & road works
  async loadIncidents() {
    if (this.incidents && Date.now() - this.incidents.t < 3 * 60 * 1000) return;
    try {
      const gj = await get(`${ROAD}/api/traffic-message/v2/traffic-announcements`);
      const now = Date.now() / 1000;
      const feats = (gj.features || []).filter((f) => f.geometry && f.properties.trafficAnnouncementType !== 'ended')
        .map((f) => ({ type: 'Feature', properties: messageProps(f, 'incident'), geometry: f.geometry }))
        .filter((f) => !f.properties.end || Date.parse(f.properties.end) / 1000 > now);
      this.incidents = { t: Date.now(), feats };
      this.publish();
    } catch { /* keep old */ }
  }

  async loadRoadworks(box, { publish = true } = {}) {
    const tiles = this.tilesFor(box, 8, 6) || [];
    await Promise.all(tiles.map(async ([x, y]) => {
      const key = `${x}/${y}`;
      if (this.roadworkTiles.has(key)) return this.roadworkTiles.get(key);
      const [w, s, e, n] = tileBounds(x, y, 8);
      const p = get(`${ROAD}/api/traffic-message/v2/roadworks?xMin=${w}&xMax=${e}&yMin=${s}&yMax=${n}`)
        .then((gj) => {
          const feats = (gj.features || []).filter((f) => f.geometry).map((f) => ({ type: 'Feature', properties: messageProps(f, 'roadwork'), geometry: f.geometry }));
          this.roadworkTiles.set(key, feats);
          return feats;
        })
        .catch(() => { this.roadworkTiles.delete(key); return []; });
      this.roadworkTiles.set(key, p);
      return p;
    }));
    if (publish) this.publish();
  }

  // ---------------------------------------------------------------- road conditions
  async loadRoadcond() {
    if (this.roadcond && Date.now() - this.roadcond.t < 15 * 60 * 1000) return;
    try {
      const [geo, fc] = await Promise.all([
        this.roadcondGeo || get(`${ROAD}/api/weather/v1/forecast-sections-simple`),
        get(`${ROAD}/api/weather/v1/forecast-sections-simple/forecasts`),
      ]);
      this.roadcondGeo = geo;
      const byId = new Map(fc.forecastSections.map((s) => [s.id, s.forecasts]));
      this.roadcond = { t: Date.now(), geo, byId };
      this.publish();
    } catch { /* keep old */ }
  }

  // forecast step closest to time t (0 h, 2 h, 4 h, 6 h, 12 h)
  conditionAt(forecasts, t) {
    let best = null;
    for (const f of forecasts || []) {
      const d = Math.abs(Date.parse(f.time) / 1000 - t);
      if (!best || d < best.d) best = { d, f };
    }
    return best && best.d < 4 * 3600 ? best.f : null;
  }

  // ---------------------------------------------------------------- ships
  async loadShips() {
    if (!this.on.ships || this.map.getZoom() < 8 || this.loadingShips) return;
    const c = this.map.getCenter();
    const b = this.map.getBounds();
    const r = Math.min(80, Math.max(5, dist([c.lng, c.lat], [b.getEast(), b.getNorth()]) / 1000));
    this.loadingShips = true;
    try {
      const gj = await get(`${MARINE}/api/ais/v1/locations?latitude=${c.lat.toFixed(4)}&longitude=${c.lng.toFixed(4)}&radius=${Math.round(r)}`);
      const now = Date.now();
      this.ships = (gj.features || []).filter((f) => now - (f.properties.timestampExternal || 0) < 20 * 60 * 1000).map((f) => {
        const p = f.properties;
        const heading = p.heading != null && p.heading < 360 ? p.heading : p.cog;
        return { type: 'Feature', properties: { kind: 'ship', mmsi: f.mmsi, sog: p.sog, rot: heading || 0, moving: p.sog > 0.5, age: Math.round((now - p.timestampExternal) / 60000) }, geometry: f.geometry };
      });
      this.publish();
    } catch { /* ignore */ } finally {
      this.loadingShips = false;
    }
  }

  // ---------------------------------------------------------------- output
  allRoadworks() {
    const seen = new Set();
    const out = [];
    for (const v of this.roadworkTiles.values()) {
      if (!Array.isArray(v)) continue;
      for (const f of v) if (!seen.has(f.properties.id)) { seen.add(f.properties.id); out.push(f); }
    }
    return out;
  }

  allAadt() {
    const out = [];
    for (const v of this.aadtTiles.values()) if (Array.isArray(v)) out.push(...v);
    return out;
  }

  roadcondFeatures(t) {
    if (!this.roadcond) return [];
    const out = [];
    for (const f of this.roadcond.geo.features || []) {
      const fc = this.conditionAt(this.roadcond.byId.get(f.id), t);
      if (!fc || !CONDITION[fc.overallRoadCondition]) continue;
      const c = CONDITION[fc.overallRoadCondition];
      const reasons = Object.entries(fc.forecastConditionReason || {}).filter(([k, v]) => k in REASONS && v && !/NORMAL|NO_/.test(v)).map(([k, v]) => `${REASONS[k]}: ${String(v).toLowerCase().replace(/_/g, ' ')}`);
      out.push({ type: 'Feature', properties: { kind: 'roadcond', label: c.label, color: c.color, rank: c.rank, roadTemp: fc.roadTemperature, temp: fc.temperature, reasons: reasons.join(' · '), at: fc.time, forecast: fc.forecastName }, geometry: { type: 'LineString', coordinates: f.geometry.coordinates.map((p) => [p[0], p[1]]) } });
    }
    return out;
  }

  publish() {
    const t = this.app.time();
    const lines = [];
    const points = [];
    if (this.on.incidents && this.incidents) {
      for (const f of this.incidents.feats) {
        lines.push(f);
        const m = midpoint(f.geometry);
        if (m) points.push({ type: 'Feature', properties: { ...f.properties, icon: 'sf-incident' }, geometry: { type: 'Point', coordinates: m } });
      }
    }
    if (this.on.roadworks) {
      for (const f of this.allRoadworks()) {
        if (!activeAt(f.properties, t)) continue;
        lines.push(f);
        const m = midpoint(f.geometry);
        if (m) points.push({ type: 'Feature', properties: { ...f.properties, icon: 'sf-roadwork' }, geometry: { type: 'Point', coordinates: m } });
      }
    }
    if (this.on.roadcond) {
      for (const f of this.roadcondFeatures(t)) {
        lines.push(f);
        const m = midpoint(f.geometry);
        if (m) points.push({ type: 'Feature', properties: { ...f.properties, icon: 'sf-slippery' }, geometry: { type: 'Point', coordinates: m } });
      }
    }
    this.app.setData('sfLines', { type: 'FeatureCollection', features: lines });
    this.app.setData('sfPoints', { type: 'FeatureCollection', features: points });
    this.app.setData('sfAadt', this.on.traffic ? { type: 'FeatureCollection', features: this.allAadt() } : EMPTY);
    this.app.setData('sfShips', this.on.ships ? { type: 'FeatureCollection', features: this.ships } : EMPTY);
  }

  async vessel(mmsi) {
    try { return await get(`${MARINE}/api/ais/v1/vessels/${mmsi}`); } catch { return null; }
  }

  // ---------------------------------------------------------------- route checks
  /**
   * Hazards along a planned route: road works / incidents / poor road
   * conditions within a few tens of metres, busy-road stretches for people on
   * bikes or foot. Loads the data it needs for the route area.
   * @returns {Promise<Array<{at,len,text,lngLat,kind,avoid}>>}
   */
  async hazardsAlong(a, { activity, startSec }) {
    if (!a || !this.inFinland()) return [];
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of a.pts) { box[0] = Math.min(box[0], p[0]); box[1] = Math.min(box[1], p[1]); box[2] = Math.max(box[2], p[0]); box[3] = Math.max(box[3], p[1]); }
    const onWheelsOrFeet = activity !== 'paddle';
    await Promise.all([
      this.loadIncidents(),
      this.loadRoadworks(box, { publish: false }),
      this.loadRoadcond(),
      onWheelsOrFeet ? this.loadAadt(box, { max: 24, publish: false }) : null,
    ]);
    const tAt = a.tAtWind || a.tAt;
    const out = [];
    const index = (feats) => new LineIndex(feats);
    const near = (idx, maxM, pred) => {
      const hits = new Map();
      for (let i = 0; i < a.pts.length; i++) {
        const tags = (a.attr[i] && a.attr[i].tags) || {};
        if (pred && !pred(i, tags)) continue;
        const f = idx.nearest(a.pts[i], maxM);
        if (!f) continue;
        const id = f.properties.id || f.properties.label || 'x';
        if (!hits.has(id)) hits.set(id, { f, i0: i, i1: i });
        else hits.get(id).i1 = i;
      }
      return [...hits.values()];
    };
    // avoid circle where the route actually meets the hazard, sized to the stretch
    const avoidAt = (h) => {
      const mid = Math.round((h.i0 + h.i1) / 2);
      return { ll: a.pts[mid], r: Math.max(40, Math.min(220, (a.along[h.i1] - a.along[h.i0]) / 2 + 30)) };
    };
    const roadsOnly = (i, tags) => !tags.highway || !['path', 'footway', 'cycleway', 'bridleway', 'steps', 'track', 'pedestrian'].includes(tags.highway);

    // road works active when you get there
    const works = this.allRoadworks().filter((f) => activeAt(f.properties, startSec + (tAt[a.pts.length - 1] || 0) / 2));
    for (const h of near(index(works), 30)) {
      const p = h.f.properties;
      out.push({ kind: 'roadwork', at: a.along[h.i0], len: a.along[h.i1] - a.along[h.i0], lngLat: a.pts[h.i0], text: `Road works: ${shortTitle(p.title)}${p.details ? ` — ${p.details}` : ''}`, avoid: avoidAt(h) });
    }
    for (const h of near(index(this.incidents ? this.incidents.feats : []), 50)) {
      const p = h.f.properties;
      out.push({ kind: 'incident', at: a.along[h.i0], len: a.along[h.i1] - a.along[h.i0], lngLat: a.pts[h.i0], text: `Traffic incident: ${shortTitle(p.title)}`, avoid: avoidAt(h) });
    }
    // road conditions at arrival time (main roads only)
    if (this.roadcond && onWheelsOrFeet) {
      const t = startSec + (tAt[Math.floor(a.pts.length / 2)] || 0);
      for (const h of near(index(this.roadcondFeatures(t)), 25, roadsOnly)) {
        const p = h.f.properties;
        out.push({ kind: 'roadcond', at: a.along[h.i0], len: a.along[h.i1] - a.along[h.i0], lngLat: a.pts[h.i0], text: `${p.label}${p.reasons ? ` (${p.reasons})` : ''}, road ${Math.round(p.roadTemp)} °C`, avoid: avoidAt(h) });
      }
    }
    // busy roads: stretches on roads with lots of cars
    if (onWheelsOrFeet) {
      const idx = new LineIndex(this.allAadt());
      let s = -1, peak = 0;
      const flush = (e) => {
        if (s >= 0 && a.along[e] - a.along[s] >= 150) {
          out.push({ kind: 'busy', at: a.along[s], len: a.along[e] - a.along[s], lngLat: a.pts[s], text: `Busy road, about ${fmtAadt(peak)} vehicles a day`, avoid: avoidAt({ i0: s, i1: e }) });
        }
        s = -1; peak = 0;
      };
      for (let i = 0; i < a.pts.length; i++) {
        const tags = (a.attr[i] && a.attr[i].tags) || {};
        const f = roadsOnly(i, tags) ? idx.nearest(a.pts[i], 12) : null;
        const v = f ? f.properties.aadt : 0;
        if (v >= 3000) { if (s < 0) s = i; peak = Math.max(peak, v); } else flush(i);
      }
      flush(a.pts.length - 1);
    }
    return out.sort((x, y) => x.at - y.at);
  }
}

const shortTitle = (t) => (t || '').replace(/\.\s*$/, '').replace(/\s+/g, ' ').slice(0, 90);
export const fmtAadt = (v) => (Math.round(v / 100) * 100).toLocaleString('fi-FI');

// Coarse grid index over line segments for "is the route near this?" queries.
class LineIndex {
  constructor(features, cell = 0.004) {
    this.cell = cell;
    this.grid = new Map();
    for (const f of features) {
      const g = f.geometry;
      const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : g.type === 'Point' ? [[g.coordinates, g.coordinates]] : [];
      for (const line of lines) {
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1], b = line[i];
          const x0 = Math.floor(Math.min(a[0], b[0]) / cell), x1 = Math.floor(Math.max(a[0], b[0]) / cell);
          const y0 = Math.floor(Math.min(a[1], b[1]) / cell), y1 = Math.floor(Math.max(a[1], b[1]) / cell);
          for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
            const k = `${x},${y}`;
            if (!this.grid.has(k)) this.grid.set(k, []);
            this.grid.get(k).push([a, b, f]);
          }
        }
      }
    }
  }

  nearest(p, maxM) {
    const cx = Math.floor(p[0] / this.cell), cy = Math.floor(p[1] / this.cell);
    let best = null, bd = maxM;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const [a, b, f] of this.grid.get(`${cx + dx},${cy + dy}`) || []) {
        const d = pointSegment(p, a, b).d;
        if (d <= bd) { bd = d; best = f; }
      }
    }
    return best;
  }
}
