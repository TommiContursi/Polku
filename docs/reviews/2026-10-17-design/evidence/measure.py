#!/usr/bin/env python3
"""Phase 24: where the planner stands, measured the same way before and after.

  POLKU_URL=http://localhost:8772/ python3 docs/reviews/2026-10-17-design/evidence/measure.py > measure.json
  ... measure.py --only phone-mtb-peek,desk-mtb     # some scenes

Needs the dev server and Google Chrome (tools/cdp.py). MTB uses the recorded Kauppi route
(tools/fixtures/route-kauppi-mtb.json); hike routes the same points on the local BRouter
(tools/brouter-local.sh, at localhost:17777), never brouter.de; paddle uses Polku's own
water router on Näsijärvi, which needs only map tiles.

For each scene:
- map_clear: the share of the screen not under the planner (its sheet or side panel), as the
  plan measured it on 2026-10-16;
- map_seen: the share of the screen where the map itself is on top (a grid of points, every
  floating button, bar and card counts as covering it);
- controls: what can be tapped or clicked and is really on top somewhere (hit-tested),
  and how many of them are in the planner;
- small: controls under 44 × 44 px on a phone (under 24 × 24 is below WCAG 2.2's 2.5.8);
- column: on a phone, the map's buttons on the right: their top and bottom, the room between
  the top bar and the column, and anything overlapping;
- hover_sticky / tap_flash: on a phone, whether :hover rules and the tap highlight apply.
"""
import json
import os
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from cdp import Chrome  # noqa: E402

FIX = lambda name: open(os.path.join(ROOT, 'tools', 'fixtures', name)).read()
LOCAL = {'polku:brouterUrl': '"http://localhost:17777/brouter"'}
KAUPPI = [[23.7995, 61.5086], [23.8172, 61.519], [23.8255, 61.5133]]
NASI = [[23.742, 61.507], [23.700, 61.540], [23.757, 61.585]]

WAIT_ROUTE = ("new Promise((ok) => { const p = polku.planner, t0 = Date.now();"
              " const go = () => (p.legs.length && p.legs.every((l) => l.status === 'ok' || l.status === 'error') && p.analysis"
              " && (p.analysis.wind || p.analysis.windError)) || Date.now() - t0 > 45000 ? ok() : setTimeout(go, 300); go(); })")
FIT = ("(() => { const p = polku.planner, a = p.analysis; if (!a) return true;"
       " const b = a.pts.reduce((m, q) => [Math.min(m[0], q[0]), Math.min(m[1], q[1]), Math.max(m[2], q[0]), Math.max(m[3], q[1])], [180, 90, -180, -90]);"
       " const pad = p.viewPadding ? p.viewPadding() : { top: 130, bottom: 200, left: 60, right: 100 };"
       " polku.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: pad, duration: 0 }); return true; })()")

PROBE = r"""(() => {
  const W = innerWidth, H = innerHeight, phone = matchMedia('(pointer: coarse)').matches;
  const planner = document.querySelector('#planner');
  const pr = planner && !planner.hidden ? planner.getBoundingClientRect() : null;
  const inter = (r) => Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0));
  const map_clear = pr ? 1 - inter(pr) / (W * H) : 1;
  // the map on top: a grid every 8 px
  let seen = 0, all = 0;
  for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) {
    all++; const el = document.elementFromPoint(x, y);
    if (el && (el.classList.contains('maplibregl-canvas') || el.closest('.maplibregl-marker'))) seen++;
  }
  const SEL = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=switch], [role=tab], [role=radio], [role=checkbox], [role=slider], [role=menuitem], [role=option]';
  const hits = (el) => {
    let r = el.getBoundingClientRect();
    // a visually hidden input (a switch's checkbox) counts through its label
    const lab = el.tagName === 'INPUT' && (getComputedStyle(el).opacity === '0' || r.width < 2) ? el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`)) : null;
    const target = lab || el;
    r = target.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const pts = [[.5, .5], [.2, .5], [.8, .5], [.5, .2], [.5, .8]];
    for (const [fx, fy] of pts) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const top = document.elementFromPoint(x, y);
      if (top && (top === target || target.contains(top) || top.contains(target) && top !== document.body)) return target;
    }
    return null;
  };
  const seenEls = new Set(), controls = [];
  for (const el of document.querySelectorAll(SEL)) {
    if (el.closest('.maplibregl-canvas-container, .maplibregl-marker') || el.classList.contains('maplibregl-canvas')) continue; // the map's own content
    if (el.disabled || el.closest('[inert], [hidden]')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    const t = hits(el);
    if (!t || seenEls.has(t)) continue;
    seenEls.add(t);
    const r = t.getBoundingClientRect();
    const name = (el.getAttribute('aria-label') || t.textContent || el.title || el.value || el.className || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 40);
    controls.push({ name, w: Math.round(r.width), h: Math.round(r.height), inPlanner: !!(planner && planner.contains(el)), where: el.closest('#map-ctrls') ? 'column' : el.closest('.topbar') ? 'topbar' : planner && planner.contains(el) ? 'planner' : (el.closest('[id]') || {}).id || '' });
  }
  const small = phone ? controls.filter((c) => c.w < 44 || c.h < 44).map((c) => `${c.name} ${c.w}×${c.h}`) : [];
  const tiny = controls.filter((c) => c.w < 24 || c.h < 24).map((c) => `${c.name} ${c.w}×${c.h}`);
  // the map's column on the right
  const col = document.querySelector('#map-ctrls'), top = document.querySelector('.topbar');
  let column = null;
  if (col) {
    const kids = [...col.querySelectorAll(':scope > *')].filter((k) => k.getBoundingClientRect().height && getComputedStyle(k).display !== 'none' && getComputedStyle(col).visibility !== 'hidden');
    const cr = col.getBoundingClientRect(), tb = top ? top.getBoundingClientRect().bottom : 0;
    const wx = document.querySelector('#wx-bar:not([hidden])');
    column = { visible: getComputedStyle(col).visibility !== 'hidden', buttons: kids.length, top: Math.round(cr.top), bottom: Math.round(cr.bottom), height: Math.round(cr.height),
      roomAbove: Math.round(cr.top - tb), overTopbar: cr.top < tb,
      overPlanner: !!(pr && cr.left < pr.right && cr.right > pr.left && cr.top < pr.bottom - 1 && cr.bottom > pr.top + 1), overTimeline: !!(wx && (() => { const w = wx.getBoundingClientRect(); return cr.left < w.right && cr.right > w.left && cr.top < w.bottom - 1 && cr.bottom > w.top + 1; })()) };
  }
  const sheet = planner && !planner.hidden ? { state: planner.dataset.state, layout: planner.dataset.layout, height: Math.round(pr.height), top: Math.round(pr.top) } : null;
  // phones: :hover rules not inside (hover: hover), and the tap highlight
  let hoverRules = 0, hoverGuarded = 0;
  for (const s of document.styleSheets) {
    let rules; try { rules = s.cssRules; } catch { continue; }
    const walk = (list, guarded) => { for (const r of list) {
      if (r.media && r.cssRules) walk(r.cssRules, guarded || /hover:\s*hover/.test(r.media.mediaText));
      else if (r.selectorText && /:hover/.test(r.selectorText)) { if (guarded) hoverGuarded++; else hoverRules++; }
    } };
    walk(rules, false);
  }
  const tap = getComputedStyle(document.querySelector('#btn-layers') || document.body).webkitTapHighlightColor;
  return { w: W, h: H, phone, sheet, map_clear: +(map_clear * 100).toFixed(1), map_seen: +(seen / all * 100).toFixed(1),
    controls: controls.length, in_planner: controls.filter((c) => c.inPlanner).length,
    by_place: controls.reduce((m, c) => (m[c.where] = (m[c.where] || 0) + 1, m), {}),
    small, tiny, column, hover_unguarded: hoverRules, hover_guarded: hoverGuarded, tap_highlight: tap,
    names: controls.map((c) => `${c.where}: ${c.name}`) };
})()"""

PHONE = dict(w=390, h=844, phone=True)
SMALL = dict(w=360, h=740, phone=True)
SE = dict(w=375, h=667, phone=True)
DESK = dict(w=1440, h=900, phone=False)


def scenes():
    out = {}
    for size, tag in ((PHONE, 'phone'), (SMALL, 'small'), (SE, 'se')):
        for tl in (False, True):
            out[f'{tag}-closed{"-timeline" if tl else ""}'] = dict(size, sport='mtb', timeline=tl)
        out[f'{tag}-start'] = dict(size, sport='mtb', start=True)
        for st in ('peek', 'profile', 'half', 'full'):
            out[f'{tag}-mtb-{st}'] = dict(size, sport='mtb', route='kauppi', state=st, timeline=True)
    for st in ('peek', 'half'):
        out[f'phone-hike-{st}'] = dict(PHONE, sport='hike', route='hike', state=st, timeline=True)
        out[f'phone-paddle-{st}'] = dict(PHONE, sport='paddle', route='water', state=st, timeline=True)
    out['phone-mtb-half-dark'] = dict(PHONE, sport='mtb', route='kauppi', state='half', timeline=True, dark=True)
    out['desk-closed'] = dict(DESK, sport='mtb', timeline=False)
    out['desk-start'] = dict(DESK, sport='mtb', start=True)
    out['desk-mtb'] = dict(DESK, sport='mtb', route='kauppi', timeline=True)
    out['desk-mtb-bottom'] = dict(DESK, sport='mtb', route='kauppi', timeline=True, storage={'polku:plannerDock': '"bottom"'})
    out['desk-hike'] = dict(DESK, sport='hike', route='hike', timeline=True)
    out['desk-paddle'] = dict(DESK, sport='paddle', route='water', timeline=True)
    out['desk-mtb-dark'] = dict(DESK, sport='mtb', route='kauppi', timeline=True, dark=True)
    return out


def run(chrome, name, sc, shots=None):
    pg = chrome.page(sc['w'], sc['h'], sc['phone'])
    if sc.get('dark'):
        chrome.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-color-scheme', 'value': 'dark'}, {'name': 'prefers-reduced-motion', 'value': 'reduce'}]}, pg.s)
    storage = {**LOCAL, **sc.get('storage', {})}
    pg.open_app({'activity': sc['sport'], 'timeline': sc.get('timeline', False)}, storage, hash_='#13.6/61.5135/23.8170' if sc['sport'] != 'paddle' else '#12/61.545/23.73')
    if sc.get('start'):
        pg.js('polku.planner.setActive(true); true')
    if sc.get('route'):
        pg.js('polku.planner.setActive(true); true')
        if sc['route'] == 'kauppi':
            pg.js(f"polku.planner.restoreSnapshot({FIX('route-kauppi-mtb.json')}); true")
        else:
            pts = json.dumps(NASI if sc['route'] == 'water' else KAUPPI)
            mode = 'water' if sc['route'] == 'water' else 'auto'
            pg.js(f"(() => {{ const p = polku.planner; p.clear(); p.setMode('{mode}'); for (const q of {pts}) p.addPoint(q); return true; }})()")
        pg.js(WAIT_ROUTE)
        if sc.get('state'):
            pg.js(f"polku.planner.setSheetState({json.dumps(sc['state'])}, {{ remember: false }}); true")
        time.sleep(0.5)
        pg.js(FIT)
    time.sleep(2.5)
    pg.idle()
    r = pg.js(PROBE)
    if shots:
        pg.screenshot(os.path.join(shots, f'{name}.png'))
    errs = pg.errors()
    pg.close()
    return {'scene': name, **{k: v for k, v in sc.items() if k not in ('w', 'h', 'phone', 'storage')}, **r, 'errors': errs[:3]}


def main():
    only = None
    shots = None
    args = sys.argv[1:]
    if '--only' in args:
        only = set(args[args.index('--only') + 1].split(','))
    if '--shots' in args:
        shots = args[args.index('--shots') + 1]
        os.makedirs(shots, exist_ok=True)
    c = Chrome()
    out = []
    try:
        for name, sc in scenes().items():
            if only and name not in only:
                continue
            try:
                out.append(run(c, name, sc, shots))
            except Exception as e:  # one scene failing shouldn't lose the rest
                out.append({'scene': name, 'error': str(e)[:200]})
            print(name, file=sys.stderr, flush=True)
    finally:
        c.close()
    json.dump(out, sys.stdout, indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
