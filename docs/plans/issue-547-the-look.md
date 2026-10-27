# The look: a review and three directions (#547)

The first review of Polku's look as a whole, and three directions for it, built side by side. Phase 24 ([its review](../reviews/2026-10-17-design/README.md)) looked at usability and structure, and #382 made the look consistent without changing it. This one asks whether the look itself is right: the materials, the depth, the colours, the type's weights and spacing, the 18 base values on `:root`, and how they sit with the map's own colours. What's still to do, and its status, is on GitHub, in #547.

- **Status (2026-10-28): Stop 2 is built, waiting for the user to choose from the mock-up** ([What's for you to decide](#whats-for-you-to-decide)). Nothing is built in the app: `DESIGN.md` and `css/app.css` are as they are on `main`.
- **The mock-up:** [mockups/issue-547-the-look.html](mockups/issue-547-the-look.html): today's look and directions A, B and C as complete versions, over real map pictures from the running app, with the contrast under every word measured in the page. Its switches: the direction, the map (Maastokartta, the bright one; aerial photos of the city beside the route, which are as mid-dark as the forest; aerial photos of forest and lake; the night map), light or dark, phone or desktop, the mode (default, more contrast, reduced transparency), the depth (one shadow, or thicker when bigger) and **Beside today**. The same scene in every version: the Kauppi route, the planner open with a point's card, and the map's buttons.
- **Decided by the user (2026-10-28):** refine, not replace, for all three directions; build all three before choosing, with B as the main candidate; bright sun and low vision belong to the modes (`prefers-contrast: more` and `prefers-reduced-transparency`, #382's §7), and the default look still meets 4.5:1 for words over the map and 3:1 for icons and edges; for B, the floor comes from darker words on the glass, not a thicker glass; "Match the map" stays out of #547 and goes with the theme setting (#323).
- **From:** `main` at 18b43d4, looked at on 2026-10-27 and 2026-10-28 at 390 × 844 and 1440 × 900, light and dark, over the terrain map, aerial photos and the night map; Impeccable's critique ([how it ran](#how-the-critique-ran)); the apple-design skill's §12 (materials and depth) in full, §15 (weight, tracking and leading) and §16 (craft and delight); the measurements below.
- **Out of scope:** the typeface (#181), the motion curves (#249), the difficulty scale's colours (#382, the user's choice 4), layout and structure. What the review found outside the look is filed as issues ([below](#filed-apart)).

## What's for you to decide

From the mock-up:

1. **The direction:** Today, A, B or C. **Recommended: B.** It's the only one that does what #547 set out to do, the map showing through what floats; its words and icons meet the floor on every map measured, and its costs are known and bounded ([below](#what-each-direction-costs)): three colours for words on glass, #382's two modes in the same PR, a pan test on a real phone before the build, and question 3.
2. **The depth:** one shadow for everything (DESIGN.md's One Float Rule, as today) or thicker when bigger (a small shadow on the map's buttons and the top bar, a deep one on the planner, the card and the drawer, as apple-design §12 asks). No recommendation, as asked. Thicker when bigger rewrites the One Float Rule and DESIGN.md's "Don't add… a heavier shadow".
3. **If B: its dark glass.** Two of the rules for B can't both hold in dark, so one has to give. Its words are near-white already, so over a bright map only the glass can keep them at 4.5:1.
   - **a. A darker dark glass (recommended):** a near-black 67 % (thin) and 73 % (thick), the least that kept every word at 4.5:1 over Maastokartta in the tints tried; still far lighter than today's 94 %. The floor holds; the dark glass is thicker than the light one (58 % and 68 %).
   - **b. The same lightness as in light (55 % and 64 %):** the glass rule holds, but over Maastokartta the top bar's words fall to 3.1:1, under the floor.

   Recommended **a**, because the floor is what keeps Polku readable at dusk; the darker tint and the saturation were tried too, and only the glass's opacity moves it.

The directions' parts can be mixed when you choose: B's glass with A's magenta route, say, or C's warm neutrals in A. The mock-up shows them as three wholes so each can be judged as a look.

The three directions, as PRODUCT.md frames them: it already names the qualities ("Polku's own look, not a generic one: the map first, plain words"; "thoughtfully designed and polished"; "legible in bright sun, usable while moving… at a glance"; people "trust it on real trips"), not the character, which is what the directions fill in.

| | Polku feels like… | From PRODUCT.md | What it changes |
|---|---|---|---|
| **A** | **A field instrument:** sure, sharp and readable in the sun, like a good compass | "trust it on real trips"; "legible in bright sun… at a glance" | Two materials: a thin glass (78 %) for what you glance past, a near-solid one (97 %) for what you read; a navigation magenta for the route |
| **B** | **Clear water over the land:** light and open, the map showing through everything that floats | "the map first" | A light, saturated glass everywhere (58 % and 68 %; a near-black 67 % and 73 % in dark), darker words on it; a lifted pink-red route |
| **C** | **A paper map in its case:** calm and warm, the chrome made of the map's own material | "Polku's own look, not a generic one"; "a pleasure to use" | Warm paper surfaces (95 %), warm text and greys, the night map's blue-black in dark; the orienteering overprint's purple for the route |

All three keep the accent, **Plan**'s green and Check's warning colours (`--danger`, its box and the badge), which #382 and 25d decided, and the difficulty scale's colours. All three give `--bad` the value of `--danger`, so danger has one red, and give the state colours dark versions they don't have today.

## The three directions

The values are in the mock-up's **Values** table under the frame, light and dark, for whichever direction is chosen. In short:

| | Today | A, field instrument | B, clear water | C, paper map |
|---|---|---|---|---|
| **Thin glass** (top bar, map buttons, toolbox) | white 94 %, blur 10 px | white 78 %, blur 16 px, saturate 160 % | white 58 %, blur 20 px, saturate 180 %; dark: near-black 67 % | paper `#faf7f0` 95 %, blur 12 px |
| **Thick glass** (planner, card, drawer) | white 94 %, blur 14 px; the card solid | white 97 %, blur 24 px | white 68 %, blur 32 px, saturate 180 %; dark: near-black 73 % | the same paper |
| **Edges** | none | two-tone hairline: white 70 % inside, `#101814` 55 % outside; dark: white 34 %, black 70 % | the same, with a bright top edge | the same in warm paper and brown-black |
| **Words on glass** | `--muted` | a darker grey, `#4c5751` | darker grey `#2f3934`, green `#0f4029`, red `#8f1d24`; in dark lighter ones | `#655d50` |
| **Neutrals** | cool green-grey | as today; dark surface lifted to `#1f2522` | as today, text a step darker (`#141b17`) | warm: text `#29251f`, muted `#6b6355`; dark `#1d2127` |
| **Lines** | text at 12 % (1.26:1) | 20 % | 14 % | warm, 18 % |
| **Route** | `#e11d48` | `#d6006e`, ΔE 18 or more from every red and purple on the map | `#ee1d5c`, ΔE 13.8 from the map's red | `#b0267f`, ΔE 14 from difficulty S4 |
| **Good, ok, warn** (light) | `#16a34a`, `#ca8a04`, `#ea580c`: 3.3, 2.9 and 3.6:1 on white | `#2e7d1f`, `#946200`, `#c2410c`: 5.2:1 or more | `#23863a`, `#a35b00`, `#c4400c`: 4.6:1 or more | `#4a7a1e`, `#8d6206`, `#b04d17`: 5.1:1 or more |

### What each direction costs

Measured in the mock-up on 2026-10-28, all 128 combinations in one run on the committed version (`claude/547-the-look/measure/mockup-matrix.json`; [how](#how-the-mock-up-measures)): the lowest contrast under any word or icon over all four maps, phone and desktop; for edges, the share of each surface's rim that shows at 3:1 (averaged, and on the worst map).

| | Today | A | B | C |
|---|---|---|---|---|
| `--text`, light · dark | 13.6 · 10.0 | 10.1 · 6.9 | 6.8 · 7.1 | 12.8 · 9.4 |
| `--muted` (on glass), light · dark | 4.75 · 4.68 | 4.90 · 5.05 | 4.92 · 4.85 | 5.51 · 5.08 |
| Other words (green, red, on the accent), light · dark | 4.8 · 5.5 | 5.3 · 5.0 | 4.8 · 4.7 | 5.2 · 5.4 |
| Icons, light · dark | 3.3 · 3.3 | 5.2 · 5.0 | 4.6 · 4.1 | 5.1 · 5.1 |
| Edges at 3:1, light · dark | 75 % (11 % on Maastokartta) · 34 % (3 % on the night map) | 99 % (94 %) · 97 % (91 %) | 99 % (94 %) · 97 % (91 %) | 99 % (94 %) · 97 % (91 %) |
| Pan, Mac (M1 Pro) | 60 frames a second | 60 | 60 | 60 |
| From #382's §7 first | nothing | recommended | **needed, in the same PR** | not needed |
| Other costs | — | two glass values, a darker grey for glass | three colours for words on glass in each theme; the dark glass can't go lighter than 67 % and 73 % (question 3) | warm neutrals across the whole app, which touch every screen |

- **Words and icons pass the floor in every direction and every mode,** Today included (Today's lowest is 4.68, with 0.2 to spare).
- **No direction fully meets the 3:1 floor for edges.** Today's surfaces disappear into a light map in light and a dark map in dark (75 % and 34 % of the rim at 3:1). A, B and C's two-tone hairline brings it to 97–99 % on average and 91–94 % on the worst map; the rest is where a map's own pixels sit between the two hairlines' colours. The measure counts an edge as showing where the outer hairline is 3:1 against the map, or the inner edge 3:1 against the outer hairline.
- **B's floor comes from colour.** A heavier weight doesn't change a measured ratio (WCAG keeps 4.5:1 for text under 18.66 px bold), so B uses a darker grey (`#2f3934`), green (`#0f4029`) and red (`#8f1d24`) for words on its light glass. The lowest word over a dark map is 4.92.
- **B in dark is the limit** (question 3). Over Maastokartta, with B's green-black tint, the lowest word is 3.3:1 at 60 %, 3.9:1 at 65 % and 4.65:1 at 70 %; a near-black tint gains a little (4.4:1 at 65 %, 5.2:1 at 70 %), so 67 % and 73 % pass (4.7:1 at the lowest). A lighter grey changes nothing there, and neither does a lower saturation: the near-white words are the ones that fall.
- **Edges need two tones.** One edge colour can't show against every map: a light hairline vanishes on a light map and a dark one on a dark map. A light inner hairline with a dark outer one works as the route's own white edge does.
- **#382's §7:** B makes the glass light enough that the person who needs solid surfaces (bright sun, low vision) must have them, so reduced transparency and more contrast land with B or before it. With A and C they're still worth building, but the default glass is near-solid already.

## The mock-up

- **Same scene, real pictures.** The map pictures are the running app's with its interface hidden (`pr-screenshots`, `claude/547-the-look/maps/`, retaken on 2026-10-28 once the tiles had finished loading); the route, its glow, its white edge and the points are drawn over them from the app's own points, so the route's colour follows the version. The words are the live app's.
- **Today beside each proposal:** the **Compare** switch, **Beside today**, puts today's frame next to the chosen one.
- **Measured in the page,** under the frame, for the chosen map, theme, device and mode: the lowest contrast under `--text` and `--muted` words, other words, icons, and the edges, with anything under 4.5:1 (3:1 for icons) marked; **Mark what's under 4.5:1** outlines those words in the frame. Safari before 18 can't blur a canvas, so the page says it isn't measured there instead of showing wrong numbers.
- **Pan test:** moves the map picture under the glass for 3 s and reports the frame rate. It leaves out MapLibre's own drawing, so a real phone does worse; it's there to run on one.
- **Left out of the scene:** the weather box and timeline (#377, #431), the scale bar and credits, the km labels and chevrons on the route, the profile's colours, the other planner sections. Finnish words and 200 % zoom aren't drawn, since this changes values, not layout.

### How the mock-up measures

- **Contrast:** for each word, every pixel under its own glyph boxes: the map picture (with the route) blurred and saturated as the surface's computed `backdrop-filter` says, the surface's colour laid over it, and whatever lies between the surface and the word over that. Checked against Chrome's own render of the same frames (the words made transparent, the screen captured, every pixel under each word): the page reads 0.06 or less high (B over the forest: 4.93 in the page, 4.87 rendered; today over the night map: 4.94 and 4.96, and the app's own 4.96).
- **Edges:** every 2 px round each surface (corners left out), whether the outer hairline is 3:1 against the map beside it, or the inner edge is 3:1 against the outer hairline.
- **The bright aerial isn't bright:** Finnish summer aerial photos are mid-dark. Under the planner the city view's median lightness is L\* 29–45 and the forest's 33–43, while Maastokartta's is 82–91. So Maastokartta is the bright case, and it's the one that sets B's dark glass.
- **Blur:** in Chrome on this Mac's GPU (`ANGLE Metal Renderer: Apple M1 Pro`), the pan test runs at 60 frames a second for every version, phone and desktop, on a second run (the first run of each drops a frame or a few while the GPU warms up). That bounds nothing for a mid-range phone; the browser pane couldn't be used, since a hidden pane draws no frames.
- **The scripts and the results** are on `pr-screenshots`, `claude/547-the-look/measure/` (`mock_matrix.py`, `mockup-matrix.json`, `gpu_pan.py`, `edge_try.py`), and the frames of every direction in `claude/547-the-look/mockup/`.

## Dark mode today, and the theme setting (#323)

A theme setting in Settings (**Automatic**, **Light**, **Dark**, and perhaps **Match the map**, to decide later) already has its issue, #323; the idea and its evidence from finding 3 are there.

- **How dark is applied today:** both ways, with every dark rule written twice: `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` and `:root[data-theme="dark"] { … }` (`css/app.css:75–121`, again at 1913–1914 and 2024–2025). One dark rule has no attribute twin: the MapLibre buttons' icons (`filter: invert(1)`, line 445). Nothing in `js/` or `index.html` sets `data-theme`; only `tools/smoke.py` does. `js/palette.js:43` reads the colours again only when the device's preference changes, and `js/wxmap.js:876` asks `matchMedia` itself. `<meta name="theme-color">` is one green for both.
- **What the setting changes:** it sets `data-theme` on `<html>`, or leaves the device to decide. The cleaner way keeps the dark values in one place: a few lines in `<head>` always set the attribute (from the setting, or from the device for Automatic, and again when the device changes) before the first paint, and the `@media` copies go; `palette.js` and `wxmap.js` follow the attribute.
- **Recommended: the setting lands before #547's build,** with the dark values moved into one block, so #547 changes them once. The other way round, #547 edits both copies and #323 then moves them.
- **PRODUCT.md** would say (Accessibility & Inclusion): "Light or dark is the person's choice: Automatic follows the device and is the default; Light and Dark in Settings set it for Polku alone, on this device."

## The build, after the choice

- `DESIGN.md` and `css/app.css` change together: the chosen direction's values on `:root` with their dark versions; the glass as two values per weight (a background and a filter) rather than `--surface`, which `.zoom-hint`, `.fab-layers[aria-expanded]` and `.track-card` use without a blur; one rule naming which surfaces are thin and which thick.
- **Safari before 18:** `-webkit-backdrop-filter` is only on `pl-tools` today, so every other frosted surface shows no blur there. The build writes both properties wherever the glass is.
- **#382's §7** (reduced transparency and more contrast for every surface) in the same PR if B is chosen; `prefers-reduced-transparency` today turns only the layer drawer solid (`.qd`, `css/app.css:681`), and nothing answers `prefers-contrast: more`. Settings' **High contrast** takes the more-contrast look too (#382, the user's choice 5).
- **A check over the map** in `tools/smoke.py`: the contrast sweep composites the glass over the page's own colour, never the map ([Text over the glass](#text-over-the-glass)), so a lighter glass needs the mock-up's measurement in the suite.
- **The JavaScript's colours** that would follow a new route red or state colours are typed in `js/style.js`, `js/chart.js`, `js/icons.js` and `js/cards.js` among colours that must not follow (the fairway marks, ship types): the build lists which move.
- **Order:** #323 first (above), and after #543 (the desktop toolbar), which changes `pl-tools`.

## The findings, ranked

Ranked by how much they cost people outdoors, how often they show, and how sure the evidence is. Each says where it comes from: the apple-design skill (§12, §15, §16), a measurement, or the design reviews.

1. **One material and one shadow for everything, and no rule for which surface is which** (§12: material weights, bigger reads thicker; both reviews' first issue). The top bar, a 40 px map button, the planner's sheet and Layers all compute to white at 94 % with a 10–14 px blur and the same `--shadow`. At 94 % only 6 % of the map comes through: in the model ([Text over the glass](#text-over-the-glass)) the glass's own lightness stays between L\* 96 and 100 over every base map, so it reads as flat white slabs (near-black ones in dark), and a blur of 10 or 14 px changes the words' contrast by under 0.05. The blur can't be seen, yet it's still drawn every frame while the map pans (its cost isn't measured yet). Meanwhile a point's card, the menus and the popups are solid, and DESIGN.md says sheets are solid while the planner's sheet is glass. `--shadow-sheet`, `--shadow-dialog` and `--shadow-marker` are defined and used nowhere; 38 shadows are typed in place. Surfaces also stack: the weather box over the planner's sheet on a phone (a white card on a white sheet, the "Your speed" row clipped under it), Layers over the timeline, Settings over the sheet; §12 says never to stack one translucent surface on another (the weather box's place is #377 and #431).
2. **In dark mode the chrome has no edges over the night map** (§12: the bright edge; both reviews). The dark surface `#181c1a` against the night map's `#161a1f` is 1.02:1, against its forest 1.1:1. The floats have no border and a black shadow can't show on near-black, so the map buttons and the sheet dissolve and only their icons float. Over the bright terrain map the same black shadow smudges grey around the pills. Neither theme has a bright edge anywhere.
3. **The interface's tone ignores the map.** The map's style has its own idea of dark (`dark: () => isAerial(state.base) || state.base === 'night'`, `js/main.js:456`); the interface follows the device, as PRODUCT.md commits it to: "Polku follows the person's settings: larger text, reduced motion, light or dark." A light interface over the night map is a white glare beside a black map (the paddler at dusk); a dark one over Maastokartta punches dark holes in a bright map. Anything that lets the map set the tone has to stay under the person's setting, as a choice they make, never in place of it: Polku has no theme setting of its own yet, and #323 is where one, with "Match the map", is decided. The neutrals are a cool green-grey (hue 162°) while the trail map's paper and words are warm (94° and 78°) and the night map blue-grey (264°), which shows at every edge. MapLibre's scale bar stays light in dark mode.
4. **Red is the route's and five other things'** (DESIGN.md's Map Holds the Colour Rule; both reviews). The route's `#e11d48` is ΔE 9.2 from the `#dc2626` the map uses for military areas, avoided places, incidents, closed winter ways, LIPAS's hiking routes and its campfire pins, which sit right beside the line at the same lightness (1.03:1); 8.8 from difficulty S3, on by default for MTB; and it runs over Maastokartta's red roads. Apart, on a phone in the sun, they're one red, and only the white edge says which is yours. Danger shares the hue too: the pink Read before you go box is the most saturated thing in the peek, and Check's badge is red. Those two are decided: `--danger`, its box and the badge are 25d's approved mock-ups' values, and #382 kept "red for the route and for danger". Stop 2 leaves them as they are unless you reopen them; what it can change is the route's red and the map's other reds.
5. **Words on the glass are checked over the wrong background, and pass by a hair** ([Text over the glass](#text-over-the-glass)). The contrast sweep measures them over the page's own grey-green, never the map. Over real maps `--muted` is 4.62–4.68:1 at worst, against 4.5; at 80 % white it would fall to 3.65 (night) and 3.76 (aerial). The safeguards aren't there yet: reduced transparency turns only the layer drawer solid (`css/app.css:681`), and nothing answers `prefers-contrast: more` (#382's §7, not built). §12: no flat grey on glass; heavier, higher-contrast words instead.
6. **Lines and fills vanish in the sun, and the shapes don't agree** (§12: scroll edge effects; §16, craft). `--line` is 1.26:1 on white (1.38:1 in dark) and `--surface-2` 1.1:1, yet they carry the grouping: 45 dividers and outlines, rows divided in one group and not the next, no fade where a list meets a floating header. 14 corner sizes: `--radius` (14 px) is written 5 times while 12 px is typed 25 times, with 9, 16 and 18 px beside them; the top bar is pills and circles, the map's buttons 16 px rounded squares, the mark a rounded square in a circle.
7. **Colours nobody chose, and green does too many jobs.** `--good`, `--ok`, `--warn`, `--bad` and `--route` are Tailwind's 600s from the first commit. (The `-text` set and the dark versions are Tailwind steps too, the 700s, 800s and 400s, but #382 chose and measured them for contrast.) `--good`, `--ok` and `--accent-2` aren't used at all, `--warn` once; where those hex values show, they're typed in the JavaScript and the map's style among colours that must not follow them (the fairway marks' red and green, ship types). The start of a route is green three ways (`#16a34a` on its marker and the profile, `#2e9e5b` in the cards' route mark at `js/cards.js:263`, the accent for selection). On the home screen two solid greens stand beside **Plan** (the mark and the sport pill, and Weather while it's on), so the one main action isn't the only green thing; **Plan** itself is green by the user's choice 1 on #382 (2026-10-22). Green values such as "Balanced" and "Normal" read like links. What is chosen works: the green-grey neutrals, the forest accent with its dark-mode split (`--accent-bg`), and the green-tinted shadow.
8. **The type set is loose** (§15). The CSS uses weights 400, 500, 600, 650, 700, 750 and 800 (and "MTB" in Layers renders at 900); 18 sizes typed in px (9 to 22, half sizes too) beside the nine values; 11 line heights that don't follow size; tracking only on titles and small headings; Layers' tiles' second lines ("Difficulty", "Zoom in to see") at 11 px and 1.2, under the 12 px floor for reading text (#382's touch PR plans to lift them). Words on glass get no extra weight (§12).
9. **Craft without delight** (§16). Both reviews called the look calm but anonymous: nothing in the chrome is Polku's own except the dashed-path mark, and nothing else echoes it. §16 says delight is what follows when the rest is right, not something added; the findings above are the rest. Whether Polku should have one signature of its own (the dashed path, a material) is part of question 1.

**What works, and stays whichever way you choose:** the map first, with nothing over it that the moment doesn't need; the route's white edge, red core and glow, which read first on every base map; the dashed-path mark; chosen states never by colour alone (a tint, a 2 px border, a tick); complete dark versions with care where it mattered (#239); dim versus separate already right (Layers and Settings keep the map live, dialogs dim it); words at 4.5:1 on every solid surface since #382; numbers in tabular figures.

### Filed apart

Found by this review but outside its values; each is a small fix of its own:
- #551: the search field's hint is the browser's grey (`#757575`), 3.7:1 on the dark glass;
- #553: the word **Layers** over its map picture is 2.1–2.4:1 at worst on the light pictures;
- #554: on the aerial maps, peaks' names and heights and lakes' names are dark words on a dark halo.

(#552, Maastokartta's names blown up, was closed: the pictures had been taken before the tiles loaded.)

## How the critique ran

Impeccable's critique, its two assessments as two separate agents that didn't see each other's work, run twice: once on 2026-10-27 by the session that started #547, and once on 2026-10-28 for this review, with the same brief (the whole look, all 18 values, §12, §15, §16; phone and desktop, light and dark, the terrain map, aerial photos and the night map).
- **The design reviews** agreed on the first four findings and on refining. Their verdicts: "partly authored, materially generic" and "authored content in a borrowed skin": the route, the mark, the live thumbnails and Check's shapes are Polku's own, while the chrome (a white pill with one soft shadow, settings-style rows) could belong to any map app. Nielsen's heuristics for the look: 22 of 32 and 15 of 24 (both Acceptable; the n/a ones differ). Both felt it calm but anonymous; one named what it should be: calm, sure-footed confidence, like a good paper map in its case.
- **The detector** (`impeccable detect --json index.html js`): 52 findings, 48 of them the map's data colours typed in `js/config.js`, `js/main.js` and `js/safety.js` (false positives for the look, apart from `js/cards.js:263`); three 10 px words (Weather, Layers, Plan, the touch PR's under #382); the Layers word's contrast (#553). In the browser it ran 14 scans; the base map changes nothing for it, since it reads the CSS's colours, not the map's pixels.
- **Limits:** the browser pane was hidden, so the map sometimes drew late and the desktop views were seen at about half scale. In both runs the detector's report reached the session before the design review finished (the playbook asks for the review first); the two reviews themselves never saw the detector's output. Not seen: a real phone, the sun, Safari, 200 % zoom.

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
- **A model, for what-ifs:** the same map pictures blurred in a canvas, the glass's colour laid over each pixel, and the contrast taken against every pixel under the surface, 40 px from its edges left out (by the session that started #547, 2026-10-27). It agrees with the app where both measure the same thing: `--muted` on the planner over the night map at 94 % is 4.96 in the app and 4.93 in the model.

**Today, the lowest contrast anywhere under the words** (in the app):

| | Trail map | Maastokartta | Aerial FI, forest | Aerial FI, Tampere | Night |
|---|---|---|---|---|---|
| `--muted`, light | 5.08 | 4.65 | 4.66 | 5.00 | 4.68 |
| `--muted`, dark | 4.62 | 4.86 | 4.90 | 6.22 | 5.34 |
| `--text`, light | 15.0 | 14.3 | 13.9 | 14.6 | 13.9 |
| `--text`, dark | 9.8 | 10.3 | 10.1 | 13.1 | 11.3 |

The lowest are the zoom hint (`.zoom-hint`, the glass's colour with no blur) on Maastokartta and the aerial, the planner over the night map, and the grey line in a danger box in dark. Nothing fails today; there's 0.1–0.2 to spare.

**What a lighter glass would do** (the model, `--muted`, the worst map): at 80 % white, 3.65 (night) and 3.76 (aerial), failing; at 80 % dark, 3.66 (Maastokartta) and 3.77 (the trail map). So a glass much lighter than today's needs, with it, a darker grey or a heavier weight for words on glass, the check over the map in `tools/smoke.py`, and #382's reduced transparency and outdoor contrast.
