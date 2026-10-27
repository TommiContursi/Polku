#!/usr/bin/env python3
"""Map pictures for #547's mock-up: each base map with the Kauppi route (tools/fixtures, no routing requests),
the interface hidden. For each: the map with the route as the app draws it, the map without the route, and the
route's points in CSS px (so the mock-up can draw it in any colour). Run from the worktree:
  POLKU_URL=http://localhost:8793/ python3 capture.py OUTDIR"""
import json, os, sys, time
TOOLS = os.path.join(os.getcwd(), 'tools')
sys.path.insert(0, TOOLS)
from cdp import Chrome  # noqa: E402
import shoot  # noqa: E402

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
HIDE_UI = """(() => { const s = document.createElement('style'); s.id = 'shot-hide';
  s.textContent = 'body > *:not(#map) { visibility: hidden !important } .maplibregl-control-container, .maplibregl-marker, .maplibregl-popup { visibility: hidden !important }';
  document.head.append(s); return true; })()"""
ROUTE_LAYERS = "polku.map.getStyle().layers.filter((l) => l.source === 'route' || l.source === 'routeLit' || l.source === 'routeColor' || /route|flow|chev|arrow/.test(l.id)).map((l) => l.id)"
SET_ROUTE = "((on) => { for (const id of " + ROUTE_LAYERS + ") polku.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); for (const l of polku.map.style._layers ? [] : []) ; return true; })"
PROJECT = """(() => { const m = polku.map, a = polku.planner.legs.flatMap((l) => l.result.coords);
  const px = a.map((c) => m.project(c)).map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
  const pts = polku.planner.points.map((c) => m.project(c)).map((p) => [Math.round(p.x), Math.round(p.y)]);
  return { zoom: m.getZoom(), w: innerWidth, h: innerHeight, line: px, points: pts, layers: """ + ROUTE_LAYERS + """ }; })()"""

SCENES = [  # name, base, phone, hash or None (fit the route), route?
    ('trail', 'trail', True), ('maasto', 'maasto', True), ('ortofi', 'ortofi', True), ('night', 'night', True),
]


def wait_tiles(pg):
    pg.js("new Promise((ok) => { const m = polku.map, t0 = Date.now(); const go = () => (m.loaded() && m.areTilesLoaded()) || Date.now() - t0 > 30000 ? ok(true) : setTimeout(go, 300); go(); })", timeout=40000)
    time.sleep(1.5)


def one(chrome, name, base, phone, w, h, hash_=None, route=True):
    pg = chrome.page(w, h, phone)
    try:
        pg.open_app({'activity': 'mtb', 'timeline': False, 'base': base}, None, **({'hash_': hash_} if hash_ else {}))
        if route:
            pg.js('polku.planner.setActive(true); true')
            pg.js(f"polku.planner.restoreSnapshot({shoot.FIX('route-kauppi-mtb.json')}); true")
            pg.js(shoot.WAIT_ROUTE)
            if phone:
                pg.js("polku.planner.setSheetState && polku.planner.setSheetState('peek', { remember: false }); true")
            time.sleep(0.4)
            pg.js(shoot.FIT)
        pg.js(HIDE_UI)
        wait_tiles(pg)
        tag = f"{name}-{'phone' if phone else 'desk'}"
        if route:
            pg.screenshot(os.path.join(OUT, f'{tag}-route.png'))
            info = pg.js(PROJECT)
            pg.js(SET_ROUTE + '(false)')
            time.sleep(0.6)
            json.dump(info, open(os.path.join(OUT, f'{tag}.json'), 'w'))
        pg.screenshot(os.path.join(OUT, f'{tag}.png'))
        errs = pg.errors()
        print(tag, 'ok', (f'{len(errs)} console errors: {errs[0][:140]}' if errs else ''), flush=True)
    finally:
        pg.close()


c = Chrome()
try:
    for name, base, _ in SCENES:
        one(c, name, base, True, 390, 844)
        one(c, name, base, False, 1440, 900)
    # bright, busy aerial: Tampere's centre (roofs, streets, the rapids, parks); no route
    one(c, 'ortofi-city', 'ortofi', True, 390, 844, '#15.4/61.4985/23.7630', route=False)
    one(c, 'ortofi-city', 'ortofi', False, 1440, 900, '#15.4/61.4985/23.7630', route=False)
finally:
    c.close()
