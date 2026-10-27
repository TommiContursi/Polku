import json, os, sys
sys.path.insert(0, os.path.join(os.getcwd(), 'tools'))
from cdp import Chrome, BASE
PAGE = BASE + 'docs/plans/mockups/issue-547-the-look.html'
WAIT = "new Promise((ok) => { const go = () => window.lookMeasure && window.lookMeasure() ? window.lookMeasure().then(ok) : setTimeout(go, 100); go(); })"
CAND = {
  'light': {'now': None,
            'L1': 'inset 0 0 0 1px rgba(255,255,255,.6), 0 0 0 1px rgba(16,24,20,.4)',
            'L2': 'inset 0 0 0 1px rgba(255,255,255,.7), 0 0 0 1px rgba(16,24,20,.55)'},
  'dark': {'now': None,
           'D1': 'inset 0 0 0 1px rgba(255,255,255,.24), 0 0 0 1px rgba(0,0,0,.55)',
           'D2': 'inset 0 0 0 1px rgba(255,255,255,.34), 0 0 0 1px rgba(0,0,0,.7)'},
}
c = Chrome(); res = {}
try:
    pg = c.page(1600, 1200, False)
    for d in ('a', 'b', 'c'):
        for th in ('light', 'dark'):
            for dev in ('phone', 'desk'):
                for m in ('maasto', 'bright', 'forest', 'night'):
                    pg.goto(PAGE + f'?dir={d}&map={m}&theme={th}&device={dev}&mode=default&depth=one&compare=0')
                    pg.js(WAIT, timeout=90000)
                    for name, e in CAND[th].items():
                        if e:
                            r = pg.js(f"window.lookTry({json.dumps({'--edge-thin': e, '--edge-thick': e})})", timeout=90000)[0]
                        else:
                            r = pg.js(WAIT, timeout=90000)[0]
                        res.setdefault(f'{d} {th} {name}', []).append((r['edge'], r['edgeMin'], m, dev))
            print(d, 'done', flush=True)
finally:
    c.close()
for k, v in res.items():
    print(k, 'avg', round(sum(x[0] for x in v) / len(v) * 100), '% worst map avg', round(min(x[0] for x in v) * 100), '% worst surface', round(min(x[1] for x in v) * 100), '%', min(v, key=lambda x: x[0])[2:])
