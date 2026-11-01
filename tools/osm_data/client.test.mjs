import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { StaticOSM } from '../../js/osm-data.js';

const archive = await readFile(new URL('../fixtures/osm-static.pmtiles', import.meta.url));
const manifest = { schema: 1, release: 'fixture', source: { timestamp: '2026-11-01T00:00:00Z' },
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
  const [a, b] = await Promise.all([data.ways([8192, 8192]), data.ways([8192, 8192])]);
  assert.deepEqual(a, b);
  assert.deepEqual(a.elements[0].nodes, [1, 2]);
  assert.equal(a.elements[0].geometry[1].lon, 0.06);
  const count = calls.length;
  assert.deepEqual(await data.ways([8192, 8192]), a);
  assert.equal(calls.length, count, 'repeat selection is served from memory');
  assert.deepEqual((await data.ways([8193, 8192])).elements[0], a.elements[0], 'whole way across a boundary');
  assert.deepEqual((await data.ways([0, 0])).elements, [], 'sparse tile is empty');
  assert.equal(calls.filter((c) => c.url.endsWith('current.json')).length, 1, 'release pinned for session');
});

for (const failure of ['whole', 'compressed']) test(`refuses ${failure} archive responses before decoding`, async () => {
  mode = failure;
  await assert.rejects(new StaticOSM(`https://data.example/${failure}/current.json`).ways([8192, 8192]), /Range|compression/);
});

test('rejects incompatible manifests and invalid tile coordinates', async () => {
  mode = 'ok';
  const old = manifest.schema;
  manifest.schema = 99;
  await assert.rejects(new StaticOSM('https://data.example/bad/current.json').ways([8192, 8192]), /schema/);
  manifest.schema = old;
  await assert.rejects(new StaticOSM('https://data.example/invalid/current.json').ways([-1, NaN]), /tile/);
});
