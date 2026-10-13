#!/usr/bin/env python3
"""Does a route style change the route? Route test legs with BRouter profile
variables and print what the line is made of.

  python3 tools/style_probe.py                 # all cases below
  python3 tools/style_probe.py mtb-kauppi      # one case
  python3 tools/style_probe.py --presets       # every preset in js/styles.js, as Polku sends it
  (Polku's own profiles, e.g. custom_polku-road-1, must be uploaded first: use the road style once in the app)

Uses a local BRouter (tools/brouter-local.sh, http://localhost:17777) so tuning
never bursts brouter.de; POLKU_BROUTER=… for another server.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

BROUTER = os.environ.get('POLKU_BROUTER', 'http://localhost:17777/brouter')

# name: (profile, [lon,lat] points, {variant: {variable: value}})
CASES = {
    'mtb-kauppi': ('mtb', [[23.7550, 61.4975], [23.8382, 61.5163]], {
        'balanced': {},
        'roads': {'MTB_factor': -1.5},
        'more-trails': {'MTB_factor': 1.0},
        'trails-first': {'MTB_factor': 2.0, 'path_preference': 40},
        'technical-ok': {'MTB_factor': 1.0, 'consider_smoothness': 0},
        'fewer-climbs': {'hills': 1},
        'avoid-climbs': {'hills': 2},
        'wet': {'iswet': 1},
        'safe-roads': {'avoid_unsafe': 1},
    }),
    'mtb-jkl': ('mtb', [[25.7470, 62.2410], [25.6900, 62.2700], [25.6500, 62.2300]], {
        'balanced': {},
        'roads-3': {'MTB_factor': -3},
        'roads': {'MTB_factor': -1.5},
        'more-trails': {'MTB_factor': 1.0},
        'trails-first': {'MTB_factor': 2.0, 'path_preference': 40},
        'smooth': {'MTB_factor': 1.0, 'consider_smoothness': 1},
        'technical-ok': {'MTB_factor': 2.0, 'path_preference': 40, 'consider_smoothness': 0},
        'hills-1': {'hills': 1},
        'hills-2': {'hills': 2},
        'hills-3': {'hills': 3},
        'wet': {'iswet': 1},
        'safe-roads': {'avoid_unsafe': 1},
    }),
    'road-orivesi': ('fastbike-lowtraffic', [[23.7610, 61.4980], [24.3570, 61.6770]], {
        'balanced': {},
        'traffic-off': {'consider_traffic': 0},
        'no-main-roads': {'avoid_unsafe': 1},
        'flatter': {'uphillcost': 40},
        'flat': {'uphillcost': 100},
        'cycleroutes': {'stick_to_cycleroutes': 1},
        'ignore-cr': {'ignore_cycleroutes': 1},
    }),
    'gravel-korpilahti': ('gravel', [[25.7470, 62.2410], [25.5600, 62.0150]], {
        'balanced': {},
        'unpaved': {'prefer_unpaved_paths': 1},
        'traffic': {'consider_traffic_estimate': 1},
        'flat': {'consider_elevation': 1, 'avoid_steep_inclines': 1},
        'forest': {'prefer_forests': 1},
        'river': {'prefer_rivers': 1},
        'towns': {'avoid_towns': 1},
        'quiet': {'avoid_noise': 1},
        'cycle': {'prefer_cycle_routes': 1},
    }),
    'gravel-jkl': ('gravel', [[25.7470, 62.2410], [25.6700, 62.1330]], {
        'balanced': {},
        'unpaved': {'prefer_unpaved_paths': 1},
        'traffic': {'consider_traffic_estimate': 1},
        'flat': {'consider_elevation': 1, 'avoid_steep_inclines': 1},
        'scenic': {'prefer_forests': 1, 'prefer_rivers': 1, 'avoid_towns': 1},
        'wet': {'assume_wet_conditions': 1},
    }),
    'road-tampere': ('fastbike-lowtraffic', [[23.7610, 61.4980], [24.0700, 61.4650]], {
        'balanced': {},
        'traffic-off': {'consider_traffic': 0},
        'no-main-roads': {'avoid_unsafe': 1},
        'flat': {'uphillcost': 80},
        'flatter': {'uphillcost': 40},
        'cycleroutes': {'stick_to_cycleroutes': 1},
    }),
    'hike-nuuksio': ('hiking-mountain', [[24.5034, 60.3087], [24.4520, 60.3163]], {
        'balanced': {},
        'marked': {'hiking_routes_preference': 1.0},
        'any-path': {'hiking_routes_preference': 0.05},
        'easy': {'SAC_scale_limit': 1, 'SAC_scale_preferred': 0},
        'nature': {'consider_forest': 1, 'consider_river': 1, 'consider_noise': 1},
        'flat': {'consider_elevation': 1},
        'wet': {'iswet': 1},
    }),
    'run-jkl': ('hiking-mountain', [[25.7600, 62.2290], [25.7120, 62.2540]], {
        'balanced': {},
        'green': {'consider_forest': 1, 'consider_noise': 1},
        'river': {'consider_river': 1},
        'flat': {'consider_elevation': 1},
        'no-stairs': {'allow_steps': 0},
        'any-path': {'hiking_routes_preference': 0.05},
    }),
}

PAVED = {'asphalt', 'paved', 'concrete', 'paving_stones', 'sett', 'chipseal', 'concrete:plates'}
MAIN = {'primary', 'secondary', 'tertiary', 'trunk', 'primary_link', 'secondary_link', 'tertiary_link'}


def route(profile, pts, params):
    q = {'lonlats': '|'.join(f'{x:.5f},{y:.5f}' for x, y in pts), 'profile': profile, 'alternativeidx': 0, 'format': 'geojson'}
    q.update({f'profile:{k}': v for k, v in params.items()})
    with urllib.request.urlopen(f'{BROUTER}?{urllib.parse.urlencode(q)}', timeout=120) as r:
        return json.load(r)['features'][0]['properties']


def describe(props):
    msgs = props.get('messages') or []
    head, rows = msgs[0], msgs[1:]
    i_d, i_t = head.index('Distance'), head.index('WayTags')
    tot = 0
    share = {'trail': 0, 'unpaved': 0, 'main': 0, 'tech': 0, 'cycleway': 0, 'steps': 0}
    for r in rows:
        d = float(r[i_d])
        tags = dict(kv.split('=', 1) for kv in r[i_t].split() if '=' in kv)
        hw, surf = tags.get('highway', ''), tags.get('surface', '')
        tot += d
        if hw in ('path', 'bridleway', 'footway') and surf not in PAVED:
            share['trail'] += d
        if surf and surf not in PAVED or (not surf and hw in ('track', 'path', 'bridleway')):
            share['unpaved'] += d
        if hw in MAIN:
            share['main'] += d
        if hw == 'cycleway':
            share['cycleway'] += d
        if hw == 'steps':
            share['steps'] += d
        try:
            if int(tags.get('mtb:scale', '0')[0]) >= 2:
                share['tech'] += d
        except ValueError:
            pass
    pct = {k: round(100 * v / tot) if tot else 0 for k, v in share.items()}
    return {'km': round(int(props['track-length']) / 1000, 2), 'up': int(props.get('filtered ascend', 0)), **pct}


# --presets: every preset in js/styles.js, as the app sends it, on one test route per sport
PRESET_CASES = {'mtb': 'mtb-jkl', 'gravel': 'gravel-korpilahti', 'road': 'road-orivesi', 'hike': 'hike-nuuksio', 'trailrun': 'run-jkl', 'run': 'run-jkl'}


def presets():
    import subprocess
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    js = ("import('./js/styles.js').then((S) => { const out = {}; for (const [sport, c] of Object.entries(S.STYLES)) {"
          " out[sport] = c.presets.map(([k, label]) => { const r = S.routerOf(sport, { p: k, v: {}, wet: 'no' }); return [label, r.profile, r.params]; }); }"
          " console.log(JSON.stringify(out)); })")
    data = json.loads(subprocess.run(['node', '--input-type=module', '-e', js], cwd=root, capture_output=True, text=True, check=True).stdout)
    stock = {'mtb': 'mtb', 'gravel': 'gravel', 'road': 'fastbike-lowtraffic', 'hike': 'hiking-mountain', 'trailrun': 'hiking-mountain', 'run': 'hiking-mountain'}
    for sport, case in PRESET_CASES.items():
        _, pts, _ = CASES[case]
        print(f'\n{sport} on {case}')
        print(f"  {'preset':20} {'km':>6} {'up m':>5} {'trail%':>6} {'unpav%':>6} {'main%':>5} {'tech%':>5} {'cyclew%':>7} {'steps%':>6}")
        for label, profile, params in data[sport]:
            try:
                d = describe(route(profile or stock[sport], pts, params))
                print(f"  {label:20} {d['km']:6} {d['up']:5} {d['trail']:6} {d['unpaved']:6} {d['main']:5} {d['tech']:5} {d['cycleway']:7} {d['steps']:6}")
            except Exception as e:  # noqa: BLE001
                print(f'  {label:20} failed: {e}')


def main():
    if '--presets' in sys.argv:
        presets()
        return
    names = sys.argv[1:] or list(CASES)
    for name in names:
        profile, pts, variants = CASES[name]
        print(f'\n{name} ({profile})')
        print(f"  {'variant':14} {'km':>6} {'up m':>5} {'trail%':>6} {'unpav%':>6} {'main%':>5} {'tech%':>5} {'cyclew%':>7} {'steps%':>6}")
        for v, params in variants.items():
            try:
                d = describe(route(profile, pts, params))
                print(f"  {v:14} {d['km']:6} {d['up']:5} {d['trail']:6} {d['unpaved']:6} {d['main']:5} {d['tech']:5} {d['cycleway']:7} {d['steps']:6}")
            except Exception as e:  # noqa: BLE001
                print(f'  {v:14} failed: {e}')


if __name__ == '__main__':
    main()
