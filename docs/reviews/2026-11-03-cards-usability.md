# The cards' usability, tested as four kinds of user (2026-11-03)

Evidence for choosing the cards' next small improvement under [#690](https://github.com/TommiContursi/Polku/issues/690) and [#660](https://github.com/TommiContursi/Polku/issues/660). It decides nothing and changes nothing in the app. Every finding below was seen in the running app; nothing was taken from the code, the plans or the mock-ups, except where a line says it looked something up to explain what it saw.

Screenshots: `https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/<file>.jpg?raw=true` (linked below by number). They are the browser pane's own captures, 800 px wide for a 1440 px window, so small text is soft.

## What was tested

- **Build:** `main` at 00aac5e (Planner content: the route before its settings, #743), served from this worktree on port 8791, in Claude Code's browser pane, with an empty origin (local storage and the `polku` database cleared first).
- **Routing:** a local BRouter (`tools/brouter-local.sh`, port 17778) set as the routing server. No request went to brouter.de.
- **Sizes and input:** 1440 × 900 with a mouse, in the side dock and the bottom dock (switched with the panel's own control and with `polku.planner.setDock`); 390 × 844 and 360 × 740 with the pane's phone emulation (clicks arrive as mouse clicks; a hold was simulated with touch pointer events held 800 ms).
- **Sport and routes:** MTB around Kauppi and Niihama, Tampere. A first route of 2–3 points (0.6–1.5 km), then the same route grown to 16 points (12.1 km) by clicks in two batches with 2 s pauses, edited, cut back and undone.
- **Modes:** drawing (Edit) and browsing (Done); the planner open and put away; Route, Check and Go.
- **Departure:** set to 2026-11-04 09:00 through Go's Leave field.

**Not tested:** a real phone (so the phone's tap line above a spot, which needs MapLibre's own touch path, was never seen: a click in the emulation opens the card at once); a screen reader; a hold with a mouse on the desktop (only right-click); 200 % zoom; the GPX download itself; Draw it from scratch on a phone; the paddle sport.

## What works well and should stay

- **The hover readout on the route** (desktop): resting on the line lights the leg and says distance, height, grade, difficulty, surface, the wind at that time and "Click for options", while the profile marks the spot ([02](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/02-desk-route-hover.jpg?raw=true)). It is the quickest way to compare stretches, and it needs no card.
- **The hover line on a way** with the planner put away: name, grade and surface at a glance, and the way drawn.
- **Dragging a point on the desktop:** one step, and the route follows at once.
- **A click on the line doesn't add a point** (after #731): it opens the route's card at the spot.
- **Undo everywhere:** the toast after Remove and Add to my route ("Via 9 removed · Undo", "Added after Via 8 · Undo"), the toolbar's arrows and Cmd+Z all brought the route back exactly.
- **Rename in place:** the title becomes the field with Save; Enter saves, and the list and the route's title follow at once.
- **The card from a row in the side dock** ([07](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/07-desk-row-card.jpg?raw=true)): docked beside the panel, full height, every action in sight, the row lit, ‹ Route to go back. This is the desktop's best editing surface today.
- **The phone's hold card at full** ([17](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/17-phone-hold-card-full.jpg?raw=true)): each action has a plain line under it ("Tap where it goes", "Undo brings it back"). A newcomer can read what each one does.
- **Check's findings and their markers agree:** the row in Check and the marker on the map open the same card, with Avoid it first ([11](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/11-desk-finding-card.jpg?raw=true)).
- **The departure:** setting tomorrow 09:00 updated the numbers ("from Wed 4 Nov, 09:00"), the times on the map, the Go tab (09:50) and Check (the dark warning went: 3 → 2), and Weather showed "+13 h".
- **Shaping points fold** under their stretch: 16 tapped points still give three rows.

## The desktop's small edits: which surface, how many steps

Steps counted from the route in sight with the planner open in the side dock, while drawing. In Done every path below needs one step more (Edit) until #745.

| Edit | Drag the marker | Click the marker | Right-click the marker | The point's row | Notes |
|---|---|---|---|---|---|
| Move | **1** | — (no actions) | 3 (right-click, Move, click), +1 scroll when the card is short | 3 (row, Move, click) | the row also zooms the map to 15 |
| Rename | — | — | 3 + typing, +1 scroll | 2 + typing (row, Rename, Enter) | |
| Remove | — | — | **2**, +1 scroll | 2, but finding the row on a long route is unfold + scroll | the next point takes the removed one's number |
| Change a stretch | — | — | — | — | click the line, Edit this stretch (2–3); for tapped points "this stretch" is the whole route |
| Add a road | — | — | — | — | right-click the road, Add to my route (2): adds a spot, not the road |
| Leave (departure) | — | — | right-click the start, Leave (2) + picker | row, Leave (2) + picker | Go › Leave also (2) |

**Judgement.** For small edits on a desktop, a full card is the right surface only when it is the docked card from a row: it has room, it lights the row, and nothing is hidden. The floating card at the marker is the slowest surface: a click gives the info-only version, a right-click gives the one with actions, and its height depends on where the point sits, so the actions are often below its own scroll. Direct manipulation (drag) is fastest for Move and has no counterpart for the other edits. The preview (hover) is right for inspection and should stay card-free.

## Friction points

Each with what to do to see it, the steps it takes today, and whether an issue already covers it.

### 1. One point, three different cards (desktop)

A click on a marker opens the point's info only: time, height, profile and **On the profile** ([03](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/03-desk-start-click.jpg?raw=true)). A right-click opens a card with Back to start, Leave, Sport from here, Next stretch, Reverse, Move, Rename and Remove ([04](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/04-desk-start-right-click.jpg?raw=true)). The point's row opens a third, docked, with all of them in sight ([07](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/07-desk-row-card.jpg?raw=true)). Nothing on the click's card says more exists.

- **Do:** draw a route, click its start; then right-click it; then click Start in Route's list.
- **Steps to Remove from the map:** the click's card can't; close it, right-click, Remove (3).
- **Covered by:** #690 (its core). The phone has the same split (tap vs hold).

### 2. A floating card's actions sit below its own scroll

The floating card's height follows the room under or over its point. The start near the toolbar got a 244 px card showing 220 of 492 px; Move, Rename and Remove were out of sight ([04](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/04-desk-start-right-click.jpg?raw=true)). A road's card in the bottom dock showed 220 of 916 px, and a point's card there opened folded to a line; unfolded, it had about 240 px between the top bar and the dock ([14](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/14-bottom-unfolded.jpg?raw=true)). A trail's card (planner put away) is 490 px tall with **Share** and **Weather here ›** at the very bottom ([01](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/01-desk-trail-card.jpg?raw=true)); scrolling to them scrolls the title and ✕ away too.

- **Do:** right-click a point close to the toolbar; or, in the bottom dock at half, click a road.
- **Steps:** one or two scrolls inside the card before the action.
- **Covered by:** none directly; #690 (actions discoverable) and #647 (the card covers the way) are near.

### 3. The card changes place at each nested step

Right-click the start: the card opens below the point. **Next stretch, to End**: it opens to the right of the route, about 170 px away ([05](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/05-desk-next-stretch.jpg?raw=true)). **‹ Start**: it comes back above the point, scrolled to the top ([06](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/06-desk-back.jpg?raw=true)). Three places in three steps; the eye has to find the card again each time.

- **Do:** right-click a route's start near the bottom of the map, Next stretch, Back.
- **Covered by:** none. #720 (#692) kept a nested card's size, not its place.

### 4. A row's card moves the map, differently in each dock

In the side dock, a click on a row zooms the map to 15 and centres the point: on a 12 km route seen at 13.6, the overview is gone after each row ([09](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/09-desk-row-zooms.jpg?raw=true)). In the bottom dock the same click opens the card folded to a line floating over the map, and the map doesn't move even when the point is outside it ([15](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/15-bottom-row-card.jpg?raw=true)).

- **Do:** a 15-point route zoomed out to see it whole; click Via 9 in the list; repeat in the bottom dock.
- **Steps to get the overview back:** zoom out by hand after each row (2–4 wheel steps).
- **Covered by:** none.

### 5. For tapped points, a "stretch" is the whole route

Points added by clicking are shaping points, so the route is one stretch. **Edit this stretch** says "Changes apply to this stretch: its 15 legs" and lights the whole route ([10](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/10-desk-15-legs.jpg?raw=true)); Via 9's card offers **Next stretch, to End** though Via 10 is next; the stretch card of a one-stretch route repeats the route's own numbers. Changing how one part is drawn needs the point named or made a stop first, and nothing says so. "Leg", "stretch" and "point" all appear, and only "leg" matches what was drawn.

- **Do:** tap 15 points; click the line between Via 8 and Via 9; Edit this stretch.
- **Steps to change one part's style today:** row or right-click a point, Stop (or Rename), then the line, Edit this stretch: 5 or more, found only by knowing the model.
- **Covered by:** #690 (stretch cards with the route's facts and actions); #627 (Remove a leg) is near.

### 6. Removing several points in a row

After **Remove** the card closes, and every later point renumbers: removing Via 9 leaves a new Via 9 (the old Via 10) in the same row. In the side dock each row also zooms the map (point 4). The point names also change with the zoom ([#748](https://github.com/TommiContursi/Polku/issues/748)), so rows rename themselves while you look.

- **Do:** remove Via 9, then the next one you meant to remove.
- **Steps per point:** right-click on the map and Remove (2), or row and Remove (2) after unfolding and scrolling the list.
- **Covered by:** #350 (find a point by name or number) is near; #748 for the names.

### 7. Done adds notes and moves things

In Done, the Route tab gets "You're not editing…" with Edit, and so does every card ([08](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/08-desk-done-notes.jpg?raw=true)): the same note twice in sight. The panel's header gains the route's title line, pushing the numbers and profile down 24 px; on the phone the Edit button lands 21 px lower than Done was.

- **Covered by:** #745 (being built).

### 8. "Add a road to the route" adds a spot

Right-click a path, **Add to my route**: the route goes out to that spot and back, with a new point after Via 8. There is no way to follow the road you picked, only its spot. The action is only in the right-click (or hold) card, under the way's profile, partly below the card's edge.

- **Covered by:** #690 for where the action is; nothing for "follow this way".

### 9. A finding's card has no way to its stretch

The finding's card ([11](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/11-desk-finding-card.jpg?raw=true)) offers Avoid it, Got it, Hide and Not right?. To change the stretch the finding is on: close, find the line by the marker, click it, Edit this stretch (4), and point 5 then applies. **Avoid it** on "Cycling not allowed here" near the end put the route's End inside its own avoided area; the leg became a straight line and the note said "Couldn't route this leg (last wpt in restricted area) — drawn as a straight line. Check has a Retry." ([12](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/12-desk-avoid-toast.jpg?raw=true)): the router's own words, seen with the local BRouter.

- **Covered by:** #690 (stretches with the route's actions); none for the router's wording.

### 10. The phone's point card hides its actions twice

A tap on a point gives the info card in the sheet; a hold gives the actions, but the sheet stays low, so 155 of 673 px are in sight: Move is 396 px down, Remove 617 px ([16](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/16-phone-hold-card.jpg?raw=true)). Dragging the sheet up shows them all, with the map gone ([17](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/17-phone-hold-card-full.jpg?raw=true)). At 360 × 740 the tap card shows 196 of 304 px.

- **Steps to Remove on a phone:** hold, drag the sheet up (or scroll), Remove (3), the hold found only by knowing it.
- **Covered by:** #690.

### 11. Comparing ways: every pick is a full card

Each click on a way opens the full card (about 420–490 px), at a new place beside or above the spot. Folding a card (⌄) moves it to the bottom-right corner as a line (in the bottom dock a point's card opens as that line from the start: [13](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/cards-audit-a2993b/13-bottom-folded.jpg?raw=true)), and the next pick opens unfolded again. With the planner open in Done, each way's card also carries the "not editing" note.

- **Steps per comparison:** click, read, close or click the next (2); the hover line does it in 0.
- **Covered by:** #647 (the card covers the way); #745 for the note.

### 12. The same warning in many places

"In the dark for 12.3 km, at km 0.0" was in the planner's row, on Check's badge, and at the top of every route card from a click on the line, however far along the click was. Rows read "Via 1 / 765 m · Via 1". Opening Go adds "3 to read before you go" above the numbers and pushes the profile and tabs down 35 px.

- **Covered by:** #741 (one state line that never moves) for the moving row; none for the repetition in route cards.

## Novice and experienced workflows

- **The newcomer** finds the click card and reads it: it is complete for inspection, and the words are clear. They plan with Draw it without trouble: two clicks make a route. They don't find editing in a point's card, because the click card has none; they find it in the list ("Tap a point or a stretch to change it"), which works well in the side dock. The phone's hold card, once reached, explains each action best. The "stretch" model (point 5) is invisible to them and doesn't hurt until they try to change one part.
- **The experienced user** lives on hover and right-click, which are fast: drag to move, right-click and Remove. They are slowed by things that move: the card's place (3), the map's zoom after a row (4), renumbering (6), and every pick opening a full card (11). They hit the stretch model directly when they try to change one part of a long tapped route.
- **Where they part:** the newcomer needs the actions to be visible from a click; the experienced user needs the card to stay put and the map to stay where they left it. Both are served by the docked card from a row; neither by the floating card at the marker.

## The smallest worthwhile improvements, by impact

Each small enough for a PR of its own; none is decided.

1. **On a desktop, a click on a point opens the card with its actions**, the one a right-click gives (#690's first step, desktop only). Removes the three-cards problem for mouse users without touching the phone's tap model.
2. **A floating card keeps its actions in sight:** at least the title and its first actions above the fold, by opening on the side with more room, or a minimum height that moves the map a little. (Point 2.)
3. **A nested card opens where its parent was**, and Back returns to that place. (Point 3.)
4. **A row frames its point without zooming in:** pan only, and the same in both docks; the bottom dock's row card opens unfolded. (Point 4.)
5. **Plain words for an unroutable leg:** "The end is inside the area you avoid: move it, or remove the avoided spot", instead of the router's message. (Point 9.)
6. **A finding's card links to its stretch** (This stretch ›), as the route's card does. (Point 9; part of #690's stretch work.)
7. **The route card at a spot says only what is there:** the whole-route warnings (the dark) stay in Check and the state line, not on every spot's card. (Point 12.)
8. **Fix #748** so names don't change with the zoom. (Bug, already filed.)
9. **The phone's hold card opens at half**, with its actions' first row in sight. (Point 10; #690.)

## Observed issues

Facts seen in the app, apart from opinions. Only #748 was confirmed as a bug and filed.

- **#748 (filed):** an unnamed point's road name comes and goes with the map's zoom (zoom 15: "Pikku-Niihamantie"; zoom 12: "Via 6"), in the list, the card and GPX export.
- **Router text shown to people:** "last wpt in restricted area" after Avoid it (point 9).
- **Avoid it can avoid the route's own end** and leave the last leg a straight line.
- **A card can run past the screen's edge:** after switching docks, the open Via 6 card sat 31 px past the right edge over the map's buttons; dragging the map moves an open card off-screen with its point. A card following its point is expected; it is listed because it covered the map's buttons.
- **The bottom dock's toolbar moved** from the dock's header (right) to a bar above the dock (left) after the first click on the map following the switch. Seen once; not chased.
- **Up and down say 0 m beside a profile that climbs:** "0 m up · 0 m down" for a path whose colours list "3–6 %, 22 m" and "Down 30 m".
- **The same way, two names:** the hover line said "Forest road / track · unpaved", its card "Track · MTB: easy path · ground".
- **An empty key fact:** Check shows a lone "HARDEST CLIMB —" tile when no climb counts.
- **USING differs from the app:** USING says a way's card has no route actions with the planner put away; with a route drawn and the planner closed, a right-click on a path offered Start here, End here, Add a point here, Round trip from here and Avoid this spot.
- **One Escape didn't close a road's card** (planner open, focus on the map, just after clicking a road); it closed it every later time. Not repeated, so not filed.
- **Not bugs, checked:** a right-click "doing nothing" on a way was the click landing on the open card that covered it (#647).

## Design opinions

- The floating card is the wrong surface for small edits on a desktop; the docked card is the right one, and the marker could open that.
- The info-only click card is a good preview but a poor card: it is as big as a card, with one action.
- "Stretch" should mean what the person drew, or not be offered where it means the whole route.
- A finding is about a place on a stretch, so its card should reach that stretch.
- Fewer repeated warnings: Check and one state line are enough.
- Desktop and phone action labels could share the phone's explanation lines when there is room.

## Overlap with open issues

| Finding | Issue |
|---|---|
| 1, 8, 10: actions found only by right-click or hold | #690 |
| 5, 9: stretches with the route's facts and actions | #690, #627 |
| 7: notes in Done, Edit's place | #745 |
| 11: the card covers the way; comparing picks | #647 |
| 12: the row that moves the numbers | #741 |
| 6: finding a point on a long route | #350 |
| point names with the zoom | #748 (filed here) |
| 2, 3, 4, router wording, empty key fact, USING mismatch | none |
