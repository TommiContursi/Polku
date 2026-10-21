# The map's cards: facts at a tap, actions on right-click (#345)

The design, for the user to choose from before it's built. What's still to do, and its status, is on GitHub: #345, in the [Phase 25](https://github.com/TommiContursi/Polku/milestone/16) milestone.

- **Status (2026-10-21): a proposal.** Research, a clickable mock-up and this plan; nothing is built.
- **The mock-up:** [mockups/issue-345-map-cards.html](mockups/issue-345-map-cards.html).

## What Polku does today, and what can be reused

How the map answers a tap or a click while you plan (`js/planner.js` unless it says otherwise), at `59ec31e`:

| On the map | Today | Reusable |
|---|---|---|
| **A tap on the empty map** while editing | adds a point at the end (`onMapClick()` → `addPoint()`); a point on open water asks how you get there (`offerPaddle()`) | as it is: drawing stays one tap a point |
| **A tap on the route** | that part's menu (`openLegMenu()`): its two points' names, its sport, length and km, then **Add a point here** (`insertPoint()`), the part's sport (`legSportPicker()`), Follow / Straight / Water (`setLegMode()`), its style (`legStylePicker()`), Other ways (`offerAlts()`), Stop here (`stopHere()`), Avoid this spot (`addNogo()`), On the profile (`showLegOnProfile()`) | every action; the facts at the spot come from `routeReadout()` in `js/chart.js` (km, height, gradient, way and surface, difficulty, width, visibility, the wind and the time you get there), which the desktop's hover shows today |
| **A press and drag on the route** | reshapes it: a mouse drags at once, a finger after a 300 ms hold (`onLinePress()`, with a tap after a late hold still a tap, #293) | as it is |
| **The handles** in the middle of each leg | drag to reshape, a tap opens the part's menu (`renderGhosts()`), hidden where the leg is short on screen | as they are |
| **A tap on a point** | its menu (`openPointMenu()`): the next leg's sport, mode and style, the changeover minutes, the stop (`stopEditor()`), the gear, Start here, Finish here (`startAt()`, `finishAt()`), Back to start, Remove point | every action |
| **Right-click, or a 550 ms press on a phone** | "This spot" (`bindSpotMenu()`, `openSpotMenu()`): Add a point here (or Route from here and Add to my route with the planner closed), Round trip from here, Avoid this spot; on the route, that part's menu | the hold's timing and its guards (a move of 10 px or a second finger cancels it; a tap that a busy page saw late is still a tap) |
| **A place to avoid** | its menu (`openNogoMenu()`): Stop avoiding | as it is |
| **The map's own card** (the planner closed, and since 25c the route's view) | `initInspector()` in `js/inspect.js`: the way, place or layer under the tap, with Route from here, Add to route and Avoid; a one-line summary of the same thing is `describe()` in `js/hover.js`, which the desktop's hover tip uses | the card behind **More ›**, and `describe()` for the one line |
| **Inserting a point between others** | `splitLeg(li, ll)`: a new via point on a leg, at the spot of its line nearest the tap, keeping the routed geometry, so it costs no routing request; `legAt(m)` finds the leg at a distance along the route | the core of **Add to my route** in its place |
| **Exact places** | the round trip's Where I am to five decimals (#281); share links; nothing copies a spot's coordinates yet | `navigator.clipboard` as Share link uses it |
| **The weather at a spot** | the timeline shows the spot under the mouse, else the map's middle (`js/wxmap.js`, `pointerLL`) | **Weather here ›** opens the timeline held at that spot |

**What the map's own cards show today** (`js/inspect.js`, with the planner closed, and since 25c in the route's view): for a road or a trail, its type, the LIPAS route it's part of, MTB difficulty, the uphill grade (the uphill layer, else the terrain under the click), surface, access and what "private" means, a bridge or boardwalk, trail details (width, visibility, overgrown, mud, fallen trees, fords, SAC) and the height, and **Show all OSM tags** on demand (Overpass: smoothness, track grade, the MTB and SAC scales, incline, lit, the winter tags, its length, a link to the way and to improve it); for a trail obstacle, OpenStreetMap's tags, with Fix the map and a note; for a LIPAS route or place, its name, type, town, length, surface, toilet, information, website and LIPAS's page, and a route's Follow this route; winter ways, road works and conditions, military areas, sea marks, ships, cameras, and the depth of the water (shown only). **A place from the map** (a toilet, a shelter, a peak: `renderPoi()`) has only its name, its type and the height: no OpenStreetMap details on demand, as a way has. While editing, none of these cards opens: a tap adds a point.

Where it's measured: **Add a point here** is the menu's first action, but the menu opens above the click, so at 1440 × 900 it was 232 px above the click (at the top of a 300 px menu) and on a 390 × 844 phone 145 px away (`678b495`, a tap in the middle of a straight leg).

## Research (2026-10-21)

The whole report, app by app with every source, is [issue-345-research.md](issue-345-research.md); this is its short version. From the apps' own help pages (mostly updated 2025–2026), their forums and the platforms' guidelines; Reddit couldn't be searched.

| | A tap or click on the map | On the route | Right-click, long press | A point in the middle |
|---|---|---|---|---|
| **Komoot** | web: a small card, **Add to Route** puts the point where it fits best in the route, **Set as destination** (or Alt-click) at the end; app: asks whether at the end or as a waypoint, then confirms [K1, K2, K5] | app: Trail View and Street View [K4] | no menu documented [K7] | drag the line anywhere; a point is moved by dragging and removed from the list or the map [K1] |
| **Ride with GPS** | web: what a click does is a setting (add to the route, a control point, a POI), and it's remembered; phone: each tap adds a point [R1, R2] | phone: a menu; **Move** keeps a pin still while the map moves under it, then **Confirm** [R2] | web: undo, redo, add or remove a control point, a selection's start and end, and more with Premium (Street View, look up in OSM, inspect routes here) [R1, R3] | drag between two control points reshapes only that stretch; Alt-click adds one [R1, R4] |
| **Strava** | adds a point [S1, S2] | web: **Insert Waypoint**; phone: **Add Point** [S1, S3] | none documented | phone: **Move Point**, then tap the new place: no drag [S1] |
| **Google Maps** | shows the place [G2] | web: drag a driving route [G1] | web: the coordinates to copy, **Measure distance**; phone: a long press drops a pin and shows its coordinates [G2, G3] | stops, reordered by dragging, up to 9 [G1] |
| **Gaia GPS** | adds a point at the end; outside planning, a card with height, coordinates, weather and what's near [A1, A4, A5] | drag it [A1] | — | phone: drag one of the distance marks along the line [A2] |
| **Garmin Connect** | adds a point at the end [M1, M3] | drag it by a dot that shows on hover [M3] | — | users rebuild courses rather than edit them (an older thread) [M3] |

- **Where a point goes:** Komoot's **Add to Route** and Ride with GPS's **Include in Route** put it where it fits in the route; apps that add at the end confuse people ("points join at random") [K1, R2, M3, X2].
- **What new people struggle with:** points added by accident while trying to move the map [X1, R5]; a new point landing at the end and having to be moved [M3, X2]; modes that are hidden or stay on (Ride with GPS's click action, Gaia's switch that turns the whole route straight on iPhones, Strava's Manual Mode in ⋯) [R1, A2, S1]; the router not taking the way they want [R2, A2].
- **What experienced people miss:** edits that undo other work (cues lost, a drag that moves too much) [R3, S5]; an undo that takes away too much, or none [S1, X2]; fiddly point editing (a cursor within 1–2 px of the track, names cut short) [M4]; one sport a route, and a few stops only [K1, G1].
- **A long press and a drag on a phone:** iOS waits 0.5 s and allows 10 pt of drift, Android 400 ms and 8 dp [P1, P2]. On the web, iOS Safari never sends `contextmenu` for a long press and has no `navigator.vibrate`, and MapLibre has no long-press event, so Polku times it itself and shows it on screen (a ring filling under the finger) instead of a buzz [P5, P6, P7]. Dragging must never be the only way (WCAG 2.2's 2.5.7): Strava's and Ride with GPS's **Move**, OsmAnd's point at the map's middle, Google's crosshair for measuring [S1, R2, X3, G3, P8]. Undo beats asking to confirm for everyday edits [P10].
- **Against the user's choice** that a tap adds a point (decided below): Komoot's app asks every time, and points added by accident are a common complaint [K2, X1]. One tap a point stays, because drawing is the main thing the planner does and Polku's Undo is always on the toolbox, one step per tap [P10]; a tap on the route never adds one.

Sources: K1 support.komoot.com/hc/en-us/articles/10194270667034 · K2 …/10206792140826 · K3 …/10268757747738 · K4 …/11223871075738 · K5 …/10207909543066 · K7 komoot.com/help/routeplanner · R1 support.ridewithgps.com/hc/en-us/articles/4415462488475 · R2 …/4415456909339 · R3 …/4415470200859 · R4 …/21415203276827 · R5 the5krunner.com/2019/12/11/ride-with-gps-new-rwgps-android-features · S1 support.strava.com/en-us/articles/15401660-creating-routes-on-mobile · S2 …/15401644-how-do-i-add-custom-waypoints-to-my-strava-routes · S3 support.strava.com/hc/en-us/articles/216918387-Route-Builder · S5 trainerroad.com/forum/t/new-strava-route-builder/36294 · G1 support.google.com/maps/answer/144339 · G2 …/answer/18539 · G3 …/answer/1628031 · A1 help.gaiagps.com/hc/en-us/articles/115003640568 · A2 …/115003523607 · A4 …/115003524567 · A5 …/4409332168727 · M1 garmin.com/en-GB/blog/how-to-build-a-course-in-garmin-connect · M3 forums.garmin.com (…/77578/how-to-edit-a-route) · M4 forums.garmin.com (…/437595) · X1 forum.myrouteapp.com/post/52496 · X2 community.mapy.com/post/2034 · X3 docs.osmand.net/docs/user/plan-route/create-route · P1 developer.apple.com (UILongPressGestureRecognizer) · P2 android.googlesource.com (ViewConfiguration.java) · P5 developer.mozilla.org (Navigator.vibrate) · P6 bugs.webkit.org/show_bug.cgi?id=213953 · P7 maplibre.org (MapEventType) · P8 w3.org/WAI/WCAG22/Understanding/dragging-movements · P10 nngroup.com/articles/confirmation-dialog

## Decided with the user (2026-10-21)

- **A tap on the empty map adds a point,** as today: drawing a route stays one tap a point.
- **A tap on the route or a point shows its facts;** what you can do with it is one step away.
- **Right-click, or a long press on a phone, shows actions,** and what's there: map and trail details must be easy to check on a phone too, where there's no hover. On a computer the hover tip keeps showing them.
- **The pill at the spot:** on a phone a tap on the route (or a long press) puts a pin where you tapped and a small pill just above it, **+ Add a point here** (or **+ Add to my route**), so the finger doesn't cover it; the facts go in the planner's peek, where points, stretches and warnings already show (D, C), and the map stays in view. On a desktop the card opens at the pointer like a right-click menu, its action first. The other two options lost something: a whole card on the map covers a small phone's map, and the peek alone puts the action far from the spot.
- **A stretch's settings are one step away** (this changes D): its card shows facts first (the spot, the stretch, its warnings, What's under ›), and **Edit this part ›** opens D's settings exactly as approved. Most taps on the route are to check something, and the card stays short. A right-click or a long press on the route opens the part's settings directly, so experienced users skip the extra tap.

## The design

The mock-up draws each of these; its frame ids are in brackets.

### Phones

- **A tap on the empty map** adds a point at the end, as today: one tap a point, Undo on the toolbox.
- **A tap on the route** [p-route] puts a pin where you tapped and **+ Add a point here** just above it (44 px; below the spot when the spot is right under the top bar), so the finger doesn't cover it. The stretch's card goes in the peek: its top row says where ("At 0.72 km") with ✕; then the spot's facts (the height, the gradient, when you'd be there; the way and its name: `routeReadout()`); the stretch it's on, with both ends named, its distance, time and climb and its warnings, lit on the map (D); **What's under ›** [p-under], the map's own card for the way under the line, with Back; and **Edit this part ›** [p-edit], D's settings as approved. The pill adds the point where you tapped (`insertPoint()`: no routing call), one step of Undo. A tap on the map, ✕ or Back closes the card and adds nothing. The toolbox steps aside while a card is open (D).
- **A tap on a point** [p-point] opens D's point card: its name, "There at 10:09 · 1.65 km", **Make it a stop**, **Stay the night**, **Change sport from here**, **Move**, **Rename**, **Remove**, and the stretch after it ›. **Move** [p-move] is the way without dragging (WCAG 2.2's 2.5.7): "Tap where it goes", with **Cancel**, one step of Undo. Dragging the marker stays.
- **A long press on the map** [p-press, p-spot]: hold still for 0.5 s, within 10 px; a ring fills under the finger, since an iPhone gives a web page no buzz. A move or a second finger is the map's: it pans or zooms, and nothing opens. A pin and **+ Add to my route** above it, and the card in the order decided: one line of what's there (`describe()` in `js/hover.js`) with **More ›** [p-more] for the map's own card, and ✕; with a route, **Start here**, **End here**, **Round trip from here**, **Avoid this spot**; small at the bottom, the coordinates with **Copy**, and **Weather here ›**. With no route yet [p-none] the pill says **Start a route here**.
- **Add to my route puts the point in its place** [p-added]: where it adds the least distance, between two points of the route or after the finish, never before the start (that's **Start here**). The note says where ("Added between Pirunvuoren näköala and Tapatoran laituri"), with **Undo**.
- **A tap on a place's icon** [p-place] shows it even while editing: a campfire site, a toilet, a lean-to, a LIPAS place, an obstacle, a camera. Its card in the peek says what it is, with LIPAS and its website where it has them, **More ›** for OpenStreetMap's details on demand, the coordinates and Weather here ›; the pill is **+ Add to my route**, in its place. An icon is a small target you aim at, so a tap on one means "what's this?"; a tap on a road, a trail or open map still adds a point, since that's where you draw.
- **A long press on the route** [p-holdroute] opens the part's settings directly, with the pill too; on a point, its card. A hold that then moves still reshapes the line (300 ms, as today, `onLinePress()`); held still to 0.5 s it's the settings instead.

### Desktops

- **A click on the empty map** adds a point, as today, and the hover tip stays.
- **A click on the route** [d-route] opens the card at the pointer, its top-left corner at the click: **+ Add a point here** first, then the spot's facts, the stretch, **What's under ›**, **Edit this part ›**. Near an edge it opens the other way, and the action moves to the side nearest the pointer.
- **Right-click on the map** [d-spot]: the spot card at the pointer, **Add to my route** first. **A click on a place's icon** [d-place]: its card at the pointer, as on a phone. **On the route** [d-edit]: the part's settings, **Add a point here** first. **On a point:** its card.
- **The keyboard** [d-key]: with the map focused, a crosshair in its middle; the arrows move the map (MapLibre's own keys), Enter is a click at the crosshair, Shift+F10 or the menu key a right-click there, Escape closes a card. Everything the pointer can do on the map, and an exact place to put a point.

### Everywhere

- **A place's More ›** has OpenStreetMap's details on demand, as a way's card has (opening hours, fee, drinking water, wheelchair access, website), through Overpass and `request()`, with a link to the node and to improve it.
- **The desktop planner in the mock-up is drawn simply, on purpose:** only what the cards need. The real panel, its tabs and the toolbar stay as they are (the calmer planner's plan).
- **Missing facts never look complete** (AGENTS.md): a spot with no terrain says the height isn't known (`noTerrain()`), a way with no tags says so, and Weather here says when the forecast can't load.
- **In the route's view** (25c, after Done) a tap shows the same cards without the pill, since nothing is added there; an action that edits (Add to my route, Edit this part, Move) goes back to editing first.
- **Long Finnish words and names wrap, never cut** [w-route, w-spot]; a card's actions wrap onto another row rather than shrink. **At 200 %** [w-200] a card in the peek is at most half the screen and scrolls inside, so a strip of map keeps the spot and the pill in sight; Polku moves the map to put the spot there, as `startInView()` does for the round trip's start.

## What changes in Phase 25's plan

- **The keep table's "The map's menus"** (a point's, a leg's, a spot's): they become the cards above. Every action they have stays, moved.
- **D's stretch card:** its settings are one step away (**Edit this part ›**); a right-click or a long press goes straight to them.
- **§5, the route's view:** a tap there shows these cards, without the pill (above).

## Building it

**Where it fits (the user's call):** with 25d, as its first part, is the recommendation: D's point and stretch cards are the same components, so building them twice would cost a rewrite. Before 25d is possible too, with D's cards drawn as here.

1. **The cards:** the route's, the spot's and a place's (an icon tapped while editing), in the peek on phones and at the pointer on desktops, from `openLegMenu()`, `openSpotMenu()` and `openPointMenu()`'s actions; `routeReadout()` and `describe()` for the facts; the inspector's card behind What's under and More; the stretch lit (`litLeg()`).
2. **The long press** of Polku's own: pointer events, 0.5 s and 10 px, the ring, a second finger cancels; `contextmenu` after a touch ignored, as `bindSpotMenu()` does today (Android sends one for a long press).
3. **Add to my route in its place:** the cheapest insertion over the route's points (`splitLeg()` where the spot is on a leg's line), one step of Undo and a note that says where. **Copy** (`navigator.clipboard`, as Share link). **Weather here ›** opens the timeline held at the spot (`js/wxmap.js`).
4. **The keyboard's crosshair** on the focused map.

**Checks in `tools/smoke.py`:** a tap on the route adds nothing and opens its card; a tap on a place's icon while editing opens its card and adds nothing, and its More › asks Overpass once; the pill adds one point at the spot, one Undo step, no routing call; a long press of 0.5 s opens the card, of 0.3 s is a tap, a move of 12 px pans and opens nothing, two fingers open nothing; Add to my route lands between the right points and never before the start; on desktops the card's action is within 30 px of the click, opening down or up; Enter and Shift+F10 at the crosshair, and Escape; every control 44 px on a phone; 360 × 740, 200 % and Finnish; a spot without terrain says so.

## Checked with the design skills (2026-10-21)

- **mobile-native:** the pill and the cards' buttons answer on press (`:active`) and never wait for a double tap (`touch-action: manipulation`); no grey flash on tap; no text selection or callout on a long press; a card that scrolls in the peek doesn't drag the page (`overscroll-behavior: contain`) and keeps clear of the home bar (`env(safe-area-inset-bottom)`); Android's `contextmenu` for a long press ignored after a touch (as today). The long press's feel against MapLibre's own panning needs a real phone.
- **The worst case:** 360 × 740 in Finnish with long names; 200 %; dark. Fixed in the mock-up while checking: a card that opened above the pointer put its action far from it (the action now moves to the side nearest the pointer), and a card at 200 % hid its spot and pill (now half the screen at most).
- **Not yet:** apple-design and emil-design-eng on the motion (the pill's entrance from the pin, the ring); real phones; someone new, without help (the review's test script).

## Not decided

- Where it goes in Phase 25's order (above).
- The long press's numbers (0.5 s, 10 px) on real phones; iOS and Android differ (0.5 s and 10 pt, 400 ms and 8 dp).
