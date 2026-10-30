# Desktop layout (#594)

Where the toolbar, the planner and the top bar sit on a desktop: today's layout beside an idea from the user (2026-10-30), and the options between them, drawn as a mock-up to choose from. What's still to do, and its status, is on GitHub, in [#594](https://github.com/TommiContursi/Polku/issues/594).

- **Status (2026-10-30): nothing is decided.** The mock-up decides nothing until the user chooses. [#568](https://github.com/TommiContursi/Polku/issues/568) and step 3, part 2 of [#233](https://github.com/TommiContursi/Polku/issues/233) wait for the choice, since both place things at the map's foot.
- **Recommended: D,** today's planner and toolbar with ⚙ at the top right. [The recommendation](#recommendation-d) says why, and where the idea loses and wins.
- **The mock-up:** [mockups/issue-594-desktop-layout.html](mockups/issue-594-desktop-layout.html). Today on the left, an option on the right, in the same scene and at the same size.

## The mock-up

[mockups/issue-594-desktop-layout.html](mockups/issue-594-desktop-layout.html), on B's look ([#591](https://github.com/TommiContursi/Polku/pull/591) at 79a6ae4). It opens on B beside today at 1440 × 900.

- **Its switches:** the option (A, B, C, D), or **its parts** one by one (the top bar; the planner at the top or centred; the toolbar on the planner's edge, centred beside the planner, or centred in the window), so any mix can be tried. The size: 1024 × 768, 1440 × 900, 1920 × 1080 and 2560 × 1440. Side by side, or one above the other for bigger frames.
- **The scenes,** each with **Change** (or **Play**, which goes back and forth): the first leg (the second point brings the route's actions onto the toolbar), the list (Waypoints folded and open), a warning (a departure after dark puts "1 to read before you go" at the planner's top), the profile (taller and smaller), the tabs (Route and Go), one more point, Done and Edit, the weather while editing and while viewing, and the planner folded to its line.
- **What it shows on top:** **Where it was** outlines the planner and the toolbar as they were before the change; **Pointer travel** draws the distances below; **Room for the map** draws where a fit frames the route and the spare room at the foot.
- **Under the frames:** what moved in this scene, in both frames, and a table of every option at every size (the numbers below).
- **What's a picture and what's drawn:** the map at each size and the planner in each state are pictures of #591's build with the Kauppi route (on `pr-screenshots`, `claude/desktop-layout/`). The top bar, the toolbar, the map's buttons and the lines are drawn with B's values, at the sizes the build measures. Two things aren't built and are drawn as their plans say: #568's Share link, Export GPX and Save offline in the route's view, and the weather at the foot (step 3, part 2).
- **Left out:** the bottom dock (B's centred planner has no meaning there, and a toolbar centred on the bottom panel's top edge would move as B's does), dark mode, the zoom hint, Finnish (the toolbar is 1121 px where English is 1110: one more of the route's actions in ⋯ at 1440, no change at 1920 and 2560), the search's results, the menus and Settings' panel.

## The options

- **Today:** the logo, the search, the sport and ⚙ in one row at the top left. The planner hangs from under the top bar on the left (392 px wide) and is as tall as its content, up to the window's foot. The toolbar hangs off the planner's right edge at the window's foot (#468) and folds for the map's buttons (`placeTools()`). The map's buttons are a column at the right, at the foot. The weather's timeline floats over the map, 40 px above the toolbar.
- **A: today, with what's decided.** Today, with #568's three buttons in the route's view, and the weather at the foot by the map's buttons, as step 3, part 2's plan has it: open where it fits beside the toolbar, else its 210 px line, else away on the Weather button; the toolbar never gives anything up for it.
- **B: the idea.** The toolbar centred at the map's foot; the planner centred on its side; the logo where it is; the search and the sport centred at the top; ⚙ (and later sign-in) at the top right. Centred in the window, the toolbar would sit under the planner at 1440 × 900 (its room there is 608 px, so all seven of the route's actions go to ⋯) and leave no room at all at 1024 × 768, so B centres it in the map beside the planner. Everything decided for A is in B too.
- **C:** B with the planner at the top. Today's planner already is: it hangs from under the top bar and its foot follows its content. So C is A with B's top bar and B's toolbar.
- **D: today's planner and toolbar, with ⚙ at the top right.** The toolbar's left end is rounded where the planner doesn't reach the foot ([#595](https://github.com/TommiContursi/Polku/issues/595)). Everything decided for A is in D too.

Since today's planner is C's, the idea is three changes that can be chosen apart: **the top bar** (the search and the sport centred, ⚙ at the right), **the toolbar** (centred, or on the planner's edge) and **the planner** (centred, or at the top).

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

**Room for the map is the same in every option:** the planner stays 392 px on its side, the top bar keeps its pieces and their sizes, and a fit frames the route in the same box (`viewPadding()`: from 40 px beside the planner, under the top bar, above the toolbar). What differs is the foot's spare room: one piece by the map's buttons when the toolbar starts at the planner's edge, two halves when it's centred. The weather goes by the map's buttons, so centring halves its room.

__CRITIQUE__
