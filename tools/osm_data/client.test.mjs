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
