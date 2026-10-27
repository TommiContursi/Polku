import json, os, sys
sys.path.insert(0, os.path.join(os.getcwd(), 'tools'))
from cdp import Chrome, BASE
d, th = sys.argv[1], sys.argv[2]
WAIT = "new Promise((ok) => { const go = () => window.lookMeasure && window.lookMeasure() ? window.lookMeasure().then(ok) : setTimeout(go, 100); go(); })"
c = Chrome(); rows = []
try:
    pg = c.page(1600, 1200, False)
    for mode in ('default', 'clear', 'contrast'):
        for dev in ('phone', 'desk'):
            for m in ('maasto', 'bright', 'forest', 'night'):
                pg.goto(BASE + f'docs/plans/mockups/issue-547-the-look.html?dir={d}&map={m}&theme={th}&device={dev}&mode={mode}&depth=one&compare=0')
                rows += pg.js(WAIT, timeout=90000)
finally:
    c.close()
for mode in ('default', 'clear', 'contrast'):
    rs = [r for r in rows if r['mode'] == mode]
    print(mode, 'text', round(min(r['text'] for r in rs), 2), 'muted', round(min(r['muted'] for r in rs), 2), 'other', round(min(r['other'] for r in rs), 2), 'icon', round(min(r['icon'] for r in rs), 2), 'edges avg', round(sum(r['edge'] for r in rs) / len(rs) * 100), '% worst', round(min(r['edge'] for r in rs) * 100), '%')
