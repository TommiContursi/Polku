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
- **One run of each move,** on each network, at a place of its own (so a slow run's numbers say as much about what's at that place as about the move); a first round of 30 runs, partly on a profile that wasn't empty, showed the same. Nothing else was running Chrome on the machine. The Browser pane was hidden when the runs started (a hidden page doesn't draw), so they ran in a Chrome of their own; the mock-up was then tried in the pane.

### What it showed

- **On a fast network the map is complete when it stops moving.** MapLibre has every tile in view within 0.2–0.6 s of the move starting, cold or warm alike, so the screen is like its end state within about 50 ms of the map stopping. What shows is paper at the edge that leads, while the map moves: up to 4 % of the screen for a drag or the keys, and 23–26 % during a flick on a phone, as the map glides into places it hasn't loaded. It lasts 150–300 ms. Cold and warm look the same, so this isn't the network: MapLibre asks for a tile only once it comes into view, and then has to lay it out.
- **On a slow network the new part is plain paper for a second or more.** After a flick on a phone, three quarters of the screen is paper, with only the contour lines and the hillshade (from Mapterhorn, which come sooner), and the map comes in square by square, a 512 px tile at a time, for 1.8 s after it stops. The wheel zooming out leaves a frame of paper round the edges for 3 s. Warm, the same moves look like the fast network's.
- **Then Polku's own layers come.** Trail details (from Polku's own OSM data on ducksoft.fi) come 0.4 s after the map stops on a fast network and 2 s on a slow one, and the trail lines are drawn again in their colours. In paddle, the depth areas, depth contours and soundings (Traficom's WMS, 24 images per move) come about 1 s after the stop and fade in over 150 ms; the nautical marks and Fintraffic's ships about 1 s after that. Each one is a separate change you see after the map has stopped: this is the "piece by piece".
- **Labels fade in** over 300 ms (MapLibre's `fadeDuration`), after the tile under them has come.
- **What MapLibre does today with a tile that hasn't come:** it draws a coarser tile of the same map in its place, masked to the missing tile's square, but only one it already holds among the tiles in view. It asks for a coarser one only after the missing tile has failed or come, not while it loads, and a coarser tile in the browser's cache doesn't count. So after zooming in you see the old zoom enlarged, but after a move into a new place there is nothing to stand in, and the place stays paper. MapLibre GL JS has no option to change this, in 5.24 or in the newest version, 6.19.

| Move | Sport | Size | Fast, cold: paper while moving | Slow, cold: paper while moving | Slow, cold: paper after the stop | Slow, cold: like the end state after the stop | Slow, warm: paper after the stop |
|---|---|---|---|---|---|---|---|
| Mouse drag | MTB | 1440 × 900 | 2 % | 28 % | 0 % | 0.0 s | 0 % |
| → six times | MTB | 1440 × 900 | 1 % | 19 % | 8 % | 0.2 s | 0 % |
| Finger drag | MTB | 390 × 844 | 4 % | 2 % | 0 % | 0.0 s | 0 % |
| Flick | MTB | 390 × 844 | 26 % | 76 % | 76 % | 1.8 s | 0 % |
| Wheel out | MTB | 1440 × 900 | 0 % | 23 % | 23 % | 3.3 s | 0 % |
| Mouse drag | Paddle | 1440 × 900 | 0 % | 39 % | 39 % | 2.6 s | 0 % |
| → six times | Paddle | 1440 × 900 | 0 % | 0 % | 0 % | 0.0 s | 0 % |
| Finger drag | Paddle | 390 × 844 | 2 % | 24 % | 24 % | 4.1 s | 0 % |
| Flick | Paddle | 390 × 844 | 23 % | 12 % | 12 % | 0.2 s | 0 % |
| Wheel out | Paddle | 1440 × 900 | 5 % | 14 % | 13 % | 5.8 s | 1 % |

"Paper" is the share of the screen that is the plain background beyond what is still background at the end; "like the end state" includes Polku's own layers, which is why paddle's numbers are long (the depth data).

## How others do it

- **Mapbox's native SDKs and MapLibre Native** load the map four zoom levels coarser first (`prefetchZoomDelta`, 4 by default), so "a low-resolution tile at the (current zoom level − delta) is rendered as soon as possible at the expense of a little bandwidth" ([MapLibre Native](https://maplibre.org/maplibre-native/android/api/-map-libre%20-native%20-android/org.maplibre.android.style.sources/-source/set-prefetch-zoom-delta.html), [Mapbox](https://docs.mapbox.com/flutter/maps/api/latest/mapbox_maps_flutter/ImageSource/prefetchZoomDelta.html)). You see a soft map at once and the detail sharpens in.
- **OpenLayers** has `preload` on its tile layers: the coarser levels are loaded too, and its own example sets it to all of them ([API](https://openlayers.org/en/latest/apidoc/module-ol_layer_Tile-TileLayer.html), [example](https://openlayers.org/en/latest/examples/preload.html)). Its tiles also fade in.
- **Leaflet** keeps two rows and columns of tiles beyond the view (`keepBuffer`), can wait to load until a move ends (`updateWhenIdle`), and fades its tiles in (`fadeAnimation`) ([reference](https://leafletjs.com/reference.html)).
- **Organic Maps** ships a coarse map of the whole world with the app (`World.mwm` and `WorldCoasts.mwm`, [build notes](https://github.com/mapsme/omim/blob/map-downloader/docs/MAPS.md)), so the world is always drawn, coastlines, lakes and country names, and a downloaded region's detail is drawn over it.
- **Google Maps and Apple Maps** (from using them, not from a source): Google's web map shows the zoom level you came from, enlarged, until the new tiles come; Apple Maps on an iPhone draws a light grid where nothing has come yet.
- **MapLibre GL JS** has none of these. A pull request proposes a `preload` option for camera animations ([#8670](https://github.com/maplibre/maplibre-gl-js/pull/8670)), not for drags. A plugin, [maplibre-preload](https://github.com/AbelVM/maplibre-preload), loads tiles ahead along a camera animation (not a drag) by reaching into MapLibre's internals or by fetching into the browser's cache, because MapLibre doesn't expose its tile cache ([maplibre-gl-js#6041](https://github.com/maplibre/maplibre-gl-js/issues/6041), open).
- **MapLibre's options** were checked too: `fadeDuration` (labels, 300 ms), `maxTileCacheSize` (tiles kept once loaded; the default fits the view), `cancelPendingTileRequestsWhileZooming` (on) and `raster-fade-duration` (Polku's overlays, 150 ms) all act on tiles once they have come, so none of them fills a blank part sooner.

## The options

All costs are against Polku as it is. OpenFreeMap has no published rate limit and serves from Cloudflare's cache; brouter.de isn't touched by any of these.

### A: a coarse map underneath (recommended)

Every tile in view keeps the tile four zoom levels up among MapLibre's own tiles for that source, as Mapbox's and MapLibre Native's `prefetchZoomDelta` does. When you then move and a tile hasn't come, MapLibre's own stand-in, the coarser tile, is already there, drawn only in the missing tile's square: lakes, sea, forest, fields and the main roads appear at once, and the paths, buildings and names sharpen in where they come. Where the detail has come, nothing changes.

- **Tried in Polku:** with zoom 13's tiles held back and never answered, a move of a screen and a half on a phone showed the zoom-9 tile in their place from 167 ms on: the forest, the open ground, the roads, the contours and the hillshade, with only the paths and small names missing ([what was run](#how-a-was-tried)). Fetching the same coarse tiles into the browser's cache instead did nothing: MapLibre never asked for them while the detail loaded (above).
- **What people gain:** no plain paper after a move into a place the map hasn't shown, on any network, without anything moving on screen. On a fast network it removes the strip at the leading edge and the paper during a flick; on a slow one it turns one to three seconds of paper into a softer map that sharpens.
- **Requests:** a zoom-10 tile covers 16 × 16 zoom-14 tiles, so the view needs 1–4 coarse tiles (35–60 kB each over Finland) when you arrive somewhere, and almost none as you move around nearby: the same few cover a whole town. The first time in a region they load with the rest; after that they're there. Nothing goes to Polku's other services.
- **Battery and data:** a few hundred kB per new region; MapLibre draws the coarse tiles masked to where the detail is missing, so a little more drawing per frame (one or two more tiles' layers, clipped), to be measured in the build.
- **Offline:** Save offline already keeps zoom levels 5–14 of a route's area, so a saved area has its coarse tiles.
- **Code:** about 15 lines where `js/main.js` creates the map, for the OpenFreeMap sources (`ofm` and `ofmTrails`). It reaches into MapLibre's `TileManager` (`_updateRetainedTiles`, `_addTile`), since MapLibre GL JS has no option for it ([#6041](https://github.com/maplibre/maplibre-gl-js/issues/6041), where its maintainers point to a map-level prefetch API instead). Polku loads a fixed MapLibre version, so a smoke check that fails when those parts change catches an upgrade that breaks it; offering MapLibre the option itself is the clean way out, later.
- **Unknown until built:** whether the raster bases (aerial, MML's maps) and Mapterhorn's elevation tiles need it too (the hillshade and contours already come sooner); whether a coarse tile's labels ever show twice beside the detail's.

### B: A, and the area around the view loaded ahead

As A, plus the tiles at the map's own zoom half a screen beyond each edge, fetched into the browser's cache whenever the map stops, so a short move finds the detail ready too (Leaflet's `keepBuffer`, done ahead). This part does work through the cache: MapLibre asks for these tiles as they come into view, and gets them at once.

- **What people gain:** short moves show the full detail at once, not the coarse map first.
- **Requests:** about twice as many tiles as today, most never looked at (a person moves in one direction, the ring is loaded in all four). On a phone's data plan that's real.
- **Battery:** each extra tile is downloaded and kept, though not laid out until it's shown.
- **Code:** about 25 more lines on top of A, in `js/offline.js` (which already turns an area into OpenFreeMap tile addresses for Save offline) and `js/main.js`.

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

1. `js/main.js`, where the map is made: on the style's load, wrap `_updateRetainedTiles` of the `ofm` and `ofmTrails` tile managers so each ideal tile also keeps its ancestor four zoom levels up (never below the source's minzoom). It throws, so the app says so, if MapLibre no longer has these.
2. A smoke check: hold zoom 13's OpenFreeMap tiles (the Fetch domain), move the map a screen, and check that the view is drawn from the coarse tile, not paper; and that the internals it uses exist.
3. DEVELOPING's map section: what keeps the coarse tiles, why it reaches into MapLibre, and what to check on a MapLibre upgrade.
4. CHANGELOG: "Moving the map no longer shows plain paper while its tiles come: a coarser map is there underneath, and the detail sharpens in."

To check in the browser pane: MTB and paddle, 390 × 844 and 1440 × 900, drag, flick, keys and the wheel, on the network as it is and slowed; islands in a lake (a coarse tile's water must never show over the detail's land); the aerial and MML bases; offline with a saved area; frame times against today's.

## How A was tried

On 214afb8, in Chrome with its GPU at 390 × 844: Polku opened at zoom 13, the wrap above added to the `ofm` and `ofmTrails` tile managers from the console, OpenFreeMap's zoom-13 tile requests held with the DevTools protocol's Fetch domain so they never answered, then `map.panBy([700, 0])`. Within 0.8 s the tiles drawn were the zoom-9 one and the three zoom-13 ones still in view; the thumbnails showed the coarse map over the new part from 167 ms on. Without the wrap, the same held move left the new part paper.
