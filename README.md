# Polku — trail map for MTB, gravel, hiking and paddling

A rebuild of [web.trailmap.fi](https://web.trailmap.fi) using only free, open, keyless data sources. It's a static site with no build step and no backend.

```bash
python3 serve.py        # → http://localhost:8765
```

Any static server works. `serve.py` just disables caching while you edit.

## What it does

| | Trailmap | Polku |
|---|---|---|
| Trail map with MTB difficulty (`mtb:scale`) halos | ✓ | ✓ S0–S6 halo + dashed centre line, no-bike markers |
| **Uphill difficulty** | – | ✓ ↑S0–↑S5 for every trail in view, computed from the lidar DEM, bumped for loose or technical surface, overridden by OSM `mtb:scale:uphill`. Arrows point uphill. Shown alone, or **Both** (difficulty halo plus uphill stripe) |
| Difficulty numbers on the map | – | ✓ optional `S2` / `↑S3` labels along trails (separate toggles), styled after [MTB-TrailMap-JOSM-Style](https://github.com/TommiContursi/MTB-TrailMap-JOSM-Style) |
| Activity profiles | MTB, gravel, walking, winter | MTB, gravel, hike & run, **paddle** |
| Hillshade + contours | MML + global | Lidar-grade Mapterhorn DEM, multidirectional hillshade, 5 m / 2.5 m contours generated in the browser |
| 3D terrain | ✓ | ✓ with exaggeration slider and an on-screen orbit pad for tilting and rotating |
| **Weather overlay** | – | ✓ windy-style animated wind, wind-speed or temperature field with °C labels, rain radar now (FMI in Finland, RainViewer elsewhere) and rain forecast, 48 h time slider with play |
| MML maastokartta | needs their key | ✓ **keyless** via Kapsi: base map with our trails on top, or a transparent overlay |
| Aerial | MML / Maptiler | Esri world imagery, plus MML ortokuva (Kapsi) |
| Depth (syvyyskäyrät / -alueet / -pisteet) | ✓ Traficom | ✓ Traficom, plus shipping lanes, and click on water to see the charted depth range |
| Digiroad overlays | ✓ | ✓ paved roads, private roads, speed limits |
| LIPAS official routes & places | ✓ | ✓ hiking / MTB / paddling routes, lean-tos, huts, campfire sites, landing places, chosen per activity |
| Route planner | ✓ (login for saving) | ✓ no login: auto-routing per activity (BRouter), straight-line legs, **over-water legs**, undo/redo, reverse, back to start, drag points, click the line to add a via point |
| Elevation profile | ✓ | ✓ lidar profile coloured by gradient / uphill grade / surface / way type / MTB difficulty, synced hover with the map, climbs list with uphill grade, warnings (steps, no-bike, S3+, steep, carries, straight lines) |
| **Water routing** (kayak, canoe, SUP) | – | ✓ routes stay on open water, flag carries (portages) and give paddling time per craft |
| **Wind on the route** (all activities) | – | ✓ forecast for when you reach each part (pick a departure time), head / cross / tail wind as a profile colour and on the map with arrows, wind-adjusted time |
| GPX/KML import, GPX export | ✓ | ✓ drag & drop, "Analyse & edit" an imported track |
| Share | account | ✓ link encodes the route |
| Click to inspect | ✓ | ✓ difficulty, uphill grade, surface, access, elevation. "Show all OSM tags" fetches `sac_scale`, `trail_visibility`, `smoothness`, width… with a link to edit in OSM |
| Night map, high contrast, plain | partly | ✓ |

Not rebuilt: accounts and cloud sync, Garmin/Strava/Suunto integration, offline maps, photos, segments and the native apps. The Strava heatmap isn't included because its tiles don't allow cross-origin use.

## How the trickier parts work

- **Uphill grades** (`js/uphill.js`): trails in the loaded vector tiles are resampled every 8 m and sampled against the terrarium DEM (`js/dem.js`, bilinear, z14 ≈ 2.3 m/px). They are smoothed over 24 m, cut into ~25 m pieces and graded by the `mtb:scale:uphill` grade limits (10/15/20/25/30 %). Each piece is oriented uphill so the line symbols point up the climb.
- **Water routing** (`js/water.js`): a hidden MapLibre map renders only water (white on black) for the leg's area. The pixels become a navigability grid, A* runs on it (with a small shore penalty so routes don't hug the bank), and the cell path is string-pulled into straight paddling lines. Land is passable at a high cost, which yields carries when there's no water connection. If a carry looks suspiciously long, it retries with a wider search window (e.g. around a peninsula).
- **Style** (`js/style.js`): one function builds the whole MapLibre style from app state and is applied with `setStyle(..., {diff: true})`. Activity, base map and overlays are all just state.

Zooming: pinch or Ctrl+scroll over any panel zooms the map, not the page. Tilt and rotate: the orbit pad in 3D mode, right-drag or Ctrl+drag, or two fingers on touch.

## Data sources

[OpenFreeMap](https://openfreemap.org) vector tiles (© OpenMapTiles, © OpenStreetMap contributors) · [Mapterhorn](https://mapterhorn.com) terrain · [BRouter](https://brouter.de) routing · [Photon](https://photon.komoot.io) search · [Overpass API](https://overpass-api.de) · [LIPAS](https://lipas.fi) (University of Jyväskylä, CC BY 4.0) · Traficom (depth data) · Fintraffic Digiroad · Maanmittauslaitos via [Kapsi ry](https://kartat.kapsi.fi) · Esri World Imagery · [Waymarked Trails](https://waymarkedtrails.org) · [Open-Meteo](https://open-meteo.com) · [FMI open data](https://en.ilmatieteenlaitos.fi/open-data) radar · [RainViewer](https://www.rainviewer.com/api.html) · [maplibre-contour](https://github.com/onthegomap/maplibre-contour)

## Limits worth knowing

- OpenFreeMap carries the full trail network from **zoom 14** (only some at 13). The app shows a hint between z10.5 and z14.
- Traficom's WMS only answers browsers on `localhost` (and its own sites). If you host Polku on a public domain, the depth layers need a small proxy.
- BRouter, Overpass, Photon and the WMS services are free public servers: be gentle. Overpass is slow at times; the app races several mirrors.
- Uphill grades and climb times are estimates from terrain and tags, not ground truth. Water routes don't know about currents, rapids, private shores or bird-protection areas. Check local rules.
- Everyman's rights apply. Paths on the map aren't necessarily official routes.

## Files

```
index.html          shell + CDN scripts (maplibre-gl 5.24.0, maplibre-contour 0.1.1)
css/app.css         UI (light/dark)
js/main.js          state, panels, wiring
js/style.js         MapLibre style builder (palettes, roads/trails, overlays, labels)
js/config.js        sources, activities, palettes, overlay catalogue
js/planner.js       route planner + bottom sheet
js/router.js        per-leg routing (BRouter / straight / water)
js/water.js         open-water A* router
js/analysis.js      profile, grades, climbs, warnings, timing, wind exposure
js/chart.js         elevation chart
js/uphill.js        uphill-difficulty overlay + Overpass client
js/wxmap.js         weather overlay (particles, fields, radar, time bar)
js/weather.js       Open-Meteo client, wind along the route
js/gestures.js      pinch / wheel over the UI → map zoom
js/view3d.js        tilt & rotate orbit pad
js/lipas.js         LIPAS WFS loader
js/inspect.js       click popups
js/dem.js           DEM tile sampler
js/search.js, gpx.js, icons.js, geo.js, ui.js
```
