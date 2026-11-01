"""Run with the pinned tools/osm_data/requirements.txt dependencies."""

import gzip
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from pmtiles.reader import MemorySource, Reader, all_tiles

from tools.osm_data import builder


OSM = '''<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="Polku test">
  <node id="1" lon="-0.01" lat="-0.01"/>
  <node id="2" lon="0.06" lat="-0.01"/>
  <node id="3" lon="0.065" lat="-0.015"/>
  <way id="10"><nd ref="1"/><nd ref="2"/>
    <tag k="highway" v="path"/><tag k="name" v="Ääkköset"/>
    <tag k="custom:tag" v="keep me"/>
  </way>
  <way id="11"><nd ref="2"/><nd ref="3"/>
    <tag k="highway" v="residential_link"/>
  </way>
  <way id="12"><nd ref="1"/><nd ref="3"/>
    <tag k="highway" v="motorway"/>
  </way>
  <relation id="100">
    <member type="way" ref="10" role="forward"/>
    <member type="way" ref="11" role="backward"/>
    <member type="way" ref="999" role=""/>
    <member type="node" ref="1" role="start"/>
    <tag k="type" v="route"/><tag k="route" v="hiking"/>
    <tag k="name" v="Shared route"/>
  </relation>
  <relation id="101">
    <member type="way" ref="10" role="from"/>
    <member type="node" ref="2" role="via"/>
    <member type="way" ref="11" role="to"/>
    <tag k="type" v="restriction"/>
    <tag k="restriction" v="no_right_turn"/>
  </relation>
</osm>'''


class BuilderTests(unittest.TestCase):
    def test_supercover_keeps_segment_interiors_and_corner_neighbors(self):
        self.assertEqual(
            builder.segment_tiles((8191.5, 8192.5), (8194.5, 8192.5)),
            {(8191, 8192), (8192, 8192), (8193, 8192), (8194, 8192)},
        )
        self.assertEqual(
            builder.segment_tiles((10.5, 10.5), (12.5, 12.5)),
            {(10, 10), (11, 10), (10, 11), (11, 11),
             (12, 11), (11, 12), (12, 12)},
        )
        self.assertEqual(
            builder.segment_tiles((10, 10.25), (10, 11.75)),
            {(9, 10), (10, 10), (9, 11), (10, 11)},
        )

    def test_complete_ways_tags_and_relation_members_survive_archive(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'source.osm'
            source.write_text(OSM, encoding='utf-8')
            out = Path(tmp) / 'release'
            builder.build_dataset(source, out, self.source_info(source))
            reader = Reader(MemorySource((out / 'ways.pmtiles').read_bytes()))
            tile = json.loads(gzip.decompress(reader.get(14, 8192, 8192)))
            self.assertEqual(tile['schema'], 1)
            way, route, restriction = tile['elements']
            self.assertEqual(way, {
                'type': 'way', 'id': 10, 'nodes': [1, 2],
                'geometry': [{'lon': -0.01, 'lat': -0.01},
                             {'lon': 0.06, 'lat': -0.01}],
                'tags': {'highway': 'path', 'name': 'Ääkköset',
                         'custom:tag': 'keep me'},
            })
            self.assertEqual(route['id'], 100)
            self.assertEqual(route['member_count'], 4)
            self.assertEqual(route['members'], [
                {'type': 'way', 'ref': 10, 'role': 'forward', 'index': 0},
            ])
            self.assertEqual(restriction['members'], [
                {'type': 'way', 'ref': 10, 'role': 'from', 'index': 0},
            ])
            end = json.loads(gzip.decompress(reader.get(14, 8194, 8192)))
            self.assertEqual([e['id'] for e in end['elements']], [10, 11, 100, 101])
            self.assertEqual(end['elements'][1]['nodes'][0], way['nodes'][1])
            self.assertEqual(end['elements'][2]['members'][1],
                             {'type': 'way', 'ref': 11, 'role': 'backward', 'index': 1})
            self.assertEqual(len(list(all_tiles(MemorySource(
                (out / 'ways.pmtiles').read_bytes())))), 4)
            manifest = json.loads((out / 'manifest.json').read_text())
            self.assertEqual(manifest['source'], self.source_info(source))
            self.assertEqual(manifest['datasets']['ways']['tiles'], 4)
            self.assertEqual(manifest['datasets']['ways']['sha256'],
                             hashlib.sha256((out / 'ways.pmtiles').read_bytes()).hexdigest())
            self.assertTrue(manifest['release'].endswith(manifest['datasets']['ways']['sha256'][:12]),
                            'a changed builder must be publishable for the same source snapshot')
            self.assertIn('OpenStreetMap', (out / 'LICENSE.txt').read_text())

    def test_archive_is_deterministic_and_existing_release_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'source.osm'
            source.write_text(OSM, encoding='utf-8')
            one, two = Path(tmp) / 'one', Path(tmp) / 'two'
            builder.build_dataset(source, one, self.source_info(source))
            builder.build_dataset(source, two, self.source_info(source))
            self.assertEqual((one / 'ways.pmtiles').read_bytes(),
                             (two / 'ways.pmtiles').read_bytes())
            before = (one / 'ways.pmtiles').read_bytes()
            with self.assertRaises(FileExistsError):
                builder.build_dataset(source, one, self.source_info(source))
            self.assertEqual((one / 'ways.pmtiles').read_bytes(), before)

    def test_missing_geometry_refuses_release_and_cleans_staging(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'source.osm'
            source.write_text(OSM.replace('<nd ref="2"/>', '<nd ref="9999"/>', 1))
            out = Path(tmp) / 'release'
            with self.assertRaisesRegex(ValueError, 'geometry'):
                builder.build_dataset(source, out, self.source_info(source))
            self.assertFalse(out.exists())
            self.assertEqual([p.name for p in Path(tmp).iterdir()], ['source.osm'])

    def test_checksum_mismatch_stops_before_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'source.osm'
            source.write_text(OSM)
            checksum = Path(tmp) / 'source.md5'
            checksum.write_text('0' * 32 + '  source.osm\n')
            out = Path(tmp) / 'release'
            with self.assertRaisesRegex(ValueError, 'MD5'):
                builder.build_release(source, out, checksum)
            self.assertFalse(out.exists())

    @staticmethod
    def source_info(source):
        return {
            'url': 'https://download.geofabrik.de/europe/finland-latest.osm.pbf',
            'timestamp': '2026-11-01T01:00:00Z',
            'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'bytes': source.stat().st_size,
        }


if __name__ == '__main__':
    unittest.main()
