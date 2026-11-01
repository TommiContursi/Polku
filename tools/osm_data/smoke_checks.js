// Real PMTiles decoding and IndexedDB, with only the transport answered from a tiny synthetic archive.
export async function checkStaticOSM() {
  const { StaticOSM } = await import('/js/osm-data.js');
  const W = await import('/js/ways.js');
  const { OSM_DATA_MANIFEST } = await import('/js/config.js');
  const { idb } = await import('/js/idb.js');
  const archive = await (await fetch('/tools/fixtures/osm-static.pmtiles')).arrayBuffer();
  const root = `${location.origin}/__test_osm_${Date.now()}/`, url = root + 'current.json';
  const manifest = { schema: 1, release: 'fixture', source: { timestamp: '2026-11-01T00:00:00Z' },
    datasets: { ways: { format: 'pmtiles-json', schema: 1, zoom: 14, url: 'ways.pmtiles', bytes: archive.byteLength } } };
  const real = window.fetch, calls = [], fails = [];
  // The weekly full-country preview exercises a long northern way beyond the old six-round limit.
  if (OSM_DATA_MANIFEST) {
    const ll = [20.8, 69.05];
    await W.loadWays(W.wayTile(ll));
    const seed = W.nearestWay(ll, 2000);
    if (!seed) fails.push('northern sample has no way');
    else {
      const pick = await W.joinWay(seed, ll);
      if (Object.values(pick.stops).some((s) => s.unloaded)) fails.push('static northern selection stops at the tile loading limit');
    }
  }
  let offline = false;
  window.fetch = async (input, init) => {
    const at = String(input);
    if (!at.startsWith(root)) return real(input, init);
    calls.push(at);
    if (offline) throw new TypeError('Offline fixture');
    if (at.endsWith('current.json')) return Response.json(manifest);
    const [start, end] = init.headers.Range.slice(6).split('-').map(Number);
    return new Response(archive.slice(start, end + 1), { status: 206,
      headers: { 'Content-Range': `bytes ${start}-${end}/${archive.byteLength}` } });
  };
  try {
    const data = new StaticOSM(url);
    const [a, b] = await Promise.all([data.ways([8192, 8192]), data.ways([8192, 8192])]);
    if (JSON.stringify(a) !== JSON.stringify(b) || a.elements[0].nodes.join() !== '1,2') fails.push('complete way or shared concurrent request lost');
    const count = calls.length;
    await data.ways([8192, 8192]);
    if (count !== calls.length) fails.push('repeat selection downloads data again');
    const across = await data.ways([8193, 8192]);
    if (JSON.stringify(across.elements[0]) !== JSON.stringify(a.elements[0])) fails.push('tile boundary clips the complete way');
    const slim = W.slimWays({ elements: [...a.elements,
      { type: 'relation', id: 1, tags: { type: 'restriction', name: 'Not a route' }, members: [{ type: 'way', ref: 10 }] },
      { type: 'relation', id: 2, tags: { type: 'route', route: 'hiking', name: 'The route' }, members: [{ type: 'way', ref: 10 }] }] });
    if (slim.w[0][5] !== 'The route' || slim.w[0][4].at(-2) !== 0.06) fails.push('card adapter loses geometry or uses a restriction as a route name');
    const store = idb('overpass'), key = `static/${root}ways.pmtiles/fixture/14/8192/8192`;
    const saved = await store.get(key);
    if (!saved) fails.push('selected tile was not saved for reuse');
    offline = true;
    const cached = await new StaticOSM(url).ways([8192, 8192]);
    if (JSON.stringify(cached) !== JSON.stringify(a)) fails.push('offline selection lost its cached way');
    try { await new StaticOSM(url).ways([8194, 8192]); fails.push('missing offline tile looks complete'); } catch { /* unavailable, not empty */ }
  } catch (err) { fails.push(String(err)); }
  finally { window.fetch = real; }
  return fails;
}
