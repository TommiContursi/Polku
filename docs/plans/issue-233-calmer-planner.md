# #233: a calmer route planner

The design. What's still to do, and its status, is on GitHub: [#233](https://github.com/TommiContursi/Polku/issues/233). The order of phases is in [ROADMAP](../ROADMAP.md).

- **Status (2026-10-17): decided, ready to build in four parts.** From phase 24's review ([the report](../reviews/2026-10-17-design/README.md), #177): the user chose variant B, a second iteration worked out seven questions, and the user settled the last choices and asked for a few targeted changes. Nothing is built yet.
- **The mock-up:** [mockups/phase-24-planner.html](mockups/phase-24-planner.html), clickable on phone and desktop frames, with switches for the worst case, Finnish and Swedish, and the theme. `?frame=<id>` shows one frame at full size; `&w=360&h=740`, `&z=2` (200 % zoom), `&lang=fi`, `&worst=1`. Pictures of the second iteration: `pr-screenshots`, `claude/phase-24-design/iter2/`.

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
| | The sport (`sportSel`): the top bar's pill only, which already re-routes | `renderQuickSport()` → `js/main.js`'s sport pill |
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

**The rows:** every row is one button that selects it (its marker, its name in up to two lines, "Via 23 · 5.7 km · 07:58", small icons for a stop, a change of sport or a leg of its own). No Remove. A tap on a marker selects its row; a selected row lights its leg on the map and the profile (22a's lit leg).

**The selected row** holds today's controls, organised by what they belong to:
- **The point:** its name (rename in place); on the start, the departure; a stop (Break with its minutes, Night with the morning's hour, or none: `stopChip()`, `stopEditor()`); where the gear goes along (`gearToggle()`); at a change of sport, the minutes to change; on the finish, Back to start.
- **The leg after it** ("Next leg · MTB · Follow paths · the route's (Balanced)", or "Flowy trails · its own"): its sport, how it's drawn and its style, each the route's unless set here, Fine-tune, and Other ways. This is today's leg editor (`legSettingsRow()`, `legSportPicker()`, `legStylePicker()`), moved, with its behaviour unchanged: a leg with its own style or sport keeps it when the route's style or sport changes, and "the route's" follows the route. "All leg settings" in Route's tools still opens every leg's at once.
- **Its place:** Earlier, Later, Move to… (long routes), and Remove, last and apart, with Undo in a note. Start here and Finish here stay in the point's menu on the map.

**The look:** the actions are 32 px to look at and 44 px to touch (the target grown around them), grouped, with Remove apart; the name field 40 px. Compact, not small: the targets are the same size as everywhere else.

**Long routes (more than about 12 points):** Find a point by name or number; All or Key points (the start, the finish, stops, changes of sport, named points, legs of their own); a bar on top of the list that keeps the selected point in sight, with ‹ › to step and Show; Move to a number instead of dragging across screens; dragging stays (a long press on phones, the grip on hover on desktops). On desktops: ↑ ↓ select, Alt+↑ ↓ move, Delete removes (with Undo), Enter renames.

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

**Four parts, each a PR of its own, in order** (each needs the one before). First, from Fixes 2: #240, #251, #239, #242 and #241 (they touch the same header), and #226 (the map's column, which Show the whole route joins). Before 22b (#179), which moves the same panel.

| Part | What | Closes |
|---|---|---|
| **a. The toolbox and the header** | The header's one row; the toolbox (phone float and dock, desktop toolbar with tooltips and keys, the mode's menu with the styles); More with its groups and Clear's Undo note; Show the whole route in the map's column and the toolbar; the moves above for the colour, the sport, the style and Round trip | #90 (part) |
| **b. Round trips in the peek** | The first point's peek; the round trip's form and Make 3 loops; the loop cards; picking on the map; the map waits while loops are made | #232, #89 (part), #109 |
| **c. Done and the route's view** | The three states; map taps in the view; ✕ and its note; reopening as left, after a reload too | #238 |
| **d. Check and the waypoints** | The three groups, sources and what was looked at; the peek's row and the badge; the rows, the selected row with today's point and leg controls, Key points, Find, the bar, Move to, the list's keys | #233; #84 (lighting Heads-up on the route fits here) |

**Every part's tests and regression checks:**
- **New checks in `tools/smoke.py`** for what the part adds (below), each failing before and passing after; the groups it touches pass: `drawer`, `editing`, `loops`, `quick`, and the others it touches; then the whole suite.
- **The regression list in each PR,** run as a person would (taps, drags, undo, reload) at 390 × 844 and 1440 × 900, in MTB, gravel, hike and paddle, with a route drawn and the timeline open: drawing (add, drag a point, drag the line, a leg's mode and style), undo and redo, the profile and its colouring, Climbs, On the route's breakdowns and their colours on the map, On the map's marks, Go's time, departure and the weather along the route, Heads-up and Avoid, round trips (km and time, water loops), Other ways, stops and nights, changeovers, LIPAS, GPX/KML import and GPX export, share links (old ones too), offline save and preview, 3D and hover.
- **Screenshots before and after** (`tools/shoot.py`) on `pr-screenshots`; CHANGELOG, USING, README and DEVELOPING as each part changes them.
- **Part a:** the toolbox's buttons and their names, the mode's menu changes only the next leg, a style routes the route again and a leg with its own style keeps it, the toolbar's keys and tooltips, More's items each do what they say, Clear then Undo, Show the whole route frames the route from the column and the toolbar; no header control under 44 px on phones.
- **Part b:** four points take four taps; a length opens the form without routing calls; Make 3 loops makes three; a map tap meanwhile adds nothing; Use loop A, then Undo.
- **Part c:** after Done a map tap adds no point and opens the map's popup; Edit brings the toolbox back with undo intact; ✕ keeps the route on the map; Plan and a reload reopen it as it was.
- **Part d:** every Heads-up item of today appears once, in its group, with its source; a failing source shows Not checked and "?"; a selected row's stop, leg sport, mode and style change what they did before; an unselected row has no Remove; Find, Key points, ‹ ›, Move to and Remove with Undo on a 52-point route.

**By module**, the changes listed in the table above: `js/planner.js` (most of it), the warnings' `tier` and `src` where each is made (`js/analysis.js`, `js/safety.js` and the planner's own warning functions), `js/main.js` (the keys, Plan, the map's column, reopening), `js/ui.js` (icons), `css/app.css`, `index.html` (the toolbox's container, the column's button). `js/sheet.js` is unchanged: the planner measures its peek with the warning row and a docked toolbox, and the toolbox's buttons stay taps.

**Risks to watch while building:** drawing now depends on the state (a map tap, a marker's drag and the line's press check editing); the sheet's sizes with the warning row and a docked toolbox, and `frame()`'s padding; the map's column on short phones; every Heads-up item still listed after the grouping; no stored format changes (the selected point and the state aren't in share links or saved routes; reopening as left is a new setting with a default).

## 11. Acceptance criteria

- **Layouts:** 390 × 844, 360 × 740, 375 × 667, 1440 × 900 and 1024 × 768; light and dark; Finnish-length words; 200 % zoom. No planner control on a phone under 44 × 44 px; none overlapping another or off the screen; no number cut; no name cut with "…"; the toolbox clear of the map's buttons or docked; the map's column clear of the top bar.
- **The workflows** in part a–d's checks, and the review's test script with people.
- **Nothing lost:** every control and section of today's planner is where the change/move/keep table puts it, doing what it did; the regression list passes in every part.
