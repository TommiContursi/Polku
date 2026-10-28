# The look: a review and its directions (#547)

The first review of Polku's look as a whole, and the directions for it, built side by side. Phase 24 ([its review](../reviews/2026-10-17-design/README.md)) looked at usability and structure, and #382 made the look consistent without changing it. This one asks whether the look itself is right: the materials, the depth, the colours, the type's weights and spacing, the 18 base values on `:root`, and how they sit with the map's own colours. What's still to do, and its status, is on GitHub, in #547.

- **Status (2026-10-28): version 2 of Stop 2's mock-up is built, waiting for the user to choose** ([What's for you to decide](#whats-for-you-to-decide)). Nothing is built in the app: `DESIGN.md` and `css/app.css` are as they are on `main`.
- **The mock-up:** [mockups/issue-547-the-look.html](mockups/issue-547-the-look.html). Version 2: today's look, B after a quieter and polish pass, and a new direction, D, over real map pictures from the running app, with the contrast under every word measured in the page. Its switches:
  - **Version:** 2, or 1, the first set: today, A, B and C as they were.
  - **The direction.**
  - **The map:** Maastokartta, the bright one; aerial photos of the city beside the route, as mid-dark as the forest; aerial photos of forest and lake; the night map.
  - **The theme:** light or dark, and for D, **Match the map**.
  - **Phone or desktop.**
  - **The mode:** default, more contrast or reduced transparency.
  - **The depth:** one shadow, or thicker when bigger.
  - **Compare:** alone, **Beside today**, or **Both depths**.

  The same scene in every version: the Kauppi route, the planner open with a point's card, and the map's buttons.
- **Decided by the user (2026-10-28), first round:**
  - Refine rather than replace.
  - See the directions built before choosing.
  - Bright sun and low vision belong to the modes (`prefers-contrast: more` and `prefers-reduced-transparency`, #382's §7). The default look still keeps words at 4.5:1 over the map and icons at 3:1.
  - For B, the floor comes from darker words on the glass, not a thicker glass.
  - "Match the map" goes with the theme setting (#323).
- **Decided by the user (2026-10-28), after a critique of version 1:**
  - Keep today and B.
  - Replace A and C, which at phone size differed from today by little more than an edge or a warm tint, with one new direction, D, clearly different from today and from B.
  - Make B quieter and polish it, from the critique's starting points (below).
  - The route in A's magenta, `#d6006e`, in every version.
  - Make the two depths visibly different.
  - Check whether the unblurred strip the critique saw in B is real.
  - In the default look, a control already told by its words or icon needs no 3:1 rim; that rim belongs to more contrast. Words stay at 4.5:1 and icons at 3:1.
- **From:** `main` at 18b43d4, looked at on 2026-10-27 and 2026-10-28 at 390 × 844 and 1440 × 900, light and dark, over the terrain map, aerial photos and the night map. Also: Impeccable's critique, three times ([how it ran](#how-the-critique-ran)); Impeccable's shape for D, and its quieter and polish passes for B; the apple-design skill's §12 (materials and depth) in full, §15 (weight, tracking and leading) and §16 (craft and delight); the measurements below.
- **Out of scope:** the typeface (#181), the motion curves (#249), the difficulty scale's colours (#382, the user's choice 4), layout and structure. What the review found outside the look is filed as issues ([below](#filed-apart)).

## What's for you to decide

From the mock-up, version 2:

1. **The direction:** today, B or D. **Recommended: B, with its map buttons as question 3's b.**
   - **Why B:**
     - It stays within #547's scope: values, not layout.
     - It keeps today's room for the map: 38 % of a phone's screen in the clear, where D leaves 29 %.
     - It meets the floors in the default look on every map. Its modes turn it solid for the sun and for low vision, which is where the worst case belongs by your decision.
   - **What B costs:**
     - Over Maastokartta, the map people use most, its glass carries the map's colours: the sheet a faint pink and cyan, and the map's buttons up to 4.9 apart with b.
     - #382's §7 in the same PR, a check over the map in `tools/smoke.py`, and a pan test on a real phone.
   - **Choose D if one calm tone over every map is worth less room for the map and a wider #547.**
     - D is calm over every map, Maastokartta included; it needs nothing from §7, and it draws no blur.
     - Its build changes layout, which #547 leaves out. The flush sheet replaces #533's floating one, and the bay is a new kind of control.
     - Its map doesn't come back by slimming: with a 56 px top strip and no side margins, a phone's clear map grows only from 29 % to 30 %. The flush sheet and the bay are the cost.
   - **The critique, blind to this plan, preferred D** (22/32 against 20/32). It valued the same words over every map, which by your decision is the modes' job; it didn't know your priorities.
2. **The depth:** one shadow for everything (DESIGN.md's One Float Rule, as today) or thicker when bigger: the small controls almost flat on the map, and the planner, the panel and the card lifted well off it, as apple-design §12 asks. **Both depths** in the mock-up's Compare switch shows them side by side. Shadows show over Maastokartta; over the photos and the night map they barely show in any version. No recommendation, as asked. Thicker when bigger rewrites the One Float Rule and DESIGN.md's "Don't add… a heavier shadow". D has no shadows, so this applies to B and today.
3. **If B, its map buttons:** one tint, or the map's colours lifted. A strongly saturated glass and one tint can't both hold over Maastokartta: its lake's cyan and the built-up areas' pink lie under neighbouring buttons. The figures are the most two buttons differ, in CIEDE2000 (about 2 is the least you'd notice side by side), over Maastokartta, light · dark. Today's are 2.3–3.8 · 2.7–5.3.
   - **a. A whiter glass with the colours lifted (drawn by default):** 84 % white, saturate 160 %. 7.3 · 9.0; under 3.6 over the other maps.
   - **b. The same glass with the reading glass's saturation (recommended):** 84 % white, saturate 105 %. 4.9 · 5.9–7.2; under 2 over the night map. The critique's fix. Lifting the map's colours under small buttons adds noise and tells nobody anything.
   - **c. A thin glass, as version 1's:** 66 % white, saturate 180 %. 15.9 · 15.6. Version 1's was thinner still (58 %).

   The mock-up's **B's map buttons** switch shows all three. Opacity moves the spread most and saturation some. Under 3 everywhere takes about 92 %, today's glass, or a solid button. A shared surface for the whole group would give one tint along it, but it changes the layout, so it isn't drawn.

**Question 3 of version 1** (B's dark glass: a darker 67 % and 73 %, or as light as the light glass) is gone. B's light glass for reading is now 72 %, so a dark glass at 73 % is no thicker than the light one.

The directions, as PRODUCT.md frames them. It names the qualities ("Polku's own look, not a generic one: the map first, plain words"; "thoughtfully designed and polished"; "legible in bright sun, usable while moving… at a glance"; people "trust it on real trips"), not the character, and the directions fill that in.

| | Polku feels like… | From PRODUCT.md | What it changes |
|---|---|---|---|
| **B** | **Clear water over the land:** light and open, the map showing through everything that floats | "the map first" | Glass: 72 % for what you read, with the map's colours barely lifted, and 84 % for the map's buttons, with them lifted; darker words on it; a soft two-tone edge |
| **D** | **The map's margin:** the map sits in the interface as a printed map sits in its margin, and nothing floats | "legible in bright sun… at a glance"; "Polku's own look, not a generic one" | Solid, flat surfaces flush to the screen's edges; the map in a rounded window with a neatline; the map's buttons as bays of the margin; no blur and no shadow |

Both keep:
- the accent, **Plan**'s green and Check's warning colours (`--danger`, its box and the badge), which #382 and 25d decided;
- the difficulty scale's colours.

Both also:
- give `--bad` the value of `--danger`, so danger has one red;
- give the state colours dark versions they don't have today;
- draw the route in `#d6006e`, which today's frame takes too in version 2.

## D, the map's margin: its brief

Shaped with Impeccable's shape from the user's request for this round, which answered its discovery questions. D is this session's own proposal from those answers. Shape's concept roll wasn't used, since the scene, the controls and the layout are fixed and only the material is open. The user confirms or corrects D from the mock-up.

- **Job and audience:** the same people and scenes as every direction.
  - Planning at a desk, checking a trail, or out on the trail with a phone in one hand in bright sun.
  - The look carries the map's controls and the planner. It has to read at a glance over any map and leave the map in charge.
- **Outcome and proof:**
  - Words and controls that read the same over every map, with nothing depending on what's under them.
  - A look that is clearly neither today's nor B's at phone size.
  - The proof is the mock-up's measurement over four maps, light and dark, phone and desktop.
- **The direction: nothing floats.** B puts the interface on glass over the map. D puts the map in the interface, as a printed map sits in its margin.
  - The top bar, the planner's sheet and the desktop's panel are solid and flat. They run to the screen's edges and frame a rounded window onto the map, with a neatline round it: the line that bounds a printed map.
  - The map's buttons, the undo and the zoom hint are bays and tabs of the margin, not chips on the map.
  - The card at a point on a desktop is a flat callout with the same line.
  - No blur and no shadow. White in light, near-black (`#0d0f0e`) in dark.
- **The tone.** The user's idea for this round, a glass whose tone follows the map, was weighed as D's whole idea and kept as one part of it.
  - On its own it doesn't differ at phone size. Over Maastokartta in light, the most common case, a map-toned glass is a light glass, like B's.
  - It also needs the map to set the tone.
  - So D keeps it as **Match the map**, a possible choice in Settings (#323). With it, the margin takes the map's tone: white round Maastokartta and black round the aerial photos and the night map, like a printed map's margin and a photograph's border.
  - Under Automatic, Light and Dark, D follows the theme like every direction, so the theme rules don't change.
- **Scope and boundaries:** the look. The order of the controls, their words, the type and the motion stay.
  - Beyond values, D changes the sheet's and the panel's inset and corners (gone), the map's buttons (one bay) and the hint (a tab).
  - **Anti-goals:** flat chips outlined on the map, chrome heavier than the map needs, a frame that eats the map on a phone.
- **States:**
  - Four maps, light and dark, phone and desktop.
  - More contrast: a darker neatline and grey.
  - Reduced transparency: nothing changes, since D is solid already.
  - On a phone the window's lower edge moves with the planner, from peek to full.
- **Open:**
  - The side margins' width on a phone (6 px drawn). Dropping them and taking the top strip to 56 px wins back only 1 point of the phone's screen (29 % to 30 %).
  - Whether the desktop's toolbar is a tab of the margin (drawn) or a second row of it.
  - Whether the bays take the map's tone with Match the map (drawn: yes).

## B, quieter and polished

From Impeccable's quieter and polish passes, starting from the critique's points. Version 1's B is behind the mock-up's Version switch.

| | B, version 1 | B, version 2 |
|---|---|---|
| **Glass for what you read** (the top bar, the zoom hint, the undo, the planner, the card) | the top bar, hint and undo on the thin glass; the planner and card 68 % white, blur 32 px, saturate 180 % | 72 % white, blur 32 px, saturate 105 %; dark: near-black 73 % |
| **Glass for the map's buttons** | 58 % white, blur 20 px, saturate 180 %; dark 67 % | 84 % white, blur 24 px, saturate 160 %; dark 84 % (question 3) |
| **Outer hairline, light** | `#101814` at 55 %, which read as an outline round a cut-out | at 26 %; the 3:1 rim is more contrast's. Dark keeps its rim |
| **Words on glass** | grey `#2f3934`, green `#0f4029`, red `#8f1d24` | grey `#3b4741`, green `#165a3a`, red `#9b1f27`: as calm as the 4.5:1 floor allows (a lighter grey falls to 4.5 over the night map) |
| **Check's warning box** | `--danger-soft`, in dark see-through over the glass | solid in both themes (dark `#3a2124`) |
| **The chosen segment, dark** | darker than its track, so it looked like a gap | lighter than its track (`#3f4843`) |
| **The logo** | a green square in a glass pill: three nested edges | the green square alone on a phone; on a desktop its corners concentric with its pill |
| **Layers' tile** | the old 2 px white border | the glass's own edge |
| **An undo that can't undo** | 45 % opacity, gone on the grey glass | the glass's grey at 70 %: 3.1–4.0:1 in light and 3.8–6.1:1 in dark, under redo's 8.7 and more (today's: 2.7 and 3.7–3.9) |
| **Route** | `#ee1d5c` | `#d6006e` |

## The values

The mock-up's **Values** table under the frame gives them all, light and dark. In short:

| | Today | B, clear water | D, the map's margin |
|---|---|---|---|
| **Surfaces** | white 94 %, blur 10–14 px; the card solid | glass, 72 % for what you read and 84 % for the map's buttons ([B's table](#b-quieter-and-polished)) | solid `#fff`; dark `#0d0f0e` |
| **Edges** | none | two-tone: white 70 % inside, `#101814` 26 % outside; dark: white 34 %, black 70 % | a neatline round the map's window, the bays and the card: `#1c2420` at 50 %; dark: `#e8ece9` at 34 % |
| **Depth** | one shadow | one shadow, or thicker when bigger | none |
| **Neutrals** | cool green-grey | as today, text a step darker (`#141b17`) | as today, muted a step darker (`#56625b`) |
| **Lines** | text at 12 % | 14 % | 14 % |
| **Route** | `#d6006e` (main: `#e11d48`) | `#d6006e` | `#d6006e` |
| **Good, ok, warn** (light) | `#16a34a`, `#ca8a04`, `#ea580c` | `#23863a`, `#a35b00`, `#c4400c` | `#2e7d1f`, `#946200`, `#c2410c` |

## What each direction costs

Measured on version 2 at f913eb1, 96 frames (`claude/547-the-look/measure/v2/mockup-matrix.json`; [how](#how-the-mock-up-measures)). The fixes after it, from the critique, touch no measured word. The figures are the lowest contrast under any word or icon over all four maps, phone and desktop, in the default look; then the edges in the default look and in more contrast; then what's left of the map.

| | Today | B | D |
|---|---|---|---|
| `--text`, light · dark | 13.6 · 10.0 | 8.7 · 8.3 | 13.6 · 10.1 |
| `--muted` (on glass), light · dark | 4.75 · 4.68 | 5.40 · 5.85 | 5.44 · 6.45 |
| Other words (green, red, on the accent), light · dark | 4.8 · 5.5 | 4.6 · 5.7 | 5.3 · 5.3 |
| Icons, light · dark | 3.3 · 3.3 | 4.6 · 4.6 | 5.2 · 4.2 |
| Edges at 3:1 in the default (not needed), light · dark | 76 % · 36 % | 82 % (none of the undo's pill over Maastokartta) · 100 % | 100 % · 100 % |
| Edges at 3:1 in more contrast (needed), light · dark | 100 % · 100 % | 100 % · 100 % | 100 % · 100 % |
| The map in the clear, phone · desktop | 38 % · 58 % of the screen | 38 % · 58 % | **29 % · 51 %** |
| The map's buttons, the most two differ in tint, light · dark | 3.8 · 5.3 | 7.3 · 9.0 (question 3) | none: one solid bay |
| Pan, Mac (M1 Pro) | 60 frames a second | 60 | 60, with no blur |
| From #382's §7 first | nothing | **needed, in the same PR** | nothing: D is solid |
| What the build touches | — | glass values, three colours for words on glass in each theme, the check over the map in `tools/smoke.py` | the sheet's and panel's geometry (#533's floating sheet), the map's buttons as one bay (a new control, for the user's OK), the frame's window |

- **Words and icons pass the floor in every version, mode, map and theme.** The lowest are today's grey at 4.68, and B's green "MTB" over the night map at 4.61.
- **Edges.** In the default look, a control told by its words or icon needs no 3:1 rim, by the user's decision. In more contrast every surface of every version shows at 3:1 all round. **Plan**'s button needed a class for that: its accent ring now keeps the 3:1 rim. The edge measure was corrected after the critique ([how](#how-the-mock-up-measures)).
- **D costs map.** On a phone the map is in the clear on 29 % of the screen against 38 % for today and B, so about a quarter less. On a desktop it's 51 % against 58 %. The flush sheet costs most of it, then the top bar's full width and the bay. B's glass counts as covering here too, though the map shows through it.
- **The unblurred strip in B's phone sheet isn't real.** It was looked for:
  - in Chrome on its software renderer and on the Mac's GPU (Metal, M1 Pro);
  - at 1, 2 and 3 × pixels;
  - with the frame wholly in the viewport and partly out of it;
  - captured with and without `captureBeyondViewport`.

  Every quarter of the sheet was blurred: the right quarter's sharpness was 0.3–1.1 against 1.8–9.9 unblurred (`measure/v2/strip.json`). The capture tool the critique used is the likeliest cause. This round's critique was given frames captured the way the mock-up's own measurements are.

## The critique of version 2

Method: dual-agent, Impeccable's critique on version 2 at 2836e30. A, the design review, and B, the detector with browser evidence, ran as separate agents that didn't see each other's work. Neither was told what this plan recommends, nor allowed to read it, the PR or the issue.
- A looked at 29 frames captured the way the mock-up's own measurements are, made 12 more, and read the page's numbers and its CSS.
- B ran `impeccable detect` on the file, injected the detector into the frames alone (`?bare=1`), and collected the page's measurement for 48 views.

**Design health** (Nielsen's heuristics for a look; 7 and 10 n/a):

| # | Heuristic | B | D | What decided it |
|---|---|---|---|---|
| 1 | Visibility of status | 2 | 2 | Both: the undo that can't undo, at full strength, reads as one that can. D in dark: the chosen segment is close to its track |
| 2 | Match with the real world | 3 | 3 | B: a familiar glass, nothing of the outdoors. D: echoes a printed map's margin |
| 3 | User control | 3 | 3 | Both modes work. With either, B turns solid; D doesn't change |
| 4 | Consistency | 2 | 3 | B: the map's buttons take different tints over Maastokartta. D: one bay, but tabs from three edges |
| 5 | Error prevention | 3 | 3 | Remove keeps its red outline |
| 6 | Recognition | 3 | 2 | B: Layers' tile without its border sinks into the forest. D: the tile is cut by the screen's edge on a phone and has no word on a desktop |
| 8 | Aesthetic and minimal | 2 | 3 | B: over Maastokartta the sheet goes pink with a cyan patch, maroon and teal in dark. D: calm, one tone, but more chrome |
| 9 | Error recognition | 2 | 3 | B: Check's box loses its edge in glass gone pink over the city. D: crisp on every map |
| **Total** | | **20/32** | **22/32** | both Acceptable; D at the edge of Good |

**Its verdicts:**
- **B is generic: glass over a map is Apple Maps' convention.**
  - At phone size over Maastokartta it reads as today with tints.
  - Over the photos and the night map it is calm, with every word at 8.6:1 or more.
  - Its more-contrast mode is excellent.
- **D is half-specific.**
  - Framing the map like a printed sheet is a real idea for Polku, clearly different from today and B on a phone, and at its best in dark round a bright map.
  - But its neatline has round corners and its margin carries nothing, so a desktop reads as a header and a side panel.
  - In light round a dark photo, the white margin is a heavy mat.
- **B against D: D serves Polku's people better.**
  - The same 13.8:1 words over every map, a crisp warning box, the map's buttons as one group, and modes that change nothing.
  - D's cost: a quarter less open map on a phone and a heavier strip at the top.
  - B's cost: it depends on the map under it, and its blur costs battery.

**Priority issues, both assessments together:**

| | Issue | Where | Proposed |
|---|---|---|---|
| P1 | B: the map's buttons aren't one tint on the default map. Over Maastokartta they're up to 7.3 apart (8.7 in dark), against today's 2.3 | `phone/b-maasto-*` | Question 3: the reading glass's saturation (105 %) gives 4.9 (5.9–7.2 in dark); solid gives one tint |
| P1 | B: over Maastokartta, the map people use most, the sheet and the panel aren't one calm tone: cyan to pink in light, maroon and teal in dark | `depth/b-maasto-light-desk-*` | Only a thicker glass or less saturation moves it; the user's starting values (72 %, 100–110 %) are drawn |
| P1 | D: less map in the clear, 29 % of a phone's screen against 38 %, mostly the top strip; against DESIGN.md's North Star | `phone/d-*` | Win back the strip's height on phones; no side margins |
| P2 | Both: the undo that can't undo now reads as one that can | `phone/b-*`, `phone/d-*` | **Fixed after the critique:** its grey at 70 %, measured (3.1:1 or more, under redo) |
| P2 | B: Layers' tile, without its white border, sinks into the forest | `phone/b-forest-light` | **Fixed after the critique:** a light inner rim, as the route's white edge |
| P2 | D: Layers' tile is cut by the screen's edge on a phone, and has no word on a desktop | `phone/d-*`, `desk/d-*` | **Fixed after the critique** |
| P2 | D: tabs from three edges (the hint from the top, the undo from the left, the bay from the right) nibble the window; the bay's foot shows the window's line and reads as a sticker | `phone/d-*` | Grow the bays from one edge |
| P2 | D: on a desktop the flat card can overlap the flat panel, with only a hairline between them | `desk/d-forest-dark` | **Fixed after the critique:** the card stays inside the window |
| P2 | B: in light over Maastokartta the edges show at 3:1 on 19 % of a rim, and in dark every rim is black, which the review read as cut-outs | `phone/b-maasto-*` | Not needed in the default by the user's rule; the dark rim is the one the user kept |
| P3 | D, dark: the chosen segment leans on its green arrow (4.2:1) | `phone/d-*-dark` | A lighter chosen fill |
| P3 | B: the logo, a bare green square, is as heavy as the sport pill: two green blocks in the top bar | `phone/b-*` | — |
| P3 | Both: on a phone the two depths are hard to tell apart, even over the lake | `depth/` | The desktop shows it (the card and panel); the phone only at the sheet's top edge |

**The detector** (`impeccable detect --json`) exited 0:
- **No anti-patterns**, and 18 advisory findings against DESIGN.md's scale: 10 radii, 5 colours and 3 font sizes.
  - 7 are the mock-up page's own chrome.
  - 11 are values the directions share with today (16 and 12 px corners, the 11 px words), plus one of B's: the logo's 13 px corner, which isn't on DESIGN.md's scale.
- **In the frames alone** it found one thing, `nested-cards` on Check's warning box inside B's desktop panel. That box is 25d's decided design, and today has it too. D's flat panel doesn't trigger it.
- **Nothing it found tells B and D apart beyond that.**

**Its measurement** (48 views):
- No word under 4.5:1 and no icon under 3:1. The closest are B's in light over the night map: "MTB" at 4.61 and "Balanced" at 4.67.
- It also caught a more-contrast edge at 69 % on **Plan**'s button in dark. That was a gap in the page's measure: a ring written `rgb()` read as see-through. It's fixed, and every surface now shows its edge at 3:1 in more contrast ([costs](#what-each-direction-costs)).

**Questions it left** (from the design review):
- When D's sheet moves between peek and full, does the window shrink, or does the margin slide over the map, floating again?
- Should D's margin earn its height by carrying the scale, north and the credits, as a printed sheet does?
- What does B give that B with reduced transparency doesn't give more calmly?
- Should Match the map ever turn the margin black round a photo when someone chose light, in the sun?

**Not checked by either:** enlarged text (the mock-up's sizes are in px), overlays such as radar or **Colour by**, a real phone, the sun.

## The mock-up

- **Same scene, real pictures.**
  - The map pictures are the running app's with its interface hidden (`pr-screenshots`, `claude/547-the-look/maps/`, retaken on 2026-10-28 once the tiles had finished loading).
  - The route, its glow, its white edge and the points are drawn over them from the app's own points, so the route's colour follows the version.
  - The words are the live app's.
- **Comparing:**
  - **Beside today** puts today's frame next to the chosen one.
  - **Both depths** puts one shadow beside thicker when bigger.
  - The **Version** switch brings back the first set.
- **Measured in the page,** under the frame, for the chosen map, theme, device and mode:
  - the lowest contrast under `--text` and `--muted` words, other words and icons, with anything under 4.5:1 (3:1 for icons) marked; **Mark what's under 4.5:1** outlines those words in the frame;
  - the edges, labelled not needed in the default and needed in more contrast;
  - the spread of the map buttons' tints, with a switch for question 3's three glasses;
  - the undo that can't undo, which has no floor but should show and read dimmer than redo;
  - the share of the screen where the map is in the clear.

  Safari before 18 can't blur a canvas, so the page says it isn't measured there instead of showing wrong numbers.
- **Pan test:** moves the map picture under the glass for 3 s and reports the frame rate. It leaves out MapLibre's own drawing, so a real phone does worse; it's there to run on one.
- **Left out of the scene:**
  - the weather box and timeline (#377, #431);
  - the scale bar and credits;
  - the km labels and chevrons on the route;
  - the profile's colours;
  - the other planner sections.

  Finnish words and 200 % zoom aren't drawn, since this changes values, not layout; D's bays would need that check before a build.
- **Fixed after the critique:** the undo that can't undo is dimmed again (the glass's grey at 70 %, measured in the page); B's Layers tile keeps a light inner rim; D's Layers tile sits whole in its bay with its word; D's card stays inside the window; D's chosen segment in dark is lighter.
- **A fix in version 2 that touches version 1 too:** grey words on a solid surface had no grey (no rule for them), so today's card on a desktop and D drew them in the text's colour. They now take `--muted`; it changes no measured lowest.

### How the mock-up measures

- **Contrast:**
  - For each word, the page takes every pixel under its own glyph boxes. Each pixel's background is the map picture (with the route), blurred and saturated as the surface's computed `backdrop-filter` says, with the surface's colour laid over it and whatever lies between the surface and the word over that.
  - **Checked against Chrome's own render** of seven frames (the words made transparent, the screen captured, every pixel under each word). The page's lowest agree within 0.03: B over the night map, 4.61 in both; today over the night map, 4.94 in the page and 4.96 rendered.
- **Blur, phone and desktop:** the pan test runs at 60 frames a second for today, B and D, twice each (`measure/v2/`).
- **Edges:** every 2 px round each floating surface (corners and D's flush margin left out). The layers run from the map inwards: the map, the outer line, the inner rings, the fill. The edge shows where any two neighbours are 3:1. Corrected on 2026-10-28 after the critique: a ring written `rgb()` had read as see-through, and the fill wasn't one of the layers. Version 1's figures used the first measure.
- **The map buttons' tint:** the mean colour of each button's glass over the map, and the largest CIEDE2000 between any two. The page checks its CIEDE2000 against two pairs of Sharma, Wu and Dalal's test data.
- **The map in the clear:** the share of the screen, every 4 px, under no surface. For D, outside the window counts as covered.
- **The bright aerial isn't bright.** Finnish summer aerial photos are mid-dark: under the planner the city view's median lightness is L\* 29–45 and the forest's 33–43, while Maastokartta's is 82–91. So Maastokartta is the bright case.
- **Blur:** measured only in Chrome on this Mac's GPU (`ANGLE Metal Renderer: Apple M1 Pro`), by the pan test. That bounds nothing for a mid-range phone.
- **The scripts and the results** are on `pr-screenshots`, `claude/547-the-look/measure/v2/`, with version 2's frames in `claude/547-the-look/mockup-v2/`. Version 1's are in `measure/` and `mockup/`.

## Dark mode today, and the theme setting (#323)

A theme setting in Settings (**Automatic**, **Light**, **Dark**, and perhaps **Match the map**, to decide later) already has its issue, #323; the idea and its evidence from finding 3 are there. The mock-up shows Match the map with D: the margin white round Maastokartta and black round the photos and the night map.

- **How dark is applied today:** both ways, with every dark rule written twice: `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` and `:root[data-theme="dark"] { … }` (`css/app.css:75–121`, again at 1913–1914 and 2024–2025). One dark rule has no attribute twin: the MapLibre buttons' icons (`filter: invert(1)`, line 445). Nothing in `js/` or `index.html` sets `data-theme`; only `tools/smoke.py` does. `js/palette.js:43` reads the colours again only when the device's preference changes, and `js/wxmap.js:876` asks `matchMedia` itself. `<meta name="theme-color">` is one green for both.
- **What the setting changes:** it sets `data-theme` on `<html>`, or leaves the device to decide. The cleaner way keeps the dark values in one place: a few lines in `<head>` always set the attribute (from the setting, or from the device for Automatic, and again when the device changes) before the first paint, and the `@media` copies go; `palette.js` and `wxmap.js` follow the attribute.
- **Recommended: the setting lands before #547's build,** with the dark values moved into one block, so #547 changes them once. The other way round, #547 edits both copies and #323 then moves them.
- **PRODUCT.md** would say (Accessibility & Inclusion): "Light or dark is the person's choice: Automatic follows the device and is the default; Light and Dark in Settings set it for Polku alone, on this device."

## The build, after the choice

- `DESIGN.md` and `css/app.css` change together: the chosen direction's values on `:root` with their dark versions, and one rule naming which surface takes which material.
- **If D:**
  - **No glass.** The frosted surfaces turn solid, `backdrop-filter` goes, and #382's reduced transparency has nothing left to do for them.
  - **The planner's sheet and the desktop's panel** lose their inset and corners and meet the screen's edges.
  - **The map's window** (its rounded corners and neatline) is drawn over the map.
  - **The map's buttons become one bay,** a new control for DEVELOPING's "Shared controls" after the user's OK.
  - **DESIGN.md's North Star** ("Everything else floats over it on frosted cards") is rewritten.
  - **First, the next round:** win back the phone's room for the map (above). Check Finnish words in the bays at 200 % zoom.
- **If B:**
  - **The glass** as two values per weight (a background and a filter) rather than `--surface`, which `.zoom-hint`, `.fab-layers[aria-expanded]` and `.track-card` use without a blur.
  - **Safari before 18:** `-webkit-backdrop-filter` is only on `pl-tools` today, so every other frosted surface shows no blur there. The build writes both properties wherever the glass is.
  - **#382's §7** (reduced transparency and more contrast for every surface) in the same PR. `prefers-reduced-transparency` today turns only the layer drawer solid (`.qd`, `css/app.css:681`), and nothing answers `prefers-contrast: more`. Settings' **High contrast** takes the more-contrast look too (#382, the user's choice 5).
  - **A check over the map** in `tools/smoke.py`. The contrast sweep composites the glass over the page's own colour, never the map ([Text over the glass](#text-over-the-glass)), so a lighter glass needs the mock-up's measurement in the suite.
  - **A pan test on a real phone first.**
- **Either way:**
  - The JavaScript's colours that would follow the route's magenta or the new state colours are typed in `js/style.js`, `js/chart.js`, `js/icons.js` and `js/cards.js`, among colours that must not follow (the fairway marks, ship types). The build lists which move.
  - **Order:** #323 first (above; with D, Match the map is decided there), and after #543 (the desktop toolbar), which changes `pl-tools`.

## Version 1, the first set

Built on 2026-10-28 at 5124e3b, and still in the mock-up behind the **Version** switch. Today and three directions, A, B and C, each complete.

| | Today | A, field instrument | B, clear water | C, paper map |
|---|---|---|---|---|
| **Thin glass** (top bar, map buttons, toolbox) | white 94 %, blur 10 px | white 78 %, blur 16 px, saturate 160 % | white 58 %, blur 20 px, saturate 180 %; dark: near-black 67 % | paper `#faf7f0` 95 %, blur 12 px |
| **Thick glass** (planner, card, drawer) | white 94 %, blur 14 px; the card solid | white 97 %, blur 24 px | white 68 %, blur 32 px, saturate 180 %; dark: near-black 73 % | the same paper |
| **Edges** | none | two-tone hairline: white 70 % inside, `#101814` 55 % outside; dark: white 34 %, black 70 % | the same, with a bright top edge | the same in warm paper and brown-black |
| **Route** | `#e11d48` | `#d6006e` | `#ee1d5c` | `#b0267f` |

**What each cost.** The lowest contrast over all four maps, phone and desktop (`claude/547-the-look/measure/mockup-matrix.json`), light · dark:

| | Today | A | B | C |
|---|---|---|---|---|
| `--text` | 13.6 · 10.0 | 10.1 · 6.9 | 6.8 · 7.1 | 12.8 · 9.4 |
| `--muted` (on glass) | 4.75 · 4.68 | 4.90 · 5.05 | 4.92 · 4.85 | 5.51 · 5.08 |
| Icons | 3.3 · 3.3 | 5.2 · 5.0 | 4.6 · 4.1 | 5.1 · 5.1 |
| Edges at 3:1 | 75 % · 34 % | 99 % · 97 % | 99 % · 97 % | 99 % · 97 % |

**What the critique of version 1 found** (Impeccable's critique at 5124e3b, its two assessments separate; the user's summary, 2026-10-28):
- **B was the strongest start:** no other direction let the map show through. But its saturation tinted the reading surfaces in pale map colours:
  - over Maastokartta the sheet ran pink to cyan and the 3D button was a strong pink;
  - in dark the sheet went maroon and teal;
  - over the forest photo, light B went grey;
  - each map button took a different tint.
- **A and C looked almost like today at phone size:** A differed by its edge, C by a warm tint. A's magenta was the best route colour; C's purple-magenta was worse than today's red.
- **In light mode the dark outer hairline read as an outline round a cut-out;** the dark-mode rim read well.
- **B's pink glass weakened the pink warning box,** and in dark B the chosen segment looked like a gap.
- **The two depths couldn't be told apart.**
- **Headless Chromium at 2× and 3× left part of B's phone sheet unblurred.** That isn't real (above).
- **The detector found nothing that told the directions apart;** its findings were about the mock-up page itself.

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

Impeccable's critique, its two assessments as two separate agents that didn't see each other's work, run three times on the app and the mock-up:
- on `main`: on 2026-10-27, by the session that started #547, and on 2026-10-28 for this review, with the same brief (the whole look, all 18 values, §12, §15, §16; phone and desktop, light and dark, the terrain map, aerial photos and the night map);
- on version 1 of the mock-up, by the user ([Version 1](#version-1-the-first-set));
- on version 2, blind to this plan ([above](#the-critique-of-version-2)).

The first two:
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
