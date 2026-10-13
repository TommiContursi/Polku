#!/usr/bin/env python3
"""How long do round-trip loops really ride? Calibrates js/roundtrip.js.

  python3 tools/loop_probe.py

Generates ring-shaped loops (the start on a circle, via points around it) for
a few places, sports, targets and directions, routes them with a local BRouter
(tools/brouter-local.sh) and prints actual / target length and how much of the
loop is the same way twice. Never run it against brouter.de.
"""
import json
import math
import os
import urllib.parse
import urllib.request

BROUTER = os.environ.get('POLKU_BROUTER', 'http://localhost:17777/brouter')
STARTS = {'tampere': (23.7610, 61.4980), 'jkl': (25.7470, 62.2410), 'helsinki': (24.9384, 60.1699), 'nuuksio': (24.5034, 60.3087), 'kuopio': (27.6782, 62.8924)}
SPORTS = {'mtb': ('mtb', [10, 25]), 'gravel': ('gravel', [30, 60]), 'road': ('fastbike-lowtraffic', [40, 80]), 'run': ('hiking-mountain', [5, 10]), 'hike': ('hiking-mountain', [8, 15])}
R_EARTH = 6371000.0


def dest(lon, lat, dist, bearing):
    b = math.radians(bearing)
    la1, lo1 = math.radians(lat), math.radians(lon)
    la2 = math.asin(math.sin(la1) * math.cos(dist / R_EARTH) + math.cos(la1) * math.sin(dist / R_EARTH) * math.cos(b))
    lo2 = lo1 + math.atan2(math.sin(b) * math.sin(dist / R_EARTH) * math.cos(la1), math.cos(dist / R_EARTH) - math.sin(la1) * math.sin(la2))
    return (math.degrees(lo2), math.degrees(la2))


def ring(start, target_m, bearing, n, detour):
    """The start on a circle whose centre lies `bearing` from it; n via points around, clockwise."""
    r = target_m / (2 * math.pi * detour)
    c = dest(*start, r, bearing)
    back = (bearing + 180) % 360  # the start, seen from the centre
    pts = [start] + [dest(*c, r, back + k * 360 / (n + 1)) for k in range(1, n + 1)] + [start]
    return pts


def route(profile, pts, params):
    q = {'lonlats': '|'.join(f'{x:.6f},{y:.6f}' for x, y in pts), 'profile': profile, 'alternativeidx': 0, 'format': 'geojson'}
    q.update({f'profile:{k}': v for k, v in params.items()})
    with urllib.request.urlopen(f'{BROUTER}?{urllib.parse.urlencode(q)}', timeout=180) as r:
        f = json.load(r)['features'][0]
    return f['geometry']['coordinates'], int(f['properties']['track-length'])


def dist(a, b):
    k = math.cos(math.radians((a[1] + b[1]) / 2))
    return math.hypot((a[0] - b[0]) * k, a[1] - b[1]) * 111195


def overlap(coords):
    """Share of the loop that runs within 15 m of another part of it at least 300 m away along the route."""
    pts, along = [coords[0]], [0.0]
    for c in coords[1:]:
        d = dist(pts[-1], c)
        if d >= 20:
            along.append(along[-1] + d)
            pts.append(c)
    cell = {}
    for i, p in enumerate(pts):
        cell.setdefault((int(p[0] / 0.0003), int(p[1] / 0.00015)), []).append(i)
    twice = 0
    for i, p in enumerate(pts):
        cx, cy = int(p[0] / 0.0003), int(p[1] / 0.00015)
        hit = any(abs(along[j] - along[i]) > 300 and dist(p, pts[j]) < 15
                  for dx in (-1, 0, 1) for dy in (-1, 0, 1) for j in cell.get((cx + dx, cy + dy), []))
        twice += hit
    return round(100 * twice / max(1, len(pts)))


def main():
    detour = 1.3
    print(f'detour guess {detour}; n = via points; fix = correctMisplacedViaPoints')
    print(f"  {'place':9} {'sport':6} {'target':>6} {'brg':>4} {'n':>2} {'fix':>3} {'km':>6} {'ratio':>5} {'twice%':>6}")
    ratios = {}
    for place, start in STARTS.items():
        for sport, (profile, targets) in SPORTS.items():
            for target in targets:
                for bearing in (0, 120, 240):
                    for n, fix in ((4, 0), (4, 1), (5, 1), (3, 1)):
                        pts = ring(start, target * 1000, bearing, n, detour)
                        try:
                            coords, m = route(profile, pts, {'correctMisplacedViaPoints': 1} if fix else {})
                        except Exception as e:  # noqa: BLE001
                            print(f'  {place:9} {sport:6} {target:6} {bearing:4} {n:2} {fix:3} failed {e}')
                            continue
                        ratio = m / (target * 1000)
                        ratios.setdefault((sport, n, fix), []).append(ratio)
                        print(f'  {place:9} {sport:6} {target:6} {bearing:4} {n:2} {fix:3} {m / 1000:6.1f} {ratio:5.2f} {overlap(coords):6}', flush=True)
    print('\nmedian ratio (actual / target) per sport, n, fix:')
    for k, v in sorted(ratios.items()):
        v = sorted(v)
        print(f'  {k}: median {v[len(v) // 2]:.2f}  range {v[0]:.2f}–{v[-1]:.2f}  ({len(v)} loops)')


if __name__ == '__main__':
    main()
