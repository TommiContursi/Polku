#!/usr/bin/env python3
"""Today's look for #547: the planner with the Kauppi route over each base map, light and dark, phone and desktop.
  POLKU_URL=http://localhost:8793/ python3 today_shots.py OUTDIR"""
import os, sys, time
sys.path.insert(0, os.path.join(os.getcwd(), 'tools'))
from cdp import Chrome  # noqa: E402
import shoot  # noqa: E402

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
CARD = "(async () => { const p = polku.planner, q = polku.map.project(p.points[1]); p.openPointCard ? p.openPointCard(1) : null; await new Promise((r) => setTimeout(r, 600)); return true; })()"


def one(c, base, phone, theme, extra='', js=None, hash_=None, route=True, state='half'):
    w, h = (390, 844) if phone else (1440, 900)
    pg = c.page(w, h, phone)
    try:
        c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-color-scheme', 'value': theme}, {'name': 'prefers-reduced-motion', 'value': 'reduce'}]}, pg.s)
        pg.open_app({'activity': 'mtb', 'timeline': True, 'base': base}, None, **({'hash_': hash_} if hash_ else {}))
        pg.js('polku.planner.setActive(true); true')
        if route:
            pg.js(f"polku.planner.restoreSnapshot({shoot.FIX('route-kauppi-mtb.json')}); true")
            pg.js(shoot.WAIT_ROUTE)
        if phone:
            pg.js(f"polku.planner.setSheetState('{state}', {{ remember: false }}); true")
        time.sleep(0.5)
        if route:
            pg.js(shoot.FIT)
        if js:
            pg.js(js)
        pg.js("new Promise((ok) => { const m = polku.map, t0 = Date.now(); const go = () => (m.loaded() && m.areTilesLoaded()) || Date.now() - t0 > 30000 ? ok(true) : setTimeout(go, 300); go(); })", timeout=40000)
        time.sleep(2.5)
        name = f"{'phone' if phone else 'desk'}-{base}-{theme}{extra}.png"
        pg.screenshot(os.path.join(OUT, name))
        print(name, pg.errors()[:1], flush=True)
    finally:
        pg.close()


c = Chrome()
try:
    for base in ('maasto', 'ortofi', 'night'):
        for theme in ('light', 'dark'):
            one(c, base, True, theme)
    one(c, 'ortofi', True, 'light', '-city', hash_='#15.4/61.4985/23.7630', route=False, state='peek')
    one(c, 'ortofi', True, 'dark', '-city', hash_='#15.4/61.4985/23.7630', route=False, state='peek')
    one(c, 'ortofi', False, 'light')
    one(c, 'maasto', False, 'light')
    one(c, 'night', False, 'dark')
    one(c, 'ortofi', False, 'dark', '-layers', js="document.querySelector('#btn-layers').click(); true")
    one(c, 'maasto', True, 'light', '-layers', js="document.querySelector('#btn-layers').click(); true", state='peek')
finally:
    c.close()
