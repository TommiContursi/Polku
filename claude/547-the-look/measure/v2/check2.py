import sys
sys.path.insert(0, '/Users/tommicontursi/Websites/Polku/.worktrees/547-look/tools')
from cdp import Chrome, BASE
PAGE = BASE + 'docs/plans/mockups/issue-547-the-look.html'
WAIT = "new Promise((ok) => { const go = () => window.lookMeasure && window.lookMeasure() ? window.lookMeasure().then(ok) : setTimeout(go, 100); go(); })"
c = Chrome()
try:
    pg = c.page(1600, 1300, False)
    for th in ('light', 'dark'):
        for m in ('maasto', 'forest'):
            pg.goto(PAGE + f'?ver=2&dir=b&map={m}&theme={th}&device=desk&mode=contrast&depth=one')
            r = pg.js(WAIT, timeout=90000)[0]
            print('contrast b desk', th, m, 'edge', round(r['edge']*100), 'min', round(r['edgeMin']*100), r['lowest']['edge'])
    for th in ('light', 'dark'):
        bgc = '255, 255, 255' if th == 'light' else '8, 10, 9'
        for dev in ('phone', 'desk'):
            out = []
            for m in ('maasto', 'night'):
                pg.goto(PAGE + f'?ver=2&dir=b&map={m}&theme={th}&device={dev}&mode=default&depth=one')
                pg.js(WAIT, timeout=90000)
                for a, sat in ((.84, 105), (.72, 105)):
                    r = pg.js(f"lookTry({{'--thin-bg': 'rgba({bgc}, {a})', '--thin-filter': 'blur(24px) saturate({sat}%)'}})", timeout=90000)[0]
                    out.append(f"{m} {a}/{sat}: {r['fabDE']:.1f} icon {r['icon']:.2f}")
            print(th, dev, ' | '.join(out), flush=True)
finally:
    c.close()
