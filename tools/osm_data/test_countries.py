"""Country assembly must prove object consistency rather than concatenate overlapping extracts."""
import gzip
import hashlib
import importlib
import json
from pathlib import Path
import tempfile
import unittest
from tools.osm_data import builder
from tools.osm_data.test_builder import OSM

COUNTRIES = ['finland','sweden','norway','estonia']
COVERAGE = {'type':'Polygon','coordinates':[[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]]}

class CountryTests(unittest.TestCase):
    def test_builder_records_original_object_digests_for_cross_country_checks(self):
        with tempfile.TemporaryDirectory() as tmp:
            src=Path(tmp)/'source.osm';src.write_text(OSM);out=Path(tmp)/'release'
            info={'url':builder.SOURCE_URL,'timestamp':'2026-11-01T00:00:00Z','sha256':'a'*64,'bytes':src.stat().st_size}
            builder.build_dataset(src,out,info)
            self.assertTrue((out/'identities.jsonl.gz').exists(),'overlap validation requires original object identities')
            rows=[json.loads(s) for s in gzip.decompress((out/'identities.jsonl.gz').read_bytes()).splitlines()]
            self.assertEqual([(r[0],r[1]) for r in rows],[('relation',100),('relation',101),('way',10),('way',11),('way',12)])

    def test_poly_coverage_retains_holes_and_disconnected_regions(self):
        self.assertTrue(hasattr(builder,'parse_poly'),'country clipping polygon parser is required')
        poly='none\n1\n0 0\n4 0\n4 4\n0 4\n0 0\nEND\n2\n10 10\n12 10\n12 12\n10 12\n10 10\nEND\n!hole\n1 1\n2 1\n2 2\n1 2\n1 1\nEND\nEND\n'
        result=builder.parse_poly(poly)
        self.assertEqual(result['type'],'MultiPolygon')
        self.assertEqual(len(result['coordinates'][0]),2)
        self.assertEqual(len(result['coordinates'][1]),1)
        with self.assertRaises(ValueError):builder.parse_poly('none\n1\nnan 2\nEND\nEND')

    def inputs(self,root,*,conflict=False,mixed=False):
        paths=[]
        for i,country in enumerate(COUNTRIES):
            p=root/country;p.mkdir();paths.append(p)
            files={'ways.pmtiles':b'fixture archive', 'LICENSE.txt':b'OpenStreetMap ODbL',
                   'identities.jsonl.gz':gzip.compress(json.dumps(['way',10,('b' if conflict and i==1 else 'a')*64]).encode()+b'\n',mtime=0)}
            zooms={'ways':14,'lit':13,'trails':13,'winter':12,'hazards':11,'places':12,'inspection':14}
            for name in zooms:
                files.setdefault(name+'.pmtiles',('fixture '+name).encode())
            records=[]
            for name,body in files.items():
                (p/name).write_bytes(body);records.append({'path':name,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()})
            archive=records[0]
            manifest={'schema':1,'country':country,'release':country+'-fixture','source':{'url':f'https://download.geofabrik.de/europe/{country}-latest.osm.pbf','timestamp':'2026-11-0'+('2' if mixed and i==1 else '1')+'T00:00:00Z','sha256':str(i)*64,'bytes':100},'bounds':[-1,-1,1,1],'coverage':COVERAGE,'files':records,'attribution':'© OpenStreetMap contributors','license':builder.LICENSE,'datasets':{name:{'format':'pmtiles-json','schema':1,'zoom':z,'url':name+'.pmtiles','bytes':len(files[name+'.pmtiles']),'sha256':hashlib.sha256(files[name+'.pmtiles']).hexdigest()} for name,z in zooms.items()}}
            (p/'manifest.json').write_text(json.dumps(manifest))
        return paths

    def module(self):
        self.assertIsNotNone(importlib.util.find_spec('tools.osm_data.bundle'),'country bundle implementation is required')
        return importlib.import_module('tools.osm_data.bundle')

    def test_bundle_keeps_legacy_finland_keys_and_country_provenance(self):
        module=self.module()
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);paths=self.inputs(root);out=root/'bundle'
            m=module.bundle(paths,out)
            self.assertEqual(m['datasets']['ways']['country'],'finland')
            self.assertEqual(m['datasets']['sweden-ways']['kind'],'ways')
            self.assertEqual(m['datasets']['sweden-ways']['coverage'],COVERAGE)
            self.assertEqual(len(m['sources']),4)
            self.assertEqual(m['overlap']['duplicates'],3)
            self.assertEqual(module.bundle(paths,root/'second-bundle')['release'],m['release'],'assembly timing does not change immutable data identity')
            self.assertFalse(any(f['path'].endswith('jsonl.gz') for f in m['files']),'identity reports are build evidence, not browser downloads')
            from tools.osm_data.publish import local_release,current,validate
            local_release(out);validate(current(m),pointed=True)

    def test_conflicting_ids_or_mixed_epochs_cannot_be_promoted(self):
        module=self.module()
        for mode in ['conflict','mixed']:
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp);paths=self.inputs(root,**{mode:True});out=root/'bundle'
                with self.assertRaisesRegex(ValueError,'Conflicting|timestamp'):module.bundle(paths,out)
                self.assertFalse(out.exists())

    def test_missing_country_cannot_advertise_four_country_coverage(self):
        module=self.module()
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);paths=self.inputs(root)
            with self.assertRaisesRegex(ValueError,'four|countries'):module.bundle(paths[:3],root/'bundle')

    def test_missing_product_or_mislabeled_source_cannot_claim_complete_coverage(self):
        module=self.module()
        for mode in ['product','source']:
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp);paths=self.inputs(root)
                file=paths[1]/'manifest.json';m=json.loads(file.read_text())
                if mode=='product':del m['datasets']['winter']
                else:m['source']['url']='https://download.geofabrik.de/europe/finland-latest.osm.pbf'
                file.write_text(json.dumps(m))
                with self.assertRaisesRegex(ValueError,'product|source'):module.bundle(paths,root/'bundle')

    def test_original_geometry_changes_are_visible_in_overlap_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);rows=[]
            for i,text in enumerate([OSM,OSM.replace('lon="0.06"','lon="0.061"')]):
                src=root/f'source-{i}.osm';src.write_text(text);out=root/f'release-{i}'
                info={'url':builder.SOURCE_URL,'timestamp':'2026-11-01T00:00:00Z','sha256':'a'*64,'bytes':src.stat().st_size}
                builder.build_dataset(src,out,info)
                rows.append({(k,ref):digest for k,ref,digest in map(json.loads,gzip.decompress((out/'identities.jsonl.gz').read_bytes()).splitlines())})
            self.assertNotEqual(rows[0]['way',10],rows[1]['way',10])
            self.assertEqual(rows[0]['relation',100],rows[1]['relation',100],'unchanged original memberships do not change with an unrelated encoding/source digest')

    def test_archive_zoom_must_match_the_declared_product(self):
        with tempfile.TemporaryDirectory() as tmp:
            src=Path(tmp)/'source.osm';src.write_text(OSM);out=Path(tmp)/'release'
            info={'url':builder.SOURCE_URL,'timestamp':'2026-11-01T00:00:00Z','sha256':'a'*64,'bytes':src.stat().st_size}
            builder.build_dataset(src,out,info)
            with self.assertRaisesRegex(ValueError,'header'):
                builder.validate_archive(out/'ways.pmtiles',4,zoom=13)
