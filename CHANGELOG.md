# Changelog

What's new in Polku, newest first. Every change ships to [polku.si](https://polku.si) when its pull request is merged. Plans and ideas are in [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/BACKLOG.md](docs/BACKLOG.md).

## 2026-10-14

### Reading the route ([#46](https://github.com/TommiContursi/Polku/pull/46))
- **Points snap onto the path:** with Follow paths, a point clicked beside a trail or road moves onto it, where the route goes. A point the route can't reach gets a thin dashed line to it.
- **Menus have an ×,** and a tap beside an open menu only closes it, without adding a point.
- **See each part's sport:**
  - a **Sport** colour for the profile (and the route on the map);
  - on a multisport route, a strip under the profile with each sport's colour and icon, whatever colours the profile shows.
- **Distance marks** along the route on the map (1 km, 5 km… by length), and if you like, the time you'd be there. Both are in the planner's ⋯ menu.
- **Departure** can be set from the start point's menu and the start's row in the waypoint list.
- **Sunrise and sunset** at the start, under Departure & weather. Heads-up tells you when part of the trip is after sunset or in the dark, and reminds paddlers that a light is required on the water after dark.

### Fixed: route points off the route ([#45](https://github.com/TommiContursi/Polku/pull/45))
- **Points and leg handles drifted further off the route the more of them there were** (a style rule from the multisport change). They sit on their spots again.

### Your route on the map ([#44](https://github.com/TommiContursi/Polku/pull/44))
- **With the planner closed,** a click or tap on your route opens it, with a menu for that part of the route.
- **A tap on the route** (phone), or a **right-click** (desktop), opens a menu for that part: add a point here, its sport, Follow / Straight / Water, its style, avoid this spot, and show it on the profile. A tap no longer adds a point by mistake. A mouse click on the line still adds a via point, and dragging still reshapes.
- **LIPAS routes are easier to pick:** where one runs over a trail, a click opens the LIPAS route, with a link to the trail under it (and back). Taps reach a little further than a mouse pointer.

### Multisport routes and Swim ([#43](https://github.com/TommiContursi/Polku/pull/43))
- **Each leg of a route can have its own sport:** bike to the shore, paddle across, run on the island. Set it on the leg's row in the waypoint list or in the point's menu. When a new leg is mostly water while you draw a land sport, Polku offers to paddle it.
- **Each leg is routed, timed and checked as its sport:** its router, its style, your speeds for it, its Heads-up.
- **Changeovers:** where the sport changes, the time to change (15 min bike ↔ paddle, 10 paddle ↔ run, 1 swim ↔ run…) is added. You can set your own on the waypoint, and the weather on the route moves on with it.
- **Time & speed** shows each sport's distance and time, and every sport's speeds.
- **Swim is a new sport:** open-water routes near the shore that keep away from boats, a pace per 100 m, and beaches and swimming places from LIPAS.
- **Share links and saved routes** keep each leg's sport and your changeover times.

### A new README and this changelog ([#42](https://github.com/TommiContursi/Polku/pull/42))
- **The README** now shows what Polku does, with a screenshot for each feature. The developer notes moved to [docs/DEVELOPING.md](docs/DEVELOPING.md).
- **The map's footer** links to Polku's source and its maker, alongside OpenStreetMap and the other credits.

### First visit opens on Helsinki ([#41](https://github.com/TommiContursi/Polku/pull/41))
- A first visit opens on Helsinki and asks for your location once.
- Later visits open where you left off.
- Links with a position or a route work as before.

### Water routing: fairways, rocks and the wind ([#40](https://github.com/TommiContursi/Polku/pull/40))
- **Shipping lanes are crossed straight and quickly,** not followed (Väylävirasto's fairways). Harbour basins are noted.
- **Marked dangers are kept clear of:** isolated-danger and cardinal marks, and OpenStreetMap's rocks, reefs and shoals.
- **Rough water is avoided for your craft:** waves build where the wind has a long way over open water, and the forecast at your departure decides how rough is too rough for a sea kayak, a canoe or a SUP.
- **Heads-up names it all,** for example "Crosses the Särkän väylä — cross quickly and straight…".
- **Places you avoid now work on water legs too.**
- **Paddle route style** gets Fairways, Rocks & shoals and Wind switches, and a Direct preset.
- **Depths aren't used for routing:** Traficom's licence excludes route planning. Its depth layers now say "not for navigation".

### LIPAS routes in the planner and in search ([#39](https://github.com/TommiContursi/Polku/pull/39))
- **Ride this route** on an official LIPAS route makes it your plan using its own line, with no routing calls. Routes made of many parts are joined into one line where they can be.
- **Add to route** joins a whole LIPAS route onto yours.
- **Search is grouped:** places, LIPAS routes, LIPAS stops (lean-tos, huts, campfire sites), trails on the map, coordinates, and your recent searches.
- **LIPAS lines are now drawn at full precision.**

### Planner header and rain radar ([#34](https://github.com/TommiContursi/Polku/pull/34), [#35](https://github.com/TommiContursi/Polku/pull/35), [#36](https://github.com/TommiContursi/Polku/pull/36), [#37](https://github.com/TommiContursi/Polku/pull/37))
- **The planner header** always fits, in four groups (Draw · Colour | Route | Edit), with the route's colour one tap away.
- **Rain "now"** comes from FMI's measured rain rate instead of radar reflectivity, so drizzle no longer looks like a downpour and light rain still shows.

### Trail details ([#31](https://github.com/TommiContursi/Polku/pull/31), [#32](https://github.com/TommiContursi/Polku/pull/32), [#33](https://github.com/TommiContursi/Polku/pull/33))
- **On the map:** how wide a trail is, how easy it is to follow, overgrown and wet stretches, fallen trees, gates, fences and fords, drawn the way a rider reads them.
- **Along the route:** Heads-up lists them (with icons), and the profile can be coloured by trail width or visibility.
- **Separate opacity sliders** for difficulty and uphill colours.
- **The profile can show "Both" difficulty scales.**
- **A quick sport button** in the planner.
- **Fixed:** uphill colours stayed blank after being switched off and on.

## 2026-10-13

### Layers ([#29](https://github.com/TommiContursi/Polku/pull/29))
- Every layer control in every sport, an opacity slider per overlay, soundings for paddlers, and "On now" first.

### Round trips ([#27](https://github.com/TommiContursi/Polku/pull/27))
- Choose a start, a length (km or time) and a direction. Polku makes three loops in your route style and compares them; pick one and it becomes a normal route.

### Route style ([#24](https://github.com/TommiContursi/Polku/pull/24), [#25](https://github.com/TommiContursi/Polku/pull/25), [#26](https://github.com/TommiContursi/Polku/pull/26))
- **Presets in each sport's own words,** with fine-tuning, for the whole route or one leg.
- **Wet ground** is taken into account automatically after rain.
- **Road bikes** get a paved-roads profile.
- **A tidier planner layout,** and each leg's settings in the waypoint list.

### Editing, waypoints and reliable routing ([#21](https://github.com/TommiContursi/Polku/pull/21), [#22](https://github.com/TommiContursi/Polku/pull/22), [#23](https://github.com/TommiContursi/Polku/pull/23))
- **Edit on the map:** drag a point or the line itself and the route follows; point and spot menus.
- **A waypoint list:** rename, reorder and remove points, with undo for everything, road names, and a button to show the whole route.
- **Routing that holds up on free services:** pacing, one call for many legs, routes kept on refresh, and Valhalla standing in when BRouter pauses.

### Sports and speeds ([#18](https://github.com/TommiContursi/Polku/pull/18), [#19](https://github.com/TommiContursi/Polku/pull/19), [#20](https://github.com/TommiContursi/Polku/pull/20))
- **Road cycling, trail running and running** join MTB, gravel, hiking and paddling.
- **Your speeds** per sport: Easy / Normal / Fast or your own values, with an explanation of the time.

### The layout ([#12](https://github.com/TommiContursi/Polku/pull/12), [#13](https://github.com/TommiContursi/Polku/pull/13), [#15](https://github.com/TommiContursi/Polku/pull/15), [#16](https://github.com/TommiContursi/Polku/pull/16), [#17](https://github.com/TommiContursi/Polku/pull/17))
- **The planner** is a side panel on desktop, or a full-width bottom panel, and a peek / half / full sheet on phones.
- **One clock** (the timeline) for the weather, your departure and the roads, with paddling conditions instead of a profile on water.
- **The sport pill and a base map switcher,** with controls within thumb reach on phones.
- **Layers, the map key and Settings,** with one place for each kind of control.

### Weather, limits and details ([#4](https://github.com/TommiContursi/Polku/pull/4)–[#11](https://github.com/TommiContursi/Polku/pull/11))
- **The timeline** drives the weather layers, the route and road works.
- **Hover details** on desktop.
- **A route readout** on hover, and **offline areas** along a route.
- **Incline on hover,** and a compass with heading-up.
- **Far fewer weather calls:** forecasts are cached per grid cell.
- **Free services' limits are handled gracefully,** with a usage readout.
- **Rain radar** from FMI's download service.

## 2026-10-12

### The first Polku ([#1](https://github.com/TommiContursi/Polku/pull/1)–[#3](https://github.com/TommiContursi/Polku/pull/3))
- An open-data trail map of Finland for MTB, gravel, hiking and paddling: MTB difficulty and computed uphill grades, hillshade and contours, 3D terrain, an open-water router, wind along routes and a weather map.
- **Traffic and safety layers:** busy roads, incidents, road works, road conditions, military areas. Places to avoid on routes.
- **Road weather cameras,** ships with more detail, and a nautical chart layer.
