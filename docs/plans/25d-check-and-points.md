# 25d: Check, points and the map's cards (#233, #345)

The implementation plan for the last part of Phase 25. What's still to do, and its status, is on GitHub: #233 and #345, in the [Phase 25](https://github.com/TommiContursi/Polku/milestone/16) milestone.

- **Status (2026-10-21): for the user's OK.** No app code before it.
- **What it builds:** journeys C and D of the [calmer planner](issue-233-calmer-planner.md#revised-journeys-2026-10-20-proposals), and #345's [map cards](issue-345-map-cards.md), approved on 2026-10-21 (PR #346).
- **The mock-ups:** [the planner's](mockups/phase-24-planner.html) sections C and D; [the map cards'](mockups/issue-345-map-cards.html). Frame ids are in brackets below.
- **How to build it:** one part a session, one PR a part, in this order. Each session starts from the last Hand-over on #233 (AGENTS.md).

> **For agentic workers:** use superpowers:executing-plans for one part at a time. Steps use checkboxes (`- [ ]`). AGENTS.md wins where they differ: no subagents to verify or run the suite.

**Goal:** a tap on a point, the route, a warning or a place shows one card; a long press or a right-click shows what's there and what you can do; Check sorts every Heads-up item by how serious and how sure.

**Architecture:** one card component (`js/card.js`) shows every card: in the planner's peek on a phone, at the pointer on a desktop, at the spot with the planner put away. The planner's cards replace today's map menus in `js/planner.js`, keeping every action. The facts come from one module (`js/facts.js`), ordered by sport. Heads-up items get a group and a source where each is made.

**Tech stack:** plain ES modules, MapLibre, `tools/smoke.py` with headless Chrome. Nothing new to install.

**Spec:** [issue-233-calmer-planner.md](issue-233-calmer-planner.md) (§6, C, D, §8, §10) and [issue-345-map-cards.md](issue-345-map-cards.md). Read both with this plan.

## For you to decide

Each has a recommendation. The plan is written with it.

1. **The order:** the card first, with a point's card. *Why:* the card decides Back, the peek, the toolbox stepping aside and focus for all eight cards that follow. A point's card is the smallest real use, so it can be tried on a phone before the rest.
2. **Change sport on a point** changes the legs from that point to the next change of sport, or to the finish. One stretch only is Edit this part. *Why:* #345 asks for both, "from a point onward" and "for one part only".
3. **All leg settings goes.** Each stretch row says its sport and how it's drawn, and Edit this part is one tap away.
4. **Find and Move to wait.** They were §7's tools for long routes. D's frames don't draw them: folding, Reorder and a point's Move cover them. An issue keeps the idea.
5. **Items §6 doesn't place** go as the table in part 3 says: road conditions in Read before you go; twilight, snow on the way and snowing in Worth a look; on the ice in Read before you go.
6. **In the route's view,** a stop and the departure change without leaving the view, as 25c built. Every other action on a card goes back to editing first, as #345 says.
7. **With the planner put away,** a card opens at the spot, on phones too, as the map's cards do today. The peek holds cards only while the planner is open.
8. **On a desktop,** a card from the list opens beside the panel at its row [jd-desk]. A card from the map opens at the pointer [d-route].

## Global constraints

Every part's requirements include these.

- Every network call goes through `request()` in `js/net.js`.
- Never burst brouter.de. Tests use straight legs, mocked BRouter or `tools/fixtures/`.
- Traficom's depths are shown, never routed on.
- Share and Weather here send a spot you chose on the map, never your position, and only when you press them. A spot's link has five decimals.
- Missing, late or partial data never looks complete. A missing fact says so in its place.
- Saved routes, settings and share links keep working, old ones too. No stored format changes. New: the spot link's `pin` and `pn` (part 8).
- Every Heads-up item of today stays, in one group, with its source. An item with no group shows in Worth a look and logs a console error, so a check fails.
- Every action of today's point menu, leg menu and spot menu stays, moved to a card.
- WCAG 2.2 AA. 44 px targets on phones, 40 px on desktops, 8 px apart. Keyboard and screen readers. Reduced motion. Never colour alone.
- **The app's words** (from #345, "How a card reads"): the name first; one short line under it; three numbers at most, each with its label under it; one fact per line; no facts strung with dots, no brackets; a missing fact as a dashed tile, "? difficulty not mapped".
- No framework, dependency or build step.

## Review focus

The cases the spec implies and a reviewer should try. Each has a check in the part named.

1. **A card open while the route changes under it:** Undo, a late routing answer, a point removed, a share link opened. The card follows its point or stretch, or closes. It never acts on an old index. Parts 1 and 2.
2. **A source that fails, answers late, out of order, or comes back** while Check, the row or an item's card is open. Groups, counts and ‹ › update. Nothing shows twice or goes missing. Parts 3 and 4.
3. **Gestures that meet:** a long press, a pan, a pinch, the line's hold, a marker's drag, a busy page (#293), a right-drag that turns the map. Parts 2 and 6.
4. **Links:** old share links, a spot link beside a route link's parameters, bad `pin` values, saved routes after each part. Part 8 and every part's regression list.
5. **Small screens and big text:** 360 × 740 in Finnish with long names, 200 % zoom. A card takes half the screen at most, the spot stays in sight, nothing is cut with "…". Part 1 for the card; each part for its own.

---

## Every part's steps

Each part below gives its own checks and what to build. These steps wrap them.

- [ ] **Claim** the part on #233: branch `claude/25d-<n>-<name>` from `main`, or from the part below if it isn't merged ("After #N").
- [ ] **Write the part's checks** in `tools/smoke.py`: a new group (named in the part), and the updates to existing groups. Update an existing check to the new card. Never weaken what it proves.
- [ ] **Run them against `main`.** Serve `main` from its own worktree and point the branch's checks at it:
  ```bash
  git worktree add --detach ../polku-main origin/main
  ```
  ```bash
  python3 ../polku-main/serve.py 8781
  ```
  ```bash
  POLKU_URL=http://localhost:8781/ python3 tools/smoke.py <group>
  ```
  Expected: FAIL, on the new group's assertions.
- [ ] **Build** what the part lists.
- [ ] **Run the new group** on the branch's own server (`python3 serve.py 8771`, `POLKU_URL=http://localhost:8771/`). Expected: ok.
- [ ] **Run the groups the part names.** Then the whole suite, from a frozen worktree on a server started from Bash. Expected: ok, but for a known flaky check (#314, #340, #292), each with its evidence.
- [ ] **Look at it as a person,** in the browser pane: 1440 × 900 and 390 × 844, MTB and paddle, a route drawn, the timeline open; 360 × 740 in Finnish; 200 %; dark.
- [ ] **The regression list** below, as a person would, at 390 × 844 and 1440 × 900.
- [ ] **Screenshots** before and after with `tools/shoot.py`, on `pr-screenshots` under the branch.
- [ ] **Docs in the same PR:** CHANGELOG (one entry), USING (controls), README (a capability), DEVELOPING (how it works), and this plan's Built section.
- [ ] **Commit, push, PR:** a draft in the Phase 25 milestone, titled "Phase 25d: …", with "Refs #233" (and #345 from part 6). Out of draft once verified. Offer a review for parts 2, 5, 6 and 8: they touch routing, the route's shape or links.
- [ ] **Hand-over** on #233.

### The regression list

From the calmer planner's §10, for every part: drawing (add, drag a point, drag the line, a leg's mode and style); undo and redo; the profile and its colouring; Climbs; On the route's breakdowns and their colours on the map; On the map's marks; Go's time, departure and the weather along the route; Heads-up and Avoid; round trips (km and time, water loops); Other ways; stops and nights; changeovers; LIPAS; GPX and KML import, GPX export; share links, old ones too; offline save and preview; 3D and hover. In MTB, gravel, hike and paddle.

---

## Part 1. The card, and a point's card

**Title:** Phase 25d: a point's card, the same from the map and the list.

**For people:**
- A tap on a point opens its card. Phones: in the peek. Desktops: at the point.
- The card: its name, then "Via 1". Three numbers: **10:09** you're here, **1.65 km** from the start, **107 m** height [p-point].
- The start says when you leave, with Depart.
- Actions by name: **Make it a stop**, **Stay the night**, **Change sport**, **Move**, **Rename**, **Remove** (last, with Undo).
- A stop shows its minutes, a night its morning hour, with Places to sleep nearby. A change of sport shows its minutes and the gear.
- **Start here**, **Finish here** on a via point. **Back to start** on the finish, not on a loop.
- **The stretch after it ›** names both ends. Until part 2 it opens today's leg menu.
- **Move** without dragging: "Tap where it goes", then a tap moves it [p-move]. Cancel and Escape stop. Dragging stays.
- **Back** at the top left, ✕ at the right. Back, Escape, the phone's back gesture and a tap on the map close it. The tap adds nothing.
- On phones the toolbox steps aside while a card is open.
- At 200 % the card is half the screen at most and scrolls inside. The map moves so the point stays in sight.

**Files:**
- Create: `js/card.js`, the card component.
- Modify: `js/planner.js`: `openPointCard()` replaces `openPointMenu()`; `renderMarkers()`; `onMapClick()`; `pickOnMap()`; `movePoint()`; `setSportFrom()`; the toolbox's `placeToolsNow()`.
- Modify: `css/app.css`: `.card`, `.card-peek`, `.card-float`, `.card-num`.
- Test: `tools/smoke.py`, new group `pointcard`; update `stops`, `multi`, `backtostart`, `routeview`.

**Interfaces:**
- Produces, in `js/card.js`:
  - `class CardHost`, `constructor(map, { peek: HTMLElement, where: () => 'peek' | 'float', onChange: (card | null) => void })`.
  - `open(card, { at: [lng, lat] | null, beside: DOMRect | null, from: card | string | null })`. `from` is the card it came from, or the place: `'map'`, `'list'`, `'check'`, `'row'`, `'section'`. A card is `{ kind: string, key: any, title: string, sub: string, build: (body: HTMLElement) => void, alive: () => boolean, pill: { label, icon, fn } | null }`.
  - `back()`, `close()`, `refresh()` (builds the open card again; closes it when `alive()` is false), `get current()`.
  - Opening pushes a step of history, as `pushWay()` does; the back gesture is `back()`.
  - A card is a `region` named by its title. The focus goes to its title when it opens, and back where it was when it closes.
  - `num(value, label, { missing = false })` returns a labelled number tile; `missing` draws it dashed.
- Produces, in `js/planner.js`:
  - `this.cards`, a `CardHost` built in `buildPanel()`. `where()` is `'peek'` on a phone with the planner open, else `'float'`.
  - `openPointCard(p, { from = 'map' })`. `p` is the point itself, not its index: `alive()` is `this.points.includes(p)`.
  - `pickOnMap(text) → Promise<[lng, lat] | null>`: the card folds to `text` with Cancel; the next map tap answers.
  - `movePoint(i, ll)`: one step of Undo, its legs routed again (the path `moveToStay()` takes).
  - `setSportFrom(i, sport)`: legs `i` to the next change of sport, or the finish, in `sport`. One step of Undo.

- [ ] **The checks (`pointcard`).** A straight-leg MTB route of four points, at 390 × 844 by touch and 1440 × 900 by mouse.
  ```js
  // a tap on via 1's marker
  p.cards.current.kind === 'point' && !document.querySelector('.maplibregl-popup .pt-menu')
  // the three labels, in order
  ['you’re here', 'from the start', 'height']
  // phones: the card in the sheet, the toolbox aside
  p.panel.contains(document.querySelector('.card')) && document.querySelector('#pl-tools').hidden
  // Make it a stop: one step of Undo
  p.stopAt(1).min === 30 && p.past.length === before + 1
  // Stay the night
  isNight(p.stopAt(1))
  // Change sport → Paddle on via 1: legs 1 to 2 change, leg 0 stays
  [p.legSport(0), p.legSport(1), p.legSport(2)].join() === 'mtb,paddle,paddle' && p.changeAt(1)
  // Move, then a tap 200 px away
  Math.abs(p.points[1][0] - tapped[0]) < 1e-5 && p.past.length === before + 1
  // Rename "Kahvila", Enter
  p.nameOf(1) === 'Kahvila'
  // Remove, then the note's Undo
  p.points.length === 3, then 4 again
  ```
  - A tap on the map with the card open closes it and adds no point.
  - `history.back()` closes it.
  - Undo of the point's own adding closes its card (`alive()`).
  - Start here and Finish here on via points; Back to start on the finish, none on a loop.
  - Every control at least 44 × 44 px on the phone.
  - 200 % at 390 × 844: the card's height ≤ 50 % of the window, the point's marker above it on screen.
  - 360 × 740 in Finnish with a 40-letter name: no "…", no text past the card.
  - 1440 × 900: the card's corner within 30 px of the marker. A marker at the right edge: the card opens to its left, fully on screen.
  - The route's view: Make it a stop works and stays in the view; Move switches to editing first.
- [ ] **Build** `CardHost`, then `openPointCard()`. The peek is `els.card` in the header's `sheet-head-in`, measured by `measureSheet()`. The float is a `maplibregl.Popup` (`polku-popup`), its anchor picked from the room around the spot, kept in view by `keepInView()`. The card's contents are today's `openPointMenu()` items, in the order above: `departSelect()`, `stopEditor()`, `gearToggle()`, the changeover minutes, `startAt()`, `finishAt()`, `backToStart()`, `removePoint()`. The next leg's sport, mode and style move to the stretch (part 2).
- [ ] **Groups to run:** `pointcard stops multi backtostart routeview editing toolbox drawer`.

---

## Part 2. The route's card and a stretch's card

**Title:** Phase 25d: a tap on the route shows what's there; its settings one step away.

**For people:**
- A tap on the route shows the spot's facts. Phones: a pin at the spot and **+ Add a point here** just above it; the card in the peek [p-route]. Desktops: the card at the pointer, Add a point here first [d-route]. Near an edge it opens the other way, and the action moves to the side nearest the pointer.
- The card: the way's name, and a line like "Forest path · 0.72 km from the start". Three numbers for your sport. A warning on that stretch, if there is one.
- Then three rows: **This stretch ›**, **What's under ›**, **Edit this part ›**.
- **+ Add a point here** puts a point at the spot. No routing call, one step of Undo.
- **This stretch ›** [p-stretch]: both ends ("Lielahti → Siilinkari"), its distance, time and climb, and what to look out for. Then Edit this part and On the profile.
- **What's under ›** [p-under]: the trail under the line, from the route's own tags. Your sport's facts first, then the other sports' grades, surface, width, the route it's part of, winter.
- **Edit this part ›** [p-edit, jd-stretch]: "Changes apply to this stretch: its 3 legs". Sport, with "this stretch only · the route is MTB". How it's drawn: only what fits (Follow paths or Straight line on land, Over water or Straight line on water, nothing on a fixed line). Style, with "Paddle's style, for this stretch". Other ways (one leg only), Stop here, Avoid this spot, On the profile. Opened from the list there's no spot, so it's **Avoid a spot here**: tap where.
- **A stretch** runs between two points you see: the start, the finish, a stop or night, a change of sport, a point you named, or where a leg's settings change. The points between only shape the line.
- **A long press on the route** (0.5 s, still) or a right-click opens Edit this part directly [p-holdroute, d-edit]. A hold that moves still reshapes the line, as today.
- A tap on a handle opens the route's card there.
- In the route's view: the card without the pill. With the planner put away: Plan opens at the card.
- The point's **The stretch after it ›** opens the stretch's card now. Today's leg menu goes.

**Files:**
- Create: `js/facts.js`, the facts for a sport, pure.
- Modify: `js/planner.js`: `openRouteCard()` and `openStretchCard()` replace `openLegMenu()`; `onMapClick()`, `onLinePress()`, `renderGhosts()`, `keyPoint()`, `stretchAt()`, `setStretch()`; `setLegSport()`, `setLegMode()`, `setStyle()` take `{ commit = true }`.
- Modify: `js/main.js`: `openRoute()` opens the route's card.
- Modify: `css/app.css`: `.card-pill`, `.card-pin`.
- Test: new group `routecard`; update `routemenu` (`ROUTE_MENU`, `QUICK_TAPS`), `editing`, `otherways`, `multi`, `stops`, `avoid`, `sweep`, `routeview`.

**Interfaces:**
- Produces, in `js/facts.js`:
  - `SPORT_FACTS = { mtb: ['clock', 'grade', 'mtb'], gravel: ['clock', 'grade', 'surface'], road: ['clock', 'grade', 'surface'], hike: ['clock', 'grade', 'sac'], trailrun: ['clock', 'grade', 'sac'], run: ['clock', 'grade', 'surface'], paddle: ['clock', 'wind', 'temp'], swim: ['clock', 'wind', 'temp'] }`.
  - `headline(a, i, sport) → [{ key, value, label, missing }]`, three of them, at analysis sample `i`.
  - `wayFacts(tags, sport) → [{ key, label, value, missing, src }]`: the sport's own first, then the rest.
  - Labels: "you're here", "uphill" or "downhill", "difficulty" (MTB S0–S5), "trail grade" (SAC T1–T6), "surface", "wind", "temperature".
  - Missing: "? difficulty not mapped", "? trail grade not mapped", "? surface not mapped", "? no terrain here", "? not known yet" (weather).
- Produces, in `js/planner.js`:
  - `keyPoint(i) → boolean`, as above.
  - `stretchAt(li) → { from, to }`: point indices, `from` the last key point ≤ `li`, `to` the first ≥ `li + 1`.
  - `openRouteCard(li, ll, { from = 'map' })`, `openStretchCard({ from, to }, { edit = false, at = null })`. A stretch's `alive()` holds its two end points, not indices.
  - `setStretch({ from, to }, { sport, mode, style })`: one step of Undo for every leg in it.
- Consumes: `CardHost`, `num()` (part 1).

- [ ] **The checks (`routecard`).** Straight legs, mocked BRouter where a leg follows paths.
  - A tap in the middle of a leg: `p.cards.current.kind === 'route'`; the pill's bottom within 60 px above the tap; points and Undo unchanged.
  - The pill: one more point, within 2 m of the line at the tap; one step of Undo; no routing request.
  - 1440 × 900: the card's first button reads "Add a point here", within 30 px of the click. At the window's right edge it opens to the left, on screen. Near the bottom it opens upwards, its action still within 30 px of the click.
  - MTB: labels `['you’re here', /uphill|downhill/, 'difficulty']`. On a way with no `mtb:scale`: a dashed tile, "? difficulty not mapped".
  - Hike: the third label is "trail grade". What's under still lists MTB difficulty.
  - Three unnamed via points between two named ones: This stretch reads "A → B" and "its 4 legs".
  - Edit this part, Paddle: every leg of the stretch is paddle and Over water; the legs outside are unchanged; one step of Undo.
  - The ways offered: land `['Follow paths', 'Straight line']`, water `['Over water', 'Straight line']`, a followed LIPAS leg none.
  - Other ways only on a one-leg stretch.
  - Touch: held still 0.5 s on the line → Edit this part. Held 0.3 s, then a move of 30 px → reshaped, one point after the release. A 0.2 s tap → the route's card.
  - Right-click on the line → Edit this part.
  - A quick tap on a busy page (#293) → the route's card, nothing in Undo.
  - The route's view: the card has no pill; Edit this part's Sport switches to editing first.
  - The planner put away: a tap on the route opens the planner and the route's card.
  - A card open while the leg's routing answer comes in: its numbers change, it stays open.
- [ ] **Build** `facts.js`, then the cards. The route's numbers come from `routeReadout()`'s sources, `roadAt()` and `a.attr[i].tags`. `onLinePress()`: the split waits for the first move after the 300 ms hold; held still to 500 ms, Edit this part opens and nothing is split.
- [ ] **Groups to run:** `routecard routemenu editing otherways multi stops avoid sweep routeview pointcard water loops`.

---

## Part 3. Check in three groups

**Title:** Phase 25d: Check says how serious and how sure.

**For people:**
- Heads-up becomes three groups, each a heading: **Read before you go**, **Worth a look**, **Not checked** [jc-check].
- Each item says where it comes from: "Live · Fintraffic, 18:40", "From the map · OpenStreetMap", "An estimate · the terrain model", "Calculated · the sun's times".
- A source that didn't answer is in Not checked, with Retry: Fintraffic, trail details, winter ways, the weather, the water's sources, the terrain.
- It stays there until the source answers. A later note can't replace it (#265).
- At the end: what was looked at for this route, and that nothing listed doesn't mean open, safe or allowed.
- The tab's badge: the Read count with a triangle, in the warning colour. Otherwise a neutral count. "?" beside it when something wasn't checked.
- Every action stays: Avoid, Short cut, Use BRouter, Retry, ⋯ (hide this kind, fix the map), the hidden kinds to bring back. Within a group the order is along the route.

**Where each item goes.** Made where it's made; the text is today's.

| Item | Made in | Group | Source |
|---|---|---|---|
| Road works; Traffic incident | `hazardsAlong()`, `js/safety.js` | Read | Live · Fintraffic, with the time |
| Road conditions | `hazardsAlong()` | Read | An estimate · Fintraffic's road weather |
| Busy road | `hazardsAlong()` | Worth a look | An estimate · Fintraffic's yearly counts |
| Cycling not allowed; Alpine terrain (SAC T4+) | `findWarnings()`, `js/analysis.js` | Read | From the map · OpenStreetMap |
| Marked no access; Marked no walking | `accessRow()` | Read | From the map · OpenStreetMap |
| Marked private | `accessRow()`, `standInAccess()` | Worth a look | From the map · OpenStreetMap |
| Goes round a way marked private; a point moved off one | `detourWarnings()` | Worth a look | From the map · OpenStreetMap |
| Steps; Technical trail; Unpaved; Carry; Ferry | `findWarnings()` | Worth a look | From the map · OpenStreetMap |
| Steep climb; Steep descent; Very steep | `findWarnings()` | Worth a look | An estimate · the terrain model |
| Straight line | `findWarnings()` | Worth a look | Calculated · how you drew it |
| Trail details: hard to follow, overgrown, wet, fallen trees, fords, boardwalks, barriers | `trailWarnings()` | Worth a look | From the map · OpenStreetMap |
| Shipping lane | `waterWarnings()` | Read | From the map · Väylävirasto and OpenStreetMap |
| Rough water | `waterWarnings()` | Read | An estimate · the waves, from the forecast |
| Harbour basin; Rock or shoal | `waterWarnings()` | Worth a look | From the map · Väylävirasto and OpenStreetMap |
| In the dark | `darkWarnings()` | Read | Calculated · the sun's times |
| After sunset; Before sunrise | `darkWarnings()` | Worth a look | Calculated · the sun's times |
| Frostbite risk; Very cold; Slippery around 0 °C; Ice season | `winterWarnings()` | Read | An estimate · the forecast |
| Snow on the way; Snowing on the way | `winterWarnings()` | Worth a look | An estimate · the forecast |
| No access in winter | `winterWarnings()` | Read | From the map · winter tags |
| Beside a ski track; Not ploughed; Opens slowly after snow | `winterWarnings()` | Worth a look | From the map · winter tags |
| On the ice | `iceWarnings()` | Read | Calculated · your route over the ice |
| Gear left behind; A short night | `stopWarnings()` | Worth a look | Calculated · your stops and times |
| Legs not routed yet | `renderWarnings()` | Read | The router, as today |
| Legs routed by Valhalla | `renderWarnings()` | Worth a look | The router, as today |
| The terrain; the water's sources; Fintraffic; trail details; winter ways; the weather, when they don't answer | the loaders below | Not checked | the source's name |

**Files:**
- Modify: `js/analysis.js` (`findWarnings()`, `accessRow()`, `trailWarnings()`), `js/safety.js` (`hazardsAlong()`): `tier` and `src` on each item.
- Modify: `js/planner.js`: the same on its own items; `loadHazards()`, `loadTrail()`, `loadWinterAlong()` keep a failure on `a` (`a.hazardsError`, `a.trailError`, `a.winterError`, as `a.windError`); `headsUp()`, `lookedAt()`, `retryWater()`; `renderWarnings()` in three groups; the tab's badge.
- Modify: `css/app.css`: `.tier-read`, `.tier-look`, `.tier-not`, `.src`.
- Test: new group `heads`; update `access`, `detour`, `shortcut`, `sweep`, `winterroute`, `terrain`, `water`, `water_late`, `stops`.

**Interfaces:**
- Produces: on every item, `tier: 'read' | 'look'` and `src: { kind: 'live' | 'map' | 'estimate' | 'calculated' | 'router', by: string, at?: number }`.
- Produces: `headsUp(a) → { read: Item[], look: Item[], not: { key, text, note, retry }[], hidden: Map<string, number> }`. `key` is one of `'terrain' | 'water' | 'hazards' | 'trail' | 'winter' | 'weather'`. Parts 4 and 5 read it.
- Produces: `lookedAt(a) → string[]`, `retryWater()` (routes again the water legs a source was missing for).

- [ ] **The checks (`heads`).**
  - Each row of the table: its maker, fed the smallest input that makes the item (as the groups above do), lands in its group with its source. `[...read, ...look].every((w) => w.tier && w.src && w.src.by)`.
  - On one fixed route the number of items is the same as on `main`: nothing lost.
  - `app.hazards` throws: Not checked has Fintraffic, with Retry. Retry with a working answer: the item goes, and Road works is in Read.
  - The same for trail details, the weather (the forecast answering 500) and the water (a source held back, then answering).
  - An answer for an older analysis changes nothing.
  - Badge: one Read item, `.pl-tab-n` reads 1 with the warning class. Only Worth a look: a neutral count. Not checked: "?" beside it.
  - A hidden kind stays hidden and is listed at the end.
  - What was looked at names Fintraffic only for a route on land in Finland.
- [ ] **Build** the fields where each item is made, then `headsUp()`, then the rendering.
- [ ] **Groups to run:** `heads access detour shortcut sweep winterroute terrain water stops multi`.

---

## Part 4. The warning on the route

**Title:** Phase 25d: a warning shows where it is on the route.

**For people:**
- **The peek's row,** in words: "1 to read before you go · Road works: Teiskontie", and a dashed "? 2" when sources didn't answer [jc-peek]. It shows while something is in Read or Not checked, and not while Check is in sight.
- **Markers on the route:** a filled triangle for Read, a dashed "?" for something not checked that has a place, an eye for Worth a look. The eyes show only while Check or an item is in view. Close ones merge, with a count; a tap shows the most serious first [jc-worst].
- **One item in view** [jc-step]: a tap on the row, a marker or an item in Check lights its stretch (#84), rings its marker, and shows an obstacle's icon whatever Layers says (#85). On a phone its card takes the peek: what, where, how sure, the note, Avoid or Retry, ‹ › along the route, All in Check.
- **Back** returns to where it was opened: the peek, or Check at half. So do Escape and a tap on the map.
- **Desktops:** the item is selected in Check and on the map together; no ‹ › [jc-desk-sel].
- A climb's row lights its stretch too (#84).
- A stretch a source didn't cover is dashed on the route: a terrain gap, a water leg routed without a source. A source missing for the whole route says so in words, with no marker [jc-rocks].
- **The planner put away:** the triangles stay with the route. A tap opens a card with Avoid and Open in the planner [jc-closed].
- **At 200 %** the item's card keeps what, where, ‹ ›, Back and All in Check [jc-200].

**Files:**
- Modify: `js/planner.js`: `drawHeads()`, `openItemCard()`, `stepItem()`; `els.readRow` in `buildPanel()`; `focusRange()` lights through `routeLit`.
- Modify: `js/style.js`: source `heads` (clustered: `clusterRadius` 24, `clusterProperties: { sev: ['max', ['get', 'sev']] }`), layers `heads-icon`, `heads-count`, `heads-ring`, `route-unchecked`.
- Modify: `js/icons.js`: the triangle, the "?" and the eye as map images.
- Modify: `js/inspect.js`: a click on `heads-icon` comes first while the planner is put away.
- Test: new group `onroute`; update `drawer`, `routeview`, `trails`.

**Interfaces:**
- Consumes: `headsUp()` (part 3), `CardHost` (part 1).
- Produces: `openItemCard(w, { from = 'row' | 'marker' | 'check' | 'section' })`, `stepItem(+1 | -1)`. Part 5's sections call `openItemCard(w, { from: 'section' })`.

- [ ] **The checks (`onroute`).** A route with road works (mocked Fintraffic) and two trail items, at 390 × 844 by touch and 1440 × 900 by mouse.
  - The row's text starts "1 to read before you go"; it's gone with Check in sight.
  - A tap on the row: the item's card in the peek; `routeLit` holds its stretch; the ring is on its marker.
  - ‹ › step along the route in order; "2 of 3".
  - Back: the peek as it was. Opened from Check: Check at half again.
  - A tap on the map with the card open closes it and adds no point.
  - Trail details off in Layers: the item's obstacle icon still shows while it's in view (#85).
  - A climb's row lights its stretch (#84).
  - Two items 10 m apart: one marker with "2"; a tap shows the Read one first.
  - The eyes: none at the peek, all with Check open.
  - The planner put away: a tap on the triangle opens its card; Open in the planner opens the planner at it.
  - A late answer adds an item while the card is open: the count and "x of y" update.
  - 200 %: the card ≤ 50 % of the window, its marker on screen above it.
- [ ] **Build** the row, then the layers, then the item's card.
- [ ] **Groups to run:** `onroute heads drawer routeview trails colours fit toolbox 390x844 360x740`.

---

## Part 5. Points and stretches in the list, and Reorder

**Title:** Phase 25d: the route's list in sections, with Reorder.

**For people:**
- **Route's list is sections** [jd-multi]. A new one starts where the sport changes, at a stop and at a night.
- Each section: its sport and its two ends; its distance, time and climb; a short forecast for its end ("9° · 4 m/s", the rest a tap away in Go); its warnings, which open the item on the route.
- **Point rows** for the points you see: the name, then "there at 07:58 · 5.7 km · Via 4", and a stop, night or change of sport.
- **Stretch rows** between them: "5.7 km · 31 min · ↑108 m · via 3 shaping points". An arrow unfolds the shaping points.
- A tap on a point opens its card; on a stretch, its card. Back returns to the list as it was: the same scroll, the same unfolded rows.
- **Reorder** at the top [jd-reorder]: every point with its grip, Earlier and Later. A mouse drags by the grip; a finger holds 0.45 s first, so a scroll never drags. Done goes back to the sections.
- **Desktops:** ↑ and ↓ move between rows, Enter opens, Alt+↑ and Alt+↓ move a point, Delete removes it with Undo.
- **The route's view:** the same sections, no Reorder. A card's actions follow part 1's rule.
- Long names wrap; numbers stay whole (360 × 740, Finnish) [jd-fi].
- A followed LIPAS route is one section on its own line [jd-lipas].

**Files:**
- Modify: `js/planner.js`: `renderWaypoints()` draws `sections()`; `dragRow()` takes a touch hold; the list's keys; `els.pointsFoot` loses All leg settings.
- Modify: `css/app.css`: `.sec2`, `.wpl-point`, `.wpl-stretch`, `.reorder`.
- Test: new group `sections`; update `drawer`, `stops`, `multi`, `routeview`, `backtostart`, `lipas`.

**Interfaces:**
- Consumes: `keyPoint()`, `stretchAt()`, `openPointCard()`, `openStretchCard()`, `openItemCard()`, `headsUp()`.
- Produces: `sections() → [{ from, to, sport, ends: 'stop' | 'night' | 'sport' | 'finish', stretches: [{ from, to }] }]`. `this.unfolded`, a `Set` of stretches' first points, in memory only. `this.reordering`, a boolean.

- [ ] **The checks (`sections`).** Straight legs.
  - MTB for three legs, then Paddle for three: two sections, their titles start "MTB" and "Paddle"; the change point's row reads "Change to Paddle".
  - A stop at via 4 makes three sections; a night ends one with its morning's start.
  - Six unnamed via points: one stretch row, "via 6 shaping points". Unfolded: six rows. Open a card, Back: still unfolded, `scrollTop` within 2 px.
  - A stretch row opens its card; Edit this part changes every leg in it.
  - A section's warning opens that item's card.
  - Reorder: Earlier on via 2 swaps it, one step of Undo. A mouse drag drops it at place 4. A touch held 0.45 s drags; a move of 30 px within 0.2 s scrolls and never drags. Done: the sections.
  - Keys: Alt+↓ moves; Delete removes, with Undo in the note.
  - The route's view: no Reorder, no grip; a row opens its card.
  - A 52-point route draws in under 150 ms; its key points are in view, the rest folded.
  - Every row at least 44 px tall on the phone; no "…" at 360 × 740 in Finnish.
- [ ] **Build** `sections()`, then the rows, then Reorder and the keys.
- [ ] **Groups to run:** `sections drawer stops multi routeview backtostart lipas pointcard routecard toolbox`.

---

## Part 6. The long press and the spot's card

**Title:** Phase 25d: hold the map to see what's there and add it to your route.

**For people:**
- **Hold the map still for 0.5 s,** within 10 px: a ring fills under the finger, then the spot's card [p-press, p-spot]. Let go sooner and it's a tap. A move or a second finger is the map's own.
- **Right-click** on a desktop: the same card at the pointer [d-spot]. A right-drag still turns the map.
- **The card:** what's there and its line ("Forest path", "Easy to ride · dirt"); **More ›**; then **Start here**, **End here**, **Round trip from here**, **Avoid this spot**.
- **+ Add to my route** in the pill puts the point where it fits: where it adds the least distance, between two points or after the finish, never before the start [p-added]. The note says where ("Point added after Via 1"), with Undo.
- With no route the pill says **+ Start a route here** [p-none].
- **A tap on a place's icon** while drawing shows its card instead of adding a point [p-place]: a campfire site, a toilet, a lean-to, a LIPAS place, an obstacle. A tap on a road, a trail or the open map still adds a point.
- A place's card: its name and kind, its source, three labelled facts, More ›, the same actions and pill.
- The route's view: no pill. The planner put away: the card at the spot.

**Files:**
- Modify: `js/planner.js`: `bindHold()` replaces `bindSpotMenu()`; `openSpotCard()` replaces `openSpotMenu()`; `openPlaceCard()`; `bestInsert()`, `addWhereItFits()`, `insertAt()`; `onMapClick()` checks places first.
- Modify: `js/hover.js`: export `describe()` for the card's line.
- Modify: `js/facts.js`: `placeFacts(props, kind)`, three a kind.
- Modify: `css/app.css`: `.hold-ring` (a still ring with reduced motion).
- Test: new group `spotcard`; update `routemenu` (`QUICK_TAPS`: "This spot" becomes the spot's card), `routeview`, `start`.

**Interfaces:**
- Produces: `bestInsert(ll) → { after: number }`: the index the new point follows, by straight-line distances, never `-1`.
- Produces: `insertAt(li, ll)`: a point at `ll` exactly, between points `li` and `li + 1`; both new legs keep the leg's mode, sport and style and are routed (two calls through `request()`).
- Produces: `addWhereItFits(ll)`: `splitLeg()` when `ll` is within 30 m of that leg's line (no call), else `insertAt()`; one step of Undo; the note.
- Produces: `openSpotCard(ll, { feats })`, `openPlaceCard(f, ll)`.
- Places that open a card: layers `poi-outdoor`, `poi-minor`, `label-peak`, `lipas-point`, `td-points`, within the hit box (12 px touch, 6 px mouse).

- [ ] **The checks (`spotcard`).**
  - Touch held 0.5 s: the spot's card. Held 0.3 s: one point, no card. A move of 12 px at 0.2 s: the map pans, no card, no point. Two fingers: nothing.
  - A late touchend under 0.5 s on a busy page (#293): a tap.
  - Android's `contextmenu` after the hold: no second card.
  - The ring shows from 0.15 s of the hold, and goes after it.
  - Right-click: the card at the pointer. A right-drag of 40 px turns the map and opens nothing.
  - Points A, B, C. A spot beside the middle of A–B: the new point is at index 1. Past C: at the end. Behind A: index 1, never 0. The note reads "Point added after Start". Undo: as before, one step.
  - Start here: the new start at the spot. End here: the new finish.
  - A tap on a rendered `poi-outdoor` icon while drawing: its card, no point. A tap on the path beside it: a point.
  - No route: the pill starts a route with one point, editing.
  - The planner put away: a hold opens the card at the spot.
- [ ] **Build** `bindHold()` from `bindSpotMenu()`'s guards (a second finger, a move, a late touchend, Android's `contextmenu`), at 500 ms. Then the cards, then Add to my route. The planner's hint (`els.hint`) and `TIPS` say what a tap and a hold do now.
- [ ] **Groups to run:** `spotcard routemenu routeview start editing pointcard routecard`.

---

## Part 7. What's there, in levels

**Title:** Phase 25d: a card says a little; More says the rest.

**For people:**
- **More ›** [p-more]: your sport's details first, then the other sports', then the spot: its height, its coordinates with **Copy**, and when it was last checked.
- **A place's More** is grouped [p-placemore]: at the site, getting there, when it's open, last checked, links. A toilet has its fee, opening hours, seasons, wheelchair access, its kind and who runs it, as far as the map knows.
- **All OpenStreetMap details** [p-osm]: the map's own data, asked for when you press it, for a way or a place.
- **Not right?** on every card [p-notright]: OpenStreetMap's note page at the spot, which needs no account, or its editor for that way or node. LIPAS's page for a LIPAS place.
- **The sport orders the facts, never hides them** [w-hike]. **A missing fact says so** [w-missing].
- **With the planner put away,** the map's own cards for a way, a place and a LIPAS route or place have the same levels. Ships, cameras, sea marks, road works and the water's depth keep their cards.

**Files:**
- Modify: `js/inspect.js`: `renderWay()`, `renderPoi()` and `renderLipas()` in levels; `OSM_KEYS` grouped; `osmDetails()` from the button that's there today; `notRight()`.
- Modify: `js/facts.js`: the groups and the rest of each kind's facts.
- Test: new group `facts`; update `sweep` (Show all OSM tags), `trails`, `winter`, `lipas`.

**Interfaces:**
- Produces: `osmDetails({ type, id } | { ll }) → Promise<{ type, id, tags, len }>`, through `overpass()`, once a card.
- Produces: `notRight(ll, osm = null) → string`: `https://www.openstreetmap.org/note/new#map=19/<lat>/<lon>`, or `…/edit?<type>=<id>`.
- Last checked: from `check_date` once the details are in; until then the row isn't shown.

- [ ] **The checks (`facts`).** Recorded or mocked tiles and Overpass.
  - MTB, a way with no `mtb:scale`: More shows "? difficulty not mapped". Hike: the trail grade first, MTB difficulty further down.
  - All OpenStreetMap details: one Overpass request. A second press asks nothing. A failure says OpenStreetMap didn't answer, and the button stays. An answer after the card closed changes nothing.
  - Copy: the clipboard reads "61.50250, 23.76000".
  - Not right?: the note link at the spot; for a way with an id, the editor's link.
  - A toilet with `fee=no` and `opening_hours`: both rows. No `wheelchair`: "? wheelchair access not mapped".
  - The planner put away: a path's card has More; a ship still opens its own card.
- [ ] **Build** the levels on `renderWay()` first, then places, then LIPAS.
- [ ] **Groups to run:** `facts sweep trails winter lipas spotcard routecard`.

---

## Part 8. Share a spot, and Weather here

**Title:** Phase 25d: share a spot, and see its weather.

**For people:**
- **Share** on every card. A phone opens its share sheet: a link to the spot, its name and coordinates. Elsewhere the link is copied, and a note says so [p-shared].
- **The link** opens Polku at the spot, with a pin and its card. It carries only the spot and the map's view: never the route, never where you are. Links without it open as before.
- **Weather here ›** opens the timeline held at the spot. Its readout is for the spot until it closes or you pick another.

**Files:**
- Modify: `js/planner.js` (Share on the cards), `js/main.js` (reads `pin` and `pn` beside `parseShared()`), `js/wxmap.js` (`holdAt()`, `release()`).
- Test: new group `sharespot`; update `avoid` and `changelog` (a route kept through a reload).

**Interfaces:**
- Produces: `spotUrl(ll, name) → string`: `?pin=<lat>,<lon>&pn=<name>#15/<lat>/<lon>`, five decimals, the name up to 80 characters.
- Produces: `parsePin(params) → { ll, name } | null`: finite numbers, |lat| ≤ 90, |lon| ≤ 180; else `null`.
- Produces: `WeatherOverlay.holdAt(ll)`, `release()`. While held, the readout uses `ll` instead of `pointerLL`.

- [ ] **The checks (`sharespot`).**
  - `navigator.share` stubbed: called once, its url has `pin=61.50250,23.76000`, its text the name and the coordinates. Without it: the clipboard has the link, and the note says it was copied.
  - The link in a clean page: a pin at the spot and its card. A saved route stays as it was.
  - `pin=abc` and `pin=200,10`: ignored, no console error.
  - An old route link (`r=`) opens as before.
  - Weather here: the timeline open, `heldLL` at the spot. Closed: released. No request carries the spot's coordinates.
- [ ] **Build** the link and its reading first, then Share, then Weather here.
- [ ] **Groups to run:** `sharespot avoid changelog weather radar spotcard`.

---

## Part 9. The keyboard's crosshair

**Title:** Phase 25d: the map by keyboard: a crosshair for a tap and a long press.

**For people:**
- **Tab to the map:** a crosshair in its middle, and the keys listed on the map [d-key].
- **The arrows** move the map, as MapLibre's own keys do.
- **Enter** does what a tap does at the crosshair: a point while drawing, the route's card on the route, a place's card on its icon.
- **Shift+F10, or the menu key,** does what a long press does there.
- **Escape** closes the card, and the focus goes back to the map.
- The crosshair goes when the map loses focus. A touch never shows it.

**Files:**
- Modify: `js/gestures.js`: `bindCrosshair(map, app)`.
- Modify: `css/app.css`: `.crosshair`, `.map-keys`.
- Test: new group `crosshair`.

**Interfaces:**
- Consumes: `onMapClick()` and the hold's `openSpotCard()`, called with the map's middle as the point.

- [ ] **The checks (`crosshair`).**
  - Tab to the canvas: the crosshair and the list of four keys show.
  - Enter while drawing: one point at the map's middle, within 1e-5°.
  - The middle on the route: Enter opens the route's card.
  - Shift+F10: the spot's card at the middle.
  - Escape: closed, `document.activeElement` is the canvas.
  - Blur: the crosshair is gone.
- [ ] **Build** `bindCrosshair()`.
- [ ] **Groups to run:** `crosshair spotcard routecard pointcard`, then the whole suite.
- [ ] **This part's PR fixes #233 and #345,** with this plan's Built section complete.

---

## Not in 25d

- A form in Polku that posts a note to OpenStreetMap: #347.
- A swipe below the peek that puts the route away: #338.
- Find a point by name, and Move to a number: an issue, if decision 4 stands.
- A test with someone new (§8's script): after part 5, and again after part 9.

## Built

Each part adds what it built here, as the calmer planner's Built section does.
