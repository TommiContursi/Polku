# Splitting the planner (#496)

How `js/planner.js` is split, and when: what it holds, which parts really collide between the planner's and the cards' PRs, where a split makes the code deeper rather than only moving it, what a phone's first load would save, and what can go. It builds on two architecture reviews, of 2026-11-06 and 2026-11-09, and checks their findings again on `main`. Part of [#496](https://github.com/TommiContursi/Polku/issues/496), in the order of [#869](https://github.com/TommiContursi/Polku/issues/869#issuecomment-6772432958).

## Where it stands

- **Audited on `main` at ccca179a** (2026-11-10). Its app code is 0d374b27's: `js/planner.js` has 7,827 lines, 522 kB and one `Planner` class with 455 methods. Line numbers below are from that commit, with the method's name, because the cards' PR 3 is moving lines right now.
- **Read-only.** No app code changed.
- **Decided (2026-11-10):** the user took the recommended order ([#869](https://github.com/TommiContursi/Polku/issues/869#issuecomment-6779151280), and on [#690](https://github.com/TommiContursi/Polku/issues/690#issuecomment-6779151617)). "Decided" at the end has the details.
- **Words:** CONTEXT.md's. A *module* is a file with a job. It is *deep* when a lot of behaviour sits behind a small interface, and *shallow* when the interface is about as big as the code. A *seam* is where one module hands over to another.

## In short

- **Moving code by itself won't let the two plans run side by side.** In the last 45 PRs that changed `js/planner.js`, the two plans met in five methods: the panel and the sheet, the list's menu, the markers and Start here. Those are spread over the parts a move PR would take out, so they'd come along into the new files. Every PR also changes `tools/smoke.py`, `css/app.css` and CHANGELOG.
- **So deepen at the steps rather than move before them.** Two modules pay back across several steps:
  - **The trip's times, before step 1.** Steps 1–6 all read them. Today they're worked out in many places, and Polku has two departure rules that disagree (#956).
  - **Check's items, before step 10.**
- **Step 1 can build When as a module of its own,** since it makes one control for three places.
- **The route's one reader and writer (`js/route.js`)** can run beside the list's and cards' work. It shouldn't overlap steps 1–4, which change the departure it saves.
- **Loading rare parts later saves about 2 %** of a phone's first load and makes offline worse. Not worth it.
- **What can go:** one dead method, two copies inside `planner.js`, and the copies #496 and #486 listed, most still there.

## What `planner.js` holds

The file's own section comments don't always match what's under them, so this groups the methods by what they do. kB are gzip, as GitHub Pages sends them.

| Part | Lines (methods) | ~kB | What's in it | The step that rebuilds it |
|---|---|---|---|---|
| Undo, and the state | 185–338 (4) | 4 | `constructor`, `snapshot` 285, `commit` 301, `restoreSnap` 308 | The route's reader and writer |
| The route and its edits | 339–830 (48) | 12 | a waypoint's name, changeover, stop, gear and moved-from spot (six WeakMaps), each leg's sport, `movePointTo`, `splitLeg`, `removePoint`, `reverse`, places to avoid, the next leg's sport | The Route model |
| Marked routes from LIPAS | 831–1090, 5311–5432 (32) | 8 | `rideLipas`, `loadSources`, `markedCards`, `listMarked`, `pickMarked` | Step 7 |
| Routing and Alternative routes | 1091–1457 (23) | 9 | `update`, `routeAll`, `legDone`, `drawRoute`, `offerAlts`, `pickAlt` | Step 14 (the words) |
| Round trips | 1458–1916 (19) | 10 | `generateLoops`, `loopView`, `loopCards` | none planned |
| Route style | 1917–2058 (9) | 4 | `renderStyle`, `checkWet`, `styleStats` | not named in the order |
| The analysis and its warnings | 2059–2517, 2638–2687 (25) | 12 | `runAnalysis`, `useAnalysis`, `detourWarnings`, `darkWarnings`, `waterWarnings`, `loadTrail`, `winterWarnings`, `loadWind`, `loadHazards` | Step 10 |
| The departure and times | 2518–2637 (12) | 3 | `timed` 2531, `arriveAt` 2558, `startSec` 2603, `leaveHour` 2606, `setLeave` 2614 | Steps 1 and 4 |
| Map clicks and the readout | 2688–2901 (9) | 6 | `onMapClick`, `onOpenWater`, `onMapMove`, `hoverAt` | none planned |
| The route's list | 2902–3481 (30) | 16 | `renderWaypoints` 2902, `sections`, `sampleAtM` 3124, `pointRow`, `stretchRow`, `reorderRows` | Steps 5 and 12 |
| Markers and live editing | 3482–3799 (12) | 9 | `renderMarkers`, `beginEdit`, `onLinePress` 3682 | none planned |
| The cards' glue | 3800–4420 (61) | 13 | `openRouteCard`, `stretchAt`, `stretchNums` 3861, `openSpotCard`, `openPointCard`, `stopWarnings`, `daysList` | Steps 6, 7, 11, 13 |
| Saving and sharing | 4421–4655 (13) | 6 | `save` 4424, `loadSaved` 4453, `openLeave` 4491, `routeSnapshot` 4528, `restoreSnapshot` 4547, `shareUrl` 4580, `exportGpx` | The route's reader and writer |
| The panel and its tabs | 4656–5011 (18) | 9 | `buildPanel` 4661 (200 lines), `setTab`, the profile's size, `showLit` | Steps 2 and 10 (the tabs go) |
| The start | 5012–5310 (26) | 8 | `startView`, `renderStart`, `sportRow`, `whenRow` 5067, `whenMenu` 5086, the ways, `firstView`, `findView` | Step 1 |
| The sheet | 5433–5986 (31) | 13 | `setSheetState` 5457, `renderFold`, `bindSheet` 5650 (170 lines), `moveSheet` | Every step a little |
| The toolbar | 5987–6357 (15) | 9 | `buildTools`, `placeToolsNow`, `toggleModes`, `speedItems` | not named in the order |
| More (⋯), Go and the analysis panes | 6358–7062 (36) | 14 | `toggleMore`, `renderSpeed`, `keyFacts`, `renderModeChips`, `renderLeave` 6702, `revealDeparture` 6694, `renderAnalysis` 6765, `renderBreakdown` | Steps 2 (Go goes), 9 and 10 |
| Check | 7063–7699 (42) | 16 | `headsUp` 7067, `routerWarnings`, `notChecked` 7117, `renderWarnings`, `drawHeads`, the read items, `renderWind` 7615 | Steps 2 (`renderWind`) and 10 |
| Free functions | 7700–7827 | 3 | `hourStrip`, `clock`, `alongAt`, `encodeAvoid`, `spotUrl`, `parseShared` 7805 | |

## Where the two plans really collide

**What was measured.** Two tests, on the 45 most recent PRs on `main` that changed `js/planner.js` (#731 to #778):
- Each PR's changed lines, matched to the methods around them in its own commit.
- For each PR and the one merged just before it: had it been built from the same `main`, would git have conflicted? That's `git merge-tree` with the earlier PR taken out. It's only exact for neighbours, so pairs further apart weren't counted.

**What it shows.**
- **The route's list is where the work was:** 22 of the 45 PRs changed it. 21 were the planner's; the cards' #887 changed the list's menu.
- **`planner.js` conflicted only between neighbours of the same plan,** each built on the one before (#790, #791 and #792; #799, #802 and #805; #844 and #847; #850 and #853; #878 and #879). Those would be stacked "after #N" PRs anyway.
- **CHANGELOG conflicted in almost every pair,** often with DEVELOPING and USING too. That's mechanical: both entries stay. `tools/smoke.py` (20,268 lines) and `css/app.css` conflicted in most pairs of the same plan.
- **The cards' PRs (#885, #887) changed 17 methods.** Five of those were also changed by the planner's PRs: `bindSheet`, `buildPanel`, `listMenu`, `renderMarkers` and `startRouteAt`. The imports at the file's top were changed by both too.
- **#890, one set of sizes, was for both plans:** the sheet's sizes for the planner and every card. It changed ten methods, all in the sheet and the panel (`setSheetState`, `renderFold`, `bindSheet`, `buildPanel` and others).

**What that means.**
- **The two plans share the sheet and the panel because they share the screen.** Moving the list, the start or Check into files of their own wouldn't separate that. The list's one shared method, `listMenu`, would move with the list, and both plans would still edit it.
- **Moving code adds a seam that both plans then edit:** the new file's imports, and the members it calls back on the `Planner`.
- **Splitting `planner.js` can't by itself let the two plans run side by side.** Two PRs can run at once when they change different behaviour, whatever the files. The route's reader and writer is one such PR (below).

## Recommendations

### Deepen at a step; don't move before it

The 2026-11-06 run called pure moves shallow, and the evidence above agrees: moving the list or the start wouldn't stop the collisions. `js/cards.js` shows what a move leaves behind. Its interface is the whole `Planner`: it uses 109 of its members, so it is a shallow module. A move recreates that shape unless the new module gets a smaller interface.

So each slot in the one order gets either a deepening or nothing:

| Slot | Recommendation | Why |
|---|---|---|
| **Before step 1** (the ▾ pill, one When) | **One place for the trip's times** (below). Then step 1 builds When as a module of its own, `js/when.js` | The departure lives in four places today: the state and its expiry (`setLeave` 2614, `openLeave` 4491, `expireLeave` 4502, `leaveHour` 2606, `startSec` 2603), the start's row (`whenRow` 5067, `whenMenu` 5086), Go's Leave (`renderLeave` 6702, `revealDeparture` 6694) and the card's (`leaveBlock`, `leaveFrom` and `leaveLocal` in `js/cards.js`:205–216). Step 1 makes one control for three places, so building it as one module is the step's own work, not an extra PR. |
| **Before step 2** (the trip's box and the weather card) | **No move PR** | Step 2 deletes Go's tab, `hourStrip`, `revealDeparture` and `renderTabTimes`. Moving them first would be wasted work. `renderWind` 7615 becomes the card's content and reads the trip's times. |
| **Before step 5** (the list's top) | **No list move** | The list is nearly all the planner's code. The cards' only change there was `listMenu`, which a move would carry along. Its arithmetic (`sampleAtM`, `timesAt`, `wxOf`, `waitsAt`, `stretchNums`) is in the trip's times by then. |
| **Before step 10** (the Check card) | **Check's items as one module** (below) | The tabs go and Check becomes a card. It's the moment to give the warnings one interface. |
| **Beside steps 5–9** | **The route's one reader and writer** (below) | Saving and sharing had no PR change 3 or more of its lines in the last 45. It changes formats, not what's on the screen. |
| **After step 7** | **The Route model** | The list and the cards' work on waypoints has landed by then. |

### One place for the trip's times (strong)

The 2026-11-06 review's candidate 3, "one place for a stretch's numbers", and the 2026-11-09 review's candidate 2, "the trip's timeline", are the same module seen from two sides. Here they're one.

**The problem, on `main`:**
- **"Which sample is this many metres along?"** is written in nine functions:
  - `planner.js`: `arriveAt` 2566, `sampleAtM` 3127, `stretchNums` 3866 and 3868, `drawMarks` 6744 (with no 1 m tolerance), `drawHeads` 7321, `itemSpan` 7475–7476;
  - `facts.js`:77, `stops.js`:91, `cards.js`:156.
- **"The time at a sample, with the wind's or without"** (`a.tAtWind || a.tAt`) is written 11 times in `planner.js` (in `darkWarnings`, `winterWarnings`, `arriveAt`, `atSample`, `stretchNums`, `daysList`, `renderSpeed`, `keyFacts`, `drawMarks` and twice in `renderWind`) and once in `safety.js`:474.
- **"When the timing starts"** (`a.wind ? a.wind.startSec : this.startSec()`) is written 6 times: in `arriveAt`, `atSample`, `daysList`, `plannedTimes`, `keyFacts` and `lookedAt`.
- **Two departure rules disagree (#956).** With Leave now, `startSec()` 2603 is the current minute, and `a.wind.startSec` is the minute the forecast came (`loadWind` 2649).
  - From now: Go's tab time (`renderTabTimes` 6523), Time on the way's arrival (`renderSpeed` 6434), `drawMarks`, `darkWarnings` and `clockOf`.
  - From the forecast: the list's arrivals (`arriveAt` 2562), `atSample`, `daysList`, the GPX (`plannedTimes`, #512), `keyFacts` and `lookedAt`.
  - With Polku left open, Go and the list drift apart by the minutes since the forecast came.
- **The clock "13:40" is written ten times:**
  - `planner.js`: 2307, 2335, 2574 (`timeOf`), 4407, 7705, 7731;
  - `chart.js`:178, `net.js`:63, `wxmap.js`:1374, and in `cards.js`.
- **The 2 m climb rule** is in three places: `analysis.js`:121, `facts.js`:158 (pasted there by #824) and `stretchNums` 3871.
- **Not so:** the 2026-11-09 review says #813 fixed `shortDuration` but not `fmtDuration`. It changed both (`geo.js`:150).

**The module:** `js/trip.js`, built from an analysis, the stops and the departure. With one departure rule, it gives:
- each waypoint's arrival and leaving;
- the days;
- the planned times for the GPX;
- for a span in metres or between two waypoints: the samples, the distance, the moving time, the waits, the climb and the forecast's sample;
- the clock and duration words.

The wind's or not is decided once.

**Who uses it:** When (step 1), the weather card (step 2), Best time to leave (step 4), the list (step 5), the leg's card (step 6), `chart.js`, `facts.js`, `stops.js` and `safety.js`. It fixes #956.

**How it's tested:** a check in the `multi` smoke group, through `window.polku`, that a three-sport route's spans add up to the route's own numbers (distance, climb, and time less waits), at 0 m and at the end too. No map is needed.

**Cost:** M to L. It changes no screen except #956's fix. It touches the list and the cards' glue, so it runs between the code PRs, not beside one.

### Check's items as one module (candidate 4, worth it before step 10)

**The problem:**
- **The planner writes 26 fields onto the analysis** at different times: `waterWarn`, `darkWarn`, `accessWarn`, `trailWarn`, `hazards`, `tAtWind`, `waitAt`, `winterCls`, `*Error`, `asking` and others.
- **`headsUp` 7067 merges ten sources.** Four of them (stops, winter, ice, the router) are worked out on every render.
- **Each source decides by itself** whether its data is missing, late or partial.
- **`darkWarnings` runs from three places:** `useAnalysis` 2119, and twice in `loadWind` (2641 and 2657).

**The module:** `js/check.js` takes an analysis and each source's state (answered, failed, still asking) and returns the groups: Warnings, Good to know, what wasn't checked, and what's hidden. The read items go with it. Drawing the card and the map's markers (`renderWarnings`, `drawHeads`) stays with the card.

**How it's tested:** a check feeds in sources that are late, failed or out of order and reads the groups, with no network. That tests AGENTS.md's rule that missing data never looks complete, in one place.

**Cost:** M to L. Step 10 then builds the card on it.

### The route's one reader and writer (candidate 1, designed 2026-11-06)

**What was agreed in two rounds, 2026-11-06:**
- **One new file, `js/route.js`, for all four forms:** Undo, the saved route, the offline pack and the share link.
- **One format for saved routes and offline packs.**
- **A version number on every form.** Anything without the current version isn't read: a link says it's from an older Polku, and an offline pack still shows its map, without its route.
- **Each waypoint carries its own details** in the format: name, changeover, stop, gear and moved-from spot. The planner keeps its six WeakMaps until the Route model.
- **The reader checks every detail in one place.** That's related to #800, which it may fix; the build reproduces #800 first.
- **A smoke check that a share link carries no waypoint names, read items or moved-from spots.**
- **#283's version part joins this work.** Moving the route after the `#` stays in #283.
- **Size L:** about 71 smoke lines depend on today's formats.

**Checked again on `main`:**
- **The four writers and readers are still separate,** each listing the details by hand: `snapshot` 285 and `restoreSnap` 308, `save` 4424 and `loadSaved` 4453, `routeSnapshot` 4528 and `restoreSnapshot` 4547, and `shareUrl` 4580 and `parseShared` 7805.
- **Each applies its own rules.** An alternative route is 1 to 3, only on Follow paths legs, and `ice` only on Freehand legs.
- **Undo's snapshot still doesn't carry the departure.** `restoreSnapshot` patches it in afterwards, at 4549.

**The 2026-11-09 review** made this its top candidate, "the route document and its history". It goes further:
- **Undo and redo, Clear, and about 20 methods** that write the route's fields directly, behind one change event.
- **Three steps:**
  1. one serialization instead of eight, which is the reader and writer above;
  2. the route's edits and Undo in the module, with `points`, `legs` and `past` kept as getters for the smoke checks;
  3. the six WeakMaps as plain records. That's the Route model, the riskiest step, done only if 1 and 2 aren't enough.
- **The drift it names, checked on `main`:**
  - `useShortCut` 1143 copies a waypoint's name, changeover, stop and gear to its new array, but not its id. `editTo` 3594 copies the id too.
  - The id is what keeps a stretch unfolded in the list and a waypoint's card open (`pidOf` 4301, `findPoint` 4307). So taking a short cut may fold that stretch and close that card. Not run.
  - Neither copies the moved-from spot, but that looks meant: a short cut puts the waypoint back on that spot, and a drag puts it where you let go.
- **It also advises Node tests** (`node:test`). Those would be new tooling, an issue and the user's OK under AGENTS.md. The checks through `window.polku` need neither.
- **It advises never running the refactor beside planner features:** `planner.js` frozen until each refactor PR merges, each PR small and merged the same day.
  - The evidence here agrees for steps 2 and 3, which rewrite how the list and the cards edit the route.
  - For step 1 it's too strict: no PR in the last 45 changed 3 or more lines of saving and sharing.

**When.** The only overlap with the one order is the departure, which steps 1–4 rewrite: `leaveAt` in `save` and `shareUrl`, `openLeave`, and `'leave' in s` in `restoreSnap`. So it runs:
- **beside steps 5–9:** a second session, with its own claim and branch;
- **or after step 4.**

Or right after the cards' PR 3, before step 1, one PR at a time, as the 2026-11-09 review advises. It should land before Polku goes public, while formats can change freely. Its smoke rewrites will conflict mechanically with any UI PR's smoke edits at the same time. Saving and share links need a review offered before merging.

### The other candidates

- **The Route model (candidate 2, strong):** after step 7, and after the reader and writer, whose format already gives each waypoint its own details. It is where the six WeakMaps keyed by the points array (`pname`, `pchange`, `pstop`, `pcarry`, `pspot`, `pid`) become one waypoint value.
- **`cards.js` is shallow (candidate 5):** no PR of its own. It narrows as candidates 2 and 3 land.
- **The sheet's states and round trips (2026-11-06's candidate 6):** round trips aren't recommended. They're self-contained, and no step changes them. The 2026-11-09 review agrees: moving the round-trip search into `roundtrip.js` is speculative.
- **The sheet, the dock and the toolbar as one layout module (2026-11-09's candidate 5, worth exploring):**
  - About 835 lines (5433–6357), with `viewPadding` 5865 as the seam the map frames by.
  - It's the one part where the two plans really collide (#887, #890), so it's the only move that targets that collision.
  - It still needs a browser to test, and `tools/smoke.py` calls `setSheetState` 51 times through the `Planner`.
  - A choice for round 2.
- **A routing session over `router.js` (2026-11-09's candidate 4, worth exploring):** leg keys, waiting and retries, and Alternative routes in one place, with a fake router in tests. Fixes #798, #661 and #897 landed there. No step in the one order rebuilds routing, so it waits.

## A lighter first load

A phone's first load, measured on `main`:
- **The app's code:** 59 modules loaded at start, 534 kB in gzip (1,595 kB as written). `js/planner.js` alone is 159 kB of that.
- **CSS:** `css/app.css` is 51 kB.
- **MapLibre:** 269 kB, plus 9 kB of its CSS and 10 kB for the contours.

That's about 873 kB before the map's tiles and fonts. The only module loaded on demand today is the PMTiles reader (`osm-data.js`:249).

**What loading parts only when opened (`import()`) would save:**
- **Round trips** (about 10 kB) and **marked routes** (about 8 kB) are opened only when asked for. Together that's about 18 kB, or 2 %.
- **More** (about 14 kB) and **Check** (about 16 kB) can't wait. Check's warnings, its badge and the analysis panes are drawn for every routed route.

**What it would cost:**
- **The move comes first.** Each part leaves the class before it can load later.
- **Offline gets worse.** `sw.js` keeps app files only once they've been fetched; nothing is fetched ahead. A round trip never opened online wouldn't open offline, unless the worker fetched it ahead too.
- **Mixed versions get likelier.** Each module loaded later is one more chance for an old page to fetch a newer file, which is #481.

**Recommendation:** none now. Moving code doesn't make Polku lighter for a phone. Deeper modules do make the code lighter to work on. Not measured: the time a phone takes to compile the code.

## What can go

Checked on `main` at ccca179a. Each is small and changes nothing people see. They could share one Fix PR in the month's Fixes milestone, after the cards' PR 3, since three of them are in `planner.js`.

| What | Where | Note |
|---|---|---|
| `dropEdit()`, which nothing calls since #514 (2026-10-26) | `js/planner.js`:3669 | DEVELOPING's "Holds on a touch screen" (`docs/DEVELOPING.md`:127) still says a quick tap on the line calls it: that sentence changes with it |
| `clock`, a copy of `net.js`'s exported `clock` | `js/planner.js`:7731, `js/net.js`:63 | identical |
| An inline Finland box in `listMarked`, while the file imports `inFinland` | `js/planner.js`:5343, `js/safety.js`:546 | the box's north edge is 70.2, `inFinland`'s 70.3 |
| Finland's box, four more times with three sizes | `js/lipas.js`:85, `js/nautical.js`:131, `js/radar.js`:30 (`FI_BOUNDS`) | #496's item 5, still open |
| `pointSegmentM`, a copy of `pointSegment(p, a, b).d` | `js/winter.js`:311, `js/geo.js` | #496's item 6 |
| HTML escaping, three ways | `js/gpx.js`:45 `esc`, `js/main.js`:404 `escapeAttr`, `js/ui.js`:188 `escapeHtml` | keep `escapeHtml`. (`search.js`'s `esc` escapes a regular expression, not HTML) |
| A polyline decoder at 6 digits | `js/valhalla.js`:42 `decode6`, `js/geo.js`:129 `decodePolyline` | one decoder with a precision |
| Two CSS rules nothing uses | `.tool-sep` `css/app.css`:674 and :2255, `.sec-break` :1248 and :1259 | |
| The settings' move from before trail colours were per sport | `js/main.js`:99–104 | AGENTS.md: no old formats kept only for compatibility |
| Three exports nobody uses | `OVERLAY_GROUPS` `js/config.js`:376, `modalBody` `js/modal.js`:43, `rampHex` `js/wxmap.js`:78 | #486, still true |

**Not copies:**
- `shortDuration` (`planner.js`:7757) leaves out "min" after hours on purpose, unlike `fmtDuration`.
- The five `*View` methods (`waysView`, `drawView`, `firstView`, `findView`, `loopView`) are called by name in `renderStart` 5043.
- `setLegMode` 740 is used by `tools/smoke.py`:16957.

**#496's loader items 3 and 4:** the tile-range copies and the two Overpass caches (`trails.js`:65, `winter.js`:154) are still there. `safety.js`'s `tilesFor` no longer exists.

## With any split

- **`tools/smoke.py` reaches into the `Planner`:** 241 distinct members, through `window.polku.planner` (`p.els` 267 times, `p.cards` 267, `p.analysis` 255, `p.points` 194, `p.legs` 165). A method that leaves the class either stays reachable there or its checks change in the same PR. A new module is put on `window.polku` so its checks can call it directly.
- **Offline, #481:** a new module file is fetched and kept like any other. Check it with the service worker running and the network off.
- **Saving and share links:** a PR that touches them gets a review offered.
- **DEVELOPING:** its Files list (`docs/DEVELOPING.md`:314) and the section that describes the code ("Along the route", "Check's warnings", "Share links and offline") change in the same PR.

## Decided

The user's choices on 2026-11-10, after this audit ([the one order on #869](https://github.com/TommiContursi/Polku/issues/869#issuecomment-6779151280)):
- **No PRs that only move code.** A module is made in the PR that needs it.
- **The trip's times come next, in one place (#956).** One departure rule for every time on the trip.
  - The dead code inside the time code goes in the same PR, such as the copied `clock` (`planner.js`:7731).
  - #956's session asks the user whether Leave now counts from now or from the minute the forecast came.
- **Then the ▾ pill and one When everywhere,** with When as its own module in that PR.
- **Then the weather card, in three PRs:** 6a, 6b and 6c.
- **Then Best time to leave and Arrive by,** on the trip's times.
- **Then the list and the cards.** Check's items become one module in the Check card's PR, or the one just before it.
- **The route's one reader and writer is #960,** in the Project's Later column.
  - It runs alongside, from the list's top on, never during steps 1–4.
  - It lands before Polku goes public. The user says when it starts.
- **Dead code outside the time code** (`dropEdit`, the inline Finland box, and the copies in "What can go") goes in a small Fix PR between turns, while no planner PR is open.
- **Not taken up:**
  - loading parts later, as recommended;
  - the layout module;
  - the routing session;
  - the Route model, which waits until after the list and cards' work on waypoints.

## Not checked

- **The time a phone takes to compile the code,** and whether the first screen waits for it.
- **`main.js`'s use of the planner,** and `chart.js` inside.
- **Whether the climb's three rules ever disagree in the running app.** #824 made the sports line use the 2 m rule; `stretchNums` and `analysis.js` handle water differently.
- **The round trips' and the marked routes' code** wasn't read line by line.
