# The map fills in as you move it (#1091)

When you move the map, its new parts come in piece by piece, and on a fast connection that still feels slow. This is the investigation the issue asks for: what people see, measured; how other maps make theirs look ready at once; the options with their costs; and a mock-up to choose from; then what was decided and how it is built.

The mock-up: [mockups/issue-1091-map-fill.html](mockups/issue-1091-map-fill.html), a real map on OpenFreeMap's tiles that you move, on the network as it is or held a second per tile. Round 1 shows Polku filling it in as it did on 2026-11-18, with options A and B; round 2 the crossfade on long jumps, beside Polku as it is now.

## Where it stands

- **Investigated, 2026-11-18.** The user's first pick was A and B together, with a question about their cost in requests (answered under [A and B, measured](#a-and-b-measured)).
- **Decided, 2026-11-18: A** (on #1091's description), not B. The coarse map follows the base map: dark on the night map, the aerial and MML maps coarser under their own detail.
- **A: built** ([#1097](https://github.com/TommiContursi/Polku/pull/1097), merged 2026-11-19), for the vector base (`ofm`, `ofmTrails`) and the raster bases (aerial, MML's maps) alike, with smoke's `coarse`.
- **Decided, 2026-11-19: C and D next** (on #1091's description). C as Finland's zoom-6 overview, 15 tiles and 0.95 MB once, not the zoom 0–8 one; D as written. The crossfade on long jumps is shown as a mock-up and decided with /animate before it's built. A low data mode is its own idea, #1103.
- **C: built** ([#1108](https://github.com/TommiContursi/Polku/pull/1108), merged 2026-11-19). Beyond the plan: OpenFreeMap's glyph ranges are kept with the overview and the worker answers them cache first, as MapLibre draws a vector tile only once its names' glyphs have come (on Slow 4G the zoom-6 tile waited 1.9 s for two ranges).
- **D: built** ([#1115](https://github.com/TommiContursi/Polku/pull/1115), merged 2026-11-19); how it differs from the plan and what it measured: [D, as built](#d-as-built).
- **The crossfade on long jumps: a mock-up, 2026-11-19,** decided with /animate and measured, with one recommendation: [the crossfade on long jumps](#the-crossfade-on-long-jumps).
- **Tried, 2026-11-19:** the crossfade read as a sudden change and then the place building up piece by piece (the copy opened on its slow network, where the hold gives up before the place is drawn), and today's flight, zooming out and back in, felt better. So two more versions, from that idea: the map flies there as now, and the place fades in after it lands, all together or each part as it comes: [the flight, then a fade](#the-flight-then-a-fade).
- **Decided, 2026-11-19: no crossfade; the flight stays, and once it has landed each part of the place fades in** (on #1091's description). In the mock-up its fade was hard to tell from today's, so it's to be easier to see: the mock-up's Fade switch sets the first one (0.26 s) beside an even 0.4 s.
- **Decided, 2026-11-19: the fade is 0.4 s at an even pace** (on #1091's description), about the longest it should be.
- **Two more ideas from trying it:** the same fade after you move the map yourself, and a fade whose length follows how much of the map the part changes: [after a move, and by what comes](#after-a-move-and-by-what-comes). A ghost of the frame before over the map after quick swipes was fixed in the mock-up: no picture over a moving map.
- **Decided, 2026-11-19: both** (on #1091's description): the parts fade in after a move of your own too, never from the arrow keys, each over 0.2–0.4 s by how much of the map it changes.
- **The fade-in: built** (the PR after #1126); how it differs from the plan and what its cost measured: [as built](#as-built).

## What people see

### How it was measured

- **Polku on `main` at 214afb8**, served by `serve.py` on its own port, opened in Google Chrome with its GPU (Apple M1 Pro, Metal: the WebGL renderer was logged on every run), headless, at 1440 × 900 and 390 × 844, both at device pixel ratio 2 like a Mac's screen and a phone. Motion as a person has it (not reduced), the service worker on, and an empty Chrome profile each time.
- **Each move twice:** first into a place the browser had never loaded (cold), then the same move after a reload, so the tiles come from the HTTP cache (warm). OpenFreeMap's tiles may be cached for ten years and Mapterhorn's for a week, so warm is what a second visit looks like. What stays slow when warm isn't the network.
- **The moves:** a mouse drag of 600 px; six presses of → (100 px each); a finger's slow drag of 300 px that rests before it lifts; a flick, which lets go moving so the map glides on; and two notches of the mouse wheel out. In MTB and in paddle, at zoom 13, each at a different town or archipelago so that a cold run starts cold.
- **The network** as it is (a fast home connection), and slowed to Chrome DevTools' "Slow 4G" (562 ms of latency, 1.4 Mbit/s). The slowing reaches MapLibre's workers too: OpenFreeMap's tiles took 2–3 s instead of 0.3–0.6 s.
- **What was recorded,** in every frame MapLibre drew: whether each source had its tiles in view loaded, and every 90 ms a 48 × 30 grid of the screen's pixels. From the grid: how much of the screen is plain paper (the background colour, `#f5f3ee`, with nothing drawn on it) beyond what's still paper when everything has come, and when the screen is 99 % like it finally is. A strip of thumbnails every 150 ms shows what a person sees.
- **One run of each move,** on each network, at a place of its own (so a slow run's numbers say as much about what's at that place as about the move); a first round of 30 runs showed the same on the fast network (its slow runs were on a Chrome profile that wasn't empty, so they don't count). Nothing else was running Chrome on the machine. The Browser pane was hidden when the runs started (a hidden page doesn't draw), so they ran in a Chrome of their own; the mock-up was then tried in the pane.

### What it showed

- **On a fast network the map is complete when it stops moving.** MapLibre has every tile in view within 0.2–0.6 s of the move starting, cold or warm alike, so the screen is like its end state within about 50 ms of the map stopping. What shows is paper at the edge that leads, while the map moves: up to 4 % of the screen for a drag or the keys, and 23–26 % during a flick on a phone, as the map glides into places it hasn't loaded. It lasts 150–300 ms. Cold and warm look the same, so this isn't the network: MapLibre asks for a tile only once it comes into view, and then has to lay it out.
- **On a slow network the new part is plain paper for a second or more.** After a flick on a phone, three quarters of the screen is paper (with the contour lines and the hillshade where Mapterhorn's elevation tiles came first), and the map comes in square by square, a 512 px tile at a time, for 1.8 s after it stops. The wheel zooming out leaves a frame of paper round the edges for 3 s. Warm, the same moves look like the fast network's.
- **Then Polku's own layers come, each on its own.** On a fast network most are in before the map stops; what comes after is LIPAS's routes (up to 0.3 s), in paddle the nautical marks (up to 0.8 s) and Fintraffic's ships (0.6–0.7 s), and, in one run of the first round, the trail lines drawn again in their colours when trail details came (0.5 s). On a slow network the base map itself comes 0.3–1 s after the stop, the hillshade up to 3.5 s, winter ways 1.7 s, and in paddle Traficom's depth areas, depth contours and soundings (24 images per move) 2–15 s, each fading in over 150 ms. Each is a separate change you see after the map has stopped: on a fast network this, the paper during a flick and the labels' fade below are the "piece by piece".
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

## A and B, measured

On 214afb8, in Chrome with its GPU: Polku in MTB at zoom 13 with an empty profile, as now, with A, and with A and B, at the same place for each size, then six moves: on a phone four flicks and two finger drags, on a desktop four mouse drags, the keys and the wheel. A and B were added from the console as described under [How A was tried](#how-a-was-tried). "Paper" is the most of the screen that was plain background during the first move, into a place not yet seen; the later moves showed almost none in any way. The tiles are OpenFreeMap's, as MapLibre asked for them, plus what A and B fetched.

| Network, size | Paper: as now | Paper: A | Paper: A and B | Tiles as now | A adds | B adds (kB) | B's tiles later shown |
|---|---|---|---|---|---|---|---|
| Fast, 390 × 844 | 10 % | 1 % | 1 % | 15 | 2 | 19 (95 kB) | 6 |
| Fast, 1440 × 900 | 3 % | 0 % | 0 % | 23 | 3 | 67 (346 kB) | 17 |
| Slow 4G, 390 × 844 | 84 % | 1 % | 1 % | 15 | 1 | 26 (55 kB) | 6 |
| Slow 4G, 1440 × 900 | 18 % | 5 % | 1 % | 24 | 3 | 53 (575 kB) | 15 |

- **A does nearly all of it.** It takes the first move into a new place from 10–84 % paper to 0–5 %, for one to three more tiles per place (about 7–20 % more tiles).
- **B adds little that shows after A:** a sharper map at once after a short move, and on a slow desktop 5 % paper down to 1 %. It costs two to three times the tiles of today, and three quarters of them were never shown (a move goes one way; B loads all four sides). Here that was 55–575 kB per six moves; in a town, where tiles are bigger, more.
- **Neither calls any other service.** Both only fetch OpenFreeMap's map tiles: nothing goes to Overpass, LIPAS, BRouter, the weather, Traficom or Fintraffic, so their limits and Polku's pacing aren't touched. OpenFreeMap has no published limit, but it's a free, donation-funded service, and B would roughly triple what Polku asks of it.
- **On a phone's data plan,** A costs a few tens of kB per new place; B a few hundred kB more per minute of moving around a town. B should then at least stay off when the browser says to save data (`navigator.connection.saveData`).

## The options

All costs are against Polku as it is. OpenFreeMap has no published rate limit and serves from Cloudflare's cache; brouter.de isn't touched by any of these.

### A: a coarse map underneath (recommended)

Every tile in view keeps the tile four zoom levels up among MapLibre's own tiles for that source until it has come itself, as Mapbox's and MapLibre Native's `prefetchZoomDelta` does. When you then move and a tile hasn't come, MapLibre's own stand-in, the coarser tile, is already there, drawn only in the missing tile's square: lakes, sea, forest, fields and the main roads appear at once, and the paths, buildings and names sharpen in where they come. Where the detail has come, nothing changes.

- **Tried in Polku:** with zoom 13's tiles held back and never answered, a move of a screen and a half on a phone showed the zoom-9 tile in their place from 167 ms on: the forest, the open ground, the roads, the contours and the hillshade, with only the paths and small names missing ([what was run](#how-a-was-tried)); and in real moves the paper fell from 10–84 % to 0–5 % ([A and B, measured](#a-and-b-measured)). Fetching the same coarse tiles into the browser's cache instead did nothing: MapLibre never asked for them while the detail loaded (above).
- **What people gain:** almost no plain paper after a move into a place the map hasn't shown, on any network, without anything moving on screen. On a fast network that is the paper during a flick on a phone; on a slow one, one to three seconds of paper become a softer map that sharpens. It doesn't change Polku's own layers coming in after the stop, or the names' fade (D and E).
- **Requests:** a zoom-10 tile covers 16 × 16 zoom-14 tiles, so the view needs 1–4 coarse tiles (35–60 kB each over Finland) when you arrive somewhere, and almost none as you move around nearby: the same few cover a whole town. The first time in a region they load with the rest; after that they're there. Nothing goes to Polku's other services.
- **Battery and data:** a few hundred kB per new region; MapLibre draws the coarse tiles masked to where the detail is missing, so a little more drawing per frame (one or two more tiles' layers, clipped), to be measured in the build.
- **Offline:** Save offline already keeps zoom levels 5–14 of a route's area, so a saved area has its coarse tiles.
- **Code:** about 15 lines where `js/main.js` creates the map, for the OpenFreeMap sources (`ofm` and `ofmTrails`). It reaches into MapLibre's `TileManager` (`_updateRetainedTiles`, `_addTile`), since MapLibre GL JS has no option for it ([#6041](https://github.com/maplibre/maplibre-gl-js/issues/6041), where its maintainers point to a map-level prefetch API instead). Polku loads a fixed MapLibre version, so a smoke check that fails when those parts change catches an upgrade that breaks it; offering MapLibre the option itself is the clean way out, later.
- **Unknown until built:** whether the raster bases (aerial, MML's maps) and Mapterhorn's elevation tiles need it too (the hillshade and contours already come sooner); whether a coarse tile's labels ever show twice beside the detail's.

### B: A, and the area around the view loaded ahead

As A, plus the tiles at the map's own zoom half a screen beyond each edge, fetched into the browser's cache whenever the map stops, so a short move finds the detail ready too (Leaflet's `keepBuffer`, done ahead). This part does work through the cache: MapLibre asks for these tiles as they come into view, and gets them at once.

- **What people gain:** short moves show the full detail at once, not the coarse map first.
- **Requests:** two to three times the tiles of today, three quarters of them never shown ([measured](#a-and-b-measured)); only OpenFreeMap's. On a phone's data plan that's real, so it stays off when the browser asks to save data.
- **Battery:** each extra tile is downloaded and kept, though not laid out until it's shown.
- **Code:** about 25 more lines on top of A, in `js/offline.js` (which already turns an area into OpenFreeMap tile addresses for Save offline) and `js/main.js`.

### C: Finland's overview, kept by the service worker

Finland's tiles at zoom 6, 15 of them and 0.95 MB as sent (measured 2026-11-19: zoom 5 would add 6 tiles and 0.62 MB, zoom 7 is 60 tiles and 5.5 MB), saved by the service worker the first time Polku runs, as Organic Maps ships its world map. A then keeps the zoom-6 tile too, besides the one four zoom levels up, while the detail hasn't come. So the overview is there at once on the first visit to a place, when you zoom out (a view at zoom 7–10 gets zoom 6, finer than A's tile four levels up, which there is zoom 3–6), and offline anywhere in Finland.

- **What people gain:** over A, a first move into a new region of Finland and a zoom out don't wait for a coarse tile from the network; the zoom out's ragged look is softer. Offline, places never saved show Finland's lakes, sea and main roads rather than paper.
- **Requests:** 15 tiles once per install, and again when OpenFreeMap's weekly version changes only if Polku asks for them online (saved tiles are kept under a key without the version, as Save offline's are). Nothing to Polku's other services.
- **Code:** about 40 lines in `js/offline.js`, `sw.js` and `js/main.js`.
- **First proposed** as zoom 0–8 (about 270 tiles, 20–30 MB), with a setting to turn it off: too much for what it adds.

### D: Polku's own layers come in together

Each of Polku's loaders (trail details, LIPAS, lit and winter ways, and in paddle the depth data, marks and ships) waits for the map to stop and then shows what it gets as soon as it gets it, so after a stop the map changes three or four times. D holds what comes for up to about half a second after the first answer, and shows it all in one go.

- **What people gain:** on a fast network, one change after the stop instead of several; the map looks finished sooner even though nothing comes faster.
- **Requests:** none more. Starting the loaders before the map stops would add requests to the free services for places only passed by, so D doesn't.
- **What it costs people:** the first layer to come waits for the others, up to half a second; a slow one (Traficom's depths on a slow network) can't be waited for and still comes on its own.
- **Code:** a shared gate in `js/main.js` that each loader's `schedule()` reports to (`js/trails.js`, `js/lipas.js`, `js/lit.js` and the paddle layers): about 40–60 lines across five files, with smoke checks for each loader's timing. More than A, and it touches the loaders' saved-data and failure paths.

### E: names without their fade

MapLibre fades labels in over 300 ms (`fadeDuration`) once their tile has come. Setting it to 0 makes names appear with their tile.

- **What people gain:** names are there with the map, not a moment after it; one change fewer.
- **What it costs people:** names that collide while you zoom or rotate pop in and out instead of fading, which MapLibre's fade is there to soften. By DESIGN.md's "Motion" (no motion for what's seen hundreds of times a day) and /animate, the pop is acceptable; how it feels in a zoom is to be tried.
- **Requests and battery:** none; a little less drawing.
- **Code:** one option where the map is made.

### Not proposed

- **A fade or a shimmer over parts not loaded yet,** as you move the map yourself (after the camera's flight to a search result it's proposed: [the flight, then a fade](#the-flight-then-a-fade)). Moving the map happens many times a minute and from the keyboard, so by DESIGN.md's "Motion" and the /animate rules it gets no motion; a shimmer would also loop on the map while you wait. A's coarse map gives the same "it's there" without anything moving. MapLibre can't fade vector tiles anyway, only raster ones.
- **MapLibre's other settings** (above): none fills a blank part sooner.
- **Starting Polku's own layers before the map stops:** they wait on purpose, so a move doesn't send requests to free services for places only passed by.

## Building A

One PR, if chosen:

1. `js/main.js`, where the map is made: on the style's load, wrap `_updateRetainedTiles` of the `ofm` and `ofmTrails` tile managers so each ideal tile also keeps its ancestor four zoom levels up (never below the source's minzoom). It throws, so the app says so, if MapLibre no longer has these.
2. A smoke check: hold zoom 13's OpenFreeMap tiles (the Fetch domain), move the map a screen, and check that the view is drawn from the coarse tile, not paper; and that the internals it uses exist.
3. DEVELOPING's map section: what keeps the coarse tiles, why it reaches into MapLibre, and what to check on a MapLibre upgrade.
4. CHANGELOG: "Moving the map no longer shows plain paper while its tiles come: a coarser map is there underneath, and the detail sharpens in."

To check in the browser pane: MTB and paddle, 390 × 844 and 1440 × 900, drag, flick, keys and the wheel, on the network as it is and slowed; islands in a lake (a coarse tile's water must never show over the detail's land); the aerial and MML bases; offline with a saved area; frame times against today's.

## Building C

One PR:

1. `js/offline.js`: `saveOverview()` puts Finland's 15 zoom-6 tiles (box 19.0–31.6° E, 59.6–70.1° N) into the offline tile cache under their versionless keys, once, when Polku is online and the service worker runs, the way `saveArea()` does (`fetch`, `X-Size`), and keeps their keys where `dropUnused()` counts them as used, so removing a saved area never removes them. A failed tile is asked for again on the next start. Settings' offline storage counts them.
2. `sw.js`, `tile()`: a saved OpenFreeMap tile at zoom 6 or lower is answered from the cache at once, and refreshed in the background (into the same versionless key), rather than the network first with the saved copy after 4 s. Otherwise, when OpenFreeMap's weekly version changes, the browser's HTTP cache doesn't have the new URLs and the overview would wait for the network, up to 4 s, just when it should stand in. Saved areas' zoom 5 and 6 tiles get the same; coarse tiles barely change in a week.
3. `js/main.js`, A's wrap: for `ofm` only, an ideal tile above zoom 6 with no data also keeps its zoom-6 ancestor, beside the one four zoom levels up when that is above zoom 6. MapLibre then draws the finest of them that has data. Neither is kept once the detail has come, as now (round trips' water test).
4. Smoke: `coarse` holds zoom 9 and zoom 13 and checks that zoom 6 is drawn in their place, and that it's gone from `querySourceFeatures` once the detail has come; `offline` checks that removing a saved area leaves the overview's tiles.
5. DEVELOPING (the coarse map's bullet and the offline section) and CHANGELOG.

To check: offline, with the network off and the worker running, at a place never saved; online with the overview saved and the HTTP cache cleared (a new weekly version), on the slowed network, that the overview shows at once; a zoom out from 13 to 8 on the slowed network; the night map (the overview is drawn in the map's style, so dark); that under the aerial and MML bases only their own coarse tiles show.

## Building D

One PR:

1. `js/main.js`, `setData()`: after the map stops (`moveend`), the first answer from one of the loaders that wait for it (trail details, LIPAS, lit and winter ways, uphill, the nautical layers) opens a window of up to 500 ms. What comes in it is held and shown together when the window closes, or sooner once every loader that started after the stop has answered (each loader's `schedule()` says it started, one line each). What comes after the window shows on its own, as now. A route, a pick, a round trip's loops and anything you did yourself are never held.
2. A loader that fails or is cancelled says so too, so the window doesn't wait for it; a failure still shows as it does now.
3. Smoke: a check with two loaders' answers held apart by 200 ms that they show in the same frame, and one with an answer held 2 s that the other's isn't held past 500 ms.
4. DEVELOPING (the loaders' section) and CHANGELOG.

To check: MTB and paddle at 390 × 844 and 1440 × 900, on the network as it is and slowed; that nothing you do yourself waits.

### D, as built

- **Busy, not started and answered.** Rather than each loader saying when it starts and when it has answered (a path that forgets to answer would hold every stop for 500 ms), each has a `busy` getter read from what it already keeps: its update's timer, its tiles in view still on their way, and for LIPAS and the chart the timer of their drawing. The window waits while any is busy, checked once a frame.
- **Nothing busy, nothing held:** when the first answer comes and no loader is busy, it's drawn at once. A fixed 500 ms window, tried first, only made the one change most stops have half a second late.
- **Trail details' coverage** (the area where the map's own trails give way to theirs) waits with their data, or those trails would vanish for up to half a second.

Measured on a fast network at 1440 × 900, in Chrome with its GPU, one cold run per place, with what each of Polku's own sources drew after the stop and when MapLibre had laid it out:

| After the stop | Today | With D |
|---|---|---|
| A short move at zoom 13 (MTB, paddle) | 1 change, at 0.3 s | not measured; held at most until the other loaders' updates have run (their timers are 300–350 ms) |
| A move at zoom 14.5 or a jump, MTB | 3–6 changes over 0.25–0.4 s, the last at 0.6–0.7 s | 2–3 changes over 16–57 ms, the last at 0.5–0.7 s; once 5 over 0.23 s, with 726 routes and 647 trails to lay out |
| A jump, paddle | 6 changes over 0.3–0.4 s, the last at 0.7 s | 4–5 changes over 61–80 ms, the last at 0.7 s |

"Changes" are frames in which one of Polku's sources changed; MapLibre lays each source out on its own, so a burst still spans a few frames. The layers are complete at about the same time as today; what goes is the sequence before it.

On Slow 4G (DevTools' 562 ms and 1.4 Mbit/s) at the same places, D gains little and costs the half second it was allowed. The answers come over 1.9–6.6 s, as today, so most come after the window and are drawn on their own: 5–44 changes against today's 5–42, with the last at the same time. What came at 0.3 s today (the tiles already loaded) comes at 0.8 s, when the window closes.

Not measured with D: a phone. Seen after a jump in Chrome with its GPU at 1440 × 900 and 390 × 844, in MTB and paddle: every layer drawn, nothing held or busy, no errors.

## The crossfade on long jumps

When the camera jumps far (a search result, Show the whole route, an imported track), the old view could fade into the new one over a picture of it, rather than flying there and then filling in. The mock-up's round 2 shows it beside Polku as it is now, with A, C and D, at 390 px and 1440 px, on the network as it is and slowed. Nothing is built until the user chooses.

### What /animate decided

- **Whether it moves:** a long jump comes a few times in a session, not many times a minute, so it may move, when a tap or a click started it. Started from the keyboard it doesn't move (DESIGN.md, "Motion"): the old view is held the same way, and the new one shows at once. A drag, a pinch, the wheel and the arrow keys never get it.
- **What it's for:** keeping a jarring change off the screen: the new place filling in after it lands. A flight has a purpose of its own, showing where the new place is from where you were, which is why #540 kept the camera's moves, so the crossfade takes a flight's place only when the new view shares nothing with the old one. When they overlap, the camera moves there as now.
- **How:** a copy of the map's canvas, taken in a frame MapLibre draws (Polku's map has no `preserveDrawingBuffer`), laid over the map, held while the new place's map is drawn under it, at most 0.4 s, then faded out with WAAPI on `opacity`, `--t-open` (180 ms) on `--ease-out`, as anything leaving does. The new place shows at most 0.58 s after the press, sooner than today's 0.9 s flight even when it hasn't come.
- **Reduced motion:** kept, as it's opacity only; DESIGN.md has things fade in place instead of moving. Today MapLibre turns the flight into a cut under reduced motion, so this replaces a cut with a fade.
- **Interrupting:** a touch, a click, the wheel or a key on the map drops the picture at once, and a second jump replaces it. The picture never takes a touch (`pointer-events: none`).
- **Not used:** DESIGN.md's 2 px blur for a crossfade that still feels off. A blur over the whole map costs frames on a phone, so it comes only if trying the fade shows it's needed.

### The versions

- **As now: flies there.** `flyTo` (or `fitBounds`) in 0.9 s, zooming out and back in; the place then fills in: the coarse map at once (A, C), the detail sharpening in, and Polku's own layers in one change (D).
- **Crossfade once drawn** (recommended): the picture is held until the new place's map is drawn, at most 0.4 s, then fades. Polku's own layers come after it in their one change, as after any move.
- **Crossfade at once:** the picture fades straight away, and the new place fills in under it as it comes.

### Measured

On the mock-up at e7a4b49, in Chrome with its GPU (Apple M1 Pro, Metal), headless, motion as a person has it, an empty profile for each version, Finland's overview fetched first as C keeps it. Each version made five jumps from one national park or town to the next, into places the profile had never loaded (Jyväskylä, Koli, the Eastern Gulf of Finland, Pallas, Hossa, Nuuksio), on the network as it is and on DevTools' Slow 4G (562 ms, 1.4 Mbit/s). "Polku's layers" is the mock-up's stand-in for D, drawn 0.6 s after the map stops on a fast network; it says when the map stops, not how long Polku's loaders take.

| Network, size | Version | The old view goes | The new place's map drawn | Polku's layers drawn | Tiles asked for |
|---|---|---|---|---|---|
| Fast, 390 × 844 | As now: flies there | flies 0.9 s | 0.94–0.98 s | 1.52–1.55 s | 34–57 |
| Fast, 390 × 844 | Crossfade once drawn | 0.05–0.12 s | 0.05–0.12 s | 0.61–0.63 s | 5–8 |
| Fast, 390 × 844 | Crossfade at once | at once | 0.05–0.12 s | 0.61–0.63 s | 5–8 |
| Fast, 1440 × 900 | As now: flies there | flies 0.9 s | 0.94–0.97 s | 1.52–1.53 s | 55–83 |
| Fast, 1440 × 900 | Crossfade once drawn | 0.06–0.19 s | 0.06–0.19 s | 0.61–0.63 s | 7–14 |
| Fast, 1440 × 900 | Crossfade at once | at once | 0.05–0.10 s | 0.61–0.63 s | 7–14 |
| Slow 4G, 390 × 844 | As now: flies there | flies 0.9 s | 1.65–2.45 s | 1.68–2.50 s | 50–63 |
| Slow 4G, 390 × 844 | Crossfade once drawn | 0.40 s | 0.73–1.66 s | 0.76–1.70 s | 5–8 |
| Slow 4G, 390 × 844 | Crossfade at once | at once | 0.73–1.66 s | 0.76–1.71 s | 5–8 |
| Slow 4G, 1440 × 900 | As now: flies there | flies 0.9 s | 1.65–2.83 s | 1.68–2.86 s | 91–102 |
| Slow 4G, 1440 × 900 | Crossfade once drawn | 0.40 s | 0.76–1.91 s | 0.77–1.94 s | 7–14 |
| Slow 4G, 1440 × 900 | Crossfade at once | at once | 0.77–1.91 s | 0.82–1.98 s | 7–14 |

- **On a fast network the new place is finished within 0.05–0.19 s of the press,** against 0.94–0.98 s when it flies, and Polku's own layers come 0.9 s sooner, since the map stops at once.
- **In Polku itself,** with every source it draws (the base map, trails, hillshade, contours), the same five places on a fast network: a `jumpTo` had every tile in view in 0.16–0.38 s, a 0.9 s `flyTo` in 1.06–1.42 s (main at 0e87d41a, MTB, zoom 14, an empty profile each, `polku.map` from the console, at 390 × 844 and 1440 × 900). So in the app the hold matters more than in the mock-up, and 0.4 s covered all ten jumps. On Slow 4G these timings didn't hold: DevTools' slowing, set once Polku had loaded, didn't reach its map's worker, so they aren't given.
- **On Slow 4G the new place's map is drawn 0.2–1 s sooner** (about 0.9 s at four places of five), as nothing is asked for along the way. The hold then ends at 0.4 s, before it's drawn, and under the fade is what the coarse map has: Finland's overview shows lakes, sea and main roads, so on Koli's forested hill it was paper for about half a second, as the flight's middle is. A longer hold wouldn't hide it: on Slow 4G the map was drawn within 0.9 s, the flight's time, at one place of five.
- **A jump asks OpenFreeMap for 5–14 tiles, a flight for 34–102,** the tiles of the places it passes over.
- **Once drawn and at once differ by up to 0.2 s in the mock-up and 0.4 s in Polku on a fast network:** at once shows the coarse map and the detail coming in under the fading picture; once drawn shows the place finished. On Slow 4G once drawn shows the coarse map 0.4 s later.
- **A first set of these runs doesn't count:** it fetched the overview over the slowed network, and some of a flight's tiles failed when asked for twice. Both were fixed in the mock-up and run again.

### The crossfade, as first recommended

Crossfade once drawn was recommended first. For a far jump started with a tap or a click: the place you asked for is there, finished, within 0.4 s on a fast network (0.16–0.38 s in Polku), rather than after a 0.9 s flight and its filling in, and Polku's own layers come 0.9 s sooner. On a slow network it's never later than the flight: 0.4 s of the old view, then what the coarse map has until the place comes, 0.2–1 s sooner than after a flight. It asks OpenFreeMap for a fifth to a tenth of the tiles. What it costs people: you no longer see which way the new place lies from where you were; the search result's name and its card say where you went. What it costs to build: about 40 lines and four callers, a smoke group, and a canvas the size of the screen for under a second.

Crossfade at once is the simpler of the two (no hold, about 10 lines fewer) and differs only in what you see under the fade. Leaving it as it is stays a fair choice now that A, C and D are in: the flight's 0.9 s and its filling in are what remains.

### The flight, then a fade

From trying the crossfades: the flight itself, zooming out and back in, is what feels right, and what reads as broken is the place building up after it lands, the base first, then the roads, then Polku's own layers, each appearing at once. So two versions keep today's flight and change only how the place comes in after it, both by /animate's rules above: `opacity` in `--t-sheet` (260 ms, as what enters is a sheet's size or more) on `--ease-out`, nothing fades from the keys (the flight is as today), reduced motion keeps the fades as they're opacity only (MapLibre turns the flight into a jump), and a touch on the map ends them. (A first build of these two jumped without flying; it was the wrong reading of the idea and was replaced.)

- **Flies there, all fades in:** where the map lands, a picture of it is held, so nothing comes in on its own, until the place is drawn with Polku's own layers, at most 2 s; then the finished place fades in all together.
- **Flies there, each part fades in:** after the map lands, each part that comes (the detail, Polku's own layers) fades in rather than appearing: the screen as it was is laid over the map and faded out whenever MapLibre draws a part that has come. To have that picture it copies every frame it draws, so it runs only from the landing until the place is drawn, at most 3 s. MapLibre can't fade a vector tile in on its own.

Every search result in the mock-up now goes to a place the map hasn't loaded, as one usually does: what the page kept of the places before is forgotten first, all but Finland's overview. Before, a place visited once came back finished, with nothing left to fade in.

Measured as the crossfades were, on the mock-up at 01ca0b7 (five flights, places never loaded):

| Network, size | Version | The map drawn after landing | The finished place shows | Polku's layers drawn |
|---|---|---|---|---|
| Fast, 390 × 844 | As now: flies there | 0.95–0.98 s | as it comes | 1.52–1.53 s |
| Fast, 390 × 844 | Flies there, all fades in | 0.94–0.97 s | 1.52 s, all together | 1.52 s |
| Fast, 390 × 844 | Flies there, each part fades in | 0.94–0.96 s | each part as it comes | 1.52–1.53 s |
| Fast, 1440 × 900 | As now: flies there | 0.95–0.99 s | as it comes | 1.52–1.54 s |
| Fast, 1440 × 900 | Flies there, all fades in | 0.95–0.98 s | 1.53–1.55 s, all together | 1.53–1.55 s |
| Fast, 1440 × 900 | Flies there, each part fades in | 0.95–0.99 s | each part as it comes | 1.52–1.54 s |
| Slow 4G, 390 × 844 | As now: flies there | 1.65–2.43 s | as it comes | 1.68–2.45 s |
| Slow 4G, 390 × 844 | Flies there, all fades in | 1.64–2.44 s | 1.67–2.47 s, all together | 1.67–2.47 s |
| Slow 4G, 390 × 844 | Flies there, each part fades in | 1.62–2.73 s | each part as it comes | 1.67–2.76 s |
| Slow 4G, 1440 × 900 | As now: flies there | 1.64–2.82 s | as it comes | 1.68–2.87 s |
| Slow 4G, 1440 × 900 | Flies there, all fades in | 1.64–2.81 s | 1.67–2.88 s, all together | 1.67–2.88 s |
| Slow 4G, 1440 × 900 | Flies there, each part fades in | 1.64–2.83 s | each part as it comes | 1.67–2.86 s |

- **Neither changes when anything comes,** only how: the timings are today's flight's. Times are from the press; the flight takes 0.9 s.
- **All fades in holds the landing still for about 0.55 s on a fast network,** though the map is drawn as it lands, as it waits for Polku's own layers (in Polku, 0.5–0.7 s after the camera stops: [D, as built](#d-as-built)). On Slow 4G the landing is mostly paper (Finland's overview in a forest), held until the place is drawn, then one fade.
- **Each part fades in leaves the map live:** the detail and Polku's layers come when they come, each softened over 0.26 s.
- **Why the fade is hard to see on a fast network:** the place's tiles are asked for in the flight's last zoom-in and have mostly come as it lands, while the camera still moves (no picture of the frame before can be laid over a moving map), so what's left to fade in is mostly Polku's own layers. And the first fade, 0.26 s on `--ease-out`, is most of the way in after 0.1 s. The Fade switch's even fade is 0.4 s at a steady pace, as MapLibre fades the map's names in (0.3 s), so the fade itself shows. On Slow the detail comes after the landing and fades in too.
- Checked: from the keys the flight is as today and nothing fades; a touch on the map ends the hold or the fading part at once; with reduced motion both fade on `opacity` only and the flight is a jump; no errors; in the Artifact copy a place visited before asks for its tiles again.

### After a move, and by what comes

Both chosen, 2026-11-19. Two ideas from trying the chosen version, the same day: moving the map sideways shows the same building up from pieces, so it should fade in too; and how long a fade wants to be depends on the place, longer where much comes at once (a town's paths and streets) and shorter where little does (a few paths in a forest).

- **After a move: fades in too.** When you've dragged, flicked, pinched or wheeled the map yourself, what comes once it stops (squares still on their way, Polku's own layers) fades in as after a flight, until the map is drawn and Polku's loaders aren't busy, at most 3 s. While the map still moves nothing can fade: a picture of the frame before wouldn't line up with a moving map, and MapLibre has no fade for vector tiles. From the arrow keys nothing fades (DESIGN.md), and a touch, the wheel or a key ends a fade at once.
- **No picture over a moving map.** Trying it, quick swipes and mouse flicks left a ghost of the frame before over the map. Grabbing the map again while it still glides ends the glide with a `moveend` while you're already dragging, so a fade began under your finger: in quick mouse flings in Chrome, 148 of 435 frames drawn while the map moved had a picture over it. Now a picture goes the moment the map moves and a fade starts only on a still map: 0 of 465, and the fades after a stop still come.
- **Fade: by what comes.** As the even fade, but its length follows how much of the map the part changes: the frame before and the frame with it, each shrunk to 48 × 30, compared cell by cell; 0.2 s for a part that changes little, rising to 0.4 s when a quarter of the map or more changes. Measured in the Artifact copy after flights to the six places, at 1440 × 900 and 390 × 844: the place's detail coming after the landing changed 74–100 % of the map and faded over 0.4 s everywhere; Polku's own layers changed 58–74 % at Jyväskylä's harbour (0.4 s) and 0–5 % in the forests (about 0.2 s); after a drag at the harbour the parts changed 0–21 % and faded over 0.2–0.37 s.
- **What /animate says about the first:** moving the map comes many times a minute, and what comes that often gets no motion or near-imperceptible motion. This fade moves nothing and delays nothing: the map is yours at once, and only what comes after the stop softens, as MapLibre already fades the names in after every move (0.3 s). Whether 0.2–0.4 s after every stop feels slow when you move around a lot is what to try; by what comes keeps it short where little changes.
- **What they cost:** after every stop, a copy of each frame drawn until the map is drawn (on a fast network about 0.6 s, as Polku's own layers come then), and for by what comes two 48 × 30 readings per part. On a phone that's battery and frame time many times a minute, the first thing a build measures.

### Chosen: flies there, each part fades in

Recommended, and chosen on 2026-11-19, with its fade still to be settled (above). For a search result, Show the whole route and the other camera moves of #540: the flight stays, and nothing in the new place appears at once, on any network, while the map stays live. What it costs to build: about 40 lines, the callers that fly, a smoke group, and a copy of every frame for up to 3 s after a flight lands, whose cost on a phone is the first thing a build measures (frame times against today). If that costs too much, all fades in is the cheaper one: one picture, one fade.

An idea for a next round, not built: the place drawn out of focus while it builds after the landing (a CSS blur on the map's canvas), coming into focus in one step once it's drawn, as a photo does while it loads. It shows something even where the overview has nothing, and hides the squares' edges; a full-screen blur costs a phone's GPU while it lasts.

### Building it

As decided on 2026-11-19: the flight stays; whenever the map stops, after it flies to a place or after you move it yourself, what comes in after the stop fades in, each part over 0.2–0.4 s by how much of the map it changes. One PR:

1. `js/main.js`, beside the coarse map, as the mock-up's `partsFrame()` and `afterMove()`, about 60 lines:
   - On `moveend`, unless the last input before the move was a key (anywhere: the map, the search box, a button; a document-level listener that notes whether the last `keydown` or `pointerdown`/`wheel` came last) or the map is still moving: from then on, each frame MapLibre draws is copied, and when a frame shows a part that has come (a `sourcedata` event with a tile, Polku's own layers' sources included), the frame before is laid over the map and faded out on `opacity`, `linear`, over 200 ms + 200 ms × (the share of 48 × 30 cells that changed ÷ 0.25), at most 400 ms.
   - It stops when the map is drawn and Polku's loaders aren't busy (D's `busy`), or after 3 s.
   - The picture goes the moment the map moves, and a touch, a click, the wheel or a key on the map ends a fade at once. The picture lies above the canvas and the HTML markers, under the map's controls and cards, and never takes a touch.
   - Reduced motion keeps it, as it's opacity only. Nothing else changes: no fade while the map moves, no fade before the first view is drawn, and a share link's or the first view's camera move is a jump, as now.
2. Smoke, in a new group `fadein`: after a search result's flight and after a move with the mouse, a part that comes fades in with an `opacity` animation of 200–400 ms; with reduced motion the same; after a move with the arrow keys, and after a search result chosen with Enter, none; a touch on the map ends it; and quick flings with real mouse input, grabbed again while the map glides, never leave a picture over a moving map (as the mock-up's `ghost.py` in the session notes counts).
3. DESIGN.md's "Motion" (the map's line: what comes after the map stops fades in, 0.2–0.4 s by how much it changes, never from the keys), DEVELOPING's map section, and CHANGELOG: "When the map stops, after you move it or it flies to a place, what comes in no longer appears piece by piece: each part fades in, briefly where little changes and up to 0.4 s where much does."
4. It moves things, so the session stops before its PR opens and asks the user to run /review-animations.

To check in the build:

- Frame times and battery on a phone while you move around a lot: a frame is copied after every stop until the map is drawn (on a fast network about 0.6 s, as Polku's own layers come then), and each part that comes reads two 48 × 30 images. This decides whether it ships; measure it first, against main.
- A result's card opens when the camera stops, as now, while its place is still fading in. Whether that reads well is to be tried.
- HTML markers (the route's points, your position, a card's pin) aren't in the map's canvas: under the picture they'd seem to wait for it, above it they'd appear at once. Try both.
- The copies take two canvases of the screen's size: about 20 MB each at 1440 × 900 on a Retina screen, 12 MB on a phone.
- The night map, the aerial and MML bases (raster tiles, already faded by MapLibre's `raster-fade-duration`: one fade, not two), 3D, and Safari and Firefox, on a real phone on a real mobile network.

### As built

- **The picture lies under the markers,** right after the map's canvas: above them it would hide every marker and fade it back in each time a part came. It lies under the weather's wind and rain canvases too, and under the controls and cards, as planned.
- **Nothing fades before any input,** as from the keys: the first view, a share link's and a spot's jump come as before, with no flag of their own. Nor do the moves that follow your position, which come with every fix: copying frames after each of them would cost a phone's battery on the trail.
- **What counts as a part:** a tile of any source, except a GeoJSON source other than Polku's own layers (`TOGETHER`), so a hover, a pick or the route never waits for a fade, and a raster that fades in by itself (`raster-fade-duration` not 0: the photo and terrain bases, the overlays), so those fade once. Hillshade, contours, the trails' and shadows' tiles and the weather's fields count.
- **"The map is drawn"** is `map.loaded()`, not `areTilesLoaded()`: a GeoJSON source's `setData` is on its way to its worker for a frame or two after D draws, and the tiles alone would say drawn before Polku's own layers had come.
- **Two canvases,** reused: the frame before becomes the picture, and the picture that faded becomes the next copy. Their size is set to 0 once nothing fades.
- **One reading per part:** each `getImageData` waits for the GPU to finish the frame, 5–12 ms in Chrome on an M1 whether it reads the map's canvas, a copy of it, or a `createImageBitmap` later; so both frames are drawn into one 48 × 60 canvas and read once.

What it costs, measured first, against main at ff0af452: headless Chrome with the Mac's GPU (Apple M1 Pro, no SwiftShader), motion as a person has it, a cold profile each run, MTB at Jyväskylä, twelve real flings in a row (touch on the phone page, the mouse on the desktop), each in a new direction and 2.2 s apart, so that parts come after every stop. The phone page is 390 × 844 at a device pixel ratio of 3 (the canvas 1170 × 2532) with the CPU slowed 4×; the desktop 1440 × 900 at 2. What would have been too much was written down first: on the phone page, the `render` listeners' time per frame in the 3 s after a stop rising by more than 2 ms at the median or 6 ms at p95, frames over 33 ms in the 1.5 s after a stop rising by more than one per stop, or the p95 frame interval there by more than 4 ms.

| Two runs each | Fades | Frames over 33 ms after the stops | p95 frame after the stops | `render` listeners after a stop: median, p95 | A part's frame |
|---|---|---|---|---|---|
| Phone page, main | 0 | 11, 11 | 16.7–16.8 ms | 0, 0 ms | – |
| Phone page, built | 5, 7 | 8, 10 | 16.8 ms | 0, 0.8 ms | 7–13 ms |
| Desktop, main | 0 | 1, 1 | 16.7 ms | 0, 0 ms | – |
| Desktop, built | 20, 16 | 1, 0 | 16.7–16.8 ms | 0, 0.2 ms | 12–15 ms |
| Phone page with a route (its chevrons drawn every frame), the timeline, wind and rain, main | 0 | 8, 4 | 16.7–16.8 ms | 0, 0 ms | – |
| The same, built | 2, 2 | 8, 10 | 16.8 ms | 0, 0.6 ms | 5–12 ms |

(With a route, the swipes were shorter, above the planner's sheet, so fewer parts came: ten stops a run.)

Copying a frame costs 0–0.1 ms of the main thread; the cost is each part's reading, a frame of 7–15 ms once per part. Reading the two frames apart, as first built, made a part's frame 10–29 ms. Not measured: a real phone (its GPU may wait longer for the reading), Safari and Firefox, the battery.

## How A was tried

On 214afb8, in Chrome with its GPU at 390 × 844: Polku opened at zoom 13, the wrap above added to the `ofm` and `ofmTrails` tile managers from the console, OpenFreeMap's zoom-13 tile requests held with the DevTools protocol's Fetch domain so they never answered, then `map.panBy([700, 0])`. Within 0.8 s the tiles drawn were the zoom-9 one and the three zoom-13 ones still in view; the thumbnails showed the coarse map over the new part from 167 ms on. Without the wrap, the same held move left the new part paper.
