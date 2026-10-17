# Phase 24: design review

The design, and what the review did (at the end). What's still to do, and its status, is on GitHub: [Phase 24: design review](https://github.com/TommiContursi/Polku/milestone/1), phase issue #177. The order of phases is in [ROADMAP](../ROADMAP.md).

Planned 2026-10-15 in ROADMAP ([the last full ROADMAP](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/ROADMAP.md)): research first, no code. Updated 2026-10-16: the review centres on how easy the route planner is to use, on a phone and a desktop, with design skills for coding agents that are now installed.

## Why

Polku has grown one phase at a time, each designed on its own. An idea from testing (2026-10-15) was to look at the whole of it once, on a phone and on a desktop, with the design guidance that now exists as skills for coding agents.

The planner most of all. It shows most of what it can do at once, and some of it in two or three places (measured below), so drawing feels crowded. Small things found in testing point the same way: the sheet that's hard to swipe (#96), the map that didn't always fit above it (#88).

## The rules for what it proposes

- **Nothing Polku does is removed.**
- **Nothing used today takes more taps, more scrolling or a new hidden view.** What moves, moves to where it's used, not behind something else.
- **What you do most while drawing stays one tap and in thumb reach:** adding and moving points, undo, redo, the routing mode, Done.
- **Each thing is shown once, where it's used.**
- **A control shows when it can do something:** no undo before there's anything to undo.
- **The map comes first.** While drawing, as much of it as possible is in view.
- **Measured before and after,** with the same numbers as below, at 390 × 844 and 1440 × 900.

## The skills

Installed on 2026-10-16 in the main checkout's `.claude/skills/`: Emil Kowalski's set ([emilkowal.ski/skill](https://emilkowal.ski/skill)). Claude Code loads them by name; Codex can read their `SKILL.md`. Four of them were first used on the quick layer drawer's mock-up (#123, [its review](issue-123-layer-drawer.md#the-design-review-of-the-mock-up-2026-10-16)), where they found real breaks that a normal look had missed.

| Skill | What the review uses it for |
|---|---|
| apple-design | The structure: purpose; simplicity (not minimalism); familiarity; wayfinding (where am I, how do I get out); grouping and mapping (a control near what it changes). Also the sheet's gestures (#96). |
| emil-design-eng | The details and how they feel: press feedback, what animates and how fast. Its findings go in Before / After / Why tables. |
| mobile-native | The phone's platform layer: the tap flash and hover colours that stay (#208); the notch and the home indicator (#134); zoom (#73); inputs under 16 px that zoom the page on iOS; the viewport's height. |
| break-ui | Worst-case data: long place names as waypoint names, 30 or more waypoints, a 300 km route over several days, Finnish and Swedish (phase 18), 360 px wide, 200 % zoom. |
| review-animations, improve-animations, find-animation-opportunities | The motion: the sheet, changing tabs, the lit leg, map moves, toasts; what should move and what shouldn't. |
| animation-performance | Frames while dragging the map or the sheet on a mid-range Android, and the profile that grows when a drag starts (#96). |
| prototype | Two or three versions of the planner's header side by side, behind a picker, to compare before choosing. It runs only when asked for. |
| animate, animation-vocabulary | For the phases that build what the review decides, and for naming effects in issues. |

**Not used:** animate-expo (React Native), write-swift, ask-sonner (a React toast library), and pick-ui-library (Polku takes no new dependencies).

**Impeccable** ([impeccable.style](https://impeccable.style)) was installed for the user on 2026-10-17 and loads in any session: `/impeccable audit`, `/impeccable critique` and its detector (`impeccable detect`). The review used its audit and detector as one more pass; its critique needs two separate agents and is left for the user to run.

## The route planner first

The review follows the moments of planning from 22a ([its table](22-drawer.md)):
- the start: an idea, a round trip, a marked route, an import;
- drawing;
- checking;
- setting off;
- on the way (phase 23);
- afterwards.

### Where it stands (measured 2026-10-16, at 2333453)

**On a phone,** at 390 × 844, with a 3 km MTB route (`tools/fixtures/route-kauppi-mtb.json`):

| The sheet | Map in view | Controls on screen | In the sheet |
|---|---|---|---|
| The start, no point yet (peek) | 81 % | 18 | 12 |
| Peek | 81 % | 19 | 13 |
| Profile | 66 % | 18 | 12 |
| Half | 49 % | 39 | 33 |
| Full | 8 % | 47 | 45 |

**On a desktop,** at 1440 × 900 with the side panel: 57 controls on screen, 46 of them in the panel.

**Shown twice or three times at once:**
- the sport: the top bar's sport pill, and the planner's sport picker;
- closing the planner, on a desktop: the search bar's button, the panel's Done, and the Done button by the map;
- the route's colours: the header's "Colour the route by", the profile's "Colour by" with its On map switch, and Check's breakdowns ("Use colours"), each with the same eleven or twelve choices;
- Round trip: the header's chip, and Route's tools;
- the route style: the header's style chip, and How you go;
- Export GPX, share link and save offline: ⋯, and Go's Take it along (on purpose since 22a, so they're there from any tab);
- the time: the summary, and Go's tab.

**Shown before they can do anything:** undo, redo and "Show the whole route" at the start, before any point, and the route's colour picker with no route.

**On the map while drawing:**
- each distance mark carries two lines of time ("2 km · 23:06", "9 min 11 s elapsed");
- the "Zoom in to see every trail" hint stays while planning.

**In the list:** every waypoint row has five controls: the leg's settings, a stop, earlier, later and remove.

**At half on a phone:** the sheet covers the lower half of the route, and the map's buttons sit on top of it. Raising the sheet doesn't frame the route again (#96).

**Taps on a phone,** from a drawn route at peek:

| To | Taps | How |
|---|---|---|
| Undo, redo | 1 | the tools row |
| Change the routing mode | 1 | the tools row |
| Change the sport | 2 | the sport picker, then a sport |
| Change the route style | 2 | the style chip, then a style |
| Make a round trip from here | 2 or more | Round trip, then a length and a loop |
| Clear the route | 2 | ⋯, Clear route |
| Export GPX, copy the share link, save offline | 2 | ⋯, then the item |
| Set the departure, see the weather | 1–3 | "from now", or Go |
| See the climbs and Heads-up | 2 | raise the sheet, Check |
| Close the planner | 1 | Done |

The common tasks are all near. The trouble is density and repetition, not depth. Polku's peek is even shorter than Strava's sheet (below), but holds 13 controls in three rows. So the aim is a calmer screen with the same number of taps or fewer.

### The benchmark: Strava's route builder (looked at on a phone, 2026-10-16)

- **The start:** a nearly empty sheet, with the sport, one line ("Tap the map to add points") and a picture.
- **While drawing:** the map keeps about 60 % of the screen. Four round buttons float just above the sheet, at the thumb: ⋯, the drawing mode, undo and redo. The sheet holds:
  - the sport;
  - three numbers (distance, climb, time);
  - the elevation profile, with the surface marked on it;
  - a paved / unpaved split;
  - one big action, Save.
- **Routes nearby** are a place of their own (Maps, with filter chips); drawing is its own screen.

Strava does much less than Polku: no water routing, route styles, weather along the route, Heads-up, stops or offline maps. So it's a benchmark for calm and for where things sit, not for features.

### Ideas to try (not decisions)

For the review to try in mock-ups (like #123's), with variants where the choice isn't obvious, and for the user to choose from:
- **The start:** the start choices (draw, round trip, a marked route, import) in the peek itself. The drawing tools come with the first point.
- **While drawing:** undo, redo, the routing mode and ⋯ as a short row floating at the thumb, above the sheet, as in Strava. The peek then holds the numbers and Done: more map, with the same taps.
- **One place for each thing:**
  - one sport control while planning;
  - one colour choice for the route and the profile together, with "on the map";
  - Round trip and the route style once each, where they're found first;
  - one Done on a desktop.
- **The map while drawing:** distance marks without the times (they're in the hover and in Go); no zoom hint while planning.
- **Waypoint rows:** the controls of the row you're on, the others quiet. A tap on a row shows its controls, so there's no new view.
- **The sheet frames the route when it rises** (#96).
- **Keyboard and screen readers:** the same order as on screen.

Each one is measured against the tables above. None removes a feature or adds a step.

### The rest of Polku

After the planner:
- opening Polku;
- the layers (#123, designed);
- Settings;
- search;
- the timeline and weather;
- out on the trail (23a's heading).

The same skills and the same rules apply, at 390 × 844 and 1440 × 900, in light and dark.

## How

1. **The starting point:**
   - screenshots (`tools/shoot.py`) and the numbers above, from a small script kept as evidence, as `docs/reviews/2026-10-15/evidence/` did;
   - at 390 × 844 and 1440 × 900, in light and dark;
   - in MTB, hike and paddle, with a route drawn and the timeline open.
2. **The tasks, walked with the skills:**
   - as a phone user: touch, one thumb, outdoors;
   - as a desktop user: mouse and keyboard;
   - the worst case with break-ui.
3. **Mock-ups of what's worth changing,** clickable, in `docs/plans/mockups/` like #123's, with variants where the choice isn't obvious (prototype). The user chooses.
4. **Real phones** (iOS and Android) for the swipe, how taps feel, and the safe areas: the browser's device emulation can't show them.

## The outcome

- **A report** in `docs/reviews/<date>-design/`: screenshots, the numbers before and after, and each finding with the skill that found it.
- **Each finding worth doing** becomes an issue labelled `enhancement`, or goes into the phase it belongs to (21, 22b, 20). If the planner's layout changes belong together, they're one phase of their own after 24, with the user's OK.
- **ROADMAP updated.**
- **No app code in phase 24 itself,** only mock-ups and the scripts that measure.

## In this milestone

- #96: the sheet's swipe, now one swipe for every sheet ([#123's plan](issue-123-layer-drawer.md#one-swipe-for-every-sheet-with-96));
- #123: the quick layer drawer, designed in [its plan](issue-123-layer-drawer.md);
- #73: zoom and enlarged text;
- #134: the notch.

Related: #208 (taps and hover on phones).

## Not in it

- Removing features, or making anything used today take more taps, more scrolling or a new hidden view.
- A redesign for its own sake.
- A new framework, dependency or build step.
- A generic look in place of Polku's own: the map first, plain words.
- Regrouping the full Layers panel (phase 21).

## What the review did (2026-10-17)

By Claude Code on `claude/phase-24-design`. The report is [docs/reviews/2026-10-17-design/](../reviews/2026-10-17-design/README.md), with its evidence and pictures.

- **The quick layer drawer (#123) first:** its four questions answered in [its plan](issue-123-layer-drawer.md#phase-24s-answers-2026-10-17) (short phones, Finnish words, Edit's switches, the swipe built in the mock-up with its numbers left to real phones), the 3D button (#226) placed, a test list for real phones, and the mock-up's private page updated. Its build, with `js/sheet.js` for #96, is the next PR in this milestone.
- **A journey script as the baseline** ([`journey.py`](../reviews/2026-10-17-design/evidence/journey.py)): one connected run through the planner with real taps and drags, the state checked after each step, at both sizes, plus a round trip, Ride this route and a 30-point route. An addendum to this plan on 2026-10-17 asked for it, with the five main problems, a test script for people and at most three blind agent runs.
- **The five main problems,** with their root causes and alternatives, in the report: the first point's card (#232), small and crowded controls on phones (#233), panels opening above the screen (#240), the sheet (#96), and what's shown twice (#233, #241).
- **Mock-ups:** [the planner](mockups/phase-24-planner.html) with two variants (A, one place each; B, the tools at the thumb), two ways for the waypoint rows and two for the moment after the first point; measured with the same rules as the app.
- **The user's choice (2026-10-17):** B, with a lower peek (one row) and a floating toolbox on the desktop too; only the row you're on shows its buttons; the chip by the start, leading to a loop of any length; and the ⋯ menu designed again, in three versions still to choose from. The mock-up shows them; the report has their numbers.
- **Issues:** seven bugs in Fixes 2 (#239–#245), six improvements and ideas (#232–#238), the calmer planner (#233) proposed as a phase of its own; comments on #73, #96, #134, #208; findings added to phases 18, 20, 21 and 22b.
- **For people and phones:** a test script for three to five people in the report, and the drawer's test list for iOS and Android.

