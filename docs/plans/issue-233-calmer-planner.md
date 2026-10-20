# Phase 25: a calmer route planner (#233)

The design. What's still to do, and its status, is on GitHub: [Phase 25: a calmer planner](https://github.com/TommiContursi/Polku/milestone/16), phase issue #233. The order of phases is in [ROADMAP](../ROADMAP.md).

- **Status (2026-10-18): approved; phase 25, built in four parts (25a–25d),** after the shared fixes below and before 22b. From phase 24's review ([the report](../reviews/2026-10-17-design/README.md), #177): the user chose variant B, a second iteration worked out seven questions, and the user settled the last choices on 2026-10-17 and approved the design on 2026-10-18. Nothing is built yet.
- **The mock-up:** [mockups/phase-24-planner.html](mockups/phase-24-planner.html), clickable on phone and desktop frames, with switches for the worst case, Finnish and Swedish, and the theme. `?frame=<id>` shows one frame at full size; `&w=360&h=740`, `&z=2` (200 % zoom), `&lang=fi`, `&worst=1`. Pictures of the second iteration: `pr-screenshots`, `claude/phase-24-design/iter2/`.
- **Revised 2026-10-20, not decided:** three journeys through the planner, after a review of the whole interface asked that everyday tasks explain themselves. They're proposals for the user to choose: see [Revised journeys](#revised-journeys-2026-10-20-proposals) below, and sections A to C of the mock-up (`&sport=ask|next|all` switches the sport's behaviour).

## Decided

1. **The toolbox holds how the next leg is drawn,** undo, redo and More. The route style is a setting of the whole route: the mode button's second line, and its own group in the mode's menu.
   - **Phones:** one drop-down for the three modes; More (⋯) last in the toolbox. Done stays at the right of the route's summary.
   - **Desktops:** a labelled toolbar hanging off the panel's edge, with its tooltips and keys. No sentence on the right: the route's actions instead (Reverse, Back to start, Show the whole route), then More and Done.
2. **Show the whole route** is there whenever a route is on the map: in the map's column under Locate on phones, in the toolbar on desktops; F as today.
3. **Round trips in the peek** after the first point: the sport's lengths and Other, any distance or time, a green Make 3 loops. As in the second iteration, unchanged.
4. **More (⋯)** holds the whole route's actions, grouped as in the second iteration: take it along, the whole route, Clear apart with Undo. The route's summary shows the route.
5. **Done ends editing:** the route's view to read, check and take along; Edit goes back, where Done was; ✕ puts the route away.
6. **Check by how serious and how sure:** Read before you go, Worth a look, Not checked, each item with its source; nothing new is checked.
7. **Waypoints:** only the selected one has its controls, small to look at and 44 px to touch; no Remove on the others. **Today's waypoint and leg editor is kept,** organised in the selected row.
8. **Everything Polku does today stays** unless this plan says it changes (below).
9. **Selection and expansion of waypoints are two states** (2026-10-18): a tap expands, a tap on the header collapses and keeps the selection, a new point is selected but collapsed, a marker's tap selects its row; dragging (mouse, long press, markers) touches neither.
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
| | The sport (`sportSel`): the top bar's pill only. With a route drawn, the pill doesn't route it again: its legs keep their sport and a note offers "Route it as…" (corrected 2026-10-20; what it should do is [Revised journeys](#revised-journeys-2026-10-20-proposals), B) | `renderQuickSport()` → `js/main.js`'s sport pill |
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
| | The map's menus: a point's, a leg's (Other ways, Stop here, Avoid this spot, On the profile), a spot's | `openPointMenu()`, `openLegMenu()`, `openSpotMenu()` |
| | Other ways, LIPAS routes, an imported track's card, places to avoid, stops and nights, changeovers, the lit leg, routing and its stand-in, the water router, offline, share links, saved routes | unchanged |

## 1. The toolbox and the toolbar

**Two ideas, two places.** The drawing mode (Follow paths, Straight line, Over water) is a tool for the *next* leg; a drawn leg's own mode changes from its menu on the map or its row, as today. The route style is a setting of the *whole* route: it's what Follow paths (or the water router) prefers for every leg without a style of its own, and changing it routes the route again (`setStyle(style)`; legs with their own style keep it, as today).

**Phones:**
- **The toolbox:** the mode button (its icon, its name, the style under it when the mode uses one), undo, redo and More (⋯), floating at the bottom left above the sheet. About 300 px in English: it floats beside the map's buttons on a 390 px phone and docks into the sheet as its first row on narrower phones, with Finnish words at 390, at 200 % zoom, or with the sheet raised high. Docked, the mode's name stays whole: undo, redo and More go to a line of their own first.
- **The mode's menu:** "Draw the next leg", the three modes with one line on what each does, the note that only legs drawn next change; then "Route style · the whole route" as chips, and Fine-tune in How you go.
- **Done** stays at the right of the route's summary: the bottom right is where the thumb is, the toolbox has no room for it beside More, and Done belongs with the route it finishes. Edit takes its place in the route's view.
- **In the route's view** the toolbox keeps only More: there's nothing to draw.

**Desktops:** the toolbar hangs off the panel's map-facing edge, one surface with it.
- **Left to right:** the three modes with their names (P, S, W) · the route style as a two-line button ("Route style / Balanced") · undo and redo · Reverse, Back to start and Show the whole route (icons with tooltips) · More (⋯) and **Done**.
- **Tooltips** on every control (kept as in the second iteration): its name, its key, one sentence; about 450 ms the first time, then at once for the next one; keyboard focus shows them too.
- **When room runs out** (a narrower window, longer words): Reverse and Back to start fold into More first (they're there anyway), then the style's caption goes. At 1440 × 900 everything shows.
- **Clear route** stays in More, apart, with Undo.
- **In the route's view** the toolbar keeps Show the whole route, More and Edit (Edit last, where Done was).
- **The panel's place and width, as today:** the side panel's width is still dragged from its edge (`bindResize()`), and the panel still moves between the side and the bottom (`setDock()`, the button at the end of the tabs' row, Settings). The toolbar follows both: beside the side panel it hangs off the panel's right edge at the top, its left edge moving with the panel's width; with the panel at the bottom it sits on the panel's top edge at the left, above the panel. In both it stays below the top bar, clear of the map's buttons and of the timeline, and folds (as above) instead of overlapping them; it's placed by one function from the panel's rectangle (`ResizeObserver` on the panel and the window), so 22b's right dock and dragging only feed it another rectangle (a right-docked panel gets it on its left edge).
- **The panel's header** shows the route: the warning row when there's something to read before you go, the numbers, Minimise; the route's name and ✕ in the view.

**Keys (desktop):** P, S, W pick the mode; Ctrl+Z, Ctrl+Shift+Z undo and redo; F shows the whole route; E is Done or Edit; R opens and closes the planner, as today. Nothing animates for a key.

**States:** the mode in use is ticked in the menu and filled in the toolbar, never by colour alone; undo and redo appear with the first change and are disabled, not hidden, when there's nothing to undo or redo; Reverse and Back to start are disabled while the route has fewer than two points (Back to start also on a loop).

**Icons:** Follow paths keeps its path between two dots; Straight line becomes a plain line between dots; Over water becomes waves under a dashed line (today's drop reads as rain). Every mode has its word.

## 2. Show the whole route

An existing feature that has to stay obvious:
- **Phones:** in the map's column, directly under Locate (the two "show me where" buttons together), whenever a route is on the map: while drawing, in the route's view and with the planner put away. Always there rather than only while part of the route is out of view, so it's where people learned it is and the column doesn't move. Its icon is today's (a route in a frame); its name is "Show the whole route".
- **Desktops:** in the toolbar, with F. With the planner put away, in the map's column as on phones.
- **What it does:** `fitRoute()` as today: the whole route framed above the sheet or beside the panel (`frame()`).
- **Room on short phones:** with the sheet raised, the column keeps what fits between the top bar and the sheet, leaving out first the compass while north is up (it's back as soon as the map is turned, which is when it's needed), then 3D (still in Layers). In the mock-up: on a 375 × 667 phone with the sheet at half, the column is Locate, Show the whole route, Weather and Layers; on 360 × 740, 3D stays too. At peek every button shows.

## 3. Round trips

As in the second iteration: after the first point the peek says "Tap the map for your next point" and offers "Round trip from here" with the sport's first three lengths and Other (`LOOP_PRESETS`). A length opens the round trip with that length chosen: Distance or Time, the four lengths, − / + (5 km for bikes, 1 km on foot or water, 15 minutes by time) or typed, the direction, the start, the cost in routing calls, and a green **Make 3 loops**. While the loops are made the map waits (#109). The loops are cards side by side; a tap on a card or its line picks it (#89); Use loop A takes it, with Undo. Round trip stays at the start, in More, in Route's tools and in the map's menus. Closes #232.

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

Each item says where it comes from: **Live** (Fintraffic, with the time), **From the map** (OpenStreetMap: may be out of date or wrong), **An estimate** (the terrain model, the forecast, the waves), **Calculated** (the dark). The end of Check lists what was looked at for this route and says that nothing listed doesn't mean open, safe or allowed. A way marked private says what that usually means in Finland (often a yard or a road closed by a sign; in the forest everyman's right usually lets you pass). The peek's row ("1 to read before you go · Road works: Teiskontie ›") shows only while there's something in the first group, and not while Check is in sight. Within a group the order is along the route; every action of today's rows stays.

## 7. Waypoints and legs

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
- **Targets:** 44 px on phones (the handle's target 36 px, the swipe takes the header); 40 px on desktops; 8 px between targets; destructive actions last, apart and undoable.
- **Colour never alone:** icons, words, borders and dashes carry the groups and states; 4.5:1 for text, 3:1 for icons and borders, in both themes; white on the dark green at 5.3:1 (#239).
- **Screen readers and keyboard:** the toolbox is a `toolbar`; the mode button says "Draw the next leg: Follow paths, route style Balanced", with `aria-haspopup` and `aria-expanded`; modes are `menuitemradio` (phones) or a `radiogroup` with `aria-keyshortcuts` (desktop); Done and Edit announce the change and focus stays on the button that took the pressed one's place; Check's groups are headings and each item's source is text; waypoint rows are buttons with `aria-expanded`, the selected one `aria-current`.
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

**Four parts, each a PR of its own, in order** (each needs the one before), before 22b (#179), which moves the same panel:

| Part | What | Closes |
|---|---|---|
| **25a. The toolbox and the header** | The header's one row; the toolbox (phone float and dock, desktop toolbar with tooltips and keys, the mode's menu with the styles, placed beside or above the panel at any width and either dock); More with its groups and Clear's Undo note; Show the whole route in the map's column and the toolbar; the moves above for the colour, the sport, the style and Round trip | #241, #242, #251; touches #90 |
| **25b. Round trips in the peek** | The first point's peek; the round trip's form and Make 3 loops; the loop cards; picking on the map; the map waits while loops are made | #232, #89 (part), #109 |
| **25c. Done and the route's view** | The three states; map taps in the view; ✕ and its note; reopening as left, after a reload too | #238 |
| **25d. Check and the waypoints** | The three groups, sources and what was looked at; the peek's row and the badge; the rows, selection and expansion apart, the expanded row with today's point and leg controls, dragging (mouse and long press), Key points, Find, the bar, Move to, the list's keys | #233; #84 (lighting Heads-up on the route fits here) |

**Every part's tests and regression checks:**
- **New checks in `tools/smoke.py`** for what the part adds (below), each failing before and passing after; the groups it touches pass: `drawer`, `editing`, `loops`, `quick`, and the others it touches; then the whole suite.
- **The regression list in each PR,** run as a person would (taps, drags, undo, reload) at 390 × 844 and 1440 × 900, in MTB, gravel, hike and paddle, with a route drawn and the timeline open: drawing (add, drag a point, drag the line, a leg's mode and style), undo and redo, the profile and its colouring, Climbs, On the route's breakdowns and their colours on the map, On the map's marks, Go's time, departure and the weather along the route, Heads-up and Avoid, round trips (km and time, water loops), Other ways, stops and nights, changeovers, LIPAS, GPX/KML import and GPX export, share links (old ones too), offline save and preview, 3D and hover.
- **Screenshots before and after** (`tools/shoot.py`) on `pr-screenshots`; CHANGELOG, USING, README and DEVELOPING as each part changes them.
- **Part a:** the side panel resized narrow and wide, and the panel at the bottom: the toolbar beside or above it, clear of the map's buttons, the top bar and the timeline, folding instead of overlapping; a touch tap on each header control at half leaves the sheet at half (#251); undo and redo disabled at the start, after a reload and after Clear (#241); long numbers at 360 px and 200 % (#242); the toolbox's buttons and their names, the mode's menu changes only the next leg, a style routes the route again and a leg with its own style keeps it, the toolbar's keys and tooltips, More's items each do what they say, Clear then Undo, Show the whole route frames the route from the column and the toolbar; no header control under 44 px on phones.
- **Part b:** four points take four taps; a length opens the form without routing calls; Make 3 loops makes three; a map tap meanwhile adds nothing; Use loop A, then Undo.
- **Part c:** after Done a map tap adds no point and opens the map's popup; Edit brings the toolbox back with undo intact; ✕ keeps the route on the map; Plan and a reload reopen it as it was.
- **Part d:** every Heads-up item of today appears once, in its group, with its source; a failing source shows Not checked and "?"; an expanded row's stop, leg sport, mode and style change what they did before; an unselected row has no Remove; a tap expands, a tap on the header collapses and keeps the selection, a tap on another row moves both; adding a point selects it collapsed; a marker's tap selects its row; dragging a row (mouse, and a long press with touch) or a marker moves the point without selecting or expanding anything, and a scroll never starts a drag; Find, Key points, ‹ ›, Move to and Remove with Undo on a 52-point route.

**By module**, the changes listed in the table above: `js/planner.js` (most of it), the warnings' `tier` and `src` where each is made (`js/analysis.js`, `js/safety.js` and the planner's own warning functions), `js/main.js` (the keys, Plan, the map's column, reopening), `js/ui.js` (icons), `css/app.css`, `index.html` (the toolbox's container, the column's button). `js/sheet.js` is unchanged: the planner measures its peek with the warning row and a docked toolbox, and the toolbox's buttons stay taps.

**Risks to watch while building:** drawing now depends on the state (a map tap, a marker's drag and the line's press check editing); the sheet's sizes with the warning row and a docked toolbox, and `frame()`'s padding; the map's column on short phones; every Heads-up item still listed after the grouping; no stored format changes (the selected point and the state aren't in share links or saved routes; reopening as left is a new setting with a default).

## 11. Acceptance criteria

- **Layouts:** 390 × 844, 360 × 740, 375 × 667, 1440 × 900 and 1024 × 768; light and dark; Finnish-length words; 200 % zoom. No planner control on a phone under 44 × 44 px; none overlapping another or off the screen; no number cut; no name cut with "…"; the toolbox clear of the map's buttons or docked; the map's column clear of the top bar.
- **The workflows** in part a–d's checks, and the review's test script with people.
- **Nothing lost:** every control and section of today's planner is where the change/move/keep table puts it, doing what it did; the regression list passes in every part.

## Revised journeys (2026-10-20, proposals)

A review of the whole interface on 2026-10-20 (Codex's Hand-over on #233) asked that someone new to Polku can do the everyday tasks without a tour or anyone's help. Its findings were checked against `main` at `256ce13` the same day; their status and a proposed order of work are on #233. Three journeys follow, each a section of the mock-up (A, B, C). They are proposals: nothing is built until the user chooses. Everything else in this plan stands.

### A. Start or find a route

**Today:** on a phone the peek says only "Tap the map to add a start point". The other three ways to begin (`renderStart()`: Round trip, Ride a marked route, Import a GPX or KML) are in the sheet, under the fold. "Ride a marked route" focuses the search box. It's offered for Hike, Paddle and Swim too, and Swim has no route kinds in LIPAS. A LIPAS route's card says "Ride this route" for every sport.

**Proposed:**
- **The peek** keeps the map as the first way ("Tap the map where you start") and puts the other three under it as chips: Round trip, Marked routes, a GPX or KML file. A sport with no marked routes in LIPAS (Swim) has no chip for them. Desktops: a row each, with one line on what it does.
- **Marked routes** lists LIPAS's routes for the sport in the map's view, as cards side by side like the loops' (#89): a tap on a card or its line picks it, and its line glows. **Follow this route** makes it the route on its own line, as `rideLipas()` does today. Find by name searches all of Finland, as the search does now.
- **When it can't list them, it says why:** the layer is off in Layers (the list still works, and Show them turns the layer on); LIPAS isn't answering (Retry, never "none here"); none in view (zoom out, or find by name).
- **No position leaves the device** for the list. It asks LIPAS for the map's view, as the layer already does, through `request()`. A round trip's Where I am says that it sends your position to the router, rounded to five decimals (#281).
- **Words for every sport:** "Follow this route", not "Ride".

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

**What a change does to a drawn route. The user chooses; the recommendation is A.**

| | **A. Ask when it matters** (recommended) | **B. The map and the next legs only** | **C. The whole route follows** |
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

**Why A:** the person decides, at the moment it matters and in words, what happens to work they've done, and a second tap is asked only when there's a route in another sport. B is the cheapest to build and never surprises, but whoever wants the whole route in another sport has to find a second control. C is the easiest to explain, but it routes the whole route again without asking, spends routing calls on one tap, and can't do land and water.

**In every option:** the route's style and the checks belong to the route's legs (#71); the toolbox shows the next leg's real mode and sport; "the route's" in a leg's picker means the route's sport; Settings' speeds follow the sport picked above them and re-time the route when it uses that sport (#87); Settings shows the sports' names on phones (#237). "Route it as" leaves the note for the menu. Building it gives the planner a next-leg sport of its own, which #71 already suggested; nothing stored changes.

### C. A warning: notice it, find it on the route, come back

**Today:** with the sheet at its peek nothing says there's anything to read before you go: Check's count is on its tab, under the fold. A row in Check frames the map and shades the profile, but nothing marks the place on the route (#84), and an obstacle isn't drawn when Trail details is off (#85).

**Proposed** (this replaces "the peek's row opens Check" in §6; Check's groups and sources stay as decided):
- **The peek's row** shows while there's something to read before you go or something wasn't checked, in words: "1 to read before you go · Road works: Teiskontie", with a dashed "? 2" when sources didn't answer.
- **Markers on the route** for each located item, in its group's shape and icon: a filled triangle, a dashed "?", and an eye for "worth a look", which shows only while Check or an item is in view. Close ones merge into one with a count, and a tap shows the most serious. A stretch that wasn't checked is dashed on the route. With the planner put away, the triangles stay with the route, and a tap opens a card with Avoid and Open in the planner.
- **One item in view:** a tap on the row, a marker or an item in Check lights its stretch (#84), rings its marker, shows an obstacle's icon whatever Layers says (#85), and on a phone puts the item in the peek: what, where, how sure, Avoid or Retry, and ‹ › along the route. **Back** returns to where it was opened from (the peek, or Check at half), and so do a tap on the map and Escape. On desktops the item is selected in Check and on the map together.
- **No invented places:** a source missing for the whole route says so in words, with Retry, and has no marker. A message about missing data stays in Not checked, not only in a note that a later one can replace (#265).
- **At 200 % zoom** the item's card keeps what finds it (what, where, ‹ ›, Back, Check); the rest is in Check.
- **Built as:** markers as a map layer (a pan that starts on one still moves the map; a tap near it picks it, as the loops' lines are picked), the stretch through 22a's lit leg (`routeLit`), shared with #83's lit leg in its menu.

### Everyday tasks explain themselves; the tour is apart

The optional introduction (#114, phase 19's #189) teaches deeper features later and can be skipped. None of the above waits for it or leans on it. Each control says what it changes where it is: the start's four ways each with its words, the sport's question, the toolbox's next leg, Check's sources, the row and its Back. Tooltips (#304) help a mouse and a keyboard, never a finger, so nothing essential is said only in one. The test for both stays the review's: someone new, without help (§8).

### Checked with the design skills (2026-10-20)

- **break-ui** (360 × 740, 200 %, Finnish, a 123 km route of 52 points, 17 warnings): fixed in the mock-up a marked route's name cut with "…" (now wrapped), card text past the card's edge at 200 %, a Finnish button label past the card, and the item's card filling the screen at 200 %.
- **emil-design-eng:** the sport menu replayed its entrance on its second step (now in place); a ✕ on a warning read as "dismiss the warning" (now Back, in words); the route's own sport wasn't marked in the menu (now "your route").
- **apple-design:** the sport question had no visible way out for someone who doesn't know a tap outside cancels (now Keep MTB).
- **mobile-native:** a sideways swipe on the cards could chain into the browser's back gesture (now contained). For building: the sheet's vertical swipe and the cards' horizontal scroll (#89's too), and markers as a map layer rather than buttons over the map.
- **Not checked:** real phones, and people (§8).

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
