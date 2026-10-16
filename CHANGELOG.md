# Changelog

What's new in Polku, newest first. Every change ships to [polku.si](https://polku.si) when its pull request is merged. Plans and ideas are in [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/BACKLOG.md](docs/BACKLOG.md).

## 2026-10-16

### Fixed: a route that goes round a way marked private says so (#104)
- **Ways marked private or closed for your sport have purple dots beside them** on the map, from zoom 14: `access=private` or `no` without a yes for your sport, and on foot `foot=no`. Routes keep off them, so now you can see why a route goes round. The map key has them, and hover and the way's card say "marked private or no access" (the map's tiles can't tell the two apart).
- **Heads-up says when a leg goes round one,** and how much a short cut through it would save: "Goes round a way marked private or closed · a short cut through it would save about 370 m". A tap on the row draws the short cut on the map. Polku works this out from the map it already has, with no extra calls.
- **A point you put on such a way, that the router moved off it, says so too:** "Start moved 53 m off a way marked private or closed", or in the short cut's row when it's part of it. Polku remembers the spot you picked, through Undo, a reload and Save offline.
- **It says what the map says, not what the law is.** Private usually means closed (factory and military sites, house yards, roads closed by a sign), but in Finland private roads and apartment-block yards are open on foot and by bike, so the rows and the card offer **Tagged wrong? Leave a note on OpenStreetMap**.

### Fixed: Heads-up says when the route takes a way marked private or closed ([#116](https://github.com/TommiContursi/Polku/pull/116))
- **On foot, a way marked `foot=private` or `foot=no` gets a Heads-up row.** Before, a Run or Hike route could take 120 m of a delivery road marked foot=private without a word, because the routing service counts it as open when bikes may use it.
- **The rows say what OpenStreetMap says, not what the law is:** "Marked private in OpenStreetMap", with the tag and what private usually means (factory and military sites, house yards, roads closed by a sign). In Finland private roads and apartment-block yards are open on foot and by bike, so a way there may be tagged wrong: the row's ⋯ has **Tagged wrong? Leave a note on OpenStreetMap**.
- **The sport's own tag wins:** a footway marked `access=no` but `foot=yes` is open to walkers, and no longer gets a row on foot. On a bike it's `bicycle=yes` that opens it.
- **When Valhalla stands in for BRouter,** it may walk through ways marked private where BRouter goes round, and its answer doesn't say which. Its row in Heads-up now says so, and the stretches along a way the map marks private or no access get a row of their own, where the map has loaded. Use BRouter routes round them.
- **If you'd hidden "Private or no access",** the new rows stay hidden.

### Which way you face, and Follow me (Phase 23a, [#111](https://github.com/TommiContursi/Polku/pull/111))
- **The location dot shows which way you face.** A cone points where the top of your phone points, from its compass. While you move faster than a slow walk (about 1 m/s), it follows the way the GPS says you're going instead, which holds up with the phone in a pocket. The cone is narrow when it comes from the GPS and wider from the compass. On an iPhone, Polku asks for the compass when you tap Locate.
- **Follow me.** A tap on Locate shows where you are and keeps the map on you as you move, north up. On a phone the next tap turns the map to face the way you face, and the one after that turns your location off. Zooming, pinching or turning the map keeps following. A pan, or the map moving somewhere else (a search, showing the route), stops it, and Locate turns into **Follow**: one tap brings you back. With the planner open, you stay in the part of the map it leaves free.
- **The dot turns grey** when no new position has come for a minute, and Locate says so.
- **Easier on the battery.** While the page is hidden, Polku stops listening to the GPS and the compass, and starts again when you're back.
- **Where you are stays on your phone.** Polku keeps your position only in the open page: it isn't saved and isn't sent anywhere. While your location is on, the map's view isn't remembered for your next visit. Share links no longer carry the map's view, and search ("nearer places first") and the ships layer send the map's middle only to about a kilometre.

### Fixed: on a phone, the map frames your route above the planner ([#110](https://github.com/TommiContursi/Polku/pull/110))
- **With the planner at full height,** Show the whole route, Use this loop, a new round trip and a tap on a climb or a Heads-up did nothing on the map. Now the planner comes down to half and the map frames the route above it.
- **A GPX or KML import** lands above the planner when it's open (beside it on desktop), and Analyse & edit frames the track above the planner it opens.
- **A share link** frames the whole routed line once its legs are in, not only its points, unless you've moved the map or changed the route by then.
- **A round trip from your first tap** frames the loops' area above the planner as it rises, not above the smaller planner it was a moment before.
- **Tap a loop on the map to pick it.** The other loops and the start stay where they are, its card is marked, and the map frames it. Before, the tap threw all the loops away and moved the start there. Picking a loop by its card frames it too, and a tap away from the loops still moves the start.

## 2026-10-15

### Fixed: the uphill colours stayed blank after the terrain came back ([#101](https://github.com/TommiContursi/Polku/pull/101))
- **When the terrain didn't load,** the trails on the map stayed without their Uphill colours even after it came back, until you reloaded the page. Now they're coloured on your next move of the map once the terrain is in, the climbs tagged in OpenStreetMap too.
- **Trails coloured with the terrain stay as they are,** so panning around asks for nothing again.

### Fixed: a route over hills looked flat when the terrain didn't load ([#94](https://github.com/TommiContursi/Polku/pull/94))
- **When the terrain doesn't load** (no network, or the terrain server failing), the route's time is worked out by the distance, as if flat, and Polku says so. The summary says "↑? ↓? m · no terrain" instead of "↑0 ↓0 m". The profile says the terrain didn't load, and the gradient on the route shows "No terrain" rather than "Flat". No more "NaN min" or "Infinity m", and Heads-up no longer goes blank.
- **When only part of it loads,** the climbing and the time come from what did, with a straight line across the gap. In the profile the gap is grey and dashed, and the summary says "part estimated".
- **Heads-up says what's missing** ("Terrain didn't load", "Terrain missing for 1.2 km") and when Polku tries again, with a Retry button.
- **Polku tries again on its own,** after 20 seconds and then less often, and at once when your phone is back online. The route updates when the terrain comes in.
- **A GPX export** has no height where the terrain is missing, rather than a guess.

### Fixed: share links left out the places to avoid ([#92](https://github.com/TommiContursi/Polku/pull/92))
- **A share link carries your places to avoid,** so whoever opens it sees the red circles and is routed around them too. Before, the link left them out, and their route could go right through a place you meant to avoid.
- **Older links open as before.** A link whose places to avoid can't be read still opens, and says that the route may go through them.

### Fixed: Back to start ([#64](https://github.com/TommiContursi/Polku/pull/64))
- **Back to start adds the return leg again**, from the waypoint list, the finish point's menu and the wide planner toolbar. Undo removes that leg and restores your route. The button stays off once you are back at the start.

### Fixed: a paddling route stayed without OpenStreetMap's rocks after they came in ([#81](https://github.com/TommiContursi/Polku/pull/81))
- **When OpenStreetMap's rocks and shoals come late,** your paddling route is routed again with them once they're in, and "Not checked on the water" goes. Before, the route stayed as it was, made without them, until you moved a point.
- **A leg still being worked out when they came** is routed again with them too.
- **Until they come,** Heads-up still says that they weren't checked.

### Fixed: routing calls asked for together went out all at once ([#79](https://github.com/TommiContursi/Polku/pull/79))
- **Routing calls wait their turn.** Calls asked for at the same moment, such as a round trip's loops or several legs at once, all went to brouter.de together, even past Polku's own limit of 5 calls in 10 seconds, and brouter.de answers that by blocking your connection for a while. Now they go out one after another within the limit, in the order they were asked for. Valhalla gets at most one call a second, as its terms ask.
- **A route that would wait more than a few seconds for its turn** is routed by Valhalla instead, as when brouter.de pauses. A drag's live preview pauses while calls are waiting.
- **Settings → Data sources counts every call that goes out,** including the second try after a dropped connection. That second try now waits for its turn too.

### After the three tabs ([#61](https://github.com/TommiContursi/Polku/pull/61))
- **The planner opens on the left on desktop.** A button at the end of its tabs moves it to the bottom and back (it's also in ⋯ and Settings).
- **Export GPX, Copy share link and Save offline are in ⋯ again,** as well as in Go.
- **The profile shows your route's points** where they are along it: the start, the numbered via points, the finish. On a round route the finish is at the end, where it belongs. The climbs are marked "↑1", "↑2"… so they're not mistaken for points.

### The route planner in three tabs ([#60](https://github.com/TommiContursi/Polku/pull/60))
- **Route, Check and Go:**
  - **Route** is for drawing: the waypoints and legs, a round trip, and **How you go** (the route style and your speeds together);
  - **Check** shows what's on the way: heads-up, climbs, the ground in kilometres, and what the route shows on the map;
  - **Go** is for setting off: **the time first** (how long and when you'll be there), the departure and weather, and taking the route along (GPX, a share link, offline).

  Check shows how many heads-up there are, and Go when you'd arrive.
- **The profile stays in sight** under the summary, with its colours and On map. A button makes it smaller or taller.
- **The tools that hid in ⋯ are out in the open:** Round trip, Reverse and Back to start under the waypoints; distance marks and times in Check; export, share and save offline in Go.
- **Nothing else moved:** the top of the planner (summary, routing modes, the route's colours, sport, Round trip, Style, undo) is as it was.
- **Start with a round trip:** with no route yet, the planner offers Draw it, Round trip, a marked route, or a file. After your first click, a small card offers a loop from that spot in three lengths, and the next click goes on drawing as before.
- **The leg you point at lights up:** a waypoint or a leg in the list glows on the map and is marked in the profile. An open leg stays lit.

### Fixed: the map's credits took space on phones ([#58](https://github.com/TommiContursi/Polku/pull/58))
- **The credits stay folded behind ⓘ on a phone** until you tap it. They used to open by themselves when the map's sources came in late.
- **Narrowing a window** to phone width folds them too.

### Bug sweep ([#57](https://github.com/TommiContursi/Polku/pull/57))
- **Heads-up is the same in every sport.** Fallen trees and other obstacles mapped in OpenStreetMap used to come only with the map's Trail details layer on, so a gravel ride past one heard nothing. Now every route on land gets them.
- **Hide what you don't need:** the ⋯ on a Heads-up row hides that kind ("Fallen trees and logs") from now on. Hidden kinds on the route are listed at the end, to bring back with a tap.
- **Wrong in the map?** The same ⋯ on anything from OpenStreetMap opens **Fix the map**, or **Leave a note** for OpenStreetMap's mappers to check, right at the spot.
- **The route menu (⋯) stays inside the window,** opening upwards or scrolling when the window is short. Before, its last items could fall off the bottom.
- **A saved copy says so:** when the server doesn't answer, Polku runs from the copy saved on your device, and now a banner says it may be older, with Reload.
- **The planner sticks to your route's sport** when you change the map's sport: its time, speeds, style and colours stay the route's.
- **Short routes** say "at 40 m" in Heads-up instead of "at km 0.0".
- **Rain amounts at "now"** are the radar's, matching what the map draws; the timeline says "FMI radar" in Finland straight away.
- **On phones:** the summary keeps clear of Done on small screens, the map's credits open as a readable card, and the ⓘ is no longer hidden under the timeline.
- **Map cards that grow after opening** (a LIPAS route's, with Ride) move back into view instead of sliding under the top bar.

### Winter on the route ([#56](https://github.com/TommiContursi/Polku/pull/56))
- **Snow in the time:** where the forecast has snow on your route, the time allows for it: little on ploughed ways and streets, more on trails, most where a trail is slow to open after snow. Time & speed shows how much the snow adds.
- **Winter Heads-up:**
  - the snow on the way;
  - snow falling while you're out;
  - **slippery** rain or sleet around 0 °C;
  - **the cold as it feels at your speed** (frostbite from about −27 °C);
  - ways closed in winter (with Avoid), stretches beside a ski track, unploughed ways, and trails slow to open after snow;
  - for paddlers, **the ice season** (Polku can't see the ice).
- **In the dark** now says how much of it is lit.

### Fixed: changing the sport changed your route ([#54](https://github.com/TommiContursi/Polku/pull/54))
- **Picking another sport in the top menu routed a drawn route again in that sport,** leg by leg, without a word. Now the route keeps its sports, and a note offers **Route it as …** if that's what you want.
- **The planner's own sport picker** shows the route's sport, changes its main sport only (a paddle leg in a ride stays a paddle), and **Undo** brings the route back.
- **When the planner jumps to a section** (the Weather button while planning, Speed, Style…), that section lights up for a moment, so you see where to look.

### Winter as a trail colour ([#53](https://github.com/TommiContursi/Polku/pull/53))
- **Trails & difficulty has a Winter choice** beside Difficulty, Uphill and Both. It colours the trails by how soon they open after snow, with ploughed paths, no access in winter and ski tracks, at any time of year, so you can look before the snow comes.
- **A trail's card and its hover say what it's like in winter,** where that's mapped. A ski track out on a lake or a field has a card of its own, and LIPAS's ski tracks, skating and snowmobile routes say what they're for.

### Winter on the map ([#52](https://github.com/TommiContursi/Polku/pull/52))
- **Winter switches on by itself** where there's snow (5 cm or more at FMI's nearest station, or in the forecast), or set it yourself: **Auto / On / Off** in the new Winter group of the layers panel. The sport pill shows ❄ while it's winter.
- **Snow depth as a layer:** a wash of the snow on the ground (the forecast), with what FMI's stations measured on top. On the timeline as **Snow**.
- **Winter ways from OpenStreetMap,** drawn like Trailmap's winter map: how soon a trail opens after snow, ploughed and unploughed paths, no access in winter (red and white), ski tracks as a double line, ways there only in winter. The summer difficulty colours fade meanwhile.
- **Ski tracks, skating routes on natural ice and snowmobile routes** from LIPAS. Their cards say they're not to ride, with the operator's page for the grooming status.
- **Sea ice for paddlers and swimmers:** FMI's daily ice charts over the sea.

## 2026-10-14

### Round trips for paddling and swimming, and More loops ([#50](https://github.com/TommiContursi/Polku/pull/50))
- **Round trips on the water:** choose a start (a click on the shore will do), a length and a direction, and Polku makes three paddling or swimming loops. They come from Polku's own water router, so they cost no routing calls. They keep to your route style: near the shore, fairways, rocks, the wind for your craft.
- **On a river,** where there's no room for a ring, the loop goes out and back.
- **The cards** show the time, any carrying, and the shipping lanes, rough water or rocks on the way.
- **More loops, in every sport:** if none of the three suit you, "More loops" makes three more in other directions and keeps the first ones (up to nine). It replaces "Other directions".
- **Fixed:** a paddle route's legs, routed side by side, could shift each other's line a little.

### Stops and nights ([#49](https://github.com/TommiContursi/Polku/pull/49))
- **Stop at any point of the route:** a break ("45 min") or a night ("go on at 08:30"). Set it in the point's menu, on its row in the waypoint list, or with **Stop here** on the route.
- **The time moves on with your stops:** arrival times, the weather on the route, the times on the distance marks and the sunset warnings all follow. Each waypoint now shows when you'd get there.
- **Days:** a trip with nights shows each day under Departure & weather: when you leave and arrive, how far, how long, where you sleep, and that day's weather. The summary shows your moving time, with "2 days" under it.
- **Places to sleep nearby:** a night's menu finds lean-tos, huts and campsites within 3 km (from LIPAS and OpenStreetMap). **Go here** moves the point there.
- **A longer forecast** for trips that run past two days: up to 10 days, saying where it gets less certain.
- **Your bike or boat:** when you change out of a bike or a boat, Heads-up tells you if the route doesn't come back for it. If you take it along (a packraft, a folding bike), switch that on in the point's menu.
- **Heads-up warns about a short night** (under 5 hours).
- **Share links, saved routes and GPX files** keep the stops.
- **Fixed:** dragging a point where the sport changes forgot the changeover minutes you'd set there.
- **Fixed:** leaving after sunset, Heads-up gave your departure time as the time of sunset ("After sunset (18:56)" when the sun set at 18:19).

### One click for the route ([#48](https://github.com/TommiContursi/Polku/pull/48))
- **A click on the route opens a menu for that part,** as a tap does on a phone, instead of adding a point straight away. "Add a point here" is the menu's first button; its sport, how it's routed and its style are there too.
- **The same for the ring in the middle of each leg.**
- **Dragging the line still reshapes the route,** and a click on the map away from the route still adds a point.
- Hovering the route says "Click for options · drag to reshape".

### Fixed: a cleared route left its colours on the map ([#47](https://github.com/TommiContursi/Polku/pull/47))
- With the route coloured on the map ("On map"), clearing it removed the line but left the colours and the wind arrows. Now they go with it.

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
