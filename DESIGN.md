---
name: Polku
description: An outdoor map and route planner for Finland, the map first and plain words.
colors:
  accent: "#1f6f4a"
  accent-2: "#2f8f62"
  accent-soft: "#e3f1e9"
  accent-bg: "#1f6f4a"
  route: "#e11d48"
  route-water: "#0369a1"
  you: "#1a73e8"
  surface: "rgba(255, 255, 255, 0.94)"
  surface-solid: "#ffffff"
  surface-2: "#f3f4f1"
  text: "#1c2420"
  muted: "#5f6b65"
  line: "rgba(28, 36, 32, 0.12)"
  page: "#dfe6e0"
  good: "#16a34a"
  ok: "#ca8a04"
  warn: "#ea580c"
  bad: "#dc2626"
  dark-accent: "#3fb07a"
  dark-accent-2: "#56c48f"
  dark-accent-bg: "#237a52"
  dark-you: "#4c9bff"
  dark-surface: "rgba(24, 28, 26, 0.94)"
  dark-surface-solid: "#181c1a"
  dark-surface-2: "#232825"
  dark-text: "#e8ece9"
  dark-muted: "#9aa69f"
  dark-line: "rgba(232, 236, 233, 0.12)"
typography:
  numeral:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  title:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  heading:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 700
  row:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 650
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  control:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  small:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 600
  label:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  xs: "6px"
  sm: "10px"
  md: "12px"
  card: "14px"
  sheet: "20px"
  pill: "999px"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  edge: "12px"
  target: "44px"
---

# Design System: Polku

## Overview

**Creative North Star: "The Map Comes First"**

The map fills the screen and always has the stage. Everything else floats over it on frosted cards: the top bar, the map's buttons, the planner, the layer drawer, the cards that open from the map. On a phone the planner becomes a sheet from the bottom, on a desktop a panel at the side. Nothing covers the map that the moment doesn't need, and what's covered can always be brought back in one step.

The components are calm and sure-footed. Surfaces are quiet and nearly neutral, a cool green-grey, so the map's colours and the red route line carry the colour. There is one clear main action at a time, in forest green. Targets are at least 44 px where a finger uses them, and words say what happens ("Make 3 loops", "Back to start") rather than leaning on icons alone. The look is built to be legible outdoors: in bright sun, with one thumb, at a glance.

This file holds the tokens: colours, type, shapes, spacing, depth and motion. **The controls themselves are listed in [docs/DEVELOPING.md, "Shared controls"](docs/DEVELOPING.md#shared-controls)**, which is the one list of them; a new screen reuses those for the same jobs. The values here come from `css/app.css`, which stays the source: when the two differ, the CSS is right and this file is out of date.

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
- **Accent-bg (forest green)**: the background behind white text and icons, such as the main action (`btn primary`), the sport pill and pressed buttons. Light mode uses the accent itself; dark mode a darker green, because white on the lighter dark-mode accent is only 2.7:1, and on this one 5.3:1 (#239).
- **Accent-2 (lighter green)** and **Accent-soft (pale green tint)**: hover and the soft fill behind a chosen item.

### Secondary
- **Route (red)**: the route line on the map, its glow, and the Plan button. It is the one strong colour on the screen and is kept for the route.
- **Route over water (deep blue)**: water legs of a route are drawn blue instead of red, with the same glow, and the map's key says so ("Over water").
- **Colour by** in the planner can recolour the route line on the map (with its **On map** switch) by grade, uphill difficulty, surface, kind of way, trail width, wind, temperature or rain. Those scales are the profile's and live in `js/planner.js` and `js/chart.js`; with any of them the plain red is replaced along the whole line.
- **You (blue)**: the location dot and its accuracy circle (`--you-soft`). Blue is kept for "where you are" and for water.

### Tertiary
- **Good (green), Ok (amber), Warn (orange), Bad (red)**: states and warnings, such as Heads-up rows, difficulty and conditions. Never the only way something is said: each comes with words or an icon.

### Neutral
- **Surface (white, 94 %)**: the frosted cards over the map, with a background blur. With reduced transparency asked for, cards use **Surface-solid**.
- **Surface-solid (white)**: sheets, menus, inputs and buttons that need an opaque background.
- **Surface-2 (pale grey-green)**: hover on rows and buttons, and recessed areas.
- **Text (near-black green)** and **Muted (grey-green)**: body text and secondary text, such as hints, units and section labels.
- **Line (text at 12 %)**: borders and dividers.
- **Page (pale grey-green)**: the page behind the map, seen only before the map draws.
- The map's own colours (land, water, parks, labels) are in `js/style.js`, one palette per map style. The sports' own line colours are `SPORT_COLORS` in `js/config.js`.

### Named Rules
**The Map Holds the Colour Rule.** Interface surfaces stay neutral. Red belongs to the route, blue to water and to where you are; the accent marks what's chosen or the one main action, nothing decorative.

**The Never by Colour Alone Rule.** Every colour that means something (a warning, a difficulty, a chosen state) is also said in words, a tick, an icon or a shape (PRODUCT.md, WCAG 2.2 AA).

## Typography

**Body Font:** the system's interface font (`system-ui`, San Francisco on Apple devices, Segoe UI on Windows, Roboto on Android). Inter is named first in the stack but is not loaded, so it shows only where it's installed.

**Character:** one familiar sans-serif in a few weights, compact on a desktop and readable on a phone; bold carries the hierarchy, not size jumps.

### Hierarchy
- **Numeral** (700, 22 px, line-height 1, tabular figures): the big numbers, such as the time in the timeline and the round trip's length.
- **Title** (700, 17 px): a step's title, such as the route's name and "Round trip from your start", and the main action's words (`btn primary big`).
- **Heading** (700, 16 px): a panel's or drawer's heading.
- **Row** (650, 15 px): the words of a row you tap, such as Back, a way to begin or a sport.
- **Body** (400, 14 px, line-height 1.4): the page's base size.
- **Control** (600, 13 px): button labels on a desktop.
- **Small** (600, 12 px): hints, values and lists; the most used size in the panels.
- **Label** (700, 11 px, letter-spacing 0.04–0.08em, uppercase): section labels in muted text, such as a layer group or a search result group.

### Named Rules
**The Tabular Numbers Rule.** Numbers that change or line up (times, distances, the timeline) use tabular figures, so they don't jump as they update.

**The Room for Finnish Rule.** Names, headings and labels wrap rather than run out of their box (`overflow-wrap: anywhere`), because Finnish and Swedish are coming (phase 18) and their words are long.

## Layout

The map is fixed behind everything (`#map`, inset 0). Over it:
- **The top bar** sits 12 px from the top and left edges, up to 730 px wide.
- **The map's buttons** stand at the right edge.
- **The planner** is a side panel on a desktop and a sheet from the bottom on a phone, with a peek, a middle and a full height. The layer drawer is a card beside the Layers button on a desktop, a sheet on a phone.

The switch is at **720 px**: up to 720 px wide is the phone layout, 721 px and up the desktop one; there's a wider step at 900 px, and short screens (under 500 px or 760 px high) get a more compact sheet. Touch is decided by the pointer, not the width: `pointer: coarse` grows targets to 44 px, and hover styles apply only where `hover: hover`.

Spacing is a tight 2–4–6–8–12 px rhythm: 6 and 8 px between items in a row, 10 to 14 px of padding inside cards, 12 px from the screen's edges. Rows are 44 px high where they're tapped (48 px for the larger ones), 32 to 40 px for buttons with a mouse.

## Elevation & Depth

Depth comes from floating over the map: cards and sheets are translucent with a background blur of 10 to 14 px and one soft shadow, and the map moves under them. There's one shadow token for everything that floats; nothing stacks shadows to make a hierarchy.

### Shadow Vocabulary
- **Float** (`--shadow`: `0 6px 24px rgba(16, 24, 20, 0.16), 0 1px 3px rgba(16, 24, 20, 0.12)`; darker in dark mode): every card, sheet, menu and map button over the map.
- **Sheet edge** (`0 -6px 28px rgba(16, 24, 20, .2)`): the phone's bottom sheet, casting upwards.
- **Ring** (`inset 0 0 0 2px` in the accent or the route colour): a chosen or open state, added to the float shadow.

### Named Rules
**The One Float Rule.** Everything over the map uses the same `--shadow`. A chosen state adds a ring, never a bigger shadow.

**The Clear Glass Rule.** When the person asks for reduced transparency, frosted cards turn solid (`--surface-solid`, no blur).

## Shapes

Gently rounded, never sharp. Cards and panels have 14 px corners (`--radius`); buttons and rows 10 to 12 px; small things such as swatches and inputs 6 px. Pills (999 px) are for chips, the sport pill and switches; round (50 %) for icon-only map buttons and dots. The phone's sheet has 20 px corners at the top only. Borders are a single 1 px line in `--line`, used sparingly.

## Components

The controls, with their classes and where each comes from, are in **[docs/DEVELOPING.md, "Shared controls"](docs/DEVELOPING.md#shared-controls)**. That table is the one list: this file doesn't repeat it. A new screen uses those controls for the same jobs, a mock-up copies their CSS from `css/app.css`, and a new control is proposed to the user first and then joins that table.

What every control shares:
- **Focus:** a 2 px outline in the accent, 2 px out (the route colour on route controls).
- **Hover:** `--surface-2` behind, only on devices that hover.
- **Pressed or chosen:** the accent, plus a tick or `aria-pressed`, never colour alone.
- **Motion:** short and quiet. Hover and press take 120 to 150 ms; the drawer and sheets slide in 180 to 260 ms on an ease that settles (`--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`, `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`). With reduced motion asked for, they fade in place instead of sliding, and pulses stop.

## Do's and Don'ts

### Do:
- **Do** use the CSS variables (`var(--accent)`, `var(--surface)`, `var(--shadow)`), never their hex values, so dark mode follows.
- **Do** keep targets at least 44 px for touch, and say every meaning in words as well as colour.
- **Do** put white text on `--accent-bg`, not on `--accent` (#239).
- **Do** reuse a control from DEVELOPING's "Shared controls" for a job it already does.

### Don't:
- **Don't** use red for anything but the route and danger, or blue for anything but water and where you are.
- **Don't** add a second shadow, a heavier shadow or a new radius to make something stand out; use the ring, the accent or the words.
- **Don't** make a copy of an existing control under a new class name.
- **Don't** cover the map with anything the moment doesn't need.
