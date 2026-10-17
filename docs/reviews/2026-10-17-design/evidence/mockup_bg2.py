#!/usr/bin/env python3
"""Phase 24, second iteration (#233): more map-only pictures for the planner's mock-up.

  POLKU_URL=http://localhost:8781/ python3 docs/reviews/2026-10-17-design/evidence/mockup_bg2.py OUTDIR

As mockup_bg.py (Polku with every control hidden, so the mock-up draws its own planner over the
map), for the moments the second iteration adds: three round-trip loops from the first point,
the loop taken as the route, the first point on a desktop, and a long route of 52 points.
Routing only on the local BRouter (tools/brouter-local.sh at localhost:17777), never brouter.de.
JPEG via sips. The pictures go on the pr-screenshots branch, never main.
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
LOCAL = {'polku:brouterUrl': '"http://localhost:17777/brouter"'}
START = [23.80917, 61.512737]  # journey.py's first point, in Kauppi's forest
HIDE = ("(() => { const s = document.createElement('style'); s.textContent = '.topbar, #map-ctrls, #planner, #zoom-hint, .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right, #wx-bar, .toast, #view3d, .offline-banner, .maplibregl-popup, #track-card { visibility: hidden !important; }';"
        " document.head.append(s); return true; })()")
ROUTED = ("new Promise((ok) => { const p = polku.planner, t0 = Date.now(); const go = () => (p.legs.length && p.legs.every((l) => l.status === 'ok' || l.status === 'error') && p.analysis)"
          " || Date.now() - t0 > 90000 ? ok(p.legs.length) : setTimeout(go, 300); go(); })")
# three loops of 10 km from the first point (local BRouter); resolves with how many came back
LOOPS = ("(async () => { const p = polku.planner; p.openLoop(" + json.dumps(START) + "); p.loop.mode = 'km'; p.loop.km = 10; await p.generateLoops();"
         " const t0 = Date.now(); while (p.loop.busy && Date.now() - t0 < 90000) await new Promise((r) => setTimeout(r, 300)); return p.loop.results.length; })()")


def fit_coords(expr, bottom, left=40, top=90, right=90):
    return ("(() => { const pts = " + expr + "; const b = pts.reduce((m, q) => [Math.min(m[0], q[0]), Math.min(m[1], q[1]), Math.max(m[2], q[0]), Math.max(m[3], q[1])], [180, 90, -180, -90]);"
            f" polku.map.setPadding({{ top: 0, bottom: 0, left: 0, right: 0 }}); polku.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], {{ padding: {{ top: {top}, bottom: {bottom}, left: {left}, right: {right} }}, duration: 0 }}); return true; }})()")


LOOP_PTS = 'polku.planner.loop.results.flatMap((r) => r.line.coords)'
ROUTE_PTS = 'polku.planner.legs.flatMap((l, i) => (l.result ? l.result.coords : [polku.planner.points[i], polku.planner.points[i + 1]]))'
# 52 points along the first loop's line, every ~200 m, drawn as one route that follows paths
LONG = ("(() => { const p = polku.planner, c = p.loop.results[0].line.coords; const d = [0]; for (let i = 1; i < c.length; i++) { const dx = (c[i][0] - c[i - 1][0]) * Math.cos(c[i][1] * Math.PI / 180), dy = c[i][1] - c[i - 1][1]; d.push(d[i - 1] + Math.hypot(dx, dy) * 111320); }"
        " const L = d[d.length - 1], pts = []; for (let k = 0; k < 52; k++) { const m = L * k / 52; const i = d.findIndex((x) => x >= m); pts.push(c[Math.max(0, i)].slice()); }"
        " p.closeLoop(); p.clear(); p.setMode('auto'); for (const q of pts) p.addPoint(q); return pts.length; })()")

SHOTS = [
    # name, w, h, phone, what, the room the planner takes at the bottom (phone) or the left (desktop)
    ('phone-loops', 390, 844, True, 'loops', 380),
    ('phone-loop1', 390, 844, True, 'loop1', 190),
    ('phone-long', 390, 844, True, 'long', 470),
    ('desk-start1', 1440, 900, False, 'one', 0),
    ('desk-loops', 1440, 900, False, 'loops', 0),
    ('desk-long', 1440, 900, False, 'long', 0),
]
c = Chrome()
try:
    for name, w, h, phone, what, room in SHOTS:
        if os.environ.get('ONLY') and name not in os.environ['ONLY'].split(','):
            continue
        p = c.page(w, h, phone)
        marks = {'polku:routeMarks': json.dumps({'km': True, 'time': False, 'duration': False})}
        p.open_app({'activity': 'mtb', 'timeline': False}, {**LOCAL, **marks}, hash_='#13.6/61.5135/23.8170')
        p.js('polku.planner.setActive(true); polku.planner.clear(); true')
        fit = None
        if what == 'one':
            p.js(f'polku.planner.addPoint({json.dumps(START)}); true')
        else:
            n = p.js(LOOPS)
            print(name, 'loops:', n, file=sys.stderr, flush=True)
            if what == 'loops':
                fit = fit_coords(LOOP_PTS, room if phone else 80, left=40 if phone else 470, top=90 if phone else 130, right=90 if phone else 120)
            elif what == 'loop1':
                p.js('polku.planner.pickLoop(0); true')
                print(name, 'legs:', p.js(ROUTED), file=sys.stderr, flush=True)
                fit = fit_coords(ROUTE_PTS, room, top=150)
            elif what == 'long':
                p.js(LONG)
                print(name, 'legs:', p.js(ROUTED), file=sys.stderr, flush=True)
                fit = fit_coords(ROUTE_PTS, room if phone else 80, left=40 if phone else 470, top=90 if phone else 130, right=90 if phone else 120)
        if fit:
            p.js("polku.planner.layout() === 'sheet' && polku.planner.setSheetState('peek', { remember: false }); true")
            time.sleep(1.5)  # the planner frames the route for its own sheet first; fit after it
            p.js(fit)
            time.sleep(0.5)
            p.js(fit)
        p.js(HIDE)
        time.sleep(2.5)
        p.idle()
        png = os.path.join(OUT, f'{name}.png')
        p.screenshot(png)
        subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', png, '--out', png[:-4] + '.jpg'], capture_output=True, check=True)
        os.remove(png)
        print(png[:-4] + '.jpg', flush=True)
        p.close()
finally:
    c.close()
