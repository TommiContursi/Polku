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
import os
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
    const t = document.querySelector('.polku-popup .insp-title');
    if (!t || !/log|fallen/i.test(t.textContent)) errs.push(`clicking the fallen tree opened ${t ? t.textContent : 'nothing'}`);
    document.querySelector('.polku-popup .maplibregl-popup-close-button')?.click();
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
  for (let k = 0; k < 40 && !ride; k++) { await wait(200); ride = [...document.querySelectorAll('.polku-popup button')].find((b) => /Follow this route/.test(b.textContent)); }
  if (!ride) return [...errs, 'the card has no Follow this route (#306)'];
  if (/\\bRide\\b/.test(document.querySelector('.polku-popup').textContent)) errs.push('the card says Ride (#306)');
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


def otherways(chrome):
    fails = []
    cases = [('pause and picking', OTHERWAYS, 90000),
             ('quick points', OTHERWAYS_QUICK.replace('__STALL_MS__', '0'), 45000),
             ('quick points, blocked main thread', OTHERWAYS_QUICK.replace('__STALL_MS__', '2200'), 45000),
             ('short legs and pacing', OTHERWAYS_BUSY, 120000),
             ('taking your time', OTHERWAYS_CALM, 90000)]
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
      // the toolbar's on desktops, the map's column's on phones (25a)
      const fit = p.tools.classList.contains('desk') ? p.els.fit : document.getElementById('btn-fit');
      if (!fit.offsetParent || fit.disabled) err(`no fit button at ${st}`);
      fit.click();
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
  const where = { points: 'route', style: 'route', warnings: 'check', climbs: 'check', colours: 'check', onmap: 'check', speed: 'go', depart: 'go', take: 'go' };
  for (const [id, tab] of Object.entries(where)) {
    const el = document.querySelector(`[data-sec=${id}]`);
    if (!el || el.closest('.pl-pane')?.dataset.tab !== tab) { errs.push(`${id} is not in ${tab}`); continue; }
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
  // More: the whole route's actions (25a)
  p.els.more.click(); await wait(100);
  const items = [...document.querySelectorAll('.menu-pop .menu-item')].map(txt);
  const bar = [...p.tools.querySelectorAll('button')].filter((b) => !b.hidden && b.offsetParent).map((b) => b.getAttribute('aria-label') || '');
  for (const want of ['Share link', 'Export GPX', 'Save offline', 'Round trip', 'Reverse', 'Back to start', 'Import', 'Clear route']) {
    const inMore = items.some((t) => t.includes(want)), inBar = bar.some((t) => t.startsWith(want));
    if (inMore === inBar) errs.push(`${want} is ${inMore ? 'both on the toolbar and in More' : 'neither on the toolbar nor in More'}`);
  }
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
      const card = document.querySelector('.maplibregl-popup')?.textContent || '';
      if (!/In winter/.test(card) || !/ski track/i.test(card)) errs.push(`ski track card: ${card.slice(0, 120)}`);
      document.querySelector('.maplibregl-popup-close-button')?.click();
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
# frame on a slow phone holds it up. Polku's hold timers (the spot menu's 550 ms, the line's 300 ms)
# then run before it sees the touchend. On the empty map the tap puts the start down and opens no
# menu; on the line it opens that part's menu, with the route as it was and nothing in Undo.
# A finger really held 0.8 s still gets the spot menu.
QUICK_TAPS = """(() => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), p = polku.planner, m = polku.map;
  const title = () => { const t = document.querySelector('.maplibregl-popup .pt-title'); return t ? t.textContent : ''; };
  const at = (ll) => { const q = m.project(ll), el = document.elementFromPoint(q.x, q.y); return el === m.getCanvas() ? { x: q.x, y: q.y } : { under: el ? el.id || el.className || el.tagName : 'nothing' }; };
  // nothing open over the map (Clear route's note too: over a taller start it can reach the spot), the sheet low,
  // the map where it started
  const tidy = async () => {
    if (p.menu) p.menu.remove();
    const t = document.querySelector('#toast');
    t.classList.remove('show'); t.hidden = true;
    if (p.closeStartTip) p.closeStartTip(); // (before 25b: the first point's card)
    p.setSheetState('peek');
    await wait(600);
    m.jumpTo({ center: [23.76, 61.5025], zoom: 13 });
    await new Promise((ok) => { const t = setTimeout(ok, 5000); m.once('idle', () => { clearTimeout(t); ok(); }); });
  };
  // until the hold's timer has run: the spot menu open, or an edit of the line begun
  const until = (ok) => new Promise((done) => { const t0 = Date.now(), f = () => (ok() || Date.now() - t0 > 3000 ? done(true) : setTimeout(f, 20)); f(); });
  const A = [23.752, 61.5005], B = [23.768, 61.5045], EMPTY = [23.752, 61.5050];
  window.qt = {
    heldMenu: () => until(() => title() === 'This spot'),
    heldLine: () => until(() => !!p.edit),
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
      if (!title().includes('→')) errs.push(`a quick tap on the line of a busy page opened ${title() ? `“${title()}”` : 'no menu'}, not that part's`);
      if (document.body.classList.contains('route-editing')) errs.push('still editing after a quick tap on the line');
      if (p.menu) p.menu.remove();
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
      if (l.menu !== 'This spot' || !l.heldOff) errs.push(`a finger held 0.8 s on the map, as it lifts: ${l.menu ? `“${l.menu}”` : 'no menu'}, clicks ${l.heldOff ? '' : 'not '}held off`);
      if (p.points.length) errs.push(`a finger held 0.8 s on the map added ${p.points.length} points`);
      if (p.menu) p.menu.remove();
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
            pg.quick_tap(s['x'], s['y'], ms=ms, after=hold)
            fails += pg.js(done)
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
        time.sleep(0.5)
        r = pg.js("""(async () => {
          document.querySelector('#btn-layers').click();
          await new Promise((r) => setTimeout(r, 400));
          const box = (s) => document.querySelector(s).getBoundingClientRect().toJSON();
          return { q: box('#quick-layers'), b: box('#btn-layers'), p: box('#planner'), tail: document.querySelector('#quick-layers').classList.contains('tail'), H: innerHeight };
        })()""")
        q, b, p = r['q'], r['b'], r['p']
        name = f'{w}x{h_} {dock}'
        if q['right'] > b['left'] or q['top'] < 60 or q['bottom'] > r['H'] - 4:
            fails.append(f'{name}: the card at {q["left"]:.0f}–{q["right"]:.0f} × {q["top"]:.0f}–{q["bottom"]:.0f}, not beside the button within the map')
        if dock == 'left' and q['left'] < p['right']:
            fails.append(f'{name}: the card runs under the side panel')
        if dock == 'left' and abs(q['bottom'] - b['bottom']) > 1:
            fails.append(f'{name}: the card’s bottom at {q["bottom"]:.0f}, the button’s at {b["bottom"]:.0f}')
        if dock == 'bottom' and q['bottom'] > p['top']:
            fails.append(f'{name}: the card runs into the bottom planner')
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
    pg.swipe(head[0], head[1], head[1] + 30, ms=25, steps=3)  # a short flick down from half: one size, though it moved 30 px
    pg.js(SETTLED)
    if st()['st'] not in ('profile', 'peek'):
        fails.append(f'planner: a short flick down from half came to {st()["st"]}')
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
    # on a waypoint's name, most of its row: a text field that isn't being edited moves the sheet like the rest
    body = pg.js("(() => { const b = document.querySelector('#planner .wpl-row .wpl-name').getBoundingClientRect(); return [b.left + 20, b.top + b.height / 2]; })()")
    pg.swipe(body[0], body[1], body[1] + 300, ms=700, hold=0.2)
    pg.js(SETTLED)
    if st()['st'] == 'full':
        fails.append('planner: a drag down on the body at its top (from a waypoint’s name) did not move the sheet')
    # and a tap on the name still lets you type in it
    pg.js("polku.planner.setSheetState('full'); true")
    pg.js(SETTLED)
    name = pg.js("(() => { const b = document.querySelector('#planner .wpl-row .wpl-name').getBoundingClientRect(); return [b.left + 20, b.top + b.height / 2]; })()")
    pg.tap(name[0], name[1])
    time.sleep(0.3)
    if not pg.js("document.activeElement.classList.contains('wpl-name')"):
        fails.append('planner: a tap on a waypoint’s name did not put the cursor in it')
    pg.js("document.activeElement.blur(); true")
    # a waypoint's grip keeps its own drag: the sheet stays
    pg.js("polku.planner.setSheetState('full'); true")
    pg.js(SETTLED)
    pg.js("polku.planner.els.body.scrollTop = 0; true")
    grip = pg.js("(() => { const b = document.querySelector('#planner .wpl-grip').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()")
    pg.swipe(grip[0], grip[1], grip[1] + 40, ms=400, hold=0.1)
    pg.js(SETTLED)
    if st()['st'] != 'full':
        fails.append(f'planner: a drag on a waypoint’s grip moved the sheet to {st()["st"]}')
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
        pg.c.send('Network.setBlockedURLs', {'urls': ['*traficom.fi*']}, pg.s)
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
                # up to 4 px: the timeline grows 3 px when its forecast comes in, at any time (#301)
                if first[k] is None or last[k] is None or moves[-1] - moves[0] > 4:
                    fails.append(f"{name}: {label}'s top went from y {first[k]} (at {first['t']} ms) to y {last[k]} after the map's load"
                                 f" (tops seen: {', '.join(map(str, moves[:6]))})")
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the map's column on phones in its place before the map has loaded (#292)" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


def panels(chrome):
    fails = []
    for w, h_, sport in [(390, 844, 'mtb'), (390, 844, 'paddle'), (375, 667, 'mtb'), (360, 740, 'hike'), (667, 375, 'gravel')]:
        pg = chrome.page(w, h_, True)
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


# The sport pill's menu (#245): a mouse that hovers then clicks, a second click, Escape, a click outside; touch; the keyboard
ACTS = """(() => { const b = document.querySelector('#activity-bar .act-current'), r = b.getBoundingClientRect();
  return { open: !document.querySelector('#activity-bar .act-menu').hidden, expanded: b.getAttribute('aria-expanded'),
    pill: [r.left + r.width / 2, r.top + r.height / 2], focus: document.activeElement === b, sport: polku.state.activity,
    hover: matchMedia('(hover: hover) and (pointer: fine)').matches }; })()"""


def sport_menu(chrome):
    fails = []

    def state(pg, name, want):
        a = pg.js(ACTS)
        if a['open'] != want or a['expanded'] != str(want).lower():
            fails.append(f"{name}: the menu {'open' if a['open'] else 'closed'} (aria-expanded {a['expanded']}), not {'open' if want else 'closed'}")
        return a

    def page(w, h_, phone, sport):
        pg = chrome.page(w, h_, phone)
        # Traficom's depths, slow to answer at times, keep the map from loading; the menu needs none of them
        pg.c.send('Network.setBlockedURLs', {'urls': ['*traficom.fi*']}, pg.s)
        pg.open_app({'activity': sport, 'timeline': True}, {'polku:winter': '"off"'})
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
    print(f"{'ok  ' if not fails else 'FAIL'} the sport pill's menu: mouse, keyboard and touch" + ''.join(f'\n     - {f}' for f in fails), flush=True)
    return not fails


# B of the calmer planner (#233): the next leg's sport and speed in the drawing menu (phones) and on the toolbar
# (desktops), the drawing button naming it, Draw it and Go › Time, a point put on open water (not on a bridge or
# by the shore; the ice in winter), and Settings' speeds by sport (#87). Straight legs: no routing calls.
NL = """(() => {
  const T = window.nlT = { errs: [] };
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)], p = polku.planner, m = polku.map;
  T.at = (sel) => { const el = typeof sel === 'string' ? $(sel) : sel; if (!el || !el.offsetParent) return null;
    const b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, top = document.elementFromPoint(x, y);
    return { x, y, clear: !!top && (el === top || el.contains(top)), over: top ? String(top.id || top.className) : 'nothing' }; };
  T.item = (label) => T.at($$('.menu-pop .menu-item').find((x) => x.textContent.trim().startsWith(label)));
  T.toastBtn = (label) => T.at($$('#toast .toast-act').find((x) => x.textContent.trim() === label));
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
  T.settle = async (n) => { for (let k = 0; k < 60 && !(p.analysis && p.analysis.pts && p.legs.length === n - 1 && p.legs.every((l) => l.result)); k++) await new Promise((r) => setTimeout(r, 100)); await new Promise((r) => setTimeout(r, 300)); return T.state(); };
  return true;
})()"""


def nextleg(chrome):
    fails = []

    def page(w, h_, phone, sport):
        pg = chrome.page(w, h_, phone)
        pg.c.send('Network.setBlockedURLs', {'urls': ['*traficom.fi*']}, pg.s)
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
        if bad:
            fails.append(f'{name}: {bad}')

    # ---- a phone, by touch: Hike, then Gravel from the drawing menu
    name = '390x844'
    pg = page(390, 844, True, 'hike')
    S = lambda: pg.js('nlT.state()')
    pg.js('polku.planner.setActive(true), true')
    time.sleep(0.5)
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
    st = S()
    want(f'{name}, Swim', st, sports='hike,swim', next='swim', map='swim', past=past)
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
    time.sleep(0.5)
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
    time.sleep(0.5)
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
    # Go › Time: what the time is based on, and Change opens the editor in place
    pg.js("(() => { const p = polku.planner; p.setTab('go'); p.reveal('speed'); return true; })()")
    time.sleep(0.6)
    at = pg.js("(document.querySelector('.speed-at') || { textContent: '' }).textContent")
    if not at.startswith('Timed at your speed: Normal · 20 / 16 / 11 km/h · 600 m/h up'):
        fails.append(f'{name}: Go › Time says “{at[:80]}”')
    press(pg, pg.js("nlT.at('.speed-at .btn')"), f'{name}: Change', False)
    if not pg.js("!!document.querySelector('.speed-go .speed-presets')"):
        fails.append(f'{name}: Change in Go › Time opened no editor')
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


def button3d(chrome):
    fails = []

    def page(w, h_, phone, sport, settings=None):
        pg = chrome.page(w, h_, phone)
        # Traficom's depths, slow to answer at times, keep the map from loading; the button needs none of them
        pg.c.send('Network.setBlockedURLs', {'urls': ['*traficom.fi*']}, pg.s)
        pg.open_app({'activity': sport, 'timeline': True, **(settings or {})}, {'polku:winter': '"off"', 'polku:plannerDock': '"left"', 'polku:seen3dHint2': 'true'})
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        # open_app() returns once the map has loaded, which can be a frame before MapLibre's load event runs Polku's
        # load step: that opens the timeline, and on a phone the column then moves up above it (#292)
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
    print(f"{'ok  ' if not fails else 'FAIL'} the 3D button: mouse, keyboard, touch, reload, the column on phones, the quick drawer's tiles" + ''.join(f'\n     - {f}' for f in fails), flush=True)
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


# Every group: its name, its checks in the order they run, and its line for --list.
# No arguments runs them all in this order, then the layout at every size in VIEWPORTS.
# 25a, the toolbox and the header (#233). Phones: the toolbox floats beside the map's buttons or docks into
# the sheet; the mode's menu changes only the next leg; a style from it is the whole route's, and a leg with its
# own keeps it; More does what it says; Show the whole route is in the map's column; undo and redo from the first
# render (#241); a touch tap on a header control that re-renders itself leaves the sheet as it was (#251); a long
# route's numbers apart at 360 px and 200 % (#242). Desktops: the toolbar on the panel's edge, side or bottom,
# narrow or wide, folding before the map's buttons; its keys, its tooltips, More and Done. Straight legs: no routing.
TB_ROUTE = """(async (pts) => {
  const p = polku.planner; p.setActive(true); p.clear(); p.setMode('line');
  for (const q of pts) p.addPoint(q);
  for (let k = 0; k < 100 && !p.analysis; k++) await new Promise((r) => setTimeout(r, 100));
  p.setMode('auto');
  await new Promise((r) => setTimeout(r, 300));
  return !!p.analysis;
})"""
TB_PTS = [[23.81, 61.512], [23.82, 61.515], [23.835, 61.52]]
TB_DUPES = """(async () => { const p = polku.planner; p.toggleMore(); await new Promise((r) => setTimeout(r, 80));
  const name = (t) => t.trim().replace(/…$/, '');
  const bar = [...p.tools.querySelectorAll('button')].filter((b) => !b.hidden && b.offsetParent).map((b) => name(b.getAttribute('aria-label') || b.textContent));
  const more = [...document.querySelectorAll('.menu-pop .menu-item')].map((b) => name(b.querySelector('span').firstChild.textContent));
  p.closeMore(); return { bar, more, both: more.filter((m) => bar.includes(m)) }; })()"""
# where a control is, and whether something else is over its middle
TB_AT = """((sel) => { const el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!el || !el.offsetParent) return null;
  const b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, top = document.elementFromPoint(x, y);
  return { x, y, w: b.width, h: b.height, clear: !!top && (el === top || el.contains(top)) }; })"""
TB_PHONE = """(async () => {
  const p = polku.planner, errs = [], wait = (ms) => new Promise((r) => setTimeout(r, ms)), txt = (e) => e.textContent.trim();
  const fit = document.getElementById('btn-fit');
  // #241: the start, before anything is drawn: undo and redo can't do anything, nor can Show the whole route
  p.setActive(true); await wait(300);
  for (const k of ['undo', 'redo']) if (p.els[k].offsetParent && !p.els[k].disabled) errs.push(`${k} looks ready at the start`);
  if (!p.els.fit.disabled) errs.push('Show the whole route looks ready at the start');
  if (!fit.hidden) errs.push('Show the whole route is in the map’s column with no route');
  // a route: undo is ready, redo isn't; Show the whole route is in the map's column
  if (!(await (""" + TB_ROUTE + """)(""" + json.dumps(TB_PTS) + """))) return ['no route'];
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
        pg.c.send('Network.setBlockedURLs', {'urls': ['*traficom.fi*']}, pg.s)
        pg.open_app({'activity': sport, 'timeline': True}, {'polku:winter': '"off"', 'polku:plannerDock': json.dumps(dock)})
        pg.js("import(location.origin + '/js/trails.js').then((T) => { T.holdFetches(); return true; })")
        pg.js("new Promise((ok) => { const t0 = Date.now(), go = () => !polku.state.timeline || !document.querySelector('#wx-bar').hidden || Date.now() - t0 > 30000 ? ok(true) : setTimeout(go, 100); go(); })")
        return pg

    def at(pg, sel):
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

    def tap(pg, sel, name):
        b = at(pg, sel)
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

    def item(pg, label):
        return pg.js(f"(() => {{ const b = [...document.querySelectorAll('.menu-pop .menu-item')].find((x) => x.textContent.trim().startsWith({json.dumps(label)})); if (b) b.dataset.tbPick = '1'; return !!b; }})()")

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
                c = pg.js("({ n: polku.planner.points.length, toast: document.querySelector('#toast').textContent, undo: !polku.planner.els.undo.disabled, fit: document.getElementById('btn-fit').hidden })")
                if c['n'] or 'Route cleared' not in c['toast'] or not c['undo'] or not c['fit']:
                    fails.append(f'{name}: Clear route: {c}')
                tap(pg, '#toast .toast-act', f'{name}: the note’s Undo')
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
            pg.js("new Promise((ok) => { const go = () => polku.planner.points.length ? ok(true) : setTimeout(go, 100); go(); })")
            pg.js("polku.planner.setActive(true); true")
            time.sleep(0.4)
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
        fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
        pg.close()

    # ---------------------------------------------------------------- desktops, by mouse and keys
    pg = page(1440, 900, False)
    name = '1440x900'
    pg.js(f"({TB_ROUTE})({json.dumps(TB_PTS)})", timeout=60000)
    pg.js(SETTLED)
    ON_EDGE = """(() => { const p = polku.planner, b = p.tools.getBoundingClientRect(), r = p.panel.getBoundingClientRect(), c = document.getElementById('map-ctrls').getBoundingClientRect();
      const side = p.layout() === 'side', level = c.top < b.bottom + 8;
      return { side, folds: [...p.tools.classList].filter((k) => /^fold/.test(k)), edge: side ? Math.abs(b.left - r.right) <= 1 && Math.abs(b.top - r.top) <= 1 : Math.abs(b.bottom - r.top) <= 1 && Math.abs(b.left - r.left) <= 1,
        clear: b.right <= (level ? c.left - 12 : innerWidth - 12) + 0.5, below: b.top >= document.querySelector('.topbar').getBoundingClientRect().bottom - 0.5,
        active: [...p.tools.querySelectorAll('.tb-modes [aria-checked=true] span')].some((s) => s.offsetParent) }; })()"""
    for label, js in (('the side panel', 'true'), ('the side panel, wide', "polku.planner.panel.style.setProperty('--pl-w', '640px'), true"),
                      ('the panel at the bottom', "polku.planner.panel.style.removeProperty('--pl-w'), polku.planner.setDock('bottom'), true")):
        pg.js(js)
        time.sleep(0.5)
        e = pg.js(ON_EDGE)
        if not (e['edge'] and e['clear'] and e['below'] and e['active']) or (label == 'the side panel' and e['folds']):
            fails.append(f'{name} {label}: the toolbar {e}')
    pg.js("polku.planner.setDock('left'); true")
    time.sleep(0.5)
    # the keys: P, S, W pick the mode; nothing else changes
    for k, code, vk, mode in (('s', 'KeyS', 83, 'line'), ('w', 'KeyW', 87, 'water'), ('p', 'KeyP', 80, 'auto')):
        key(pg, k, code, vk)
        got = pg.js("({ mode: polku.planner.mode, checked: polku.planner.tools.querySelector('.tb-modes [aria-checked=true]').dataset.mode })")
        if got['mode'] != mode or got['checked'] != mode:
            fails.append(f'{name}: the key {k.upper()}: {got}')
    # a tooltip on the pointer, with the name and the key
    b = at(pg, '#pl-tools [aria-label="Show the whole route"]')
    if b:
        pg.c.send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': b['x'], 'y': b['y'], 'button': 'none'}, pg.s)
        time.sleep(0.9)
        tip = pg.js("(() => { const t = document.getElementById('tip'); return t && !t.hidden ? t.textContent : ''; })()")
        if 'Show the whole route' not in tip or 'F' not in tip:
            fails.append(f'{name}: the tooltip of Show the whole route: “{tip}”')
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
    pg.js("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); polku.planner.routeName = ''; true")
    d = dupes(pg, name)
    # (the next leg's sport, B of #233, takes the room Save offline and Clear route had: they're in More, checked below)
    if 'Show the whole route' not in d['bar'] or 'Export GPX' not in d['bar']:
        fails.append(f"{name}: room on the toolbar, but it lacks Show the whole route or Export GPX: {', '.join(d['bar'])}")
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
    # Done: the planner closes, and Show the whole route is in the map's column
    click(pg, '#pl-tools .done', f'{name}: Done')
    d = pg.js("({ active: polku.planner.active, tools: polku.planner.tools.hidden, fit: !document.getElementById('btn-fit').hidden })")
    if d['active'] or not d['tools'] or not d['fit']:
        fails.append(f'{name}: after Done: {d}')
    fails += [f'{name} console: {e[:160]}' for e in pg.errors()]
    pg.close()
    # a narrow desktop: the toolbar folds before the map's buttons, and the mode in use keeps its name
    pg = page(1024, 768, False)
    pg.js(f"({TB_ROUTE})({json.dumps(TB_PTS)})", timeout=60000)
    time.sleep(0.6)
    e = pg.js(ON_EDGE)
    if not (e['edge'] and e['clear'] and e['active']):
        fails.append(f'1024x768: the toolbar {e}')
    d = dupes(pg, '1024x768')
    if 'Show the whole route' not in d['bar'] + d['more']:
        fails.append('1024x768: Show the whole route is neither on the toolbar nor in More')
    fails += [f'1024x768 console: {e[:160]}' for e in pg.errors()]
    pg.close()
    print(f"{'ok  ' if not fails else 'FAIL'} the toolbox and the header (25a): phones, desktops, #241, #242, #251" + ''.join(f'\n     - {f}' for f in fails), flush=True)
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
  // the map you can see: below the top bar, above the sheet and what floats over it, beside the side panel
  const free = () => {
    const bar = $('.topbar').getBoundingClientRect(), pl = $('#planner').getBoundingClientRect(), side = p.layout() === 'side';
    const over = ['#pl-tools:not(.docked)', '#wx-bar'].map((s) => $(s)).filter((e) => e && !e.hidden && getComputedStyle(e).display !== 'none').map((e) => e.getBoundingClientRect());
    return { top: Math.max(bar.bottom, ...over.filter(() => side).map((r) => r.bottom)) + 10, bottom: side ? innerHeight - 20 : Math.min(pl.top, ...over.map((r) => r.top)) - 10, left: side ? pl.right + 20 : 20, right: $('#map-ctrls').getBoundingClientRect().left - 20 };
  };
  const onMap = (x, y) => document.elementFromPoint(x, y) === map.getCanvas();
  // a spot of the map you can see, a share of the way across and down it
  T.spot = async (fx, fy) => { await settled(); const f = free(), x = f.left + (f.right - f.left) * fx, y = f.top + (f.bottom - f.top) * fy; return onMap(x, y) ? { x, y } : null; };
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
    if (w.scrollHeight > w.clientHeight + 1 && p.panel.getBoundingClientRect().height < room) err(`${what}: the view is cut by ${w.scrollHeight - w.clientHeight} px though the sheet has room`);
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
      if (q.x > f.left + 20 && q.x < f.right - 20 && q.y > f.top + 20 && q.y < f.bottom - 20 && onMap(q.x, q.y) && map.queryRenderedFeatures([[q.x - 3, q.y - 3], [q.x + 3, q.y + 3]], { layers: ['lipas-route'] }).some((x) => `${x.properties.type}/${x.properties.lipasId}` === r.key)) return { x: q.x, y: q.y };
    }
    err('no spot on the other marked route in view');
    return null;
  };
  T.markedTapped = async () => {
    await until(() => M().list[M().on]?.key === T.other, 3000);
    if (M().list[M().on]?.key !== T.other) err(`a tap on the other route picked ${M().list[M().on]?.key}`);
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
            pg.c.send('Network.setBlockedURLs', {'urls': ['*traficom.fi*']}, pg.s)
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

GROUPS = [
    ('radar', [radar], 'fixed FMI rain-rate units, palette order, dry/no-data and reflectivity fallback (recorded/mocked)'),
    ('weather', [weather_requests], 'forecast requests: cold zoom-out waits, cached and pending cells do not consume the budget (#298)'),
    ('changelog', [changelog], 'release notes, retry, safe rendering, keyboard, route preservation and real worker offline'),
    ('pacing', [pacing], 'calls made together go out paced and counted (mocked services, a fake clock)'),
    ('layers', [layers], 'the Layers panel in every sport'),
    ('trails', [trails, uphill_late], 'the trail details (from a recorded tile), and the uphill colours when the terrain comes late (mocked)'),
    ('header', [header_fit], 'the planner header fitting its sheet'),
    ('lipas', [lipas], 'LIPAS search and riding a LIPAS route (recorded answers)'),
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
    ('detour', [detour], 'a route that goes round a way marked private: Heads-up, the short cut, the moved points (mocked BRouter and tiles)'),
    ('shortcut', [shortcut], 'Short cuts ok: Polku\'s profile, Short cut from Heads-up, Undo, share links, a failed upload (mocked BRouter and tiles)'),
    ('otherways', [otherways], 'other ways for a new leg: one after a pause and a second later, none while adding points or on a short leg, the way before as a ghost, links, Undo (mocked BRouter)'),
    ('flow', [flow], 'the route\'s glow and moving chevrons: they move, survive a style change, stop with reduced motion, the switch off or left alone'),
    ('loops', [loops], 'round trips on the water, More loops (recorded fairways, a fixed wind)'),
    ('fit', [fit_phone], 'phones: the route framed above the sheet at every size, loops tapped on the map (mocked BRouter)'),
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
    ('panels', [panels], 'phones: Settings and all layers over the planner at every size, on screen, scrolling and closing by touch (#240)'),
    ('column', [column_early], 'phones: the map\'s column in its place from its first frame, the timeline on and the map\'s load held back (#292)'),
    ('sportmenu', [sport_menu], 'the sport pill\'s menu: a mouse click after its hover keeps it open, a second click, Escape and a click outside close it, touch and the keyboard (#245)'),
    ('toolbox', [toolbox], 'the planner\'s toolbox and header (25a): phones and desktops, the mode\'s menu, More, the keys, tooltips; #241, #242, #251'),
    ('start', [start], 'the start (A with 25b), at four sizes: the ways to begin and their sport, Draw it and its style, Round trip and Where I am, Marked routes and their states, four points in four taps, loops made and picked on the map (mocked LIPAS and BRouter; #232, #109, #89, #281, #306)'),
    ('nextleg', [nextleg], 'the next leg (B of #233): its sport and speed in the drawing menu (touch) and on the toolbar (mouse), the drawing button, Draw it, Go › Time, a point on open water (not a bridge or the shore; the ice in winter), the craft in the start\'s sport menu, Settings\' speeds by sport (#87)'),
    ('button3d', [button3d], 'the 3D button in the map\'s column (#226): mouse, keyboard, touch, reload, Layers\' switch in step, the column on phones, the quick drawer\'s tiles per sport'),
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
