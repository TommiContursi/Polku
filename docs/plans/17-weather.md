# Phase 17: weather layers

The design. What's still to do, and its status, is on GitHub: [Phase 17: weather layers](https://github.com/TommiContursi/Polku/milestone/6), phase issue #182. The order of phases is in [ROADMAP](../ROADMAP.md).

Moved here verbatim from docs/ROADMAP.md on 2026-10-16 ([the last full ROADMAP](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/ROADMAP.md)).

## Phase 17 — Weather: clouds, thunder, snow, back in time (planned 2026-10-14)

From the backlog (2026-10-14):
- **New switches** under *Weather on the map*, on the timeline:
  - **clouds** (Open-Meteo low, mid and high cover);
  - **thunder** (FMI's lightning observations; Open-Meteo CAPE and lightning potential);
  - snow moved to phase 15a (the snow-depth fill and FMI's measured depths).
- **The timeline into the past:** the last 2–3 hours of FMI's radar (WMS `time`, kept about two weeks at 5 minutes), playing like the forecast, to see where the rain came from. Past wind and temperature from Open-Meteo's `past_hours`.
- **A check before heavy loads:** when a view would cost many calls to a free service, Polku asks first. That happens with a new layer zoomed out over half of Finland, or with history for every grid point.
  - The message: "This view needs about 450 weather calls (Open-Meteo allows 10 000 a day). Load it?" with *Load*, *Not now* and *Always for this layer*.
  - The numbers come from `net.js` (each service's limits and today's use).
  - Cheap views never ask: today's weather map stays under 60 points a view.

### The ideas it came from

From docs/BACKLOG.md (lines [72](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L72), [73](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L73), [74](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L74), [75](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L75), [76](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L76), [77](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L77), [78](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L78)), moved here on 2026-10-16 because it's part of this phase's design:

### Weather *(now ROADMAP phase 17, with a check before heavy loads)*
- **More weather on the map** *(2026-10-14)*:
  - **clouds:** Open-Meteo has low, mid and high cloud cover;
  - **thunder:** FMI's open data has lightning observations, and Open-Meteo has CAPE and lightning potential;
  - **snow:** Open-Meteo snowfall and snow depth, FMI snow depth (phase 15).
  - Each would be a switch under *Weather on the map*, on the timeline.
- **Timeline into the past** *(2026-10-14)*: a few hours back, to see how the rain has moved. FMI's radar layers keep about two weeks at 5 minutes (WMS `time`), so the last 2–3 hours could play like the forecast does.

## The look (2026-11-07)

An idea from 2026-11-07: make the weather on the map look much better, with clouds and thunder, before more layers are added. The mock-up compares today's look with two directions, over real map pictures from `main`: [mockups/issue-182-weather-look.html](mockups/issue-182-weather-look.html). Nothing is built; the user picks.

### What's there today (main at c9fe8d4)

- **Rain:** the radar or the forecast in `RAIN_RAMP`'s colours, each pixel's opacity 150 + 45 × mm/h (at most 235 of 255), and the layer at 0.85 (`js/style.js`, `js/radar.js`), so from about 2 mm/h the map under it is mostly gone. Over it, `drawPrecip()` in `js/wxmap.js` draws falling streaks, fewer and fainter below 1 mm/h, and snowflakes below 0.5 °C.
- **Cloud:** Open-Meteo's cloud cover is fetched (`js/weather.js`), but only the reading's icon uses it. Nothing is drawn on the map.
- **Thunder:** nothing.
- **Reduced motion:** the streaks and flakes move all the same.

### The directions in the mock-up

- **A, motion leads:** drizzle, rain and heavy rain fall differently (short and slow, today's streaks, long and dense), so they read apart without the colour. The colour under them covers at most 38 %. Clouds are soft shadows drifting with the wind. Lightning strikes are small bolts by age (under 10, 10–30 and 30–60 minutes), and the forecast's thunder an amber hatched area with a label.
- **B, colour leads:** the rain in four clear steps (0.1, 0.5, 2 and 8 mm/h), each with its edge, at 42 %, and half the streaks. Clouds are a white veil. Strikes are dots by age, the forecast's thunder a warm glow, and a new batch of strikes flashes once.
- **Both:** **Clouds** and **Thunder** in the weather pill's menu; the nearest strike in the legend ("6 km, 4 min ago"); lightning only at Now, since it is seen, not forecast; the legend says when lightning couldn't be loaded; in reduced motion the rain is drawn still, clouds don't drift and nothing flashes.
- **Snow:** A draws the snowfall in violet over a light wash of the snow on the ground; B draws the depth in steps (1, 10, 25 and 50 cm) with their edges. FMI's measured depths sit on top as small labels in every look. Bare ground stays clear.
- **Added 2026-11-08, from #903 and the weather card's plan:** the map's hours are step 6b's weather line, whose pill ("Rain ▾") opens the layers' menu (more than one at a time; the pill says "Rain +1"); a legend over the map at the top left while a layer is on; the radar's last 90 minutes at the start of the line's strip (only the rain has a past, and the legend says so); the towns' weather at a region's scale (#916); a warning's row in the legend (#911). **Bar: Timeline today** keeps the old timeline to compare.
- The colours sit under the map's words and the route, where `addWeather()` puts them; the motion is drawn over everything, as the app's canvas is.

### For the user to decide

- A or B, or parts of each (for example A's rain with B's strikes).
- Cloud as shadows or as a veil: shadows read on the light maps, a veil on the night map.
- The chips are settled: six didn't fit one row (two rows at 390 px, the whole screen at 200 %), and step 6b's pill replaces them, as yr.no's app does (#903, item 6).
- The legend at 200 %: folded to its name until tapped (a warning stays out), or open.

### When it's built

- **Lightning:** FMI's open data (the `fmi::observations::lightning::simple` stored query answered on 2026-11-07), for the map's view and the last hour, through `request()` in `js/net.js` like every source, with its entry in Settings → Data sources. It sends the view's corners, never a position.
- **Forecast thunder:** Open-Meteo's weather code (95–99) and CAPE are in its hourly forecast; its `lightning_potential` is empty in Finland ([the weather card's plan](trip-box-and-weather-card.md#the-data-met-norway-open-meteo-and-fmi)). MET Norway's Locationforecast has a chance of thunder, but answers one point a request.
- **Missing data:** when lightning fails, the map shows the forecast's thunder only and says so; it never looks like a calm sky.
- The motion is decided with /animate, and the user runs /review-animations before the PR opens.
- Model: Opus at high (a new source, `js/wxmap.js` and `js/style.js`, smoke checks with recorded lightning).

## The order (2026-11-08)

The [Richer weather](https://github.com/TommiContursi/Polku/milestone/21) milestone, after [Calmer planner](https://github.com/TommiContursi/Polku/milestone/16)'s weather card (step 6a) and weather line (step 6b, #431), which build the card, the line and its pill. Each part is a PR of its own; a mock-up and the user's choice come first where it says so. #903's ideas from yr.no's app are all here, each with its issue.

1. **#182, the weather's look.** Waits on the user's choice of A or B in the mock-up. The rain's colours and motion, Clouds, Thunder (FMI's lightning and the forecast's thunder), the snow's look, the legend over the map, and the radar's last 90 minutes on the line (#903, items 4 and 8). Opus at high.
2. **#911, warnings** on the map and in the weather card: safety, so first after the look. A new source (FMI's warnings): its feed, CORS and terms checked, then a mock-up. Opus at high.
3. **#916, the towns' weather** on the map, zoomed out, from the map's own weather grid (no new calls). An item of the pill's menu, drawn in #182's mock-up. Opus at medium.
4. **#915, the rain in the next 90 minutes:** first a check for a radar nowcast that answers from a browser; a new source needs the user's OK. Opus at high.
5. **#912, the weather measured nearby** in the weather card (FMI's stations), with a mock-up. Opus at high.
6. **#913, road cameras near the trip** in the weather card, from the cameras Polku already has. Sonnet, or Opus at medium.
7. **#914, the sun, the moon, UV and aurora** in the weather card. The sun and moon need no service; UV may cost a call; aurora needs a source and the user's OK. Sonnet, or Opus at high with a new source.
8. **#862, the water's temperature** (and blue-green algae) for paddlers and swimmers, as yr shows the sea's: a new source. Opus at high.

Already elsewhere: the forecast's table and graph (#903, item 7) are the weather card itself (#431); wet trails are #860, and the best departures #273 (step 9).
