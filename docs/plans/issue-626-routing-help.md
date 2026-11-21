# Routing help (#626)

The plan for [#626](https://github.com/TommiContursi/Polku/issues/626), in the [Routing help](https://github.com/TommiContursi/Polku/milestone/19) milestone, planned for November 2026 after Calmer planner. The mock-up is [mockups/issue-626-routing-help.html](mockups/issue-626-routing-help.html). Written on 2026-10-31 at `main` b272170. Nothing here is built yet, and the user chooses before it is.

## What people get

Someone drawing a route sometimes gets a route they didn't mean: a long loop round a fence, a point that jumps onto the road, a line that won't cross a 20 m gap between two paths, or no way to the island they tapped. Today Polku draws its best route and leaves them to fight it by dragging. With routing help, Polku says what it thinks happened in one sentence, and offers the way they probably meant beside the routed one, with the difference and what it costs. They compare both on the map, take one with a tap, and Undo takes it back.

## What's there today

All of this stays, and routing help builds on it rather than beside it:

- **Other ways** (`offerAlts()`, `altWay()`, `drawAlts()`, `pickAlt()` in `js/planner.js`). A leg you've just added at the end gets up to two of BRouter's alternatives on its own, paced (ALT_PAUSE, ALT_MIN 300 m, headroom 3). They're drawn on the map beside the leg, each with a two-line label ("Other way" / "+40 m · all on trails"), and the route's own leg gets a label in the same form ("This way"). A tap on the map takes one, in one step of Undo, and the way you had stays as a grey ghost until the next point. The leg's card has **Other ways** for any leg (`js/cards.js`).
- **The short cut through a way marked private** (#104, #117: `detourWarnings()`), at least 100 m and 25 % shorter on the affected stretch, read from the map's tiles. It's one more of the Other ways (violet), labelled "Short cut, marked private" with its saving.
- **The picked spot** (`pspot`). When the router moves a point off a way marked private or closed, Polku keeps where you put it, saves it with the route and in links, and Check says so.
- **Snapping** (`snapPoints()`). A point beside a path moves onto the route's end, up to 400 m.
- **The open-water note** (`onOpenWater()`, `offerPaddle()`, `waterFrom()`). A tap on open water while drawing on land asks "This point is on the water. How do you get there?": Paddle, Swim, on the ice in winter, or Stay on land. It uses the `toast choice` control: the question, then each answer on a line of its own, 44 px tall.
- **Legs of their own.** Every leg has its mode (Follow paths, Straight line, Over water), sport and route style, saved and shared. So any change to one section can be made of shaping points at its ends and a leg between them, in the formats Polku already has.

What's missing: Other ways can only be taken by tapping the map (no keyboard or screen-reader way), its labels can print over each other (#244), it never says *why* a way is offered, and nothing helps with the other six situations in #626.

## The decisions

These answer #626's "Choices still open". Each is a recommendation; the mock-up shows it, and its switches show the other answer where there's a real choice.

### 1. One place: Other ways, with a reason

Every situation produces ways in the same Other ways set, drawn and taken the same way as today. Each way has a **kind**, and its label's first line names it, so the map never says it by colour alone:

| Kind | First line of its label | Second line | Drawn |
|---|---|---|---|
| A routed way (today) | Other way | +40 m · all on trails | solid, in the Other ways colour |
| The short cut (today) | Short cut, marked private | saves 600 m · only where you may go | solid, violet |
| Straight to your point | Straight to your point | 40 m · not checked on the ground | dashed, like a straight leg |
| A straight gap | Straight over the gap | 20 m · not checked on the ground | dashed, only over the gap |
| The path you meant | Along the cycleway | +60 m · beside the road | solid |
| Another style here | Shorter, more gravel | −1.2 km · 900 m gravel | solid |
| Over the water | Paddle across | 400 m on water · then on foot | solid, in the water's blue |
| Walk the bike | Walk the bike | 300 m · about +6 min | dashed |

The note that comes with them says why, in one sentence, and never more than Polku knows:

- a known cause, said plainly: "This part goes round a way marked private."
- a guess, said as a guess: "The router moved your point 40 m, onto the road."
- missing data, as missing: "Polku can't see a mapped way across here. That doesn't mean there isn't one."

**Why:** #626 asks for this, and it keeps one way of comparing and taking a route. A second panel for "help" would be a second way of doing what Other ways does.

### 2. On its own only when the evidence is in hand

| Comes on its own, after the point is placed or the drag ends | On request, in the leg's card's Other ways |
|---|---|
| Straight to your point: a point snapped more than 25 m from where you put it. A second drag of the same point within 30 m of its last spot makes this the first answer | Another style for this part |
| The short cut, as today, once #127 keeps tunnels, roadworks and cycle tracks with a sidewalk out | Walk the bike |
| Over the water: the open-water note, now also at the end of a drag, and for a point on an island the land route can't reach without a long detour | The path you meant, when it didn't come on its own |
| The path you meant: a point snapped onto a road with a cycleway or footway that suits the sport within 20 m (one routing call) | Straight over a gap |
| | The routed Other ways for a leg that was inserted or dragged (#173) |

Nothing comes while a finger is down or a drag is running, and nothing delays the leg being routed: the checks run once the leg is in. The ones on their own cost no routing call, or one, inside today's pacing (headroom 3, maxWait 0). Everything on request goes through `request()` and may wait its turn, as the leg's Other ways do today.

**The other answer:** everything on its own. It would spend brouter.de's pacing on guesses (#139), and fill the map while someone is only sketching.

### 3. Thresholds

- **Snap:** 25 m from where you put it. Below that a finger's width explains it. This is new and untested: part 2 checks it on recorded taps.
- **Detour:** today's 100 m and 25 % on the affected stretch, for the short cut. Unchanged.
- **Another style:** offered when it saves at least 300 m or 10 % of the part, on request only.
- **A gap:** up to 50 m straight. Longer is a straight leg, which the toolbox already draws.
- **A deliberate route stays itself.** A round trip, a LIPAS route or an imported track gets nothing on its own, and neither does a leg with a scenic style (Scenic, Near the shore, Nature paths): shortening it isn't help.

### 4. Previews

Ways are drawn as soon as they're found, as Other ways are today: the map is where you compare them. The note's answers and the card's rows light their way on the map while pointed at or focused, as Check's rows light their stretch (`showLit()`). Nothing is taken without a tap.

**The other answer:** draw only after a tap on "Show". It costs a tap every time and hides the comparison the label already gives.

### 5. A way you said no to stays away

Closing the note (✕, Stay as it is, or Escape) or drawing on without taking a way puts that leg's key in a set of dismissed ones for the session. The same way doesn't come on its own again for the unchanged leg. A changed leg (a point moved, another style) is a new situation. The leg's card's Other ways always has them. The set isn't saved: a reload starts fresh.

### 6. A change is for its part only

- Taking a way changes the part between its ends. Polku adds shaping points at the ends where they're needed, and gives the leg between them its mode, sport or style. The legs before and after keep theirs, and so do the rest of the route's points, styles and sports.
- **A sport change from a suggestion is for that part only:** paddle across to the island, then on foot again. The open-water note keeps today's answer (on from here in that sport), because a point *on* the water means you're on the water.
- **One step of Undo** for each way taken, as `pickAlt()` does. Redo, reload and share links keep it, because it's made of points and legs the formats already carry.
- **Walk the bike** is the one that needs something new in the route's format: a leg on foot with the bike taken along, so the time uses walking pace and the gear check doesn't say "the bike stays at Via 2". That's part 5; its readers, writers and tests change together, and nothing old is kept for compatibility.

### 7. Not by the map alone

The leg's card gets the ways as rows (`row` in a `rows` list, its kind as the name, the difference as the value, the tradeoff as its line), under the heading Other ways. Keyboard and screen readers take a way there, and on a phone a row is a bigger target than a line on the map. The rows are #574's card (the cards, rethought), so this part waits for #623.

### 8. A straight line proves nothing

A straight part, a gap or a walking part says so in Check (Worth a look: "Straight line: not checked on the ground"), and its label says it on the map. A way marked private says "only where you may go". A water crossing says what the water router checked, as water legs do today: for planning, not navigation. Known restrictions and warnings along the new way are Check's, as for any leg.

## The related issues

| Issue | What happens to it |
|---|---|
| #127 (short cuts through tunnels, roadworks, cycle tracks) | **Joins part 1.** #626 says to fix it before more short cuts are offered |
| #244 (two Other ways' labels print over each other) | **Joins part 1.** More kinds of way make it worse |
| #86 (taps land on the road beside a cycleway) | **Joins part 3.** Its fix A (put the tap on the path that suits the sport) and B (offer the cycleway) are "the path you meant"; its fix C (road and gravel profiles that prefer cycleways) is a profile change in the same part |
| #173 (Other ways only for the leg you've just added) | **Done by part 2:** inserted and dragged legs get the no-call ways on their own, and routed ones on request, because of #139 |
| #220 (one-way streets and pushing sections) | **Its check runs in part 5,** before walking the bike is offered. The issue stays a watch |
| #139 (Other ways cost routing calls) | **Stays a watch.** Decision 2 keeps the calls on their own at today's level |
| #141 (private ways checked only where the map has loaded) | **Stays apart.** The notes' words don't claim more (decision 1) |
| #142 (share links don't say a point was moved off a private way) | **Stays apart.** Straight to your point keeps the spot itself, which links already carry |
| #197 (Hike and Run over foot=private) | **Stays apart:** a profile question |
| #274 (Route DNA) | **Stays apart.** The label's second line is the short form of a comparison |

#86, #127 and #244 moved into this milestone on 2026-10-31, the user's choice (AGENTS.md: a fix whose code a phase rebuilds).

## The parts

Each part is one PR, Opus at high effort (routing). They come in this order; each part's checks use recorded map tiles and router answers in `tools/fixtures/`, or `tools/brouter-local.sh`, never bursts to brouter.de.

1. **Other ways that say why, and that a keyboard can take.** The kinds and their labels, the note's reason, the dismissed set, the leg's card's rows (after #623), #244's labels and #127's filter. No new situation yet: the short cut and today's ways in the new form.
   - Checks: two ways close together don't print over each other (#244's scene); a short cut through a tunnel or a cycle track with a sidewalk isn't offered (#127's Helsinki tiles); a way taken from the card by keyboard, then Undo, Redo and a reload; a dismissed way doesn't come back for the same leg. Smoke groups: otherways shortcut detour access heads routecard.
2. **Off-path points.** Straight to your point after a snap over 25 m and after a second drag; the no-call ways for inserted and dragged legs (#173). Points snapped onto a way marked private keep today's row.
   - Checks: a tap 40 m off a path, a second drag to the same spot, a 10 m snap that offers nothing; the point stays where it was put after a reload and in a share link; nothing comes while the drag runs. Groups: otherways editing routemenu heads.
3. **The path you meant, and gaps.** #86 A, B and C; Straight over the gap on request; the wrong parallel way, with bridges and junctions read from the tiles (a crossing on the map isn't a junction).
   - Checks: #86's own checks (a tap a few metres off a cycleway beside a road, road and gravel with the cycleway setting on the local BRouter, `tools/style_probe.py`); a 20 m gap inside a long route keeps its routed parts before and after; a bridge over a road isn't offered as a junction. Groups: otherways editing access sports.
4. **Water and islands.** The open-water note at a drag's end; a point on an island; the crossing for its part only, with the land parts kept; bridges and ferries checked first.
   - Checks: an island reached by a bridge gets nothing; an island without one offers Paddle across with the land parts kept; the water leg uses the water router (keep-clear zones, Not checked when a source fails); reload and share. Groups: water multi otherways heads.
5. **Another style for a part, and walking the bike.** On request, from the leg's card. Walking needs #220's check first, and its format change (decision 6).
   - Checks: a style for one part keeps the route's style elsewhere; a walking part's time at walking pace and no gear warning; a deliberately scenic route gets nothing on its own; the format change in saves, links and GPX export together. Groups: otherways sports stops heads flow.

Every part also checks touch and keyboard, 360 px and 200 % zoom, light and dark, and the service failing, answering late or out of order (AGENTS.md). The ones that move something (the note rising, a way lighting) are decided with /animate, and the user runs /review-animations before the PRs leave draft.

## Not in it

- Changing the sport or mode on its own, without a tap. #626 says that would need a decision of its own.
- New routing services or a router of Polku's own.
- Anything that says a straight line, a private way or a crossing is safe or allowed.
