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

### Beside other services (2026-11-08)

The mock-up's A and B, each weather on a phone, beside screenshots of Windy (radar, rain, thunder, clouds), RainViewer, yr.no's map, Blitzortung, FMI and Foreca taken the same day, and a design critique (the design-critique skill):

- **Rain:** every one of them says the strength by colour, in a ramp or in steps, and animates time, not drops; Windy's particles show the wind. B is that convention, so it reads at once, and it holds in a still picture and in reduced motion. A's streaks say it only while they move, and its light colour leaves drizzle and rain hard to tell apart in a still picture.
- **Lightning:** Blitzortung and Windy draw strikes as dots or flashes by age, white or yellow to red: B's dots. A's bolts read as lightning without the legend, but crowd where strikes are dense.
- **The forecast's thunder:** A's hatched area with its label reads apart from the rain; B's warm glow is close to the rain's magenta step.
- **Clouds:** drawn over the route, B's veil washed the route out. Both now sit under the map's words and the route, as Windy's do.
- **The legend and the time:** yr's legend sits top left, as here; Windy's radar strip runs from an hour ago to the next hour, as the line's radar part and #915 would.
- **Colour vision:** B's two top steps (dark blue, magenta) are close in lightness, so they part by hue only; their edges help, a lighter last step would help more.
- **Snow on the ground:** faint in both near the route; the measured labels carry it there.
- **FMI and Foreca (looked at 2026-11-08, at the user's ask):** both show the radar in clear colour steps, as B does: FMI from blue through green and yellow to red with the words "Heikkoa · Kohtalaista · Voimakasta" under the scale, Foreca from light blue through violet and red to black. Both split the time bar into what was seen and what's forecast ("Havainto | Ennuste"), as the line's radar part does. Foreca draws lightning as yellow crosses, and has a switch for the precipitation's type (rain or snow), as the violet snowfall here does. FMI's warnings are coloured areas with a symbol in each, with a list by region and a greyscale switch (for #911).
- **Words on the scale:** FMI's legend names the steps, not only their numbers; Polku's legend could say "light · moderate · heavy" beside the mm/h.
- **A suggestion, for the user to choose:** B's rain and lightning dots, A's hatched thunder area, A's cloud shadows on the light maps and the veil on the night map, and the streaks kept, fewer, as today's.

### Two looks: a weather service's and a vivid one (2026-11-08)

An idea from 2026-11-08: two looks instead of A and B, one that shows the weather just as weather services do, and one that is lively to look at, with better motion (lightning above all). And the map should show clearly where there's no data, as yr's app hatches the countries it has none for. The mock-up's **Weather service** and **Vivid** are these; A and B stay behind the Look switch to compare.

- **Weather service:** the rain in five colour steps (0.1, 0.5, 2, 5 and 15 mm/h, light blue to violet, no magenta, which DESIGN.md keeps for the route) with words under the scale; nothing falls; clouds a still white veil; a lightning strike a cross coloured by age as yr's are (orange under 1 min, violet under 10, light violet under 60), each new one fading in over 180 ms; the forecast's thunder a light amber area with a dashed edge.
- **Vivid:** a smooth, lighter ramp, with drops in three depths (far ones small, faint and slow) and snowflakes; clouds two layers of shadows drifting at different speeds; a new strike a branching bolt with a sheet of light around it, flickering for about 400 ms, then a glowing dot by age, and a new strike every few seconds while Thunder is on. The forecast's thunder a warm glow with an amber edge.
- **Reduced motion,** in both: nothing falls, drifts or flashes; a new strike is its dot at once.
- **Where there's no data:** beyond FMI's radars' reach (about 250 km) the map is hatched and the legend says rain and snow aren't shown there. Only at Now and in the past: the forecast covers everywhere. The mock-up's radar places are approximate; when it's built, the reach comes from FMI's own radar composite (its edge), not a guess. Lightning's reach (FMI's network sees Finland and its neighbours) and the warnings' (Finland only) have edges of their own, to check with their sources.
- **A setting or one look:** both could stay, as **Weather look** in Settings (Weather service, Vivid), or the user picks one. Today's and B's top steps are magenta, which DESIGN.md keeps for the route; both new looks end in violet.

### Weather service, with Effects (2026-11-08, chosen)

The user's choice on 2026-11-08: **Weather service** is the look, and **Effects** sits on top of it, one tick at the end of the pill's menu, on by default. Vivid's effects didn't look good enough, and the effects must never make the weather harder to read. Vivid, A and B stay in the mock-up to compare.

- **Softer edges:** the colour steps are feathered (a 2.5 px blur), so the rain reads as rain, not tiles; each step's colour still means the same. The hatch where there's no radar fades in over its edge.
- **Rain and snow:** a few thin white streaks at the wind's angle where it rains, one depth only; snow as small white flakes with a grey edge.
- **Clouds:** the white veil drifts slowly with the wind. It is drawn once and slid, not redrawn each frame.
- **Lightning:** a new strike's cross fades in (180 ms, easing out) with a short white glow and one ring in its age colour that grows and fades (600 ms, easing out), so the eye finds where it just struck. Only new strikes ring, and only once.
- **Off,** and in reduced motion, nothing moves: the edges stay soft (they don't move), the rain is drawn still, and a new strike's cross only fades in.
- **/review-animations (2026-11-08):** run on the mock-up's effects. It found a timer that doubled with each new batch of lightning, a linear fade on the cross, a ring longer than it needed (800 ms) and the cloud veil redrawn every frame; all four are fixed in the mock-up. The ring stays over 300 ms: it explains a change on the map, not the interface's answer to a tap.

### Built: the menu, the legend and the rain's look (PR 1, 2026-11-08)

- **The menu:** the timeline's four chips became one pill (`rt-pill wl-layer`: "Rain ▾", "Rain +1") opening `popMenu()` with ticking items: Rain and snowfall, Wind, Temperature, Snow on the ground, then Effects. It stays open while you tick. Step 6b moves the pill into the weather line and keeps the menu.
- **The legend** sits in `.map-hints`, over the map at the top left, apart from the timeline: the temperature's or the wind's scale, the rain's five steps with their words, the snowfall's steps when it's below +0.5 °C somewhere on the map, and the snow's steps with FMI's measured depths. Under 340 px wide or 480 px tall (a phone or a desktop at 200 %) it folds to **Legend**.
- **The steps:** rain 0.1 · 0.5 · 2 · 5 · 15 mm/h, snowfall 0.1 · 0.5 · 2 mm/h in violet, snow on the ground 1 · 10 · 25 · 50 cm, each one solid colour at the layer's opacity (rain 0.55, snow 0.5), for FMI's radar and the forecast alike. RAIN_RAMP's magenta is gone.
- **Effects** (on by default, remembered): the steps' edges blurred (1 px on the forecast's 360 px image, 1.5 px on the radar's ~1 km pixels) and `drawPrecip()`'s thin white streaks and white flakes. Off: crisp steps, nothing falls. Reduced motion: drawn once, still.
- **Found and fixed:** after moving the time ahead, the drops followed the radar's rates of Now until the map moved, so a dry radar left the forecast's rain without any. Zoomed out, a radar echo at a cell's middle filled its 100 km with drops; each drop now asks the radar at its own spot.
- **RainViewer outside Finland** (checked 2026-11-08, Norway's coast at Finland's scale): its Universal Blue tiles are blue like the steps, but drizzle is beige and the heaviest cells yellow, which the legend doesn't list. Filed as #923; nothing changed here.

### Built: the towns' weather (PR 2, #916, 2026-11-08)

- **Towns' weather** under **Points** in the pill's menu, as the mock-up's Scale: The region draws it: below zoom 9.5, the sky's icon, the temperature and the wind's arrow and speed in a small solid pill above each town's name, at the timeline's hour. The pill says "Towns" when it's the only one on.
- **The towns** are the map's own city and town labels as placed (so a town shown is a town named), cities first, then OpenMapTiles' rank, kept 84 × 40 px apart, out from under the map's buttons and panels, and never over the route.
- **From the grid:** each town is the grid's bilinear sample, the readout's, with FMI's rate at Now. No request of its own; a town outside the grid shows nothing.
- **The legend** has a row for it ("Towns the sky, °C and wind in m/s"); zoomed in, it says to zoom out.
- **Not like the mock-up:** the temperature is the text's colour (blue at 0 °C and below), not red, which DESIGN.md keeps for danger; the wind has its arrow, so the number reads as wind.

### For the user to decide

- Whether Effects also has a place in Settings, beside the pill's menu.
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

1. **#182, the weather's look.** Weather service with Effects on top (the user's choice, 2026-11-08), and the hatch where there's no data. The rain's colours and motion, Clouds, Thunder (FMI's lightning and the forecast's thunder), the snow's look, the legend over the map, and the radar's last 90 minutes on the line (#903, items 4 and 8). Opus at high.
2. **#911, warnings** on the map and in the weather card: safety, so first after the look. A new source (FMI's warnings): its feed, CORS and terms checked, then a mock-up. Opus at high.
3. **#916, the towns' weather** on the map, zoomed out, from the map's own weather grid (no new calls). An item of the pill's menu, drawn in #182's mock-up. Opus at medium.
4. **#915, the rain in the next 90 minutes:** first a check for a radar nowcast that answers from a browser; a new source needs the user's OK. Opus at high.
5. **#912, the weather measured nearby** in the weather card (FMI's stations), with a mock-up. Opus at high.
6. **#913, road cameras near the trip** in the weather card, from the cameras Polku already has. Sonnet, or Opus at medium.
7. **#914, the sun, the moon, UV and aurora** in the weather card. The sun and moon need no service; UV may cost a call; aurora needs a source and the user's OK. Sonnet, or Opus at high with a new source.
8. **#862, the water's temperature** (and blue-green algae) for paddlers and swimmers, as yr shows the sea's: a new source. Opus at high.

**Built now (the user's choice, 2026-11-08):** #182 goes before Calmer planner's weather card, menu included, as six PRs: the menu, the legend over the map and the rain's look; #916; clouds; thunder; where there's no radar; the radar's last 90 minutes. Step 6b then moves the pill into the weather line and keeps the menu. The package and its order are on #182.

Already elsewhere: the forecast's table and graph (#903, item 7) are the weather card itself (#431); wet trails are #860, and the best departures #273 (step 9).
