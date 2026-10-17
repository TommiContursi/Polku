# #233: a calmer route planner

The design. What's still to do, and its status, is on GitHub: [#233](https://github.com/TommiContursi/Polku/issues/233), proposed as a phase of its own for the user's OK. The order of phases is in [ROADMAP](../ROADMAP.md).

- **Where it comes from:** phase 24's review ([the report](../reviews/2026-10-17-design/README.md), #177) found the planner small and crowded on phones, with things shown twice. The user chose its variant B on 2026-10-17 (the tools float, a one-row peek, only the selected waypoint's buttons), then asked for a second, focused iteration on seven questions. This plan is that iteration's outcome: design, an interactive mock-up and the plan to build it, for the user's review. **Nothing is built.**
- **The mock-up:** [mockups/phase-24-planner.html](mockups/phase-24-planner.html), clickable on phone and desktop frames, with switches for the worst case, Finnish and Swedish, the theme, and the decisions still open. `?frame=<id>` shows one frame at full size; `&w=360&h=740`, `&z=2` (200 % zoom), `&lang=fi`, `&worst=1`.
- **Measured** with `evidence/mockup_probe2.py` (the same rules as `measure.py` on the app), output in `evidence/mockup-iter2.json`. Pictures: `pr-screenshots`, `claude/phase-24-design/iter2/`.

## In short

| Question | Decided in this iteration | Still open (the user's) |
|---|---|---|
| The toolbar | The toolbox holds how the **next leg** is drawn, undo and redo; the route style, a setting of the **whole route**, is the mode's second line and its own group. Phones: one drop-down. Desktops: a labelled toolbar hanging off the panel's edge, with keys. | One drop-down (recommended) or three buttons on phones |
| Round trips | In the peek after the first point: the sport's lengths and Other; a length opens the round trip with a green **Make 3 loops**; any distance or time. No chip on the map. | The lengths in the peek (recommended) or one "Round trip from here" button |
| The route's actions | One menu beside Done, in the same place on every tab: take it along, the whole route, and Clear apart. | Its name: **Trip** (recommended), Share & save, or More |
| What Done means | **Done ends editing**; the route stays open in **the route's view** (read, check, take along, later Start); **Edit** goes back; ✕ puts it away. | — |
| Checking | Check sorts today's Heads-up into **Read before you go**, **Worth a look** and **Not checked**, each item saying where it comes from; a row in the peek when there's something to read before you go. | — |
| Waypoints | Only the selected point has buttons; no Remove on the others; find, Key points, a bar that keeps the selected point in sight, Move to a number. | — |
| Stress | Rules for 360 px, long words, 200 % zoom and enlarged text, dark, keyboard and screen readers, all tried in the mock-up. | — |

## What stays from the first iteration

B as chosen: the tools float above the sheet at the thumb, clear of the map's buttons; the peek is one row (the numbers, the menu, Done); only the selected waypoint shows its buttons; 44 px targets on phones; the colour with the profile it colours; the sport as the top bar's pill; Show the whole route in the map's column while part of the route is out of view; one Done on a desktop (22b); controls disabled until they can act (#241).

**Changed since:** the chip by the start (#232's alternative 2) gives way to the round trip in the peek (alternative 1) with any length; the ⋯ menu's version 2 is kept but not called Route; unselected waypoint rows lose their Remove button; the routing mode no longer carries the style as if they were one control.

## 1. The toolbox: drawing told apart from routing

**The two ideas.** The *drawing mode* (Follow paths, Straight line, Over water) is a tool: it decides how the next leg you draw is made, and doesn't touch the legs already drawn. A drawn leg's own mode changes from its menu on the map, as today (`openLegMenu`). The *route style* (Balanced, Flowy trails…) is a setting: it decides which ways Follow paths prefers, for every routed leg without a style of its own, and changing it routes the route again (`setStyle`). Today they sit side by side as equals in the header (the modes' segmented control, the "Balanced" chip); the first B put the style *on* the mode button, which made them look like one control.

**The design:**
- **The mode button says the mode in words, with the style under it** when the mode uses one ("Follow paths / Balanced"; "Over water / Near the shore" for a paddle route; "Straight line" alone). That's the honest relation: the style is what Follow paths (or the water router) prefers.
- **Its menu** ("Draw the next leg") lists the three modes with one line on what each does, and says that only the legs drawn next change. Under it, after a rule, **"Route style · the whole route"** shows the sport's styles as chips (a different kind of control on purpose) and Fine-tune in How you go.
- **Phones:** the toolbox is the mode button, undo and redo (253 px in English, 268 in Finnish, 234 in Swedish), floating at the bottom left above the sheet. It docks into the sheet as its first row when it wouldn't clear the map's buttons by 8 px (phones under about 340 px, 352 in Finnish; 200 % zoom) or when the sheet is raised too high to leave room above it. Docked, the mode's name stays whole: undo and redo go to a line of their own first.
- **Desktops:** not the phone's pill. A toolbar that **hangs off the panel's edge**, one surface with it (the panel's top corner squares off to meet it), so it reads as part of planning rather than another floating panel: the three modes with their names (a radio group), a rule, "Route style" and its menu button, undo and redo, and a sentence saying what a click does now ("Follow paths: click the map to add a point · right-click for more"). When room runs out the sentence goes first, then the style's label; the modes keep their names. When the panel docks right or at the bottom (22b), the toolbar hangs off the edge that faces the map.
- **Keys (desktop):** P, S and W pick the mode; Ctrl+Z and Ctrl+Shift+Z undo and redo; F shows the whole route; E is Done or Edit; R opens and closes the planner, as today. Tooltips give the key and one sentence; they wait about 450 ms, then the next one opens at once (emil-design-eng); keyboard focus shows them too; nothing animates for a key.
- **States:** the mode in use is ticked in the menu and filled in the desktop's radio group, never shown by colour alone; undo and redo appear with the first change and are disabled, not hidden, when there's nothing to undo or redo; the start shows only the mode.
- **Icons:** Follow paths keeps its path between two dots; Straight line becomes a plain straight line between dots; Over water becomes waves under a dashed line between dots (today's water drop reads as rain). Every icon comes with its word, except undo and redo.

**Trade-offs:**
- **A mode is two taps on a phone, one today.** Asked for on 2026-10-17 to try. What it buys: the toolbox floats beside the map's buttons on every phone from 360 px in all three languages (three buttons with the style on the first don't fit there even at 390 px, and dock into the sheet: `tb-phone-buttons`), every mode has its name, and the menu explains the modes. The style stays two taps, as today (it was two in the first B too). Mode changes are occasional while drawing (a straight line across a field, a stretch over water); undo stays one tap. **Measured:** the widths and the docking. **Preference:** whether two taps for a mode bother a frequent drawer; for people to say.
- **The desktop toolbar covers a strip of map** at the top: 65.7 % of a 1440 × 900 screen shows the map, against 69.8 % with the first B's smaller toolbox and 71.1 % with the tools in the panel (A). It gives the modes their names, the style its label and a line on what a click does.

## 2. Round trips, in the peek

**The design.** After the first point the peek says what comes next and offers a loop from there:
- **"Tap the map for your next point"** (the guidance today's card gives) and Done, then **"Round trip from here"** with the sport's first three lengths and **Other…** (MTB 10, 20, 30 km; hiking 5, 10, 15; paddling 5, 10, 15; road 30, 50, 80: `LOOP_PRESETS`). Nothing covers the map; a tap on the map adds the next point and the round trip row goes.
- **A length doesn't make loops at once.** It opens the round trip with that length chosen: Distance or Time, the four lengths, − / + (5 km for bikes, 1 km on foot or water, 15 minutes by time) or typed (18 px, so no zoom on iOS), the direction (any, the eight points, into the wind first), "From your first point · tap the map to move it", what it costs ("Three routing calls, up to six"), and a full-width green **Make 3 loops** at the thumb. A preset loop is two taps (today's card: one; the first B's chip: two); any other length is three or more, as today.
- **While the loops are made** the button shows "Making loops… 2 of 3" and the map waits (a tap adds nothing: #109).
- **The loops:** cards side by side, the next one peeking in at the edge (scroll-snap), each with its length, time, climb, trails and notes; a tap on a card or on its line picks it and frames it (#89); **Use loop A** takes it, with Undo in a note; More loops, Change and ✕ as today.
- **Elsewhere, as today:** Round trip at the start (from the map centre or your location), in Trip ("Round trip from the start"), in Route's tools, and in the start point's and the spot's menus on the map.
- **Desktop:** the same, in the panel.

**Why choose first, then make:** the peek is where the thumb rests while drawing, so a tap meant for the map can land on a length. Today a length starts three to six routing calls at once. Choosing first makes an accidental tap harmless (✕ or the next tap on the map closes it), and puts the length, the direction and the cost in view before the calls. It also gives the green Make 3 loops that was asked for. **Gives up:** one tap for a preset loop against today's card.

**The alternative** ("One button", `rt-button`): only "Round trip from here ›" in the peek. Calmer and 19 px lower, but a 20 km loop takes three taps, and the lengths aren't in sight to suggest what a round trip is.

**Closes #232** (the first point's card): there's no card.

## 3. One menu for the whole route

**Where:** beside Done in the peek and the panel's header, the same place on every tab, in editing and in the route's view. On phones it's an icon with its word under it, like the map's Weather and Layers (48 px wide), so the peek stays one row; on desktops an icon and its word.

**What's in it, grouped by what it's for:**
1. **Its head:** the route's name (its start and finish, as Route's list says them) and "✓ Kept on this device", because "is it saved?" is the first question.
2. **Take it along:** Share link (copy it, or the phone's share sheet), Export GPX (for a GPS watch or another app), Save offline… (the map and terrain, for no signal).
3. **The whole route:** Round trip from the start, Reverse, Back to start, Import GPX or KML… (show a file's track, then plan on it).
4. **Clear route**, apart: after a wider gap, in red, last. No question first; a note with **Undo** after it (#90 asked for that), and Undo in the toolbox.

Moving the panel isn't here: it stays with the panel (the button at the end of the tabs' row, Settings, and 22b's drag).

**On purpose in two places:** Take it along in Go; Reverse, Back to start and Import in Route's tools; Import and Round trip at the start. The menu is the one place that always has them; the others are where the moment needs them.

**Its name is the user's.** The table in the mock-up's section 3 compares Trip (recommended), Share & save and More. **Trip** is short in every language (Retki, Tur), names the whole thing being planned (the line, its time, its stops, what's taken along), and leaves room for saved trips (#157), On the way (23b) and your track (23c). Against it: a new word beside the Route tab. **Share & save** says what the commonest items do, but not Clear, Reverse or Import, and "save" suggests the route isn't kept; in Finnish ("Jaa ja tallenna") it doesn't fit under an icon. **More** is familiar and honest but says nothing, which is what sent the first ⋯ back for review. **What settles it:** people, in the test script below (task 5).

## 4. Done, the route's view, and coming back

**Finishing isn't one thing.** Ending the drawing, keeping the route, closing the planner and getting ready to go are different moments, and today one Done closes everything; the next tap on the map while reading Check at half adds a point by mistake.

**Three states:**

| State | What's on screen | A tap on the map | How you get here |
|---|---|---|---|
| **Editing** | the toolbox; the peek's numbers, Trip, Done; the tabs | adds a point (as today); markers and the line can be dragged | Plan with no route; Edit; a map menu's "Add to my route" |
| **The route's view** | no toolbox; the route's name and "kept on this device" with ✕; the numbers, Trip, **Edit**; the tabs, Check and Go as in editing | shows what's there (the map's own popups, as with the planner closed); markers stay put | Done; Plan with a route; after a reload, if it was open (#238) |
| **Put away** | the route on the map; Plan in the map's column | the map's popups | ✕ in the view, or a swipe below the peek |

- **Done** goes to the view. A note isn't needed: the toolbox goes and Edit takes Done's place. The first time, a note says that a tap on the map now shows what's there.
- **In the view** explicit buttons still work (Avoid in Check, the departure, Other ways); the list and the map don't change by touch. Route's list shows the points without their buttons, with "You're not editing" and Edit.
- **✕ and a swipe below the peek** put the route away with a note, "Planner closed · your route stays · Open". **Plan** reopens it as it was left (the view or editing), its sheet's size and tab too.
- **Nothing is lost by any of them:** the route is kept on this device as today (`save()` on every change), and undo outlives Done and ✕.
- **Saving:** there's nothing to press, as today, and the view and Trip now say so. Save offline is for no signal, and says so. A list of routes (#157) comes later: the start would offer "Your routes", and Trip "Save to Your routes"; offline areas' routes would be in it.
- **Getting ready to go:** Go, as today (the time, the departure and the weather, stops and days, Take it along). **23b's Start** goes at the top of Go and beside Edit in the view; **23c's track** and looking back later belong to the same view, which is why it's the route's view and not the planner's.
- **Changing their mind:** Edit, one tap where Done was.
- **Coming back to an earlier route:** today the last route comes back after a reload; others come back through an offline area (Layers › Offline maps › Open), a share link or a GPX. That stays; #157 adds the list. Opening a share link replaces the route without Undo today (#128): the view gives that a natural answer ("Back to your route"), noted there.

**Gives up:** closing the planner completely is two taps from editing (Done, ✕) or one swipe, against one today. What it gets: the moment people most often want after drawing (look at it, check it, take it along) without the risk of adding points, and a place for On the way. **Measured:** the taps. **Preference:** whether people read Done as "close"; for people to say.

## 5. Check: how serious, and how sure

Nothing new is checked: today's Heads-up items are sorted and labelled. The tiers follow from what each item means for someone out there:

| Group | What goes in it (today's items) | Shown as |
|---|---|---|
| **Read before you go** | Crosses or follows a shipping lane; rough water for your craft; ice season; frostbite risk or very cold; slippery around 0 °C; in the dark (light needed); road works and traffic incidents (live); marked no access (`access=no`, `foot=no`); cycling not allowed; no access in winter; alpine terrain (SAC T4+); legs not routed yet (straight lines standing in) | a filled warning triangle, a tinted card with a border; a row in the peek; the tab's badge in the warning colour with the count |
| **Worth a look** | Steep climb or descent; technical trail (S3+); steps; unpaved on road tyres; carries; your own straight lines; ferry; a way marked private; busy road; trail details (overgrown, fallen trees, fords, gates, faint); beside a ski track; not ploughed; opens slowly after snow; through a harbour; near a rock or shoal; a short night; the gear check; Valhalla standing in | an eye, plain rows; a neutral count on the tab when there's nothing more serious |
| **Not checked** | a source that didn't answer: rocks and shoals, trail details, terrain, winter ways, the weather | a dashed circle with "?", a dashed card; a "?" beside the tab's badge; Retry where there's one today |

**Where each comes from**, on every item: **Live** (Fintraffic, with the time), **From the map** (OpenStreetMap: may be out of date or wrong; ⋯ offers to fix it, as today), **An estimate** (the terrain model, the forecast, the waves), **Calculated** (the dark, from the departure and the sun). The water router's items say Väylävirasto or OpenStreetMap; Traficom's depths are never among them.

**What "nothing" means:** the end of Check lists what Polku looked at for this route (trail details, heights, road works, daylight, water hazards…), with ✓, "didn't answer" or "not for this route", and says plainly: nothing listed doesn't mean a way is open, safe or allowed; signs on the ground win. **A way marked private** says what that usually means in Finland: often a yard or a road closed by a sign, while in the forest everyman's right usually lets you walk and cycle.

**In the peek:** a row "1 to read before you go · Road works: Teiskontie ›" above the numbers, only while there's something in the first group, and not while Check itself is in sight. It opens Check. **Gives up:** about 50 px of map while it's there (85.2 % of a 390 × 844 screen in view instead of 90.9 %); a route with nothing to read before you go keeps the one-row peek.

**The tab's badge:** the most serious group decides it; a screen reader hears all three ("Check: 1 to read before you go, 4 worth a look, 1 not checked").

**What stays:** the order along the route within each group, Avoid, Short cut, ⋯ (hide this kind, fix the map), hidden kinds listed at the end to bring back, Retry, the item's place on the map (its row shows it).

## 6. Waypoints, and long routes

- **Selecting is the only thing an unselected row does.** The whole row is one button: its marker (the same as on the map: start, number, finish), its name (two lines, never cut with "…"), "Via 23 · 5.7 km · 07:58", and small icons for a stop, a change of sport or a leg of its own. No Remove: a tap meant for a row never deletes. Today every row has five 28 px buttons, Remove among them.
- **The selected point** opens in place, tinted, its marker ringed (and on the map): its name as a field (rename in place); the departure on the start; "Next leg: MTB · Follow paths · Balanced ›", which opens the leg's sport, mode, style and Other ways; Stop; Earlier and Later; **Move to…** (a number, for long routes); and **Remove**, last, apart, in red, with Undo in a note.
- **The map and the list select together:** a tap on a marker selects its row (and scrolls it into view); a selected row lights its leg on the map and the profile (22a's lit leg).
- **Long routes (more than about 12 points):**
  - **Find a point:** by its name or its number.
  - **All / Key points:** Key points are the start, the finish, stops, changes of sport, points with a name of their own and legs with their own settings; the shaping points fold away. 52 points become 12 in the mock-up.
  - **A bar on top of the list** keeps the selected point in sight while the list scrolls: its marker and name, ‹ › to step through the points (the map follows), and Show.
  - **Move to a number** instead of dragging across screens; dragging stays (a long press on a row on phones, the grip on hover on desktops).
  - **Keyboard (desktop):** ↑ ↓ select, Alt+↑ ↓ move, Delete removes the selected point (with Undo), Enter renames.
- **Recovering:** every change is one undo step; Remove and Move say what they did in a note with Undo.

**Measured** in the journey (today, `87a9b07`): the finish's row was 11 screens of scrolling down at half in the 30-point run; in the mock-up a point is a search, a tap on its marker, or ‹ › away. **For real phones:** whether a long press to reorder fights with scrolling the list.

## 7. The worst cases, and the rules they gave

From break-ui's pass on the mock-up and `mockup_probe2.py` (146 runs: every frame in English, and in Finnish and Swedish with the worst case; phones also at 360 × 740 and 200 %):
- **Names that identify a point or a route wrap to two lines**, never "…"; secondary lines (the first warning's name in the peek row, the desktop toolbar's sentence) may be cut, and their full text is a tap away.
- **Numbers are never cut**: the peek's numbers wrap onto their own line when the row is too narrow (360 px, Finnish, a 7 h 45 min route), and Trip and Done go under them.
- **Menus open above their button, below the top bar, clear of the map's buttons**, and scroll inside when taller than the room; with no room above their button (200 %, a raised sheet) they open as a sheet of their own. A tap outside an open menu only closes it.
- **With enlarged text** (200 % zoom, large text sizes) the profile folds to its row and the whole sheet scrolls as one; nothing in the sheet is squeezed. The mock-up's sheet at 200 % used to overlap its own parts before this rule.
- **Notes on a phone stay left of the map's buttons.**
- **Targets:** every planner control on a phone is 44 px or more, except the sheet's handle, a 120 × 36 target over a 36 × 5 bar (above WCAG 2.2's 24 px; the swipe takes the whole header anyway). Desktop controls are 40 px (a mouse).
- **Not the planner's:** at 200 % the map's own buttons and the top bar overlap (#73), and at 360 × 740 with the sheet at half the compass meets the top bar; both are for #73 and #226, not this phase.

**Dark mode:** the warning tint and its border keep their shape; white on the green is 5.3:1 (#239's fix). **Sunlight:** the numbers are 18 px bold on a solid surface; warnings carry an icon and a border, not only a tint. **Wet fingers and gloves:** 44 px, 8 px apart, destructive actions last, apart and undoable, no swipe to delete. **One hand:** the toolbox, the round trip's Make 3 loops, Trip and Done are in the bottom third.

## 8. Validation

**The scenarios,** counted on a 390 × 844 phone from a drawn route at peek unless they say otherwise. Today's counts are from the journey script at `87a9b07` (`evidence/journey-main.json`) and the review's table; the new ones from the design (the mock-up is wired for each).

| Scenario | Today | This design | |
|---|---|---|---|
| Plan, sport, the first point | 4 | 4 | the same |
| Four points from there | 8 (the card swallowed taps; 6 on `82e276d`) | 4 | fewer |
| A drawing mode for the next leg | 1 | 2 (phone) · 1 or a key (desktop) | +1 on phones |
| The route style | 2, and the sheet goes to half | 2 | the same, the map stays |
| Undo, redo | 1 | 1 | the same |
| A 20 km loop right after the first point | 1 (the card) | 2 | +1, safer |
| A loop of another length | 3 or more | 3 or more | the same |
| A loop from a drawn route's start | 2 | 3 (Trip) · 2 from Route's tools | +1 from the peek |
| Share link, GPX, save offline | 2 | 2 | the same |
| Clear the route, and back | 2, then Undo in the toolbox | 2, and Undo in the note or the toolbox | the same |
| Something to read before you go, from the peek | 2 (raise the sheet, Check) | 1 (the row) | fewer |
| Rename a point, its stop, its leg | 1 (its row's buttons) | 2 (select, then the action) | +1, no Remove beside them |
| Remove a point | 1 | 2, with Undo in a note | +1, on purpose |
| Point 37 of 52 | scroll (11 screens for the finish in the 30-point run) | type 37, or its marker, or ‹ › | fewer |
| Move point 23 to place 5 | drag across screens, or 18 × ▲ | Move to…, 5, Move | fewer |
| Stop drawing and read Check without adding points | not possible: Done closes | Done, then Check | new |
| Close the planner completely | 1 | 2, or a swipe | +1 |
| Back to editing after closing | 1 (Plan) | 1 (Edit) · 2 from put away | the same / +1 |
| After a reload mid-route | Plan (the planner closed, #238) | as it was left | fewer |

**What the numbers say:** the common drawing loop (points, undo, the style, share) stays the same or gets shorter; four steps get one tap longer on purpose (a mode on phones, a preset loop, editing a point, removing a point), each for a reason in its section; the map in view at peek stays at 90.9 % (82.7 % today) when there's nothing serious to read. The numbers are evidence, not the decision.

**Discoverability and mistakes (reasoned, not measured):** every icon now has its word; the round trip is offered in words at the moment it fits; an accidental tap can no longer start loops, delete a point, or add one while reading Check; Clear and Remove have Undo in a note.

**The design skills:** apple-design (grouping and mapping, wayfinding, agency with undo over confirmations, spatial consistency of menus), emil-design-eng (press states, tooltips, no animation for keys, origin-aware menus), break-ui (§7), mobile-native (16 px or more in fields, no tap flash, hover only with a mouse, safe areas). Impeccable's design hook found nothing deterministic in the mock-up.

**Independent criticism:** AGENTS.md keeps independent checks for Codex, not subagents. A Codex brief is in #246 (try to break the design from the mock-up and this plan; post findings on the PR). Not run yet.

**What only people or real phones can settle:**
- whether people tell the drawing mode from the route style from the menu, and find the style at all (people);
- the menu's name (people: task 5 below);
- whether Done is read as "close", and whether the route's view feels like a place or a detour (people);
- whether two taps for a mode bother someone who switches often (people, experienced planners);
- the toolbox at the bottom left for right thumbs, and left-handed use (real phones);
- how often a real route has something to read before you go (a few recorded routes, then people);
- a long press to reorder against scrolling (real phones);
- the groups' boundaries for paddling and winter (people who paddle and ride in winter);
- 200 % zoom and iOS text sizes (real phones, with #73).

**A test script** (the review's, with two tasks added; three to five people, own phones, outdoors if possible): the review's five tasks, then 6. "You've drawn your route. You're done for now: what do you do?" (watch for Done, ✕, a reload); 7. "Your route goes through a place marked private. Can you go that way?" (watch whether they read the item and its note). For task 5 (send it, keep the map for no signal), note where they look first: that's the menu's name.

## 9. Building it

**One phase in four parts,** each a PR of its own, in order (each needs the one before). The user decides its place in ROADMAP; the review suggests after the bugs below and before 22b, since 22b moves the same panel.

| Part | What | Closes or touches |
|---|---|---|
| **a. The toolbox and the peek** | The toolbox (phone float and dock, the desktop toolbar on the panel's edge, the mode menu with the styles, keys); the peek row (numbers, Trip, Done); the colour, sport, style and Round trip chips out of the header; Show the whole route in the map's column; the Trip menu (with Clear's Undo note) | #233, #241, #90 (part), #242 |
| **b. Round trips in the peek** | The first point's peek and its lengths; the round trip in the sheet with Make 3 loops; the loop cards side by side; picking on the map; the map waits while loops are made | #232, #89 (part), #109 |
| **c. Done and the route's view** | The three states; map taps inspect in the view; ✕ and the note; reopening as left, after a reload too | #238 |
| **d. Check and the waypoints** | The three groups, sources, what was looked at; the peek's row and the badge; the selected row, Key points, Find, the bar, Move to, the list's keys | #84 (lighting Heads-up on the route fits here) |

**First, from Fixes 2:** #240 (panels above the screen), #251 (the style chip folds the sheet), #239 (dark contrast), #242 (long numbers at 360 px and 200 %) and #241 (undo at the start) touch the same header; fixing them first keeps each part's diff to the point. **#226** (the 3D button) changes the map's column the toolbox and Show the whole route must clear: build it before part a.

### By module

- **`js/planner.js`**
  - `buildPanel()`: the header becomes the warning row (when needed) and one row: `els.sum`, the Trip button, Done (Edit in the view). Out of the header: `quickColor`, `quickSport`, `quickLoop`, `quickStyle`, the tools row, the wide-only tools and `fit`. `fitHeader()` and its icon-only shrinking go (nothing left to shrink). Minimise stays on desktop.
  - The toolbox: a new element outside `#planner` (`#pl-tools`), built here, placed by a `placeTools()` that floats it above the sheet (phones) or hangs it off the panel's map-facing edge (desktop); `ResizeObserver` on the panel, the map's column and the window; docking into the sheet by the rule in §1. `setMode()` and `setStyle()` as today.
  - The mode menu and the Trip menu: one small menu builder (role menu, `menuitemradio`, Esc, focus back to the button, a tap outside only closes). `popMenu()` (used by Heads-up's ⋯) may be the start.
  - `this.editing` beside `this.active`: `setEditing(on)`; `onMapClick()`, `beginEdit()`, `onLinePress()` and the markers' drag check it; in the view, a map tap goes to `js/inspect.js` as with the planner closed. `setActive(false)` stays the "put away".
  - Round trip: `renderLoop()` gains the peek's first-point state and the sheet's form (presets from `LOOP_PRESETS`, a step per sport, the typed length, Make 3 loops); `renderLoopCards()` side by side; `startTip()` and `closeStartTip()` go (#232); `onMapClick()` ignores taps while `loop.busy` (#109).
  - `renderWarnings()`: rows grouped by `tier`, each with its `src`; `renderCoverage()` for what was looked at; the tab's badge and the peek's row from the same counts.
  - `renderWaypoints()`: one button per row; the selected row's controls; Key points, Find, the bar, Move to; `this.sel` (kept with the route in memory, not saved); a marker tap selects.
  - Keys: P, S, W, E and the list's keys, in `js/main.js`'s handler or here.
- **The warnings' `tier` and `src`,** set where each warning is made (they know their source): `findWarnings()`, `trailWarnings()` and `accessRow()` in `js/analysis.js`; `js/safety.js` (road works, incidents, busy roads: live); in `js/planner.js` `waterWarnings()`, `darkWarnings()`, `winterWarnings()`, `stopWarnings()`, `detourWarnings()`, `standInAccess()`, the unrouted and terrain rows. A table from kind to tier is the fallback for anything not set. No new check, no new source.
- **`js/sheet.js`:** unchanged. The planner's `start()` measures the peek with the warning row and a docked toolbox; `grab()` lets the docked toolbox's buttons stay taps.
- **`js/main.js`:** Plan's place while planning (it hides, as today) and while put away; reopening as left (`plannerOpen` in the store); the keys; notes placed left of the map's column on phones.
- **`js/ui.js`:** icons for Straight line, Over water, Trip, link, GPX, the eye, the dashed "?", live, from the map, estimate.
- **`css/app.css`:** the toolbox (float, docked, desktop), the peek's row and the stacked Trip button, menus, the round trip, loop cards, Check's groups, waypoint rows; the enlarged-text rule; `(hover: hover)` for every hover; `prefers-reduced-motion`, `-transparency`, `-contrast`.
- **`index.html`:** the toolbox's container; Plan's button in the map's column.
- **`tools/smoke.py`:** the checks under Acceptance; the `drawer`, `editing`, `loops` and `quick` groups grow.
- **Docs:** DEVELOPING (the planner's states, the toolbox's placement, the tiers), USING (the controls), README (Check, the Trip menu, the route's view), CHANGELOG.

### Interaction, exactly

- **The toolbox's menus** open on the button's press feedback and the click, from their button (transform-origin at it), 160 ms, nothing for a key; Esc and a tap outside close them; focus goes to the checked item and back to the button.
- **Undo** steps back any change made in the planner, across Done and ✕, and the note's Undo is the same step.
- **A map tap** in editing adds a point; with the round trip open it moves the loop's start; while loops are made it does nothing; in the view it shows the map's popup; with a menu open it only closes the menu.
- **The peek's row** for warnings comes and goes with the first group, without moving the numbers' place on the screen (the sheet grows upward).
- **Reduced motion:** the toolbox and menus cross-fade; the sheet jumps (as #249 does).

### Accessibility

- The toolbox is a `toolbar` ("Drawing tools") with arrow keys between its buttons; the mode button says "Draw the next leg: Follow paths, route style Balanced" and has `aria-haspopup="menu"` and `aria-expanded`; the menu's modes are `menuitemradio` with `aria-checked`, its groups labelled. The desktop's modes are a `radiogroup` with `aria-keyshortcuts`.
- Done and Edit announce the change ("Done editing: a tap on the map shows what's there"; "Editing"), and focus stays on the button that replaced the one pressed.
- The peek's time is a button "16 min from now: change the departure"; the warning row says its count and the first item; the tab's name says all three counts.
- Check's groups are headings (h3); each item's text is a button ("show on the map"); its source is text, not an icon alone.
- The waypoint rows are buttons with `aria-expanded`; the selected one is `aria-current`; the bar is a labelled group; Move to's field is labelled with its range.
- Every target on a phone 44 px or more, 8 px apart; fields 16 px or more; text from 12 px, the numbers 18 px bold; colour never alone (icons, words, borders, dashes); 4.5:1 for text, 3:1 for icons and borders in both themes.
- Enlarged text and 200 % zoom: the rules in §7; nothing clipped, the sheet scrolls.

### Regression risks

- **Drawing on the map** (`onMapClick`, the markers' drag, `onLinePress`) now depends on the state: the editing smoke group in four sports, mouse and touch, with the view in between.
- **The sheet's sizes** with the warning row and a docked toolbox (`sizes()`, `--peek-h`, `frame()`'s padding): the route must still be framed above the sheet.
- **Round trips:** the start, the length in km or time, the direction, the three loops, More loops, Use this loop, water loops (no routing calls), the cap of five generations in ten minutes.
- **Heads-up and Avoid:** every item still listed (none lost by the grouping), hidden kinds, Short cut, Retry, Use BRouter.
- **Weather along the route, Go's departure** (`revealDeparture()` from the peek's time).
- **Share links, saved routes, offline areas:** no stored format changes; the selected point and the state aren't in links; `plannerOpen` is a new setting with a default for old devices.
- **3D, hover, the timeline docked in Go, Layers and Settings while planning** (#240), the quick layer drawer over the peek.
- **Keys:** P, S, W, E only while the planner is open and no field has focus.

## 10. Acceptance criteria

**Layouts:** 390 × 844, 360 × 740, 375 × 667, 1440 × 900 and 1024 × 768; light and dark; MTB, gravel, hike and paddle, with a route drawn and the timeline open; a 390 phone at 200 % zoom and with the largest text size.
- At peek on a 390 phone with nothing in the first group, the sheet is one row and 90 % or more of the screen is free of the planner; the toolbox doesn't overlap the map's buttons, the scale or the credits on any of the phone sizes.
- No planner control on a phone is under 44 × 44 px (the handle's target at least 24 px high); no two overlap; none is off the screen; no number is cut; no point's or route's name is cut with "…".
- At 200 % zoom: nothing in the sheet overlaps, the toolbox is docked with the mode's name whole, menus open on screen, the sheet scrolls.

**The workflows** (each a smoke check where a script can do it, the rest in the test script):
- Plan, a sport, four points: four taps, each adds a point.
- After the first point, a length and Make 3 loops make three loops; a map tap meanwhile adds nothing; Use loop A takes it and Undo brings back the one point.
- The mode menu changes only the next leg (a drawn leg keeps its mode); a style routes the route again, with Undo.
- Done: no toolbox, a map tap adds no point and opens the map's popup; Check and Go work; Edit brings the toolbox back and undo still works.
- ✕: the route stays on the map; Plan opens it as it was; after a reload it opens as it was.
- Trip: every item does what it says; Clear route, then Undo, brings the route back.
- Check: every Heads-up item of today appears exactly once, in its group, with its source; with a source failing, Not checked says so and the badge shows "?"; the peek's row appears only with something in the first group.
- 52 points: Find "37" selects it and the map shows it; ‹ › step; Move to 5 moves it; Remove asks nothing and Undo brings it back; an unselected row has no Remove.
- Keyboard on a desktop: P, S, W, E, Ctrl+Z, Ctrl+Shift+Z, F, R; the list's ↑ ↓, Alt+↑ ↓, Delete, Enter; Esc closes menus; focus is always visible.

**Nothing lost:** every control of today's planner has a place, checked against this list:

| Today | In this design |
|---|---|
| The numbers, the time's link to the departure | the peek's row |
| Done | the peek's row (Edit in the view) |
| Minimise (desktop) | the panel's header |
| The route's colour (header) | the profile's Colour by and On map |
| The sport (header) | the top bar's pill |
| Round trip (header) | after the first point in the peek, the start, Trip, Route's tools, the map's menus |
| The style chip (header) | the mode's menu (phones), the toolbar's Style (desktop), How you go |
| The modes, undo, redo | the toolbox |
| Show the whole route | the map's column, while part of the route is out of view; F |
| ⋯ and the wide bottom bar's tools | Trip; Route's tools; moving the panel stays with the panel |
| The start's choices, the first point's card | the start's peek; the first point's peek (#232) |
| A waypoint row's name, leg settings, stop, earlier, later, Remove; the start's departure; a changeover's minutes; the folded leg notes | the selected row; icons on every row; Key points |
| Heads-up, Climbs, On the route, On the map | Check, Heads-up in its three groups |
| Time, Departure & weather, Take it along | Go |
| The point, leg and spot menus on the map | unchanged; a point's tap also selects its row |
| R, F, L, T, /, Ctrl+Z | unchanged; P, S, W, E and the list's keys added |

**Docs and checks:** `python3 tools/smoke.py` passes; `evidence/journey.py` updated for the new controls, run before and after, with no step taking more taps than §8's table says; screenshots before and after on `pr-screenshots`; DEVELOPING, USING, README and CHANGELOG updated in each part.

## Still the user's to decide

1. The menu's name: Trip, Share & save or More.
2. Phones' modes: one drop-down, or three buttons.
3. The round trip's first row: the lengths, or one button.
4. The calmer planner's place in ROADMAP's order, and whether it's one phase in four parts.
5. From the first iteration, still open: whether the departure stays in the start's row (it's also in Go and the peek's time); the colour beside the profile or in the header.
