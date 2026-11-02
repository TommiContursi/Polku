import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { StaticOSM } from '../../js/osm-data.js';

const archive = await readFile(new URL('../fixtures/osm-static.pmtiles', import.meta.url));
const manifest = { schema: 1, release: 'fixture', bounds: [-180, -85.05112878, 180, 85.05112878], source: { timestamp: '2026-11-01T00:00:00Z' },
  datasets: { ways: { format: 'pmtiles-json', schema: 1, zoom: 14, url: 'ways.pmtiles', bytes: archive.length } } };
let calls = [], mode = 'ok';
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), range: init.headers?.Range });
  if (String(url).endsWith('current.json')) return Response.json(manifest);
  assert.ok(String(url).endsWith('/ways.pmtiles'), 'only static data is requested');
  const [start, end] = init.headers.Range.slice(6).split('-').map(Number);
  const body = archive.subarray(start, Math.min(end + 1, archive.length));
  return new Response(body, { status: mode === 'whole' ? 200 : 206, headers: {
    'Content-Range': `bytes ${start}-${start + body.length - 1}/${archive.length}`,
    ...(mode === 'compressed' ? { 'Content-Encoding': 'gzip' } : {}),
  } });
};

test('reads complete ways and shares concurrent tile reads without Overpass', async () => {
  calls = []; mode = 'ok';
  const data = new StaticOSM('https://data.example/ok/current.json');
  const [a, b] = await Promise.all([data.tile([8192, 8192]), data.tile([8192, 8192])]);
  assert.deepEqual(a, b);
  assert.deepEqual(a.elements[0].nodes, [1, 2]);
  assert.equal(a.elements[0].geometry[1].lon, 0.06);
  const count = calls.length;
  assert.deepEqual(await data.tile([8192, 8192]), a);
  assert.equal(calls.length, count, 'repeat selection is served from memory');
  assert.deepEqual((await data.tile([8193, 8192])).elements[0], a.elements[0], 'whole way across a boundary');
  assert.deepEqual((await data.tile([0, 0])).elements, [], 'sparse tile is empty');
  assert.equal(calls.filter((c) => c.url.endsWith('current.json')).length, 1, 'release pinned for session');
});

for (const failure of ['whole', 'compressed']) test(`refuses ${failure} archive responses before decoding`, async () => {
  mode = failure;
  await assert.rejects(new StaticOSM(`https://data.example/${failure}/current.json`).tile([8192, 8192]), /Range|compression/);
});

test('rejects incompatible manifests and invalid tile coordinates', async () => {
  mode = 'ok';
  const old = manifest.schema;
  manifest.schema = 99;
  await assert.rejects(new StaticOSM('https://data.example/bad/current.json').tile([8192, 8192]), /schema/);
  manifest.schema = old;
  await assert.rejects(new StaticOSM('https://data.example/invalid/current.json').tile([-1, NaN]), /tile/);
});

test('outside the extract extent is unavailable rather than an empty mapped tile', async () => {
  const bounds = manifest.bounds;
  manifest.bounds = [19, 59, 32, 71];
  try {
    await assert.rejects(new StaticOSM('https://data.example/outside/current.json').tile([0, 0]), /coverage/);
  } finally { manifest.bounds = bounds; }
});

test('a missing optional dataset pins the manifest without hammering current.json', async () => {
  calls = [];
  const data = new StaticOSM('https://data.example/missing/current.json', 'lit', 13);
  for (const xy of [[4096, 4096], [4097, 4096]]) await assert.rejects(data.tile(xy), /dataset/);
  assert.equal(calls.length, 1);
});

test('named datasets retain zoom and geometry validation', async () => {
  manifest.datasets.lit = { ...manifest.datasets.ways };
  try {
    const data = new StaticOSM('https://data.example/lit/current.json', 'lit', 14);
    assert.equal((await data.tile([8192, 8192])).elements[0].id, 10);
    await assert.rejects(new StaticOSM('https://data.example/zoom/current.json', 'lit', 13).tile([4096, 4096]), /dataset/);
  } finally { delete manifest.datasets.lit; }
});

test('coverage rejects holes and concavities even when every corner is inside the outer ring', async () => {
  const outer = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]];
  const shapes = [
    [outer, [[0.005, -0.015], [0.015, -0.015], [0.015, -0.005], [0.005, -0.005], [0.005, -0.015]]],
    [[[-1, -1], [1, -1], [1, 1], [0.015, 1], [0.015, -0.015], [0.005, -0.015], [0.005, 1], [-1, 1], [-1, -1]]],
  ];
  try {
    for (const [i, coordinates] of shapes.entries()) {
      manifest.coverage = { type: 'Polygon', coordinates };
      await assert.rejects(new StaticOSM(`https://data.example/shape${i}/current.json`).tile([8192, 8192]), /coverage/);
    }
    manifest.coverage = { type: 'MultiPolygon', coordinates: [[outer]] };
    assert.equal((await new StaticOSM('https://data.example/covered/current.json').tile([8192, 8192])).elements[0].id, 10);
    manifest.coverage = { type: 'Polygon', coordinates: [[[0, 0], [NaN, 1], [0, 0]]] };
    await assert.rejects(new StaticOSM('https://data.example/bad-coverage/current.json').tile([8192, 8192]), /coverage/);
  } finally { delete manifest.coverage; }
});

test('the Finland extract does not claim nearby countries, including Kiruna inside its rectangle', async () => {
  const { lonLatToTile } = await import('../../js/geo.js');
  manifest.coverage = JSON.parse(await readFile(new URL('../../data/finland-coverage.geojson', import.meta.url)));
  const bounds = manifest.bounds;
  manifest.bounds = [19, 59, 32, 71];
  try {
    const data = new StaticOSM('https://data.example/global/current.json');
    for (const ll of [[24.7536, 59.437], [18.0686, 59.3293], [10.7522, 59.9139], [20.225, 67.855]]) {
      await assert.rejects(data.tile(lonLatToTile(...ll, 14).map(Math.floor)), /coverage/);
    }
  } finally { delete manifest.coverage; manifest.bounds = bounds; }
});

test('forced retry replaces a pending archive read and a late failure cannot evict its replacement', async () => {
  const real = globalThis.fetch;
  let release, started;
  const sent = new Promise((ok) => { started = ok; });
  let first = true;
  globalThis.fetch = (url, init) => {
    if (String(url).endsWith('/ways.pmtiles') && first) {
      first = false; started();
      return new Promise((ok, no) => { release = () => no(new DOMException('Old attempt', 'AbortError')); });
    }
    return real(url, init);
  };
  try {
    const data = new StaticOSM('https://data.example/pending/current.json');
    const old = data.tile([8192, 8192]);
    const failed = assert.rejects(old, /Old attempt/);
    await sent;
    const fresh = await data.tile([8192, 8192], { force: true });
    assert.equal(fresh.elements[0].id, 10);
    release(); await failed;
    const count = calls.length;
    assert.deepEqual(await data.tile([8192, 8192]), fresh);
    assert.equal(calls.length, count, 'old failure does not evict the replacement');
  } finally { globalThis.fetch = real; }
});

test('hosted source choice coalesces consumers and preserves full source metadata', async () => {
  const { hostedTile } = await import('../../js/osm-data.js');
  assert.equal(typeof hostedTile, 'function');
  calls = []; mode = 'ok';
  let publicCalls = 0;
  const fallback = async () => { publicCalls++; return { elements: [] }; };
  const [a,b] = await Promise.all([hostedTile('https://data.example/shared/current.json', 'ways', 14, [8192,8192], fallback), hostedTile('https://data.example/shared/current.json', 'ways', 14, [8192,8192], fallback)]);
  assert.deepEqual(a,b);
  assert.equal(a.source.timestamp, '2026-11-01T00:00:00Z');
  assert.equal(a.source.provider, 'Polku OSM data');
  assert.equal(publicCalls, 0);
  assert.equal(calls.filter(c => c.url.endsWith('current.json')).length, 1);
});

test('concurrent missing hosted products share one fallback and do not become valid empty data', async () => {
  const { hostedTile } = await import('../../js/osm-data.js');
  assert.equal(typeof hostedTile, 'function');
  let publicCalls = 0;
  const fallback = async () => { publicCalls++; throw new Error('public source unavailable'); };
  const results = await Promise.allSettled([hostedTile('https://data.example/shared/current.json', 'missing',12,[2048,2048],fallback), hostedTile('https://data.example/shared/current.json', 'missing',12,[2048,2048],fallback)]);
  assert.ok(results.every(r => r.status === 'rejected' && /public source unavailable/.test(r.reason.message)));
  assert.equal(publicCalls, 1);
});

test('concurrent raw inspection and adapted selection keep their own result shapes', async () => {
  const { hostedTile } = await import('../../js/osm-data.js');
  mode='ok';calls=[];
  const args=['https://data.example/adapters/current.json','ways',14,[8192,8192]];
  const fallback=()=>{throw new Error('unexpected public query');};
  const [raw,adapted]=await Promise.all([hostedTile(...args,fallback),
    hostedTile(...args,fallback,{slim:j=>({w:j.elements.filter(e=>e.type==='way').map(e=>e.id)})})]);
  assert.ok(raw.elements);
  assert.deepEqual(adapted.w,[10]);
  assert.equal(adapted.elements,undefined);
  assert.equal(calls.filter(c=>c.url.endsWith('ways.pmtiles')).length,2,'one header and one payload range, shared by both adapters');
  const missing=[args[0],'absent',12,[2048,2048]];
  const [a,b]=await Promise.all([hostedTile(...missing,()=>({elements:[]})),hostedTile(...missing,()=>({w:[]}))]);
  assert.deepEqual(a,{elements:[]});assert.deepEqual(b,{w:[]});
});

test('failed manifest reads cool down across tiles instead of repeating the request', async () => {
  const real = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => { attempts++; throw new Error('host down'); };
  try {
    const data = new StaticOSM('https://data.example/cooldown/current.json');
    await assert.rejects(data.tile([8192,8192]), /host down/);
    await assert.rejects(data.tile([8193,8192]), /host down/);
    assert.equal(attempts, 1);
  } finally { globalThis.fetch = real; }
});

for (const action of ['force', 'reset']) test(`explicit ${action} recovers a failed manifest without discarding a healthy release`, async () => {
  const real = globalThis.fetch, url = `https://data.example/retry-${action}/current.json`;
  let healthy = false, manifests = 0;
  globalThis.fetch = async (at, init) => {
    if (String(at) === url) { manifests++; if (!healthy) return new Response('', {status:503}); }
    return real(at, init);
  };
  try {
    mode = 'ok';
    const data = new StaticOSM(url);
    await assert.rejects(data.tile([8192,8192]), /isn't responding/);
    const failedAttempts = manifests;
    healthy = true;
    await assert.rejects(data.tile([8193,8192]), /isn't responding/);
    assert.equal(manifests, failedAttempts, 'ordinary reads retain the failure cooldown');
    const { forgetHostedFailures } = await import('../../js/osm-data.js');
    if (action === 'reset') forgetHostedFailures(url);
    const values = await Promise.all([data.tile([8192,8192], {force: action === 'force'}),
      new StaticOSM(url).tile([8193,8192], {force: action === 'force'})]);
    assert.ok(values.every(value => value.elements[0].id === 10));
    assert.equal(manifests, failedAttempts + 1, 'concurrent consumers share the replacement manifest');
    if (action === 'reset') forgetHostedFailures(url);
    await data.tile([8192,8192], {force: true});
    assert.equal(manifests, failedAttempts + 1, 'a healthy pinned manifest is retained');
  } finally { globalThis.fetch = real; }
});

test('explicit hosted retry still respects a provider rate-limit pause', async () => {
  const real = globalThis.fetch, url = 'https://data.example/retry-limited/current.json';
  const { request } = await import('../../js/net.js');
  let limited = true, manifests = 0;
  globalThis.fetch = (at, init) => {
    if (String(at) === url) { manifests++; if (limited) return Promise.resolve(new Response('', {status:429,headers:{'Retry-After':'1'}})); }
    return real(at, init);
  };
  try {
    const data = new StaticOSM(url);
    await assert.rejects(data.tile([8192,8192]), /limiting requests/);
    await assert.rejects(data.tile([8192,8192], {force:true}), /limiting requests/);
    assert.equal(manifests, 1, 'manual retry cannot bypass a provider limit');
  } finally {
    limited = false;
    await request('osmdata', url, {backoff:false});
    globalThis.fetch = real;
  }
});

test('a stalled manifest body terminates within the hosted attempt budget', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => ({ok:true,json:() => new Promise(() => {})});
  let timer;
  try {
    await assert.rejects(Promise.race([
      new StaticOSM('https://data.example/hung/current.json').tile([8192,8192]),
      new Promise((_,no) => { timer = setTimeout(() => no(new Error('deadline exceeded')), 9000); }),
    ]), /OSM.*timed out/);
  } finally { clearTimeout(timer); globalThis.fetch = real; }
});

test('a malformed obstacle node is incomplete data rather than a successful empty tile', async () => {
  const bad = await readFile(new URL('../fixtures/osm-invalid-node.pmtiles',import.meta.url));
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init={}) => {
    if (String(url).endsWith('current.json')) return Response.json({...manifest,datasets:{ways:{...manifest.datasets.ways,bytes:bad.length}}});
    const [start,end]=init.headers.Range.slice(6).split('-').map(Number);
    return new Response(bad.subarray(start,end+1),{status:206,headers:{'Content-Range':`bytes ${start}-${end}/${bad.length}`}});
  };
  try { await assert.rejects(new StaticOSM('https://data.example/bad-node/current.json').tile([8192,8192]), /Incomplete OSM node/); }
  finally { globalThis.fetch=real; }
});

test('dataset completeness metadata survives a raw tile read', async () => {
  manifest.datasets.ways.nearby_complete = false;
  try {
    const d = await new StaticOSM('https://data.example/partial-inspection/current.json').tile([8192,8192]);
    assert.equal(d.nearby_complete,false);
  } finally { delete manifest.datasets.ways.nearby_complete; }
});

test('country archives use actual clipping polygons, including overlapping border coverage', async () => {
  const {lonLatToTile}=await import('../../js/geo.js');
  const real=globalThis.fetch, base=structuredClone(manifest);
  base.bounds=[19,59,32,71];
  base.coverage=JSON.parse(await readFile(new URL('../../data/finland-coverage.geojson',import.meta.url)));
  base.source.url='https://download.geofabrik.de/europe/finland-latest.osm.pbf';
  for (const country of ['sweden','norway','estonia']) base.datasets[`${country}-ways`]={...base.datasets.ways,kind:'ways',country,url:`${country}-ways.pmtiles`,bounds:[-180,-85,180,85],coverage:JSON.parse(await readFile(new URL(`../../data/${country}-coverage.geojson`,import.meta.url))),source:{timestamp:base.source.timestamp,url:`https://download.geofabrik.de/europe/${country}-latest.osm.pbf`}};
  const urls=[];
  globalThis.fetch=async (url,init={})=>{
    if(String(url).endsWith('current.json'))return Response.json(base);
    urls.push(String(url));
    const [start,end]=init.headers.Range.slice(6).split('-').map(Number);
    return new Response(archive.subarray(start,end+1),{status:206,headers:{'Content-Range':`bytes ${start}-${end}/${archive.length}`}});
  };
  try {
    const data=new StaticOSM('https://data.example/countries/current.json');
    for(const [country,ll] of [['finland',[24.9384,60.1699]],['sweden',[18.0686,59.3293]],['norway',[10.7522,59.9139]],['estonia',[24.7536,59.437]],['sweden',[20.225,67.855]]]) {
      const result=await data.tile(lonLatToTile(...ll,14).map(Math.floor));
      assert.equal(result.source.url,`https://download.geofabrik.de/europe/${country}-latest.osm.pbf`);
    }
    await data.tile(lonLatToTile(24.1466,65.8481,14).map(Math.floor));
    assert.ok(urls.some(u=>u.endsWith('sweden-ways.pmtiles')) && urls.some(u=>u.endsWith('norway-ways.pmtiles')));
    await assert.rejects(data.tile(lonLatToTile(30,58,14).map(Math.floor)),/coverage/);
  } finally {globalThis.fetch=real;}
});

test('an archive at the wrong zoom cannot become a valid empty hazard tile', async () => {
  manifest.datasets.hazards={...manifest.datasets.ways,zoom:11};
  try { await assert.rejects(new StaticOSM('https://data.example/wrong-archive-zoom/current.json','hazards',11).tile([1024,1024]),/archive zoom/); }
  finally {delete manifest.datasets.hazards;}
});

test('missing country coverage cannot inherit another country or its rectangle', async () => {
  const real=globalThis.fetch, base=structuredClone(manifest);
  base.datasets={'sweden-ways':{...base.datasets.ways,kind:'ways',country:'sweden',source:base.source},...base.datasets};
  globalThis.fetch=(url,init)=>String(url).endsWith('current.json') ? Promise.resolve(Response.json(base)) : real(url,init);
  try {
    await assert.rejects(new StaticOSM('https://data.example/missing-country-coverage/current.json').tile([8192,8192]),/country.*metadata/);
    base.datasets={ways:base.datasets.ways};base.country='sweden';
    await assert.rejects(new StaticOSM('https://data.example/missing-root-coverage/current.json').tile([8192,8192]),/country.*coverage/);
  } finally {globalThis.fetch=real;}
});
