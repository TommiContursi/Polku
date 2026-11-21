# Polku's usability, 2026-11-03: where it stands, and what to do next

An assessment asked for by the user on 2026-11-03, after the cards (#623) went live and six phone screenshots showed the toolbar and Edit/Done moving about. It answers one question: how much of the planner's plan is still worth finishing, what to stop, and what comes next. It decides nothing: the user chooses, and the proposals at the end are for discussion.

**What was looked at:** `main` at f121d64, served from a worktree in Claude Code's browser pane, at 1440 × 900 with a mouse and at 390 × 844 by touch (Chromium's phone emulation, not a real phone); the issues #233, #660, #690, #692, #528 and #623 with their comments; the plan in [issue-233-calmer-planner.md](../plans/issue-233-calmer-planner.md) and the Project board; the user's screenshots of Polku and of Strava's route builders. The journey: Plan › Draw it, two points, a third by mistake, hover and click on the route and on a path, Check, Go, Done, the cards in the view, Edit, a point's card by tap and by hold, the next stretch's card, the sheet at every size, a reload. **Not checked:** a real phone and its hold gesture (the hold's card was opened by firing its right-click event), 200 % and 360 px, round trips, Marked routes, imports, water, the desktop at 1024 px, dark mode, keyboard and screen readers.

## What works

Keep these; nothing below changes them.

- **The start.** Four equal ways with one line each, the sport in a row of its own, and a clean map. It's the best screen in the app, and #660 is right to keep it.
- **Drawing itself.** A tap adds a point, the route follows the paths, Other ways come after a pause with labels that compare, undo is one tap away. The route's numbers update under the finger.
- **The sheet's stops and the folded line.** One swipe folds to a line with the numbers, a second puts it away, and the planner comes back as it was left. The spring feels right.
- **The route's information.** The profile with Colour by, the climbs, the breakdowns, the weather at the hour you get there, Check's three groups with their sources, Go's time table, the hover readout on a desktop. This is Polku's depth, and none of it needs redesigning.
- **The way's card.** One joined street or trail drawn on the map with its length, its profile, what cycling along it is like, and "Not mapped" said once. The content of #623 is good; its *entry* is the problem (below).
- **The words.** "Click the map for your next point", "Another way for this part: tap it on the map to take it", "Undo brings it back". Plain and true.

## What gets in the way

Five things, in the order of their weight. The first is the cause of the next three.

### 1. One tap, four meanings

A tap on the map means a different thing by state, and nothing on the screen says which state you're in:

| State | A tap on a path | A tap on your route | A tap on a point |
|---|---|---|---|
| Editing | adds a point | the route's card | the point's facts, no actions |
| The route's view (after Done) | the path's facts, with "You're not editing" and Edit | the route's card | the facts, with "You're not editing" and Edit |
| Planner put away | the path's facts, no actions | the route's card | the facts |
| Folded line | adds a point | the route's card | the facts, folded to a line |
| A hold or right-click, in any of them | facts and actions (Start here, Add to my route, Avoid…) | Edit this stretch | facts and actions (Leave, Move, Remove, Next stretch…) |

Seen on the desktop: a click 5 px off the route, meant to look at it, appended a point at the end, so the old end became via 1 and the route doubled back on itself. Twice, with the hover line showing the path under the pointer rather than the route. On the phone, a tap on a point gives when you're there, how far along and its height, and nothing to do; Remove, Move, Leave and Next stretch come only with a hold.

**Edit and Done exist only to settle what a tap does.** Pressing Done changes nothing in the panel that matters (the same profile, tabs and lists), but it swaps the title row, replaces a 14-button toolbar with Edit, delete and ⋯, and makes every card nag "You're not editing: the route stays as it is". A mode whose only visible effect is a different set of chrome is the thing people can't learn.

### 2. The tools move (phone), and are far away (desktop)

On a phone the toolbox has five shapes for one route (the user's six screenshots, reproduced):

| Sheet | Editing | The route's view |
|---|---|---|
| Folded | mode icon, undo, redo, floating bottom left | nothing |
| Peek | mode and style, undo, redo, ⋯, floating above the sheet; Done in the numbers row | a lone ⋯ floating bottom left; Edit in the numbers row |
| Half and full | the same row docked into the sheet's top | ⋯ in the ⌄ row at the sheet's top left |

Each of these is a reasonable answer to a local question (room for the map, what can act now). Together they mean the one control a person reaches for is never where it was. Strava's four round buttons sit above the sheet's edge at the thumb in every state and never change their contents; that, more than anything else in the screenshots, is what makes it feel easy.

On a desktop the toolbar sits at the map's foot while the panel is at the top left: the route's numbers and its tools are 800 px apart, and at 1440 × 900 the three drawing modes have already folded to icons. #624's Done/Edit at the toolbar's end is stable, but it's stable far away.

### 3. Cards: facts on a tap, actions on a hold

#623 split a tap (look) from a hold (do), on purpose, so that looking never changes the route. The effect: the useful half of every card is behind a gesture nothing announces. On a desktop with the planner put away, a left click shows the path's card and a right click shows the same card with Start here, End here, Add to my route, Round trip from here and Avoid this spot as buttons at its top. The buttons are good; the right click is the only way to them. A newcomer who wants to delete a point can't find Remove.

Two more card findings, both already filed:
- **The stretch's card is thinner than a stranger's path.** A tapped road gets a profile, its surface, width, lighting and weather; the stretch of your own route between two points gets distance, time and climb (#690's second comment). The data is already in the analysis.
- **A card opened from a card drops to the peek.** From a point's card at full, Next stretch opened the stretch at the peek (#692). The first tap on Next stretch at full did nothing but replace the card's title row with Undo and Redo, once; the second opened it.

### 4. The tabs hold buckets, and the departure is hidden as an underline

Route, Check and Go are where features live, not what someone wants to know next. With no warnings, Check on a desktop opens with "Hardest climb —", then the list of sources Polku looked at, then eleven breakdowns: the meaning (nothing to read before you go) is never said. Go holds the departure, the time table, the weather and Take it along: four jobs in one tab.

The departure that #660 wants "visible and editable at once" is already in the peek: the "from now" under the minutes is a dotted-underlined link that opens Leave. It's there in every state; it looks like a caption. The hold's card on a point has Leave as a row too. So this is an affordance problem, not a missing feature.

### 5. Smaller things, noticed on the way

- After a reload with one point, the planner reopened on the remembered Go tab, showing an empty "Departure & weather" heading and nothing else.
- Opening the planner at full on a phone showed its header and profile over a blank sheet for about a second before the tabs drew.
- Escape with no card open closed the planner, and E then showed the keyboard's crosshair legend on a phone-sized screen.
- A right click and a left click at the same pixel picked different ways (Reitti 2000, 25 km and 122 pieces, against a footpath): a pick a few pixels apart gives a card about a different thing.
- The "Zoom in to see every trail" note on a desktop sits in the panel's corner.

## Against the plans

### Calmer planner (#233): what remains, classified

The phase has delivered its design: the toolbox, the start, the sport, Done and the view, Check's groups, the sheet's stops, Fold then away, the route's and the map's cards, the desktop toolbar. What's open in the milestone, as the user asked on 2026-11-01:

| Issue | What it is | Verdict |
|---|---|---|
| #692 | a card opened from a card drops to the peek | **Finish now.** A small, self-contained fix in `CardHost.onChange`; it's needed in every model. |
| #527 | the Zoom in note covers a card on a phone | **Finish now.** Small. |
| #386 | the profile has no name, the tabs read "Check1" | **Finish now.** Accessibility, independent of layout. |
| #235, #208 | targets under 44 px and tap flashes outside the planner | **Finish now,** one PR. Real-phone quality, independent of the model. |
| #453, #344 | 200 % on a phone: the full sheet ends at the profile; the map's buttons run off the top | **Check, then close or finish.** Step 3's part 1 says it fixed both; the issues are still open. |
| #669 (PR) | the folded toolbox gets its style and ⋯ back | **Merge.** It moves the folded state toward one fixed row (below), and it's reviewed. |
| #303 | put the floating tools away in one move | **Close as done by Fold, then away** (#558, #603): one swipe folds, a second puts away. What's left is the timeline, which is #431's. |
| #338 | swipe the start's views down to see the map | **Park.** Its route part is built; the start's views keeping their peek was decided on 2026-10-28. |
| #377, #431 | the timeline covers the tabs; the weather as a card | **Defer until the tap and toolbox decision.** #431 is big and is built on the sheet's rules; #377's smallest fix (the timeline folds to its line when the sheet is at half or full) can go with it or as a Fix PR. |
| #304 | Polku's own tooltips everywhere | **Defer.** Desktop polish on controls that may move. |
| #568 | the view's desktop toolbar shows Share, GPX and Save offline | **Supersede.** If the toolbar stops changing with the view, this is moot. |
| #647 | a desktop card can be moved off the way it covers | **Defer,** with the card model. |
| #708 | Avoid this spot: edit the area, a toolbar action | **Later,** its own enhancement; the toolbar's slots are decided first. |
| #379 | the design-system audit, part 2 | **Replace with this review** as the baseline; don't audit the current interface a second time. |
| #365 | newcomer and expert passes before the milestone closes | **Keep as the acceptance gate,** run once the changes below are on `main`, not before. |
| #530, #531, #532, #526 | watches | leave in the milestone; none blocks. |

### #660: the step-by-step journey

Take from it: the four-way start kept; one obvious next action in a stable place; no control moving under the finger when data arrives; departure reachable while building; a single, consistently placed way to the advanced controls; the contextual suggestion for lit ways after dark; small PRs tested on a phone before the next.

Drop from it: the stages themselves. Build → Set up → Check → Take along, with Back and Next, is Route, Check and Go under other names plus a navigation layer. The findings above don't come from the tabs; they come from the tap, the toolbox and the hidden actions. A wizard built on top of those would carry them along, cost a second #623-sized change, and give the user a new set of transitions to learn. The three tabs can stay; what each shows first can change (Check opens with its verdict; Go with Leave).

The lit-ways suggestion needs no new machinery: the route already produces the warning "In the dark for 3.70 km". That warning's card gets a **Show lit ways** button, as other warnings have Avoid.

### #690 and #692

They are the second half of the same decision as #660's "challenge Edit/Done": once a tap's meaning is settled, the cards show their actions on a tap and keep the hold as a shortcut. #692 is independent and small: do it first.

### #528: the sprint's first cut

#518 (read warnings shorten the list), #508 (the weather where you'll be, on hover) and #432 (what a route style does, in a sentence) are all capabilities inside Check, the profile and the style menu, which no model change touches: they're still worth doing, after the changes below. #234 (distance marks say the distance by default) is a one-line default and can go in any Fix PR. #157 and #128 (a list of saved routes; a share link that doesn't overwrite your route) stay valid and separate. Nothing in the sprint needs the wizard, and nothing in it should wait for one.

### Strava, as a reference

What to take: the tools at the thumb, above the sheet's edge, the same in every state; one line in the sheet that says the next action; a stats row that's always there; the profile's hover readout (Polku has it). What not to take: its single persistent Save button (Polku keeps the route on the device as you draw, which is better), its two-size sheet (Polku's four stops are earned by its content), and its lack of any way to look at the map while building (Polku's cards are the reason to prefer it).

## The recommendation

**Direction: one visible tool and one fixed row, not a new navigation.** Make the state that decides what a tap does visible, named and in one place; give the toolbox the same slots in every state; put the cards' actions on the card. Nothing is removed, nothing is renamed that people have learned, and each step ships on its own.

**The one decision to make with a mock-up, two versions, the user choosing on a phone:**

- **Version 1, "Add points" is a tool.** Edit and Done become one toggle in the toolbox, **Add points**, pressed while drawing. On: a tap on the map adds a point, as editing does today. Off: a tap opens what's there, and the card has its actions. Nothing else changes between on and off: no title row swap, no toolbar swap, no "You're not editing" rows, no second set of card contents. A hold or a right click opens the same card either way. With no route, Draw it turns the tool on. This is the smallest change: it's today's mode, made visible and stopped from reshuffling the screen.
- **Version 2, a tap always adds while the planner is open; looking is one step.** No toggle. A tap on empty map or a path adds a point whenever the planner is open at any size; a tap on something with a card (a point, the route, a place's icon, a hazard) opens the card. To look at a path while drawing: a hold, or a **Look** button in the toolbox that makes the next tap open a card (one tap, not a mode, like Move's "tap where it goes"). Putting the planner away is the way to browse. Faster for drawing, closer to Strava, but a path's facts while planning stay a step away.

The mock-up draws both at the peek, half, full and folded, editing and not, with a warning on the route and the weather late, at 390 × 844, 360 × 740 and 200 %. It is one file in `docs/plans/mockups/` with a switch, as the others, checked with the design skills. No more than that before the user chooses.

**The fixed row,** in either version, on phones: five slots in one order, **[tool] [how the next leg is drawn · style] [undo] [redo] [⋯]**, at the sheet's edge at every size (floating above it where there's room, docked as its first row where not, as today, but the same five slots and the same left edge in both), and the same five folded. The route's view, if it still exists, keeps the row. ⋯ keeps the whole route's actions and Take it along. On a desktop the toolbar's contents stop changing with the view, and the mock-up tries the toolbar at the panel's foot against the map's foot, since the distance is the complaint there.

**The staged build,** each a PR the user tries on the phone before the next starts, each with its smoke check:

1. **Stability first, no design:** #692, #527, #386, #235 with #208, and #669 merged. Each a small Fix PR, in any order, now.
2. **The row:** the toolbox's five slots in every state, on phones, and the desktop toolbar no longer changing in the view. Done and Edit still work as today. Observable: the row is in the same place at every size.
3. **The tool:** the chosen version. Done and Edit go; the title row stays the same in both states; the "You're not editing" rows go. Observable: no accidental points, one named control.
4. **The cards' actions:** a tap's card shows what a hold's shows today (a point: Leave, Sport from here, Next stretch, Move, Rename, Remove; a path: Start here, End here, Add to my route, Round trip from here, Avoid this spot), with the hold kept as a shortcut. One kind of card per PR if the diff grows.
5. **Parity and the departure:** the stretch's card gets its own profile and facts from the analysis (#690); "from now" becomes a chip, **Leave now ▾**, in the numbers row; Check opens with its verdict ("Nothing to read before you go" when so). The "In the dark" warning's card gets **Show lit ways**.
6. **Acceptance:** #365's newcomer and expert passes on `main`, then the retro and the milestone closes.

What's deliberately not in this: a wizard; a new card framework; the weather card (#431), which waits for the row to settle; a new look (#547); anything in Codex's OSM and Overpass work.

## Three ways to sequence it

- **A. Stabilise, decide, build (recommended).** Stage 1 now, the mock-up next, then stages 2–5 one PR at a time, then stage 6. Trade-off: the first visible change to the model is three PRs away; the user tries real improvements every few days from the start, and nothing built is thrown away.
- **B. #660's prototypes first.** Two clickable journeys with stages before any code, as #660 asks. Trade-off: the longest wait before anything ships, and the tap and toolbox questions have to be solved inside the prototypes anyway; the risk is a second large change decided from mock-ups rather than from use.
- **C. Finish #233 as listed.** Step 3's weather card, tooltips, the audit and the journeys, then the sprint. Trade-off: polishes a mode the user has already found confusing, and the weather card is the biggest remaining piece built on rules that may change.

**On the milestone:** #660 doesn't belong in Calmer planner. Close Calmer planner after stage 1 and the acceptance pass of what's there, moving #431, #377, #338, #304, #647 and #708 out with a reason, and open a milestone for stages 2–5 ("One tap, one row", or whatever name reads well in a PR title) holding #660, #690, #692's follow-ups, #627, #107 and #568's decision.

## Proposed GitHub updates (for the user to approve; none made)

- **#233:** a comment with the table above as the current status; the six-step list of 2026-10-25 marked superseded by it.
- **#660:** a comment: the start kept, the stable primary action and departure taken, the stages not built; the mock-up's two versions as the next deliverable; milestone moved.
- **#690:** a comment: stage 4 is its build; #107 closes with it; #627's Remove this stretch joins the stretch's card in stage 5.
- **#692:** assign to stage 1, Fixes: November 2026.
- **#528:** a comment: #518, #508 and #432 stay valid after stage 5; #234 goes in any Fix PR; no sprint before stage 5.
- **#303:** close as done by #558 and #603. **#379:** close, replaced by this review. **#568:** park until stage 2.
- **#669:** merge after a look on the phone.
- New issues, if the user agrees: the Leave chip; Check's verdict line; Show lit ways on the dark warning; the stretch card's profile (or fold it into #690); the empty Go tab after a reload; the blank sheet at full for a second.
