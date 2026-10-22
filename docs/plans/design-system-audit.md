# Design system: the app as it is

An audit of the running app, not of its CSS. It's the evidence the design-system plan works from, and the baseline its PRs measure against. [design-system-notes.md](design-system-notes.md) holds the proposals.

- **When and what (2026-10-22):** the cards branch `claude/25d-1-card` at 34e5a02 (#352), the latest work, which includes everything on `main`.
- **How:**
  - **Used by hand** in the browser pane at 375 × 812 and 1440 × 900: the top bar, the sport menu, Settings, the layer drawer, the planner and its tabs, the ⋯ menu, a point on the water.
  - **Measured:** 62 scenes of `tools/shoot.py`, on phones and desktops, light and dark, at 200 % and in Finnish where the scene has them. In each scene, [`tools/census.py`](../../tools/census.py) records every visible text's size, weight and contrast against what's really behind it, every control's size, and the corners, shadows and timings in use. Run it again with `POLKU_URL=… python3 tools/census.py OUT scene …`, then `python3 tools/census.py --sum OUT`.
  - **Not covered:** the map's own drawing (phase 20), offline save, GPX export's dialogs, and real phones.

## Bugs found and filed

| | What | Issue |
|---|---|---|
| Live on polku.si | The sport menu ends with the word "null" for every sport but Paddle | #374 |
| Phones at 200 % | The search box shrinks to 4 px and the top bar runs over the timeline | #375 |
| Both themes | Seven kinds of text below 4.5:1: Check's count, difficulty badges, wind pills, Plan in dark, the layer drawer's tiles in dark | #376 |
| Dark mode | Red text 3.6:1: Remove, Delete, red pills | #370 |
| Phones | The weather timeline covers the planner's tabs when the planner is open | #377 |
| Phones at 200 % | A long point name runs off the card; a row's name squeezed to 47 px | on #352 |
| Phase 18 risk | A button's label can't wrap | #373 |
| Phones | 112 controls under 44 px, 148 texts under 12 px (the numbers are on the issue) | #235 |

## What's typed in place, measured

What the screen actually shows across the 62 scenes, not what the CSS declares:

| | Distinct values | The most used |
|---|---|---|
| Text sizes | **17**: 10, 10.4, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16, 16.5, 17, 18, 19, 20, 22 px | 12 px (728), 11 px (513), 13 px (270) |
| Weights | **6**: 400, 500, 600, 650, 700, 900 | 600, 400, 700 |
| Text colours | 14, of which 6 aren't tokens: `rgba(0,0,0,.75)`, `#333`, `#000`, `#111`, the attribution's | `--muted`, `--text` |
| Corners | **19** | 10, 12 and 999 px |
| Shadows | **22** | `--shadow` (614), then 21 others |
| Timings | **6**, five on `ease`, one on `--ease-out` | 0.2 s ease |
| Fonts | The system font; MapLibre's controls and popups are in Helvetica Neue, 900 weight in places | |

Inter shows in these numbers only because the test Mac has it (#266); people see their system font.

## Screen by screen

### The top bar and the map's buttons
- **Two Plan buttons on a desktop:** a red pill in the search bar and a red square at the bottom right. While planning both turn into red outlines. A phone has only the second.
- **Plan is the one red control.** Red otherwise means the route and danger, and every other main action is green (`btn primary`, the sport pill, Make 3 loops). Plan in dark mode is 3.67:1 (#376).
- **The map buttons are white rounded squares of two widths:** 48 px for icons only (compass, locate, 3D) and 56 px with a word (Weather, Layers, Plan). Their words are 10 px on phones and 11 on desktops.
- **The logo, search, sport pill and Settings are four shapes in one row:** a rounded square in a circle, a pill, a green pill and a circle.
- **Focus rings:** the LIPAS card's ✕ and the full Layers panel's ‹ show the browser's own blue ring. Polku's is green elsewhere.

### Menus and panels
- **The sport menu:** a pale green row and a tick for the chosen sport, black icons, an uppercase heading. "null" at the end (#374).
- **The ⋯ menu:** uppercase group headings, two-line items, black icons; the ⋯ button turns pale green while open. Consistent with the sport menu.
- **Settings:** the speeds' icons are **green**, while the sport menu's are black. The decision of 2026-10-21 was black icons in lists.
- **The layer drawer:** a chosen layer is a tile with a 2 px green border, a pale green fill and a tick badge at its top left. An unchosen one is grey; **More** is white, a third look.
- **The full Layers panel:** the same base maps again, but smaller, with the tick at the top right. **On now** is a row of green chips with ✕. Two views of one choice, each with its own layout.
- **The question about a point on the water** ("How do you get there?") is a **dark bubble with outlined white pill buttons**, a look found nowhere else in the app.

### The planner
- **Where it starts:** the sport row and four `way-tile`s with green icons. Consistent with the 25d cards.
- **The head:** **Follow paths** (a grey box with a chevron), ↶ ↷, ⋯, the numbers, **Done** as an outlined `btn`. On a desktop, a toolbar of icon-only tools without words (fit, reverse, loop, link, export, delete), with a tooltip each.
- **The tabs:** a green underline for the chosen one. Check's count is white on orange (3.56:1, #376).
- **Section heads:** uppercase 11 px titles, a count, a ⌄ to fold, 37 px tall on phones.
- **The waypoint list:**
  - a grip, then the point's mark, name and line, and up to five 28 px tools (leg settings, stop, ⌃, ⌄, remove);
  - **remove is red on a pink fill for a via and black for the start and finish;**
  - ⌃ ⌄ are faint grey, and paler again when they can't be used;
  - **Depart** is a small native dropdown in the start's row, and a large field on Go: one setting, two looks.
- **"Tap to change" has four looks:**
  - dotted-underlined words (Speed, Style, "from now", "from 11:00");
  - the Route style button with its small label;
  - native dropdowns (Colour by, Depart);
  - rows with ›.
- **Choosing one of a few has three looks in one section:**
  - Route style's chips turn **black** when chosen;
  - the switches under them (Terrain, Technical trails, Climbs) turn **white**;
  - the round trip's length chips turn **pale green with a 2 px border and a tick**.
- **Check:**
  - Heads-up rows carry an orange triangle, a red outlined **Avoid** and ⋯;
  - difficulty is a green badge (3.25:1);
  - on the water, **On the route** is a list of cards inside the sheet, with a card inside a card;
  - "Selected" and "Use colours" are 10 px.
- **Go:** a table of times with 10.4 px notes, a **Change** button and a yellow **Breezy** pill (2.53:1).

### Cards on the map
- **A point's card (25d):** consistent within itself. On a desktop its actions are outlined buttons two to a row, with **Remove** in red outline on a row of its own.
- **The LIPAS and trail cards are MapLibre popups,** with a different ✕, the browser's blue focus ring, green links with ↗, and Helvetica Neue in places. **Follow this route** is a green `btn primary`, the rest outlined. The LIPAS card's surface reads "Maa/luonnonmukainen,Kivituhka,Sora": the list has no spaces after its commas.

### The timeline
- **A floating card** with chips (Wind, Temperature, Rain, Snow, 26 px on phones), a chart, ▶ and a slider. On phones it covers the planner's tabs (#377).

### The route on the map
- **As in the notes' "The route on the map":** the red line with a white casing and its glow, blue over water, dashed dark red for a straight line, grey dots while routing, and the moving chevrons.
- **With Colour by Wind,** red arrows along a red-and-blue line. Red here means headwind, next to red meaning the route and danger.
- **Distance marks** are black text with a white halo, and the waypoints are black and white discs.

## What holds up

- **One shadow** (`--shadow`) carries nearly everything that floats: 614 of about 860 uses, and its dark version 93 more.
- **Light and dark come from the same variables** wherever a colour is a variable.
- **The sport menu, the ⋯ menu, the start's tiles and 25d's cards already share one look:** two-line rows, black icons, a pale green row for the chosen one. That's the base for "one of each".
- **Nothing scrolls sideways** at 360 or 390 px. The sheet's swipe, the chevrons and the glow respect reduced motion.

## What changes in the plan because of this

The draft and the notes hold, with these additions:

1. **Chosen states: one look.** Today there are seven. The proposal: a pale green fill and a tick for rows, tiles and chips; white with a green icon for switches; a green underline only for tabs. Black chips go.
2. **"Tap to change": one look,** a row with its value and ›, or the Route style button where space is short. Dotted underlines and native dropdowns go. A native dropdown stays only where the platform's picker helps, such as a time.
3. **One remove,** red, the same in every row.
4. **One card,** for the point's card, the LIPAS and trail popups, and Check's **On the route** blocks: Polku's own ✕ and focus ring, and no cards inside cards.
5. **One bubble:** the water question becomes a card like the rest.
6. **One main action colour,** green. Plan's red is a decision for the user: it marks the route, but it's the only red button.
7. **The map buttons' words at 12 px,** and one width for the column.
8. **Wind's red on the route** gets a colour that doesn't read as danger, with the route's colour scales in step 3.
