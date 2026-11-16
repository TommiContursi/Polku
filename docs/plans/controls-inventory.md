# Main's controls today: an inventory

Part of #382's design round, 2026-11-16, on `main` as this branch has it (025a76f's app code). It lists every control
style `css/app.css` draws, so the coming component sheet can map each one onto a few sizes instead of one-off styles.
It decides nothing: which style replaces which waits for the user's choice between the two kinds of key in Mine 5
(`docs/plans/mockups/design-system-grouped.html`, Buttons: Raised keys or Main's, improved).

`T` is `var(--target)`: 36 px with a mouse, 44 px by touch (app.css:92). Every control below presses with `scale(.97)` in
120 ms (app.css:166) and shows focus as a 2 px `--focus` ring (app.css:159) unless its row says otherwise. Not covered:
dark and high-contrast overrides, Layers' `.lg-*` controls and the menus' padding.

## What it adds up to

- **Heights:** 26, 28, 30, 32, 34, 36, T, 38, 40, 44, 50, 52, 56–60, 64 and 68 px.
- **Radii:** 6, 8, 9, 10, 11, 12, 14, 15, 16, 22, 999 and 50 %.
- **Font sizes on controls:** 11, 12, 12.5, 13, 13.5, 14, 14.5, 15 and 17 px. The tokens (`--font-small` 12, `--font-control`
  13, `--font-body` 14, `--font-row` 15, `--font-field` 16, `--font-title` 17, `--font-number` 19, `--font-numeral` 22,
  `--font-glance` 34) cover 52 rules; the rest are raw px (12 px ×56, 13 ×36, 11 ×24, 12.5 ×21, 14 ×17, 13.5 ×16…).
- **Weights:** 600 ×60, 700 ×40, 650 ×10, 500 ×7, 800 ×4, 400 ×4; the tokens `--weight-name` 600, `--weight-strong` 700,
  `--weight-regular` 400.
- **Family:** `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`, 14 px / 1.4 (app.css:152).
- **Chosen state:** five looks for one job: chips green tint with a 2 px green edge; segments white with a shadow; rows
  green tint; tiles a green edge; `.btn[aria-pressed]` filled green; `.wpl-foot .btn[aria-pressed]` filled black.

## One job, several styles

| Job | Styles today |
|---|---|
| Pick one (chip) | `.chip` 28, `.way-chips`/`.rt-chips .chip` 40 (44 by touch), `.rt-start .chip` 44, `.tl-layers .chip` 36, `.act-chip` 36, `.menu-chips .menu-item.chip` 36, `.cam-tabs` 28; fonts 12–14.5. `.on-chip` (26, filled, no edge) is a sixth. |
| Text button | `.btn` 32, `.btn.done` 34/40/44, Save `.btn.primary` 44 at 15 px, `.btn.big` 52, `.card-float .btn` 36. `.btn.small` has no rule of its own. |
| Quiet text button | `.btn.quiet`, `.btn.small.quiet`, `.btn.danger-text`, `.link`, `.way-back` (44, 15 px), `.wpl-all`. |
| A value with ▾ | `.mode-select select` 30 pill, `.stylebtn` 40 r10, `.sportbtn` 40, `.modebtn` 44 filled, `.rt-pill` T r22, `.row.when-row`. |
| Icon-only | `.tool` 34 (30×32 narrow, 28 small, 32 in the list's tools, 44 in a card by touch), `.tbtn` 44/40, `.ctrl-btn` 40, `.top-btn` 40 round, `.qd-x` 44. |
| A card's action | `.card .btn`, `.rows.acts.btns > .row` (T, r10), `.card-float .rows.acts > .row` (36, 13.5 px), `.card-acts button` (a 44 px disc and a word). |
| Switch between a few | `.seg` (T), `.seg.icons` (aria-checked, 48+), `.tg` (36×21 track), `.qd-opts .seg.full button` (44). |
| Text field | `.name-field` (44, 2 px green edge), `.speed-field input` (34), `.off-field input` (36, grey), `.rt-len input` (in a box). |

## By kind

### Text buttons (`.btn`, app.css:710)

| Style | Rule | Height | Font | Edge, radius, face | States | Used |
|---|---|---|---|---|---|---|
| `.btn` | 710 | min 32 | 13 / 600 | 1 px `--line`, 10, `--surface-solid` | hover `--surface-2`; pressed green fill (2335) | ~14 |
| `.btn.primary` | 716 | 32 | 13 / 600 | `--accent-bg`, 10, white words | as `.btn` | ~4 |
| `.btn.primary` in the name and When menus | 2025 | 44 | 15 / 600 | as above | | ~2 |
| `.btn.primary.big` | 1185 | min 52 | 17 / 600 | 14 | disabled .55 | ~4 |
| `.btn.quiet` | 1132 | 32 | 13 / 600 | none, 10 | hover | ~5 |
| `.way-back`, `.wpl-all`, `.tier-all` | 1134, 1646 | 44 | 15 / 650, green | none | hover | ~6 |
| `.btn.danger` / `.btn.danger-text` | 719 / 717 | 32 | 13 / 600 | red words | | 1 + 1 |
| `.btn.done` | 977, 2676 | 34; toolbar 40, phone 44 | 13 / 600 | 1 px, 10 | disabled .7 | 2 |

Context overrides: `.card-float .btn` 36, `.card .btn` 44 by touch, `.mr-state .btn` 40/44, `.off-area .btn` 30,
`.offline-banner .btn` 28, `.pick-unmapped .btn` T, `.wpl-top .btn` T, `.btn.wx-map` T, `.lit-status .btn` T.

### Icon-only buttons

| Style | Rule | Size | Look | States |
|---|---|---|---|---|
| `.tool` | 720 | 34 (30×32 under 480 px; 30 in 3D; 32 in the list's tools; 44 in a card by touch) | no edge, r10 | hover `--surface-2`; disabled .35 |
| `.tool.small`, `.tl-close`, `.tl-more` | 1612, 415 | 28 | as `.tool` | |
| `.sheet-top-start/end > .tool`, `.pl-way .way-x`, `.qd-x`, `.qd-back` | 882, 1128, 747 | 44 | r12 | |
| `.rt-len .tool` (− and +) | 1176 | T | r11, green | |
| `.ctrl-btn` (map) | 327 | 40 | r12, glass | hover; 3D pressed green |
| `.top-btn` | 349 | 40 round | glass | pressed `--accent-bg` |
| `.fab`, `.plan-btn` | 361, 382 | 60×56, r16, an 11 px word under the icon | | pressed `--accent-bg` |
| `.tbtn` (toolbar) | 2624, 2660 | 44; desktop 40 | r12, no face | `aria-expanded` green tint |
| `.card-acts button` | 1870 | 68, a 44 px disc | r12; main action green disc | |
| `.wx-hs-arrow` | 1542 | 32 round | glass, shadow | |

### Rows that act

| Style | Rule | Height | Font | Edge, radius | States |
|---|---|---|---|---|---|
| `.row` | 1887 | `--row-h` 50 (36 in a desktop card; 44 in the list by touch) | 15 / 600, line 13 | none, 12 | hover and press `--surface-2`; chosen green tint |
| `.card .rows.acts.btns > .row` | 1866 | T | the row's | 1 px `--line`, 10, white | Remove: 1.5 px red, centred |
| `.card-float .rows.acts > .row` | 2159 | 36 | 13.5 | 1 px, 10, white | hover (mouse only) |
| `.menu-item` | 1250 | 36; 44 by touch | 13 | 8 | hover; disabled .4; chosen green tint |
| `.act` (sports menu) | 264 | 40 | 600 | 10 | |
| `.way-tile` | 1136 | 64 | | 1 px, 14 | hover green tint |
| `.sec2-head`, `.wx-tell`, `.wx-lane`, `.fold-go`, `.kf-b` | 1627, 1444, 1464, 910, 936 | T, T, T, 64, 32 (44 by touch) | | none, 10 | |

### Switches between a few

| Style | Rule | Height | Font | Look | Chosen |
|---|---|---|---|---|---|
| `.seg button` | 690 | T | 13 / 600, grey | track `--surface-2` r12, button r9 | `--seg-on` white, shadow, green icon |
| `.seg.small` | 695 | T | 12 | | |
| `.seg.icons` | 1937 | T; 48 under 480 px; 54 stacked | 14 / 650 | button r12, track r15 | aria-checked, white, green icon |
| `.rt-unit`, `.pt-menu .seg` | 1167, 2285 | T | 14, 13 | | |

### Chips

| Style | Rule | Height | Font | Look |
|---|---|---|---|---|
| `.chip` | 703 | 28 | 12 / 600 grey | 1 px `--line`, pill, no face; chosen green tint, 2 px green edge (708) |
| `.way-chips .chip`, `.rt-chips .chip` | 1152 | 40; 44 by touch | 14 | as `.chip` |
| `.rt-start .chip` | 1183 | 44 | 14.5 | |
| `.tl-layers .chip` | 426 | 36 | 13 | |
| `.act-chip` | 290 | 36; 44 by touch | 13.5 | |
| `.menu-chips .menu-item.chip` | 2737 | 36; 44 by touch | 13 | |
| `.on-chip` | 632 | 26 | 12, green words | green tint, no edge |

No chip has a hover state.

### Switches, values, facts, tabs

| Style | Rule | Size | Look |
|---|---|---|---|
| `.tg-ui` | 667 | 36×21, knob 17 | off: `--line` with a 1.5 px `--muted` ring; on: `--accent-bg` |
| `.mode-select select` | 1268 | 30 | 13 / 600, 1 px, pill, white |
| `.rt-pill` (When) | 412 | T | 14 / 600, 1 px, r22, white |
| `.kf-b` | 936 | 32; 44 by touch | 14, no edge, r10; a warning tinted with a 1.5 px edge |
| `.pl-tab` | 1049 | 38 | 13.5 / 600, a 2 px green underline |
| `.modebtn` | 2631 | 44 | 14 / 700, grey face, r12 |
| `.stylebtn`, `.sportbtn` | 2669, 2673 | 40 | 13.5 / 650, 1 px, r10, white |
| `.search-plan`, `.act-current` | 391, 237 | 30, 40 | green pill |
| `.link` | 728 | text | 12 / 600, green |

### Fields

| Style | Rule | Height | Look |
|---|---|---|---|
| `.name-field` | 2023 | 44 | 17 / 600, 2 px green edge, r12; focus a 3 px green-tint ring |
| `.rt-len input` | 1177 | T | 22 / 700 in a 1 px box, r12 |
| `.speed-field input` | 1341 | 34 | 15 / 700, 1 px, r9 |
| `.off-field input` | 2528 | 36 | 1 px, r10, grey face |
| `.search input` | 210 | the bar | 15, a 2 px green ring on focus |
| `input[type=range]` | 506, 2325 | native, 44 by touch | `accent-color: --accent` |

## The toolbar, and its new version

Every button on the drawing toolbar (`buildTools()` in `js/planner.js`, app.css:2624–2683). An idea from testing,
2026-11-16: none needs designing anew, but each gets its new version from the component sheet, and the toolbar's icons
become square icon keys. Mine 7 draws them on its screens and in Components (a phone's and a desktop's, with a mouse and
by touch).

| Button | Main now | New version (Components) |
|---|---|---|
| Done | `.btn.done`: 40 on a desktop, 44 on a phone; 13 / 600; 1 px `--line`, r10 | An action |
| Edit (the route's view) | `.btn.done.edit`, a pencil and its word | An action with its icon, as Done |
| How the next leg is drawn, phone | `.modebtn`: 44, a grey face, r12; a green icon, its name 14 / 700, the style under it 12 | A value to pick, on two lines, a grey ▾ |
| How the next leg is drawn, desktop | `.modepick`: 40, 1 px, r10, 13.5 / 650; a green icon, a grey ▾ | A value to pick |
| The next leg's sport, desktop | `.sportbtn`: 40, 1 px, r10, 13.5 / 650 | A value to pick |
| Route style, desktop | `.stylebtn`: 40, 1 px, r10, on two lines (13.5 and 11) | A value to pick, on two lines |
| Undo, Redo | `.tbtn.tb-hist`: 44 on a phone, 40 on a desktop; no face, r12; greyed when there's nothing to undo | An icon key: square, with its face and edge |
| Reverse, Back to start, Share link, Export GPX, Save offline… | `.tbtn`, shown where there's room, else in More | Icon keys, as Undo |
| Clear route | `.tbtn.danger` | An icon key, its icon red |
| More | `.tbtn`, `aria-haspopup="menu"` | An icon key with ⋯ |
| Between groups | `.tb-sep`: 1 × 28 px, `--line` | Kept |
| A menu open | `[aria-expanded="true"]`: a green tint | Open question: green is kept for what's chosen; an open menu may take the grey of a pressed key instead |

Sizes, decided 2026-11-16: by touch as the sheet draws them; with a mouse, one size smaller, as main's `--target` is
(36 with a mouse, 44 by touch).

| Size | By touch | With a mouse |
|---|---|---|
| XS | 28 | 24 |
| S | 32 | 28 |
| M | 40 | 32 |
| L | 44 | 36 |
| XL | 52 | 44 |

L and M with a mouse are as decided; XS, S and XL with a mouse follow on from them in Mine 7 and wait for the user's OK.
By touch every control's target is 44 px, however small it draws. The words stay the same size with a mouse.
