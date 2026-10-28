# Phase 25: a calmer route planner (#233)

The design. What's still to do, and its status, is on GitHub: [Phase 25: a calmer planner](https://github.com/TommiContursi/Polku/milestone/16), phase issue #233. The order of phases is in [ROADMAP](../ROADMAP.md).

- **Status (2026-10-18): approved; phase 25, built in four parts (25a–25d),** after the shared fixes below and before 22b. From phase 24's review ([the report](../reviews/2026-10-17-design/README.md), #177): the user chose variant B, a second iteration worked out seven questions, and the user settled the last choices on 2026-10-17 and approved the design on 2026-10-18. Built so far: 25a, A with 25b, B and 25c (#302, #309, #335, #339, #342); the rest follows the order agreed on 2026-10-20. **25d's implementation plan,** with #345's map cards built in it: [25d-check-and-points.md](25d-check-and-points.md), approved on 2026-10-21 and revised the same day; what's decided and what's open is its section [Where 25d stands](25d-check-and-points.md#where-25d-stands).
- **The mock-up:** [mockups/phase-24-planner.html](mockups/phase-24-planner.html), clickable on phone and desktop frames, with switches for the worst case, Finnish and Swedish, and the theme. `?frame=<id>` shows one frame at full size; `&w=360&h=740`, `&z=2` (200 % zoom), `&lang=fi`, `&worst=1`. Pictures of the second iteration: `pr-screenshots`, `claude/phase-24-design/iter2/`. **Updated on 2026-10-21 to what's built:** the start and its steps, the round trip, the first point's peek and the route's view look as #335, #339 and #342 built them, and so do the drawing menu's order and the desktop toolbar's sport button. B's Settings frame and its first water note are marked Replaced.
- **Revised 2026-10-20:** three journeys through the planner, after a review of the whole interface asked that everyday tasks explain themselves: see [Revised journeys](#revised-journeys-2026-10-20-proposals) below, and sections A to C of the mock-up. **Decided the same day (the user's choices):** the sport works as option A (B below); the warning row shows the item on the route (C); points and legs follow V1, refined (D); the start's iteration 2 (A). The refined frames of A and D were approved the same day, with the sport in the ways' header added. The order of work was agreed the same day, and the ways card says **Close** (the user's choice, 2026-10-20). B gained [multisport, easy to find](#b-the-sport-and-what-it-changes) the same day. The mock-up's `&sport=next|all` and `&pts=v2|v3` still show the options not taken.

## Decided

**Replaced by later decisions (2026-10-20): don't build these from here.** Each is marked where it's described below, and in the mock-up.
- **The waypoint list** (items 7 and 9, §7, §8's waypoint rows, 25d's waypoint checks): replaced by **D**, points and legs, V1 refined. The mock-up's section 6 is marked Replaced; build from its section D.
- **The warning row that opens Check** (§6's peek row): replaced by **C**: the row shows the item on the route, with ‹ › and Back, and is there for what wasn't checked too. Check's three groups and their sources stay. The mock-up's frame "The peek, paddle" is marked Replaced.
- **The toolbox at the start** (§1): replaced by **the toolbox grows with the route** (25b's Built section): none before the first point, apart from undo and redo while there's something to undo or redo; the mode and More at the first point; the route's actions at the first leg. The mock-up now draws it so.
- **The round trip's progress in the Make 3 loops button** (§3, the mock-up's "Making them"): replaced by the form folding to what's being made and how far it's got (25b's Built section). The mock-up now draws it so.

1. **The toolbox holds how the next leg is drawn,** undo, redo and More. The route style is a setting of the whole route: the mode button's second line, and its own group in the mode's menu.
   - **Phones:** one drop-down for the three modes; More (⋯) last in the toolbox. Done stays at the right of the route's summary.
   - **Desktops:** a labelled toolbar hanging off the panel's edge, with its tooltips and keys. No sentence on the right: the route's actions instead (Reverse, Back to start, Show the whole route), then More and Done.
2. **Show the whole route** is there whenever a route is on the map: in the map's column under Locate on phones, in the toolbar on desktops; F as today.
3. **Round trips in the peek** after the first point: the sport's lengths and Other, any distance or time, a green Make 3 loops. As in the second iteration, unchanged.
4. **More (⋯)** holds the whole route's actions, grouped as in the second iteration: take it along, the whole route, Clear apart with Undo. The route's summary shows the route.
5. **Done ends editing:** the route's view to read, check and take along; Edit goes back, where Done was; ✕ puts the route away.
6. **Check by how serious and how sure:** Read before you go, Worth a look, Not checked, each item with its source; nothing new is checked.
7. **Waypoints:** only the selected one has its controls, small to look at and 44 px to touch; no Remove on the others. **Today's waypoint and leg editor is kept,** organised in the selected row. *Replaced by D (2026-10-20).*
8. **Everything Polku does today stays** unless this plan says it changes (below).
9. **Selection and expansion of waypoints are two states** (2026-10-18): a tap expands, a tap on the header collapses and keeps the selection, a new point is selected but collapsed, a marker's tap selects its row; dragging (mouse, long press, markers) touches neither. *Replaced by D (2026-10-20).*
10. **The desktop panel's place and width keep working:** side or bottom, resized from its edge; the toolbar follows, and is placed so that 22b's right dock and dragging need no new design.
11. **The 3D button (#226)** comes before the phase, as planned.

## The rule for building it: change, move, keep

**Polku as it is on `main` is the source of truth for what the planner does.** The mock-up decides where things go and how they're reached, not everything in them: it draws the profile, Climbs, On the route, On the map, Go's time, the weather along the route and parts of the leg editor simply, on purpose. Those stay exactly as they are, built by the code that builds them today. Each part's PR moves existing components into their new places and changes only what's listed here.

| | What | The code it is today |
|---|---|---|
| **Changes** | The header: one row, the warning row above it; no colour, sport, Round trip or style chips; no tools row; `fitHeader()`'s shrinking goes | `buildPanel()` (`els.head`, `els.toolsRow`, `quickPair`, `fitHeader()`) |
| | The toolbox (phone) and the toolbar (desktop), their menus and keys | new, outside `#planner`; `setMode()`, `setStyle()` as today |
| | More (⋯) in place of today's ⋯ menu | `toggleMore()` and its items |
| | Show the whole route in the phone's map column | `fitRoute()` as today; `#map-ctrls` in `index.html` |
| | Done leads to the route's view; Edit; ✕; reopening as left | `setActive()`, plus `setEditing()`; `onMapClick()`, the markers' drag and `onLinePress()` check it |
| | The first point's peek and the round trip's form; the loop cards side by side | `renderLoop()`, `renderLoopCards()`; `startTip()` goes (#232) |
| | Heads-up grouped in three, with sources and what was looked at | `renderWarnings()`; a `tier` and `src` on each warning where it's made |
| | The waypoint list's rows: one button each; the selected row holds the controls; Find, Key points, the bar, Move to | `renderWaypoints()` |
| **Moves** (the same component, a new place) | The route's colour (`colorSel`): only on the profile, where Colour by and On map already are | `renderQuickColor()` → the profile's `modeSelect` |
| | The sport (`sportSel`): the top bar's pill only (#245), also reached from the ways to begin's header, which opens the same menu (A, 2026-10-20). With a route drawn, the pill doesn't route it again: its legs keep their sport and a note offers "Route it as…" (corrected 2026-10-20; what it should do is [Revised journeys](#revised-journeys-2026-10-20-proposals), B) | `renderQuickSport()` → `js/main.js`'s sport pill |
| | The route style's chip: the mode's menu (phones) and the toolbar (desktop); How you go keeps the full style section | `quickStyle` → `renderStyle()`'s section, unchanged |
| | Round trip's chip: the first point's peek, the start, More, Route's tools | `quickLoop` → `openLoop()`, unchanged |
| | Show the whole route: from the header to the map's column (phones) and the toolbar (desktop) | `els.fit` |
| | Undo, redo, the modes: from the header to the toolbox | `els.undo`, `els.redo`, the modes' `seg` |
| | Export GPX, Copy share link, Save offline, Import, Clear route: from ⋯ (and the wide bottom bar) to More; Go › Take it along keeps them | `exportGpx()`, `share()`, `app.saveOffline()`, `#file-input`, `clear()` |
| | Reverse and Back to start: also in the desktop toolbar and More; Route's tools keep them | `reverse()`, `backToStart()` |
| | A waypoint row's controls: into the selected row | `legSettingsRow()`, `legSportPicker()`, `legStylePicker()`, `stopChip()`, `stopEditor()`, `departSelect()`, `gearToggle()`, the changeover minutes, `movePointTo()`, `removePoint()`, `setName()` |
| | Moving the panel: stays at the end of the tabs' row and in Settings (22b drags it) | `els.dockBtn`, `setDock()` |
| **Stays as it is** | The profile: its colouring by mode, the route's points and legs on it, the climbs' tags, hover synced with the map, a drag to zoom into a stretch, its size button | `js/chart.js`, `setProfileCompact()` |
| | Climbs: the list with uphill grades or gradients, each lighting its stretch | `renderClimbs()` |
| | On the route: every breakdown (gradient, uphill difficulty, MTB difficulty, surface, way type, width, visibility, wind, temperature, rain, sport) with its bars, distances, legends, previews and the actions that colour the route by it | `renderBreakdown()`, `breakdownRows()`, `pickColor()`, `previewCategory()` |
| | On the map: distance marks, arrival times and elapsed times, each its own switch | `renderOnMap()`, `drawMarks()`, `setMarks()` |
| | Go › Time: the total, depart and arrive, where the time goes (by surface, uphill, the wind and snow, by sport, stops and nights), your speeds | `renderSpeed()`, `renderSpeedEditor()`, `sportRows()` |
| | Go › Departure & weather: the docked timeline, the weather along the route or on the water, the sun, the days of a trip with nights | `js/wxmap.js`'s dock, `renderWind()`, `sunLine()`, `daysList()` |
| | Go › Take it along | `renderTake()` |
| | How you go: route style presets, controls, wet ground, a leg's own style, your speeds | `renderStyle()`, `renderStyleWet()`, `renderSpeedEditor()` |
| | Heads-up's actions: Avoid, Short cut, Use BRouter, Retry, ⋯ (hide this kind, fix the map), hidden kinds to bring back | `renderWarnings()`'s rows, `hideWarnKind()`, `addNogos()`, `useShortCut()` |
| | The map's menus: a point's, a leg's (Other ways, Stop here, Avoid this spot, On the profile), a spot's. *Since 2026-10-21 they become #345's cards in 25d, every action kept ([25d's plan](25d-check-and-points.md)).* | `openPointMenu()`, `openLegMenu()`, `openSpotMenu()` |
| | Other ways, LIPAS routes, an imported track's card, places to avoid, stops and nights, changeovers, the lit leg, routing and its stand-in, the water router, offline, share links, saved routes | unchanged |

## 1. The toolbox and the toolbar

**Two ideas, two places.** The drawing mode (Follow paths, Straight line, Over water) is a tool for the *next* leg; a drawn leg's own mode changes from its menu on the map or its row, as today. The route style is a setting of the *whole* route: it's what Follow paths (or the water router) prefers for every leg without a style of its own, and changing it routes the route again (`setStyle(style)`; legs with their own style keep it, as today).

**Phones:**
- **The toolbox:** the mode button (its icon, its name, the style under it when the mode uses one), undo, redo and More (⋯), floating at the bottom left above the sheet. About 300 px in English: it floats beside the map's buttons on a 390 px phone and docks into the sheet as its first row on narrower phones, with Finnish words at 390, at 200 % zoom, or with the sheet raised high. Docked, the mode's name stays whole: undo, redo and More go to a line of their own first. *Since 2026-10-20 it grows with the route: there's none before the first point (25b's Built section).*
- **The mode's menu:** "Draw the next leg", the three modes with one line on what each does, the note that only legs drawn next change; then "Route style · the whole route" as chips, and Fine-tune in How you go.
- **Done** stays at the right of the route's summary: the bottom right is where the thumb is, the toolbox has no room for it beside More, and Done belongs with the route it finishes. Edit takes its place in the route's view.
- **In the route's view** the toolbox keeps only More: there's nothing to draw.

**Desktops:** the toolbar hangs off the panel's map-facing edge, one surface with it.
- **Left to right:** the three modes with their names (P, S, W) · the route style as a two-line button ("Route style / Balanced") · undo and redo · Reverse, Back to start and Show the whole route (icons with tooltips) · More (⋯) and **Done**.
- **Tooltips** on every control (kept as in the second iteration): its name, its key, one sentence; about 450 ms the first time, then at once for the next one; keyboard focus shows them too.
- **When room runs out** (a narrower window, longer words): Reverse and Back to start fold into More first (they're there anyway), then the style's caption goes. At 1440 × 900 everything shows. *Replaced (2026-10-27, step 2): beside the side panel at 1440 × 900 four of the route's actions are in More, since the map's buttons are level with the toolbar at the foot.*
- **Clear route** stays in More, apart, with Undo.
- **In the route's view** the toolbar keeps Show the whole route, More and Edit (Edit last, where Done was).
- **The panel's place and width, as today:** the side panel's width is still dragged from its edge (`bindResize()`), and the panel still moves between the side and the bottom (`setDock()`, the button at the end of the tabs' row, Settings). The toolbar follows both: beside the side panel it hangs off the panel's right edge at the top, its left edge moving with the panel's width; with the panel at the bottom it sits on the panel's top edge at the left, above the panel. In both it stays below the top bar, clear of the map's buttons and of the timeline, and folds (as above) instead of overlapping them; it's placed by one function from the panel's rectangle (`ResizeObserver` on the panel and the window), so 22b's right dock and dragging only feed it another rectangle (a right-docked panel gets it on its left edge). *Replaced (2026-10-27, step 2, #468): beside the side panel the toolbar sits at the bottom of the panel's edge, at the map's foot, with the scale and the credits on it; in the bottom dock it keeps the panel's top edge (the Built section's step 2).*
- **The panel's header** shows the route: the warning row when there's something to read before you go, the numbers, Minimise; the route's name and ✕ in the view.

**Keys (desktop):** P, S, W pick the mode; Ctrl+Z, Ctrl+Shift+Z undo and redo; F shows the whole route; E is Done or Edit; R opens and closes the planner, as today. Nothing animates for a key.

**States:** the mode in use is ticked in the menu and filled in the toolbar, never by colour alone; undo and redo appear with the first change and are disabled, not hidden, when there's nothing to undo or redo; Reverse and Back to start are disabled while the route has fewer than two points (Back to start also on a loop). *Replaced in part (2026-10-20): the toolbox grows with the route, so the route's actions appear with the first leg instead of disabled before it, and Back to start isn't offered on a loop (25b's Built section).*

**Icons:** Follow paths keeps its path between two dots; Straight line becomes a plain line between dots; Over water becomes waves under a dashed line (today's drop reads as rain). Every mode has its word.

## 2. Show the whole route

An existing feature that has to stay obvious:
- **Phones:** in the map's column, directly under Locate (the two "show me where" buttons together), whenever a route is on the map: while drawing, in the route's view and with the planner put away. Always there rather than only while part of the route is out of view, so it's where people learned it is and the column doesn't move. Its icon is today's (a route in a frame); its name is "Show the whole route".
- **Desktops:** in the toolbar, with F. With the planner put away, in the map's column as on phones.
- **What it does:** `fitRoute()` as today: the whole route framed above the sheet or beside the panel (`frame()`).
- **Room on short phones:** with the sheet raised, the column keeps what fits between the top bar and the sheet, leaving out first the compass while north is up (it's back as soon as the map is turned, which is when it's needed), then 3D (still in Layers). In the mock-up: on a 375 × 667 phone with the sheet at half, the column is Locate, Show the whole route, Weather and Layers; on 360 × 740, 3D stays too. At peek every button shows.

## 3. Round trips

As in the second iteration: after the first point the peek says "Tap the map for your next point" and offers "Round trip from here" with the sport's first three lengths and Other (`LOOP_PRESETS`). A length opens the round trip with that length chosen: Distance or Time, the four lengths, − / + (5 km for bikes, 1 km on foot or water, 15 minutes by time) or typed, the direction, the start, the cost in routing calls, and a green **Make 3 loops**. While the loops are made the map waits (#109), and the form folds to what's being made and how far it's got (2026-10-20, 25b's Built section; it replaces the progress in the Make 3 loops button). The loops are cards side by side; a tap on a card or its line picks it (#89); Use loop A takes it, with Undo. Round trip stays at the start, in More, in Route's tools and in the map's menus. Closes #232.

## 4. More (⋯)

The last button of the toolbox and the toolbar, in editing and in the route's view. Its menu, as in the second iteration:
1. **Its head:** the route's name and "✓ Kept on this device".
2. **Take it along:** Share link, Export GPX, Save offline….
3. **The whole route:** Round trip from the start, Reverse, Back to start, Import GPX or KML….
4. **Clear route**, after a gap, in red, last; a note with Undo after it (#90), and Undo in the toolbox.

On phones it opens upward from its button, clear of the map's buttons, and scrolls inside when taller than the room; with no room above (200 %, a raised sheet) it opens as a sheet of its own. On desktops it opens under its button. A tap outside closes it and does nothing else.

## 5. Done, the route's view, and coming back

| State | On screen | A tap on the map | Reached by |
|---|---|---|---|
| **Editing** | the toolbox (desktop: the full toolbar); the summary with Done (phones) | adds a point; markers and the line can be dragged | Plan with no route; Edit; a map menu's "Add to my route" |
| **The route's view** | the route's name, "kept on this device" and ✕; the summary with Edit (phones); More (and on desktops Show the whole route and Edit) in the toolbox | the map's own popups; markers stay put | Done; Plan with a route; after a reload, if it was open (#238) |
| **Put away** | the route on the map; Plan and Show the whole route in the map's column | the map's popups | ✕ in the view, or a swipe below the peek |

- In the view, buttons that say what they do still work (Avoid in Check, the departure, Other ways); the list and the map don't change by touch. Route's list shows the points without their controls, with "You're not editing" and Edit.
- ✕ and a swipe below the peek put the route away with a note, "Planner closed · your route stays · Open". Plan reopens it as it was left.
- Nothing is lost by any of them: the route is kept on this device as today (`save()` on every change), and undo outlives Done and ✕.
- Getting ready to go is Go, as today; 23b's Start goes at the top of Go and in the view. A list of routes (#157) would add "Your routes" at the start and "Save to Your routes" in More.

## 6. Check: how serious, and how sure

Today's Heads-up items, sorted; nothing new is checked.

| Group | Today's items in it | Shown as |
|---|---|---|
| **Read before you go** | shipping lanes; rough water for your craft; ice season; frostbite risk, very cold; slippery around 0 °C; in the dark; road works, traffic incidents; marked no access; cycling not allowed; no access in winter; alpine terrain (SAC T4+); legs not routed yet | a filled triangle, a tinted card; a row in the peek; the tab's badge in the warning colour |
| **Worth a look** | steep climbs and descents; technical trails (S3+); steps; unpaved on road tyres; carries; straight lines; ferries; ways marked private; busy roads; trail details (overgrown, fallen trees, fords, gates, faint); ski tracks, unploughed ways, slow to open after snow; harbours; rocks and shoals; a short night; the gear check; Valhalla standing in | an eye, plain rows; a neutral count on the tab when nothing is more serious |
| **Not checked** | a source that didn't answer: rocks and shoals, trail details, terrain, winter ways, the weather | a dashed circle with "?", a dashed card; "?" beside the badge; Retry |

Each item says where it comes from: **Live** (Fintraffic, with the time), **From the map** (OpenStreetMap: may be out of date or wrong), **An estimate** (the terrain model, the forecast, the waves), **Calculated** (the dark). The end of Check lists what was looked at for this route and says that nothing listed doesn't mean open, safe or allowed. A way marked private says what that usually means in Finland (often a yard or a road closed by a sign; in the forest everyman's right usually lets you pass). The peek's row ("1 to read before you go · Road works: Teiskontie ›") shows only while there's something in the first group, and not while Check is in sight. *Replaced by C (2026-10-20): the row shows the item on the route instead of opening Check, and is there for what wasn't checked too.* Within a group the order is along the route; every action of today's rows stays.

## 7. Waypoints and legs

> **Replaced by D (2026-10-20):** points and legs, V1 refined ([below](#d-points-and-legs-iteration-2), and the mock-up's section D). This section is the design of 2026-10-18, kept for the record; build 25d's waypoints from D, which keeps this section's dragging and its tools for long routes where it says so.

**The rows:** every row is one button (its marker, its name in up to two lines, "Via 23 · 5.7 km · 07:58", small icons for a stop, a change of sport or a leg of its own). No Remove.

**Selection and expansion are two states** (approved 2026-10-18):
- **Selected** is the point you're on: highlighted in the list and ringed on the map, its leg lit on the map and the profile (22a's lit leg). One point at most.
- **Expanded** is a row whose controls are open. One row at most, and it's always the selected one; a selected row can be collapsed.
- **A tap on a row** selects it and expands it; a tap on the expanded row's header collapses it and leaves it selected; a tap on another row moves both to that one.
- **Adding a point** selects it, collapsed: drawing doesn't open controls. A tap on a marker on the map selects its row (collapsed, scrolled into view) and opens the point's menu on the map, as today.
- **Dragging** a row (the grip with a mouse, a long press on a phone) or a marker on the map moves the point and nothing else: it doesn't change which row is selected or expanded, and a drag never counts as the tap that expands. A long press that turns into a drag cancels its tap; a tap never starts a drag.
- **Neither is saved:** both live in memory, outside the route, share links and undo.

**The selected row** holds today's controls, organised by what they belong to:
- **The point:** its name (rename in place); on the start, the departure; a stop (Break with its minutes, Night with the morning's hour, or none: `stopChip()`, `stopEditor()`); where the gear goes along (`gearToggle()`); at a change of sport, the minutes to change; on the finish, Back to start.
- **The leg after it** ("Next leg · MTB · Follow paths · the route's (Balanced)", or "Flowy trails · its own"): its sport, how it's drawn and its style, each the route's unless set here, Fine-tune, and Other ways. This is today's leg editor (`legSettingsRow()`, `legSportPicker()`, `legStylePicker()`), moved, with its behaviour unchanged: a leg with its own style or sport keeps it when the route's style or sport changes, and "the route's" follows the route. "All leg settings" in Route's tools still opens every leg's at once.
- **Its place:** Earlier, Later, Move to… (long routes), and Remove, last and apart, with Undo in a note. Start here and Finish here stay in the point's menu on the map.

**Dragging stays as today:** a row by its grip with a mouse (`dragRow()`), a long press on a phone (new: about 450 ms without moving 10 px, so a scroll cancels it), and markers on the map. Each drop is one undo step.

**The look:** the actions are 32 px to look at and 44 px to touch (the target grown around them), grouped, with Remove apart; the name field 40 px. Compact, not small: the targets are the same size as everywhere else.

**Long routes (more than about 12 points):** Find a point by name or number; All or Key points (the start, the finish, stops, changes of sport, named points, legs of their own); a bar on top of the list that keeps the selected point in sight, with ‹ › to step and Show; Move to a number instead of dragging across screens; dragging stays. On desktops: ↑ ↓ select, Alt+↑ ↓ move, Delete removes (with Undo), Enter renames.

## 8. Worst cases, accessibility and phones

- **Text:** names that identify a point or a route wrap to two lines, never "…"; numbers are never cut (the summary's numbers wrap onto their own line first); secondary lines may be cut, their full text a tap away.
- **Enlarged text and 200 % zoom:** the profile folds to its row and the whole sheet scrolls as one; nothing is squeezed; the toolbox docks; menus open on screen.
- **Targets:** 44 px by touch, at any width (the handle's target 36 px, the swipe takes the header); 36 px with a mouse or trackpad (decided 2026-10-22 in place of 40 px); 8 px between targets; destructive actions last, apart and undoable.
- **Colour never alone:** icons, words, borders and dashes carry the groups and states; 4.5:1 for text, 3:1 for icons and borders, in both themes; white on the dark green at 5.3:1 (#239).
- **Screen readers and keyboard:** the toolbox is a `toolbar`; the mode button says "Draw the next leg: Follow paths, route style Balanced", with `aria-haspopup` and `aria-expanded`; modes are `menuitemradio` (phones) or a `radiogroup` with `aria-keyshortcuts` (desktop); Done and Edit announce the change and focus stays on the button that took the pressed one's place; Check's groups are headings and each item's source is text; waypoint rows are buttons with `aria-expanded`, the selected one `aria-current` (§7's list: D's cards and sections replace it).
- **On a phone:** fields in the sheet (the loop's length, a point's name, Find, Move to, a stop's minutes) stay above the keyboard (`visualViewport`, `interactive-widget=resizes-content`), 16 px or more, with their keyboards (`inputmode`, `enterkeyhint`); a long press to reorder starts after about 450 ms without moving 10 px, so a scroll cancels it; menus and the sheet's body contain their scrolling; the sheet keeps the home indicator's inset; `:active` press states, `touch-action: manipulation`, no tap flash, hover only with a mouse (#208).
- **Only real phones or people can settle:** the toolbox's reach for right thumbs; the keyboard over the sheet's fields; a long press against scrolling; whether people tell the mode from the style and read Done as "done editing"; how often a real route has something to read before you go. For people, the review's test script with two more tasks: "You've drawn your route and you're done for now: what do you do?" (watch for Done, ✕ or a reload), and "Your route goes through a place marked private: can you go that way?" (watch whether they read the item and its note).

## 9. Against today

On a 390 × 844 phone from a drawn route at peek; today from the journey script at `87a9b07` (`evidence/journey-main.json`) and the review's table.

| To | Today | This design |
|---|---|---|
| Four points after the first | 8 (the card swallowed taps) | 4 |
| A drawing mode | 1 | 2 on phones (the menu); 1 or a key on desktops |
| The route style | 2, and the sheet goes to half | 2 |
| Undo, redo | 1 | 1 |
| A 20 km loop after the first point | 1 | 2 (the length, Make 3 loops) |
| Share link, GPX, save offline, Import, Clear | 2 (⋯) | 2 (More) |
| Reverse, Back to start | a swipe up, Route's tools | 2 (More); 1 on desktops |
| Show the whole route | 1 (the header) | 1 (the map's column; the toolbar on desktops) |
| Something to read before you go | 2 (raise the sheet, Check) | 1 (the row) |
| A point's stop, its leg | 1 | 2 (select, then the control) |
| Remove a point | 1 | 2, with Undo |
| Point 37 of 52 | scrolling | Find, its marker, or ‹ › |
| Read Check without adding points by mistake | not possible | Done, then Check |
| Close the planner completely | 1 | 2 (Done, ✕) or a swipe |

The map in view at peek on a 390 phone: 82.7 % today, about 91 % when there's nothing to read before you go (the summary is one row), about 85 % with the warning row; on narrower phones, where the toolbox docks into the sheet, about 83 % at 360 × 740.

## 10. Building it

**Before the phase** (checked on `main` at `3dcff19`, 2026-10-18; each its own PR, one session each):
- **#239** dark-mode contrast (2.73:1 on the sport pill): shared tokens the new toolbox and Make 3 loops use too;
- **#240** Settings opens at −113 px with the sheet at half: panels over the sheet stay in the redesign;
- **#245** a mouse click on the sport pill closes the menu its hover opened: the pill becomes the only sport control;
- **#226** the 3D button in the map's column, as planned (with compass and locate, under zoom on desktops), turning 3D through the same `set3d()` as Layers' switch and keeping every 3D control in step; with it, the quick drawer's 3D tile goes (MTB's fifth tile becomes Waymarked MTB, `QUICK_TILES` and `QUICK_TILE` in `js/config.js`). Show the whole route joins the same column in 25a.

**Folded into the phase, closed by its PR with a regression check, not fixed separately** (the code goes, but the cause may not):
- **#241** (undo, redo and Show the whole route look ready at the start): the header's buttons go in 25a, and the toolbox's undo and redo must take their state from the history from the first render; checked at the start, after a reload and after Clear.
- **#242** (long numbers at 360 px, overlaps at 200 %): 25a rebuilds the summary; checked with a 123 km, 7 h 45 min route at 360 px and at 200 %.
- **#251** (a touch tap on the style chip folds the sheet): the chip goes in 25a, but the header's fold-on-tap handler stays, and Done turning into Edit re-renders the header in the same way. 25a makes the handler ignore a target that's no longer inside the header (or decide on `pointerdown`); checked with a touch tap on every header control at half (Done, Edit, the time, the warning row): the sheet stays.

**Not in the way:** #243 (the timeline's cut label) and #244 (Other ways' labels) stay in Fixes 2, independent of the phase.

**The order, agreed on 2026-10-20 with the revised journeys:** 25a (built); then **A with 25b**, since both rebuild the first point's peek and the round trip's form; then **B**, the sport and what it changes (#71, #87, #237); then **25c**, which the warning on the route needs for the route's view; then **C and D with 25d**. Small fixes on surfaces that stay can land between them. A caution for A: build the start's style chips on the style as B keeps it (the route's, per sport), or B rewrites them. The table below is the parts as approved on 2026-10-18; the revised journeys add to them as said here.

**Four parts, each a PR of its own, in order** (each needs the one before), before 22b (#179), which moves the same panel:

| Part | What | Closes |
|---|---|---|
| **25a. The toolbox and the header** | The header's one row; the toolbox (phone float and dock, desktop toolbar with tooltips and keys, the mode's menu with the styles, placed beside or above the panel at any width and either dock); More with its groups and Clear's Undo note; Show the whole route in the map's column and the toolbar; the moves above for the colour, the sport, the style and Round trip | #241, #242, #251; touches #90 |
| **25b. Round trips in the peek** | The first point's peek; the round trip's form and Make 3 loops; the loop cards; picking on the map; the map waits while loops are made | #232, #89 (part), #109 |
| **25c. Done and the route's view** | The three states; map taps in the view; ✕ and its note; reopening as left, after a reload too | #238 |
| **25d. Check and the waypoints** | The three groups, sources and what was looked at; the peek's row and the badge; the rows, selection and expansion apart, the expanded row with today's point and leg controls, dragging (mouse and long press), Key points, Find, the bar, Move to, the list's keys. *Since 2026-10-20: the waypoints as D, and the peek's row and markers as C. Since 2026-10-21: with #345's map cards, in nine parts ([25d's plan](25d-check-and-points.md)); Find and Move to wait in #350* | #233; #84 (lighting Heads-up on the route fits here) |

**Every part's tests and regression checks:**
- **New checks in `tools/smoke.py`** for what the part adds (below), each failing before and passing after; the groups it touches pass: `drawer`, `editing`, `loops`, `quick`, and the others it touches; then the whole suite.
- **The regression list in each PR,** run as a person would (taps, drags, undo, reload) at 390 × 844 and 1440 × 900, in MTB, gravel, hike and paddle, with a route drawn and the timeline open: drawing (add, drag a point, drag the line, a leg's mode and style), undo and redo, the profile and its colouring, Climbs, On the route's breakdowns and their colours on the map, On the map's marks, Go's time, departure and the weather along the route, Heads-up and Avoid, round trips (km and time, water loops), Other ways, stops and nights, changeovers, LIPAS, GPX/KML import and GPX export, share links (old ones too), offline save and preview, 3D and hover.
- **Screenshots before and after** (`tools/shoot.py`) on `pr-screenshots`; CHANGELOG, USING, README and DEVELOPING as each part changes them.
- **Part a:** the side panel resized narrow and wide, and the panel at the bottom: the toolbar beside or above it, clear of the map's buttons, the top bar and the timeline, folding instead of overlapping; a touch tap on each header control at half leaves the sheet at half (#251); undo and redo disabled at the start, after a reload and after Clear (#241); long numbers at 360 px and 200 % (#242); the toolbox's buttons and their names, the mode's menu changes only the next leg, a style routes the route again and a leg with its own style keeps it, the toolbar's keys and tooltips, More's items each do what they say, Clear then Undo, Show the whole route frames the route from the column and the toolbar; no header control under 44 px on phones.
- **Part b:** four points take four taps; a length opens the form without routing calls; Make 3 loops makes three; a map tap meanwhile adds nothing; Use loop A, then Undo.
- **Part c:** after Done a map tap adds no point and opens the map's popup; Edit brings the toolbox back with undo intact; ✕ keeps the route on the map; Plan and a reload reopen it as it was.
- **Part d:** every Heads-up item of today appears once, in its group, with its source; a failing source shows Not checked and "?"; an expanded row's stop, leg sport, mode and style change what they did before; an unselected row has no Remove; a tap expands, a tap on the header collapses and keeps the selection, a tap on another row moves both; adding a point selects it collapsed; a marker's tap selects its row; dragging a row (mouse, and a long press with touch) or a marker moves the point without selecting or expanding anything, and a scroll never starts a drag; Find, Key points, ‹ ›, Move to and Remove with Undo on a 52-point route. *Since 2026-10-20 the waypoint checks follow D's design and the row's follow C's: where they differ, D and C replace these.*

**By module**, the changes listed in the table above: `js/planner.js` (most of it), the warnings' `tier` and `src` where each is made (`js/analysis.js`, `js/safety.js` and the planner's own warning functions), `js/main.js` (the keys, Plan, the map's column, reopening), `js/ui.js` (icons), `css/app.css`, `index.html` (the toolbox's container, the column's button). `js/sheet.js` is unchanged: the planner measures its peek with the warning row and a docked toolbox, and the toolbox's buttons stay taps.

**Risks to watch while building:** drawing now depends on the state (a map tap, a marker's drag and the line's press check editing); the sheet's sizes with the warning row and a docked toolbox, and `frame()`'s padding; the map's column on short phones; every Heads-up item still listed after the grouping; no stored format changes (the selected point and the state aren't in share links or saved routes; reopening as left is a new setting with a default).

## 11. Acceptance criteria

- **Layouts:** 390 × 844, 360 × 740, 375 × 667, 1440 × 900 and 1024 × 768; light and dark; Finnish-length words; 200 % zoom. No planner control on a phone under 44 × 44 px; none overlapping another or off the screen; no number cut; no name cut with "…"; the toolbox clear of the map's buttons or docked; the map's column clear of the top bar.
- **The weather's hour strip** (step 3) is at least 44 px tall, on phones and desktops, at every size and at 200 %. The weather's folded line is at least 44 px tall too. While the weather is away, the Weather button's name for a screen reader includes the hour it shows and whether it's following the route. Since 2026-10-27.
- **The workflows** in part a–d's checks, and the review's test script with people.
- **Nothing lost:** every control and section of today's planner is where the change/move/keep table puts it, doing what it did; the regression list passes in every part.

## Revised journeys (2026-10-20, proposals)

A review of the whole interface on 2026-10-20 (Codex's Hand-over on #233) asked that someone new to Polku can do the everyday tasks without a tour or anyone's help. Its findings were checked against `main` at `256ce13` the same day; their status and a proposed order of work are on #233. Three journeys follow, each a section of the mock-up (A, B, C). They are proposals: nothing is built until the user chooses. Everything else in this plan stands.

### A. Start or find a route

**Today:** on a phone the peek says only "Tap the map to add a start point". The other three ways to begin (`renderStart()`: Round trip, Ride a marked route, Import a GPX or KML) are in the sheet, under the fold. "Ride a marked route" focuses the search box. It's offered for Hike, Paddle and Swim too, and Swim has no route kinds in LIPAS. A LIPAS route's card says "Ride this route" for every sport.

**Iteration 2 (2026-10-20, the user's changes after trying the first one):**
- **Four ways, equal,** on phones and desktops: Draw it, Round trip, Marked routes and A file, each with one line on what it does. Phones: two by two in the peek. Desktops: a row each, with one line on what it does. Draw it and Round trip show the route style before the first leg or the loops (the existing How you go section); Marked routes and a file don't. A tap or click on the map from the ways to begin starts drawing at once. Swim has no marked routes in LIPAS, so it shows three ways.
- **The sport at the start** (approved 2026-10-20): the ways to begin carry the sport in their header, "Start a route" and "MTB ▾", on phones and desktops. It opens the same sport menu as the top bar's pill: one control with two ways in, and a change in either shows in both. It comes first because the sport decides the style chips, the round trip's lengths and whether Marked routes is there. With no route yet it's one tap, no question (B, option A). It goes away with the ways to begin; after that the sport is on the pill and in each leg. With no room above the header (enlarged text) its menu opens as a sheet of its own, as More does.
- **The sport stays in sight in every start step** (approved 2026-10-20): in Draw it, Round trip and Marked routes the top row has "‹ Ways to begin" on the left and the same sport chip on the right, in place of the step's small label (the title says which way you're in); the same menu, so the chip, the header and the pill always match. Phones keep the Draw it card as low as before; the row wraps rather than cutting a long name ("Maastopyöräily" at 360 px). A change inside a step, before the first point, is one tap: in Draw it the line and the style chips become the sport's, and Paddle and Swim switch the drawing mode too; in Round trip the lengths become the sport's presets and step (5 km for bikes, 1 km on foot or water) and the style row follows; Marked routes reloads for the sport, and for Swim says there are no marked routes for swimming, with Ways to begin, never an empty list.
- **Back** is at the top left of the sheet or the panel in every way ("‹ Ways to begin") and brings the ways back as they were; on phones the system's back gesture does the same. Before a loop or a marked route is taken, Back keeps nothing; once taken there's a route, so there's Undo, not Back.
- **Map taps inside a way belong to it:** in Marked routes a tap picks a route; in Round trip it picks a loop or sets the start. Only from the ways to begin and in Draw it does a tap add a point.
- **Draw it:** the headline ("Tap the map where you start", "Click…" on desktops) and a line that follows the toolbar's mode: "Polku follows the paths between your points", "Polku joins your points with straight lines" or "Polku finds a way over the water between your points". Desktops then show the route style's chips with Fine-tune below, which opens How you go's full section in place. Phones keep the card low, with one row, "Route style · Flowy trails ›"; a tap raises the sheet to the chips and Fine-tune, and Back lowers it to the card. With Straight line the style says "Straight lines don't use a route style". **No Done before the first point,** on phones and desktops: Back is the way out. **The ways card says Close** (the user's choice, 2026-10-20): nothing is done yet; after the first point it's Done.
- **Round trip:** the same "Route style · … ›" row above Make 3 loops.
- **One style section, more places:** it's `renderStyle()`'s section shown in Draw it, Round trip, the mode's menu and How you go, not a copy, so a change anywhere shows everywhere. Before a route exists a style change routes nothing, so there's no note or Undo. Choosing it first costs no routing calls; changing it afterwards routes every leg again, and for a round trip after Make 3 loops it spends the calls twice. After the first point, How you go stays where it is.
- **The mode's menu** in Draw it keeps everything (the modes, the route style, Fine-tune); Back from Fine-tune returns to the Draw it card with the sheet lowered. Before any leg is drawn it leaves out "To change a drawn leg, tap it on the map".
- **Your routes (#157)** stays a later frame in the mock-up, never a placeholder tile: when #157 lands, the tile appears only once there are saved routes, with their count.
- **Checks** at 390 × 844, 360 × 740, 1440 × 900 and 1024 × 768, in Finnish and at 200 %: a tap or click from the ways to begin adds the first point; the line changes with the mode, and Straight line explains the style; a style picked in Draw it or Round trip shows in the mode's menu and How you go, and the first leg or the loops use it; Back from Fine-tune returns to the Draw it card with the sheet lowered; Swim shows three ways; Back from each way returns to the ways unchanged; the sport in the header and on the pill always match, and a change from the header updates the style chips, the round trip's lengths and the ways (Swim drops Marked routes); in each step the chip matches the pill, a change updates what the step lists, Swim inside Marked routes shows its note, and "Maastopyöräily" fits at 360 px by wrapping the row. Run in the mock-up on 2026-10-20; to run again in the app.

**From the first version, kept:**
- **Marked routes** lists LIPAS's routes for the sport in the map's view, as cards side by side like the loops' (#89): a tap on a card or its line picks it, and its line glows. **Follow this route** makes it the route on its own line, as `rideLipas()` does today. Find by name searches all of Finland, as the search does now.
- **When it can't list them, it says why:** the layer is off in Layers (the list still works, and Show them turns the layer on); LIPAS isn't answering (Retry, never "none here"); none in view (zoom out, or find by name).
- **No position leaves the device** for the list. It asks LIPAS for the map's view, as the layer already does, through `request()`. A round trip's Where I am says that it sends your position to the router, rounded to five decimals (#281).
- **Words for every sport:** "Follow this route", not "Ride" (#306).

Not solved here: finding places by kind (#121), clickable waymarked routes (#122), loops inside a LIPAS network (#150) and snapping a LIPAS line to the paths (#151).

### B. The sport, and what it changes

**Today** (on `256ce13`, an MTB route of straight legs, then Paddle on the pill):
- the legs keep MTB, each made explicit, and a note offers "Route it as Paddle" for nine seconds; after that nothing on screen says which sport the route is in;
- the route's style becomes Paddle's saved style, so a shared route's own MTB style is lost (#71);
- the toolbox says Over water, but the next leg is drawn as MTB on paths (`addPoint()` continues the last leg's sport);
- a leg's sport picker calls Paddle "the route's" (`legSportPicker()` uses the map's sport);
- the checks along the route use the map's sport (`hazards(…, { activity: this.app.activity() })`, #71);
- Settings' note says the planner routes and times the route for the sport, which it doesn't; its speeds can belong to another sport (#87).

**Three sports, kept apart:** the **map's** (the pill and Settings: what the map shows, and the defaults for a new route); each **leg's** (what routes, times and checks it); and the **next leg's** (the planner's own, which today it borrows from the last leg or the map). With a route drawn, the toolbox's second line says the next leg's sport whenever the route has legs in another one. The sport menu names every sport, says in one line what the map shows for it, and marks the route's sport "your route".

**What a change does to a drawn route. Decided (the user's choice, 2026-10-20): A.** B and C stay here as the options weighed.

| | **A. Ask when it matters** (decided) | **B. The map and the next legs only** | **C. The whole route follows** |
|---|---|---|---|
| No route, or the route's own sport | One tap | One tap | One tap |
| A route and another sport | The menu asks: **The whole route** or **Only the legs you draw next**, each saying what it does; **Keep MTB** and a tap outside change nothing | No question. The route's sport changes in Route › The route's sport | The route's legs are routed again at once; a note with Undo |
| Legs with a sport set on purpose (a paddle crossing in a ride) | Kept, either way | Kept | Kept |
| Legs that follow the route | Whole route: the new sport. Next legs: they keep the old one, made explicit as today | Keep the old one | The new sport |
| A leg's own style | Styles are per sport, so the whole route drops them for the legs that change and says so; the route's style is the route's, per sport (#71) | Unchanged | As A's whole route |
| Fixed lines (GPX, LIPAS) | Keep their line; their sport follows the route's unless set apart | Unchanged | As A |
| Land and water | Whole route isn't offered, and says why; only the next legs | — | The route stays; the note says the next legs are in the new sport |
| Time | The changed legs with the new sport's speeds (#87) | Unchanged | As A |
| Checks along the route | By each leg's sport, in every option (#71) | | |
| Routing calls | One per Follow paths leg that changes, paced through `request()`; the choice says how many, and on a long route that it takes minutes | None | As A, but without asking: one tap starts 50 paced calls on a 51-leg route |
| Undo | Whole route: one step brings back the legs, styles and lines, and the map's and the next leg's sport. Next legs: nothing to undo; the route's sport again goes back | Nothing to undo | One step, as A |
| Saved routes and share links | No change of format: legs carry their sports (`s=`), the map its own (`a=`), the route its style (`p=`); old links open as today | Same | Same |

**Why A** (the reasons it was recommended): the person decides, at the moment it matters and in words, what happens to work they've done, and a second tap is asked only when there's a route in another sport. B is the cheapest to build and never surprises, but whoever wants the whole route in another sport has to find a second control. C is the easiest to explain, but it routes the whole route again without asking, spends routing calls on one tap, and can't do land and water.

**In every option:** the route's style and the checks belong to the route's legs (#71); the toolbox shows the next leg's real mode and sport; "the route's" in a leg's picker means the route's sport; Settings' speeds follow the sport picked above them and re-time the route when it uses that sport (#87); Settings shows the sports' names on phones (#237). "Route it as" leaves the note for the menu. Building it gives the planner a next-leg sport of its own, which #71 already suggested; nothing stored changes.

**Multisport, easy to find. Decided (an addition to B, approved 2026-10-20);** the mock-up's section B, [Multisport, easy to find](mockups/phase-24-planner.html#sb-multi), shows it. The layout came from a rough sketch; the words, sports, speeds, icons and chips are the app's.
- **Next leg** at the top of the drawing menu (phones: the mode button's menu; desktops: a sport button at the toolbar's start, which opens it). It shows the next leg's sport with every sport in `ACTIVITIES`, under the same names and icons as the sport menu, built from the sport menu's own component. Picking one is the sport menu's **Only the legs you draw next**: what's drawn stays, the map follows, and Paddle and Swim switch to Over water.
- Under it, a speed line: the sport's speed from `speedsFor()`, and for Paddle its craft from `CRAFT` ("Sea kayak · 6.5 km/h"). It opens Your speed's editor (`renderSpeedEditor()`) in place, and a change re-times the route.
- Everything the menu has today stays, with today's words: Draw the next leg with its three modes and their lines, the note about drawn legs, Route style · the whole route with the sport's own chips, and Fine-tune in How you go.
- The drawing button's second line says the next leg's sport from the first point ("Hike · Balanced"), not only when the route mixes sports; this replaces "whenever the route has legs in another one" above. The sport stays whole and the style shortens when there's no room ("Maastopyöräily" at 360 px and 200 %).
- The Draw it card adds "You can change sport along the way." after its line. Go › Time adds "Based on your speeds · Change", which opens the same editor.
- A point placed on the water while the next leg is a land sport offers "On the water? **Paddle from here (sea kayak)** · **Keep Hike**". Not on a bridge or a ferry, and not for a tap on the shoreline. If this would slow B down, it's built right after B as its own PR.
- **Checks:** a hike leg, then a bike sport from the drawing menu and a leg drawn in it, gives a route of two sports with a changeover; the drawing button always matches the next leg; the speed line opens the editor, and a change re-times the route; the water note shows on a lake but not on a bridge. At 390 × 844, 360 × 740 and 1440 × 900, in Finnish and at 200 %.

### C. A warning: notice it, find it on the route, come back

**Today:** with the sheet at its peek nothing says there's anything to read before you go: Check's count is on its tab, under the fold. A row in Check frames the map and shades the profile, but nothing marks the place on the route (#84), and an obstacle isn't drawn when Trail details is off (#85).

**Decided (the user's choice, 2026-10-20): the row shows the item on the route,** as below. This replaces "the peek's row opens Check" in §6; Check's groups and sources stay as decided. A point, a stretch and a warning now work the same way: a tap opens a card in the peek, the map shows what it's about, and Back returns to where you were.
- **The peek's row** shows while there's something to read before you go or something wasn't checked, in words: "1 to read before you go · Road works: Teiskontie", with a dashed "? 2" when sources didn't answer.
- **Markers on the route** for each located item, in its group's shape and icon: a filled triangle, a dashed "?", and an eye for "worth a look", which shows only while Check or an item is in view. Close ones merge into one with a count, and a tap shows the most serious. A stretch that wasn't checked is dashed on the route. With the planner put away, the triangles stay with the route, and a tap opens a card with Avoid and Open in the planner.
- **One item in view:** a tap on the row, a marker or an item in Check lights its stretch (#84), rings its marker, shows an obstacle's icon whatever Layers says (#85), and on a phone puts the item in the peek: what, where, how sure, Avoid or Retry, and ‹ › along the route. **Back** returns to where it was opened from (the peek, or Check at half), and so do a tap on the map and Escape. On desktops the item is selected in Check and on the map together.
- **No invented places:** a source missing for the whole route says so in words, with Retry, and has no marker. A message about missing data stays in Not checked, not only in a note that a later one can replace (#265).
- **At 200 % zoom** the item's card keeps what finds it (what, where, ‹ ›, Back, Check); the rest is in Check.
- **Built as:** markers as a map layer (a pan that starts on one still moves the map; a tap near it picks it, as the loops' lines are picked), the stretch through 22a's lit leg (`routeLit`), shared with #83's lit leg in its menu.

### D. Points and legs (iteration 2)

**Why:** in §7's selected row, editing one point took much of the screen, some of its settings were hard to read, and the list didn't show the stretch to the next point, the weather when you get there, or the warnings on the way. **V1 was chosen as the direction (the user's choice, 2026-10-20)**, over V2 (the controls in the list) and V3 (the list only reads; changes on the map), and refined the same day. The mock-up's section D shows it for five kinds of route (a day ride, a multisport trip, three days with nights, 52 points, a marked route followed); the "Points" switch still shows V2 and V3. The refined frames were approved on 2026-10-20; the test with someone new below is still to do.

- **The list is sections:** a new one starts where the sport changes, at a stop and at a night. Each says what Check says about that part: its distance, time and climb, a short forecast for its end ("9° · 4 m/s", the rest a tap away) and its warnings, which open the item on the route (C). Stops, nights and changes of sport stay in view; points that only shape the line fold away, so a leg of 30 m never gets a forecast of its own. The list keeps its scroll position and unfolded groups when a card closes. **Reorder** at the top of the list shows every point with its grip, Earlier and Later; dragging stays as in §7.
- **A stretch** is the legs from one point you see to the next: with shaping points folded it spans them ("via 3 shaping points"), so what you change is never ambiguous. Each has a row in the list, and a tap on the route's line on the map opens the same card. The card names both ends ("Lielahti → Siilinkari"), says "Changes apply to this stretch: its 3 legs", and the lit line runs exactly between them. Its settings say what they apply to: "Paddle · this stretch only · the route is MTB", the style "Paddle's style, for this stretch". It offers only what fits its sport: Follow paths or Straight line on land, Over water or Straight line on water, and nothing to draw on a fixed line (GPX, LIPAS). Other ways for a single leg; On the profile; Avoid a spot here.
- **A point's card**, the same from the list and from the map: its name and arrival first ("there at 08:35 · 12.4 km · Via 7"); its stop, change of sport or night with their minutes or the morning's hour; the everyday actions by name (Add a stop, Stay overnight, Change sport here); the stretch after it with both ends named; Rename, Earlier, Later, and Remove last.
- **One thing at a time:** while a point's or a stretch's card is open, the toolbox (how the next leg is drawn) steps aside, so the card's settings and the next leg's never compete. Back is at the top left of every card, as in the ways to begin: a stretch opened from a point returns to it; otherwise the list or the map as it was.
- **Why the list stays:** it's the only way to manage points without the map (a keyboard, a screen reader) and to see their order and names at once.
- **The test:** someone new, without help, adds a stop, changes one stretch's sport and gets back to the route (with §8's script). The design review supports V1; only that test can show it's understood.

### Everyday tasks explain themselves; the tour is apart

The optional introduction (#114, phase 19's #189) teaches deeper features later and can be skipped. None of the above waits for it or leans on it. Each control says what it changes where it is: the start's four ways each with its words, the sport's question, the toolbox's next leg, Check's sources, the row and its Back. Tooltips (#304) help a mouse and a keyboard, never a finger, so nothing essential is said only in one. The test for both stays the review's: someone new, without help (§8).

### Checked with the design skills (2026-10-20)

- **break-ui** (360 × 740, 200 %, Finnish, a 123 km route of 52 points, 17 warnings): fixed in the mock-up a marked route's name cut with "…" (now wrapped), card text past the card's edge at 200 %, a Finnish button label past the card, and the item's card filling the screen at 200 %.
- **emil-design-eng:** the sport menu replayed its entrance on its second step (now in place); a ✕ on a warning read as "dismiss the warning" (now Back, in words); the route's own sport wasn't marked in the menu (now "your route").
- **apple-design:** the sport question had no visible way out for someone who doesn't know a tap outside cancels (now Keep MTB).
- **mobile-native:** a sideways swipe on the cards could chain into the browser's back gesture (now contained). For building: the sheet's vertical swipe and the cards' horizontal scroll (#89's too), and markers as a map layer rather than buttons over the map.
- **Not checked:** real phones, and people (§8).

## Room for the map (step 3, chosen 2026-10-27)

Step 3 of #233's order: #338 and #303 as one way to make room for the map, with #377's timeline, within #453's and #344's 200 % limits. Two questions were open; the rest of #233 is decided. **The mock-up:** [mockups/issue-338-room-for-the-map.html](mockups/issue-338-room-for-the-map.html) (`?q=fold`, `?q=weather` or `?q=foot`, the alternative in the picker at the top; Today is the live app on `main` at 414690d). `?q=foot` opens on the chosen design, [the weather as a card](#the-weather-as-a-card-chosen-2026-10-27); its **Version** switch shows the weather line's version from before.

**Today** (390 × 844, a route drawn, the timeline on): the peek leaves the map the top half. A point's card and the timeline leave about 150 px of map and push the map's buttons off the top (#344 at 100 %). At half and full the timeline covers Route, Check and Go (#377). At 200 % the timeline sits under the top bar, the map's buttons are gone (#344), and the full sheet ends at its numbers (#453). On desktops the timeline covers a card on the map.

### Question 1: one way to fold, for the planner and the cards?

What a swipe below the peek does (#338's own question) decides the rest:
- **Fold to a line:** a size below the peek, about 74 px, showing the warnings' count and the route's numbers. The whole line is a button that brings back the size it left, and the toolbox gives way to Undo and Redo. A card has the same three sizes: folded to its title and ✕, as now, and its own full height. ⌄ at the sheet's top right folds whatever the sheet holds, while the handle and the header keep today's tap (the peek, or the size it was at). The handle's arrows step through the sizes, and ✕ is the only close. Desktops: Minimise as today, and a card on the map folds to its title row.
- **Swipe away:** no new size. A swipe below the peek is §5's Put away: the route stays, the note offers Open, and Plan brings the planner back as it was. A swipe down on a card closes it. Cards keep one size, so #434 isn't done. Desktops as today.
- **Fold, then away:** the line first. A single swipe stops there; a second swipe, or ✕ at the folded sheet's top right, puts the planner away. Cards fold, and a folded card swiped down closes.
- **What changes:** in the first and third, a swipe up on a card opens the card full. Today it closes the card and raises the list.
- **At 200 % (#453, #344):** the planner rests at its line where its peek would cover more than half the screen. At full the whole sheet scrolls as one, and the list's rows take the card's narrow rule (the value under the name) while the tabs wrap. Both overflow 179 px today, so they are #453's to build. The map's column keeps Locate and Layers. It lets go of the compass first, then 3D, then Weather (<kbd>T</kbd>, and in Layers), then Show the whole route (in ⋯). With Swipe away, the peek leaves room for Layers alone, and with Finnish words and 17 warnings for none.
- **The motion:** swipes use `js/sheet.js`'s spring as it is (damping 0.85, response 0.3 s, projection 0.998, rubber band 0.55). It starts at the finger's speed and can be grabbed mid-way. Taps use the app's 0.22 s change of height. The line and the numbers cross-fade as the sheet passes between them, so nothing jumps at rest. Coming back from Put away, the sheet slides up the way it went, using the quick drawer's opening (260 ms, `--ease-drawer`); today it appears in place, so this part is proposed. Under reduced motion the sheet follows the finger and takes its size at once with a 150 ms fade, as the app does now.

### Question 2: where does the weather timeline go?

Drawn on Fold to a line. Each alternative keeps Weather here, <kbd>T</kbd>, and a loading or failed forecast that shows no numbers.
- **Window, kept clear:** today's window, while the sheet is at its line or peek and the map's buttons fit. Otherwise it becomes its line above the sheet (the temperature and the hour), docked into the sheet at full. A tap on the line brings the sheet to its peek and the window back. Desktops: a card on the map opens clear of it.
- **A weather line:** the timeline is one line: play, the reading at the hour chosen and where it's from, the hour, and ⌃ for the three days. Dragging along its strip changes the hour. It rides on the sheet's edge, sits on a card, and docks into the sheet at full or where it would reach the top bar. The layer chips move to Layers' weather tiles. Desktops: the same line at the map's foot.
- **Weather card (#431):** a card of 25d's kind, one at a time, that folds as every card does. A point's card puts it away, and while it's away the map's weather layers stay with no hour on screen.
- **#508's reading** of the route at your time goes in the window's or the line's reading, or in a row of the card.

### Checked with the design skills (2026-10-27)

- **apple-design:** one sheet for the planner and its cards, as Maps does, with sizes it can be thrown between. The spring is interruptible and carries the finger's speed (the app's own). A fold follows its own path back. The rubber band past the last size is the app's. Folding needs a way without a drag (WCAG 2.5.7): the handle's tap and arrows, and the line's button. The handle's touch area is 44 px over the sheet's edge, though it still looks 18 px.
- **animate:** the sheet is moved by hand, so a spring and no fixed curve. A fold is a frequent action, so it gets no flourish: the app's spring is nearly critically damped (0.85), and nothing else on the screen moves with it. The line's cross-fade is opacity only (150 ms, ease-out). A desktop card's fold opens in `--t-open` and closes in `--t-press`, as the app's tokens say. Reduced motion keeps the fade and drops the travel.
- **break-ui** (360 × 740 and 200 %, Finnish, 17 warnings, 123.4 km, 7 h 45 min, ↑2 345 ↓2 310 m, a 66-character place name, −12 °, 14 m/s, sleet). Fixed in the mock-up: the folded numbers broke letter by letter and ran off the line at 200 %, so they now wrap between groups and the chevron goes first. A folded card with the long name was nine lines tall, so its title now stops at two lines, with the full name a tap away and in the button's label. The weather line made a column of single words at 200 %, so its details now take a row of their own. The window's line and a folded weather card took four lines, so they now show the temperature and the hour. The put-away note broke words at 200 % in the mock-up's copy (the app's note was right). What held: every loading and failed state (a sentence, Retry, no numbers); the desktop's line and card in Finnish; the docked toolbox at 360 px. A card's own title breaks between syllables at 200 %, which is the card as it is today, not this step's to change.
- **impeccable critique** (two separate reviews, 2026-10-27). Nielsen's heuristics out of 40: Today 23, Fold to a line 31, Swipe away 27, Fold, then away 30. Weather out of 36 (Help n/a): Today 19, Window, kept clear 25, A weather line 27, Weather card 24. Fixed in the mock-up after it:
  - The folded line is read by its own words (the count with "to read before you go", the numbers), and it leaves the tab order while hidden.
  - One fold control, ⌄ at the sheet's top right, serves the planner and every card. The handle and the header both do today's tap.
  - The folded planner keeps the drawing mode beside Undo and Redo, since a tap on the map still adds a point.
  - The weather line has its own ✕, and its hour is a slider: the arrows step an hour, Page Up and Page Down a day.
  - Window, kept clear folds to its line wherever the map's buttons wouldn't fit above it (360 px).
  - A point's card opened over the weather card has Back to it, and ✕ there closes the weather and its layers together.
  - A folded name wraps whole, never cut with "…" (§8).
  - The detector found nothing of the design's own beyond the scale bar under the top bar at 200 %, fixed with the column's rule.

### Recommendation

- **Question 1: Fold to a line.** It is the only one that gives the planner (#338) and the cards (#434) one gesture and one control, and that makes 200 % usable: the planner rests at its line there. A look at the map and back costs a swipe or a tap and loses nothing, and closing stays a deliberate ✕, so a sloppy swipe with gloves never puts the route away. **It costs:**
  - §5's "a swipe below the peek puts the route away" (approved 2026-10-18; ✕ still does it), which needs your OK.
  - A swipe up on a card opens the card, not the list.
  - ⌄'s row adds 22 px to the peek.
  - **If you want §5's swipe kept:** Fold, then away.
- **Question 2: A weather line.** The hour the map's weather shows is always on screen. It never covers the planner's tabs (#377), and it is the smallest with a card and at 200 % (#344). It has one look everywhere, and its reading is where #508's route position at your time goes. It works with any answer to question 1. **It costs:**
  - The layer chips move behind ⌃, one more tap than today, which phase 24's rule needs your OK for. The alternative is a row of chips on the line, about 32 px taller.
  - The three days are a tap away.
  - The hour is set on a strip that must be a finger's height in the build.
  - **If you want the least change:** Window, kept clear.

### Chosen (2026-10-27)

- **Question 1: Fold, then away.** One rule for the planner and the cards: one swipe down folds, a second closes, and ✕ closes too. **⌄ has a row of its own** (decided 2026-10-27; the measurements are below).
- **Question 2: A weather line,** with the layer chips behind ⌃, and its hour strip at least 44 px tall (§11). **Changed on 2026-10-27:** the line is the weather card's folded state, not a layer of its own, and there is no pill: [the weather as a card](#the-weather-as-a-card-chosen-2026-10-27). The line's earlier version, with the foot's order and the pill, stays behind the mock-up's **Version** switch.
- **The map's foot on desktops:** not One stack. It holds #468's toolbar at the planner's edge, the scale and the credits; in the bottom dock the toolbar keeps the panel's top edge, as now. The weather has its own place on the same edge, by the map's column (below).

### ⌄'s place on phones: its own row, or the header row (decided: its own row)

The header row is the planner's numbers row, with ⌄ just before **Done**, and a card's title row, with ⌄ just before ✕. That is where the desktop already has Minimise and a card's fold. Folded, the sheet is the same in both versions: ✕ at the top right puts the planner away. In the header try, ✕ at the line's end broke the worst case's numbers mid-number at 200 %.

The peek's height, in px (measured in the mock-up, a route with one warning):

| | ⌄'s own row | ⌄ in the header row |
|---|---|---|
| 390 × 844, English | 201 | 214: the numbers wrap to a second line |
| 390 × 844, Finnish | 236 | 256 |
| 390 × 844, the worst case in English | 236 | 214 |
| 360 × 740, English | 292 | 270 |
| 360 × 740, Finnish | 301 | 321 |
| 200 %, English | 306 | 346, the whole height |
| 200 %, Finnish | 346 | 346 |
| Folded | 100 (108 at 200 %, 128 with the worst case) | the same |
| A card's title at 200 % | 71 px wide | 25 px wide: a syllable a line |

The header row saves the 22 px only where the numbers take two lines anyway: the worst case, and 360 px in English. Elsewhere ⌄ takes the numbers' room, and the peek grows by 13–20 px. At 200 % it also leaves a card's title too narrow to read.

**Recommendation: keep ⌄'s own row** (question 1's version). It costs 22 px at the peek everywhere, and nothing else wraps. The header row fits only by making the numbers or a card's title wrap.

### The map's foot on desktops (not chosen: the weather got a place of its own)

#468 (approved) puts the toolbar at the bottom of the planner's map-facing edge in both docks. With the weather line, the scale and the credits, four things share the map's foot. Three arrangements, drawn at 1440 × 900 and 1024 × 768 in both docks, with the planner, at half, with a card, with the credits open and with the planner closed:
- **One stack:** the toolbar on the panel's edge, the weather line on the toolbar, then the scale and the credits on top, all at the panel's corner. In the bottom dock, the stack sits on the panel's top edge and rises with it. With the planner closed, the line comes down to the foot.
- **Scale in the corner:** the scale and the credits keep the map's bottom left; the toolbar starts to their right; the weather line is centred above it.
- **Planner left, map right:** the toolbar on the panel's edge; the weather line at the right, by the Weather button, sharing the toolbar's row where there's room; the scale and the credits above the toolbar.

What the mock-up shows:
- **One stack** overlaps nothing in either dock, at either size, in any of those scenes. The toolbar keeps all the room the map's buttons leave it, and the opened credits open over the map. With the bottom panel at half at 1024 × 768, 106 px of map is left above the stack at the left.
- **Scale in the corner** costs the toolbar 126 px. Beside the panel at 1440 × 900 it folds two steps further; at 1024 × 768 it doesn't fit even fully folded and runs into the map's buttons. The opened credits cover the toolbar in both docks.
- **Planner left, map right:** the opened credits run into the line at 1440 × 900 beside the panel and in the bottom dock. At 1024 × 768 beside the panel the line is as wide as the foot, so it becomes One stack.

**Recommendation: One stack.** It is the only one that holds everywhere, it is one rule for both docks and every width, and its order is the phone's: the toolbar against the planner, the weather line on it. **It costs:** the corner by the panel is the busiest part of the map, and the line is farther from the Weather button than in Planner left, map right.

**For #468, whichever is chosen:** at the bottom, the map's buttons are level with the toolbar, so beside the panel at 1024 × 768 it has 524 px. Today's toolbar there, under the top bar, is 600 px; fully folded it is about 525 px, which just fits in English. Longer words (the mock-up's Finnish) don't fit: one more fold step, or a second row, is #468's to decide. The bottom panel raised to the top bar stays #468's own open point too.

### The weather as a card (chosen 2026-10-27)

Asked for and chosen on 2026-10-27, and drawn in the mock-up's third tab (`?q=foot`, The weather card). **One rule:** everything folds down to one line on its own edge: the planner, the cards and the weather. A thing that was moved folds where it is, keeping its bottom edge, and a double-click brings any of them home. Sides are named after the planner and the map's column, never left and right, so 22b's right dock mirrors them (the mock-up's **Dock: Right**).

**Phones.**
- The weather is a card in the sheet, as a point's card is: one thing at a time, with Fold, then away's three states.
  - **Open** (the Weather button): the reading, the layers and the 48 hours, in the sheet's place. The planner and its tools wait behind it.
  - **Folded** (a swipe down or ⌄): its reading is a line in the sheet's place. A tap or a swipe up opens it.
  - **Away** (a second swipe): the planner comes back exactly as it was. ✕ turns the weather off.
  - The planner and the weather are never on screen together, and nothing stacks above the toolbar.
- A point's card opened over the weather takes the sheet, and its ✕ brings the weather back as it was.
- **There is no pill.** The Weather button is the column's bottom item, below Layers, and shows the weather is on.
  - Only when the map isn't showing now (an hour you chose, or following the route) does the hour sit beside it, with "Following the route" when it is.
  - Where the hour would be over the toolbox, the column rises above the toolbox's row.
  - While the weather is on, Weather is the last of the map's buttons to go.
- At 200 % the weather card can take the whole height, so its 48 hours are in reach.

**Desktops.**
- **The planner folds down.** Beside the map it becomes its numbers' line at the bottom of its side, with the toolbar beside it. In the bottom dock it becomes the panel's line, with the toolbar on its top edge. ✕ puts it away, as now.
- **The weather is a strip again:** the reading, the layers and the 48 hours.
  - Its home is on the foot by the map's column, on the toolbar's edge: the screen's foot beside the side panel, or the bottom panel's top edge in the bottom dock.
  - Folded, it is a line in the same place, as small as the pill was: the layer's icon, the temperature and the hour, with ⌃ and ✕. While it follows the route, the route's mark takes the icon's place. The line keeps one width (210 px), since its hour has room for a day's name.
  - It keeps its drag and resize, and a double-click on its title row brings it home.
- **It shares the edge with the toolbar, and the toolbar never gives anything up for it** (chosen 2026-10-27). The toolbar folds only as `placeTools()` does for the map's column.
  - The strip opens where it fits beside the toolbar.
  - Otherwise it starts as its line, next to the toolbar on the same edge.
  - Where not even the line fits beside the full toolbar, the weather is away: the Weather button shows it is on, with its hour, as on phones.
  - Opened by hand where there's no room, it opens above what sits at the planner's side.
- Show the whole route fits the route clear of the weather. Weather sits below Layers.
- A point's card on the map with no room above the foot starts folded to its title.

**Following the route** (phones and desktops).
- The profile keeps distance on its axis, since stops and nights make the time jump.
- Pointing at the profile on a desktop, or dragging along it on a phone, moves a marker on the route. A line above the profile says the distance, the time you get there and Colour by's reading. Desktops keep today's tip with the rest.
- With Colour by on wind, temperature or rain and the weather on, the map's weather goes to the hour you get there. The strip, the line or the Weather button says "Following the route".
- On a desktop it lets go when the pointer leaves the profile. On a phone the point stays until you tap the map or change Colour by.
- Dragging the weather's 48 hours sets the hour, and with it the departure, as today, and stops following. Following never changes the departure.
- Past 48 hours the map's weather stays at its last hour and says "The map's weather reaches 2 days". The profile's colours go on. A longer forecast for the map is an issue of its own.
- **What it costs:** no new request within 48 hours.
  - The map's grid holds 49 hours of forecast, so following only picks another hour from it: `applyHour()` in `js/wxmap.js`, the same work as dragging the strip.
  - The profile already has each point's arrival time (`tAtWind`).
  - Today the map's hour is also the route's departure (`onHour` → `planner.setLeave` in `js/main.js`), so following must not send it on.
  - Past 48 hours the grid would need the 10-day cells (`forecastCells(list, { long: true })`): one more request of the same size per view.

**What the mock-up shows** (measured 2026-10-27, in every scene, both window sizes, all three docks, English, Finnish and the worst case):
- **Beside the panel at 1440 × 900** the edge has 940 px. The toolbar is 1099 px with all its route actions, 859 with them in ⋯, and 525 fully folded (in Finnish 1121, 881 and 566). It puts four of its route actions in ⋯ for the map's column, which leaves no room for the line, so the weather is on the Weather button.
- **In the bottom dock at 1440 × 900** the full toolbar leaves 233 px (211 in Finnish), so the line sits next to it. With the worst case's wider temperature it doesn't fit, and the weather is on the Weather button. At 1024 × 768 the toolbar folds for the map's column, and the weather is on the Weather button.
- **Beside the panel at 1024 × 768** the toolbar needs every fold step, so the weather is on the Weather button there too. In Finnish the toolbar doesn't fit at all, which is #468's open point.
- The strip itself opens beside the toolbar only on wider screens, or with the planner closed. Opened by hand, it opens above the scale.
- Nothing else overlaps.

**For 22b and 22c** (#179, #186), which make the other parts movable: the same rules, noted in [22's plan](22-drawer.md).

## Built

### 25a, the toolbox and the header (2026-10-20)

- **The header** is one row: the route's numbers, which wrap onto lines of their own before they touch (#242), and on phones Done at their right. The colour, sport, Round trip and style chips and the tools row are gone, and so is `fitHeader()`. The colour is on the profile only, the sport on the top bar's pill only, and Round trip is in More, Route's tools and the start.
- **The toolbox** (`#pl-tools`, `buildTools()`, `renderTools()`, `placeTools()`): on phones the mode button (its style under its name), undo, redo and More, floating at the bottom left or docked into the sheet as its first row; on desktops the labelled toolbar on the panel's edge, side or bottom, with tooltips (`tooltip()` in `js/ui.js`) and the keys P, S and W. Undo and redo show once there's a route or a history, disabled until they can act (#241). It's a `toolbar` with one Tab stop.
- **The mode's menu** on phones: Draw the next leg (three `menuitemradio`s, each with its line), the note, and Route style · the whole route as chips with Fine-tune. On desktops the style button's menu holds the styles only, since the modes are on the toolbar. A style picked there is the whole route's, routes it again, and says so with Undo; a leg with its own style keeps it.
- **Decided while building (2026-10-20):** the route's actions (Show the whole route on desktops, Reverse, Back to start, Share link, Export GPX, Save offline, Clear route) are on the toolbar or toolbox as far as there's room, by priority, and **More lists only what isn't there**, so nothing shows twice. This replaces "they're there anyway" in §1 and More's fixed list in §4. On desktops, the style's caption and the names of the modes not in use fold before Show the whole route. More keeps its head, its groups and Clear apart.
- **Decided while building (2026-10-20), #225:** while planning, the timeline stays over the map, and Weather and T open it there; the planner keeps its tab. On phones it sits 16 px above the sheet, and the toolbox and the map's buttons ride above it (`--wx-h`); where the map's buttons wouldn't fit above it (a half or full sheet, or a short phone at the profile size) it sits on the sheet under its header, so the numbers and Done stay in reach (`body.wx-over`). Camera moves keep clear of the toolbox and the timeline (`overSheet()`), and frame the route once more when its numbers wrap just after it was framed. Go keeps its Depart picker and the weather along the route. This replaces "the docked timeline" in the keep table.
- **Decided while building (2026-10-20):** the button for the panel's place moves from the end of the tabs' row into the header, next to Minimise, where it's easier to find. Moving or stretching the panel and the other floating tools on desktops is 22b's (#179).
- **Show the whole route** in the map's column under Locate (`#btn-fit`) whenever a route is on the map; on desktops the toolbar has it while planning. On short phones with the sheet raised, `fitColumn()` in `js/main.js` leaves out the compass while north is up, then 3D.
- **A bottom panel raised up to the top bar** (desktops) takes the toolbar as its first row, as phones do with a raised sheet.
- **Around it:** Settings and Layers sit above the toolbox. `--tools-h` and `--tools-bottom` keep the scale and credits, notes, the 3D pad, a track's card and the zoom note clear of the toolbox and the toolbar. The header's fold-on-tap ignores a target that's no longer in it (#251).
- **Not in 25a:** Done still closes the planner, and E does nothing yet (25c). #242's profile at 200 % (Colour by and On map, the distance labels, many points on the baseline) and a long hike's days are left in #242.
- **Checks:** `python3 tools/smoke.py toolbox` (phones by touch, desktops by mouse and keys; #241, #242 and #251), with `drawer`, `header`, `loops`, `fit` and the five layouts updated.

### 25b with A, the start (2026-10-20)

- **The ways to begin** are in the header (`renderStart()`, `startView()`): **Start a route** with the sport chip, the four ways (Swim three), and on phones **Close** (decided 2026-10-20: nothing is done yet; Done after the first point). A tap or click on the map from them adds the first point. Each step has **‹ Ways to begin** and the sport chip; a step is a step of history, so a phone's back gesture does what Back does, and the map stays where it is.
- **The sport chip** opens the pill's sports at the chip, picked with the same `setActivity()`, so the chip and the pill always match; the pill's own menu stays where it is. B's line per sport comes with B.
- **Draw it:** its line follows the mode; the route style as one row on phones (a step of history that raises the sheet; Back lowers it) and as chips on desktops; **Fine-tune** moves How you go's own elements into place. With no leg a style makes no Undo step and routes nothing. The mode's menu has no note about drawn legs before there's one.
- **Round trip** in the peek, from the first point (three lengths and Other…; a length opens the form with no calls), from the ways (a tap or **Where I am**, to five decimals, #281), or from More with a route. Loop cards side by side on phones, a list beside the side panel; a tap on a card or its line picks it (#89), Use loop A with Undo.
- **Decided while building (2026-10-20):** while the loops are made the form folds to what's being made and how far it's got (`loopMaking()`): the choices can't change then, and on a 360 × 740 phone the full form left 93 px of map for the loops' area. This replaces the mock-up's rt-making frame (the full form with the progress in its button).
- **Marked routes** from the layer's own tiles (`routesIn()` in `js/lipas.js`, through `request()`), up to 20 nearest the map's middle, listed again after a move; what following gives (a loop, one way, a network) comes on the picked card after one request, as the map's card asks. Its states: off in Layers (Show them), LIPAS not answering (Retry, and when a pause ends it lists again), none in view, too far out, Swim. **Follow this route** everywhere (#306).
- **Decided with the user while building (2026-10-20): the toolbox grows with the route.** No toolbox before the first point (none of it can do anything yet), except undo and redo while there's something to undo; the first point brings how the next leg is drawn (the modes and Route style on desktops), undo, redo and More, which holds Clear route (with Round trip and Import); the first leg brings the route's actions, as far as there's room in 25a's order, the rest in More. Back to start isn't offered on a loop. New buttons fade in where they are (none with reduced motion), and the toolbox grows to the right: its left edge and the map's buttons don't move. Undo back to no points leaves undo and redo. **While a round trip is open (form or loops), only undo and redo** (the user's choice, 2026-10-20, #311): no mode, More or Done until a loop is taken or the form closes. This replaces the mock-up's first drawing, which hid the toolbox there. **For 25c:** in the route's view, as §1 says, phones keep only More, desktops Show the whole route, More and Edit.
- **Not in 25b:** picking a marked route on the map is still hard outside Marked routes (no pointer, no highlight before a card opens, nothing while planning): #308. Escape doesn't go back a step. The map column's Plan button still reads Done while the planner is open on desktops.
- **Checks:** `python3 tools/smoke.py start` (390 × 844 by touch, 1440 × 900 by mouse, 360 × 740 with a long sport name, and the round trip's form whole at 360 × 740 and 1024 × 768), with `drawer`, `fit`, `lipas`, `contrast` and the layout's round trip updated.

### B, the sport and what it changes, with multisport (2026-10-20)

- **Three sports, kept apart:** the map's (the pill), each leg's, and the next leg's (`nextSport()`, the planner's own). Changing the map's sport keeps the drawn legs' sports and the route's style for each of its sports (`this.styles`, #71): a shared route's style stays, after a reload and in its share link too, and Undo after the change keeps the legs' sports. Busy roads and road conditions follow each stretch's sport, and the route's place rather than the map's middle.
- **The pill asks (option A):** each sport with its line and "your route"; with a route in another sport, **Use Hike for…**: **The whole route** (how many legs and routing calls, styles that go, legs in other sports and fixed lines that stay, one Undo step that also brings back the map's and the next leg's sport; not offered from land to water, with why), **Only the legs you draw next**, **Keep**. The question stays open when the mouse leaves it.
- **The next leg's sport and speed** in the drawing menu and, on desktops, a sport button; the sports open in place, from the sport menu's own items; the speed line opens Your speed's editor in place, and a change re-times the route. The drawing button names the sport from the first point ("Hike · Balanced"): the sport stays whole, the style shortens. Draw it says the sport can change along the way; Go › Time says which speeds the time is based on, with **Change**.
- **Decided with the user while building (2026-10-20):**
  - **Settings holds settings** (#321): no sport of its own (it's the pill's), and so no #237. **Your speeds** lists every sport in one line each, opening the editor in place; a change re-times the route when it has legs in that sport (#87).
  - **The order is the button's:** on desktops the sport button sits just before the route style, not at the toolbar's start; the phone's menu reads the same way, in three parts with a line between them: how the next leg is drawn (and its note), the sport and speed, the route style.
  - **The water note asks how you get there:** **Paddle**, **Swim**, in winter over the ice (**Walk**, **Ride** or **Run on the ice**), or **Stay on land**. The answer turns the leg to the tapped point into that sport over the water, or a straight line onto the ice, and keeps the point where it was tapped, with no Undo step of its own. A leg on the ice is in Check ("Polku can't see whether it holds") and in share links (`ic=`). Not on a bridge or a ferry line, nor for a tap by the shore.
  - **The words** are plain and say what happens; the rewrite of all of Polku's text is #184's.
  - **The sport at the start, where new people see it (2026-10-21):** the ways to begin have the same top row as each step, "Start a route" where a step has ‹ Ways to begin, and **✕** on the right, which closes the planner as the other panels' ✕ does (on desktops, the panel's place beside it, since the header waits while the start shows). Under the ways' top row the sport has a row of its own in the drawing menu's style: its icon, its name, its line (Paddle's craft first) and ▾, opening the pill's menu. In each step the sport is a chip beside the route style it decides (a row of its own there made the round trip's form too tall). No speed line at the start: Draw it's Fine-tune has the speeds. The round trip's form is shorter: Make 3 loops says what it costs, and Where I am's line what it sends. This replaces "Start a route · MTB ▾", the ways' **Close** and the row that wrapped in A.
  - **The start, one thing at a time (2026-10-21, its own PR after B's):** the round trip's form shows only its start (a tap on the map, or Where I am with what it sends) until it has one: about 180 px on a 390 × 844 phone instead of 550, so the map is free for the tap. With a start comes the rest, in the order it's chosen: **How long** with **Distance** and **Time** as two chips, the sport's four lengths and **Other…**, which opens the field with − and + (open too for a length of your own, and from the first point's Other…), then the direction on a row of its own, the sport and style, and Make 3 loops with its cost; the map moves so the start stays in sight above it (`startInView()`). Where I am goes once the start is your position. The ways lose "or tap the map to start drawing" (Draw it's card says it), and Draw it says what to do in one line. The sport's row, with the tiles' border, is right under the top row in the ways and every step (Draw it, the round trip, Marked routes), so it never moves; the route style is the desktop toolbar's button. In the round trip, **How long** has a Distance / Time switch, phones show three lengths and Other… in one row (desktops four), and the route style and the direction are two buttons side by side on a phone, a row each in a desktop's side panel; a wide panel at the bottom has the form in two columns. On a 390 × 844 phone the form is about 250 px before a start and 500 px after a tapped one (Where I am and its note are about 80 of it). After the first point **✕** replaces Done too (the route's numbers keep Done), 44 px on a phone. Swiping the sheet down to see the map under it is #338.
  - **The craft in the sport menus (2026-10-21):** with Paddle, the pill's menu and the start's have **Craft** (sea kayak, canoe, SUP) under the sports, since water routes and round trips depend on it; picking Paddle keeps the menu open at it. Equipment for other sports (bike types) is an idea: #337.
- **At 1440 × 900** the sport button takes the room of **Save offline** and **Clear route**, which are in More; on narrower desktops the sport's name folds to its icon before the modes lose theirs.
- **Not in B:** a tap on the start point to close the route (#334).
- **Checks:** `python3 tools/smoke.py nextleg` (390 × 844 by touch, 360 × 740 with long names, 200 %, 1440 × 900 by mouse) and `sports`, with `sportmenu`, `start` and `toolbox` updated.

### 25c, Done and the route's view (2026-10-21)

- **Three states** (`setActive()`, `setEditing()`, `inView()`): editing, the route's view and put away, as §5's table. **Done** (the route's numbers on phones, the toolbar on desktops, E) is the route's view; with only a first point there's nothing to view, and Done closes the planner as ✕ does. **Edit** goes back where Done was, with undo as it was.
- **The route's view:** a row above the numbers with the route's name (`routeTitle()`), its sports, ✓ Kept on this device and ✕. On phones the toolbox keeps only More; on desktops the toolbar keeps Show the whole route, More and Edit. Route's list shows the points without their controls, with "You're not editing" and Edit; the departure and the stops still work, as How you go, Check and Go do.
- **Map taps in the view** are the map's own: its cards (`initInspector()`), and a tap on the route that part's menu, as with the planner put away. A way on offer and a place to avoid still answer a tap. The markers stay put, the line has no handles and can't be dragged, no other ways come on their own, and the spot menu's Add to my route goes back to editing.
- **Back to editing on their own:** Route from here and Add to route (the map's cards and the spot menu), a round trip (More, Route's tools), an imported file, a marked route followed, and a leg menu's Add a point here. A share link and a saved offline area open the view.
- **✕ and its note:** "Planner closed · your route stays" with **Open**; on phones the notes with the planner closed stay left of the map's buttons, their buttons 44 px. **Plan** (and R) opens the planner as it was left: the view or editing, at the size and tab it had.
- **Reopening after a reload (#238):** `plannerOpen` (`{ open, view }`) is remembered, and the planner opens again if it was open, as it was left. A first visit and a share link are as before (closed; open).
- **Decided while building (2026-10-21):** the column's Plan button stays where it is while the planner is open on desktops, pressed, rather than reading Done (Done ends editing now); on phones it waits under the sheet as before. On a short phone (200 %, a long name) the name scrolls in its place, whole, so the sheet stops below the top bar, as the start's views do; its sports and Kept on this device stay in sight.
- **Not in 25c:** a swipe below the peek, which §5 says puts the route away: #338 decides how folding and closing fit together (fold first, then close, or one of them), so a swipe still stops at the peek. While editing a route, the route's numbers keep **Done** and there's no ✕ there, as the mock-up draws it.
- **Checks:** `python3 tools/smoke.py routeview` (390 × 844 by touch in MTB and paddle, 1440 × 900 by mouse and keys, 360 × 740 and 200 % with a long name), with `toolbox`'s Done updated.

### Step 2, the toolbar at the map's foot (2026-10-27)

- **Beside the side panel** the toolbar hangs off the panel's right edge, 12 px above the window's foot, whatever the panel's height (#468). The bottom dock keeps it on the panel's top edge, and a bottom panel raised to the top bar keeps it as its first row. `--tools-h` lifts the scale, the credits, the notes, the 3D pad and a track's card above it in both docks; `--tools-bottom` is gone. Fits (`viewPadding()`) leave room for it at the foot.
- **Room:** the map's buttons are level with it at the foot, so beside the panel at 1440 × 900 four route actions go to More (the toolbar is 928 px of 952). At 1024 × 768 it folds every step, and a new last fold (`fold4`) shortens the style's name with an ellipsis, for the longest styles (Roads to the trail, Near the shore). Between 900 and about 1020 px it takes a second row (`tb-rows`) rather than run under the map's buttons.
- **Around it:** the timeline beside the side panel rides 40 px above the toolbar, clear of the credits on it. The toolbar's tooltips go above their button where there's no room below.
- **Moving the panel** (`setDock()`) frames the route again, in both directions (#387).
- **Decided while building (2026-10-27):** at 1024 × 768 beside the panel the mode in use keeps only its icon, raised and outlined; the second row is for narrow windows only: the app is in English, so longer words don't need one of their own; the weather beside the toolbar is step 3's.
- **Checks:** `python3 tools/smoke.py toolbox` (1440 × 900 beside the panel, wide, minimised and in the bottom dock; 1024 × 768 in MTB and paddle; 960 × 700; the scale, the credits, the timeline, the menus and a tooltip at the foot; the route framed after each move).

### Step 3, part 1: Fold, then away (2026-10-28)

- **Phones:** ⌄ in a row of its own at the sheet's top right (`.sheet-top`), for the planner with a route and every card in the peek. One swipe down, ⌄, or the handle's ↓ folds to a line (`folded`, below the peek): the route's numbers with the count to read before you go, or the card's mark and name, one button that opens it to the size it left. From the line a second swipe (past 40 %), or ✕ in ⌄'s place, puts the planner away with its note, or closes the card and the planner is as it was under it. A single swipe always stops at the line, and the line is never remembered. The line and what it folds cross-fade while the sheet moves (the swipe's new `moved`).
- **Folded on a phone** the toolbox is the drawing mode's icon, Undo and Redo; a card folded keeps Undo and Redo. A tap on a point with the planner folded opens its card folded.
- **A card in the peek** has three sizes, its line, its own and full (a swipe up), and the whole sheet: the planner's profile, tabs and list wait behind it.
- **Desktops:** ⌄ in the header row (in Minimise's place) folds the side panel down to its line at the foot of its side, its width kept, with the toolbar beside it, and a bottom panel to its line with the toolbar on its top edge. The line has ✕ at its end. A card on the map or beside the panel folds to its title row with its own ⌄, keeping its bottom edge, and opens again where it opens; one with no room between the top bar and the map's foot opens folded.
- **200 % (#453, #344):** the planner rests at its line where its peek would cover more than half the screen (opening and drawing; a peek you ask for stays). A peek that would reach under the top bar stops below it and scrolls as one, and at full the whole sheet scrolls as one where its header, profile and tabs take more than half of it; the list's rows take the cards' narrow rule and the tabs wrap. The map's column lets go of the compass, 3D, the key facts' line, Weather, Show the whole route (then in ⋯), Locate, and where not even Layers fits, all of it: nothing goes under the top bar, over a raised start step at 100 % too. The Avoided place menu at 200 % now has room above the planner's line.
- **#540's buttons trailing the sheet:** `--sheet-h` is the size the sheet is going to (`settledHeight()`), and nothing above it has a transition on `bottom`, so the map's buttons move once.
- **Decided while building (2026-10-28):** the handle's Enter and Space are a tap, as in the mock-up. In the route's view ⌄ sits above the view's ✕, as above a card's. A card in the peek is at most `52dvh − 22px`, so ⌄'s row leaves the map the room it had. Folded at 200 %, the toolbox's buttons stay 44 px and the map's buttons rise above its row where it doesn't clear them (`--col-lift`): the mock-up's are 30 px there. A card at full keeps Undo and Redo in a row above it, as the full sheet's toolbox docks. The key facts' line counts its top margin in the room it gives back (`fitColumn()`): 2 px short, it came and went every frame on a short phone, where ⌄'s row now puts the peek at that edge.
- **Not in part 1:** the start's views keep their peek (no line yet: asked); the weather (part 2).
- **Checks:** `python3 tools/smoke.py fold` (390 × 844 by touch, 360 × 740's raised start step, 200 %, 1440 × 900 by mouse), with `quick`'s short flick, `pointcard`'s 200 % card and `warnfix`'s Avoided place menu at 200 % updated.
