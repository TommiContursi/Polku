# The weather timeline: the layers as buttons, then your trip

A design round for #869, in [Calmer planner](https://github.com/TommiContursi/Polku/milestone/16). No app
code is written here. The mock-up is [mockups/weather-timeline.html](mockups/weather-timeline.html), also a
[private Artifact](https://claude.ai/artifact/5cLEyQFboky2ZYumGHZpeA) to try on a phone (built with `css/app.css` and
`js/ui.js` inlined); **Today** in it is `main`'s timeline (with #988).

**Where it stands (2026-11-12):** lines 1 to 7 below are drawn together in the mock-up, part 1 (the layers as buttons)
and part 2 (your trip). The user chooses once, on the whole; no app code before that.

## The list that counts (set by the user, 2026-11-12)

The whole of what the planner and the weather have to do, from #869's journeys and points, each checked against the code
on `main` on 2026-11-12 (at cb621575, whose app code is `main`'s). The work goes against this list, each PR says which
of its lines it closes, and nothing outside it is done without asking. Nothing in #869's description is dropped unless
the user says so. `main`'s look stays.

**Done, on `main`:**
- Starting a trip from scratch: the ways to begin, and a searched place's card with Start a route here and Add to my
  route (#871, `spotActs()` in `js/cards.js`).
- When you leave: Leave now and Leave at…, a row on the first screen and the trip box's pill (#878, #969, `js/when.js`).
- Multisport: each part's heading opens its sport, speed and route style (#848), and a waypoint's card has Sport from
  here.
- The profile in the peek (#742, #889).
- Show all waypoints on the right, over the route's list (#761).
- Go's contents in the weather card, and Go's tab gone (#973, #794, #759).
- Warnings called Warnings everywhere (#853).
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
- The Add row, with the search in the sheet (#761's PR 8).
- The rest of the rule for controls, every control checked against it: a part's sport as MTB ▾ in its heading,
  Clear route off the list's foot, the toolbar giving Take it along to More first, the dotted time words gone, DESIGN.md's
  words on green, and DEVELOPING's Shared controls with the new controls.
- The quiet line over the profile in the peek, naming its colouring, and a "Waypoints" heading in sentence case
  (#767).
- Notes of your own on a waypoint, a stretch or the route (#854); Notes stays free for them meanwhile.

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

## Part 2: your trip (to come)

Zooming the timeline to the trip ("48 hours" and "Your trip"), the reading following you on the route, a band where
the wind is against you, stepping from one stretch to the next, and one tap to the trip's weather card. It replaces
the separate bar a lane's tap was to fold to (Round 5 of [the weather card's plan](trip-box-and-weather-card.md)), and
shows two or three ways to fit on a phone without taking the planner's place.
