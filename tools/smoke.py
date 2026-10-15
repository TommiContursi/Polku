#!/usr/bin/env python3
"""Smoke test for Polku's layout: no overlapping controls, no console errors, planner states work.

  python3 tools/smoke.py            # all viewports
  python3 tools/smoke.py 390x844    # just one size
  python3 tools/smoke.py layers     # just the Layers panel in every sport
  python3 tools/smoke.py trails     # just the trail details (from a recorded tile)
  python3 tools/smoke.py header     # just the planner header fitting its sheet
  python3 tools/smoke.py lipas      # just LIPAS search and riding a LIPAS route (recorded answers)
  python3 tools/smoke.py water      # just the paddling router's costs (recorded fairways, a fixed wind)
  python3 tools/smoke.py multi      # just multisport: a sport per leg, changeovers, share links (straight legs)
  python3 tools/smoke.py routemenu  # just clicks and taps on the route (straight legs), and LIPAS over trails
  python3 tools/smoke.py routebits  # snapping, the sport strip, distance marks, the sun (no routing)
  python3 tools/smoke.py stops      # stops and nights: breaks, nights, days, the gear check, share links (straight legs)
  python3 tools/smoke.py loops      # round trips on the water, More loops (recorded fairways, a fixed wind)
  python3 tools/smoke.py sports     # changing the sport with a route drawn: the route keeps its sports, Route it as, Undo
  python3 tools/smoke.py winter     # winter on the map: Auto / On / Off, winter ways (a recorded tile), FMI snow, ski tracks

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


# Stops and nights: a break and a night on via points (straight legs, no routing). The night
# lasts until its morning hour; the trip gets days; the bike left at a changeover is in
# Heads-up until it's taken along; a night too short to sleep is too; stops survive a drag,
# undo, the share link (st=, cg=) and the saved route.
STOPS = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), errs = [];
  const P = await import(location.origin + '/js/planner.js');
  const S = await import(location.origin + '/js/stops.js');
  const n = await import(location.origin + '/js/net.js');
  const p = polku.planner;
  p.setActive(true);
  p.clear();
  p.setMode('line');
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
  // the Weather button while planning opens the planner's weather, and the section shows itself
  document.querySelector('#btn-time').click();
  await wait(150);
  if (!p.sec.depart.el.classList.contains('sec-flash')) errs.push('the Weather button: Departure & weather not highlighted');
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
        if not only or 'trails' in only:
            ok = trails(chrome) and ok
        if not only or 'header' in only:
            ok = header_fit(chrome) and ok
        if not only or 'lipas' in only:
            ok = lipas(chrome) and ok
        if not only or 'water' in only:
            ok = water(chrome) and ok
        if not only or 'multi' in only:
            ok = multi(chrome) and ok
        if not only or 'routemenu' in only:
            ok = route_menu(chrome) and ok
        if not only or 'routebits' in only:
            ok = route_bits(chrome) and ok
        if not only or 'stops' in only:
            ok = stops(chrome) and ok
        if not only or 'loops' in only:
            ok = loops(chrome) and ok
        if not only or 'winter' in only:
            ok = winter(chrome) and ok
        if not only or 'sports' in only:
            ok = sport_switch(chrome) and ok
        for w, h, phone, bottom in VIEWPORTS:
            if only and f'{w}x{h}' not in only:
                continue
            ok = check(chrome, w, h, phone, bottom) and ok
    finally:
        chrome.close()
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
