# #547, the look: evidence for the review and for Stop 2

From `main` at 18b43d4, 2026-10-27 and 2026-10-28, headless Chrome (`tools/cdp.py`, SwiftShader), served from the branch's worktree.

- `maps/`: each base map with the Kauppi route (`tools/fixtures/route-kauppi-mtb.json`), the interface hidden: `<map>-<phone|desk>-route.jpg` (as the app draws it), `<map>-<phone|desk>.jpg` (without the route) and `<map>-<phone|desk>.json` (the route's points in CSS px, the zoom, for drawing it in any colour). `ortofi-city-*`: Tampere's centre, bright and busy, no route. Phone 390 × 844 at 2×, desktop 1440 × 900.
  - **Recapture before using:** the `maasto-*` pictures show tiles that hadn't settled (blown-up names; see #552), and `capture.py`'s route-hiding pattern also hid LIPAS's route layers in the pictures without the route.
- `today/`: today's look, the planner with the route, light and dark, over Maastokartta, Aerial FI and Night; Layers open in two of them.
- `measure/glass-over-map.json`: 604 words whose background isn't solid, each compared with every pixel under its own glyph boxes (min, 5th percentile, median), per base map, theme and size. Made by `measure/glass_contrast.py`; `today_shots.py` and `capture.py` made the pictures; `colours.py` has the contrast and ΔE2000 helpers.
- Run from a checkout: `POLKU_URL=http://localhost:<port>/ python3 <script> <out>`.
