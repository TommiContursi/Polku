# #547, the look: evidence for the review and for Stop 2

From `main` at 18b43d4, 2026-10-27 and 2026-10-28, headless Chrome (`tools/cdp.py`, SwiftShader), served from the branch's worktree.

- `maps/`: retaken 2026-10-28 for the mock-up, each base map with the Kauppi route (`tools/fixtures/route-kauppi-mtb.json`), the interface hidden, at a fixed view, after the map was idle and no tile had been asked for or answered for 4 s: `<map>-<phone|desk>-route.jpg` (as the app draws it), `<map>-<phone|desk>.jpg` (only the route's own `route-*` layers and the point markers hidden) and `<map>-<phone|desk>.json` (the route's line and points in CSS px, the centre and zoom). Maps: `maasto`, `night`, `aerial-bright` (Aerial FI with the city beside the route under the glass), `aerial-forest` (Aerial FI with Kauppi's forest and Näsijärvi under the glass). Phone 390 × 844 at 2×, desktop 1440 × 900. Made by `measure/capture.py`.
- `today/`: today's look, the planner with the route, light and dark, over Maastokartta, Aerial FI and Night; Layers open in two of them.
- `measure/glass-over-map.json`: 604 words whose background isn't solid, each compared with every pixel under its own glyph boxes (min, 5th percentile, median), per base map, theme and size. Made by `measure/glass_contrast.py`; `today_shots.py` and `capture.py` made the pictures; `colours.py` has the contrast and ΔE2000 helpers.
- Run from a checkout: `POLKU_URL=http://localhost:<port>/ python3 <script> <out>`.
