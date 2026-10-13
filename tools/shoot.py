#!/usr/bin/env python3
"""Before/after screenshots of Polku for pull requests.

  python3 tools/shoot.py OUTDIR LABEL [scene ...]     # e.g. shots before   (on main)
  python3 tools/shoot.py OUTDIR LABEL --list          #      shots after    (on the branch)

Needs the dev server (python3 serve.py) and Google Chrome. Routes come from
tools/fixtures, so no routing requests are made (paddle scenes use Polku's own
water router, which needs only map tiles). Writes OUTDIR/LABEL-SCENE.png.
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import Chrome  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = lambda name: open(os.path.join(HERE, 'fixtures', name)).read()

DESK = dict(w=1440, h=900, phone=False)
PHONE = dict(w=390, h=844, phone=True)
SCENES = {
    'desk-closed': dict(DESK, timeline=True),
    'desk-planner': dict(DESK, timeline=True, route='route-kauppi-mtb.json'),
    'desk-min': dict(DESK, timeline=True, route='route-kauppi-mtb.json', state='min'),
    'desk-wide': dict(DESK, timeline=True, route='route-kauppi-mtb.json', storage={'polku:panelWidth': '860'}),
    'phone-closed': dict(PHONE, timeline=True),
    'phone-planner': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='half'),
    'phone-peek': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='peek'),
    'phone-full': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='full'),
    'desk-paddle': dict(DESK, timeline=True, activity='paddle', water=[[23.742, 61.507], [23.700, 61.540], [23.757, 61.585]]),
    'phone-paddle': dict(PHONE, timeline=True, activity='paddle', water=[[23.742, 61.507], [23.700, 61.540], [23.757, 61.585]], state='half'),
}

WAIT_ROUTE = ("new Promise((ok) => { const p = polku.planner, t0 = Date.now();"
              " const go = () => (p.legs.length && p.legs.every((l) => l.status === 'ok' || l.status === 'error') && p.analysis"
              " && (p.analysis.wind || p.analysis.windError)) || Date.now() - t0 > 45000 ? ok() : setTimeout(go, 300); go(); })")
# fit the route into the visible map: the branch knows its own panel, older code gets an estimate
FIT = ("(() => { const p = polku.planner, a = p.analysis; if (!a) return;"
       " const b = a.pts.reduce((m, q) => [Math.min(m[0], q[0]), Math.min(m[1], q[1]), Math.max(m[2], q[0]), Math.max(m[3], q[1])], [180, 90, -180, -90]);"
       " const pad = p.viewPadding ? p.viewPadding() : { top: 130, bottom: innerHeight - document.querySelector('#planner').getBoundingClientRect().top + 20, left: 60, right: 100 };"
       " polku.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: pad, duration: 0 }); })()")


def shoot(chrome, out_dir, label, name):
    sc = SCENES[name]
    pg = chrome.page(sc['w'], sc['h'], sc['phone'])
    pg.open_app({'activity': sc.get('activity', 'mtb'), 'timeline': sc.get('timeline', False)}, sc.get('storage'))
    if sc.get('route') or sc.get('water'):
        pg.js('polku.planner.setActive(true); true')
        if sc.get('route'):
            pg.js(f"polku.planner.restoreSnapshot({FIX(sc['route'])}); true")
        else:
            pts = json.dumps(sc['water'])
            pg.js(f"(() => {{ const p = polku.planner; p.clear(); p.setMode('water'); for (const q of {pts}) p.addPoint(q); }})()")
        pg.js(WAIT_ROUTE)
        if sc.get('state'):
            pg.js(f"polku.planner.setSheetState ? polku.planner.setSheetState({json.dumps(sc['state'])}, {{ remember: false }}) : null; true")
        time.sleep(0.4)
        pg.js(FIT)
        pg.idle()
    time.sleep(2.0)  # timeline strip, weather, fades
    pg.idle()
    path = pg.screenshot(os.path.join(out_dir, f'{label}-{name}.png'))
    errs = pg.errors()
    pg.close()
    print(path + (f'   ({len(errs)} console errors: {errs[0][:120]})' if errs else ''), flush=True)


def main():
    if '--list' in sys.argv:
        print('\n'.join(SCENES))
        return
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    out_dir, label, names = sys.argv[1], sys.argv[2], sys.argv[3:] or ['desk-closed', 'desk-planner', 'phone-closed', 'phone-planner']
    os.makedirs(out_dir, exist_ok=True)
    chrome = Chrome()
    try:
        for n in names:
            shoot(chrome, out_dir, label, n)
    finally:
        chrome.close()


if __name__ == '__main__':
    main()
