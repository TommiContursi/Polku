# The trip's box and the weather card (#431)

The design of step 6 of [the one order](https://github.com/TommiContursi/Polku/issues/869#issuecomment-6710400784): the trip's box over the list, and the weather card it opens, with Go's tab gone ([#431](https://github.com/TommiContursi/Polku/issues/431), [#794](https://github.com/TommiContursi/Polku/issues/794), [#759](https://github.com/TommiContursi/Polku/issues/759), [#766](https://github.com/TommiContursi/Polku/issues/766)). Part of [#869](https://github.com/TommiContursi/Polku/issues/869); milestone [Calmer planner](https://github.com/TommiContursi/Polku/milestone/16).

**Where it stands (2026-11-07): decided, ready to build as two PRs (6a and 6b) once step 5 is merged and tried on a phone.** The mock-up is [mockups/weather-card.html](mockups/weather-card.html), also a [private Artifact](https://claude.ai/artifact/TuYMqZgUGfFuqf5QmxCUri) to try on a phone (built from this file with `css/app.css` and `js/ui.js` inlined and the screenshots embedded). **Today** shows Go and the timeline from `main`; **D: Like a weather site** is the card after round 2, with the weather line for the map's hours in two places to compare; **C: Together**, **A: Rows** and **B: Graph**, the earlier answers, stay to compare. Each at half and full, for a day trip and a trip with a night. No app code is written here.

## Already decided

From [planner-rethought.md](planner-rethought.md) ("Decided, 2026-11-06", "How it's built") and #869's comments; this round doesn't reopen them.

- **The trip's box** sits over the list, after the sports' rows. Its first line reads "Leave now ▾ → there at 20:02", with the day's weather on the line under it. It doesn't repeat what a sport's row says, such as the wind. A trip with nights gets a row per day, each ending in ›.
- **The weather card holds Go's contents:** Leave and There, each day's weather and sun, the wind on the way, the links that colour the route, Time on the way folded, and the map's weather and its layers (Parts 22 of #761, drawn in [its mock-up](mockups/issue-761-route-list.html?v=parts22)).
- **Go's tab goes,** and the hour chips with it (#759). The route's weather along its length stays on the profile through Colour by.
- **The weather timeline no longer moves the departure** (#431, 2026-11-07): its hour is the map's alone.
- **The same pill behaves the same everywhere:** the card's When is the box's "Leave now ▾", not Go's old Leave row.
- **Best time to leave and Arrive by are step 9.** The card and the When menu leave room for them; they aren't designed here.
- Cards one at a time with ‹ Back; one set of sizes (#889); green means you can tap it, ▾ for a value you pick, › to open; a tool lives where you work with it; missing or late data never looks complete; Traficom's depths are shown, never routed on.

## Production today

`main` at 1c23902, served on port 8913 with a local BRouter (`tools/brouter-local.sh`, nothing sent to brouter.de), in Claude Code's browser pane at 390 × 844 (dark), 1440 × 900 (light) and 360 px at 200 %. Two trips:
- **A day trip:** MTB 2.97 km from Töölö to Kaivopuisto, a sea kayak 1.97 km to Suomenlinna across the Särkän väylä with a 220 m carry, a hike of 540 m on the island; leaving now, 19:42.
- **A trip with a night:** the same, leaving tomorrow at 10:00, with a night at waypoint 2 on Suomenlinna and the hike the next morning.

### Go, item by item, and where each goes

"Card" is the weather card; "box" the trip's box. Rows marked **ask** are in the round below.

| Today, in Go | Example | Goes to |
|---|---|---|
| Leave row, "Sets the times and the weather along the route", and Now | Leave · Tomorrow, Sun 8 Nov · 10:00 › | The box's first line and the card's top, as the When pill "Leave now ▾" (step 4's pill) |
| There at, and the time on the way | There at 20:40 · 58 min on the way | The same line: "→ there at 20:40" |
| The table: by way, uphill, the wind, by sport, changeovers, nights, total with average speed | Paved 2.42 km · 9 min · 16.5 km/h … the wind −4 min | The card: Time on the way, folded |
| Your speed (every sport in one line) | Normal › | Nowhere new: each part's ⚙ and the row under the list have it (#848) |
| The sun: sunrise, sunset, dark from, for the first day only | Sunrise 07:59 · sunset 16:11 · dark from 16:58 | The card, for each day; the box says "in the dark" where the trip is |
| Days (with nights only), each a button that frames the day on the profile and the map | Day 1 · Sun 08/11 · 10:00–10:41 · 4.96 km · 27 min moving · ↑23 m · night at Waypoint 2 · 5 °C · wind up to 6 m/s · dry | The box: a row a day ›; the card: a section a day. **Ask:** where the framing goes |
| The wind at the start, with a rating | 3.9 m/s gusts 7.8 · from W · 6 °C · Breezy | The card, each day's reading |
| The temperature range | Temperature 6…7 °C | The box's weather line and the card |
| Rain, as a link that colours by rain (or temperature when dry) | Dry the whole way · Rain on 3 km (40 %, km 2–5), up to 1.2 mm/h · about 2 mm on you | The box's line ("dry", "rain from km 2") and the card's sentence |
| Wet and near freezing | Wet and near freezing — slippery roots and rocks | The card, under the day it's on |
| The wind's shares | Headwind 1 % · Crosswind 13 % · Tailwind 86 % | The card: The wind on the way |
| Strongest headwind, framing its stretch | Strongest headwind 2.8 m/s at km 2.4 → | The card, a row › |
| The notes: loading, unavailable, an older forecast, no forecast yet (for the trip, or from a km), less certain past three days | No forecast yet from km 12.3, 15:20 … | The box's line in short, the card in full. **Ask** |
| Eight hour chips, every 2 h from the departure | 20:00 … 10:00 (a 58 min trip) | Gone (#759). **Ask:** the gap until step 9 |
| Wind / Temperature / Rain along the route ↑ | Wind along the route ↑ | The card: the three links that colour the route and the profile |
| The folded section's summary | Depart now → there 20:40 · 6…7 °C · breezy · dry | The box |
| Take it along: Export GPX, Copy share link with "Includes when you leave: …", Save offline… | | More and the toolbar (decided in #869); the note goes with Copy share link |
| The tab's arrival time | Go 20:40 | The box's first line |

### Elsewhere today

| Today | Example | Goes to |
|---|---|---|
| The numbers' time, a tap opens Go's Leave (`revealDeparture()`) | 58 min / 33 min moving | **Ask** |
| Each sport's row | Paddle 1.97 km · wind up to 5 m/s, gusts 8 | Stays (decided) |
| Check's figures for a paddle | Headwind 13 % · Strongest wind 5 m/s, gusts 8 | Stay in Check |
| Rough water, a warning only when it's rough | Rough for a sea kayak, at 10:20: waves up to about 0.6 m | Stays a warning; **ask** whether the card says the waves always |
| The night's row in the list, with its sun | Night · 21 h · 10:51–Mon 08:00 · 16:08 · 08:03 | Stays |

### The weather timeline, and where each part goes

| Today (`#wx-bar`, `js/wxmap.js`) | Goes to |
|---|---|
| Chips: Wind, Temperature, Rain, Snow (and Timeline on a desktop) | The card's map part, a step away (#233's step 3). **Ask** |
| The 48 h strip: temperature, rain, wind arrows, the night shaded, your trip shaded; drag to change the time | The card's map part; your trip stays shaded, but dragging no longer moves it |
| The reading at the map's centre: 6° · cloudy · 5 m/s W · gusts 8 · dry | The card's map part |
| Play, the 0–48 h range, the time, a grip to resize, ✕ | The card's map part; the grip goes with the window |
| ⚑ "Also the departure time of your route", and on a desktop "Also your route's departure — the shaded band is your ride. Road works and road conditions follow this time too." | The flag and "Also your route's departure" go (decided); road works and road conditions still follow the map's hour, and the card says so |
| Setting a departure moves the timeline too (Sun 10:00 · +15 h) | Unlinked both ways |
| The Weather button's "+k h", and T | Stay; **ask** what Weather opens |
| Layers › Weather on the map: Timeline, Wind, Temperature, Rain (radar now, forecast later), Snow depth; "Forecast by Open-Meteo" | Stays in Layers |

### What the inventory found

- **A trip in the dark says so nowhere.** Leaving at 19:42, the whole trip is after dark, and Go only says "dark from 16:58".
- **The hour chips run past the trip.** On a 58 min trip they run from 20:00 to 10:00 the next morning.
- **A trip of days gets one day's sun.** The sun line is the first day's; day 2 has none.
- **The timeline covers the planner.** At 360 px and 200 % its window lies over the full sheet (#377), and the page is 9 px wider than the screen.
- **Moving the timeline routes the water legs again,** since their waves are judged for its hour (the comment at Rough water in `js/planner.js`). Unlinking the departure ends that.

## Research

**Looked at by hand (2026-11-07), at 390 px in Claude Code's browser pane, and in yr.no's phone app from the user's screenshots** ([on `pr-screenshots`](https://github.com/TommiContursi/Polku/tree/pr-screenshots/claude/design-weather-card/yr-app)). This is what the design leans on:

| Service | The reading | The hours | The sun, uncertainty, extras |
|---|---|---|---|
| yr.no, web | The sky symbol and the temperature large in red; beside it three small lines with icons: Feels like 3°, 0 mm in blue, 4 (7) m/s with an arrow | **Table \| Graph**, a switch. Table: a row an hour of about 40 px: time, symbol, temperature (red), precipitation mm (blue), wind (gust) m/s with an arrow. Graph: the sky every two hours, the temperature a red line, rain blue bars, then the wind and the gusts (dashed) in a panel of their own with arrows | Sunrise and sunset with their icons on a line under each day's rows; rain as a range (dark blue expected, light blue possible) |
| yr.no, app | "Today 21:00", 4° very large, "Feels like 2°", the wind in a circle with "Light breeze from west (m/s)", a sentence for the evening, ↑ and ↓ for the day | The same table, each day a block with sunrise and sunset under it; the graph adds pressure; the temperature's area is blue below 0 °C | The next 90 minutes of rain; the map's layers with one pill ("Wind ▾") over a compact time bar ("Today at 20:00", play, ticks with the days' names); nearby observations and road cameras; warnings; UV, aurora, the moon. Filed as #903 |
| FMI (ilmatieteenlaitos.fi) | — | A row an hour: time, symbol, temperature (red), **feels like** with a person icon, the wind in a circle with speed (gust), chance of rain and mm | Each day folded to one line (Sun 8.11. 15:00 7°); a 15-day chart with 50 % and 80 % ranges for temperature and rain |
| Foreca | A sentence for the day ("Morning 3 °C, afternoon 5°, evening 6°…") | A row an hour: symbol with its word, temperature (red), feels like, humidity, mm, the wind's arrow and speed, gusts and the chance of rain small under them | The day's header draws the sun's arc: day length, sunrise and sunset; the moon's phase, moonrise and moonset |

What it means for the card:
- **One reading at yr's size,** not tiles: the sky, the temperature about 30 px, three small lines with icons.
- **The hours as FMI's and yr's rows,** about 40 px each, a colour a kind (temperature red, rain blue, wind its own), and yr's graph for those who read a graph. yr offers the two as a switch; the user asked for them together.
- **The sun on its own line** under the reading, as yr and Foreca do.
- **Feels like is on all three.**

The subagents' first pass, from search summaries, follows as leads.


| Service | How it shows the weather on the way | Source |
|---|---|---|
| yr.no | Rain as a range: in the tables "1–2 mm", in the graph dark blue for what's expected and light blue for how much more could fall; the chance of rain per hour in Details. A narrow range is a surer forecast (**checked**) | [hjelp.yr.no](https://hjelp.yr.no/hc/en-us/articles/4402772811026-Weather-forecasts-and-uncertainty) |
| Meteoblue | A predictability bar for each day, 80–100 % "reliable" | [content.meteoblue.com](https://content.meteoblue.com/en/research-education/specifications/weather-variables/predictability/) |
| Windy | A route planner with a speed and a time slider; reports disagree on whether the weather is at the departure or at each place | [community.windy.com](https://community.windy.com/topic/9596/how-to-use-a-route-planner/52) |
| Foreca, FMI | Hourly feels-like, the 10-minute mean wind and the strongest gust; warnings | App store listings |
| Apple Weather | The hourly row is the temperature and an icon; the detail switches between temperature, rain, wind | Secondary sources |
| Windguru, Windfinder | A table a column per hour: wind, gusts, direction arrows, wave height and period, coloured by speed; a gust far above the wind reads as unstable | [windguru help](https://old.windguru.cz/fi/help_index.php), a reader's guide |
| Komoot (Premium) | The weather as a layer on the profile at a start time you pick (temperature, rain, wind, UV, sunrise and sunset); hints for strong wind and a drop in temperature | [komoot.com/premium/weather](https://www.komoot.com/premium/weather) (checked in #869's round) |
| Epic Ride Weather | Each segment at the time you get there; best and worst start times; wind against your heading | [velo.outsideonline.com](https://velo.outsideonline.com/gear/tech-wearables/epic-ride-weather-review-one-of-the-handiest-cycling-apps-just-got-better/) (2017) |
| PredictWind | Model data to 10 days, then one ensemble member; no spread shown on that page | [help.predictwind.com](https://help.predictwind.com/en/articles/9786678-faq-10-day-long-range-forecasts-and-ensemble) |
| Savvy Navvy | A comfort bar along the route from wave height and period, which follows the departure as you scroll it; "an estimate" | [help.savvy-navvy.com](https://help.savvy-navvy.com/en/article/what-is-savvy-navvys-comfort-index-10h9x0t/) |

What it means for Polku:
- **The weather at the time and place you're there is rare,** and done for bikes only (Komoot, Epic Ride Weather). Nobody does it for paddling with gusts and waves, which is where Polku leads (#856).
- **The graph along the route is the profile** (Komoot), which Polku has: Colour by's wind, temperature and rain.
- **Uncertainty is shown as a range or a word, rarely at all.** yr's range is the clearest, and needs data Polku doesn't get today (below).
- **A paddler reads the wind and the gust together** (Windguru); Polku's sport row already says "wind up to 5 m/s, gusts 8".

## The data: MET Norway, Open-Meteo and FMI

Checked by hand on 2026-11-07 against the services themselves.

- **Polku already gets MET Norway's model.** Near Helsinki, Open-Meteo's `best_match`, which Polku uses, gave exactly `metno_seamless` (MET Nordic) for the four hours compared: wind 5.4, 4.6, 5.4, 5.6 m/s and gusts 8.4, 7.8, 7.6, 7.9, where ECMWF and ICON differed. Open-Meteo's docs give MET Nordic 1 km, hourly, about 2.5 days ahead; after that other models take over.
- **What yr's own API adds is uncertainty.** MET Norway's Locationforecast 2.0 (`complete`) has the gust, the 10th and 90th percentiles of wind and temperature, the rain's minimum and maximum for each hour, the chance of rain and **the chance of thunder** (#431's thunder note). It's hourly for about 55 hours, then 6-hourly to 10 days.
- **But it fits Polku poorly as the main source.** It answers one point a request; the map's grid alone asks up to 60 points. Its terms want an identifying User-Agent, which a browser can't set; a website may use the `Origin` header instead only while it's "low-volume", and the whole application must stay under 20 requests a second. It answers with `access-control-allow-origin: *`, so it works from a browser. Licence CC BY 4.0, credit with a link. ([Terms of service](https://api.met.no/doc/TermsOfService))
- **Waves on the coast exist, not on lakes.** MET Norway's Oceanforecast 2.0 answered for the Gulf of Finland (0.7 m off Helsinki) and the Archipelago Sea (0.4 m), hourly to about 8 days, with the sea's temperature and currents; on Päijänne it has no data. Open-Meteo's Marine API also covers the Gulf of Finland, not lakes.
- **Polku's own waves cover lakes too.** The water router works out a wave height for every water cell from the open water upwind (`js/water.js`), for the wind at the leg's start (#155). Today only rough water reaches the screen, as a warning; the highest wave along a leg is a few lines in `js/water.js`, with no new request.
- **Open-Meteo has a chance of rain too:** `precipitation_probability` (from its ensembles, coarser). Polku asks for 8 variables; Open-Meteo counts a request with more than 10 as more than one call ([pricing](https://open-meteo.com/en/pricing)), so a ninth costs nothing more. Its `lightning_potential` is empty in Finland.
- **FMI's open data** (HARMONIE, CC BY 4.0, 600 requests in 5 minutes) wasn't looked at further: Polku already uses FMI for radar and winter.

**Recommendation: no new source for step 6.** The card is built on what Polku already fetches. Two things worth an issue for the user to decide, after step 6: the chance of rain (Open-Meteo, one more variable) and MET Norway's ranges and chance of thunder (a second source, with its terms' "low-volume" limit). Filed only if the user wants them.

## Round 1, with the user

Asked on 2026-11-07 in the session, nine questions with a recommendation each: rows or a graph; the box's weather line; the card's order; paddling's waves; uncertainty in words; what Weather opens; the gap until step 9; a day row's tap; the small placements. The answers go here.

- **Q1, rows or a graph:** not decided from words. Asked to see it, keeping in mind that a phone shows far less at once than a desktop. Drawn as A and B in the mock-up, with Size: Half showing what a phone shows before a swipe.
- **The card and the timeline are one thing:** the weather card replaces the floating timeline window; its 48 hours are the card's last part, On the map.

**The answer to Q1 (2026-11-07), after seeing A and B:** neither alone. Rows and a graph together, since a graph is easier for some people and words for others; the big numbers of A are good. Also asked for:
- the temperature as it feels as well as the thermometer's;
- colour to make each kind of data stand out, rather than grey text one after another, the way weather sites lay out a reading;
- sunset and sunrise on a line of their own;
- the map's hours usable with almost the whole map in view while the hour moves, as #233's step 3 drew it: the weather line, the weather card folded in the sheet's place (chosen 2026-10-27, [its plan](issue-233-calmer-planner.md#the-weather-as-a-card-chosen-2026-10-27)).

Drawn as **C: Together** in the mock-up (A and B stay on its bar):
- **Each day:** its big numbers as tiles, each in its own colour: Temperature (orange, with "feels like" under it), Wind (teal: the strongest wind, its arrow, the gusts and where it's from), Rain (blue: millimetres on you, where and how hard), and Waves on a day with a paddle (the paddle's colour, "an estimate"). Two tiles a row on a phone, three where a day has three and there's room, one a row at 200 %. Then "In the dark the whole way" on a line of its own when it is, the sun's times with their icons on the next, and the day's 12 hours as a graph in the same colours: the wind and the gusts in figures, the temperature as a line, rain as bars with their mm/h, the dark shaded, your trip in green.
- **The map's hours:** the weather line, two rows tall: play, the temperature, the hour with the wind, the gusts and rain under it, ⌃ to open the card and ✕ to turn the weather off; under them a 24 px strip with a 44 px target, dragged to set the hour (the reading follows), with your trip shaded, rain in blue, the temperature in orange and the dark in grey. In the card, On the map shows the same line; dragging it folds the card down to the line.
**Round 2 (2026-11-07):** C's tiles were far too big, and the sky symbol and snow, the snow's depth and the water's temperature were missing; the background work on weather sites hadn't been done, and the old weather line's mock-up hadn't been looked at. Both done since (the research above; #233's step 3 mock-up, `issue-338-room-for-the-map.html?q=foot`: the line above the toolbar before 2026-10-27, and the card folded to its line after). Drawn as **D: Like a weather site** (C stays on the bar):
- **Each day:** the sky symbol (from `skyKind()`), the temperature at 30 px in red (blue below 0 °C), and three small lines with icons: feels like, rain in mm (blue), the wind and its gust in m/s with a drawn arrow (teal). On a paddle day two more: the waves, an estimate, and the water's temperature, marked as needing a new source. In winter, the snow on the ground. Then "In the dark the whole way" when it is, and the sun's times on a line of their own.
- **The hours:** FMI's table (time, sky, temperature, feels like, mm, wind (gust) m/s with its arrow) for the trip's hours and one either side, the trip's hours marked ●; then yr's graph of 12 hours. **Hours: Table or graph** draws yr's switch instead (the app's `seg`), to compare.
- **The weather line:** the old line's order (▷ · the sky · temperature · the hour, the wind and rain · the layer as a pill "Rain ▾", as yr's map does · ⌃ · ✕) over the strip. **Line** switches where it sits: in the sheet's place (chosen 2026-10-27) or above the toolbar with the planner at its peek (the version before). Above the toolbar, about a third of the map shows at 390 × 844; in the sheet's place nearly all of it.
- **Data: Winter** shows snow (illustrative).
- **Where the data comes from:** the sky, snowfall and snow depth are fetched today (`cloud_cover`, `snowfall`, `snow_depth`), FMI's measured depth too (`js/winter.js`). Feels like and the chance of rain would be Open-Meteo's ninth and tenth variables, still one call (more than ten count as more), for the map's grid as well since `fetchPoints()` serves both. The water's temperature is a new source: Open-Meteo Marine or MET Norway's Oceanforecast on the coast, SYKE for lakes (#862).
- **Filed from yr's app:** #903 (nearby observations, cameras, warnings, the next 90 minutes, UV and aurora, map layers); comments on #862 (the sea's temperature) and #182 (the 90-minute radar, the layer pill).

- **Feels like** isn't fetched today. The mock-up works it out as the wind chill; the build would ask Open-Meteo for `apparent_temperature`, its ninth variable, still one call (more than ten count as more).

**Round 3 (2026-11-07):** the user chose to go with D and improve it later, once it's built and tried on a phone. Asked for alongside:
- **A colour legend over the map while a weather layer is on,** as yr's app shows: added to #903.
- **The weather line on a desktop** is the short piece at the right end of the toolbar from #594's mock-up (`issue-594-desktop-layout.html`, 1920 × 1080, The weather): the sky, the temperature and the hour, ⌃ and ✕, the strip opening above it. Drawn in the mock-up's Desktop frame on The weather line.
- **The controls checked against DEVELOPING's "Shared controls",** and D changed to match (below).

## Decided (2026-11-07)

1. **The weather card is D:** for each day, the sky, the temperature and three small lines (feels like, rain in mm, the wind and its gust with its arrow; on a paddle day the waves, an estimate; in winter the snow on the ground); "In the dark…" when it is; the sun's times on a line of their own; the hours as FMI's table (the trip's hours and one either side, marked ●) and yr's graph of 12 hours, together. Then the wind on the way, Strongest headwind ›, Colour by, Time on the way folded, and On the map.
2. **The trip's box:** "Leave now ▾ → there at 21:19", and under it the day's weather without what a sport's row says: "6…7 °C · dry · in the dark" (a row a day on a trip with nights, each with ›). A tap opens the card at that day and frames the day on the map.
3. **The map's hours are the weather line,** the card folded: in the sheet's place on a phone (#233's step 3, chosen 2026-10-27), and the short piece at the right end of the toolbar on a desktop (#594). The line: ▷, the sky, the temperature, the hour with the wind (gust) and rain, the layer as a pill ("Rain ▾"), ⌃ and ✕, over a strip dragged for the hour. Weather (the button, T) opens the line; ⌃ opens the card; dragging the hours in the card folds it to the line.
4. **The map's hour no longer moves the departure** (#431, 2026-11-07), nor the departure the map's hour.
5. **Data:** feels like (`apparent_temperature`) is fetched, Open-Meteo's ninth variable, still one call. The chance of rain, water temperature, MET Norway's ranges and the ideas in #903 aren't part of step 6.
6. **The rest of round 1, as recommended:** uncertainty in words where it starts ("less certain from Tue", "No forecast yet from km 12"), never colour alone; the hour chips go before Best time to leave (step 9) comes; "33 min moving" opens the card at Time on the way; "Includes when you leave" goes with Copy share link in More; "Wet and near freezing" under the day it's on.

### The controls, against DEVELOPING's "Shared controls"

| In the card | Shared control | Status |
|---|---|---|
| ‹ Route and ✕, the name | `way-bar`, `btn small quiet way-back`, `tool way-x`; `way-head`, `way-hint`; the sky as `card-mark` | As production's cards (`cardBox()` in `js/card.js`) |
| When, the layer's pill | The ▾ pill (step 4; #869's "new controls") | Built in step 4, before this |
| Strongest headwind ›, Weather layers ›, Time on the way ⌄ | `row` in `rows` (`val`, ›; ⌄ to unfold) | As production |
| The wind on the way | Go's `exposure` and `ex-item` | Moved as it is |
| Colour by | `mode-select` | As production's (its ▾ is step 15's rule) |
| Time on the way | Go's `speed-table` and `speed-row` | Moved as it is |
| Table or graph (if ever wanted) | `seg` | As production |
| The line's buttons | `tool` | As production |
| **The hours' table** | none | **New:** a row an hour (time, sky, temperature, feels like, mm, wind (gust)); joins the table when built |
| **The day's graph** | none | **New:** a canvas like the profile's and the timeline's strip (`js/chart.js`, `js/wxmap.js`); joins the table when built |
| **The reading** | none | **New:** the sky, the temperature at 30 px, three lines with icons; content rather than a control |

The mock-up's own pieces aren't production's: the When pill's look is planner-rethought's drawing of step 4's pill, the toolbar is drawn simply, and the profile is a shape.

## How step 6 is built

Two PRs, each tried on a phone before the next; both in [Calmer planner](https://github.com/TommiContursi/Polku/milestone/16), referring to #869 and fixing what they finish (#431, #794, #759, #766).

**6a. The trip's box and the weather card; Go's tab goes.**
- `js/planner.js`: the box after the sports' rows (When's line from step 4, and the weather line, a row a day with nights); `renderWind()` becomes the card's content (the reading, the sun, the hours' table, the graph, the wind on the way, Colour by, Time on the way from `speed-table`); the numbers' time opens the card at Time on the way (`revealDeparture()` goes); the day rows frame their day (`focusRange()`); the tabs lose Go (`renderTabTimes()`, the Go pane, Take it along's buttons, which are in More).
- `js/cards.js` and `js/card.js`: a weather card in the card host, one at a time with ‹ Back, from the box and from the numbers.
- `js/weather.js`: `apparent_temperature` in `fetchPoints()`, cached with the rest; the cells cached before it carry none, and the card says "feels like" only where it's known.
- `js/chart.js` (or a small drawing of its own beside it): the day's graph.
- `css/app.css`: the reading, the hours' table, the graph; nothing that a shared control already does.
- **Removed:** Go's tab and pane; `hourStrip()` and the hour chips; Go's Leave row (the box's When replaces it, step 4); the second Your speed (each part's ⚙ and the row under the list keep it); the Go tab's time.
- **Checks** (`tools/smoke.py`): `tabs` (no Go; what a screen reader hears), `leave` (When on the box, no Go Leave row), `sections` and `stops` (a row a day, the night's sun), `keyfacts` (the box doesn't repeat a sport's row), `weather` (feels like cached and missing), `water` (the waves' line), and a new check that the card says "No forecast yet", "less certain" and the older forecast in words, and that the box says the dark. Looked at at 390 × 844, 360 × 740, 200 % and 1440 × 900, MTB and paddle, light and dark.
- **Docs:** CHANGELOG (Go's tab gone, the weather card), USING (the box and the card), README (Go's mentions), DEVELOPING (Weather: the card; the shared controls' new rows).

**6b. The weather line; the map's hour apart from the departure.**
- `js/wxmap.js`: the window becomes the card's folded line (▷, the reading, the hour, the layer's pill opening its menu, ⌃, ✕, the strip); the four chips go into the pill's menu (Wind, Temperature, Rain, Snow); `onHour` no longer calls `planner.setLeave`, nor `setLeave` the map's hour; the "Also the departure" flag goes; road works and road conditions still follow the map's hour.
- `js/main.js`: `syncWxH()`, `body.wx-over` and `columnFits()` for the line in the sheet's place on a phone; on a desktop the short piece at the toolbar's right end (`placeTools()`, which gives nothing up for it), its strip opening above it; Weather and T open the line.
- **Removed:** the floating window's placement and resize grip; the chips' row; the departure's link both ways (and with it the water legs routing again when the hour moves).
- **Checks:** `weather` (the line's reading whole at 390 px and 200 %), `fold` (the card folds to the line, ⌃ opens it, ✕ turns the weather off), `leave` (the map's hour leaves the departure alone, and the other way), `quick` (the pill's menu), `controls`.
- **Docs:** CHANGELOG, USING (the Weather button and the line), DEVELOPING (Weather, the sheet).

**Motion:** the card opening from the box and folding to the line moves things, so `/animate` decides it in 6a and 6b, and the user runs `/review-animations` before those PRs open (AGENTS.md).

## Left for step 9 and later

- **Best time to leave and Arrive by** (step 9): the room under When in the card (the mock-up's dashed box) and the When menu's two items; the strip of departures is Best time to leave's, the map's hours stay the line's.
- **The chance of rain** (one more variable), **MET Norway's ranges and the chance of thunder** (a second source): issues only if the user wants them.
- **Water temperature** (#862), **observations, cameras, warnings, the next 90 minutes, the map's legend** (#903), **clouds and thunder on the map** (#182).
- **A design critique by a fresh subagent** of the mock-up's screenshots wasn't run in this round; it's worth doing on the built card.

## Not drawn, or not known

- **States the build must draw,** not drawn in the mock-up: the forecast loading, late, partial (No forecast yet from km …) or missing (with Retry); a departure past ten days (the box and the card say No forecast yet, the sun and the dark still count); a departure that has passed; the midnight sun (no dark to shade, no "dark from"); a paddle with no wave estimate (the line left out, not 0 m); long Finnish names in the day headings at 360 px and 200 %.
- **The desktop's card** is where cards open today until step 8 puts it beside the planner.
- **Illustrative in the mock-up:** the waves, feels like (the wind chill there), the water's temperature, the sky between the hours, the profile, the list, and the rain and winter data.
