"""Bounded retention of publisher-owned files in the dedicated OSM directory."""
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
import posixpath
import re
import uuid

from tools.osm_data import publish as p

BUDGET = 80 * 1024**3
UPLOAD = '_upload.json'


def children(ftp, base='.'):
    names = [posixpath.basename(name) for name in ftp.nlst(base)]
    p.require(all(name not in {'', '.', '..'} and '/' not in name and '\\' not in name
                  and not any(ord(c)<32 for c in name) for name in names), 'Unsafe maintenance path')
    return sorted(names)


def timestamp(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    p.require(result.tzinfo is not None, 'Maintenance timestamp needs timezone')
    return result


def write_record(ftp, path, record):
    body = json.dumps(record, sort_keys=True).encode()
    temporary = path + '.' + uuid.uuid4().hex + '.tmp'
    ftp.storbinary('STOR '+temporary, io.BytesIO(body))
    p.require(p.retrieve(ftp, temporary)==body, 'Maintenance record readback differs')
    ftp.replace(temporary, path)


def prepare_publication(ftp, manifest, raw, previous, now=None):
    old = p.validate(json.loads(previous), pointed=True)['release'] if previous else None
    if old == manifest['release']:
        return  # Rechecking the live release must not erase its rollback predecessor.
    if 'maintenance' not in children(ftp):
        ftp.mkd('maintenance')
    p.require(ftp.kind('maintenance')=='directory', 'Maintenance needs a real directory')
    write_record(ftp, 'maintenance/p-'+manifest['release']+'.json', {
        'version':1, 'release':manifest['release'], 'manifest_sha256':hashlib.sha256(raw).hexdigest(),
        'published_at':(now or datetime.now(timezone.utc)).isoformat(), 'previous_release':old})


def pending_publication(ftp, manifest, raw, now):
    name='p-'+manifest['release']+'.json'
    if 'maintenance' not in children(ftp): return None
    p.require(ftp.kind('maintenance')=='directory','Maintenance needs a real directory')
    if name not in children(ftp,'maintenance'): return None
    p.require(ftp.kind('maintenance/'+name)=='file','Pending intent needs a regular file')
    record=json.loads(p.retrieve(ftp,'maintenance/'+name))
    p.require(record.get('version')==1 and record.get('release')==manifest['release']
              and record.get('manifest_sha256')==hashlib.sha256(raw).hexdigest(),'Pending intent manifest differs')
    previous=record.get('previous_release')
    p.require(previous is None or isinstance(previous,str) and p.NAME.fullmatch(previous)
              and previous!=manifest['release'],'Invalid pending predecessor')
    p.require(timestamp(record['published_at'])<=now,'Pending publication is in the future')
    return record


def record_publication(ftp, manifest, raw, previous, now=None):
    now=now or datetime.now(timezone.utc)
    record=pending_publication(ftp,manifest,raw,now)
    if record is None:
        p.require(previous and json.loads(previous)['release']==manifest['release'],
                  'Missing recoverable publication intent')
        return
    p.require(p.validate(json.loads(p.retrieve(ftp,'current.json')),pointed=True)==p.current(manifest),
              'Live pointer differs before publication receipt')
    record['published_at']=now.isoformat()
    write_record(ftp,'maintenance/r-'+manifest['release']+'.json',record)
    ftp.remove('maintenance/p-'+manifest['release']+'.json')


def mark_upload(ftp, stage, manifest, raw, now=None):
    record = {'version':1, 'release':manifest['release'], 'created_at':(now or datetime.now(timezone.utc)).isoformat(),
              'files':{f['path']:f['bytes'] for f in manifest['files']} | {'manifest.json':len(raw)}}
    ftp.storbinary('STOR '+stage+'/'+UPLOAD, io.BytesIO(json.dumps(record,sort_keys=True).encode()))


def usage(ftp, base='.', depth=0):
    p.require(depth<=4, 'Unexpected nested maintenance content')
    total=0
    for name in children(ftp, base):
        path=name if base=='.' else base+'/'+name
        kind=ftp.kind(path)
        p.require(kind in {'file','directory'}, 'Maintenance needs regular files and real directories (no symlinks)')
        total += ftp.size(path) if kind=='file' else usage(ftp,path,depth+1)
    return total


def upload_record(ftp, base, release, now):
    p.require(ftp.kind(base+'/'+UPLOAD)=='file','Upload receipt needs a regular file')
    record=json.loads(p.retrieve(ftp,base+'/'+UPLOAD))
    p.require(record.get('version')==1 and record.get('release')==release, 'Invalid upload ownership record')
    stamp=timestamp(record['created_at'])
    p.require(stamp<=now and isinstance(record.get('files'),dict) and record['files'], 'Invalid upload metadata')
    for name,size in record['files'].items():
        p.require(p.NAME.fullmatch(name) and type(size) is int and size>=0, 'Unsafe upload file metadata')
    p.require('manifest.json' in record['files'] and 'LICENSE.txt' in record['files'], 'Incomplete upload metadata')
    return record,stamp


def validate_files(ftp,base,expected,partial=False):
    names=children(ftp,base)
    p.require(set(names)<=set(expected), 'Unexpected files in retained release')
    p.require(partial or set(names)==set(expected), 'Retained release files differ')
    for name in names:
        path=base+'/'+name
        p.require(ftp.kind(path)=='file', 'Retained release needs regular files')
        size=ftp.size(path)
        p.require(size<=expected[name] if partial else size==expected[name], 'Retained file size differs')
    return sum(ftp.size(base+'/'+name) for name in names)


def prune(ftp, apply=False, incoming_bytes=0, now=None, incoming_release=None):
    now=now or datetime.now(timezone.utc)
    p.require(type(incoming_bytes) is int and incoming_bytes>=0,'Invalid incoming byte budget')
    p.require(incoming_release is None or p.NAME.fullmatch(incoming_release),'Unsafe incoming release')
    p.require(ftp.kind('current.json')=='file','Live pointer needs a regular file')
    before=p.retrieve(ftp,'current.json')
    live=p.validate(json.loads(before),pointed=True)
    root=children(ftp)
    p.require('releases' in root and ftp.kind('releases')=='directory','Releases needs a real directory')
    releases=children(ftp,'releases')
    p.require(ftp.kind('releases/'+live['release'])=='directory'
              and ftp.kind('releases/'+live['release']+'/manifest.json')=='file','Live release needs regular files')
    raw=p.retrieve(ftp,'releases/'+live['release']+'/manifest.json')
    p.require(p.current(p.validate(json.loads(raw)))==live,'Live manifest differs before retention')
    pending=pending_publication(ftp,json.loads(raw),raw,now)
    records={}; manifests={}; keep={}; remove={}
    if 'maintenance' in root:
        p.require(ftp.kind('maintenance')=='directory','Maintenance needs a real directory')
        for name in children(ftp,'maintenance'):
            if not (name.startswith('r-') and name.endswith('.json')): continue
            release=name[2:-5]
            p.require(p.NAME.fullmatch(release),'Unsafe receipt release')
            if release not in releases: continue
            if release==live['release'] and pending: continue
            p.require(ftp.kind('maintenance/'+name)=='file','Receipt needs a regular file')
            record=json.loads(p.retrieve(ftp,'maintenance/'+name))
            p.require(record.get('version')==1 and record.get('release')==release,'Invalid publication receipt')
            p.require(re.fullmatch('[a-f0-9]{64}',record.get('manifest_sha256','')),'Invalid receipt digest')
            previous=record.get('previous_release')
            p.require(previous is None or isinstance(previous,str) and p.NAME.fullmatch(previous),'Invalid predecessor')
            stamp=timestamp(record['published_at']);p.require(stamp<=now,'Publication receipt is in the future')
            p.require(ftp.kind('releases/'+release)=='directory','Release needs a real directory')
            if not children(ftp,'releases/'+release):
                records[release]=(record,stamp);manifests[release]=(None,b'');continue
            body=p.retrieve(ftp,'releases/'+release+'/manifest.json')
            m=p.validate(json.loads(body))
            p.require(m['release']==release and hashlib.sha256(body).hexdigest()==record.get('manifest_sha256'),'Receipt manifest differs')
            records[release]=(record,stamp);manifests[release]=(m,body)
    if pending:
        records[live['release']]=(pending,timestamp(pending['published_at']))
        manifests[live['release']]=(json.loads(raw),raw)
    protected={live['release']}
    if incoming_release: protected.add(incoming_release)
    if live['release'] in records:
        previous=records[live['release']][0].get('previous_release')
        if previous:
            p.require(previous in releases,'Recorded predecessor is missing')
            protected.add(previous)
        protected.update(sorted(records,key=lambda key:records[key][1],reverse=True)[:2])
    for release in releases:
        base='releases/'+release
        p.require(p.NAME.fullmatch(release) and ftp.kind(base)=='directory','Unsafe release directory')
        if release in protected: keep[base]='live/predecessor/latest-two';continue
        if live['release'] not in records: keep[base]='live receipt unavailable';continue
        if release in records:
            if now-records[release][1]<=timedelta(days=28): keep[base]='within 28 days';continue
            m,body=manifests[release]
            if m is None:
                remove[base]=0;continue
            expected={f['path']:f['bytes'] for f in m['files']} | {'manifest.json':len(body)}
            if UPLOAD in children(ftp,base):
                upload_record(ftp,base,release,now);expected[UPLOAD]=ftp.size(base+'/'+UPLOAD)
            remove[base]=validate_files(ftp,base,expected,partial=True)
            p.require(all(ftp.size(base+'/'+name)==expected[name] for name in children(ftp,base)),
                      'Retained file size differs')
        elif UPLOAD in children(ftp,base):
            record,stamp=upload_record(ftp,base,release,now)
            if now-stamp<=timedelta(days=35): keep[base]='unrecorded final within 35 days';continue
            expected=record['files'] | {UPLOAD:ftp.size(base+'/'+UPLOAD)}
            remove[base]=validate_files(ftp,base,expected,partial=True)
        else: keep[base]='unmanaged; never delete'
    for stage in root:
        match=re.fullmatch(r'\.upload-([A-Za-z0-9][A-Za-z0-9._-]{0,120})-[a-f0-9]{32}',stage)
        if not match: continue
        if match[1]==incoming_release: keep[stage]='active resume';continue
        p.require(ftp.kind(stage)=='directory','Staging needs a real directory')
        if UPLOAD not in children(ftp,stage): keep[stage]='unmanaged staging';continue
        record,stamp=upload_record(ftp,stage,match[1],now)
        if now-stamp<=timedelta(days=7): keep[stage]='staging within 7 days';continue
        remove[stage]=validate_files(ftp,stage,record['files'] | {UPLOAD:ftp.size(stage+'/'+UPLOAD)},partial=True)
    used=usage(ftp)
    after=used-sum(remove.values())
    p.require(after+incoming_bytes+4096<=BUDGET,'OSM storage budget exceeded (80 GiB); retain live data and inspect storage')
    result={'delete':sorted(remove),'keep':keep,'bytes_before':used,'bytes_after':after,'incoming_bytes':incoming_bytes,
            'applied':apply,'recover_receipt':live['release'] if pending else None}
    if apply:
        p.require(p.retrieve(ftp,'current.json')==before,'Live pointer changed before retention')
        if pending: record_publication(ftp,json.loads(raw),raw,None,now=now)
        for base in result['delete']:
            p.require(p.retrieve(ftp,'current.json')==before,'Live pointer changed during retention')
            # Keep ownership metadata until payload deletion finishes, so interruption is recoverable.
            last='manifest.json' if base.startswith('releases/') and base.split('/')[-1] in records else UPLOAD
            for name in sorted(children(ftp,base),key=lambda name:name==last):
                ftp.remove(base+'/'+name)
            ftp.rmd(base)
    return result


def test_retention(ftp):
    """Run only inside test_host's newly created disposable working directory."""
    now=datetime.now(timezone.utc)
    ftp.mkd('releases')
    content={'ways.pmtiles':b'PMTiles retention test','LICENSE.txt':b'OSM contributors, ODbL'}
    for release,days in [('expired',50),('previous',7),('live',0)]:
        files=[{'path':name,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()} for name,body in content.items()]
        m=p.validate({'schema':1,'release':release,'source':{'timestamp':now.isoformat()},'files':files,
                      'datasets':{'ways':{'url':'ways.pmtiles','bytes':files[0]['bytes'],'sha256':files[0]['sha256']}}})
        raw=json.dumps(m,sort_keys=True).encode();base='releases/'+release;ftp.mkd(base)
        for name,body in content.items(): ftp.storbinary('STOR '+base+'/'+name,io.BytesIO(body))
        ftp.storbinary('STOR '+base+'/manifest.json',io.BytesIO(raw))
        previous=json.dumps(p.current(dict(m,release='previous'))).encode() if release=='live' else None
        prepare_publication(ftp,m,raw,previous,now=now-timedelta(days=days))
        ftp.storbinary('STOR current.json',io.BytesIO(json.dumps(p.current(m),sort_keys=True).encode()))
        record_publication(ftp,m,raw,previous,now=now-timedelta(days=days))
        if release=='live':
            pointer=json.dumps(p.current(m),sort_keys=True).encode()
            ftp.storbinary('STOR current.json',io.BytesIO(pointer))
    stage='.upload-live-'+'a'*32;ftp.mkd(stage)
    mark_upload(ftp,stage,m,raw,now=now-timedelta(days=8))
    ftp.storbinary('STOR '+stage+'/ways.pmtiles',io.BytesIO(b'PM'))
    preview=prune(ftp,now=now)
    p.require(set(preview['delete'])=={'releases/expired',stage},'Disposable retention preview differs')
    p.require('expired' in children(ftp,'releases'),'Retention preview wrote files')
    applied=prune(ftp,apply=True,now=now)
    p.require(children(ftp,'releases')==['live','previous'] and p.retrieve(ftp,'current.json')==pointer,
              'Disposable retention affected protected releases')
    return {'deleted_entries':len(applied['delete']),'live_and_predecessor_preserved':True,'preview_read_only':True}
