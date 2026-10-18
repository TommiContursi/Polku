# Developing Polku

Polku is a static site with no build step and no backend: `index.html`, plain ES modules, and MapLibre GL JS from a CDN. [polku.si](https://polku.si) is served by GitHub Pages from `main`.

What to do is on GitHub: the [issues](https://github.com/TommiContursi/Polku/issues), the [milestones](https://github.com/TommiContursi/Polku/milestones) and the [board](https://github.com/users/TommiContursi/projects/1). The order of the phases is in [ROADMAP.md](ROADMAP.md), their designs in [plans/](plans/), and what's shipped in the [changelog](../CHANGELOG.md). This file is how Polku works.

How to work on it (what to work on, testing, pull requests, bugs and findings, writing) is in [AGENTS.md](../AGENTS.md), for people and coding agents alike.

## Bugs and reviews

- Every bug, improvement, idea and risk to watch is a [GitHub issue](https://github.com/TommiContursi/Polku/issues), the one place for its status, labelled by kind (`bug`, `enhancement`, `idea`, `watch`) and size (`small`, `medium`, `big`). Each planned phase, and each round of fixes, is a milestone. ROADMAP orders the phases.
- `docs/retros/` keeps a short retro for each finished milestone: what cost time, what to keep, and what changed in AGENTS.md because of it.
- `docs/reviews/` keeps dated reviews of the code with the evidence they were based on. They aren't updated afterwards: what has happened since is in the issues. The first is the [review of 15 October 2026](reviews/2026-10-15/README.md), listed in [#63](https://github.com/TommiContursi/Polku/issues/63).

## Running it

```bash
python3 serve.py        # → http://localhost:8765
```

Any static server works; `serve.py` just turns off HTTP caching while you edit.

With the dev server running and Google Chrome installed:

```bash
python3 tools/smoke.py                  # layout at 5 sizes, trail details, LIPAS, water routing: no overlaps, no console errors
python3 tools/smoke.py --list           # every group and size, with what it checks
python3 tools/shoot.py shots after      # screenshots for a pull request (--list for the scenes)
python3 tools/readme_shots.py           # legacy README scenes, into docs/screenshots (WebP)
tools/brouter-local.sh                  # optional: BRouter on this computer (Settings → Routing server)
python3 tools/style_probe.py --presets  # does every route style change the route? (against the local BRouter)
python3 tools/loop_probe.py             # how long do round-trip loops ride? (calibrates js/roundtrip.js)
python3 tools/water_probe.py            # paddling legs before/after the water costs: length, ms, grid cells
```

The tests answer from recorded files in `tools/fixtures/` (a route, an Overpass tile, LIPAS answers, Väylävirasto fairways), so they make no routing calls. `tools/brouter-local.sh` starts BRouter on your computer for anything that does route; please don't burst-test brouter.de.

The README links JPEGs on the `pr-screenshots` branch. Capture its current scenes with `tools/shoot.py`: `desk-planner`, `desk-trails-close`, `phone-planner`, `desk-trail-headsup` and `desk-water-crossing`. Check the images, convert them to JPEG, put them under the documentation branch's name on `pr-screenshots`, and update the README links. Keep new images off `main`.

Headless Chrome draws the map in software, and one frame can take a second when the computer is busy. So a check waits for the state it tests, not a fixed time: the next animation frame for something the app does in one, `SETTLED` in `tools/smoke.py` for the planner's size.

The `otherways` quick-point check schedules its edit in the same turn as the first leg's alternative-route timer, then waits for the final leg's offer. It also blocks the main thread for 2.2 seconds so both timers are overdue, checking that a slow frame preserves their order. Keep the request-count, requested-leg and offered-leg assertions; the separate pause case checks that waiting really does fetch an earlier alternative.

### Writing a smoke check

- A group is a function in `tools/smoke.py` that takes `chrome`, opens a page (`chrome.page(w, h, phone)`, then `pg.open_app(...)`), runs a script with `pg.js(...)` that returns a list of failures, adds `pg.errors()` as console failures, prints `ok` or `FAIL` with them, and returns whether it passed. Add a row to `GROUPS`, just above `main()`: a short name, its functions and a one-line description. `main()` runs from that table and `--list` prints it, so `python3 tools/smoke.py <name>` runs the group alone; a name that isn't in it stops the run before Chrome starts, with exit code 2.
- A group that raises (a script error in the page, Chrome not answering) prints `FAIL` with the error's first line, and the next group still runs, in a fresh Chrome if this one stopped answering. Still catch what you can and say what failed.
- When another run already holds the Chrome profile (`POLKU_CHROME_PROFILE`, or `~/.cache/polku-tools/chrome-profile`), `tools/cdp.py` gives this run a temporary profile, says so in one line, and deletes it afterwards. That run starts without the cached tiles.
- Answer from `tools/fixtures/` (fetched from `location.origin`), and hold or seed the fetches the check doesn't test, as the existing groups do. Never route against brouter.de.
- Do what a user does: click, drag and type on the real controls, not the module's functions.
- Wait for the state you check (the next animation frame, `SETTLED`), never a fixed time.
- `open_app()` returns once the map has loaded, which can be a frame before MapLibre's `load` event runs Polku's own load step. On phones that step opens a saved timeline, and the map's buttons then move up above it (#292). Before measuring them, wait for the timeline and `SETTLED`, and take a button's place again right before each tap or click, as `button3d` does.
- A fix's check must fail without the fix: run it on a worktree of `main` first.

## How the trickier parts work

- **In-app release notes** (`js/changelog.js`): Settings opens the shared native dialog and requests the deployed `CHANGELOG.md` through `request('polku', …)` only on opening or Retry. The service worker may supply its saved copy, so the view shows the notes’ latest date and an explicit saved-copy label when offline. Headings, paragraphs, bullets, bold text, code and HTTP(S) links are built as DOM nodes; HTML and unsafe URL schemes never execute. Relative links point to the repository. Closing aborts a pending request and restores focus; dialog key events stay out of the map shortcuts.

- **Style** (`js/style.js`): one function builds the whole MapLibre style from app state and is applied with `setStyle(..., {diff: true})`. Sport, base map and overlays are all just state.
- **Uphill grades** (`js/uphill.js`): trails in the loaded vector tiles are resampled every 8 m and sampled against the terrarium DEM (`js/dem.js`, bilinear, z14 ≈ 2.3 m/px). They are smoothed over 24 m, cut into ~25 m pieces and graded by the `mtb:scale:uphill` limits (10/15/20/25/30 %). Each piece points uphill, so the arrows point up the climb. Explicit OSM tags win. Graded trails are kept and not graded again, except those a terrain tile failed for: they're graded again on the next map move, so they get their colours once the terrain is back.
- **Terrain that doesn't load** (`js/dem.js`, `js/analysis.js`): a missing tile falls back to zoom −2 and −4. A tile that failed (network, HTTP error, bad file) is asked for again after 15 s; one that answers 404 isn't. The route's analysis marks where heights are missing (`eleGap`, `terrain`), draws a straight line across a gap, and times the route as flat where nothing is known. The planner analyses the route again after 20 s, then less often, and at once on `online` or Retry, and takes the new analysis once more terrain is in.
- **Trail details** (`js/trails.js`): one Overpass query per z13 tile, cached a week in IndexedDB (`js/osm.js`), gives width, visibility, overgrown and wet stretches, fallen trees, gates, fences and fords. Inside loaded tiles the trails are redrawn from OSM, and the vector tiles' own trails are hidden there with a `within` filter. Along a route, BRouter's `processUnusedTags` returns the same tags for the Heads-up.
- **Routing without a server of our own** (`js/router.js`, `js/net.js`, `js/valhalla.js`):
  - **brouter.de** is a free public BRouter that refuses (403 "Please, retry later!") when one address calls too often. So Polku stays well under it:
    - at most 5 calls in 10 s and 12 a minute;
    - consecutive legs in one call;
    - the routed geometry saved with your route;
    - a drag's live preview only while there's budget to spare.
  - **Valhalla stands in** when brouter.de pauses: the FOSSGIS servers that openstreetmap.org uses, at one call a second at most, as their terms ask. Heads-up says so.
- **Route dragging** (`js/planner.js`): `onLinePress()` ignores presses originating in MapLibre markers and popups. Markers handle their own drag; starting the line's gesture from the same bubbling press could split the leg twice. `python3 tools/smoke.py editing` checks midpoint-handle and direct-line drags, one new point, Undo/Redo and restored panning with mouse and touch in four sports.
- **Route styles** (`js/styles.js`): BRouter's `profile:name=value` parameters override a stock profile's global variables, so most styles need no custom profile. The exceptions are Polku's own profiles, each uploaded once per session: road cycling's `profiles/polku-road.brf` costs gravel main roads as rough, and Short cuts ok (Ways marked private, #106) uses copies of the four stock profiles with an `allow_private` variable (`profiles/polku-hike.brf`, `polku-mtb.brf`, `polku-gravel.brf`, `polku-road-shortcuts.brf`, made by `tools/make_profiles.py`; with it off they route exactly as the stock ones). Every preset was checked to change real routes (`tools/style_probe.py`).
- **Water routing** (`js/water.js`, `js/waterdata.js`):
  - **The grid:** a hidden MapLibre map renders only water, white on black, for the leg's area, and the pixels become a grid. A second drawing on a canvas, in the same projection, marks the costs:
    - Väylävirasto's fairways, by class (shipping lanes are crossed straight);
    - keep-clear zones round danger and cardinal marks and OSM rocks and shoals;
    - places you avoid.
  - **Wind:** each water cell's open-water fetch upwind gives a wave height (JONSWAP), and rough water costs more for the craft.
  - **The path:** A* runs on the grid, and the cell path is string-pulled into straight lines that may not cost more than A*'s way. Land is passable at a high cost, which gives carries.
  - **Slow sources:** each source gets 2.5 s; then the leg is routed without it, Heads-up says so, and neither `router.js` nor `water.js` keeps that leg. When the answer comes (`onWaterData`), the planner routes those legs again, and a leg still being routed then is routed once more in `water.js`.
  - **No depths.** Traficom's depth data isn't used: its licence excludes route planning. See phase 13 in [plans/done.md](plans/done.md).
- **LIPAS routes** (`js/lipas.js`, `js/search.js`):
  - **Precision:** geometry comes in EPSG:3067 at full precision and is converted in `js/geo.js`, because LIPAS's EPSG:4326 output is rounded to about 10 m.
  - **One line:** a route's parts are joined at junctions into one line where they can be ridden each once (an Euler path), and ridden as fixed legs, with no routing calls.
  - **Share links** carry those legs as references (`lr=`), not as lines.
  - **Search** asks LIPAS's combined layers by name: three small requests per query.
- **Distance marks** (`drawMarks()` in `js/planner.js`): use the same timed samples as the profile, including stops and changeovers, preferring the wind-adjusted times once available. The existing `routeMarks` setting has `km`, `time` (arrival) and `duration` (elapsed); missing fields default on, and saved values still win. Arrival uses the selected departure immediately, even while the forecast is loading. `revealDeparture()` takes the summary estimate to the large picker at Go → Time. That picker lives outside the rebuilt time table so analysis updates keep its focus. `departSelect()` creates all departure controls; `refreshDepartSelect()` refreshes their relative-hour options in place, and `setStartOffset()` synchronizes them and updates Go's schedule before the forecast returns.
- **Route colour breakdowns** (`js/planner.js`): Check's `renderBreakdown()` shows every applicable kind with data using `breakdownRows(mode)`, independently of `colorMode`, in persistent groups from `COLOR_GROUPS` (also used by the profile colour menu). Empty groups are hidden. The groups form responsive columns inside Check’s full-width breakdown section. Each title and decorative bar share one `.bd-title` button and keyboard stop, calling `pickColor(mode)` to select the profile mode and enable map route colours. Each group header controls its entire `.bd-group-list`; individual kinds have no fold button. Legends align distances in one column, or two when the group is at least 480 px wide; each kind keeps its controls and focus across redraws. Group folds use `colour-group-<name>` keys in the existing `sections` setting. On first data for a group, an existing group choice wins; otherwise the group starts closed only if all its available kinds were folded under the old `colour-<mode>` keys. Late data preserves the group’s current fold and focus. Late weather and trail details refresh these bars even when another colour is selected. Unknown stretches remain in a kind's totals once that kind has data, and short categories stay in the bar and legend.
- **Category previews** (`js/planner.js`, `js/style.js`): `breakdownKey(mode, i)` is the per-sample category identity used by both breakdown sums and previews; `breakdownRows()` adds that key as its fourth tuple item. Previewing a bar segment or legend row builds separate LineStrings for contiguous matching edges into the `routePreview` source, with contrasting casing and the category colour above the normal route. It never changes `colorMode`, `colorOnMap`, route geometry or camera. Keys distinguish categories with the same RGB value. The title button provides one keyboard entry per kind: focus previews the first category; Left/Right/Home/End choose a category, Escape clears, Enter keeps the usual selection action. Pointer ownership prevents a late leave from clearing a newer preview; touch pointer enters are ignored. Data redraws, departure changes, editing, group/section folding, changing tabs, minimising/closing the planner, scrolling a pointer target away and losing window visibility clear the preview. The preview source is separate from profile/map point hover, leg highlighting and selected climb ranges.
- **Weather** (`js/weather.js`, `js/wxmap.js`):
  - **The grid:** forecasts are fetched per point of a fixed, nested lattice and kept an hour, so small moves reuse them. Open-Meteo counts every location as a call.
  - **Along the route:** the route is timed without wind, the forecast is sampled at each point for the hour you'd be there, and the time is estimated again with the head- and tailwind.
  - **Radar "now"** is FMI's rain-rate GeoTIFF, decoded in the browser.
- **Share links** (`shareUrl()` and `parseShared()` in `js/planner.js`): the route in the query string. A part that's empty or the default is left out, and links from before a part was added still open.
  - `r`: the points (an encoded polyline, 5 decimals); `m`: each leg's mode (`a` routed, `l` straight, `w` water); `a`: the sport.
  - `p`, `ps`: the route's style, and legs with their own. `s`: each leg's sport; `cw`: changeover minutes you set.
  - `st`: stops and nights (in `js/stops.js`); `cg`: points where the gear goes along. `lr`: LIPAS legs as references.
  - `al`: another way taken for a leg (#95), BRouter's alternative `k` as `leg:k`, comma-separated; left out when every leg takes its first way.
  - `av`: places to avoid, `lon_lat_metres` each, comma-separated (`av=24.94012_60.17543_40`), about 24 characters a circle. At most 200 are read; anything that doesn't read as a circle is left out, and a toast says the route may go through it.
  - Names of points and of places to avoid stay on the device.
- **Offline** (`js/offline.js`, `sw.js`): the tiles along a route corridor at zoom 5–14 go into Cache Storage, and the service worker serves them when the network is slow (4 s) or gone. OpenFreeMap's weekly tile version is stripped from the cache key. The routed line is saved with the area.
- **Framing above the planner** (`frame()` in `js/planner.js`): every camera move that shows a route, a loop, a stretch or an imported track goes through it, not `map.fitBounds` with padding of its own. The padding keeps clear of the top bar and the side panel or sheet. A full sheet comes down to half first, and the padding never takes more than three quarters of the map, because MapLibre skips a fit that can't be made with only a console warning. While the sheet changes size, `sheetTop()` uses the height it's going to, from the heights in `css/app.css`: keep the two in step.
- **Where you are** (`js/locate.js`, `js/heading.js`): Polku watches the GPS itself (not MapLibre's geolocate control) and stops while the page is hidden. The dot glides to each fix; while following, each frame moves the map so the dot stays in the middle of the free map (`planner.viewPadding`), and only until it has arrived. Map moves made for you carry `{ polkuFollow: true }`. A pan (`dragstart` with one finger) or any other move that shifts the map's middle stops following; zooms and turns about the middle keep it. The heading is the compass below 1 m/s and the GPS's course above it. Fixes stay in memory: while location is on, the map's view isn't saved. `tools/smoke.py heading` feeds a GPS and a compass of its own.
- **The route's moving chevrons** (`js/routeflow.js`, #198): a MapLibre custom WebGL layer over the route line, because a style can't move symbols along a line without laying them out again every frame. The legs go to the GPU as a strip relative to the route's first point (float32 keeps metres there), and the fragment shader draws the chevrons from the along-the-line distance in screen pixels minus time. MapLibre 5 gives custom layers `defaultProjectionData.mainMatrix` for mercator units; `modelViewProjectionMatrix` is for world pixels. Each frame redraws the whole map, so it runs at 24 frames a second at most, only while the route is in view, and rests after 45 s without a touch; reduced motion, 3D terrain and the Settings switch stop it, and the style's static arrows come back (`ctx.flowMoving`). `setStyle(…, { diff: true })` leaves custom layers alone; `styledata` puts it back if a style ever drops it. While it moves, MapLibre fires `idle` between its frames (up to 24 a second), so keep `idle` listeners cheap, or check that something really changed.
- **One swipe for every sheet** (`js/sheet.js`, #96, #123): the planner's sheet on phones (and docked at the bottom), the quick layer drawer and, on phones, the full Layers panel. `swipeSheet(el, …)` thinks in visible heights: the caller says where a drag may start (`grab`), its sizes and what happens at rest (`start`, `end`). Its numbers (start after 10 px, a flick from 1.1 px/ms, Apple's projection with deceleration 0.998, the spring, the rubber band, `peekCloses`) are `SWIPE`, in one place, to tune on real phones with #123's plan.
  - **The pointer:** it watches pointer events on the sheet; once a drag starts it takes the pointer (`setPointerCapture`), so a drag that starts on a button moves the sheet and doesn't press it. That button's own `lostpointercapture` bubbles up then: only the sheet's own ends the drag.
  - **A scrolling body** hands over only where it can't scroll that way itself. Chrome and Safari start scrolling a `pan-y` body on their own, so a `touchmove` listener that isn't passive calls `preventDefault()` as soon as the sheet has the gesture (iOS has no `pan-down`). The first clear move decides, before the browser's own slop.
  - **While it moves** the sheet only has a transform. The planner makes itself as tall as its full size for the drag (`.dragging` shows what each size hides), and `restSheet()` sets the size at rest while transitions are still off; `--sheet-h`, which the map's buttons follow, and `locate.kick()` wait for its `sheetrest` event. A size set from code while it moves (`setSheetState()`) stops the swipe first.
  - **Tests:** `tools/smoke.py quick` swipes with real touches through CDP (`Page.swipe()`, with their own timestamps: a slow test machine handles them late, and the speed must be the one sent). Headless Chrome runs with reduced motion, so the sheets jump to their size instead of the spring.
- **The quick layer drawer** (`renderQuickLayers()` in `js/main.js`, #123): Layers and L open it; its steps are a tile's settings (›) and Edit, and More opens the full panel (`openPanel('layers-panel', { step: true })`). `QUICK_TILES` and `QUICK_TILE` in `js/config.js` say which five tiles each sport has and what each turns: a tile id is the state it turns (an overlay, a trail setting, `wx:rain`, `hillshade`), so `setTile()` calls the same `setOverlay()`, `setTrail()` and `setWeather()` as the full panel, whose switches are built by the same functions (`trailControls()`, `overlayToggle()`, `wxToggle()`), so a tile's › shows exactly the panel's switches. `renderLayersPanel()` renders both. 3D terrain has no tile: the 3D button in the map's column (#226) and Layers' switch both call `set3d()`, and `syncView3d()` keeps the button's `aria-pressed` with `state.terrain3d`.
  - **Settings:** `quickTiles` (per sport, only once edited; unknown ids skipped), `depthsBack` (the depth layers the Depths tile brings back), and `colorsBack` in `trailsByActivity` (the colours Trail colours brings back; `trailsFor()` keeps it out of `state`).
  - **Status on a tile** (`tileStatus()`): the layer's zoom, `sourceStatus()` from `js/net.js` for its service, and for raster overlays the map's own tile errors (`ov-<id>`) against the last tile that came in.
  - **Phones:** a scrim (`#quick-scrim`) under the sheet takes the tap on the map, so the tap that closes the drawer reaches neither the planner nor the map. **Desktop:** `placeQuick()` keeps the card's bottom level with the Layers button, above a bottom planner.
- **Settings over the planner on phones** (`placePanels()` in `js/main.js`, #240): Settings sits above the planner's sheet, as tall as the room under the top bar allows (`--sheet-h` in its `max-height`). With under 320 px there, the room `placeQuick()` wants on a desktop, `body.panels-over` puts it over the sheet in the sheet's place, and lifts the top bar so its menus still open over it. The sheet keeps its size. The full Layers panel is a sheet of its own on phones, from the top bar down. `tools/smoke.py panels` opens both by touch at every sheet size.
- **Hover** (`js/hover.js`): one `queryRenderedFeatures` call when the pointer rests, never while it moves. It uses the click popup's own layer priority, so the preview always matches the click.
- **Colours** (`css/app.css`): tokens on `:root`, and the dark ones twice, under `prefers-color-scheme: dark` and `[data-theme="dark"]`. White text and icons go on `--accent-bg`, never on `--accent` (#239): in dark, `--accent` is a light green for text, icons and borders on dark surfaces (white on it is 2.7:1), and `--accent-bg` a deeper one (5.3:1); in light they're the same green. `tools/smoke.py contrast` measures them in both themes and fails on any rule that puts white text on `--accent`.

## Known limits

How Polku works where data or services fall short, with nothing planned to change. Anything that could be changed is an issue (`idea` or `watch`).

- **Where the terrain is missing, the route's heights are a guess** (found while fixing #72, 2026-10-15): when no zoom of a terrain tile loads, the height runs in a straight line across the gap, so the climb from one side to the other counts but the hills in between don't, and a gap at the start or end is taken as level. Heads-up, the summary and the dashed line in the profile say so, and Polku keeps trying.
- **Trail details along every route cost Overpass calls** (bug sweep, 2026-10-15): they load for every route on land, gravel and road too (up to 40 tiles a route, cached a week), not only with the map's layer on. Watch the Overpass counter in Settings; a long road route over 40 tiles skips them.

## The free services: limits and quirks

- **brouter.de pauses busy devices** ("retry later", escalating to about 30 minutes). Never burst-test it: use the local BRouter (`tools/brouter-local.sh`). Valhalla on FOSSGIS stands in.
- **Overpass mirrors are flaky:** 504s on every mirror at times while building phases 12 and 13. Trail details are best-effort and cached; route warnings from BRouter don't depend on it. The water router waits 2.5 s for OSM's rocks, then routes without them (Heads-up says so) and routes the leg again when they arrive (#67, #81). If it gets worse, there's an idea for static data built weekly.
- **Free tiers, if Polku gets popular:** Open-Meteo 10 000 calls a day per IP, non-commercial; Overpass 10 000 a day in `net.js`; FMI 20 000 a day; GitHub Pages about 100 GB a month of bandwidth. The counters are in Settings → Data sources.
- **OpenFreeMap's tile URLs change weekly;** saved offline areas use version-free keys (`sw.js`).
- **LIPAS search costs three requests** per query (12c: the combined layers `lipas_kaikki_reitit` / `lipas_kaikki_pisteet` take one filter for every type). If LIPAS renames or drops those layers, search loses its routes and stops (Places still work).
- **Traficom's depth layers** are shown "not for navigation" and never used for routing (its licence). If Traficom changes the licence or asks, the layers can be dropped from Paddle's defaults.

## Files

```
index.html          shell + CDN scripts (maplibre-gl 5.24.0, maplibre-contour 0.1.1)
sw.js               service worker: the app and saved tiles offline
css/app.css         UI (light and dark)
js/main.js          state, panels, the quick layer drawer, wiring
js/sheet.js         one swipe for every sheet: the planner's, the quick layer drawer, the full Layers panel on phones
js/changelog.js     on-demand release notes in the shared native dialog
js/config.js        sources, sports, palettes, overlay catalogue
js/style.js         MapLibre style builder (palettes, roads and trails, overlays, labels)
js/planner.js       route planner: waypoints, legs, undo, the panel and sheet, Heads-up
js/router.js        per-leg routing (BRouter batched; straight; water) and the Valhalla stand-in
js/valhalla.js      Valhalla (FOSSGIS) client: routes and way attributes as OSM-style tags
js/styles.js        route styles: presets and controls per sport, as router parameters
js/roundtrip.js     round trips: loop shapes, water-aware directions, loops on the water (out and back on rivers), scoring
js/water.js         open-water router (grid, costs, wind, A*, string-pulling)
js/waterdata.js     what the water router avoids: fairways, marks, OSM hazards, wind
js/analysis.js      profile, grades, climbs, warnings, timing, wind exposure, trail details
js/chart.js         elevation chart and route readout
js/uphill.js        uphill-difficulty overlay
js/trails.js        trail details from OSM (z13 Overpass tiles) and along a route
js/osm.js           Overpass client (mirrors, race, IndexedDB cache)
js/lipas.js         LIPAS: map layer, a place's parts, riding a route, search by name
js/search.js        grouped search: places, LIPAS routes and stops, trails, coordinates, recent
js/wxmap.js         weather overlay and timeline (particles, fields, radar, forecast strip)
js/weather.js       Open-Meteo client, weather along the route (10 days for trips with nights)
js/stops.js         stops and nights: a night's length, days, places to sleep, the gear check, st= links
js/winter.js        winter: Auto / On / Off, FMI's measured snow, OSM's winter ways (z12 Overpass tiles), sea ice
js/radar.js         FMI rain radar (GeoTIFF from the download service)
js/safety.js        traffic and safety layers, ships, hazards along routes
js/cameras.js       road weather cameras and the camera modal
js/nautical.js      nautical chart layer (marks, lights, sectors, fairways), shared Väylävirasto tiles
js/inspect.js       click popups
js/hover.js         hover details (desktop)
js/routeflow.js     the route's moving chevrons: a custom WebGL layer over the route line
js/offline.js       offline areas: plan, save, list, preview
js/net.js           one door to the free services: back-off, pacing, usage counts
js/usage.js         "Data sources": calls per service today
js/speeds.js        your speeds per sport
js/names.js         road and path names near a point, from the loaded tiles
js/idb.js           IndexedDB key–value stores
js/dem.js           DEM tile sampler
js/gestures.js      pinch / wheel over the UI → map zoom, trackpad tilt
js/view3d.js        tilt and rotate pad
js/locate.js        where you are: the dot, its accuracy circle and cone, Follow me (the GPS watched here, never stored or sent)
js/heading.js       which way you face: the compass standing, the GPS's course moving
js/compass.js       the compass button: north up, drag to rotate, heading up
js/modal.js, gpx.js, icons.js, geo.js, ui.js
profiles/           Polku's own BRouter profiles (road cycling; short cuts through ways marked private)
tools/              dev only: smoke.py, shoot.py, readme_shots.py, probes, cdp.py (headless Chrome), brouter-local.sh, fixtures
img/base/           base map pictures, 240 × 160 (tools/thumbs.py); Aerial's is Esri's tile, not stored
docs/               ROADMAP (the order), plans/ (phase designs), retros/, reviews/, this file, screenshots
.agents/skills/     dev only: design skills for coding agents (below); .claude/skills/ links to them
```

## Working on it

The rules are in [AGENTS.md](../AGENTS.md). In short: pick from the board's Now column and claim the issue; one phase or one fix per pull request, with "Fixes #n" and the issue's milestone; `tools/smoke.py` passes; CHANGELOG updated in the same PR (and a phase's plan); every request through `js/net.js`; share links keep working; and only the user merges.

### Design skills

- **Emil Kowalski's skills** ([emilkowal.ski/skill](https://emilkowal.ski/skill), MIT: `.agents/skills/LICENSE`) are kept in `.agents/skills/`, so every checkout and worktree has them, for Claude Code and Codex alike. Claude Code finds them through the links in `.claude/skills/`. `skills-lock.json` records each one's source and hash.
- **Eleven of the fifteen,** the ones [phase 24's plan](plans/24-design-review.md#the-skills) uses. animate-expo and write-swift (React Native, Swift), ask-sonner (a React library) and pick-ui-library (choosing dependencies) don't fit Polku.
- **Updating them is a tooling PR:** the new versions from [emilkowalski/skill](https://github.com/emilkowalski/skill), `skills-lock.json` to match, and the diff read through.
- **Impeccable** ([impeccable.style](https://impeccable.style)) is installed per user, not here. Its hooks and local settings are in `.gitignore`; what it writes about Polku (`PRODUCT.md`, a `DESIGN.md`) is committed.
