# Changelog

What's new in [Polku](https://polku.si), newest first. Each change reaches polku.si as soon as it's merged. What's planned is in the [issues](https://github.com/TommiContursi/Polku/issues) and the [roadmap](docs/ROADMAP.md).

## 2026-10-17

### A quick layer drawer ([#123](https://github.com/TommiContursi/Polku/issues/123))

**Layers**, or the **L** key, now opens a small drawer instead of the long layers panel. It shows the base maps as pictures and five layers chosen for your sport, so you can change the map while still seeing it.

- **One tap turns a layer on or off,** and the drawer stays open. MTB gets trail colours, trail details, official routes, 3D terrain and rain radar; paddling gets nautical marks, depths (not for navigation), ships, landing sites and wind. Each sport has its own five.
- **Settings are one step away:** a tile marked › opens its options, such as the kind of trail colours, their opacity or the individual depth layers.
- **Layers you can't see say why:** "Zoom in to see" when a layer doesn't show at this zoom, and "No data now" when its source isn't answering.
- **Make it yours:** **Edit** swaps any of the five for another layer, and **Reset** brings back your sport's own. Your layers are still kept separately for each sport.
- **More** opens the full layers panel and tells you how many other layers are on.
- **On a phone** the drawer is a sheet: swipe it down or tap the map to close it (that tap doesn't add a point), or swipe it up for every layer. **On a desktop** it opens beside the Layers button and stays open while you use the map.
- **With a keyboard,** the arrow keys choose a base map, and Esc steps back, then closes.

### The planner follows your swipe ([#96](https://github.com/TommiContursi/Polku/issues/96))

On a phone, you can drag the planner from anywhere along its top: the handle, the summary, the profile's top row, the tabs, or the list once it's scrolled to the top. It follows your finger, and the buttons there still work with a tap.

- **Let go and it settles** at the nearest size, where a flick would carry it. A quick flick always moves it at least one size, and you can catch it while it's still moving.
- **The map's buttons move once,** when the sheet comes to rest, instead of sliding along with it.
- **With reduced motion on,** the sheet still follows your finger but changes size without sliding.
- **The quick layer drawer** moves the same way.

### What's new, inside Polku ([#221](https://github.com/TommiContursi/Polku/issues/221))

**Settings → About Polku → What's new** opens these notes over the map, so you can read them without leaving your route.

- **The notes load when you open them,** with their latest date at the top. When you're offline or the connection is slow, Polku may show the copy it saved last time, and says so.
- **If nothing loads,** Retry and a link to the full changelog on GitHub are there.

## 2026-10-16

### Other ways to go ([#125](https://github.com/TommiContursi/Polku/pull/125), [#212](https://github.com/TommiContursi/Polku/pull/212))

When you add a point and pause, Polku may suggest up to two other ways to reach it. They're drawn in blue under your route, with labels that compare them: "This way · 61 % trails" on yours, and "Other way · +40 m · 22 % trails" on another. The percentage is how much of that part is on paths and tracks.

- **Tap one to take it.** The way you had stays in grey until you add the next point, so you can switch back with one tap.
- **They come for legs of 300 m or more,** and only when the free routing service has room to spare, since each other way is one more request. With your own routing server (Settings), they always come.
- **Want them anyway?** Tap any part of the route and choose **Other ways**.
- **Your choice is kept** through Undo, a reload, Save offline and share links. Changing that part's sport, style or points starts again from the first way.
- **Short cuts count too:** where Heads-up has a short cut through a way marked private, it's offered as one of the other ways.

### A route that's easier to follow ([#210](https://github.com/TommiContursi/Polku/pull/210))

The route has a soft glow that makes it stand out on a busy map, and white chevrons drift along it in the direction you're going.

- **Easy on the battery:** the chevrons move only while the route is on screen and the page is in view. When you leave the map alone for a while they rest, and a touch starts them again.
- **They stay still** with reduced motion or 3D terrain, and **Settings → Display → Moving arrows on the route** turns them off.

### Every route colour in one place

**Check → On the route** now shows every breakdown your route has data for (gradient, difficulty, surface, way type, trail details and weather), grouped under Terrain, Ground and Weather. Each has its own coloured bar, legend and distances, and even short stretches count.

- **Tap a breakdown** to colour both the route on the map and the profile with it. The one in use says **Selected**.
- **Point at a colour** in a bar or its legend to light up every stretch of it on the map. With a keyboard, focus a breakdown, step through its colours with the arrow keys, and press Esc to clear.
- **Fold a group** from its header. Polku remembers which ones you folded.

### Departure and arrival times

- **Go → Time starts with a full-size Depart picker,** above the time estimate and the arrival schedule. Tapping the time estimate in the summary takes you there.
- **Distance marks show the arrival time and the time elapsed,** with a switch for each under **Check → On the map**. They move as soon as you change the departure.

### Ways marked private or closed ([#116](https://github.com/TommiContursi/Polku/pull/116), [#117](https://github.com/TommiContursi/Polku/pull/117), [#124](https://github.com/TommiContursi/Polku/pull/124))

Polku now shows where OpenStreetMap marks a way private or closed for your sport, tells you when your route takes or avoids one, and can take short cuts through them when you choose.

- **On the map,** such ways have purple dots beside them from zoom 14, so you can see why a route goes round.
- **Heads-up tells you** when a route goes through such a way, or goes round one and how much a short cut would save, and when the router moved one of your points off one. Tap the row to see the short cut on the map.
- **Short cuts ok:** the new **Ways marked private** setting in Route style lets a route through such ways where that saves real distance. Ways marked no access stay closed. It's never on unless you choose it: no preset turns it on, and round trips always keep off.
- **One tap from Heads-up:** **Short cut** allows it for that leg only, and Undo puts it back. The setting is kept in share links and saved routes.
- **A tag isn't the law.** Private usually means closed, such as factory and military sites, house yards and roads closed by a sign, but in Finland private roads and apartment-block yards are open on foot and by bike. Check the signs where you are. If a tag looks wrong, the row's ⋯ menu has **Tagged wrong? Leave a note on OpenStreetMap**.
- **When Valhalla stands in for BRouter,** it may go through ways marked private, and Heads-up says so.

### Locate follows you and shows your heading ([#111](https://github.com/TommiContursi/Polku/pull/111))

The location dot now has a cone showing which way you're facing: from the compass while you stand still, and from your GPS track once you're moving, which works with the phone in a pocket. On an iPhone, Polku asks for the compass when you tap Locate.

- **Locate keeps the map on you** as you move, north up. On a phone, a second tap turns the map to face your way, and a third turns your location off.
- **Panning stops following,** and Locate becomes **Follow** to bring you back. Zooming and turning the map don't stop it. With the planner open, you stay in the part of the map it leaves free.
- **The dot turns grey** when no new position has come for a minute.
- **Kinder to the battery:** the GPS and compass stop while the page is hidden.
- **Your location stays on your phone.** It isn't saved or sent anywhere, and the map view isn't remembered while your location is on. Share links no longer include the map view, and search and the ships layer send only a rough map centre, to about a kilometre.

### Routes fit above the planner on phones ([#110](https://github.com/TommiContursi/Polku/pull/110))

With the planner open on a phone, the map now frames your route in the space above it. Before, **Show the whole route**, a new round trip or a tap on a climb did nothing while the planner was at full height.

- **Imports and share links** frame the whole route above the planner, or beside it on a desktop.
- **Tap a loop on the map to pick it.** Before, the tap threw away the other loops and moved the start.

### Fixed: dragging a leg's middle handle

Dragging the handle in the middle of a leg now adds exactly one point. Before, it could leave an extra point and a bend behind. One Undo puts the route back.

## 2026-10-15

### Winter on the map and the route ([#52](https://github.com/TommiContursi/Polku/pull/52), [#53](https://github.com/TommiContursi/Polku/pull/53), [#56](https://github.com/TommiContursi/Polku/pull/56))

Polku now shows snow and winter trails on the map, and allows for them on your route. **Winter** switches on by itself where there's 5 cm of snow or more, or you can set it to **Auto**, **On** or **Off** in the layers panel. The sport pill shows ❄ while it's on.

- **On the map:** snow depth (forecast and measured, also on the timeline), ploughed and unploughed paths, ways closed in winter, ski tracks, and LIPAS's ski tracks, skating routes on natural ice and snowmobile routes.
- **A Winter trail colour** shows how soon trails open after snow, at any time of year, so you can look ahead. Trail cards say what a trail is like in winter, where that's mapped.
- **Snow in the time:** where the forecast has snow on your route, the estimate allows for it, a little on ploughed ways and more on trails.
- **Winter Heads-up:** snow on the way or falling while you're out, slippery rain or sleet around 0 °C, how cold it feels at your speed (frostbite from about −27 °C), winter closures, unploughed ways and stretches beside a ski track. **In the dark** now says how much of the route is lit.
- **Ski tracks and other winter routes aren't for riding on.** Their cards say so, with a link to the operator's page for the grooming status.
- **Sea ice charts** from FMI for paddlers and swimmers. **Polku can't see the ice itself or tell you whether it's safe**; Heads-up reminds paddlers that it's the ice season.

### The planner in three tabs ([#60](https://github.com/TommiContursi/Polku/pull/60), [#61](https://github.com/TommiContursi/Polku/pull/61))

The planner is now split into **Route** for drawing (waypoints, legs, round trips, style and speeds), **Check** for what's on the way (Heads-up, climbs, the ground and what shows on the map), and **Go** for setting off (the time, departure and weather, GPX, share links and offline). Check shows how many Heads-up warnings there are, and Go when you'd arrive.

- **The profile stays in view** as you switch tabs, and you can make it smaller or taller. It marks your route's points, and climbs as ↑1, ↑2 and so on.
- **Point at a waypoint or leg** in the list to light it up on the map and in the profile.
- **Start how you like:** with no route yet, the planner offers Draw it, Round trip, a marked route or a file. After your first click, a small card offers a loop from that spot.
- **On a desktop** the planner opens on the left, and a button at the end of the tabs moves it to the bottom and back.
- **Export GPX, Copy share link and Save offline** are in Go and in the ⋯ menu.

### Missing terrain no longer looks flat ([#94](https://github.com/TommiContursi/Polku/pull/94), [#101](https://github.com/TommiContursi/Polku/pull/101))

When the terrain doesn't load, Polku now says so instead of showing a hilly route as flat. The summary shows "↑? ↓? m · no terrain", and the time is worked out from the distance alone.

- **Terrain missing in places** shows as a grey dashed gap in the profile, and the summary says "part estimated".
- **Heads-up says what's missing,** with a Retry button. Polku also tries again on its own, and at once when you're back online.
- **GPX exports** leave out heights that aren't known, rather than guess them.
- **Uphill trail colours** come back on the map as soon as the terrain does, without a reload.

### Routing that holds up better ([#79](https://github.com/TommiContursi/Polku/pull/79), [#81](https://github.com/TommiContursi/Polku/pull/81))

- **Routing requests wait their turn** instead of going out all at once, which could get your connection blocked by brouter.de for a while. If a route would wait more than a few seconds, Valhalla routes it instead.
- **Settings → Data sources** counts every request, retries included.
- **Paddling routes are routed again** when OpenStreetMap's rocks and shoals arrive late. Until then, Heads-up says the route wasn't checked for them.

### Your route keeps its sports ([#54](https://github.com/TommiContursi/Polku/pull/54), [#64](https://github.com/TommiContursi/Polku/pull/64))

Changing the sport in the top menu no longer quietly routes your drawn route again. The route keeps its sports, and a note offers **Route it as …** if you do want that.

- **The planner's sport picker** changes the route's main sport only, so a paddling leg in a ride stays a paddle, and Undo brings the route back.
- **Back to start** works again from the waypoint list, the finish point's menu and the toolbar, and Undo removes the return leg.
- **When the planner jumps to a section,** such as Weather, Speed or Style, that section lights up for a moment.

### Heads-up, share links and smaller fixes ([#57](https://github.com/TommiContursi/Polku/pull/57), [#58](https://github.com/TommiContursi/Polku/pull/58), [#92](https://github.com/TommiContursi/Polku/pull/92))

- **Heads-up is the same in every sport:** fallen trees and other obstacles mapped in OpenStreetMap now show on every land route, not only with the Trail details layer on.
- **Hide what you don't need:** a Heads-up row's ⋯ hides that kind of warning from then on. Hidden kinds are listed at the end, to bring back with a tap.
- **Wrong on the map?** The same ⋯ opens **Fix the map**, or **Leave a note** for OpenStreetMap's mappers.
- **Share links carry your places to avoid,** so whoever opens one is routed round them too. Older links still open, and say so if their places to avoid can't be read.
- **A saved copy says so:** when the server doesn't answer and Polku runs from the copy on your device, a banner says it may be out of date, with Reload.
- **On phones,** the map's credits stay folded behind ⓘ until you tap it, and the summary and ⓘ no longer clash with other controls.
- **Also fixed:** short routes say "at 40 m" instead of "at km 0.0", rain "now" matches the radar on the map, the route menu stays inside the window, and map cards that grow move back into view.

## 2026-10-14

### Multisport trips and Swim ([#43](https://github.com/TommiContursi/Polku/pull/43))

Each leg can now have its own sport: bike to the shore, paddle across, run on the island. Every leg is routed, timed and checked for its sport, and Polku adds time for each changeover (15 minutes between bike and paddle, for example), which you can change.

- **Swim is a new sport,** with open-water routes near the shore that keep away from boats, a pace per 100 m, and beaches and swimming places from LIPAS.
- **When a new leg is mostly water** while you're drawing a land sport, Polku offers to paddle it.
- **Time & speed** shows each sport's distance and time.
- **Share links and saved routes** keep each leg's sport and your changeover times.

### Stops and nights ([#49](https://github.com/TommiContursi/Polku/pull/49))

Add a break ("45 min") or a night ("go on at 08:30") at any point, from the point's menu, the waypoint list or **Stop here** on the route. Arrival times, the weather along the route and sunset warnings all move on with your stops.

- **Trips over several days** show each day: when you leave and arrive, how far, where you sleep and that day's weather. The forecast reaches up to 10 days and says where it gets less certain.
- **Places to sleep nearby:** a night's menu finds lean-tos, huts and campsites within 3 km, and **Go here** moves the point there.
- **Your bike or boat:** Heads-up tells you when you leave one behind and the route doesn't come back for it. If you take it along, such as a packraft or a folding bike, switch that on in the point's menu.
- **Heads-up warns about short nights** of under 5 hours.
- **Share links, saved routes and GPX files** keep your stops.
- **Fixed:** dragging a point where the sport changes no longer forgets its changeover time, and leaving after sunset no longer shows the wrong sunset time.

### Round trips on the water, and More loops ([#50](https://github.com/TommiContursi/Polku/pull/50))

Round trips now work for paddling and swimming. Choose a start, a length and a direction, and Polku suggests three loops that follow your route style on the water. On a river, where there's no room for a loop, it goes out and back. Each card shows the time, any carrying, and hazards such as shipping lanes, rough water and rocks.

- **More loops,** in every sport, adds three more in other directions and keeps the first ones, up to nine.

### Water routing: fairways, rocks and wind ([#40](https://github.com/TommiContursi/Polku/pull/40))

Paddling routes now cross shipping lanes straight and quickly instead of following them, keep clear of marked dangers, rocks and shoals, and avoid water that's too rough for your craft in the forecast wind. Heads-up names what's on the way, such as "Crosses the Särkän väylä".

- **Paddle route style** has switches for Fairways, Rocks & shoals and Wind, and a Direct preset.
- **Places you avoid** work on water legs too.
- **Depths aren't used for routing,** because Traficom's licence excludes route planning, and the depth layers say "not for navigation". Water routes are for planning: check the conditions and official charts before you set off.

### Editing on the route ([#44](https://github.com/TommiContursi/Polku/pull/44)–[#48](https://github.com/TommiContursi/Polku/pull/48))

- **Click or tap the route** to open a menu for that part: add a point, change its sport, how it's routed or its style, avoid a spot, or find it on the profile. Dragging the line still reshapes it, and clicking away from the route still adds a point.
- **Points snap onto the path** with Follow paths. A point the route can't reach gets a thin dashed line to it.
- **Menus have a close button,** and tapping beside an open menu only closes it.
- **The profile can be coloured by sport,** and on a multisport route a strip under it shows each sport.
- **Distance marks** along the route, with the time you'd reach them if you like.
- **Sunrise and sunset** are under Departure & weather, and Heads-up says when part of the trip is after dark. Paddlers are reminded that a light is required on the water after dark.
- **Fixed:** route points that drifted off the line, and route colours left on the map after the route was cleared.

### Official routes, trail details and search ([#31](https://github.com/TommiContursi/Polku/pull/31)–[#37](https://github.com/TommiContursi/Polku/pull/37), [#39](https://github.com/TommiContursi/Polku/pull/39))

- **Ride this route** turns an official LIPAS route into your plan, along its own line, and **Add to route** joins one onto yours.
- **Search is grouped** into places, LIPAS routes, LIPAS stops (lean-tos, huts, campfire sites), trails on the map, coordinates and your recent searches.
- **Trail details on the map:** how wide a trail is, how easy it is to follow, overgrown and wet stretches, fallen trees, gates, fences and fords. Heads-up lists them along your route, and the profile can be coloured by width or visibility.
- **Rain "now"** comes from FMI's measured rain rate, so drizzle no longer looks like a downpour.
- **The planner's header** always fits, with the route's colours one tap away. Difficulty and uphill colours have separate opacity sliders, and the profile can show both difficulty scales.

### First visit opens on Helsinki ([#41](https://github.com/TommiContursi/Polku/pull/41), [#42](https://github.com/TommiContursi/Polku/pull/42))

A first visit opens on Helsinki and asks for your location once; later visits open where you left off. The map's credits now link to Polku's source and its maker.

## 2026-10-13

### Round trips ([#27](https://github.com/TommiContursi/Polku/pull/27))

Choose a start, a length in kilometres or time, and a direction, and Polku suggests three loops in your route style to compare. Pick one and it becomes a normal route you can edit.

### Sports, speeds and route styles ([#18](https://github.com/TommiContursi/Polku/pull/18)–[#20](https://github.com/TommiContursi/Polku/pull/20), [#24](https://github.com/TommiContursi/Polku/pull/24)–[#26](https://github.com/TommiContursi/Polku/pull/26))

- **Road cycling, running and trail running** join MTB, gravel, hiking and paddling.
- **Your speeds** for each sport: Easy, Normal, Fast or your own, with an explanation of the time.
- **Route style presets** in each sport's own terms, with fine-tuning, for the whole route or one leg. Road bikes keep to paved roads, and wet ground is taken into account after rain.

### Editing and dependable routing ([#21](https://github.com/TommiContursi/Polku/pull/21)–[#23](https://github.com/TommiContursi/Polku/pull/23))

- **Drag a point or the line** and the route follows.
- **A waypoint list** to rename, reorder and remove points, with Undo for everything.
- **Routing that holds up on free services:** requests are paced, routes are kept when you reload, and Valhalla stands in when BRouter pauses.

### The layout, layers and weather ([#4](https://github.com/TommiContursi/Polku/pull/4)–[#13](https://github.com/TommiContursi/Polku/pull/13), [#15](https://github.com/TommiContursi/Polku/pull/15)–[#17](https://github.com/TommiContursi/Polku/pull/17), [#29](https://github.com/TommiContursi/Polku/pull/29))

- **The planner** is a side or bottom panel on a desktop, and a sheet with three sizes on a phone.
- **One timeline** drives the weather layers, your departure and road works.
- **Layers, the map key and Settings** each have one place, with an opacity slider for every overlay and the layers that are on listed first.
- **Hover details** on a desktop, offline areas along a route, and a compass with heading-up.
- **Far fewer weather requests,** and the free services' limits handled gracefully, with a usage readout.

## 2026-10-12

### The first Polku ([#1](https://github.com/TommiContursi/Polku/pull/1)–[#3](https://github.com/TommiContursi/Polku/pull/3))

An open-data trail map of Finland for mountain biking, gravel, hiking and paddling: MTB trail difficulty, computed uphill grades, hillshade and contours, 3D terrain, an open-water router, wind along routes and a weather map.

- **Traffic and safety layers:** busy roads, incidents, road works, road conditions and military areas, with places to avoid on routes.
- **Road weather cameras,** ships with more detail, and a nautical chart layer.
