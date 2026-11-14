# The design system, rethought: a voice for each kind of thing (#382)

A design round on Polku's whole layout and look, apart from the map: the planner, the top bar and search, Settings and Layers, the toolbar, the cards, and Polku's own web pages. Asked for on 2026-11-14, when the design system was set to run beside Calmer planner ([#869](https://github.com/TommiContursi/Polku/issues/869#issuecomment-6881674854)): Polku shows a great many numbers, meters, switches and buttons, and today they all look alike, so nothing stands out. The aim is a clear hierarchy, where a number, a value you set, an action and a heading are each told apart at a glance, outdoors, on a phone. Milestone: [Design system](https://github.com/TommiContursi/Polku/milestone/22). No app code is written in this round.

- **The mock-up:** [mockups/design-system-directions.html](mockups/design-system-directions.html), and on a phone the private Artifact [Polku design directions](https://claude.ai/artifact/9LDccat5kUXEy9PCSKH7ki). Today is `main`'s own markup, captured from the running app; each direction is one layer of CSS over it, so what the directions change is exactly what a build would change. **Direction** and **Screen** are in the bar at the foot; **More switches** has the typeface, light or dark, 360 px and 200 %, Finnish-length words, and **Label the kinds**, which tags every number, value, action, heading and warning so the hierarchy can be checked by eye. Its pictures are on `pr-screenshots` under `claude/design-system-round/`.
- **From:** `main` at 85876014, looked at on 2026-11-14 at 390 × 844 and 1440 × 900 with `tools/shoot.py` and the words and sizes read from the page; the brand drawings of #995; the open PRs #935, #723, #749 and #712; and two pieces of research on interfaces that handle dense numbers (below). Skills: Impeccable's shape, typeset and Operate rules; the worst cases (360 px, 200 %, Finnish-length words) checked by hand as break-ui would. emil-design-eng, apple-design, mobile-native and dataviz weren't run in this round: they review the chosen direction before its first build PR. Impeccable's concept roll wasn't used, since Polku's world (look B, #547) is chosen: as in #547, only how each kind of thing looks is open.

## Where it stands

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

Each step: its checks in `tools/smoke.py` first (the `controls` and `values` groups, and the `glass` group for anything on the glass), screenshots before and after, and DESIGN.md and DEVELOPING's Shared controls in the same PR.

## Not checked

- **A real phone:** the directions were looked at headless at 390 × 844, 360 × 740 and 200 % (195 × 422), light and dark, and in Finnish-length words; not on a phone in the sun.
- **Contrast of the new pairs:** the green value words on their soft well (the accent on `--accent-soft`, which Polku already uses for chosen chips) and B's spruce dark surfaces are drawn, not measured; the build's `values` and `glass` groups measure them.
- **The fonts' real cost:** the bytes are Google's files; Polku's own subset isn't cut yet. How the page looks while they load wasn't measured.
- **What the frames can't show:** they're the app's markup at one moment, so nothing in them works, and sizes the app's JavaScript sets (the peek's height, the profile) stay as captured; the full planner's profile wasn't drawn yet when captured, so its profile shows on the desktop and the peek only.
- **Not looked at closely:** the dark theme of every screen but the full planner in B and C, the desktop at its own size, the search frame in Finnish, the mouse in a narrow window.
- **The Artifact in claude.ai's viewer:** its page was checked headless as the viewer wraps it (no sideways scroll or errors at 360 and 390 px), but not inside the viewer itself.
