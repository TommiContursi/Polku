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
import { DIGIROAD_WMS, isWater } from './config.js';
import { openModal } from './modal.js';
import { h, icon } from './ui.js';
import { compass } from './geo.js';
import { request } from './net.js';

// AIS ship type → group (colour on the map, label in the card)
const SHIP_GROUPS = [
  [[60, 69], 'Passenger', '#2563eb'], [[70, 79], 'Cargo', '#16a34a'], [[80, 89], 'Tanker', '#dc2626'],
  [[40, 49], 'High-speed craft', '#0891b2'], [[36, 36], 'Sailing', '#7c3aed'], [[37, 37], 'Pleasure craft', '#a855f7'],
  [[30, 30], 'Fishing', '#92400e'], [[31, 32], 'Towing', '#ea580c'], [[52, 52], 'Tug', '#ea580c'],
  [[50, 51], 'Pilot / rescue', '#f59e0b'], [[53, 59], 'Service vessel', '#f59e0b'], [[33, 35], 'Dredger / diving / military', '#475569'],
];
export function shipGroup(type) {
  const g = type != null && SHIP_GROUPS.find(([[a, b]]) => type >= a && type <= b);
  return g ? { label: g[1], color: g[2] } : { label: 'Vessel', color: '#334155' };
}
const NAV_STATUS = ['Under way (engine)', 'At anchor', 'Not under command', 'Restricted manoeuvrability', 'Constrained by draught', 'Moored', 'Aground', 'Fishing', 'Under way (sailing)'];
const FLAGS = { 230: 'Finland', 265: 'Sweden', 266: 'Sweden', 276: 'Estonia', 275: 'Latvia', 277: 'Lithuania', 211: 'Germany', 218: 'Germany', 219: 'Denmark', 220: 'Denmark', 257: 'Norway', 258: 'Norway', 259: 'Norway', 261: 'Poland', 273: 'Russia', 244: 'Netherlands', 245: 'Netherlands', 246: 'Netherlands', 235: 'United Kingdom', 232: 'United Kingdom', 209: 'Cyprus', 210: 'Cyprus', 212: 'Cyprus', 215: 'Malta', 229: 'Malta', 248: 'Malta', 249: 'Malta', 256: 'Malta', 636: 'Liberia', 538: 'Marshall Islands', 351: 'Panama', 352: 'Panama', 353: 'Panama', 354: 'Panama', 355: 'Panama', 356: 'Panama', 357: 'Panama', 370: 'Panama', 371: 'Panama', 372: 'Panama', 373: 'Panama', 477: 'Hong Kong', 563: 'Singapore', 564: 'Singapore', 565: 'Singapore', 305: 'Antigua & Barbuda', 304: 'Antigua & Barbuda', 255: 'Portugal (Madeira)', 236: 'Gibraltar', 314: 'Barbados', 341: 'St Kitts & Nevis', 375: 'St Vincent', 376: 'St Vincent', 377: 'St Vincent', 518: 'Cook Islands' };
// AIS ETA bits: month 19–16, day 15–11, hour 10–6, minute 5–0 (UTC)
function etaText(eta) {
  if (!eta) return '';
  const mo = (eta >> 16) & 15, d = (eta >> 11) & 31, hh = (eta >> 6) & 31, mm = eta & 63;
  if (!mo || !d || hh > 23 || mm > 59) return '';
  const now = new Date();
  let t = new Date(Date.UTC(now.getUTCFullYear(), mo - 1, d, hh, mm));
  if (t < now - 30 * 864e5) t = new Date(Date.UTC(now.getUTCFullYear() + 1, mo - 1, d, hh, mm)); // around new year
  // crews often leave an old ETA in the transponder: only show plausible ones
  if (t < now - 864e5 || t > now.getTime() + 45 * 864e5) return '';
  return t.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ROAD = 'https://tie.digitraffic.fi';
const MARINE = 'https://meri.digitraffic.fi';
const HEADERS = { 'Digitraffic-User': 'Polku/1.0 (polku.si)' };
const EMPTY = { type: 'FeatureCollection', features: [] };

const get = (url) => request('digitraffic', url, { headers: HEADERS }).then((r) => {
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
    this.roadworkTime = new Map(); // z8 tile -> when it answered (ms)
    this.incidents = null;
    this.roadcond = null;
    this.ships = [];
    this.tracks = new Map(); // mmsi -> [[lon, lat, ms], ...] seen this session
    this.meta = new Map(); // mmsi -> vessel metadata
    this.selected = null;
    this.follow = false;
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

  inFinland(ll = this.map.getCenter().toArray()) {
    return inFinland(ll);
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
      const p = request('digiroad', url).then((r) => r.json()).then((gj) => {
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

  // false when a tile of the box didn't answer
  async loadRoadworks(box, { publish = true } = {}) {
    const tiles = this.tilesFor(box, 8, 6) || [];
    const got = await Promise.all(tiles.map(async ([x, y]) => {
      const key = `${x}/${y}`;
      if (this.roadworkTiles.has(key)) return this.roadworkTiles.get(key);
      const [w, s, e, n] = tileBounds(x, y, 8);
      const p = get(`${ROAD}/api/traffic-message/v2/roadworks?xMin=${w}&xMax=${e}&yMin=${s}&yMax=${n}`)
        .then((gj) => {
          const feats = (gj.features || []).filter((f) => f.geometry).map((f) => ({ type: 'Feature', properties: messageProps(f, 'roadwork'), geometry: f.geometry }));
          this.roadworkTiles.set(key, feats);
          this.roadworkTime.set(key, Date.now());
          return feats;
        })
        .catch(() => { this.roadworkTiles.delete(key); return null; });
      this.roadworkTiles.set(key, p);
      return p;
    }));
    if (publish) this.publish();
    return !got.includes(null);
  }
  // when the box's road works were fetched (ms), one a tile
  roadworkAt(box) {
    return (this.tilesFor(box, 8, 6) || []).map(([x, y]) => this.roadworkTime.get(`${x}/${y}`)).filter(Boolean);
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
    // the view's middle to about a kilometre, and a kilometre more round it: while the map
    // follows you, the middle is where you are, and that isn't sent
    const lat = +c.lat.toFixed(2), lon = +c.lng.toFixed(2);
    const r = Math.min(80, Math.max(5, dist([lon, lat], [b.getEast(), b.getNorth()]) / 1000 + 1));
    this.loadingShips = true;
    try {
      if (!this.metaLoaded) this.loadMeta();
      const gj = await get(`${MARINE}/api/ais/v1/locations?latitude=${lat}&longitude=${lon}&radius=${Math.round(r)}`);
      const now = Date.now();
      this.ships = (gj.features || []).filter((f) => now - (f.properties.timestampExternal || 0) < 20 * 60 * 1000).map((f) => {
        const p = f.properties;
        const heading = p.heading != null && p.heading < 360 ? p.heading : p.cog;
        // trail: remember every new position while the map is open (Digitraffic has no history API)
        const tr = this.tracks.get(f.mmsi) || [];
        const last = tr[tr.length - 1];
        const ll = f.geometry.coordinates;
        if (!last || dist(last, ll) > 15) tr.push([ll[0], ll[1], p.timestampExternal]);
        while (tr.length > 180 || (tr.length && now - tr[0][2] > 3 * 3600 * 1000)) tr.shift();
        this.tracks.set(f.mmsi, tr);
        return { type: 'Feature', properties: { kind: 'ship', mmsi: f.mmsi, sog: p.sog, cog: p.cog, heading, navStat: p.navStat, rot: heading || 0, moving: p.sog > 0.5, ts: p.timestampExternal, age: Math.round((now - p.timestampExternal) / 60000) }, geometry: f.geometry };
      });
      this.publish();
      if (this.follow && this.selected) {
        const s = this.ships.find((x) => x.properties.mmsi === this.selected);
        if (s) this.map.easeTo({ center: s.geometry.coordinates, duration: 800 });
      }
      if (this.onShipsUpdate) this.onShipsUpdate();
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
    this.app.setData('sfShips', this.on.ships ? { type: 'FeatureCollection', features: this.shipFeatures() } : EMPTY);
    this.app.setData('sfShipTrails', this.on.ships ? { type: 'FeatureCollection', features: this.shipTrails() } : EMPTY);
  }

  async vessel(mmsi) {
    if (this.meta.has(mmsi) && this.meta.get(mmsi).full) return this.meta.get(mmsi);
    try {
      const v = await get(`${MARINE}/api/ais/v1/vessels/${mmsi}`);
      v.full = true;
      this.meta.set(mmsi, v);
      return v;
    } catch { return this.meta.get(mmsi) || null; }
  }

  // Names and types of active vessels, once per session (small payload).
  async loadMeta() {
    this.metaLoaded = true;
    try {
      const list = await get(`${MARINE}/api/ais/v1/vessels`);
      for (const v of list) if (!this.meta.has(v.mmsi)) this.meta.set(v.mmsi, v);
      this.publish();
    } catch { this.metaLoaded = false; }
  }

  shipFeatures() {
    return this.ships.map((f) => {
      const m = this.meta.get(f.properties.mmsi) || {};
      const g = shipGroup(m.shipType);
      return { ...f, properties: { ...f.properties, name: m.name || '', color: g.color, group: g.label, selected: f.properties.mmsi === this.selected } };
    });
  }

  // Trails seen this session + where each moving ship is in 10 minutes.
  shipTrails() {
    const out = [];
    for (const f of this.ships) {
      const p = f.properties;
      const m = this.meta.get(p.mmsi) || {};
      const color = shipGroup(m.shipType).color;
      const tr = this.tracks.get(p.mmsi);
      if (tr && tr.length > 1) out.push({ type: 'Feature', properties: { kind: 'trail', color, selected: p.mmsi === this.selected }, geometry: { type: 'LineString', coordinates: tr.map((q) => [q[0], q[1]]) } });
      if (p.moving && p.cog != null && p.cog < 360) {
        const metres = p.sog * 1852 * (10 / 60);
        const c = f.geometry.coordinates;
        const b = (p.cog * Math.PI) / 180;
        const k = Math.cos((c[1] * Math.PI) / 180);
        out.push({ type: 'Feature', properties: { kind: 'vector', color }, geometry: { type: 'LineString', coordinates: [c, [c[0] + (Math.sin(b) * metres) / (111195 * k), c[1] + (Math.cos(b) * metres) / 111195]] } });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- ship card
  async openShip(mmsi) {
    this.selected = mmsi;
    this.publish();
    const v = (await this.vessel(mmsi)) || {};
    let calls = [];
    try {
      const pc = await get(`${MARINE}/api/port-call/v1/port-calls?mmsi=${mmsi}`);
      calls = (pc.portCalls || []).slice(0, 3);
    } catch { /* none */ }
    const g = shipGroup(v.shipType);
    const flag = FLAGS[String(mmsi).slice(0, 3)] || '';
    const len = (v.referencePointA || 0) + (v.referencePointB || 0);
    const beam = (v.referencePointC || 0) + (v.referencePointD || 0);
    let render = () => {};
    openModal({ title: v.name || `MMSI ${mmsi}`, subtitle: [g.label, flag].filter(Boolean).join(' · '), card: true, onClose: () => { this.selected = null; this.follow = false; this.onShipsUpdate = null; this.publish(); } }, (body) => {
      const live = h('div', { class: 'ship-live' });
      const followBtn = h('button', { type: 'button', class: 'btn', onclick: () => { this.follow = !this.follow; followBtn.setAttribute('aria-pressed', String(this.follow)); followBtn.textContent = this.follow ? 'Following' : 'Follow on map'; if (this.follow) this.loadShips(); } }, 'Follow on map');
      const row = (k, val) => (val ? h('div', { class: 'insp-row' }, h('span', {}, k), h('b', {}, val)) : null);
      render = () => {
        const f = this.ships.find((x) => x.properties.mmsi === mmsi);
        live.innerHTML = '';
        if (!f) { live.append(h('p', { class: 'note' }, 'Out of view or no recent position.')); return; }
        const p = f.properties;
        const tr = this.tracks.get(mmsi) || [];
        live.append(
          row('Speed', `${(p.sog || 0).toFixed(1)} kn (${((p.sog || 0) * 1.852).toFixed(1)} km/h)`),
          row('Course', p.cog != null && p.cog < 360 ? `${Math.round(p.cog)}° ${compass(p.cog)}` : ''),
          row('Status', NAV_STATUS[p.navStat] || ''),
          row('Position', `${p.age} min ago`),
          tr.length > 1 ? row('Trail', `${tr.length} positions since you opened the map`) : null,
        );
      };
      render();
      this.onShipsUpdate = render;
      body.append(
        live,
        h('div', { class: 'ship-static' },
          row('Destination', v.destination ? v.destination.trim() : ''),
          row('ETA', etaText(v.eta)),
          row('Size', len ? `${len} × ${beam} m` : ''),
          row('Draught', v.draught ? `${(v.draught / 10).toFixed(1)} m` : ''),
          row('Call sign', v.callSign || ''),
          row('IMO', v.imo ? String(v.imo) : ''),
          row('MMSI', String(mmsi)),
          ...calls.map((c) => row(`Port call ${c.portToVisit || ''}`, [c.portAreaDetails && c.portAreaDetails[0] && c.portAreaDetails[0].berthName, c.portAreaDetails && c.portAreaDetails[0] && c.portAreaDetails[0].eta ? `ETA ${new Date(c.portAreaDetails[0].eta).toLocaleString([], { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''].filter(Boolean).join(' · ')))),
        h('p', { class: 'insp-info' }, 'Dashed line: where it will be in 10 minutes at this speed. Big ships can’t stop or turn quickly — cross fairways fast and well ahead of them.'),
        h('div', { class: 'insp-actions' }, followBtn,
          h('a', { class: 'link', href: `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`, target: '_blank', rel: 'noopener', html: `MarineTraffic ${icon('external', 13)}` }),
          h('a', { class: 'link', href: `https://www.vesselfinder.com/?mmsi=${mmsi}`, target: '_blank', rel: 'noopener', html: `VesselFinder ${icon('external', 13)}` })),
      );
    });
  }

  // ---------------------------------------------------------------- route checks
  /**
   * Hazards along a planned route: road works / incidents / poor road
   * conditions within a few tens of metres, busy-road stretches for people on
   * bikes or foot. Loads the data it needs for the route area.
   * @returns {Promise<Array<{at,len,text,lngLat,kind,avoid}>>}
   */
  async hazardsAlong(a, { activity, startSec }) {
    // the route's own place and each stretch's own sport, whatever the map shows (#71)
    if (!a || !a.pts.some((p) => this.inFinland(p))) return [];
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of a.pts) { box[0] = Math.min(box[0], p[0]); box[1] = Math.min(box[1], p[1]); box[2] = Math.max(box[2], p[0]); box[3] = Math.max(box[3], p[1]); }
    const landAt = (i) => !isWater((a.attr[i] && a.attr[i].sport) || activity);
    const onWheelsOrFeet = a.pts.some((_, i) => landAt(i));
    const [, worksIn] = await Promise.all([
      this.loadIncidents(),
      this.loadRoadworks(box, { publish: false }),
      this.loadRoadcond(),
      onWheelsOrFeet ? this.loadAadt(box, { max: 24, publish: false }) : null,
    ]);
    // no answer about road works or incidents: not checked (25d part 2), never "nothing found"
    if (!this.incidents || worksIn === false) throw new Error('Fintraffic didn’t answer');
    // where each comes from: live with the time Fintraffic answered, or an estimate (25d part 2)
    const live = { kind: 'live', by: 'Fintraffic', at: Math.min(this.incidents.t, ...this.roadworkAt(box)) };
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
    const roadsOnly = (i, tags) => landAt(i) && (!tags.highway || !['path', 'footway', 'cycleway', 'bridleway', 'steps', 'track', 'pedestrian'].includes(tags.highway));

    // road works active when you get there
    const works = this.allRoadworks().filter((f) => activeAt(f.properties, startSec + (tAt[a.pts.length - 1] || 0) / 2));
    for (const h of near(index(works), 30)) {
      const p = h.f.properties;
      out.push({ kind: 'roadwork', at: a.along[h.i0], len: a.along[h.i1] - a.along[h.i0], lngLat: a.pts[h.i0], text: `Road works: ${shortTitle(p.title)}${p.details ? ` — ${p.details}` : ''}`, avoid: avoidAt(h), tier: 'read', src: live });
    }
    for (const h of near(index(this.incidents ? this.incidents.feats : []), 50)) {
      const p = h.f.properties;
      out.push({ kind: 'incident', at: a.along[h.i0], len: a.along[h.i1] - a.along[h.i0], lngLat: a.pts[h.i0], text: `Traffic incident: ${shortTitle(p.title)}`, avoid: avoidAt(h), tier: 'read', src: live });
    }
    // road conditions at arrival time (main roads only)
    if (this.roadcond && onWheelsOrFeet) {
      const t = startSec + (tAt[Math.floor(a.pts.length / 2)] || 0);
      for (const h of near(index(this.roadcondFeatures(t)), 25, roadsOnly)) {
        const p = h.f.properties;
        out.push({ kind: 'roadcond', at: a.along[h.i0], len: a.along[h.i1] - a.along[h.i0], lngLat: a.pts[h.i0], text: `${p.label}${p.reasons ? ` (${p.reasons})` : ''}, road ${Math.round(p.roadTemp)} °C`, avoid: avoidAt(h), tier: 'read', src: { kind: 'estimate', by: 'Fintraffic’s road weather' } });
      }
    }
    // busy roads: stretches on roads with lots of cars
    if (onWheelsOrFeet) {
      const idx = new LineIndex(this.allAadt());
      let s = -1, peak = 0;
      const flush = (e) => {
        if (s >= 0 && a.along[e] - a.along[s] >= 150) {
          out.push({ kind: 'busy', at: a.along[s], len: a.along[e] - a.along[s], lngLat: a.pts[s], text: `Busy road, about ${fmtAadt(peak)} vehicles a day`, note: 'Cars pass close and fast. Keep to the edge, or look for a quieter road or a cycle path alongside.', avoid: avoidAt({ i0: s, i1: e }), tier: 'look', src: { kind: 'estimate', by: 'Fintraffic’s yearly counts' } });
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
    out.answeredAt = live.at; // when Fintraffic answered (What Polku looked at says so)
    return out.sort((x, y) => x.at - y.at);
  }
}

/** Fintraffic's data covers Finland (roughly: the box around it). */
export const inFinland = ([lng, lat]) => lng > 19 && lng < 32 && lat > 59.4 && lat < 70.3;

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
