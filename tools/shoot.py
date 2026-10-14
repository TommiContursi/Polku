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
           " await p.generateLoops(); if (p.layout() === 'sheet') p.setSheetState('half', { remember: false }); p.reveal('loop'); return true; })()")
LOCAL = {'polku:brouterUrl': '"http://localhost:17777/brouter"'}
STYLE_JS = ("(async () => { const p = polku.planner; if (!p.setStyle) return true; p.setStyle({ p: 'flowy', v: {}, wet: 'auto' });"
            " await new Promise((r) => setTimeout(r, 4500)); p.reveal('style'); return true; })()")
LEG_STYLE_JS = ("(async () => { const p = polku.planner; if (!p.setStyle) { p.openPointMenu(0, p.markers[0]); return true; } p.setStyle({ p: 'transfer', v: {}, wet: 'auto' }, 0);"
                " await new Promise((r) => setTimeout(r, 4500)); if (p.layout() === 'side') p.reveal('points'); await new Promise((r) => setTimeout(r, 600)); p.openPointMenu(0, p.markers[0]); return true; })()")
# the Layers panel scrolled to a group (after optionally pressing a trail colours choice)
def LAYERS_AT(group, colours=None):
    press = (f"const b = [...document.querySelectorAll('#layers-body .seg button')].find((x) => x.textContent === {json.dumps(colours)}); b && b.click(); await wait(800);"
             if colours else '')
    return ("(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); document.querySelector('[data-panel=layers-panel]').click(); await wait(400); " + press +
            f" const s = [...document.querySelectorAll('#layers-body summary')].find((x) => new RegExp({json.dumps(group)}).test(x.textContent)); s && s.scrollIntoView({{ block: 'start' }}); return true; }})()")


# Trail details from the recorded Tykkikallio tile (Overpass held back, so the
# neighbours just stay unloaded), then a view; `extra` runs after (open a popup, the key…). On a branch
# without trail details the seeding just does nothing.
def TRAILS_AT(lon, lat, zoom, extra=''):
    return ("(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); try { const T = await import(location.origin + '/js/trails.js');"
            " const fx = await (await fetch(location.origin + '/tools/fixtures/trails-tykkikallio.json')).json();"
            " T.holdFetches(); T.seedTile(4682, 2273, fx); } catch (e) { /* main */ }"
            f" polku.map.jumpTo({{ center: [{lon}, {lat}], zoom: {zoom} }}); await wait(1800); try {{ {extra} }} catch (e) {{ /* main */ }} return true; }})()")


TRAIL_KEY = ("document.querySelector('[data-panel=layers-panel]').click(); await wait(400);"
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


# clicks and taps on the route: a LIPAS route over a trail, a tap on the line (phone), a right-click on it (desktop)
LIPAS_PICK = ("(async () => { const m = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms)); await wait(2500);"
              " const f = m.queryRenderedFeatures({ layers: ['lipas-route'] }).find((x) => /MTB-lenkki/.test(x.properties.name)); if (!f) return true;"
              " const c = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates[0]; const q = m.project(c[Math.floor(c.length / 3)]);"
              " m.fire('click', { point: q, lngLat: m.unproject(q), originalEvent: new MouseEvent('click') }); await wait(1500); return true; })()")
def LINE_PICK(how):
    return ("(async () => { const p = polku.planner, m = polku.map, wait = (ms) => new Promise((r) => setTimeout(r, ms));"
            " const c = p.legs[1].result.coords, ll = c[Math.floor(c.length / 2)], q = m.project(ll);"
            + (" p.lastTouchAt = Date.now(); m.fire('click', { point: q, lngLat: m.unproject(q), originalEvent: new MouseEvent('click') });" if how == 'tap'
               else " m.fire('contextmenu', { point: q, lngLat: m.unproject(q), originalEvent: new MouseEvent('contextmenu') });")
            + " await wait(700); return true; })()")


# points clicked beside the trails at Konnevesi (the user's test spot), snapped onto them (local BRouter)
SNAP_JS = ("(async () => { const p = polku.planner, wait = (ms) => new Promise((r) => setTimeout(r, ms)); p.setActive(true); p.clear(); p.setMode('auto');"
           " for (const q of [[25.2135, 61.8735], [25.2190, 61.8712], [25.2160, 61.8690], [25.2240, 61.8725]]) p.addPoint(q);"
           " const t0 = Date.now(); while (!(p.legs.every((l) => l.status === 'ok') && p.analysis) && Date.now() - t0 < 30000) await wait(300);"
           " if (p.setSheetState) p.setSheetState('peek', { remember: false }); polku.map.jumpTo({ center: [25.2190, 61.8715], zoom: 15.2 }); await wait(1200); return true; })()")
# the multisport route, its profile coloured by sport (on the map too), the strip under it
def MULTI_SPORT_JS(sec='profile', extra=''):
    return MULTI_JS(sec).replace("return true; })()", ("if (p.pickColor) { p.pickColor('sport'); p.setColorOnMap(true); } " + extra + " await wait(600); return true; })()"))
MARKS_JS = "(async () => { const p = polku.planner; if (p.setMarks) p.setMarks({ km: true, time: true }); await new Promise((r) => setTimeout(r, 600)); return true; })()"
# the multisport route leaving an hour before sunset: Heads-up says when it gets dark
SUN_JS = MULTI_JS('warnings').replace("p.setActive(true);", "p.setActive(true); try { const S = await import(location.origin + '/js/sun.js'); const s = S.sunTimes(Date.now() / 1000, [23.761, 61.498]); const k = Math.max(0, Math.round((s.set - Date.now() / 1000) / 3600) - 1); p.setStartOffset(k); } catch (e) { /* main */ }")


DESK = dict(w=1440, h=900, phone=False)
PHONE = dict(w=390, h=844, phone=True)
SCENES = {
    'desk-closed': dict(DESK, timeline=True),
    'desk-planner': dict(DESK, timeline=True, route='route-kauppi-mtb.json'),
    'desk-settings': dict(DESK, timeline=False, js="document.querySelector('#btn-settings') && document.querySelector('#btn-settings').click(); true"),
    'desk-acts': dict(DESK, timeline=False, js="document.querySelector('.act-current') && document.querySelector('.act-current').click(); true"),
    'desk-road': dict(DESK, timeline=False, activity='road', hash='#15.2/61.4975/23.7605'),
    'desk-run': dict(DESK, timeline=False, activity='run', hash='#15.2/61.4975/23.7605'),
    'desk-mtb-town': dict(DESK, timeline=False, activity='mtb', hash='#15.2/61.4975/23.7605'),
    'phone-acts': dict(PHONE, timeline=False, js="document.querySelector('.act-current') && document.querySelector('.act-current').click(); true"),
    'desk-layers': dict(DESK, timeline=False, js="document.querySelector('[data-panel=layers-panel]').click(); true"),
    'phone-layers': dict(PHONE, timeline=False, js="document.querySelector('[data-panel=layers-panel]').click(); true"),
    'phone-settings': dict(PHONE, timeline=False, js="document.querySelector('#btn-settings') && document.querySelector('#btn-settings').click(); true"),
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
    # what the route shows: snapped points, the sport strip, distance marks, the sun
    'desk-snap': dict(DESK, timeline=False, hash='#14.84/61.87283/25.21918', storage=LOCAL, js=SNAP_JS),
    'phone-snap': dict(PHONE, timeline=False, hash='#14.84/61.87283/25.21918', storage=LOCAL, js=SNAP_JS),
    'desk-multisport-sport': dict(DESK, timeline=False, hash='#13/61.487/23.748', storage=LOCAL, js=MULTI_SPORT_JS()),
    'phone-multisport-sport': dict(PHONE, timeline=False, hash='#13/61.487/23.748', storage=LOCAL, js=MULTI_SPORT_JS()),
    'desk-marks': dict(DESK, timeline=False, route='route-kauppi-mtb.json', state='peek', js=MARKS_JS),
    'phone-marks': dict(PHONE, timeline=False, route='route-kauppi-mtb.json', state='peek', js=MARKS_JS),
    'desk-sun': dict(DESK, timeline=False, hash='#13/61.487/23.748', storage=LOCAL, js=SUN_JS),
    'phone-sun': dict(PHONE, timeline=False, hash='#13/61.487/23.748', storage=LOCAL, js=SUN_JS),
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


def shoot(chrome, out_dir, label, name):
    sc = SCENES[name]
    pg = chrome.page(sc['w'], sc['h'], sc['phone'])
    pg.open_app({'activity': sc.get('activity', 'mtb'), 'timeline': sc.get('timeline', False)}, sc.get('storage'), **({'hash_': sc['hash']} if 'hash' in sc else {}))
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
    path = pg.screenshot(os.path.join(out_dir, f'{label}-{name}.png'))
    errs = pg.errors()
    pg.close()
    print(path + (f'   ({len(errs)} console errors: {errs[0][:120]})' if errs else ''), flush=True)


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
