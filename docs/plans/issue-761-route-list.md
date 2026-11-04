# The route's list, rethought (#761)

A piece of the planner's content work ([#660](https://github.com/TommiContursi/Polku/issues/660), [its plan](issue-660-planner-content.md)). The mock-up: [mockups/issue-761-route-list.html](mockups/issue-761-route-list.html), today's list beside **Rows**, in a phone's sheet at 390 and 360 px, the desktop's side dock and bottom dock, with one sport, two sports and long Finnish names, at 100 % and 200 %.

## Where it stands

- **Decided (2026-11-04):** Rows, with the Add row, Reverse and Clear route under the list, and the bottom dock's two columns. Open the mock-up with `?v=rows&foot=clear&add=on` to see it as chosen.
- **Waiting:** nothing; each PR below is tried on the phone before the next.
- **Next:** PR 1, after #774 (which takes the list's warning box into the key fact's slot).

## What the user asked for (2026-11-04)

The list should look more like Komoot's waypoints; a desktop should edit the name, the order, a point's removal and the sport in the list, as the first version did; the buttons under the list should be fewer (Komoot has Reverse); How you go and Your speed should be easy with one sport and still work with many.

## What the first list taught (2026-10-13 to 2026-10-25)

The list edited in place from fc13027: a name field on every row, a grip, Earlier, Later, Remove, the leg's settings and a stop's toggle as five small tools, Depart on the start's row, the leg's sport, mode and style in a row of their own. db75c9c (#475) replaced it with rows that open a card. The reasons, from the design review of 2026-10-17 and #233's plan: every row had five 28 px tools and 33 controls were under 44 px at half; editing one point took much of a phone's screen; the list didn't show the stretch to the next point, the weather when you get there or the warnings on the way. The user chose "rows open a card" over "the controls in the list" on 2026-10-20. Rows keeps that on a phone and gives the desktop its tools back only where a pointer hovers, two of them, where the › was.

## Rows

- **A point is a row:** its mark, its name, one line (when you leave or get there, the weather then, a stop, a night or a change of sport as its tag). No distance from the start on it; the stretch says how far. A tap opens its card, later its popup (#760).
- **A plain stretch is a line** between two points, with its numbers in small type and ⌄ where shaping points fold. A stretch that differs (a straight line, over water, a LIPAS route, an imported track, a carry) has its icon and its word first, in the accent colour, and its line in the accent colour too. A tap opens the stretch's card.
- **The sport's row** heads its section: the sport, with its route style and its speed as values ("Balanced · Normal, 16 km/h"), › to change them. With two sports each section has its own row and the point where the sport changes keeps its tag. How you go and Your speed leave the list's end; the toolbar's Route style stays for the next leg.
- **A desktop edits in the row:** hovering or focusing a point's row shows Rename and Remove where › was, 32 px each; the grip at its left drags the point. On a phone there's no grip and no tools (`pointer: coarse`): the row opens the card, Reorder works as today. The keyboard reaches Rename and Remove by Tab, since the tools show on `:focus-within`.
- **Under the list:** Reverse; with the switch on, Clear route at the other end in red, with Undo as today. Round trip, Back to start and Import leave the list: ⋯ and the start's card have them.
- **The warning** is in the key fact's slot under the numbers (#741), not a box in the list.
- **The bottom dock** lays the rows in two columns, the sport's row and the foot across both (the mock-up's proposal for that dock only; the desktop docks have a piece of their own later).
- **The Add row** (Komoot's empty "Add a place" row at the end, with search, your location and saved places) is a switch, off by default: a question of #761, not part of the first PRs.

## Checked in the mock-up (2026-11-04)

With the design skills (Emil Kowalski's and Apple's rules, break-ui's worst cases): at 390 and 360 px a long Finnish name wraps to two lines and the row grows to 75 px, nothing leaves the sheet; at 200 % on a 390 phone the list's rows stay inside (the toolbar and the tabs are stand-ins and aren't drawn at 200 %), but the changeover's tag "Hike from here · changeover 5 min" takes four lines, as it does on main today; the tools are 32 px, which is right for a pointer and never shown to a finger; the sport's row wraps its values under its name at 360 px beside Reorder. Not checked: a night's row, a route of twenty points, Reorder's own view, dark and light side by side (the mock-up follows the system's scheme), the real cards.

## The PRs after the decision

Each small, each tried on the phone before the next, in this order unless the user says otherwise:

1. **The stretch as a line, a point as a row:** `js/planner.js` `pointRow()`, `stretchRow()`, `sectionRows()`; the CSS of `wpl-point` and `wpl-strow`; the check in `tools/smoke.py` `sections` or `tabs` (the rows' order and words, the fold).
2. **The sport's row with its values,** and How you go and Your speed out of the list's end: `sectionRows()`'s head, `renderHow()`/`speedRow()`, `openStep('how'|'speed')`; `keyfacts` or `sections`.
3. **The foot: Reverse and Clear route,** Round trip, Back to start and Import gone from under the list: `renderWaypoints()`'s `pointsFoot`; `tabs`.
4. **The desktop's tools in the row:** Rename (the `name-field` in the row's place), Remove, the grip's drag from the list (today's `dragRow()` in Reorder): `pointcard`-style checks for the hover and the keyboard, and that a finger never sees them.
5. **The Add row:** search, your location and saved places from the list's end.
6. **The bottom dock's two columns.**
