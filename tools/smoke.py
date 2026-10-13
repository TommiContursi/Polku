#!/usr/bin/env python3
"""Smoke test for Polku's layout: no overlapping controls, no console errors, planner states work.

  python3 tools/smoke.py            # all viewports
  python3 tools/smoke.py 390x844    # just one size
  python3 tools/smoke.py layers     # just the Layers panel in every sport

Needs the dev server (python3 serve.py) and Google Chrome. Draws a straight-line
route (no routing requests). The forecast comes from Open-Meteo, cached for an hour.
Exits 1 if anything fails.
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import Chrome  # noqa: E402

# (width, height, phone, planner docked at the bottom on desktop)
VIEWPORTS = [(1440, 900, False, False), (1440, 900, False, True), (1024, 768, False, False), (390, 844, True, False), (360, 740, True, False)]

# Visible boxes that must never overlap each other (toasts and popups are transient and skipped).
BOXES = """(() => {
  const sel = ['.topbar .brand', '.topbar .search', '#activity-bar .act-current', '#zoom-hint', '#btn-settings', '.map-ctrls', '#planner', '#wx-bar:not(.docked)', '#view3d',
    '.maplibregl-ctrl-attrib', '.maplibregl-ctrl-scale', '.offline-banner', '.panel'];
  const out = [];
  for (const s of sel) for (const e of document.querySelectorAll(s)) {
    if (e.closest('[hidden]') || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden') continue;
    let r = e.getBoundingClientRect();
    if (s === '.maplibregl-ctrl-attrib' && !e.classList.contains('maplibregl-compact-show')) { const b = e.querySelector('.maplibregl-ctrl-attrib-button'); if (b) r = b.getBoundingClientRect(); }
    if (r.width < 2 || r.height < 2) continue;
    out.push({ s: s + (e.id ? '' : `[${[...document.querySelectorAll(s)].indexOf(e)}]`), l: r.left, t: r.top, r: r.right, b: r.bottom });
  }
  return out;
})()"""


# Drag the middle of the first leg (straight-line legs: no routing requests):
# with the mouse on desktop, hold-then-drag on touch. Expect one new point under
# the pointer, one undo step, an unmoved map and map panning back on.
EDIT = """(async () => {
  const p = polku.planner, map = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const a = p.analysis.pts, b = a.reduce((m, q) => [Math.min(m[0], q[0]), Math.min(m[1], q[1]), Math.max(m[2], q[0]), Math.max(m[3], q[1])], [180, 90, -180, -90]);
  map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: p.viewPadding(), duration: 0 });
  await wait(600);
  const c = p.legs[0].result.coords, q = map.project([(c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2]);
  const cv = map.getCanvas(), R = cv.getBoundingClientRect(), touch = matchMedia('(pointer: coarse)').matches;
  const n0 = p.points.length, u0 = p.past.length, c0 = map.getCenter();
  const fire = (type, x, y) => {
    if (!touch) { cv.dispatchEvent(new MouseEvent(type.replace('touch', 'mouse').replace('start', 'down').replace('end', 'up'), { bubbles: true, cancelable: true, clientX: R.left + x, clientY: R.top + y, button: 0, buttons: type === 'touchend' ? 0 : 1 })); return; }
    const t = [new Touch({ identifier: 1, target: cv, clientX: R.left + x, clientY: R.top + y })];
    cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : t, targetTouches: type === 'touchend' ? [] : t, changedTouches: t }));
  };
  fire('touchstart', q.x, q.y);
  if (touch) await wait(400);
  for (let k = 1; k <= 8; k++) { await wait(30); fire('touchmove', q.x + k * 5, q.y - k * 5); }
  fire('touchend', q.x + 40, q.y - 40);
  if (!touch) window.dispatchEvent(new MouseEvent('mouseup'));
  await wait(400);
  const np = map.project(p.points[1]), errs = [];
  if (p.points.length !== n0 + 1) errs.push(`${p.points.length - n0} points added, not 1`);
  else if (Math.hypot(np.x - q.x - 40, np.y - q.y + 40) > 3) errs.push(`new point ${Math.round(np.x - q.x)},${Math.round(np.y - q.y)} px from the press, not 40,-40`);
  if (p.past.length !== u0 + 1) errs.push(`${p.past.length - u0} undo steps`);
  if (map.getCenter().lng !== c0.lng || map.getCenter().lat !== c0.lat) errs.push('the map panned');
  if (!map.dragPan.isEnabled()) errs.push('map panning left off');
  if (p.edit) errs.push('still editing');
  p.undo();
  return errs;
})()"""


# The waypoint list: a row per point, ↓ reorders and undo puts it back, a row
# click shows the point without leaving padding on the map (MapLibre keeps an
# easeTo's padding, which made every later fit fail).
WAYPOINTS = """(async () => {
  const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  p.reveal('points');
  await wait(300);
  const key = () => p.points.map((q) => q.join()).join('|'), k0 = key();
  const rows = () => document.querySelectorAll('.wpl-row');
  if (rows().length !== p.points.length) errs.push(`${rows().length} rows for ${p.points.length} points`);
  rows()[0].querySelector('[aria-label$="later"]').click();
  await wait(300);
  if (key() === k0) errs.push('the down button did not reorder');
  p.undo();
  await wait(200);
  if (key() !== k0) errs.push('undo did not restore the order');
  [...document.querySelectorAll('.wpl-foot button')].find((b) => /Reverse/.test(b.textContent)).click();
  await wait(300);
  if (p.points[0].join() !== k0.split('|').at(-1)) errs.push('Reverse direction did not reverse');
  p.undo();
  await wait(200);
  if (key() !== k0) errs.push('undo did not undo the reverse');
  rows()[1].click();
  await wait(900);
  const pad = polku.map.getPadding();
  if (pad.top || pad.bottom || pad.left || pad.right) errs.push(`the map kept padding ${JSON.stringify(pad)}`);
  return errs;
})()"""


# Route style: another preset reaches the share link, and undo puts it back
# (straight-line legs, so no routing). The per-sport choice is cleared after.
STYLE = """(async () => {
  const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  p.reveal('style');
  await wait(300);
  const code = () => new URL(p.shareUrl()).searchParams.get('p') || '';
  const before = code();
  const chips = [...document.querySelectorAll('.style-presets .chip')];
  if (chips.length < 3) errs.push(`${chips.length} style presets`);
  const other = chips.find((c) => c.getAttribute('aria-pressed') !== 'true' && c.tagName === 'BUTTON');
  other.click();
  await wait(900);
  if (code() === before) errs.push('the style did not reach the share link');
  p.undo();
  await wait(300);
  if (code() !== before) errs.push('undo did not restore the style');
  localStorage.removeItem('polku:styles');
  return errs;
})()"""


# Round trip: the panel opens with its choices (no routing here) and closes cleanly.
LOOP = """(async () => {
  const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  p.openLoop();
  await wait(300);
  const box = document.querySelector('.loop-box');
  if (!box || !box.querySelector('.loop-go .btn.primary')) errs.push('no round-trip panel');
  if (box && box.querySelectorAll('.loop-starts .chip').length < 4) errs.push('no length choices');
  p.closeLoop();
  await wait(200);
  if (!document.querySelector('[data-sec=loop]').hidden) errs.push('round-trip panel stayed open');
  return errs;
})()"""


# Layers: every sport has the same layers and controls (the trail colours
# included), "On now" comes first, and every raster overlay that's on has its
# opacity slider. Ends in paddle with Depth areas at 30 % for the reload check.
LAYERS = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const { ACTIVITIES, RASTER_OVERLAYS } = await import(location.origin + '/js/config.js');
  if (document.querySelector('#layers-panel').hidden) document.querySelector('#btn-layers').click();
  await wait(300);
  const body = document.querySelector('#layers-body');
  const labels = () => [...body.querySelectorAll('.tg .tg-text')].map((t) => t.firstChild.textContent.trim()).filter((l) => !/opacity/i.test(l)).sort();
  let first = null;
  for (const k of [...Object.keys(ACTIVITIES).filter((a) => a !== 'paddle'), 'paddle']) {
    polku.set({ activity: k });
    await wait(400);
    const segs = [...body.querySelectorAll('.seg button')].map((b) => b.textContent);
    if (!['Off', 'Difficulty', 'Uphill', 'Both'].every((x) => segs.includes(x))) errs.push(`${k}: no trail colours control`);
    const h3 = body.querySelector('.lp-sec h3');
    if (!h3 || h3.textContent !== 'On now') errs.push(`${k}: the first section is ${h3 ? h3.textContent : 'missing'}, not On now`);
    const now = labels();
    if (!first) first = [k, now];
    else {
      const miss = first[1].filter((l) => !now.includes(l)), extra = now.filter((l) => !first[1].includes(l));
      if (miss.length || extra.length) errs.push(`${k} vs ${first[0]}: missing ${miss.join(', ') || '-'}; extra ${extra.join(', ') || '-'}`);
    }
    for (const id of Object.keys(RASTER_OVERLAYS)) {
      if (polku.state.overlays[id] && !body.querySelector(`input[aria-label="${RASTER_OVERLAYS[id].label} opacity"]`)) errs.push(`${k}: no opacity slider for ${id}`);
    }
  }
  if (!polku.map.getLayer('ov-soundings')) errs.push('paddle: soundings are not on');
  // the weather fields have one too (no fetch: the switch only, not the data)
  const wx = { ...polku.state.weather };
  polku.set({ weather: { ...wx, rain: true } });
  await wait(300);
  if (!body.querySelector('input[aria-label="Rain opacity"]')) errs.push('no opacity slider for the rain');
  polku.set({ weather: wx });
  await wait(300);
  const r = body.querySelector('input[aria-label="' + RASTER_OVERLAYS.depthAreas.label + ' opacity"]');
  if (r) {
    r.value = '30';
    r.dispatchEvent(new Event('input', { bubbles: true }));
    r.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(200);
    if (polku.map.getPaintProperty('ov-depthAreas', 'raster-opacity') !== 0.3) errs.push('the opacity slider did not change the map');
  }
  return errs;
})()"""

# after a reload: the depth areas keep 30 %
LAYERS_AFTER = """(async () => {
  const errs = [], { RASTER_OVERLAYS } = await import(location.origin + '/js/config.js');
  const op = polku.map.getLayer('ov-depthAreas') && polku.map.getPaintProperty('ov-depthAreas', 'raster-opacity');
  if (op !== 0.3) errs.push(`depth areas at ${op} after a reload, not 0.3`);
  if (document.querySelector('#layers-panel').hidden) document.querySelector('#btn-layers').click();
  await new Promise((r) => setTimeout(r, 300));
  const r = document.querySelector('#layers-body input[aria-label="' + RASTER_OVERLAYS.depthAreas.label + ' opacity"]');
  if (!r || r.value !== '30') errs.push(`slider shows ${r ? r.value : 'nothing'} after a reload`);
  return errs;
})()"""


def layers(chrome):
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#12/60.15/24.95')
    fails = pg.js(LAYERS)
    pg.reload()
    fails += pg.js(LAYERS_AFTER)
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} layers (every sport)" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


def overlaps(boxes):
    bad = []
    for i, a in enumerate(boxes):
        for b in boxes[i + 1:]:
            w = min(a['r'], b['r']) - max(a['l'], b['l'])
            h = min(a['b'], b['b']) - max(a['t'], b['t'])
            if w > 1 and h > 1:
                bad.append(f"{a['s']} × {b['s']} ({w:.0f}×{h:.0f} px)")
    return bad


def check(chrome, w, h, phone, bottom=False):
    name = f'{w}x{h}' + (' bottom' if bottom else '')
    fails = []
    pg = chrome.page(w, h, phone)
    pg.open_app({'activity': 'mtb', 'timeline': True}, {'polku:plannerDock': '"bottom"' if bottom else '"left"'})
    time.sleep(1.0)
    fails += [f'closed: {o}' for o in overlaps(pg.js(BOXES))]

    pg.js("(() => { const p = polku.planner; p.setActive(true); p.clear(); p.setMode('line');"
          " for (const q of [[23.80, 61.509], [23.817, 61.519], [23.838, 61.516]]) p.addPoint(q); })()")
    pg.js("new Promise((ok) => { const p = polku.planner, t0 = Date.now(); const go = () => (p.analysis && p.analysis.pts.length > 10) || Date.now() - t0 > 30000 ? ok() : setTimeout(go, 200); go(); })")
    time.sleep(0.8)
    layout = pg.js("polku.planner.layout ? polku.planner.layout() : 'old'")
    # one clock: while planning, the timeline is inside the planner, not over the map
    if not pg.js("!!document.querySelector('#planner #wx-bar')"):
        fails.append('timeline not docked in the planner while planning')
    states = ['open', 'min'] if layout == 'side' else ['peek', 'profile', 'half', 'full']
    for st in states:
        pg.js(f"polku.planner.setSheetState({json.dumps(st)}, {{ remember: false }}); true")
        time.sleep(1.0)  # the sheet's and the controls' transitions (slow in software rendering)
        ov = overlaps(pg.js(BOXES))
        fails += [f'planning/{st}: {o}' for o in ov]
        r = pg.js("(() => { const r = document.querySelector('#planner').getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, h: r.height }; })()")
        if layout == 'side':
            free = (w - r['r']) / w
            if free < 0.55:
                fails.append(f'side/{st}: only {free:.0%} of the width left for the map')
        elif st == 'peek' and r['h'] > 0.27 * h:  # the summary, Round trip & Style, and the routing modes
            fails.append(f'peek is {r["h"]:.0f} px tall ({r["h"] / h:.0%} of the screen)')
        elif st == 'half' and not (0.4 * h < r['h'] < 0.6 * h):
            fails.append(f'half is {r["h"]:.0f} px tall')
        elif st == 'profile':
            cv = pg.js("(() => { const c = document.querySelector('#profile-canvas').getBoundingClientRect(), s = document.querySelector('#planner').getBoundingClientRect(); return { top: c.top, bottom: c.bottom, sb: s.bottom, h: c.height }; })()")
            if not (0.2 * h < r['h'] < 0.46 * h):
                fails.append(f'profile size is {r["h"]:.0f} px tall ({r["h"] / h:.0%} of the screen)')
            elif cv['h'] < 60 or cv['bottom'] > cv['sb']:
                fails.append('the profile size does not show the whole chart')
    pg.js(f"polku.planner.setSheetState({json.dumps(states[0])}, {{ remember: false }}); true")
    time.sleep(1.0)
    fails += [f'edit: {e}' for e in pg.js(EDIT)]
    fails += [f'waypoints: {e}' for e in pg.js(WAYPOINTS)]
    fails += [f'style: {e}' for e in pg.js(STYLE)]
    fails += [f'round trip: {e}' for e in pg.js(LOOP)]
    pg.js("polku.planner.setActive(false); true")
    time.sleep(0.3)
    if pg.js("!!document.querySelector('#planner #wx-bar') || document.querySelector('#wx-bar').hidden"):
        fails.append('timeline did not come back to the map after planning')
    pg.js("polku.planner.setActive(true); true")
    # sections remember their state across reloads
    pg.js("polku.planner.setSheetState(polku.planner.layout() === 'side' ? 'open' : 'half'); polku.planner.toggleSection('climbs', false); true")
    pg.reload()
    if pg.js("document.querySelector('[data-sec=climbs]').dataset.open") != 'false':
        fails.append('collapsed section not remembered')
    pg.js("localStorage.removeItem('polku:sections'); true")
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} {name} ({layout})" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


def main():
    only = sys.argv[1:]
    chrome = Chrome()
    ok = True
    try:
        if not only or 'layers' in only:
            ok = layers(chrome) and ok
        for w, h, phone, bottom in VIEWPORTS:
            if only and f'{w}x{h}' not in only:
                continue
            ok = check(chrome, w, h, phone, bottom) and ok
    finally:
        chrome.close()
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
