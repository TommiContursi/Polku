# One tap, one toolbox (#660, #690, #233)

A mock-up and a plan for two choices: what a tap on the map does while you plan a route, and where the planner's tools live. Asked for on 2026-11-03, after the usability assessment of that day (PR #712) traced the planner's complaints to one cause. A tap on the map means four things depending on the state, and nothing on screen says which state holds. Edit and Done exist only to settle it. The toolbox has six shapes for one route. This plan recommends; it decides nothing. The user chooses on a phone.

**The mock-up:** [mockups/issue-660-tap-and-toolbox.html](mockups/issue-660-tap-and-toolbox.html), clickable, on a picture of `main` (f121d64) over Kauppi with the Kauppi MTB route from `tools/fixtures/route-kauppi-mtb.json`. The switches at the top choose: the version (`?v=today|v1|v2`), the toolbox's place (`&place=a|b|r`), the desktop toolbar (`&desk=foot|top`), the size (`&w=360&h=740`, `&z=2`), the words (`&lang=fi`), where the advanced controls live (`&adv=more|context`) and the worst case (`&worst=1`). `?frame=<id>` shows one frame alone; on a phone it fills the screen. Each frame keeps a log of taps, swipes and mode changes (`window.mock.frames`), and the flows below were counted from it. Every earlier version stays behind its switch.

**What was looked at:** `main` at f121d64, served from a worktree and driven in headless Chrome at 390 × 844, 360 × 740, 195 × 422 (200 %), 1440 × 900 and 1024 × 768 with the fixture route. The toolbox's position and contents were measured at every sheet size, while editing and in the view. The cards' words were read from the app (a point, a stretch, the route at a spot, Check). **Not checked:** a real phone (the browser pane wasn't visible in this session, so nothing ran on a device or in touch emulation; the user's phone is the check), keyboard and screen readers in the mock-up, dark mode, paddling.

## Today, measured

On a 390 × 844 phone, the same route, editing:

| Sheet | The toolbox's top | What it holds | Where |
|---|---|---|---|
| Folded | y 534 | the mode's icon, Undo, Redo | floating |
| Peek | y 468 | mode and style, Undo, Redo, ⋯ | floating; **Done** in the numbers row |
| Half | y 356 | the same | floating |
| Full | y 108 | the same and Reverse | docked into the sheet |
| A card open | the same place | Undo and Redo only | floating |

In the route's view it's a lone ⋯ at y 424 (peek), y 356 (half) or y 68 (full, in ⌄'s row), and nothing when folded. Edit lands 9 px to the right of where Done was, and the sheet grows by the title row above them. At 360 × 740 it docks at every size; at 200 % it docks in two rows, 161 × 99. On a desktop the numbers are at the panel's top (y 100) and the toolbar is at the window's foot (y 832): 730 px apart.

## The two versions

Both keep everything a tap does today on a point, the route, a place's icon and a hazard (each opens its card), and a hold or right-click opens the same card. Both put each card's actions on the card itself (#690). Both drop Edit, Done, the route's view, its title row swap and every "You're not editing" note.

- **Version 1, Add points as a tool.** One toggle, **Add points**, in the toolbox; Draw it turns it on. On: a tap on empty map, a way or a marked route adds a point. Off: the same tap opens what's there, with its actions (Add to my route, Start here, End here, Round trip from here, Avoid this spot), and the map says "Add points is off: a tap shows what's there." The user turns it off; putting the planner away doesn't change it. Pressed, it is filled and carries a tick, so its state doesn't depend on colour alone. It costs one more state to learn, and a state can be forgotten: off by mistake, the next taps open cards instead of adding.
- **Version 2, a tap adds, Look is one step.** No state. While the planner is open, at any size, a tap on empty map, a way or a marked route adds a point. **Look** makes the next tap open what's there, then the tap adds again. The map says "Tap what you want to see. Nothing is added." while Look waits. Putting the planner away is browsing. It costs one tap for every look, and a tap meant to look at a trail adds a point (Undo is at the thumb).

**Version 1 with the tool on is Version 2.** Taps on points, the route, places and hazards open cards in both. So the real choice is narrower than it looks: is looking a state that stays (Version 1's off), or a step that clears itself (Version 2's Look)?

**The accidental point.** In the mock-up, which uses the app's rule (`onMapClick()`: a box of 12 px by touch and 6 px by mouse around the route's 9.5 px casing), a mouse click 12 px from the route's middle appends a point at the route's end. That is 7 px past the line's white edge, and it was the assessment's doubled-back route. By touch, 17 px does the same. It happens in Today's editing, in Version 1 with the tool on, and in Version 2. Only Version 1 with the tool off opens what's there instead. So both versions widen the route: in the mock-up a tap within 24 px by touch or 16 px by mouse opens the route's card. Measured again: Version 1 and 2 now open the card at 17, 19 and 23 px by touch and at 12 and 15 px by mouse, and add a point only from 26 px and 18 px. Today still appends from 17 px and 12 px.

## The toolbox's place

Five slots in one order everywhere: **[the tool] [how the next leg is drawn · style] [undo] [redo] [⋯]**. The tool is Add points (Version 1) or Look (Version 2). Undo and Redo are disabled, never hidden, when there is nothing to undo or redo.

- **(a) The sheet's foot.** The toolbox is the sheet's last row at every size: folded (under the numbers' line), peek, half, full, with a card open, and while a point is being moved. The sheet grows upward from it, so it is the one row of a bottom sheet that never moves, at the thumb. A card's peek is the planner's own peek (#603), so opening a card moves nothing either.
- **(b) A fixed column at the map's left,** the mirror of the map's column, under the top bar, with words under the icons as Weather and Layers have. It never moves, and the sheet's full size stops below it.
- **Tried first and kept behind the switch: the sheet's first row.** The flows found it rides up and down with every change of the sheet's height: when a card opens, when the warning goes after the departure changes, and when the first point turns the start's line into the numbers. In the flows it moved by itself eight times.

What each costs the map, as px of map above the sheet (CSS px, from the top bar's foot):

| | 390 × 844 peek | folded | 360 × 740 peek | folded | 200 % peek | folded |
|---|---|---|---|---|---|---|
| Today (editing) | 605, with a 297 × 50 box floating on it | 716, with 142 × 50 | 409 (docked) | 612, with 142 × 50 | none (the sheet fills it) | 257 |
| (a) the foot | 535 | 652 | 388 | 548 | none | 144 |
| (b) the column | 599, with a 56 × 263 column on it | 716, with the column | 453 | 612 | **breaks** | **breaks** |

- **(a)** costs about 70 px of the map's height at the peek and 64 px folded. At the peek that is about the same area as Today's floating box, which covers 297 × 50 of the map. Every slot is 44 px. At 200 % it takes two rows (the tool and the mode, then Undo, Redo and ⋯), 112 px, against Today's 99 px docked box.
- **(b)** costs a 64 px strip at the left down to y 331, and the sheet's full size: it stops at y 339 instead of y 68, so full holds 271 px less. At 200 % the column needs 263 px of a 422 px screen and runs into the top bar, the map's column and the sheet. Every slot is 44 px wide by 44–56 px tall. It sits in the corner that's hardest to reach for a right thumb.

**Desktops.** No sheet stops: the panel is open or minimised, and a card floats at its spot.
- **At the map's foot** (today, #468): the toolbar stays 730 px below the numbers it acts on.
- **The panel's first row,** above the numbers, in both docks: the tools sit right above the numbers, at the panel's top in the side dock (y 128) and in the panel's header in the bottom dock. The panel's size doesn't follow its content, so the row doesn't move.

On a desktop the five slots replace today's fourteen buttons: the three modes become one button with its menu (P, S and W stay), and Reverse, Back to start, Share link, Export GPX and Save offline go into ⋯, as they already do at 1024 × 768. The tool takes Done/Edit's slot at the stable end (#624, #594's E), and the map's foot is left to the scale, the credits and the weather.

## The flows

Run in the mock-up by pointer at 390 × 844, one after another, with the toolbox at the foot (the column gave the same counts). "Moved by itself" counts the steps after which a slot of the toolbox moved, appeared or went without the user swiping.

| Flow | Today: taps · swipes · mode changes · moved by itself | Version 1 | Version 2 |
|---|---|---|---|
| 1 Draw it, five points | 6 · 0 · 0 · 2 | 6 · 0 · 0 · 1 (it appears) | 6 · 0 · 0 · 1 (it appears) |
| 2 Halfway: the road's surface under the pointer | 4 · 1 · **2** (Done, Edit) · 4 | 4 · 1 · **2** (off, on) · 0 | 3 · 1 · **1** (Look) · 0 |
| 3 Move the third point, remove the fourth | 5 · **7** · 0 · 5 (the tap gives no Move: by Route's list) | 5 · 4 · 0 · 0 | 5 · 4 · 0 · 0 |
| 4 Two more points | 2 · 0 · 0 · 0 | 2 · 0 · 0 · 0 | 2 · 0 · 0 · 0 |
| 5 Read the warning, find it on the route | 2 · 1 · 0 · 2 | 2 · 1 · 0 · 0 | 2 · 1 · 0 · 0 |
| 6 Leave tomorrow at 09:00 | 2 · 1 · 0 · 2 | 2 · 1 · 0 · 0 | 2 · 1 · 0 · 0 |
| 7 Copy the share link | 2 · 0 · 0 · 0 | 2 · 0 · 0 · 0 | 2 · 0 · 0 · 0 |
| 8 Fold, pan, a point from the folded sheet, unfold | 2 · 1 (+1 pan) · 0 · 1 | 2 · 1 (+1 pan) · 0 · 0 | 2 · 1 (+1 pan) · 0 · 0 |
| **All eight** | **25 · 11 · 2 · 16** | **25 · 8 · 2 · 1** | **24 · 8 · 1 · 1** |

- **Today with the hidden gestures** would do flow 2 with a hold (no mode change) and flow 3 with two holds (3 swipes fewer). Nothing on screen says the holds exist; that is #690.
- **Where Version 1 still makes someone change modes twice for one job:** looking at a way while drawing (flow 2) is off, look, on. That is the same count as Today's Done and Edit, though nothing else on screen changes. Forgetting "on" brings back Today's mode error, the other way round: the next taps open cards. Version 2 avoids it at the cost of one tap per look and the trail-tap that adds a point. With several looks in a row the counts turn: three looks cost Version 1 two mode changes and Version 2 three Looks.
- The flows' taps landed where a person aims. The near-route tap is the separate test above.

## #660's ideas, drawn in

- **The departure as a chip:** the numbers row's time has **Leave 17:30 ▾** under it (**Leave now ▾** by default), where today the "from now" is a dotted underline. It opens Leave: now, a time today, tomorrow, or the phone's own picker. Setting tomorrow at 09:00 takes "In the dark" off the warning row, and the toolbox stays where it is. Today's leaves while the Leave card is open and comes back 57 px lower.
- **Show lit ways** on the "In the dark for 3.03 km" warning's card, beside Show it on the route and Leave earlier…: the model for a suggestion. It turns on the existing Lit ways layer (#638) and says once that unmapped isn't unlit and that mapped lights may be off. Nothing new watches for darkness: the warning is already there.
- **The advanced controls:** How you go, Your speed and Round trip at the top of ⋯, in one order everywhere (`&adv=more`), against today's rows in Route and Go (`&adv=context`). Recommended: ⋯, the one place reached from every state, with Route's and Go's rows kept as they are, since they open the same steps.

## The stretch's card from the pick's card (#690)

**Yes: one card with two data sources.** The pick's card (`pickBody()` in `js/cards.js`) is built from an analysis of the way (`pick.a`, made by `analyse()`), a chain of ways (`pick.ways.chain`, `{ w: { tags, len } }`) and the weather at the spot (`pick.wx`). The route has an analysis of the same shape (`pl.analysis`, also from `analyse()`), with the router's tags at each sample (`a.attr[k].tags`). Its arrival time at each sample gives "weather when you're there". So a stretch can feed the same sections, each over the stretch's range of samples. The route's own rows stay in `stretchCard()`: distance, time and climb (`stretchNums()`), Look out for (`itemsOn()`), Edit this stretch, On the profile, and Remove this stretch (#627).

What would change:
- `stretchNums()` finds the stretch's samples, `k0` to `k1`, and throws them away. A `stretchRange(s)` beside it returns them, for the card and for `stretchNums()`.
- `profileGroup()` and `pickChart()` take the analysis and a range. `ProfileChart` already has `setView()` and `setHighlight()` (`js/chart.js`), so the stretch's profile is the route's chart zoomed to `k0`–`k1`, with no new slicing.
- `colourBy(pl, pick)` reads `pick.a` and the pick's remembered mode (`modeOf()`, `setMode()`). It takes the analysis, a range and a mode with its setter instead: the pick keeps its own, and a stretch uses the route's Colour by (`pl.colorMode`), so the stretch's colours are the route's on the map. `breakdownRows(a, mode)` (`js/chart.js`) takes a range, so the legend's lengths are the stretch's.
- `wayGroups(chain, a)` (`js/facts.js`) is fed a chain grouped from consecutive samples' `a.attr[k].tags`, and the same range for its steepest grade and uphill class. **`unmapped()` must not run on it:** the router passes on only some tags, and Valhalla and water legs fewer or none. The card says "From the route's own analysis" instead of "Not mapped".
- The weather group reads the route's own forecast at the stretch's end, "Weather there at 17:38", in place of `pick.wx`.
- The route at a spot (`routeCard()`, `routeBody()`) keeps its three numbers and actions. Its What's here becomes the same fact groups, for the run of samples the route shares a way with around the spot.

**The smallest first PR:** the stretch's card gets its profile. In `stretchCard()`, after the three numbers, the route's chart zoomed to the stretch, with Colour by bound to the route's own, through `stretchRange()` and the range on `profileGroup()`. It changes nothing in the pick's card. The user checks: open a stretch from a point's card or Route's list, see that stretch's profile, change Colour by and see the route on the map change with it. The mock-up's stretch section draws the end result.

## Checked with the design skills (2026-11-03)

- **mobile-native.** The foot takes the home indicator's inset (`env(safe-area-inset-bottom)`) and sits at the thumb. The column (b) is in the top-left, the hardest reach for a right thumb. A bottom-pinned row must follow the visible viewport (dvh) so iOS's bottom address bar doesn't cover it; the app's sheet already does. Fixed in the mock-up: its lists didn't scroll by finger inside the screen that takes every touch for the map, and a pan pulled the page to refresh in the single-frame view.
- **break-ui** (Finnish, 360 px, 200 %, a 66-character name, 17 warnings, 123.4 km, 7 h 45 min, ↑2 345 ↓2 310 m). Fixed: the style's caption broke mid-word ("Tasapainoin-en") wherever the mode button was narrow, so it now goes first, as #233 §1's fold order says. At 200 % the mode's name lost its icon to stay whole, and the toolbox became two rows instead of three. The sheet scrolls as one at 200 % (#453), so the warning row is never cut under the toolbox. The hint took four lines in Finnish at 200 %, so it now shows only when a tap won't add. Held: the numbers wrap between groups, never inside a number; Check's 17 fits its badge.
- **apple-design.** Familiarity: Version 2 is the route builders' own model (Strava and Komoot add on every tap while planning); Version 1 is a drawing tool's. Wayfinding: Version 1's pressed tool says what a tap will do, Version 2's open planner says it, and Today says it nowhere. Grouping and mapping: the foot puts the tools by the numbers they change; the column puts them far from both the numbers and the thumb. Forgiveness: Undo one tap away at the thumb in every state is what makes Version 2's trail-tap cheap.
- **emil-design-eng.** Press feedback is the app's (97 % for 120 ms, on press). The tool and Look change at once, with no animation, as anything used dozens of times a day should. Nothing in the toolbox moves, so nothing animates there. Found and fixed: the "Add points is off" line grew the sheet upward by 20 px and moved the numbers and the map's buttons; it now floats on the map and moves nothing.
- **design:design-critique** (a separate review). Ranked first: the near-route tap that appends a point, so both versions now widen the route (above). Then: the tool's state was shown by its fill alone, and green also means "the main button", so the tool now carries a tick when on. Version 1's toggle is a sticky Look, a state to forget. (b) breaks at 200 %, and its disabled Undo and Redo looked like empty tiles over the map. Its verdict: Version 2 with (a).
- **impeccable critique** (the same separate review, Nielsen's heuristics out of 40): **Today 21, Version 1 28, Version 2 29.** Today lost most on consistency (1: six toolbox shapes) and recognition (2: actions behind a hold). Both versions lost on error prevention (2) until the near-route guard. Version 1 lost on status (the fill-only state, since fixed). Fixed after it: Look waiting is said on the map itself, not only in the toolbox, for bright sun.

## Where it stands

- **To choose (the user, on a phone):** the tap model, Version 1 or 2; the toolbox's place on phones, (a) or (b); the desktop toolbar, at the map's foot or the panel's first row; where the advanced controls live.
- **Recommended, with the evidence above:** Version 2, (a) the sheet's foot, the panel's first row on desktops, ⋯ for the advanced controls.
- **In both versions, whichever is chosen:** the wider route, so a tap near it opens its card; the cards' actions on a tap, with the hold kept as a shortcut; Leave ▾ in the numbers row; Show lit ways on the dark's card; the stretch's card from the pick's.
- **Not drawn:** routing (new legs run straight in the mock-up), the sheet's spring, the weather timeline, Other ways' routing, round trips and Marked routes behind the start, keyboard and screen readers, dark mode.
- **Open:** whether the foot should hide while a phone's keyboard is up (Rename); what Look does on a desktop, where hover already reads a way; whether a tap past the guard should insert a point on the nearest leg rather than append one at the end.

## The recommendation

- **The tap: Version 2.** It is the version where a tap means the same thing whenever the planner is open, with no state to forget. That is the assessment's cause gone, and it is how the route builders the user compared Polku with behave. Version 1 with its tool on is Version 2 already; its off state is a Look that stays. If looking at several ways in a row matters more than never being in the wrong state, choose Version 1: the counts favour it from three looks on. With the wider route, neither appends a point for a tap meant for the route.
- **The toolbox on phones: (a), the sheet's foot.** It is the only place tried that never moves at any size, with any card, at 360 px and at 200 %, and every slot stays 44 px. It costs about 70 px of the map's height at the peek. (b) never moves either, but it costs the sheet's full size, sits far from the thumb, and breaks at 200 %.
- **On desktops: the panel's first row,** so the tools are by the numbers in both docks, with the tool in Done/Edit's slot at the stable end. The map's foot keeps the scale, the credits and the weather.
- **The departure, the suggestion and the advanced controls:** Leave ▾ under the minutes; Show lit ways on the dark's card only; How you go, Your speed and Round trip at the top of ⋯.

## The build, in small PRs

Each is tried on the phone before the next starts, each with its smoke check. #692, #386, #235 with #208 and #527 come first, as already planned. This list is for the user to approve; the order follows from what each needs.

1. **The route is wider to a tap.** A tap within 24 px by touch and 16 px by mouse opens the route's card while drawing, never a point at the end. *Check on the phone:* tap beside the line, just off it; the card opens and no point is added.
2. **The toolbox at the sheet's foot (phones) and in the panel's first row (desktops),** the five slots in every state, Edit and Done still as today. *Check:* fold, peek, half, full, open a card: the toolbox doesn't move; the map's buttons have their room.
3. **The tap model** (the chosen version): Edit, Done, the route's view, the title row swap and the "You're not editing" notes go; Add points or Look takes the first slot; the map says when a tap won't add. *Check:* draw, look at a trail, draw on, without a mode you didn't choose.
4. **The cards' actions on a tap:** a point's card has Move, Rename, Remove and Next stretch; a way's has Add to my route, Start here, End here, Round trip from here and Avoid this spot. The hold stays a shortcut. One kind of card per PR if it grows. *Check:* remove a point with taps only.
5. **Leave ▾** in the numbers row. *Check:* set tomorrow at 09:00 from the peek; the times and the dark warning follow.
6. **The stretch's profile**, the first PR of the card-reuse answer above. Then its way, surface, difficulty and weather, then the route at a spot, each its own PR. *Check:* the stretch's card against a stranger's path's.
7. **Show lit ways** on the dark's card. *Check:* leave at 17:30, open the warning, turn on Lit ways from it.
8. **The advanced controls in ⋯.** *Check:* How you go from ⋯ at every size.
9. **Acceptance:** #365's newcomer and expert passes on `main`.
