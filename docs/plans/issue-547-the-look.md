# The look: a review and a direction (#547)

The first review of Polku's look as a whole. Phase 24 ([its review](../reviews/2026-10-17-design/README.md)) looked at usability and structure, and #382 made the look consistent without changing it. This one asks whether the look itself is right: the materials, the depth, the colours, the type's weights and spacing, the 18 base values on `:root`, and how they sit with the map's own colours. What's still to do, and its status, is on GitHub, in #547.

- **Status (2026-10-28): stop 1, the review and the direction, waiting for the user's two answers** ([What's for you to decide](#whats-for-you-to-decide)). Nothing is built: `DESIGN.md` and `css/app.css` are as they are on `main`.
- **Stop 2, after the answers:** a mock-up at `docs/plans/mockups/issue-547-the-look.html` with options only for the values the chosen direction changes ([Stop 2](#stop-2-the-mock-up)).
- **From:** `main` at 18b43d4, looked at on 2026-10-27 and 2026-10-28 at 390 × 844 and 1440 × 900, light and dark, over the terrain map (Maastokartta), aerial photos (Aerial FI) and the night map, with the Kauppi route, the planner, a point's card and Layers open; Impeccable's critique ([how it ran](#how-the-critique-ran)); the apple-design skill's §12 (materials and depth) in full, §15 (weight, tracking and leading) and §16 (craft and delight); the measurements below.
- **Out of scope:** the typeface (#181), the motion curves (#249), the difficulty scale's colours (#382, the user's choice 4), layout and structure. What the review found outside the look is filed as issues ([below](#filed-apart)).

## What's for you to decide

### 1. What Polku should feel like

What PRODUCT.md already says about the look:
- "Polku's own look, not a generic one: the map first, plain words" (Brand Commitments);
- "Polku should look and feel thoughtfully designed and polished, and accessibility or depth never excuses less" (Brand Commitments);
- "legible in bright sun, usable while moving, with wet or cold hands and at a glance" (Accessibility & Inclusion);
- people "trust it on real trips" (Product Purpose).

It names the qualities, not the character: what the surfaces are made of, how much of the map comes through, what temperature the colours have. Three ways to fill that in:

| | Polku feels like… | From PRODUCT.md | What it would change |
|---|---|---|---|
| **A** | **A field instrument:** sure, sharp and readable in the sun, like a good compass. What you read sits on a near-solid surface, the map shows through what you only glance past, and each colour means one thing. | "trust it on real trips"; "legible in bright sun… at a glance" | Two materials, a thin glass for the small controls and a near-solid one for reading; edges in dark mode; one meaning per colour on the map |
| **B** | **Clear water over the land:** light and open, the map showing through everything that floats, the chrome stepping back. | "the map first"; DESIGN.md's "Nothing covers the map that the moment doesn't need" | A light glass everywhere, the planner and cards too; a darker grey and heavier weight for words on glass; outdoor contrast and reduced transparency become essential |
| **C** | **A paper map in its case:** calm and warm, the chrome made of the map's own material: warm paper surfaces, colours from the map's world, the dashed path as its one motif. | "Polku's own look, not a generic one"; "a pleasure to use" | New neutrals with the map's warmth, a new accent and signal palette, Polku's own shapes; the glass much as today |

**Recommended: A.** The hardest moment PRODUCT.md names, a phone in bright sun read at a glance, decides, and it's what both design reviews asked for (two materials, reading surfaces near-solid, edges in dark); C's warmer neutrals can be one of Stop 2's options within it.

### 2. Refine the current look, or replace it

Impeccable's question. **Refine** keeps the identity (the map first, quiet neutral chrome, one green action, the route in red, plain words, DESIGN.md's rules) and changes values within it. **Replace** treats today's look as evidence only, picks a new visual world and rewrites DESIGN.md.

**Recommended: refine.** The identity is right and written down, and almost every finding below is a value on `:root` or a material that was never chosen; a replacement would also undo #382's controls, approved on 2026-10-23, for no gain to people on the trail.

**What Stop 2 would show with A and refine:** two materials (two or three values each, today's beside them); depth A or B; a route red apart from the map's other reds, or today's; the signal colours chosen for Polku, or today's; a bright edge and a lifted dark surface; `--line` and `--surface-2` that hold in the sun; whether the night map pulls the interface dark. With B instead: a light glass on every surface and a glass-only grey for words. With C: the neutrals, the accent and the shapes too.

## The findings, ranked

Ranked by how much they cost people outdoors, how often they show, and how sure the evidence is. Each says where it comes from: the apple-design skill (§12, §15, §16), a measurement, or the design reviews.

1. **One material and one shadow for everything, and no rule for which surface is which** (§12: material weights, bigger reads thicker; both reviews' first issue). The top bar, a 40 px map button, the planner's sheet and Layers all compute to white at 94 % with a 10–14 px blur and the same `--shadow`. At 94 % only 6 % of the map comes through: the glass's own lightness stays between L\* 96 and 100 over every base map, so it reads as flat white slabs (near-black ones in dark), and a blur of 10 or 14 px changes the words' contrast by under 0.05. The blur can't be seen, yet it's still drawn every frame while the map pans (its cost isn't measured yet). Meanwhile a point's card, the menus and the popups are solid, and DESIGN.md says sheets are solid while the planner's sheet is glass. `--shadow-sheet`, `--shadow-dialog` and `--shadow-marker` are defined and used nowhere; 38 shadows are typed in place. Surfaces also stack: the weather box over the planner's sheet on a phone (a white card on a white sheet, the "Your speed" row clipped under it), Layers over the timeline, Settings over the sheet; §12 says never to stack one translucent surface on another (the weather box's place is #377 and #431).
2. **In dark mode the chrome has no edges over the night map** (§12: the bright edge; both reviews). The dark surface `#181c1a` against the night map's `#161a1f` is 1.02:1, against its forest 1.1:1. The floats have no border and a black shadow can't show on near-black, so the map buttons and the sheet dissolve and only their icons float. Over the bright terrain map the same black shadow smudges grey around the pills. Neither theme has a bright edge anywhere.
3. **The interface's tone ignores the map.** The map's style has its own idea of dark (`dark: () => isAerial(state.base) || state.base === 'night'`, `js/main.js:456`); the interface follows the device. A light interface over the night map is a white glare beside a black map (the paddler at dusk); a dark one over Maastokartta punches dark holes in a bright map. The neutrals are a cool green-grey (hue 162°) while the trail map's paper and words are warm (94° and 78°) and the night map blue-grey (264°), which shows at every edge. MapLibre's scale bar stays light in dark mode.
4. **Red is the route's and five other things'** (DESIGN.md's Map Holds the Colour Rule; both reviews). The route's `#e11d48` is ΔE 9.2 from the `#dc2626` the map uses for military areas, avoided places, incidents, closed winter ways, LIPAS's hiking routes and its campfire pins, which sit right beside the line at the same lightness (1.03:1); 8.8 from difficulty S3, on by default for MTB; and it runs over Maastokartta's red roads. Apart, on a phone in the sun, they're one red, and only the white edge says which is yours. Danger shares the hue too: the pink Read before you go box is the most saturated thing in the peek, and Check's badge is solid red.
5. **Words on the glass are checked over the wrong background, and pass by a hair** ([Text over the glass](#text-over-the-glass)). The contrast sweep measures them over the page's own grey-green, never the map. Over real maps `--muted` is 4.62–4.68:1 at worst, against 4.5; at 80 % white it would fall to 3.65 (night) and 3.76 (aerial). The safeguards aren't there yet: reduced transparency turns only the layer drawer solid (`css/app.css:681`), and nothing answers `prefers-contrast: more` (#382's §7, not built). §12: no flat grey on glass; heavier, higher-contrast words instead.
6. **Lines and fills vanish in the sun, and the shapes don't agree** (§12: scroll edge effects; §16, craft). `--line` is 1.26:1 on white (1.38:1 in dark) and `--surface-2` 1.1:1, yet they carry the grouping: 45 dividers and outlines, rows divided in one group and not the next, no fade where a list meets a floating header. 14 corner sizes: `--radius` (14 px) is written 5 times while 12 px is typed 25 times, with 9, 16 and 18 px beside them; the top bar is pills and circles, the map's buttons 16 px rounded squares, the mark a rounded square in a circle.
7. **Colours nobody chose, and green does too many jobs.** Every signal colour is a Tailwind step: `--good`, `--ok`, `--warn`, `--bad` and `--route` are the 600s, the `-text` set the 700s and 800s, the dark ones the 400s. `--good`, `--ok` and `--accent-2` aren't used at all, `--warn` once; where those hex values show, they're typed in the JavaScript and the map's style among colours that must not follow them (the fairway marks' red and green, ship types). The start of a route is green three ways (`#16a34a` on its marker and the profile, `#2e9e5b` in the cards' route mark at `js/cards.js:263`, the accent for selection). On the home screen three solid greens compete (the mark, the sport pill, **Plan**), and green values such as "Balanced" and "Normal" read like links. What is chosen works: the green-grey neutrals, the forest accent with its dark-mode split (`--accent-bg`), and the green-tinted shadow.
8. **The type set is loose** (§15). The CSS uses weights 400, 500, 600, 650, 700, 750 and 800 (and "MTB" in Layers renders at 900); 18 sizes typed in px (9 to 22, half sizes too) beside the nine values; 11 line heights that don't follow size; tracking only on titles and small headings; tiles' second lines at 11 px and 1.2; the 12.5 px labels under the route's numbers at 400. Words on glass get no extra weight (§12).

**What works, and stays whichever way you choose:** the map first, with nothing over it that the moment doesn't need; the route's white edge, red core and glow, which read first on every base map; the dashed-path mark; chosen states never by colour alone (a tint, a 2 px border, a tick); complete dark versions with care where it mattered (#239); dim versus separate already right (Layers and Settings keep the map live, dialogs dim it); words at 4.5:1 on every solid surface since #382; numbers in tabular figures.

### Filed apart

Found by this review but outside its values; each is a small fix of its own:
- #551: the search field's hint is the browser's grey (`#757575`), 3.7:1 on the dark glass;
- #553: the word **Layers** over its map picture is 2.1–2.4:1 at worst on the light pictures;
- #554: on the aerial maps, peaks' names and heights and lakes' names are dark words on a dark halo;
- #552 (watch): Maastokartta's names and symbols look blown up at trail zooms in headless Chrome, worst on phones.

## How the critique ran

Impeccable's critique, its two assessments as two separate agents that didn't see each other's work, run twice: once on 2026-10-27 by the session that started #547, and once on 2026-10-28 for this review, with the same brief (the whole look, all 18 values, §12, §15, §16; phone and desktop, light and dark, the terrain map, aerial photos and the night map).
- **The design reviews** agreed on the first four findings and on refining. Their verdicts: "partly authored, materially generic" and "authored content in a borrowed skin": the route, the mark, the live thumbnails and Check's shapes are Polku's own, while the chrome (a white pill with one soft shadow, settings-style rows) could belong to any map app. Nielsen's heuristics for the look: 22 of 32 and 15 of 24 (both Acceptable; the n/a ones differ). Both felt it calm but anonymous; one named what it should be: calm, sure-footed confidence, like a good paper map in its case.
- **The detector** (`impeccable detect --json index.html js`): 52 findings, 48 of them the map's data colours typed in `js/config.js`, `js/main.js` and `js/safety.js` (false positives for the look, apart from `js/cards.js:263`); three 10 px words (Weather, Layers, Plan, the touch PR's under #382); the Layers word's contrast (#553). In the browser it ran 14 scans; the base map changes nothing for it, since it reads the CSS's colours, not the map's pixels.
- **Limits:** the browser pane was hidden, so the map sometimes drew late and the desktop views were seen at about half scale; on 2026-10-27 the detector's report reached its session before the design review finished. Not seen: a real phone, the sun, Safari, 200 % zoom.

## The 18 base values

Every value the first commit wrote on `:root` (2026-10-12), unchanged since. "Uses" counts `var(--name)` in `css/app.css` on `main` at 18b43d4, plus reads in the JavaScript.

| Value | Light · dark | Uses | What the review found |
|---|---|---|---|
| `--accent` | `#1f6f4a` · `#3fb07a` | 78 | Polku's own, not a Tailwind step. White on it is 6.1:1. Apart from the map's park green (ΔE 14.6). Shares its job with two other greens (finding 7) |
| `--accent-2` | `#2f8f62` · `#56c48f` | 0 | Not used; DESIGN.md calls it hover |
| `--accent-soft` | `#e3f1e9` · green at 16 % | 18 | The chosen chip's and row's tint |
| `--route` | `#e11d48` · same | 3, and the map | Tailwind's rose-600. ΔE 9.2 from the map's `#dc2626` reds and 1.03:1 from them in lightness; 8.8 from difficulty S3 (finding 4) |
| `--surface` | white at 94 % · `rgba(24, 28, 26, .94)` | 13 | The glass: 10 rules blur it by 10, 12 or 14 px, with no `saturate()`; 3 use it without a blur. The dark one is 1.02:1 against the night map (findings 1 and 2) |
| `--surface-solid` | `#fff` · `#181c1a` | 55 | A point's card, menus, popups, the map's keys, inputs. DESIGN.md says sheets too; the planner's sheet is glass |
| `--surface-2` | `#f3f4f1` · `#232825` | 38 | Hover and recessed areas; 1.1:1 on white, gone in the sun (finding 6) |
| `--text` | `#1c2420` · `#e8ece9` | 81 | A cool green-black (hue 162°); the map's own words are a warm brown-black (`#2c2721`, hue 78°). 9.8–15:1 over the glass on every map |
| `--muted` | `#5f6b65` · `#9aa69f` | 130 | The most used value. 5.6:1 on white, 4.62–4.68:1 at worst over the glass (finding 5) |
| `--line` | `--text` at 12 % | 70 | 1.26:1 on white, 1.38:1 in dark; 45 of its uses are dividers and outlines (finding 6) |
| `--shadow` | two layers, green-tinted; black in dark | 36 | One shadow for a 40 px button and a 356 px panel; black at 0.5 can't show on the night map. 38 more typed in place; `--shadow-sheet`, `--shadow-dialog` and `--shadow-marker` unused (finding 1) |
| `--radius` | 14 px | 5 | 12 px is typed 25 times; 14 corner sizes in all (finding 6) |
| `--chart-ink` | `#26312c` · `#e8ece9` | read by `js/chart.js` | The profile's words and lines |
| `--chart-grid` | muted at 18 % | read by `js/chart.js` | The profile's grid |
| `--good` | `#16a34a` | 0 | Tailwind's green-600. Not used as a value; the hex is typed for the start's marker (`css/app.css:1187`) and the profile (`js/chart.js:538`) |
| `--ok` | `#ca8a04` | 0 | Tailwind's yellow-600. Not used; 2.9:1 on white, under 3:1 for an icon |
| `--warn` | `#ea580c` | 1 | Tailwind's orange-600: the Heads-up rows' icon. The hex is typed for carries on the map and in the map's key |
| `--bad` | `#dc2626` · `#f87171` | 10 | Tailwind's red-600: the words of Remove, Delete and Avoid. The hex is typed for military areas, avoided places, incidents and closed winter ways |

`--accent-bg` (`#1f6f4a` · `#237a52`) came with #239; the `-text` colours, the warning colours and the scales came with #382.

## Text over the glass

**`tools/smoke.py`'s contrast sweep never sees the map behind the glass.** `tools/census.py` composites a see-through background down to the first solid one, and that's the page's own colour (`--page`, `#dfe6e0`, on `body`), never the map. So every word on a frosted surface is measured against 94 % white over pale grey-green. It has passed because 94 % lets almost nothing through; a lighter glass would pass the sweep and fail outdoors.

**Measured over the map, two ways, on `main` at 18b43d4:**
- **In the app as it draws:** headless Chrome (its software renderer does draw `backdrop-filter`: the same view with and without it differs), the Kauppi route on each base map, light and dark, phone and desktop, plus a bright, busy aerial picture of Tampere's centre. Every word whose background isn't solid is made transparent, the screen is captured, and the word's colour is compared with every pixel under its own glyph boxes (clipped by whatever scrolls it, and only where nothing lies over it). 604 words.
- **A model, for what-ifs:** the same map pictures blurred in a canvas, the glass's colour laid over each pixel, and the contrast taken against every pixel under the surface, 40 px from its edges left out (by the session that started #547, 2026-10-27).

**Today, the lowest contrast anywhere under the words** (in the app):

| | Trail map | Maastokartta | Aerial FI, forest | Aerial FI, Tampere | Night |
|---|---|---|---|---|---|
| `--muted`, light | 5.08 | 4.65 | 4.66 | 5.00 | 4.68 |
| `--muted`, dark | 4.62 | 4.86 | 4.90 | 6.22 | 5.34 |
| `--text`, light | 15.0 | 14.3 | 13.9 | 14.6 | 13.9 |
| `--text`, dark | 9.8 | 10.3 | 10.1 | 13.1 | 11.3 |

The lowest are the zoom hint (`.zoom-hint`, the glass's colour with no blur) on Maastokartta and the aerial, the planner over the night map, and the grey line in a danger box in dark. Nothing fails today; there's 0.1–0.2 to spare.

**What a lighter glass would do** (the model, `--muted`, the worst map): at 80 % white, 3.65 (night) and 3.76 (aerial), failing; at 80 % dark, 3.66 (Maastokartta) and 3.77 (the trail map). So a glass much lighter than today's needs, with it, a darker grey or a heavier weight for words on glass, the check over the map in `tools/smoke.py`, and #382's reduced transparency and outdoor contrast.

## Stop 2: the mock-up

After the answers, a clickable mock-up at `docs/plans/mockups/issue-547-the-look.html`, with options only for the values the chosen direction changes, each beside today's. What it keeps from the first brief (2026-10-27):

- **Real map pictures** from the running app: the terrain map, aerial photos (a bright, busy one and a dark forest) and the night map, in light and dark, with the route drawn over them so its colour can be switched. The pictures go on `pr-screenshots` under `claude/547-the-look/`, never in `main`.
- **Today's look beside each proposal,** on the surfaces that carry it: a small map control and the top bar; the planner, a card and the drawer.
- **Depth A or B,** for the user to choose, with no recommendation: A keeps the One Float Rule (one `--shadow`); B lets bigger surfaces read thicker (a stronger blur, a deeper shadow), which rewrites the One Float Rule and DESIGN.md's "Don't add a heavier shadow".
- **The difficulty scale's colours unchanged** (#382, the user's choice 4).
- **Measured, not guessed:**
  - `--text` and `--muted` over each proposed glass, per pixel under each word, on the worst map for each theme (dark forest and the night map for light glass, a bright aerial for dark glass), with any under 4.5:1 marked;
  - the blur's cost while the map pans, on this Mac's GPU in a visible browser (there's no phone to test on), with a small pan test in the mock-up to run on a phone;
  - reduced transparency: #382's map and scales PR, which turns every frosted surface solid (its §7), hasn't landed: `prefers-reduced-transparency` is only on the layer drawer (`.qd`, `css/app.css:681`), no PR or claim exists for that row, and it's planned after 25d's journeys. A lighter glass needs it first or in the same PR; the plan will recommend which;
  - Safari before 18: `-webkit-backdrop-filter` is only on `pl-tools`, so every other frosted surface shows no blur there. The build writes both properties wherever the glass is.
- **The build after the mock-up** changes `DESIGN.md` and `css/app.css` together, and comes after #543 (the desktop toolbar), which changes `pl-tools`.
