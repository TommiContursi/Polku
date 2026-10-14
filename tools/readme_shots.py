#!/usr/bin/env python3
"""The README's screenshots: scenes from tools/shoot.py, saved as WebP in docs/screenshots.

  python3 tools/readme_shots.py            # all of them
  python3 tools/readme_shots.py water      # one (by its README name)

Needs the dev server (python3 serve.py), Google Chrome and cwebp (brew install webp).
Round trips route with a local BRouter (tools/brouter-local.sh); the weather and
traffic pictures use live data, the rest recorded fixtures.
"""
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'docs', 'screenshots')

# README name -> (shoot.py scene, width in px). Desktop shots are 1440 × 900, phones 780 px wide (2×).
SHOTS = {
    'planner': ('desk-bottom', 1440),
    'trails': ('desk-trails-close', 1440),
    'uphill': ('desk-trails-uphill', 1440),
    'headsup': ('desk-trail-headsup', 1440),
    'roundtrip': ('desk-roundtrip', 1440),
    'search': ('desk-search-lipas', 1440),
    'water': ('desk-water-crossing', 1440),
    'weather': ('desk-wind-map', 1440),
    'traffic': ('desk-traffic', 1440),
    'phone-planner': ('phone-planner', 600),
    'phone-roundtrip': ('phone-roundtrip', 600),
    'phone-lipas': ('phone-lipas-ride', 600),
}


def main():
    names = sys.argv[1:] or list(SHOTS)
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        scenes = [SHOTS[n][0] for n in names]
        subprocess.run([sys.executable, os.path.join(HERE, 'shoot.py'), tmp, 'r', *scenes], check=True)
        for n in names:
            scene, width = SHOTS[n]
            src = os.path.join(tmp, f'r-{scene}.png')
            dst = os.path.join(OUT, f'{n}.webp')
            subprocess.run(['cwebp', '-quiet', '-q', '78', '-resize', str(width), '0', src, '-o', dst], check=True)
            print(f'{dst}  {os.path.getsize(dst) // 1024} KB', flush=True)


if __name__ == '__main__':
    main()
