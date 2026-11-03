// Real PMTiles decoding and IndexedDB, with only the transport answered from a tiny synthetic archive.
export async function checkStaticOSM() {
  const { StaticOSM, forgetHostedFailures } = await import('/js/osm-data.js');
  const W = await import('/js/ways.js');
  const { OSM_DATA_MANIFEST } = await import('/js/config.js');
  const { idb } = await import('/js/idb.js');
  const archive = await (await fetch('/tools/fixtures/osm-static.pmtiles')).arrayBuffer();
  const root = `${location.origin}/__test_osm_${Date.now()}/`, url = root + 'current.json';
  const manifest = { schema: 1, release: 'fixture', bounds: [-180, -85.05112878, 180, 85.05112878], source: { timestamp: '2026-11-01T00:00:00Z' },
    datasets: { ways: { format: 'pmtiles-json', schema: 1, zoom: 14, url: 'ways.pmtiles', bytes: archive.byteLength } } };
  const real = window.fetch, calls = [], fails = [];
  // The weekly full-country preview exercises a long northern way beyond the old six-round limit.
  const country = OSM_DATA_MANIFEST ? (await new StaticOSM(OSM_DATA_MANIFEST).ready()).manifest.country : null;
  if (OSM_DATA_MANIFEST && (!country || country === 'finland')) {
    const ll = [27.3921157, 68.3992993]; // Rovaniementie: a long interior road, away from border tiles requiring fallback
    await W.loadWays(W.wayTile(ll));
    const seed = W.nearestWay(ll, 2000);
    if (!seed) fails.push('northern sample has no way');
    else {
      const pick = await W.joinWay(seed, ll);
      if (Object.values(pick.stops).some((s) => s.unloaded)) fails.push('static northern selection stops at the tile loading limit');
    }
  }
  let offline = false, limitedManifest = null;
  window.fetch = async (input, init) => {
    const at = String(input);
    if (!at.startsWith(root)) return real(input, init);
    calls.push(at);
    if (offline) throw new TypeError('Offline fixture');
    if (at === limitedManifest) return new Response('', {status:429,headers:{'Retry-After':'1'}});
    if (at.endsWith('current.json')) return Response.json(manifest);
    const [start, end] = init.headers.Range.slice(6).split('-').map(Number);
    return new Response(archive.slice(start, end + 1), { status: 206,
      headers: { 'Content-Range': `bytes ${start}-${end}/${archive.byteLength}` } });
  };
  try {
    const data = new StaticOSM(url);
    const [a, b] = await Promise.all([data.tile([8192, 8192]), data.tile([8192, 8192])]);
    if (JSON.stringify(a) !== JSON.stringify(b) || a.elements[0].nodes.join() !== '1,2') fails.push('complete way or shared concurrent request lost');
    const count = calls.length;
    await data.tile([8192, 8192]);
    if (count !== calls.length) fails.push('repeat selection downloads data again');
    const across = await data.tile([8193, 8192]);
    if (JSON.stringify(across.elements[0]) !== JSON.stringify(a.elements[0])) fails.push('tile boundary clips the complete way');
    const slim = W.slimWays({ elements: [...a.elements,
      { type: 'relation', id: 1, tags: { type: 'restriction', name: 'Not a route' }, members: [{ type: 'way', ref: 10 }] },
      { type: 'relation', id: 2, tags: { type: 'route', route: 'hiking', name: 'The route' }, members: [{ type: 'way', ref: 10 }] }] });
    if (slim.w[0][5] !== 'The route' || slim.w[0][4].at(-2) !== 0.06) fails.push('card adapter loses geometry or uses a restriction as a route name');
    manifest.datasets.ways.zoom = 13;
    try { await new StaticOSM(root+'wrong-zoom/current.json','ways',13).tile([4096,4096]); fails.push('wrong archive zoom looks like an empty successful tile'); }
    catch (e) { if (!/archive zoom/.test(e.message)) fails.push(String(e)); }
    finally { manifest.datasets.ways.zoom = 14; }
    const originalDatasets=manifest.datasets;
    manifest.datasets={'foreign-ways':{...originalDatasets.ways,kind:'ways',country:'sweden',source:manifest.source},...originalDatasets};
    try { await new StaticOSM(root+'missing-country/current.json').tile([8192,8192]); fails.push('missing country coverage inherits another source and looks complete'); }
    catch(e) { if (!/country.*metadata/.test(e.message)) fails.push(String(e)); }
    finally { manifest.datasets=originalDatasets; }
    const store = idb('overpass'), key = `static/${root}ways.pmtiles/fixture/14/8192/8192`;
    const saved = await store.get(key);
    if (!saved) fails.push('selected tile was not saved for reuse');
    const cachedURL = root + 'cached-manifest/current.json', manifestKey = `static/manifest/${cachedURL}`, cachedAt = Date.now() - 10000;
    await store.set(manifestKey, { at: cachedAt, json: manifest });
    await new StaticOSM(cachedURL).ready();
    if ((await store.get(manifestKey)).at !== cachedAt) fails.push('using a cached manifest resets its freshness clock');
    await store.del(manifestKey);
    for (const action of ['force', 'reset']) {
      const retryURL = root + action + '-retry/current.json', retry = new StaticOSM(retryURL);
      try {
        offline = true;
        try { await retry.tile([8192,8192]); fails.push(`${action}: offline manifest looks successful`); } catch { /* expected failure */ }
        const failedAttempts = calls.filter(at => at === retryURL).length;
        offline = false;
        try { await retry.tile([8193,8192]); fails.push(`${action}: background read bypasses cooldown`); } catch { /* ordinary reads remain cooled down */ }
        if (action === 'reset') forgetHostedFailures(retryURL);
        const recovered = await Promise.all([retry.tile([8192,8192], {force: action === 'force'}),
          new StaticOSM(retryURL).tile([8193,8192], {force: action === 'force'})]);
        if (recovered.some(j => j.elements[0]?.id !== 10) || calls.filter(at => at === retryURL).length !== failedAttempts + 1) fails.push(`${action}: recovered manifest is not shared`);
        if (action === 'reset') forgetHostedFailures(retryURL);
        await retry.tile([8192,8192], {force:true});
        if (calls.filter(at => at === retryURL).length !== failedAttempts + 1) fails.push(`${action}: retry discards a healthy manifest`);
      } catch (err) { fails.push(`${action}: manual hosted retry failed: ${err}`); }
      finally { offline = false; }
    }
    const limitedURL = root + 'new-limit/current.json', limited = new StaticOSM(limitedURL);
    const { request, sourceStatus } = await import('/js/net.js');
    try {
      offline = true;
      try { await limited.tile([8192,8192]); } catch { /* initial network failure */ }
      offline = false; limitedManifest = limitedURL;
      try { await limited.tile([8192,8192], {force:true}); } catch { /* retry receives 429 */ }
      if (sourceStatus('osmdata')?.reason !== 'limit') fails.push('manual retry does not record a new provider rate limit');
      const count = calls.length;
      try { await limited.tile([8192,8192], {force:true}); fails.push('manual retry bypasses a new provider limit'); } catch { /* provider pause must remain */ }
      if (calls.length !== count) fails.push('a provider rate-limit pause makes another request');
    } finally {
      offline = false; limitedManifest = null;
      await request('osmdata', limitedURL, {backoff:false});
    }
    offline = false;
    const { lonLatToTile } = await import('/js/geo.js');
    manifest.coverage = await (await real('/data/finland-coverage.geojson')).json();
    manifest.bounds = [19, 59, 32, 71];
    const global = new StaticOSM(root + 'global/current.json');
    for (const ll of [[24.7536, 59.437], [18.0686, 59.3293], [10.7522, 59.9139], [20.225, 67.855]]) {
      try { await global.tile(lonLatToTile(...ll, 14).map(Math.floor)); fails.push(`Finland extract claims ${ll}`); }
      catch (err) { if (!/coverage/.test(err.message)) fails.push(String(err)); }
    }    offline = true;
    const cached = await new StaticOSM(url).tile([8192, 8192]);
    if (JSON.stringify(cached) !== JSON.stringify(a)) fails.push('offline selection lost its cached way');
    try { await new StaticOSM(url).tile([8194, 8192]); fails.push('missing offline tile looks complete'); } catch { /* unavailable, not empty */ }

  } catch (err) { fails.push(String(err)); }
  finally { window.fetch = real; }
  // Exercise the adapters/cache/pool without sending fixture queries to public services.
  {
    const { StaticOSM } = await import('/js/osm-data.js');
    const { OSM_DATA_MANIFEST, OVERPASS } = await import('/js/config.js');
    const { lonLatToTile, tileBounds } = await import('/js/geo.js');
    const { idb } = await import('/js/idb.js');
    const L = await import('/js/lit.js');
    if (!OSM_DATA_MANIFEST) return fails;
    const real = window.fetch, original = StaticOSM.prototype.tile;
    const store = idb('overpass'), keys = [], requests = [];
    let unavailable = false, grow = false, answer = { schema: 1, elements: [] };
    StaticOSM.prototype.tile = async () => { if (unavailable) throw new Error('Hosted source unavailable'); return answer; };
    window.fetch = async (input, init) => {
      if (!OVERPASS.includes(String(input))) return real(input, init);
      const query = init.body.get('data');
      requests.push(query);
      if (grow) {
        const [, s, w, n, e] = query.match(/\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)->/).map(Number);
        const [x] = lonLatToTile((w + e) / 2, (s + n) / 2, 14).map(Math.floor);
        const lon = (i) => (i + 0.5) / 2 ** 14 * 360 - 180;
        return Response.json({ elements: [{ type: 'way', id: 9000000 + x, tags: { highway: 'residential', name: 'Fixture road' },
          nodes: [x, x + 1], geometry: [{ lon: lon(x), lat: 69.05 }, { lon: lon(x + 1), lat: 69.05 }] }] });
      }
      return Response.json({ elements: [] });
    };
    try {
      const run = async (ll, fail, label) => {
        const xy = lonLatToTile(...ll, 14).map(Math.floor), key = `ways2/14/${xy.join('/')}`;
        keys.push(key); await store.del(key);
        unavailable = fail; requests.length = 0;
        const W = await import(`/js/ways.js?fallback=${label}-${Date.now()}`);
        await W.loadWays(xy);
        if (!!requests.length !== fail) fails.push(`${label}: wrong ways source`);
        const count = requests.length;
        await W.loadWays(xy);
        if (requests.length !== count) fails.push(`${label}: repeat ways downloads again`);
      };
      await run([25.76, 62.23], false, 'healthy');
      await run([25.8, 62.23], true, 'host-failure');
      for (const [label, ll] of [['Tallinn', [24.7536, 59.437]], ['Stockholm', [18.0686, 59.3293]], ['Oslo', [10.7522, 59.9139]], ['Kiruna', [20.225, 67.855]]]) {
        await run(ll, true, label);
      }
      grow = true; requests.length = 0;
      const W = await import(`/js/ways.js?growth=${Date.now()}`), ll = [25, 69.05], xy = W.wayTile(ll);
      for (let dx = 0; dx <= 8; dx++) { const k = `ways2/14/${xy[0] + dx}/${xy[1]}`; keys.push(k); await store.del(k); }
      await W.loadWays(xy);
      const [w, , e] = tileBounds(...xy, 14), tap = [(w + e) / 2 + 0.001, ll[1]];
      const seed = W.nearestWay(tap, 100);
      const pick = seed && await W.joinWay(seed, tap);
      if (!pick || pick.chain.length !== 7 || new Set(requests).size !== 7) fails.push('public fallback does not retain its six growth rounds');
      grow = false;
      const geometry = [{ lon: 25.76, lat: 62.23 }, { lon: 25.77, lat: 62.23 }];
      const values = ['yes', '24/7', 'automatic', 'sunset-sunrise', 'limited', 'interval', 'no', 'disused', 'unknown'];
      answer = { schema: 1, elements: values.map((lit, i) => ({ type: 'way', id: i + 1, tags: { highway: 'motorway', lit }, geometry })) };
      unavailable = false; requests.length = 0;
      const lit = await L.litTile(4600, 2200);
      if (lit.w.map((w) => w[1]).join() !== '1,1,1,1,1,1,0,0' || requests.length) fails.push('hosted lighting changes meanings or queries Overpass');
      unavailable = true;
      const key = 'lit1/13/4601/2200'; keys.push(key); await store.del(key);
      requests.length = 0;
      await L.litTile(4601, 2200);
      if (!requests.length) fails.push('unavailable lighting did not fall back');
    } catch (err) { fails.push(String(err)); }
    finally {
      StaticOSM.prototype.tile = original; window.fetch = real;
      await Promise.all(keys.map((k) => store.del(k)));
    }
  }
  return fails;
}

/** Exercise the real consumers with hosted transport and public-provider failures. */
export async function checkHostedConsumers() {
  const { StaticOSM } = await import('/js/osm-data.js');
  const T = await import('/js/trails.js'), W = await import('/js/winter.js');
  const H = await import('/js/waterdata.js'), S = await import('/js/stops.js');
  const { lonLatToTile } = await import('/js/geo.js');
  const original = StaticOSM.prototype.tile, real = window.fetch, fails = [], publicCalls = [];
  const ll = [25.12345, 62.12345], xy = (z) => lonLatToTile(...ll,z).map(Math.floor);
  const geometry = [{lon:ll[0],lat:ll[1]},{lon:ll[0]+0.001,lat:ll[1]}];
  const answers = {
    trails: [{type:'way',id:70001,tags:{highway:'path',width:'0.4'},nodes:[1,2],geometry},
      {type:'node',id:70002,lon:ll[0],lat:ll[1],tags:{barrier:'gate',locked:'yes'}}],
    winter: [{type:'way',id:70003,tags:{'piste:type':'nordic'},nodes:[1,2],geometry}],
    hazards: [{type:'node',id:70004,lon:ll[0],lat:ll[1],tags:{natural:'reef'}}],
    places: [{type:'relation',id:70005,center:{lon:ll[0],lat:ll[1]},tags:{tourism:'camp_site',name:'Hosted campsite'}}],
  };
  StaticOSM.prototype.tile = async function() {
    return {schema:1,elements:answers[this.dataset] || [],source:{provider:'Polku OSM data',timestamp:'2026-11-01T00:00:00Z'}};
  };
  window.fetch = async (url,init) => {
    if (/overpass|maps.mail.ru/.test(String(url))) { publicCalls.push(String(url)); throw new DOMException('Public provider unavailable','AbortError'); }
    // The independent LIPAS/Väylä providers do not establish success for OSM in this check.
    if (/lipas|vayla|kartta.liikennevirasto/.test(String(url))) throw new DOMException('Other provider unavailable','AbortError');
    return real(url,init);
  };
  T.holdFetches(false); W.holdWinterFetches(false); H.seedWater(null);
  try {
    const trail = await T.trailTile(...xy(13));
    if (trail.w[0]?.[0] !== 70001 || trail.n[0]?.[3]?.locked !== 'yes') fails.push('hosted trail/gate details missing');
    if (trail.source?.timestamp !== '2026-11-01T00:00:00Z') fails.push('trail source timestamp lost');
    const winter = await W.winterTile(...xy(12));
    if (W.winterClass(winter.w[0]?.[1] || {}) !== 'ski') fails.push('hosted ski-only way missing');
    const water = await H.waterInputs([ll[0]-.001,ll[1]-.001,ll[0]+.001,ll[1]+.001],{hazards:true});
    if (!water.hazards.features.some(f=>f.properties.src==='osm' && f.properties.kind==='reef') || water.missing.includes('OpenStreetMap')) fails.push('hosted water hazard is missing or marked unavailable');
    const broad = await H.waterInputs([ll[0]-1,ll[1]-1,ll[0]+1,ll[1]+1],{hazards:true});
    if (!broad.missing.includes('OpenStreetMap')) fails.push('an uncheckable large water area looks like a complete empty hazard result');
    const stays = await S.staysNear(ll,0.1);
    if (!stays.some(p=>p.name==='Hosted campsite')) fails.push('hosted overnight relation missing');
    if (publicCalls.length) fails.push('healthy hosted consumers queried public Overpass');
  } catch(e) { fails.push(String(e)); }
  finally { StaticOSM.prototype.tile = original; window.fetch = real; }
  return fails;
}

export async function checkHostedInspection() {
  const { StaticOSM } = await import('/js/osm-data.js'), I = await import('/js/inspect.js');
  const original = StaticOSM.prototype.tile, real = window.fetch, fails = [];
  const ll = [25.22,62.22], geometry = [{lon:25.219,lat:62.22005},{lon:25.221,lat:62.22005}];
  const elements = [
    {type:'way',id:81001,nodes:[1,2],geometry,tags:{highway:'motorway','custom:tag':'original way'}},
    {type:'way',id:81002,nodes:[3,4],geometry:[{lon:25.219,lat:62.22},{lon:25.221,lat:62.22}],tags:{highway:'path','custom:tag':'original path'}},
    {type:'node',id:81001,lon:25.22,lat:62.22,tags:{amenity:'toilets','custom:tag':'original node'}},
    {type:'relation',id:81001,members:[{type:'way',ref:81001,role:'outer'}],center:{lon:25.22,lat:62.22},tags:{tourism:'camp_site','custom:tag':'original relation'}},
  ];
  StaticOSM.prototype.tile = async function() { return {schema:1,elements:this.dataset==='ways' ? elements.filter(e=>e.type==='way' && e.tags.highway!=='motorway') : elements,nearby_complete:true,source:{provider:'Polku OSM data',timestamp:'2026-11-01T00:00:00Z'}}; };
  window.fetch = async (url,init) => { if (/overpass|maps.mail.ru/.test(String(url))) throw new DOMException('Unexpected public query','AbortError'); return real(url,init); };
  try {
    for (const type of ['way','node','relation']) {
      const d = await I.osmDetails({type,id:81001,ll});
      if (d?.type!==type || d.tags['custom:tag']!==`original ${type}`) fails.push(`hosted full tags lost ${type} identity`);
    }
    const nearest = await I.wayNear(ll);
    if (nearest?.id!==81002 || nearest.tags.highway!=='path') fails.push('hosted inspection omits a highway outside the pick subset');
    try { await I.osmDetails({type:'way',id:999999,ll}); fails.push('unknown exact ID became the nearest way'); } catch { /* unsupported object and failed public fallback stay unavailable */ }
    const place = await I.osmDetails({type:'node',ll});
    if (place?.type!=='node' || place.tags.amenity!=='toilets') fails.push('hosted nearby inspection loses the closest place');
    StaticOSM.prototype.tile = async function() {
      if (this.dataset!=='ways') throw new Error('New inspection product not published');
      return {schema:1,elements:elements.filter(e=>e.type==='way'),source:{provider:'Polku OSM data'}};
    };
    const existing = await I.wayNear(ll,81002);
    if (existing?.tags['custom:tag']!=='original path') fails.push('exact full tags do not reuse the already published ways product');
    let inspectionOpened = false;
    StaticOSM.prototype.tile = async function() {
      if (this.dataset==='inspection') inspectionOpened=true;
      return {schema:1,elements,source:{provider:'Polku OSM data'}};
    };
    await I.wayNear(ll,81002);
    if (inspectionOpened) fails.push('known way tags opened another archive instead of reusing raw ways');
    const W = await import('/js/ways.js');
    let started, release;
    const requested = new Promise(yes=>{started=yes;});
    StaticOSM.prototype.tile = function() {
      if (this.dataset!=='ways') return Promise.reject(new Error('Inspection not published'));
      started();
      return new Promise(yes=>{release=()=>yes({schema:1,elements,source:{provider:'Polku OSM data'}});});
    };
    const raw = I.wayNear(ll,81002);
    await requested;
    const indexed = W.loadWays(W.wayTile(ll));
    release();
    await Promise.all([raw,indexed]);
    if (W.nearestWay(ll,100)?.id!==81002) fails.push('concurrent raw inspection broke the adapted ways index');
  } catch(e) { fails.push(String(e)); }
  finally { StaticOSM.prototype.tile=original;window.fetch=real; }
  return fails;
}
