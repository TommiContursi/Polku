#!/usr/bin/env python3
"""#547's mock-up, every combination: the in-page measurement (window.lookMeasure()) for each version, map, theme,
device and mode; and for a few, the same words measured on Chrome's own render of the glass (text made transparent,
the screen captured, every pixel under each word's glyph boxes), to check the in-page model.
  POLKU_URL=http://localhost:8793/ python3 mock_matrix.py OUT.json"""
import base64, json, os, sys, time
sys.path.insert(0, '/Users/tommicontursi/Websites/Polku/.worktrees/547-look/tools')
from cdp import Chrome, BASE  # noqa: E402

PAGE = os.environ.get('PAGE', BASE + 'docs/plans/mockups/issue-547-the-look.html')
# the words on surfaces, with their boxes in the frame and their colour, and the model's own lowest per word
WORDS = r"""(() => {
  const sc = document.querySelector('#stage .fr:last-child .screen'), b0 = sc.getBoundingClientRect(), out = [];
  const walk = document.createTreeWalker(sc.querySelector('.ui'), NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const el = n.parentElement, t = n.textContent.trim(); if (!t || !el.closest('[data-mat]') || el.closest('.wp-ic, .mark')) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    out.push({ t: t.slice(0, 28), color: getComputedStyle(el).color, rects: [...r.getClientRects()].map((q) => [q.left - b0.left, q.top - b0.top, q.right - b0.left, q.bottom - b0.top]) });
  }
  return { words: out, x: b0.left, y: b0.top, w: b0.width, h: b0.height };
})()"""
HIDE = "(() => { const s = document.createElement('style'); s.textContent = '.screen .ui *, .screen .ui *::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important }'; document.head.append(s); return true; })()"
REAL = r"""(async (png, words, fw) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, k = img.width / fw;
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }, L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return words.map((w) => { const m = w.color.match(/[\d.]+/g).map(Number), a = m[3] ?? 1; let min = 99;
    for (const [x0, y0, x1, y1] of w.rects) for (let y = Math.max(0, Math.floor(y0 * k)); y < Math.min(c.height, Math.ceil(y1 * k)); y++) for (let xx = Math.max(0, Math.floor(x0 * k)); xx < Math.min(c.width, Math.ceil(x1 * k)); xx++) {
      const i = (y * c.width + xx) * 4, br = d[i], bg = d[i + 1], bb = d[i + 2], fg = L(m[0] * a + br * (1 - a), m[1] * a + bg * (1 - a), m[2] * a + bb * (1 - a)), b = L(br, bg, bb);
      min = Math.min(min, (Math.max(fg, b) + 0.05) / (Math.min(fg, b) + 0.05)); }
    return { t: w.t, color: w.color, min: Math.round(min * 100) / 100 }; });
})"""
WAIT = "new Promise((ok) => { const go = () => window.lookMeasure && window.lookMeasure() ? window.lookMeasure().then(ok) : setTimeout(go, 100); go(); })"


def load(c, pg, q):
    pg.goto(PAGE + '?ver=2&' + '&'.join(f'{k}={v}' for k, v in q.items()))
    r = pg.js(WAIT, timeout=90000)
    return r


c = Chrome()
rows, checks = [], []
try:
    pg = c.page(1600, 1200, False)
    for mode in ('default', 'contrast', 'clear'):
        for d in ('today', 'b', 'd'):
            for theme in ('light', 'dark'):
                for device in ('phone', 'desk'):
                    for m in ('maasto', 'bright', 'forest', 'night'):
                        if mode != 'default' and m not in ('maasto', 'forest'):
                            continue
                        r = load(c, pg, dict(dir=d, map=m, theme=theme, device=device, mode=mode, depth='one', compare=0))
                        rows += r
        print(mode, 'done', len(rows), flush=True)
    # the model against Chrome's own render of the glass
    for d, m, theme in (('today', 'night', 'light'), ('b', 'maasto', 'light'), ('b', 'forest', 'light'), ('b', 'night', 'light'), ('b', 'maasto', 'dark'), ('b', 'bright', 'dark'), ('d', 'forest', 'dark')):
        pg.close(); pg = c.page(1600, 1200, False)
        model = load(c, pg, dict(dir=d, map=m, theme=theme, device='phone', mode='default', depth='one', compare=0))[0]
        info = pg.js(WORDS)
        pg.js(HIDE); time.sleep(0.6)
        png = c.send('Page.captureScreenshot', {'format': 'png', 'clip': {'x': info['x'], 'y': info['y'], 'width': info['w'], 'height': info['h'], 'scale': 1}, 'captureBeyondViewport': True}, pg.s)['data']
        real = pg.js(f"{REAL}({json.dumps(png)}, {json.dumps(info['words'])}, {info['w']})", timeout=120000)
        checks.append({'dir': d, 'map': m, 'theme': theme, 'model': model, 'real': real})
        print('checked', d, m, theme, flush=True)
finally:
    c.close()
json.dump({'rows': rows, 'checks': checks}, open(sys.argv[1], 'w'), indent=1)
