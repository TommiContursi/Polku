#!/usr/bin/env python3
"""Issue #659's controlled browser checks. Uses the same server/profile controls as smoke.py.

--dependencies reproduces the remaining failures in files owned by #623/#641.
"""
import json
import sys

from cdp import BASE, Chrome

CHECKS = [
    ('sharedCancellation', ''), ('profileSubscribers', ''), ('routeCacheBound', ''),
    ('valhallaDeadline', ''), ('valhallaCancellation', ''),
    ('terrainPool', ''), ('terrainDeadline', ''), ('lipasViewport', ''), ('lipasShared', ''), ('lipasLate', ''),
]
DEPENDENCIES = [('plannerCancellation', ''), ('networkDeadline', ''),
                ('customRefusal', '403'), ('customRefusal', '429'), ('customRefusal', '503')]


def loading(chrome, dependencies=False):
    passed = True
    for name, args in DEPENDENCIES if dependencies else CHECKS:
        pg = chrome.page(1440, 900)
        try:
            pg.goto(BASE + 'sw.js')
            pg.js("localStorage.clear(); new Promise(ok => { const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/css/app.css'; css.onload = () => ok(true); document.head.append(css); })")
            result = pg.js(f"import('/tools/loading_checks.js').then(async T => {{ try {{ return {{pass: true, metrics: await T.{name}({args})}}; }} catch(e) {{ return {{pass: false, error: e.message}}; }} }})")
            errors = pg.errors()
            if errors:
                result['pass'] = False
                result['console'] = errors
            print(f"{'ok  ' if result['pass'] else 'FAIL'} {name}({args}) {json.dumps(result)}", flush=True)
            passed &= result['pass']
        finally:
            pg.close()
    return passed


if __name__ == '__main__':
    chrome = Chrome()
    try:
        passed = loading(chrome, '--dependencies' in sys.argv)
    finally:
        chrome.close()
    sys.exit(0 if passed else 1)
