// Fintraffic road weather cameras: points on the map and a modal with every
// view of a station, a 24 h time-lapse and the nearest road weather readings.

import { openModal } from './modal.js';
import { h, icon } from './ui.js';
import { compass } from './geo.js';

const ROAD = 'https://tie.digitraffic.fi';
const HEADERS = { 'Digitraffic-User': 'Polku/1.0 (polku.si)' };
const get = (url) => fetch(url, { headers: HEADERS }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });

const DIRECTION = { UNKNOWN: '', INCREASING_DIRECTION: 'road number up', DECREASING_DIRECTION: 'road number down', CROSSING_INCREASING_DIRECTION: 'side road →', CROSSING_DECREASING_DIRECTION: 'side road ←', SPECIAL_DIRECTION: 'special view' };
const SENSORS = [
  ['ILMA', 'Air', (v) => `${v.toFixed(1)} °C`],
  ['TIE_1', 'Road surface', (v) => `${v.toFixed(1)} °C`],
  ['KESKITUULI', 'Wind', null],
  ['SADE', 'Precipitation', null],
  ['NÄKYVYYS_KM', 'Visibility', (v) => `${v.toFixed(1)} km`],
  ['ILMAN_KOSTEUS', 'Humidity', (v) => `${Math.round(v)} %`],
];
const ago = (iso) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`;
};
const clock = (iso) => new Date(iso).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });

export class CameraLayer {
  constructor(map, app) {
    this.map = map;
    this.app = app; // { setData(id, fc) }
    this.on = false;
    this.stations = null;
  }

  async setEnabled(on) {
    this.on = on;
    if (on && !this.stations) {
      try {
        const gj = await get(`${ROAD}/api/weathercam/v1/stations`);
        this.stations = (gj.features || []).filter((f) => f.properties.collectionStatus === 'GATHERING').map((f) => ({
          type: 'Feature',
          properties: { kind: 'camera', id: f.id, name: (f.properties.name || '').replace(/_/g, ' '), presets: (f.properties.presets || []).length },
          geometry: { type: 'Point', coordinates: f.geometry.coordinates.slice(0, 2) },
        }));
      } catch { this.stations = []; }
    }
    this.app.setData('cameras', { type: 'FeatureCollection', features: this.on ? this.stations || [] : [] });
  }

  // ---------------------------------------------------------------- modal
  async open(id, fallbackName = '') {
    let st, hist, weather = null;
    try {
      [st, hist] = await Promise.all([get(`${ROAD}/api/weathercam/v1/stations/${id}`), get(`${ROAD}/api/weathercam/v1/stations/${id}/history`)]);
    } catch {
      openModal({ title: fallbackName || 'Road camera' }, (body) => body.append(h('p', { class: 'note' }, 'This camera is not available right now.')));
      return;
    }
    const p = st.properties;
    const presets = (p.presets || []).filter((x) => x.inCollection !== false);
    const histBy = new Map((hist.presets || []).map((x) => [x.id, x.history || []]));
    const road = p.roadAddress ? `road ${p.roadAddress.roadNumber}` : '';
    const title = (p.names && (p.names.en || p.names.fi)) || fallbackName || p.name;
    let playing = 0;
    let refresh = 0;

    openModal({ title, subtitle: [p.municipality, road, p.purpose === 'liikenne' ? 'traffic camera' : ''].filter(Boolean).join(' · '), wide: true, onClose: () => { clearInterval(playing); clearInterval(refresh); } }, (body) => {
      const img = h('img', { class: 'cam-img', alt: '', decoding: 'async' });
      const spinner = h('div', { class: 'cam-loading' }, 'Loading…');
      const stage = h('div', { class: 'cam-stage' }, img, spinner);
      const time = h('div', { class: 'cam-time' });
      const slider = h('input', { type: 'range', min: '0', max: '0', value: '0', 'aria-label': 'Image time' });
      const play = h('button', { type: 'button', class: 'tool', 'aria-label': 'Play time-lapse', title: 'Play the last 24 h', html: icon('play', 18) });
      const tabs = h('div', { class: 'chips cam-tabs', role: 'tablist' });
      const full = h('a', { class: 'link', target: '_blank', rel: 'noopener', html: `Full size ${icon('external', 13)}` });
      let preset = presets[0];
      let frames = [];

      const show = (i) => {
        const f = frames[i];
        if (!f) return;
        spinner.hidden = false;
        img.onload = () => { spinner.hidden = true; };
        img.onerror = () => { spinner.hidden = false; spinner.textContent = 'Image not available'; };
        img.src = f.imageUrl;
        img.alt = `${title}, ${preset.presentationName || ''}, ${clock(f.lastModified)}`;
        full.href = f.imageUrl;
        time.textContent = `${clock(f.lastModified)} · ${ago(f.lastModified)}`;
        slider.value = String(i);
      };
      const pick = (pr) => {
        preset = pr;
        for (const b of tabs.children) b.setAttribute('aria-pressed', String(b.dataset.id === pr.id));
        // history oldest → newest, with the live image as the last frame
        frames = [...(histBy.get(pr.id) || [])];
        const live = { imageUrl: `${pr.imageUrl}?t=${Math.floor(Date.now() / 60000)}`, lastModified: p.dataUpdatedTime || new Date().toISOString() };
        if (!frames.length || Date.parse(frames[frames.length - 1].lastModified) < Date.parse(live.lastModified) - 60000) frames.push(live);
        slider.max = String(Math.max(0, frames.length - 1));
        show(frames.length - 1);
      };
      presets.forEach((pr, i) => tabs.append(h('button', {
        type: 'button', class: 'chip', role: 'tab', 'data-id': pr.id, 'aria-pressed': String(i === 0), onclick: () => { stop(); pick(pr); },
      }, pr.presentationName && presets.length > 1 ? `${i + 1}. ${shorten(pr.presentationName, title)}` : DIRECTION[pr.direction] || `View ${i + 1}`)));
      const stop = () => { clearInterval(playing); playing = 0; play.innerHTML = icon('play', 18); };
      play.onclick = () => {
        if (playing) { stop(); return; }
        play.innerHTML = icon('pause', 18);
        let i = +slider.value >= frames.length - 1 ? 0 : +slider.value;
        playing = setInterval(() => { i += 1; if (i >= frames.length) { stop(); return; } show(i); }, 350);
      };
      slider.oninput = () => { stop(); show(+slider.value); };
      // keyboard: arrows step through time
      body.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { stop(); show(Math.max(0, +slider.value - 1)); e.preventDefault(); }
        if (e.key === 'ArrowRight') { stop(); show(Math.min(frames.length - 1, +slider.value + 1)); e.preventDefault(); }
      });
      const wx = h('div', { class: 'cam-wx' });
      body.append(
        presets.length > 1 ? tabs : null,
        stage,
        h('div', { class: 'cam-controls' }, play, slider, time),
        h('div', { class: 'cam-foot' }, wx, h('div', { class: 'cam-links' }, full,
          h('a', { class: 'link', href: 'https://liikennetilanne.fintraffic.fi/', target: '_blank', rel: 'noopener', html: `Fintraffic ${icon('external', 13)}` }))),
      );
      pick(preset);
      // new images every 10 minutes: refresh the live frame while open
      refresh = setInterval(() => { if (!playing && +slider.value === frames.length - 1) show(frames.length - 1); }, 60000);
      if (p.nearestWeatherStationId) loadWeather(p.nearestWeatherStationId, wx);
    });
  }
}

const shorten = (name, title) => name.replace(title, '').replace(/^[\s,–-]+/, '') || name;

async function loadWeather(stationId, box) {
  try {
    const d = await get(`${ROAD}/api/weather/v1/stations/${stationId}/data`);
    const by = Object.fromEntries((d.sensorValues || []).map((s) => [s.name, s]));
    const items = [];
    for (const [key, label, fmt] of SENSORS) {
      const s = by[key];
      if (!s || s.value == null) continue;
      if (key === 'KESKITUULI') {
        const max = by.MAKSIMITUULI ? ` (gusts ${by.MAKSIMITUULI.value.toFixed(0)})` : '';
        const dir = by.TUULENSUUNTA ? ` from ${compass(by.TUULENSUUNTA.value)}` : '';
        items.push([label, `${s.value.toFixed(1)} m/s${max}${dir}`]);
      } else if (key === 'SADE') {
        items.push([label, s.sensorValueDescriptionEn || s.sensorValueDescriptionFi || `${s.value}`]);
      } else items.push([label, fmt(s.value)]);
    }
    const cond = by.KELI_1 || by.VAROITUS_1;
    if (cond && (cond.sensorValueDescriptionEn || cond.sensorValueDescriptionFi)) items.push(['Road', cond.sensorValueDescriptionEn || cond.sensorValueDescriptionFi]);
    box.innerHTML = '';
    if (!items.length) return;
    box.append(h('span', { class: 'cam-wx-title', html: `${icon('temp', 14)} Road weather station` }),
      ...items.map(([l, v]) => h('span', { class: 'cam-wx-item' }, h('small', {}, l), h('b', {}, v))));
  } catch { /* station offline */ }
}
