---
name: Polku
description: An outdoor map and route planner for Finland, the map first and plain words.
colors:
  accent: "#1f6f4a"
  accent-2: "#2f8f62"
  accent-soft: "#e3f1e9"
  accent-bg: "#1f6f4a"
  focus: "#1f6f4a"
  route: "#e11d48"
  route-water: "#0369a1"
  route-line: "#be123c"
  route-loading: "#9ca3af"
  you: "#1a73e8"
  you-soft: "rgba(26, 115, 232, 0.12)"
  surface: "rgba(255, 255, 255, 0.94)"
  surface-solid: "#ffffff"
  surface-2: "#f3f4f1"
  text: "#1c2420"
  muted: "#5f6b65"
  line: "rgba(28, 36, 32, 0.12)"
  grip: "rgba(95, 107, 101, 0.8)"
  page: "#dfe6e0"
  chart-ink: "#26312c"
  chart-grid: "rgba(95, 107, 101, 0.18)"
  good: "#16a34a"
  ok: "#ca8a04"
  warn: "#ea580c"
  bad: "#dc2626"
  good-text: "#166534"
  ok-text: "#854d0e"
  warn-text: "#9a3412"
  bad-text: "#b91c1c"
  danger: "#b4232a"
  danger-soft: "#fbe9e9"
  look: "#8a5a00"
  look-soft: "#fbf4e2"
  unk: "#47607a"
  unk-soft: "#eaf0f6"
  dark-accent: "#3fb07a"
  dark-accent-2: "#56c48f"
  dark-accent-soft: "rgba(63, 176, 122, 0.16)"
  dark-accent-bg: "#237a52"
  dark-focus: "#6fd3a2"
  dark-you: "#4c9bff"
  dark-you-soft: "rgba(76, 155, 255, 0.16)"
  dark-surface: "rgba(24, 28, 26, 0.94)"
  dark-surface-solid: "#181c1a"
  dark-surface-2: "#232825"
  dark-text: "#e8ece9"
  dark-muted: "#9aa69f"
  dark-line: "rgba(232, 236, 233, 0.12)"
  dark-grip: "rgba(232, 236, 233, 0.45)"
  dark-chart-ink: "#e8ece9"
  dark-chart-grid: "rgba(154, 166, 159, 0.18)"
  dark-bad: "#f87171"
  dark-good-text: "#4ade80"
  dark-ok-text: "#facc15"
  dark-warn-text: "#fb923c"
  dark-bad-text: "#f87171"
  dark-danger: "#ff8a8a"
  dark-danger-soft: "rgba(255, 138, 138, 0.14)"
  dark-look: "#f2c45a"
  dark-look-soft: "rgba(242, 196, 90, 0.12)"
  dark-unk: "#9cc0e4"
  dark-unk-soft: "rgba(156, 192, 228, 0.13)"
typography:
  glance:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  numeral:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  number:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 700
    fontFeature: "tnum"
  title:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    letterSpacing: "-0.01em"
  field:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  row:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
  control:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
  small:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
rounded:
  small: "6px"
  control: "10px"
  card: "14px"
  sheet: "20px"
  pill: "999px"
  round: "50%"
spacing:
  space-2: "2px"
  space-4: "4px"
  space-6: "6px"
  space-8: "8px"
  space-10: "10px"
  space-12: "12px"
  space-16: "16px"
  space-24: "24px"
  target: "36px"
  target-touch: "44px"
  row-h: "50px"
  mark: "34px"
---

# Design System: Polku

## Overview

**Creative North Star: "The Map Comes First"**

The map fills the screen and always has the stage. Everything else floats over it on frosted cards: the top bar, the map's buttons, the planner, the layer drawer, the cards that open from the map. On a phone the planner becomes a sheet from the bottom, on a desktop a panel at the side. Nothing covers the map that the moment doesn't need, and what's covered can always be brought back in one step.

The components are calm and sure-footed. Surfaces are quiet and nearly neutral, a cool green-grey, so the map's colours and the red route line carry the colour. There is one clear main action at a time, in forest green. Targets are at least 44 px where a finger uses them, and words say what happens ("Make 3 loops", "Back to start") rather than leaning on icons alone. The look is built to be legible outdoors: in bright sun, with one thumb, at a glance.

This file holds the tokens: colours, type, shapes, spacing, depth and motion. **The controls themselves are listed in [docs/DEVELOPING.md, "Shared controls"](docs/DEVELOPING.md#shared-controls)**, which is the one list of them; a new screen reuses those for the same jobs. The values here are the ones on `:root` in `css/app.css`, named by what they're for, which stays the source: when the two differ, the CSS is right and this file is out of date. `python3 tools/smoke.py values` fails when a colour in the frontmatter isn't the CSS's, in either theme. **Where a rule below isn't yet true everywhere, it says so.** [The design-system plan](docs/plans/design-system.md) (#382) is how it becomes true; until then, a new screen follows the rule, not the exception.

**Key Characteristics:**
- The map first; controls on translucent cards over it.
- Quiet neutral surfaces, one green accent, the route in red.
- One main action per step, in words.
- 44 px targets for touch, numbers in tabular figures.
- Light and dark from the same tokens, following the person's setting.

## Colors

A quiet, cool green-grey interface with one forest-green accent, so that the map and the route line hold the colour. The names below are the CSS variables in `css/app.css` (`--accent`, `--route`…); dark mode redefines the same variables, listed in the frontmatter with a `dark-` prefix.

### Primary
- **Accent (forest green)**: links, the chosen tab and switch, ticks, focus rings and the active state of map buttons. In dark mode a lighter green, so it still reads on dark surfaces.
- **Focus (green)**: the focus ring's own value, the accent's green in light mode and a lighter one in dark. Today the controls still draw their ring in the accent; the controls PR moves them onto it (#385).
- **Accent-bg (forest green)**: the background behind white text and icons, such as the main action (`btn primary`), the sport pill and pressed buttons. Light mode uses the accent itself; dark mode a darker green, because white on the lighter dark-mode accent is only 2.7:1, and on this one 5.3:1 (#239).
- **Accent-2 (lighter green)** and **Accent-soft (pale green tint)**: hover and the soft fill behind a chosen item.

### Secondary
- **Route (red)**: the route line on the map, its glow, and the Plan button. It is the one strong colour on the screen and is kept for the route.
- **The route's legs**: over water deep blue (`--route-water`), with the same glow, and the map's key says so ("Over water"); a straight line darker red and dashed (`--route-line`); a leg being routed grey and dotted (`--route-loading`). They sit on the map, so they're the same in both themes.
- **Colour by** in the planner can recolour the route line on the map (with its **On map** switch) by grade, uphill difficulty, surface, kind of way, trail width, wind, temperature or rain; with any of them the plain red is replaced along the whole line. Each scale's colours are values too (`--diff-s0` … `--diff-s6`, `--grade-…`, `--surf-…`, `--sport-…`, `--way-…`, `--trail-width-…`, `--trail-vis-…`, `--temp-…`, `--rain-…`, `--wind-…`), while its words and order stay in its table in `js/config.js`, `js/chart.js` or `js/weather.js`. The weather map's own colours are still in `js/wxmap.js`. How the scales read, for colour blindness too, is in the design-system plan's §2.
- **In the JavaScript**, the route's colours, the warning colours and the scales come from the CSS: `fromCss()` in `js/palette.js` reads them at start and again when the theme changes, and the map and the planner draw with them again.
- **You (blue)**: the location dot and its accuracy circle (`--you-soft`). Blue is kept for "where you are" and for water.

### Tertiary
- **Good (green), Ok (amber), Warn (orange), Bad (red)**: states and warnings, such as Heads-up rows, difficulty and conditions, as lines, bars, dots and icons. Never the only way something is said: each comes with words or an icon. In dark mode Bad is a lighter red, so red words such as Remove and Delete read at 6.2:1 (#370).
- **Good-text, Ok-text, Warn-text, Bad-text**: the same four for words and pills, at least 6.2:1 in both themes. Today the pills still use the plain four (#376); the controls PR moves them.
- **Danger (red), Look (amber), Unk (blue-grey)**, each with a soft version for the box behind it: Check's three groups (25d), Read before you go, Worth a look and Not checked. Each has its shape too: a triangle, an eye, a dashed "?". At least 5.4:1 on its box and on the page, in both themes. 25d's Journey C is the first to use them.

### Neutral
- **Surface (white, 94 %)**: the frosted cards over the map, with a background blur. With reduced transparency asked for, cards use **Surface-solid**.
- **Surface-solid (white)**: sheets, menus, inputs and buttons that need an opaque background.
- **Surface-2 (pale grey-green)**: hover on rows and buttons, and recessed areas.
- **Text (near-black green)** and **Muted (grey-green)**: body text and secondary text, such as hints, units and section labels.
- **Line (text at 12 %)**: borders and dividers.
- **Grip (grey)**: every grip and handle, at least 3:1 on its surface. Today the grips are still a paler grey (#382's controls and touch PRs).
- **Page (pale grey-green)**: the page behind the map, seen only before the map draws.
- **Chart ink and chart grid**: the profile's words and lines, drawn on its canvas.
- The map's own colours (land, water, parks, labels) are in `js/style.js`, one palette per map style. The sports' own line colours are `--sport-…` (`SPORT_COLORS` in `js/config.js`).

### Named Rules
**The Map Holds the Colour Rule.** Interface surfaces stay neutral. Red belongs to the route, blue to water and to where you are; the accent marks what's chosen or the one main action, nothing decorative. Today two things break it, both decided on 2026-10-22 (#382): the **Plan** button is red, and turns green in the controls PR; **Colour by**'s wind scale draws headwinds in red, and goes orange to blue in the map and scales PR.

**The Never by Colour Alone Rule.** Every colour that means something (a warning, a difficulty, a chosen state) is also said in words, a tick, an icon or a shape (PRODUCT.md, WCAG 2.2 AA).

## Typography

**Body Font:** the system's interface font (`system-ui`, San Francisco on Apple devices, Segoe UI on Windows, Roboto on Android). Inter is named first in the stack but is not loaded, so it shows only where it's installed.

**Character:** one familiar sans-serif in a few weights, compact on a desktop and readable on a phone; bold carries the hierarchy, not size jumps.

### Hierarchy

These are the nine sizes, values on `:root` named by what they're for (`--font-glance` … `--font-small`). They're in `rem`, so the browser's text size enlarges them. A control takes its value when it's next touched (the design-system plan's §3), so today most rules still type their size in px: 18 sizes between 9 and 22 px, half sizes included (11.5, 12.5, 13.5, 14.5, 16.5).

- **Glance** (700, 34 px, `--font-glance`, tabular figures): a number read while moving, in `--text` on `--surface-solid`, never on frosted glass. Phase 23 is the first to use it.
- **Numeral** (700, 22 px, `--font-numeral`, line-height 1, tabular figures): the big numbers, such as the time in the timeline and the round trip's length.
- **Number** (700, 19 px, `--font-number`, tabular figures): a card's numbers.
- **Title** (700, 17 px, `--font-title`): a step's title, such as the route's name and "Round trip from your start", and the main action's words (`btn primary big`).
- **Field** (400, 16 px, `--font-field`): what you type, on phones, so iOS doesn't zoom the page. A panel's or drawer's heading is 16 px too today.
- **Row** (600, 15 px, `--font-row`): the words of a row you tap, such as Back, a way to begin or a sport. Some rows still use 650, which the system fonts draw as 600 or 700.
- **Body** (400, 14 px, `--font-body`, line-height 1.4): the page's base size.
- **Control** (600, 13 px, `--font-control`): button labels on a desktop, and a row's second line.
- **Small** (600, 12 px, `--font-small`): hints, values and lists; the most used size in the panels. Reading text is never smaller (the Small on Purpose Rule below); today some still is (#235).
- **Label** (700, 11 px, letter-spacing 0.04–0.08em, uppercase): section labels in muted text, such as a layer group or a search result group. The controls PR makes small headings 12 px capitals.

The weights are `--weight-regular` (400), `--weight-name` (600) and `--weight-strong` (700). On a desktop's card at the point (`.card-float`) the title, the numbers and the rows are one step smaller (15, 17 and 14 px), set once on the card.

### Named Rules
**The Tabular Numbers Rule.** Numbers that change or line up (times, distances, the timeline) use tabular figures, so they don't jump as they update.

**The Room for Finnish Rule.** Names, headings and labels wrap rather than run out of their box (`overflow-wrap: anywhere`), because Finnish and Swedish are coming (phase 18) and their words are long. Today a card's title still uses `break-word` and can run off at 200 % (#384).

**The Small on Purpose Rule.** Polku is a map, and some text is small so the map has the room: the scale bar, the credits, the map's own labels, chart axes, units beside a number, a word under an icon, a number inside a mark. Those may go down to 10 px. Text you read to decide or act (names, values, actions, warnings, a row's line) is 12 px or more. Small or not, text passes 4.5:1 and grows with the browser's text size.

## Layout

The map is fixed behind everything (`#map`, inset 0). Over it:
- **The top bar** sits 12 px from the top and left edges, up to 730 px wide.
- **The map's buttons** stand at the right edge.
- **The planner** is a side panel on a desktop and a sheet from the bottom on a phone, with a peek, a middle and a full height. The layer drawer is a card beside the Layers button on a desktop, a sheet on a phone.

The switch is at **720 px**: up to 720 px wide is the phone layout, 721 px and up the desktop one; there's a wider step at 900 px, and short screens (under 500 px or 760 px high) get a more compact sheet. Touch is decided by the pointer, not the width: `pointer: coarse` grows targets to 44 px, and hover styles apply only where `hover: hover`.

Spacing is a tight rhythm: 6 and 8 px between items in a row, 10 to 14 px of padding inside cards, 12 px from the screen's edges. Its values are 2, 4, 6, 8, 10, 12, 16 and 24 px (`--space-2` … `--space-24`), for new work and for a control when it moves onto the values. Targets are 44 px by touch at any width and 36 px with a mouse, 8 px apart (#380): `--target` is 36 px, and 44 px under `pointer: coarse`. A row is `--row-h` (50 px; 36 px on a desktop's card) and a card's mark `--mark` (34 px; 28 px). A target is the area that answers a tap, not the size it looks: a control can be small to look at, with its touch area grown around it. Today many controls are still smaller (#235).

## Elevation & Depth

Depth comes from floating over the map: cards and sheets are translucent with a background blur of 10 to 14 px and one soft shadow, and the map moves under them. One shadow token (`--shadow`) carries most of what floats; nothing stacks shadows to make a hierarchy. There are four shadow values; today about 38 other shadows are still typed in place in `css/app.css`, and they move onto the four when they're next touched (#382).

### Shadow Vocabulary
- **Marker** (`--shadow-marker`: `0 1px 4px rgba(0, 0, 0, 0.35)`, the same in both themes): a marker on the map.
- **Float** (`--shadow`: `0 6px 24px rgba(16, 24, 20, 0.16), 0 1px 3px rgba(16, 24, 20, 0.12)`; darker in dark mode): every card, sheet, menu and map button over the map.
- **Sheet edge** (`--shadow-sheet`: `0 -6px 28px rgba(16, 24, 20, 0.2)`; black at 0.5 in dark mode): the phone's bottom sheet and the panels' edge, casting upwards.
- **Dialog** (`--shadow-dialog`: `0 24px 60px rgba(0, 0, 0, 0.35)`, the same in both themes): a dialog over everything.
- **Ring** (`inset 0 0 0 2px` in the accent or the route colour): a chosen or open state, added to the float shadow.

### Named Rules
**The One Float Rule.** Everything over the map uses the same `--shadow`. A chosen state adds a ring, never a bigger shadow.

**The Clear Glass Rule.** When the person asks for reduced transparency, frosted cards turn solid (`--surface-solid`, no blur).

## Shapes

Gently rounded, never sharp. The corners are values: `--radius-small` (6 px) for small things such as swatches and inputs, `--radius-control` (10 px) for a control, `--radius` (14 px) for cards, panels and tiles, `--radius-sheet` (20 px) for the top of a phone's sheet, `--radius-pill` (999 px) for chips, the sport pill and switches, and `--radius-round` (50 %) for icon-only map buttons and dots. Today buttons and rows are still 10 to 12 px. The planner's sheet floats 8 px in from the screen's edges on a phone, with 18 px corners all round; the layer drawer's and the panels' sheets have 20 px corners at the top only. Borders are a single 1 px line in `--line`, used sparingly.

## Components

The controls, with their classes and where each comes from, are in **[docs/DEVELOPING.md, "Shared controls"](docs/DEVELOPING.md#shared-controls)**. That table is the one list: this file doesn't repeat it. A new screen uses those controls for the same jobs, a mock-up copies their CSS from `css/app.css`, and a new control is proposed to the user first and then joins that table.

What every control shares:
- **Focus:** a 2 px outline in the accent, 2 px out (the route colour on route controls), inside a row of a list. Today `btn`, `tool`, `chip`, `way-tile` and `way-back` still show the browser's own ring (#382), and the sport menu and ⋯ menus show none (#385).
- **Hover:** `--surface-2` behind, only with a mouse. Today 38 of 57 hover rules also apply on touch screens, where they stay after a tap (#208), and the hover looks vary (`--surface-2`, `--surface-solid`, `--accent-soft`, `--accent-bg`).
- **Pressed or chosen:** the accent, plus a tick or `aria-pressed`, never colour alone. Today "chosen" has several looks; #356 settles them on a green border for chips and white with a green icon for switches.
- **Motion:** short and quiet. The timings are values: `--t-press` (120 ms) for a press and hover, `--t-open` (180 ms) for cards and menus and `--t-sheet` (260 ms) for the sheet and the panel; closing takes the next shorter one. They ease out on `--ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`), and the sheet on `--ease-drawer` (`cubic-bezier(0.32, 0.72, 0, 1)`). Today hover and press take 120 to 150 ms in places, typed in place. With reduced motion asked for, they fade in place instead of sliding, and pulses stop.

## Do's and Don'ts

### Do:
- **Do** use the CSS variables (`var(--accent)`, `var(--surface)`, `var(--shadow)`), never their hex values, so dark mode follows. In the JavaScript, a colour that means something comes from the CSS through `fromCss()` in `js/palette.js`.
- **Do** keep targets at least 44 px for touch, and say every meaning in words as well as colour.
- **Do** put white text on `--accent-bg`, not on `--accent` (#239).
- **Do** reuse a control from DEVELOPING's "Shared controls" for a job it already does.

### Don't:
- **Don't** use red for anything but the route and danger, or blue for anything but water and where you are.
- **Don't** add a second shadow, a heavier shadow or a new radius to make something stand out; use the ring, the accent or the words.
- **Don't** make a copy of an existing control under a new class name.
- **Don't** cover the map with anything the moment doesn't need.
