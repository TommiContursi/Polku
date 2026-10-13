# Polku

**An outdoor map for Finland.** Trails, terrain, water, weather and traffic in one place, for planning rides, runs, hikes and paddles — and for checking them on the go.

→ **[polku.si](https://polku.si)**

Polku shows how hard a trail is in both directions, routes you over land or open water, tells you what the weather will be when you reach each part of the route, warns about road works, busy roads and ships on the way, and keeps working offline along a saved route. It needs no account and keeps no data about you: it's a static web app built entirely on open data.

## What you can do

**Read the terrain**
- Trail map from OpenStreetMap with the MTB difficulty (`mtb:scale`, S0–S6) as a coloured halo, no-bike markers and optional `S2` labels along trails.
- **Uphill difficulty** (↑S0–↑S5) for every trail in view, computed from the lidar elevation model and bumped for loose or technical surface; OSM `mtb:scale:uphill` tags win where they exist. Arrows point up the climb. Show difficulty, uphill or both.
- Multidirectional hillshade and 5 m / 2.5 m contours generated in the browser, 3D terrain with exaggeration.
- Base maps: Polku's trail map, the National Land Survey Maastokartta and aerial photos (keyless, via Kapsi), Esri imagery, night, plain and high-contrast styles — at the top of **Layers**, whose button shows the current one.
- **Layers** shows what is on right now, groups everything else (trails, routes, places, water, traffic, roads, weather, terrain & 3D) and carries the map key for each group. Your sport sets the starting layers; **Settings** (⚙) holds the sport, planner position, display options, offline maps and data sources.

**Plan a route**
- Routing per sport — MTB, gravel, road cycling, hike, trail run, run and paddle, each with its own router profile, timing model, warnings, map style and default layers — with straight-line and over-water legs, undo/redo, reverse, back to start.
- **Round trips:** choose a start (map centre, your location, or click), a length in km or time, and a direction (or "into the wind first"), and Polku makes three loops in your route style, compares them (distance, time, climbing, trails or unpaved share, how much is ridden twice, heads-up) and lets you pick one — it becomes a normal route you can drag and edit. Three routing calls a go, up to six if a loop needs adjusting; via points are kept off lakes using the map's own water.
- **Route style** per sport: presets in the sport's own words (MTB: Flowy trails, Technical, Smooth & easy, Roads to the trail; road: Paved roads, Flatter; hike: Nature paths, Easy paths, Mountain; run: Green & quiet, Along water, Flat; paddle: Near the shore, No carries; gravel, trail run likewise) and fine-tuning with only the controls that sport's router really has. Wet ground is automatic (rain in the last 24 h at the start). For the whole route, or one leg from a point's menu. After a change, one line says what it did ("+0.8 km · trails 41 → 63 %"). Styles travel in share links.
- A **Waypoints** list in the planner: every point with its distance and the road it's on; rename them (names go into GPX and stay on this device), reorder by dragging or with ↑/↓, remove, or click one to see it on the map. Undo covers all of it. The ⛶ button (or <kbd>F</kbd>) frames the whole route, and opening the planner far from your route brings it back into view.
- Hover the route (or scrub the profile) for the road or path name there — from the map tiles already loaded, no extra requests.
- Edit on the map like in Komoot: drag a point or the line itself (on touch, hold the line first) and the route follows as you drag; click the line or a leg's middle handle for a via point; a point's menu sets its next leg, makes it the start or finish, or removes it; long-press or right-click the map to add, avoid or start from that spot.
- The planner keeps the map in view: on desktop a side panel (drag its edge to widen it for long profiles) or a full-width bottom panel with the lists in columns — your choice in the ⋯ menu; on phones a bottom sheet that peeks, goes half or full height, and drops out of the way while you draw. Its sections fold and remember how you left them.
- Drag across the profile (or pinch it, or double-tap on touch) to zoom into a stretch; the map follows.
- **Your speeds**: Easy / Normal / Fast or your own values per sport (km/h by surface and climbing rate for bikes, pace for runners, walking speed, craft speed). The planner's Time & speed section explains how the time is estimated and shows where it goes on your route; Settings has the same for every sport.
- An elevation profile coloured by terrain (gradient, uphill grade, MTB difficulty), ground (surface, way type) or weather (wind, temperature, rain) — on the route line too if you like — with climbs, warnings (steps, no-bike sections, S3+, steep pitches, carries) and a time estimate that accounts for the wind.
- Hover the route on the map for a live readout: distance, elevation, gradient, difficulty, surface, and the wind, temperature and rain when you get there.
- **Avoid places**: any hazard or map popup can mark a spot the router goes around.
- GPX/KML import (drag & drop), GPX export, and a share link that carries the route.

**Paddle**
- An open-water router for kayak, canoe and SUP: routes stay on water, carries (portages) are flagged, and paddling time depends on the craft.
- Depth areas, contours and soundings (Traficom); click the water for the charted depth.
- A **nautical chart** for the sea and lakes: IALA-A buoys and marks, lights with their character and red/green/white sectors, leading marks, fairways with swept depth, speed limits and restriction areas, waterway signs and reported faults.
- Live ships (AIS) coloured by type, with trails, course lines and a ship card (destination, size, draught, port calls, follow on map).

**Know the weather**
- A 48-hour **timeline** (Weather button or <kbd>T</kbd>) that drives everything time-dependent: the weather layers, your route's departure, road works and road conditions. Its strip shows temperature, rain, wind and night for the map centre, and your ride as a band. While you plan it sits inside the planner as the departure control; otherwise drag it anywhere and resize it.
- **Paddling** shows the conditions along the route — wind (head, cross, tail), gusts, direction, rain and carries — instead of an elevation profile.
- Animated wind, falling rain and snow where it's forecast, temperature field, rain radar now (FMI in Finland, RainViewer elsewhere).
- **Weather along the route** for every activity: head-, cross- or tailwind per section (with arrows on the map), temperature and rain at the time you reach it.

**Stay safe**
- Busy roads as a heat line (vehicles per day), live incidents, road works at your departure time, slippery or poor road conditions for the next 12 hours, military areas and shooting ranges.
- 800+ road weather cameras with every view, a 24-hour time-lapse and the nearest road-weather readings.
- A planned route is checked against all of these; hazards appear under Heads-up, each with an Avoid button.

**Look closer**
- Rest the mouse on anything for a one- or two-line preview (desktop); click for the full details — difficulty, uphill grade, surface, access, elevation, and all OSM tags with a link to improve them.

**Go offline**
- **Save offline** in the route panel stores the trail map and terrain along the route (0.5–5 km either side) together with the route itself. The map, the route, its profile and uphill grades then work with no signal, and the app itself loads offline.
- **Preview offline** (Layers → Offline maps) loads only what's saved, so you can check an area before you go.

## Privacy

There are no accounts, cookies, analytics or servers of our own. Settings, your last route, cached OSM data and offline areas stay in your browser. The map talks directly to the open data services listed below, which see your IP address and the area you're looking at.

## Keys and gestures

| | |
|---|---|
| <kbd>T</kbd> | timeline |
| <kbd>L</kbd> | layers (and the map key) |
| <kbd>R</kbd> | route planner |
| <kbd>F</kbd> | show the whole route |
| <kbd>/</kbd> | search |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Z</kbd>, +<kbd>Shift</kbd> | undo, redo |
| <kbd>Esc</kbd> | close panels |

Pinch or Ctrl+scroll over any panel zooms the map, not the page. In 3D, a two-finger trackpad scroll tilts (up/down) and rotates (sideways) while pinch zooms; Shift+scroll tilts anywhere; the orbit pad, right-drag / Ctrl+drag and two-finger touch work too.

## Running it

It's a static site with no build step and no backend: `index.html`, plain ES modules and MapLibre GL JS from a CDN.

```bash
python3 serve.py        # → http://localhost:8765
```

Any static server works; `serve.py` just disables HTTP caching while you edit. polku.si is served by GitHub Pages from `main`.

With the dev server running and Google Chrome installed:

```bash
python3 tools/smoke.py                  # layout check at 4 sizes: no overlaps, no console errors
python3 tools/shoot.py shots after      # screenshots for a pull request (--list for the scenes)
tools/brouter-local.sh                  # optional: BRouter on this computer (Settings → Routing server)
python3 tools/style_probe.py --presets  # does every route style change the route? (against the local BRouter)
python3 tools/loop_probe.py             # how long do round-trip loops ride? (calibrates js/roundtrip.js)
```

The plan for upcoming work is in [docs/ROADMAP.md](docs/ROADMAP.md).

## How the trickier parts work

- **Uphill grades** (`js/uphill.js`): trails in the loaded vector tiles are resampled every 8 m and sampled against the terrarium DEM (`js/dem.js`, bilinear, z14 ≈ 2.3 m/px). They are smoothed over 24 m, cut into ~25 m pieces and graded by the `mtb:scale:uphill` grade limits (10/15/20/25/30 %). Each piece is oriented uphill so the arrows point up the climb. Explicit OSM tags come from Overpass and are cached in the browser for a week.
- **Water routing** (`js/water.js`): a hidden MapLibre map renders only water (white on black) for the leg's area. The pixels become a navigability grid, A* runs on it (with a small shore penalty so routes don't hug the bank), and the cell path is string-pulled into straight paddling lines. Land is passable at a high cost, which yields carries when there's no water connection; a suspiciously long carry triggers a retry with a wider search window.
- **Weather along the route** (`js/weather.js`, `js/analysis.js`): the route is timed first without wind, the forecast is sampled at each point for the hour you'd be there, and the time is re-estimated with the head- and tailwind components.
- **Style** (`js/style.js`): one function builds the whole MapLibre style from app state and is applied with `setStyle(..., {diff: true})`. Activity, base map and overlays are all just state.
- **Offline** (`js/offline.js`, `sw.js`): the tiles covering the route corridor at zoom 5–14 go into Cache Storage, and a service worker serves them when the network is slow (4 s) or gone. OpenFreeMap's weekly tile version is stripped from the cache key, so saved tiles keep matching. The routed line is saved with the area, so reopening it needs no routing server.
- **Routing without a server of our own** (`js/router.js`, `js/net.js`, `js/valhalla.js`): legs come from [brouter.de](https://brouter.de), a free public BRouter that refuses (403 "Please, retry later!") when one address calls too often, for 40 s at first and half an hour after repeated bursts. So Polku stays well under it — at most 5 calls in 10 s and 12 a minute, consecutive legs in one call (a new sport or a shared link costs one call, not one per leg), the routed geometry saved with your route (a refresh costs none), and a drag's live preview only while there's budget to spare. When brouter.de pauses anyway, or would keep a leg waiting more than a few seconds, [Valhalla](https://valhalla.github.io/valhalla/) on the FOSSGIS servers that openstreetmap.org uses routes it instead (one call a second at most, as their terms ask; its way attributes are translated into the tags the analysis reads), and Heads-up says so, with a button to use BRouter again. Paddling has no stand-in: those legs wait. Running BRouter yourself is optional — `tools/brouter-local.sh` starts one on your computer, and Settings → Routing server points Polku at it (handy for development: it spares brouter.de).
- **Route styles** (`js/styles.js`): BRouter's `profile:name=value` URL parameters override any global variable of a stock profile (it injects them before the profile's own assignments), so most styles need no custom profiles. The one exception is road cycling: the stock road profile costs gravel main roads like asphalt, and many Finnish tertiary roads are gravel, so `profiles/polku-road.brf` adds one variable; it's uploaded once per session under a fixed id and uploaded again if the server has dropped it. Every preset was checked to change real routes (`tools/style_probe.py`).
- **Hover** (`js/hover.js`): one `queryRenderedFeatures` call when the pointer rests, never while it moves, using the click popup's own layer priority so the preview always matches the click.

## Data sources

[OpenFreeMap](https://openfreemap.org) vector tiles (© OpenMapTiles, © OpenStreetMap contributors) · [Mapterhorn](https://mapterhorn.com) terrain · [BRouter](https://brouter.de) routing · [Valhalla](https://valhalla.github.io/valhalla/) on [FOSSGIS](https://www.fossgis.de) servers when BRouter pauses ([fix the map](https://www.openstreetmap.org/fixthemap)) · [Photon](https://photon.komoot.io) search · [Overpass API](https://overpass-api.de) · [LIPAS](https://lipas.fi) (University of Jyväskylä, CC BY 4.0) · Traficom (depth data) · Väylävirasto (aids to navigation, fairways) · Fintraffic Digiroad · Maanmittauslaitos via [Kapsi ry](https://kartat.kapsi.fi) (CC BY 4.0) · Esri World Imagery · [Waymarked Trails](https://waymarkedtrails.org) · [Open-Meteo](https://open-meteo.com) · [FMI open data](https://en.ilmatieteenlaitos.fi/open-data) rain radar (fetched from the download service and drawn in the app, as FMI asks) · [RainViewer](https://www.rainviewer.com/api.html) · [Fintraffic Digitraffic](https://www.digitraffic.fi/en/) (road & marine, CC BY 4.0) · [maplibre-contour](https://github.com/onthegomap/maplibre-contour)

These are free public services: be gentle with them. Offline areas save only OpenFreeMap and Mapterhorn tiles, whose terms allow it; aerial imagery and the Kapsi raster maps stay online-only.

## Limits worth knowing

- OpenFreeMap carries the full trail network from **zoom 14** (only some at 13); the app shows a hint between z10.5 and z14.
- Traficom's depth WMS checks the page's origin: it answers `localhost` and polku.si, but not every domain. Hosted elsewhere, the depth layers need a small proxy.
- No open source of FMI weather warnings or forest-fire warnings allows browser (CORS) access, so those aren't shown.
- Digitraffic has no ship track history API: trails build up from positions seen while the map is open.
- Offline areas cover the map, terrain and your route. Routing, search, weather, traffic and aerial maps need a connection. Browsers may clear saved data under storage pressure; on iPhone, add Polku to the home screen so it's kept.
- The nautical layer is for orientation, not navigation — carry an official chart.
- Uphill grades and climb times are estimates from terrain and tags, not ground truth. Water routes don't know about currents, rapids, private shores or bird-protection areas. Check local rules.
- Everyman's rights apply. Paths on the map aren't necessarily official routes.
- Not included: accounts and cloud sync, Garmin/Strava/Suunto integrations, photos and native apps. The Strava heatmap's tiles don't allow cross-origin use.

## Files

```
index.html          shell + CDN scripts (maplibre-gl 5.24.0, maplibre-contour 0.1.1)
sw.js               service worker: app and saved tiles offline
css/app.css         UI (light/dark)
js/main.js          state, panels, wiring
js/style.js         MapLibre style builder (palettes, roads/trails, overlays, labels)
js/config.js        sources, activities, palettes, overlay catalogue
js/planner.js       route planner + bottom sheet
js/router.js        per-leg routing (BRouter, batched; straight; water) and the Valhalla stand-in
js/valhalla.js      Valhalla (FOSSGIS) client: routes and way attributes as OSM-style tags
js/names.js         road and path names near a point, from the loaded vector tiles
js/roundtrip.js     round trips: loop shapes, water-aware directions, scoring
js/styles.js        route styles: presets and controls per sport, as BRouter / Valhalla / water-router parameters
profiles/           Polku's own BRouter profile (road: gravel main roads count as rough), uploaded to the router
js/water.js         open-water A* router
js/analysis.js      profile, grades, climbs, warnings, timing, wind exposure
js/chart.js         elevation chart + route readout
js/uphill.js        uphill-difficulty overlay + Overpass client (cached)
js/wxmap.js         weather overlay and timeline (particles, fields, radar, forecast strip)
js/weather.js       Open-Meteo client, weather along the route
js/safety.js        traffic & safety layers, ships, hazards along routes
js/cameras.js       road weather cameras + camera modal
js/nautical.js      nautical chart layer (marks, lights, sectors, fairways)
js/lipas.js         LIPAS WFS loader
js/inspect.js       click popups
js/hover.js         hover details (desktop)
js/offline.js       offline areas: plan, save, list, preview
js/idb.js           IndexedDB key–value stores
js/dem.js           DEM tile sampler
js/modal.js         modal dialog / side card
js/gestures.js      pinch / wheel over the UI → map zoom, trackpad tilt
js/view3d.js        tilt & rotate orbit pad
js/search.js, gpx.js, icons.js, geo.js, ui.js
tools/              dev only: smoke.py, shoot.py, thumbs.py (headless Chrome via cdp.py), brouter-local.sh, fixtures
img/base/           base map thumbnails (tools/thumbs.py)
docs/ROADMAP.md     phased plan
```

## Background

Polku started as an experiment loosely inspired by [Trailmap](https://web.trailmap.fi): a trail map of Finland with MTB difficulty. It has since grown its own way — uphill grades, paddling, weather, safety and offline maps. It's an independent project, not affiliated with Trailmap, and uses none of its data or services.
