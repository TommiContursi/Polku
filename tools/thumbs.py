#!/usr/bin/env python3
"""Pictures of the base maps, for the quick layer drawer, Layers and the full panel: img/base/<base>.jpg
(240 × 160, drawn at twice that and scaled down; the Layers button and the full panel crop them square).

  python3 tools/thumbs.py

Renders each base map at one spot (Kauppi, Tampere: forest trails, a road, a field) with the UI hidden.
The Esri imagery isn't stored: "Aerial" shows Esri's own tile of the same spot (js/main.js,
AERIAL_THUMB), and Aerial FI's picture when it can't load.
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
SPOT = '#14.1/61.5085/23.8250'
HIDE = ("const s = document.createElement('style'); s.textContent = 'body > :not(#map), .maplibregl-control-container { display: none !important; }';"
        " document.head.append(s); true")


def main():
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp()
    chrome = Chrome()
    try:
        for base in BASES:
            pg = chrome.page(240, 160, True)  # twice the pixels: sharp after scaling down
            pg.open_app({'activity': 'mtb', 'base': base, 'timeline': False}, hash_=SPOT)
            pg.js(HIDE)
            time.sleep(1.5)
            pg.idle()
            png = pg.screenshot(os.path.join(tmp, f'{base}.png'))
            pg.close()
            jpg = os.path.join(OUT, f'{base}.jpg')
            subprocess.run(['sips', '-z', '160', '240', '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', png, '--out', jpg],
                           check=True, stdout=subprocess.DEVNULL)
            print(jpg, os.path.getsize(jpg), 'bytes', flush=True)
    finally:
        chrome.close()


if __name__ == '__main__':
    main()
