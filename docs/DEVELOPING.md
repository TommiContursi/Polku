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

## How the trickier parts work

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
- **Route styles** (`js/styles.js`): BRouter's `profile:name=value` parameters override a stock profile's global variables, so most styles need no custom profile. The exception is road cycling: `profiles/polku-road.brf` costs gravel main roads as rough, and is uploaded once per session. Every preset was checked to change real routes (`tools/style_probe.py`).
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
- **Weather** (`js/weather.js`, `js/wxmap.js`):
  - **The grid:** forecasts are fetched per point of a fixed, nested lattice and kept an hour, so small moves reuse them. Open-Meteo counts every location as a call.
  - **Along the route:** the route is timed without wind, the forecast is sampled at each point for the hour you'd be there, and the time is estimated again with the head- and tailwind.
  - **Radar "now"** is FMI's rain-rate GeoTIFF, decoded in the browser.
- **Share links** (`shareUrl()` and `parseShared()` in `js/planner.js`): the route in the query string. A part that's empty or the default is left out, and links from before a part was added still open.
  - `r`: the points (an encoded polyline, 5 decimals); `m`: each leg's mode (`a` routed, `l` straight, `w` water); `a`: the sport.
  - `p`, `ps`: the route's style, and legs with their own. `s`: each leg's sport; `cw`: changeover minutes you set.
  - `st`: stops and nights (in `js/stops.js`); `cg`: points where the gear goes along. `lr`: LIPAS legs as references.
  - `av`: places to avoid, `lon_lat_metres` each, comma-separated (`av=24.94012_60.17543_40`), about 24 characters a circle. At most 200 are read; anything that doesn't read as a circle is left out, and a toast says the route may go through it.
  - Names of points and of places to avoid stay on the device.
- **Offline** (`js/offline.js`, `sw.js`): the tiles along a route corridor at zoom 5–14 go into Cache Storage, and the service worker serves them when the network is slow (4 s) or gone. OpenFreeMap's weekly tile version is stripped from the cache key. The routed line is saved with the area.
- **Framing above the planner** (`frame()` in `js/planner.js`): every camera move that shows a route, a loop, a stretch or an imported track goes through it, not `map.fitBounds` with padding of its own. The padding keeps clear of the top bar and the side panel or sheet. A full sheet comes down to half first, and the padding never takes more than three quarters of the map, because MapLibre skips a fit that can't be made with only a console warning. While the sheet changes size, `sheetTop()` uses the height it's going to, from the heights in `css/app.css`: keep the two in step.
- **Where you are** (`js/locate.js`, `js/heading.js`): Polku watches the GPS itself (not MapLibre's geolocate control) and stops while the page is hidden. The dot glides to each fix; while following, each frame moves the map so the dot stays in the middle of the free map (`planner.viewPadding`), and only until it has arrived. Map moves made for you carry `{ polkuFollow: true }`. A pan (`dragstart` with one finger) or any other move that shifts the map's middle stops following; zooms and turns about the middle keep it. The heading is the compass below 1 m/s and the GPS's course above it. Fixes stay in memory: while location is on, the map's view isn't saved. `tools/smoke.py heading` feeds a GPS and a compass of its own.
- **Hover** (`js/hover.js`): one `queryRenderedFeatures` call when the pointer rests, never while it moves. It uses the click popup's own layer priority, so the preview always matches the click.

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
js/main.js          state, panels, wiring
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
profiles/           Polku's own BRouter profile (road cycling)
tools/              dev only: smoke.py, shoot.py, readme_shots.py, probes, cdp.py (headless Chrome), brouter-local.sh, fixtures
img/base/           base map thumbnails (tools/thumbs.py)
docs/               ROADMAP (the order), plans/ (phase designs), retros/, reviews/, this file, screenshots
```

## Working on it

The rules are in [AGENTS.md](../AGENTS.md). In short: pick from the board's Now column and claim the issue; one phase or one fix per pull request, with "Fixes #n" and the issue's milestone; `tools/smoke.py` passes; CHANGELOG updated in the same PR (and a phase's plan); every request through `js/net.js`; share links keep working; and only the user merges.
