"""The hosted products must match the existing Overpass consumers, including non-highways."""
import gzip
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from pmtiles.reader import MemorySource, Reader
from tools.osm_data import builder
from tools.osm_data.test_builder import OSM

EXTRA = '''
<node id="4" lon="0.005" lat="-0.005"><tag k="barrier" v="gate"/><tag k="locked" v="yes"/></node>
<node id="5" lon="0.006" lat="-0.005"><tag k="ford" v="yes"/></node>
<node id="6" lon="0.007" lat="-0.005"><tag k="natural" v="rock"/></node>
<node id="7" lon="0.008" lat="-0.005"><tag k="tourism" v="camp_site"/><tag k="name" v="Camp"/></node>
<node id="8" lon="0.009" lat="-0.005"><tag k="ford" v="no"/></node>
<node id="12" lon="0.010" lat="-0.005"><tag k="waterway" v="rapids"/></node>
'''
WAYS = '''
<way id="20"><nd ref="1"/><nd ref="2"/><tag k="barrier" v="fence"/></way>
<way id="21"><nd ref="1"/><nd ref="2"/><tag k="piste:type" v="nordic"/><tag k="piste:grooming" v="classic"/></way>
<way id="22"><nd ref="1"/><nd ref="2"/><tag k="natural" v="reef"/></way>
<way id="23"><nd ref="1"/><nd ref="2"/><tag k="tourism" v="wilderness_hut"/></way>
<way id="24"><nd ref="1"/><nd ref="2"/><tag k="highway" v="track"/><tag k="snowplowing" v="no"/><tag k="access" v="private"/></way>
<way id="25"><nd ref="1"/><nd ref="2"/><tag k="highway" v="track"/></way>
<way id="28"><nd ref="1"/><nd ref="2"/><tag k="waterway" v="rapids"/></way>
'''
REL = '''<relation id="200"><member type="way" ref="23" role="outer"/>
<tag k="tourism" v="camp_site"/><tag k="custom:tag" v="full tags"/></relation>'''


class ProductTests(unittest.TestCase):
    def build(self, text):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        source, out = Path(tmp.name) / 'source.osm', Path(tmp.name) / 'release'
        source.write_text(text)
        manifest = builder.build_dataset(source, out, {'url':builder.SOURCE_URL, 'timestamp':'2026-11-01T01:00:00Z', 'sha256':hashlib.sha256(source.read_bytes()).hexdigest(), 'bytes':source.stat().st_size})
        return out, manifest

    @staticmethod
    def tile(out, name, z):
        return json.loads(gzip.decompress(Reader(MemorySource(
            (out / f'{name}.pmtiles').read_bytes())).get(z, 2 ** (z-1), 2 ** (z-1))))['elements']

    def test_nodes_non_highway_barriers_winter_hazards_and_stays_survive(self):
        text = OSM.replace('  <way id="10">', EXTRA + '  <way id="10">')
        text = text.replace('  <relation id="100">', WAYS + '  <relation id="100">').replace('</osm>', REL + '</osm>')
        out, manifest = self.build(text)
        for name, zoom, ids in [('trails', 13, [4, 5, 10, 20, 24, 25]), ('winter', 12, [21, 24]),
                                ('hazards', 11, [6, 12, 22, 28]), ('places', 12, [7, 23, 200])]:
            self.assertIn(name, manifest['datasets'])
            self.assertEqual(manifest['datasets'][name]['zoom'], zoom)
            els = self.tile(out, name, zoom)
            self.assertEqual(sorted(e['id'] for e in els), ids)
            if name == 'trails':
                self.assertEqual(next(e for e in els if e['id'] == 4)['tags']['locked'], 'yes')
            if name == 'winter':
                self.assertEqual(next(e for e in els if e['id'] == 24)['tags']['access'], 'private')
            if name == 'places':
                rel = next(e for e in els if e['type'] == 'relation')
                self.assertEqual(rel['center'], {'lon': 0.025, 'lat': -0.01})
                self.assertEqual(rel['tags']['custom:tag'], 'full tags')

    def test_empty_products_are_declared_without_claiming_failed_extraction(self):
        out, manifest = self.build(OSM)
        for name in ['winter', 'hazards', 'places']:
            self.assertIn(name, manifest['datasets'])
            self.assertEqual(manifest['datasets'][name]['features'], 0)

    def test_missing_place_member_fails_instead_of_becoming_an_empty_search(self):
        with self.assertRaisesRegex(ValueError, 'Incomplete.*place'):
            self.build(OSM.replace('</osm>', REL.replace('ref="23"', 'ref="999"') + '</osm>'))

    def test_inspection_keeps_all_highways_and_full_place_tags(self):
        node = '<node id="9" lon="0.005" lat="-0.005"><tag k="amenity" v="toilets"/><tag k="custom:tag" v="original"/></node>'
        rel = '<relation id="210"><member type="way" ref="10" role="outer"/><tag k="boundary" v="protected_area"/><tag k="leisure" v="nature_reserve"/></relation>'
        out, manifest = self.build(OSM.replace('  <way id="10">', node+'  <way id="10">').replace('</osm>',rel+'</osm>'))
        self.assertIn('inspection',manifest['datasets'])
        els = self.tile(out,'inspection',14)
        self.assertEqual(sorted(e['id'] for e in els),[9,10,12,210])
        self.assertEqual(next(e for e in els if e['id']==9)['tags']['custom:tag'],'original')
        self.assertEqual(next(e for e in els if e['id']==12)['tags']['highway'],'motorway')
        self.assertTrue(manifest['datasets']['inspection']['nearby_complete'])

    def test_partial_inspection_relation_keeps_exact_tags_but_does_not_claim_nearby_completeness(self):
        rel = '<relation id="210"><member type="way" ref="10" role="outer"/><member type="way" ref="999" role="outer"/><tag k="leisure" v="nature_reserve"/></relation>'
        out, manifest = self.build(OSM.replace('</osm>',rel+'</osm>'))
        self.assertIn('inspection',manifest['datasets'])
        self.assertFalse(manifest['datasets']['inspection']['nearby_complete'])
        e = next(e for e in self.tile(out,'inspection',14) if e['id']==210)
        self.assertTrue(e['incomplete'])
        self.assertEqual(e['members'][1]['ref'],999)

    def test_untagged_node_members_still_locate_overnight_relations(self):
        rel='<relation id="220"><member type="node" ref="1" role=""/><tag k="tourism" v="camp_site"/></relation>'
        out,_=self.build(OSM.replace('</osm>',rel+'</osm>'))
        from pmtiles.reader import all_tiles
        els=[e for _,data in all_tiles(MemorySource((out/'places.pmtiles').read_bytes())) for e in json.loads(gzip.decompress(data))['elements']]
        self.assertEqual(els[0]['center'],{'lon':-0.01,'lat':-0.01})

    def test_wetlands_are_assembled_reedbeds_beside_their_inspection_records(self):
        nodes = ''.join(f'<node id="{i}" lon="{lon}" lat="{lat}"/>' for i, lon, lat in [
            (30, 0.01, -0.01), (31, 0.02, -0.01), (32, 0.02, -0.02), (33, 0.01, -0.02),
            (34, 0.013, -0.013), (35, 0.017, -0.013), (36, 0.017, -0.017), (37, 0.013, -0.017),
            (38, 0.03, -0.01), (39, 0.031, -0.01), (40, 0.031, -0.011)])
        reed = '<tag k="natural" v="wetland"/><tag k="wetland" v="reedbed"/>'
        ring = lambda i, refs, tags='': f'<way id="{i}">' + ''.join(f'<nd ref="{r}"/>' for r in refs) + tags + '</way>'
        ways = (ring(40, [30, 31, 32, 33, 30], reed)  # a reedbed way: also kept whole for inspection
                + ring(41, [30, 31, 32]) + ring(42, [32, 33, 30]) + ring(43, [34, 35, 36, 37, 34])
                + ring(44, [30, 31, 32, 33, 30], '<tag k="natural" v="wetland"/><tag k="wetland" v="bog"/>')
                + ring(45, [38, 39, 40], reed))  # not closed: osmium can't make an area of it
        rel = ('<relation id="300"><member type="way" ref="41" role="outer"/><member type="way" ref="42" role="outer"/>'
               '<member type="way" ref="43" role="inner"/><tag k="type" v="multipolygon"/>' + reed + '</relation>')
        out, manifest = self.build(OSM.replace('  <way id="10">', nodes + ways + '  <way id="10">').replace('</osm>', rel + '</osm>'))
        self.assertEqual(manifest['datasets']['wetlands']['zoom'], 12)
        els = {(e['type'], e['id']): e for e in self.tile(out, 'wetlands', 12)}
        self.assertEqual(sorted(els), [('relation', 300), ('way', 40)])
        self.assertEqual(els['way', 40]['tags'], {'wetland': 'reedbed'})
        # osmium's rings: outer anticlockwise, closed
        self.assertEqual(els['way', 40]['area'], [[[[0.01, -0.02], [0.02, -0.02], [0.02, -0.01], [0.01, -0.01], [0.01, -0.02]]]])
        hole = els['relation', 300]['area']
        self.assertEqual((len(hole), len(hole[0]), len(hole[0][1])), (1, 2, 5))
        self.assertEqual(next(e for e in self.tile(out, 'inspection', 14) if e['id'] == 40)['nodes'], [30, 31, 32, 33, 30])
        measured = json.loads((out / 'measurements.json').read_bytes())['products']['wetlands']
        self.assertEqual((measured['features'], measured['unassembled']), (2, 0))

    def test_a_reedbed_goes_into_every_tile_its_bounds_touch(self):
        # 0.1° wide: three z12 tiles (about 0.088° each) along the equator's south side
        nodes = ''.join(f'<node id="{i}" lon="{lon}" lat="{lat}"/>' for i, lon, lat in [
            (30, 0.001, -0.001), (31, 0.17, -0.001), (32, 0.001, -0.002)])
        way = '<way id="40"><nd ref="30"/><nd ref="31"/><nd ref="32"/><nd ref="30"/><tag k="natural" v="wetland"/><tag k="wetland" v="reedbed"/></way>'
        out, _ = self.build(OSM.replace('  <way id="10">', nodes + way + '  <way id="10">'))
        reader = Reader(MemorySource((out / 'wetlands.pmtiles').read_bytes()))
        self.assertEqual([bool(reader.get(12, 2048 + i, 2048)) for i in range(3)], [True, True, False])
