# The map fills in as you move it (#1091)

When you move the map, its new parts come in piece by piece, and on a fast connection that still feels slow. This is the investigation the issue asks for: what people see, measured; how other maps make theirs look ready at once; the options with their costs; and a mock-up to choose from. Nothing is built in the app yet.

The mock-up: [mockups/issue-1091-map-fill.html](mockups/issue-1091-map-fill.html), a real map on OpenFreeMap's tiles that you move, as Polku fills it in today and with options A and B, on the network as it is or held a second per tile.

## Where it stands

- **Investigated, 2026-11-18.** Waiting for the user's choice. The recommendation is A (below).

## What people see

### How it was measured

- **Polku on `main` at 214afb8**, served by `serve.py` on its own port, opened in Google Chrome with its GPU (Apple M1 Pro, Metal: the WebGL renderer was logged on every run), headless, at 1440 × 900 and 390 × 844, both at device pixel ratio 2 like a Mac's screen and a phone. Motion as a person has it (not reduced), the service worker on, and an empty Chrome profile each time.
- **Each move twice:** first into a place the browser had never loaded (cold), then the same move after a reload, so the tiles come from the HTTP cache (warm). OpenFreeMap's tiles may be cached for ten years and Mapterhorn's for a week, so warm is what a second visit looks like. What stays slow when warm isn't the network.
- **The moves:** a mouse drag of 600 px; six presses of → (100 px each); a finger's slow drag of 300 px that rests before it lifts; a flick, which lets go moving so the map glides on; and two notches of the mouse wheel out. In MTB and in paddle, at zoom 13, each at a different town or archipelago so that a cold run starts cold.
- **The network** as it is (a fast home connection), and slowed to Chrome DevTools' "Slow 4G" (562 ms of latency, 1.4 Mbit/s). The slowing reaches MapLibre's workers too: OpenFreeMap's tiles took 2–3 s instead of 0.3–0.6 s.
- **What was recorded,** in every frame MapLibre drew: whether each source had its tiles in view loaded, and every 90 ms a 48 × 30 grid of the screen's pixels. From the grid: how much of the screen is plain paper (the background colour, `#f5f3ee`, with nothing drawn on it) beyond what's still paper when everything has come, and when the screen is 99 % like it finally is. A strip of thumbnails every 150 ms shows what a person sees.
- **Two runs of each on the fast network, one on the slow one;** medians below. Nothing else was running Chrome on the machine. The Browser pane was hidden when the runs started (a hidden page doesn't draw), so they ran in a Chrome of their own; the mock-up was then looked at in the pane.

### What it showed

- **On a fast network the map is complete when it stops moving.** MapLibre has every tile in view within 0.2–0.6 s of the move starting, cold or warm alike, so the screen is 99 % like its end state within about 50 ms of the map stopping. What shows is a strip of paper at the edge that leads, while the map moves: 1–2 % of the screen for a drag or the keys, 6–7 % for a flick on a phone, and 13–19 % at the edges as the wheel zooms out. It lasts 150–300 ms. Cold and warm look the same, so this isn't the network: MapLibre asks for a tile only once it comes into view, and then has to lay it out.
- **On a slow network the new part is blank paper for a second or two.** After a flick on a phone, about 80 % of the screen is plain paper, with only the contour lines and the hillshade (which come from Mapterhorn, sooner), for half a second after the map stops; then the map comes in square by square, a 512 px tile at a time, over the next one to two seconds. A desktop drag leaves a strip of paper a tenth of the screen wide for 1.5 s. Warm, the same moves look like the fast network's.
- **Then Polku's own layers come.** Trail details (from Polku's own OSM data on ducksoft.fi) come 0.4 s after the map stops on a fast network and 2 s on a slow one, and the trail lines are drawn again in their colours. In paddle, the depth areas, depth contours and soundings (Traficom's WMS, 24 images per move) come about 1 s after the stop and fade in over 150 ms; the nautical marks and Fintraffic's ships about 1 s after that. Each one is a separate change you see after the map has stopped: this is the "piece by piece".
- **Labels fade in** over 300 ms (MapLibre's `fadeDuration`), after the tile under them has come.
- **What MapLibre does today with a tile that hasn't come:** it draws a coarser tile of the same map in its place, if one is loaded. It asks for the coarser ones at the same moment as the one it needs, so on a slow network they come no sooner, and the place stays paper. MapLibre GL JS 5.24 has no option to load coarser tiles first or to load the area around the view.

SLOW_TABLE

## How others do it

- **Mapbox's native SDKs and MapLibre Native** load the map four zoom levels coarser first (`prefetchZoomDelta`, 4 by default), so "a low-resolution tile at the (current zoom level − delta) is rendered as soon as possible at the expense of a little bandwidth" ([MapLibre Native](https://maplibre.org/maplibre-native/android/api/-map-libre%20-native%20-android/org.maplibre.android.style.sources/-source/set-prefetch-zoom-delta.html), [Mapbox](https://docs.mapbox.com/flutter/maps/api/latest/mapbox_maps_flutter/ImageSource/prefetchZoomDelta.html)). You see a soft map at once and the detail sharpens in.
- **OpenLayers** has `preload` on its tile layers: the coarser levels are loaded too, and its own example sets it to all of them ([API](https://openlayers.org/en/latest/apidoc/module-ol_layer_Tile-TileLayer.html), [example](https://openlayers.org/en/latest/examples/preload.html)). Its tiles also fade in.
- **Leaflet** keeps two rows and columns of tiles beyond the view (`keepBuffer`), can wait to load until a move ends (`updateWhenIdle`), and fades its tiles in (`fadeAnimation`) ([reference](https://leafletjs.com/reference.html)).
- **Organic Maps** ships a coarse map of the whole world with the app (`World.mwm` and `WorldCoasts.mwm`, [build notes](https://github.com/mapsme/omim/blob/map-downloader/docs/MAPS.md)), so the world is always drawn, coastlines, lakes and country names, and a downloaded region's detail is drawn over it.
- **Google Maps and Apple Maps** (from using them, not from a source): Google's web map shows the zoom level you came from, enlarged, until the new tiles come; Apple Maps on an iPhone draws a light grid where nothing has come yet.
- **MapLibre GL JS** has none of these. A plugin, [maplibre-preload](https://github.com/AbelVM/maplibre-preload), loads tiles ahead along a camera animation (not a drag) by reaching into MapLibre's internals or by fetching into the browser's cache, because MapLibre doesn't expose its tile cache ([maplibre-gl-js#6041](https://github.com/maplibre/maplibre-gl-js/issues/6041), open).
- **MapLibre's options** were checked too: `fadeDuration` (labels, 300 ms), `maxTileCacheSize` (tiles kept once loaded; the default fits the view), `cancelPendingTileRequestsWhileZooming` (on) and `raster-fade-duration` (Polku's overlays, 150 ms) all act on tiles once they have come, so none of them fills a blank part sooner.

## The options

All costs are against Polku as it is. OpenFreeMap has no published rate limit and serves from Cloudflare's cache; brouter.de isn't touched by any of these.

### A: a coarse map underneath (recommended)

Whenever the map stops, Polku fetches the same OpenFreeMap tiles four zoom levels coarser for the view and one view's width around it, into the browser's cache. When you then move and a tile hasn't come, MapLibre's own stand-in, the coarser tile, is already there: lakes, sea, forest, fields and the main roads appear at once, and the paths, buildings and names sharpen in where they come. Where the detail has come, nothing changes, because MapLibre only ever draws the coarser tile in the place of a missing one.

- **What people gain:** no blank paper after a move, on any network, without anything moving on screen. On a fast network it removes the strip at the leading edge; on a slow one it turns a second or two of paper into a softer map.
- **Requests:** a zoom-10 tile covers 16 × 16 zoom-14 tiles, so it's 1–4 coarse tiles (35–60 kB each over Finland, so 50–250 kB) when you arrive somewhere, and almost none as you move around nearby: the same coarse tiles cover a whole town. MapLibre already asks for these coarser tiles today whenever a tile is late, so this only asks for them earlier. Not one request goes to Polku's other services.
- **Battery and data:** a few hundred kB per new area; no more drawing, since MapLibre draws the coarse tile only where the detail is missing.
- **Offline:** Save offline already keeps zoom levels 5–14 of a route's area, so a saved area has its coarse tiles; with no network the fetch fails quietly, and that's all.
- **Code:** about 30 lines in `js/offline.js` (it already turns an area into OpenFreeMap tile addresses for Save offline), started from the map's `moveend` in `js/main.js`. It's a map tile path, like the service worker's, not a call to one of Polku's services, so it doesn't go through `request()`; it must never stall them.
- **Unknown until built:** whether to do the same for Mapterhorn's elevation tiles (the hillshade and contours already come sooner); how it looks over the raster bases (aerial, MML's maps), which have their own fallback and fade.

### B: A, and the area around the view loaded ahead

As A, plus the tiles at the map's own zoom half a screen beyond each edge, so a short move finds the detail ready too (Leaflet's `keepBuffer`, done ahead).

- **What people gain:** short moves show the full detail at once, not the coarse map first.
- **Requests:** about twice as many tiles as today, most never looked at (a person moves in one direction, the ring is loaded in all four). On a phone's data plan that's real.
- **Battery:** each extra tile is downloaded and kept, though not laid out until it's shown.
- **Code:** about 15 more lines on top of A.

### C: a coarse Finland kept by the service worker

The coarse tiles for the whole of Finland (zoom 0–8: about 270 tiles in Finland's box, 90–200 kB each at zooms 7 and 8, so 20–30 MB), saved by the service worker the first time Polku runs, as Organic Maps ships its world map. The coarse map is then there even on the first visit to a place, and offline.

- **What people gain:** over A, only the first move into a new region of Finland, and offline use in places never saved.
- **Requests:** 20–30 MB once per install, and again each week when OpenFreeMap's tiles change their version (Save offline keeps its tiles under a key without the version; this would need the same); storage the browser may clear.
- **Code:** about 40 lines in `sw.js` and `js/offline.js`, and a setting to turn it off for those on a small data plan. Too much for what it adds over A: worth looking at again only if A leaves a gap on first visits.

### Not proposed

- **A fade or a shimmer over parts not loaded yet.** Moving the map happens many times a minute and from the keyboard, so by DESIGN.md's "Motion" and the /animate rules it gets no motion; a shimmer would also loop on the map while you wait. A's coarse map gives the same "it's there" without anything moving. MapLibre can't fade vector tiles anyway, only raster ones.
- **MapLibre's settings** (above): none fills a blank part sooner.
- **Bringing Polku's own layers in sooner** (trail details, depths, marks): they wait for the map to stop on purpose, so a move doesn't send requests to free services for places passed by. Whether they could start a little sooner, or fill in together rather than one after another, is a question of its own if the user wants it.

## Building A

One PR, if chosen:

1. `js/offline.js`: a function that, given the map's bounds and zoom, returns the OpenFreeMap tile addresses four zoom levels coarser (never below 0) for the bounds widened by one view on each side, reusing `ofmTemplate()` and `lonLatToTile()`.
2. `js/main.js`: on `moveend` (and the first `load`), fetch the addresses not fetched before in this session, a few at a time, at low priority (`fetch(url, { priority: 'low' })`), forgetting failures. Skipped while Save offline is downloading and when the browser says data is to be saved (`navigator.connection.saveData`).
3. A smoke check that, with a recorded slow tile, a move shows the coarser tile and not paper, and that the warmed addresses are the coarse ones only.
4. DEVELOPING's map section: how the coarse map underneath works, and that it's the one map tile fetch outside MapLibre and the service worker.
5. CHANGELOG: "Moving the map no longer shows blank paper while its tiles come: a coarser map is there underneath, and the detail sharpens in."

To check in the browser pane: MTB and paddle, 390 × 844 and 1440 × 900, drag, flick, keys and the wheel, on the network as it is and slowed; the aerial and MML bases; offline with a saved area.
