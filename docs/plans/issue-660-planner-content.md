# The planner's content (#660): what it shows while you build a route

The direction chosen on 2026-11-03, from a brainstorm on the planner's content and information hierarchy, after the cards (#623) went live. It replaces the stages of #660's first draft and the toolbox-first reading of [the usability assessment](../reviews/2026-11-03-usability.md); [issue-660-tap-and-toolbox.md](issue-660-tap-and-toolbox.md) and its mock-up (#723) are research, not a plan. This plan is short on purpose: one meaningful problem at a time, the smallest worthwhile improvement, one PR each, tried in the app before the next is designed. Findings on the way become issues, not scope.

## The direction

- **Content first.** The planner shows the route, its points and stretches, the facts that matter now and the findings you can act on. Detail lives in the cards. What the planner shows should follow what you're doing (building, refining, exploring, checking, preparing), and a late answer (Check, the weather, routing) may change words but never moves the controls or rearranges the planner.
- **Less at once.** The main problem is how much the planner shows at the same time, not only the order. Settings already made (the route style, your speed) aren't repeated prominently in Route: their home is the toolbar and the menus, with a way in from the context when needed. Small grey instructions that explain what should be obvious go; labels get better instead. Safety notes stay.
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

## The steps

Each is one PR, tried on a phone and in both docks before the next step's details are decided.

- **A. The route before its settings (#740).** The Route tab's order becomes the route's list, then How you go and Your speed, then the hint. Nothing else moves. The PR tries a route of 30–50 points and decides from that whether the list folds to Start, the newest or selected stretch and the end, with one row for the rest.
  *Built (#743):* the list, then How you go and Your speed (beside the list in the wide bottom dock), then the hint; Back from a step brings its row into sight under the list. No fold: a 40-point MTB route around Tampere (14.5 km, local BRouter) still shows three rows, Start, one stretch "via 38 shaping points" and the end, 499 px at the phone's half as with four points, since the shaping points already fold under their stretch (25d part 4). The whole list (41 rows, 2576 px) shows only after **Show the 38 shaping points**. A tap on the map adds a shaping point too. The list grows with the points you see: with 10 of the 40 named it was 23 rows, 1532 px, about two screens at half; names, stops, nights, a change of sport and a change of how a leg is drawn each make a point a row. Those are rows the person chose, so they stay. Not tried: many stops or nights, each a section of its own.
- **A2. Edit and Done in one place, and the cards work in both modes (#745).** Edit and Done get the same stable place on phones as on desktops, in the toolbar as it is, with the editing state shown; they decide only whether a tap on the map adds a point, so Move, Remove, Edit this stretch and the other actions work from a card in either mode and the "You're not editing" notes go. Clear route's place in the phone's More menu is checked against the desktop's. Not a toolbar redesign.
  *Built (#748):* Done and Edit are the toolbox's first button on phones as on desktops, in one place editing or not. With Done in it, a phone's toolbox (360 px at 390 px wide, the map's buttons from 324 px) no longer fits above the sheet, so on most phones it's the sheet's first row, and the route's view docks wherever editing would; the peek grows by that row. No tick on Done: it made the desktop toolbar 24 px wider and folded it sooner at 1024 and 1280 px. The editing state shows as the drawing button, undo and redo beside Done, and Edit's pencil alone after it. Every card has the same actions in both states, an edit from a card keeps the state, and Move's answering tap no longer opens the map's card too. The lock notes are gone. Drags stay editing-only. More keeps one order (#594): Clear route farthest from the thumb on a phone, and also a toolbar button on a desktop.
- **B. A state line at the peek that never moves (#741).** One fixed row under the numbers says what Check knows: "Checking the route…", "Nothing to read before you go", "3 to read before you go ›". It replaces the row above the numbers; the groups, the markers and the ‹ › row stay.
- **C. A compact profile at the peek (#742).** The Hardest climb row becomes a strip of the route's shape with the climbs' markers and the hardest climb as its caption; a tap opens the profile at half.

## Later pieces, one at a time, each its own brainstorm

Not designed here; listed so they aren't lost. Each starts from the app as it is after the step before.

- The settings' home: How you go and Your speed out of Route once the toolbar and Go carry them in every layout.
- More's order and Clear route's place, the same on phones and desktops, or different for a reason that's said.
- The phone's toolbar across the planner's width under the map's buttons, as an alternative to moving it.
- The desktop side dock anchored at the bottom, or full height with fixed controls and a scrolling middle; the bottom dock's content in columns.
- The profile's own step: compact, half, whole screen; the map following a finger on it.
- Check's verdict and Go's first screen (Leave now ▾ in the numbers row); the stretches with the cards' facts (#690).
- The instructions: which grey lines go, which labels replace them.

## Ideas to test on the way

From other tools and Polku's own features; none is decided.

- The newest stretch lit in the list as you draw, without the list scrolling.
- Komoot's surface and way-type bars under the profile while drawing: Polku's On the route breakdowns with Colour by, as one bar.
- Ride with GPS's cue sheet: the stretch list with turn facts, once the cards' facts reach stretches.
- The list folded with many points: Start, the stretch you're on, the end, and "12 stretches ›" between.
- A departure chip in the numbers row, Leave now ▾, as the start's visible departure control.
