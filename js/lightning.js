// FMI's lightning (#182): the strikes of the last hour in a box, the view's corners rounded out to 0.1°, so a request
// says which part of the map is on screen and never a position. Through request(), FMI's source in Settings.

import { request } from './net.js';

const WFS = 'https://opendata.fmi.fi/wfs';

export async function strikesIn([w, s, e, n]) {
  const out = (v, up) => (up ? Math.ceil(v * 10) : Math.floor(v * 10)) / 10;
  const end = new Date(Math.floor(Date.now() / 60e3) * 60e3), start = new Date(end.getTime() - 3600e3);
  const url = `${WFS}?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::lightning::simple&parameters=multiplicity`
    + `&bbox=${out(w)},${out(s)},${out(e, 1)},${out(n, 1)}&starttime=${start.toISOString()}&endtime=${end.toISOString()}`;
  const res = await request('fmi', url);
  if (!res.ok) throw new Error(`FMI ${res.status}`);
  return parseStrikes(await res.text());
}

/** FMI's simple WFS answer: one strike per element, [{ ll: [lon, lat], t: ms }]. */
export function parseStrikes(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('FMI’s lightning didn’t read');
  const list = [];
  for (const el of doc.getElementsByTagNameNS('*', 'BsWfsElement')) {
    const pos = el.getElementsByTagNameNS('*', 'pos')[0]?.textContent.trim().split(/\s+/).map(Number);
    const t = Date.parse(el.getElementsByTagNameNS('*', 'Time')[0]?.textContent);
    if (pos && pos.length === 2 && pos.every(Number.isFinite) && Number.isFinite(t)) list.push({ ll: [pos[1], pos[0]], t });
  }
  return list;
}
