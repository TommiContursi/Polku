# Design system: one look, made of one set of values (#382)

The plan for Polku's whole look: the planner, the cards, Settings, Layers, the top bar, the toolbar, and later Polku's web pages. **The decisions are in #382's description**, one dated line each. This file holds the design and the order of the work. Until 2026-11-17 the plan was to keep today's look and make it consistent. That part is built, and its sections (§1 to §8) stay below for their reasons. From 2026-11-17 the look is lifted, on the foundation described next.

## Which document is which

| Document | What it is | Who follows it |
|---|---|---|
| #382's description | Every decision, dated | Everyone, first |
| This plan | The foundation's design and its order, then October's plan | Anyone changing the look |
| [mockups/design-system-grouped.html](mockups/design-system-grouped.html), **Mine 9** (#1054) | The look, drawn: the planner, the cards, Settings, Check and Components. It's a sketch, and where the app shows something better, the app decides | Anyone building a screen |
| `docs/kit.html`, from the foundation's first PR | Every control, chart and type role, drawn by `css/app.css` itself, light and dark | Anyone adding something: copy it from here |
| [DESIGN.md](../../DESIGN.md) and DEVELOPING's "Shared controls" | What's built, and only that | Agents drawing a screen |
| [what-polku-knows.md](what-polku-knows.md) | Every fact, its one home and its summaries | Anyone drawing a screen checks it against this |
| [controls-inventory.md](controls-inventory.md) | `main`'s control styles on 2026-11-16 | The migration's list |
| [design-system-audit.md](design-system-audit.md) | October's evidence | Read it for the why |
| [20-map-style.md](20-map-style.md) (phase 20, #181) | The map's own drawing and labels | It owns the cartography, and this plan doesn't touch the map's labels |

The older mock-ups (`design-system.html`, `-main-and-mine.html`, `-round-6.html`, and #1023's directions) are history.

## The foundation (from 2026-11-17)

### What it's for

Polku is a tool for planning, and it has to hold a great deal and keep growing. The foundation is there so that it can:
- **Show a lot, and grow:** a new feature takes its type, controls and charts from the kit and draws nothing of its own, so the hundredth screen looks like the first.
- **Fit the device:** a phone outdoors gets big type and 44 px targets. A desktop is used up close with a mouse, so it's smaller and denser and covers less of the map. This is by the pointer, never by the window's width.
- **Move and resize its windows on a desktop:** the planner, the cards, Layers, Settings, the weather window and the profile (#179, a long-standing wish).
- **Show numbers as pictures:** a share, a range, a trend along the route or a comparison is drawn as a bar, a meter, a profile or a timeline, not written out in grey words. Today too much of what Polku knows has to be read and searched for in grey text.

### Why it's needed

- On `main` (a4150e5), `css/app.css` types 226 font sizes in px, 18 different sizes from 10 to 22 px with halves between. It also has 8 weights, 19 corners and 136 different paddings, and only 55 rules use the `--font-*` values. A change of look can't reach the app through values, so each session drew its own controls (the retro, #1057).
- The research of 2026-11-14 (#1023's `design-system-directions.md`) points the same way:
  - name each kind of thing and give it one look;
  - the figure is the heaviest thing, with its unit and word smaller and quiet;
  - one filled green at a time;
  - headings in sentence case, bigger than their rows;
  - tabular figures, and a display face only for headings and numbers;
  - a meter is one strong mark on a quiet track (Stephen Few's bullet graph).

### The values

- **Typefaces** (served by Polku and kept by the service worker; both are under the SIL Open Font License):
  - Atkinson Hyperlegible Next for words, Bricolage Grotesque for numbers and headings.
  - Every figure is set in Bricolage, rows included, so every zero looks the same: one text family takes its digits from Bricolage (`unicode-range`).
  - Before the files arrive the device's font shows (`font-display: swap`), with matched metrics so lines don't jump.
  - The profile's words on its canvas use the same families (`js/chart.js`). The map's own labels stay the map's (phase 20).
- **The type list**, one value for each role, in `rem`. Both columns are the user's (2026-11-17). With a mouse they're denser than "a size smaller", since a desktop is used up close. Both are tuned on the kit page:

  | Role | Value | By touch | With a mouse | Face, weight |
  |---|---|---|---|---|
  | A card's title | `--font-card` | 22 | 17 | Bricolage 700 |
  | The route's name | `--font-name` | 19 | 16 | Bricolage 700 |
  | A section's heading | `--font-heading` | 17 | 14 | Bricolage 700 |
  | A number | `--font-number` | 20 | 16 | Bricolage 700 |
  | A number's unit | `--font-unit` | 14 | 12 | Atkinson 400 |
  | A row's name, a key's words | `--font-row` | 15 | 13 | Atkinson 500, a key 600 |
  | A row's line, a number's word | `--font-line` | 13 | 12 | Atkinson 400 |
  | What you type | `--font-field` | 16 | 13 | Atkinson 400 (16 by touch, so iOS doesn't zoom) |
  | A number read while moving | `--font-glance` | 34 | 34 | Bricolage 700 |
  | Small on purpose (the scale bar, the credits, a chart's axes) | `--font-small` | 11 | 11 | Atkinson 400 |

  Reading text stays 12 px or more (the Small on Purpose Rule). Today's `--font-numeral`, `--font-title`, `--font-body`, `--font-control` and #1050's `--pl-*` go, each mapped onto a role in the migration.
- **Weights:** 400, 500 and 700, and 600 for a key's words. 650, 750 and 800 go.
- **Sizes**, by the pointer:
  - By touch: XS 28, S 32, M 40, L 44 and XL 52 px, with every target 44 px.
  - With a mouse, denser (the user, 2026-11-17): S 24, M 28, L 32 and XL 40 px, and a row 32 px. Today they're L 36, M 32 and a row 40. 24 px is WCAG 2.2's floor for a target. This replaces the 36 px with a mouse of #380 and §"The rules it keeps".
  - One rule gives a small control its 44 px target by touch, instead of today's three.
- **Space:** today's `--space-*` (2 to 24 px) stay. Each role that sets a space gets a value by the pointer:
  - a group's padding;
  - the gap between groups;
  - `--words-in`, the inset that lines a group's words up with its heading. Today it's summed by hand as 17, 19, 11 and 8 px (#1050's review).
- **Corners:** 6, 7 (inside a track), 10 (a control), 14 (a card or a group), 20 (a sheet), a pill and a circle. 2, 3, 4, 8, 9, 12, 16, 18 and the rest go.
- **Colours** stay as they are (§1), and green means chosen.

### The kit page

`docs/kit.html` loads `css/app.css` and draws, light and dark, in Finnish-length words:
- The type list, each role with its value as measured.
- Every control by its job, from DEVELOPING's "Shared controls", in its states (rest, hover, pressed, focus, chosen, disabled):
  - the main action, a key, a value ▾, a chip and segments;
  - a switch, a row ›, a bare icon and the stepper;
  - the numbers' box, and a group with its heading;
  - a row that goes sideways (the key facts, the weather layers): with a mouse it wraps; by touch it scrolls with a fade; where it still scrolls with a mouse, it has arrows (#382, 2026-11-17, from #1060's mock-up).
- **The charts.** Today Polku draws them each in its own code:
  - the profile (`js/chart.js`);
  - the weather timeline;
  - Check's bars for the ground and the climbs;
  - the hour strip;
  - a part's colours along the route.

  The foundation lists them and gives them one look. That means one axis, one label size, one way to show a missing stretch, and the sports' and scales' colours from the CSS. Then it adds the small pieces a new feature needs instead of a sentence:
  - a **meter**: one strong mark on a quiet track, for a share or a value against a limit;
  - a **share bar**: how a route splits into surfaces, ways or sports;
  - a **range**: from a lowest to a highest, with where you are;
  - a **sparkline**: a trend along the route, small enough for a row.

  Each one says what's missing (AGENTS.md's "Missing data never looks complete"), works in both themes, and has words for a screen reader.
- **The window:** the frame every card and panel shares, with its top row, its places in order (DESIGN.md's "A card's places"), and on a desktop a grip to move it and an edge to resize it.

A session that needs something the kit doesn't have proposes it to the user first, then adds it to the kit before using it (AGENTS.md's "One style").

### Windows that move and resize

On a desktop every window has the same frame:
- a grip on its top row to move it;
- an edge to resize it;
- its place and size remembered on this device;
- a way back to where it started.

The profile and the timeline can be opened big. On a phone, windows are sheets at their sizes, as today, and only one is open in a place at a time (#382, 2026-11-17). This builds #179 on the window of the kit page, after the foundation.

### The checks

- **`tokens`** reads `css/app.css` and counts the font sizes, weights and corners typed in px. It fails when the count grows. Each migration PR lowers the ceiling, until nothing is left outside the map's small text.
- **`anatomy`** runs on the full recorded route. For every card it checks:
  - the places are in DESIGN.md's order;
  - at most one filled main action in a panel;
  - Remove is last;
  - no heading is in capitals;
  - every button is one of the kit's classes.

  It's turned on for each kind of card as the cards' PR makes it true.
- **The kit page** gets a smoke group of its own, which loads it and measures each sample against the type list and the sizes, with a mouse and by touch.

### The PRs, in order

1. **The values and the typefaces,** after #1050 merges:
   - the values above on `:root`, and the font files served;
   - `js/chart.js` on the same families;
   - `--pl-*` replaced;
   - the kit page's first version (the type list and the values);
   - `tokens` at today's count;
   - DESIGN.md's Typography rewritten to the one list, with its older scales removed.
2. **The migration, by area,** in two or three PRs: the planner and the cards; Settings, Layers and the menus; then the rest. Every font size, weight and corner typed in px moves onto a value, and `tokens`' ceiling drops each time. Each PR has before-and-after screenshots of every screen it touches.
3. **The kit page complete,** with its controls and charts:
   - DEVELOPING's "Shared controls" points to it;
   - `anatomy` is turned on;
   - the charts that exist now share one look.
4. **Windows that move and resize** on a desktop (#179).
5. **Then the screens,** in #382's order. Each one is built from the kit, and its grey sentences become pictures where they hold a number.

Each PR comes with:
- its smoke groups;
- screenshots at 390 × 844 and 1440 × 900, in MTB and paddle, with a route drawn and the timeline open;
- CHANGELOG, for what people see;
- DESIGN.md, with only what's built.

### The values and the typefaces, as built (2026-11-17)

- **On `:root`:** the type list as the table above, the mouse's column on `:root` and the touch column under `pointer: coarse`; `--weight-row` (500) and `--weight-key` (600); S, M, L (`--target`), XL and a row by the pointer (a row 50 px by touch, 32 with a mouse); `--group-pad` 4, `--group-gap` 12 and `--words-in` 15 px with either pointer; `--radius-inner` (7). XS waits for a control that uses it, and a number is 20 and 16 rather than 24 and 18 (#382, 2026-11-17).
- **Names already in use took their new value:** `--target`, `--size-m`, `--row-h`, `--font-row`, `--font-number` and `--font-field`, so what was already on them is denser with a mouse. Reading text on `--font-small` moved to `--font-line`, so none went under 12 px. `--font-control`, `--font-body`, `--font-title`, `--font-numeral` and `--weight-name` stay for the migration.
- **`--pl-*` replaced** by `--font-name`, `--font-heading`, `--font-number`, `--font-row` and `--font-line`; `.card-float` no longer sets its rows and numbers.
- **The typefaces:** kept by the service worker as it installs; cut to 48 and 23 kB (woff2), Bricolage's headings and numbers listed in one rule; DEVELOPING's "Hover and colours" has the files, their commits and the commands.
- **Checks:** `tokens`, its ceiling 527 (230 sizes, 130 weights, 167 corners). The kit page's own smoke group comes with the full kit.

### The planner and the cards on the values, as built (2026-11-17)

- Every font size, weight and corner of the planner (the sheet and its side panel, the head, the numbers' box, the key facts, Route's list, Check's view, Route style and your speed, the round trip, When and the weather) and of the cards (every `.card` kind, `.card-float`, a pick card's facts) takes a role, chosen by what its text does. `tokens` fell from 527 to 295: sizes from 230 to 125, weights from 130 to 73, corners from 167 to 97.
- Rules that made something smaller on a desktop's card or by the window's width (the numbers at 340 px and on a phone, `.card-float`'s title, number and words) are gone: the type list goes by the pointer.
- `--font-control`, `--font-title` and `--font-numeral` are gone. `--font-body` and `--weight-name` stay for Layers' lit ways until Settings, Layers and the menus move.
- What fits no role, as the user chose (#382, 2026-11-18): a count in a ball or a badge is `--font-line`, Heads-up's mark `--font-number`, the main action's words `--font-row`, Route style's own headings `--font-row` in bold, the name's field on a card `--font-card`. A waypoint's figure and a loop's letter stay the map's own text. Still typed: the charts' bars and swatches (2 to 4 px corners), which wait for the kit's charts, and the skeletons shared with the timeline, which wait for its PR. The plain row (`row`, its corners, its name's and value's weight and its line) and `way-chips`' chips are shared with Settings, so they move with Settings' PR.

### Settings, Layers and the rest on the values, as built (2026-11-18)

- Every font size, weight and corner left after the planner and the cards takes a role: Settings and Layers with the plain row (`row`) and `way-chips`, the layer drawer, the menus and the popup's ✕, the timeline and its skeletons, the top bar, the map's buttons, and the dialogs, tooltips, toasts and banners. `tokens` fell from 295 to 42: sizes from 125 to 15, weights from 73 to 5, corners from 97 to 22.
- The plain row's name and value are 500 (`--weight-row`) wherever it's used, the planner's and the cards' rows included; its corners 10 px and its line `--font-line`. `body` is `--font-row`, so text that sets no size of its own follows the pointer too.
- What fits no role, by the precedents of 2026-11-18: the credits, the scale bar, 3D's Drag and the place under the timeline's reading (two lines no taller than its icon) are `--font-small`; a menu's item has 7 px corners inside its menu; a warning's words in a line are 700. The width rule that set the timeline's reading smaller is gone, as the planner's were.
- `--font-body` and `--weight-name` are gone. Still typed: the drawing toolbar's keys (#1042); the words under the map's buttons' icons, 11 px and 12 on a phone (#719), where DESIGN.md's Small on Purpose Rule says `--font-small` and #719 says 12, so the review decides; a waypoint's figure and a loop's letter (the map's own markers' text), and the charts' bars and swatches (the timeline's legend, the hour strip, Best time to leave, Data sources' meters), which wait for the kit's charts.

### Not decided here

- The exact values of both columns: tuned on the kit page with the user.
- The font files' bytes: measured once they're cut.
- How a window's place is remembered when the screen's size changes.

## October's plan (2026-10-22 and 23): where it stood

**Decided by the user**
- *2026-10-21, the app's controls (#356):* black icons in lists, green on the start's tiles and in switches; a chosen chip green with a 2 px border, everywhere; one stepper (− 30 min + in one box, the number typable); switches with icons where they help, and one chosen look for every switch: white, black words, a green icon or tick.
- *2026-10-22, the design system:*
  1. **The same look, made consistent and readable.** Today's colours, shapes and layout stay.
  2. **Three warning colours,** one for each of Check's groups: red for Read before you go, amber for Worth a look, blue-grey for Not checked. Difficulty keeps its own scale.
  3. **`row` for every list.** The start's tiles stay tiles (this narrows #356's first item, which counted `way-tile` among the rows).
  4. **Values first, then the controls,** in as few PRs as the review allows (each full run of the suite costs about 45 minutes).
  5. **Targets:** 44 px by touch at any width (`pointer: coarse`), 36 px with a mouse or trackpad, 8 px apart (#380).
  6. **Three additions:** what Polku draws on the map, one look for "not sure", and a glance size for the trail.
  7. **Ideas A to F** (in this plan below): sizes by context, one focus ring, outdoor contrast, a contrast sweep in the checks, DESIGN.md kept true by a check, and a shape for every warning group.
- *2026-10-22, the order (#383):* the values, the controls 25d uses and the map's colours from the CSS come before any more 25d code.

- *2026-10-22, the user's choices on this plan* (the recommendations, all taken):
  1. **Plan turns green,** like every other main action; red stays for the route and for danger.
  2. **The type values are named by what they're for** (`--font-title`, `--font-row`, `--font-small`…), and **every size is in `rem`,** so the browser's text size enlarges Polku.
  3. **Press feedback:** buttons, chips, tiles and switches shrink to 97 % for 120 ms while pressed; rows keep their grey background.
  4. **The colour scales: familiar, with fixes.** Difficulty keeps its colours with S1 split from S2; the sports' two worst pairs are separated and each sport's icon or name goes beside its colour; wind goes orange to blue; words and keys beside every scale, and a dark edge on light lines (§2).
  5. **Settings' High contrast covers the interface too:** solid cards, darker grey text and heavier lines, as well as today's thicker trails (§7).
  6. **Small on purpose,** as the list in §3; the map buttons' words go from 10 to 11 px on phones.
  7. **While a route is shown,** the route keeps a thin `--route` edge whatever Colour by paints inside, and the trails step back to about 60 % (§5). Both are drawn in the mock-up before the map PR builds them.
  8. **The moving chevrons and the route's glow stay as they are.**

**Waiting for the user:** nothing now.

**To decide when their step comes:** the four looks of "tap to change" (after 25d's Journey C); the look of the question about a point on the water; the timeline over the planner's tabs on phones (#377).

**Next**
1. ~~This plan, for the user's review (a Docs PR)~~: merged (#389).
2. ~~The values PR (names by role, in `rem`)~~: built (§8).
3. ~~The controls PR~~: built (§8); the user approved its screenshots on 2026-10-23.
4. Then 25d's Journey C.

## How it fits with 25d and the planner

Almost nothing in 25d changes because of this plan.
- **Already the same.** The warning colours (`--danger`, `--look`, `--unk` and their soft versions) and `--focus` are the ones 25d's approved mock-ups define, value for value. The chosen looks, icons, stepper and switches are #356's choices, which 25d already builds to. Check's groups, its badge and the markers on the route are 25d's parts 2 and 3. The warning box (`warn-row`) takes its group's colour on cards, the peek and sections; in Check only Read before you go's items are boxes (#366).
- **What this plan adds:** names for the values 25d already uses, so Journey C writes `var(--danger)` instead of `#b4232a`; the same values for the rest of the app; and checks that keep them true.
- **What it never does:** restyle what 25d says stays during 25d, or work in `css/app.css` while a 25d PR does. It runs before Journey C, as #383 orders.

| 25d's PR | What it takes from this plan |
|---|---|
| Journey C (parts 2 and 3) | The values (`--danger`, `--look`, `--unk`, their soft versions, `--focus`) for Check's groups, its badge and the markers; the markers above the route's glow; the map's colours read from the CSS. The badge's colours pass 4.5:1 (#376) |
| Journey D (1b and part 4) | The controls PR's rows, headings and stepper; 36 px rows with a mouse; #364, #90 and #334 as the user chooses them in Revision 6 |
| The map's cards (parts 5 and 6) | The cards replace MapLibre's own popups, which is how the LIPAS and trail cards get Polku's ✕, focus ring and type |

## The rules it keeps

- **Nothing Polku does is removed.** Class names stay, so nothing else breaks.
- **No framework, dependency or build step.**
- **WCAG 2.2 AA in both themes:** 4.5:1 for text, 3:1 for icons, borders and the lines that carry meaning. Never colour alone: every warning group has its shape (a triangle, an eye, a dashed "?"), every scale its words.
- **Targets:** 44 px by touch at any width, 36 px with a mouse, 8 px apart (#380). **A target is the area that answers a tap, not the size it looks:** a control can be small to look at, with its touch area grown around it, as the calmer planner's "32 px to look at and 44 px to touch" does. Dense map furniture (the credits' ⓘ, a marker in a cluster) has WCAG 2.2's floor: 24 px with room around it.
- **Small on purpose is a choice, not a defect:** the scale bar, the credits, chart axes and the map's own labels are small so the map has the room (§3's rules).
- **One list of controls:** DEVELOPING's "Shared controls". DESIGN.md holds the values and points to it.
- **25d, #356 and the calmer planner win** where they decide.

## 1. Colours

All values sit on `:root`, with dark versions under both of the app's dark rules (`prefers-color-scheme: dark` and `[data-theme="dark"]`). Today's 23 values stay as they are.

### New values

| Name | Light | Dark | For | From |
|---|---|---|---|---|
| `--danger` | `#b4232a` | `#ff8a8a` | Read before you go: the triangle, the box's icon, Check's badge | 25d's mock-ups |
| `--danger-soft` | `#fbe9e9` | `rgba(255, 138, 138, .14)` | the box behind it | 25d's mock-ups |
| `--look` | `#8a5a00` | `#f2c45a` | Worth a look: the eye; old data's words | 25d's mock-ups |
| `--look-soft` | `#fbf4e2` | `rgba(242, 196, 90, .12)` | its box | 25d's mock-ups |
| `--unk` | `#47607a` | `#9cc0e4` | Not checked, and anything not known: the dashed "?" | 25d's mock-ups |
| `--unk-soft` | `#eaf0f6` | `rgba(156, 192, 228, .13)` | its dashed box | 25d's mock-ups |
| `--focus` | `#1f6f4a` | `#6fd3a2` | the focus ring | 25d's mock-ups |
| `--good-text`, `--ok-text`, `--warn-text`, `--bad-text` | `#166534`, `#854d0e`, `#9a3412`, `#b91c1c` | `#4ade80`, `#facc15`, `#fb923c`, `#f87171` | status words and pills (`--good` and the rest stay for lines, bars and dots) | the draft |
| `--bad` in dark | (unchanged) | `#f87171` | red text in dark mode (#370) | #370 |
| `--route-water`, `--route-line`, `--route-loading` | `#0369a1`, `#be123c`, `#9ca3af` | the same | a leg over water, a straight leg, a leg being routed | today's values, named |
| `--grip` | `rgba(95, 107, 101, .8)` | `rgba(232, 236, 233, .45)` | every grip and handle (§4); today's grey is 1.8:1 | new: 3.4:1 or more on both surfaces |

**Measured:** each warning colour is at least 5.4:1 on its soft box and on the page, in both themes; each `-text` colour at least 6.2:1 in both themes; `--grip` at least 3:1 on its surface.

### What each colour means

- **Green** (`--accent`, `--accent-bg`) is what you act on or have chosen: the one main action, the chosen chip and switch, the focus ring, the lit stretch.
- **Red** (`--route`) is your route, and only that. **Danger** (`--danger`) says something can stop you. The two never meet without the white disc or edge that keeps them apart (§5).
- **Amber** (`--look`) is worth a look, or old.
- **Blue-grey** (`--unk`) isn't known.
- **Blue** (`--you`, `--route-water`) is where you are, and water.
- **Today these meanings are shared with the scales and the map's layers:** red is also S3, a 15–20 % grade, headwind, over 25 °C, steps, LIPAS hiking routes and road cycling; blue is also descents, rain, cold, cycleways and Other ways. The rules above are for Polku's own interface and the route; §2 and §5 say how the scales and the route keep apart from them.
- **Orange** belongs to the scales only (difficulty, gradient, way type). The five oranges typed into `css/app.css` today (`#b45309`, `#9a3412`, `#7c2d12`, `#fdba74`, `#fbbf24`, twelve uses) go to the values; the scales' own copies in the JavaScript stay with their scales (§2).

### Not sure: one look for each kind

| Kind | Look | Words, for example |
|---|---|---|
| Not known (missing, didn't load, not checked) | in a list, a row with the dashed `--unk` "?"; a missing number, a dashed box (`sum-item miss`); a warning on a card or the peek, the dashed `--unk` box | "difficulty not mapped", "didn't load" |
| Still loading | `--route-loading` grey, dotted on the map, no dashes elsewhere | "Finding the way…" |
| Known but old | `--look` words with the age | "Forecast from 07:40" |
| Estimated | no colour | "1 h 05 min, estimated" |

## 2. The colour scales and the profile

No plan designs these, and colour carries the meaning in all of them. They live in the JavaScript today: `DIFF_COLORS`, `GRADE_BANDS`, `SURFACE_COLORS` and `SPORT_COLORS` in `js/config.js`; `WAY_COLORS` and `TRAIL_SCALES` in `js/chart.js`; `TEMP_BANDS`, `RAIN_BANDS` and `WIND_CLASSES` in `js/weather.js`.

**What holds:** one meaning has one colour across the map, the profile, Colour by's legends and the climb badges: each scale is defined once and used everywhere. Most uses carry words too (the S-grades are written out, the breakdowns have labels).

**What fails,** measured with the dataviz skill's validator (`validate_palette.js`) and the WCAG formula:

| Scale | What fails |
|---|---|
| MTB difficulty S0–S6 | S1 and S2 are the same colour with deuteranopia, the most common colour blindness. The scale isn't ordered by lightness. S1's yellow is 1.9:1 on white and 1.6:1 on the terrain map; S5 and S6 are 2.3 and 1.5:1 on the night map |
| Sports | MTB and gravel are identical with deuteranopia (ΔE 0.6). Hiking and trail running are hard to tell apart even with full colour vision (ΔE 4.5). Teal reads as grey |
| Way type | Steps' red and footway's brown are hard to tell apart with full colour vision; footway and steps are the same with deuteranopia |
| Gradient and temperature | Their light steps (3–6 %, 6–10 %, cool, mild, warm, warmer) are 1.3–1.7:1 on white, so the line nearly disappears on the profile's background and on the terrain map |
| Visibility, width, rain | Not ordered by lightness. Visibility's and rain's light ends are under 2:1 on white |
| Wind | Red for headwind and green for tailwind: the classic pair colour blindness can't tell apart. Red also means the route and danger |
| Climb badges | White text on the scale's colours: ↑S1 1.9:1, ↑S2 2.15:1, a 6–10 % climb 1.53:1 (#376) |
| One meaning, two colours | Temperature has different steps on the map (`js/wxmap.js` 28) and on the route (`js/weather.js` 251–258); on the wind map green means 6 m/s, on the route a tailwind. Other ways' alternatives (`#2563eb`, `js/planner.js` 75) are the same blue as cycleways |
| Keys | Colour by's key is in another tab (Check › On the route), not under the profile; the weather legend shows only its two ends; a route coloured on the map has no key |

**What the plan does:**
- **Every scale becomes values** in the values PR, with no visible change: read by the JavaScript from the CSS, so dark mode and the night map can have their own steps later.
- **The rest comes in the map and scales PR** (§8):
  - **Words beside every colour,** wherever a scale shows: the badges, the legends, the map's key. Climb badges get `--text` on the light steps, or a dot of colour beside text in `--text` (#376).
  - **One set of steps per meaning:** the weather on the map and on the route use the same temperature and wind steps; Other ways get a colour that isn't water's or a cycleway's.
  - **The key where the scale is drawn:** under the profile for Colour by, with the timeline's legend showing its steps, and on the map while the route is coloured.
  - **A dark edge on every coloured line** on the map and the profile (a 1 px `rgba(0,0,0,.35)` casing, or the white casing the route already has), so the light steps stay visible on any base map.
  - **The scales themselves** follow the user's choice 4: keep difficulty's colours, which people already know from Polku's trail map, and split S1 from S2 by lightness; separate the sports' two worst pairs (gravel to a lighter yellow, trail running to aqua) and show the sport's icon or name wherever its colour shows, since eight sports can't all be told apart by colour, for everyone, with any palette (checked with the validator on every pair); give wind orange for headwind and blue for tailwind with grey between, which stays apart on every pair with colour blindness and doesn't use red. What stays unsolved is said plainly: with deuteranopia S0, S2 and S3 still look alike (a green-to-red ladder can't avoid it) and road and hiking too, so the written grade and the sport's icon or name carry them. Each change is drawn in the mock-up first, with a **Colour vision** switch that simulates it.

**The profile chart** (`js/chart.js`, drawn on a canvas): it already reads `--chart-ink`, `--chart-grid` and `--muted`, so it follows dark mode. Its axis labels (10 px) and the numbers inside its points (9.5 px) are small on purpose and stay; what changes is that they're drawn from the values, in `rem`-based sizes when that's chosen, so they grow with the browser's text size. The climb tags' white text on the scale's colours follows #376. The points' black and white become `--wp-ink` and `--wp-paper` (§5). Its hover band (`rgba(17,24,39,.07)`) and a stretch's selection (`rgba(31,111,74,…)`, `js/chart.js` 371, 473–475) are typed for light mode, so they likely vanish in dark: they're read from the values too. Four different "no data" greys (`#d6dde3`, `#e2e8f0`, `#cbd5e1`, `#94a3b8`) become one. The canvas gets a name for screen readers (#386).

**The weather timeline** (`js/wxmap.js`): its canvas labels (10 px) are axis labels, small on purpose, drawn from the values like the profile's. Its chips (Wind, Temperature, Rain, Snow) are `chip` and follow §4; their pressed blue (`#1d4ed8`) has no dark version today (2.57:1, #376). Its temperature line and labels are fixed oranges, and its night shading asks `matchMedia` instead of a value: both read the values. Its colours are the weather scales above.

## 3. Values for type, shape, depth and motion

Each scale keeps today's most-used values. A size between two steps moves to the nearest one, when that control is next touched.

| Scale | Values |
|---|---|
| Text sizes | 12 small · 13 a line · 14 body · 15 a row's name · 16 a field · 17 a title · 19 a number · 22 a big number · 34 the glance size (named by what they're for, in `rem`: the user's choice 2) |
| Weights | 400 · 600 · 700 (650 and 750 go; the system fonts draw them as 600 or 700 anyway) |
| Corners | 6 small · 10 a control · 14 cards, panels and tiles · 20 the phone sheet's top · 999 pills · 50 % circles |
| Shadows | `--shadow-marker` (markers on the map) · `--shadow` (floating cards and buttons) · `--shadow-sheet` (the sheet's and the panel's edge) · `--shadow-dialog` (dialogs), each with a dark version |
| Timing | `--t-press` 120 ms (press, hover) · `--t-open` 180 ms (cards, menus) · `--t-sheet` 260 ms (the sheet, the panel). Closing uses the next shorter one. `--ease-out` for everything but the sheet, which uses `--ease-drawer`. With reduced motion: a fade, no travel |
| Spacing | 2 · 4 · 6 · 8 · 10 · 12 · 16 · 24 |
| Sizes by context (idea A) | `--target`, `--row-h`, `--mark` and the type sizes are set once per context: by touch, with a mouse, the desktop card (`card-float`), 200 %. The desktop card sets about six values instead of its 40 override rules |

`--ease-out` and `--ease-drawer` move from `.qd` to `:root`.

**Rules:**
- **Small on purpose is allowed; Polku is a map.** Two kinds of text:
  - **Reading text,** what you read to decide or act (names, values, actions, warnings, a row's line, notes, headings): 12 px or more. Small headings go from 10–11.5 px to 12 px.
  - **Small on purpose,** what supports something larger (the scale bar, the credits, the map's own labels, the profile's and the timeline's axes and ticks, units beside a number, a word under an icon, a number inside a mark, the compact desktop card): down to 10 px. It still passes 4.5:1, grows with the browser's text size, and is never the only place its information is.
- **Fields are 16 px on phones,** so iOS doesn't zoom the page.
- **Numbers that change use even-width digits** (`font-variant-numeric: tabular-nums`).
- **On desktops, cards are one step smaller:** a title 15, numbers 17.
- **The glance size:** 34 px, 700, `--text` on `--surface-solid`, never on frosted glass. Phase 23 uses it for numbers read while moving.
- **Spacing** applies to new work and to a control when it moves onto the values. No sweep.

## 4. Controls

### One of each

| Job | Control | Replaces |
|---|---|---|
| A row in a list | `row` in `rows` | `sport-row`, `way-srow`, `speed-sport-row`; Check's Worth a look and Not checked items (25d) |
| A choice to begin with | `way-tile` | stays |
| An action in a pop-up menu | `menu-item` | stays, with `row`'s sizes and states |
| A warning | `warn-row`, coloured by its group: red Read, amber Worth a look, dashed blue-grey Not checked | the yellow-only box; in Check only Read's items are boxes (#366) |
| A chosen chip | green, 2 px border (#356) | the black fill of `chip`, `act-chip`, `chip-on` |
| A switch | `seg`, one height per context; chosen: white, black words, a green icon or tick (#356) | the 28, 32 and 40 px switches |
| A number to step | one stepper, − 30 min + in one box (#356) | `rt-step`'s field with − and + apart |
| A small heading | 12 px capitals, `--muted`, .06em | `menu-h`, `lp-sec h3`, `chip-group-label`, `sec-title` and the rest |
| A title | 17 px (15 on desktop cards) | `way-hint`'s 17 and `insp-title`'s 15 |
| A grip or handle | one `grip`: `--grip`, 3:1, `--accent` while held, 44 px by touch | `sheet-handle`, `qd-grab`, `sheet-resize`, `tl-grip`, `wpl-grip` (five looks today) |
| A button's label | wraps; a least height, not a fixed one (#373) | `btn` and `btn big`'s fixed heights |
| A switch (on and off) | `tg`; its off track gets a `--muted` outline, 3:1 (today 1.31:1) | — |
| Folding a section | one chevron | today three: a native ▶ (the map key), a CSS chevron (Layers' groups), an SVG chevron (the planner's sections) |
| Choosing a base map | one look in both places: a tick, a 2 px border and a tint, as the layer drawer has | All layers' 64 px squares with a border only |

Icons are black in lists and menus, green on the start's tiles and in switches (#356).

### The same states everywhere

`row` (25d) already has all of them. It's the model.

| State | Look |
|---|---|
| Hover | `--surface-2` behind it, only with a mouse: `@media (hover: hover) and (pointer: fine)`. Today 38 of 57 hover rules apply on touch screens too, where they stay after a tap (#208) |
| Pressed | `--surface-2` while pressed; buttons, chips, tiles and switches also shrink to 97 % (the user's choice 3); no tap flash: `-webkit-tap-highlight-color: transparent` once on `html`, `touch-action: manipulation` and `user-select: none` on every control |
| Focus (idea B) | one 2 px `--focus` ring under `:focus-visible`, set once with `:where(button, a, input, select, [tabindex]):focus-visible`; outside a control, inside a row of a list. Today `btn`, `tool`, `chip`, `way-tile` and `way-back` show the browser's own ring, and the sport menu and the ⋯ menus show none at all (#385) |
| Chosen | a green icon or tick plus a border or a word (#356) |
| Can't be used | hidden if it never can be there; disabled and dimmed if it will be soon, like undo with nothing to undo |

### The planner's own controls

The toolbar, the toolbox, the tabs, Minimise (⌃), Done, the panel's place (side or bottom; a 34 px icon today, and moving it leaves the route under the panel, #387), the timeline's controls, Layers (whose names drift: "On the map" and "On now", "Trail colours" and "Difficulty colours") and Settings: they take the same states, values and targets in the controls PR or later ones, but **not while 25d says they stay** (the toolbar, the start and the ⋯ menu during 25d). The second audit (#379) looks at them whole after 25d.

## 5. What Polku draws on the map

The base map, its roads, paths and labels, LIPAS's routes by kind and the typeface are phase 20's (#181). This plan covers what Polku draws on top.

**Today** (`js/style.js`, `js/routeflow.js`):
- **The route:** a white casing (90 %) under a red line, 3 px at zoom 8 to 6.5 px at zoom 16. Over water it's blue, a straight leg is darker red and dashed, a leg being routed is grey and dotted, a carry is orange dots, a point the route couldn't reach a thin grey dashed line.
- **The glow (#198):** a halo in the route's colour at 30 %, 55 % on the leg under the pointer, fading in 150 ms.
- **The moving chevrons:** white at 90 %, 26 px apart, 14 px a second, at most 24 frames a second, only while the route is in view, the page visible and the map flat; they rest 45 s after the last touch, and with reduced motion they don't move (static arrows show the way).
- **The points:** white discs with a black ring and their number; the start green with ▶, the end black.

**The rules:**
- **What's about your route has a white edge and a shape:** the route, its points, its warning markers and you. Map layers never have a white edge. The edge keeps the two apart where both are red.
- **The route's colours are values** (`--route`, `--route-water`, `--route-line`, `--route-loading`, `--accent` for a selected stretch), read by `js/style.js` from the CSS (step 3).
- **Warning markers** (25d part 3): a white disc holding the group's soft colour, its border and its icon. They sit above the route's glow, so it never washes them out. On phones each marker's tap area is 44 px; where markers crowd, they merge into one with a count (25d part 3), so none has to shrink.
- **The chevrons show on every leg:** white at 90 % is 4.0:1 on the red line and 5.1:1 on the blue, but 1.5–2.1:1 on Colour by's light steps. Under a light colour they take a thin dark edge.
- **The route keeps its identity under Colour by** (the user's choice 7): a thin `--route` edge outside its white casing, whatever Colour by paints inside.
- **The trails step back while a route is shown** (the user's choice 7), to about 60 %; the overlay's own look is phase 20's.
- **One thing moves without being touched:** the chevrons, which stay as they are, with the glow (the user's choice 8). Anything else animates once, in answer to something you did, and never loops.
- **The points' black and white become values** (`--wp-ink`, `--wp-paper`, the same in both themes since they sit on the map), and the start's green becomes `--good`.
- **Checked** in screenshots on the terrain map, aerial photos and the night map.

## 6. Dragging

What Polku lets you drag, and the way without dragging that each keeps (WCAG 2.2's 2.5.7):

| What | How it shows today | Without a drag |
|---|---|---|
| The planner's sheet and the layer drawer | follows the finger 1:1, rubber-bands at its ends, settles with a spring from the finger's speed (`js/sheet.js`) | a press on the handle; Done |
| The desktop panel's width | `ew-resize`, the edge turns green | the edge is a focusable separator with arrow keys, and a double-click |
| The timeline's width | `ew-resize` | none yet (#379) |
| A point on the map | `grab` and `grabbing`; the route follows live | **Move** on its card |
| The middle of a leg | a small handle that grows by 1.3 on hover | add a point, then Move |
| A point in the list | the row lifts with `--shadow`; a 2 px green line shows where it lands | Earlier and Later; Alt+↑ and Alt+↓ (25d part 4) |
| A GPX or KML file | a drop hint over the page | **Import** |

**One set of states:** *can drag* (the grip, and `grab` with a mouse); *held* (it lifts with `--shadow`, follows 1:1, its transitions off); *where it lands* (a 2 px `--accent` line or ring); *let go* (it settles on `--ease-out`, or with the sheet's spring when it carries speed). The spring's values stay where they are, in `SWIPE` in `js/sheet.js` (damping 0.85, response 0.3 s, a flick at 1.1 px/ms, rubber band 0.55), and DESIGN.md records them.

## 7. Outdoor contrast and reduced transparency

Built with B's look (#547, 2026-10-30): reduced transparency, more contrast and Settings' **High contrast** turn every glass solid, and more contrast takes a darker grey, heavier lines and a 3:1 rim ([B as built](issue-547-the-look.md#b-as-built)).

- **Outdoor contrast (idea C):** with `@media (prefers-contrast: more)`, or Settings' **High contrast** (the user's choice 5), the frosted cards turn solid, `--muted` moves closer to `--text`, lines double in weight and cards get a clear 1 px border; the switch keeps thickening the trails as it does today. It changes nothing for anyone who doesn't ask for it.
- **Reduced transparency:** today only the layer drawer turns solid with `prefers-reduced-transparency: reduce`. Every frosted surface does: the top bar, the map's buttons, the sheet, the panel and the cards.
- **Grey text on frosted glass** is the case these two are for: over busy aerial photos the 94 % surface lets the map through.
- **The status bar** takes one green for both themes (`theme-color` in `index.html`). The map fills the top of the screen, so it's a choice, not a mismatch; it's looked at again with the dark map in the map PR.

## 8. How it's built

Four PRs after this plan, in #383's order. The first two come before any more 25d code.

| PR | What | Visible? | Closes or touches |
|---|---|---|---|
| **The values** (Fix) | Every value in §1, §3 and the route's colours on `:root`, with dark versions (in `rem`, if chosen); the JavaScript's meaningful colours read from the CSS (`getComputedStyle`, as `js/wxmap.js` does, and again when the theme changes): the route, the warning colours, the scales; #370's dark red; DESIGN.md updated to the values; the checks below (ideas D and E) | No, apart from #370's dark red | #370 |
| **The controls** (Fix) | §4's "One of each" and its states for the controls 25d uses: rows, chips, switches and their off track, the stepper, headings and titles, the warning box, the focus ring (in the menus too), button labels that wrap, names that break at 200 %; the status pills and badges at 4.5:1; Plan in green; press feedback | Yes: screenshots before and after, for the user | #356, #376, #373, #384, #385 |
| **Touch and the whole app** | Hover only with a mouse, no tap flash, pressed states, touch areas of 44 px by touch (grown around small controls), reading text at 12 px or more, the map buttons' words at 11 px, the grips, the top bar at 200 %, names for screen readers, one fold arrow, one base-map picker | Yes | #208, #235, #375, #386 |
| **The map and the scales** | §2 and §5: the scales' words, keys and edges, one set of steps per meaning, the scales the user chose to change, the route's edge under Colour by and the trails stepping back if chosen, the chevrons' edge, the points' values; outdoor contrast, Settings' High contrast and reduced transparency (§7) | Yes | #388 |

The touch PR and the map PR come after 25d's journeys, any time before #365. The rest of `css/app.css` moves onto the values when it's next touched; a last PR lists what's left and moves it. The second audit (#379) comes after 25d.

Each PR: claim it on #382, the checks first (failing on `main`), then the build, the groups it touches, one full run of the suite and one review at the end (#383), screenshots for anything visible, DEVELOPING's "Shared controls" and DESIGN.md updated in the same PR, and a Hand-over on #382.

### The values, as built (2026-10-22)

- **On `:root`:** §1's colours with their dark versions (`--bad`'s dark one is #370's fix); §3's values: the text sizes in `rem` (`--font-small` … `--font-glance`), the weights, the corners, the four shadows, the timings and the spacing (`--space-2` … `--space-24`); idea A's `--target` (36 px, 44 px under `pointer: coarse`), `--row-h` and `--mark`, with the desktop card's own sizes set once on `.card-float`; the route's legs; and every colour scale of §2 (`--diff-s0` …, `--grade-…`, `--surf-…`, `--sport-…`, `--way-…`, `--trail-width-…`, `--trail-vis-…`, `--temp-…`, `--rain-…`, `--wind-…`), each step its colour of today. `--page` names the page's colour, so every colour in DESIGN.md is a value. `--ease-out` and `--ease-drawer` moved from `.qd`.
- **In the JavaScript:** `fromCss()` in `js/palette.js` fills the tables from the CSS, and again when the theme changes, and then the map's style and Colour by are drawn again. The map's key for the route uses the values. The planner's colour swatches (`SWATCH`), unused since #302, are gone.
- **Not yet:** the 200 % context sets nothing, since the controls PR decides what changes there. Still typed in the JavaScript, for the map and scales PR: the "no data" greys (`js/chart.js`, `js/planner.js`), the wind's shares in Go (`js/planner.js`), the other ways' and the loops' colours, and the weather map's (`js/wxmap.js`).
- **Checks:** `tools/smoke.py values`: DESIGN.md's colours (idea E), the route and the scales through a change of theme, and the contrast sweep (idea D) over eleven scenes, with #376's failures listed until the controls PR fixes them.

### The controls, as built (2026-10-23)

- **One look for each job (#356):** the start's sport, **Fine-tune in How you go** and Settings' speeds are `row`s, with black icons (their old classes stay on them). Every chosen chip is the round trip's: a green tint, a 2 px green border, black words (`chip`, `act-chip`, `chip-on`, a menu's chips, the timeline's). A switch (`seg`) is `--target` tall, the chosen one's icon green; `seg icons` too. The stepper is one box: `rt-len` holds −, the field, its unit and +. One rule gives every small heading its look, 12 px capitals in `--muted`. Titles take `--font-title`, and the map's own cards (`insp-title`) take 15 px on a desktop, as a desktop's card does.
- **The same states:** one focus ring (idea B), `:where(button, a, input, select, summary, [tabindex]):focus-visible`, in `--focus`, drawn inside a row and a menu's item, the sport menu's too (#385). Press feedback: buttons, chips, tiles and switches shrink to 97 % for `--t-press` while held, with no grey flash; rows keep their grey; none with reduced motion.
- **Words at 4.5:1 (#376):** the pills in the `-text` colours; Check's count in the surface's colour on `--warn-text`; black words (`--ink`) on a climb's badge or a loop's letter where white doesn't read (`darkWords()` in `js/palette.js`); the cost on **Make 3 loops** in full white; an active weather layer's chip in `--wx-text` (a new value, lighter in dark); the drop hint's words on a card of their own; a switch's off track with a `--muted` edge (3:1). On the layer drawer a tile that's on keeps its green border, icon and tick, and its name is black: green words were 4.2:1 in dark. `CONTRAST_KNOWN` in `tools/smoke.py` is empty.
- **Plan in green** (`--accent-bg`), and green while the planner is open.
- **Words that wrap (#373, #384):** `btn` has a least height, never a fixed one, and the buttons that set a height of their own set a least one. A card's title breaks anywhere; under about 220 px of card a row's value goes under its name and › goes.
- **The warning box** (`warn-row`, with `danger`, `look` or `unk`), from the mock-up, for Journey C to use.
- **Idea A for the card's controls:** rows, titles, numbers, marks, the stepper and the switch read `--row-h`, `--font-title`, `--font-number`, `--font-numeral`, `--mark` and `--target`, which `.card-float` sets; its override rules for them are gone.
- **Not in it, for the touch PR:** hover only with a mouse, the grips, touch areas grown around small controls (the ⋯ menu's 36 px items with a mouse, the map's buttons), reading text under 12 px elsewhere, the top bar at 200 % (#375), one fold arrow and one base-map picker.
- **Checks:** `tools/smoke.py controls` (each pair where the app draws it, the rings by keyboard, a press held, the words in light and dark, Finnish at 200 %), and `loops` measures each loop's letter.

### Checks in every PR

In `tools/smoke.py`:
- **A contrast sweep (idea D):** every visible text in a set of scenes, against the solid colour behind it, at 4.5:1 (3:1 for large text), in both themes. It reuses `tools/census.py`'s measuring code. It replaces checking pairs one by one, and would have caught #370 and #376.
- **DESIGN.md stays true (idea E):** every colour in DESIGN.md's frontmatter equals its value in `css/app.css`, in both themes.
- **Values typed in place never grow:** a count of colours, sizes, corners, shadows and timings in `css/app.css` outside `:root`.
- **The same control computes the same style** in each pair #356 named.
- **Targets:** the touch area, not the look: 44 px by touch, 36 px with a mouse, 24 px with room around it for dense map furniture.
- **Small on purpose is listed, not counted as failing:** the check keeps a list of the elements that are small on purpose (§3), and fails on reading text under 12 px.

By hand, as Polku's regression list does: screenshots before and after at 390 × 844 and 1440 × 900, light and dark, at 200 %, with long Finnish words and with reduced motion; the map PR also on the terrain map, aerial photos and the night map.

## Done when

- Each job in "Shared controls" has one control with one style.
- All text passes 4.5:1 in both themes, small on purpose included; every line that carries meaning, 3:1.
- Reading text is 12 px or more; what's smaller is on the list of small on purpose.
- `css/app.css` has no colours, sizes, corners, shadows or timings typed in place outside `:root`.
- The JavaScript reads its meaningful colours from the CSS.
- Every colour scale has words beside it wherever it shows, and passes the validator or carries a second cue.
- The route and its markers stay visible on all three base maps.

## Not in this design

- **The base map's own drawing, the typeface and the map's labels:** phase 20 (#181).
- **Zoom blocked** (`user-scalable=no`): #73.
- **New looks:** none. Anything that changes the look goes to the user first, as AGENTS.md says.
- **Two Plan buttons on a desktop:** kept on purpose (the calmer planner, 2026-10-21).
- **What 25d decides:** the planner's structure, the cards, Check's groups, the list and Revision 6's choices.
