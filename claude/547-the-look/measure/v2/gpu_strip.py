#!/usr/bin/env python3
"""Is the unblurred strip in B's phone sheet real (#547)? The committed mock-up (5124e3b), B over Maastokartta, light,
phone, with every word made transparent: the sheet's sharpness (mean |Laplacian| of the luminance) per quarter of its
width, against the same sheet with the blur turned off. Software (SwiftShader) and GPU (Metal), DPR 1, 2 and 3, the
frame wholly inside the viewport or partly outside it, captured with and without captureBeyondViewport.
  python3 gpu_strip.py URL OUT.json"""
import base64, io, json, os, subprocess, sys, time
sys.path.insert(0, '/Users/tommicontursi/Websites/Polku/.worktrees/547-look/tools')
import cdp  # noqa: E402
URL, OUT = sys.argv[1], sys.argv[2]
real = subprocess.Popen
GPU = {'on': False}
def popen(args, **kw):
    if GPU['on']:
        args = [a for a in args if a not in ('--use-angle=swiftshader', '--enable-unsafe-swiftshader')] + ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist']
    return real(args, **kw)
cdp.subprocess.Popen = popen
WAIT = "new Promise((ok) => { const go = () => window.lookMeasure && window.lookMeasure() ? window.lookMeasure().then(ok) : setTimeout(go, 100); go(); })"
HIDE = "(() => { const s = document.createElement('style'); s.textContent = '.screen .ui *, .screen .ui *::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important } .screen .ui svg { visibility: hidden !important } .mark-box { display: none !important }'; document.head.append(s); return true; })()"
NOBLUR = "(() => { const s = document.createElement('style'); s.textContent = '.screen [data-mat] { backdrop-filter: none !important; -webkit-backdrop-filter: none !important }'; document.head.append(s); return true; })()"
BOX = "(() => { const r = document.querySelector('#stage .fr:last-child .screen').getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, vx: r.left, vy: r.top, w: r.width, h: r.height, iw: innerWidth, ih: innerHeight }; })()"
SHARP = r"""(async (png, dpr) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const k = img.width / 390, x0 = Math.round(24 * k), x1 = Math.round(366 * k), y0 = Math.round(420 * k), y1 = Math.round(820 * k);
  const d = x.getImageData(0, 0, c.width, c.height).data, W = c.width, L = (i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  const q = [0, 0, 0, 0], n = [0, 0, 0, 0];
  for (let y = y0 + 1; y < y1 - 1; y++) for (let xx = x0 + 1; xx < x1 - 1; xx++) {
    const i = (y * W + xx) * 4, lap = Math.abs(4 * L(i) - L(i - 4) - L(i + 4) - L(i - 4 * W) - L(i + 4 * W));
    const b = Math.min(3, Math.floor((xx - x0) / ((x1 - x0) / 4))); q[b] += lap; n[b]++; }
  return q.map((v, i) => Math.round(v / n[i] * 100) / 100);
})"""
rows = []
for gpu in (False, True):
    GPU['on'] = gpu
    c = cdp.Chrome()
    try:
        for dpr in (1, 2, 3):
            for place in ('inside', 'partial'):
                vw, vh = (1600, 1300) if place == 'inside' else (390, 844)
                for blur in (True, False):
                    pg = c.page(vw, vh, False)
                    c.send('Emulation.setDeviceMetricsOverride', {'width': vw, 'height': vh, 'deviceScaleFactor': dpr, 'mobile': place == 'partial'}, pg.s)
                    pg.goto(URL + '?dir=b&map=maasto&theme=light&device=phone&mode=default&depth=one&compare=0')
                    pg.js(WAIT, timeout=90000)
                    pg.js(HIDE)
                    if not blur: pg.js(NOBLUR)
                    if place == 'inside': pg.js("document.querySelector('#stage .fr:last-child .screen').scrollIntoView({block: 'start'}); true")
                    time.sleep(1.0)
                    b = pg.js(BOX)
                    for beyond in (True, False):
                        clip = {'x': b['x'], 'y': b['y'], 'width': b['w'], 'height': b['h'], 'scale': 1}
                        data = c.send('Page.captureScreenshot', {'format': 'png', 'clip': clip, 'captureBeyondViewport': beyond}, pg.s)['data']
                        q = pg.js(f"{SHARP}({json.dumps(data)}, {dpr})", timeout=120000)
                        r = {'gpu': gpu, 'dpr': dpr, 'place': place, 'blur': blur, 'beyond': beyond, 'quarters': q, 'frame_in_view': [round(b['vx']), round(b['vy']), round(b['vx'] + b['w']), round(b['vy'] + b['h'])], 'viewport': [b['iw'], b['ih']]}
                        rows.append(r); print(json.dumps(r), flush=True)
                        if dpr == 3 and blur: open(OUT.replace('.json', f"-{'gpu' if gpu else 'sw'}-{place}-{'beyond' if beyond else 'view'}.png"), 'wb').write(base64.b64decode(data))
                    pg.close()
        if gpu:
            pg = c.page(400, 300, False)
            pg.goto(URL)
            rows.append({'renderer': pg.js("(() => { const g = document.createElement('canvas').getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'none'; })()")})
            print(rows[-1], flush=True)
    finally:
        c.close()
json.dump(rows, open(OUT, 'w'), indent=1)
