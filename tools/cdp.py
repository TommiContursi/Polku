"""Minimal headless Chrome driver over the DevTools protocol (--remote-debugging-pipe).

Standard library only. Used by tools/shoot.py and tools/smoke.py.
The Chrome profile lives in ~/.cache/polku-tools (override: POLKU_CHROME_PROFILE),
so map tiles and forecasts stay cached between runs. When another run already holds it,
this one gets a temporary profile of its own (#254).
"""
import base64
import fcntl
import json
import os
import select
import shutil
import socket
import sys
import subprocess
import tempfile
import time

CHROME = os.environ.get('POLKU_CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
PROFILE = os.environ.get('POLKU_CHROME_PROFILE', os.path.expanduser('~/.cache/polku-tools/chrome-profile'))
BASE = os.environ.get('POLKU_URL', 'http://localhost:8765/')

# one page is ready when the map has loaded and no tiles are pending
IDLE = ("new Promise((ok) => { const m = polku.map; const t = setTimeout(ok, 20000);"
        " const go = () => { clearTimeout(t); setTimeout(ok, 400); };"
        " if (m.loaded() && m.areTilesLoaded()) go(); else m.once('idle', go); })")
# Polku's load step (the saved route, the planner left open, the layers) runs on MapLibre's load event, which comes in
# a frame after the map counts as loaded: late on a busy machine, and a check that had begun meanwhile had its route
# drawn again under it (#248). _loaded is MapLibre's own flag, set as it fires the event; 45 s at most. (A check that
# holds the event back, as column does, finds the flag set and goes on.)
LOAD_STEP = ("new Promise((ok) => { const t0 = Date.now(), go = () => polku.map._loaded ? setTimeout(() => ok(true))"
             " : Date.now() - t0 > 45000 ? ok(false) : setTimeout(go, 50); go(); })")
# Polku there and its map loaded (MapLibre's loaded(): the style, and every tile in or failed), 150 s at most: longer than
# the 90 s the old wait had, which button3d's 3D scene needed on GitHub's runner (#422). A request
# that never answered kept this waiting until Chrome's own 90 s ran out, which ended the whole group without saying what
# it had waited for (#409). false when it didn't load.
MAP_LOADED = ("new Promise((ok) => { const t0 = Date.now(), go = () => window.polku && polku.map.loaded() ? ok(Date.now() - t0 + 1)"
              " : Date.now() - t0 > 150000 ? ok(false) : setTimeout(go, 200); go(); })")
# the map's sources still loading, with their tiles' host and how many tiles are on their way
MAP_WAITING = """(() => {
  if (!window.polku) return ['Polku itself (no window.polku)'];
  const m = polku.map, st = m.style;
  if (!st || !st._loaded) return ['the map’s style'];
  return Object.entries(st.tileManagers || {}).filter(([, tm]) => !tm.loaded()).map(([id, tm]) => {
    const s = m.getSource(id) || {}, u = String((s.tiles || [s.url])[0] || ''), n = Object.values(tm._tiles || {}).filter((t) => t.state === 'loading').length;
    return `the map’s ${id} (${u.replace(/^[a-z]+:\\/\\/([^/]+).*$/, '$1') || 'no address'}, ${n} tiles loading)`;
  });
})()"""


def check_server():
    """The dev server must answer: with it down, pages would load whatever the profile's service worker kept."""
    import urllib.request
    try:
        urllib.request.urlopen(BASE + 'index.html', timeout=5).read(64)
    except Exception as e:
        sys.exit(f'No dev server at {BASE} ({e}). Start it first: python3 serve.py')


def _held_by_chrome(profile):
    """Whether a running Chrome holds the profile: its SingletonLock points to host-pid."""
    try:
        host, _, pid = os.readlink(os.path.join(profile, 'SingletonLock')).rpartition('-')
    except OSError:
        return False
    if host != socket.gethostname():
        return True  # Chrome refuses it too
    try:
        os.kill(int(pid), 0)
    except (ValueError, ProcessLookupError):
        return False  # a stale lock, which Chrome takes over
    except PermissionError:
        pass
    return True


def _profile():
    """The shared profile and a lock held while we use it, or a temporary profile when it's taken.
    A second Chrome on a profile in use hands itself to the first, and its pipe never answers."""
    os.makedirs(PROFILE, exist_ok=True)
    lock = open(os.path.join(PROFILE, 'polku-tools.lock'), 'w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if not _held_by_chrome(PROFILE):
            return PROFILE, lock, None
    except BlockingIOError:
        pass
    lock.close()
    tmp = tempfile.mkdtemp(prefix='polku-chrome-')
    print(f'Chrome profile {PROFILE} is in use by another run: this one uses {tmp}, without the cached tiles.', flush=True)
    return tmp, None, tmp


class Chrome:
    def __init__(self):
        check_server()
        self.profile, self.lock, self.tmp = _profile()
        a, b = os.pipe()  # we write to b, Chrome reads fd 3
        c, d = os.pipe()  # Chrome writes fd 4, we read c
        hi = lambda fd: fcntl.fcntl(fd, fcntl.F_DUPFD, 20)
        a, b, c, d = hi(a), hi(b), hi(c), hi(d)

        def pre():
            os.dup2(a, 3)
            os.dup2(d, 4)

        self.proc = subprocess.Popen(
            [CHROME, '--headless=new', '--remote-debugging-pipe', f'--user-data-dir={self.profile}',
             '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
             '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1440,900', 'about:blank'],
            preexec_fn=pre, close_fds=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        os.close(a)
        os.close(d)
        self.w = b
        self.r = os.fdopen(c, 'rb', buffering=0)
        self.buf = b''
        self.seq = 0
        self.events = []
        self.answers = {}  # replies to calls sent with post() not yet asked for

    def _recv(self, timeout=90):
        end = time.time() + timeout
        while b'\0' not in self.buf:
            # a second at a time, so a Chrome that quit is noticed (its helpers may hold the pipe open)
            if not select.select([self.r], [], [], max(0, min(1, end - time.time())))[0]:
                if self.proc.poll() is not None:
                    raise RuntimeError(f'Chrome quit (exit code {self.proc.returncode})')
                if time.time() >= end:
                    raise RuntimeError(f'no message from Chrome in {timeout} s')
                continue
            chunk = self.r.read(1 << 16)
            if not chunk:
                raise RuntimeError('Chrome closed the pipe')
            self.buf += chunk
        msg, self.buf = self.buf.split(b'\0', 1)
        return json.loads(msg)

    def send(self, method, params=None, session=None, timeout=90):
        what = (params or {}).get('expression', '')[:100].replace('\n', ' ')
        return self.answer(self.post(method, params, session), method, timeout, what)

    def post(self, method, params=None, session=None):
        """Sends a call without waiting: answer(id) waits for its reply."""
        self.seq += 1
        m = {'id': self.seq, 'method': method, 'params': params or {}}
        if session:
            m['sessionId'] = session
        os.write(self.w, json.dumps(m).encode() + b'\0')
        return self.seq

    def answer(self, id_, method='', timeout=90, what=''):
        while id_ not in self.answers:
            try:
                r = self._recv(timeout)
            except RuntimeError as e:  # which call it was waiting for, so a hang can be found
                raise RuntimeError(f'{e}, waiting for {method}' + (f': {what}' if what else '')) from None
            if 'id' in r:
                self.answers[r['id']] = r
            else:
                self.events.append(r)
        r = self.answers.pop(id_)
        if 'error' in r:
            raise RuntimeError(f'{method}: {r["error"]}')
        return r.get('result', {})

    def wait_event(self, name, session, timeout=30):
        end = time.time() + timeout
        while time.time() < end:
            for i, e in enumerate(self.events):
                if e.get('method') == name and e.get('sessionId') == session:
                    return self.events.pop(i)
            self.events.append(self._recv(max(0.1, end - time.time())))
        raise RuntimeError(f'timeout waiting for {name}')

    def alive(self):
        """Whether the browser still answers."""
        try:
            return self.proc.poll() is None and bool(self.send('Browser.getVersion', timeout=10))
        except Exception:
            return False

    def page(self, width, height, phone=False):
        return Page(self, width, height, phone)

    def close(self):
        try:
            if self.proc.poll() is None:
                self.send('Browser.close', timeout=10)
        except Exception:
            pass
        try:
            self.proc.wait(timeout=10)
        except Exception:
            self.proc.kill()
            self.proc.wait()
        if self.lock:
            self.lock.close()
        if self.tmp:
            shutil.rmtree(self.tmp, ignore_errors=True)


class Page:
    def __init__(self, chrome, width, height, phone):
        self.c = chrome
        self.width, self.height, self.phone = width, height, phone
        self.target = chrome.send('Target.createTarget', {'url': 'about:blank'})['targetId']
        self.s = chrome.send('Target.attachToTarget', {'targetId': self.target, 'flatten': True})['sessionId']
        for m in ('Page.enable', 'Runtime.enable', 'Network.enable'):
            chrome.send(m, {}, self.s)
        # always today's files from the dev server, never what the profile's service worker kept
        chrome.send('Network.setBypassServiceWorker', {'bypass': True}, self.s)
        chrome.send('Emulation.setDeviceMetricsOverride', {'width': width, 'height': height, 'deviceScaleFactor': 2 if phone else 1, 'mobile': phone}, self.s)
        chrome.send('Emulation.setTouchEmulationEnabled', {'enabled': phone, 'maxTouchPoints': 5 if phone else 1}, self.s)
        chrome.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-color-scheme', 'value': 'light'}, {'name': 'prefers-reduced-motion', 'value': 'reduce'}]}, self.s)

    def goto(self, url, timeout=60):
        self.c.send('Page.navigate', {'url': url}, self.s)
        self.load_event(timeout)

    def reload(self, timeout=60):
        self.c.send('Page.reload', {}, self.s)
        self.load_event(timeout)
        self.map_loaded()
        self.js(LOAD_STEP)

    def load_event(self, timeout=60):
        try:
            self.c.wait_event('Page.loadEventFired', self.s, timeout)
        except RuntimeError as e:
            raise RuntimeError(f'{e}: the page didn’t load, still waiting for {self.waiting()}') from None

    def map_loaded(self):
        """Polku there and its map loaded, 150 s at most; a RuntimeError saying what it waited for otherwise (#409)."""
        ms = self.js(MAP_LOADED, timeout=155000)
        if not ms:
            raise RuntimeError(f'the map didn’t load in 150 s, still waiting for {self.waiting()}')
        if ms > 20000:  # (a slow load, said in the log: which checks wait long for the map, and how long, #422)
            print(f'      the map took {ms / 1000:.0f} s to load', flush=True)

    def waiting(self):
        """What a page that hasn't loaded waits for: its requests sent and neither finished nor failed (as this page's
        Network events tell), and the map's sources still loading (a worker's requests aren't in the events)."""
        sent, done = {}, set()
        for e in self.c.events:
            if e.get('sessionId') != self.s:
                continue
            m, p = e.get('method'), e.get('params', {})
            if m == 'Network.requestWillBeSent':
                sent[p['requestId']] = p['request']['url']
            elif m in ('Network.loadingFinished', 'Network.loadingFailed'):
                done.add(p['requestId'])
        try:
            out = self.js(MAP_WAITING, timeout=5000) or []
        except Exception as e:
            out = [f'(the map couldn’t be asked: {e})']
        # by address, without the query (a map's tiles share one) and without the page's own blob: and data: images
        urls = [u.split('?')[0] for k, u in sent.items() if k not in done and u.startswith('http')]
        out += [f'{u[:120]}' + (f' ×{urls.count(u)}' if urls.count(u) > 1 else '') for u in dict.fromkeys(urls)]
        return ', '.join(out[:8]) + (f' and {len(out) - 8} more' if len(out) > 8 else '') if out else 'nothing that can be seen'

    def open_app(self, settings=None, storage=None, hash_='#13.6/61.5135/23.8170'):
        """Fresh app: clean localStorage with the given settings, then wait for the map and Polku's load step."""
        self.goto(BASE + 'sw.js')
        items = {'polku:settings': json.dumps(settings or {'activity': 'mtb'})}
        items.update(storage or {})
        self.js('localStorage.clear(); ' + ''.join(f'localStorage.setItem({json.dumps(k)}, {json.dumps(v)}); ' for k, v in items.items()) + 'true')
        self.goto(BASE + hash_)
        self.map_loaded()
        self.js(LOAD_STEP)
        self.idle()

    def js(self, expr, timeout=60000):
        # Chrome's answer may take as long as the script's own timeout, so the pipe waits a little longer than that
        r = self.c.send('Runtime.evaluate', {'expression': expr, 'awaitPromise': True, 'returnByValue': True, 'timeout': timeout},
                        self.s, timeout=max(90, timeout / 1000 + 5))
        if 'exceptionDetails' in r:
            d = r['exceptionDetails']
            raise RuntimeError((d.get('exception') or {}).get('description') or d.get('text'))
        return r.get('result', {}).get('value')

    def idle(self):
        self.js(IDLE)

    def errors(self):
        """Uncaught exceptions and console.error calls so far (network noise filtered)."""
        out = []
        keep = []
        for e in self.c.events:
            if e.get('sessionId') != self.s:
                keep.append(e)
                continue
            m, p = e.get('method'), e.get('params', {})
            if m == 'Runtime.exceptionThrown':
                d = p.get('exceptionDetails', {})
                out.append((d.get('exception') or {}).get('description') or d.get('text'))
            elif m == 'Runtime.consoleAPICalled' and p.get('type') == 'error':
                text = ' '.join(str(a.get('value', a.get('description', ''))) for a in p.get('args', []))
                if not any(s in text for s in ('Failed to fetch', 'NetworkError', 'Load failed')):
                    out.append(text)
            else:
                keep.append(e)
        self.c.events = keep
        return out

    def touch(self, kind, x=0, y=0, at=None):
        """One finger through the browser's own input, so touch-action, scrolling and taps are real:
        kind 'start', 'move' or 'end'; at: its time (time.time()'s clock), now by default."""
        self.c.send('Input.dispatchTouchEvent', {'type': f'touch{kind.capitalize()}', 'touchPoints': [] if kind == 'end' else [{'x': x, 'y': y}], 'timestamp': at or time.time()}, self.s)

    def swipe(self, x, y0, y1, ms=300, steps=12, hold=0.0):
        """A finger from (x, y0) to (x, y1) in about ms; hold: seconds it rests before it lets go (no flick)."""
        # each event carries the time it was meant for, so the swipe's speed is the one meant even when
        # the page is slow to handle each event (Chrome answers a touch only once the page has had it)
        t0 = time.time()
        self.touch('start', x, y0, t0)
        for i in range(1, steps + 1):
            at = t0 + ms / 1000 * i / steps
            time.sleep(max(0, at - time.time()))
            self.touch('move', x, y0 + (y1 - y0) * i / steps, at)
        at = max(at + hold, time.time()) if hold else at
        time.sleep(max(0, at - time.time()))
        self.touch('end', at=at)

    def tap(self, x, y):
        self.touch('start', x, y)
        time.sleep(0.05)
        self.touch('end')

    def quick_tap(self, x, y, ms=50, after=None):
        """A finger up after ms by the touch's own times, however long the page takes with its
        touchstart: the touchend doesn't wait for Chrome's answer to it. after: a promise (JS) the
        touchend waits for, as when a long frame holds it up until the page has done that."""
        t0 = time.time()
        touch = lambda kind, at: {'type': kind, 'touchPoints': [] if kind == 'touchEnd' else [{'x': x, 'y': y}], 'timestamp': at}
        a = self.c.post('Input.dispatchTouchEvent', touch('touchStart', t0), self.s)
        time.sleep(ms / 1000)
        if after:
            self.js(after)
        b = self.c.post('Input.dispatchTouchEvent', touch('touchEnd', t0 + ms / 1000), self.s)
        self.c.answer(a, 'Input.dispatchTouchEvent')
        self.c.answer(b, 'Input.dispatchTouchEvent')

    def screenshot(self, path):
        data = self.c.send('Page.captureScreenshot', {'format': 'png'}, self.s)['data']
        with open(path, 'wb') as f:
            f.write(base64.b64decode(data))
        return path

    def close(self):
        self.c.send('Target.closeTarget', {'targetId': self.target})
