#!/usr/bin/env python3
"""Before/after screenshots of Polku for pull requests.

  python3 tools/shoot.py OUTDIR LABEL [scene ...]     # e.g. shots before   (on main)
  python3 tools/shoot.py OUTDIR LABEL --list          #      shots after    (on the branch)

Needs the dev server (python3 serve.py) and Google Chrome. Routes come from
tools/fixtures, so no routing requests are made (paddle scenes use Polku's own
water router, which needs only map tiles). Writes OUTDIR/LABEL-SCENE.png.
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import Chrome  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = lambda name: open(os.path.join(HERE, 'fixtures', name)).read()

# press on the middle of the first leg and pull it aside (mouse, or hold-then-drag on touch); no release
DRAG = ("""(async () => {
  const p = polku.planner, map = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const c = p.legs[0].result.coords, q = map.project(c[Math.floor(c.length / 2)]);
  const cv = map.getCanvas(), R = cv.getBoundingClientRect(), touch = matchMedia('(pointer: coarse)').matches;
  const fire = (type, x, y) => {
    if (!touch) { cv.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: R.left + x, clientY: R.top + y, button: 0, buttons: 1 })); return; }
    const t = [new Touch({ identifier: 1, target: cv, clientX: R.left + x, clientY: R.top + y })];
    cv.dispatchEvent(new TouchEvent(type === 'mousedown' ? 'touchstart' : 'touchmove', { bubbles: true, cancelable: true, touches: t, targetTouches: t, changedTouches: t }));
  };
  fire('mousedown', q.x, q.y);
  if (touch) await wait(400);
  for (let k = 1; k <= 12; k++) { await wait(20); fire('mousemove', q.x + k * 7, q.y + k * 6); }
})()""")
STANDIN = ("(() => { const p = polku.planner; p.legs[0].result.provider = 'valhalla'; p.legs[1].status = 'waiting';"
           " p.legs[1].wait = { reason: 'limit', until: Date.now() + 60000 }; p.drawRoute(); p.renderWarnings(); p.reveal('warnings'); return true; })()")
WAYPOINTS = "(() => { const p = polku.planner; p.setName && p.setName(1, 'Coffee at Kauppi'); p.reveal(p.sec.points ? 'points' : 'profile'); return true; })()"
SCROLL_END = "(() => { const b = document.querySelector('.sheet-body'); b.scrollTop = b.scrollHeight; return true; })()"
LOOP_JS = ("(async () => { const p = polku.planner; p.setActive(true); if (!p.openLoop) return true; p.openLoop([23.7610, 61.4980]); p.loop.km = 25; p.renderLoop();"
           " await p.generateLoops(); if (p.layout() === 'sheet') p.setSheetState('half', { remember: false }); if (p.sec.loop) p.reveal('loop'); return true; })()")
# the round trip's choices open, Make 3 loops in view (no loops made)
LOOP_OPEN = ("(async () => { const p = polku.planner; p.openLoop(); if (p.layout() === 'sheet') p.setSheetState('half', { remember: false });"
             " await new Promise((r) => setTimeout(r, 600)); const b = document.querySelector('.rt-make, .loop-go .btn.primary'); if (b) b.scrollIntoView({ block: 'center' }); return true; })()")
LOCAL = {'polku:brouterUrl': '"http://localhost:17777/brouter"'}
# Phase 15a: winter on the map at Laajavuori (Jyväskylä; winter set On, the OSM winter ways and
# LIPAS's ski tracks live), its group in Layers, and the snow layer over Lapland (FMI's stations).
WINTER_ON = {'polku:winter': '"on"'}
# the OSM winter ways from the recorded tile (Overpass can take longer than a scene waits)
SEED_WINTER = ("try { const W = await import(location.origin + '/js/winter.js'); const fx = await (await fetch(location.origin + '/tools/fixtures/winter-laajavuori.json')).json();"
               " W.seedWinterTile(fx.x, fx.y, fx.data); } catch (e) { /* before phase 15a */ }")
WAIT = "(async () => { " + SEED_WINTER + " await new Promise((r) => setTimeout(r, 4000)); return true; })()"
WINTER_LAYERS = ("(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); " + SEED_WINTER + " await wait(3000); document.querySelector('#btn-layers').click(); document.querySelector('#quick-layers .qt-more').click(); await wait(500);"
                 " const g = [...document.querySelectorAll('#layers-body .lg-group')].find((x) => /^Winter/.test(x.querySelector('.lg-title').textContent));"
                 " if (g) { g.open = true; g.scrollIntoView({ block: 'start' }); } await wait(600); return true; })()")
SNOW_ON = ("(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); const c = document.querySelector('.tl-layers [data-k=snow]'); if (c) c.click();"
           " await wait(5000); return true; })()")
# Phase 15b: winter on a route through Laajavuori (local BRouter), with a made-up forecast of
# 15 cm of snow at -8 °C put in once the real one is in (it doesn't snow in October). Older code
# has no winter on the route: the same route, as it was.
def WINTER_ROUTE(sec='warnings'):
    return ("(async () => { const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)); " + SEED_WINTER +
            " p.setActive(true); p.clear(); p.setMode('auto'); p.addPoint([25.700, 62.287]); p.addPoint([25.724, 62.259]);"
            " const t0 = Date.now(); while (!(p.legs.every((l) => l.status === 'ok') && p.analysis && (p.analysis.wind || p.analysis.windError)) && Date.now() - t0 < 40000) await wait(300);"
            " const a = p.analysis; if (p.snowOf && a && a.wind) { const n = a.along.length, fill = (v) => new Float32Array(n).fill(v);"
            " a.wind = { ...a.wind, snow: fill(15), snowfall: fill(0.2), temp: fill(-8), precip: fill(0) };"
            " const W = await import(location.origin + '/js/winter.js'); a.winterCls = await W.winterAlong(a);"
            " const snow = p.snowOf(a, a.wind), t = p.timed(a, a.wind.head, snow); a.timeWind = t.total; a.tAtWind = t.tAt; a.waits = t.waits; p.setSnow(a, snow); p.renderAnalysis(); }"
            f" p.setSheetState({json.dumps('full' if sec == 'speed' else 'half')}, {{ remember: false }}); await wait(300); p.fitRoute({{ animate: false }}); p.reveal({json.dumps(sec)}); await wait(700); return true; }})()")
# Phase 14: paddling loops off Kaivopuisto (Polku's own water router, live water data), and
# "More loops" (three more, in other directions) for the MTB loops above. Older code shows
# what it did then: no paddling round trips, and "Other directions" in place of "More loops".
def LOOP_AT(sport, ll, km, more=False):
    return ("(async () => { const p = polku.planner; p.setActive(true); if (!p.openLoop) return true; p.openLoop(" + json.dumps(ll) + f"); p.loop.km = {km}; p.renderLoop();"
            " await p.generateLoops();" + (" await p.generateLoops({ more: true });" if more else "")
            + " if (p.layout() === 'sheet') p.setSheetState('half', { remember: false }); if (p.sec.loop) p.reveal('loop');"
            " await new Promise((r) => setTimeout(r, 400)); const m = document.querySelector('.loop-more'); if (m && " + json.dumps(more) + ") m.scrollIntoView({ block: 'nearest' }); return true; })()")
STYLE_JS = ("(async () => { const p = polku.planner; if (!p.setStyle) return true; p.setStyle({ p: 'flowy', v: {}, wet: 'auto' });"
            " await new Promise((r) => setTimeout(r, 4500)); p.reveal('style'); return true; })()")
LEG_STYLE_JS = ("(async () => { const p = polku.planner; if (!p.setStyle) { p.openPointMenu(0, p.markers[0]); return true; } p.setStyle({ p: 'transfer', v: {}, wet: 'auto' }, 0);"
                " await new Promise((r) => setTimeout(r, 4500)); if (p.layout() === 'side') p.reveal('points'); await new Promise((r) => setTimeout(r, 600)); p.openPointMenu(0, p.markers[0]); return true; })()")
# the Layers panel scrolled to a group (after optionally pressing a trail colours choice)
def LAYERS_AT(group, colours=None):
    press = (f"const b = [...document.querySelectorAll('#layers-body .seg button')].find((x) => x.textContent === {json.dumps(colours)}); b && b.click(); await wait(800);"
             if colours else '')
    return ("(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); document.querySelector('#btn-layers').click(); document.querySelector('#quick-layers .qt-more').click(); await wait(400); " + press +
            f" const s = [...document.querySelectorAll('#layers-body summary')].find((x) => new RegExp({json.dumps(group)}).test(x.textContent)); s && s.scrollIntoView({{ block: 'start' }}); return true; }})()")


# Trail details from the recorded Tykkikallio tile (Overpass held back, so the
# neighbours just stay unloaded), then a view; `extra` runs after (open a popup, the key…). On a branch
# without trail details the seeding just does nothing.
def TRAILS_AT(lon, lat, zoom, extra=''):
    return ("(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); try { const T = await import(location.origin + '/js/trails.js');"
            " const fx = await (await fetch(location.origin + '/tools/fixtures/trails-tykkikallio.json')).json();"
            " T.holdFetches(); T.seedTile(4682, 2273, fx); } catch (e) { /* main */ }"
            f" polku.map.jumpTo({{ center: [{lon}, {lat}], zoom: {zoom} }}); await wait(1800); try {{ {extra} }} catch (e) {{ /* main */ }} return true; }})()")


TRAIL_KEY = ("document.querySelector('#btn-layers').click(); document.querySelector('#quick-layers .qt-more').click(); await wait(400);"
             " const g = [...document.querySelectorAll('#layers-body summary')].find((x) => /^Trails/.test(x.textContent)); g.parentElement.open = true;"
             " const k = g.parentElement.querySelector('.lg-key'); if (k) k.open = true;"
             " const h4 = [...g.parentElement.querySelectorAll('h4')].find((x) => /Trail details/.test(x.textContent));"
             " const t = [...g.parentElement.querySelectorAll('.tg')].find((x) => /Trail details/.test(x.textContent));"
             " (t || g).scrollIntoView({ block: 'start' }); if (h4 && innerWidth > 700) h4.scrollIntoView({ block: 'center' });")
TRAIL_POPUP = ("const m = polku.map; const f = m.queryRenderedFeatures({ layers: ['td-points'] }).find((x) => x.properties.kind === 'tree');"
               " const p = m.project(f.geometry.coordinates); m.fire('click', { point: p, lngLat: m.unproject(p), originalEvent: new MouseEvent('click') }); await wait(600);")

# the recorded tile only, before a route loads (its analysis reads the tile)
TRAILS_PRE = ("(async () => { try { const T = await import(location.origin + '/js/trails.js'); T.holdFetches();"
              " T.seedTile(4682, 2273, await (await fetch(location.origin + '/tools/fixtures/trails-tykkikallio.json')).json()); } catch (e) { /* main */ } return true; })()")


# the route's trail details in, then a planner section (and a profile colour, where the branch has it)
def TRAIL_ROUTE(sec='warnings', mode=None):
    show = (f" const C = await import(location.origin + '/js/chart.js'); if (C.COLOR_MODES[{json.dumps(mode)}]) p.showMode({json.dumps(mode)});"
            " const t = document.querySelector('#planner input[role=switch]'); if (t && !t.checked) t.click();") if mode else ''
    return ("(async () => { const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)); const t0 = Date.now();"
            " while (!(p.analysis && (p.analysis.trailMore || !('trailWarn' in p.analysis))) && Date.now() - t0 < 8000) await wait(200);"
            f" p.reveal({json.dumps(sec)});{show} await wait(400); return true; }})()")


# phase 12c: LIPAS in search, its card, riding it. LIPAS's answers for the search and
# the route come from a recorded file (the map's own LIPAS lines load live); older
# code without LIPAS search gets the old card by a click on the route instead.
LIPAS_SEARCH = ("const wait = (ms) => new Promise((r) => setTimeout(r, ms));"
                " try { const L = await import(location.origin + '/js/lipas.js'); if (L.seedLipas) { const fx = await (await fetch(location.origin + '/tools/fixtures/lipas-multamaki.json')).json();"
                " L.seedLipas((url) => (/CQL_FILTER=id%3D615379/.test(url) ? fx.place : /lipas_kaikki_reitit/.test(url) ? fx.routes : /lipas_kaikki_pisteet/.test(url) ? fx.stops : null)); } } catch (e) { /* main */ }"
                " const i = document.querySelector('#search-input'); i.focus(); i.value = 'multam'; i.dispatchEvent(new Event('input')); await wait(3500);")
LIPAS_CARD = (LIPAS_SEARCH +
              " const li = [...document.querySelectorAll('#search-results li[data-kind=routes]')].find((x) => /MTB-lenkki/.test(x.textContent));"
              " if (li) { li.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); await wait(2500); }"
              " else { i.blur(); await wait(300); const m = polku.map; m.jumpTo({ center: [25.8945, 62.4495], zoom: 13 }); await wait(2500);"
              " const f = m.queryRenderedFeatures({ layers: ['lipas-route'] }).find((x) => /MTB-lenkki/.test(x.properties.name)); if (f) { const c = f.geometry.coordinates; const q = m.project(c[Math.floor(c.length / 2)]);"
              " m.fire('click', { point: q, lngLat: m.unproject(q), originalEvent: new MouseEvent('click') }); await wait(1200); } }")
LIPAS_RIDE = (LIPAS_CARD +
              " const b = [...document.querySelectorAll('.polku-popup button')].find((x) => /Ride this route/.test(x.textContent)); if (!b) return true; b.click();"
              " const p = polku.planner, t0 = Date.now(); while (!(p.analysis && p.analysis.wind) && Date.now() - t0 < 15000) await wait(250);"
              " if (p.layout() === 'sheet') p.setSheetState('half', { remember: false }); await wait(900);")


# phase 13: a paddling leg over the Särkän väylä shipping lane (Kaivopuisto → Suomenlinna),
# fairways and marks from a recorded file, a fixed 10 m/s southerly; older code routes it its old way
WATER_SEED = ("(async () => { try { const D = await import(location.origin + '/js/waterdata.js'); if (D.seedWater) {"
              " const fx = await (await fetch(location.origin + '/tools/fixtures/water-helsinki.json')).json(); const fc = (f) => ({ type: 'FeatureCollection', features: f });"
              " D.seedWater((box, want) => ({ fairways: want.fairways ? fc(fx.fairways) : fc([]), hazards: want.hazards ? fc(fx.marks) : fc([]), wind: want.wind ? { speed: 10, gust: 14, dir: 180 } : null, missing: [] })); } } catch (e) { /* main */ } return true; })()")
WATER_LEG = [[24.9585, 60.1540], [24.9800, 60.1480]]
NAUTICAL_ON = "(() => { polku.set && polku.set({ overlays: { ...polku.state.overlays, nautical: true } }); return true; })()"


# phase 13b: bike from Tampere's centre to the Pyynikki shore, paddle to Viikinsaari, run on the island
# (routing on a local BRouter: tools/brouter-local.sh); main draws the same with an "Over water" leg
def MULTI_JS(sec):
    return ("(async () => { const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)); p.setActive(true); p.clear(); p.setMode('auto');"
            " for (const q of [[23.7610, 61.4980], [23.7345, 61.4925], [23.7560, 61.4740], [23.7625, 61.4718]]) p.addPoint(q);"
            " if (p.setLegSport) { p.setLegSport(1, 'paddle'); p.setLegSport(2, 'run'); } else p.setLegMode(1, 'water');"
            " const t0 = Date.now(); while (!(p.legs.every((l) => l.status === 'ok') && p.analysis && p.analysis.wind) && Date.now() - t0 < 40000) await wait(300);"
            f" p.setSheetState({json.dumps('full' if sec == 'speed' else 'half')}, {{ remember: false }}); await wait(300); p.fitRoute({{ animate: false }});"
            f" p.reveal({json.dumps(sec)}); await wait(400);"
            " const r = document.querySelector('.speed-row.sub.head'); if (r && " + json.dumps(sec) + " === 'speed') r.scrollIntoView({ block: 'center' }); await wait(300); return true; })()")


# clicks and taps on the route: a LIPAS route over a trail; a tap, a click or a right-click on the line, a click on a leg's handle
LIPAS_PICK = ("(async () => { const m = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms)); await wait(2500);"
              " const f = m.queryRenderedFeatures({ layers: ['lipas-route'] }).find((x) => /MTB-lenkki/.test(x.properties.name)); if (!f) return true;"
              " const c = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates[0]; const q = m.project(c[Math.floor(c.length / 3)]);"
              " m.fire('click', { point: q, lngLat: m.unproject(q), originalEvent: new MouseEvent('click') }); await wait(1500); return true; })()")
def LINE_PICK(how):
    return ("(async () => { const p = polku.planner, m = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms));"
            " const c = p.legs[1].result.coords, ll = c[Math.floor(c.length / 2)], q = m.project(ll);"
            + {'tap': " p.lastTouchAt = Date.now(); m.fire('click', { point: q, lngLat: m.unproject(q), originalEvent: new MouseEvent('click') });",
               'click': " m.fire('click', { point: q, lngLat: m.unproject(q), originalEvent: new MouseEvent('click') });",
               'handle': " const g = p.ghosts.find((x) => x.getElement().isConnected && !x.getElement().hidden); if (g) g.getElement().click();",
               'right': " m.fire('contextmenu', { point: q, lngLat: m.unproject(q), originalEvent: new MouseEvent('contextmenu') });",
               'hover': " const r = m.getCanvas().getBoundingClientRect(); m.fire('mousemove', { point: q, lngLat: m.unproject(q), originalEvent: new MouseEvent('mousemove', { clientX: r.left + q.x, clientY: r.top + q.y }) });"}[how]
            + " await wait(700); return true; })()")


# points clicked beside the trails at Konnevesi (a test spot), snapped onto them (local BRouter)
SNAP_JS = ("(async () => { const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)); p.setActive(true); p.clear(); p.setMode('auto');"
           " for (const q of [[25.2135, 61.8735], [25.2190, 61.8712], [25.2160, 61.8690], [25.2240, 61.8725]]) p.addPoint(q);"
           " const t0 = Date.now(); while (!(p.legs.every((l) => l.status === 'ok') && p.analysis) && Date.now() - t0 < 30000) await wait(300);"
           " if (p.setSheetState) p.setSheetState('peek', { remember: false }); polku.map.jumpTo({ center: [25.2190, 61.8715], zoom: 15.2 }); await wait(1200); return true; })()")
# the multisport route, its profile coloured by sport (on the map too), the strip under it
def MULTI_SPORT_JS(sec='profile', extra=''):
    return MULTI_JS(sec).replace("return true; })()", ("if (p.pickColor) { p.pickColor('sport'); p.setColorOnMap(true); } " + extra + " await wait(600); return true; })()"))
# An overnighter in Nuuksio (local BRouter): leave at 15:00, a break at Mustalampi, the night at
# Holma-Saarijärvi's lean-to (on at 08:30), back to Haukkalampi. `then`: what to show.
def STOPS_JS(sec, then=''):
    return ("(async () => { const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)); p.setActive(true); p.clear(); p.setMode('auto');"
            " for (const q of [[24.5397, 60.3089], [24.5124, 60.3061], [24.4956, 60.3013], [24.4888, 60.3115], [24.5397, 60.3089]]) p.addPoint(q);"
            " const hr = new Date().getHours(); let k = (15 - hr + 24) % 24; if (k < 1) k += 24; p.setStartOffset(k);"
            " let t0 = Date.now(); while (!(p.legs.every((l) => l.status === 'ok') && p.analysis) && Date.now() - t0 < 40000) await wait(300);"
            " if (p.setStop) { p.setStop(1, { min: 45 }); p.setStop(2, { on: 510 }); p.setName(2, 'Holma-Saarijärven laavu'); p.setName(1, 'Mustalampi'); }"
            " t0 = Date.now(); while (!(p.analysis && (p.analysis.wind || p.analysis.windError)) && Date.now() - t0 < 30000) await wait(300);"
            f" p.setSheetState({json.dumps('full' if sec in ('points', 'depart') else 'half')}, {{ remember: false }}); await wait(300); p.fitRoute({{ animate: false }});"
            f" p.reveal({json.dumps(sec)}); await wait(500); {then} return true; }})()")
# the night point's menu, with the places to sleep near it (LIPAS and OpenStreetMap, live)
STAY_MENU = ("if (p.markers[2]) { p.openPointMenu(2, p.markers[2]); await wait(300);"
             " const b = [...document.querySelectorAll('.polku-popup button')].find((x) => /Places to sleep/.test(x.textContent)); if (b) { b.click(); for (let k = 0; k < 80 && /Looking|Still looking/.test(document.querySelector('.stay-list')?.textContent || 'Looking'); k++) await wait(300); } }")
MARKS_JS = "(async () => { const p = polku.planner; if (p.setMarks) p.setMarks({ km: true, time: true }); await new Promise((r) => setTimeout(r, 600)); return true; })()"
# the multisport route leaving an hour before sunset: Heads-up says when it gets dark
SUN_JS = MULTI_JS('warnings').replace("p.setActive(true);", "p.setActive(true); try { const S = await import(location.origin + '/js/sun.js'); const s = S.sunTimes(Date.now() / 1000, [23.761, 61.498]); const k = Math.max(0, Math.round((s.set - Date.now() / 1000) / 3600) - 1); p.setStartOffset(k); } catch (e) { /* main */ }")


DESK = dict(w=1440, h=900, phone=False)
PHONE = dict(w=390, h=844, phone=True)
# the quick layer drawer (#123): Layers, then a step in it (a tile's ›, Edit, More), or the worst case
QUICK = lambda then='': ("(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); document.querySelector('#btn-layers').click(); await wait(400); "
                         + then + " await wait(400); return true; })()")
QUICK_OPTS = lambda tile: QUICK(f"document.querySelector('#quick-layers .qt-opt[data-opts=\"{tile}\"]').click();")
QUICK_EDIT = QUICK("document.querySelector('#quick-layers .qd-edit-btn').click(); await wait(300); document.querySelector('#quick-layers .qt-rm[data-rm=\"wx:rain\"]').click();")
QUICK_ALL = QUICK("document.querySelector('#quick-layers .qt-more').click();")
# Finnish-length labels on every tile, and a dozen more layers on (the strings carry soft hyphens, as phase 18's will)
QUICK_WORST = QUICK("for (const [id, l] of [['trailColors', 'Polkujen vaikeus\\u00advärit'], ['trailDetails', 'Polkujen yksityis\\u00adkohdat'], ['lipasRoutes', 'Viralliset reitit'], ['terrain3d', 'Kolmi\\u00adulotteinen maasto'], ['wx:rain', 'Sade\\u00adtutka']]) { const t = document.querySelector(`#quick-layers .qt-tog[data-tile=\"${id}\"] .qt-l`); if (t) t.firstChild.textContent = l; }")
# the bug sweep: Heads-up with the map's Trail details off (the log comes all the same) and a
# row's ⋯ (hide its kind, correct OpenStreetMap), then the kind hidden; the route menu in a
# short window; phones: the credits opened over the timeline, the summary at 360 px
NO_DETAILS = {'polku:settings': json.dumps({'activity': 'mtb', 'timeline': False, 'trailsByActivity': {'mtb': {'trailDetails': False}}}), 'polku:plannerDock': '"left"'}
ROW_MENU = TRAIL_ROUTE('warnings').replace(" await wait(400); return true; })()",
                                           " await wait(400); const r = [...document.querySelectorAll('[data-sec=warnings] .li-row')].find((x) => /Log across/.test(x.textContent));"
                                           " if (r) { r.scrollIntoView({ block: 'center' }); await wait(200); const m = r.querySelector('.li-more'); if (m) m.click(); } await wait(300); return true; })()")
ROW_HIDDEN = ROW_MENU.replace(" await wait(300); return true; })()", " await wait(300); const h = document.querySelector('.menu-pop .menu-item'); if (h) h.click(); await wait(400);"
                              " const c = document.querySelector('.hidden-kinds'); if (c) c.scrollIntoView({ block: 'center' }); await wait(300); return true; })()")
OPEN_MENU = ("(async () => { polku.planner.els.more.click(); await new Promise((r) => setTimeout(r, 400));"
             " const m = document.querySelector('.menu-pop'); if (m) m.scrollTop = m.scrollHeight; return true; })()")  # scrolled to its end, where it scrolls
# MapLibre opening the credits by itself, as when their text comes in after the map has loaded
CREDITS_REOPEN = ("(async () => { const a = document.querySelector('.maplibregl-ctrl-attrib'); a.classList.remove('maplibregl-compact');"
                  " polku.map.fire('resize'); await new Promise((r) => setTimeout(r, 400)); return true; })()")
OPEN_CREDITS = "(async () => { document.querySelector('.maplibregl-ctrl-attrib-button').click(); await new Promise((r) => setTimeout(r, 400)); return true; })()"

# 22a: the drawer in three tabs, in the side panel: the start (no route), the first click's loop
# offer, the leg you point at, and each tab (older code shows its single list at the same spot)
SIDE = {'polku:plannerDock': '"left"'}
START = ("(async () => { const p = polku.planner; p.setActive(true); p.clear(); if (p.setTab) p.setTab('route');"
         " if (p.layout() === 'sheet') p.setSheetState('half', { remember: false }); await new Promise((r) => setTimeout(r, 600)); return true; })()")
# 25b with A: a way to begin picked (`k`: draw, loop, find), and a control in it pressed (`then`); older code
# shows its start as it was
def WAY(k, then=None):
    return START.replace("return true; })()", f"const w = document.querySelector('.pl-way [data-way={k}]'); if (w) w.click(); await new Promise((r) => setTimeout(r, 900));"
                         + (f" const b = document.querySelector({json.dumps(then)}); if (b) b.click(); await new Promise((r) => setTimeout(r, 900));" if then else '') + " return true; })()")
# the round trip from the ways, with its start tapped on the map (25b, 2026-10-21: the rest of the form comes with it)
RT_TAPPED = WAY('loop').replace(" return true; })()", " const c = polku.map.getCenter(); if (p.loop && p.loop.open && !p.loop.start) p.setLoopStart([+c.lng.toFixed(6), +c.lat.toFixed(6)], 'the spot you tapped');"
                                " await new Promise((r) => setTimeout(r, 900)); return true; })()")
# the first point's peek, a length tapped there (older code: its card on the map, then its round trip)
FIRST_LENGTH = ("(async () => { const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)); p.setActive(true); p.clear(); const c = polku.map.getCenter();"
                " p.addPoint([+c.lng.toFixed(6), +c.lat.toFixed(6)]); await wait(500); const chip = document.querySelector('.pl-way .rt-here .chip');"
                " if (chip) chip.click(); else if (p.openLoop) p.openLoop([c.lng, c.lat]); await wait(700); return true; })()")
START_TIP = START.replace("return true; })()", "const m = polku.map, c = m.getCenter(); m.fire('click', { point: m.project(c), lngLat: c, originalEvent: new MouseEvent('click') });"
                          " await new Promise((r) => setTimeout(r, 700)); return true; })()")
LEG_LIT = ("(async () => { const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)); if (p.setTab) p.setTab('route'); p.reveal('points'); await wait(400);"
           " const r = document.querySelector('.wpl-row[data-i=\"0\"]'); if (r) r.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })); await wait(400); return true; })()")
# #198: the route close up with its chevrons moving (reduced motion off), and the leg under the
# mouse glowing brighter (a real mousemove on the map; older code has no glow)
FLOW_CLOSE = ("(async () => { const p = polku.planner, m = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms)), a = p.analysis;"
              " m.jumpTo({ center: a.pts[Math.floor(a.pts.length * 0.35)], zoom: 15.4, ...(p.viewPadding ? { padding: p.viewPadding() } : {}) }); await wait(300);"
              " await new Promise((ok) => { const t = setTimeout(ok, 8000); if (m.loaded() && m.areTilesLoaded()) ok(); else m.once('idle', () => { clearTimeout(t); ok(); }); }); return true; })()")
FLOW_HOVER = FLOW_CLOSE.replace("return true; })()", "const cv = m.getCanvas(), R = cv.getBoundingClientRect(), W = cv.clientWidth, H = cv.clientHeight;"
                                " const q = a.pts.map((x) => m.project(x)).filter((x) => x.x > W * 0.45 && x.x < W * 0.9 && x.y > 120 && x.y < H - 120)[0];"
                                " if (q) for (let k = 0; k < 3; k++) { cv.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: R.left + q.x, clientY: R.top + q.y + k })); await wait(120); }"
                                " await wait(400); return true; })()")
# #211: other ways for a new leg, hiking in Nuuksio or riding in Raisio (routing goes to a local
# BRouter: tools/brouter-local.sh), on offer and one taken, framed with the route; older code
# draws them later, as see-through ghosts
NUUKSIO = [[24.5800, 60.3100], [24.6050, 60.3220]]
RAISIO = [[22.190, 60.470], [22.215, 60.485]]


def OTHER_WAYS(pick=False, peek=False, pts=NUUKSIO):
    return ("(async () => { const p = polku.planner, m = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms));"
            " p.setActive(true);" + (" if (p.setSheetState) p.setSheetState('peek', { remember: false });" if peek else "") +
            " p.clear(); p.addPoint(" + json.dumps(pts[0]) + "); await wait(300); p.addPoint(" + json.dumps(pts[1]) + ");"
            " for (let k = 0; k < 120 && !(p.alts && p.alts.ways.length >= 2); k++) await wait(100);"
            + (" if (p.alts) { const i = p.alts.ways.findIndex((w) => /^Other way\\n[+]/.test(w.label)); p.pickAlt(i < 0 ? 0 : i); } await wait(300);" if pick else "") +
            " const cs = [p.legs[0].result.coords, ...(p.alts ? p.alts.ways.filter((w) => w.r).map((w) => w.r.coords) : [])].flat();"
            " const xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]);"
            " m.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: p.viewPadding ? p.viewPadding() : 80, duration: 0 });"
            " await wait(1500); return true; })()")


TAB = lambda sec: f"(async () => {{ polku.planner.reveal({json.dumps(sec)}); await new Promise((r) => setTimeout(r, 600)); return true; }})()"

# #72: terrain tiles that don't load, before the route is in: none at all, or (part) the
# route's eastern tile at zoom 14 and every coarser one
def NO_TERRAIN(part=False):
    fail = '+m[1] < 14 || +m[2] === 9276' if part else 'true'
    return ("(() => { const real = window.fetch; window.fetch = (u, i) => { const m = /tiles\\.mapterhorn\\.com\\/(\\d+)\\/(\\d+)\\//.exec(String(u));"
            f" if (m && ({fail})) return Promise.reject(new TypeError('Failed to fetch')); return real(u, i); }}; return true; }})()")

# #88, #89: the fit button with the sheet at full, a GPX import (the Kauppi ride as a track) with
# the planner open at half, and a round-trip loop clicked on its line (its farthest point from
# the start). Older code leaves the full sheet up and the map unmoved, fits the track as if there
# were no planner, and throws the loops away for a new start.
FIT_BUTTON = "(async () => { polku.planner.els.fit.click(); await new Promise((r) => setTimeout(r, 1200)); return true; })()"
GPX_IMPORT = ("(async () => { const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)); p.setActive(true); p.clear(); p.setSheetState('half', { remember: false }); await wait(600);"
              " const s = await (await fetch(location.origin + '/tools/fixtures/route-kauppi-mtb.json')).json(), c = s.legs.flatMap((l) => l.result.coords);"
              " const gpx = `<?xml version=\"1.0\"?><gpx version=\"1.1\"><trk><name>Kauppi</name><trkseg>${c.map(([x, y]) => `<trkpt lat=\"${y}\" lon=\"${x}\"></trkpt>`).join('')}</trkseg></trk></gpx>`;"
              " const input = document.querySelector('#file-input'), dt = new DataTransfer(); dt.items.add(new File([gpx], 'kauppi.gpx')); input.files = dt.files;"
              " input.dispatchEvent(new Event('change', { bubbles: true })); await wait(1500); return true; })()")
LOOP_CLICK = LOOP_JS.replace("return true; })()", "await new Promise((r) => setTimeout(r, 800)); const L = p.loop, k = L.on === 1 ? 2 : 1, r = L.results[k]; if (!r) return true;"
                             " const far = r.line.coords.reduce((m, q) => (Math.hypot(q[0] - L.start[0], q[1] - L.start[1]) > Math.hypot(m[0] - L.start[0], m[1] - L.start[1]) ? q : m));"
                             " const m = polku.map, pt = m.project(far); m.fire('click', { point: pt, lngLat: m.unproject(pt), originalEvent: new MouseEvent('click') });"
                             " await new Promise((r) => setTimeout(r, 1200)); return true; })()")

# Phase 23a: where you are, with a GPS and a compass of the page's own (headless Chrome has
# neither): a fix every second, the phone facing `deg` (the compass keeps talking), or `more`
# for the fix (a speed and a course: moving); then the scene's own steps. Older code shows
# MapLibre's dot.
LOCATE_JS = """(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), oks = [], S = __S__;
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    watchPosition(ok) { oks.push(ok); return oks.length; }, clearWatch() {}, getCurrentPosition(ok) { oks.push(ok); } } });
  const fix = () => { for (const ok of oks) ok({ coords: { longitude: S.ll[0], latitude: S.ll[1], accuracy: 18, altitude: null, altitudeAccuracy: null, speed: 0, heading: null, ...S.more }, timestamp: Date.now() }); };
  const face = () => window.dispatchEvent(new DeviceOrientationEvent(polku.heading ? polku.heading.evt : 'deviceorientationabsolute', { alpha: (360 - S.deg) % 360, beta: 25, gamma: 0, absolute: true }));
  document.querySelector('#btn-locate').click();
  fix();
  if (S.deg != null) setInterval(face, 150);
  setInterval(fix, 1000);
  await wait(1500);
  __THEN__
  return true;
})()"""
KAUPPI = [23.80461, 61.51217]  # on the Kauppi route (tools/fixtures/route-kauppi-mtb.json)
AHEAD = "document.querySelector('#btn-locate').click(); await wait(1500);"
PANNED = "polku.map.panBy([-90, 140], { duration: 0 }); await wait(800);"


def LOCATE(deg=None, more=None, then='', ll=KAUPPI):
    return LOCATE_JS.replace('__S__', json.dumps({'ll': ll, 'deg': deg, 'more': more or {}})).replace('__THEN__', then)


# #118: recorded route geometry and a fixed forecast, for matching before/after views.
COLOURS_PRE = """(async () => {
  const p = polku.planner, restore = p.restoreSnapshot.bind(p);
  p.restoreSnapshot = (s) => { s.legs.forEach((l) => { l.mode = 'fixed'; }); restore(s); };
  p.loadWind = async (a) => { a.windError = true; };
  p.loadTrail = async () => {}; // keep the recorded tags stable for before/after views
  (await import(location.origin + '/js/trails.js')).holdFetches();
  return true;
})()"""
COLOURS_VIEW = """(async () => {
  const p = polku.planner, a = p.analysis, fill = (v) => new Float32Array(a.along.length).fill(v);
  a.wind = { head: fill(3), speed: fill(5), gust: fill(7), dir: fill(180), cross: fill(4), temp: fill(8), precip: fill(0) };
  const pick = p.breakdownKinds?.way?.pick;
  if (pick) pick.click(); else p.showMode('way');
  p.reveal('colours');
  if (p.layout() === 'sheet') p.setSheetState('full', { remember: false });
  await new Promise((r) => setTimeout(r, 600));
  await new Promise((r) => setTimeout(r, 2000));
  const target = p.breakdownKinds?.way?.el || p.sec.colours.el;
  p.els.body.scrollTo({ top: p.els.body.scrollTop + target.getBoundingClientRect().top - p.els.body.getBoundingClientRect().top, behavior: 'instant' });
  return true;
})()"""

# A temporary category preview over a route coloured by a different kind.
CATEGORY_PREVIEW_VIEW = COLOURS_VIEW[:COLOURS_VIEW.index('  const target =')] + """
  const kind = p.breakdownKinds.grade;
  const row = [...kind.legend.querySelectorAll('.bd-item')].find((el) => /^Flat/.test(el.textContent));
  row.dataset.shotHover = 'true';
  p.els.body.scrollTo({ top: p.els.body.scrollTop + kind.el.getBoundingClientRect().top - p.els.body.getBoundingClientRect().top - 30, behavior: 'instant' });
  return true;
})()"""

MARKS_VIEW = """(async () => {
  const p = polku.planner;
  p.reveal('onmap');
  if (p.layout() === 'sheet') p.setSheetState('half', { remember: false });
  await new Promise((r) => setTimeout(r, 600));
  p.sec.onmap.el.scrollIntoView({ block: 'start' });
  return true;
})()"""
DEPARTURE_VIEW = """(async () => {
  const p = polku.planner;
  p.setTab('check'); p.toggleSection('speed', false);
  if (p.layout() === 'sheet') p.setSheetState('half', { remember: false });
  document.querySelector('.sum-time').click();
  await new Promise((r) => setTimeout(r, 900));
  return true;
})()"""

SCENES = {
    'desk-route-times': dict(DESK, timeline=True, route='route-kauppi-mtb.json', pre=COLOURS_PRE, js=MARKS_VIEW),
    'phone-route-times': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='half', pre=COLOURS_PRE, js=MARKS_VIEW),
    'desk-departure-link': dict(DESK, timeline=True, route='route-kauppi-mtb.json', pre=COLOURS_PRE, js=DEPARTURE_VIEW),
    'phone-departure-link': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='half', pre=COLOURS_PRE, js=DEPARTURE_VIEW),
    'desk-category-preview': dict(DESK, timeline=True, route='route-kauppi-mtb.json', pre=COLOURS_PRE, js=CATEGORY_PREVIEW_VIEW, hover='[data-shot-hover=true]'),
    'phone-category-preview': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='full', pre=COLOURS_PRE, js=CATEGORY_PREVIEW_VIEW, hover='[data-shot-hover=true]'),
    'desk-route-colours': dict(DESK, timeline=True, route='route-kauppi-mtb.json', pre=COLOURS_PRE, js=COLOURS_VIEW),
    'phone-route-colours': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='full', pre=COLOURS_PRE, js=COLOURS_VIEW),
    # #88, #89: the fit button at full, a GPX import over the planner, a loop clicked on the map
    'phone-fit-full': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='full', js=FIT_BUTTON),
    'phone-gpx-import': dict(PHONE, timeline=False, hash='#12/61.4980/23.7610', js=GPX_IMPORT),
    'desk-gpx-import': dict(DESK, timeline=False, hash='#12/61.4980/23.7610', storage=SIDE, js=GPX_IMPORT),
    'phone-loop-click': dict(PHONE, timeline=False, hash='#12/61.4980/23.7610', storage=LOCAL, js=LOOP_CLICK),
    'desk-loop-click': dict(DESK, timeline=False, hash='#12/61.4980/23.7610', storage=LOCAL, js=LOOP_CLICK),
    # 23a: the dot's cone (the compass; on the desktop, the GPS's course while moving), facing
    # ahead, Follow after a pan, the planner open with a route, and the same in the dark
    'phone-locate': dict(PHONE, timeline=False, activity='hike', js=LOCATE(deg=35)),
    'phone-locate-ahead': dict(PHONE, timeline=False, activity='mtb', js=LOCATE(deg=35, then=AHEAD)),
    'phone-locate-free': dict(PHONE, timeline=False, activity='gravel', js=LOCATE(deg=35, then=PANNED)),
    'phone-locate-planner': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='peek', js=LOCATE(deg=35)),
    'phone-locate-dark': dict(PHONE, timeline=False, activity='hike', dark=True, base='night', js=LOCATE(deg=35)),
    'phone-locate-paddle': dict(PHONE, timeline=False, activity='paddle', js=LOCATE(deg=300, ll=[23.7600, 61.5250])),  # on Näsijärvi
    'desk-locate': dict(DESK, timeline=False, activity='hike', js=LOCATE(more={'speed': 3, 'heading': 60})),
    'desk-locate-planner': dict(DESK, timeline=True, route='route-kauppi-mtb.json', js=LOCATE(more={'speed': 3, 'heading': 60})),
    'desk-locate-free': dict(DESK, timeline=False, activity='mtb', js=LOCATE(more={'speed': 3, 'heading': 60}, then=PANNED)),
    'desk-locate-dark': dict(DESK, timeline=False, activity='hike', dark=True, base='night', js=LOCATE(more={'speed': 3, 'heading': 60})),
    # #72: no terrain, and part of it missing (the summary, the profile, Heads-up)
    'desk-no-terrain': dict(DESK, timeline=True, route='route-kauppi-mtb.json', pre=NO_TERRAIN(), js=TAB('warnings')),
    'phone-no-terrain': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='half', pre=NO_TERRAIN(), js=TAB('warnings')),
    'desk-part-terrain': dict(DESK, timeline=True, route='route-kauppi-mtb.json', pre=NO_TERRAIN(True), js=TAB('warnings')),
    'phone-part-terrain': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='half', pre=NO_TERRAIN(True), js=TAB('warnings')),
    'desk-closed': dict(DESK, timeline=True),
    'desk-planner': dict(DESK, timeline=True, route='route-kauppi-mtb.json'),
    'desk-settings': dict(DESK, timeline=False, js="document.querySelector('#btn-settings') && document.querySelector('#btn-settings').click(); true"),
    'desk-acts': dict(DESK, timeline=False, js="document.querySelector('.act-current') && document.querySelector('.act-current').click(); true"),
    'desk-road': dict(DESK, timeline=False, activity='road', hash='#15.2/61.4975/23.7605'),
    'desk-run': dict(DESK, timeline=False, activity='run', hash='#15.2/61.4975/23.7605'),
    'desk-mtb-town': dict(DESK, timeline=False, activity='mtb', hash='#15.2/61.4975/23.7605'),
    'phone-acts': dict(PHONE, timeline=False, js="document.querySelector('.act-current') && document.querySelector('.act-current').click(); true"),
    'desk-layers': dict(DESK, timeline=False, js="document.querySelector('#btn-layers').click(); document.querySelector('#quick-layers .qt-more').click(); true"),
    'phone-layers': dict(PHONE, timeline=False, js="document.querySelector('#btn-layers').click(); document.querySelector('#quick-layers .qt-more').click(); true"),
    'phone-settings': dict(PHONE, timeline=False, js="document.querySelector('#btn-settings') && document.querySelector('#btn-settings').click(); true"),
    'desk-quick': dict(DESK, timeline=False, js=QUICK()),
    'phone-quick': dict(PHONE, timeline=False, js=QUICK()),
    'phone-quick-360': dict(PHONE, w=360, h=740, timeline=False, js=QUICK()),
    'phone-quick-375': dict(PHONE, w=375, h=667, timeline=False, js=QUICK()),
    'phone-quick-worst': dict(PHONE, w=360, h=740, timeline=False, js=QUICK_WORST),
    'desk-quick-planner': dict(DESK, timeline=True, route='route-kauppi-mtb.json', js=QUICK()),
    'phone-quick-planner': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='peek', js=QUICK()),
    'desk-quick-bottom': dict(DESK, timeline=True, route='route-kauppi-mtb.json', state='half', storage={'polku:plannerDock': '"bottom"'}, js=QUICK()),
    'phone-quick-opts': dict(PHONE, timeline=False, js=QUICK_OPTS('trailColors')),
    'desk-quick-opts': dict(DESK, timeline=False, js=QUICK_OPTS('trailColors')),
    'phone-quick-depths': dict(PHONE, timeline=False, activity='paddle', hash='#13/61.53/23.73', js=QUICK_OPTS('depths')),
    'phone-quick-edit': dict(PHONE, timeline=False, js=QUICK_EDIT),
    'desk-quick-edit': dict(DESK, timeline=False, js=QUICK_EDIT),
    'phone-quick-all': dict(PHONE, timeline=False, js=QUICK_ALL),
    'phone-quick-gravel': dict(PHONE, timeline=False, activity='gravel', js=QUICK()),
    'phone-quick-paddle': dict(PHONE, timeline=False, activity='paddle', hash='#13/61.53/23.73', js=QUICK()),
    'phone-quick-hike-dark': dict(PHONE, timeline=False, activity='hike', dark=True, base='night', js=QUICK()),
    'desk-quick-dark': dict(DESK, timeline=False, dark=True, base='night', js=QUICK()),
    # #239: white on the green in the dark: the sport pill, Make 3 loops, pressed Weather
    'phone-loop-dark': dict(PHONE, timeline=True, dark=True, base='night', route='route-kauppi-mtb.json', state='half', js=LOOP_OPEN),
    'desk-loop-dark': dict(DESK, timeline=True, dark=True, base='night', route='route-kauppi-mtb.json', js=LOOP_OPEN),
    'phone-weather-dark': dict(PHONE, timeline=False, dark=True, base='night', activity='paddle', hash='#13/61.53/23.73', js="document.querySelector('#btn-time').click(); true"),
    'desk-weather-dark': dict(DESK, timeline=False, dark=True, base='night', activity='gravel', js="document.querySelector('#btn-time').click(); true"),
    # #240: Settings over a raised planner on a phone: above it at half, over it at full and on a short phone
    'phone-settings-half': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='half', js="document.querySelector('#btn-settings').click(); true"),
    'phone-settings-full': dict(PHONE, timeline=True, activity='gravel', route='route-kauppi-mtb.json', state='full', js="document.querySelector('#btn-settings').click(); true"),
    'phone-settings-375-dark': dict(PHONE, w=375, h=667, timeline=True, dark=True, base='night', activity='hike', route='route-kauppi-mtb.json', state='half', js="document.querySelector('#btn-settings').click(); true"),
    'desk-settings-planner': dict(DESK, timeline=True, route='route-kauppi-mtb.json', js="document.querySelector('#btn-settings').click(); true"),
    'desk-quick-gravel': dict(DESK, timeline=False, activity='gravel', js=QUICK()),
    'desk-quick-hike': dict(DESK, timeline=False, activity='hike', js=QUICK()),
    'desk-quick-paddle': dict(DESK, timeline=False, activity='paddle', hash='#13/61.53/23.73', js=QUICK()),
    'desk-min': dict(DESK, timeline=True, route='route-kauppi-mtb.json', state='min'),
    'desk-bottom': dict(DESK, timeline=True, route='route-kauppi-mtb.json', state='half', storage={'polku:plannerDock': '"bottom"'}),
    'desk-bottom-peek': dict(DESK, timeline=True, route='route-kauppi-mtb.json', state='peek', storage={'polku:plannerDock': '"bottom"'}),
    'desk-wide': dict(DESK, timeline=True, route='route-kauppi-mtb.json', storage={'polku:panelWidth': '860'}),
    'desk-speed': dict(DESK, timeline=True, route='route-kauppi-mtb.json', js="polku.planner.reveal('speed'); true"),
    'phone-speed': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='half', js="polku.planner.reveal('speed'); true"),
    'desk-paddle-speed': dict(DESK, timeline=True, activity='paddle', water=[[23.742, 61.507], [23.700, 61.540], [23.757, 61.585]], js="polku.planner.reveal('speed'); true"),
    'desk-zoom': dict(DESK, timeline=True, route='route-kauppi-mtb.json', js="polku.planner.chart.setView && polku.planner.chart.setView([700, 2000], true)"),
    'phone-closed': dict(PHONE, timeline=True),
    'phone-planner': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='half'),
    'phone-peek': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='peek'),
    'phone-full': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='full'),
    'desk-paddle': dict(DESK, timeline=True, activity='paddle', water=[[23.742, 61.507], [23.700, 61.540], [23.757, 61.585]]),
    'phone-paddle': dict(PHONE, timeline=True, activity='paddle', water=[[23.742, 61.507], [23.700, 61.540], [23.757, 61.585]], state='half'),
    'phone-profile': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='half', js="polku.planner.reveal('profile'); true"),
    'desk-point-menu': dict(DESK, timeline=True, route='route-kauppi-mtb.json', js="polku.planner.openPointMenu(1, polku.planner.markers[1]); true"),
    'phone-point-menu': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='peek', js="polku.planner.openPointMenu(1, polku.planner.markers[1]); true"),
    'desk-spot-menu': dict(DESK, timeline=True, route='route-kauppi-mtb.json', js="polku.planner.openSpotMenu && polku.planner.openSpotMenu(polku.map.unproject([980, 560])); true"),
    'phone-spot-menu': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='peek', js="polku.planner.openSpotMenu && polku.planner.openSpotMenu(polku.map.unproject([250, 300])); true"),
    # the waypoint list, one point named
    'desk-waypoints': dict(DESK, timeline=True, route='route-kauppi-mtb.json', js=WAYPOINTS),
    'phone-waypoints': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='full', js=WAYPOINTS),
    # round trips (routing goes to a local BRouter: tools/brouter-local.sh)
    'desk-roundtrip': dict(DESK, timeline=False, hash='#12/61.4980/23.7610', storage=LOCAL, js=LOOP_JS),
    'phone-roundtrip': dict(PHONE, timeline=False, hash='#12/61.4980/23.7610', storage=LOCAL, js=LOOP_JS),
    'phone-planner-empty': dict(PHONE, timeline=False, hash='#12/61.4980/23.7610', js="(() => { polku.planner.setActive(true); return true; })()"),
    'mid-planner-peek': dict(DESK, w=1100, h=820, timeline=True, route='route-kauppi-mtb.json', state='peek'),
    'desk-planner-peek': dict(DESK, timeline=True, route='route-kauppi-mtb.json', state='peek'),
    'desk-roundtrip-empty': dict(DESK, timeline=False, hash='#12/61.4980/23.7610', storage=LOCAL, js="(() => { polku.planner.setActive(true); return true; })()"),
    # the waypoint list with each leg's settings showing
    'desk-leg-settings': dict(DESK, timeline=True, route='route-kauppi-mtb.json', storage={'polku:legSettings': 'true'}, js="polku.planner.reveal('points'); true"),
    'desk-one-leg': dict(DESK, timeline=True, route='route-kauppi-mtb.json', js="(() => { const p = polku.planner; p.reveal('points'); const b = document.querySelectorAll('.wpl-row')[1].querySelector('[aria-label^=\"Settings of the leg\"]'); b && b.click(); return true; })()"),
    'phone-one-leg': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='full', js="(() => { const p = polku.planner; p.reveal('points'); const b = document.querySelectorAll('.wpl-row')[1].querySelector('[aria-label^=\"Settings of the leg\"]'); b && b.click(); return true; })()"),
    'phone-leg-settings': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='full', storage={'polku:legSettings': 'true'}, js="polku.planner.reveal('points'); true"),
    # the wide bottom panel, everything showing, at a few widths (and paddling: no climbs)
    'desk-bottom-full': dict(DESK, timeline=True, route='route-kauppi-mtb.json', state='full', storage={'polku:plannerDock': '"bottom"'}),
    'mid-bottom-full': dict(DESK, w=1100, h=820, timeline=True, route='route-kauppi-mtb.json', state='full', storage={'polku:plannerDock': '"bottom"'}),
    'small-bottom-full': dict(DESK, w=960, h=820, timeline=True, route='route-kauppi-mtb.json', state='full', storage={'polku:plannerDock': '"bottom"'}),
    'desk-bottom-profile': dict(DESK, timeline=True, route='route-kauppi-mtb.json', state='profile', storage={'polku:plannerDock': '"bottom"'}),
    'phone-profile-size': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='profile'),
    'desk-bottom-end': dict(DESK, timeline=True, route='route-kauppi-mtb.json', state='full', storage={'polku:plannerDock': '"bottom"'}, js=SCROLL_END),
    'mid-bottom-end': dict(DESK, w=1100, h=820, timeline=True, route='route-kauppi-mtb.json', state='full', storage={'polku:plannerDock': '"bottom"'}, js=SCROLL_END),
    'mid-bottom-standin': dict(DESK, w=1100, h=820, timeline=True, route='route-kauppi-mtb.json', state='full', storage={'polku:plannerDock': '"bottom"'}, js=STANDIN),
    'desk-bottom-paddle': dict(DESK, timeline=True, activity='paddle', water=[[23.742, 61.507], [23.700, 61.540], [23.757, 61.585]], state='full', storage={'polku:plannerDock': '"bottom"'}),
    # route style (routing goes to a local BRouter: tools/brouter-local.sh)
    'desk-style': dict(DESK, timeline=True, route='route-kauppi-mtb.json', storage=LOCAL, js=STYLE_JS),
    'phone-style': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='full', storage=LOCAL, js=STYLE_JS),
    'desk-leg-style': dict(DESK, timeline=True, route='route-kauppi-mtb.json', storage=LOCAL, js=LEG_STYLE_JS),
    'phone-leg-style': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='peek', storage=LOCAL, js=LEG_STYLE_JS),
    'desk-style-road': dict(DESK, timeline=True, activity='road', route='route-kauppi-mtb.json', storage=LOCAL, js="(async () => { const p = polku.planner; if (!p.renderStyle) return true; await new Promise((r) => setTimeout(r, 3000)); p.reveal('style'); return true; })()"),
    # one leg routed by the Valhalla stand-in, one waiting for brouter.de's pause to end
    'desk-standin': dict(DESK, timeline=True, route='route-kauppi-mtb.json', js=STANDIN),
    'phone-standin': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='full', js=STANDIN),
    'desk-router-setting': dict(DESK, timeline=False, js="document.querySelector('#btn-settings').click(); setTimeout(() => { const i = document.querySelector('[aria-label=\"Routing server address\"]') || [...document.querySelectorAll('.panel-settings h3, .panel-settings .sec-title')].pop(); i && i.scrollIntoView({ block: 'center' }); }, 300); true"),
    # phase 11: the same layers in every sport; opacity under each raster overlay
    'desk-layers-hike': dict(DESK, timeline=False, activity='hike', hash='#15.4/61.5085/23.8040', js=LAYERS_AT('^Trails', 'Difficulty')),
    'phone-layers-hike': dict(PHONE, timeline=False, activity='hike', hash='#15.4/61.5085/23.8040', js=LAYERS_AT('^Trails', 'Difficulty')),
    'desk-layers-paddle': dict(DESK, timeline=False, activity='paddle', hash='#14.6/60.1440/24.9850', js=LAYERS_AT('^Water')),
    'phone-layers-paddle': dict(PHONE, timeline=False, activity='paddle', hash='#14.6/60.1440/24.9850', js=LAYERS_AT('^Water')),
    # phase 12a: trail details at Tykkikallio, Jyväskylä (compare with Trailmap.fi there)
    'desk-trails-mtb': dict(DESK, timeline=False, hash='#12/62.2289/25.7652', js=TRAILS_AT(25.7652, 62.2287, 16)),
    'phone-trails-mtb': dict(PHONE, timeline=False, hash='#12/62.2289/25.7652', js=TRAILS_AT(25.7652, 62.2287, 16)),
    'desk-trails-close': dict(DESK, timeline=False, hash='#12/62.2289/25.7652', js=TRAILS_AT(25.7655, 62.2290, 17.4)),
    'phone-trails-close': dict(PHONE, timeline=False, hash='#12/62.2289/25.7652', js=TRAILS_AT(25.7655, 62.2290, 17.4)),
    'desk-trails-hike': dict(DESK, timeline=False, activity='hike', hash='#12/62.2289/25.7652', js=TRAILS_AT(25.7652, 62.2287, 16)),
    'desk-trails-key': dict(DESK, timeline=False, hash='#12/62.2289/25.7652', js=TRAILS_AT(25.7652, 62.2287, 16, TRAIL_KEY)),
    'phone-trails-key': dict(PHONE, timeline=False, hash='#12/62.2289/25.7652', js=TRAILS_AT(25.7652, 62.2287, 16, TRAIL_KEY)),
    'desk-trails-popup': dict(DESK, timeline=False, hash='#12/62.2289/25.7652', js=TRAILS_AT(25.7655, 62.2290, 17.4, TRAIL_POPUP)),
    # phase 12b: trail details along the route (recorded route + tile, no routing, no Overpass)
    'desk-trail-headsup': dict(DESK, timeline=False, route='route-tykkikallio-mtb.json', hash='#15/62.2285/25.7645', pre=TRAILS_PRE, js=TRAIL_ROUTE('warnings')),
    'phone-trail-headsup': dict(PHONE, timeline=False, route='route-tykkikallio-mtb.json', hash='#15/62.2285/25.7645', state='full', pre=TRAILS_PRE, js=TRAIL_ROUTE('warnings')),
    'desk-trail-width': dict(DESK, timeline=False, route='route-tykkikallio-mtb.json', hash='#15/62.2285/25.7645', pre=TRAILS_PRE, js=TRAIL_ROUTE('profile', 'width')),
    'phone-trail-width': dict(PHONE, timeline=False, route='route-tykkikallio-mtb.json', hash='#15/62.2285/25.7645', state='half', pre=TRAILS_PRE, js=TRAIL_ROUTE('profile', 'width')),
    'desk-trail-vis': dict(DESK, timeline=False, route='route-tykkikallio-mtb.json', hash='#15/62.2285/25.7645', pre=TRAILS_PRE, js=TRAIL_ROUTE('profile', 'vis')),
    'desk-layers-both': dict(DESK, timeline=False, hash='#16.2/62.2287/25.7652', js=LAYERS_AT('^Trails', 'Both')),
    'phone-layers-both': dict(PHONE, timeline=False, hash='#16.2/62.2287/25.7652', js=LAYERS_AT('^Trails', 'Both')),
    'desk-trail-both': dict(DESK, timeline=False, route='route-tykkikallio-mtb.json', hash='#15/62.2285/25.7645', pre=TRAILS_PRE, js=TRAIL_ROUTE('profile', 'both')),
    'desk-trails-uphill': dict(DESK, timeline=False, hash='#12/62.2289/25.7652', js=TRAILS_AT(25.7652, 62.2287, 16.4, "polku.set({ trailColors: 'up' }); await wait(4000);")),
    'phone-trails-uphill': dict(PHONE, timeline=False, hash='#12/62.2289/25.7652', js=TRAILS_AT(25.7652, 62.2287, 16.4, "polku.set({ trailColors: 'up' }); await wait(4000);")),
    # the planner header where it used to spill over (a narrow desktop window, a small phone)
    'narrow-bottom-peek': dict(DESK, w=700, h=900, timeline=False, route='route-kauppi-mtb.json', state='peek', storage={'polku:plannerDock': '"bottom"', 'polku:styles': '{"mtb":{"p":"technical","v":{},"wet":"auto"}}'}),
    'narrow-bottom-half': dict(DESK, w=700, h=900, timeline=False, route='route-kauppi-mtb.json', state='half', storage={'polku:plannerDock': '"bottom"', 'polku:styles': '{"mtb":{"p":"technical","v":{},"wet":"auto"}}'}),
    'small-phone-peek': dict(PHONE, w=360, h=740, timeline=False, route='route-kauppi-mtb.json', state='peek', storage={'polku:styles': '{"mtb":{"p":"technical","v":{},"wet":"auto"}}'}),
    # rain "now" (live FMI radar): Jyväskylä, and somewhere it really rains
    'desk-rain-jkl': dict(DESK, timeline=True, hash='#11/62.235/25.74', settle=16, storage={'polku:settings': json.dumps({'activity': 'mtb', 'timeline': True, 'weather': {'rain': True, 'wind': False, 'temp': False}})}),
    'phone-rain-jkl': dict(PHONE, timeline=True, hash='#11/62.235/25.74', settle=16, storage={'polku:settings': json.dumps({'activity': 'mtb', 'timeline': True, 'weather': {'rain': True, 'wind': False, 'temp': False}})}),
    'desk-rain-coast': dict(DESK, timeline=True, hash='#9/60.5/21.6', settle=16, storage={'polku:settings': json.dumps({'activity': 'mtb', 'timeline': True, 'weather': {'rain': True, 'wind': False, 'temp': False}})}),
    # the route's colour in the header (Draw · Colour | Route | Edit)
    'desk-bottom-colour': dict(DESK, timeline=False, route='route-kauppi-mtb.json', state='peek', storage={'polku:plannerDock': '"bottom"'}, js="(() => { const p = polku.planner; if (p.pickColor) p.pickColor('grade'); return true; })()"),
    'phone-colour': dict(PHONE, timeline=False, route='route-kauppi-mtb.json', state='peek', js="(() => { const p = polku.planner; if (p.pickColor) p.pickColor('grade'); return true; })()"),
    # phase 12c: LIPAS routes and stops in search, the route's card, riding it
    'desk-search-lipas': dict(DESK, timeline=False, hash='#13/62.4345/25.9026', js='(async () => { ' + LIPAS_SEARCH + ' return true; })()'),
    'phone-search-lipas': dict(PHONE, timeline=False, hash='#13/62.4345/25.9026', js='(async () => { ' + LIPAS_SEARCH + ' return true; })()'),
    'desk-lipas-card': dict(DESK, timeline=False, hash='#13/62.4345/25.9026', js='(async () => { ' + LIPAS_CARD + ' return true; })()'),
    'phone-lipas-card': dict(PHONE, timeline=False, hash='#13/62.4345/25.9026', js='(async () => { ' + LIPAS_CARD + ' return true; })()'),
    'desk-lipas-ride': dict(DESK, timeline=False, hash='#13/62.4345/25.9026', js='(async () => { ' + LIPAS_RIDE + ' return true; })()'),
    'phone-lipas-ride': dict(PHONE, timeline=False, hash='#13/62.4345/25.9026', js='(async () => { ' + LIPAS_RIDE + ' return true; })()'),
    # phase 13: water routing (fairways crossed straight, Heads-up), and the paddling style controls
    'desk-water-crossing': dict(DESK, timeline=False, activity='paddle', hash='#14.6/60.1515/24.9715', pre=WATER_SEED, water=WATER_LEG, js="(async () => { polku.planner.reveal('warnings'); return true; })()"),
    'phone-water-crossing': dict(PHONE, timeline=False, activity='paddle', hash='#14.6/60.1515/24.9715', pre=WATER_SEED, water=WATER_LEG, state='half', js="(async () => { polku.planner.reveal('warnings'); return true; })()"),
    'desk-water-style': dict(DESK, timeline=False, activity='paddle', hash='#14.6/60.1515/24.9715', pre=WATER_SEED, water=WATER_LEG, js="(async () => { polku.planner.reveal('style'); return true; })()"),
    'phone-water-style': dict(PHONE, timeline=False, activity='paddle', hash='#14.6/60.1515/24.9715', pre=WATER_SEED, water=WATER_LEG, state='full', js="(async () => { polku.planner.reveal('style'); return true; })()"),
    # a first visit: no link, nothing remembered (the app opens where it opens; no location in headless Chrome)
    'desk-first-visit': dict(DESK, timeline=False, hash=''),
    'phone-first-visit': dict(PHONE, timeline=False, hash=''),
    # for the README: the weather map (live forecast) and the traffic layers (live)
    'desk-wind-map': dict(DESK, timeline=True, hash='#8.2/60.75/24.6', settle=14, storage={'polku:settings': json.dumps({'activity': 'paddle', 'timeline': True, 'weather': {'rain': True, 'wind': True, 'temp': True}})}),
    'phone-wind-map': dict(PHONE, timeline=True, hash='#7.6/60.9/24.6', settle=14, storage={'polku:settings': json.dumps({'activity': 'paddle', 'timeline': True, 'weather': {'rain': True, 'wind': True, 'temp': False}})}),
    'desk-traffic': dict(DESK, timeline=False, activity='road', hash='#12.4/61.4985/23.7700', settle=10),
    # phase 13b: multisport (a sport per leg, changeovers, time by sport)
    'desk-multisport': dict(DESK, timeline=False, hash='#13/61.487/23.748', storage=LOCAL, js=MULTI_JS('points')),
    'phone-multisport': dict(PHONE, timeline=False, hash='#13/61.487/23.748', storage=LOCAL, js=MULTI_JS('points')),
    'desk-multisport-time': dict(DESK, timeline=False, hash='#13/61.487/23.748', storage=LOCAL, js=MULTI_JS('speed')),
    'phone-multisport-time': dict(PHONE, timeline=False, hash='#13/61.487/23.748', storage=LOCAL, js=MULTI_JS('speed')),
    # clicks and taps on the route
    'desk-lipas-pick': dict(DESK, timeline=False, hash='#14.6/62.4495/25.8945', js=LIPAS_PICK),
    'phone-lipas-pick': dict(PHONE, timeline=False, hash='#14.6/62.4495/25.8945', js=LIPAS_PICK),
    'phone-leg-tap': dict(PHONE, timeline=False, route='route-kauppi-mtb.json', state='peek', js=LINE_PICK('tap')),
    'desk-leg-menu': dict(DESK, timeline=False, route='route-kauppi-mtb.json', js=LINE_PICK('right')),
    'desk-leg-click': dict(DESK, timeline=False, route='route-kauppi-mtb.json', js=LINE_PICK('click')),
    'desk-ski-card': dict(DESK, timeline=False, hash='#14.5/62.262/25.735', storage=WINTER_ON, js="(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); " + SEED_WINTER + " await wait(3500);"
                          " const f = polku.map.queryRenderedFeatures({ layers: ['winter-ski'] }).find((x) => x.geometry.type === 'LineString' && x.geometry.coordinates.length > 4); if (f) { const c = f.geometry.coordinates, q = polku.map.project(c[Math.floor(c.length / 2)]);"
                          " polku.map.fire('click', { point: q, lngLat: polku.map.unproject(q), originalEvent: new MouseEvent('click') }); } await wait(1200); return true; })()"),
    'desk-sport-switch': dict(DESK, timeline=True, route='route-kauppi-mtb.json', storage=LOCAL, js="(async () => { polku.set({ activity: 'paddle' }); await new Promise((r) => setTimeout(r, 6000)); return true; })()", settle=0.2),
    'phone-sport-switch': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='peek', storage=LOCAL, js="(async () => { polku.set({ activity: 'paddle' }); await new Promise((r) => setTimeout(r, 6000)); return true; })()", settle=0.2),
    'desk-weather-flash': dict(DESK, timeline=True, route='route-kauppi-mtb.json', js="(async () => { document.querySelector('#btn-time').click(); await new Promise((r) => setTimeout(r, 600)); return true; })()", settle=0.1),
    # a round route: the points on the profile where they are along it (the finish at the end)
    'desk-loop-points': dict(DESK, timeline=False, route='route-kauppi-mtb.json', storage=SIDE,
                             js="(async () => { const p = polku.planner; p.setMode('line'); p.addPoint(p.points[0].slice()); await new Promise((r) => setTimeout(r, 1500)); p.reveal('points'); await new Promise((r) => setTimeout(r, 500)); return true; })()"),
    'desk-other-ways': dict(DESK, timeline=True, activity='hike', hash='#13/60.316/24.592', storage={**LOCAL, **SIDE}, js=OTHER_WAYS()),
    'desk-other-ways-picked': dict(DESK, timeline=True, activity='hike', hash='#13/60.316/24.592', storage={**LOCAL, **SIDE}, js=OTHER_WAYS(pick=True)),
    'desk-other-ways-mtb': dict(DESK, timeline=True, activity='mtb', hash='#13/60.477/22.20', storage={**LOCAL, **SIDE}, js=OTHER_WAYS(pts=RAISIO)),
    'phone-other-ways-mtb': dict(PHONE, timeline=True, activity='mtb', hash='#13/60.477/22.20', storage=LOCAL, js=OTHER_WAYS(peek=True, pts=RAISIO)),
    'phone-other-ways': dict(PHONE, timeline=True, activity='hike', hash='#13/60.316/24.592', storage=LOCAL, js=OTHER_WAYS(peek=True)),
    'phone-other-ways-picked': dict(PHONE, timeline=True, activity='hike', hash='#13/60.316/24.592', storage=LOCAL, js=OTHER_WAYS(pick=True, peek=True)),
    'desk-flow': dict(DESK, timeline=True, route='route-kauppi-mtb.json', storage=SIDE, motion=True),
    'desk-flow-close': dict(DESK, timeline=True, route='route-kauppi-mtb.json', storage=SIDE, motion=True, js=FLOW_CLOSE),
    'desk-flow-hover': dict(DESK, timeline=True, route='route-kauppi-mtb.json', storage=SIDE, motion=True, js=FLOW_HOVER, settle=0.6),
    'phone-flow': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='peek', motion=True),
    'phone-flow-close': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='peek', motion=True, js=FLOW_CLOSE),
    'desk-flow-paddle': dict(DESK, timeline=True, activity='paddle', water=[[23.742, 61.507], [23.700, 61.540], [23.757, 61.585]], storage=SIDE, motion=True),
    'phone-flow-paddle': dict(PHONE, timeline=True, activity='paddle', water=[[23.742, 61.507], [23.700, 61.540], [23.757, 61.585]], state='peek', motion=True),
    'desk-start': dict(DESK, timeline=False, hash='#14/61.4975/23.7605', storage=SIDE, js=START),
    'phone-start': dict(PHONE, timeline=False, hash='#14/61.4975/23.7605', js=START),
    'desk-start-tip': dict(DESK, timeline=False, hash='#14/61.4975/23.7605', storage=SIDE, js=START_TIP, settle=0.6),
    'phone-start-tip': dict(PHONE, timeline=False, hash='#14/61.4975/23.7605', js=START_TIP, settle=0.6),
    'phone-start-360': dict(PHONE, w=360, h=740, timeline=False, hash='#14/61.4975/23.7605', js=START),
    'phone-start-swim': dict(PHONE, timeline=False, activity='swim', hash='#14/61.4975/23.7605', js=START),
    'phone-draw-it': dict(PHONE, timeline=False, hash='#14/61.4975/23.7605', js=WAY('draw')),
    'phone-draw-style': dict(PHONE, timeline=False, hash='#14/61.4975/23.7605', js=WAY('draw', '.pl-way [data-k=srow]')),
    'desk-draw-it': dict(DESK, timeline=False, hash='#14/61.4975/23.7605', storage=SIDE, js=WAY('draw')),
    'phone-rt-ways': dict(PHONE, timeline=False, hash='#14/61.4975/23.7605', js=WAY('loop')),
    'phone-rt-tapped': dict(PHONE, timeline=False, hash='#14/61.4975/23.7605', js=RT_TAPPED),
    'desk-rt-tapped': dict(DESK, timeline=False, hash='#14/61.4975/23.7605', storage=SIDE, js=RT_TAPPED),
    'phone-rt-first': dict(PHONE, timeline=False, hash='#14/61.4975/23.7605', js=FIRST_LENGTH),
    'desk-rt-first': dict(DESK, timeline=False, hash='#14/61.4975/23.7605', storage=SIDE, js=FIRST_LENGTH),
    'phone-marked': dict(PHONE, timeline=False, hash='#13.4/61.5085/23.8270', js=WAY('find'), settle=4),
    'desk-marked': dict(DESK, timeline=False, hash='#13.4/61.5085/23.8270', storage=SIDE, js=WAY('find'), settle=4),
    'desk-leg-lit': dict(DESK, timeline=True, route='route-kauppi-mtb.json', storage=SIDE, js=LEG_LIT),
    'desk-tab-check': dict(DESK, timeline=True, route='route-kauppi-mtb.json', storage=SIDE, js=TAB('warnings')),
    'desk-tab-go': dict(DESK, timeline=True, route='route-kauppi-mtb.json', storage=SIDE, js=TAB('speed')),
    'phone-tab-check': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='full', js=TAB('warnings')),
    'desk-sweep-headsup': dict(DESK, timeline=False, route='route-tykkikallio-mtb.json', hash='#15/62.2285/25.7645', storage=NO_DETAILS, pre=TRAILS_PRE, js=ROW_MENU),
    'desk-sweep-hidden': dict(DESK, timeline=False, route='route-tykkikallio-mtb.json', hash='#15/62.2285/25.7645', storage=NO_DETAILS, pre=TRAILS_PRE, js=ROW_HIDDEN),
    'phone-sweep-headsup': dict(PHONE, timeline=False, route='route-tykkikallio-mtb.json', hash='#15/62.2285/25.7645', state='full', storage=NO_DETAILS, pre=TRAILS_PRE, js=ROW_MENU),
    'short-menu': dict(w=1280, h=600, phone=False, timeline=False, route='route-kauppi-mtb.json', storage={'polku:plannerDock': '"left"'}, js=OPEN_MENU, settle=0.3),
    'phone-credits': dict(PHONE, timeline=True, js=OPEN_CREDITS, settle=0.3),
    'phone-credits-late': dict(PHONE, timeline=True, js=CREDITS_REOPEN, settle=0.3),
    'phone360-summary': dict(w=360, h=740, phone=True, timeline=False, route='route-kauppi-mtb.json', state='half'),
    'desk-winter-route': dict(DESK, timeline=False, hash='#13/62.27/25.71', storage={**LOCAL, **WINTER_ON}, js=WINTER_ROUTE('warnings')),
    'phone-winter-route': dict(PHONE, timeline=False, hash='#13/62.27/25.71', storage={**LOCAL, **WINTER_ON}, js=WINTER_ROUTE('warnings')),
    'desk-winter-time': dict(DESK, timeline=False, hash='#13/62.27/25.71', storage={**LOCAL, **WINTER_ON}, js=WINTER_ROUTE('speed')),
    'desk-winter-colours': dict(DESK, timeline=False, hash='#14/62.258/25.715', js=LAYERS_AT('^Trails', 'Winter').replace("(async () => { ", "(async () => { " + SEED_WINTER + " ")),
    'phone-winter-colours': dict(PHONE, timeline=False, hash='#14/62.258/25.715', js=LAYERS_AT('^Trails', 'Winter').replace("(async () => { ", "(async () => { " + SEED_WINTER + " ")),
    'desk-winter': dict(DESK, timeline=False, hash='#14/62.258/25.715', storage=WINTER_ON, js=WAIT),
    'phone-winter': dict(PHONE, timeline=False, hash='#14/62.258/25.715', storage=WINTER_ON, js=WAIT),
    'desk-winter-layers': dict(DESK, timeline=False, hash='#14/62.258/25.715', storage=WINTER_ON, js=WINTER_LAYERS),
    'phone-winter-layers': dict(PHONE, timeline=False, hash='#14/62.258/25.715', storage=WINTER_ON, js=WINTER_LAYERS),
    'desk-snow': dict(DESK, timeline=False, hash='#5.6/66.8/25.8', js=SNOW_ON),
    'phone-snow': dict(PHONE, timeline=False, hash='#5.2/66.0/25.8', js=SNOW_ON),
    'desk-paddle-loops': dict(DESK, timeline=False, activity='paddle', hash='#12.5/60.150/24.955', js=LOOP_AT('paddle', [24.955, 60.155], 12)),
    'phone-paddle-loops': dict(PHONE, timeline=False, activity='paddle', hash='#12.5/60.150/24.955', js=LOOP_AT('paddle', [24.955, 60.155], 12)),
    'desk-river-loops': dict(DESK, timeline=False, activity='paddle', hash='#12.5/61.485/21.795', js=LOOP_AT('paddle', [21.795, 61.485], 8)),
    'desk-more-loops': dict(DESK, timeline=False, hash='#12/61.4980/23.7610', storage=LOCAL, js=LOOP_AT('mtb', [23.7610, 61.4980], 25, more=True)),
    'phone-more-loops': dict(PHONE, timeline=False, hash='#12/61.4980/23.7610', storage=LOCAL, js=LOOP_AT('mtb', [23.7610, 61.4980], 25, more=True)),
    'desk-stops': dict(DESK, timeline=True, activity='hike', hash='#13/60.305/24.515', storage=LOCAL, js=STOPS_JS('depart')),
    'phone-stops': dict(PHONE, timeline=True, activity='hike', hash='#13/60.305/24.515', storage=LOCAL, js=STOPS_JS('depart')),
    'desk-stops-list': dict(DESK, timeline=True, activity='hike', hash='#13/60.305/24.515', storage=LOCAL, js=STOPS_JS('points')),
    'phone-stops-list': dict(PHONE, timeline=True, activity='hike', hash='#13/60.305/24.515', storage=LOCAL, js=STOPS_JS('points')),
    'desk-stop-menu': dict(DESK, timeline=True, activity='hike', hash='#13/60.305/24.515', storage=LOCAL, js=STOPS_JS('speed', STAY_MENU)),
    'phone-stop-menu': dict(PHONE, timeline=True, activity='hike', hash='#13/60.305/24.515', storage=LOCAL, js=STOPS_JS('speed', STAY_MENU.replace("p.openPointMenu", "p.setSheetState('peek', { remember: false }); await wait(300); p.openPointMenu"))),
    'desk-gear': dict(DESK, timeline=True, hash='#13/61.487/23.748', storage=LOCAL, js=MULTI_JS('warnings')),
    'phone-gear': dict(PHONE, timeline=True, hash='#13/61.487/23.748', storage=LOCAL, js=MULTI_JS('warnings')),
    'desk-leg-hover': dict(DESK, timeline=False, route='route-kauppi-mtb.json', js=LINE_PICK('hover'), settle=0.8),
    'desk-leg-handle': dict(DESK, timeline=False, route='route-kauppi-mtb.json', js=LINE_PICK('handle')),
    'phone-leg-handle': dict(PHONE, timeline=False, route='route-kauppi-mtb.json', state='peek', js=LINE_PICK('handle')),
    # what the route shows: snapped points, the sport strip, distance marks, the sun
    'desk-snap': dict(DESK, timeline=False, hash='#14.84/61.87283/25.21918', storage=LOCAL, js=SNAP_JS),
    'phone-snap': dict(PHONE, timeline=False, hash='#14.84/61.87283/25.21918', storage=LOCAL, js=SNAP_JS),
    'desk-multisport-sport': dict(DESK, timeline=False, hash='#13/61.487/23.748', storage=LOCAL, js=MULTI_SPORT_JS()),
    'phone-multisport-sport': dict(PHONE, timeline=False, hash='#13/61.487/23.748', storage=LOCAL, js=MULTI_SPORT_JS()),
    'desk-marks': dict(DESK, timeline=False, route='route-kauppi-mtb.json', state='peek', js=MARKS_JS),
    'phone-marks': dict(PHONE, timeline=False, route='route-kauppi-mtb.json', state='peek', js=MARKS_JS),
    'desk-sun': dict(DESK, timeline=False, hash='#13/61.487/23.748', storage=LOCAL, js=SUN_JS),
    'phone-sun': dict(PHONE, timeline=False, hash='#13/61.487/23.748', storage=LOCAL, js=SUN_JS),
    # a route coloured on the map, then cleared: nothing of it should stay
    'phone-cleared': dict(PHONE, timeline=False, route='route-kauppi-mtb.json', state='peek', js="(async () => { const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)); if (p.pickColor) p.pickColor('grade'); p.setColorOnMap(true); await wait(600); p.clear(); await wait(800); return true; })()"),
    # mid-drag: the line pulled aside, shot while the new legs are still on their way (dashed)
    'desk-drag': dict(DESK, timeline=True, route='route-kauppi-mtb.json', settle=0.5, js=DRAG),
    'phone-drag': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='peek', settle=0.5, js=DRAG),
}

WAIT_ROUTE = ("new Promise((ok) => { const p = polku.planner, t0 = Date.now();"
              " const go = () => (p.legs.length && p.legs.every((l) => l.status === 'ok' || l.status === 'error') && p.analysis"
              " && (p.analysis.wind || p.analysis.windError)) || Date.now() - t0 > 45000 ? ok() : setTimeout(go, 300); go(); })")
# fit the route into the visible map: the branch knows its own panel, older code gets an estimate
FIT = ("(() => { const p = polku.planner, a = p.analysis; if (!a) return;"
       " const b = a.pts.reduce((m, q) => [Math.min(m[0], q[0]), Math.min(m[1], q[1]), Math.max(m[2], q[0]), Math.max(m[3], q[1])], [180, 90, -180, -90]);"
       " const pad = p.viewPadding ? p.viewPadding() : { top: 130, bottom: innerHeight - document.querySelector('#planner').getBoundingClientRect().top + 20, left: 60, right: 100 };"
       " polku.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: pad, duration: 0 }); })()")

# #226: 3D terrain on, from the map's 3D button (before it, from Layers' switch), with a route and the timeline
ON3D = ("(async () => { const b = document.querySelector('#btn-3d'); if (b) b.click(); else {"
        " const t = [...document.querySelectorAll('#layers-body label.tg')].find((x) => x.querySelector('.tg-text').firstChild.textContent.trim() === '3D terrain');"
        " t.querySelector('input').click(); } await new Promise((r) => setTimeout(r, 1500)); return true; })()")
WATER_PTS = [[23.742, 61.507], [23.700, 61.540], [23.757, 61.585]]
SCENES.update({
    'desk-3d': dict(DESK, timeline=True, route='route-kauppi-mtb.json', js=ON3D),
    'desk-3d-paddle': dict(DESK, timeline=True, activity='paddle', water=WATER_PTS, js=ON3D),
    'phone-3d': dict(PHONE, timeline=True, route='route-kauppi-mtb.json', state='peek', js=ON3D),
    'phone-3d-paddle': dict(PHONE, timeline=True, activity='paddle', water=WATER_PTS, state='half', js=ON3D),
    'phone-3d-360': dict(PHONE, w=360, h=740, timeline=True, route='route-kauppi-mtb.json', state='half'),
    'phone-3d-375': dict(PHONE, w=375, h=667, timeline=True, activity='paddle', water=WATER_PTS, state='half'),
})

# B of #233: the sport and what it changes: the next leg's sport and speed in the drawing menu (phones) and the sport
# button (desktops), the pill's question with a route drawn, Settings' speeds, a point on open water. Straight legs.
SPORT_ROUTE = ("const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)); p.setActive(true); p.clear(); p.setMode('line');"
               " for (const q of [[23.7355, 61.4972], [23.738, 61.4980], [23.7405, 61.4972]]) p.addPoint(q); await p.analysing; p.fitRoute(); await wait(800);")
SPORT_SHOTS = {
    'menu': "p.els.modeBtn.click(); await wait(300); document.querySelector('.menu-pop .nl-sport')?.click(); await wait(300);",
    'speed': "p.els.modeBtn.click(); await wait(300); document.querySelector('.menu-pop .nl-speed')?.click(); await wait(300);",
    'button': "(p.els.sportBtn || p.els.styleBtn).click(); await wait(300); document.querySelector('.menu-pop .nl-sport')?.click(); await wait(300);",
    'ask': "document.querySelector('#activity-bar .act-current').click(); await wait(300); document.querySelector('#activity-bar .act[data-k=hike]').click(); await wait(400);",
    'settings': "document.querySelector('#btn-settings').click(); await wait(400); document.querySelector('#settings-body .speed-sport-row[data-k=mtb]')?.click(); await wait(300);",
    'water': ("polku.map.jumpTo({ center: [23.735, 61.519], zoom: 14 }); await new Promise((r) => polku.map.once('idle', r)); const q = polku.map.project([23.735, 61.522]);"
              " polku.map.fire('click', { point: q, lngLat: polku.map.unproject(q), originalEvent: new MouseEvent('click') }); await wait(600);"),
    'long': "const A = (await import(location.origin + '/js/config.js')).ACTIVITIES; A.mtb.label = 'Maastopyöräily'; p.setMode('auto'); p.renderTools(); await wait(400);",
}
SPORT_JS = lambda k: f"(async () => {{ {SPORT_ROUTE} {SPORT_SHOTS[k]} return true; }})()"
SCENES.update({
    'phone-sport-menu': dict(PHONE, timeline=False, hash='#15/61.4975/23.738', js=SPORT_JS('menu')),
    'phone-sport-speed': dict(PHONE, timeline=False, hash='#15/61.4975/23.738', js=SPORT_JS('speed')),
    'phone-sport-ask': dict(PHONE, timeline=False, hash='#15/61.4975/23.738', js=SPORT_JS('ask')),
    'phone-sport-settings': dict(PHONE, timeline=False, hash='#15/61.4975/23.738', js=SPORT_JS('settings')),
    'phone-sport-water': dict(PHONE, timeline=False, activity='hike', hash='#15/61.4975/23.738', js=SPORT_JS('water')),
    'phone-sport-360': dict(PHONE, w=360, h=740, timeline=False, hash='#15/61.4975/23.738', js=SPORT_JS('long')),
    'desk-sport-button': dict(DESK, timeline=False, hash='#15/61.4975/23.738', storage=SIDE, js=SPORT_JS('button')),
    'desk-sport-ask': dict(DESK, timeline=False, hash='#15/61.4975/23.738', storage=SIDE, js=SPORT_JS('ask')),
    # the start: the sport in a row of its own under Start a route (2026-10-21)
    'phone-sport-start': dict(PHONE, timeline=False, hash='#15/61.4975/23.738', js="(async () => { polku.planner.clear(); polku.planner.setActive(true); return true; })()"),
    'desk-sport-start': dict(DESK, timeline=False, hash='#15/61.4975/23.738', storage=SIDE, js="(async () => { polku.planner.clear(); polku.planner.setActive(true); return true; })()"),
})


def shoot(chrome, out_dir, label, name):
    sc = SCENES[name]
    pg = chrome.page(sc['w'], sc['h'], sc['phone'])
    if sc.get('dark') or sc.get('motion'):
        motion = 'no-preference' if sc.get('motion') else 'reduce'  # motion: what moves (#198's chevrons) moves
        chrome.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-color-scheme', 'value': 'dark' if sc.get('dark') else 'light'}, {'name': 'prefers-reduced-motion', 'value': motion}]}, pg.s)
    settings = {'activity': sc.get('activity', 'mtb'), 'timeline': sc.get('timeline', False), **({'base': sc['base']} if 'base' in sc else {})}
    pg.open_app(settings, sc.get('storage'), **({'hash_': sc['hash']} if 'hash' in sc else {}))
    if sc.get('pre'):
        pg.js(sc['pre'])  # before any route: e.g. trail-detail tiles the route's analysis will read
    if sc.get('route') or sc.get('water'):
        pg.js('polku.planner.setActive(true); true')
        if sc.get('route'):
            pg.js(f"polku.planner.restoreSnapshot({FIX(sc['route'])}); true")
        else:
            pts = json.dumps(sc['water'])
            pg.js(f"(() => {{ const p = polku.planner; p.clear(); p.setMode('water'); for (const q of {pts}) p.addPoint(q); }})()")
        pg.js(WAIT_ROUTE)
        if sc.get('state'):
            pg.js(f"polku.planner.setSheetState ? polku.planner.setSheetState({json.dumps(sc['state'])}, {{ remember: false }}) : null; true")
        time.sleep(0.4)
        pg.js(FIT)
        pg.idle()
    if sc.get('js'):
        pg.js(sc['js'])
    if sc.get('settle') is not None:
        time.sleep(sc['settle'])  # a moment that doesn't wait
    else:
        time.sleep(2.8)  # timeline strip, weather, fades
        pg.idle()
    if sc.get('hover'):
        point = pg.js("(() => { const el = document.querySelector(" + json.dumps(sc['hover']) + "); if (!el) throw new Error('Missing screenshot hover target'); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()")
        chrome.send('Input.dispatchMouseEvent', {'type': 'mouseMoved', **point}, pg.s)
        pg.idle()  # the native hover may update a map source
    path = pg.screenshot(os.path.join(out_dir, f'{label}-{name}.png'))
    errs = pg.errors()
    pg.close()
    print(path + (f'   ({len(errs)} console errors: {errs[0][:120]})' if errs else ''), flush=True)


# #221: the same on-demand window in each sport, with a straight route and
# timeline visible behind it. Main captures Settings before the entry exists.
CHANGELOG_WINDOW = """(async () => {
  const p = polku.planner, wait = ms => new Promise(r => setTimeout(r, ms));
  p.setActive(true); p.clear(); p.setMode('line'); p.addPoint([23.80,61.51]); p.addPoint([23.82,61.52]); await p.analysing; p.fitRoute();
  document.querySelector('#btn-settings').click();
  const b = document.querySelector('#btn-changelog');
  if (b) { b.click(); const start=Date.now(); while(document.querySelector('.changelog-notes[aria-busy]') && Date.now()-start<15000) await wait(50); }
  return true;
})()"""
for sport in ['mtb', 'gravel', 'hike', 'paddle']:
    for size, viewport in [('desk', DESK), ('phone', PHONE)]:
        SCENES[f'{size}-changelog-{sport}'] = dict(viewport, activity=sport, timeline=True, js=CHANGELOG_WINDOW)

# #133: the same straight route and live rain radar in every sport. No router
# requests; forecast and radar completeness are checked before the capture.
RAIN_RADAR_VIEW = """(async () => {
  const p=polku.planner, wx=polku.weather, wait=ms=>new Promise(r=>setTimeout(r,ms));
  p.checkWet=async()=>{};p.loadTrail=async()=>{};
  (await import('./js/trails.js')).holdFetches();
  p.setActive(true);p.clear();p.setMode('line');p.addPoint([25.72,62.23]);p.addPoint([25.76,62.25]);await p.analysing;
  p.reveal('depart');if(p.layout()==='sheet')p.setSheetState('half',{remember:false});
  Object.assign(polku.state.weather,{rain:true});wx.set(polku.state.weather);wx.setHour(0,{silent:true});wx.setOpen(true);
  polku.map.jumpTo({center:[25.74,62.24],zoom:11});
  const until=Date.now()+25000;
  while((!wx.fi || wx.fiLoading || wx.loading) && Date.now()<until)await wait(100);
  if(!wx.fi || wx.fiFailed)throw new Error('No FMI radar image for the screenshot');
  return true;
})()"""
for sport in ['mtb', 'gravel', 'hike', 'paddle']:
    for size, viewport in [('desk', DESK), ('phone', PHONE)]:
        SCENES[f'{size}-radar-{sport}'] = dict(viewport, activity=sport, timeline=True, hash='#11/62.235/25.74', js=RAIN_RADAR_VIEW)


def main():
    if '--list' in sys.argv:
        print('\n'.join(SCENES))
        return
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    out_dir, label, names = sys.argv[1], sys.argv[2], sys.argv[3:] or ['desk-closed', 'desk-planner', 'phone-closed', 'phone-planner']
    os.makedirs(out_dir, exist_ok=True)
    chrome = Chrome()
    try:
        for n in names:
            shoot(chrome, out_dir, label, n)
    finally:
        chrome.close()


if __name__ == '__main__':
    main()
