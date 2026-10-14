// Nautical chart layer ("merenkulkumerkit"): aids to navigation, lights and
// light sectors, fairway areas, navigation lines with swept depths, speed
// limit / restriction areas and waterway signs from the Finnish Transport
// Infrastructure Agency (Väylävirasto) open WFS, plus faults in aids to
// navigation from Digitraffic Marine. Sea areas and lakes alike.

import { lonLatToTile, tileBounds } from './geo.js';
import { request } from './net.js';

const WFS = 'https://avoinapi.vaylapilvi.fi/vaylatiedot/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326';
const Z = 10; // cache tiles (~20 × 10 km at 60°N)
const EMPTY = { type: 'FeatureCollection', features: [] };

// navigointilajikoodi → IALA region A mark (Finland)
export const NAV_KIND = { 1: 'port', 2: 'starboard', 3: 'north', 4: 'south', 5: 'west', 6: 'east', 7: 'danger', 8: 'safe', 9: 'special' };
export const NAV_TEXT = {
  port: 'Port-hand lateral (keep it on your left going in)',
  starboard: 'Starboard-hand lateral (keep it on your right going in)',
  north: 'North cardinal — pass north of it', south: 'South cardinal — pass south of it',
  west: 'West cardinal — pass west of it', east: 'East cardinal — pass east of it',
  danger: 'Isolated danger — rock or shoal, don’t pass close', safe: 'Safe water mark', special: 'Special mark',
};
const LIGHT_TYPES = new Set(['Sektoriloisto', 'Merimajakka', 'Apuloisto', 'Suuntaloisto', 'Tunnusmajakka', 'Loisto']);
const SECTOR_COLOR = { p: '#dc2626', vi: '#16a34a', v: '#facc15', k: '#f59e0b' }; // red, green, white (drawn yellow), yellow

const LAYERS = {
  marks: 'turvalaitteet_uusi',
  lights: 'loistot_uusi',
  sectors: 'valosektorit_uusi',
  lines: 'navigointilinjat_uusi',
  areas: 'vaylaalueet_uusi',
  speed: 'vesivaylien_nopeusrajoitusalueet',
  restrict: 'vesivaylien_muut_rajoitusalueet',
  signs: 'vesiliikennemerkit_uusi',
};

// Väylävirasto tiles, shared by the chart layer and the paddling router (water.js):
// "layer/x/y" -> features, or the promise of them
const TILES = new Map();
function loadTile(key, x, y, onLoad) {
  const id = `${key}/${x}/${y}`;
  if (TILES.has(id)) { const v = TILES.get(id); return Array.isArray(v) ? Promise.resolve(v) : v; }
  const [w, s, e, n] = tileBounds(x, y, Z);
  const url = `${WFS}&typeNames=vesivaylatiedot:${LAYERS[key]}&count=10000&bbox=${s},${w},${n},${e},urn:ogc:def:crs:EPSG::4326`;
  const p = request('vayla', url).then((r) => r.json()).then((gj) => {
    const list = (gj.features || []).filter((f) => f.geometry);
    TILES.set(id, list);
    if (onLoad) onLoad();
    return list;
  });
  p.catch(() => TILES.delete(id));
  TILES.set(id, p);
  return p;
}

/**
 * Fairway areas and danger marks in a box, for the paddling router: at most
 * `max` z10 tiles (about 20 × 10 km each), else null (too big to ask for).
 */
export async function waterwaysIn([w, s, e, n], max = 24) {
  const [x0, y0] = lonLatToTile(w, n, Z).map(Math.floor);
  const [x1, y1] = lonLatToTile(e, s, Z).map(Math.floor);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > max) return null;
  const jobs = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push(loadTile('areas', x, y), loadTile('marks', x, y));
  const got = await Promise.all(jobs);
  const seen = new Set(), areas = [], marks = [];
  got.forEach((list, k) => {
    for (const f of list) {
      const fid = f.id || JSON.stringify(f.geometry.coordinates).slice(0, 60);
      if (seen.has(fid)) continue;
      seen.add(fid);
      (k % 2 ? marks : areas).push(f);
    }
  });
  return {
    // shipping lanes (design draught from 4.5 m), harbour basins, the rest (small-boat routes)
    fairways: areas.map((f) => {
      const p = f.properties, draught = +p.mitoitussyvays || 0;
      const cls = /satama/i.test(p.tyyppi || '') ? 'harbour' : draught >= 4.5 ? 'ship' : 'small';
      return { type: 'Feature', properties: { cls, draught, name: cleanName(p.vaylan_nimi) }, geometry: f.geometry };
    }),
    // isolated danger and cardinal marks: a rock or shoal beside them (cardinals: on the side they don't name)
    marks: marks.map((f) => {
      const p = f.properties, kind = NAV_KIND[p.navigointilajikoodi];
      if (!['danger', 'north', 'south', 'east', 'west'].includes(kind)) return null;
      const c = f.geometry.type === 'MultiPoint' ? f.geometry.coordinates[0] : f.geometry.coordinates;
      return { type: 'Feature', properties: { kind, name: p.nimifi || '' }, geometry: { type: 'Point', coordinates: c } };
    }).filter(Boolean),
  };
}

// Which icon a mark gets on the map.
function markIcon(p) {
  const t = p.turvalaitetyyppifi || '';
  if (t === 'Merimajakka' || t === 'Tunnusmajakka') return 'nm-lighthouse';
  if (LIGHT_TYPES.has(t)) return 'nm-light';
  if (t === 'Linjamerkki') return 'nm-leading';
  if (t === 'Kummeli') return 'nm-cairn';
  if (t === 'Tutkamerkki') return 'nm-racon';
  const k = NAV_KIND[p.navigointilajikoodi];
  if (k) return `nm-${k}`;
  return 'nm-other';
}

export class NauticalLayer {
  constructor(map, app) {
    this.map = map;
    this.app = app; // { setData(id, fc) }
    this.on = false;
    this.tiles = new Map(); // "layer/x/y" -> features | Promise
    this.faults = null;
    this.timer = 0;
    map.on('moveend', () => this.schedule());
  }

  setEnabled(on) {
    this.on = on;
    this.schedule(0);
    this.publish();
  }

  schedule(delay = 350) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.update(), delay);
  }

  update() {
    if (!this.on || this.map.getZoom() < 10.5) return;
    const c = this.map.getCenter();
    if (!(c.lng > 19 && c.lng < 32 && c.lat > 59.3 && c.lat < 70.3)) return;
    const b = this.map.getBounds();
    const [x0, y0] = lonLatToTile(b.getWest(), b.getNorth(), Z).map(Math.floor);
    const [x1, y1] = lonLatToTile(b.getEast(), b.getSouth(), Z).map(Math.floor);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 6) return;
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (const [key, layer] of Object.entries(LAYERS)) this.load(key, layer, x, y);
      }
    }
    this.loadFaults();
  }

  load(key, layer, x, y) {
    const id = `${key}/${x}/${y}`;
    if (this.tiles.has(id)) return;
    const p = loadTile(key, x, y).then((list) => { this.tiles.set(id, list); this.publishSoon(); }).catch(() => this.tiles.delete(id));
    this.tiles.set(id, p);
  }

  async loadFaults() {
    if (this.faults && Date.now() - this.faults.t < 10 * 60 * 1000) return;
    try {
      const gj = await request('digitraffic', 'https://meri.digitraffic.fi/api/aton/v1/faults?fixed_in_hours=1&language=en', { headers: { 'Digitraffic-User': 'Polku/1.0 (polku.si)' } }).then((r) => r.json());
      this.faults = { t: Date.now(), features: (gj.features || []).filter((f) => f.geometry && !f.properties.fixed) };
      this.publishSoon();
    } catch { /* optional */ }
  }

  publishSoon() {
    clearTimeout(this.pubTimer);
    this.pubTimer = setTimeout(() => this.publish(), 120);
  }

  collect(key) {
    const out = [];
    const seen = new Set();
    for (const [id, v] of this.tiles) {
      if (!id.startsWith(`${key}/`) || !Array.isArray(v)) continue;
      for (const f of v) {
        const fid = f.id || JSON.stringify(f.geometry.coordinates).slice(0, 60);
        if (seen.has(fid)) continue;
        seen.add(fid);
        out.push(f);
      }
    }
    return out;
  }

  publish() {
    if (!this.on) {
      for (const id of ['nmMarks', 'nmLines', 'nmAreas', 'nmSectors', 'nmLights']) this.app.setData(id, EMPTY);
      return;
    }
    // marks (points), with lit / fault flags
    const faultNums = new Set();
    const faultFeats = [];
    for (const f of (this.faults && this.faults.features) || []) {
      faultFeats.push({ type: 'Feature', properties: { kind: 'fault', icon: 'nm-fault', name: f.properties.aton_name_fi, fault: f.properties.type, since: f.properties.entry_timestamp, fairway: f.properties.fairway_name_fi, atonType: f.properties.aton_type }, geometry: f.geometry });
      if (f.properties.aton_id != null) faultNums.add(String(f.properties.aton_id));
    }
    const marks = [];
    for (const f of this.collect('marks')) {
      const p = f.properties;
      const coords = f.geometry.type === 'MultiPoint' ? f.geometry.coordinates[0] : f.geometry.coordinates;
      marks.push({ type: 'Feature', properties: {
        kind: 'mark', icon: markIcon(p), nav: NAV_KIND[p.navigointilajikoodi] || '', type: p.turvalaitetyyppifi, sub: p.alityyppi,
        name: p.nimifi || '', num: p.turvalaitenumero, where: p.sijaintifi || '', owner: p.omistaja || '',
        lit: p.valaistu === 'K', topmark: p.huippumerkki === 'K', fault: faultNums.has(String(p.turvalaitenumero)),
      }, geometry: { type: 'Point', coordinates: coords } });
    }
    for (const f of this.collect('signs')) {
      const p = f.properties;
      marks.push({ type: 'Feature', properties: { kind: 'sign', icon: 'nm-sign', label: p.rajoitusarvo != null ? String(p.rajoitusarvo) : 'i', name: p.nimifi || '', where: p.sijaintifi || '', extra: p.lisakilventeksti1 || '', signType: p.vlmlajityyppi }, geometry: f.geometry });
    }
    marks.push(...faultFeats);
    this.app.setData('nmMarks', { type: 'FeatureCollection', features: marks });

    // lights: character label + sector arcs
    const lights = [];
    const lightById = new Map();
    for (const f of this.collect('lights')) {
      const p = f.properties;
      lightById.set(p.id, f);
      lights.push({ type: 'Feature', properties: { kind: 'light', char: p.viralvalotunnuse || p.virallvalotunnus || '', charFi: p.virallvalotunnus || '', quality: p.laatu || '', height: p.korkeusvedesta, range: p.optinenkanto || p.maantietkanto, num: p.turvalaitenumero, nightDay: p.laji || '' }, geometry: f.geometry });
    }
    this.app.setData('nmLights', { type: 'FeatureCollection', features: lights });
    const sectors = [];
    for (const f of this.collect('sectors')) {
      const p = f.properties;
      const c = f.geometry.coordinates;
      if (p.alkukulma == null || p.loppukulma == null) continue;
      // all-round lights have no sectors to show (charts don't draw them either)
      const span = ((p.loppukulma - p.alkukulma) % 360 + 360) % 360;
      if (span === 0 || span >= 359) continue;
      sectors.push(sectorArc(c, p.alkukulma, p.loppukulma, SECTOR_COLOR[p.vari] || '#facc15', p.vari));
    }
    this.app.setData('nmSectors', { type: 'FeatureCollection', features: sectors });

    // navigation lines with swept depth; fairway areas; speed / restriction areas
    const lines = this.collect('lines').map((f) => {
      const p = f.properties;
      const depth = p.haraussyvyys || p.mitoitussyvays;
      return { type: 'Feature', properties: { kind: 'navline', depth: depth ? `${(+depth).toFixed(1)} m` : '', draught: p.mitoitussyvays, swept: p.haraussyvyys, type: p.tyyppi, bearing: p.tosisuunta || p.suunta, fairway: cleanName(p.vaylan_nimi) }, geometry: f.geometry };
    });
    this.app.setData('nmLines', { type: 'FeatureCollection', features: lines });
    const areas = [];
    for (const f of this.collect('areas')) {
      const p = f.properties;
      areas.push({ type: 'Feature', properties: { kind: 'fairway', depth: p.haraussyvyys, draught: p.mitoitussyvays, marking: p.merkintalaji || '', traffic: p.liikennointisuunta || '', fairway: cleanName(p.vaylan_nimi) }, geometry: f.geometry });
    }
    for (const [key, kind] of [['speed', 'speed'], ['restrict', 'restrict']]) {
      for (const f of this.collect(key)) {
        const p = f.properties;
        areas.push({ type: 'Feature', properties: { kind, limit: p.suuruus ? `${p.suuruus} km/h` : '', what: p.rajoitustyyppi || '', place: p.nimisijainti || '', info: p.lisatieto || '', label: kind === 'speed' && p.suuruus ? `${p.suuruus} km/h` : shortRestriction(p.rajoitustyyppi, p.suuruus) }, geometry: f.geometry });
      }
    }
    this.app.setData('nmAreas', { type: 'FeatureCollection', features: areas });
  }
}

const cleanName = (s) => (s || '').replace(/^\[\d+:\s*/, '').replace(/\]\(.*$/, '');

function shortRestriction(t, v) {
  const s = (t || '').toLowerCase();
  if (s.includes('nopeus') && v) return `${v} km/h`;
  if (s.includes('aallokon')) return 'no wake';
  if (s.includes('ankkur')) return 'no anchoring';
  if (s.includes('vesiskootteri')) return 'no jet skis';
  if (s.includes('moottor')) return 'no motor';
  return (t || '').split(',')[0].slice(0, 22);
}

// Light sector drawn as an arc around the light. Sector bearings are given as
// seen from the sea towards the light, so the arc lies at bearing + 180°.
function sectorArc(c, a0, a1, color, code) {
  const R = 260; // metres: a readable size at harbour zooms
  const k = Math.cos((c[1] * Math.PI) / 180);
  let start = (a0 + 180) % 360, end = (a1 + 180) % 360;
  if (end <= start) end += 360;
  const pts = [];
  const steps = Math.max(6, Math.round((end - start) / 4));
  for (let i = 0; i <= steps; i++) {
    const b = ((start + ((end - start) * i) / steps) * Math.PI) / 180;
    pts.push([c[0] + (Math.sin(b) * R) / (111195 * k), c[1] + (Math.cos(b) * R) / 111195]);
  }
  return { type: 'Feature', properties: { kind: 'sector', color, code, from: a0, to: a1 }, geometry: { type: 'LineString', coordinates: pts } };
}
