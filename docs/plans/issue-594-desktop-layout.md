# Desktop layout (#594)

Where the toolbar, the planner and the top bar sit on a desktop: today's layout beside an idea from the user (2026-10-30), and the options between them, drawn as a mock-up to choose from. What's still to do, and its status, is on GitHub, in [#594](https://github.com/TommiContursi/Polku/issues/594).

- **Status (2026-10-30): E is chosen,** the critique's own choice: today's planner and toolbar, ⚙ at the top right, and Done and Edit at the toolbar's planner end, so Done stays put and Edit lands where Done was. With two more in the same build, which the mock-up doesn't draw:
  - the toolbar is rounded at both ends, never square, and floats beside the planner with the same gap as the other floating surfaces (this settles [#595](https://github.com/TommiContursi/Polku/issues/595));
  - a warning no longer moves the route's numbers.

  The build starts once [#603](https://github.com/TommiContursi/Polku/pull/603) is merged, since it changes the planner's top too. [#568](https://github.com/TommiContursi/Polku/issues/568) and step 3, part 2 of [#233](https://github.com/TommiContursi/Polku/issues/233) follow it.
- **D was recommended** before the choice; [the recommendation](#recommendation-d) stays below, with where the idea loses and wins.
- **The mock-up:** [mockups/issue-594-desktop-layout.html](mockups/issue-594-desktop-layout.html). Today on the left, an option on the right, in the same scene and at the same size.

## The mock-up

[mockups/issue-594-desktop-layout.html](mockups/issue-594-desktop-layout.html), on B's look ([#591](https://github.com/TommiContursi/Polku/pull/591) at 79a6ae4). It opens on E, the choice, beside today at 1440 × 900. To open it before it's merged, serve the branch's folder (`python3 serve.py 8832` in `.claude/worktrees/desktop-layout`) and go to `http://localhost:8832/docs/plans/mockups/issue-594-desktop-layout.html`; once merged, it's at polku.si under the same path. It's for a desktop: on a phone the frames stack and are small.

- **Its switches:** the option (A, B, C, D), or **its parts** one by one (the top bar; the planner at the top or centred; the toolbar on the planner's edge, centred beside the planner, or centred in the window), so any mix can be tried. The size: 1024 × 768, 1440 × 900, 1920 × 1080 and 2560 × 1440. Side by side, or one above the other for bigger frames.
- **The scenes,** each with **Change** (or **Play**, which goes back and forth): the first leg (the second point brings the route's actions onto the toolbar), the list (Waypoints folded and open), a warning (a departure after dark puts "1 to read before you go" at the planner's top), the profile (taller and smaller), the tabs (Route and Go), one more point, Done and Edit, the weather while editing and while viewing, and the planner folded to its line.
- **What it shows on top:** **Where it was** outlines the planner and the toolbar as they were before the change; **Pointer travel** draws the distances below; **Room for the map** draws where a fit frames the route and the spare room at the foot.
- **Under the frames:** what moved in this scene, in both frames, and a table of every option at every size (the numbers below).
- **What's a picture and what's drawn:** the map at each size and the planner in each state are pictures of #591's build with the Kauppi route (on `pr-screenshots`, `claude/desktop-layout/`). The top bar, the toolbar, the map's buttons and the lines are drawn with B's values, at the sizes the build measures. Two things aren't built and are drawn as their plans say: #568's Share link, Export GPX and Save offline in the route's view, and the weather at the foot (step 3, part 2).
- **The worst case:** 1024 × 768 is in the size switch. At 200 % a 1440 × 900 window is 720 × 450, which takes the phone's layout (under 900 px wide), so none of these options applies there.
- **Left out:** the bottom dock (B's centred planner has no meaning there, and a toolbar centred on the bottom panel's top edge would move as B's does), dark mode, the zoom hint, Finnish (not measured on #591; on the old look its toolbar was about 22 px wider than English, which would put one more of the route's actions in ⋯ at 1440 in B and C, with 940 px of room, and probably not in A, D and E, with 952; nothing changes at 1920 and 2560), the search's results, the menus and Settings' panel.

## The options

- **Today:** the logo, the search, the sport and ⚙ in one row at the top left. The planner hangs from under the top bar on the left (392 px wide) and is as tall as its content, up to the window's foot. The toolbar hangs off the planner's right edge at the window's foot (#468) and folds for the map's buttons (`placeTools()`). The map's buttons are a column at the right, at the foot. The weather's timeline floats over the map, 40 px above the toolbar.
- **A: today, with what's decided.** Today, with #568's three buttons in the route's view, and the weather at the foot by the map's buttons, as step 3, part 2's plan has it: open where it fits beside the toolbar, else its 210 px line, else away on the Weather button; the toolbar never gives anything up for it.
- **B: the idea.** The toolbar centred at the map's foot; the planner centred on its side; the logo where it is; the search and the sport centred at the top; ⚙ (and later sign-in) at the top right. Centred in the window, the toolbar would sit under the planner at 1440 × 900 (its room there is 608 px, so all seven of the route's actions go to ⋯) and leave no room at all at 1024 × 768, so B centres it in the map beside the planner. Everything decided for A is in B too.
- **C:** B with the planner at the top. Today's planner already is: it hangs from under the top bar and its foot follows its content. So C is A with B's top bar and B's toolbar.
- **D: today's planner and toolbar, with ⚙ at the top right.** The toolbar's left end is rounded where the planner doesn't reach the foot ([#595](https://github.com/TommiContursi/Polku/issues/595)). Everything decided for A is in D too.
- **E: D, with Done and Edit at the toolbar's planner end,** the end that never moves. Proposed by the critique (below).

Since today's planner is C's, the idea is three changes that can be chosen apart: **the top bar** (the search and the sport centred, ⚙ at the right), **the toolbar** (centred, or on the planner's edge) and **the planner** (centred, or at the top). E adds a fourth: where Done and Edit sit on the toolbar.

## What was measured

#591's build at 79a6ae4 in headless Chrome, with the Kauppi route (`tools/fixtures/route-kauppi-mtb.json`); scratch scripts, not in the repo.

- **The planner** is 392 px wide at every size, from 64 px down, at most the window's height less 76. Its heights: Waypoints folded 577, open 959, with one more point 1064, the smaller profile 499 (folded), Go 1273, the route's view 968, the start 508. "1 to read before you go" adds 64 px at its top, above the numbers.
- **The toolbar** while editing is 1110 px with all seven of the route's actions out (Show the whole route, Reverse, Back to start, Share link, Export GPX, Save offline, Clear route), 928 with three, 606 with none, 522 folded every step. At the first point, before any leg, it's 793. In the route's view today it's 179 (Show the whole route, ⋯, Edit); with #568's three buttons labelled, 534 as drawn (306 as icons).
- **Room beside it** (from the planner's edge to 12 px before the map's buttons): 536 px at 1024, 952 at 1440, 1432 at 1920, 2072 at 2560. Centred beside the planner, 12 px less. At 1440 four of the route's actions are in ⋯; at 1920 and 2560 none are, while editing and (with #568) in the route's view.
- **⋯** always holds Round trip and Import GPX or KML, and what the toolbar has no room for. In today's route's view it also holds Share link, Export GPX, Save offline, Reverse, Back to start and Clear route.
- **Settings' panel** opens at the right, under the top bar (356 px wide). Layers opens by the map's buttons.
- **The weather's timeline** is 640 × 173 (420 × 213 at 1024).

| | Size | Weather, editing | Weather, viewing | What you clicked moves | The numbers move | Modes move, first leg | Left end moves, Done | Done → Edit | Map ↔ modes | ⚙ ↔ Settings | Search ↔ place |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A, D | 1440 | away (12) | line (406) | 0 | 64 | 0 | 0 | 402 | 505 | 531 · **169** in D | 738 |
| B | 1440 | away (−6) | away (191) | **124** | 32 | **68** | **197** | 205 | 495 | 169 | 510 |
| C | 1440 | away (−6) | away (191) | 0 | 64 | **68** | **197** | 205 | 495 | 169 | 510 |
| A, D | 1920 | line (310) | open (886) | 0 | 64 | 0 | 0 | 584 | 731 | 1010 · **169** in D | 989 |
| B | 1920 | **away (143)** | line (431) | **191** | 32 | **159** | **288** | 296 | 620 | 169 | 586 |
| C | 1920 | **away (143)** | line (431) | 0 | 64 | **159** | **288** | 296 | 620 | 169 | 586 |
| A, D | 2560 | open (950) | open (1526) | 0 | 64 | 0 | 0 | 584 | 1128 | 1649 · **169** in D | 1328 |
| B | 2560 | **line (463)** | open (751) | **191** | 53 | **159** | **288** | 296 | 773 | 169 | 747 |
| C | 2560 | **line (463)** | open (751) | 0 | 64 | **159** | **288** | 296 | 773 | 169 | 747 |

All in px. **Weather:** what it does with Waypoints folded (editing) and in the route's view, with the room beside the toolbar in brackets: it needs 640 to open and 210 for its line. **What you clicked moves:** the most Waypoints' head, the profile's size button or the tabs move when clicked. **The numbers move:** the most the route's numbers move when a warning comes (its row goes in above them, in every option) or a point is added. **Modes move, first leg:** the drawing modes, when the second point brings the route's actions. **Left end moves, Done:** the toolbar's left end when Done turns it into the route's view. **Done → Edit:** how far Edit lands from where Done was. Travel is from centre to centre; the map's middle is the middle of where a fit frames the route. At 1024 × 768 the toolbar folds every step in every option, the weather is away in all of them, and B's planner moves up to 58 px; the mock-up's table has every size.

**With the weather off, room for the map is the same in every option:** the planner stays 392 px on its side, the top bar keeps its pieces and their sizes, and a fit frames the route in the same box (`viewPadding()`: from 40 px beside the planner, under the top bar, above the toolbar). What differs is the foot's spare room: one piece by the map's buttons when the toolbar starts at the planner's edge, two halves when it's centred. The weather goes by the map's buttons, so centring halves its room. **With the weather on,** an open strip (173 px tall) takes a fit's box up above it, 117 px less tall: where A, D and E open it and B and C show its line, B and C keep more of the map in view.

## How each part does

**The planner, centred (B) or at the top (A, C, D, E).** Centred, it moves what was just clicked: Waypoints' head moves 124 px when it opens at 1440, 191 at 1920 and 2560, and the tabs 157 px between Route and Go at 2560. The pointer is still on it, so a second click lands on something else. With Waypoints open, each added point moves the whole planner too, 23 px at 1920 and 53 px at 2560. At the top, nothing that's clicked moves. Centring halves one thing: a warning's row, which goes in above the route's numbers, moves them 32 px instead of 64. That 64 comes from where the row is, in every option, so it belongs to the planner's content, not to this choice. **The planner loses nothing at the top.**

**The toolbar, centred beside the planner (B, C) or on its edge (A, D, E).** A canvas tool can centre its bar at the foot (Figma, tldraw) because the bar keeps one width. Polku's toolbar is 793 px at the first point, 1110 with a leg, 534 in the route's view and 522 folded, so a centred one moves every button by half of each change:
- the drawing modes move 68 px (1440) and 159 px (1920, 2560) when the second point brings the route's actions;
- its left end moves 108–288 px on Done.

On the planner's edge its left end stays put and new buttons fade in to its right, which is what `fadeNewTools()` is built on. Centring also cuts the foot's spare room into two halves, and the weather, which goes by the map's buttons, gets one of them. It loses a step at every size: at 1920 while editing it's away instead of its line, and at 2560 its line instead of open. At 1440 in the route's view it's away instead of its line. At 1024 the 12 px gap costs #568's words.

The centred toolbar wins two things:
- **Done → Edit:** Edit lands 296 px from where Done was, against 584 on the edge, because the toolbar's end moves only half as far.
- **The modes on a wide screen:** they're nearer the map's middle, 773 px against 1128 at 2560. At 1440 the two are the same (495 and 505).

The keys P, S, W, E and Ctrl+Z take the same jobs. On the edge, Done also moves 317 px right at the first leg at 1920 (135 at 1440), as the toolbar grows.

**The top bar.**
- **⚙ at the right** is 169 px from Settings' panel at every size, which opens at the right. At the left it's 531 px away at 1440, 1010 at 1920 and 1649 at 2560; at 1024 the two are about the same (127 at the left). Settings and an account at the top right is what people expect on the web, and it leaves room for a later sign-in. **It wins from 1440 up and costs nothing at 1024.**
- **The search and the sport centred** bring the search nearer to where the place it finds shows (510 against 738 px at 1440, 586 against 989 at 1920). That's once a session. The cost: they leave the planner, which the search's **Plan** opens and the sport routes for, so the top left keeps the logo alone over the planner. And the search is centred in the window while the toolbar is centred in the map beside the planner, two centre lines 166 px apart. Map apps with a side panel keep the search over it, at the top left. **A close call; D and E keep it at the left.**

**Room for the map** is the same in every option with the weather off (above). With it on, the foot's spare room decides: where A, D and E open the strip and B and C show its line, a fit frames the route 117 px less tall. That's a trade, not only a loss for B: A, D and E show the 48 hours without a click, and B and C keep that map with the strip a click away.

## The critiques

### /impeccable critique (2026-10-30)

Two separate reviews, as the command runs them: a design review of the options (Assessment A), and the detector with the page in headless Chrome (Assessment B). The page already labelled D "recommended"; A was told to ignore the label and judge for itself, and saw the frames, the numbers and the page's code, not this plan.

- **Nielsen's heuristics, out of 40:** A 27, B 25, D 29.
  - B scores 1 on error prevention, because things move under the pointer, and 2 on visibility, because the weather is away more often.
  - A scores 2 on consistency, because ⚙ sits by the sport while Settings opens at the far right.
- **How specific to Polku:** B is a canvas tool's layout without the bar of one width that makes it work. D keeps the toolbar with the route's panel in every state.
- **Its priority issues:**
  - **P0 (B):** the centred planner moves what was clicked, up to 191 px, and moves with each added point.
  - **P1 (B, C):** the centred toolbar moves whenever its width changes, and the weather loses a step at 1440, 1920 and 2560.
  - **P2 (A, D):** Done to Edit is 402–584 px, and Done moves at the first leg.
  - **P2 (all):** a warning moves the route's numbers, a matter for the planner's content.
  - **P3 (B):** two centre lines; the planner opens 124 px below the **Plan** that opens it at 1440.
- **Its choice: D, with one change, E:** Done and Edit at the toolbar's planner end, so Edit lands 8 px from where Done was, Done stays put at the first leg, and the toolbar's widths, so the weather's numbers, don't change. Its cost is the order: today Done is last (25a), as a toolbar's main action usually is, and E puts the way out before the drawing tools. A also tried aligning the route's view to the right so Edit lands where Done was: that costs the weather a step (1440, viewing: away instead of its line). E is in the mock-up.
- **The detector:** 16 advisory findings, none about the options: the page's own chrome (marked "not the design"), and the build's values that DESIGN.md doesn't list (radii of 8–18 px, 11 px words, #591's magenta).
- **The page in Chrome:** no console errors; nothing runs off the page at 390 or 1440 px. Fixed after it: Done ran 9–13 px past the drawn toolbar (the separators and Done are now the build's sizes), the parts' switches wrapped under their label, the frames now stack on a narrow page and line up at their foot, the wide table says it scrolls, and C's name is the same everywhere.

### /design:design-critique (2026-10-30)

This session's own pass, with the framework's headings, written after the recommendation was drafted.

- **First look:** A, C, D and E read as the app people know: one column at the left (the logo, the search, the sport, the planner) and everything else held by an edge. B reads as three floating islands with no edge in common, the search at the top's middle, the planner halfway down the left and the toolbar at the foot's middle; on a 2560 screen its planner floats like a dialog.
- **Reading order:** in A and D, from the top left down the planner to the toolbar at its foot, then the map. In B, a triangle with nothing to follow.
- **Consistency:** #233's plan names sides after the planner and the map's buttons; B's centred toolbar belongs to neither. Step 3, part 1 draws the folded planner as a line with the toolbar beside it; B and C split them. The toolbar's square left end joins nothing when the planner is short (#595).
- **Accessibility:** the same glass, words, targets and keys in every option. A screen magnifier suffers most from things that move: B's planner and centred toolbar move out of a magnified view, and so, less, does A's and D's Done.
- **What works:** B's ⚙ at the right; C's correction, which removes B's worst problem at no cost; B's toolbar nearer the map's middle on a wide screen.
- **Its priorities:** keep the planner at the top; keep the toolbar on the planner's edge; move ⚙ to the top right.

## Recommendation: D

**D: today's planner and toolbar, with ⚙ at the top right,** and the toolbar's left end rounded where the planner is short (#595).

- **It keeps still what people click and read.** In D nothing moves when the planner's content changes, and the toolbar's left end and its drawing modes stay put while it grows, while it folds and on Done.
- **It keeps the foot's spare room in one piece** by the map's buttons, so the weather opens or shows its line a step sooner than in B or C at every size, as step 3, part 2 and #568 assume.
- **It takes what wins from the idea:** ⚙ over the panel it opens, 169 px away at every size instead of up to 1649, with room beside it for a later sign-in.
- **It's small to build** and changes no decided plan.

**Where the idea loses:**
- the centred planner moves what was clicked, up to 191 px;
- the centred toolbar moves with every change in its width, up to 288 px, and halves the weather's room;
- the search and the sport leave the planner they serve;
- centring the toolbar in the window, the literal reading, puts it under the planner at 1440 and leaves it no room at 1024;
- and it undoes three decided things (below).

**Where the idea wins:**
- ⚙ at the right (taken into D);
- Done → Edit is shorter (296 px against 584);
- with the weather on, more of the map stays in view where its strip stays a line;
- the drawing modes and the search are nearer the map's middle on wide screens;
- and on a wide screen, as long as nothing changes, it looks more balanced.

**E, the alternative,** fixes D's one weak spot: Edit lands 8 px from where Done was instead of 584. Its one cost is the order: Done goes before the drawing tools, against today's (25a). D is recommended over it: in the route's view the planner has its own **Edit**, and the key E does the same, so going back rarely needs the toolbar's end.

## What each choice changes

- **D:** the top bar's ⚙ moves to its right end (`index.html`'s top bar and its CSS), last in the keyboard's order; Settings' panel stays where it opens; #595's rounded end. Nothing changes for #568 or step 3, part 2: they go on as planned. One small PR (Sonnet, or Opus at medium).
- **E:** D, and Done and Edit go first on the toolbar (`buildTools()`'s order, the toolbar's arrow-key order, the `toolbox` and `routeview` checks, DESIGN.md's toolbar and USING.md).
- **C:** B's top bar (the search and the sport centred, ⚙ at the right) and a centred toolbar, with today's planner. It reworks:
  - #468's position, the toolbar at the panel's map-facing edge, which [#233's order](https://github.com/TommiContursi/Polku/issues/233) calls a decided requirement;
  - step 3, part 1's folded line with the toolbar beside it (built);
  - the weather's home on the toolbar's edge (step 3, part 2), now half the room;
  - `placeTools()`, `fadeNewTools()` (the left edge that stays put), and where the scale and the credits sit (`--tools-h`);
  - the bottom dock, which needs its own answer.
- **B:** C's rework, and the side panel centred (its top worked out from its height, not 64 px), with 22b's movable panel (#179) needing a home for a planner that has no fixed top.

## Noticed

- The toolbar's square left end joins nothing when the planner is short: [#595](https://github.com/TommiContursi/Polku/issues/595).
- A warning's row goes in above the route's numbers and moves them 64 px; a question for the planner's content, not for this layout.
