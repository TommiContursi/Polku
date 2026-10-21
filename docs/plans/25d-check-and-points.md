# 25d: Check, points and the map's cards (#233, #345)

The implementation plan for the last part of Phase 25. What's still to do, and its status, is on GitHub: #233 and #345, in the [Phase 25](https://github.com/TommiContursi/Polku/milestone/16) milestone.

- **Status (2026-10-21): approved,** with Revision 4 chosen (#355) and Revision 5's desktop changes; see "Where 25d stands" below.
- **What it builds:** journeys C and D of the [calmer planner](issue-233-calmer-planner.md#revised-journeys-2026-10-20-proposals), and #345's [map cards](issue-345-map-cards.md).
- **The mock-ups:** [the map cards'](mockups/issue-345-map-cards.html) with **Cards: Revision 5** (the default) is what to build; **As approved** and **Revisions 1 to 4** stay there to compare. Every control in Revision 5 does what it says, or says in a note what the app would do. The planner's mock-up keeps sections C and D for the list, Check and the row ([phase-24-planner.html](mockups/phase-24-planner.html)); where its cards differ from the revised ones (the point's card [jd-card, jd-day], the stretch's settings [jd-leg, jd-stretch], the item's card [jc-step]), the revised ones win. Frame ids are in brackets below.
- **How to build it:** one part a session, one PR a part (part 1 in two), in this order. Each session starts from the last Hand-over on #233 (AGENTS.md).

## Where 25d stands

The one list of what's decided, what waits for the user and what's next. The other plans (the calmer planner's, #345's) and the mock-ups' older versions are background: where they differ, this list wins. Each part's detail is further down.

**Decided by the user**
- *2026-10-21, the order of parts below (#355), and in the morning (b21a63c):* Change sport on a point changes the legs to the next change of sport; All leg settings goes; Find and Move to wait (#350); Check's groups as part 2's table says; with the planner put away a card opens at the spot; on a desktop a card from the list opens beside the panel.
- *2026-10-21, the cards:*
  - **At this point:** Pass by · Stop · Night, with the minutes (− 30 min +) or the morning's hour under it.
  - **Start here** and **End here** on a point and on a spot, each with a line on what it does. "End", not "finish".
  - **What's here ›** on every card.
  - **Only what can be done now:** with no route, Start a route here and Round trip; by the line, Add a point here.
  - **Undo and redo** stay while a card is open. The phone's back gesture closes the card.
  - **The first point's peek** says "Hold the map to see what's there."
  - **In the route's view,** the planner's "You're not editing" note, with Edit.
  - **The look is Revision 5** (Revision 4, chosen 2026-10-21 in #355, with the user's desktop changes the same day): Revision 1's look, with Back in words; plain rows on phones, each with its icon, a hairline between rows, and a hover on desktops; a line under every item of a list (all or none, so a list reads alike); compact cards on desktops, where every line is the row's tooltip.
  - **Desktops (Revision 5):** a card is 320 px wide and 480 px tall at most, scrolling inside. A row with › goes somewhere; an action is a button with its icon and name, two a row (a point's Start here and End here, Move and Rename; a spot's Your route; a stretch's actions), and **Remove** is a red button on a row of its own. While a point's card is open, its row in the planner's list is lit; the card doesn't move there.
  - **The start and the end have Reverse** ("The route runs the other way, from the end to the start"); the end has Back to start too. **End here** has a flag.
  - **25d stays within the cards:** the toolbar, the start and the ⋯ menu don't change.
  - **Don't redesign what works.** Keep one style throughout, with a different element only where the job is different. Every version stays in the mock-up to compare.
- *2026-10-21, the app's controls (#356):* black icons in lists (the ⋯ menu, the cards), green on the start's tiles and in switches; the chosen chip green with a border everywhere; one stepper, − 30 min + in one box with the number typable, for the cards and the round trip; switches with icons where they help, and one chosen look for all: white, black words, a green icon or tick.
- *Its own issue, not 25d:* hover information over the map on desktops, like the route's tooltip (#358).

**Waiting for the user**
- **#357:** the rule for shared controls.

**To reconsider in a later part** (the user, 2026-10-21): #364. It covers when you leave and when you go on (any time, not a few fixed hours); where Avoid this spot belongs; and On the profile on the route's and a point's card.

**Next**
1. Done: #356's fix the cards need, the route's numbers' labels wrap (#360).
2. Then #352 is restyled to Revision 5's frames as 1a (its desktop card, the edits as buttons, Reverse, the lit row), then 1b.
3. Before parts 2 to 4: the planner mock-up's C and D frames (Check, the row, the list's sections and rows) get a Revision 5 version behind a switch: the same rows, warning box, switch and words as the cards, and nothing else changed. The user chooses it before part 2.
4. Then parts 2 to 6, in the order below.

> **For agentic workers:** use superpowers:executing-plans for one part at a time. Steps use checkboxes (`- [ ]`). AGENTS.md wins where they differ: no subagents to verify or run the suite.

**Goal:** a tap on a point, the route, a warning or a place shows one card; a long press or a right-click shows what's there and what you can do; Check sorts every Heads-up item by how serious and how sure.

**Architecture:** one card component (`js/card.js`, `CardHost`) shows every card, the map's own cards included: in the planner's peek on a phone, at the pointer on a desktop, at the spot with the planner put away. Every card is built to Revision 5's frames, from the shared controls (below). The cards' contents go in `js/cards.js`, which builds them from what the planner gives it; `js/planner.js` (5,700 lines) keeps the actions. The facts come from one module (`js/facts.js`), ordered by sport. Heads-up items get a group and a source where each is made.

**Tech stack:** plain ES modules, MapLibre, `tools/smoke.py` with headless Chrome. Nothing new to install.

**Spec:** [issue-233-calmer-planner.md](issue-233-calmer-planner.md) (§6, C, D, §8, §10) and [issue-345-map-cards.md](issue-345-map-cards.md). Read both with this plan.

## The order, and why

Five things are shared, and each part builds what it shares before a later part uses it:

| Shared | Built in | Used in |
|---|---|---|
| The card and its parts: the mark and name, the numbers, the switch, groups of items, the one filled button, the "You're not editing" note, Back, the peek, undo and redo | 1 | every part |
| Key points and stretches (`keyPoint()`, `stretchAt()`) | 1 | 1, 4 |
| Heads-up's groups and sources (`headsUp()`) | 2 | 3, 4 |
| Taps and holds on the map, and the keyboard's way to them | 1 (taps), 5 (holds and keys) | 5, 6 |
| The facts in levels (`facts.js`, What's here) | 1 (three numbers), 6 (levels) | 5, 6 |

1. **The cards on the route and its points** (two PRs: 1a the card and a point's card, #352 restyled; 1b the route's and a stretch's cards). *Why first:* the point's and the stretch's cards are the same component, and "The stretch after it ›" needs the stretch's card. Today's point and leg menus go here.
2. **Check in three groups.** Before anything else shows a warning's group or source.
3. **The warning on the route.** Journey C whole.
4. **The list in sections, with Reorder.** It opens point, stretch and warning cards, so it comes after all three.
5. **Holds and keys:** the long press and right-click on the route and the map, the spot's and a place's cards, the first point's hint, and the keyboard's crosshair in the same PR.
6. **What's here, in levels, with Share and Weather here,** and the map's own cards moved onto `CardHost`: one card system.

## For you to decide

Each has a recommendation. The plan is written with it. 1 to 8 were approved at b21a63c (6 is revised); 9 to 14 are new.

1. **The order:** as above (revised).
2. **Change sport on a point** changes the legs from that point to the next change of sport, or to the end. One stretch only is Edit this stretch. *Why:* #345 asks for both, "from a point onward" and "for one part only".
3. **All leg settings goes.** Each stretch row says its sport and how it's drawn, and Edit this stretch is one tap away.
4. **Find and Move to wait** (#350). Folding, Reorder and a point's Move cover them.
5. **Items §6 doesn't place** go as the table in part 2 says: road conditions in Read before you go; twilight, snow on the way and snowing in Worth a look; on the ice in Read before you go.
6. **In the route's view** (revised), a card shows what works there (a point's stop or night, the start's leaving time) and ends with the planner's own note, "You're not editing: the route stays as it is.", with **Edit** [r-view-point, r-view-route]. What only editing can do isn't shown, and nothing switches to editing on its own. *Why:* the Route tab already says it so (25c), and a card shows only what can be done now.
7. **With the planner put away,** a card opens at the spot, on phones too. The peek holds cards only while the planner is open.
8. **On a desktop,** a card from the list opens beside the panel at its row [jd-desk]. A card from the map opens at the pointer [d-route].
9. **The look is Revision 5** (below). *Why:* the user preferred Revision 1's look in most places (the warning box, the rows with values, darker text, the switch with icons, Night and Leave at, the rename field), with Back in words, an icon on every row, a line under every item of a list, and compact desktops.
10. **Start here and End here, on a point and on a spot,** each with one line on what it does. On a point: "The part before it is removed, Undo brings it back", "The part after it is removed, Undo brings it back". On a spot: "Adds a new start point", "Adds a new end point". **End**, not finish, on every card and note.
11. **What's here ›** on every card, for the map's details: one name instead of What's here and More.
12. **Only what can be done now:** no route, only Start a route here and Round trip from here; a spot by the line, Add a point here; in the route's view, no pill.
13. **Undo and redo stay while a card is open,** as they do for the round trip (#311); at 200 %, where there's no room above the card, they sit in the card's top row, as 25a docks the toolbox.
14. **The first point's peek** says "Hold the map to see what's there." until the second point.

## Global constraints

Every part's requirements include these.

- Every network call goes through `request()` in `js/net.js`.
- Never burst brouter.de. Tests use straight legs, mocked BRouter or `tools/fixtures/`.
- Traficom's depths are shown, never routed on.
- Share and Weather here send a spot you chose on the map, never your position, and only when you press them. A spot's link has five decimals.
- Missing, late or partial data never looks complete. A missing fact says so in its place.
- Saved routes, settings and share links keep working, old ones too. No stored format changes. New: the spot link's `pin` and `pn` (part 6).
- Every Heads-up item of today stays, in one group, with its source. An item with no group shows in Read before you go, so a forgotten one looks more serious, never less, and logs a console error, so a check fails.
- Every action of today's point menu, leg menu and spot menu stays, moved to a card.
- **Stay within the cards.** The toolbar, the start, the ⋯ menu and the rest of the planner don't change in 25d, except where a part says so (the peek's row in part 3, the list in part 4).
- WCAG 2.2 AA. 44 px targets on phones, 40 px on desktops, 8 px apart. Keyboard and screen readers. Reduced motion. Never colour alone.
- No framework, dependency or build step.

### How every card is built

**To Revision 5's frames** (the mock-up's default). Revision 5 is Revision 1's look with the user's changes of 2026-10-21 (Revisions 3 to 5). In the code, a part that does the same job as a control the app already has uses it, with its class (DEVELOPING, "Shared controls"). The rest are new shared controls, added to that list once #355 is chosen.

| In a card | In the code |
|---|---|
| Back in words, ✕ | the app's `btn small quiet way-back` and `tool way-x`; with Back, both on a row of their own |
| The name and its line | the app's `way-hint` (17 px, 13.5 px), with the thing's own mark from the map left of it (new: `card-mark`) |
| Three numbers | the app's `sum-item`, its labels wrapping (#356) |
| At this point: Pass by · Stop · Night | the app's `seg`, as a variant with icons over the words (new: `seg icons`); the chosen one as every switch's: white, black words, a green icon (#356) |
| A stop's minutes | one stepper for the round trip and the cards: − 30 min + in one box, the number typable (#356) |
| Rows: This stretch, What's here, Edit this stretch, The stretch after it, Sport from here: MTB, Leave at: Now, Route style: Balanced, Not right?'s links, and the actions (Move, Start here, Remove) | one plain row: always an icon, its name, its line, a value in the accent colour, ›; a hairline between rows; a hover on desktops; Remove in red, apart (new: `row`, which the app's `speed-sport-row` can share, #356) |
| A warning on a stretch | the yellow box with its words (new: `warn-row`, which part 3's row in the peek uses too) |
| The one main action | the app's `btn primary big` |
| The route's view | the app's `pl-viewnote` |
| Take the bike along | the app's `tg` |
| Rename | the name typed where it's shown, with Save (new: `name-field`) |
| What's here's facts | the app's `insp-row` |
| Share, Weather here, Not right? | the app's `btn quiet`, 44 px on phones |

- **A line under every item of a list,** or none in that list, so a list reads alike (the user, 2026-10-21). The line says what the name doesn't: what an action removes or adds ("The part before it is removed, Undo brings it back"), how far it reaches ("To the next change of sport, or the end"), a stretch's two ends, or what's behind a row ("Sport, how it's drawn, style"). On desktops every line is the row's tooltip instead. Lines can be dropped in a later phase if they turn out to be clutter.
- **Every row that opens something has an icon** and ›, and a hover on desktops: they say it's a button without a box around it.
- **Desktops:** 320 px wide, 480 px tall at most; rows 34 px with a hover; a row with › goes somewhere, an action is a button with its icon and name, two a row; Remove a red button on a row of its own; the lines as tooltips; no heading above a group of buttons.
- **Narrow (200 %, a small phone):** Back, undo, redo and ✕ on a row of their own, the name the card's whole width; the numbers one to a row; the switch in a column. Words break only at soft hyphens.
- **The peek:** a card takes 52 % of the window at most on a phone, and scrolls inside, so the point or the spot stays in sight. On a desktop the card stays on the screen and scrolls inside.
- **The words:** the name first, one short line under it, no facts strung with dots, no brackets ("Forest path, 0.72 km from the start"). "There at", never "you're here". **Edit this stretch**. The ways are the app's: **Follow paths**, **Straight line**, **Over water**. Notes use the points' numbers ("Point added after Via 1"). Not right? says "Its mappers can fix what you tell them." One short word a grade (S0 easy, S1 fairly easy, S2 medium, S3 hard, S4 very hard, S5 and S6 extreme; T1 easy, T2 medium, T3 hard, T4 to T6 alpine), on its own line under the grade.

## Review focus

The cases the spec implies and a reviewer should try. Each has a check in the part named.

1. **A card open while the route changes under it:** Undo, a late routing answer, a point removed, a share link opened. The card follows its point or stretch, or closes. It never acts on an old index. Part 1.
2. **A source that fails, answers late, out of order, or comes back** while Check, the row or an item's card is open. Groups, counts and ‹ › update. Nothing shows twice or goes missing. Parts 2 and 3.
3. **Gestures that meet:** a long press, a pan, a pinch, the line's hold, a marker's drag, a busy page (#293), a right-drag that turns the map. Parts 1 and 5.
4. **Links:** old share links, a spot link beside a route link's parameters, bad `pin` values, saved routes after each part. Part 6 and every part's regression list.
5. **Small screens and big text:** 360 × 740 in Finnish with long names, 200 % zoom. A card takes 52 % of the screen at most, the spot stays in sight, nothing is cut with "…". Part 1 for the card; each part for its own.

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
- [ ] **Shared controls:** where a card part does the same job as one of the app's controls, it uses that control and its class; `css/app.css` gets no copy of one under another name (no `c2-`). New classes are only the new ones in "How every card is built", each added to DEVELOPING's "Shared controls".
- [ ] **Beside its frame:** open the part's frames in the revised mock-up (`?frame=<id>`, Cards: Revised) at the same size as the app, and compare the two screenshots side by side, at 390 × 844 and 1440 × 900, light and dark. A difference is a bug unless this plan says why.
- [ ] **The regression list** below, as a person would, at 390 × 844 and 1440 × 900.
- [ ] **Screenshots** before and after with `tools/shoot.py`, on `pr-screenshots` under the branch.
- [ ] **Docs in the same PR:** CHANGELOG (one entry), USING (controls), README (a capability), DEVELOPING (how it works), and this plan's Built section.
- [ ] **Commit, push, PR:** a draft in the Phase 25 milestone, titled "Phase 25d: …", with "Refs #233" (and #345 from 1b on). Out of draft once verified. Offer a review for parts 1, 4, 5 and 6: they touch routing, the route's shape or links.
- [ ] **Hand-over** on #233.

### The regression list

From the calmer planner's §10, for every part: drawing (add, drag a point, drag the line, a leg's mode and style); undo and redo; the profile and its colouring; Climbs; On the route's breakdowns and their colours on the map; On the map's marks; Go's time, departure and the weather along the route; Heads-up and Avoid; round trips (km and time, water loops); Other ways; stops and nights; changeovers; LIPAS; GPX and KML import, GPX export; share links, old ones too; offline save and preview; 3D and hover. In MTB, gravel, hike and paddle.

---

## Part 1. The cards on the route and its points

Two PRs, 1a then 1b, both before anything else. 1a is #352 restyled to the revised frames: its `CardHost`, history, focus, the point's re-keying through drags and Undo, and its checks stay.

### 1a. The card, and a point's card

**Title:** Phase 25d: a point's card, the same from the map and the list.

**For people:**
- A tap on a point opens its card. Phones: in the peek, the point ringed and in sight above it. Desktops: at the point [d-point].
- **The top row:** the point's own marker, its name, "Via 1" under it, ✕ [p-point].
- **Three numbers:** **10:09** there at, **1.65 km** from the start, **107 m** height. The start: **10:00** you leave and its height [r-start].
- **At this point** (a via point): one switch, **Pass by · Stop · Night**, showing what happens there now. Stop shows its minutes with − and +, and "You get here at 10:09 and go on at 10:39" [r-stop]. Night shows "Go on at 07:00 the next morning" and **Places to sleep nearby ›** [r-night].
- **Sport from here: MTB ›** opens the sports, with "your route" on the route's own [r-sport]; a pick changes the legs from here to the next change of sport, or to the end (decision 2). A change of sport then shows its changeover minutes and **Take the bike along** [r-change].
- **The stretch after it ›**, both ends named. Until 1b it opens today's leg menu.
- **Edit this point:** **Move** and **Rename** side by side; **Start here** and **End here** on a via point, each with its line (decision 10); a loop's via point has "Start here: the same loop, starting from this point" and no End here.
- **The start** has **Leave at: Now ›** ("Sets the times and the weather along the route"). **The end** has **Back to start** ("Adds a leg back to the start"), not on a loop [r-end].
- **Remove** apart, in red, "Undo brings it back"; the note names it, with Undo [r-removed].
- **Rename** types the name where it's shown, with **Save** [r-rename]. **Move** folds the card to a banner, "Tap where it goes", with Cancel; the point stays ringed [p-move]. Dragging stays.
- Back, Escape, the phone's back gesture and a tap on the map close the card; the tap adds nothing.
- **Undo and redo stay** above the card while it's open; the rest of the toolbox steps aside (decision 13).
- **The route's view:** the numbers, At this point (it still works), the start's leaving time, The stretch after it, and the note with Edit [r-view-point].
- At 200 % and at 360 × 740 in Finnish, as "How every card is built" says [r-200, r-fi]; in Hike [r-hike-point] and dark [r-dark] too.

**Files:**
- Create: `js/card.js`, `CardHost` and the card's parts (`head()`, `nums()`, `group()`, `item()`, `mainButton()`, `lockNote()`); `js/cards.js`, the cards' contents, starting with `pointCard()`.
- Modify: `js/planner.js`: `openPointCard()` replaces `openPointMenu()`; `renderMarkers()`; `onMapClick()`; `pickOnMap()`; `movePoint()`; `setSportFrom()`; the toolbox's `placeToolsNow()` (undo and redo stay).
- Modify: `css/app.css`: only the new shared controls in "How every card is built" (`card-mark`, `seg icons`, `row`, `warn-row`, `name-field`, `sum-item miss`, the pill); everything else is the app's existing classes.
- Test: `tools/smoke.py`, new group `pointcard`; update `stops`, `multi`, `backtostart`, `routeview`.

**Interfaces:**
- Produces, in `js/card.js`:
  - `class CardHost`, `constructor(map, { peek: HTMLElement, where: () => 'peek' | 'float', onChange: (card | null) => void })`.
  - `open(card, { at: [lng, lat] | null, beside: DOMRect | null, from: card | string | null })`. `from` is the card it came from, or the place: `'map'`, `'list'`, `'check'`, `'row'`, `'section'`. A card is `{ kind, key, title, sub, mark, build: (body) => void, alive: () => boolean, pill: { label, icon, fn } | null }`.
  - `back()` returns where the card came from as it was: another card, the list at its scroll and unfolded rows, Check at its height (parts 3 and 4 need this). `close()`, `refresh()` (builds the open card again; closes it when `alive()` is false), `get current()`.
  - The card's parts are the shared controls in "How every card is built"; `js/card.js` builds them with their classes.
  - Every card's history goes through `CardHost` (its `onPop` meets the planner's `pushWay()`); no card pushes its own.
  - The pill: placed by `CardHost` above the spot on a phone, as the card's first button on a desktop (1b and 5 use it).
  - A card is a `region` named by its title. The focus goes to its title when it opens, and back where it was when it closes.
- Produces, in `js/planner.js`:
  - `this.cards`, a `CardHost` built in `buildPanel()`. `where()` is `'peek'` on a phone with the planner open, else `'float'`.
  - `openPointCard(p, { from = 'map' })`. `p` is the point itself; a drag or Undo passes the key on (`editTo()`, `findPoint()`, as #352 does).
  - `pickOnMap(text) → Promise<[lng, lat] | null>`, `movePoint(i, ll)`, `setSportFrom(i, sport)` (one step of Undo).
- Produces, in `js/facts.js`: `pointNums(a, i)` (there at, from the start, height; the start's you leave), with the missing texts. 1b adds the route's.

- [ ] **The checks (`pointcard`).** #352's group, kept, with these changed or added. A straight-leg MTB route of four points, at 390 × 844 by touch and 1440 × 900 by mouse.
  ```js
  // the switch: Stop, then +; one step of Undo each
  p.stopAt(1).min === 30 && p.past.length === before + 1
  // its state shows: the pressed segment is the one in force
  card.querySelector('[role=radio][aria-checked=true]').textContent.trim() === 'Stop'
  // Night: its morning hour
  isNight(p.stopAt(1))
  // the groups' headings, in order (a via point)
  ['At this point', 'Edit this point']
  // Start here and End here say what they do
  /The part before it is removed/.test(card.textContent) && /The part after it is removed/.test(card.textContent)
  // undo and redo stay while the card is open
  !p.els.undo.hidden && !p.els.redo.hidden
  ```
  - Sport from here → Paddle: legs 1 and 2 paddle, leg 0 as it was, one step of Undo; legs 1 and 2 never `auto`.
  - No card's text has " · " in it; no number's value is taller than one line.
  - The card's height ≤ 52 % of the window on the phone; the point's marker above it, on screen.
  - The card's parts are the shared controls: Back `.way-back` with words, the name `.way-hint`, numbers `.sum-item`, the switch `.seg.icons`, rows `.row`, the warning `.warn-row`, the main action `.btn.primary.big`; no class in the card that isn't in DEVELOPING's "Shared controls".
  - Desktop: rows 40 px, no line but a stretch's ends; each other line is the item's `title`.
  - At 200 %: undo, redo and ✕ in the card's top row, the title below them; at 360 × 740 in Finnish with a 40-letter name, no "…", no text past the card.
  - The route's view: the switch works and stays in the view; no Move, Rename, Start here, End here, Sport from here or Remove; the note's Edit goes back to editing.
  - The end on a loop: no Back to start; a loop's via point: Start here with the loop's line, no End here.
- [ ] **Build** each card to its frame (Cards: Revision 5), from the shared controls. Today's functions do the work behind them (`setStop()`, `stopEditor()`'s times, `listStays()`, `setCarry()`, `startAt()`, `finishAt()`, `backToStart()`, `removePoint()`), but none of today's point-menu controls is reused as it looks: no select, no `seg small`, no full-size button rows. The peek is `els.card` in the header's `sheet-head-in`, measured by `measureSheet()`. The float is a `maplibregl.Popup` (`polku-popup`), kept on screen by `keepInView()`.
- [ ] **Groups to run:** `pointcard stops multi backtostart routeview editing toolbox drawer routebits`.

### 1b. The route's card and a stretch's card

**Title:** Phase 25d: a tap on the route shows what's there; its settings one step away.

**For people:**
- A tap on the route shows the spot's facts. Phones: a pin at the spot and **+ Add a point here** just above it; the card in the peek [p-route]. Desktops: the card at the pointer, Add a point here first as its filled button [d-route]. Near an edge it opens the other way, and the button moves to the side nearest the pointer.
- **The card:** the way's mark (the line with the pin), the way's name, and "Forest path, 0.72 km from the start". Three numbers for your sport: there at, uphill or downhill, difficulty (MTB) or trail grade (Hike) with its word [w-hike]. A warning on that stretch, as a row in its colour with its words, opening the item (part 3; until then, today's Heads-up).
- Then three rows: **This stretch ›**, **What's here ›**, **Edit this stretch ›**, each with its line.
- **+ Add a point here** puts a point at the spot. No routing call, one step of Undo.
- **This stretch ›** [p-stretch]: the stretch's mark, both ends as its name, its distance, time and climb, **Look out for**, **Edit this stretch** as the one filled button, and On the profile.
- **What's here ›** [p-under]: the trail as the map knows it, from the route's own tags, in groups (For MTB, For hiking, In winter, Last checked), your sport's first. Its levels and All OpenStreetMap details come whole in part 6; until then the groups and today's Show all OSM tags.
- **Edit this stretch ›** [p-edit, jd-stretch]: its title, the two ends under it, "Changes apply to this stretch: its 3 legs". **How you go:** Sport (value ›, "Like the rest of the route"), how it's drawn as a two-way switch of only what fits (Follow paths or Straight line on land, Over water or Straight line on water, nothing on a fixed line), Route style (value ›). **On this stretch:** Other ways (one leg only), Stop here, Avoid this spot, On the profile, each with its line. Opened from the list there's no spot, so it's **Avoid a spot here**: tap where.
- **A stretch** runs between two points you see: the start, the end, a stop or night, a change of sport, a point you named, or where a leg's settings change. The points between only shape the line.
- A tap on a handle opens the route's card there.
- **The route's view:** the card without the pill or Edit this stretch, and the note with Edit [r-view-route, d-view]. With the planner put away: Plan opens at the card.
- The point's **The stretch after it ›** opens the stretch's card now. Today's leg menu goes.
- The long press on the route waits for part 5; until then a hold reshapes the line as today.

**Files:**
- Create: `js/facts.js`'s `headline()` and `wayFacts()`.
- Modify: `js/cards.js`: `routeCard()`, `stretchCard()`, `editCard()`, `hereCard()`; `js/planner.js`: `openRouteCard()` and `openStretchCard()` replace `openLegMenu()`; `onMapClick()`, `renderGhosts()`, `keyPoint()`, `stretchAt()`, `setStretch()`; `setLegSport()`, `setLegMode()`, `setStyle()` take `{ commit = true }`.
- Modify: `js/main.js`: `openRoute()` opens the route's card.
- Modify: `css/app.css`: `.card-pill`, `.card-pin`.
- Test: new group `routecard`; update `routemenu` (`ROUTE_MENU`, `QUICK_TAPS`), `editing`, `otherways`, `multi`, `stops`, `avoid`, `sweep`, `routeview`.

**Interfaces:**
- Produces, in `js/facts.js`:
  - `SPORT_FACTS = { mtb: ['clock', 'grade', 'mtb'], gravel: ['clock', 'grade', 'surface'], road: ['clock', 'grade', 'surface'], hike: ['clock', 'grade', 'sac'], trailrun: ['clock', 'grade', 'sac'], run: ['clock', 'grade', 'surface'], paddle: ['clock', 'wind', 'temp'], swim: ['clock', 'wind', 'temp'] }`.
  - `headline(a, i, sport) → [{ key, value, word, label, missing }]`, three of them, at analysis sample `i`.
  - `wayFacts(tags, sport) → [{ group, key, label, value, missing, src }]`: the sport's own first, then the rest.
  - Labels: "there at", "uphill" or "downhill", "difficulty", "uphill difficulty", "trail grade", "surface", "wind", "temperature". Missing: "? difficulty not mapped", "? trail grade not mapped", "? surface not mapped", "? no terrain here", "? not known yet" (weather).
- Produces, in `js/planner.js`:
  - `keyPoint(i) → boolean`, `stretchAt(li) → { from, to }` (point indices, `from` the last key point ≤ `li`, `to` the first ≥ `li + 1`).
  - `openRouteCard(li, ll, { from = 'map' })`, `openStretchCard({ from, to }, { edit = false, at = null })`. A stretch's `alive()` holds its two end points, re-keyed as a point's is.
  - `setStretch({ from, to }, { sport, mode, style })`: one step of Undo for every leg in it.
- Consumes: `CardHost` and the card's parts (1a).

- [ ] **The checks (`routecard`).** Straight legs, mocked BRouter where a leg follows paths.
  - A tap in the middle of a leg: `p.cards.current.kind === 'route'`; the pill's bottom within 60 px above the tap; points and Undo unchanged.
  - The pill: one more point, within 2 m of the line at the tap; one step of Undo; no routing request.
  - 1440 × 900: the card's first button reads "Add a point here", within 30 px of the click. At the window's right edge it opens to the left, on screen. Near the bottom it opens upwards, its button still within 30 px of the click.
  - MTB: labels `['there at', /uphill|downhill/, 'difficulty']`, the difficulty `S1` with "fairly easy" on an `mtb:scale=1` way. On a way with no `mtb:scale`: a dashed box, "? difficulty not mapped".
  - Hike: the third label is "trail grade". What's here still lists MTB difficulty.
  - Three unnamed via points between two named ones: This stretch reads "A → B" and "its 4 legs".
  - Edit this stretch, Paddle: every leg of the stretch is paddle and Over water; the legs outside are unchanged; one step of Undo.
  - The ways offered: land `['Follow paths', 'Straight line']`, water `['Over water', 'Straight line']`, a followed LIPAS leg none.
  - Other ways only on a one-leg stretch.
  - A quick tap on a busy page (#293) → the route's card, nothing in Undo.
  - The route's view: no pill, no Edit this stretch, the note with Edit.
  - The planner put away: a tap on the route opens the planner and the route's card.
  - A card open while the leg's routing answer comes in: its numbers change, it stays open.
- [ ] **Build** `facts.js`, then the cards, each to its frame. The route's numbers come from `routeReadout()`'s sources, `roadAt()` and `a.attr[i].tags`.
- [ ] **Groups to run:** `routecard routemenu editing otherways multi stops avoid sweep routeview pointcard water loops`.

---

## Part 2. Check in three groups

**Title:** Phase 25d: Check says how serious and how sure.

**For people:**
- Heads-up becomes three groups, each a heading: **Read before you go**, **Worth a look**, **Not checked** [jc-check; the Check tab itself: chk-phone, chk-paddle, chk-desk].
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
- Produces: `headsUp(a) → { read: Item[], look: Item[], not: { key, text, note, retry }[], hidden: Map<string, number> }`. `key` is one of `'terrain' | 'water' | 'hazards' | 'trail' | 'winter' | 'weather'`. Parts 3 and 4 read it.
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

## Part 3. The warning on the route

**Title:** Phase 25d: a warning shows where it is on the route.

**For people:**
- **The peek's row,** in words: "1 to read before you go · Road works: Teiskontie", and a dashed "? 2" when sources didn't answer [jc-peek]. It shows while something is in Read or Not checked, and not while Check is in sight.
- **Markers on the route:** a filled triangle for Read, a dashed "?" for something not checked that has a place, an eye for Worth a look. The eyes show only while Check or an item is in view. Close ones merge, with a count; a tap shows the most serious first [jc-worst].
- **One item in view** [jc-step]: a tap on the row, a marker or an item in Check lights its stretch (#84), rings its marker, and shows an obstacle's icon whatever Layers says (#85). On a phone its card takes the peek [r-item]: its sign and what it is, how serious in words ("Worth a look"), three numbers (where, how long, how steep or how much), where it comes from, the note, **Avoid it** or **Retry** as the one filled button, ‹ › along the route and All in Check ›.
- **Back** returns to where it was opened: the peek, or Check at half. So do Escape and a tap on the map.
- **Desktops:** the item is selected in Check and on the map together; no ‹ › [jc-desk-sel].
- A climb's row lights its stretch too (#84).
- A stretch a source didn't cover is dashed on the route: a terrain gap, a water leg routed without a source. A source missing for the whole route says so in words, with no marker [jc-rocks].
- **The planner put away:** the triangles stay with the route. A tap opens a card with Avoid and Open in the planner [jc-closed].
- **At 200 %** the item's card keeps what, where, ‹ ›, Back and All in Check [jc-200].
- **Paddle, with the timeline open** [jc-paddle]: the row, the toolbox and the map's buttons ride above the timeline.
- **A forecast item is for the departure the timeline shows** [jc-paddle-step]: "Rough water, at 13:00" says the time, and moving the timeline checks again; its source says it's an estimate from the forecast.

**Files:**
- Modify: `js/planner.js`: `drawHeads()`, `openItemCard()`, `stepItem()`; `els.readRow` in `buildPanel()`; `focusRange()` lights through `routeLit`.
- Modify: `js/style.js`: source `heads` (clustered: `clusterRadius` 24, `clusterProperties: { sev: ['max', ['get', 'sev']] }`), layers `heads-icon`, `heads-count`, `heads-ring`, `route-unchecked`.
- Modify: `js/icons.js`: the triangle, the "?" and the eye as map images.
- Modify: `js/inspect.js`: a click on `heads-icon` comes first while the planner is put away.
- Test: new group `onroute`; update `drawer`, `routeview`, `trails`.

**Interfaces:**
- Consumes: `headsUp()` (part 2), `CardHost` and the card's parts (part 1).
- Produces: `openItemCard(w, { from = 'row' | 'marker' | 'check' | 'section' })`, `stepItem(+1 | -1)`. Part 4's sections call `openItemCard(w, { from: 'section' })`.

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

## Part 4. Points and stretches in the list, and Reorder

**Title:** Phase 25d: the route's list in sections, with Reorder.

**For people:**
- **Route's list is sections** [jd-multi]. A new one starts where the sport changes, at a stop and at a night: three days with nights are a section a day, each night with the morning's start [jd-days]. A 52-point route has two breaks and three sections, the points that only shape the line folded [jd-long].
- Each section: its sport and its two ends; its distance, time and climb; a short forecast for its end ("9° · 4 m/s", the rest a tap away in Go); its warnings, which open the item on the route.
- **Point rows** for the points you see: the name, then "there at 07:58 · 5.7 km · Via 4", and a stop, night or change of sport.
- **Stretch rows** between them: "5.7 km · 31 min · ↑108 m · via 3 shaping points". An arrow unfolds the shaping points.
- A tap on a point opens its card; on a stretch, its card. Back returns to the list as it was: the same scroll, the same unfolded rows.
- **Reorder** at the top [jd-reorder]: every point with its grip, Earlier and Later. A mouse drags by the grip; a finger holds 0.45 s first, so a scroll never drags. Done goes back to the sections.
- **Desktops:** ↑ and ↓ move between rows, Enter opens, Alt+↑ and Alt+↓ move a point, Delete removes it with Undo.
- **The route's view:** the same sections, no Reorder; a card shows what works there and the note with Edit (decision 6).
- Long names wrap; numbers stay whole (360 × 740, Finnish) [jd-fi].
- A followed LIPAS route is one section on its own line [jd-lipas].

**Files:**
- Modify: `js/planner.js`: `renderWaypoints()` draws `sections()`; `dragRow()` takes a touch hold; the list's keys; `els.pointsFoot` loses All leg settings.
- Modify: `css/app.css`: `.sec2`, `.wpl-point`, `.wpl-stretch`, `.reorder`.
- Test: new group `sections`; update `drawer`, `stops`, `multi`, `routeview`, `backtostart`, `lipas`.

**Interfaces:**
- Consumes: `keyPoint()`, `stretchAt()`, `openPointCard()`, `openStretchCard()`, `openItemCard()`, `headsUp()`.
- Produces: `sections() → [{ from, to, sport, ends: 'stop' | 'night' | 'sport' | 'end', stretches: [{ from, to }] }]`. `this.unfolded`, a `Set` of stretches' first points, in memory only. `this.reordering`, a boolean.

- [ ] **The checks (`sections`).** Straight legs.
  - MTB for three legs, then Paddle for three: two sections, their titles start "MTB" and "Paddle"; the change point's row reads "Change to Paddle".
  - A stop at via 4 makes three sections; a night ends one with its morning's start.
  - Six unnamed via points: one stretch row, "via 6 shaping points". Unfolded: six rows. Open a card, Back: still unfolded, `scrollTop` within 2 px.
  - A stretch row opens its card; Edit this stretch changes every leg in it.
  - A section's warning opens that item's card.
  - Reorder: Earlier on via 2 swaps it, one step of Undo. A mouse drag drops it at place 4. A touch held 0.45 s drags; a move of 30 px within 0.2 s scrolls and never drags. Done: the sections.
  - Keys: Alt+↓ moves; Delete removes, with Undo in the note.
  - The route's view: no Reorder, no grip; a row opens its card.
  - A 52-point route draws in no more than twice the time `main`'s list takes on the same machine, measured in the same run; its key points are in view, the rest folded. A fixed number of milliseconds fails on a slower test machine.
  - Every row at least 44 px tall on the phone; no "…" at 360 × 740 in Finnish.
- [ ] **Build** `sections()`, then the rows, then Reorder and the keys.
- [ ] **Groups to run:** `sections drawer stops multi routeview backtostart lipas pointcard routecard toolbox`.

---

## Part 5. Holds and keys

**Title:** Phase 25d: hold the map to see what's there; the same by keyboard.

### 5a. The long press, and the spot's and a place's cards

**For people:**
- **Hold the map still for 0.5 s,** within 10 px: a ring fills under the finger, then the spot's card [p-press, p-spot]. Let go sooner and it's a tap. A move or a second finger is the map's own.
- **Right-click** on a desktop: the same card at the pointer [d-spot]. A right-drag still turns the map.
- **The card** [p-spot]: the pin's mark, what's there and its line ("Forest path", "Easy to ride, on dirt"); three numbers: from your route, height and the sport's fact; **What's here ›**; then **Your route**: **Start here** ("Adds a new start point"), **End here** ("Adds a new end point"), **Round trip from here**, **Avoid this spot**, each with its line.
- **+ Add to my route** in the pill puts the point where it fits: where it adds the least distance, between two points or after the end, never before the start [p-added]. The note names the point it follows ("Added after Pirunvuoren näköala"), with Undo.
- **Only what can be done now:** with no route the pill says **+ Start a route here** and the card offers only **Round trip from here** [p-none]; a spot within 30 m of the line gets **+ Add a point here**, which puts it on the line, not Add to my route [r-near]. In the route's view the card has no pill and ends with the planner's "You're not editing" note and **Edit**.
- **The first point's peek** says, in one line: "Hold the map to see what's there." [r-first]. A phone has no hover, so otherwise nobody finds the long press.
- **A long press on the route** (0.5 s, still) or a right-click opens Edit this stretch directly [p-holdroute, d-edit]. A hold that moves still reshapes the line, as today: the split waits for the first move after the 300 ms hold; held still to 500 ms, Edit this stretch opens and nothing is split (`onLinePress()`).
- **A tap on a place's icon** while drawing shows its card instead of adding a point [p-place]: a campfire site, a toilet, a lean-to, a LIPAS place, an obstacle. A tap on a road, a trail or the open map still adds a point.
- A place's card [p-place]: its own icon, its name and kind, its source, three facts as plain lines with a tick (never pills that look like buttons), What's here ›, the same Your route group and pill.
- The route's view: no pill. The planner put away: the card at the spot.

**Files:**
- Modify: `js/planner.js`: `bindHold()` replaces `bindSpotMenu()`; `onLinePress()` holds 0.5 s for Edit this stretch; `openSpotCard()` replaces `openSpotMenu()`; `openPlaceCard()`; `bestInsert()`, `addWhereItFits()`, `insertAt()`; `onMapClick()` checks places first.
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
  - A hold on a point's marker or a label selects no text: the map's container has `-webkit-touch-callout: none` and `user-select: none`, the card's text stays selectable. iOS's callout and magnifier need a real phone.
  - Right-click: the card at the pointer. A right-drag of 40 px turns the map and opens nothing.
  - Points A, B, C. A spot beside the middle of A–B: the new point is at index 1. Past C: at the end. Behind A: index 1, never 0. The note reads "Added after " and the start's name. Undo: as before, one step.
  - Start here on a spot: a new point before the start, the old start now Via 1, nothing removed. End here: a new point after the end. Both with one step of Undo, and the note says so.
  - No route: the card lists Round trip from here and nothing else of Your route. A spot 20 m from the line: the pill reads "Add a point here", and the point lands on the line (`splitLeg()`, no call).
  - Touch on the line: held still 0.5 s → Edit this stretch. Held 0.3 s, then a move of 30 px → reshaped, one point after the release. A 0.2 s tap → the route's card. Right-click on the line → Edit this stretch.
  - The first point's peek has the line "Hold the map to see what's there."; it goes with the second point.
  - A tap on a rendered `poi-outdoor` icon while drawing: its card, no point. A tap on the path beside it: a point.
  - No route: the pill starts a route with one point, editing.
  - The spot's card: three numbers, "from your route" first (none with no route); Share, Weather here and Not right? in one row, last.
  - The planner put away: a hold opens the card at the spot.
  - The spot's card ends with What's here and Your route until part 6 brings its bottom row (Share, Weather here, Not right?).
- [ ] **Build** `bindHold()` from `bindSpotMenu()`'s guards (a second finger, a move, a late touchend, Android's `contextmenu`), at 500 ms. Then the cards, then Add to my route. The planner's hint (`els.hint`) and `TIPS` say what a tap and a hold do now.

---

### 5b. The keyboard's crosshair, in the same PR

*Why in the same PR:* a long press with no way in by keyboard would be on polku.si until it came (WCAG 2.1.1).

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
- [ ] **Groups to run (5a and 5b):** `spotcard crosshair routemenu routeview start editing pointcard routecard`.

---

## Part 6. What's here, in levels, with Share and Weather here

**Title:** Phase 25d: a card says a little; What's here says the rest; share a spot.

### 6a. What's here, in levels

**For people:**
- **What's here ›** [p-more]: your sport's details first, then the other sports', then the spot: its height, its coordinates with **Copy**, and when it was last checked.
- **A place's What's here** is grouped [p-placemore, d-place on a desktop]: at the site, getting there, when it's open, last checked, links. A toilet has its fee, opening hours, seasons, wheelchair access, its kind and who runs it, as far as the map knows.
- **All OpenStreetMap details** [p-osm]: the map's own data, asked for when you press it, for a way or a place.
- **Not right?** on every card [p-notright]: OpenStreetMap's note page at the spot, which needs no account, or its editor for that way or node. LIPAS's page for a LIPAS place.
- **The sport orders the facts, never hides them** [w-hike, r-hike-spot]. **A missing fact says so** [w-missing]. At 200 % [w-200] and in the dark [w-dark] as every card.
- **One card system:** with the planner put away, the map's own cards for a way, a place and a LIPAS route or place open in the same card (`CardHost`, at the spot) with the same parts and levels; `js/inspect.js`'s renderers give What's here its content. Ships, cameras, sea marks, road works and the water's depth keep their own cards.

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

---

### 6b. Share a spot, and Weather here, in the same PR

*Why together:* Share, Weather here and Not right? are one row at the bottom of the spot's and a place's cards [p-spot]; it comes whole.

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
- [ ] **Groups to run (6a and 6b):** `facts sharespot sweep trails winter lipas avoid changelog weather radar spotcard routecard`.
- [ ] **This part's PR fixes #233 and #345,** with this plan's Built section complete.

---

## Not in 25d

- The planner mock-up's frames not built: D's tap on the line opening the stretch's card at once [jd-maptap], replaced by #345's route card; the options not chosen for the list [jd-v2, jd-v3, jd-v3e]; section 6's waypoint list [wp-*], replaced by D; section 5's peek row [chk-peek], replaced by C's row [jc-peek].
- The planner mock-up's other sections are built: A (the start) and B (the sport) in 25b, 1 (the toolbox) and 3 (More) in 25a, 2 (round trips) in 25b, 4 (Done and the route's view) in 25c. Section 7 (the worst cases) applies to every part; section 8 is today's planner, for comparison.

- A form in Polku that posts a note to OpenStreetMap: #347.
- A swipe below the peek that puts the route away: #338.
- Find a point by name, and Move to a number: #350.
- Renaming the route's last point from Finish to End outside the cards (the list, the route's title): #353, since 25d stays within the cards.
- The ⋯ menu's top repeating the sheet's title: #354.
- The same controls styled differently across the app (four row styles, black and green icons, two chosen chips, three switch heights, three headings): #356, a Fix PR of its own, before 1a.
- A test with someone new (§8's script): after part 4, and again after part 6.

## Built

Each part adds what it built here, as the calmer planner's Built section does.
