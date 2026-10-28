#!/usr/bin/env python3
"""Smoke test for Polku's layout: no overlapping controls, no console errors, planner states work.

  python3 tools/smoke.py              # every group, then the layout at every size
  python3 tools/smoke.py water loops  # just these groups
  python3 tools/smoke.py 390x844      # just the layout at one size
  python3 tools/smoke.py --list       # every group and size, with what it checks (from GROUPS)

A name it doesn't know stops it before Chrome starts, with exit code 2. A group that
raises fails and the rest still run. Needs the dev server (python3 serve.py) and Google
Chrome. Draws a straight-line route (no routing requests). The forecast comes from
Open-Meteo, cached for an hour. Exits 1 if anything fails.
"""
import json
import math
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import BASE, Chrome  # noqa: E402

# (width, height, phone, planner docked at the bottom on desktop)
VIEWPORTS = [(1440, 900, False, False), (1440, 900, False, True), (1024, 768, False, False), (390, 844, True, False), (360, 740, True, False)]

# Visible boxes that must never overlap each other (toasts and popups are transient and skipped).
BOXES = """(() => {
  const sel = ['.topbar .brand', '.topbar .search', '#activity-bar .act-current', '#zoom-hint', '#btn-settings', '.map-ctrls', '#planner', '#wx-bar:not(.docked)', '#view3d', '#pl-tools:not(.docked)',
    '.maplibregl-ctrl-attrib', '.maplibregl-ctrl-scale', '.offline-banner', '.panel'];
  const out = [];
  // (on a phone the timeline is on top of a half or full sheet's upper part on purpose, #225)
  const overSheet = document.body.classList.contains('wx-over');
  for (const s of sel) for (const e of document.querySelectorAll(s)) {
    if (e.closest('[hidden]') || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden') continue;
    if (overSheet && e.id === 'wx-bar') continue;
    let r = e.getBoundingClientRect();
    if (s === '.maplibregl-ctrl-attrib' && !e.classList.contains('maplibregl-compact-show')) { const b = e.querySelector('.maplibregl-ctrl-attrib-button'); if (b) r = b.getBoundingClientRect(); }
    if (r.width < 2 || r.height < 2) continue;
    out.push({ s: s + (e.id ? '' : `[${[...document.querySelectorAll(s)].indexOf(e)}]`), l: r.left, t: r.top, r: r.right, b: r.bottom });
  }
  return out;
})()"""

# After the planner changes size: wait until it has settled, on two animation frames in a row:
# no CSS transition still running (the sheet's height, the controls riding above it) and the
# map's room for the sheet (--sheet-h) matching it. Software rendering can take seconds to draw
# a frame, so a fixed wait sometimes looked mid-way (#74). '' when settled, else what was still moving.
SETTLED = """new Promise((done) => {
  const pl = document.querySelector('#planner'), t0 = performance.now();
  let frames = 0, calm = 0;
  const moving = () => {
    const out = document.getAnimations().filter((a) => a instanceof CSSTransition && a.playState === 'running')
      .map((a) => `${a.effect.target.id || a.effect.target.getAttribute('class')} ${a.transitionProperty}`);
    const open = polku.planner.active && !pl.hidden && polku.planner.layout() === 'sheet';
    const room = parseFloat(document.documentElement.style.getPropertyValue('--sheet-h')) || 0;
    if (room !== (open ? pl.offsetHeight : 0)) out.push(`--sheet-h ${room} px for a ${pl.offsetHeight} px sheet`);
    return out;
  };
  const late = () => `not settled after 10 s (${frames} frames): ${moving().join(', ') || 'still, but no next frame to confirm it'}`;
  const timer = setTimeout(() => done(late()), 10000);
  const frame = () => {
    frames++;
    calm = moving().length ? 0 : calm + 1;
    if (calm >= 2) { clearTimeout(timer); done(''); }
    else if (performance.now() - t0 < 10000) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})"""


def placed(pg):
    """The sheet at its size, then the toolbox shown and placed for it: in a frame after a change, late on a busy
    machine. A check that read the toolbox or measured near it after a fixed wait looked too early (#367, #390)."""
    pg.js(SETTLED)
    pg.js("new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(true))))")


# Before the page loads, for checks that need none of Traficom's depths: its map tiles answer at once, empty, and
# its other calls fail as if blocked. (Slow to answer at times, they kept the map from loading; blocked, a tile that
# failed last kept MapLibre's load event and Polku's load step from coming at all: #393, #378, #361.)
EMPTY_DEPTHS = """(() => {
  const real = window.fetch.bind(window);
  let empty = null;
  window.fetch = (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (!/^https:\\/\\/[^/]*traficom\\.fi\\//.test(url)) return real(input, init);
    if (!/request=GetMap/i.test(url)) return Promise.reject(new TypeError('Failed to fetch'));
    empty ||= (() => { const c = new OffscreenCanvas(256, 256); c.getContext('2d'); return c.convertToBlob({ type: 'image/png' }); })();
    return empty.then((png) => new Response(png, { headers: { 'Content-Type': 'image/png' } }));
  };
})();"""


# Drag the middle of the first leg (straight-line legs: no routing requests):
# with the mouse on desktop, hold-then-drag on touch. Expect one new point under
# the pointer, one undo step, an unmoved map and map panning back on.
EDIT = """(async () => {
  const p = polku.planner, map = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let k = 0; k < 100 && !p.analysis; k++) await wait(100); // (the route beneath is worked out again after the handle drag's Undo)
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
  // held a moment, then moved past 10 px at once (a hold that stays still to 0.5 s is Edit this stretch's: 25d part 5), on
  // to 40 px
  fire('touchstart', q.x, q.y);
  if (touch) { await wait(330); fire('touchmove', q.x + 12, q.y - 12); }
  for (let k = touch ? 3 : 1; k <= 8; k++) { await wait(30); fire('touchmove', q.x + k * 5, q.y - k * 5); }
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


# Press the DOM midpoint handle, rather than the canvas beneath it. Both receive
# the bubbling press; only the marker should own the gesture (#215).
MIDPOINT_EDIT = """(async () => {
  const p = polku.planner, map = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  p.setActive(true); p.clear(); p.setMode('line');
  p.addPoint([23.800, 61.509]); p.addPoint([23.838, 61.516]);
  await p.analysing;
  p.fitRoute();
  await wait(900);
  // (the handles are drawn again when the rain answer comes in: read the one on the page each time)
  const hit = () => p.ghosts[0] && map.queryRenderedFeatures(map.project(p.ghosts[0].getLngLat()), { layers: ['route-casing'] })
    .some((f) => f.properties.kind === 'leg');
  // Wait for the route beneath the handle to be drawn: otherwise only the
  // marker gets the press and the conflicting line gesture is never tested.
  for (let k = 0; k < 100 && !hit(); k++) await wait(100);
  if (!hit()) return ['route beneath the midpoint handle was not rendered'];
  const el = p.ghosts[0].getElement();
  const R = el.getBoundingClientRect();
  const x = R.left + R.width / 2, y = R.top + R.height / 2;
  if (el.hidden || !R.width) return ['no visible midpoint handle'];
  const cv = map.getCanvas(), touch = matchMedia('(pointer: coarse)').matches;
  const n0 = p.points.length, u0 = p.past.length, c0 = map.getCenter(), before = JSON.stringify(p.points);
  const fire = (type, target, dx = 0, dy = 0) => {
    if (!touch) {
      target.dispatchEvent(new MouseEvent(type.replace('touch', 'mouse').replace('start', 'down').replace('end', 'up'), {
        bubbles: true, cancelable: true, clientX: x + dx, clientY: y + dy, button: 0, buttons: type === 'touchend' ? 0 : 1
      }));
    } else {
      const t = [new Touch({ identifier: 1, target: el, clientX: x + dx, clientY: y + dy })];
      target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true,
        touches: type === 'touchend' ? [] : t, targetTouches: type === 'touchend' ? [] : t, changedTouches: t }));
    }
  };
  fire('touchstart', el.querySelector('.wp-ghost'));
  // The same bubbling press must not arm a second, delayed line edit on touch.
  if (touch) await wait(400);
  for (let k = 1; k <= 8; k++) { fire('touchmove', cv, k * 5, -k * 5); await wait(30); }
  fire('touchend', cv, 40, -40);
  if (!touch) window.dispatchEvent(new MouseEvent('mouseup'));
  await wait(400);
  if (p.points.length !== n0 + 1) errs.push(`${p.points.length - n0} via points added by one handle drag`);
  else {
    const q = map.project(p.points[1]), C = cv.getBoundingClientRect();
    if (Math.hypot(C.left + q.x - x - 40, C.top + q.y - y + 40) > 3) errs.push('via point did not follow the handle');
  }
  if (p.past.length !== u0 + 1) errs.push(`${p.past.length - u0} undo steps for one handle drag`);
  if (p.edit) errs.push('handle drag did not end');
  if (!map.dragPan.isEnabled()) errs.push('map panning left off');
  if (map.getCenter().lng !== c0.lng || map.getCenter().lat !== c0.lat) errs.push('map panned during handle drag');
  p.undo();
  if (JSON.stringify(p.points) !== before) errs.push('Undo did not restore the route before the handle drag');
  p.redo();
  if (p.points.length !== n0 + 1) errs.push('Redo did not restore exactly one via point');
  p.undo();
  await wait(500);
  return errs;
})()"""


# (#467, #513) the route framed, then its numbers come in and the peek grows: the refit that queues waits for a frame, and
# a press on the map, or a card opened, in that frame must stop it (the pan under a handle drag, a card sliding off)
REFIT_LATE = """(async () => {
  const p = polku.planner, map = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  let fits = 0; const fb = map.fitBounds.bind(map); map.fitBounds = (...a) => { fits++; return fb(...a); };
  p.setActive(true); p.clear(); p.setMode('line');
  p.addPoint([23.800, 61.509]); p.addPoint([23.838, 61.516]);
  await p.analysing;
  p.setTab('route'); p.setSheetState('peek');
  await wait(600);
  // the peek is another height now (sizes() queues the refit), and in the same task: act() (a press, a card)
  const trial = async (name, act, framed, check) => {
    p.cards.close();
    p.fitRoute({ animate: false });
    await new Promise((ok) => map.once('idle', ok));
    map.jumpTo({ center: [map.getCenter().lng + 0.002, map.getCenter().lat] }); // (a map the refit would move back)
    const c = map.getCenter(), z = map.getZoom();
    p.fitAt.peek = '1px';
    fits = 0;
    p.measureSheet();
    act();
    for (let k = 0; k < 2; k++) await new Promise((ok) => requestAnimationFrame(ok));
    await wait(1000); // (a card pans the map into place, 250 ms, again at 320 and 900)
    const d = map.getCenter();
    if (framed !== (fits > 0)) errs.push(`${name}: the route was ${fits ? '' : 'not '}framed again`);
    if (check) errs.push(...check(d.lng !== c.lng || d.lat !== c.lat || map.getZoom() !== z));
  };
  await trial('a press on the map just after the peek changed', () => map.getContainer().dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true })), false,
    (moved) => moved ? ['the map moved under the press'] : []);
  await trial('a card opened just after the peek changed', () => p.openRouteCard(0, [23.819, 61.5125]), false, () => {
    const r = p.cards.box && p.cards.box.getBoundingClientRect(); // (the card moves the map itself, to be whole)
    return !r || r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth ? [`the card isn't whole on the screen: ${r && JSON.stringify([r.left, r.top, r.right, r.bottom].map(Math.round))}`] : [];
  });
  // …and the refit the card stopped is gone: the card closed, the peek changing again frames nothing
  p.cards.close();
  if (p.fitAt) p.fitAt.peek = '1px';
  fits = 0;
  p.measureSheet();
  for (let k = 0; k < 2; k++) await new Promise((ok) => requestAnimationFrame(ok));
  await wait(300);
  if (fits) errs.push('the card closed, then the peek changed: the route was framed again, as the card stopped');
  await trial('nothing pressed, no card (#242)', () => {}, true);
  p.cards.close();
  delete map.fitBounds;
  return errs;
})()"""


def editing(chrome):
    ok = True
    for sport in ('mtb', 'gravel', 'hike', 'paddle'):
        for w, h, phone in [(1440, 900, False), (390, 844, True)]:
            pg = chrome.page(w, h, phone)
            try:
                pg.open_app({'activity': sport, 'timeline': True}, {'polku:plannerDock': '"left"'})
                pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
                fails = pg.js(MIDPOINT_EDIT)
                if phone and sport == 'mtb': fails += [f'refit: {e}' for e in pg.js(REFIT_LATE)]
                fails += [f'line: {e}' for e in pg.js(EDIT)]
                fails += [f'console: {e[:160]}' for e in pg.errors()]
            finally:
                pg.close()
            print(f"{'ok  ' if not fails else 'FAIL'} midpoint and line drag ({sport}, {w}x{h})" + ''.join(f'\n     - {f}' for f in fails), flush=True)
            ok = not fails and ok
    return ok


# The waypoint list: a row per point, ↓ reorders and undo puts it back, a row
# click shows the point without leaving padding on the map (MapLibre keeps an
# easeTo's padding, which made every later fit fail).
WAYPOINTS = """(async () => {
  const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  p.reveal('points');
  await wait(300);
  const key = () => p.points.map((q) => q.join()).join('|'), k0 = key();
  // (Reorder lists every point, 25d's part 4)
  const top = (t) => [...document.querySelectorAll('.wpl-top .btn')].find((b) => b.textContent.trim() === t);
  top('Reorder').click();
  await wait(200);
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
  top('Done').click();
  await wait(200);
  document.querySelector('.wpl-point[data-i="0"]').click(); // (the start: its vias only shape the line, so they fold)
  await wait(900);
  p.cards.close();
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


# Round trip: its form opens in the peek with its choices (no routing here) and closes cleanly (25b).
LOOP = """(async () => {
  const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  p.openLoop();
  await wait(300);
  const box = document.querySelector('.pl-way[data-view=loop]');
  if (!box || !box.querySelector('.rt-make')) errs.push('no round-trip form');
  if (box && box.querySelectorAll('.rt-chips .chip').length < 4) errs.push('no length choices');
  p.closeLoop();
  await wait(200);
  if (document.querySelector('.pl-way[data-view=loop]') || !document.querySelector('.pl-way').hidden) errs.push('the round trip stayed open');
  return errs;
})()"""


# Layers: every sport has the same layers and controls (the trail colours
# included), "On now" comes first, and every raster overlay that's on has its
# opacity slider. Ends in paddle with Depth areas at 30 % for the reload check.
# A switch and a segment pressed in Layers move from what was on screen, though the panel is built again (#540's
# package 5): the track's colour and the knob, the pressed segment's colour; no knob slide with reduced motion; the
# focus stays on the switch
LAYERS_MOTION = """(async (reduced) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [], tag = reduced ? 'reduced motion: ' : '';
  if (document.querySelector('#layers-panel').hidden) { document.querySelector('#btn-layers').click(); document.querySelector('#quick-layers .qt-more').click(); }
  await wait(300);
  const body = document.querySelector('#layers-body');
  const sw = (l) => [...body.querySelectorAll('label.tg')].find((t) => t.querySelector('.tg-text').firstChild.textContent.trim() === l).querySelector('input');
  const seg = (l) => [...body.querySelectorAll('.seg button')].find((b) => b.textContent === l && b.parentNode.firstElementChild.textContent === 'Off');
  const moving = (el, pseudo = '') => el.getAnimations({ subtree: true }).filter((a) => (a.effect.pseudoElement || '') === pseudo).map((a) => a.transitionProperty).sort().join(' ') || 'nothing';
  const was = sw('Trail details').checked;
  sw('Trail details').focus();
  getComputedStyle(sw('Trail details').nextElementSibling).backgroundColor;
  sw('Trail details').click();
  const ui = sw('Trail details').nextElementSibling, track = moving(ui), knob = moving(ui, '::after');
  if (!track.includes('background-color')) errs.push(`${tag}Trail details' track moves ${track}, not its colour`);
  if (knob !== (reduced ? 'nothing' : 'transform')) errs.push(`${tag}Trail details' knob moves ${knob}, not ${reduced ? 'nothing' : 'transform'}`);
  if (document.activeElement !== sw('Trail details')) errs.push(`${tag}the focus went to ${document.activeElement.tagName}.${document.activeElement.className}, not the switch it pressed`);
  if (sw('Trail details').checked === was) errs.push(`${tag}Trail details didn't change`);
  sw('Trail details').click();
  await wait(300);
  getComputedStyle(seg('Uphill')).backgroundColor;
  seg('Uphill').click();
  const pressed = moving(seg('Uphill'));
  if (seg('Uphill').getAttribute('aria-pressed') !== 'true') errs.push(`${tag}Uphill isn't pressed`);
  if (!pressed.includes('background-color')) errs.push(`${tag}the Uphill segment moves ${pressed}, not its colour`);
  seg('Off').click();
  await wait(300);
  return errs;
})"""
LAYERS = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const { ACTIVITIES, RASTER_OVERLAYS } = await import(location.origin + '/js/config.js');
  if (document.querySelector('#layers-panel').hidden) { document.querySelector('#btn-layers').click(); document.querySelector('#quick-layers .qt-more').click(); }
  await wait(300);
  const body = document.querySelector('#layers-body');
  const labels = () => [...body.querySelectorAll('.tg .tg-text')].map((t) => t.firstChild.textContent.trim()).filter((l) => !/opacity/i.test(l)).sort();
  let first = null;
  for (const k of [...Object.keys(ACTIVITIES).filter((a) => a !== 'paddle'), 'paddle']) {
    polku.set({ activity: k });
    await wait(400);
    const segs = [...body.querySelectorAll('.seg button')].map((b) => b.textContent);
    if (!['Off', 'Difficulty', 'Uphill', 'Both'].every((x) => segs.includes(x))) errs.push(`${k}: no trail colours control`);
    const top = body.querySelector('.lg-group summary .lg-title');
    if (!top || top.textContent !== 'On now') errs.push(`${k}: the first section is ${top ? top.textContent : 'missing'}, not On now`);
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
  if (document.querySelector('#layers-panel').hidden) { document.querySelector('#btn-layers').click(); document.querySelector('#quick-layers .qt-more').click(); }
  await new Promise((r) => setTimeout(r, 300));
  const r = document.querySelector('#layers-body input[aria-label="' + RASTER_OVERLAYS.depthAreas.label + ' opacity"]');
  if (!r || r.value !== '30') errs.push(`slider shows ${r ? r.value : 'nothing'} after a reload`);
  return errs;
})()"""


# Trail details from a recorded tile (Tykkikallio, Jyväskylä; Overpass held back,
# so its neighbours just stay unloaded): trails drawn from OSM with the tiles' own hidden
# there, icons and fences up close, an obstacle opens its card, and road
# cycling starts with it off.
SEED_TRAILS = """(async () => {
  const T = await import(location.origin + '/js/trails.js');
  const fx = await (await fetch(location.origin + '/tools/fixtures/trails-tykkikallio.json')).json();
  T.holdFetches();
  T.seedTile(4682, 2273, fx);
  return true;
})()"""
TRAILS = """(async () => {
  const m = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const idle = () => new Promise((r) => { if (m.loaded()) r(); else m.once('idle', r); });
  await wait(1500); await idle();
  if (!polku.state.trailDetails) errs.push('trail details are off in MTB');
  const osm = m.queryRenderedFeatures({ layers: ['path-osm-ground', 'path-osm-bridge'] });
  if (osm.length < 40) errs.push(`only ${osm.length} trails drawn from OSM`);
  if (!JSON.stringify(m.getFilter('path-ground')).includes('within')) errs.push("the tiles' trails aren't hidden inside the detail tiles");
  const kinds = new Set(osm.map((f) => f.properties.w));
  if (!kinds.has(0) || !kinds.has(2)) errs.push('no narrow or no wide trail in view');
  if (!osm.some((f) => f.properties.vis >= 2)) errs.push('no faint trail in view');
  m.jumpTo({ center: [25.7652, 62.2290], zoom: 17.2 });
  await wait(800); await idle();
  const pts = m.queryRenderedFeatures({ layers: ['td-points'] });
  if (!pts.some((f) => f.properties.kind === 'tree') || !pts.some((f) => f.properties.kind === 'gate-no')) errs.push(`icons: ${pts.map((f) => f.properties.kind).join(', ') || 'none'}`);
  if (!m.queryRenderedFeatures({ layers: ['td-fence'] }).length) errs.push('no fences drawn');
  const tree = pts.find((f) => f.properties.kind === 'tree');
  if (tree) {
    const point = m.project(tree.geometry.coordinates);
    m.fire('click', { point, lngLat: m.unproject(point), originalEvent: new MouseEvent('click') });
    await wait(400);
    const t = polku.planner.cards.current && polku.planner.cards.current.kind === 'place' ? document.querySelector('.pl-way.card .way-hint b') : null; // (its place's card, 25d part 5)
    if (!t || !/log|fallen/i.test(t.textContent)) errs.push(`clicking the fallen tree opened ${t ? t.textContent : 'nothing'}`);
    polku.planner.cards.close();
  }
  // uphill colours come back after switching them off and on (they're cached, and once stayed blank)
  m.jumpTo({ center: [25.7652, 62.2289], zoom: 15.5 });
  if (document.querySelector('#layers-panel').hidden) { document.querySelector('#btn-layers').click(); document.querySelector('#quick-layers .qt-more').click(); }
  await wait(400);
  const seg = (t) => [...document.querySelectorAll('#layers-body .seg button')].find((b) => b.textContent === t);
  const uphill = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (m.querySourceFeatures('uphill').length) return true; await wait(250); } return false; };
  seg('Uphill').click();
  if (!(await uphill(20000))) errs.push('uphill colours never appeared');
  else {
    for (const step of ['Off', 'Uphill', 'Difficulty', 'Both']) {
      seg(step).click();
      await wait(300);
      if (step !== 'Off' && step !== 'Difficulty' && !(await uphill(3000))) errs.push(`uphill colours blank after switching to ${step}`);
    }
  }
  seg('Difficulty').click();
  polku.set({ activity: 'road' });
  await wait(600);
  if (polku.state.trailDetails || m.getLayer('path-osm-ground')) errs.push('road cycling starts with trail details on');
  polku.set({ activity: 'mtb' });
  return errs;
})()"""


# Trail details along a route (12b): a recorded BRouter route over Tykkikallio
# (its tags, the log as a node tag) and the recorded tile. No routing requests.
ROUTE_TRAILS = """(async () => {
  const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const fx = await (await fetch(location.origin + '/tools/fixtures/route-tykkikallio-mtb.json')).json();
  // dry ground whatever the weather: "wet: auto" after real rain would route the recorded legs again
  p.checkWet = async () => {};
  p.wet = { on: false, mm: 0, at: Date.now() };
  p.setActive(true);
  p.restoreSnapshot(fx);
  const t0 = Date.now();
  while (!(p.analysis && p.analysis.trailMore) && Date.now() - t0 < 30000) await wait(250);
  const a = p.analysis;
  if (!a || !a.trailMore) return ['the trail details along the route never came in'];
  const texts = (a.trailWarn || []).map((w) => w.text);
  if (texts.filter((t) => /^Log across/.test(t)).length !== 1) errs.push(`log heads-up: ${texts.join(' / ') || 'none'}`);
  if (!texts.some((t) => /^Hard to follow/.test(t))) errs.push('no faint stretch in the heads-up');
  if (![...a.td.width].some((w) => w >= 0)) errs.push('no width along the route (from the tile)');
  p.reveal('warnings');
  await wait(300);
  // (25d part 2: in Worth a look, each row with its group's icon; the obstacle's own icon shows on the map, #85)
  const logRow = [...document.querySelectorAll('[data-sec=warnings] .tier-look .row')].find((r) => /^Log across/.test(r.textContent));
  if (!logRow || !logRow.querySelector('svg')) errs.push('the log isn\\'t a row of Worth a look, with its icon');
  const widthBar = p.els.breakdown.querySelector('[data-colour=width]');
  if (!widthBar || widthBar.hidden || !/Under 0\\.6 m/.test(widthBar.textContent)) errs.push('late width data did not update Check with Gradient selected');
  p.showMode('width');
  await wait(300);
  const legend = [...document.querySelectorAll('.bd-legend .bd-item')].map((x) => x.textContent).join(' / ');
  if (!/Under 0\\.6 m/.test(legend) || !/Road or track/.test(legend)) errs.push(`width breakdown: ${legend}`);
  p.showMode('grade');
  const n = await import(location.origin + '/js/net.js');
  const routed = n.usage().filter((u) => /^brouter|^valhalla/.test(u.id)).reduce((s, u) => s + (u.session || 0), 0);
  if (routed) errs.push(`${routed} routing requests (the fixture should need none)`);
  localStorage.removeItem('polku:colorMode');
  return errs;
})()"""


def trails(chrome):
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#12/62.2289/25.7652')
    pg.js(SEED_TRAILS)
    pg.js("polku.map.jumpTo({ center: [25.7652, 62.2289], zoom: 16 }); true")
    fails = pg.js(TRAILS)
    fails += [f'route: {e}' for e in pg.js(ROUTE_TRAILS)]
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    fails += trail_card(chrome)
    print(f"{'ok  ' if not fails else 'FAIL'} trail details, a trail's card on phones (#435)" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# A trail's card on a phone, the planner put away (#435), opened by a real tap on a trail of the recorded tile. At 200 %
# (a 390 phone's 195 × 422) it stays on the screen less 8 px each side and under the top bar, with nothing over it (the
# map's buttons step aside; the scale and the credits are under it), its words in it, and every button in it reachable
# by scrolling the card; ✕ closes it and the buttons are back. At 390 × 844 it sits beside the buttons, which stay.
# CARD_FIT(sel, acts) measures the card that sel finds (the element that scrolls) once it's open and still; `warnfix`
# measures a warning's card with it too.
CARD_TAP = """(() => {
  const m = polku.map, W = innerWidth, H = innerHeight, top = document.querySelector('.topbar').getBoundingClientRect().bottom;
  for (const f of m.queryRenderedFeatures({ layers: ['path-osm-ground'] }))
    for (const c of f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates.flat()) {
      const p = m.project(c);
      if (p.x > 16 && p.x < W - 90 && p.y > top + 40 && p.y < H - 60) return [p.x, p.y];
    }
  return null;
})()"""
CARD_FIT = """(async (sel, acts) => {
  const errs = [], frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const card = () => document.querySelector(sel);
  // open and still: the same box twice in a row, two frames apart, the map still (the card moves the map into view)
  let a = null, same = 0;
  for (let k = 0; k < 60 && same < 2; k++) {
    await frames();
    const b = card() && card().closest('.maplibregl-popup-content').getBoundingClientRect();
    same = a && b && Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.height - b.height) < 1 && !polku.map.isMoving() ? same + 1 : 0;
    a = b;
  }
  const c = card();
  if (!c) return { errs: ['no card opened'] };
  const pop = c.closest('.maplibregl-popup'), R = c.closest('.maplibregl-popup-content').getBoundingClientRect(), W = innerWidth, H = innerHeight; // (the card, not its tip)
  const box = (r) => `x ${Math.round(r.left)}–${Math.round(r.right)}, y ${Math.round(r.top)}–${Math.round(r.bottom)}`;
  if (R.left < 7.5 || R.right > W - 7.5 || R.top < document.querySelector('.topbar').getBoundingClientRect().bottom || R.bottom > H - 7.5)
    errs.push(`the card at ${box(R)} on a ${W} × ${H} screen`);
  if (c.scrollWidth > c.clientWidth + 1) errs.push(`its words run ${c.scrollWidth - c.clientWidth} px out of it`);
  const over = (x, y) => { const e = document.elementFromPoint(x, y); return !e || pop.contains(e) ? '' : e.closest('[id]')?.id || String(e.className.baseVal ?? e.className) || e.tagName; };
  for (const [x, y] of [[R.left + 8, R.top + 8], [R.right - 8, R.top + 8], [R.left + 8, R.bottom - 8], [R.right - 8, R.bottom - 8], [(R.left + R.right) / 2, (R.top + R.bottom) / 2]]) {
    const o = over(x, y);
    if (o) errs.push(`${o} over the card at ${Math.round(x)}, ${Math.round(y)}`);
  }
  const ctrls = document.querySelector('.map-ctrls'), shown = getComputedStyle(ctrls).visibility !== 'hidden';
  for (const e of shown ? ctrls.querySelectorAll('.ctrl-btn, .fab, .ctrl-compass') : []) {
    const r = e.getBoundingClientRect();
    if (e.getClientRects().length && r.left < R.right && r.right > R.left && r.top < R.bottom && r.bottom > R.top) errs.push(`${e.id || e.className} (${box(r)}) over the card at ${box(R)}`);
  }
  // each button and link, scrolled to as a person scrolls the card (the card only)
  for (const b of c.querySelectorAll('button, a')) {
    if (!b.getClientRects().length) continue; // (not shown)
    const r0 = b.getBoundingClientRect(), r1 = c.getBoundingClientRect();
    if (r0.bottom > r1.bottom) c.scrollTop += r0.bottom - r1.bottom + 4; else if (r0.top < r1.top) c.scrollTop -= r1.top - r0.top + 4;
    await frames();
    const r = b.getBoundingClientRect(), o = over((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    if (o || r.left < R.left || r.right > R.right) errs.push(`${b.textContent.trim().slice(0, 40)}: ${o ? `${o} over it` : `out of the card at ${box(r)}`}`);
  }
  if (acts && !c.querySelector('.insp-actions button')) errs.push('no buttons at the card’s foot');
  c.scrollTop = 0; // (a card's ✕ scrolls with it)
  await frames();
  const x = [...pop.querySelectorAll('.maplibregl-popup-close-button, .way-x')].find((e) => e.getClientRects().length).getBoundingClientRect();
  return { errs, shown, close: [(x.left + x.right) / 2, (x.top + x.bottom) / 2] };
})"""


def trail_card(chrome):
    fails = []
    for w, h_ in ((195, 422), (390, 844)):
        name = f'{w}x{h_}' + (' (200 %)' if w == 195 else '')
        pg = chrome.page(w, h_, True)
        pg.open_app({'activity': 'mtb'}, hash_='#12/62.2289/25.7652')
        pg.js(SEED_TRAILS)
        pg.js("polku.map.jumpTo({ center: [25.7652, 62.2289], zoom: 16 }); true")
        at = pg.js(f"new Promise((ok) => {{ const t0 = Date.now(), go = () => {{ const p = {CARD_TAP}; p || Date.now() - t0 > 20000 ? ok(p) : setTimeout(go, 250); }}; go(); }})")
        if not at:
            fails.append(f'{name}: no trail from the recorded tile on the screen')
        else:
            pg.quick_tap(*at)  # (a tap by the touch's own times: pg.tap() on a busy page can be a hold, and the spot's menu)
            r = pg.js(f"({CARD_FIT})('.card-float .pl-way.card', true)")  # (the way's card on the planner's card, 25d part 6)
            fails += [f'{name}: {e}' for e in r['errs']]
            if w == 390 and not r.get('shown'):
                fails.append(f"{name}: the map's buttons hidden for a card that fits beside them")
            if r.get('close'):
                pg.quick_tap(*r['close'])
                if not pg.js("new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(!document.querySelector('.pl-way.card') && getComputedStyle(document.querySelector('.map-ctrls')).visibility !== 'hidden'))))"):
                    fails.append(f"{name}: after ✕, the card still open or the map's buttons not back")
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        pg.close()
    return fails


# Before the page loads: the terrain tiles fail (window.__dem.mode = 'ok' makes
# them load: heights by the longitude, a hill every 0.02°), Overpass is held
# back and the recorded Tykkikallio tile seeded (16 ways tagged mtb:scale:uphill).
DEM_MOCK = """(() => {
  if (!/^\\/(#|$)/.test(location.pathname + location.hash)) return;
  const realFetch = window.fetch, D = window.__dem = { mode: 'fail', asked: [] };
  const tile = async (z, x) => {
    const S = 256, c = new OffscreenCanvas(S, S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S);
    for (let px = 0; px < S; px++) {
      const lon = ((x + (px + 0.5) / S) / 2 ** z) * 360 - 180, v = 120 + 20 * Math.sin((lon * Math.PI * 2) / 0.02) + 32768;
      for (let py = 0; py < S; py++) img.data.set([Math.floor(v / 256), Math.floor(v) % 256, Math.floor((v % 1) * 256), 255], (py * S + px) * 4);
    }
    ctx.putImageData(img, 0, 0);
    return new Response(await c.convertToBlob({ type: 'image/png' }));
  };
  window.fetch = (url, init) => {
    const m = /tiles\\.mapterhorn\\.com\\/(\\d+)\\/(\\d+)\\/(\\d+)/.exec(String(url));
    if (!m) return realFetch(url, init);
    D.asked.push(`${D.mode} ${m[1]}/${m[2]}/${m[3]}`);
    return D.mode === 'fail' ? Promise.reject(new TypeError('Failed to fetch')) : tile(+m[1], +m[2]);
  };
  import(location.origin + '/js/trails.js').then(async (T) => {
    T.holdFetches();
    T.seedTile(4682, 2273, await (await realFetch(location.origin + '/tools/fixtures/trails-tykkikallio.json')).json());
  });
})()"""

# The uphill colours when the terrain comes back late (#93): blank while it fails, then
# every trail in view coloured after a small pan (as many pieces as with the terrain
# there from the start), the OSM-tagged climbs too; trails coloured with the terrain
# stay cached, so panning back and forth grades nothing again.
UPHILL_LATE = """(async () => {
  const m = polku.map, U = polku.uphill, D = window.__dem, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const pieces = () => U.fc.features.length, tagged = () => U.fc.features.filter((f) => f.properties.osm).length;
  // until the colours stop changing for 2 s
  const settle = async () => { let n = -1, t = Date.now(); const t0 = t; while (Date.now() - t0 < 30000 && Date.now() - t < 2000) { await wait(250); if (pieces() !== n) { n = pieces(); t = Date.now(); } } };
  const nudge = async () => { for (const dx of [60, -60]) { m.panBy([dx, 0], { duration: 0 }); await wait(500); } await settle(); };
  await wait(1500); await settle();
  if (!U.enabled) return ['the uphill colours are not on'];
  if (!D.asked.length) return ['(the test) the terrain was never asked for'];
  if (pieces()) errs.push(`no terrain: ${pieces()} pieces coloured`);
  // the terrain is back: failed tiles are asked for again after 15 s, on the next map move
  D.mode = 'ok';
  await wait(16000);
  await nudge();
  const back = pieces(), backTagged = tagged();
  // panning back and forth: the trails graded with the terrain are kept, not graded again
  const kept = new Map(U.done), asked = D.asked.length;
  await nudge();
  const again = [...kept].filter(([k, v]) => U.done.get(k) !== v).length;
  if (again) errs.push(`${again} of ${kept.size} trails graded again after a pan`);
  if (D.asked.length !== asked) errs.push(`${D.asked.length - asked} terrain tiles asked for again after a pan`);
  // the same view graded from scratch, with the terrain there all along
  U.done.clear(); U.osmTiles.clear(); U.schedule();
  await settle();
  const all = pieces(), allTagged = tagged();
  if (all < 100 || allTagged < 5) errs.push(`(the test) only ${all} pieces, ${allTagged} from OSM tags, with the terrain loaded`);
  if (back < all * 0.95) errs.push(`terrain back: ${back} pieces coloured, against ${all} with the terrain there from the start`);
  if (backTagged < allTagged) errs.push(`terrain back: ${backTagged} pieces from OSM's uphill tags, against ${allTagged}`);
  return errs;
})()"""


def uphill_late(chrome):
    pg = chrome.page(1440, 900, False)
    chrome.send('Page.addScriptToEvaluateOnNewDocument', {'source': DEM_MOCK}, pg.s)
    pg.open_app({'activity': 'mtb', 'trailsByActivity': {'mtb': {'trailColors': 'up'}}}, {'polku:plannerDock': '"left"'}, '#15/62.2289/25.7652')
    fails = pg.js(UPHILL_LATE, timeout=120000)
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} uphill colours when the terrain comes back" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# LIPAS routes (12c): search finds a route and stops by name, grouped; picking the
# route opens its card; "Follow this route" makes it the plan as fixed legs (no
# routing call), a loop with two via points; its share link rebuilds it from
# LIPAS, again with no routing call. LIPAS answers come from a recorded file.
LIPAS_RIDE = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const fx = await (await fetch(location.origin + '/tools/fixtures/lipas-multamaki.json')).json();
  const L = await import(location.origin + '/js/lipas.js');
  const P = await import(location.origin + '/js/planner.js');
  const n = await import(location.origin + '/js/net.js');
  const routed = () => n.usage().filter((u) => /^brouter|^valhalla/.test(u.id)).reduce((s, u) => s + (u.session || 0), 0);
  const empty = { type: 'FeatureCollection', features: [] };
  L.seedLipas((url) => (/CQL_FILTER=id%3D615379/.test(url) ? fx.place : /lipas_kaikki_reitit/.test(url) ? fx.routes : /lipas_kaikki_pisteet/.test(url) ? fx.stops : empty));
  const r0 = routed();
  const input = document.querySelector('#search-input');
  input.focus();
  input.value = 'multam';
  input.dispatchEvent(new Event('input'));
  let heads = [];
  for (let k = 0; k < 40; k++) {
    await wait(200);
    heads = [...document.querySelectorAll('#search-results .r-group')].map((x) => x.textContent);
    if (heads.includes('Routes · LIPAS') && heads.includes('Stops · LIPAS')) break;
  }
  if (!heads.includes('Routes · LIPAS')) errs.push(`search groups: ${heads.join(', ') || 'none'}`);
  if (!heads.includes('Stops · LIPAS')) errs.push('no LIPAS stops in search');
  const item = [...document.querySelectorAll('#search-results li[data-kind=routes]')].find((li) => /Multamäen MTB-lenkki/.test(li.textContent));
  if (!item) return [...errs, 'Multamäen MTB-lenkki is not in the results'];
  item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  let ride = null;
  // (its card is the planner's, at the spot: 25d part 6)
  for (let k = 0; k < 40 && !ride; k++) { await wait(200); ride = [...document.querySelectorAll('.pl-way.card button')].find((b) => /Follow this route/.test(b.textContent)); }
  if (!ride) return [...errs, 'the card has no Follow this route (#306)'];
  if (/\\bRide\\b/.test(document.querySelector('.pl-way.card').textContent)) errs.push('the card says Ride (#306)');
  const note = () => document.querySelector('.pl-way.card .rt-cost')?.textContent || '';
  for (let k = 0; k < 30 && !/loop|one way/.test(note()); k++) await wait(150);
  if (!/^18 km, a loop/.test(note())) errs.push(`the card says: ${note() || 'nothing'}`);
  if (!polku.map.getLayer('lipas-pick') || !polku.map.queryRenderedFeatures({ layers: ['lipas-pick'] }).length) errs.push('the picked route is not highlighted');
  // What's here must finish its height too, for a route opened from search.
  [...document.querySelectorAll('.pl-way.card .row')].find((b) => b.querySelector('b')?.textContent === 'What’s here').click();
  const height = () => [...document.querySelectorAll('.pl-way.card .insp-row')].find((r) => r.firstChild.textContent === 'Height')?.querySelector('b').textContent;
  for (let k = 0; k < 50 && height() === '…'; k++) await wait(200);
  if (!height() || height() === '…') errs.push(`a LIPAS route's What's here keeps Height at ${height() || 'nothing'}`);
  polku.planner.cards.back();
  for (let k = 0; k < 20 && polku.planner.cards.current?.kind !== 'lipas'; k++) await wait(100);
  ride = [...document.querySelectorAll('.pl-way.card button')].find((b) => /Follow this route/.test(b.textContent));
  ride.click();
  const p = polku.planner;
  for (let k = 0; k < 50 && !(p.analysis && p.legs.length === 3); k++) await wait(200);
  const km = p.analysis ? p.analysis.total / 1000 : 0;
  if (p.legs.length !== 3 || !p.legs.every((l) => l.mode === 'fixed' && l.src)) errs.push(`legs: ${p.legs.map((l) => l.mode).join(', ')}`);
  if (!p.isLoop()) errs.push('the ride is not a loop');
  if (Math.abs(km - 18) > 0.5) errs.push(`ride is ${km.toFixed(2)} km`);
  if (p.routeName !== 'Multamäen MTB-lenkki') errs.push(`route name: ${p.routeName}`);
  const url = p.shareUrl();
  if (!/[?&]lr=/.test(url)) errs.push('the share link has no LIPAS legs');
  // the link, opened elsewhere: legs from LIPAS
  p.clear();
  p.restore(P.parseShared(new URL(url).searchParams));
  for (let k = 0; k < 50 && !(p.analysis && p.legs.every((l) => l.result)); k++) await wait(200);
  const km2 = p.analysis ? p.analysis.total / 1000 : 0;
  if (!p.legs.every((l) => l.mode === 'fixed' && l.status === 'ok') || Math.abs(km2 - km) > 0.05) errs.push(`from the link: ${p.legs.map((l) => `${l.mode}/${l.status}`).join(', ')}, ${km2.toFixed(2)} km`);
  if (routed() !== r0) errs.push(`${routed() - r0} routing requests (riding a LIPAS route needs none)`);
  p.clear();
  L.seedLipas(null);
  localStorage.removeItem('polku:recentSearches');
  return errs;
})()"""


def lipas(chrome):
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#13/62.4345/25.9026')
    pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
    fails = pg.js(LIPAS_RIDE)
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} LIPAS search & ride" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Marked routes picked on the map (#308): with a mouse the pointer is a hand over a LIPAS route and the route is lit
# before a click, all its parts (they share its LIPAS id, which its feature state is set on); with a finger a tap 10 px
# beside its line opens its card and lights it while the card is open, and a tap 30 px away doesn't. LIPAS answers
# from the recorded Multamäki route, cut in two parts, and a second route made from it south-east.
MARKED_LIPAS = """(() => {
  const real = window.fetch.bind(window), json = (o) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });
  const empty = { type: 'FeatureCollection', features: [] };
  let fx = null;
  const load = async () => {
    if (fx) return fx;
    const f = await (await real(location.origin + '/tools/fixtures/lipas-multamaki.json')).json();
    const [one] = f.place.features, c = one.geometry.coordinates, k = Math.floor(c.length / 2);
    const part = (id, cs, rid, dx, dy) => ({ ...one, properties: { ...one.properties, id, reitti_id: rid }, geometry: { type: 'LineString', coordinates: cs.map(([e, n]) => [e + dx, n + dy]) } });
    return (fx = { features: [part(615379, c.slice(0, k + 1), 1, 0, 0), part(615379, c.slice(k), 2, 0, 0), part(615380, c, 1, 900, -700)] });
  };
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (!/^https:\\/\\/lipas\\.fi\\//.test(url)) return real(input, init);
    const { features } = await load();
    if (!/lipas_4411_/.test(url)) return json(empty);
    return json({ type: 'FeatureCollection', features });
  };
})()"""
MARKED_JS = """(() => {
  const map = polku.map, canvas = map.getCanvas(), wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const mk = (window.mk = {});
  const keyOf = (p) => `${p.type}/${p.lipasId}`;
  const drawn = (layer, key) => (map.getLayer(layer) ? map.queryRenderedFeatures({ layers: [layer] }).filter((f) => !key || keyOf(f.properties) === key) : []);
  const parts = (source, key) => map.getSource(source).serialize().data.features.filter((f) => !key || keyOf(f.properties) === key); // (whole lines, as sent to the map)
  mk.ready = async () => {
    map.jumpTo({ center: [25.9026, 62.4345], zoom: 13 });
    for (let k = 0; k < 80 && !(parts('lipasRoutes').length === 3 && drawn('lipas-route').length > 1); k++) await wait(150);
    return parts('lipasRoutes').length;
  };
  // a place on a route's line, and one 10 px and one 30 px beside it (a mouse: one 50 px beside it), on the bare map, in window px
  mk.spot = async (touch) => {
    const I = await import(location.origin + '/js/inspect.js'), r = canvas.getBoundingClientRect();
    const win = (q) => ({ x: r.left + q.x, y: r.top + q.y });
    const ok = (q) => { const w = win(q); return w.x > 40 && w.x < innerWidth - 80 && w.y > 130 && w.y < innerHeight * (touch ? 0.55 : 0.85) && document.elementFromPoint(w.x, w.y) === canvas; };
    const opens = ['cameras', 'sf-ships', 'nm-marks', 'sf-points', 'lipas-route'].filter((id) => map.getLayer(id));
    const near = (q, d) => map.queryRenderedFeatures([[q.x - d, q.y - d], [q.x + d, q.y + d]], { layers: opens }).length;
    const key = keyOf(parts('lipasRoutes')[0].properties);
    for (const f of parts('lipasRoutes', key)) for (let i = 2; i < f.geometry.coordinates.length; i += 3) {
      const c = f.geometry.coordinates, a = map.project(c[i - 1]), P = map.project(c[i]), len = Math.hypot(P.x - a.x, P.y - a.y);
      if (len < 4 || !ok(P)) continue;
      const n = { x: -(P.y - a.y) / len, y: (P.x - a.x) / len }, at = (d) => ({ x: P.x + n.x * d, y: P.y + n.y * d });
      for (const s of [1, -1]) {
        const q10 = at(10 * s), q30 = at(30 * s), q50 = at(50 * s);
        const top = I.pickFeature(map.queryRenderedFeatures(I.hitBox(touch ? q10 : P, touch), { layers: I.inspectLayers(map) }));
        if (!top || top.layer.id !== 'lipas-route' || keyOf(top.properties) !== key) continue;
        if (!(touch ? ok(q10) && ok(q30) && !near(q30, 17) : ok(q50) && !near(q50, 20))) continue;
        // a mouse: also two vertices 50 px apart (and their midpoint on the line) for a route of yours drawn over it
        let plan = null;
        if (!touch) {
          const j = c.findIndex((x, m) => m > i && Math.hypot(map.project(x).x - P.x, map.project(x).y - P.y) >= 50), Q = j > 0 && map.project(c[j]);
          const mid = Q && { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
          if (!Q || !ok(Q) || !ok(mid) || Math.hypot(Q.x - P.x, Q.y - P.y) > 90 || !map.queryRenderedFeatures([[mid.x - 3, mid.y - 3], [mid.x + 3, mid.y + 3]], { layers: ['lipas-route'] }).some((x) => keyOf(x.properties) === key)) continue;
          plan = { ll: [c[i], c[j]], mid: win(mid) };
        }
        return { key, id: f.properties.lipasId, on: win(P), near: win(q10), far: win(touch ? q30 : q50), plan };
      }
    }
    return null;
  };
  // the pointer, and whether the route is lit (its feature state, set on the LIPAS id its parts share)
  mk.state = (id) => ({ cursor: canvas.style.cursor, lit: !!map.getFeatureState({ source: 'lipasRoutes', id }).hover });
  mk.ids = (key) => [...new Set(drawn('lipas-route', key).map((f) => f.id))].join();
  // what the pick holds (its parts as sent to the map), and whether it's drawn
  mk.picked = () => ({ parts: parts('lipasPick').length, keys: [...new Set(parts('lipasPick').map((f) => keyOf(f.properties)))].join(), drawn: drawn('lipas-pick').length > 0 });
  mk.card = () => { const c = polku.planner.cards.current; return c ? `${c.kind}${c.props ? ` ${keyOf(c.props)}` : ''}` : 'none'; };
  mk.close = async () => { polku.planner.cards.close(); await wait(300); return true; };
  // a route of yours between two points (none for none), the planner put away again: its line is drawn over the marked route's
  mk.plan = async (ll) => {
    const p = polku.planner;
    p.setActive(true);
    p.clear();
    for (const q of ll) p.addPoint(q);
    for (let k = 0; k < 60 && ll.length && !(p.analysis && p.legs.every((l) => l.result)); k++) await wait(100);
    p.setActive(false);
    await wait(600);
    return map.queryRenderedFeatures({ layers: ['route-casing'] }).filter((f) => f.properties.kind === 'leg').length;
  };
  // the queries (a warning marker's apart) made within 85 ms of a pointer move (the tooltip's own waits 90 ms at the least), however late this is read
  mk.spy = (on) => {
    if (on) {
      mk.qs = []; mk.t0 = null; mk.was = map.queryRenderedFeatures;
      map.queryRenderedFeatures = function (...a) { if (!(a[1] && a[1].layers || []).includes('heads-icon')) mk.qs.push(performance.now()); return mk.was.apply(this, a); };
      canvas.addEventListener('pointermove', mk.mark = () => { if (mk.t0 == null) mk.t0 = performance.now(); }, true);
      return 0;
    }
    if (mk.was) { map.queryRenderedFeatures = mk.was; mk.was = null; canvas.removeEventListener('pointermove', mk.mark, true); }
    return mk.t0 == null ? -1 : mk.qs.filter((t) => t >= mk.t0 && t < mk.t0 + 85).length;
  };
  return true;
})()"""


def marked(chrome):
    ok = True
    for w, h_, phone in [(1440, 900, False), (390, 844, True)]:
        fails = []
        pg = chrome.page(w, h_, phone)
        try:
            pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': MARKED_LIPAS}, pg.s)
            pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': FIT_ROUTER % (0.002, 0)}, pg.s)
            pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"', 'polku:winter': '"off"', **LOCAL_BROUTER}, '#13/62.4345/25.9026')
            pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
            pg.js(MARKED_JS)
            s = None
            if pg.js('mk.ready()', timeout=30000) != 3:
                fails.append('the route’s parts are not on the map')
            else:
                s = pg.js(f'mk.spot({"true" if phone else "false"})', timeout=30000)
                if not s:
                    fails.append('no place on a route in the clear')
            if s and not phone:
                state = lambda: pg.js(f"mk.state({s['id']})")

                def move(at):
                    pg.c.send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': at['x'], 'y': at['y'], 'button': 'none'}, pg.s)
                    time.sleep(0.15)
                move(s['far'])
                if state() != {'cursor': '', 'lit': False}:
                    fails.append(f"off the route: {state()}")
                # a move makes one query (the cursor's) before the tooltip's, 90 ms after at the soonest (the spy counts by time, so a slow runner doesn't matter)
                pg.js('mk.spy(true)')
                pg.c.send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': s['on']['x'], 'y': s['on']['y'], 'button': 'none'}, pg.s)
                time.sleep(0.4)
                made = pg.js('mk.spy(false)')
                if made > 1:
                    fails.append(f'a pointer move made {made} queries before the tooltip, not one')
                if state() != {'cursor': 'pointer', 'lit': True}:
                    fails.append(f"over a route: {state()}")
                ids = pg.js(f"mk.ids({json.dumps(s['key'])})")
                if ids != str(s['id']):
                    fails.append(f"the route's parts don't share one id to be lit by: {ids}")
                move(s['far'])
                if state() != {'cursor': '', 'lit': False}:
                    fails.append(f"back off the route: {state()}")
                # your own route on the line is what a click opens there: a hand, and the marked route not lit
                if not pg.js(f"mk.plan({json.dumps(s['plan']['ll'])})", timeout=30000):
                    fails.append('no route of yours drawn over the marked route')
                else:
                    move(s['plan']['mid'])
                    if state() != {'cursor': 'pointer', 'lit': False}:
                        fails.append(f"where your route runs over it: {state()}")
                pg.js('mk.plan([])', timeout=30000)
                # a warning marker under the pointer is what a click opens first: a hand, and the marked route not lit
                pg.js('mk.headWas = polku.planner.headAt; polku.planner.headAt = () => ({ properties: { key: "x" } }); true')
                move(s['far'])
                move(s['on'])
                if state() != {'cursor': 'pointer', 'lit': False}:
                    fails.append(f"where a warning marker is over it: {state()}")
                pg.js('polku.planner.headAt = mk.headWas; true')
                move(s['far'])
                # a click: the card opens with the route lit, and the hover's light goes
                move(s['on'])
                for kind in ('mousePressed', 'mouseReleased'):
                    pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': s['on']['x'], 'y': s['on']['y'], 'button': 'left', 'buttons': 1 if kind == 'mousePressed' else 0, 'clickCount': 1}, pg.s)
                time.sleep(0.8)
                if pg.js('mk.card()') != f"lipas {s['key']}":
                    fails.append(f"a click on the route opened {pg.js('mk.card()')}")
                if pg.js('mk.picked()') != {'parts': 2, 'keys': s['key'], 'drawn': True}:
                    fails.append(f"a click on the route: lit {pg.js('mk.picked()')}")
                if state()['lit']:
                    fails.append('the hover light stays on beside the picked one')
            if s and phone:
                # 30 px away: no card of the route and nothing lit; 10 px away: its card, the route lit, and unlit when it closes
                pg.quick_tap(s['far']['x'], s['far']['y'])
                time.sleep(0.8)
                if pg.js('mk.card()').startswith('lipas') or pg.js('mk.picked()')['parts']:
                    fails.append(f"a tap 30 px from the line: {pg.js('mk.card()')}, lit {pg.js('mk.picked()')}")
                pg.js('mk.close()')
                pg.quick_tap(s['near']['x'], s['near']['y'])
                time.sleep(0.8)
                if pg.js('mk.card()') != f"lipas {s['key']}":
                    fails.append(f"a tap 10 px from the line opened {pg.js('mk.card()')}")
                if pg.js('mk.picked()') != {'parts': 2, 'keys': s['key'], 'drawn': True}:
                    fails.append(f"a tap 10 px from the line: lit {pg.js('mk.picked()')}")
                pg.js('mk.close()')
                if pg.js('mk.picked()')['parts']:
                    fails.append('the route stays lit after its card closes')
                # a pick made since (search's, Marked routes') is not wiped when the tapped route's card goes
                pg.quick_tap(s['near']['x'], s['near']['y'])
                time.sleep(0.8)
                pg.js("polku.planner.app.setData('lipasPick', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { type: 4411, lipasId: 1 }, geometry: { type: 'LineString', coordinates: [[25.9, 62.4], [25.91, 62.41]] } }] }); true")
                pg.js('mk.close()')
                if pg.js('mk.picked()')['parts'] != 1:
                    fails.append(f"another pick wiped when the tapped route's card closed: {pg.js('mk.picked()')}")
            fails += [f'console: {e[:160]}' for e in pg.errors()]
        finally:
            pg.close()
        print(f"{'ok  ' if not fails else 'FAIL'} marked routes picked on the map ({w}x{h_})" + ''.join(f'\n     - {f}' for f in fails), flush=True)
        ok = ok and not fails
    return ok


# Water routing (13): Kaivopuisto → Suomenlinna over the Särkän väylä shipping lane,
# with Väylävirasto's fairways and marks from a recorded file, a fixed wind and no
# OSM. The lane is crossed (no longer inside it than when fairways are ignored), a
# rock put on the way is kept clear of, the planner's Heads-up names the crossing,
# and a leg takes well under the time budget. Map tiles load live.
WATER = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const fx = await (await fetch(location.origin + '/tools/fixtures/water-helsinki.json')).json();
  const D = await import(location.origin + '/js/waterdata.js');
  const W = await import(location.origin + '/js/water.js');
  const G = await import(location.origin + '/js/geo.js');
  const n = await import(location.origin + '/js/net.js');
  const fc = (features) => ({ type: 'FeatureCollection', features });
  let extra = [];
  D.seedWater((box, want) => ({
    fairways: want.fairways ? fc(fx.fairways) : fc([]),
    hazards: want.hazards ? fc([...fx.marks.map((f) => ({ ...f, properties: { ...f.properties, src: 'mark' } })), ...extra]) : fc([]),
    wind: want.wind ? { speed: 10, gust: 14, dir: 180 } : null, missing: [] }));
  const from = [24.9585, 60.1540], to = [24.9800, 60.1480];
  const ships = fx.fairways.filter((f) => f.properties.cls === 'ship');
  const inside = (p, g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some((rings) => {
    let k = false;
    for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) k = !k;
    }
    return k;
  });
  const inLane = (c) => { let m = 0; for (let i = 1; i < c.length; i++) { const d = G.dist(c[i - 1], c[i]), s = Math.ceil(d / 5); for (let j = 0; j < s; j++) { const t = (j + 0.5) / s, p = [c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t]; if (ships.some((f) => inside(p, f.geometry))) m += d / s; } } return m; };
  const t0 = performance.now();
  const cross = await W.routeWater(from, to, { at: 0, hazards: 'ignore', wind: 'ignore' });
  const ms = performance.now() - t0;
  const ignore = await W.routeWater(from, to, { at: 0, fairways: 'ignore', hazards: 'ignore', wind: 'ignore' });
  const mc = inLane(cross.coords), mi = inLane(ignore.coords);
  if (!cross.water.events.some((e) => e.kind === 'ship')) errs.push('no shipping-lane crossing found');
  if (mc > mi + 5) errs.push(`${Math.round(mc)} m inside the shipping lane, against ${Math.round(mi)} m ignoring fairways`);
  window.waterLeg = { ms, grid: (cross.water.times || {})['render+data'] }; // printed with the result: how close the runner comes to the limit (#268)
  if (ms > 6000) errs.push(`a leg took ${Math.round(ms)} ms`);
  // a rock where the direct line went: kept clear of
  const c = ignore.coords, L = G.lineLength(c);
  let acc = 0, rock = null;
  for (let i = 1; i < c.length && !rock; i++) { const d = G.dist(c[i - 1], c[i]); if (acc + d >= L * 0.3) { const t = (L * 0.3 - acc) / d; rock = [c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t]; } acc += d; }
  extra = [{ type: 'Feature', properties: { kind: 'rock', src: 'osm' }, geometry: { type: 'Point', coordinates: rock } }];
  const clear = await W.routeWater(from, to, { at: 0, fairways: 'ignore', wind: 'ignore' });
  const near = G.nearestOnLine(rock, clear.coords).d;
  if (near < 18) errs.push(`passes ${Math.round(near)} m from a rock (keeps 25 m)`);
  extra = [];
  // in the planner: Heads-up names the crossing
  polku.set({ activity: 'paddle' });
  await wait(800);
  const p = polku.planner;
  p.setActive(true);
  p.clear();
  p.setMode('water');
  p.addPoint(from);
  p.addPoint(to);
  for (let k = 0; k < 60 && !(p.analysis && p.analysis.waterWarn); k++) await wait(250);
  const texts = ((p.analysis && p.analysis.waterWarn) || []).map((w) => w.text);
  if (!texts.some((t) => /^Crosses (the Särkän väylä|a shipping lane)/.test(t))) errs.push(`Heads-up: ${texts.join(' / ') || 'nothing from the water'}`);
  p.reveal('warnings');
  await wait(300);
  if (!/Crosses/.test(document.querySelector('[data-sec=warnings]')?.textContent || '')) errs.push('the crossing is not in Heads-up');
  // a source that didn't answer (25d part 2): Not checked, on the legs routed without it, with Retry, until it answers;
  // What Polku looked at says so, and names no Fintraffic for a route on the water
  if (typeof p.headsUp !== 'function') errs.push('no headsUp() on the planner');
  else {
    const water = () => p.headsUp().not.filter((x) => x.key === 'water');
    const rocks = () => p.lookedAt(p.analysis).find((r) => /^Rocks and shoals/.test(r.what));
    D.seedWater((box, want) => ({ fairways: want.fairways ? fc(fx.fairways) : fc([]), hazards: fc([]), wind: want.wind ? { speed: 10, gust: 14, dir: 180 } : null, missing: want.hazards ? ['OpenStreetMap'] : [] }));
    p.clear();
    p.addPoint(from);
    p.addPoint([to[0], to[1] + 0.0001]); // a leg of its own: a whole one is kept, and comes back as it was
    for (let k = 0; k < 60 && !water().length; k++) await wait(250);
    const x = water()[0];
    if (!x) errs.push(`OpenStreetMap didn't answer: nothing on the water in Not checked (${p.headsUp().not.map((y) => y.key).join(', ') || 'nothing'})`);
    else {
      if (!/OpenStreetMap/.test(`${x.text} ${x.by}`) || !x.note) errs.push(`Not checked on the water: ${x.text} (${x.by}) · ${x.note}`);
      if (typeof x.retry !== 'function') errs.push('Not checked on the water has no Retry');
      const end = p.analysis.along[p.analysis.along.length - 1];
      // the route's only leg: the whole route (null), not a stretch from 0 m (#416's review)
      if (x.ranges !== null) errs.push(`Not checked on the water covers ${JSON.stringify(x.ranges)} of the ${Math.round(end)} m route, not the whole route`);
      if ([...p.headsUp().read, ...p.headsUp().look].some((w) => /^Not checked/.test(w.text))) errs.push('a source that didn\\'t answer is an item of Read or Worth a look too');
      if (!rocks() || rocks().state !== 'bad') errs.push(`What Polku looked at, rocks and shoals: ${rocks() ? `${rocks().state} · ${rocks().by}` : 'no row'}, not bad`);
      if (p.lookedAt(p.analysis).some((r) => /Fintraffic/.test(r.by))) errs.push('What Polku looked at names Fintraffic for a route on the water');
      D.seedWater((box, want) => ({ fairways: want.fairways ? fc(fx.fairways) : fc([]), hazards: want.hazards ? fc(fx.marks.map((f) => ({ ...f, properties: { ...f.properties, src: 'mark' } }))) : fc([]), wind: want.wind ? { speed: 10, gust: 14, dir: 180 } : null, missing: [] }));
      x.retry();
      for (let k = 0; k < 60 && (water().length || p.legs[0].status !== 'ok'); k++) await wait(250);
      if (water().length) errs.push('OpenStreetMap answered after Retry, and the water is still in Not checked');
      else if (!rocks() || rocks().state !== 'ok') errs.push(`What Polku looked at, rocks and shoals once answered: ${rocks() ? `${rocks().state} · ${rocks().by}` : 'no row'}`);
    }
  }
  if (n.usage().some((u) => /^brouter|^valhalla/.test(u.id) && u.session)) errs.push('a routing request (water legs need none)');
  p.clear();
  D.seedWater(null);
  polku.set({ activity: 'mtb' });
  return errs;
})()"""


def water(chrome):
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#13/60.152/24.97')
    pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
    fails = pg.js(WATER, timeout=85000)
    leg = pg.js('window.waterLeg || {}')
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    took = f"the timed leg {leg.get('ms', 0) / 1000:.1f} s, 6 s at most, {(leg.get('grid') or 0) / 1000:.1f} s of it drawing the water and getting the data"
    print(f"{'ok  ' if not fails else 'FAIL'} water routing ({took})" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# OSM's rocks come late (#67), from mocked services: Overpass holds its answer
# back, Väylävirasto answers with nothing, the wind is ignored (no forecast). The
# leg is routed without the rocks and Heads-up says so. A second leg, routed
# while the answer comes in (its own wait for it over), is routed again with it.
# Once the answer is in, the planner routes the first leg again: it keeps clear
# of the rock that came, and the warning goes. A complete leg asked for again
# comes from the cache.
WATER_LATE = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const D = await import(location.origin + '/js/waterdata.js');
  const W = await import(location.origin + '/js/water.js');
  const G = await import(location.origin + '/js/geo.js');
  const n = await import(location.origin + '/js/net.js');
  const { OVERPASS } = await import(location.origin + '/js/config.js');
  // the rocks are made up: no answer cached by an earlier run before, none kept after
  const forget = () => new Promise((ok) => {
    const r = indexedDB.open('polku');
    r.onerror = () => ok();
    r.onsuccess = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('overpass')) { db.close(); ok(); return; }
      const t = db.transaction('overpass', 'readwrite');
      t.objectStore('overpass').delete(IDBKeyRange.bound('waterhaz/', 'waterhaz/~'));
      t.oncomplete = t.onerror = () => { db.close(); ok(); };
    };
  });
  // the second leg is on the open sea south of the first, in tiles of its own
  const b = [[24.955, 60.045], [24.985, 60.040]], boxB = [24.935, 60.028, 25.005, 60.057];
  let hold = true, held = [], asked = [], rocks = [], vaylaB = null;
  const realFetch = window.fetch;
  const rockAnswer = () => new Response(JSON.stringify({ elements: rocks.map(([lon, lat], i) => ({ type: 'node', id: i + 1, lon, lat, tags: { natural: 'rock' } })) }));
  const empty = () => new Response('{"type":"FeatureCollection","features":[]}');
  const release = () => { hold = false; const h = held; held = []; for (const ok of h) ok(); };
  window.fetch = (url, init = {}) => {
    const u = String(url);
    if (OVERPASS.some((m) => u.startsWith(m))) {
      const q = new URLSearchParams(String(init.body)).get('data') || '';
      if (!/seamark/.test(q)) return Promise.resolve(new Response('{"elements":[]}'));
      asked.push(q.match(/\\(([\\d.]+,[\\d.]+),/)[1]); // the tile's south-west corner
      if (!hold) return Promise.resolve(rockAnswer());
      return new Promise((ok) => held.push(ok)).then(rockAnswer);
    }
    if (u.startsWith('https://avoinapi.vaylapilvi.fi/')) {
      if (!/bbox=59\\.88/.test(u)) return Promise.resolve(empty()); // the first leg's tiles
      // the second leg's: asked for ahead, not kept (a bad answer). While it's routed, OSM's
      // answer comes 0.1 s in (after the leg stopped waiting for it), and these after that
      if (!vaylaB) return Promise.resolve(new Response('-'));
      if (vaylaB === true) vaylaB = new Promise((ok) => { const off = D.onWaterData(() => { off(); ok(); }); setTimeout(release, 100); });
      return vaylaB.then(empty);
    }
    return realFetch(url, init);
  };
  const along = (c, f) => {
    const L = G.lineLength(c);
    let acc = 0;
    for (let i = 1; i < c.length; i++) {
      const d = G.dist(c[i - 1], c[i]);
      if (acc + d >= L * f) { const t = (L * f - acc) / d; return [c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t]; }
      acc += d;
    }
    return c[c.length - 1];
  };
  const p = polku.planner;
  const leg = () => p.legs[0];
  const done = () => leg() && leg().status === 'ok' && leg().result && leg().result.water;
  const warned = () => !!p.analysis && p.headsUp().not.some((x) => x.key === 'water' && /OpenStreetMap/.test(`${x.text} ${x.by}`)); // (25d part 2: Not checked)
  try {
    await forget();
    // the second leg's rocks asked for now, so they're held by the time it's routed
    D.prefetchWater(boxB);
    for (let k = 0; k < 40 && new Set(asked.filter((s) => s < '60.05')).size < 2; k++) await wait(250);
    if (new Set(asked.filter((s) => s < '60.05')).size < 2) errs.push(`(the test) the second leg's rocks were not asked for ahead: ${asked.join(', ') || 'nothing'}`);
    polku.set({ activity: 'paddle' });
    await wait(800);
    p.setActive(true);
    p.clear();
    p.setMode('water');
    p.addPoint([24.9585, 60.1540]);
    p.addPoint([24.9800, 60.1480]);
    for (let k = 0; k < 80 && !(done() && warned()); k++) await wait(250);
    if (p.legs.length && p.routerFor(0).water.wind !== 'ignore') errs.push('the wind is not ignored (the test has no forecast)');
    if (!done()) return [...errs, `the leg was not routed: ${leg() ? leg().status : 'no leg'}`];
    const first = leg().result;
    if (!first.water.missing.includes('OpenStreetMap')) errs.push(`routed with OSM though Overpass had not answered (missing: ${first.water.missing.join(', ') || 'nothing'})`);
    if (!warned()) errs.push('Heads-up does not say that OSM was not checked');
    const rockA = along(first.coords, 0.3), rockB = along(b, 0.4); // the second leg's line is straight
    rocks = [rockA, rockB];
    let routing = true, cameWhileRouting = false;
    const off = D.onWaterData(() => { if (routing) cameWhileRouting = true; });
    vaylaB = true;
    const rb = await W.routeWater(b[0], b[1], { at: 0, wind: 'ignore' });
    routing = false;
    off();
    if (!cameWhileRouting) errs.push('(the test) OSM did not answer while the second leg was routed');
    else if (rb.water.missing.length) errs.push(`a leg routed while OSM answered stays without it (missing: ${rb.water.missing.join(', ')})`);
    else if (!rb.water.times.again) errs.push('(the test) OSM answered before the second leg stopped waiting for it');
    else if (G.nearestOnLine(rockB, rb.coords).d < 18) errs.push(`the second leg passes ${Math.round(G.nearestOnLine(rockB, rb.coords).d)} m from its rock (keeps 25 m)`);
    // the first leg: the planner routes it again now that OSM has answered
    for (let k = 0; k < 80 && !(done() && leg().result !== first && !warned()); k++) await wait(250);
    const second = done() && leg().result;
    if (!second || second === first) errs.push('the leg was not routed again when OSM answered');
    else {
      if (second.water.missing.length) errs.push(`routed again, still without ${second.water.missing.join(', ')}`);
      const near = G.nearestOnLine(rockA, second.coords).d;
      if (near < 18) errs.push(`routed again, it passes ${Math.round(near)} m from the rock that came late (keeps 25 m)`);
    }
    if (warned()) errs.push('Heads-up still says that OSM was not checked');
    // a complete leg asked for again comes from the cache
    if (second && second !== first) {
      leg().key = null;
      p.routeAll();
      for (let k = 0; k < 40 && !done(); k++) await wait(100);
      if (leg().result !== second) errs.push('a complete leg asked for again was routed again, not taken from the cache');
    }
    if (n.usage().some((u) => /^brouter|^valhalla/.test(u.id) && u.session)) errs.push('a routing request (water legs need none)');
    return errs;
  } finally {
    window.fetch = realFetch;
    release();
    p.clear();
    polku.set({ activity: 'mtb' });
    await wait(300);
    await forget();
  }
})()"""


def water_late(chrome):
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"', 'polku:styles': json.dumps({'paddle': {'p': 'balanced', 'v': {'w': 'ignore'}}})}, '#13/60.152/24.97')
    pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
    fails = pg.js(WATER_LATE, timeout=85000)
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} water routing when OSM's rocks come late" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Multisport (13b): an MTB route whose middle leg is paddled and last run, all
# straight lines (no routing). Each leg has its sport; the changeovers (15 min
# bike → paddle, 10 paddle → run, and one set by hand) add to the time; the time
# splits by sport; markers and the waypoint list show the changes; the share
# link and the saved route bring it all back; Swim is a sport.
MULTI = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const P = await import(location.origin + '/js/planner.js');
  const n = await import(location.origin + '/js/net.js');
  const p = polku.planner;
  polku.set({ activity: 'mtb' });
  await wait(500);
  p.setActive(true);
  p.clear();
  p.setMode('line');
  for (const q of [[23.700, 61.500], [23.720, 61.506], [23.745, 61.509], [23.760, 61.504]]) p.addPoint(q);
  p.setLegSport(1, 'paddle');
  p.setLegSport(2, 'run');
  for (let k = 0; k < 40 && !(p.analysis && p.analysis.waits && p.analysis.waits.length === 2); k++) await wait(200);
  const sports = p.legs.map((_, i) => p.legSport(i)).join(',');
  if (sports !== 'mtb,paddle,run') errs.push(`leg sports: ${sports}`);
  const a = p.analysis;
  if (!a || !a.waits || a.waits.length !== 2) return [...errs, `changeovers: ${a && a.waits ? a.waits.length : 'none'}`];
  const mins = a.waits.map((w) => w.sec / 60).join(',');
  if (mins !== '15,10') errs.push(`changeover minutes: ${mins}`);
  const moving = p.timed(a).total - 25 * 60;
  p.setChangeMin(2, 3);
  await wait(300);
  if (Math.round((p.analysis.time - moving) / 60) !== 18) errs.push(`time with 15 + 3 min of changeovers: ${Math.round((p.analysis.time - moving) / 60)} min more than moving`);
  if (document.querySelectorAll('.wp-sport').length !== 2) errs.push(`${document.querySelectorAll('.wp-sport').length} changeover badges on the map`);
  p.reveal('points');
  await wait(200);
  // Route's list (25d's part 4): a section a sport, each changeover on its point's row with its minutes
  const tags = [...document.querySelectorAll('.wpl-point .wpl-tag')].map((x) => x.textContent);
  if (tags.join(' / ') !== 'Paddle from here · changeover 15 min / Run from here · changeover 3 min') errs.push(`changeovers in the list: ${tags.join(' / ') || 'none'}`);
  const titles = [...document.querySelectorAll('.wpl .sec2-head b')].map((x) => x.textContent.split(' · ')[0]);
  if (titles.join() !== 'MTB,Paddle,Run') errs.push(`the list's sections: ${titles.join(', ')}`);
  p.reveal('speed');
  await wait(200);
  const rows = [...document.querySelectorAll('.speed-row.sub span')].map((x) => x.textContent.trim());
  if (!rows.some((t) => /Paddle/.test(t)) || !rows.some((t) => /^Changeovers \\(2\\)/.test(t))) errs.push(`time by sport: ${rows.join(' / ')}`);
  // the share link: sports and the hand-set minutes come back
  const url = p.shareUrl();
  if (!/[?&]s=-pu(&|$)/.test(url) || !/[?&]cw=2%3A3|[?&]cw=2:3/.test(url)) errs.push(`share link: ${url.split('?')[1]}`);
  p.clear();
  p.restore(P.parseShared(new URL(url).searchParams));
  for (let k = 0; k < 40 && !(p.analysis && p.analysis.waits && p.analysis.waits.length === 2); k++) await wait(200);
  const back = p.legs.map((_, i) => p.legSport(i)).join(',') + ' ' + (p.analysis && p.analysis.waits ? p.analysis.waits.map((w) => w.sec / 60).join(',') : '');
  if (back !== 'mtb,paddle,run 15,3') errs.push(`from the link: ${back}`);
  // the saved route too
  p.save();
  p.legs = []; p.points = [];
  p.loadSaved();
  await wait(400);
  const saved = p.legs.map((_, i) => p.legSport(i)).join(',') + ' ' + (p.changeAt(2) || {}).min;
  if (saved !== 'mtb,paddle,run 3') errs.push(`saved route: ${saved}`);
  // Swim is a sport of its own
  polku.set({ activity: 'swim' });
  await wait(600);
  if (!/Swim/.test(document.querySelector('.act-current')?.textContent || '')) errs.push('Swim is not in the sport switcher');
  if (n.usage().some((u) => /^brouter|^valhalla/.test(u.id) && u.session)) errs.push('a routing request (straight legs need none)');
  p.clear();
  polku.set({ activity: 'mtb' });
  return errs;
})()"""


def multi(chrome):
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#13/61.505/23.73')
    pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
    fails = pg.js(MULTI, timeout=85000)
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} multisport" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Stops and nights: a break and a night on via points (straight legs, no routing), departing
# at 10:00 whatever the hour of the run. The night lasts until its morning hour; the trip
# gets days; the bike left at a changeover is in Heads-up until it's taken along; a night too
# short to sleep is too; stops survive a drag, undo, the share link (st=, cg=) and the saved
# route.
STOPS = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const P = await import(location.origin + '/js/planner.js');
  const S = await import(location.origin + '/js/stops.js');
  const n = await import(location.origin + '/js/net.js');
  const p = polku.planner;
  p.setActive(true);
  p.clear();
  p.setMode('line');
  // depart at 10:00 (tomorrow once it's past), not now: run in the early morning, you'd reach
  // point 2 just before 08:00 and its night would be too short (#112)
  const ten = new Date();
  ten.setHours(10, 0, 0, 0);
  if (ten <= Date.now()) ten.setDate(ten.getDate() + 1);
  p.setLeave(ten / 1000);
  if (new Date(p.startSec() * 1000).getHours() !== 10) errs.push(`departure at ${new Date(p.startSec() * 1000)}`);
  for (const q of [[23.700, 61.500], [23.720, 61.506], [23.745, 61.509], [23.760, 61.504]]) p.addPoint(q);
  p.setLegSport(1, 'paddle'); // mtb → paddle → mtb: the bike stays at point 1
  const ready = (k) => p.analysis && p.analysis.waits && p.analysis.waits.length === k;
  for (let k = 0; k < 40 && !ready(2); k++) await wait(200);
  const warns = () => [...document.querySelectorAll('[data-sec=warnings] .tier :is(.row, .warn-row) b')].map((x) => x.textContent); // (Check's rows, 25d part 2)
  if (!warns().some((t) => /^Your bike is still at/.test(t))) errs.push(`no gear warning: ${warns().join(' / ')}`);
  p.setCarry(1, true);
  await wait(200);
  if (warns().some((t) => /^Your bike/.test(t))) errs.push('gear warning after taking the bike along');
  // a 45 min break where the paddle starts, and the night at point 2 (on at 08:00)
  p.setStop(1, { min: 45 });
  p.setStop(2, { on: 480 });
  await wait(400);
  const a = p.analysis, w1 = a.waits.find((w) => w.i === 1), w2 = a.waits.find((w) => w.i === 2);
  if (!w1 || w1.sec !== (15 + 45) * 60) errs.push(`break + changeover at point 1: ${w1 && w1.sec / 60} min`);
  const on = w2 && new Date((w2.arrive + w2.sec) * 1000);
  if (!on || on.getHours() !== 8 || on.getMinutes() !== 0) errs.push(`the night ends ${on}`);
  if (!w2 || w2.rest < 3600) errs.push(`night of ${w2 && w2.rest / 3600} h`);
  const total = (p.analysis.timeWind || p.analysis.time);
  const moving = total - a.waits.reduce((t, w) => t + w.sec, 0);
  const sum = document.querySelector('.sum-time small')?.textContent;
  if (sum !== '2 days') errs.push(`summary time: ${sum}`);
  const days = S.tripDays(a, a.tAtWind || a.tAt, a.wind ? a.wind.startSec : p.startSec(), a.waits);
  if (days.length !== 2 || Math.abs(days[0].moving + days[1].moving - moving) > 2) errs.push(`days: ${days.length}, moving ${days.map((d) => d.moving).join('+')} vs ${moving}`);
  p.reveal('depart');
  await wait(200);
  if (document.querySelectorAll('.days .day').length !== 2) errs.push(`${document.querySelectorAll('.days .day').length} days in Departure & weather`);
  if (document.querySelectorAll('.wp-stop').length !== 2 || document.querySelectorAll('.wp-stop.night').length !== 1) errs.push(`stop badges: ${document.querySelectorAll('.wp-stop').length}`);
  p.reveal('points');
  await wait(200);
  // Route's list (25d's part 4): the stop and the night on their points' rows; the night ends a day
  const tags = [...document.querySelectorAll('.wpl-point .wpl-tag')].map((x) => x.textContent);
  if (tags.length !== 2 || !tags.some((t) => /^Stop · \\d+ min$/.test(t)) || !tags.some((t) => /^Night · go on at \\d\\d:\\d\\d$/.test(t)) || !/^Day 1 · /.test(document.querySelector('.wpl .sec2-head b')?.textContent || '')) errs.push(`stops in the waypoint list: ${tags.join(' / ') || 'none'}`);
  p.reveal('speed');
  await wait(200);
  const rows = [...document.querySelectorAll('.speed-row.sub span')].map((x) => x.textContent.trim());
  if (!rows.some((t) => /^Breaks \(1\)/.test(t)) || !rows.some((t) => /^Nights \(1\)/.test(t))) errs.push(`Time & speed: ${rows.join(' / ')}`);
  // the point's card has the stop, places to sleep for a night, and the gear switch (25d)
  p.openPointCard(p.points[2]);
  await wait(200);
  const card = document.querySelector('.pl-way.card[data-kind=point]');
  if (!card || card.querySelector('.seg.icons [aria-checked=true]')?.textContent.trim() !== 'Night' || !/Places to sleep nearby/.test(card.textContent)) errs.push('the point’s card: no night or places to sleep');
  p.cards.close();
  p.openPointCard(p.points[1]);
  await wait(200);
  const card1 = document.querySelector('.pl-way.card[data-kind=point]');
  if (!card1 || !/Take the bike along/.test(card1.textContent) || !card1.querySelector('.tg input:checked')) errs.push('the point’s card: no "Take the bike along", on');
  if (!/Changeover/.test(card1?.textContent || '') || card1.querySelector('.rt-step input[aria-label^="Minutes to change"]')?.value !== String(p.changeAt(1).min)) errs.push('the point’s card: no changeover and its minutes');
  p.cards.close();
  // a night too short to sleep
  const ready2 = new Date((w2.arrive + w2.change + 3600) * 1000);
  p.setStop(2, { on: ready2.getHours() * 60 + ready2.getMinutes() });
  await wait(300);
  if (!warns().some((t) => /^A short night/.test(t))) errs.push(`no short-night warning: ${warns().join(' / ')}`);
  p.setStop(2, { on: 480 });
  // undo takes a stop back; a drag keeps it
  p.setStop(1, null);
  p.undo();
  if (!p.stopAt(1) || p.stopAt(1).min !== 45) errs.push(`undo: ${JSON.stringify(p.stopAt(1))}`);
  p.beginEdit(2, p.snapshot());
  p.editTo([23.746, 61.5095]);
  p.endEdit();
  if (!S.isNight(p.stopAt(2))) errs.push('a dragged point lost its night');
  // the share link and the saved route
  const url = p.shareUrl(), q = new URL(url).searchParams;
  if (q.get('st') !== '1:45,2:n0800' || q.get('cg') !== '1') errs.push(`share link: st=${q.get('st')} cg=${q.get('cg')}`);
  p.clear();
  p.restore(P.parseShared(q));
  await wait(300);
  // a link without ic= puts no leg on the ice (#479)
  if (q.has('ic') || p.legs.some((l) => l.ice) || warns().some((t) => /^On the ice/.test(t))) errs.push(`from the link: ice on legs ${p.legs.map((l, i) => (l.ice ? i : '')).join('')} (ic=${q.get('ic')})`);
  const back = `${JSON.stringify(p.stopAt(1))} ${JSON.stringify(p.stopAt(2))} ${p.carryAt(1)}`;
  if (back !== '{"min":45} {"on":480} true') errs.push(`from the link: ${back}`);
  p.save();
  p.legs = []; p.points = [];
  p.loadSaved();
  await wait(300);
  const saved = `${JSON.stringify(p.stopAt(1))} ${JSON.stringify(p.stopAt(2))} ${p.carryAt(1)}`;
  if (saved !== '{"min":45} {"on":480} true') errs.push(`saved route: ${saved}`);
  // leaving after dusk: the warning keeps the sun's own time, not the departure's
  const Sun = await import(location.origin + '/js/sun.js');
  const t8 = Date.parse('2026-10-14T20:00:00+03:00') / 1000, dk = Sun.darkness(t8, t8 + 3600, [24.94, 60.17]);
  if (!dk.length || dk[0].from !== t8 || !(dk[0].sunFrom < t8 - 1800)) errs.push(`darkness from 20:00: ${JSON.stringify(dk)}`);
  if (S.encodeStops([null, { min: 45 }, { on: 480 }]) !== '1:45,2:n0800' || JSON.stringify(S.decodeStops('1:45,2:n0800,x,3:n2500')) !== '[[1,{"min":45}],[2,{"on":480}]]') errs.push('st= encoding');
  if (n.usage().some((u) => /^brouter|^valhalla/.test(u.id) && u.session)) errs.push('a routing request (straight legs need none)');
  p.clear();
  return errs;
})()"""


def stops(chrome):
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#13/61.505/23.73')
    pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
    fails = pg.js(STOPS, timeout=85000)
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} stops and nights" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Places to avoid in share links (#69): three Avoid circles and a route around them,
# routed by a mocked BRouter, are shared and opened in a clean page. The circles come
# back, on the map and in the router's calls; a reload keeps them; a link from before
# them, or one whose circles can't be read, still opens. No routing call goes out: the
# mock answers brouter.de and Valhalla in every page it's added to.
AVOID_ROUTER = """(() => {
  const real = window.fetch.bind(window), calls = (window.routerCalls = []);
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (!/^https:\\/\\/(brouter\\.de|valhalla1\\.openstreetmap\\.de)\\//.test(url)) return real(input, init);
    calls.push(url);
    if (/valhalla/.test(url)) return new Response('{}', { status: 503 });
    const prof = url.match(/\\/profile\\/([\\w-]+)/);
    if (prof) return new Response(JSON.stringify({ profileid: prof[1] }));
    // a straight line through the points, with a vertex halfway along each stretch
    const ll = new URL(url).searchParams.get('lonlats').split('|').map((q) => q.split(',').map(Number)), c = [];
    ll.forEach((q, i) => { if (i) c.push([(ll[i - 1][0] + q[0]) / 2, (ll[i - 1][1] + q[1]) / 2]); c.push(q); });
    return new Response(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { messages: [] }, geometry: { type: 'LineString', coordinates: c } }] }));
  };
})()"""
AVOID_HELPERS = """const wait = (ms) => new Promise((r) => setTimeout(r, ms)), p = polku.planner;
  const routed = async (n) => { for (let k = 0; k < 100 && !(p.legs.length === n && p.legs.every((l) => l.status === 'ok') && p.analysis); k++) await wait(200); return p.legs.length === n && p.legs.every((l) => l.status === 'ok'); };
  const circles = (list) => (list || []).map((c) => `${c.ll[0]},${c.ll[1]},${c.r}`).join(' ') || 'none';
  const drawn = async () => { const s = polku.map.getSource('nogo'); const d = s && (s.getData ? await s.getData() : s._data); return d ? d.features.length : 0; };
  const toastSays = () => { const t = document.querySelector('#toast'); return t && !t.hidden ? t.textContent : ''; };"""
AVOID_SHARE = """(async () => {
  """ + AVOID_HELPERS + """
  const errs = [];
  p.checkWet = async () => {}; // dry ground whatever the weather, so no leg is routed twice
  p.wet = { on: false, mm: 0, at: Date.now() };
  p.setActive(true);
  p.setMode('auto');
  // the places first, the route then: each leg is routed once, around them
  p.addNogo([24.9401234, 60.1754321], 40, 'Avoided place');
  p.addNogos([{ ll: [24.962, 60.1781], r: 25, label: 'Fallen tree' }, { ll: [24.96251, 60.17826], r: 137.4, label: 'Fallen tree' }]);
  for (const q of [[24.930, 60.170], [24.950, 60.180], [24.975, 60.175]]) p.addPoint(q);
  if (!(await routed(2))) errs.push(`the route: ${p.legs.map((l) => l.status).join(', ')}`);
  if (!window.routerCalls.some((u) => /[?&]nogos=/.test(u))) errs.push('no circle in the first page\\'s router calls');
  const url = p.shareUrl(), bad = new URL(url);
  if (!new URL(url).searchParams.get('av')) errs.push(`no places to avoid in the share link: ${url.split('?')[1]}`);
  bad.searchParams.set('av', 'nonsense,24.9_60.1');
  return { errs, url, bad: bad.toString(), sent: p.nogos.map((n) => ({ ll: n.ll, r: n.r })) };
})()"""
# the link in a clean page: the circles at 5 decimals (about 1 m), each in a router call
AVOID_OPENED = """(async (sent) => {
  """ + AVOID_HELPERS + """
  const errs = [], want = sent.map((n) => ({ ll: n.ll.map((v) => +v.toFixed(5)), r: n.r }));
  if (!(await routed(2))) errs.push(`the route from the link: ${p.legs.map((l) => l.status).join(', ') || 'no legs'}`);
  if (circles(p.nogos) !== circles(want)) errs.push(`circles from the link: ${circles(p.nogos)}, not ${circles(want)}`);
  if (await drawn() !== want.length) errs.push(`${await drawn()} circles drawn on the map, not ${want.length}`);
  const got = new Set(window.routerCalls.filter((u) => /[?&]lonlats=/.test(u)).flatMap((u) => (new URL(u).searchParams.get('nogos') || '').split('|')));
  for (const n of want) { const k = `${n.ll[0].toFixed(6)},${n.ll[1].toFixed(6)},${n.r}`; if (!got.has(k)) errs.push(`the router never got ${k}`); }
  if (window.routerCalls.some((u) => /valhalla/.test(u))) errs.push('Valhalla was asked');
  if (/couldn/.test(toastSays())) errs.push(`a good link says: ${toastSays()}`);
  // a link from before av=: the same route, no circles
  const P = await import(location.origin + '/js/planner.js');
  const q = new URL(%s).searchParams;
  q.delete('av');
  const old = P.parseShared(q);
  if (!old || old.points.length !== 3 || (old.nogos && old.nogos.length)) errs.push(`a link without av=: ${old ? `${old.points.length} points, ${circles(old.nogos)}` : 'did not open'}`);
  // values that can't be read are left out (and said so); the rest of the link stays
  q.set('av', '24.94_60.17_40,abc,24.95_95_40,24.95_60.18_0,24.95_60.18_1e9,24.95_60.18_10001,24.95_60.18,24.95_60.18_40_1,_60.18_40,Infinity_60.18_40');
  const mix = P.parseShared(q);
  if (!mix || mix.points.length !== 3 || circles(mix.nogos) !== '24.94,60.17,40' || !mix.nogosLost) errs.push(`a link with one good circle among bad ones: ${mix ? `${circles(mix.nogos)}, lost: ${mix.nogosLost}` : 'did not open'}`);
  q.set('av', Array.from({ length: 205 }, (_, i) => `24.9_60.${100 + i}_30`).join(','));
  const many = P.parseShared(q);
  if (!many || (many.nogos || []).length !== 200 || !many.nogosLost) errs.push(`205 circles in a link: ${many ? `${(many.nogos || []).length} read, lost: ${many.nogosLost}` : 'did not open'}`);
  return errs;
})"""
# a reload: the saved route keeps them
AVOID_RELOADED = """(async (sent) => {
  """ + AVOID_HELPERS + """
  const want = sent.map((n) => ({ ll: n.ll.map((v) => +v.toFixed(5)), r: n.r }));
  return circles(p.nogos) !== circles(want) ? [`after a reload: ${circles(p.nogos)}, not ${circles(want)}`] : [];
})"""
# a link whose circles can't be read: it opens, says so, and shares without av=
AVOID_BAD = """(async () => {
  """ + AVOID_HELPERS + """
  const errs = [];
  if (!(await routed(2))) errs.push(`the route from a link with bad circles: ${p.legs.map((l) => l.status).join(', ') || 'no legs'}`);
  if (p.points.length !== 3) errs.push(`${p.points.length} points from a link with bad circles`);
  if (p.nogos.length) errs.push(`circles from a bad value: ${circles(p.nogos)}`);
  if (!/couldn/.test(toastSays())) errs.push(`nothing says the circles couldn't be read (toast: ${toastSays() || 'none'})`);
  if (new URL(p.shareUrl()).searchParams.has('av')) errs.push('a route without circles shares av=');
  return errs;
})()"""


def avoid_link(chrome):
    fails, shared = [], None
    pg = chrome.page(1440, 900, False)
    try:
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': AVOID_ROUTER}, pg.s)
        pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#13/60.175/24.95')
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        shared = pg.js(AVOID_SHARE, timeout=60000)
        fails += shared['errs']
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    pg = chrome.page(1440, 900, False)
    try:
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': AVOID_ROUTER}, pg.s)
        # a clean page: nothing saved on this device, only the link
        pg.goto(BASE + 'sw.js')
        pg.js('localStorage.clear(); true')
        pg.goto(shared['url'])
        pg.map_loaded()
        sent = json.dumps(shared['sent'])
        fails += pg.js((AVOID_OPENED % json.dumps(shared['url'])) + f'({sent})', timeout=60000)
        pg.reload()
        fails += pg.js(AVOID_RELOADED + f'({sent})')
        pg.goto(shared['bad'])
        pg.map_loaded()
        fails += pg.js(AVOID_BAD, timeout=60000)
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} places to avoid in share links" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Check's rows (25d part 2), and an item's card opened from its row, where its note and its actions are now: rows()
# their words, said() each row's with its card's note, cardOf(re) the card of the first row matching.
CHECK_ROWS = """
  const checkRows = () => [...document.querySelectorAll('[data-sec=warnings] .tier :is(.row, .warn-row)')];
  const rows = () => checkRows().map((r) => r.textContent);
  const cardOf = async (re) => {
    const r = checkRows().find((x) => re.test(x.textContent));
    if (!r) return null;
    r.click();
    for (let k = 0; k < 50 && !(polku.planner.cards.current && polku.planner.cards.current.kind === 'item'); k++) await new Promise((ok) => setTimeout(ok, 100));
    await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(ok, 200)))); // (its stretch lit in the frame after)
    return polku.planner.cards.current && polku.planner.cards.current.kind === 'item' ? polku.planner.cards.box : null;
  };
  const closeCard = async () => { polku.planner.cards.close(); await new Promise((ok) => setTimeout(ok, 200)); };
  const said = async () => { const out = []; for (let k = 0; k < checkRows().length; k++) { const r = checkRows()[k], t = r.textContent; r.click(); await new Promise((ok) => setTimeout(ok, 300)); out.push(`${t} ${polku.planner.cards.box?.querySelector('.heads-note')?.textContent || ''}`); await closeCard(); } return out; };
"""


# Ways marked private or closed (#105), from a mocked BRouter and a mocked Valhalla: a Run
# leg over a delivery road marked foot=private gets a Heads-up row, a footway marked
# access=no with foot=yes doesn't (the sport's own tag wins), and a row hidden under the old
# "Private or no access" key stays hidden. When Valhalla stands in (its answer has no access
# tags), a stretch along a way the map's tiles mark access=no gets a row, and the Valhalla
# row says it may take such ways. No routing call goes out.
ACCESS_ROUTER = """(() => {
  const real = window.fetch.bind(window), calls = (window.routerCalls = []);
  window.accessMode = 'brouter';
  const enc6 = (pts) => { let out = '', la = 0, lo = 0; const one = (v) => { v = v < 0 ? ~(v << 1) : v << 1; while (v >= 0x20) { out += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } out += String.fromCharCode(v + 63); };
    for (const [lon, lat] of pts) { const a = Math.round(lat * 1e6), b = Math.round(lon * 1e6); one(a - la); one(b - lo); la = a; lo = b; } return out; };
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (!/^https:[/][/](brouter[.]de|valhalla1[.]openstreetmap[.]de)[/]/.test(url)) return real(input, init);
    calls.push(url);
    if (/valhalla/.test(url)) {
      if (/trace_attributes/.test(url)) {
        const n = JSON.parse(init.body).shape.length;
        return new Response(JSON.stringify({ edges: [{ use: 'footway', surface: 'paved', begin_shape_index: 0, end_shape_index: n - 1 }] }));
      }
      const q = JSON.parse(new URL(url).searchParams.get('json')).locations.map((l) => [l.lon, l.lat]);
      const legs = q.slice(1).map((b, i) => { const a = q[i], c = []; for (let k = 0; k <= 10; k++) c.push([a[0] + ((b[0] - a[0]) * k) / 10, a[1] + ((b[1] - a[1]) * k) / 10]); return { shape: enc6(c) }; });
      return new Response(JSON.stringify({ trip: { legs } }));
    }
    if (window.accessMode !== 'brouter') return new Response('not json'); // BRouter can't: Valhalla stands in
    // A → B in thirds: a delivery road marked foot=private, a footway access=no + foot=yes, a footway
    const ll = new URL(url).searchParams.get('lonlats').split('|').map((q) => q.split(',').map(Number));
    const [a, b] = ll, at = (t) => [+(a[0] + (b[0] - a[0]) * t).toFixed(6), +(a[1] + (b[1] - a[1]) * t).toFixed(6)];
    const c = [a, at(1 / 3), at(2 / 3), b];
    const head = ['Longitude', 'Latitude', 'Elevation', 'Distance', 'CostPerKm', 'ElevCost', 'TurnCost', 'NodeCost', 'InitialCost', 'WayTags', 'NodeTags'];
    const row = (p, tags) => [String(Math.round(p[0] * 1e6)), String(Math.round(p[1] * 1e6)), '0', '0', '0', '0', '0', '0', '0', tags, ''];
    const messages = [head, row(c[1], 'highway=service access=delivery foot=private'), row(c[2], 'highway=footway access=no foot=yes'), row(c[3], 'highway=footway')];
    return new Response(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { messages }, geometry: { type: 'LineString', coordinates: c } }] }));
  };
})()"""
ACCESS = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [], p = polku.planner, m = polku.map;""" + CHECK_ROWS + """
  p.checkWet = async () => {}; // dry ground whatever the weather, so no leg is routed twice
  p.wet = { on: false, mm: 0, at: Date.now() };
  const routed = async (by) => { for (let k = 0; k < 100 && !(p.legs.length === 1 && p.legs[0].status === 'ok' && p.analysis && (p.legs[0].result.provider || 'brouter') === by); k++) await wait(200); return p.legs.length === 1 && p.legs[0].status === 'ok'; };
  p.setActive(true);
  p.setMode('auto');
  const A = [24.930, 60.170], B = [24.940, 60.170];
  p.addPoint(A);
  p.addPoint(B);
  if (!(await routed('brouter'))) return [`the BRouter leg: ${p.legs.map((l) => l.status).join(', ')}`];
  p.reveal('warnings');
  await wait(300);
  const all = await said();
  const priv = all.filter((t) => /Marked private in OpenStreetMap/.test(t));
  if (priv.length !== 1 || !/foot=private/.test(priv[0] || '')) errs.push(`foot=private on a Run leg: ${all.join(' / ') || 'no rows'}`);
  if (all.some((t) => /access=no|Private or no access/.test(t))) errs.push(`a footway open to walkers (access=no + foot=yes) got a row: ${all.join(' / ')}`);
  const w = (p.analysis.warnings || []).find((x) => /^Marked private/.test(x.text));
  if (!w || Math.abs(w.len - 185) > 25) errs.push(`the private stretch: ${w ? Math.round(w.len) : 'none'} m, not about 185 m`);
  // its card offers to correct the tag (25d part 3: what its ⋯ offered)
  const privCard = await cardOf(/Marked private/);
  if (!privCard) errs.push('no card for the private row');
  else if (![...privCard.querySelectorAll('.row')].some((r) => /Tagged wrong/.test(r.textContent))) errs.push('the private item\\'s card has no "Tagged wrong?"');
  await closeCard();
  // hidden before this fix, under the row's old text: still hidden
  localStorage.setItem('polku:hideWarn', JSON.stringify({ 'Private or no access': 'Private or no access' }));
  p.renderWarnings();
  if (rows().some((t) => /Marked private/.test(t))) errs.push('a row hidden as "Private or no access" shows again');
  localStorage.removeItem('polku:hideWarn');
  // Valhalla stands in: the map's tiles mark the middle of the leg access=no
  const realQuery = m.querySourceFeatures.bind(m);
  m.querySourceFeatures = (src, o) => (src === 'ofm' && o && /access/.test(JSON.stringify(o.filter || ''))
    ? [{ type: 'Feature', properties: { class: 'path', subclass: 'footway', access: 'no' }, geometry: { type: 'LineString', coordinates: [[24.9333, 60.1720], [24.9366, 60.1720]] } }]
    : realQuery(src, o));
  window.accessMode = 'valhalla';
  p.clear();
  p.addPoint([24.930, 60.172]); // not the same leg: the router keeps the one above
  p.addPoint([24.940, 60.172]);
  if (!(await routed('valhalla'))) errs.push(`the Valhalla leg: ${p.legs.map((l) => `${l.status} ${l.result && l.result.provider}`).join(', ')}`);
  p.reveal('warnings');
  await wait(300);
  const vh = rows().filter((t) => /Marked private or no access/.test(t));
  if (vh.length !== 1) errs.push(`Valhalla over a way the tiles mark access=no: ${rows().join(' / ') || 'no rows'}`);
  if (!(await said()).some((t) => /routed by Valhalla/.test(t) && /marked private/.test(t))) errs.push('the Valhalla row doesn\\'t say it may take ways marked private');
  m.querySourceFeatures = realQuery;
  p.clear();
  return errs;
})()"""


# Detours round ways marked private (#104), with a mocked BRouter and the map's tiles stubbed:
# both points are put on a private footway; the router starts and ends 55 m off it and goes
# round (444 m). Heads-up says the route goes round, how much a short cut would save, and that
# the start and finish were moved off it; the row draws the short cut on the map; the spots
# outlast Undo and a reload. Without the private way in the tiles, nothing is said. The map
# draws such ways in Run and MTB (not in Paddle). No routing call goes out.
DETOUR_ROUTER = """(() => {
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (!/^https:[/][/](brouter[.]de|valhalla1[.]openstreetmap[.]de)[/]/.test(url)) return real(input, init);
    if (/valhalla/.test(url)) return new Response('{}', { status: 503 });
    // from 55 m north of each point, round to the north (a straight footway joins the points)
    const [a, b] = new URL(url).searchParams.get('lonlats').split('|').map((q) => q.split(',').map(Number));
    const c = [[a[0], +(a[1] + 0.0005).toFixed(6)], [a[0], +(a[1] + 0.0015).toFixed(6)], [b[0], +(b[1] + 0.0015).toFixed(6)], [b[0], +(b[1] + 0.0005).toFixed(6)]];
    return new Response(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { messages: [] }, geometry: { type: 'LineString', coordinates: c } }] }));
  };
})()"""
DETOUR = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [], p = polku.planner, m = polku.map;
  p.checkWet = async () => {};
  p.wet = { on: false, mm: 0, at: Date.now() };
  const A = [24.930, 60.175], B = [24.934, 60.175];
  let closed = true;
  const realQuery = m.querySourceFeatures.bind(m);
  m.querySourceFeatures = (src, o) => (src === 'ofm' && o && /access/.test(JSON.stringify(o.filter || ''))
    ? (closed ? [{ type: 'Feature', properties: { class: 'path', subclass: 'footway', access: 'no' }, geometry: { type: 'LineString', coordinates: [A, B] } }] : [])
    : realQuery(src, o));
  const routed = async () => { for (let k = 0; k < 100 && !(p.legs.length === 1 && p.legs[0].status === 'ok' && p.analysis); k++) await wait(200); return p.legs.length === 1 && p.legs[0].status === 'ok'; };""" + CHECK_ROWS + """
  p.setActive(true);
  p.setMode('auto');
  p.addPoint(A.slice());
  p.addPoint(B.slice());
  if (!(await routed())) return [`the leg: ${p.legs.map((l) => l.status).join(', ')}`];
  await wait(300);
  p.reveal('warnings');
  await wait(300);
  const all = await said();
  const round = all.filter((t) => /Goes round a way marked private/.test(t));
  if (round.length !== 1) errs.push(`goes round: ${all.join(' / ') || 'no rows'}`);
  else {
    if (!/save about 3[23]0 m/.test(round[0])) errs.push(`the short cut's saving: ${round[0]}`);
    if (!/start was moved 5\\d m and the end 5\\d m off it/.test(round[0])) errs.push(`the moved points: ${round[0]}`); // (End, never Finish: #353)
  }
  if (all.some((t) => /moved .* off a way marked private/.test(t))) errs.push('a moved-point row as well as the short cut');
  // its card draws the short cut
  await cardOf(/Goes round/);
  for (let k = 0; k < 30 && !((m.getSource('accessCut') && (await m.getSource('accessCut').getData()).features.length)); k++) await wait(100);
  const src = m.getSource('accessCut'), cut = src ? await src.getData() : { features: [] };
  if (!cut.features.length || cut.features[0].geometry.coordinates.length < 2) errs.push('the short cut isn\\'t drawn');
  await closeCard();
  // the spots outlast Undo and a reload (the saved route)
  const spots = () => JSON.stringify(p.points.map((q) => (p.pspot && p.pspot.get(q)) || null));
  const want = JSON.stringify([A, B]);
  if (spots() !== want) errs.push(`the spots: ${spots()}`);
  p.addPoint([24.938, 60.175]);
  await wait(300);
  p.undo();
  await wait(300);
  if (spots() !== want) errs.push(`after Undo: ${spots()}`);
  p.save();
  p.legs = []; p.points = [];
  p.loadSaved();
  await wait(300);
  if (spots() !== want) errs.push(`after a reload: ${spots()}`);
  // the row's card open, Clear route takes the short cut, the stretch lit, its band in the profile and the card with
  // the route, and so does Undo back to one point (it stays while a card is open); Undo or Redo brings the route back
  // without them (#126). Clicked as a mouse would, so an error in the app is the console's (pg.errors()).
  const left = async (when) => {
    await wait(300);
    const n = async (s) => (await m.getSource(s).getData()).features.length, s = { cut: await n('accessCut'), lit: await n('routeLit'), band: !!p.focusHl, card: p.cards.current ? p.cards.current.kind : null };
    if (s.cut || s.lit || s.band || s.card) errs.push(`${when}: ${JSON.stringify(s)}`);
  };
  const clearBtn = async () => { // (on the toolbar, or in More)
    if (p.els.clearTool.offsetParent) return p.els.clearTool;
    p.els.more.click();
    await wait(300);
    return [...document.querySelectorAll('.menu-pop .menu-item')].find((b) => /^Clear route/.test(b.textContent.trim()));
  };
  for (const [how, press, back] of [['Clear route', clearBtn, p.els.undo], ['Undo back to one point', async () => p.els.undo, p.els.redo]]) {
    if (how !== 'Clear route') try { p.cards.close(); p.clear(); p.addPoint(A.slice()); p.addPoint(B.slice()); } catch (e) { errs.push(`before ${how}: ${e.message}`); break; }
    if (!(await routed())) { errs.push(`before ${how}: the leg`); break; }
    p.reveal('warnings');
    await wait(300);
    if (!(await cardOf(/Goes round/)) || !(await m.getSource('accessCut').getData()).features.length) { errs.push(`before ${how}: no card drawing the short cut`); break; }
    const b = await press();
    if (!b || !b.offsetParent || b.disabled) { errs.push(`no ${how} to press`); break; }
    b.click();
    await left(`after ${how} (${p.points.length} points)`);
    back.click();
    if (!(await routed())) { errs.push(`${back === p.els.undo ? 'Undo' : 'Redo'} after ${how}: the leg`); break; }
    await left(`${back === p.els.undo ? 'Undo' : 'Redo'} after ${how}`);
  }
  p.cards.close(); // (one left open by a failure above would be built again, with its item gone, by the steps below)
  // nothing marked in the tiles: nothing said (another leg, so the router asks again)
  closed = false;
  p.clear();
  p.addPoint([24.930, 60.180]);
  p.addPoint([24.934, 60.180]);
  if (!(await routed())) errs.push('the second leg');
  await wait(300);
  if (rows().some((t) => /private or closed/.test(t))) errs.push(`no private way, still a row: ${rows().join(' / ')}`);
  // the map draws ways marked private or closed on land, not on the water
  for (const [sport, want] of [['run', true], ['mtb', true], ['paddle', false]]) {
    polku.set({ activity: sport });
    await wait(500);
    if (!!m.getLayer('way-noaccess') !== want) errs.push(`${sport}: the private-ways layer ${want ? 'missing' : 'drawn'}`);
  }
  polku.set({ activity: 'run' });
  m.querySourceFeatures = realQuery;
  p.clear();
  return errs;
})()"""


def detour(chrome):
    pg = chrome.page(1440, 900, False)
    try:
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': DETOUR_ROUTER}, pg.s)
        pg.open_app({'activity': 'run'}, {'polku:plannerDock': '"left"'}, '#16/60.176/24.932')
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        fails = pg.js(DETOUR, timeout=60000)
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} detours round ways marked private" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Short cuts through ways marked private (#106), with a mocked BRouter and the map's tiles
# stubbed as in the detour check. When Polku's profile can't be uploaded, the leg keeps off
# and a toast says so. Then: the detour row's Short cut uploads Polku's profile once, routes the
# leg with allow_private=1 from the spots you picked, says so in Heads-up, and Undo puts the
# leg back. The style travels in share links (ps=…~a1), an old link keeps off, and round trips
# keep off. No routing call goes out.
SHORTCUT_ROUTER = """(() => {
  const real = window.fetch.bind(window), calls = (window.routerCalls = []);
  window.failUpload = false;
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (!/^https:[/][/](brouter[.]de|valhalla1[.]openstreetmap[.]de)[/]/.test(url)) return real(input, init);
    calls.push(url);
    if (/valhalla/.test(url)) return new Response('{}', { status: 503 });
    const prof = url.match(/[/]profile[/]([\\w-]+)/);
    if (prof) return new Response(window.failUpload ? '{"error":"not taken"}' : JSON.stringify({ profileid: prof[1] })); // an error, not an outage: no back-off
    const q = new URL(url).searchParams, [a, b] = q.get('lonlats').split('|').map((x) => x.split(',').map(Number));
    // allowed through: straight along the private footway; else round it to the north, 55 m off
    if (q.get('profile:allow_private') === '1') {
      const head = ['Longitude', 'Latitude', 'Elevation', 'Distance', 'CostPerKm', 'ElevCost', 'TurnCost', 'NodeCost', 'InitialCost', 'WayTags', 'NodeTags'];
      const messages = [head, [String(Math.round(b[0] * 1e6)), String(Math.round(b[1] * 1e6)), '0', '0', '0', '0', '0', '0', '0', 'highway=footway access=private', '']];
      return new Response(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { messages }, geometry: { type: 'LineString', coordinates: [a, b] } }] }));
    }
    const c = [[a[0], +(a[1] + 0.0005).toFixed(6)], [a[0], +(a[1] + 0.0015).toFixed(6)], [b[0], +(b[1] + 0.0015).toFixed(6)], [b[0], +(b[1] + 0.0005).toFixed(6)]];
    return new Response(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { messages: [] }, geometry: { type: 'LineString', coordinates: c } }] }));
  };
})()"""
SHORTCUT = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [], p = polku.planner, m = polku.map;
  const S = await import(location.origin + '/js/styles.js');
  const P = await import(location.origin + '/js/planner.js');
  p.checkWet = async () => {};
  p.wet = { on: false, mm: 0, at: Date.now() };
  const realQuery = m.querySourceFeatures.bind(m);
  const stub = (A, B) => { m.querySourceFeatures = (src, o) => (src === 'ofm' && o && /access/.test(JSON.stringify(o.filter || ''))
    ? [{ type: 'Feature', properties: { class: 'path', subclass: 'footway', access: 'no' }, geometry: { type: 'LineString', coordinates: [A, B] } }] : realQuery(src, o)); };
  const routed = async () => { for (let k = 0; k < 100; k++) { if (p.legs.length && p.legs.every((l) => l.status === 'ok') && p.analysis) return true; await wait(200); } return false; };
  const settle = async () => { await wait(900); return routed(); };
""" + CHECK_ROWS + """
  const toastSays = () => { const t = document.querySelector('#toast'); return t && !t.hidden ? t.textContent : ''; };
  const calls = (re) => window.routerCalls.filter((u) => re.test(u));
  p.setActive(true);
  p.setMode('auto');
  // the server won't take Polku's profile: the leg keeps off, and a toast says so
  window.failUpload = true;
  const A0 = [24.930, 60.185], B0 = [24.934, 60.185];
  stub(A0, B0);
  p.setStyle({ p: 'balanced', v: { a: 'cuts' }, wet: 'auto' });
  p.addPoint(A0.slice());
  p.addPoint(B0.slice());
  await settle();
  if (!/Short cuts through ways marked private aren.t available/.test(toastSays())) errs.push(`no note when the profile can't be uploaded (toast: ${toastSays() || 'none'})`);
  if (calls(/profile=hiking-mountain/).length < 1 || calls(/allow_private/).some((u) => /profile=hiking-mountain/.test(u))) errs.push('the fallback: not the stock profile without allow_private');
  window.failUpload = false;
  p.setStyle({ p: 'balanced', v: {}, wet: 'auto' });
  p.clear();
  await wait(300);
  // Short cut from Check (25d part 3: on the item's card, its one action)
  const A = [24.930, 60.175], B = [24.934, 60.175];
  stub(A, B);
  p.addPoint(A.slice());
  p.addPoint(B.slice());
  await settle();
  p.reveal('warnings');
  await wait(300);
  const btn = (await cardOf(/Goes round/))?.querySelector('.btn.primary.big');
  if (!btn || btn.textContent.trim() !== 'Short cut') return [...errs, `no Short cut on the card: ${rows().join(' / ')}`];
  const before = JSON.stringify(p.points);
  window.routerCalls.length = 0;
  btn.click();
  await settle();
  if (calls(/[/]profile[/]custom_polku-hike-1/).length !== 1) errs.push(`Polku's profile uploaded ${calls(/[/]profile[/]custom_polku-hike-1/).length} times`);
  const leg = calls(/profile=custom_polku-hike-1/).find((u) => /profile:allow_private=1/.test(u));
  if (!leg) errs.push(`no routing call with Polku's profile and allow_private=1: ${window.routerCalls.join(' ')}`);
  else if (!new URL(leg).searchParams.get('lonlats').startsWith(`${A[0].toFixed(6)},${A[1].toFixed(6)}`)) errs.push(`not from the spot you picked: ${new URL(leg).searchParams.get('lonlats')}`);
  if (JSON.stringify(p.points) !== JSON.stringify([A, B])) errs.push(`the points: ${JSON.stringify(p.points)}`);
  if (!S.shortCuts('run', p.legs[0].style)) errs.push(`the leg's style: ${JSON.stringify(p.legs[0].style)}`);
  p.reveal('warnings');
  await wait(300);
  const all = await said();
  if (!all.some((t) => /Marked private in OpenStreetMap/.test(t) && /you allowed short cuts on this leg/.test(t))) errs.push(`Check on the short cut: ${all.join(' / ')}`);
  if (rows().some((t) => /Goes round/.test(t))) errs.push('still "Goes round" with short cuts allowed');
  // the share link carries it; an old link without it keeps off
  const q = new URL(p.shareUrl()).searchParams;
  if (!/~a1/.test(q.get('ps') || '')) errs.push(`the share link: ps=${q.get('ps')}`);
  const back = P.parseShared(q);
  if (!back || !/~a1/.test(back.legStyles || '')) errs.push(`from the link: ${back && back.legStyles}`);
  q.delete('ps');
  const old = P.parseShared(q);
  if (old && old.legStyles) errs.push(`an old link: ${old.legStyles}`);
  // Undo: the points where the router had moved them, the leg as it was
  p.undo();
  await settle();
  if (JSON.stringify(p.points) === JSON.stringify([A, B]) || JSON.stringify(p.points) !== before) errs.push(`after Undo: ${JSON.stringify(p.points)}, not ${before}`);
  if (p.legs[0].style) errs.push(`after Undo the leg's style: ${JSON.stringify(p.legs[0].style)}`);
  // round trips keep off; no preset sets short cuts
  if (S.routerOf('run', S.keepOff({ p: 'balanced', v: { a: 'cuts' } })).profile) errs.push('keepOff');
  for (const sp of ['mtb', 'gravel', 'road', 'hike', 'trailrun', 'run']) {
    for (const [k] of S.STYLES[sp].presets) if (S.shortCuts(sp, { p: k, v: {} })) errs.push(`${sp} preset ${k} sets short cuts`);
    if (!S.STYLES[sp].controls.some((c) => c.id === 'a')) errs.push(`${sp}: no "Ways marked private"`);
  }
  m.querySourceFeatures = realQuery;
  p.clear();
  return errs;
})()"""


def shortcut(chrome):
    pg = chrome.page(1440, 900, False)
    try:
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': SHORTCUT_ROUTER}, pg.s)
        pg.open_app({'activity': 'run'}, {'polku:plannerDock': '"left"'}, '#16/60.176/24.932')
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        fails = pg.js(SHORTCUT, timeout=90000)
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} short cuts through ways marked private" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Other ways for a new leg (#95), from a mocked BRouter: alternative 1 goes 450 m north, 2 is
# within 5 m of the first (left out), or 450 m south. Once you stop adding points for a moment,
# a new leg gets alternative 1 (one call, with room under the pacing), and alternative 2 a while
# later. A tap on the map takes one without routing again, and the way you had stays as a ghost
# to go back to; it's kept in the share link (al=0:1), a reload and Undo, and goes when the
# leg's style changes. Points added quickly get none until the last; a short leg gets none;
# with no room, none; the leg's menu has Other ways, two of them. No routing call goes out.
OTHERWAYS_ROUTER = """(() => {
  const real = window.fetch.bind(window), calls = (window.routerCalls = []);
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (!/^https:[/][/](brouter[.]de|valhalla1[.]openstreetmap[.]de)[/]/.test(url)) return real(input, init);
    calls.push(url);
    if (/valhalla/.test(url)) return new Response('{}', { status: 503 });
    const q = new URL(url).searchParams, k = +q.get('alternativeidx') || 0;
    const ll = q.get('lonlats').split('|').map((x) => x.split(',').map(Number)), c = [];
    ll.forEach((p, i) => {
      if (i) {
        const a = ll[i - 1], dy = k === 1 ? 0.004 : k === 2 ? (window.alt2Far ? -0.004 : 0.00004) : 0;
        for (const t of [0.25, 0.5, 0.75]) c.push([+(a[0] + (p[0] - a[0]) * t).toFixed(6), +(a[1] + (p[1] - a[1]) * t + dy).toFixed(6)]);
      }
      c.push(p);
    });
    return new Response(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { messages: [] }, geometry: { type: 'LineString', coordinates: c } }] }));
  };
})()"""
OTHERWAYS = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [], p = polku.planner, m = polku.map;
  const P = await import(location.origin + '/js/planner.js');
  p.checkWet = async () => {};
  p.wet = { on: false, mm: 0, at: Date.now() };
  const routed = async () => { for (let k = 0; k < 100; k++) { if (p.legs.length && p.legs.every((l) => l.status === 'ok') && p.analysis) return true; await wait(200); } return false; };
  const calls = (k) => window.routerCalls.filter((u) => /lonlats=/.test(u) && new URL(u).searchParams.get('alternativeidx') === String(k)).length;
  p.setActive(true);
  p.setMode('auto');
  const A = [24.930, 60.170], B = [24.950, 60.170];
  p.addPoint(A.slice());
  p.addPoint(B.slice());
  await routed();
  for (let k = 0; k < 40 && !(p.alts && p.alts.ways.length); k++) await wait(200);
  if (calls(1) !== 1 || calls(2) !== 0) errs.push(`other ways asked for at first: alternative 1 ×${calls(1)}, 2 ×${calls(2)} (alternative 1)`);
  const ways = p.alts ? p.alts.ways : [];
  if (ways.length !== 1 || ways[0].k !== 1) return [...errs, `ways offered: ${JSON.stringify(ways.map((w) => ({ k: w.k, label: w.label })))}`];
  const data = await m.getSource('routeAlts').getData();
  if (data.features.length < 2) errs.push('the other way isn\\'t drawn');
  if (!/^Other way\\n[+]\\d+ m/.test(ways[0].label)) errs.push(`its label: ${ways[0].label}`);
  // a while later, alternative 2: asked for once, and left out (within 5 m of the leg)
  for (let k = 0; k < 40 && !calls(2); k++) await wait(200);
  await wait(300);
  if (calls(2) !== 1 || p.alts.ways.length !== 1) errs.push(`a while later: alternative 2 ×${calls(2)}, ${p.alts.ways.length} ways (one: 2 is too close)`);
  // a tap on it takes it, with no routing call
  const part = ways[0].parts[0], mid = part[Math.floor(part.length / 2)], pt = m.project(mid);
  const before = window.routerCalls.length;
  p.onMapClick({ point: pt, lngLat: { lng: mid[0], lat: mid[1] } });
  await wait(600);
  await routed();
  if (p.legs[0].alt !== 1 || !/[|]alt1$/.test(p.legs[0].key)) errs.push(`after the tap: alt ${p.legs[0].alt}, key …${(p.legs[0].key || '').slice(-8)}`);
  if (window.routerCalls.length !== before) errs.push(`${window.routerCalls.length - before} routing calls for a way already in`);
  const north = () => Math.max(...p.legs[0].result.coords.map((c) => c[1])) - A[1]; // the other way: 0.004° north
  if (Math.abs(north() - 0.004) > 0.0005) errs.push('the route isn\\'t the other way');
  // the way you had stays as a ghost: a tap goes back to it, and the other way is a ghost then
  const ghost = () => (p.alts ? p.alts.ways.map((w) => `${w.k}:${w.label.split('\\n')[0]}`).join(' ') : 'none');
  if (ghost() !== '0:Way before') errs.push(`after taking the other way, the ghosts: ${ghost()}`);
  p.pickAlt(0);
  await wait(300);
  if (p.legs[0].alt || Math.abs(north()) > 0.0005 || ghost() !== '1:Way before') errs.push(`back to the way before: alt ${p.legs[0].alt}, ghosts ${ghost()}`);
  p.pickAlt(0);
  await wait(300);
  if (p.legs[0].alt !== 1 || window.routerCalls.length !== before) errs.push(`and again: alt ${p.legs[0].alt}, ${window.routerCalls.length - before} calls`);
  // a click away from the ghost adds the next point, and the ghost goes
  p.addPoint([24.960, 60.170]);
  await routed();
  if (p.alts && p.alts.li === 0) errs.push('the ghost stayed after the next point');
  p.undo();
  await routed();
  // the share link, a reload, Undo
  const q = new URL(p.shareUrl()).searchParams;
  if (q.get('al') !== '0:1') errs.push(`share link: al=${q.get('al')}`);
  const back = P.parseShared(q);
  if (!back || JSON.stringify(back.alts) !== '[[0,1]]') errs.push(`from the link: ${back && JSON.stringify(back.alts)}`);
  q.delete('al');
  if ((P.parseShared(q).alts || []).length) errs.push('a link without al= has other ways');
  const kept = window.routerCalls.length;
  p.save();
  p.legs = []; p.points = [];
  p.loadSaved();
  await routed();
  if (p.legs[0].alt !== 1 || window.routerCalls.length !== kept) errs.push(`after a reload: alt ${p.legs[0].alt}, ${window.routerCalls.length - kept} calls`);
  p.undo();
  await routed();
  if (p.legs[0] && p.legs[0].alt) errs.push(`after Undo: alt ${p.legs[0].alt}`);
  p.redo();
  await routed();
  if (!p.legs[0] || p.legs[0].alt !== 1) errs.push(`after Redo: alt ${p.legs[0] && p.legs[0].alt}`);
  // another style for the leg: the first way of the new style
  const c0 = calls(0);
  p.setStyle({ p: 'balanced', v: { c: 'fewer' }, wet: 'auto' }, 0);
  await wait(1000);
  await routed();
  if (p.legs[0].alt || calls(0) !== c0 + 1) errs.push(`after a style change: alt ${p.legs[0].alt}, ${calls(0) - c0} first-way calls`);
  // opened from the link, the leg takes alternative 1 (the router has it already: no call)
  p.clear();
  p.restore(back);
  await wait(600);
  await routed();
  if (p.legs[0].alt !== 1 || Math.abs(north() - 0.004) > 0.0005) errs.push(`from the link: alt ${p.legs[0].alt}, ${north().toFixed(4)}° north`);
  p.clear();
  return errs;
})()"""
# #214: start both timers in the same turn. Polling for the routed leg and then
# waiting 800 ms could add the third point after the app's 1500 ms offer timer
# on a busy renderer. Even if both timers are overdue, the edit must run first.
# Run with and without a blocked main thread; OTHERWAYS above checks a real pause.
OTHERWAYS_QUICK = """(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)), errs = [], p = polku.planner;
  const others = () => window.routerCalls.filter(u => /lonlats=/.test(u) && new URL(u).searchParams.get('alternativeidx') !== '0');
  p.checkWet = async () => {};
  p.wet = { on: false, mm: 0, at: Date.now() };
  p.setActive(true);
  p.setMode('auto');
  window.alt2Far = true;
  const offerSoon = p.offerAltsSoon;
  let thirdTimer, armed = false, added = false, beforeThird = null;
  p.offerAltsSoon = function (li) {
    if (li !== 0 || armed) return offerSoon.call(this, li);
    armed = true;
    thirdTimer = setTimeout(() => {
      beforeThird = others().length;
      p.addPoint([24.970, 60.170]);
      added = true;
    }, 800);
    const result = offerSoon.call(this, li);
    // Model a slow software-rendered frame, longer than both timers. This is
    // deliberately synchronous: it must delay the edit and the app equally.
    const until = performance.now() + __STALL_MS__;
    while (performance.now() < until) {}
    return result;
  };
  try {
    p.addPoint([24.930, 60.170]);
    p.addPoint([24.950, 60.170]);
    const deadline = performance.now() + 15000;
    while (!(added && p.alts?.li === 1 && p.alts.ways.length) && performance.now() < deadline) await wait(50);
    if (!armed || !added) errs.push('quick points: the routed first leg did not schedule the third point');
    if (beforeThird !== 0) errs.push(`quick points: ${beforeThird} alternatives requested before the third point (none)`);
    const calls = others();
    if (calls.length !== 1 || !p.alts || p.alts.li !== 1 || p.alts.ways.length !== 1) errs.push(`points added quickly: ${calls.length} calls for other ways, offered for leg ${p.alts ? p.alts.li : 'none'} (one, for the last leg)`);
    if (calls.length === 1 && new URL(calls[0]).searchParams.get('lonlats') !== '24.950000,60.170000|24.970000,60.170000') errs.push('quick points: the alternative request was for the previous leg');
  } finally {
    p.offerAltsSoon = offerSoon;
    clearTimeout(thirdTimer);
    p.clear();
  }
  return errs;
})()"""

# A short leg gets none; with no room under the pacing (four calls in the last
# 10 s) none; the leg's menu has Other ways, two of them.
OTHERWAYS_BUSY = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [], p = polku.planner;
  const n = await import(location.origin + '/js/net.js');
  p.checkWet = async () => {};
  p.wet = { on: false, mm: 0, at: Date.now() };
  const routed = async () => { for (let k = 0; k < 100; k++) { if (p.legs.length && p.legs.every((l) => l.status === 'ok') && p.analysis) return true; await wait(200); } return false; };
  const others = () => window.routerCalls.filter((u) => /lonlats=/.test(u) && new URL(u).searchParams.get('alternativeidx') !== '0').length;
  p.setActive(true);
  p.setMode('auto');
  window.alt2Far = true;
  // a short leg (about 110 m): none on its own, then or later
  p.clear();
  let o = others();
  p.addPoint([24.930, 60.180]);
  p.addPoint([24.932, 60.180]);
  await routed();
  await wait(8000);
  if (others() !== o || p.alts) errs.push(`a short leg: ${others() - o} calls for other ways`);
  // no room under the pacing (four calls in the last 10 s): none, then or later
  await wait(10500); // the 10 s window clears
  for (let k = 0; k < 3; k++) await n.request('brouter', `https://brouter.de/brouter?lonlats=24.9,60.1|24.91,60.1${k}&profile=hiking-mountain&alternativeidx=0&format=geojson`);
  p.clear();
  o = others();
  p.addPoint([24.930, 60.190]);
  p.addPoint([24.950, 60.190]);
  await routed();
  await wait(7500);
  if (others() !== o || (p.alts && p.alts.ways.length)) errs.push(`other ways fetched with no room: ${others() - o} calls`);
  // the route's card, Edit this stretch: Other ways, both alternatives (they wait their turn)
  o = others();
  p.openRouteCard(0, [24.94, 60.19]);
  await wait(200);
  const row = (re) => [...document.querySelectorAll('.pl-way.card .row')].find((b) => re.test(b.textContent));
  row(/Edit this stretch/)?.click();
  await wait(200);
  const btn = row(/Other ways/);
  if (!btn) return [...errs, 'no Other ways in Edit this stretch'];
  btn.click();
  for (let k = 0; k < 120 && !(p.alts && p.alts.ways.length > 1); k++) await wait(200);
  if (!p.alts || p.alts.ways.length !== 2) errs.push(`Other ways from the menu: ${p.alts ? p.alts.ways.length : 'none'} offered (two), ${others() - o} calls`);
  p.clear();
  return errs;
})()"""

# #211: taking your time (10 s or more since the point before, the pacing quiet), both other
# ways come together a moment after the leg is in (not 5 s apart, and not after the terrain);
# they're drawn under the route, the route's leg gets a label in the same form, and the way
# under the pointer lights up; with your own routing server, both after half a second
OTHERWAYS_CALM = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [], p = polku.planner, m = polku.map;
  p.checkWet = async () => {};
  p.wet = { on: false, mm: 0, at: Date.now() };
  const calls = (k) => window.routerCalls.filter((u) => /lonlats=/.test(u) && new URL(u).searchParams.get('alternativeidx') === String(k)).length;
  const legIn = async () => { for (let k = 0; k < 100 && !(p.legs.length && p.legs.every((l) => l.status === 'ok')); k++) await wait(50); };
  // how long until both ways show, and how much of that the page was too busy to run its timers
  // (a frame can take a second on GitHub's runner, #268)
  let late = 0;
  const both = async () => { const t = performance.now(); late = 0; for (let k = 0; k < 160 && !(p.alts && p.alts.ways.length >= 2); k++) { const a = performance.now(); await wait(50); late += Math.max(0, performance.now() - a - 60); } return performance.now() - t; };
  window.alt2Far = true;
  p.setActive(true);
  p.setMode('auto');
  p.addPoint([24.930, 60.170]);
  await wait(10200); // taking your time
  p.addPoint([24.950, 60.170]);
  await legIn();
  let took = await both();
  if (calls(1) !== 1 || calls(2) !== 1 || took > 3500) errs.push(`taking your time: alternative 1 ×${calls(1)}, 2 ×${calls(2)}, both shown ${Math.round(took)} ms after the leg (together, within 3.5 s)`);
  if (!p.alts || p.alts.ways.length !== 2) return [...errs, `ways offered: ${p.alts ? p.alts.ways.length : 'none'}`];
  const ids = m.getStyle().layers.map((l) => l.id);
  if (!(ids.indexOf('route-alts-line') < ids.indexOf('route-casing'))) errs.push('the other ways are drawn over the route');
  const data = await m.getSource('routeAlts').getData(), own = data.features.find((f) => f.properties.route);
  if (!own || !/^This way\\n(\\d+ % trails|all on trails)$/.test(own.properties.label)) errs.push(`the route's own label: ${own && JSON.stringify(own.properties.label)}`);
  // the way under the pointer lights up, and goes back when the pointer leaves it
  const w = p.alts.ways[0], c = w.parts[0][Math.floor(w.parts[0].length / 2)];
  m.jumpTo({ center: c, zoom: 14 });
  await new Promise((ok) => { const t = setTimeout(ok, 5000); m.once('idle', () => { clearTimeout(t); ok(); }); });
  const at = (ll) => { const q = m.project(ll); p.onMapMove({ point: q, lngLat: { lng: ll[0], lat: ll[1] }, originalEvent: { clientX: q.x, clientY: q.y } }); };
  at(c);
  if (!(m.getFeatureState({ source: 'routeAlts', id: 0 }) || {}).hover) errs.push('the way under the pointer doesn\\'t light up');
  at([c[0] + 0.004, c[1] + 0.003]);
  if ((m.getFeatureState({ source: 'routeAlts', id: 0 }) || {}).hover) errs.push('the way stays lit after the pointer leaves it');
  // your own routing server: both, half a second after the leg is in, even while you sketch
  localStorage.setItem('polku:brouterUrl', JSON.stringify('https://brouter.de/own'));
  const c1 = calls(1), c2 = calls(2);
  p.addPoint([24.960, 60.175]);
  await legIn();
  took = await both();
  if (calls(1) !== c1 + 1 || calls(2) !== c2 + 1 || took - late > 1500) errs.push(`your own server: alternative 1 ×${calls(1) - c1}, 2 ×${calls(2) - c2}, both shown ${Math.round(took)} ms after the leg, ${Math.round(late)} ms of it too busy for timers (within 1.5 s)`);
  localStorage.removeItem('polku:brouterUrl');
  p.clear();
  return errs;
})()"""


# #351: a point added and taken back by Undo before its leg is in, at once or while the leg is still being routed: no
# error from the other ways' timer, no other ways asked for the leg that's gone, and the route as it was
OTHERWAYS_UNDO = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [], p = polku.planner;
  p.checkWet = async () => {};
  p.wet = { on: false, mm: 0, at: Date.now() };
  const routed = async () => { for (let k = 0; k < 100; k++) { if (p.legs.length && p.legs.every((l) => l.status === 'ok') && p.analysis) return true; await wait(200); } return false; };
  const others = () => window.routerCalls.filter((u) => /lonlats=/.test(u) && new URL(u).searchParams.get('alternativeidx') !== '0').length;
  const route = () => JSON.stringify({ points: p.points, legs: p.legs.map((l) => [l.key, l.status, l.result && l.result.coords.length]) });
  p.setActive(true);
  p.setMode('auto');
  p.addPoint([24.930, 60.170]);
  p.addPoint([24.950, 60.170]);
  await routed();
  for (let k = 0; k < 40 && !(p.alts && p.alts.ways.length); k++) await wait(200); // (the first leg's other way is in)
  // at once: the point and the toolbar's Undo in the same turn
  let before = route(), o = others();
  p.addPoint([24.970, 60.170]);
  p.els.undo.click();
  await wait(2500); // (past the other ways' 1.5 s after the Undo: a timer set after it runs after it)
  await routed();
  if (route() !== before) errs.push(`Undo at once: the route ${route()}, not ${before}`);
  if (others() !== o) errs.push(`Undo at once: ${others() - o} calls for other ways`);
  // while the new leg is routed: Undo before BRouter answers (another point, so no answer is kept for its leg)
  const mock = window.fetch;
  let asked = 0, answer;
  const held = new Promise((r) => { answer = r; });
  window.fetch = async (u, init) => { if (/^https:[/][/]brouter[.]de[/].*24[.]970000,60[.]175000/.test(String(u && u.url ? u.url : u))) { asked++; await held; } return mock(u, init); };
  try {
    before = route(); o = others();
    p.addPoint([24.970, 60.175]);
    for (let k = 0; k < 160 && !asked; k++) await wait(50); // (it may wait its turn under the pacing)
    if (!asked) errs.push('the new leg wasn’t asked for');
    p.els.undo.click();
    await wait(2500);
    answer();
    await wait(300);
    await routed();
    if (route() !== before) errs.push(`Undo while routed: the route ${route()}, not ${before}`);
    if (others() !== o) errs.push(`Undo while routed: ${others() - o} calls for other ways`);
  } finally {
    window.fetch = mock;
    answer();
  }
  p.clear();
  return errs;
})()"""


def otherways(chrome):
    fails = []
    cases = [('pause and picking', OTHERWAYS, 90000),
             ('quick points', OTHERWAYS_QUICK.replace('__STALL_MS__', '0'), 45000),
             ('quick points, blocked main thread', OTHERWAYS_QUICK.replace('__STALL_MS__', '2200'), 45000),
             ('short legs and pacing', OTHERWAYS_BUSY, 120000),
             ('taking your time', OTHERWAYS_CALM, 90000),
             ('a point taken back at once', OTHERWAYS_UNDO, 45000)]
    for label, script, timeout in cases:
        pg = chrome.page(1440, 900, False)
        try:
            pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': OTHERWAYS_ROUTER}, pg.s)
            pg.open_app({'activity': 'run'}, {'polku:plannerDock': '"left"'}, '#14/60.171/24.94')
            pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
            fails += [f'{label}: {e}' for e in pg.js(script, timeout=timeout)]
            fails += [f'{label}: console: {e[:160]}' for e in pg.errors()]
        finally:
            pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} other ways for a new leg" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# The route's glow and moving chevrons (#198), on a straight-line route (no routing): the
# chevrons draw and move (frames go on, no WebGL error), the static arrows give way while they
# do, and both survive a style change; the leg under the pointer glows brighter, and stops when
# the pointer leaves; with reduced motion, the switch off, or the map left alone a while, the
# chevrons stop and the arrows come back; a touch of the map starts them again.
FLOW = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [], p = polku.planner, m = polku.map, f = polku.flow;
  if (!f) return ['no moving chevrons (polku.flow)'];
  p.checkWet = async () => {};
  p.wet = { on: false, mm: 0, at: Date.now() };
  p.setActive(true);
  p.setMode('line');
  p.addPoint([24.930, 60.170]);
  p.addPoint([24.940, 60.172]);
  await wait(1500);
  m.jumpTo({ center: [24.935, 60.171], zoom: 15 });
  await new Promise((ok) => { const t = setTimeout(ok, 5000); m.once('idle', () => { clearTimeout(t); ok(); }); });
  if (!m.getLayer('route-glow') || !m.getLayer('route-glow-hover')) errs.push('no glow layers');
  const arrows = () => m.getLayoutProperty('route-arrows', 'visibility');
  // four frames more: in 1.5 s here, but a runner that draws in software can take a second a frame
  const moves = async () => { const f0 = f.frames, t0 = Date.now(); while (Date.now() - t0 < 8000) { await wait(250); if (f.frames > f0 + 3) return true; } return false; };
  if (!m.getLayer('route-flow') || !f.moving || !(await moves())) errs.push(`chevrons: layer ${!!m.getLayer('route-flow')}, moving ${f.moving}, frames ${f.frames}`);
  if (arrows() !== 'none') errs.push(`the static arrows show while the chevrons move: ${arrows()}`);
  const gl = m.painter && m.painter.context && m.painter.context.gl;
  if (gl && gl.getError()) errs.push('a WebGL error');
  // a style change (another base map)
  polku.set({ base: polku.state.base === 'trail' ? 'topo' : 'trail' });
  await wait(2000);
  if (!m.getLayer('route-flow') || !f.moving || arrows() !== 'none' || !(await moves())) errs.push(`after a style change: layer ${!!m.getLayer('route-flow')}, moving ${f.moving}, arrows ${arrows()}`);
  // the leg under the pointer glows brighter
  const c = [24.935, 60.171], pt = m.project(c);
  p.onMapMove({ point: pt, lngLat: { lng: c[0], lat: c[1] }, originalEvent: { clientX: pt.x, clientY: pt.y } });
  if (!(m.getFeatureState({ source: 'route', id: 0 }) || {}).hover) errs.push('the leg under the pointer doesn\\'t glow');
  const away = m.project([24.950, 60.180]);
  p.onMapMove({ point: away, lngLat: { lng: 24.95, lat: 60.18 }, originalEvent: { clientX: away.x, clientY: away.y } });
  if ((m.getFeatureState({ source: 'route', id: 0 }) || {}).hover) errs.push('the glow stays after the pointer leaves');
  // from the route straight off the map (onto the planner): the glow goes too
  p.onMapMove({ point: pt, lngLat: { lng: c[0], lat: c[1] }, originalEvent: { clientX: pt.x, clientY: pt.y } });
  m.getCanvasContainer().dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.querySelector('#planner') }));
  if ((m.getFeatureState({ source: 'route', id: 0 }) || {}).hover) errs.push('the glow stays after the pointer leaves the map');
  // the switch off; the map left alone a while; a touch
  polku.set({ routeFlow: false });
  f.check();
  if (f.moving || arrows() !== 'visible') errs.push(`switched off: moving ${f.moving}, arrows ${arrows()}`);
  polku.set({ routeFlow: true });
  f.touched = Date.now() - 60e3;
  f.check();
  if (f.moving || arrows() !== 'visible') errs.push(`left alone: moving ${f.moving}, arrows ${arrows()}`);
  m.fire('movestart');
  if (!f.moving || arrows() !== 'none') errs.push(`after a touch: moving ${f.moving}, arrows ${arrows()}`);
  return errs;
})()"""
FLOW_REDUCED = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), f = polku.flow, m = polku.map;
  if (!f) return [];
  await wait(300);
  f.touched = Date.now();
  f.check();
  const out = (f.moving || m.getLayoutProperty('route-arrows', 'visibility') !== 'visible') ? [`with reduced motion: moving ${f.moving}`] : [];
  polku.planner.clear();
  return out;
})()"""


def flow(chrome):
    pg = chrome.page(1440, 900, False)
    try:
        # headless Chrome asks for reduced motion; a person usually doesn't
        pg.c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'no-preference'}]}, pg.s)
        pg.open_app({'activity': 'run'}, {'polku:plannerDock': '"left"'}, '#15/60.171/24.935')
        fails = pg.js(FLOW, timeout=60000)
        pg.c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce'}]}, pg.s)
        fails += pg.js(FLOW_REDUCED, timeout=30000)
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the route's glow and moving chevrons" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


def access(chrome):
    pg = chrome.page(1440, 900, False)
    try:
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': ACCESS_ROUTER}, pg.s)
        pg.open_app({'activity': 'run'}, {'polku:plannerDock': '"left"'}, '#15/60.170/24.935')
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        fails = pg.js(ACCESS, timeout=60000)
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} ways marked private or closed" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Check in three groups (25d part 2, #233): every Heads-up item says how serious it is (tier: 'read', Read before you
# go, or 'look', Worth a look) and where it comes from (src: live, from the map, an estimate, calculated, the router),
# set where it's made. Each maker of the plan's table is fed the smallest input that makes its items, without the
# network: analysis.js's runs and access rows, the trail details, Fintraffic's road works, incidents, road weather and
# counts (seeded, and its failure), the dark, the water's events, winter, the ice and the stops (each with a stand-in
# planner of its own).
HEADS = """(async () => {
  const errs = [], A = await import(location.origin + '/js/analysis.js'), SUN = await import(location.origin + '/js/sun.js');
  const p = polku.planner, n = 60, along = Float32Array.from({ length: n }, (_, i) => i * 10);
  const pts = Array.from({ length: n }, (_, i) => [23.80 + i * 0.00019, 61.50]);
  // one stretch of samples [i0, i1) with these tags (and mode), the rest plain
  const attrs = (sport, runs) => Array.from({ length: n }, (_, i) => { const r = runs.find(([i0, i1]) => i >= i0 && i < i1); return { sport, tags: r ? r[2] : { highway: 'track' }, ...(r && r[3] ? { mode: r[3] } : {}) }; });
  const flat = new Float32Array(n);
  // expect: [text's start, tier, src.kind, src.by] for each item a maker made
  const expect = (what, items, want) => {
    for (const [re, tier, kind, by] of want) {
      const w = items.find((x) => re.test(x.text));
      if (!w) { errs.push(`${what}: no item ${re} in ${items.map((x) => x.text).join(' / ')}`); continue; }
      if (w.tier !== tier || !w.src || w.src.kind !== kind || w.src.by !== by) errs.push(`${what}: ${w.text}: ${w.tier}, ${JSON.stringify(w.src)}, not ${tier}, ${kind} · ${by}`);
    }
    for (const w of items) if (!(w.tier === 'read' || w.tier === 'look') || !w.src || !w.src.by) errs.push(`${what}: ${w.text} has no group or source`);
  };
  // analysis.js: bike runs, then foot runs, then the rest
  const bike = A.findWarnings(along, flat, attrs('mtb', [[0, 6, { highway: 'steps' }], [10, 16, { highway: 'path', bicycle: 'no' }], [20, 26, { highway: 'path', 'mtb:scale': '3' }], [30, 50, { highway: 'track', portage: 'yes' }], [50, 56, { route: 'ferry' }]]), pts, 'mtb');
  expect('findWarnings, MTB', bike, [[/^Steps/, 'look', 'map', 'OpenStreetMap'], [/^Cycling not allowed/, 'read', 'map', 'OpenStreetMap'], [/^Technical trail S3/, 'look', 'map', 'OpenStreetMap'], [/^Carry/, 'look', 'map', 'OpenStreetMap'], [/^Ferry/, 'look', 'map', 'OpenStreetMap']]);
  const steep = Float32Array.from({ length: n }, (_, i) => (i < 20 ? 20 : i < 40 ? -25 : 0));
  expect('findWarnings, steep', A.findWarnings(along, steep, attrs('mtb', []), pts, 'mtb'), [[/^Steep climb/, 'look', 'estimate', 'the terrain model'], [/^Steep descent/, 'look', 'estimate', 'the terrain model']]);
  expect('findWarnings, hike', A.findWarnings(along, Float32Array.from({ length: n }, (_, i) => (i < 20 ? 30 : 0)), attrs('hike', [[30, 40, { highway: 'path', sac_scale: 'alpine_hiking' }], [40, 60, { highway: 'path', access: 'no' }]]), pts, 'hike'),
    [[/^Very steep/, 'look', 'estimate', 'the terrain model'], [/^Alpine terrain/, 'read', 'map', 'OpenStreetMap'], [/^Marked no access/, 'read', 'map', 'OpenStreetMap']]);
  expect('findWarnings, road', A.findWarnings(along, flat, attrs('road', [[0, 20, { highway: 'track', surface: 'gravel' }], [20, 40, { highway: 'path', foot: 'no', access: 'private' }], [40, 60, {}, 'line']]), pts, 'road'),
    [[/^Unpaved/, 'look', 'map', 'OpenStreetMap'], [/^Marked private/, 'look', 'map', 'OpenStreetMap'], [/^Straight line/, 'look', 'calculated', 'how you drew it']]);
  expect('findWarnings, on foot', A.findWarnings(along, flat, attrs('hike', [[0, 20, { highway: 'path', foot: 'no' }]]), pts, 'hike'), [[/^Marked no walking/, 'read', 'map', 'OpenStreetMap']]);
  // the trail details (from the router's tags here)
  const td = { trail: new Uint8Array(n).fill(1), width: new Int8Array(n).fill(-1), vis: new Int8Array(n).fill(-1), veg: new Uint8Array(n), mud: new Uint8Array(n), tree: new Uint8Array(n), ford: new Uint8Array(n), boardwalk: new Uint8Array(n), points: [{ i: 50, at: 500, ll: pts[50], kind: 'barrier', barrier: 'fence' }] };
  for (let i = 0; i < 12; i++) { td.vis[i] = 2; td.veg[i + 12] = 1; td.mud[i + 24] = 1; }
  td.tree[40] = 1; td.ford[45] = 1;
  expect('trailWarnings', A.trailWarnings({ along, pts, td, attr: attrs('mtb', []) }, { activity: 'mtb' }),
    [[/^Hard to follow/, 'look', 'map', 'OpenStreetMap'], [/^Overgrown/, 'look', 'map', 'OpenStreetMap'], [/^Wet or muddy/, 'look', 'map', 'OpenStreetMap'], [/^Fallen trees/, 'look', 'map', 'OpenStreetMap'], [/^Ford/, 'look', 'map', 'OpenStreetMap']]);
  // Fintraffic: its caches seeded for the route's box, so nothing is fetched
  const S = polku.safety, road = { highway: 'primary' }, line = (c) => ({ type: 'LineString', coordinates: c });
  const ra = { pts, along, attr: pts.map(() => ({ sport: 'mtb', tags: road })), tAt: new Float32Array(n), activity: 'mtb' };
  const box = [pts[0][0], 61.5, pts[n - 1][0], 61.5], now = Date.now();
  const mid = [pts[10], pts[20]], end = [pts[30], pts[40]];
  S.incidents = { t: now - 60000, feats: [{ type: 'Feature', properties: { kind: 'incident', id: 'i1', title: 'Accident on the road' }, geometry: line(mid) }] };
  for (const [x, y] of S.tilesFor(box, 8, 6)) { S.roadworkTiles.set(`${x}/${y}`, [{ type: 'Feature', properties: { kind: 'roadwork', id: 'w1', title: 'Teiskontie', details: '', start: '', end: '', phases: '[]' }, geometry: line(end) }]); S.roadworkTime.set(`${x}/${y}`, now - 120000); }
  for (const [x, y] of S.tilesFor(box, 11, 24)) S.aadtTiles.set(`${x}/${y}`, [{ type: 'Feature', properties: { kind: 'aadt', aadt: 9000 }, geometry: line([pts[0], pts[n - 1]]) }]);
  S.roadcond = { t: now };
  const cond = S.roadcondFeatures;
  S.roadcondFeatures = () => [{ type: 'Feature', properties: { id: 'c1', label: 'Slippery', reasons: 'ice', roadTemp: -2 }, geometry: line(mid) }];
  try {
    const hz = await S.hazardsAlong(ra, { activity: 'mtb', startSec: now / 1000 });
    expect('hazardsAlong', hz, [[/^Road works/, 'read', 'live', 'Fintraffic'], [/^Traffic incident/, 'read', 'live', 'Fintraffic'], [/^Slippery/, 'read', 'estimate', 'Fintraffic’s road weather'], [/^Busy road/, 'look', 'estimate', 'Fintraffic’s yearly counts']]);
    const w = hz.find((x) => /^Road works/.test(x.text));
    if (w && w.src.at !== now - 120000) errs.push(`road works' time: ${w.src.at}, not when its tile answered (${now - 120000})`);
    // no answer: not checked, never an empty list
    const inc = S.loadIncidents;
    S.incidents = null; S.loadIncidents = async () => {};
    let threw = null;
    try { await S.hazardsAlong(ra, { activity: 'mtb', startSec: now / 1000 }); } catch (e) { threw = e.message; }
    if (!threw) errs.push('hazardsAlong with no answer from Fintraffic gave a list, as if nothing were there');
    S.loadIncidents = inc;
  } finally { S.roadcondFeatures = cond; S.incidents = null; S.roadcond = null; S.roadworkTiles.clear(); S.aadtTiles.clear(); }
  // the dark: a ride from half an hour before sunset into the dark, with a planner of its own
  const ll = [23.8, 61.5], sun = SUN.sunTimes(now / 1000, ll), tAt = Float32Array.from({ length: n }, (_, i) => i * 180);
  const dk = p.darkWarnings.call({ startSec: () => sun.set - 1800, points: [ll], routeSports: () => ['mtb'] }, { tAt, along, attr: attrs('mtb', []) });
  expect('darkWarnings', dk, [[/^After sunset/, 'look', 'calculated', 'the sun’s times'], [/^In the dark/, 'read', 'calculated', 'the sun’s times']]);
  // the water: its events, along one leg
  const events = [{ kind: 'ship', at: 100, len: 50, name: 'Näsijärvi fairway' }, { kind: 'ship', at: 200, len: 900 }, { kind: 'harbour', at: 300, len: 100 }, { kind: 'hazard', at: 350, len: 20 }, { kind: 'rough', at: 400, len: 100, max: 0.6 }];
  const ww = p.waterWarnings.call({ legs: [{ mode: 'water', status: 'ok', result: { water: { events, missing: [], craft: 'kayak', wind: { speed: 7, dir: 225 } } } }], lengthTo: () => 0 });
  const MAP = ['map', 'Väylävirasto and OpenStreetMap'], LANES = ['map', 'Väylävirasto'];
  expect('waterWarnings', ww, [[/^Crosses the Näsijärvi/, 'read', ...LANES], [/^Along a shipping lane/, 'read', ...LANES], [/^Through a harbour/, 'look', ...MAP], [/^Close to a marked rock/, 'look', ...MAP], [/^Rough for a (sea )?kayak/, 'read', 'estimate', 'the waves, from the forecast']]);
  // …for the departure its wind is for (part 3, jc-paddle-step): "Rough for a kayak, at 13:00", its source the forecast for 13:00
  const at13 = new Date(); at13.setHours(13, 0, 0, 0);
  const hhmm = at13.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const rough = p.waterWarnings.call({ legs: [{ mode: 'water', status: 'ok', result: { water: { events: [events[4]], missing: [], craft: 'kayak', wind: { speed: 7, dir: 225 }, at: at13.getTime() / 1000 } } }], lengthTo: () => 0 })[0];
  if (!rough || rough.text.indexOf(`, at ${hhmm}:`) < 0 || rough.src.by !== `the waves, from the forecast for ${hhmm}`) errs.push(`rough water for 13:00: ${rough && rough.text} · ${rough && rough.src.by}`);
  // winter: snow, snowing, the cold, slippery, the ways' winter tags, the ice season
  const fill = (v) => new Float32Array(n).fill(v), F = ['estimate', 'the forecast'], T = ['map', 'winter tags'];
  const cls = Array.from({ length: n }, (_, i) => ['closed', 'groomed', 'unploughed', 'open3'][Math.floor(i / 15)]);
  const wa = { along, pts, tAt, activity: 'mtb', attr: attrs('mtb', []), snow: { cm: fill(15) }, winterCls: cls, snowSec: 0,
    wind: { temp: Float32Array.from({ length: n }, (_, i) => (i < 30 ? 0 : -30)), precip: Float32Array.from({ length: n }, (_, i) => (i < 30 ? 0.5 : 0)), speed: fill(10), snowfall: fill(5), snow: fill(15) } };
  const wt = { app: { winter: () => ({ on: true, setting: 'on' }) } };
  expect('winterWarnings', p.winterWarnings.call(wt, wa), [[/^Snow on the way/, 'look', ...F], [/^Snowing on the way/, 'look', ...F], [/^Slippery/, 'read', ...F], [/^Frostbite risk/, 'read', ...F],
    [/^No access in winter/, 'read', ...T], [/^Beside a ski track/, 'look', ...T], [/^Not ploughed/, 'look', ...T], [/^Opens slowly/, 'look', ...T]]);
  expect('winterWarnings, very cold', p.winterWarnings.call(wt, { ...wa, snow: null, winterCls: null, wind: { ...wa.wind, temp: fill(-14), precip: fill(0), snowfall: fill(0), speed: fill(4) } }), [[/^Very cold/, 'read', ...F]]);
  expect('winterWarnings, on the water', p.winterWarnings.call(wt, { ...wa, snow: null, winterCls: null, attr: attrs('paddle', [[0, 60, {}, 'water']]), wind: { ...wa.wind, temp: fill(0), precip: fill(0), snowfall: fill(0) } }), [[/^Ice season/, 'read', ...F]]);
  expect('iceWarnings', p.iceWarnings({ along, attr: Array.from(along, () => ({ ice: true })) }), [[/^On the ice/, 'read', 'calculated', 'your route over the ice']]);
  // the stops: the bike left behind, and a short night
  const sp = ['mtb', 'hike', 'mtb'], four = [[23.80, 61.5], [23.81, 61.5], [23.83, 61.5], [23.84, 61.5]];
  const st = p.stopWarnings.call({ legs: [{}, {}, {}], legSport: (i) => sp[i], points: four, carryAt: () => false, lengthTo: (i) => i * 1000, nameOf: (i) => `P${i}`, gearLabel: () => 'The bike', clockOf: () => '23:00' },
    { waits: [{ i: 1, at: 1000, stop: { on: 420 }, rest: 3600, arrive: 0 }] });
  expect('stopWarnings', st, [[/is still at/, 'look', 'calculated', 'your stops and times'], [/^A short night/, 'look', 'calculated', 'your stops and times']]);
  return errs;
})()"""

# No forecast kept from a run before for Check's checks' place, 63.30 N 26.69–26.75 E (the browser's profile keeps it
# between runs, and an earlier check there may have had an answer): its cells are taken out of IndexedDB.
FORGET_FORECAST = """
  await (async () => {
    const WX = await import(location.origin + '/js/weather.js');
    const keys = [...new Set(Array.from({ length: 13 }, (_, k) => WX.cellAt([26.69 + k * 0.005, 63.3], 0)).flatMap((c) => ['p', 'q'].map((x) => `${x}/${c.i}/${c.j}`)))];
    await new Promise((ok) => { const r = indexedDB.open('polku'); r.onerror = () => ok(); r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('weather')) { db.close(); ok(); return; } const t = db.transaction('weather', 'readwrite'); for (const k of keys) t.objectStore('weather').delete(k); t.oncomplete = t.onerror = () => { db.close(); ok(); }; }; });
  })();
"""

# The planner's side (25d part 2): headsUp() puts every item made for a route in Read before you go or Worth a look by
# its own group, once each and in order along the route, and one without a group in Read (with a console error). A
# source that didn't answer is in Not checked with Retry until it answers: Fintraffic (mocked), the trail details
# (Overpass held back, failing), the winter ways, the forecast (501: no back-off, at a place no other check asks about).
# An answer for the route before changes nothing. A hidden kind is counted, not shown. lookedAt() says what was looked
# at, Fintraffic only for a route on land in Finland.
HEADS_UP = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [], p = polku.planner;
  const T = await import(location.origin + '/js/trails.js'), WI = await import(location.origin + '/js/winter.js');
  if (typeof p.headsUp !== 'function' || typeof p.lookedAt !== 'function') return ['no headsUp() or lookedAt() on the planner'];
  const realHazards = p.app.hazards, realFetch = window.fetch;
  const works = (a) => [{ kind: 'roadwork', at: 300, len: 60, lngLat: a.pts[30], text: 'Road works: Teiskontie', avoid: { ll: a.pts[30], r: 40 }, tier: 'read', src: { kind: 'live', by: 'Fintraffic', at: Date.now() - 60000 } }];
  let hz = async () => { throw new Error('Fintraffic didn’t answer'); };
  p.app.hazards = (a, opt) => hz(a, opt);
  let wx = 501;
  window.fetch = (input, init) => (wx && /open-meteo\\.com/.test(String(input && input.url ? input.url : input)) ? Promise.resolve(new Response('{}', { status: wx })) : realFetch(input, init));
  T.holdFetches(true, true);
  const box = [26.69, 63.29, 26.75, 63.31];
  """ + FORGET_FORECAST + """
  const not = (k) => p.headsUp().not.find((x) => x.key === k);
  const keys = () => p.headsUp().not.map((x) => x.key).join(', ') || 'nothing';
  const looked = (re) => p.lookedAt(p.analysis).find((r) => re.test(r.what));
  try {
    p.setActive(true); p.clear(); p.setMode('line');
    p.addPoint([26.700, 63.300]); p.addPoint([26.716, 63.300]);
    for (let k = 0; k < 150 && !(p.analysis && p.analysis.windError && p.analysis.hazardsError && p.analysis.trailError); k++) await wait(100);
    const a = p.analysis;
    if (!a) return ['no route drawn'];
    // each source that didn't answer: in Not checked, with Retry, and What Polku looked at says so
    for (const [k, re, what] of [['hazards', /Fintraffic/, /^Road works/], ['trail', /[Tt]rail details/, /^Trail details/], ['weather', /forecast/i, /^Weather/]]) {
      const x = not(k), row = looked(what);
      if (!x) errs.push(`no ${k} in Not checked (${keys()})`);
      else {
        if (!re.test(`${x.text} ${x.by}`)) errs.push(`${k} in Not checked: ${x.text} (${x.by})`);
        if (!x.note) errs.push(`${k} in Not checked has no note`);
        if (typeof x.retry !== 'function') errs.push(`${k} in Not checked has no Retry`);
      }
      if (!row || row.state !== 'bad') errs.push(`What Polku looked at, ${what}: ${row ? `${row.state} · ${row.by}` : 'no row'}, not bad`);
    }
    for (const r of p.lookedAt(a)) if (!r.what || !r.by || !['ok', 'bad', 'na', 'wait'].includes(r.state)) errs.push(`What Polku looked at: ${JSON.stringify(r)}`);
    // Retry, and each answers: gone from Not checked, and its items in their groups
    hz = async (b) => works(b);
    if (not('hazards')) await not('hazards').retry();
    if (not('hazards')) errs.push('Fintraffic answered after Retry and is still in Not checked');
    if (!p.headsUp().read.some((w) => /^Road works/.test(w.text))) errs.push(`Road works not in Read before you go: ${p.headsUp().read.map((w) => w.text).join(' / ') || 'nothing'}`);
    const fin = looked(/^Road works/);
    if (!fin || fin.state !== 'ok' || !/Fintraffic, \\d\\d[:.]\\d\\d/.test(fin.by)) errs.push(`What Polku looked at, Fintraffic answered: ${fin ? `${fin.state} · ${fin.by}` : 'no row'}`);
    T.holdFetches(true);
    for (const [x, y] of T.tilesIn(box)) T.seedTile(x, y, { v: 1, w: [], n: [] });
    if (not('trail')) await not('trail').retry();
    if (not('trail')) errs.push('the trail details loaded after Retry and are still in Not checked');
    wx = 0;
    if (not('weather')) await not('weather').retry();
    for (let k = 0; k < 50 && !(p.analysis.wind || p.analysis.windError); k++) await wait(100);
    if (not('weather')) errs.push(`the forecast answered after Retry and is still in Not checked (${not('weather').text})`);
    // the winter ways, the same
    WI.holdWinterFetches(true, true);
    await p.loadWinterAlong(p.analysis);
    if (!not('winter') || typeof not('winter').retry !== 'function') errs.push(`the winter ways didn't answer: not in Not checked with Retry (${keys()})`);
    WI.holdWinterFetches(true);
    for (const [x, y] of WI.winterTilesIn(box)) WI.seedWinterTile(x, y, { v: 1, w: [] });
    if (not('winter')) await not('winter').retry();
    if (not('winter')) errs.push('the winter ways answered after Retry and are still in Not checked');
    // an item without a group: in Read before you go (and a console error, which the check expects)
    const b = p.analysis;
    b.darkWarn = [...(b.darkWarn || []), { at: 10, len: 0, kind: 'test', noAvoid: true, noHide: true, text: 'An item with no group' }];
    if (!p.headsUp().read.some((w) => w.text === 'An item with no group')) errs.push('an item with no group is not in Read before you go');
    b.darkWarn = b.darkWarn.filter((w) => w.text !== 'An item with no group');
    // nothing lost: every item made is in one group, once, each group in order along the route
    const H = p.headsUp(), got = [...H.read, ...H.look];
    const made = [...b.warnings, ...(b.hazards || []), ...(b.darkWarn || []), ...(b.accessWarn || []), ...(b.waterWarn || [])];
    for (const w of made) if (got.filter((x) => x === w).length !== 1) errs.push(`${w.text}: ${got.filter((x) => x === w).length} times in Check`);
    const n = made.length + p.stopWarnings(b).length + p.winterWarnings(b).length + p.iceWarnings(b).length + (b.trailWarn || []).length;
    if (got.length !== n) errs.push(`${got.length} items in Read and Worth a look, for ${n} made: ${got.map((w) => w.text).join(' / ')}`);
    for (const [g, L] of [['Read before you go', H.read], ['Worth a look', H.look]]) if (L.some((w, i) => i && w.at < L[i - 1].at)) errs.push(`${g} is not in order along the route`);
    for (const w of got) if (!w.src || !w.src.by) errs.push(`${w.text} has no source`);
    // a hidden kind: counted at the end, not shown
    p.hideWarnKind({ key: 'roadwork', label: 'Road works' });
    const Hh = p.headsUp();
    if ([...Hh.read, ...Hh.look].some((w) => /^Road works/.test(w.text)) || Hh.hidden.get('roadwork') !== 1) errs.push(`Road works hidden: still shown, or counted ${Hh.hidden.get('roadwork')}`);
    p.hideWarnKind({ key: 'roadwork' }, false);
    // an answer for the route before changes nothing
    let fail;
    hz = () => new Promise((ok, no) => { fail = no; });
    const late = p.loadHazards(b);
    hz = async (c) => works(c);
    p.addPoint([26.732, 63.300]);
    for (let k = 0; k < 100 && !(p.analysis !== b && p.analysis.hazards); k++) await wait(100);
    fail(new Error('Fintraffic didn’t answer'));
    await late;
    await wait(100);
    if (p.analysis === b) errs.push('(the test) the route was not analysed again');
    else if (not('hazards')) errs.push('a late failure for the route before put Fintraffic in Not checked');
    // Fintraffic is looked at only for a route on land in Finland
    if (!looked(/^Road works/)) errs.push('What Polku looked at has no Fintraffic for a route on land in Finland');
    p.clear();
    p.addPoint([18.000, 59.330]); p.addPoint([18.016, 59.330]);
    for (let k = 0; k < 100 && !(p.analysis && p.analysis.pts[0][0] < 19); k++) await wait(100);
    if (looked(/^Road works/)) errs.push('What Polku looked at names Fintraffic for a route in Sweden');
    return errs;
  } finally {
    p.app.hazards = realHazards; window.fetch = realFetch; T.holdFetches(false); WI.holdWinterFetches(false);
    p.clear();
  }
})()"""


# A route for Check's own checks (25d parts 2 and 3): straight legs, 1.6 km, at a place no other check uses. Fintraffic
# mocked with road works at 300 m; the trail details held back; the forecast answering 501 (so Not checked has the
# weather, for the whole route); and three items of its own: two to look at, one to read. Done once all are in.
CHECK_ROUTE = FORGET_FORECAST + """
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), p = polku.planner;
  const T = await import(location.origin + '/js/trails.js');
  T.holdFetches(true);
  window.works = (a) => [{ kind: 'roadwork', at: 300, len: 60, lngLat: a.pts[30], text: 'Road works: Teiskontie', avoid: { ll: a.pts[30], r: 40 }, tier: 'read', src: { kind: 'live', by: 'Fintraffic', at: Date.now() - 60000 } }];
  p.app.hazards = async (a) => window.works(a);
  window.wx501 = true;
  window.fetch = ((real) => (input, init) => (window.wx501 && /open-meteo\\.com/.test(String(input && input.url ? input.url : input)) ? Promise.resolve(new Response('{}', { status: 501 })) : real(input, init)))(window.fetch);
  p.watchTerrain = () => {}; // (no analysis again for terrain that comes later: its items are the check's own)
  p.setActive(true); p.clear(); p.setMode('line');
  p.addPoint([26.700, 63.300]); p.addPoint([26.716, 63.300]); p.addPoint([26.732, 63.300]);
  for (let k = 0; k < 450 && !(p.legs.length === 2 && p.analysisFits() && p.analysis.hazards && (p.analysis.windError || p.analysis.wind)); k++) await wait(100); // (45 s: a slow runner)
  const item = (at, text, tier = 'look', src = { kind: 'map', by: 'OpenStreetMap' }) => ({ at, len: 40, kind: 'test', ic: 'warn', noHide: true, text, note: 'A test item.', tier, src, lngLat: p.analysis.pts[Math.round(at / 10)] });
  window.mine = [item(1200, 'Fallen tree across the trail'), item(150, 'Steep climb, up to 18 %'), item(900, 'In the dark for 1 km', 'read', { kind: 'calculated', by: 'the sun’s times' })];
  p.analysis.darkWarn = [...window.mine];
  p.renderWarnings();
"""

# Check in three groups (25d part 2), on a desktop: Read before you go, Not checked, Worth a look, in that order, with
# no Heads-up header above them; Read's items the red warning box, the rest rows with their group's icon; What Polku
# looked at, and that nothing listed doesn't mean open; the tab's badge: Read's count in the warning colour, else a
# neutral count, and "?" when something wasn't checked; the hidden kinds at the end.
HEADS_CHECK = """(async () => {
  const errs = [];
""" + CHECK_ROUTE + """
  p.setTab('check');
  await wait(200);
  const sec = document.querySelector('[data-sec=warnings]');
  if (!sec) return ['no Check groups ([data-sec=warnings])'];
  if (sec.querySelector('.sec-head')) errs.push('a Heads-up header above Check\\'s groups');
  const groups = () => [...sec.querySelectorAll('.tier')].map((g) => g.querySelector('.tier-h').textContent.trim());
  if (!/^Read before you go\\s*2$/.test(groups()[0] || '') || !/^Not checked\\s*1$/.test(groups()[1] || '') || !/^Worth a look\\s*3$/.test(groups()[2] || '')) errs.push(`Check's groups: ${groups().join(' / ')}`);
  const boxes = [...sec.querySelectorAll('.tier-read .warn-row.danger')], rowsOf = (g) => [...sec.querySelectorAll(`.tier-${g} .row`)];
  if (boxes.length !== 2 || boxes.some((b) => b.tagName !== 'BUTTON')) errs.push(`Read before you go: ${boxes.length} red warning boxes`);
  if (!/Road works: Teiskontie/.test(boxes[0]?.textContent || '') || !/at 300 m · 60 m/.test(boxes[0]?.textContent || '')) errs.push(`Read's first box: ${boxes[0]?.textContent}`);
  if (rowsOf('look').map((r) => r.querySelector('b').textContent).join(' / ') !== 'Straight line — not following paths / Steep climb, up to 18 % / Fallen tree across the trail') errs.push(`Worth a look: ${rowsOf('look').map((r) => r.textContent).join(' / ')}`);
  if (!/The forecast didn.t answer/.test(rowsOf('not')[0]?.textContent || '') || !/whole route/i.test(rowsOf('not')[0]?.textContent || '')) errs.push(`Not checked: ${rowsOf('not').map((r) => r.textContent).join(' / ')}`);
  const looked = sec.querySelector('.looked');
  if (!looked || !/What Polku looked at/.test(looked.textContent) || !/Road works and incidents\\s*Fintraffic, \\d\\d[:.]\\d\\d/.test(looked.textContent) || !/Weather on the way\\s*Open-Meteo didn.t answer/.test(looked.textContent) || !/Nothing listed doesn.t mean a way is open, safe or allowed/.test(looked.textContent)) errs.push(`What Polku looked at: ${looked ? looked.textContent : 'none'}`);
  // the badge
  const tab = p.els.tabBtn.check, n = () => tab.querySelector('.pl-tab-n'), unk = () => tab.querySelector('.pl-tab-unk');
  if (n().textContent !== '2' || !n().classList.contains('read') || !n().querySelector('svg')) errs.push(`badge with 2 to read: "${n().textContent}" ${n().className}`);
  if (!unk() || unk().hidden || unk().textContent.trim() !== '?') errs.push('no "?" beside the badge with something not checked');
  if (!/^Check: 2 to read before you go, 1 not checked, 3 worth a look$/.test(tab.getAttribute('aria-label') || '')) errs.push(`the tab's name: ${tab.getAttribute('aria-label')}`);
  // only Worth a look (and Not checked): a neutral count; the hidden kind listed at the end
  p.analysis.darkWarn = window.mine.filter((w) => w.tier === 'look');
  p.hideWarnKind({ key: 'roadwork', label: 'Road works' });
  if (n().textContent !== '3' || n().classList.contains('read')) errs.push(`badge with only Worth a look: "${n().textContent}" ${n().className}`);
  if (sec.querySelector('.tier-read')) errs.push('Read before you go shown with nothing in it');
  const chips = sec.querySelector('.hidden-kinds');
  if (!chips || !/Road works/.test(chips.textContent) || chips.compareDocumentPosition(sec.querySelector('.looked')) & Node.DOCUMENT_POSITION_FOLLOWING) errs.push(`the hidden kinds, at Check's end: ${chips ? chips.textContent : 'none'}`);
  p.hideWarnKind({ key: 'roadwork' }, false);
  p.analysis.darkWarn = [...window.mine];
  p.renderWarnings();
  return errs;
})()"""


def heads(chrome):
    pg = chrome.page(1440, 900, False)
    try:
        pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#14/61.50/23.81')
        fails = pg.js(HEADS, timeout=60000)
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    pg = chrome.page(1440, 900, False)
    try:
        pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#14/61.50/23.81')
        fails += pg.js(HEADS_UP, timeout=90000)
        # the one console error the check asks for: an item without a group
        errs = pg.errors()
        nogroup = [e for e in errs if 'An item with no group' in e]
        if len(nogroup) != 1:
            fails.append(f'{len(nogroup)} console errors for an item without a group, not 1')
        fails += [f'console: {e[:160]}' for e in errs if 'An item with no group' not in e]
    finally:
        pg.close()
    pg = chrome.page(1440, 900, False)
    try:
        pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#14/63.30/26.71')
        fails += pg.js(HEADS_CHECK, timeout=90000)
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} Check's groups and sources" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# The warning on the route (25d part 3), from Check. On a phone: a tap on Worth a look's row shows the item's card in
# the peek, ✕ only, its group in words, where it comes from, "2 of 6" with ‹ › along the route (whole-route items last),
# no All in Check (it was opened from Check at half), its stretch lit on the map and in the profile; ‹ › step in order;
# ✕ brings Check back at half; a late item updates the count; Not checked's item has Retry, and Retry with an answer
# closes it; a tap on the map closes the card and adds no point. On a desktop: the card beside the panel at its box,
# the box lit, no ‹ ›, Escape closes it and unlights the stretch.
ROW_STILL = """async (el) => {
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let a = el.getBoundingClientRect(), same = 0;
  for (let k = 0; k < 50 && same < 2; k++) {
    await frames();
    const b = el.getBoundingClientRect();
    same = Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 ? same + 1 : 0;
    a = b;
  }
  return [a.left + a.width / 2, a.top + a.height / 2];
}"""
# the item's card open: the check's own wait, a few seconds, before anything reads it
CARD_OPEN = """(async () => { for (let k = 0; k < 50 && !(polku.planner.cards.current && polku.planner.cards.box); k++) await new Promise((r) => setTimeout(r, 100)); return !!polku.planner.cards.current; })()"""
ONROUTE_OPEN = """(async (sel, text) => {
  const errs = [];
""" + CHECK_ROUTE + """
  if (typeof p.itemsAlong !== 'function') return [['no itemsAlong() on the planner'], null];
  p.reveal('warnings');
  for (let k = 0; k < 30 && p.panel.dataset.state === 'peek'; k++) await wait(100);
  await """ + SETTLED + """;
  const el = [...document.querySelectorAll(`[data-sec=warnings] ${sel}`)].find((r) => r.textContent.includes(text));
  if (!el) return [[`no ${sel} with "${text}" in Check: ${document.querySelector('[data-sec=warnings]')?.textContent}`], null];
  el.scrollIntoView({ block: 'center' });
  await """ + SETTLED + """;
  return [errs, await (""" + ROW_STILL + """)(el)];
})"""
ONROUTE_CARD = """(async (title, of, opts = {}) => {
  const errs = [], p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // (the card, and its stretch lit in the next frame: late on a slow machine, so waited for)
  const shown = () => p.cards.current && p.cards.current.kind === 'item' && p.cards.box && p.cards.box.querySelector('.way-hint b')?.textContent.startsWith(title);
  for (let k = 0; k < 60 && !shown(); k++) await wait(100);
  for (let k = 0; k < 30 && !(polku.map.getSource('routeLit').serialize().data.features || []).length; k++) await wait(100);
  const c = p.cards.current, box = p.cards.box;
  if (!c || c.kind !== 'item' || !box) return [`no item card for ${title} (${c ? c.kind : 'none'})`];
  const t = box.querySelector('.way-hint').textContent.replace(/\\s+/g, ' ').trim();
  if (!t.startsWith(title)) errs.push(`the card says "${t}", not ${title}`);
  if (opts.group && !t.endsWith(opts.group)) errs.push(`the card's group: "${t}", not ${opts.group}`);
  const live = box.querySelector('.heads-step [aria-live]'), L = p.itemsAlong();
  if (of && (!live || live.textContent.trim() !== `${of} of ${L.length}`)) errs.push(`the stepper says "${live ? live.textContent : 'nothing'}", not ${of} of ${L.length}`);
  if (!of && box.querySelector('.heads-step')) errs.push('‹ › on a desktop\\'s card');
  if (box.querySelector('.way-back')) errs.push('Back in words on the item\\'s card (✕ only)');
  if (opts.all === false && box.querySelector('.heads-all')) errs.push('All in Check on a card opened from Check at half');
  if (opts.src && !box.querySelector('.heads-src')?.textContent.includes(opts.src)) errs.push(`the source line: ${box.querySelector('.heads-src')?.textContent || 'none'}, not ${opts.src}`);
  if (opts.main !== undefined && (box.querySelector('.btn.primary.big')?.textContent.trim() || null) !== opts.main) errs.push(`the main button: ${box.querySelector('.btn.primary.big')?.textContent || 'none'}, not ${opts.main}`);
  // its stretch lit, on the map and in the profile (#84)
  const w = L.find((x) => x.w.text === title), lit = polku.map.getSource('routeLit').serialize().data;
  if (w && w.w.ranges !== null) {
    const f = (lit.features || [])[0], a = p.analysis;
    if (!f || Math.hypot(f.geometry.coordinates[0][0] - a.pts[Math.round(w.w.at / 10)][0], f.geometry.coordinates[0][1] - a.pts[Math.round(w.w.at / 10)][1]) > 0.0005) errs.push(`its stretch isn't lit on the map: ${JSON.stringify(f && f.geometry.coordinates[0])}`);
    if (!p.chart.highlight || Math.abs(p.chart.highlight[0] - w.w.at) > 15) errs.push(`its stretch isn't lit in the profile: ${JSON.stringify(p.chart.highlight)}`);
  }
  return errs;
})"""


def onroute(chrome):
    fails = []
    card = lambda pg, *a: pg.js(f"{ONROUTE_CARD}(...{json.dumps(list(a))})")
    # a phone, by touch
    pg = chrome.page(390, 844, True)
    try:
        pg.open_app({'activity': 'mtb'}, {}, '#14/63.30/26.71')
        errs, at = pg.js(f"{ONROUTE_OPEN}('.tier-look .row', 'Steep climb')", timeout=90000)
        fails += errs
        if at:
            pg.quick_tap(*at)  # (a finger up after 50 ms by its own times: pg.tap() waits for the page's answer to the touchstart, and a page that's busy 0.5 s takes it for a hold, #293)
            pg.js(CARD_OPEN)
            fails += card(pg, 'Steep climb, up to 18 %', 2, {'group': 'Worth a look', 'all': False, 'src': 'From the map · OpenStreetMap', 'main': None})
            if pg.js("polku.planner.panel.dataset.state") != 'peek':
                fails.append(f"the sheet at {pg.js('polku.planner.panel.dataset.state')} with the card, not the peek")
            # ‹ › along the route
            fails += pg.js("""(async () => {
              const errs = [], p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms));
              const press = async (k) => { const was = p.cards.box.querySelector('.way-hint b').textContent; p.cards.box.querySelector(`.heads-step [aria-label="${k}"]`).click(); for (let n = 0; n < 30 && p.cards.box.querySelector('.way-hint b').textContent === was; n++) await wait(100); };
              const title = () => p.cards.box.querySelector('.way-hint b').textContent;
              await press('Next');
              if (title() !== 'Road works: Teiskontie') errs.push(`› went to ${title()}, not Road works`);
              await press('Previous'); await press('Previous');
              if (title() !== 'Straight line — not following paths') errs.push(`‹ ‹ went to ${title()}, not the first item along`);
              if (!p.cards.box.querySelector('.heads-step [aria-label="Previous"]').disabled) errs.push('‹ not disabled at the first item');
              for (let k = 0; k < 8; k++) if (!p.cards.box.querySelector('.heads-step [aria-label="Next"]').disabled) await press('Next');
              if (title() !== 'The forecast didn’t answer') errs.push(`the last along the route is ${title()}, not the whole route's Not checked`);
              if (!/The whole route/.test(p.cards.box.textContent)) errs.push('a whole-route item doesn\\'t say "The whole route"');
              if (p.cards.box.querySelector('.btn.primary.big')?.textContent.trim() !== 'Retry') errs.push(`Not checked's main button: ${p.cards.box.querySelector('.btn.primary.big')?.textContent || 'none'}`);
              // a late item: the count follows
              p.analysis.darkWarn = [...p.analysis.darkWarn, { at: 50, len: 20, kind: 'test', ic: 'warn', noHide: true, text: 'A late item', tier: 'look', src: { kind: 'map', by: 'OpenStreetMap' } }];
              p.renderWarnings();
              for (let n = 0; n < 30 && !/ of 7$/.test(p.cards.box.querySelector('.heads-step [aria-live]').textContent.trim()); n++) await wait(100);
              const live = p.cards.box.querySelector('.heads-step [aria-live]').textContent.trim();
              if (live !== `${p.itemsAlong().length} of ${p.itemsAlong().length}` || p.itemsAlong().length !== 7) errs.push(`a late item: the stepper says ${live}, of ${p.itemsAlong().length}`);
              return errs;
            })()""")
            # ✕: Check at half again
            fails += pg.js("""(async () => {
              const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms));
              p.cards.box.querySelector('.way-x').click();
              for (let n = 0; n < 50 && (p.cards.current || p.panel.dataset.state !== 'half' || p.tab !== 'check'); n++) await wait(100);
              await """ + SETTLED + """;
              const errs = [];
              if (p.cards.current) errs.push('✕ left the card open');
              if (p.panel.dataset.state !== 'half' || p.tab !== 'check') errs.push(`✕ brought back ${p.panel.dataset.state} at ${p.tab}, not Check at half`);
              if ((polku.map.getSource('routeLit').serialize().data.features || []).length) errs.push('the stretch stayed lit after ✕');
              return errs;
            })()""")
        # Not checked's Retry, with an answer: gone
        errs, at = pg.js("(async () => { const p = polku.planner; for (let k = 0; k < 50 && (p.panel.dataset.state !== 'half' || p.tab !== 'check'); k++) await new Promise((ok) => setTimeout(ok, 100)); const el = document.querySelector('[data-sec=warnings] .tier-not .row'); if (!el) return [[], null]; el.scrollIntoView({ block: 'center' }); await " + SETTLED + "; return [[], await (" + ROW_STILL + ")(el)]; })()")
        if at:
            pg.quick_tap(*at)  # (a finger up after 50 ms by its own times: pg.tap() waits for the page's answer to the touchstart, and a page that's busy 0.5 s takes it for a hold, #293)
            pg.js(CARD_OPEN)
            fails += card(pg, 'The forecast didn’t answer', 7, {'group': 'Not checked', 'main': 'Retry'})
            fails += pg.js("""(async () => {
              if (!polku.planner.cards.box) return ['(no card to press Retry on)'];
              const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms));
              window.wx501 = false; // Open-Meteo answers now
              p.cards.box.querySelector('.btn.primary.big').click();
              for (let k = 0; k < 100 && p.cards.current; k++) await wait(100);
              return p.cards.current ? ['the card of a source that has answered stays open'] : p.headsUp().not.some((x) => x.key === 'weather') ? ['the forecast answered, and is still in Not checked'] : [];
            })()""")
        else:
            fails.append('no Not checked row to tap')
        # a tap on the map with a card open: it closes, and no point is added
        errs, at = pg.js(f"{ONROUTE_OPEN}('.tier-look .row', 'Fallen tree')", timeout=90000)
        fails += errs
        if at:
            pg.quick_tap(*at)  # (a finger up after 50 ms by its own times: pg.tap() waits for the page's answer to the touchstart, and a page that's busy 0.5 s takes it for a hold, #293)
            pg.js("(async () => { for (let k = 0; k < 60 && !polku.planner.cards.current; k++) await new Promise((r) => setTimeout(r, 100)); return true; })()")
            n0 = pg.js("polku.planner.points.length")
            pg.quick_tap(195, 200)
            pg.js("(async () => { for (let k = 0; k < 30 && polku.planner.cards.current; k++) await new Promise((r) => setTimeout(r, 100)); return true; })()")
            if pg.js("!!polku.planner.cards.current"):
                fails.append('a tap on the map left the item card open')
            if pg.js("polku.planner.points.length") != n0:
                fails.append('a tap on the map to close the item card added a point')
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    # the peek's row (part 3) [jc-peek]: in words, the red box while something is to read, the dashed one while only
    # something wasn't checked; gone while Check is in sight; a tap shows the first item's card in the peek, with All in
    # Check, and ✕ brings the peek back as it was
    pg = chrome.page(390, 844, True)
    try:
        pg.open_app({'activity': 'mtb'}, {}, '#14/63.30/26.71')
        fails += pg.js("""(async () => {
          const errs = [];
        """ + CHECK_ROUTE + """
          const row = () => { const r = p.els.readRow; return r && !r.hidden && r.offsetParent ? r : null; };
          const said = (el) => { const c = el.cloneNode(true); c.querySelectorAll('[aria-hidden=true]').forEach((x) => x.remove()); return c.textContent.trim(); };
          p.setTab('route'); p.setSheetState('peek');
          await wait(500);
          if (!row()) return ['no row in the peek with something to read'];
          if (!row().classList.contains('danger') || !/^2 to read before you go\\s*Road works: Teiskontie and 1 more · 1 not checked$/.test(said(row()))) errs.push(`the row: ${row().className} "${said(row())}"`);
          const sum = p.els.row.getBoundingClientRect(), rr = row().getBoundingClientRect();
          if (rr.bottom > sum.top + 1) errs.push('the row isn\\'t above the numbers');
          p.reveal('warnings');
          await wait(600);
          if (row()) errs.push('the row shows with Check in sight');
          p.setSheetState('peek');
          await wait(500);
          if (!row()) errs.push('the row didn\\'t come back at the peek');
          p.setTab('route');
          return errs;
        })()""", timeout=90000)
        at = pg.js("(async () => { await " + SETTLED + "; return (" + ROW_STILL + ")(polku.planner.els.readRow.querySelector('.pl-readrow-go')); })()")
        pg.quick_tap(*at)  # (a finger up after 50 ms by its own times: pg.tap() waits for the page's answer to the touchstart, and a page that's busy 0.5 s takes it for a hold, #293)
        pg.js(CARD_OPEN)
        fails += card(pg, 'Road works: Teiskontie', 3, {'group': 'Read before you go', 'src': 'Live · Fintraffic'})
        fails += pg.js("""(async () => {
          const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
          if (!p.cards.box) return ['(no card)'];
          if (!p.cards.box.querySelector('.heads-all')) errs.push('no All in Check on a card from the row');
          p.cards.box.querySelector('.way-x').click();
          await wait(800);
          if (p.panel.dataset.state !== 'peek' || p.tab !== 'route') errs.push(`✕ brought back ${p.panel.dataset.state} at ${p.tab}, not the peek as it was`);
          if (!p.els.readRow || p.els.readRow.hidden) errs.push('the row didn\\'t come back after ✕');
          // only something not checked: the dashed box
          p.hideWarnKind({ key: 'roadwork', label: 'Road works' });
          p.analysis.darkWarn = window.mine.filter((w) => w.tier === 'look');
          p.renderWarnings();
          const said = (el) => { const c = el.cloneNode(true); c.querySelectorAll('[aria-hidden=true]').forEach((x) => x.remove()); return c.textContent.trim(); };
          if (!p.els.readRow.classList.contains('unk') || !/^1 not checked\\s*The forecast didn.t answer$/.test(said(p.els.readRow))) errs.push(`the row with only Not checked: ${p.els.readRow.className} "${said(p.els.readRow)}"`);
          p.hideWarnKind({ key: 'roadwork' }, false);
          // nothing to read and all checked: no row
          window.wx501 = false;
          await p.loadWind(p.analysis);
          p.analysis.darkWarn = window.mine.filter((w) => w.tier === 'look');
          p.hideWarnKind({ key: 'roadwork', label: 'Road works' });
          if (!p.els.readRow.hidden && !p.headsUp().read.length && !p.headsUp().not.length) errs.push(`a row with nothing to read and all checked: "${p.els.readRow.textContent}"`);
          p.hideWarnKind({ key: 'roadwork' }, false);
          return errs;
        })()""", timeout=60000)
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    # the markers on the route (part 3) [jc-peek, jc-check, jc-worst, jc-closed]: Read before you go and placed Not checked
    # always, Worth a look only while Check or an item is in view; two 10 m apart merge, and a tap shows the Read one;
    # the open item ringed, apart from the rest, with its obstacle's own icon (#85); a stretch a source didn't cover dashed;
    # with the planner put away, a tap on a triangle opens its card, and Open the planner at it
    pg = chrome.page(390, 844, True)
    try:
        pg.open_app({'activity': 'mtb'}, {}, '#14/63.30/26.71')
        fails += pg.js("""(async () => {
          const errs = [];
        """ + CHECK_ROUTE + """
          const m = polku.map, src = (id) => (m.getSource(id) ? m.getSource(id).serialize().data.features || [] : null);
          if (!src('heads')) return ['no heads source on the map'];
          const groups = () => src('heads').map((f) => f.properties.g).sort().join(',');
          p.setTab('route'); p.setSheetState('peek');
          await wait(300);
          if (groups() !== 'read,read') errs.push(`markers at the peek: ${groups()}, not the two to read`);
          p.reveal('warnings');
          await wait(500);
          if (groups() !== 'look,look,look,read,read') errs.push(`markers with Check open: ${groups()}, not the three worth a look as well`);
          // the open item: ringed, out of the merging, its obstacle's icon shown (#85, the trail details off in Layers)
          p.analysis.darkWarn = [...p.analysis.darkWarn, { at: 1300, len: 0, kind: 'trail', icon: 'td-tree', noHide: true, text: 'Fallen tree: the test', tier: 'look', src: { kind: 'map', by: 'OpenStreetMap' }, lngLat: p.analysis.pts[130] }];
          p.renderWarnings();
          p.openItemCard(p.itemsAlong().find((x) => /Fallen tree: the test/.test(x.w.text)), { from: 'check' });
          await wait(600);
          const on = src('headsOn');
          if (!on || !on.some((f) => f.properties.kind === 'item' && f.properties.g === 'look')) errs.push(`the open item isn't ringed: ${JSON.stringify(on && on.map((f) => f.properties))}`);
          if (!on || !on.some((f) => f.properties.kind === 'obstacle' && f.properties.img === 'td-tree')) errs.push('the open item\\'s obstacle icon isn\\'t on the map');
          if (src('heads').some((f) => /Fallen tree: the test/.test(f.properties.text || ''))) errs.push(`the open item is in the merging markers too (${JSON.stringify(src('heads').filter((f) => /the test/.test(f.properties.text || '')).map((f) => f.properties.key))}, open ${p.cards.current && p.cards.current.itemKey})`);
          // a group of them ("Fallen trees ×3"): each one's icon (#85)
          const tree = (i) => ({ at: 1000 + i * 30, len: 0, kind: 'trail', icon: 'td-tree', lngLat: p.analysis.pts[100 + i * 3], text: 'Fallen tree', tier: 'look', src: { kind: 'map', by: 'OpenStreetMap' } });
          p.analysis.darkWarn = [...p.analysis.darkWarn, { ...tree(0), text: 'Fallen trees ×3', items: [tree(0), tree(1), tree(2)] }];
          p.renderWarnings();
          p.openItemCard(p.itemsAlong().find((x) => x.w.text === 'Fallen trees ×3'), { from: 'check' });
          await wait(600);
          if ((src('headsOn') || []).filter((f) => f.properties.kind === 'obstacle').length !== 3) errs.push(`a group of three fallen trees: ${(src('headsOn') || []).filter((f) => f.properties.kind === 'obstacle').length} icons on the map`);
          p.cards.close();
          await wait(300);
          if ((src('headsOn') || []).length) errs.push('a ring after the card closed');
          // a stretch a source didn't cover: dashed on the route
          p.analysis.trailError = [[400, 200]];
          p.renderWarnings();
          const gaps = src('headsGaps') || [];
          if (gaps.length !== 1 || gaps[0].geometry.coordinates.length < 2) errs.push(`unchecked stretches: ${gaps.length}`);
          p.analysis.trailError = null;
          // two items 10 m apart: one marker with 2, and a tap shows the one to read first
          p.analysis.darkWarn = [...window.mine, { ...window.mine[0], at: 600, text: 'Close one to look at', lngLat: p.analysis.pts[60] }, { ...window.mine[2], at: 610, text: 'Close one to read', lngLat: p.analysis.pts[61] }];
          p.renderWarnings();
          p.reveal('warnings'); // (Worth a look's markers show while Check is in sight)
          await wait(600);
          await """ + SETTLED + """; // (the map's room for the sheet set, so it doesn't move after it's framed)
          m.jumpTo({ center: p.analysis.pts[60], zoom: 13, padding: p.viewPadding() });
          await new Promise((ok) => m.once('idle', ok));
          const q = m.project(p.analysis.pts[60]);
          const hit = m.queryRenderedFeatures([[q.x - 20, q.y - 20], [q.x + 20, q.y + 20]], { layers: ['heads-icon'] });
          const cl = hit.find((f) => f.properties.point_count);
          if (!cl || cl.properties.point_count !== 2 || cl.properties.sev !== 3) errs.push(`two items 10 m apart: ${JSON.stringify(hit.map((f) => f.properties))}`);
          window.clusterAt = [q.x, q.y];
          return errs;
        })()""", timeout=90000)
        at = pg.js("(() => { const r = polku.map.getCanvas().getBoundingClientRect(); return window.clusterAt ? [r.left + window.clusterAt[0], r.top + window.clusterAt[1]] : null; })()")
        if at:
            pg.quick_tap(*at)  # (a finger up after 50 ms by its own times: pg.tap() waits for the page's answer to the touchstart, and a page that's busy 0.5 s takes it for a hold, #293)
            time.sleep(1.2)
            fails += card(pg, 'Close one to read', 5, {'group': 'Read before you go'})  # (fifth along the route, of eight)
            # with the planner put away: the triangle's card, and Open the planner at it
            fails += pg.js("""(async () => {
              const p = polku.planner, m = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
              p.cards.close();
              p.analysis.darkWarn = [...window.mine];
              p.renderWarnings();
              p.setActive(false);
              await wait(500);
              m.jumpTo({ center: p.analysis.pts[30], zoom: 14 });
              await new Promise((ok) => m.once('idle', ok));
              const q = m.project(p.analysis.pts[30]), r = m.getCanvas().getBoundingClientRect();
              if (!m.queryRenderedFeatures([[q.x - 20, q.y - 20], [q.x + 20, q.y + 20]], { layers: ['heads-icon'] }).some((f) => f.properties.g === 'read')) errs.push('no triangle on the route with the planner put away');
              window.closedAt = [r.left + q.x, r.top + q.y];
              return errs;
            })()""")
            at = pg.js("window.closedAt")
            pg.quick_tap(*at)  # (a finger up after 50 ms by its own times: pg.tap() waits for the page's answer to the touchstart, and a page that's busy 0.5 s takes it for a hold, #293)
            time.sleep(1.2)
            fails += pg.js("""(async () => {
              const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
              const box = p.cards.box;
              if (!box || !/Road works: Teiskontie/.test(box.textContent)) return [`with the planner put away, a tap on the triangle: ${box ? box.textContent.slice(0, 80) : 'no card'}`];
              const open = [...box.querySelectorAll('.row')].find((r) => /Open the planner at it/.test(r.textContent));
              if (!open) return ['no Open the planner at it on the card'];
              open.click();
              await wait(900);
              if (!p.active || p.tab !== 'check' || !p.cards.current || p.cards.current.kind !== 'item' || !/Road works/.test(p.cards.box.textContent)) errs.push(`Open the planner at it: ${p.active ? 'open' : 'closed'}, ${p.tab}, ${p.cards.current ? p.cards.current.kind : 'no card'}`);
              return errs;
            })()""")
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    # marking read (chosen 2026-10-23) [jr-peek, jr-after, jr-card, jr-check]: ✕ on the row marks all it counts read, with
    # Undo, and the row goes; read items stay in Check, saying so, and on the map; Got it on a card marks one and steps to the
    # next unread; All read on a group's heading; kept with the saved route, not in a new route; a changed item is unread
    pg = chrome.page(390, 844, True)
    try:
        pg.open_app({'activity': 'mtb'}, {}, '#14/63.30/26.71')
        fails += pg.js("""(async () => {
          const errs = [];
        """ + CHECK_ROUTE + """
          if (typeof p.markRead !== 'function') return ['no marking read'];
          const row = () => (p.els.readRow.hidden ? null : p.els.readRow), x = () => row() && row().querySelector('.pl-readrow-x');
          const marks = () => (polku.map.getSource('heads').serialize().data.features || []).map((f) => f.properties.g).sort().join(',');
          const note = () => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' / ');
          p.setTab('route'); p.setSheetState('peek');
          await wait(300);
          if (!x()) return ['no ✕ on the row'];
          x().click();
          await wait(300);
          if (row()) errs.push(`the row after ✕: "${row().textContent}"`);
          if (!/^3 marked read: they stay in Check and on the map/.test(note())) errs.push(`the note after ✕: ${note()}`);
          if (marks() !== 'read,read') errs.push(`markers after ✕: ${marks()}, not the two to read still`);
          const lines = () => [...document.querySelectorAll('[data-sec=warnings] .tier :is(.row, .warn-row)')].map((r) => r.textContent);
          if (lines().filter((t) => /✓ Read/.test(t)).length !== 3) errs.push(`Check after ✕: ${lines().join(' / ')}`);
          [...document.querySelectorAll('.toast button')].find((b) => /Undo/.test(b.textContent))?.click();
          await wait(300);
          if (!row()) errs.push('Undo didn\\'t bring the row back');
          // Got it, one by one: read, and the next unread along the route (a phone)
          p.reveal('warnings');
          await wait(500);
          [...document.querySelectorAll('[data-sec=warnings] .tier-read .warn-row')][0].click();
          await wait(600);
          const got = () => p.cards.box && p.cards.box.querySelector('.heads-got');
          if (!got() || got().textContent.trim() !== 'Got it') return [...errs, `no Got it on the card: ${got() ? got().textContent : 'none'}`];
          got().click();
          await wait(500);
          const title = p.cards.box && p.cards.box.querySelector('.way-hint b').textContent;
          if (title !== 'In the dark for 1 km') errs.push(`after Got it on Road works the card shows ${title}, not the next unread`);
          if (!p.isRead({ g: 'read', w: p.heads.read[0] })) errs.push('Got it didn\\'t mark Road works read');
          p.cards.close();
          await wait(300);
          // All read on a group's heading: Worth a look, everywhere the same
          p.reveal('warnings');
          await wait(400);
          const all = document.querySelector('[data-sec=warnings] .tier-look .tier-all');
          if (!all) errs.push('no All read on Worth a look\\'s heading');
          else {
            all.click();
            await wait(300);
            if ([...document.querySelectorAll('[data-sec=warnings] .tier-look .row')].some((r) => !/✓ Read/.test(r.textContent))) errs.push('All read left a row of Worth a look unread');
            if (document.querySelector('[data-sec=warnings] .tier-look .tier-all')) errs.push('All read still on a group with all read');
          }
          // kept with the saved route; a changed item is unread; a new route starts with nothing read
          const n = p.readKeys.size;
          p.save();
          p.readKeys = new Set();
          p.loadSaved();
          if (p.readKeys.size !== n) errs.push(`the saved route brought back ${p.readKeys.size} read, not ${n}`);
          for (let k = 0; k < 50 && !(p.analysis && p.analysis.hazards); k++) await wait(100);
          p.analysis.darkWarn = [...window.mine];
          window.works = (a) => [{ kind: 'roadwork', at: 300, len: 60, lngLat: a.pts[30], text: 'Road works: Teiskontie, until 18:00', avoid: { ll: a.pts[30], r: 40 }, tier: 'read', src: { kind: 'live', by: 'Fintraffic', at: Date.now() } }];
          await p.loadHazards(p.analysis);
          if (p.isRead({ g: 'read', w: p.heads.read.find((w) => /^Road works/.test(w.text)) })) errs.push('a changed road work is still read');
          p.clear();
          p.addPoint([26.700, 63.300]);
          if (p.readKeys.size) errs.push(`a new route starts with ${p.readKeys.size} read`);
          if (new URL(p.shareUrl ? 'http://x/?' + (p.shareUrl().split('?')[1] || '') : 'http://x/').search.includes('read')) errs.push('what\\'s read went into the share link');
          return errs;
        })()""", timeout=120000)
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    # a desktop, by mouse: beside the panel at its box, above the timeline, no ‹ ›, Escape closes it
    pg = chrome.page(1440, 900, False)
    try:
        pg.open_app({'activity': 'mtb', 'timeline': True}, {'polku:plannerDock': '"left"'}, '#14/63.30/26.71')
        errs, at = pg.js(f"{ONROUTE_OPEN}('.tier-read .warn-row', 'Road works')", timeout=90000)
        fails += errs
        if at:
            fails += pg.js("""(async () => {
              const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
              const el = [...document.querySelectorAll('[data-sec=warnings] .tier-read .warn-row')].find((r) => /Road works/.test(r.textContent));
              el.click();
              await wait(500);
              if (el.getAttribute('aria-current') !== 'true') errs.push('the box isn\\'t lit while its card is open');
              const beside = document.querySelector('.card-beside .card'), r = beside && beside.getBoundingClientRect(), pr = p.panel.getBoundingClientRect(), er = el.getBoundingClientRect();
              if (!beside) errs.push('the card isn\\'t beside the panel');
              const wx = document.getElementById('wx-bar'), wr = wx && wx.offsetParent ? wx.getBoundingClientRect() : null;
              if (!wr) errs.push('(the test) no timeline open');
              else if (beside && r.bottom > wr.top + 1 && r.right > wr.left && r.left < wr.right) errs.push(`the card runs under the timeline: its bottom at ${Math.round(r.bottom)}, the timeline's top at ${Math.round(wr.top)}`);
              // at its box's height, or moved up just enough to stay above the timeline
              else if (r.left < pr.right || r.left > pr.right + 24 || r.top > er.top + 4 || (r.top < er.top - 4 && r.bottom < wr.top - 24)) errs.push(`the card at ${Math.round(r.left)},${Math.round(r.top)}, ${Math.round(r.height)} px high, not beside the panel at its box (${Math.round(pr.right)},${Math.round(er.top)}) above the timeline (${Math.round(wr.top)})`);
              return errs;
            })()""")
            fails += card(pg, 'Road works: Teiskontie', 0, {'group': 'Read before you go', 'src': 'Live · Fintraffic', 'main': None})
            fails += pg.js("""(async () => {
              const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
              document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
              await wait(500);
              if (p.cards.current) errs.push('Escape left the card open');
              if (document.querySelector('[data-sec=warnings] [aria-current="true"]')) errs.push('the box stayed lit');
              if ((polku.map.getSource('routeLit').serialize().data.features || []).length) errs.push('the stretch stayed lit');
              // a climb's row lights its stretch on the map too (#84)
              p.analysis.climbs = [{ start: 20, end: 60, from: 200, to: 600, gain: 30, avg: 7.5, max: 11, len: 400, cls: 2 }];
              p.renderClimbs();
              p.toggleSection('climbs', true);
              const climb = p.els.climbs.querySelector('.li');
              if (!climb) errs.push('(the test) no climb row');
              else {
                climb.click();
                await wait(300);
                const lit = (polku.map.getSource('routeLit').serialize().data.features || [])[0];
                if (!lit || Math.hypot(lit.geometry.coordinates[0][0] - p.analysis.pts[20][0], lit.geometry.coordinates[0][1] - p.analysis.pts[20][1]) > 0.0002) errs.push(`a climb's row didn't light its stretch on the map: ${JSON.stringify(lit && lit.geometry.coordinates[0])}`);
                p.unfocusRange();
              }
              // the row at the panel's top, from the Route tab: Check and the card together [jc-desk, jc-desk-sel]. While
              // Route's list shows the same warning in its section, the row isn't there too (Journey D); folded, it is
              p.setTab('route');
              p.toggleSection('points', true);
              await wait(200);
              const row = p.els.readRow;
              if (row && !row.hidden && row.offsetParent && p.els.points.querySelector('.sec2 .warn-row')) errs.push('the row and the list’s section both say the warning');
              p.toggleSection('points', false);
              await wait(200);
              if (!row || row.hidden || !row.offsetParent) return [...errs, 'no row at the top of the panel, with the list folded'];
              row.querySelector('.pl-readrow-go').click();
              await wait(600);
              const box = [...document.querySelectorAll('[data-sec=warnings] .tier-read .warn-row')].find((r) => /Road works/.test(r.textContent));
              if (p.tab !== 'check' || !box || box.getAttribute('aria-current') !== 'true') errs.push(`the row: ${p.tab}, its box ${box ? box.getAttribute('aria-current') : 'none'}, not Check with the box lit`);
              if (!document.querySelector('.card-beside .card')) errs.push('the row\\'s card isn\\'t beside the panel');
              if (!row.hidden && row.offsetParent) errs.push('the row shows with Check in sight');
              p.cards.close();
              return errs;
            })()""")
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the warning on the route" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# The review of #416 (2026-10-23), each finding as a person meets it, on Check's own route (CHECK_ROUTE). A phone:
# the row is no button in a button (9); what's read starts afresh on another route (2) and a source read is unread
# again when it fails after it answered (4); a card stays open while the same route is worked out again (5); markers
# are clear of the points (6); What Polku looked at says the trail details are being asked (8); a water source missing
# on every leg is the whole route (10); Retry says it's asking and that the source still didn't answer (12); every card
# ends with Hide and a way to its source (the user's idea). Then a press on a marker (7) and the put-away card on screen
# (1), by touch; ‹ › in sight at 360 × 740 (13); the row at 200 % (3); a desktop's Escape (11).
WARNFIX = """(async () => {
  const errs = [];
""" + CHECK_ROUTE + """
  const T2 = await import(location.origin + '/js/trails.js');
  p.setTab('route'); p.setSheetState('peek');
  await wait(400);
  // (#446) framed, then a press on the map: the row coming late (the peek growing) doesn't frame the route again under it
  p.fitRoute({ animate: false });
  await new Promise((ok) => polku.map.once('idle', ok));
  const c446 = polku.map.getCenter();
  polku.map.getContainer().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  p.els.readRow.hidden = true; await wait(300);
  for (let k = 0; k < 3; k++) await new Promise((ok) => requestAnimationFrame(ok)); // (the refit is a frame after the resize)
  const c446b = polku.map.getCenter();
  if (c446b.lng !== c446.lng || c446b.lat !== c446.lat) errs.push('pressed on the map, then the peek changed: the route was framed again under the press');
  p.renderReadRow(); await wait(500);
  // (9) the row: a box with two buttons, its words opening the first item once
  const row = p.els.readRow;
  if (row.tagName === 'BUTTON') errs.push('the row is a <button> holding buttons');
  // …its ✕ as big to touch as the header's other buttons (#443)
  const rx = row.querySelector('.pl-readrow-x');
  if (!rx || rx.offsetWidth < 44 || rx.offsetHeight < 44) errs.push(`the row's ✕ is ${rx ? `${rx.offsetWidth} × ${rx.offsetHeight}` : 'missing'}, under 44 px to touch`);
  let opened = 0;
  const real = p.openFromRow.bind(p);
  p.openFromRow = () => { opened++; return real(); };
  row.querySelector('.pl-readrow-go')?.click();
  await wait(400);
  if (opened !== 1) errs.push(`a tap on the row's words opened ${opened} times`);
  p.openFromRow = real;
  p.cards.close();
  await wait(300);
  // (12) Retry on a source still not answering: Asking…, then that it still didn't answer
  const weather = p.itemsAlong().find((x) => x.g === 'not' && x.w.key === 'weather');
  p.openItemCard(weather, { from: 'check' });
  await wait(500);
  const retry = p.cards.box && p.cards.box.querySelector('.btn.primary.big');
  if (!retry) errs.push('no Retry on the forecast\\'s card');
  else {
    retry.click();
    const asking = retry.textContent.trim(); // (said at once: it may answer within a frame)
    const said = () => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' / ');
    for (let k = 0; k < 50 && !/still didn.t answer/.test(said()); k++) await wait(100);
    const note = said();
    if (asking !== 'Asking…') errs.push(`Retry while it asks says "${asking}"`);
    if (!/Open-Meteo still didn.t answer/.test(note)) errs.push(`Retry with no answer again: the note says "${note}"`);
  }
  p.cards.close();
  await wait(300);
  // (12, the recheck) Retry on the trail details: "Asking…" while Overpass is asked, on a card built again meanwhile too
  // (another source answering), and Overpass named plainly when it still didn't answer
  T2.holdFetches(true, true); T2.forgetFailures();
  await p.loadTrail(p.analysis);
  const trail = p.itemsAlong().find((x) => x.g === 'not' && x.w.key === 'trail');
  if (!trail) errs.push('(the test) the trail details didn\\'t fail');
  else {
    const real = p.loadTrail;
    p.loadTrail = async (a) => { await wait(1500); return real.call(p, a); };
    p.openItemCard(trail, { from: 'check' });
    await wait(500);
    p.cards.box.querySelector('.btn.primary.big').click();
    await wait(300);
    p.renderWarnings();
    const tb = p.cards.box && p.cards.box.querySelector('.btn.primary.big');
    if (!tb || tb.textContent.trim() !== 'Asking…' || !tb.disabled) errs.push(`Retry on the trail details, its card built again while Overpass is asked: "${tb ? tb.textContent.trim() : 'no button'}"${tb && !tb.disabled ? ', tappable' : ''}`);
    const said = () => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' / ');
    for (let k = 0; k < 50 && !/Overpass[^/]*still didn.t answer/.test(said()); k++) await wait(100);
    if (!/Overpass \\(OpenStreetMap\\) still didn.t answer/.test(said())) errs.push(`Retry on the trail details, no answer again: the note says "${said()}"`);
    delete p.loadTrail;
    p.cards.close();
    await wait(300);
  }
  T2.holdFetches(true); T2.forgetFailures();
  await p.loadTrail(p.analysis);
  // (4) a source read, then answering, then failing again: unread (Fintraffic, which the check answers for)
  const hz0 = p.app.hazards, fails = async () => { throw new Error('Fintraffic didn’t answer'); };
  p.app.hazards = fails; await p.loadHazards(p.analysis);
  const f1 = p.itemsAlong().find((x) => x.g === 'not' && x.w.key === 'hazards');
  if (f1) p.markRead([f1]);
  p.app.hazards = hz0; await p.loadHazards(p.analysis);
  // (the recheck) …and the saved route forgets it too: after a reload with Fintraffic down again, it's unread
  if ((JSON.parse(localStorage.getItem('polku:route') || '{}').read || []).includes('not|hazards|Fintraffic')) errs.push('Fintraffic answered, and the saved route still has its failure read');
  p.app.hazards = fails; await p.loadHazards(p.analysis);
  const f2 = p.itemsAlong().find((x) => x.g === 'not' && x.w.key === 'hazards');
  if (!f1 || !f2) errs.push('(the test) Fintraffic didn\\'t fail twice');
  else if (p.isRead(f2)) errs.push('Fintraffic failing again after it answered is still read');
  p.app.hazards = hz0; await p.loadHazards(p.analysis);
  p.analysis.darkWarn = [...window.mine];
  p.renderWarnings();
  // the user's idea: every card ends with Hide and a way to its source (Road works: Fintraffic)
  p.openItemCard(p.itemsAlong().find((x) => /^Road works/.test(x.w.text)), { from: 'check' });
  await wait(500);
  const rows = p.cards.box ? [...p.cards.box.querySelectorAll('.rows .row')].map((r) => r.querySelector('b').textContent) : [];
  if (!rows.some((t) => /^Hide/.test(t)) || !rows.some((t) => /Fintraffic/.test(t))) errs.push(`Road works' card ends with ${rows.join(' / ') || 'nothing'}, not Hide and a way to Fintraffic`);
  // (the recheck) …but not to Fintraffic's live map for its yearly counts, which it doesn't show, nor OpenStreetMap's note for
  // a shipping lane, which is Väylävirasto's
  const acts = (w) => p.itemActions({ g: w.tier, w }).more.map((m) => m.label).join(' / ');
  const busy = { kind: 'busy', at: 500, len: 100, lngLat: p.analysis.pts[50], text: 'Busy road, about 9 000 vehicles a day', tier: 'look', src: { kind: 'estimate', by: 'Fintraffic’s yearly counts' } };
  if (/Fintraffic/.test(acts(busy))) errs.push(`Busy road's card ends with ${acts(busy)}`);
  const ww = p.waterWarnings.call({ legs: [{ mode: 'water', status: 'ok', result: { water: { events: [{ kind: 'ship', at: 500, len: 50 }], missing: [] } } }], lengthTo: () => 0 });
  const lane = ww[0] && { ...ww[0], lngLat: p.analysis.pts[50] };
  if (!lane) errs.push('(the test) no shipping lane');
  else if (/OpenStreetMap/.test(acts(lane))) errs.push(`a shipping lane's card ends with ${acts(lane)}`);
  // (5) the same route worked out again, Fintraffic answering late: the card stays
  const hz = p.app.hazards;
  p.app.hazards = (a) => new Promise((ok) => setTimeout(() => ok(window.works(a)), 1500));
  const run = p.runAnalysis(p.gen);
  await run;
  await wait(200);
  const stays = () => p.cards.current && p.cards.box && /^Road works/.test(p.cards.box.querySelector('.way-hint b').textContent);
  if (!stays()) errs.push('Road works\\' card closed while the route was worked out again');
  // (the recheck) …and meanwhile it's in its place along the route (‹ ›, Got it) and ringed on the map
  else {
    const st = p.cards.box.querySelector('.heads-step > span');
    if (!st || /^0 of/.test(st.textContent)) errs.push(`while it waits, its card says "${st ? st.textContent : 'no ‹ ›'}"`);
    if (!p.itemByKey(p.cards.current.itemKey)) errs.push('while it waits, Got it and ‹ › don\\'t find it');
    if (!(polku.map.getSource('headsOn').serialize().data.features || []).some((f) => f.properties.kind === 'item')) errs.push('while it waits, its marker isn\\'t ringed');
  }
  await wait(2500);
  if (!stays()) errs.push('Road works\\' card closed once Fintraffic answered again');
  p.app.hazards = hz;
  p.cards.close();
  await wait(300);
  p.analysis.darkWarn = [...window.mine];
  p.renderWarnings();
  // (6) items at the start and at Via 1: their markers clear of the points
  p.analysis.darkWarn = [...window.mine, { ...window.mine[2], at: 0, text: 'At the start', lngLat: p.points[0] }, { ...window.mine[2], at: p.lengthTo(1), text: 'At Via 1', lngLat: p.points[1] }];
  p.renderWarnings();
  p.fitRoute({ animate: false });
  await new Promise((ok) => polku.map.once('idle', ok));
  p.drawHeads();
  const m = polku.map, near = (t) => (m.getSource('heads').serialize().data.features || []).find((f) => f.properties.text === t);
  for (const [t, i] of [['At the start', 0], ['At Via 1', 1]]) {
    const f = near(t), q = f && m.project(f.geometry.coordinates), d = m.project(p.points[i]);
    if (!f || Math.hypot(q.x - d.x, q.y - d.y) < 20) errs.push(`${t}: its marker ${f ? Math.round(Math.hypot(q.x - d.x, q.y - d.y)) : 'missing'} px from the point, under it`);
  }
  // (the recheck) the route's hover point under the open item's ring and sign, not a dark dot on it after a tap
  const ids = m.getStyle().layers.map((l) => l.id);
  if (ids.indexOf('route-hover') > ids.indexOf('heads-ring')) errs.push('the route\\'s hover point is drawn above the open item\\'s ring');
  // (8) What Polku looked at: the trail details being asked aren't ticked
  p.analysis.trailAsking = true;
  const td = () => p.lookedAt(p.analysis).find((r) => /^Trail details/.test(r.what));
  if (td().state === 'ok') errs.push(`the trail details while being asked: ${td().state} · ${td().by}`);
  p.analysis.trailAsking = false;
  // and on a route too long to ask (over 40 tiles): the router's tags only, not ticked
  const more0 = p.analysis.trailMore;
  p.analysis.trailMore = false; p.analysis.trailLong = true;
  if (td().state === 'ok') errs.push(`the trail details on a route too long to ask: ${td().state} · ${td().by}`);
  p.analysis.trailMore = more0; p.analysis.trailLong = false;
  // (10) a water source missing on every leg: the whole route
  const nc = p.notChecked.call({ legs: [{ mode: 'water', result: { water: { missing: ['OpenStreetMap'] } } }], lengthTo: (i) => i * 1000, loadHazards() {}, loadTrail() {}, loadWinterAlong() {}, loadWind() {}, retryWater() {} },
    { along: Float32Array.from({ length: 101 }, (_, i) => i * 10), attr: [], ways: [], terrain: null });
  const wa = nc.find((x) => x.key === 'water');
  if (!wa || wa.ranges !== null) errs.push(`a source missing on every water leg: ${JSON.stringify(wa && wa.ranges)}, not the whole route`);
  // (2) what's read starts afresh on another route (an imported track)
  p.markRead(p.itemsAlong());
  const readA = [...p.readKeys].sort().join(' / ');
  p.loadTrack([[26.70, 63.30], [26.71, 63.301], [26.72, 63.30]], 'Imported');
  if (p.readKeys.size) errs.push(`an imported track starts with ${p.readKeys.size} read`);
  // (the recheck) Undo brings back the route before with what was read on it, not the import's; Redo the import's
  for (let k = 0; k < 100 && !(p.analysis && p.analysisFits() && p.analysis.hazards); k++) await wait(100);
  p.markRead([{ g: 'not', w: { key: 'hazards', by: 'Fintraffic' } }]);
  const readB = [...p.readKeys].sort().join(' / ');
  p.undo();
  if ([...p.readKeys].sort().join(' / ') !== readA) errs.push(`Undo across the import: read ${[...p.readKeys].join(' / ') || 'nothing'}, not what was read on the route before`);
  p.redo();
  if ([...p.readKeys].sort().join(' / ') !== readB) errs.push(`Redo of the import: read ${[...p.readKeys].join(' / ') || 'nothing'}, not the import's`);
  // (#439) Clear, a new route with something read on it, Undo back: the route before comes back with its own
  const at0 = JSON.stringify(p.points);
  p.clear();
  p.addPoint([26.700, 63.310]); p.addPoint([26.716, 63.310]);
  p.markRead([{ g: 'not', w: { key: 'weather', by: 'Open-Meteo' } }]);
  for (let k = 0; k < 5 && JSON.stringify(p.points) !== at0; k++) p.undo();
  if (JSON.stringify(p.points) !== at0) errs.push('(the test) Undo didn\\'t bring back the route before Clear');
  if ([...p.readKeys].sort().join(' / ') !== readB) errs.push(`Undo back across Clear: read ${[...p.readKeys].join(' / ') || 'nothing'}, not ${readB}, what was read on the route before`);
  return errs;
})()"""
# (7) and (1): a press on a marker over the line; the put-away card on a phone's screen
WARNFIX_AT = """((ll) => { const m = polku.map, q = m.project(ll), r = m.getCanvas().getBoundingClientRect(); return [r.left + q.x, r.top + q.y]; })"""


def warnfix(chrome):
    fails = []
    pg = chrome.page(390, 844, True)
    try:
        pg.open_app({'activity': 'mtb'}, {}, '#14/63.30/26.71')
        fails += pg.js(WARNFIX, timeout=150000)
        # (7) a 450 ms press on the road works' triangle over the line: its card, no point added
        pg.js("(async () => { const p = polku.planner; p.clear(); return true; })()")
        pg.js(f"(async () => {{ const errs = []; {CHECK_ROUTE} p.setTab('route'); p.setSheetState('peek'); polku.map.jumpTo({{ center: p.analysis.pts[30], zoom: 15, padding: p.viewPadding() }}); await new Promise((ok) => polku.map.once('idle', ok)); return true; }})()", timeout=90000)
        at = pg.js(f"(() => {{ const p = polku.planner, f = (polku.map.getSource('heads').serialize().data.features || []).find((x) => /^Road works/.test(x.properties.text)); return f ? {WARNFIX_AT}(f.geometry.coordinates) : null; }})()")
        n0 = pg.js("polku.planner.points.length")
        if at:
            pg.touch('start', *at)
            time.sleep(0.45)
            pg.touch('end')
            time.sleep(1.0)
            r = pg.js("({ n: polku.planner.points.length, card: polku.planner.cards.current && polku.planner.cards.current.kind })")
            if r['n'] != n0 or r['card'] != 'item':
                fails.append(f"a 450 ms press on a marker over the line: {r['n'] - n0} points added, card {r['card']}")
        else:
            fails.append("(the test) no road works marker")
        # (1) the planner put away: the triangle's card whole on the screen, wherever the triangle is
        pg.js("(async () => { const p = polku.planner; p.cards.close(); p.setActive(false); await new Promise((r) => setTimeout(r, 500)); return true; })()")
        for x in (80, 300):
            at = pg.js(f"""(async () => {{ const p = polku.planner, m = polku.map; m.jumpTo({{ center: p.analysis.pts[30], zoom: 15 }});
                const q = m.project(p.analysis.pts[30]); m.jumpTo({{ center: m.unproject([q.x + (m.getCanvas().clientWidth / 2 - {x}), q.y]) }});
                await new Promise((ok) => m.once('idle', ok)); return {WARNFIX_AT}(p.analysis.pts[30]); }})()""")
            pg.tap(*at)
            time.sleep(1.2)
            r = pg.js("(() => { const b = polku.planner.cards.box; if (!b) return null; const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), innerWidth]; })()")
            if not r:
                fails.append(f'the planner put away, a triangle at x {x}: no card')
            elif r[0] < 0 or r[1] > r[2]:
                fails.append(f'the planner put away, a triangle at x {x}: its card at {r[0]}–{r[1]} on a {r[2]} px screen')
            pg.js("(() => { polku.planner.cards.close(); return true; })()")
            time.sleep(0.4)
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    # (#435) at 200 % (a 390 phone's 195 × 422), the planner put away: the triangle's card on the screen less 8 px each
    # side with nothing over it (the map's buttons step aside while it's open, CARD_FIT), and they're back after its ✕
    pg = chrome.page(195, 422, True)
    try:
        pg.open_app({'activity': 'mtb'}, {}, '#14/63.30/26.71')
        pg.js(f"(async () => {{ const errs = []; {CHECK_ROUTE} return true; }})()", timeout=150000)
        pg.js("(async () => { const p = polku.planner; p.cards.close(); p.setActive(false); await new Promise((r) => setTimeout(r, 500)); return true; })()")
        at = pg.js(f"""(async () => {{ const p = polku.planner, m = polku.map; m.jumpTo({{ center: p.analysis.pts[30], zoom: 15 }});
            const q = m.project(p.analysis.pts[30]); m.jumpTo({{ center: m.unproject([q.x + (m.getCanvas().clientWidth / 2 - 58), q.y]) }});
            await new Promise((ok) => m.once('idle', ok)); return {WARNFIX_AT}(p.analysis.pts[30]); }})()""")
        pg.quick_tap(*at)
        r = pg.js(f"({CARD_FIT})('.card-float .pl-way.card', false)")
        fails += [f"195x422 (200 %), the planner put away, the triangle's card: {e}" for e in r['errs']]
        if r.get('close'):
            pg.quick_tap(*r['close'])
            if not pg.js("new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(!polku.planner.cards.box && getComputedStyle(document.querySelector('.map-ctrls')).visibility !== 'hidden'))))"):
                fails.append("195x422 (200 %), the planner put away: after the triangle's card's ✕, the card still open or the map's buttons not back")
        fails += [f'195x422 (200 %) console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    # (#440) the Avoided place menu, opened by a tap on its circle: whole on the screen less 8 px each side at 200 % (a 390
    # phone's 195 × 422) and on the phone itself, where Stop avoiding is in reach and works
    for w, h_ in ((195, 422), (390, 844)):
        pg = chrome.page(w, h_, True)
        try:
            pg.open_app({'activity': 'mtb'}, {}, '#14/63.30/26.71')
            pg.js(f"(async () => {{ const errs = []; {CHECK_ROUTE} return true; }})()", timeout=150000)
            # (at 200 % the planner rests at its line, step 3 of #233: the menu has the room above it, #453)
            at = pg.js("""(async () => { const p = polku.planner, m = polku.map; p.cards.close(); p.setSheetState(innerWidth < 300 ? p.restSize() : 'half', { remember: false, rest: true });
                await new Promise((ok) => setTimeout(ok, 500));
                // (a spot of the map's own: clear of the planner's tools above and its sheet below)
                const free = (y) => [-20, 0, 20].every((d) => [-20, 0, 20].every((e) => document.elementFromPoint(innerWidth / 2 + e, y + d) === m.getCanvas()));
                let y = 40; while (y < innerHeight - 20 && !free(y)) y += 5;
                const c = m.unproject([innerWidth / 2, y]);
                p.addNogo([c.lng, c.lat], 40, 'Avoided place'); await new Promise((ok) => m.once('idle', ok));
                await new Promise((ok) => setTimeout(ok, 3800)); // (its toast out of the way)
                const q = m.project(c); return [q.x, q.y]; })()""")
            pg.quick_tap(*at)
            time.sleep(1.0)
            # (across, at 200 % too; down, only on the phone itself)
            r = pg.js("""(() => { const m = document.querySelector('.pt-menu'), b = m && m.querySelector('.btn');
              if (!b) return null;
              const R = m.closest('.maplibregl-popup-content').getBoundingClientRect(), B = b.getBoundingClientRect();
              const hid = getComputedStyle(document.querySelector('.map-ctrls')).visibility === 'hidden';
              return { R: [R.left, R.right], B: [B.left, B.right], W: innerWidth, right: innerWidth - (hid ? 8 : innerWidth < 720 ? 64 : 84) }; })()""")
            if not r:
                fails.append(f'{w}x{h_}, a tap on the circle opened no menu')
            else:
                (L, Rt), (bl, br) = r['R'], r['B']
                if L < 7.5 or Rt > r['W'] - 7.5:
                    fails.append(f"{w}x{h_}, the Avoided place menu at x {L:.0f}–{Rt:.0f} on a {r['W']} px screen")
                if bl < L - 0.5 or br > Rt + 0.5:
                    fails.append(f"{w}x{h_}, Stop avoiding at x {bl:.0f}–{br:.0f} out of its menu at {L:.0f}–{Rt:.0f}")
                if Rt > r['right'] + 0.5:
                    fails.append(f"{w}x{h_}, the Avoided place menu reaches x {Rt:.0f}, over the map's buttons (they start at {r['right']:.0f})")
                fails += [f'{w}x{h_}, the Avoided place menu: {e}' for e in pg.js(f"({CARD_FIT})('.pt-menu', false)")['errs']]
                pg.quick_tap(*pg.js("(() => { const r = document.querySelector('.pt-menu .btn').getBoundingClientRect(); return [(r.left + r.right) / 2, (r.top + r.bottom) / 2]; })()"))
                time.sleep(0.5)
                if pg.js("polku.planner.nogos.length") != 0:
                    fails.append(f'{w}x{h_}, Stop avoiding in the Avoided place menu left the place')
            fails += [f'{w}x{h_} console: {e[:160]}' for e in pg.errors()]
        finally:
            pg.close()
    # (13) 360 × 740: ‹ › in sight on a card with rows
    pg = chrome.page(360, 740, True)
    try:
        pg.open_app({'activity': 'mtb'}, {}, '#14/63.30/26.71')
        fails += pg.js("""(async () => { const errs = [];""" + CHECK_ROUTE + """
          // (an item with three rows under Got it: hide it, fix the map, a note)
          p.analysis.darkWarn = [...window.mine, { at: 500, len: 40, kind: 'test2', text: 'Technical trail S3', osm: { type: 'way', id: 1 }, lngLat: p.analysis.pts[50], tier: 'look', src: { kind: 'map', by: 'OpenStreetMap' } }];
          p.renderWarnings();
          p.reveal('warnings'); await wait(500);
          p.openItemCard(p.itemsAlong().find((x) => x.w.text === 'Technical trail S3'), { from: 'check' });
          await wait(800);
          const card = p.cards.box, step = card && card.querySelector('.heads-step');
          if (!step) return ['no ‹ › on the card'];
          const c = card.getBoundingClientRect(), s = step.getBoundingClientRect();
          if (s.bottom > c.bottom + 1 || s.top < c.top) errs.push(`‹ › at ${Math.round(s.top)}–${Math.round(s.bottom)}, the card shows ${Math.round(c.top)}–${Math.round(c.bottom)}`);
          // (#444) the profile size with the row there: the whole chart, and back at the peek the row and the numbers in sight
          p.cards.close(); p.setTab('route'); p.setSheetState('profile'); await wait(400); await """ + SETTLED + """;
          const cv = document.getElementById('profile-canvas').getBoundingClientRect(), sb = p.panel.getBoundingClientRect().bottom;
          if (cv.height < 60 || cv.bottom > sb + 1) errs.push(`the profile size with the row: the chart ${Math.round(cv.top)}–${Math.round(cv.bottom)}, the sheet ends at ${Math.round(sb)}`);
          p.setSheetState('peek'); await wait(400); await """ + SETTLED + """;
          const rr = p.els.readRow.getBoundingClientRect(), nr = p.els.row.getBoundingClientRect(), pr = p.panel.getBoundingClientRect();
          if (p.els.readRow.hidden || !rr.height) errs.push('back at the peek, no row');
          else if (nr.bottom > pr.bottom + 1 || rr.top < pr.top) errs.push(`back at the peek, the row and the numbers ${Math.round(rr.top)}–${Math.round(nr.bottom)} in a sheet of ${Math.round(pr.top)}–${Math.round(pr.bottom)}`);
          return errs; })()""", timeout=90000)
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    # (3) 200 % on a 390 and a 360 px phone, and on its side (#438): the count beside the numbers, taking none of the map,
    # the peek below the top bar (the recheck: 360 × 740 ran under it)
    for w, h in ((195, 422), (180, 370), (422, 195)):
        pg = chrome.page(w, h, True)
        try:
            pg.open_app({'activity': 'mtb'}, {}, '#14/63.30/26.71')
            fails += pg.js("""(async () => { const errs = [];""" + CHECK_ROUTE + """
              p.setTab('route'); p.setSheetState('peek'); await wait(400); await """ + SETTLED + """;
              const row = p.els.readRow, go = row && !row.hidden && row.querySelector('.pl-readrow-go');
              if (!go) return ['no row at 200 % (""" + f'{w} × {h}' + """)'];
              const room = () => p.panel.getBoundingClientRect().top - document.querySelector('.topbar').getBoundingClientRect().bottom;
              const withRow = room();
              row.hidden = true; p.els.row.classList.remove('with-count'); await """ + SETTLED + """;
              const without = room();
              p.renderReadRow(); await """ + SETTLED + """;
              if (withRow < without - 4) errs.push(`""" + f'{w} × {h}' + """: the row takes ${Math.round(without - withRow)} px of the map (${Math.round(withRow)} px left, ${Math.round(without)} without it)`);
              if (withRow < 0) errs.push(`""" + f'{w} × {h}' + """: the peek's top ${Math.round(-withRow)} px under the top bar`);
              if (!/to read before you go/.test(go.getAttribute('aria-label') || '')) errs.push(`""" + f'{w} × {h}' + """: the count's name: ${go.getAttribute('aria-label')}`);
              return errs; })()""", timeout=90000)
            fails += [f'console: {e[:160]}' for e in pg.errors()]
        finally:
            pg.close()
    # (11) a desktop: from the row, Escape brings the focus back to its box in Check
    pg = chrome.page(1440, 900, False)
    try:
        pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#14/63.30/26.71')
        fails += pg.js("""(async () => { const errs = [];""" + CHECK_ROUTE + """
          p.setTab('go'); await wait(300); // (on Route the row steps aside while the list shows the warning: part 4)
          p.els.readRow.querySelector('.pl-readrow-go').click();
          await wait(700);
          document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          await wait(500);
          const a = document.activeElement;
          if (!a || a === document.body || !a.closest('[data-sec=warnings]')) errs.push(`Escape left the focus on ${a ? (a.className || a.tagName) : 'nothing'}, not the box in Check`);
          return errs; })()""", timeout=90000)
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the review of #416: Check's cards, row and markers" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Round trips on the water (phase 14): paddling loops off Kaivopuisto with the recorded
# fairways and a fixed wind, no routing calls. They start from the water nearest the click,
# come out near the length, carry little; "More loops" adds three in other directions; a
# picked loop is a route of water legs that isn't routed again. A river (a strip of water)
# gets an out-and-back loop.
LOOPS = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const fx = await (await fetch(location.origin + '/tools/fixtures/water-helsinki.json')).json();
  const D = await import(location.origin + '/js/waterdata.js');
  const R = await import(location.origin + '/js/roundtrip.js');
  const G = await import(location.origin + '/js/geo.js');
  const n = await import(location.origin + '/js/net.js');
  const fc = (features) => ({ type: 'FeatureCollection', features });
  D.seedWater((box, want) => ({ fairways: want.fairways ? fc(fx.fairways) : fc([]), hazards: want.hazards ? fc(fx.marks.map((f) => ({ ...f, properties: { ...f.properties, src: 'mark' } }))) : fc([]), wind: want.wind ? { speed: 6, gust: 9, dir: 200 } : null, missing: [] }));
  // the river: a strip of water 110 m wide, the start 330 m from it
  const strip = { isWater: ([x, y]) => Math.abs(y - 61) < 0.0005 };
  const near = R.nearestWater([24, 61.003], strip);
  if (!near || !strip.isWater(near)) errs.push(`nearest water to a start by the river: ${near}`);
  const river = R.planWater({ start: near || [24, 61], sport: 'paddle', targetM: 6000, water: strip, count: 3 });
  if (!river.length || !river[0].outBack) errs.push(`a river's first loop is ${river[0] && (river[0].outBack ? 'out and back' : 'a ring')}`);
  const p = polku.planner;
  polku.set({ activity: 'paddle' });
  await wait(500);
  // Round trip is in More (25a)
  const moreHas = async (label) => { p.toggleMore(); await wait(50); const has = [...document.querySelectorAll('.menu-pop .menu-item')].some((b) => b.textContent.startsWith(label)); p.closeMore(); return has; };
  if (!(await moreHas('Round trip'))) errs.push('no Round trip in More for paddling');
  p.openLoop([24.955, 60.155]);
  p.loop.mode = 'km'; p.loop.km = 8;
  const t0 = performance.now();
  await p.generateLoops();
  const ms = performance.now() - t0, L = p.loop;
  if (L.results.length < 2) return [...errs, `${L.results.length} paddling loops (${L.note})`];
  for (const r of L.results) {
    if (r.ratio < 0.7 || r.ratio > 1.4) errs.push(`loop ${r.letter}: ${(r.m / 1000).toFixed(1)} km for 8`);
    if (r.carry > 400) errs.push(`loop ${r.letter} carries ${Math.round(r.carry)} m`);
    if (!r.legs || r.legs.length < 2) errs.push(`loop ${r.letter}: ${r.legs && r.legs.length} legs`);
  }
  if (G.dist(L.results[0].line.coords[0], L.start) > 1000) errs.push('the loop starts far from the click');
  const cards = document.querySelectorAll('.loop-card:not(.loop-more)').length;
  if (cards !== L.results.length || !document.querySelector('.loop-more')) errs.push(`${cards} cards, More loops: ${!!document.querySelector('.loop-more')}`);
  // three more, in other directions
  const before = L.results.map((r) => r.o.bearing), n0 = L.results.length;
  await p.generateLoops({ more: true });
  const added = L.results.slice(n0);
  if (!added.length) errs.push(`More loops added none (${L.note})`);
  if (added.some((r) => before.some((b) => Math.abs(R.angleDiff(b, r.o.bearing)) < 10))) errs.push('More loops repeated a direction');
  if (L.results.map((r) => r.letter).join('') !== 'ABCDEFGHI'.slice(0, L.results.length)) errs.push(`letters ${L.results.map((r) => r.letter).join('')}`);
  // each loop's letter reads on its colour, 4.5:1 (#376)
  const rgb = (s) => (s.match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
  const lum = (c) => c.map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  for (const d of document.querySelectorAll('.loop-dot')) {
    const [x, y] = [lum(rgb(getComputedStyle(d).color)), lum(rgb(getComputedStyle(d).backgroundColor))].sort((a, b) => b - a), cr = (x + 0.05) / (y + 0.05);
    if (cr < 4.5) errs.push(`loop ${d.textContent}'s letter ${cr.toFixed(2)}:1 on ${getComputedStyle(d).backgroundColor}`);
  }
  // picked: a route of water legs, not routed again
  const pick = L.results[0], m0 = pick.m;
  p.pickLoop(0);
  await wait(1500);
  if (!p.isLoop() || p.legs.some((l) => l.mode !== 'water' || l.status !== 'ok')) errs.push(`the picked loop: ${p.legs.map((l) => `${l.mode}/${l.status}`).join(', ')}`);
  const m1 = p.analysis ? p.analysis.total : 0;
  if (Math.abs(m1 - m0) > m0 * 0.02) errs.push(`picked loop ${Math.round(m0)} m became ${Math.round(m1)} m`);
  if (n.usage().some((u) => /^brouter|^valhalla/.test(u.id) && u.session)) errs.push('a routing request (loops on the water need none)');
  if (ms > 40000) errs.push(`paddling loops took ${Math.round(ms / 1000)} s`);
  polku.set({ activity: 'swim' });
  await wait(400);
  if (!(await moreHas('Round trip'))) errs.push('no Round trip in More for swimming');
  p.clear();
  polku.set({ activity: 'mtb' });
  return errs;
})()"""


def loops(chrome):
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'paddle'}, {'polku:plannerDock': '"left"'}, '#12.5/60.150/24.955')
    pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
    fails = pg.js(LOOPS, timeout=120000)
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} round trips on the water" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Framing the route above the planner on phones (#88, #89). With the sheet at peek, profile,
# half and full (a full sheet leaves no map to frame in, so it comes down to half), a fit puts
# every point of the line below the top bar and above the sheet, filling the room: the fit
# button, a GPX import with the planner open, Analyse & edit opening it, the first click's
# round trip (the sheet rises while the loops' area is framed), a loop tapped on the map
# (picked, the others and the start kept) or picked by its card, Use this loop, and a share
# link once its legs are routed (BRouter mocked: straight lines; for the link, a detour south
# of its points and an answer after 1.5 s). No routing calls. Desktop's padding stays as it was.
FIT_ROUTER = """(() => {
  const real = window.fetch.bind(window), detour = %s, delay = %s;
  let gate = null;
  window.holdRoutes = () => { let open; gate = new Promise((ok) => { open = ok; }); window.releaseRoutes = () => { gate = null; open(); }; };
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (!/^(https:\\/\\/(brouter\\.de|valhalla1\\.openstreetmap\\.de)|http:\\/\\/localhost:17777)\\//.test(url)) return real(input, init);
    if (gate) await gate;
    if (delay) await new Promise((ok) => setTimeout(ok, delay));
    if (/valhalla/.test(url)) return new Response('{}', { status: 503 });
    const prof = url.match(/\\/profile\\/([\\w-]+)/);
    if (prof) return new Response(JSON.stringify({ profileid: prof[1] }));
    // a straight line through the points; with a detour, a vertex south of each stretch's middle
    const ll = new URL(url).searchParams.get('lonlats').split('|').map((q) => q.split(',').map(Number)), c = [];
    ll.forEach((q, i) => { if (i) c.push([(ll[i - 1][0] + q[0]) / 2, (ll[i - 1][1] + q[1]) / 2 - detour]); c.push(q); });
    return new Response(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { messages: [] }, geometry: { type: 'LineString', coordinates: c } }] }));
  };
})()"""
FIT_ROUTE = [[23.80, 61.509], [23.817, 61.519], [23.838, 61.516]]
LOCAL_BROUTER = {'polku:brouterUrl': '"http://localhost:17777/brouter"'}
FIT_LIB = """(() => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), p = polku.planner, map = polku.map;
  const T = (window.fitT = { errs: [] }), err = (s) => T.errs.push(s);
  const settled = () => """ + SETTLED + """;
  const state = async (st, remember = false) => { p.setSheetState(st, { remember }); const late = await settled(); if (late) err(`${st}: ${late}`); };
  // the map you can see: below the top bar, above the sheet (once it has settled), the whole width
  // (above a floating toolbox and an open timeline too: they cover the map, 25a)
  const free = () => {
    const bar = document.querySelector('.topbar').getBoundingClientRect(), pl = document.querySelector('#planner');
    const over = ['#pl-tools:not(.docked)', '#wx-bar'].map((s) => document.querySelector(s)).filter((e) => e && !e.hidden && getComputedStyle(e).display !== 'none').map((e) => e.getBoundingClientRect().top);
    return { top: bar.bottom, bottom: p.active && !pl.hidden ? Math.min(pl.getBoundingClientRect().top, ...over) : innerHeight, left: 0, right: innerWidth };
  };
  // a line framed: every point in the map you can see, filling at least a third of it one way
  const framed = async (what, coords) => {
    const late = await settled();
    if (late) err(`${what}: ${late}`);
    const f = free(), q = coords.map((c) => map.project(c)), st = p.panel.dataset.state;
    const out = q.filter((s) => s.x < f.left - 2 || s.x > f.right + 2 || s.y < f.top - 2 || s.y > f.bottom + 2).length;
    const span = (k) => Math.max(...q.map((s) => s[k])) - Math.min(...q.map((s) => s[k]));
    const fill = Math.max(span('x') / (f.right - f.left), span('y') / Math.max(1, f.bottom - f.top));
    if (f.bottom - f.top < 100) err(`${what}: ${Math.round(f.bottom - f.top)} px of map left above the sheet (${st})`);
    else if (out) err(`${what}: ${out} of ${q.length} points outside the map above the sheet (${st}; the peek's row: ${p.els.readRow && !p.els.readRow.hidden ? `"${p.els.readRow.textContent}"` : 'none'})`);
    else if (fill < 0.3) err(`${what}: the line fills ${Math.round(fill * 100)} % of the map above the sheet (${st})`);
  };
  T.framed = framed;
  // far from everything, so a fit that doesn't happen shows
  const away = () => map.jumpTo({ center: [25.6, 62.4], zoom: 9 });
  // the camera's next stop (reduced motion: at once), or 5 s without one
  const moved = () => new Promise((ok) => { const t = setTimeout(ok, 5000); map.once('moveend', () => { clearTimeout(t); ok(); }); });
  const line = () => p.legs.flatMap((l, i) => (l.result ? l.result.coords : [p.points[i], p.points[i + 1]]));
  const corners = (b) => [[b[0], b[1]], [b[2], b[3]], [b[0], b[3]], [b[2], b[1]]];
  const TRACK = [[23.70, 61.45], [23.74, 61.47], [23.78, 61.455], [23.76, 61.43], [23.72, 61.435]];
  const gpxOf = (c) => `<?xml version="1.0"?><gpx version="1.1" creator="smoke"><trk><name>Test track</name><trkseg>${c.map(([x, y]) => `<trkpt lat="${y}" lon="${x}"></trkpt>`).join('')}</trkseg></trk></gpx>`;
  const importTrack = async (c = TRACK) => {
    const input = document.querySelector('#file-input'), dt = new DataTransfer();
    dt.items.add(new File([gpxOf(c)], 'test.gpx', { type: 'application/gpx+xml' }));
    input.files = dt.files;
    const mv = moved();
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await mv;
  };
  const loopCoords = (k) => p.loop.results[k].line.coords;
  // nothing over the map there (a toast, a button): a tap reaches the map
  const onMap = (x, y) => document.elementFromPoint(x, y) === map.getCanvas();
  // the screen spot on loop k farthest from the other loops' lines, well inside the map you can see
  const spotOn = (k) => {
    const f = free(), segs = (c) => c.slice(1).map((b, i) => [map.project(c[i]), map.project(b)]);
    const others = p.loop.results.flatMap((r, i) => (i === k ? [] : segs(r.line.coords)));
    const toSeg = (s, [a, b]) => { const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((s.x - a.x) * dx + (s.y - a.y) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(s.x - a.x - t * dx, s.y - a.y - t * dy); };
    let best = null;
    for (const [a, b] of segs(loopCoords(k))) for (const t of [0.25, 0.5, 0.75]) {
      const s = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (s.x < f.left + 30 || s.x > f.right - 90 || s.y < f.top + 30 || s.y > f.bottom - 30 || !onMap(s.x, s.y)) continue;
      const d = Math.min(...others.map((g) => toSeg(s, g)));
      if (!best || d > best.d) best = { x: s.x, y: s.y, d };
    }
    return best;
  };
  // a spot in the map you can see, 40 px or more from every loop
  const spotOff = () => {
    const f = free(), segs = p.loop.results.flatMap((r) => r.line.coords.slice(1).map((b, i) => [map.project(r.line.coords[i]), map.project(b)]));
    const toSeg = (s, [a, b]) => { const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((s.x - a.x) * dx + (s.y - a.y) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(s.x - a.x - t * dx, s.y - a.y - t * dy); };
    for (let y = f.top + 40; y < f.bottom - 40; y += 10) for (let x = 40; x < f.right - 100; x += 10) if (onMap(x, y) && Math.min(...segs.map((g) => toSeg({ x, y }, g))) > 40) return { x, y };
    return null;
  };

  // the fit button, the sheet at each size
  T.button = async () => {
    p.setActive(true); p.clear(); p.setMode('line');
    for (const q of """ + json.dumps(FIT_ROUTE) + """) p.addPoint(q);
    for (let k = 0; k < 100 && !p.analysis; k++) await wait(200);
    for (const st of ['peek', 'profile', 'half', 'full']) {
      await state(st);
      away();
      const mv = moved();
      // the toolbar's on desktops, the map's column's on phones (25a); where the column let go of it (a full sheet), More's
      // (#344, step 3 of #233)
      let fit = p.tools.classList.contains('desk') ? p.els.fit : document.getElementById('btn-fit');
      if (!fit.offsetParent && document.getElementById('map-ctrls').classList.contains('no-fit')) {
        p.els.more.click();
        await wait(300);
        fit = [...document.querySelectorAll('.menu-pop button')].find((b) => /Show the whole route/.test(b.textContent));
      }
      if (!fit || !fit.offsetParent || fit.disabled) err(`no fit button at ${st}`);
      else fit.click();
      await mv;
      await framed(`the fit button at ${st}`, line());
    }
    return T.errs.splice(0);
  };
  // a GPX import: with the planner open, and Analyse & edit opening it
  T.gpx = async () => {
    for (const st of ['peek', 'half', 'full']) {
      await state(st);
      away();
      await importTrack();
      await framed(`a GPX import, the planner at ${st}`, TRACK);
    }
    for (const st of ['peek', 'half', 'full']) {
      await state(st, true); // the planner opens at it
      p.setActive(false);
      away();
      await importTrack();
      const mv = moved();
      document.querySelector('#track-card .btn.primary').click();
      await mv;
      await framed(`Analyse & edit, the planner opening at ${st}`, TRACK);
    }
    p.setSheetState('half');
    return T.errs.splice(0);
  };
  // the import's card is over the map's corner: a track that ends at the bottom of its frame (its southernmost
  // point, leaning west) still has its end clear of the card (#131), with the planner open at each of `states` and put away
  // (tall for a phone, wide for a desktop, so the end lands in the frame's corner at either)
  T.importCard = async (states) => {
    const ENDS = innerWidth > 720 ? [[23.84, 61.45], [23.78, 61.465], [23.74, 61.47], [23.70, 61.43]] : [[23.74, 61.49], [23.725, 61.465], [23.715, 61.447], [23.70, 61.43]];
    for (const st of [...states, null]) {
      if (st) { p.setActive(true); await state(st, true); } else p.setActive(false);
      const what = `an import with the planner ${st ? `at ${st}` : 'put away'}`;
      away();
      await importTrack(ENDS);
      const late = await settled();
      if (late) err(`${what}: ${late}`);
      // the map you can see: the sheet's (free()) or, beside a side panel, all of it right of the panel
      const side = p.active && p.layout() === 'side', f = free(), pr = document.querySelector('#planner').getBoundingClientRect();
      if (side) Object.assign(f, { bottom: innerHeight, left: pr.right });
      const out = ENDS.map((c) => map.project(c)).filter((q) => q.x < f.left || q.x > f.right || q.y < f.top || q.y > f.bottom).length;
      if (out) err(`${what}: ${out} of ${ENDS.length} points outside the map you can see`);
      const card = document.querySelector('#track-card'), c = card.getBoundingClientRect(), e = map.project(ENDS[ENDS.length - 1]);
      if (card.hidden) err(`${what}: no card`);
      else if (e.x > c.left - 8 && e.x < c.right + 8 && e.y > c.top - 8 && e.y < c.bottom + 8) err(`${what}: the track's end (${Math.round(e.x)}, ${Math.round(e.y)}) is under the card (${Math.round(c.left)}-${Math.round(c.right)}, ${Math.round(c.top)}-${Math.round(c.bottom)})`);
      card.querySelector('[aria-label="Remove track"]').click();
    }
    // Analyse & edit frames the route with the card gone: on a phone, where the tall track is as tall as the map, the lowest point is near the bottom of the map you can see
    away();
    await importTrack(ENDS);
    const mv = moved();
    document.querySelector('#track-card .btn.primary').click();
    await mv;
    const late = await settled();
    if (late) err(`Analyse & edit: ${late}`);
    const g = free(), low = Math.max(...ENDS.map((c) => map.project(c).y));
    if (innerWidth < 720 && g.bottom - low > 80) err(`Analyse & edit: the lowest point is ${Math.round(g.bottom - low)} px above the bottom of the map, as if the card were still there`);
    return T.errs.splice(0);
  };
  // before a tap from Python, a frame that comes quickly: on GitHub's runner the page can be busy
  // drawing for a second, and a tap it handles that late loses its click (#268)
  T.calm = async () => { for (let i = 0; i < 40; i++) { const t = performance.now(); await new Promise((ok) => requestAnimationFrame(ok)); if (performance.now() - t < 100) return; } };
  // the first click: the empty planner at peek, a tap on the map (from Python) puts the start down
  T.firstTap = async () => {
    p.setActive(true); p.clear(); p.closeLoop();
    p.setActive(false); p.setActive(true); // an empty planner opens at peek
    const late = await settled();
    if (late) err(`opening: ${late}`);
    if (p.panel.dataset.state !== 'peek') err(`the empty planner opened at ${p.panel.dataset.state}`);
    map.jumpTo({ center: [23.80, 61.50], zoom: 12 });
    await new Promise((ok) => map.once('idle', ok));
    await T.calm();
    window.holdRoutes();
    // a spot of the map you can see (the ways to begin fill the peek, and a note may sit above them)
    const f = free(), q = { x: innerWidth * 0.4, y: f.top + (f.bottom - f.top) * 0.3 };
    if (!onMap(q.x, q.y)) err('something is over the first tap’s spot');
    const ll = map.unproject([q.x, q.y]);
    T.start = [ll.lng, ll.lat];
    return q;
  };
  // the first point's peek: a loop of the first length opens the form there (25b, #232), and Make 3 loops frames
  // the loops' area above it
  T.loopFromStart = async () => {
    // the tap's click can come a while after Chrome answered the tap, when the page draws slowly
    let chip;
    for (const t0 = Date.now(); !(chip = document.querySelector('.pl-way .rt-here .chip')) && Date.now() - t0 < 5000;) await wait(100);
    if (!chip) { err(`no round-trip choices on the first tap (${p.points.length} points)`); return T.errs.splice(0); }
    chip.click();
    await wait(100);
    const make = document.querySelector('.pl-way .rt-make');
    if (!make) { err('no Make 3 loops in the peek'); return T.errs.splice(0); }
    make.click();
    await wait(100);
    const R = await import(location.origin + '/js/roundtrip.js'), L = p.loop;
    await framed('the round trip’s area above its form', corners(R.reach(L.start, R.radiusFor('mtb', L.km * 1000))));
    window.releaseRoutes();
    for (let k = 0; k < 450 && (L.busy || !L.results.length); k++) await wait(200);
    if (L.results.length < 3) { err(`${L.results.length} loops (${L.note})`); return T.errs.splice(0); }
    await framed('the three loops', L.results.flatMap((r) => r.line.coords));
    return T.errs.splice(0);
  };
  // a loop that isn't picked, tapped on the map (the tap from Python)
  T.loopSpot = async () => {
    await T.calm();
    const L = p.loop;
    if (L.results.length < 3) return null;
    const k = L.on === 1 ? 2 : 1, s = spotOn(k);
    T.k = k; T.n = L.results.length; T.start = L.start.slice();
    if (!s || s.d < 24) { err(`no spot on loop ${L.results[k].letter} clear of the others (${s ? Math.round(s.d) : 'none'} px)`); return null; }
    T.watchTaps(s);
    return s;
  };
  // what a tap from Python met, for a FAIL line: where the spot was, the camera then and now, the clicks
  const cam = () => { const c = map.getCenter(), q = map.getPadding(); return `${c.lng.toFixed(5)},${c.lat.toFixed(5)} z${map.getZoom().toFixed(2)} padding ${q.top}/${q.bottom}`; };
  T.watchTaps = (s) => {
    T.seen = { spot: `${Math.round(s.x)},${Math.round(s.y)}`, cam: cam(), clicks: [] };
    if (T.onClick) map.off('click', T.onClick);
    T.onClick = (e) => T.seen.clicks.push(`${Math.round(e.point.x)},${Math.round(e.point.y)} on loops ${map.queryRenderedFeatures(e.point, { layers: ['loops-line', 'loops-casing'] }).map((f) => f.properties.i).join('/') || 'none'}${Date.now() < p.noClickUntil ? ', clicks held off' : ''}${document.querySelector('.pt-menu') ? ', the spot menu open' : ''}`);
    map.on('click', T.onClick);
  };
  const taps = () => `(the spot ${T.seen.spot} with the map at ${T.seen.cam}, now at ${cam()}; clicks: ${T.seen.clicks.join(', ') || 'none'})`;
  T.loopTapped = async () => {
    const L = p.loop, k = T.k;
    // the tap's click can come seconds later on GitHub's runner (#268)
    for (const t0 = Date.now(); L.on !== k && L.results.length === T.n && Date.now() - t0 < 5000;) await wait(100);
    await wait(300);
    if (L.results.length !== T.n) err(`tapping loop ${'ABC'[k]} on the map left ${L.results.length} of ${T.n} loops`);
    else {
      if (L.on !== k) err(`tapping loop ${L.results[k].letter} on the map picked ${L.results[L.on] ? L.results[L.on].letter : L.on} ${taps()}`);
      const cards = document.querySelectorAll('.loop-card:not(.loop-more)');
      if (!cards[k] || !cards[k].classList.contains('on')) err('the tapped loop’s card isn’t marked');
      await framed(`loop ${L.results[k].letter} tapped on the map`, loopCoords(k));
    }
    if (L.start.join() !== T.start.join()) err(`tapping a loop moved the start from ${T.start} to ${L.start}`);
    // its card picks the other one, and the map follows
    const j = [0, 1, 2].find((i) => i !== k && i !== L.on);
    const card = L.results.length === T.n && document.querySelectorAll('.loop-card:not(.loop-more)')[j];
    if (card) {
      away();
      const mv = moved();
      card.click();
      await mv;
      if (L.on !== j) err(`the card of loop ${L.results[j].letter} picked ${L.on}`);
      await framed(`loop ${L.results[j].letter} picked by its card`, loopCoords(j));
    }
    return T.errs.splice(0);
  };
  // away from the loops: the start moves there and the loops go, as before
  T.offSpot = async () => { await T.calm(); T.n = p.loop.results.length; const s = spotOff(); if (!s) err('no spot clear of the loops'); else { T.off = map.unproject([s.x, s.y]); T.watchTaps(s); } return s; };
  T.offTapped = async () => {
    const L = p.loop;
    for (const t0 = Date.now(); L.results.length && Date.now() - t0 < 5000;) await wait(100); // as in loopTapped
    await wait(300);
    if (T.off && (!L.start || Math.abs(L.start[0] - T.off.lng) > 1e-3 || Math.abs(L.start[1] - T.off.lat) > 1e-3)) err(`a tap away from the loops left the start at ${L.start}`);
    if (L.results.length) err(`a tap away from the loops kept ${L.results.length} loops ${taps()}`);
    // new loops from there, and Use this loop with the sheet at full
    await p.generateLoops();
    if (!L.results.length) { err(`no loops the second time (${L.note})`); return T.errs.splice(0); }
    await state('full');
    away();
    const mv = moved();
    const use = document.querySelector('.loop-card.on .loop-use');
    if (!use) err('no Use loop'); else use.click();
    await mv;
    await framed('Use this loop at full', line());
    return T.errs.splice(0);
  };
  // desktop: the padding as it was (the side panel, the bottom panel at half)
  T.desktop = async () => {
    p.setActive(true);
    const r = () => p.panel.getBoundingClientRect(), same = (a, b) => ['top', 'bottom', 'left', 'right'].every((k) => Math.abs(a[k] - b[k]) < 0.5);
    // clear of the toolbar too (25a): under it beside the side panel, above it on a bottom panel's edge
    const tb = () => p.tools.getBoundingClientRect();
    // (no toolbar before there's a point or a step to undo: it grows with the route)
    const tbTop = () => (p.tools.hidden ? Infinity : tb().top), tbBottom = () => (p.tools.hidden ? 0 : tb().bottom);
    const was = (lay) => (lay === 'side' ? { top: Math.max(80, tbBottom() + 16), bottom: 40, left: r().right + 40, right: 110 } : { top: 80, bottom: innerHeight - Math.min(r().top, tbTop()) + 20, left: 20, right: 70 });
    for (const dock of ['left', 'bottom']) {
      p.setDock(dock);
      await state(dock === 'left' ? 'open' : 'half');
      const v = p.viewPadding(), w = was(p.layout());
      if (!same(v, w)) err(`desktop, docked ${dock}: padding ${JSON.stringify(v)}, was ${JSON.stringify(w)}`);
    }
    p.setDock('left');
    return T.errs.splice(0);
  };
  return true;
})()"""
# a share link in a clean page, opening with the sheet at `st`: the routed line in view once it's in
FIT_SHARE = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), p = polku.planner;
  for (let k = 0; k < 150 && !(p.legs.length === 2 && p.legs.every((l) => l.status === 'ok') && p.analysis); k++) await wait(200);
  if (!p.legs.every((l) => l.status === 'ok')) return [`the link's route: ${p.legs.map((l) => l.status).join(', ') || 'no legs'}`];
  await fitT.framed(`a share link opening at ${%s}, routed`, p.legs.flatMap((l) => l.result.coords));
  return fitT.errs.splice(0);
})()"""


def fit_phone(chrome):
    ok = True
    # a finger's own touches, up after 50 ms whatever the page is doing: on GitHub's runner a
    # synthesized tap gesture never becomes a click, and Page.tap's touchend, sent only once Chrome
    # has answered the touchstart, comes a second late on a busy page and makes the tap a hold (#268)
    tap = lambda pg, s: pg.quick_tap(s['x'], s['y'])
    for w, h in [(390, 844), (360, 740)]:
        fails = []
        pg = chrome.page(w, h, True)
        try:
            pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': FIT_ROUTER % (0, 0)}, pg.s)
            # a routing server of your own (Settings), so two rounds of loops aren't paced (the mock answers it)
            pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"', **LOCAL_BROUTER}, '#13/61.512/23.82')
            pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
            pg.js(FIT_LIB)
            fails += pg.js('fitT.button()', timeout=90000)
            fails += pg.js('fitT.gpx()', timeout=90000)
            fails += pg.js("fitT.importCard(['peek', 'half', 'full'])", timeout=90000)
            tap(pg, pg.js('fitT.firstTap()'))
            fails += pg.js('fitT.loopFromStart()', timeout=120000)
            s = pg.js('fitT.loopSpot()')
            if s:
                tap(pg, s)
                fails += pg.js('fitT.loopTapped()', timeout=30000)
                s = pg.js('fitT.offSpot()')
                if s:
                    tap(pg, s)
                    fails += pg.js('fitT.offTapped()', timeout=120000)
            fails += pg.js('fitT.errs.splice(0)')
            url = BASE + '?r=' + pg.js(f"import(location.origin + '/js/geo.js').then((G) => encodeURIComponent(G.encodePolyline({json.dumps(FIT_ROUTE)})))") + '&a=mtb'
            fails += [f'console: {e[:160]}' for e in pg.errors()]
        finally:
            pg.close()
        for st in ('peek', 'half', 'full'):
            pg = chrome.page(w, h, True)
            try:
                pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': FIT_ROUTER % (0.06, 1500)}, pg.s)
                pg.goto(BASE + 'sw.js')
                pg.js("localStorage.clear(); localStorage.setItem('polku:settings', '{\"activity\":\"mtb\"}'); localStorage.setItem('polku:plannerDock', '\"left\"');"
                      f" localStorage.setItem('polku:sheetState', {json.dumps(json.dumps({'sheet': st}))}); true")
                pg.goto(url)
                pg.map_loaded()
                pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
                pg.js(FIT_LIB)
                fails += pg.js(FIT_SHARE % json.dumps(st), timeout=60000)
                fails += [f'console: {e[:160]}' for e in pg.errors()]
            finally:
                pg.close()
        print(f"{'ok  ' if not fails else 'FAIL'} the route framed above the sheet ({w}x{h})" + ''.join(f'\n     - {f}' for f in fails), flush=True)
        ok = not fails and ok
    pg = chrome.page(1440, 900, False)
    try:
        pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'})
        pg.js(FIT_LIB)
        fails = pg.js('fitT.desktop()')
        fails += pg.js("fitT.importCard(['open'])", timeout=90000)
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} desktop framing as it was (1440x900)" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails and ok


# Winter on the route (15b), with a made-up forecast (it's not snowing in the test): a ride
# along a ploughed cycleway from the recorded Laajavuori tile. The ways' winter classes come
# along the route; the snow makes the time longer (less on the ploughed way than off it);
# Heads-up has the snow, the snowfall, slippery, the cold; a water leg has the ice season.
WINTER_ROUTE = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const W = await import(location.origin + '/js/winter.js');
  const A = await import(location.origin + '/js/analysis.js');
  const fx = await (await fetch(location.origin + '/tools/fixtures/winter-laajavuori.json')).json();
  W.holdWinterFetches(true);
  W.seedWinterTile(fx.x, fx.y, fx.data);
  W.setWinterSetting('on');
  const way = fx.data.w.find((x) => x[0] === 41894526), c = [];
  for (let i = 0; i < way[2].length; i += 2) c.push([way[2][i], way[2][i + 1]]);
  const p = polku.planner;
  p.setActive(true);
  p.clear();
  p.loadTrack(c, 'Ploughed cycleway');
  for (let k = 0; k < 40 && !p.analysis; k++) await wait(200);
  const a = p.analysis;
  if (!a) return ['no analysis'];
  const n = a.along.length, half = Math.floor(n / 2);
  // the forecast: 15 cm of snow, heavy snowfall (the ride is short); rain at -1 °C on the first half, -20 °C and wind on the second
  const fill = (v) => new Float32Array(n).fill(v);
  const temp = fill(-1); for (let i = half; i < n; i++) temp[i] = -20;
  const precip = fill(0); for (let i = 0; i < half; i++) precip[i] = 0.4;
  a.wind = { snow: fill(15), snowfall: fill(30), temp, precip, speed: fill(5), gust: fill(8), head: fill(0), dir: fill(180), cross: fill(0), startSec: Date.now() / 1000 };
  // the classes along it
  const cls = await W.winterAlong(a);
  const share = cls ? cls.filter((x) => x === 'ploughed').length / n : 0;
  if (share < 0.7) errs.push(`ploughed along the way: ${Math.round(share * 100)} %`);
  a.winterCls = cls;
  // the time: snow on a ploughed way slows it a little; the same snow on an unknown way more
  const opt = p.timeOpt();
  const t0 = A.estimateTime(a, opt).total, tPl = A.estimateTime(a, opt, null, { cm: a.wind.snow, cls }).total, tUnk = A.estimateTime(a, opt, null, { cm: a.wind.snow, cls: null }).total;
  if (!(tPl > t0 * 1.05 && tPl < t0 * 1.25)) errs.push(`ploughed in 15 cm: ${Math.round(tPl / t0 * 100)} % of the summer time`);
  if (!(tUnk > tPl)) errs.push(`unknown ways in 15 cm (${Math.round(tUnk)} s) not slower than ploughed (${Math.round(tPl)} s)`);
  const snow = p.snowOf(a, a.wind);
  if (!snow || snow.max !== 15) errs.push(`snowOf: ${JSON.stringify(snow && snow.max)}`);
  p.setSnow(a, snow);
  if (!(a.snowSec > 0)) errs.push(`snow seconds: ${a.snowSec}`);
  const texts = p.winterWarnings(a).map((x) => x.text);
  for (const re of [/^Snow on the way: 15 cm/, /^Snowing on the way/, /^Slippery/, /^Frostbite risk/]) if (!texts.some((t) => re.test(t))) errs.push(`no Heads-up ${re}: ${texts.join(' / ')}`);
  if (texts.some((t) => /^Not ploughed/.test(t))) errs.push('a ploughed way said unploughed');
  // the Off setting: none of it
  W.setWinterSetting('off');
  if (p.winterWarnings(a).length || p.snowOf(a, a.wind)) errs.push('winter Heads-up with winter Off');
  // a water leg in the ice season
  W.setWinterSetting('on');
  for (let i = 0; i < n; i++) a.attr[i] = { ...a.attr[i], mode: 'water' };
  if (!p.winterWarnings(a).some((x) => /^Ice season/.test(x.text))) errs.push('no ice season on the water');
  W.setWinterSetting('auto');
  p.clear();
  return errs;
})()"""


def winter_route(chrome):
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#14/62.258/25.715')
    pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
    fails = pg.js(WINTER_ROUTE, timeout=60000)
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} winter on the route" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# The drawer in three tabs (22a). Nothing the drawer had may go missing: the header's controls
# as they were, every section in its tab (and a jump to it opens that tab), the profile under the
# header at the sheet's sizes, the route's tools out of ⋯, the speeds beside the style, the time
# first in Go, the start's choices and the first click's loop offer, the leg lit from the list.
DRAWER = """(async () => {
  const p = polku.planner, m = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const txt = (el) => (el ? el.textContent.replace(/\\s+/g, ' ').trim() : '');
  p.setActive(true);
  p.clear();
  p.generateLoops = async () => { p.loopsAsked = (p.loopsAsked || 0) + 1; }; // no routing calls here
  // the start: four ways to begin, in the header (A with 25b), Round trip among them
  p.setTab('route');
  await wait(200);
  const desk = p.sideMQ.matches;
  const choices = [...document.querySelectorAll('.pl-way .way-tile b')].map(txt);
  if (choices.join('|') !== (desk ? 'Draw it|Round trip|Marked routes|A GPX or KML file' : 'Draw it|Round trip|Marked routes|A file')) errs.push(`start choices: ${choices.join(' | ') || 'none'}`);
  if (document.querySelector('.pl-empty').hidden) errs.push('Check says nothing before there is a route');
  // the first click: the start goes down and its peek offers a loop from there (no card on the map, #232); the next click adds a point
  p.setMode('line');
  const c = m.getCenter(), q = m.project(c);
  m.fire('click', { point: q, lngLat: c, originalEvent: new MouseEvent('click') });
  await wait(300);
  const here = document.querySelector('.pl-way .rt-here');
  if (!here || !/Round trip from here/.test(txt(here))) errs.push('no loop offered at the first click');
  if (document.querySelector('.maplibregl-popup')) errs.push('a card on the map at the first click (#232)');
  if (/\\bnull\\b|undefined/.test(p.panel.textContent)) errs.push('“null” written in the drawer with one point');
  const q2 = { x: q.x + 120, y: q.y - 60 }, ll2 = m.unproject([q2.x, q2.y]);
  m.fire('mousedown', { point: q2, lngLat: ll2, originalEvent: new MouseEvent('mousedown', { button: 0 }) });
  m.fire('click', { point: q2, lngLat: ll2, originalEvent: new MouseEvent('click') });
  await wait(300);
  if (p.points.length !== 2) errs.push(`the click after the start added ${p.points.length - 1} points`);
  if (p.startView() !== null || !document.querySelector('.pl-way').hidden) errs.push('the start stays with a route');
  // a loop from the first point's peek: the round trip opens at that length, and makes nothing yet (25b)
  p.clear(); p.addPoint([c.lng, c.lat]);
  await wait(200);
  const chip = document.querySelector('.pl-way .rt-here .chip');
  const km = chip ? parseInt(txt(chip), 10) : 0;
  if (chip) chip.click();
  await wait(300);
  if (!p.loop.open || p.loop.km !== km || p.loopsAsked) errs.push(`the first point’s ${km} km loop: open ${p.loop.open}, ${p.loop.km} km, made ${p.loopsAsked || 0} times`);
  p.closeLoop();
  // a route of three straight legs
  p.clear();
  for (const d of [[0, 0], [0.01, 0.004], [0.022, 0.001], [0.03, 0.008]]) p.addPoint([c.lng + d[0], c.lat + d[1]]);
  for (let k = 0; k < 30 && !p.analysis; k++) await wait(200);
  if (!p.analysis) return errs.concat('no route');
  // the header shows the route; the toolbox holds how the next leg is drawn, undo, redo and More (25a)
  for (const k of ['quickColor', 'quickSport', 'quickLoop', 'quickStyle', 'toolsRow']) if (p.els[k]) errs.push(`the header still has ${k}`);
  if (p.els.head.querySelector('select, .seg, .tbtn')) errs.push('the header still has pickers, modes or tools');
  for (const [k, what] of [['fit', 'show all'], ['undo', 'undo'], ['redo', 'redo'], ['more', 'More']]) if (!p.els[k] || !p.tools.contains(p.els[k])) errs.push(`the toolbox lacks ${what}`);
  if (p.tools.querySelectorAll('.tb-modes [role=radio]').length !== 3 || !p.tools.contains(p.els.modeBtn)) errs.push('the toolbox lacks the modes');
  // every section in its tab, and a jump to it opens that tab
  const where = { points: 'route', style: 'route', warnings: 'check', climbs: 'check', colours: 'check', speed: 'go', depart: 'go', take: 'go' }; // (the marks are in Layers: #424's C, the tabs group)
  for (const [id, tab] of Object.entries(where)) {
    const el = document.querySelector(`[data-sec=${id}]`);
    if (!el || el.closest('.pl-pane')?.dataset.tab !== tab) { errs.push(`${id} is not in ${tab}`); continue; }
    p.setTab(tab === 'go' ? 'route' : 'go');
    p.reveal(id);
    await wait(80);
    if (p.tab !== tab || el.closest('.pl-pane').hidden) errs.push(`reveal(${id}) didn’t open ${tab}`);
  }
  p.openStep(null); // (reveal(style) opened How you go's step)
  // the profile: under the header, out of the tabs; at the profile size, not at peek
  const cv = document.querySelector('#profile-canvas');
  if (!cv || !cv.closest('.pl-profile') || cv.closest('.pl-pane')) errs.push('the profile isn’t under the header');
  if (p.layout() === 'sheet') {
    p.setSheetState('peek', { remember: false }); await wait(400);
    if (cv.offsetHeight) errs.push('the profile shows at peek');
    p.setSheetState('profile', { remember: false }); await wait(400);
    if (cv.offsetHeight < 100) errs.push(`the profile is ${cv.offsetHeight} px at the profile size`);
    p.setSheetState('half', { remember: false }); await wait(400);
  }
  const h0 = cv.offsetHeight;
  p.setProfileCompact(!p.profCompact); await wait(200);
  if (p.layout() === 'side' && cv.offsetHeight === h0) errs.push('the profile’s size button changed nothing');
  p.setProfileCompact(!p.profCompact); await wait(100);
  // Route: the tools out of ⋯, How you go with the style and the speeds (its two steps, #424's C)
  p.setTab('route'); await wait(100);
  const foot = [...p.els.pointsFoot.querySelectorAll('button')].map(txt);
  for (const b of ['Round trip', 'Reverse', 'Back to start', 'Import']) if (!foot.includes(b)) errs.push(`Route lacks ${b}: ${foot.join(', ')}`);
  if (foot.includes('All leg settings')) errs.push('Route still has All leg settings (25d’s part 4: each stretch has Edit this stretch)');
  const how = document.querySelector('[data-sec=style]');
  if (!how.querySelector('.style-presets') || !how.querySelector('.speed-wrap .speed-box').children.length) errs.push('How you go lacks the style or the speeds');
  // More: the whole route's actions (25a)
  p.els.more.click(); await wait(100);
  const items = [...document.querySelectorAll('.menu-pop .menu-item')].map(txt);
  const bar = [...p.tools.querySelectorAll('button')].filter((b) => !b.hidden && b.offsetParent).map((b) => b.getAttribute('aria-label') || '');
  for (const want of ['Share link', 'Export GPX', 'Save offline', 'Round trip', 'Reverse', 'Back to start', 'Import', 'Clear route']) {
    const inMore = items.some((t) => t.includes(want)), inBar = bar.some((t) => t.startsWith(want));
    if (inMore === inBar) errs.push(`${want} is ${inMore ? 'both on the toolbar and in More' : 'neither on the toolbar nor in More'}`);
  }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  // Check: at a glance, the facts; the marks' switches (once in ⋯, now Layers' Your route: #424's C)
  p.setTab('check'); await wait(100);
  if (p.els.stats.hidden || !p.els.stats.children.length) errs.push('Check lacks the stats');
  if (document.querySelector('#layers-panel').hidden) { document.querySelector('#btn-layers').click(); document.querySelector('#quick-layers .qt-more').click(); }
  await wait(300);
  const marks = [...document.querySelectorAll('#layers-body .onmap input')];
  if (marks.length !== 3) errs.push(`Layers' Your route has ${marks.length} switches`);
  else {
    const was = p.marks.km;
    marks[0].click(); await wait(100);
    if (p.marks.km === was) errs.push('Distance marks switch did nothing');
    p.setMarks({ km: was });
  }
  document.querySelector('#layers-panel [aria-label=Close]')?.click(); await wait(300);
  // Go: the time first, and taking it along
  p.setTab('go'); await wait(100);
  const head = document.querySelector('.time-head');
  if (!head || !/^(There|Back) at /.test(txt(head))) errs.push(`Time doesn't open with There at: ${txt(head)}`);
  if ([...document.querySelectorAll('.take-along button')].map(txt).join('|') !== 'Export GPX|Copy share link|Save offline…') errs.push('Take it along');
  if (!document.querySelector('#pl-tab-go .pl-tab-t').textContent) errs.push('Go’s tab shows no time');
  // the route's points on the profile where they are along it (a loop's finish at the end)
  const cp = p.chart.points || [];
  if (cp.length !== p.points.length || Math.abs(cp[cp.length - 1].d - p.analysis.total) > 2 || cp[0].kind !== 'start' || cp[cp.length - 1].kind !== 'end') errs.push(`points on the profile: ${JSON.stringify(cp.map((x) => [x.kind, Math.round(x.d)]))}`);
  // the panel's place: a button beside the fold on a wide screen (the side panel by default)
  if (innerWidth >= 900) {
    if (!p.els.dockBtn.offsetWidth) errs.push('no button for the panel’s place');
    else {
      const lay = p.layout();
      p.els.dockBtn.click(); await wait(200);
      if (p.layout() === lay) errs.push('the panel’s place button did nothing');
      p.els.dockBtn.click(); await wait(200);
    }
  }
  // the stretch you point at in Route's list lights up on the map and in the profile (25d's part 4)
  p.setTab('route'); await wait(100);
  const row = document.querySelector('.wpl-stretch[data-from="0"]'), s = { from: +row.dataset.from, to: +row.dataset.to };
  row.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  await wait(150);
  const lit = m.getSource('routeLit').serialize().data;
  if (!(lit.features && lit.features.length === 1)) errs.push('pointing at a stretch lit nothing on the map');
  const hl = p.chart.highlight;
  if (!hl || Math.abs(hl[0] - p.lengthTo(s.from)) > 1 || Math.abs(hl[1] - p.lengthTo(s.to)) > 1) errs.push(`the profile lit ${JSON.stringify(hl)}`);
  row.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
  await wait(150);
  if ((m.getSource('routeLit').serialize().data.features || []).length) errs.push('the leg stayed lit');
  if (/\bnull\b|undefined/.test(p.panel.textContent)) errs.push('“null” written in the drawer');
  // the tab is remembered, and the arrow keys move along the tabs
  p.setTab('route');
  p.els.tabs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  if (p.tab !== 'check' || JSON.parse(localStorage.getItem('polku:plannerTab')) !== 'check') errs.push('arrow keys / remembering the tab');
  p.setTab('route');
  p.clear();
  return errs;
})()"""


def drawer(chrome):
    fails = []
    for w, h_, phone, dock in [(1440, 900, False, 'left'), (390, 844, True, 'bottom')]:
        pg = chrome.page(w, h_, phone)
        pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': json.dumps(dock)}, '#13/61.50/23.78')
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        fails += [f'{w}: {e}' for e in pg.js(DRAWER, timeout=60000)]
        fails += [f'{w} console: {e[:160]}' for e in pg.errors()]
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the drawer in three tabs" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# The bug sweep after 15b. On the recorded Tykkikallio route with the map's Trail details off:
# the trail details along the route still come in (Heads-up was the same only with the layer
# on, so a gravel ride missed the fallen trees); a heads-up row's ⋯ hides its kind (listed at
# the end, to bring back) and says where to correct OpenStreetMap; the route menu stays inside
# a short window; with the map's sport changed, the planner still speaks the route's sport.
SWEEP = """(async () => {
  const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const fx = await (await fetch(location.origin + '/tools/fixtures/route-tykkikallio-mtb.json')).json();
  const { speedSummary } = await import(location.origin + '/js/speeds.js');
  p.checkWet = async () => {};
  p.wet = { on: false, mm: 0, at: Date.now() };
  if (polku.state.trailDetails) errs.push('the map’s trail details should be off for this test');
  p.setActive(true);
  p.restoreSnapshot(fx);
  const t0 = Date.now();
  while (!(p.analysis && p.analysis.trailMore) && Date.now() - t0 < 30000) await wait(250);
  const a = p.analysis;
  if (!a || !a.trailMore) return ['the trail details along the route never came in with the layer off'];
  const log = (a.trailWarn || []).find((w) => /^Log across/.test(w.text));
  if (!log) errs.push(`no log in Heads-up with the layer off: ${(a.trailWarn || []).map((w) => w.text).join(' / ')}`);
  else if (!(log.osm && log.osm.type === 'node' && log.osm.id > 0)) errs.push(`the log has no OSM node: ${JSON.stringify(log.osm)}`);
  p.reveal('warnings');
  await wait(300);
  const box = p.els.warnings;
  const row = () => [...box.querySelectorAll('.tier .row, .tier .warn-row')].find((r) => /Log across/.test(r.textContent));
  // what its ⋯ offered is on its card (25d part 3)
  const n0 = p.els.tabBtn.check.getAttribute('aria-label') || '';
  const logCard = row() ? (row().click(), await wait(300), p.cards.current && p.cards.current.kind === 'item' ? p.cards.box : null) : null;
  if (!logCard) errs.push('the log row opens no card');
  else {
    const items = [...logCard.querySelectorAll('.row')].map((b) => b.textContent);
    if (!items.some((t) => /^Hide “Fallen trees and logs”/.test(t))) errs.push(`the log's card: ${items.join(' / ') || 'nothing'}`);
    if (!items.some((t) => /Fix the map/.test(t)) || !items.some((t) => /Leave a note/.test(t))) errs.push(`the log's card has no OpenStreetMap links: ${items.join(' / ')}`);
    [...logCard.querySelectorAll('.row')].find((b) => /^Hide/.test(b.textContent))?.click();
    await wait(150);
    if (row()) errs.push('the log row still shows after Hide');
    if (p.cards.current) errs.push('the log\\'s card stays open after Hide');
    const chip = box.querySelector('.hidden-kinds .on-chip');
    if (!chip || !/Fallen trees and logs/.test(chip.textContent)) errs.push(`hidden kinds: ${box.querySelector('.hidden-kinds')?.textContent || 'none'}`);
    if (!(JSON.parse(localStorage.getItem('polku:hideWarn') || '{}').tree)) errs.push('Hide wasn’t kept');
    if ((p.els.tabBtn.check.getAttribute('aria-label') || '') === n0) errs.push(`Check's count with the log hidden: ${n0}`);
    chip?.click();
    await wait(150);
    if (!row()) errs.push('the log row didn’t come back from the hidden list');
  }
  // the route menu in a window too short for it: inside the window, every item reachable
  p.els.more.click();
  await wait(100);
  const m = document.querySelector('.menu-pop');
  if (!m) errs.push('the route menu didn’t open');
  else {
    const r = m.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) errs.push(`route menu ${Math.round(r.top)}–${Math.round(r.bottom)} in a ${innerHeight} px window`);
    if (m.scrollHeight > m.clientHeight + 1 && getComputedStyle(m).overflowY !== 'auto') errs.push('the route menu is cut off without a scroll');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(100);
    if (document.querySelector('.menu-pop')) errs.push('Escape didn’t close the route menu');
  }
  // the map's sport moves on, the route stays MTB: its time, style and colours stay MTB's
  polku.set({ activity: 'paddle' });
  await wait(600);
  if (p.isMulti()) errs.push('an MTB route counts as multisport with the map on Paddle');
  const sum = speedSummary('mtb', p.craft);
  // the speeds (Route's Your speed ›, #424's C) are MTB's, not the paddler's
  if (!p.els.howRows.textContent.includes(sum.name) || /Sea kayak|Canoe|SUP/.test(p.els.speedBox.textContent)) errs.push(`speeds: ${p.els.stats.textContent.slice(0, 80)} / ${p.els.speedBox.textContent.slice(0, 80)} (MTB: ${sum.name})`);
  if (p.panel.classList.contains('is-paddle')) errs.push('the planner looks like paddling for an MTB route');
  if (!p.modeApplies('grade')) errs.push('the gradient colours went with the map’s sport');
  polku.set({ activity: 'mtb' });
  localStorage.removeItem('polku:hideWarn');
  return errs;
})()"""


def sweep(chrome):
    pg = chrome.page(1280, 600, False)
    pg.open_app({'activity': 'mtb', 'trailsByActivity': {'mtb': {'trailDetails': False}}}, {'polku:plannerDock': '"left"'}, '#12/62.2289/25.7652')
    pg.js(SEED_TRAILS)
    fails = pg.js(SWEEP, timeout=60000)
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the bug sweep" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# The sport changes with a route drawn (#54: it used to route the legs again in the new sport,
# leaving a mixed route). From the map's sport pill the route keeps its sports (nothing routed
# again) and a toast offers to route it as the new one; that, and the planner's own picker, route
# the main sport only (the paddle leg stays) and Undo brings the route back.
SPORT_SWITCH = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [], $ = (s) => document.querySelector(s);
  const n = await import(location.origin + '/js/net.js'), P = await import(location.origin + '/js/planner.js'), U = await import(location.origin + '/js/ui.js');
  const p = polku.planner;
  p.setActive(true);
  p.clear();
  p.setMode('line');
  for (const q of [[23.700, 61.500], [23.720, 61.506], [23.745, 61.509], [23.760, 61.504]]) p.addPoint(q);
  p.setLegSport(1, 'paddle');
  for (let k = 0; k < 30 && !p.analysis; k++) await wait(200);
  const sports = () => p.legs.map((_, i) => p.legSport(i)).join(',');
  const keys = () => p.legs.map((l) => l.key).join('|');
  if (sports() !== 'mtb,paddle,mtb') errs.push(`start: ${sports()}`);
  const k0 = keys();
  // the map's sport (Settings had it, a link, Only the legs you draw next): the route keeps its sports and isn't routed again
  polku.set({ activity: 'gravel' });
  await wait(500);
  if (sports() !== 'mtb,paddle,mtb') errs.push(`after the map’s sport changed: ${sports()}`);
  if (keys() !== k0) errs.push('legs routed again after the map’s sport changed');
  if (!/The map and the legs you draw next are Gravel now\. Your route stays MTB and Paddle\./.test($('#toast')?.textContent || '')) errs.push(`toast: ${$('#toast')?.textContent}`);
  if (p.nextSport() !== 'gravel' || p.mainSport() !== 'mtb') errs.push(`the next leg ${p.nextSport()}, the route ${p.mainSport()}`);
  // Undo after it: the legs that followed MTB stay MTB (they took the map's sport before)
  p.undo(); await wait(300);
  if (sports() !== 'mtb,mtb,mtb') errs.push(`Undo after the map’s sport changed: ${sports()}`);
  p.redo(); await wait(300);
  // the pill asks when the sport isn't the route's (option A of B): Keep changes nothing
  const pick = async (k) => { $('#activity-bar .act-current').click(); await wait(200); $(`#activity-bar .act[data-k=${k}]`).click(); await wait(200); };
  await pick('hike');
  const q = $('#activity-bar .act-q')?.textContent, all = $('#activity-bar .act-all')?.textContent || '';
  if (q !== 'Use Hike for…' || !/Polku plans the 2 MTB legs again as Hike, with new times and checks/.test(all) || !/The Paddle legs stay as they are/.test(all)) errs.push(`the question: ${q} / ${all}`);
  $('#activity-bar .act-keep').click(); await wait(300);
  if (polku.state.activity !== 'gravel' || sports() !== 'mtb,paddle,mtb' || !$('#activity-bar .act-menu').hidden) errs.push(`Keep: ${polku.state.activity}, ${sports()}`);
  // The whole route: one step of Undo brings back the legs, the map's sport and the next leg's
  await pick('hike');
  $('#activity-bar .act-all').click(); await wait(500);
  if (sports() !== 'hike,paddle,hike' || polku.state.activity !== 'hike' || p.nextSport() !== 'hike') errs.push(`The whole route: ${sports()}, the map ${polku.state.activity}, the next leg ${p.nextSport()}`);
  if (!/^Your route is Hike now: 2 legs planned again\./.test($('#toast')?.textContent || '')) errs.push(`its toast: ${$('#toast')?.textContent}`);
  p.undo(); await wait(500);
  if (sports() !== 'mtb,paddle,mtb' || polku.state.activity !== 'gravel' || p.nextSport() !== 'gravel' || keys() !== k0) errs.push(`Undo after The whole route: ${sports()}, the map ${polku.state.activity}, the next leg ${p.nextSport()}`);
  // from land to the water: not offered, and it says why; only the legs drawn next
  await pick('swim');
  const no = $('#activity-bar .act-all');
  if (no?.getAttribute('aria-disabled') !== 'true' || !/its MTB legs are on land and can’t be swum/.test(no.textContent)) errs.push(`Swim for the whole route: ${no && no.textContent}`);
  no?.click(); await wait(200);
  if (sports() !== 'mtb,paddle,mtb') errs.push(`a click on the whole route that isn't offered: ${sports()}`);
  $('#activity-bar .act-next').click(); await wait(400);
  if (sports() !== 'mtb,paddle,mtb' || p.nextLegSport() !== 'swim' || polku.state.activity !== 'swim') errs.push(`Only the legs you draw next: ${sports()}, the next leg ${p.nextLegSport()}`);
  // #71: a shared route's style is the route's: the map's sport changes nothing, nor do a reload and its share link
  U.store.set('styles', { mtb: { p: 'balanced', v: {}, wet: 'auto' } });
  polku.set({ activity: 'mtb' }); await wait(300);
  p.clear();
  const G = await import(location.origin + '/js/geo.js');
  p.restore(P.parseShared(new URLSearchParams('r=' + encodeURIComponent(G.encodePolyline([[23.700, 61.500], [23.712, 61.505], [23.724, 61.510]])) + '&m=ll&a=mtb&p=flowy')));
  await wait(400);
  const rk = () => p.legs.map((_, i) => p.routerFor(i).key).join('|'), r0 = rk();
  if (p.styleOf('mtb').p !== 'flowy') errs.push(`the link's style: ${p.styleOf('mtb').p}`);
  polku.set({ activity: 'paddle' }); await wait(400);
  if (rk() !== r0 || p.legStyle(0).p !== 'flowy') errs.push(`#71: the map on Paddle changed the route's style: ${p.legStyle(0).p}`);
  let got = null; const hz = p.app.hazards; p.app.hazards = async (a, o) => { got = o.activity; return []; };
  await p.loadHazards(p.analysis || { pts: [] }); p.app.hazards = hz;
  if (got !== 'mtb') errs.push(`#71: the checks along the route use ${got}, not the route's MTB`);
  p.save(); p.legs = []; p.points = []; p.loadSaved(); await wait(400);
  if (rk() !== r0) errs.push(`#71: the style after a reload: ${p.legStyle(0).p}`);
  const url = p.shareUrl(); p.clear(); p.restore(P.parseShared(new URL(url).searchParams)); await wait(400);
  if (rk() !== r0) errs.push(`#71: the style from its share link (${url.split('?')[1]}): ${p.legStyle(0).p}`);
  // the Weather button while planning opens or closes the timeline over the map; the planner keeps its tab (#225)
  const tab0 = p.tab, bar = $('#wx-bar'), open0 = !bar.hidden;
  $('#btn-time').click();
  await wait(200);
  if (p.tab !== tab0 || bar.closest('#planner') || bar.hidden !== open0) errs.push(`the Weather button while planning: the tab ${p.tab} (was ${tab0}), the timeline ${bar.hidden ? 'closed' : 'open'} (was ${open0 ? 'open' : 'closed'})${bar.closest('#planner') ? ', in the planner' : ''}`);
  if (bar.hidden !== open0) $('#btn-time').click();
  if (n.usage().some((u) => /^brouter|^valhalla/.test(u.id) && u.session)) errs.push('a routing request (straight legs need none)');
  p.clear();
  polku.set({ activity: 'mtb' });
  return errs;
})()"""


def sport_switch(chrome):
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#13/61.505/23.73')
    pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
    fails = pg.js(SPORT_SWITCH, timeout=60000)
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} changing the sport with a route" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Winter (phase 15a): Auto / On / Off; the winter ways from a recorded OSM tile at
# Laajavuori drawn in Trailmap's classes; LIPAS's ski tracks asked for in winter; the
# Winter group in Layers; FMI's measured snow read from its WFS answer; the snow chip.
WINTER = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const W = await import(location.origin + '/js/winter.js');
  const fx = await (await fetch(location.origin + '/tools/fixtures/winter-laajavuori.json')).json();
  // the classes
  const c = (t) => W.winterClass(t);
  const want = [[{ 'bicycle:winter': 'no', highway: 'track' }, 'closed'], [{ 'piste:type': 'nordic' }, 'ski'], [{ highway: 'cycleway', 'piste:type': 'nordic', bicycle: 'yes' }, 'groomed'],
    [{ highway: 'track', 'piste:type': 'nordic', 'bicycle:winter': 'no' }, 'closed'], [{ highway: 'cycleway', snowplowing: 'yes' }, 'ploughed'],
    [{ highway: 'cycleway', winter_service: 'limited' }, 'unploughed'], [{ highway: 'path', 'mtb:winter': '1' }, 'open1'], [{ highway: 'path', 'mtb:winter': 'yes' }, 'open2'],
    [{ highway: 'path', 'mtb:winter': '3' }, 'open3'], [{ highway: 'path', seasonal: 'winter' }, 'seasonal'], [{ highway: 'path' }, null]];
  for (const [t, k] of want) if (c(t) !== k) errs.push(`class of ${JSON.stringify(t)}: ${c(t)}`);
  // FMI's answer: the latest value per station, -1 is no snow
  const xml = '<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:BsWfs="http://xml.fmi.fi/schema/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2"><wfs:member><BsWfs:BsWfsElement><BsWfs:Location><gml:Point><gml:pos>62.40 25.68 </gml:pos></gml:Point></BsWfs:Location><BsWfs:Time>2026-01-10T08:00:00Z</BsWfs:Time><BsWfs:ParameterName>snow_aws</BsWfs:ParameterName><BsWfs:ParameterValue>31.0</BsWfs:ParameterValue></BsWfs:BsWfsElement></wfs:member><wfs:member><BsWfs:BsWfsElement><BsWfs:Location><gml:Point><gml:pos>62.40 25.68 </gml:pos></gml:Point></BsWfs:Location><BsWfs:Time>2026-01-10T09:00:00Z</BsWfs:Time><BsWfs:ParameterName>snow_aws</BsWfs:ParameterName><BsWfs:ParameterValue>33.0</BsWfs:ParameterValue></BsWfs:BsWfsElement></wfs:member><wfs:member><BsWfs:BsWfsElement><BsWfs:Location><gml:Point><gml:pos>60.20 24.90 </gml:pos></gml:Point></BsWfs:Location><BsWfs:Time>2026-01-10T09:00:00Z</BsWfs:Time><BsWfs:ParameterName>snow_aws</BsWfs:ParameterName><BsWfs:ParameterValue>-1.0</BsWfs:ParameterValue></BsWfs:BsWfsElement></wfs:member></wfs:FeatureCollection>';
  const obs = W.parseSnow(xml);
  if (obs.length !== 2 || obs.find((o) => o.ll[1] === 62.4).cm !== 33 || obs.find((o) => o.ll[1] === 60.2).cm !== 0) errs.push(`FMI parse: ${JSON.stringify(obs)}`);
  const near = W.snowNear(obs, [25.72, 62.26], 60);
  if (!near || near.cm !== 33) errs.push(`nearest station: ${JSON.stringify(near)}`);
  // Auto: on from 5 cm, off below 2 (no flicker between); On and Off are yours
  W.setWinterSetting('auto');
  if (W.isWinter(4, false) || !W.isWinter(5, false) || !W.isWinter(3, true) || W.isWinter(1, true) || W.isWinter(null, false) || !W.isWinter(null, true)) errs.push('auto thresholds');
  W.setWinterSetting('on'); if (!W.isWinter(0, false)) errs.push('On');
  W.setWinterSetting('off'); if (W.isWinter(50, true)) errs.push('Off');
  W.setWinterSetting('on');
  // the map in winter: the recorded tile, drawn
  W.holdWinterFetches(true);
  W.seedWinterTile(fx.x, fx.y, fx.data);
  polku.map.jumpTo({ center: [25.715, 62.258], zoom: 14 });
  await wait(600);
  if (document.querySelector('#layers-panel').hidden) { document.querySelector('#btn-layers').click(); document.querySelector('#quick-layers .qt-more').click(); } // Layers, then More: the full panel
  await wait(400);
  const segs = [...document.querySelectorAll('#layers-body .lg-group')].find((g) => /^Winter/.test(g.querySelector('.lg-title').textContent));
  if (!segs) return [...errs, 'no Winter group in Layers'];
  [...segs.querySelectorAll('.seg button')].find((b) => b.textContent === 'On').click();
  await wait(800);
  if (!polku.state.winterOn) errs.push('winter not on');
  if (!document.querySelector('.act-winter')) errs.push('no winter badge on the sport');
  for (let k = 0; k < 20 && !polku.map.querySourceFeatures('winterWays').length; k++) await wait(250);
  const cls = {}; for (const f of polku.map.querySourceFeatures('winterWays')) cls[f.properties.cls] = 1;
  for (const k of ['ski', 'open1', 'open2', 'ploughed']) if (!cls[k]) errs.push(`no ${k} ways drawn (${Object.keys(cls).join(', ')})`);
  for (const id of ['winter-way', 'winter-ski', 'winter-ski-gap', 'winter-closed']) if (!polku.map.getLayer(id)) errs.push(`no layer ${id}`);
  if (!polku.lipas.routeTypes.includes(4402)) errs.push(`LIPAS ski tracks not asked for: ${polku.lipas.routeTypes}`);
  // off again: the winter layers go
  const g2 = [...document.querySelectorAll('#layers-body .lg-group')].find((g) => /^Winter/.test(g.querySelector('.lg-title').textContent));
  [...g2.querySelectorAll('.seg button')].find((b) => b.textContent === 'Off').click();
  await wait(800);
  if (polku.state.winterOn || polku.map.getLayer('winter-way') || polku.lipas.routeTypes.includes(4402)) errs.push('winter layers stay after Off');
  // the Winter trail colours: the winter ways any time, winter or not
  const trails = [...document.querySelectorAll('#layers-body .lg-group')].find((g) => /^Trails/.test(g.querySelector('.lg-title').textContent));
  trails.open = true;
  const wbtn = [...trails.querySelectorAll('.seg button')].find((b) => b.textContent === 'Winter');
  if (!wbtn) errs.push('no Winter in the trail colours');
  else {
    wbtn.click();
    await wait(800);
    for (let k = 0; k < 20 && !polku.map.querySourceFeatures('winterWays').length; k++) await wait(250);
    if (!polku.map.getLayer('winter-way') || !polku.map.querySourceFeatures('winterWays').length) errs.push('Winter trail colours (winter off): no winter ways');
    if (polku.map.getLayer('uphill-line')) errs.push('uphill colours with Winter picked');
    // the colours are explained: a click on a ski track's line (no trail under it) opens its card
    document.querySelector('#layers-panel .panel-close, #layers-panel [aria-label^=Close]')?.click();
    const ski = polku.map.queryRenderedFeatures({ layers: ['winter-ski'] })[0];
    if (!ski) errs.push('no ski track in view to click');
    else {
      const cc = ski.geometry.type === 'MultiLineString' ? ski.geometry.coordinates[0] : ski.geometry.coordinates, q = polku.map.project(cc[Math.floor(cc.length / 2)]);
      polku.map.fire('click', { point: q, lngLat: polku.map.unproject(q), originalEvent: new MouseEvent('click') });
      await wait(900);
      const card = document.querySelector('.pl-way.card')?.textContent || ''; // (the spot's card, 25d part 6)
      if (!/Ski track/.test(card) || !/keep off on foot and by bike/i.test(card)) errs.push(`ski track card: ${card.slice(0, 120)}`);
      polku.planner.cards.close();
      await wait(300);
    }
    if (document.querySelector('#layers-panel').hidden) { document.querySelector('#btn-layers').click(); document.querySelector('#quick-layers .qt-more').click(); } // Layers, then More: the full panel
    await wait(400);
    const t2 = [...document.querySelectorAll('#layers-body .lg-group')].find((g) => /^Trails/.test(g.querySelector('.lg-title').textContent));
    [...t2.querySelectorAll('.seg button')].find((b) => b.textContent === 'Difficulty').click();
    await wait(500);
  }
  // the snow chip on the timeline
  if (!document.querySelector('.tl-layers [data-k=snow]')) errs.push('no Snow on the timeline');
  W.setWinterSetting('auto');
  return errs;
})()"""


def winter(chrome):
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#13/62.258/25.715')
    pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
    fails = pg.js(WINTER, timeout=60000)
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} winter on the map" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Clicks and taps on the route: a click or a tap on the line, or on a leg's handle, opens
# that part's menu and adds no point (its first button does); with the planner closed, a
# click on the route opens it with that part's menu; a LIPAS route drawn over a trail is
# what a click there picks.
ROUTE_MENU = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const I = await import(location.origin + '/js/inspect.js');
  const pick = I.pickFeature([{ layer: { id: 'path-ground' } }, { layer: { id: 'lipas-route' } }]);
  if (!pick || pick.layer.id !== 'lipas-route') errs.push(`a LIPAS route over a trail picks ${pick && pick.layer.id}`);
  const p = polku.planner, m = polku.map;
  p.setActive(true);
  p.clear();
  p.setMode('line');
  p.addPoint([23.750, 61.500]);
  p.addPoint([23.770, 61.505]);
  await wait(500);
  m.jumpTo({ center: [23.760, 61.5025], zoom: 14 });
  await wait(600);
  // (where the line is now: a card that opens moves the map to keep itself in view)
  const fire = () => { const q = m.project([23.760, 61.5025]); m.fire('click', { point: q, lngLat: m.unproject(q), originalEvent: new MouseEvent('click') }); };
  // the route's card (25d's 1b): Add a point here its first button on a desktop
  const card = () => (p.cards.current && p.cards.current.kind === 'route' ? document.querySelector('.pl-way.card') : null);
  const add = () => card() && [...card().querySelectorAll('.btn')].find((b) => /Add a point here/.test(b.textContent));
  fire();
  await wait(300);
  if (p.points.length !== 2) errs.push(`a click on the line added a point (${p.points.length})`);
  if (!add()) errs.push('a click on the line: no card for that part of the route');
  p.cards.close();
  const g = p.ghosts[0] && p.ghosts[0].getElement();
  if (!g) errs.push('no handle on the leg');
  else {
    g.click();
    await wait(300);
    if (p.points.length !== 2) errs.push(`a click on the leg's handle added a point (${p.points.length})`);
    if (!add()) errs.push("a click on the leg's handle: no card for that part");
    p.cards.close();
  }
  p.lastTouchAt = Date.now();
  fire();
  await wait(300);
  if (p.points.length !== 2) errs.push(`a tap on the line added a point (${p.points.length})`);
  if (!add()) errs.push('a tap on the line: no card for that part of the route');
  else {
    add().click();
    await wait(300);
    if (p.points.length !== 3) errs.push(`"Add a point here": ${p.points.length} points`);
    p.undo();
    await wait(300);
  }
  p.cards.close();
  p.lastTouchAt = 0;
  p.setActive(false);
  await wait(400);
  fire();
  await wait(600);
  if (!p.active) errs.push('a click on the route (planner closed) did not open the planner');
  if (p.points.length !== 2) errs.push(`opening the planner from the route: ${p.points.length} points`);
  if (!card()) errs.push('opening the planner from the route: no card for that part');
  p.cards.close();
  // the points' markers sit on their points (a CSS rule once made them stack down the page)
  p.setActive(true);
  p.clear();
  for (const q of [[23.750, 61.500], [23.770, 61.505], [23.760, 61.495]]) p.addPoint(q);
  await wait(400);
  const off = p.markers.map((mk, i) => { const r = mk.getElement().getBoundingClientRect(), c = m.getCanvas().getBoundingClientRect(), q2 = m.project(p.points[i]); return Math.round(Math.hypot(r.left + r.width / 2 - c.left - q2.x, r.top + r.height / 2 - c.top - q2.y)); });
  if (off.some((d) => d > 2)) errs.push(`markers off their points by ${off.join(', ')} px`);
  p.clear();
  return errs;
})()"""


# Exercise the buttons, not the planner method: round-trip state once shadowed
# the action and every Back to start entry point threw instead of adding a leg.
BACK_TO_START = """(async (entry) => {
  const p = polku.planner, errs = [], wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const ready = async (count) => {
    const end = Date.now() + 10000;
    while (Date.now() < end) {
      if (p.legs.length === count && p.legs.every((l) => l.status === 'ok')) return true;
      await wait(50);
    }
    return false;
  };
  p.setActive(true);
  p.setMode('line');
  for (const q of [[23.750, 61.500], [23.770, 61.505], [23.760, 61.495]]) p.addPoint(q);
  if (!await ready(2)) return ['initial straight legs did not finish'];
  if (entry === 'finish') {
    p.setLegSport(1, 'paddle');
    if (!await ready(2)) return ['mixed-sport straight legs did not finish'];
  }
  const sports = p.legs.map((_, i) => p.legSport(i));
  p.reveal('points');
  const before = p.snapshot(), past = p.past.length;
  if (entry === 'finish') p.markers[p.markers.length - 1].getElement().click();
  const selector = entry === 'finish' ? '.pl-way.card .row[title="Adds a leg back to the start"]'
    : entry === 'toolbar' ? '#pl-tools button[aria-label="Back to start"]' // the desktop toolbar (25a), room for it at 1920
    : 'button[title="Route back to where you started"]';
  const button = document.querySelector(selector);
  if (!button || button.disabled || !button.getClientRects().length) return [`${entry}: button unavailable`];
  button.click();
  if (p.points.length !== before.points.length + 1) return [`${entry}: did not add one closing point`];
  if (!same(p.points.slice(0, -1), before.points)) errs.push('changed existing points');
  if (!same(p.points[p.points.length - 1], before.points[0])) errs.push('finish is not the start');
  if (p.past.length !== past + 1) errs.push('closing the route did not make one undo step');
  if (!await ready(3)) errs.push('closing leg did not finish');
  else {
    const leg = p.legs[p.legs.length - 1], coords = leg.result.coords;
    if (leg.mode !== 'line') errs.push('closing leg ignored the selected routing mode');
    if (!same(p.legs.map((_, i) => p.legSport(i)), [...sports, sports[sports.length - 1]])) errs.push('closing leg changed the route sports or did not continue the last sport');
    if (!same(coords[0], before.points[before.points.length - 1]) || !same(coords[coords.length - 1], before.points[0])) errs.push('closing geometry does not join the old finish to the start');
  }
  const closed = p.snapshot(), closedPast = p.past.length;
  if (entry === 'finish') p.markers[p.markers.length - 1].getElement().click();
  const again = document.querySelector(selector);
  if (again) {
    if (!again.disabled) errs.push('Back to start is still enabled on a closed route');
    again.click();
  }
  if (!same(p.snapshot(), closed) || p.past.length !== closedPast) errs.push('closed route gained another closing leg or undo step');
  p.els.undo.click();
  if (!await ready(2) || !same(p.snapshot(), before)) errs.push('Undo did not restore the original route');
  if (p.past.length !== past) errs.push('Undo did not restore the history position');
  return errs;
})"""


def back_to_start(chrome):
    ok = True
    for entry, w, h, phone, dock in [('waypoints', 1440, 900, False, 'left'),
                                    ('finish', 390, 844, True, 'left'),
                                    ('toolbar', 1920, 1080, False, 'bottom')]:
        pg = chrome.page(w, h, phone)
        try:
            pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': json.dumps(dock)})
            pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
            fails = pg.js(BACK_TO_START + '(' + json.dumps(entry) + ')')
            fails += [f'console: {e[:160]}' for e in pg.errors()]
        finally:
            pg.close()
        print(f"{'ok  ' if not fails else 'FAIL'} Back to start: {entry} ({w}x{h})" + ''.join(f'\n     - {f}' for f in fails), flush=True)
        ok = not fails and ok
    return ok


def route_menu(chrome):
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#13/61.5025/23.76')
    pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
    fails = pg.js(ROUTE_MENU, timeout=60000)
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} clicks and taps on the route" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# A quick tap on a busy page is still a tap (#293). The finger is up after 50 ms by the touch's own
# times, but the touchend reaches the page only once Polku's hold timer has run, as when a long
# frame on a slow phone holds it up. Polku's hold timers (the spot's card's 500 ms, the line's 300 and 500 ms)
# then run before it sees the touchend. On the empty map the tap puts the start down and opens no
# card; on the line it opens the route's card, with the route as it was and nothing in Undo.
# A finger really held 0.8 s still gets the spot's card (25d part 5).
QUICK_TAPS = """(() => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), p = polku.planner, m = polku.map;
  const title = () => (p.cards.current ? `the ${p.cards.current.kind}'s card` : '');
  // (the spot, or one a little way up the map where something sits over it: the scale moves with the sheet's size)
  const at = (ll) => {
    let under = 'nothing';
    const sheet = p.panel.hidden ? innerHeight : p.panel.getBoundingClientRect().top; // (above the planner's sheet, a taller one on a runner with wider fonts)
    for (const up of [0, 0.0006, 0.0012, 0.0018, 0.003, 0.0045]) {
      const q = m.project([ll[0], ll[1] + up]), el = document.elementFromPoint(q.x, q.y);
      if (el === m.getCanvas() && q.y < sheet - 40) return { x: q.x, y: q.y };
      under = el ? el.id || el.className || el.tagName : 'nothing';
    }
    return { under };
  };
  // nothing open over the map (Clear route's note too: over a taller start it can reach the spot), the sheet low,
  // the map where it started
  const tidy = async () => {
    if (p.menu) p.menu.remove();
    p.cards.close();
    const t = document.querySelector('#toast');
    t.classList.remove('show'); t.hidden = true;
    if (p.closeStartTip) p.closeStartTip(); // (before 25b: the first point's card)
    p.setSheetState('peek');
    await wait(600);
    m.jumpTo({ center: [23.76, 61.5025], zoom: 13 });
    await new Promise((ok) => { const t = setTimeout(ok, 5000); m.once('idle', () => { clearTimeout(t); ok(); }); });
  };
  // until the hold's timer has run: the spot's card open, or Edit this stretch
  const until = (ok) => new Promise((done) => { const t0 = Date.now(), f = () => (ok() || Date.now() - t0 > 3000 ? done(true) : setTimeout(f, 20)); f(); });
  const A = [23.752, 61.5005], B = [23.768, 61.5045], EMPTY = [23.752, 61.5050];
  // what the cards and the hold did, for a FAIL line
  const seen = [], t00 = performance.now(), open = p.cards.open.bind(p.cards), close = p.cards.close.bind(p.cards);
  const stamp = (what) => seen.push(`${what} ${Math.round(performance.now() - t00)}`);
  p.cards.open = (c, o) => { stamp(`open ${c.kind}`); return open(c, o); };
  p.cards.close = (o) => { if (p.cards.current) stamp(`close ${p.cards.current.kind}`); return close(o); };
  for (const k of ['touchstart', 'touchend']) m.on(k, (e) => stamp(`${k} (event ${Math.round(e.originalEvent.timeStamp)})`));
  window.qt = {
    seen: () => seen.splice(0).slice(-14).join(', ') || 'nothing',
    heldMenu: () => until(() => title() === "the spot's card"),
    heldLine: () => until(() => title() === "the edit's card"),
    async empty() {
      p.setActive(true); p.clear(); p.setMode('line');
      await tidy();
      return at(EMPTY);
    },
    async emptyTapped() {
      await wait(1500);
      if (p.points.length !== 1) return [`a quick tap on the empty map of a busy page added ${p.points.length} points, not the start${title() ? `, and “${title()}” is open` : ''}`];
      return title() ? [`a quick tap on the empty map of a busy page opened “${title()}”`] : [];
    },
    async line() {
      p.clear(); p.addPoint(A); p.addPoint(B);
      await wait(600);
      await tidy();
      qt.past = p.past.length;
      return at([A[0] + (B[0] - A[0]) / 3, A[1] + (B[1] - A[1]) / 3]); // the midpoint has its handle
    },
    async lineTapped() {
      await wait(1500);
      const errs = [];
      if (p.points.length !== 2) errs.push(`a quick tap on the line of a busy page left ${p.points.length} points, not 2`);
      if (p.past.length !== qt.past) errs.push(`a quick tap on the line of a busy page put ${p.past.length - qt.past} steps in Undo`);
      const kind = p.cards.current && p.cards.current.kind;
      if (kind !== 'route') errs.push(`a quick tap on the line of a busy page opened ${kind ? `a ${kind} card` : title() ? `“${title()}”` : 'nothing'}, not the route's card (25d's 1b)`);
      if (document.body.classList.contains('route-editing')) errs.push('still editing after a quick tap on the line');
      if (p.menu) p.menu.remove();
      p.cards.close();
      return errs;
    },
    // as the finger lifts (headless Chrome then clicks where it was, on the menu)
    async held() {
      p.clear();
      await tidy();
      const f = () => { window.removeEventListener('touchend', f); qt.lift = { menu: title(), heldOff: Date.now() < p.noClickUntil }; };
      window.addEventListener('touchend', f);
      qt.lift = null;
      return at(EMPTY);
    },
    async heldDone() {
      await wait(1000);
      const errs = [], l = qt.lift || {};
      if (l.menu !== "the spot's card" || !l.heldOff) errs.push(`a finger held 0.8 s on the map, as it lifts: ${l.menu || 'no card'}, clicks ${l.heldOff ? '' : 'not '}held off (${qt.seen()})`);
      if (p.points.length) errs.push(`a finger held 0.8 s on the map added ${p.points.length} points`);
      p.cards.close();
      return errs;
    },
  };
  return true;
})()"""


def quick_taps(chrome):
    pg = chrome.page(390, 844, True)
    fails = []
    try:
        pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#13/61.5025/23.76')
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        pg.js(QUICK_TAPS)
        # a quick tap on the empty map, one on the line, and a finger really held 0.8 s
        for setup, ms, hold, done in [('qt.empty()', 50, 'qt.heldMenu()', 'qt.emptyTapped()'), ('qt.line()', 50, 'qt.heldLine()', 'qt.lineTapped()'), ('qt.held()', 800, 'qt.heldMenu()', 'qt.heldDone()')]:
            s = pg.js(setup)
            if 'under' in s:
                fails.append(f"{setup}: the spot is under {s['under']}")
                continue
            # (what's under the finger as it goes down: a touch that no card or map handler logs wasn't the map's)
            pg.js(f"window.qtUnder = (() => {{ const e = document.elementFromPoint({s['x']}, {s['y']}); return e ? e.id || String(e.className.baseVal ?? e.className) : 'nothing'; }})(); true")
            pg.quick_tap(s['x'], s['y'], ms=ms, after=hold)
            fails += [f"{e} [the finger at {round(s['x'])},{round(s['y'])} on {pg.js('window.qtUnder')}]" for e in pg.js(done)]
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} quick taps on a busy page" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# What the route shows: a point beside its path snaps onto the routed line (no routing
# again); a multisport route gets the sport strip and the Sport colours; distance marks
# along the line; the sun at the start, and sunrise / sunset maths; a tap beside an
# open menu only closes it.
ROUTE_BITS = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const S = await import(location.origin + '/js/sun.js');
  const f = (t) => new Date(t * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' });
  const sun = S.sunTimes(Date.parse('2026-10-14T12:00:00+03:00') / 1000, [24.94, 60.17]);
  if (f(sun.rise) !== '07:57' || f(sun.set) !== '18:17') errs.push(`Helsinki 14 Oct: sunrise ${f(sun.rise)}, sunset ${f(sun.set)} (07:57, 18:17 expected)`);
  if (S.sunTimes(Date.parse('2026-06-21T12:00:00+03:00') / 1000, [27.03, 69.91]).day !== 'polar-day') errs.push('no midnight sun in Utsjoki at midsummer');
  const p = polku.planner, m = polku.map;
  p.setActive(true);
  p.clear();
  p.setMode('line');
  for (const q of [[23.700, 61.500], [23.720, 61.506], [23.745, 61.509], [23.760, 61.504]]) p.addPoint(q);
  p.setLegSport(1, 'paddle');
  for (let k = 0; k < 30 && !(p.analysis && p.analysis.waits && p.analysis.waits.length); k++) await wait(200);
  if (!p.chart.segs || p.chart.segs.length !== 3 || document.querySelectorAll('.chart-sport').length < 2) errs.push(`sport strip: ${p.chart.segs ? p.chart.segs.length : 0} stretches, ${document.querySelectorAll('.chart-sport').length} icons`);
  if (!p.modeApplies('sport')) errs.push('no Sport colours for a multisport route');
  const marks = await m.getSource('routeMarks').getData();
  if (marks.features.length !== Math.floor(p.analysis.total / 1000)) errs.push(`${marks.features.length} distance marks on ${(p.analysis.total / 1000).toFixed(1)} km`);
  p.setMarks({ km: false });
  if ((await m.getSource('routeMarks').getData()).features.length) errs.push('distance marks stay when switched off');
  p.setMarks({ km: true });
  // the route coloured on the map, then cleared: nothing of it stays
  if (p.pickColor) { p.pickColor('grade'); p.setColorOnMap(true); }
  await wait(300);
  const coloured = (await m.getSource('routeColor').getData()).features.length;
  p.clear();
  await wait(400);
  const left = (await m.getSource('routeColor').getData()).features.length + (await m.getSource('routeMarks').getData()).features.length;
  if (!coloured || left) errs.push(`colours on the map: ${coloured} before clearing, ${left} after`);
  p.undo();
  for (let k = 0; k < 30 && !p.analysis; k++) await wait(200);
  p.setColorOnMap(false);
  p.reveal('depart');
  await wait(200);
  if (!/Sunrise|Midnight sun|Polar night/.test(document.querySelector('.sun-line')?.textContent || '')) errs.push('no sun times in Departure & weather');
  // a point beside its path: the routed leg starts 30 m away, so the point moves onto it, and its key with it
  p.clear();
  p.setMode('auto');
  p.points = [[23.7600, 61.5000], [23.7700, 61.5040]];
  const c = [[23.7605, 61.5002], [23.7650, 61.5020], [23.7698, 61.5039]];
  p.legs = [{ mode: 'auto', status: 'ok', result: { coords: c.map((x) => x.slice()), tags: [{}, {}], portage: [] } }];
  if (!p.snapPoints() || p.points[0][0] !== 23.7605 || p.points[1][0] !== 23.7698) errs.push(`a point beside the path didn't snap: ${JSON.stringify(p.points)}`);
  if (p.legs[0].key !== p.legKey(0).key) errs.push('the snapped leg would be routed again');
  // a tap beside an open menu: closes it, adds nothing
  p.clear();
  p.setMode('line');
  p.addPoint([23.750, 61.500]);
  p.addPoint([23.770, 61.505]);
  await wait(300);
  p.openPointCard(p.points[1]);
  const q = m.project([23.740, 61.495]);
  m.fire('mousedown', { point: q, lngLat: m.unproject(q), originalEvent: new MouseEvent('mousedown') });
  m.fire('click', { point: q, lngLat: m.unproject(q), originalEvent: new MouseEvent('click') });
  await wait(200);
  if (p.points.length !== 2) errs.push(`a click beside an open card added a point (${p.points.length})`);
  if (p.cards.current) errs.push('a click beside an open card left it open');
  p.openPointCard(p.points[0]);
  if (![...document.querySelectorAll('.pl-way.card .way-x')].some((b) => b.getClientRects().length)) errs.push('the point’s card has no close button');
  if (![...document.querySelectorAll('.pl-way.card .row b')].some((b) => b.textContent === 'Leave')) errs.push('no Leave in the start point’s card');
  p.cards.close();
  p.clear();
  return errs;
})()"""


def route_bits(chrome):
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#13/61.505/23.73')
    pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
    fails = pg.js(ROUTE_BITS, timeout=60000)
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} what the route shows" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Terrain that doesn't load (#72), on a straight hiking route over made-up hills: first no
# terrain tile at all, then some (one a bad file, the coarser zooms failing) after a tap
# on Retry, then all of them, with no tap: Polku tries again on its own.
TERRAIN = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const A = await import(location.origin + '/js/analysis.js');
  const p = polku.planner, realFetch = window.fetch;
  // terrarium tiles whose height goes by the longitude: 120 m ± 20, a hill every 0.02° (about 1 km)
  const tile = async (z, x) => {
    const S = 256, c = new OffscreenCanvas(S, S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S);
    for (let px = 0; px < S; px++) {
      const lon = ((x + (px + 0.5) / S) / 2 ** z) * 360 - 180, v = 120 + 20 * Math.sin((lon * Math.PI * 2) / 0.02) + 32768;
      for (let py = 0; py < S; py++) img.data.set([Math.floor(v / 256), Math.floor(v) % 256, Math.floor((v % 1) * 256), 255], (py * S + px) * 4);
    }
    ctx.putImageData(img, 0, 0);
    return new Response(await c.convertToBlob({ type: 'image/png' }));
  };
  let mode = 'fail';
  const asked = [];
  window.fetch = (url, init) => {
    const m = /tiles\\.mapterhorn\\.com\\/(\\d+)\\/(\\d+)\\/(\\d+)/.exec(String(url));
    if (!m) return realFetch(url, init);
    const [z, x] = [+m[1], +m[2]];
    asked.push(`${mode} ${z}/${x}/${m[3]}`);
    if (mode === 'fail' || (mode === 'some' && z < 14)) return Promise.reject(new TypeError('Failed to fetch'));
    if (mode === 'some' && x === 9276) return Promise.resolve(new Response('not a picture')); // the route's middle tile
    return tile(z, x);
  };
  const next = async (old, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (p.analysis && p.analysis !== old && p.analysis.pts.length > 100) return p.analysis; await wait(200); } return null; };
  const shown = () => document.querySelector('#planner').innerText;
  const heads = () => document.querySelector('[data-sec=warnings]').textContent;
  const elev = () => (document.querySelector('.sum-elev') || {}).textContent || '';
  const garbled = (when) => { const m = /NaN|Infinity|Invalid Date/.exec(shown()); if (m) errs.push(`${when}: the planner shows ${m[0]}`); };
  try {
    p.setActive(true);
    p.clear();
    p.setMode('line');
    for (const q of [[23.80, 61.509], [23.817, 61.519], [23.838, 61.516], [23.86, 61.51]]) p.addPoint(q);
    p.reveal('warnings');
    // 1. no terrain at all: timed by distance on the flat, the climbing unknown, and said so
    const a1 = await next(null, 20000);
    if (!a1) return ['the route was not analysed'];
    if (asked.length && !asked.some((s) => s.startsWith('fail'))) errs.push('(the test) the terrain was loaded before the mock');
    const flat = A.estimateTime({ ...a1, grade: new Float32Array(a1.along.length) }, p.timeOpt()).total;
    if (!(Number.isFinite(a1.time) && Math.abs(a1.time - flat) < 1)) errs.push(`no terrain: the time is ${a1.time} s, not ${Math.round(flat)} s by the distance on the flat`);
    if (/↑0\\b|↓0\\b/.test(elev()) || !/\\?/.test(elev())) errs.push(`no terrain: the summary says ${elev()}`);
    if (!/no terrain/.test(p.profileSummary())) errs.push(`no terrain: the profile says ${p.profileSummary()}`);
    if (!/Terrain didn.t load/.test(heads())) errs.push('no terrain: Heads-up does not say so');
    garbled('no terrain');
    // 2. some of it, after Retry: a bad file in the middle, no coarser tile to stand in
    mode = 'some';
    // (25d part 2: in Not checked; its Retry on its card)
    const row = [...document.querySelectorAll('[data-sec=warnings] .tier-not .row')].find((r) => /Terrain didn.t load/.test(r.textContent));
    if (row) { row.click(); await new Promise((ok) => setTimeout(ok, 300)); }
    const retry = row && p.cards.box && [...p.cards.box.querySelectorAll('.btn.primary.big')].find((b) => b.textContent.trim() === 'Retry');
    if (!retry) return [...errs, 'no Retry for the terrain in Check'];
    retry.click();
    const a2 = await next(a1, 15000);
    if (!a2) return [...errs, 'Retry: the route was not analysed again with the terrain that loaded'];
    const t2 = a2.terrain;
    if (!t2 || t2.all || !(t2.missing > 700 && t2.missing < 1800)) errs.push(`some terrain: missing ${t2 ? `${Math.round(t2.missing)} m${t2.all ? ', all of it' : ''}` : 'nothing'}, not about 1.2 km`);
    if (!(Number.isFinite(a2.time) && a2.time > 0)) errs.push(`some terrain: the time is ${a2.time}`);
    if (!(a2.up > 20 && Number.isFinite(a2.maxE))) errs.push(`some terrain: ↑${a2.up} m, high point ${a2.maxE}`);
    const steep = Math.max(...Array.from(a2.grade, Math.abs));
    if (steep > 15) errs.push(`some terrain: a ${Math.round(steep)} % grade where the gap meets the terrain (the hills are 12 % at most)`);
    if (!/^↑\\d+/.test(elev())) errs.push(`some terrain: the summary says ${elev()}`);
    if (!/Terrain missing for/.test(heads())) errs.push('some terrain: Heads-up does not say what is missing');
    garbled('some terrain');
    // 3. it comes back: tried again on its own, and the tiles that loaded aren't asked for again
    mode = 'ok';
    const n0 = asked.length;
    const a3 = await next(a2, 45000);
    if (!a3) errs.push('the route was not analysed again when the terrain came back (45 s)');
    else {
      if (a3.terrain) errs.push(`terrain back: still missing ${Math.round(a3.terrain.missing)} m`);
      if (!(a3.up > a2.up + 15)) errs.push(`terrain back: ↑${Math.round(a3.up)} m, was ${Math.round(a2.up)} m without the middle tile`);
      if (/Terrain (didn.t load|missing)/.test(heads())) errs.push('terrain back: Heads-up still says it is missing');
      const again = asked.slice(n0).filter((s) => / 14\\/927[57]\\//.test(s));
      if (again.length) errs.push(`tiles that had loaded were asked for again: ${again.join(', ')}`);
      garbled('terrain back');
    }
    return errs;
  } finally {
    window.fetch = realFetch;
    try { p.clear(); } catch (e) { errs.push(`clearing the route: ${e.message}`); }
  }
})()"""


def terrain(chrome):
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'hike', 'timeline': True}, {'polku:plannerDock': '"left"'}, '#13/61.513/23.83')
    pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
    fails = pg.js(TERRAIN, timeout=90000)
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} terrain that doesn't load, loads in part, comes back" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# The planner's header never spills out of the sheet, and its toolbox stays in the window, clear of
# the map's buttons where it's level with them (25a, planner.js placeTools()). Narrow desktop windows
# with the bottom dock, a small phone.
HEADER_OUT = """(() => {
  const sheet = document.querySelector('#planner').getBoundingClientRect();
  const col = document.querySelector('#map-ctrls').getBoundingClientRect();
  let worst = 0, who = '';
  const name = (el) => (el.getAttribute('aria-label') || el.title || el.textContent || '').trim().slice(0, 30);
  for (const el of document.querySelectorAll('.sheet-head button, .sheet-head label, #pl-tools button')) {
    if (!el.offsetParent) continue;
    const r = el.getBoundingClientRect(), docked = !!el.closest('#planner');
    const over = r.right - (docked || el.closest('.sheet-head') ? sheet.right - 4 : innerWidth - 4);
    if (over > worst) { worst = over; who = name(el); }
    if (!docked && el.closest('#pl-tools') && r.bottom > col.top && r.top < col.bottom && r.right > col.left) return `${name(el)} is under the map's buttons`;
  }
  return worst > 1 ? `${who} sticks out ${Math.round(worst)} px` : '';
})()"""


def header_fit(chrome):
    fails = []
    for w, h, phone, dock in [(360, 740, True, 'left'), (600, 900, False, 'bottom'), (700, 900, False, 'bottom'), (760, 900, False, 'bottom'), (1300, 800, False, 'bottom')]:
        pg = chrome.page(w, h, phone)
        pg.open_app({'activity': 'road'}, {'polku:plannerDock': json.dumps(dock), 'polku:styles': json.dumps({'mtb': {'p': 'technical', 'v': {}, 'wet': 'auto'}})})
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        pg.js("(() => { polku.planner.setActive(true); return true; })()")
        time.sleep(0.8)
        for sport in ('road', 'mtb'):
            if sport == 'mtb':
                pg.js("(() => { polku.set({ activity: 'mtb' }); return true; })()")
                time.sleep(0.8)
            out = pg.js(HEADER_OUT)
            if out:
                fails.append(f'{w}x{h} {dock} {sport}: {out}')
        if w == 700:
            # the route's colour is one setting, on the profile: "Colour by" and "On map" (25a moved it there)
            sync = pg.js("""(() => {
              const p = polku.planner, errs = [];
              if (p.els.colorSel) errs.push('the header still has a colour list');
              p.pickColor('surface');
              if (!p.els.mapToggle.checked || p.els.modeSel.value !== 'surface') errs.push('picking Surface');
              p.pickColor('plain');
              if (p.els.mapToggle.checked) errs.push('picking Plain line');
              p.setColorOnMap(true);
              if (p.els.modeSel.value !== 'surface') errs.push('On map in the profile');
              p.setColorOnMap(false);
              localStorage.removeItem('polku:colorMode'); localStorage.removeItem('polku:colorOnMap');
              return errs.join(', ');
            })()""")
            if sync:
                fails.append(f'colour out of step: {sync}')
        fails += [f'{w}x{h} console: {e[:160]}' for e in pg.errors()]
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} planner header fits" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


def layers(chrome):
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#12/60.15/24.95')
    fails = pg.js(LAYERS)
    pg.reload()
    fails += pg.js(LAYERS_AFTER)
    pg.c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'no-preference'}]}, pg.s)
    fails += pg.js(LAYERS_MOTION + '(false)')
    pg.c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce'}]}, pg.s)
    fails += pg.js(LAYERS_MOTION + '(true)')
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} layers (every sport)" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Pacing (issue #66): calls made together through net.js's request() go out one
# by one within each service's windows, in the order they were made, and every
# call that goes out is counted, the retry after a dropped connection too. A
# page with no app, so Date.now and the timers can be a fake clock; the services
# are a mocked fetch, and each case gets a fresh net.js with nothing sent yet.
PACING = """(async () => {
  const errs = [], real = window.setTimeout.bind(window);
  let now = Date.now(), seq = 0, sent = [], answer = null, n = 0;
  const timers = new Map();
  Date.now = () => now;
  window.setTimeout = (fn, ms = 0, ...a) => { timers.set(++seq, { at: now + Math.max(0, +ms || 0), fn: () => fn(...a) }); return seq; };
  window.clearTimeout = (id) => { timers.delete(id); };
  const settle = async () => { for (let k = 0; k < 5; k++) await new Promise((ok) => real(ok, 0)); };
  // move the clock on, running each timer that falls due on the way, in time order
  const advance = async (ms) => {
    const end = now + ms;
    for (;;) {
      await settle();
      let id = null;
      for (const [k, t] of timers) if (t.at <= end && (id === null || t.at < timers.get(id).at)) id = k;
      if (id === null) break;
      const t = timers.get(id);
      timers.delete(id);
      now = Math.max(now, t.at);
      t.fn();
    }
    now = end;
    await settle();
  };
  window.fetch = async (url) => {
    sent.push({ url: String(url), at: Date.now() });
    const a = answer && answer(String(url));
    if (a instanceof Error) throw a;
    return a || new Response('{}');
  };
  const fresh = () => {
    localStorage.removeItem('polku.usage');
    timers.clear();
    sent = [];
    answer = null;
    return import(`${location.origin}/js/net.js?pacing=${++n}`);
  };
  const track = (p) => { const o = {}; p.then(() => { o.ok = true; }, (e) => { o.err = e; }); return o; };
  const ids = (re) => sent.filter((s) => re.test(s.url)).map((s) => s.url.split('/').pop()).join();
  const times = (re, t0) => sent.filter((s) => re.test(s.url)).map((s) => s.at - t0);
  const session = (net, id) => net.usage().find((u) => u.id === id).session;
  // the first of the service's windows that got more calls than it takes
  const over = (net, id, at) => {
    for (const [ms, max] of net.SOURCES[id].pace) {
      for (const t of at) {
        const k = at.filter((u) => u >= t && u < t + ms).length;
        if (k > max) return `${k} calls within ${ms / 1000} s (it takes ${max})`;
      }
    }
    return '';
  };

  { // three Valhalla calls made together: one a second, in order
    const net = await fresh(), t0 = now;
    const calls = [1, 2, 3].map((i) => track(net.request('valhalla', `https://mock.invalid/valhalla/${i}`)));
    await advance(5000);
    const at = times(/valhalla/, t0), o = over(net, 'valhalla', at);
    if (o) errs.push(`Valhalla, three calls made together: ${o}; sent at ${at.join(', ')} ms`);
    if (ids(/valhalla/) !== '1,2,3') errs.push(`Valhalla: sent in the order ${ids(/valhalla/)}, not 1,2,3`);
    if (!calls.every((c) => c.ok)) errs.push('Valhalla: not every call was answered');
    if (session(net, 'valhalla') !== 3) errs.push(`Valhalla: ${session(net, 'valhalla')} calls counted for 3 sent`);
  }

  { // fourteen BRouter calls made together: 5 in 10 s and 12 a minute, in order; others don't wait behind them
    const net = await fresh(), t0 = now;
    const calls = Array.from({ length: 14 }, (_, i) => track(net.request('brouter', `https://mock.invalid/brouter/${i + 1}`)));
    if (net.headroom('brouter') !== 0) errs.push(`BRouter: headroom ${net.headroom('brouter')} with calls waiting, so a drag's live preview would still ask`);
    const vh = track(net.request('valhalla', 'https://mock.invalid/valhalla/1'));
    [1, 2, 3].forEach((i) => track(net.request('photon', `https://mock.invalid/photon/${i}`)));
    await advance(0);
    if (!vh.ok) errs.push('Valhalla waited behind BRouter’s calls');
    if (ids(/photon/) !== '1,2,3') errs.push(`Photon (not paced): ${ids(/photon/) || 'nothing'} went out at once, not 1,2,3`);
    await advance(70e3);
    const at = times(/brouter/, t0), o = over(net, 'brouter', at);
    if (o) errs.push(`BRouter, 14 calls made together: ${o}; sent at ${at.map((t) => (t / 1000).toFixed(2)).join(', ')} s`);
    const order = Array.from({ length: 14 }, (_, i) => i + 1).join();
    if (ids(/brouter/) !== order) errs.push(`BRouter: sent ${ids(/brouter/)}, not ${order}`);
    if (!calls.every((c) => c.ok)) errs.push(`BRouter: ${calls.filter((c) => !c.ok).length} of 14 calls weren't answered`);
    if (session(net, 'brouter') !== 14) errs.push(`BRouter: ${session(net, 'brouter')} calls counted for 14 sent`);
  }

  { // a waiting call that's cancelled leaves its place to the next; one that would wait past maxWait is refused at once
    const net = await fresh(), t0 = now, ctrl = new AbortController();
    track(net.request('valhalla', 'https://mock.invalid/valhalla/1'));
    const b = track(net.request('valhalla', 'https://mock.invalid/valhalla/2', { signal: ctrl.signal }));
    track(net.request('valhalla', 'https://mock.invalid/valhalla/3'));
    const d = track(net.request('valhalla', 'https://mock.invalid/valhalla/4', { maxWait: 2000 }));
    await advance(500);
    ctrl.abort();
    await advance(0);
    if (!(b.err && b.err.name === 'AbortError')) errs.push(`a waiting call that was cancelled: ${b.err ? b.err.name : b.ok ? 'answered' : 'still waiting'}`);
    if (!(d.err && d.err.name === 'Limited' && d.err.reason === 'pacing')) errs.push(`a call that would wait past its maxWait: ${d.err ? `${d.err.name} ${d.err.reason || ''}` : d.ok ? 'answered' : 'still waiting'}`);
    await advance(5000);
    const at = times(/valhalla/, t0);
    if (ids(/valhalla/) !== '1,3') errs.push(`cancelled and too-late calls: sent ${ids(/valhalla/)}, not 1,3`);
    else if (at[1] > 1200) errs.push(`the call behind a cancelled one went at ${at[1]} ms, not in its place`);
    if (session(net, 'valhalla') !== sent.length) errs.push(`${session(net, 'valhalla')} calls counted for ${sent.length} sent`);
  }

  if (navigator.onLine) { // the retry after a dropped connection waits for a slot, and counts
    const net = await fresh(), t0 = now;
    let tries = 0;
    answer = () => (tries++ ? null : new TypeError('Failed to fetch'));
    const r = track(net.request('valhalla', 'https://mock.invalid/valhalla/1'));
    await advance(5000);
    const at = times(/valhalla/, t0);
    if (at.length !== 2 || !r.ok) errs.push(`a dropped connection: ${at.length} tries, ${r.ok ? 'answered' : r.err ? r.err.message : 'still waiting'}`);
    else if (over(net, 'valhalla', at)) errs.push(`the retry after a dropped connection went at ${at[1]} ms, inside Valhalla's second`);
    if (session(net, 'valhalla') !== at.length) errs.push(`a dropped connection: ${session(net, 'valhalla')} calls counted for ${at.length} sent`);
  }

  { // a 429 with Retry-After while calls wait: they aren't sent; the service is left alone until then
    const net = await fresh();
    answer = (url) => (/\\/1$/.test(url) ? new Response('', { status: 429, headers: { 'Retry-After': '30' } }) : null);
    const calls = [1, 2, 3].map((i) => track(net.request('valhalla', `https://mock.invalid/valhalla/${i}`)));
    await advance(5000);
    if (ids(/valhalla/) !== '1') errs.push(`after a 429, sent ${ids(/valhalla/)}, not just 1`);
    if (!calls.every((c) => c.err && c.err.name === 'Limited' && c.err.reason === 'limit')) errs.push(`after a 429: ${calls.map((c) => (c.err ? `${c.err.name} ${c.err.reason || ''}` : c.ok ? 'answered' : 'waiting')).join(', ')}`);
    const late = track(net.request('valhalla', 'https://mock.invalid/valhalla/4'));
    await advance(0);
    if (!(late.err && late.err.name === 'Limited')) errs.push('a call during the back-off was not refused');
    await advance(30e3);
    const again = track(net.request('valhalla', 'https://mock.invalid/valhalla/5'));
    await advance(0);
    if (!again.ok) errs.push('Valhalla was not asked again after its Retry-After');
    if (session(net, 'valhalla') !== sent.length) errs.push(`after a 429: ${session(net, 'valhalla')} calls counted for ${sent.length} sent`);
  }
  { // a late answer clears only the back-off it left under, not one set while it was out (#480)
    const net = await fresh(), refused = () => new Response('Error: retry later', { status: 403 });
    let late;
    answer = (url) => (/\\/1$/.test(url) || /\\/3$/.test(url) ? refused() : /\\/2$/.test(url) ? new Promise((ok) => { late = ok; }) : null);
    // awaited, not advanced past: reading a refusal's body isn't done within settle() on a slow machine
    await net.request('brouter', 'https://mock.invalid/brouter/1').catch(() => {});
    await advance(61e3); // its minute's back-off is over
    const a = track(net.request('brouter', 'https://mock.invalid/brouter/2'));
    await advance(0);
    await net.request('brouter', 'https://mock.invalid/brouter/3').catch(() => {});
    const before = net.sourceStatus('brouter');
    late(new Response('{}'));
    await advance(0);
    const after = net.sourceStatus('brouter');
    if (!a.ok || ids(/brouter/) !== '1,2,3') errs.push(`(the test) sent ${ids(/brouter/)}, the late call ${a.ok ? 'answered' : 'not answered'}`);
    else if (!before) errs.push('(the test) the second refusal set no back-off');
    else if (!after || after.fails !== before.fails) errs.push(`a late answer after a refusal: BRouter ${after ? `${after.fails} fails, not ${before.fails}` : 'no longer backed off'}`);
  }
  localStorage.removeItem('polku.usage');
  return errs;
})()"""


def pacing(chrome):
    pg = chrome.page(1440, 900, False)
    pg.goto(BASE + 'sw.js')  # this origin, without the app
    fails = pg.js(PACING)
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} calls made together go out paced" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# 23a, which way you face. Headless Chrome has no GPS and no compass, so the page gets its own:
# fixes handed to the watch, deviceorientationabsolute events. The dot follows the fixes and the
# map follows the dot; the cone turns with the compass, and with the GPS's course while moving;
# turning or zooming the map keeps following, a pan or a move elsewhere stops it and Follow
# brings it back; the map faces ahead on a phone; nothing runs while the page is hidden, and a
# dot over a minute old looks it; no fix is sent or stored. The real check is on a phone outdoors.
HEADING = """(async () => {
  const errs = [], map = polku.map, L = polku.locate, H = polku.heading, C = polku.compass;
  const btn = document.querySelector('#btn-locate'), touch = matchMedia('(pointer: coarse)').matches;
  // the needle turns the short way past south: 4°, not 356° the wrong way round (#540)
  const needle = () => +/rotate\\((-?[\\d.]+)deg\\)$/.exec(document.querySelector('.compass-btn svg').style.transform)[1];
  map.jumpTo({ bearing: 178 });
  const n0 = needle();
  map.jumpTo({ bearing: -178 });
  if (Math.abs(needle() - n0) > 5) errs.push(`turning the map 4° past south turned the needle ${Math.abs(needle() - n0)}°`);
  map.jumpTo({ bearing: 0 });
  const frames = (n = 2) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  // until nothing moves: the map, the dot's frames, the compass's turning, the heading's next frame
  const settle = () => new Promise((ok) => {
    const t0 = performance.now();
    let calm = 0;
    const f = () => {
      calm = map.isMoving() || L.raf || C.raf || H.frame ? 0 : calm + 1;
      if (calm >= 2 || performance.now() - t0 > 5000) ok(); else requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  // what leaves the page, and what it keeps
  const out = [], kept = [];
  const realFetch = window.fetch;
  window.fetch = (u, o) => { out.push(`${(u && u.url) || u} ${o && typeof o.body === 'string' ? o.body : ''}`); return realFetch(u, o); };
  const xo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { out.push(String(u)); return xo.apply(this, arguments); };
  if (navigator.sendBeacon) { const sb = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = (u, d) => { out.push(`${u} ${d}`); return sb(u, d); }; }
  const si = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { kept.push(`${k}=${v}`); return si.call(this, k, v); };
  // a GPS of our own
  const watchers = new Map();
  let wid = 0;
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    watchPosition(ok, err) { watchers.set(++wid, { ok, err }); return wid; },
    clearWatch(i) { watchers.delete(i); },
    getCurrentPosition() {},
  } });
  const at = (ll, more = {}) => { for (const w of [...watchers.values()]) w.ok({ coords: { longitude: ll[0], latitude: ll[1], accuracy: 10, speed: 0, heading: null, ...more }, timestamp: Date.now() }); };
  // and a compass: the phone held a little tilted, its top towards `deg`
  const face = async (deg) => {
    for (let i = 0; i < 12; i++) {
      window.dispatchEvent(new DeviceOrientationEvent(H.evt, { alpha: (360 - deg) % 360, beta: 25, gamma: 0, absolute: true }));
      await frames(1);
    }
  };
  const near = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  const off = () => { const p = map.project(L.shown || [0, 0]), f = L.followPoint(); return Math.hypot(p.x - f[0], p.y - f[1]); };
  const px = (n) => `${n.toFixed(0)} px`;
  const drag = async (dx, dy) => {
    const cv = map.getCanvas(), R = cv.getBoundingClientRect(), x = R.left + R.width / 2, y = R.top + R.height / 2;
    if (touch) {
      const t = (k) => [new Touch({ identifier: 1, target: cv, clientX: x + dx * k, clientY: y + dy * k })];
      const ev = (type, k) => cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : t(k), targetTouches: type === 'touchend' ? [] : t(k), changedTouches: t(k) }));
      ev('touchstart', 0);
      ev('touchmove', 0.3); // (past 10 px at once: a finger that rests half a second is a hold, the spot's card; frames are slow under load)
      for (let k = 3; k <= 8; k++) { await frames(1); ev('touchmove', k / 8); }
      ev('touchend', 1);
    } else {
      const ev = (type, k) => cv.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x + dx * k, clientY: y + dy * k, button: 0, buttons: type === 'mouseup' ? 0 : 1 }));
      ev('mousedown', 0);
      for (let k = 1; k <= 8; k++) { await frames(1); ev('mousemove', k / 8); }
      ev('mouseup', 1);
    }
  };
  const A = [23.82291, 61.51437], B = [23.82291, 61.51473], D = [23.82392, 61.51522];

  // off, then a tap: waiting for the first fix, then following
  if (L.state() !== 'off') errs.push(`Locate starts ${L.state()}, not off`);
  btn.click();
  if (L.state() !== 'waiting' || watchers.size !== 1) errs.push(`a tap on Locate: ${L.state()} with ${watchers.size} GPS watches`);
  at(A);
  await settle();
  if (L.state() !== 'follow') errs.push(`after the first fix: ${L.state()}, not following`);
  if (btn.getAttribute('aria-pressed') !== 'true') errs.push('Locate not shown pressed while following');
  if (!document.querySelector('.you-dot') || !document.querySelector('.you-acc')) errs.push('no dot or accuracy circle');
  if (off() > 2) errs.push(`the first fix is ${px(off())} from the middle of the map`);
  if (map.getZoom() < 14.9) errs.push(`zoomed to ${map.getZoom().toFixed(1)} for the first fix, not 15`);

  // the cone: the compass where there is one
  const cone = document.querySelector('.you-cone');
  if (touch) {
    if (!cone.hidden) errs.push('a cone before any compass reading');
    await face(90);
    await settle();
    if (cone.hidden || near(L.cone.getRotation(), 90) > 2) errs.push(`facing east, the cone is ${cone.hidden ? 'hidden' : `at ${L.cone.getRotation().toFixed(0)}°`}`);
    await face(200);
    await settle();
    if (near(L.cone.getRotation(), 200) > 2) errs.push(`the cone did not turn to 200°: ${L.cone.getRotation().toFixed(0)}°`);
  } else if (!cone.hidden) errs.push('a cone on a desktop without a compass or a GPS course');

  // turning the map keeps following, and the cone keeps its direction on the ground
  map.jumpTo({ bearing: 40 });
  await settle();
  if (L.state() !== 'follow' || off() > 2) errs.push(`turning the map: ${L.state()}, the dot ${px(off())} from its place`);
  if (touch) {
    const z = /rotateZ\\((-?[\\d.]+)deg\\)/.exec(cone.style.transform);
    if (!z || near(+z[1], 160) > 2) errs.push(`on a map turned 40°, the cone is drawn at ${z && z[1]}°, not 160°`);
  }
  map.jumpTo({ bearing: 0 });
  await settle();

  // moving: the GPS's own course wins over the compass, and the map follows
  at(B, { speed: 3, heading: 10 });
  await settle();
  const hd = H.current();
  if (!hd || hd.source !== 'course' || cone.hidden || near(L.cone.getRotation(), 10) > 2) errs.push(`moving at 3 m/s: the cone is ${cone.hidden ? 'hidden' : `at ${L.cone.getRotation().toFixed(0)}° from the ${hd && hd.source}`}, not on the GPS course (10°)`);
  if (off() > 2) errs.push(`the map did not follow a new fix: the dot is ${px(off())} from its place`);
  at(B, { speed: 0, heading: null });
  await settle();
  // a phone's compass goes on reporting; this one last did before the waits above, which take
  // seconds when the page draws slowly, and Polku drops a compass silent for 3 s
  if (touch) await face(200);
  if (touch && (!H.current() || H.current().source !== 'compass')) errs.push('standing still again, the cone did not go back to the compass');
  if (!touch && !cone.hidden) errs.push('standing still on a desktop, the cone stays');

  // the zoom button keeps following
  document.querySelector('#btn-zoom-in').click();
  await settle();
  if (L.state() !== 'follow' || off() > 2) errs.push(`zoom in: ${L.state()}, the dot ${px(off())} from its place`);

  // a pinch (a phone) zooms and keeps following, though its fingers drift
  if (touch) {
    const cv = map.getCanvas(), R = cv.getBoundingClientRect(), x = R.left + R.width / 2 + 100, y = R.top + R.height / 2 + 120, z0 = map.getZoom();
    const t = (k) => [new Touch({ identifier: 1, target: cv, clientX: x - 40 - 30 * k, clientY: y - 40 - 40 * k }), new Touch({ identifier: 2, target: cv, clientX: x + 40 + 90 * k, clientY: y + 40 + 40 * k })];
    const ev = (type, k) => cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : t(k), targetTouches: type === 'touchend' ? [] : t(k), changedTouches: t(k) }));
    ev('touchstart', 0);
    for (let k = 1; k <= 12; k++) { await frames(1); ev('touchmove', k / 12); }
    ev('touchend', 1);
    await settle();
    if (map.getZoom() < z0 + 0.5 || L.state() !== 'follow' || off() > 2) errs.push(`a pinch: zoom ${z0.toFixed(1)} → ${map.getZoom().toFixed(1)}, ${L.state()}, the dot ${px(off())} from its place`);
  }

  // a pan stops following: Follow, and a new fix moves the dot but not the map
  await drag(120, 80);
  await settle();
  if (L.state() !== 'free') errs.push(`a pan left Locate ${L.state()}, not Follow`);
  if (!/Follow/.test(btn.textContent) || btn.getAttribute('aria-pressed') !== 'false') errs.push('no Follow on the button after a pan');
  const c1 = map.getCenter();
  at(D);
  await settle();
  if (map.getCenter().lng !== c1.lng || map.getCenter().lat !== c1.lat) errs.push('the map moved to a new fix after a pan');
  const pd = map.project(D), ps = map.project(L.shown);
  if (Math.hypot(pd.x - ps.x, pd.y - ps.y) > 1) errs.push('the dot did not move to the new fix after a pan');
  btn.click();
  await settle();
  if (L.state() !== 'follow' || off() > 2) errs.push(`Follow did not bring the map back: ${L.state()}, the dot ${px(off())} from its place`);

  // a move elsewhere (a fit to the route, a search) stops it too
  map.jumpTo({ center: [23.70, 61.45] });
  await settle();
  if (L.state() !== 'free') errs.push(`a move elsewhere left Locate ${L.state()}, not Follow`);
  btn.click();
  await settle();

  // the planner open: the dot sits in the map it leaves free
  // what moved the map, should following stop here (seen on GitHub's runner only, #268)
  const moves = [], sf = L.setFollow;
  const onEnd = (e) => moves.push(`moveend${e.polkuFollow ? ' (following)' : ''}${e.originalEvent ? ` ${e.originalEvent.type}` : ''} at ${map.getCenter().lng.toFixed(4)},${map.getCenter().lat.toFixed(4)} padding ${JSON.stringify(map.getPadding())}`);
  map.on('moveend', onEnd);
  L.setFollow = function (on, ...rest) { if (!on) moves.push(`setFollow(false) from ${(new Error().stack || '').split('\\n').slice(2, 5).map((l) => l.trim()).join(' < ')}`); return sf.call(this, on, ...rest); };
  polku.planner.setActive(true);
  await settle();
  at(A);
  await settle();
  map.off('moveend', onEnd);
  L.setFollow = sf;
  const pr = document.querySelector('#planner').getBoundingClientRect(), pa = map.project(L.shown);
  if (L.state() !== 'follow' || off() > 2) errs.push(`with the planner open: ${L.state()}, the dot ${px(off())} from its place; ${moves.join('; ') || 'no moves'}`);
  else if (touch ? pa.y > pr.top - 20 : pa.x < pr.right + 20) errs.push('with the planner open, the dot is behind it');
  polku.planner.setActive(false);
  await settle();

  // facing ahead (a phone): the next tap turns the map with you, about your dot
  if (touch) {
    btn.click();
    await face(200);
    await settle();
    if (L.state() !== 'ahead') errs.push(`the second tap: ${L.state()}, not facing ahead (the compass ${C.mode}, its last reading ${H.compass ? Date.now() - H.compass.t : 'none'} ms ago, the last toast: ${document.querySelector('#toast').textContent || 'none'})`);
    if (near(map.getBearing(), 200) > 3) errs.push(`facing ahead, the map's bearing is ${map.getBearing().toFixed(0)}°, not 200°`);
    if (off() > 2) errs.push(`facing ahead, the dot is ${px(off())} from its place`);
    await face(150);
    await settle();
    if (near(map.getBearing(), 150) > 3) errs.push(`turning to 150°, the map's bearing is ${map.getBearing().toFixed(0)}°`);
  }
  // the last tap: off, the GPS let go, north up again
  btn.click();
  await settle();
  if (L.state() !== 'off' || watchers.size || document.querySelector('.you-dot')) errs.push(`the last tap: ${L.state()}, ${watchers.size} GPS watches, ${document.querySelector('.you-dot') ? 'a dot' : 'no dot'}`);
  if (Math.abs(map.getBearing()) > 0.5) errs.push(`off again, the map stays turned (${map.getBearing().toFixed(0)}°)`);
  if (H.listening) errs.push('off again, the compass is still listened to');

  // hidden: no GPS, no compass, no frames; back after a minute: the dot looks old until a new fix
  btn.click();
  at(A);
  await settle();
  const hide = (v) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => v });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (v ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  if (L.state() !== 'follow') { errs.push(`Locate again: ${L.state()}, not following`); return errs; }
  hide(true);
  if (watchers.size || L.raf || H.listening) errs.push(`hidden: ${watchers.size} GPS watches, ${L.raf ? 'frames' : 'no frames'}, the compass ${H.listening ? 'listened to' : 'let go'}`);
  L.fix.t -= 61e3;
  hide(false);
  delete document.hidden;
  delete document.visibilityState;
  if (watchers.size !== 1 || !H.listening) errs.push(`visible again: ${watchers.size} GPS watches, the compass ${H.listening ? 'listened to' : 'let go'}`);
  const dot = document.querySelector('.you-dot');
  if (!dot.classList.contains('stale') || !/no newer position/.test(btn.getAttribute('aria-label'))) errs.push('back after a minute, the dot does not look old, or Locate does not say so');
  at(A);
  if (dot.classList.contains('stale')) errs.push('a new fix left the dot looking old');
  L.stop();

  // a GPS that gives no course or speed (some do while still): worked out from the way covered
  const { Heading } = await import(location.origin + '/js/heading.js');
  const g = new Heading(), t0 = Date.now() - 5000;
  g.fix({ longitude: A[0], latitude: A[1], accuracy: 5, speed: null, heading: null }, t0);
  g.fix({ longitude: A[0] + 0.0004, latitude: A[1] + 0.0002, accuracy: 5, speed: null, heading: null }, t0 + 5000);
  const gc = g.current();
  if (!gc || gc.source !== 'course' || near(gc.deg, 43) > 3) errs.push(`no course worked out from two fixes 5 s and 30 m apart: ${gc ? `${gc.deg.toFixed(0)}° from the ${gc.source}` : 'none'}`);

  // nothing about where you were left the page or was kept
  const fixRe = /61\\.514[0-9]|61\\.5152|23\\.8229|23\\.8239/;
  for (const s of out.filter((s) => fixRe.test(s))) errs.push(`sent: ${s.slice(0, 140)}`);
  for (const s of kept.filter((s) => fixRe.test(s))) errs.push(`stored: ${s.slice(0, 140)}`);
  return errs;
})()"""


def heading(chrome):
    ok = True
    for w, h, phone in [(390, 844, True), (1440, 900, False)]:
        pg = chrome.page(w, h, phone)
        try:
            pg.open_app({'activity': 'hike'}, {'polku:plannerDock': '"left"'})
            pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
            fails = pg.js(HEADING)
            fails += [f'console: {e[:160]}' for e in pg.errors()]
        finally:
            pg.close()
        print(f"{'ok  ' if not fails else 'FAIL'} where you are, which way you face, follow me ({w}x{h})" + ''.join(f'\n     - {f}' for f in fails), flush=True)
        ok = not fails and ok
    return ok


# The quick layer drawer (#123), and the one swipe for every sheet (js/sheet.js, #96). Weather fields
# don't fetch here (the overlay's set, open and hour are stubbed): only the switches are tested.
QUICK_HELP = """
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [], S = polku.state;
  const { QUICK_TILES, QUICK_TILE, RASTER_OVERLAYS, SAFETY_OVERLAYS } = await import(location.origin + '/js/config.js');
  const qd = document.querySelector('#quick-layers'), lp = document.querySelector('#layers-panel');
  const isOpen = () => qd.classList.contains('open');
  const open = async () => { if (!isOpen()) { document.querySelector('#btn-layers').click(); await wait(250); } };
  const tile = (id) => qd.querySelector(`.qt-tog[data-tile="${id}"]`);
  const pressed = (id) => !!tile(id) && tile(id).getAttribute('aria-pressed') === 'true';
  const tiles = () => [...qd.querySelectorAll('.qt-tog')].map((b) => b.dataset.tile);
  // the map at rest, as a person sees it change before the next tap (quicker base changes: #75)
  const idle = () => Promise.race([wait(10000), new Promise((r) => polku.map.once('idle', r))]);
  const DEPTHS = ['depthAreas', 'depthContours', 'soundings'];
  const OWN = ['trailDetails', 'labelsDown', 'labelsUp', 'terrain3d', 'hillshade', 'contours'];
  // what the test reads itself, not through the app's own tileOn()
  const stateOn = (id) => (id === 'trailColors' ? S.trailColors !== 'off' : id === 'depths' ? DEPTHS.some((d) => S.overlays[d])
    : id.startsWith('wx:') ? !!S.weather[id.slice(3)] : OWN.includes(id) ? !!S[id] : !!S.overlays[id]);
  const LABEL = { trailDetails: 'Trail details', labelsDown: 'Difficulty numbers', labelsUp: 'Uphill numbers', terrain3d: '3D terrain', hillshade: 'Hillshade',
    contours: 'Contour lines', nautical: 'Nautical marks & fairways', lipasRoutes: 'Official routes (LIPAS)', lipasPoints: 'Lean-tos, huts, campfire & landing sites (LIPAS)',
    pois: 'OSM outdoor places', 'wx:wind': 'Wind', 'wx:temp': 'Temperature', 'wx:rain': 'Rain', 'wx:snow': 'Snow depth', winterWays: 'Winter ways',
    lipasWinter: 'Ski tracks, skating & snowmobile routes', seaIce: 'Sea ice' };
  const label = (id) => LABEL[id] || (RASTER_OVERLAYS[id] || SAFETY_OVERLAYS[id] || {}).label;
  const sw = (l) => { const t = [...document.querySelectorAll('#layers-body label.tg')].find((x) => x.querySelector('.tg-text').firstChild.textContent.trim() === l); return t && t.querySelector('input'); };
  const colours = () => [...document.querySelectorAll('#layers-body .seg button')].find((b) => b.getAttribute('aria-pressed') === 'true' && ['Off', 'Difficulty', 'Uphill', 'Both', 'Winter'].includes(b.textContent));
  const panelOn = (id) => (id === 'trailColors' ? (colours() || {}).textContent !== 'Off' : id === 'depths' ? ['Depth areas', 'Depth contours', 'Depth soundings'].some((l) => sw(l) && sw(l).checked) : !!(sw(label(id)) || {}).checked);
  // off in the full panel, as a person would turn it off there
  const panelOff = async (id) => {
    if (id === 'trailColors') [...document.querySelectorAll('#layers-body .seg button')].find((b) => b.textContent === 'Off').click();
    else for (const l of id === 'depths' ? ['Depth areas', 'Depth contours', 'Depth soundings'] : [label(id)]) if (sw(l) && sw(l).checked) sw(l).click();
    await wait(80);
  };
  for (const k of ['set', 'setOpen', 'setHour']) polku.weather[k] = () => {};
"""

# Opening and closing, the base maps, every tile in every sport, Trail colours, Depths and More's count
QUICK_TILES_JS = """(async () => {""" + QUICK_HELP + """
  const btn = document.querySelector('#btn-layers');
  btn.click(); await wait(250);
  if (!isOpen() || !lp.hidden) errs.push('Layers did not open the drawer, or opened the full panel');
  if (btn.getAttribute('aria-expanded') !== 'true') errs.push('Layers is not aria-expanded while the drawer is open');
  btn.click(); await wait(250);
  if (isOpen()) errs.push('Layers again did not close the drawer');
  const key = (k, el = document.body) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  key('l'); await wait(50);
  if (!isOpen()) errs.push('L did not open the drawer');
  if (!document.activeElement.matches('.qd-base[aria-checked="true"]')) errs.push(`L: focus on ${document.activeElement.className || document.activeElement.tagName}, not the chosen map`);
  key('ArrowRight', document.activeElement); await wait(100); await idle();
  if (S.base !== 'maasto' || !document.activeElement.matches('.qd-base[data-base="maasto"]')) errs.push(`the arrow key chose ${S.base}, focus on ${document.activeElement.dataset.base}`);
  key('Escape', document.activeElement); await wait(250);
  if (isOpen()) errs.push('Esc did not close the drawer');
  if (document.activeElement !== btn) errs.push('Esc: focus not back on Layers');
  // the base maps: the map and the Layers button change, the drawer stays
  await open();
  qd.querySelector('.qd-base[data-base="night"]').click(); await wait(150); await idle();
  if (S.base !== 'night' || !/night/.test(btn.querySelector('img').src) || !isOpen()) errs.push(`Night: base ${S.base}, button ${btn.querySelector('img').src.split('/').pop()}, open ${isOpen()}`);
  qd.querySelector('.qd-base[data-base="trail"]').click(); await wait(150); await idle();
  const bases = () => [...qd.querySelectorAll('.qd-base')].map((b) => b.dataset.base).join();
  if (bases() !== 'trail,maasto,aerial,ortofi,plain,night') errs.push(`the maps: ${bases()}`);
  polku.set({ mmlKey: 'test', base: 'mml' }); await wait(150); await idle();
  if (bases() !== 'trail,aerial,ortofi,plain,night,mml' || !qd.querySelector('.qd-base[data-base="mml"][aria-checked="true"]')) errs.push(`with an MML key and MML WMTS on, the maps: ${bases()}`);
  polku.set({ mmlKey: '', base: 'trail' }); await wait(150); await idle();
  // every tile, in every sport: the same state as its switch in the full panel, both ways
  for (const k of Object.keys(QUICK_TILES)) {
    polku.set({ activity: k }); await wait(150); await open();
    if (tiles().join() !== QUICK_TILES[k].join()) errs.push(`${k}: the tiles are ${tiles()}, not ${QUICK_TILES[k]}`);
    for (const id of tiles()) {
      const was = stateOn(id);
      for (let n = 0; n < 2; n++) {
        const before = stateOn(id);
        tile(id).click(); await wait(60);
        if (stateOn(id) === before) errs.push(`${k}/${id}: the tile didn't turn it ${before ? 'off' : 'on'}`);
        if (pressed(id) !== stateOn(id)) errs.push(`${k}/${id}: pressed ${pressed(id)} while it's ${stateOn(id) ? 'on' : 'off'}`);
        if (panelOn(id) !== stateOn(id)) errs.push(`${k}/${id}: the full panel shows it ${panelOn(id) ? 'on' : 'off'}, the tile ${stateOn(id) ? 'on' : 'off'}`);
      }
      if (!stateOn(id)) { tile(id).click(); await wait(60); }
      await panelOff(id);
      if (stateOn(id) || pressed(id)) errs.push(`${k}/${id}: turned off in the full panel, the tile is ${pressed(id) ? 'still pressed' : 'unpressed but it is on'}`);
      if (was !== stateOn(id)) { tile(id).click(); await wait(60); }
    }
    if (QUICK_TILES[k].some((id) => QUICK_TILE[id].opts) && !qd.querySelector('.qt-opt')) errs.push(`${k}: no › on a tile with settings`);
  }
  // Trail colours come back as you had them; trail run's start uphill
  polku.set({ activity: 'mtb' }); await wait(150); await open();
  qd.querySelector('.qt-opt[data-opts="trailColors"]').click(); await wait(80);
  [...qd.querySelectorAll('.seg button')].find((b) => b.textContent === 'Both').click(); await wait(80);
  qd.querySelector('.qd-back').click(); await wait(80);
  tile('trailColors').click(); await wait(60);
  tile('trailColors').click(); await wait(60);
  if (S.trailColors !== 'both') errs.push(`Trail colours came back as ${S.trailColors}, not both`);
  polku.set({ activity: 'trailrun' }); await wait(150);
  if (S.trailColors !== 'off') errs.push(`trail run starts with ${S.trailColors} colours`);
  tile('trailColors').click(); await wait(60);
  if (S.trailColors !== 'up') errs.push(`trail run's Trail colours tile turned on ${S.trailColors}, not up`);
  tile('trailColors').click(); await wait(60);
  // Depths: its three together, and back the ones you had
  polku.set({ activity: 'paddle' }); await wait(150);
  sw('Depth soundings').click(); await wait(80);
  if (!pressed('depths')) errs.push('Depths unpressed with two of its three on');
  tile('depths').click(); await wait(60);
  if (DEPTHS.some((d) => S.overlays[d])) errs.push('Depths off left one on');
  tile('depths').click(); await wait(60);
  if (!S.overlays.depthAreas || !S.overlays.depthContours || S.overlays.soundings) errs.push(`Depths on brought back ${DEPTHS.filter((d) => S.overlays[d])}, not areas and contours`);
  if (!/not for navigation/i.test(tile('depths').textContent)) errs.push('the Depths tile does not say “not for navigation”');
  sw('Depth soundings').click(); await wait(80);
  // More counts what else is on
  polku.set({ activity: 'mtb' }); await wait(150);
  const more = () => qd.querySelector('.qt-more').textContent;
  if (!/3 more on/.test(more())) errs.push(`MTB's More: ${more()}, not 3 more on`);
  sw(label('wmtCycling')).click(); await wait(80);
  if (!/4 more on/.test(more()) || !/4 more on/.test(qd.querySelector('.qt-more').getAttribute('aria-label'))) errs.push(`More after Waymarked cycling: ${more()}`);
  sw(label('wmtCycling')).click(); await wait(80);
  // this sport's tile, changed here, is kept for the reload (Official routes off in MTB)
  tile('lipasRoutes').click(); await wait(60);
  return errs;
})()"""

# after a reload: what the tiles changed is kept per sport, and switching sport changes the tiles
QUICK_AFTER = """(async () => {""" + QUICK_HELP + """
  await open();
  if (pressed('lipasRoutes') || S.overlays.lipasRoutes) errs.push('MTB: Official routes back on after a reload');
  polku.set({ activity: 'hike' }); await wait(150);
  if (tiles()[0] !== 'wmtHiking' || !pressed('lipasRoutes')) errs.push(`hike: tiles ${tiles()}, Official routes ${pressed('lipasRoutes') ? 'on' : 'off'}`);
  polku.set({ activity: 'mtb' }); await wait(150);
  tile('lipasRoutes').click(); await wait(60);
  return errs;
})()"""

# A tile's settings, Edit and More; the status on a tile
QUICK_STEPS = """(async () => {""" + QUICK_HELP + """
  await open();
  const h = () => qd.getBoundingClientRect().height;
  const h0 = h();
  qd.querySelector('.qt-opt[data-opts="trailColors"]').click(); await wait(300);
  if (qd.querySelector('h2').textContent !== 'Trail colours' || !qd.querySelector('.qd-back')) errs.push(`›: the step shows ${qd.querySelector('h2').textContent}`);
  if (Math.abs(h() - h0) > 1) errs.push(`a tile's settings changed the drawer's height ${Math.round(h0)} → ${Math.round(h())} px`);
  if (!qd.querySelector('.seg') || !qd.querySelector('.lg-key')) errs.push('Trail colours: not the full panel’s switches');
  for (const r of qd.querySelectorAll('input[type=range]')) if (r.getBoundingClientRect().height < 44) errs.push(`a slider ${Math.round(r.getBoundingClientRect().height)} px tall`);
  qd.querySelector('.qd-back').click(); await wait(300);
  if (!tile('trailColors') || document.activeElement !== qd.querySelector('.qt-opt[data-opts="trailColors"]')) errs.push('‹: not back at the tiles, with focus on the ›');
  // Edit: take one off, add one, kept; Reset; old and unknown tiles
  qd.querySelector('.qd-edit-btn').click(); await wait(300);
  if (!qd.querySelector('.qd-done') || qd.querySelectorAll('.qt-rm').length !== 5) errs.push('Edit: no Done, or not five tiles');
  if (qd.querySelectorAll('.qd-chip:not(:disabled)').length) errs.push('Edit: chips to add with five on');
  // the full panel's groups, in its order, each with what isn't on the drawer yet
  const groups = [...qd.querySelectorAll('.qd-grp')].map((g) => g.textContent).join();
  const mine = [...qd.querySelectorAll('.qt-rm')].map((b) => b.dataset.rm);
  const want = [...new Set(Object.entries(QUICK_TILE).filter(([id]) => !mine.includes(id) && id !== 'mmlMaastoOverlay').map(([, t]) => t.group))].join();
  if (groups !== want) errs.push(`Edit's groups: ${groups}, not ${want}`);
  if (qd.querySelector('.qd-chip[data-add="depthAreas"], .qd-chip[data-add="mmlMaastoOverlay"]')) errs.push('Edit offers one depth layer, or MML without a key');
  qd.querySelector('.qt-rm[data-rm="wx:rain"]').click(); await wait(80);
  if (qd.querySelectorAll('.qt-rm').length !== 4 || !qd.querySelector('.qd-slot')) errs.push('Edit: taking a tile off left no room');
  qd.querySelector('.qd-chip[data-add="hillshade"]').click(); await wait(80);
  qd.querySelector('.qd-done').click(); await wait(300);
  if (tiles().join() !== 'trailColors,trailDetails,lipasRoutes,wmtMtb,hillshade') errs.push(`after Edit: ${tiles()}`);
  if (JSON.parse(localStorage.getItem('polku:settings')).quickTiles.mtb.join() !== tiles().join()) errs.push('your tiles were not saved');
  // More: the full panel as it is, and back
  qd.querySelector('.qt-more').click(); await wait(300);
  if (isOpen() || lp.hidden || !lp.querySelector('.lg-group summary')) errs.push('More did not open the full panel');
  if (document.querySelector('#btn-layers').getAttribute('aria-expanded') !== 'true') errs.push('Layers is not expanded with the full panel open');
  lp.querySelector('.panel-back').click(); await wait(300);
  if (!isOpen() || !lp.hidden) errs.push('‹ in the full panel did not come back to the drawer');
  // the status on a tile: below its zoom, and its source failing
  polku.map.jumpTo({ zoom: 12 }); polku.map.fire('zoomend'); await wait(100);
  const small = (id) => tile(id).querySelector('small').textContent;
  if (small('trailDetails') !== 'Zoom in to see') errs.push(`Trail details at zoom 12: “${small('trailDetails')}”`);
  const net = await import(location.origin + '/js/net.js');
  const real = window.fetch;
  window.fetch = (u, o) => (/lipas/.test(String(u)) ? Promise.reject(new TypeError('Failed to fetch')) : real(u, o));
  await net.request('lipas', 'https://lipas.fi/geoserver/lipas/ows?polku-test=1').catch(() => {});
  await net.request('lipas', 'https://lipas.fi/geoserver/lipas/ows?polku-test=2').catch(() => {});
  window.fetch = real;
  await wait(400);
  if (!net.sourceStatus('lipas')) errs.push('(the test) LIPAS did not back off');
  else if (small('lipasRoutes') !== 'No data now') errs.push(`Official routes with LIPAS failing: “${small('lipasRoutes')}”`);
  polku.map.jumpTo({ zoom: 13.6 });
  return errs;
})()"""

# two points on straight legs, the planner at peek, and its route analysed (the summary has its size)
PLAN_TWO = """(async () => {
  const p = polku.planner; p.setActive(true); p.clear(); p.setMode('line'); p.addPoint([23.81, 61.512]); p.addPoint([23.82, 61.515]);
  for (let k = 0; k < 100 && !p.analysis; k++) await new Promise((r) => setTimeout(r, 100));
  p.setSheetState('peek');
  return true;
})()"""
# the swipe, with real touches: the drawer, the full panel and the planner's sheet
SHEET_STATE = "(() => ({ open: document.querySelector('#quick-layers').classList.contains('open'), all: !document.querySelector('#layers-panel').hidden, top: document.querySelector('#quick-layers').getBoundingClientRect().top, st: polku.planner.panel.dataset.state, h: polku.planner.panel.getBoundingClientRect().height, n: polku.planner.points.length, tf: document.querySelector('#quick-layers').style.transform }))()"


def quick(chrome):
    fails = []
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"', 'polku:winter': '"off"'})
    fails += pg.js(QUICK_TILES_JS, timeout=180000)
    pg.reload()
    fails += [f'reload: {e}' for e in pg.js(QUICK_AFTER)]
    fails += [f'1440: {e}' for e in pg.js(QUICK_STEPS)]
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    # old settings: no quickTiles; a tile this version doesn't know is skipped
    pg = chrome.page(1440, 900, False)
    pg.open_app({'activity': 'mtb', 'quickTiles': {'mtb': ['nope', 'wmtMtb', 'wmtMtb']}}, {'polku:winter': '"off"'})
    got = pg.js("document.querySelector('#btn-layers').click(), [...document.querySelectorAll('#quick-layers .qt-tog')].map((b) => b.dataset.tile).join()")
    if got != 'wmtMtb':
        fails.append(f'saved tiles with an unknown one: {got}')
    pg.js("polku.set({ activity: 'paddle' }); true")
    if pg.js("[...document.querySelectorAll('#quick-layers .qt-tog')].map((b) => b.dataset.tile).join()") != 'nautical,depths,sfShips,lipasPoints,wx:wind':
        fails.append('a sport you haven’t edited lost its own tiles')
    pg.close()
    fails += quick_desktop(chrome)
    for w, h_ in [(390, 844), (360, 740), (375, 667)]:
        fails += quick_phone(chrome, w, h_)
    fails += quick_swipe(chrome)
    print(f"{'ok  ' if not fails else 'FAIL'} the quick layer drawer and the one swipe" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# the card beside the button, within the map, clear of the side panel; above a bottom planner
def quick_desktop(chrome):
    fails = []
    for w, h_, dock in [(1440, 900, 'left'), (1280, 600, 'left'), (1440, 900, 'bottom')]:
        pg = chrome.page(w, h_, False)
        pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': json.dumps(dock), 'polku:winter': '"off"'})
        pg.js("(() => { const p = polku.planner; p.setActive(true); p.setSheetState(p.layout() === 'side' ? 'open' : 'half'); return true; })()")
        placed(pg)
        pg.js("document.querySelector('#btn-layers').click(), true")
        # (where they are once the planner has settled: on GitHub's runner its height still changed after the click, and the
        # card, read 0.4 s later while it moved, ran 6 px into it; once settled, the card had followed it, #410)
        late = pg.js(SETTLED)
        r = pg.js("""(() => {
          const box = (s) => document.querySelector(s).getBoundingClientRect().toJSON();
          return { q: box('#quick-layers'), b: box('#btn-layers'), p: box('#planner'), tail: document.querySelector('#quick-layers').classList.contains('tail'), H: innerHeight };
        })()""")
        q, b, p = r['q'], r['b'], r['p']
        name = f'{w}x{h_} {dock}'
        if late:
            fails.append(f'{name}: {late}')
        if q['right'] > b['left'] or q['top'] < 60 or q['bottom'] > r['H'] - 4:
            fails.append(f'{name}: the card at {q["left"]:.0f}–{q["right"]:.0f} × {q["top"]:.0f}–{q["bottom"]:.0f}, not beside the button within the map')
        if dock == 'left' and q['left'] < p['right']:
            fails.append(f'{name}: the card runs under the side panel')
        if dock == 'left' and abs(q['bottom'] - b['bottom']) > 1:
            fails.append(f'{name}: the card’s bottom at {q["bottom"]:.0f}, the button’s at {b["bottom"]:.0f}')
        if dock == 'bottom' and q['bottom'] > p['top']:
            fails.append(f"{name}: the card runs into the bottom planner: its bottom at {q['bottom']:.0f}, the planner's top at {p['top']:.0f}")
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        pg.close()
    return fails


# a phone: the sheet below the top bar, 44 px targets, the planner's peek as it was, the map tap that closes it
def quick_phone(chrome, w, h_):
    fails, name = [], f'{w}x{h_}'
    pg = chrome.page(w, h_, True)
    pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"'})
    pg.js(PLAN_TWO)
    pg.js(SETTLED)
    before = pg.js(SHEET_STATE)
    r = pg.js("""(async () => {
      document.querySelector('#btn-layers').click();
      await new Promise((r) => setTimeout(r, 400));
      const q = document.querySelector('#quick-layers'), out = { top: q.getBoundingClientRect().top, share: q.getBoundingClientRect().height / innerHeight, small: [], over: [] };
      for (const el of q.querySelectorAll('button')) {
        const b = el.getBoundingClientRect();
        if (b.width && (b.width < 44 || b.height < 44)) out.small.push(`${el.className || el.textContent} ${Math.round(b.width)}×${Math.round(b.height)}`);
      }
      for (const el of q.querySelectorAll('.qt-l, .qd-base span')) if (el.scrollWidth > el.clientWidth + 1) out.over.push(el.textContent);
      return out;
    })()""")
    if r['top'] < 64:
        fails.append(f'{name}: the sheet’s top at {r["top"]:.0f} px, under the top bar')
    limit = {844: 0.57, 740: 0.6, 667: 0.64}[h_]
    if r['share'] > limit:
        fails.append(f'{name}: the sheet takes {r["share"]:.0%} of the screen (the plan: {limit:.0%} at most)')
    fails += [f'{name}: a target under 44 px: {s}' for s in r['small']]
    fails += [f'{name}: a label overflows: {s}' for s in r['over']]
    pg.tap(w / 2, 150)  # the map above the sheet
    time.sleep(0.5)
    after = pg.js(SHEET_STATE)
    if after['open']:
        fails.append(f'{name}: a tap on the map did not close the drawer')
    if after['n'] != before['n']:
        fails.append(f'{name}: the tap that closed it added a point')
    pg.js(SETTLED)
    after = pg.js(SHEET_STATE)
    if after['st'] != 'peek' or abs(after['h'] - before['h']) > 1:
        fails.append(f'{name}: the planner is {after["st"]} {after["h"]:.0f} px after closing, not peek {before["h"]:.0f} px')
    fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    pg.close()
    return fails


def quick_swipe(chrome):
    fails = []
    pg = chrome.page(390, 844, True)
    pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"'})
    st = lambda: pg.js(SHEET_STATE)
    opened = lambda: pg.js("(async () => { if (!document.querySelector('#quick-layers').classList.contains('open')) document.querySelector('#btn-layers').click(); await new Promise((r) => setTimeout(r, 400)); return document.querySelector('#quick-layers').getBoundingClientRect().top; })()")
    top = opened()
    pg.swipe(195, top + 30, top + 330, ms=700, hold=0.2)  # a slow drag on the header, past 40 %
    time.sleep(0.4)
    if st()['open']:
        fails.append('a slow drag down on the header past 40 % did not close the drawer')
    top = opened()
    pg.swipe(195, top + 30, top + 90, ms=600, hold=0.2)  # short and slow: back as it was
    time.sleep(0.4)
    s = st()
    if not s['open'] or abs(s['top'] - top) > 1 or s['tf']:
        fails.append(f'a short slow drag: open {s["open"]}, top {s["top"]:.0f} (was {top:.0f}), transform “{s["tf"]}”')
    pg.swipe(195, top + 30, top + 100, ms=50, steps=5)  # a flick
    time.sleep(0.4)
    if st()['open']:
        fails.append('a flick down did not close the drawer')
    # from the ✕: a drag that starts on a button moves the sheet all the way, and doesn't press it
    top = opened()
    x = pg.js("(() => { const b = document.querySelector('#quick-layers .qd-x').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()")
    pg.swipe(x[0], x[1], x[1] + 320, ms=700, hold=0.2)
    time.sleep(0.4)
    if st()['open']:
        fails.append('a drag down that started on ✕ did not close the drawer (stopped after a few pixels?)')
    top = opened()
    pg.swipe(195, top + 30, top - 220, ms=500, hold=0.1)  # up: all layers
    time.sleep(0.5)
    s = st()
    if not s['all'] or s['open']:
        fails.append(f'a drag up did not open all layers (drawer open {s["open"]}, full panel {s["all"]})')
    lp_top = pg.js("document.querySelector('#layers-panel').getBoundingClientRect().top")
    pg.swipe(195, lp_top + 20, lp_top + 360, ms=600, hold=0.2)  # down on the full panel: back to the drawer
    time.sleep(0.5)
    s = st()
    if s['all'] or not s['open']:
        fails.append(f'a drag down on all layers did not come back to the drawer (full panel {s["all"]}, drawer {s["open"]})')
    # a tap on a tile still toggles it
    x = pg.js("(() => { const b = document.querySelector('#quick-layers .qt-tog[data-tile=\"lipasRoutes\"]').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()")
    on0 = pg.js("polku.state.overlays.lipasRoutes")
    pg.tap(x[0], x[1])
    time.sleep(0.4)
    if pg.js("polku.state.overlays.lipasRoutes") == on0:
        fails.append('a tap on a tile did not toggle it')
    pg.tap(x[0], x[1])
    time.sleep(0.3)
    # a drag that starts on a tile moves the sheet, and doesn't toggle it
    on0 = pg.js("polku.state.overlays.lipasRoutes")
    pg.swipe(x[0], x[1], x[1] + 300, ms=600, hold=0.2)
    time.sleep(0.4)
    if st()['open'] or pg.js("polku.state.overlays.lipasRoutes") != on0:
        fails.append('a drag down from a tile: the drawer stayed open, or the tile toggled')
    # the planner's sheet: the same swipe (#96)
    pg.js(PLAN_TWO)
    pg.js(SETTLED)
    head = pg.js("(() => { const b = document.querySelector('#planner .sheet-sum').getBoundingClientRect(); return [b.left + 30, b.top + b.height / 2]; })()")
    pg.swipe(head[0], head[1], head[1] - 300, ms=700, hold=0.2)  # slowly up from peek: the nearest size
    pg.js(SETTLED)
    s1 = st()
    if s1['st'] not in ('profile', 'half'):
        fails.append(f'planner: a slow drag up 300 px from peek came to {s1["st"]}, not profile or half')
    if pg.js("document.querySelector('#planner').classList.contains('dragging') || !!document.querySelector('#planner').style.transform"):
        fails.append('planner: still dragging after it came to rest')
    sheet_h = pg.js("parseFloat(document.documentElement.style.getPropertyValue('--sheet-h'))")
    if abs(sheet_h - s1['h']) > 1:
        fails.append(f'planner: --sheet-h {sheet_h} px for a {s1["h"]:.0f} px sheet after a swipe')
    pg.js("polku.planner.setSheetState('peek'); true")
    pg.js(SETTLED)
    pg.swipe(head[0], head[1], head[1] - 80, ms=60, steps=5)  # a flick up from peek: at least one size
    pg.js(SETTLED)
    if st()['st'] == 'peek':
        fails.append('planner: a flick up from peek left it at peek')
    pg.js("polku.planner.setSheetState('half'); true")
    pg.js(SETTLED)
    head = pg.js("(() => { const b = document.querySelector('#planner .sheet-sum').getBoundingClientRect(); return [b.left + 30, b.top + b.height / 2]; })()")
    pg.swipe(head[0], head[1], head[1] + 30, ms=25, steps=3)  # a short flick down from half: a size down at least, though it moved 30 px
    pg.js(SETTLED)
    if st()['st'] not in ('profile', 'peek', 'folded') or not pg.js('polku.planner.active'):  # (as far as the line, where a flick comes to rest: never away, step 3 of #233)
        fails.append(f'planner: a short flick down from half came to {st()["st"]}, open {pg.js("polku.planner.active")}')
    pg.js("polku.planner.setSheetState('full'); true")
    pg.js(SETTLED)
    # from the mode button (the toolbox is docked into a full sheet), down: the sheet moves, the mode stays, no menu opens
    mode0 = pg.js("polku.planner.mode")
    b = pg.js("(() => { const b = document.querySelector('#planner .modebtn').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()")
    pg.swipe(b[0], b[1], b[1] + 260, ms=600, hold=0.2)
    pg.js(SETTLED)
    if st()['st'] == 'full' or pg.js("polku.planner.mode") != mode0 or pg.js("!!document.querySelector('.menu-pop')"):
        fails.append(f'planner: a drag down from a mode button left it {st()["st"]}, mode {pg.js("polku.planner.mode")} (was {mode0})')
    # the body, scrolled to its top: a drag down moves the sheet
    pg.js("polku.planner.setSheetState('full'); true")
    pg.js(SETTLED)
    pg.js("polku.planner.els.body.scrollTop = 0; true")
    # on a waypoint's row (a button, most of the list): a drag down moves the sheet like the rest
    body = pg.js("(() => { const b = document.querySelector('#planner .wpl-point').getBoundingClientRect(); return [b.left + 40, b.top + b.height / 2]; })()")
    pg.swipe(body[0], body[1], body[1] + 300, ms=700, hold=0.2)
    pg.js(SETTLED)
    if st()['st'] == 'full':
        fails.append('planner: a drag down on the body at its top (from a waypoint’s row) did not move the sheet')
    # and a tap on the row still opens its point's card (25d's part 4); Back puts the sheet back
    pg.js("polku.planner.setSheetState('full'); true")
    pg.js(SETTLED)
    row = pg.js("(() => { const b = document.querySelector('#planner .wpl-point').getBoundingClientRect(); return [b.left + 40, b.top + b.height / 2]; })()")
    pg.tap(row[0], row[1])
    time.sleep(0.5)
    if pg.js("polku.planner.cards.current && polku.planner.cards.current.kind") != 'point':
        fails.append('planner: a tap on a waypoint’s row did not open its card')
    pg.js("polku.planner.cards.close(); true")
    # in Reorder a row keeps its own drag (a finger held 0.45 s): the sheet stays
    pg.js("(() => { const p = polku.planner; p.reordering = true; p.renderWaypoints(); p.setSheetState('full'); return true; })()")
    pg.js(SETTLED)
    pg.js("polku.planner.els.body.scrollTop = 0; true")
    grip = pg.js("(() => { const b = document.querySelector('#planner .wpl-row').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()")
    pg.swipe(grip[0], grip[1], grip[1] + 40, ms=400, hold=0.6)
    pg.js(SETTLED)
    if st()['st'] != 'full':
        fails.append(f'planner: a drag on a row of Reorder moved the sheet to {st()["st"]}')
    pg.js("(() => { const p = polku.planner; p.undo(); p.reordering = false; p.renderWaypoints(); return true; })()")
    # a tap on the handle still folds it
    pg.js("polku.planner.setSheetState('half'); true")
    pg.js(SETTLED)
    hd = pg.js("(() => { const b = document.querySelector('#planner .sheet-handle').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()")
    pg.tap(hd[0], hd[1])
    time.sleep(0.3)
    pg.js(SETTLED)
    if st()['st'] != 'peek':
        fails.append(f'planner: a tap on the handle left it {st()["st"]}, not peek')
    fails += [f'swipe console: {e[:160]}' for e in pg.errors()]
    pg.close()
    return fails


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
    # no Overpass in the layout checks: trail-detail tiles loading live made the timing flaky
    pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
    time.sleep(1.0)
    fails += [f'closed: {o}' for o in overlaps(pg.js(BOXES))]
    # on a phone the credits start folded behind their ⓘ (MapLibre opens them when their text comes in)
    if phone and pg.js("document.querySelector('.maplibregl-ctrl-attrib').classList.contains('maplibregl-compact-show')"):
        fails.append('the credits are open on a phone without a tap')

    pg.js("(() => { const p = polku.planner; p.setActive(true); p.clear(); p.setMode('line');"
          " for (const q of [[23.80, 61.509], [23.817, 61.519], [23.838, 61.516]]) p.addPoint(q); })()")
    pg.js("new Promise((ok) => { const p = polku.planner, t0 = Date.now(); const go = () => (p.analysis && p.analysis.pts.length > 10) || Date.now() - t0 > 30000 ? ok() : setTimeout(go, 200); go(); })")
    time.sleep(0.8)
    layout = pg.js("polku.planner.layout ? polku.planner.layout() : 'old'")
    # while planning, the timeline stays over the map (#225): on a phone just above the sheet, clear of the toolbox
    if pg.js("!!document.querySelector('#planner #wx-bar') || document.querySelector('#wx-bar').hidden"):
        fails.append('the timeline isn’t over the map while planning')
    states = ['open', 'min'] if layout == 'side' else ['peek', 'profile', 'half', 'full']
    for st in states:
        pg.js(f"polku.planner.setSheetState({json.dumps(st)}, {{ remember: false }}); true")
        late = pg.js(SETTLED)  # the sheet's and the controls' transitions (slow in software rendering)
        if late:
            fails.append(f'planning/{st}: {late}')
        ov = overlaps(pg.js(BOXES))
        fails += [f'planning/{st}: {o}' for o in ov]
        r = pg.js("(() => { const r = document.querySelector('#planner').getBoundingClientRect(), kf = document.querySelector('#planner .kf'); return { l: r.left, t: r.top, r: r.right, b: r.bottom, h: r.height, kf: kf ? kf.getBoundingClientRect().height : 0 }; })()")
        if layout == 'side':
            free = (w - r['r']) / w
            if free < 0.55:
                fails.append(f'side/{st}: only {free:.0%} of the width left for the map')
        elif st == 'peek' and r['h'] > 0.27 * h + r['kf']:  # the summary, Round trip & Style, and the routing modes; the key facts' line on top (#471's A2 puts it in the peek)
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


# #118: Check keeps all available breakdowns, with complete distance accounting.
COLOURS = """(async () => {
  const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const water = polku.state.activity === 'paddle';
  p.setActive(true);
  p.loadWind = async () => {}; // the forecast will arrive under the test's control
  await (await import(location.origin + '/js/trails.js')).holdFetches();
  const fx = await (await fetch(location.origin + '/tools/fixtures/route-kauppi-mtb.json')).json();
  if (water) {
    p.setMode('line');
    p.addPoint([23.760, 61.525]); p.addPoint([23.780, 61.531]);
  } else {
    fx.activity = polku.state.activity;
    fx.legs.forEach((l) => { l.mode = 'fixed'; }); // recorded geometry, never call the router
    p.restoreSnapshot(fx);
  }
  for (let k = 0; k < 100 && !p.analysis; k++) await wait(100);
  if (!p.analysis) return ['no analysed route'];
  p.reveal('colours');
  if (p.layout() === 'sheet') p.setSheetState('full', { remember: false });
  const a = p.analysis;
  const kinds = () => [...p.els.breakdown.querySelectorAll('.bd-kind')].filter((x) => !x.hidden);
  const keys = () => kinds().map((x) => x.dataset.colour);
  const need = (modes, when) => { for (const mode of modes) if (!keys().includes(mode)) errs.push(`${when}: missing ${mode}`); };
  need(water ? ['way'] : ['grade', 'surface', 'way'], 'before weather');
  if (keys().some((k) => ['wind', 'temp', 'rain'].includes(k))) errs.push('weather shown before the forecast');
  if (!kinds().length) return errs; // also makes this fail cleanly on the old single breakdown
  const groups = () => [...p.els.breakdown.querySelectorAll('.bd-group')].filter((x) => !x.hidden);
  if (!groups().length || groups().some((g) => !g.querySelector('.bd-kind:not([hidden])'))) errs.push('breakdowns are not grouped, or an empty group is visible');
  if (groups().some((g) => g.getAttribute('aria-label') === 'Weather')) errs.push('weather group shown before the forecast');
  if (water && keys().some((k) => ['grade', 'uphill', 'down', 'both', 'surface', 'width', 'vis'].includes(k))) errs.push('land breakdown on paddle');
  // Each rendered bar accounts for the complete route, including short categories.
  const distances = (when) => {
    for (const el of kinds()) {
      const pct = [...el.querySelectorAll('.bd-bar span')].reduce((sum, x) => sum + parseFloat(x.style.width), 0);
      if (Math.abs(pct - 100) > 0.01) errs.push(`${when}: ${el.dataset.colour} adds to ${pct}%`);
      const rows = p.breakdownRows(el.dataset.colour), d = rows.reduce((sum, x) => sum + x[1], 0);
      if (Math.abs(d - a.total) > 0.1) errs.push(`${when}: ${el.dataset.colour} distances add to ${d}, route ${a.total}`);
      if (el.querySelectorAll('.bd-item').length !== rows.filter((x) => x[1] > 0).length) errs.push(`${when}: a category missing from ${el.dataset.colour}'s legend`);
    }
  };
  const ways = a.ways;
  a.ways = [['path', a.total - 1], ['steps', 1]];
  p.renderBreakdown(); distances('short category');
  if (!/Steps 1 m/.test(p.els.breakdown.textContent)) errs.push('a 1 m category was omitted');
  a.ways = ways;
  const way = kinds().find((x) => x.dataset.colour === 'way');
  const pick = way.querySelector('.bd-title');
  p.setColorOnMap(false);
  pick.focus(); pick.click();
  if (p.colorMode !== 'way' || p.chart.mode !== 'way' || p.els.modeSel.value !== 'way' || pick.getAttribute('aria-pressed') !== 'true') errs.push('title did not select Colour by');
  if (!p.colorOnMap || !p.els.mapToggle.checked || !polku.map.getSource('routeColor').serialize().data.features.length) errs.push('title did not colour the map route');
  if (document.activeElement !== pick) errs.push('selecting a colour lost focus');
  const other = kinds().find((x) => x.dataset.colour !== 'way');
  if (other) {
    if (!/Use colours/.test(other.querySelector('.bd-title').textContent)) errs.push('no visible colour-selection action');
    other.querySelector('.bd-title').click();
  }
  const bar = way.querySelector('.bd-bar');
  if (bar.closest('button') !== pick) errs.push('title and bar are not one colour-selection control');
  p.showMode('way'); p.setColorOnMap(false); // selecting the same kind must re-enable map colours too
  pick.focus(); bar.click();
  if (p.colorMode !== 'way' || p.chart.mode !== 'way' || pick.getAttribute('aria-pressed') !== 'true') errs.push('bar did not select Colour by');
  if (!p.colorOnMap || p.els.modeSel.value !== 'way' || !polku.map.getSource('routeColor').serialize().data.features.length) errs.push('bar did not colour the map route');
  if (document.activeElement !== pick) errs.push('selecting a bar lost focus');
  if (Math.abs(pick.getBoundingClientRect().width - way.getBoundingClientRect().width) > 1) errs.push('colour control does not fill its row');
  if (p.els.breakdown.querySelector('.bd-kind .bd-fold')) errs.push('individual fold controls remain');

  const ground = way.closest('.bd-group'), fold = ground.querySelector('.bd-group-toggle'), list = ground.querySelector('.bd-group-list');
  if (!fold) return [...errs, 'no group fold control'];
  fold.focus(); fold.click();
  if (!list.hidden || fold.getAttribute('aria-expanded') !== 'false') errs.push('fold did not hide its whole group');
  // A forecast arrives while a different kind is selected; all three bars appear.
  const fill = (v) => new Float32Array(a.along.length).fill(v);
  a.wind = { head: fill(3), speed: fill(5), gust: fill(7), dir: fill(180), cross: fill(4), temp: fill(8), precip: fill(0) };
  p.renderBreakdown();
  need(['way', 'wind', 'temp', 'rain'], 'late weather'); distances('late weather');
  const weather = groups().find((g) => g.getAttribute('aria-label') === 'Weather');
  if (!weather || weather.querySelectorAll('.bd-kind:not([hidden])').length !== 3) errs.push('late weather did not appear together in its group');
  if (!list.hidden || p.colorMode !== 'way' || document.activeElement !== fold) errs.push('weather changed group fold, focus or Colour by');
  if (!water) {
    // Details arrive with Way type selected, not Width or Visibility.
    a.td.width.fill(-1); a.td.vis.fill(-1); p.renderBreakdown();
    if (keys().some((k) => ['width', 'vis'].includes(k))) errs.push('unmapped trail detail shown as data');
    a.td.width.fill(0); a.td.vis.fill(1); p.renderBreakdown();
    need(['width', 'vis'], 'late trail details'); distances('late trail details');
  }
  // A failed/new forecast leaves the other bars available and removes stale weather.
  a.wind = null; a.windError = true; p.renderBreakdown();
  if (keys().some((k) => ['wind', 'temp', 'rain'].includes(k))) errs.push('weather shown without data');
  if (groups().some((g) => g.getAttribute('aria-label') === 'Weather')) errs.push('empty weather group remains after forecast failure');
  need(['way'], 'failed weather');
  p.renderBreakdown();
  if (!list.hidden) errs.push('rendering reset a group fold');
  // No sideways scrolling in the drawer, and distinct controls with touch-sized targets.
  for (const el of kinds()) {
    if (el.scrollWidth > el.clientWidth + 1) errs.push(`${el.dataset.colour} overflows the panel`);
    for (const b of el.querySelectorAll('button')) if (!b.closest('[hidden]') && b.getBoundingClientRect().height < 40) errs.push(`small breakdown target: ${el.dataset.colour} ${b.className}`);
  }
  window.colourTestFold = 'colour-group-ground';
  return errs;
})()"""


def colours(chrome):
    fails = []
    for w, h_, phone, bottom in [(1440, 900, False, False), (390, 844, True, False), (1440, 900, False, True)]:
        for sport in ['mtb', 'gravel', 'hike', 'paddle']:
            name = f'{w}{" bottom" if bottom else ""} {sport}'
            pg = chrome.page(w, h_, phone)
            pg.open_app({'activity': sport, 'timeline': True}, {'polku:plannerDock': '"bottom"'} if bottom else None)
            fails += [f'{name}: {e}' for e in pg.js(COLOURS)]
            if bottom:
                geometry = pg.js("""(() => {
                  const groups = [...document.querySelectorAll('.bd-group')].filter((g) => !g.hidden);
                  return { lefts: groups.map((g) => g.getBoundingClientRect().left),
                    overflow: groups.some((g) => g.scrollWidth > g.clientWidth + 1) };
                })()""")
                if geometry['overflow'] or (len(geometry['lefts']) > 1 and len(set(geometry['lefts'])) < 2):
                    fails.append(f'{name}: groups overflow or do not use columns in the wide panel')
            if phone and sport == 'mtb':
                # Native keyboard actions: the combined title/bar is one stop, the fold is separate.
                pg.js("polku.planner.setColorOnMap(false); document.querySelector('[data-colour=grade] .bd-title').focus(); true")
                # Enter activates a button on keypress; raw keydown alone omits that event.
                for event in ['rawKeyDown', 'char', 'keyUp']:
                    fields = {'type': event, 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13}
                    if event == 'char':
                        fields['text'] = '\r'
                    chrome.send('Input.dispatchKeyEvent', fields, pg.s)
                if not pg.js("polku.planner.colorMode === 'grade' && polku.planner.colorOnMap && polku.map.getSource('routeColor').serialize().data.features.length > 0"):
                    fails.append(f'{name}: Enter did not select the focused breakdown')
                pg.js("document.querySelector('.bd-group[aria-label=Terrain] .bd-group-toggle').focus(); true")
                for event in ['rawKeyDown', 'keyUp']:
                    chrome.send('Input.dispatchKeyEvent', {'type': event, 'key': ' ', 'code': 'Space', 'windowsVirtualKeyCode': 32}, pg.s)
                if not pg.js("document.querySelector('.bd-group[aria-label=Terrain] .bd-group-list').hidden"):
                    fails.append(f'{name}: Space did not fold the focused group')
            if pg.js("!!window.colourTestFold"):
                pg.reload()
                pg.js("new Promise((ok) => { const go = () => { if (polku.planner.analysis) { polku.planner.reveal('colours'); ok(true); } else setTimeout(go, 100); }; go(); })")
                if pg.js("document.querySelector('.bd-group[aria-label=Ground] .bd-group-toggle')?.getAttribute('aria-expanded')") != 'false':
                    fails.append(f'{name}: group fold not remembered after reload')
                if not pg.js("polku.planner.colorOnMap && document.querySelector('.bd-group[aria-label=Ground] .bd-group-list').hidden"):
                    fails.append(f'{name}: route colours or group fold lost after reload')
            fails += [f'{name}: console: {e[:160]}' for e in pg.errors()]
            pg.close()
            print(f'checked route breakdowns: {name}', flush=True)
    print(f"{'ok  ' if not fails else 'FAIL'} all route colour breakdowns" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# #207: preview categories without changing route, colours or camera.
PREVIEWS = r"""(async () => {
  const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  p.setActive(true); p.loadWind = async () => {}; p.loadTrail = async () => {};
  await (await import(location.origin + '/js/trails.js')).holdFetches();
  const fx = await (await fetch(location.origin + '/tools/fixtures/route-kauppi-mtb.json')).json();
  fx.activity = polku.state.activity; fx.legs.forEach((l) => { l.mode = 'fixed'; });
  p.restoreSnapshot(fx);
  for (let k = 0; k < 100 && !p.analysis; k++) await wait(100);
  if (!p.analysis) return ['no analysed route'];
  p.reveal('colours'); if (p.layout() === 'sheet') p.setSheetState('full', { remember: false });
  const settled = await __PREVIEW_SETTLED__; if (settled) errs.push(settled);
  if (!polku.map.getSource('routePreview')) return ['no category preview source'];
  const a = p.analysis, n = a.pts.length;
  const fill = (v) => new Float32Array(n).fill(v);
  a.wind = { head: fill(3), speed: fill(5), gust: fill(7), dir: fill(180), cross: fill(4), temp: fill(8), precip: fill(0) };
  a.td.width.fill(0); a.td.vis.fill(1);
  p.showMode('way'); p.setColorOnMap(false);
  const data = () => polku.map.getSource('routePreview').serialize().data.features;
  const empty = (why) => { if (data().length || p.els.breakdown.querySelector('.bd-preview')) errs.push(`preview remains after ${why}`); };
  const fire = (el, type, pointerType = 'mouse') => el.dispatchEvent(new PointerEvent(type, { pointerType }));
  const cell = (mode, key, legend = false) => [...p.breakdownKinds[mode].el.querySelectorAll(legend ? '.bd-item' : '.bd-bar span')].find((el) => el.dataset.category === String(key));
  const saved = JSON.stringify({ mode: p.colorMode, onMap: p.colorOnMap, leave: p.leaveAt, points: p.points, camera: [polku.map.getCenter().toArray(), polku.map.getZoom(), polku.map.getBearing(), polku.map.getPitch()], settings: [localStorage.getItem('polku:colorMode'), localStorage.getItem('polku:colorOnMap')] });
  const unchanged = () => JSON.stringify({ mode: p.colorMode, onMap: p.colorOnMap, leave: p.leaveAt, points: p.points, camera: [polku.map.getCenter().toArray(), polku.map.getZoom(), polku.map.getBearing(), polku.map.getPitch()], settings: [localStorage.getItem('polku:colorMode'), localStorage.getItem('polku:colorOnMap')] }) === saved;
  const { lineLength } = await import(location.origin + '/js/geo.js');
  // All rendered categories highlight the distance printed in their legend, including weather and trail details.
  for (const [mode, kind] of Object.entries(p.breakdownKinds)) {
    if (kind.el.hidden) continue;
    for (const row of p.breakdownRows(mode)) {
      const el = cell(mode, row[3], true); fire(el, 'pointerenter');
      const length = data().reduce((sum, f) => sum + lineLength(f.geometry.coordinates), 0);
      if (!data().length || Math.abs(length - row[1]) > Math.max(1, row[1] * 0.0001)) errs.push(`${mode} ${row[0]}: highlighted ${length}, legend ${row[1]}`);
      if (kind.el.querySelectorAll('.bd-preview').length !== 2) errs.push(`${mode}: bar and legend are not linked`);
      if (!unchanged()) errs.push(`${mode}: preview changed a saved choice, departure, route or camera`);
      fire(el, 'pointerleave'); empty(`${mode} leave`);
    }
  }
  // Alternate two flat samples and two steep ones. Every disconnected flat run must stay separate.
  a.eleGap = null; a.terrain = null; a.grade = Array.from({ length: n }, (_, i) => i % 4 < 2 ? 0 : 12);
  p.renderBreakdown();
  const flat = p.breakdownRows('grade').find((r) => r[0] === 'flat');
  if (!flat) return [...errs, 'no flat test category'];
  let expectedRuns = 0, expectedEdges = 0, running = false;
  const flatEdges = new Set();
  for (let i = 1; i < n; i++) { const hit = i % 4 < 2; if (hit) { expectedEdges++; flatEdges.add(JSON.stringify([a.pts[i - 1], a.pts[i]])); if (!running) expectedRuns++; } running = hit; }
  const checkFlat = () => {
    const actualEdges = data().reduce((sum, f) => sum + f.geometry.coordinates.length - 1, 0);
    if (data().length !== expectedRuns || actualEdges !== expectedEdges) errs.push('flat preview joins gaps or omits matching runs');
    for (const f of data()) for (let j = 1; j < f.geometry.coordinates.length; j++) {
      // A recorded route may visit the same coordinate more than once; compare edges, not the first matching point.
      if (!flatEdges.has(JSON.stringify(f.geometry.coordinates.slice(j - 1, j + 1)))) errs.push('flat preview contains a non-flat edge');
    }
  };
  const segment = cell('grade', flat[3]), legend = cell('grade', flat[3], true);
  fire(segment, 'pointerenter'); checkFlat();
  fire(segment, 'pointerleave'); empty('bar leave');
  fire(legend, 'pointerenter'); checkFlat();
  fire(legend, 'pointercancel'); empty('pointer cancel');
  fire(segment, 'pointerenter', 'touch'); empty('touch enter');
  fire(segment, 'pointerenter');
  const steep = p.breakdownRows('grade').find((r) => r[0] !== 'flat'), next = cell('grade', steep[3], true);
  fire(next, 'pointerenter'); const newer = JSON.stringify(data());
  fire(segment, 'pointerleave');
  if (!data().length || JSON.stringify(data()) !== newer) errs.push('a late leave cleared the newer category');
  fire(next, 'pointerleave'); empty('newer leave');
  // Unknown terrain and known flat/down share the same grey; they must not highlight one another.
  a.eleGap = Uint8Array.from({ length: n }, (_, i) => i % 3 === 0 ? 1 : 0); a.upCls.fill(-1); p.renderBreakdown();
  const unknown = p.breakdownRows('uphill').find((r) => r[0] === 'no terrain');
  const known = p.breakdownRows('uphill').find((r) => r[0] === 'flat / down');
  if (!unknown || !known || unknown[2] !== known[2]) return [...errs, 'no equal-colour test categories'];
  for (const [row, gap] of [[unknown, true], [known, false]]) {
    fire(cell('uphill', row[3], true), 'pointerenter');
    const expected = [...a.eleGap].slice(1).filter((v) => !!v === gap).length;
    if (data().reduce((sum, f) => sum + f.geometry.coordinates.length - 1, 0) !== expected) errs.push('categories sharing a colour were combined');
  }
  p.previewCategory('uphill', 'missing category', p.breakdownKinds.uphill.pick); empty('no matches');
  const enter = () => fire(cell('grade', flat[3]), 'pointerenter');
  enter(); p.renderBreakdown(); empty('data redraw');
  enter(); p.setLeave(Date.now() / 1000 + 3600); empty('departure update'); p.setLeave(null);
  enter(); p.setTab('go'); empty('tab change'); p.setTab('check');
  enter(); p.toggleSection('colours', false); empty('section fold'); p.toggleSection('colours', true);
  enter(); const fold = p.breakdownKinds.grade.el.closest('.bd-group').querySelector('.bd-group-toggle'); fold.click(); empty('group fold'); fold.click();
  enter(); p.setActive(false); empty('planner close'); p.setActive(true);
  enter(); p.setSheetState(p.layout() === 'side' ? 'min' : 'peek', { remember: false }); empty('planner minimise'); p.reveal('colours');
  const windRow = p.breakdownRows('wind')[0]; fire(cell('wind', windRow[3]), 'pointerenter');
  a.wind = null; p.renderBreakdown(); empty('forecast loss');
  a.eleGap = null; p.renderBreakdown();
  p.showMode('way'); p.setColorOnMap(false);
  p.setSheetState(p.layout() === 'side' ? 'open' : 'full', { remember: false });
  const ready = await __PREVIEW_SETTLED__; if (ready) errs.push(ready);
  window.categoryPreviewReady = true;
  return errs;
})()""".replace('__PREVIEW_SETTLED__', SETTLED)


def previews(chrome):
    fails = []
    for w, h_, phone in [(1440, 900, False), (390, 844, True)]:
        pg = chrome.page(w, h_, phone)
        pg.open_app({'activity': 'mtb', 'timeline': True})
        fails += [f'{w}: {e}' for e in pg.js(PREVIEWS)]
        if pg.js('!!window.categoryPreviewReady'):
            pg.js("document.querySelector('.bd-group[aria-label=Terrain] .bd-group-toggle').focus(); true")
            def key(name, code, vk, char=None):
                for event in ['rawKeyDown'] + (['char'] if char is not None else []) + ['keyUp']:
                    fields = {'type': event, 'key': name, 'code': code, 'windowsVirtualKeyCode': vk}
                    if event == 'char':
                        fields['text'] = char
                    chrome.send('Input.dispatchKeyEvent', fields, pg.s)
            key('Tab', 'Tab', 9)
            if not pg.js("document.activeElement === polku.planner.breakdownKinds.grade.pick && polku.planner.categoryPreview?.mode === 'grade' && !!document.querySelector('#colour-preview-status').textContent"):
                fails.append(f'{w}: keyboard focus did not preview and announce a category')
            initial = pg.js('polku.planner.categoryPreview?.key')
            key('ArrowRight', 'ArrowRight', 39)
            if not pg.js("polku.planner.categoryPreview && polku.planner.colorMode === 'way' && !polku.planner.colorOnMap") or pg.js('polku.planner.categoryPreview?.key') == initial:
                fails.append(f'{w}: arrow preview changed colours or did not change category')
            key('Escape', 'Escape', 27)
            if pg.js("polku.planner.categoryPreview || polku.planner.tab !== 'check' || polku.map.getSource('routePreview').serialize().data.features.length"):
                fails.append(f'{w}: Escape did not clear only the preview')
            key('ArrowLeft', 'ArrowLeft', 37)
            if not pg.js("polku.planner.categoryPreview?.key === polku.planner.breakdownRows('grade').at(-1)[3]"):
                fails.append(f'{w}: Left did not preview the last category')
            key('Home', 'Home', 36)
            key('End', 'End', 35)
            key('Enter', 'Enter', 13, '\r')
            if not pg.js("polku.planner.colorMode === 'grade' && polku.planner.colorOnMap && !polku.planner.categoryPreview"):
                fails.append(f'{w}: Enter did not select colours and clear the preview')
            pg.js("document.querySelector('[data-colour=grade] .bd-bar span').dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'})); polku.planner.clear(); true")
            if pg.js("polku.map.getSource('routePreview').serialize().data.features.length"):
                fails.append(f'{w}: clearing the route left a preview')
        fails += [f'{w}: console: {e[:160]}' for e in pg.errors()]
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} category previews" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# #201: route mark defaults, independent options, elapsed times and the departure link.
MARKS = r"""(async () => {
  const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  p.loadWind = async () => {};
  (await import(location.origin + '/js/trails.js')).holdFetches();
  if (!p.marks.km || !p.marks.time || !p.marks.duration) errs.push('distance, arrival and elapsed time are not all on by default');
  p.setActive(true); p.setMode('line');
  for (const q of [[23.700, 61.500], [23.705, 61.501], [23.760, 61.504]]) p.addPoint(q);
  for (let k = 0; k < 100 && !p.analysis; k++) await wait(100);
  if (!p.analysis) return ['no route'];
  const data = () => polku.map.getSource('routeMarks').serialize().data.features;
  const label = () => data()[0]?.properties.label || '';
  if (!/^1 km · .+\n.+ elapsed$/.test(label())) errs.push(`default mark has no arrival/elapsed times: ${label()}`);
  const seconds = (text) => {
    const h = /([0-9]+) h/.exec(text), m = /([0-9]+) min/.exec(text), s = /([0-9]+) s/.exec(text);
    return (h ? +h[1] * 3600 : 0) + (m ? +m[1] * 60 : 0) + (s ? +s[1] : 0);
  };
  const before = seconds(label().split('\n')[1] || '');
  p.setStop(1, { min: 45 });
  const after = seconds(label().split('\n')[1] || '');
  if (Math.abs(after - before - 2700) > 1) errs.push(`elapsed time ignored the break: ${before} → ${after}`);
  p.setStop(1, null);
  // Exact seconds and hour rollover, independent of the forecast and sport's speed.
  const a = p.analysis, original = a.tAt;
  a.tAt = Float64Array.from(a.along, (d) => d * 0.045); p.drawMarks();
  if (!/45 s elapsed/.test(label())) errs.push(`seconds-only duration: ${label()}`);
  a.tAt = Float64Array.from(a.along, (d) => d * 4); p.drawMarks();
  if (!/1 h 6 min 40 s elapsed/.test(label())) errs.push(`hour/minute/second duration: ${label()}`);
  // Arrival times move immediately, while the old weather is still in memory.
  a.wind = { startSec: p.startSec() }; a.tAtWind = a.tAt;
  p.setLeave(Date.now() / 1000 + 3 * 3600);
  const arrival = p.clockOf(p.startSec() + 4000);
  if (!label().includes(`1 km · ${arrival}`)) errs.push(`departure did not move the mark immediately: ${label()}`);
  a.wind = null; a.tAtWind = null; a.tAt = original;
  p.renderAnalysis();
  // (the marks' switches: Layers' Your route group, #424's C; open, as a person opens it)
  if (document.querySelector('#layers-panel').hidden) { document.querySelector('#btn-layers').click(); document.querySelector('#quick-layers .qt-more').click(); }
  await wait(300);
  const switches = () => [...document.querySelectorAll('#layers-body .onmap input')];
  if (switches().length !== 3 || switches().some((x) => !x.checked)) errs.push('not three enabled mark controls');
  else {
    switches()[1].click();
    if (/ · /.test(label()) || !/elapsed/.test(label())) errs.push('arrival toggle also removed elapsed time');
    switches()[2].click();
    if (label() !== '1 km') errs.push(`distance-only mark: ${label()}`);
    switches()[1].click();
    if (!/ · /.test(label()) || /elapsed/.test(label())) errs.push('arrival-only mark');
    switches()[0].click();
    if (data().length || !switches()[1].disabled || !switches()[2].disabled) errs.push('distance off: marks remain or dependent options enabled');
    switches()[0].click(); switches()[2].click();
  }
  document.querySelector('#layers-panel .panel-x, #layers-panel [aria-label=Close]')?.click(); await wait(300);
  // Follow the estimate from Check, even when Go’s Time section and the sheet are folded.
  p.toggleSection('speed', false);
  if (p.layout() === 'sheet') p.setSheetState('peek', { remember: false });
  document.querySelector('.sum-time').click(); await wait(500);
  const settled = await __DEPARTURE_SETTLED__;
  if (settled) errs.push(`departure sheet: ${settled}`);
  // (Go's Leave: the phone's own date and time over its row, #364's C; the leave group tries it as a person)
  const leave = document.querySelector('#pl-pane-go .pick-leave'), input = leave && leave.querySelector('input');
  if (p.tab !== 'go' || p.sec.speed.el.dataset.open !== 'true' || !input || document.activeElement !== input) errs.push('estimate did not open Go and focus its Leave');
  if (input) {
    const hour = (k) => (Math.floor(Date.now() / 3600000) + k) * 3600, iso = (sec) => { const d = new Date(sec * 1000), z = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
    input.value = iso(hour(4)); input.dispatchEvent(new Event('change', { bubbles: true }));
    if (p.startSec() !== new Date(input.value).getTime() / 1000) errs.push('Leave did not change the departure'); // (what the field says: on the night the clocks go back, an hour is twice)
    const r = leave.querySelector('.row').getBoundingClientRect(), body = p.els.body.getBoundingClientRect();
    if (r.top < body.top || r.bottom > body.bottom) errs.push('Go’s Leave is out of view');
    if (r.height < 44 || parseFloat(getComputedStyle(input).fontSize) < 16) errs.push('Go’s Leave is too small, or its field zooms a phone');
    // (Route's list says it on the start's row, 25d's part 4; the start's card and Go set it)
    const waypoint = () => p.els.points.querySelector('.wpl-point[data-i="0"]')?.textContent || '';
    if (!waypoint().includes(`Leave ${p.leaveWords()}`) || !document.querySelector('.time-head').textContent.includes(p.clockOf(p.startSec() + (p.analysis.timeWind || p.analysis.time)))) errs.push('Go departure did not update the start’s row or There at immediately');
    p.setLeave(hour(6), { fromMap: true });
    if (leave.querySelector('.val').textContent !== p.timeOf(hour(6)) || !waypoint().includes(`Leave ${p.leaveWords()}`)) errs.push('timeline departure did not update Go’s Leave and the start’s row');
    input.focus(); p.renderAnalysis();
    if (document.activeElement !== input || !input.isConnected) errs.push('an analysis update replaced the focused Leave');
    p.setLeave(null);
  }
  p.setMarks({ km: false, time: false, duration: false });
  return errs;
})()""".replace("__DEPARTURE_SETTLED__", SETTLED)


def marks(chrome):
    fails = []
    for w, h_, phone in [(1440, 900, False), (390, 844, True)]:
        for sport in ['mtb', 'paddle']:
            pg = chrome.page(w, h_, phone)
            pg.open_app({'activity': sport, 'timeline': True})
            fails += [f'{w} {sport}: {e}' for e in pg.js(MARKS)]
            pg.reload()
            if pg.js("Object.values(polku.planner.marks).some(Boolean)"):
                fails.append(f'{w} {sport}: explicitly saved off choices lost on reload')
            # Old settings without a duration field keep their old choices and enable the new option.
            pg.open_app({'activity': sport}, {'polku:routeMarks': '{"km":true,"time":false}'})
            if pg.js("!polku.planner.marks.km || polku.planner.marks.time || !polku.planner.marks.duration"):
                fails.append(f'{w} {sport}: old mark settings not read correctly')
            fails += [f'{w} {sport}: console: {e[:160]}' for e in pg.errors()]
            pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} route marks and departure link" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# #221: real deployed notes, failed/retried and late responses, keyboard and
# phone scrolling. Routes are straight lines; no routing service is contacted.
def changelog(chrome):
    fails = []
    for w, h_, phone in [(1440, 900, False), (390, 844, True)]:
        pg = chrome.page(w, h_, phone)
        pg.open_app({'activity': 'mtb', 'timeline': True})
        errs = pg.js("""(async () => {
          const p = polku.planner, wait = ms => new Promise(r => setTimeout(r, ms)), errs = [];
          p.setActive(true); p.clear(); p.setMode('line'); p.addPoint([23.80,61.51]); p.addPoint([23.82,61.52]); await p.analysing;
          const count = () => document.querySelectorAll('.modal-changelog[open]').length;
          document.querySelector('#btn-settings').click();
          window.notesOpener = document.querySelector('#btn-changelog');
          if (!window.notesOpener) return ['no What’s new entry in Settings'];
          window.notesSnapshot = () => JSON.stringify({points:p.points, legs:p.legs.map(l => l.result?.coords), undo:p.past.length, active:p.active, timeline:polku.state.timeline, camera:[polku.map.getCenter().toArray(),polku.map.getZoom(),polku.map.getPitch(),polku.map.getBearing()]});
          window.notesBefore = notesSnapshot();
          const net = await import('./js/net.js'); const before = net.usage().find(s => s.id === 'polku').session;
          notesOpener.focus(); notesOpener.click();
          const start = Date.now(); while (document.querySelector('.changelog-notes[aria-busy]') && Date.now()-start<15000) await wait(50);
          const notes = document.querySelector('.changelog-notes'), status = document.querySelector('.modal-changelog [role=status]');
          if (!count() || !notes?.querySelector('h3') || !notes.querySelector('h4') || !notes.querySelector('li strong')) errs.push('real changelog did not render dates/headings/lists/bold');
          if (!/Release notes through \d{4}-\d{2}-\d{2}/.test(status?.textContent || '')) errs.push('no source date');
          if ((net.usage().find(s => s.id === 'polku').session) !== before+1) errs.push('changelog did not use request()');
          const b = document.querySelector('.modal-changelog .modal-body'); b.scrollTop = 2000;
          if (b.scrollTop < 100 || b.scrollWidth > b.clientWidth+1) errs.push('notes do not scroll or overflow sideways');
          for (const key of ['r','f','t','l','z','/']) document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,ctrlKey:key==='z'}));
          if (notesSnapshot() !== notesBefore || document.querySelector('#settings-panel').hidden) errs.push('reading notes changed route, camera, timeline or Settings');
          return errs;
        })()""")
        fails += [f'{w}: {e}' for e in errs]
        if pg.js('!!document.querySelector(".modal-changelog[open]")'):
            for _ in range(12):
                chrome.send('Input.dispatchKeyEvent', {'type': 'rawKeyDown', 'key': 'Tab', 'code': 'Tab', 'windowsVirtualKeyCode': 9}, pg.s)
                if not pg.js('document.querySelector(".modal-changelog").contains(document.activeElement)'):
                    fails.append(f'{w}: Tab escaped the native dialog')
                    break
            chrome.send('Input.dispatchKeyEvent', {'type': 'rawKeyDown', 'key': 'Escape', 'code': 'Escape', 'windowsVirtualKeyCode': 27}, pg.s)
            pg.js('new Promise(r => setTimeout(r,100))')
            if not pg.js('!document.querySelector(".modal-changelog").open && document.activeElement === notesOpener && !document.querySelector("#settings-panel").hidden && notesSnapshot() === notesBefore'):
                fails.append(f'{w}: Escape did not close and restore focus/route/Settings')
            errs = pg.js("""(async () => {
              const errs=[], wait=ms=>new Promise(r=>setTimeout(r,ms));
              const real=window.fetch; let calls=0, release;
              const fixture='# Changelog\\n\\n## 2026-10-17\\n\\n### A safe update\\n- **Bold** and `code` with [source](docs/USING.md), [unsafe](javascript:alert%281%29) and <img src=x onerror=alert(1)>.';
              window.fetch=(url,opts)=>String(url).endsWith('/CHANGELOG.md') ? (++calls===1 ? Promise.resolve(new Response('unavailable',{status:503})) : calls===2 ? Promise.resolve(new Response(fixture)) : new Promise(r=>{release=r;})) : real(url,opts);
              notesOpener.click(); await wait(100);
              const d=document.querySelector('.modal-changelog'), b=d.querySelector('.modal-body'), status=d.querySelector('[role=status]');
              const retry=[...b.querySelectorAll('button')].find(x=>x.textContent==='Retry');
              if (!/could not be loaded/.test(status.textContent) || retry.hidden || !b.querySelector('a[href*="github.com"]')) errs.push('failure has no honest message/retry/full source');
              retry.click(); await wait(100);
              const n=b.querySelector('.changelog-notes');
              if (!n.querySelector('code') || n.querySelector('img,script') || n.querySelector('a[href^="javascript:"]') || !n.textContent.includes('<img')) errs.push('unsafe Markdown rendered as executable content or no inline code');
              if (n.querySelector('a')?.href !== 'https://github.com/TommiContursi/Polku/blob/main/docs/USING.md') errs.push('relative document link has wrong source');
              d.querySelector('[aria-label=Close]').click(); await wait(100);
              if (document.activeElement!==notesOpener) errs.push('close button did not restore focus');
              notesOpener.click(); await wait(100);
              if (!/Loading/.test(d.querySelector('[role=status]').textContent)) errs.push('no loading state');
              d.querySelector('[aria-label=Close]').click(); await wait(100);
              const M=await import('./js/modal.js'); M.openModal({title:'Different window'},body=>body.append('Still here'));
              release(new Response(fixture)); await wait(100);
              if (document.querySelector('#modal-title').textContent!=='Different window' || document.querySelector('.modal-body').textContent!=='Still here') errs.push('late response replaced another window');
              M.closeModal(); window.fetch=real;
              if (notesSnapshot()!==notesBefore) errs.push('failed/retried/closed notes changed the route');
              return errs;
            })()""")
            fails += [f'{w}: {e}' for e in errs]
        fails += [f'{w}: console: {e[:160]}' for e in pg.errors()]
        pg.close()
    # CDP page-only offline leaves a service worker's fetch online. Apply the
    # real network outage to both targets, with the worker controlling the page.
    pg = chrome.page(390, 844, True)
    pg.open_app({'activity': 'hike'})
    chrome.send('Network.setBypassServiceWorker', {'bypass': False}, pg.s)
    pg.js("""(async()=>{await Promise.race([(async()=>{await navigator.serviceWorker.register('./sw.js'); await navigator.serviceWorker.ready;})(), new Promise((_,reject)=>setTimeout(()=>reject(new Error('service worker not ready after 15 s')),15000))]);
      const c=await caches.open('polku-shell-v1'); await c.delete(new URL('./CHANGELOG.md',location.href).href);
      })()""")
    pg.reload()  # a page originally loaded with bypass gains its controller on navigation
    if not pg.js('!!navigator.serviceWorker.controller'):
        fails.append('offline check: page is not controlled by the real worker')
    worker_url = BASE + 'sw.js'
    worker = next((t for t in chrome.send('Target.getTargets')['targetInfos'] if t['type'] == 'service_worker' and t['url'] == worker_url), None)
    if not worker:
        raise RuntimeError('offline check: no service-worker CDP target at ' + worker_url)
    worker_session = chrome.send('Target.attachToTarget', {'targetId': worker['targetId'], 'flatten': True})['sessionId']
    chrome.send('Network.enable', {}, worker_session)

    def offline(on):
        for session in [pg.s, worker_session]:
            chrome.send('Network.emulateNetworkConditions', {'offline': on, 'latency': 0, 'downloadThroughput': 0 if on else -1, 'uploadThroughput': 0 if on else -1}, session)

    loaded = "new Promise(r=>{const start=Date.now(); const go=()=>!document.querySelector('.changelog-notes[aria-busy]') || Date.now()-start>15000 ? r():setTimeout(go,50);go();})"
    try:
        pg.js("document.querySelector('#btn-settings').click(); true")
        offline(True)
        pg.js("document.querySelector('#btn-changelog').click(); " + loaded)
        status = pg.js("document.querySelector('.modal-changelog [role=status]').textContent")
        if 'offline and no saved' not in status:
            fails.append('worker offline without cache: no explicit unavailable state: ' + status)
        offline(False)
        pg.js("document.querySelector('.modal-changelog .btn').click(); " + loaded)
        if not pg.js("!!document.querySelector('.changelog-notes h3')"):
            fails.append('worker online: Retry did not load real notes')
        pg.js("document.querySelector('.modal-changelog [aria-label=Close]').click(); new Promise(r=>setTimeout(r,100))")
        offline(True)
        pg.js("document.querySelector('#btn-changelog').click(); " + loaded)
        if not pg.js("/Offline: showing saved release notes through \d{4}-\d{2}-\d{2}/.test(document.querySelector('.modal-changelog [role=status]').textContent)"):
            fails.append('worker offline with cache: no dated saved-copy notice')
        fails += [f'worker offline: console: {e[:160]}' for e in pg.errors()]
    finally:
        offline(False)
        chrome.send('Target.detachFromTarget', {'sessionId': worker_session})
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} in-app changelog" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# #133: recorded FMI palette samples, rebuilt as tiny multi-strip TIFFs. There
# are no live radar requests. Reordered indexes must keep the same measurements.
RADAR = r"""(async () => {
  const errs = [], fx = window.radarFixture, w = fx.samples.length * 8, h = 8;
  const { fmiRadar } = await import('./js/radar.js'), net = await import('./js/net.js');
  const real = window.fetch, calls = [], box = [-1, -1, 1, 1];
  let mode = 'normal', le = true, remap = false;
  const index = s => remap ? (s.index + 12345) % 65536 : s.index;
  const tiff = (raw = false, bad = false, dbz = false, missingWhite = true) => {
    const bits = raw ? 8 : 16, n = raw ? 0 : 65536, bpp = bits / 8;
    const count = raw ? 9 : 10, arrays = 8 + 2 + count * 12 + 4, pal = arrays + 16, pixels = pal + n * 6;
    const buf = new ArrayBuffer(pixels + w * h * bpp), d = new DataView(buf);
    const u16 = (p, v) => d.setUint16(p, v, le), u32 = (p, v) => d.setUint32(p, v, le);
    u16(0, 0x4949); if (!le) u16(0, 0x4d4d); u16(2, 42); u32(4, 8); u16(8, count);
    const tags = [[256,4,1,w],[257,4,1,h],[258,3,1,bits],[259,3,1,1],[262,3,1,raw?1:3],
      [273,4,2,arrays],[277,3,1,1],[278,4,1,4],[279,4,2,arrays+8]];
    if (!raw) tags.push([320,3,n*3,pal]);
    tags.forEach(([tag,type,num,value],i) => { const p=10+i*12; u16(p,tag);u16(p+2,type);u32(p+4,num); if(type===3 && num===1)u16(p+8,value);else u32(p+8,value); });
    u32(arrays,pixels);u32(arrays+4,pixels+w*4*bpp);u32(arrays+8,w*4*bpp);u32(arrays+12,w*4*bpp);
    if (!raw) fx.samples.forEach(s => {
      const rgb=dbz ? s.expectedMmh===null?(missingWhite?[255,255,255]:[255,0,255]):s.name==='dry'?[0,0,1]:s.name==='trace'?fx.reflectivityReference.encodedRgb:[255,128,0] : s.rgb;
      rgb.forEach((c,k) => u16(pal+(index(s)+k*n)*2,c*257));
    });
    if (bad) [1,2,3].forEach((v,k) => u16(pal+(index(fx.samples[2])+k*n)*2,v*257));
    for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
      const s=fx.samples[Math.floor(x/8)], v=raw ? s.expectedMmh===null?255:s.name==='dry'?0:100 : index(s);
      if(raw)d.setUint8(pixels+y*w+x,v);else u16(pixels+(y*w+x)*2,v);
    }
    return buf;
  };
  const center = i => [-1 + (i*8+4.5)*2/w, -0.125];
  const colour = v => [Math.min(255,Math.round(v*20)),40,80];
  window.fetch = (input, init) => {
    const url = String(input?.url || input);
    if (!url.startsWith('https://openwms.fmi.fi/')) return real(input, init);
    const q = new URL(url).searchParams, layer = q.get('layers'); calls.push(layer);
    if(q.get('format')!=='image/geotiff') errs.push('radar requested styled view tiles instead of a download');
    if(layer==='Radar:radar_finland_cappi_rate') {
      const sld=q.get('SLD_BODY') || '';
      if(!sld.includes('extended="true"') || !sld.includes('quantity="1000"') || q.get('bgcolor')!=='0xffffff') errs.push('replacement has no fixed encoding/background');
      if(mode==='limited')return Promise.resolve(new Response('limited',{status:429,headers:{'Retry-After':'60'}}));
      if(mode==='404' || mode==='both404' || mode==='fallbackraw')return Promise.resolve(new Response('missing',{status:404}));
      const bytes=tiff(mode==='raw',mode==='bad');
      return Promise.resolve(new Response(mode==='truncated' ? bytes.slice(0,-2) : bytes));
    }
    if(layer!=='Radar:radar_finland_cappi_dbzh') errs.push(`unexpected radar source ${layer}`);
    if(!(q.get('SLD_BODY')||'').includes('quantity="95"'))errs.push('reflectivity has no fixed physical encoding');
    // The live service leaves its no-data sentinel unscaled. Without a white
    // entry at that value, the SLD clamps it to the highest reflectivity colour.
    const entries=new DOMParser().parseFromString(q.get('SLD_BODY')||'','text/xml').getElementsByTagName('ColorMapEntry');
    const missingWhite=[...entries].some(e=>+e.getAttribute('quantity')===fx.reflectivityReference.noDataValue && e.getAttribute('color')==='#ffffff');
    return Promise.resolve(mode==='both404' ? new Response('missing',{status:404}) : new Response(tiff(mode==='fallbackraw',false,true,missingWhite)));
  };
  try {
    const before=net.usage().find(s=>s.id==='fmi').session;
    for(const variant of ['little endian','big endian, reordered palette']) {
      le=variant==='little endian'; remap=!le;
      const from=calls.length, image=await fmiRadar(box,w,h,colour);
      if(calls.length!==from+1 || calls[from]!=='Radar:radar_finland_cappi_rate') errs.push(`${variant}: did not use the replacement alone`);
      for(let i=0;i<fx.samples.length;i++) {
        const s=fx.samples[i], got=image.rateAt(...center(i));
        if(s.expectedMmh===null ? got!==null : got===null || Math.abs(got-s.expectedMmh)>.001) errs.push(`${variant} ${s.name}: ${got} mm/h (expected ${s.expectedMmh})`);
      }
      if(image.rateAt(2,0)!==null) errs.push(`${variant}: outside the image is dry`);
      const img=new Image();img.src=image.url;await img.decode();
      const cv=document.createElement('canvas');cv.width=w;cv.height=h;const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
      const px=ctx.getImageData(0,0,w,h).data;
      for(let i=0;i<fx.samples.length;i++) {
        const s=fx.samples[i], at=(4*w+i*8+4)*4, alpha=px[at+3];
        if(s.expectedMmh>0 ? alpha<100 : alpha!==0) errs.push(`${variant} ${s.name}: wrong rendered rain alpha ${alpha}`);
      }
      // The extreme's index is below the heavy anchor: colour saturation must
      // not copy the preceding palette slot, which may be unused or no-data.
      const a=(4*w+5*8+4)*4,b=(4*w+6*8+4)*4;
      if(px[a]!==px[b] || px[a+3]!==px[b+3]) errs.push(`${variant}: extreme rain colour depends on palette order`);
    }
    for(const failure of ['404','raw','bad','truncated']) {
      mode=failure; const from=calls.length, image=await fmiRadar(box,w,h,colour);
      if(calls.slice(from).join(',')!=='Radar:radar_finland_cappi_rate,Radar:radar_finland_cappi_dbzh') errs.push(`${failure}: no reflectivity fallback`);
      const rain=image.rateAt(...center(2));
      if(!(rain>.3 && rain<2) || image.rateAt(...center(0))!==0 || image.rateAt(...center(1))!==0 || image.rateAt(...center(4))!==null) errs.push(`${failure}: fallback units/dry/no-data are wrong`);
    }
    mode='both404';let rejected=false;
    try { await fmiRadar(box,w,h,colour); } catch { rejected=true; }
    if(!rejected) errs.push('both radar layers failed but returned a complete image');
    mode='fallbackraw';rejected=false;
    try { await fmiRadar(box,w,h,colour); } catch { rejected=true; }
    if(!rejected) errs.push('unstyled fallback bytes were interpreted as dBZ');
    mode='limited';const from=calls.length;rejected=false;
    try { await fmiRadar(box,w,h,colour); } catch { rejected=true; }
    if(!rejected || calls.length!==from+1 || net.sourceStatus('fmi')?.reason!=='limit') errs.push('FMI request limit was bypassed for the fallback');
    if(net.usage().find(s=>s.id==='fmi').session!==before+calls.length) errs.push('radar requests did not all go through request()');
  } finally { window.fetch=real; }
  return errs;
})()"""


def radar(chrome):
    pg = chrome.page(1440, 900, False)
    try:
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"'})
        fixture = json.load(open(os.path.join(os.path.dirname(__file__), 'fixtures', 'radar-rate.json')))
        pg.js('window.radarFixture=' + json.dumps(fixture))
        fails = pg.js(RADAR, timeout=90000)
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} FMI rain-rate replacement" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# White on the accent (#239): the contrast of each control that puts white on the
# green, measured from its computed colours, and no rule that puts white text on
# --accent itself (the light accent of dark mode is for text, icons and borders).
CONTRAST = """((scheme) => {
  const rgb = (s) => (s.match(/[\\d.]+/g) || []).slice(0, 4).map(Number);
  const lum = (c) => c.slice(0, 3).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const box = document.body.appendChild(Object.assign(document.createElement('div'), { style: 'position:fixed;left:-9999px;top:0' }));
  box.innerHTML = `<button class="fab-locate" aria-pressed="true"></button><button class="btn" aria-pressed="true">Night</button>
    <button class="qd-done">Done</button><span class="wp-sport"></span><button class="compass-btn heading"></button>
    <label class="tg"><input type="checkbox" checked><span class="tg-ui"></span></label><button class="qd-base" aria-checked="true"></button>`;
  const q = (s) => document.querySelector(s), cs = (e, p) => getComputedStyle(e, p || null);
  // [what, the element with the background, its pseudo-element, the colour on it, the least contrast]
  const items = [
    ['the sport pill', q('#activity-bar .act-current'), null, (e) => cs(e).color, 4.5],
    ['pressed Settings', q('#btn-settings'), null, (e) => cs(e).color, 3],
    ['pressed Weather', q('#btn-time'), null, (e) => cs(e.querySelector('.fab-time-label')).color, 4.5],
    ['Make 3 loops', q('.rt-make'), null, (e) => cs(e).color, 4.5],
    ['Locate on', box.querySelector('.fab-locate'), null, (e) => cs(e).color, 3],
    ['a pressed button', box.querySelector('.btn'), null, (e) => cs(e).color, 4.5],
    ['the drawer’s Done', box.querySelector('.qd-done'), null, (e) => cs(e).color, 4.5],
    ['a leg’s sport on the map', box.querySelector('.wp-sport'), null, (e) => cs(e).color, 3],
    ['the compass facing ahead', box.querySelector('.compass-btn'), null, (e) => cs(e).color, 3],
    ['a switch that is on', box.querySelector('.tg-ui'), null, (e) => cs(e, '::after').backgroundColor, 3],
    ['the drawer’s tick', box.querySelector('.qd-base'), '::after', () => 'rgb(255, 255, 255)', 3],
  ];
  const out = [];
  for (const [what, e, pseudo, fg, min] of items) {
    if (!e) { out.push(`${what}: not found`); continue; }
    const bg = rgb(cs(e, pseudo).backgroundColor), f = rgb(fg(e));
    if (bg.length === 4 && bg[3] < 1) { out.push(`${what}: a see-through background (${cs(e, pseudo).backgroundColor})`); continue; }
    const r = ratio(f, bg);
    if (r < min) out.push(`${what}: ${r.toFixed(2)}:1, under ${min}:1 (rgb(${f.slice(0, 3)}) on rgb(${bg.slice(0, 3)}))`);
    // light mode keeps its accent: white on #1f6f4a
    if (scheme === 'light' && bg.slice(0, 3).join() !== '31,111,74') out.push(`${what}: light background rgb(${bg.slice(0, 3)}), not the light accent rgb(31,111,74)`);
  }
  box.remove();
  // every rule, :hover too: white text on --accent itself
  const white = /^(#fff|#ffffff|white|rgb\\(255, 255, 255\\))$/i, walk = (rules) => {
    for (const r of rules) {
      if (r.cssRules) walk(r.cssRules);
      if (!r.style) continue;
      const bg = r.style.getPropertyValue('background-color') || r.style.getPropertyValue('background');
      if (/var\\(--accent\\)/.test(bg) && white.test(r.style.getPropertyValue('color').trim())) out.push(`white text on --accent: ${r.selectorText}`);
    }
  };
  for (const s of document.styleSheets) { try { walk(s.cssRules); } catch (e) { /* another origin's sheet */ } }
  return out;
})"""


def contrast(chrome):
    fails = []
    for scheme in ('dark', 'light'):
        pg = chrome.page(1440, 900, False)
        try:
            pg.c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-color-scheme', 'value': scheme}, {'name': 'prefers-reduced-motion', 'value': 'reduce'}]}, pg.s)
            pg.open_app({'activity': 'mtb'})

            def click(sel):
                x, y = pg.js(f"(() => {{ const r = document.querySelector({json.dumps(sel)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }})()")
                for kind in ('mouseMoved', 'mousePressed', 'mouseReleased'):
                    pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': x, 'y': y, 'button': 'left', 'buttons': 1 if kind == 'mousePressed' else 0, 'clickCount': 1}, pg.s)
                time.sleep(0.4)

            # Weather and Settings pressed as a person presses them (Settings' panel covers Weather); the round trip's Make 3 loops
            click('#btn-time')
            click('#btn-settings')
            pg.js("(() => { polku.planner.openLoop(polku.map.getCenter().toArray()); return true; })()")
            time.sleep(0.4)
            pressed = pg.js("['#btn-settings', '#btn-time'].filter((s) => document.querySelector(s).getAttribute('aria-pressed') !== 'true')")
            fails += [f'{scheme}: {s} not pressed by a click' for s in pressed]
            fails += [f'{scheme}: {f}' for f in pg.js(CONTRAST + f"({json.dumps(scheme)})")]
            fails += [f'{scheme} console: {e[:160]}' for e in pg.errors()]
        finally:
            pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} white on the accent, dark and light" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# The design system's values (#382, docs/plans/design-system.md). DESIGN.md's colours are css/app.css's
# (idea E), the JavaScript draws with the CSS's colours, and the text in a set of scenes is readable (idea D).

def scheme(pg, value):
    """Light or dark, as the phone's or computer's own setting turns it (reduced motion stays on)."""
    pg.c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-color-scheme', 'value': value}, {'name': 'prefers-reduced-motion', 'value': 'reduce'}]}, pg.s)


# Each name's value on :root and each given value, both as the browser reads a colour, so that #fff and rgb(255, 255, 255) agree
CSS_COLOURS = """((pairs) => {
  const probe = document.createElement('i'), css = getComputedStyle(document.documentElement);
  document.body.append(probe);
  const read = (v) => { probe.style.color = ''; probe.style.color = v; return probe.style.color ? getComputedStyle(probe).color : `${v || 'nothing'} (not a colour)`; };
  const out = pairs.map(([name, value]) => [name, read(css.getPropertyValue(name).trim()), read(value)]);
  probe.remove();
  return out;
})"""


def design_colours(chrome):
    """Every colour in DESIGN.md's frontmatter is its value in css/app.css: `x` is `--x`, and `dark-x` is `--x` in dark
    mode, under both of the CSS's dark rules (the setting's and `data-theme`); a colour with no `dark-` one is the
    same in both themes."""
    import re
    md = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'DESIGN.md')).read()
    block = re.search(r'^colors:\n((?:  .+\n)+)', md, re.M)
    colours = dict(re.findall(r'^  ([a-z0-9-]+): "([^"]+)"$', block.group(1), re.M)) if block else {}
    fails = [] if colours else ["no colours found in DESIGN.md's frontmatter"]
    light = {k: v for k, v in colours.items() if not k.startswith('dark-')}
    dark = {k: colours.get('dark-' + k, v) for k, v in light.items()}
    fails += [f'DESIGN.md has {k} but no {k[5:]}' for k in colours if k.startswith('dark-') and k[5:] not in light]
    pg = chrome.page(1440, 900, False)
    try:
        pg.open_app({'activity': 'mtb'})
        read = lambda want: pg.js(CSS_COLOURS + f"({json.dumps([['--' + k, v] for k, v in want.items()])})")
        for label, want, setup in [('light', light, None), ('dark', dark, 'media'), ('dark (data-theme)', dark, 'attr')]:
            if setup == 'media':
                scheme(pg, 'dark')
            if setup == 'attr':
                scheme(pg, 'light')
                pg.js("document.documentElement.dataset.theme = 'dark'; true")
            fails += [f'{label}: {name} is {css} in css/app.css, {md_} in DESIGN.md' for name, css, md_ in read(want) if css != md_]
        pg.js("delete document.documentElement.dataset.theme; true")
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} DESIGN.md's {len(colours)} colours are css/app.css's, in both themes" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# What the map draws with: the route line's colours, its glow's, the trails' difficulty, and the colours of the
# route coloured by its gradient on the map (Colour by), with the difficulty scale itself
PALETTE_SEEN = """(async (dark) => {
  const map = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms)), frame = () => new Promise((r) => requestAnimationFrame(r));
  // the theme as asked, and two frames on, so its change has been told (that comes before a frame's callbacks)
  for (let k = 0; k < 50 && matchMedia('(prefers-color-scheme: dark)').matches !== dark; k++) await wait(100);
  await frame(); await frame();
  for (let k = 0; k < 50 && !map.isStyleLoaded(); k++) await wait(100);
  const paint = (id) => JSON.stringify(map.getLayer(id) ? map.getPaintProperty(id, 'line-color') : null);
  const C = await import(location.origin + '/js/config.js');
  const colored = [...new Set((await map.getSource('routeColor').getData()).features.map((f) => f.properties.color))];
  return { route: paint('route-line'), glow: paint('route-glow'), trails: JSON.stringify(map.getStyle().layers.map((l) => l.paint || {})),
    colored: colored.join(' '), diff: C.DIFF_COLORS.join(' ') };
})"""
GRADES = ['--grade-20', '--grade-15', '--grade-10', '--grade-6', '--grade-3', '--grade-flat', '--grade-down', '--grade-steep-down']


def palette_css(chrome):
    """The route's colours and the colour scales come from css/app.css (js/palette.js), and come again when the
    theme changes: with other values on :root, dark mode comes on as a phone's does at dusk, and the route on the
    map, its glow, the trails' difficulty and the route coloured by its gradient on the map take them. Nothing is
    missing from the CSS (a name that isn't there is a console error)."""
    fails = []
    pg = chrome.page(1440, 900, False)
    try:
        pg.open_app({'activity': 'mtb'})
        pg.js("""(async () => { const p = polku.planner; p.setActive(true); p.clear(); p.setMode('line');
          for (const q of [[23.80, 61.509], [23.817, 61.519], [23.838, 61.516]]) p.addPoint(q);
          await p.analysing; p.colorOnMap = true; p.showMode('grade'); return true; })()""")
        grades = pg.js(f"(() => {{ const css = getComputedStyle(document.documentElement); return {json.dumps(GRADES)}.map((n) => css.getPropertyValue(n).trim()); }})()")
        before = pg.js(PALETTE_SEEN + '(false)')
        for want, where in [('#e11d48', 'route'), ('#be123c', 'route'), ('#0369a1', 'glow'), ('#22a447', 'trails'), ('#22a447', 'diff')]:
            if want not in before[where]:
                fails.append(f'light: {want} not in the {where} ({before[where][:120]})')
        if not before['colored'] or set(before['colored'].split()) - set(grades) - {'#d6dde3'}:
            fails.append(f"light: the route coloured by its gradient in {before['colored'] or 'nothing'}, not the gradient's {' '.join(grades)}")
        pg.js(f"""(() => {{ const s = document.documentElement.style;
          s.setProperty('--route', '#123456'); s.setProperty('--route-line', '#234567'); s.setProperty('--route-water', '#345678');
          s.setProperty('--diff-s0', '#456789'); s.setProperty('--diff-s1', '#56789a');
          for (const n of {json.dumps(GRADES)}) s.setProperty(n, '#6789ab'); return true; }})()""")
        scheme(pg, 'dark')
        after = pg.js(PALETTE_SEEN + '(true)')
        for want, where in [('#123456', 'route'), ('#234567', 'route'), ('#345678', 'glow'), ('#456789', 'trails'), ('#456789 #56789a', 'diff')]:
            if want not in after[where]:
                fails.append(f'dark, with other values on :root: {want} not in the {where} ({after[where][:120]})')
        if set(after['colored'].split()) - {'#6789ab', '#d6dde3'}:
            fails.append(f"dark, with other values on :root: the route coloured by its gradient kept {after['colored']}")
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the route's colours and the scales come from the CSS, and again when the theme changes" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Idea D: every text in these scenes of tools/shoot.py, against the solid colour behind it, at 4.5:1 (3:1 for large text),
# in light and then in dark, measured by tools/census.py. Text over the map itself isn't measured (census.py says why).
CONTRAST_SCENES = ['desk-sport-start', 'desk-planner', 'desk-tab-check', 'desk-point-card', 'desk-acts', 'desk-settings', 'desk-quick',
         'phone-planner', 'phone-tab-check', 'phone-point-card', 'phone-quick']
# What still fails, by the issue that fixes it. The sweep fails on anything else, and on an entry here that passes now,
# so the list only ever shrinks: (theme, the element and its parent as census.py names them, the start of its text or
# None for any text)
CONTRAST_KNOWN = {}  # (#376's, the last ones, went with the controls PR)

# CSS transitions finished (a theme change fades some colours), seen on two frames in a row
STILL = """new Promise((done) => {
  let calm = 0;
  const frame = () => {
    calm = document.getAnimations().some((a) => a instanceof CSSTransition && a.playState === 'running') ? 0 : calm + 1;
    if (calm >= 2) done(true); else requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})"""


def contrast_sweep(chrome):
    import census
    import shoot
    found, fails = {}, []
    for name in CONTRAST_SCENES:
        pg = shoot.scene(chrome, name)
        try:
            for theme in ('light', 'dark'):
                if theme == 'dark':
                    scheme(pg, 'dark')
                    pg.js(STILL)
                for t in pg.js(census.CENSUS)['text']:
                    need = 3 if t['large'] else 4.5
                    if t['cr'] is not None and t['cr'] < need:
                        key = (theme, ' > '.join(t['el'].split(' > ')[-2:]), t['t'][:24])
                        found.setdefault(key, (t['cr'], need, set()))[2].add(name)
            fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        finally:
            pg.close()
    known = {k: why for why, keys in CONTRAST_KNOWN.items() for k in keys}
    match = lambda f, k: f[:2] == k[:2] and k[2] in (None, f[2])
    for f, (cr, need, where) in sorted(found.items()):
        if not any(match(f, k) for k in known):
            fails.append(f'{f[0]}: {f[1]} "{f[2]}" is {cr}:1, under {need}:1 ({", ".join(sorted(where))})')
    fails += [f'{k[0]}: {k[1]} "{k[2] or "…"}" passes now: take it off CONTRAST_KNOWN ({why})' for k, why in known.items() if not any(match(f, k) for f in found)]
    told = sorted({why for k, why in known.items() if any(match(f, k) for f in found)})
    print(f"{'ok  ' if not fails else 'FAIL'} text at 4.5:1 in {len(CONTRAST_SCENES)} scenes, light and dark" + (f" (known: {', '.join(told)})" if told else '')
          + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# A panel over the planner on a phone (#240): where it is, and whether anything lies over its heading and ✕
PANEL_BOX = """((id) => {
  const p = document.querySelector(id), r = p.getBoundingClientRect(), body = p.querySelector('.panel-body'), b = body.getBoundingClientRect();
  const x = p.querySelector('.panel-close'), xr = x.getBoundingClientRect(), hr = p.querySelector('.panel-head h2').getBoundingClientRect();
  const at = (q) => document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
  return { open: !p.hidden, top: r.top, bottom: r.bottom, bar: document.querySelector('.topbar').getBoundingClientRect().bottom,
    x: [xr.left + xr.width / 2, xr.top + xr.height / 2], xin: xr.top >= 0 && xr.bottom <= innerHeight && xr.left >= 0 && xr.right <= innerWidth,
    xfree: x.contains(at(xr)), hfree: p.contains(at(hr)), more: body.scrollHeight - body.clientHeight,
    body: [b.left + b.width / 2, Math.max(b.top, 0), Math.min(b.bottom, innerHeight)] };
})"""


# Settings and all layers over the planner on a phone (#240), opened by touch with the sheet at every size:
# the panel's top below the top bar, its heading and ✕ on screen with nothing over them, its body scrolling
# under a finger, the ✕ closing it, and the sheet as it was. A short phone and a turned one too.
# Holds MapLibre's load event until __col.release(), and notes where Locate and 3D are after every frame
# from the page's start: read once the frame is painted, so what a finger would have seen.
COLUMN_HOLD = r"""(() => {
  const S = window.__col = { samples: [], released: false, held: null };
  let lib;
  Object.defineProperty(window, 'maplibregl', { configurable: true, get: () => lib, set(v) {
    lib = v;
    const fire = v.Map.prototype.fire;
    v.Map.prototype.fire = function (e, ...rest) {
      if ((typeof e === 'string' ? e : e && e.type) === 'load' && !S.released) { S.held = () => fire.call(this, e, ...rest); return this; }
      return fire.call(this, e, ...rest);
    };
  } });
  S.release = () => { S.released = true; if (S.held) S.held(); return !!S.held; };
  const top = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height && getComputedStyle(el).visibility !== 'hidden' ? Math.round(r.top) : null;
  };
  const after = new MessageChannel();
  after.port1.onmessage = () => {
    const locate = top('btn-locate'), d3 = top('btn-3d');
    if (locate != null || d3 != null) S.samples.push({ t: Math.round(performance.now()), locate, d3, app: !!window.polku, loaded: S.released });
  };
  const frame = () => { after.port2.postMessage(0); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
})();"""


def column_early(chrome):
    """#292: on a phone with the timeline left on, the map's column is in its place from the first frame it shows,
    not moved up once the map has loaded."""
    fails = []
    # the temperature layer adds the timeline's legend row
    for sport, wx in (('mtb', {}), ('paddle', {}), ('paddle', {'temp': True})):
        name = f"390x844 {sport}, the timeline on{', the temperature too' if wx else ''}"
        pg = chrome.page(390, 844, True)
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': EMPTY_DEPTHS}, pg.s)
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': COLUMN_HOLD}, pg.s)
        pg.open_app({'activity': sport, 'timeline': True, **({'weather': {'wind': False, 'rain': False, **wx}} if wx else {})},
                    {'polku:winter': '"off"', 'polku:seen3dHint2': 'true'})
        # open_app() returns once the map has loaded, which can be well before MapLibre fires its load event
        if not pg.js("new Promise((ok) => { const t0 = Date.now(), go = () => __col.held || Date.now() - t0 > 45000 ? ok(!!__col.held)"
                     " : setTimeout(go, 100); go(); })"):
            fails.append(f'{name}: MapLibre’s load event didn’t come in 45 s (the check proves nothing)')
        pg.js('__col.release()')
        pg.js("new Promise((ok) => { const t0 = Date.now(), go = () => !document.querySelector('#wx-bar').hidden || Date.now() - t0 > 20000 ? ok() : setTimeout(go, 100); go(); })")
        pg.js(SETTLED)
        pg.js('new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => ok(true)))))')
        s = pg.js('__col.samples')
        held = [x for x in s if not x['loaded']]
        if not held:
            fails.append(f'{name}: no frame with the buttons before the map’s load event')
        elif pg.js("document.querySelector('#wx-bar').hidden"):
            fails.append(f'{name}: the timeline is not open after the map’s load event')
        else:
            first, last = held[0], s[-1]
            for k, label in (('locate', 'Locate'), ('d3', '3D')):
                moves = sorted({x[k] for x in s if x[k] is not None})
                # exact: the timeline keeps its height when its forecast comes in (#301)
                if first[k] is None or last[k] is None or moves[-1] - moves[0] > 0:
                    fails.append(f"{name}: {label}'s top went from y {first[k]} (at {first['t']} ms) to y {last[k]} after the map's load"
                                 f" (tops seen: {', '.join(map(str, moves[:6]))})")
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the map's column on phones in its place before the map has loaded (#292)" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# #301: on a phone with the timeline open, its height and the map's buttons above it stay put when its forecast comes
# in (held, then released: WX_FIXED), with three lines in its reading and, with the snow layer, four. The forecasts
# kept on the device are forgotten first (TL_FORGET), so the timeline really waits for it.
TL_FORGET = """new Promise((ok) => { const r = indexedDB.open('polku'); r.onerror = () => ok(true); r.onsuccess = () => { const db = r.result;
  if (!db.objectStoreNames.contains('weather')) { db.close(); ok(true); return; }
  const t = db.transaction('weather', 'readwrite'); t.objectStore('weather').clear(); t.oncomplete = t.onerror = () => { db.close(); ok(true); }; }; })"""
TL_HELD = """new Promise((ok) => { const t0 = Date.now(), go = () => { const b = document.getElementById('wx-bar');
  (b && !b.hidden && __wx.held.length) || Date.now() - t0 > 20000 ? ok(!!__wx.held.length) : setTimeout(go, 100); }; go(); })"""
TL_SIZES = """(() => { const r = (id) => document.getElementById(id)?.getBoundingClientRect();
  return { bar: r('wx-bar').height, now: document.querySelector('#wx-bar .tl-now').getBoundingClientRect().height, locate: r('btn-locate').top,
    lines: document.querySelectorAll('#wx-bar .tl-now > div').length, text: document.querySelector('#wx-bar .tl-now').textContent.slice(0, 60) }; })()"""


def timeline_height(chrome):
    fails = []
    for snow in (False, True):
        name = f"390x844, the timeline{' and the snow layer' if snow else ''}"
        pg = chrome.page(390, 844, True)
        try:
            pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': EMPTY_DEPTHS + WX_FIXED + 'window.__wx.hold = true;'}, pg.s)
            pg.goto(BASE + 'sw.js')
            pg.js(TL_FORGET)
            pg.open_app({'activity': 'hike', 'timeline': True, 'weather': {'wind': True, 'rain': True, 'snow': snow}},
                        {'polku:winter': '"off"', 'polku:seen3dHint2': 'true'}, '#11/68.9/27.0')
            if not pg.js(TL_HELD):
                fails.append(f'{name}: the forecast wasn’t asked for, or came from a cache (the check proves nothing)')
                continue
            pg.js(SETTLED)
            a = pg.js(TL_SIZES)
            pg.js('__wx.release()')
            pg.js("new Promise((ok) => { const t0 = Date.now(), go = () => document.querySelector('#wx-bar .tl-now-main') || Date.now() - t0 > 20000 ? ok(true) : setTimeout(go, 100); go(); })")
            pg.js(SETTLED)
            pg.js('new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(true))))')
            b = pg.js(TL_SIZES)
            want = 4 if snow else 3
            if b['lines'] != want:
                fails.append(f"{name}: {b['lines']} lines in its reading once the forecast is in, not {want} ({b['text']})")
            for k, what in (('bar', 'the timeline'), ('now', 'its reading'), ('locate', "Locate's top")):
                if abs(a[k] - b[k]) > 0.25:
                    fails.append(f'{name}: {what} {a[k]:.1f} px while the forecast loaded, {b[k]:.1f} px once it was in')
            fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        finally:
            pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the timeline on phones keeps its height when its forecast comes in (#301)" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Before the page loads: Traficom's map tiles as sessionStorage's polku-test-depths says. Unset, they answer at once,
# empty. 'error' and 'drop': each is held until every other source's tiles are in, then fails with a server error
# (500) or as a dropped connection, so a failure is the map's last load (#393). Its other calls fail as if blocked.
# polku.map.__loads counts MapLibre's load events.
DEPTHS_FAIL_LAST = """(() => {
  const real = window.fetch.bind(window), mode = sessionStorage.getItem('polku-test-depths') || '';
  const traficom = (url) => /^https:\\/\\/[^/]*traficom\\.fi\\//.test(url);
  const othersIn = () => new Promise((ok) => {
    const t0 = Date.now(), go = () => {
      const m = window.polku && polku.map, st = m && m.style;
      const done = st && st._loaded && Object.entries(st.tileManagers).every(([id, tm]) => traficom(String((m.getSource(id) || {}).tiles || '')) || tm.loaded());
      if (done || Date.now() - t0 > 20000) setTimeout(ok, 300); else setTimeout(go, 50);
    };
    go();
  });
  window.__depthsFailed = 0;
  let empty = null;
  window.fetch = (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (!traficom(url)) return real(input, init);
    if (!/request=GetMap/i.test(url)) return Promise.reject(new TypeError('Failed to fetch'));
    if (mode) return othersIn().then(() => { window.__depthsFailed++; return mode === 'drop' ? Promise.reject(new TypeError('Failed to fetch')) : new Response('', { status: 500, statusText: 'Internal Server Error' }); });
    empty ||= (() => { const c = new OffscreenCanvas(256, 256); c.getContext('2d'); return c.convertToBlob({ type: 'image/png' }); })();
    return empty.then((png) => new Response(png, { headers: { 'Content-Type': 'image/png' } }));
  };
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.maplibregl) return;  // (open_app's first page)
    const fire = maplibregl.Map.prototype.fire;
    maplibregl.Map.prototype.fire = function (e) { if ((e && e.type || e) === 'load') this.__loads = (this.__loads || 0) + 1; return fire.apply(this, arguments); };
  });
})();"""


def tile_fails(chrome):
    """#393: Paddle with a saved route and the planner left open, Traficom's depth tiles failing last (a server error,
    a dropped connection). After a reload, Polku opens without the map being moved: the route and the planner are
    back, MapLibre's load event came once, and Depths says it has no data. A share link's route is drawn the same way."""
    fails = []
    # the load step's wait, shorter than LOAD_STEP's 45 s
    opened = ("new Promise((ok) => { const t0 = Date.now(), go = () => polku.map._loaded && polku.planner.points.length"
              " || Date.now() - t0 > 15000 ? setTimeout(() => ok(true), 300) : setTimeout(go, 100); go(); })")
    looks = """({ loads: polku.map.__loads || 0, failed: window.__depthsFailed, points: polku.planner.points.length,
      view: polku.planner.active && polku.planner.inView(), shared: /[?&]r=/.test(location.search) })"""
    for w, h_, phone in ((390, 844, True), (1440, 900, False)):
        pg = chrome.page(w, h_, phone)
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': DEPTHS_FAIL_LAST}, pg.s)
        # zoomed in enough for all three depth layers (soundings from 14)
        pg.open_app({'activity': 'paddle'}, {'polku:winter': '"off"', 'polku:plannerDock': '"left"'}, '#14.2/61.5155/23.8220')
        pg.js(f"({TB_ROUTE})({json.dumps(TB_PTS)})", timeout=60000)
        pg.js("polku.planner.setEditing(false); true")
        url = pg.js("polku.planner.shareUrl()")
        for mode, how in (('error', 'a server error'), ('drop', 'a dropped connection'), ('error', 'a share link, a server error')):
            name = f'{w}x{h_}, the depth tiles failing last with {how}'
            pg.js(f"sessionStorage.setItem('polku-test-depths', '{mode}'); true")
            if how.startswith('a share link'):
                pg.js("localStorage.removeItem('polku:route'); true")  # so the route comes from the link
                pg.goto(url)
            else:
                pg.c.send('Page.reload', {}, pg.s)
                pg.c.wait_event('Page.loadEventFired', pg.s, 60)
            pg.js("new Promise((ok) => { const go = () => window.polku ? ok() : setTimeout(go, 100); go(); })")
            pg.js(opened, timeout=30000)
            s = pg.js(looks)
            if not s['failed']:
                fails.append(f'{name}: no depth tile was asked for (the check proves nothing)')
            if s['loads'] != 1 or s['points'] != len(TB_PTS) or not s['view'] or s['shared']:
                fails.append(f"{name}: MapLibre's load event came {s['loads']} times; {s['points']} points, the route's view "
                             f"{'open' if s['view'] else 'not open'}{', the link still in the address' if s['shared'] else ''}")
            if mode == 'drop':
                # a failed source still says so: Depths in the quick drawer
                small = pg.js("""(async () => { document.querySelector('#btn-layers').click(); await new Promise((r) => setTimeout(r, 600));
                  const s = document.querySelector('#quick-layers .qt[data-id="depths"] .qt-l small');
                  const t = s ? `${s.textContent}${s.classList.contains('warn') ? ' (warn)' : ''}` : 'no Depths tile';
                  document.querySelector('#btn-layers').click(); return t; })()""")
                if not small.startswith('No data now') or '(warn)' not in small:
                    fails.append(f'{name}: Depths in the quick drawer says “{small}”')
        fails += [f'{w}x{h_} console: {e[:160]}' for e in pg.errors()]
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the map's last tiles failing: Polku still opens the saved route and a share link (#393)" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


def panels(chrome):
    fails = []
    for w, h_, sport in [(390, 844, 'mtb'), (390, 844, 'paddle'), (375, 667, 'mtb'), (360, 740, 'hike'), (667, 375, 'gravel')]:
        pg = chrome.page(w, h_, True)
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': EMPTY_DEPTHS}, pg.s)  # (a slow answer kept the map from loading: #286)
        pg.open_app({'activity': sport}, {'polku:winter': '"off"'})
        pg.js(PLAN_TWO)
        centre = lambda s: pg.js(f"(() => {{ const r = document.querySelector({json.dumps(s)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }})()")
        for st in ('peek', 'profile', 'half', 'full'):
            pg.js(f"polku.planner.setSheetState({json.dumps(st)}); true")
            pg.js(SETTLED)
            before = pg.js(SHEET_STATE)
            for pid, label in (('#settings-panel', 'Settings'), ('#layers-panel', 'all layers')):
                name = f'{w}x{h_} {sport}, the sheet at {st}: {label}'
                if pid == '#settings-panel':
                    pg.tap(*centre('#btn-settings'))
                else:
                    # Layers (a full sheet hides the map's buttons: L there), then More
                    if st == 'full':
                        pg.js("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' })), true")
                    else:
                        pg.tap(*centre('#btn-layers'))
                    time.sleep(0.4)
                    pg.js("document.querySelector('#quick-layers .qt-more').scrollIntoView({ block: 'nearest' }), true")  # below the fold on a turned phone
                    pg.tap(*centre('#quick-layers .qt-more'))
                time.sleep(0.4)
                r = pg.js(PANEL_BOX + f"({json.dumps(pid)})")
                if not r['open']:
                    fails.append(f'{name} did not open')
                    pg.js("document.querySelector('#quick-scrim').click(), true")
                    continue
                if r['top'] < r['bar'] - 0.5:
                    fails.append(f"{name}: its top at {r['top']:.0f} px, above the top bar’s bottom ({r['bar']:.0f} px)")
                if r['bottom'] > h_ + 0.5:
                    fails.append(f"{name}: its bottom at {r['bottom']:.0f} px, below the screen")
                if not r['xin']:
                    fails.append(f"{name}: its ✕ off the screen, at {r['x'][1]:.0f} px")
                elif not r['xfree']:
                    fails.append(f'{name}: something lies over its ✕')
                if not r['hfree']:
                    fails.append(f'{name}: its heading is off the screen or under something')
                x, top, bottom = r['body']
                if r['more'] > 1 and bottom - top > 100:
                    pg.swipe(x, bottom - 30, top + 30, ms=400, hold=0.1)
                    time.sleep(0.3)
                    if pg.js(f"document.querySelector('{pid} .panel-body').scrollTop") < 20:
                        fails.append(f'{name}: a finger up its body did not scroll it')
                elif r['more'] > 1:
                    fails.append(f'{name}: only {max(bottom - top, 0):.0f} px of its body on the screen')
                if r['xin'] and r['xfree']:
                    pg.tap(*r['x'])
                    time.sleep(0.4)
                    if pg.js(f"!document.querySelector('{pid}').hidden"):
                        fails.append(f'{name}: a tap on its ✕ did not close it')
                pg.js(f"document.querySelector('{pid}').hidden || document.querySelector('{pid} .panel-close').click(), true")
                time.sleep(0.2)
                pg.js(SETTLED)
                after = pg.js(SHEET_STATE)
                if after['open'] or after['all']:
                    fails.append(f'{name}: the layers still open after its ✕')
                if after['st'] != before['st'] or abs(after['h'] - before['h']) > 1:
                    fails.append(f"{name}: the planner {after['st']} {after['h']:.0f} px after it closed, not {before['st']} {before['h']:.0f} px")
        if (w, h_, sport) == (390, 844, 'mtb'):
            # Settings open above the sheet at half, then the sheet swiped up to full under it: Settings covers it
            pg.js("polku.planner.setSheetState('half'); true")
            pg.js(SETTLED)
            pg.tap(*centre('#btn-settings'))
            time.sleep(0.4)
            hd = centre('#planner .sheet-handle')
            pg.swipe(hd[0], hd[1], 100, ms=500, hold=0.2)
            pg.js(SETTLED)
            r = pg.js(PANEL_BOX + "('#settings-panel')")
            st = pg.js(SHEET_STATE)['st']
            if st != 'full' or not r['open'] or r['top'] < r['bar'] - 0.5 or not (r['xin'] and r['xfree']):
                fails.append(f"390x844: Settings open and the sheet swiped up: the sheet {st}, Settings {'open' if r['open'] else 'closed'}, its top at {r['top']:.0f} px, its ✕ {'free' if r['xin'] and r['xfree'] else 'covered or off the screen'}")
        fails += [f'{w}x{h_} console: {e[:160]}' for e in pg.errors()]
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} Settings and all layers over the planner on phones" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# #257: on a desktop with the planner at the bottom, Settings and all layers (L, then More) at its every size, by mouse
# and keys: the panel's top below the top bar, its heading and ✕ on the screen with nothing over them, its body
# scrolling under the wheel, its ✕ closing it, and the planner as it was. Raised too high to leave them room
# (under 320 px), they open over it.
def panels_desktop(chrome):
    fails = []
    for w, h_ in ((1440, 900), (1024, 768)):
        pg = chrome.page(w, h_, False)
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': EMPTY_DEPTHS}, pg.s)
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"', 'polku:plannerDock': '"bottom"'})
        pg.js(PLAN_TWO)
        mouse = lambda kind, x, y, **more: pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': x, 'y': y, **more}, pg.s)

        def click(x, y):
            for kind in ('mouseMoved', 'mousePressed', 'mouseReleased'):
                mouse(kind, x, y, button='none' if kind == 'mouseMoved' else 'left', buttons=1 if kind == 'mousePressed' else 0, clickCount=1)
                time.sleep(0.05)
            time.sleep(0.4)
        centre = lambda s: pg.js(f"(() => {{ const r = document.querySelector({json.dumps(s)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }})()")
        if pg.js("polku.planner.layout()") != 'sheet':
            fails.append(f'{w}x{h_}: the planner isn’t at the bottom (the check proves nothing)')
        for st in ('peek', 'profile', 'half', 'full'):
            pg.js(f"polku.planner.setSheetState({json.dumps(st)}); true")
            pg.js(SETTLED)
            before = pg.js(SHEET_STATE)
            for pid, label in (('#settings-panel', 'Settings'), ('#layers-panel', 'all layers')):
                name = f'{w}x{h_}, the planner at the bottom at {st}: {label}'
                if pid == '#settings-panel':
                    click(*centre('#btn-settings'))
                else:
                    # Layers in the map's column, or L where the planner hides it; More once the drawer is open
                    if pg.js("!!document.getElementById('btn-layers').offsetParent && getComputedStyle(document.getElementById('map-ctrls')).visibility !== 'hidden'"):
                        click(*centre('#btn-layers'))
                    else:
                        for event in ('rawKeyDown', 'char', 'keyUp'):
                            pg.c.send('Input.dispatchKeyEvent', {'type': event, 'key': 'l', 'code': 'KeyL', 'windowsVirtualKeyCode': 76, **({'text': 'l'} if event == 'char' else {})}, pg.s)
                    if not pg.js("new Promise((ok) => { const t0 = Date.now(), go = () => { const q = document.querySelector('#quick-layers .qt-more'); q && q.offsetParent && document.querySelector('#quick-layers').classList.contains('open') ? requestAnimationFrame(() => requestAnimationFrame(() => ok(true))) : Date.now() - t0 > 5000 ? ok(false) : setTimeout(go, 100); }; go(); })"):
                        fails.append(f'{name}: the layer drawer did not open')
                        continue
                    pg.js(SETTLED)
                    pg.js("document.querySelector('#quick-layers .qt-more').scrollIntoView({ block: 'nearest' }), true")  # (below the drawer's fold over a raised planner)
                    time.sleep(0.2)
                    click(*centre('#quick-layers .qt-more'))
                r = pg.js(PANEL_BOX + f"({json.dumps(pid)})")
                if not r['open']:
                    fails.append(f'{name} did not open')
                    continue
                if r['top'] < r['bar'] - 0.5:
                    fails.append(f"{name}: its top at {r['top']:.0f} px, above the top bar’s bottom ({r['bar']:.0f} px)")
                if r['bottom'] > h_ + 0.5 or r['bottom'] - r['top'] < 120:
                    fails.append(f"{name}: at y {r['top']:.0f}–{r['bottom']:.0f} px on a {h_} px screen")
                if not r['xin']:
                    fails.append(f"{name}: its ✕ off the screen, at {r['x'][1]:.0f} px")
                elif not r['xfree']:
                    fails.append(f'{name}: something lies over its ✕')
                if not r['hfree']:
                    fails.append(f'{name}: its heading is off the screen or under something')
                x, top, bottom = r['body']
                if r['more'] > 1 and bottom - top > 60:
                    mouse('mouseWheel', x, (top + bottom) / 2, deltaX=0, deltaY=400)
                    time.sleep(0.4)
                    if pg.js(f"document.querySelector('{pid} .panel-body').scrollTop") < 20:
                        fails.append(f'{name}: the wheel over its body did not scroll it')
                if r['xin'] and r['xfree']:
                    click(*r['x'])
                    if pg.js(f"!document.querySelector('{pid}').hidden"):
                        fails.append(f'{name}: a click on its ✕ did not close it')
                pg.js(f"document.querySelector('{pid}').hidden || document.querySelector('{pid} .panel-close').click(), true")
                time.sleep(0.2)
                pg.js(SETTLED)
                after = pg.js(SHEET_STATE)
                if after['st'] != before['st'] or abs(after['h'] - before['h']) > 1:
                    fails.append(f"{name}: the planner {after['st']} {after['h']:.0f} px after it closed, not {before['st']} {before['h']:.0f} px")
        if w == 1440:
            # Settings grows from ⚙ and a dialog from the middle, as Layers does from its button: at once from the keyboard,
            # opacity only with reduced motion (#540). What moves is read as it opens, not after frames that may come late
            opened = """((detail) => {
              const p = document.querySelector('#settings-panel');
              document.querySelector('#btn-settings').dispatchEvent(new MouseEvent('click', { bubbles: true, detail }));
              const moves = p.hidden ? 'not open' : p.getAnimations().map((a) => a.transitionProperty).sort().join(' ') || 'nothing';
              document.querySelector('#settings-panel .panel-close').click();
              return moves;
            })"""
            dialog = """(async () => {
              const M = await import(location.origin + '/js/modal.js');
              M.openModal({ title: 'A dialog' }, () => {});
              const d = document.querySelector('dialog.modal'), moves = d.getAnimations().map((a) => a.transitionProperty).sort().join(' ') || 'nothing';
              M.closeModal();
              return moves;
            })()"""
            for media, want in (('no-preference', 'opacity transform'), ('reduce', 'opacity')):
                pg.c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': media}]}, pg.s)
                got = pg.js(opened + '(1)')
                if got != want:
                    fails.append(f'{w}x{h_}, reduced motion {media}: Settings opened by a click moves {got}, not {want}')
                got = pg.js(dialog)
                if got != want:
                    fails.append(f'{w}x{h_}, reduced motion {media}: a dialog opens moving {got}, not {want}')
            # a key press is a click with no count (detail 0): Settings is there at once
            pg.c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'no-preference'}]}, pg.s)
            got = pg.js(opened + '(0)')
            if got != 'nothing':
                fails.append(f'{w}x{h_}: Settings opened by the keyboard moves {got}, not at once')
            pg.c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce'}]}, pg.s)
        fails += [f'{w}x{h_} console: {e[:160]}' for e in pg.errors()]
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} Settings and all layers over a desktop's bottom planner (#257)" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# The sport pill's menu (#245): a mouse that hovers then clicks, a second click, Escape, a click outside; touch; the keyboard
ACTS = """(() => { const b = document.querySelector('#activity-bar .act-current'), r = b.getBoundingClientRect();
  return { open: !document.querySelector('#activity-bar .act-menu').hidden, expanded: b.getAttribute('aria-expanded'),
    pill: [r.left + r.width / 2, r.top + r.height / 2], focus: document.activeElement === b, sport: polku.state.activity,
    hover: matchMedia('(hover: hover) and (pointer: fine)').matches }; })()"""
# The load step's snow check (FMI, else the forecast) draws the pill again when it answers, and that closes a menu
# open then and drops its focus (#392). A check of the menu waits for the answer first: 30 s at most.
SNOW_IN = "new Promise((ok) => { const t0 = Date.now(), go = () => polku.state.winterSnow || Date.now() - t0 > 30000 ? ok(true) : setTimeout(go, 100); go(); })"
# Before the page loads, for checks that need no snow: FMI's measured snow answers at once, none at a station by the
# map's middle (a busy FMI or forecast answered after SNOW_IN had given up)
NO_SNOW = """(() => {
  const real = window.fetch.bind(window);
  const xml = '<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:BsWfs="http://xml.fmi.fi/schema/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2">'
    + '<wfs:member><BsWfs:BsWfsElement><BsWfs:Location><gml:Point><gml:pos>61.5135 23.8170 </gml:pos></gml:Point></BsWfs:Location>'
    + '<BsWfs:Time>2026-10-22T09:00:00Z</BsWfs:Time><BsWfs:ParameterName>snow_aws</BsWfs:ParameterName><BsWfs:ParameterValue>-1.0</BsWfs:ParameterValue>'
    + '</BsWfs:BsWfsElement></wfs:member></wfs:FeatureCollection>';
  window.fetch = (input, init) => {
    const url = String(input && input.url ? input.url : input);
    return /^https:\\/\\/opendata\\.fmi\\.fi\\/wfs\\?.*parameters=snow_aws/.test(url) ? Promise.resolve(new Response(xml)) : real(input, init);
  };
})();"""
# Before the page loads, for a late snow answer (#392): FMI's measured snow is held until window.letSnow(cm), then
# answers with that much at a station by the map's middle. window.snowAsked counts the requests held.
HELD_SNOW = """(() => {
  const real = window.fetch.bind(window);
  const xml = (cm) => '<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:BsWfs="http://xml.fmi.fi/schema/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2">'
    + '<wfs:member><BsWfs:BsWfsElement><BsWfs:Location><gml:Point><gml:pos>61.5135 23.8170 </gml:pos></gml:Point></BsWfs:Location>'
    + `<BsWfs:Time>2026-10-22T09:00:00Z</BsWfs:Time><BsWfs:ParameterName>snow_aws</BsWfs:ParameterName><BsWfs:ParameterValue>${cm}</BsWfs:ParameterValue>`
    + '</BsWfs:BsWfsElement></wfs:member></wfs:FeatureCollection>';
  let answer;
  const held = new Promise((ok) => { answer = ok; });
  window.snowAsked = 0;
  window.letSnow = (cm) => { answer(cm); return true; };
  window.fetch = (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (!/^https:\\/\\/opendata\\.fmi\\.fi\\/wfs\\?.*parameters=snow_aws/.test(url)) return real(input, init);
    window.snowAsked++;
    return held.then((cm) => new Response(xml(cm)));
  };
})();"""
SNOW_ASKED = "new Promise((ok) => { const t0 = Date.now(), go = () => window.snowAsked ? ok(true) : Date.now() - t0 > 30000 ? ok(false) : setTimeout(go, 100); go(); })"
# the pill's menu just before and after the snow comes in: the element with the focus (the same one), the sport and
# the craft chosen, the pill's snow badge
MENU_WAS = "(() => { window.focusWas = document.activeElement; return [...document.querySelectorAll('#activity-bar [aria-selected=true], #activity-bar [aria-pressed=true]')].map((b) => b.dataset.k || b.dataset.craft).join(); })()"
MENU_NOW = """(() => { const what = (e) => (e === document.body ? 'the page' : String(e.dataset.k || e.className)); return {
  focus: document.activeElement === window.focusWas && window.focusWas.isConnected, was: what(window.focusWas), is: what(document.activeElement), snow: polku.state.winterSnow,
  chosen: [...document.querySelectorAll('#activity-bar [aria-selected=true], #activity-bar [aria-pressed=true]')].map((b) => b.dataset.k || b.dataset.craft).join(),
  badge: !!document.querySelector('#activity-bar .act-current .act-winter') }; })()"""


def sport_menu(chrome):
    fails = []

    def state(pg, name, want):
        a = pg.js(ACTS)
        if a['open'] != want or a['expanded'] != str(want).lower():
            fails.append(f"{name}: the menu {'open' if a['open'] else 'closed'} (aria-expanded {a['expanded']}), not {'open' if want else 'closed'}")
        return a

    def page(w, h_, phone, sport):
        pg = chrome.page(w, h_, phone)
        # the menu needs none of Traficom's depths, nor the snow
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': EMPTY_DEPTHS}, pg.s)
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': NO_SNOW}, pg.s)
        pg.open_app({'activity': sport, 'timeline': True}, {'polku:winter': '"off"'})
        pg.js(SNOW_IN)  # (a late answer closed the menu a tap had just opened, and every tap after it was one behind: #371)
        return pg

    def key(pg, k, code, vk, char=None):
        for event in ['rawKeyDown'] + (['char'] if char is not None else []) + ['keyUp']:
            fields = {'type': event, 'key': k, 'code': code, 'windowsVirtualKeyCode': vk}
            if char is not None and event == 'char':
                fields['text'] = char
            chrome.send('Input.dispatchKeyEvent', fields, pg.s)
        time.sleep(0.2)

    for sport in ('mtb', 'paddle'):
        pg = page(1440, 900, False, sport)
        pg.js(PLAN_TWO)
        a = pg.js(ACTS)
        if not a['hover']:
            fails.append(f'1440x900 {sport}: no hover pointer in this Chrome, so the mouse checks prove nothing')
        x, y = a['pill']
        map_ = (900, 600)

        def mouse(kind, at):
            pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': at[0], 'y': at[1], 'button': 'left' if kind != 'mouseMoved' else 'none',
                                                  'buttons': 1 if kind == 'mousePressed' else 0, 'clickCount': 1}, pg.s)

        def move(at, steps=6):
            for i in range(1, steps + 1):  # the way a mouse gets there, over the map first
                mouse('mouseMoved', (map_[0] + (at[0] - map_[0]) * i / steps, map_[1] + (at[1] - map_[1]) * i / steps))
                time.sleep(0.02)

        def click(at):
            mouse('mousePressed', at)
            time.sleep(0.08)
            mouse('mouseReleased', at)
            time.sleep(0.3)

        name = f'1440x900 {sport}'
        mouse('mouseMoved', map_)
        time.sleep(0.4)
        move((x, y))
        time.sleep(0.3)
        state(pg, f'{name}, the mouse over the pill', True)
        # no word "null" under Swim (#374), and Paddle's crafts under it
        m = pg.js("(() => { const m = document.querySelector('#activity-bar .act-menu'); return { text: m.textContent, crafts: m.querySelectorAll('.act-craft .act-chip').length }; })()")
        if 'null' in m['text']:
            fails.append(f'{name}: the menu says "null": …{m["text"][-60:]}')
        if m['crafts'] != (3 if sport == 'paddle' else 0):
            fails.append(f"{name}: the menu has {m['crafts']} crafts")
        click((x, y))
        state(pg, f'{name}, a click after the hover', True)
        click((x, y))
        state(pg, f'{name}, a second click', False)
        click((x, y))
        state(pg, f'{name}, a third click', True)
        key(pg, 'Escape', 'Escape', 27)
        a = state(pg, f'{name}, Escape', False)
        if not a['focus']:
            fails.append(f'{name}: Escape did not put the focus back on the pill')
        click((x, y))
        state(pg, f'{name}, a click after Escape', True)
        # a click outside, on the map
        mouse('mouseMoved', map_)
        click(map_)
        state(pg, f'{name}, a click on the map', False)
        # hover, click, then a sport from the menu
        move((x, y))
        time.sleep(0.3)
        click((x, y))
        other = 'hike' if sport == 'mtb' else 'swim'
        o = pg.js(f"(() => {{ const r = document.querySelector('#activity-bar .act[data-k={other}]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }})()")
        mouse('mouseMoved', o)
        time.sleep(0.1)
        click(o)
        # with a route in another sport the menu asks what the sport is for (B of #233): only the legs drawn next
        nx = pg.js("(() => { const b = document.querySelector('#activity-bar .act-next'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
        if not nx:
            fails.append(f'{name}: {other} with a route drawn asked nothing')
        else:
            mouse('mouseMoved', nx)
            time.sleep(0.1)
            click(nx)
        a = state(pg, f'{name}, {other} picked', False)
        if a['sport'] != other:
            fails.append(f"{name}: a click on {other} left the sport at {a['sport']}")
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        pg.close()

    # the keyboard, no mouse over the pill: Enter and Space open and close, arrows move, Escape closes and gives the focus back
    pg = page(1440, 900, False, 'mtb')
    pg.js("document.querySelector('#activity-bar .act-current').focus(), true")
    key(pg, 'Enter', 'Enter', 13, '\r')
    state(pg, '1440x900 keyboard, Enter', True)
    key(pg, 'Enter', 'Enter', 13, '\r')
    state(pg, '1440x900 keyboard, Enter again', False)
    key(pg, ' ', 'Space', 32)
    state(pg, '1440x900 keyboard, Space', True)
    key(pg, 'ArrowDown', 'ArrowDown', 40)
    if not pg.js("document.activeElement === document.querySelector('#activity-bar .act')"):
        fails.append('1440x900 keyboard: ArrowDown did not move to the first sport')
    key(pg, 'Escape', 'Escape', 27)
    if not state(pg, '1440x900 keyboard, Escape', False)['focus']:
        fails.append('1440x900 keyboard: Escape did not put the focus back on the pill')
    fails += [f'1440x900 keyboard console: {e[:160]}' for e in pg.errors()]
    pg.close()

    # touch, no hover: a tap opens, a second tap closes, a tap outside closes, a tap on a sport picks it
    pg = page(390, 844, True, 'paddle')
    pg.js(PLAN_TWO)
    x, y = pg.js(ACTS)['pill']
    # on a phone the menu is as wide as the screen: the map is below it
    below = lambda: pg.js("(() => { const r = document.querySelector('#activity-bar .act-menu').getBoundingClientRect(); return [200, r.bottom + 40]; })()")
    for what, at, want in (('a tap', (x, y), True), ('a second tap', (x, y), False), ('a third tap', (x, y), True), ('a tap on the map', None, False), ('a tap after it', (x, y), True)):
        pg.tap(*(at or below()))
        time.sleep(0.3)
        state(pg, f'390x844 paddle, {what}', want)
    o = pg.js("(() => { const r = document.querySelector('#activity-bar .act[data-k=mtb]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
    pg.tap(*o)
    time.sleep(0.3)
    # the route is Paddle: the menu asks, and MTB is for the legs drawn next (B of #233)
    nx = pg.js("(() => { const b = document.querySelector('#activity-bar .act-next'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
    if not nx:
        fails.append('390x844: MTB with a Paddle route asked nothing')
    else:
        pg.tap(*nx)
        time.sleep(0.3)
    if state(pg, '390x844 paddle, MTB tapped', False)['sport'] != 'mtb':
        fails.append('390x844: a tap on MTB did not pick it')
    fails += [f'390x844 console: {e[:160]}' for e in pg.errors()]
    pg.close()

    # a late snow answer (#392): it closed a menu opened by a click, the keyboard or a tap, and dropped the focus.
    # The answer is held until the menu is open. Winter on Auto: 25 cm turns it on, and the pill gets its snow.
    def late(w, h_, phone, sport, winter, name):
        pg = chrome.page(w, h_, phone)
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': EMPTY_DEPTHS}, pg.s)
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': HELD_SNOW}, pg.s)
        pg.open_app({'activity': sport, 'timeline': True}, {'polku:winter': json.dumps(winter)})
        if not pg.js(SNOW_ASKED):
            fails.append(f'{name}: the snow was never asked for, so the check proves nothing')
        return pg

    def snow_in(pg, name, badge):
        was = pg.js(MENU_WAS)
        pg.js('letSnow(25)')
        pg.js(SNOW_IN)
        time.sleep(0.3)
        a = state(pg, f'{name}, then the snow came in', True)
        m = pg.js(MENU_NOW)
        if not m['snow'] or m['snow']['cm'] != 25:
            fails.append(f"{name}: the held snow never came in ({m['snow']}), so the check proves nothing")
        if not m['focus']:
            fails.append(f"{name}: the snow moved the focus from {m['was']} to {m['is']}")
        if m['chosen'] != was:
            fails.append(f"{name}: the snow changed what's chosen in the menu from {was} to {m['chosen']}")
        if m['badge'] != badge:
            fails.append(f"{name}: the pill {'has no' if badge else 'has a'} snow badge")
        return a['open']

    # the mouse (the loop's mouse(), move() and click(), on this page): over the pill, a click, the snow, then Hike
    name = '1440x900 a late snow answer, the mouse'
    pg = late(1440, 900, False, 'mtb', 'auto', name)
    x, y = pg.js(ACTS)['pill']
    mouse('mouseMoved', map_)
    time.sleep(0.4)
    move((x, y))
    time.sleep(0.3)
    click((x, y))
    if state(pg, name, True)['open'] and snow_in(pg, name, True):
        o = pg.js("(() => { const r = document.querySelector('#activity-bar .act[data-k=hike]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
        mouse('mouseMoved', o)
        time.sleep(0.1)
        click(o)
        if state(pg, f'{name}, Hike clicked', False)['sport'] != 'hike':
            fails.append(f'{name}: a click on Hike did not pick it')
    fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    pg.close()

    # the keyboard, Winter off: Enter, the arrows to Gravel, the snow, then Enter on Gravel
    name = '1440x900 a late snow answer, the keyboard'
    pg = late(1440, 900, False, 'mtb', 'off', name)
    pg.js("document.querySelector('#activity-bar .act-current').focus(), true")
    key(pg, 'Enter', 'Enter', 13, '\r')
    key(pg, 'ArrowDown', 'ArrowDown', 40)
    key(pg, 'ArrowDown', 'ArrowDown', 40)
    if pg.js("document.activeElement.dataset.k") != 'gravel':
        fails.append(f'{name}: the arrows did not move to Gravel')
    elif snow_in(pg, name, False):
        key(pg, 'Enter', 'Enter', 13, '\r')
        if state(pg, f'{name}, Enter on Gravel', False)['sport'] != 'gravel':
            fails.append(f'{name}: Enter on Gravel did not pick it')
    fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    pg.close()

    # touch, Paddle: a tap, the snow, then a tap on Canoe (the menu stays open at the craft)
    name = '390x844 a late snow answer, a tap'
    pg = late(390, 844, True, 'paddle', 'auto', name)
    pg.tap(*pg.js(ACTS)['pill'])
    time.sleep(0.3)
    if state(pg, name, True)['open'] and snow_in(pg, name, True):
        c = pg.js("(() => { const r = document.querySelector('#activity-bar .act-chip[data-craft=canoe]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
        pg.tap(*c)
        time.sleep(0.3)
        state(pg, f'{name}, Canoe tapped', True)
        if pg.js("document.querySelector('#activity-bar .act-chip[data-craft=canoe]').getAttribute('aria-pressed')") != 'true':
            fails.append(f'{name}: a tap on Canoe did not pick it')
    fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the sport pill's menu: mouse, keyboard and touch" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# B of the calmer planner (#233): the next leg's sport and speed in the drawing menu (phones) and on the toolbar
# (desktops), the drawing button naming it, Draw it and Go › Time, a point put on open water (not on a bridge or
# by the shore; the ice in winter), and Settings' speeds by sport (#87). Straight legs: no routing calls.
NL = """(() => {
  const T = window.nlT = { errs: [] };
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)], p = polku.planner, m = polku.map;
  // a control's middle once the sheet has come to its size and the toolbox is placed for it (a frame later): on a busy
  // page the sheet was still on its way up, or the toolbox still moving, when a fixed wait read it (#406)
  const settled = () => """ + SETTLED + """.then(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
  T.at = async (sel) => { await settled(); const el = typeof sel === 'string' ? $(sel) : typeof sel === 'function' ? sel() : sel; if (!el || !el.offsetParent) return null;
    // (in a menu that scrolls inside the room it has, scrolled to, as a person scrolls it; never the page)
    for (let n = el.parentElement, box = el.closest('.menu-pop'); box && n && box.contains(n); n = n.parentElement) {
      if (n.scrollHeight <= n.clientHeight + 1) continue;
      const r = el.getBoundingClientRect(), s = n.getBoundingClientRect();
      if (r.bottom > s.bottom) n.scrollTop += r.bottom - s.bottom + 8; else if (r.top < s.top) n.scrollTop -= s.top - r.top + 8;
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      break;
    }
    const b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, top = document.elementFromPoint(x, y);
    const menu = el.closest('.menu-pop')?.getBoundingClientRect();
    return { x, y, clear: !!top && (el === top || el.contains(top)), over: `${top ? String(top.id || top.className) : 'nothing'} at ${Math.round(y)}${menu ? `, the menu ${Math.round(menu.top)}–${Math.round(menu.bottom)}` : ''}` }; };
  T.item = (label) => T.at(() => $$('.menu-pop .menu-item').find((x) => x.textContent.trim().startsWith(label)));
  T.toastBtn = (label) => T.at(() => $$('#toast .toast-act').find((x) => x.textContent.trim() === label));
  T.water = (ll) => m.queryRenderedFeatures(m.project(ll), { layers: ['water'] }).length > 0;
  T.spot = (ll) => { const q = m.project(ll); return { x: q.x, y: q.y, clear: true }; };
  // a spot on the water a few pixels from the shore: from a point on a lake towards land, the last water before it
  T.shore = (from) => { // the nearest shore in view, scanning four ways; the map itself, not a button, at the spot
    const q = m.project(from), wet = (x, y) => m.queryRenderedFeatures([x, y], { layers: ['water'] }).length > 0, onMap = (x, y) => document.elementFromPoint(x, y) === m.getCanvas();
    let best = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let x = q.x, y = q.y, k = 0;
      for (; k < 400 && onMap(x, y) && wet(x, y); k++) { x += dx; y += dy; }
      if (onMap(x, y) && !wet(x, y) && (!best || k < best.k)) best = { k, x: x - dx * 6, y: y - dy * 6 };
    }
    return best ? { x: best.x, y: best.y, clear: onMap(best.x, best.y), over: 'not the map' } : null; };
  T.view = (c, z) => new Promise((ok) => { m.jumpTo({ center: c, zoom: z }); m.once('idle', () => ok(true)); });
  T.state = () => ({ n: p.points.length, sports: p.legs.map((_, i) => p.legSport(i)).join(','), modes: p.legs.map((l) => l.mode).join(','), next: p.nextSport(), real: p.nextLegSport(), map: polku.state.activity, mode: p.mode,
    label: p.els.modeBtn.getAttribute('aria-label'), sport: p.els.sportBtn.textContent.trim(), past: p.past.length, menu: !!$('.menu-pop'), toast: $('#toast').hidden ? '' : $('#toast').innerText.replace(/\\s+/g, ' ').trim(),
    time: p.analysis ? Math.round(p.analysis.time) : null, waits: p.analysis && p.analysis.waits ? p.analysis.waits.length : 0 });
  // the notes shown and hidden, for a FAIL line about a note: one hidden at once is #381's
  T.notes = [];
  new MutationObserver(() => { const t = $('#toast'), now = `${t.hidden ? 'hidden' : 'shown'} “${t.innerText.replace(/\\s+/g, ' ').trim().slice(0, 40)}”`;
    if (T.notes[T.notes.length - 1]?.[0] !== now) T.notes.push([now, Math.round(performance.now())]); }).observe($('#toast'), { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
  T.settle = async (n) => { for (let k = 0; k < 60 && !(p.analysis && p.analysis.pts && p.legs.length === n - 1 && p.legs.every((l) => l.result)); k++) await new Promise((r) => setTimeout(r, 100)); await new Promise((r) => setTimeout(r, 300)); return T.state(); };
  return true;
})()"""


# once the page's timers set before now have run (a timer set later runs after them): on a busy page the check's own
# reads can come first, and a note read then could still be hidden a moment later (#381)
NL_TIMERS = "new Promise((ok) => setTimeout(() => ok(true), 300))"


def nextleg(chrome):
    fails = []

    def page(w, h_, phone, sport):
        pg = chrome.page(w, h_, phone)
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': EMPTY_DEPTHS}, pg.s)
        pg.open_app({'activity': sport}, {'polku:winter': '"off"', 'polku:plannerDock': '"left"', 'polku:speeds': '{}'}, '#15/61.4975/23.738')
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        pg.js(NL)
        return pg

    def press(pg, at, name, touch):
        if not at:
            fails.append(f'{name}: not on screen')
            return False
        if not at.get('clear', True):
            fails.append(f"{name}: something is over it ({at.get('over')})")
        if touch:
            pg.quick_tap(at['x'], at['y'])
        else:
            for kind in ('mouseMoved', 'mousePressed', 'mouseReleased'):
                pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': at['x'], 'y': at['y'], 'button': 'none' if kind == 'mouseMoved' else 'left',
                                                      'buttons': 1 if kind == 'mousePressed' else 0, 'clickCount': 1}, pg.s)
                time.sleep(0.05)
        time.sleep(0.5)
        return True

    def escape(pg):
        for event in ('rawKeyDown', 'keyUp'):
            pg.c.send('Input.dispatchKeyEvent', {'type': event, 'key': 'Escape', 'code': 'Escape', 'windowsVirtualKeyCode': 27}, pg.s)
        time.sleep(0.3)

    def want(name, got, **kw):
        bad = {k: got.get(k) for k, v in kw.items() if not (v(got.get(k)) if callable(v) else got.get(k) == v)}
        if 'toast' in bad:  # (the last notes, with their times in ms)
            bad['notes'] = pg.js("nlT.notes.slice(-4).map(([n, t]) => `${n} at ${t}`).join(', ')")
        if bad:
            fails.append(f'{name}: {bad}')

    # ---- a phone, by touch: Hike, then Gravel from the drawing menu
    name = '390x844'
    pg = page(390, 844, True, 'hike')
    S = lambda: pg.js('nlT.state()')
    pg.js('polku.planner.setActive(true), true')
    placed(pg)
    press(pg, pg.js("nlT.at('.pl-way [data-way=draw]')"), f'{name}: Draw it', True)
    along = pg.js("document.querySelector('.pl-way .way-line')?.textContent || ''")
    if along != 'Polku follows the paths, and the sport can change on the way.':
        fails.append(f'{name}: Draw it says “{along}”, not that the sport can change on the way')
    L = [[23.7355, 61.4972], [23.738, 61.4980], [23.7405, 61.4972]]
    if any(pg.js(f'nlT.water({ll})') for ll in L):
        fails.append(f'{name}: a point for the land legs is on the water')
    press(pg, pg.js(f'nlT.spot({L[0]})'), f'{name}: the first point', True)
    want(f'{name}, the first point', S(), n=1, label=lambda v: bool(v) and 'Hike' in v)
    press(pg, pg.js("nlT.at('#pl-tools .modebtn')"), f'{name}: the drawing button', True)
    order = pg.js("[...document.querySelectorAll('.menu-pop .menu-h')].map((e) => e.textContent).join(' / ')")
    if order != 'Draw the next leg / Sport · the legs you draw next / Route style · the whole route':
        fails.append(f'{name}: the drawing menu: {order}')
    press(pg, pg.js("nlT.item('Straight line')"), f'{name}: Straight line', True)
    press(pg, pg.js(f'nlT.spot({L[1]})'), f'{name}: the second point', True)
    want(f'{name}, a hike leg', pg.js('nlT.settle(2)'), sports='hike', label=lambda v: bool(v) and 'Straight line, Hike' in v)
    press(pg, pg.js("nlT.at('#pl-tools .modebtn')"), f'{name}: the drawing button', True)
    press(pg, pg.js("nlT.at('.menu-pop .nl-sport')"), f'{name}: the next leg’s sport', True)
    picks = pg.js("document.querySelectorAll('.menu-pop .nl-pick').length")
    if picks != 8:
        fails.append(f"{name}: {picks} sports for the next leg, not all eight")
    press(pg, pg.js("nlT.item('Gravel')"), f'{name}: Gravel', True)
    st = S()
    want(f'{name}, Gravel picked for the next leg', st, menu=True, next='gravel', map='gravel', mode='line', sports='hike', past=lambda v: v == 2)
    line = pg.js("document.querySelector('.menu-pop .nl-line')?.textContent || ''")
    if '25 / 20 / 12' not in line:
        fails.append(f"{name}: the speed line says “{line}”, not Gravel's speeds")
    escape(pg)
    want(f'{name}, the button', S(), label=lambda v: bool(v) and 'Straight line, Gravel' in v)
    press(pg, pg.js(f'nlT.spot({L[2]})'), f'{name}: the third point', True)
    want(f'{name}, a gravel leg after the hike', pg.js('nlT.settle(3)'), sports='hike,gravel', waits=1)
    if not pg.js('!!polku.planner.changeAt(1)'):
        fails.append(f'{name}: no changeover where the sport changes')
    # the speed line opens the editor in place; a change re-times the route
    t0 = S()['time']
    press(pg, pg.js("nlT.at('#pl-tools .modebtn')"), f'{name}: the drawing button', True)
    press(pg, pg.js("nlT.at('.menu-pop .nl-speed')"), f'{name}: the speed line', True)
    fast = pg.js("nlT.at([...document.querySelectorAll('.menu-pop .nl-editor .speed-presets button')].find((b) => b.textContent === 'Fast'))")
    if press(pg, fast, f'{name}: Fast in the editor', True):
        time.sleep(1)
        st = S()
        if not (st['time'] and t0 and st['time'] < t0):
            fails.append(f"{name}: Fast didn't re-time the route ({t0} s, then {st['time']} s)")
        if not pg.js("(document.querySelector('.menu-pop .nl-line')?.textContent || '').startsWith('Your speed: Fast')"):
            fails.append(f'{name}: the speed line doesn’t say Fast')
        press(pg, pg.js("nlT.at([...document.querySelectorAll('.menu-pop .nl-editor .speed-presets button')].find((b) => b.textContent === 'Normal'))"), f'{name}: Normal again', True)
    escape(pg)
    # Paddle draws Over water (from Follow paths), and back to Hike: not over water
    press(pg, pg.js("nlT.at('#pl-tools .modebtn')"), f'{name}: the drawing button', True)
    press(pg, pg.js("nlT.item('Follow paths')"), f'{name}: Follow paths', True)
    press(pg, pg.js("nlT.at('#pl-tools .modebtn')"), f'{name}: the drawing button', True)
    press(pg, pg.js("nlT.at('.menu-pop .nl-sport')"), f'{name}: the next leg’s sport', True)
    press(pg, pg.js("nlT.item('Paddle')"), f'{name}: Paddle', True)
    want(f'{name}, Paddle next', S(), mode='water', next='paddle', label=lambda v: bool(v) and 'Over water, Paddle' in v, sports='hike,gravel')
    press(pg, pg.js("nlT.at('.menu-pop .nl-sport')"), f'{name}: the next leg’s sport', True)
    press(pg, pg.js("nlT.item('Hike')"), f'{name}: Hike', True)
    want(f'{name}, Hike next again', S(), mode='auto', next='hike', map='hike')
    press(pg, pg.js("nlT.item('Straight line')"), f'{name}: Straight line', True)
    # nothing to undo for the next legs: Undo takes the gravel leg back, and the next leg stays Hike
    press(pg, pg.js("nlT.at(polku.planner.els.undo)"), f'{name}: Undo', True)
    want(f'{name}, after Undo', S(), n=2, sports='hike', next='hike', map='hike')

    # ---- a point on open water with Hike next: the note, its answers, the spot kept; not on a bridge or by the shore
    pg.js('nlT.view([23.735, 61.519], 14)')
    lake = [23.735, 61.522]
    if not pg.js(f'nlT.water({lake})'):
        fails.append(f'{name}: the lake point isn’t on the water')
    press(pg, pg.js(f'nlT.spot({lake})'), f'{name}: a point on the lake', True)
    st = S()
    want(f'{name}, a point on the lake', st, n=3, toast=lambda v: bool(v) and v.startswith('This point is on the water. How do you get there?') and 'Paddle (sea kayak)' in v and 'Swim' in v and 'Stay on land' in v and 'on the ice' not in v)
    past = st['past']
    press(pg, pg.js("nlT.toastBtn('Swim')"), f'{name}: Swim', True)
    time.sleep(0.6)
    pg.js(NL_TIMERS)
    st = S()
    # the note Swim shows stays, with its Undo (the tap on Swim hid it at once, #381)
    want(f'{name}, Swim', st, sports='hike,swim', next='swim', map='swim', past=past, toast=lambda v: bool(v) and v.startswith('Swim to this point, and on from here.') and v.endswith('Undo'))
    off = pg.js(f"(() => {{ const q = polku.planner.points[2]; return q ? Math.hypot((q[0] - {lake[0]}) * 53500, (q[1] - {lake[1]}) * 111200) : -1; }})()")
    if off < 0 or off > 1:
        fails.append(f'{name}: the point on the lake ' + ('is gone' if off < 0 else f'moved {off:.0f} m from where it was tapped'))
    press(pg, pg.js("nlT.at(polku.planner.els.undo)"), f'{name}: Undo', True)
    want(f'{name}, Undo after Swim', S(), n=2, sports='hike')
    pg.js("polku.set({ activity: 'hike' }), true")
    time.sleep(0.4)
    # by the shore, and on a bridge (Satakunnansilta over Tammerkoski): a point, and no note
    for what, spot, view in (('by the shore', f'nlT.shore({lake})', None), ('on a bridge', 'nlT.spot([23.7622, 61.50089])', 'nlT.view([23.7622, 61.50089], 16)')):
        if view:
            pg.js(view)
        n0 = S()['n']
        press(pg, pg.js(spot), f'{name}: a point {what}', True)
        st = S()
        if st['n'] != n0 + 1:
            fails.append(f'{name}: a tap {what} added no point')
        elif 'on the water' in st['toast']:
            fails.append(f'{name}: the note for a point {what}')
        if st['n'] > n0:
            pg.js('polku.planner.undo(), true')
    # in winter: the ice too, a straight line to the spot, with what Polku can't see; in a share link as well
    pg.js("polku.planner.app.winter = () => ({ on: true, setting: 'on' }), true")
    pg.js('nlT.view([23.735, 61.519], 14)')
    press(pg, pg.js(f'nlT.spot({lake})'), f'{name}: a point on the lake in winter', True)
    press(pg, pg.js("nlT.toastBtn('Walk on the ice')"), f'{name}: Walk on the ice', True)
    time.sleep(0.6)
    pg.js(NL_TIMERS)
    want(f'{name}, Walk on the ice', S(), toast=lambda v: bool(v) and v.startswith('On the ice: straight lines from here on.') and 'never go on ice you haven’t checked' in v)
    ice = pg.js("""(async () => { const p = polku.planner, P = await import(location.origin + '/js/planner.js'); for (let k = 0; k < 30 && !(p.analysis && p.legs.length && p.legs.at(-1).ice && p.legs.at(-1).result); k++) await new Promise((r) => setTimeout(r, 100));
      const w = p.analysis ? p.iceWarnings(p.analysis).map((x) => x.text) : [], url = p.shareUrl(), back = P.parseShared(new URL(url).searchParams) || {};
      const i = p.legs.length - 1, l = p.legs[i];
      return { i, leg: l ? l.mode + (l.ice ? ' ice' : '') : 'none', sport: l && p.legSport(i), mode: p.mode, w, ic: new URL(url).searchParams.get('ic'), back: back.ice }; })()""")
    if ice['leg'] != 'line ice' or ice['sport'] != 'hike' or ice['mode'] != 'line' or ice['w'] != ['On the ice: Polku can’t see whether it holds'] or ice['ic'] != str(ice['i']) or ice['back'] != [ice['i']]:
        fails.append(f'{name}: on the ice: {ice}')
    # a first point on the lake: no leg goes there, so no note (it covered the round trip's loops)
    pg.js("(() => { const p = polku.planner; p.app.winter = () => ({ on: false, setting: 'off' }); p.clear(); p.setMode('auto'); const t = document.querySelector('#toast'); t.classList.remove('show'); t.hidden = true; return true; })()")
    pg.js('nlT.view([23.735, 61.519], 14)')
    press(pg, pg.js(f'nlT.spot({lake})'), f'{name}: a first point on the lake', True)
    st = S()
    if st['n'] != 1 or 'on the water' in st['toast']:
        fails.append(f"{name}: a first point on the lake: {st['n']} points, the note “{st['toast']}”")
    fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    pg.close()

    # ---- the start's sport menu, by touch: Paddle keeps it open at the craft, and a craft is picked there
    name = '390x844 start'
    pg = page(390, 844, True, 'mtb')
    pg.js('polku.planner.setActive(true), true')
    placed(pg)
    # the sport: a row of its own under the top row, in the ways to begin and in Draw it, over its route style (2026-10-21)
    if not pg.js("!!document.querySelector('.pl-way .way-top + .sport-row')"):
        fails.append(f'{name}: the ways to begin have no sport row under their top row')
    press(pg, pg.js("nlT.at('.pl-way [data-way=draw]')"), f'{name}: Draw it', True)
    if not pg.js("!!document.querySelector('.pl-way .way-bar + .sport-row') && !!document.querySelector('.pl-way .stylebtn[data-k=srow]')"):
        fails.append(f'{name}: Draw it has no sport row under its top row and route style button')
    press(pg, pg.js("nlT.at('.pl-way .way-back')"), f'{name}: Ways to begin', True)
    press(pg, pg.js("nlT.at('.pl-way .sport-chip')"), f'{name}: the sport chip', True)
    press(pg, pg.js("nlT.item('Paddle')"), f'{name}: Paddle', True)
    c = pg.js("(() => { const m = document.querySelector('.menu-pop'); return m ? { crafts: [...m.querySelectorAll('.menu-chips .chip')].map((b) => b.textContent.trim() + (b.getAttribute('aria-checked') === 'true' ? '*' : '')).join(','), focus: document.activeElement.textContent.trim() } : null; })()")
    if not c or c['crafts'] != 'Sea kayak*,Canoe,SUP' or c['focus'] != 'Sea kayak':
        fails.append(f'{name}: after Paddle, the menu’s crafts: {c}')
    press(pg, pg.js("nlT.at([...document.querySelectorAll('.menu-pop .menu-chips .chip')].find((b) => b.textContent.trim() === 'SUP'))"), f'{name}: SUP', True)
    c = pg.js("({ craft: polku.planner.craft, sport: polku.state.activity, checked: document.querySelector('.menu-pop .menu-chips [aria-checked=true]')?.textContent.trim() })")
    if c != {'craft': 'sup', 'sport': 'paddle', 'checked': 'SUP'}:
        fails.append(f'{name}: SUP picked: {c}')
    pg.js("polku.planner.setCraft('kayak'), true")
    # …and in the pill's menu, the same choice
    escape(pg)
    pg.js("polku.set({ activity: 'mtb' }), true")
    # (the sport's note goes before the menu is opened again: on a phone it lies over the menu's lower rows)
    pg.js("new Promise((ok) => { const t0 = Date.now(), go = () => (document.querySelector('#toast').hidden || Date.now() - t0 > 8000 ? ok(true) : setTimeout(go, 100)); go(); })")
    press(pg, pg.js("nlT.at('#activity-bar .act-current')"), f'{name}: the pill', True)
    press(pg, pg.js("nlT.at('#activity-bar .act[data-k=paddle]')"), f'{name}: the pill’s Paddle', True)
    c = pg.js("(() => { const m = document.querySelector('#activity-bar .act-menu'); return { open: !m.hidden, crafts: [...m.querySelectorAll('.act-chip')].map((b) => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(','), focus: document.activeElement.textContent.trim() }; })()")
    if c != {'open': True, 'crafts': 'Sea kayak*,Canoe,SUP', 'focus': 'Sea kayak'}:
        fails.append(f'{name}: the pill’s menu after Paddle: {c}')
    press(pg, pg.js("nlT.at('#activity-bar .act-chip[data-craft=canoe]')"), f'{name}: the pill’s Canoe', True)
    if pg.js('polku.planner.craft') != 'canoe':
        fails.append(f"{name}: the pill's Canoe left the craft at {pg.js('polku.planner.craft')}")
    pg.js("polku.planner.setCraft('kayak'), true")
    fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    pg.close()

    # ---- 360 x 740 with long sport names: the sport stays whole on the button, the question fits
    name = '360x740'
    pg = page(360, 740, True, 'mtb')
    pg.js("""(async () => { const A = (await import(location.origin + '/js/config.js')).ACTIVITIES; A.mtb.label = 'Maastopyöräily'; A.trailrun.label = 'Polkujuoksu';
      const p = polku.planner; p.setActive(true); p.clear(); p.setMode('line'); p.addPoint([23.733, 61.4975]); p.addPoint([23.738, 61.4985]); p.setMode('auto'); p.renderTools(); await new Promise((r) => setTimeout(r, 600)); return true; })()""")
    b = pg.js("(() => { const s = document.querySelector('#pl-tools .modebtn .tb-sport'), r = s.getBoundingClientRect(); return { text: s.textContent, cut: s.scrollWidth > s.clientWidth + 1, right: r.right, w: innerWidth }; })()")
    if b['text'] != 'Maastopyöräily' or b['cut'] or b['right'] > b['w']:
        fails.append(f'{name}: the button’s sport: {b}')
    press(pg, pg.js("nlT.at('#activity-bar .act-current')"), f'{name}: the pill', True)
    press(pg, pg.js("nlT.at('#activity-bar .act[data-k=trailrun]')"), f'{name}: Polkujuoksu', True)
    q = pg.js("(() => { const m = document.querySelector('#activity-bar .act-menu'), r = m.getBoundingClientRect(); return { q: document.querySelector('.act-q')?.textContent, left: r.left, right: r.right, bottom: r.bottom, h: innerHeight, w: innerWidth, wide: [...m.querySelectorAll('*')].some((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible') }; })()")
    if q['q'] != 'Use Polkujuoksu for…' or q['left'] < 0 or q['right'] > q['w'] or q['bottom'] > q['h'] or q['wide']:
        fails.append(f'{name}: the question: {q}')
    fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    pg.close()

    # ---- 200 % (a 390 phone's 195 x 422): the drawing menu is a sheet of its own, and the sport is in it
    name = '195x422 (200 %)'
    pg = page(195, 422, True, 'mtb')
    pg.js("(async () => { const p = polku.planner; p.setActive(true); p.clear(); p.setMode('line'); p.addPoint([23.733, 61.4975]); p.addPoint([23.738, 61.4985]); await new Promise((r) => setTimeout(r, 600)); return true; })()")
    press(pg, pg.js("nlT.at('#pl-tools .modebtn')"), f'{name}: the drawing button', True)
    s = pg.js("(() => { const m = document.querySelector('.menu-pop'); return m ? { sheet: m.classList.contains('menu-sheet'), scrolls: m.scrollHeight > m.clientHeight, sport: !!m.querySelector('.nl-sport') } : null; })()")
    if not s or not s['sheet'] or not s['sport']:
        fails.append(f'{name}: the drawing menu: {s}')
    fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    pg.close()

    # ---- a desktop, by mouse: the sport button before the style, Go › Time's speeds, Settings' speeds by sport (#87)
    name = '1440x900'
    pg = page(1440, 900, False, 'mtb')
    pg.js('polku.planner.setActive(true), true')
    placed(pg)
    # the panel's place can change from the start too (its header waits while the start shows)
    press(pg, pg.js("nlT.at('.pl-way .way-dock')"), f'{name}: the start’s Move the planner', False)
    time.sleep(0.5)
    # at the bottom (a sheet's layout on a desktop), and the button now says it moves it back
    d = pg.js("({ layout: polku.planner.layout(), label: document.querySelector('.pl-way .way-dock')?.getAttribute('aria-label') })")
    if d != {'layout': 'sheet', 'label': 'Move the planner to the left'}:
        fails.append(f"{name}: the start's Move the planner: {d}")
    press(pg, pg.js("nlT.at('.pl-way .way-dock')"), f'{name}: the start’s Move the planner back', False)
    time.sleep(0.5)
    press(pg, pg.js("nlT.at('.pl-way [data-way=draw]')"), f'{name}: Draw it', False)
    if pg.js('polku.planner.layout()') != 'side' or not pg.js("!!document.querySelector('.pl-way .way-bar + .sport-row') && !!document.querySelector('.pl-way .way-chips')"):
        fails.append(f"{name}: Draw it, the panel {pg.js('polku.planner.layout()')}: no sport row and route styles")
    # its ✕ closes the planner, as in the ways to begin
    press(pg, pg.js("nlT.at('.pl-way .way-x[data-k=close]')"), f'{name}: Draw it’s ✕', False)
    if pg.js('polku.planner.active'):
        fails.append(f"{name}: Draw it's ✕ left the planner open")
    pg.js("(async () => { const p = polku.planner; p.setActive(true); p.clear(); p.setMode('line'); for (const q of [[23.733, 61.4975], [23.738, 61.4985], [23.743, 61.4975]]) p.addPoint(q); return true; })()")
    pg.js('nlT.settle(3)')
    o = pg.js("(() => { const p = polku.planner, r = (e) => e.getBoundingClientRect(); return { seg: r(p.els.modeSeg).right, sport: r(p.els.sportBtn).left, style: r(p.els.styleBtn).left, shown: !!p.els.sportBtn.offsetParent }; })()")
    if not (o['shown'] and o['seg'] <= o['sport'] < o['style']):
        fails.append(f'{name}: the sport button isn’t between the modes and the route style: {o}')
    press(pg, pg.js("nlT.at(polku.planner.els.sportBtn)"), f'{name}: the sport button', False)
    press(pg, pg.js("nlT.at('.menu-pop .nl-sport')"), f'{name}: the next leg’s sport', False)
    press(pg, pg.js("nlT.item('Hike')"), f'{name}: Hike', False)
    want(f'{name}, Hike for the next leg', pg.js('nlT.state()'), next='hike', map='hike', sport='Hike', sports='mtb,mtb',
         toast=lambda v: 'The map and the legs you draw next are Hike now. Your route stays MTB.' in (v or ''))
    escape(pg)
    # Go › Time: what the time is based on, Your speed ›, which opens its step in Route (#424's C)
    pg.js("(() => { const p = polku.planner; p.setTab('go'); p.reveal('speed'); return true; })()")
    time.sleep(0.6)
    at = pg.js("(document.querySelector('#pl-pane-go .row[data-k=speed]') || { textContent: '' }).textContent")
    if not at.startswith('Your speed20 / 16 / 11 km/h · 600 m/h upNormal'):
        fails.append(f'{name}: Go › Time says “{at[:80]}”')
    press(pg, pg.js("nlT.at('#pl-pane-go .row[data-k=speed]')"), f'{name}: Your speed', False)
    if not pg.js("polku.planner.tab === 'route' && document.querySelector('#pl-pane-route').dataset.step === 'speed' && !!document.querySelector('#pl-pane-route .speed-box .speed-presets')"):
        fails.append(f'{name}: Your speed in Go › Time opened no editor')
    pg.js("polku.planner.openStep(null); true")
    # Settings: no sport of its own (#321); every sport's speeds, the route's marked; MTB's Fast re-times the MTB route while the map is Hike
    press(pg, pg.js("nlT.at('#btn-settings')"), f'{name}: Settings', False)
    st = pg.js("(() => { const b = document.querySelector('#settings-body'); return { seg: !!b.querySelector('.sport-seg, select[aria-label^=Sport]'), rows: [...b.querySelectorAll('.speed-sport-row')].map((r) => r.dataset.k + (r.querySelector('.cur') ? '*' : '')).join(',') }; })()")
    if st['seg'] or st['rows'] != 'mtb*,gravel,road,hike,trailrun,run,paddle,swim':
        fails.append(f'{name}: Settings: {st}')
    t0 = pg.js('nlT.state()')['time']
    press(pg, pg.js("nlT.at('#settings-body .speed-sport-row[data-k=mtb]')"), f'{name}: Settings, MTB', False)
    press(pg, pg.js("nlT.at([...document.querySelectorAll('#settings-body .speed-presets button')].find((b) => b.textContent === 'Fast'))"), f'{name}: Settings, Fast', False)
    time.sleep(1)
    t1 = pg.js('nlT.state()')['time']
    if not (t0 and t1 and t1 < t0):
        fails.append(f"{name}: Settings' Fast for MTB didn't re-time the MTB route with the map on Hike ({t0} s, then {t1} s)")
    if not pg.js("(document.querySelector('#settings-body .speed-sport-row[data-k=mtb] small')?.textContent || '').startsWith('Fast')"):
        fails.append(f"{name}: Settings' MTB row doesn't say Fast")
    # How you go's speeds with no route are the sport's, not the cleared route's (#87)
    sp = pg.js("(async () => { const p = polku.planner; p.clear(); polku.set({ activity: 'paddle' }); await new Promise((r) => setTimeout(r, 500)); return [...p.els.speedBox.querySelectorAll('button')].map((b) => b.textContent).join(','); })()")
    if 'Sea kayak' not in sp:
        fails.append(f"{name}: How you go's speeds after Clear, with Paddle: {sp}")
    fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the next leg's sport and speed, the water note, Settings' speeds (B of #233)" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# The 3D button in the map's column (#226): what it shows, where it is, and the 3D switch in Layers beside it
B3D = """(() => {
  const b = document.querySelector('#btn-3d'), S = polku.state;
  if (!b) return { missing: true, focus: document.activeElement && document.activeElement.id };
  const r = b.getBoundingClientRect(), box = (s) => { const e = document.querySelector(s); if (!e || getComputedStyle(e).display === 'none') return null; const q = e.getBoundingClientRect(); return { t: q.top, b: q.bottom }; };
  const tg = [...document.querySelectorAll('#layers-body label.tg')].find((x) => x.querySelector('.tg-text').firstChild.textContent.trim() === '3D terrain');
  const after = getComputedStyle(b, '::after'), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const under = !top ? 'nothing' : top.closest('#btn-3d') ? 'btn-3d' : (top.closest('[id]') || top).id || String(top.className || top.tagName);
  return { under, pressed: b.getAttribute('aria-pressed'), on: !!S.terrain3d, terrain: !!polku.map.getTerrain(), layers: !!(tg && tg.querySelector('input').checked),
    mark: after.content !== 'none' && after.content !== 'normal' && parseFloat(after.width) > 0, bg: getComputedStyle(b).backgroundColor, color: getComputedStyle(b).color,
    at: [r.left + r.width / 2, r.top + r.height / 2], w: r.width, h: r.height, top: r.top, bottom: r.bottom, name: b.getAttribute('aria-label'),
    prev: b.previousElementSibling && (b.previousElementSibling.id || b.previousElementSibling.className), next: b.nextElementSibling && b.nextElementSibling.id,
    locate: box('#btn-locate'), zoom: box('.ctrl-zoom'), weather: box('#btn-time'), focus: document.activeElement && document.activeElement.id };
})()"""
# Layers, then More: the full panel, and its 3D switch (open in the Base map group), in view
B3D_SWITCH = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  if (document.querySelector('#layers-panel').hidden) {
    if (!document.querySelector('#quick-layers').classList.contains('open')) { document.querySelector('#btn-layers').click(); await wait(300); }
    document.querySelector('#quick-layers .qt-more').click(); await wait(300);
  }
  const tg = [...document.querySelectorAll('#layers-body label.tg')].find((x) => x.querySelector('.tg-text').firstChild.textContent.trim() === '3D terrain');
  if (!tg) return null;
  tg.scrollIntoView({ block: 'center' }); await wait(100);
  const r = tg.querySelector('.tg-ui').getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
})()"""
B3D_TILES = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
  const qd = document.querySelector('#quick-layers');
  if (!qd.classList.contains('open')) { document.querySelector('#btn-layers').click(); await wait(300); }
  for (const k of ['mtb', 'gravel', 'road', 'hike', 'trailrun', 'run', 'paddle', 'swim']) {
    polku.set({ activity: k }); await wait(150);
    out[k] = [...qd.querySelectorAll('.qt-tog')].map((b) => b.dataset.tile).join();
  }
  polku.set({ activity: 'mtb' }); await wait(150);
  qd.querySelector('.qd-edit-btn').click(); await wait(300);
  out.edit = [...qd.querySelectorAll('.qd-chip')].map((c) => c.dataset.add).join();
  qd.querySelector('.qd-done').click(); await wait(300);
  return out;
})()"""
B3D_WANT = {
    'mtb': 'trailColors,trailDetails,lipasRoutes,wmtMtb,wx:rain',
    'gravel': 'sfTraffic,sfRoadworks,drPaved,wmtCycling,wx:rain',
    'road': 'sfTraffic,sfRoadworks,sfRoadcond,wmtCycling,wx:wind',
    'hike': 'wmtHiking,lipasRoutes,lipasPoints,trailDetails,wx:rain',
    'trailrun': 'trailColors,trailDetails,lipasRoutes,lipasPoints,wx:rain',
    'run': 'lipasRoutes,sfRoadworks,pois,wx:temp,wx:rain',
    'paddle': 'nautical,depths,sfShips,lipasPoints,wx:wind',
    'swim': 'depths,fairways,sfShips,lipasPoints,wx:wind',
}


# The 3D button (#226): on desktops by mouse and keys, or (phones) by touch on phones and at 200 %. Two groups, each with a
# job of its own on GitHub's runner, where the one group took 16–27 minutes (#411).
def button3d(chrome, phones=False):
    fails = []

    def page(w, h_, phone, sport, settings=None):
        pg = chrome.page(w, h_, phone)
        # the button needs none of Traficom's depths
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': EMPTY_DEPTHS}, pg.s)
        pg.open_app({'activity': sport, 'timeline': True, **(settings or {})}, {'polku:winter': '"off"', 'polku:plannerDock': '"left"', 'polku:seen3dHint2': 'true'})
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        # Polku's load step opens the timeline, and on a phone the column then moves up above it (#292): open_app()
        # waits for the step, 45 s at most, and this says so if the timeline still isn't open
        if not pg.js("new Promise((ok) => { const t0 = Date.now(), go = () => !polku.state.timeline || !document.querySelector('#wx-bar').hidden ? ok(true)"
                     " : Date.now() - t0 > 45000 ? ok(false) : setTimeout(go, 100); go(); })"):
            fails.append(f'{w}x{h_} {sport}: the timeline did not open in 45 s (Polku’s load step)')
        late = pg.js(SETTLED)
        if late:
            fails.append(f'{w}x{h_} {sport}: {late}')
        return pg

    # where the button is now, as a finger or the pointer goes to it; whatever else is there fails
    def aim(pg, name):
        b = pg.js(B3D)
        if b['under'] != 'btn-3d':
            fails.append(f"{name}: {b['under']} is over the 3D button")
        return b['at']

    def mouse_click(pg, at):
        for kind in ('mouseMoved', 'mousePressed', 'mouseReleased'):
            pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': at[0], 'y': at[1], 'button': 'none' if kind == 'mouseMoved' else 'left',
                                                  'buttons': 1 if kind == 'mousePressed' else 0, 'clickCount': 1}, pg.s)
            time.sleep(0.06)
        time.sleep(0.5)

    def key(pg, k, code, vk, char=None):
        for event in ['rawKeyDown'] + (['char'] if char is not None else []) + ['keyUp']:
            fields = {'type': event, 'key': k, 'code': code, 'windowsVirtualKeyCode': vk}
            if char is not None and event == 'char':
                fields['text'] = char
            chrome.send('Input.dispatchKeyEvent', fields, pg.s)
        time.sleep(0.3)

    def expect(pg, name, on):
        b = pg.js(B3D)
        if b.get('missing'):
            fails.append(f'{name}: no 3D button in the map’s column')
            return b
        if b['on'] != on or b['terrain'] != on:
            fails.append(f"{name}: 3D terrain {'on' if b['on'] else 'off'} (the map's terrain {'on' if b['terrain'] else 'off'}), not {'on' if on else 'off'}")
        if b['pressed'] != str(on).lower():
            fails.append(f"{name}: the button is aria-pressed {b['pressed']} while 3D is {'on' if on else 'off'}")
        if b['layers'] != on:
            fails.append(f"{name}: Layers' 3D switch is {'on' if b['layers'] else 'off'} while 3D is {'on' if on else 'off'}")
        if b['mark'] != on:
            fails.append(f"{name}: the button {'has' if b['mark'] else 'has no'} mark besides its colour while 3D is {'on' if on else 'off'}")
        return b

    if not phones:
        # a mouse at 1440 x 900, in MTB and paddle, with a route drawn and the timeline open
        for sport in ('mtb', 'paddle'):
            name = f'1440x900 {sport}'
            pg = page(1440, 900, False, sport)
            pg.js(PLAN_TWO)
            b = expect(pg, f'{name}, at the start', False)
            if b.get('missing'):
                pg.close()
                continue
            if b['name'] != '3D terrain':
                fails.append(f"{name}: the button is named “{b['name']}”")
            if b['prev'] != 'ctrl-zoom' or b['next'] != 'btn-time' or not (b['zoom'] and b['zoom']['b'] <= b['top'] and b['bottom'] <= b['weather']['t']):
                fails.append(f"{name}: the button is not under zoom and above Weather (after {b['prev']}, before {b['next']})")
            if b['w'] < 40 or b['h'] < 40:
                fails.append(f"{name}: the button is {b['w']:.0f} × {b['h']:.0f} px")
            mouse_click(pg, aim(pg, f'{name}, a click'))
            pg.idle()  # the terrain in, as a person looks at it (turned off while it loads: MapLibre’s own error, #288)
            b = expect(pg, f'{name}, a click', True)
            if b['color'] != 'rgb(255, 255, 255)' or b['bg'] == pg.js("getComputedStyle(document.querySelector('#btn-locate')).backgroundColor"):
                fails.append(f"{name}: pressed, the button is {b['color']} on {b['bg']}, not white on the accent")
            mouse_click(pg, aim(pg, f'{name}, a second click'))
            expect(pg, f'{name}, a second click', False)
            # Layers' switch turns the same 3D, and the button follows it; both kept after a reload
            at = pg.js(B3D_SWITCH)
            if not at:
                fails.append(f'{name}: no 3D switch in the full Layers panel')
            else:
                mouse_click(pg, at)
                pg.idle()
                expect(pg, f"{name}, Layers' switch on", True)
                pg.reload()
                expect(pg, f"{name}, after a reload with Layers' switch on", True)
                pg.idle()
                mouse_click(pg, aim(pg, f'{name}, a click after the reload'))
                expect(pg, f'{name}, the button off after the reload', False)
                at = pg.js(B3D_SWITCH)
                mouse_click(pg, at)
                pg.idle()
                mouse_click(pg, at)
                expect(pg, f"{name}, Layers' switch on and off", False)
                mouse_click(pg, aim(pg, f'{name}, a click before the reload'))
                pg.reload()
                expect(pg, f'{name}, after a reload with the button on', True)
            fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
            pg.close()

        # the keyboard: Tab from zoom out reaches it and goes on to Weather; Enter and Space turn it
        pg = page(1440, 900, False, 'mtb')
        pg.js("document.querySelector('#btn-zoom-out').focus(), true")
        key(pg, 'Tab', 'Tab', 9)
        if pg.js(B3D)['focus'] != 'btn-3d':
            fails.append(f"1440x900 keyboard: Tab from zoom out went to {pg.js(B3D)['focus']}, not 3D")
        elif not pg.js("document.querySelector('#btn-3d').matches(':focus-visible') && getComputedStyle(document.querySelector('#btn-3d')).outlineStyle !== 'none'"):
            fails.append('1440x900 keyboard: no focus ring on the 3D button')
        key(pg, 'Enter', 'Enter', 13, '\r')
        pg.idle()
        expect(pg, '1440x900 keyboard, Enter', True)
        key(pg, ' ', 'Space', 32)
        expect(pg, '1440x900 keyboard, Space', False)
        key(pg, 'Tab', 'Tab', 9)
        if pg.js(B3D)['focus'] != 'btn-time':
            fails.append(f"1440x900 keyboard: Tab from 3D went to {pg.js(B3D)['focus']}, not Weather")
        fails += [f'1440x900 keyboard console: {e[:160]}' for e in pg.errors()]
        pg.close()

        # the quick drawer: no 3D tile in any sport, MTB's in its place is Waymarked MTB; Edit doesn't offer 3D
        pg = page(1440, 900, False, 'mtb')
        got = pg.js(B3D_TILES)
        for k, want in B3D_WANT.items():
            if got[k] != want:
                fails.append(f'the quick drawer in {k}: {got[k]}, not {want}')
        if 'terrain3d' in got['edit'].split(','):
            fails.append('Edit offers a 3D terrain tile')
        pg.close()
        # your own tiles saved with the old 3D tile: the drawer opens with the others, room for one more in Edit
        pg = page(1440, 900, False, 'mtb', {'quickTiles': {'mtb': ['trailColors', 'trailDetails', 'lipasRoutes', 'terrain3d', 'wx:rain']}})
        got = pg.js("""(async () => {
          const wait = (ms) => new Promise((r) => setTimeout(r, ms)), qd = document.querySelector('#quick-layers');
          document.querySelector('#btn-layers').click(); await wait(300);
          const tiles = [...qd.querySelectorAll('.qt-tog')].map((b) => b.dataset.tile).join();
          qd.querySelector('.qd-edit-btn').click(); await wait(300);
          const edit = { on: qd.querySelectorAll('.qt-rm').length, slots: qd.querySelectorAll('.qd-slot').length, chips: qd.querySelectorAll('.qd-chip:not(:disabled)').length };
          qd.querySelector('.qd-chip[data-add="wmtMtb"]').click(); await wait(100);
          qd.querySelector('.qd-done').click(); await wait(300);
          return { tiles, edit, after: [...qd.querySelectorAll('.qt-tog')].map((b) => b.dataset.tile).join() };
        })()""")
        if got['tiles'] != 'trailColors,trailDetails,lipasRoutes,wx:rain':
            fails.append(f"saved tiles with the old 3D tile: the drawer shows {got['tiles']}")
        if got['edit']['on'] != 4 or got['edit']['slots'] != 1 or not got['edit']['chips']:
            fails.append(f"saved tiles with the old 3D tile: Edit shows {got['edit']}")
        if got['after'] != 'trailColors,trailDetails,lipasRoutes,wx:rain,wmtMtb':
            fails.append(f"saved tiles with the old 3D tile, Waymarked MTB added: {got['after']}")
        fails += [f'old tiles console: {e[:160]}' for e in pg.errors()]
        pg.close()
    else:
        # touch phones, no zoom buttons: under locate, 44 px, a tap turns it; the column clear of the top bar
        for w, h_, sport in ((390, 844, 'paddle'), (390, 844, 'mtb'), (360, 740, 'mtb'), (375, 667, 'paddle')):
            name = f'{w}x{h_} {sport}'
            pg = page(w, h_, True, sport)
            b = expect(pg, f'{name}, at the start', False)
            if b.get('missing'):
                pg.close()
                continue
            if b['zoom'] or not (b['locate'] and b['locate']['b'] <= b['top'] and b['bottom'] <= b['weather']['t']):
                fails.append(f'{name}: the button is not right under locate, above Weather (zoom buttons {"shown" if b["zoom"] else "hidden"})')
            if b['w'] < 44 or b['h'] < 44:
                fails.append(f"{name}: the button is {b['w']:.0f} × {b['h']:.0f} px, under 44")
            pg.tap(*aim(pg, f'{name}, a tap'))
            pg.idle()
            expect(pg, f'{name}, a tap', True)
            pg.tap(*aim(pg, f'{name}, a second tap'))
            time.sleep(0.6)
            expect(pg, f'{name}, a second tap', False)
            fails += [f'{name} closed: {o}' for o in overlaps(pg.js(BOXES))]
            pg.js(PLAN_TWO)
            for st in ('peek', 'profile', 'half'):
                pg.js(f"polku.planner.setSheetState({json.dumps(st)}, {{ remember: false }}); true")
                late = pg.js(SETTLED)
                if late:
                    fails.append(f'{name} planning/{st}: {late}')
                fails += [f'{name} planning/{st}: {o}' for o in overlaps(pg.js(BOXES))]
                # (on a short phone a raised sheet leaves no room for 3D in the column: 25a leaves it out, in Layers still)
                if st == 'half' and pg.js("document.querySelector('#map-ctrls').classList.contains('no-3d')"):
                    if pg.js("getComputedStyle(document.querySelector('#btn-3d')).display") != 'none':
                        fails.append(f'{name}: the column has no room for 3D at half, but it shows')
                elif st == 'half':
                    pg.tap(*aim(pg, f'{name}, a tap with the sheet at half'))
                    time.sleep(0.6)
                    expect(pg, f'{name}, a tap with the sheet at half', True)
                    if pg.js("polku.planner.panel.dataset.state") != 'half':
                        fails.append(f'{name}: a tap on 3D moved the sheet from half')
            fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
            pg.close()

        # 200 % zoom on a 390 x 844 phone: no room for 3D in the column, which stays clear of the top bar; 3D still in Layers.
        # (With the timeline open or the planner, the column reaches the top bar on main too: #73, and 25a's rule for short phones.)
        pg = page(195, 422, True, 'paddle', {'timeline': False})
        if pg.js("(() => { const b = document.querySelector('#btn-3d'); return b ? getComputedStyle(b).display : 'none'; })()") != 'none':
            fails.append('195x422 (200 %): the 3D button shows, with no room for it in the column')
        top = ('.topbar', '#activity-bar', '#btn-settings', '#zoom-hint')
        fails += [f'195x422 (200 %) closed: {o}' for o in overlaps(pg.js(BOXES)) if '.map-ctrls' in o and any(t in o for t in top)]
        if not pg.js(B3D_SWITCH):
            fails.append("195x422 (200 %): no 3D switch in Layers")
        pg.close()
    what = 'by touch on phones, the column at every sheet size and at 200 %' if phones else 'mouse, keyboard, reload, Layers\' switch, the quick drawer\'s tiles'
    print(f"{'ok  ' if not fails else 'FAIL'} the 3D button: {what}" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


def button3d_phones(chrome):
    return button3d(chrome, phones=True)


# Fold, then away (step 3 of #233: #338, #303, #434): the planner and every card fold to one line and come back as
# they were; a second swipe, or ✕ at the line, puts the planner away or closes the card. Phones by touch, desktops by mouse.
FOLD_INFO = """(() => { const p = polku.planner, b = (e) => { if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const vis = (e) => !!e && !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
  return { st: p.panel.dataset.state, active: p.active, card: p.cards.current ? p.cards.current.kind : null, carded: p.panel.classList.contains('carded'),
    panel: b(p.panel), line: vis(p.els.fold) ? b(p.els.fold) : null, lineLabel: p.els.foldGo.getAttribute('aria-label'), lineText: p.els.foldGo.textContent,
    fold: vis(p.els.foldBtn) ? b(p.els.foldBtn) : null, away: vis(p.els.awayBtn) ? b(p.els.awayBtn) : null, min: vis(p.els.min) ? b(p.els.min) : null, lineX: vis(p.els.foldX) ? b(p.els.foldX) : null,
    head: getComputedStyle(p.els.head).visibility, foldH: parseFloat(p.panel.style.getPropertyValue('--fold-h')),
    stage: p.tools.hidden ? null : p.tools.dataset.stage, tools: p.tools.hidden ? null : b(p.tools), docked: p.tools.classList.contains('docked'),
    toolBtns: p.tools.hidden ? [] : [...p.tools.querySelectorAll('button')].filter((e) => e.getClientRects().length).map((e) => ({ name: e.getAttribute('aria-label') || e.textContent.trim(), ...b(e) })),
    note: [...document.querySelectorAll('.toast')].filter((t) => t.getClientRects().length).map((t) => t.textContent).join(' | '),
    top: document.querySelector('.topbar').getBoundingClientRect().bottom,
    col: [...document.querySelectorAll('#map-ctrls > *')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => ({ id: e.id || e.className, ...b(e) })) }; })()"""


def fold_at(pg, sel):
    return pg.js(f"(() => {{ const e = {sel}; if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }})()")


def fold_click(pg, x, y):
    for kind in ('mouseMoved', 'mousePressed', 'mouseReleased'):
        pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': x, 'y': y, 'button': 'none' if kind == 'mouseMoved' else 'left', 'buttons': 1 if kind == 'mousePressed' else 0, 'clickCount': 1}, pg.s)
        time.sleep(0.05)
    time.sleep(0.3)


def fold_phone(chrome):
    fails = []
    pg = chrome.page(390, 844, True)
    try:
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"'})
        pg.js(f"({TB_ROUTE})({json.dumps(TB_PTS)})", timeout=60000)
        pg.js("polku.planner.setSheetState('peek'); true")
        pg.js(SETTLED)
        info = lambda: pg.js(FOLD_INFO)
        s = info()
        # ⌄ in a row of its own at the sheet's top right, a finger's size, and no ✕ there yet
        if not s['fold'] or s['fold']['w'] < 44 or s['fold']['h'] < 44 or s['fold']['r'] < s['panel']['r'] - 16 or s['fold']['t'] > s['panel']['t'] + 8:
            fails.append(f"peek: ⌄ not at the sheet's top right, 44 px: {s['fold']} in {s['panel']}")
        if s['away'] or s['line']:
            fails.append('peek: ✕ or the folded line showing above the peek')
        # a tap on ⌄: the line, with the numbers, a button that says so; ✕ in ⌄'s place; the drawing mode, undo and redo float
        pg.tap(*fold_at(pg, 'polku.planner.els.foldBtn'))
        pg.js(SETTLED)
        s = info()
        if s['st'] != 'folded' or not s['line'] or s['head'] != 'hidden':
            fails.append(f"⌄: state {s['st']}, line {s['line']}, header {s['head']}")
        if s['panel']['h'] > 112 or abs(s['panel']['h'] - s['foldH']) > 1:
            fails.append(f"folded: the sheet {s['panel']['h']:.0f} px tall (its line {s['foldH']} px)")
        if 'km' not in s['lineText'] or 'open the planner as it was' not in s['lineLabel'] or 'km' not in s['lineLabel']:
            fails.append(f"folded: the line says “{s['lineText']}”, its name “{s['lineLabel']}”")
        if not s['away'] or abs(s['away']['r'] - s['fold']['r'] if s['fold'] else 0) > 1:
            fails.append(f"folded: ✕ not in ⌄'s place: {s['away']}")
        names = [t['name'] for t in s['toolBtns']]
        if s['stage'] != 'folded' or s['docked'] or len(names) != 3 or not names[0].startswith('Draw the next leg') or names[1:] != ['Undo', 'Redo']:
            fails.append(f"folded: the toolbox {s['stage']}, docked {s['docked']}: {names}")
        if any(t['w'] < 44 or t['h'] < 44 for t in s['toolBtns']):
            fails.append(f"folded: a toolbox button under 44 px: {[(t['name'][:12], round(t['w']), round(t['h'])) for t in s['toolBtns']]}")
        if s['tools'] and s['tools']['b'] > s['panel']['t'] - 8:
            fails.append(f"folded: the toolbox's foot at {s['tools']['b']:.0f}, the sheet's top at {s['panel']['t']:.0f}")
        # a tap on the line: as it was
        pg.tap(*fold_at(pg, 'polku.planner.els.foldGo'))
        pg.js(SETTLED)
        if info()['st'] != 'peek':
            fails.append(f"a tap on the line came to {info()['st']}, not the peek it left")
        # a long swipe down from the peek stops at the line; a second puts the planner away, with its note
        y = pg.js("polku.planner.els.sum.getBoundingClientRect().top + 10")
        pg.swipe(120, y, y + 420, ms=500, hold=0.1)
        pg.js(SETTLED)
        s = info()
        if s['st'] != 'folded' or not s['active']:
            fails.append(f"a long swipe down from the peek: {s['st']}, open {s['active']} (one swipe stops at the line)")
        y = s['panel']['t'] + 60
        pg.swipe(120, y, y + 200, ms=400, hold=0.1)
        pg.js(SETTLED)
        time.sleep(0.3)
        s = info()
        if s['active'] or 'Planner closed' not in s['note']:
            fails.append(f"a second swipe down from the line: open {s['active']}, the note “{s['note']}”")
        pg.js("polku.planner.setActive(true); polku.planner.setSheetState('peek'); true")
        pg.js(SETTLED)
        # a short slow drag down from the line springs back: closing takes 40 % of the way
        pg.js("polku.planner.fold(); true")
        pg.js(SETTLED)
        y = info()['panel']['t'] + 60
        pg.swipe(120, y, y + 20, ms=500, hold=0.2)
        pg.js(SETTLED)
        if info()['st'] != 'folded' or not info()['active']:
            fails.append(f"a short slow drag down from the line: {info()['st']}, open {info()['active']}")
        # ✕ at the line puts the planner away
        pg.tap(*fold_at(pg, 'polku.planner.els.awayBtn'))
        pg.js(SETTLED)
        time.sleep(0.3)
        s = info()
        if s['active'] or 'Planner closed' not in s['note']:
            fails.append(f"✕ at the line: open {s['active']}, the note “{s['note']}”")
        # Plan opens it as it was before the line, never folded
        pg.js("document.querySelector('#btn-plan').click(); true")
        pg.js(SETTLED)
        if info()['st'] == 'folded' or not info()['active']:
            fails.append(f"Plan after ✕ at the line: open {info()['active']}, {info()['st']}")
        # the handle's keys: down to the line and no further, up again
        pg.js("polku.planner.setSheetState('peek'); polku.planner.els.handle.focus(); true")
        for k, want in (('ArrowDown', 'folded'), ('ArrowDown', 'folded'), ('ArrowUp', 'peek')):
            pg.c.send('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': k, 'code': k, 'windowsVirtualKeyCode': {'ArrowDown': 40, 'ArrowUp': 38}[k]}, pg.s)
            pg.c.send('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': k, 'code': k, 'windowsVirtualKeyCode': {'ArrowDown': 40, 'ArrowUp': 38}[k]}, pg.s)
            pg.js(SETTLED)
            if info()['st'] != want or not info()['active']:
                fails.append(f"the handle's {k}: {info()['st']}, open {info()['active']} (wanted {want})")
                break
        # the map's buttons don't chase the sheet (#540): with motion, a fold moves them once
        pg.c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'no-preference'}]}, pg.s)
        pg.js("polku.planner.setSheetState('profile'); true")
        pg.js(SETTLED)
        seen = pg.js("""new Promise((done) => { const col = document.getElementById('map-ctrls'), out = new Set(), t0 = performance.now();
          polku.planner.fold(); const f = () => { out.add(Math.round(col.getBoundingClientRect().bottom)); if (performance.now() - t0 < 500) requestAnimationFrame(f); else done([...out]); }; f(); })""")
        if len(seen) > 2:
            fails.append(f'a fold with motion: the map\'s buttons moved through {len(seen)} places ({seen[:6]}…), not once')
        pg.c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce'}]}, pg.s)
        pg.js(SETTLED)
        # a card: opened from the map, its own size; up, full; ⌄ its line, with its name; down from there, closed and the planner as it was
        pg.js("polku.planner.setSheetState('peek'); true")
        pg.js(SETTLED)
        pg.js("(() => { const p = polku.planner; p.map.jumpTo({ center: p.points[1], zoom: 15, offset: [0, -200] }); return true; })()")
        time.sleep(0.4)
        pg.tap(*fold_at(pg, "polku.planner.markers[1].getElement().querySelector('.wp')"))
        time.sleep(0.6)
        pg.js(SETTLED)
        s = info()
        if s['card'] != 'point' or s['st'] != 'peek' or not s['fold']:
            fails.append(f"a tap on point 1: card {s['card']}, {s['st']}, ⌄ {bool(s['fold'])}")
        else:
            y = s['panel']['t'] + 30
            pg.swipe(120, y, y - 300, ms=500, hold=0.1)
            pg.js(SETTLED)
            s = info()
            if s['st'] != 'full' or s['card'] != 'point':
                fails.append(f"a swipe up on the card: {s['st']}, card {s['card']} (it opens full)")
            elif s['panel']['t'] > s['top'] + 30:
                fails.append(f"the card at full starts at {s['panel']['t']:.0f}")
            pg.tap(*fold_at(pg, 'polku.planner.els.foldBtn'))
            pg.js(SETTLED)
            s = info()
            if s['st'] != 'folded' or s['card'] != 'point' or 'open the card' not in (s['lineLabel'] or ''):
                fails.append(f"⌄ on the card: {s['st']}, card {s['card']}, the line “{s['lineLabel']}”")
            y = s['panel']['t'] + 60
            pg.swipe(120, y, y + 200, ms=400, hold=0.1)
            pg.js(SETTLED)
            s = info()
            if s['card'] or s['st'] != 'peek' or not s['active']:
                fails.append(f"a swipe down from the card's line: card {s['card']}, {s['st']} (the planner as it was: peek), open {s['active']}")
        # folded, a tap on a point opens its card folded, and ✕ there closes it, back to the planner's line
        pg.js("polku.planner.fold(); true")
        pg.js(SETTLED)
        pg.tap(*fold_at(pg, "polku.planner.markers[1].getElement().querySelector('.wp')"))
        time.sleep(0.6)
        pg.js(SETTLED)
        s = info()
        if s['card'] != 'point' or s['st'] != 'folded':
            fails.append(f"a tap on point 1 with the planner folded: card {s['card']}, {s['st']} (folded, its line)")
        else:
            pg.tap(*fold_at(pg, 'polku.planner.els.awayBtn'))
            pg.js(SETTLED)
            s = info()
            if s['card'] or s['st'] != 'folded' or not s['active'] or 'km' not in s['lineText']:
                fails.append(f"✕ on the card's line: card {s['card']}, {s['st']}, open {s['active']}, the line “{s['lineText']}”")
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    return fails


# 200 % (#453, #344): the planner rests at its line where its peek would cover more than half the screen; at full the whole
# sheet scrolls as one to its list; the map's buttons never go under the top bar; the Avoided place menu clear of the sheet
def fold_200(chrome):
    fails = []
    pg = chrome.page(195, 422, True)
    try:
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"', 'polku:sheetState': '{"sheet":"peek"}'})
        pg.js(f"({TB_ROUTE})({json.dumps(TB_PTS)})", timeout=60000)
        pg.js("polku.planner.setActive(false); polku.planner.setActive(true); true")
        pg.js(SETTLED)
        info = lambda: pg.js(FOLD_INFO)
        s = info()
        if s['st'] != 'folded':
            fails.append(f'opened at 200 %: {s["st"]}, not its line')
        for st in ('folded', 'peek', 'half', 'full'):
            pg.js(f"polku.planner.setSheetState('{st}'); true")
            pg.js(SETTLED)
            s = info()
            under = [c['id'] for c in s['col'] if c['t'] < s['top'] + 4 or c['b'] > s['panel']['t'] + 1]
            if under:
                fails.append(f'{st}: the map\'s buttons under the top bar or the sheet: {under}')
            if st == 'folded':
                if not any(c['id'] == 'btn-layers' for c in s['col']):
                    fails.append(f'folded: Layers not in the column ({[c["id"] for c in s["col"]]})')
                if s['tools'] and any(c['l'] < s['tools']['r'] and c['b'] > s['tools']['t'] and c['t'] < s['tools']['b'] for c in s['col']):
                    fails.append('folded: the map\'s buttons over the toolbox')
                if not s['away'] or s['away']['w'] < 44:
                    fails.append(f'folded: ✕ {s["away"]}')
        # full: the whole sheet scrolls to the last point's row (#453)
        pg.js("polku.planner.setSheetState('full'); polku.planner.setTab('route'); true")
        pg.js(SETTLED)
        r = pg.js("""(async () => { const p = polku.planner, rows = p.els.body.querySelectorAll('.wpl-point'), last = rows[rows.length - 1];
          if (!last) return 'no rows';
          if (p.panel.scrollHeight <= p.panel.clientHeight + 1) return `the sheet doesn't scroll (${p.panel.scrollHeight} px in ${p.panel.clientHeight})`;
          last.scrollIntoView({ block: 'end' }); await new Promise((ok) => setTimeout(ok, 200));
          const b = last.getBoundingClientRect(), s = p.panel.getBoundingClientRect(), t = p.els.top.getBoundingClientRect();
          return b.top >= t.bottom - 1 && b.bottom <= s.bottom + 1 ? '' : `the last row at ${Math.round(b.top)}–${Math.round(b.bottom)}, the sheet ${Math.round(t.bottom)}–${Math.round(s.bottom)} under its top row`; })()""")
        if r:
            fails.append(f'full at 200 %: {r}')
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    return fails


# Desktops: ⌄ folds the side panel down to its line at the foot with the toolbar beside it, a bottom panel to its line
# with the toolbar on it; a card on the map folds to its title row, keeping its bottom edge
def fold_desktop(chrome):
    fails = []
    pg = chrome.page(1440, 900, False)
    try:
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"', 'polku:plannerDock': '"left"'})
        pg.js(f"({TB_ROUTE})({json.dumps(TB_PTS)})", timeout=60000)
        pg.js("polku.planner.setSheetState('open'); true")
        pg.js(SETTLED)
        info = lambda: pg.js(FOLD_INFO)
        s = info()
        if not s['min'] or s['min']['t'] > s['panel']['t'] + 40:
            fails.append(f"side: ⌄ not in the header row: {s['min']}")
        else:
            fold_click(pg, *fold_at(pg, 'polku.planner.els.min'))
            pg.js(SETTLED)
            s = info()
            if s['st'] != 'folded' or not s['line'] or abs(s['panel']['b'] - 888) > 1 or s['panel']['h'] > 64:
                fails.append(f"side, ⌄: {s['st']}, the panel {s['panel']}")
            if not s['lineX']:
                fails.append('side, folded: no ✕ at the line')
            if not s['tools'] or abs(s['tools']['l'] - s['panel']['r']) > 1 or abs(s['tools']['b'] - s['panel']['b']) > 1:
                fails.append(f"side, folded: the toolbar {s['tools']} not beside the line {s['panel']}")
            fold_click(pg, *fold_at(pg, 'polku.planner.els.foldGo'))
            pg.js(SETTLED)
            if info()['st'] != 'open':
                fails.append(f"side: a click on the line came to {info()['st']}")
        # the bottom dock: the panel's line, the toolbar on its top edge
        pg.js("polku.planner.setDock('bottom'); polku.planner.setSheetState('half'); true")
        pg.js(SETTLED)
        fold_click(pg, *fold_at(pg, 'polku.planner.els.min'))
        pg.js(SETTLED)
        s = info()
        if s['st'] != 'folded' or s['panel']['h'] > 64 or abs(s['panel']['b'] - 888) > 1:
            fails.append(f"bottom, ⌄: {s['st']}, the panel {s['panel']}")
        if not s['tools'] or abs(s['tools']['b'] - s['panel']['t']) > 1:
            fails.append(f"bottom, folded: the toolbar {s['tools']} not on the line's top edge {s['panel']}")
        pg.js("polku.planner.unfold(); polku.planner.setDock('left'); polku.planner.setSheetState('open'); true")
        pg.js(SETTLED)
        # a point's card on the map: folded to its title row, its bottom edge where it was; opened again, where it was
        pg.js("(() => { const p = polku.planner; p.map.jumpTo({ center: p.points[1], zoom: 15, offset: [100, -150] }); return true; })()")
        time.sleep(0.4)
        fold_click(pg, *fold_at(pg, "polku.planner.markers[1].getElement().querySelector('.wp')"))
        time.sleep(0.6)
        card = "(() => { const e = polku.planner.cards.popup && polku.planner.cards.popup.getElement(); if (!e) return null; const r = e.getBoundingClientRect(); return [r.top, r.bottom, r.height]; })()"
        c0 = pg.js(card)
        if not c0:
            fails.append('a click on point 1 opened no card on the map')
        else:
            fold_click(pg, *fold_at(pg, "polku.planner.cards.box.querySelector('.way-fold')"))
            time.sleep(0.5)
            c1 = pg.js(card)
            lab = pg.js("polku.planner.cards.box.querySelector('.way-fold').getAttribute('aria-label') + '|' + polku.planner.cards.box.querySelector('.way-fold').getAttribute('aria-expanded')")
            if abs(c1[1] - c0[1]) > 2 or c1[2] > 80 or lab != 'Open the card|false':
                fails.append(f'the card folded: {c1} (was {c0}), its button “{lab}”')
            fold_click(pg, *fold_at(pg, "polku.planner.cards.box.querySelector('.way-fold')"))
            time.sleep(0.5)
            c2 = pg.js(card)
            if abs(c2[0] - c0[0]) > 2 or abs(c2[2] - c0[2]) > 2:
                fails.append(f'the card opened again: {c2} (was {c0})')
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    return fails


# #344 at 100 %: a start step raised to just below the top bar (Draw it's Fine-tune at 360 × 740) leaves no map button under
# the top bar or the sheet
def fold_start(chrome):
    fails = []
    pg = chrome.page(360, 740, True)
    try:
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"'})
        r = pg.js("""(async () => { const p = polku.planner, wait = (ms) => new Promise((ok) => setTimeout(ok, ms)), $ = (s) => document.querySelector(s);
          p.setActive(true); await wait(300); p.openWay('draw'); await wait(400);
          $('.pl-way .stylebtn[data-k=srow]')?.click(); await wait(500); $('.pl-way [data-k=tune]')?.click(); await wait(600);
          return !!p.els.styleBox.closest('.pl-way'); })()""")
        if not r:
            fails.append('Draw it’s Fine-tune didn’t open')
        pg.js(SETTLED)
        s = pg.js(FOLD_INFO)
        under = [f"{c['id']} {c['t']:.0f}–{c['b']:.0f}" for c in s['col'] if c['t'] < s['top'] + 4 or c['b'] > s['panel']['t'] + 1]
        if under:
            fails.append(f"Fine-tune raised (the sheet from {s['panel']['t']:.0f}, the top bar to {s['top']:.0f}): the map's buttons {under}")
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    return fails


def fold(chrome):
    fails = [f'390x844: {f}' for f in fold_phone(chrome)] + [f'360x740: {f}' for f in fold_start(chrome)] + [f'195x422 (200 %): {f}' for f in fold_200(chrome)] + [f'1440x900: {f}' for f in fold_desktop(chrome)]
    print(f"{'ok  ' if not fails else 'FAIL'} fold, then away: the planner and the cards" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# The runner itself (#262, #263, #254), in a Chrome of its own beside the one the run holds
def runner(chrome):
    import contextlib
    import io
    import subprocess
    fails = []
    me = os.path.abspath(__file__)
    r = subprocess.run([sys.executable, me, 'nosuchgroup'], capture_output=True, text=True, timeout=30)
    if r.returncode != 2 or 'changelog' not in r.stderr or '390x844' not in r.stderr:
        fails.append(f'an unknown group exits {r.returncode} with {r.stderr[:120]!r}, not 2 with the groups and sizes')
    r = subprocess.run([sys.executable, me, '--list'], capture_output=True, text=True, timeout=30)
    listed = [line.split()[0] for line in r.stdout.splitlines() if line.strip()]
    if r.returncode != 0 or listed[:-1] != [n for n, _, _ in GROUPS]:
        fails.append(f'--list exits {r.returncode} and lists {listed}')

    ran = []

    def boom(c):
        raise RuntimeError('Error: made to fail\n    at a second line')

    def stop(c):
        c.proc.kill()
        c.proc.wait()
        c.send('Browser.getVersion')

    def after(c):
        ran.append(c.alive())
        return True

    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        inner = Chrome()  # the profile is the run's, so this one gets a profile of its own
        try:
            ok, inner = run(inner, [('boom', boom, ()), ('after', after, ()), ('stop', stop, ()), ('after', after, ())])
        finally:
            inner.close()
    text = out.getvalue()
    if ok or ran != [True, True]:
        fails.append(f'after a group that raised, ok is {ok} and the next groups ran in a live Chrome {ran}')
    for want in ('in use by another run', 'FAIL boom raised RuntimeError: Error: made to fail\n', 'FAIL stop raised', 'Chrome stopped answering'):
        if want not in text:
            fails.append(f'no {want!r} in {text!r}')
    if 'second line' in text:
        fails.append("a raised error's second line was printed")
    print(f"{'ok  ' if not fails else 'FAIL'} the runner: unknown names, a group that raises, a profile in use" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# #298: a cold map still waits for the end of a zoom-out sequence; the
# forecast budget counts cached and pending short forecasts at every lattice level.
WEATHER_REQUESTS = r"""(async () => {
  const errs = [], {WeatherOverlay}=await import('./js/wxmap.js');
  const W=await import('./js/weather.js'), {idb}=await import('./js/idb.js');
  await idb('weather').prune(()=>false);
  const realFetch=fetch, realSet=setTimeout, realClear=clearTimeout;
  const requests=[], list=[0,1,2,3].map(i=>({L:6,i:8+i,j:40}));
  let release;
  const answer=url=>{
    const q=new URL(url).searchParams,lats=q.get('latitude').split(',').map(Number),lons=q.get('longitude').split(',').map(Number);
    const times=Array.from({length:52},(_,i)=>Math.floor(Date.now()/3600e3)*3600-3600+i*3600),fill=v=>times.map(()=>v);
    return new Response(JSON.stringify(lats.map((lat,i)=>({latitude:lat,longitude:lons[i],hourly:{time:times,wind_speed_10m:fill(4),wind_direction_10m:fill(220),wind_gusts_10m:fill(6),temperature_2m:fill(8),precipitation:fill(.1),cloud_cover:fill(80),snow_depth:fill(0),snowfall:fill(0)}}))),{headers:{'Content-Type':'application/json'}});
  };
  window.fetch=(input,init)=>{
    const url=String(input?.url||input);
    if(!url.includes('api.open-meteo.com/'))return realFetch(input,init);
    requests.push(url);
    return new Promise(ok=>{release=()=>ok(answer(url));});
  };
  try {
    if(W.uncached(list)!==4)errs.push('the four cold forecast cells were not counted');
    const pending=W.forecastCells(list);
    for(let n=0;!release && n<100;n++)await new Promise(r=>realSet(r,10));
    if(!release)throw new Error('the mocked forecast was not requested');
    if(W.uncached(list)!==0)errs.push(`${W.uncached(list)} cells on the way still consume the forecast budget`);
    release();await pending;
    if(W.uncached(list)!==0)errs.push(`${W.uncached(list)} fresh cells still consume the forecast budget`);
    const nested=list.map(c=>({L:c.L-1,i:c.i*2,j:c.j*2}));
    if(W.uncached(nested)!==0)errs.push('cached forecasts are not recognised at a finer lattice level');
    await W.forecastCells(nested);
    if(requests.length!==1)errs.push('the same cached locations were fetched again');

    // Only the scheduling clock is fake. Drive the real move handlers with the
    // zoom at each camera stop and a slow, still-pending first forecast (no grid).
    let now=0,seq=0,zoom=11;const timers=new Map(),asked=[];
    window.setTimeout=(fn,ms)=>{timers.set(++seq,{at:now+ms,fn});return seq;};
    window.clearTimeout=id=>timers.delete(id);
    const tick=ms=>{
      const end=now+ms;
      for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next || next[1].at>end)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}
      now=end;
    };
    const overlay=Object.assign(Object.create(WeatherOverlay.prototype),{
      map:{getZoom:()=>zoom},on:{wind:false,temp:false,rain:false,snow:false},open:true,
      viewZoom:zoom,grid:null,renderStrip(){},readout(){},loadFiRadar(){},
      maybeFetch(){asked.push(zoom);},
    });
    for(const z of [10,9,8,7,6,5]){
      overlay.onMoveStart();zoom=z;overlay.onMoveEnd();tick(800);
    }
    if(asked.length)errs.push(`a cold zoom-out asks for ${asked.length} intermediate views`);
    tick(400);
    if(asked.length!==1 || asked[0]!==5)errs.push(`the final overview was requested ${asked.length} times: ${asked}`);
    // A pan or zoom-in keeps the shorter ordinary delay.
    asked.length=0;overlay.onMoveStart();zoom=6;overlay.onMoveEnd();tick(600);
    if(asked.length!==1 || asked[0]!==6)errs.push('zooming back in did not request detail after the ordinary delay');
  } finally {
    window.fetch=realFetch;window.setTimeout=realSet;window.clearTimeout=realClear;
  }
  return errs;
})()"""


def weather_requests(chrome):
    pg = chrome.page(1440, 900, False)
    try:
        pg.open_app({'activity': 'hike'}, {'polku:winter': '"off"'})
        fails = pg.js(WEATHER_REQUESTS)
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} weather requests: cold zoom-out, cached and pending cells" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Before the page loads: Open-Meteo's forecast answers at once with the same weather everywhere (__wx.temp, −12 °C:
# the widest reading), so a check of the timeline doesn't wait for the service or depend on its weather. With
# __wx.hold set, the answers wait until __wx.release().
WX_FIXED = """(() => {
  const real = window.fetch.bind(window), W = window.__wx = { temp: -12, asked: 0, hold: false, held: [] };
  W.release = () => { W.hold = false; W.held.splice(0).forEach((go) => go()); return true; };
  window.fetch = (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (!/^https:\\/\\/api\\.open-meteo\\.com\\/v1\\/forecast\\?.*temperature_2m/.test(url)) return real(input, init);
    W.asked++;
    const q = new URL(url).searchParams, lats = q.get('latitude').split(',').map(Number), lons = q.get('longitude').split(',').map(Number);
    const n = 52, t0 = Math.floor(Date.now() / 3600e3) * 3600 - 3600, fill = (v) => Array.from({ length: n }, () => v);
    const hourly = () => ({ time: Array.from({ length: n }, (_, i) => t0 + i * 3600), wind_speed_10m: fill(4), wind_direction_10m: fill(220), wind_gusts_10m: fill(9),
      temperature_2m: fill(W.temp), precipitation: fill(0.4), cloud_cover: fill(60), snow_depth: fill(0.1), snowfall: fill(0) });
    const answer = () => new Response(JSON.stringify(lats.map((lat, i) => ({ latitude: lat, longitude: lons[i], hourly: hourly() }))), { headers: { 'Content-Type': 'application/json' } });
    return W.hold ? new Promise((ok) => W.held.push(() => ok(answer()))) : Promise.resolve(answer());
  };
})();"""

# The timeline's reading on phones (#243): opened with a tap on Weather, the forecast answering (WX_FIXED), its first
# line (the sky's icon, the temperature, "map centre") is whole inside its box. (The wind's and the rain's lines can
# still be longer than the box: #457.)
TL_READING = """new Promise((done) => {
  const t0 = Date.now(), go = () => {
    const box = document.querySelector('#wx-bar .tl-now'), main = box && box.querySelector('.tl-now-main');
    if (!main) { if (Date.now() - t0 < 20000) { setTimeout(go, 200); return; } done({ out: [`no reading after 20 s: ${box ? box.textContent : 'no timeline'}`] }); return; }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const out = [], b = box.getBoundingClientRect();
      for (const e of [main, ...main.children]) {
        const r = e.getBoundingClientRect(), t = e.textContent.trim() || e.tagName;
        if (r.right > b.right + 0.5 || r.left < b.left - 0.5 || r.bottom > b.bottom + 0.5) out.push(`“${t}” at x ${Math.round(r.left)}–${Math.round(r.right)}, out of its box (x ${Math.round(b.left)}–${Math.round(b.right)})`);
        else if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth) out.push(`“${t}” cut (${e.scrollWidth} px in ${e.clientWidth})`);
      }
      const label = main.querySelector('small')?.textContent;
      if (label !== 'map centre') out.push(`it says “${label}” where it's read, not “map centre”`);
      done({ out, text: box.textContent });
    }));
  };
  go();
})"""


def timeline_reading(chrome):
    fails = []
    for w, h_ in ((390, 844), (360, 740)):
        name = f'{w}x{h_}'
        pg = chrome.page(w, h_, True)
        try:
            pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': EMPTY_DEPTHS + WX_FIXED}, pg.s)
            pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"'}, '#12/62.2289/25.7652')
            pg.js("(async () => { const { idb } = await import(location.origin + '/js/idb.js'); await idb('weather').prune(() => false); return true; })()")
            b = pg.js("(() => { const r = document.getElementById('btn-time').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
            pg.quick_tap(*b)
            r = pg.js(TL_READING)
            fails += [f"{name}: the timeline's reading: {f}" for f in r['out']]
            fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        finally:
            pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the timeline's reading on phones: its first line whole in its box (#243)" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Every group: its name, its checks in the order they run, and its line for --list.
# No arguments runs them all in this order, then the layout at every size in VIEWPORTS.
# 25a, the toolbox and the header (#233). Phones: the toolbox floats beside the map's buttons or docks into
# the sheet; the mode's menu changes only the next leg; a style from it is the whole route's, and a leg with its
# own keeps it; More does what it says; Show the whole route is in the map's column; undo and redo from the first
# render (#241); a touch tap on a header control that re-renders itself leaves the sheet as it was (#251); a long
# route's numbers apart at 360 px and 200 % (#242), their labels wrapped at 12.5 px, never cut (#356). Desktops: the
# toolbar on the panel's edge, side or bottom, narrow or wide, folding before the map's buttons; its keys, its
# tooltips, More and Done. Straight legs: no routing.
TB_ROUTE = """(async (pts) => {
  const p = polku.planner; p.setActive(true); p.clear(); p.setMode('line');
  for (const q of pts) p.addPoint(q);
  for (let k = 0; k < 100 && !p.analysis; k++) await new Promise((r) => setTimeout(r, 100));
  p.setMode('auto');
  await new Promise((r) => setTimeout(r, 300));
  return !!p.analysis;
})"""
TB_PTS = [[23.81, 61.512], [23.82, 61.515], [23.835, 61.52]]
# #242: the profile of a long route with many points, at the sheet's full size: Colour by, its choice, On map and the
# size apart, and the choice wide enough for its words; the distance labels apart and on the profile; the points'
# marks apart (a mark is 14 px across), and the climbs' tags (↑1) not over each other, as the profile draws them
TB_PROF_PTS = [[23.0 + 0.1 * i, 61.0 + 0.04 * (i % 3)] for i in range(30)]
TB_PROFILE = """(() => {
  const p = polku.planner, cv = document.getElementById('profile-canvas'), ctx = cv.getContext('2d'), W = cv.getBoundingClientRect().width, out = [], drawn = [];
  const text = ctx.fillText, arc = ctx.arc, rr = ctx.roundRect;
  ctx.fillText = function (t, x, y, ...r) { drawn.push({ k: 'text', t: String(t), x, w: this.measureText(String(t)).width, a: this.textAlign }); return text.call(this, t, x, y, ...r); };
  ctx.arc = function (x, y, rad, ...r) { if (rad >= 6) drawn.push({ k: 'mark', x }); return arc.call(this, x, y, rad, ...r); };
  ctx.roundRect = function (x, y, w, h, ...r) { if (w === 12 && h === 12) drawn.push({ k: 'mark', x: x + 6 }); else if (h === 14) drawn.push({ k: 'tag', x, y, w }); return rr.call(this, x, y, w, h, ...r); };
  try { p.chart.draw(); } finally { delete ctx.fillText; delete ctx.arc; delete ctx.roundRect; }
  const labels = drawn.filter((d) => d.k === 'text' && /^[\\d.]+ k?m$/.test(d.t)).map((d) => ({ t: d.t, l: d.a === 'center' ? d.x - d.w / 2 : d.x, r: d.a === 'center' ? d.x + d.w / 2 : d.x + d.w })).sort((a, b) => a.l - b.l);
  labels.forEach((a, i) => { const b = labels[i + 1];
    if (a.l < -0.5 || a.r > W + 0.5) out.push(`“${a.t}” off the profile (x ${Math.round(a.l)}–${Math.round(a.r)} of ${Math.round(W)})`);
    if (b && b.l - a.r < 4) out.push(`“${a.t}” and “${b.t}” ${Math.round(b.l - a.r)} px apart`); });
  if (labels.length < 2) out.push(`${labels.length} distance labels`);
  const marks = drawn.filter((d) => d.k === 'mark').map((d) => d.x).sort((a, b) => a - b), near = marks.filter((x, i) => i && x - marks[i - 1] < 14).length;
  if (near) out.push(`${near} of the points' ${marks.length} marks less than a mark from the one before`);
  if (marks.length < 2) out.push(`${marks.length} marks: the start and the end not both drawn`);
  const tags = drawn.filter((d) => d.k === 'tag'), over = tags.filter((a, i) => tags.slice(i + 1).some((b) => a.x < b.x + b.w && b.x < a.x + a.w && Math.abs(a.y - b.y) < 14)).length;
  if (over) out.push(`${over} of the climbs' ${tags.length} tags over another`);
  const cut = tags.filter((t) => t.x < -0.5 || t.x + t.w > W + 0.5).length;
  if (cut) out.push(`${cut} of the climbs' tags off the profile`);
  if (!tags.length) out.push('no climbs’ tags drawn');
  const top = p.els.profZone.querySelector('.profile-top'), sel = top.querySelector('select');
  if (!sel.getClientRects().length) return { out: [...out, `its controls not shown (the sheet at ${p.panel.dataset.state})`], km: p.analysis && Math.round(p.analysis.total / 1000) };
  const parts = [top.querySelector('.mode-select-label'), sel, top.querySelector('.tg-inline'), top.querySelector('.prof-size')].filter((e) => e && e.getClientRects().length);
  const rs = parts.map((e) => e.getBoundingClientRect()), name = (e) => e.tagName === 'SELECT' ? 'the choice' : e.textContent.trim() || e.className;
  rs.forEach((a, i) => rs.slice(i + 1).forEach((b, j) => { if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) out.push(`${name(parts[i])} and ${name(parts[i + j + 1])} over each other`); }));
  const m = document.createElement('canvas').getContext('2d'), cs = getComputedStyle(sel);
  m.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const need = m.measureText(sel.selectedOptions[0]?.textContent || '').width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  if (sel.clientWidth + 1 < need) out.push(`the choice ${sel.clientWidth} px wide for “${sel.selectedOptions[0]?.textContent}” (${Math.ceil(need)} px)`);
  if (p.chart.points.length !== 30) out.push(`${p.chart.points.length} points on the profile, not the route's 30`);
  return { out, km: p.analysis && Math.round(p.analysis.total / 1000) };
})()"""
TB_DUPES = """(async () => { const p = polku.planner; p.toggleMore(); await new Promise((r) => setTimeout(r, 80));
  const name = (t) => t.trim().replace(/…$/, '');
  const bar = [...p.tools.querySelectorAll('button')].filter((b) => !b.hidden && b.offsetParent).map((b) => name(b.getAttribute('aria-label') || b.textContent));
  const more = [...document.querySelectorAll('.menu-pop .menu-item')].map((b) => name(b.querySelector('span').firstChild.textContent));
  p.closeMore(); return { bar, more, both: more.filter((m) => bar.includes(m)) }; })()"""
# where a control is, and whether something else is over its middle
TB_AT = """((sel) => { const el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!el || !el.offsetParent) return null;
  const b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, top = document.elementFromPoint(x, y);
  return { x, y, w: b.width, h: b.height, clear: !!top && (el === top || el.contains(top)) }; })"""
# a menu or a tooltip shown and wholly on screen
TB_ON_SCREEN = """((sel) => { const el = document.querySelector(sel); if (!el || el.hidden) return false;
  const r = el.getBoundingClientRect(); return r.top >= -0.5 && r.left >= -0.5 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5; })"""
TB_PHONE = """(async () => {
  const p = polku.planner, errs = [], wait = (ms) => new Promise((r) => setTimeout(r, ms)), txt = (e) => e.textContent.trim();
  const fit = document.getElementById('btn-fit');
  // (the toolbox is shown and placed in a frame after a change, which comes late on a busy machine: #367)
  const placed = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // #241: the start, before anything is drawn: undo and redo can't do anything, nor can Show the whole route
  p.setActive(true); await wait(300); await placed();
  for (const k of ['undo', 'redo']) if (p.els[k].offsetParent && !p.els[k].disabled) errs.push(`${k} looks ready at the start`);
  if (!p.els.fit.disabled) errs.push('Show the whole route looks ready at the start');
  if (!fit.hidden) errs.push('Show the whole route is in the map’s column with no route');
  // a route: undo is ready, redo isn't; Show the whole route is in the map's column
  if (!(await (""" + TB_ROUTE + """)(""" + json.dumps(TB_PTS) + """))) return ['no route'];
  await placed();
  if (p.els.undo.disabled || !p.els.undo.offsetParent || !p.els.redo.disabled) errs.push(`with a route: undo ${p.els.undo.disabled ? 'disabled' : 'ready'}, redo ${p.els.redo.disabled ? 'disabled' : 'ready'}`);
  if (fit.hidden || !fit.offsetParent) errs.push('no Show the whole route in the map’s column with a route');
  const col = document.getElementById('map-ctrls').children, order = [...col].filter((c) => c.offsetParent).map((c) => c.id || c.className);
  if (order[order.indexOf('btn-locate') + 1] !== 'btn-fit') errs.push(`Show the whole route isn’t under Locate: ${order.join(', ')}`);
  return errs;
})()"""


def toolbox(chrome):
    fails = []

    def page(w, h_, phone, sport='mtb', dock='left'):
        pg = chrome.page(w, h_, phone)
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': EMPTY_DEPTHS}, pg.s)
        pg.open_app({'activity': sport, 'timeline': True}, {'polku:winter': '"off"', 'polku:plannerDock': json.dumps(dock)})
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        pg.js("new Promise((ok) => { const t0 = Date.now(), go = () => !polku.state.timeline || !document.querySelector('#wx-bar').hidden || Date.now() - t0 > 30000 ? ok(true) : setTimeout(go, 100); go(); })")
        return pg

    # (where it is once the sheet has come to its size: a tap measured while the sheet changed after Clear route
    # landed on the map, not on the note's Undo, and added a point; settle=False for a note that goes in 7 s)
    def at(pg, sel, settle=True):
        if settle:
            pg.js(SETTLED)
        return pg.js(f"({TB_AT})({json.dumps(sel)})")

    def click(pg, sel, name):
        b = at(pg, sel)
        if not b:
            fails.append(f'{name}: not on screen')
            return False
        if not b['clear']:
            fails.append(f'{name}: something is over it')
        for kind in ('mouseMoved', 'mousePressed', 'mouseReleased'):
            pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': b['x'], 'y': b['y'], 'button': 'none' if kind == 'mouseMoved' else 'left',
                                                  'buttons': 1 if kind == 'mousePressed' else 0, 'clickCount': 1}, pg.s)
            time.sleep(0.05)
        time.sleep(0.4)
        return True

    def tap(pg, sel, name, settle=True):
        b = at(pg, sel, settle)
        if not b:
            fails.append(f'{name}: not on screen')
            return False
        if not b['clear']:
            fails.append(f'{name}: something is over it')
        pg.tap(b['x'], b['y'])
        time.sleep(0.5)
        return True

    def key(pg, k, code, vk):
        for event in ('rawKeyDown', 'char', 'keyUp'):
            fields = {'type': event, 'key': k, 'code': code, 'windowsVirtualKeyCode': vk}
            if event == 'char':
                fields['text'] = k
            chrome.send('Input.dispatchKeyEvent', fields, pg.s)
        time.sleep(0.25)

    # (scrolled into view, as a person would: a taller peek, the warnings' row in the evening, leaves a menu less room, #448)
    def item(pg, label):
        return pg.js(f"(() => {{ const b = [...document.querySelectorAll('.menu-pop .menu-item')].find((x) => x.textContent.trim().startsWith({json.dumps(label)})); if (b) {{ b.dataset.tbPick = '1'; b.scrollIntoView({{ block: 'nearest' }}); }} return !!b; }})()")

    # a route action: on the toolbar where it fits there, else in More
    def act(pg, label, name, press):
        sel = f'#pl-tools button[aria-label^={json.dumps(label)}]'
        if pg.js(f"(() => {{ const b = document.querySelector({json.dumps(sel)}); return !!b && !b.hidden && !!b.offsetParent; }})()"):
            return press(pg, sel, f'{name}: {label}')
        press(pg, '#pl-tools [aria-haspopup=menu][aria-label^=More]', f'{name}: More')
        if not item(pg, label):
            fails.append(f'{name}: {label} is neither on the toolbar nor in More')
            pg.js("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true")
            return False
        return press(pg, '.menu-pop [data-tb-pick]', f'{name}: {label}')

    # what's on the toolbar isn't in More too
    def dupes(pg, name):
        d = pg.js(TB_DUPES)
        if d['both']:
            fails.append(f"{name}: on the toolbar and in More: {', '.join(d['both'])}")
        return d

    # ---------------------------------------------------------------- phones, by touch
    for sport in ('mtb', 'paddle'):
        name = f'390x844 {sport}'
        pg = page(390, 844, True, sport)
        fails += [f'{name}: {e}' for e in pg.js(TB_PHONE, timeout=60000)]
        pg.js("polku.planner.setSheetState('peek'); true")
        pg.js(SETTLED)
        t = pg.js("""(() => { const p = polku.planner, b = p.tools.getBoundingClientRect(), c = document.getElementById('map-ctrls').getBoundingClientRect();
          const small = [...document.querySelectorAll('#pl-tools button, #planner .sheet-head button')].filter((e) => e.offsetParent && (e.offsetWidth < 44 || e.offsetHeight < 44)).map((e) => e.getAttribute('aria-label') || e.textContent.trim());
          return { docked: p.tools.classList.contains('docked'), right: b.right, colLeft: c.left, small }; })()""")
        if t['docked'] or t['right'] + 8 > t['colLeft']:
            fails.append(f"{name}: the toolbox {'docked' if t['docked'] else 'floats under the map’s buttons'} on a 390 px phone (right {t['right']:.0f}, the buttons at {t['colLeft']:.0f})")
        if t['small']:
            fails.append(f"{name}: under 44 px to touch: {', '.join(t['small'])}")
        # the mode's menu: only the next leg changes
        legs0 = pg.js("polku.planner.legs.map((l) => l.mode).join(',')")
        if tap(pg, '#pl-tools .modebtn', f'{name}: the mode button'):
            m = pg.js("""(() => { const m = document.querySelector('.menu-pop'); if (!m) return null; const r = m.getBoundingClientRect(), c = document.getElementById('map-ctrls').getBoundingClientRect();
              return { radios: [...m.querySelectorAll('[role=menuitemradio][aria-checked=true]')].map((b) => b.textContent.trim()), chips: m.querySelectorAll('.chip').length,
                expanded: polku.planner.els.modeBtn.getAttribute('aria-expanded'), inside: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0, clear: m.classList.contains('menu-sheet') || r.right <= c.left }; })()""")
            mode0 = pg.js("polku.planner.mode")
            want = {'auto': 'Follow paths', 'water': 'Over water', 'line': 'Straight line'}[mode0]
            if not m:
                fails.append(f'{name}: the mode button opened no menu')
            else:
                if not any(r.startswith(want) for r in m['radios']) or m['expanded'] != 'true' or not m['chips'] or not m['inside'] or not m['clear']:
                    fails.append(f'{name}: the mode’s menu: {m}')
                item(pg, 'Straight line')
                tap(pg, '.menu-pop [data-tb-pick]', f'{name}: Straight line')
                after = pg.js("({ mode: polku.planner.mode, legs: polku.planner.legs.map((l) => l.mode).join(','), menu: !!document.querySelector('.menu-pop'), label: polku.planner.els.modeBtn.getAttribute('aria-label') })")
                if after['mode'] != 'line' or after['legs'] != legs0 or after['menu'] or 'Straight line' not in after['label']:
                    fails.append(f'{name}: picking Straight line: {after} (the legs were {legs0})')
                pg.js("(() => { const p = polku.planner; p.addPoint([23.85, 61.523]); return true; })()")
                time.sleep(0.5)
                if pg.js("polku.planner.legs.at(-1).mode") != 'line':
                    fails.append(f'{name}: the next leg isn’t drawn straight')
        if sport == 'mtb':
            # a route style from the menu is the whole route's; a leg with its own keeps it; Undo
            pg.js("(() => { const p = polku.planner; p.setMode('auto'); p.setStyle({ p: 'flowy', v: {}, wet: 'auto' }, 0); return true; })()")
            time.sleep(0.9)
            tap(pg, '#pl-tools .modebtn', f'{name}: the mode button')
            if item(pg, 'Technical'):
                tap(pg, '.menu-pop [data-tb-pick]', f'{name}: Technical')
                st = pg.js("({ route: polku.planner.styleOf('mtb').p, own: polku.planner.legs[0].style && polku.planner.legs[0].style.p, toast: document.querySelector('#toast').textContent, label: polku.planner.els.modeBtn.textContent })")
                if st['route'] != 'technical' or st['own'] != 'flowy' or 'keep it' not in st['toast'] or 'Technical' not in st['label']:
                    fails.append(f'{name}: Technical from the menu: {st}')
                pg.js("polku.planner.undo(); true")
                time.sleep(0.3)
                if pg.js("polku.planner.styleOf('mtb').p") == 'technical':
                    fails.append(f'{name}: Undo kept the style')
            else:
                fails.append(f'{name}: no Technical in the mode’s menu')
            pg.js("(() => { document.querySelector('.menu-pop') && document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true; })()")
            # Clear route (in More on a 390 phone), then Undo from its note
            dupes(pg, name)
            n0 = pg.js("polku.planner.points.length")
            if act(pg, 'Clear route', name, tap):
                pg.js(SETTLED)  # (the sheet changes after Clear route: its note's Undo is measured once, then tapped while the note shows)
                c = pg.js("({ n: polku.planner.points.length, toast: document.querySelector('#toast').textContent, undo: !polku.planner.els.undo.disabled, fit: document.getElementById('btn-fit').hidden })")
                if c['n'] or 'Route cleared' not in c['toast'] or not c['undo'] or not c['fit']:
                    fails.append(f'{name}: Clear route: {c}')
                tap(pg, '#toast .toast-act', f'{name}: the note’s Undo', settle=False)
                if pg.js("polku.planner.points.length") != n0:
                    fails.append(f'{name}: Undo after Clear brought back {pg.js("polku.planner.points.length")} of {n0} points')
                if pg.js("polku.planner.els.redo.disabled"):
                    fails.append(f'{name}: redo isn’t ready after Undo')
            # #251: a touch tap on a header control that re-renders itself leaves the sheet at half; so does one on the time
            pg.js("""(() => { const p = polku.planner; p.setSheetState('half');
              const b = document.createElement('button'); b.type = 'button'; b.id = 'tb-rerender'; b.innerHTML = '<span>Re-render</span>';
              b.style.cssText = 'min-width: 60px; height: 44px';
              b.addEventListener('click', () => { b.innerHTML = '<span>Re-rendered</span>'; });
              p.els.head.querySelector('.sheet-row').prepend(b); return true; })()""")
            pg.js(SETTLED)
            tap(pg, '#tb-rerender', f'{name}: a header control that re-renders itself')
            if pg.js("polku.planner.panel.dataset.state") != 'half':
                fails.append(f'{name}: a touch tap on a header control that re-renders itself folded the sheet to {pg.js("polku.planner.panel.dataset.state")} (#251)')
            pg.js("document.getElementById('tb-rerender').remove(); polku.planner.setSheetState('half'); true")
            pg.js(SETTLED)
            tap(pg, '#planner .sum-time', f'{name}: the time')
            if pg.js("polku.planner.panel.dataset.state") == 'peek':
                fails.append(f'{name}: a touch tap on the time folded the sheet (#251)')
            # a reload: the route is back, undo and redo can't do anything yet (#241)
            pg.reload()
            if not pg.js("new Promise((ok) => { const t0 = Date.now(), go = () => polku.planner.points.length || Date.now() - t0 > 20000 ? ok(polku.planner.points.length) : setTimeout(go, 100); go(); })"):
                fails.append(f'{name}: a reload: no route back in 20 s')
            pg.js("polku.planner.setActive(true); true")
            placed(pg)
            r = pg.js("({ undo: polku.planner.els.undo.disabled, redo: polku.planner.els.redo.disabled, shown: !!polku.planner.els.undo.offsetParent })")
            if not (r['undo'] and r['redo'] and r['shown']):
                fails.append(f'{name}: after a reload, undo and redo: {r} (#241)')
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        pg.close()

    # #242: a long route's numbers apart, and the toolbox docked, at 360 px and at 200 % (a 390 phone's 195 x 422)
    LONG = [[23.0 + 0.25 * i, 61.0 + 0.05 * (i % 2)] for i in range(10)]
    for w, h_ in ((360, 740), (195, 422)):
        name = f'{w}x{h_}'
        pg = page(w, h_, True)
        pg.js(f"({TB_ROUTE})({json.dumps(LONG)})", timeout=60000)
        pg.js("polku.planner.setSheetState('peek'); true")
        pg.js(SETTLED)
        r = pg.js("""(() => { const p = polku.planner, head = p.els.head.getBoundingClientRect(), done = p.els.head.querySelector('.done').getBoundingClientRect();
          const items = [...p.els.sum.querySelectorAll('.sum-item')].map((e) => e.querySelector('b').getBoundingClientRect()), out = [];
          items.forEach((a, i) => { if (a.right > head.right + 0.5 || a.left < head.left - 0.5) out.push(`item ${i} outside the header`);
            if (a.right > done.left && a.bottom > done.top && a.top < done.bottom) out.push(`item ${i} under Done`);
            items.slice(i + 1).forEach((b, j) => { if (Math.abs(a.top - b.top) < 4 && b.left - a.right < 8) out.push(`items ${i} and ${i + j + 1} ${Math.round(b.left - a.right)} px apart`); }); });
          if (!p.tools.classList.contains('docked')) out.push('the toolbox floats');
          return { out, km: p.analysis && Math.round(p.analysis.total / 1000), text: p.els.sum.textContent }; })()""")
        if r['out']:
            fails.append(f"{name}: a {r['km']} km route ({r['text']}): {', '.join(r['out'])} (#242)")
        # #356: the labels under the numbers wrap, at 12.5 px, and are never cut with "…": as the app draws them, with a
        # departure set ("from 14:00"), and Finnish-length ones; the numbers with their labels stay apart, in the sheet
        # and clear of Done
        pg.js("(() => { const p = polku.planner; p.leaveAt = (Math.floor(Date.now() / 3600000) + 3) * 3600; p.renderAnalysis(); return true; })()")
        for lang, labels in (('English', None), ('Finnish-length', ['kokonaismatka', 'lähtöajasta klo 14.00', 'nousumetrit · laskumetrit'])):
            if labels:
                pg.js(f"(() => {{ const t = {json.dumps(labels)}; polku.planner.els.sum.querySelectorAll('.sum-item small').forEach((s, i) => {{ s.textContent = t[i]; }}); return true; }})()")
            pg.js(SETTLED)
            r = pg.js("""(() => { const p = polku.planner, head = p.els.head.getBoundingClientRect(), sheet = p.panel.getBoundingClientRect(), out = [];
              const done = p.els.head.querySelector('.done').getBoundingClientRect(), items = [...p.els.sum.querySelectorAll('.sum-item')];
              const box = (it) => { const r = [...it.children].map((e) => e.getBoundingClientRect());
                return { left: Math.min(...r.map((q) => q.left)), right: Math.max(...r.map((q) => q.right)), top: Math.min(...r.map((q) => q.top)), bottom: Math.max(...r.map((q) => q.bottom)) }; };
              const boxes = items.map(box);
              items.forEach((it, i) => { const s = it.querySelector('small'), size = getComputedStyle(s).fontSize, a = boxes[i];
                if (size !== '12.5px') out.push(`label ${i} at ${size}`);
                if (s.scrollWidth > s.clientWidth) out.push(`label ${i} cut (${s.scrollWidth} px in ${s.clientWidth})`);
                if (a.left < head.left - 0.5 || a.right > head.right + 0.5 || a.bottom > sheet.bottom + 0.5) out.push(`item ${i} outside the sheet's header`);
                if (a.right > done.left && a.bottom > done.top && a.top < done.bottom) out.push(`item ${i} under Done`);
                boxes.slice(i + 1).forEach((b, j) => { if (a.bottom > b.top && b.bottom > a.top && b.left - a.right < 8 && a.left - b.right < 8) out.push(`items ${i} and ${i + j + 1} touch`); }); });
              return { out, text: items.map((it) => it.querySelector('small').textContent).join(' | ') }; })()""")
            if r['out']:
                fails.append(f"{name}, {lang} labels ({r['text']}): {', '.join(r['out'])} (#356)")
        # #242: a long route of 30 points, its profile at the sheet's full size (TB_PROFILE)
        pg.js(f"({TB_ROUTE})({json.dumps(TB_PROF_PTS)})", timeout=90000)
        # (TB_ROUTE is back once there's an analysis: the route before's, still there, too)
        pg.js("new Promise((ok) => { const p = polku.planner, t0 = Date.now(), go = () => (p.analysisFits() && p.chart.points.length === 30) || Date.now() - t0 > 30000 ? ok(true) : setTimeout(go, 100); go(); })")
        for _ in range(3):  # (the new route's framing brings a full sheet down to half once)
            pg.js("polku.planner.setSheetState('full'); true")
            pg.js(SETTLED)
            if pg.js("polku.planner.panel.dataset.state === 'full'"):
                break
        r = pg.js(TB_PROFILE)
        if r['out']:
            fails.append(f"{name}: a {r['km']} km route of 30 points, its profile: {', '.join(r['out'])} (#242)")
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        pg.close()

    # ---------------------------------------------------------------- desktops, by mouse and keys
    pg = page(1440, 900, False)
    name = '1440x900'
    pg.js(f"({TB_ROUTE})({json.dumps(TB_PTS)})", timeout=60000)
    pg.js(SETTLED)
    # the toolbar at the map's foot (#468): beside the side panel 12 px up from the window's foot, however tall the
    # panel is; on a bottom panel's top edge. The scale and the credits just above it (not under it, nor lifted twice
    # as far), right of a side panel; the timeline over the map clear of it, and beside the panel of the credits' ⓘ too
    ON_EDGE = """(() => { const p = polku.planner, b = p.tools.getBoundingClientRect(), r = p.panel.getBoundingClientRect(), c = document.getElementById('map-ctrls').getBoundingClientRect();
      const side = p.layout() === 'side', level = c.top < b.bottom + 8, s = document.querySelector('.maplibregl-ctrl-bottom-left').getBoundingClientRect(), wx = document.getElementById('wx-bar'), t = !wx.hidden && wx.getBoundingClientRect();
      return { side, folds: [...p.tools.classList].filter((k) => /^fold|^tb-rows$/.test(k)), timeline: !!t, edge: side ? Math.abs(b.left - r.right) <= 1 && Math.abs(b.bottom - (innerHeight - 12)) <= 1 : Math.abs(b.bottom - r.top) <= 1 && Math.abs(b.left - r.left) <= 1,
        clear: b.right <= (level ? c.left - 12 : innerWidth - 12) + 0.5, below: b.top >= document.querySelector('.topbar').getBoundingClientRect().bottom - 0.5,
        active: [...p.tools.querySelectorAll('.tb-modes [aria-checked=true] span')].some((s) => s.offsetParent),
        scale: s.bottom <= b.top + 0.5 && s.bottom >= b.top - 12 && (!side || s.left >= r.right - 0.5),
        apart: !t || t.bottom <= b.top + 0.5 || t.top >= b.bottom - 0.5 || t.right <= b.left + 0.5 || t.left >= b.right - 0.5,
        credits: ((i) => { const q = i.getBoundingClientRect(), e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return !!e && i.contains(e); })(document.querySelector('.maplibregl-ctrl-attrib-button')) }; })()"""
    for label, js in (('the side panel', 'true'), ('the side panel, wide', "polku.planner.panel.style.setProperty('--pl-w', '640px'), true"),
                      ('the side panel, minimised', "polku.planner.panel.style.removeProperty('--pl-w'), polku.planner.setSheetState('min', { remember: false }), true"),
                      ('the panel at the bottom', "polku.planner.setDock('bottom'), true")):
        pg.js(js)
        placed(pg)
        pg.js(SETTLED)  # (the scale and the timeline follow the toolbar's room, --tools-h, in 0.2 s)
        e = pg.js(ON_EDGE)
        if not (e['edge'] and e['clear'] and e['below'] and e['active'] and e['scale'] and e['apart'] and (e['credits'] or not e['side'])) or (label == 'the side panel' and e['folds']):
            fails.append(f'{name} {label}: the toolbar {e}')
        if label == 'the panel at the bottom':
            d = dupes(pg, f'{name} {label}')
            if 'Show the whole route' not in d['bar'] or 'Export GPX' not in d['bar']:
                fails.append(f"{name} {label}: room on the toolbar, but it lacks Show the whole route or Export GPX: {', '.join(d['bar'])}")
    pg.js("polku.planner.setDock('left'); true")
    placed(pg)
    # #387: the panel's place button frames the route again in the map it leaves free, both ways: from the side
    # (framed beside it, above its toolbar), and from the bottom at its peek (framed wide, under where the side panel goes)
    IN_FREE = """(() => { const p = polku.planner, m = polku.map, r = p.routeBounds(), a = m.project([r[0], r[3]]), b = m.project([r[2], r[1]]);
      const pl = p.panel.getBoundingClientRect(), side = p.layout() === 'side', R = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
      const free = { top: document.querySelector('.topbar').getBoundingClientRect().bottom, bottom: side ? p.tools.getBoundingClientRect().top : pl.top, left: side ? pl.right : 0, right: document.getElementById('map-ctrls').getBoundingClientRect().left };
      const route = { top: a.y, bottom: b.y, left: a.x, right: b.x };
      return { side, inside: route.top >= free.top - 1 && route.bottom <= free.bottom + 1 && route.left >= free.left - 1 && route.right <= free.right + 1, route: R(route), free: R(free) }; })()"""
    for to, before in (('the bottom', 'true'), ('the side', "polku.planner.setSheetState('peek'), true")):
        pg.js(before)
        placed(pg)
        pg.js("polku.planner.fitRoute({ animate: false }); true")
        click(pg, '.sheet-dock', f'{name}: Move the planner to {to}')
        placed(pg)
        pg.js("new Promise((ok) => { const t0 = Date.now(), go = () => !polku.map.isMoving() || Date.now() - t0 > 5000 ? ok(true) : setTimeout(go, 50); go(); })")
        e = pg.js(IN_FREE)
        if e['side'] != (to == 'the side') or not e['inside']:
            fails.append(f"{name}: moved to {to} by its button, the route isn’t framed in the map it leaves free: {e} (#387)")
    # a card from the list stays clear of the toolbar at the foot (#468): End's, the lowest row, with the timeline closed;
    # its last button, scrolled to inside the card, is what's under its middle
    click(pg, '#btn-time', f'{name}: the timeline')
    click(pg, '#planner .wpl-point:has(.wp-end)', f'{name}: End in the list')
    pg.js(SETTLED)
    c = pg.js("""(() => { const c = document.querySelector('.card-beside'); if (!c) return null; const r = c.getBoundingClientRect(), t = polku.planner.tools.getBoundingClientRect();
      const last = [...c.querySelectorAll('button')].filter((b) => b.offsetParent).at(-1); last.scrollIntoView({ block: 'nearest' });
      const q = last.getBoundingClientRect(), e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2), R = (a) => [a.left, a.top, a.right, a.bottom].map(Math.round);
      return { timeline: !document.getElementById('wx-bar').hidden, card: R(r), tools: R(t), clear: r.bottom <= t.top + 0.5 || r.right <= t.left || r.left >= t.right,
        last: last.textContent.trim(), at: !!e && last.contains(e), over: e ? e.id || String(e.className) : '' }; })()""")
    if not c or c['timeline'] or not c['clear'] or not c['at']:
        fails.append(f'{name}: End’s card from the list, the timeline closed: {c}')
    pg.js("polku.planner.cards.close(); true")
    # the keys: P, S, W pick the mode; nothing else changes
    for k, code, vk, mode in (('s', 'KeyS', 83, 'line'), ('w', 'KeyW', 87, 'water'), ('p', 'KeyP', 80, 'auto')):
        key(pg, k, code, vk)
        got = pg.js("({ mode: polku.planner.mode, checked: polku.planner.tools.querySelector('.tb-modes [aria-checked=true]').dataset.mode })")
        if got['mode'] != mode or got['checked'] != mode:
            fails.append(f'{name}: the key {k.upper()}: {got}')
    # a tooltip on the pointer, with the name and the key, wholly on screen with the toolbar at the map's foot (#468)
    b = at(pg, '#pl-tools [aria-label="Show the whole route"]')
    if b:
        pg.c.send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': b['x'], 'y': b['y'], 'button': 'none'}, pg.s)
        time.sleep(0.9)
        tip = pg.js("(() => { const t = document.getElementById('tip'); return t && !t.hidden ? t.textContent : ''; })()")
        if 'Show the whole route' not in tip or 'F' not in tip:
            fails.append(f'{name}: the tooltip of Show the whole route: “{tip}”')
        if not pg.js(f"({TB_ON_SCREEN})('#tip')"):
            fails.append(f"{name}: the tooltip of Show the whole route is off the screen: {pg.js('JSON.stringify(document.getElementById(`tip`).getBoundingClientRect())')} in a {pg.js('innerHeight')} px window")
        pg.c.send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': 700, 'y': 500, 'button': 'none'}, pg.s)
        time.sleep(0.5)
        if pg.js("!document.getElementById('tip').hidden"):
            fails.append(f'{name}: the tooltip stayed after the pointer left')
    # Show the whole route from the toolbar frames the route
    pg.js("(() => { polku.map.jumpTo({ center: [25, 62.5], zoom: 9 }); return true; })()")
    click(pg, '#pl-tools [aria-label="Show the whole route"]', f'{name}: Show the whole route')
    time.sleep(1.2)
    if not pg.js("(() => { const b = polku.map.getBounds(), r = polku.planner.routeBounds(); return b.contains([r[0], r[1]]) && b.contains([r[2], r[3]]); })()"):
        fails.append(f'{name}: Show the whole route didn’t frame the route')
    # More: each item does what it says (Share, GPX and Save offline counted, not run)
    # (straight, so Back to start's leg isn't routed)
    pg.js("(() => { const p = polku.planner; p.setMode('line'); window.tbCalls = []; for (const k of ['share', 'exportGpx']) p[k] = () => tbCalls.push(k); p.app.saveOffline = () => tbCalls.push('offline'); return true; })()")
    # More's title: the route's own name when it has one (a picked loop's, an imported track's)
    pg.js("polku.planner.routeName = 'Kauppi loop'; true")
    click(pg, '#pl-tools [aria-haspopup=menu][aria-label^=More]', f'{name}: More')
    head = pg.js("document.querySelector('.menu-pop .menu-head b')?.textContent || ''")
    if head != 'Kauppi loop':
        fails.append(f'{name}: More’s title is “{head}”, not the route’s name')
    # the toolbar's menus, opened from the map's foot, wholly on screen (#468)
    if not pg.js(f"({TB_ON_SCREEN})('.menu-pop')"):
        fails.append(f'{name}: More isn’t wholly on screen')
    pg.js("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); polku.planner.routeName = ''; true")
    if click(pg, '#pl-tools .stylebtn', f'{name}: the route style') and not pg.js(f"({TB_ON_SCREEN})('.menu-pop')"):
        fails.append(f'{name}: the route style’s menu isn’t wholly on screen')
    pg.js("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true")
    # beside the panel the map's buttons are level with the toolbar (#468): Show the whole route stays on it, and
    # each of the route's actions is on it or in More (the bottom dock, with room for them, is checked above)
    d = dupes(pg, name)
    lost = [a for a in ('Show the whole route', 'Reverse', 'Back to start', 'Share link', 'Export GPX', 'Save offline', 'Clear route') if a not in d['bar'] + d['more']]
    if 'Show the whole route' not in d['bar'] or lost:
        fails.append(f"{name}: Show the whole route isn’t on the toolbar ({', '.join(d['bar'])}), or neither it nor More has {', '.join(lost)}")
    for label, check in (('Share link', "tbCalls.includes('share')"), ('Export GPX', "tbCalls.includes('exportGpx')"), ('Save offline', "tbCalls.includes('offline')"),
                         ('Reverse', "polku.planner.points[0][0] === 23.835"), ('Back to start', "polku.planner.isLoop()"),
                         ('Round trip', "polku.planner.loop.open")):
        if not act(pg, label, name, click):
            continue
        if not pg.js(check):
            fails.append(f'{name}: More’s {label} didn’t do it: ' + json.dumps(pg.js("({ n: polku.planner.points.length, loop: polku.planner.isLoop(), menu: !!document.querySelector('.menu-pop'), tip: !document.getElementById('tip').hidden })")))
    pg.js("polku.planner.closeLoop(); true")
    # (the route's actions come back on the toolbar in the next frame, and Done moves along with them: #311)
    pg.js("new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(true))))")
    # Done: the route's view (25c), and Show the whole route stays on the toolbar (the routeview group has the rest)
    click(pg, '#pl-tools .done', f'{name}: Done')
    d = pg.js("({ active: polku.planner.active, view: polku.planner.inView(), tools: !!polku.planner.els.fit.offsetParent && !!polku.planner.els.toolEdit.offsetParent, fit: !document.getElementById('btn-fit').hidden })")
    if not d['active'] or not d['view'] or not d['tools'] or d['fit']:
        fails.append(f'{name}: after Done: {d}')
    fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    pg.close()
    # a narrow desktop: the toolbar folds before the map's buttons, level with it at the map's foot (#468), with the
    # timeline open. There all the modes' names go (fold3); the longest words, MTB's Roads to the trail and Paddle's
    # Over water with Near the shore, shorten the style's name too (fold4), and only they do
    for sport, styles in (('mtb', (('balanced', False), ('transfer', True))), ('paddle', (('shore', True),))):
        name = f'1024x768 {sport}'
        pg = page(1024, 768, False, sport)
        pg.js(f"({TB_ROUTE})({json.dumps(TB_PTS)})", timeout=60000)
        if sport == 'paddle':
            pg.js("polku.planner.setMode('water'); true")
        for style, short in styles:
            pg.js(f"polku.planner.setStyle({{ p: '{style}', v: {{}}, wet: 'auto' }}); true")
            placed(pg)
            pg.js(SETTLED)
            e = pg.js(ON_EDGE)
            if not (e['edge'] and e['clear'] and e['scale'] and e['timeline'] and e['apart'] and e['credits']) or ('fold4' in e['folds']) != short or 'tb-rows' in e['folds']:
                fails.append(f'{name}, {style}: the toolbar {e}')
        d = dupes(pg, name)
        if 'Show the whole route' not in d['bar'] + d['more']:
            fails.append(f'{name}: Show the whole route is neither on the toolbar nor in More')
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        pg.close()
    # a narrower window (200 % on a 1920 px screen): fully folded, the toolbar still doesn't fit beside the panel, so it
    # takes a second row, growing upward, clear of the map's buttons, and the scale and the credits ride above it (#468)
    name = '960x700'
    pg = page(960, 700, False)
    pg.js(f"({TB_ROUTE})({json.dumps(TB_PTS)})", timeout=60000)
    placed(pg)
    pg.js(SETTLED)
    e = pg.js(ON_EDGE)
    if not (e['edge'] and e['clear'] and e['scale'] and e['timeline'] and e['apart'] and e['credits']) or 'tb-rows' not in e['folds']:
        fails.append(f'{name}: the toolbar {e}')
    fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the toolbox and the header (25a): phones, desktops, #241, #242, #251, #356, #387" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# The start (A with 25b of #233, #232, #109, #89, #281, #306). LIPAS answers from the recorded Multamäki place (and a
# second route made from it, south-east of it), through request(); BRouter mocked with straight lines (FIT_ROUTER).
START_LIPAS = """(() => {
  const real = window.fetch.bind(window), json = (o) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });
  const empty = { type: 'FeatureCollection', features: [] };
  let fx = null;
  const load = async () => {
    if (fx) return fx;
    const f = await (await real(location.origin + '/tools/fixtures/lipas-multamaki.json')).json();
    const twin = JSON.parse(JSON.stringify(f.place));
    for (const x of twin.features) { x.properties.id = 615380; x.properties.nimi_fi = 'Multamäen pitkä lenkki'; x.geometry.coordinates = x.geometry.coordinates.map(([e, n]) => [e + 900, n - 700]); }
    return (fx = { place: f.place, twin });
  };
  window.lipasMode = 'ok'; // 'fail': LIPAS isn't answering; 'none': nothing in view
  window.lipasAsked = 0;
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (!/^https:\\/\\/lipas\\.fi\\//.test(url)) return real(input, init);
    window.lipasAsked++;
    const { place, twin } = await load();
    if (window.lipasMode === 'fail') return new Response('', { status: 400 }); // (a 5xx would pause LIPAS for a minute: net.js)
    if (/CQL_FILTER=id%3D615379/.test(url)) return json(place);
    if (/CQL_FILTER=id%3D615380/.test(url)) return json(twin);
    if (window.lipasMode === 'none' || !/lipas_4411_/.test(url)) return json(empty);
    return json({ type: 'FeatureCollection', features: [...place.features, ...twin.features] });
  };
})()"""
START_LIB = """(() => {
  const p = polku.planner, map = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const T = (window.stT = { errs: [] }), err = (s) => T.errs.push(s), txt = (e) => (e ? e.textContent.replace(/\\s+/g, ' ').trim() : '');
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const M = () => p.marked || { state: 'none', list: [], on: 0 };
  const click = (s) => { const el = $(s); if (el) el.click(); else err(`nothing to press: ${s}`); return !!el; };
  // (what the header shows; on a planner from before the start's views, nothing: so the checks below fail one by one)
  const way = () => $('.pl-way') || document.createElement('div'), view = () => (p.startView ? p.startView() : 'none');
  const settled = () => """ + SETTLED + """;
  const until = async (ok, ms = 5000) => { for (const t0 = Date.now(); !ok() && Date.now() - t0 < ms;) await wait(100); return ok(); };
  const routed = async () => { const n = await import(location.origin + '/js/net.js'); return n.usage().filter((u) => /^brouter|^valhalla/.test(u.id)).reduce((s, u) => s + (u.session || 0), 0); };
  // a control's middle, for a tap or click from Python, and whether it's what's there (nothing over it)
  T.at = async (sel) => { await settled(); const el = typeof sel === 'string' ? $(sel) : sel; if (!el || !el.offsetParent) return null; el.scrollIntoView({ block: 'nearest' }); const b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, top = document.elementFromPoint(x, y); return { x, y, clear: !!top && (el === top || el.contains(top)), over: top ? top.id || String(top.className) : 'nothing' }; };
  // the map you can see: below the top bar, above the sheet and what floats over it, beside the side panel above
  // its toolbar at the map's foot (#468)
  const free = () => {
    const bar = $('.topbar').getBoundingClientRect(), pl = $('#planner').getBoundingClientRect(), side = p.layout() === 'side';
    const shown = (s) => [$(s)].filter((e) => e && !e.hidden && getComputedStyle(e).display !== 'none').map((e) => e.getBoundingClientRect());
    const tools = shown('#pl-tools:not(.docked)'), over = [...tools, ...shown('#wx-bar')];
    return { top: bar.bottom + 10, bottom: side ? Math.min(innerHeight - 20, ...tools.map((r) => r.top - 10)) : Math.min(pl.top, ...over.map((r) => r.top)) - 10, left: side ? pl.right + 20 : 20, right: $('#map-ctrls').getBoundingClientRect().left - 20 };
  };
  const onMap = (x, y) => document.elementFromPoint(x, y) === map.getCanvas();
  // a spot of the map you can see, a share of the way across and down it
  // (a note over it goes in a few seconds, and a person waits for it)
  T.spot = async (fx, fy) => { await settled(); const f = free(), x = f.left + (f.right - f.left) * fx, y = f.top + (f.bottom - f.top) * fy; await until(() => onMap(x, y) || !document.elementFromPoint(x, y)?.closest('#toast'), 8000); if (onMap(x, y)) return { x, y }; const t = document.elementFromPoint(x, y); err(`the map at ${Math.round(x)}, ${Math.round(y)} is under ${t ? t.id || String(t.className.baseVal ?? t.className) : 'nothing'} (the free map ${Math.round(f.top)}–${Math.round(f.bottom)})`); return null; };
  T.fresh = async () => { p.setActive(false); p.clear(); p.past = []; p.future = []; p.setActive(true); await wait(200); return view(); };
  // The toolbox grows with the route (2026-10-20): what's on it, and what's in More
  const shown = () => (p.tools.hidden ? [] : [...p.tools.querySelectorAll('button')].filter((b) => b.offsetParent && !b.closest('[role=radiogroup]')).map((b) => b.getAttribute('aria-label') || txt(b)));
  const moreItems = async () => {
    if (p.tools.hidden || !p.els.more.offsetParent) return null;
    p.els.more.click();
    await wait(150);
    const items = $$('.menu-pop .menu-item').map((b) => txt(b.querySelector('span')).replace(/\s+/g, ' '));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(100);
    return items;
  };
  // a phone's sheet as tall as its view: the view scrolls only once the sheet has stopped below the top bar
  T.whole = (what) => {
    if (p.layout() !== 'sheet') return;
    const w = way(), room = innerHeight - 76 - 2;
    if (w.scrollHeight > w.clientHeight + 1 && p.panel.getBoundingClientRect().height < room) err(`${what}: the view is cut by ${w.scrollHeight - w.clientHeight} px though the sheet has room (${T.sheetNow()})`);
  };
  // where the sheet is, for a FAIL line: its size, the peek it was given, the view in it, and what's still moving
  T.sheetNow = () => {
    const w = way(), moving = document.getAnimations().filter((a) => a instanceof CSSTransition && a.playState === 'running').map((a) => `${a.effect.target.id || a.effect.target.getAttribute('class')} ${a.transitionProperty}`);
    return `the sheet ${p.panel.dataset.state} ${Math.round(p.panel.getBoundingClientRect().height)} px, --peek-h ${p.panel.style.getPropertyValue('--peek-h') || 'unset'}, the view ${w.clientHeight} of ${w.scrollHeight} px, ${moving.join(', ') || 'nothing moving'}`;
  };
  // in a round trip nothing is drawn: only undo and redo, no mode, More or Done (#311)
  T.loopTools = (what) => { const on = shown().join('|'); if (on !== 'Undo|Redo') err(`${what}: the toolbox has ${on || 'nothing'}, not only undo and redo (#311)`); };
  T.toolsAt = async (stage, what) => {
    await settled();
    const on = shown(), desk = p.sideMQ.matches, has = (re) => on.some((x) => re.test(x));
    const acts = /^(Reverse|Back to start|Share link|Export GPX|Save offline|Clear route|Show the whole route)/;
    if (stage === 0) {
      const hist = p.past.length || p.future.length;
      if (!hist && !p.tools.hidden) err(`${what}: a toolbox with nothing it can do: ${on.join(', ')}`);
      if (hist && (on.join('|') !== 'Undo|Redo')) err(`${what}: with history and no point, the toolbox has ${on.join(', ') || 'nothing'} (only undo and redo)`);
      return T.errs.splice(0);
    }
    const mode = desk ? !!p.els.modeSeg.offsetParent && !!p.els.styleBtn.offsetParent : has(/^Draw the next leg/);
    if (!mode || !has(/^Undo$/) || !has(/^Redo$/) || !has(/^More/)) err(`${what}: the toolbox has ${on.join(', ')}`);
    const more = await moreItems() || [];
    if (stage === 1) {
      if (on.some((x) => acts.test(x))) err(`${what}: the route’s actions before there’s a leg: ${on.filter((x) => acts.test(x)).join(', ')}`);
      if (!more.some((x) => /^Clear route/.test(x)) || more.some((x) => /^(Share link|Export GPX|Save offline|Reverse|Back to start)/.test(x))) err(`${what}: More has ${more.join(', ')}`);
      T.left = p.tools.getBoundingClientRect().left;
      const c = $('#map-ctrls').getBoundingClientRect();
      T.col = `${c.left},${c.right}`; // (the sheet's height may change with the route's numbers: only sideways)
    } else {
      for (const a of ['Reverse', 'Share link', 'Export GPX', 'Save offline', 'Clear route', ...(p.isLoop() ? [] : ['Back to start']), ...(desk ? ['Show the whole route'] : [])]) {
        const n = on.filter((x) => x.startsWith(a)).length + more.filter((x) => x.startsWith(a)).length;
        if (n !== 1) err(`${what}: ${a} ${n ? 'twice' : 'neither on the toolbox nor in More'}`);
      }
      if (p.isLoop() && (on.concat(more)).some((x) => /^Back to start/.test(x))) err(`${what}: Back to start on a loop`);
      if (stage === 2 && T.left != null) {
        if (Math.abs(p.tools.getBoundingClientRect().left - T.left) > 0.5) err(`${what}: the toolbox’s left edge moved from ${T.left} to ${p.tools.getBoundingClientRect().left}`);
        const c = $('#map-ctrls').getBoundingClientRect();
        if (`${c.left},${c.right}` !== T.col) err(`${what}: the map’s buttons moved sideways as the toolbox grew`);
        T.left = null;
      }
    }
    return T.errs.splice(0);
  };

  // ---------------------------------------------------------------- the ways to begin
  T.ways = async () => {
    await T.fresh();
    const late = await settled();
    if (late) err(`opening: ${late}`);
    const desk = p.sideMQ.matches;
    if (view() !== 'ways') err(`the empty planner shows ${view()}, not the ways to begin`);
    const head = txt($('.pl-way .way-top'));
    if (!/^Start a route/.test(head)) err(`the ways' header: ${head}`);
    const tiles = $$('.pl-way .way-tile'), names = tiles.map((b) => txt(b.querySelector('b')));
    const want = desk ? 'Draw it|Round trip|Marked routes|A GPX or KML file' : 'Draw it|Round trip|Marked routes|A file';
    if (names.join('|') !== want) err(`the ways: ${names.join(' | ') || 'none'}`);
    if (tiles.some((b) => !txt(b.querySelector('small')))) err('a way without its line');
    // a tap on the map starts drawing: Draw it's line says so, with no line of its own above the ways (2026-10-21)
    if (!/^(Tap|Click) the map/.test(txt(tiles[0]?.querySelector('small')))) err(`Draw it's line: ${txt(tiles[0]?.querySelector('small'))}`);
    if (tiles.length === 4) {
      const r = tiles.map((b) => b.getBoundingClientRect());
      if (desk && !(r[1].top >= r[0].bottom && r[3].top >= r[2].bottom)) err('desktop: the ways aren’t a row each');
      if (!desk && !(Math.abs(r[0].top - r[1].top) < 1 && r[2].top >= r[0].bottom && Math.abs(r[2].top - r[3].top) < 1)) err('phone: the ways aren’t two by two');
      const bottom = desk ? p.panel.getBoundingClientRect().bottom : innerHeight;
      if (r.some((x) => x.bottom > bottom + 1)) err('a way to begin is cut off');
    }
    if (/\\bRide\\b/.test(txt(way()))) err('the ways say Ride (#306)');
    // the way out on a phone says Close: nothing is done yet (2026-10-20)
    // the way out is ✕ at the top right, as the other panels have it, and the sport is a row of its own under it (2026-10-21)
    const out = $('.pl-way .way-top .way-x[data-k=close]');
    // a finger's size on a phone (narrow screens made it 30 × 32 px)
    if (out && matchMedia('(pointer: coarse)').matches && (out.offsetWidth < 44 || out.offsetHeight < 44)) err(`the ways' ✕ is ${out.offsetWidth} × ${out.offsetHeight} px`);
    if (!out || out.getAttribute('aria-label') !== 'Close the planner' || !$('.pl-way .way-top + .sport-row')) err(`the ways' way out: ${out ? out.getAttribute('aria-label') : 'none'}, and the sport ${$('.pl-way .way-top + .sport-row') ? 'under it' : 'not under it'}`);
    T.errs.push(...(await T.toolsAt(0, 'no route, no history')));
    // no Done before the first point on desktops (Back is the way out); the phone's ways card keeps its own
    if (desk && p.els.toolDone.offsetParent) err('the toolbar has Done before the first point');
    // the sport in the header: the pill's own sports, the same in both
    const chip = $('.pl-way .sport-chip');
    if (!chip || !/MTB/.test(chip.getAttribute('aria-label'))) err(`the header's sport: ${chip ? chip.getAttribute('aria-label') : 'none'}`);
    return T.errs.splice(0);
  };
  T.sportMenu = () => {
    const m = $('.menu-pop');
    if (!m) return { menu: false };
    // a sport's name, without its line (B of #233)
    const name = (b) => { const n = b.querySelector(':scope > span > span, b > span'); return (n ? n.firstChild.textContent : b.textContent).trim(); };
    const items = [...m.querySelectorAll('[role=menuitemradio]')].map(name), pill = $$('#activity-bar .act-menu .act').map(name);
    return { menu: true, items, pill, checked: name(m.querySelector('[aria-checked=true]')), expanded: $('.pl-way .sport-chip').getAttribute('aria-expanded') };
  };
  T.pickSport = (label) => { const b = $$('.menu-pop [role=menuitemradio]').find((x) => (x.querySelector(':scope > span > span') || x).firstChild.textContent.trim() === label); if (b) b.dataset.stPick = '1'; return !!b; };
  T.sportIs = async (sport, label) => {
    await wait(300);
    const pill = $('#activity-bar .act-current').getAttribute('title'), chip = ($('.pl-way .sport-chip') || { getAttribute: () => '' }).getAttribute('aria-label');
    if (polku.state.activity !== sport || !pill.includes(label) || !chip.includes(label)) err(`after picking ${label}: the map’s ${polku.state.activity}, the pill’s “${pill}”, the chip’s “${chip}”`);
    return T.errs.splice(0);
  };
  T.swimWays = () => {
    const names = $$('.pl-way .way-tile b').map(txt);
    if (names.includes('Marked routes') || names.length !== 3) err(`Swim's ways: ${names.join(' | ')} (Swim has no marked routes in LIPAS)`);
    return T.errs.splice(0);
  };

  // ---------------------------------------------------------------- a tap from the ways, then four points in four taps (#232)
  T.tapAdded = async (n) => {
    await until(() => p.points.length >= n, 3000);
    // (the toolbox is shown, placed and faded in a frame after the point: late on a busy machine, #367)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (p.points.length !== n) err(`after ${n} tap${n > 1 ? 's' : ''}: ${p.points.length} points`);
    if ($('.maplibregl-popup')) err(`a card on the map after tap ${n} (#232): ${txt($('.maplibregl-popup'))}`);
    if (n === 1) {
      await wait(200);
      if (view() !== 'first') err(`the first point's peek isn't there: ${view()}`);
      const hint = txt($('.pl-way .way-hint b'));
      if (!/the map for your next point/.test(hint)) err(`the first point's peek says: ${hint}`);
      const chips = $$('.pl-way .rt-here .chip').map(txt);
      if (chips.length !== 4 || chips[3] !== 'Other…') err(`Round trip from here: ${chips.join(' | ') || 'none'}`);
      if (p.sideMQ.matches && !p.els.toolDone.offsetParent) err('no Done on the toolbar after the first point');
      // ✕ at the top right, as in the start and its steps, not Done (2026-10-21)
      if (!$('.pl-way .way-head .way-x[data-k=close]') || $('.pl-way .done')) err(`the first point's way out: ${$('.pl-way .done') ? 'Done' : 'no ✕'}`);
    }
    // what appeared on the toolbox faded in where it is (reduced motion, as here: it simply appears)
    const faded = (p.toolsFaded || []).map((b) => b.getAttribute('aria-label') || b.className);
    if (n === 1 && !faded.some((x) => /pl-tools|^Draw the next leg|tb-modes/.test(x))) err(`the first point: the toolbox didn’t fade in (${faded.join(', ') || 'nothing'})`);
    const acts = shown().filter((x) => /^(Reverse|Back to start|Share link|Export GPX|Save offline|Clear route|Show the whole route)/.test(x));
    if (n === 2 && acts.some((x) => !faded.includes(x))) err(`the first leg: ${acts.filter((x) => !faded.includes(x)).join(', ')} came without fading in`);
    return T.errs.splice(0).concat(await T.toolsAt(Math.min(n, 2), `after ${n} point${n > 1 ? 's' : ''}`));
  };

  // ---------------------------------------------------------------- Draw it
  T.draw = async () => {
    await T.fresh();
    p.setMode('auto');
    const desk = p.sideMQ.matches;
    click('.pl-way [data-way=draw]');
    await wait(200);
    if (view() !== 'draw') return [`Draw it opened ${view()}`];
    if (history.state?.polkuWay !== 1) err(`Draw it isn't a step of history (${JSON.stringify(history.state)})`);
    if (!/Ways to begin/.test(txt($('.pl-way .way-back'))) || !$('.pl-way .way-bar + .sport-row')) err('Draw it has no Ways to begin and the sport’s row at its top');
    if ($('.pl-way .done') || (desk && p.els.toolDone.offsetParent)) err('Done before the first point in Draw it');
    const hint = () => txt($('.pl-way .way-hint'));
    if (!/the map where you start/.test(hint()) || !/follows the paths, and the sport can change on the way/.test(hint())) err(`Draw it says: ${hint()}`);
    p.setMode('line');
    await wait(100);
    if (!/joins your points with straight lines/.test(hint()) || !/Straight lines don’t use a route style/.test(txt(way()))) err(`Straight line: ${txt(way())}`);
    p.setMode('water');
    await wait(100);
    if (!/finds a way over the water/.test(hint())) err(`Over water: ${hint()}`);
    p.setMode('auto');
    await wait(100);
    // the mode's menu has no note about drawn legs before there's one
    if (!desk) {
      p.els.modeBtn.click();
      await wait(200);
      if (/To change a drawn leg/.test(txt($('.menu-pop')))) err('the mode’s menu talks about drawn legs before there’s one');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(100);
    }
    // the route style: phones open it from one row, which raises the sheet; desktops show the chips
    const u0 = p.past.length, r0 = await routed();
    if (!desk) {
      const row = $('.pl-way .stylebtn[data-k=srow]');
      if (!row || !/Route style\s*Balanced/.test(txt(row))) err(`the style button: ${txt(row) || 'none'}`);
      const before = p.panel.getBoundingClientRect().height;
      if (row) row.click();
      await settled();
      if (!$('.pl-way .way-chips') || p.panel.getBoundingClientRect().height <= before) err('the style row didn’t raise the sheet to the chips');
      if (!/Draw it/.test(txt($('.pl-way .way-back')))) err(`raised, Back says ${txt($('.pl-way .way-back'))}`);
    } else if (!$('.pl-way .way-chips')) err('desktop: no style chips in Draw it');
    const flowy = $$('.pl-way .way-chips .chip').find((b) => /Flowy/.test(txt(b)));
    if (!flowy) return T.errs.splice(0).concat('no Flowy trails chip');
    flowy.click();
    await wait(900);
    if (p.styleOf('mtb').p !== 'flowy') err(`the chip set ${p.styleOf('mtb').p}`);
    if (p.past.length !== u0) err('a style before there’s a route made an Undo step');
    if ((await routed()) !== r0 || /routed again/.test(txt($('#toast')))) err('a style before there’s a route routed or said so');
    // the same style everywhere: the toolbox, How you go's own section
    if (!/Flowy/.test(p.els.modeBtn.getAttribute('aria-label'))) err(`the toolbox says ${p.els.modeBtn.getAttribute('aria-label')}`);
    const how = [...p.els.styleBox.querySelectorAll('.style-presets [aria-pressed=true]')].map(txt);
    if (!how.some((t) => /Flowy/.test(t))) err(`How you go says ${how.join(', ') || 'nothing'}`);
    // Fine-tune: How you go's own section, in place (the same element), and back in How you go after
    click('.pl-way [data-k=tune]');
    await wait(200);
    if (!p.els.styleBox.closest('.pl-way')) err('Fine-tune didn’t open How you go’s section in place');
    if (!desk) {
      click('.pl-way .way-back'); // ‹ Draw it: back to the card, the sheet lowered
      await until(() => !p.wayRaised);
      await settled();
      if (!$('.pl-way .stylebtn[data-k=srow]') || p.els.styleBox.closest('.pl-way')) err('Back from Fine-tune didn’t lower the Draw it card');
    }
    if (!p.els.styleBox.closest('[data-sec=style]') && !desk) err('How you go’s section isn’t back in How you go');
    // the phone's back gesture: back to the ways, as they were
    history.back();
    await until(() => view() === 'ways');
    if (view() !== 'ways') err(`the back gesture from Draw it: ${view()}`);
    if (p.els.styleBox.closest('.pl-way') || !p.els.styleBox.closest('[data-sec=style]')) err('How you go’s section isn’t back in How you go after the ways');
    // put the style back as it was, from How you go
    p.setStyle({ p: 'balanced', v: {}, wet: 'auto' });
    return T.errs.splice(0);
  };

  // ---------------------------------------------------------------- Round trip from the ways
  T.roundTrip = async () => {
    await T.fresh();
    // a GPS fix with seven decimals: the start gets five (#281)
    navigator.geolocation.getCurrentPosition = (ok) => setTimeout(() => ok({ coords: { longitude: 25.9031234, latitude: 62.4351234, accuracy: 8 } }), 20);
    click('.pl-way [data-way=loop]');
    await wait(200);
    if (view() !== 'loop' || !p.loop.fromWays) return [`Round trip from the ways: ${view()}`]; // (on main: Round trip opens the old form)
    if (!/Ways to begin/.test(txt($('.pl-way .way-back')))) err('the round trip from the ways has no Ways to begin');
    const make = () => $('.pl-way .rt-make');
    if (history.state?.polkuWay !== 1) err(`the round trip from the ways isn't a step of history (${JSON.stringify(history.state)})`);
    // the start first, and only that, so the map has the room for it (2026-10-21)
    if (!/(Tap|Click) the map where the loop starts/.test(txt(way())) || !$('.pl-way [data-k=where]') || !/sends your position to the router/.test(txt(way()))) err(`before a start: ${txt(way())}`);
    if (make() || $('.pl-way .rt-how') || $('.pl-way .rt-chips') || $('.pl-way .rt-pair')) err(`before a start, the rest shows too: ${txt(way())}`);
    // the sport's row under the top row, in every step (2026-10-21)
    if (!$('.pl-way .way-bar + .sport-row')) err('the round trip has no sport row under its top row');
    const tall = way().getBoundingClientRect().height;
    click('.pl-way [data-k=where]');
    await until(() => p.loop.start);
    const s = p.loop.start || [];
    if (!s.length || s.some((v) => String(v).split('.')[1]?.length > 5)) err(`the start from Where I am: ${s.join(', ') || 'none'} (five decimals at most, #281)`);
    await settled();
    if (!/From your position/.test(txt(way())) || !make() || make().disabled || !$('.pl-way .way-bar + .sport-row')) err(`after Where I am: ${txt(way())}`);
    // the route style and the direction: side by side on a phone, a row each on a desktop
    const pair = $('.pl-way .rt-pair'), kids = pair ? [...pair.children] : [];
    if (kids.length !== 2 || !kids[0].matches('.stylebtn[data-k=srow]') || !kids[1].matches('.rt-dir') || !kids[1].querySelector('select[data-k=dir]')) err(`the style and the direction: ${pair ? txt(pair) : 'none'}`);
    else if (kids.some((k) => k.getBoundingClientRect().height > 60)) err(`the style and the direction stretched: ${kids.map((k) => Math.round(k.getBoundingClientRect().height)).join(' and ')} px tall`);
    else if (Math.abs(kids[0].getBoundingClientRect().top - kids[1].getBoundingClientRect().top) < 1 === (p.layout() === 'side')) err(`the style and the direction ${p.layout() === 'side' ? 'side by side in the side panel' : 'a row each at the bottom'}`);
    // a wide panel at the bottom: the form in two columns, How long beside the sport (2026-10-21)
    if (p.layout() === 'sheet' && $('.sheet-head').clientWidth >= 720 && !(Math.abs($('.pl-way .rt-how').getBoundingClientRect().top - $('.pl-way .sport-row').getBoundingClientRect().top) < 30)) err('a wide panel at the bottom: the round trip isn’t in two columns');
    if ($('.pl-way [data-k=where]') || $('.pl-way .rt-where')) err('Where I am is still offered when the start is your position');
    if (way().getBoundingClientRect().height <= tall) err('the form didn’t open with the start');
    // the start stays in sight above the form
    const q = map.project(s), r = p.panel.getBoundingClientRect(), side = p.layout() === 'side';
    if (s.length && !(side ? q.x > r.right && q.x < innerWidth : q.y > 0 && q.y < r.top)) err(`the start is at ${Math.round(q.x)}, ${Math.round(q.y)} px, the form at ${Math.round(side ? r.right : r.top)}`);
    const lens = () => $$('.pl-way .rt-chips .chip:not([data-k=len-other])').map(txt).join(' ');
    // three on a phone, in one row; four on a desktop (2026-10-21)
    if (lens() !== (p.sideMQ.matches ? '10 km 20 km 30 km 50 km' : '10 km 20 km 30 km')) err(`MTB's lengths: ${lens()}`);
    const ch = $$('.pl-way .rt-chips .chip').map((c) => Math.round(c.getBoundingClientRect().top));
    if (!p.sideMQ.matches && innerWidth >= 375 && new Set(ch).size > 1) err('the lengths and Other… aren’t in one row');
    // in the order it's chosen: the start, How long (Distance or Time), the lengths, the direction (2026-10-21)
    const order = ['.sport-row', '.rt-start', '.rt-how', '.rt-chips', '.rt-pair'].map((q) => [...way().children].findIndex((e) => e.matches(q)));
    if (order.some((i, k) => i < 0 || (k && i < order[k - 1]))) err(`the round trip's order: ${order.join(', ')} (the sport, the start, How long, the lengths, the style and direction)`);
    if ($('.pl-way [data-k=len]')) err('the length field shows before Other…');
    click('.pl-way [data-k=len-other]');
    await wait(200);
    if (document.activeElement !== $('.pl-way [data-k=len]')) err('Other… didn’t open the length field');
    if (!/5 km shorter/.test(($('.pl-way [data-k=dec]') || { getAttribute: () => '' }).getAttribute('aria-label'))) err('MTB’s step isn’t 5 km');
    return T.errs.splice(0);
  };
  T.loopSport = async (lens, step) => {
    await wait(300);
    const got = $$('.pl-way .rt-chips .chip:not([data-k=len-other])').map(txt).join(' '), dec = ($('.pl-way [data-k=dec]') || { getAttribute: () => '' }).getAttribute('aria-label');
    const want = lens.split(/(?<=km) /).slice(0, p.sideMQ.matches ? 4 : 3).join(' '); // (three on a phone)
    if (view() !== 'loop' || got !== want || !dec.startsWith(step)) err(`the round trip after a sport change: ${view()}, ${got}, ${dec}`);
    return T.errs.splice(0);
  };
  T.loopBack = async () => {
    click('.pl-way .way-back');
    await until(() => view() === 'ways');
    if (view() !== 'ways' || p.loop.open || p.loopMarker) err(`Back from the round trip: ${view()}, open ${p.loop.open}, the start's marker ${!!p.loopMarker}`);
    return T.errs.splice(0);
  };

  // ---------------------------------------------------------------- Marked routes
  const asked = async () => (await import(location.origin + '/js/net.js')).usage().find((u) => u.id === 'lipas').session;
  T.marked = async () => {
    await T.fresh();
    map.jumpTo({ center: [25.9026, 62.4345], zoom: 13 });
    // the layer off and nothing kept: the list asks LIPAS for the view itself, through request(), and still works
    polku.set({ overlays: { ...polku.state.overlays, lipasRoutes: false } });
    for (const k of [...polku.lipas.tiles.keys()]) polku.lipas.tiles.delete(k);
    await wait(300);
    const n0 = await asked();
    click('.pl-way [data-way=find]');
    await until(() => M().state !== 'loading' && view() === 'find', 8000);
    if (view() !== 'find') return [`Marked routes opened ${view()}`];
    if ((await asked()) <= n0) err('Marked routes didn’t ask LIPAS through request()');
    const off = $('.pl-way .mr-state[data-state=off]');
    if (!off) err('with the layer off: no note that the map doesn’t show them');
    else { off.querySelector('button').click(); await wait(300); }
    if (!polku.state.overlays.lipasRoutes || $('.pl-way .mr-state[data-state=off]')) err('Show them didn’t turn Marked routes on');
    const cards = () => $$('.pl-way .mr-card');
    if (cards().length !== 2) return T.errs.splice(0).concat(`${cards().length} marked routes listed (${M().state}: ${txt(way())})`);
    const names = cards().map((c) => txt(c.querySelector('.mr-name')));
    if (!names.includes('Multamäen MTB-lenkki') || !names.includes('Multamäen pitkä lenkki')) err(`the cards: ${names.join(', ')}`);
    if (!cards()[0].classList.contains('on') || !/Follow this route/.test(txt(cards()[0].querySelector('.loop-use')))) err('the first card isn’t picked with Follow this route');
    if (/\\bRide\\b/.test(txt(way()))) err('Marked routes say Ride (#306)');
    // the sport's row under the top row, as in the ways: it decides what's listed (2026-10-21)
    if (!$('.pl-way .way-bar + .sport-row')) err('Marked routes have no sport row under their top row');
    if (!map.queryRenderedFeatures({ layers: ['lipas-pick'] }).length) err('the picked route doesn’t glow');
    return T.errs.splice(0);
  };
  // the other route's line, tapped on the map: it's picked, and no point goes down
  T.markedSpot = async () => {
    const r = M().list.find((x, i) => i !== M().on);
    if (!r) return null;
    T.other = r.key;
    // both in the map you can see (the list follows the move)
    p.frame(M().list.flatMap((x) => x.parts.flat()).reduce((b, q) => [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])], [180, 90, -180, -90]), { duration: 0, maxZoom: 15 });
    await wait(900);
    await until(() => map.queryRenderedFeatures({ layers: ['lipas-route'] }).some((x) => `${x.properties.type}/${x.properties.lipasId}` === r.key), 5000);
    await settled();
    const f = free();
    for (const c of r.parts) for (let i = 0; i < c.length; i += 3) {
      const q = map.project(c[i]);
      if (q.x > f.left + 20 && q.x < f.right - 20 && q.y > f.top + 20 && q.y < f.bottom - 20 && onMap(q.x, q.y) && map.queryRenderedFeatures([[q.x - 3, q.y - 3], [q.x + 3, q.y + 3]], { layers: ['lipas-route'] }).some((x) => `${x.properties.type}/${x.properties.lipasId}` === r.key)) { T.spotAt = { q, ll: c[i], list: M().state, gen: M().gen }; return { x: q.x, y: q.y }; }
    }
    err('no spot on the other marked route in view');
    return null;
  };
  T.markedTapped = async () => {
    await until(() => M().list[M().on]?.key === T.other, 3000);
    // (and how far the spot had moved by then: the map moving after it was read would put the tap beside the line)
    const moved = () => { const a = T.spotAt, q = a && map.project(a.ll); return q ? `${Math.round(Math.hypot(q.x - a.q.x, q.y - a.q.y))} px` : '?'; };
    const opened = $('.maplibregl-popup') ? 'a map card' : $('.menu-pop') ? `a menu (${txt($('.menu-pop')).slice(0, 40)})` : 'no card or menu';
    // (a list loading at the tap puts the earlier pick back when it comes in: #427)
    const list = !T.spotAt ? '?' : T.spotAt.list === 'loading' ? 'the list still loading when the spot was read' : T.spotAt.gen !== M().gen ? 'the list asked again after the spot was read' : 'the list in';
    if (M().list[M().on]?.key !== T.other) err(`a tap on the other route picked ${M().list[M().on]?.key} (${list}, #427; the spot moved ${moved()}, ${opened}, ${T.sheetNow()})`);
    if (p.points.length) err(`a tap in Marked routes added ${p.points.length} points`);
    return T.errs.splice(0);
  };
  T.markedStates = async () => {
    // LIPAS not answering: said as missing, with Retry, never "none here"
    window.lipasMode = 'fail';
    const L = polku.lipas;
    for (const k of [...L.tiles.keys()]) L.tiles.delete(k);
    (p.listMarked && p.listMarked());
    await until(() => M().state === 'fail', 6000);
    if (!$('.pl-way .mr-state[data-state=fail]') || /No marked routes/.test(txt(way()))) err(`LIPAS not answering: ${txt(way())}`);
    window.lipasMode = 'none';
    click('.pl-way .mr-state[data-state=fail] button');
    await until(() => M().state === 'ok', 6000);
    if (!$('.pl-way .mr-state[data-state=none]') || !/No marked routes for MTB in view/.test(txt(way()))) err(`none in view: ${txt(way())}`);
    window.lipasMode = 'ok';
    for (const k of [...L.tiles.keys()]) L.tiles.delete(k);
    (p.listMarked && p.listMarked());
    await until(() => $$('.pl-way .mr-card').length === 2, 6000);
    return T.errs.splice(0);
  };
  T.swimMarked = async () => {
    await wait(300);
    const s = $('.pl-way .mr-state[data-state=swim]');
    if (view() !== 'find' || !s || !/No marked routes for swimming in LIPAS/.test(txt(s)) || $$('.pl-way .mr-card').length) err(`Swim in Marked routes: ${txt(way())}`);
    return T.errs.splice(0);
  };
  T.follow = async () => {
    const r0 = await routed(), i = M().list.findIndex((x) => /615379$/.test(x.key));
    if (p.pickMarked) p.pickMarked(i);
    await wait(100);
    const b = $('.pl-way .mr-card.on .loop-use');
    if (!b) return ['no Follow this route on the picked card'];
    b.click();
    await until(() => p.legs.length && p.legs.every((l) => l.mode === 'fixed'), 8000);
    if (!p.legs.length || !p.legs.every((l) => l.mode === 'fixed' && l.src) || p.routeName !== 'Multamäen MTB-lenkki') err(`Follow this route: ${p.legs.map((l) => l.mode).join(', ')} (${p.routeName})`);
    if (view() !== null || p.way) err(`after following: ${view()}`);
    if ((await routed()) !== r0) err('following a marked route routed');
    if (!/^Following Multamäen MTB-lenkki/.test(txt($('#toast')))) err(`the note: ${txt($('#toast'))}`);
    await wait(400);
    if (p.wayDepth || history.state?.polkuWay) err('the step’s history stayed after following a route');
    p.undo(); // Undo, not Back: back to no route, and the ways
    await wait(300);
    if (p.points.length || view() !== 'ways') err(`Undo after following: ${p.points.length} points, ${view()}`);
    return T.errs.splice(0).concat(await T.toolsAt(0, 'Undo back to no points'));
  };

  // ---------------------------------------------------------------- round trips from the first point (25b)
  T.loopFirst = async () => {
    await until(() => $('#toast').hidden, 9000); // (Following's note, from before)
    await T.fresh();
    map.jumpTo({ center: [23.80, 61.50], zoom: 12 });
    await new Promise((ok) => map.once('idle', ok));
    p.addPoint([23.80, 61.50]);
    await wait(300);
    T.r0 = await routed();
    return T.at('.pl-way .rt-here .chip');
  };
  T.lengthTapped = async () => {
    await until(() => view() === 'loop');
    const L = p.loop;
    if (view() !== 'loop' || L.km !== 10 || L.results.length || L.busy) err(`the 10 km chip: ${view()}, ${L.km} km, ${L.results.length} loops, busy ${L.busy}`);
    if ((await routed()) !== T.r0) err('a length opened the form with routing calls');
    if (!/From your first point/.test(txt(way()))) err(`the start line: ${txt($('.pl-way .rt-start'))}`);
    T.loopTools('the round trip’s form');
    // (once the sheet has grown to the form: as the view turns, the sheet is still the first point's, and a busy page
    // measured it there, cut by the whole difference every time, #407)
    await settled();
    T.whole('the round trip’s form');
    window.holdRoutes();
    return T.at('.pl-way .rt-make');
  };
  T.making = async () => {
    await until(() => p.loop.busy);
    if (!p.loop.busy || !/Making loops/.test(txt($('.pl-way .rt-make')))) err('Make 3 loops isn’t making them');
    await settled();
    T.start = (p.loop.start || []).slice();
    return T.spot(0.3, 0.3);
  };
  T.madeLoops = async () => {
    await wait(400);
    if (p.points.length !== 1) err(`a tap while the loops were made added ${p.points.length - 1} points (#109)`);
    if (String(p.loop.start) !== T.start.join()) err('a tap while the loops were made moved the start (#109)');
    window.releaseRoutes();
    await until(() => !p.loop.busy && p.loop.results.length, 30000);
    if (p.loop.results.length !== 3) err(`${p.loop.results.length} loops (${p.loop.note})`);
    const cards = $$('.pl-way .loop-card:not(.loop-more)');
    if (cards.length !== 3 || !cards[0].classList.contains('on') || !cards[0].querySelector('.loop-use').offsetParent || cards[1].querySelector('.loop-use').offsetParent) err('the loops’ cards: not three, or Use loop not on the picked one only');
    if (!p.sideMQ.matches && cards.length > 1 && Math.abs(cards[0].getBoundingClientRect().top - cards[1].getBoundingClientRect().top) > 1) err('phone: the loops aren’t side by side');
    T.loopTools('the loops');
    await settled();
    if (p.loop.results.length < 3) return null;
    // a spot on a loop that isn't picked, clear of the others
    const f = free(), k = 2, segs = (c) => c.slice(1).map((b, i) => [map.project(c[i]), map.project(b)]);
    const others = p.loop.results.flatMap((r, i) => (i === k ? [] : segs(r.line.coords)));
    const toSeg = (s, [a, b]) => { const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((s.x - a.x) * dx + (s.y - a.y) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(s.x - a.x - t * dx, s.y - a.y - t * dy); };
    let best = null;
    for (const [a, b] of segs(p.loop.results[k].line.coords)) for (const t of [0.25, 0.5, 0.75]) {
      const s = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (s.x < f.left + 20 || s.x > f.right - 20 || s.y < f.top + 20 || s.y > f.bottom - 20 || !onMap(s.x, s.y)) continue;
      const d = Math.min(...others.map((g) => toSeg(s, g)));
      if (!best || d > best.d) best = { x: s.x, y: s.y, d };
    }
    if (!best || best.d < 20) { err('no spot on loop C clear of the others'); return null; }
    return best;
  };
  T.loopTapped = async () => {
    await until(() => p.loop.on === 2, 3000);
    if (p.loop.on !== 2 || p.loop.results.length !== 3) err(`a tap on loop C's line: picked ${p.loop.on}, ${p.loop.results.length} loops (#89)`);
    if (String(p.loop.start) !== T.start.join()) err('a tap on a loop moved the start');
    if (!$$('.pl-way .loop-card:not(.loop-more)')[2]?.classList.contains('on')) err('loop C’s card isn’t marked');
    return T.at('.pl-way .loop-card.on .loop-use');
  };
  T.loopUsed = async () => {
    await until(() => !p.loop.open);
    if (p.loop.open || p.points.length < 3 || !p.isLoop() || view() !== null) err(`Use loop C: open ${p.loop.open}, ${p.points.length} points, ${view()}`);
    const toast = txt($('#toast'));
    if (!/^Loop C is your route now/.test(toast) || !$('#toast button')) err(`the note after Use loop C: ${toast}`);
    T.errs.push(...(await T.toolsAt(3, 'a loop')));
    p.undo();
    await wait(300);
    if (p.points.length !== 1 || view() !== 'first') err(`Undo after Use loop C: ${p.points.length} points, ${view()}`);
    return T.errs.splice(0);
  };
  // the round trip's form whole on the screen, Make 3 loops on top of it (a shorter window, a side panel with tabs under it)
  T.formWhole = async () => {
    await T.fresh();
    const c = map.getCenter();
    p.addPoint([c.lng, c.lat]);
    await wait(300);
    click('.pl-way .rt-here .chip');
    await wait(300);
    const at = await T.at('.pl-way .rt-make');
    if (!at || !at.clear) err(`${innerWidth} × ${innerHeight}: Make 3 loops is ${at ? `under ${at.over}` : 'not on screen'}`);
    T.whole(`${innerWidth} × ${innerHeight}`);
    p.closeLoop();
    return T.errs.splice(0);
  };
  // a long sport name at 360 px: the steps' top row wraps rather than cutting it
  T.longName = async () => {
    const A = (await import(location.origin + '/js/config.js')).ACTIVITIES, was = A.mtb.label;
    A.mtb.label = 'Maastopyöräily';
    await T.fresh();
    click('.pl-way [data-way=draw]');
    await wait(200);
    const chip = $('.pl-way .sport-chip'), back = $('.pl-way .way-back'), box = way().getBoundingClientRect();
    const out = [chip, back].filter((e) => { const r = e.getBoundingClientRect(); return r.right > box.right + 1 || e.scrollWidth > e.clientWidth + 1; });
    if (out.length || way().scrollWidth > way().clientWidth + 1) err(`a long sport name at ${innerWidth} px: ${out.map((e) => e.className).join(', ') || 'the step overflows'}`);
    A.mtb.label = was;
    history.back();
    await until(() => view() === 'ways');
    return T.errs.splice(0);
  };
  return true;
})()"""


def start(chrome):
    ok = True

    def press(pg, s, name, fails, touch):
        if not s:
            fails.append(f'{name}: not on screen')
            return False
        if not s.get('clear', True):
            fails.append(f"{name}: something is over it ({s.get('over')})")
        if touch:
            pg.quick_tap(s['x'], s['y'])
        else:
            for kind in ('mouseMoved', 'mousePressed', 'mouseReleased'):
                pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': s['x'], 'y': s['y'], 'button': 'none' if kind == 'mouseMoved' else 'left',
                                                      'buttons': 1 if kind == 'mousePressed' else 0, 'clickCount': 1}, pg.s)
        time.sleep(0.5)
        return True

    def journeys(pg, fails, phone):
        P = lambda sel_js, what: press(pg, pg.js(sel_js), what, fails, phone)
        mtb = "(() => { document.querySelector('#activity-bar .act-current').click(); document.querySelector('#activity-bar .act[data-k=mtb]').click(); return true; })()"
        # the ways to begin, and the sport in their header: the pill's own sports, Swim with three ways
        fails += pg.js('stT.ways()', timeout=30000)
        if P("stT.at('.pl-way .sport-chip')", 'the sport chip'):
            m = pg.js('stT.sportMenu()')
            if not m['menu'] or m['items'] != m['pill'] or m['checked'] != 'MTB' or m['expanded'] != 'true':
                fails.append(f'the sport chip’s menu: {m}')
            if m['menu'] and pg.js("stT.pickSport('Swim')"):
                P("stT.at('.menu-pop [data-st-pick]')", 'Swim')
                fails += pg.js("stT.sportIs('swim', 'Swim')")
                fails += pg.js('stT.swimWays()')
        # …and the pill changes the chip
        pg.js(mtb)
        fails += pg.js("stT.sportIs('mtb', 'MTB')")
        # a tap on the map from the ways adds the first point; four points take four taps (#232)
        pg.js("polku.planner.setMode('line'); true")
        for i, (fx, fy) in enumerate([(0.15, 0.2), (0.75, 0.25), (0.8, 0.75), (0.2, 0.7)]):
            P(f'stT.spot({fx}, {fy})', f'map spot {i + 1}')
            fails += pg.js(f'stT.tapAdded({i + 1})', timeout=10000)
        # Draw it, its style before the first leg, Fine-tune, Back and the back gesture
        fails += pg.js('stT.draw()', timeout=30000)
        # a round trip from the ways: Where I am (#281), the sport inside it, Back
        fails += pg.js('stT.roundTrip()', timeout=30000)
        for label, lens, step in (('Hike', '5 km 10 km 15 km 20 km', '1 km'), ('MTB', '10 km 20 km 30 km 50 km', '5 km')):
            if P("stT.at('.pl-way .sport-chip')", 'the round trip’s sport') and pg.js(f"stT.pickSport({json.dumps(label)})"):
                P("stT.at('.menu-pop [data-st-pick]')", label)
                fails += pg.js(f"stT.loopSport({json.dumps(lens)}, {json.dumps(step)})")
        fails += pg.js('stT.loopBack()', timeout=10000)
        # Marked routes: the list (the layer off), a tap on a line, its states, Swim, Follow this route and Undo
        fails += pg.js('stT.marked()', timeout=30000)
        P('stT.markedSpot()', 'the other marked route’s line')
        fails += pg.js('stT.markedTapped()', timeout=10000)
        fails += pg.js('stT.markedStates()', timeout=30000)
        if P("stT.at('.pl-way .sport-chip')", 'Marked routes’ sport') and pg.js("stT.pickSport('Swim')"):
            P("stT.at('.menu-pop [data-st-pick]')", 'Swim')
            fails += pg.js('stT.swimMarked()')
        pg.js(mtb)
        time.sleep(0.6)
        fails += pg.js('stT.follow()', timeout=30000)
        # round trips from the first point: a length opens the form with no calls, Make 3 loops makes three,
        # the map waits meanwhile (#109), a loop's line picks it (#89), Use loop C, then Undo
        P('stT.loopFirst()', 'the 10 km chip')
        P('stT.lengthTapped()', 'Make 3 loops')
        P('stT.making()', 'a map spot while the loops are made')
        P('stT.madeLoops()', 'loop C’s line')
        P('stT.loopTapped()', 'Use loop C')
        fails += pg.js('stT.loopUsed()', timeout=10000)

    for w, h_, phone in [(390, 844, True), (1440, 900, False), (360, 740, True), (1024, 768, False)]:
        name = f'{w}x{h_}'
        fails = []
        pg = chrome.page(w, h_, phone)
        try:
            pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': EMPTY_DEPTHS}, pg.s)
            pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': FIT_ROUTER % (0.002, 0)}, pg.s)
            pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': START_LIPAS}, pg.s)
            pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"', 'polku:winter': '"off"', **LOCAL_BROUTER}, '#13/61.50/23.80')
            pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
            pg.js(START_LIB)
            if w in (360, 1024):  # the ways, the round trip's form, and (on a phone) a long sport name in a step
                fails += pg.js('stT.ways()', timeout=30000)
                fails += pg.js('stT.formWhole()', timeout=30000)
                if phone:
                    fails += pg.js('stT.longName()', timeout=30000)
            else:
                journeys(pg, fails, phone)
            fails += pg.js('stT.errs.splice(0)')
            fails += [f'console: {e[:160]}' for e in pg.errors()]
        finally:
            pg.close()
        print(f"{'ok  ' if not fails else 'FAIL'} the start: ways, Draw it, Round trip, Marked routes ({name})" + ''.join(f'\n     - {f}' for f in fails), flush=True)
        ok = ok and not fails
    return ok

# Done and the route's view (25c, #238): what a tap on the map does in each state, what's on screen, ✕ and its
# note, and the planner opened again as it was left: by Open, Plan, R and a reload.
# A spot on the map with a way under it, clear of the route, the planner and the map's buttons: a tap there shows
# what's there in the route's view, and adds a point while editing.
RV_SPOT = """(() => {
  const map = polku.map, R = map.getCanvas().getBoundingClientRect(), top = document.querySelector('.topbar').getBoundingClientRect().bottom + 30;
  for (let y = top; y < innerHeight - 40; y += 12) for (let x = 30; x < innerWidth - 30; x += 12) {
    const px = [x - R.left, y - R.top];
    if (document.elementFromPoint(x, y) !== map.getCanvas()) continue;
    if (map.queryRenderedFeatures([[px[0] - 40, px[1] - 40], [px[0] + 40, px[1] + 40]], { layers: ['route-casing'] }).length) continue;
    if (map.queryRenderedFeatures(px).some((f) => /^(path|track|cycleway)-|^road-/.test(f.layer.id) && !/label|name|shield/.test(f.layer.id))) return { x, y };
  }
  return null; })()"""
# the middle of the first leg, where nothing is over the line
RV_LINE = """(() => {
  const map = polku.map, p = polku.planner, c = p.legs[0].result.coords, R = map.getCanvas().getBoundingClientRect();
  for (const t of [0.5, 0.4, 0.6, 0.3, 0.7]) {
    const q = map.project([c[0][0] + (c[1][0] - c[0][0]) * t, c[0][1] + (c[1][1] - c[0][1]) * t]), x = R.left + q.x, y = R.top + q.y;
    // (clear of a marker of Check's, drawn on the map: a tap there is the marker's, 25d part 3)
    if (document.elementFromPoint(x, y) === map.getCanvas() && !(p.headAt && p.headAt(q, 24))) return { x, y };
  }
  return null; })()"""
# what's on screen in the route's view, and whether it's what the plan says
RV_VIEW = """(() => {
  const p = polku.planner, el = (e) => !!e && !e.hidden && !!e.offsetParent, out = [];
  const tools = [...p.tools.querySelectorAll('button')].filter(el).map((b) => (b.getAttribute('aria-label') || b.textContent).trim().split(':')[0]);
  const t = p.els.title, x = t.querySelector('.way-x'), tr = t.getBoundingClientRect();
  if (!p.inView()) out.push('not the route’s view');
  if (!el(t)) out.push('no title row');
  else {
    if (p.els.titleName.textContent !== p.routeTitle()) out.push(`its title “${p.els.titleName.textContent}”, not “${p.routeTitle()}”`);
    if (!/Kept on this device/.test(p.els.titleSub.textContent)) out.push(`its line “${p.els.titleSub.textContent}”`);
    if (!el(x)) out.push('no ✕');
  }
  const edit = p.sideMQ.matches ? p.els.toolEdit : p.els.edit, done = p.sideMQ.matches ? p.els.toolDone : p.els.done;
  if (!el(edit) || el(done)) out.push(`Edit ${el(edit) ? 'with' : 'without'} Done${el(done) ? '' : ' gone'}`);
  if (p.ghosts.length) out.push(`${p.ghosts.length} handles on the line`);
  if (p.markers.some((m) => m.isDraggable())) out.push('the markers can be dragged');
  if (!el(p.els.viewNote) && p.panel.dataset.state !== 'peek' && p.tab === 'route') out.push('no “You’re not editing” on Route');
  if (p.els.points.querySelector('.wpl-grip, .wpl-tools, input.wpl-name')) out.push('Route’s list has its controls');
  if (p.map.getCanvas().style.cursor === 'crosshair') out.push('the crosshair');
  return { out, tools, small: [x, edit].filter((b) => el(b) && (b.offsetWidth < 44 || b.offsetHeight < 44) && matchMedia('(pointer: coarse)').matches).map((b) => b.getAttribute('aria-label') || b.textContent.trim()) }; })()"""
# The route's view's header at a small size: the name wraps (never cut), ✕ and Edit a finger's size and on screen, nothing over another
RV_FIT = """(() => {
  const p = polku.planner, r = (e) => e.getBoundingClientRect(), out = [], n = p.els.titleName, x = p.els.title.querySelector('.way-x'), e = p.els.edit, pl = r(p.panel);
  if (n.scrollWidth > n.clientWidth + 1 || getComputedStyle(n).textOverflow === 'ellipsis') out.push('the name is cut');
  for (const [b, k] of [[x, '✕'], [e, 'Edit']]) {
    const a = r(b);
    if (a.width < 44 || a.height < 44) out.push(`${k} ${Math.round(a.width)} × ${Math.round(a.height)} px`);
    if (a.left < 0 || a.right > innerWidth || a.top < 0 || a.bottom > innerHeight) out.push(`${k} off the screen`);
  }
  const nr = r(n), xr = r(x), tr = r(p.els.title); // (the name may scroll in its row: what shows of it is the row's)
  if (nr.right > xr.left && nr.bottom > xr.top && nr.top < xr.bottom) out.push('the name under ✕');
  const sum = [...p.els.sum.querySelectorAll('.sum-item b')].map(r), er = r(e);
  sum.forEach((a, i) => { if (a.right > er.left && a.bottom > er.top && a.top < er.bottom) out.push(`number ${i} under Edit`); if (a.top < tr.bottom - 1) out.push(`number ${i} under the name`); });
  if (pl.top < document.querySelector('.topbar').getBoundingClientRect().bottom) out.push('the sheet under the top bar');
  const sub = r(p.els.titleSub);
  if (sub.top < tr.top - 1 || sub.bottom > tr.bottom + 1) out.push('its sports and Kept on this device out of sight');
  return out; })()"""


def route_view(chrome):
    fails = []

    def page(w, h_, phone, sport='mtb'):
        pg = chrome.page(w, h_, phone)
        pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': EMPTY_DEPTHS}, pg.s)
        pg.open_app({'activity': sport}, {'polku:winter': '"off"', 'polku:plannerDock': '"left"'})
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        return pg

    def press(pg, at, name, touch):
        if not at:
            fails.append(f'{name}: not on screen')
            return False
        if not at.get('clear', True):
            fails.append(f'{name}: something is over it')
        if touch:  # (a finger up after 50 ms by its own times: pg.tap's touchend waits for the page, a hold on a busy one, #405)
            pg.quick_tap(at['x'], at['y'])
        else:
            for kind in ('mouseMoved', 'mousePressed', 'mouseReleased'):
                pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': at['x'], 'y': at['y'], 'button': 'none' if kind == 'mouseMoved' else 'left',
                                                      'buttons': 1 if kind == 'mousePressed' else 0, 'clickCount': 1}, pg.s)
        time.sleep(0.6)
        return True

    def drag(pg, at, touch):
        if touch:
            pg.swipe(at['x'], at['y'], at['y'] - 50, ms=400)
        else:
            pg.c.send('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': at['x'], 'y': at['y'], 'button': 'left', 'buttons': 1, 'clickCount': 1}, pg.s)
            for k in range(1, 9):
                pg.c.send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': at['x'] + k * 6, 'y': at['y'] - k * 6, 'button': 'left', 'buttons': 1}, pg.s)
                time.sleep(0.03)
            pg.c.send('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': at['x'] + 48, 'y': at['y'] - 48, 'button': 'left', 'buttons': 0, 'clickCount': 1}, pg.s)
        time.sleep(0.6)

    def key(pg, k, code, vk):
        for event in ('rawKeyDown', 'char', 'keyUp'):
            fields = {'type': event, 'key': k, 'code': code, 'windowsVirtualKeyCode': vk}
            if event == 'char':
                fields['text'] = k
            chrome.send('Input.dispatchKeyEvent', fields, pg.s)
        time.sleep(0.3)

    # (where it is once the sheet has come to its size: ✕ measured while the planner came back after the note's Open had
    # something over it; settle=False for the note, which goes in 6 s)
    at = lambda pg, sel, settle=True: (settle and pg.js(SETTLED), pg.js(f"({TB_AT})({sel})"))[1]
    state = lambda pg: pg.js("(() => { const p = polku.planner; return { active: p.active, view: p.inView(), n: p.points.length, past: p.past.length, sheet: p.panel.dataset.state, popup: !!document.querySelector('.maplibregl-popup .insp') || ['spot', 'place', 'lipas'].includes(p.cards.current && p.cards.current.kind), card: p.cards.current ? p.cards.current.kind : '', pill: !!document.querySelector('.card-pill, .pl-way.card .btn.primary.big') }; })()")
    shut = lambda pg: pg.js("(() => { for (const b of document.querySelectorAll('.maplibregl-popup-close-button')) b.click(); polku.planner.cards.close(); return true; })()")

    def ready(pg, name):
        if not pg.js(f"({TB_ROUTE})({json.dumps(TB_PTS)})", timeout=60000):
            fails.append(f'{name}: no route')
            return False
        pg.js("polku.planner.fitRoute({ animate: false }); true")
        pg.js(SETTLED)
        time.sleep(0.8)
        return True

    def view_ok(pg, name):
        placed(pg)  # (the route's view's toolbox, a frame after Done)
        v = pg.js(RV_VIEW)
        if v['out'] or v['small']:
            fails.append(f"{name}: {', '.join(v['out'] + [f'under 44 px: {s}' for s in v['small']])}")
        return v

    # ---------------------------------------------------------------- a phone, by touch
    for sport in ('mtb', 'paddle'):
        name, touch = f'390x844 {sport}', True
        pg = page(390, 844, True, sport)
        if not ready(pg, name):
            pg.close()
            continue
        pg.js("polku.planner.setSheetState('peek'); true")
        pg.js(SETTLED)
        s0 = state(pg)
        line0 = pg.js("JSON.stringify(polku.planner.points)")
        press(pg, at(pg, "polku.planner.els.done"), f'{name}: Done', touch)
        v = view_ok(pg, f'{name}: after Done')
        if v['tools'] != ['More']:
            fails.append(f"{name}: the toolbox in the route’s view: {', '.join(v['tools']) or 'nothing'}, not only More")
        if pg.js("document.getElementById('btn-fit').hidden"):
            fails.append(f'{name}: no Show the whole route in the map’s column in the route’s view')
        # a tap on the map shows what's there and adds nothing; on the line, that part's menu
        spot = pg.js(RV_SPOT)
        if not spot:
            fails.append(f'{name}: no way on the map to tap (the tiles?)')
        else:
            press(pg, spot, f'{name}: a way on the map', touch)
            s = state(pg)
            if s['n'] != s0['n'] or not s['popup']:
                fails.append(f"{name}: a tap on the map in the route’s view: {s['n'] - s0['n']} points added, {'its card' if s['popup'] else 'no card'}")
            shut(pg)
        pg.js("polku.planner.fitRoute({ animate: false }); true")  # (the map's card moved the map to keep itself in view)
        time.sleep(0.6)
        press(pg, pg.js(RV_LINE), f'{name}: the line', touch)
        s = state(pg)
        if s['n'] != s0['n'] or s['card'] != 'route' or s['pill']:
            fails.append(f"{name}: a tap on the line in the route’s view: {s['n'] - s0['n']} points added, {s['card'] or 'no'} card{', with Add a point here' if s['pill'] else ''} (25d's 1b)")
        shut(pg)
        # the markers stay put
        drag(pg, at(pg, "polku.planner.markers[1].getElement()"), touch)
        if pg.js("JSON.stringify(polku.planner.points)") != line0:
            fails.append(f'{name}: a marker moved in the route’s view')
        # a tap on a point: its card (25d), and nothing changes; ✕ closes it
        press(pg, at(pg, "polku.planner.markers[1].getElement()"), f'{name}: via 1', touch)
        c = pg.js("({ kind: polku.planner.cards.current && polku.planner.cards.current.kind, view: polku.planner.inView(), past: polku.planner.past.length, pts: JSON.stringify(polku.planner.points) })")
        if c['kind'] != 'point' or not c['view'] or c['past'] != s0['past'] or c['pts'] != line0:
            fails.append(f'{name}: a tap on a point in the route’s view: {c}')
        pg.js(SETTLED)  # (the sheet at the card's size: a tap while it grows lands where ✕ was)
        press(pg, at(pg, "[...document.querySelectorAll('.pl-way.card .way-x')].find((b) => b.getClientRects().length)"), f'{name}: the card’s ✕', touch)
        if pg.js("!!polku.planner.cards.current"):
            fails.append(f'{name}: the point’s card’s ✕ left it open')
        # Edit: the drawing tools are back, with undo as it was; a tap adds a point again
        press(pg, at(pg, "polku.planner.els.edit"), f'{name}: Edit', touch)
        placed(pg)  # (the drawing tools are back in the toolbox a frame later)
        e = pg.js("(() => { const p = polku.planner; return { view: p.inView(), mode: !!p.els.modeBtn.offsetParent, undo: !p.els.undo.disabled && !!p.els.undo.offsetParent, past: p.past.length, done: !!p.els.done.offsetParent, ghosts: p.ghosts.length }; })()")
        if e['view'] or not e['mode'] or not e['undo'] or e['past'] != s0['past'] or not e['done'] or not e['ghosts']:
            fails.append(f'{name}: after Edit: {e} (undo steps before Done: {s0["past"]})')
        if spot:
            press(pg, spot, f'{name}: a way on the map, editing', touch)
            if state(pg)['n'] != s0['n'] + 1:
                fails.append(f'{name}: a tap on the map while editing added {state(pg)["n"] - s0["n"]} points, not 1')
            pg.js("polku.planner.undo(); true")
            time.sleep(0.5)
        # ✕ puts it away with a note; the route stays on the map; Open brings it back as it was
        press(pg, at(pg, "polku.planner.els.done"), f'{name}: Done again', touch)
        press(pg, at(pg, "polku.planner.els.title.querySelector('.way-x')"), f'{name}: ✕', touch)
        pg.js(SETTLED)  # (the planner put away: its note's Open is measured once, then tapped while the note shows)
        c = pg.js("""(() => { const p = polku.planner, t = document.getElementById('toast'), b = t.querySelector('.toast-act'), col = document.getElementById('map-ctrls').getBoundingClientRect();
          return { active: p.active, legs: p.legs.length, drawn: polku.map.queryRenderedFeatures({ layers: ['route-casing'] }).length > 0, text: t.hidden ? '' : t.firstChild.textContent.trim(), open: b && b.textContent,
            h: b ? b.offsetHeight : 0, clear: t.getBoundingClientRect().right <= col.left - 4, plan: !!document.getElementById('btn-plan').offsetParent, fit: !document.getElementById('btn-fit').hidden }; })()""")
        if c['active'] or c['legs'] != s0['n'] - 1 or not c['drawn'] or c['text'] != 'Planner closed · your route stays' or c['open'] != 'Open' or not c['plan'] or not c['fit']:
            fails.append(f'{name}: after ✕: {c}')
        if c['h'] < 44 or not c['clear']:
            fails.append(f"{name}: the note’s Open {c['h']} px tall, {'clear of' if c['clear'] else 'over'} the map’s buttons")
        press(pg, at(pg, "document.querySelector('#toast .toast-act')", False), f'{name}: the note’s Open', touch)
        s = state(pg)
        if not s['active'] or not s['view'] or s['sheet'] != s0['sheet']:
            fails.append(f"{name}: Open: {s} (it was the route’s view at {s0['sheet']})")
        # Plan in the map's column, then a reload: as it was left (#238)
        press(pg, at(pg, "polku.planner.els.title.querySelector('.way-x')"), f'{name}: ✕ again', touch)
        press(pg, at(pg, "document.getElementById('btn-plan')"), f'{name}: Plan', touch)
        if not state(pg)['view']:
            fails.append(f'{name}: Plan opened {state(pg)}, not the route’s view')
        for want in ('view', 'editing', 'closed'):
            if want == 'editing':
                pg.js("polku.planner.setEditing(true); true")
            elif want == 'closed':
                pg.js("polku.planner.done(); polku.planner.close(); true")
            pg.reload()
            pg.js("new Promise((ok) => { const t0 = Date.now(), go = () => polku.planner.points.length || Date.now() - t0 > 20000 ? ok(true) : setTimeout(go, 100); go(); })")
            time.sleep(0.6)
            s = state(pg)
            got = 'closed' if not s['active'] else 'view' if s['view'] else 'editing'
            if got != want or s['n'] != s0['n']:
                fails.append(f"{name}: left {want}, a reload opened it {got} with {s['n']} points (#238)")
        if sport == 'mtb':
            # Clear from the route's view's More: the start, editing; Undo brings the route back
            pg.js("polku.planner.setActive(true); polku.planner.setEditing(false); true")
            pg.js(SETTLED)
            time.sleep(0.4)
            press(pg, at(pg, "polku.planner.els.more"), f'{name}: More', touch)
            if not pg.js("(() => { const b = [...document.querySelectorAll('.menu-pop .menu-item')].find((x) => x.textContent.trim().startsWith('Clear route')); if (b) { b.dataset.rvPick = '1'; b.scrollIntoView({ block: 'nearest' }); } return !!b; })()"):
                fails.append(f"{name}: no Clear route in the route’s view’s More: {pg.js('[...document.querySelectorAll(`.menu-pop .menu-item`)].map((b) => b.textContent.trim())')}")
            press(pg, at(pg, "document.querySelector('.menu-pop [data-rv-pick]')"), f'{name}: Clear route', touch)
            c = pg.js("({ n: polku.planner.points.length, way: polku.planner.startView(), editing: polku.planner.editing, store: JSON.parse(localStorage.getItem('polku:plannerOpen')) })")
            if c['n'] or c['way'] != 'ways' or not c['editing'] or c['store'].get('view'):
                fails.append(f'{name}: Clear in the route’s view: {c}')
            pg.js("polku.planner.undo(); true")
            time.sleep(0.5)
            if state(pg)['n'] != s0['n']:
                fails.append(f'{name}: Undo after Clear: {state(pg)}')
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        pg.close()

    # ---------------------------------------------------------------- a desktop, by mouse and keys
    name, touch = '1440x900', False
    pg = page(1440, 900, False)
    if ready(pg, name):
        s0 = state(pg)
        line0 = pg.js("JSON.stringify(polku.planner.points)")
        press(pg, at(pg, "polku.planner.els.toolDone"), f'{name}: Done', touch)
        v = view_ok(pg, f'{name}: after Done')
        if v['tools'] != ['Show the whole route', 'More', 'Edit']:
            fails.append(f"{name}: the toolbar in the route’s view: {', '.join(v['tools'])}")
        b = pg.js("({ fit: !document.getElementById('btn-fit').hidden, plan: document.getElementById('btn-plan').textContent.trim(), cursor: polku.map.getCanvas().style.cursor })")
        if b['fit'] or b['plan'] != 'Plan route' and b['plan'] != 'Plan':
            fails.append(f'{name}: the map’s column in the route’s view: {b}')
        spot = pg.js(RV_SPOT)
        if spot:
            press(pg, spot, f'{name}: a way on the map', touch)
            s = state(pg)
            if s['n'] != s0['n'] or not s['popup']:
                fails.append(f"{name}: a click on the map in the route’s view: {s['n'] - s0['n']} points added, {'its card' if s['popup'] else 'no card'}")
            shut(pg)
        else:
            fails.append(f'{name}: no way on the map to click (the tiles?)')
        pg.js("polku.planner.fitRoute({ animate: false }); true")
        time.sleep(0.6)
        press(pg, pg.js(RV_LINE), f'{name}: the line', touch)
        if state(pg)['card'] != 'route' or state(pg)['pill']:
            fails.append(f'{name}: a click on the line in the route’s view: {state(pg)}')
        shut(pg)
        drag(pg, at(pg, "polku.planner.markers[1].getElement()"), touch)
        if pg.js("JSON.stringify(polku.planner.points)") != line0:
            fails.append(f'{name}: a marker moved in the route’s view')
        # E: Edit and Done; R closes and opens it as it was
        key(pg, 'e', 'KeyE', 69)
        if pg.js("polku.planner.inView() || !polku.planner.els.modeSeg.offsetParent"):
            fails.append(f'{name}: E didn’t go back to editing')
        key(pg, 'e', 'KeyE', 69)
        if not pg.js("polku.planner.inView()"):
            fails.append(f'{name}: E didn’t end editing')
        key(pg, 'r', 'KeyR', 82)
        key(pg, 'r', 'KeyR', 82)
        if not pg.js("polku.planner.active && polku.planner.inView()"):
            fails.append(f'{name}: R twice: {state(pg)}')
        press(pg, at(pg, "polku.planner.els.title.querySelector('.way-x')"), f'{name}: ✕', touch)
        if pg.js("polku.planner.active") or 'Planner closed' not in pg.js("document.getElementById('toast').textContent"):
            fails.append(f'{name}: ✕: {state(pg)}')
        # a shared route opens in the route's view, to read it first
        url = pg.js("polku.planner.shareUrl()")
        pg.goto(url)
        pg.js("new Promise((ok) => { const t0 = Date.now(), go = () => (window.polku && polku.planner.points.length) || Date.now() - t0 > 20000 ? ok(true) : setTimeout(go, 100); go(); })")
        time.sleep(0.6)
        if not pg.js("polku.planner.active && polku.planner.inView()"):
            fails.append(f'{name}: a share link opened {state(pg)}, not the route’s view')
    fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    pg.close()

    # ---------------------------------------------------------------- small phones: a long name at 360 px and at 200 %
    LONG_NAME = 'Pirkkalan–Lempäälän retkeilyreittien yhdistelmälenkki Vesilahdelta Kangasalan Kirkkoharjulle'
    for w, h_ in ((360, 740), (195, 422)):
        name = f'{w}x{h_}'
        pg = page(w, h_, True)
        if ready(pg, name):
            pg.js(f"(() => {{ const p = polku.planner; p.routeName = {json.dumps(LONG_NAME)}; p.setSheetState('peek'); p.setEditing(false); return true; }})()")
            pg.js(SETTLED)
            view_ok(pg, name)
            out = pg.js(RV_FIT)
            if out:
                fails.append(f"{name}: the route’s view’s header: {', '.join(out)}")
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} Done and the route’s view (25c): taps, ✕ and its note, reopening as left (#238)" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails



# A point's card (25d part 1a, Revision 4 of #355): a tap on a point opens it, in the peek on a phone and at the point
# on a desktop. Straight legs (no routing). Each step is what a person does: a real tap or click on the marker and the
# map, the card's rows, typing a name, the back gesture; the checks read the planner and the card's boxes.
PC_ROUTE = """(async () => {
  const p = polku.planner; p.setActive(true); p.clear(); p.setMode('line');
  for (const q of [[23.800, 61.512], [23.815, 61.5155], [23.830, 61.513], [23.845, 61.5165]]) p.addPoint(q);
  for (let k = 0; k < 100 && !(p.analysis && p.analysis.ele); k++) await new Promise((r) => setTimeout(r, 100));
  p.setSheetState('peek');
  p.fitRoute({ animate: false });
  await new Promise((r) => setTimeout(r, 500));
  return !!p.analysis;
})()"""
# where something is on screen, by a JS expression for the element or a [lng, lat]
PC_AT = """((x) => {
  const el = typeof x === 'string' ? document.querySelector(x) : x;
  if (Array.isArray(el)) { const R = polku.map.getCanvas().getBoundingClientRect(), q = polku.map.project(el); return { x: R.left + q.x, y: R.top + q.y }; }
  if (!el || !el.getClientRects().length) return null;
  // (as a person scrolls the card to it: the card only, never the page, which the app scrolls back at once)
  const c = el.closest && el.closest('.pl-way.card');
  if (c) { const a = el.getBoundingClientRect(), r = c.getBoundingClientRect(); if (a.bottom > r.bottom) c.scrollTop += a.bottom - r.bottom + 4; else if (a.top < r.top) c.scrollTop -= r.top - a.top + 4; }
  const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })"""
# PC_AT once the thing has stayed put: the same place twice in a row, two frames apart, the map still. A card that
# changes size moves the map to keep itself in view a frame or two later, and a press measured before that missed.
PC_STILL = """(async (get) => {
  const at = """ + PC_AT + """, frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let a = at(get()), same = 0;
  for (let k = 0; k < 30 && same < 2; k++) {
    await frames();
    const b = at(get());
    same = a && b && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && !polku.map.isMoving() ? same + 1 : 0;
    a = b;
  }
  return a;
})"""
# the card as it is: what it says, its place, its boxes
# what's over the open card's point on the screen ('' when it's in sight)
PC_OVER = """(() => { const p = polku.planner, k = p.cards.current && p.points.indexOf(p.cards.current.key), m = k >= 0 && p.markers[k];
  if (!m) return 'no marker'; const el = m.getElement().querySelector('.wp'), b = el.getBoundingClientRect(), top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  return !top || el.contains(top) || top.closest('#toast') ? '' : (top.id || top.className.baseVal || top.className || top.tagName); })()"""  # (a note passes)
PC_STATE = """(() => {
  const p = polku.planner, c = document.querySelector('.pl-way.card'), r = (e) => e.getBoundingClientRect(), vis = (e) => !!e && e.getClientRects().length > 0;
  const m = p.cards.current && p.cards.current.key && p.points.indexOf(p.cards.current.key);
  const mk = m >= 0 && p.markers[m] ? r(p.markers[m].getElement()) : null;
  return {
    kind: p.cards.current ? p.cards.current.kind : null, i: m, place: p.cards.place, n: p.points.length, past: p.past.length, view: p.inView(),
    menu: !!document.querySelector('.maplibregl-popup .pt-menu'), fold: document.querySelector('.card-banner [role=status]')?.textContent.trim() || '',
    ringed: p.markers.map((x) => 'card' in x.getElement().dataset).indexOf(true),
    labels: c ? [...c.querySelectorAll('.sum-item small')].map((e) => e.textContent) : [],
    rows: c ? [...c.querySelectorAll('.row b')].map((e) => e.textContent) : [],
    heads: c ? [...c.querySelectorAll('.menu-h')].map((e) => e.textContent) : [],
    chosen: c ? c.querySelector('.seg.icons [role=radio][aria-checked=true]')?.textContent.trim() || '' : '',
    inPanel: !!c && p.panel.contains(c), tools: document.getElementById('pl-tools').hidden,
    undo: vis(p.els.undo) && !p.els.undo.hidden, redo: vis(p.els.redo) && !p.els.redo.hidden, mode: vis(p.els.modeBtn) && !p.els.modeBtn.hidden,
    card: c ? (({ left, top, right, bottom, height, width }) => ({ left, top, right, bottom, height, width }))(r(c.closest('.maplibregl-popup-content') || c)) : null,
    marker: mk ? { x: mk.left + mk.width / 2, y: mk.top + mk.height / 2 } : null,
    title: c ? c.querySelector('.way-hint b')?.textContent : '', back: vis(c && c.querySelector('.way-back')) ? c.querySelector('.way-back').textContent.trim() : '',
    text: c ? c.textContent : '',
  }; })()"""
# Revision 4's look: the app's controls and the cards' new ones only, targets, the title's weight, the labels' size,
# Remove apart and last; a desktop's compact rows with their lines as tooltips
PC_LOOK = """((phone) => {
  const c = document.querySelector('.pl-way.card'), out = [], r = (e) => e.getBoundingClientRect();
  if (!c) return ['no card'];
  // DEVELOPING's "Shared controls", and the cards' new ones (25d's "How every card is built")
  const ok = new Set(['pl-way', 'card', 'way-bar', 'way-back', 'btn', 'small', 'quiet', 'tool', 'way-x', 'way-head', 'way-hint', 'card-mark', 'wp', 'wp-start', 'wp-via', 'wp-end', 'wp-loop',
    'sheet-sum', 'sum-item', 'miss', 'wait', 'menu-h', 'seg', 'icons', 'ic', 'rows', 'row', 'danger', 'val', 'way-chev', 'menu-tick', 'rt-step', 'ring', 'rt-len', 'rt-cost', 'tg', 'tg-text', 'tg-ui',
    'pl-viewnote', 'primary', 'big', 'name-field', 'acts', 'stylebtn', 'way-chips', 'chip', 'way-fold']);
  const extra = new Set([...c.querySelectorAll('[class]')].flatMap((e) => [...e.classList]).filter((k) => !ok.has(k)));
  if (extra.size) out.push(`classes that aren't shared controls: ${[...extra].join(', ')}`);
  // targets: 44 px by touch, 36 px with a mouse (the user, 2026-10-22, #380)
  const least = phone ? 44 : 36;
  for (const b of c.querySelectorAll('button, input:not([type=checkbox]), .tg')) {
    const a = r(b);
    if (a.width && (a.width < least || a.height < least)) out.push(`${(b.textContent.trim() || b.getAttribute('aria-label') || b.tagName).slice(0, 30)} ${Math.round(a.width)} × ${Math.round(a.height)} px`);
  }
  const w = +getComputedStyle(c.querySelector('.way-hint b')).fontWeight;
  if (w > 700) out.push(`the title at weight ${w}`);
  for (const l of c.querySelectorAll('.sum-item small')) if (phone && parseFloat(getComputedStyle(l).fontSize) < 12.5) out.push(`a number's label at ${getComputedStyle(l).fontSize}`);
  for (const b of c.querySelectorAll('.sum-item b')) { const lh = parseFloat(getComputedStyle(b).lineHeight) || 20; if (b.offsetHeight > lh * 1.5) out.push(`“${b.textContent}” on more than one line`); }
  if (/ · /.test(c.textContent)) out.push('facts strung with “ · ”');
  const rows = [...c.querySelectorAll('.row')], rm = rows[rows.length - 1];
  if (!rm || rm.querySelector('b').textContent !== 'Remove' || !rm.classList.contains('danger')) out.push('Remove isn’t the last row, in red');
  else if (rm.parentElement.previousElementSibling?.tagName !== 'HR') out.push('Remove isn’t apart, after a line');
  for (const row of rows) {
    const line = row.querySelector('small');
    if (!row.querySelector('.ic')) out.push(`${row.querySelector('b').textContent}: no icon`);
    if (!line) out.push(`${row.querySelector('b').textContent}: no line under it`);
    if (!phone) {
      if (Math.round(r(row).height) !== 36) out.push(`${row.querySelector('b').textContent} ${Math.round(r(row).height)} px tall, not 36`);
      if (line && line.getClientRects().length) out.push(`${row.querySelector('b').textContent}'s line shows on a desktop`);
      if (line && row.title !== line.textContent) out.push(`${row.querySelector('b').textContent}'s tooltip isn't its line`);
    }
  }
  if (!phone) {
    // Revision 5: 320 px wide, 480 px tall at most; the edits as buttons, two a row, Start here and End here first; no
    // heading above them; Remove a red button on a row of its own
    const box = r(c.closest('.maplibregl-popup-content') || c);
    if (Math.round(r(c).width) !== 320 || box.height > 480 + 20) out.push(`the desktop card ${Math.round(r(c).width)} × ${Math.round(box.height)} px, not 320 wide and 480 tall at most`);
    const edits = [...c.querySelectorAll('.rows.acts')].find((l) => l.querySelector('[data-k=move]'));
    if (edits) {
      const b = [...edits.children].filter((x) => x.getClientRects().length).map((x) => ({ k: x.dataset.k, top: Math.round(r(x).top) }));
      const rowsOf = [...new Set(b.map((x) => x.top))].sort((x, y) => x - y).map((t) => b.filter((x) => x.top === t).map((x) => x.k).join('+'));
      const want = c.querySelector('[data-k=end]') ? ['start+end', 'move+rename'] : c.querySelector('[data-k=start]') ? ['start+move', 'rename'] : ['move+rename'];
      if (rowsOf.join(' / ') !== want.join(' / ')) out.push(`the edits as buttons: ${rowsOf.join(' / ')}, not ${want.join(' / ')}`);
      if (edits.previousElementSibling?.getClientRects().length) out.push('a heading above the edit buttons');
    }
    const rmb = c.querySelector('[data-k=remove]');
    if (rmb && (Math.abs(r(rmb).width - r(rmb.parentElement).width) > 1 || getComputedStyle(rmb).borderTopColor === getComputedStyle(c).color)) out.push('Remove isn’t a red button on a row of its own');
  }
  return out; })"""
# no "…", nothing past the card's edges; narrow: undo, redo and ✕ in a row of their own above the title, numbers one to a row
PC_FIT = """((narrow) => {
  const c = document.querySelector('.pl-way.card'), out = [], r = (e) => e.getBoundingClientRect(), vis = (e) => !!e && e.getClientRects().length > 0;
  if (!c) return ['no card'];
  const cr = r(c);
  if (/…/.test(c.textContent)) out.push('“…” in the card');
  for (const e of c.querySelectorAll('*')) {
    const a = r(e);
    if (a.width && getComputedStyle(e).display !== 'none' && (a.right > cr.right + 1 || a.left < cr.left - 11)) out.push(`${e.tagName.toLowerCase()}.${e.className} past the card's edge`);
    if (getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) out.push(`${e.tagName.toLowerCase()} cut`);
  }
  if (narrow) {
    const bar = c.querySelector(':scope > .way-bar'), t = r(c.querySelector('.way-hint'));
    for (const k of ['[data-k=undo]', '[data-k=redo]', '.way-x']) { const b = bar && bar.querySelector(k); if (!vis(b)) out.push(`no ${k} in the top row`); else if (r(b).bottom > t.top + 1) out.push(`${k} beside the title, not above it`); }
    if (vis(c.querySelector(':scope > .way-head > .way-x'))) out.push('a second ✕ beside the title');
    const n = [...c.querySelectorAll('.sum-item')].map(r);
    if (n.some((a, k) => k && a.top < n[k - 1].bottom - 1)) out.push('the numbers aren’t one to a row');
    if (t.width < 0.9 * cr.width - 20) out.push(`the title ${Math.round(t.width)} px of the card's ${Math.round(cr.width)}`);
  }
  return out; })"""


def point_card(chrome):
    fails = []

    trail = []  # (the last presses, said when a step raises)

    def press(pg, at, name, touch):
        trail.append(name)
        if not at:
            fails.append(f'{name}: not on screen')
            return False
        if touch:  # (a finger up after 50 ms by its own times, as in routeview, #405)
            pg.quick_tap(at['x'], at['y'])
        else:
            for kind in ('mouseMoved', 'mousePressed', 'mouseReleased'):
                pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': at['x'], 'y': at['y'], 'button': 'none' if kind == 'mouseMoved' else 'left',
                                                      'buttons': 1 if kind == 'mousePressed' else 0, 'clickCount': 1}, pg.s)
        time.sleep(0.5)
        return True

    def key(pg, k, code, vk, text=None):
        for event in ('rawKeyDown', 'char', 'keyUp'):
            if event == 'char' and text is None:
                continue
            fields = {'type': event, 'key': k, 'code': code, 'windowsVirtualKeyCode': vk}
            if event == 'char':
                fields['text'] = text
            chrome.send('Input.dispatchKeyEvent', fields, pg.s)
        time.sleep(0.3)

    # (where it is once the route's numbers are in, the sheet has come to its size and the thing has stayed put: the card
    # is built again when the numbers come, and a click that went down on the old card and up on the new one was lost;
    # a tap measured while the sheet grew, or before the map moved to keep the card in view, landed where it had been)
    at = lambda pg, x: (pg.js("Promise.resolve(polku.planner.analysing).then(() => true, () => true)"), pg.js(SETTLED), pg.js(f"({PC_STILL})(() => ({x}))"))[2]
    st = lambda pg: pg.js(PC_STATE)
    # a row by its name, a switch's choice by its word, a button by its words or label
    row = lambda label: f"[...document.querySelectorAll('.pl-way.card .row')].find((b) => b.querySelector('b').textContent === {json.dumps(label)})"
    seg = lambda label: f"[...document.querySelectorAll('.pl-way.card .seg.icons button')].find((b) => b.textContent.trim() === {json.dumps(label)})"
    def tap_row(pg, label, name, touch):
        a = at(pg, row(label))
        over = a and pg.js(f"(() => {{ const r = {row(label)}, t = document.elementFromPoint({a['x']}, {a['y']}); return !t || r.contains(t) ? '' : (t.id || t.className.baseVal || t.className || t.tagName); }})()")
        if over:
            fails.append(f'{name}: {label} is under {over}')
        return press(pg, a, f'{name}: {label}', touch)
    tap_seg = lambda pg, label, name, touch: press(pg, at(pg, seg(label)), f'{name}: {label}', touch)

    def page(w, h_, phone):
        pg = chrome.page(w, h_, phone)
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"', 'polku:plannerDock': '"left"'}, '#13/61.514/23.822')
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        if not pg.js(PC_ROUTE, timeout=30000):
            fails.append(f'{w}x{h_}: no route')
        pg.js(SETTLED)
        return pg

    def tap_marker(pg, i, name, touch):
        # where the point is under the toolbox, a button, a note or the card, the map moves to it first, as a person moves it
        # (looked at once the sheet and the toolbox are in place, as at() does)
        placed(pg)
        cov = pg.js(f"""(async () => {{ const p = polku.planner, m = p.markers[{i}]; if (!m) return false; const el = m.getElement().querySelector('.wp');
          const clear = () => {{ const b = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)); }};
          if (clear()) return true;
          const v = p.viewPadding(0), you = {{ originalEvent: new Event('pointermove') }}; // (moved as a person moves it: the open card's own look stops)
          p.map.jumpTo({{ center: p.points[{i}], offset: [(v.left - v.right) / 2, (v.top - v.bottom) / 2] }}, you);
          for (const d of [[0, 0], [0, -80], [0, 160], [0, 80], [-80, -160], [160, 0]]) {{ if (d[0] || d[1]) p.map.panBy(d, {{ duration: 0 }}, you); await new Promise((r) => setTimeout(r, 60)); if (clear()) return true; }}
          const b = el.getBoundingClientRect(), t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return 'under ' + (t ? t.id || t.className.baseVal || t.className || t.tagName : 'nothing') + ' at ' + Math.round(b.left) + ',' + Math.round(b.top); }})()""")
        if isinstance(cov, str):
            fails.append(f'{name}: point {i} is {cov}')
        time.sleep(0.3)
        if not press(pg, at(pg, f"polku.planner.markers[{i}]?.getElement().querySelector('.wp')"), f'{name}: point {i} of {pg.js("polku.planner.points.length")}', touch):
            return st(pg)
        return st(pg)

    # a spot on the map the card and the planner leave free, dy px above and dx px beside a point
    def free_spot(pg, i, dx, dy):
        return pg.js(f"""(() => {{ const p = polku.planner, R = polku.map.getCanvas().getBoundingClientRect(), q = polku.map.project(p.points[{i}]);
          const x = Math.round(R.left + q.x + {dx}), y = Math.round(R.top + q.y + {dy}), el = document.elementFromPoint(x, y);
          const top = document.querySelector('.topbar').getBoundingClientRect().bottom + 30, bottom = (p.layout() === 'side' ? innerHeight : Math.min(p.panel.getBoundingClientRect().top, innerHeight)) - 30;
          return el === polku.map.getCanvas() && x >= 40 && x <= innerWidth - 80 && y >= top && y <= bottom ? {{ x, y }} : null; }})()""")
    def spot_near(pg, i):
        placed(pg)  # (the toolbox drawn again after Move covered a spot, #390)
        return next((x for x in (free_spot(pg, i, dx, dy) for dx, dy in ((-120, -160), (120, -160), (0, -200), (160, 120), (-160, 120), (200, 0), (-200, 0), (-60, -90), (60, -90))) if x), None)

    def one_size(pg, w, h_, phone, name, touch):
        nonlocal fails
        s = tap_marker(pg, 1, name, touch)
        if s['kind'] != 'point' or s['i'] != 1 or s['menu']:
            fails.append(f"{name}: a tap on via 1: {s['kind'] or 'no'} card for point {s['i']}{', and the old menu' if s['menu'] else ''}")
            pg.close()
            return
        if s['labels'] != ['there at', 'from the start', 'height']:
            fails.append(f"{name}: the card's numbers say {s['labels']}")
        # (the stretch it's on runs to the next point you see: here the end, as the vias only shape the line, 25d's 1b)
        if f"Next stretch, to {pg.js('polku.planner.nameOf(polku.planner.points.length - 1)')}" not in s['rows']:
            fails.append(f"{name}: via 1's row to the stretch after it: {s['rows']}")
        if s['title'] != 'Via 1' or 'Via 1Via 1' in s['text']:
            fails.append(f"{name}: an unnamed via point's card says “{s['title']}”{', and Via 1 twice' if 'Via 1Via 1' in s['text'] else ''}")
        if s['heads'] != ['At this point', 'Edit this point']:
            fails.append(f"{name}: via 1's groups are {s['heads']}")
        if s['back'] or s['chosen'] != 'Pass by' or s['ringed'] != 1:
            fails.append(f"{name}: from the map: Back “{s['back']}”, the switch at “{s['chosen']}”, the ring on point {s['ringed']}")
        if 'The part before it is removed' not in s['text'] or 'The part after it is removed' not in s['text']:
            fails.append(f'{name}: Start here and End here don’t say what they remove')
        if phone:
            if not s['inPanel'] or s['place'] != 'peek' or s['tools'] or not s['undo'] or not s['redo'] or s['mode']:
                fails.append(f"{name}: the card {'in' if s['inPanel'] else 'not in'} the peek; the toolbox {'hidden' if s['tools'] else 'there'}, undo {s['undo']}, redo {s['redo']}, the drawing button {s['mode']}")
            if s['card']['height'] > h_ * 0.52 + 1:
                fails.append(f"{name}: the card {round(s['card']['height'])} px tall, more than 52 % of the window")
            m = s['marker']
            if not m or m['y'] >= s['card']['top'] or m['y'] < 0 or m['x'] < 0 or m['x'] > w:
                fails.append(f"{name}: the point at {m}, not in sight above the card at {round(s['card']['top'])} px")
            over = pg.js(PC_OVER)
            if over:
                fails.append(f'{name}: the point is under {over}')
        else:
            c, m = s['card'], s['marker']
            corner = min(((x - m['x']) ** 2 + (y - m['y']) ** 2) ** 0.5 for x in (c['left'], c['right']) for y in (c['top'], c['bottom']))
            if s['place'] != 'float' or corner > 30:
                fails.append(f"{name}: the card {s['place']}, its nearest corner {round(corner)} px from the point")
        fails += [f'{name}: {o}' for o in pg.js(f"({PC_LOOK})({json.dumps(phone)})")]
        if not phone:
            # (via 1 only shapes the line: the row it folds into, its stretch's, is lit; 25d's part 4)
            lit = pg.js("[...document.querySelectorAll('.wpl [aria-current=true]')].map((r) => r.dataset.i ?? `s${r.dataset.from}-${r.dataset.to}`)")
            if lit != ['s0-3']:
                fails.append(f'{name}: the rows lit in the list while via 1’s card is open: {lit}')
        # a tap on the card's words, not a row: the card stays, and so does the sheet's size
        if phone:
            sheet0 = pg.js("polku.planner.panel.dataset.state")
            press(pg, at(pg, "'.pl-way.card .sheet-sum'"), f'{name}: the card’s numbers', touch)
            r = pg.js("({ kind: polku.planner.cards.current && polku.planner.cards.current.kind, sheet: polku.planner.panel.dataset.state })")
            if r['kind'] != 'point' or r['sheet'] != sheet0:
                fails.append(f"{name}: a tap on the card’s numbers: card {r['kind'] or 'closed'}, the sheet {sheet0} → {r['sheet']}")
        # Stop: its minutes, one step of Undo; + adds 5, one more step; the switch shows what's in force
        past = s['past']
        tap_seg(pg, 'Stop', name, touch)
        r = pg.js("({ min: polku.planner.stopAt(1) && polku.planner.stopAt(1).min, past: polku.planner.past.length })")
        s = st(pg)
        if r['min'] != 30 or r['past'] != past + 1 or s['kind'] != 'point' or s['chosen'] != 'Stop' or 'You get here at' not in s['text']:
            fails.append(f"{name}: Stop: {r}, the switch at “{s['chosen']}”, the card {s['kind']}")
        press(pg, at(pg, "document.querySelector('.pl-way.card .rt-step [aria-label=\"5 minutes more\"]')"), f'{name}: 5 minutes more', touch)
        r = pg.js("({ min: polku.planner.stopAt(1) && polku.planner.stopAt(1).min, past: polku.planner.past.length })")
        if r['min'] != 35 or r['past'] != past + 2:
            fails.append(f'{name}: the stop’s +: {r}')
        # Undo, twice: the card follows its point back
        pg.js("polku.planner.undo(); polku.planner.undo(); true")
        time.sleep(0.3)
        s = st(pg)
        if s['kind'] != 'point' or s['chosen'] != 'Pass by':
            fails.append(f"{name}: Undo of the stop: card {s['kind']}, the switch at “{s['chosen']}”")
        tap_seg(pg, 'Night', name, touch)
        if not pg.js("(async () => (await import(location.origin + '/js/stops.js')).isNight(polku.planner.stopAt(1)))()") or 'Places to sleep nearby' not in st(pg)['rows']:
            fails.append(f"{name}: Night: {pg.js('JSON.stringify(polku.planner.stopAt(1))')}, rows {st(pg)['rows']}")
        # Go on at: the phone's own clock over its row (#364's C; the leave group taps it); 06:00, and the card stays
        if pg.js("[...document.querySelectorAll('.pl-way.card .row.pick')].find((x) => x.querySelector('b').textContent === 'Go on at')?.querySelector('input')?.type") != 'time':
            fails.append(f"{name}: Go on at: {st(pg)['rows']}")
        else:
            pg.js("(() => { const i = [...document.querySelectorAll('.pl-way.card .row.pick')].find((x) => x.querySelector('b').textContent === 'Go on at').querySelector('input'); i.value = '06:00'; i.dispatchEvent(new Event('change', { bubbles: true })); return true; })()")
            time.sleep(0.4)
            r = pg.js("({ on: polku.planner.stopAt(1) && polku.planner.stopAt(1).on, kind: polku.planner.cards.current && polku.planner.cards.current.kind, shown: [...document.querySelectorAll('.pl-way.card .row.pick')].find((x) => x.querySelector('b').textContent === 'Go on at')?.querySelector('.val').textContent })")
            if r['on'] != 360 or r['kind'] != 'point' or r['shown'] != '06:00':
                fails.append(f'{name}: Go on at 06:00: {r}')
            pg.js("polku.planner.undo(); true")
        pg.js("polku.planner.undo(); true")
        time.sleep(0.3)
        # Sport from here ›: its card, with Back in words; Paddle changes legs 1 and 2, not leg 0, in one step of Undo
        past = st(pg)['past']
        mode0 = pg.js("polku.planner.legs[0].mode")
        tap_row(pg, 'Sport from here', name, touch)
        s = st(pg)
        if s['kind'] != 'sport' or s['back'] != pg.js("polku.planner.nameOf(1)"):
            fails.append(f"{name}: Sport from here ›: {s['kind']} card, its Back says “{s['back']}”, not the point’s name")
        tap_row(pg, 'Paddle', name, touch)
        time.sleep(0.4)
        r = pg.js("(() => { const p = polku.planner; return { sports: [0, 1, 2].map((i) => p.legSport(i)).join(), change: !!p.changeAt(1), modes: p.legs.map((l) => l.mode), past: p.past.length, kind: p.cards.current && p.cards.current.kind }; })()")
        if r['sports'] != 'mtb,paddle,paddle' or not r['change'] or 'auto' in r['modes'][1:] or r['modes'][0] != mode0 or r['past'] != past + 1 or r['kind'] != 'sport':
            fails.append(f'{name}: Sport from here → Paddle on via 1: {r} (leg 0 was {mode0})')
        # Paddle has its crafts under it, and the card stays at them; a tap on Canoe is the route's craft; Back to the point
        craft0 = pg.js("polku.planner.craft")
        chips = pg.js("[...document.querySelectorAll('.pl-way.card .way-chips .chip')].map((b) => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : ''))")
        if [c.rstrip('*') for c in chips] != ['Sea kayak', 'Canoe', 'SUP'] or sum(c.endswith('*') for c in chips) != 1:
            fails.append(f'{name}: Paddle’s crafts: {chips}')
        press(pg, at(pg, "[...document.querySelectorAll('.pl-way.card .way-chips .chip')].find((b) => b.textContent.trim() === 'Canoe')"), f'{name}: Canoe', touch)
        r = pg.js("({ craft: polku.planner.craft, pressed: document.querySelector('.pl-way.card .way-chips .chip[aria-pressed=true]')?.textContent.trim(), kind: polku.planner.cards.current && polku.planner.cards.current.kind })")
        if r['craft'] != 'canoe' or r['pressed'] != 'Canoe' or r['kind'] != 'sport':
            fails.append(f'{name}: Canoe: {r}')
        pg.js(f"polku.planner.setCraft({json.dumps(craft0)}); true")
        press(pg, at(pg, "document.querySelector('.pl-way.card .way-back')"), f'{name}: Back from the sports', touch)
        if st(pg)['kind'] != 'point':
            fails.append(f"{name}: Back from the sports: {st(pg)['kind']} card")
        s = st(pg)
        if 'Changeover' not in s['text'] or 'Take the bike along' not in s['text']:
            fails.append(f'{name}: a change of sport: no changeover minutes or Take the bike along')
        pg.js("polku.planner.undo(); true")
        time.sleep(0.4)
        # Move: a banner under the top bar, the point ringed; a tap 200 px away moves it there; one step of Undo; Escape cancels
        if st(pg)['kind'] != 'point':
            tap_marker(pg, 1, name, touch)
        past = st(pg)['past']
        tap_row(pg, 'Move', name, touch)
        s = st(pg)
        if s['fold'] not in ('Tap where it goes', 'Click where it goes') or s['ringed'] != 1 or s['inPanel']:
            fails.append(f"{name}: Move: the banner says “{s['fold']}”, the ring on point {s['ringed']}, the card {'still in the peek' if s['inPanel'] else 'aside'}")
        spot = spot_near(pg, 1)
        if not spot:
            fails.append(f'{name}: Move: no free spot on the map to tap')
        else:
            ll = pg.js(f"(() => {{ const R = polku.map.getCanvas().getBoundingClientRect(), q = polku.map.unproject([{spot['x']} - R.left, {spot['y']} - R.top]); return [q.lng, q.lat]; }})()")
            press(pg, spot, f'{name}: the spot to move to', touch)
            r = pg.js(f"(() => {{ const p = polku.planner, ll = {{ lng: {ll[0]}, lat: {ll[1]} }}; return {{ d: Math.max(Math.abs(p.points[1][0] - ll.lng), Math.abs(p.points[1][1] - ll.lat)), past: p.past.length, n: p.points.length, kind: p.cards.current && p.cards.current.kind, fold: !!document.querySelector('.card-banner') }}; }})()")
            if r['d'] > 1e-5 or r['past'] != past + 1 or r['n'] != 4 or r['kind'] != 'point' or r['fold']:
                fails.append(f'{name}: Move, then a tap: {r}')
        pos = pg.js("JSON.stringify(polku.planner.points)")
        tap_row(pg, 'Move', name, touch)
        key(pg, 'Escape', 'Escape', 27)
        if st(pg)['fold'] or st(pg)['kind'] != 'point':
            fails.append(f"{name}: Escape while moving: {st(pg)['fold'] or 'unfolded'}, card {st(pg)['kind']}")
        spot2 = spot_near(pg, 1)
        if spot2:
            press(pg, spot2, f'{name}: a tap after Move was cancelled', touch)
            if pg.js("JSON.stringify(polku.planner.points)") != pos:
                fails.append(f'{name}: a tap after Escape still moved the point')
        # a tap on the map with the card open: it closes, and adds nothing
        if not st(pg)['kind']:
            tap_marker(pg, 1, name, touch)
        n0 = st(pg)['n']
        spot3 = spot_near(pg, 1)
        if spot3:
            press(pg, spot3, f'{name}: a tap beside the card', touch)
            s = st(pg)
            if s['kind'] or s['n'] != n0:
                fails.append(f"{name}: a tap on the map with the card open: card {s['kind'] or 'closed'}, {s['n'] - n0} points added")
            if phone and (s['tools'] or not s['mode']):
                fails.append(f'{name}: the toolbox didn’t come back after the card closed')
        # Rename: the name typed where it's shown; Enter keeps it; Save too
        tap_marker(pg, 1, name, touch)
        tap_row(pg, 'Rename', name, touch)
        if not pg.js("document.activeElement && document.activeElement.classList.contains('name-field')"):
            fails.append(f'{name}: Rename: no name to type')
        else:
            chrome.send('Input.insertText', {'text': 'Kahvila'}, pg.s)
            key(pg, 'Enter', 'Enter', 13, '\r')
            r = pg.js("({ name: polku.planner.nameOf(1), title: document.querySelector('.pl-way.card .way-hint b')?.textContent })")
            if r['name'] != 'Kahvila' or r['title'] != 'Kahvila':
                fails.append(f'{name}: Rename “Kahvila”, Enter: {r}')
            tap_row(pg, 'Rename', name, touch)
            pg.js("(() => { const f = document.querySelector('.name-field'); f.value = 'Laavu'; return true; })()")
            press(pg, at(pg, "[...document.querySelectorAll('.pl-way.card .way-head .btn.primary')].find((b) => b.textContent === 'Save')"), f'{name}: Save', touch)
            if pg.js("polku.planner.nameOf(1)") != 'Laavu':
                fails.append(f"{name}: Rename, Save: {pg.js('polku.planner.nameOf(1)')}")
        # the back gesture closes it
        pg.js("history.back(); true")
        time.sleep(0.5)
        if st(pg)['kind']:
            fails.append(f'{name}: the back gesture left the card open')
        # closed and another opened at once, three times (a quick ✕ and a tap): one step of history, the page stays
        href = pg.js("location.href.split('#')[0]")
        pg.js("(() => { const p = polku.planner; for (let k = 0; k < 3; k++) { p.openPointCard(p.points[1 + (k % 2)]); p.cards.close(); } p.openPointCard(p.points[2]); return true; })()")
        time.sleep(0.6)
        pg.js("history.back(); true")
        time.sleep(0.6)
        r = pg.js("({ href: location.href.split('#')[0], kind: polku.planner.cards.current && polku.planner.cards.current.kind, n: polku.planner.points.length })")
        if r['href'] != href or r['kind'] or r['n'] != 4:
            fails.append(f'{name}: cards closed and opened at once, then the back gesture: {r}')
        # the start: you leave, and Leave › (the leave group tries its picker); the end: Back to start; a loop's end has none,
        # its via points no End here
        s = tap_marker(pg, 0, name, touch)
        if s['labels'][:1] != ['you leave'] or 'Leave' not in s['rows'] or 'Reverse' not in s['rows'] or 'The route' not in s['heads'] or 'Start here' in s['rows'] or 'At this point' in s['heads']:
            fails.append(f"{name}: the start's card: {s['labels']}, {s['rows']}, {s['heads']}")
        r = pg.js("""(async () => { const p = polku.planner, at = (Math.floor(Date.now() / 3600000) + 3) * 3600, d = new Date(at * 1000), z = (x) => String(x).padStart(2, '0'), i = document.querySelector('.pl-way.card .row.pick input');
          if (!i) return { field: false };
          i.value = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; i.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise((ok) => setTimeout(ok, 400));
          return { field: true, off: p.startSec() - new Date(i.value).getTime() / 1000, kind: p.cards.current && p.cards.current.kind }; })()""")  # (what the field says: on the night the clocks go back, 03:30 is twice)
        if not r['field'] or r['off'] != 0 or r['kind'] != 'point':
            fails.append(f"{name}: Leave in three hours: {r}")
        pg.js("polku.planner.setLeave(null); polku.planner.cards.close(); true")
        s = tap_marker(pg, 3, name, touch)
        if 'Back to start' not in s['rows'] or 'Reverse' not in s['rows'] or 'Start here' in s['rows'] or 'Sport from here' in s['rows']:
            fails.append(f"{name}: the end's card: {s['rows']}")
        # Reverse: the route the other way, one step of Undo, its note with Undo; the card follows its point (now the start)
        before = pg.js("({ pts: JSON.stringify(polku.planner.points), past: polku.planner.past.length })")
        tap_row(pg, 'Reverse', name, touch)
        r = pg.js("(() => { const p = polku.planner; return { first: JSON.stringify(p.points[0]), past: p.past.length, i: p.cards.current ? p.points.indexOf(p.cards.current.key) : null, note: document.getElementById('toast').textContent }; })()")
        if r['first'] != json.dumps(json.loads(before['pts'])[-1], separators=(',', ':')) or r['past'] != before['past'] + 1 or r['i'] != 0 or 'other way' not in r['note']:
            fails.append(f'{name}: Reverse on the end: {r}')
        pg.js("polku.planner.undo(); polku.planner.cards.close(); true")
        time.sleep(0.4)
        s = tap_marker(pg, 3, name, touch)
        tap_row(pg, 'Back to start', name, touch)
        time.sleep(0.4)
        # (the loop's end and its start are one spot on the map: the end's card, opened as the list opens it)
        pg.js("(() => { const p = polku.planner; p.openPointCard(p.points[4], { from: 'list' }); return true; })()")
        time.sleep(0.4)
        s = st(pg)
        if s['kind'] != 'point' or 'Back to start' in s['rows'] or 'Reverse' not in s['rows']:
            fails.append(f"{name}: a loop's end: {s['kind']} card, {s['rows']}")
        s = tap_marker(pg, 2, name, touch)
        if 'End here' in s['rows'] or 'The same loop, starting from this point' not in s['text']:
            fails.append(f"{name}: a loop's via point: {s['rows']}")
        # #352's review, 3: a loop's start (its end at the same spot), a stop at via 1, Undo: the start's card stays
        pg.js("(() => { const p = polku.planner; p.cards.close(); p.openPointCard(p.points[0]); p.setStop(1, { min: 30 }); p.undo(); return true; })()")
        time.sleep(0.3)
        r = pg.js("({ kind: polku.planner.cards.current && polku.planner.cards.current.kind, i: polku.planner.cards.current ? polku.planner.points.indexOf(polku.planner.cards.current.key) : null })")
        if r['kind'] != 'point' or r['i'] != 0:
            fails.append(f"{name}: a loop's start, a stop elsewhere, Undo: {r}, not the start's card")
        # 2: the end's card, then Undo of Back to start: the end is gone, so is its card (not the start's in its place)
        pg.js("(() => { const p = polku.planner; p.cards.close(); p.openPointCard(p.points[4]); p.undo(); return true; })()")
        time.sleep(0.3)
        if st(pg)['kind']:
            fails.append(f"{name}: Undo of Back to start with the end's card open: a {st(pg)['kind']} card for point {st(pg)['i']}")
        pg.js("polku.planner.cards.close(); true")
        time.sleep(0.4)
        # Undo of the point's own adding, at once, closes its card, with no error from the other ways' timer (#351)
        pg.js("(() => { const p = polku.planner; p.addPoint([23.86, 61.515]); p.openPointCard(p.points[4]); p.undo(); return true; })()")
        time.sleep(0.4)
        if st(pg)['kind']:
            fails.append(f'{name}: Undo of a point’s adding left its card open')
        # Remove, then the note's Undo
        tap_marker(pg, 1, name, touch)
        tap_row(pg, 'Remove', name, touch)
        pg.js(SETTLED)  # (the note goes in 7 s: its Undo is measured once the sheet has settled, and tapped at once)
        n1, note = st(pg)['n'], pg.js("document.getElementById('toast').textContent")
        press(pg, pg.js(f"({PC_AT})('#toast .toast-act')"), f'{name}: Undo in the note', touch)
        if n1 != 3 or st(pg)['n'] != 4 or 'removed' not in note:
            fails.append(f"{name}: Remove: {n1} points, the note “{note}”, its Undo: {st(pg)['n']}")
        # Remove just as the note before runs out: Remove's note stays, with its Undo (the note before's end hid it, #381).
        # A tap can't land in the same turn as that end, so Remove is a click on the row there.
        tap_marker(pg, 1, name, touch)
        note = pg.js(f"""(async () => {{ const {{ toast }} = await import(location.origin + '/js/ui.js'), t = document.getElementById('toast'), r = {row('Remove')};
          if (!r) return 'no Remove in the card';
          toast('A note before', {{ ms: 300 }});
          const ended = await new Promise((ok) => {{ const o = new MutationObserver(() => {{ if (!t.classList.contains('show')) {{ o.disconnect(); r.click(); ok(true); }} }});
            o.observe(t, {{ attributes: true, attributeFilter: ['class'] }}); setTimeout(() => {{ o.disconnect(); ok(false); }}, 5000); }});
          if (!ended) return 'the note before didn’t end';
          await new Promise((ok) => setTimeout(ok, 400)); // (past the note before's 250 ms to fade: a timer set after it runs after it)
          return t.hidden || !t.classList.contains('show') ? 'hidden' : t.textContent; }})()""")
        n1 = st(pg)['n']
        pg.js(SETTLED)
        pressed = 'removed' in note and press(pg, pg.js(f"({PC_AT})('#toast .toast-act')"), f'{name}: Undo in the note that came as the one before ended', touch)
        if n1 != 3 or not pressed or st(pg)['n'] != 4:
            fails.append(f"{name}: Remove as the note before ended: {n1} points, the note {note}, its Undo: {st(pg)['n']} points")
            if st(pg)['n'] != 4:
                pg.js("polku.planner.undo(); true")  # (the route as the next steps want it)
                time.sleep(0.3)
        # #352's review, 1: a place to sleep (a stand-in list; LIPAS and OpenStreetMap held) moves the night there and
        # Back is the point's card, in Polku: no step back past it
        href = pg.js("location.href.split('#')[0]")
        pg.js("""(() => { const real = window.fetch; window.fetch = (u, o) => /lipas|overpass/i.test(String(u && u.url || u)) ? new Promise(() => {}) : real(u, o); polku.planner.setStop(1, { on: 420 }); return true; })()""")
        time.sleep(0.3)
        tap_marker(pg, 1, name, touch)
        tap_row(pg, 'Places to sleep nearby', name, touch)
        if st(pg)['kind'] != 'stays':
            fails.append(f"{name}: Places to sleep nearby ›: {st(pg)['kind']} card, rows {st(pg)['rows']}, the stop {pg.js('JSON.stringify(polku.planner.stopAt(1))')}")
        to = pg.js("(() => { const p = polku.planner, q = p.points[1], c = p.cards.current; c.found = [{ name: 'Kaupin laavu', kind: 'Lean-to', d: 400, src: 'LIPAS', at: [+(q[0] + 0.004).toFixed(6), q[1]] }]; c.state = 'done'; p.cards.refresh(); return c.found[0].at; })()")
        pg.js(SETTLED)  # (the card is taller with the list: the sheet comes to its new size before the tap)
        tap_row(pg, 'Kaupin laavu', name, touch)
        time.sleep(0.6)
        r = pg.js("(() => { if (!window.polku) return { gone: true }; const p = polku.planner; return { href: location.href.split('#')[0], kind: p.cards.current && p.cards.current.kind, at: p.points[1], name: p.nameOf(1), depth: p.cards.depth, night: !!(p.stopAt(1) && p.stopAt(1).on != null) }; })()")
        if r.get('gone') or r['href'] != href or r['kind'] != 'point' or r['at'] != to or r['name'] != 'Kaupin laavu' or not r['night'] or r['depth'] != 1:
            fails.append(f'{name}: a place to sleep, tapped: {r} (the lean-to at {to})')
        if r.get('gone') or r['href'] != href:
            fails.append(f'{name}: the page left Polku, so its other checks are skipped')
            pg.close()
            return
        pg.js("(() => { const p = polku.planner; p.cards.close(); p.undo(); p.undo(); return true; })()")
        time.sleep(0.4)
        # 3: Move, then Undo: the card follows its point back; a drag, then Undo too
        tap_marker(pg, 1, name, touch)
        tap_row(pg, 'Move', name, touch)
        spot = spot_near(pg, 1)
        if spot:
            press(pg, spot, f'{name}: the spot to move to', touch)
            pg.js("polku.planner.undo(); true")
            time.sleep(0.4)
            r = pg.js("({ kind: polku.planner.cards.current && polku.planner.cards.current.kind, i: polku.planner.cards.current ? polku.planner.points.indexOf(polku.planner.cards.current.key) : null })")
            if r['kind'] != 'point' or r['i'] != 1:
                fails.append(f'{name}: Move, then Undo: {r}, not via 1’s card')
        pg.js("(() => { const p = polku.planner; p.beginEdit(1, p.snapshot()); p.editTo([p.points[1][0] + 0.002, p.points[1][1]]); p.endEdit(); p.undo(); return true; })()")
        time.sleep(0.4)
        r = pg.js("({ kind: polku.planner.cards.current && polku.planner.cards.current.kind, i: polku.planner.cards.current ? polku.planner.points.indexOf(polku.planner.cards.current.key) : null })")
        if r['kind'] != 'point' or r['i'] != 1:
            fails.append(f'{name}: a drag with the card open, then Undo: {r}, not via 1’s card')
        # 4: Sport from here, Paddle then MTB: the second pick changes only what the first did (leg 2 stays Paddle)
        pg.js("(() => { const p = polku.planner; p.cards.close(); p.setLegSport(2, 'paddle'); return true; })()")
        time.sleep(0.4)
        tap_marker(pg, 0, name, touch)
        tap_row(pg, 'Sport from here', name, touch)
        tap_row(pg, 'Paddle', name, touch)
        tap_row(pg, 'MTB', name, touch)
        time.sleep(0.5)
        r = pg.js("[0, 1, 2].map((i) => polku.planner.legSport(i)).join()")
        if r != 'mtb,mtb,paddle':
            fails.append(f'{name}: Sport from here, Paddle then MTB, from the start: the legs are {r}, not mtb,mtb,paddle')
        # 7: its choices are radios in a named group
        pg.js("(() => { const p = polku.planner; p.cards.close(); p.openPointCard(p.points[0]); return true; })()")
        time.sleep(0.3)
        tap_row(pg, 'Sport from here', name, touch)
        r = pg.js("(() => { const g = document.querySelector('.pl-way.card [role=radiogroup]'); return { group: g && g.getAttribute('aria-label'), radios: g ? g.querySelectorAll(':scope > [role=radio]').length : 0, loose: document.querySelectorAll('.pl-way.card [role=menuitemradio]').length }; })()")
        if r['group'] != 'Sport from here' or r['radios'] != 8 or r['loose']:
            fails.append(f'{name}: Sport from here’s choices: {r}')
        pg.js("(() => { const p = polku.planner; p.cards.close(); p.undo(); p.undo(); return true; })()")
        time.sleep(0.4)
        # 5: while a leg up to the point is routing, its time, distance and height say they aren't known yet
        pg.js("(() => { const p = polku.planner; p.openPointCard(p.points[2]); p.legs[1].status = 'loading'; p.cards.refresh(); return true; })()")
        r = pg.js("[...document.querySelectorAll('.pl-way.card .sum-item')].map((e) => (e.classList.contains('wait') ? 'wait ' : '') + e.querySelector('b').textContent + ' ' + e.querySelector('small').textContent)")
        if r != ['wait – there at', 'wait – from the start', 'wait – height']:
            fails.append(f'{name}: via 2’s numbers while leg 1 is routing: {r}')
        # …and once routing has ended with a leg that couldn't be routed: the numbers along its straight stand-in, and a line
        # that says so (#352's review, 5)
        pg.js("(() => { const p = polku.planner; p.legs[1].status = 'error'; p.cards.refresh(); return true; })()")
        r = pg.js("({ wait: document.querySelectorAll('.pl-way.card .sum-item.wait').length, note: [...document.querySelectorAll('.pl-way.card .rt-cost')].map((e) => e.textContent).join(' ') })")
        if r['wait'] or 'couldn’t be routed' not in r['note']:
            fails.append(f'{name}: via 2’s card after leg 1 couldn’t be routed: {r}')
        pg.js("(() => { const p = polku.planner; p.legs[1].status = 'ok'; p.cards.refresh(); return true; })()")
        # …and a routed leg that starts a few metres from its point (BRouter starts where it joins a way): once it's
        # analysed, the numbers show (#352's review, 5)
        r = pg.js("""(async () => { const p = polku.planner, l = p.legs[1], c = l.result.coords;
          l.result = { ...l.result, coords: [[+(c[0][0] + 0.0004).toFixed(6), c[0][1]], ...c.slice(1)] };
          await p.runAnalysis(p.gen); await new Promise((r) => setTimeout(r, 200));
          return { wait: document.querySelectorAll('.pl-way.card .sum-item.wait').length, kind: p.cards.current && p.cards.current.kind }; })()""")
        if r['wait'] or r['kind'] != 'point':
            fails.append(f'{name}: via 2’s card, leg 1 starting 20 m from via 1, analysed: {r}')
        # 6: a change in the card, or a late answer, keeps the focus and the card's scroll
        pg.js("(() => { const p = polku.planner; p.cards.close(); p.openPointCard(p.points[1]); document.querySelector('.pl-way.card .seg.icons [data-k=pass]').focus(); return true; })()")
        key(pg, 'ArrowRight', 'ArrowRight', 39)
        r = pg.js("({ stop: !!polku.planner.stopAt(1), focus: document.activeElement.dataset.k || document.activeElement.tagName, inCard: !!document.activeElement.closest('.pl-way.card') })")
        if not r['stop'] or r['focus'] != 'stop' or not r['inCard']:
            fails.append(f'{name}: ArrowRight on the switch: {r}, the focus not on Stop')
        pg.js("document.querySelector('.pl-way.card .rt-step [aria-label=\"5 minutes more\"]').focus(); true")
        key(pg, ' ', 'Space', 32, ' ')
        r = pg.js("({ min: polku.planner.stopAt(1) && polku.planner.stopAt(1).min, focus: document.activeElement.getAttribute('aria-label') || document.activeElement.tagName })")
        if r['min'] != 35 or r['focus'] != '5 minutes more':
            fails.append(f'{name}: Space on +: {r}')
        r = pg.js("(() => { const c = document.querySelector('.pl-way.card'); c.scrollTop = 60; const was = c.scrollTop; polku.planner.renderWaypoints(); return { was, now: document.querySelector('.pl-way.card').scrollTop }; })()")
        if r['was'] and abs(r['now'] - r['was']) > 1:
            fails.append(f'{name}: the card’s scroll after a late answer: {r}')
        pg.js("(() => { const p = polku.planner; p.cards.close(); p.undo(); p.undo(); return true; })()")
        time.sleep(0.4)
        # 8: a desktop's drag of the point, let go over its own card, ends there: one step of Undo, the card on its point
        if not phone:
            tap_marker(pg, 1, name, touch)
            m, c = at(pg, "polku.planner.markers[1].getElement().querySelector('.wp')"), at(pg, "document.querySelector('.pl-way.card')")
            past = st(pg)['past']
            mouse = lambda kind, x, y, b: pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': x, 'y': y, 'button': 'left', 'buttons': b, 'clickCount': 1}, pg.s)
            mouse('mousePressed', m['x'], m['y'], 1)
            # (up and away first, over the map, so the drag begins there; then over the card, and let go on it)
            path = [(m['x'] - 6 * k, m['y'] - 6 * k) for k in range(1, 6)] + [(m['x'] - 30 + (c['x'] - m['x'] + 30) * k / 10, m['y'] - 30 + (c['y'] - m['y'] + 30) * k / 10) for k in range(1, 11)]
            for x, y in path:
                mouse('mouseMoved', x, y, 1)
                time.sleep(0.03)
            mouse('mouseReleased', c['x'], c['y'], 0)
            time.sleep(0.6)
            r = pg.js("({ edit: !!polku.planner.edit, editing: document.body.classList.contains('route-editing'), past: polku.planner.past.length, kind: polku.planner.cards.current && polku.planner.cards.current.kind, i: polku.planner.cards.current ? polku.planner.points.indexOf(polku.planner.cards.current.key) : null })")
            if r['edit'] or r['editing'] or r['past'] != past + 1 or r['kind'] != 'point' or r['i'] != 1:
                fails.append(f'{name}: a drag let go over the card: {r} (Undo had {past} steps)')
            pg.js("(() => { const p = polku.planner; if (p.edit) p.endEdit(); p.cards.close(); p.undo(); return true; })()")
            time.sleep(0.4)
        # Back from a card opened from the list: the sheet at its size and the list at its scroll, as they were
        if phone:
            pg.js("(() => { const p = polku.planner; p.setSheetState('half'); p.els.body.scrollTop = 120; return true; })()")
            pg.js(SETTLED)
            was = pg.js("({ sheet: polku.planner.panel.dataset.state, scroll: polku.planner.els.body.scrollTop })")
            pg.js("(() => { const p = polku.planner; p.openPointCard(p.points[2], { from: 'list' }); return true; })()")
            time.sleep(0.5)
            s = st(pg)
            if s['back'] != 'Route' or s['place'] != 'peek':
                fails.append(f"{name}: opened from the list: Back “{s['back']}”, in the {s['place']}")
            press(pg, at(pg, "document.querySelector('.pl-way.card .way-back')"), f'{name}: Back', touch)
            pg.js(SETTLED)
            time.sleep(0.3)
            now = pg.js("({ sheet: polku.planner.panel.dataset.state, scroll: polku.planner.els.body.scrollTop, kind: polku.planner.cards.current && polku.planner.cards.current.kind })")
            if now['kind'] or now['sheet'] != was['sheet'] or abs(now['scroll'] - was['scroll']) > 2:
                fails.append(f'{name}: Back from a card opened from the list: {now}, it was {was}')
            pg.js("polku.planner.setSheetState('peek'); true")
            pg.js(SETTLED)
        # the route's view: the switch works and stays in the view; nothing that needs editing; the note's Edit
        pg.js("polku.planner.setEditing(false); true")
        time.sleep(0.3)
        s = tap_marker(pg, 1, name, touch)
        left = [x for x in ('Move', 'Rename', 'Start here', 'End here', 'Sport from here', 'Remove') if x in s['rows']]
        if left or "You’re not editing" not in s['text']:
            fails.append(f"{name}: the route’s view: {', '.join(left) or 'nothing that needs editing'}, {'with' if 'You’re not editing' in s['text'] else 'no'} note")
        tap_seg(pg, 'Stop', name, touch)
        r = pg.js("({ view: polku.planner.inView(), stop: !!polku.planner.stopAt(1), kind: polku.planner.cards.current && polku.planner.cards.current.kind })")
        if not r['view'] or not r['stop'] or r['kind'] != 'point':
            fails.append(f'{name}: Stop in the route’s view: {r}')
        press(pg, at(pg, "[...document.querySelectorAll('.pl-way.card .pl-viewnote .btn')].find((b) => b.textContent.trim() === 'Edit')"), f'{name}: the note’s Edit', touch)
        s = st(pg)
        if s['view'] or 'Move' not in s['rows']:
            fails.append(f"{name}: the note’s Edit: {'still the view' if s['view'] else 'editing'}, rows {s['rows']}")
        pg.js("polku.planner.cards.close(); true")
        # the pill: above the spot on a phone, the card's first button on a desktop (1b and 5 give cards one)
        r = pg.js("""(() => { const p = polku.planner, at = p.points[2]; let hit = 0;
          p.cards.open({ kind: 'test', key: 'pill', title: 'A spot', sub: '', build: (b) => b.append('…'.slice(1)), pill: { label: 'Add a point here', icon: 'plus', fn: () => { hit++; } } }, { at });
          const pill = document.querySelector('.card-pill'), big = document.querySelector('.pl-way.card > .btn.primary.big');
          const R = p.map.getCanvas().getBoundingClientRect(), q = p.map.project(at), pr = pill && pill.getBoundingClientRect();
          (pill || big)?.click();
          const out = { pill: !!pill, big: !!big, above: pr ? Math.round(R.top + q.y - pr.bottom) : null, hit };
          p.cards.close(); return out; })()""")
        if phone and (not r['pill'] or r['above'] is None or not 0 <= r['above'] <= 60 or r['hit'] != 1):
            fails.append(f'{name}: the pill on a phone: {r}')
        if not phone and (not r['big'] or r['pill'] or r['hit'] != 1):
            fails.append(f'{name}: the pill on a desktop: {r}')
        if not phone:
            # a point at the right edge: the card opens to its left, on screen
            pg.js("(() => { const m = polku.map, q = m.project(polku.planner.points[2]); m.panBy([q.x - (m.getCanvas().clientWidth - 110), 0], { duration: 0 }); return true; })()")
            time.sleep(0.5)
            s = tap_marker(pg, 2, name, touch)
            c, m = s['card'], s['marker']
            if not c or c['right'] > m['x'] or c['left'] < 0 or c['right'] > w or c['top'] < 0 or c['bottom'] > h_:
                fails.append(f'{name}: a point at the right edge: the card at {c}, the point at {m}')
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        pg.close()

    for w, h_, phone in ((390, 844, True), (1440, 900, False)):
        name, touch = f'{w}x{h_}', phone
        pg = page(w, h_, phone)
        try:
            one_size(pg, w, h_, phone, name, touch)
        except Exception as e:
            fails.append(f"{name}: raised {type(e).__name__}: {str(e).splitlines()[0][:120]}, after {' / '.join(trail[-4:])}")
            pg.close()

    # 200 %: undo, redo and ✕ in a row of their own, the title under them, the numbers one to a row; at 360 × 740 with
    # long Finnish names, nothing cut
    LONG = 'Pirunvuoren näköalapaikan pohjoisrinteellä'
    for w, h_, narrow, label in ((195, 422, True, '390x844 at 200 %'), (180, 370, True, '360x740 at 200 %, Finnish'), (180, 370, True, '360x740 at 200 %, Finnish, from the list'), (360, 740, False, '360x740, Finnish')):
        pg = page(w, h_, True)
        pg.js(f"(() => {{ const p = polku.planner; p.setName(1, {json.dumps(LONG)}); p.setName(0, 'Lielahden kartanon uimaranta'); p.setStop(1, {{ min: 30 }}); return true; }})()")
        opened = time.time()
        pg.js(f"(() => {{ const p = polku.planner; p.openPointCard(p.points[1], {{ from: {json.dumps('list' if 'list' in label else 'map')} }}); return true; }})()")
        # (at 200 % the planner rests at its line, and a card from the map opens folded, step 3 of #233: open it, as a tap on its line does)
        pg.js("(() => { const p = polku.planner; if (p.panel.dataset.state === 'folded') p.unfold(); return true; })()")
        # the sheet at the card's size, and the card's own last look for its point (inSight(), 900 ms after it opens)
        pg.js(SETTLED)
        time.sleep(max(0, opened + 1.2 - time.time()))
        s = st(pg)
        if s['kind'] != 'point':
            fails.append(f'{label}: no card')
            pg.close()
            continue
        if s['card']['height'] > h_ * 0.52 + 1:
            fails.append(f"{label}: the card {round(s['card']['height'])} px tall, more than 52 % of the window")
        top = pg.js("document.querySelector('.topbar').getBoundingClientRect().bottom")
        m = s['marker']
        if not m or m['y'] >= pg.js("polku.planner.panel.getBoundingClientRect().top") or m['y'] < top or m['x'] < 0 or m['x'] > w:
            fails.append(f"{label}: the point at {m}, not in sight above the card (the sheet's top {round(pg.js('polku.planner.panel.getBoundingClientRect().top'))} px)")
        if narrow and not pg.js("polku.planner.tools.hidden"):
            fails.append(f'{label}: the toolbox still shows beside a narrow card')
        over = pg.js(PC_OVER)
        if over:
            fails.append(f'{label}: the point is under {over}')
        if 'list' in label:
            # Back, undo, redo and ✕, none over another, all inside the card
            o = pg.js("""(() => { const c = document.querySelector('.pl-way.card'), cr = c.getBoundingClientRect(), bs = [...c.querySelectorAll(':scope > .way-bar > *')].filter((b) => b.getClientRects().length).map((b) => b.getBoundingClientRect());
              const out = [];
              bs.forEach((a, k) => { if (a.right > cr.right + 1 || a.left < cr.left - 11) out.push(`top row item ${k} past the card`); bs.slice(k + 1).forEach((b) => { if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push('two of Back, undo, redo and ✕ over each other'); }); });
              return [...new Set(out)]; })()""")
            fails += [f'{label}: {x}' for x in o]
        fails += [f'{label}: {o}' for o in pg.js(f"({PC_FIT})({json.dumps(narrow)})")]
        if narrow:
            pg.js("polku.planner.setStop(1, null); true")  # (a step to undo, from the card's own Undo)
            time.sleep(0.3)
            press(pg, at(pg, "document.querySelector('.pl-way.card > .way-bar [data-k=undo]')"), f'{label}: the card’s Undo', True)
            if not pg.js("!!polku.planner.stopAt(1)"):
                fails.append(f'{label}: the card’s Undo didn’t undo')
        fails += [f'{label} console: {e[:160]}' for e in pg.errors()]
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} a point's card (25d 1a): the map and the list, phones and desktops, every action, Back as it was, 200 %" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# The route's card and a stretch's card (25d's 1b, Journey D): a tap on the route shows what's there, with Add a point
# here at the spot (a pill just above it on a phone, the card's first button on a desktop); This stretch, What's here
# and Edit this stretch a row away; On the profile, Avoid this spot and The whole route › on it too (#364's 2 B and
# 3 B, #90's B); the start's card with Back to start first while drawing (#334's A); End, never Finish (#353).
# BRouter is answered here, with a way's tags, where a leg follows paths; the water's sources are answered empty.
RC_ROUTER = """(() => {
  const real = window.fetch.bind(window), calls = (window.routerCalls = []);
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (!/^https:[/][/](brouter[.]de|valhalla1[.]openstreetmap[.]de)[/]/.test(url)) return real(input, init);
    calls.push(url);
    if (/valhalla/.test(url)) return new Response('{}', { status: 503 });
    const prof = url.match(/[/]profile[/]([\\w-]+)/);
    if (prof) return new Response(JSON.stringify({ profileid: prof[1] }));
    if (window.rcHold) await window.rcHold;
    // a straight line through the points with a vertex halfway, every stretch with the way's tags (window.rcTags)
    const ll = new URL(url).searchParams.get('lonlats').split('|').map((q) => q.split(',').map(Number)), c = [], msgs = [['Longitude', 'Latitude', 'WayTags']];
    ll.forEach((q, i) => { if (i) { c.push([(ll[i - 1][0] + q[0]) / 2, (ll[i - 1][1] + q[1]) / 2]); msgs.push([Math.round(q[0] * 1e6), Math.round(q[1] * 1e6), window.rcTags]); } c.push(q); });
    return new Response(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { messages: msgs }, geometry: { type: 'LineString', coordinates: c } }] }));
  };
  window.rcTags = 'highway=path surface=dirt mtb:scale=1 sac_scale=hiking width=1';
  return import(location.origin + '/js/waterdata.js').then((D) => { const fc = { type: 'FeatureCollection', features: [] }; D.seedWater(() => ({ fairways: fc, hazards: fc, wind: null, missing: [] })); return true; });
})()"""
# a route: { pts, mode, names: [[i, name]] }; routed, analysed, the sheet at its peek and the route in view
RC_ROUTE = """(async (o) => {
  const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  p.checkWet = async () => {};
  p.wet = { on: false, mm: 0, at: Date.now() };
  p.setActive(true); p.clear(); p.setMode(o.mode || 'line');
  for (const q of o.pts) p.addPoint(q);
  for (const [i, n] of o.names || []) p.setName(i, n);
  for (let k = 0; k < 200 && !(p.legs.length === o.pts.length - 1 && p.analysisFits() && p.analysis.ele); k++) await wait(100);
  p.setSheetState('peek');
  p.fitRoute({ animate: false });
  await wait(600);
  return p.analysisFits();
})"""
# where a fraction t of leg li's line is on the screen (and its [lng, lat]), the map zoomed in there (z16, the free
# map's middle), so the tap is well clear of the points and the leg's handle, as a person zooms in to tap a line
RC_ON = """(async (li, t) => {
  const p = polku.planner, m = polku.map, c = p.legs[li].result ? p.legs[li].result.coords : [p.points[li], p.points[li + 1]];
  const d = (a, b) => Math.hypot((b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), b[1] - a[1]);
  let L = 0; for (let j = 1; j < c.length; j++) L += d(c[j - 1], c[j]);
  let at = L * t, ll = c[0];
  for (let j = 1; j < c.length; j++) { const s = d(c[j - 1], c[j]); if (at <= s) { const f = s ? at / s : 0; ll = [c[j - 1][0] + (c[j][0] - c[j - 1][0]) * f, c[j - 1][1] + (c[j][1] - c[j - 1][1]) * f]; break; } at -= s; }
  const v = p.active ? p.viewPadding(0) : { left: 0, right: 0, top: 0, bottom: 0 };
  m.jumpTo({ center: ll, zoom: 16, offset: [(v.left - v.right) / 2, (v.top - v.bottom) / 2] });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const R = m.getCanvas().getBoundingClientRect(), q = m.project(ll);
  return { x: Math.round(R.left + q.x), y: Math.round(R.top + q.y), ll };
})"""
RC_STATE = """(() => {
  const p = polku.planner, c = document.querySelector('.pl-way.card'), r = (e) => e.getBoundingClientRect(), vis = (e) => !!e && e.getClientRects().length > 0;
  const box = (e) => (e ? (({ left, top, right, bottom, width, height }) => ({ left, top, right, bottom, width, height }))(r(e)) : null);
  // the card's action at the pointer (first, or at its foot when it opens upwards); a warning box may come before it
  const first = c && (c.querySelector(':scope > [data-k=pill]') || [...c.children].find((e) => e.matches('button, .btn')));
  return {
    kind: p.cards.current ? p.cards.current.kind : null, place: p.cards.place, n: p.points.length, past: p.past.length, view: p.inView(), active: p.active,
    calls: (window.routerCalls || []).length, menu: !!document.querySelector('.maplibregl-popup .pt-menu'),
    pill: vis(document.querySelector('.card-pill')) ? box(document.querySelector('.card-pill')) : null, pin: vis(document.querySelector('.card-pin')),
    first: first ? { text: first.textContent.trim(), box: box(first) } : null,
    card: c ? box(c.closest('.maplibregl-popup-content') || c) : null,
    title: c ? c.querySelector('.way-hint b')?.textContent || '' : '', sub: c ? c.querySelector('.way-hint small')?.textContent || '' : '',
    back: vis(c && c.querySelector('.way-back')) ? c.querySelector('.way-back').textContent.trim() : '',
    labels: c ? [...c.querySelectorAll('.sum-item small')].map((e) => e.textContent) : [],
    values: c ? [...c.querySelectorAll('.sum-item b')].map((e) => e.textContent) : [],
    words: c ? [...c.querySelectorAll('.sum-item em')].map((e) => e.textContent) : [],
    miss: c ? [...c.querySelectorAll('.sum-item.miss small')].map((e) => e.textContent) : [],
    rows: c ? [...c.querySelectorAll('.row')].filter(vis).map((e) => e.querySelector('b').textContent) : [],
    danger: c ? [...c.querySelectorAll('.row.danger')].map((e) => e.querySelector('b').textContent) : [],
    heads: c ? [...c.querySelectorAll('.menu-h')].map((e) => e.textContent) : [],
    seg: c ? [...c.querySelectorAll('.seg button')].map((e) => e.textContent.trim() + (e.getAttribute('aria-checked') === 'true' ? '*' : '')) : [],
    main: c ? [...c.querySelectorAll('.btn.primary.big')].map((e) => e.textContent.trim()) : [],
    note: !!(c && c.querySelector('.pl-viewnote')), text: c ? c.textContent : '',
  }; })()"""
# the card's controls are the shared ones, big enough, one fact a line; a desktop's rows 36 px with their lines as tooltips
RC_LOOK = """((phone) => {
  const c = document.querySelector('.pl-way.card'), out = [], r = (e) => e.getBoundingClientRect();
  if (!c) return ['no card'];
  const ok = new Set(['pl-way', 'card', 'way-bar', 'way-back', 'btn', 'small', 'quiet', 'tool', 'way-x', 'way-head', 'way-hint', 'card-mark', 'sheet-sum', 'sum-item', 'miss', 'wait',
    'menu-h', 'seg', 'icons', 'ic', 'rows', 'row', 'danger', 'val', 'way-chev', 'menu-tick', 'rt-cost', 'pl-viewnote', 'primary', 'big', 'acts', 'warn-row', 'look', 'unk', 'insp-row', 'insp-info', 'insp-more', 'link', 'way-chips', 'chip', 'way-fold']);
  const extra = new Set([...c.querySelectorAll('[class]')].flatMap((e) => [...e.classList]).filter((k) => !ok.has(k)));
  if (extra.size) out.push(`classes that aren't shared controls: ${[...extra].join(', ')}`);
  const least = phone ? 44 : 36;
  for (const b of c.querySelectorAll('button')) { const a = r(b); if (a.width && (a.width < least || a.height < least)) out.push(`${(b.textContent.trim() || b.getAttribute('aria-label') || '').slice(0, 30)} ${Math.round(a.width)} × ${Math.round(a.height)} px`); }
  if (/ · /.test(c.textContent)) out.push('facts strung with “ · ”');
  if (/…(?!$)/.test(c.textContent.replace(/Save offline…|Import GPX or KML…/g, ''))) out.push('“…” in the card');
  for (const row of c.querySelectorAll('.row')) {
    if (!row.getClientRects().length || row.getAttribute('role') === 'radio') continue;
    const name = row.querySelector('b').textContent, line = row.querySelector('small');
    if (!row.querySelector('.ic')) out.push(`${name}: no icon`);
    if (!line) out.push(`${name}: no line under it`);
    if (!phone && line && line.getClientRects().length) out.push(`${name}'s line shows on a desktop`);
    if (!phone && line && row.title !== line.textContent) out.push(`${name}'s tooltip isn't its line`);
  }
  return out; })"""


def route_card(chrome):
    fails, trail = [], []

    def press(pg, at, name, touch):
        trail.append(name)
        if not at:
            fails.append(f'{name}: not on screen')
            return False
        if touch:
            pg.quick_tap(at['x'], at['y'])
        else:
            for kind in ('mouseMoved', 'mousePressed', 'mouseReleased'):
                pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': at['x'], 'y': at['y'], 'button': 'none' if kind == 'mouseMoved' else 'left',
                                                      'buttons': 1 if kind == 'mousePressed' else 0, 'clickCount': 1}, pg.s)
        time.sleep(0.5)
        return True

    at = lambda pg, x: (pg.js(SETTLED), pg.js(f"({PC_STILL})(() => ({x}))"))[1]
    st = lambda pg: pg.js(RC_STATE)
    row = lambda label: f"[...document.querySelectorAll('.pl-way.card .row')].find((b) => b.getClientRects().length && b.querySelector('b').textContent === {json.dumps(label)})"
    tap_row = lambda pg, label, name, touch: press(pg, at(pg, row(label)), f'{name}: {label}', touch)
    main = lambda pg, label, name, touch: press(pg, at(pg, f"[...document.querySelectorAll('.pl-way.card .btn')].find((b) => b.textContent.trim() === {json.dumps(label)})"), f'{name}: {label}', touch)
    on_line = lambda pg, li, t: (pg.js(SETTLED), pg.js(f"({RC_ON})({li}, {t})"))[1]
    close = lambda pg: (pg.js("polku.planner.cards.close(); true"), time.sleep(0.3))

    # the map stays where you left it when the card goes (#513): panned with the card open, then ✕ or the back gesture
    def keeps_view(pg, name, touch, zoom=None):
        for how in ('✕', 'the back gesture'):
            press(pg, on_line(pg, 0, 0.3), f'{name}: the line', touch)
            if st(pg)['kind'] != 'route':  # (no card, nothing to close: a back gesture would leave the page)
                fails.append(f"{name}: the route's card for {how}: {st(pg)['kind'] or 'no'} card")
                continue
            pg.js("new Promise((ok) => setTimeout(ok, 1200))")  # (the card's own look for its spot, 900 ms after it opens)
            # (zoom: a centre with more decimals than five, as a map at that zoom has)
            a = pg.js("(() => { polku.map.panBy([300, 0], { duration: 0 }); const c = polku.map.getCenter(); return [c.lng, c.lat]; })()" if not zoom else
                      f"(() => {{ const c = polku.map.getCenter(); polku.map.jumpTo({{ center: [c.lng + 0.0000049, c.lat + 0.0000049], zoom: {zoom} }}); const n = polku.map.getCenter(); return [n.lng, n.lat]; }})()")
            time.sleep(0.8)
            if how == '✕':
                press(pg, at(pg, "[...document.querySelectorAll('.pl-way.card .way-x')].find((b) => b.getClientRects().length)"), f'{name}: ✕', touch)
            else:
                pg.js("history.back(); true")
            time.sleep(1.2)
            r = pg.js(f"""(() => {{ const m = polku.map, c = m.getCenter(), h = location.hash.slice(1).split('/').map(Number);
              return {{ moved: Math.round(m.project({json.dumps(a)}).x - m.project(c).x), off: Math.round(Math.hypot((h[2] - c.lng) * 55000, (h[1] - c.lat) * 111000)), hash: location.hash, card: polku.planner.cards.current && polku.planner.cards.current.kind }}; }})()""")
            if r['card'] or r['moved'] or r['off'] > 5:
                fails.append(f"{name}: the card closed by {how} after the map was moved: the map jumped {r['moved']} px, the address {r['off']} m from the map ({r['hash']}), card {r['card'] or 'closed'}")
        pg.js("polku.planner.fitRoute({ animate: false }); true")
        time.sleep(0.5)

    def page(w, h_, phone, sport='mtb'):
        pg = chrome.page(w, h_, phone)
        pg.open_app({'activity': sport}, {'polku:winter': '"off"', 'polku:plannerDock': '"left"'}, '#14/61.514/23.818')
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        pg.js(RC_ROUTER)
        return pg

    def route(pg, name, o):
        if not pg.js(f"({RC_ROUTE})({json.dumps(o)})", timeout=60000):
            fails.append(f'{name}: the route wasn’t routed')
        return st(pg)

    # Kaupintie, three points that only shape the line, Lielahti (named: a point you see), then the end
    LINE = {'pts': [[23.800, 61.512], [23.806, 61.5135], [23.812, 61.5145], [23.818, 61.5150], [23.826, 61.5140], [23.836, 61.5125]], 'names': [[0, 'Kaupintie'], [4, 'Lielahti']]}

    # ------------------------------------------------------------------ a phone, by touch
    name, touch = '390x844', True
    pg = page(390, 844, True)
    try:
        s0 = route(pg, name, LINE)
        if pg.js("polku.planner.label(polku.planner.points.length - 1)") != 'End' or pg.js("/\\bFinish\\b/i.test(polku.planner.panel.innerText)"):
            fails.append(f"{name}: the last point is “{pg.js('polku.planner.label(polku.planner.points.length - 1)')}”, or the planner says Finish (#353)")
        # a tap on the line, away from its handle: the route's card in the peek, the pill just above the tap, nothing added
        t = on_line(pg, 1, 0.3)
        press(pg, t, f'{name}: the line', touch)
        s = st(pg)
        if s['kind'] != 'route' or s['place'] != 'peek' or s['n'] != s0['n'] or s['past'] != s0['past'] or s['menu']:
            fails.append(f"{name}: a tap on the line: {s['kind'] or 'no'} card ({s['place']}), {s['n'] - s0['n']} points added, {s['past'] - s0['past']} steps in Undo{', and the old menu' if s['menu'] else ''}")
        else:
            # (the map has moved the spot into sight above the card in the peek, as for a point's card)
            spot = pg.js(f"(() => {{ const R = polku.map.getCanvas().getBoundingClientRect(), q = polku.map.project({json.dumps(t['ll'])}); return {{ x: R.left + q.x, y: R.top + q.y }}; }})()")
            if not s['pill'] or not s['pin'] or not 0 <= spot['y'] - s['pill']['bottom'] <= 60 or spot['y'] >= s['card']['top']:
                fails.append(f"{name}: the pill {s['pill']} and the pin {s['pin']}, for the spot at {round(spot['y'])} px over a card from {round(s['card']['top'])} px")
            # nothing over the pill: its middle is the pill's, not the map's scale or its credits (they took its tap)
            over = pg.js("(() => { const b = document.querySelector('.card-pill'), r = b && b.getBoundingClientRect(), e = r && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && !b.contains(e) ? (e.id || String(e.className.baseVal ?? e.className)) : ''; })()")
            if over:
                fails.append(f'{name}: {over} is over the pill')
            if s['labels'][:2] != ['there at', 'uphill'] and s['labels'][:2] != ['there at', 'downhill'] or s['miss'] != ['difficulty not mapped'] or s['values'][2:] != ['?']:
                fails.append(f"{name}: a straight line's numbers: {s['values']} {s['labels']}, dashed {s['miss']}")
            if s['rows'] != ['This stretch', 'What’s here', 'Edit this stretch', 'On the profile', 'Avoid this spot', 'The whole route']:
                fails.append(f"{name}: the route's card's rows: {s['rows']}")
            if 'from the start' not in s['sub']:
                fails.append(f"{name}: the route's card's line: “{s['sub']}”")
            fails += [f'{name}: {o}' for o in pg.js(f"({RC_LOOK})(true)")]
            # the pill: a point at the spot, on the line; one step of Undo; no routing request; the note says where
            r0 = st(pg)
            press(pg, at(pg, "document.querySelector('.card-pill')"), f'{name}: Add a point here', touch)
            r = pg.js(f"""(() => {{ const p = polku.planner, q = p.points[2], a = {json.dumps(LINE['pts'][1])}, b = {json.dumps(LINE['pts'][2])}, t = {json.dumps(t['ll'])};
              const k = Math.cos(q[1] * Math.PI / 180) * 111320, x = (u) => [(u[0] - a[0]) * k, (u[1] - a[1]) * 111320], B = x(b), Q = x(q), T = x(t);
              const f = Math.max(0, Math.min(1, (Q[0] * B[0] + Q[1] * B[1]) / (B[0] ** 2 + B[1] ** 2)));
              return {{ n: p.points.length, past: p.past.length, calls: (window.routerCalls || []).length, line: Math.hypot(Q[0] - f * B[0], Q[1] - f * B[1]), tap: Math.hypot(Q[0] - T[0], Q[1] - T[1]),
                kind: p.cards.current && p.cards.current.kind, note: document.querySelector('#toast')?.textContent || '' }}; }})()""")
            if r['n'] != r0['n'] + 1 or r['past'] != r0['past'] + 1 or r['calls'] != r0['calls'] or r['line'] > 2 or r['tap'] > 8 or not r['note'].startswith('Point added after Via 1'):
                fails.append(f'{name}: Add a point here: {r}')
            pg.js("polku.planner.undo(); true")
            time.sleep(0.5)
        # This stretch ›: from Kaupintie to Lielahti, over the three points that only shape it; Back to the route's card.
        # The stretch is lit on the map while its cards are open, from one end to the other, and not after
        lit = lambda: pg.js("""(() => { const p = polku.planner, d = polku.map.getSource('routeLit').serialize().data, c = d && d.features && d.features[0] && d.features[0].geometry.coordinates;
          const at = (q, k) => !!c && Math.abs(c[k < 0 ? c.length - 1 : 0][0] - q[0]) < 1e-6 && Math.abs(c[k < 0 ? c.length - 1 : 0][1] - q[1]) < 1e-6;
          return c ? (at(p.points[0], 0) && at(p.points[4], -1) ? 'the stretch' : `${c.length} points, not the stretch`) : 'nothing'; })()""")
        press(pg, on_line(pg, 1, 0.3), f'{name}: the line', touch)
        if lit() != 'the stretch':
            fails.append(f"{name}: lit on the map with the route's card open: {lit()}")
        tap_row(pg, 'This stretch', name, touch)
        if lit() != 'the stretch':
            fails.append(f"{name}: lit on the map with the stretch's card open: {lit()}")
        s = st(pg)
        if s['kind'] != 'stretch' or s['title'] != 'Kaupintie → Lielahti' or s['labels'] != ['distance', 'time', 'climb'] or s['main'] != ['Edit this stretch'] or 'On the profile' not in s['rows'] or not s['back']:
            fails.append(f"{name}: This stretch ›: {s['kind']} card “{s['title']}”, {s['labels']}, {s['main']}, rows {s['rows']}, Back “{s['back']}”")
        # Edit this stretch: its 4 legs; only what fits on land; Other ways only for one leg
        main(pg, 'Edit this stretch', name, touch)
        s = st(pg)
        if s['kind'] != 'edit' or 'its 4 legs' not in s['text'] or s['seg'] != ['Follow paths', 'Straight line*'] or 'Other ways' in s['rows'] or s['heads'] != ['How you go', 'On this stretch']:
            fails.append(f"{name}: Edit this stretch: {s['kind']} card, {'4 legs' if 'its 4 legs' in s['text'] else 'not its 4 legs'}, the switch {s['seg']}, rows {s['rows']}, groups {s['heads']}")
        fails += [f'{name}: Edit this stretch: {o}' for o in pg.js(f"({RC_LOOK})(true)")]
        # Sport: Paddle for the stretch: its four legs paddled over water, the last leg as it was, one step of Undo
        past = st(pg)['past']
        tap_row(pg, 'Sport', name, touch)
        if st(pg)['kind'] != 'esport':
            fails.append(f"{name}: Edit this stretch's Sport ›: {st(pg)['kind']} card")
        tap_row(pg, 'Paddle', name, touch)
        time.sleep(0.4)
        r = pg.js("(() => { const p = polku.planner; return { sports: p.legs.map((_, i) => p.legSport(i)).join(), modes: p.legs.map((l) => l.mode).join(), past: p.past.length, kind: p.cards.current && p.cards.current.kind, seg: [...document.querySelectorAll('.pl-way.card .seg button')].map((e) => e.textContent.trim()) }; })()")
        if r['sports'] != 'paddle,paddle,paddle,paddle,mtb' or r['modes'] != 'water,water,water,water,line' or r['past'] != past + 1 or r['kind'] != 'edit' or r['seg'] != ['Over water', 'Straight line']:
            fails.append(f'{name}: Edit this stretch → Paddle: {r}')
        pg.js("polku.planner.undo(); true")
        time.sleep(0.6)
        close(pg)
        if lit() != 'nothing':
            fails.append(f"{name}: lit on the map once the cards are closed: {lit()}")
        # On the profile: the profile zoomed to the stretch at the spot; Avoid this spot: a place to avoid there, one step of Undo
        press(pg, on_line(pg, 4, 0.5), f'{name}: the last leg', touch)
        s = st(pg)
        if s['kind'] != 'route':
            fails.append(f"{name}: a tap on the last leg (its handle): {s['kind']} card")
        tap_row(pg, 'On the profile', name, touch)
        r = pg.js("(() => { const p = polku.planner, v = p.chart.view; return { view: v && [Math.round(v[0]), Math.round(v[1])], want: [Math.round(p.lengthTo(4)), Math.round(p.lengthTo(5))] }; })()")
        if r['view'] != r['want']:
            fails.append(f'{name}: On the profile: the profile at {r["view"]}, not the stretch at {r["want"]}')
        pg.js("polku.planner.chart.setView(null, true); true")
        press(pg, on_line(pg, 4, 0.3), f'{name}: the last leg', touch)
        past, nogos = st(pg)['past'], pg.js("polku.planner.nogos.length")
        tap_row(pg, 'Avoid this spot', name, touch)
        r = pg.js("({ nogos: polku.planner.nogos.length, past: polku.planner.past.length })")
        if r['nogos'] != nogos + 1 or r['past'] != past + 1:
            fails.append(f'{name}: Avoid this spot: {r}')
        pg.js("polku.planner.undo(); true")
        time.sleep(0.6)
        # The whole route ›: what ⋯ has, in its groups and order; Clear route apart, in red, and Undo brings the route back
        press(pg, on_line(pg, 1, 0.3), f'{name}: the line', touch)
        tap_row(pg, 'The whole route', name, touch)
        s = st(pg)
        want = ['Share link', 'Export GPX', 'Save offline…', 'Round trip from the start', 'Reverse', 'Back to start', 'Import GPX or KML…', 'Clear route']
        if s['kind'] != 'whole' or s['rows'] != want or s['danger'] != ['Clear route'] or s['heads'] != ['Take it along', 'The whole route'] or not s['back']:
            fails.append(f"{name}: The whole route ›: {s['kind']} card, rows {s['rows']}, in red {s['danger']}, groups {s['heads']}, Back “{s['back']}”")
        n = s['n']
        tap_row(pg, 'Clear route', name, touch)
        if pg.js("polku.planner.points.length") != 0:
            fails.append(f"{name}: Clear route left {pg.js('polku.planner.points.length')} points")
        pg.js("polku.planner.undo(); true")
        time.sleep(0.6)
        if pg.js("polku.planner.points.length") != n:
            fails.append(f'{name}: Undo after Clear route: {pg.js("polku.planner.points.length")} points, not {n}')
        # the start's card while drawing: Back to start first; it closes the loop, one step of Undo; a loop has none
        close(pg)
        pg.js("polku.planner.markers[0].getElement().click(); true")
        time.sleep(0.4)
        s = st(pg)
        if s['kind'] != 'point' or not s['rows'] or s['rows'][0] != 'Back to start':
            fails.append(f"{name}: the start's card while drawing: rows {s['rows']}")
        else:
            tap_row(pg, 'Back to start', name, touch)
            r = pg.js("(() => { const p = polku.planner; return { n: p.points.length, loop: p.isLoop(), past: p.past.length }; })()")
            if r['n'] != s['n'] + 1 or not r['loop'] or r['past'] != s['past'] + 1:
                fails.append(f"{name}: the start's Back to start: {r}")
            close(pg)
            pg.js("polku.planner.markers[0].getElement().click(); true")
            time.sleep(0.4)
            if 'Back to start' in st(pg)['rows']:
                fails.append(f"{name}: the start's card on a loop still has Back to start")
            pg.js("polku.planner.undo(); true")
            time.sleep(0.6)
        close(pg)
        # a point's Next stretch, to …: the stretch it's on, from the point you see before it to the next; Back to the point
        pg.js("polku.planner.markers[2].getElement().click(); true")
        time.sleep(0.4)
        if 'Next stretch, to Lielahti' not in st(pg)['rows']:
            fails.append(f"{name}: via 2's row to its stretch: {st(pg)['rows']}")
        else:
            tap_row(pg, 'Next stretch, to Lielahti', name, touch)
            s = st(pg)
            if s['kind'] != 'stretch' or s['title'] != 'Kaupintie → Lielahti' or s['back'] != pg.js("polku.planner.nameOf(2)"):
                fails.append(f"{name}: Next stretch ›: {s['kind']} card “{s['title']}”, Back “{s['back']}”")
        close(pg)
        keeps_view(pg, name, touch)
        keeps_view(pg, name, touch, 20.5)
        # the route's view: the same card, without the pill, Edit this stretch or Avoid this spot, and the note with Edit
        pg.js("polku.planner.done(); true")
        time.sleep(0.6)
        s0 = st(pg)
        press(pg, on_line(pg, 1, 0.3), f'{name}: the line in the route’s view', touch)
        s = st(pg)
        if s['kind'] != 'route' or s['pill'] or s['pin'] or 'Edit this stretch' in s['rows'] or 'Avoid this spot' in s['rows'] or not s['note'] or s['n'] != s0['n'] or not s['view']:
            fails.append(f"{name}: the route's view: {s['kind']} card, pill {bool(s['pill'])}, rows {s['rows']}, note {s['note']}, {s['n'] - s0['n']} points added")
        close(pg)
        # the planner put away: a tap on the route opens it, at the route's card
        pg.js("polku.planner.setActive(false); true")
        time.sleep(0.6)
        press(pg, on_line(pg, 1, 0.3), f'{name}: the line, the planner put away', touch)
        # (a tap a busy page took for a hold is replayed once the map has gone idle, then the planner opens: waited for)
        for _ in range(20):
            s = st(pg)
            if s['kind'] == 'route':
                break
            time.sleep(0.25)
        if not s['active'] or s['kind'] != 'route' or s['n'] != s0['n']:
            fails.append(f"{name}: a tap on the route with the planner put away: planner {'open' if s['active'] else 'away'}, {s['kind']} card, {s['n'] - s0['n']} points added")
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    except Exception as e:
        fails.append(f"{name}: raised {type(e).__name__}: {str(e).splitlines()[0][:120]}, after {' / '.join(trail[-4:])}")
    pg.close()

    # ------------------------------------------------------------------ a desktop, by mouse; legs that follow paths
    name, touch = '1440x900', False
    pg = page(1440, 900, False)
    try:
        s0 = route(pg, name, {'mode': 'auto', 'pts': [[23.800, 61.512], [23.812, 61.5145], [23.826, 61.5140]], 'names': [[1, 'Lielahti']]})
        t = on_line(pg, 0, 0.3)
        press(pg, t, f'{name}: the line', touch)
        s = st(pg)
        if s['kind'] != 'route' or s['place'] != 'float' or s['n'] != s0['n'] or s['past'] != s0['past']:
            fails.append(f"{name}: a click on the line: {s['kind']} card ({s['place']}), {s['n'] - s0['n']} points added, {s['past'] - s0['past']} steps in Undo")
        else:
            f = s['first']
            near = f and round(math.hypot(max(0, f['box']['left'] - t['x'], t['x'] - f['box']['right']), max(0, f['box']['top'] - t['y'], t['y'] - f['box']['bottom'])))
            if not f or f['text'] != 'Add a point here' or near > 30:
                fails.append(f"{name}: the card's first button {f}, for a click at {t['x']}, {t['y']}")
            if s['values'][2:] != ['S1'] or s['words'] != ['fairly easy'] or s['labels'] != ['there at', s['labels'][1], 'difficulty'] or s['labels'][1] not in ('uphill', 'downhill'):
                fails.append(f"{name}: an mtb:scale=1 way's numbers: {s['values']} {s['words']} {s['labels']}")
            fails += [f'{name}: {o}' for o in pg.js(f"({RC_LOOK})(false)")]
            # What's here ›: the trail as the map knows it, your sport's first
            tap_row(pg, 'What’s here', name, touch)
            s = st(pg)
            if s['kind'] != 'here' or s['heads'][:2] != ['For MTB', 'For hiking'] or 'S1, fairly easy' not in s['text'] or 'T1, easy' not in s['text']:
                fails.append(f"{name}: What’s here ›: {s['kind']} card, groups {s['heads']}")
            press(pg, at(pg, "document.querySelector('.pl-way.card .way-back')"), f'{name}: Back', touch)
            # Edit this stretch: a stretch of one leg that follows paths has Other ways
            tap_row(pg, 'Edit this stretch', name, touch)
            s = st(pg)
            if s['kind'] != 'edit' or 'Other ways' not in s['rows']:
                fails.append(f"{name}: Edit this stretch of one leg: {s['kind']} card, rows {s['rows']}")
            close(pg)
            # the card open while its leg is routed again: it stays, and its numbers come with the answer
            press(pg, t, f'{name}: the line', touch)
            pg.js("window.rcTags = 'highway=track surface=gravel mtb:scale=0'; window.rcRelease = null; window.rcHold = new Promise((r) => { window.rcRelease = r; }); polku.planner.setStyle({ p: 'technical', v: {}, wet: 'auto' }); true")
            time.sleep(1.5)
            mid = st(pg)
            pg.js("window.rcRelease(); window.rcHold = null; true")
            r = pg.js("(async () => { const p = polku.planner; for (let k = 0; k < 100 && !p.analysisFits(); k++) await new Promise((x) => setTimeout(x, 100)); await new Promise((x) => setTimeout(x, 300)); return true; })()")
            s = st(pg)
            if mid['kind'] != 'route' or s['kind'] != 'route' or s['values'][2:] != ['S0']:
                fails.append(f"{name}: the route's card while its leg was routed again: {mid['kind']} card, then {s['kind']}, its difficulty {s['values'][2:]}")
            close(pg)
            # at the window's right edge it opens to the left; near the bottom upwards, its button still at the click
            for where, tx, ty in (('right edge', 1440 - 110, 'y'), ('bottom', 'x', 900 - 130)):
                pg.js(f"(() => {{ const m = polku.map, R = m.getCanvas().getBoundingClientRect(), q = m.project({json.dumps(t['ll'])}), x = R.left + q.x, y = R.top + q.y; m.panBy([x - ({tx}), y - ({ty})], {{ duration: 0 }}); return true; }})()")
                time.sleep(0.5)
                e = pg.js(f"(() => {{ const R = polku.map.getCanvas().getBoundingClientRect(), q = polku.map.project({json.dumps(t['ll'])}); return {{ x: Math.round(R.left + q.x), y: Math.round(R.top + q.y) }}; }})()")
                press(pg, e, f'{name}: the line at the {where}', touch)
                s = st(pg)
                c, f = s['card'], s['first']
                near = f and round(math.hypot(max(0, f['box']['left'] - e['x'], e['x'] - f['box']['right']), max(0, f['box']['top'] - e['y'], e['y'] - f['box']['bottom'])))
                if s['kind'] != 'route' or not c or c['left'] < 0 or c['right'] > 1440 or c['top'] < 0 or c['bottom'] > 900 or (where == 'right edge' and c['right'] > e['x'] + 1) or (where == 'bottom' and c['bottom'] > e['y'] + 1) or not f or near > 30:
                    fails.append(f"{name}: a click on the line at the {where} ({e['x']}, {e['y']}): {s['kind']} card at {c}, its button {f}")
                # at the window's middle height, where neither half holds the whole card (GitHub's runner clicked at 1330, 450):
                # it stays on the screen and scrolls inside, grown by a late box too
                if s['kind'] == 'route':
                    g = pg.js(f"""(async () => {{ const p = polku.planner, m = polku.map, ll = {json.dumps(t['ll'])}, R = m.getCanvas().getBoundingClientRect(), wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
                      p.cards.close(); let q = m.project(ll); m.panBy([R.left + q.x - 1330, R.top + q.y - 450], {{ duration: 0 }}); await wait(300);
                      p.openRouteCard(0, ll); await wait(600);
                      const box = () => {{ const r = document.querySelector('.pl-way.card').closest('.maplibregl-popup-content').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; }};
                      const opened = box(), k = p.cards.current, b = k.build;
                      k.build = (body) => {{ b(body); body.append(Object.assign(document.createElement('div'), {{ style: 'height: 300px' }})); }};
                      p.cards.refresh(); await wait(300);
                      const grown = box(); k.build = b; return {{ opened, grown }}; }})()""")
                    if min(g['opened'][0], g['grown'][0]) < 0 or max(g['opened'][1], g['grown'][1]) > 900:
                        fails.append(f"{name}: a card at the window's middle height: opened at {g['opened']}, grown at {g['grown']}")
                close(pg)
                pg.js("polku.planner.fitRoute({ animate: false }); true")
                time.sleep(0.5)
        keeps_view(pg, name, touch)
        # an imported track: its own line, so nothing to choose for how it's drawn
        pg.js("polku.planner.loadTrack([[23.800, 61.518], [23.805, 61.5185], [23.810, 61.519], [23.815, 61.5188]], 'A track'); polku.planner.fitRoute({ animate: false }); true")
        time.sleep(1.5)
        press(pg, on_line(pg, 0, 0.4), f'{name}: the track', touch)
        tap_row(pg, 'Edit this stretch', name, touch)
        s = st(pg)
        if s['kind'] != 'edit' or s['seg'] or 'Other ways' in s['rows']:
            fails.append(f"{name}: Edit this stretch on an imported track: {s['kind']} card, the switch {s['seg']}, rows {s['rows']}")
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    except Exception as e:
        fails.append(f"{name}: raised {type(e).__name__}: {str(e).splitlines()[0][:120]}, after {' / '.join(trail[-4:])}")
    pg.close()

    # ------------------------------------------------------------------ 200 %: a strip of map keeps the spot and the pill in sight [w-200]
    name = '390x844 at 200 %'
    pg = page(195, 422, True)
    try:
        route(pg, name, LINE)
        pg.js("(() => { const p = polku.planner, c = p.legs[1].result ? p.legs[1].result.coords : [p.points[1], p.points[2]]; p.openRouteCard(1, [(c[0][0] + c[c.length - 1][0]) / 2, (c[0][1] + c[c.length - 1][1]) / 2]); return true; })()")
        time.sleep(1.5)  # (the card's own look for its spot, 900 ms after it opens)
        r = pg.js("""(() => { const b = document.querySelector('.card-pill'), r = b && b.getBoundingClientRect(), top = r && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const p = polku.planner, R = polku.map.getCanvas().getBoundingClientRect(), q = polku.map.project(p.cards.current.key), card = document.querySelector('.pl-way.card').getBoundingClientRect();
          return { pill: !!b, over: !b || b.contains(top) ? '' : (top ? top.id || top.className || top.tagName : 'nothing'), spot: Math.round(R.top + q.y), card: Math.round(card.top) }; })()""")
        if not r['pill'] or r['over'] or r['spot'] >= r['card']:
            fails.append(f"{name}: the pill {'there' if r['pill'] else 'missing'}{', under ' + str(r['over']) if r['over'] else ''}; the spot at {r['spot']} px over a card from {r['card']} px")
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    except Exception as e:
        fails.append(f"{name}: raised {type(e).__name__}: {str(e).splitlines()[0][:120]}")
    pg.close()

    # ------------------------------------------------------------------ Paddle on Näsijärvi: wind and temperature; What's here on open water
    name = '390x844, Paddle'
    pg = page(390, 844, True, 'paddle')
    try:
        route(pg, name, {'mode': 'water', 'pts': [[23.745, 61.525], [23.790, 61.540]]})
        r = pg.js("""(async () => { const p = polku.planner, c = p.legs[0].result.coords; p.openRouteCard(0, [(c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2]); await new Promise((x) => setTimeout(x, 400));
          const labels = [...document.querySelectorAll('.pl-way.card .sum-item small')].map((e) => e.textContent);
          const row = [...document.querySelectorAll('.pl-way.card .row')].find((b) => b.querySelector('b').textContent === 'What’s here'), line = row && row.querySelector('small').textContent;
          row?.click(); await new Promise((x) => setTimeout(x, 400)); const c2 = document.querySelector('.pl-way.card');
          const x = p.cards.current && p.cards.current.kind === 'here' ? p.routeSpot(p.cards.current.key) : null;
          return { labels, line, kind: p.cards.current && p.cards.current.kind, way: x && x.kind, heads: c2 ? [...c2.querySelectorAll('.menu-h')].map((e) => e.textContent) : [], text: c2 ? c2.textContent : '' }; })()""")
        if r['labels'][:1] != ['there at'] or r['labels'][1:] not in (['wind', 'temperature'], ['wind not known yet', 'temperature not known yet']):
            fails.append(f"{name}: a paddle route's numbers: {r['labels']}")
        if r['kind'] != 'here' or r['way'] != 'open water' or r['heads'] or 'trail' in (r['line'] or '') or 'no trail' not in r['text']:
            fails.append(f"{name}: What’s here on the water ({r['way']}): its row's line “{r['line']}”, groups {r['heads']}")
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    except Exception as e:
        fails.append(f"{name}: raised {type(e).__name__}: {str(e).splitlines()[0][:120]}")
    pg.close()

    # ------------------------------------------------------------------ Hike: the trail grade, and MTB's still in What's here
    name, touch = '390x844, Hike', True
    pg = page(390, 844, True, 'hike')
    try:
        route(pg, name, {'mode': 'auto', 'pts': [[23.800, 61.512], [23.812, 61.5145]]})
        press(pg, on_line(pg, 0, 0.3), f'{name}: the line', touch)
        s = st(pg)
        if s['kind'] != 'route' or s['labels'][2:] != ['trail grade'] or s['values'][2:] != ['T1'] or s['words'] != ['easy']:
            fails.append(f"{name}: a Hike route's numbers: {s['kind']} card, {s['values']} {s['words']} {s['labels']}")
        tap_row(pg, 'What’s here', name, touch)
        s = st(pg)
        if s['heads'][:2] != ['For hiking', 'For MTB'] or 'Difficulty' not in s['text']:
            fails.append(f"{name}: What’s here in Hike: groups {s['heads']}")
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    except Exception as e:
        fails.append(f"{name}: raised {type(e).__name__}: {str(e).splitlines()[0][:120]}, after {' / '.join(trail[-4:])}")
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the route's card and a stretch's (25d 1b): a tap on the route, Add a point here, This stretch, What's here, Edit this stretch, the whole route, the start's Back to start, End" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Hold the map to see what's there (25d part 5): a finger held still 0.5 s, or a right-click, opens the spot's card; a
# shorter press is a tap, a move or a second finger the map's own; a ring fills under the finger meanwhile. The card's
# pill adds the spot where it fits in the route (or on the line beside it, or starts a route), Start here and End here
# add a new start or end; a hold on the route while drawing is Edit this stretch, and a move after 0.3 s still reshapes
# it; a tap on a place's icon shows its card instead of adding a point. Straight legs, BRouter answered here.
SC_HELP = """(() => {
  const p = polku.planner, m = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms)), log = [];
  const R = () => m.getCanvas().getBoundingClientRect();
  const free = () => { const top = document.querySelector('.topbar').getBoundingClientRect().bottom + 40, bottom = Math.min(p.active && p.layout() === 'sheet' ? p.panel.getBoundingClientRect().top : innerHeight, innerHeight) - 40; return { top, bottom }; };
  // the screen spot of a [lng, lat], if the map itself is there, clear of the route, the points and the places
  const clear = (ll, { line = 40 } = {}) => {
    const r = R(), q = m.project(ll), x = Math.round(r.left + q.x), y = Math.round(r.top + q.y), f = free(), el = document.elementFromPoint(x, y);
    const no = (why) => { sc.why = `${why} at ${x},${y} (free ${Math.round(f.top)}–${Math.round(f.bottom)})`; return null; };
    if (x < 40 || x > innerWidth - 90 || y < f.top || y > f.bottom) return no('off the free map');
    if (el !== m.getCanvas()) return no(`under ${el && (el.id || String(el.className.baseVal ?? el.className))}`);
    const box = (d) => [[q.x - d, q.y - d], [q.x + d, q.y + d]], layers = (ids) => ids.filter((id) => m.getLayer(id));
    if (line && layers(['route-casing']).length && m.queryRenderedFeatures(box(line), { layers: ['route-casing'] }).length) return no('on the route');
    if (m.queryRenderedFeatures(box(16), { layers: layers(['poi-outdoor', 'poi-minor', 'label-peak', 'lipas-point', 'td-points']) }).length) return no('on a place');
    return { x, y, ll: m.unproject(q).toArray() };
  };
  // (the map's middle as the finger went down and as it lifted: whether the gesture moved it, whatever moves it after)
  m.on('touchstart', (e) => { sc.down = performance.now(); sc.lag = Math.round(sc.down - e.originalEvent.timeStamp); sc.rings = []; sc.moves = 0; sc.panned = false; sc.evs = []; log.push('down'); });
  for (const k of ['movestart', 'moveend', 'dragstart', 'dragend']) m.on(k, (e) => { if (sc.evs) sc.evs.push(`${k}${e.originalEvent ? `:${e.originalEvent.type}` : ''}`); });
  m.on('touchmove', () => { sc.moves++; });
  m.on('touchend', () => { log.push('up'); });
  // (the finger moved the map: a move of the map's by a touch, though an ease may have begun the movement)
  m.on('move', (e) => { if (e.originalEvent && e.originalEvent.type === 'touchmove') sc.panned = true; });
  new MutationObserver((ms) => { for (const r of ms) { for (const n of r.addedNodes) if (n.classList && n.classList.contains('hold-ring')) sc.rings[0] = performance.now(); for (const n of r.removedNodes) if (n.classList && n.classList.contains('hold-ring')) sc.rings[1] = performance.now(); } }).observe(document.body, { childList: true });
  // what the cards did, for a FAIL line
  const open = p.cards.open.bind(p.cards), close = p.cards.close.bind(p.cards);
  p.cards.open = (c, o) => { log.push(`open ${c.kind}`); return open(c, o); };
  p.cards.close = (o) => { if (p.cards.current) log.push(`close ${p.cards.current.kind} (${(new Error().stack.split('\\n')[2] || '').trim().replace(/^at /, '').replace(/ \\(.*/, '')})`); return close(o); };
  const panBy = m.panBy.bind(m), jumpTo = m.jumpTo.bind(m);
  m.panBy = (o, ...a) => { log.push(`pan ${Math.round(o[0])},${Math.round(o[1])}`); return panBy(o, ...a); };
  m.jumpTo = (o, ...a) => { log.push('jump'); return jumpTo(o, ...a); };
  window.sc = {
    log: () => log.splice(0).slice(-6).join(', ') || 'none',
    // the planner open and drawing, no route, the map at the place and still
    async fresh(center = [23.818, 61.514], zoom = 15) {
      p.setActive(true, { edit: true }); p.clear(); p.setMode('line'); p.cards.close();
      if (p.layout() === 'sheet') p.setSheetState('peek');
      document.querySelector('#toast').classList.remove('show');
      m.jumpTo({ center, zoom, bearing: 0, pitch: 0 });
      await new Promise((ok) => { const t = setTimeout(ok, 5000); m.once('idle', () => { clearTimeout(t); ok(); }); });
      await wait(300);
      return true;
    },
    // a free spot on the map, looked for around the middle of what's free
    spot(opts = {}) {
      const r = R(), f = free(), cx = innerWidth / 2 - 30, cy = (f.top + f.bottom) / 2;
      for (let d = 0; d < 260; d += 14) for (const [dx, dy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]]) {
        const s = clear(m.unproject([cx + dx - r.left, cy + dy - r.top]).toArray(), opts);
        if (s) return s;
      }
      return null;
    },
    at: (ll, opts) => clear(ll, opts),
    // the map's places hidden (or back), so a hold or a tap on the free map is never on one, whatever the tiles have
    places: (on) => { for (const id of ['poi-outdoor', 'poi-minor', 'label-peak', 'lipas-point', 'td-points']) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); return true; },
    // the map at a share of its width and height, if it's free there
    spotAt(fx, fy, opts) { const r = R(); return clear(m.unproject([r.width * fx, r.height * fy]).toArray(), opts); },
    // a way under the screen at a share of its height (a tap there shows its card with the planner put away), clear of the places
    wayAt(fy) {
      const r = R();
      for (let fx = 0.15; fx < 0.8; fx += 0.03) for (const dy of [0, 0.02, -0.02, 0.04, -0.04]) {
        const q = [r.width * fx, r.height * (fy + dy)], box = [[q[0] - 14, q[1] - 14], [q[0] + 14, q[1] + 14]];
        if (!m.queryRenderedFeatures(box, { layers: ['path-ground', 'track-ground', 'cycleway-ground', 'path-osm-ground'].filter((id) => m.getLayer(id)) }).length) continue;
        const s = clear(m.unproject(q).toArray(), { line: 0 });
        if (s) return s;
      }
      return null;
    },
    // the map and the card at rest: the map not moving and the pill (if any) in the same place twice, two frames apart
    calm: async () => {
      const at = () => { const b = document.querySelector('.card-pill'); return b ? JSON.stringify(b.getBoundingClientRect()) : ''; };
      let a = at(), same = 0;
      for (let k = 0; k < 120 && same < 3; k++) { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); await wait(60); const b = at(); same = b === a && !m.isMoving() ? same + 1 : 0; a = b; }
      return same >= 3;
    },
    // the map at rest (a point just added may still ease it), and the page drawing its frames on time again
    still: async () => {
      for (let k = 0; k < 50 && m.isMoving(); k++) await wait(100);
      let calm = 0, t = performance.now();
      for (let k = 0; k < 300 && calm < 5; k++) { await new Promise((r) => requestAnimationFrame(r)); const n = performance.now(); calm = n - t < 50 ? calm + 1 : 0; t = n; }
      return !m.isMoving();
    },
    // a place's icon drawn on the map, in sight and clear of the planner, once the tiles have it (8 s at most): { x, y, name }
    async place() {
      let why = [];
      for (let k = 0; k < 40; k++) {
        const r = R(), f = free();
        why = [];
        for (const x of m.queryRenderedFeatures({ layers: ['poi-outdoor', 'lipas-point', 'poi-minor'].filter((id) => m.getLayer(id)) })) {
          const q = m.project(x.geometry.coordinates), sx = r.left + q.x, sy = r.top + q.y, el = document.elementFromPoint(sx, sy);
          if (sx > 40 && sx < innerWidth - 90 && sy > f.top && sy < f.bottom + 20 && el === m.getCanvas()) return { x: Math.round(sx), y: Math.round(sy), name: x.properties.name || x.properties.class };
          why.push(`${Math.round(sx)},${Math.round(sy)} in ${Math.round(f.top)}–${Math.round(f.bottom)} under ${el && (el.id || String(el.className.baseVal ?? el.className))}`);
        }
        await wait(200);
      }
      return { why: why.length ? why.join('; ') : `none drawn at ${m.getCenter().toArray().map((v) => v.toFixed(4))} z${m.getZoom().toFixed(1)}` };
    },
    // a spot beside it, 40 to 70 px away, on a way, with no place near: a tap there adds a point
    beside(pl) {
      const r = R();
      for (const [dx, dy] of [[50, 0], [-50, 0], [0, 50], [0, -50], [60, 40], [-60, 40], [60, -40], [-60, -40]]) {
        const x = pl.x + dx, y = pl.y + dy, s = clear(m.unproject([x - r.left, y - r.top]).toArray(), { line: 0 });
        if (s) return s;
      }
      return null;
    },
    // when the ring came and went, after the touch that began the hold, by the page's own clock (a busy page sees a
    // touch late): [in, out] in ms
    ring: () => (sc.rings.length ? [Math.round(sc.rings[0] - sc.down), sc.rings[1] == null ? null : Math.round(sc.rings[1] - sc.down)] : null),
    rings: [], down: 0,
    untilCard: () => new Promise((done) => { const t0 = Date.now(), f = () => (p.cards.current || Date.now() - t0 > 3000 ? done(true) : setTimeout(f, 20)); f(); }),
    note: () => (document.querySelector('#toast.show') ? document.querySelector('#toast').textContent : ''),
    looks: () => {
      const s = (e) => getComputedStyle(e), c = m.getCanvasContainer(), mk = document.querySelector('.maplibregl-marker'), card = document.querySelector('.pl-way.card');
      // (iOS's callout and magnifier need a real phone: Chrome drops -webkit-touch-callout)
      return { canvas: s(c).userSelect, marker: mk ? s(mk).userSelect : null, card: card ? s(card).userSelect : null };
    },
  };
  return true;
})()"""


# what's over a card's pill, or beside it where it would take its tap: the map's buttons, the scale and credits, the toolbox
# (their boxes against the pill's whole box, not only its middle); '' when nothing
PILL_OVER = """(() => { const b = document.querySelector('.card-pill'); if (!b) return ''; const r = b.getBoundingClientRect(), vis = (e) => e && e.getClientRects().length && !e.hidden && getComputedStyle(e).visibility !== 'hidden';
  const hit = ['#map-ctrls', '.maplibregl-ctrl-bottom-left', '#pl-tools', '#zoom-hint', '.topbar'].filter((sel) => { const e = document.querySelector(sel); if (!vis(e)) return false;
    return [...(e.matches('#map-ctrls, .maplibregl-ctrl-bottom-left') ? e.querySelectorAll('button, .maplibregl-ctrl-scale, a, .tool') : [e])].some((c) => { if (!c.getClientRects().length) return false; const q = c.getBoundingClientRect();
      return q.width && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top; }); });
  return hit.join(', '); })()"""


def spot_card(chrome):
    fails, trail = [], []
    st = lambda pg: pg.js(RC_STATE)
    on_line = lambda pg, li, t: (pg.js(SETTLED), pg.js(f"({RC_ON})({li}, {t})"))[1]
    row = lambda label: f"[...document.querySelectorAll('.pl-way.card .row')].find((b) => b.getClientRects().length && b.querySelector('b').textContent === {json.dumps(label)})"
    at = lambda pg, x: (pg.js(SETTLED), pg.js(f"({PC_STILL})(() => ({x}))"))[1]

    def hold(pg, s, secs, moves=(), checks=()):
        """A finger at s for secs by its own times: moves [(at, dx, dy)], checks [(at, js)] run then; their answers."""
        t0, out = time.time(), []
        pg.touch('start', s['x'], s['y'], t0)
        for when, kind, a, b in sorted([(w, 'move', dx, dy) for w, dx, dy in moves] + [(w, 'check', js, None) for w, js in checks], key=lambda e: e[0]):
            time.sleep(max(0, t0 + when - time.time()))
            if kind == 'move':
                pg.touch('move', s['x'] + a, s['y'] + b, t0 + when)
            else:
                out.append(pg.js(a))
        time.sleep(max(0, t0 + secs - time.time()))
        pg.touch('end', at=t0 + secs)
        time.sleep(0.6)
        if os.environ.get('SC_DEBUG'):
            print('     hold', secs, s, pg.js('sc.log()'), pg.js('({ card: polku.planner.cards.current && polku.planner.cards.current.kind, depth: polku.planner.cards.depth, hist: history.length, url: location.href })'), flush=True)
        return out

    def press(pg, s, name, touch):
        trail.append(name)
        if not s:
            fails.append(f'{name}: not on screen')
            return False
        if touch:
            pg.quick_tap(s['x'], s['y'])
        else:
            for kind in ('mouseMoved', 'mousePressed', 'mouseReleased'):
                pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': s['x'], 'y': s['y'], 'button': 'none' if kind == 'mouseMoved' else 'left', 'buttons': 1 if kind == 'mousePressed' else 0, 'clickCount': 1}, pg.s)
        time.sleep(0.6)
        return True

    def right(pg, s, to=None):
        """A right-click at s; with `to`, a right-drag to it (the map turns)."""
        pg.c.send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': s['x'], 'y': s['y'], 'button': 'none'}, pg.s)
        pg.c.send('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': s['x'], 'y': s['y'], 'button': 'right', 'buttons': 2, 'clickCount': 1}, pg.s)
        end = to or s
        if to:
            for k in range(1, 9):
                pg.c.send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': s['x'] + (to['x'] - s['x']) * k / 8, 'y': s['y'] + (to['y'] - s['y']) * k / 8, 'button': 'right', 'buttons': 2}, pg.s)
                time.sleep(0.03)
        pg.c.send('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': end['x'], 'y': end['y'], 'button': 'right', 'buttons': 0, 'clickCount': 1}, pg.s)
        time.sleep(0.6)

    def page(w, h_, phone):
        pg = chrome.page(w, h_, phone)
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"', 'polku:plannerDock': '"left"'}, '#15/61.514/23.818')
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        pg.js(RC_ROUTER)
        pg.js(SC_HELP)
        pg.js('sc.places(false)')  # (a hold or a tap is never on a place unless the check says so, whatever the tiles have)
        return pg

    def route(pg, name, o):
        if not pg.js(f"({RC_ROUTE})({json.dumps(o)})", timeout=60000):
            fails.append(f'{name}: the route wasn’t routed')
        pg.js("polku.map.jumpTo({ center: [23.815, 61.514], zoom: 14 }); new Promise((r) => setTimeout(r, 800))")
        return st(pg)

    A, B, C = [23.800, 61.512], [23.815, 61.5155], [23.830, 61.513]
    ROUTE = {'mode': 'auto', 'pts': [A, B, C], 'names': [[0, 'Kaupintie']]}

    # ------------------------------------------------------------------ a phone, by touch
    name = '390x844'
    pg = page(390, 844, True)
    try:
        # no route: the hold's card at its spot, a ring under the finger from 0.15 s, Round trip from here the only
        # thing of Your route, and the pill starts a route
        pg.js('sc.fresh()')
        pg.js('sc.still()')  # (a page drawing on time, so its timers run when they should)
        pg.js('sc.still()')  # (the map at rest: a tap on a map still easing from the last card isn't a tap)
        s = pg.js('sc.spot()')
        hold(pg, s, 0.65)
        c, ring = st(pg), pg.js('sc.ring()')
        if not ring or not 140 <= ring[0] <= 400 or ring[1] is None or ring[1] < ring[0] or pg.js("!!document.querySelector('.hold-ring')"):
            fails.append(f"{name}: the ring came and went at {ring} ms of the hold (from 150 ms, gone with the card; the touch seen {pg.js('sc.lag')} ms late)")
        if c['kind'] != 'spot' or c['place'] != 'peek' or c['n'] != 0:
            fails.append(f"{name}: a finger held 0.65 s with no route: {c['kind'] or 'no'} card ({c['place']}), {c['n']} points")
        else:
            if c['rows'] != ['What’s here', 'Round trip from here'] or not c['pill'] or 'from your route' in c['labels'] or c['labels'][:1] != ['height']:
                fails.append(f"{name}: no route, the spot's card: rows {c['rows']}, numbers {c['labels']}, pill {bool(c['pill'])}")
            pill = pg.js("document.querySelector('.card-pill')?.textContent.trim()")
            if pill != 'Start a route here':
                fails.append(f"{name}: no route, the pill says “{pill}”")
            # Android's contextmenu after the hold: no second card
            pg.js("window.scCard = polku.planner.cards.current; true")
            pg.js(f"polku.map.getCanvas().dispatchEvent(new MouseEvent('contextmenu', {{ clientX: {s['x']}, clientY: {s['y']}, button: 2, bubbles: true, cancelable: true }})); true")
            time.sleep(0.4)
            if not pg.js("polku.planner.cards.current === window.scCard"):
                fails.append(f"{name}: Android's contextmenu after the hold opened another card")
            lk = pg.js('sc.looks()')
            if lk['canvas'] != 'none' or lk['card'] == 'none':
                fails.append(f"{name}: a hold selects the map's text ({lk['canvas']}), or the card's text can't be selected ({lk['card']})")
            # the pill: a route of one point, drawing; the first point's peek says how to see what's there
            press(pg, at(pg, "document.querySelector('.card-pill')"), f'{name}: Start a route here', True)
            r = pg.js("(() => { const p = polku.planner; return { n: p.points.length, editing: p.editing && p.active, card: !!p.cards.current, tip: document.querySelector('#planner .sum-empty small')?.textContent || '' }; })()")
            if r['n'] != 1 or not r['editing'] or r['card'] or r['tip'] != 'Hold the map to see what’s there.':
                fails.append(f'{name}: Start a route here: {r}')
        # held 0.3 s: a tap, one point, no card; the first point's line goes with the second point
        pg.js('sc.still()')  # (the map at rest: a tap on a map still easing from the last card isn't a tap)
        s = pg.js('sc.spot()')
        hold(pg, s, 0.3)
        r = pg.js("(() => { const p = polku.planner; return { n: p.points.length, card: p.cards.current && p.cards.current.kind, tip: !!document.querySelector('#planner .sum-empty small') }; })()")
        if r['n'] != 2 or r['card'] or r['tip']:
            fails.append(f'{name}: a finger held 0.3 s: {r} (a second point, no card, no line about holding)')
        # a move of 12 px at 0.2 s: the map's, no card, no point; two fingers: nothing
        pg.js('sc.still()')
        pg.js('sc.still()')  # (the map at rest: a tap on a map still easing from the last card isn't a tap)
        s = pg.js('sc.spot()')
        hold(pg, s, 0.7, moves=[(0.1, 0, 6), (0.2, 0, 12), (0.25, 0, 20), (0.3, 0, 30), (0.35, 0, 40), (0.4, 0, 50)])
        r = pg.js("(() => { const p = polku.planner; return { n: p.points.length, card: p.cards.current && p.cards.current.kind, moved: sc.panned, moves: sc.moves, evs: sc.evs, lag: sc.lag, pan: polku.map.dragPan.isEnabled() }; })()")
        if r['n'] != 2 or r['card'] or not r['moved']:
            fails.append(f"{name}: a finger moved 12 px at 0.2 s: {r['n']} points, {r['card'] or 'no'} card, the map {'moved' if r['moved'] else 'still'} under it ({r['moves']} moves seen, the map's {r['evs']}, the touch seen {r['lag']} ms late, the pan {'on' if r['pan'] else 'off'})")
        pg.js('sc.still()')  # (the map at rest: a tap on a map still easing from the last card isn't a tap)
        s = pg.js('sc.spot()')
        t0 = time.time()
        pg.c.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': s['x'], 'y': s['y'], 'id': 1}, {'x': s['x'] + 60, 'y': s['y'] + 20, 'id': 2}], 'timestamp': t0}, pg.s)
        time.sleep(0.7)
        pg.c.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': [], 'timestamp': t0 + 0.7}, pg.s)
        time.sleep(0.6)
        r = pg.js("(() => { const p = polku.planner; return { n: p.points.length, card: p.cards.current && p.cards.current.kind }; })()")
        if r['n'] != 2 or r['card']:
            fails.append(f"{name}: two fingers held 0.7 s: {r['n']} points, {r['card'] or 'no'} card")
        # a quick tap that a busy page sees late, after the hold's time (#293): a tap, a point, no card
        pg.js('sc.still()')  # (the map at rest: a tap on a map still easing from the last card isn't a tap)
        s = pg.js('sc.spot()')
        pg.quick_tap(s['x'], s['y'], ms=50, after='sc.untilCard()')
        time.sleep(0.8)
        r = pg.js("(() => { const p = polku.planner; return { n: p.points.length, card: p.cards.current && p.cards.current.kind }; })()")
        if r['n'] != 3 or r['card']:
            fails.append(f"{name}: a quick tap seen late by a busy page: {r['n']} points (3), {r['card'] or 'no'} card")

        # A, B, C: + Add to my route where it fits, the note naming the point it follows; one step of Undo
        route(pg, name, ROUTE)
        pg.js("polku.map.jumpTo({ center: [23.8193, 61.5135], zoom: 12 }); new Promise((r) => setTimeout(r, 800))")  # (all three spots on a 390 px map)
        cam = "(() => { const v = polku.planner.viewPadding(0); polku.map.jumpTo({ center: [23.8193, 61.5135], zoom: 12, offset: [(v.left - v.right) / 2, (v.top - v.bottom) / 2] }); })();  polku.planner.cards.close(); document.querySelector('#toast').classList.remove('show'); new Promise((r) => setTimeout(() => r(true), 900))"  # (the camera as the spots below assume it: an earlier card may have moved it)
        for what, lls, want in (('beside the middle of A–B', [[(A[0] + B[0]) / 2 - 0.0033, (A[1] + B[1]) / 2 + 0.0032], [(A[0] + B[0]) / 2 - 0.0028, (A[1] + B[1]) / 2 + 0.0036]], 1),
                                ('past C', [[C[0] + 0.005, C[1] - 0.001], [C[0] + 0.005, C[1] + 0.001]], 3), ('behind A', [[A[0] - 0.005 + dx, A[1] + dy] for dx in (0, 0.001, -0.001) for dy in (-0.001, 0.001, -0.002, 0.002, 0)], 1)):
            pg.js(cam)
            s = next((x for x in (pg.js(f'sc.at({json.dumps(q)}, {{ line: 12 }})') for q in lls) if x), None)  # (the first that's clear of the map's places)
            ll = s and s['ll']
            if not s:
                fails.append(f"{name}: the spot {what} is not on the free map: {pg.js('sc.why')}")
                continue
            past, n = st(pg)['past'], st(pg)['n']
            hold(pg, s, 0.65)
            c = st(pg)
            pill = pg.js("document.querySelector('.card-pill')?.textContent.trim()")
            pg.js('sc.calm()')
            over = pg.js(PILL_OVER)
            if over:
                fails.append(f'{name}: held {what}: {over} over the pill')
            if c['kind'] != 'spot' or c['labels'][:1] != ['from your route'] or pill != 'Add to my route' or c['rows'][:1] != ['What’s here'] or not {'Start here', 'End here', 'Avoid this spot'} <= set(c['rows']):
                fails.append(f"{name}: held {what}: {c['kind']} card, numbers {c['labels']}, pill “{pill}”, rows {c['rows']}")
                pg.js('polku.planner.cards.close(); true')
                continue
            press(pg, at(pg, "document.querySelector('.card-pill')"), f'{name}: Add to my route {what}', True)
            r = pg.js(f"(() => {{ const p = polku.planner, s = {json.dumps(ll)}; return {{ n: p.points.length, past: p.past.length, i: p.points.findIndex((q) => Math.abs(q[0] - s[0]) < 4e-4 && Math.abs(q[1] - s[1]) < 2e-4), note: sc.note() }}; }})()")
            after = 'Kaupintie' if want == 1 else 'End'
            if r['n'] != n + 1 or r['past'] != past + 1 or r['i'] != want or not r['note'].startswith(f'Added after {after}'):
                fails.append(f"{name}: Add to my route {what}: {r} (point {want}, “Added after {after}”, one step of Undo)")
            pg.js('polku.planner.undo(); true')
            time.sleep(0.6)
            if st(pg)['n'] != n:
                fails.append(f"{name}: Undo after Add to my route {what}: {st(pg)['n']} points, not {n}")
        # a spot 20 m from the line: Add a point here, on the line, no routing call
        mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]
        near = [mid[0] - 0.00012, mid[1] + 0.00016]  # (about 20 m from A–B)
        pg.js(f"(() => {{ const v = polku.planner.viewPadding(0); polku.map.jumpTo({{ center: {json.dumps(near)}, zoom: 17, offset: [(v.left - v.right) / 2, (v.top - v.bottom) / 2] }}); }})(); polku.planner.cards.close(); document.querySelector('#toast').classList.remove('show'); new Promise((r) => setTimeout(() => r(true), 900))")
        s = pg.js(f'sc.at({json.dumps(near)}, {{ line: 0 }})')
        if not s:
            fails.append(f"{name}: the spot 20 m from the line is not on the free map: {pg.js('sc.why')}")
        else:
            past, calls = st(pg)['past'], st(pg)['calls']
            hold(pg, s, 0.65)
            pill = pg.js("document.querySelector('.card-pill')?.textContent.trim()")
            if pill != 'Add a point here':
                fails.append(f'{name}: held 20 m from the line, the pill says “{pill}”')
            pg.js('sc.calm()')
            pill_at = at(pg, "document.querySelector('.card-pill')")
            n_before = pg.js('polku.planner.points.length')
            press(pg, pill_at, f'{name}: Add a point here', True)
            for _ in range(12):  # (the tap's answer, on a slow page a moment after)
                if pg.js('polku.planner.points.length') != n_before:
                    break
                time.sleep(0.25)
            r = pg.js(f"""(() => {{ const p = polku.planner, q = p.points[1], a = {json.dumps(A)}, b = {json.dumps(B)}, k = Math.cos(q[1] * Math.PI / 180) * 111320;
              const x = (u) => [(u[0] - a[0]) * k, (u[1] - a[1]) * 111320], Bq = x(b), Q = x(q), f = Math.max(0, Math.min(1, (Q[0] * Bq[0] + Q[1] * Bq[1]) / (Bq[0] ** 2 + Bq[1] ** 2)));
              return {{ n: p.points.length, past: p.past.length, calls: (window.routerCalls || []).length, line: Math.hypot(Q[0] - f * Bq[0], Q[1] - f * Bq[1]) }}; }})()""")
            if r['n'] != 4 or r['past'] != past + 1 or r['calls'] != calls or r['line'] > 2:
                fails.append(f"{name}: Add a point here 20 m from the line: {r} (4 points, on the line, no call); the pill at {pill_at} over {pg.js(PILL_OVER) or 'nothing'}, the cards: {pg.js('sc.log()')}")
            pg.js('polku.planner.undo(); true')
            time.sleep(0.6)
        route(pg, name, ROUTE)
        # Start here: a new start, the old one now Via 1, nothing removed; End here: a new end; one step of Undo each
        for label, want in (('Start here', 0), ('End here', 3)):
            pg.js('sc.still()')  # (the map at rest: a tap on a map still easing from the last card isn't a tap)
            s = pg.js('sc.spot()')
            past = st(pg)['past']
            hold(pg, s, 0.65)
            press(pg, at(pg, row(label)), f'{name}: {label}', True)
            r = pg.js(f"(() => {{ const p = polku.planner, s = {json.dumps(s['ll'])}; return {{ n: p.points.length, past: p.past.length, i: p.points.findIndex((q) => Math.abs(q[0] - s[0]) < 2e-4 && Math.abs(q[1] - s[1]) < 1e-4), old: p.nameOf(1), note: sc.note() }}; }})()")
            if r['n'] != 4 or r['past'] != past + 1 or r['i'] != want or (want == 0 and r['old'] != 'Kaupintie') or not r['note']:
                fails.append(f'{name}: {label} on a spot: {r} (point {want}, the old start Via 1, a note, one step of Undo)')
            pg.js('polku.planner.undo(); true')
            time.sleep(0.6)
        # the line: held still 0.5 s, Edit this stretch, nothing split; held 0.3 s and moved 30 px, reshaped; a quick tap,
        # the route's card
        t = on_line(pg, 0, 0.3)
        n, past = st(pg)['n'], st(pg)['past']
        hold(pg, t, 0.7)
        c = st(pg)
        if c['kind'] != 'edit' or c['n'] != n or c['past'] != past:
            fails.append(f"{name}: the line held still 0.7 s: {c['kind'] or 'no'} card, {c['n'] - n} points added, {c['past'] - past} steps in Undo (Edit this stretch, nothing split)")
        pg.js('polku.planner.cards.close(); true')
        t = on_line(pg, 0, 0.3)
        hold(pg, t, 0.75, moves=[(0.35, 0, 8), (0.4, 0, 16), (0.45, 0, 24), (0.5, 0, 30), (0.6, 0, 30)])
        c = st(pg)
        if c['n'] != n + 1 or c['past'] != past + 1 or c['kind']:
            fails.append(f"{name}: the line held 0.3 s and moved 30 px: {c['n'] - n} points added, {c['past'] - past} steps in Undo, {c['kind'] or 'no'} card (one point, reshaped)")
        pg.js('polku.planner.undo(); true')
        time.sleep(0.6)
        # a second finger on the held line: the map's pinch, nothing split, however long the first has held (armed at 0.3 s)
        t = on_line(pg, 0, 0.3)
        n, past = st(pg)['n'], st(pg)['past']
        finger = lambda kind, pts: pg.c.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': pts, 'timestamp': time.time()}, pg.s)
        one = {'x': t['x'], 'y': t['y'], 'id': 1}
        finger('touchStart', [one])
        time.sleep(0.34)  # (armed at 0.3 s, and well before Edit this stretch's 0.5 s, which a slow page reaches soon after)
        finger('touchStart', [one, {'x': t['x'] + 90, 'y': t['y'] + 60, 'id': 2}])
        for k in range(1, 6):
            time.sleep(0.03)
            finger('touchMove', [{'x': t['x'] + 12 * k, 'y': t['y'] - 12 * k, 'id': 1}, {'x': t['x'] + 90 - 12 * k, 'y': t['y'] + 60 + 12 * k, 'id': 2}])
        finger('touchEnd', [])
        time.sleep(0.8)
        r = pg.js("({ n: polku.planner.points.length, past: polku.planner.past.length, edit: !!polku.planner.edit, pan: polku.map.dragPan.isEnabled(), kind: polku.planner.cards.current && polku.planner.cards.current.kind })")
        # (on a slow page Edit this stretch's timer can run before the second finger is handled: a hold after all, its card open,
        # and nothing to split; it's a point added that this is about)
        if r['n'] != n or r['past'] != past or r['edit'] or not r['pan'] or r['kind'] not in (None, 'edit'):
            fails.append(f"{name}: a second finger on the held line: {r['n'] - n} points added, {r['past'] - past} steps in Undo, editing {r['edit']}, the map's pan {'on' if r['pan'] else 'off'}, {r['kind'] or 'no'} card")
        pg.js('polku.planner.cards.close(); true')
        t = on_line(pg, 0, 0.3)
        pg.quick_tap(t['x'], t['y'], ms=200)
        time.sleep(0.6)
        if st(pg)['kind'] != 'route':
            fails.append(f"{name}: a 0.2 s tap on the line: {st(pg)['kind'] or 'no'} card, not the route's")
        pg.js('polku.planner.cards.close(); true')
        # the route's view: no pill, only What's here, the planner's note with Edit
        pg.js("polku.planner.setEditing(false); polku.map.jumpTo({ center: [23.815, 61.514], zoom: 14 }); new Promise((r) => setTimeout(r, 800))")
        pg.js('sc.still()')  # (the map at rest: a tap on a map still easing from the last card isn't a tap)
        s = pg.js('sc.spot()')
        hold(pg, s, 0.65)
        c = st(pg)
        if c['kind'] != 'spot' or c['pill'] or c['rows'] != ['What’s here'] or not c['note']:
            fails.append(f"{name}: held in the route's view: {c['kind']} card, pill {bool(c['pill'])}, rows {c['rows']}, the note {c['note']}")
        pg.js('polku.planner.cards.close(); polku.planner.setEditing(true); true')
        # the planner put away: the card at the spot
        pg.js("polku.planner.setActive(false); new Promise((r) => setTimeout(r, 600))")
        pg.js('sc.still()')  # (the map at rest: a tap on a map still easing from the last card isn't a tap)
        s = pg.js('sc.spot()')
        hold(pg, s, 0.65)
        c = st(pg)
        if c['kind'] != 'spot' or c['place'] != 'float':
            fails.append(f"{name}: held with the planner put away: {c['kind'] or 'no'} card ({c['place']}; the cards: {pg.js('sc.log()')})")
        pg.js('polku.planner.cards.close(); true')
        # a place's icon while drawing: its card, no point; the way beside it: a point
        pg.js('sc.places(true)')
        pg.js('sc.fresh([23.8167, 61.5076], 15)')  # (a shelter in OpenFreeMap's tiles, a LIPAS campfire site: a little above the middle, clear of a tall start)
        pl = pg.js('sc.place()')
        if not pl or 'why' in pl:
            fails.append(f"{name}: no place on the map to tap (OpenFreeMap's tiles): {pl and pl['why']}")
        else:
            pg.js('sc.still()')
            again = pg.js('sc.place()')  # (where it is now: the map may have eased since)
            pl = again if again and 'why' not in again else pl
            under = pg.js(f"(() => {{ const e = document.elementFromPoint({pl.get('x', 0)}, {pl.get('y', 0)}); return e ? e.id || String(e.className.baseVal ?? e.className) : 'nothing'; }})()")
            press(pg, pl, f'{name}: a place', True)
            for _ in range(12):  # (a tap a busy page took for a hold is replayed a moment after)
                c = st(pg)
                if c['kind'] == 'place' or c['n']:
                    break
                time.sleep(0.25)
            if c['kind'] != 'place' or c['n'] != 0:
                fails.append(f"{name}: a tap on {pl['name']}: {c['kind'] or 'no'} card, {c['n']} points (the finger at {pl.get('x')},{pl.get('y')} on {under}; the cards: {pg.js('sc.log()')})")
            pg.js('polku.planner.cards.close(); true')
            pg.js('sc.still()')
            press(pg, pg.js(f'sc.beside({json.dumps(pl)})'), f'{name}: beside the place', True)
            for _ in range(12):
                if st(pg)['n'] == 1:
                    break
                time.sleep(0.25)
            if st(pg)['n'] != 1:
                fails.append(f"{name}: a tap beside {pl['name']}: {st(pg)['n']} points, not 1")
        # a quick tap on a busy page with the planner put away, near the top (#293): a tap, so the card of the tapped spot, though
        # the hold's timer had opened its card first and moved the map to make room; once, whole on the screen
        pg.js('sc.places(false)')
        pg.js("polku.planner.cards.close(); polku.planner.setActive(false); polku.map.jumpTo({ center: [23.8193, 61.5135], zoom: 15 }); new Promise((r) => setTimeout(() => r(true), 1800))")
        s = pg.js('sc.wayAt(0.2)')
        if not s:
            fails.append(f'{name}: no way near the top to tap')
        else:
            pg.js("polku.planner.cards.close(); sc.log(); true")
            pg.quick_tap(s['x'], s['y'], ms=50, after='sc.untilCard()')
            time.sleep(1.2)
            pg.js('sc.calm()')
            r = pg.js("(() => { const c = polku.planner.cards.current, e = polku.planner.cards.box, b = e && e.getBoundingClientRect(); return { kind: c && c.kind, key: c && c.key, box: b && [b.top, b.bottom] }; })()")
            d = r['key'] and max(abs(r['key'][0] - s['ll'][0]), abs(r['key'][1] - s['ll'][1]))
            if r['kind'] != 'spot' or d is None or d > 2e-4 or not r['box'] or r['box'][0] < 0 or r['box'][1] > 844:
                fails.append(f"{name}: a quick tap near the top with the planner put away: {r['kind'] or 'no'} card at {r['key']} (the tap's {s['ll']}), its box {r['box']}; the cards: {pg.js('sc.log()')}")
            pg.js('polku.planner.cards.close(); true')
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    except Exception as e:
        fails.append(f"{name}: raised {type(e).__name__}: {str(e).splitlines()[0][:120]}, after {' / '.join(trail[-4:])}")
    pg.close()

    # ------------------------------------------------------------------ a desktop, by mouse
    name = '1440x900'
    pg = page(1440, 900, False)
    try:
        route(pg, name, ROUTE)
        pg.js('sc.still()')  # (the map at rest: a tap on a map still easing from the last card isn't a tap)
        s = pg.js('sc.spot()')
        right(pg, s)
        c = st(pg)
        if c['kind'] != 'spot' or c['place'] != 'float' or not c['card'] or not (c['card']['left'] - 30 <= s['x'] <= c['card']['right'] + 30 and c['card']['top'] - 30 <= s['y'] <= c['card']['bottom'] + 30):
            fails.append(f"{name}: a right-click: {c['kind'] or 'no'} card ({c['place']}) at {c['card']}, the pointer at {s['x']}, {s['y']}")
        elif c['first'] is None or c['first']['text'] != 'Add to my route':
            fails.append(f"{name}: the right-click's card begins with {c['first']}")
        pg.js('polku.planner.cards.close(); true')
        # a right-drag of 40 px turns the map and leaves no card
        s, b0 = pg.js('sc.spot()'), pg.js('polku.map.getBearing()')
        right(pg, s, {'x': s['x'] + 40, 'y': s['y']})
        r = pg.js("({ kind: polku.planner.cards.current && polku.planner.cards.current.kind, bearing: polku.map.getBearing() })")
        if r['kind'] or abs(r['bearing'] - b0) < 1:
            fails.append(f"{name}: a right-drag of 40 px: {r['kind'] or 'no'} card, the bearing {b0:.1f}° → {r['bearing']:.1f}°")
        pg.js('polku.map.setBearing(0); true')
        # a right-click on the line while drawing: Edit this stretch
        t = on_line(pg, 1, 0.3)  # (clear of the leg's handle)
        right(pg, t)
        if st(pg)['kind'] != 'edit':
            fails.append(f"{name}: a right-click on the line: {st(pg)['kind'] or 'no'} card, not Edit this stretch")
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    except Exception as e:
        fails.append(f"{name}: raised {type(e).__name__}: {str(e).splitlines()[0][:120]}, after {' / '.join(trail[-4:])}")
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} hold the map to see what's there (25d part 5): the hold, the ring, the spot's and a place's cards, Add to my route where it fits, Start here and End here, the line's hold, right-clicks" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# The keyboard's crosshair (25d part 5b): Tab to the map shows a crosshair in its middle and the keys; Enter there does
# what a tap does (a point while drawing, the route's card on the route), Shift+F10 what a long press does (the spot's
# card), Escape closes the card with the focus back on the map, and the crosshair goes when the map loses the focus. A
# touch never shows it. Straight legs.
CH_STATE = """(() => {
  const p = polku.planner, c = document.querySelector('.crosshair'), k = document.querySelector('.map-keys'), vis = (e) => !!e && e.getClientRects().length > 0;
  const r = c && c.getBoundingClientRect(), R = polku.map.getCanvas().getBoundingClientRect();
  return { cross: vis(c), keys: vis(k) ? [...k.querySelectorAll('dt')].map((e) => e.textContent) : [], mid: r ? Math.hypot(r.left + r.width / 2 - (R.left + R.width / 2), r.top + r.height / 2 - (R.top + R.height / 2)) : null,
    focus: document.activeElement === polku.map.getCanvas(), kind: p.cards.current ? p.cards.current.kind : null, n: p.points.length };
})()"""


def crosshair(chrome):
    fails = []
    st = lambda pg: pg.js(CH_STATE)

    def key(pg, k, code, vk, mods=0):
        for t in ('rawKeyDown', 'keyUp'):
            pg.c.send('Input.dispatchKeyEvent', {'type': t, 'key': k, 'code': code, 'windowsVirtualKeyCode': vk, 'modifiers': mods}, pg.s)
        time.sleep(0.4)

    def to_map(pg, name):
        """Tab until the map has the focus, as a person does (60 presses at most)."""
        for _ in range(60):
            if pg.js('document.activeElement === polku.map.getCanvas()'):
                return True
            key(pg, 'Tab', 'Tab', 9)
        fails.append(f'{name}: Tab never reached the map')
        return False

    # a [lng, lat] in the map's middle, the map at zoom 16 there
    middle = lambda pg, ll: pg.js(f"polku.map.jumpTo({{ center: {json.dumps(ll)}, zoom: 16 }}); new Promise((r) => setTimeout(() => r(polku.map.getCenter().toArray()), 700))")

    name = '1440x900'
    pg = chrome.page(1440, 900, False)
    try:
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"', 'polku:plannerDock': '"left"'}, '#15/61.514/23.818')
        pg.js(RC_ROUTER)
        pg.js("(() => { const p = polku.planner; p.setActive(true, { edit: true }); p.clear(); p.setMode('line'); document.querySelector('#toast').classList.remove('show'); return true; })()")
        mid = middle(pg, [23.8105, 61.5172])
        if to_map(pg, name):
            s = st(pg)
            if not s['cross'] or s['mid'] is None or s['mid'] > 2 or s['keys'] != ['← ↑ → ↓', 'Enter', 'Shift F10', 'Esc']:
                fails.append(f"{name}: Tab to the map: the crosshair {'shown' if s['cross'] else 'not shown'} {s['mid']} px from the middle, the keys {s['keys']}")
            # the keys are whole: nothing of the planner, the toolbar, the timeline or the map's buttons over them (the timeline was)
            pg.js("document.querySelector('#btn-time').click(); true")
            time.sleep(1.5)
            to_map(pg, name)
            over = pg.js("""(() => { const k = document.querySelector('.map-keys').getBoundingClientRect(), vis = (e) => e && e.getClientRects().length && !e.hidden;
              return ['#wx-bar', '#pl-tools', '#map-ctrls', '.topbar', '#planner', '#zoom-hint', '.plan-btn'].filter((sel) => { const e = document.querySelector(sel); if (!vis(e)) return false; const r = e.getBoundingClientRect();
                return r.left < k.right && r.right > k.left && r.top < k.bottom && r.bottom > k.top; }); })()""")
            if over:
                fails.append(f'{name}: the keys on the map are under {", ".join(over)}')
            pg.js("document.querySelector('#btn-time').click(); true")
            # Enter while drawing: one point at the map's middle
            key(pg, 'Enter', 'Enter', 13)
            r = pg.js("polku.planner.points.map((q) => q.slice())")
            if len(r) != 1 or abs(r[0][0] - mid[0]) > 1e-5 or abs(r[0][1] - mid[1]) > 1e-5:
                fails.append(f'{name}: Enter while drawing: the points {r}, not one at the middle {mid}')
            # two more points; the middle on the line: Enter opens the route's card
            pg.js("(() => { const p = polku.planner; p.addPoint([23.8205, 61.5172]); return true; })()")
            middle(pg, [23.8135, 61.5172])
            # (the line drawn there: on a slow machine a moment after the point)
            pg.js("""new Promise(async (ok) => { const m = polku.map, t0 = Date.now(), r = m.getCanvas().getBoundingClientRect();
              while (Date.now() - t0 < 10000 && !m.queryRenderedFeatures([[r.width / 2 - 6, r.height / 2 - 6], [r.width / 2 + 6, r.height / 2 + 6]], { layers: ['route-casing'].filter((id) => m.getLayer(id)) }).length) await new Promise((x) => setTimeout(x, 200));
              ok(true); })""")
            to_map(pg, name)
            key(pg, 'Enter', 'Enter', 13)
            s = st(pg)
            if s['kind'] != 'route' or s['n'] != 2:
                fails.append(f"{name}: Enter on the line: {s['kind'] or 'no'} card, {s['n']} points")
            # Escape: closed, the focus back on the map, the crosshair with it
            key(pg, 'Escape', 'Escape', 27)
            s = st(pg)
            if s['kind'] or not s['focus'] or not s['cross']:
                fails.append(f"{name}: Escape: {s['kind'] or 'no'} card, the focus {'on' if s['focus'] else 'not on'} the map, the crosshair {'shown' if s['cross'] else 'not shown'}")
            # Shift+F10 beside the route: the spot's card at the middle; the menu key the same
            for k, code, vk, mods in (('F10', 'F10', 121, 8), ('ContextMenu', 'ContextMenu', 93, 0)):
                middle(pg, [23.8155, 61.5195])
                to_map(pg, name)
                key(pg, k, code, vk, mods)
                s = st(pg)
                at = pg.js("(() => { const c = polku.planner.cards.current; return c && c.key ? c.key : null; })()")
                if s['kind'] != 'spot' or not at or abs(at[0] - 23.8155) > 1e-4 or abs(at[1] - 61.5195) > 1e-4 or s['n'] != 2:
                    fails.append(f"{name}: {'Shift+' if mods else ''}{k}: {s['kind'] or 'no'} card at {at}, {s['n']} points")
                key(pg, 'Escape', 'Escape', 27)
            # the map loses the focus: no crosshair
            pg.js("document.querySelector('#search-input').focus(); true")
            time.sleep(0.3)
            if st(pg)['cross']:
                fails.append(f'{name}: the crosshair stays with the focus in the search box')
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    except Exception as e:
        fails.append(f"{name}: raised {type(e).__name__}: {str(e).splitlines()[0][:120]}")
    pg.close()

    # a touch never shows it
    name = '390x844'
    pg = chrome.page(390, 844, True)
    try:
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"'}, '#15/61.514/23.818')
        pg.quick_tap(195, 380)
        time.sleep(0.5)
        if st(pg)['cross']:
            fails.append(f'{name}: a tap on the map shows the crosshair')
    except Exception as e:
        fails.append(f"{name}: raised {type(e).__name__}: {str(e).splitlines()[0][:120]}")
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the keyboard's crosshair (25d part 5b): Tab to the map, Enter, Shift+F10 and the menu key, Escape, blur, never by touch" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# What's here in levels, and Not right? (25d part 6a): a spot's and a place's card say a little, What's here the rest, your
# sport's details of the way first and a missing one said so; All OpenStreetMap details asks Overpass once a card (the
# answer fills the facts too, a failure leaves the button, an answer after the card closed changes nothing); Copy puts the
# coordinates on the clipboard; Not right? is OpenStreetMap's note at the spot, or its editor for a way with an id; with
# the planner put away a path's card is the same card and a ship still opens its own. A recorded tile (Tykkikallio), a
# mocked Overpass. No routing.
FA_HELP = """(() => {
  const p = polku.planner, m = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const asked = [], real = window.fetch.bind(window);
  // Overpass, answered by window.fa.answer (a function of the query: JSON, or a number for an error status), after
  // window.fa.hold when it's a promise
  window.fa = { asked, answer: () => 503, hold: null, holdDem: null };
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (/mapterhorn/.test(url) && fa.holdDem) await fa.holdDem; // (terrain tiles held back: a height that comes late)
    if (!/overpass/.test(url)) return real(input, init);
    const q = init && init.body ? new URLSearchParams(init.body).get('data') : '';
    if (!asked.includes(q)) asked.push(q);
    if (fa.hold) await fa.hold;
    const a = fa.answer(q);
    return typeof a === 'number' ? new Response('', { status: a }) : new Response(JSON.stringify(a));
  };
  const el = () => document.querySelector('.pl-way.card');
  const text = () => (el() ? el().textContent : '');
  const row = (label) => [...(el() || document).querySelectorAll('.row')].find((b) => b.getClientRects().length && b.querySelector('b') && b.querySelector('b').textContent === label);
  const facts = () => [...(el() || document).querySelectorAll('.insp-row')].map((r) => [r.firstChild.textContent, r.querySelector('b').textContent]);
  const heads = () => [...(el() || document).querySelectorAll('.menu-h')].map((h) => h.textContent);
  // a way of the recorded tile at the spot of one of its vertices, where the spot's card finds it as its way: with a
  // difficulty (mtb_scale) or without
  const hits = (ll) => { const q = m.project(ll); return m.queryRenderedFeatures([[q.x - 7, q.y - 7], [q.x + 7, q.y + 7]], { layers: ['path-osm-ground', 'path-ground', 'track-ground'].filter((id) => m.getLayer(id)) }); };
  window.faWay = (graded) => {
    for (const f of m.queryRenderedFeatures({ layers: ['path-osm-ground'] })) {
      if (!!f.properties.mtb_scale !== graded) continue;
      for (const c of f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates.flat()) {
        const q = m.project(c), R = m.getCanvas().getBoundingClientRect();
        if (q.x < 80 || q.x > R.width - 120 || q.y < 140 || q.y > R.height - 80) continue;
        const near = hits(c);
        if (near.length && near.every((x) => !!x.properties.mtb_scale === graded)) return { ll: c, id: f.properties.osm || null };
      }
    }
    return null;
  };
  Object.assign(window.fa, { el, text, row, facts, heads, wait,
    state: () => ({ kind: p.cards.current ? p.cards.current.kind : null, text: text(), facts: facts(), heads: heads(), asked: asked.length, osm: !!row('All OpenStreetMap details') }) });
  return true;
})()"""


def facts(chrome):
    fails = []
    name = '1440x900'
    pg = chrome.page(1440, 900, False)
    fa = lambda js: pg.js(f'fa.{js}')
    st = lambda: pg.js('fa.state()')
    press = lambda label: pg.js(f"(() => {{ const r = fa.row({json.dumps(label)}); if (r) r.click(); return !!r; }})()")
    open_spot = lambda ll: (pg.js(f"polku.planner.openSpotCard({json.dumps(ll)}); true"), time.sleep(0.5))
    try:
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"'}, '#16/62.2289/25.7652')
        pg.js(SEED_TRAILS)
        pg.js("polku.map.jumpTo({ center: [25.7652, 62.2289], zoom: 16.5 }); new Promise((ok) => polku.map.once('idle', () => ok(true)))")
        pg.js(FA_HELP)
        pg.js("polku.planner.setActive(false); true")
        # ---- MTB, a way with no mtb:scale: its difficulty says it isn't mapped; your sport's group first
        w = pg.js('faWay(false)')
        if not w:
            fails.append('no way without a difficulty in the recorded tile')
        else:
            open_spot(w['ll'])
            s = st()
            if s['kind'] != 'spot' or "What’s here" not in pg.js("[...document.querySelectorAll('.pl-way.card .row b')].map((b) => b.textContent)"):
                fails.append(f"a way's spot card: {s['kind']} card, no What’s here")
            press('What’s here')
            time.sleep(0.3)
            s = st()
            f = dict(s['facts'])
            if s['heads'][:1] != ['For MTB'] or f.get('Difficulty') != '? not mapped':
                fails.append(f"MTB, a way with no difficulty: groups {s['heads']}, Difficulty “{f.get('Difficulty')}” (For MTB first, ? not mapped)")
            if not {'Height', 'Coordinates'} <= set(f):
                fails.append(f"What's here has no Height and Coordinates: {list(f)}")
            # Hike: the trail grade first, the MTB difficulty further down
            pg.js("polku.set({ activity: 'hike' }); new Promise((r) => setTimeout(r, 600))")
            pg.js('polku.planner.cards.close(); true')
            open_spot(w['ll'])
            press('What’s here')
            time.sleep(0.3)
            h = st()['heads']
            if h[:2] != ['For hiking', 'For MTB']:
                fails.append(f"Hike: groups {h} (For hiking first, For MTB after)")
            pg.js("polku.set({ activity: 'mtb' }); polku.planner.cards.close(); new Promise((r) => setTimeout(r, 600))")
            # ---- All OpenStreetMap details: one Overpass request, its tags in the card, a second press asks nothing
            way = {'type': 'way', 'id': 123456789, 'tags': {'highway': 'path', 'surface': 'dirt', 'mtb:scale': '1', 'check_date': '2024-06-12'},
                   'geometry': [{'lat': 62.2289, 'lon': 25.7650}, {'lat': 62.2290, 'lon': 25.7655}]}
            pg.js(f"fa.answer = () => ({json.dumps({'elements': [way]})}); fa.asked.length = 0; true")
            open_spot(w['ll'])
            press('What’s here')
            press('All OpenStreetMap details')
            time.sleep(1.5)
            s = st()
            if len(pg.js('fa.asked')) != 1 or 'way 123456789' not in s['text'] or 'Last checked' not in s['heads'] or s['osm']:
                fails.append(f"All OpenStreetMap details: {len(pg.js('fa.asked'))} requests, “way 123456789” {'in' if 'way 123456789' in s['text'] else 'not in'} the card, Last checked {'shown' if 'Last checked' in s['heads'] else 'missing'}, its button {'still there' if s['osm'] else 'gone'}")
            pg.js("polku.planner.osmOnCard(polku.planner.cards.current, polku.planner.cards.current.key); true")
            time.sleep(0.5)
            if len(pg.js('fa.asked')) != 1:
                fails.append(f"a second press asked Overpass again ({len(pg.js('fa.asked'))} requests)")
            # Not right? for a way with an id: its editor; and the note at the spot
            pg.js('polku.planner.cards.back(); true')
            time.sleep(0.3)
            pg.js("[...document.querySelectorAll('.pl-way.card .btn')].find((b) => b.textContent.trim() === 'Not right?')?.click(); true")
            time.sleep(0.4)
            links = pg.js("[...document.querySelectorAll('.pl-way.card a')].map((a) => a.getAttribute('href'))")
            # (the way's own id, as the tile has it)
            if not any(re.match(r'https://www\.openstreetmap\.org/note/new#map=19/62\.\d+/25\.\d+$', x) for x in links) or not any(re.match(r'https://www\.openstreetmap\.org/edit\?way=\d+$', x) for x in links):
                fails.append(f'Not right? for a way with an id: {links}')
            pg.js('polku.planner.cards.close(); true')
            # ---- a failure says so and keeps the button; an answer after the card closed changes nothing
            pg.js("fa.answer = () => 503; fa.asked.length = 0; true")
            open_spot(w['ll'])
            press('What’s here')
            press('All OpenStreetMap details')
            time.sleep(1.5)
            s = st()
            if 'OpenStreetMap didn’t answer' not in s['text'] or not s['osm']:
                fails.append(f"a failed answer: “{s['text'][-80:]}”, the button {'still there' if s['osm'] else 'gone'}")
            pg.js('polku.planner.cards.close(); true')
            pg.js(f"fa.answer = () => ({json.dumps({'elements': [way]})}); fa.hold = new Promise((r) => {{ fa.release = r; }}); true")
            open_spot(w['ll'])
            press('What’s here')
            press('All OpenStreetMap details')
            pg.js('polku.planner.cards.close(); fa.release(); true')
            time.sleep(1.0)
            if st()['kind'] or pg.js('document.querySelector(".pl-way.card")'):
                fails.append('an answer after the card closed opened or changed a card')
            pg.js('fa.hold = null; true')
        # ---- Copy: the clipboard reads the spot's coordinates; Not right? with no way: the note only
        pg.js("window.copied = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { copied.push(t); } }, configurable: true }); true")
        open_spot([23.76, 61.5025])
        press('What’s here')
        time.sleep(0.3)
        pg.js("[...document.querySelectorAll('.pl-way.card .btn')].find((b) => b.textContent.trim() === 'Copy')?.click(); true")
        time.sleep(0.4)
        if pg.js('copied') != ['61.50250, 23.76000']:
            fails.append(f"Copy: the clipboard reads {pg.js('copied')}")
        pg.js('polku.planner.cards.back(); true')
        time.sleep(0.3)
        pg.js("[...document.querySelectorAll('.pl-way.card .btn')].find((b) => b.textContent.trim() === 'Not right?')?.click(); true")
        time.sleep(0.4)
        links = pg.js("[...document.querySelectorAll('.pl-way.card a')].map((a) => a.getAttribute('href'))")
        if links != ['https://www.openstreetmap.org/note/new#map=19/61.502500/23.760000']:
            fails.append(f'Not right? at a spot with no way: {links}')
        pg.js('polku.planner.cards.close(); true')
        # ---- a toilet: its fee and opening hours once OpenStreetMap's tags are in; no wheelchair tag says so
        toilet = {'type': 'node', 'id': 42, 'lat': 61.5025, 'lon': 23.76, 'tags': {'amenity': 'toilets', 'fee': 'no', 'opening_hours': '24/7'}}
        pg.js(f"fa.answer = () => ({json.dumps({'elements': [toilet]})}); fa.asked.length = 0; true")
        pg.js("polku.planner.openPlaceCard({ layer: { id: 'poi-minor' }, properties: { class: 'toilets', name: 'Kaupin vessa' }, geometry: { type: 'Point', coordinates: [23.76, 61.5025] } }, [23.76, 61.5025]); true")
        time.sleep(0.5)
        press('What’s here')
        press('All OpenStreetMap details')
        time.sleep(1.5)
        f = dict(pg.js('fa.facts()'))
        if f.get('Fee') != 'Free' or f.get('Open') != 'All the time' or f.get('Wheelchair access') != '? not mapped':
            fails.append(f"a toilet's What's here: Fee “{f.get('Fee')}”, Open “{f.get('Open')}”, Wheelchair access “{f.get('Wheelchair access')}”")
        pg.js('polku.planner.cards.close(); true')
        # ---- OpenStreetMap's details for the object the card is about: an obstacle's node by its own number, not the nearest
        # object (two at one spot: the other first)
        def node(i, name):
            return {'type': 'node', 'id': i, 'lat': 61.5025, 'lon': 23.76, 'tags': {'amenity': 'toilets', 'name': name}}
        pg.js(f"fa.answer = (q) => ({{ elements: /node\\(7\\)/.test(q) ? [{json.dumps(node(7, 'Seven'))}] : [{json.dumps(node(8, 'Eight'))}, {json.dumps(node(7, 'Seven'))}] }}); fa.asked.length = 0; true")
        pg.js("polku.planner.openPlaceCard({ layer: { id: 'td-points' }, properties: { kind: 'tree', barrier: 'log', osm: 7 }, geometry: { type: 'Point', coordinates: [23.76, 61.5025] } }, [23.76, 61.5025]); true")
        time.sleep(0.5)
        press('What’s here')
        press('All OpenStreetMap details')
        time.sleep(1.5)
        f = pg.js('fa.facts()')
        links = pg.js("(() => { const c = polku.planner.cards.current; return c && c.osm && c.osm.w ? [c.osm.w.type, c.osm.w.id, c.osm.w.tags.name] : null; })()")
        if ['OpenStreetMap', 'node 7'] not in f or links != ['node', 7, 'Seven']:
            fails.append(f"an obstacle's node 7, with another object nearer: its details are {links}, the rows {[x for x in f if x[0] == 'OpenStreetMap']}")
        pg.js("[...document.querySelectorAll('.pl-way.card .btn')].find((b) => b.textContent.trim() === 'Not right?')?.click(); true")
        time.sleep(0.4)
        edit = pg.js("[...document.querySelectorAll('.pl-way.card a')].map((a) => a.getAttribute('href')).filter((u) => /edit/.test(u))")
        if edit != ['https://www.openstreetmap.org/edit?node=7']:
            fails.append(f"Not right? for the obstacle's node 7: {edit}")
        pg.js('polku.planner.cards.close(); true')
        # ---- a height that comes late shows in What's here, opened before it came
        pg.js("fa.holdDem = new Promise((r) => { fa.releaseDem = r; }); true")
        pg.js("polku.planner.openSpotCard([24.31, 61.21]); true")
        time.sleep(0.6)
        press('What’s here')
        time.sleep(0.3)
        before = dict(pg.js('fa.facts()')).get('Height')
        pg.js("fa.releaseDem(); fa.holdDem = null; true")
        height = before
        for _ in range(50):
            time.sleep(0.2)
            height = dict(pg.js('fa.facts()')).get('Height')
            if height != '…':
                break
        if before != '…' or height == '…':
            fails.append(f"What's here opened before the height came: Height “{before}”, then “{height}” (… and then its answer)")
        pg.js('polku.planner.cards.close(); true')
        # ---- the planner put away: a path's tap is the card with What's here; a ship still opens its own card
        w = pg.js('faWay(true)')
        if w:
            q = pg.js(f"(() => {{ const q = polku.map.project({json.dumps(w['ll'])}); return [q.x, q.y]; }})()")
            pg.js(f"polku.map.fire('click', {{ point: {{ x: {q[0]}, y: {q[1]} }}, lngLat: polku.map.unproject([{q[0]}, {q[1]}]), originalEvent: new MouseEvent('click') }}); true")
            time.sleep(0.8)
            s = st()
            if s['kind'] != 'spot' or s['asked'] != 0 or 'S1' not in s['text'] and 'difficulty' not in s['text']:
                fails.append(f"a click on a path with the planner put away: {s['kind'] or 'no'} card, {s['asked']} requests")
            pg.js('polku.planner.cards.close(); true')
        # a ship under the finger (a layer of its own named as the ships', drawn as plain circles, so it needs no icon or font and
        # no network answer): its card is its own, not the planner's
        pg.js("""(() => { window.shipOpened = null; polku.safety.openShip = (mmsi) => { window.shipOpened = mmsi; };
          const m = polku.map; m.jumpTo({ center: [24.95, 60.15], zoom: 10 });
          m.addSource('shipTest', { type: 'geojson', data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { mmsi: 123456789 }, geometry: { type: 'Point', coordinates: [24.95, 60.15] } }] } });
          m.addLayer({ id: 'sf-ships-test', type: 'circle', source: 'shipTest', paint: { 'circle-radius': 14, 'circle-color': '#e11' } });
          return true; })()""")
        r = pg.js("""new Promise(async (done) => {
          const q = polku.map.project([24.95, 60.15]), t0 = Date.now();
          let f = [];
          while (!f.length && Date.now() - t0 < 15000) { await new Promise((r) => setTimeout(r, 250)); f = polku.map.queryRenderedFeatures([[q.x - 10, q.y - 10], [q.x + 10, q.y + 10]], { layers: ['sf-ships-test'] }); }
          if (!f.length) return done('no ship drawn');
          polku.map.fire('click', { point: q, lngLat: polku.map.unproject(q), originalEvent: new MouseEvent('click') });
          done('clicked'); })""", timeout=30000)
        time.sleep(0.6)
        if r == 'clicked' and (pg.js('window.shipOpened') != 123456789 or st()['kind']):
            fails.append(f"a click on a ship: opened {pg.js('window.shipOpened')}, {st()['kind'] or 'no'} card (its own card, not the planner's)")
        elif r != 'clicked':
            fails.append(f'the ship: {r}')
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    except Exception as e:
        fails.append(f"raised {type(e).__name__}: {str(e).splitlines()[0][:140]}")
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} What's here in levels (25d part 6a): a way's facts for your sport, a missing one said so, All OpenStreetMap details once a card, Copy, Not right?, a place's facts, a path's card with the planner put away, a ship's own card" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Share a spot, and Weather here (25d part 6b): Share on a spot's card opens the phone's share sheet with a link to the
# spot, its name and coordinates, elsewhere copies the link and says so; the link opens Polku at the spot with a pin and
# its card, carrying only the spot and the map's view, never the route; a bad pin is ignored; an old route link opens as
# before; Weather here opens the timeline held at the spot, released when it closes, and no request carries the spot.
def share_spot(chrome):
    fails = []
    name = '1440x900'
    pg = chrome.page(1440, 900, False)
    wait_card = lambda: pg.js("new Promise((ok) => { const t0 = Date.now(), f = () => (polku.planner.cards.current || Date.now() - t0 > 20000 ? ok(polku.planner.cards.current ? polku.planner.cards.current.kind : null) : setTimeout(f, 100)); f(); })")
    btn = lambda label: pg.js(f"(() => {{ const b = [...document.querySelectorAll('.pl-way.card .btn')].find((x) => x.textContent.trim() === {json.dumps(label)}); if (b) b.click(); return !!b; }})()")
    try:
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"'}, '#15/61.5025/23.76')
        pg.js("""(() => { window.reqs = []; const real = window.fetch.bind(window); window.fetch = (i, o) => { window.reqs.push(String(i && i.url ? i.url : i)); return real(i, o); };
          window.shared = []; navigator.share = async (d) => { shared.push(d); }; window.copied = [];
          Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { copied.push(t); } }, configurable: true }); return true; })()""")
        # ---- Share: the share sheet once, with the link, a name and the coordinates
        pg.js("polku.planner.openSpotCard([23.76123, 61.50251]); true")
        time.sleep(0.6)
        if not btn('Share'):
            fails.append('no Share on the spot’s card')
        time.sleep(0.4)
        d = pg.js('shared')
        if len(d) != 1 or 'pin=61.50251,23.76123' not in d[0]['url'] or '61.50251, 23.76123' not in d[0]['text'] or not d[0].get('title') or 'r=' in d[0]['url']:
            fails.append(f'Share on a phone: {d}')
        # the link has the five decimals and the view, nothing of a route
        if d and not re.search(r'^http\S+\?pin=61\.50251,23\.76123(&pn=[^#&]*)?#\d+/61\.50251/23\.76123$', d[0]['url']):
            fails.append(f"the spot's link: {d[0]['url']}")
        # without a share sheet: the link is copied, and the note says so
        pg.js("navigator.share = undefined; true")
        btn('Share')
        time.sleep(0.5)
        note = pg.js("document.querySelector('#toast.show')?.textContent || ''")
        if len(pg.js('copied')) != 1 or 'pin=61.50251,23.76123' not in pg.js('copied')[0] or 'copied' not in note:
            fails.append(f"Share with no share sheet: copied {pg.js('copied')}, the note “{note}”")
        link = pg.js('copied[0]')
        # ---- Weather here: the timeline open, held at the spot, released when it closes; no request carries the spot
        pg.js("window.reqs.length = 0; true")
        btn('Weather here ›')
        time.sleep(2.0)
        r = pg.js("({ open: polku.weather.open, held: polku.weather.heldLL, card: !!polku.planner.cards.current, pin: !!document.querySelector('.maplibregl-marker.card-pin'), bar: !!document.querySelector('#wx-bar') && !document.querySelector('#wx-bar').hidden })")
        if not r['open'] or not r['held'] or abs(r['held'][0] - 23.76123) > 1e-6 or abs(r['held'][1] - 61.50251) > 1e-6 or r['card'] or not r['pin']:
            fails.append(f'Weather here: {r}')
        leaked = [u for u in pg.js('reqs') if '61.50251' in u or '23.76123' in u]
        if leaked:
            fails.append(f'a request carries the spot: {leaked[0][:120]}')
        pg.js("polku.weather.setOpen(false); true")
        time.sleep(0.4)
        if pg.js('polku.weather.heldLL') or pg.js("!!document.querySelector('.maplibregl-marker.card-pin')"):
            fails.append('Weather here stays held after the timeline closed')
        # ---- the link, opened in a page with a route of its own: its pin and card, the route as it was
        pg.js("(() => { const p = polku.planner; p.setActive(true, { edit: true }); p.clear(); p.setMode('line'); p.addPoint([23.80, 61.512]); p.addPoint([23.815, 61.5155]); return true; })()")
        time.sleep(1.0)
        before = pg.js("polku.planner.points.map((q) => q.join()).join('|')")
        pg.goto(link)
        pg.map_loaded()
        kind = wait_card()
        r = pg.js("({ kind: polku.planner.cards.current && polku.planner.cards.current.kind, pin: !!document.querySelector('.maplibregl-marker.card-pin'), pts: polku.planner.points.map((q) => q.join()).join('|'), url: location.search, c: polku.map.getCenter().toArray() })")
        if kind not in ('spot', 'place') or not r['pin'] or r['pts'] != before or r['url']:
            fails.append(f"the spot's link in a page with a route: {r} (a card and its pin, the route {before} as it was, the address cleaned)")
        if abs(r['c'][0] - 23.76123) > 0.01 or abs(r['c'][1] - 61.50251) > 0.01:
            fails.append(f"the spot's link: the map at {r['c']}, not at the spot")
        # Share a real place icon too: its link must keep the pin on a desktop. (The map's view is the page's first, with a
        # shelter in it that is drawn in the link's page; the Back of the card above used to put the map there, #513.)
        pg.js("polku.planner.cards.close(); polku.map.jumpTo({ center: [23.76, 61.5025], zoom: 15 }); true")
        pg.idle()
        place = pg.js("""(() => { const m = polku.map, f = m.queryRenderedFeatures({ layers: ['poi-outdoor', 'poi-minor', 'label-peak', 'lipas-point'].filter((id) => m.getLayer(id)) }).find((f) => f.geometry.type === 'Point');
          if (!f) return null;
          const point = m.project(f.geometry.coordinates);
          m.fire('contextmenu', { point, lngLat: m.unproject(point), originalEvent: new MouseEvent('contextmenu') });
          navigator.share = undefined; window.copied = [];
          Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { copied.push(t); } }, configurable: true });
          return f.geometry.coordinates; })()""")
        if not place:
            fails.append('no place icon to share in the map tiles')
        else:
            btn('Share')
            place_link = pg.js('copied[0]')
            pg.goto(place_link)
            pg.map_loaded()
            wait_card()
            r = pg.js("({ kind: polku.planner.cards.current?.kind, pin: !!document.querySelector('.maplibregl-marker.card-pin') })")
            if r['kind'] != 'place' or not r['pin']:
                fails.append(f"the shared place's link has no place card and pin: {r}")
        # ---- a bad pin is ignored, with no card and no console error; an old route link opens as before
        for bad in ('?pin=abc', '?pin=200,10', '?pin=61.5,300', '?pin=61.5', '?pin=1e9,2'):
            pg.errors()
            pg.goto(BASE + bad + '#15/61.5025/23.76')
            pg.map_loaded()
            time.sleep(1.5)
            c = pg.js("polku.planner.cards.current ? polku.planner.cards.current.kind : null")
            e = pg.errors()
            if c or e:
                fails.append(f'{bad}: {c or "no"} card, console {e[:1]}')
        pg.js("(() => { const p = polku.planner; p.setActive(true, { edit: true }); p.clear(); p.setMode('line'); p.addPoint([23.80, 61.512]); p.addPoint([23.815, 61.5155]); return true; })()")
        time.sleep(1.0)
        old = pg.js("polku.planner.shareUrl()")
        pg.goto(old)
        pg.map_loaded()
        time.sleep(1.5)
        r = pg.js("({ n: polku.planner.points.length, card: polku.planner.cards.current && polku.planner.cards.current.kind, view: polku.planner.inView() })")
        if r['n'] != 2 or r['card']:
            fails.append(f'an old route link: {r}')
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    except Exception as e:
        fails.append(f"raised {type(e).__name__}: {str(e).splitlines()[0][:140]}")
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} Share a spot and Weather here (25d part 6b): the share sheet and the copied link, the link's pin and card, a bad pin, an old route link, the timeline held at the spot and released" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


def spot_card_foot(chrome):
    """The spot's and a place's card's last row (25d part 6b): Share, Weather here › and Not right? in one row, last, whole at every
    size (on one line where there's room, a line each at 200 %), the buttons as big as touch needs, with a long Finnish name."""
    fails = []
    name_ = 'Kuusijärvenkierroksen eteläinen taukopaikkarakennus'
    for w, h_, phone in ((1440, 900, False), (390, 844, True), (360, 740, True), (195, 422, True)):
        name = f'{w}x{h_}' + (' (200 %)' if w == 195 else '')
        pg = chrome.page(w, h_, phone)
        try:
            pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"', 'polku:plannerDock': '"left"'}, '#15/61.514/23.818')
            pg.js(RC_ROUTER)
            pg.js(SC_HELP)
            pg.js(f"({RC_ROUTE})({json.dumps({'mode': 'line', 'pts': [[23.8, 61.512], [23.815, 61.5155], [23.83, 61.513]]})})", timeout=60000)
            for what, js in (('a spot', "polku.planner.openSpotCard(polku.map.unproject([polku.map.getCanvas().clientWidth * 0.5, polku.map.getCanvas().clientHeight * 0.3]), { touch: true })"),
                             ('a place', f"polku.planner.openPlaceCard({{ layer: {{ id: 'poi-minor' }}, properties: {{ class: 'toilets', name: {json.dumps(name_)} }}, geometry: {{ type: 'Point', coordinates: polku.map.unproject([polku.map.getCanvas().clientWidth * 0.5, polku.map.getCanvas().clientHeight * 0.3]).toArray() }} }}, [23.82, 61.516])")):
                pg.js(f"{js}; new Promise((r) => setTimeout(() => r(true), 1500))")
                pg.js('sc.calm()')
                # (not at 200 %: a 195 px screen has no room for the pill between the map's buttons and the toolbox, and the
                # spot has to stay above the card)
                over = pg.js(PILL_OVER) if w > 195 else ''
                if over:
                    fails.append(f'{name}: {what}: {over} over the pill')
                r = pg.js("""(() => { const c = document.querySelector('.pl-way.card'), f = c && c.querySelector('.card-foot'), box = (e) => e.getBoundingClientRect();
                  if (!f) return null;
                  const bs = [...f.querySelectorAll('.btn')], C = box(c);
                  return { last: c.lastElementChild === f, words: bs.map((b) => b.textContent.trim()), small: bs.filter((b) => box(b).height < (matchMedia('(pointer: coarse)').matches ? 44 : 36)).length,
                    wide: [f.scrollWidth - f.clientWidth, c.scrollWidth - c.clientWidth], out: bs.filter((b) => box(b).left < C.left - 1 || box(b).right > C.right + 1).length,
                    lines: new Set(bs.map((b) => Math.round(box(b).top))).size, title: c.querySelector('.way-hint').textContent.length }; })()""")
                if not r:
                    fails.append(f'{name}: {what}: no card with a last row')
                    continue
                if not r['last'] or r['words'] != ['Share', 'Weather here ›', 'Not right?'] or r['small'] or r['out'] or r['wide'][0] > 0 or r['wide'][1] > 0:
                    fails.append(f'{name}: {what}: the last row {r}')
                if (w == 195) != (r['lines'] == 3) or (w != 195 and r['lines'] != 1):
                    fails.append(f"{name}: {what}: the last row is on {r['lines']} lines (one where there's room, a line each at 200 %)")
                pg.js('polku.planner.cards.close(); true')
            fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        except Exception as e:
            fails.append(f"{name}: raised {type(e).__name__}: {str(e).splitlines()[0][:120]}")
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the spot's and a place's card's last row: Share, Weather here ›, Not right?, at four sizes" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Route's list in sections, and Reorder (25d's part 4, Journey D): a section where the sport changes, at a stop and at a
# night (a day each); point rows for the points you see, stretch rows between them with their shaping points folded;
# a tap opens the point's or the stretch's card, and Back finds the list as it was; Reorder with a grip, Earlier and
# Later, a mouse's drag and a finger held 0.45 s; the list's keys; the same warning never twice at once (the peek's
# row while the list shows it). Straight legs; BRouter answered here where a leg follows paths.
SE_STATE = """(() => {
  const p = polku.planner, L = p.els.points, vis = (e) => !!e && e.getClientRects().length > 0, r = (e) => e.getBoundingClientRect();
  const secs = [...L.querySelectorAll('.sec2')].map((s) => ({ title: s.querySelector('.sec2-head b')?.textContent || '', from: +s.dataset.from, to: +s.dataset.to, warn: !!s.querySelector('.warn-row'),
    rows: [...s.querySelectorAll('.wpl-point, .wpl-stretch')].filter(vis).map((b) => (b.classList.contains('wpl-stretch') ? `~${b.textContent}` : `${b.dataset.i}:${b.textContent}`)) }));
  return { secs, reorder: L.classList.contains('reorder'), grips: L.querySelectorAll('.wpl-grip').length, top: [...document.querySelectorAll('.wpl-top .btn')].filter(vis).map((b) => b.textContent.trim()),
    rows: [...L.querySelectorAll('.wpl-row')].map((x) => x.dataset.i), shapes: [...L.querySelectorAll('.wpl-point.shape')].filter(vis).length,
    kind: p.cards.current ? p.cards.current.kind : null, n: p.points.length, past: p.past.length, scroll: p.els.body.scrollTop,
    short: [...L.querySelectorAll('button'), ...document.querySelectorAll('.wpl-top button')].filter(vis).filter((b) => r(b).height < 44).map((b) => b.textContent.trim().slice(0, 24) || b.getAttribute('aria-label')),
    readRow: !p.els.readRow.hidden, text: L.textContent };
})()"""


def sections_list(chrome):
    fails, trail = [], []

    def press(pg, at, name, touch):
        trail.append(name)
        if not at:
            fails.append(f'{name}: not on screen')
            return False
        if touch:
            pg.quick_tap(at['x'], at['y'])
        else:
            for kind in ('mouseMoved', 'mousePressed', 'mouseReleased'):
                pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': at['x'], 'y': at['y'], 'button': 'none' if kind == 'mouseMoved' else 'left',
                                                      'buttons': 1 if kind == 'mousePressed' else 0, 'clickCount': 1}, pg.s)
        time.sleep(0.5)
        return True

    def key(pg, k, code, vk, mods=0):
        for event in ('rawKeyDown', 'keyUp'):
            pg.c.send('Input.dispatchKeyEvent', {'type': event, 'key': k, 'code': code, 'windowsVirtualKeyCode': vk, 'modifiers': mods}, pg.s)
        time.sleep(0.4)

    # where a list's row is once it's scrolled into view, as a finger scrolls it: the sheet's body (or a card) only, never
    # the page, which the app puts back at once; the sheet settled
    at = lambda pg, sel: (pg.js(SETTLED), pg.js(f"""(async () => {{ const e = {sel}; if (!e) return null; const box = e.closest('.pl-way.card') || polku.planner.els.body;
      let b = e.getBoundingClientRect(); const r = box.getBoundingClientRect();
      if (b.top < r.top + 8 || b.bottom > r.bottom - 8) box.scrollTop += b.top + b.height / 2 - (r.top + r.height / 2);
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      b = e.getBoundingClientRect(); return b.height ? {{ x: Math.round(b.left + Math.min(60, b.width / 2)), y: Math.round(b.top + b.height / 2) }} : null; }})()"""))[1]
    st = lambda pg: pg.js(SE_STATE)
    point = lambda i: f"polku.planner.els.points.querySelector('.wpl-point[data-i=\"{i}\"]')"
    stretch = lambda i: f"polku.planner.els.points.querySelector('.wpl-stretch[data-from=\"{i}\"]')"
    top = lambda label: f"[...document.querySelectorAll('.wpl-top .btn')].find((b) => b.textContent.trim() === {json.dumps(label)})"

    def page(w, h_, phone, extra=None):
        pg = chrome.page(w, h_, phone)
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"', 'polku:plannerDock': '"left"', 'polku:plannerTab': '"route"', **(extra or {})}, '#14/61.514/23.818')
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        pg.js(RC_ROUTER)
        return pg

    def route(pg, name, o, sheet='half'):
        if not pg.js(f"({RC_ROUTE})({json.dumps(o)})", timeout=60000):
            fails.append(f'{name}: the route wasn’t routed')
        pg.js(f"(() => {{ const p = polku.planner; p.setTab('route'); p.setSheetState({json.dumps(sheet)}); p.toggleSection('points', true); return true; }})()")
        pg.js(SETTLED)
        return st(pg)

    PTS = [[23.790 + 0.006 * k, 61.512 + 0.0012 * (k % 3)] for k in range(7)]

    # ------------------------------------------------------------------ a phone, by touch
    name, touch = '390x844', True
    pg = page(390, 844, True)
    try:
        # MTB for three legs, then Paddle for three: two sections; the change of sport on its point's row
        route(pg, name, {'pts': PTS})
        pg.js("polku.planner.setSportFrom(3, 'paddle'); true")
        time.sleep(1.0)
        s = st(pg)
        titles = [x['title'] for x in s['secs']]
        if len(titles) != 2 or not titles[0].startswith('MTB') or not titles[1].startswith('Paddle'):
            fails.append(f'{name}: MTB then Paddle: sections {titles}')
        elif not any(r.startswith('3:') and 'Paddle from here' in r for r in s['secs'][0]['rows']):
            fails.append(f"{name}: the change of sport's row: {s['secs'][0]['rows']}")
        if s['short']:
            fails.append(f"{name}: rows under 44 px: {s['short']}")
        # a stop at via 4: three sections; a night at via 5 ends one, with its morning's start, and the sections are days
        pg.js("polku.planner.setStop(4, { min: 30 }); true")
        time.sleep(0.8)
        if len(st(pg)['secs']) != 3:
            fails.append(f"{name}: a stop at via 4: sections {[x['title'] for x in st(pg)['secs']]}")
        pg.js("polku.planner.setStop(5, { on: 420 }); true")
        time.sleep(0.8)
        s = st(pg)
        if not s['secs'] or not s['secs'][0]['title'].startswith('Day 1') or not any(r.startswith('5:') and 'go on at 07:00' in r for x in s['secs'] for r in x['rows']):
            fails.append(f"{name}: a night at via 5: sections {[x['title'] for x in s['secs']]}, rows {[r for x in s['secs'] for r in x['rows']]}")
        # six points that only shape the line: one stretch row, folded; unfolded six rows; a card and Back keep it so
        route(pg, name, {'pts': [[23.790 + 0.004 * k, 61.512 + 0.0008 * (k % 2)] for k in range(8)]})
        s = st(pg)
        strs = [r for x in s['secs'] for r in x['rows'] if r.startswith('~')]
        if len(strs) != 1 or 'via 6 shaping points' not in strs[0] or s['shapes']:
            fails.append(f"{name}: six shaping points: stretch rows {strs}, {s['shapes']} shown")
        press(pg, at(pg, "polku.planner.els.points.querySelector('.wpl-unfold')"), f'{name}: unfold', touch)
        s = st(pg)
        if s['shapes'] != 6:
            fails.append(f"{name}: unfolded: {s['shapes']} shaping points' rows, not 6")
        press(pg, at(pg, point(3)), f'{name}: via 3’s row', touch)
        scroll0 = pg.js("polku.planner.cards.saved && polku.planner.cards.saved.scroll")
        if st(pg)['kind'] != 'point':
            fails.append(f"{name}: a shaping point's row: {st(pg)['kind']} card")
        press(pg, at(pg, "document.querySelector('.pl-way.card .way-back')"), f'{name}: Back', touch)
        time.sleep(0.4)
        s = st(pg)
        if s['kind'] or s['shapes'] != 6 or scroll0 is None or abs(s['scroll'] - scroll0) > 2:
            fails.append(f"{name}: Back from a row's card: card {s['kind']}, {s['shapes']} rows unfolded, scrolled {s['scroll']} (was {scroll0})")
        # a stretch's row: its card; Edit this stretch changes every leg in it
        press(pg, at(pg, stretch(0)), f'{name}: the stretch’s row', touch)
        if st(pg)['kind'] != 'stretch':
            fails.append(f"{name}: a stretch's row: {st(pg)['kind']} card")
        else:
            press(pg, at(pg, "[...document.querySelectorAll('.pl-way.card .btn')].find((b) => b.textContent.trim() === 'Edit this stretch')"), f'{name}: Edit this stretch', touch)
            press(pg, at(pg, "[...document.querySelectorAll('.pl-way.card .row')].find((b) => b.querySelector('b').textContent === 'Sport')"), f'{name}: Sport', touch)
            press(pg, at(pg, "[...document.querySelectorAll('.pl-way.card .row')].find((b) => b.querySelector('b').textContent === 'Hike')"), f'{name}: Hike', touch)
            sp = pg.js("polku.planner.legs.map((_, i) => polku.planner.legSport(i)).join()")
            if sp != ','.join(['hike'] * 7):
                fails.append(f'{name}: Edit this stretch from the list → Hike: {sp}')
            pg.js("polku.planner.cards.close(); polku.planner.undo(); true")
            time.sleep(0.6)
        # Reorder: every point with its grip; Earlier on via 2, one step of Undo; Done goes back to the sections
        press(pg, at(pg, top('Reorder')), f'{name}: Reorder', touch)
        s = st(pg)
        if not s['reorder'] or s['grips'] != s['n'] or s['top'] != ['Done']:
            fails.append(f"{name}: Reorder: {'reordering' if s['reorder'] else 'not reordering'}, {s['grips']} grips for {s['n']} points, {s['top']}")
        past, two = s['past'], pg.js("JSON.stringify(polku.planner.points[2])")
        press(pg, at(pg, "polku.planner.els.points.querySelector('.wpl-row[data-i=\"2\"] [aria-label$=\" earlier\"]')"), f'{name}: Earlier on via 2', touch)
        r = pg.js("({ one: JSON.stringify(polku.planner.points[1]), past: polku.planner.past.length })")
        if r['one'] != two or r['past'] != past + 1:
            fails.append(f'{name}: Earlier on via 2: {r}')
        pg.js("polku.planner.undo(); true")
        time.sleep(0.4)
        # a finger held 0.45 s on a row drags it; one that moves 30 px within 0.2 s scrolls the list and drags nothing
        a = at(pg, "polku.planner.els.points.querySelector('.wpl-row[data-i=\"2\"]')")
        b = at(pg, "polku.planner.els.points.querySelector('.wpl-row[data-i=\"4\"]')")
        before = pg.js("JSON.stringify(polku.planner.points)")
        t0 = time.time()
        pg.touch('start', a['x'], a['y'], t0)
        for k in range(1, 7):
            time.sleep(0.03)
            pg.touch('move', a['x'], a['y'] + 5 * k, t0 + 0.03 * k)
        pg.touch('end', at=t0 + 0.25)
        time.sleep(0.5)
        if pg.js("JSON.stringify(polku.planner.points)") != before:
            fails.append(f'{name}: a quick swipe on Reorder’s list moved a point')
        # (both rows in view at once, measured together: measuring one by scrolling would move the other)
        pg.js(SETTLED)
        ab = pg.js("""(async () => { const L = polku.planner.els.points, body = polku.planner.els.body, r = (k) => L.querySelector(`.wpl-row[data-i="${k}"]`).getBoundingClientRect();
          body.scrollTop += r(2).top - (body.getBoundingClientRect().top + 60);
          await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
          const c = (b) => ({ x: Math.round(b.left + Math.min(60, b.width / 2)), y: Math.round(b.top + b.height / 2) }); return [c(r(2)), c(r(4))]; })()""")
        a, b = ab
        t0 = time.time()
        pg.touch('start', a['x'], a['y'], t0)
        time.sleep(0.6)
        for k in range(1, 11):
            pg.touch('move', a['x'], a['y'] + (b['y'] + 10 - a['y']) * k / 10)
            time.sleep(0.03)
        pg.touch('end')
        time.sleep(0.6)
        r = pg.js(f"({{ four: JSON.stringify(polku.planner.points[4]), past: polku.planner.past.length }})")
        if r['four'] != json.dumps(json.loads(before)[2], separators=(',', ':')):
            fails.append(f"{name}: a finger held 0.45 s on via 2, dragged past via 4: {r}")
        pg.js("polku.planner.undo(); true")
        time.sleep(0.4)
        press(pg, at(pg, top('Done')), f'{name}: Done', touch)
        s = st(pg)
        if s['reorder'] or not s['secs']:
            fails.append(f"{name}: Done: {'still reordering' if s['reorder'] else 'no sections'}")
        # the route's view: the same sections, no Reorder and no grips; a row opens its card
        pg.js("polku.planner.done(); polku.planner.setSheetState('half'); true")
        time.sleep(0.6)
        s = st(pg)
        if not s['secs'] or s['top'] or s['grips']:
            fails.append(f"{name}: the route's view: {len(s['secs'])} sections, {s['top']}, {s['grips']} grips")
        press(pg, at(pg, point(0)), f'{name}: the start’s row in the route’s view', touch)
        if st(pg)['kind'] != 'point':
            fails.append(f"{name}: a row in the route's view: {st(pg)['kind']} card")
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    except Exception as e:
        fails.append(f"{name}: raised {type(e).__name__}: {str(e).splitlines()[0][:120]}, after {' / '.join(trail[-4:])}")
    pg.close()

    # ------------------------------------------------------------------ a desktop, by mouse and keys
    name, touch = '1440x900', False
    pg = page(1440, 900, False)
    try:
        # a section's warning: its first item's card; the peek's row isn't shown twice (desktops have none)
        pg.js("window.rcTags = 'highway=footway bicycle=no surface=paved'; true")
        route(pg, name, {'mode': 'auto', 'pts': PTS[:3]})
        time.sleep(1.0)
        s = st(pg)
        if not s['secs'] or not s['secs'][0]['warn']:
            fails.append(f"{name}: a Read item on the route: no warning in its section ({[x['title'] for x in s['secs']]})")
        else:
            press(pg, at(pg, "polku.planner.els.points.querySelector('.sec2 .warn-row')"), f'{name}: the section’s warning', touch)
            if st(pg)['kind'] != 'item':
                fails.append(f"{name}: the section's warning: {st(pg)['kind']} card")
            pg.js("polku.planner.cards.close(); true")
        # a mouse drags a row by its grip: via 2 to place 4 (Reorder)
        pg.js("window.rcTags = 'highway=path surface=dirt mtb:scale=1'; true")
        route(pg, name, {'pts': PTS, 'names': [[1, 'Kaupintie'], [2, 'Sorila'], [3, 'Lielahti']]})  # (named: points you see, with rows)
        press(pg, at(pg, top('Reorder')), f'{name}: Reorder', touch)
        before = json.loads(pg.js("JSON.stringify(polku.planner.points)"))
        g = at(pg, "polku.planner.els.points.querySelector('.wpl-row[data-i=\"2\"] .wpl-grip')")
        b = at(pg, "polku.planner.els.points.querySelector('.wpl-row[data-i=\"4\"]')")
        pg.c.send('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': g['x'], 'y': g['y'], 'button': 'left', 'buttons': 1, 'clickCount': 1}, pg.s)
        for k in range(1, 11):
            pg.c.send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': g['x'], 'y': g['y'] + (b['y'] + 8 - g['y']) * k / 10, 'button': 'left', 'buttons': 1}, pg.s)
            time.sleep(0.03)
        pg.c.send('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': g['x'], 'y': b['y'] + 8, 'button': 'left', 'buttons': 0, 'clickCount': 1}, pg.s)
        time.sleep(0.6)
        if pg.js("JSON.stringify(polku.planner.points[4])") != json.dumps(before[2], separators=(',', ':')):
            fails.append(f'{name}: a mouse drag of via 2’s grip past via 4: {pg.js("JSON.stringify(polku.planner.points)")}')
        pg.js("polku.planner.undo(); true")
        press(pg, at(pg, top('Done')), f'{name}: Done', touch)
        # the list's keys: ↓ to the next row, Alt+↓ moves a point, Delete removes it with Undo in the note
        pg.js(f"({point(1)}).focus(); true")
        key(pg, 'ArrowDown', 'ArrowDown', 40)
        if not pg.js("document.activeElement && document.activeElement.matches('.wpl-stretch, .wpl-point') && document.activeElement !== polku.planner.els.points.querySelector('.wpl-point[data-i=\"1\"]')"):
            fails.append(f"{name}: ↓ on a row didn't go to the next one ({pg.js('document.activeElement && document.activeElement.className')})")
        pg.js(f"({point(3)}).focus(); true")
        past, three = pg.js("polku.planner.past.length"), pg.js("JSON.stringify(polku.planner.points[3])")
        key(pg, 'ArrowDown', 'ArrowDown', 40, 1)  # Alt
        r = pg.js("({ four: JSON.stringify(polku.planner.points[4]), past: polku.planner.past.length })")
        if r['four'] != three or r['past'] != past + 1:
            fails.append(f'{name}: Alt+↓ on via 3: {r}')
        n = pg.js("polku.planner.points.length")
        pg.js(f"({point(2)}).focus(); true")
        key(pg, 'Delete', 'Delete', 46)
        r = pg.js("({ n: polku.planner.points.length, note: document.querySelector('#toast')?.textContent || '' })")
        if r['n'] != n - 1 or 'Undo' not in r['note']:
            fails.append(f'{name}: Delete on via 2: {r}')
        # a 52-point route: its points that only shape the line folded, so the list draws no slower than twice the same
        # route's points you see alone (the same machine, the same run)
        big = [[23.700 + 0.002 * k, 61.512 + 0.0006 * (k % 5)] for k in range(52)]
        route(pg, name, {'pts': big, 'names': [[17, 'Sorila bridge'], [34, 'Kaukajärvi beach']]})
        pg.js("polku.planner.setStop(17, { min: 20 }); polku.planner.setStop(34, { min: 20 }); true")
        time.sleep(1.0)
        # five draws each, big and small interleaved after one warm-up of each, medians compared: one cold draw or one
        # busy moment on a shared runner no longer lands on one side only
        t = pg.js("""(() => { const p = polku.planner, T = () => { const t0 = performance.now(); for (let k = 0; k < 5; k++) p.renderWaypoints(); return (performance.now() - t0) / 5; };
          const med = (a) => a.sort((x, y) => x - y)[a.length >> 1];
          const keys = p.points.map((_, i) => i).filter((i) => p.keyPoint(i)), s = p.snapshot();
          const bigPts = p.points, bigLegs = p.legs, smallPts = keys.map((i) => p.points[i]), smallLegs = keys.slice(1).map((_, k) => ({ ...p.legs[keys[k]] }));
          const as = (pts, legs) => { p.points = pts; p.legs = legs; };
          as(smallPts, smallLegs); T(); as(bigPts, bigLegs); T();
          const bigs = [], smalls = [];
          for (let r = 0; r < 7; r++) { as(bigPts, bigLegs); bigs.push(T()); as(smallPts, smallLegs); smalls.push(T()); }
          p.restoreSnap(s);
          return { big: med(bigs), small: med(smalls), secs: p.els.points.querySelectorAll('.sec2').length, rows: p.els.points.querySelectorAll('.wpl-point:not(.shape)').length }; })()""")
        if t['big'] > 2 * max(t['small'], 1) or t['secs'] != 3:
            fails.append(f"{name}: a 52-point route's list: {t['big']:.1f} ms, the points you see alone {t['small']:.1f} ms; {t['secs']} sections, {t['rows']} point rows")
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    except Exception as e:
        fails.append(f"{name}: raised {type(e).__name__}: {str(e).splitlines()[0][:120]}, after {' / '.join(trail[-4:])}")
    pg.close()

    # ------------------------------------------------------------------ the same warning never twice; 360 × 740 in Finnish
    name = '390x844, a warning'
    pg = page(390, 844, True)
    try:
        pg.js("window.rcTags = 'highway=footway bicycle=no surface=paved'; true")
        route(pg, name, {'mode': 'auto', 'pts': PTS[:3]}, sheet='peek')
        time.sleep(1.0)
        if not st(pg)['readRow']:
            fails.append(f'{name}: the peek has no row for the Read item')
        pg.js("polku.planner.setTab('route', { user: true }); polku.planner.setSheetState('half'); true")
        pg.js(SETTLED)
        s = st(pg)
        if s['readRow'] and any(x['warn'] for x in s['secs']):
            fails.append(f"{name}: with Route's list at half, the same warning in the peek's row and the list's section")
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    except Exception as e:
        fails.append(f"{name}: raised {type(e).__name__}: {str(e).splitlines()[0][:120]}")
    pg.close()
    name = '360x740, Finnish'
    pg = page(360, 740, True)
    try:
        route(pg, name, {'pts': PTS, 'names': [[0, 'Kaupin urheilupuiston pohjoinen pysäköintialue'], [3, 'Pirunvuoren näköalapaikan levähdyspaikka'], [6, 'Tapatoranlahden uimarannan laituri']]})
        out = pg.js("""(() => { const L = polku.planner.els.points, out = [], lr = L.getBoundingClientRect();
          if (/…/.test(L.textContent)) out.push('“…” in the list');
          for (const e of L.querySelectorAll('*')) { const b = e.getBoundingClientRect(); if (b.width && (b.right > lr.right + 1 || b.left < lr.left - 1)) out.push(`${e.tagName.toLowerCase()}.${e.className} past the list's edge`);
            if (getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) out.push(`${e.tagName.toLowerCase()} cut`); }
          return [...new Set(out)]; })()""")
        fails += [f'{name}: {o}' for o in out]
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    except Exception as e:
        fails.append(f"{name}: raised {type(e).__name__}: {str(e).splitlines()[0][:120]}")
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} Route's list in sections, and Reorder (25d part 4): sections, stretches folded, cards and Back, Reorder by touch and mouse, the keys, the route's view, 52 points, a warning once, 360 px Finnish" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# The design system's controls (#382, docs/plans/design-system.md §4), measured where the app draws them: one look for
# each job (#356), one focus ring, in the menus too (#385), labels that wrap (#373), names that break at 200 % (#384),
# words at 4.5:1 and a switch's edge at 3:1 (#376), Plan in green, and a press that answers.
CT_HELP = r"""
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), cs = (e, x) => getComputedStyle(e, x || null), out = [];
  const css = cs(document.documentElement), val = (n) => css.getPropertyValue(n).trim();
  const probe = document.body.appendChild(document.createElement('i'));
  const col = (v) => { probe.style.color = ''; probe.style.color = v; return cs(probe).color; };
  const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
  const lum = (c) => c.slice(0, 3).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // a colour with its alpha (and an opacity) over a solid one
  const over = (c, bg, o = 1) => { const a = (c.length > 3 ? c[3] : 1) * o; return c.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a)); };
  const solid = rgb(col(val('--surface-solid')));
  const inside = (a, b) => { const x = a.getBoundingClientRect(), y = b.getBoundingClientRect(); return x.left >= y.left - 1 && x.right <= y.right + 1 && x.top >= y.top - 1 && x.bottom <= y.bottom + 1; };
"""
# One look for each job (#356), at a phone's size or a desktop's: the start's sport, Draw it's Fine-tune and Settings'
# speeds are rows, as a card's; every chosen chip is the round trip's; a switch is --target tall, the chosen one white
# with black words and a green icon; a switch's off track has an edge; small headings are one size; the map's card's
# title is a step's; the round trip's stepper is one box; Plan is green
CT_LOOK = r"""(async () => {""" + CT_HELP + r"""
  const p = polku.planner, C = await import(location.origin + '/js/card.js'), U = await import(location.origin + '/js/ui.js'), desk = p.sideMQ.matches;
  for (const id of ['#btn-plan', '#btn-plan-search']) {
    const b = document.querySelector(id);
    if (b && b.getClientRects().length && cs(b).backgroundColor !== col(val('--accent-bg'))) out.push(`Plan (${id}) is ${cs(b).backgroundColor}, not green`);
  }
  // a row, built as the cards build theirs (card.js item()), beside the one measured, so both have its place
  const look = (el) => { const b = el.querySelector('b'), s = el.querySelector('small'), ic = el.querySelector('.ic'), c = cs(el);
    return { height: c.minHeight, padding: `${c.paddingTop} ${c.paddingRight} ${c.paddingBottom} ${c.paddingLeft}`, border: c.borderTopWidth, gap: c.columnGap,
      name: b && `${cs(b).fontSize} ${cs(b).fontWeight}`, line: s && cs(s).fontSize, icon: ic && cs(ic).color }; };
  const sameRow = (el, what) => {
    if (!el) return out.push(`${what}: not there`);
    const ref = C.item({ icon: 'route', label: 'A row', line: 'its line', chev: true });
    el.after(ref);
    const a = look(el), b = look(ref);
    ref.remove();
    for (const k in b) if (a[k] != null && a[k] !== b[k]) out.push(`${what}: ${k} ${a[k]}, a row's ${b[k]}`); // (a row with no line has none to measure)
    if (a.icon !== col(val('--text'))) out.push(`${what}: its icon ${a.icon}, not black`);
  };
  p.setActive(true); p.clear(); await wait(600);
  sameRow(document.querySelector('.pl-way .sport-row'), 'the start’s sport');
  if (desk) { p.openWay('draw'); await wait(600); sameRow(document.querySelector('.pl-way .way-srow'), 'Draw it’s Fine-tune'); }
  document.querySelector('#btn-settings').click(); await wait(600);
  sameRow(document.querySelector('#settings-body .speed-sport-row'), 'Settings’ speeds');
  document.querySelector('#btn-settings').click(); await wait(400);
  // the chosen chip: green with a 2 px border everywhere, as the round trip's lengths have it
  p.openLoop(polku.map.getCenter().toArray()); await wait(800);
  const way = document.querySelector('.pl-way'), box = way.appendChild(document.createElement('div'));
  const chip = (e) => { const c = cs(e); return `${c.backgroundColor} ${c.borderTopWidth} ${c.borderTopColor} ${c.color}`; };
  const ref = way.querySelector('.rt-chips .chip[aria-pressed=true]');
  box.innerHTML = `<div class="chips"><button class="chip" aria-pressed="true">Grade</button></div><div class="chips tl-layers"><button class="chip" aria-pressed="true">Wind</button></div>
    <div class="style-presets"><span class="chip chip-on">Custom</span></div><div class="act-chips"><button class="act-chip" aria-pressed="true">Canoe</button></div>
    <div class="menu-chips"><button class="menu-item chip" aria-checked="true"><span>Flowy</span></button></div>`;
  if (!ref) out.push('no chosen length in the round trip');
  else for (const [sel, what] of [['.chips .chip', 'a chip in Layers or the profile'], ['.tl-layers .chip', 'the timeline’s chip'], ['.chip-on', 'Custom'], ['.act-chip', 'the sport menu’s craft'], ['.menu-chips .chip', 'a menu’s chip']])
    if (chip(box.querySelector(sel)) !== chip(ref)) out.push(`${what}, chosen: ${chip(box.querySelector(sel))}, not the round trip's ${chip(ref)}`);
  // switches: one height in a place, --target; the chosen one white, with black words and a green icon
  box.innerHTML = `<div class="seg"><button aria-pressed="true">${U.icon('route', 16)}<span>Distance</span></button><button aria-pressed="false">${U.icon('roundtrip', 16)}<span>Time</span></button></div>
    <div class="seg small"><button aria-pressed="true">Small</button></div>`;
  const target = parseFloat(val('--target'));
  for (const b of [...box.querySelectorAll('.seg button'), ...way.querySelectorAll('.rt-unit button')]) {
    const t = Math.round(b.getBoundingClientRect().height);
    if (t !== target) out.push(`a switch's ${b.textContent.trim()} ${t} px tall, not ${target}`);
  }
  for (const b of [box.querySelector('.seg button'), way.querySelector('.rt-unit button[aria-pressed=true]')]) {
    const ic = b && b.querySelector('.ic');
    if (!b) out.push('no chosen switch in the round trip');
    else if (cs(b).backgroundColor !== col(val('--surface-solid')) || cs(b).color !== col(val('--text')) || !ic || cs(ic).color !== col(val('--accent')))
      out.push(`a chosen switch: ${cs(b).backgroundColor}, words ${cs(b).color}, icon ${ic && cs(ic).color}`);
  }
  // a switch's off track: its edge at 3:1 on the card (#376)
  box.innerHTML = `<label class="tg"><span class="tg-text">Avoid main roads</span><input type="checkbox"><span class="tg-ui"></span></label>`;
  const ui = box.querySelector('.tg-ui'), edge = (cs(ui).boxShadow.match(/rgba?\([^)]*\)/) || [cs(ui).backgroundColor])[0], er = ratio(over(rgb(edge), solid), solid);
  if (er < 3) out.push(`a switch's off track: its edge ${er.toFixed(2)}:1, under 3:1`);
  // small headings: 12 px capitals in grey, .06em, bold (a desktop's card too)
  box.innerHTML = `<div class="menu-h">A</div><div class="lp-sec"><h3>A</h3></div><span class="chip-group-label">A</span><span class="sec-title">A</span><span class="lg-title">A</span>
    <div class="qd-lab">A</div><div class="act-head">A</div><span class="stat-label">A</span><div class="pt-label">A</div><div class="speed-route"><h4>A</h4></div>
    <div class="wind-title">A</div><span class="cam-wx-title">A</span><button class="bd-group-toggle">A</button><div class="card-float"><div class="pl-way card"><h4 class="menu-h">A</h4></div></div>`;
  const want = `12px 700 0.72px uppercase ${col(val('--muted'))}`;
  for (const e of box.querySelectorAll('.menu-h, h3, .chip-group-label, .sec-title, .lg-title, .qd-lab, .act-head, .stat-label, .pt-label, h4, .wind-title, .cam-wx-title, .bd-group-toggle')) {
    const c = cs(e), got = `${c.fontSize} ${c.fontWeight} ${c.letterSpacing} ${c.textTransform} ${c.color}`;
    if (got !== want) out.push(`the small heading ${e.className || e.parentElement.className + ' ' + e.tagName.toLowerCase()}: ${got}, not ${want}`);
  }
  // titles: the map's card's as a step's (17 px); on a desktop as a card's at the point (15 px)
  box.innerHTML = `<div class="card-float"><div class="pl-way card"><div class="way-hint"><b>A</b></div></div></div>`;
  const pop = document.body.appendChild(document.createElement('div'));
  pop.className = 'maplibregl-popup polku-popup';
  pop.innerHTML = '<div class="maplibregl-popup-content"><div class="insp"><div class="insp-title">A trail</div></div></div>';
  const step = way.querySelector('.way-hint b'), title = cs(pop.querySelector('.insp-title')).fontSize, tw = desk ? cs(box.querySelector('b')).fontSize : step && cs(step).fontSize;
  if (title !== tw) out.push(`the map's card's title ${title}, not ${tw}`);
  pop.remove(); box.remove();
  // one stepper: − 30 min + in one box, the number typable
  way.querySelector('.rt-chips [data-k=len-other]').click(); await wait(500);
  const st = document.querySelector('.pl-way .rt-step'), len = st && st.querySelector('.rt-len'), parts = st ? [st.querySelector('[data-k=dec]'), st.querySelector('input'), st.querySelector('[data-k=inc]')] : [];
  if (!len || parts.some((e) => !e)) out.push('no stepper after Other…');
  else if (parts.some((e) => !inside(e, len))) out.push('the stepper’s − and + aren’t in its box');
  probe.remove();
  return out;
})()"""
# Words at 4.5:1 (#376), in light or dark: every climb's badge, the status pills, Check's count, the round trip's cost
# on Make 3 loops, the active weather layers' chips, the warning box in each of Check's groups; and the drop hint's
# words on a card of their own, not on the map (large: 3:1)
CT_WORDS = r"""(async () => {""" + CT_HELP + r"""
  const p = polku.planner, K = await import(location.origin + '/js/config.js'), a = p.analysis;
  if (!a || !a.climbs) return ['no route to draw climbs on'];
  const keep = a.climbs, main = p.mainSport, low = [];
  const fake = (cls, avg) => ({ cls, avg, max: avg, gain: 20, len: 200, from: 0, to: 200, start: 0, end: 1 });
  const badges = () => p.els.climbs.querySelectorAll('.badge').forEach((e) => { const r = ratio(rgb(cs(e).color), rgb(cs(e).backgroundColor)); if (r < 4.5) low.push(`${e.textContent} ${r.toFixed(2)}:1`); });
  a.climbs = K.DIFF_COLORS.map((_, k) => fake(k, 5)); p.renderClimbs(); badges();
  p.mainSport = () => 'hike'; a.climbs = [22, 17, 12, 8, 4, 1, -3, -12].map((g) => fake(0, g)); p.renderClimbs(); badges();
  delete p.mainSport; a.climbs = keep; p.renderClimbs();
  if (p.mainSport !== main) out.push('the planner’s mainSport() not put back');
  if (low.length) out.push(`climbs' badges under 4.5:1: ${low.join(', ')}`);
  const box = document.body.appendChild(document.createElement('div'));
  box.style.cssText = 'position: fixed; left: 0; top: 0; width: 320px; z-index: 50; background: var(--surface-solid)';
  box.innerHTML = `${['good', 'ok', 'warn', 'bad'].map((k) => `<span class="pill ${k}">A ${k} pill</span>`).join('')}<span class="pl-tab-n">5</span>
    <button class="btn primary big rt-make"><span class="rt-make-t"><span>Make 3 loops</span><small>3 routing calls, up to 6</small></span></button>
    <div class="on-chips"><button class="on-chip wx"><span>Rain radar</span></button><button class="on-chip"><span>Trails</span></button></div>
    ${['danger', 'look', 'unk'].map((k) => `<div class="warn-row ${k}"><span><svg class="ic" width="20" height="20"></svg></span><span><em>Its group</em><b>The ferry doesn't run</b><small>Leg 2</small></span></div>`).join('')}`;
  const words = (e, what) => {
    let bg = solid;
    for (const x of [...function* () { for (let y = e; y && y !== box.parentElement; y = y.parentElement) yield y; }()].reverse()) bg = over(rgb(cs(x).backgroundColor), bg);
    const r = ratio(over(rgb(cs(e).color), bg, +cs(e).opacity), bg);
    if (r < 4.5) out.push(`${what} ${r.toFixed(2)}:1`);
  };
  box.querySelectorAll('.pill').forEach((e) => words(e, `the pill “${e.textContent}”`));
  words(box.querySelector('.pl-tab-n'), 'Check’s count');
  words(box.querySelector('.rt-make small'), 'the round trip’s cost on Make 3 loops');
  box.querySelectorAll('.on-chip').forEach((e) => words(e.firstChild, `the active layer “${e.textContent}”`));
  for (const k of ['danger', 'look', 'unk']) {
    const w = box.querySelector(`.warn-row.${k}`), c = col(val(`--${k}`));
    words(w.querySelector('b'), `the ${k} box's words`); words(w.querySelector('em'), `the ${k} box's group`);
    if (cs(w.querySelector('.ic')).color !== c) out.push(`the ${k} box's icon ${cs(w.querySelector('.ic')).color}, not ${c}`);
    if (cs(w).borderTopStyle !== (k === 'unk' ? 'dashed' : 'solid')) out.push(`the ${k} box's edge ${cs(w).borderTopStyle}`);
  }
  box.remove();
  document.body.classList.add('dropping');
  const hint = document.querySelector('.drop-hint'), say = hint.firstElementChild || hint, hb = rgb(cs(say).backgroundColor);
  if (hb.length > 3 && hb[3] < 1) out.push('the drop hint’s words lie on the map');
  else if (ratio(rgb(cs(say).color), hb) < 3) out.push(`the drop hint’s words ${ratio(rgb(cs(say).color), hb).toFixed(2)}:1`);
  document.body.classList.remove('dropping');
  probe.remove();
  return out;
})()"""
# A press answers: a chip, a button and a switch shrink a little while held (motion allowed)
# a note (the toast) shown from hidden, and gone again: what moves on its way in and out (#540)
CT_TOAST = """(async () => {
  const { toast } = await import(location.origin + '/js/ui.js'), t = document.querySelector('#toast'), wait = (ms) => new Promise((r) => setTimeout(r, ms));
  t.classList.remove('show'); t.hidden = true; await wait(50);
  toast('A note', { ms: 2000 });
  const moves = () => t.getAnimations().map((a) => a.transitionProperty).sort().join(' ') || 'nothing';
  const enter = moves();
  await Promise.all(t.getAnimations().map((a) => a.finished)); // (in before it goes: a busy page draws its frames late)
  // read as it starts to go, not after a wait: a slow frame would find it gone
  const exit = await new Promise((r) => { const mo = new MutationObserver(() => { if (!t.classList.contains('show')) { mo.disconnect(); r(moves()); } }); mo.observe(t, { attributes: true, attributeFilter: ['class'] }); });
  await wait(400);
  return [enter, exit];
})()"""
CT_PRESSED = """((sel) => { const e = document.querySelector(sel), m = getComputedStyle(e).transform.match(/matrix\\(([\\d.]+)/); return m ? +m[1] : 1; })"""
CT_POINTS = "(async () => { const p = polku.planner; p.setActive(true); p.clear(); p.setMode('line'); for (const q of [[23.80, 61.512], [23.815, 61.5155], [23.83, 61.513]]) p.addPoint(q); await new Promise((r) => setTimeout(r, 800)); return true; })()"
CT_RING = """((sel) => { const e = document.activeElement, c = getComputedStyle(e), probe = document.body.appendChild(document.createElement('i'));
  probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--focus'); const want = getComputedStyle(probe).color; probe.remove();
  return { at: e.matches(sel), el: (e.className && e.className.baseVal === undefined ? e.className : e.tagName).slice(0, 40), ring: `${c.outlineStyle} ${c.outlineWidth} ${c.outlineColor}`, want: `solid 2px ${want}`, offset: c.outlineOffset }; })"""
# #375: the top bar on a phone at 200 %: its logo, search, sport and Settings on the screen and apart, the search at
# least a target wide; a tap on the search opens its field across the bar, wide enough to type in with nothing over
# it, and Escape folds it back. (Nothing is typed: no requests to the search's services.)
CT_TOPBAR = """(() => {
  const out = [], W = innerWidth, items = [['the logo', '.topbar .brand'], ['the search', '.topbar .search'], ['the sport', '#activity-bar .act-current'], ['Settings', '#btn-settings']];
  const shown = items.map(([n, s]) => [n, document.querySelector(s)]).filter(([, e]) => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(([n, e]) => [n, e.getBoundingClientRect()]);
  const box = (r) => `x ${Math.round(r.left)}–${Math.round(r.right)}`;
  for (const [n, r] of shown) if (r.left < -0.5 || r.right > W + 0.5) out.push(`${n} at ${box(r)} on a ${W} px screen`);
  shown.forEach(([n, a], i) => shown.slice(i + 1).forEach(([m, b]) => { if (a.left < b.right - 0.5 && b.left < a.right - 0.5) out.push(`${n} (${box(a)}) and ${m} (${box(b)}) over each other`); }));
  const se = shown.find(([n]) => n === 'the search'), target = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--target'));
  if (!se) out.push('no search'); else if (se[1].width < target - 0.5) out.push(`the search ${Math.round(se[1].width)} px wide, under ${target} px`);
  const s = document.querySelector('.topbar .search').getBoundingClientRect();
  return { out, at: [s.left + Math.min(s.width / 2, 22), s.top + s.height / 2] };
})()"""
CT_TOPBAR_OPEN = """new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => {
  const out = [], i = document.getElementById('search-input'), r = i.getBoundingClientRect(), W = innerWidth;
  if (document.activeElement !== i) { ok([`a tap on the search: the focus on ${document.activeElement?.id || document.activeElement?.tagName}, not its field`]); return; }
  if (getComputedStyle(i).opacity !== '1' || r.width < 100) out.push(`its field ${Math.round(r.width)} px wide${getComputedStyle(i).opacity !== '1' ? ', not shown' : ''}`);
  if (r.left < -0.5 || r.right > W + 0.5) out.push(`its field at x ${Math.round(r.left)}–${Math.round(r.right)} on a ${W} px screen`);
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  if (top !== i && !i.contains(top)) out.push(`${top?.id || top?.className || 'nothing'} over its field`);
  ok(out);
})))"""
# a button's label in Finnish at 200 %: it wraps inside its button, which stays in its card (the top bar at 200 % is #375's)
CT_WRAP = r"""(async () => {""" + CT_HELP + r"""
  const p = polku.planner;
  p.setActive(true); p.clear(); p.openLoop(polku.map.getCenter().toArray()); await wait(800);
  const make = document.querySelector('.pl-way .rt-make'), t = make && make.querySelector('.rt-make-t > span');
  if (!t) return ['no Make 3 loops'];
  t.textContent = 'Muodosta kolme kiertoreittiä';
  const box = document.querySelector('.pl-way').appendChild(document.createElement('div'));
  box.style.width = '120px';
  box.innerHTML = '<button class="btn">Tallenna offline-käyttöön</button>';
  await wait(100);
  for (const [b, what] of [[make, 'Make 3 loops'], [box.firstChild, 'a button']])
    for (const e of [b, ...b.querySelectorAll('*')]) if (e.getClientRects().length && (!inside(e, b) || e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)) { out.push(`${what}'s words run out of it, in Finnish at 200 %`); break; }
  const mr = make.getBoundingClientRect(), wr = document.querySelector('.pl-way').getBoundingClientRect(); // (the card scrolls: across only)
  if (mr.left < wr.left - 1 || mr.right > wr.right + 1) out.push(`Make 3 loops runs out of its card (${Math.round(mr.left)}–${Math.round(mr.right)} px in ${Math.round(wr.left)}–${Math.round(wr.right)} px)`);
  box.remove(); probe.remove();
  return out;
})()"""
# a point's card at 200 % with a long Finnish name: the name breaks inside the card; a row with a value gives its name room
CT_NAME = r"""(async () => {""" + CT_HELP + r"""
  const p = polku.planner;
  p.setName(1, 'Pohjois-Pohjanmaan virkistysalueyhdistyksen Ylikiiminginjoen laavu');
  p.openPointCard(p.points[1], { from: 'map' }); await wait(1200);
  const c = document.querySelector('.pl-way.card'), name = c && c.querySelector('.way-hint b');
  if (!name) return ['no card'];
  if (!inside(name, c)) out.push(`the name runs off the card (${Math.round(name.getBoundingClientRect().right)} px, the card's edge ${Math.round(c.getBoundingClientRect().right)} px)`);
  const rows = [...c.querySelectorAll('.row')].filter((r) => r.querySelector('.val'));
  if (!rows.length) out.push('no row with a value');
  for (const r of rows) {
    const n = r.querySelector('span:nth-child(2)').getBoundingClientRect(), v = r.querySelector('.val').getBoundingClientRect();
    if (v.top < n.bottom - 1 && n.width < 0.5 * r.getBoundingClientRect().width) out.push(`“${r.querySelector('b').textContent}” squeezed to ${Math.round(n.width)} px beside its value`);
  }
  probe.remove();
  return out;
})()"""


def controls(chrome):
    fails = []

    def key(pg, k, code, vk, char=None):
        for event in ['rawKeyDown'] + (['char'] if char is not None else []) + ['keyUp']:
            fields = {'type': event, 'key': k, 'code': code, 'windowsVirtualKeyCode': vk}
            if char is not None and event == 'char':
                fields['text'] = char
            chrome.send('Input.dispatchKeyEvent', fields, pg.s)
        time.sleep(0.3)

    def ring(pg, what, inside, sel):
        r = pg.js(f'({CT_RING})({json.dumps(sel)})')
        if not r['at']:
            fails.append(f"{what}: the focus is on {r['el']}, not {sel}")
        elif r['ring'] != r['want'] or (inside and not r['offset'].startswith('-')):
            fails.append(f"{what}: focus on {r['el']} draws {r['ring']} offset {r['offset']}, not {r['want']}{' inside' if inside else ''}")

    def page(w, h_, phone):
        pg = chrome.page(w, h_, phone)
        pg.c.send('Network.setBlockedURLs', {'urls': ['*traficom.fi*']}, pg.s)
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"', 'polku:plannerDock': '"left"'}, '#13/61.514/23.822')
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        return pg

    for w, h_, phone in ((390, 844, True), (1440, 900, False)):
        name = f'{w}x{h_}'
        pg = page(w, h_, phone)
        try:
            fails += [f'{name}: {f}' for f in pg.js(CT_LOOK)]
            if phone:
                # a note at the left above Plan, the planner closed (its own place on phones): it rises too
                pg.c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'no-preference'}]}, pg.s)
                enter, exit = pg.js(CT_TOAST)
                if (enter, exit) != ('opacity translate', 'opacity translate'):
                    fails.append(f'{name}: a note fades and rises in with {enter}, out with {exit}, not opacity and translate')
                pg.c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce'}]}, pg.s)
                # the ⋯ menu's items draw the focus ring inside (#385)
                pg.js(CT_POINTS)
                pg.js("document.querySelector('#pl-tools [aria-haspopup=menu][aria-label^=More]').click(), true")  # (it focuses its first item)
                key(pg, 'ArrowDown', 'ArrowDown', 40)
                ring(pg, f'{name}: the ⋯ menu', True, '.menu-pop .menu-item')
                key(pg, 'Escape', 'Escape', 27)
            else:
                # a press answers (motion allowed): the round trip's chip, Make 3 loops, its switch
                pg.c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'no-preference'}]}, pg.s)
                pg.js("(async () => { const p = polku.planner; p.setActive(true); p.clear(); p.openLoop(polku.map.getCenter().toArray()); await new Promise((r) => setTimeout(r, 800)); return true; })()")
                for sel, what in (('.pl-way .rt-chips .chip:not([aria-pressed=true])', 'a chip'), ('.pl-way .rt-make', 'Make 3 loops'), ('.pl-way .rt-unit button:not([aria-pressed=true])', 'a switch')):
                    # (and what a press there lands on, for the FAIL line)
                    x, y, on = pg.js(f"(() => {{ const e = document.querySelector({json.dumps(sel)}), r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y);"
                                     " return [x, y, !t || e.contains(t) ? '' : t.id || String(t.className) || t.tagName]; })()")
                    if on:
                        fails.append(f'{name}: {what} is under {on}')
                    pg.c.send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': x, 'y': y, 'button': 'none'}, pg.s)
                    pg.c.send('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': x, 'y': y, 'button': 'left', 'buttons': 1, 'clickCount': 1}, pg.s)
                    # held until the page has had the press and its scale has moved, 5 s at most: in software a frame can take
                    # a second or more, and the 0.12 s scale waited that long to start, so 0.3 s after the press it was still at 1 (#423)
                    pg.js(f"(async (e) => {{ const t0 = Date.now(); while ((!e.matches(':active') || e.getAnimations().some((a) => a.playState === 'running')) && Date.now() - t0 < 5000)"
                          f" await new Promise((r) => setTimeout(r, 50)); return true; }})(document.querySelector({json.dumps(sel)}))")
                    s = pg.js(f"({CT_PRESSED})({json.dumps(sel)})")
                    pg.c.send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': 900, 'y': 450, 'button': 'left', 'buttons': 1}, pg.s)
                    pg.c.send('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': 900, 'y': 450, 'button': 'left', 'buttons': 0, 'clickCount': 1}, pg.s)
                    if not 0.95 < s < 0.99:
                        fails.append(f'{name}: {what} held down is at scale {s}, not 0.97')
                enter, exit = pg.js(CT_TOAST)
                if (enter, exit) != ('opacity translate', 'opacity translate'):
                    fails.append(f'{name}: a note fades and rises in with {enter}, out with {exit}, not opacity and translate')
                pg.c.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce'}]}, pg.s)
                enter, exit = pg.js(CT_TOAST)
                if (enter, exit) != ('opacity', 'opacity'):
                    fails.append(f'{name}, reduced motion: a note comes in with {enter}, goes with {exit}, not opacity alone')
                # one focus ring (#385): the sport menu's sports and the ⋯ menu's items draw it inside, a button outside
                pg.js("polku.planner.close(); document.querySelector('#activity-bar .act-current').focus(), true")
                key(pg, 'Enter', 'Enter', 13, '\r')
                key(pg, 'ArrowDown', 'ArrowDown', 40)
                ring(pg, f'{name}: the sport menu', True, '#activity-bar .act')
                key(pg, 'Escape', 'Escape', 27)
                pg.js("(async () => { const p = polku.planner; p.setActive(true); p.clear(); p.openLoop(polku.map.getCenter().toArray()); await new Promise((r) => setTimeout(r, 800)); document.querySelector('.pl-way .rt-make').focus(); return true; })()")
                ring(pg, f'{name}: Make 3 loops', False, '.pl-way .rt-make')
                pg.js(CT_POINTS)
                # words at 4.5:1 (#376), with the route's climbs drawn, in light and dark
                for theme in ('light', 'dark'):
                    scheme(pg, theme)
                    pg.js(STILL)
                    fails += [f'{name} {theme}: {f}' for f in pg.js(CT_WORDS)]
                scheme(pg, 'light')
            fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        finally:
            pg.close()

    # #375: the top bar at 200 % (CT_TOPBAR), on a 390 and a 360 phone
    def topbar(pg, name):
        r = pg.js(CT_TOPBAR)
        fails.extend(f'{name}, the top bar: {f}' for f in r['out'])
        pg.quick_tap(*r['at'])
        fails.extend(f'{name}, the top bar: {f}' for f in pg.js(CT_TOPBAR_OPEN))
        key(pg, 'Escape', 'Escape', 27)
        fails.extend(f'{name}, the top bar after Escape: {f}' for f in pg.js(CT_TOPBAR)['out'])

    pg = page(180, 370, True)
    try:
        topbar(pg, '360x740 at 200 %')
        fails += [f'360x740 at 200 % console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    # 200 % on a phone: a button's label in Finnish (#373), a point's long Finnish name and a row with a value (#384)
    pg = page(195, 422, True)
    try:
        topbar(pg, '390x844 at 200 %')
        fails += [f'390x844 at 200 %: {f}' for f in pg.js(CT_WRAP)]
        if not pg.js(PC_ROUTE, timeout=30000):
            fails.append('390x844 at 200 %: no route')
        pg.js(SETTLED)
        fails += [f'390x844 at 200 %, a point’s card: {f}' for f in pg.js(CT_NAME)]
        fails += [f'390x844 at 200 % console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the design system's controls (#382): one look per job, the focus ring, labels that wrap, 200 %, words at 4.5:1, press" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# When you leave (25d, #364's C [r6-leave-c, r6-leave-c-set, r6-leave-c-far, r6-leave-c-passed, r6-night-c2, r6-whole-c-share,
# tabs-c-go-set, tabs-c-share, tabs-c-passed]): one Leave row, on the start's card and in Go, with an invisible date and time
# field over it that opens the phone's own picker; once set, the date is the row's line, the time its value, and Now on that
# line. Past the forecast's reach, No forecast yet. Within two days the timeline keeps the same time. The date travels in
# share links, saved routes and a reload; one that has passed opens at Now, saying when it was planned for. A stay of
# several nights, with Go on at by the phone's clock; GPX with the planned times in words, none on the track (straight legs)
LV_JS = """(() => { window.LV = {
  day: (sec) => new Date(sec * 1000).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }),
  clock: (sec) => new Date(sec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  iso(sec) { const d = new Date(sec * 1000), z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; },
  at(days, hh, mm) { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hh, mm, 0, 0); return d.getTime() / 1000; },
  row: (where) => document.querySelector(where === 'go' ? '#pl-pane-go .row.pick' : '.pl-way.card .row.pick'),
  // the row as it is: what it says, where its Now is, whether the field is what a tap meets
  read(where) {
    const r = LV.row(where);
    if (!r) return null;
    const box = (e) => (e && e.getClientRects().length ? e.getBoundingClientRect() : null), now = r.querySelector('.pick-now'), line = r.querySelector('.pick-line'), val = r.querySelector('.val'), input = r.querySelector('input');
    const R = r.getBoundingClientRect(), n = box(now), v = box(val), top = document.elementFromPoint(R.left + Math.min(60, R.width / 3), R.top + R.height / 2);
    const note = r.closest('.pick-leave')?.querySelector('.pick-note:not([hidden])');
    return { label: r.querySelector('b').textContent, line: line && box(line) ? line.textContent : '', val: val ? val.textContent : '', type: input && input.type, min: input ? input.min : '',
      now: n ? { inside: n.top >= R.top - 1 && n.bottom <= R.bottom + 1, x: n.left + n.width / 2, y: n.top + n.height / 2, h: Math.round(n.height) } : null,
      valLines: v ? Math.round(v.height / parseFloat(getComputedStyle(val).lineHeight)) : 0, over: !!input && top === input, note: note ? note.textContent.trim() : '' };
  },
  set(where, value) { const i = LV.row(where).querySelector('input'); i.value = value; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return true; },
  // where to press it, in sight as a person scrolls to it (the card, or the sheet's body, never the page, which the app
  // scrolls back), once it has stayed put two frames apart with the map still; found afresh each time, as a card is
  // built again when its numbers come in (a row kept from before was detached, at 0, 0)
  async show(get) {
    const frames = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    let a = null, same = 0;
    for (let k = 0; k < 30 && same < 2; k++) {
      const el = get(), s = el && el.isConnected && el.getClientRects().length && (el.closest('.pl-way.card') || el.closest('.sheet-body'));
      if (s) { const e = el.getBoundingClientRect(), r = s.getBoundingClientRect(); if (e.bottom > r.bottom) s.scrollTop += e.bottom - r.bottom + 8; else if (e.top < r.top) s.scrollTop -= r.top - e.top + 8; }
      await frames();
      const b = s && get()?.getClientRects().length ? get().getBoundingClientRect() : null, at = b && { x: b.left + Math.min(60, b.width / 3), y: b.top + b.height / 2 };
      same = a && at && Math.abs(a.x - at.x) < 1 && Math.abs(a.y - at.y) < 1 && !polku.map.isMoving() ? same + 1 : 0;
      a = at;
    }
    return a;
  },
};
window.__picked = [];
HTMLInputElement.prototype.showPicker = function () { window.__picked.push(this.type); };
return true; })()"""

# the rest, in one page's JS: share links, a passed date, the saved route, a stay of nights, GPX
LV_REST = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [], p = polku.planner;
  const P = await import(location.origin + '/js/planner.js'), S = await import(location.origin + '/js/stops.js'), C = await import(location.origin + '/js/cards.js');
  const far = LV.at(28, 7, 30), tomorrow = LV.at(1, 9, 0), when = (sec) => `${LV.day(sec)}, ${LV.clock(sec)}`;
  // a share link carries the date, and says so: Copy share link and the whole route's Share link
  p.reveal('take');
  await wait(300);
  LV.set('go', LV.iso(far));
  await wait(300);
  const q = new URL(p.shareUrl()).searchParams;
  if (q.get('lv') !== String(Math.round(far / 60))) errs.push(`the share link's date: lv=${q.get('lv')}, not ${Math.round(far / 60)}`);
  const copy = [...document.querySelectorAll('#pl-pane-go .take-along .btn')].find((b) => /Copy share link/.test(b.textContent));
  const want = `Includes when you leave: ${when(far)}`;
  if (copy?.querySelector('small')?.textContent !== want) errs.push(`Copy share link says “${copy?.querySelector('small')?.textContent || ''}”, not “${want}”`);
  p.cards.open(C.wholeCard(p), { at: p.points[0] });
  await wait(300);
  const whole = () => document.querySelector('.pl-way.card .row[data-k="share"] small')?.textContent || '';
  if (whole() !== want) errs.push(`the whole route's Share link says “${whole()}”`);
  p.cards.close();
  // opened: the date comes back; a link from before it has none, and leaves now
  p.restore(P.parseShared(q));
  await wait(300);
  if (p.startSec() !== far) errs.push(`from the link: leaves ${new Date(p.startSec() * 1000)}, not ${new Date(far * 1000)}`);
  const old = new URLSearchParams(q);
  old.delete('lv');
  p.restore(P.parseShared(old));
  await wait(300);
  if (p.leaveAt != null || LV.read('go').val !== 'Now' || LV.read('go').note) errs.push(`a link without a date: ${JSON.stringify(LV.read('go'))}, leaveAt ${p.leaveAt}`);
  // a date that has passed opens at Now, saying when it was planned for, on the start's card and in Go
  const past = Math.round(Date.now() / 60000) - 125;
  q.set('lv', String(past));
  p.restore(P.parseShared(q));
  await wait(300);
  const passed = `Planned for ${when(past * 60)}. That’s passed, so it leaves now: pick a new time above.`;
  if (p.leaveAt != null || LV.read('go').val !== 'Now' || LV.read('go').note !== passed) errs.push(`a passed date in Go: ${JSON.stringify(LV.read('go'))}`);
  p.openPointCard(p.points[0]);
  await wait(300);
  if (LV.read('card')?.note !== passed) errs.push(`a passed date on the start's card: ${JSON.stringify(LV.read('card'))}`);
  p.cards.close();
  LV.set('go', LV.iso(tomorrow));
  await wait(300);
  if (LV.read('go').note) errs.push(`the note stays once a new time is set: ${LV.read('go').note}`);
  // the saved route keeps it, and one that has passed opens at Now; so does a route saved offline
  p.save();
  p.legs = []; p.points = []; p.leaveAt = null;
  p.loadSaved();
  await wait(400);
  if (p.startSec() !== tomorrow) errs.push(`the saved route leaves ${new Date(p.startSec() * 1000)}, not ${new Date(tomorrow * 1000)}`);
  const kept = JSON.parse(localStorage.getItem('polku:route'));
  kept.leave = past * 60;
  localStorage.setItem('polku:route', JSON.stringify(kept));
  p.legs = []; p.points = [];
  p.loadSaved();
  await wait(400);
  if (p.leaveAt != null || LV.read('go').note !== passed) errs.push(`a saved route whose date has passed: ${JSON.stringify(LV.read('go'))}`);
  LV.set('go', LV.iso(tomorrow));
  const snap = p.routeSnapshot();
  p.clear();
  p.restoreSnapshot(snap);
  await wait(400);
  if (p.startSec() !== tomorrow) errs.push(`a route saved offline leaves ${new Date(p.startSec() * 1000)}`);
  // Undo after opening one brings back the route you had leaving when it did, and Redo the opened one's (#506)
  LV.set('go', LV.iso(far));
  await wait(300);
  p.restoreSnapshot(snap);
  await wait(400);
  p.undo();
  await wait(400);
  if (p.startSec() !== far || LV.read('go').val !== LV.clock(far)) errs.push(`Undo after opening a route: leaves ${new Date(p.startSec() * 1000)}, Go says ${LV.read('go').val}`);
  p.redo();
  await wait(400);
  if (p.startSec() !== tomorrow) errs.push(`Redo after that: leaves ${new Date(p.startSec() * 1000)}`);
  // a departure that passes while Polku stays open leaves now, saying so, as a reload says (the review of #475): a share
  // link made then carries no date, and the page shown again leaves now
  const realNow = Date.now, soon = Math.ceil(Date.now() / 60000) * 60 + 1800;
  try {
    for (const how of ['share', 'shown']) {
      LV.set('go', LV.iso(soon));
      await wait(200);
      Date.now = () => realNow() + 75 * 60000;
      const lv = how === 'share' ? new URL(p.shareUrl()).searchParams.get('lv') : (document.dispatchEvent(new Event('visibilitychange')), null);
      await wait(200);
      const r = LV.read('go'), want = `Planned for ${when(soon)}. That’s passed, so it leaves now: pick a new time above.`;
      if (lv != null || p.leaveAt != null || Math.abs(p.startSec() - Date.now() / 1000) > 60 || r.val !== 'Now' || r.note !== want) errs.push(`a departure passed while open (${how}): lv=${lv}, leaveAt ${p.leaveAt}, starts ${Math.round(p.startSec() - Date.now() / 1000)} s from now, Go says ${r.val}, “${r.note}”`);
      Date.now = realNow;
    }
  } finally { Date.now = realNow; }
  LV.set('go', LV.iso(tomorrow));
  // two nights at via 2: Stay with the stepper, and Go on at by the phone's clock, its line the day
  p.setStop(2, { on: 480 });
  for (let k = 0; k < 40 && !(p.analysis && p.analysis.waits && p.analysis.waits.length === 1); k++) await wait(200);
  return errs;
})()"""

LV_NIGHTS = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [], p = polku.planner;
  const S = await import(location.origin + '/js/stops.js');
  for (let k = 0; k < 40 && !(p.analysis && p.analysis.waits && p.analysis.waits.length === 1 && p.analysis.waits[0].stop.n === 2); k++) await wait(200);
  const w = p.analysis.waits[0], go = w.arrive + w.sec, a = new Date(w.arrive * 1000), g = new Date(go * 1000);
  if (JSON.stringify(p.stopAt(2)) !== '{"on":480,"n":2}') errs.push(`the stop after +: ${JSON.stringify(p.stopAt(2))}`);
  if (g.getHours() !== 8 || Math.round((new Date(g).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)) / 864e5) !== 2) errs.push(`two nights from ${a} go on ${g}`);
  const r = LV.read('card');
  if (!r || r.label !== 'Go on at' || r.type !== 'time' || r.val !== '08:00' || r.line !== `${LV.day(go)}, after 2 nights` || !r.over) errs.push(`Go on at: ${JSON.stringify(r)}`);
  LV.set('card', '07:00');
  await wait(400);
  if (JSON.stringify(p.stopAt(2)) !== '{"on":420,"n":2}') errs.push(`Go on at 07:00: ${JSON.stringify(p.stopAt(2))}`);
  if (document.querySelector('.sum-time small')?.textContent !== '3 days') errs.push(`the summary: ${document.querySelector('.sum-time small')?.textContent}`);
  p.cards.close();
  p.reveal('points');
  await wait(300);
  const titles = [...document.querySelectorAll('.wpl .sec2-head b')].map((b) => b.textContent.split(' · ')[0]);
  if (titles.join() !== 'Day 1,Day 3') errs.push(`the list's days: ${titles.join(', ')}`);
  // the link and the saved route keep the nights; one night is as before
  const q = new URL(p.shareUrl()).searchParams;
  if (q.get('st') !== '2:n0700x2') errs.push(`st=${q.get('st')}`);
  // (a stay longer than the most in a hand-made link is the most, as a break longer than a day is a day: #506)
  if (JSON.stringify(S.decodeStops('2:n0800,3:n0700x2,4:n0700x0,5:n0700x31,6:2000')) !== '[[2,{"on":480}],[3,{"on":420,"n":2}],[4,{"on":420}],[5,{"on":420,"n":30}],[6,{"min":1440}]]') errs.push(`st= read: ${JSON.stringify(S.decodeStops('2:n0800,3:n0700x2,4:n0700x0,5:n0700x31,6:2000'))}`);
  const t = Date.parse('2026-10-14T20:00:00+03:00') / 1000;
  if (S.restSec({ on: 480, n: 2 }, t) - S.restSec({ on: 480 }, t) !== 86400) errs.push(`two nights rest ${S.restSec({ on: 480, n: 2 }, t)} s`);
  p.save();
  p.legs = []; p.points = [];
  p.loadSaved();
  await wait(400);
  if (JSON.stringify(p.stopAt(2)) !== '{"on":420,"n":2}') errs.push(`the saved route's stay: ${JSON.stringify(p.stopAt(2))}`);
  for (let k = 0; k < 40 && !(p.analysis && p.analysis.waits && p.analysis.waits.length === 1); k++) await wait(200);
  // GPX: the planned times in words in the waypoints' descriptions, nothing on the track
  const gpx = async () => {
    let blob = null;
    const make = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (b) => { blob = b; return make.call(URL, b); };
    HTMLAnchorElement.prototype.click = function () { if (!this.download) click.call(this); };
    try { p.exportGpx(); } finally { URL.createObjectURL = make; HTMLAnchorElement.prototype.click = click; }
    return new DOMParser().parseFromString(await blob.text(), 'application/xml');
  };
  const doc = await gpx(), descs = (d) => [...d.querySelectorAll('wpt')].map((x) => x.querySelector('desc')?.textContent || ''), desc = descs(doc);
  const s0 = p.startSec(), w2 = p.analysis.waits[0];
  const on = `${LV.day(w2.arrive + w2.sec)}, 07:00`;
  if (desc[0] !== `Leave ${LV.day(s0)}, ${LV.clock(s0)}` || !/^There at /.test(desc[1]) || !desc[2].startsWith('There at ') || !desc[2].endsWith(`. 2 nights, go on ${on}`) || !desc[3].startsWith(`There at ${LV.day(w2.arrive + w2.sec)}, `)) errs.push(`GPX's descriptions: ${desc.join(' / ')}`);
  if (doc.querySelectorAll('trkpt').length < 4 || doc.querySelector('trkpt time') || !doc.querySelector('metadata > time')) errs.push(`GPX's times: ${doc.querySelectorAll('trkpt time').length} on the track, ${doc.querySelectorAll('metadata > time').length} in its metadata`);
  // leaving now, exported ten minutes after the forecast came: Leave is the moment the route is timed from, as There at's
  // times are, so it never comes after them (#506)
  p.setLeave(null);
  for (let k = 0; k < 50 && !(p.analysis && p.analysis.wind && p.analysis.wind.startSec < Date.now() / 1000 + 60 && p.analysis.waits); k++) await wait(200);
  if (!p.analysis.wind) errs.push('leaving now: no forecast came');
  const realNow = Date.now;
  let now;
  try { Date.now = () => realNow() + 10 * 60000; now = descs(await gpx()); } finally { Date.now = realNow; }
  const s1 = p.arriveAt(0);
  if (now[0] !== `Leave ${LV.day(s1)}, ${LV.clock(s1)}` || !now[1].startsWith(`There at ${LV.clock(p.arriveAt(1))}`)) errs.push(`GPX leaving now, timed from ${LV.clock(s1)}: ${now.join(' / ')}`);
  return errs;
})()"""


def leave(chrome):
    fails = []

    def press(pg, at, name, touch):
        if not at:
            fails.append(f'{name}: not on screen')
            return False
        if touch:
            pg.quick_tap(at['x'], at['y'])
        else:
            for kind in ('mouseMoved', 'mousePressed', 'mouseReleased'):
                pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': at['x'], 'y': at['y'], 'button': 'none' if kind == 'mouseMoved' else 'left',
                                                      'buttons': 1 if kind == 'mousePressed' else 0, 'clickCount': 1}, pg.s)
        time.sleep(0.5)
        return True

    def enter(pg):
        for event in ('rawKeyDown', 'char', 'keyUp'):
            fields = {'type': event, 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13}
            if event == 'char':
                fields['text'] = '\r'
            pg.c.send('Input.dispatchKeyEvent', fields, pg.s)
        time.sleep(0.4)

    # (once the route's numbers are in and the sheet has come to its size)
    ready = lambda pg: (pg.js("Promise.resolve(polku.planner.analysing).then(() => true, () => true)"), pg.js(SETTLED))
    show = lambda pg, where: (ready(pg), pg.js(f"LV.show(() => LV.row({json.dumps(where)}))"))[1]
    now_at = lambda pg, where: (ready(pg), pg.js(f"LV.show(() => LV.row({json.dumps(where)})?.querySelector('.pick-now'))"))[1]

    def one(w, h_, phone):
        name, touch = f'{w}x{h_}', phone
        pg = chrome.page(w, h_, phone)
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"', 'polku:plannerDock': '"left"'}, '#13/61.514/23.822')
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        if not pg.js(PC_ROUTE, timeout=30000):
            fails.append(f'{name}: no route')
            pg.close()
            return
        pg.js(LV_JS)
        # the start's card: Leave · Now ›, the picker's field over the row, opened by a tap or a click (and Enter)
        pg.js("polku.planner.openPointCard(polku.planner.points[0]); true")
        time.sleep(0.4)
        show(pg, 'card')  # (in sight first: at night a box saying so comes before it)
        r = pg.js("LV.read('card')")
        if not r or r['label'] != 'Leave' or r['val'] != 'Now' or r['type'] != 'datetime-local' or r['now'] or not r['over'] or not r['min'] or r['line'] != ('Sets the times and the weather along the route' if phone else ''):
            fails.append(f"{name}: the start's card's Leave row: {r}")
            pg.close()
            return
        # its quarter hours on the clock's: min on a quarter hour, so the next whole hour is a step, never a mismatch (the review of #475)
        q = pg.js("(() => { const i = LV.row('card').querySelector('input'), d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0); i.value = LV.iso(d / 1000); const bad = i.validity.stepMismatch; i.value = ''; return { min: i.min, bad }; })()")
        if int(q['min'][-2:]) % 15 or q['bad']:
            fails.append(f"{name}: Leave's quarter hours: min {q['min']}, the next whole hour a step mismatch: {q['bad']}")
        press(pg, show(pg, 'card'), f'{name}: Leave', touch)
        if not phone:
            enter(pg)
        picked = pg.js("window.__picked")
        if picked != ['datetime-local'] * (1 if phone else 2):
            fails.append(f"{name}: a {'tap' if phone else 'click and Enter'} on Leave opened {picked or 'no picker'}")
        # set for tomorrow at 07:30: the date is the line, the time the value, Now on the line, the time on one line
        pg.js("LV.set('card', LV.iso(LV.at(1, 7, 30)))")
        time.sleep(0.5)
        r = pg.js("({ ...LV.read('card'), start: polku.planner.startSec(), want: LV.at(1, 7, 30), day: 'Tomorrow, ' + LV.day(LV.at(1, 7, 30)), clock: LV.clock(LV.at(1, 7, 30)) })")
        if r['start'] != r['want'] or r['line'] != r['day'] or r['val'] != r['clock'] or not r['now'] or not r['now']['inside'] or r['valLines'] != 1:
            fails.append(f"{name}: Leave set for tomorrow, 07:30: {r}")
        # Go has the same row, in step; within two days the timeline and the safety layers keep the same time
        pg.js("polku.planner.cards.close(); polku.planner.reveal('speed'); true")
        time.sleep(0.6)
        r = pg.js("({ ...LV.read('go'), day: 'Tomorrow, ' + LV.day(LV.at(1, 7, 30)), clock: LV.clock(LV.at(1, 7, 30)) })")
        if not r or r['line'] != r['day'] or r['val'] != r['clock'] or not r['now']:
            fails.append(f"{name}: Go's Leave row: {r}")
            pg.close()
            return
        r = pg.js("""(async () => { const W = await import(location.origin + '/js/wxmap.js'), p = polku.planner;
          // (what the field says: on the night the clocks go back, an hour is twice, and its words mean the first)
          const want = new Date(LV.iso(W.timeAtHour(5))).getTime() / 1000;
          LV.set('go', LV.iso(W.timeAtHour(5))); await new Promise((ok) => setTimeout(ok, 300));
          const a = { start: p.startSec(), want, hour: polku.weather.hour, wantHour: Math.floor((want - Math.floor(Date.now() / 3600000) * 3600) / 3600), safety: Math.round(polku.safety.app.time()) };
          polku.weather.setHour(7); await new Promise((ok) => setTimeout(ok, 300));
          return { ...a, then: p.startSec(), want7: W.timeAtHour(7), val: LV.read('go').val, clock: LV.clock(W.timeAtHour(7)) }; })()""")
        if r['start'] != r['want'] or r['hour'] != r['wantHour'] or abs(r['safety'] - r['start']) > 60:
            fails.append(f"{name}: Leave in five hours: the timeline at hour {r['hour']}, the safety layers at {r['safety'] - r['want']} s from it, leaves at {r['start'] - r['want']} s")
        if abs(r['then'] - r['want7']) > 1 or r['val'] != r['clock']:
            fails.append(f"{name}: the timeline at hour 7: leaves {r['then'] - r['want7']} s from it, Go says {r['val']}")
        # Now, on the row's line: leaving now again
        press(pg, now_at(pg, 'go'), f'{name}: Now', touch)
        r = pg.js("({ ...LV.read('go'), leave: polku.planner.leaveAt, hour: polku.weather.hour })")
        if r['leave'] is not None or r['val'] != 'Now' or r['now'] or r['hour'] != 0:
            fails.append(f"{name}: after Now: {r}")
        # four weeks ahead: past the forecast's reach, said under the row in Go and on the start's card; the timeline stays
        pg.js("LV.set('go', LV.iso(LV.at(28, 7, 30)))")
        time.sleep(0.4)
        want = pg.js("`No forecast yet for ${LV.day(LV.at(28, 7, 30))}. Sunset and the dark still count.`")
        r = pg.js("({ go: LV.read('go').note, hour: polku.weather.hour })")
        pg.js("polku.planner.openPointCard(polku.planner.points[0]); true")
        time.sleep(0.4)
        r['card'] = pg.js("LV.read('card')?.note")
        if r['go'] != want or r['card'] != want or r['hour'] != 0:
            fails.append(f"{name}: four weeks ahead: {r}")
        pg.js("polku.planner.cards.close(); true")
        if phone:
            fails.extend(f'{name}: {e}' for e in pg.js(LV_REST, timeout=60000))
            # a stay of two nights: Stay's stepper, a tap on +
            pg.js("polku.planner.openPointCard(polku.planner.points[2]); true")
            time.sleep(0.4)
            st = pg.js("""(() => { const s = [...document.querySelectorAll('.pl-way.card .rt-step')].find((x) => x.firstElementChild?.textContent === 'Stay');
              return s && { value: s.querySelector('input').value, unit: s.querySelector('.rt-len input + span').textContent, less: s.querySelector('button').disabled, label: s.querySelector('input').getAttribute('aria-label') }; })()""")
            if not st or st['value'] != '1' or st['unit'] != 'night' or not st['less']:
                fails.append(f"{name}: a night's Stay: {st}")
            else:
                press(pg, (ready(pg), pg.js("LV.show(() => [...document.querySelectorAll('.pl-way.card .rt-step button')].find((b) => b.getAttribute('aria-label') === 'One night more'))"))[1], f'{name}: One night more', touch)
                if pg.js("[...document.querySelectorAll('.pl-way.card .rt-step')].find((x) => x.firstElementChild?.textContent === 'Stay')?.querySelector('.rt-len input + span').textContent") != 'nights':
                    fails.append(f'{name}: two nights say “night”')
                pg.js("window.__picked = []; true")
                press(pg, show(pg, 'card'), f'{name}: Go on at', touch)
                if pg.js("window.__picked") != ['time']:
                    fails.append(f"{name}: a tap on Go on at opened {pg.js('window.__picked') or 'no picker'}")
                fails.extend(f'{name}: {e}' for e in pg.js(LV_NIGHTS, timeout=60000))
            # a reload keeps the date
            pg.js("LV.set('go', LV.iso(LV.at(1, 9, 0))); polku.planner.save(); true")
            want = pg.js("LV.at(1, 9, 0)")
            pg.reload()
            pg.js(LV_JS)
            if pg.js("polku.planner.startSec()") != want:
                fails.append(f"{name}: after a reload it leaves {pg.js('new Date(polku.planner.startSec() * 1000).toString()')}")
        fails.extend(f'{name}: console: {e[:160]}' for e in pg.errors())
        pg.close()

    one(390, 844, True)
    one(1440, 900, False)
    print(f"{'ok  ' if not fails else 'FAIL'} when you leave" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Key facts (25d, #471's A2 [kf2-gravel, kf2-gravel-calm, kf2-gravel-check, kf2-multi, kf2-multi-tap, kf2-days, kf2-paddle]) and
# the hardest climb [tabs-c-climbs]: one line under the route's numbers says what stands out (rain, a headwind that adds
# time, unpaved on a road bike, a water leg's wind), else the sport's usual fact, with the weather said when it isn't known;
# a row a sport on a route of two; a trip's hardest day; a tap opens where it's told; Check's top keeps every fact. Climbs:
# one measure a sport, the Hardest tag in a column of one width, the heading naming it (straight legs, set values)
KF_JS = """(() => { window.KF = {
  // the route's numbers as a case needs them, and the line and Check's top as they are then
  set(o = {}) {
    const p = polku.planner, a = p.analysis, n = a.along.length, fill = (v) => new Float32Array(n).fill(v);
    a.activity = o.sport || 'mtb'; p.mainSport = () => a.activity; a.attr.forEach((x) => { if (x) delete x.sport; });
    a.climbs = [{ cls: 1, gain: 60, avg: 5, max: 7, len: 600, from: 100, to: 700, start: 2, end: 8 }, { cls: 2, gain: 21, avg: 12, max: 15, len: 180, from: 900, to: 1080, start: 10, end: 13 }, { cls: 0, gain: 8, avg: 4, max: 5, len: 200, from: 1500, to: 1700, start: 16, end: 18 }];
    a.time = o.time || 3600; a.timeWind = a.time + (o.add || 0) * 60; a.windError = o.failed || false;
    KF.base = KF.base || a.wind || { start: { speed: 5, gust: 7, dir: 180, temp: 8, precip: 0 } }; // (the forecast's other fields, as it came)
    a.wind = o.failed ? null : { ...KF.base, startSec: p.startSec(), head: fill(o.head || 0), speed: fill(5), gust: fill(7), dir: fill(180), cross: fill(0), temp: fill(8), precip: fill(o.rain || 0) };
    if (o.surf) a.surf = a.surf.map(() => o.surf);
    a.waits = o.waits || []; p.renderAnalysis();
    return KF.read();
  },
  read() {
    const p = polku.planner, f = p.els.facts;
    return { line: f ? [...f.querySelectorAll('.kf-b')].map((b) => b.textContent.trim()) : null, h: f ? [...f.querySelectorAll('.kf-b')].map((b) => Math.round(b.getBoundingClientRect().height)) : [],
      strip: [...p.els.stats.querySelectorAll('.stat')].map((s) => `${s.querySelector('.stat-label').textContent}: ${s.querySelector('.stat-value').textContent}`) };
  },
  at(k) { const b = polku.planner.els.facts.querySelectorAll('.kf-b')[k]; if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + Math.min(80, r.width / 3), y: r.top + r.height / 2 }; },
}; return true; })()"""

KF_CLIMBS = """(() => {
  const p = polku.planner, box = p.els.climbs, rows = [...box.querySelectorAll('.li')], tags = [...box.querySelectorAll('.li-tag')];
  const left = rows.map((r) => Math.round(r.querySelector('.li-main').getBoundingClientRect().left));
  return { head: box.querySelector('.climbs-hardest')?.textContent || '', sum: p.sec.climbs.el.querySelector('.sec-sum')?.textContent || '', tags: tags.map((t) => rows.findIndex((r) => r.contains(t))), left: [...new Set(left)].length, n: rows.length };
})()"""


def keyfacts(chrome):
    fails = []

    def press(pg, at, name, touch):
        if not at:
            fails.append(f'{name}: not on screen')
            return False
        if touch:
            pg.quick_tap(at['x'], at['y'])
        else:
            for kind in ('mouseMoved', 'mousePressed', 'mouseReleased'):
                pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': at['x'], 'y': at['y'], 'button': 'none' if kind == 'mouseMoved' else 'left',
                                                      'buttons': 1 if kind == 'mousePressed' else 0, 'clickCount': 1}, pg.s)
        time.sleep(0.6)
        return True

    def one(w, h_, phone):
        name, touch = f'{w}x{h_}', phone
        pg = chrome.page(w, h_, phone)
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"', 'polku:plannerDock': '"left"'}, '#13/61.514/23.822')
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        if not pg.js(PC_ROUTE, timeout=30000):
            fails.append(f'{name}: no route')
            pg.close()
            return
        # (the forecast in, or failed, before the cases set their own)
        pg.js("(async () => { const p = polku.planner; for (let k = 0; k < 150 && !(p.analysis.wind || p.analysis.windError); k++) await new Promise((r) => setTimeout(r, 100)); return true; })()")
        pg.js(KF_JS)
        # nothing stands out: the usual fact, the hardest climb by the uphill grade; Climbs says it and tags it
        r = pg.js("KF.set({ add: 3 })")
        if r['line'] != ['Hardest climb ↑S2, 21 m at 12 %'] or 'Hardest climb: ↑S2' not in r['strip']:
            fails.append(f"{name}: a calm ride: {r}")
            pg.close()
            return
        if phone and min(r['h']) < 44:
            fails.append(f"{name}: a key fact {min(r['h'])} px tall")
        c = pg.js(KF_CLIMBS)
        if c['head'] != 'Hardest: ↑S2, 21 m at 12 %' or c['sum'] != 'Hardest: ↑S2, 21 m at 12 %' or c['tags'] != [1] or c['left'] != 1 or c['n'] != 3:
            fails.append(f"{name}: Climbs: {c}")
        pg.js(SETTLED)
        press(pg, pg.js("KF.at(0)"), f'{name}: the hardest climb', touch)
        r = pg.js("({ tab: polku.planner.tab, open: polku.planner.sec.climbs.el.dataset.open, sel: polku.planner.selected && polku.planner.selected.gain })")
        if r != {'tab': 'check', 'open': 'true', 'sel': 21}:
            fails.append(f"{name}: a tap on the hardest climb: {r}")
        # what stands out: a headwind adding 25 min (or a tenth of the time), rain before it; Check's top keeps them
        r = pg.js("KF.set({ add: 25 })")
        if r['line'] != ['Headwind adds 25 min'] or 'Headwind: +25 min' not in r['strip'] or 'Hardest climb: ↑S2' not in r['strip']:
            fails.append(f"{name}: a headwind adding 25 min: {r}")
        pg.js(SETTLED)
        press(pg, pg.js("KF.at(0)"), f'{name}: the headwind', touch)
        r = pg.js("({ tab: polku.planner.tab, open: polku.planner.sec.depart.el.dataset.open })")
        if r != {'tab': 'go', 'open': 'true'}:
            fails.append(f"{name}: a tap on the headwind: {r}")
        r = pg.js("KF.set({ add: 4, time: 1800 })")
        if r['line'] != ['Headwind adds 4 min']:
            fails.append(f"{name}: a headwind adding a tenth of the time: {r['line']}")
        r = pg.js("KF.set({ add: 25, rain: 1 })")
        if len(r['line']) != 1 or not r['line'][0].startswith('Rain on ') or not any(s.startswith('Rain: ') for s in r['strip']):
            fails.append(f"{name}: rain on the way: {r}")
        # the weather not known: said beside the usual fact, and at Check's top
        r = pg.js("KF.set({ failed: true })")
        if r['line'] != ['Hardest climb ↑S2, 21 m at 12 %', 'Weather: couldn’t be loaded'] or 'Weather: ?' not in r['strip']:
            fails.append(f"{name}: no weather: {r}")
        # a road bike on gravel: unpaved stands out, and opens On the route in Surface's colours; height × gradient
        r = pg.js("KF.set({ sport: 'road', surf: 'gravel' })")
        if len(r['line']) != 1 or not r['line'][0].startswith('Unpaved ') or not r['line'][0].endswith(', 100 % of the way'):
            fails.append(f"{name}: a road bike on gravel: {r}")
        pg.js(SETTLED)
        press(pg, pg.js("KF.at(0)"), f'{name}: unpaved', touch)
        r = pg.js("({ tab: polku.planner.tab, open: polku.planner.sec.colours.el.dataset.open, mode: polku.planner.colorMode, climbs: document.querySelector('.climbs-hardest')?.textContent })")
        if r != {'tab': 'check', 'open': 'true', 'mode': 'surface', 'climbs': 'Hardest: 60 m at 5 %'}:
            fails.append(f"{name}: a tap on unpaved: {r}")
        # paddling: the wind always stands out; not known, said so
        r = pg.js("KF.set({ sport: 'paddle', head: 3 })")
        if r['line'] != ['Wind up to 5 m/s, gusts 7 · headwind 100 %']:
            fails.append(f"{name}: paddling: {r['line']}")
        r = pg.js("KF.set({ sport: 'paddle', failed: true })")
        if r['line'] != ['Wind: couldn’t be loaded']:
            fails.append(f"{name}: paddling without the forecast: {r['line']}")
        # on foot: the high point
        r = pg.js("KF.set({ sport: 'hike' })")
        if len(r['line']) != 1 or not r['line'][0].startswith('High point '):
            fails.append(f"{name}: on foot: {r['line']}")
        if phone:
            # two nights' days: the hardest day, a tap lighting its part of the list
            r = pg.js("""(async () => { const p = polku.planner; p.setStop(1, { on: 480 });
              for (let k = 0; k < 40 && !(p.analysis && p.analysis.waits && p.analysis.waits.length === 1); k++) await new Promise((r) => setTimeout(r, 200));
              const a = p.analysis; a.timeWind = null; a.wind = null; a.windError = false; p.renderAnalysis(); return KF.read(); })()""")
            if len(r['line']) != 1 or not r['line'][0].startswith('Day ') or ' is the hardest: ' not in r['line'][0] or not any(s.startswith('Hardest day: Day ') for s in r['strip']):
                fails.append(f"{name}: two days: {r}")
            pg.js(SETTLED)
            press(pg, pg.js("KF.at(0)"), f'{name}: the hardest day', touch)
            pg.js(SETTLED)
            r = pg.js("""(() => { const p = polku.planner, lit = [...document.querySelectorAll('.wpl .sec2.lit')], b = p.els.body.getBoundingClientRect(), r = lit[0] && lit[0].getBoundingClientRect();
              return { tab: p.tab, lit: lit.map((x) => x.querySelector('.sec2-head b').textContent.split(' · ')[0]), seen: !!r && r.top < b.bottom - 20 && r.bottom > b.top + 20 }; })()""")
            want = 'Day ' + pg.js("KF.read().line[0]").split(' ')[1]
            if r['tab'] != 'route' or r['lit'] != [want] or not r['seen']:
                fails.append(f"{name}: a tap on the hardest day: {r}, not {want}")
            # two sports: a row each, its distance and its own fact; a tap lights the paddle's part, its weather open
            r = pg.js("""(async () => { const p = polku.planner; p.setStop(1, null); p.setLegSport(2, 'paddle');
              for (let k = 0; k < 60 && !(p.analysis && p.analysis.attr.some((x) => x && x.sport === 'paddle') && p.analysis.wind); k++) await new Promise((r) => setTimeout(r, 200));
              return KF.read(); })()""")
            if len(r['line']) != 2 or not r['line'][0].startswith('MTB ') or ' · ↑' not in r['line'][0] or not r['line'][1].startswith('Paddle ') or ' · wind up to ' not in r['line'][1]:
                fails.append(f"{name}: MTB and paddling: {r}")
            else:
                pg.js(SETTLED)
                press(pg, pg.js("KF.at(1)"), f'{name}: Paddle', touch)
                pg.js(SETTLED)
                r = pg.js("""(() => { const p = polku.planner, lit = [...document.querySelectorAll('.wpl .sec2.lit')];
                  return { tab: p.tab, lit: lit.map((x) => x.querySelector('.sec2-head b').textContent.split(' · ')[0]), wx: !!lit[0]?.querySelector('.sec2-wx-at') }; })()""")
                if r != {'tab': 'route', 'lit': ['Paddle'], 'wx': True}:
                    fails.append(f"{name}: a tap on Paddle: {r}")
        fails.extend(f'{name}: console: {e[:160]}' for e in pg.errors())
        pg.close()

    one(390, 844, True)
    one(1440, 900, False)
    print(f"{'ok  ' if not fails else 'FAIL'} key facts and the hardest climb" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# The planner's tabs, C (25d, #424 [tabs-c-route, tabs-c-how, tabs-c-speed, tabs-c-check, tabs-c-go, tabs-c-layers]): Route
# opens with How you go › and Your speed ›, each a step of its own with Back to Route; Check's top keeps the facts, without
# Speed and Style; Go opens with Leave, There at, where the time goes, then Your speed ›; the map's marks are a Your route
# group in Layers while a route is drawn (straight legs)
TB_JS = """(() => { const vis = (e) => !!e && e.getClientRects().length > 0; window.TB = {
  pane: () => document.getElementById('pl-pane-route'),
  route() {
    const pane = TB.pane(), first = [...pane.children].find(vis), rows = first ? [...first.querySelectorAll(':scope > .row')] : [];
    return { first: rows.map((r) => `${r.querySelector('b').textContent} · ${r.querySelector('.val')?.textContent || ''}`), list: vis(pane.querySelector('[data-sec=points]')), step: pane.dataset.step || '' };
  },
  step() {
    const pane = TB.pane(), back = pane.querySelector('.step-head .way-back');
    return { step: pane.dataset.step || '', back: vis(back) ? back.textContent.trim() : '', title: pane.querySelector('.step-head h3')?.textContent || '', list: vis(pane.querySelector('[data-sec=points]')),
      presets: vis(pane.querySelector('.style-box .style-presets, .style-box .chip')), speeds: vis(pane.querySelector('.speed-box')) && pane.querySelector('.speed-box').children.length > 0, sectionHead: vis(pane.querySelector('[data-sec=style] > .sec-head')) };
  },
  at(el) { if (!el) return null; el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(); return { x: r.left + Math.min(60, r.width / 3), y: r.top + r.height / 2 }; },
  row: (pane, label) => [...document.querySelectorAll(`#pl-pane-${pane} .row`)].find((r) => vis(r) && r.querySelector('b')?.textContent === label),
}; return true; })()"""


def tabs(chrome):
    fails = []

    def press(pg, at, name, touch):
        if not at:
            fails.append(f'{name}: not on screen')
            return False
        if touch:
            pg.quick_tap(at['x'], at['y'])
        else:
            for kind in ('mouseMoved', 'mousePressed', 'mouseReleased'):
                pg.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': at['x'], 'y': at['y'], 'button': 'none' if kind == 'mouseMoved' else 'left',
                                                      'buttons': 1 if kind == 'mousePressed' else 0, 'clickCount': 1}, pg.s)
        time.sleep(0.6)
        return True

    # (the sheet's body scrolled to it, as a person scrolls; never the page)
    at = lambda pg, expr: (pg.js(SETTLED), pg.js(f"""(async () => {{ const el = {expr}; if (!el) return null; const b = polku.planner.els.body, r = el.getBoundingClientRect(), s = b.getBoundingClientRect();
      if (r.bottom > s.bottom) b.scrollTop += r.bottom - s.bottom + 8; else if (r.top < s.top) b.scrollTop -= s.top - r.top + 8;
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))); const q = el.getBoundingClientRect(); return {{ x: q.left + Math.min(60, q.width / 3), y: q.top + q.height / 2 }}; }})()"""))[1]

    def one(w, h_, phone):
        name, touch = f'{w}x{h_}', phone
        pg = chrome.page(w, h_, phone)
        pg.open_app({'activity': 'mtb'}, {'polku:winter': '"off"', 'polku:plannerDock': '"left"'}, '#13/61.514/23.822')
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        if not pg.js(PC_ROUTE, timeout=30000):
            fails.append(f'{name}: no route')
            pg.close()
            return
        pg.js(TB_JS)
        pg.js("polku.planner.setTab('route'); polku.planner.setSheetState(polku.planner.layout() === 'side' ? 'open' : 'full'); true")
        r = pg.js("TB.route()")
        if r['first'] != ['How you go · Balanced', 'Your speed · Normal'] or not r['list'] or r['step']:
            fails.append(f"{name}: Route opens with {r}")
            pg.close()
            return
        # How you go ›: the route style alone, with Back to Route; a preset there changes the row's value
        press(pg, at(pg, "TB.row('route', 'How you go')"), f'{name}: How you go', touch)
        s = pg.js("TB.step()")
        if s != {'step': 'how', 'back': 'Route', 'title': 'How you go', 'list': False, 'presets': True, 'speeds': False, 'sectionHead': False}:
            fails.append(f"{name}: How you go's step: {s}")
        press(pg, at(pg, "[...document.querySelectorAll('#pl-pane-route .style-box .chip')].find((c) => c.getAttribute('aria-pressed') !== 'true')"), f'{name}: another style', touch)
        style = pg.js("polku.planner.styleOf('mtb').p")
        press(pg, at(pg, "document.querySelector('#pl-pane-route .step-head .way-back')"), f'{name}: Back', touch)
        r = pg.js("TB.route()")
        if r['step'] or not r['list'] or style == 'balanced' or r['first'][0] == 'How you go · Balanced':
            fails.append(f"{name}: Back from How you go after a style ({style}): {r}")
        # Your speed ›: the speeds alone
        press(pg, at(pg, "TB.row('route', 'Your speed')"), f'{name}: Your speed', touch)
        s = pg.js("TB.step()")
        if s != {'step': 'speed', 'back': 'Route', 'title': 'Your speed', 'list': False, 'presets': False, 'speeds': True, 'sectionHead': False}:
            fails.append(f"{name}: Your speed's step: {s}")
        pg.js("polku.planner.openStep(null); true")
        # Check's top: the facts, without Speed and Style
        r = pg.js("(() => { const p = polku.planner; p.setTab('check'); return [...p.els.stats.querySelectorAll('.stat-label')].map((x) => x.textContent); })()")
        if 'Speed' in r or 'Style' in r or not r:
            fails.append(f"{name}: Check's top: {r}")
        # Go: Leave, There at, where the time goes, then Your speed ›, which opens its step in Route
        r = pg.js("""(() => { const p = polku.planner; p.setTab('go'); p.toggleSection('speed', true); const b = p.sec.speed.el.querySelector('.sec-body');
          const order = [...b.querySelectorAll('.pick-leave, .time-head, .speed-table, .row')].filter((e) => e.getClientRects().length).map((e) => e.matches('.pick-leave') ? 'Leave' : e.matches('.time-head') ? e.querySelector('b').textContent.split(' at ')[0] + ' at' : e.matches('.speed-table') ? 'table' : e.querySelector('b')?.textContent);
          return order.filter((x, i) => order.indexOf(x) === i); })()""")
        if r[:4] != ['Leave', 'There at', 'table', 'Your speed']:
            fails.append(f"{name}: Go's Time: {r}")
        press(pg, at(pg, "TB.row('go', 'Your speed')"), f"{name}: Go's Your speed", touch)
        r = pg.js("({ tab: polku.planner.tab, step: TB.pane().dataset.step || '' })")
        if r != {'tab': 'route', 'step': 'speed'}:
            fails.append(f"{name}: Go's Your speed opened {r}")
        pg.js("polku.planner.openStep(null); true")
        # a multisport route: How you go has a row for each sport, and Paddle's styles the paddle legs, not the MTB ones
        pg.js("polku.planner.setTab('route'); polku.planner.setSportFrom(2, 'paddle'); true")
        time.sleep(0.6)
        r = pg.js("TB.route()")['first']
        if [x.split(' · ')[0] for x in r] != ['How you go', 'How you go', 'Your speed']:
            fails.append(f"{name}: Route's rows on a multisport route: {r}")
        else:
            press(pg, at(pg, "TB.pane().querySelectorAll('.how-rows > .row')[1]"), f"{name}: Paddle's How you go", touch)
            line = pg.js("TB.pane().querySelector('.step-head p').textContent")
            if pg.js("TB.step()")['step'] != 'how' or not line.startswith('Paddle, for the route’s Paddle legs'):
                fails.append(f"{name}: Paddle's How you go says {line!r}")
            was = pg.js("({ mtb: polku.planner.styleOf('mtb').p, paddle: polku.planner.styleOf('paddle').p })")
            press(pg, at(pg, "[...document.querySelectorAll('#pl-pane-route .style-box .chip')].find((c) => c.getAttribute('aria-pressed') !== 'true')"), f'{name}: another Paddle style', touch)
            now = pg.js("({ mtb: polku.planner.styleOf('mtb').p, paddle: polku.planner.styleOf('paddle').p })")
            if now['mtb'] != was['mtb'] or now['paddle'] == was['paddle']:
                fails.append(f"{name}: a style in Paddle's How you go: {was} → {now}")
            pg.js("polku.planner.openStep(null); true")
        # the marks on the map: in Layers, a Your route group while a route is drawn; none in Check
        r = pg.js("""(async () => { const p = polku.planner, vis = (e) => !!e && e.getClientRects().length > 0; p.setTab('check');
          const inCheck = vis(document.querySelector('#pl-pane-check [data-sec=onmap]')) || vis(document.querySelector('#pl-pane-check .onmap'));
          if (document.querySelector('#layers-panel').hidden) { document.querySelector('#btn-layers').click(); document.querySelector('#quick-layers .qt-more').click(); }
          await new Promise((ok) => setTimeout(ok, 500));
          const g = [...document.querySelectorAll('#layers-body .lg-group')].find((x) => x.querySelector('.lg-title')?.textContent === 'Your route');
          const sw = g ? [...g.querySelectorAll('.tg')].map((t) => t.querySelector('.tg-text').firstChild.textContent.trim()) : [];
          const km = g && g.querySelector('input'); if (km) km.click();
          const off = p.marks.km;
          if (km) g.querySelector('input').click(); // (drawn again by the first: found afresh)
          return { inCheck, sw, toggled: off === false && p.marks.km === true }; })()""")
        if r['inCheck'] or r['sw'][:3] != ['Distance marks', 'Arrival times at marks', 'Elapsed time at marks'] or not r['toggled']:
            fails.append(f"{name}: the marks in Layers: {r}")
        r = pg.js("""(async () => { const p = polku.planner; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await new Promise((ok) => setTimeout(ok, 300));
          p.clear(); await new Promise((ok) => setTimeout(ok, 300));
          if (document.querySelector('#layers-panel').hidden) { document.querySelector('#btn-layers').click(); document.querySelector('#quick-layers .qt-more').click(); }
          await new Promise((ok) => setTimeout(ok, 500));
          return [...document.querySelectorAll('#layers-body .lg-group')].some((x) => x.querySelector('.lg-title')?.textContent === 'Your route'); })()""")
        if r:
            fails.append(f"{name}: Your route in Layers with no route")
        fails.extend(f'{name}: console: {e[:160]}' for e in pg.errors())
        pg.close()

    one(390, 844, True)
    one(1440, 900, False)
    print(f"{'ok  ' if not fails else 'FAIL'} the planner's tabs, C" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# Past the forecast (25d, #465 [tabs-c-days, tabs-c-days-go, tabs-c-days-check, tabs-c-far-check]): where Open-Meteo's
# hours run out, the time leaves the wind out, the profile goes grey in the weather's colours with No forecast yet at the
# cut, Check's Not checked says from where, the wind-, rain- and cold-based checks look only at the forecast's part, a
# section past it says so, and the water router asks the 10-day forecast and judges no rough water past it (Open-Meteo
# answered in the page with four hours, at a place no other check asks about; set values on a straight route)
PF_JS = """(async () => {
  const errs = [], p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const W = await import(location.origin + '/js/weather.js'), C = await import(location.origin + '/js/chart.js'), D = await import(location.origin + '/js/waterdata.js');
  // Open-Meteo, answered: four hours from the last whole hour, the wind 8 m/s from the east; the hours asked for kept
  const real = window.fetch, asked = [], H = 4, t0 = Math.floor(Date.now() / 3600000) * 3600 - 3600;
  window.fetch = (input, init) => {
    const u = String(input && input.url ? input.url : input);
    if (!/open-meteo\\.com/.test(u)) return real(input, init);
    const q = new URL(u).searchParams, lat = q.get('latitude').split(','), lon = q.get('longitude').split(','), fill = (v) => Array(H).fill(v);
    asked.push(+q.get('forecast_hours'));
    const hourly = { time: Array.from({ length: H }, (_, k) => t0 + k * 3600), wind_speed_10m: fill(8), wind_direction_10m: fill(90), wind_gusts_10m: fill(12), temperature_2m: fill(5), precipitation: fill(2), cloud_cover: fill(50), snow_depth: fill(0), snowfall: fill(0) };
    return Promise.resolve(new Response(JSON.stringify(lat.map((la, i) => ({ latitude: +la, longitude: +lon[i], hourly }))), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  };
  const place = [27.70, 64.20], keys = [];
  try {
    // windAlong: ten hours east along, the forecast four: past its last hour, no wind in the time
    const pts = Array.from({ length: 11 }, (_, i) => [place[0] + i * 0.01, place[1]]), along = pts.map((_, i) => i * 500), tAt = pts.map((_, i) => i * 3600);
    const w = await W.windAlong(pts, along, tAt, Date.now() / 1000);
    if (!(w.beyond > 0 && w.beyond < 6) || w.head.slice(w.beyond).some((x) => x !== 0) || !(w.head[0] > 7)) errs.push(`windAlong past its last hour: beyond ${w.beyond}, head ${Array.from(w.head).map((x) => x.toFixed(0)).join(' ')}`);
    // the water router's wind: the next hour's, and none (not missing) five days ahead, asked of the 10-day forecast
    const box = [place[0], place[1], place[0] + 0.01, place[1] + 0.01];
    const soon = await D.waterInputs(box, { wind: true }, Date.now() / 1000 + 1800), far = await D.waterInputs(box, { wind: true }, Date.now() / 1000 + 5 * 86400);
    if (!soon.wind || soon.wind.speed !== 8 || far.wind || far.missing.length || !asked.includes(240)) errs.push(`the water router's wind: soon ${JSON.stringify(soon.wind)}, five days ahead ${JSON.stringify(far.wind)}, missing ${JSON.stringify(far.missing)}, asked for ${asked.join(', ')} hours`);
    for (const c of [...pts.map((q) => W.cellAt(q, 0)), W.cellAt([place[0] + 0.005, place[1] + 0.005], 0)]) for (const x of ['p', 'q']) keys.push(`${x}/${c.i}/${c.j}`);
  } finally {
    window.fetch = real;
    // (what was answered here is forgotten, so no other check meets it)
    await new Promise((ok) => { const r = indexedDB.open('polku'); r.onerror = () => ok(); r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('weather')) { db.close(); ok(); return; } const t = db.transaction('weather', 'readwrite'); for (const k of new Set(keys)) t.objectStore('weather').delete(k); t.oncomplete = t.onerror = () => { db.close(); ok(); }; }; });
  }
  // the planner: a forecast that ends at a third of the route
  const a = p.analysis, n = a.along.length, k = Math.round(n / 3), fill = (v) => new Float32Array(n).fill(v);
  p.app.winter = () => ({ on: false, setting: 'auto' });
  const set = (temp) => {
    a.wind = { ...(a.wind || {}), start: { speed: 5, gust: 7, dir: 90, temp: 5, precip: 0 }, startSec: p.startSec(), head: fill(3), speed: fill(8), gust: fill(12), dir: fill(90), cross: fill(0), temp, precip: fill(0), beyond: k, beyondSec: p.startSec() + 3 * 3600, unsure: -1 };
    a.windError = false; p.renderAnalysis();
  };
  const cold = (from, to) => Float32Array.from({ length: n }, (_, i) => (i >= from && i < to ? -30 : 5));
  set(cold(k + 1, n));
  const grey = [C.colorAt(a, k - 1, 'wind'), C.colorAt(a, k, 'wind'), C.colorAt(a, n - 1, 'temp'), C.colorAt(a, n - 1, 'rain')];
  if (grey[0] === C.NO_FORECAST || grey.slice(1).some((c) => c !== C.NO_FORECAST)) errs.push(`the weather's colours at the cut: ${grey.join(' ')}`);
  const km = (a.along[k] / 1000).toFixed(1), not = p.headsUp().not.find((x) => x.key === 'beyond'), all = [...p.headsUp().read, ...p.headsUp().look].map((x) => x.text);
  if (!not || not.text !== `No forecast yet from km ${km}, ${p.clockOf(a.wind.beyondSec)}` || not.note !== 'Wind, rain and waves aren’t checked from there.') errs.push(`Not checked: ${JSON.stringify(not)}`);
  if (all.some((t) => /cold|Frostbite/.test(t))) errs.push(`cold past the forecast is a warning: ${all.join(' / ')}`);
  set(cold(1, k));
  if (!p.headsUp().read.some((x) => /Frostbite|Very cold/.test(x.text))) errs.push('cold within the forecast is no warning');
  p.setSheetState('profile'); await wait(500); // (the profile in sight, as a person raises it)
  p.showMode('wind'); await wait(300);
  const tag = document.querySelector('.pl-profile .nofc');
  if (!tag || !tag.getClientRects().length || tag.textContent !== 'No forecast yet') errs.push(`the profile's cut: ${tag ? tag.textContent : 'none'}`);
  p.showMode('grade');
  p.reveal('points'); await wait(300);
  const chip = document.querySelector('.wpl .sec2-wx');
  if (!chip || !/^No forecast yet$/.test(chip.textContent.trim())) errs.push(`the section's weather past the forecast: ${chip ? chip.textContent : 'none'}`);
  // paddling: its wind as far as it reaches, and from where it isn't known
  a.activity = 'paddle'; p.mainSport = () => 'paddle'; a.attr.forEach((x) => { if (x) delete x.sport; }); set(fill(5));
  const line = p.els.facts ? [...p.els.facts.querySelectorAll('.kf-b')].map((b) => b.textContent.trim()) : [];
  if (line.length !== 1 || !line[0].startsWith('Wind up to 8 m/s, gusts 12 · headwind ') || !line[0].endsWith(` · no forecast yet from km ${km}`)) errs.push(`paddling's key fact: ${line.join(' / ')}`);
  // nothing shows the repeated last hour as known (the review of #475): past the cut 20 m/s, −3 °C and snow, within it calm
  const after = (v, w) => Float32Array.from({ length: n }, (_, i) => (i >= k ? v : w));
  Object.assign(a.wind, { speed: after(20, 5), gust: after(26, 7), temp: after(-3, 5), precip: after(2, 0), dir: after(270, 90), head: after(0, 3) });
  p.renderAnalysis();
  const C2 = await import(location.origin + '/js/facts.js');
  const card = C2.headline(a, n - 2, 'paddle', {}).filter((x) => x.key !== 'clock').map((x) => `${x.value} ${x.label}${x.missing ? ' (missing)' : ''}`);
  if (card.some((t) => /20 m\/s|−3|-3/.test(t)) || card.some((t) => !/missing/.test(t))) errs.push(`the route's card past the forecast: ${card.join(' / ')}`);
  const tip = C.routeReadout ? C.routeReadout(a, n - 2) : null, tipText = tip ? [tip.title, ...tip.lines].join(' ') : '';
  if (!tip || /20 m\/s|−3|-3 °C|snow|Crosswind|Calm/.test(tipText) || !/No forecast yet/.test(tipText)) errs.push(`the route's tip past the forecast: ${tipText}`);
  const head = [...p.els.stats.querySelectorAll('.stat')].map((x) => x.textContent);
  if (head.some((t) => /20 m\/s|gusts 26/.test(t)) || !head.some((t) => /^Headwind100 %/.test(t))) errs.push(`the paddle's header past the forecast: ${head.join(' / ')}`);
  p.showMode('wind');
  const arrows = polku.map.getSource('routeWind')?.serialize().data.features || [];
  const at = (c) => a.pts.findIndex((q) => Math.abs(q[0] - c[0]) < 1e-9 && Math.abs(q[1] - c[1]) < 1e-9), past = arrows.filter((f) => at(f.geometry.coordinates) >= k).length;
  if (!arrows.length || past) errs.push(`the map's wind arrows: ${arrows.length}, past the cut ${past}`);
  p.chart.setHover && p.chart.setHover(n - 2, true);
  const ptip = document.getElementById('profile-tip');
  if (ptip && !ptip.hidden && (/20\.0 m\/s|−3|-3 °C/.test(ptip.textContent) || !/No forecast yet/.test(ptip.textContent))) errs.push(`the profile's tip past the forecast: ${ptip.textContent}`);
  p.showMode('grade');
  // a start past the forecast: none anywhere, said once for the trip
  a.wind.beyond = 0; p.renderAnalysis();
  const far = p.headsUp().not.find((x) => x.key === 'beyond');
  if (!far || far.text !== 'No forecast yet for this trip' || C.colorAt(a, 1, 'wind') !== C.NO_FORECAST) errs.push(`a start past the forecast: ${JSON.stringify(far)}`);
  return errs;
})()"""


def pastforecast(chrome):
    pg = chrome.page(390, 844, True)
    pg.open_app({'activity': 'mtb'}, {'polku:plannerDock': '"left"'}, '#13/61.514/23.822')
    pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
    fails = [] if pg.js(PC_ROUTE, timeout=30000) else ['no route']
    if not fails:
        pg.js("(async () => { const p = polku.planner; for (let k = 0; k < 150 && !(p.analysis.wind || p.analysis.windError); k++) await new Promise((r) => setTimeout(r, 100)); return true; })()")
        fails = pg.js(PF_JS, timeout=60000)
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} past the forecast" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


GROUPS = [
    ('radar', [radar], 'fixed FMI rain-rate units, palette order, dry/no-data and reflectivity fallback (recorded/mocked)'),
    ('weather', [weather_requests, timeline_reading], 'forecast requests: cold zoom-out waits, cached and pending cells do not consume the budget (#298); the timeline\'s reading on phones whole in its box (#243)'),
    ('changelog', [changelog], 'release notes, retry, safe rendering, keyboard, route preservation and real worker offline'),
    ('pacing', [pacing], 'calls made together go out paced and counted (mocked services, a fake clock)'),
    ('layers', [layers], 'the Layers panel in every sport'),
    ('trails', [trails, uphill_late], 'the trail details (from a recorded tile), a trail\'s card on phones, whole and clear of the map\'s buttons at 200 % (#435), and the uphill colours when the terrain comes late (mocked)'),
    ('header', [header_fit], 'the planner header fitting its sheet'),
    ('lipas', [lipas], 'LIPAS search and riding a LIPAS route (recorded answers)'),
    ('marked', [marked], 'marked routes picked on the map (#308): a hand and the whole route lit under a mouse before a click, a tap 10 px beside the line lit while its card is open and one 30 px away not (recorded LIPAS, cut in two parts)'),
    ('water', [water, water_late], 'the paddling router\'s costs (recorded fairways, a fixed wind), and OSM\'s rocks coming late (mocked)'),
    ('multi', [multi], 'multisport: a sport per leg, changeovers, share links (straight legs)'),
    ('editing', [editing], 'midpoint handle and line drags: one via point, Undo/Redo, mouse and touch in four sports'),
    ('routemenu', [route_menu, quick_taps], 'clicks and taps on the route (straight legs), LIPAS over trails, and quick taps on a busy page (#293)'),
    ('backtostart', [back_to_start], 'Back to start buttons, closing leg and undo (straight legs)'),
    ('routebits', [route_bits], 'snapping, the sport strip, distance marks, the sun (no routing)'),
    ('terrain', [terrain], 'terrain tiles that don\'t load, load in part, then come back (mocked tiles, straight legs)'),
    ('stops', [stops], 'stops and nights: breaks, nights, days, the gear check, share links (straight legs)'),
    ('avoid', [avoid_link], 'places to avoid in share links: shared, opened in a clean page, routed around (mocked BRouter)'),
    ('access', [access], 'ways marked private or closed in Heads-up, from BRouter\'s tags and, when Valhalla stands in, the map\'s (mocked)'),
    ('heads', [heads], 'Check in three groups (25d part 2): every Heads-up item\'s group and source, set where it\'s made (each maker fed its smallest input, no network); Not checked with Retry; the groups, What Polku looked at and the badge'),
    ('warnfix', [warnfix], 'the review of #416: the row, read marks across routes and answers, a card through a new analysis, markers clear of points and presses, Retry, 360 × 740, 200 %, Escape, and the triangle\'s card at 200 % with the planner put away, clear of the map\'s buttons (#435)'),
    ('onroute', [onroute], 'the warning on the route (25d part 3): the item\'s card from Check, ‹ › along the route, Back, Retry, a tap on the map (mocked sources, straight legs)'),
    ('detour', [detour], 'a route that goes round a way marked private: Heads-up, the short cut, the moved points (mocked BRouter and tiles)'),
    ('shortcut', [shortcut], 'Short cuts ok: Polku\'s profile, Short cut from Heads-up, Undo, share links, a failed upload (mocked BRouter and tiles)'),
    ('otherways', [otherways], 'other ways for a new leg: one after a pause and a second later, none while adding points or on a short leg, the way before as a ghost, links, Undo, a point taken back at once (#351) (mocked BRouter)'),
    ('flow', [flow], 'the route\'s glow and moving chevrons: they move, survive a style change, stop with reduced motion, the switch off or left alone'),
    ('loops', [loops], 'round trips on the water, More loops (recorded fairways, a fixed wind)'),
    ('fit', [fit_phone], 'phones: the route framed above the sheet at every size, an import\'s card clear of the track\'s end (#131), loops tapped on the map (mocked BRouter)'),
    ('winter', [winter], 'winter on the map: Auto / On / Off, winter ways (a recorded tile), FMI snow, ski tracks'),
    ('sports', [sport_switch], 'changing the sport with a route drawn (B of #233): the route keeps its sports and style (#71), the pill asks, The whole route and its Undo, land to water'),
    ('winterroute', [winter_route], 'winter on the route: snow in the time, winter Heads-up (a made-up forecast)'),
    ('sweep', [sweep], 'the bug sweep: Heads-up without the trail layer, Hide and OSM links, the route menu, the route\'s sport'),
    ('marks', [marks], 'distance, arrival/elapsed times, default and saved settings, the departure link'),
    ('colours', [colours], 'every available route breakdown, choosing colours, folds and late data'),
    ('previews', [previews], 'bar/legend hover highlights, keyboard previews and cleanup'),
    ('drawer', [drawer], 'the drawer in three tabs (22a): every part in its place, the start, the lit leg'),
    ('quick', [quick], 'the quick layer drawer (#123): tiles in every sport, steps, Edit, More, status; the one swipe on it and the planner (touch)'),
    ('heading', [heading], 'where you are (23a): the cone, follow me, a pan, facing ahead, a hidden page (a GPS and a compass of its own)'),
    ('contrast', [contrast], 'white on the green accent in dark and light: the sport pill, pressed Settings and Weather, Make 3 loops, switches (#239)'),
    ('values', [design_colours, palette_css, contrast_sweep], 'the design system\'s values (#382): DESIGN.md\'s colours are css/app.css\'s in both themes, the route\'s colours and the colour scales come from the CSS and again when the theme changes, and text at 4.5:1 in a set of scenes, light and dark (#370)'),
    ('controls', [controls], 'the design system\'s controls (#382): one look per job (#356), one focus ring, in the menus too (#385), labels that wrap (#373), a point\'s card at 200 % (#384), the top bar and its search at 200 % (#375), words at 4.5:1 (#376), Plan in green, a press that answers'),
    ('panels', [panels, panels_desktop], 'phones: Settings and all layers over the planner at every size, on screen, scrolling and closing by touch (#240); desktops, the planner at the bottom, by mouse and keys (#257)'),
    ('column', [column_early, timeline_height], 'phones: the map\'s column in its place from its first frame, the timeline on and the map\'s load held back (#292); the timeline\'s height when its forecast comes in (#301)'),
    ('tilefail', [tile_fails], 'Paddle with the depth tiles failing last (a server error, a dropped connection): the saved route, the planner left open and a share link\'s route still open, Depths says No data now (#393)'),
    ('sportmenu', [sport_menu], 'the sport pill\'s menu: a mouse click after its hover keeps it open, a second click, Escape and a click outside close it, touch and the keyboard (#245), and a late snow answer leaves it open (#392)'),
    ('toolbox', [toolbox], 'the planner\'s toolbox and header (25a): phones and desktops, the mode\'s menu, More, the keys, tooltips; #241, #242, #251, #356, #387'),
    ('start', [start], 'the start (A with 25b), at four sizes: the ways to begin and their sport, Draw it and its style, Round trip and Where I am, Marked routes and their states, four points in four taps, loops made and picked on the map (mocked LIPAS and BRouter; #232, #109, #89, #281, #306)'),
    ('routeview', [route_view], 'Done and the route\'s view (25c): a tap on the map shows what\'s there, on the line its menu, the markers stay put, Edit with undo, ✕ and its note, Plan, R, E, a share link and a reload as it was left (#238), a long name at 360 px and 200 %'),
    ('nextleg', [nextleg], 'the next leg (B of #233): its sport and speed in the drawing menu (touch) and on the toolbar (mouse), the drawing button, Draw it, Go › Time, a point on open water (not a bridge or the shore; the ice in winter), the craft in the start\'s sport menu, Settings\' speeds by sport (#87)'),
    ('button3d', [button3d], 'the 3D button in the map\'s column on desktops (#226): mouse, keyboard, reload, Layers\' switch in step, the quick drawer\'s tiles per sport'),
    ('button3dphone', [button3d_phones], 'the 3D button on phones (#226): touch, the column at every sheet size, none at 200 %'),
    ('pointcard', [point_card], 'a point\'s card (25d): a tap opens it in the peek or at the point, its numbers, Make it a stop, Stay the night, Change sport from here, Move by a tap, Rename, Remove and Undo, Back and the back gesture, the route\'s view, 200 % and Finnish (straight legs)'),
    ('routecard', [route_card], 'the route\'s card and a stretch\'s (25d 1b): a tap on the route, Add a point here at the spot, This stretch, What\'s here, Edit this stretch, On the profile, Avoid this spot, the whole route, the start\'s Back to start, End not Finish (straight legs, mocked BRouter)'),
    ('spotcard', [spot_card, spot_card_foot], 'hold the map to see what\'s there (25d part 5): a finger held 0.5 s or a right-click, the ring, a tap, a move and two fingers, a busy page (#293), the spot\'s and a place\'s cards, Add to my route where it fits or on the line, Start here and End here, the line\'s hold and right-click, the route\'s view, the planner put away (straight legs, mocked BRouter)'),
    ('crosshair', [crosshair], 'the keyboard\'s crosshair (25d part 5b): Tab to the map, the keys listed, Enter as a tap (a point, the route\'s card), Shift+F10 and the menu key as a hold, Escape and the focus, the crosshair gone with the focus, never by touch (straight legs)'),
    ('facts', [facts], 'What\'s here in levels and Not right? (25d part 6a): a way\'s facts for your sport first and a missing one said so, All OpenStreetMap details once a card (a failure, a late answer), Copy, Not right?, a place\'s facts, a path\'s card with the planner put away, a ship\'s own card (a recorded tile, mocked Overpass)'),
    ('sharespot', [share_spot], 'Share a spot and Weather here (25d part 6b): the share sheet and the copied link, the link\'s pin and card with a route as it was, a bad pin, an old route link, the timeline held at the spot and released, no request with the spot'),
    ('sections', [sections_list], 'Route\'s list in sections, and Reorder (25d part 4): a section where the sport changes, at a stop and a night; stretches with their shaping points folded; cards and Back as it was; Reorder by touch and mouse; the list\'s keys; the route\'s view; 52 points; a warning shown once; 360 px in Finnish (straight legs, mocked BRouter)'),
    ('leave', [leave], 'when you leave (25d, #364\'s C): the Leave row on the start\'s card and in Go with the phone\'s own picker, Now, past the forecast, the timeline in step, share links, saved routes, a reload and a passed date, a stay of nights and Go on at, GPX\'s planned times (straight legs)'),
    ('keyfacts', [keyfacts], 'key facts (25d, #471\'s A2): the line under the route\'s numbers (what stands out, else the usual fact, the weather when it isn\'t known), a row a sport, the hardest day, taps, Check\'s top, and Climbs\' Hardest tag (straight legs, set values)'),
    ('tabs', [tabs], 'the planner\'s tabs, C (25d, #424): Route opens with How you go › and Your speed ›, each a step with Back; Check\'s top without Speed and Style; Go\'s Leave, There at, the time and Your speed ›; the map\'s marks in Layers (straight legs)'),
    ('pastforecast', [pastforecast], 'past the forecast (25d, #465): the time without the wind past its last hour, the profile grey with No forecast yet, Not checked from where, the cold and the rain checked only within it, a section past it, paddling\'s key fact, the water router\'s wind from the 10-day forecast and none past it (Open-Meteo answered in the page)'),
    ('fold', [fold], 'fold, then away (step 3 of #233): ⌄, the line and ✕, swipes and the handle\'s keys by touch at 390 × 844, a point\'s card folded, full and closed, the map\'s buttons moving once (#540); at 200 % resting at the line, the column clear of the top bar and the toolbox, the full sheet scrolling as one (#453, #344); desktops: the side panel and the bottom panel folded down, a card on the map folded keeping its bottom edge'),
    ('runner', [runner], 'the runner itself: a name it doesn\'t know, a group that raises or stops Chrome, a Chrome profile in use (#262, #263, #254)'),
]
SIZES = list(dict.fromkeys(f'{w}x{h}' for w, h, _, _ in VIEWPORTS))


def run(chrome, steps):
    """Runs (name, function, args) steps. A step that raises fails, and the rest still run,
    in a fresh Chrome when the browser stopped answering (#263). Returns (ok, chrome).
    With POLKU_TIMES set, each step's time follows it ("time <name> <s> s", for CI's summary)."""
    ok = True
    for name, fn, args in steps:
        t = time.time()
        try:
            ok = fn(chrome, *args) and ok
        except Exception as e:
            ok = False
            first = (str(e).strip().splitlines() or [''])[0]
            print(f'FAIL {name} raised {type(e).__name__}: {first}', flush=True)
            if not chrome.alive():
                print('     - Chrome stopped answering: the next checks run in a fresh one', flush=True)
                chrome.close()
                chrome = Chrome()
        if os.environ.get('POLKU_TIMES'):
            print(f'time {name} {time.time() - t:.0f} s', flush=True)
    return ok, chrome


def main():
    args = sys.argv[1:]
    if args == ['--list']:
        w = max(len(n) for n, _, _ in GROUPS)
        print('\n'.join(f'{n:<{w}}  {d}' for n, _, d in GROUPS))
        print(f"{'sizes':<{w}}  the layout at one size: {', '.join(SIZES)} (all of them with no arguments)")
        return
    known = [n for n, _, _ in GROUPS] + SIZES
    unknown = [a for a in args if a not in known]
    if unknown:
        print(f"No smoke group or size called {', '.join(unknown)}.\nGroups: {' '.join(n for n, _, _ in GROUPS)}\n"
              f"Sizes: {' '.join(SIZES)}\nEach group's line: python3 tools/smoke.py --list", file=sys.stderr)
        sys.exit(2)
    steps = [(n if len(fns) == 1 else f'{n} ({fn.__name__})', fn, ()) for n, fns, _ in GROUPS if not args or n in args for fn in fns]
    steps += [(f'{w}x{h}', check, (w, h, phone, bottom)) for w, h, phone, bottom in VIEWPORTS if not args or f'{w}x{h}' in args]
    chrome = Chrome()
    try:
        ok, chrome = run(chrome, steps)
    finally:
        chrome.close()
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
