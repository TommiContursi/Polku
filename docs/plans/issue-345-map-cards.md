# The map's cards: facts at a tap, actions on right-click (#345)

The design, for the user to choose from before it's built. What's still to do, and its status, is on GitHub: #345, in the [Phase 25](https://github.com/TommiContursi/Polku/milestone/16) milestone.

- **Status (2026-10-21): a proposal.** Research, a clickable mock-up and this plan; nothing is built.
- **The mock-up:** [mockups/issue-345-map-cards.html](mockups/issue-345-map-cards.html).
- **Rethought (2026-10-29):** the user rethought the cards in #574 ([its plan](cards-rethought.md)). Its decisions replace this plan's "three numbers at most" and "the sport orders, never hides": the same facts for everyone, and one card that tells everything known.

## Revised (2026-10-21)

The cards were revised three times on 2026-10-21; the mock-up's **Cards** switch shows each version on every frame. What's decided, what waits for the user and what's next is in one place: [25d's plan, "Where 25d stands"](25d-check-and-points.md#where-25d-stands). Where it differs from the text below, it wins.

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

- **A tap on the empty map adds a point,** as today. Drawing a route stays one tap a point.
- **A tap on the route, a point or a place's icon shows its facts.** What you can do with it is one step away.
- **A long press, or a right-click, shows what's there and what you can do.** A phone has no hover, so this is how its map details are checked. On a computer the hover tip stays.
- **The action sits at your finger.** On a phone a pin marks the spot, with a small pill just above it: **+ Add a point here**, or **+ Add to my route**. The facts go in the planner's peek, as points, stretches and warnings already do (D and C). On a desktop the card opens at the pointer, its action first. *Why:* a whole card on a small phone's map hides the map, and the peek alone puts the action far from the spot.
- **A stretch's settings are one step away,** behind **Edit this part**. This changes D. Most taps on the route are to check something. A long press or a right-click on the route opens the settings directly, for those who know what they want.
- **A card shows few facts; More shows the rest; All OpenStreetMap details shows the raw data.** Details are prioritised, and the ones that mean nothing are left out, as Polku's cards do today.
- **The sport orders the facts. It never hides them.** Planning a hike, the trail grade (SAC) comes first, and the MTB scale is still there, further down.
- **Not right?** on every card opens OpenStreetMap's own note page at the spot, or its editor. A form in Polku that posts the note is an idea for later (#347).
- **Share** sends a link to the spot, with its name and coordinates. The coordinates themselves are in **More**, with **Copy**.

## How a card reads

- **The name first,** with one short line under it: "Pirunvuoren polku", "Forest path · 0.72 km from the start".
- **Three numbers at most,** each with what it is under it, as the route's summary has them: **10:04** you're here, **+3 %** uphill, **S1** difficulty.
- **One fact per line.** No facts strung together with dots, and no brackets in the app's words.
- **Rows that open the next level,** each with a line on what's in it: **This stretch** (its two ends), **What's under** (the trail, as the map knows it), **More** (everything Polku knows here).
- **Where a fact comes from** is a small tag: "From OpenStreetMap", "From LIPAS". Polku's own estimates say so.
- **A missing fact says so,** in its place: a dashed tile, "? difficulty not mapped". It isn't replaced by another fact, which would make the card look complete (AGENTS.md).
- **Notes use the points' numbers** ("Point added after Via 1"). Long names wrap twice in a note; the marker already shows where.
- **The mock-up's captions** follow the same rule: a title that names the action, then one or two short sentences. Reasons and exceptions are here, in the plan.

## The design

The mock-up draws each of these; its frame ids are in brackets.

### On a phone

- **A tap on the route** [p-route]: the pin and **+ Add a point here** at the spot. The card: the way's name, three numbers for your sport, a warning on the stretch if there is one, and the rows **This stretch** [p-stretch], **What's under** [p-under] and **Edit this part** [p-edit]. The stretch is lit on the map. The pill adds the point at the spot (`insertPoint()`, no routing call), one step of Undo. A tap on the map, ✕ or Back closes the card and adds nothing. The toolbox steps aside while a card is open (D).
- **What's under** shows the trail as the map knows it: your sport's three numbers first, then the other sports' grades, surface, the route it's part of and winter. Then **All OpenStreetMap details** [p-osm] and **Not right?**.
- **A long press on the map** [p-press, p-spot]: hold still for 0.5 s, within 10 px. A ring fills under the finger, since an iPhone gives a web page no buzz. A move or a second finger is the map's own. The card: what's there and its line, **More**, the route's actions (**Start here**, **End here**, **Round trip from here**, **Avoid this spot**), and at the bottom **Share**, **Weather here** and **Not right?** [p-notright]. With no route yet [p-none] the pill says **Start a route here**.
- **More** [p-more]: your sport's details first, then the other sports', then the spot (its height and coordinates, with **Copy**), and when it was last checked. Then **All OpenStreetMap details**.
- **Add to my route puts the point where it fits** [p-added]: where it adds the least distance, between two points or after the finish, never before the start (that's **Start here**). The note says where, with **Undo**.
- **Share** [p-shared] opens the phone's share sheet with a link to the spot and its name and coordinates. Where there's no share sheet (most desktops), it copies them and says so.
- **A tap on a place's icon** [p-place] shows it, even while you draw: a campfire site, a toilet, a lean-to, a LIPAS place, an obstacle. An icon is a small target you aim at, so a tap on one means "what's this?". A tap on a road, a trail or open map still adds a point. The card: its name and kind, its source, the three things you'd want to know there as short labelled facts (for a toilet: free or not, its kind, open in winter), **More** and the bottom row.
- **A place's More** [p-placemore] groups the rest: at the site, getting there, when it's open, when it was last checked, and its links. A toilet has its fee, opening hours, seasons, wheelchair access, baby changing, its kind and who runs it, as far as the map has them.
- **A tap on a point** [p-point]: D's point card. Its name and number, three numbers (when you're there, how far from the start, its height), then **Make it a stop**, **Stay the night**, **Change sport**, **Move**, **Rename**, **Remove**, and **The stretch after it**. **Move** [p-move] is the way without dragging (WCAG 2.2's 2.5.7): tap where it goes. Dragging the marker stays.
- **A long press on the route** [p-holdroute] opens its settings directly. A hold that then moves still reshapes the line (300 ms, as today, `onLinePress()`).

### On a desktop

- **A click on the route** [d-route], **a right-click** [d-spot, d-edit] and **a click on a place's icon** [d-place] open the same cards at the pointer, the card's top-left corner at the click and its action first. Near an edge the card opens the other way, and the action moves to the side nearest the pointer.
- **The keyboard** [d-key]: with the map focused, a crosshair in its middle and the keys listed on the map. The arrows move the map (MapLibre's own keys), Enter clicks at the crosshair, Shift+F10 or the menu key right-clicks there, Escape closes the card.
- **The planner beside the map is drawn simply in the mock-up, on purpose.** The real panel, its tabs and the toolbar stay as they are.

### Everywhere

- **The sport orders, never hides** [w-hike]: in Hike the third number is the trail grade, and the MTB scale moves down to What's under and More.
- **Missing data says so** [w-missing]: the shore path has no MTB scale mapped, and its tile says so.
- **In the route's view** (25c, after Done) a tap shows the same cards without the pill, since nothing is added there. An action that edits goes back to editing first.
- **Long names and Finnish words wrap, never cut** [w-route]. **At 200 %** [w-200] a card is at most half the screen and scrolls inside, so a strip of map keeps the spot and the pill in sight. Polku moves the map to put the spot there, as `startInView()` does for the round trip's start.
- **Privacy:** Share and Weather here send a spot you chose on the map, not your position, and only when you press them.

## What changes in Phase 25's plan

- **The keep table's "The map's menus"** (a point's, a leg's, a spot's): they become the cards above. Every action they have stays, moved.
- **D's stretch card:** its settings are one step away (**Edit this part ›**); a right-click or a long press goes straight to them.
- **§5, the route's view:** a tap there shows these cards, without the pill (above).

## Building it

**Where it fits (the user's call):** with 25d, as its first part, is the recommendation: D's point and stretch cards are the same components, so building them twice would cost a rewrite. Before 25d is possible too, with D's cards drawn as here.

1. **The cards:** the route's, the spot's and a place's (an icon tapped while editing), in the peek on phones and at the pointer on desktops, from `openLegMenu()`, `openSpotMenu()` and `openPointMenu()`'s actions; `routeReadout()` and `describe()` for the facts; the inspector's card behind What's under and More; the stretch lit (`litLeg()`).
2. **The long press** of Polku's own: pointer events, 0.5 s and 10 px, the ring, a second finger cancels; `contextmenu` after a touch ignored, as `bindSpotMenu()` does today (Android sends one for a long press).
3. **Add to my route in its place:** the cheapest insertion over the route's points (`splitLeg()` where the spot is on a leg's line), one step of Undo and a note that says where. **Share:** `navigator.share()` where there is one, else `navigator.clipboard`, as Share link does; the link is the map's view with a new parameter for the spot, which opens with a pin and its card (links without it work as before). **Copy** in More. **Weather here** opens the timeline held at the spot (`js/wxmap.js`).
4. **The details' levels:** which details come first for each sport, for a way and for a place (from `OSM_KEYS` in `js/inspect.js` and LIPAS's fields); the rest in More, grouped; the raw tags on demand (Overpass, as Show all OSM tags does today, for places too); `check_date` or LIPAS's update date as Last checked. **Not right?** builds OpenStreetMap's note and edit links at the spot (`osmNote()`, as today), and LIPAS's page for its places.
5. **The keyboard's crosshair** on the focused map.

**Checks in `tools/smoke.py`:** a tap on the route adds nothing and opens its card; a tap on a place's icon while editing opens its card and adds nothing, and its More › asks Overpass once; the pill adds one point at the spot, one Undo step, no routing call; a long press of 0.5 s opens the card, of 0.3 s is a tap, a move of 12 px pans and opens nothing, two fingers open nothing; Add to my route lands between the right points and never before the start; on desktops the card's action is within 30 px of the click, opening down or up; Enter and Shift+F10 at the crosshair, and Escape; every control 44 px on a phone; 360 × 740, 200 % and Finnish; a spot without terrain says so, and a way without its sport's grade says "not mapped"; in Hike the MTB scale is still in What's under; Share sends the spot's link with its name and coordinates, and the link opens with the pin and the card; Not right? opens OpenStreetMap at the spot.

## Checked with the design skills (2026-10-21)

- **mobile-native:** the pill and the cards' buttons answer on press (`:active`) and never wait for a double tap (`touch-action: manipulation`); no grey flash on tap; no text selection or callout on a long press; a card that scrolls in the peek doesn't drag the page (`overscroll-behavior: contain`) and keeps clear of the home bar (`env(safe-area-inset-bottom)`); Android's `contextmenu` for a long press ignored after a touch (as today). The long press's feel against MapLibre's own panning needs a real phone.
- **The user's review (2026-10-21):** the first version said too much at once: facts strung together with dots and no labels, captions that explained, justified and instructed in one sentence, and labels that were phrases. Rewritten by the rules in "How a card reads", with levels of detail, the sport ordering the facts, Not right? and Share.
- **The worst case:** 360 × 740 in Finnish with long names; 200 %; dark. Fixed in the mock-up while checking: a card that opened above the pointer put its action far from it (the action now moves to the side nearest the pointer), and a card at 200 % hid its spot and pill (now half the screen at most).
- **Not yet:** apple-design and emil-design-eng on the motion (the pill's entrance from the pin, the ring); real phones; someone new, without help (the review's test script).

## Not decided

- Where it goes in Phase 25's order (above).
- The long press's numbers (0.5 s, 10 px) on real phones; iOS and Android differ (0.5 s and 10 pt, 400 ms and 8 dp).
