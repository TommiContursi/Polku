# The design system, rethought: a voice for each kind of thing (#382)

A design round on Polku's whole layout and look, apart from the map: the planner, the top bar and search, Settings and Layers, the toolbar, the cards, and Polku's own web pages. Asked for on 2026-11-14, when the design system was set to run beside Calmer planner ([#869](https://github.com/TommiContursi/Polku/issues/869#issuecomment-6881674854)): Polku shows a great many numbers, meters, switches and buttons, and today they all look alike, so nothing stands out. The aim is a clear hierarchy, where a number, a value you set, an action and a heading are each told apart at a glance, outdoors, on a phone. Milestone: [Design system](https://github.com/TommiContursi/Polku/milestone/22). No app code is written in this round.

- **The mock-up:** [mockups/design-system-directions.html](mockups/design-system-directions.html), and on a phone the private Artifact [Polku design directions](https://claude.ai/artifact/9LDccat5kUXEy9PCSKH7ki). Today is `main`'s own markup, captured from the running app; each direction is one layer of CSS over it, so what the directions change is exactly what a build would change. **Direction** and **Screen** are in the bar at the foot; **More switches** has the typeface, light or dark, 360 px and 200 %, Finnish-length words, and **Label the kinds**, which tags every number, value, action, heading and warning so the hierarchy can be checked by eye. Its pictures are on `pr-screenshots` under `claude/design-system-round/`.
- **From:** `main` at 85876014, looked at on 2026-11-14 at 390 × 844 and 1440 × 900 with `tools/shoot.py` and the words and sizes read from the page; the brand drawings of #995; the open PRs #935, #723, #749 and #712; and two pieces of research on interfaces that handle dense numbers (below). Skills: Impeccable's shape, typeset and Operate rules; the worst cases (360 px, 200 %, Finnish-length words) checked by hand as break-ui would. emil-design-eng, apple-design, mobile-native and dataviz weren't run in this round: they review the chosen direction before its first build PR. Impeccable's concept roll wasn't used, since Polku's world (look B, #547) is chosen: as in #547, only how each kind of thing looks is open. Round 5 starts from `main` at 0c5293c7, with most of those skills run (its section says which, and what was done by hand).

## Where it stands

**Round 5 (2026-11-14 and 15), drawn:** a fresh session, from the Hand-over on #382.
- **Done:** [what each element does on `main`](#round-5-what-each-element-does-on-main), at 12061f1f: the planner, the route's list and the cards, with what a tap, a hover, a drag, a hold, a right-click and the keys do. Then [round 5](#round-5-c-with-everything-the-planner-does), drawn on `main` at 0c5293c7, first in the mock-up's bar as **Round 5**.
- **Waiting for the user:** to try round 5 on a phone and choose:
  1. **Whether round 5 is the direction for the planner, its list and the cards. The recommendation is yes.**
  2. **Which scroll indicator. The recommendation is Polku's own,** the same thin bar everywhere; the browser's, made quiet, costs less and looks the same on a phone.
  3. **Which toolbar the worry was about:** a phone's, which `main` moves with the sheet (round 5 keeps it at the foot), or a desktop's, which moves with the panel's width and dock (round 5 leaves it as today).
- **Then:** the [build order](#once-chosen-the-build-order), from its step 1.
- **Decided by the user (2026-11-14):**
  1. ⌄ and ✕ stay at the top of the sheet and of a card, as on `main`, but not as raised keys, and on a row of their own, never beside the planner's or a card's heading.
  2. A leg's row gets its own ✎ for **Edit this stretch**, by touch and with a mouse; the rest of the row still opens the leg's card.
  3. The desktop keeps today's arrangement in round 5's look: the planner as a side panel, a card beside it, the toolbar at the map's foot. The toolbar moving with the sheet's size is a worry, though not the main one.
- **Also from the user:** a long-time wish that every window (the panel, the cards, Layers, Settings) can be moved and ideally resized, and above all that the profile can be opened big (added to #179). And Layers marks a chosen layer with a tick, which nothing else does.
- **Round 5 answers these:** on a phone the toolbar stays at the foot of the screen at every size, and the sheet sits on it (a reading of the worry, not the user's words); a desktop card has a move grip and a resize edge, and the profile opens big (a sketch, outside the choice); Layers' chosen tiles take the one chosen look.

**After round 4 (2026-11-14): the user's verdict, to build on in the next round**
- **Keep:**
  - the planner's head (the route's plate, the profile, When and the weather under it), without its ⌄ and ✕;
  - keys in a row that scrolls sideways, used for a card's actions too;
  - Reorder, Reverse and Back to start as keys;
  - Route style and Your speed as a grouped section;
  - the toolbar as a group of its own, apart from the sheet.
- **Not this:** the list of waypoints simplified to rows with a ›. In the app a list's legs are editable and its rows carry actions on hover, so the drawing lost what the elements do.
- **The next round starts from what each element does:** every control in the planner, the list and the cards, with what a tap, a hover, a drag or a hold does on `main`, before anything is redrawn.
- **Not discarded:** Optical glass and Liquid glass have good parts to carry on: Settings' grouped sections on frosted glass, the floating layer's depth, and the lit segments.
- **Also for round 5:** the scrollbars in today's planner and cards look poor (the user, 2026-11-14). A scrolling sheet or card needs a quiet scroll indicator of its own, in light and dark, with a mouse and by touch.
- **Next:** a fresh session (this one's context is long), from the Hand-over on #382.

**Round 4 (2026-11-14), after the user tried round 3:** Liquid glass's see-through buttons were hard to read, and the planner itself (the toolbar merged into the sheet's head, and the key facts as a stack of boxed rows) hurt in every direction. The glass worked well for Settings. The user chose to go back to C, much improved, with the planner properly redesigned.
- **Drawn:** [C, improved](#round-4-c-improved-the-planner-redrawn) below, first in the mock-up's bar (**C, improved**, with **Palette**). The planner at the peek and at full is new markup; the other screens are a CSS layer over `main`. Rounds 1 to 3 are behind **More switches**.
- **Waiting for the user:** whether this is the direction and the planner's arrangement. **The recommendation is yes**, then the typeface question.

**Round 3 (2026-11-14), after the user tried round 2:** Neo-brutalism didn't work for the app (its web page did). Optical glass was closer, but its plain white plates broke the glass, and only the buttons felt raised while everything else stayed flat, so nothing seemed to float. The user pointed to Apple's guidance for Liquid Glass and welcomed a new arrangement of the planner where it helps.
- **Drawn:** [Liquid glass](#round-3-liquid-glass) below, first in the mock-up's bar (**Liquid glass**, with **Palette**); round 2 and round 1 are behind **More switches**.
- **Waiting for the user:** whether Liquid glass is the direction. **The recommendation is yes, with Moss green to start**, then the typeface question.

**Round 2 (2026-11-14), after the user tried round 1:** round 1's plates were liked, but they broke the glass, and many controls were still hard to tell from the background (switches, rows with ›, text-only buttons, controls with a sentence of explanation under them). The user asked for two distinct directions, **Neo-brutalism** and **Optical glass**, as visual languages around the map rather than copies of their quick sketch.
- **Decided by the user:** the look plus the layout fixes it needs; solid panels in Neo-brutalism, glass in Optical glass; every control gets a visible edge (this reopens "green words" in the rule for controls of 2026-11-06); a control's explanation becomes a round ⓘ, a tooltip on hover and a tap on a phone, in Settings and Layers; both directions use #995's two typefaces, set differently; colours aren't held to the old rules in this round, so each direction has three palettes to try, light and dark.
- **Drawn:** [Round 2](#round-2-neo-brutalism-and-optical-glass) below, in the same mock-up (**Brutalism** and **Glass** in its bar, with **Palette**); round 1 is behind **More switches → Round 1**.
- **Waiting for the user:** which of the two. **The recommendation is Optical glass:** it keeps the map showing through, which round 1's plates broke, and every control now has a rim and a fill you can see. The alternative is Neo-brutalism, the clearest about what you can press, louder, and it hides more of the map.

**Round 1, for the record:**
- **Waiting for the user, one choice at a time.** A and B turned out to share one way of telling things apart (type, and green wells for what you set); B adds its typefaces, bigger numbers and a spruce dark. So the choice is two:
  1. **How things are told apart. The recommendation is C's plates and keys:** numbers on a solid plate, never on the glass, and everything you press a key, so a number and a control can't be mistaken in the sun; the sheet and panels stay glass. It costs the most CSS (every control's background and edge) and puts more solid blocks over the map. The alternative is A's type and wells, lighter and closest to today.
  2. **Then the typeface,** asked once the first is settled: the lean is #995's Bricolage + Atkinson (about 111 KB once, kept offline), with Atkinson alone (34 KB) or the device's own as the cheaper ways.
- **Not answered by this round:** layout. The glass cards stacked at the peek, the desktop toolbar's fifteen controls, the meters and the switches look the same in every direction: the next pass, on the chosen direction.
- **Next, once chosen:** [the build order](#once-chosen-the-build-order), as small PRs, each tried on a phone. Calmer planner's steps 6 and 8 to 16 wait for this choice, not for its build (#869, 2026-11-14).

## What's wrong today

Measured on `main` (the planner at full with a route of three sports, a point's card, Layers, Settings, search, and the desktop):

| What | Today |
|---|---|
| **One weight for everything** | The route's numbers 18 px bold; a row's name 15 px semibold; buttons 13–15 px semibold; the tabs 13.5 px semibold; the toolbar's mode 14 px bold. Nearly every word is 600 or 700, and the sizes sit within a few pixels of each other, so weight and size carry no meaning |
| **Units as loud as numbers** | "4.31 km": the unit is the figure's size and weight, so the eye reads a string, not a number |
| **Headings that look like labels, and rows that look like headings** | Section headings are 12 px grey capitals with tracking ("AT THIS WAYPOINT", "ON NOW", "BASE MAP", "ROUTES · LIPAS"). Settings' twelve groups are rows you open, drawn in the same capitals, so they read as headings with nothing under them. #767 asks for sentence case and nothing under 12 px |
| **Green does five jobs** | The logo, the sport (filled), Weather while it's on (filled), Plan (filled), and the values, folds, chips, switches and links. On the map's edge four filled greens compete, and Plan, the one main action, is one of them |
| **A value you set looks like a button** | "Leave now ▾" is a white pill like the card's **Move** and **Rename**; Follow paths ▾ is a grey box; Colour by is the browser's select. Nothing says "this is a setting, and this is its value" |
| **Glass on glass** | At the peek, the toolbar, the weather window and the sheet are three cards of one glass stacked over two thirds of a phone's screen, with nothing to tell which is which |
| **A dense desktop toolbar** | Fifteen controls of one weight in one row: Done, three values, undo and redo, six route actions, More |

The open PRs found the same, from use (#723, #712, #749): the departure as a caption with a dotted underline, a tool's state shown by fill alone while green also means the main button, and warnings repeated in many places.

## What other interfaces teach

Two pieces of research, run by subagents on 2026-11-14 (about 35 searches); "checked" means a primary page was read, "lead" a secondary source or a snippet. The notes are in the session's notes folder (`design-round-research-instruments.md`, `design-round-research-type-transit-web.md`).

| Source | What it does | For Polku |
|---|---|---|
| **Aviation:** FAA AC 25-11B, Garmin's glass cockpits (checked, the FAA; lead, Garmin) | One colour per kind of value, everywhere: what's measured is white, what the pilot set is one other hue, the active route magenta, cautions amber, warnings red. Minimise see-through behind numbers. Never colour alone | **What you set looks different from what Polku works out.** Their set-value cyan is Polku's water, so Polku's is the green it already gives to what you can tap. Numbers read at a glance on a solid ground |
| **Instruments and dashboards:** Stephen Few's bullet graphs, Tufte (checked) | A meter is one bold mark on a quiet track; a small strip beside a number beats a big chart | On the route's bars and the hour strip stay small and quiet, with one strong mark |
| **Weather apps:** Apple Weather, Windy, Yr (lead) | One hero figure; a second figure only when it matters | One big number per card, the rest quiet |
| **Marine:** Orca's dark mode (checked); ECDIS day and night palettes (not found) | Dark ink on near-opaque plates in sun; a heavier, cased route | The glance size's rule (on a solid surface, never on glass) applies to the route's numbers too |
| **Transit:** Transit 6.0 (lead), HSL and SBB (not checked) | The time to leave is the biggest thing; the chosen card is set apart | When and the arrival are figures, not captions |
| **Editorial charts:** Datawrapper (checked), FT and the Economist (lead) | Tabular, lining figures; no condensed type for labels; nothing under 12 px; bold only for titles | `tabular-nums lining-nums`; a narrow face only at display sizes |
| **Product systems:** Apple's type styles, IBM Carbon, Linear's redesign (checked) | Named roles, not sizes; one set for the app and a looser one for editorial pages; a display face for headings only; running text neutral, colour only for meaning | Roles named by what they're for, a fixed scale in the app and a fluid one on the web pages |
| **Web systems:** GOV.UK's type scale (checked) | Body 19 px, line heights in steps of 5 px, a tabular option | The help pages' and blog's base |

**What it adds up to:**
1. Name the kinds (a figure, its unit, its label, a value you set, an action, a heading, a state) and give each one look, everywhere.
2. The figure is the heaviest thing; its unit and label are smaller and quiet.
3. What you set is green with ▾ and a shape numbers never have; what Polku works out is ink.
4. One filled green at a time: the main action.
5. Headings are words in sentence case, bigger than the rows under them, with room above.
6. Numbers read at a glance sit on a solid ground, not on glass.
7. Meters: one strong mark on a quiet track.
8. Two sets of one system: fixed sizes in the app, fluid ones on the web pages.

## The givens, in every direction

Decided already, so no direction is chosen for them:
- **Sentence-case headings, nothing under 12 px** (#767), and the Small on Purpose Rule for the map's own small text.
- **Green means you can tap it** (2026-11-06), and the main action is the one filled green.
- **Magenta is the route, red is danger, blue is water and you;** never colour alone.
- **The rule for controls** (2026-11-06): what a control does decides its kind (a row ›, a value ▾, a button, green words ⌄, a switch, chips, a bare icon). This round decides how each kind looks, so they're told apart.
- **Look B** (#547): the two glasses, the edge, one shadow, the modes that turn the glass solid, the map first.
- **44 px targets by touch, 36 px with a mouse; tabular figures.**
- **Step 15 of the one order** (#869), now this milestone's: the dotted time words go, Clear route leaves the list's foot, and the toolbar gives Take it along to More first as it narrows.

## The directions

Drawn in the mock-up on the same screens: the planner at the peek (with the weather window) and at full, Check's On the route, a point's card, Layers, Settings, search, the desktop with its toolbar, and the main web page.

All three share the givens above and one markup change: a number's unit gets an element of its own, so it can be smaller and quieter than the number ("4.31 km" becomes 4.31 with a small km). Each is otherwise one layer of CSS over today's markup.

### A · Plain and exact

**Size, weight and colour each mean one thing, in the device's own font.** Look B stays as it is; what changes is what each size and weight is for.
- **A number:** 27 px bold on the planner, tabular; its unit at about 60 % in grey; its label 13 px regular under it.
- **A heading:** a word in sentence case, 15–22 px bold, in the text's colour, bigger than the rows under it. No grey capitals anywhere.
- **A row's name:** the text's weight (500), so a row reads apart from a heading (700) and a number (700).
- **A value you set:** green words with ▾ on a soft green well (When, Colour by, the toolbar's mode, sport and style, the top bar's sport); a row's value green before ›.
- **An action:** a button in words, white with a firmer edge; the main one filled green.
- **Costs:** CSS only, no bytes. **Risk:** it looks least changed, and Polku's web pages would still need a voice of their own.

### B · Field guide

**Polku's own two voices, from #995.** Bricolage Grotesque, narrow, for the numbers and the headings; Atkinson Hyperlegible Next for every word you read or tap.
- **A number:** 33 px, the glance size, in Bricolage at 86 % width, so three still fit a phone; the unit in Atkinson at under half its size.
- **A heading:** Bricolage, 17 px for a section, 24 px for a panel, 27 px for a card's title.
- **A row and a value:** Atkinson, 16 px regular for the name; the value green and bold, on the soft well.
- **The dark theme** takes the spruce of #995's palette (Kuusi) instead of near-black; the light theme's recessed grey becomes lichen (Jäkälä).
- **The dash** stays on the logo, the busy bar and the web pages. In the app a dashed edge already means "not known" (Check's dashed "?"), so it isn't used for decoration there.
- **Costs:** about 111 KB of fonts once, kept offline; DESIGN.md's typography rewritten. **Risk:** a display face in a working screen can feel loud; on a slow first load the text shows in the device's font until the files arrive.

### C · Plates and keys

**The material says what a thing is.** What you read at a glance sits on a solid plate, never on the glass; what you press is a key; the glass is left to what explains.
- **A number:** on a solid plate in cells, like an instrument's fields, its label over it in 12 px bold grey, the number 25 px heavy under it (the glance size's rule and the FAA's: no see-through behind numbers).
- **A value you set:** a key with its name over its value ("When" over "Leave now"), the value green.
- **An action:** a key with an edge and a lower lip; the main one filled green with a darker lip.
- **A heading:** 16–23 px heavy words in the text's colour.
- **The typeface:** Atkinson Hyperlegible Next alone, made for legibility (its zero is slashed).
- **Costs:** about 34 KB of fonts once; the most CSS of the three (every control's background and edge). **Risk:** more edges and solid blocks over the map, the opposite of look B's light glass, chosen on 2026-10-28 for showing the map through.

## Round 5: C, with everything the planner does

Drawn in the mock-up as **Round 5**, first in its bar; rounds 1 to 4 are under **More switches**. The planner at the peek, at half and at full, Reorder, a point's card, a stretch's card, Edit this stretch, the desktop and the profile opened big are new markup (`r5Doc()` in the build), and their taps work: a row opens its card, ‹ Route goes back, ✎ opens Edit this stretch, Reorder and Done, the grabber, ⌄, ✕ and Plan, and the menus. On the route, Layers, Settings and search are a layer of CSS over `main`'s markup, as in earlier rounds.

- **Kept from round 4:**
  - the head: the route's name, its plate (distance, time with the moving time under it, carry or climb, the warnings), the profile at the peek, When with "→ there at", the day's weather, and each sport's key fact as a key in a row that scrolls sideways;
  - Reorder, Reverse and Back to start as keys;
  - Route style and Your speed as a grouped section;
  - the toolbar apart from the sheet.
- **Back from `main`** ([the inventory](#round-5-what-each-element-does-on-main)), each part a timeline with the line in its sport's colour:
  - a part's heading with ⚙ opens its sport, speed and route style;
  - a waypoint's row opens its card, and stays lit while the card is open; under a mouse it shows Rename, Remove and its grip where › is;
  - a stretch's row opens This stretch's card, and its lines say how it's drawn, its warnings, and the dark;
  - **Show all waypoints**, a stretch's ⌄ 2 with its beads and shaping waypoints, and the list's settings;
  - a changeover's row opens its waypoint's card;
  - Reorder: every point with its grip, Earlier and Later.
- **The user's answers, drawn:**
  - ⌄ and ✕ stay at the top, on a row of their own with the grabber (and ⋯ for a card's settings, the dock on a desktop), never beside a heading. They're quiet icons, not keys: no edge and no lip, a soft fill only under a mouse or while held, 44 px to touch. This is the one exception to round 2's rule that every control has a visible edge, because they're the sheet's own handles, as the grabber is. With a mouse, ⌃ beside ⌄ raises the sheet one size, as on `main`.
  - A stretch's row ends in **✎**, a key that opens Edit this stretch at once; a tap anywhere else on the row still opens its card.
  - The desktop is today's arrangement: the panel at the left, a card beside it level with its row, the toolbar at the map's foot.
- **The toolbar on a phone stays at the foot of the screen** at every size, and the sheet sits on it, so Done and Undo never move. This is round 5's reading of the worry that the toolbar moves with the sheet's size. It costs the sheet the toolbar's height at full (as `main`'s docked toolbar does), and with a card open the toolbar keeps all its keys, where `main` leaves only Undo and Redo.
- **From rounds 2 and 3:** grouped sections on frosted glass (the profile, the route's styles and speed, a card's rows); the floating layer's depth (a lit rim, a contact shadow and a wide soft one) on opaque keys; the lit segments (Route and Check, Pass by · Stop · Night, how a stretch is drawn).
- **One chosen look:** Layers' chosen tiles lose their tick and take a chosen key's look, the accent's 2 px ring and its tint, as chips, segments and styles have; the ring's width says it, so it isn't colour alone.
- **The scroll indicator,** two kinds to choose between (**Scroll indicator** in the bar):
  - **Polku's own:** a thin bar, 4 px, in the panel's own ink at about a third, inset from the rounded edge and clear of the top row. It shows while you scroll, and fades a second after; with a mouse it also shows while the pointer is over the panel, widens to 8 px under it and can be dragged, and a click on its track jumps there. Nothing moves but its fade. It costs a small script, and the scroller's own bar is hidden.
  - **The browser's, made quiet:** CSS only (`scrollbar-width: thin`, the same ink, no track), with the scroller inset from the rounded corner. A phone shows its own indicator while you scroll, so on a phone the two look alike; the difference is in a desktop window.
  - Either way, where content scrolls under the top row it fades out over 16 px rather than meeting a line (Apple's scroll edge).
- **Rows that scroll sideways** (a card's actions, the key facts, the list's foot) fade where more continues; with a mouse they get arrows at their ends and the wheel moves them, as the weather card's hour strip does.
- **Movable windows, a sketch outside the choice** (#179): on the desktop the card beside the panel has a move grip and a resize corner, and **The profile, big** opens the profile as a window that moves and resizes, with its wind and gusts labelled and a readout under the pointer.
- **What it costs to build:** the most CSS of any round (keys, the plate, sections, the chrome row); markup for the plate's cells, a stretch's ✎, the cards' rows of keys and the desktop's chrome row; the toolbar's place on a phone in `js/planner.js`; and a small module for the scroll indicator, if it's Polku's own.
- **Skills run:** Impeccable's context and shape; grilling, for the three questions; apple-design (materials, depth, the sheet's scroll edge); emil-design-eng (presses at 97 to 98 %, nothing animates on first paint); mobile-native (hover only with a mouse, no tap flash; a build keeps the sheet's `overscroll-behavior: contain`, which the mock-up leaves out so a finger can go on scrolling the page); dataviz (the big profile: one axis, its wind, gusts and sports labelled, a readout); break-ui (below). **Done by hand:** Impeccable's critique, typeset and layout passes, in their terms but without their references loaded.
- **The worst case** (break-ui; **Words → Worst case** in the mock-up): Finnish-length words, a two-day route of 128.4 km and 14 h, 12 warnings, no terrain for the climb, the weather failed to load, and a timed departure on a date.
  - **Broke, now fixed:** the distance's unit ran into the next cell (the plate now moves its last cells to a second row rather than squeeze a number); the map's buttons climbed under the top bar over a taller peek (those that don't fit step aside, from the top); a lone "–" stood where a point's weather was missing (no line now: the head says the weather is missing); half was barely taller than the peek (half is now a clear step up).
  - **Held:** the failed weather says so, with **Retry**, and nothing looks complete; the 12 warnings; the long departure and arrival; long names wrap; the toolbar scrolls at 200 % with Done first.
- **Critique, on the drawn frames:**
  - a ✎ on every stretch adds a key a stretch, so a long route's list gets busier; if it reads busy on a phone, a quieter ✎ (no edge, like the row's ›) is the fallback;
  - the peek is taller than `main`'s (about 400 px against 296), since the head now holds When and the weather;
  - the key facts' row shows one key at 390 px; the second is a swipe away, hinted only by the fade;
  - the plate's third figure, "0 m carry", reads oddly on a route whose bike part climbs 40 m (noticed in round 4; not checked).
- **Checked headless:** 390 × 844 in light and dark; 360 × 740 and 200 % in Finnish-length words and the worst case; a phone's frame with a mouse; the desktop at 1440 × 900; every element of the inventory found in round 5's markup (83 of them, `check_r5.js` in the build); the sheet's sizes stepped by touch at 390, 360 and 200 % (the grabber, ⌄ to the line, the line, ✕ and Plan, a card from the list with its ⋯); the whole page at 360 px with its bar, which is now one row that scrolls sideways so it never covers a frame's foot; rounds 1 to 4 still drawn over the new capture.
- **Not checked:** a real phone; the Artifact inside claude.ai's viewer; the contrast of every pair, measured; reduced motion, reduced transparency and the keyboard's order in the frames; a stop and a night in the list (they share the changeover's row); Check's own content in this arrangement (its look is on the On the route screen); the warning's, a place's and the whole route's cards.

## Round 5: what each element does on `main`

Round 4 redrew the route's list as rows with a ›, and so lost what the list does. Round 5 starts from this inventory instead: every element of the planner, the list and the cards on `main` at 12061f1f, from `js/planner.js`, `js/cards.js`, `js/card.js`, `js/when.js`, `css/app.css` and `docs/USING.md`, and tried in the browser pane at 390 × 844 and 1440 × 900 with the three-sport route. A drawing keeps each of these, or says where it went.

**Widths and pointers.** Up to 720 px the planner is a sheet from the bottom; from 721 to 899 px it's a bottom sheet a mouse can drag; from 900 px it's a side panel on the left, or a bottom panel when docked there. "Mouse" below means `(hover: hover) and (pointer: fine)`, at any width. Where a gesture isn't listed, it does nothing.

**Where it differs from what round 4 assumed:**
- The planner's head has no title and no ⌄ or ✕ of its own: ⌄ and ✕ are on the grabber's row (on a desktop, ✕ is in the numbers' row). The ⋯ on that row is a card's settings, shown only while a card is in the sheet.
- The list's foot is Reorder, Reverse, Back to start and Clear route. Route style and Your speed are rows under it.
- Take it along (Share link, Export GPX, Save offline…) is on the toolbar, in ⋯ More and on the whole route's card. There's no Save: the route is kept on the device by itself.
- Nothing in the list adds or inserts a point: the map does, and a card's Add a waypoint here, Add to my route, Start here and End here.

### The sheet and its head

| Element | Where | What it does | States |
|---|---|---|---|
| The sheet | Phone: folded, peek, half, full. Desktop: open, folded | A swipe from the grabber, the top rows, the head, the profile's top row, the tabs, or the list at its top moves it: a flick goes one size, a slow release to the nearest. From the line, a swipe down puts it away. A mouse grabs only the grabber, the line, the head or the tabs | The peek is 296 px or 40 % of the screen. Never grabbed from the profile, a grip or a Reorder row |
| The grabber, "Planner size: drag, or press to change" | Top row, middle; phone and mid widths | A press goes between the peek and the last open size; from the line it opens as it was. ↑ and ↓ step one size | Does nothing while a card is in the peek |
| ⌄ "Fold the planner to a line" | Top row, left | Folds it to the line. With a mouse it lowers one size instead, and ⌃ beside it raises one size | Only with a route of two points or more. On a desktop: ⌄ in the numbers' row folds to a line at the map's foot |
| ✕ "Put the planner away: your route stays" | Top row, right (phone); numbers' row (desktop) | Puts the planner away, or closes the card it holds. R toggles the planner | On a phone it's the only way to put it away: Plan is hidden behind the sheet |
| ⋯ Card settings | Top row, right, beside ✕ | Colour by, Colours on the map | Only with a card in the sheet that has settings |
| The line | Folded | Opens as it was (↑ too); its ✕ puts it away; a swipe up opens, down puts away | The warnings' count, the numbers, Routing…; with a card, its mark, name and two numbers |
| The numbers in the top row | Sticky, once the numbers scroll under it | — | The numbers and the route's name, for the eye only |
| Dock left or bottom | Numbers' row, desktop | Moves the panel and frames the route again | From 900 px |
| The panel's width grip | The side panel's right edge | Drag: 340 px up to 62 % of the window; ← → 32 px; double-click or Enter: narrow or wide | Desktop |
| The busy bar | The sheet's top edge | — | While routing, after 300 ms |

### The numbers, the key facts, the profile, When and the tabs

| Element | Where | What it does | States |
|---|---|---|---|
| Distance | Numbers' row | — | Tooltip |
| Time, "1 h 05 min · 40 min moving" | Numbers' row | Opens the weather card at Time on the way | Its line: moving time, "from 18:00" or "leave 19:19" |
| Climb, "↑ 40 m" (carry on a route with paddling) | Numbers' row | — | "↑? ↓?" with no terrain |
| The key facts | Under the numbers | A warning's row opens Check at the first unread one and its card; a climb lights its range; Unpaved colours by surface; a high point shows the profile; a sport's row lights its part in the list; the rest open the weather card | A row per sport on a route of several sports. Hidden under 520 px of height, where a count in the numbers' row opens Check |
| Colour by | Profile's top row | Way type, Wind, Temperature, Rain, Sport… | Chips instead of the select in a panel 1080 px wide or more |
| On map | Profile's top row | Colours the route line as the profile | A switch |
| A smaller or taller profile | Profile's top row, right | Compact or tall, remembered | |
| The profile | Profile | Mouse: a tooltip and a dot on the map; a click centres the map; a drag selects a range, which the profile and the map zoom to; Whole route zooms out. Touch: a drag scrubs; a double tap zooms. Ctrl and the wheel, or a pinch, zoom | A tap on it at a phone's peek opens the half |
| When, "Leave now ▾" | The trip's box (and the start's row, the start's card, the weather card) | Leave now, Leave at…, Arrive by…; with nights, the first and last day's. A phone's own picker; a field and Set on a desktop | A note under it: the time has passed, no forecast yet, Arrive by can't be met |
| "→ there at Sun 00:37" | The trip's box | — | "· leave 19:19" with Arrive by |
| A day's weather, "−1 °C · dry · in the dark ›" | The trip's box | Opens the weather card at that day (beside the panel on a desktop); with nights, frames the day on the map | Hidden until the trip has a time |
| Route and Check | Tabs | Switch; on a phone from the line or the peek they open the half. ← → | Check's badge: red ▲ and the count, else Good to know's count, "?" when not checked |

### The route's list

| Element | Where | What it does | States |
|---|---|---|---|
| Show all waypoints · 3 hidden, Fold all waypoints | Over the list | Unfolds or folds every stretch's waypoints | Only when a stretch folds some; not in Reorder |
| List settings | Over the list, right | Times: From start or Clock. Show: Warnings, Good to know, Drawing mode, Darkness, Weather, Speed | Also in Settings |
| A part's heading, with ⚙ | Top of each part | Its menu: Sport · this part (changes only its legs), Your speed and Change, Route style's chips and Fine-tune | The sport's icon in its colour, "Day 2 · MTB", "1.53 km · 9 min · ↑40 m". Several parts only on a route of several sports or nights |
| A waypoint's row: Start, 1, 2…, End | In a part | A tap opens the point's card (beside the panel on a desktop), and the row stays lit while it's open. A mouse lights its leg on the map and the profile and shows a tooltip (from the start, arrive and leave, height, grade, way, weather). ↑ ↓ to the next row, Enter opens, Alt+↑ ↓ moves the point, Delete removes it with Undo | A column of distance over time from the start (or the clock); the weather with Weather on; ›. After a changeover or night the point starts the next part again |
| Its tools: ✎ Rename, 🗑 Remove (red) and the grip | The row's right end, in place of › | Rename turns the name into a field (Enter keeps, Esc cancels); Remove removes it with Undo; the grip drags it in the list, with a drop line, one step of Undo | **A mouse only, while drawing, waypoints only.** By touch: the card, or Reorder |
| A stretch's row, "1.53 km · 9 min · ↑40 m" | Between waypoints | Opens This stretch's card; its **Edit this stretch** is one tap further. A mouse lights the stretch and shows a tooltip (times, speed, grade, way, wind, weather) | Its lines: how it's drawn (Follow paths, Freehand, Over water, its own line; a carry), up to three warnings, in the dark. Beads for folded waypoints, a moon where the dark starts. No tools on hover |
| ⌄ 3 (unfold) | A stretch's right end, when it folds waypoints | Shows each leg as a row, with its shaping waypoints between | |
| A leg's row, unfolded | Inside a stretch | Opens that leg's card; its Edit changes one leg | |
| A stop, "Stop · 30 min, 12:10–12:40" | After its waypoint | Opens the point's card, where it's set | Tooltip: where, when, the weather as you go on |
| A changeover, "Changeover · 15 min, 23:40–23:55, Your bike stays here" | Between parts | Opens the point's card | A route of several sports only |
| A night, "1 night · 12 h" | Between days | Opens the point's card | Sunset and sunrise; "Go on at 07:00" when not timed |
| Reorder | Replaces the list | Every point with its grip and Earlier ⌃ and Later ⌄. A mouse drags by the grip; a finger holds a row 0.45 s, then drags; each move is one step of Undo | "MTB → Paddle · 15 min" at a changeover |
| Reorder, then Done | The list's foot | Turns Reorder on and off | Two points or more; not in the route's view |
| Reverse, Back to start | The list's foot | Reverses the route; adds a leg back to the start, with Undo | Back to start not on a loop |
| Clear route (red) | The list's foot, last | Clears it, with Undo | Leaves the foot in this milestone (#869's step 15) |
| Route style, one row a sport | Under the foot | Opens the Route style step (‹ Route back): the whole route or a leg, presets, chips, Wet ground | The sport's icon in its colour, the style, › |
| Your speed | Under the foot | Opens the Your speed step | Its line: each sport's speed |

### The toolbar

| Element | Where | What it does | States |
|---|---|---|---|
| Done, or Edit in the route's view | First | Ends or starts drawing (E) | Hidden before the first point and in a round trip; off with one point |
| A phone's mode, "Freehand · Run ▾" | Phone | Draw the next leg (Follow paths, Freehand, Over water), Sport · the legs you draw next, Your speed, Route style's chips (P, S, W) | Narrows to its icon |
| Mode, Next leg, Route style | Desktop | Their menus | Each narrows to its icon as room goes |
| Undo, Redo | All | Ctrl or ⌘ Z, Ctrl or ⌘ ⇧ Z | Off with nothing to undo; hidden in the route's view |
| Reverse, Back to start, Share link, Export GPX, Save offline…, Clear route (red) | After Undo, as room allows | As named | Dropped from the last as room goes; never both here and in More |
| ⋯ More | Last | The route's name ("Kept on this device"); The whole route: Reverse, Back to start; Take it along: Share link, Export GPX, Save offline…; Round trip from the start; Import GPX or KML…; Clear route | Only what isn't on the bar. On a phone at 375 px: all of these |
| Where it sits | | Phone: floats above the sheet at the left, the map's buttons rise over it; docks as the sheet's first row at full or when there's no room; a card leaves only Undo and Redo. Desktop: 12 px from the panel, at the map's foot | One Tab stop; ← → move along it |

### The cards

| Card | What it holds and does | Closes |
|---|---|---|
| Any card | Phone: in the sheet, at its four sizes; at half and full a finger scrolls the card first. Desktop: at its spot (320 px) or beside the panel, level with its row, foldable to its title (⌄, ⌃). ‹ Route (or the card before) goes back one; ✕ closes; ⋯ its settings | ✕, Esc (one card back, then closed), the back gesture, a tap on the map, a swipe down from its line, or its thing going away |
| A point's card | Its name and "Waypoint 1"; there at, from the start, height; **Move**, **Rename** (a field and Save), **Remove** (red, Undo). At a via point: At this waypoint, Pass by · Stop · Night, and the stop's or night's minutes (−, +, typable), Go on at, Places to sleep nearby. Sport from here ›, Changeover −/+ and Take the bike along at a change of sport, Next stretch, to Waypoint 2 ›, the profile and On the profile; More for this waypoint: Start here, End here (or Reverse and Back to start at the ends) | Also opened by a marker's tap, hold, right-click or Enter; the marker drags to move the point while drawing |
| A leg's card, at a spot on the route | The way's name and kind, three numbers; Add a waypoint here, Avoid this spot, Other ways (a BRouter leg), its warnings, This stretch ›, What's here ›, Edit this stretch ›; More for this leg: On the profile, The whole route › | Opened by a tap within 24 px of the line (16 px with a mouse); a hold or right-click on the line opens Edit this stretch while drawing |
| This stretch, "Hämeenkatu → Waypoint 1" | Look out for (its warnings, each opening its card), **Edit this stretch** (the main action), On the profile | |
| Edit this stretch | Sport ›; How it's drawn: Follow paths or Freehand (Over water or Freehand on water; none on a line of its own); Route style ›; Other ways, Stop here, Avoid this spot, On the profile | One step of Undo for the whole stretch |
| The whole route | Share link, Export GPX, Save offline…; Round trip from the start, Reverse, Back to start, Import GPX or KML…; Clear route (red) | |
| A warning's | Its action (Avoid it, Retry, Use BRouter…), Got it or Mark unread, More for this warning; on a phone ‹ Previous, "2 of 5", Next › and All in Check › | |
| A place's (a search result, a point of interest, a LIPAS place) | The round row: Add to my route (green; Add a waypoint here within 30 m; Start a route here with no route), Avoid this spot, Share, Weather here; Part of a route ›, links, More for this place (Start here, End here, Round trip from here, Paddle from here, Copy, All OpenStreetMap details), Not right? | |

### What scrolls, and its scrollbar today

| What | Scrolls | Its scrollbar |
|---|---|---|
| The planner's sheet at half and full, the side panel | Up and down, under its sticky top row | **None set:** the browser's own, flush with the rounded edge |
| The tabs' body (when the sheet doesn't scroll as one), the start's steps and every card | Up and down | `scrollbar-width: thin` |
| The menus (⋯ More, List settings, a part's ⚙, When, the mode) | Up and down | None set |
| Layers and Settings | Up and down | None set |
| A round trip's loops, the timeline's layer chips | Sideways | Hidden |
| The weather card's hours | Sideways | Hidden, with arrows at its edges and a mouse drag |

**Not inventoried:** the forms inside Round trip and Marked routes, the speed editor's own controls, and the whole of the Route style step. Unsure: whether the list's ↑ ↓, Alt+↑ ↓ and Delete are meant to work in the route's view; the code doesn't stop them there.

## Round 4: C, improved, the planner redrawn

**What three rounds taught:**
- the numbers read best on a solid plate (round 1's C);
- a control reads best when it's opaque, with an edge (C's keys), not see-through (round 3);
- the glass works best as a panel holding grouped sections (rounds 2 and 3's Settings);
- the planner's trouble is its arrangement, so a new skin doesn't fix it.

**The planner, rearranged** (`plannerDoc()` in the build):
- **The toolbar is never part of the sheet.** It's one group of keys floating on the map at the thumb: above the sheet at the peek, at the foot of the screen over a full sheet. Today it docks into the sheet's head at full height.
- **The sheet's head is the route's plate:** distance, time and the warnings in one solid plate. The warnings cell is as decided for the Check card (#869, step 7), and ⚠ 1 opens it. Under the plate come the profile, as decided for the peek (2026-11-06), then **Leave now ▾ → there 21:36** and the day's weather. So the trip's box joins the head, and its frame goes.
- **No stack of boxed rows:** each sport's one standout fact becomes a key in a row that scrolls ("Steep descent", "Wind 5 m/s, gusts 7", "↑4 m"); a tap opens that part. This replaces the sports' rows of 2026-11-06.
- **At half and full height:**
  - the profile becomes a plate with its colouring as a key and **On map** as a switch;
  - Route and Check become one segmented key;
  - the list stays a timeline, grouped by part with each part's ⚙;
  - the list's foot keeps Reorder, Reverse and Back to start;
  - Route style and Your speed become a grouped section, as in Settings.

**The look:**
- Frosted panels holding grouped sections (from rounds 2 and 3).
- Opaque keys with an edge and a lip, the main action filled in the accent.
- The numbers on plates, labels over them; Bricolage for numbers and headings, Atkinson for the rest.
- Switches as solid tracks.
- Three palettes, in light and dark.

- **Checked headless:** the peek and the full planner in light, in dark (Lake ice blue), at 360 px in Finnish-length words and at 200 % (the toolbar's mode goes to its icon); the card and Settings in light and dark. No sideways scroll or errors at 360 and 390 px on the Artifact's page.
- **Not checked:** the desktop's planner in the new arrangement (its frame is still the CSS layer over today's panel), a real phone, contrast over every map and palette, and the Artifact inside claude.ai's viewer.

## Round 3: Liquid glass

From Apple's "Adopting Liquid Glass" (read 2026-11-14 through its documentation data):
- glass is "a distinct functional layer for controls and navigation", floating above the content, and used sparingly;
- no glass layered on glass;
- a half sheet is inset so the content shows round it, and turns more opaque at full height;
- related toolbar items share one capsule;
- lists sit in grouped sections with larger corners;
- headers are words, never capitals;
- the main action takes the prominent, tinted style.

The guidance gives no blur, opacity or shadow values; those below are this round's.

| | Liquid glass |
|---|---|
| **The floating layer** | The top bar, the map's buttons, the toolbar (one capsule, **Done** tinted inside it) and the weather window: clear glass with a lens rim (light top-left, soft bottom-right), a refraction shade along the bottom, a contact shadow and a wide soft one |
| **The planner** | An inset half sheet with 34 px corners, its glass tinted faintly by the palette; more frosted at full height, never plain white |
| **On the sheet** | No glass again: the key facts, the trip's box, On the route and the rows in grouped sections of a faint fill; the route's list stays a timeline on the sheet |
| **Controls** | Filled capsules (When, Colour by, a card's Move and Rename, Remove tinted red); chosen chips and tiles an accent tint with an accent ring; the tabs and switches segmented capsules with a lit pill |
| **A switch** | A deep track; on, the accent; the knob a white pill that turns to glass while held |
| **Numbers and headings** | Bricolage 600–650, open; the route's numbers 38 px in columns with hairlines between them |
| **Settings and Layers** | Frosted panels, Settings' groups as grouped sections, explanations in ⓘ tooltips |
| **Palettes** | Moss green, Cloudberry orange, Lake ice blue, light and dark |

- **Checked headless:** the peek with the weather window, the full planner, the card, Settings, Layers in dark, the full planner in dark with the blue palette, and the desktop. The Artifact's page has no sideways scroll or errors at 360 px, at 200 % and in Finnish-length Settings in dark.
- **Not checked:** contrast over every map and palette, the blur's cost on a phone (it's stronger than look B's), a real phone, and the Artifact inside claude.ai's viewer.

## Round 2: Neo-brutalism and Optical glass

Both are again layers of CSS over `main`'s captured markup (`dirs2.js` in the build), with one more markup change: a control's explanation becomes a round ⓘ, its words in a tooltip. A row that opens something keeps its label alone, the explanation in its tooltip, so a tap on the row still opens it. In the build the ⓘ sits outside a switch's label, so tapping it doesn't flip the switch.

| | Neo-brutalism | Optical glass |
|---|---|---|
| **Character** | Sturdy, direct, a bit loud: trail signage and printed maps | Calm, luminous, exact: a compass's glass, lake ice |
| **Panels** | Solid paper with a 2 px ink edge and a hard 4 px shadow; no blur | One clear glass surface per panel, lit from above (a light rim along the top), stronger blur; its content on clearer, near-solid glass in grouped lists, never glass inside glass |
| **A control** | The same ink edge and a 3 px hard shadow on every one; pressed, it sits down and the shadow goes | A pale pill with a light rim; the main action and what's chosen a lit accent |
| **A switch** | A track with an ink edge; on, the accent with an ink knob | A deep track; on, the accent; the knob a lit bead |
| **A row that opens** | A tile with the ink edge; the route's list stays a timeline, its › a small key | A row in a grouped list with hairlines, its › in a round well |
| **Numbers and headings** | Bricolage 800, narrow and tight; numbers 34 px | Bricolage 600–650, open; numbers 36 px on their plate |
| **Palettes** | Signal lime, Trail marker orange, Lake blue | Moss green, Cloudberry orange, Lake ice blue |
| **The web page** | Ink-edged cards, a big narrow headline, the accent on the current page | Glass cards over a soft field of the palette's tint |

- **Checked headless:** every screen at 390 × 844 in both, Settings and Layers in light and dark, two palettes each, the web page; the Artifact's page has no sideways scroll or errors at 360 and 390 px. Fixed on the way: the sport button's icon on the new surfaces, the list's rows (kept a timeline), Settings' switch labels with their ⓘ, Neo-brutalism's chosen tiles and logo in dark.
- **Not checked yet:** 200 % and Finnish-length words in round 2, the contrast of every palette (the orange and lime palettes are tried against the old rules on purpose, see the [Colours](../../DESIGN.md#colors) they'd change), a real phone, and the Artifact inside claude.ai's viewer.

## The typeface

Today Polku uses the device's own font (`system-ui`: San Francisco on an iPhone, Roboto on Android, Segoe UI on Windows); Inter is named first in the stack but never loaded. #995 proposes two faces Polku would serve itself. The mock-up's **Typeface** switch puts any of them on any direction, and its **Typefaces** screen shows Polku's numbers and words in each.

| | The device's own | Atkinson Hyperlegible Next | Bricolage Grotesque |
|---|---|---|---|
| **Made for** | Each platform's interface | Legibility for low vision (the Braille Institute): letters that can't be mistaken for each other | Display: character, and narrow widths that give long Finnish words and big numbers room |
| **Bytes, once** | 0 | about 34 KB (one variable file, weights 200–800) | about 77 KB (optical size and weight variable, width fixed); about 131 KB with the width axis |
| **Tabular figures** | Yes | Yes (`tnum`) | Yes (`tnum`) |
| **The zero** | Plain | Slashed by design (no switch: neither face has a `zero` feature) | Plain |
| **å ä ö, → ↑ ⋯ °** | Yes | Yes | Yes |

- **The sizes are leads:** the Latin files as Google Fonts serves them, measured by download on 2026-11-14. Polku's own files, cut to the letters it uses, would be smaller; that's measured in the build.
- **Served by Polku:** from its own files, kept by the service worker with the app, so they work offline; no font host is asked.
- **Before they arrive** (`font-display: swap`): the text shows at once in the device's font and changes face when the files land, once per device. A fallback with matched metrics (`size-adjust`) keeps lines from jumping.
- **Where each would go:** Bricolage only at display sizes (headings, card titles, the big numbers), never for labels or small text (Datawrapper's and Carbon's lesson); Atkinson for everything read or tapped.

## Once chosen: the build order

A draft, made final with the choice. Each step is a PR of its own, tried on a phone before the next, and none waits for the web pages.
1. **The kinds as values:** each kind's size, weight and face on `:root` (`--font-figure`, `--font-unit`, `--font-heading`…), and a number's unit in an element of its own where the numbers are written (the planner's numbers, the list, a card, On the route). DESIGN.md's typography and Shared controls rewritten to the kinds.
2. **Headings and rows:** sentence case everywhere and nothing under 12 px (#767, step 15 of #869), Settings' groups as rows, the dotted time words gone.
3. **Values you set and actions:** the value's look (When, Colour by, the toolbar's mode, sport and style, the top bar's sport), buttons, and one filled green on the map's edge; Clear route off the list's foot, and the toolbar's Take it along to More first (#797).
4. **The typefaces,** if the choice has them: Polku's own subset files, `@font-face` with a matched fallback, kept by the service worker; bytes measured.
5. **Then Calmer planner's cards and list** (#869's steps 6 and 8 to 16) build on the rules, and #379's second audit checks the result.
6. **Polku's web pages** (main page, help, notes) and the showcase (#994) on the same values: a milestone step of their own.

**Round 5 adds,** if it's chosen, in the steps they belong to:
- step 3: the one chosen look (Layers' tick goes), and the quiet icons on the sheet's and a card's top row;
- step 5, with Calmer planner's cards and list: a stretch's ✎, the cards' actions as rows of keys, the toolbar at the foot of a phone's screen, the sideways rows' arrows, and the scroll indicator (its own small PR, with `/animate` for its fade);
- movable and resizable windows, and the profile opened big, stay with #179, after this milestone.

Each step: its checks in `tools/smoke.py` first (the `controls` and `values` groups, and the `glass` group for anything on the glass), screenshots before and after, and DESIGN.md and DEVELOPING's Shared controls in the same PR.

## Not checked

- **A real phone:** the directions were looked at headless at 390 × 844, 360 × 740 and 200 % (195 × 422), light and dark, and in Finnish-length words; not on a phone in the sun.
- **Contrast of the new pairs:** the green value words on their soft well (the accent on `--accent-soft`, which Polku already uses for chosen chips) and B's spruce dark surfaces are drawn, not measured; the build's `values` and `glass` groups measure them.
- **The fonts' real cost:** the bytes are Google's files; Polku's own subset isn't cut yet. How the page looks while they load wasn't measured.
- **What the frames can't show:** they're the app's markup at one moment, so nothing in them works, and sizes the app's JavaScript sets (the peek's height, the profile) stay as captured; the full planner's profile wasn't drawn yet when captured, so its profile shows on the desktop and the peek only.
- **Not looked at closely:** the dark theme of every screen but the full planner in B and C, the desktop at its own size, the search frame in Finnish, the mouse in a narrow window.
- **The Artifact in claude.ai's viewer:** its page was checked headless as the viewer wraps it (no sideways scroll or errors at 360 and 390 px), but not inside the viewer itself.
