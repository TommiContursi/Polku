# Polku

Polku is a free outdoor map and multi-sport route planner for Finland. It supports mountain biking, gravel and road cycling, hiking, trail running, running, paddling and swimming, including trips that combine sports.

[**Open Polku →**](https://polku.si/)

Works in your browser, on your phone or computer. No installation or account needed.

![An MTB route at Kauppi, Tampere, with the route planner, detailed terrain and an elevation profile](https://github.com/TommiContursi/Polku/blob/pr-screenshots/codex/readme-introduction/after-desk-planner.jpg?raw=true)

## Maps and trails

The map has hillshade, 5 m contours and 3D terrain, which its **3D** button turns on and off. Base maps include the trail map, the National Land Survey's terrain map and aerial photos. **Layers** opens a quick drawer with the base maps and five layers for your sport as tiles, which you can swap for any others; **More** has every layer and the map keys.

- Trail colours show mountain biking difficulty (S0–S6) and estimated uphill difficulty (↑S0–↑S5), separately or together, with arrows pointing uphill. Polku samples the elevation model along trails, smooths the heights and grades short sections by climbing gradient, with adjustments for loose surfaces and mapped technical difficulty. Explicit OpenStreetMap uphill grades take precedence.
- Trail width and visibility, wet or overgrown stretches, fallen trees, gates, fences and fords come from OpenStreetMap. Select a feature for details and a link to help correct the map.
- Search finds official hiking, MTB, cycling and paddling routes from Finland's [LIPAS](https://lipas.fi) register, alongside lean-tos, huts, campfire sites and landing places. The planner's start lists the official routes in the map's view for your sport. Follow one as your plan on its recorded line.

![Warnings along a route at Tykkikallio, including access restrictions, a fallen tree and a hard-to-follow trail, with options to avoid them](https://github.com/TommiContursi/Polku/blob/pr-screenshots/codex/readme-introduction/after-desk-trail-headsup.jpg?raw=true)

## Route planning

Routing, speeds, route styles and warnings depend on the sport. A route can change sports between legs: cycle to the shore, paddle across and run on an island. The time estimate includes changeovers.

On land, BRouter calculates routes using sport-specific profiles. Polku keeps unchanged legs when you edit a route and reuses saved geometry after a reload. If the public BRouter service pauses, a Valhalla fallback can take over, with a notice in Check.

- A route begins with drawing it, a round trip, an official route in view, or a GPX or KML file. Add points on the map and drag a point or the route line to change it. A tap on a point opens its card: when you'd get there, how far along and how high, whether you pass by, stop or stay the night, the sport from there on, **Move** by a tap, **Rename**, **Start here**, **End here** and **Remove**. Draw the next leg along paths, as a straight line or over water, in any sport, change the sport or style for any leg, and undo changes. A point put on open water asks whether to paddle or swim there. The planner's header shows the route; its tools are in a toolbox beside the map's buttons on a phone and a toolbar on a desktop, with the whole route's actions in **More**. **Done** ends editing and keeps the route open to read, check and take along, where a tap on the map shows what's there; the planner opens again as you left it, after a reload too. The route glows, and chevrons drift along it the way it goes (Settings can turn them off). A tap on the route opens its card: the way there and three numbers for your sport, **Add a point here**, the stretch to the next point you see with **Edit this stretch**, and what the map knows of the way. Holding the map still for half a second, or a right-click, shows what's there (what the map has at the spot, how far it is from your route, its height and your sport's fact of the way) with **What's here**, **Start here**, **End here**, **Round trip from here**, **Avoid this spot** and **+ Add to my route**, which puts the spot where it fits in the route; a tap on a place's icon shows its card even while you draw, and a spot can be shared as a link that carries only the spot, or have the weather timeline held on it. The same by keyboard: Tab to the map for a crosshair, Enter and Shift+F10. Route's list is in sections, a new one where the sport changes, at a stop and at a night, with **Reorder**; Route opens with **How you go** (the route style) and **Your speed**.
- When you add a point and stop for a moment, other ways to it can appear on the map, drawn like the route in blue, each labelled with its extra length and share of trails beside the route's own share; select one to take it, and the way you had stays, grey, to go back to. Any part of the route offers **Other ways** too. They cost extra routing calls, so on the public BRouter they come only when the service's pacing has room, and not on legs under 300 m.
- Route styles change the router's preferences for terrain, surface, climbing and roads, with presets for flowing trails, technical riding, paved roads, nature paths or routes near the shore. Set a style for the whole route or one leg.
- Routes keep off ways marked private in OpenStreetMap, and Check says when a route goes round one. Where you may go there, the route style's **Short cuts ok** lets a route through such a way when it saves a real distance; ways marked no access stay closed.
- For a round trip, choose a start point (your first point, a tap on the map, or where you are), a distance or duration, and a direction, including into the wind first. Polku generates three loops to compare by distance, time, climbing, trail share, repeated stretches and warnings. Its ranking penalises distance from the target, repeated sections, warnings and carries. Generate more loops or edit one. Paddling and swimming loops work too; on rivers they go out and back.
- The elevation profile shows climbs and descents, coloured by gradient, trail difficulty, surface, trail width or visibility, or weather. Check groups available colour breakdowns by terrain, ground, weather and sport, independently of the selected profile colour. Category distances line up beneath each bar; select its title or bar to colour both the profile and the route on the map. Hover a bar segment or legend row to highlight matching stretches on the map. Group headers fold their breakdowns together. Time estimates use preset or personal speeds and allow for wind and snow.
- Stops and overnight stays update the schedule and route weather. Set a break, or a stay of one night or several and the time to go on. For overnight stops, Polku finds nearby lean-tos, huts and campsites. It also warns if a trip leaves your bike or boat somewhere you do not return to.

<p align="center">
  <img src="https://github.com/TommiContursi/Polku/blob/pr-screenshots/codex/readme-introduction/after-phone-planner.jpg?raw=true" alt="Planning on a phone: the route above a bottom sheet with its distance, time, elevation profile and Route, Check and Go tabs" width="360">
</p>

## Weather and conditions

Route weather shows headwind, crosswind, tailwind, temperature and rain at the estimated time you reach each part of the route. A 48-hour map timeline shows animated wind, rain and temperature, with FMI rain radar for current rainfall in Finland. Distance marks show estimated arrival and elapsed times by default, with their switches under **Your route** in all layers. **Leave** on the start's card and in Go opens the phone's own date and time picker for any day ahead; selecting the summary estimate opens Go at it. Within the timeline's 48 hours the timeline shows the same hour. The forecast reaches ten days ahead: past it the route says no forecast yet, and its wind, rain and waves aren't checked there. The planner includes sunrise and sunset.

Polku first estimates the route's timing, then samples forecasts for the expected arrival times along it. It recalculates travel times with the wind and samples the forecasts again for the revised schedule. Stops, overnight stays and changeovers are included in that schedule.

The route's **Check** brings together mapped obstacles and access restrictions, busy roads, incidents, road works, slippery roads, military areas and shooting ranges, in three groups: **Read before you go**, **Worth a look**, and **Not checked** for a source that didn't answer. Each warning says where it comes from, and is marked on the route. A line under the route's numbers says what stands out on it (a water leg's wind, rain, a headwind that adds time, unpaved on a road bike), or the sport's usual fact, such as the hardest climb, and Check's top keeps them all. Where a warning offers **Avoid it**, use it to plan around that spot. You can mark warnings read, so the planner's row stays out of the way; they stay in Check and on the map. Polku checks only what its sources know: nothing listed doesn't mean a way is open, safe or allowed. Road weather cameras include a 24-hour time-lapse.

Winter mode can follow local snow conditions automatically or be set manually. Its layers show snow depth and FMI measurements, trails classified by how soon they open after snow, ploughed paths, winter access restrictions, ski tracks, skating and snowmobile routes, and FMI sea-ice charts. Route time estimates allow for snow; warnings cover freezing rain, cold, darkness and the ice season on water.

![Wind-speed colours and wind-direction particles over southern Finland, with the wind and rain layers enabled and the 48-hour weather timeline open](https://github.com/TommiContursi/Polku/blob/pr-screenshots/codex/readme-introduction/after-desk-weather-overlay.jpg?raw=true)

## Water routes

Water routes support paddling and swimming on lakes, rivers and through the archipelago, including legs in a multi-sport trip.

- Paddling routes support sea kayaks, canoes and SUPs and flag sections where carrying is needed.
- Wave estimates use the length of open water upwind, with routing preferences for each craft. An exposed crossing can cost more than a sheltered detour, especially for a SUP.
- Routes aim to cross shipping lanes directly rather than follow them, and keep clear of mapped danger marks, rocks and shoals.
- Nautical layers show buoys, lights, sectors, fairways, speed limits and charted depths.
- Live ship positions come from Fintraffic's AIS feed. Select a vessel for its name, type, speed, course, destination and position age, where reported, or use **Follow on map**. Tracks record positions received while the map is open; a dashed ten-minute projection assumes the ship keeps its reported course and speed.

Water routes are calculated in the browser. Polku turns the map's water polygons into a grid and uses A* to find a path weighted by shipping lanes, mapped hazards, wind exposure and places you have chosen to avoid. It then simplifies the result into straighter legs while checking the same routing costs.

**Water routes and nautical layers are for planning, not navigation.** Depths are displayed only and never used for routing. Carry an official chart; see the [limitations](#limitations) below.

![A paddling route from Kaivopuisto towards Suomenlinna crossing the Särkän väylä shipping lane, with route warnings alongside](https://github.com/TommiContursi/Polku/blob/pr-screenshots/codex/readme-introduction/after-desk-water-crossing.jpg?raw=true)

## Offline and sharing

**Save offline** stores the map and terrain along a route, together with the route and its profile, so Polku can load without a connection. **Preview offline** shows only what is saved, so you can check coverage before leaving. Routing, search, weather and traffic still need a connection. On an iPhone, add Polku to the home screen to help keep offline data available.

Routes can be imported from GPX or KML, exported as GPX, or shared with a link. A share link carries when you leave, once it's set; a date that has passed opens leaving now. An exported GPX has the planned times in its waypoints' descriptions and none on the track, so other apps don't read it as a recorded activity. For an imported track, use GPX to preserve its exact line: share links may route it again.

Polku runs in your browser, with no account, cookies, analytics or backend of its own. Settings, routes (including your last route), cached data and offline areas stay in browser storage. Requests go directly to the data services below, which receive your IP address and the map area or route coordinates needed to answer them. Your position is used on your device and sent only when you ask for something from where you are: a round trip from **Where I am** starts there, rounded to about a metre, so that start is routed like any other point, and kept with the route if you take one of the loops. Nearby search and ship information use an approximate map centre instead.

## Data & credits

Polku brings together open data and free public services. Each source keeps its own terms and attribution requirements.

| Used for | Sources |
|---|---|
| Map and trail data | [OpenStreetMap contributors](https://www.openstreetmap.org/copyright); [OpenFreeMap](https://openfreemap.org) vector tiles (© OpenMapTiles) |
| Terrain and base maps | [Mapterhorn](https://mapterhorn.com); Maanmittauslaitos via [Kapsi ry](https://kartat.kapsi.fi) (CC BY 4.0); Esri World Imagery |
| Routes and outdoor places | [LIPAS](https://lipas.fi), University of Jyväskylä (CC BY 4.0); [Waymarked Trails](https://waymarkedtrails.org) |
| Routing on land | [BRouter](https://brouter.de); [Valhalla](https://valhalla.github.io/valhalla/) on [FOSSGIS](https://www.fossgis.de) servers as a fallback |
| Search and detailed map features | [Photon](https://photon.komoot.io); [Overpass API](https://overpass-api.de) |
| Fairways and navigation marks | Väylävirasto (CC BY 4.0) |
| Displayed water depths | Traficom: not for navigation; its licence excludes route planning |
| Traffic and road conditions | Fintraffic [Digitraffic](https://www.digitraffic.fi/en/) and Digiroad (CC BY 4.0) |
| Weather and radar | [Open-Meteo](https://open-meteo.com); [FMI open data](https://en.ilmatieteenlaitos.fi/open-data); [RainViewer](https://www.rainviewer.com/api.html) |
| Map rendering | [MapLibre GL JS](https://maplibre.org); [maplibre-contour](https://github.com/onthegomap/maplibre-contour) |

Requests are paced, cached and counted; see **Settings → Data sources**. Offline areas save only OpenFreeMap and Mapterhorn tiles, whose terms allow it.

Polku's original application code is proprietary: © 2026 Tommi Contursi, all rights reserved. Using the free service does not grant permission to reuse its code in another product. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); third-party code and data retain their own licences.

## Limitations

- **Estimates and mapped data have gaps.** Uphill grades, travel times and wave heights are estimates from terrain, tags and forecasts. They cannot confirm conditions on the ground.
- **Water routing cannot assess every hazard.** It does not use depths and does not know currents, rapids, private shores or bird-protection areas. Use official charts and keep a lookout.
- **A path on the map is not necessarily an official route or permission to enter.** Respect everyman's rights, access restrictions and local rules. Ski tracks are not for walking or cycling.
- **Offline covers the saved map, terrain and route.** Routing, search, weather and traffic still need a connection.
- **The full trail network appears from zoom 14.** Zoom in if trails seem to be missing.
- **FMI weather and forest-fire warnings are not shown.** No open source currently allows Polku to fetch them directly from a browser.

## Using Polku

See the [user guide](docs/USING.md) for controls and keyboard shortcuts.

## Changelog

Open **Settings → About Polku → What’s new** for recent changes inside the app, or read the [changelog](CHANGELOG.md). Release notes load on demand; their latest date is shown, and a saved copy may appear with a slow or missing connection.

## Background

Polku grew out of planning outdoor trips with Trailmap, Strava, Komoot, Windy.app, Orca and the National Land Survey's maps. It combines detailed trail maps, multi-sport routes, weather at estimated arrival times and water-route planning in one browser app.

Polku is an independent project. Use it at [polku.si](https://polku.si).

Made by [@TommiContursi](https://github.com/TommiContursi).
