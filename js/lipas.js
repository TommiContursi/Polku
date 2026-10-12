// LIPAS: Finland's national register of sports and outdoor facilities.
// Official hiking / MTB / paddling routes and lean-tos, huts, campfire sites and
// landing places, loaded by bounding box from the open WFS (CC BY 4.0).

import { LIPAS_WFS, LIPAS_TYPES } from './config.js';
import { lonLatToTile, tileBounds } from './geo.js';

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
      `&outputFormat=application/json&srsName=EPSG:4326&count=2000&bbox=${s},${w},${n},${e},urn:ogc:def:crs:EPSG::4326`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`LIPAS ${res.status}`);
    const gj = await res.json();
    return (gj.features || [])
      .filter((f) => f.geometry)
      .map((f) => {
        const p = f.properties || {};
        const clean = (v) => (v == null || v === 'None' ? '' : v);
        return {
          type: 'Feature',
          id: `${type}-${p.id}-${p.reitti_id || ''}`,
          geometry: f.geometry,
          properties: {
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
          },
        };
      });
  }

  publish() {
    const routes = [];
    const points = [];
    const seen = new Set();
    for (const [key, v] of this.tiles) {
      if (!v || !v.features) continue;
      const type = +key.split('/')[0];
      const isRoute = type > 4000;
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
