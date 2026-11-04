"""Complete the four-country geometry roots from one same-epoch reference source."""
import argparse
from pathlib import Path
import gzip
import hashlib
import heapq
import json
import re
import os
import shutil
import tempfile
import time
from datetime import datetime, timezone
import osmium

from tools.osm_data.builder import COUNTRIES, PRODUCT_ZOOMS, LICENSE_TEXT, ATTRIBUTION, LICENSE, file_record, identity_rows, inspect_source
from tools.osm_data.publish import validate
from tools.osm_data.geometry import compile_geometry, combine_bounds, coverage_bounds, encoded


def reference_subset(source, roots, output):
    tracker = osmium.IdTracker()
    for kind,ref in roots:
        getattr(tracker,'add_'+kind)(ref)
    # Depth zero does not even follow seeded root relations' direct members.
    tracker.complete_backward_references(str(source),relation_depth=10)
    with osmium.io.Reader(str(source)) as reader:
        header = reader.header()
    with osmium.SimpleWriter(str(output),header=header) as writer:
        for obj in osmium.FileProcessor(str(source)).with_filter(tracker.id_filter()):
            writer.add(obj)
    return tracker


def load_inputs(paths):
    inputs = {}
    for root in map(Path,paths):
        m = validate(json.loads((root/'manifest.json').read_bytes()))
        country = m.get('country')
        if country not in COUNTRIES or country in inputs:
            raise ValueError('Exactly the four distinct supported countries are required')
        if not re.fullmatch(r'https://download\.geofabrik\.de/europe/'+country+r'-(latest|[0-9]{6})\.osm\.pbf',m['source']['url']):
            raise ValueError('Mislabeled country source')
        if set(m['datasets']) != {'ways','lit',*PRODUCT_ZOOMS} or not m.get('coverage'):
            raise ValueError('Incomplete country products or coverage')
        records = {f['path']:f for f in m['files']}
        for name in ('geometry-roots.jsonl.gz','identities.jsonl.gz'):
            if name not in records or file_record(root/name) != records[name]:
                raise ValueError('Geometry input integrity mismatch: '+name)
        inputs[country] = root,m
    if set(inputs) != set(COUNTRIES):
        raise ValueError('Exactly the four supported countries are required')
    if len({m['source']['timestamp'] for _,m in inputs.values()}) != 1:
        raise ValueError('Country source epochs/timestamps differ')
    return {c:inputs[c] for c in COUNTRIES}


def input_receipt(inputs):
    return {c:{'manifest_sha256':hashlib.sha256((root/'manifest.json').read_bytes()).hexdigest(),
               'roots_sha256':next(f['sha256'] for f in m['files'] if f['path']=='geometry-roots.jsonl.gz'),
               'identities_sha256':next(f['sha256'] for f in m['files'] if f['path']=='identities.jsonl.gz'),
               'source_sha256':m['source']['sha256']}
            for c,(root,m) in sorted(inputs.items())}


def root_rows(path):
    previous = None
    with gzip.open(path,'rb') as stream:
        while line := stream.readline(1024):
            row = json.loads(line)
            if (len(line)>=1024 or not isinstance(row,list) or len(row)!=5 or
                row[0] not in {'node','way','relation'} or type(row[1]) is not int or row[1]<=0 or
                type(row[2]) is not bool or type(row[3]) is not bool or not (row[2] or row[3]) or
                not isinstance(row[4],str) or not re.fullmatch('[a-f0-9]{64}',row[4])):
                raise ValueError('Invalid original geometry root')
            key = row[0],row[1]
            if previous is not None and key<=previous:
                raise ValueError('Geometry roots are not unique and sorted')
            previous = key
            yield row


def collect_roots(inputs):
    roots, expected = {},{}
    for kind,ref,area,inspection,sha in heapq.merge(*(root_rows(root/'geometry-roots.jsonl.gz') for root,_ in inputs.values())):
        key = kind,ref
        purpose = {'area':area,'inspection':inspection}
        if key in roots and (roots[key]!=purpose or expected[key]!=sha):
            raise ValueError(f'Conflicting original geometry root: {kind}/{ref}')
        roots[key] = purpose;expected[key] = sha
    return roots,expected


def build_geometry(source, inputs, output, source_info, *, remove_source=False):
    started = time.monotonic()
    source,output = Path(source),Path(output)
    if source_info['timestamp'] != next(iter(inputs.values()))[1]['source']['timestamp']:
        raise ValueError('Reference source epoch/timestamp differs from country inputs')
    if output.exists():
        raise FileExistsError(output)
    if remove_source and source.resolve().parent != output.resolve().parent:
        raise ValueError('Only the explicitly selected sibling temporary source can be removed')
    roots,expected = collect_roots(inputs)
    if not roots:
        raise ValueError('Country inputs contain no geometry roots')
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.'+output.name+'-',dir=output.parent) as tmp:
        tmp = Path(tmp)
        subset = tmp/'complete.osm.pbf'
        tracker = reference_subset(source,roots,subset)
        sets = {kind:getattr(tracker,kind+'_ids')() for kind in ('node','way','relation')}
        evidenced = set()
        for root,_ in inputs.values():
            for key,sha,_ in identity_rows(root/'identities.jsonl.gz',root.name):
                if key[1] not in sets[key[0]]:
                    continue
                if key in expected and expected[key] != sha:
                    raise ValueError(f'Conflicting original source identity: {key}')
                expected[key] = sha
                if key in roots:evidenced.add(key)
        if evidenced != set(roots):
            raise ValueError('Geometry root lacks original identity evidence')
        reference_counts = {kind:len(ids) for kind,ids in sets.items()}
        del sets,tracker
        subset_bytes = subset.stat().st_size
        source_allocated = source.stat().st_blocks*512
        subset_allocated = subset.stat().st_blocks*512
        if remove_source:
            source.unlink()
        stage = tmp/'release';stage.mkdir()
        coverages = [m['coverage'] for _,m in inputs.values()]
        report = compile_geometry(subset,roots,expected,stage/'geometry.pmtiles',source_info,coverages)
        if not report['dataset']['areas_complete'] or not report['dataset']['nearby_complete']:
            print(encoded({'incomplete_areas':report['incomplete_areas'][:20],
                           'incomplete_inspection':report['incomplete_inspection'][:20]}).decode(),flush=True)
            raise ValueError('Unlocated source geometry cannot certify shared coverage')
        coverage = {'type':'GeometryCollection','geometries':coverages}
        box = combine_bounds([b for c in coverages for b in coverage_bounds(c)])
        record = file_record(stage/'geometry.pmtiles')
        dataset = {**report['dataset'],'format':'pmtiles-json','url':record['path'],
                   'bytes':record['bytes'],'sha256':record['sha256'],'tiles':report['tiles'],
                   'features':len(roots),'bounds':box,'coverage':coverage,'source':source_info}
        receipt = input_receipt(inputs)
        report['build_peak_allocated_bytes'] = max(source_allocated+subset_allocated,
            report['staging_allocated_bytes']+subset_allocated+(0 if remove_source else source_allocated))
        report.update(inputs=receipt,source=source_info,root_count=len(roots),reference_counts=reference_counts,
                      subset_bytes=subset_bytes,build_seconds=time.monotonic()-started)
        (stage/'measurements.json').write_bytes(encoded(report)+b'\n')
        (stage/'LICENSE.txt').write_text(LICENSE_TEXT+'\nLocal schema 2 geometry stores original fragments and containment seeds, not whole objects. Source: '+source_info['url']+'\n')
        digest = hashlib.sha256(encoded(dataset)).hexdigest()
        manifest = {'schema':1,'release':source_info['timestamp'].replace('-','').replace(':','')+'-geometry-'+digest[:16],
                    'built_at':datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z'),
                    'source':source_info,'bounds':box,'coverage':coverage,'datasets':{'geometry':dataset},
                    'inputs':receipt,'files':[file_record(p) for p in sorted(stage.iterdir())],
                    'attribution':ATTRIBUTION,'license':LICENSE}
        validate(manifest)
        (stage/'manifest.json').write_bytes(encoded(manifest)+b'\n')
        os.rename(stage,output)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path)
    parser.add_argument('output',type=Path,help='fresh geometry release directory')
    parser.add_argument('countries',nargs=4,type=Path,help='verified small country geometry input artifacts')
    parser.add_argument('--md5',required=True,type=Path)
    parser.add_argument('--snapshot',required=True)
    parser.add_argument('--remove-source',action='store_true',help='remove the sibling CI input after subsetting, before allocating its location index')
    args = parser.parse_args()
    if args.output.exists():raise FileExistsError(args.output)
    inputs = load_inputs(args.countries)
    source_info = inspect_source(args.source,args.md5,'europe',args.snapshot)
    if shutil.disk_usage(args.source.parent).free < 25*1024**3:
        raise ValueError('Geometry subsetting requires 25 GiB free staging disk after download')
    m = build_geometry(args.source,inputs,args.output,source_info,remove_source=args.remove_source)
    print(encoded({'release':m['release'],'dataset':m['datasets']['geometry']}).decode(),flush=True)


if __name__ == '__main__':main()
