# The weather timeline: the layers as buttons, then your trip

A design round for #869, in [Calmer planner](https://github.com/TommiContursi/Polku/milestone/16), after #988. No app
code is written here. The mock-up is [mockups/weather-timeline.html](mockups/weather-timeline.html), also a
[private Artifact](https://claude.ai/artifact/5cLEyQFboky2ZYumGHZpeA) to try on a phone (built with `css/app.css` and
`js/ui.js` inlined); **Today** in it is `main`'s timeline as #988 leaves it.

**Where it stands (2026-11-12):** part 1 (the layers as buttons) is drawn and waits for the user's choice. Part 2
(zooming the timeline to the trip, with the route's weather) is drawn after that answer.

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
moves no other button (their place and width are measured before and after). What it found:

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
