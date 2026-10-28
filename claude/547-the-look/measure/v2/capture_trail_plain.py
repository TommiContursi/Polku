#!/usr/bin/env python3
"""Map pictures for #547's mock-up, retaken 2026-10-28: each base map with the Kauppi route
(tools/fixtures/route-kauppi-mtb.json, no routing requests), the interface hidden, at a fixed view.
For each: <name>-route.png (the route as the app draws it), <name>.png (only the route's own layers,
`route-*`, and the point markers hidden) and <name>.json (the route's line and points in CSS px, the zoom).
Waits until the map is idle and no tile has been asked for or answered for 4 s (60 s at most).
  POLKU_URL=http://localhost:8793/ python3 capture2.py OUTDIR"""
import json, os, sys, time
sys.path.insert(0, os.path.join(os.getcwd(), 'tools'))
from cdp import Chrome  # noqa: E402
import shoot  # noqa: E402

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
HIDE_UI = """(() => { const s = document.createElement('style');
  s.textContent = 'body > *:not(#map) { visibility: hidden !important } .maplibregl-control-container, .maplibregl-popup { visibility: hidden !important }';
  document.head.append(s); return true; })()"""
HIDE_ROUTE = """(() => { for (const l of polku.map.getStyle().layers) if (l.id.startsWith('route-')) polku.map.setLayoutProperty(l.id, 'visibility', 'none');
  const s = document.createElement('style'); s.textContent = '.maplibregl-marker { visibility: hidden !important }'; document.head.append(s); return true; })()"""
PROJECT = """(() => { const m = polku.map, a = polku.planner.legs.flatMap((l) => l.result.coords), r = (p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10];
  return { zoom: m.getZoom(), center: m.getCenter().toArray(), w: innerWidth, h: innerHeight, line: a.map((c) => r(m.project(c))),
    points: polku.planner.points.map((c) => r(m.project(c))) }; })()"""
IDLE = "new Promise((ok) => { const m = polku.map; if (m.loaded() && m.areTilesLoaded()) ok(true); else m.once('idle', () => ok(true)); setTimeout(() => ok(false), 60000); })"

def settle(c, pg):
    pg.js(IDLE, timeout=65000)
    t0, last, pending = time.time(), time.time(), {}
    while time.time() - t0 < 60:
        while c.events:
            e = c.events.pop(0)
            if e.get('sessionId') != pg.s:
                continue
            m, p = e.get('method'), e.get('params', {})
            if m == 'Network.requestWillBeSent' and p.get('type') in ('Image', 'Fetch', 'XHR', 'Other'):
                pending[p['requestId']] = p['request']['url']; last = time.time()
            elif m in ('Network.loadingFinished', 'Network.loadingFailed'):
                if pending.pop(p['requestId'], None) is not None:
                    last = time.time()
        if not pending and time.time() - last > 4 and pg.js('polku.map.areTilesLoaded()'):
            return time.time() - t0
        try:
            c.events.append(c._recv(0.5))
        except RuntimeError:
            pass
    return None


def one(c, name, base, phone, centre, zoom):
    w, h = (390, 844) if phone else (1440, 900)
    pg = c.page(w, h, phone)
    try:
        pg.open_app({'activity': 'mtb', 'timeline': False, 'base': base})
        pg.js('polku.planner.setActive(true); true')
        pg.js(f"polku.planner.restoreSnapshot({shoot.FIX('route-kauppi-mtb.json')}); true")
        pg.js(shoot.WAIT_ROUTE)
        pg.js(HIDE_UI)
        pg.js(f"polku.map.setPadding({{ top: 0, bottom: 0, left: 0, right: 0 }}); polku.map.jumpTo({{ center: {json.dumps(centre)}, zoom: {zoom}, bearing: 0, pitch: 0 }}); true")
        took = settle(c, pg)
        for _ in range(60):
            n = pg.js("polku.map.queryRenderedFeatures({ layers: polku.map.getStyle().layers.filter((l) => /^path-.*-halo$/.test(l.id)).map((l) => l.id) }).length")
            if n > 50:
                break
            time.sleep(1)
        took = (took, n, settle(c, pg))
        tag = f"{name}-{'phone' if phone else 'desk'}"
        pg.screenshot(os.path.join(OUT, f'{tag}-route.png'))
        json.dump(pg.js(PROJECT), open(os.path.join(OUT, f'{tag}.json'), 'w'))
        pg.js(HIDE_ROUTE)
        time.sleep(1.5)
        pg.js(IDLE, timeout=65000)
        pg.screenshot(os.path.join(OUT, f'{tag}.png'))
        print(tag, 'settled, trails drawn, settled again:', took, pg.errors()[:1], flush=True)
    finally:
        pg.close()


VIEWS = [
    ('trail', 'trail', [23.8220, 61.5165], 13.2, [23.8300, 61.5140], 14.65),
    ('plain', 'plain', [23.8220, 61.5165], 13.2, [23.8300, 61.5140], 14.65),
]
# where a red (S3) or purple (S4–S6) trail comes nearest the route, round Kauppi at zoom 14.2
NEAR = """(() => { const m = polku.map, a = polku.planner.legs.flatMap((l) => l.result.coords);
  const ids = m.getStyle().layers.filter((l) => /^path-.*-halo$/.test(l.id)).map((l) => l.id);
  const fs = m.queryRenderedFeatures({ layers: ids }), out = [];
  for (const f of fs) { const s = +String(f.properties.mtb_scale ?? f.properties.mtb ?? '').slice(0, 1); if (!(s >= 3)) continue;
    const g = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [];
    for (const line of g) for (const c of line) { const p = m.project(c); let best = 1e9, at = null;
      for (const r of a) { const q = m.project(r), d = Math.hypot(p.x - q.x, p.y - q.y); if (d < best) { best = d; at = r; } }
      out.push({ s, d: Math.round(best), c, at }); } }
  out.sort((x, y) => x.d - y.d);
  const seen = new Set(); return out.filter((o) => { const k = o.s + ':' + Math.round(o.c[0] * 200) + ':' + Math.round(o.c[1] * 400); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12); })()"""
RECOLOUR = "(c) => { for (const id of ['route-line', 'route-glow']) polku.map.setPaintProperty(id, 'line-color', c); return true; }"


def close(c, base, n=3):
    pg = c.page(390, 844, True)
    try:
        pg.open_app({'activity': 'mtb', 'timeline': False, 'base': base})
        pg.js('polku.planner.setActive(true); true')
        pg.js(f"polku.planner.restoreSnapshot({shoot.FIX('route-kauppi-mtb.json')}); true")
        pg.js(shoot.WAIT_ROUTE)
        pg.js(HIDE_UI)
        pg.js("polku.map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 }); polku.map.jumpTo({ center: [23.8220, 61.5165], zoom: 14.2 }); true")
        settle(c, pg)
        near = pg.js(NEAR)
        json.dump(near, open(os.path.join(OUT, f'{base}-near.json'), 'w'))
        print(base, 'nearest S3+ trails', [(o['s'], o['d']) for o in near], flush=True)
        done = []
        for o in near:
            if len(done) >= n or any(abs(o['at'][0] - x[0]) + abs(o['at'][1] - x[1]) < 0.004 for x in done):
                continue
            done.append(o['at'])
            mid = [(o['c'][0] + o['at'][0]) / 2, (o['c'][1] + o['at'][1]) / 2]
            pg.js(f"polku.map.jumpTo({{ center: {json.dumps(mid)}, zoom: 16 }}); true")
            settle(c, pg)
            for name, col in (('magenta', '#d6006e'), ('today', '#e11d48')):
                pg.js(f"({RECOLOUR})('{col}')")
                time.sleep(0.6)
                pg.js(IDLE, timeout=65000)
                pg.screenshot(os.path.join(OUT, f'{base}-close{len(done)}-s{o["s"]}-{name}.png'))
    finally:
        pg.close()


c = Chrome()
try:
    for name, base, pc, pz, dc, dz in VIEWS:
        one(c, name, base, True, pc, pz)
        one(c, name, base, False, dc, dz)
finally:
    c.close()
