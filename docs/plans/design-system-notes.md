# Design system: notes on the draft, and ideas

A second look at the design-system draft of 2026-10-22, written in another session and not committed. The first parts below were read from the CSS. [design-system-audit.md](design-system-audit.md) then went through the running app, and its section "Against the approved plans" comes before these notes where they differ. Where 25d, #356 or the calmer planner already decide something, that decision stands. It checks the draft against the code, measures what the draft measured, and adds ideas. The mock-up [mockups/design-system.html](mockups/design-system.html) shows today's tokens as [DESIGN.md](../../DESIGN.md) records them and, behind a switch, the proposal.

- **Status (2026-10-22): for the user's review.** Nothing is built.
- **From:** `main` at b4bcdb1, and the cards branch `claude/25d-1-card` at 34e5a02 (#352), the latest work on the app.
- **Goes with:** #356 (the same controls look different), #368 (DESIGN.md), #370 (red text in dark mode).

## What the draft gets right

I measured the same values with the WCAG formula and agree with the draft:

- **The status colours are too pale for text** on white: `--good` 3.3:1, `--ok` 2.9:1, `--warn` 3.6:1. On `--surface-2` they fall to 3.0, 2.7 and 3.2. The `.pill` classes use them as text.
- **Only the colours are shared values.** The cards branch has 18 font sizes, 7 weights, 25 different corner values, 21 shadows typed in place, and 16 different timings.
- **The JavaScript holds the meaningful colours.** On the cards branch, the route's red (`#e11d48`) appears 8 times in `js/`, danger red (`#dc2626`) 24 times and orange (`#ea580c`) 10, so dark mode can't reach them.
- **Its proposed colours pass.** Danger, look and not-known are each at least 5.4:1 on their soft box, 5.9:1 on white and 7.6:1 in dark mode. The four `-text` colours are at least 6.2:1 in both themes.
- **The `row` on the cards branch is the model.** It already has hover only with a mouse, a pressed look, an inset focus ring and a chosen state.

## Where I differ, or would add

1. **Red text fails in dark mode, and the cards add more of it.** `--bad` has no dark version, so on the dark surface it is 3.56:1. That covers Remove and Delete in the ⋯ menu, `.pill.bad`, Avoid, and on the cards branch `.row.danger` (Remove on a point's card). The draft lists the light-mode failures but not this one. It's a bug today, and a one-line fix (a dark `--bad`, `#f87171`, 6.2:1) can ship before the plan: **#370**.
2. **The controls without a ring still get one: the browser's own.** The draft says `btn`, `tool`, `chip`, `seg` and `way-tile` have no focus ring. They don't set one, so the browser draws its default (blue in Chrome, a different one in Safari). They're inconsistent, not invisible. That doesn't change the plan, but it does change the risk: nothing is unreachable by keyboard today.
3. **Name the type steps by what they're for, once.** DESIGN.md uses numeral, title, heading, row, body, control, small and label. The draft's CSS names are `--font-small`, `--font-line`, `--font-name` and so on. Either set works, but there should be one set. I'd take the draft's sizes and DESIGN.md's names (`--font-title`, `--font-row`…), and update DESIGN.md in step 1 as the draft says (its 11 px label becomes 12 px).
4. **Weight 650 can go.** The rows' values and the icon switch use 650. With the system font, Segoe UI and Roboto draw it as 600 or 700 anyway, so the draft's three weights lose nothing.

## Ideas

**A. One context, many sizes (density by values).** The desktop card (`card-float`) has 39 rules on the cards branch that make each control a step smaller. If the controls read their sizes from values, the desktop card sets about six of them once, and every control follows:

```css
.card-float { --row-h: 36px; --font-title: 15px; --font-number: 17px; --font-row: 14px; --target: 36px; }
```

The same works for the phone's peek, 200 % zoom and the glance size of phase 23. The mock-up's **Density** switch shows it: one card at both densities, with the same rules.

**B. One focus ring for everything.** One rule with no weight (`:where(button, a, input, select, [tabindex]):focus-visible { outline: 2px solid var(--focus); outline-offset: 2px }`) gives every control the same ring. A control in a list sets an inset one (`outline-offset: -2px`), as `row` does. That replaces about 23 copies of the same outline and closes the gap in point 2.

**C. Outdoor contrast.** Phones in bright sun turn up the screen and ask for more contrast. With `@media (prefers-contrast: more)`, cards turn solid, with no frosted glass, `--muted` moves closer to `--text`, and lines double in weight. It costs a dozen lines and changes nothing for anyone else. Later, a **High contrast** switch in Settings could turn on the same values for people who don't set it on their phone. That's a new control, so it goes to the user first. The mock-up's **Contrast** switch shows it.

**D. A contrast sweep instead of pairs.** The draft checks the pairs each PR touches. A smoke check can instead walk every visible text element in a scene, compute its colour against its background (through translucent cards to the solid colour behind), and list anything under 4.5:1. It needs no list to keep up to date, and it would have caught #370. It runs in the scenes `tools/shoot.py` already sets up, in both themes.

**E. DESIGN.md can't drift.** A smoke check reads `:root` and the dark block from `css/app.css`, and fails when a colour in DESIGN.md's frontmatter differs. Then DESIGN.md stays true without anyone remembering it.

**F. Shapes say the group, not only colour.** The draft's markers already pair each group with a shape: a triangle, an eye, a dashed "?". I'd keep the shape on every warning surface: the box, Check's badge and the toast as well as the map. A colour-blind person in sun glare then never has to tell red from amber.

## The design skills' review (2026-10-22)

The mock-up and the ideas went through Emil Kowalski's skills: design engineering, Apple design, native feel on a phone, and breaking a UI with worst-case data. The Proposed version shows what's marked *mock-up*.

**Motion and touch (emil-design-eng, apple-design):**
- **A press answers at once.** Buttons, chips, tiles and switches scale to 0.97 in 120 ms on `--ease-out` while pressed. A row keeps its grey background instead, because a full-width row that shrinks looks broken. With reduced motion, the scale stops. *Mock-up.*
- **Closing is quicker than opening.** The sheet opens in 260 ms and closes in 180 ms. The draft's timing values get a `--t-close` to match (the layer drawer already does 160 in and 120 out). *Mock-up.*
- **Every curve is one of the two values.** A row's › moves on the built-in `ease-out`; it should use `--ease-out`. *Mock-up.*
- **Hover needs a mouse.** The shared hover rule uses `(hover: hover) and (pointer: fine)` rather than `(hover: hover)` alone, which some Android phones and styluses claim.

**Reading outdoors (apple-design):**
- **Grey text on frosted glass loses contrast** over busy aerial photos. That's idea C. Outdoor contrast also gives cards a clear 1 px border, as Apple does for more contrast.
- **Reduced transparency works only on the layer drawer today.** It should make every frosted surface solid: the top bar, the map buttons, the sheet and the cards.
- **Idea G: sizes in `rem`, not `px`.** Then a browser's own text-size setting enlarges Polku's text and the space around it together. Today every size is in px, so that setting does nothing. It costs nothing to do with step 1, since the values are new anyway.

**On a phone (mobile-native):**
- **The tap flash is turned off in five places.** It belongs once on `html`, with `touch-action: manipulation` and `user-select: none` on every control. That finishes #208.
- **Pinch-zoom is blocked** (`user-scalable=no`, #73). That makes the 200 % checks matter more: people who need large text get it only from the browser's text size, never by pinching.
- **The status bar's colour is one green for both themes** (`theme-color` in `index.html`). The map fills the top of the screen, so the green is a choice, not a mismatch. Worth a look when dark mode is on.

**The worst case (break-ui), at 320 px and at 200 % (195 px), light and dark, in Finnish:**

| What broke | Where | Fix |
|---|---|---|
| A long point name runs 38 px past the card's edge | The cards branch at 34e5a02, checked in the app at 195 × 422: `.way-hint b` breaks only between words, inside a grid | `overflow-wrap: anywhere`, as the rows already have. *Mock-up.* |
| A row with a value squeezes its name to 47 px ("Sport from here" over three lines; in Finnish, one letter per line) | Same, checked in the app | Below 220 px, the value goes under the name and the › hides. *Mock-up.* |
| The main action's label can't wrap ("Muodosta kolme kiertoreittiä" runs out of the button) | `.btn` and `.btn.big` have a fixed height, on `main` too | A least height (`min-height`) instead, so the label wraps. Phase 18's translations need it. *Mock-up.* |

What held up: the numbers stack one to a row, the icon switch becomes a column, rows and warning boxes wrap, and nothing scrolls sideways at 320 px.

## What the first pass left out: the planner, dragging, and the route on the map

The draft and the first version of these notes covered the controls in DEVELOPING's table. Polku also has controls of the planner's own, things you drag, and a route line that glows and moves. They're part of the same look and get the same treatment: one style for each job, values instead of numbers typed in place, a dark version, and a check at 200 %. Read on the cards branch at 34e5a02.

### The planner's own controls

- **Grips and handles: five looks for one job.** The sheet's handle (`sheet-handle`, a 32 × 4 bar in a 72 × 18 target), the layer drawer's (`qd-grab`, 36 × 4), the desktop panel's and the timeline's edge (`sheet-resize`, `tl-grip`, 4 px wide) and a point's grip in the list (`wpl-grip`, an icon at 70 %). The bars are a grey typed in place (`rgba(95, 107, 101, .4)`, 1.8:1 on white) with no dark version, and the list's grip icon is 3.0:1 at its 70 %.
  - **Proposed:** one `grip` look and a `--grip` value with a dark version, at least 3:1, since it's the only sign that something can be dragged. It turns `--accent` while held. Its target is 44 px on phones; the list's grip is 28 px tall today.
- **Minimise (⌃), the ⋯ menus, Done, the tabs and the toolbox** (`tool`, `tbtn`, `modebtn`, `pl-tab`) come under the controls step like the rest. ⌃ is a `tool` with a `chevronUp` icon, and the sheet's handle also responds to a press. Every one of these gets the shared focus ring, press feedback and 36 / 44 px targets.

### Dragging

What Polku lets you drag today:

| What | How it shows | Without a drag |
|---|---|---|
| The planner's sheet and the layer drawer | Follows the finger, rubber-bands at its ends, settles with a spring from the finger's speed (`js/sheet.js`) | A press on the handle; Done |
| The desktop panel's and the timeline's width | `ew-resize` cursor; the edge turns green | Not yet: a gap |
| A point on the map | `grab` / `grabbing`; the route follows live | **Move** on its card |
| The middle of a leg (reshape) | A small handle that grows by 1.3 on hover | Add a point, then Move |
| A point in the list | The row lifts (`--shadow`), a 2 px green line shows where it lands | ↑ and ↓ buttons |
| The profile chart | A drag zooms into a stretch | — |
| A GPX or KML file | A drop hint over the page | **Import** |

- **Proposed: one set of drag states,** written once. *Can drag:* the grip and the `grab` cursor with a mouse. *Held:* the thing lifts with `--shadow`, follows 1:1, and turns off its transitions. *Where it lands:* a 2 px `--accent` line or ring. *Let go:* it settles on `--ease-out`, or with the sheet's spring when it carries speed.
- **Every drag keeps a way without dragging,** as the list's ↑/↓ and a point's **Move** do. Resizing the desktop panel and the timeline has none yet (keyboard arrows on the focused edge would do). That's WCAG 2.2's 2.5.7, so it's an issue of its own.
- **The springs are values too.** The sheet's (damping 0.85, response 0.3 s, a flick at 1.1 px/ms, rubber band 0.55) live in `SWIPE` in `js/sheet.js`. That's one place already; DESIGN.md records them beside the CSS curves, so a new drag uses the same feel.

### The route on the map

What draws the route today (`js/style.js`, `js/routeflow.js`, `css/app.css`):

- **The line:** a white casing (90 %) under a red line, 3 px at zoom 8 to 6.5 px at zoom 16. Over water it's blue, a straight-line leg is darker red and dashed (2.5 · 1.2), a leg being routed is grey and dotted (1 · 1.5), a carry is orange dots, and a point the route couldn't reach is a thin grey dashed line.
- **The glow (#198):** a soft halo in the route's colour at 30 %, and a brighter one at 55 % on the leg under the pointer, fading in 150 ms.
- **The moving chevrons:** white, at 90 %, 26 px apart, drifting 14 px a second (one spacing every 2 s), drawn at no more than 24 frames a second. They run only while the route is in view, the page is visible and the map is flat. They rest 45 s after the last touch, and with reduced motion they don't move at all; static arrows show the way instead.
- **Also on the line:** **Colour by** (grade, surface and the rest), the other ways for a leg with their labels, the round trip's loops, distance marks, the hover dot, and wind and uphill arrows.
- **The points:** a white disc with a black ring and its number; the start green with ▶, the end black. While one is open on a card, it's ringed in `--accent-bg` and white.

**Where it holds up:** the chevrons are the one thing that moves on the map, and they already respect reduced motion, a hidden page and the battery. The glow fades rather than jumps. Leave both as they are.

**Proposed:**
- **Every colour and size above becomes a value,** read by `js/style.js` from the CSS (step 3 of the draft). Today about 20 of them are typed into `style.js`, `planner.js` and `app.css` separately (`#e11d48` alone eight times), so dark mode, the night map and outdoor contrast can't reach them.
- **One rule for the map's motion:** the chevrons are the only thing that moves without being touched. Anything else animates once, in answer to something you did (a hover, a pulse when a point is chosen), and never loops.
- **The chevrons must show on every leg.** White at 90 % measures 4.0:1 on the red line and 5.1:1 on the blue water leg. On **Colour by**'s light colours it fades: 2.1:1 on the pale green of an easy grade and 1.5:1 on the yellow one. A thin dark edge on each chevron, or chevrons that take the line's own darkest shade under light colours, keeps them visible. To check on the terrain map, aerial photos and the night map, as the draft's part 4 says.
- **The glow stays below the warnings.** 25d part 3 puts warning markers on the route. The glow under the pointer must not wash them out, so the markers sit above the glow, with their white disc.
- **The points join the values too:** their black and white become `--wp-ink` and `--wp-paper` (the same in both themes, since they sit on the map), and the start's green becomes `--good`. The handles in the middle of a leg take the leg's colour from the same values as the line.

## Order

The draft's order holds: values first, then the controls one PR each, then the JavaScript's colours, then the route on the map. With these notes:

1. **#370 first,** as a Fix PR. It's a bug and doesn't wait for the plan.
2. **Step 1 (the values)** takes ideas A and B's values (`--focus`, the context values), G's `rem`, `--t-close`, and E's check.
3. **Idea D** comes with step 1 too, so every later PR runs it.
4. **Idea C** comes after the controls, as its own small PR.

## For the user to decide

- Whether ideas A–F join the draft's plan, each or all.
- Whether the type steps use DESIGN.md's names or the draft's (point 3).
- Whether a **High contrast** switch in Settings is worth an issue (idea C).
- Whether the draft itself goes into `docs/plans/` (it's still only in the other session), with these notes folded into it.
