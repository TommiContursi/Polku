#!/usr/bin/env python3
"""Thumbnails for the base map switcher: img/base/<base>.jpg (128 × 128).

  python3 tools/thumbs.py

Renders each base map at one spot (Kauppi, Tampere: forest trails, a road, a field) with the UI hidden.
The Esri imagery isn't stored: "Aerial" reuses the National Land Survey aerial
photo (CC BY 4.0, via Kapsi), which looks the same at this size.
Needs the dev server and Google Chrome; uses macOS sips to scale and compress.
"""
import os
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import Chrome  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'img', 'base')
BASES = ['trail', 'maasto', 'ortofi', 'plain', 'night']
SPOT = '#14.3/61.5085/23.8250'
HIDE = ("const s = document.createElement('style'); s.textContent = 'body > :not(#map), .maplibregl-control-container { display: none !important; }';"
        " document.head.append(s); true")


def main():
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp()
    chrome = Chrome()
    try:
        for base in BASES:
            pg = chrome.page(256, 256, False)
            pg.open_app({'activity': 'mtb', 'base': base, 'timeline': False}, hash_=SPOT)
            pg.js(HIDE)
            time.sleep(1.5)
            pg.idle()
            png = pg.screenshot(os.path.join(tmp, f'{base}.png'))
            pg.close()
            jpg = os.path.join(OUT, f'{base}.jpg')
            subprocess.run(['sips', '-z', '128', '128', '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', png, '--out', jpg],
                           check=True, stdout=subprocess.DEVNULL)
            print(jpg, os.path.getsize(jpg), 'bytes', flush=True)
    finally:
        chrome.close()


if __name__ == '__main__':
    main()
