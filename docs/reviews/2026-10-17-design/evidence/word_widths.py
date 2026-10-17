#!/usr/bin/env python3
"""Phase 24: how wide tile words are at the quick drawer's label font (12.5 px, 600), in
English, Finnish and Swedish, against the room a label has beside a › at 360 and 390 px.

  POLKU_URL=http://localhost:8772/ python3 docs/reviews/2026-10-17-design/evidence/word_widths.py
"""
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from cdp import Chrome, BASE  # noqa: E402

WORDS = {
    'en': ['Rain', 'radar', 'Depths', 'Trail', 'colours', 'Temperature', '3D', 'terrain', 'Wind', 'Official', 'routes', 'Waymarked', 'hiking', 'Nautical', 'marks', 'Landing', 'lean-tos'],
    'fi': ['Sadetutka', 'Syvyystiedot', 'Syvyydet', 'Polkujen', 'vaikeusvärit', 'Polkuvärit', 'Lämpötila', '3D-maasto', 'Kolmiulotteinen', 'Tuuli', 'Viralliset', 'reitit', 'Merkityt', 'retkeilyreitit', 'Merimerkit', 'Rantautumispaikat', 'Laavut', 'Talvireitit', 'Merijää', 'Kiireiset', 'Tietyöt', 'yksityiskohdat', 'Lisää'],
    'sv': ['Regnradar', 'Djupdata', 'Djup', 'Ledfärger', 'Temperatur', '3D-terräng', 'Vind', 'Officiella', 'leder', 'Vandringsleder', 'Sjömärken', 'Iland­stigningsplatser', 'Vindskydd', 'Fartyg', 'Vägarbeten'],
}
PROBE = """((words) => {
  const s = document.createElement('span');
  s.style.cssText = 'position:absolute;white-space:nowrap;font:600 12.5px/1.2 "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  document.body.append(s);
  const out = {};
  for (const [lang, list] of Object.entries(words)) out[lang] = Object.fromEntries(list.map((w) => { s.textContent = w; return [w, Math.round(s.getBoundingClientRect().width)]; }));
  return { font: getComputedStyle(s).fontFamily, out };
})(%s)"""

c = Chrome()
try:
    p = c.page(390, 844, phone=True)
    p.goto(BASE + 'docs/plans/mockups/issue-123-layer-drawer.html')
    r = p.js(PROBE % json.dumps(WORDS))
finally:
    c.close()
print(json.dumps(r, ensure_ascii=False, indent=1))
