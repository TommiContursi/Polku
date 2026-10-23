#!/usr/bin/env python3
"""Design-system census of the running app: for each shoot.py scene, a screenshot and the
computed styles of everything visible (text sizes, weights, contrast against the real
background, control sizes, corners, shadows, timings). Usage:
  POLKU_URL=http://localhost:8771/ python3 tools/census.py OUTDIR scene ...
  python3 tools/census.py --sum OUTDIR
"""
import json
import os
import sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS)
import cdp  # noqa: E402
import shoot  # noqa: E402

CENSUS = r"""(() => {
  const vw = innerWidth, vh = innerHeight, coarse = matchMedia('(pointer: coarse)').matches;
  const parse = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; return { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (c, bg) => ({ r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a), a: 1 });
  // the background behind an element: its own and its ancestors', composited until one is solid; the map if none is
  const bgOf = (el) => {
    const layers = [];
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e), c = parse(s.backgroundColor);
      if (e.id === 'map' || e.classList.contains('maplibregl-canvas-container') || s.backgroundImage !== 'none') return { map: true, layers }; // (a picture behind: not measured)
      if (c && c.a > 0) { layers.push(c); if (c.a >= 0.999) break; }
    }
    if (!layers.length || layers[layers.length - 1].a < 0.999) return { map: true, layers };
    let bg = layers.pop(); while (layers.length) bg = over(layers.pop(), bg);
    return { map: false, bg };
  };
  const name = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3) : []; if (c.length) s += '.' + c.join('.'); return s; };
  const path = (el) => { const p = []; for (let e = el; e && p.length < 3 && e !== document.body; e = e.parentElement) p.unshift(name(e)); return p.join(' > '); };
  const seen = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return false;
    for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; } return true; };
  const text = [], controls = [], radius = {}, shadow = {}, timing = {}, family = {};
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('.maplibregl-canvas-container, svg')) continue;
    if (!seen(el)) continue;
    const s = getComputedStyle(el);
    if (s.borderRadius !== '0px') radius[s.borderRadius] = (radius[s.borderRadius] || 0) + 1;
    if (s.boxShadow !== 'none') shadow[s.boxShadow] = (shadow[s.boxShadow] || 0) + 1;
    const d = s.transitionDuration.split(',').map((x) => x.trim()).filter((x) => x !== '0s');
    if (d.length) { const k = d.join(', ') + ' ' + s.transitionTimingFunction.split(',')[0]; timing[k] = (timing[k] || 0) + 1; }
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own) {
      family[s.fontFamily.split(',')[0]] = (family[s.fontFamily.split(',')[0]] || 0) + 1;
      const fg = parse(s.color), b = bgOf(el);
      let cr = null;
      if (fg && !b.map) cr = Math.round(ratio(over({ ...fg, a: fg.a * (+s.opacity || 1) }, b.bg), b.bg) * 100) / 100;
      text.push({ el: path(el), t: el.textContent.trim().slice(0, 40), size: s.fontSize, weight: s.fontWeight, color: s.color, cr, map: b.map,
        large: parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && +s.fontWeight >= 700), tt: s.textTransform, ls: s.letterSpacing });
    }
    if (el.matches('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=radio], [role=tab], [role=switch], [role=menuitem], [role=menuitemradio], [tabindex]:not([tabindex="-1"])')) {
      let t = el; if (el.matches('input[type=checkbox], input[type=radio]') && el.closest('label')) t = el.closest('label');
      const r = t.getBoundingClientRect();
      controls.push({ el: path(el), t: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height),
        radius: s.borderRadius, fs: s.fontSize, fw: s.fontWeight, bg: s.backgroundColor, color: s.color, border: s.borderTopWidth + ' ' + s.borderTopColor });
    }
  }
  return { vw, vh, coarse, dark: matchMedia('(prefers-color-scheme: dark)').matches || document.documentElement.dataset.theme === 'dark', text, controls, radius, shadow, timing, family };
})()"""

_shot = cdp.Page.screenshot


def screenshot(self, path):
    data = self.js(CENSUS)
    with open(path[:-4] + '.json', 'w') as f:
        json.dump(data, f)
    return _shot(self, path)


def summarise(out):
    """Sum the census across scenes: distinct values, contrast failures, small targets."""
    import collections
    import glob
    scenes = {}
    for f in sorted(glob.glob(os.path.join(out, 'a-*.json'))):
        scenes[os.path.basename(f)[2:-5]] = json.load(open(f))

    size = collections.Counter(); weight = collections.Counter(); radius = collections.Counter(); shadow = collections.Counter()
    timing = collections.Counter(); family = collections.Counter(); colors = collections.Counter()
    size_where = collections.defaultdict(set)
    fails = collections.defaultdict(set)   # (el, text, cr, need) -> scenes
    small = collections.defaultdict(set)   # (el, text, w, h) -> scenes
    tiny = collections.defaultdict(set)    # text under 12 px
    for name, d in scenes.items():
        for t in d['text']:
            size[t['size']] += 1; weight[t['weight']] += 1; colors[t['color']] += 1
            size_where[t['size']].add(t['el'].split(' > ')[-1])
            need = 3 if t['large'] else 4.5
            if t['cr'] is not None and t['cr'] < need:
                fails[(t['el'].split(' > ')[-1], t['t'][:28], t['cr'], need, 'dark' if d['dark'] else 'light')].add(name)
            if float(t['size'][:-2]) < 12:
                tiny[(t['el'].split(' > ')[-1], t['t'][:28], t['size'])].add(name)
        for k, v in d['radius'].items(): radius[k] += v
        for k, v in d['shadow'].items(): shadow[k] += v
        for k, v in d['timing'].items(): timing[k] += v
        for k, v in d['family'].items(): family[k] += v
        if d['coarse']:
            for c in d['controls']:
                if c['w'] < 44 or c['h'] < 44:
                    if c['w'] < 24 and c['h'] < 24 and not c['t']:
                        continue
                    small[(c['el'].split(' > ')[-1], c['t'][:24], c['w'], c['h'])].add(name)

    print(f'{len(scenes)} scenes\n')
    print('FONT SIZES', len(size)); [print(f'  {k:>8} {v:5}  {", ".join(sorted(size_where[k])[:5])}') for k, v in sorted(size.items(), key=lambda x: float(x[0][:-2]))]
    print('\nWEIGHTS', dict(weight))
    print('\nFAMILIES', dict(family))
    print('\nTEXT COLOURS', len(colors)); [print(f'  {k:28} {v}') for k, v in colors.most_common(30)]
    print('\nRADII', len(radius)); [print(f'  {k:30} {v}') for k, v in radius.most_common(40)]
    print('\nSHADOWS', len(shadow)); [print(f'  {v:4}  {k[:150]}') for k, v in shadow.most_common(30)]
    print('\nTIMINGS', len(timing)); [print(f'  {v:4}  {k[:120]}') for k, v in timing.most_common(30)]
    print('\nCONTRAST FAILURES (text against its real background)', len(fails))
    for k, v in sorted(fails.items(), key=lambda x: x[0][2]):
        print(f'  {k[2]:5} < {k[3]} {k[4]:5} {k[0][:55]:55} "{k[1]}"  [{", ".join(sorted(v)[:3])}{"…" if len(v) > 3 else ""}]')
    print('\nTEXT UNDER 12 PX', len(tiny))
    for k, v in sorted(tiny.items(), key=lambda x: x[0][2]):
        print(f'  {k[2]:7} {k[0][:55]:55} "{k[1]}"  [{", ".join(sorted(v)[:2])}]')
    print('\nTARGETS UNDER 44 PX ON PHONES', len(small))
    for k, v in sorted(small.items(), key=lambda x: min(x[0][2], x[0][3])):
        print(f'  {k[2]:3}x{k[3]:<3} {k[0][:60]:60} "{k[1]}"  [{", ".join(sorted(v)[:2])}]')


def main():
    if sys.argv[1] == '--sum':
        summarise(sys.argv[2])
        return
    out, names = sys.argv[1], sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    cdp.Page.screenshot = screenshot
    chrome = cdp.Chrome()
    try:
        for n in names:
            try:
                shoot.shoot(chrome, out, 'a', n)
            except Exception as e:  # a scene that fails is reported, the rest go on
                print(f'{n}: FAILED {e}', flush=True)
    finally:
        chrome.close()


if __name__ == '__main__':
    main()
