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
'''
WAYS = '''
<way id="20"><nd ref="1"/><nd ref="2"/><tag k="barrier" v="fence"/></way>
<way id="21"><nd ref="1"/><nd ref="2"/><tag k="piste:type" v="nordic"/><tag k="piste:grooming" v="classic"/></way>
<way id="22"><nd ref="1"/><nd ref="2"/><tag k="natural" v="reef"/></way>
<way id="23"><nd ref="1"/><nd ref="2"/><tag k="tourism" v="wilderness_hut"/></way>
<way id="24"><nd ref="1"/><nd ref="2"/><tag k="highway" v="track"/><tag k="snowplowing" v="no"/><tag k="access" v="private"/></way>
<way id="25"><nd ref="1"/><nd ref="2"/><tag k="highway" v="track"/></way>
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
        for name, zoom, ids in [('trails', 13, [4, 5, 10, 20]), ('winter', 12, [21, 24]),
                                ('hazards', 11, [6, 22]), ('places', 12, [7, 23, 200])]:
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
