#!/usr/bin/env python3
"""Phase 24: the planner's mock-up measured as measure.py measures the app (B as chosen on 2026-10-17).

  POLKU_URL=http://localhost:8772/ python3 docs/reviews/2026-10-17-design/evidence/mockup_probe.py > mockup.json

For each frame of docs/plans/mockups/phase-24-planner.html, in variants A and B (and both
ways of showing the waypoint rows at half): controls that can be tapped and are on top
somewhere (hit-tested), how many are in the planner (its sheet or panel, and B's floating
tools), the share of the screen not under the planner, the share where the map is on top,
and controls under 44 × 44 px. The same rules as measure.py, so "after" compares with its
"before" (measure-before.json).
"""
import json
import os
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from cdp import Chrome, BASE  # noqa: E402

MOCK = 'docs/plans/mockups/phase-24-planner.html'
FRAMES = [('phone-start', 390, 844, True), ('phone-first-chip', 390, 844, True), ('phone-loop', 390, 844, True), ('phone-peek', 390, 844, True), ('phone-paddle', 390, 844, True), ('phone-half', 390, 844, True), ('desk-panel', 1440, 900, False)]
PROBE = r"""(() => {
  const scr = document.querySelector('.fr.only .screen'), S = scr.getBoundingClientRect(), W = S.width, H = S.height;
  const pl = scr.querySelector('.pl'), fl = scr.querySelector('.float');
  const area = (el) => { if (!el) return 0; const r = el.getBoundingClientRect(); return Math.max(0, Math.min(r.right, S.right) - Math.max(r.left, S.left)) * Math.max(0, Math.min(r.bottom, S.bottom) - Math.max(r.top, S.top)); };
  let seen = 0, all = 0;
  for (let y = S.top + 4; y < S.bottom; y += 8) for (let x = S.left + 4; x < S.right; x += 8) { all++; const el = document.elementFromPoint(x, y); if (el === scr || (el && el.classList.contains('shot'))) seen++; }
  const SEL = 'button, a[href], input:not([type=hidden]), select, [role=button], [role=switch], [role=tab], [role=radio], [role=checkbox]';
  const out = [];
  for (const el of scr.querySelectorAll(SEL)) {
    if (el.disabled) continue;
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    const pts = [[.5, .5], [.2, .5], [.8, .5]];
    const hit = pts.some(([fx, fy]) => { const t = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); return t && (t === el || el.contains(t)); });
    if (!hit) continue;
    // a chip's or select's ::after widens its target: measure the target, not the drawing
    const cs = getComputedStyle(el, '::after'), grow = cs.content !== 'none' && cs.position === 'absolute' ? Math.max(0, -parseFloat(cs.top) || 0) * 2 : 0;
    out.push({ name: (el.getAttribute('aria-label') || el.textContent).replace(/\s+/g, ' ').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height + grow), inPlanner: !!((pl && pl.contains(el)) || (fl && fl.contains(el))) });
  }
  return { map_clear: +((1 - area(pl) / (W * H)) * 100).toFixed(1), map_seen: +(seen / all * 100).toFixed(1), sheet: pl ? Math.round(pl.getBoundingClientRect().height) : 0,
    controls: out.length, in_planner: out.filter((c) => c.inPlanner).length, small: out.filter((c) => c.w < 44 || c.h < 44).map((c) => `${c.name} ${c.w}×${c.h}`), names: out.map((c) => c.name) };
})()"""

c = Chrome()
res = []
try:
    for fr, w, h, phone in FRAMES:
        for v in ('a', 'b'):
            for rows in (('one', 'all') if fr == 'phone-half' else ('one',)):
                p = c.page(w, h, phone)
                p.goto(f'{BASE}{MOCK}?frame={fr}&v={v}&rows={rows}')
                time.sleep(0.8)
                r = p.js(PROBE)
                res.append({'frame': fr, 'variant': v, 'rows': rows, **r, 'errors': p.errors()[:2]})
                p.close()
finally:
    c.close()
json.dump(res, sys.stdout, indent=1, ensure_ascii=False)
