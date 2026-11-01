#!/usr/bin/env python3
"""Build an immutable Finland roads/path release from the full Geofabrik PBF."""

import argparse
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
ATTRIBUTION = '© OpenStreetMap contributors'
LICENSE = {
    'name': 'Open Database License 1.0',
    'url': 'https://opendatacommons.org/licenses/odbl/1-0/',
}
LICENSE_TEXT = '''Polku Finland roads and paths

© OpenStreetMap contributors. Source: Geofabrik's complete Finland extract.
https://www.openstreetmap.org/copyright
https://download.geofabrik.de/europe/finland.html

This database is made available under the Open Database License (ODbL) 1.0.
https://opendatacommons.org/licenses/odbl/1-0/
Attribution must remain visible in applications using this database. The
ODbL's share-alike and offer-of-database provisions apply where required.
Retain the source PBF identified by manifest.json to reproduce this release.

The archive preserves complete eligible ways without clipping or geometric
simplification. Its rectangular bounds describe the extract's extent; they
do not promise coverage outside the buffered Finland extract.

Relations contain only the eligible way members present in each tile.
member_count is the original relation member count; each member's index is
its zero-based position in that original list. Roles are unchanged. Node
members (including restriction via-nodes), relation members and off-tile way
members are omitted. The original source PBF retains the complete relations.
These memberships are descriptive data, not a routing restriction engine.
'''


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(',', ':'), allow_nan=False).encode('utf-8')


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
    def __init__(self, db):
        super().__init__()
        self.db = db
        self.source_nodes = 0
        self.source_ways = 0
        self.source_relations = 0
        self.ways = 0
        self.node_references = 0
        self.bounds = [180.0, 90.0, -180.0, -90.0]
        self.tile_ids = {}

    def node(self, node):
        self.source_nodes += 1

    def way(self, way):
        self.source_ways += 1
        if not KINDS.fullmatch(way.tags.get('highway', '')):
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
        self.db.execute('INSERT INTO ways VALUES (?, ?)', (way.id, body))
        tiles = set()
        for a, b in zip(projected, projected[1:]):
            tiles.update(segment_tiles(a, b))
        records = []
        for xy in tiles:
            if xy not in self.tile_ids:
                self.tile_ids[xy] = zxy_to_tileid(ZOOM, *xy)
            records.append((self.tile_ids[xy], way.id))
        self.db.executemany('INSERT INTO tile_ways VALUES (?, ?)', records)
        self.ways += 1
        self.node_references += len(nodes)
        if self.ways % 10000 == 0:
            self.db.commit()
            if self.ways % 100000 == 0:
                print(f'Staged {self.ways:,} eligible ways', flush=True)

    def relation(self, relation):
        self.source_relations += 1
        kind = relation.tags.get('type')
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


def stage_source(source, db, index_path):
    db.executescript('''
        PRAGMA journal_mode=OFF;
        PRAGMA synchronous=OFF;
        PRAGMA cache_size=-65536;
        PRAGMA temp_store=FILE;
        CREATE TABLE ways (id INTEGER PRIMARY KEY, body BLOB NOT NULL);
        CREATE TABLE tile_ways (tile INTEGER, way INTEGER,
            PRIMARY KEY (tile, way)) WITHOUT ROWID;
        CREATE TABLE relations (id INTEGER PRIMARY KEY, tags BLOB NOT NULL,
            member_count INTEGER NOT NULL);
        CREATE TABLE members (way INTEGER, relation INTEGER, position INTEGER,
            role TEXT NOT NULL, PRIMARY KEY (way, relation, position)) WITHOUT ROWID;
    ''')
    handler = Stager(db)
    handler.apply_file(str(source), locations=True,
                       idx=f'sparse_file_array,{index_path}')
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


def archive(db, output, source_info, bounds):
    sizes, raw_sizes, max_tile, max_bytes = [], [], None, -1
    relation_refs = 0
    with output.open('wb') as stream:
        writer = Writer(stream)
        rows = iter(db.execute('''SELECT tw.tile, w.body FROM tile_ways tw
                                  JOIN ways w ON w.id=tw.way ORDER BY tw.tile, tw.way'''))
        pending = next(rows, None)
        while pending is not None:
            tile, ways = pending[0], []
            while pending is not None and pending[0] == tile:
                ways.append(pending[1])
                pending = next(rows, None)
            relations = tile_relations(db, tile)
            relation_refs += len(relations)
            elements = ways + [json_bytes(relation) for relation in relations]
            raw = b'{"schema":1,"elements":[' + b','.join(elements) + b']}'
            data = gzip.compress(raw, compresslevel=9, mtime=0)
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
            'name': 'Polku Finland roads and paths', 'format': 'json', 'schema': 1,
            'attribution': ATTRIBUTION, 'license': LICENSE,
            'source': source_info, 'bounds': bounds,
            'coverage': 'Complete intersecting ways from the buffered Finland extract; bounds are extent only.',
            'relations': 'Tile way members only; original member_count, zero-based member index and role. Non-way members, including restriction via-nodes, are omitted.',
            'geometry': 'Complete ways, original ordered node IDs, all tags, WGS84 coordinates to seven decimal places; no clipping or simplification.',
        })
    return {'tiles': len(sizes), 'tile_gzip_bytes': distribution(sizes),
            'tile_raw_bytes': distribution(raw_sizes), 'max_tile': max_tile,
            'relation_tile_references': relation_refs}


def validate_archive(path, expected_tiles):
    samples = {}
    with path.open('rb') as stream:
        source = MmapSource(stream)
        reader = Reader(source)
        header = reader.header()
        if (header['addressed_tiles_count'] != expected_tiles or
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
        for name, (lon, lat) in SAMPLES.items():
            x, y = map(math.floor, tile_point(lon, lat))
            data = reader.get(ZOOM, x, y)
            elements = json.loads(gzip.decompress(data))['elements'] if data else []
            samples[name] = {'lon': lon, 'lat': lat, 'tile': [ZOOM, x, y],
                             'gzip_bytes': len(data) if data else 0,
                             'raw_bytes': len(gzip.decompress(data)) if data else 0,
                             'ways': sum(e['type'] == 'way' for e in elements),
                             'relations': sum(e['type'] == 'relation' for e in elements)}
    return samples


def file_record(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return {'path': path.name, 'bytes': path.stat().st_size, 'sha256': digest.hexdigest()}


def check_finland(handler, source_info, db):
    west, south, east, north = handler.bounds
    relations = db.execute('''SELECT count(DISTINCT m.relation) FROM members m
                             JOIN ways w ON w.id=m.way''').fetchone()[0]
    tiles = db.execute('SELECT count(DISTINCT tile) FROM tile_ways').fetchone()[0]
    if (source_info['bytes'] < 100_000_000 or handler.source_nodes < 10_000_000 or
            handler.ways < 300_000 or relations < 100 or tiles < 20_000 or
            not (west < 20 and south < 60.5 and east > 31 and north > 69.5)):
        raise ValueError('Source fails complete-Finland count/extent checks')


def build_dataset(source, output, source_info, *, full_country=False, started=None):
    """Build and atomically expose a fresh directory; fixture builds omit country gates."""
    if sys.version_info < (3, 14):
        raise RuntimeError('Python 3.14+ is required for deterministic PMTiles gzip headers')
    started = time.monotonic() if started is None else started
    source, output = Path(source), Path(output)
    if output.exists():
        raise FileExistsError(f'Release already exists: {output}')
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=f'.{output.name}.', dir=output.parent) as tmp:
        tmp = Path(tmp)
        stage = tmp / 'release'
        stage.mkdir()
        with sqlite3.connect(tmp / 'staging.sqlite') as db:
            handler = stage_source(source, db, tmp / 'nodes.idx')
            if full_country:
                check_finland(handler, source_info, db)
            stats = archive(db, stage / 'ways.pmtiles', source_info, handler.bounds)
            stats.update({
                'source_nodes': handler.source_nodes, 'source_ways': handler.source_ways,
                'source_relations': handler.source_relations, 'ways': handler.ways,
                'eligible_node_references': handler.node_references,
                'relations': db.execute('''SELECT count(DISTINCT m.relation) FROM members m
                                          JOIN ways w ON w.id=m.way''').fetchone()[0],
                'way_tile_references': db.execute('SELECT count(*) FROM tile_ways').fetchone()[0],
            })
        stats['way_duplication_factor'] = stats['way_tile_references'] / stats['ways']
        stats['sample_tiles'] = validate_archive(stage / 'ways.pmtiles', stats['tiles'])
        if full_country and not stats['sample_tiles']['Helsinki']['ways']:
            raise ValueError('Complete-Finland archive is missing Helsinki sample roads')
        stats['build_seconds'] = round(time.monotonic() - started, 3)
        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        stats['peak_rss_bytes'] = peak if sys.platform == 'darwin' else peak * 1024
        stats['individual_gzip_json'] = {
            'files': stats['tiles'], 'total_bytes': stats['tile_gzip_bytes']['total'],
            'archive_bytes': (stage / 'ways.pmtiles').stat().st_size,
            'note': 'Same tile payloads; one file/upload per non-empty tile instead of one archive.',
        }
        (stage / 'measurements.json').write_bytes(json_bytes(stats) + b'\n')
        (stage / 'LICENSE.txt').write_text(LICENSE_TEXT, encoding='utf-8')
        files = [file_record(stage / name)
                 for name in ('ways.pmtiles', 'LICENSE.txt', 'measurements.json')]
        archive_record = files[0]
        release = (source_info['timestamp'].replace('-', '').replace(':', '')
                   + '-' + source_info['sha256'][:12] + '-' + archive_record['sha256'][:12])
        manifest = {
            'schema': 1, 'release': release,
            'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
            'source': source_info, 'bounds': handler.bounds,
            'datasets': {'ways': {'format': 'pmtiles-json', 'schema': 1, 'zoom': ZOOM,
                                   'url': 'ways.pmtiles', 'bytes': archive_record['bytes'],
                                   'sha256': archive_record['sha256'], 'tiles': stats['tiles']}},
            'files': files, 'attribution': ATTRIBUTION, 'license': LICENSE,
        }
        (stage / 'manifest.json').write_bytes(json_bytes(manifest) + b'\n')
        if output.exists():
            raise FileExistsError(f'Release already exists: {output}')
        os.rename(stage, output)
    return manifest


def inspect_source(source, md5_file):
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
    return {'url': SOURCE_URL, 'timestamp': timestamp,
            'sha256': sha256.hexdigest(), 'bytes': source.stat().st_size}


def build_release(source, output, md5_file):
    source, output = Path(source), Path(output)
    if output.exists():
        raise FileExistsError(f'Release already exists: {output}')
    started = time.monotonic()
    source_info = inspect_source(source, md5_file)
    return build_dataset(source, output, source_info, full_country=True, started=started)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path, help='fresh immutable release directory')
    parser.add_argument('--md5', required=True, type=Path, help='Geofabrik .md5 checksum file')
    args = parser.parse_args()
    manifest = build_release(args.source, args.output, args.md5)
    print(json.dumps({'release': manifest['release'], 'output': str(args.output),
                      'ways': manifest['datasets']['ways']}, indent=2), flush=True)


if __name__ == '__main__':
    main()
