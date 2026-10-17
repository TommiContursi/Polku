#!/usr/bin/env python3
"""Phase 24's baseline: one connected journey through the planner, as a person makes it.

  POLKU_URL=http://localhost:8773/ python3 docs/reviews/2026-10-17-design/evidence/journey.py > journey.json
  ... journey.py --only phone          # phone (390 × 844) or desk (1440 × 900)
  ... journey.py --runs main,loop      # main, loop (a round trip), lipas (Ride this route), long (30 points)

Built on tools/cdp.py (headless Chrome), like tools/smoke.py; no new dependency. Taps, clicks
and drags are real input events (touch on the phone, the mouse on the desktop) on the controls
a person would use, found by their labels. Routing comes from the local BRouter
(tools/brouter-local.sh at localhost:17777) and the recorded LIPAS answers in tools/fixtures/,
never brouter.de.

After each step it checks the state through window.polku (not only that a button exists) and
records what the step cost: taps or clicks, drags, scrolls, keys, switches of panel and tab, and
then the share of the map in view and the controls on screen (measure.py's PROBE, the plan's
numbers). A step that can't be done says why and the run goes on.
"""
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
sys.path.insert(0, HERE)
from cdp import Chrome  # noqa: E402
from measure import PROBE  # noqa: E402

LOCAL = {'polku:brouterUrl': '"http://localhost:17777/brouter"'}
# four points in Kauppi's forest, all on screen at the opening view (zoom 13.6) on a phone and clear of the map's buttons
# (taken from the recorded route's line, so each is on a trail)
KAUPPI = [[23.80917, 61.512737], [23.815563, 61.514458], [23.817732, 61.517524], [23.822693, 61.517036]]
ROUTE_DONE = ("new Promise((ok) => { const p = polku.planner, t0 = Date.now(); const go = () => (p.legs.length && p.legs.every((l) => l.status === 'ok' || l.status === 'error') && p.analysis"
              " && (p.analysis.wind || p.analysis.windError)) || Date.now() - t0 > 45000 ? ok() : setTimeout(go, 300); go(); })")
# visible on screen, not hidden, not covered: the same test a finger makes
HELPERS = r"""
window.__j = {
  vis(el) { if (!el) return null; const r = el.getBoundingClientRect(); if (!r.width || !r.height) return null; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || el.closest('[hidden]')) return null; return r; },
  onScreen(el) { const r = this.vis(el); return !!r && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; },
  find(sel, text) {
    const all = [...document.querySelectorAll(sel)];
    const t = text ? text.toLowerCase() : null;
    // a tab by the word it starts with (Route's tooltip says "how you go"); anything else by its label, text or tooltip
    const says = (e) => (e.getAttribute('role') === 'tab' ? e.textContent.trim().toLowerCase().startsWith(t)
      : ((e.getAttribute('aria-label') || '') + ' ' + e.textContent + ' ' + (e.title || '')).toLowerCase().includes(t));
    return all.find((e) => this.vis(e) && (!t || says(e))) || null;
  },
  // what a person must do to see it: scroll its container (counted) when it's out of view
  reveal(el) {
    const r = el.getBoundingClientRect();
    let sc = el.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    const box = sc ? sc.getBoundingClientRect() : { top: 0, bottom: innerHeight };
    if (r.top >= box.top && r.bottom <= Math.min(box.bottom, innerHeight)) return 0;
    el.scrollIntoView({ block: 'center' });
    return 1;
  },
  center(el) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
};
true"""


class Journey:
    def __init__(self, chrome, w, h, phone):
        self.c, self.w, self.h, self.phone = chrome, w, h, phone
        self.p = chrome.page(w, h, phone)
        self.steps = []
        self.n = dict(taps=0, drags=0, scrolls=0, keys=0, switches=0)
        self.offscreen = []  # controls a step needed that were off the screen

    # ---- input, counted
    def _touch(self, kind, x, y):
        pts = [] if kind == 'touchEnd' else [{'x': x, 'y': y, 'id': 1}]
        self.c.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': pts}, self.p.s)

    def _mouse(self, kind, x, y, buttons=1):
        self.c.send('Input.dispatchMouseEvent', {'type': kind, 'x': x, 'y': y, 'button': 'left', 'buttons': buttons, 'clickCount': 1}, self.p.s)

    def tap_xy(self, x, y):
        if self.phone:
            self._touch('touchStart', x, y); time.sleep(0.05); self._touch('touchEnd', x, y)
        else:
            self._mouse('mouseMoved', x, y, 0); self._mouse('mousePressed', x, y); self._mouse('mouseReleased', x, y, 0)
        self.n['taps'] += 1
        time.sleep(0.35)

    def drag_xy(self, x0, y0, x1, y1, hold=0.0, steps=14):
        if self.phone:
            self._touch('touchStart', x0, y0)
            if hold: time.sleep(hold)
            for i in range(1, steps + 1):
                time.sleep(0.02); self._touch('touchMove', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps)
            self._touch('touchEnd', x1, y1)
        else:
            self._mouse('mouseMoved', x0, y0, 0); self._mouse('mousePressed', x0, y0)
            if hold: time.sleep(hold)
            for i in range(1, steps + 1):
                time.sleep(0.02); self._mouse('mouseMoved', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps)
            self._mouse('mouseReleased', x1, y1, 0)
        self.n['drags'] += 1
        time.sleep(0.5)

    def js(self, expr):
        return self.p.js(expr)

    def tap(self, sel, text=None, switch=False):
        """Tap the visible control matching sel (and text); scroll to it first if a person would have to."""
        found = self.js(f"(() => {{ const e = __j.find({json.dumps(sel)}, {json.dumps(text)}); if (!e) return null; const s = __j.reveal(e); return {{ s, c: __j.center(e) }}; }})()")
        if not found:
            return False
        self.n['scrolls'] += found['s']
        if found['s']:
            time.sleep(0.3)
            found['c'] = self.js(f"__j.center(__j.find({json.dumps(sel)}, {json.dumps(text)}))")
        x, y = found['c']
        if not (0 <= x < self.w and 0 <= y < self.h):  # off the screen: a finger can't press it
            self.offscreen.append(f'{sel} {text or ""} at {round(x)},{round(y)}'.strip())
            return False
        self.tap_xy(x, y)
        if switch:
            self.n['switches'] += 1
        return True

    def open_section(self, title):
        st = self.js(f"(() => {{ const h = __j.find('#planner .sec-head', {json.dumps(title)}); return h ? h.getAttribute('aria-expanded') : null; }})()")
        if st == 'false':
            self.tap('#planner .sec-head', title)
            return 'opened'
        return st and 'open' or 'missing'

    def add_point(self, ll):
        """Tap the map to add a point; if nothing is added, close what's in the way (a card) and tap again, counted."""
        P = 'polku.planner'
        n0 = self.js(f'{P}.points.length')
        self.tap_ll(ll)
        time.sleep(0.6)
        if self.js(f'{P}.points.length') > n0:
            return 'point'
        what = self.js("(() => { const o = [...document.querySelectorAll('.maplibregl-popup, .act-menu:not([hidden]), .menu-pop, .panel:not([hidden])')].filter((e) => __j.vis(e)).map((e) => e.className.split(' ')[0]); return o.join(',') || 'nothing open'; })()")
        closed = 'maplibregl-popup' in what and self.tap('.maplibregl-popup .maplibregl-popup-close-button, .maplibregl-popup button', '×')
        self.tap_ll(ll)
        time.sleep(0.6)
        return f'no point at first ({what}{"; closed it" if closed else ""}), ' + ('a point at the next tap' if self.js(f'{P}.points.length') > n0 else 'none at the next either')

    def tap_ll(self, ll):
        x, y = self.js(f"(() => {{ const q = polku.map.project({json.dumps(ll)}), r = polku.map.getCanvas().getBoundingClientRect(); return [r.left + q.x, r.top + q.y]; }})()")
        self.tap_xy(x, y)

    def choose(self, sel, value):
        """A native select: a tap to open it and one to choose (two taps), set through its change event."""
        ok = self.js(f"(() => {{ const s = __j.find({json.dumps(sel)}); if (!s) return false; __j.reveal(s); s.value = {json.dumps(value)}; s.dispatchEvent(new Event('change', {{ bubbles: true }})); return true; }})()")
        if ok:
            self.n['taps'] += 2
            time.sleep(0.5)
        return ok

    def route_done(self):
        self.js(ROUTE_DONE)
        time.sleep(0.6)

    # ---- a step: what it cost, what it left, and a check through window.polku
    def step(self, name, fn, check=None):
        before = dict(self.n)
        t0 = time.time()
        note = None
        try:
            note = fn()
        except Exception as e:  # the run goes on; the step says why
            note = f'error: {str(e)[:160]}'
        ok = None
        if check:
            try:
                ok = self.js(check)
            except Exception as e:
                ok = f'check failed: {str(e)[:120]}'
        time.sleep(0.4)
        m = self.js(PROBE)
        cost = {k: self.n[k] - before[k] for k in self.n}
        off, self.offscreen = self.offscreen, []
        self.steps.append({'step': name, **cost, 'offscreen': off, 'seconds': round(time.time() - t0, 1), 'ok': ok, 'note': note,
                           'sheet': (m.get('sheet') or {}).get('state'), 'map_clear': m['map_clear'], 'map_seen': m['map_seen'],
                           'controls': m['controls'], 'in_planner': m['in_planner'], 'small': len(m['small'])})
        print(f"  {name}: {cost} ok={ok} {note or ''}", file=sys.stderr, flush=True)

    def open(self, sport='hike', storage=None):
        self.p.open_app({'activity': sport, 'timeline': False}, {**LOCAL, **(storage or {})})
        self.js(HELPERS)

    def raise_sheet(self, to='half'):
        """On a phone, a person swipes the sheet up from its handle (one drag); on a desktop the panel is open."""
        if not self.phone:
            return None
        st = self.js("document.querySelector('#planner').dataset.state")
        order = ['peek', 'profile', 'half', 'full']
        if order.index(st) >= order.index(to):
            return None
        hy = self.js("(() => { const r = document.querySelector('#planner .sheet-handle').getBoundingClientRect(); return r.top + r.height / 2; })()")
        target = {'profile': self.h - 300, 'half': self.h * 0.5, 'full': 90}[to]
        self.drag_xy(self.w / 2, hy, self.w / 2, target)
        got = self.js("document.querySelector('#planner').dataset.state")
        if got != to:  # the handle's tap cycles the sizes too: the way a person tries next
            self.tap('#planner .sheet-handle')
            got = self.js("document.querySelector('#planner').dataset.state")
        return f'sheet {st} → {got}'


def main_journey(j):
    P = 'polku.planner'
    j.open('hike')
    j.step('Open Polku with nothing on it, find Plan and open it', lambda: j.tap('#btn-plan') or 'no Plan button', f'{P}.active === true')
    def sport():
        j.tap('.act-current', switch=True)
        time.sleep(0.4)
        again = ''
        if j.js("document.querySelector('.act-menu').hidden"):  # with a mouse the hover opens it and the click closes it (#245): a person clicks again
            j.tap('.act-current')
            time.sleep(0.4)
            again = 'the first click closed the menu its hover had opened; '
        ok = j.tap('.act-menu .act[data-k=mtb]')
        j.p.idle()  # a new sport restyles the map; a person looks before tapping on
        return again + ('chosen' if ok else 'no sport menu')
    j.step('Choose a sport (MTB)', sport, "polku.state.activity === 'mtb'")

    def add_points():
        got = [j.add_point(ll) for ll in KAUPPI]
        j.route_done()
        return '; '.join(got)

    j.step('Add four points on the map', add_points, f"{P}.points.length === 4 && {P}.legs.every((l) => l.status === 'ok')")

    def drag_point():
        before = j.js(f'JSON.stringify({P}.points[1])')
        x, y = j.js(f"(() => {{ const q = polku.map.project({P}.points[1]), r = polku.map.getCanvas().getBoundingClientRect(); return [r.left + q.x, r.top + q.y]; }})()")
        j.drag_xy(x, y, x + 30, y - 24, hold=0.45 if j.phone else 0)
        j.route_done()
        return 'moved' if j.js(f'JSON.stringify({P}.points[1])') != before else 'did not move'
    j.step('Drag a point', drag_point, f'{P}.points.length === 4')

    def drag_line():
        x, y = j.js(f"(() => {{ const c = {P}.legs[2].result.coords, q = polku.map.project(c[Math.floor(c.length / 2)]), r = polku.map.getCanvas().getBoundingClientRect(); return [r.left + q.x, r.top + q.y]; }})()")
        j.drag_xy(x, y, x + 26, y + 30, hold=0.45 if j.phone else 0)
        j.route_done()
    j.step('Drag the line (a new via point)', drag_line, f'{P}.points.length === 5')

    def leg_mode():
        note = j.raise_sheet('half')
        j.tap('[role=tab]', 'Route', switch=True)
        if not j.tap('button', 'Settings of the leg after Via 1'):
            return f'{note}; no leg settings button'
        ok = j.tap('.wpl-legset button', 'Straight')
        j.route_done()
        return f'{note}; ' + ('straight line chosen' if ok else 'no Straight line in the leg settings')
    j.step("Change a leg's routing mode", leg_mode, f"{P}.legs[1].mode === 'line'")

    def leg_style():
        j.tap('.wpl-legset button', 'Follow paths')  # back to paths, so it has a style
        j.route_done()
        ok = j.choose('.wpl-legset select', 'flowy') or j.tap('.wpl-legset button', 'Flowy')
        j.route_done()
        return 'style chosen' if ok else 'no style picker in the leg settings'
    j.step("Change a leg's style", leg_style, f"{P}.legs[1].mode === 'auto'")

    def undo_redo():
        n0 = j.js(f'{P}.past.length')
        a = j.tap('button', 'Undo')
        time.sleep(0.6)
        b = j.tap('button', 'Redo')
        j.route_done()
        return f'history {n0}; undo {"tapped" if a else "missing"}, redo {"tapped" if b else "missing"}'
    j.step('Undo and redo', undo_redo, f'{P}.points.length === 5')

    def read():
        notes = [j.raise_sheet('half') or '']
        prof = j.js("__j.onScreen(document.querySelector('#profile-canvas'))")
        j.tap('[role=tab]', 'Check', switch=True)
        climbs = j.js("(() => { const e = __j.find('.sec-head, summary, h3, button', 'Climbs'); if (!e) return false; return __j.reveal(e); })()")
        if climbs:
            j.n['scrolls'] += 1
        surf = j.tap('button, label', 'Colour the route by') and (j.choose('.quick-sel select', 'surface') or True)
        return f"{' '.join(notes)} profile on screen: {prof}; climbs found; surfaces: {bool(surf)}"
    j.step('Read the summary, profile, climbs and surfaces', read, "!!document.querySelector('#profile-canvas')")

    def style_speed():
        t0 = j.js(f'{P}.analysis && Math.round({P}.analysis.time || {P}.analysis.timeWind || 0)')
        d0 = j.js(f'{P}.analysis && Math.round({P}.analysis.along[{P}.analysis.along.length - 1])')
        j.tap('button.quick', 'Balanced') or j.tap('button', 'Style')
        j.tap('button', 'Flowy trails')
        j.route_done()
        j.tap('[role=tab]', 'Go', switch=True)
        j.tap('button', 'Fast')
        time.sleep(1)
        t1 = j.js(f'{P}.analysis && Math.round({P}.analysis.time || {P}.analysis.timeWind || 0)')
        d1 = j.js(f'{P}.analysis && Math.round({P}.analysis.along[{P}.analysis.along.length - 1])')
        return f'distance {d0} → {d1} m, time {t0} → {t1} s; style {j.js(f"JSON.stringify({P}.style)")}'
    j.step('Change the route style and the speeds', style_speed, f"JSON.stringify({P}.style).includes('flowy')")

    def heads_up():
        j.tap('[role=tab]', 'Check', switch=True)
        j.open_section('Heads-up')
        n = j.js("document.querySelectorAll('#planner .li-row .li').length")
        if not n:
            return 'no Heads-up on this route'
        j.tap('#planner .li-row .li')
        nog = j.js(f'{P}.nogos.length')
        ok = j.tap('#planner .li-row .avoid')
        j.route_done()
        return f'{n} heads-up; avoid {"tapped" if ok else "not offered"}; places to avoid {nog} → {j.js(f"{P}.nogos.length")}'
    j.step('Open Heads-up, find a warning on the map, use Avoid', heads_up, f'{P}.points.length === 5')

    state0 = {}

    def layers():
        state0.update(j.js(f"({{ sheet: document.querySelector('#planner').dataset.state, pts: JSON.stringify({P}.points), tab: {P}.tab }})"))
        j.tap('#btn-layers', switch=True)
        j.tap('#layers-panel label.tg', 'Trail details')
        j.tap('#layers-panel .panel-close') or j.tap('#btn-layers')
        return 'trail details switched'
    j.step('Open Layers, change something, come back to planning', layers, None)
    j.steps[-1]['ok'] = j.js(f"document.querySelector('#layers-panel').hidden && {P}.active && document.querySelector('#planner').dataset.state === {json.dumps(state0.get('sheet'))} && JSON.stringify({P}.points) === {json.dumps(state0.get('pts'))}")

    def departure():
        j.tap('[role=tab]', 'Go', switch=True)
        sec = j.open_section('Time')
        v = j.js("(() => { const s = __j.find('#planner .go-depart select'); return s ? [...s.options].map((o) => o.value).find((x, i) => i === 3) : null; })()")
        ok = v and j.choose('#planner .go-depart select', v)
        j.route_done()
        sec2 = j.open_section('Departure')
        wx = j.js("(() => { const e = __j.find('#planner .sec-head, #planner summary, #planner h3, #planner button', 'Weather'); if (!e) return false; const s = __j.reveal(e); return { s, on: __j.onScreen(e) }; })()")
        if wx:
            j.n['scrolls'] += wx['s']
        return f'Time section {sec}, Departure & weather {sec2}; departure {"changed" if ok else "not found"}; weather along the route: {wx}'
    j.step('Change the departure and read the weather along the route', departure, f'!!({P}.analysis && ({P}.analysis.wind || {P}.analysis.windError))')

    def tabs():
        for t in ['Route', 'Check', 'Go', 'Route', 'Check', 'Go']:
            j.tap('[role=tab]', t, switch=True)
    j.step('Move between Route, Check and Go six times', tabs, f"{P}.tab === 'go'")

    def take():
        j.tap('[role=tab]', 'Go', switch=True)
        seen = {'section': j.open_section('Take it along')}
        for label in ('Copy share link', 'Export GPX', 'Save offline'):
            r = j.js(f"(() => {{ const e = __j.find('#planner button', {json.dumps(label)}); if (!e) return null; const s = __j.reveal(e); return {{ s, on: __j.onScreen(e) }}; }})()")
            if r:
                j.n['scrolls'] += r['s']
            seen[label] = bool(r and r['on'])
        return seen
    j.step('Find the share link, Export GPX and Save offline', take, None)

    # ---- mistakes along the way
    def wrong_panel():
        j.tap('#btn-settings', switch=True)
        j.tap('#settings-panel .panel-close') or j.tap('#btn-settings')
        j.tap('#btn-layers', switch=True)
        j.tap('#layers-panel .panel-close') or j.tap('#btn-layers')
    j.step('Mistake: Settings opened instead of Layers, then Layers', wrong_panel, f"[document.querySelector('#settings-panel').hidden, document.querySelector('#layers-panel').hidden, {P}.active].join(' ')")

    def folded():
        if not j.phone:
            return 'desktop: the panel has no accidental fold by swipe'
        hy = j.js("(() => { const r = document.querySelector('#planner .sheet-handle').getBoundingClientRect(); return r.top + r.height / 2; })()")
        j.drag_xy(j.w / 2, hy, j.w / 2, j.h - 60)
        mid = j.js("document.querySelector('#planner').dataset.state")
        back = j.raise_sheet('half')
        return f'folded to {mid}; {back}'
    j.step('Mistake: the sheet folded by accident, then back', folded, "document.querySelector('#planner').dataset.state !== 'peek' || innerWidth > 720")

    def undone():
        j.raise_sheet('half')
        j.tap('[role=tab]', 'Route', switch=True)
        n0 = j.js(f'{P}.points.length')
        j.tap('button', 'Remove Via 2')
        time.sleep(0.5)
        n1 = j.js(f'{P}.points.length')
        j.tap('button', 'Undo')
        j.route_done()
        return f'points {n0} → {n1} → {j.js(f"{P}.points.length")}'
    j.step('Mistake: a point removed, then undone', undone, f'{P}.points.length === 5')

    def reload():
        j.p.reload()
        j.js(HELPERS)
        time.sleep(2)
        j.route_done()
        return j.js(f"({{ active: {P}.active, points: {P}.points.length, sheet: document.querySelector('#planner').dataset.state, tab: {P}.tab }})")
    j.step('Mistake: a reload mid-route', reload, f'{P}.points.length === 5')


def loop_journey(j):
    P = 'polku.planner'
    j.open('mtb')
    j.step('Open Plan', lambda: j.tap('#btn-plan'), f'{P}.active')

    def make():
        opened = j.tap('#planner .quick-loop') or j.tap('button', 'Round trip')
        time.sleep(1.2)  # the sheet rises to the round trip's options
        j.tap_ll(KAUPPI[2])  # above the sheet, which the round trip raises to half
        time.sleep(0.8)
        chip = j.tap('.loop-starts button.chip', '10 km')
        go = j.tap('.loop-go button.primary')
        if not (opened and chip and go):
            return f'round trip {"opened" if opened else "not found"}; 10 km {"tapped" if chip else "not found"}; make loops {"tapped" if go else "not found"}'
        t0 = time.time()
        while time.time() - t0 < 60 and not j.js(f'{P}.loop.results.length'):
            time.sleep(0.5)
        return f'{j.js(f"{P}.loop.results.length")} loops'
    j.step('Make a round trip of about 10 km from a start on the map', make, f'{P}.loop.results.length > 0')

    def pick():
        ok = j.tap('.loop-cards button', 'Take') or j.tap('.loop-cards button')
        j.route_done()
        return 'taken' if ok else 'no loop card to take'
    j.step('Take one of the loops', pick, f'{P}.points.length > 1')


def lipas_journey(j):
    P = 'polku.planner'
    j.p.open_app({'activity': 'mtb', 'timeline': False}, LOCAL, hash_='#13/62.4345/25.9026')
    j.js(HELPERS)
    seed = ("(async () => { try { const L = await import(location.origin + '/js/lipas.js'); if (L.seedLipas) { const fx = await (await fetch(location.origin + '/tools/fixtures/lipas-multamaki.json')).json();"
            " L.seedLipas((url) => (/CQL_FILTER=id%3D615379/.test(url) ? fx.place : /lipas_kaikki_reitit/.test(url) ? fx.routes : /lipas_kaikki_pisteet/.test(url) ? fx.stops : null)); } } catch (e) {} return true; })()")
    j.js(seed)

    def search():
        j.tap('#search-input')
        j.js("(() => { const i = document.querySelector('#search-input'); i.value = 'multam'; i.dispatchEvent(new Event('input')); return true; })()")
        j.n['keys'] += 6
        time.sleep(3.5)
        return j.tap('#search-results li[data-kind=routes]', 'MTB-lenkki') and 'result tapped' or 'no LIPAS route in the results'
    j.step('Search for an official route by name and open it', search, "!!document.querySelector('.polku-popup')")

    def ride():
        ok = j.tap('.polku-popup button', 'Ride this route')
        t0 = time.time()
        while time.time() - t0 < 20 and not j.js(f'!!({P}.analysis && {P}.analysis.wind)'):
            time.sleep(0.4)
        return 'riding' if ok else 'no Ride this route button'
    j.step('Ride this route', ride, f'{P}.active && {P}.points.length > 1')


def long_journey(j):
    P = 'polku.planner'
    j.open('mtb')
    j.step('Open Plan', lambda: j.tap('#btn-plan'), f'{P}.active')
    j.step('Choose Straight line', lambda: j.tap('#planner button', 'Straight line'), f"{P}.mode === 'line'")
    # zoom out so 30 points fit on screen, as a person would before a long route
    j.js("polku.map.fitBounds([[23.70, 61.47], [23.955, 61.514]], { padding: { top: 90, bottom: 220, left: 30, right: 80 }, duration: 0 }); true")
    time.sleep(1.5)

    def thirty():
        got = [j.add_point([23.70 + (i % 10) * 0.035, 61.47 + (i // 10) * 0.02 + (i % 2) * 0.004]) for i in range(30)]
        missed = [g for g in got if g != 'point']
        t0 = time.time()
        while time.time() - t0 < 60 and not j.js(f'!!{P}.analysis'):
            time.sleep(0.5)
        return f'{30 - len(missed)} at the first tap; ' + '; '.join(sorted(set(missed)))
    j.step('Add 30 points', thirty, f'{P}.points.length === 30')

    def finish_row():
        j.raise_sheet('half')
        j.tap('[role=tab]', 'Route', switch=True)
        rows = j.js("document.querySelectorAll('#planner .wpl-row').length")
        r = j.js("(() => { const rows = document.querySelectorAll('#planner .wpl-row'); const e = rows[rows.length - 1]; if (!e) return null; let n = 0; const b = document.querySelector('#planner .sheet-body');"
                 " while (!__j.onScreen(e) || e.getBoundingClientRect().bottom > innerHeight) { b.scrollTop += b.clientHeight * 0.8; n++; if (n > 40) break; } return n; })()")
        j.n['scrolls'] += r or 0
        return f'{rows} rows; {r} screens of scrolling to reach the finish'
    j.step("Reach the finish's row in the list", finish_row, None)


RUNS = {'main': main_journey, 'loop': loop_journey, 'lipas': lipas_journey, 'long': long_journey}
SIZES = {'phone': (390, 844, True), 'desk': (1440, 900, False)}


def main():
    args = sys.argv[1:]
    only = args[args.index('--only') + 1].split(',') if '--only' in args else list(SIZES)
    runs = args[args.index('--runs') + 1].split(',') if '--runs' in args else list(RUNS)
    c = Chrome()
    out = []
    try:
        for size in only:
            w, h, phone = SIZES[size]
            for run in runs:
                print(f'{size} {run}', file=sys.stderr, flush=True)
                j = Journey(c, w, h, phone)
                try:
                    RUNS[run](j)
                except Exception as e:
                    j.steps.append({'step': 'run stopped', 'note': str(e)[:200]})
                total = {k: sum(s.get(k, 0) for s in j.steps) for k in ('taps', 'drags', 'scrolls', 'keys', 'switches')}
                out.append({'size': size, 'run': run, 'total': total, 'steps': j.steps, 'errors': j.p.errors()[:5]})
                j.p.close()
    finally:
        c.close()
    json.dump(out, sys.stdout, indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
