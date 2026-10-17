# Phase 24: design review (2026-10-17)

Polku looked at as a whole, on a phone and a desktop, centred on the route planner, as [phase 24's plan](../../plans/24-design-review.md) asks. Research, mock-ups and issues only: no app code. By Claude Code on the branch `claude/phase-24-design`, phase issue #177.

- **The app measured:** `20f0310` (the starting point, `evidence/measure.py`); the journey script ran on `main` at `87a9b07`.
- **Sizes:** 390 × 844 and 1440 × 900, with 360 × 740, 375 × 667 and a 390 phone at 200 % zoom where it mattered; light and dark; MTB, hike and paddle.
- **The skills:** Emil Kowalski's design skills (apple-design, emil-design-eng, mobile-native, break-ui), loaded with the Skill tool from the main checkout's `.claude/skills/` (they reached `main` in #230 during the review); Impeccable's audit and its detector, on the files and on the running app. Not run: review-animations, improve-animations and find-animation-opportunities (only the user can start them: `/review-animations`); Impeccable's critique (it needs two separate agents, which this session didn't start unasked); prototype (the variants were built by hand in the mock-ups).
- **Pictures** are on the `pr-screenshots` branch under `claude/phase-24-design/`: `before/` (the app today), `after/` (the mock-ups), `findings/`.

## In short

**The five main problems**, ranked by how much they get in the way, how often and how sure the evidence is:
1. **The first point's card covers where the next point goes** (#232). Four points took nine taps on a phone in the journey.
2. **On a phone the planner's controls are small, and all on screen at once** (#233). Every one is 28–37 px; Polku's own drawer and Apple's guidance are 44 px.
3. **Settings and Layers open above the top of the screen** when the planner's sheet is raised on a phone (#240): their ✕ can't be reached.
4. **The sheet is hard to move, and raising it hides the route** (#96): it moves only from a small handle, and doesn't frame the route when it comes to rest.
5. **The same thing in two or three places, and controls before they can act** (#233, #241): the sport, the colour, Round trip, the route style twice; three ways to close the planner on a desktop; undo and redo looking ready with nothing to undo.

**What works and must stay:** see [below](#what-works-and-must-be-protected).

**What needs people or real phones:** marked in each problem, and listed [below](#what-needs-people-or-real-phones). There's a [test script for people](#a-test-script-for-people) and a [test list for real phones](../../plans/issue-123-layer-drawer.md#on-real-phones).

**What comes next:**
- **#123's build** (the quick layer drawer, with `js/sheet.js` fixing #96), its four open questions answered: [its plan](../../plans/issue-123-layer-drawer.md#phase-24s-answers-2026-10-17).
- **A calmer planner (#233), proposed as a phase of its own,** with two variants to choose from in [the mock-up](../../plans/mockups/phase-24-planner.html).
- **Seven bugs** in "Fixes 2": #239, #240, #241, #242, #243, #244, #245. **Six improvements and ideas:** #232, #234, #235, #236, #237, #238.
- **Into their phases:** typeface and text sizes (20), the Layers panel's headings (21), one Done on a desktop (22b), soft hyphens in translations (18).

## 1. The quick layer drawer (#123) and the one swipe (#96)

First, as the plan asks. The drawer's design was agreed in #217; it waited on four questions. The answers, with their measurements, are in [the drawer's plan](../../plans/issue-123-layer-drawer.md#phase-24s-answers-2026-10-17):

| Question | Answer |
|---|---|
| The sheet's height on small phones | Tighter under 760 px high: 58 % of 360 × 740 (from 66 %), 62 % of 375 × 667 (from 73 %); 66 % and 69 % in Finnish |
| Short Finnish words beside a › | 72 px for the label at 360 px (from 62), soft hyphens at compound boundaries, `hyphens: manual`: no break mid-syllable, "Sadetutka" fits |
| Which switches Edit offers | Every layer switch of the full panel, in its groups (30), except what has its own place |
| The swipe's numbers | Built and driven with touch events in the mock-up (a trap found for `js/sheet.js`: a bubbling `lostpointercapture`); the numbers wait for real phones, with a Swipe numbers panel on the [private page](https://claude.ai/artifact/BkPy7oGi6r77kLJmt5qMzh) |

**The 3D button (#226):** with compass, locate and zoom (how you look at the map), not between Weather and Layers; it fits on every phone measured (53 px of room at 375 × 667 with the sheet at half, the tightest); with it, the drawer has no 3D tile and MTB's fifth tile becomes Waymarked MTB.

## 2. The baseline: one connected journey

[`evidence/journey.py`](evidence/journey.py), built on `tools/cdp.py` like the smoke tests: one continuous run through the planner as a person makes it, with real taps and drags (touch on the phone, a mouse on the desktop) on the controls found by their labels, and the state checked through `window.polku` after each step. Routing on the local BRouter and the recorded LIPAS answers only. After each step it records taps or clicks, drags, scrolls, switches of panel and tab, the map in view and the controls on screen. The full output is [`evidence/journey-main.json`](evidence/journey-main.json), its log [`journey-main.log`](evidence/journey-main.log).

JOURNEY_TABLE

**What the journey showed, beyond the numbers:**
- **The first point's card eats taps** (problem 1). On a phone the second tap landed on the card's title (`st-title`) and added nothing; the card is about 355 × 185 px beside the start ([today](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/phase-24-design/before/phone-start-card.jpg?raw=true)).
- **Settings opened above the screen** with the sheet at half (problem 3): its ✕ was at y = −101 px, so the run couldn't close it the obvious way.
- **On a desktop a click on the sport pill closed its menu** (#245): the hover opens it, the click toggles it shut.
- **Layers, Heads-up and Avoid, the departure, the weather along the route, Take it along** were all reachable and did what they say; the route and the sheet came back as they were after Layers; a removed point came back with Undo; after a reload the route was back, but the planner was closed (#238).
- **Where the script's first versions failed, it was the script** (a point off screen, a tap under the map's buttons, a start under the raised sheet): fixed, and not counted as findings. A few steps can't be judged by a script at all (how a swipe feels, whether a word is understood): those are for people.

## 3. The five main problems, in depth

### Problem 1: the first point's card covers where the next point goes

- **What the person wants:** tap the start, then the next place, then the next.
- **What happens:** after the first point a card opens beside the start ("Start · Tap the next place on the way, or make a loop from here: 10 km, 20 km, 30 km"). On a 390 × 844 phone it covers about 355 × 185 px of map, the area right of and below the start, where the next point usually goes. A tap on it does nothing for the route; its ✕ is 26 px. In the journey, four points took nine taps.
- **Why the design causes it:** the loops from the start are offered at the place they start from, which is also where the next point goes. The card asks for a tap on the map while covering it.
- **Root cause:** layout (an offer placed over the content it's about), and interaction (the card's area swallows the next tap).
- **What should change:** the loops stay one tap away and the map stays free. **What must stay:** loops of 10, 20 and 30 km from the start in one tap; "Tap the next place" as the guidance.
- **Two alternatives** ([the mock-up, section 1b](../../plans/mockups/phase-24-planner.html)): the loops in the peek, no card ([picture](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/phase-24-design/after/phone-first-peek-a-one.jpg?raw=true)); or a small "Loop from here" chip by the start, 140 × 44 px ([picture](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/phase-24-design/after/phone-first-chip-a-one.jpg?raw=true)). The first gives up nothing pointing at the start; the second gives up one tap (a loop takes two) and still covers a sixth of the card's map. **Recommended: the peek.** On the same journey both take four taps for four points, as against nine.
- **Evidence:** journey step "Add four points on the map"; the card's code at `js/planner.js:3520-3530`; skills: apple-design (grouping and mapping), break-ui (the 30-point run).
- **Needs:** people (do they read the card, do they try to tap through it?).
- **Issue:** #232.

### Problem 2: on a phone, the planner's controls are small and all at once

- **What the person wants:** draw with one thumb, outdoors, maybe in gloves; find the tool they need without reading the whole sheet.
- **What happens:** the peek shows 12–13 controls in three rows; each one is 28–37 px (the drawing tools 30–37 × 32, the chips 28–30 tall, Done 34). At half, every waypoint row has five 28 × 28 buttons side by side; the sheet's handle is 72 × 18, the departure 85 × 18 (both under WCAG 2.2's 24 px minimum). `measure.py` counts 18 controls under 44 px at peek and 33 at half.
- **Why the design causes it:** each phase added its control where it was built; the header grew to fit them by shrinking them (`fitHeader`, `js/planner.js:745`, makes them icon-only and smaller as room runs out).
- **Root cause:** layout and grouping (everything at the same level, some of it twice: problem 5).
- **What should change:** 44 px targets, fewer at once, the drawing tools at the thumb. **What must stay:** undo, redo, the routing mode and Done one tap away while drawing; nothing behind a menu; every feature.
- **Two variants** in [the planner's mock-up](../../plans/mockups/phase-24-planner.html), measured with the same rules ([§4](#4-the-numbers-before-and-after)):
  - **A, one place each:** the same three rows, without what's shown twice; every control 44 px. Gives up: the peek is 18 px taller (80.7 % of the map in view instead of 82.7 %).
  - **B, the tools at the thumb:** the routing mode, undo and redo float above a two-row sheet, at the bottom left, clear of the map's buttons. 86.1 % of the map in view. Gives up: a floating toolbar over the map, and the tools further from the numbers.
  - **Waypoint rows, two ways:** every row's five buttons at 40 px, or the row you're on with all five at 44 px and the others with Remove only. The second gives up one tap to reach another row's buttons.
- **Evidence:** `measure-before.json` (small targets per scene), [peek today](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/phase-24-design/before/phone-mtb-peek.jpg?raw=true), [A](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/phase-24-design/after/phone-peek-a-one.jpg?raw=true), [B](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/phase-24-design/after/phone-peek-b-one.jpg?raw=true); skills: emil-design-eng (targets, press), apple-design (simplicity, hierarchy), Impeccable's audit.
- **Needs:** people and real phones (A or B; whether 44 px feels calmer or just bigger; the waypoint rows).
- **Issue:** #233 (proposed as a phase).

### Problem 3: Settings and Layers open above the top of the screen

- **What the person wants:** while planning, open Settings or Layers, change something, close it.
- **What happens:** with the planner's sheet at half on a 390 × 844 phone, Settings opens with its top at −113 px: its heading and ✕ are above the screen ([picture](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/phase-24-design/findings/settings-over-half-sheet.jpg?raw=true)). With the sheet at peek it fits. Layers uses the same rule.
- **Why:** on phones a panel sits above the sheet with `max-height: 62vh` (`css/app.css:1121`); 62 % of the screen plus the sheet's height is more than the screen.
- **Root cause:** code.
- **What should change:** the panel's height stays within the room above the sheet and below the top bar, its body scrolls, its ✕ stays on screen. **What must stay:** Settings and Layers reachable while planning, the sheet as it was after.
- **Evidence:** journey step "Mistake: Settings opened instead of Layers" (the ✕ off screen), `measure.py`'s panel boxes; skills: break-ui (the raised sheet as the worst case), mobile-native.
- **Needs:** nothing more; it's measured.
- **Issue:** #240 (a bug, small; Fixes 2).

### Problem 4: the sheet is hard to move, and raising it hides the route

- **What the person wants:** pull the sheet up to see more, push it down to see the map, with a flick, from wherever their thumb is.
- **What happens:** the sheet moves only from its 72 × 18 handle and the gaps between the header's buttons; it changes its height (not a transform) and snaps by position, with no flick. Raising it covers the lower part of the route until Show the whole route. In the journey every raise was a drag on the handle, and a sheet folded by accident took a drag back.
- **Why / root cause:** interaction (the drag area, no momentum) and feedback (no framing at rest), from phase 1's three sizes (now four).
- **What should change:** the one swipe designed in #123's plan, built once as `js/sheet.js`, and framing the route when the sheet comes to rest at a bigger size, if the map hasn't been moved by hand. **What must stay:** the four sizes; taps on the header's buttons stay taps.
- **Evidence:** #96; the mock-up's planner-sheet frame and `evidence/swipe_probe.py` (each gesture resolves as designed); skills: apple-design (direct manipulation, projection, interruptibility), emil-design-eng (transform, not height; `--sheet-h` once at the end).
- **Needs:** real phones for the numbers (the test list).
- **Issue:** #96, built with #123.

### Problem 5: the same thing in two or three places, and controls before they can act

- **What the person sees:** the sport in the top bar and in the planner; the route's colour in the header and again on the profile ("Colour by", at full and on a desktop); Round trip in the header and in Route's tools; the route style as the header's chip and as How you go's five chips; on a desktop three ways to close the planner (Plan in the search bar, the panel's Done, Done by the map). At the start, undo, redo and Show the whole route look ready but do nothing, and the colour picker shows with no route.
- **Why:** each phase gave its feature an entry where it was built; nothing gathered them afterwards. The start state isn't set until the first change (`js/planner.js:3988`).
- **Root cause:** grouping (and, for the start, feedback in the code).
- **What should change:** one place for each, where it's used: the colour with what it colours (or once in the header, see the trade-off in §4), the sport as the top bar's pill (which, while planning, shows the route's sport and re-routes as the planner's picker does), Round trip in the header, the style chosen once, one Done on a desktop. Controls disabled until they can act. **What must stay:** every one of these features, at the same number of taps or fewer.
- **Evidence:** `measure-before.json` (the desktop panel: 58 controls on screen), the plan's list of duplicates (2026-10-16), confirmed at `20f0310`; skills: apple-design (familiarity, consistency), Impeccable's audit.
- **Needs:** people (whether the sport at the top of the screen is found while planning).
- **Issues:** #233 (the calmer planner), #241 (the start's bug), 22b's plan (one Done on a desktop).

## 4. The numbers before and after

`evidence/measure.py` on the app (before) and `evidence/mockup_probe.py` on the mock-up (after), with the same rules: the map in view is the share of the screen not under the planner; controls are those that can be pressed and are on top somewhere (hit-tested), with how many are in the planner in brackets; "under 44 px" is counted on phones. Hit-testing skips covered controls, so these numbers are a little lower than the plan's own counts of 2026-10-16.

| The moment | Today: map in view · controls (planner) · under 44 px | A | B |
|---|---|---|---|
| Phone, the start (no point) | 83 % · 23 (13) · 19 | 80.7 % · 18 (8) · 6 | 80.7 % · 18 (8) · 6 |
| Phone, peek (MTB) | 82.7 % · 22 (12) · 18 | 80.7 % · 20 (10) · 6 | 86.1 % · 20 (10) · 6 |
| Phone, peek (paddle) | 82.7 % · 23 (13) · 19 | 80.7 % · 20 (10) · 6 | 86.1 % · 20 (10) · 6 |
| Phone, half (rows: the one you're on) | 52.1 % · 37 (27) · 33 | 52.1 % · 29 (19) · 8 | 52.1 % · 29 (19) · 8 |
| Phone, half (rows: all five) | 52.1 % · 37 (27) · 33 | 52.1 % · 30 (20) · 10 | 52.1 % · 35 (25) · 15 |
| Desktop, side panel | 75.1 % · 58 (45) | 75.1 % · 45 (34) | the same as A |

The six controls still under 44 px on a phone in A and B are outside the planner: the top bar's four (40 px) and the credits' (i), which #235 covers, and the sheet's handle (its real target is the whole header, with the swipe).

**Taps for the common tasks** (phone, from a drawn route at peek; the plan's table). A and B are counted from their design (the mock-up isn't wired), today's from the plan and the journey:

| To | Today | A | B |
|---|---|---|---|
| Undo, redo | 1 | 1 | 1 (floating) |
| Change the routing mode | 1 | 1 | 1 (floating) |
| Change the sport | 2 (the planner's picker) | 2 (the top bar's pill) | 2 |
| Change the route style | 2 | 2 | 2 |
| Make a round trip from here | 2 or more | 2 or more | 2 or more |
| Add the first points | 1 each, plus the card (9 for 4 in the journey) | 1 each (#232) | 1 each |
| Clear the route; export, share, save offline | 2 | 2 | 2 |
| Departure and weather | 1–3 | 1–3 | 1–3 |
| Climbs and Heads-up | 2 | 2 | 2 |
| Show the whole route | 1 | 1 (the map's buttons, while part is out of view) | 1 |
| Colour the route | 2 | 2 once the profile shows; a swipe up first from the peek | the same as A |
| Close the planner | 1 | 1 | 1 |

**One trade-off to decide:** with the colour beside the profile it colours, choosing a colour from the peek needs a swipe up first. If that's too much, the one colour control can stay in the header instead, and the profile's copy goes: still one place, and 2 taps from the peek.

## 5. What works and must be protected

- **The common tasks are near:** undo, redo and the routing mode one tap away; Done always on screen; the time links to the departure.
- **The planner's moments in three tabs** (22a): Route, Check and Go read as the order of planning; the journey moved between them six times without losing state.
- **State survives detours:** Layers and back kept the route and the sheet; Undo brought a removed point back; a reload kept the route.
- **Heads-up and Avoid:** a warning, its place on the map and a way around it in three taps.
- **Honest numbers:** estimates say so, and the route says when terrain or weather didn't load (PRODUCT.md's "missing data never looks complete").
- **The keyboard:** R, F, L, T and Ctrl+Z; nothing animates for the keyboard.
- **The map comes first:** 83 % of a phone's screen at peek today; the drawer and the calmer planner keep or raise it.
- **A short way in:** Plan, a sport and the first point take four taps; the problems start after the first point. Whether people find them without help is for the people's test.

## 6. Other findings

Each with the skill or tool that found it, and where it went.

| Finding | Found with | Goes to |
|---|---|---|
| In dark mode, white on the accent is 2.7:1 (sport pill, pressed Weather and Locate, primary buttons) | Impeccable's detector | #239 (bug) |
| A long route's numbers run together at 360 px; at 200 % zoom the summary and the profile overlap; 30 waypoints pile up on the profile | break-ui | #242 (bug) |
| The timeline's reading is cut to "map c" on phones | break-ui (screenshots at 390) | #243 (bug) |
| Two Other ways' labels print over each other (`text-allow-overlap`) | screenshots, then the code | #244 (bug) |
| With a mouse, a click on the sport pill closes the menu its hover opened | the journey script | #245 (bug) |
| At the start, undo, redo and Show the whole route look ready | `measure.py`, then `window.polku` | #241 (bug) |
| Distance marks carry two lines of times, the elapsed to the second | apple-design (simplicity) | #234 |
| Targets under 44 px and text under 11 px outside the planner (timeline chips 26 px, its slider 16 px, a card's ✕ 26 px, button labels 10 px) | emil-design-eng, Impeccable's detector | #235 |
| No web app manifest, home-screen icon or per-theme `theme-color` | mobile-native | #236 |
| Settings' sport choice is icons only on phones | apple-design (recognition) | #237 |
| After a reload the planner is closed | the journey script | #238 (idea) |
| Zoom is turned off because inputs are 15 px; `html { touch-action: none }` blocks pinch on panels; px sizes ignore iOS's text size | mobile-native | #73 (comment) |
| No safe-area padding anywhere; a home-screen Polku may not be full screen | mobile-native | #134 (comment), #236 |
| 37 `:hover` rules, 1 behind `(hover: hover)`; 1 `:active`; long press selects labels | mobile-native, emil-design-eng | #208 (comment) |
| The sheet and the map's buttons animate `height` and `bottom`, with no reduced-motion fallback | emil-design-eng | #96 (comment) |
| "Inter" first in the font stack but not shipped: computers and phones look different | Impeccable's detector | phase 20's plan |
| The Layers panel's headings skip a level (h2 to h4) | Impeccable's detector | phase 21's plan |
| Three ways to close the planner on a desktop | the plan's list, `measure.py` | phase 22b's plan |
| Finnish and Swedish words in narrow places | break-ui, `word_widths.py` | phase 18's plan |

**Impeccable's detector, false positives:** two "accent border on a rounded card" and one "side tab" were the CSS triangles in the start marker (`css/app.css:827`, `:844`); "decorative stripes" was the map key's swatch for closed ways; the static "low contrast" pairs mixed dark text with light backgrounds from different themes.

## 7. Impeccable's audit

| Dimension | Score | The main finding |
|---|---|---|
| Accessibility | 2 | Dark-mode contrast 2.7:1 (#239); targets under 24 px (the handle, the departure); zoom blocked (#73); a panel's ✕ off screen (#240) |
| Performance | 3 | Lean (no framework); the sheet animates `height` and four elements follow with `bottom`, recalculating everything under `--sheet-h` (#96) |
| Theming | 3 | Tokens for light and dark; white on the dark accent; one `theme-color` |
| Responsive design | 2 | Works on phones, but targets under 44 px, 200 % zoom overlaps, no safe areas |
| Implementation integrity | 3 | Coherent and specific to Polku: its own icons, map first, plain words; isolated drift (duplicates) |
| **Total** | **13 / 20** | Acceptable: the work is in targets, duplicates and a few bugs, not the foundations |

## 8. What needs people or real phones

| Conclusion | Needs |
|---|---|
| The first point's card gets in the way, and the peek is the better place (problem 1) | People |
| A or B, and which waypoint rows (problem 2) | People, on their own phones |
| 44 px feels calmer, not just bigger | People, outdoors |
| The swipe's numbers; whether a swipe below peek closes the planner (problem 4) | Real phones (the test list) |
| The sport at the top of the screen is found while planning (problem 5) | People |
| Zoom and enlarged text (#73), the notch and the home indicator (#134), tap flash and sticky hover (#208) | Real phones (the test list, item 5) |
| The drawer's height and tiles on small phones | Real phones |

## A test script for people

Ready to use; nothing to change in Polku first. **Three to five people**: riders, hikers and paddlers, on their own phones, outdoors if possible (a bench in daylight is enough). About 30 minutes each.

**Before:** ask them to record their screen (iOS: Control Centre's screen recording; Android: the screen recorder in quick settings), and open [polku.si](https://polku.si). Say only: "This is a map for planning trips. Please say aloud what you're looking at and what you're trying to do. There are no wrong answers; we're testing the app, not you."

**The five tasks,** given as goals, one at a time, in their own sport. Never name a control ("Plan", "Check", "Layers") and never point.
1. "Plan a [ride / hike / paddle] from where you live to [a place they name] and back, about 30 km." (Paddlers: "from [a shore] to [an island] and back.")
2. "You'd rather [stay on trails / keep off the busy road / stay close to the shore]. Make the route do that."
3. "Is there anything on this route you should know before you go? Where's the hardest bit?"
4. "You'll start tomorrow at nine. What will the weather be like halfway?"
5. "Send this route to a friend, and make sure you'll still have the map if there's no signal."

**What to note,** for each task: the time taken; each hesitation (a pause of more than 3 seconds); each wrong tap (and what they expected it to do); each time they give up or ask for help; what they say they expected. Also: whether they tap the card after the first point, whether they find the sport at the top while planning, and how they move the sheet.

**How not to lead them:** if they're stuck for a minute, ask "What would you expect to do here?" and wait; don't show them. If they ask "Is this right?", answer "What do you think?". If they give up, note it and move on to the next task.

**After:** ask what was hardest, what they liked, and whether they'd use it on a real trip. Put the recordings and notes beside this report (not in the repo if they show people's homes); the findings go into issues, written as plans, without quoting people.

## Blind agent runs

At most three, after the drawer part, and only if usage allows: a first-time user and an experienced planner, each with one goal. What they find is **simulated**: a guess for the people's test to check. A success proves little, since an agent is more patient than a person.

**Why they aren't started from here:** a session started from this one opens in the repository, with AGENTS.md, PRODUCT.md and memory already loaded, so it wouldn't be blind. They need a new session started by the user in an empty folder.

**Set up beforehand (the user, or a session in the repo):**
1. A server for Polku as it is on `main`: `git -C ~/Websites/Polku worktree add --detach /tmp/polku-blind origin/main`, then `python3 /tmp/polku-blind/serve.py 8790`, left running.
2. The local BRouter running (`tools/brouter-local.sh`, at `localhost:17777`).
3. An empty folder, say `~/polku-blind-1`, with nothing in it.

**The brief, to paste into a new session started in that empty folder** (one session per run; the goal differs):

> You're testing a web app as a person would, without any prior knowledge of it. Use only the built-in browser, and only screenshots, clicks, taps, drags and typing: don't use read_page, find, get_page_text or javascript, and don't open any files. First open http://localhost:8790/docs/reviews/2026-10-17-design/evidence/blind-setup.html once (it resets the app and opens it), then set the browser to a phone (390 × 844). Your goal: **[goal]**. Work towards it as an ordinary person would. After every action, write one line: what you saw, what you expected, what you did, and whether it worked. Mark each hesitation, each wrong tap (and what you expected it to do), each dead end and each time you went back. Stop when you reach the goal or after 40 actions, and end with the three things that got most in your way. Don't guess at how the app is built.

The goals:
- **A first-time user:** "You've just heard of this app. Plan a bike ride of about 20 km starting and ending at Tampere's Hervanta, on trails rather than roads, and find out how long it takes."
- **An experienced planner:** "You plan trips often. Plan a two-part trip near Tampere: cycle from Kauppi to the shore of Näsijärvi, then paddle to an island and back. Check what the weather will be like on the water tomorrow at noon, and save the trip so you can use it without a signal."

Log each run's lines beside this report as `blind-1.md`, `blind-2.md` (simulated, not people), and turn what they share with the people's test into issues.

## Evidence

All in [`evidence/`](evidence/):
- `measure.py`, `measure-before.json`: the starting point at every size and sheet state;
- `journey.py`, `journey-main.json`, `journey-main.log`: the baseline journey and its shorter runs;
- `mockup_probe.py`, `mockup-after.json`: the planner's mock-up measured the same way;
- `mockup_bg.py`: the map pictures behind the mock-ups;
- `drawer_probe.py`, `drawer-before.json`, `drawer-after.json`, `word_widths.py`, `swipe_probe.py`, `swipe-probe.txt`: the quick layer drawer's questions;
- `break_probe.py`, `break-before.json`: break-ui's worst case in the planner;
- `impeccable-files.json`, `impeccable-url-390.json`, `impeccable-url-1440.json`: Impeccable's detector;
- `blind-setup.html`: the setup page for blind runs.
