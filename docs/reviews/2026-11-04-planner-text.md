# The planner's text and hierarchy

Evidence for choosing the next small PRs under [#660](https://github.com/TommiContursi/Polku/issues/660), after its content-first direction ([issue-660-planner-content.md](../plans/issue-660-planner-content.md)). It decides nothing and changes nothing in the app. It goes through every piece of text the planner shows and asks of each: does a person need it at that moment, is it said elsewhere already, and what to do with it. It judges by use, not by taste.

**What was looked at,** on 2026-11-03: `main` at 1f6a4e0, served from a worktree on port 8842 (Done's new tooltip from #750 served there, absent from the commit before), routed by a local BRouter 1.7.10. Four routes near Kauppi, Tampere, and on Näsijärvi:

- **MTB,** four points tapped on the map, 3.78 km, leaving tomorrow at 10:00.
- **Evening,** the same route leaving at 16:50, so its last kilometre is after dark (dark from 17:05).
- **Multisport,** the same route, changed to Hike from its second point (a hold on the point, then Sport from here, then Hike).
- **Paddle,** three points tapped on the water, 9.13 km with a 364 m carry.

Each was seen at 390 × 844 by touch at the peek, half and full, in Route, Check and Go. The same routes were then seen at 1440 × 900 in the side dock and the bottom dock (peek, half and full).

**How:** headless Chrome through `tools/cdp.py`, with touch emulation and real touch events for every tap and hold. Claude Code's browser pane couldn't be used: this session wasn't open in a window, so the pane ran hidden and its screenshots failed. The evening departure was set by script after Leave's picker was opened by touch; the desktop's routes were restored from the phone's. A text dump of every node in sight (words, size, colour) backs the counts below. The lenses: impeccable's critique and clarify (cognitive load, one fact now and the next action, said once) for hierarchy and what's in sight at each size; unslop's copy and type passes for the grey lines and labels. Impeccable's scored critique wasn't run as written: it writes into the repo and ends on questions, and AGENTS.md's short form wins.

**Not tried:** a real phone, 360 px, 200 % zoom, dark mode, screen readers, round trips, nights and stops, a route of many points.

Screenshots are on the `pr-screenshots` branch under [claude/planner-text-review](https://github.com/TommiContursi/Polku/tree/pr-screenshots/claude/planner-text-review), numbered as below.

## How much is grey

Words on the phone, the MTB route. "In sight" counts the planner and its toolbox as they are at half, numbers and profile included; "the tab" counts the tab's own pane, scrolled through. "Grey" is the secondary text colour (`rgb(59, 71, 65)`).

| Tab | In sight at half | Grey | The tab | Grey |
|---|---|---|---|---|
| Route | 65 | 34 | 131 | 96 |
| Check | 66 | 33 | 475 | 231 |
| Go | 59 | 28 | 183 | 82 |

About half of what's in sight at any stop is secondary text, and nearly three quarters of the Route tab is. The other three routes are within a few words of these. This is the baseline the changes below can be measured against.

## What's in sight, by size

- **Phone, half, Route** ([01](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/planner-text-review/01-phone-route-half.jpg?raw=true)): the numbers, Hardest climb, the profile, the tabs, "WAYPOINTS 4", "Tap a point or a stretch to change it.", Reorder, "MTB · Start → End" and "3.78 km · 19 min · ↑73 m". No row of the route's list is in sight. The route's numbers are on screen twice, and a third time one row lower.
- **Phone, half, Check** ([02](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/planner-text-review/02-phone-check-half.jpg?raw=true)): Hardest climb under the numbers, then "HARDEST CLIMB ↑S2 52 m at 5 %" on two lines as the tab's first thing, then Worth a look and one item.
- **Phone, half, Go** ([03](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/planner-text-review/03-phone-go-half.jpg?raw=true)): Leave, There at 10:19, and the first row of the speed table.
- **Phone, full:** the toolbox, its action row, the numbers and the profile come first; the tabs start about 470 px down, of 844.
- **Desktop, side dock:** the numbers wrap to two lines beside the dock's buttons. Route shows the list. Go shows Time and its table; the weather is below the fold ([12](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/planner-text-review/12-desk-side-go.jpg?raw=true)).
- **Desktop, bottom dock:** the peek is the numbers and the one line under them. At half, Go puts Time, the weather and Take it along in three columns, and reads well ([11](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/planner-text-review/11-desk-bottom-go-half.jpg?raw=true)).

**The warning isn't where the phone has it.** On the phone the evening route's peek opens with "1 to read before you go · In the dark for 947 m" above the numbers ([05](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/planner-text-review/05-phone-evening-peek.jpg?raw=true)). In the bottom dock's peek there's no warning at all: the numbers and "Hardest climb" ([06](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/planner-text-review/06-desk-bottom-evening-peek.jpg?raw=true)). In the side dock the same row sits inside the route's list, between the part's header and Start ([07](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/planner-text-review/07-desk-side-evening.jpg?raw=true)). A desktop planner at its peek says the hardest climb of a ride that goes into the dark.

## The numbers row and the line under it

| Text | Needed now? | Said elsewhere? | Do |
|---|---|---|---|
| 3.78 km · 19 min · ↑73 ↓85 m, with distance · from Wed 4 Nov, 10:00 · ascent · descent | Yes, always | The part's header and the stretch row in Route, the Moving time row in Go | Keep. The other copies go (changes 2, 4) |
| "from Wed 4 Nov, 10:00", dotted, opens Leave | Yes: the only visible way to the departure from the peek | Go's Leave row | Keep. A chip is #660's later piece |
| Tooltip "Estimated moving time, with the wind · set the departure" | Yes: the only place the time says it's an estimate | No | Keep, or move "estimated" into sight |
| Paddle: 364 m carry, in the climb's place | Yes | Go's Carries row; Check's item says 355 m for the same carry | Keep |
| The warning row, "1 to read before you go · In the dark for 947 m" | Yes, it's safety | Check's tab count, the item | Keep on phones; give desktops the same (change 1, #741) |
| Hardest climb ↑S2, 52 m at 5 % (bikes) | Yes on a bike: it says how hard the route is | Check's first stat, Climbs' "Hardest:", the climb's "Hardest" tag | Keep here, cut the copies (change 3) |
| High point 127 m (a bike route with no climb; always on foot) | On foot, a summit matters. On a bike with no climb, no | The profile's top | On a bike with no climb, say "No climbs", or leave it to #742's strip |
| Paddle: Wind up to 5 m/s, gusts 8 · headwind 22 % | Yes, it decides whether you go | Check's first stats, Go's weather. Go says headwind 18 %, the key fact 22 % | Keep; one way of counting the headwind (noticed) |
| Multisport: MTB 1.95 km · ↑50 m, Hike 1.82 km · ↑46 m | Yes, the route's shape by sport | The list's part headers say ↑40 m and ↑38 m | Keep; the sums disagree: [#752](https://github.com/TommiContursi/Polku/issues/752) |

## Route tab

| Text | Needed now? | Said elsewhere? | Do |
|---|---|---|---|
| WAYPOINTS 4 | A heading, yes; its count, no: 4 points, 3 rows | The tab's name | Sentence case, "Waypoints" (change 9). The count can go |
| Tap a point or a stretch to change it. | No: the rows have chevrons | The cards | Cut (change 2) |
| Reorder | Yes, sometimes | No | Keep |
| MTB · Start → End, then 3.78 km · 19 min · ↑73 m · 4° · 4 m/s | With one part, no: it repeats the numbers row and the stretch row | Both | With one part, no header: the weather chip moves to the stretch row or the End row (change 2). With several parts (sports, days) keep it |
| Start · Leave Wed 4 Nov, 10:00 · 0 m | The departure yes; "0 m" no | Numbers row, Go | Cut "· 0 m" (change 2) |
| 3.78 km · 19 min · ↑73 m · Follow paths · via 2 shaping points | Yes | The numbers row, with one stretch | Keep |
| End · there at 10:19 · 3.78 km | The time yes; the distance is the total | Numbers row | Cut the distance on End (change 2) |
| Paddle: 9.13 km · 1 h 24 min · ↑10 m | The climb on water is the carries' 10 m | Check's "Carry ascent 10 m" | On a paddle part, the carry instead of ↑ (noticed) |
| Multisport: Via 2 · Hike from here · changeover 5 min · there at 10:09 · 1.95 km | Yes | The card | Keep |
| Round trip, Reverse, Back to start, Import | When building, yes | More, the toolbar's icons at full | Keep |
| How you go · The ways Polku picks for MTB · Balanced | A setting already made | The toolbar's "MTB · Balanced" | The plan's later piece ("the settings' home"). Its line can go now: it repeats the label |
| Your speed · 20 / 16 / 11 km/h · 600 m/h up · Normal | A setting already made | Go, word for word | One place: Go (change 4); the plan's later piece |
| Multisport: Your speed · "MTB: Normal · 20 / 16 / 11 km/h · 600 m/h up; Hike: Normal · 5 km/h on the flat" | As above | Go | As above |
| Tap the map to add points · drag a point… · hold the map for more | No | The first point's words, the tooltips | Already [#751](https://github.com/TommiContursi/Polku/issues/751) |

## Check tab

| Text | Needed now? | Said elsewhere? | Do |
|---|---|---|---|
| HARDEST CLIMB ↑S2 · 52 m at 5 % (the first stat) | No: the same line is 150 px above it, in the same view | The line under the numbers, Climbs | Cut on bikes; the tab opens with its verdict (change 3) |
| Paddle: Headwind 22 % of the distance · Strongest wind 5 m/s gusts 8 · Carry ascent 10 m | The wind is already under the numbers | Line under the numbers, Go | Keep the carry's climb; the wind once (change 3) |
| Read before you go · "What can stop you, turn you back or hurt" | The title yes. The line says what the red means once; a newcomer may need it | No | Keep the line (safety's meaning) |
| Not checked · "A source didn't answer: the route may miss something" | Yes, missing data says so | No | Keep |
| Worth a look · "Sections to know about" | The title yes; the line says nothing new | No | Cut the line (change 3) |
| Hard to follow for 104 m · at km 0.8 · 104 m | Yes; the length is said twice | No | Cut the second "104 m" (change 3) |
| All read | Yes | No | Keep |
| What Polku looked at: six sources, each with its source and time | When something failed, yes. When all answered, as one line | No | Keep every failure in full; fold the answered ones behind "Looked at 5 sources ›" (change 7) |
| Depths · shown on the map, never used for routes | Yes, the licence and safety | No | Keep |
| Nothing listed doesn't mean a way is open, safe or allowed… | Yes | No | Keep |
| Climbs 2 · Hardest: ↑S2, 52 m at 5 % · each climb with km, avg and max · Hardest tag · OSM-tagged | The list yes; "Hardest:" no | The line under the numbers | Cut the "Hardest:" line (the tag stays). "OSM-tagged" means a mapped incline: say so in words (noticed) |
| On the route 11: Terrain, Ground, Weather, each breakdown with "Use colours" | The breakdowns yes; "Use colours" on 11 headings no | Colour by | One "Selected" on the one in use; the rest are buttons with a tooltip (change 10) |
| Both: S0–S3 paths, then ↑S0–↑S4 climbs, then Not graded | No: it's MTB difficulty and Uphill difficulty again | Both of them | Keep as a colouring; its list can go (change 10) |
| Width and Visibility: "Road or track 2.07 km" | It's what isn't graded; the words don't say so | No | "Roads and tracks (not graded)" (change 10) |
| Temperature 0…5 °C 3.78 km · Rain: Dry 3.78 km | One bucket for the whole route says nothing a list needs | Go's weather | A single line, "0…5 °C the whole way", "Dry the whole way" (change 10) |
| The sources at 10.8 px, "Selected" and "Use colours" at 10 px | Legibility outdoors | | Nothing under 12 px (change 9) |

## Go tab

Go's pane holds 183 words on the MTB route. What a person uses before leaving: when to leave, when they're there, whether it's dark or wet or windy on the way, and taking the route along. What they rarely need: the speed table, the hours past their arrival, the same temperature twice.

| Text | Used before leaving? | Said elsewhere? | Do |
|---|---|---|---|
| TIME | A heading | | Sentence case (change 9) |
| Leave · Tomorrow, Wed 4 Nov · Now · 10:00 | Yes, the main control | The numbers row's "from …", Start's row | Keep |
| There at 10:19 · 19 min on the way | Yes | The tab's 10:19, the numbers row, End's row | Keep. When the route passes sunset or dark, say so here: "There at 17:08 · after dark" (change 6) |
| Paved 320 m 1 min 18.9 km/h · Gravel & unpaved · Trails · of which uphill (over 3 %) · the wind about ±0, included above · Moving time 3.78 km 19 min 11.8 km/h | Rarely: it explains the estimate | Moving time is the numbers row | Fold under "There at …›", open on a tap. "The wind" row only when it isn't ±0 (change 4) |
| Your speed · 20 / 16 / 11 km/h · 600 m/h up · Normal | It explains the time | Route, word for word | Here, under the fold with the table (change 4) |
| DEPARTURE & WEATHER, then WEATHER ON THE ROUTE | Two headings for one thing; the departure is in Time | | One heading, "Weather" (change 5) |
| Sunrise 08:02 · sunset 16:16 · dark from 17:05 | Yes, outdoors in November | | Keep |
| 4.5 m/s gusts 7.4 · from SW · 4 °C · Breezy, then Temperature 4 °C | The temperature twice | | Once (change 5) |
| Dry the whole way (a link) | Yes | | Keep |
| Headwind 36 % · Crosswind 16 % · Tailwind 48 %, as bars | Yes on a bike or water | Check's Wind breakdown, in km | Keep here |
| Strongest headwind 3.8 m/s at km 3.2 → | Yes | | Keep |
| Eight hours, 10:00 to 00:00, each with an arrow and a number | No, for a 19-minute ride: one hour matters | The weather window's strip, with the ride shaded ([10](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/planner-text-review/10-phone-weather-window.jpg?raw=true)) | Only the hours of the trip, with one either side (change 5) |
| Wind along the route ↑ · Temperature along the route ↑ · Rain along the route ↑ | Sometimes | Colour by | Keep, as one row |
| TAKE IT ALONG · Export GPX · Copy share link · "Includes when you leave: Wed 4 Nov, 10:00" · Save offline… | Yes, before leaving | More, the toolbar's icons at full | Keep: it's where a person looks before leaving, and its line says what the link carries |

**How Go could read** (change 4 and 5 together, two PRs):

- **Time:** Leave [Tomorrow 10:00 ›] [Now]. Then "There at 10:19 · 19 min ›", with "after dark" when it is. The table and Your speed open from the ›.
- **Weather:** "4 °C, dry the whole way · wind 4.5 m/s from SW, breezy", then the three bars, then "Strongest headwind 3.8 m/s at km 3.2 ›", then the trip's hours, then "Sunset 16:16 · dark from 17:05".
- **Take it along:** as it is.

That is about 75 words instead of 183, with nothing removed: the table, the speeds and the along-the-route colours are a tap away.

**Moving it to the weather window isn't a small step.** With a route drawn, the window still reads the map's middle ("4° map centre"); only its strip knows the ride, as a shaded band ([10](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/planner-text-review/10-phone-weather-window.jpg?raw=true)). So the window can't take the route's weather until it reads the route. The one piece it already does is Go's hours strip: Go's strip could open the window at the departure instead of drawing its own. That is a decision for #660's later piece on Go, not one of the changes below.

## The toolbar's tooltips

| Text | Needed? | Do |
|---|---|---|
| Done: "Ends drawing: a click on the map shows what's there. The cards still change the route." Edit: "Back to drawing: a click on the map adds a point." | Yes: they say what Edit and Done decide (#750) | Keep |
| Follow paths, Straight line, Over water, with P, S, W | Yes | Keep |
| Route style: "Which ways Follow paths prefers, for the whole route. Changing it routes the route again." | Yes | Keep |
| Sport: "The sport for the legs you draw next, and your speed in it. Legs already drawn keep theirs." | Yes | Keep |
| Undo: "Takes back the last change." Redo: "Does it again." | Redo's line says little | "Puts back what Undo took" (change 8) |
| Reverse: "…each leg keeps its mode and style." The Route tab's Reverse: "…each leg keeps its mode" | The two disagree | One line (change 8) |
| The Go tab: "When and how long: back at 10:19 · …" on a one-way route | Wrong word | [#753](https://github.com/TommiContursi/Polku/issues/753) |

## The cards' explanatory lines

[#749](https://github.com/TommiContursi/Polku/pull/749) tested the cards and found the hold card's lines plain and useful ("Tap where it goes", "Undo brings it back"). The point's and the sport's cards were looked at again here:

| Text | Needed? | Do |
|---|---|---|
| Sport from here · "To the next change of sport, or the end" | Yes: says how far the change reaches | Keep |
| Next stretch, to End · "Its sport, how it's drawn and its style" | Yes | Keep |
| Move · "Tap where it goes"; Rename · "Give it a name of your own"; Remove · "Undo brings it back" | Yes (#749) | Keep |
| Start here, End here · "The part before (after) it is removed, Undo brings it back" | Yes, a loss and its way back | Keep |
| Take the bike along · "Off: it stays here, and Check makes sure you come back for it" | Yes | Keep |
| The sport card's lines: MTB "Trails by MTB difficulty, MTB routes", Hike "Paths, hiking trails and huts", Paddle "Water routing, depths, marks and ships" | They describe the map's layers, not what changes for this leg | The leg's words: how it's routed and its speed (noticed) |

## The map, while the planner is open

The time marks say "4 min 42 s elapsed", "1 h 14 min 23 s elapsed" ([09](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/planner-text-review/09-phone-paddle-half.jpg?raw=true)). An estimate to the second reads as a measurement, against PRODUCT.md's third principle, and the second line doubles each label. "5 min" would do, and is change 6's other half. Turning elapsed time off by default is a setting (Settings has it), and #234 already asks for the marks' default.

## Ten changes, by value

Each is small enough for a PR of its own, and none removes a feature.

1. **Desktops show the warning where phones do.** The evening route's "In the dark" isn't in the bottom dock's peek and sits inside the list in the side dock. This belongs in [#741](https://github.com/TommiContursi/Polku/issues/741): the warning takes the key fact's slot in every layout, both docks included. Safety, so first.
2. **The route's list in sight at half on a phone.** Cut "Tap a point or a stretch to change it.", the one-part header and its numbers line, Start's "0 m" and End's distance. The Start row and the stretch come into sight at half, and the route's numbers are said once.
3. **Check opens with what it found, said once.** No Hardest climb stat at the top on bikes (the line under the numbers has it), no "Hardest:" line in Climbs, no "Sections to know about", no second length on an item. On paddle, the wind once. With no warning, the verdict "Nothing to read before you go" leads (as #741's line will say it).
4. **Go's time, folded.** "There at 10:19 · 19 min ›" opens the speed table and Your speed; the wind row only when it isn't ±0. Your speed leaves the Route tab in the same PR only if the plan's later piece is chosen; otherwise it stays in both.
5. **Go's weather, for the trip.** One heading, the temperature once, the hours of the trip only. About 20 words fewer, and the strip no longer runs to midnight.
6. **Dark said with the time.** "There at 17:08 · after dark" in Go, and the map's time marks without seconds. An estimate stays an estimate.
7. **What Polku looked at, folded when all answered.** One line, "Looked at 5 sources ›", when every source answered; the full list whenever one didn't or is still being asked. The disclaimer and the Depths line stay in sight.
8. **Tooltips that agree.** Redo's line, Reverse's two versions, and #753. One Fix PR.
9. **Sentence-case headings, nothing under 12 px.** WAYPOINTS, TIME, DEPARTURE & WEATHER, TAKE IT ALONG, HARDEST CLIMB, CLIMBS, ON THE ROUTE become sentence case without tracking; the sources, "Selected" and Go's km/h move up to 12 px. CSS only; it helps the bright-sun case most.
10. **On the route without repeats.** One "Selected" instead of eleven "Use colours", Both as a colouring without its own list, "Roads and tracks (not graded)", and a one-bucket breakdown as one line.

## Noticed

- [#752](https://github.com/TommiContursi/Polku/issues/752) (bug): a multisport route's sports line counts every rise in height, the list and the total only rises over 2 m, so the parts don't add up.
- [#753](https://github.com/TommiContursi/Polku/issues/753) (bug): the Go tab's tooltip says "back at" on a one-way route.
- The paddle route's headwind is 22 % under the numbers and in Check, 18 % in Go. Two ways of counting, or one of them wrong; not traced.
- The same carry is 364 m in the numbers row and Go, 355 m in Check's item (a sample's length at its ends, by the code).
- A tap on a harbour's LIPAS icon while drawing opened its card; the next tap on the map closed it and went back to Ways to begin, not to drawing.
- A tap on a point while drawing opens its card without actions; a hold opens them. #690 owns this.
</content>
</invoke>
