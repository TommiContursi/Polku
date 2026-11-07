"""Live browser failure restores only the exact retained predecessor."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from tools.osm_data import health
from tools.osm_data.test_publish import manifest,pointer,encoded


class HealthTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.release=self.root/'release';self.release.mkdir()
        self.m=manifest('new');(self.release/'manifest.json').write_bytes(encoded(self.m))
        self.saved=self.release/'rollback-test.json';self.saved.write_bytes(encoded(pointer(manifest('old'))))
        self.env=patch.dict(os.environ,{'OSM_PUBLIC_URL':'https://data.example/polku-osm'});self.env.start();self.addCleanup(self.env.stop)

    def test_daily_browser_failure_reports_without_a_rollback(self):
        with patch.object(health.p,'check',return_value=pointer(self.m)),patch.object(health.subprocess,'run',side_effect=RuntimeError('browser failed')),patch.object(health.p,'rollback') as rollback:
            with self.assertRaisesRegex(RuntimeError,'browser failed'): health.verify(self.root/'out')
        rollback.assert_not_called()

    def test_post_publish_failure_rolls_back_and_remains_a_failed_run(self):
        with patch.object(health.p,'get',return_value=encoded(pointer(self.m))),patch.object(health.subprocess,'run',side_effect=subprocess.TimeoutExpired('browser',180)),patch.object(health.p,'rollback') as rollback:
            with self.assertRaises(subprocess.TimeoutExpired): health.verify(self.root/'out',self.release)
        copied=self.root/'out'/'recovery'/'previous.json'
        rollback.assert_called_once_with(copied, expected_current='new')
        self.assertEqual(copied.read_bytes(),self.saved.read_bytes())
        self.assertTrue((self.root/'out'/'rollback.json').exists())

    def test_changed_live_release_fails_before_browser_and_restores_previous(self):
        with patch.object(health.p,'get',return_value=encoded(pointer(manifest('different')))),patch.object(health.subprocess,'run') as browser,patch.object(health.p,'rollback') as rollback:
            with self.assertRaisesRegex(ValueError,'release'): health.verify(self.root/'out',self.release)
        browser.assert_not_called();rollback.assert_not_called()

    def test_ambiguous_rollback_is_explicit_and_does_not_pick_one(self):
        (self.release/'rollback-second.json').write_bytes(self.saved.read_bytes())
        with patch.object(health.p,'get',side_effect=RuntimeError('host failed')),patch.object(health.p,'rollback') as rollback:
            with self.assertRaisesRegex(RuntimeError,'rollback'): health.verify(self.root/'out',self.release)
        rollback.assert_not_called()

    def test_rechecking_live_release_never_claims_a_rollback_to_itself(self):
        self.saved.write_bytes(encoded(pointer(self.m)))
        with patch.object(health.p,'get',side_effect=RuntimeError('host failed')),patch.object(health.p,'rollback') as rollback:
            with self.assertRaisesRegex(RuntimeError,'distinct predecessor'): health.verify(self.root/'out',self.release)
        rollback.assert_not_called()

    def test_failed_recovery_can_retry_without_mixing_its_own_checkpoint(self):
        calls=[];original=self.saved.read_bytes()
        def interrupted(path,**kwargs):
            calls.append(path)
            (Path(path).parent/'rollback-recovery.json').write_bytes(encoded(pointer(self.m)))
            raise RuntimeError('interrupted recovery')
        with patch.object(health.p,'get',return_value=encoded(pointer(self.m))),patch.object(health.subprocess,'run',side_effect=RuntimeError('browser failed')),patch.object(health.p,'rollback',side_effect=interrupted):
            for attempt in range(2):
                with self.assertRaisesRegex(RuntimeError,'rollback also failed'): health.verify(self.root/'out',self.release)
        self.assertEqual(len(calls),2)
        self.assertEqual(list(self.release.glob('rollback-*.json')),[self.saved])
        self.assertEqual(self.saved.read_bytes(),original)

    def test_rollback_failure_is_not_reported_as_success(self):
        with patch.object(health.p,'get',side_effect=RuntimeError('host failed')),patch.object(health.p,'rollback',side_effect=RuntimeError('rollback failed')):
            with self.assertRaisesRegex(RuntimeError,'rollback also failed'): health.verify(self.root/'out',self.release)

    def test_success_requires_all_current_archives_and_32_browser_cases(self):
        live=pointer(self.m)
        live['datasets']={str(i):{'url':'releases/new/'+str(i)+'.pmtiles'} for i in range(28)}
        def browser(*args,**kwargs):
            products={'network':[{'url':'https://data.example/polku-osm/'+d['url']} for d in live['datasets'].values()]}
            row=dict(products,lighting={'network':[]},details={})
            json.dump({'cases':{'desktop':[row]*16,'phone_emulated':[row]*16}},kwargs['stdout'])
            self.assertEqual(kwargs['timeout'],180)
        with patch.object(health.p,'check',return_value=live),patch.object(health.subprocess,'run',side_effect=browser):
            result=health.verify(self.root/'out')
        self.assertEqual(result['release'],'new');self.assertEqual(result['browser_cases'],32)

    def test_extended_release_requires_geometry_url_and_both_profiles_area_checks(self):
        for mode in ['ok','missing-url','missing-cases','missing-consumers']:
            with self.subTest(mode=mode):
                live=pointer(self.m)
                live['datasets']={str(i):{'url':'releases/new/'+str(i)+'.pmtiles'} for i in range(28)}
                live['datasets']['geometry']={'url':'releases/new/geometry.pmtiles'}
                def browser(*args,**kwargs):
                    products={'network':[{'url':'https://data.example/polku-osm/'+d['url']} for k,d in live['datasets'].items() if mode!='missing-url' or k!='geometry']}
                    row=dict(products,lighting={'network':[]},details={})
                    checks=[{'complete':True,'consumers_verified':mode!='missing-consumers'}]*6 if mode!='missing-cases' else []
                    json.dump({'cases':{'desktop':[row]*16,'phone_emulated':[row]*16},'geometry_checks':{'desktop':checks,'phone_emulated':checks}},kwargs['stdout'])
                with patch.object(health.p,'check',return_value=live),patch.object(health.subprocess,'run',side_effect=browser):
                    if mode=='ok':self.assertEqual(health.verify(self.root/mode)['archive_count'],29)
                    else:
                        with self.assertRaisesRegex(ValueError,'archives|geometry'):health.verify(self.root/mode)
