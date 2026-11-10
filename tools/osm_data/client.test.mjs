import './geometry.test.mjs';
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

for (const initial of [429,503]) test(`explicit hosted retry respects a provider rate limit after ${initial}`, async () => {
  const real = globalThis.fetch, url = `https://data.example/retry-limited-${initial}/current.json`;
  const { request, sourceStatus } = await import('../../js/net.js');
  let status = initial, manifests = 0;
  globalThis.fetch = (at, init) => {
    if (String(at) === url) { manifests++; if (status !== 200) return Promise.resolve(new Response('', {status,headers:{'Retry-After':'1'}})); }
    return real(at, init);
  };
  try {
    const data = new StaticOSM(url);
    await assert.rejects(data.tile([8192,8192]), /limiting requests|isn't responding/);
    status = 429;
    if (initial === 503) await assert.rejects(data.tile([8192,8192], {force:true}), /429|limiting requests/);
    assert.equal(sourceStatus('osmdata')?.reason, 'limit', 'a new provider limit is recorded');
    await assert.rejects(data.tile([8192,8192], {force:true}), /limiting requests/);
    assert.equal(manifests, initial === 503 ? 2 : 1, 'manual retry cannot bypass a provider limit');
  } finally {
    status = 200;
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

const { tileBounds, lonLatToTile } = await import('../../js/geo.js');
const borderBounds = tileBounds(8192,8192,14);
const ring = (points) => points.map(([x,y]) => [borderBounds[0]+x*(borderBounds[2]-borderBounds[0]),borderBounds[1]+y*(borderBounds[3]-borderBounds[1])]);
const rectangle = (w,s,e,n) => ({type:'Polygon',coordinates:[ring([[w,s],[e,s],[e,n],[w,n],[w,s]])]});
function borderManifest(coverages) {
  return {...manifest,datasets:Object.fromEntries(coverages.map((coverage,i)=>[`country${i}-ways`,{
    ...manifest.datasets.ways,kind:'ways',country:`country${i}`,url:`country${i}/ways.pmtiles`,coverage,source:manifest.source,
  }]))};
}

test('joint country polygons cover touching and overlapping borders without fetching irrelevant archives', async () => {
  const real=globalThis.fetch;
  let base;
  globalThis.fetch=(url,init)=>String(url).endsWith('current.json') ? Promise.resolve(Response.json(base)) : real(url,init);
  try {
    for (const [i,seam] of [0.5,0.6].entries()) {
      base=borderManifest([rectangle(-1,-1,seam,2),rectangle(.5,-1,2,2),rectangle(3,3,4,4)]);
      calls=[];
      const data=new StaticOSM(`https://data.example/union${i}/current.json`);
      const result=await data.tile([8192,8192]);
      assert.equal(result.elements[0].id,10);
      assert.ok(calls.some(c=>c.url.includes('country0/ways.pmtiles')));
      assert.ok(calls.some(c=>c.url.includes('country1/ways.pmtiles')));
      assert.ok(!calls.some(c=>c.url.includes('country2/ways.pmtiles')));
    }
  } finally {globalThis.fetch=real;}
});

test('union proof preserves holes, concavities, disconnected components and arbitrarily narrow gaps', async () => {
  const real=globalThis.fetch;
  let base;
  globalThis.fetch=(url,init)=>String(url).endsWith('current.json') ? Promise.resolve(Response.json(base)) : real(url,init);
  const outer=rectangle(-1,-1,2,2).coordinates[0], hole=rectangle(.3,.3,.7,.7).coordinates[0];
  const holed={type:'Polygon',coordinates:[outer,hole]};
  const shapes=[
    {name:'filled hole',parts:[holed,rectangle(.3,.3,.7,.7)],covered:true},
    {name:'unfilled hole',parts:[holed,rectangle(.3,.3,.6,.7)],covered:false},
    {name:'hole vertices outside tile at slab midpoint',parts:[{type:'Polygon',coordinates:[outer,ring([[.2,-1],[.5,-1],[.8,-1],[.8,2],[.5,2],[.2,2],[.2,-1]])]},rectangle(3,3,4,4)],covered:false},
    {name:'thin seam gap',parts:[rectangle(-1,-1,.5,2),rectangle(.500000001,-1,2,2)],covered:false},
    {name:'concave notch',parts:[{type:'Polygon',coordinates:[ring([[-1,-1],[2,-1],[2,2],[.7,2],[.7,.3],[.3,.3],[.3,2],[-1,2],[-1,-1]])]},rectangle(.3,.4,.7,2)],covered:false},
    {name:'disconnected islands',parts:[{type:'MultiPolygon',coordinates:[rectangle(-1,-1,.4,2).coordinates,rectangle(.6,-1,2,2).coordinates]},rectangle(.4,.3,.6,.7)],covered:false},
    {name:'diagonal seam',parts:[{type:'Polygon',coordinates:[ring([[-1,-1],[2,-1],[-1,2],[-1,-1]])]},{type:'Polygon',coordinates:[ring([[2,-1],[2,2],[-1,2],[2,-1]])]}],covered:true},
    {name:'crossing boundary gap',parts:[{type:'Polygon',coordinates:[ring([[-1,-1],[2,-1],[2,.6],[-1,.4],[-1,-1]])]},{type:'Polygon',coordinates:[ring([[-1,.6],[2,.4],[2,2],[-1,2],[-1,.6]])]}],covered:false},
    {name:'edge contact only',parts:[rectangle(-1,-1,0,2),rectangle(1,-1,2,2)],covered:false},
  ];
  try {
    for (const [i,{name,parts,covered}] of shapes.entries()) {
      base=borderManifest(parts);
      const data=new StaticOSM(`https://data.example/geometry-union${i}/current.json`);
      if(covered) assert.equal((await data.tile([8192,8192])).elements[0].id,10,name);
      else await assert.rejects(data.tile([8192,8192]),/coverage/,name);
    }
  } finally {globalThis.fetch=real;}
});

test('published clipping polygons jointly cover coarse Tornio and Svinesund tiles but retain genuine gaps', async () => {
  const real=globalThis.fetch, shapes=await Promise.all(['finland','sweden','norway','estonia'].map(async c=>JSON.parse(await readFile(new URL(`../../data/${c}-coverage.geojson`,import.meta.url)))));
  let base;
  globalThis.fetch=(url,init)=>String(url).endsWith('current.json') ? Promise.resolve(Response.json(base)) : real(url,init);
  try {
    for (const z of [11,12,13,14]) {
      base=borderManifest(shapes);
      for(const d of Object.values(base.datasets)) d.zoom=z;
      const data=new StaticOSM(`https://data.example/real-border${z}/current.json`,'ways',z);
      for (const ll of [[24.14,65.84],[11.22,59.10]]) await data.ready(lonLatToTile(...ll,z).map(Math.floor));
      await assert.rejects(data.ready(lonLatToTile(30,58,z).map(Math.floor)),/coverage/);
      if(z<14) await assert.rejects(data.ready(lonLatToTile(28.1903,59.3772,z).map(Math.floor)),/coverage/);
    }
  } finally {globalThis.fetch=real;}
});

// The cached PMTiles decoding boundary supplies arbitrary original objects; real decoding/ranges are tested above.
async function decodedUnion(label,parts,{epochs=[],complete=[],error=-1,run}={}) {
  const real=globalThis.fetch, base=borderManifest([rectangle(-1,-1,.6,2),rectangle(.4,-1,2,2)]);
  for(const [i,d] of Object.values(base.datasets).entries()) {d.source={...manifest.source,timestamp:epochs[i] || manifest.source.timestamp};d.nearby_complete=complete[i];}
  const url=`https://data.example/objects-${label}/current.json`, data=new StaticOSM(url);
  globalThis.fetch=(at,init)=>String(at)===url ? Promise.resolve(Response.json(base)) : real(at,init);
  for(const [i,elements] of parts.entries()) data.readers.set(new URL(`country${i}/ways.pmtiles`,url).href,{
    getHeader:async()=>({minZoom:14,maxZoom:14,tileType:0,tileCompression:2}),
    getZxy:async()=>{if(i===error)throw new Error('required archive down');return {data:new TextEncoder().encode(JSON.stringify({schema:1,elements}))};},
  });
  try {return await (run ? run(data) : data.tile([8192,8192]));}
  finally {globalThis.fetch=real;}
}
const route=(members)=>({type:'relation',id:100,tags:{type:'route',route:'hiking',name:'Across the border'},member_count:4,members});
const firstMember={type:'way',ref:10,role:'forward',index:0}, secondMember={type:'way',ref:11,role:'backward',index:2};
const obstacle={type:'node',id:10,lon:.01,lat:-.01,tags:{barrier:'gate',access:'private'}};
const fullRelation={type:'relation',id:101,tags:{tourism:'camp_site'},members:[{type:'node',ref:10,role:'entrance'},{type:'way',ref:10,role:'outer'}]};

test('country union preserves typed identity, full tags/topology and original ordered relation subsets', async()=>{
  const way={type:'way',id:10,tags:{highway:'path',surface:'gravel'},nodes:[1,2],geometry:[{lon:0,lat:0},{lon:.02,lat:-.01}]};
  const result=await decodedUnion('members',[[way,obstacle,route([firstMember]),fullRelation],[structuredClone(way),route([secondMember,firstMember]),fullRelation]]);
  assert.deepEqual(result.elements.filter(e=>e.id===10).map(e=>e.type),['way','node']);
  assert.deepEqual(result.elements.find(e=>e.type==='way'),way);
  assert.deepEqual(result.elements.find(e=>e.id===100).members,[firstMember,secondMember]);
  assert.deepEqual(result.elements.find(e=>e.id===101),fullRelation);
  assert.deepEqual(result.source.sources.map(s=>s.country),['country0','country1']);
  assert.equal(result.source.timestamp,manifest.source.timestamp);
});

test('one-country payloads stay immutable when a union expands a relation membership', async()=>{
  const cached=route([firstMember]);
  await decodedUnion('immutable',[[cached],[route([secondMember])]],{run:async data=>{
    const result=await data.tile([8192,8192]);
    assert.equal(result.elements[0].members.length,2);
    const key=[...data.tiles.keys()].find(k=>k.includes('country0'));
    assert.deepEqual((await data.tiles.get(key)).elements[0].members,[firstMember]);
  }});
});

for (const [label,left,right] of [
  ['tags',obstacle,{...obstacle,tags:{barrier:'gate',access:'yes'}}],
  ['geometry',{type:'way',id:10,tags:{},nodes:[1,2],geometry:[{lon:0,lat:0},{lon:1,lat:1}]},{type:'way',id:10,tags:{},nodes:[1,2],geometry:[{lon:0,lat:0},{lon:2,lat:1}]}],
  ['node order',{type:'way',id:10,tags:{},nodes:[1,2],geometry:[{lon:0,lat:0},{lon:1,lat:1}]},{type:'way',id:10,tags:{},nodes:[2,1],geometry:[{lon:0,lat:0},{lon:1,lat:1}]}],
  ['role',route([firstMember]),route([{...firstMember,role:'backward'}])],
  ['member ref',route([firstMember]),route([{...firstMember,ref:11}])],
  ['member count',route([firstMember]),{...route([firstMember]),member_count:5}],
  ['full member order',fullRelation,{...fullRelation,members:[...fullRelation.members].reverse()}],
]) test(`conflicting ${label} cannot become a complete border answer`,async()=>{
  await assert.rejects(decodedUnion(label.replaceAll(' ','-'),[[left],[right]]),/Conflicting OSM object/);
});

test('key order does not make identical originals conflict',async()=>{
  const result=await decodedUnion('key-order',[[obstacle],[{tags:{access:'private',barrier:'gate'},lat:-.01,lon:.01,id:10,type:'node'}]]);
  assert.equal(result.elements.length,1);
});

test('missing, incomplete, mixed-epoch and partial border answers stay unavailable while covered empty succeeds',async()=>{
  await assert.rejects(decodedUnion('down',[[],[]],{error:1}),/required archive down/);
  await assert.rejects(decodedUnion('incomplete',[[obstacle],[{type:'way',id:11,tags:{},nodes:[1,2],geometry:[{lon:0,lat:0}]}]]),/Incomplete OSM way/);
  await assert.rejects(decodedUnion('epoch',[[],[]],{epochs:[manifest.source.timestamp,'2026-11-02T00:00:00Z']}),/epochs/);
  const empty=await decodedUnion('empty',[[],[]]);assert.deepEqual(empty.elements,[]);
  const partial=await decodedUnion('partial',[[],[]],{complete:[true,false]});assert.equal(partial.nearby_complete,false);
  await assert.rejects(decodedUnion('bad-index',[[route([{...firstMember,index:4}])],[route([secondMember])]]),/Incomplete OSM relation/);
});

test('a stalled contributing archive still reaches fallback within one hosted deadline',async()=>{
  const {hostedTile}=await import('../../js/osm-data.js');
  const real=globalThis.fetch, base=borderManifest([rectangle(-1,-1,.6,2),rectangle(.4,-1,2,2)]);
  const url='https://data.example/union-stall/current.json';
  let fallback=0, timer;
  globalThis.fetch=(at,init)=>String(at)===url ? Promise.resolve(Response.json(base))
    : String(at).includes('country1/') ? Promise.resolve({status:206,headers:new Headers({'Content-Range':`bytes 0-${archive.length-1}/${archive.length}`}),arrayBuffer:()=>new Promise(()=>{})}) : real(at,init);
  try {
    const result=await Promise.race([hostedTile(url,'ways',14,[8192,8192],err=>{fallback++;assert.match(err.message,/timed out/);return {missing:true};}),
      new Promise((_,no)=>{timer=setTimeout(()=>no(new Error('deadline exceeded')),9000);})]);
    assert.deepEqual(result,{missing:true});assert.equal(fallback,1);
  } finally {clearTimeout(timer);globalThis.fetch=real;}
});

test('static reader decodes local schema 2 through real ranges, caches and distinguishes empty/coverage', async () => {
  const geometryArchive = await readFile(new URL('../fixtures/osm-geometry.pmtiles', import.meta.url));
  const { containsArea } = await import('../../js/osm-geometry.js');
  const real = globalThis.fetch, calls = [];
  const cover = (w, e) => ({ type: 'Polygon', coordinates: [[[w,-.3],[e,-.3],[e,.3],[w,.3],[w,-.3]]] });
  const manifest = { schema: 1, release: 'geometry-fixture', bounds: [-.3,-.3,.3,.3], source: { timestamp: '2026-11-01T00:00:00Z' }, attribution: '© OpenStreetMap contributors',
    datasets: { geometry: { kind: 'geometry', format: 'pmtiles-json', schema: 2, zoom: 13, bytes: geometryArchive.length, url: 'geometry.pmtiles',
      bounds: [-.3,-.3,.3,.3], coverage: { type: 'GeometryCollection', geometries: [cover(-.3,0),cover(0,.3)] },
      source: { timestamp: '2026-11-01T00:00:00Z' }, areas_complete: true, nearby_complete: true } } };
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    if (String(url).endsWith('current.json')) return Response.json(manifest);
    const [start,end] = init.headers.Range.slice(6).split('-').map(Number), body = geometryArchive.subarray(start,end+1);
    return new Response(body, { status: 206, headers: { 'Content-Range': `bytes ${start}-${end}/${geometryArchive.length}` } });
  };
  try {
    const xy = lonLatToTile(.06,-.06,13).map(Math.floor), reader = new StaticOSM('https://data.example/geometry/current.json','geometry',13);
    const [a,b] = await Promise.all([reader.tile(xy),reader.tile(xy)]);
    assert.deepEqual(a,b); assert.equal(a.schema,2); assert.deepEqual(a.tile,[13,...xy]);
    assert.equal(a.areas_complete,true); assert.equal(a.nearby_complete,true);
    assert.equal(a.source.timestamp,manifest.source.timestamp); assert.equal(a.source.attribution,manifest.attribution);
    assert.equal(containsArea(a.elements[0],a.tile,[.06,-.06]),true);
    const count = calls.length; assert.deepEqual(await reader.tile(xy),a); assert.equal(calls.length,count);
    const empty = await reader.tile(lonLatToTile(.25,-.25,13).map(Math.floor));
    assert.deepEqual(empty.elements,[]); assert.equal(empty.schema,2); assert.equal(empty.areas_complete,true);
    await assert.rejects(reader.tile([0,0]),/coverage/);
    manifest.datasets.geometry.areas_complete = false;
    const uncertain = await new StaticOSM('https://data.example/uncertain-geometry/current.json','geometry',13).tile(xy);
    assert.equal(uncertain.areas_complete,false,'source completeness is not inferred from a successfully decoded tile');
    const original = structuredClone(manifest.datasets.geometry);
    for (const [name, change] of [
      ['schema', d => { d.schema = 1; }],
      ['coverage', d => { delete d.coverage; }],
      ['kind', d => { delete d.kind; }],
      ['flags', d => { delete d.areas_complete; }],
      ['source', d => { delete d.source; }],
    ]) {
      manifest.datasets.geometry = structuredClone(original); change(manifest.datasets.geometry);
      await assert.rejects(new StaticOSM(`https://data.example/bad-geometry-${name}/current.json`,'geometry',13).tile(xy),/dataset|metadata/);
    }
    manifest.datasets.geometry = { ...original, coverage: { type: 'GeometryCollection', geometries: [cover(-.3,-.000001),cover(.000001,.3)] } };
    await assert.rejects(new StaticOSM('https://data.example/geometry-gap/current.json','geometry',13).tile([4096,4096]),/coverage/);
    manifest.datasets.geometry = original;
    manifest.datasets.duplicate = { ...original };
    await assert.rejects(new StaticOSM('https://data.example/geometry-duplicate/current.json','geometry',13).tile(xy),/shared.*dataset/);
    delete manifest.datasets.duplicate;
    delete manifest.datasets.geometry;
    const old = new StaticOSM('https://data.example/old-geometry/current.json','geometry',13), before = calls.length;
    await assert.rejects(old.tile(xy),/dataset/);await assert.rejects(old.tile(xy),/dataset/);
    assert.equal(calls.length,before+1,'old manifests stay pinned when an optional product is absent');
    assert.ok(calls.every(u => u.startsWith('https://data.example/')),'no public fallback is hidden in the reader');
  } finally { globalThis.fetch = real; }
});

test('a multi-stage hosted geometry attempt shares one deadline and cancels its outstanding read', async () => {
  const { hostedAttempt, geometryTiles } = await import('../../js/osm-data.js');
  assert.equal(typeof hostedAttempt,'function'); assert.equal(typeof geometryTiles,'function');
  await assert.rejects(geometryTiles('https://data.example/invalid-window/current.json',[1e100,0,1e100,0],new AbortController().signal),/Invalid/);
  const original=StaticOSM.prototype.readTile;let aborted=false;
  StaticOSM.prototype.readTile=async function(xy,options,signal) {
    if(xy[0]===4097) {
      await new Promise(ok=>setTimeout(ok,1500));
      return {schema:2,tile:[13,...xy],elements:[],areas_complete:true,nearby_complete:true,source:{timestamp:'2026-11-01T00:00:00Z'}};
    }
    return new Promise((ok,no)=>signal.addEventListener('abort',()=>{aborted=true;no(new DOMException('Cancelled','AbortError'));},{once:true}));
  };
  try {
    const start=performance.now();
    await assert.rejects(hostedAttempt(async signal=>{
      await geometryTiles('https://data.example/geometry-budget/current.json',[.06,-.06,.06,-.06],signal);
      await geometryTiles('https://data.example/geometry-budget/current.json',[.11,-.06,.11,-.06],signal);
    }),/timed out/);
    assert.ok(performance.now()-start<9000,'the second stage cannot start another eight-second UI wait');
    assert.ok(aborted,'the expired operation cancels its outstanding hosted read');
  } finally {StaticOSM.prototype.readTile=original;}
});
