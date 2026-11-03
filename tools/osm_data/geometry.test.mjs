import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { validateGeometry, containsArea } from '../../js/osm-geometry.js';

const fixture = JSON.parse(await readFile(new URL('../fixtures/osm-geometry.json', import.meta.url)));

test('compiled local geometry agrees with original lake and hole membership', () => {
  for (const { json, point, inside } of fixture) {
    assert.equal(validateGeometry(json, json.tile), json);
    const lake = json.elements.find(e => e.type === 'relation' && e.id === 100);
    assert.equal(lake ? containsArea(lake, json.tile, point) : false, inside, point.join(','));
  }
  const interior = fixture.find(f => f.point[0] === 0.06).json.elements[0];
  assert.equal(interior.fragments.length, 0, 'an interior has no invented rectangular shoreline');
});

test('explicit incomplete areas reject containment instead of looking empty', () => {
  const json = structuredClone(fixture[0].json), e = json.elements[0];
  e.area.complete = false; e.area.polygons = [];
  validateGeometry(json, json.tile);
  assert.throws(() => containsArea(e, json.tile, fixture[0].point), /incomplete/i);
});

for (const [name, breakIt] of [
  ['schema', j => { j.schema = 1; }],
  ['tile', j => { j.tile[1]++; }],
  ['identity', j => { j.elements[0].identity = 'bad'; }],
  ['tags', j => { j.elements[0].tags = []; }],
  ['bounds', j => { j.elements[0].bounds = null; }],
  ['path', j => { j.elements[0].fragments[0].path[0][1] = 999; }],
  ['member path root', j => { j.elements[0].fragments[0].path[0][0] = 101; }],
  ['member path target', j => { j.elements[0].fragments[0].path[0][3] = 999; }],
  ['original position', j => { j.elements[0].fragments[0].start = 999; }],
  ['nodes', j => { j.elements[0].fragments[0].nodes.pop(); }],
  ['coordinates', j => { j.elements[0].fragments[0].geometry[0][0] = NaN; }],
  ['area pointer', j => { j.elements[0].area.polygons[0].edges.push([999, 0, false]); }],
  ['crossing interval', j => { j.elements[0].area.polygons[0].right = [[1, -1]]; }],
  ['duplicate object', j => { j.elements.push(structuredClone(j.elements[0])); }],
]) test(`malformed geometry ${name} cannot become a complete result`, () => {
  const json = structuredClone(fixture.find(f => f.json.elements[0]?.area.polygons.some(p => p.edges.length)).json);
  const xy = [...json.tile]; breakIt(json);
  assert.throws(() => validateGeometry(json, xy), /geometry|OSM/i);
});
