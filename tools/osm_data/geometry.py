"""Local original OSM fragments and exact area containment for the hosted dataset."""
from collections import Counter, defaultdict
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import sqlite3
import resource
import sys
import tempfile
import time

import osmium
from pmtiles.tile import Compression, TileType, tileid_to_zxy, zxy_to_tileid
from pmtiles.writer import Writer

ZOOM = 13
SIDE = 1 << ZOOM
KINDS = {'n':'node', 'w':'way', 'r':'relation'}
AREA_VALUES = {'water', 'park', 'nature_reserve', 'recreation_ground', 'national_park', 'protected_area'}
INSPECT_KEYS = {'amenity', 'tourism', 'leisure', 'natural', 'barrier', 'ford', 'man_made', 'historic'}


def area_tags(tags):
    return any(tags.get(k) in AREA_VALUES for k in ('natural', 'leisure', 'boundary'))


def inspectable(tags):
    return any(tags.get(k) for k in INSPECT_KEYS)


def encoded(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()


def identity(value):
    return hashlib.sha256(encoded(value)).hexdigest()


def tile_xy(lon, lat):
    return [max(0, min(SIDE-1, math.floor(v))) for v in (
        (lon+180)/360*SIDE, (1-math.asinh(math.tan(math.radians(max(-85.05112878, min(85.05112878, lat)))))/math.pi)/2*SIDE)]


def tile_bounds(x, y):
    return [x/SIDE*360-180, latitude(y+1), (x+1)/SIDE*360-180, latitude(y)]


def latitude(y):
    return math.degrees(math.atan(math.sinh(math.pi*(1-2*y/SIDE))))


def bounds(points):
    return [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)] if points else None


def combine_bounds(boxes):
    return bounds([p for b in boxes if b for p in (b[:2], b[2:])])


def clip_segment(a, b, box):
    lo, hi = 0., 1.
    for axis in (0, 1):
        delta = b[axis]-a[axis]
        if not delta:
            if not box[axis] <= a[axis] <= box[axis+2]:
                return None
        else:
            left, right = sorted(((box[axis]-a[axis])/delta, (box[axis+2]-a[axis])/delta))
            lo, hi = max(lo, left), min(hi, right)
    return (lo, hi) if lo <= hi else None


def coverage_bounds(coverage):
    if coverage['type'] == 'GeometryCollection':
        return [b for c in coverage['geometries'] for b in coverage_bounds(c)]
    polygons = [coverage['coordinates']] if coverage['type'] == 'Polygon' else coverage['coordinates']
    return [bounds(p[0]) for p in polygons]


def segment_tiles(a, b, boxes):
    """Index original geographic segments; Mercator chords curve differently."""
    result = set()
    for box in boxes:
        clipped = clip_segment(a, b, box)
        if clipped is None:
            continue
        lo, hi = clipped
        p, q = [[a[i]+t*(b[i]-a[i]) for i in (0, 1)] for t in (lo, hi)]
        breaks = {lo, hi}
        px, py = tile_xy(*p); qx, qy = tile_xy(*q)
        if a[0] != b[0]:
            breaks.update((x/SIDE*360-180-a[0])/(b[0]-a[0]) for x in range(min(px,qx), max(px,qx)+2)
                          if lo <= (x/SIDE*360-180-a[0])/(b[0]-a[0]) <= hi)
        if a[1] != b[1]:
            breaks.update((latitude(y)-a[1])/(b[1]-a[1]) for y in range(min(py,qy), max(py,qy)+2)
                          if lo <= (latitude(y)-a[1])/(b[1]-a[1]) <= hi)
        steps = sorted(breaks)
        for t in steps + [(l+r)/2 for l,r in zip(steps,steps[1:])]:
            lon, lat = [a[i]+t*(b[i]-a[i]) for i in (0,1)]
            x, y = tile_xy(lon,lat)
            xx, yy = (lon+180)/360*SIDE, (1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*SIDE
            xs = {x, round(xx), round(xx)-1} if abs(xx-round(xx)) < 1e-9 else {x}
            ys = {y, round(yy), round(yy)-1} if abs(yy-round(yy)) < 1e-9 else {y}
            result.update((tx,ty) for tx in xs for ty in ys if 0 <= tx < SIDE and 0 <= ty < SIDE)
    return result


def contains_area(element, tile, ll):
    area = element['area']
    if not area['complete']:
        raise ValueError('Incomplete source area')
    east = tile_bounds(tile[1],tile[2])[2]
    x, y = ll
    for polygon in area['polygons']:
        inside = any(lo <= y < hi for lo,hi in polygon['right'])
        for fi, offset, _ in polygon['edges']:
            a,b = element['fragments'][fi]['geometry'][offset:offset+2]
            if (a[1]>y) != (b[1]>y):
                at = a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1])
                if x < at <= east:
                    inside = not inside
        if inside:
            return True
    return False


def ring_key(ring):
    ids = [p[0] for p in ring[:-1]]
    # Original node IDs are unique on ordinary rings. Ties retain deterministic winding.
    lowest = min(ids)
    rotations = []
    for seq in (ids, list(reversed(ids))):
        rotations.extend(seq[i:]+seq[:i] for i,n in enumerate(seq) if n == lowest)
    return identity(min(rotations))


def edge_counts(paths):
    return Counter(tuple(sorted((a,b))) for nodes in paths for a,b in zip(nodes,nodes[1:]) if a != b)


def same_boundary(expected, actual):
    if actual-expected:
        return False
    removed = expected-actual
    parent = {}
    def find(n):
        while n != parent.setdefault(n,n):
            parent[n] = parent[parent[n]]
            n = parent[n]
        return n
    for (a,b),count in removed.items():
        # Native assembly removes doubled spurs/shared borders; losing a cycle loses area.
        if count%2 or find(a) == find(b):
            return False
        parent[find(a)] = find(b)
    return True


class Source(osmium.SimpleHandler):
    """Store primitives/rings on disk so the build does not retain whole countries."""
    def __init__(self, db, roots, expected):
        super().__init__()
        self.db, self.roots, self.expected = db, roots, expected
        self.needed = set(roots)

    def put(self, e):
        key = e['type'],e['id']
        if key in self.expected and identity(e) != self.expected[key]:
            raise ValueError(f'Original identity mismatch: {key}')
        self.db.execute('INSERT INTO objects VALUES (?,?,?)', (*key,gzip.compress(encoded(e),mtime=0)))

    def node(self, n):
        if ('node',n.id) not in self.needed and ('node',n.id) not in self.expected:
            return
        self.put({'type':'node','id':n.id,'tags':dict(n.tags),'lon':round(n.lon,7),'lat':round(n.lat,7)})

    def way(self, w):
        if ('way',w.id) not in self.needed:
            return
        points = [{'lon':round(n.lon,7),'lat':round(n.lat,7)} if n.location.valid() else None for n in w.nodes]
        self.put({'type':'way','id':w.id,'tags':dict(w.tags),'nodes':[n.ref for n in w.nodes],'geometry':points})

    def area(self, a):
        key = 'way' if a.from_way() else 'relation', a.orig_id()
        if not self.roots.get(key,{}).get('area'):
            return
        rings = [[[[n.ref,round(n.lon,7),round(n.lat,7)] for n in ring]
                  for ring in [outer,*a.inner_rings(outer)]] for outer in a.outer_rings()]
        self.db.execute('INSERT OR REPLACE INTO areas VALUES (?,?,?)', (*key,gzip.compress(encoded(rings),mtime=0)))


def load(db, table, key):
    row = db.execute(f'SELECT body FROM {table} WHERE type=? AND id=?', key).fetchone()
    return json.loads(gzip.decompress(row[0])) if row else None


def leaves(db, key, path=(), seen=frozenset(), *, outline=False):
    obj = load(db,'objects',key)
    if obj is None or key in seen:
        return [], False
    if key[0] != 'relation':
        complete = key[0] == 'node' or len(obj['nodes']) >= 2 and all(obj['geometry'])
        return [(obj,list(path))], complete
    result, complete = [], True
    for i,m in enumerate(obj['members']):
        if outline and (m['role'] not in ('','outer','inner') or m['type'] == 'node'):
            continue
        child, ok = leaves(db,(m['type'],m['ref']), (*path,[key[1],i,m['type'],m['ref'],m['role'],len(obj['members'])]), seen | {key}, outline=outline)
        result.extend(child); complete = complete and ok
    return result, complete and bool(result)


def local_fragments(parts, boxes):
    tiles = defaultdict(list)
    for obj,path in parts:
        digest = identity(obj)
        if obj['type'] == 'node':
            point = [obj['lon'],obj['lat']]
            if any(b[0]<=point[0]<=b[2] and b[1]<=point[1]<=b[3] for b in boxes):
                tiles[tuple(tile_xy(*point))].append({'type':'node','ref':obj['id'],'identity':digest,'path':path,'point':point})
            continue
        per_tile = defaultdict(list)
        points = [[p['lon'],p['lat']] if p else None for p in obj['geometry']]
        for i,(a,b) in enumerate(zip(points,points[1:])):
            if a is not None and b is not None:
                for xy in segment_tiles(a,b,boxes):
                    per_tile[xy].append(i)
        for xy,indices in per_tile.items():
            start = previous = indices[0]
            for index in indices[1:]+[None]:
                if index is not None and index == previous+1:
                    previous = index
                    continue
                tiles[xy].append({'type':'way','ref':obj['id'],'identity':digest,'path':path,
                    'node_count':len(points),'start':start,'nodes':obj['nodes'][start:previous+2],
                    'geometry':points[start:previous+2]})
                start = previous = index
    return tiles


def add_area(tiles, rings, area_box, complete, boxes):
    """Attach parity seeds and pointers to original fragments, never clipped rings."""
    if not area_box:
        return
    left,top = tile_xy(area_box[0],area_box[3]);right,bottom = tile_xy(area_box[2],area_box[1])
    allowed = []
    for box in boxes:
        l,t = tile_xy(box[0],box[3]);r,b = tile_xy(box[2],box[1])
        allowed.append((max(l,left),max(t,top),min(r,right),min(b,bottom)))
    if not complete:
        for l,t,r,b in allowed:
            for x in range(l,r+1):
                for y in range(t,b+1):
                    tiles.setdefault((x,y),[])
        return
    for polygon in rings:
        polygon_id = ring_key(polygon[0])
        edge_roles = {tuple(sorted((a[0],b[0]))):bool(i) for i,ring in enumerate(polygon) for a,b in zip(ring,ring[1:]) if a[0]!=b[0]}
        polygon_box = bounds([p[1:] for p in polygon[0]])
        l,t = tile_xy(polygon_box[0],polygon_box[3]);r,last_y = tile_xy(polygon_box[2],polygon_box[1])
        for x in range(max(l,left),min(r,right)+1):
            east = tile_bounds(x,0)[2]
            ys = sorted(a[2]+(east-a[1])*(b[2]-a[2])/(b[1]-a[1])
                        for ring in polygon for a,b in zip(ring,ring[1:]) if min(a[1],b[1]) <= east < max(a[1],b[1]))
            if len(ys)%2:
                raise ValueError('Unpaired area crossings')
            intervals = list(zip(ys[::2],ys[1::2]))
            for y in range(t,last_y+1):
                xy = x,y
                if not any(lx<=x<=rx and ty<=y<=by for lx,ty,rx,by in allowed):
                    continue
                box = tile_bounds(x,y)
                right_intervals = [[lo,hi] for lo,hi in intervals if lo<=box[3] and hi>=box[1]]
                fragments = tiles.get(xy,[])
                edges, used = [], set()
                for fi,f in enumerate(fragments):
                    if f['type'] != 'way' or any(p[4] not in ('','outer','inner') for p in f['path']):
                        continue
                    for offset,(a,b) in enumerate(zip(f['nodes'],f['nodes'][1:])):
                        edge = tuple(sorted((a,b)))
                        role = edge_roles.get(edge)
                        if role is not None and edge not in used:
                            edges.append([fi,offset,role]);used.add(edge)
                if right_intervals or edges:
                    tiles.setdefault(xy,fragments)
                    yield xy, {'id':polygon_id,'right':right_intervals,'edges':edges}


def compile_geometry(source, roots, expected, output, source_info, coverages):
    output = Path(output)
    if output.exists():
        raise FileExistsError(output)
    started = time.monotonic()
    boxes = [b for c in coverages for b in coverage_bounds(c)]
    if not boxes:
        raise ValueError('Geometry needs declared coverage')
    report = {'dataset':{'kind':'geometry','schema':2,'zoom':ZOOM,'areas_complete':True,'nearby_complete':True},
              'incomplete_areas':[], 'incomplete_inspection':[]}
    with tempfile.TemporaryDirectory(prefix='geometry-',dir=output.parent) as tmp:
        db = sqlite3.connect(Path(tmp)/'stage.sqlite')
        try:
            db.executescript('PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; CREATE TABLE objects(type TEXT,id INTEGER,body BLOB,PRIMARY KEY(type,id)); CREATE TABLE areas(type TEXT,id INTEGER,body BLOB,PRIMARY KEY(type,id)); CREATE TABLE tiles(tile INTEGER,type TEXT,id INTEGER,body BLOB,PRIMARY KEY(tile,type,id));')
            handler = Source(db,roots,expected)
            # Native relation-only scan avoids storing the millions of way-location nodes.
            area_source = Path(tmp)/'area-relations.osm.pbf'
            with osmium.SimpleWriter(str(area_source)) as writer:
                for r in osmium.FileProcessor(str(source),osmium.osm.RELATION):
                    handler.put({'type':'relation','id':r.id,'tags':dict(r.tags),
                        'members':[{'type':KINDS[m.type],'ref':m.ref,'role':m.role} for m in r.members]})
                    if roots.get(('relation',r.id),{}).get('area'):
                        writer.add_relation(osmium.osm.mutable.Relation(r,members=[m for m in r.members
                            if m.type == 'w' and m.role in ('','outer','inner')]))
            pending = list(roots)
            while pending:
                key = pending.pop()
                if key[0] != 'relation':
                    continue
                obj = load(db,'objects',key)
                for m in obj['members'] if obj else []:
                    child = m['type'],m['ref']
                    if child not in handler.needed:
                        handler.needed.add(child);pending.append(child)
            locations = osmium.NodeLocationsForWays(osmium.index.create_map(f'sparse_file_array,{tmp}/nodes.idx'))
            locations.ignore_errors()
            manager = osmium.area.AreaManager()
            with osmium.io.Reader(str(area_source),osmium.osm.RELATION) as reader:
                osmium.apply(reader,manager.first_pass_handler())
            with osmium.io.Reader(str(source)) as reader:
                osmium.apply(reader,locations,handler,manager.second_pass_handler(handler))
            for key,purpose in sorted(roots.items()):
                obj = load(db,'objects',key)
                if obj is None:
                    if purpose['area']:
                        report['dataset']['areas_complete'] = False
                        report['incomplete_areas'].append({'type':key[0],'id':key[1],'bounds':None})
                    if purpose['inspection']:
                        report['dataset']['nearby_complete'] = False
                        report['incomplete_inspection'].append({'type':key[0],'id':key[1]})
                    continue
                parts, complete = leaves(db,key)
                generic_box = combine_bounds([bounds([[o['lon'],o['lat']]]) if o['type']=='node' else bounds([[p['lon'],p['lat']] for p in o['geometry'] if p]) for o,_ in parts])
                if purpose['inspection'] and not complete:
                    report['dataset']['nearby_complete'] = False
                    report['incomplete_inspection'].append({'type':key[0],'id':key[1]})
                base = {'type':key[0],'id':key[1],'tags':obj['tags'],'identity':identity(obj),
                        'inspection':purpose['inspection'],'incomplete':not complete,'bounds':generic_box if complete else None}
                if key[0]=='relation':base['member_count'] = len(obj['members'])
                tiles = local_fragments(parts,boxes)
                polygons = defaultdict(list)
                area_meta = None
                if purpose['area']:
                    outline, outline_complete = leaves(db,key,outline=True)
                    area_box = combine_bounds([bounds([[p['lon'],p['lat']] for p in o['geometry'] if p]) for o,_ in outline]) if outline_complete else None
                    rings = load(db,'areas',key) or []
                    expected_edges = edge_counts(o['nodes'] for o,_ in outline)
                    actual_edges = edge_counts([p[0] for p in ring] for polygon in rings for ring in polygon)
                    valid = bool(rings) and outline_complete and same_boundary(expected_edges,actual_edges)
                    if not area_box:report['dataset']['areas_complete'] = False
                    if not valid:report['incomplete_areas'].append({'type':key[0],'id':key[1],'bounds':area_box})
                    area_meta = {'complete':valid,'bounds':area_box}
                    for xy,polygon in add_area(tiles,rings,area_box,valid,boxes):
                        polygons[xy].append(polygon)
                for xy,fragments in sorted(tiles.items()):
                    element = dict(base,fragments=fragments)
                    if area_meta is not None:element['area'] = dict(area_meta,polygons=polygons[xy])
                    db.execute('INSERT INTO tiles VALUES (?,?,?,?)',(zxy_to_tileid(ZOOM,*xy),*key,encoded(element)))
                db.commit()
            sizes, raw_sizes = [], []
            staged = Path(tmp)/'geometry.pmtiles'
            with staged.open('wb') as stream:
                writer = Writer(stream)
                rows = iter(db.execute('SELECT tile,body FROM tiles ORDER BY tile,type,id'))
                row = next(rows,None)
                while row is not None or not sizes:
                    tid = row[0] if row else zxy_to_tileid(ZOOM,0,0)
                    elements = []
                    while row and row[0]==tid:
                        elements.append(json.loads(row[1]));row = next(rows,None)
                    raw = encoded({'schema':2,'tile':list(tileid_to_zxy(tid)),'elements':elements})
                    data = gzip.compress(raw,compresslevel=6,mtime=0)
                    if len(data)>8*1024**2 or len(raw)>32*1024**2:
                        raise ValueError(f'Geometry tile exceeds browser limit: {tileid_to_zxy(tid)}')
                    writer.write_tile(tid,data);sizes.append(len(data));raw_sizes.append(len(raw))
                box = combine_bounds(boxes)
                writer.finalize({'tile_type':TileType.UNKNOWN,'tile_compression':Compression.GZIP,
                    'min_lon_e7':round(box[0]*1e7),'min_lat_e7':round(box[1]*1e7),
                    'max_lon_e7':round(box[2]*1e7),'max_lat_e7':round(box[3]*1e7)},
                    {'name':'Polku OSM geometry','format':'json','schema':2,'source':source_info,
                     'attribution':'© OpenStreetMap contributors','license':{'name':'Open Database License 1.0','url':'https://opendatacommons.org/licenses/odbl/1-0/'}})
            report['staging_allocated_bytes'] = sum(p.stat().st_blocks*512 for p in Path(tmp).rglob('*') if p.is_file())
            peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            report['peak_rss_bytes'] = peak if sys.platform == 'darwin' else peak*1024
            os.rename(staged,output)
            report.update(seconds=time.monotonic()-started,archive_bytes=output.stat().st_size,tiles=len(sizes),max_tile_gzip_bytes=max(sizes),max_tile_raw_bytes=max(raw_sizes))
            return report
        finally:
            db.close()
