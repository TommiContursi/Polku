#!/usr/bin/env python3
"""Phase 24: the quick layer drawer's mock-up (#123), measured at phone sizes.

  POLKU_URL=http://localhost:8772/ python3 docs/reviews/2026-10-17-design/evidence/drawer_probe.py [mockup.html] > out.json

For each frame, size and data (demo, worst): the sheet's height as a share of the screen,
the room left above it, every word in a tile's label or a map's name that breaks across
lines, and every target under 44 px. Uses tools/cdp.py (headless Chrome).
"""
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from cdp import Chrome, BASE  # noqa: E402

MOCK = sys.argv[1] if len(sys.argv) > 1 else 'docs/plans/mockups/issue-123-layer-drawer.html'
FRAMES = ['phone-mtb', 'phone-paddle', 'phone-hike-dark', 'phone-planner', 'phone-opts', 'phone-edit']
SIZES = [(390, 844), (360, 740), (375, 667), (195, 422)]  # 195 × 422: a 390 phone at 200 % zoom

PROBE = r"""(() => {
  const scr = document.querySelector('.fr.only .screen'), qd = scr.querySelector('.qd');
  const S = scr.getBoundingClientRect(), Q = qd.getBoundingClientRect();
  const broken = [];
  for (const el of qd.querySelectorAll('.qt-l, .qd-base > span, .qd-head h2, .qd-lab, .qd-chip, .qt-rm .qt-l')) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const re = /\S+/g; let m;
      while ((m = re.exec(n.data))) {
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const lines = new Set([...r.getClientRects()].filter((x) => x.width >= 1).map((x) => Math.round(x.top)));
        if (lines.size < 2) continue;
        // a break at a soft hyphen or a hyphen is where the language allows one; anywhere else is a bad break
        // (the hyphen drawn at a soft hyphen is a rect of its own, about 5 px wide, and is left out)
        let at = 0, good = true;
        for (const part of m[0].split(/(?<=[\u00AD-])/)) {
          const q = document.createRange(); q.setStart(n, m.index + at); q.setEnd(n, m.index + at + part.length); at += part.length;
          if (new Set([...q.getClientRects()].filter((x) => x.width >= 7).map((x) => Math.round(x.top))).size > 1) good = false;
        }
        broken.push({ word: m[0].replace(/\u00AD/g, '·'), good, width: Math.round(el.getBoundingClientRect().width) });
      }
    }
  }
  const small = [...qd.querySelectorAll('button, [role=switch], input, a')].filter((b) => {
    const r = b.getBoundingClientRect(); return r.width && (r.width < 44 || r.height < 44) && !b.matches('.qd-base');
  }).map((b) => `${b.className || b.tagName} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`);
  const body = qd.querySelector('.qd-body');
  const tog = qd.querySelector('.qt-opt') && qd.querySelector('.qt-opt').closest('.qt').querySelector('.qt-l');
  return { sheet: +(Q.height / S.height * 100).toFixed(1), sheetPx: Math.round(Q.height), above: Math.round(Q.top - S.top),
    scrolls: body.scrollHeight > body.clientHeight + 1, broken, small: [...new Set(small)],
    labelBesideChevron: tog ? Math.round(tog.getBoundingClientRect().width) : null };
})()"""

c = Chrome()
out = []
try:
    for data in ('demo', 'worst'):
        for fr in FRAMES:
            for w, h in SIZES:
                p = c.page(w, h, phone=True)
                url = f'{BASE}{MOCK}?frame={fr}&w={w}&h={h}' + ('&data=worst' if data == 'worst' else '')
                p.goto(url)
                p.js('new Promise((r) => setTimeout(r, 300))')
                r = p.js(PROBE)
                out.append({'data': data, 'frame': fr, 'size': f'{w}×{h}', **r})
                p.close()
finally:
    c.close()
json.dump(out, sys.stdout, indent=1, ensure_ascii=False)
