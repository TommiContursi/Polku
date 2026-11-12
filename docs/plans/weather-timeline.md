# The weather timeline: the layers as buttons, then your trip

A design round for #869, in [Calmer planner](https://github.com/TommiContursi/Polku/milestone/16). No app
code is written here. The mock-up is [mockups/weather-timeline.html](mockups/weather-timeline.html), also a
[private Artifact](https://claude.ai/artifact/5cLEyQFboky2ZYumGHZpeA) to try on a phone (built with `css/app.css` and
`js/ui.js` inlined); **Today** in it is `main`'s timeline (with #988).

**Where it stands (2026-11-13):** chosen by the user on the whole, after trying the mock-up: see "Chosen" below.
The build of lines 1 to 7 is the four PRs under "The build", one at a time, each tried on a phone before the next.

## The list that counts (set by the user, 2026-11-12)

The whole of what the planner and the weather have to do, from #869's journeys and points, each checked against the code
on `main` on 2026-11-12 (at 3facfe75). Where a point is partly done, the line says what's left. The work goes against this list, each PR says which
of its lines it closes, and nothing outside it is done without asking. Nothing in #869's description is dropped unless
the user says so. `main`'s look stays.

**Done, on `main`:**
- Starting a trip from scratch: the ways to begin, and a searched place's card with Start a route here and Add to my
  route (#871, `spotActs()` in `js/cards.js`).
- When you leave: Leave now and Leave at…, a row on the first screen and the trip box's pill (#878, #969, `js/when.js`).
- Multisport: each part's heading opens its sport, speed and route style (#848), and a waypoint's card has Sport from
  here.
- The profile in the peek (#742, #889).
- Show all waypoints, in the Waypoints section's heading tools (#761, `listTools()`); its side not checked in the app.
- Go's contents in the weather card, and Go's tab gone (#973, #794, #759).
- Warnings called Warnings in the planner's lists (#853). Not done: "heads-up" is still in Check's tab tooltip and
  its empty note (`js/planner.js` 121, 4691), a round trip's notes (1878) and Settings' Hidden Heads-up (`js/main.js`
  1841): #993.
- The weather card: the sentence with the sky, up to three notes, the numbers, the hour strip with Rain and Wind, and
  the older views folded away (#973, #979); the wind's colours, the cold by the wind's direction, and thunder in Check
  (#973).
- The timeline's hour apart from the route's departure (#988).

**To do, the map's weather, as one design (this plan):**
1. The map's weather layers one tap away, with their state in sight. No dropdown.
2. The timeline zooms to your trip, so the slider is precise along it.
3. Zoomed, the reading follows you: where you are on the route at that time, and the weather there.
4. Zoomed, the strip shows where the wind is against you, and you can step from one such stretch to the next.
5. One tap from the timeline to the weather card, one tap from the card to the timeline at that hour and layer, and
   one tap back to the full 48 hours.
6. It fits on a phone without taking the planner's place unless you ask.
7. A trip that starts past the 48 hours: the trip view is greyed, with the reason. A trip with a night: a day at a
   time, with the card's day chips. Wind with Temperature on says "Wind lines".

Frames 9 to 11 on the [design canvas](https://claude.ai/artifact/WD6i6g3rustC7TK4HGSnVV) sketch 1 to 5.

**To do, the rest of the planner (from #869, not started in the code; the order in
[planner-rethought.md](planner-rethought.md)'s PRs, the user's to set):**
- Arrive by, When's third item (#219).
- A clear home for On the route: the profile card, with On the route as Colour by's list (#796, #758). Today it is a
  section of Check.
- The tabs go: the warnings' box in the numbers opens the Check card. Today Route and Check are tabs.
- The Add row, with the search in the sheet (#761's PR 8). *(from planner-rethought.md, not #869's own words: the user's to keep or drop)*
- The rest of the rule for controls, every control checked against it: a part's sport as MTB ▾ in its heading,
  Clear route off the list's foot, the toolbar giving Take it along to More first, the dotted time words gone, DESIGN.md's
  words on green, and DEVELOPING's Shared controls with the new controls.
- The quiet line over the profile in the peek, naming its colouring, and a "Waypoints" heading in sentence case
  (#767) *(from planner-rethought.md: the user's to keep or drop)*
- Notes of your own on a waypoint, a stretch or the route (#854); Notes stays free for them meanwhile.

**Later, in this weather work (after lines 1 to 7):**
- The weather card's look, from the mock-up's stand-in: one row of times, and Rain and Wind as rows of tiles that look
  tappable, under the clear heading "Weather card". An idea for the real card, to design.
- More of the stand-in's heading look in the planner: the route's sport, length and time as its title ("MTB · 42 km ·
  3 h 10 min"), its times under it ("Fri 13:00 → 16:10"), a hairline, then a row a day with the sky and ›.

**Later, each its own issue:**
- Best time to leave, from the weather (#273, #856), and later transport (#857).
- What is still open of #431 and #794: a temperature lane on the weather card, and the trip box's When hidden while the
  card is open beside it on a desktop. (#794's sun times are #914's; #431's first idea, the timeline as a card in the
  peek, is this plan's line 6.)
- Around the trip: warnings, measured nearby, road cameras, sun and moon, water (#911 to #914, #862).
- Lightning and the radar now in the card's notes.
- Rain as a percentage.
- The pass over Polku's words (#837).

**Dropped:** the separate bar a lane's tap was to fold to (the timeline does it); #987's redesign of the timeline.

**How:** the map's weather (1 to 7) in one mock-up, on `main`'s real timeline, before any app code; #992 holds it. It
can be built in as many PRs as it needs, but the user chooses once, on the whole. Where a line can't be done as written,
say so and propose what to do instead.

## Chosen (2026-11-13)

The user tried the whole and chose:
1. **A phone with your trip: the planner folded** to its line while the timeline shows your trip, and back as it was
   when you leave the trip view (48 hours) or close the timeline.
2. **A desktop: the layer buttons on a row of their own** under the title bar.
3. **360 px: the sideways row** of layer buttons stays.
4. **Weather at places stays behind ⋯.**
5. **Snow depth's fourth reading line stays** as on `main`.

And, from trying it:
- **On a phone the slider's knob lines up under the strip's needle,** as it does on a desktop: the strip starts where
  the slider does (after Play's column) and ends where it does.
- **With the planner folded, the reading is one line over a strip the bar's whole width** (as the sketch's rows drew
  it). Its cost: the timeline is about 30 px taller than with the reading beside the strip (the map 418 px rather than
  448 at 390 × 844), and the reading moves over the strip when you tap Your trip. What it gains: the strip is about
  60 px wider, so the slider is more precise, and the line has room for "from the side" and "behind you" as well as
  "against you". Play stays in the slider's row (`main`'s place); the time goes to the reading line's end, so the knob
  and the needle line up there too.
- **Loading is a skeleton,** as the cards' (`pick-skel`): the strip and the reading show their shapes while the forecast
  comes, not a line of words.

## The build

Four PRs in [Calmer planner](https://github.com/TommiContursi/Polku/milestone/16), one at a time (they share
`js/wxmap.js`), each tried on a phone before the next, each referring to #869 and naming the lines it closes:

1. **The weather layers as buttons** (lines 1, and 7's Wind lines): the six as `chip`s with `aria-pressed` in
   `tl-layers` (a row of their own on a desktop, the pill's place on a phone, sideways with a fade), ⋯ beside ✕ with
   Weather at places, Effects and the sources' note, a desktop's tooltips; the knob under the needle on a phone; the
   skeleton while loading. The pill and its menu go. DEVELOPING's Shared controls: the layer buttons' row replaces "A
   pill naming what's on".
2. **The timeline zoomed to your trip** (lines 2, 3, 4 and 7): the trip's row (48 hours · Your trip, Weather card ›),
   the strip and slider by the 5 minutes over your trip, the reading where you'll be (from the planner's analysis),
   your dot on the route, the wind band with its key, ‹ › between the stretches against you (the weather card's wind
   stretches), a day at a time with the card's day chips, Your trip greyed with the reason past the 48 hours, and the
   forecast loading or failed said in the stepper. CONTEXT.md's Weather timeline line changes ("not tied to the route").
3. **The weather card and the timeline, one tap apart** (line 5): the card's hours of Rain and Wind and its lanes open
   the timeline on your trip at that hour with that layer on (on a phone the card folds to its banner with Back, as
   today); Weather card › and 48 hours. The separate bar for a lane's tap is dropped, and CONTEXT.md's Weather line with
   it.
4. **Room for your trip on a phone** (line 6): the planner folds to its line while the timeline shows your trip, and
   comes back as it was on 48 hours or ✕; the reading on one line over a full-width strip there; checked at 360 px and
   200 %.

Each PR: its checks in `tools/smoke.py` (`weather`, and the groups it touches), CHANGELOG, USING.md, DEVELOPING,
screenshots on `pr-screenshots`, and the strongest model at high (AGENTS.md's "Model and effort").

## What stays as it is

The timeline's window and where it opens, dragging it by its title bar and resizing it by its grip on a desktop, the
strip, the slider, Play, the time, the reading and the note under them, and the legend over the map. Where the weather
comes from doesn't change. (The lesson of #987: build the user's decisions in words onto what works on `main`.)

## Part 1: the layers as buttons

From the user's sketch on the design canvas (frames 9 to 11), the ideas and not the look:

- **The six layers are buttons**, one tap each, their state in sight, in place of the pill and its menu: Rain, Clouds,
  Thunder, Wind, Temperature, Snow depth, each with its icon and the name it has today in the pill and in Layers (the
  sketch's shorter "Temp" and "Snow" would be second names, and "Snow" reads as snowfall, which is under Rain). Any of
  them at once, as today.
- **The control:** the app's chips (`chip` with `aria-pressed`, as the round trip's lengths), here any of them at once,
  36 px tall as the pill was (44 px by touch). On, the chosen chip's green tint, 2 px green border and a green icon.
  A new use of a shared control, so it's the user's call; once chosen it joins DEVELOPING's "Shared controls".
- **Wind lines:** with Temperature on, the two share one colour field, so the map colours by temperature and the wind
  shows only its lines; the Wind button then says Wind lines. It keeps the room of the longer name, so nothing moves.
- **⋯ beside ✕** holds Weather at places and Effects, with the sources' note: the rest of today's menu.
- **A desktop's tooltip** gives each button the line it has under its name in the menu today; a phone has the legend.
- **No new motion:** the buttons take the chips' own press, and the menu its own.

Two versions, the same on a phone:

- **Buttons on a row of their own** (recommended): on a desktop the title bar stays as it is (Timeline, room to grab,
  ⋯, ✕) and the buttons take a row under it, wrapping in a narrow window; the timeline is 42 px taller. On a phone the
  buttons take the pill's place in the row that's there, so the timeline is no taller, and they scroll sideways with a
  fade where there's more.
- **Buttons on the title bar** (the sketch's way): the word Timeline goes, its clock stays as the handle to drag, and
  the window opens 744 px wide (640 today) so the six fit beside ⋯ and ✕. It leaves little room to grab, and in a
  narrow window the buttons wrap to three rows in the title bar.

Checked with the design skills (emil-design-eng, apple-design, mobile-native, break-ui) at 1440 × 900, 390 and 360 px,
200 %, light and dark, all six on, the forecast loading and failed, and a window resized to 420 px. Switching any button
but Snow depth moves no button (their place and width are measured before and after each switch). What it found:

- **Snow depth adds a line to the reading**, so the timeline grows 12 px (16 px on a phone) and, its foot fixed, the
  buttons move up under the finger. `main` does the same, behind its open menu. Keeping the line's room always costs
  every phone 16 px; the mock-up leaves it as today.
- **On a phone at 360 px** about two and a half buttons show beside ⋯ and ✕; at 200 % on a phone, about one, and the
  strip and slider are already squeezed there on `main` (#590's area). Today's pill counts what's on ("Rain +2"); the
  row shows it only by scrolling, and the legend over the map.
- **Weather at places behind ⋯** shows its state on the map only, and #690 keeps ⋯ for settings. Built as the sketch
  has it; a question for the user.
- Found on `main` on the way: #990 (the time cut to "FMI r…" on a desktop) and #991 (a failed forecast's strip says
  "Zoom in").

## What can't be done as written, and what to do instead

- **Line 6 on a phone.** With the planner at its peek (296 px on `main`), the trip view leaves 200 px of map at
  390 × 844, about 90 px at 360 × 740, and at 200 % it doesn't fit at all. It fits only if the planner gives room, and
  folding it when you open Your trip takes its place on a tap that asked for the trip, not for folding. Proposal: The
  planner folded, undone by 48 hours or ⌃, said in words the first time ("The planner folds while you look at your
  trip"). The other choice is Under the slider, with less map. The user decides.
- **Line 3's words on a phone.** The reading is 112 px wide, so it says only "against you"; "from the side" and
  "behind you" are in the band and its key. Proposal: keep it so.
- **Line 1 at 360 px.** About two and a half buttons show; the rest are a swipe away, and today's count ("Rain +2")
  goes. Proposal: keep the sideways row; the legend over the map names what's on.

## Part 2: your trip (lines 2 to 7)

Drawn in the same mock-up, on the same timeline. Planner and weather card are stand-ins there, simplified.

- **The trip's row,** under the slider while the route has times: **48 hours · Your trip** (the app's switch, `seg
  small`) and **Weather card ›** (`btn small quiet`). Your trip zooms the strip and the slider to your trip, an hour
  either side, by the 5 minutes (line 2); 48 hours goes back (line 5). One row on a desktop; on a phone two, the second
  only in Your trip.
- **The reading follows you** (line 3): where you'll be at that time (km 15, the start, the finish) and the weather
  there, with the wind **against you** in words; your dot on the route on the map; the time says "Fri 14:10 · km 15".
  On a phone only "against you" fits in the reading's 112 px; the band says the rest.
- **The wind on your way** (line 4): a band under the hours in the route's wind colours (against you, the strong in
  the darker red; from the side; behind you), named in the note under the timeline. **‹ Against you, 1 of 3 ›** (`tool`
  arrows) steps from one stretch to the next: the hour goes to its start, the band and the route light it, and the focus
  stays on the arrow.
- **The weather card** (line 5): **Weather card ›** opens it. On a phone it covers the timeline, as cards do. In the
  card, a tap on an hour of Rain or Wind opens the timeline on your trip at that hour, with that layer on. On a phone
  the card folds to its banner with Back, as a lane's tap does on `main`; on a desktop it stays beside the map. This
  replaces the separate bar a lane's tap was to fold to.
- **A trip past the 48 hours** (line 7): Your trip greyed (the switch's own disabled look), with the reason and the day
  it can zoom. **A trip with a night:** a day at a time, with the card's day chips ("Day 1 · Fri").
- **On a phone** (line 6), three ways, the planner at its peek (`main`'s 296 px, #889) until you open your trip.
  Measured by touch at 390 × 844 (Today with no route: the timeline 162 px, the map 582 px; with a route in 48 hours:
  218 px, the map 250 px):
  - **Under the slider:** `main`'s rows, and the trip's two under them; 268 px, the map 200 px between it and the top
    bar (about 90 px at 360 × 740, worked out, not measured).
  - **The sketch's rows** (frame 11): the reading on one line over a strip the bar's whole width, Play beside the switch;
    298 px, the map 170 px.
  - **The planner folded** (recommended): Under the slider, with the planner folded to its line (48 px) while you look
    at your trip; 48 hours or ⌃ unfolds it. The map 448 px.
- **No new motion:** switching 48 hours and Your trip redraws at once. An animated zoom of the strip would be new
  motion, decided with /animate if wanted.

What the checks found (the design skills, 390, 360, 200 %, light and dark):

- **At 200 % on a desktop** (720 × 450) and on short phones, the trip view doesn't fit above the planner's peek: its
  top runs under the top bar, as the timeline already does on `main` at 200 % on a phone (#590). The planner folded is
  the way that fits there.
- **Missing data:** with the forecast loading or failed, the strip and the reading say so (as on `main`), and the
  stepper says "The wind on your way: loading" or "no forecast" and steps nowhere.
- **The band's key** is in the note under the timeline on a desktop and in the map's legend on both (a phone hides the
  note), so its colours aren't the only telling.
- **A trip with a night on a 360 px phone** adds the day chips' row: with all six layers on (Snow depth's fourth line)
  the timeline is about 300 px and the map about 250 px.
- **The reading's long words:** "from the side" doesn't fit a phone's reading, so it says only "against you" there.
- **Trips not drawn:** one whose second day runs past the 48 hours (its chip greyed, with the reason, would follow line
  7), one with no stretch against you ("Nowhere against you for long", drawn in the code but not on a trip), one with
  one stretch or many, and a long day (the 5-minute slider is then less precise per pixel).
- **CONTEXT.md** says the weather timeline is "not tied to the route". Zoomed to your trip it is, so the term's line
  changes once this is chosen, and "Weather line" (the folded card) goes with the dropped bar.
