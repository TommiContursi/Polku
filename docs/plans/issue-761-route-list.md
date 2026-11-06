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
  - **Worth a look** is counted too, and twilight said as the dark is: "300 m after sunset", "before sunrise", with their icons, on a line of their own under the warnings (chosen from testing, 2026-11-04).
- **PR 4: built** (2026-11-04), the words, on `claude/761-words` after #791.
  - **Waypoints** wherever the planner names a point of the route: the cards, the notes, the hints, Reorder, the start's views, the profile's empty note, an error from the router. "High point", the map's places and "point at" stay.
  - **Waypoint n** in `label()`, so in the cards, the list's labels, the notes and an exported GPX's names.
  - **How a stretch is drawn** in one style, Follow paths as strong as Freehand (from testing, 2026-11-04): the dashed line marks Freehand, so the word needn't. This undoes the list's "only where it differs" weight from PR 1.
  - **Freehand** for the mode: the toolbar's menu (still S, since F frames the route), Edit this stretch, the list, the map's key, the profile's way type and Check's item. What a leg is (a stand-in drawn straight while it waits for the router, the legs over the ice) stays "a straight line".
  - **The times** (from testing, 2026-11-04): the numbers row's time is the whole of it, waits too, with "8 min moving" under it where waits make a difference (over days too, in place of "2 days"); a part's heading adds its stops, "8 min + 30 min stop". Its tooltip said the waits were in the time over days, when it showed only the time on the move; now they are.
  - (Elsewhere: Go's contents where the route says them, and maybe no Go tab, is #794; the map's route line in the list's style is #793.)
- **PR 5: built** (2026-11-04), the foot, on `claude/761-foot` after #792: Reorder, Reverse and Clear route in one row, Clear route a red button at its far end (`btn danger`, a new shared control; from testing, 2026-11-04, in place of the mock-up's two rows and its red text), on a line of its own at 360 px; Round trip, Back to start and Import in More and the cards only; Reorder's rows with the start's sport and each change, "MTB → Paddle · 15 min" (drawn without a mock-up: its words were set from testing).
- **PR 6: built** (2026-11-04), the desktop's tools in the row, on `claude/761-desk` after #795 (#78's fix under it). All three on the right, where › is, in Komoot's order: Rename ✎, Remove 🗑 (red, the card's trash; ✕ is close in Polku), the grip ⠿ at the far end (chosen 2026-11-04: the route's line has the left, and Strava, Komoot and iPhone lists keep the grip at the right). No motion: the tools are there at once, and the grip's drag follows the pointer as Reorder's does (/animate).
  - **A stretch's tooltip** sits beside its whole row, so it no longer covers its ⌄ (a bug since PR 3).
- **Decided (2026-11-04), for later PRs:** "Show all" in the Waypoints header, in words, unfolding every stretch's waypoints at once beside each stretch's own ⌄ (PR 6c); a part's heading stays a heading, with ⚙ at its end for its sport's How you go and Your speed (PR 7); ⌄ keeps pointing down, the web's disclosure (⌃ once open; ‹ means back).
- **Being explored (2026-11-04): Parts 9,** a focused refinement of the timeline's hierarchy, from a brief after Parts 8. The list is a route timeline of several levels (sport parts, stretches, main waypoints, nested shaping points, events), and its continuous line, sport colours and markers should carry it, with indentation, spacing and typography; stronger backgrounds only for a selection or an active interaction, never on every waypoint; the › on waypoints and events removed if a phone can still tell that a row opens its card; the unfolding of shaping points kept apart from opening a card. Parts 8's tint and outlined region were the wrong emphasis, and its tint and the removal of › were taken back out of #799 until a treatment is chosen.
- **Being explored (2026-11-04): Parts 10,** from trying Parts 9: B's levels kept (the main waypoints, the stretches and the lighter, compact unfolded waypoints); a cue at rest that a waypoint or an event opens its card, since a press shows only once a finger is down, without › on every row or a large background; and the unfold control part of its stretch, not a button of its own stacked in the timeline. Komoot is the reference: each waypoint a hairline pill, "Show all 4 waypoints" quiet words between two of them.
- **Being explored (2026-11-04): Parts 11,** ideas from trying Parts 10 to make the timeline easier to read: when and how far on the left of the line, as a timetable, with no Arrive; the times as the clock's or from the start, a setting by the list (Komoot keeps its list's settings there; the map's marks already have both, in Layers); every waypoint the same row; no Follow paths, Over water or Freehand words when the line already says it; and warnings on the stretch only, since a waypoint's row opens the waypoint, not the warning. Many of the warnings in Helsinki were "Cycling not allowed here", from routes the MTB router takes through ways closed to bikes: #801.
- **Being explored (2026-11-04): Parts 12,** from trying Parts 11: the column's distance first and stronger, as the planner's numbers lead with it, and the time from the start by default; a stretch only what the column can't say (its warnings, a carry) and "Show 3 waypoints" as Komoot has it, its distance, time and climb in its card.
- **Being explored (2026-11-04): Parts 13,** from trying Parts 12: say the thing, not a count. The weather once for the whole trip, as Go sums it up, and on a stretch only where it matters; each warning named ("Fallen tree on the path", as a changeover's "Your bike stays here"), opening its own detail; the dark on the timeline (sunset and the dark as rows, the line shaded after it), not a red warning on every stretch.
- **Liked (2026-11-04): Parts 13, with Parts 14's detail:** a stretch with its waypoints folded counts its warnings, and unfolded names each between the two waypoints it's between; warnings and heads-ups can be hidden by a setting of the list's, beside its times. The aim is to add to the elements that work in production, not to redesign them: each step below changes one thing in the rows as built. The build is proposed under "The PRs from here" (6d to 6h); the order is the user's.
- **Decided (2026-11-04): build in small phases,** each a small change to the rows as built, tried before the next; the mock-up's later rounds are ideas to come back to, not a plan to build at once. Phase 1 moves only the distance and the time to the left of the line. Not sure yet: the dark's band, losing ›, the outlines, and smaller things; the weather summary is agreed, but not as a big box. "Show 3 waypoints" belongs on the line with a stretch's beads, its warnings under it (an idea from testing, not drawn yet).
- **Parts 15 (2026-11-04),** from trying Parts 14: the rows as built wherever they do the job. Parts 14 had lost a folded stretch's beads, a stretch's own row (the way into its card from the list) and its warnings' own style, and had drawn a weather row of its own where Go has one.
- **Decided (2026-11-05): Parts 16's Its legs,** an idea from testing: the list as a subway map, the waypoints its stations and every leg between two of them a row of its own, with its facts and its edits (below). The list may grow long: less text on the rows and a way to choose the details shown come later. **Built** on `claude/761-next-6d574e`, with #819 in it ("The PRs from here", Its legs).
- **Ideas from testing (2026-11-05):** a leg edited from its waypoint (its sport and how it's drawn are the leg's: today a waypoint's card has **Sport from here** and **Next stretch, to …** ›, three taps to Freehand); the beads as many as the stretch folds, not three at most; a switch over the list for the details shown on the waypoints and legs (the list's settings).
- **Chosen (2026-11-05):** Parts 17's named warnings on a leg and a bead for each folded waypoint, **built** on `claude/761-legs-words` (#838, after #820; "The PRs from here", 6f). Its waypoint's card that edits the next leg isn't built: what was asked for is editing on the leg itself, drawn as Parts 18 (below).
- **Decided (2026-11-05): Parts 19,** all of it, with plain words that skim: **Show all waypoints** and **Fold all waypoints**; **List settings** with Times (**From start**, **Clock**) and Show (**Routing**, **Warnings**, **Darkness**, **Weather**), and "Hidden items stay in Check and the cards."; a part's ⚙ with **Route style** and **Your speed**. Show all and the list's settings are **built** on `claude/761-list-settings` (#840; "The PRs from here", 6g). A part's ⚙ isn't: as drawn it's two taps to Route style or Your speed, where today's rows at the list's end are one, and nothing used today may take more taps (PRODUCT.md). "How you go" reads badly too: Route style, as the cards call it.
- **Waiting (2026-11-05): editing a leg on its row** (Parts 18's A, B and C) is decided when the cards are rethought (#690), with the cards. Not sure either whether a leg keeps how it's drawn in words ("Follow paths"): its line says it, and much of the rows' text could be hidden, by "less on a row" or the list's settings (a switch for the details shown).
- **Decided (2026-11-05), from trying Parts 19:** the list's settings with Warnings first and the only one on at first; Routing called **Drawing mode**; the same switches in Settings; Weather at every waypoint when it's on (it helps on a long route with few waypoints); a **Speed** switch, off at first, for each stretch's average, and the speed always in a stretch's tooltip. The list's tooltips as full as the profile's, and tooltips on stops, nights and changeovers. A part's ⚙ after all, with its sport too: one tap to a step with Sport, Route style and Your speed, the rows under the list kept for now so both ways can be tried. The Waypoints heading's ⌄ goes, and Show all waypoints gets a chevron of its own. Show all and Fold all get motion. Built in that order ("The PRs from here", 6h on).
- **Next:** PR 6b, a hold on any row opens Reorder with that waypoint picked up (phones and desktops), Remove in Reorder's rows, a short wiggle as it opens (stopped within the second; none with reduced motion), a buzz where a phone allows it, and a tap outside the list closes it (that tap does nothing else). Decided with /find-animation-opportunities and /animate, and /review-animations before it opens. It replaces the swipe to remove proposed first.

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

**Parts 8, the tenth round** (`?v=parts8`, 2026-11-04, from building PR 6). The list as built since PR 6, and from testing it: with no › on the rows, waypoints ran together, and a stretch's unfolded waypoints didn't read as being inside it.
- **The places you chose** (the start, a waypoint you see, a stop, a night, a changeover, the end) on a soft tint, one rounded block each; the stretches stay on the glass between them. A switch puts the › back on the tinted blocks only (`chev=tint`) or leaves none (`chev=none`).
- **A stretch's unfolded waypoints, nested in it** (the switch `nest`), one compact line each with when you're there, as a transit leg's stops are: in one outlined region with their stretch (`region`), indented under it (`indent`), or as built in #799 (`asis`, smaller and lighter rows of their own).
- **Show all** at the list's top unfolds every stretch at once (PR 6c); **the foot** in one row, Clear route a red button (#795).

The research behind it: nested timelines (the Maersk and Telerik design systems, shadcn's nested timeline) keep two levels, the parent as the trigger, the children folded and on a smaller line, and an expand-all; a shared region is the strongest cue that rows belong together, and a branch off a route's line would read as a side path.

**Parts 9, the eleventh round** (`?v=parts9`, 2026-11-04), a focused refinement of the timeline's levels over the rows as built after #799 (a fresh renderer with `sectionRows()`'s DOM and classes, so app.css draws it). Two treatments beside As built, no background but for a selection (the open card's row) or a press, nothing moving:
- **A, Weight and markers:** no › on waypoints and events; a main waypoint's name a step up (16 px), a stretch's numbers a step down (medium weight), its details muted; the unfold control apart from the row, under the stretch's words, "⌄ 3 waypoints" (a quiet chip, filled once open); unfolded waypoints the stretch's beads grown, small hollow rings on its line, one line each with their time; an event's title a step down.
- **B, Lanes:** A, with what's between two main waypoints one step in (a stretch, its control, an event) and its unfolded waypoints two, so the levels read down the left edge.
- **Switches:** a route of three sports with two changeovers, a stop, one stretch unfolded and two folded (`r9=journey`), or a long one of two days with a night (`r9=long`); a waypoint selected or nothing (`sel`); a row pressed by a finger (`press`), since a phone has no hover to tell that a row opens.
- **Not drawn:** the desktop's tools on hover (PR 6, as built), 200 %, Finnish words longer than these.

**Parts 10, the twelfth round** (`?v=parts10`, 2026-11-04): B, with two new switches, every combination drawn.
- **Opens:** a press only (Parts 9 B); **Outlined**, a main waypoint and an event in a hairline, the app's buttons' (`.btn`: 1 px, `--line`), no fill, a little apart, the route's line threading through them; or **Rules between rows**, the hairline the app's other rows have, after the line's column, a stretch with its control and unfolded waypoints one row. A selection (the open card's row, its soft accent) and a press (`--surface-2`) fill inside the outline, as built.
- **Waypoints in a stretch:** apart under it (Parts 9 B's chip); **its last line**, "3 waypoints ⌄" in the stretch's words' column and colour, close under its numbers and warnings (28 px to tap); or **at its row's end**, beside its numbers with its words.
- **Unfolded** (from testing, 2026-11-04: on main they're numbered as the waypoints around them, and Parts 9's rings made 1 and 2 look nothing like 3): rings (Parts 9 B); **numbered, compact**, the waypoints' own numbered mark on the line, so 1, 2, 3 read as one series as on the map, in one line in the stretch's words' column with a lighter name; or **as the others**, rows as main has them.
- **Proposed:** Outlined, with the control as the stretch's last line, and unfolded waypoints numbered and compact. The outline says what opens before a finger presses, as Komoot's pills do, with the app's own button hairline, so a background still means a selection or a press. Between two outlined places everything is the stretch's, its control and unfolded waypoints too. Rules are quieter but a row between hairlines doesn't say it opens (a phone's settings use them for rows that don't); at its row's end, the control squeezes the numbers at 390 px ("↑46 m" breaks).
- **Left open:** a stretch still tells that it opens only by its press (it's the way between, not outlined), and a compact unfolded waypoint too. The outline is the app's hairline, 1.3:1 on the light sheet and 1.6:1 on the dark one (2.1:1 and 2.6:1 with More contrast): quiet, and faint in bright sun. It's a stroke, not a fill, so a background still means a selection or a press, but it is on every main waypoint and event, which the brief for Parts 9 wanted to avoid.
- **For the build:** the control is 28 px tall and close under the stretch, so on a phone it needs a 44 px hit area that doesn't change its look, or a near miss opens the stretch's card. A desktop's waypoint rows are in `.wpl-ptrow`, so the outline goes on the row in it; the desktop's tools sit inside the outline (not drawn here).
- **Checked:** 390 and 360 px light, 390 dark, the side dock; the long route; a selection and a press. **Not drawn:** the desktop's tools on hover (PR 6), 200 %.

**Parts 11, the thirteenth round** (`?v=parts11`, 2026-11-04): Parts 10 as proposed, and:
- **When and how far, left of the line:** each waypoint's time over its distance from the start, right-aligned in a column of their own, with no Arrive or Leave (the start's has no distance). The column sits in the waypoint's outline.
- **The clock's or from the start:** a small switch over the list (`seg small`), "Clock" (09:15) or "From start" (15 min, 1 h 13), the latter with stops and changeovers, as the map's elapsed marks.
- **Every waypoint the same row,** unfolded ones too: numbered, outlined, its name and the weather where there is some.
- **How a stretch is drawn, by its line:** solid along paths and over water, dashed freehand (the hike's stretch here), as on the map; in words only for a carry ("Carry 120 m"). A screen reader still hears it in the stretch's name.
- **Warnings on the stretch only:** a waypoint's row no longer repeats the stretch before it.
- **A wait without its times:** the waypoint before it says when it starts; a stop says when you go on, in the column, since nothing else does (a changeover's and a night's next row does).
- **Checked:** 390 px light and dark, 360 px (no sideways scroll), both times, the long route. **Not drawn:** the desktop's tools on hover, 200 % (the column is 52 px: at 200 % it will need to wrap under the name).
- **Open:** from the start past a day reads "27 h 48" (days, or the clock's time with the day?); whether the switch belongs over the list or in the Waypoints heading with Show all (PR 6c).

**Parts 12, the fourteenth round** (`?v=parts12`, 2026-11-04): Parts 11, and:
- **The column:** the distance from the start on top in the strong weight, the time under it; from the start by default, the clock's by the switch ("From start" first).
- **A stretch:** its warnings and a carry only, in the stretch's column; folded waypoints as "Show 3 waypoints ⌄" / "Hide 3 waypoints ⌃"; with none of them, only the line between two waypoints. Its distance, time and climb are in its card, and in a desktop's tooltip.
- **What it costs:** a stretch's own length takes a subtraction and its climb a tap (the part's heading keeps its totals). A stretch with no warnings is no longer a row, so a phone opens its card (Edit this stretch, how it's drawn) from the map only; the waypoint's card could carry "the way here" instead, with #690.
- **Checked:** 390 px light and dark, 360 px (no sideways scroll; "58.2 km" fits the column), the long route. **Not drawn:** 200 %, a distance of three digits before the point (100.2 km), the desktop's tools.

**Parts 13, the fifteenth round** (`?v=parts13`, 2026-11-04): Parts 12, and:
- **A waypoint's row is its name.** Its weather moves to a desktop's hover (as now) and its card.
- **The weather once,** over the list: "Weather on the route", the trip's temperatures, wind and rain as Go sums them up (a line a day on a route of days), opening the weather. On a stretch only where it matters, in words: "Headwind up to 9 m/s", opening the weather too.
- **Warnings named,** each its own link to its detail (Check's item, the weather): "Cycling not allowed here", "Steps: carry the bike", "Fallen tree on the path", in Check's colours and icons. No counts to open first.
- **The dark on the timeline:** "Sunset 16:05" and "Dark from 16:55" as rows at their time (in the column, the time from the start), and from the dark on, one band behind the line. The dark is no longer a "to read" on every stretch. The band isn't the only cue: the rows say when it starts, and a waypoint after it says "in the dark" to a screen reader. (Here the three sports leave at 15:30, so the dusk falls on the route.)
- **Checked:** 390 px light, 360 px dark (no sideways scroll). **Not drawn:** sunrise (no morning in these routes), 200 %, the desktop's tools.
- **Open:** where the dark starts during a changeover, its row falls under the next part's heading; whether "dark" means civil dusk, as Go's "dark from" does; a route walked wholly at night would be one band from the start, with "Dark" at the top.

**Parts 14, the sixteenth round** (`?v=parts14`, 2026-11-04): Parts 13, and:
- **Folded, a count; unfolded, names:** a stretch whose waypoints are folded counts its warnings as built ("1 to read · 2 worth a look"); "Show 3 waypoints" (it works in the mock-up) unfolds them, and each warning is then named between the two waypoints it's between. A stretch with no waypoints in it names its own.
- **The list's settings:** a sliders button over the list opens the app's menu with Times (from the start, the clock's) and a toggle for Warnings and heads-ups (a changeover's gear and the wind too). Hidden, the list shows the route alone; the numbers' row over it still says what's to read before you go.
- **Checked:** 390 px light (unfolding, the menu, hidden), 360 px dark with the menu open (no sideways scroll). **Not drawn:** 200 %, the desktop's tools.

**Parts 15, the seventeenth round** (`?v=parts15`, 2026-11-04): Parts 14, with the rows as built wherever they do the job:
- **A stretch keeps its own row** (`wpl-strow`, `wpl-stretch`), so it opens its card from the list as it does now, with its line and its beads for the waypoints it folds. Its words are what Parts 14 says: its warnings in their own style (`wpl-warns`), counted while folded, named once unfolded or when it has no waypoints in it, and a carry.
- **A piece between two unfolded waypoints** with a warning is such a row too, and opens that piece's card (as the map's "Waypoint 6 → Survontie").
- **The trip's weather is Go's day** (`days`, `day`): its date and hours, distance, time moving and climb, and its weather; a card a day on a route of days.
- **Checked:** 390 px light, the long route at 360 px (no sideways scroll). **Open:** on a route of days, two of Go's days over the list take a phone's first screen; each day's could sit under its "Day n" heading instead.

**Parts 16, the eighteenth round** (`?v=parts16`, 2026-11-05), an idea from testing: the list as a subway map, the waypoints its stations and every leg between two of them a row of its own, with its facts and its edits. Drawn over the list as on `main` at 5084ea3 (after #806), by its classes, with the route from testing: MTB through four folded waypoints, a changeover, a paddle across, a changeover, MTB to Baana.
- **What the app already holds:** each leg has its sport, how it's drawn and its style; a stretch is a run of legs alike, folding the waypoints that only shape it (`keyPoint()`, `stretchAt()`); a stretch's card and Edit this stretch take any range ("its N legs"). An edit to one leg makes its ends waypoints you see, so the fold splits there.
- **As on main:** unfolded, the stretch's row stays, and each waypoint carries the warnings of the leg before it (`pointRow(i, { warns: true })`), so a leg inside a fold can't be opened or edited from the list.
- **Its legs,** with the answers picked for this round: unfolded, the stretch's row gives way to its legs, each a stretch row (`wpl-strow`, `wpl-stretch`) with its numbers, how it's drawn, its warnings and the dark, the first with ⌃ where ⌄ was, so nothing moves under the finger; the waypoints between them only their names and the column. Every leg is a row, one with nothing to say too. A leg opens its own card (Card: Leg 1 → 2's), a stretch of one leg, where Edit this stretch changes that leg alone.
- **The fold splits, as built:** Leg 2 → 3 set to Freehand makes Waypoints 2 and 3 waypoints you see; the stretch before them stays unfolded (the app keeps that by a stretch's first waypoint), and the one after starts folded.
- **A waypoint on the water** folds into the paddle's stretch, as on main, and unfolds into its two legs.
- **What it costs:** an unfolded stretch has about twice as many rows (11 for four waypoints, 7 on main), and "Follow paths" on every leg; "less on a waypoint's row" or the slim stretch could take it off later.
- **Checked:** 390 px light, 360 px dark with long Finnish names, 200 % at 360 and 390 px, the side dock with the card, the bottom dock: no sideways scroll; ⌄ and ⌃ fold and unfold in the mock-up. **Not drawn:** the desktop's tools on hover, Reorder.
- **Noticed:** #819, a stretch's end repeating its warnings once its folded waypoints are gone.

**Parts 17, the nineteenth round** (`?v=parts17`, 2026-11-05): Parts 16's Its legs, as built in #820, and from testing:
- **A leg says what its warnings are,** in Check's words, icons and colours, as a changeover says "Your bike stays here": "Cycling not allowed here", "Steps — carry the bike", "Busy road, about 9 000 vehicles a day", "Close to a marked rock or shoal". Each is said once, with its places counted ("Cycling not allowed here (2 places)"), in three lines at most ("2 more" after two, as its card lists them all). A folded stretch still counts them, now by Check's tiers ("5 to read · 1 worth a look"). This is Parts 14's rule (folded, a count; unfolded, names) on the legs.
- **The dark keeps its own line,** so Check's "In the dark for 1.45 km" isn't named on a leg again. Its card still lists it.
- **The beads,** one for each folded waypoint, evenly along the stretch's line, running together where there's no room (Route: Twelve folded); the count by ⌄ says how many.
- **A waypoint's card** (Card: Waypoint 2's): under Sport from here, which stays as it is, "How the leg to Postikuja is drawn", Edit this stretch's own switch for that leg alone (Leg 2 → 3 set to Freehand shows it chosen), then **Next leg, to Postikuja** ›, with its numbers and what to look out for, to that leg's card. As on main (Parts 16's Card: Waypoint 2's), **Next stretch** opens the whole stretch the waypoint is on, three taps to Freehand.
- **Checked:** 390 px light, 360 px dark with long Finnish names, 200 % at 360 and 390 px, the side dock with the waypoint's card, the bottom dock with the leg's: no sideways scroll, in the list or the card; Parts 16 draws as before. **Not drawn:** the desktop's tools on hover; a paddle waypoint's card (Over water and Freehand).

**Parts 18, the twentieth round** (`?v=parts18`, 2026-11-05): Parts 17's named warnings and beads, as built in #838, without its waypoint's card, and three ways to edit a leg on its own row, each shown on the leg to Waypoint 3. A tap on the row still opens the leg's card in all three.
- **A: a ✎ to Edit this stretch.** A ✎ at the end of every stretch's and leg's row, where › is on a waypoint's (the row tools' own `tool`, as #799's Rename), opens Edit this stretch for it at once: its sport, how it's drawn, its style, and Other ways, Stop here and Avoid. One tap to the card and two to change how it's drawn, where today it's three (the leg, Edit this stretch, the switch). On a phone it's always there; on a desktop maybe with the mouse over the row, as Rename is. A folded stretch's ✎ edits all its legs, as its card's Edit this stretch does, and ⌄ sits to its left, so nothing moves when it unfolds.
- **B: how it's drawn, a menu.** The leg's "Follow paths" is a button on its row (⌄ beside it), opening the app's menu there (`popMenu`'s `menu-item`): Follow paths or Freehand, then the leg's Sport and Route style, which go on to Edit this stretch's steps. Two taps to Freehand. Every leg has the button, and its row becomes two targets; with no room beside it (200 %), the menu is a sheet.
- **C: ✎ edits it in the list.** The ✎ opens Edit this stretch's own controls under the leg, in the list (how it's drawn, Sport, Route style), the route's line going on beside them, and Done closes them. Two taps to Freehand, and the list moves to make room; a card's narrow rules hold there (#384).
- **Checked:** 390 px light, 360 px dark with long Finnish names, 200 % at 360 and 390 px, the side and bottom docks, as tested and with a waypoint on the water: no sideways scroll; Parts 16 and 17 draw as before. **Not drawn:** a paddle leg's menu or strip (Over water and Freehand); the motion of B's menu and C's strip (/animate when one is chosen).

**Parts 19, the twenty-first round** (`?v=parts19`, 2026-11-05): the list's settings, every one discussed so far (Parts 11, 14 and 15; 6c and PR 7 below; testing on 2026-11-05), over Parts 17's list as built in #838:
- **Show all waypoints** (6c, decided) is a button over the list, in words, unfolding every stretch's waypoints; then **Fold them all**.
- **The list's settings** are the sliders beside it, opening the app's menu as Parts 14 drew it:
  - **Times:** from the start (the default) or the clock's, in the column.
  - **On the rows,** each shown or hidden: how each leg is drawn (its line shows it too: dashed Freehand, the water's blue); warnings and heads-ups, a changeover's gear too; sunset and the dark; the weather (at the start, a part's ends and a stop).
  - Hidden, they stay in Check and in each card, and the numbers over the list still say what's to read; saved as the map's marks are.
- **Details** on the bar are presets to compare: All (as built), Fewer (no how it's drawn, no weather) and The route alone (the waypoints, the legs' numbers and the waits).
- **A part's ⚙** (PR 7, decided), at its heading's end, opens a menu with its sport's **How you go** (its style) and **Your speed**, each going on to its step as today; they leave the list's end.
- **Checked:** 390 and 360 px, light and dark, with long Finnish names, 200 % at 360 and 390 px, both docks, each menu open, both times: no sideways scroll; Parts 16 to 18 draw as before. **Not drawn:** the menus' motion (/animate when built); where #755's speed in the numbers row meets the ⚙.

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
- ~~"Worth a look" in the list, or only in Check?~~ **In the list** (chosen on 2026-11-04, from testing), Check's quieter third, but for what the list says its own way: a straight line and a carry, the gear left at a changeover, a short night, and twilight, said as the dark is ("300 m after sunset"), so a route at dusk doesn't mark every stretch.
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
6b. **Hold to Reorder** (decided 2026-11-04): a hold on any row opens Reorder with that waypoint picked up, Remove in its rows, a short wiggle, a tap outside closes it (/find-animation-opportunities and /animate first, /review-animations before it opens).
6c. **Show all** in the Waypoints heading, in words.

In small phases from here (decided 2026-11-04), each one change to the rows as built, tried on the phone before the next; what each phase after the first holds is a proposal, from Parts 10 to 15:

6d. **Phase 1, the distance and the time left of the line** (built, 2026-11-05, after #805: from the start by default, the clock's time in the card, the tooltip and the label; at 200 % the line under the name), and nothing else: each waypoint's row, unfolded ones too, gets a column left of the line, the distance from the start over the time from the start (`lengthTo()`, `timesAt()`); the time leaves its line ("Arrive 22:03", "Leave now"), and its weather, warnings and › stay. The line, the parts' headings and the waits move right with it. The clock's time stays in the card and a desktop's tooltip until the list's settings, a later phase. Checked at 360 px, 200 % and with long Finnish names.

6e. **Its legs** (Parts 16, built 2026-11-05, with #819): unfolded, a stretch gives way to its legs, each a `stretchRow()` between two waypoints with its numbers, how it's drawn, its warnings and the dark, the first with the stretch's ⌄ (`folds`); the waypoints between them only their names and the column, no warnings (`pointRow()`'s `warns` is gone, and with it #819's repeat on a stretch's end). A leg opens its own card, and Edit this stretch there changes it alone; an edit to one leg makes its ends waypoints you see, so the fold splits there. The open card lights its rows by overlap (`litRows()`). Motion, decided with /animate: the legs come in with the waypoint at their start, on #802's `lg-in` (the first leg's words at once, its line and ⌃ still), and leave with them, faster; a fade with reduced motion; at once from the keyboard. `sections` checks it, and #819's check fails on `main`.

6f. **A leg names its warnings, and a bead for each folded waypoint** (Parts 17, built 2026-11-05, after #820): `warnsOn(s, named)` for a stretch of one leg, each of Check's unread warnings in its words, a line each, once with its places counted, the most serious first, two and "N more" past three lines, the dark not named (its own line says it); a folded stretch counts them as before; `stretchRow()` draws a bead for each folded waypoint. `sections` checks both.

6g. **Show all waypoints and the list's settings** (Parts 19, built 2026-11-05, after #839): in the Waypoints heading's row (where its summary is while the list is open, so the list starts no lower and the start and first stretch stay in sight at a phone's half, #764; over the list at 200 %), Show all waypoints and Fold all waypoints (6c), with no motion, and the sliders opening the app's menu: Times (From start, Clock) and Show (Routing, Warnings, Darkness, Weather), saved as the map's marks are (`listShow`). Motion decided with /animate: none, the menu's own. `sections` checks both.

6h. **The list's settings, as decided after Parts 19** (built 2026-11-06): Warnings first and the only one on at first, Routing called Drawing mode, Weather at every waypoint, and Speed (a stretch's average in Your speed's units, `speedWords()`); the same switches in Settings › Route's list (`LIST_SHOWS`, `setListShow()`). From trying it (2026-11-06): Worth a look on a switch of its own, on at first, and the menu with its name and ✕, a tap outside closing it alone (`popMenu()`'s `modal`). `sections` checks the defaults on a page of its own.

6i. **The list's tooltips as full as the profile's** (built 2026-11-06, after 6h): a stretch's times and speed, then the profile's facts over all of it (`stretchRows()`); a waypoint's times, height and the profile's tip at its sample (`sampleRows()`, shared with `ProfileChart.setHover()`); a tooltip on each wait. `tooltip()` takes `lines`. `sections` reads each line.

6j. **A part's ⚙** (built 2026-11-06, after 6i): on each part's heading, the app's menu as the drawing menu's next leg (its name and ✕, `modal`): Sport · this part (the sports in place; a pick changes the part's legs alone), Your speed with its editor in place, and the sport's Route style chips with Fine-tune. Not a step of its own, as first proposed: the drawing menu already does this job, so the ⚙ reuses it (`speedItems()`, `styleItems()`). The rows under the list stay, so both can be tried. The Waypoints heading doesn't fold; Show all waypoints has its chevron. `sections` checks both on MTB then Paddle.

6k. **Show all and Fold all move** (built 2026-11-06, after 6j, decided with /animate): as each stretch's ⌄, every stretch at once, each stretch's rows one after another (`unfoldIn` a set), leaving together (`foldOut()`, shared with the ⌄); the chevron turns at the tap; from the keyboard, at once. With it, #846: Show all no longer takes a phone's list to its top. Waits for /review-animations.

6m. **What acts, as chosen from Parts 20 and 21** (built 2026-11-06, after 6k): no heading over the list (the Route tab says it); Show all waypoints in green, its ⌄ first and how many are hidden in grey (`wpl-all`, B); a part's heading one button with its ⚙ at the end, its numbers under its sport (`sec2-head`); a stretch's ⌄ in green before its count in grey. Three new rows in DEVELOPING's Shared controls. The trip's weather over the list (Parts 21) is the next PR.

The phases after it, to be decided one at a time:

- **Less on a waypoint's row:** it no longer repeats the warnings of the stretch before it (#791's), and maybe its weather (to the card and a desktop's tooltip). Not sure yet: losing ›, and each row in the button's hairline (Parts 10).
- **The slim stretch:** its row stays, with its line and beads; its numbers leave its words for its tooltip and card, and how it's drawn for its line (a carry keeps its words; a screen reader hears both); folded, its warnings counted as `warnsOn()` does; unfolded, each named between its two waypoints (`itemsOn()` for each piece, as a row of its own); "Show 3 waypoints" as its last line in place of the count by ⌄.
- **The list's settings:** the sliders over the list, with the times (from the start by default, or the clock's) and Warnings and heads-ups, saved as the map's marks are. The numbers' row keeps the count to read.
- **The weather once:** Go's day (`days`, `day`) over the list, opening the weather; the weather off the waypoints' rows (a desktop's tooltip and the card keep it); on a stretch only where it matters, in words.
- **The dark on the timeline,** with Check: sunset, the dark and sunrise as rows at their time, and the band behind the line. Check's "In the dark" stops being a read on every stretch, which needs its own decision with Check.

7. **Each sport's How you go and Your speed from its part's heading,** out of the list's end: a tap on the heading, with a small ⚙ or › at its end, opens them (chosen on 2026-11-04). The heading has the totals now, so a round in the mock-up comes first.
8. **The Add row:** search, your location and saved places from the list's end.
   (Elsewhere: sunset and sunrise in the weather timeline is #788; the line filling up as you go is on #180, On the way.)
9. **The bottom dock's two columns.**

After PR 9 (chosen on 2026-11-04): the cards again (#690), with the toolbox that changes with each card on a phone (#797), and the profile as a tool on a phone (#796).

Not checked in the mock-up yet: Reorder's view, the bottom dock. Unfolded waypoints were built in PR 3 without a mock-up: a waypoint's row as any other, with its warnings.
