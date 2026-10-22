# Design system: notes on the draft, and ideas

A second look at the design-system draft of 2026-10-22, written in another session and not committed. It checks the draft against the code, measures what the draft measured, and adds ideas. The mock-up [mockups/design-system.html](mockups/design-system.html) shows today's tokens as [DESIGN.md](../../DESIGN.md) records them and, behind a switch, the proposal.

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

## Order

The draft's order holds: values first, then the controls one PR each, then the JavaScript's colours, then the route on the map. With these notes:

1. **#370 first,** as a Fix PR. It's a bug and doesn't wait for the plan.
2. **Step 1 (the values)** takes ideas A and B's values (`--focus`, the context values) and E's check.
3. **Idea D** comes with step 1 too, so every later PR runs it.
4. **Idea C** comes after the controls, as its own small PR.

## For the user to decide

- Whether ideas A–F join the draft's plan, each or all.
- Whether the type steps use DESIGN.md's names or the draft's (point 3).
- Whether a **High contrast** switch in Settings is worth an issue (idea C).
- Whether the draft itself goes into `docs/plans/` (it's still only in the other session), with these notes folded into it.
