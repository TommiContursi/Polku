#!/usr/bin/env python3
"""Paddling legs before and after phase 13's costs, in headless Chrome.

  python3 tools/water_probe.py            # all cases
  python3 tools/water_probe.py helsinki   # one

For each leg: the old router (fairways, rocks and wind ignored) against the new
one (fairways crossed straight, marked dangers kept clear, sheltered from the
forecast wind at a fixed hour), with length, milliseconds, grid cells and what
Heads-up would say. Needs the dev server (python3 serve.py); asks Väylävirasto,
Overpass and Open-Meteo once per case (cached by the app after that).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import Chrome  # noqa: E402

CASES = {
    # Helsinki: Kaivopuisto to Suomenlinna, over the Kustaanmiekka shipping lane
    'helsinki': ([24.9585, 60.1540], [24.9800, 60.1480]),
    # Turku: Ruissalo to Hirvensalo across the harbour approach
    'turku': ([22.1480, 60.4300], [22.2380, 60.4140]),
    # Tampere, Näsijärvi: Mustalahti harbour to Siilinkari, along the Tampere–Virrat fairway
    'nasijarvi': ([23.7470, 61.5090], [23.7200, 61.5620]),
    # Kokemäenjoki at Pori, down the river
    'river': ([21.8060, 61.4870], [21.7000, 61.4960]),
}

PROBE = """(async (from, to) => {
  const W = await import(location.origin + '/js/water.js');
  const at = Math.floor(Date.now() / 3600e3) * 3600 + 3 * 3600; // three hours ahead, whole hour
  const run = async (opts) => {
    const t0 = performance.now();
    const r = await W.routeWater(from, to, { at, ...opts });
    let m = 0; for (let i = 1; i < r.coords.length; i++) { const a = r.coords[i - 1], b = r.coords[i]; const k = Math.cos(a[1] * Math.PI / 180); m += Math.hypot((b[0] - a[0]) * k, b[1] - a[1]) * 111195; }
    return { km: +(m / 1000).toFixed(2), ms: Math.round(performance.now() - t0), cells: r.water && r.water.cells, pts: r.coords.length,
      wind: r.water && r.water.wind ? `${r.water.wind.speed.toFixed(1)} m/s from ${Math.round(r.water.wind.dir)}°` : '',
      events: r.water ? r.water.events.map((e) => `${e.kind} @${Math.round(e.at)} m ${Math.round(e.len)} m${e.max ? ` ${e.max.toFixed(2)} m waves` : ''}${e.name ? ` (${e.name})` : ''}`) : [],
      missing: r.water ? r.water.missing : [], times: r.water ? JSON.stringify(r.water.times) : '' };
  };
  return { before: await run({ fairways: 'ignore', hazards: 'ignore', wind: 'ignore' }) };
})"""
PROBE_AFTER = PROBE.replace("return { before: await run({ fairways: 'ignore', hazards: 'ignore', wind: 'ignore' }) };", "return { after: await run({}), sup: await run({ craft: 'sup' }) };")


def main():
    names = sys.argv[1:] or list(CASES)
    c = Chrome()
    try:
        pg = c.page(1200, 800, False)
        pg.open_app({'activity': 'paddle'}, None, '#12/60.16/24.96')
        for n in names:
            a, b = CASES[n]
            r = pg.js(f"{PROBE}({json.dumps(a)}, {json.dumps(b)})", timeout=80000)
            r.update(pg.js(f"{PROBE_AFTER}({json.dumps(a)}, {json.dumps(b)})", timeout=80000))
            print(f'== {n}')
            for k in ('before', 'after', 'sup'):
                v = r[k]
                print(f"  {k:6} {v['km']:6.2f} km  {v['ms']:5d} ms  {v['cells'] or 0:8d} cells  {v['pts']:3d} pts  {v['wind']}  {'; '.join(v['events'])}  {('missing: ' + ', '.join(v['missing'])) if v['missing'] else ''}  {v['times']}")
        errs = pg.errors()
        if errs:
            print('console:', errs[:3])
    finally:
        c.close()


if __name__ == '__main__':
    main()
