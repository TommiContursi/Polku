// GPX / KML import and GPX export.

export function parseTrackFile(text, filename = '') {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Could not read the file');
  const lines = [];
  const points = [];
  const isKml = /\.km[lz]$/i.test(filename) || doc.documentElement.nodeName.toLowerCase() === 'kml';
  const name = (doc.querySelector('metadata > name, trk > name, rte > name, Document > name, Placemark > name') || {}).textContent || filename.replace(/\.\w+$/, '');
  if (isKml) {
    for (const el of doc.getElementsByTagName('LineString')) {
      const c = el.getElementsByTagName('coordinates')[0];
      if (!c) continue;
      const coords = c.textContent.trim().split(/\s+/).map((t) => t.split(',').map(Number)).filter((p) => p.length >= 2 && p.every(Number.isFinite));
      if (coords.length > 1) lines.push(coords.map((p) => [p[0], p[1]]));
    }
    for (const el of doc.getElementsByTagName('gx:coord')) {
      // gx:Track — handled as one line
      const p = el.textContent.trim().split(/\s+/).map(Number);
      if (!lines.gx) { lines.gx = []; lines.push(lines.gx); }
      lines.gx.push([p[0], p[1]]);
    }
  } else {
    for (const seg of doc.querySelectorAll('trkseg')) {
      const coords = [...seg.querySelectorAll('trkpt')].map((p) => [+p.getAttribute('lon'), +p.getAttribute('lat')]);
      if (coords.length > 1) lines.push(coords);
    }
    for (const rte of doc.querySelectorAll('rte')) {
      const coords = [...rte.querySelectorAll('rtept')].map((p) => [+p.getAttribute('lon'), +p.getAttribute('lat')]);
      if (coords.length > 1) lines.push(coords);
    }
    for (const w of doc.querySelectorAll('wpt')) {
      points.push({ lngLat: [+w.getAttribute('lon'), +w.getAttribute('lat')], name: (w.querySelector('name') || {}).textContent || '' });
    }
  }
  if (!lines.length) throw new Error('No tracks or routes found in the file');
  return { name: name.trim(), lines, points };
}

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

export function toGPX({ name, coords, ele, waypoints = [], names = [], descs = [] }) {
  const pts = coords
    .map((c, i) => `      <trkpt lat="${c[1].toFixed(6)}" lon="${c[0].toFixed(6)}">${ele && Number.isFinite(ele[i]) ? `<ele>${ele[i].toFixed(1)}</ele>` : ''}</trkpt>`)
    .join('\n');
  const wpts = waypoints
    .map((w, i) => `  <wpt lat="${w[1].toFixed(6)}" lon="${w[0].toFixed(6)}"><name>${esc(names[i] || (i === 0 ? 'Start' : i === waypoints.length - 1 ? 'End' : `Via ${i}`))}</name>${descs[i] ? `<desc>${esc(descs[i])}</desc>` : ''}</wpt>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Polku" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(name)}</name><time>${new Date().toISOString()}</time></metadata>
${wpts}
  <trk>
    <name>${esc(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

export function download(filename, text, type = 'application/gpx+xml') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
