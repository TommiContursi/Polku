"""Assemble four independently built country archives without concatenating duplicate OSM objects."""
import argparse
from datetime import datetime, timezone
import hashlib
import heapq
import json
import os
from pathlib import Path
import re
import tempfile
import time

from tools.osm_data.builder import COUNTRIES, PRODUCT_ZOOMS, LICENSE_TEXT, file_record, json_bytes, identity_rows
from tools.osm_data.publish import local_release, validate
from tools.osm_data.geometry_source import load_inputs, input_receipt
from pmtiles.reader import Reader, MmapSource
from pmtiles.tile import Compression, TileType



def bundle(releases, output, *, geometry=None):
    started=time.monotonic()
    output=Path(output)
    if output.exists():raise FileExistsError(output)
    inputs={}
    for path in map(Path,releases):
        _,m=local_release(path)
        country=m.get('country')
        if country not in COUNTRIES:raise ValueError('Unsupported country')
        if country in inputs:raise ValueError('Duplicate country')
        if not re.fullmatch(r'https://download\.geofabrik\.de/europe/'+country+r'-(latest|[0-9]{6})\.osm\.pbf',m['source']['url']):raise ValueError('Mislabeled country source')
        if set(m['datasets'])!={'ways','lit',*PRODUCT_ZOOMS}:raise ValueError('Country product set is incomplete')
        inputs[country]=(path,m)
    if set(inputs)!=set(COUNTRIES):raise ValueError('Exactly the four supported countries are required')
    stamps={m['source']['timestamp'] for _,m in inputs.values()}
    if len(stamps)!=1:raise ValueError('Country source timestamps differ; build one consistent OSM epoch')
    stamp=next(iter(stamps))
    if not datetime.fromisoformat(stamp.replace('Z','+00:00')).tzinfo:raise ValueError('Invalid source timestamp')
    shared = None
    if geometry is not None:
        geo_root = Path(geometry)
        _,geo = local_release(geo_root)
        expected_inputs = load_inputs([p for p,_ in inputs.values()])
        expected_coverage = {'type':'GeometryCollection','geometries':[inputs[c][1]['coverage'] for c in COUNTRIES]}
        d = geo.get('datasets',{}).get('geometry',{})
        if (set(geo.get('datasets',{}))!={'geometry'} or geo.get('inputs')!=input_receipt(expected_inputs) or
            geo['source']['timestamp']!=stamp or not re.fullmatch(r'https://download\.geofabrik\.de/europe-(latest|[0-9]{6})\.osm\.pbf',geo['source']['url']) or
            d.get('kind')!='geometry' or d.get('format')!='pmtiles-json' or d.get('schema')!=2 or d.get('zoom')!=13 or
            d.get('source')!=geo['source'] or d.get('coverage')!=expected_coverage or geo.get('coverage')!=expected_coverage or
            d.get('areas_complete') is not True or d.get('nearby_complete') is not True):
            raise ValueError('Geometry does not match the complete same-epoch country inputs')
        with (geo_root/d['url']).open('rb') as stream:
            reader = Reader(MmapSource(stream));header=reader.header();metadata=reader.metadata()
            if (header['min_zoom']!=13 or header['max_zoom']!=13 or header['tile_type']!=TileType.UNKNOWN or
                header['tile_compression']!=Compression.GZIP or header['addressed_tiles_count']!=d.get('tiles') or
                metadata.get('schema')!=2 or metadata.get('source')!=geo['source']):
                raise ValueError('Invalid geometry archive header or provenance')
        shared = geo_root,geo
    overlap={'unique':0,'duplicates':0,'pairs':{}}
    previous=None
    for key,digest,country in heapq.merge(*(identity_rows(inputs[c][0]/'identities.jsonl.gz',c) for c in COUNTRIES)):
        if previous and previous[0]==key:
            if previous[1]!=digest:raise ValueError(f'Conflicting OSM object {key[0]}/{key[1]} in {previous[2]} and {country}')
            overlap['duplicates']+=1
            pair='/'.join(sorted([previous[2],country]))
            overlap['pairs'][pair]=overlap['pairs'].get(pair,0)+1
        else:overlap['unique']+=1
        previous=(key,digest,country)
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.'+output.name+'-',dir=output.parent) as tmp:
        stage=Path(tmp)/'release';stage.mkdir()
        datasets={};sources=[]
        for country in COUNTRIES:
            root,m=inputs[country]
            if not m.get('coverage'):raise ValueError('Country clipping coverage is required')
            sources.append({'country':country,**m['source']})
            for record in m['files']:
                if record['path'] in {'identities.jsonl.gz','geometry-roots.jsonl.gz','LICENSE.txt'}:continue
                # Inputs and output live on one CI filesystem; links avoid a second archive-sized copy.
                os.link(root/record['path'],stage/(country+'-'+record['path']))
            for name,d in m['datasets'].items():
                key=name if country=='finland' else country+'-'+name
                datasets[key]={**d,'url':country+'-'+d['url'],'kind':name,'country':country,
                               'bounds':m['bounds'],'coverage':m['coverage'],'source':m['source']}
        if shared:
            geo_root,geo = shared
            d = geo['datasets']['geometry']
            os.link(geo_root/d['url'],stage/'geometry.pmtiles')
            os.link(geo_root/'measurements.json',stage/'geometry-measurements.json')
            datasets['geometry'] = {**d,'url':'geometry.pmtiles'}
        reference = ('\nLocal schema 2 geometry contains original fragments and containment seeds. Reference source: '+shared[1]['source']['url']+'\n') if shared else ''
        (stage/'LICENSE.txt').write_text(LICENSE_TEXT+'\nSources:\n'+'\n'.join(s['url'] for s in sources)+'\n'+reference)
        (stage/'measurements.json').write_bytes(json_bytes({'bundle_seconds':time.monotonic()-started,
            'overlap':overlap,'archive_bytes':sum(d['bytes'] for d in datasets.values()),
            'countries':{c:json.loads((p/'measurements.json').read_bytes()) if (p/'measurements.json').exists() else {} for c,(p,_) in inputs.items()}})+b'\n')
        finland=inputs['finland'][1]
        digest=hashlib.sha256(json_bytes({'datasets':datasets,'sources':sources})).hexdigest()
        m={'schema':1,'release':stamp.replace('-','').replace(':','')+'-four-'+digest[:16],
           'built_at':datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z'),
           'source':finland['source'],'sources':sources,'bounds':finland['bounds'],'coverage':finland['coverage'],
           'datasets':datasets,'overlap':overlap,'attribution':finland['attribution'],'license':finland['license'],
           'files':[file_record(p) for p in sorted(stage.iterdir())]}
        if shared:m['geometry_inputs']=shared[1]['inputs']
        validate(m)
        (stage/'manifest.json').write_bytes(json_bytes(m)+b'\n')
        os.rename(stage,output)
    return m


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path)
    parser.add_argument('releases',nargs=4,type=Path)
    parser.add_argument('--geometry',type=Path,help='same-epoch verified shared geometry release')
    args=parser.parse_args()
    m=bundle(args.releases,args.output,geometry=args.geometry)
    print(json.dumps({'release':m['release'],'overlap':m['overlap'],'datasets':{k:{'bytes':d['bytes'],'country':d.get('country')} for k,d in m['datasets'].items()}},indent=2))


if __name__=='__main__':main()
