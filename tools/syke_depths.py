"""Polku's lake depth files for the water router (#1184), from Syke's lake soundings.

Source: Finnish Environment Institute (Syke), "Järvien ja jokien luotauspisteet" and
"Järvien ja jokien syvyysaineisto" (CC BY 4.0). Run it by hand when Syke updates them
(the soundings last changed on 2017-03-20):

    python3 tools/syke_depths.py            # downloads Syke's bulk files (about 360 MB)
    python3 tools/syke_depths.py DIR        # or reads luotauspisteet.zip and syvyysalue.zip from DIR

It writes data/depths/: one file per z10 tile where Syke surveyed, named x-y.json, and
index.json listing them. Each tile has
  - "shallow": [[lon, lat], ...], the soundings under SHALLOW metres at the lake's survey
    level, one per THIN-metre square (the shallowest);
  - "surveyed": [[row, x0, x1, x0, x1, ...], ...], where Syke surveyed (its depth areas,
    islands left out), as runs of the tile's 256 × 256 cells, [x0, x1) on each row.
js/waterdata.js reads them, and js/water.js draws them into the router's grid.
"""
import json, math, os, shutil, struct, sys, tempfile, urllib.request, zipfile
from collections import defaultdict

SHALLOW = 0.5  # m: shallow for a kayak, a canoe or a SUP (decided on #1184, 2026-11-20)
THIN = 10      # m
Z, CELLS = 10, 256
URLS = {
    'luotauspisteet.zip': 'https://wwwd3.ymparisto.fi/d3/gis_data/spesific/luotauspisteet.zip',
    'syvyysalue.zip': 'https://wwwd3.ymparisto.fi/d3/gis_data/spesific/syvyysalue.zip',
}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'depths')

# ETRS-TM35FIN (EPSG:3067) to lon, lat: Krüger's series on GRS80, as tm35ToLonLat() in js/geo.js
_f = 1 / 298.257222101
_n = _f / (2 - _f)
_A = 6378137 / (1 + _n) * (1 + _n ** 2 / 4 + _n ** 4 / 64)
_B = [_n / 2 - 2 / 3 * _n ** 2 + 37 / 96 * _n ** 3, _n ** 2 / 48 + _n ** 3 / 15, 17 / 480 * _n ** 3]
_D = [2 * _n - 2 / 3 * _n ** 2 - 2 * _n ** 3, 7 / 3 * _n ** 2 - 8 / 5 * _n ** 3, 56 / 15 * _n ** 3]


def lonlat(x, y):
    xi, eta = y / (0.9996 * _A), (x - 500000) / (0.9996 * _A)
    xp, ep = xi, eta
    for j in (1, 2, 3):
        xp -= _B[j - 1] * math.sin(2 * j * xi) * math.cosh(2 * j * eta)
        ep -= _B[j - 1] * math.cos(2 * j * xi) * math.sinh(2 * j * eta)
    chi = math.asin(math.sin(xp) / math.cosh(ep))
    lat = chi + sum(_D[j - 1] * math.sin(2 * j * chi) for j in (1, 2, 3))
    return 27 + math.degrees(math.atan2(math.sinh(ep), math.cos(xp))), math.degrees(lat)


def pixel(lon, lat):
    """lon, lat → the z10 tiles' cells, counted across the world (Web Mercator)."""
    s = math.sin(math.radians(lat))
    k = (1 << Z) * CELLS
    return (lon + 180) / 360 * k, (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * k


def dbf(zf, name):
    """The .dbf's records, as raw bytes, and its fields' offsets by name."""
    with zf.open(name) as f:
        count, hlen, rlen = struct.unpack('<IHH', f.read(12)[4:12])
        head = f.read(hlen - 12)
        fields, at = {}, 1
        for k in range(20, len(head) - 1, 32):  # the field descriptors, up to the 0x0D that ends them
            d = head[k:k + 32]
            if d[0] == 0x0D:
                break
            fields[d[:11].split(b'\0')[0].decode()] = (at, at + d[16])
            at += d[16]
        for _ in range(count):
            yield f.read(rlen), fields


def shallow_points(zf, tiles):
    """The soundings under SHALLOW m, one per THIN-metre square, into tiles[(x, y)]['shallow']."""
    best = {}  # (x // THIN, y // THIN) -> (depth, x, y)
    with zf.open('Luotauspiste.shp') as shp:
        shp.read(100)
        n = 0
        for rec, fields in dbf(zf, 'Luotauspiste.dbf'):
            content = shp.read(8 + 20)  # record header, shape type 1 (a point), x, y
            kind, x, y = struct.unpack('<idd', content[8:])
            assert kind == 1, kind
            n += 1
            a, b = fields['Syvyys_m']
            depth = float(rec[a:b].decode().strip() or 'inf')
            if depth >= SHALLOW:
                continue
            key = (int(x // THIN), int(y // THIN))
            if key not in best or depth < best[key][0]:
                best[key] = (depth, x, y)
    for depth, x, y in best.values():
        lon, lat = lonlat(x, y)
        px, py = pixel(lon, lat)
        tiles[(int(px) // CELLS, int(py) // CELLS)]['shallow'].append([round(lon, 5), round(lat, 5)])
    return n, len(best)


def polygons(zf):
    """Syke's depth areas but its islands (class 0), each as rings of TM35FIN points."""
    with zf.open('Syvyysalue.shp') as shp:
        shp.read(100)
        for rec, fields in dbf(zf, 'Syvyysalue.dbf'):
            num, size = struct.unpack('>ii', shp.read(8))
            content = shp.read(size * 2)
            a, b = fields['Luokka']
            if struct.unpack('<i', content[:4])[0] != 5 or int(rec[a:b].decode().strip() or 0) == 0:
                continue
            parts, points = struct.unpack('<ii', content[36:44])
            starts = list(struct.unpack(f'<{parts}i', content[44:44 + 4 * parts])) + [points]
            xy = struct.unpack(f'<{2 * points}d', content[44 + 4 * parts:44 + 4 * parts + 16 * points])
            yield [[(xy[2 * k], xy[2 * k + 1]) for k in range(starts[p], starts[p + 1])] for p in range(parts)]


def surveyed(zf, tiles):
    """Where Syke surveyed: the cells whose middle is inside a depth area, as runs per row."""
    rows = defaultdict(list)  # global row -> [(x0, x1)]
    count = 0
    for rings in polygons(zf):
        count += 1
        cross = defaultdict(list)
        for ring in rings:
            pts, last = [], None
            for x, y in ring:  # vertices closer than 15 m add nothing to cells about 76 m wide
                if last and abs(x - last[0]) < 15 and abs(y - last[1]) < 15:
                    continue
                last = (x, y)
                pts.append(pixel(*lonlat(x, y)))
            if len(pts) < 3:
                continue
            for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
                if y1 == y2:
                    continue
                lo, hi = (y1, y2) if y1 < y2 else (y2, y1)
                for r in range(math.ceil(lo - 0.5), math.ceil(hi - 0.5)):
                    cross[r].append(x1 + (r + 0.5 - y1) * (x2 - x1) / (y2 - y1))
        for r, xs in cross.items():  # even-odd: between the 1st and 2nd crossing, the 3rd and 4th…
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                c0, c1 = math.ceil(a - 0.5), math.ceil(b - 0.5)
                if c1 > c0:
                    rows[r].append((c0, c1))
    for r, spans in rows.items():
        spans.sort()
        merged = []
        for a, b in spans:
            if merged and a <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], b)
            else:
                merged.append([a, b])
        for a, b in merged:  # split at the tiles' edges
            while a < b:
                tx = a // CELLS
                end = min(b, (tx + 1) * CELLS)
                runs = tiles[(tx, r // CELLS)]['runs'][r % CELLS]
                runs += [a - tx * CELLS, end - tx * CELLS]
                a = end
    return count


def main():
    tiles = defaultdict(lambda: {'shallow': [], 'runs': defaultdict(list)})
    tmp = None
    if len(sys.argv) > 1:
        src = sys.argv[1]
    else:
        src = tmp = tempfile.mkdtemp(prefix='syke-')
        for name, url in URLS.items():
            print('downloading', url, flush=True)
            with urllib.request.urlopen(url, timeout=600) as r, open(os.path.join(src, name), 'wb') as f:
                shutil.copyfileobj(r, f)
    try:
        with zipfile.ZipFile(os.path.join(src, 'luotauspisteet.zip')) as zf:
            n, kept = shallow_points(zf, tiles)
        print(f'{n} soundings, {kept} under {SHALLOW} m kept', flush=True)
        with zipfile.ZipFile(os.path.join(src, 'syvyysalue.zip')) as zf:
            print(f'{surveyed(zf, tiles)} depth areas drawn', flush=True)
    finally:
        if tmp:
            shutil.rmtree(tmp)
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    index, size = [], 0
    for (x, y), t in sorted(tiles.items()):
        if not t['runs']:
            print(f'tile {x}/{y}: {len(t["shallow"])} shallow soundings outside every depth area')
        body = json.dumps({'shallow': sorted(t['shallow']), 'surveyed': [[r, *t['runs'][r]] for r in sorted(t['runs'])]}, separators=(',', ':'))
        with open(os.path.join(OUT, f'{x}-{y}.json'), 'w') as f:
            f.write(body)
        index.append([x, y])
        size += len(body)
    with open(os.path.join(OUT, 'index.json'), 'w') as f:
        json.dump({'z': Z, 'cells': CELLS, 'shallow': SHALLOW, 'source': 'Finnish Environment Institute (Syke), lake and river soundings and depth areas, CC BY 4.0', 'tiles': index}, f, separators=(',', ':'))
    print(f'{len(index)} tiles, {size / 1e6:.1f} MB, in {os.path.normpath(OUT)}')


if __name__ == '__main__':
    main()
