"""Geometry inputs must describe original roots and complete their border references."""
import gzip
import hashlib
import json
import importlib
from datetime import datetime, timezone
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

    def inputs(self,root):
        from tools.osm_data.test_countries import CountryTests
        paths=CountryTests().inputs(root)
        for p in paths:
            body=gzip.compress(b'["way",10,true,true,"'+b'a'*64+b'"]\n',mtime=0)
            (p/'geometry-roots.jsonl.gz').write_bytes(body)
            m=json.loads((p/'manifest.json').read_text())
            m['files'].append({'path':'geometry-roots.jsonl.gz','bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()})
            (p/'manifest.json').write_text(json.dumps(m))
        return paths

    def test_small_input_artifacts_verify_checksums_epochs_and_original_root_agreement(self):
        module=importlib.import_module('tools.osm_data.geometry_source')
        with tempfile.TemporaryDirectory() as tmp:
            paths=self.inputs(Path(tmp));inputs=module.load_inputs(paths)
            roots,expected=module.collect_roots(inputs)
            self.assertEqual(roots,{('way',10):{'area':True,'inspection':False}})
            self.assertEqual(expected,{('way',10):'a'*64})
            receipt=module.input_receipt(inputs)
            self.assertEqual(set(receipt),set(builder.COUNTRIES))
            self.assertEqual(receipt['finland']['manifest_sha256'],hashlib.sha256((paths[0]/'manifest.json').read_bytes()).hexdigest())
            (paths[1]/'geometry-roots.jsonl.gz').write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError,'integrity|checksum|hash'):module.load_inputs(paths)

    def test_missing_country_and_mixed_source_epoch_cannot_claim_shared_coverage(self):
        module=importlib.import_module('tools.osm_data.geometry_source')
        with tempfile.TemporaryDirectory() as tmp:
            paths=self.inputs(Path(tmp))
            with self.assertRaisesRegex(ValueError,'four|countries'):module.load_inputs(paths[:3])
            f=paths[1]/'manifest.json';m=json.loads(f.read_text());m['source']['timestamp']='2026-11-02T00:00:00Z';f.write_text(json.dumps(m))
            with self.assertRaisesRegex(ValueError,'epoch|timestamp'):module.load_inputs(paths)

    def test_same_original_root_cannot_change_purpose_or_identity_across_extracts(self):
        module=importlib.import_module('tools.osm_data.geometry_source')
        for mode in ['purpose','digest']:
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as tmp:
                paths=self.inputs(Path(tmp));p=paths[1];f=p/'geometry-roots.jsonl.gz'
                row=['way',10,False if mode=='purpose' else True,True,('b' if mode=='digest' else 'a')*64]
                f.write_bytes(gzip.compress(json.dumps(row).encode()+b'\n',mtime=0))
                mf=p/'manifest.json';m=json.loads(mf.read_text());record=next(r for r in m['files'] if r['path']==f.name);record.update(bytes=f.stat().st_size,sha256=hashlib.sha256(f.read_bytes()).hexdigest());mf.write_text(json.dumps(m))
                with self.assertRaisesRegex(ValueError,'Conflicting|conflict'):module.collect_roots(module.load_inputs(paths))

    def test_shared_build_uses_all_four_inputs_and_checks_original_member_identities(self):
        module=importlib.import_module('tools.osm_data.geometry_source')
        from tools.osm_data.publish import local_release
        for conflict,remove in [(False,False),(True,False),(False,True)]:
            with self.subTest(conflict=conflict,remove=remove),tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp);src=root/'source.osm';text=ROOT_OSM.replace('<tag k="highway" v="path"/>','<tag k="highway" v="path"/><tag k="lit" v="no"/>');src.write_text(text)
                paths=[]
                for country in builder.COUNTRIES:
                    p=root/country;paths.append(p)
                    stamp={'url':f'https://download.geofabrik.de/europe/{country}-latest.osm.pbf','timestamp':'2026-11-01T00:00:00Z','sha256':'a'*64,'bytes':src.stat().st_size}
                    builder.build_dataset(src,p,stamp,country=country,coverage={'type':'Polygon','coordinates':[[[-.01,-.01],[.01,-.01],[.01,.01],[-.01,.01],[-.01,-.01]]]})
                if conflict:src.write_text(text.replace('lon="0.002"','lon="0.003"'))
                source_info={'url':'https://download.geofabrik.de/europe-261101.osm.pbf','timestamp':'2026-11-01T00:00:00Z','sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'bytes':src.stat().st_size}
                out=root/'geometry'
                if conflict:
                    with self.assertRaisesRegex(ValueError,'identity'):module.build_geometry(src,module.load_inputs(paths),out,source_info)
                    self.assertFalse(out.exists())
                else:
                    inputs=module.load_inputs(paths)
                    roots,_=module.collect_roots(inputs)
                    self.assertEqual(set(roots),{('way',10),('relation',100)})
                    m=module.build_geometry(src,inputs,out,source_info,remove_source=remove)
                    local_release(out)
                    self.assertEqual(m['inputs'],module.input_receipt(module.load_inputs(paths)))
                    self.assertEqual(m['datasets']['geometry']['schema'],2)
                    self.assertEqual(m['datasets']['geometry']['coverage']['type'],'GeometryCollection')
                    self.assertEqual(len(m['datasets']['geometry']['coverage']['geometries']),4)
                    self.assertTrue(m['datasets']['geometry']['areas_complete'])
                    self.assertIs(m['datasets']['geometry']['nearby_complete'],False)
                    self.assertEqual(src.exists(),not remove,'only an explicitly selected temporary input is removed')
                    from tools.osm_data.bundle import bundle
                    combined=bundle(paths,root/'combined',geometry=out)
                    self.assertEqual(len(combined['datasets']),29)
                    self.assertEqual(combined['datasets']['geometry']['source'],source_info)
                    self.assertIs(combined['datasets']['geometry']['nearby_complete'],False)
                    self.assertFalse(any(f['path'].endswith('jsonl.gz') for f in combined['files']))
                    local_release(root/'combined')
                    manifest_file=out/'manifest.json'
                    for mode in ['epoch','coverage','inputs','incomplete','missing-nearby-flag']:
                        bad=json.loads(json.dumps(m))
                        if mode=='epoch':bad['source']['timestamp']='2026-11-02T00:00:00Z'
                        elif mode=='coverage':bad['datasets']['geometry']['coverage']={'type':'GeometryCollection','geometries':[]}
                        elif mode=='inputs':bad['inputs']['finland']['manifest_sha256']='f'*64
                        elif mode=='incomplete':bad['datasets']['geometry']['areas_complete']=False
                        else:del bad['datasets']['geometry']['nearby_complete']
                        manifest_file.write_text(json.dumps(bad))
                        with self.assertRaisesRegex(ValueError,'geometry|Geometry'):
                            bundle(paths,root/('bad-'+mode),geometry=out)
                    manifest_file.write_text(json.dumps(m))


    def test_reference_epoch_mismatch_fails_before_output(self):
        module=importlib.import_module('tools.osm_data.geometry_source')
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);inputs=module.load_inputs(self.inputs(root));out=root/'geometry'
            with self.assertRaisesRegex(ValueError,'epoch|timestamp'):
                module.build_geometry(root/'not-read.osm',inputs,out,{'timestamp':'2026-11-02T00:00:00Z'})
            self.assertFalse(out.exists())

    def test_reference_source_uses_the_actual_europe_download_location(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);xml=root/'source.osm';xml.write_text(ROOT_OSM);pbf=root/'source.osm.pbf'
            header=osmium.io.Header();header.set('osmosis_replication_timestamp',datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z'))
            with osmium.SimpleWriter(str(pbf),header=header) as out:
                for obj in osmium.FileProcessor(str(xml)):out.add(obj)
            md5=root/'source.md5';md5.write_text(hashlib.md5(pbf.read_bytes()).hexdigest())
            info=builder.inspect_source(pbf,md5,'europe','261101')
            self.assertEqual(info['url'],'https://download.geofabrik.de/europe-261101.osm.pbf')

    def test_source_removal_cannot_target_an_input_outside_the_build_directory(self):
        module=importlib.import_module('tools.osm_data.geometry_source')
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);inputs=module.load_inputs(self.inputs(root));src=root/'original.osm';src.write_text(ROOT_OSM)
            with self.assertRaisesRegex(ValueError,'sibling|temporary'):
                module.build_geometry(src,inputs,root/'elsewhere'/'geometry',{'timestamp':'2026-11-01T00:00:00Z'},remove_source=True)
            self.assertTrue(src.exists())
