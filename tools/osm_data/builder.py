#!/usr/bin/env python3
"""Build immutable OSM feature archives from complete Geofabrik country PBFs."""

import argparse
from contextlib import closing
from datetime import datetime, timedelta, timezone
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import re
import resource
import sqlite3
import sys
import tempfile
import time

import osmium
from pmtiles.reader import MmapSource, Reader, all_tiles
from pmtiles.tile import Compression, TileType, tileid_to_zxy, zxy_to_tileid
from pmtiles.writer import Writer

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools.osm_data.geometry import area_tags, inspectable, encoded as json_bytes


ZOOM = 14
SIDE = 1 << ZOOM
SOURCE_URL = 'https://download.geofabrik.de/europe/finland-latest.osm.pbf'
KINDS = re.compile(r'^(trunk|primary|secondary|tertiary|unclassified|residential|'
                   r'living_street|service|pedestrian|track|path|footway|cycleway|'
                   r'bridleway|steps)(_link)?$')
ROUTES = {'hiking', 'foot', 'bicycle', 'mtb', 'running', 'ski', 'fitness_trail'}
SAMPLES = {
    'Helsinki': (24.9384, 60.1699),
    'Rural central Finland': (25.5, 62.2),
    'Nuuksio forest': (24.5, 60.3),
    'Turku coast': (22.25, 60.45),
    'Kilpisjarvi north': (20.8, 69.05),
}
COUNTRIES = ('finland', 'sweden', 'norway', 'estonia')
COUNTRY_SAMPLES = {
    'finland': SAMPLES,
    'sweden': {'Stockholm': (18.0686,59.3293), 'Kiruna': (20.225,67.855), 'Gothenburg': (11.9746,57.7089)},
    'norway': {'Oslo': (10.7522,59.9139), 'Bergen': (5.3221,60.393), 'Tromso': (18.9553,69.6492)},
    'estonia': {'Tallinn': (24.7536,59.437), 'Tartu': (26.7251,58.3776), 'Narva': (28.1903,59.3772)},
}


def parse_poly(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    polygons, holes = [], []
    i = 1
    while i < len(lines) and lines[i] != 'END':
        hole = lines[i].startswith('!')
        i += 1
        ring = []
        while i < len(lines) and lines[i] != 'END':
            point = [float(v) for v in lines[i].split()]
            if len(point) != 2 or not all(math.isfinite(v) for v in point) or abs(point[0]) > 180 or abs(point[1]) > 90:
                raise ValueError('Invalid clipping polygon coordinate')
            ring.append(point)
            i += 1
        if len(ring) < 3 or i == len(lines):
            raise ValueError('Incomplete clipping polygon ring')
        if ring[0] != ring[-1]:
            ring.append(ring[0])
        if len(ring) < 4:
            raise ValueError('Incomplete clipping polygon ring')
        if hole:
            holes.append(ring)
        else:
            polygons.append([ring])
        i += 1
    if not polygons or i != len(lines)-1 or lines[i] != 'END':
        raise ValueError('Incomplete clipping polygon')
    for hole in holes:
        x,y = hole[0]
        owners = []
        for rings in polygons:
            inside = False
            for (a,b),(c,d) in zip(rings[0],rings[0][1:]):
                if (b>y)!=(d>y) and x < (c-a)*(y-b)/(d-b)+a:
                    inside = not inside
            if inside:
                owners.append(rings)
        if len(owners) != 1:
            raise ValueError('Clipping polygon hole has no unique outer ring')
        owners[0].append(hole)
    return {'type':'Polygon' if len(polygons)==1 else 'MultiPolygon',
            'coordinates':polygons[0] if len(polygons)==1 else polygons}


ATTRIBUTION = '© OpenStreetMap contributors'
LICENSE = {
    'name': 'Open Database License 1.0',
    'url': 'https://opendatacommons.org/licenses/odbl/1-0/',
}
PRODUCT_ZOOMS = {'trails': 13, 'winter': 12, 'hazards': 11, 'places': 12, 'inspection': 14}
BARRIERS = set(('gate lift_gate swing_gate sliding_gate wicket_gate hampshire_gate bump_gate chain rope bar block '
                'stile kissing_gate turnstile horse_stile full-height_turnstile cycle_barrier motorcycle_barrier '
                'log fallen_tree windfall debris').split())


def is_stay(tags):
    return (tags.get('tourism') in {'camp_site', 'wilderness_hut', 'alpine_hut'} or
            tags.get('amenity') == 'shelter' and tags.get('shelter_type') in {'lean_to', 'basic_hut'})


def products(kind, tags):
    result = []
    h = tags.get('highway')
    if kind == 'node':
        trail = (tags.get('barrier') in BARRIERS or 'obstacle' in tags or
                 'ford' in tags and tags['ford'] != 'no')
        hazard = tags.get('seamark:type') in {'rock', 'obstruction', 'wreck'} or tags.get('natural') in {'rock', 'reef', 'shoal'}
    else:
        trail = (h in {'path', 'bridleway', 'steps'} or
                 h in {'footway', 'track', 'cycleway'} and
                 (h == 'footway' and 'mtb:scale' in tags or
                  any(tags.get(k) for k in ['obstacle', 'ford', 'mtb:scale:uphill']) or
                  tags.get('surface') == 'mud' or h == 'track' and 'trail_visibility' in tags) or
                 tags.get('barrier') in {'fence', 'wall', 'hedge', 'city_wall'})
        hazard = tags.get('natural') in {'reef', 'shoal'} or tags.get('seamark:type') in {'rock', 'obstruction'}
        if ('mtb:winter' in tags or any(tags.get(k) for k in ['snowplowing', 'winter_service', 'bicycle:winter', 'foot:winter']) or
                tags.get('seasonal') == 'winter' or tags.get('piste:type') == 'nordic'):
            result.append('winter')
    if trail:
        result.append('trails')
    if hazard:
        result.append('hazards')
    if is_stay(tags):
        result.append('places')
    if h or inspectable(tags) or result:
        result.append('inspection')
    return result


class PlaceRelations(osmium.SimpleHandler):
    """Find the small set of member geometries needed for overnight relation centres."""
    def __init__(self):
        super().__init__()
        self.relations = {}
        self.inspection = {}

    def relation(self, rel):
        if inspectable(rel.tags):
            self.inspection[rel.id] = dict(rel.tags)
        self.relations[rel.id] = (dict(rel.tags) if is_stay(rel.tags) else None,
                                  [(m.type, m.ref, m.role) for m in rel.members])

    def wanted(self):
        needed = set()
        def visit(ref):
            if ('r', ref) in needed:
                return
            needed.add(('r', ref))
            for kind, child, _ in self.relations.get(ref, (None, []))[1]:
                if kind == 'r':
                    visit(child)
                else:
                    needed.add((kind, child))
        for ref, (tags, _) in self.relations.items():
            if tags is not None or ref in self.inspection:
                visit(ref)
        self.relations = {ref: value for ref, value in self.relations.items() if ('r', ref) in needed}
        return needed
LICENSE_TEXT = '''Polku OSM roads, paths, lighting and outdoor details

© OpenStreetMap contributors. Source: the Geofabrik country extracts identified in manifest.json.
https://www.openstreetmap.org/copyright
https://download.geofabrik.de/europe.html

This database is made available under the Open Database License (ODbL) 1.0.
https://opendatacommons.org/licenses/odbl/1-0/
Attribution must remain visible in applications using this database. The
ODbL's share-alike and offer-of-database provisions apply where required.
Retain the source PBF identified by manifest.json to reproduce this release.

The archive preserves complete eligible ways without clipping or geometric
simplification. Its rectangular bounds describe the extract's extent; they
do not promise coverage outside the declared extract clipping polygons.

Road/path relation records contain only the eligible way members present in each tile. Overnight place records retain their original member references and roles.
member_count is the original relation member count; each member's index is
its zero-based position in that original list. Roles are unchanged. Node
members (including restriction via-nodes), relation members and off-tile way
members are omitted. The original source PBF retains the complete relations.
These memberships are descriptive data, not a routing restriction engine.
'''


def tile_point(lon, lat):
    if not math.isfinite(lon) or not math.isfinite(lat) or not -180 <= lon <= 180 or not -85.05112878 <= lat <= 85.05112878:
        raise ValueError(f'Invalid Web Mercator geometry: {lon}, {lat}')
    return ((lon + 180) / 360 * SIDE,
            (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * SIDE)


def segment_tiles(a, b):
    """Supercover in tile coordinates, including both sides of exact borders."""
    ax, ay = a
    bx, by = b
    times = {0.0, 1.0}
    for start, end in ((ax, bx), (ay, by)):
        if start != end:
            for boundary in range(math.floor(min(start, end)) + 1,
                                  math.ceil(max(start, end))):
                times.add((boundary - start) / (end - start))
    times = sorted(times)
    points = times + [(left + right) / 2 for left, right in zip(times, times[1:])]
    tiles = set()
    for t in points:
        x, y = ax + (bx - ax) * t, ay + (by - ay) * t
        xs = (math.floor(x),)
        ys = (math.floor(y),)
        if abs(x - round(x)) < 1e-10:
            xs = (round(x) - 1, round(x))
        if abs(y - round(y)) < 1e-10:
            ys = (round(y) - 1, round(y))
        tiles.update((x, y) for x in xs for y in ys
                     if 0 <= x < SIDE and 0 <= y < SIDE)
    return tiles


class Stager(osmium.SimpleHandler):
    def __init__(self, db, places):
        super().__init__()
        self.db = db
        self.source_nodes = 0
        self.source_ways = 0
        self.source_relations = 0
        self.ways = 0
        self.lit_ways = 0
        self.node_references = 0
        self.bounds = [180.0, 90.0, -180.0, -90.0]
        self.tile_ids = {}
        self.places = places
        self.needed = places.wanted()
        self.member_bounds = {}
        self.incomplete_inspection = 0

    def identity(self, element):
        self.db.execute('INSERT INTO identities VALUES (?, ?, ?)',
                        (element['type'], element['id'], hashlib.sha256(json_bytes(element)).hexdigest()))

    def geometry_root(self, kind, ref, area, inspection):
        if area or inspection:
            self.db.execute('INSERT INTO geometry_roots VALUES (?,?,?,?)',(kind,ref,int(area),int(inspection)))

    def product(self, names, element, xy_tiles):
        if not names:
            return
        self.db.execute('INSERT INTO features VALUES (?, ?, ?)',
                        (element['type'], element['id'], json_bytes(element)))
        for name in names:
            zoom = PRODUCT_ZOOMS[name]
            factor = 2 ** (ZOOM - zoom)
            self.db.executemany('INSERT INTO tile_features VALUES (?, ?, ?, ?)',
                [(name, zxy_to_tileid(zoom, x, y), element['type'], element['id'])
                 for x, y in {(x // factor, y // factor) for x, y in xy_tiles}])

    def node(self, node):
        self.source_nodes += 1
        if not node.tags and ('n', node.id) not in self.needed:
            return
        names = products('node', node.tags)
        if not names and ('n', node.id) not in self.needed:
            return
        if not node.location.valid():
            raise ValueError(f'Missing geometry: node {node.id}')
        lon, lat = round(node.lon, 7), round(node.lat, 7)
        if ('n', node.id) in self.needed:
            self.member_bounds['n', node.id] = [lon, lat, lon, lat]
        xy = tile_point(lon, lat)
        element = {'type':'node','id':node.id,'lon':lon,'lat':lat,'tags':dict(node.tags)}
        self.identity(element)
        self.geometry_root('node',node.id,False,inspectable(node.tags))
        self.product(names, element, segment_tiles(xy,xy))

    def way(self, way):
        self.source_ways += 1
        primary = bool(KINDS.fullmatch(way.tags.get('highway', '')))
        lighting = bool(way.tags.get('highway')) and 'lit' in way.tags
        names = products('way', way.tags)
        area = area_tags(way.tags) and len(way.nodes)>=4 and way.is_closed()
        if not area and not primary and not lighting and not names and ('w', way.id) not in self.needed:
            return
        nodes, geometry, projected = [], [], []
        for node in way.nodes:
            if not node.location.valid():
                raise ValueError(f'Missing geometry: way {way.id}, node {node.ref}')
            lon, lat = round(node.lon, 7), round(node.lat, 7)
            nodes.append(node.ref)
            geometry.append({'lon': lon, 'lat': lat})
            projected.append(tile_point(lon, lat))
            self.bounds[0] = min(self.bounds[0], lon)
            self.bounds[1] = min(self.bounds[1], lat)
            self.bounds[2] = max(self.bounds[2], lon)
            self.bounds[3] = max(self.bounds[3], lat)
        if len(nodes) < 2:
            raise ValueError(f'Incomplete geometry: way {way.id} has fewer than two nodes')
        body = json_bytes({'type': 'way', 'id': way.id,
                           'tags': dict(way.tags), 'nodes': nodes, 'geometry': geometry})
        self.identity(json.loads(body))
        self.geometry_root('way',way.id,area,inspectable(way.tags))
        if primary or lighting:
            self.db.execute('INSERT INTO ways VALUES (?, ?, ?)', (way.id, body, int(primary)))
        tiles = set()
        for a, b in zip(projected, projected[1:]):
            tiles.update(segment_tiles(a, b))
        if ('w', way.id) in self.needed or 'places' in names or 'inspection' in names:
            bounds = [min(p['lon'] for p in geometry), min(p['lat'] for p in geometry),
                      max(p['lon'] for p in geometry), max(p['lat'] for p in geometry)]
            if ('w', way.id) in self.needed:
                self.member_bounds['w', way.id] = bounds
        element = json.loads(body)
        if 'places' in names or 'inspection' in names:
            element['center'] = {'lon': round((bounds[0] + bounds[2]) / 2, 7), 'lat': round((bounds[1] + bounds[3]) / 2, 7)}
            # A way's centre can be away from its edges; nearby searches index both.
            p = tile_point(element['center']['lon'], element['center']['lat'])
            tiles.update(segment_tiles(p, p))
        self.product(names, element, tiles)
        for enabled, table, zoom in [(primary, 'tile_ways', ZOOM), (lighting, 'tile_lit', 13)]:
            if not enabled:
                continue
            xy_tiles = tiles if zoom == ZOOM else {(x // 2, y // 2) for x, y in tiles}
            records = []
            for x, y in xy_tiles:
                key = (zoom, x, y)
                if key not in self.tile_ids:
                    self.tile_ids[key] = zxy_to_tileid(*key)
                records.append((self.tile_ids[key], way.id))
            self.db.executemany(f'INSERT INTO {table} VALUES (?, ?)', records)
        self.lit_ways += int(lighting)
        if primary:
            self.ways += 1
            self.node_references += len(nodes)
        if self.source_ways % 10000 == 0:
            self.db.commit()
            if self.ways % 100000 == 0:
                print(f'Staged {self.ways:,} eligible ways', flush=True)

    def relation(self, relation):
        self.source_relations += 1
        kind = relation.tags.get('type')
        area = (area_tags(relation.tags) and kind in {'multipolygon','boundary'} and
                any(m.type in {'w','r'} and m.role in {'','outer','inner'} for m in relation.members))
        self.geometry_root('relation',relation.id,area,inspectable(relation.tags))
        if area or ('r',relation.id) in self.needed or kind == 'restriction' or kind == 'route' and relation.tags.get('route') in ROUTES:
            self.identity({'type':'relation','id':relation.id,'tags':dict(relation.tags),
                           'members':[{'type':{'n':'node','w':'way','r':'relation'}[m.type],'ref':m.ref,'role':m.role} for m in relation.members]})
        if not (kind == 'restriction' or
                (kind == 'route' and relation.tags.get('route') in ROUTES)):
            return
        members = [(member.ref, relation.id, index, member.role)
                   for index, member in enumerate(relation.members) if member.type == 'w']
        if not members:
            return
        self.db.execute('INSERT INTO relations VALUES (?, ?, ?)',
                        (relation.id, json_bytes(dict(relation.tags)), len(relation.members)))
        self.db.executemany('INSERT INTO members VALUES (?, ?, ?, ?)', members)

    def finish_places(self):
        def bounds_of(kind, ref, stack):
            if kind != 'r':
                return self.member_bounds.get((kind, ref))
            if ref in stack or ref not in self.places.relations:
                return None
            parts = [bounds_of(k, r, stack | {ref}) for k, r, _ in self.places.relations[ref][1]]
            if not parts or any(p is None for p in parts):
                return None
            return [min(p[0] for p in parts), min(p[1] for p in parts), max(p[2] for p in parts), max(p[3] for p in parts)]
        for ref, (tags, members) in self.places.relations.items():
            inspection = self.places.inspection.get(ref)
            if tags is None and inspection is None:
                continue
            bounds = bounds_of('r', ref, set())
            if bounds is None and tags is not None:
                raise ValueError(f'Incomplete overnight place relation {ref}')
            incomplete = bounds is None
            if incomplete:
                self.incomplete_inspection += 1
                known = [self.member_bounds.get((k,r)) for k,r,_ in members if k != 'r']
                known = [p for p in known if p]
                if not known:
                    continue
                bounds = [min(p[0] for p in known), min(p[1] for p in known), max(p[2] for p in known), max(p[3] for p in known)]
            center = {'lon': round((bounds[0] + bounds[2]) / 2, 7), 'lat': round((bounds[1] + bounds[3]) / 2, 7)}
            point = tile_point(center['lon'], center['lat'])
            names = (['places'] if tags is not None else []) + (['inspection'] if inspection is not None else [])
            tiles = segment_tiles(point, point)
            if inspection is not None:
                # Exact relation inspection can start on any member or in its interior, far from its centre.
                a, b = tile_point(bounds[0],bounds[3]), tile_point(bounds[2],bounds[1])
                tiles.update((x,y) for x in range(math.floor(a[0]),math.floor(b[0])+1)
                             for y in range(math.floor(a[1]),math.floor(b[1])+1))
            self.product(names, {'type': 'relation', 'id': ref, 'tags': tags or inspection, 'center': center,
                         'incomplete': incomplete,
                         'members': [{'type': {'n': 'node', 'w': 'way', 'r': 'relation'}[k], 'ref': r, 'role': role}
                                     for k, r, role in members]}, tiles)


def stage_source(source, db, index_path):
    db.executescript('''
        PRAGMA journal_mode=OFF;
        PRAGMA synchronous=OFF;
        PRAGMA cache_size=-65536;
        PRAGMA temp_store=FILE;
        CREATE TABLE identities (type TEXT, id INTEGER, sha256 TEXT NOT NULL, PRIMARY KEY(type,id)) WITHOUT ROWID;
        CREATE TABLE geometry_roots (type TEXT, id INTEGER, area INTEGER, inspection INTEGER, PRIMARY KEY(type,id)) WITHOUT ROWID;
        CREATE TABLE ways (id INTEGER PRIMARY KEY, body BLOB NOT NULL, primary_way INTEGER NOT NULL);
        CREATE TABLE features (type TEXT, id INTEGER, body BLOB NOT NULL, PRIMARY KEY(type,id)) WITHOUT ROWID;
        CREATE TABLE tile_features (dataset TEXT, tile INTEGER, type TEXT, id INTEGER,
            PRIMARY KEY(dataset,tile,type,id)) WITHOUT ROWID;
        CREATE TABLE tile_ways (tile INTEGER, way INTEGER,
            PRIMARY KEY (tile, way)) WITHOUT ROWID;
        CREATE TABLE tile_lit (tile INTEGER, way INTEGER,
            PRIMARY KEY (tile, way)) WITHOUT ROWID;
        CREATE TABLE relations (id INTEGER PRIMARY KEY, tags BLOB NOT NULL,
            member_count INTEGER NOT NULL);
        CREATE TABLE members (way INTEGER, relation INTEGER, position INTEGER,
            role TEXT NOT NULL, PRIMARY KEY (way, relation, position)) WITHOUT ROWID;
    ''')
    places = PlaceRelations()
    places.apply_file(str(source))
    handler = Stager(db, places)
    handler.apply_file(str(source), locations=True,
                       idx=f'sparse_file_array,{index_path}')
    handler.finish_places()
    db.commit()
    if not handler.ways:
        raise ValueError('Source has no eligible ways')
    return handler


def tile_relations(db, tile):
    relations = {}
    rows = db.execute('''
        SELECT r.id, r.tags, r.member_count, m.way, m.position, m.role
        FROM tile_ways tw JOIN members m ON m.way=tw.way
        JOIN relations r ON r.id=m.relation
        WHERE tw.tile=? ORDER BY r.id, m.position
    ''', (tile,))
    for rid, tags, count, way, position, role in rows:
        if rid not in relations:
            relations[rid] = {'type': 'relation', 'id': rid, 'tags': json.loads(tags),
                              'member_count': count, 'members': []}
        relations[rid]['members'].append({'type': 'way', 'ref': way,
                                         'role': role, 'index': position})
    return list(relations.values())


def distribution(values):
    values.sort()
    return {**{f'p{p}': values[math.ceil(len(values) * p / 100) - 1]
               for p in (50, 95, 99)}, 'max': values[-1], 'total': sum(values)}


def archive(db, output, source_info, bounds, *, lighting=False):
    sizes, raw_sizes, max_tile, max_bytes = [], [], None, -1
    relation_refs = 0
    with output.open('wb') as stream:
        writer = Writer(stream)
        table = 'tile_lit' if lighting else 'tile_ways'
        rows = iter(db.execute(f'''SELECT tw.tile, w.body FROM {table} tw
                                   JOIN ways w ON w.id=tw.way ORDER BY tw.tile, tw.way'''))
        pending = next(rows, None)
        while pending is not None:
            tile, ways = pending[0], []
            while pending is not None and pending[0] == tile:
                ways.append(pending[1])
                pending = next(rows, None)
            relations = [] if lighting else tile_relations(db, tile)
            relation_refs += len(relations)
            elements = ways + [json_bytes(relation) for relation in relations]
            raw = b'{"schema":1,"elements":[' + b','.join(elements) + b']}'
            data = gzip.compress(raw, compresslevel=6, mtime=0)
            writer.write_tile(tile, data)
            sizes.append(len(data))
            raw_sizes.append(len(raw))
            if len(data) > max_bytes:
                max_bytes, max_tile = len(data), list(tileid_to_zxy(tile))
        writer.finalize({
            'tile_type': TileType.UNKNOWN, 'tile_compression': Compression.GZIP,
            'min_lon_e7': round(bounds[0] * 1e7),
            'min_lat_e7': round(bounds[1] * 1e7),
            'max_lon_e7': round(bounds[2] * 1e7),
            'max_lat_e7': round(bounds[3] * 1e7),
        }, {
            'name': 'Polku OSM lighting' if lighting else 'Polku OSM roads and paths', 'format': 'json', 'schema': 1,
            'attribution': ATTRIBUTION, 'license': LICENSE,
            'source': source_info, 'bounds': bounds,
            'coverage': 'Complete intersecting ways from the declared extract; bounds are extent only.',
            'relations': 'Tile way members only; original member_count, zero-based member index and role. Non-way members, including restriction via-nodes, are omitted.',
            'geometry': 'Complete ways, original ordered node IDs, all tags, WGS84 coordinates to seven decimal places; no clipping or simplification.',
        })
    return {'tiles': len(sizes), 'tile_gzip_bytes': distribution(sizes),
            'tile_raw_bytes': distribution(raw_sizes), 'max_tile': max_tile,
            'relation_tile_references': relation_refs}


def validate_archive(path, expected_tiles, zoom=ZOOM, samples=SAMPLES):
    results = {}
    with path.open('rb') as stream:
        source = MmapSource(stream)
        reader = Reader(source)
        header = reader.header()
        if (header['addressed_tiles_count'] != expected_tiles or header['min_zoom'] != zoom or header['max_zoom'] != zoom or
                header['tile_type'] != TileType.UNKNOWN or
                header['tile_compression'] != Compression.GZIP):
            raise ValueError('Archive header validation failed')
        count = 0
        for _, data in all_tiles(source):
            raw = gzip.decompress(data)
            if not raw.startswith(b'{"schema":1,"elements":[') or not raw.endswith(b']}'):
                raise ValueError('Invalid tile JSON envelope')
            count += 1
        if count != expected_tiles:
            raise ValueError('Archive tile count validation failed')
        for name, (lon, lat) in samples.items():
            x, y = [math.floor(v / 2 ** (ZOOM - zoom)) for v in tile_point(lon, lat)]
            data = reader.get(zoom, x, y)
            elements = json.loads(gzip.decompress(data))['elements'] if data else []
            results[name] = {'lon': lon, 'lat': lat, 'tile': [zoom, x, y],
                             'gzip_bytes': len(data) if data else 0,
                             'raw_bytes': len(gzip.decompress(data)) if data else 0,
                             'ways': sum(e['type'] == 'way' for e in elements),
                             'relations': sum(e['type'] == 'relation' for e in elements)}
    return results


def archive_product(db, output, name, source_info, bounds):
    sizes, raw_sizes = [], []
    features = db.execute('SELECT count(DISTINCT type || "/" || id) FROM tile_features WHERE dataset=?', (name,)).fetchone()[0]
    max_bytes, max_tile = -1, None
    with output.open('wb') as stream:
        writer = Writer(stream)
        rows = iter(db.execute('''SELECT t.tile, f.body FROM tile_features t JOIN features f
            ON f.type=t.type AND f.id=t.id WHERE t.dataset=? ORDER BY t.tile,t.type,t.id''', (name,)))
        pending = next(rows, None)
        while pending is not None or not sizes:
            # The PMTiles writer requires one entry for an empty product; all other absent tiles decode as empty.
            tile = pending[0] if pending else zxy_to_tileid(PRODUCT_ZOOMS[name], 0, 0)
            elements = []
            while pending is not None and pending[0] == tile:
                elements.append(pending[1])
                pending = next(rows, None)
            raw = b'{"schema":1,"elements":[' + b','.join(elements) + b']}'
            data = gzip.compress(raw, compresslevel=6, mtime=0)
            if len(data) > 8 * 1024 * 1024 or len(raw) > 32 * 1024 * 1024:
                raise ValueError(f'{name} tile exceeds browser transfer/decode limit: {tileid_to_zxy(tile)}')
            writer.write_tile(tile, data)
            sizes.append(len(data))
            raw_sizes.append(len(raw))
            if len(data) > max_bytes:
                max_bytes, max_tile = len(data), list(tileid_to_zxy(tile))
        writer.finalize({'tile_type': TileType.UNKNOWN, 'tile_compression': Compression.GZIP,
                         'min_lon_e7': round(bounds[0]*1e7), 'min_lat_e7': round(bounds[1]*1e7),
                         'max_lon_e7': round(bounds[2]*1e7), 'max_lat_e7': round(bounds[3]*1e7)},
                        {'name': f'Polku OSM {name}', 'format': 'json', 'schema': 1,
                         'attribution': ATTRIBUTION, 'license': LICENSE, 'source': source_info})
    return {'archive_bytes': output.stat().st_size, 'features': features, 'tiles': len(sizes), 'tile_gzip_bytes': distribution(sizes),
            'tile_raw_bytes': distribution(raw_sizes), 'max_tile': max_tile}


def file_record(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return {'path': path.name, 'bytes': path.stat().st_size, 'sha256': digest.hexdigest()}


def check_finland(handler, source_info, db):
    west, south, east, north = handler.bounds
    relations = db.execute('''SELECT count(DISTINCT m.relation) FROM members m
                             JOIN ways w ON w.id=m.way WHERE w.primary_way=1''').fetchone()[0]
    tiles = db.execute('SELECT count(DISTINCT tile) FROM tile_ways').fetchone()[0]
    if (source_info['bytes'] < 100_000_000 or handler.source_nodes < 10_000_000 or
            handler.ways < 300_000 or relations < 100 or tiles < 20_000 or
            not (west < 20 and south < 60.5 and east > 31 and north > 69.5)):
        raise ValueError('Source fails complete-Finland count/extent checks')


def write_identities(db, path):
    with path.open('wb') as raw, gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as out:
        for row in db.execute('SELECT type,id,sha256 FROM identities ORDER BY type,id'):
            out.write(json_bytes(row)+b'\n')


def build_dataset(source, output, source_info, *, full_country=False, started=None, country='finland', coverage=None):
    """Build and atomically expose a fresh directory; fixture builds omit country gates."""
    if sys.version_info < (3, 14):
        raise RuntimeError('Python 3.14+ is required for deterministic PMTiles gzip headers')
    if country not in COUNTRIES:
        raise ValueError('Unsupported OSM country')
    samples = COUNTRY_SAMPLES[country] if full_country else SAMPLES
    started = time.monotonic() if started is None else started
    source, output = Path(source), Path(output)
    if output.exists():
        raise FileExistsError(f'Release already exists: {output}')
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=f'.{output.name}.', dir=output.parent) as tmp:
        tmp = Path(tmp)
        stage = tmp / 'release'
        stage.mkdir()
        with closing(sqlite3.connect(tmp / 'staging.sqlite')) as db:
            print(f'Staging {country} source', flush=True)
            stage_at = time.monotonic()
            handler = stage_source(source, db, tmp / 'nodes.idx')
            stage_seconds = time.monotonic() - stage_at
            print(f'Staged in {stage_seconds:.1f} s; writing archives', flush=True)
            if full_country:
                if country == 'finland':
                    check_finland(handler, source_info, db)
                elif source_info['bytes'] < 50_000_000 or handler.source_nodes < 1_000_000 or handler.ways < 100_000:
                    raise ValueError(f'Source fails complete-{country} count checks')
            stats = archive(db, stage / 'ways.pmtiles', source_info, handler.bounds)
            if handler.lit_ways:
                stats['lighting'] = archive(db, stage / 'lit.pmtiles', source_info, handler.bounds, lighting=True)
                stats['lighting']['ways'] = handler.lit_ways
            elif full_country:
                raise ValueError('Complete-Finland source has no lighting ways')
            stats['stage_seconds'] = stage_seconds
            stats['products'] = {}
            for name in PRODUCT_ZOOMS:
                print(f'Writing {country} {name} archive', flush=True)
                stats['products'][name] = archive_product(db, stage / f'{name}.pmtiles', name, source_info, handler.bounds)
            stats['products']['inspection']['incomplete_relations'] = handler.incomplete_inspection
            write_identities(db, stage / 'identities.jsonl.gz')
            with (stage/'geometry-roots.jsonl.gz').open('wb') as raw, gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0) as out:
                for kind,ref,area,inspection,sha in db.execute('''SELECT r.type,r.id,r.area,r.inspection,i.sha256
                        FROM geometry_roots r JOIN identities i ON i.type=r.type AND i.id=r.id ORDER BY r.type,r.id'''):
                    out.write(json_bytes([kind,ref,bool(area),bool(inspection),sha])+b'\n')
            stats['staging_allocated_bytes'] = sum(p.stat().st_blocks*512 for p in tmp.rglob('*') if p.is_file())
            stats.update({
                'source_nodes': handler.source_nodes, 'source_ways': handler.source_ways,
                'source_relations': handler.source_relations, 'ways': handler.ways,
                'eligible_node_references': handler.node_references,
                'relations': db.execute('''SELECT count(DISTINCT m.relation) FROM members m
                                          JOIN ways w ON w.id=m.way WHERE w.primary_way=1''').fetchone()[0],
                'way_tile_references': db.execute('SELECT count(*) FROM tile_ways').fetchone()[0],
            })
        stats['way_duplication_factor'] = stats['way_tile_references'] / stats['ways']
        stats['sample_tiles'] = validate_archive(stage / 'ways.pmtiles', stats['tiles'], samples=samples)
        if 'lighting' in stats:
            lit = stats['lighting']
            lit['sample_tiles'] = validate_archive(stage / 'lit.pmtiles', lit['tiles'], 13, samples=samples)
        if full_country and (not stats['sample_tiles'] or set(stats['sample_tiles']) != set(samples) or
                             any(not row['ways'] for row in stats['sample_tiles'].values())):
            raise ValueError(f'Complete-{country} archive is missing sample roads')
        stats['individual_gzip_json'] = {
            'files': stats['tiles'], 'total_bytes': stats['tile_gzip_bytes']['total'],
            'archive_bytes': (stage / 'ways.pmtiles').stat().st_size,
            'note': 'Same tile payloads; one file/upload per non-empty tile instead of one archive.',
        }
        datasets = {}
        for name, zoom in [('ways', ZOOM), ('lit', 13)]:
            if not (stage / f'{name}.pmtiles').exists():
                continue
            record = file_record(stage / f'{name}.pmtiles')
            datasets[name] = {'format': 'pmtiles-json', 'schema': 1, 'zoom': zoom,
                              'url': record['path'], 'bytes': record['bytes'], 'sha256': record['sha256'],
                              'tiles': stats['tiles'] if name == 'ways' else stats['lighting']['tiles']}
        for name, zoom in PRODUCT_ZOOMS.items():
            product = stats['products'][name]
            validate_archive(stage / f'{name}.pmtiles', product['tiles'], zoom, samples=samples)
            record = file_record(stage / f'{name}.pmtiles')
            datasets[name] = {'format': 'pmtiles-json', 'schema': 1, 'zoom': zoom, 'url': record['path'],
                              'bytes': record['bytes'], 'sha256': record['sha256'],
                              'tiles': product['tiles'], 'features': product['features']}
            if name == 'inspection':
                datasets[name]['nearby_complete'] = product['incomplete_relations'] == 0
        stats['build_seconds'] = round(time.monotonic() - started, 3)
        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        stats['peak_rss_bytes'] = peak if sys.platform == 'darwin' else peak * 1024
        (stage / 'measurements.json').write_bytes(json_bytes(stats) + b'\n')
        (stage / 'LICENSE.txt').write_text(LICENSE_TEXT, encoding='utf-8')
        if coverage is None and full_country:
            coverage = json.loads((Path(__file__).resolve().parents[2] / f'data/{country}-coverage.geojson').read_bytes())
        content_hash = hashlib.sha256(json_bytes({'datasets': datasets, 'coverage': coverage})).hexdigest()
        files = [file_record(stage / name) for name in
                 [*(d['url'] for d in datasets.values()), 'LICENSE.txt', 'measurements.json', 'identities.jsonl.gz', 'geometry-roots.jsonl.gz']]
        release = (source_info['timestamp'].replace('-', '').replace(':', '')
                   + '-' + source_info['sha256'][:12] + '-' + content_hash[:12])
        manifest = {
            'schema': 1, 'country': country, 'release': release,
            'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
            'source': source_info, 'bounds': handler.bounds,
            'datasets': datasets,
            'files': files, 'attribution': ATTRIBUTION, 'license': LICENSE,
        }
        if coverage:
            manifest['coverage'] = coverage
        (stage / 'manifest.json').write_bytes(json_bytes(manifest) + b'\n')
        if output.exists():
            raise FileExistsError(f'Release already exists: {output}')
        os.rename(stage, output)
    return manifest


def inspect_source(source, md5_file, country='finland', snapshot='latest'):
    if snapshot != 'latest' and not re.fullmatch('[0-9]{6}', snapshot):
        raise ValueError('Invalid OSM snapshot date')
    expected = Path(md5_file).read_text(encoding='ascii').strip()
    if not re.fullmatch(r'[0-9a-fA-F]{32}(?:[ \t]+\*?[^\r\n]+)?', expected):
        raise ValueError('Expected one MD5 checksum in --md5 file')
    expected = expected[:32].lower()
    md5, sha256 = hashlib.md5(), hashlib.sha256()
    with source.open('rb') as stream:
        while chunk := stream.read(1024 * 1024):
            md5.update(chunk)
            sha256.update(chunk)
    if md5.hexdigest() != expected:
        raise ValueError(f'MD5 checksum mismatch for {source}')
    with osmium.io.Reader(str(source)) as reader:
        timestamp = reader.header().get('osmosis_replication_timestamp')
    if not timestamp:
        raise ValueError('Source PBF lacks required replication timestamp')
    try:
        stamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    except ValueError as error:
        raise ValueError('Invalid source replication timestamp') from error
    now = datetime.now(timezone.utc)
    if stamp.tzinfo is None or not now - timedelta(days=14) <= stamp <= now + timedelta(days=1):
        raise ValueError('Source replication timestamp must be within 14 days and not in the future')
    timestamp = stamp.astimezone(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
    return {'url': f'https://download.geofabrik.de/europe/{country}-{snapshot}.osm.pbf', 'timestamp': timestamp,
            'sha256': sha256.hexdigest(), 'bytes': source.stat().st_size}


def build_release(source, output, md5_file, country='finland', coverage_file=None, snapshot='latest'):
    source, output = Path(source), Path(output)
    if output.exists():
        raise FileExistsError(f'Release already exists: {output}')
    started = time.monotonic()
    source_info = inspect_source(source, md5_file, country, snapshot)
    coverage = parse_poly(Path(coverage_file).read_text()) if coverage_file else None
    if coverage_file:
        source_info['coverage'] = {'url': f'https://download.geofabrik.de/europe/{country}.poly',
                                   'sha256': hashlib.sha256(Path(coverage_file).read_bytes()).hexdigest()}
    return build_dataset(source, output, source_info, full_country=True, started=started, country=country, coverage=coverage)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path, help='fresh immutable release directory')
    parser.add_argument('--md5', required=True, type=Path, help='Geofabrik .md5 checksum file')
    parser.add_argument('--country', choices=COUNTRIES, default='finland')
    parser.add_argument('--coverage', type=Path, help='matching Geofabrik .poly clipping extent')
    parser.add_argument('--snapshot', default='latest', help='Geofabrik latest or a consistent YYMMDD country snapshot')
    args = parser.parse_args()
    manifest = build_release(args.source, args.output, args.md5, args.country, args.coverage, args.snapshot)
    print(json.dumps({'release': manifest['release'], 'output': str(args.output),
                      'ways': manifest['datasets']['ways']}, indent=2), flush=True)


if __name__ == '__main__':
    main()
