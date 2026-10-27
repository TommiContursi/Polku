#!/usr/bin/env python3
"""The blur's cost while the map pans (#547): the mock-up's pan test in Chrome on the Mac's GPU (Metal), per version,
phone and desktop. The software renderer of tools/cdp.py says nothing about a GPU, so its flags are swapped here.
  POLKU_URL=http://localhost:8793/ python3 gpu_pan.py [headed]"""
import json, os, subprocess, sys, time
sys.path.insert(0, os.path.join(os.getcwd(), 'tools'))
import cdp  # noqa: E402
real = subprocess.Popen
def popen(args, **kw):
    args = [a for a in args if a not in ('--use-angle=swiftshader', '--enable-unsafe-swiftshader')] + ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist']
    if 'headed' in sys.argv:
        args = [a for a in args if not a.startswith('--headless')]
    return real(args, **kw)
cdp.subprocess.Popen = popen
PAGE = cdp.BASE + 'docs/plans/mockups/issue-547-the-look.html'
WAIT = "new Promise((ok) => { const go = () => window.lookMeasure && window.lookMeasure() ? window.lookMeasure().then(ok) : setTimeout(go, 100); go(); })"
PAN = """(async () => { const fig = document.querySelector('#stage .fr:last-child'); fig.scrollIntoView(); fig.querySelector('[data-act="pan"]').click();
  await new Promise((r) => setTimeout(r, 3500)); return fig.querySelector('.pan-out').textContent; })()"""
c = cdp.Chrome()
try:
    pg = c.page(1600, 1100, False)
    pg.goto(PAGE + '?dir=today&map=forest&theme=light&device=phone')
    pg.js(WAIT, timeout=90000)
    print('GPU:', pg.js("(() => { const g = document.createElement('canvas').getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'none'; })()"), '| visible:', pg.js('document.visibilityState'), flush=True)
    for device in ('phone', 'desk'):
        for d in ('today', 'a', 'b', 'c'):
            outs = []
            for _ in range(2):
                pg.goto(PAGE + f'?dir={d}&map=forest&theme=light&device={device}&mode=default&depth=thick')
                pg.js(WAIT, timeout=90000)
                outs.append(pg.js(PAN, timeout=20000).split('. (')[0])
            print(device, d, '|', ' || '.join(outs), flush=True)
        pg.goto(PAGE + f'?dir=b&map=forest&theme=light&device={device}&mode=clear&depth=thick')
        pg.js(WAIT, timeout=90000)
        print(device, 'b, reduced transparency (no blur) |', pg.js(PAN, timeout=20000).split('. (')[0], flush=True)
finally:
    c.close()
