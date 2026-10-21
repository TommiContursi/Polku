# Research: taps, clicks and menus in six route planners (#345)

For [the map's cards](issue-345-map-cards.md), 2026-10-21. How Komoot, Ride with GPS, Strava, Google Maps, Gaia GPS and Garmin Connect answer a click or a tap on the map, on the route, a right-click or a long press, and how they add a point in the middle; what new users struggle with and what experienced users miss; and how a long press and a drag can work on a phone's map.

**How it was found:** the apps' own help pages, most of them updated in 2025–2026, their forums, and the platforms' guidelines. Older or user-reported claims say so. Reddit couldn't be searched, and Komoot's help pages were read through their Zendesk API. Each claim has its source in brackets; the list is at the end. Things change: a help page can be behind the app.

## The apps

### Komoot
- **On a computer,** a click on the map opens a small card. **Add to Route** puts the new point "at the best possible spot" in the route, not at the end; **Set as destination** (or Alt / Option and click) makes it the new end [K1, K5]. The **+** in the waypoint list adds a point just before the end [K1].
- Dragging the line anywhere makes a new waypoint; dragging a waypoint moves it; the list reorders by dragging; a point is removed from the list (on hover) or by selecting it on the map and **Remove** [K1]. Undo and redo with Ctrl or Cmd+Z; holding M hides the route's line [K1]. No right-click menu is documented [K7].
- **On a phone,** a tap on the map asks whether the point goes at the end or in between as a waypoint, then asks to confirm. Points reorder by their handles in the list and go with ✕ [K2]. A tap on the route opens Trail View and Street View [K4]. New planners came to iOS in June 2026, then Android; Komoot says 8.6 % more people now save a route they made in the planner [K4].
- **For one part:** off-grid (a straight dotted line) is a setting of a waypoint or a segment: **Set as off-grid segment** on the web, **Follow ways** in the app [K3]. The sport and the route's preferences are the whole route's [K1, K4].
- **Facts:** the profile switches between height, surfaces, way types and weather, and lights the matching stretch on the map [K1, K2]; Route Alerts; climbs and descents listed (2026) [K1, K6].
- **"Between the two nearest points":** about right for **Add to Route** on the web, though Komoot says "the best spot", not the nearest two; the app asks each time.

### Ride with GPS
- **On a computer,** what a click does is a setting: **Add to Route**, **Control Point** or **POI**, and it's remembered between visits [R1]. In Add to Route a click extends the route along roads; the routing mode (Cycling, Walking, Driving or **Draw Lines**) can change between clicks, so one stretch can be straight [R1].
- White control points pin the line; dragging between two of them reshapes only that stretch. Alt and click on the line adds a control point; on a point, removes it [R1, R4].
- **Right-click:** undo and redo, add or remove a control point, start or end a selection; with Premium also change the start, add a POI, split, Street View, look it up in OpenStreetMap, suggest a Highlight, Inspect Routes Here and Explore Nearby [R1, R3]. A selection can be deleted, cropped, coloured, given a surface or left out of the totals [R3].
- **On a phone,** each tap extends the route with a control point; tap one and **Delete** to remove it [R2]. A tap on the route opens a menu; **Move** keeps a pin still while you move the map under it, shows a grey preview, then asks to **Confirm** [R2]. A segment can be recoloured; a POI or Highlight can be **Included in Route** from the route's nearest point, or **Routed to** at the end [R2].
- **Facts:** the line drawn solid, dashed or hollow for paved, unpaved and unknown; a profile with surfaces that a finger can scrub; a double-click on the profile selects a hill [R1, R2, R4].

### Strava
- **On a computer,** a click adds a waypoint; a click on the line offers **Insert Waypoint**; waypoints drag on the map or reorder in the list, and a click on one gives Delete and Customize [S2, S3]. The preferences (most popular or direct, height, surface) are the whole route's; undo, redo and reverse [S3]. No right-click menu found.
- **On a phone,** each tap adds a point, routed along ways people have ridden [S1]. A tap on the line offers **Add Point** (where it goes isn't said). To move a point: tap it, **Move Point**, then tap the new place, with no dragging; **Delete** removes it [S1].
- A pencil draws a sketch, and **Manual Mode** (straight or freehand lines) is in the ⋯ menu; undo after a sketch takes away the whole stroke [S1]. A 2025 redesign shows height, distance and surface [S4]. Whether Manual Mode changes only the next points is unclear.

### Google Maps and My Maps
- **On a computer,** a driving route can be dragged to a new place; up to 9 stops, reordered by dragging [G1]. Right-click shows the coordinates to copy [G2] and **Measure distance**, where a click adds a point, a drag moves one and a click on one removes it [G3]. "Directions from / to here" and "What's here" on right-click come from a 2014 source [G4].
- **On a phone,** touching and holding a place without a label drops a pin and puts its coordinates in the search box [G2]. Measuring on Android moves the map until a black circle is on the next place, then **Add point**; Undo takes away the last [G3]. Android's help changes stops but says nothing of dragging the line [G1].
- **My Maps** draws a line a click at each bend, a double-click to end [G5], with driving, cycling and walking routes [G7]. Its Android app closed in 2021, so on phones it's the web page [G6]. How to edit a line's points in the middle wasn't confirmed.

### Gaia GPS
- **On a computer,** a click adds a point at the end; the line or a point can be dragged; a click on a point gives **Delete Point** or **Add Waypoint** [A1]. The routing mode can change at any time, so it's per stretch; Shift gives a straight line for a moment, and snapping turns to straight lines by itself when a click is far from a trail [A1]. **Manage Route Marker** places waypoints instead of route points [A1]. Outside planning, a click opens a side panel with the height, coordinates, save a waypoint, make a route, share and directions [A4].
- **On a phone,** a tap adds a point at the end; a point moves by holding it, then dragging; dragging one of the distance marks along the line inserts a point; a tap on a point and the pencil give delete or name [A2, A3]. On iPhones, switching to Straight Line turns *the whole route* straight [A2]; Android has a snapping switch and a freehand mode (hold the white dot and drag) [A3]. Outside planning on Android, a tap opens a drawer with the height, coordinates, weather, saved things nearby and places of interest [A5].
- **Facts:** the profile coloured by steepness; hovering shows the distance, height and gradient [A1].

### Garmin Connect
- **On a computer,** you choose Custom or Automatic. Custom offers popular routes, following roads or freehand, and a click makes a point [M1]. An older forum thread says a click adds to the end and the line is dragged by a white dot that shows on hover [M3]. Cycling courses show climbs by category [M1]; a mode for one stretch isn't documented.
- **On a phone** (a 2023 source): tap the start, then the end; distance, ascent and descent show, a back arrow undoes, and ⋯ offers a loop and course points; popular routes, following roads and freehand were the web's only [M2].

## What new users struggle with

- **Points added by accident.** People adding waypoints with a trackpad while trying to move the map were told to lock waypoints, or to use a **Place Waypoint** button that puts one at a fixed cursor (2024) [X1]. Ride with GPS built a correction for taps that land a little way up a side street [R5]. Komoot made Trail View's dots smaller to hover because their cards kept covering the map (April 2026) [K6].
- **A new point landing at the end.** Garmin users thought points went in "at random" because a click appends [M3]; Mapy.com users complain that a new point goes to the end and then has to be moved [X2].
- **Modes that are hidden or stay on.** Ride with GPS's click action is remembered between visits [R1]; Gaia's switch on iPhones changes the whole route [A2]; Gaia hides placing waypoints behind a switch [A1]; Strava's Manual Mode is in ⋯ [S1].
- **The router won't take the way I want:** a common question at Ride with GPS [R2] and Gaia [A2]; the answer is to put points closer together [A6].

## What experienced users miss

- **Edits that undo other work.** Ride with GPS loses custom cues when the route changes later [R3]. Strava users pin two waypoints so that a drag doesn't move the rest; in 2019–20 they couldn't add control points afterwards, which **Insert Waypoint** may have fixed since [S5].
- **An undo that takes too much, or none.** Strava's undo after a sketch takes the whole stroke [S1]; Mapy.com users ask for an undo at all [X2].
- **Fiddly point editing.** Garmin users rebuild courses from scratch (an older thread) [M3]; in 2026, adding a course point needs the cursor within 1–2 px of the track, the map zooms out, and names are cut to about 15 characters [M4].
- **Too little room.** Komoot has one sport a route [K1]; Google has nine stops, and its phone help shows no dragging the line [G1].

## A long press and a drag on a phone

- **How long, how far:** iOS waits 0.5 s and lets the finger drift 10 points [P1]; Android waits 400 ms, and 8 dp of movement is a scroll [P2]. Gaia moves points by holding, then dragging [A2].
- **The web adds its own limits:** iOS Safari never sends `contextmenu` for a long press, so a page times it itself with pointer events [P6]; MapLibre has no long-press event, and its `contextmenu` is the right mouse button [P7]; `navigator.vibrate` isn't in Safari, is off in Firefox for Android, and needs a user's gesture in Chrome [P5]. So on iPhones what a buzz would say has to be shown; Apple says haptics should back up other feedback, consistently [P4].
- **Select, then act:** Strava's Move Point then a tap [S1], Ride with GPS's Move [R2], OsmAnd's Move point and Add a point before or after [X3]. It also meets WCAG 2.2's 2.5.7, which asks for a way that doesn't need dragging [P8].
- **A crosshair in the middle:** Google's Measure distance [G3], OsmAnd adding at the map's middle [X3], Ride with GPS's Set Location [R2], the Place Waypoint button above [X1].
- **Handles and a magnifier:** handles on the line, as Gaia's distance marks [A2] and Ride with GPS's control points [R1], at least 24 CSS px [P9]; Esri's map kits show a magnifier on a long press that moves the map near the edge [P11].
- **Undo rather than asking to confirm** for everyday actions [P10]. Apple: a gesture of your own must never be the only way, and say when one isn't available [P3].

## What it suggests

1. **A tap on the empty map on a phone could open a card instead of adding a point:** Komoot's app asks "the end or a waypoint" [K2], Gaia and Google show facts first [A5, G2], and points added by accident are a common complaint [X1, R5]. *Polku keeps one tap a point, as the user decided, with Undo always on the toolbox and one step a tap.*
2. **A new point goes where it fits in the route, and says where; adding at the end is a choice of its own:** Komoot's **Add to Route** [K1], Ride with GPS's **Include in Route** [R2]; appending confuses people [M3, X2].
3. **A tap on the line opens that stretch's card,** its facts and what to do: move, add a point, follow paths or a straight line [K4, K3, R2].
4. **A straight line is a setting of one stretch, not a mode of the whole route:** Gaia's switch on iPhones is the warning [A2]; Komoot, Ride with GPS, Gaia's web planner and OsmAnd do it per stretch [K3, R1, A1, X3]. *Polku already does.*
5. **Dragging is never the only way:** every drag has a **Move** with a tap or a crosshair beside it [P8, S1, R2, G3].
6. **A long press made by Polku itself:** about 400–500 ms and 8–10 px of slop, with a ring or a pin to see, since iPhones give the web no `contextmenu` and no buzz [P1, P2, P6, P5].
7. **Undo in sight, one step per action, nothing to confirm for everyday edits** [P10, S1, K1].
8. **Facts tied to the map:** scrubbing the profile lights that stretch, and each stretch shows its surface, way type, gradient and alerts [K1, A1, R1].

## Sources

- **K1** <https://support.komoot.com/hc/en-us/articles/10194270667034> · **K2** <https://support.komoot.com/hc/en-us/articles/10206792140826> · **K3** <https://support.komoot.com/hc/en-us/articles/10268757747738> · **K4** <https://support.komoot.com/hc/en-us/articles/11223871075738> · **K5** <https://support.komoot.com/hc/en-us/articles/10207909543066> · **K6** <https://support.komoot.com/hc/en-us/articles/10621431252250> · **K7** <https://www.komoot.com/help/routeplanner>
- **R1** <https://support.ridewithgps.com/hc/en-us/articles/4415462488475> · **R2** <https://support.ridewithgps.com/hc/en-us/articles/4415456909339> · **R3** <https://support.ridewithgps.com/hc/en-us/articles/4415470200859> · **R4** <https://support.ridewithgps.com/hc/en-us/articles/21415203276827> · **R5** <https://the5krunner.com/2019/12/11/ride-with-gps-new-rwgps-android-features>
- **S1** <https://support.strava.com/en-us/articles/15401660-creating-routes-on-mobile> · **S2** <https://support.strava.com/en-us/articles/15401644-how-do-i-add-custom-waypoints-to-my-strava-routes> · **S3** <https://support.strava.com/hc/en-us/articles/216918387-Route-Builder> · **S4** <https://thehealthcaretechnologyreport.com/strava-introduces-new-features-to-enhance-training-and-route-planning-for-cyclists-and-runners/> · **S5** <https://www.trainerroad.com/forum/t/new-strava-route-builder/36294?page=2>
- **G1** <https://support.google.com/maps/answer/144339> · **G2** <https://support.google.com/maps/answer/18539> · **G3** <https://support.google.com/maps/answer/1628031> · **G4** <https://searchengineland.com/google-brings-back-right-click-directions-google-maps-185352> · **G5** <https://support.google.com/mymaps/answer/3433053> · **G6** <https://support.google.com/mymaps/answer/10656656> · **G7** <https://www.codot.gov/programs/bikeped/saferoutes/assets/safe-route-to-schools_google-map-instructions.pdf>
- **A1** <https://help.gaiagps.com/hc/en-us/articles/115003640568> · **A2** <https://help.gaiagps.com/hc/en-us/articles/115003523607> · **A3** <https://help.gaiagps.com/hc/en-us/articles/115003526167> · **A4** <https://help.gaiagps.com/hc/en-us/articles/115003524567> · **A5** <https://help.gaiagps.com/hc/en-us/articles/4409332168727> · **A6** <https://www.overlandbound.com/forums/goto/post?id=445728>
- **M1** <https://www.garmin.com/en-GB/blog/how-to-build-a-course-in-garmin-connect/> · **M2** <https://tech.yahoo.com/general/articles/create-course-garmin-connect-083004403.html> · **M3** <https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/77578/how-to-edit-a-route> · **M4** <https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/437595/garmin-connect---frustration-with-course-points/2037725>
- **X1** <https://forum.myrouteapp.com/post/52496> · **X2** <https://community.mapy.com/post/2034> · **X3** <https://docs.osmand.net/docs/user/plan-route/create-route/>
- **P1** <https://developer.apple.com/documentation/uikit/uilongpressgesturerecognizer/minimumpressduration> (and `allowableMovement`) · **P2** <https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/view/ViewConfiguration.java> · **P3** <https://developer.apple.com/design/human-interface-guidelines/gestures> · **P4** <https://developer.apple.com/design/human-interface-guidelines/playing-haptics> · **P5** <https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate> and <https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json> · **P6** <https://bugs.webkit.org/show_bug.cgi?id=213953> · **P7** <https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/> · **P8** <https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html> · **P9** <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html> · **P10** <https://www.nngroup.com/articles/confirmation-dialog/> · **P11** <https://developers.arcgis.com/android/java/sample-code/show-magnifier/>
