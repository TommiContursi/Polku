# #547, the look: evidence for the review and for Stop 2

From `main` at 18b43d4, 2026-10-27 and 2026-10-28, headless Chrome (`tools/cdp.py`, SwiftShader), served from the branch's worktree.

- `maps/`: retaken 2026-10-28 for the mock-up, each base map with the Kauppi route (`tools/fixtures/route-kauppi-mtb.json`), the interface hidden, at a fixed view, after the map was idle and no tile had been asked for or answered for 4 s: `<map>-<phone|desk>-route.jpg` (as the app draws it), `<map>-<phone|desk>.jpg` (only the route's own `route-*` layers and the point markers hidden) and `<map>-<phone|desk>.json` (the route's line and points in CSS px, the centre and zoom). Maps: `maasto`, `night`, `aerial-bright` (Aerial FI with the city beside the route under the glass), `aerial-forest` (Aerial FI with Kauppi's forest and Näsijärvi under the glass). Phone 390 × 844 at 2×, desktop 1440 × 900. Made by `measure/capture.py`.
- `today/`: today's look, the planner with the route, light and dark, over Maastokartta, Aerial FI and Night; Layers open in two of them.
- `measure/glass-over-map.json`: 604 words whose background isn't solid, each compared with every pixel under its own glyph boxes (min, 5th percentile, median), per base map, theme and size. Made by `measure/glass_contrast.py`; `today_shots.py` and `capture.py` made the pictures; `colours.py` has the contrast and ΔE2000 helpers.
- Run from a checkout: `POLKU_URL=http://localhost:<port>/ python3 <script> <out>`.

## Version 2 of the mock-up (2026-10-28, at 2836e30)

Today, B after the quieter and polish passes, and D, the map's margin; version 1 (today, A, B, C) stays in the mock-up behind its Version switch.

- `mockup-v2/phone/` (390 × 844 at 2×), `mockup-v2/desk/` (1440 × 900) and `mockup-v2/depth/` (B with one shadow and with thicker when bigger): `<dir>-<map>-<theme>-<device>-<mode>-<depth>.jpg`, captured by `measure/v2/shots3.py` from a frozen copy of the mock-up at 2836e30. These are the frames the critique of version 2 was given.
- `measure/v2/mockup-matrix.json`: the page's own measurement for today, B and D on every map, theme and device in the default look, and on Maastokartta and the forest in more contrast and reduced transparency (96 frames), with seven frames measured on Chrome's own render to check the page (it agrees within 0.03). Made by `measure/v2/matrix_v2.py`.
- `measure/v2/strip.json` and `strip-gpu-3x.png`: the unblurred strip a critique saw in B's phone sheet, looked for on SwiftShader and on the GPU (Metal, M1 Pro) at 1, 2 and 3 × pixels, with the frame inside and partly outside the viewport, captured with and without `captureBeyondViewport`: every quarter of the sheet is blurred in every case. Made by `measure/v2/gpu_strip.py`.
- `measure/v2/fab_tint.py`: how far apart B's map buttons' tints are (CIEDE2000) for different glass opacities and saturations.
