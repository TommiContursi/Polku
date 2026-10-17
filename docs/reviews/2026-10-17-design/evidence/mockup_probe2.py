#!/usr/bin/env python3
"""Phase 24, second iteration (#233): the planner's mock-up measured, every frame, normal and worst case.

  POLKU_URL=http://localhost:8782/ python3 docs/reviews/2026-10-17-design/evidence/mockup_probe2.py > mockup-iter2.json

For each frame of docs/plans/mockups/phase-24-planner.html, alone at full size (?frame=), with the
same rules as measure.py and mockup_probe.py: the share of the screen not under the planner
(its sheet or panel, and the toolbox), the share where the map is on top (sampled every 8 px),
controls that can be pressed and are on top somewhere (hit-tested), how many are the planner's,
and controls under 44 × 44 px. Then what break-ui looks for: controls that overlap each other,
controls partly off the screen, and text cut short with an ellipsis (named, so a person can judge
whether what's cut matters). Each frame runs in English with normal data, and again with the
worst case in Finnish and Swedish (long words, 52 points, 123 km, many warnings).
"""
import json
import os
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from cdp import Chrome, BASE  # noqa: E402

MOCK = 'docs/plans/mockups/phase-24-planner.html'
PHONE = ['tb-phone', 'tb-phone-calm', 'tb-phone-menu', 'tb-phone-style', 'rt-first', 'rt-form', 'rt-time', 'rt-making', 'rt-results',
         'trip-phone', 'trip-clear', 'fin-edit', 'fin-view', 'fin-view-go', 'fin-closed', 'fin-later', 'chk-phone', 'chk-paddle', 'chk-peek',
         'wp-phone', 'wp-long', 'wp-move', 'wp-key', 'play-phone']
DESK = ['tb-desk', 'rt-desk', 'trip-desk', 'fin-desk-view', 'chk-desk', 'wp-desk', 'play-desk']
# (suffix, query): every frame as it is, then the worst case in Finnish and in Swedish; phones also at 360 × 740 and at 200 %
VARIANTS = [('en', ''), ('fi-worst', '&lang=fi&worst=1'), ('sv-worst', '&lang=sv&worst=1')]
PHONE_EXTRA = [('360-fi-worst', '&w=360&h=740&lang=fi&worst=1'), ('200', '&z=2')]
PROBE = r"""(() => {
  const scr = document.querySelector('.fr.only .screen'), S = scr.getBoundingClientRect(), W = S.width, H = S.height;
  const pl = scr.querySelector('.pl'), fl = scr.querySelector('.float, .deskbar');
  const area = (el) => { if (!el) return 0; const r = el.getBoundingClientRect(); return Math.max(0, Math.min(r.right, S.right) - Math.max(r.left, S.left)) * Math.max(0, Math.min(r.bottom, S.bottom) - Math.max(r.top, S.top)); };
  let seen = 0, all = 0;
  for (let y = S.top + 4; y < S.bottom; y += 8) for (let x = S.left + 4; x < S.right; x += 8) { all++; const el = document.elementFromPoint(x, y); if (el === scr) seen++; }
  const SEL = 'button, a[href], input:not([type=hidden]), select, [role=button], [role=switch], [role=tab], [role=radio], [role=checkbox], [role=menuitem], [role=menuitemradio]';
  const scrolls = (el) => { for (let n = el.parentElement; n && n !== scr; n = n.parentElement) { const o = getComputedStyle(n); if (/auto|scroll/.test(o.overflowY + o.overflowX) && (n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1)) return true; } return false; };
  const out = [];
  for (const el of scr.querySelectorAll(SEL)) {
    if (el.disabled || el.closest('[hidden]')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const pts = [[.5, .5], [.2, .5], [.8, .5], [.5, .25], [.5, .75]];
    const hit = pts.some(([fx, fy]) => { const t = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); return t && (t === el || el.contains(t)); });
    if (!hit) continue;
    // a chip's or button's ::after widens its target: measure the target, not the drawing
    const cs = getComputedStyle(el, '::after'), grow = cs.content !== 'none' && cs.position === 'absolute' ? Math.max(0, -parseFloat(cs.top) || 0) * 2 : 0;
    out.push({ el, r, name: (el.getAttribute('aria-label') || el.textContent).replace(/\s+/g, ' ').trim().slice(0, 48), w: Math.round(r.width), h: Math.round(r.height + grow),
      inPlanner: !!((pl && pl.contains(el)) || (fl && fl.contains(el)) || el.closest('.popmenu')),
      // off the screen, and not just scrolled part-way out of a sheet or list that scrolls (that's reachable)
      off: (r.left < S.left - 1 || r.right > S.right + 1 || r.top < S.top - 1 || r.bottom > S.bottom + 1) && !scrolls(el) });
  }
  // overlapping controls (neither inside the other), as a finger would meet them
  const overlaps = [];
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const a = out[i], b = out[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ox > 4 && oy > 4) overlaps.push(`${a.name} × ${b.name}`);
  }
  // text cut short: an ellipsis that's actually used
  const cut = [];
  for (const el of scr.querySelectorAll('*')) {
    if (!el.childNodes.length || el.closest('.popmenu, .pl, .float, .deskbar, .top') === null) continue;
    const cs = getComputedStyle(el);
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && el.offsetParent) cut.push(el.textContent.trim().slice(0, 60));
  }
  const small = out.filter((c) => c.inPlanner && (c.w < 44 || c.h < 44)).map((c) => `${c.name} ${c.w}×${c.h}`);
  return { map_clear: +((1 - (area(pl) + (fl && fl.classList.contains('float') ? area(fl) : 0)) / (W * H)) * 100).toFixed(1), map_clear_sheet: +((1 - area(pl) / (W * H)) * 100).toFixed(1), map_seen: +(seen / all * 100).toFixed(1),
    sheet: pl ? Math.round(pl.getBoundingClientRect().height) : 0, docked: !!scr.querySelector('.dockbox'),
    controls: out.length, in_planner: out.filter((c) => c.inPlanner).length, small_in_planner: small,
    off_screen: out.filter((c) => c.off).map((c) => c.name), overlaps, cut };
})()"""

c = Chrome()
res = []
try:
    jobs = [(fr, 390, 844, True, v) for fr in PHONE for v in VARIANTS + PHONE_EXTRA] + [(fr, 1440, 900, False, v) for fr in DESK for v in VARIANTS]
    for fr, w, h, phone, (name, q) in jobs:
        p = c.page(w, h, phone)
        p.goto(f'{BASE}{MOCK}?frame={fr}{q}')
        time.sleep(0.7)
        r = p.js(PROBE)
        res.append({'frame': fr, 'variant': name, 'size': f'{w}x{h}', **r, 'errors': p.errors()[:2]})
        print(fr, name, r['map_seen'], len(r['small_in_planner']), len(r['overlaps']), len(r['off_screen']), file=sys.stderr, flush=True)
        p.close()
finally:
    c.close()
json.dump(res, sys.stdout, indent=1, ensure_ascii=False)
