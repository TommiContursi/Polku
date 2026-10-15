# Polku backlog: bugs, ideas, things to watch

Everything noticed but not done yet, so nothing gets lost between phases. The
ordered plan lives in [ROADMAP.md](ROADMAP.md); when an item here becomes
work, it moves there (or into a fix PR) and is ticked off here.

Each item says when (and, where it matters, in which phase) it came up.

## Bugs and quirks

### Small: the next bug sweep
- **Hidden Heads-up kinds in one place** *(bug sweep, 2026-10-15; goes with ROADMAP 22a's Check tab)*: a kind you hide shows at the end of Heads-up only on a route that has it. Settings could list them all, to bring any back.
- **Snow below Auto's threshold says nothing where you look** *(2026-10-15; goes with ROADMAP 21)*: at Paljakka a thawing first snow (FMI: 12 cm on 14 October, 3 cm the next morning) left winter off, right by the rule (on from 5 cm), while the route counted the forecast's 6 cm. Only the layers panel says why. A dim ❄ on the sport pill with "Not winter here: 3 cm of snow" would answer it where you look.

### Bigger: later
- **From the water onto land, and back** *(multisport, 2026-10-15; a proposal waiting for a decision)*:
  - **Today:** in Paddle or Swim, a point on land makes the leg carry over the land to it, drawn dotted orange and timed as a carry. Only a leg that's mostly land offers "Hike instead". A swimmer or a paddler walking from the beach to a lean-to gets a carry instead of a walk.
  - **The proposal:** where a water leg reaches the shore on its way to a point on land, the leg splits at the landing. It's water to the landing, a changeover there, then on foot to the point. The other way round, a put-in where a leg on foot reaches the water.
    - A paddle leg leaves the boat at the landing (the gear check says so, and "taken along?" makes it a carry).
    - A note says what happened, with Undo, and with "Carry the boat instead" for paddling.
    - A portage between two lakes stays a carry.
  - **On foot is Hike today.** A **Walk** sport could follow (paths and streets at a walking pace, no trail grading), which would suit city walks too.
- **The planner keeps the map's sport underneath** *(bug sweep, 2026-10-15)*: what it shows now follows the route's main sport, but the planner still takes the map's sport as the default for new legs, the round-trip presets and the share link's `a=`. A planner with a sport of its own (set by the route, changed by Route it as) would be the clean model, about 40 places in `planner.js`.
- **Trail details along every route cost Overpass calls** *(bug sweep, 2026-10-15)*: they now load for gravel and road routes too (up to 40 tiles a route, cached a week), not only with the map's layer on. Watch the Overpass counter in Settings; a long road route over 40 tiles skips them.
- **Winter routing that prefers ploughed ways** *(15b, 2026-10-15)*: BRouter has no winter tags, and its no-go lines block hard or barely steer, so winter only warns (with Avoid) for now. Polku's own graph router for skiing (15c) could take the winter classes and prefer ploughed and quick-opening ways for bikes too.
- **The uphill band has one width.** Uphill grades come from the vector tiles, which have no width, so in Uphill mode the band doesn't follow the trail's width; the centre line does. Grading the trail-details ways instead would fix it. *(2026-10-14)*
- **Trail-detail tiles are cached a week,** so a fallen tree cleared yesterday still shows. *(2026-10-14; see "Fresher trail data" below)*
- **Share links re-route imported GPX tracks.** A fixed leg from a file travels as its two ends only, so whoever opens the link gets a routed leg, not your track. LIPAS legs now travel as references (12c); a GPX track would need its line in the link (too long for a URL) or a short-link service. *(2026-10-14)*

### To watch
- **Smoke (headless Chrome) can fail the phone sheet heights** when the machine is short of network connections or CPU: seen once, not reproduced. *(2026-10-14)*

### Fixed
- ~~**Back to start did nothing**~~ *(verified 2026-10-15; assessment in #62)*: the round-trip state hid the action with the same name. The action now has its own name; regression checks click all three buttons and verify the return leg and Undo.
- ~~**The profile's numbered marks looked like the waypoints**~~ *(2026-10-15)*: fixed in #61. They were the climbs. The profile draws the route's own points now, and the climbs as "↑1" tags.
- ~~**Export, share and offline only in Go**~~ *(2026-10-15)*: fixed in #61. They're in ⋯ too.
- ~~**The map's credits open on phones**~~ *(2026-10-15)*: fixed in #58. MapLibre opens them by itself when their text comes in after the map has loaded; now they stay folded behind ⓘ on phone-wide windows until tapped, and fold when a window narrows.
- ~~**Heads-up was different in each sport**~~ *(2026-10-15)*: bug sweep (#57). Fallen trees and other mapped obstacles came only with the map's Trail details layer on. Now every route on land gets them, and each row's ⋯ can hide its kind or point to OpenStreetMap to correct it.
- ~~**The route menu ran off a short window**~~ *(2026-10-15)*: bug sweep (#57). Menus measure themselves and scroll inside when they must.
- ~~**The saved copy looked current**~~ *(2026-10-15)*: bug sweep (#57). When the server doesn't answer, a banner says it's the saved copy, with Reload.
- ~~**The planner's summary follows the map's sport**~~ *(found in #54)*: bug sweep (#57). The summary, Time & speed, style, colours, climbs and weather follow the route's main sport.
- ~~**Rain labels at "now" come from the forecast**~~ and ~~**"· radar" instead of "· FMI radar"**~~ *(2026-10-14)*: bug sweep (#57).
- ~~**On a 360 px phone the summary nearly touches Done**~~, ~~**the opened attribution runs under the Plan button**~~ (and the ⓘ was under the timeline), ~~**a tall card sits under the top bar**~~ *(2026-10-14)*: bug sweep (#57).
- ~~**LIPAS has few lean-tos in Nuuksio**~~ *(13c)*: checked in the bug sweep: LIPAS lists 3 lean-tos, 2 lodges and a tent area there. The park's other shelters are in OpenStreetMap, which Places to sleep merges in.
- ~~**Changing the sport in the top menu re-routed a drawn route**~~ *(2026-10-15)*: fixed in #54. The route keeps its sports when the map's sport changes, and a toast offers "Route it as …". The planner's own picker shows the route's sport, routes its main sport only, and Undo brings it back.
- ~~**The planner's section links didn't show where they lead**~~ *(2026-10-15)*: fixed in #54. Every jump to a section (the Weather button, Speed, Style, links in the summary) lights that section up for a moment.
- ~~**The tests ran on cached files when the dev server was down**~~ *(2026-10-14)*: fixed then. `tools/cdp.py` stops without a dev server and bypasses the service worker.

## Ideas

- **Hidden settings** *(2026-10-15)*: the map shows different places for each sport (harbours, beaches and toilets for paddling and swimming, lean-tos for hiking…). One switch ("Lean-tos, huts, campfire & landing sites (LIPAS)", "OSM outdoor places") hides which kinds it has, and they change with the sport behind your back. Show the kinds under each switch, each yours to turn on or off, with the sport's defaults marked. LIPAS routes the same (phase 20). Look for other per-sport defaults that change silently. *(phase 21)*
- **A glowing route line** *(2026-10-15; in ROADMAP phase 20)*: a stronger neon halo as an option beside the plain red line, to make the route stand out over busy layers.
- **A clicked road highlighted** *(2026-10-15; in ROADMAP phase 21)*: when not planning, a click on a road or trail could highlight the whole OSM way. The tiles cut a way at their edges; the exact way comes with "Show all OSM tags" (Overpass `out geom`), so highlight the tiles' part at once and the whole way once it's fetched.
### Weather *(now ROADMAP phase 17, with a check before heavy loads)*
- **More weather on the map** *(2026-10-14)*:
  - **clouds:** Open-Meteo has low, mid and high cloud cover;
  - **thunder:** FMI's open data has lightning observations, and Open-Meteo has CAPE and lightning potential;
  - **snow:** Open-Meteo snowfall and snow depth, FMI snow depth (phase 15).
  - Each would be a switch under *Weather on the map*, on the timeline.
- **Timeline into the past** *(2026-10-14)*: a few hours back, to see how the rain has moved. FMI's radar layers keep about two weeks at 5 minutes (WMS `time`), so the last 2–3 hours could play like the forecast does.

### Routes and search *(2026-10-14)*
- ~~Ride a LIPAS route, add one to yours, and find routes and stops in search~~ *(done in 12c)*.
- ~~Search: grouped results, recent searches~~ *(done in 12c)*; still to do: "near me" categories (lean-to, campfire site, parking, water).
- **Loops inside a LIPAS network** (Laajavuoren ulkoilureitit: "Vuorenlenkki 5 km, Kuntolenkki 8.5 km…"): LIPAS doesn't name its parts (`reitti_nimi_fi` is empty), so Ride takes the longest line through them. Picking a loop by clicking its stretches one after another would let you ride "Kuntolenkki". *(12c)*
- **Snap a LIPAS line to the paths:** LIPAS lines are drawn by hand, about one point every 40–75 m, so a ride can cut corners off the real path. An optional "follow the paths" pass (one BRouter call with the line's points as via points) would fix the profile and trail details, at the cost of one call. *(12c)*
- OSM route relations (Waymarked Trails) as rideable routes.

### Water *(phase 13, 2026-10-14)*
- **Depths for routing:** Traficom's hydrographic licence excludes route planning; an agreement with Traficom (copyright@traficom.fi) would allow it. Ask whether a free, non-commercial paddling planner can get one.
- **Water rocks from the NLS terrain database** ("vesikivi", CC BY 4.0) with your own free NLS API key, the way Polku's optional MML layers work.
- **A static water-hazards file** (OSM rocks, reefs and shoals for Finland, built weekly by a GitHub Action from Geofabrik's extract), if Overpass stays unreliable. All four mirrors failed while building phase 13.
- **Wind beyond waves:** a headwind or crosswind cost per craft (a canoe in a crosswind), and gusts; the forecast at each leg's own hour on long trips.
- **Show the keep-clear zones and the wind exposure on the map** while planning, so the route's bends explain themselves.
- **Multisport** (ROADMAP phase 13b, OK'd).

### Your own things
- **Saved places** *(2026-10-14)*: star a place and find it again, starting on the device (export and import). They'd sync only if a login comes; see phase 16's backend question.
- **Saved routes:** a list of routes, not just the last one.

### Trail details
- **Fresher trail data:** show a tile's age in the key, a "Refresh trail details here" action, or a background refresh for tiles over a day old (Trailmap's makers have had trouble with data that only updates a few times a day). *(2026-10-14)*
- **Uphill band at the trail's width:** see Bugs.
- **Static trail tiles** (PMTiles built weekly by a GitHub Action from Geofabrik's Finland extract) if Overpass stays flaky. *(phase 12 design)*

### Planner
- **The planner's layout** *(2026-10-15)*: tabs for drawing, checking and going; the ⋯ menu's tools out in the open; a panel to move and snap on desktop; the profile and the time as cards to pull out onto the map. Now ROADMAP phase 22 (22a next, with a mock-up).
- ~~**The leg you edit lit up on the map**~~ *(2026-10-15; done in 22a, #60)*: a leg opened in the waypoint list glows on the map and in the profile, the rest faded. In ROADMAP 22a.
- ~~**Round trip from the first click**~~ *(2026-10-15)*: done in 22a (#60). The empty planner offers it, and the first click's card offers a loop from there.
- ~~**One profile, not two**~~ *(2026-10-15)*: done in 22a (#60). The profile chart itself moved under the summary, with all it had.
- ~~**The time earlier, the speeds with the style**~~ *(2026-10-15; done in 22a, #60)*: Time & speed opened with the speed inputs, far down. The time goes first in Go, and the speed inputs move beside the route style ("How you go"). In ROADMAP 22a.
- **Where you are, and the way on** *(2026-10-15)*: the location dot showing which way you face, following you on the map, how far along the route you are, and recording the track, with the phone's own GPS and compass. Now ROADMAP phase 23 (23a–23d).
- The route's colour sits in the header and in the profile *(done in #37)*.
- **A quick point on the line** (Alt-click, say) if two clicks for a point (#48: a click opens the part's menu, "Add a point here" is its first button) feel slow. Dragging already makes one. *(2026-10-14)*
- **Departure more than 48 hours ahead** *(13c, 2026-10-14)*: a weekend trip planned on Monday. The route's 10-day forecast would cover it; the timeline (and its weather map) stops at 48 h, so this needs a date picker that leaves the map's timeline alone.
- **Places to sleep along the route** *(13c)*: "Lean-tos near km 40–60" for choosing where the night goes, not only near a point that's already a night.
- **The nights on the profile and the timeline** *(13c)*: the profile is by distance, so a night is a thin line there; the timeline's band could leave the nights out.
- **Two nights in one place** (a rest day) *(13c)*: a night lasts until the next morning; a "Stay 2 nights" choice would cover it.
- **Where does the boat come from?** *(13c)*: the gear check warns about gear left behind; a paddle leg that starts far from where the boat was could say so too, unless it's a rental.
- **Swipe for more loops** *(14)*: "More loops" is a card at the end of the list. A swipe past the third card could make them too, but on land each round costs routing calls, so a tap is safer. Revisit if people miss it.
- **Water loops: the headwind share and open water** *(14)*: the router keeps out of rough water and Near the shore keeps the via points near land, but the cards don't rank by headwind, or by how far from shore a loop goes.
- **Water loops in a new area are slow** *(14)*: 8–18 s the first time (fetching the fairways and Overpass's rocks), 3–5 s after. A coarser grid for candidates, or the area's data fetched before the click, would help.
- **Property boundaries** *(2026-10-14; Trailmap has a toggle for them)*: MML's open cadastral vector tiles (`avoin-karttakuva.maanmittauslaitos.fi/kiinteisto-avoin`, Trailmap's source) need a free API key. Polku already takes your own MML key in Settings for the MML maps, so the layer could use the same key (never Trailmap's).
- **More from Trailmap's settings** *(viewed 2026-10-14)*:
  - **MML paths and minor roads:** the National Land Survey's topographic paths, which OSM may lack. MML open vector tiles, with the same key question.
  - **Digiroad overlays:** Polku already has paved roads, private roads and speed limits (Layers → Roads), and traffic volumes under Traffic & safety.
  - **Bedrock and a "green forest" switch.**
  - **High contrast and a colour-tone choice** (Default / Plus / Super).
  - **Places shown sooner or later** (a −2 … +2 zoom offset).
  - **Your own shortcut buttons on the map.**
  - **Profiles per activity,** with "Reset profile defaults".
  - Strava heatmaps aren't possible (Strava's own login and terms).
- **Grooming status beyond the Helsinki region** *(15 research, 2026-10-14)*: Fluent Outdoors has it for 45 municipalities (Jyväskylä, Kuopio, Oulu…), but its terms forbid reuse without written permission. Ask Jyväskylä (the data's owner) to publish it as open data, or Fluent Progress for permission.
- **Tour skating on natural ice** *(15)*: LIPAS `1550` skating routes and the ploughed ice tracks (Kuopio, Helsinki, Tampere); a Skate sport after Ski, with the same ice rules.
- **Winter maintenance of streets and paths** *(15)*: Digitraffic tracks ploughing, salting and sanding, but outside state roads only Kuopio. Worth a look for winter cycling if more towns join.
- **Satellite snow cover and lake ice** *(15)*: Copernicus HR-S&I (20 m) and Lake Ice Extent (250 m, daily) would be sharper than the model, but need an account (CDSE). Revisit if they open a public map service.
- **More grab handles along long legs,** by their length on screen, so it's clear the whole line can be dragged, not just its middle. *(2026-10-14)*
- **Avoid profiles** ("Avoid obstacles and faint trails") with Polku's own BRouter profiles, if warnings and ranking turn out not to be enough. *(phase 12 design; warnings were chosen first)*

## Things to watch (possible future issues)

- **FMI retires its old radar layers at the end of November 2026,** including `suomi_rr_eureffin`, which "now" reads. Polku falls back to reflectivity on its own, but that overstates drizzle. Find the replacement before then (ROADMAP, phase 12 "Later"). **Dated.**
- **brouter.de pauses busy devices** ("retry later"; escalates to about 30 minutes). Never burst-test it: use the local BRouter (`tools/brouter-local.sh`). Valhalla on FOSSGIS stands in.
- **Overpass mirrors are flaky:** 504s on every mirror at times while building phases 12 and 13. Trail details are best-effort and cached; route warnings from BRouter don't depend on it. The water router waits 2.5 s for OSM's rocks, then routes without them and re-routes when they arrive.
- **Traficom's licence:** its depth layers are shown "not for navigation" and never used for routing. If Traficom changes the licence or asks, the layers can be dropped from Paddle's defaults. **Watch.**
- **Free tiers if Polku gets popular:**
  - Open-Meteo: 10 000 calls a day per IP, non-commercial;
  - Overpass: 10 000 a day in `net.js`;
  - FMI: 20 000 a day;
  - GitHub Pages: about 100 GB a month of bandwidth.
  - The counters are in Settings → data sources.
- **OpenFreeMap's tile URLs change weekly;** saved offline areas use version-free keys (`sw.js`).
- **LIPAS search costs three requests** per query (12c: the combined layers `lipas_kaikki_reitit` / `lipas_kaikki_pisteet` take one filter for every type). If LIPAS renames or drops those layers, search loses its routes and stops (Places still work).
