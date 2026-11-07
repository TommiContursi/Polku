# The trip's box and the weather card (#431)

The design of step 6 of [the one order](https://github.com/TommiContursi/Polku/issues/869#issuecomment-6710400784): the trip's box over the list, and the weather card it opens, with Go's tab gone ([#431](https://github.com/TommiContursi/Polku/issues/431), [#794](https://github.com/TommiContursi/Polku/issues/794), [#759](https://github.com/TommiContursi/Polku/issues/759), [#766](https://github.com/TommiContursi/Polku/issues/766)). Part of [#869](https://github.com/TommiContursi/Polku/issues/869); milestone [Calmer planner](https://github.com/TommiContursi/Polku/milestone/16).

**Where it stands (2026-11-07): research and the inventory are done; the first round of questions is with the user.** No mock-up yet: it's drawn once the first round is answered. No app code is written here.

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

Three subagents (Sonnet, low effort) searched; most of what they found came from search summaries, so it's a list of leads. What the design leans on was checked by hand, and is marked **checked**.

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

Asked on 2026-11-07; the answers go here.

## Not drawn yet

The mock-up, the break-ui states and the PRs come after round 1.
