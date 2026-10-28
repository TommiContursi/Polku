# #547, the look: evidence for the review and for Stop 2

From `main` at 18b43d4, 2026-10-27 and 2026-10-28, headless Chrome (`tools/cdp.py`, SwiftShader), served from the branch's worktree.

- `maps/`: retaken 2026-10-28 for the mock-up, each base map with the Kauppi route (`tools/fixtures/route-kauppi-mtb.json`), the interface hidden, at a fixed view, after the map was idle and no tile had been asked for or answered for 4 s: `<map>-<phone|desk>-route.jpg` (as the app draws it), `<map>-<phone|desk>.jpg` (only the route's own `route-*` layers and the point markers hidden) and `<map>-<phone|desk>.json` (the route's line and points in CSS px, the centre and zoom). Maps: `maasto`, `night`, `aerial-bright` (Aerial FI with the city beside the route under the glass), `aerial-forest` (Aerial FI with Kauppi's forest and Näsijärvi under the glass). Phone 390 × 844 at 2×, desktop 1440 × 900. Made by `measure/capture.py`.
- `today/`: today's look, the planner with the route, light and dark, over Maastokartta, Aerial FI and Night; Layers open in two of them.
- `measure/glass-over-map.json`: 604 words whose background isn't solid, each compared with every pixel under its own glyph boxes (min, 5th percentile, median), per base map, theme and size. Made by `measure/glass_contrast.py`; `today_shots.py` and `capture.py` made the pictures; `colours.py` has the contrast and ΔE2000 helpers.
- Run from a checkout: `POLKU_URL=http://localhost:<port>/ python3 <script> <out>`.

## Version 2 of the mock-up (2026-10-28, at 2836e30)

Today, B after the quieter and polish passes, and D, the map's margin; version 1 (today, A, B, C) stays in the mock-up behind its Version switch.

- `mockup-v2/phone/` (390 × 844 at 2×) and `mockup-v2/desk/` (1440 × 900): `<dir>-<map>-<theme>-<device>-<mode>-<depth>.jpg`, captured by `measure/v2/shots3.py` at 1e70fcf, after the fixes from the critique.
- `mockup-v2-critique/`: the frames the critique of version 2 was given, from a frozen copy of the mock-up at 2836e30 (with `depth/`, B with one shadow and with thicker when bigger).
- `measure/v2/mockup-matrix.json`: the page's own measurement at f913eb1 (the edge measure corrected) for today, B and D on every map, theme and device in the default look, and on Maastokartta and the forest in more contrast and reduced transparency (96 frames), with seven frames measured on Chrome's own render to check the page (it agrees within 0.03). Made by `measure/v2/matrix_v2.py`.
- `measure/v2/pan.txt`: the pan test in Chrome on the Mac's GPU (Metal, M1 Pro), today, B and D, phone and desktop, twice each. Made by `measure/v2/gpu_pan2.py`. `check2.py` checked the edges in more contrast and the map buttons at 105 %.
- `measure/v2/strip.json` and `strip-gpu-3x.png`: the unblurred strip a critique saw in B's phone sheet, looked for on SwiftShader and on the GPU (Metal, M1 Pro) at 1, 2 and 3 × pixels, with the frame inside and partly outside the viewport, captured with and without `captureBeyondViewport`: every quarter of the sheet is blurred in every case. Made by `measure/v2/gpu_strip.py`.
- `maps/trail-*` and `maps/plain-*`: the Trail map and Plain, added 2026-10-28 with MTB's trail colours on, over Kauppi's trails (phone 13.2 with the route above the planner's sheet, desktop 14.65), waiting until the trail colours had drawn. Made by `measure/v2/capture_trail_plain.py`.
- `mockup-v3/phone/` (390 × 844 at 2×) and `mockup-v3/desk/` (1440 × 900): B over the Trail map and Plain, today and D beside it, B in more contrast, and B with Match the map over the aerial photos and the night map, captured by `measure/v2/shots3.py` at bb3465c (glass b and one shadow, the user's choices).
- `measure/v2/mockup-matrix-trail-plain.json`: the page's measurement at bb3465c for today, B and D over the Trail map and Plain in every theme, device and mode, and B with glass b over all six maps (88 frames), with four frames checked on Chrome's own render (within 0.03). Made by `measure/v2/matrix_trail_plain.py`.
- `measure/v2/route/`: the route along S3 trails on the Trail map at zoom 16, in the magenta and in today's red, from the running app with the route recoloured, and `route_colours.py`: CIEDE2000 between the route and the Trail map's trail colours, with colour blindness simulated.
- `measure/v2/fab_tint.py`: how far apart B's map buttons' tints are (CIEDE2000) for different glass opacities and saturations.
