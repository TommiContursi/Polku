#!/usr/bin/env python3
"""Phase 24: the one swipe in the drawer's mock-up, driven with touch events (CDP) at 390 × 844.

  POLKU_URL=http://localhost:8772/ python3 docs/reviews/2026-10-17-design/evidence/swipe_probe.py

Proves where each gesture comes to rest with the starting numbers; how it feels needs a real
phone (the test list in docs/plans/issue-123-layer-drawer.md). Each CDP event takes about 12 ms,
so a "flick" here is slower than a finger's (about 0.5 px/ms): the drawer's flicks are longer.
"""
import json
import os
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from cdp import Chrome, BASE  # noqa: E402

MOCK = 'docs/plans/mockups/issue-123-layer-drawer.html'


def touch(p, kind, x, y):
    pts = [] if kind == 'touchEnd' else [{'x': x, 'y': y, 'id': 1}]
    p.c.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': pts}, p.s)


def drag(p, x, y0, y1, ms, steps=12):
    touch(p, 'touchStart', x, y0)
    for i in range(1, steps + 1):
        time.sleep(ms / 1000 / steps)
        touch(p, 'touchMove', x, y0 + (y1 - y0) * i / steps)
    touch(p, 'touchEnd', x, y1)
    time.sleep(1.2)  # the spring settles


def state(p, sel):
    return p.js(sel)


c = Chrome()
out = []
try:
    # the planner's sheet: four sizes
    p = c.page(390, 844, phone=True)
    c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'no-preference'}]}, p.s)
    p.goto(BASE + MOCK + '?frame=phone-sheet')
    time.sleep(0.8)
    S = "document.querySelector('.ps-size').textContent"
    head = lambda: p.js("(() => { const r = document.querySelector('.ps-stats').getBoundingClientRect(); return r.top + 10; })()")
    for name, args in [
        ('slow drag up 300 px from peek, on the header', (180, None, -300, 900)),
        ('slow drag up 120 px from half', (180, None, -120, 700)),
        ('quick flick down 60 px from full', (180, None, 60, 60)),
        ('slow drag down 40 px from half (springs back)', (180, None, 40, 600)),
        ('quick flick down 80 px from half', (180, None, 80, 60)),
        ('drag that starts on Done, up 200 px', (340, None, -200, 700)),
    ]:
        x, _, dy, ms = args
        y0 = head() if x != 340 else p.js("(() => { const r = document.querySelector('.ps-done').getBoundingClientRect(); return r.top + r.height / 2; })()")
        before = state(p, S)
        drag(p, x, y0, y0 + dy, ms)
        out.append({'sheet': 'planner', 'gesture': name, 'from': before, 'to': state(p, S)})
    # a tap on a tab at peek still works (raises to half)
    drag(p, 180, head(), head() + 300, 300)
    before = state(p, S)
    t = p.js("(() => { const r = document.querySelectorAll('.ps-tabs button')[1].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
    touch(p, 'touchStart', *t); time.sleep(0.05); touch(p, 'touchEnd', *t); time.sleep(1)
    out.append({'sheet': 'planner', 'gesture': 'tap on Check at peek', 'from': before, 'to': state(p, S),
                'check_selected': p.js("document.querySelectorAll('.ps-tabs button')[1].getAttribute('aria-selected')")})
    p.close()
    # the drawer: closed, quick, all layers
    p = c.page(390, 844, phone=True)
    c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'no-preference'}]}, p.s)
    p.goto(BASE + MOCK + '?frame=phone-mtb')
    time.sleep(0.8)
    D = "(() => { const q = document.querySelector('.fr.only .qd'); return q.classList.contains('closed') ? 'closed' : q._o.view; })()"
    hy = lambda: p.js("(() => { const r = document.querySelector('.fr.only .qd-head h2').getBoundingClientRect(); return r.top + r.height / 2; })()")
    for name, dy, ms in [('slow drag down 60 px on the header (springs back)', 60, 600), ('slow drag up 120 px (all layers)', -120, 600)]:
        before = state(p, D); drag(p, 120, hy(), hy() + dy, ms)
        out.append({'sheet': 'drawer', 'gesture': name, 'from': before, 'to': state(p, D)})
    before = state(p, D); drag(p, 120, hy(), hy() + 160, 70)
    out.append({'sheet': 'drawer', 'gesture': 'quick drag down 160 px from all layers', 'from': before, 'to': state(p, D)})
    before = state(p, D); drag(p, 120, hy(), hy() + 160, 70)
    out.append({'sheet': 'drawer', 'gesture': 'quick drag down 160 px from quick', 'from': before, 'to': state(p, D)})
    # a tap on a tile still toggles it
    before = p.js("document.querySelector('.fr.only .qt-tog').getAttribute('aria-pressed')")
    p.js("document.querySelector('.fr.only .fab-layers').click(); true"); time.sleep(0.5)
    t = p.js("(() => { const r = document.querySelector('.fr.only .qt-tog').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
    touch(p, 'touchStart', *t); time.sleep(0.05); touch(p, 'touchEnd', *t); time.sleep(0.6)
    out.append({'sheet': 'drawer', 'gesture': 'tap on the first tile', 'pressed_before': before, 'pressed_after': p.js("document.querySelector('.fr.only .qt-tog').getAttribute('aria-pressed')")})
    p.close()
finally:
    c.close()
for r in out:
    print(json.dumps(r, ensure_ascii=False))
