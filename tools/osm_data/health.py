"""HTTP and actual browser-consumer health, with guarded post-publication recovery."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys
from tools.osm_data import publish as p


def verify(output,release_dir=None):
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    expected=p.validate(json.loads((Path(release_dir)/'manifest.json').read_bytes())) if release_dir else None
    changed=False
    try:
        url=p.public_url(os.environ['OSM_PUBLIC_URL'])+'/current.json'
        if expected:
            live=p.validate(json.loads(p.get(url)),pointed=True)
            changed=live['release']!=expected['release']
            p.require(live==p.current(expected),'Live release differs from the just-published candidate')
        else:
            live=p.check(url)
        env=dict(os.environ,POLKU_URL='https://polku.si/')
        with (output/'browser.json').open('w') as stdout,(output/'browser.log').open('w') as stderr:
            subprocess.run([sys.executable,'tools/osm_data/measure_browser.py','--country','all'],
                           env=env,stdout=stdout,stderr=stderr,check=True,timeout=180)
        result=json.loads((output/'browser.json').read_text())
        urls=set()
        for cases in result['cases'].values():
            for row in cases:
                for product in [row,row['lighting'],*row['details'].values()]:
                    urls.update(n['url'] for n in product['network'] if '.pmtiles' in n['url'])
        expected_urls={url.removesuffix('/current.json')+'/'+dataset['url'] for dataset in live['datasets'].values()}
        extended = 'geometry' in live['datasets']
        expected_count = 29 if extended else 28
        p.require(len(expected_urls)==expected_count and urls==expected_urls,
                  'Browser consumers did not verify all current release archives')
        if extended:
            p.require(all(len(result.get('geometry_checks',{}).get(profile,[]))==6 and
                          all(r.get('complete') is True and r.get('consumers_verified') is True for r in result['geometry_checks'][profile])
                          for profile in ('desktop','phone_emulated')),
                      'Live geometry area checks are incomplete')
        receipt={'release':live['release'],'checked_at':datetime.now(timezone.utc).isoformat(),'archive_count':expected_count,'browser_cases':sum(map(len,result['cases'].values()))}
        p.require(receipt['browser_cases']==32,'Live consumer cases are incomplete')
        (output/'health.json').write_text(json.dumps(receipt,sort_keys=True)+'\n')
        print(json.dumps(receipt,sort_keys=True))
        return receipt
    except Exception:
        if expected and not changed:
            try:
                files=list(Path(release_dir).glob('rollback-*.json'))
                p.require(len(files)==1,'Expected exactly one retained rollback pointer')
                p.require(json.loads(files[0].read_text())['release']!=expected['release'],
                          'No distinct predecessor was saved for this recheck')
                # Recovery writes its own checkpoint; keep it separate from the publication's saved predecessor.
                recovery=output/'recovery';recovery.mkdir(exist_ok=True)
                saved=recovery/'previous.json';saved.write_bytes(files[0].read_bytes())
                p.rollback(saved,expected_current=expected['release'])
                (output/'rollback.json').write_text(json.dumps({'restored':json.loads(files[0].read_text())['release']})+'\n')
            except Exception as error:
                raise RuntimeError('Live OSM verification failed; rollback also failed: '+str(error)) from None
        raise


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path)
    parser.add_argument('--release-dir',type=Path)
    args=parser.parse_args();verify(args.output,args.release_dir)


if __name__=='__main__': main()
