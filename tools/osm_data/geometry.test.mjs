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

test('selects the named smallest containing area and rejects an uncertain candidate', async () => {
  const { selectArea } = await import('../../js/osm-geometry.js');
  assert.equal(typeof selectArea, 'function');
  const j = { ...structuredClone(fixture[0].json), areas_complete: true }, large = j.elements[0];
  const small = { ...structuredClone(large), type: 'way', id: 200, tags: { name: 'Small' }, area: { ...large.area, bounds: [.04,-.08,.08,-.04] } };
  const unnamed = { ...structuredClone(small), id: 201, tags: {}, area: { ...small.area, bounds: [.05,-.07,.07,-.05] } };
  j.elements.push(small, unnamed);
  assert.equal(selectArea(j, [.06,-.06]).id, 200);
  unnamed.area.complete = false; unnamed.area.polygons = [];
  assert.throws(() => selectArea(j, [.06,-.06]), /incomplete/i);
  unnamed.area.bounds = [.2,.2,.3,.3];
  assert.equal(selectArea(j, [.06,-.06]).id, 200, 'a located incomplete area elsewhere does not poison this point');
});

test('nearby eligibility uses original members, then ranks eligible objects by original centre', async () => {
  const { nearestGeometry } = await import('../../js/osm-geometry.js');
  assert.equal(typeof nearestGeometry,'function');
  const member={type:'relation',id:200,tags:{amenity:'shelter'},inspection:true,incomplete:false,bounds:[.0598,-.06,.2,.2],fragments:[{type:'node',point:[.0598,-.06]}]};
  const centreOnly={...member,id:201,bounds:[0,-.12,.12,0],fragments:[{type:'node',point:[0,-.12]},{type:'node',point:[.12,0]}]};
  const tile={nearby_complete:true,elements:[centreOnly,member]};
  assert.equal(nearestGeometry([tile],[.06,-.06],40).id,200);
  assert.equal(nearestGeometry([{...tile,elements:[centreOnly]}],[.06,-.06],40),null);
  assert.throws(()=>nearestGeometry([{...tile,nearby_complete:false}],[.06,-.06],40),/incomplete/i);
  assert.throws(()=>nearestGeometry([{...tile,elements:[{...member,incomplete:true}]}],[.06,-.06],40),/incomplete/i);
});


test('outline uses original edge pointers, clips real segments and measures only a complete whole area', async () => {
  const { areaOutline } = await import('../../js/osm-geometry.js');
  assert.equal(typeof areaOutline, 'function');
  const j = structuredClone(fixture.find(f => f.point[0]===.09).json);
  j.areas_complete = true;
  const e = j.elements.find(e => e.type === 'relation');
  const cut = areaOutline([j,j],e,[.09,-.02,.11,-.005]);
  assert.equal(cut.whole,false);
  assert.equal(cut.lines.length,1);
  assert.ok(cut.lines[0].every((p,i)=>p.every((v,j)=>Math.abs(v-[[.1,-.02],[.1,-.005]][i][j])<1e-12)));
  assert.ok(cut.lines.every(line => line.every(p => p[0]>=.09 && p[0]<=.11 && p[1]>=-.02 && p[1]<=-.005)));
  assert.throws(()=>areaOutline([j],e,[-.2,-.2,.2,.2]),/incomplete/i);
  const single = areaOutline([j],e,[.09,-.02,.11,-.005]), repeat = areaOutline([j,j],e,[.09,-.02,.11,-.005]);
  assert.deepEqual(single,repeat,'overlapping tile copies do not duplicate perimeter');
  const bad = structuredClone(j);bad.elements[0].fragments[0].geometry[0][0]+=.001;
  assert.throws(()=>areaOutline([j,bad],e,[.09,-.02,.11,-.005]),/conflict/i);
});
