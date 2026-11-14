# Best time to leave (#273, #856)

PR 6 of [planner-rethought.md](planner-rethought.md), step 5 of [the one order of 2026-11-14](https://github.com/TommiContursi/Polku/issues/869#issuecomment-6880721897), in [Calmer planner](https://github.com/TommiContursi/Polku/milestone/16). The mock-up is [mockups/best-time-to-leave.html](mockups/best-time-to-leave.html), also a [private Artifact](https://claude.ai/artifact/W7tHHgHKmYKRS2SAS1YS3u) to try on a phone (built with `css/app.css` and `js/ui.js` inlined). Its bars, ‹ ›, rows and When's pill work: drag along the bars, and let go to leave then. No app code is written here.

## Where it stands

- **2026-11-14:** this plan and the mock-up, waiting for the user's answers to the four questions at the end. Then the build, as one PR.
- **2026-11-15, round 2:** from the user's look at round 1: a good idea, but too much grey text explaining it, and rows of facts run together. Round 2 lets the drawing carry the meaning (the bars in their cause's colour, the named hours labelled on the strip, the facts as columns) and drops the notes. Round 1 stays on the mock-up's switch. What follows is round 2.
- **Already on `main`:** the map's hour no longer moves the departure. 6b did it (#988): `js/wxmap.js` never sets When. Nothing is left of that line for this PR.

## Already decided (2026-11-06)

- **When's menu** gets a fourth item, **Best time to leave ›**, once there's a route.
- **In the weather card:**
  - the departure's day, one day at a time with ‹ ›, up to ten days;
  - a bar for each hour, scrubbed by a finger, lower is better (by height, not by colour alone), with the dark shaded behind;
  - the best three named in words, each a row with a tick, set by a tap.
- **What's weighed:**
  - for everyone: the dark, rain and heat;
  - on a bike: headwind;
  - on the water: wind, waves and the crossing window.
  Each part of the route counts by its own sport, and the reason is said in words.
- **A trip with nights:** it picks the first day's departure only.
- **No new kind of request:** it reads `windAlong()`'s hourly series, and past two days the ten-day series (`LONG_HOURS`).

## What it looks like

The mock-up draws it at 390 and 360 px, 200 % and on a desktop, for an MTB ride and a paddle with a crossing, beside **Today** (the card and the menu on `main`).

- **A row in the weather card,** right under When: **Best time to leave**, its line saying what it found in a few words ("Better: Sun 08:00, dry", "Good time to leave", "No good time"). It folds open in place, as Hour by hour does (`wxFoldRow()`). When's menu opens the card with it open. On a trip with nights it sits above the day chips and says "First day".
- **The day,** with ‹ › around it (the timeline's `tl-step`): "Tomorrow, Sun 15 Nov", with a line under it only when the forecast is less certain or ends that day. It opens at the departure's day; ‹ stops at today, › at the forecast's tenth day.
- **The strip:** a slot for each hour of the day, 00 to 23.
  - A bar is how much of the trip leaving then would be in the rain, the heat or the wind (the rule below). A shorter bar is better. A bar is in its main cause's colour (the route's rain or headwind colours), with the cause's icon over a tall one, so a tall blue bar with a raindrop needs no key.
  - Behind the bars, the departures whose trip would be in the dark are shaded, with the moon, and those that run into it half shaded, from the sun.
  - The current departure has a ring; a named departure's bar is green, with its hour over it ("08"), the same hour as its row.
  - **An hour that has passed, or past the forecast's reach, has no bar** (a missing bar must never read as the best). A passed hour is a dotted slot; past the forecast it's an outline with "no forecast" in the reading. An hour ruled out (question 4) is a full bar, hatched, with ✕.
- **The reading over the strip:** the hour under the finger, the pointer or the focus, else the current departure: "14:00 → 16:05", then its facts, each an icon and a word or two ("Rain 40 min", "Headwind", "Dark from 15:46"). It changes as the finger moves.
- **A scrub previews, lifting the finger sets.** Dragging along the strip moves the reading; lifting the finger sets Leave at to that hour; a tap on a bar sets it at once. Setting it on every hour crossed would redraw the card under the finger, save the route each time, and route a sheltering paddle leg again for every hour (`whenChanged()`).
- **A desktop and the keyboard:** pointing at a bar shows its reading, as pointing at the hour strip does; a click sets it. Under the bars lies a native range (as the timeline's strip), its value text the reading, so a screen reader hears it; the arrow keys move the reading, and the departure is set when they rest for a moment, or at once with Enter. The named rows are the 44 px targets for one tap; the bars (13 px each at 360 px) are for the drag.
- **The rows:** up to three, under two small headings, **In the light** and **In the dark**, each the best hour of a stretch of good hours, a `row` with the sun or the moon and a tick on the one set, its parts in columns: the hour ("13:00"), its facts ("Dry", "Headwind"), and when you're back ("→ 15:05"). A tap sets Leave at; the card then shows that departure's weather below. Two named departures are at least two hours apart.
- **The crossing window** (#856, on a paddle or a swim): one line under the strip, "Leave by 15:00 to cross in small waves" ("Too rough to cross all day", "Small waves on the crossing all day"). The hours outside it are ruled out, hatched, with the paddle over the first.
- **No notes explaining it.** The drawing says what the bars are; nothing says "shorter is better" or what the shade means.

## The rule (question 1)

Recommended: **the dark apart.** In November every departure after work is in the dark. Count the dark in the same sum as the rain, and the rows would name the middle of the day every weekday, while the evening's dry and wet hours differed only by a little on bars that were already tall. So the dark sorts the departures, and the weather ranks them:

- **the dark:** a departure is **in the light** when at most a tenth of its trip is in the dark (the sun more than 6° under the horizon; dusk counts half, from `darkness()`). On a trip too long for the day's light (ten hours in November), it's those within a tenth of the day's least dark, headed **Most in the light**, as long as that least is under 40 %. It's **in the dark** when half of it or more is. In between it runs into the dark: shaded lighter, and never named. Behind the bars it's the shade; in the rows, the two headings.
- **the bar, the weather alone,** in minutes where you'd be at each minute of the trip timed from that hour:
  - **rain or snow:** minutes in 0.1 mm an hour or more; heavy (4 mm an hour) counts double;
  - **heat:** minutes feeling 27 °C or more (the card's limit);
  - **headwind, on a bike's legs:** the minutes the wind adds to the time on the move (a tailwind is said in the words, but never makes up for rain);
  - **wind on the water, on a paddle's or a swim's legs:** minutes in wind of 5 m/s or more (the card's limit for the water).

  The bar is their sum over the trip's time on the move, topping out at a trip that's wet the whole way. The words say the two parts that cost most.
- **Named:** up to two stretches in the light and the best one in the dark, leaving between 05:00 and 23:00 (the bars still show the night, but nobody's sent off at 02:00). **Good** is at most a tenth of the trip, and nothing ruled out; hours within 5 % of each other are about the same, so a stretch of them is named once, by its best hour, "as good until 14:00", and between two about the same, the one nearer the time of day you came with wins (the departure set when the row was opened), so the rows stay put while you pick.

The cost: three rows to read instead of one answer, and a dry evening in the dark can look as good as a dry noon. The alternative: **minute for minute**, the dark in the same sum as the weather, one ranking and one answer, at the price of naming the daylight hours on every November weekday.

## When every hour is bad (question 2)

Recommended: **name the least bad, and say so.** The fold's line and the day's line say "No good time on Saturday"; each row's line starts "The least bad" ("Sat 10:00 · The least bad: 25 min in the rain"). When another day within the forecast has a good hour, one more row says it, "Sunday 10:00 is light and dry ›", and a tap steps there. When every hour is ruled out, no row is named: "No departure on Saturday keeps you clear of thunder", with the better day's row. Late in the evening, with nothing better left today, the same row offers tomorrow.

The alternative: name nothing on a bad day, only "No good time on Saturday" and the better day. Cleaner, but someone who has to go today gets no help.

## When's menu and Arrive by (question 3)

Recommended: **Best time to leave › is the menu's last item,** after Arrive by…: not a mode like the other three, but a way to pick one. On a trip with nights it's the last item of **First day**. A pick sets Leave at, so on a trip without nights it takes Arrive by's place, as Leave at… does today, and the menu's tick moves to Leave at. On a trip with nights it sets the first day's departure beside Arrive by, as Leave at… does. The strip rings the departure Arrive by worked out. A pick is a plain Leave at, so saved routes and share links need nothing new.

The alternative: with Arrive by set, the strip also greys the departures that would get you there late. More to build and to explain, for a case that's rare (whoever sets Arrive by has picked their time).

## Ruled out (question 4)

The decided list makes an hour worse; it doesn't say what rules one out. Recommended: **the card's dangers to life rule an hour out** and it's never named: thunder where you'd be, a frostbite risk (feels like −27 °C at your speed), and waves over the craft's comfort on the crossing (Check's Rough for a kayak). They're Check's own limits, so the strip, the card and Check never disagree. The rest of the card's notes (gusts, slippery, ice season, very cold) stay the card's notes for the departure you pick, and don't move the strip.

The alternative: only the decided list counts, and thunder or frostbite only make an hour worse, like rain. Simpler, but the strip could then name an hour Check calls a warning.

## States

- **Loading:** the strip's shape as the cards' skeleton (`pick-skel`), the dark already shaded behind.
- **Failed:** the dark alone, and what the sun gives without a forecast: "Leave by 13:20 to be back in the light" (#273's part 1), with Retry. Stale: the card's own "Older forecast" note covers it.
- **Today's passed hours:** dotted slots, never named. The current hour stays, as Leave now.
- **Past the forecast's reach** (the tenth day): "No forecast yet from 21:00 Tuesday: only the dark counts". More than three days ahead, the day's line says "less certain", as the card does.
- **Midnight sun and the polar night:** no shade, or all of it: every departure is in the light, or in the dark, and the weather alone ranks them.
- **A trip with nights:** the first day's departure, scored on the first day's trip only (a night ends at its Go on at, so later days don't move).
- **A day trip past midnight:** scored whole.
- **A water leg Polku didn't route** (from a file, or drawn as a line): its waves aren't counted, and the crossing line says so.

## How it's built

One PR, in [Calmer planner](https://github.com/TommiContursi/Polku/milestone/16), fixing #273 (its parts 1, 3 and 5) and naming #856's crossing window. Parts 2 and 4 of #273 (the chance of rain, and winter's cold and slippery hours) stay on the issue.

- **`js/besttime.js`, new:** the sweep. For a day it gives each hour `{ t, bar, parts, out, said, back }` from the route's timing, `windAlong()`'s series and cells, `darkness()` and the water legs' fetch. It only reads: it times the trip through the timing's core (below), never through When, and stops when the route or the forecast changes (the generation, as `loadWind()` keeps).
- **`js/planner.js`:**
  - `timed()` gets a core that only computes (it writes `a.waitAt` and reads When today), so the sweep can time 24 departures without touching the trip;
  - the weather card's row and section in `weatherBody()`, above the day chips; a pick calls `this.when.set()`;
  - `openWeather({ best: true })` opens the card with it open, scrolled to it at once.
- **`js/when.js`:** the menu's fourth item (›), last in When or in First day, calling the planner back to open the card.
- **`js/water.js`:** for each water leg, the open water upwind along its line in eight directions, worked out once when it's routed (the grid is already there: `exposure()` today does one direction, and only for sheltering legs), kept with the leg's `water` result. The crossing is the leg's longest stretch with a kilometre or more of open water on some side. The sweep turns the hour's wind there into a wave with `waveHeight()`.
- **`js/weather.js`:** nothing. A day whose trips end within 46 hours reads the two-day series already cached. **Stepping further asks once** for the route's ten-day series (12 points at most, cached an hour), the request a trip with nights already makes; if it fails, that day shows the dark alone, with Retry.
- **`css/app.css`:** the strip and its reading (`bt-…`). The rest is shared controls: `row` with `menu-tick` for the named departures, `tl-step` for the day, `wxFoldRow()`'s row.
- **Checks** (`tools/smoke.py`): `weather` (the strip and rows from a recorded forecast, a pick sets Leave at, a scrub previews and its release sets, passed and unknown hours never named, the failed and far states), `water` (the crossing window from a recorded water route), `leave` (the menu's item, Arrive by replaced), `stops` (the first day only on a trip with nights). Looked at at 1440 × 900 and 390 × 844, MTB and paddle, with the timeline open.
- **Docs:** CHANGELOG, USING (When's menu and the card), README (the capability, with its limits), DEVELOPING (Weather: the sweep; Shared controls: the strip), CONTEXT (Crossing window), and this plan's "Built".
- **Motion:** nothing new moves (decided with /animate). The scrub, ‹ › and a pick change in place, and the card opens as every card does. So no /review-animations.

## As it will be built unless the user says otherwise

- A drag along the bars tries each hour; lifting the finger, a tap on a bar or on a row sets Leave at.
- Departures in the dark are named only from 05:00 to 23:00; the bars still show the night.
- A tailwind is said, but never makes up for rain.
- Between two departures about the same, the one nearer the time of day you came with wins, so the rows stay put while you pick.
- On a trip too long for the day's light, the light's group is **Most in the light**.
- On a trip with nights, the first day's departure, scored on the first day only.

## The questions

1. **How the parts weigh.** Recommended: the dark apart. The bars show the weather, the dark is shaded behind them, and the rows name the best in the light and the best in the dark. The weather counts minute for minute: minutes in rain (heavy rain double), feeling hot, or lost to a headwind or strong wind on the water. Or minute for minute with the dark in the same sum.
2. **A day when every hour is bad.** Recommended: name the least bad and say so, with a row for a better day. Or name nothing.
3. **When's menu and Arrive by.** Recommended: Best time to leave › last, a pick is a Leave at that takes Arrive by's place. Or grey the late hours while Arrive by is set.
4. **What rules an hour out.** Recommended: the card's dangers to life (thunder, frostbite, waves over the craft's comfort). Or nothing does.

## Not drawn, or not known

- **Illustrative:** every hour and number in the mock-up. The weather under the new row is drawn from the card's classes for the departure picked, and only its top half (the sentence, a note, the numbers and the hours).
- **Not drawn:** the map, the trip's box, the timeline, Check.
- **Not known:** how a drag along the strip sits with the sheet's swipe on a real phone (`touch-action: pan-y`); how long 24 departures take to time on a slow phone (the sweep runs once a day is shown, not on every draw); whether a tenth of the trip is the right line between in the light and in the dark for a trip that runs into dusk.
