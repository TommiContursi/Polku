#!/usr/bin/env python3
"""B's build (#547): main, the build and the mock-up side by side. Run from the build's worktree:
  python3 shots.py OUT_DIR [only-substring]
main on :8814, the build on :8813 (the mock-up from the build's own copy)."""
import json, os, sys, time
sys.path.insert(0, 'tools')
import cdp
from cdp import Chrome
import shoot

OUT = sys.argv[1]
ONLY = sys.argv[2] if len(sys.argv) > 2 else ''
os.makedirs(OUT, exist_ok=True)
SRC = {'main': 'http://localhost:8814/', 'after': 'http://localhost:8813/'}
BASES = {'trail': 'trail', 'plain': 'plain', 'aerial': 'ortofi', 'night': 'night'}
MOCK_MAP = {'trail': 'trail', 'plain': 'plain', 'aerial': 'forest', 'night': 'night'}
TILES = ("new Promise((ok) => { const m = polku.map, t0 = Date.now();"
         " const go = () => (m.loaded() && m.areTilesLoaded()) || Date.now() - t0 > 30000 ? ok(true) : setTimeout(go, 300); go(); })")
STATE = {
    'route': '',
    'folded': "polku.planner.setSheetState('folded', { remember: false });",
    'card': "polku.planner.openPointCard(polku.planner.points[1]);",
    'layers': "document.querySelector('#btn-layers').click();",
}


def app(c, src, device, theme, map_, state='route', media=None, zoom200=False):
    name = f'{src}-{device}-{theme}-{map_}-{state}' + (f'-{media[0][0].split("-")[-1]}' if media else '') + ('-200' if zoom200 else '')
    if ONLY and ONLY not in name:
        return
    cdp.BASE = SRC[src]
    phone = device == 'phone'
    w, h = (390, 844) if phone else (1440, 900)
    pg = c.page(w // 2 if zoom200 else w, h // 2 if zoom200 else h, phone)
    try:
        if zoom200:
            c.send('Emulation.setDeviceMetricsOverride', {'width': w // 2, 'height': h // 2, 'deviceScaleFactor': 4, 'mobile': True}, pg.s)
        if media:
            c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce'}] + [{'name': n, 'value': v} for n, v in media]}, pg.s)
        pg.open_app({'activity': 'mtb', 'timeline': True, 'base': BASES[map_], 'appearance': theme})
        pg.js('polku.planner.setActive(true); true')
        pg.js(f"polku.planner.restoreSnapshot({shoot.FIX('route-kauppi-mtb.json')}); true")
        pg.js(shoot.WAIT_ROUTE)
        if phone:
            pg.js("polku.planner.setSheetState('peek', { remember: false }); true")
        time.sleep(0.4)
        pg.js(shoot.FIT)
        if STATE[state]:
            pg.js(STATE[state] + ' true')
        pg.js(TILES, timeout=40000)
        time.sleep(2.0)
        pg.screenshot(os.path.join(OUT, name + '.png'))
        print(name, flush=True)
    except Exception as e:
        print('FAILED', name, e, flush=True)
    finally:
        pg.close()


def mock(c, device, theme, map_, mode='default'):
    name = f'mockup-{device}-{theme}-{map_}' + ('' if mode == 'default' else f'-{mode}')
    if ONLY and ONLY not in name:
        return
    pg = c.page(1600, 1000, False)
    try:
        pg.goto(f"{SRC['after']}docs/plans/mockups/issue-547-the-look.html?bare=1&dir=b&map={MOCK_MAP[map_]}&theme={theme}&device={device}&mode={mode}")
        pg.js("new Promise((ok) => { const t0 = Date.now(), go = () => { const i = [...document.querySelectorAll('.screen img')]; i.length && i.every((x) => x.complete && x.naturalWidth) || Date.now() - t0 > 20000 ? ok(true) : setTimeout(go, 200); }; go(); })", timeout=30000)
        time.sleep(1.0)
        r = pg.js("(() => { const b = document.querySelector('.screen').getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, scale: 1 }; })()")
        import base64
        data = c.send('Page.captureScreenshot', {'format': 'png', 'clip': r}, pg.s)['data']
        open(os.path.join(OUT, name + '.png'), 'wb').write(base64.b64decode(data))
        print(name, flush=True)
    except Exception as e:
        print('FAILED', name, e, flush=True)
    finally:
        pg.close()


c = Chrome()
try:
    for device in ('phone', 'desk'):
        for theme in ('light', 'dark'):
            for map_ in BASES:
                for src in SRC:
                    app(c, src, device, theme, map_)
                mock(c, device, theme, map_)
        for map_ in ('trail', 'aerial'):  # Match the map: light over the drawn maps, dark over the photos and the night map
            app(c, 'after', device, 'map', map_)
            mock(c, device, 'match', map_)
        for theme in ('light', 'dark'):
            for state in ('folded', 'card', 'layers'):
                for src in SRC:
                    app(c, src, device, theme, 'trail', state)
    for src in SRC:
        app(c, src, 'phone', 'light', 'trail', zoom200=True)
        app(c, src, 'phone', 'light', 'aerial', media=[('prefers-contrast', 'more')])
        app(c, src, 'phone', 'light', 'aerial', media=[('prefers-reduced-transparency', 'reduce')])
    mock(c, 'phone', 'light', 'aerial', 'contrast')
    mock(c, 'phone', 'light', 'aerial', 'clear')
finally:
    c.close()
