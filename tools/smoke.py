#!/usr/bin/env python3
"""Smoke test for Polku's layout: no overlapping controls, no console errors, planner states work.

  python3 tools/smoke.py            # all viewports
  python3 tools/smoke.py 390x844    # just one size
  python3 tools/smoke.py layers     # just the Layers panel in every sport
  python3 tools/smoke.py trails     # just the trail details (from a recorded tile), and the uphill colours when the terrain comes late (mocked)
  python3 tools/smoke.py header     # just the planner header fitting its sheet
  python3 tools/smoke.py lipas      # just LIPAS search and riding a LIPAS route (recorded answers)
  python3 tools/smoke.py water      # just the paddling router's costs (recorded fairways, a fixed wind), and OSM's rocks coming late (mocked)
  python3 tools/smoke.py multi      # just multisport: a sport per leg, changeovers, share links (straight legs)
  python3 tools/smoke.py editing    # midpoint handle and line drags: one via point, Undo/Redo, mouse and touch in four sports
  python3 tools/smoke.py routemenu  # just clicks and taps on the route (straight legs), and LIPAS over trails
  python3 tools/smoke.py backtostart  # Back to start buttons, closing leg and undo (straight legs)
  python3 tools/smoke.py routebits  # snapping, the sport strip, distance marks, the sun (no routing)
  python3 tools/smoke.py terrain    # terrain tiles that don't load, load in part, then come back (mocked tiles, straight legs)
  python3 tools/smoke.py stops      # stops and nights: breaks, nights, days, the gear check, share links (straight legs)
  python3 tools/smoke.py avoid      # places to avoid in share links: shared, opened in a clean page, routed around (mocked BRouter)
  python3 tools/smoke.py access     # ways marked private or closed in Heads-up, from BRouter's tags and, when Valhalla stands in, the map's (mocked)
  python3 tools/smoke.py detour     # a route that goes round a way marked private: Heads-up, the short cut, the moved points (mocked BRouter and tiles)
  python3 tools/smoke.py shortcut   # Short cuts ok: Polku's profile, Short cut from Heads-up, Undo, share links, a failed upload (mocked BRouter and tiles)
  python3 tools/smoke.py flow       # the route's glow and moving chevrons: they move, survive a style change, stop with reduced motion, the switch off or left alone
  python3 tools/smoke.py otherways  # other ways for a new leg: one after a pause and a second later, none while adding points or on a short leg, the way before as a ghost, links, Undo (mocked BRouter)
  python3 tools/smoke.py loops      # round trips on the water, More loops (recorded fairways, a fixed wind)
  python3 tools/smoke.py fit        # phones: the route framed above the sheet at every size, loops tapped on the map (mocked BRouter)
  python3 tools/smoke.py sports     # changing the sport with a route drawn: the route keeps its sports, Route it as, Undo
  python3 tools/smoke.py winterroute  # winter on the route: snow in the time, winter Heads-up (a made-up forecast)
  python3 tools/smoke.py winter     # winter on the map: Auto / On / Off, winter ways (a recorded tile), FMI snow, ski tracks
  python3 tools/smoke.py marks      # distance, arrival/elapsed times, default and saved settings, the departure link
  python3 tools/smoke.py previews   # bar/legend hover highlights, keyboard previews and cleanup
  python3 tools/smoke.py colours    # every available route breakdown, choosing colours, folds and late data
  python3 tools/smoke.py drawer     # the drawer in three tabs (22a): every part in its place, the start, the lit leg
  python3 tools/smoke.py sweep      # the bug sweep: Heads-up without the trail layer, Hide and OSM links, the route menu, the route's sport
  python3 tools/smoke.py pacing     # calls made together go out paced and counted (mocked services, a fake clock)
  python3 tools/smoke.py heading    # where you are (23a): the cone, follow me, a pan, facing ahead, a hidden page (a GPS and a compass of its own)

Needs the dev server (python3 serve.py) and Google Chrome. Draws a straight-line
route (no routing requests). The forecast comes from Open-Meteo, cached for an hour.
Exits 1 if anything fails.
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import BASE, Chrome  # noqa: E402

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


# Press the DOM midpoint handle, rather than the canvas beneath it. Both receive
# the bubbling press; only the marker should own the gesture (#215).
MIDPOINT_EDIT = """(async () => {
  const p = polku.planner, map = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  p.setActive(true); p.clear(); p.setMode('line');
  p.addPoint([23.800, 61.509]); p.addPoint([23.838, 61.516]);
  await p.analysing;
  p.fitRoute();
  await wait(900);
  const ghost = p.ghosts[0], el = ghost.getElement();
  // Wait for the route beneath the handle to be drawn: otherwise only the
  // marker gets the press and the conflicting line gesture is never tested.
  const hit = () => map.queryRenderedFeatures(map.project(ghost.getLngLat()), { layers: ['route-casing'] })
    .some((f) => f.properties.kind === 'leg');
  for (let k = 0; k < 100 && !hit(); k++) await wait(100);
  if (!hit()) return ['route beneath the midpoint handle was not rendered'];
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


def editing(chrome):
    ok = True
    for sport in ('mtb', 'gravel', 'hike', 'paddle'):
        for w, h, phone in [(1440, 900, False), (390, 844, True)]:
            pg = chrome.page(w, h, phone)
            try:
                pg.open_app({'activity': sport, 'timeline': True}, {'polku:plannerDock': '"left"'})
                pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
                fails = pg.js(MIDPOINT_EDIT)
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
  if (document.querySelector('#layers-panel').hidden) document.querySelector('#btn-layers').click();
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
    const t = document.querySelector('.polku-popup .insp-title');
    if (!t || !/log|fallen/i.test(t.textContent)) errs.push(`clicking the fallen tree opened ${t ? t.textContent : 'nothing'}`);
    document.querySelector('.polku-popup .maplibregl-popup-close-button')?.click();
  }
  // uphill colours come back after switching them off and on (they're cached, and once stayed blank)
  m.jumpTo({ center: [25.7652, 62.2289], zoom: 15.5 });
  if (document.querySelector('#layers-panel').hidden) document.querySelector('#btn-layers').click();
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
  if (!document.querySelector('[data-sec=warnings] .li-ico')) errs.push('trail heads-up rows have no icon');
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
    print(f"{'ok  ' if not fails else 'FAIL'} trail details" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


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
# route opens its card; "Ride this route" makes it the plan as fixed legs (no
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
  for (let k = 0; k < 40 && !ride; k++) { await wait(200); ride = [...document.querySelectorAll('.polku-popup button')].find((b) => /Ride this route/.test(b.textContent)); }
  if (!ride) return [...errs, 'the card has no Ride this route'];
  const note = () => document.querySelector('.polku-popup .insp-ride')?.textContent || '';
  for (let k = 0; k < 30 && !/loop|one way/.test(note()); k++) await wait(150);
  if (!/^18 km · a loop/.test(note())) errs.push(`the card says: ${note() || 'nothing'}`);
  if (!polku.map.getLayer('lipas-pick') || !polku.map.queryRenderedFeatures({ layers: ['lipas-pick'] }).length) errs.push('the picked route is not highlighted');
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
    fails += [f'console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} water routing" + ''.join(f'\n     - {f}' for f in fails), flush=True)
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
  const warned = () => ((p.analysis && p.analysis.waterWarn) || []).some((w) => /^Not checked on the water: .*OpenStreetMap/.test(w.text));
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
  if (document.querySelectorAll('.wpl-change input').length !== 2) errs.push('no changeover minutes in the waypoint list');
  p.openLegs.add(1); p.renderWaypoints();
  const sel = document.querySelector('.wpl-legset .pt-sport select');
  if (!sel || sel.value !== 'paddle') errs.push(`the leg's sport picker shows ${sel && sel.value}`);
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
  p.setStartOffset(Math.round(ten / 3600000 - Math.floor(Date.now() / 3600000)));
  if (new Date(p.startSec() * 1000).getHours() !== 10) errs.push(`departure at ${new Date(p.startSec() * 1000)}`);
  for (const q of [[23.700, 61.500], [23.720, 61.506], [23.745, 61.509], [23.760, 61.504]]) p.addPoint(q);
  p.setLegSport(1, 'paddle'); // mtb → paddle → mtb: the bike stays at point 1
  const ready = (k) => p.analysis && p.analysis.waits && p.analysis.waits.length === k;
  for (let k = 0; k < 40 && !ready(2); k++) await wait(200);
  const warns = () => [...document.querySelectorAll('.warnings .li-main b')].map((x) => x.textContent);
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
  if (document.querySelectorAll('.wpl-stop').length !== 2 || !document.querySelector('.wpl-stop.night input[type=time]')) errs.push('stops in the waypoint list');
  p.reveal('speed');
  await wait(200);
  const rows = [...document.querySelectorAll('.speed-row.sub span')].map((x) => x.textContent.trim());
  if (!rows.some((t) => /^Breaks \(1\)/.test(t)) || !rows.some((t) => /^Nights \(1\)/.test(t))) errs.push(`Time & speed: ${rows.join(' / ')}`);
  // the point menu has the stop, places to sleep for a night, and the gear switch
  p.openPointMenu(2, p.markers[2]);
  await wait(200);
  const menu = document.querySelector('.polku-popup .pt-menu');
  if (!menu || !menu.querySelector('.pt-stop [aria-pressed=true]') || !/Places to sleep nearby/.test(menu.textContent)) errs.push('the point menu: no stop or places to sleep');
  if (p.menu) p.menu.remove();
  p.openPointMenu(1, p.markers[1]);
  await wait(200);
  if (!document.querySelector('.polku-popup .pt-gear input:checked')) errs.push('the point menu: no "Take the bike along"');
  if (p.menu) p.menu.remove();
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
LOADED = "new Promise((ok) => { const go = () => window.polku && polku.map.loaded() ? ok() : setTimeout(go, 200); go(); })"


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
        pg.js(LOADED)
        sent = json.dumps(shared['sent'])
        fails += pg.js((AVOID_OPENED % json.dumps(shared['url'])) + f'({sent})', timeout=60000)
        pg.reload()
        fails += pg.js(AVOID_RELOADED + f'({sent})')
        pg.goto(shared['bad'])
        pg.js(LOADED)
        fails += pg.js(AVOID_BAD, timeout=60000)
        fails += [f'console: {e[:160]}' for e in pg.errors()]
    finally:
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} places to avoid in share links" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


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
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [], p = polku.planner, m = polku.map;
  p.checkWet = async () => {}; // dry ground whatever the weather, so no leg is routed twice
  p.wet = { on: false, mm: 0, at: Date.now() };
  const routed = async (by) => { for (let k = 0; k < 100 && !(p.legs.length === 1 && p.legs[0].status === 'ok' && p.analysis && (p.legs[0].result.provider || 'brouter') === by); k++) await wait(200); return p.legs.length === 1 && p.legs[0].status === 'ok'; };
  const rows = () => [...document.querySelectorAll('.warnings .li-row')].map((r) => r.textContent);
  p.setActive(true);
  p.setMode('auto');
  const A = [24.930, 60.170], B = [24.940, 60.170];
  p.addPoint(A);
  p.addPoint(B);
  if (!(await routed('brouter'))) return [`the BRouter leg: ${p.legs.map((l) => l.status).join(', ')}`];
  p.reveal('warnings');
  await wait(300);
  const priv = rows().filter((t) => /Marked private in OpenStreetMap/.test(t));
  if (priv.length !== 1 || !/foot=private/.test(priv[0] || '')) errs.push(`foot=private on a Run leg: ${rows().join(' / ') || 'no rows'}`);
  if (rows().some((t) => /access=no|Private or no access/.test(t))) errs.push(`a footway open to walkers (access=no + foot=yes) got a row: ${rows().join(' / ')}`);
  const w = (p.analysis.warnings || []).find((x) => /^Marked private/.test(x.text));
  if (!w || Math.abs(w.len - 185) > 25) errs.push(`the private stretch: ${w ? Math.round(w.len) : 'none'} m, not about 185 m`);
  // its ⋯ offers to correct the tag
  const more = [...document.querySelectorAll('.warnings .li-row')].find((r) => /Marked private/.test(r.textContent))?.querySelector('.li-more');
  if (!more) errs.push('no ⋯ on the private row');
  else {
    more.click();
    await wait(200);
    if (!/Tagged wrong/.test(document.body.textContent)) errs.push('the ⋯ menu has no "Tagged wrong?"');
    more.click();
  }
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
  if (!rows().some((t) => /routed by Valhalla/.test(t) && /marked private/.test(t))) errs.push('the Valhalla row doesn\\'t say it may take ways marked private');
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
  const routed = async () => { for (let k = 0; k < 100 && !(p.legs.length === 1 && p.legs[0].status === 'ok' && p.analysis); k++) await wait(200); return p.legs.length === 1 && p.legs[0].status === 'ok'; };
  const rows = () => [...document.querySelectorAll('.warnings .li-row')].map((r) => r.textContent);
  p.setActive(true);
  p.setMode('auto');
  p.addPoint(A.slice());
  p.addPoint(B.slice());
  if (!(await routed())) return [`the leg: ${p.legs.map((l) => l.status).join(', ')}`];
  await wait(300);
  p.reveal('warnings');
  await wait(300);
  const round = rows().filter((t) => /Goes round a way marked private/.test(t));
  if (round.length !== 1) errs.push(`goes round: ${rows().join(' / ') || 'no rows'}`);
  else {
    if (!/save about 3[23]0 m/.test(round[0])) errs.push(`the short cut's saving: ${round[0]}`);
    if (!/start was moved 5\\d m and the finish 5\\d m off it/.test(round[0])) errs.push(`the moved points: ${round[0]}`);
  }
  if (rows().some((t) => /moved .* off a way marked private/.test(t))) errs.push('a moved-point row as well as the short cut');
  // the row draws the short cut
  [...document.querySelectorAll('.warnings .li-row')].find((r) => /Goes round/.test(r.textContent))?.querySelector('.li').click();
  await wait(400);
  const src = m.getSource('accessCut'), cut = src ? await src.getData() : { features: [] };
  if (!cut.features.length || cut.features[0].geometry.coordinates.length < 2) errs.push('the short cut isn\\'t drawn');
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
  const rows = () => [...document.querySelectorAll('.warnings .li-row')].map((r) => r.textContent);
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
  // Short cut from Heads-up
  const A = [24.930, 60.175], B = [24.934, 60.175];
  stub(A, B);
  p.addPoint(A.slice());
  p.addPoint(B.slice());
  await settle();
  p.reveal('warnings');
  await wait(300);
  const btn = [...document.querySelectorAll('.warnings .li-row')].find((r) => /Goes round/.test(r.textContent))?.querySelector('button.btn:not(.avoid)');
  if (!btn || btn.textContent !== 'Short cut') return [...errs, `no Short cut on the row: ${rows().join(' / ')}`];
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
  if (!rows().some((t) => /Marked private in OpenStreetMap/.test(t) && /you allowed short cuts on this leg/.test(t))) errs.push(`Heads-up on the short cut: ${rows().join(' / ')}`);
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
# Points added quickly get no other way until you stop; a short leg gets none; with no room under
# the pacing (four calls in the last 10 s) none; the leg's menu has Other ways, two of them
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
  // three points, the third 0.8 s after the second leg is in (routed: the pause doesn't wait for
  // the terrain): only the last leg gets other ways
  p.addPoint([24.930, 60.170]);
  p.addPoint([24.950, 60.170]);
  for (let k = 0; k < 100 && !(p.legs.length && p.legs.every((l) => l.status === 'ok')); k++) await wait(50);
  await wait(800);
  p.addPoint([24.970, 60.170]);
  await routed();
  await wait(3000);
  if (others() !== 1 || !p.alts || p.alts.li !== 1) errs.push(`points added quickly: ${others()} calls for other ways, offered for leg ${p.alts ? p.alts.li : 'none'} (one, for the last leg)`);
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
  // the leg's menu: Other ways, both alternatives (they wait their turn)
  o = others();
  p.openLegMenu(0, { lng: 24.94, lat: 60.19 });
  await wait(200);
  const btn = [...document.querySelectorAll('.polku-popup .pt-menu button')].find((b) => /Other ways/.test(b.textContent));
  if (!btn) return [...errs, 'no Other ways in the leg\\'s menu'];
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
  const both = async () => { const t = performance.now(); for (let k = 0; k < 160 && !(p.alts && p.alts.ways.length >= 2); k++) await wait(50); return performance.now() - t; };
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
  if (calls(1) !== c1 + 1 || calls(2) !== c2 + 1 || took > 1500) errs.push(`your own server: alternative 1 ×${calls(1) - c1}, 2 ×${calls(2) - c2}, both shown ${Math.round(took)} ms after the leg (within 1.5 s)`);
  localStorage.removeItem('polku:brouterUrl');
  p.clear();
  return errs;
})()"""


def otherways(chrome):
    fails = []
    for script, timeout in [(OTHERWAYS, 90000), (OTHERWAYS_BUSY, 120000), (OTHERWAYS_CALM, 90000)]:
        pg = chrome.page(1440, 900, False)
        try:
            pg.c.send('Page.addScriptToEvaluateOnNewDocument', {'source': OTHERWAYS_ROUTER}, pg.s)
            pg.open_app({'activity': 'run'}, {'polku:plannerDock': '"left"'}, '#14/60.171/24.94')
            pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
            fails += pg.js(script, timeout=timeout)
            fails += [f'console: {e[:160]}' for e in pg.errors()]
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
  const moves = async () => { const f0 = f.frames; await wait(1500); return f.frames > f0 + 3; };
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
  if (p.els.quickLoop.hidden) errs.push('no Round trip button for paddling');
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
  if (p.els.quickLoop.hidden) errs.push('no Round trip button for swimming');
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
  const free = () => {
    const bar = document.querySelector('.topbar').getBoundingClientRect(), pl = document.querySelector('#planner');
    return { top: bar.bottom, bottom: p.active && !pl.hidden ? pl.getBoundingClientRect().top : innerHeight, left: 0, right: innerWidth };
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
    else if (out) err(`${what}: ${out} of ${q.length} points outside the map above the sheet (${st})`);
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
  const gpx = `<?xml version="1.0"?><gpx version="1.1" creator="smoke"><trk><name>Test track</name><trkseg>${TRACK.map(([x, y]) => `<trkpt lat="${y}" lon="${x}"></trkpt>`).join('')}</trkseg></trk></gpx>`;
  const importTrack = async () => {
    const input = document.querySelector('#file-input'), dt = new DataTransfer();
    dt.items.add(new File([gpx], 'test.gpx', { type: 'application/gpx+xml' }));
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
      if (!p.els.fit.offsetParent) err(`no fit button at ${st}`);
      p.els.fit.click();
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
  // the first click: the empty planner at peek, a tap on the map (from Python) puts the start down
  T.firstTap = async () => {
    p.setActive(true); p.clear(); p.closeLoop();
    p.setActive(false); p.setActive(true); // an empty planner opens at peek
    const late = await settled();
    if (late) err(`opening: ${late}`);
    if (p.panel.dataset.state !== 'peek') err(`the empty planner opened at ${p.panel.dataset.state}`);
    map.jumpTo({ center: [23.80, 61.50], zoom: 12 });
    await new Promise((ok) => map.once('idle', ok));
    window.holdRoutes();
    T.start = [23.80, 61.50];
    const q = map.project(T.start);
    return { x: q.x, y: q.y };
  };
  // its card: a loop of the first length; the sheet rises to half as the loops' area is framed
  T.loopFromStart = async () => {
    const chip = document.querySelector('.start-tip .st-acts .chip');
    if (!chip) { err('no round-trip choices on the first tap'); return T.errs.splice(0); }
    chip.click();
    await wait(100);
    const R = await import(location.origin + '/js/roundtrip.js'), L = p.loop;
    await framed('the round trip’s area as the sheet rises', corners(R.reach(L.start, R.radiusFor('mtb', L.km * 1000))));
    window.releaseRoutes();
    for (let k = 0; k < 450 && (L.busy || !L.results.length); k++) await wait(200);
    if (L.results.length < 3) { err(`${L.results.length} loops (${L.note})`); return T.errs.splice(0); }
    await framed('the three loops', L.results.flatMap((r) => r.line.coords));
    return T.errs.splice(0);
  };
  // a loop that isn't picked, tapped on the map (the tap from Python)
  T.loopSpot = () => {
    const L = p.loop;
    if (L.results.length < 3) return null;
    const k = L.on === 1 ? 2 : 1, s = spotOn(k);
    T.k = k; T.n = L.results.length; T.start = L.start.slice();
    if (!s || s.d < 24) { err(`no spot on loop ${L.results[k].letter} clear of the others (${s ? Math.round(s.d) : 'none'} px)`); return null; }
    return s;
  };
  T.loopTapped = async () => {
    const L = p.loop, k = T.k;
    await wait(300);
    if (L.results.length !== T.n) err(`tapping loop ${'ABC'[k]} on the map left ${L.results.length} of ${T.n} loops`);
    else {
      if (L.on !== k) err(`tapping loop ${L.results[k].letter} on the map picked ${L.results[L.on] ? L.results[L.on].letter : L.on}`);
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
  T.offSpot = () => { T.n = p.loop.results.length; const s = spotOff(); if (!s) err('no spot clear of the loops'); else T.off = map.unproject([s.x, s.y]); return s; };
  T.offTapped = async () => {
    const L = p.loop;
    await wait(300);
    if (T.off && (!L.start || Math.abs(L.start[0] - T.off.lng) > 1e-3 || Math.abs(L.start[1] - T.off.lat) > 1e-3)) err(`a tap away from the loops left the start at ${L.start}`);
    if (L.results.length) err(`a tap away from the loops kept ${L.results.length} loops`);
    // new loops from there, and Use this loop with the sheet at full
    await p.generateLoops();
    if (!L.results.length) { err(`no loops the second time (${L.note})`); return T.errs.splice(0); }
    await state('full');
    away();
    const mv = moved();
    const use = document.querySelector('.loop-card.on .btn');
    if (!use) err('no Use this loop'); else use.click();
    await mv;
    await framed('Use this loop at full', line());
    return T.errs.splice(0);
  };
  // desktop: the padding as it was (the side panel, the bottom panel at half)
  T.desktop = async () => {
    p.setActive(true);
    const r = () => p.panel.getBoundingClientRect(), same = (a, b) => ['top', 'bottom', 'left', 'right'].every((k) => Math.abs(a[k] - b[k]) < 0.5);
    const was = (lay) => (lay === 'side' ? { top: 80, bottom: 40, left: r().right + 40, right: 110 } : { top: 80, bottom: innerHeight - r().top + 20, left: 20, right: 70 });
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
    tap = lambda pg, s: pg.c.send('Input.synthesizeTapGesture', {'x': s['x'], 'y': s['y'], 'gestureSourceType': 'touch'}, pg.s)
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
                pg.js(LOADED)
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
  // the start: four ways to begin, Round trip among them
  p.setTab('route');
  await wait(200);
  const choices = [...document.querySelectorAll('.pl-start .pl-choice b')].map(txt);
  if (choices.join('|') !== 'Draw it|Round trip|Ride a marked route|Import a GPX or KML') errs.push(`start choices: ${choices.join(' | ') || 'none'}`);
  if (document.querySelector('.pl-empty').hidden) errs.push('Check says nothing before there is a route');
  // the first click: the start goes down and a loop from there is offered; the next click adds a point
  p.setMode('line');
  const c = m.getCenter(), q = m.project(c);
  m.fire('click', { point: q, lngLat: c, originalEvent: new MouseEvent('click') });
  await wait(300);
  const tip = document.querySelector('.start-tip');
  if (!tip || !/make a loop from here/.test(txt(tip))) errs.push('no loop offered at the first click');
  if (/\bnull\b|undefined/.test(p.panel.textContent)) errs.push('“null” written in the drawer with one point');
  const q2 = { x: q.x + 120, y: q.y - 60 }, ll2 = m.unproject([q2.x, q2.y]);
  m.fire('mousedown', { point: q2, lngLat: ll2, originalEvent: new MouseEvent('mousedown', { button: 0 }) });
  m.fire('click', { point: q2, lngLat: ll2, originalEvent: new MouseEvent('click') });
  await wait(300);
  if (p.points.length !== 2) errs.push(`the click after the start added ${p.points.length - 1} points`);
  if (document.querySelector('.start-tip')) errs.push('the start’s offer stayed open after the next click');
  if (!document.querySelector('.pl-start').hidden) errs.push('the start choices stay with a route');
  // a loop from the start's offer: the round trip opens at that length
  p.clear(); p.addPoint([c.lng, c.lat]); p.startTip([c.lng, c.lat]);
  await wait(200);
  const chip = document.querySelector('.start-tip .chip');
  const km = chip ? parseInt(txt(chip), 10) : 0;
  if (chip) chip.click();
  await wait(300);
  if (!p.loop.open || p.loop.km !== km || !p.loopsAsked) errs.push(`the start’s ${km} km loop: open ${p.loop.open}, ${p.loop.km} km, asked ${p.loopsAsked || 0}`);
  p.closeLoop();
  // a route of three straight legs
  p.clear();
  for (const d of [[0, 0], [0.01, 0.004], [0.022, 0.001], [0.03, 0.008]]) p.addPoint([c.lng + d[0], c.lat + d[1]]);
  for (let k = 0; k < 30 && !p.analysis; k++) await wait(200);
  if (!p.analysis) return errs.concat('no route');
  // the header as it was
  for (const [k, what] of [['quickColor', 'the route’s colours'], ['quickSport', 'the sport'], ['quickLoop', 'Round trip'], ['quickStyle', 'the style'], ['fit', 'show all'], ['undo', 'undo'], ['redo', 'redo'], ['more', '⋯']]) {
    if (!p.els[k] || !p.els.head.contains(p.els[k])) errs.push(`header lost ${what}`);
  }
  if (p.els.head.querySelectorAll('.seg.modes button').length !== 3) errs.push('header lost the routing modes');
  // every section in its tab, and a jump to it opens that tab
  const where = { points: 'route', style: 'route', loop: 'route', warnings: 'check', climbs: 'check', colours: 'check', onmap: 'check', speed: 'go', depart: 'go', take: 'go' };
  for (const [id, tab] of Object.entries(where)) {
    const el = document.querySelector(`[data-sec=${id}]`);
    if (!el || el.closest('.pl-pane')?.dataset.tab !== tab) { errs.push(`${id} is not in ${tab}`); continue; }
    if (id === 'loop') continue;
    p.setTab(tab === 'go' ? 'route' : 'go');
    p.reveal(id);
    await wait(80);
    if (p.tab !== tab || el.closest('.pl-pane').hidden) errs.push(`reveal(${id}) didn’t open ${tab}`);
  }
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
  // Route: the tools out of ⋯, How you go with the style and the speeds
  p.setTab('route'); await wait(100);
  const foot = [...p.els.pointsFoot.querySelectorAll('button')].map(txt);
  for (const b of ['Round trip', 'Reverse', 'Back to start', 'Import', 'All leg settings']) if (!foot.includes(b)) errs.push(`Route lacks ${b}: ${foot.join(', ')}`);
  const how = document.querySelector('[data-sec=style]');
  if (!how.querySelector('.style-presets') || !how.querySelector('.speed-wrap .speed-box').children.length) errs.push('How you go lacks the style or the speeds');
  // ⋯: what's left there
  p.els.more.click(); await wait(100);
  const items = [...document.querySelectorAll('.menu-pop .menu-item')].map(txt);
  for (const want of ['Import', 'Export GPX', 'Copy share link', 'Save offline', 'Clear route']) if (!items.some((t) => t.includes(want))) errs.push(`⋯ lacks ${want}: ${items.join(', ')}`);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  // Check: at a glance, the marks' switches (once in ⋯)
  p.setTab('check'); await wait(100);
  if (p.els.stats.hidden || !p.els.stats.children.length) errs.push('Check lacks the stats');
  const marks = [...document.querySelectorAll('.onmap input')];
  if (marks.length !== 3) errs.push(`On the map has ${marks.length} switches`);
  else {
    const was = p.marks.km;
    marks[0].click(); await wait(100);
    if (p.marks.km === was) errs.push('Distance marks switch did nothing');
    p.setMarks({ km: was });
  }
  // Go: the time first, and taking it along
  p.setTab('go'); await wait(100);
  const head = document.querySelector('.time-head');
  if (!head || !/→/.test(txt(head))) errs.push(`Time doesn't open with the total: ${txt(head)}`);
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
  // the leg you point at lights up on the map and in the profile
  p.setTab('route'); await wait(100);
  const row = document.querySelector('.wpl-row[data-i="1"]');
  row.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  await wait(150);
  const lit = m.getSource('routeLit').serialize().data;
  if (!(lit.features && lit.features.length === 1)) errs.push('pointing at a waypoint lit nothing on the map');
  const hl = p.chart.highlight;
  if (!hl || Math.abs(hl[0] - p.lengthTo(1)) > 1 || Math.abs(hl[1] - p.lengthTo(2)) > 1) errs.push(`the profile lit ${JSON.stringify(hl)}`);
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
  const row = () => [...box.querySelectorAll('.li-row')].find((r) => /Log across/.test(r.textContent));
  const more = row() && row().querySelector('.li-more');
  if (!more) errs.push('the log row has no ⋯');
  else {
    more.click();
    await wait(100);
    const menu = document.querySelector('.menu-pop');
    const items = menu ? [...menu.querySelectorAll('.menu-item')].map((b) => b.textContent) : [];
    if (!items.some((t) => /^Hide “Fallen trees and logs”/.test(t))) errs.push(`row menu: ${items.join(' / ') || 'none'}`);
    if (!items.some((t) => /Fix the map/.test(t)) || !items.some((t) => /Leave a note/.test(t))) errs.push(`row menu has no OpenStreetMap links: ${items.join(' / ')}`);
    [...(menu ? menu.querySelectorAll('.menu-item') : [])].find((b) => /^Hide/.test(b.textContent))?.click();
    await wait(150);
    if (row()) errs.push('the log row still shows after Hide');
    const chip = box.querySelector('.hidden-kinds .on-chip');
    if (!chip || !/Fallen trees and logs/.test(chip.textContent)) errs.push(`hidden kinds: ${box.querySelector('.hidden-kinds')?.textContent || 'none'}`);
    if (!(JSON.parse(localStorage.getItem('polku:hideWarn') || '{}').tree)) errs.push('Hide wasn’t kept');
    if (!/hidden/.test(p.sec.warnings.sum.textContent)) errs.push(`Heads-up summary: ${p.sec.warnings.sum.textContent}`);
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
  // the speeds (Route › How you go, and Check's glance) are MTB's, not the paddler's
  if (!p.els.stats.textContent.includes(sum.name) || /Sea kayak|Canoe|SUP/.test(p.els.speedBox.textContent)) errs.push(`speeds: ${p.els.stats.textContent.slice(0, 80)} / ${p.els.speedBox.textContent.slice(0, 80)} (MTB: ${sum.name})`);
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
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const n = await import(location.origin + '/js/net.js');
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
  polku.set({ activity: 'gravel' }); // the map’s sport pill
  await wait(500);
  if (sports() !== 'mtb,paddle,mtb') errs.push(`after the map’s sport changed: ${sports()}`);
  if (keys() !== k0) errs.push('legs routed again after the map’s sport changed');
  const act = [...document.querySelectorAll('.toast button')].find((b) => /Route it as Gravel/.test(b.textContent));
  if (!act || !/your route stays MTB/.test(document.querySelector('.toast')?.textContent || '')) errs.push(`toast: ${document.querySelector('.toast')?.textContent}`);
  else {
    if (p.els.sportSel.value !== 'mtb') errs.push(`the planner’s sport shows ${p.els.sportSel.value} for an MTB route`);
    act.click();
    await wait(400);
    if (sports() !== 'gravel,paddle,gravel') errs.push(`routed as Gravel: ${sports()}`);
    p.undo();
    await wait(400);
    if (sports() !== 'mtb,paddle,mtb' || keys() !== k0) errs.push(`undo after Route it as: ${sports()}`);
  }
  // the planner’s picker for the map’s own sport routes the route in it (the map stays)
  polku.set({ activity: 'hike' }); await wait(300); // the map: Hike, the route MTB
  p.app.setSport('hike');
  await wait(400);
  if (sports() !== 'hike,paddle,hike') errs.push(`the planner’s picker for the map’s sport: ${sports()}`);
  p.undo(); await wait(300);
  polku.set({ activity: 'gravel' }); await wait(300);
  // the planner’s own picker: the route goes with it, Undo back
  p.app.setSport('hike');
  await wait(500);
  if (sports() !== 'hike,paddle,hike') errs.push(`the planner’s picker (Hike): ${sports()}`);
  p.undo();
  await wait(400);
  if (sports() !== 'mtb,paddle,mtb') errs.push(`undo after the planner’s picker: ${sports()}`);
  // the Weather button while planning opens the planner's weather, and the section shows itself:
  // it lights up on the next animation frame (ours runs after it), which software rendering can be slow to draw (#74)
  const frame = new Promise((r) => { document.querySelector('#btn-time').click(); requestAnimationFrame(() => r(true)); });
  if (!(await Promise.race([frame, wait(5000).then(() => false)]))) errs.push('the Weather button: no animation frame in 5 s');
  else if (!p.sec.depart.el.classList.contains('sec-flash')) errs.push('the Weather button: Departure & weather not highlighted');
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
  document.querySelector('[data-panel=layers-panel]').click();
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
      const card = document.querySelector('.maplibregl-popup')?.textContent || '';
      if (!/In winter/.test(card) || !/ski track/i.test(card)) errs.push(`ski track card: ${card.slice(0, 120)}`);
      document.querySelector('.maplibregl-popup-close-button')?.click();
      await wait(300);
    }
    document.querySelector('[data-panel=layers-panel]').click();
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
  const q = m.project([23.760, 61.5025]);
  const fire = () => m.fire('click', { point: q, lngLat: m.unproject(q), originalEvent: new MouseEvent('click') });
  const menu = () => document.querySelector('.polku-popup .pt-menu');
  fire();
  await wait(300);
  if (p.points.length !== 2) errs.push(`a click on the line added a point (${p.points.length})`);
  if (!menu() || !/Add a point here/.test(menu().textContent)) errs.push('a click on the line: no menu for that part of the route');
  if (p.menu) p.menu.remove();
  const g = p.ghosts[0] && p.ghosts[0].getElement();
  if (!g) errs.push('no handle on the leg');
  else {
    g.click();
    await wait(300);
    if (p.points.length !== 2) errs.push(`a click on the leg's handle added a point (${p.points.length})`);
    if (!menu() || !/Add a point here/.test(menu().textContent)) errs.push("a click on the leg's handle: no menu for that part");
    if (p.menu) p.menu.remove();
  }
  p.lastTouchAt = Date.now();
  fire();
  await wait(300);
  if (p.points.length !== 2) errs.push(`a tap on the line added a point (${p.points.length})`);
  if (!menu() || !/Add a point here/.test(menu().textContent) || !menu().querySelector('.pt-sport select')) errs.push('a tap on the line: no menu for that part of the route');
  else {
    [...menu().querySelectorAll('button')].find((b) => /Add a point here/.test(b.textContent)).click();
    await wait(300);
    if (p.points.length !== 3) errs.push(`"Add a point here": ${p.points.length} points`);
    p.undo();
    await wait(300);
  }
  p.lastTouchAt = 0;
  p.setActive(false);
  await wait(400);
  fire();
  await wait(600);
  if (!p.active) errs.push('a click on the route (planner closed) did not open the planner');
  if (p.points.length !== 2) errs.push(`opening the planner from the route: ${p.points.length} points`);
  if (!menu()) errs.push('opening the planner from the route: no menu for that part');
  if (polku.planner.menu) polku.planner.menu.remove();
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
  const selector = entry === 'finish' ? '.pt-menu button[title="Add a leg back to the start"]'
    : entry === 'toolbar' ? '.tools button[aria-label="Back to start"]'
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
  p.openPointMenu(1, p.markers[1]);
  const q = m.project([23.740, 61.495]);
  m.fire('mousedown', { point: q, lngLat: m.unproject(q), originalEvent: new MouseEvent('mousedown') });
  m.fire('click', { point: q, lngLat: m.unproject(q), originalEvent: new MouseEvent('click') });
  await wait(200);
  if (p.points.length !== 2) errs.push(`a click beside an open menu added a point (${p.points.length})`);
  if (!document.querySelector('.polku-popup .maplibregl-popup-close-button')) { /* closed by the click: fine */ }
  p.openPointMenu(0, p.markers[0]);
  if (!document.querySelector('.polku-popup .maplibregl-popup-close-button')) errs.push('the point menu has no close button');
  if (!document.querySelector('.polku-popup .pt-depart select')) errs.push('no departure in the start point’s menu');
  if (p.menu) p.menu.remove();
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
    const row = [...document.querySelectorAll('[data-sec=warnings] .li-row')].find((r) => /Terrain didn.t load/.test(r.textContent));
    const retry = row && [...row.querySelectorAll('button')].find((b) => b.textContent === 'Retry');
    if (!retry) return [...errs, 'no Retry for the terrain in Heads-up'];
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


# The planner header never spills out of the sheet (labels vary: a measured layout,
# planner.js fitHeader). Narrow desktop windows with the bottom dock, a small phone.
HEADER_OUT = """(() => {
  const sheet = document.querySelector('#planner').getBoundingClientRect();
  let worst = 0, who = '';
  for (const el of document.querySelectorAll('.sheet-head button, .sheet-head label, .sheet-head .seg')) {
    if (!el.offsetParent) continue;
    const over = el.getBoundingClientRect().right - (sheet.right - 4);
    if (over > worst) { worst = over; who = (el.getAttribute('aria-label') || el.title || el.textContent || '').trim().slice(0, 30); }
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
            # the header's colour list and the profile's "Colour by" / "On map" are one setting
            sync = pg.js("""(() => {
              const p = polku.planner, errs = [];
              p.pickColor('surface');
              if (!p.els.mapToggle.checked || p.els.modeSel.value !== 'surface' || p.els.colorSel.value !== 'surface') errs.push('picking Surface in the header');
              p.pickColor('plain');
              if (p.els.mapToggle.checked || p.els.colorSel.value !== 'plain') errs.push('picking Plain line in the header');
              p.setColorOnMap(true);
              if (p.els.colorSel.value !== 'surface') errs.push('On map in the profile');
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
      for (let k = 1; k <= 8; k++) { await frames(1); ev('touchmove', k / 8); }
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
  polku.planner.setActive(true);
  await settle();
  at(A);
  await settle();
  const pr = document.querySelector('#planner').getBoundingClientRect(), pa = map.project(L.shown);
  if (L.state() !== 'follow' || off() > 2) errs.push(`with the planner open: ${L.state()}, the dot ${px(off())} from its place`);
  else if (touch ? pa.y > pr.top - 20 : pa.x < pr.right + 20) errs.push('with the planner open, the dot is behind it');
  polku.planner.setActive(false);
  await settle();

  // facing ahead (a phone): the next tap turns the map with you, about your dot
  if (touch) {
    btn.click();
    await face(200);
    await settle();
    if (L.state() !== 'ahead') errs.push(`the second tap: ${L.state()}, not facing ahead`);
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
    # one clock: while planning, the timeline is inside the planner, not over the map
    if not pg.js("!!document.querySelector('#planner #wx-bar')"):
        fails.append('timeline not docked in the planner while planning')
    states = ['open', 'min'] if layout == 'side' else ['peek', 'profile', 'half', 'full']
    for st in states:
        pg.js(f"polku.planner.setSheetState({json.dumps(st)}, {{ remember: false }}); true")
        late = pg.js(SETTLED)  # the sheet's and the controls' transitions (slow in software rendering)
        if late:
            fails.append(f'planning/{st}: {late}')
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
  if (!p.colorOnMap || p.els.colorSel.value !== 'way' || !polku.map.getSource('routeColor').serialize().data.features.length) errs.push('bar did not colour the map route');
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
  const saved = JSON.stringify({ mode: p.colorMode, onMap: p.colorOnMap, offset: p.startOffsetH, points: p.points, camera: [polku.map.getCenter().toArray(), polku.map.getZoom(), polku.map.getBearing(), polku.map.getPitch()], settings: [localStorage.getItem('polku:colorMode'), localStorage.getItem('polku:colorOnMap')] });
  const unchanged = () => JSON.stringify({ mode: p.colorMode, onMap: p.colorOnMap, offset: p.startOffsetH, points: p.points, camera: [polku.map.getCenter().toArray(), polku.map.getZoom(), polku.map.getBearing(), polku.map.getPitch()], settings: [localStorage.getItem('polku:colorMode'), localStorage.getItem('polku:colorOnMap')] }) === saved;
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
  enter(); p.setStartOffset(1); empty('departure update');
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
  p.setStartOffset(3);
  const arrival = p.clockOf(p.startSec() + 4000);
  if (!label().includes(`1 km · ${arrival}`)) errs.push(`departure did not move the mark immediately: ${label()}`);
  a.wind = null; a.tAtWind = null; a.tAt = original;
  p.renderAnalysis(); p.reveal('onmap');
  const switches = () => [...p.els.onMap.querySelectorAll('input')];
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
  // Follow the estimate from Check, even when Go’s Time section and the sheet are folded.
  p.toggleSection('speed', false);
  if (p.layout() === 'sheet') p.setSheetState('peek', { remember: false });
  document.querySelector('.sum-time').click(); await wait(500);
  const settled = await __DEPARTURE_SETTLED__;
  if (settled) errs.push(`departure sheet: ${settled}`);
  const select = document.querySelector('#pl-pane-go .go-depart select');
  if (p.tab !== 'go' || p.sec.speed.el.dataset.open !== 'true' || !select || document.activeElement !== select) errs.push('estimate did not open Go and focus its departure picker');
  if (select) {
    select.value = '4'; select.dispatchEvent(new Event('change', { bubbles: true }));
    if (p.startOffsetH !== 4) errs.push('departure setting did not change the departure');
    const r = select.getBoundingClientRect(), body = p.els.body.getBoundingClientRect();
    if (r.top < body.top || r.bottom > body.bottom) errs.push('departure control is out of view');
    if (r.height < 44 || parseFloat(getComputedStyle(select).fontSize) < 16) errs.push('Go departure picker is too small');
    const waypoint = () => p.els.points.querySelector('.wpl-depart select');
    if (waypoint()?.value !== '4' || !document.querySelector('.time-head').textContent.includes(p.clockOf(p.startSec()))) errs.push('Go departure did not sync the waypoint or schedule immediately');
    waypoint().value = '5'; waypoint().dispatchEvent(new Event('change', { bubbles: true }));
    if (select.value !== '5' || p.startOffsetH !== 5) errs.push('waypoint departure did not sync Go');
    p.setStartOffset(6, { fromMap: true });
    if (select.value !== '6' || waypoint()?.value !== '6') errs.push('timeline departure did not sync both pickers');
    select.focus(); p.renderAnalysis();
    if (document.activeElement !== select || !select.isConnected) errs.push('an analysis update replaced the focused departure picker');
    // Crossing an hour refreshes options without replacing the select itself.
    select.dataset.hour = 'old'; select.options[1].textContent = 'old hour';
    p.renderSpeed();
    if (select.options[1].textContent === 'old hour' || select.value !== '6' || document.activeElement !== select) errs.push('departure choices did not refresh while keeping selection and focus');

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


def main():
    only = sys.argv[1:]
    chrome = Chrome()
    ok = True
    try:
        if not only or 'pacing' in only:
            ok = pacing(chrome) and ok
        if not only or 'layers' in only:
            ok = layers(chrome) and ok
        if not only or 'trails' in only:
            ok = trails(chrome) and ok
            ok = uphill_late(chrome) and ok
        if not only or 'header' in only:
            ok = header_fit(chrome) and ok
        if not only or 'lipas' in only:
            ok = lipas(chrome) and ok
        if not only or 'water' in only:
            ok = water(chrome) and ok
            ok = water_late(chrome) and ok
        if not only or 'multi' in only:
            ok = multi(chrome) and ok
        if not only or 'editing' in only:
            ok = editing(chrome) and ok
        if not only or 'routemenu' in only:
            ok = route_menu(chrome) and ok
        if not only or 'backtostart' in only:
            ok = back_to_start(chrome) and ok
        if not only or 'routebits' in only:
            ok = route_bits(chrome) and ok
        if not only or 'terrain' in only:
            ok = terrain(chrome) and ok
        if not only or 'stops' in only:
            ok = stops(chrome) and ok
        if not only or 'avoid' in only:
            ok = avoid_link(chrome) and ok
        if not only or 'access' in only:
            ok = access(chrome) and ok
        if not only or 'detour' in only:
            ok = detour(chrome) and ok
        if not only or 'shortcut' in only:
            ok = shortcut(chrome) and ok
        if not only or 'otherways' in only:
            ok = otherways(chrome) and ok
        if not only or 'flow' in only:
            ok = flow(chrome) and ok
        if not only or 'loops' in only:
            ok = loops(chrome) and ok
        if not only or 'fit' in only:
            ok = fit_phone(chrome) and ok
        if not only or 'winter' in only:
            ok = winter(chrome) and ok
        if not only or 'sports' in only:
            ok = sport_switch(chrome) and ok
        if not only or 'winterroute' in only:
            ok = winter_route(chrome) and ok
        if not only or 'sweep' in only:
            ok = sweep(chrome) and ok
        if not only or 'marks' in only:
            ok = marks(chrome) and ok
        if not only or 'colours' in only:
            ok = colours(chrome) and ok
        if not only or 'previews' in only:
            ok = previews(chrome) and ok
        if not only or 'drawer' in only:
            ok = drawer(chrome) and ok
        if not only or 'heading' in only:
            ok = heading(chrome) and ok
        for w, h, phone, bottom in VIEWPORTS:
            if only and f'{w}x{h}' not in only:
                continue
            ok = check(chrome, w, h, phone, bottom) and ok
    finally:
        chrome.close()
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
