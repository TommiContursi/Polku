import json, os, sys
sys.path.insert(0, '/Users/tommicontursi/Websites/Polku/.worktrees/547-look/tools')
from cdp import Chrome, BASE
PAGE = BASE + 'docs/plans/mockups/issue-547-the-look.html'
WAIT = "new Promise((ok) => { const go = () => window.lookMeasure && window.lookMeasure() ? window.lookMeasure().then(ok) : setTimeout(go, 100); go(); })"
c = Chrome()
try:
    pg = c.page(1600, 1300, False)
    for theme in ('light', 'dark'):
        for dev in ('phone', 'desk'):
            for m in ('maasto', 'night'):
                pg.goto(PAGE + f'?ver=2&dir=b&map={m}&theme={theme}&device={dev}&mode=default&depth=one&compare=0')
                base = pg.js(WAIT, timeout=90000)[0]
                out = [f"now {base['fabDE']:.1f}/{base['icon']:.2f}"]
                alphas = (.80, .84) if theme == 'light' else (.80, .84)
                for a in alphas:
                    for sat in (160, 150):
                        bg = f'rgba(255, 255, 255, {a})' if theme == 'light' else f'rgba(8, 10, 9, {a})'
                        r = pg.js(f"lookTry({{'--thin-bg': '{bg}', '--thin-filter': 'blur(24px) saturate({sat}%)'}})", timeout=90000)[0]
                        out.append(f"{a}/{sat}: {r['fabDE']:.1f}/{r['icon']:.2f}")
                print(theme, dev, m.ljust(6), ' | '.join(out), flush=True)
finally:
    c.close()
