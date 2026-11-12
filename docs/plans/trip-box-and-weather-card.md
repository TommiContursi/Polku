# The trip's box and the weather card (#431)

The design of step 6 of [the one order](https://github.com/TommiContursi/Polku/issues/869#issuecomment-6710400784): the trip's box over the list, and the weather card it opens, with Go's tab gone ([#431](https://github.com/TommiContursi/Polku/issues/431), [#794](https://github.com/TommiContursi/Polku/issues/794), [#759](https://github.com/TommiContursi/Polku/issues/759), [#766](https://github.com/TommiContursi/Polku/issues/766)). Part of [#869](https://github.com/TommiContursi/Polku/issues/869); milestone [Calmer planner](https://github.com/TommiContursi/Polku/milestone/16).

**Where it stands (2026-11-12): 6b rescoped to the timeline's hour apart from the departure, on `main`'s timeline as it is, and 6c dropped ("How step 6 is built", below). Before it: the card redrawn as the trip line (Round 5, below) and built as version G in #973, with the wind's new colours, the cold by the wind's direction and thunder in Check; then the hour strip added as the card's main view (version H, #979), with G's views kept, folded.** Before it, on 2026-11-10: designed again, and decided. On 2026-11-10 the weather got three homes, each with one job (below, Round 4), and round 1 of the refresh was answered. Rounds 2 and 3 answered the rest the same day: two dropdowns, the wind as its speed's colour with its lines on top, Weather at places, and three PRs (6a, 6b, 6c) below. **Ready to build** after the ▾ pill, as steps 2 and 3 of [the one order of 2026-11-10](https://github.com/TommiContursi/Polku/issues/869#issuecomment-6772432958); 6c is new to that order, after 6b. The mock-up is [mockups/weather-card.html](mockups/weather-card.html), also a [private Artifact](https://claude.ai/artifact/X4VyAyhFQZ49xo9BHWzaKa) to try on a phone (built with `css/app.css` and `js/ui.js` inlined; the earlier one was [this Artifact](https://claude.ai/artifact/TuYMqZgUGfFuqf5QmxCUri)). **Today** shows Go and the timeline from `main`; **D: Like a weather site** is the card after round 2 of 2026-11-07; **C**, **A** and **B**, the earlier answers, stay to compare. No app code is written here.

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

### The weather timeline on `main` at ccca179 (2026-11-10), and where each part goes

Read in the browser pane at 390 × 844 and in the code (`js/wxmap.js`, `js/main.js`, `js/config.js`); the desktop's window in the code only. Since 2026-11-07, #924 and #934 turned the chips into a weather menu with switches in Layers; #932 added the radar's last 90 minutes; #939 made 3D's sky follow the hour; #928, #929 and #931 added clouds, thunder and the hatch where no radar reaches; and the legend sits over the map.

| Today (`#wx-bar`) | Goes to |
|---|---|
| The title "Timeline" and ✕ (Close timeline); on a desktop a window you place and resize (`tl-grip`) | The weather line in the sheet's place on a phone, above the toolbar's end on a desktop; ✕ closes it and the map goes back to Now. The window, its grip and the unused `dock()` go |
| The pill (`rt-pill wl-layer`): the first layer on and a count ("Rain +1"), or "Layers", opening the weather menu: Weather on the map (Rain and snowfall, Clouds, Thunder, Wind, Temperature, Snow on the ground, all ticks), Points (Towns' weather), Effects ("Softer edges and falling rain"), the sources' note; open while you tick | Two pills on a row of their own at the line's foot: the map's colour (radios; Effects under its own heading; the note) and On top (ticks: Thunder, Wind lines, Weather at places) |
| The strip (`tl-strip`): the radar's last 90 minutes ("Radar" under it), then 48 h of temperature, rain, wind arrows, the night and your trip; drag for the hour | The line's strip, all of it kept; your trip shaded, and dragging no longer moves it |
| The reading (`tl-now`) at the map's centre, or at a spot a card's Weather here holds | The line's reading, saying "map centre" or "the spot" |
| Play, the range (−90 min to 48 h) and the time: "Now · 18:23 · FMI radar", "16:10 · radar", "Wed 12:00 · +18 h", "(Rain is off)", "couldn't be loaded", "loading…" | The line, with every form kept |
| The note (`tl-note`): "Also sets road works and road conditions, and the departure of a planned route", the desktop's "Also your route's departure…", the stale forecast's warning | The departure part goes (decided); road works and road conditions still follow the hour, and the stale warning stays |
| Switching a layer on opens the timeline (`setWeather()`); opening it sets the hour to the departure (`setTimeline()`, `planner.leaveHour()`) | Neither: a layer shows at Now, and the line opens at Now (Q1) |
| The map's layers: one field, the temperature's or else the wind speed's (`wxField`); the wind's moving lines, coloured by speed (`windCv`); the radar (FMI, RainViewer) then the forecast; clouds, a grey veil; thunder's crosses by age and the forecast's thunder; the hatch where no radar reaches; snow's wash and FMI's measured depths; the towns' marks (`wx-town`), a tap holding the reading there | One colour at a time (Rain and snowfall, Clouds, Wind speed, Temperature, Snow on the ground, None) and on top any mix (Thunder, Wind lines, Weather at places); everything else as it is |
| The legend at the top left (`.map-hints`), folded under 720 px wide or 480 px tall, remembered: the temperature's or the wind's scale, the rain's steps and words, No radar here, snowfall, clouds, lightning with the nearest strike, "Shown at Now: it's seen, not forecast", the forecast's thunder, snow with FMI's "24 cm", the radar's past | As it is, for the one colour and what's on top |
| The Weather button (`#btn-time`, "Time & weather", T), "+k h" while ahead | "Weather (T)"; the sky and the temperature after the weather's first use (6c); "+k h" goes, since the line says the hour |
| Layers › Weather on the map: Timeline, Rain, Clouds, Thunder, Wind, Temperature, Snow depth, Towns' weather, Weather effects, opacity under Rain, Temperature and Snow; the note "Forecast by Open-Meteo… Scrub or play the next 48 hours on the timeline."; Winter's "Snow depth on the map" | Map colour as chips with the chosen one's opacity, Weather effects, On top as switches; the Timeline switch goes; the note ends "Play the next 48 hours with the Weather button (T)". Winter's switch sets the colour to Snow on the ground, or none |
| On now's chips (`wx:*`); the sport's tiles (`wx:rain` for most sports, `wx:wind` for road cycling, paddling and swimming, `wx:temp` and `wx:rain` for running) | On now names the colour and what's on top. The tiles stay by sport: Rain and Temperature set the colour (running's two replace each other), Wind switches Wind lines on (Q11) |
| 3D's sun and hill shadows (`sunHour()`) and its sky (`skyNow()`, #939) follow the hour | As they are (Q4) |

### What the inventory found

- **A trip in the dark says so nowhere.** Leaving at 19:42, the whole trip is after dark, and Go only says "dark from 16:58".
- **The hour chips run past the trip.** On a 58 min trip they run from 20:00 to 10:00 the next morning.
- **A trip of days gets one day's sun.** The sun line is the first day's; day 2 has none.
- **The timeline covers the planner.** At 360 px and 200 % its window lies over the full sheet (#377), and the page is 9 px wider than the screen.
- **A layer switched on opens the timeline,** so with the line in the sheet's place a Rain tile would hide the planner (settled by Q1, 2026-11-10).
- **Wind is two things at once,** a colour field and moving lines (settled by Q2: its speed a colour, its lines on top).
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

Items 1 and 3 changed on 2026-11-10 (Round 4, below): the card has no map part, and the line is the map's weather on its own.

1. **The weather card is D:** for each day, the sky, the temperature and three small lines (feels like, rain in mm, the wind and its gust with its arrow; on a paddle day the waves, an estimate; in winter the snow on the ground); "In the dark…" when it is; the sun's times on a line of their own; the hours as FMI's table (the trip's hours and one either side, marked ●) and yr's graph of 12 hours, together. Then the wind on the way, Strongest headwind ›, Colour by, Time on the way folded, and On the map.
2. **The trip's box:** "Leave now ▾ → there at 21:19", and under it the day's weather without what a sport's row says: "6…7 °C · dry · in the dark" (a row a day on a trip with nights, each with ›). A tap opens the card at that day and frames the day on the map.
3. **The map's hours are the weather line,** the card folded: the short piece at the right end of the toolbar on a desktop (#594; the user likes it there), and in the sheet's place on a phone (#233's step 3, chosen 2026-10-27; confirmed by the user 2026-11-07), so nearly the whole map shows while the hour moves. At 390 px the toolbar fills its row, so the desktop's short piece has no room there. The line: ▷, the sky, the temperature, the hour with the wind (gust) and rain, the layer as a pill ("Rain ▾"), ⌃ and ✕, over a strip dragged for the hour. Weather (the button, T) opens the line; ⌃ opens the card; dragging the hours in the card folds it to the line.
4. **The map's hour no longer moves the departure** (#431, 2026-11-07), nor the departure the map's hour.
5. **Data:** feels like (`apparent_temperature`) is fetched, Open-Meteo's ninth variable, still one call. The chance of rain, water temperature, MET Norway's ranges and the ideas in #903 aren't part of step 6.
6. **The rest of round 1, as recommended:** uncertainty in words where it starts ("less certain from Tue", "No forecast yet from km 12"), never colour alone; the hour chips go before Best time to leave (step 9) comes; "33 min moving" opens the card at Time on the way; "Includes when you leave" goes with Copy share link in More; "Wet and near freezing" under the day it's on.

### The controls, against DEVELOPING's "Shared controls"

| In the card | Shared control | Status |
|---|---|---|
| ‹ Route and ✕, the name | `way-bar`, `btn small quiet way-back`, `tool way-x`; `way-head`, `way-hint`; the sky as `card-mark` | As production's cards (`cardBox()` in `js/card.js`) |
| When | The ▾ pill (step 4; #869's "new controls") | Built in step 4, before this |
| Strongest headwind ›, Time on the way ⌄, the later rows › | `row` in `rows` (`val`, ›; ⌄ to unfold) | As production |
| The wind on the way | Go's `exposure` and `ex-item` | Moved as it is |
| Colour by | `mode-select` | As production's (its ▾ is step 15's rule) |
| Time on the way | Go's `speed-table` and `speed-row` | Moved as it is |
| Table or graph (if ever wanted) | `seg` | As production |
| The line's buttons | `tool` | As production |
| The line's two pills (2026-11-10) | `rt-pill wl-layer`, twice: "Rain ▾", "On top · 2 ▾" | As production's pill (#182); "On top · 2" joins the table |
| The colour's menu | `menu-item` with `menuitemradio` and `menu-tick` ("A choice in a list") | As the sport menus |
| On top's menu | `menu-item` with `menuitemcheckbox` and `menu-tick` | As the weather menu's (#182) |
| Layers' Map colour | `rt-chips` with `chip` ("Chips to pick one") | As the round trip's lengths |
| Layers' On top and Weather effects | `tg` | As production |
| The Weather button | `fab` | As production; its label becomes the temperature (6c) |
| **The hours' table** | none | **New:** a row an hour (time, sky, temperature, feels like, mm, wind (gust)); joins the table when built |
| **The day's graph** | none | **New:** a canvas like the profile's and the timeline's strip (`js/chart.js`, `js/wxmap.js`); joins the table when built |
| **The reading** | none | **New:** the sky, the temperature at 30 px, three lines with icons; content rather than a control |

The mock-up's own pieces aren't production's: the When pill's look is planner-rethought's drawing of step 4's pill, the toolbar is drawn simply, and the profile is a shape.

### The design critique (2026-11-07)

A fresh subagent (Sonnet) looked at six screenshots of D beside yr.no's app, and nothing else. Fixed in the mock-up: the wind in purple, as yr draws it, so green means only the trip; the strip with a round handle at the hour and ticks at midnight; "Feels" in plain ink; the hours outside the trip muted without fading; the legend and the graph's labels at 11–12.5 px in the text's ink; the moon once (no sky mark in the card's head); the box's weather line a 44 px row; the layer pill's word kept down to 340 px; "not in Polku yet" for the water's temperature; no break in "24 cm". **Left for the build:** the graph split into a temperature and rain panel with an axis and the wind as its own band (as yr does), a day heading that stays over each day's graph on a trip of days, and what shows at half (fewer facts, a small graph above the table). Dates stay as production writes them ("Sun 08/11"), since the app is in English.

## Round 4: three homes (2026-11-10)

The weather has three homes, each with one job, so a later feature has a place to go:

1. **The weather now, an overview.** The Weather button shows the sky and the temperature at the map's middle ("☁ 6°"), on phones and desktops. The towns' weather is the map's overview, under a new name (proposed: **Weather at places**).
2. **The map's weather is the weather line:** the hour, play and the strip, and two choices on it, as Zoom Earth has them: **the map's colour**, one at a time (Rain and snowfall, Clouds, Temperature, Wind speed, Snow on the ground, None), and **what goes on top**, any mix (Thunder, Wind lines, Weather at places). Layers' weather group has the same choices by the same rule. None of it depends on the sport.
3. **The trip's weather is the weather card,** the trip alone: the day's reading, the hours, the wind on the way, Time on the way. **On the map leaves the card.** A later part goes in as a row of its own with a short line and ›: warnings first (#911, which also go on top of the map), then measured nearby (#912), road cameras (#913), sun, moon and sky (#914) and the water (#862).

**Round 1's answers:**
- **A weather layer doesn't open the line.** Switched on in Layers or by a tile, it shows at Now. Only Weather (T) opens the line; ✕ closes it, and the map goes back to Now with its layers still on. Layers' Timeline switch goes.
- **Weather (T) turns on what was on last;** the first time, Weather at places. Nothing is chosen by the sport.
- **3D's sun and the hill shadows follow the map's hour,** as they do on `main` (#939).
- **The wind** is chosen from drawings (round 2): a) a colour only; b) its speed a colour, and its lines on top of any colour; c) its lines on top only. Recommended: b.

**What changes from 2026-11-07:** the card loses On the map (item 1 of Decided), and the line is no longer the card folded (item 3): it has no ⌃, and dragging the hours in the card no longer folds it, since the card has no hours of the map. The box, When, the card's day, its hours and the map's hour apart from the departure stay as decided.

**Kept from `main`,** whatever round 2 decides (the inventory of 2026-11-10, at ccca179): the radar's last 90 minutes on the strip, with "Radar" under it (#932); 3D's sky following the hour (#939); clouds, thunder and the hatch where no radar reaches (#928, #929, #931); the legend over the map, folded at first on a phone; Effects (softer edges and falling rain), drawn here at the end of the colour's menu, since it changes how the colour is drawn; the sources' note; the opacity slider in Layers; Weather here on a card; road works and road conditions following the map's hour.

**Version E of the mock-up** draws: the Weather button with the temperature; the line with **two dropdowns** on a row of their own at its foot, **two of the map's buttons at its corners** (On top at the left, the colour at the right, as Zoom Earth), and today's one menu to compare; the three winds over Rain with a menu open; The map at Now with the line closed; Layers' weather group (chips to pick the colour, switches for what goes on top); the card without On the map, with Later showing where #911–#914 and #862 go; long Finnish names at 360 px, and 200 %, where a menu becomes a sheet of its own.

**Round 2's answers (2026-11-10):**
- **The two choices are two dropdowns** on a row of their own at the line's foot: the map's colour ("Rain ▾") and On top ("On top 2 ▾"), each the ▾ pill (`rt-pill wl-layer`) opening its menu above it. The colour's menu has radios (`menuitemradio`) and Effects at its end; On top's has ticks (`menuitemcheckbox`). Where there's no room (200 %), a menu is a sheet of its own, as `popMenu()` does.
- **The wind is b:** Wind speed is one of the map's colours, and Wind lines go on top of any colour (white over a colour; the speed's colours only when the wind is the colour).
- **The towns' weather is renamed Weather at places.**
- **The Weather button shows the temperature once you've used the weather once** (Weather, or a layer from Layers or a tile). Until then it says Weather, as today, so no forecast is asked for at the map's middle before you ask for the weather.
- **The desktop toolbar's weather piece goes.** The Weather button, with its temperature, is the one place on phones and desktops; the line opens above the toolbar's end, where the piece's strip opened.
- **The Layers drawer's weather tile stays set by sport** (Rain for most sports, Wind for paddling): a shortcut that switches its layer on at Now, apart from what Weather turns on.

### Motion (decided with /animate, 2026-11-10)

DESIGN.md's Motion and its tokens (`--t-press` 120 ms, `--t-open` 180 ms, `--t-sheet` 260 ms, `--ease-out`, `--ease-drawer`); nothing new to add to them.

| What | Moves? | How |
|---|---|---|
| Weather on a phone: the line takes the sheet's place | Yes, on a tap (a few times a trip): it shows where the planner went and where the line came from | The sheet goes down out of view as it folds today, and at the same time the line rises over it from the bottom edge (`translateY(100%)` to `0`), `--t-sheet` on `--ease-drawer`. ✕ is the other way: the line leaves in `--t-open`, and the sheet comes back to the size it had. CSS transitions, so a second tap catches it mid-way. From the keyboard (T), at once. With reduced motion both fade in place (`--t-open`). |
| Weather on a desktop: the line above the toolbar's end | Yes, on a click | As a card: from 0.97 and opacity 0, growing from its foot (`transform-origin` at the toolbar), `--t-open` on `--ease-out`, leaving in `--t-press`. From the keyboard at once; with reduced motion it fades. |
| The weather card from the trip's box | Nothing new | It opens as every card from the list does (the card host's own). A morph from the box would be a layout animation for one card. |
| The two dropdowns' menus | Nothing new | `popMenu()`'s motion: each grows from its pill, a sheet of its own only fades, and one opened while the other leaves comes at once. |
| A colour picked, a tick | No | The pill's word and the ticks change at once (`settleControls()`). The map changes with MapLibre's paint transitions, as today. |
| The Weather button's temperature | No | It's data you read. It changes whenever the map stops and while you scrub, so a number never rolls. It appears at once after the weather's first use. |

**To feel at the build:** the sheet falling while the line rises at the same edge. Play it at 2 to 5 times its length in DevTools, then try it on a phone. If the crossing looks busy, start the line 30 to 80 ms after the sheet, the skill's stagger. That stays under 300 ms in all. The user runs `/review-animations` before the PR that moves it opens (AGENTS.md).

### The design review (2026-11-10)

A fresh subagent looked at nine screenshots of E with the choices above, and at its code. It worked with impeccable, emil-design-eng, apple-design, mobile-native and break-ui, at 360 px, 200 % and long Finnish names, in both themes.

**Fixed in the mock-up:**
- The reading says "map centre".
- At 200 % the reading gets a row of its own and keeps the wind and the rain.
- The pills' names start with the words they show (WCAG 2.5.3).
- Effects has a heading of its own, so it doesn't read as a second colour.
- The menus' headings are plain, "Map colour" and "On top", and lines that only repeat an item's name are gone.
- None has an icon of its own.
- An open pill greys, as the app's open controls do, rather than a green ring that reads as focus.
- On top's count is in words ("On top · 2"), not a new badge.
- No warning sign shows when there are no warnings.
- The desktop's line keeps its ✕ and stays right of the planner.

**For the build:**
- Until the forecast for the map's new centre arrives, the button and the line show "–" (loading, failed and stale too), never the old number.
- The strip stays `main`'s native range under its drawing, so screen readers adjust it by swiping. It keeps the radar's last 90 minutes and "Radar" (#932). The trip and the night are marked by more than a tint: a bracket for the trip, the moon for the dark. A drag uses `touch-action: none` and handles `pointercancel`.
- A warning on the card is the shared `warn-row`.
- The wind's lines show which way they blow when still, with reduced motion.
- "On top · 2" joins Shared controls with the ▾ pill.

Not checked: a real phone, a screen reader, high contrast, and a desktop at 721–900 px.

**Round 3's answers (2026-11-10):** a sport's Wind tile switches Wind lines on top, keeping whatever colour is on (a Rain or Temperature tile sets the colour); step 6 is three PRs, the Weather button's temperature on its own (6c).

Nothing was left open for step 6's design until Round 5 (below) redrew the card on 2026-11-11.

## Round 5: the trip line (2026-11-11)

The card as built in #973, and then F (a verdict, numbers in fixed places, the day's strip), still showed weather facts picked from Go's old contents, each drawn its own way, and missed most of what Polku knows. The user set the direction on 2026-11-11 with a [design canvas](https://claude.ai/artifact/WD6i6g3rustC7TK4HGSnVV) of six screens: a quiet trip, a trip where the weather turns, Wind on the way opened, the bar after a tap on the wind lane, Hour by hour opened, and two days with two sports and the planned sources. The canvas is the model for structure and behaviour; colours and type come from Polku's own classes and tokens. Version G of [the mock-up](mockups/weather-card.html) draws it; F and the older versions stay behind their switches.

### Two rules

**What to show.**
- A fact shows only when it changes a decision: go or not, when, what to bring, which way.
- An ordinary value stays small, in its fixed place; an unusual one rises to a note at the top, worst first, saying where and when on the trip.
- The limits are Check's own where Check has one, by each leg's sport, so the card and Check never disagree. Where Check has none, the table below proposes one.
- Each leg's sport decides which facts count: the waves only on a paddle, your own speed in the cold on a ride.
- Within about two hours of leaving, what's measured (the radar, lightning, road stations) beats the forecast.
- A source that could change a decision and didn't answer is said, at a note's size.

**How to draw it.**
- One axis: the trip from start to arrival, in clock time and km, each leg in its sport's colour. A night breaks the axis: a day each.
- Every fact that rule 1 lets through is a lane on that axis, in the colours of the map's weather layers, from the tokens. The wind's lane is head- and tailwind, its strength in its lightness, so a 3 m/s headwind doesn't look like an alarm.
- Each lane has its name and its value at its start, so no colour stands alone.
- With the axis ending at arrival, the hours either side show only in Hour by hour; a different departure redraws the lanes.

### The card's fixed places

1. **One sentence** that says how it is ("Cool, then rain and a risk of thunder"), starting with the sky's icon: thunder, snow or rain when the trip meets them, else the sky at the trip's middle hour (sun, sun behind cloud, cloud, or the moon at night). The icons are `skyKind()`'s, which gains thunder from the forecast's weather code 95–99. The sky gets no lane.
2. **Up to three notes,** worst first, each with a number. Any source can raise a note when it changes a decision.
3. **The numbers,** always in the same places: the temperature with feels like, the wind with its gusts, the rain. The waves are a fourth, on a paddle only.
4. **The trip line:** one line from start to arrival, each leg in its sport's colour, with the notes' numbers where each thing happens. Under it, the lanes on the same axis.
5. **Things to check,** folded: Hour by hour, Wind on the way, Time on the way.
6. **Around the trip,** a row each: Warnings, Measured nearby, Road cameras, Sun and moon, Water.
7. **One button:** Weather on the map.

The card's length follows the weather: when nothing changes on the way, there's no trip line and no lanes.

### What a tap or a click does

- **On a desktop** the card sits beside the map, so pointing previews: pointing at a note, a lane or a headwind stretch lights that part up on the trip line and on the map, with its km, time and value, and the map doesn't move. A click then does what a tap does on a phone. Nothing is behind hover only: a click, a tap and the keyboard reach the same thing, and keyboard focus previews as pointing does.
- **A note** frames its place on the map.
- **A lane** folds the card to a bar at the foot. The whole route is coloured by that fact and the map's matching layer goes on, at the trip's time. The bar has arrows to step from one stretch to the next ("Against you, 1 of 3"), a slider that moves you along the trip while the map's hour follows, a way back to the card, and a close that clears the map.
- **A folded row** opens in place. Wind on the way shows one stacked bar with its key on one line, then every headwind stretch, worst first, each a row that frames it on the map. Hour by hour is a table of the hours you're out, with one either side: the time, the sky's icon, where you are then, the temperature, feels like, the rain and the wind with its gust.
- **An Around the trip row** opens its own view.
- **Weather on the map** opens the map's weather at the departure.
- The "Colour the route line by" chips go: a lane does it.

### Several days and sports

One trip line a day. A day under about 30 minutes is one line of words, with its sky's icon. A lane that counts for one sport only is drawn on that leg only (the waves on the paddle).

### Details

- Every number is read from the route's points at the time you're there: nothing from the start's hours, nor from after arrival. (Go on `main` gave the wind at the start at the departure minute, "3.7 m/s, gusts 7.2", beside hour chips from the route's middle point; F took the highest hour at the middle point, 20:00 to 22:00, an hour past arrival: "5 m/s, gusts 8".)
- Times are rounded and say "around": the forecast is hourly, on a 2.8 km grid.
- No number shows twice. No sun times when the whole trip is in the dark or the whole trip is in daylight.
- Labels use the words weather apps use. Colours come from tokens, and colours that must be told apart differ in lightness too.
- No number shows twice on the card: a row under Around the trip leaves out a number a note already gives (the UV, the water's temperature).

### The wind's colours (decided 2026-11-12)

The wind's lane and the route coloured by wind share one set of colours, `--wind-*`, the same in both themes as today. Today's set made the strongest headwind the darkest, so on the dark card and the night map it stood out least, and its red and green differed little in lightness. The new set is made for the route's white casing, which the route has on the light map and the night map alike: the stronger the wind, the darker and more saturated its colour, the weaker the paler. On the card each lane sits on that casing too, thin, in both themes, so the strong wind stands out the same on the card and on the map. The tailwind turns teal, so it stays apart from the headwind's red without colour vision.

| Token | Today | New |
|---|---|---|
| `--wind-strong-head` | #b91c1c | #b8122b |
| `--wind-head` | #f87171 | #f4a074 |
| `--wind-cross` | #f59e0b | #f3cf7a |
| `--wind-tail` | #4ade80 | #9fd8cf |
| `--wind-strong-tail` | #15803d | #1f8a7c |
| `--wind-calm` | #a3acb9 | #cfd6dc |

A colour's class follows the leg's sport: `windClass()` calls a headwind strong at the limit a note uses (6 m/s on a ride, 8 on foot, 5 on a paddle's open water), and a light headwind from 1.5 m/s, so a 3 m/s headwind on a ride is light, not an alarm. Today it's strong from 4 m/s whatever the sport.

### The cold with the wind's direction (decided 2026-11-12)

`windChill()` gets the air moving past you, √((your speed + headwind)² + crosswind²), from the head- and crosswind every route point has, instead of the wind's speed added to yours. It changes Check's Very cold and Frostbite warnings, so it's a commit of its own with its own line in the changelog.

### Every weather fact, and where it lives

The places are the card's (1 to 7 above) and Check's. Where Check had no limit, one was proposed and the user accepted it on 2026-11-11, with the changes to the gusts, the water's temperature, the low sun and the rain's start. These limits are judgement, not measured truth: change them when going out shows one is wrong. "On foot" is hike, trail run and run; "rides" are MTB, gravel and road.

| Fact | Source | Time | Place | Map's weather box today | Old card (Go, `main`) | F | Elsewhere today | Lives in | Rises to a note when | Counts for |
|---|---|---|---|---|---|---|---|---|---|---|
| Air temperature | Open-Meteo | hourly, read at the minute you're there | 2.8 km grid; a route reads 2–12 points | reading, colour layer, towns | range along the route | range over the hours, one point | route coloured by temperature | 3 numbers (range); 1 sentence (its word); a lane only when it crosses 0 °C; Hour by hour | it crosses 0 °C with rain on the way (slippery, below) | all |
| Feels like, warmer than 10 °C | Open-Meteo `apparent_temperature` (it takes the damp and the sun in) | hourly | grid | — | — | yes | — | 3 numbers, under the temperature; Hour by hour | 27 °C or more | all |
| Feels like, 10 °C or colder | Polku: wind chill (`windChill()`, Environment Canada's and FMI's formula) with your own speed | to the minute | every land point | — | — | — | Check: Very cold, Frostbite risk | 3 numbers, under the temperature; Hour by hour; 2 note; Check | Check's: −15 °C Very cold, −27 °C Frostbite risk | all; most on rides |
| Wind speed | Open-Meteo | hourly | grid | reading, wind lines, towns | the start at departure, plus chips from the middle | highest hour, middle point | route coloured by wind, Paddle's row | 3 numbers (strongest on the way); 1 sentence (FMI's word); Hour by hour | through its direction (head-, cross-, tailwind) and its gusts | all |
| Gusts | Open-Meteo | hourly | grid | reading | the start at departure | highest hour | Paddle's row | 3 numbers, under the wind; Wind on the way (the strongest, where); Hour by hour | 10 m/s or more on a paddle, 14 on a ride, 20 for all | all |
| Wind direction | Open-Meteo | hourly | grid | arrow, lines | "from W", chips | arrows every 3 h | — | 7 Weather on the map; on the card only as head-, cross- or tailwind | never on its own | — |
| Head-, cross- and tailwind | Polku: the wind against your heading | to the minute | every route point | — | shares, strongest headwind | shares, verdict | route coloured by wind | 4 wind lane; 1 sentence ("behind you"); 5 Wind on the way: the stacked bar and every headwind stretch | a headwind of 6 m/s or more over 1 km or more on a ride, 8 m/s on foot; 5 m/s on a paddle's open water, from any side | rides, paddle, on foot (drawn on those legs) |
| Time lost or won to the wind | Polku: timed with and without wind | the trip | the trip | — | Time section | Time on the way | — | 5 Time on the way, in its summary | never | rides, paddle, on foot |
| Rain | Open-Meteo | hourly | grid | forecast layer, reading mm/h and 6 h total | "Rain on X km", where | total, bars, start time | route coloured by rain | 3 numbers (total on you); 4 rain lane; 1 sentence; Hour by hour | 1 mm or more falls on the way; it starts or stops on the way with 0.5 mm or more falling (so a drizzle of 0.1 mm raises nothing); 4 mm an hour is heavy | all but swim |
| Rain now and the last 1.5 h | FMI radar (RainViewer outside Finland) | every 5 min | radar image | rain layer before Now | — | — | — | 2 note within 2 h of leaving; 7 Weather on the map | leaving within 2 h and the radar has rain on the route now | all |
| Snowfall | Open-Meteo `snowfall`; rain below +0.5 °C drawn as snow | hourly | grid | the rain layer, as snow | "Snow on X km" | bars | Check: Snowing on the way | 3 numbers (in cm, in the rain's place); 4 the rain lane, as snow; Hour by hour | Check's: 2 cm or more while you're out | all |
| Snow on the ground, forecast | Open-Meteo `snow_depth` | hourly | grid | snow layer | — | note | Check: Snow on the way, slower going | 2 note; Check; 7 Weather on the map | Check's: snow on the way in winter, with the time it adds | rides, on foot |
| Snow on the ground, measured | FMI stations | the latest measurement | stations | the snow layer's numbers | — | — | — | 6 Measured nearby (#912); 7 Weather on the map | the station has snow where the forecast has none | rides, on foot |
| Cloud cover | Open-Meteo | hourly | grid | clouds layer, sky icon | — | sky icon | — | 1 sentence (the sky's word only); 7 Weather on the map; the aurora's chance (#914) | never | — |
| Thunder, forecast | Open-Meteo weather code 95–99 | hourly | grid | thunder layer (dashed area) | — | — | not in Check | 2 note, first; 4 thunder lane; 1 sentence; Hour by hour; Check (new) | any hour with thunder where you are then | all |
| Lightning strikes | FMI | each strike, the last hour | exact | thunder layer | — | — | — | 2 note, first; 7 Weather on the map | leaving within 2 h and strikes within 20 km of the route in the last hour | all |
| Daylight, dusk and dark | Polku: the sun's height | to the minute | every route point | night shading, night icon | sunrise, sunset, dark from | note, strip, sun line | Check: After sunset, In the dark | 2 note; 4 the dark on the trip line, with the time it falls; 6 Sun and moon | Check's: any part after sunset or before sunrise | all |
| Low sun ahead | Polku: the sun's position | to the minute | any point | — | — | — | — (never shown) | 2 note | the sun under 10° and within 30° of your heading for 500 m or more, with the cloud cover under about half | rides, on foot |
| Shade from hills, trees and buildings | Polku: the sun, the terrain and tree and building heights | any hour | ≈ 1 m from zoom 14 | shadows layer | — | — | — | 7 Weather on the map | never | — |
| Lit and unlit ways | OpenStreetMap | fixed | each way | Layers | — | — | Check's dark note | 2 note, as the dark note's number ("1.2 km unlit") | in the dark with 500 m or more unlit | all on land |
| Waves | Polku: the forecast wind over open water upwind, to 8 km | the leg's wind | water grid | — | — | number (estimate) | Check: Rough for a kayak | 3 numbers, the fourth; 4 waves lane on the paddle legs; 2 note | Check's: over the craft's comfortable height (kayak 0.35 m, canoe 0.25, SUP 0.2, swim 0.15) | paddle, swim |
| Slippery | Polku, from the forecast | hourly | every route point | — | "Wet and near freezing" | note | Check: Slippery | 2 note; Check | Check's: rain or sleet between −2 and +1.5 °C for 100 m or more | rides, on foot |
| Ice season | Polku, from the temperatures | the season | water legs | — | — | — | Check: Ice season | 2 note; Check | Check's | paddle, swim |
| Road conditions, forecast | Fintraffic road weather | 0–12 h | main-road sections | road conditions layer | — | — | Check, main roads | 2 note; Check | Check's: slippery or poor on a main road on the way | rides, on foot |
| Road weather, measured | Fintraffic stations | live | along main roads | the road camera's window | — | — | — | 6 Road cameras (#913), with the camera's readings | road surface at 0 °C or below with rain near the start, leaving within 2 h | rides, on foot |
| Rain in the last day | Open-Meteo, the past day | 24 h | the start only | — | — | — | switches the route style to wet; the amount is never shown | 2 note | 3 mm or more (the wet style's limit) on a route with trails | MTB, gravel, trail run, hike |
| Forecast reach and certainty | Open-Meteo: 10 days for routes, 48 h on the map; "less certain" past 72 h | — | — | ends at 48 h | notes | notes | Check: No forecast yet | 1 sentence becomes "No forecast yet for …" with no numbers; 2 note when it stops short; "less certain" a quiet line under the numbers | the forecast stops before arrival | all |
| Warnings (#911, planned) | FMI's CAP feed or MeteoAlarm, to check | by the warning's hours | regions or areas | — (planned: On top) | — | — | — | 6 Warnings; 2 note | a warning for the trip's area and hours that fits the sport: wind at sea for a paddle, thunderstorms for all, forest fire for hikes, slippery roads for rides and on foot | by the warning |
| Measured nearby (#912, planned) | FMI stations | the last reading, the last 24 h | the station nearest the trip's middle | — | — | — | — | 6 Measured nearby | leaving within 2 h, and the station measures rain or snow where the forecast has it dry, or the other way | all |
| Road cameras (#913, planned) | Fintraffic weathercams (`js/cameras.js`) | live pictures | stations near the start | — | — | — | the map's camera layer | 6 Road cameras | never (pictures) | rides, on foot |
| Moon (#914, planned) | Polku, calculated | to the minute | anywhere | — | — | — | — | 6 Sun and moon | never | all |
| UV (#914, planned) | Open-Meteo `uv_index` | hourly or the day's highest | grid | — | — | — | — | 6 Sun and moon | UV 6 or more while you're out | all; most on a paddle or a swim |
| Aurora (#914, planned) | a new source, needs the user's OK | — | — | — | — | — | — | 6 Sun and moon | never | — |
| Water temperature (#862, planned) | SYKE stations | daily | stations; unknown between them | — | — | — | — | 6 Water | under 15 °C on a swim, under 10 °C on a paddle (a capsize) | paddle, swim |
| Blue-green algae (#862, planned) | to check | to check | to check | — | — | — | — | 6 Water | algae seen near a swim leg | swim, paddle |

**One feels like, never two** (decided 2026-11-11). At 10 °C or colder it's Polku's own at your speed, the number Check's cold warnings use, so the numbers and a note always agree. Warmer, it's the forecast's `apparent_temperature`, which takes the damp and the sun in (the wind chill's formula holds only in the cold), so the variable stays in the request. **To decide:** `windChill()` adds the wind's speed to yours whatever its direction, so a tailwind reads as cold as a headwind. With the head- and crosswind known at every point, the air past you is √((your speed + headwind)² + crosswind²).

### Which notes win

Three notes fit. When more fire, they rank in this order, and the first three show, numbered on the trip line where each happens:

1. **Danger to life:**
   1. lightning within 20 km of the route in the last hour (leaving within 2 h);
   2. a warning for the trip's area and hours (#911);
   3. thunder in the forecast where you'll be;
   4. frostbite risk (−27 °C at your speed);
   5. waves over the craft's limit;
   6. cold water: under 10 °C on a paddle, under 15 °C on a swim (#862);
   7. the ice season on a water leg.
2. **Losing control:**
   1. slippery: rain or sleet near 0 °C;
   2. gusts over the sport's limit;
   3. road conditions: slippery or poor on a main road, forecast or measured.
3. **Comfort and planning:**
   1. very cold (−15 °C at your speed), or hot (feels like 27 °C or more);
   2. rain: heavy first, then on the radar now, then starting, stopping or 1 mm on the way;
   3. snowing on the way, and snow on the ground slowing you;
   4. a headwind over the sport's limit;
   5. the dark, with its unlit part;
   6. low sun ahead;
   7. UV 6 or more;
   8. the station nearby measuring rain or snow the forecast hasn't (#912);
   9. wet trails after rain in the last day.

- **Within a step,** the one that comes first on the trip wins.
- **Notes about the same thing are one:** a thunderstorm warning and thunder in the forecast are one note, the warning's.
- **A source that didn't answer,** or a forecast that stops before you arrive, ranks just under the worst note it could have raised: the lightning not answering comes after thunder in the forecast, and so does a forecast that stops short (it can't say whether there's thunder on the rest of the way).
- **Past the third,** a note isn't lost: it shows in its own place (its lane, its row under Around the trip, or Check).

## How step 6 is built

Three PRs, each tried on a phone before the next, in this order: 6a, then 6b, then 6c (round 3, 2026-11-10). All are in [Calmer planner](https://github.com/TommiContursi/Polku/milestone/16), refer to #869, and fix what they finish (#431, #794, #759, #766). 6a and 6b touch different code. 6c needs 6b's line.

**6a. The trip's box and the weather card; Go's tab goes.**
- `js/planner.js`:
  - The box goes after the sports' rows: When's line from step 4, then the day's weather line (a row a day with nights).
  - `renderWind()` becomes the card's content, the trip's alone:
    - each day's reading: the sky and the temperature, feels like, rain in mm, the wind and its gust with its arrow, the waves on a paddle, the snow in winter;
    - "In the dark…" and the sun's times;
    - the hours, as FMI's table and yr's graph;
    - the wind on the way and Strongest headwind ›;
    - Colour by, and Time on the way folded (`speed-table`).
  - The card has no map part.
  - The numbers' time opens the card at Time on the way (`revealDeparture()` goes). The day rows frame their day (`focusRange()`). The tabs lose Go (`renderTabTimes()`, the Go pane, and Take it along's buttons, which are in More).
- `js/cards.js` and `js/card.js`: a weather card in the card host, one at a time with ‹ Back, from the box and from the numbers. It opens as every card does (Motion).
- `js/weather.js`: `apparent_temperature` in `fetchPoints()`, cached with the rest. Cells cached before it carry none, and the card says "feels like" only where it's known.
- `js/chart.js`, or a small drawing of its own beside it: the day's graph.
- `css/app.css`: the reading, the hours' table and the graph. Nothing that a shared control already does.
- **Removed:** Go's tab and pane; `hourStrip()` and the hour chips; Go's Leave row (the box's When replaces it); the second Your speed (each part's ⚙ and the row under the list keep it); the Go tab's time.
- **Checks** (`tools/smoke.py`):
  - `tabs`: no Go, and what a screen reader hears.
  - `leave`: When on the box, no Go Leave row.
  - `sections` and `stops`: a row a day, and the night's sun.
  - `keyfacts`: the box doesn't repeat a sport's row.
  - `weather`: feels like cached and missing.
  - `water`: the waves' line.
  - A new check that the card says "No forecast yet", "less certain" and the older forecast in words, and that the box says the dark.
  - Looked at at 390 × 844, 360 × 740, 200 % and 1440 × 900, MTB and paddle, light and dark.
- **Docs:** CHANGELOG (Go's tab gone, the weather card), USING (the box and the card), README (Go's mentions), DEVELOPING (Weather: the card; Shared controls' new rows).

**Built (#973, 2026-11-11):** as listed, with the user's choices from the build's design review of 2026-11-11. The box sits after the profile, over the tabs, as the order of 2026-11-06 has it. The card's head is When and "→ there at" in its title's place, with no ‹ Route, so the weather starts right under the sheet's top row. Its values are in the text's ink, each line's icon in its kind's colour as the weather timeline draws them (no danger red), and the type is on the scale's tokens. Colour by in the card is three chips, Wind · Temperature · Rain, a tap each. The table and the graph stay together on every trip, the trip at least 6 wide in the graph and bracketed in the route's colour; the graph is on the chart's tokens. One rule says whether a day is wet, for the box, the reading, the hours and the graph. Then, from the screenshots at 200 % and at full: undo and redo leave the weather card (it changes nothing on the route but the departure; they come back with ✕), and the box drops its frame under 300 px so its words get the planner's width. Time on the way's wind line shows only where the wind changes the time (#766). Then, as the card read as a mess of words in sizes of its own: each day became the weather timeline's own reading (its classes and sizes) beside a strip of the day's hours drawn as the timeline's strip, the sun and the dark on one muted line, the table folded behind Hour by hour, and the graph's key and the two headings gone (the user's choice of 2026-11-11). `apparent_temperature` is Open-Meteo's tenth variable (thunder's `weather_code` came first), still one call. The hours are each sampled where you'll be then (`windAlong()`'s `series` and `cell`); the graph is an SVG (`js/daygraph.js`). The water router gives each leg its highest wave (`wave`), the card's estimate. The wind's rating word (Breezy…) went with Go, as the reading has none here. The card also opens from Check's forecast and sun items and the key facts' weather, and the map's distance marks lost their seconds (#766).

**Built again as G (#973, 2026-11-12):** the card as Round 5 has it, in four commits: the wind's colours and `windClass()` by the sport's limit; the cold by the wind's direction (`airPast()`); thunder in `skyKind()`, `windAlong()` (`thunder`) and Check (`thunderWarnings()`); then the card (`dayFacts()`, `wxTripLine()`, `wxLaneEl()`, `wxHours()`, `wxWindOpen()`). The notes take Check's own items where Check has the limit (thunder, cold, rough water, ice, slippery, roads, snow, the dark), so the two never disagree. Not built yet, as step 3's answer of 2026-11-12 set out: the notes that need a request of their own (lightning near the route and the radar now, within two hours of leaving), the lane's folded bar with its arrows and slider (6b's line; until then a lane's tap folds the card to a banner with Back on a phone, and leaves it open beside the map on a desktop, as the user chose on 2026-11-12), a temperature lane, Around the trip (#911–#914, #862), and with it the sun's times (Sun and moon, #914: until then Check's sun items no longer offer the card's "Sunrise and sunset", which it doesn't have), and hiding the box's When while the card is open beside it on a desktop. `js/daygraph.js` and the exposure bars went with the strip and Go's shares.

**The hour strip (#979, built 2026-11-12, before 6b):** version H of the mock-up, chosen by the user on 2026-11-12, as an addition: nothing #973 built goes away. The strip and its sections are the card's main view; the trip line and its lanes (**The whole trip**), **Hour by hour** and **Time on the way** fold under them, and **Wind on the way** opens from the strip's Wind. A trip with nights shows a day at a time, its chips over the sentence. `precipitation_probability` was left out for now: an eleventh variable makes each location 1.1 calls, the map's grid included. The build differs from the mock-up where the app knew better:
- The temperature is a line across the hours, the timeline's orange, the number over its point, so the two weather windows read alike; the rain's bars are in the route's rain colours.
- The wind's arrow is at its real angle to your way, coloured by the route's wind classes at your sport's limit, not one of three set angles.
- A tap on an hour picks it: the route's dot where you'll be then, and **Weather on the map** opens at it. A tap on a section's hours shows that fact on the map at the hour tapped. The route's pointer on the profile, as on the map, finds its hour.
- The sky's icons are filled and in colour everywhere the forecast's sky shows (ui.js's `sky-…`), not only in the card.
- No Waves section: Polku estimates a water leg's waves once, at the time you're on it, so an hour-by-hour row would repeat one number. The waves stay in the numbers and on The whole trip's lane.
- On a desktop the weather card is 400 px wide, for six hours and a half.

**6b. The timeline's hour apart from the departure** (rescoped by the user on 2026-11-12). **Built on `calmer-planner-timeline-hour`.** On `main`'s weather timeline as it is: its look, its window you drag and resize, its slider, its reading and its one menu stay.
- Moving the timeline no longer sets the route's departure, and the departure no longer moves the timeline. Road works and road conditions follow the timeline's hour. The strip shades your ride at its own departure.
- A weather layer switched on in Layers, the timeline's menu or a tile shows at the timeline's hour and doesn't open the timeline. Weather (T), the weather card's Weather on the map and its lanes, and Weather here open it.
- Closing the timeline sets the map back to Now, with the layers left on.

**Not chosen (2026-11-12):** the rest of what this section listed before: the line in the sheet's place, the two dropdowns (the map's colour and On top), one colour at a time, Layers' chips, the new reading, the rename to Weather at places, and the Weather button's temperature (6c). They came from mock-up E, a sketch made before the route's weather was designed. A build of them (#987) was closed unmerged: it took away the timeline's window, its dragging and resizing, and the visible slider, and the user found it worse than `main`'s. The mock-ups in [mockups/weather-card.html](mockups/weather-card.html) are sketches, not specs.

**The timeline's next round (2026-11-12):** its layers as buttons, then zooming it to your trip, in [a plan of its own](weather-timeline.md) with [its mock-up](mockups/weather-timeline.html). Its trip view replaces the lane's folded bar of Round 5.

**Next for the map's weather, when the user chooses:** a written list (no mock-up) of every place a weather setting lives today (the timeline's menu, Layers' weather group, the quick tiles, Settings → Display, Layers → Winter), with one proposal for connecting them.

## Left for step 9 and later

- **Best time to leave and Arrive by** (step 9): the room under When in the card (the mock-up's dashed box) and the When menu's two items; the strip of departures is Best time to leave's, the map's hours stay the line's.
- **The chance of rain** (one more variable), **MET Norway's ranges and the chance of thunder** (a second source): issues only if the user wants them.
- **The card's later rows,** each a row with a short line and › (Round 4), in [Richer weather](https://github.com/TommiContursi/Polku/milestone/21) and its order in [17-weather.md](17-weather.md#the-order-2026-11-08). Each needs its source checked first:
  - **Warnings (#911),** first on the card: those for the trip's area and hours, a tap opening the text. They also go on top of the map, one more item in On top's menu. The source is FMI's CAP feed or MeteoAlarm, still to check. A warning is the shared `warn-row`.
  - **Measured nearby (#912):** the nearest FMI station to the trip's middle, picked on the device: its name, height, distance, last reading and the last 24 h.
  - **Road cameras (#913):** the nearest Digitraffic weathercams to the start (`js/cameras.js`), two pictures to swipe.
  - **Sun, moon and sky (#914):** the sun (`js/sun.js`), the moon (calculated) and UV (Open-Meteo). The aurora is a new source and needs the user's OK.
  - **The water (#862):** the surface temperature at SYKE's nearest station, and blue-green algae, its source still to check. Between stations the value is unknown and looks unknown.
- **Clouds, thunder, the legend and Effects** (#182) are built. The layers' look was chosen on 2026-11-08 (Weather service, with Effects on top).

## Not drawn, or not known

- **States the build must draw,** not drawn in the mock-up: the forecast loading, late, partial (No forecast yet from km …) or missing (with Retry); a departure past ten days (the box and the card say No forecast yet, the sun and the dark still count); a departure that has passed; the midnight sun (no dark to shade, no "dark from"); a paddle with no wave estimate (the line left out, not 0 m); long Finnish names in the day headings at 360 px and 200 %.
- **The desktop's card** is where cards open today until step 8 puts it beside the planner.
- **Illustrative in the mock-up:** the waves, feels like (the wind chill there), the water's temperature, the sky between the hours, the profile, the list, and the rain and winter data.
