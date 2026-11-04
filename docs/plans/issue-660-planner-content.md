# The planner's content (#660): what it shows while you build a route

The direction chosen on 2026-11-03, from a brainstorm on the planner's content and information hierarchy, after the cards (#623) went live. It replaces the stages of #660's first draft and the toolbox-first reading of [the usability assessment](../reviews/2026-11-03-usability.md); [issue-660-tap-and-toolbox.md](issue-660-tap-and-toolbox.md) and its mock-up (#723) are research, not a plan. This plan is short on purpose: one meaningful problem at a time, the smallest worthwhile improvement, one PR each, tried in the app before the next is designed. Findings on the way become issues, not scope.

## The direction

- **Content first.** The planner shows the route, its points and stretches, the facts that matter now and the findings you can act on. Detail lives in the cards. What the planner shows should follow what you're doing (building, refining, exploring, checking, preparing), and a late answer (Check, the weather, routing) may change words but never moves the controls or rearranges the planner.
- **Less at once.** The main problem is how much the planner shows at the same time, not only the order. Settings already made (the route style, your speed) aren't repeated prominently in Route: their home is the toolbar and the menus, with a way in from the context when needed. Small grey instructions that explain what should be obvious go; labels get better instead. Safety notes stay. The order of cutting (the user's rule, 2026-11-04): help text and instructions go first; a fact that comes from the route and can change and affect the trip (the weather when you're there, a warning, a stretch's surface) stays, shown once in the place it belongs.
- **The profile matters while drawing**, not only afterwards. It should be compact when not needed and easy to open, eventually to the whole screen for exploring. The profile sheet stop removed on 2026-10-30 isn't brought back without evidence.
- **Keep what works:** the four Ways to begin (a visible departure control is the one addition to consider), the current toolbar's look and behaviour (focused fixes, not a replacement; the compact drawing button in the folded line stays), the sheet's stops, the depth of Check and Go, the cards. The road inspection cards are reused for the route's stretches, with the route's facts and actions (#690).
- **A card's actions are found by a tap** (#690): a hold or a right click is a shortcut, never the only way. The cards and point editing still need work of their own: later pieces, not steps A to C.
- **Desktop counts,** in both docks. Komoot separates the waypoint editor (a side panel) from a persistent summary and profile (a bar under the map); not everything has to live in one scrolling panel. The side dock may be better anchored at the bottom, or full height with fixed controls and a scrolling middle. The Komoot split is worth exploring later; it isn't an approved layout.

## What the planner shows today

`main` at bd21699, MTB, a route of several points, the Route tab:

| Layout | In sight | The route's list |
|---|---|---|
| Phone, peek (237 px) | Check's row when it has arrived, the numbers with Done, Hardest climb | not at all |
| Phone, half (422 px) | the same, the profile, the tabs, How you go, Your speed, the Waypoints heading | 386 px of scrolling down |
| Desktop, side dock | the numbers, Headwind, Colour by, the profile, the tabs, How you go, Your speed, Waypoints | half way down the panel |
| Desktop, bottom dock | peek: the numbers and Headwind; half (450 px): the profile across the width, the tabs, one row | below the fold |

The route's list (Start with Leave now, each stretch with its length, time, climb and how it's drawn, the end with the arrival time) is the content the cards' style belongs on, and it's the hardest to reach. Check's row above the numbers moves them when it arrives. The profile is in sight only at half.

## The steps: the PR queue (2026-11-04)

The order chosen on 2026-11-04 after step A (#743) and the Edit and Done step (#750, #745) were built and tried, the cards audit (#749), the Komoot reference (#754), the text review (#763) and the user's review of them. One PR each, tried on the phone before the next starts; each is visible on the first screen, and none touches the toolbar again. Findings from the audit and the text review are slotted after these, not into them. The Project's Now column holds the same order; this list is the record.

| # | PR | Issue | What a person sees |
|---|---|---|---|
| 1 | One header in both modes | #751 | no title row after Done, no editing hint |
| 2 | The route's list says things once | #764 | no hint, no second numbers line; Start and the first stretch in sight at half |
| 3 | A warning takes the key fact's slot, in every layout | #741 | the line under the numbers says the warning, both docks too; nothing moves when Check answers |
| 4 | The speed beside the numbers | #755 | "Normal · 16 km/h" in the numbers row, tap to change |
| 5 | Hide the route for a moment | #756 | an eye on the toolbar |
| 6 | Check said once | #765 | what it found first, the verdict with nothing to read, the sources folded when all answered |
| 7 | One chart: Check's bars become the profile's legend | #758 | Colour by with lengths; On the route gone or two bars, one Selected |
| 8 | A compact profile at the peek | #742 | the route's shape where Hardest climb was |
| 9 | Go, folded | #766 | the time with its table behind a ›, the weather for the trip, "after dark" with the time |
| 10 | One chart: Go's weather on the profile | #759 | the weather along the route on the chart; Go as leave, arrive, one line, take it along |
| 11 | A spot's popup: five facts, one action | #760 | the same small card for a spot and a point, every action in sight |
| 12 | The route's list, rethought | #761 | a brainstorm first, then its PRs |

Beside the queue, as Fix PRs in the month's milestone whenever a session is free: #767 (sentence-case headings, nothing under 12 px), #753 with the toolbar's tooltips, #752 (the sports line's climbing). The text review that found them is `docs/reviews/2026-11-04-planner-text.md` (#763).

Built so far, before the queue:
- **A. The route before its settings (#740).** The Route tab's order becomes the route's list, then How you go and Your speed, then the hint. Nothing else moves. The PR tries a route of 30–50 points and decides from that whether the list folds to Start, the newest or selected stretch and the end, with one row for the rest.
  *Built (#743):* the list, then How you go and Your speed (beside the list in the wide bottom dock), then the hint; Back from a step brings its row into sight under the list. No fold: a 40-point MTB route around Tampere (14.5 km, local BRouter) still shows three rows, Start, one stretch "via 38 shaping points" and the end, 499 px at the phone's half as with four points, since the shaping points already fold under their stretch (25d part 4). The whole list (41 rows, 2576 px) shows only after **Show the 38 shaping points**. A tap on the map adds a shaping point too. The list grows with the points you see: with 10 of the 40 named it was 23 rows, 1532 px, about two screens at half; names, stops, nights, a change of sport and a change of how a leg is drawn each make a point a row. Those are rows the person chose, so they stay. Not tried: many stops or nights, each a section of its own.
- **A2. Edit and Done in one place, and the cards work in both modes (#745).** Edit and Done get the same stable place on phones as on desktops, in the toolbar as it is, with the editing state shown; they decide only whether a tap on the map adds a point, so Move, Remove, Edit this stretch and the other actions work from a card in either mode and the "You're not editing" notes go. Clear route's place in the phone's More menu is checked against the desktop's. Not a toolbar redesign.
  *Built (#750):* the toolbar is main's, with Done (or Edit, in the same place) as the phone's toolbox's first button, as on desktops. Where that makes the toolbox too wide to sit beside the map's buttons (390 and 430 px), they rise above it, as over the line at 200 %, and it still shows the route's actions that fit in the window's width; it docks at full as on main. After Done the toolbar is Edit and More only, on phones and desktops; on a phone at full they're at the left of ⌄'s row. More has one order: the whole route, Take it along, then Round trip, Import and Clear route, Clear route last; Round trip and Import are never on the toolbar. Where even without the route's actions the toolbox is wider than the window (360 px, 200 %), there's less room around its words first, then the drawing button shortens, and only then does it take a second row. The numbers' row keeps Done's 44 px, so the peek changes once when Check's row arrives. Every card has the same actions in both states, an edit from a card keeps the state, Move's answering tap no longer opens the map's card too, the lock notes are gone, and drags stay editing-only. Built after several rounds of trying other toolbars on the phone (a docked toolbox, a bar across the width, the desktop's toolbar from 721 px), which read worse than main's (2026-11-03).
- **One header in both modes (#751).** *Built:* no title row after Done, so the peek is the same height in both modes (195 px on a 390 phone with a four-point MTB route); ✕ at the numbers row's end on wider screens and the folded line's on a phone; a route's own name in Route's list's first row; the drawing hint gone.
- **The route's list says things once (#764).** *Built:* no "Tap a point or a stretch" hint (Reorder's own hint stays while reordering); a route of one section has its heading beside Reorder, where the hint was, without a numbers line under it (several sections keep theirs); Start and End without their distance. The weather, said nowhere else in Route, moved from each section's chip onto the rows of its places: Start's ("Leave now · 2° · 4 m/s"), each section's last row as you get there ("There at 10:10 · 4° · 3 m/s"), a night's tag with the morning's; its tap's wind direction is in the profile's wind colours and Go. At 390 × 844 at half (four-point MTB route, no warning), Start ends at 802 px and the first stretch's title at 827, the sheet's foot at 836: the stretch's title and chevron are in sight, its second line just under the foot. With a warning in the list (the "In the dark" row, about 64 px) they're below the fold: #741 moves it into the key fact's slot. Where 12em don't fit beside Reorder (200 %), Reorder goes under the heading.

Later, with their own design: Avoid as a resizable circle (#708), Look around here (#757), the settings' home, More's order, the desktop docks, the profile's whole-screen mode.

## Later pieces, one at a time, each its own brainstorm

Not designed here; listed so they aren't lost. Each starts from the app as it is after the step before.

- The settings' home: How you go and Your speed out of Route once the toolbar and Go carry them in every layout.
- More's order and Clear route's place, the same on phones and desktops, or different for a reason that's said.
- The phone's toolbar across the planner's width under the map's buttons, as an alternative to moving it.
- The desktop side dock anchored at the bottom, or full height with fixed controls and a scrolling middle; the bottom dock's content in columns.
- The profile's own step: compact, half, whole screen; the map following a finger on it.
- Check's verdict and Go's first screen (Leave now ▾ in the numbers row); the stretches with the cards' facts (#690).
- The instructions: which grey lines go, which labels replace them.
- The route's list rethought (#761): its mock-up and plan are in [issue-761-route-list.md](issue-761-route-list.md) (2026-11-04).

## Ideas to test on the way

From other tools and Polku's own features; none is decided.

- The newest stretch lit in the list as you draw, without the list scrolling.
- Komoot's surface and way-type bars under the profile while drawing: Polku's On the route breakdowns with Colour by, as one bar.
- Ride with GPS's cue sheet: the stretch list with turn facts, once the cards' facts reach stretches.
- The list folded with many points: Start, the stretch you're on, the end, and "12 stretches ›" between.
- A departure chip in the numbers row, Leave now ▾, as the start's visible departure control.
