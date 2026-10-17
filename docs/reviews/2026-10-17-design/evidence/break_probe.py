#!/usr/bin/env python3
"""Phase 24, break-ui: the planner with worst-case data, through its own API (names, points).

  POLKU_URL=http://localhost:8772/ python3 docs/reviews/2026-10-17-design/evidence/break_probe.py OUTDIR > break.json

Demo: the recorded Kauppi route (3 points). Worst: 30 straight-line points with names a
person really types (up to the field's 60 characters, one-letter, an emoji), and a hike of
120 km over three points. Each at 360 × 740 and 195 × 422 (a 390 phone at 200 % zoom), at
peek, half and full. Straight lines need no routing. Reports text that overflows its box,
anything wider than the screen, and controls whose label is cut with no way to read it.
"""
import json
import os
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from cdp import Chrome  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(OUT, exist_ok=True)
FIX = open(os.path.join(ROOT, 'tools', 'fixtures', 'route-kauppi-mtb.json')).read()
NAMES = ['Nuuksion kansallispuiston Haukankierroksen pysäköintialue', 'Ii', '☕ Kahvi ja munkki Pyynikin näkötornilla',
         'Kaupin urheilupuiston ulkoilumajan parkkipaikka (maksullinen)', 'Hervannan vesitorni', 'Lähde', 'Ö']
WORST30 = ("(() => { const p = polku.planner; p.clear(); p.setMode('line');"
           " for (let i = 0; i < 30; i++) p.addPoint([23.70 + (i % 10) * 0.035, 61.47 + Math.floor(i / 10) * 0.02 + (i % 2) * 0.004]);"
           f" const N = {json.dumps(NAMES, ensure_ascii=False)}; N.forEach((n, i) => p.setName(i * 4, n)); return p.points.length; }})()")
LONG = ("(() => { const p = polku.planner; p.clear(); p.setMode('line');"
        " for (const q of [[23.76, 61.50], [24.30, 61.00], [24.94, 60.17]]) p.addPoint(q); return p.points.length; })()")
WAIT = ("new Promise((ok) => { const p = polku.planner, t0 = Date.now(); const go = () => (p.legs.length && p.legs.every((l) => l.status === 'ok' || l.status === 'error') && p.analysis)"
        " || Date.now() - t0 > 60000 ? ok() : setTimeout(go, 300); go(); })")
PROBE = r"""(() => {
  const W = innerWidth, pl = document.querySelector('#planner'), out = { overflow: [], wide: [], cut: [] };
  for (const el of pl.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (!r.width || getComputedStyle(el).visibility === 'hidden') continue;
    if (r.right > W + 1 || r.left < -1) out.wide.push(`${el.className || el.tagName} ${Math.round(r.left)}..${Math.round(r.right)}`);
    const cs = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX === 'visible' && el.children.length === 0 && el.textContent.trim()) out.overflow.push(`${el.className || el.tagName}: ${el.textContent.trim().slice(0, 40)}`);
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.cut.push(`${el.className || el.tagName}: ${(el.value || el.textContent).trim().slice(0, 40)}${el.title || el.getAttribute('aria-label') ? ' (title)' : ''}`);
  }
  for (const k of Object.keys(out)) out[k] = [...new Set(out[k])].slice(0, 12);
  const head = pl.querySelector('.sheet-head');
  out.head = head ? Math.round(head.getBoundingClientRect().height) : null;
  out.sheet = Math.round(pl.getBoundingClientRect().height);
  out.summary = (pl.querySelector('.stats, .sum') || {}).textContent?.replace(/\s+/g, ' ').trim().slice(0, 80);
  out.rows = pl.querySelectorAll('.wpl-row').length;
  out.bodyScroll = (() => { const b = pl.querySelector('.sheet-body'); return b ? Math.round(b.scrollHeight) : 0; })();
  return out;
})()"""

c = Chrome()
res = []
try:
    for data, js, sport in (('demo', None, 'mtb'), ('worst30', WORST30, 'mtb'), ('long', LONG, 'hike')):
        for w, h in ((360, 740), (195, 422)):
            p = c.page(w, h, phone=True)
            p.open_app({'activity': sport, 'timeline': True})
            p.js('polku.planner.setActive(true); true')
            if js:
                p.js(js)
            else:
                p.js(f'polku.planner.restoreSnapshot({FIX}); true')
            p.js(WAIT)
            for st in ('peek', 'half', 'full'):
                p.js(f"polku.planner.setSheetState('{st}', {{ remember: false }}); polku.planner.reveal && polku.planner.reveal('points'); true")
                time.sleep(1.2)
                r = p.js(PROBE)
                shot = os.path.join(OUT, f'break-{data}-{w}x{h}-{st}.png')
                p.screenshot(shot)
                res.append({'data': data, 'size': f'{w}×{h}', 'state': st, **r, 'shot': os.path.basename(shot)})
                print(data, w, st, file=sys.stderr, flush=True)
            res[-1]['errors'] = p.errors()[:3]
            p.close()
finally:
    c.close()
json.dump(res, sys.stdout, indent=1, ensure_ascii=False)
