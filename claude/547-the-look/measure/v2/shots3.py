#!/usr/bin/env python3
"""Shots of the mock-up's frames: python3 mock_shots.py OUTDIR dir:map:theme:device[:mode[:depth]] ..."""
import base64, os, sys, time
sys.path.insert(0, os.path.join(os.getcwd(), 'tools'))
from cdp import Chrome, BASE  # noqa: E402
VER = os.environ.get('VER', '2')
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
c = Chrome()
try:
    pg = c.page(1600, 1200, False)
    c.send('Emulation.setDeviceMetricsOverride', {'width': 1600, 'height': 1200, 'deviceScaleFactor': int(os.environ.get('DPR', '2')), 'mobile': False}, pg.s)
    for spec in sys.argv[2:]:
        p = spec.split(':') + ['default', 'thick'][len(spec.split(':')) - 4:]
        d, m, th, dev, mode, depth = p[:6]
        pg.goto(os.environ.get('PAGE', BASE + 'docs/plans/mockups/issue-547-the-look.html') + f'?ver={VER}&dir={d}&map={m}&theme={th}&device={dev}&mode={mode}&depth={depth}&compare=0')
        pg.js("new Promise((ok) => { const go = () => window.lookMeasure && window.lookMeasure() ? window.lookMeasure().then(ok) : setTimeout(go, 100); go(); })", timeout=90000)
        time.sleep(0.8)
        b = pg.js("(() => { const r = document.querySelector('#stage .fr:last-child .box').getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })()")
        data = c.send('Page.captureScreenshot', {'format': 'jpeg', 'quality': 82, 'clip': {'x': b['x'], 'y': b['y'], 'width': b['w'], 'height': b['h'], 'scale': 1}, 'captureBeyondViewport': True}, pg.s)['data']
        open(os.path.join(out, spec.replace(':', '-') + '.jpg'), 'wb').write(base64.b64decode(data))
        print(spec, flush=True)
finally:
    c.close()
