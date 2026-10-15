# Polku

**Explore Finland, from forest trails to open water.**

Polku is a free outdoor map and multi-sport route planner for Finland. Plan mountain biking, gravel and road cycling, hiking, trail running, running, paddling and swimming routes, or combine different sports in one trip.

Explore detailed terrain, find trails that suit you, and check the weather for when you expect to reach each part of your route. Build your own plan, discover a round trip, or follow an official route, then save the map and route for offline use.

**[Open Polku →](https://polku.si)** · Free to use · No account needed · Works on mobile · [What's new](CHANGELOG.md)

![An MTB route at Kauppi, Tampere, with the route planner, detailed terrain and an elevation profile](https://github.com/TommiContursi/Polku/blob/pr-screenshots/codex/readme-introduction/after-desk-planner.jpg?raw=true)

## Explore the outdoors

Read the landscape before you go: shaded terrain, **5 m contours and 3D views**, with trail maps, the National Land Survey's terrain map and aerial photos to choose from.

- **Find trails that fit your ride.** Colours show mountain biking difficulty and estimated uphill difficulty separately, so you can judge the trail and the climb. Arrows point uphill.
- **See the details that matter outdoors.** Trail width and visibility, wet or overgrown stretches, fallen trees, gates, fences and fords come from OpenStreetMap. Select a feature for details and a link to help correct the map.
- **Discover routes and places to stop.** Search official hiking, MTB, cycling and paddling routes from Finland's [LIPAS](https://lipas.fi) register, alongside lean-tos, huts, campfire sites and landing places. Add an official route to your plan using its recorded line.

![Trail details at Tykkikallio, Jyväskylä: narrow and faint trails, fallen trees, a gate and a fence](https://github.com/TommiContursi/Polku/blob/pr-screenshots/codex/readme-introduction/after-desk-trails-close.jpg?raw=true)

## Plan your own way

Choose from **eight sports**, each with its own routing, speeds, route styles and warnings. Mix them within one trip: cycle to the shore, paddle across and run on an island, with time for changing between sports.

- **Shape the route on the map.** Add points, drag a point or the line, and change the sport or style for any leg. Undo lets you try another way.
- **Choose how you want to travel.** Look for flowing trails, technical riding, paved roads, nature paths or a route near the shore. Apply a style to the whole route or just one part.
- **Let Polku suggest a round trip.** Pick a start, distance or duration, and direction, including into the wind first. Compare three loops by distance, time, climbing, trail share, repeated stretches and warnings. Generate more, or edit the one you like. Paddling and swimming loops work too; on rivers they go out and back.
- **Understand the effort.** An elevation profile shows climbs and descents, with colours for gradient, trail difficulty, surface, width, visibility or weather. Use preset or personal speeds, with travel times adjusted for wind and snow.
- **Make room for breaks and nights.** Add stops or set when to continue the next morning. The schedule and route weather follow, and Polku finds nearby places to sleep. It also warns if a trip leaves your bike or boat somewhere you do not return to.

<p align="center">
  <img src="https://github.com/TommiContursi/Polku/blob/pr-screenshots/codex/readme-introduction/after-phone-planner.jpg?raw=true" alt="Planning on a phone: the route above a bottom sheet with its distance, time, elevation profile and Route, Check and Go tabs" width="360">
</p>

## Know what lies ahead

**Weather follows your schedule.** See headwind, crosswind, tailwind, temperature and rain at the estimated time you reach each part of the route. A 48-hour map timeline lets you explore animated wind, rain and temperature, with FMI rain radar for current rainfall in Finland. Distance marks, passing times, sunrise and sunset help you plan your day.

**Check obstacles and conditions together.** The route's warning list, called **Heads-up**, brings together mapped obstacles and access restrictions, busy roads, incidents, road works, slippery roads, military areas and shooting ranges. Where a warning offers **Avoid**, use it to plan around that spot. Road weather cameras include a 24-hour time-lapse.

**Plan for winter.** Winter mode can follow local snow conditions or be set manually. See snow depth and FMI measurements, trails classified by how soon they open after snow, ploughed paths, winter access restrictions, ski tracks, skating and snowmobile routes, and FMI sea-ice charts. Route times allow for snow; warnings cover freezing rain, cold, darkness and the ice season on water.

![Warnings along a route at Tykkikallio, including access restrictions, a fallen tree and a hard-to-follow trail, with options to avoid them](https://github.com/TommiContursi/Polku/blob/pr-screenshots/codex/readme-introduction/after-desk-trail-headsup.jpg?raw=true)

## From land to water

Plan paddling and swimming routes across lakes, along rivers and through the archipelago, or connect them to the land sections of a multi-sport trip.

- **Route across water and see where carrying is needed.** Paddling supports sea kayaks, canoes and SUPs.
- **Account for wind and exposure.** Estimated waves depend on the wind's reach across open water, with different preferences for each craft.
- **Check shipping lanes and mapped hazards.** Routes aim to cross shipping lanes directly rather than follow them, and keep clear of mapped danger marks, rocks and shoals.
- **Explore the nautical layers.** See buoys, lights, sectors, fairways, speed limits, live ships and charted depths.

**Water routes and nautical layers are for planning, not navigation.** Depths are displayed only and never used for routing. Carry an official chart; see the [limitations](#limitations) below.

![A paddling route from Kaivopuisto towards Suomenlinna crossing the Särkän väylä shipping lane, with route warnings alongside](https://github.com/TommiContursi/Polku/blob/pr-screenshots/codex/readme-introduction/after-desk-water-crossing.jpg?raw=true)

## Take Polku with you

**Save before you lose signal.** Save the map and terrain along a route, together with the route and its profile. Polku can then load without a connection. **Preview offline** shows only what you have saved, so you can check coverage before leaving. On an iPhone, add Polku to the home screen to help keep offline data available.

**Bring a route in, or take one out.** Import GPX or KML, export GPX, or share a planned route with a link. Your last route and settings stay on your device. For an imported track, use GPX to preserve its exact line: share links may route it again.

**No account, cookies or analytics.** Polku runs in your browser and has no backend of its own. Settings, routes, cached data and offline areas stay in browser storage. Requests go directly to the data services below, which receive your IP address and the map area or route coordinates needed to answer them.

For controls and keyboard shortcuts, see [Using Polku](docs/USING.md).

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

These data and library licences are separate from Polku's application code. This repository does not currently include a licence for that code.

## Limitations

- **Estimates and mapped data have gaps.** Uphill grades, travel times and wave heights are estimates from terrain, tags and forecasts. They cannot confirm conditions on the ground.
- **Water routing cannot assess every hazard.** It does not use depths and does not know currents, rapids, private shores or bird-protection areas. Use official charts and keep a lookout.
- **A path on the map is not necessarily an official route or permission to enter.** Respect everyman's rights, access restrictions and local rules. Ski tracks are not for walking or cycling.
- **Offline covers the saved map, terrain and route.** Routing, search, weather and traffic still need a connection.
- **The full trail network appears from zoom 14.** Zoom in if trails seem to be missing.
- **FMI weather and forest-fire warnings are not shown.** No open source currently allows Polku to fetch them directly from a browser.

## Development

Polku is a static site with no build step. Run `python3 serve.py` and open <http://localhost:8765>. See [Developing Polku](docs/DEVELOPING.md) for the architecture, tools, tests and project background, and the [roadmap](docs/ROADMAP.md) for planned work.

Made by [@TommiContursi](https://github.com/TommiContursi).
