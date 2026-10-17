#!/usr/bin/env python3
"""Phase 24: map-only pictures for the planner's mock-up (docs/plans/mockups/phase-24-planner.html).

  POLKU_URL=http://localhost:8772/ python3 docs/reviews/2026-10-17-design/evidence/mockup_bg.py OUTDIR

Polku with a route drawn and every control hidden, so the mock-up can draw its own planner
over the map. "-calm" has distance marks without times (arrival and elapsed off, as Check ›
On the map can already set) and no zoom hint. JPEG via sips. The pictures go on the
pr-screenshots branch, never main.
"""
import json
import os
import subprocess
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from cdp import Chrome  # noqa: E402

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
FIX = open(os.path.join(ROOT, 'tools', 'fixtures', 'route-kauppi-mtb.json')).read()
NASI = [[23.742, 61.507], [23.700, 61.540], [23.757, 61.585]]
LOCAL = {'polku:brouterUrl': '"http://localhost:17777/brouter"'}
HIDE = ("(() => { const s = document.createElement('style'); s.textContent = '.topbar, #map-ctrls, #planner, #zoom-hint, .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right, #wx-bar, .toast, #view3d, .offline-banner { visibility: hidden !important; }';"
        " document.head.append(s); return true; })()")
WAIT = ("new Promise((ok) => { const p = polku.planner, t0 = Date.now(); const go = () => (p.legs.length && p.legs.every((l) => l.status === 'ok' || l.status === 'error') && p.analysis"
        " && (p.analysis.wind || p.analysis.windError)) || Date.now() - t0 > 45000 ? ok() : setTimeout(go, 300); go(); })")


def fit(bottom, left=40, top=90, right=90):
    return ("(() => { const pl = polku.planner, pts = pl.legs.flatMap((l, i) => (l.result ? l.result.coords : [pl.points[i], pl.points[i + 1]])); const b = pts.reduce((m, q) => [Math.min(m[0], q[0]), Math.min(m[1], q[1]), Math.max(m[2], q[0]), Math.max(m[3], q[1])], [180, 90, -180, -90]);"
            f" polku.map.setPadding({{ top: 0, bottom: 0, left: 0, right: 0 }}); polku.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], {{ padding: {{ top: {top}, bottom: {bottom}, left: {left}, right: {right} }}, duration: 0 }}); return true; }})()")


SHOTS = [
    # name, w, h, phone, sport, route, fit
    ('phone-mtb', 390, 844, True, 'mtb', 'kauppi', fit(190)),
    ('phone-paddle', 390, 844, True, 'paddle', 'water', fit(190)),
    ('phone-empty', 390, 844, True, 'mtb', None, None),
    ('desk-mtb', 1440, 900, False, 'mtb', 'kauppi', fit(80, left=460, top=110, right=120)),
]
c = Chrome()
try:
    for name, w, h, phone, sport, route, fitjs in SHOTS:
        for calm in (False, True):
            if route is None and calm:
                continue
            p = c.page(w, h, phone)
            marks = {'polku:routeMarks': json.dumps({'km': True, 'time': not calm, 'duration': not calm})}
            p.open_app({'activity': sport, 'timeline': False}, {**LOCAL, **marks}, hash_='#13.6/61.5135/23.8170' if sport != 'paddle' else '#12/61.545/23.73')
            p.js('polku.planner.setActive(true); true')
            if route == 'kauppi':
                p.js(f'polku.planner.restoreSnapshot({FIX}); true')
            elif route == 'water':
                p.js(f"(() => {{ const p = polku.planner; p.clear(); p.setMode('water'); for (const q of {json.dumps(NASI)}) p.addPoint(q); return true; }})()")
            if route:
                p.js(WAIT)
                p.js("polku.planner.layout() === 'sheet' && polku.planner.setSheetState('peek', { remember: false }); true")
                time.sleep(1.5)  # the planner frames the route for its own sheet first; fit after it
                p.js(fitjs)
                time.sleep(0.5)
                p.js(fitjs)
            p.js(HIDE)
            time.sleep(2.5)
            p.idle()
            png = os.path.join(OUT, f'{name}{"-calm" if calm else ""}.png')
            p.screenshot(png)
            subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', png, '--out', png[:-4] + '.jpg'], capture_output=True, check=True)
            os.remove(png)
            print(png[:-4] + '.jpg', flush=True)
            p.close()
finally:
    c.close()
