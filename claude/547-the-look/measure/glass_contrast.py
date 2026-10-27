#!/usr/bin/env python3
"""Text over the glass, measured in the app as it draws (#547): for every text whose background isn't solid (the
frosted surfaces, or the map), its colour against every pixel of the glass under its own glyph boxes, with the text
made transparent for the screenshot. Run from the worktree:
  POLKU_URL=http://localhost:8793/ python3 glass_contrast.py OUT.json"""
import base64, json, os, sys, time
sys.path.insert(0, os.path.join(os.getcwd(), 'tools'))
from cdp import Chrome  # noqa: E402
import shoot  # noqa: E402

COLLECT = r"""(() => {
  const parse = (c) => { const m = c.match(/[\d.]+/g); return m ? { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] } : null; };
  const vw = innerWidth, vh = innerHeight, out = [];
  const glassOf = (el) => { // the first ancestor that's see-through with a background, or the map
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e), c = parse(s.backgroundColor);
      if (c && c.a >= 0.999) return null; // solid: the sweep in tools/smoke.py measures these
      if (c && c.a > 0) { const n = e.id ? '#' + e.id : '.' + [...e.classList].slice(0, 2).join('.'); return n + ' (' + (s.backdropFilter === 'none' ? 'no blur' : s.backdropFilter) + ', ' + s.backgroundColor + ')'; }
    }
    return 'the map';
  };
  const seen = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; } return true; };
  // only what can be seen: clipped by every scrolling or clipping box around it, and not under anything else
  const pe = document.createElement('style'); pe.textContent = '* { pointer-events: auto !important }'; document.head.append(pe);
  const clip = (el, q) => { let [x0, y0, x1, y1] = q;
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e); if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const b = e.getBoundingClientRect(); x0 = Math.max(x0, b.left); y0 = Math.max(y0, b.top); x1 = Math.min(x1, b.right); y1 = Math.min(y1, b.bottom); }
    return x1 - x0 > 1 && y1 - y0 > 1 ? [x0, y0, x1, y1] : null; };
  const onTop = (el, q) => { const h = document.elementFromPoint((q[0] + q[2]) / 2, (q[1] + q[3]) / 2); return h && (el.contains(h) || h.contains(el)); };
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n.textContent.trim(), el = n.parentElement;
    if (!t || !el || el.closest('.maplibregl-canvas-container, svg, .maplibregl-ctrl-attrib, .maplibregl-popup') || !seen(el)) continue;
    const g = glassOf(el); if (!g) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const rects = [...r.getClientRects()].filter((q) => q.width > 1 && q.height > 1 && q.right > 0 && q.bottom > 0 && q.left < vw && q.top < vh)
      .map((q) => clip(el, [Math.max(0, q.left), Math.max(0, q.top), Math.min(vw, q.right), Math.min(vh, q.bottom)])).filter((q) => q && onTop(el, q));
    if (!rects.length) continue;
    const s = getComputedStyle(el);
    out.push({ t: t.slice(0, 30), el: (el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + [...el.classList].slice(0, 2).join('.')), glass: g, color: s.color, size: s.fontSize, weight: s.fontWeight, rects });
  }
  pe.remove();
  return out;
})()"""
HIDE_TEXT = """(() => { const s = document.createElement('style'); s.id = 'no-text';
  s.textContent = '*, *::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important }';
  document.head.append(s); return true; })()"""
MEASURE = r"""(async (png, items, dpr) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0); const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return items.map((it) => {
    const m = it.color.match(/[\d.]+/g).map(Number), a = m[3] === undefined ? 1 : m[3], crs = [];
    for (const [x0, y0, x1, y1] of it.rects) {
      for (let y = Math.floor(y0 * dpr); y < Math.ceil(y1 * dpr); y++) for (let x = Math.floor(x0 * dpr); x < Math.ceil(x1 * dpr); x++) {
        const i = (y * cv.width + x) * 4, br = d[i], bg = d[i + 1], bb = d[i + 2];
        const fg = L(m[0] * a + br * (1 - a), m[1] * a + bg * (1 - a), m[2] * a + bb * (1 - a)), b = L(br, bg, bb);
        crs.push((Math.max(fg, b) + 0.05) / (Math.min(fg, b) + 0.05));
      }
    }
    crs.sort((p, q) => p - q);
    const at = (f) => Math.round(crs[Math.min(crs.length - 1, Math.floor(f * crs.length))] * 100) / 100;
    return { ...it, rects: undefined, n: crs.length, min: at(0), p5: at(0.05), med: at(0.5) };
  });
})"""


def run(chrome, name, base, phone, theme, hash_=None, route=True, js=None):
    w, h = (390, 844) if phone else (1440, 900)
    pg = chrome.page(w, h, phone)
    try:
        chrome.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-color-scheme', 'value': theme}, {'name': 'prefers-reduced-motion', 'value': 'reduce'}]}, pg.s)
        pg.open_app({'activity': 'mtb', 'timeline': False, 'base': base}, None, **({'hash_': hash_} if hash_ else {}))
        pg.js('polku.planner.setActive(true); true')
        if route:
            pg.js(f"polku.planner.restoreSnapshot({shoot.FIX('route-kauppi-mtb.json')}); true")
            pg.js(shoot.WAIT_ROUTE)
            if phone:
                pg.js("polku.planner.setSheetState('half', { remember: false }); true")
            time.sleep(0.5)
            pg.js(shoot.FIT)
        if js:
            pg.js(js)
        pg.js("new Promise((ok) => { const m = polku.map, t0 = Date.now(); const go = () => (m.loaded() && m.areTilesLoaded()) || Date.now() - t0 > 30000 ? ok(true) : setTimeout(go, 300); go(); })", timeout=40000)
        time.sleep(2.5)
        items = pg.js(COLLECT)
        pg.js(HIDE_TEXT)
        time.sleep(0.4)
        png = chrome.send('Page.captureScreenshot', {'format': 'png'}, pg.s)['data']
        res = pg.js(f"{MEASURE}({json.dumps(png)}, {json.dumps(items)}, {2 if phone else 1})", timeout=120000)
        for r in res:
            r.update(scene=name, base=base, theme=theme, size_=('phone' if phone else 'desk'))
        print(name, base, theme, len(res), 'texts', flush=True)
        return res
    finally:
        pg.close()


if __name__ == '__main__':
    out, c = [], Chrome()
    try:
        # does this Chrome (SwiftShader) draw backdrop-filter? the same view with and without it must differ
        pg = c.page(390, 844, True)
        pg.open_app({'activity': 'mtb', 'timeline': False, 'base': 'ortofi'}, None, '#15.4/61.4985/23.7630')
        pg.js('polku.planner.setActive(true); polku.planner.setSheetState("half", { remember: false }); true'); time.sleep(3)
        a = c.send('Page.captureScreenshot', {'format': 'png', 'clip': {'x': 0, 'y': 600, 'width': 390, 'height': 200, 'scale': 1}}, pg.s)['data']
        pg.js("document.head.insertAdjacentHTML('beforeend', '<style>*{backdrop-filter:none!important}</style>'); true"); time.sleep(0.5)
        b = c.send('Page.captureScreenshot', {'format': 'png', 'clip': {'x': 0, 'y': 600, 'width': 390, 'height': 200, 'scale': 1}}, pg.s)['data']
        print('backdrop-filter drawn:', a != b, flush=True)
        pg.close()
        for phone in (True, False):
            for base in ('maasto', 'ortofi', 'night', 'trail'):
                for theme in ('light', 'dark'):
                    out += run(c, 'route', base, phone, theme)
            for theme in ('light', 'dark'):
                out += run(c, 'city', 'ortofi', phone, theme, '#15.4/61.4985/23.7630', route=False,
                           js="polku.planner.setSheetState && polku.planner.setSheetState('half', { remember: false }); true")
    finally:
        c.close()
    json.dump(out, open(sys.argv[1], 'w'), indent=1)
