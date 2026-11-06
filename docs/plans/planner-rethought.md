# The planner, rethought (#869)

Polku's planner from a blank map to the trip, as a whole: research on other planners, an inventory of the planner on `main`, one rule for its controls, and three directions to choose from. The mock-up is [mockups/planner-rethought.html](mockups/planner-rethought.html): today's planner and the three directions, at 390 and 360 px, 200 % and the desktop's side dock, with a route of three sports, an MTB route with real terrain, and long Finnish names. **Label the controls** on its bar tags every control with its kind, so the rule can be checked by eye. On a phone, the same page is a private Artifact: [the planner, rethought](https://claude.ai/artifact/JNgtQWQNkb83CrWa77xgMd), built from this file with `css/app.css` and `js/ui.js` inlined.

## Where it stands

- **A proposal (2026-11-06).** Nothing here is decided until the user chooses. No app code is written for it.
- **Asked for on 2026-11-06,** from testing: the planner does a great deal, and its controls follow no one rule. Parts 22 of #761 (the trip's box and the weather card) waits on this.
- **The recommendation is B,** the route and a card for each detail. A and C are drawn to compare.

## What it must make easy

The journeys, from the issue:
- **Start a trip from scratch,** including searching for the next place.
- **When:** say when you leave, or when you must arrive (#219).
- **Best time to leave,** from the weather. For paddling that means wind and waves; for everyone, rain and the dark (#273, #856). Later it can mean transport too (#857).
- **Multisport:** plan a route of several sports, and change a part's sport easily.
- **The profile:** read it (#796).
- **What the route contains:** see the path's features. Today that's Check's On the route, with its bars for gradient, surface, way type and width (#758).
- **The weather in detail** (#431, #759, #794).

The user's points, as plans:
1. **The start time comes before the waypoints,** as in Google Maps' directions panel. There, a clock pill under From and To reads "Leave now ▾", and its menu has Leave now, Depart at, Arrive by and Last available.
2. **Show all waypoints** belongs on the right of the list's heading row.
3. **One rule for the controls:** which kind looks which way, and why. Every control is checked against it.
4. **On the route** gets a clear home.
5. **Earlier wishes stand:**
   - the tabs may not be needed;
   - Go's extra information moves into the weather window from the trip's box (Parts 22);
   - Warnings are called Warnings everywhere (#853);
   - Notes stays free for notes of your own (#854).

**Kept as decided:**
- the route's list is a timeline, not cards;
- backgrounds mean selection;
- nothing moves under the pointer;
- short plain nouns;
- cards one at a time;
- Fold, then away;
- the sheet's stops;
- the desktop's layout D (#594);
- nothing used today takes more taps (PRODUCT.md).

## Research

Four Sonnet subagents ran at low effort. Each ran 3–8 searches and opened few pages, so their claims are leads. Three that the directions lean on were checked by hand.

| Planner | Take | Avoid |
|---|---|---|
| Google Maps | The time as a pill under the route's ends: Leave now ▾ (Leave now, Depart at, Arrive by; Last available is for transit). Options on its right. One filled main action ([the user's picture](https://support.google.com/maps/answer/144339)) | Depart at works for one destination only |
| Apple Maps | A three-stop sheet; an elevation graph for walking and cycling | Leave and arrive times for driving and transit only, not cycling ([Apple's guide](https://support.apple.com/guide/maps/get-directions-mps4d8a6bd2f/mac)) |
| Komoot | Way types and surfaces as bars with their lengths, by the profile. Hover on the profile lights the map. The weather along the route: heat, rain, headwind, the dark (checked, [komoot.com/premium/weather](https://www.komoot.com/premium/weather)) | The weather and some stats behind a paywall |
| bikerouter / brouter-web | One control colours the profile by gradient, way type or surface. Hover shows the way's tags (checked, [docs.bikerouter.de](https://docs.bikerouter.de/en/elevation-profile/)) | — |
| OsmAnd | Summary, then charts, then folding Road type, Surface and Smoothness. A profile change asks: next segments, or all segments ([its planner](https://docs.osmand.net/docs/user/web/planner)) | Breakdowns as text only, without a tie to the profile |
| cycle.travel | Total climb and the steepest grade in the profile's corner. Unknown surface is a category of its own | — |
| Mapy.com | — | One transport type for the whole route; changing it in the PRO planner wipes the edit history (checked, [help.mapy.com](https://help.mapy.com/route-planning/transportation/)) |
| Strava, RWGPS, Gaia | Undo and redo together, Clear apart. Speed visible and editable | A mode change that alters earlier segments (Gaia, a user's report) |
| Epic Ride Weather | The best and worst start times over a day, for a route and a pace; head- and tailwind per segment ([roadbikerider.com](https://www.roadbikerider.com/let-weather-choose-next-ride/)) | — |
| PredictWind | About four departures side by side, 1 h to a day apart ([help.predictwind.com](https://help.predictwind.com/en/articles/2884534-overview-of-departure-planning)) | Ranking by speed alone, which doesn't suit a kayak |
| Savvy Navvy | A kayak mode, departure scheduling, and a wave comfort overlay ([savvy-navvy.com/kayak](https://www.savvy-navvy.com/kayak)) | A boat's polars applied to a kayak |
| Windy | A route planner with departure and speed; the weather follows its slider | A speed it doesn't show; weather at the start time only (forum reports) |

**What it adds up to:**
- **When first, as a pill.** Google's model fits: when you leave is an input, so it goes before the waypoints, and it's one control with a menu.
- **Polku leads in two places.** No planner here mixes sports per leg the way Polku does; Mapy.com and Google have one mode a route. Only the sailing and cycling weather tools pick a departure from the weather along the route.
- **The breakdowns belong to the profile.** Komoot, bikerouter and OsmAnd all keep the surface and way type bars with the profile, one control choosing the colouring.
- **Best time to leave** is a strip of departures, with the best few in words (Epic Ride Weather, PredictWind). It scores the weather where you'll be when you're there, not at the start.

**Gaps:**
- not looked at, or not confirmed: Apple Maps' phone UI, Gaia, CalTopo and Garmin's planners, Organic Maps, Windfinder and Windguru, sea-kayak tide planners, and daylight tools;
- the subagents' notes are in the session's notes folder (`planner-rethink-research.md`).

## Today's planner

`main` at 9849191, in the browser pane, at 390 × 844 and 1440 × 900. The route: MTB from Argelanderintie to Kaivopuisto's shore, a sea kayak past Luoto to Suomenlinna with two carries (259 m), and a hike to the end, drawn with a local BRouter. A second route: Kauppi in Tampere, on the MTB.

**What's there:**
- **The header:** the numbers, and the key facts (3 warnings ›, Paddle ›, Hike ›).
- **The profile:** Colour by ▾ (a native select), On map, ⌃.
- **The tabs:** Route, Check, Go.
- **Route:** Show all waypoints, on the left, and the list's sliders; the list; Reorder, Reverse, Back to start and Clear route; Route style › for each sport and Your speed ›.
- **Check:** its numbers, Warnings, Good to know, What Polku looked at, and On the route: eleven bars with Use colours, in cards inside a card.
- **Go:**
  - Time: Leave › with Now; There at; a table of the time; Your speed ›.
  - Departure and weather: the sun, the wind, eight hour chips, and three links that colour the route.
  - Take it along.
- **Elsewhere:**
  - the toolbox: Done, Follow paths ▾ and undo and redo; at full it docks with six route actions as bare icons;
  - More (⋯);
  - each part's ⚙;
  - the list's settings;
  - a waypoint's card;
  - the weather timeline, a window of its own over the map.

**Where the rule breaks:**

| What | Today |
|---|---|
| One action, three looks | Reverse, Clear route, Share link, Export GPX and Save offline are bare icons (the docked toolbox, the desktop's toolbar), menu items (More) and buttons (the list's foot, Go's Take it along) |
| A value you change, five looks | A row with a green value and › (Route style Balanced ›, Leave Now ›, Your speed Normal ›); a native select as a pill (Colour by Wind ▾); the toolbox's button with ▾ (Follow paths · Hike · Balanced); dotted words (46 min moving); the desktop's style and sport buttons |
| Green words, six jobs | Back (‹ Route), unfold (Show all waypoints), colour the route (Wind along the route ↑, Use colours), a value (Balanced, Now), a state (Selected), a jump (Strongest headwind … →) |
| Arrows | › ⌄ ⌃ ▾ → ↑, all on one screen |
| The sport, five places | The top bar's pill (the map's sport, MTB here), the toolbox's next leg (Hike), each part's ⚙, Route style › under the list, Go's Your speed; a waypoint's card has Sport from here |
| When you leave, three places | Go › Time › Leave, the dotted time in the numbers, and the weather timeline's slider ("Also your route's departure") |
| The weather, five places | The key facts (Paddle · wind up to 5 m/s), Colour by's wind, Go's Departure and weather, the timeline's window, On the route's Weather group |
| On the route | In Check, though it says what the route is made of, not what to check; its Use colours repeats Colour by |

**Found on the way:**
- **Search for the next place** only moves the map. A place from the top bar's search has no mark and no card, so the next waypoint is a tap you aim yourself (`choose()` in `js/search.js`); only a LIPAS result opens a card. Filed as #871, and PR 1 below.
- **The weather timeline covers things.** At 390 with the planner at full, it covers the planner's numbers, its profile and the search's lower results. That's on #377.
- **Minutes already work.** The departure has had minute precision since #364's C, so #219's first half is done; noted on #219.

## The critique

`/impeccable critique` ran on the running app. Its two assessments ran here in one context, not as two isolated agents: the user asked for subagents that use few tokens, and judging stays with this session. `impeccable detect` and its overlay ran in the page: "Use colours" and "Selected" at 10 px (eleven places), text at 10.8 px, and On the route's groups as cards inside a card (three). #767 and the design-system audit already have these.

| # | Heuristic | Score | The issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Late answers say so ("Not checked", the busy bar); the departure hides in Go |
| 2 | Match with the real world | 3 | Plain words; Check and Go are feature buckets, not questions |
| 3 | User control and freedom | 3 | Undo, Back, Fold; Done and Edit still change what a tap does |
| 4 | Consistency and standards | 1 | The table above |
| 5 | Error prevention | 3 | Clear route with Undo; warnings before you go |
| 6 | Recognition over recall | 2 | When, the sport and the weather each in several places, one of them deep |
| 7 | Flexibility and efficiency | 3 | The desktop's toolbar and keys; the list's settings |
| 8 | Aesthetic and minimal | 2 | At half, the header, three key facts, the profile, the tabs and the list compete; Go is a wall |
| 9 | Error recovery | 3 | Retry, "didn't load", Undo |
| 10 | Help | 2 | Tooltips and USING.md; no tour, by design |
| | **Total** | **25/40** | |

Its priorities, for this plan:
1. **[P1] The controls follow no rule.** The rule below fixes it.
2. **[P1] When is deep.** The pill fixes it.
3. **[P2] Three tabs of feature buckets.** The directions settle it.
4. **[P2] The weather in five places.** The weather card and the trip's box settle it.
5. **[P3] On the route in Check.** It moves to the profile.

## The rule for controls

**What a control does decides how it looks.** Each kind below is a control in DEVELOPING's Shared controls already. Four controls in the directions are new, and they're proposals until the user chooses them:
- **the When pill:** Colour by's pill (`mode-select`) as a button, opening the app's menu;
- **On the route's list:** a `row` with a tick and its bar, the chosen one unfolded with Check's lengths;
- **Best time to leave's strip:** a bar an hour, scrubbed by a finger;
- **the trip's box:** Go's day cards (`days`, `day`) as buttons ending in › (Parts 22's).

| What it does | How it looks | The control |
|---|---|---|
| Opens something: a card, a step, the detail | A row, the whole row a target, › at its end; a value it holds in green before › | `row` with `val`, `kf-b`, `warn-row`, the trip's box (`day`) |
| Picks a value from a few, here | The value itself with ▾, opening the app's menu at it | Colour by (`mode-select`), the drawing mode (`modebtn`), When (proposed: the same pill as a button) |
| Does it now | A button in words, an icon before them if it helps; one main action in green; a dangerous one red | `btn`, `btn primary big`, `btn danger` |
| Shows or hides something here, or goes back | Green words with ⌄ ⌃ or ‹ | `btn small quiet` (`wpl-all`, `way-back`), `wpl-unfold` |
| Stays on or off; one of a few modes | A switch | `tg`, `seg` |
| One of several | Chips side by side; in a list, a row with a tick | `chip`, `menu-item` with `menu-tick` |
| Closes, folds, undoes, more, its settings | A bare icon from a fixed few: ✕ ⌄ ↶ ↷ ⋯ ⚙ and the list's sliders | `tool` |

**The rules with it:**
1. **One home per action on a phone.**
   - The list's foot holds what acts on the list: Reorder, Reverse, Back to start and Clear route.
   - More holds taking it along (Share link, Export GPX, Save offline) and starting again (Round trip, Import).
   - A desktop's toolbar adds icons with tooltips and keys, for a pointer.
   - Today More repeats the foot's Reverse, Back to start and Clear route, and the docked toolbox repeats six of them as icons. Both are choices below (10 and 11): #750 set More's order, and #660's queue said no PR touches the toolbar again.
2. **The arrows mean one thing each:** › opens, ‹ goes back, ⌄ ⌃ fold here, ▾ picks a value. → and ↑ go.
3. **Headings are words,** in sentence case (#767). A heading that opens its settings has ⚙ at its end, as a part's does.
4. **A desktop may be denser,** with icons, tooltips and keys, never a different kind of control for the same job.

**DESIGN.md's accent rule.** It says the accent marks "what's chosen or the one main action". Its Colors section also gives the accent to links, and Parts 20 chose green words for what acts here (Show all). The proposal changes the rule's words to "what's chosen, what acts here in words, and the one main action". That makes green mean you can tap it: a value, a fold or a way back, never plain information.

**Every control against it:**

| Control | Today | Under the rule |
|---|---|---|
| When | Go's Leave row, dotted time, the timeline's slider | The When pill, one place to set it. #233's step 3 keeps the map's 48 hours setting the departure as they do today: whether they still should is choice 9 |
| Colour by | A native select, and Use colours in Check | Colour by's pill; On the route's list in the profile (B) |
| The drawing mode | Follow paths ▾ | Stays |
| Route style, Your speed | Rows under the list, and each part's ⚙ | Each part's ⚙ only (built in #852's 6j) |
| Show all waypoints | Green, on the left | Green, on the right, after a "Waypoints" heading |
| A stretch's fold | Green ⌄ and its count | Stays |
| Use colours, Selected | Green 10 px words | Gone: a row with a tick in On the route's list |
| Wind / Temperature / Rain along the route ↑ | Green links in Go | Gone with Go: Colour by |
| Strongest headwind … → | A green link | A row › in the weather card |
| Take it along | Buttons in Go, items in More, icons at full | Items in More, icons on the desktop's toolbar |
| The docked toolbox's icon row (phone, full) | Six bare icons | Gone, More and the foot having them (choice 11) |
| Done, Edit | Buttons | Stay |
| ‹ Route on a card | Green words | Stays |
| The tabs | Route, Check, Go | Gone (A, B) or Route and Check (C) |
| Check's All read | Quiet words | Stays (it acts here) |
| A waypoint's Pass by · Stop · Night | A switch | Stays |
| The list's sliders, a part's ⚙, ✕, ⌄ | Bare icons | Stay (the fixed few) |

## The directions

**What all three share:**
- **When first.** The When pill opens the sheet's top row, before the numbers and the waypoints, in sight at every stop of the sheet: "Leave now ▾".
  - Its menu: Leave now; Leave at… (the phone's own picker, as Leave's `row pick` today); Arrive by… (Polku works out when to leave); and Best time to leave ›.
  - With a time set, the pill says it ("Leave Sat 09:00", "Arrive by 20:30"), and the numbers' second line says the other end ("there at 10:11", "leave 19:19").
  - Last available is Google's, for transit; it's left out.
- **Show all waypoints on the right,** after a small "Waypoints" heading; the list's sliders at the end.
- **The trip's box** (Parts 22) over the list: a day a row, ending in ›, opening the weather card.
- **The weather card** (#431, Parts 22), from the box, the pill's Best time to leave, or the map's Weather:
  - When again, the same pill;
  - **Best time to leave** (#273): a bar for each of the next 48 hours, lower the better (height, not colour alone), the dark shaded behind. The best three are named in words, each a row with a tick, set by a tap. It counts what matters for the route's sports: the dark and rain for everyone, headwind on a bike, and wind and waves on the open water, with a crossing window for a paddle (#856);
  - the day's weather and sun;
  - the wind on the way, and its strongest headwind as a row ›;
  - Time on the way, folded;
  - the map's weather, a row away.
- **The Add row** (#761's PR 8) at the list's end: "Add the next place", with Search, Where I am and a tap on the map. A place picked is the next waypoint, and Undo takes it back.
- **Go's tab goes** (Parts 22): its time is in the weather card, Your speed in each part's ⚙, and Take it along in More.
- **The list as built,** untouched.

| | A: One page | B: The route and its cards (proposed) | C: Two tabs |
|---|---|---|---|
| **The tabs** | None: one scroll | None | Route and Check |
| **On the route** | A section of the page under the list: Colour by as a list, the chosen one ticked with its lengths | The profile card: the profile tall, a finger on it moving a mark on the map, On the route's list under it, the climbs | Under the profile in Route, as its legend with lengths (#758 as written) |
| **Check** | A section of the page; the warnings' row scrolls to it | The Check card, from the warnings' row: Check as built, without On the route | A tab, without On the route |
| **The weather** | The card | The card | The card |
| **On a desktop** | One panel | The panel, and each card beside it, so the route stays in sight | The panel |
| **Its cost** | A long page; Check and On the route under a long list | Three cards to learn; on a phone a card covers the list while it's open | Keeps a tab bar for one thing; the profile's legend at full only |

**Why B:**
- **The phone's room goes to the route.** At half it shows when you leave, the numbers, the warnings, the profile, the trip and the start of the list.
- **Each summary is the door to its detail:** the warnings to Check, the profile to Profile and On the route, the box to the weather.
- **It builds on what's decided:** cards one at a time with ‹ Back (#345, #574), the weather as a card (#431), the profile as a tool (#796).
- **A desktop shows the card beside the panel,** so the route stays in sight.

A is the simplest to learn but the longest to scroll. C changes the least.

**Taps, from the route at half on a phone:**

| Journey | Today | A | B | C |
|---|---|---|---|---|
| Leave at a time | 2 (Go, Leave) | 2 (pill, Leave at) | 2 | 2 |
| Arrive by | not possible | 2 | 2 | 2 |
| Best time to leave | not possible | 2 (pill or box) | 2 | 2 |
| The next place | search, then aim a tap on the map | Add row, type, pick | the same | the same |
| A part's sport | 2 (⚙, a sport) | 2 | 2 | 2 |
| The warnings | 1 | 1 (scrolls) | 1 (card) | 1 (tab) |
| On the route | 1 and a scroll past Check | 1 (scrolls) | 1 (the profile) | a raise to full |
| The weather in detail | 1 (Go) and a scroll | 1 (box) | 1 | 1 |
| Take it along | 1 (More) | 1 | 1 | 1 |

**What becomes of:**
- **Parts 22** is built as drawn, in every direction: the trip's box, the weather card, and Go's tab gone. It's the next PR after the pill, with Best time to leave inside its card.
- **Check's tab** becomes the Check card (B), a section (A) or stays (C).
- **#759** becomes part of the weather card. The hour chips leave with Go, and their job goes to Best time to leave's strip. The route's weather stays on the profile through Colour by (wind, temperature, rain), as today.
- **#758** is On the route as Colour by's list: in the profile card (B), a section (A), or the profile's legend (C).

**The other skills' notes on B:**
- **/emil-design-eng:**
  - the pill's menu grows from it (`popMenu()`);
  - a value changed tens of times (When) changes in place, with no motion;
  - scrubbing the strip has no motion either;
  - nothing moves under the finger.
- **/mobile-native:**
  - the strip's 48 bars are 7 px each, too small for a finger. It's a drag that scrubs (`touch-action: pan-y`, so a vertical drag still moves the sheet), with the time read out over it, and the named departures as the 44 px targets;
  - the Add row's field is 16 px, with `enterkeyhint="search"`;
  - a card keeps the sheet's `overscroll-behavior: contain` and the safe area at its foot;
  - the strip's scrub against the sheet's swipe, and the iOS picker from the menu, need a phone.
- **/apple-design:**
  - a card opened from a summary goes back to it with ‹ Route, the planner as it was;
  - the same pill behaves the same in the header and the card;
  - the strip updates the times as the finger moves, not on release;
  - On the route's list sits under the profile it colours.
- **/break-ui**, at 360 px, 200 % and with long Finnish names:
  - the pill wraps (a 22 px radius, not a pill's, once it does);
  - the list's heading row wraps with Show all still at the right;
  - the When menu is a sheet of its own at 200 %, as `popMenu()`'s is;
  - On the route's legend keeps its labels whole;
  - what overflows sideways at 200 % in the mock-up is the app's own rows drawn with its desktop rules (the mock-up's page is wide), as in #761's mock-up.

**States the build must draw,** not drawn in the mock-up:
- **Leave at, past and future:** a time that has passed (Leave's note today); a time past the forecast ("No forecast yet" on the box and the strip).
- **Arrive by too soon:** "Leave now and you're there at 20:02".
- **Failures:** the forecast didn't load (the strip says so, with Retry); the search didn't answer (a tap on the map still works).
- **A trip of days:** a row a day in the box (Parts 22's `r20=days`).
- **Midnight sun:** no dark to shade.
- **Arrive by and the wind:** a departure worked back with the wind changes the arrival, so it settles in a step or two and says "about".

## The PRs

Each is small and tried on a phone before the next. The order is for B; A and C differ only from PR 7. The order the user set on 2026-11-04 put the cards (#690, #797) and the profile (#796) before the weather card; this order puts the weather first, since Parts 22 is ready. The user decides.

1. **Fix: a place found by search gets its mark and its card** (#871: Add to route, Start here, End here). It's a Fix PR, in the month's milestone, and holds in every direction. `choose()` in `js/search.js`, `openPlaceCard()`.
2. **When first:** the pill in the sheet's top row, with Leave now and Leave at. It sets `setLeave()` as Leave's row does, and Go's Leave row stays until PR 4. `renderLeave()`, the sheet's top row (`js/planner.js`). Checks: `leave`, `keyfacts`.
3. **Show all on the right,** after a "Waypoints" heading in sentence case (with #767). `sections`.
4. **The weather card from the trip's box** (Parts 22, #431, #794). Go's time and weather move into it, and Go's tab goes; the hour chips go (#759). `weather`, `tabs`, `sections`.
5. **Best time to leave** (#273, parts 1, 3 and 5): the strip and the named departures in the weather card; the crossing window for a paddle (#856). The forecast is the one `windAlong()` already has, so no new requests. `weather`, `water`.
6. **Arrive by** (#219): the pill's third item, worked back with the wind; the states above. `leave`, `stops`.
7. **The profile card, with On the route as Colour by's list** (#796, #758). Check's On the route goes.
8. **The Check card from the warnings' row;** the tabs go. The rows under the list (Route style, Your speed) stay until choice 12 says otherwise: the user kept both ways on 2026-11-05 to try them.
9. **The Add row** (#761's PR 8), with the search in the sheet.
10. **The rest of the rule:**
    - the dotted time words go;
    - More and the docked toolbox, if choices 10 and 11 say so;
    - DESIGN.md's accent rule changes its words;
    - DEVELOPING's Shared controls gets the new controls the user chose: the When pill, On the route's list, the strip and the trip's box.

Every motion is decided with /animate when it's built, and a PR that moves something stops for /review-animations.

## For the user to choose

1. **The direction:** A, B (proposed) or C.
2. **Parts 22:** build it as drawn, with Go's tab gone, after the pill (proposed).
3. **Check's tab:** a card (B), a section (A) or a tab (C).
4. **#759:** folded into the weather card (proposed).
5. **The pill's place:** the sheet's top row (proposed, in sight at every stop), or the list's heading row (by the timeline it starts).
6. **The order:** the weather card first (proposed), or the cards (#690) and the profile (#796) first, as decided on 2026-11-04.
7. **The accent's words in DESIGN.md:** as proposed, or keep green words for what's chosen only.
8. **#869's milestone.**
9. **The map's 48 hours:** keep setting the departure as they do today (#233's step 3), or move only the map's hour, with the pill the one place to set when you leave.
10. **More's copies of the foot's actions** (Reverse, Back to start, Clear route): keep them (as #750 set More's order), or let the foot be their one home on a phone.
11. **The docked toolbox's row of route icons** on a phone at full: keep it, or let More and the foot have them. #660's queue said no PR touches the toolbar again, so it changes only on the user's word.
12. **The rows under the list** (Route style and Your speed for each sport): keep them beside each part's ⚙, as tried since 2026-11-05, or let the ⚙ be their one home.
13. **The new controls:** the When pill, On the route's list, the strip and the trip's box, each joining Shared controls once chosen.

## Not drawn, or not known

- **Not drawn:**
  - the map and its buttons; the toolbox and the desktop's toolbar (stand-ins);
  - Reorder; a waypoint's and a leg's cards (#690's round);
  - the bottom dock (as the side dock, in two columns);
  - motion; dark and light side by side (the mock-up follows the system).
- **Illustrative:** Best time to leave's hours and named departures, the crossing window's waves, Arrive by's times, and the search's results in the sheet. The top bar's results for "Pyynikin näkötorni" are real.
- **Not known:**
  - whether three cards feel like more to learn than two tabs, which a phone will tell;
  - how a strip of 48 hours scrubs against the sheet's swipe;
  - how Arrive by settles with the wind;
  - the top bar's sport pill beside each part's sport (three sports in the planner, DEVELOPING's "Three sports"), left as it is here.
