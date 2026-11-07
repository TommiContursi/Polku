# The cards and what a tap does, rethought (#690)

The design for [#690](https://github.com/TommiContursi/Polku/issues/690) (primary), [#876](https://github.com/TommiContursi/Polku/issues/876) (one rule for a tap, a click, a hold and a right click), [#760](https://github.com/TommiContursi/Polku/issues/760) (a spot's popup) and [#647](https://github.com/TommiContursi/Polku/issues/647) (on a desktop the card covers the way), looking at #107, #716, #845, #627, #796 and #859 too. Milestone: [Calmer planner](https://github.com/TommiContursi/Polku/milestone/16).

**Where it stands (2026-11-07): four rounds decided, and the mock-up's New 3 draws them; the plan is ready to build from, PR 1 first.**  The mock-up is [mockups/cards-and-taps.html](mockups/cards-and-taps.html), also a [private Artifact](https://claude.ai/artifact/V1QqdwcbGRdhtiNYFE74C7) to try on a phone.

It builds on what's decided and doesn't reopen it: cards one at a time with ‹ Back (#345, #574); the sheet's sizes (#603); nothing moves under the pointer (#594); backgrounds mean selection (#761); green means you can tap it, and the rule for controls (#869); a tap while drawing adds a waypoint (#345); short plain nouns; missing or late data never looks complete; don't redesign what works.

## Why

After #623 went live, a tap on a thing on the map gave its facts, and a hold or a right click gave a different card with what you can do there (#690). Nothing on the tap's card says the other exists. The audit of 2026-11-03 (#749) found the same split on the desktop, and the inventory below finds it on every kind of card. A card is also often worth little at first sight: a place's card says its height and Share; a stretch's says three numbers with no profile, though a point's card has one.

## The inventory (`main` at babbafd, 2026-11-07)

Served on port 8897 with a local BRouter (`tools/brouter-local.sh`, nothing sent to brouter.de), in Claude Code's browser pane: 375 × 812 with phone emulation and 1440 × 900. The route: Eira → Kaivopuisto by MTB, a sea kayak to Suomenlinna across the Särkän väylä, a hike on the island (4.28 km, three parts, four warnings). The water leg had no carry, so a carry's card wasn't seen. A Kauppi LIPAS place in Tampere; a military area stands in for the sea marks, which didn't load in the pane (both open `thingCard()`).

**How it was opened.** Real clicks and right clicks in the pane, a hold made of touch events sent to the map's canvas (so through `bindHold()`), Enter and Shift+F10 at the keyboard's crosshair, and the planner's own `open…Card()` calls where a gesture's target was hard to hit. The phone emulation sends clicks as a mouse, so **the line at the spot was opened by its call, not a finger, and a real phone's hold wasn't felt.** Both need a phone.

### What each gesture opens today

| On | A tap (phone) | A click (desktop) | A hold or a right click | The keyboard |
|---|---|---|---|---|
| **The empty map, browsing** | The line at the spot (name, how you get along it, height, grade, weather); a tap on it opens the way's card | The way's card at the spot, no route actions | The way's card with **Your route** (Add to my route, Start here, End here, Round trip from here, Avoid this spot) and All OpenStreetMap details, Copy | Enter: as a click. Shift+F10: as a right click |
| **The empty map, drawing** | Adds a waypoint | Adds a waypoint | The spot's card with Your route; no point | Enter adds a waypoint; Shift+F10 the card |
| **A place's icon** (a peak, a gate, a LIPAS place) | Its card: height, where it's from; Share, Weather here ›, Not right? | The same, at the spot | The same with Your route, All OpenStreetMap details, Copy | As the map |
| **The route's line** | The route's card at the spot (see below) | The same, its **Add a waypoint here** first | Browsing: the route's card. Drawing: Edit this stretch | As the map |
| **A waypoint** | Its facts: there at, from the start, height, the profile up to it, On the profile | The same | Its actions (below) | **Not reachable from the map:** the markers aren't focusable, and Enter or Shift+F10 at one opened nothing. The list's rows reach them |
| **A warning's marker** | Its card (below), the same by any gesture | | | |
| **A search result** | Its pin and card: with the planner put away, height and Share only; while planning, with Your route (#874) | | | |

### What each card shows

At a phone's peek a card shows **178 px**: its head and its numbers, nothing more. Everything else is a swipe away.

| Card | First | Further down | Actions | To interact with | Height (phone, px) |
|---|---|---|---|---|---|
| **Waypoint, tap** | there at, from the start, height | the route's profile, coloured to the point | On the profile | none | 234 |
| **Waypoint, hold** | the same | At this waypoint (Pass by · Stop · Night), Sport from here ›, a changeover's minutes and Take your bike along, Next stretch ›, Leave (on the start) | Back to start, Reverse (start, end), Move, Rename, Start here, End here, Remove | the switch, the steppers | 704–831 |
| **The route at a spot** (tap the line) | the way's name and kind, how far along; three numbers by the sport (there at, uphill, difficulty; on water wind and temperature) | the stretch's worst warning (often far from the spot: "at km 0.0" where you tapped at 1.36 km) | This stretch ›, What's here ›, Edit this stretch ›, On the profile, Avoid this spot, The whole route ›; Add a waypoint here (the pill) | none | 550 |
| **This stretch** | from → to, distance, time, climb | Look out for (every warning on it) | Edit this stretch, On the profile | none: no profile of its own | 578 |
| **Edit this stretch** | "Changes apply to this stretch: its n legs" | Sport ›, How it's drawn, Route style › | Other ways, Stop here, Avoid a spot here, On the profile | the switch | 459 |
| **A warning** | what, from the start, how long | where it comes from, its note | its main action (Avoid all 5, Retry…), Got it, Hide in Check, Fix the map, Not right?; ‹ › and All in Check on a phone | ‹ › | 349–531 |
| **A way, tap** | name, how you get along it; long, up, down | the profile with Colour by and its words, The way, Surface, Difficulty, the weather here now, Not mapped | Share, Weather here ›, Not right? | the profile (scrub), Colour by | 813 |
| **A way, hold** | the same | Your route first, then as the tap | as the tap, and All OpenStreetMap details, Copy | the same | 1144 |
| **A place, tap** | name and kind; height; where it's from | LIPAS's facts and pages, where it's LIPAS's | Share, Weather here ›, Not right? | none | 180–634 |
| **A place, hold** | the same | Your route first | as the tap, and All OpenStreetMap details, Copy | none | 518 |
| **The water** | Water; height here | About it (depth from Traficom), the weather | Paddle from here, Share, Weather here ›, Not right? | none | 477 |
| **A thing** (road works, a sea mark, a military area) | its name | its facts, where they come from | Share, Weather here ›, its source's page | none | 152 |
| **A LIPAS route** | name, kind, town | length, one way | Follow this route, Add to my route, Start a route here, LIPAS's page, Share, Weather here ›, Not right? | none | 519 |

On a desktop the same cards float at the spot (`card-float`): a click on the line opens the route's card over the line it's about (#647), a LIPAS place's showed 480 of 634 px, a search pin's 480 of 1185. A right click on a waypoint gives its actions as a grid of buttons, all in sight: the best card of the lot.

### Taps for common jobs (phone, the route at the peek, drawing)

| Job | Today | How |
|---|---|---|
| Change a leg's sport | 4 | the line, Edit this stretch ›, Sport ›, the sport (for tapped points the stretch is the whole route, #749's point 5) |
| Add a place as a waypoint | hold + swipe + 1 | a tap on the place gives no way to add it |
| Avoid a spot | tap + swipe + 1 | on the line; elsewhere a hold |
| Move a waypoint | drag, or hold + swipe + 2 | Move, then a tap |
| Remove a waypoint | hold + swipe + 1 | the hold found only by knowing it |
| See a way's surface | 2 + swipe | the line, What's here ›; a way off the route while drawing: a hold only (#107) |
| See a stretch's climb | 2 | the line, This stretch ›: one number, no profile |

## Today's cards, critiqued

⚠️ Run in this session's context, not as two isolated assessments: the user asked for subagents that spend few tokens, and judging stays here. `impeccable detect` ran on `js/cards.js` and `js/card.js` (regex only: 0 findings, two undocumented colours in the route's mark); #749 ran it in the page.

- **Discoverability (the worst, P0).** The tap's card and the hold's card differ, and nothing says so. Every route action, and a waypoint's every edit, waits behind a hold or a right click, which a keyboard reaches only through Shift+F10 and a waypoint not at all.
- **What's first (P1).** At the peek every card shows its head and numbers only. The actions and anything to inspect are always below; a hold's Your route is the first thing under the numbers and still out of sight.
- **Value (P1).** A place says its height; a thing says its name; a stretch says three numbers. The way's card is the richest, with a profile you can scrub, and the route's own stretch, which Polku knows best, has none.
- **Consistency (P2).** Three looks for actions: a pill on the map (Add a waypoint here), rows with a line under each (Your route, a waypoint's), quiet buttons at the foot (Share, Weather here ›). The same job has two names (Add to my route, Add a waypoint here) and two homes (the route's card and the spot's).
- **Desktop placement (P2).** The float covers what it's about (#647) and changes place at every step (#749's point 3).
- **What works and stays:** the way's card and its profile with Colour by; the line at the spot as a quick look; a desktop's hover readout on the route; the right click's grid of actions on a desktop; the warning's card with its one main action and ‹ ›; Undo after every action.

## Other apps

New research checked the apps #345's research ([issue-345-research.md](issue-345-research.md)) and the Komoot reference ([2026-11-04-komoot-reference.md](../reviews/2026-11-04-komoot-reference.md)) didn't, and what this design leans on. Two Sonnet subagents searched; their findings are leads, and the three claims below were checked by hand.

- **One card for a tap, with a row of actions and More (checked):** OsmAnd's context menu opens on a short tap on a thing or a long tap on any spot, shows its name, address and distance first, grows by Details or a swipe, and has "a row of up to three buttons" with the rest behind **Actions** ([OsmAnd](https://docs.osmand.net/docs/user/map/map-context-menu)). Apple Maps' place card has an actions row that starts with Directions, Call and Website, the rest under **More** ([Apple Business](https://business.apple.com/docs/onboarding-guide/place-card)).
- **A hold drops a pin and opens the same card** in Google Maps and Apple Maps ([Google](https://support.google.com/maps/answer/18539), [Apple](https://support.apple.com/guide/iphone/iphfa7286b57/ios)); it's the way to an unnamed spot, not to a different set of actions.
- **Komoot's popup** (checked in the 2026-11-04 reference): one small card for a spot and a waypoint alike, five facts and one or two actions, every action in sight.
- **Inspecting a piece of a route is rare.** Scrubbing the whole route's profile with the spot on the map is common (Gaia, Mapy.com, Komoot, OsmAnd, AllTrails on the web). A sport or profile for one segment is OsmAnd's, through its point's menu; Komoot and FATMAP have only a follow-paths switch. No app found gives a segment its own profile or steps to the next segment: here Polku would lead.
- **Keyboard and screen readers:** no app documents keyboard access to its card's actions. Polku's crosshair and its list are already more than they offer.

**Take:** one card a tap opens, the same a hold opens; a row of a few labelled actions in sight with the rest behind one control; the card grows by a swipe or a tap. **Avoid:** different actions for a tap and a hold (today's Polku); Gaia's setting that swaps what a tap and a hold do, which its users found harder ([Gaia's forum](https://help.gaiagps.com/hc/en-us/community/posts/1500000618942)).

## Decided

### Round 1 (2026-11-07)

1. **The mock-up to redraw** is `cards-rethought.html` (#574's), published as a private Artifact too, so it opens on a phone.
2. **A tap opens the card, and a hold or a right click open the same card** (#876's rule, A). Its first size shows the facts and its actions; the phone's line at the spot goes, its words becoming the card's first line (reversing #574's line at the spot). **Browsing and drawing aren't kept strictly apart:** a card offers what can be done there in either, and an action that changes the route starts drawing by itself, as Add to my route does today. While drawing, a tap on the empty map still adds a waypoint.
3. **A tap on the route's line opens the leg you tapped,** and from it, easily, its stretch, the whole route, the way under it (the road or the path) and a LIPAS route it follows. Two ideas go with it: hiding the route for a moment (#756) and drawing it beside the way rather than over it (#199).
4. **On a desktop a card opens beside the planner** (A), as #869's cards do, not at the spot. Being able to move it stays wanted (#647) for a long leg or route it would still hide; a card that says what the map would have shown needs moving less. **A card is never bigger than its content needs,** or it can be resized.
5. **A place's facts are asked for when its card opens** (one Overpass request, cached), as its height and Share say too little. The card ideas already filed come into the design: links to MapComplete and StreetComplete (#855), Look around here (#757), Not right? as a form (#347), notes of your own (#854), opening hours when you get there (#859), places to sleep along the route (#160), saved places (#156), Avoid this spot's size (#708).

### Round 2 (2026-11-07)

6. **One layout for every card,** top to bottom: its mark, name and one line, with ⋯ and ✕; up to three numbers; its actions; what you inspect with (a profile you scrub, the surface and way bars, ‹ › to the next); the facts in groups; a foot with where the facts come from, Not right? and the links that fix the map. How tall the first size is stays open (round 3): the user leans towards room for the profile.
7. **The actions' look:** both drawn, to choose by trying (round 3): **B**, the desktop's buttons (the main one green and full width, then two side by side, the rest behind ⋯), and **A**, an action row of round buttons with their words.
8. **Each kind's main action and first two,** as in "The cards, kind by kind" below. **The card is never the only way:** dragging a waypoint, a click that adds one while drawing, and the action at the pointer stay, so a simple job needs no long trip of the mouse and no scrolling a card.
9. **From a leg to its stretch, the route and the way under it** in one step, and details stacked in the card easy to reach. **A desktop says what a button does before you press it** (a tooltip with the line the phone shows under it).
10. **The pills:** MTB ▾ · Follow paths ▾ on a leg's card change the thing the card is about, with Undo.
11. **On a desktop,** the card docked beside the planner, as tall as its content, folding to its head; dragging it (#647) decided after trying it.
12. **Value at a glance** as drawn below; #855 and #757 as small PRs in this plan; #347, #854, #859, #160, #156 and #708 stay their own issues, with their place on the card drawn.
13. **The words** Card, Spot, Hold and Readout go into CONTEXT.md (done in this PR).

### Round 3 (2026-11-07, after trying the mock-up)

14. **The first size ends after the actions** (A), and it must be plain that there's more below.
15. **The buttons (B),** but **the rest of the actions stay on the card,** never hidden in ⋯ or anywhere else: more of them are important than ⋯ suggests (Not right? when the data is wrong, a waypoint's stop or night). A long card is fine. **The action row (A) fits some places too.**
16. **A desktop's short ways** (A): the card beside the planner, each kind's main action at the pointer, drag, Delete on the waypoint under the pointer.
17. **The order of the PRs** as listed (with what round 3 adds).
18. **Pass by · Stop · Night on the waypoint's card,** in sight, as today's hold card has it.

And from the same testing:
- **A way's card keeps production's profile,** Colour by and facts, with its actions first; it was left without its profile in the first drawing.
- **The warnings take a box beside the big numbers** (as the planner's warnings box is planned, #869): ⚠ 3 over "warnings", opening them; the list itself sits lower, after the profile.
- **⋯ beside ✕ stays,** for the card's own settings, not its actions; the planner gets the same ⋯ with its settings, such as putting it down or to the left (#884).
- **"Other ways" gets a name that says more:** Alternative routes is the first proposal.
- **The profile's readout says the way's details** (its name, kind, surface, smoothness, difficulty), as production's readout on the route does.
- **The weather is in sight on a card,** not behind a step.

### Round 4 (2026-11-07)

19. **Card settings (⋯):** Colour by, colours on the map, your route, and on a desktop where the card sits: a start that can grow, in the style of the route's list's settings menu.
20. **The action row** for places, spots and ways; buttons for a leg, a waypoint and a warning.
21. **Other ways becomes Alternative routes,** everywhere at once.
22. **The eye and Your route in Card settings, both.**

## The design

### The gesture rule (#876)

The same for every thing on the map, browsing or drawing:

| Gesture | Opens |
|---|---|
| **A tap or a click** on a thing (a waypoint, the line, a place, a way, a warning's marker, a search pin) | Its card, with its actions in sight |
| **A hold or a right click** on a thing | The same card |
| **A tap on the empty map, drawing** | Adds a waypoint, as today (#345) |
| **A tap on the empty map, browsing**; **a hold or a right click on the empty map** | The spot's card |
| **The keyboard** | Enter at the crosshair as a tap, Shift+F10 or the menu key as a hold; a waypoint's marker takes the focus, Enter opens its card |
| **A desktop's pointer** | The readout on the route and on ways, as today; a click on the line also puts its main action at the pointer (the `card-pill`), so adding a waypoint is a click and a click |

What goes: the tap's facts-only cards (`actions: false`, `spot.hold`), and the phone's line at the spot (#574), whose words become the card's first line. #716 (a left and a right click picking different ways) goes with it, as both open the same card. #845 (a tap outside a menu adding a waypoint) is its own Fix, but the same "a tap closes, adds nothing" rule.

### The card, kind by kind

Every card, top to bottom (New 3):
1. **Its head:** its mark, its name, one line (for the route's things, the weather then), ⋯ (Card settings) and ✕.
2. **Its numbers,** up to three, and where there are any, the **warnings box** beside them (⚠ 3 over "warnings", as the planner's box will be, #869), opening the list lower in the card.
3. **Its actions in sight:** for the route's own things (a leg, a waypoint, a warning) the main one green and full width, then two buttons; for places, spots and ways an **action row** of four (the main one green, each with its word).
4. **The first size ends there,** with the top of what follows showing and fading.
5. **What you inspect with:** for a leg, ‹ Leg 1/4 · Stretch · Route › and its profile; over every profile production's own readout of the spot (the way's name and kind, surface, smoothness, difficulty, and the weather then), Colour by and its words with lengths.
6. **What it knows:** facts in groups, its warnings, the way under it.
7. **More for this …:** the rest of its actions, as rows with their lines. Nothing is hidden in ⋯.
8. **Its foot:** where the facts come from, Add what's missing › (#855), Not right?.

**Card settings (⋯),** built as the route's list's settings are (`listMenu()`: its name and ✕ on a row of their own, a tap outside closes it alone): Colour by (a tick), Show (Colours on the map, Your route), and on a desktop where the card sits (Beside the planner, At the spot); kept for every card on this device. A start that can grow; the planner gets the same ⋯ (#884).

Green is the one main action and the values you pick (▾); everything you can tap has a visible label, ▾ or ›.

| Card | Its line | Numbers | In sight | More for this … (on the card) | To inspect, and what it knows |
|---|---|---|---|---|---|
| **A leg** (a tap on the line) | the weather then; MTB ▾ · Follow paths ▾ and the eye (#756) under it | distance, time, climb, ⚠ box | **Add a waypoint here** · Avoid this spot · Alternative routes | Stop here, Remove this leg (#627), Route style, On the route's profile, The whole route | ‹ Leg · Stretch · Route ›; its profile with production's readout; Under it: the way ›; Part of a LIPAS route ›; its warnings |
| **A waypoint** | the weather then; at a changeover, its sports | there at, from the start, height | Move · Rename · Remove (red) | Start here, End here, Reverse, Back to start (the end) | Pass by · Stop · Night and a stop's minutes; a changeover's minutes and Take … along; Leave › (the start); Sport from here ›; Next stretch ›; its legs' profile; Here: the way ›; Places to sleep, Water nearby (asked when tapped); Add a note (#854) |
| **A way** | how you get along it | long, up, down | action row: **Add to my route**, Avoid this spot, Share, Weather here | Start here, End here, Round trip from here, Copy, Look around here (#757), All OpenStreetMap details | production's card: its profile, Colour by, the facts in groups; Not mapped: … Add what's missing › |
| **A place** | its kind, town, where it's from | off your route, height, opening hours (or "not mapped") | action row: **Add to my route**, Avoid this spot, Share, Weather here | Start here, End here, Round trip, Copy, Save this place (#156), Look around here | the weather when you'd pass it; its facts (LIPAS's; OpenStreetMap's asked when it opens); Add what's missing ›; LIPAS, Website |
| **A warning** | Warning or Good to know | from the start, how long | its own (Avoid it, Retry), or none · Got it · Its leg | Hide in Check, Not right? | where it comes from, its note; ‹ 1 of 7 › |
| **A spot** | its coordinates | height here | action row: **Add to my route**, Avoid this spot, Share, Weather here | Start here, End here, Paddle from here (on water), Copy | what's there, asked as it opens (the way, or the water's depth from Traficom, shown, never routed on) |
| **A thing** (road works, a sea mark) | its kind | its dates or numbers | Share · Weather here | its source's page | its facts, where they come from |

**The first size** (a phone's peek) holds a leg's head, pills, numbers and actions: 361 px of 844 at 390 × 844 (a waypoint's and a place's about 288 px), against today's 178 px that held no action. At 200 % it's cut at 62 % of the screen and scrolls; the head's ✕ moves to its own row and the buttons go one to a row, as production's narrow cards do.

**On a desktop** the card is docked right of the planner (412 px from the left, 352 px wide), so the map loses 352 px more on its left: the build frames the pick in what's left (`frame()`), which the mock-up's still map can't show. Each kind's main action also comes up at the pointer on a click.

### Where today's actions go

PRODUCT.md: nothing is removed, and nothing takes more taps or a new hidden view. Every action today's cards have, and its home in the new ones:

| Today | Where | New |
|---|---|---|
| A waypoint's Move, Rename, Remove (hold only) | its card, in sight at once | the tap's card |
| Start here, End here (a via) | More for this waypoint, on the card | no hold |
| Pass by · Stop · Night | the card, as today's hold card has it | no hold |
| Sport from here › | the waypoint's card; the leg's MTB ▾ | two taps from the line, today four |
| A changeover's minutes and Take … along | the card, under its actions | as today |
| The start's Leave ›, Back to start, Reverse | the card: Leave a row, Back to start and Reverse under More for this waypoint | When on the first screen (#878) is the other way |
| The end's Back to start | More for this waypoint | |
| Next stretch › | the waypoint's card, a row | as today |
| The route's card: This stretch ›, What's here ›, Edit this stretch › | the leg's card: Leg · Stretch · Route, Under it ›, the pills | one card instead of four |
| Edit this stretch's How it's drawn and Route style | Follow paths ▾; Route style under More for this leg | |
| Other ways, Stop here, Avoid a spot here | Alternative routes and Avoid this spot in sight; Stop here under More for this leg | Other ways is now Alternative routes |
| On the profile | the leg's own profile; On the route's profile under More for this leg | |
| What's here's All OpenStreetMap details | Under it › | as today, a step from the leg |
| The whole route › | More for this leg | |
| A spot's Your route (hold only) | the card: the main action and three in its action row, the rest under More for this spot | no hold |
| Share, Weather here ›, Not right?, Copy, All OpenStreetMap details | Share and Weather here in the action row; Copy and All OpenStreetMap details under More; Not right? in the foot | Copy and All OpenStreetMap details no longer need a hold |
| A warning's main action, Got it, Hide in Check, Fix the map, Not right?, ‹ › | as today, with Its leg | |
| Paddle from here | More for this spot, over water | |
| A LIPAS route's Follow this route, Add to my route, Start a route here | its card as today, in this order | not redrawn |

### Taps for common jobs, today and new (phone, drawing)

| Job | Today | New |
|---|---|---|
| Change a leg's sport | 4 | 2: the line, MTB ▾, the sport |
| Add a place as a waypoint | hold, swipe, 1 | 2: the place, Add to my route |
| Avoid a spot | tap, swipe, 1 (on the line); else a hold | 2: the thing, Avoid this spot |
| Move a waypoint | drag; or hold, swipe, Move, tap | drag; or the waypoint, Move, a tap |
| Remove a waypoint | hold, swipe, 1 | 2: the waypoint, Remove |
| See a way's surface | the line, What's here › (and a swipe) | the line, Under it › (and a swipe); the leg's own Colour by Surface at once |
| See a stretch's climb | 2, one number | 2, with its own profile |

### Motion (for /animate in each PR)

From emil-design-eng: picking a thing happens tens of times a day, so a card replacing another changes at once; only the sheet's first rise from the map moves (today's `--t-sheet` on `--ease-drawer`), and a card opened from the keyboard doesn't move. The pill at the pointer grows from the click's corner (from 0.97, `--t-open`). The hold's ring stays as it is. Scrubbing a profile never animates. With reduced motion, each only fades.

### Touch (from apple-design and mobile-native)

- **A profile scrubs sideways, and leaves up and down to the sheet** (`touch-action: pan-y` on it), so a swipe on a card's profile still raises the sheet: needs a phone to check.
- **Press feedback on the press,** as every shared control has it; a hold's ring from 150 ms.
- **A hold never selects text or calls out** over the map (`-webkit-touch-callout: none`).
- **The small size holds the actions,** as Apple Maps' smallest detent holds a place's action row: the case for "to the actions" in round 3.


[mockups/cards-and-taps.html](mockups/cards-and-taps.html) (served at `/docs/plans/mockups/cards-and-taps.html`), and the same page as a [private Artifact](https://claude.ai/artifact/V1QqdwcbGRdhtiNYFE74C7). Its versions: **Today**, **Round 2** and **New 3** (the default). **Today** is `main` at babbafd: screenshots of each card by tap and by hold, phone and desktop. **New 3** draws round 3: the warning box beside the numbers, the rest of the actions on the card under "More for this …", ⋯ with the card's settings, Pass by · Stop · Night on a waypoint's card, Alternative routes, production's readout (the way's details and the weather then) over each profile, the weather in a card's first line, the first size showing the top of what follows, an action row for places, spots and ways ("By kind"), and a way's card as main has it (EuroVelo 10's own profile and facts, exported from the app). **Round 2** draws the cards with `css/app.css`'s and `js/ui.js`'s own classes and menus, over a screenshot of the map with the route; the route's heights, grades, surfaces, way types, times and warnings are main's own analysis. #574's version stays in [cards-rethought.html](mockups/cards-rethought.html).

- **To try:** tap, click, hold or right-click the line, a waypoint, a warning, the path north of Kaivopuisto, the campfire site on Uunisaari; drag or tap the grip through peek, half and full; scrub a profile; ‹ › and Leg · Stretch · Route; MTB ▾ and ⋯ open the app's menu; the eye hides the route.
- **Switches:** the card; Phone 390, 360, 200 % and Desktop; the actions B or A; the peek to the actions or with the profile; the data real, late, missing or with long names (main's own street names); drawing or browsing; light or dark.
- **Changed after the advice of 2026-11-07:** Under it › opens the way under the leg from the route's own data (not a way elsewhere); the spot says its real coordinates and asks what's there; the changeover's minutes and Take along, the start's Leave, Next stretch › and the end's Back to start are on the waypoint's card.
- **Not drawn:** the planner's sheet behind the card and the toolbar; motion (decided with /animate as each PR is built; the sheet keeps today's); the map moving; a carry, sea marks, road works and a LIPAS route under a leg.
- **Its screenshots** are on `pr-screenshots`, under `claude/cards-and-taps-d4b7c4/` (`new-*.jpg`, and `t-*.jpg` for Today). The template and its build script are in the session's notes; the page itself is self-contained.

**The design skills:** apple-design, mobile-native and emil-design-eng ran on the mock-up (their findings above, under Motion and Touch); break-ui's cases are the mock-up's worst case: 360 px, 200 %, long names, late and missing data, dark. **A fresh critique** (a subagent on the mock-up's screenshots) found, and the mock-up now does: at 200 % the peek cut its actions off (it scrolls now) and the buttons broke their words (one to a row now); a leg's warnings sat under its profile (now right under its actions, what's wrong with a leg first). Not taken: making Add a waypoint here quieter on a leg (the user chose it as the main action); the numbers' small grey labels and the route's mark by the title (production's own look, kept).

## The PRs

Small, each tried on a phone before the next, starting from production. Motion in each is decided with /animate; one that moves something stops for /review-animations. **What each closes:** PR 1 fixes #876 and #716 (both gestures open one card), and #760 (its rule, with PR 2's layout); PR 2 is #690's discoverable actions; PR 4 fixes #107's planning half (the way under the route) with PR 6; PR 6 fixes #756; PR 7 is #647's first step, so #647 stays open for the drag; the leg's Remove this leg (PR 4's ⋯) fixes #627's first part; PR 11 fixes #855 and #757. The last PR of the order fixes #690.

1. **A tap and a hold open the same card** (#876, #760's rule): the tap's card gains the hold's actions (a waypoint's, a spot's and a place's Your route), in the order of "The card, kind by kind", and a hold or a right click open the same; a waypoint's marker takes the focus. `openPointCard()`, `openSpotCard()`, `openPlaceCard()`, `pickBody()`, `spotBody()`, `renderMarkers()`. Checks: `spotcard`, `pointcard`, `crosshair`.
2. **The actions first:** under the numbers, the main one green and two buttons (an action row for places, spots and ways), the rest under them on the card as "More for this …"; ⋯ beside ✕ with Card settings, as the list's settings menu; the peek ends after them, showing the top of what follows. `js/cards.js`, `measureSheet()`. Checks: `spotcard`, `pointcard`, `routecard`, `sheetstops`, at 360 px and 200 %.
   **Built (2026-11-07, with #886):** as above, with what the app has today: the route's card at a spot stands in for the leg (Add a waypoint here, Avoid this spot, Other ways where BRouter routed it; More for this leg: On the profile, The whole route), and a warning has its main action and Got it (Its leg is PR 10). Card settings holds Colour by and Colours on the map; hiding the route and where a desktop's card sits come with PR 6 and PR 7. The phone's pill over the map went, its action being on the card; a desktop keeps it as the card's first button at the pointer (decision 8), until PR 7 docks the card; the peek keeps #603's 52 % cap, so at 200 % the actions are a swipe and a scroll away. A card tapped while the sheet is folded opens at its peek too (the user's choice while building, 2026-11-07; step 3 of #233 opened it folded). A waypoint made from a place takes the place's own name (#886).
3. **The line at the spot goes:** a phone's tap opens the card at its peek. `showLine()`, `pickLine()`. Checks: `spotcard`.
4. **The leg's card:** a tap on the line opens the leg, with the weather then in its first line, its numbers, its warnings (as a box beside them, sharing #869's control for the planner, its PR 9), its profile (the pick's chart on the leg's slice of the route's analysis, no new request), ‹ › and Leg · Stretch · Route; the route's card, This stretch and What's here go into it. `routeCard()`, `stretchCard()`, `hereCard()`. Checks: `routecard`, `pickcard`.
5. **The pills on the leg's card:** MTB ▾ · Follow paths ▾, after #869's caret and pill (its PR 11). `setStretch()`. Checks: `routecard`, `multi`.
6. **Under it ›, a LIPAS route ›, and the eye** (#756). Checks: `routecard`.
7. **On a desktop, the card beside the planner** (#647's first step) with the main action at the pointer. `card.js`'s `float`, `frame()`. Checks: `routecard`, `onroute`, at 1440 × 900 in both docks.
8. **A place's facts when it opens,** how far off the route, its hours in words. `osmOnCard()`. Checks: `spotcard`.
9. **A waypoint's value:** the weather then, Pass by · Stop · Night on the card, its legs' profile, Places to sleep and Water nearby. Checks: `pointcard`.
10. **A warning's Its leg ›.** Checks: `heads`.
11. **Add what's missing › (#855) and Look around here › (#757).**
12. **Other ways becomes Alternative routes,** everywhere at once (the leg's card, the toolbar's menu, Check; PRODUCT.md's and CONTEXT.md's words).

## Round 3's questions, as asked (answered under "Decided")

14. The first size: to the actions, or with the profile.
15. The actions' look: B (buttons) or A (the action row).
16. A desktop's short ways. The card beside the planner keeps the map clear, but every action on it is a long trip from where you clicked, and it covers the map's left (here the route's start, which the build would frame aside). The mock-up puts each kind's main action at the pointer too (Add a waypoint here on the line, Add to my route on a place, a way or a spot); dragging a waypoint stays; Delete on the waypoint under the pointer would make removing one a key. Or: the card at the spot as today, its actions in reach, covering what it's about (#647).
17. The order of the PRs above.
18. A waypoint's Pass by · Stop · Night: behind ⋯ (as drawn), or the switch on the card as today's hold card has it.
