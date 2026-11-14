# The design system, rethought: a voice for each kind of thing (#382)

A design round on Polku's whole layout and look, apart from the map: the planner, the top bar and search, Settings and Layers, the toolbar, the cards, and Polku's own web pages. Asked for on 2026-11-14, when the design system was set to run beside Calmer planner ([#869](https://github.com/TommiContursi/Polku/issues/869#issuecomment-6881674854)): Polku shows a great many numbers, meters, switches and buttons, and today they all look alike, so nothing stands out. The aim is a clear hierarchy, where a number, a value you set, an action and a heading are each told apart at a glance, outdoors, on a phone. Milestone: [Design system](https://github.com/TommiContursi/Polku/milestone/22). No app code is written in this round.

- **The mock-up:** [mockups/design-system-directions.html](mockups/design-system-directions.html). Today is `main`'s own markup, captured from the running app; each direction is one layer of CSS over it, so what the directions change is exactly what a build would change.
- **From:** `main` at 85876014, looked at on 2026-11-14 at 390 × 844 and 1440 × 900 with `tools/shoot.py` and the words and sizes read from the page; the brand drawings of #995; the open PRs #935, #723, #749 and #712; and two pieces of research on interfaces that handle dense numbers (below). Skills: Impeccable's shape, typeset and Operate rules, emil-design-eng, apple-design, mobile-native, break-ui, the dataviz skill. Impeccable's concept roll wasn't used, since Polku's world (look B, #547) is chosen: as in #547, only how each kind of thing looks is open.

## Where it stands

- **Waiting for the user:** which direction, and which typeface (the fonts cost bytes: [The typeface](#the-typeface)).
- **Next, once chosen:** the build order in this plan, as small PRs, each tried on a phone. Calmer planner's steps 6 and 8 to 16 wait for this choice, not for its build (#869, 2026-11-14).

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

*To be completed from the mock-up: each direction's thesis, how each kind looks, what it costs and its risk.*

## The typeface

*To be completed: the fonts' bytes, how the page looks before they arrive, offline, the zero and the tabular figures in each face.*

## Not checked

*To be completed.*
