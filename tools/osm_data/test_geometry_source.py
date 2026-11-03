"""Geometry inputs must describe original roots and complete their border references."""
import gzip
import hashlib
import json
import importlib
import osmium
from pathlib import Path
import tempfile
import unittest

from tools.osm_data import builder

ROOT_OSM = '''<osm version="0.6">
<node id="1" lon="0.001" lat="-0.001"><tag k="amenity" v="bench"/></node>
<node id="2" lon="0.002" lat="-0.001"/><node id="3" lon="0.002" lat="-0.002"/><node id="4" lon="0.001" lat="-0.002"/>
<way id="10"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/><tag k="boundary" v="protected_area"/></way>
<way id="11"><nd ref="1"/><nd ref="2"/><tag k="leisure" v="park"/></way>
<way id="12"><nd ref="1"/><nd ref="2"/><tag k="highway" v="path"/></way>
<relation id="100"><member type="way" ref="10" role="outer"/><member type="node" ref="4" role="label"/><tag k="type" v="boundary"/><tag k="boundary" v="protected_area"/></relation>
<relation id="101"><member type="way" ref="11" role="site"/><tag k="historic" v="ruins"/></relation>
</osm>'''

class GeometrySourceTests(unittest.TestCase):
    def test_country_exports_only_existing_inspection_classes_and_supported_original_area_roots(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);src=root/'source.osm';src.write_text(ROOT_OSM);out=root/'release'
            stamp={'url':builder.SOURCE_URL,'timestamp':'2026-11-01T00:00:00Z','sha256':'a'*64,'bytes':src.stat().st_size}
            manifest=builder.build_dataset(src,out,stamp)
            catalog=out/'geometry-roots.jsonl.gz'
            rows=[json.loads(line) for line in gzip.decompress(catalog.read_bytes()).splitlines()]
            self.assertEqual([r[:4] for r in rows],[['node',1,False,True],['relation',100,True,False],
                ['relation',101,False,True],['way',10,True,False],['way',11,False,True]])
            identities={(t,ref):sha for t,ref,sha in map(json.loads,gzip.decompress((out/'identities.jsonl.gz').read_bytes()).splitlines())}
            self.assertTrue(all(r[4]==identities[r[0],r[1]] for r in rows),'digests are original source identities, not clipped/derived geometry')
            record=next(f for f in manifest['files'] if f['path']==catalog.name)
            self.assertEqual(record['sha256'],hashlib.sha256(catalog.read_bytes()).hexdigest())
            self.assertEqual(set(manifest['datasets']),{'ways','trails','winter','hazards','places','inspection'},'a root catalog is build evidence, not another country product')
            second=root/'second';builder.build_dataset(src,second,stamp)
            self.assertEqual(catalog.read_bytes(),(second/catalog.name).read_bytes())

    def test_native_subset_follows_root_and_nested_members_and_retains_original_tags(self):
        module=importlib.import_module('tools.osm_data.geometry_source')
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);source=root/'europe.osm'
            text=ROOT_OSM.replace('<member type="way" ref="11" role="site"/>','<member type="relation" ref="100" role="part"/>')
            source.write_text(text);subset=root/'subset.osm.pbf'
            tracker=module.reference_subset(source,{('relation',101):{'area':False,'inspection':True}},subset)
            objects=[]
            class Read(osmium.SimpleHandler):
                def node(self,n):objects.append(('node',n.id,dict(n.tags)))
                def way(self,w):objects.append(('way',w.id,dict(w.tags)))
                def relation(self,r):objects.append(('relation',r.id,dict(r.tags),[(m.type,m.ref,m.role) for m in r.members]))
            Read().apply_file(str(subset))
            self.assertEqual({(o[0],o[1]) for o in objects},{('node',i) for i in [1,2,3,4]}|{('way',10),('relation',100),('relation',101)})
            self.assertEqual(next(o[2] for o in objects if o[:2]==('node',1)),{'amenity':'bench'})
            self.assertEqual(next(o[3] for o in objects if o[:2]==('relation',101)),[('r',100,'part')])
            self.assertIn(10,tracker.way_ids());self.assertNotIn(11,tracker.way_ids())
