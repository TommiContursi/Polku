# Best time to leave (#273, #856)

PR 6 of [planner-rethought.md](planner-rethought.md), step 5 of [the one order of 2026-11-14](https://github.com/TommiContursi/Polku/issues/869#issuecomment-6880721897), in [Calmer planner](https://github.com/TommiContursi/Polku/milestone/16). The mock-up is [mockups/best-time-to-leave.html](mockups/best-time-to-leave.html), also a [private Artifact](https://claude.ai/artifact/W7tHHgHKmYKRS2SAS1YS3u) to try on a phone (built with `css/app.css` and `js/ui.js` inlined). Its bars, ‹ ›, rows and When's pill work: drag along the bars, and let go to leave then. No app code is written here.

## Where it stands

- **2026-11-14:** this plan and the mock-up, waiting for the user's answers to the four questions at the end. Then the build, as one PR.
- **2026-11-15, round 2:** from the user's look at round 1: a good idea, but too much grey text explaining it, and rows of facts run together. Round 2 lets the drawing carry the meaning (the bars in their cause's colour, the named hours labelled on the strip, the facts as columns) and drops the notes. Round 1 stays on the mock-up's switch.
- **2026-11-15, round 3:** the design round's rule, as the user asked: no grey words explaining things. What needs explaining is a round ⓘ in the accent, its words in a tooltip (a mouse's hover and the keyboard's focus, `tooltip()`; a finger's tap shows the same bubble). The folded row keeps its label alone, with the best time as its value. Rounds 1 and 2 stay on the switch.
- **2026-11-15, round 4:** from the user's look at round 3: each departure shows its weather as the card's hours do (the sky's coloured icon, the temperature, the wind's arrow and speed, the rain), coloured sky icons where there are any, and the open section sits in a faint box of its own, so the weather card plainly starts under it. Rounds 1 to 3 stay on the switch.
- **2026-11-15, round 5:** from the user's look at round 4: the named departures looked like a list, not something to pick. Round 5 heads them **Pick a time**, makes each a tile with an edge and a radio's circle (the chosen one in the chosen chip's look), and gives its hour the same green tag as over its bar. Rounds 1 to 4 stay on the switch. What follows is round 5.
- **Decided by the user, 2026-11-15:** all four questions as recommended (1A, 2A, 3A, 4A; "Decided" below). Next: the build.
- **2026-11-15, built** in [#1030](https://github.com/TommiContursi/Polku/pull/1030): see "Built" at the end.
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
  - A bar is how much of the trip leaving then would be in the rain, the heat or the wind (the rule below). A shorter bar is better. A bar is in its main cause's colour (the route's rain or headwind colours), with the cause's icon over a tall one (the sky's coloured rain or snow), so a tall blue bar under a rain cloud needs no key.
  - Behind the bars, the departures whose trip would be in the dark are shaded, with the moon, and those that run into it half shaded, from the sun.
  - The current departure has a ring; a named departure's bar is green, with its hour over it in a green tag ("08"), the same tag as its tile's hour.
  - **An hour that has passed, or past the forecast's reach, has no bar** (a missing bar must never read as the best). A passed hour is a dotted slot; past the forecast it's an outline with "no forecast" in the reading. An hour ruled out (question 4) is a full bar, hatched, with ✕.
- **The reading over the strip:** the hour under the finger, the pointer or the focus, else the current departure: "14:00 → 16:05", the sky's coloured icon, the temperature, the wind's arrow (behind you, from the side, against you, as the card's hours draw it) and its speed, the rain in mm, the waves on a paddle, and the dark where it falls ("Dark from 15:46"). It changes as the finger moves.
- **A scrub previews, lifting the finger sets.** Dragging along the strip moves the reading; lifting the finger sets Leave at to that hour; a tap on a bar sets it at once. Setting it on every hour crossed would redraw the card under the finger, save the route each time, and route a sheltering paddle leg again for every hour (`whenChanged()`).
- **A desktop and the keyboard:** pointing at a bar shows its reading, as pointing at the hour strip does; a click sets it. Under the bars lies a native range (as the timeline's strip), its value text the reading, so a screen reader hears it; the arrow keys move the reading, and the departure is set when they rest for a moment, or at once with Enter. The named rows are the 44 px targets for one tap; the bars (13 px each at 360 px) are for the drag.
- **The choices:** under the heading **Pick a time**, up to three, each the best hour of a stretch of good hours: the best in the light first, then the best in the dark (its tile says Dark). Each is a tile with an edge and a radio's circle at its end; the chosen one has the chosen chip's look (a green tint, a 2 px green border) and a tick in its circle. Its parts in columns: the sky's coloured icon, the hour in its green tag with when you're back under it ("13:00", "→ 15:05"), the temperature, the wind's arrow and speed, then the rain, the waves or the dark. A better day's tile comes after the choices, with › in place of the circle: it goes to that day. A tap sets Leave at; the card then shows that departure's weather below. Two named departures are at least two hours apart.
- **The crossing window** (#856, on a paddle or a swim): one line under the strip, "Leave by 15:00 to cross in small waves" ("Too rough to cross all day", "Small waves on the crossing all day"). The hours outside it are ruled out, hatched, with the paddle over the first.
- **Its own faint box,** from the folded row to the last named departure, so the weather card starts plainly under it.
- **No notes explaining it.** The drawing says what the bars are. What still needs a word has a round ⓘ: the bars (how to read and drag them), a day more than three days ahead or where the forecast ends, and the crossing (its length and what small waves are). The folded row is **Best time to leave** with the best time as its value ("Sun 08:00", "Good now").

## Also in this PR: two changes to the weather card (the user's, 2026-11-15)

- **A heading over the card's weather,** right under Best time to leave's box and above the sentence: **Weather on the way** (the card's name, said today only to a screen reader; an earlier stand-in drew "Weather card" there). On a trip with nights the day's own heading stays under it. Plain ink, the card's heading style, no grey line under it.
- **Weather on the map** (`btn wx-map`) moves from the card's end to right under the hour strip (`wx-hs`), before The whole trip, Hour by hour and Time on the way.

A small visual change each, so no mock-up of their own.

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

## Decided (2026-11-15)

The user took every recommendation:
1. **The dark apart:** the bars show the weather, the dark is shaded behind them, and the rows name the best in the light and the best in the dark (Most in the light on a trip too long for the day's light).
2. **A day when every hour is bad:** the least bad is named, saying so, with a row for a better day. In round 5's tiles (the user's choice, 2026-11-15, A): its hour tag grey instead of green, and **Least bad** as its first fact.
3. **When's menu:** Best time to leave › is the last item (First day's, with nights), and a pick is a plain Leave at that takes Arrive by's place.
4. **Ruled out:** thunder where you'd be, a frostbite risk, and waves over the craft's comfort on the crossing.

## The questions (answered: see "Decided")

1. **How the parts weigh.** Recommended: the dark apart. The bars show the weather, the dark is shaded behind them, and the rows name the best in the light and the best in the dark. The weather counts minute for minute: minutes in rain (heavy rain double), feeling hot, or lost to a headwind or strong wind on the water. Or minute for minute with the dark in the same sum.
2. **A day when every hour is bad.** Recommended: name the least bad and say so, with a row for a better day. Or name nothing.
3. **When's menu and Arrive by.** Recommended: Best time to leave › last, a pick is a Leave at that takes Arrive by's place. Or grey the late hours while Arrive by is set.
4. **What rules an hour out.** Recommended: the card's dangers to life (thunder, frostbite, waves over the craft's comfort). Or nothing does.

## Not drawn, or not known

- **Illustrative:** every hour and number in the mock-up. The weather under the new row is drawn from the card's classes for the departure picked, and only its top half (the sentence, a note, the numbers and the hours).
- **Not drawn:** the map, the trip's box, the timeline, Check.
- **Not known:** how a drag along the strip sits with the sheet's swipe on a real phone (`touch-action: pan-y`); how long 24 departures take to time on a slow phone (the sweep runs once a day is shown, not on every draw); whether a tenth of the trip is the right line between in the light and in the dark for a trip that runs into dusk.

## Built (2026-11-15)

What [#1030](https://github.com/TommiContursi/Polku/pull/1030) built, as "How it's built" lists it: `js/besttime.js` (`sweepDay()`, `score()`, `nameDay()`, `openWater()`), the planner's `timing()` (the core of `timed()`), `bestBox()` and its helpers in `weatherBody()`, `openWeather({ best: true })`, When's last item, `reach` on each water leg (`reachAlong()` in `js/water.js`), the `bt-` CSS, the ⓘ as a shared control (`infoDot()` in `js/ui.js`), and the two changes to the weather card. Checks: `best_time` (weather), `best_time_water` (water), `best_time_menu` (leave), `best_time_nights` (stops).

Where the build settled what the plan left open:

- **Rough water rules an hour out anywhere on the water legs,** as Check's Rough does, so the strip and Check never disagree; the crossing, the longest stretch with a kilometre of open water on some side, is what the line and its ⓘ name.
- **Round 5 draws no group headings,** so "Most in the light" is the rule that sorts the hours, not a heading.
- **The least bad** (2A, as the user chose on 2026-11-15): its tile's hour tag and the tag over its bar are grey, never green, its bar its own height in grey, and its first fact is **Least bad**. A named bar is drawn at its own height, so a least-bad hour never looks short.
- **A failure says why:** a back-off's own words ("Open-Meteo isn't responding — trying again at 12:34"), as the card's forecast line does. A server error holds Open-Meteo back for a minute, so Retry asks again only after it.
- **A water leg saved before this PR** has no open water kept: its waves aren't counted, and the line says so, until the leg is routed again.
- **The fold's value:** "Good now" when the departure is in a named stretch, else the better time ("Sun 08:00"), else none; its line in a tooltip.
