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

## The steps: the PR queue (2026-11-04)

The order chosen on 2026-11-04 after step A (#743) and the Edit and Done step (#750, #745) were built and tried, the cards audit (#749), the Komoot reference (#754) and the user's review of them. One PR each, tried on the phone before the next starts; each is visible on the first screen, and none touches the toolbar again. Findings from the audit and the text review are slotted after these, not into them. The Project's Now column holds the same order; this list is the record.

| # | PR | Issue | What a person sees |
|---|---|---|---|
| 1 | One header in both modes | #751 | no title row after Done, no editing hint |
| 2 | A warning takes the key fact's slot | #741 | the line under the numbers says the warning; nothing moves when Check answers |
| 3 | The speed beside the numbers | #755 | "Normal · 16 km/h" in the numbers row, tap to change |
| 4 | Hide the route for a moment | #756 | an eye on the toolbar |
| 5 | One chart: Check's bars become the profile's legend | #758 | Colour by with lengths; On the route gone or two bars |
| 6 | A compact profile at the peek | #742 | the route's shape where Hardest climb was |
| 7 | One chart: Go's weather on the profile | #759 | Go as leave, arrive, one weather line, take it along |
| 8 | A spot's popup: five facts, one action | #760 | the same small card for a spot and a point, every action in sight |
| 9 | The route's list, rethought | #761 | a brainstorm first, then its PRs |

Built so far, before the queue:
- **A. The route before its settings (#740, PR #743, merged 2026-11-03).** The route's list first; no fold needed: shaping points already fold under their stretch.
- **A2. Edit and Done in one place (#745, PR #750).** Main's toolbar with Done or Edit as its first button on phones, the map's buttons rising above it where it's wide; after Done, Edit and ⋯ only; the cards work in both modes; the lock notes gone; drags stay put after Done; Round trip, Import and Clear last in ⋯. Three toolbar designs were built and rejected on sight before this one (a docked row, a bar across the width, a pill): the lesson of #623 again, recorded in the retro when the milestone closes.

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

## Ideas to test on the way

From other tools and Polku's own features; none is decided.

- The newest stretch lit in the list as you draw, without the list scrolling.
- Komoot's surface and way-type bars under the profile while drawing: Polku's On the route breakdowns with Colour by, as one bar.
- Ride with GPS's cue sheet: the stretch list with turn facts, once the cards' facts reach stretches.
- The list folded with many points: Start, the stretch you're on, the end, and "12 stretches ›" between.
- A departure chip in the numbers row, Leave now ▾, as the start's visible departure control.
