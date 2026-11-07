# The cards and what a tap does, rethought (#690)

The design for [#690](https://github.com/TommiContursi/Polku/issues/690) (primary), [#876](https://github.com/TommiContursi/Polku/issues/876) (one rule for a tap, a click, a hold and a right click), [#760](https://github.com/TommiContursi/Polku/issues/760) (a spot's popup) and [#647](https://github.com/TommiContursi/Polku/issues/647) (on a desktop the card covers the way), looking at #107, #716, #845, #627, #796 and #859 too. Milestone: [Calmer planner](https://github.com/TommiContursi/Polku/milestone/16).

**Where it stands (2026-11-07): research and inventory done; the first round of questions is with the user.** Nothing is decided yet. Each decision goes under "Decided" as the user makes it, and the mock-up follows the first round.

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

## For the user to choose (round 1)

1. Which old mock-up to redraw.
2. What a tap opens.
3. What a tap on the route's line opens: the leg or the stretch.
4. Where a card sits on a desktop.

The card's anatomy, the "MTB ▾" pill's scope, the words and each kind's value follow in round 2.
