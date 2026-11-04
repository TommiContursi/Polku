# The route's list, rethought (#761)

A piece of the planner's content work ([#660](https://github.com/TommiContursi/Polku/issues/660), [its plan](issue-660-planner-content.md)). The mock-up: [mockups/issue-761-route-list.html](mockups/issue-761-route-list.html), today's list beside **Rows**, in a phone's sheet at 390 and 360 px, the desktop's side dock and bottom dock, with one sport, two sports and long Finnish names, at 100 % and 200 %.

## Where it stands

- **Decided (2026-11-04):** Rows, with the Add row; under the list two rows, Reorder and Reverse on the first, Clear route on the second; and the bottom dock's two columns. Open the mock-up with `?v=rows&foot=clear&add=on` to see it as chosen.
- **PR 1: built, PR #780** (2026-11-04). Two differences from the mock-up: a stretch is a target (36 px with a mouse, 44 px by touch, its line still 2 px), and a differing stretch's word is in the accent colour, as this plan says. A point's line keeps its label after a name (Via 2). A carry has no word of its own yet (#779).
- **PR 1 merged** (#780), and #782 fixed how Reorder moves a change of sport (#783).
- **Decided (2026-11-04): Parts 7**, the ninth round after PR 1 (below), to build. The rounds before it stay in the mock-up to compare.
- **PR 2: built** (2026-11-04), the line, the parts' colours and their headings, on `claude/761-line-build` after #784.
  - **As drawn in Parts 7,** with three differences: a route of one part keeps its own name (an import's or a picked loop's, #751) after its sport; the points' lines and a changeover's tag are still today's until PR 3; and "shaping points" stays in the unfold's label until PR 4.
  - **A carry** reads "Over water · carry 120 m" (#779).
  - **The map's changeover badge** is in the next sport's colour.
  - **Reorder** moved under the list already, first in the foot (where PR 5 puts it), since the heading took its row: at half on a phone the start and the first stretch stay in sight (#740, #764). While reordering, the same button is Done.
- **PR 3: built** (2026-11-04), the waits as parts of their own, on `claude/761-waits` after #789.
  - **As drawn in Parts 7.** Waits have their times, a night its sunset and sunrise (two new icons, `sunset` and `sunrise`), each part a start row, the points' lines Arrive and Leave with the weather's icons, and the warnings and the dark on the stretches.
  - **The sky's icon** uses the forecast's cloud cover, now carried along the route, by the timeline's own rule (`skyKind()`).
  - **The tooltips** are the app's own `tooltip()`, in words, so the weather is in words there, not icons.
  - **Unfolded waypoints** say the warnings on the way to them, as a stretch does, so a warning shows where it is (from testing, 2026-11-04). A stretch no longer counts one that ends where it begins.
- **Next:** PR 4, the words: waypoints, Waypoint n and Freehand.

## What the user asked for (2026-11-04)

The list should look more like Komoot's waypoints; a desktop should edit the name, the order, a point's removal and the sport in the list, as the first version did; the buttons under the list should be fewer (Komoot has Reverse); How you go and Your speed should be easy with one sport and still work with many.

## What the first list taught (2026-10-13 to 2026-10-25)

The list edited in place from fc13027: a name field on every row, a grip, Earlier, Later, Remove, the leg's settings and a stop's toggle as five small tools, Depart on the start's row, the leg's sport, mode and style in a row of their own. db75c9c (#475) replaced it with rows that open a card. The reasons, from the design review of 2026-10-17 and #233's plan: every row had five 28 px tools and 33 controls were under 44 px at half; editing one point took much of a phone's screen; the list didn't show the stretch to the next point, the weather when you get there or the warnings on the way. The user chose "rows open a card" over "the controls in the list" on 2026-10-20. Rows keeps that on a phone and gives the desktop its tools back only where a pointer hovers, two of them, where the › was.

## Rows

- **A point is a row:** its mark, its name, one line (when you leave or get there, the weather then, a stop, a night or a change of sport as its tag). No distance from the start on it; the stretch says how far. A tap opens its card, later its popup (#760).
- **A plain stretch is a line** between two points, with its numbers in small type and ⌄ where shaping points fold. A stretch that differs (a straight line, over water, a LIPAS route, an imported track, a carry) has its icon and its word first, in the accent colour, and its line in the accent colour too. A tap opens the stretch's card.
- **The sport's row** heads its section: the sport, with its route style and its speed as values ("Balanced · Normal, 16 km/h"), › to change them. With two sports each section has its own row and the point where the sport changes keeps its tag. How you go and Your speed leave the list's end; the toolbar's Route style stays for the next leg.
- **A desktop edits in the row:** hovering or focusing a point's row shows Rename and Remove where › was, 32 px each; the grip at its left drags the point. On a phone there's no grip and no tools (`pointer: coarse`): the row opens the card, Reorder works as today. The keyboard reaches Rename and Remove by Tab, since the tools show on `:focus-within`.
- **Under the list, two rows:** Reorder and Reverse on the first; Clear route on the second, in red, with Undo as today. Reorder leaves the sport's row. Round trip, Back to start and Import leave the list: ⋯ and the start's card have them.
- **The warning** is in the key fact's slot under the numbers (#741), not a box in the list.
- **The bottom dock** lays the rows in two columns, the sport's row and the foot across both (the mock-up's proposal for that dock only; the desktop docks have a piece of their own later).
- **The Add row** (Komoot's empty "Add a place" row at the end, with search, your location and saved places) is a switch, off by default: a question of #761, not part of the first PRs.

## Checked in the mock-up (2026-11-04)

With the design skills (Emil Kowalski's and Apple's rules, break-ui's worst cases): at 390 and 360 px a long Finnish name wraps to two lines and the row grows to 75 px, nothing leaves the sheet; at 200 % on a 390 phone the list's rows stay inside (the toolbar and the tabs are stand-ins and aren't drawn at 200 %), but the changeover's tag "Hike from here · changeover 5 min" takes four lines, as it does on main today; the tools are 32 px, which is right for a pointer and never shown to a finger; the sport's row wraps its values under its name at 360 px beside Reorder. Not checked: a night's row, a route of twenty points, Reorder's own view, dark and light side by side (the mock-up follows the system's scheme), the real cards.

## The second round (2026-11-04)

From trying PR 1 on a route of four sports (ideas from testing, 2026-11-04, on #761):

- The stretch's numbers were hard to read in one small grey line.
- Over water and Straight line said how they're drawn but a stretch along paths didn't.
- "Shaping points" should go, and Polku's points should be waypoints, as in Komoot.
- How the points and the route's parts connect was less clear than Komoot's one line through every waypoint.

The mock-up's **Line** (`?v=line&route=multi`) is main at 3db83e6 with this round:

- **One line through every waypoint.** It runs from the start to the end through every waypoint's mark (`--rail`, 3:1 against the sheet in both themes). Each stretch is the line between two marks, green where it isn't along paths, and the halves of a mark take its stretches' colours. Where the sport changes, the next sport's icon sits on the line as a node in its heading. The rule between two parts starts after the line, so it doesn't cut it.
- **The stretch's numbers to read.** They're its first line, in bold, as before #780. Under them, small: how it's drawn, with its icon, and the waypoints it folds ("Follow paths · 5 waypoints").
- **How every stretch is drawn.** "Follow paths" too, in the muted colour; a stretch that isn't along paths has its word and icon in green. The mock-up's switch shows the other way, as #780 does: only where it differs.
- **Said once:** a part of one stretch has no numbers under its heading, since its stretch says them.
- **Waypoints in the words.** The fold is "3 waypoints" and "Show the 3 waypoints". Elsewhere in the planner a point of the route is a waypoint too:
  - Reorder's hint, "Drag a waypoint, or move it earlier or later";
  - the map's "Add a waypoint here", "This waypoint is on the water…", "Waypoint added after…";
  - "Add at least two waypoints first", "Add another waypoint to make a route";
  - the cards' title "Waypoint".

  "High point" stays: it's the profile's. The checks in `tools/smoke.py` that read these words change with them.

**The third round, Parts** (`?v=parts&route=multi`, the same day). From looking at Line: a change of sport should be easier to see, and the parts shouldn't run into one line. Waypoints folded into a stretch were hard to notice ("5 waypoints" in grey, and then a mark numbered 1). Dashes and colour may help. Parts is Line with:

- **Each sport in its colour.** Its part of the line and the ring round its icon at the head of the part are in the sport's colour. That's `--sport-…`, which Colour by Sport already uses on the map and in the profile's strip. In dark mode the list takes lighter ones (orange-500, sky-400 and so on), since some of the map's are under 3:1 on the dark glass. A route of one sport keeps the grey line.
- **Every part's heading the same, the first too.** The sport's icon sits in a ring of its colour, on the line, in the marks' column. In Line the first heading had no ring and looked like something else.
- **The line breaks where the sport changes.** It goes into the changeover point in one colour, then dots lead past the rule between the parts to the next sport's ring. The changeover tag's icon is in the next sport's colour.
- **A straight line is dashed,** as on the map. A word saying how a stretch is drawn is in the text colour, bolder, not the accent's green: DESIGN.md keeps the accent for what's chosen.
- **Folded waypoints on the line.** Each one is a bead, three at most, and the words say which: "waypoints 1–5". The marks are numbered as on the map, so the point after five folded waypoints is 6.

Colour is never alone: the heading has the sport's icon and name, the changeover point its tag, the stretch its words.

**Decided on Parts (2026-11-04):**
- **"Waypoint 4"** for an unnamed waypoint, in place of "Via 4". It reaches beyond the list:
  - `label()` is `nameOf()`'s fallback, so it's also the name in an exported GPX;
  - the cards' second line;
  - Reorder's buttons, the aria-labels and the checks that read them.
- **How it's drawn on every stretch,** for now.

**The fourth round, Parts 2** (`?v=parts2&route=multi`, and `route=days` for two days). Waits, stops and nights should be parts of their own on the line. A point shouldn't say "Trail run from here" when the next part's heading says it. The line could do more on a desktop. Check's warnings, planned on 2026-11-04, belong on it too. Parts 2 is Parts with:

- **A wait is a part of its own.** A changeover, a stop or a night has its own row:
  - dotted on the line, with its icon: a clock, a pause, a moon;
  - its time: "Changeover · 5 min", "Stop · 20 min", "Night · go on at 08:00" with the morning's weather;
  - the gear left there: "Your bike stays here", Check's item, in its colour.

  A tap opens its point's card there. A changeover and a night sit between two parts, and the next part's heading names the sport, so the point's row loses its tag. A stop stays inside its part, which goes on in its colour after it. Main starts a new section at a stop; Parts 2 doesn't, so the sport isn't said twice.

**Parts 3 and Parts 4, the fifth and sixth rounds** (`?v=parts3`, `?v=parts4`). Every round is a version of its own in the mock-up, so the rounds can be compared. Parts 2 is as it was first shown.

From looking at Parts 2: the first part starts with a row, the start's ("Leave now · 2° · 3 m/s"), but a part after a changeover or a night didn't say when it starts.
- **Parts 3:** a part after a changeover or a night says when you set off, and the weather then, under its heading: "Go on at 10:06 · 2° · 3 m/s". Its wait says only how long it lasts.
- **Parts 4**, from looking at Parts 3: the heading's line didn't feel like a step.
  - **Its own start row.** A part after a changeover or a night starts with its first point's row, as the route does with its start's: the point where the last part ended, its mark, its name and "Go on at 08:00 · 4° · 2 m/s · Waypoint 4". The point is in the list twice, as you get there and as you set off, as a timetable has it.
  - **A wait says its times,** to be read without scanning: "Changeover · 5 min (10:01–10:06)", "Stop · 15 min (11:05–11:20)", "Night · 13 h (19:00–08:00)".
  - **A night has sunset and sunrise under it** ("Sunset 16:12 · sunrise 07:58"), the times Go and Check already work out on the device (`sun.js`).
  - **Freehand**, chosen on 2026-11-04.

"Leave now" stays, though it could be clearer (an idea from testing, 2026-11-04).

**Parts 5, the seventh round** (`?v=parts5`). From looking at Parts 4: far too much text; the times belong in the grey line, in plain words (arrive, leave); icons should make a point's line and a night's times quicker to read; the weather belongs in a desktop's tooltips too.
- **A point's line, at a glance.** "Arrive 10:27", "Leave 10:06" or "Leave now", then the sky and the temperature, then the wind, each with its icon ("☁ 2°", "≋ 3 m/s"). It replaces "There at 10:27 · 2° · 3 m/s · Waypoint 9". The sky's icon is the forecast's own: sun, sun and cloud, cloud, rain, snow, or the moon after dark.
- **No Start, End or Waypoint n on the line:** the mark says them, and the row's label keeps them for a screen reader.
- **A wait's times in the grey line,** under its name and length: "Changeover · 5 min" over "10:01–10:06".
- **Sunset and sunrise under a night,** each with an icon: "19:00–08:00 ↓16:12 ↑07:58". The two icons are new, a sun on the horizon with an arrow, drawn in the app's icons' stroke. The switch Sun times shows the app's moon and sun instead, but the moon is also a clear night's sky on a point's line and the night's own icon, so there it means three things.
- **A stretch's folded waypoints** are a count by its ⌄ ("5 ⌄") and beads on the line. Their numbers are in the button's label, not the stretch's words.
- **A part's heading is its sport,** and its day, with its numbers under it when it has more than one stretch. Its first and last rows already name its ends. A route of one sport keeps its "A → B", the route's name.
- **A desktop's tooltips have the weather too.** A stretch's: "2.56 → 4.34 km from the start", "10:06 → 10:27", "☁ 2° ≋ 3–4 m/s". A point's: "4.34 km from the start", "Arrive 10:27 · leave 10:37", and the weather then. The switch Hover shows one or the other.
- **The page itself scrolls now.** app.css holds the app's page still, and the mock-up had taken that over.

**Parts 6, the eighth round** (`?v=parts6`). From looking at Parts 5, the route of two days was right as it was.
- **Every part has its sport's totals.** They sit beside the part's name, in the text colour and bolder than a point's grey line, so they read as the whole part's: "Trail run · 984 m · 9 min · ↑39 m". This includes a part of one stretch. A route of one part has none there, since the route's numbers above say them (#764). On a narrow phone they wrap under the name.
- **A route of one sport looks like the others.** Its heading is on the line, the sport's icon in a ring of its colour, and the line is in its colour. "MTB · Start → End" beside Reorder is gone.
- **Sunset and sunrise use the horizon icons,** chosen on 2026-11-04.

**Parts 7, the ninth round** (`?v=parts7`). A route of one part has its totals in its heading too, though the route's numbers above say them. That's one style everywhere, chosen on 2026-11-04 over saying a number once, and it undoes #764's rule for that heading.
- **Check's warnings on each stretch,** in its row, with Check's own words, shapes and colours: "2 to read", "1 not checked". A switch adds "1 worth a look", which marks almost every stretch on a route at dawn. They stay out of the line's column, which already has beads, dashes and dots.
  - This undoes #741's "a section's warnings aren't in the list", so the build changes DEVELOPING's line on it and `sections`' "a warning once" check.
- **Waypoint n.**
- **The word for a straight stretch** is a switch: Straight line, Off paths or Freehand. Komoot's "off-grid" is theirs, and a straight stretch with folded waypoints isn't one straight line. The word is also:
  - the toolbar's mode name, its tooltip and shortcut;
  - the map's key, USING, and the checks that read them;
  - text that Finnish (phase 18) has to fit.
- **The stretch's tooltip on a desktop** says where the stretch starts and ends along the route and when you're there: "2.56 → 4.34 km from the start", "10:06 → 10:27". It's the app's own `tooltip()`, on hover and on focus, and only where a pointer hovers; a phone has it in the card. It brings no new motion.

**Ideas for the line, not drawn:**
- a mark's tooltip, its distance and time from the start;
- the stretches walked in the dark marked on the line, as Check's "In the dark for 5.75 km" counts them;
- On the way (23b) filling the line up to where you are;
- the map's changeover badge (`wp-sport`, green today) in the next sport's colour;
- sunset and sunrise in the weather timeline over the map, and the dark hours shaded there, so a route's night or dusk shows where its time is read (an idea from testing, 2026-11-04: not decided whether they belong there).

**The word for a straight stretch, elsewhere (looked up on 2026-11-04):** no planner's word is a standard. Most have a mode that follows the network, and its opposite:
- **Komoot:** "Follow ways", and with it off, an "off-grid" waypoint.
- **Gaia GPS:** Snap to Trail, Snap to Road, or **Straight Line**.
- **Garmin Connect:** **Freehand** in place of Follow Roads.
- **Strava:** a "manual mode".
- **Ride with GPS:** a straight-line mode, by its users' accounts.

"Straight line" is the most common, and true of each leg; "Freehand" says that you draw it and Polku doesn't route it, true too of a stretch with folded waypoints. "Off paths" would say something about the ground that may not be so, as when a straight leg runs along a path the router doesn't know. The proposal: **Freehand**, beside **Follow paths**.

**Open questions:**
- ~~Which word for a straight stretch?~~ **Freehand**, chosen on 2026-11-04.
- "Worth a look" in the list, or only in Check? Asked again from testing on 2026-11-04. Much of it the list already says its own way: Freehand's straight line, the gear left at a changeover, a short night; the stretch's card lists it all under Look out for.
- Waits as parts of their own (Parts 2), or a point's tag (Parts)? Each part's start: under its heading (Parts 3), or its own row (Parts 4)?

Not checked: Reorder's view, unfolded waypoints on the line, a night's row, the bottom dock (one column, as on main).

## The PRs from here

Each small, each tried on the phone before the next, in this order unless the user says otherwise (rewritten on 2026-11-04 when Parts 7 was chosen; the first list's PR 2, 3, 4, 5 and 6 are 8, 6, 7, 9 and 10 here):

1. ~~**The stretch as a line, a point as a row**~~, #780, merged.
2. **The line, the parts' colours and their headings** (built, 2026-11-04):
   - the line through every mark;
   - each part in its sport's colour, a route of one sport too, with the dark list's lighter colours;
   - each part's heading, the sport's icon in its ring, with its totals;
   - the stretch's numbers in bold over how it's drawn;
   - the beads and the count by ⌄, and the marks numbered as on the map;
   - a carry's word on its line (#779);
   - the map's changeover badge in the next sport's colour (an idea from testing, 2026-11-04).

   `pointRow()`, `stretchRow()`, `sectionRows()`, the CSS of `wpl-point`, `wpl-line` and `sec2-head`; `sections` and `multi`.
3. **The waits as parts of their own** (built, 2026-11-04):
   - a changeover, a stop and a night, with their times, and a night's sunset and sunrise (two new icons);
   - each part's start row;
   - the points' lines with Arrive, Leave and the weather's icons;
   - the tooltips' weather on a desktop;
   - Check's warnings on the stretches. This undoes #741's rule for the list, along with DEVELOPING's line and `sections`' "a warning once";
   - the stretches walked in the dark marked on the line, as Check counts them (an idea from testing, 2026-11-04).

   `sections()` (a stop no longer cuts), `sectionRows()`, the cards' openings; `sections`, `stops`, `multi`.
4. **The words:** waypoints, Waypoint n and Freehand across the planner: the toolbar's mode, the map's key, the cards, the toasts, an exported GPX's names, USING and the checks.
5. **The foot:** Reorder and Reverse, then Clear route in red. Round trip, Back to start and Import leave it for ⋯ and the start's card. Export GPX and Save offline stay where they are, on the toolbar and in More, so nothing is in two places (#745). Reorder's view shows each stretch's sport and a changeover as "MTB → Paddle · 15 min". `renderWaypoints()`'s `pointsFoot`, `reorderRows()`; `tabs`, `multi`.
6. **The desktop's tools in the row:**
   - Rename (the `name-field` in the row's place) and Remove, shown on hover and on focus;
   - the grip's drag from the list (today's `dragRow()` in Reorder).

   A phone keeps the card's Rename and Remove, and Reorder. `pointcard`-style checks for the hover and the keyboard, and that a finger never sees them.
7. **Each sport's How you go and Your speed from its part's heading,** out of the list's end: a tap on the heading, with a small ⚙ or › at its end, opens them (chosen on 2026-11-04). The heading has the totals now, so a round in the mock-up comes first.
8. **The Add row:** search, your location and saved places from the list's end.
   (Elsewhere: sunset and sunrise in the weather timeline is #788; the line filling up as you go is on #180, On the way.)
9. **The bottom dock's two columns.**

Not checked in the mock-up yet: Reorder's view, the bottom dock. Unfolded waypoints were built in PR 3 without a mock-up: a waypoint's row as any other, with its warnings.
