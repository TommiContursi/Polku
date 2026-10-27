import json, os, sys
sys.path.insert(0, os.path.join(os.getcwd(), 'tools'))
from cdp import Chrome, BASE
WAIT = "new Promise((ok) => { const go = () => window.lookMeasure && window.lookMeasure() ? window.lookMeasure().then(ok) : setTimeout(go, 100); go(); })"
c = Chrome(); out = {}
try:
    pg = c.page(1600, 1200, False)
    for dev in ('phone', 'desk'):
        for m in ('maasto', 'bright'):
            pg.goto(BASE + f'docs/plans/mockups/issue-547-the-look.html?dir=b&map={m}&theme=dark&device={dev}&mode=default&depth=one&compare=0')
            pg.js(WAIT, timeout=90000)
            for tint in ('18, 22, 20', '8, 10, 9'):
                for sat in ('160%', '110%'):
                    for mg in ('#c5cec9', '#d9e0dc'):
                        for a in (.55, .6, .65, .7):
                            v = {'--thin-bg': f'rgba({tint}, {a})', '--thick-bg': f'rgba({tint}, {round(a + .06, 2)})', '--thin-filter': f'blur(20px) saturate({sat})', '--thick-filter': f'blur(32px) saturate({sat})', '--muted-glass': mg}
                            r = pg.js(f"window.lookTry({json.dumps(v)})", timeout=90000)[0]
                            k = (tint, sat, mg, a)
                            out.setdefault(k, []).append(min(r['text'], r['muted'], r['other']) if r['icon'] >= 3 else -r['icon'])
finally:
    c.close()
for k, v in sorted(out.items(), key=lambda kv: (kv[0][0], kv[0][1], kv[0][2], kv[0][3])):
    print(k, 'worst over maasto+city, phone+desk:', round(min(v), 2), 'PASS' if min(v) >= 4.5 else '')
