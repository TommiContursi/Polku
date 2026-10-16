# Phase 15: winter

The design. What's still to do, and its status, is on GitHub: [Phase 15c: skiing](https://github.com/TommiContursi/Polku/milestone/9), phase issue #185. The order of phases is in [ROADMAP](../ROADMAP.md).

Moved here verbatim from docs/ROADMAP.md on 2026-10-16 ([the last full ROADMAP](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/ROADMAP.md)). 15a and 15b are built (#52, #53, #56); the research, the decisions and what was built stay here, as the ground 15c builds on.

## Phase 15 — Winter (researched 2026-10-14)

The goal (2026-10-14): Polku in Finnish winter conditions, researched beyond the original brief, with snow drawn on the map as a filled layer.

The research brief this replaces asked about: sports for a snow group; ski tracks from LIPAS, OSM and municipal grooming status (Jyväskylä first); FMI snow depth; FMI sea ice and SYKE / Copernicus lake ice; effects on paddling and on winter sports crossing ice; the safety wording; the season. All of it is answered below.

### What there is (checked with single requests, 2026-10-14)

| Source | What | Coverage, freshness | Licence | Browser access |
|---|---|---|---|---|
| **LIPAS** WFS | `4402` ski tracks (classic and/or skate, lit km, length, width, rest stops, the operator's web page), `1550` skating routes on natural ice, `3240` winter swimming places, `4421`/`4422` snowmobile routes and trails, `4440` skijoring tracks, `304` ski huts, `4640` ski parks | All of Finland, the facility registry (no grooming status). Jyväskylä: 35 ski-track places in 134 parts | CC BY 4.0 | CORS ok (Polku uses it already) |
| **OSM** (Overpass) | `piste:type=nordic` with `piste:grooming` (classic / skating / classic+skating / scooter), `lit`, `piste:difficulty`; also `skitour`, `hike` (snowshoe), `ice_road=yes`, `mtb:winter`, `winter_service` / `snowplowing` | Jyväskylä: 355 ski-track ways, 97 % with grooming, half with lighting. 90 % share a track, path or footway; **10 % are ski-only ways** (across fields and lakes, often the links between networks) | ODbL | CORS ok |
| **BRouter** | `lookups.dat` knows the piste tags, but its routing data **leaves out ski-only ways**: a test profile on the local BRouter rode 3.7 km of tracks between two Laajavuori tracks, every metre on a way that's also a path or cycleway, and took 7 km for 3.3 km | — | — | — |
| **Helsinki region service map** (`api.hel.fi/servicemap/v2`) | Service 191 ski tracks (232, as lines): `ski_trail_maintenance` (each grooming, timed: 24 000 last winter) and `ski_trail_condition` (good / satisfactory / poor / closed / snowless / littered); skating fields (frozen / ploughed / freezing started / closed), skating routes (9), winter swimming places (45), measured water temperature at beaches | Helsinki, Espoo, Vantaa, Kauniainen, some of Kirkkonummi and its neighbours; live in season | CC BY 4.0 | CORS `*` |
| **Fluent Outdoors** (finlandoutdoors.fi; 45 municipalities listed, Jyväskylä, Kuopio, Oulu, Rovaniemi, Joensuu, Mikkeli…) | Every track with `status` (open / closed) and `maintenance.latest` (last groomed), as GeoJSON | Live in season | **Terms forbid reuse, integration into another service and automated access without written permission** (Fluent Outdoors käyttöehdot, 2022). The data mostly belongs to the municipalities | CORS `*`, but **not to be used** |
| **FMI** open data, `snow_aws` | Measured snow depth, hourly, 107 stations | All of Finland | CC BY 4.0 | CORS `*` |
| **Open-Meteo** `snow_depth`, `snowfall` | Model snow depth and snowfall, hourly forecast | Everywhere; Saariselkä had 2 cm on 14 October | CC BY 4.0, non-commercial free tier | Polku's weather calls already: still one call per location (under 10 variables) |
| **Copernicus Marine** WMTS, FMI's Baltic products | Sea ice **concentration** (1 km) and **thickness** (from SAR, 500 m), daily, from FMI's ice charts | The Baltic, in the ice season | Free and open, with attribution | WMTS without an account, CORS `*` |
| **SYKE** Hydrologiarajapinta (OData) | Lake **ice thickness** at stations (`Jaanpaksuus`, about every 10 days), freeze-up and break-up dates (`JaatJaanlahto`), surface water temperature (`LampoPintavesi`) | Dozens of lakes (46 stations in the first 500 rows of last winter); sparse | CC BY 4.0 (SYKE asks to be told about apps) | CORS `*` |
| Copernicus Lake Ice Extent (250 m, daily) and HR-S&I snow cover (20 m) | Lake ice and snow cover from satellites | Europe | Free | **Needs an account** (CDSE / Cryoland WMS answered 403): not for Polku |
| **Digitraffic** maintenance tracking | Ploughing, salting, sanding with times | State roads, and Kuopio only among municipalities | CC BY 4.0 | CORS ok |

### Decisions (2026-10-14)
1. **Skiing kept simple** to begin with; the details of ski styles are Polku's to choose.
2. **Winter is not a sport of its own.** It's a mode, with its own place in the layers menu (or Settings), and it should follow the time of year, the day and the weather where you look, by itself.
3. **Skiing waits until it's winter.** First come the existing sports in winter conditions, and the data that helps plan them, cycling in winter especially.

### The plan

**15a and 15b — Winter conditions for the sports there are (now), in two PRs: the map, then the route**
- **Winter switches itself on** from the date and the time on the timeline, and from the snow and temperature where you're looking: FMI's measured depth near the map's centre, else Open-Meteo's. It's shown as a chip ("Winter: 12 cm of snow"). The override is in Settings and in a **Winter** group in the layers menu: *Auto / On / Off*.
- **Winter layers** (the Winter group, on by themselves in winter):
  - **snow depth as a filled layer** (Open-Meteo on the weather grid, with no extra calls), with FMI's 107 measured depths on top;
  - fresh snow (the last 24 h and the forecast);
  - **ploughed and winter-maintained ways** (`winter_service`, `snowplowing`);
  - winter trail riding (`mtb:winter` 1–3: how soon a path opens after snow);
  - **groomed ski tracks** (LIPAS and OSM, to keep bikes and boots off), and snowmobile routes;
  - sea ice (FMI's charts) and SYKE's lake-ice stations;
  - lit ways where it's dark.
- **Routing in winter** (the route styles stay; winter adjusts them):
  - **Bikes:** prefer ploughed ways and `mtb:winter` trails, keep off groomed ski tracks, and lean to lit ways after dark. Road and gravel prefer winter-maintained roads.
  - **On foot:** ploughed paths; ski tracks only to cross.
  - **Paddle:** a strong warning in the ice season (sea-ice charts, SYKE's freeze-up and break-up dates). Polku never says the water is open.
- **Time in winter:** slower in snow by depth and fresh snow (bikes most, on foot less, little on ploughed ways), from 15a's snow along the route.
- **Heads-up in winter:**
  - snow depth and fresh snow on the way;
  - **slippery:** around 0 °C after rain or thaw, and freezing rain from Open-Meteo's weather codes (Digitraffic's road conditions already show on roads);
  - cold and wind chill (frostbite from about −27 °C felt);
  - darkness with unlit stretches;
  - paths that may not be open in winter (unploughed, `mtb:winter` absent or slow).
- **Summer-only things step back** in winter (beaches, water temperature, wet-ground routing).
- **Ice wording, a rule for every screen:** Polku never says or implies ice is safe.

**What Trailmap does in winter** *(viewed with a Plus account, 2026-10-14; nothing changed there, none of its tiles or keys used)*:
- **Winter is a map profile** beside MTB, Gravel, Walking, Other and Own. Each profile has its own layer settings and "Reset profile defaults".
- **The winter map drops** difficulty, trail visibility, surface and width, and draws:
  - **ways by how they open after snow**, using the community tag `mtb:winter`: 1 opens quickly (the sure picks), 2 / `yes` opens clearly slower, 3 opens slowly or not at all (mostly walkers), no tag means not known;
  - **groomed (maintained) trails**;
  - **ploughed cycleways** (`snowplowing` / `winter_service` = yes, and no / limited for not ploughed);
  - **no access in winter** (`bicycle:winter=no`, `foot:winter=no`, `mtb:winter=no`; usually a ski-track base), as a red and white chequer;
  - **ski-track bases** as double lines, coloured by source (OSM or LIPAS);
  - **skating routes**;
  - **winter-only ways** (`seasonal=winter`) at full strength: paths over ice or bog.
- Tag meanings: Trailmap's mapping guide, wiki.trailmap.fi/fi/kartoitus/tagit ("Trailmap MTB Talvikartta").
- **BRouter knows none of these winter tags** (only `lit` and the piste tags), so they can't steer its routing.
- **So Polku's winter:**
  - **BRouter, through route-style parameters:** keep off ski tracks, and prefer lit ways after dark.
  - **Overpass tiles** (as trail details load now) for the winter tags. Polku draws them like Trailmap's winter map, as a **Winter** colour mode for the profile and the route, and as Heads-up ("Opens slowly after snow: 2.4 km", "Not ploughed: 1.2 km", "No cycling in winter (ski track): 300 m", with Avoid).

**15c — Skiing (when it's winter, so there's snow to test on)**
- One **Ski** sport, kept simple: styles Classic / Skate / Any track, Any first.
- Its own router over the area's ski tracks (OSM's, which BRouter misses in part, joined with LIPAS and the Helsinki service map). Grooming age where it's open, links to the operator elsewhere.
- Ski timing, a short walk to the nearest track, and the same ice rules.

**Built (15a: winter on the map), 2026-10-15** (`js/winter.js`, `main.js`, `style.js`, `wxmap.js`, `weather.js`):
- **Winter Auto / On / Off,** in a **Winter** group in the layers panel (open while it's winter). Auto looks at the snow where you are when the map stops moving (again after 8 km): FMI's nearest station within 60 km, else the forecast model at the map centre. Winter comes on from 5 cm and goes off below 2 cm, so it doesn't flicker at the edge. The sport pill shows ❄ while it's winter, with the snow in its tooltip.
- **The snow layer**, on the timeline as **Snow** and in Layers:
  - Open-Meteo's `snow_depth` on the weather grid as a cool wash from 1 cm (to 120 cm), with no extra calls (8 variables a call);
  - FMI's measured depths on top (107 stations, hourly; a grey 0 where there's none);
  - the readout says "12 cm of snow".
- **Winter ways** (OSM, z12 Overpass tiles, a week's cache, zoom 11+), in Trailmap's winter classes:
  - opens quickly / more slowly / slowly after snow (`mtb:winter` 1, 2 / yes, 3);
  - ploughed and not ploughed (`snowplowing`, `winter_service`);
  - no access in winter (red and white: `bicycle:winter` / `foot:winter` / `mtb:winter` = no);
  - OSM's ski tracks as a pink double line;
  - winter-only ways (`seasonal=winter`).

  The summer difficulty colours fade to 30 % meanwhile. Laajavuori (Jyväskylä): 114 ski-track parts, 58 and 69 quick and slower opening, 37 ploughed, 14 not.
- **LIPAS in winter:** ski tracks (`4402`, a magenta double line), skating routes on natural ice (`1550`) and snowmobile routes (`4421`, dashed). Their cards say what they're for instead of "Ride this route" ("A ski track: keep off it on foot and by bike…"), with the operator's website for the grooming status.
- **Sea ice** (Paddle and Swim, in winter): FMI's daily Baltic ice concentration through Copernicus Marine's WMTS. A `seaice://` protocol keys out the open water, so only the ice shows over the sea.
- **Tests:**
  - `tools/smoke.py winter` checks the classes, FMI's WFS answer, Auto's thresholds and On / Off, a recorded Laajavuori tile drawn, LIPAS's ski tracks asked for, the layers going with Off, and the Snow chip.
  - `tools/shoot.py` has `*-winter`, `*-winter-layers` and `*-snow`.

**Built (15b: winter on the route), 2026-10-15** (`js/winter.js`, `analysis.js estimateTime`, `planner.js`):
- **When it counts:** wherever the route weather's snow depth (Open-Meteo, at the hour you'd be there) reaches 3 cm somewhere on the route, unless winter is set Off. In Auto or On it doesn't wait for the map's winter.
- **Time in snow** (`snowFactor`). Each stretch is slower by the snow on the ground, its way and how you go:
  - **ploughed or groomed ways** (OSM's winter classes along the route): 0.88 by bike, 0.95 on foot;
  - **streets and roads** (mostly ploughed): 0.85 by bike;
  - **trails by bike:** from 1 − cm/25 (down to 0.35), eased where `mtb:winter` says they open quickly (1 − cm/50) and harsher where they open slowly (1 − cm/20);
  - **on foot:** gentler throughout.

  The figures are rough, and the docs say so. Time & speed shows "of which the snow" (+16 min for 15 cm on a 6.8 km Laajavuori ride), included in the time and the weather's arrival times.
- **The ways' winter classes along the route** (`winterAlong`): the winter tiles (z12, Overpass, a week's cache) matched to each sample within 8 m. They load once the snow counts, and then the time and Heads-up are worked out again.
- **Winter Heads-up:**
  - snow on the way (the depth, and how much longer it makes the time);
  - snowing while you're out (2 cm or more, from the snowfall at your times);
  - **slippery**: rain or sleet at −2…+1.5 °C, 100 m or more;
  - **the cold as it feels at your own speed**: Environment Canada / FMI wind chill, with the wind plus your riding speed. "Very cold" from −15 °C, "Frostbite risk" from −27 °C;
  - **ways closed in winter** (with Avoid);
  - **beside a ski track** (walking and cycling allowed, keep off the track);
  - **not ploughed** and **opens slowly after snow** (by bike);
  - **the ice season** on water legs (in winter, or at 0.5 °C or colder on the water): Polku can't see the ice, so check FMI's chart and local reports.
- **In the dark** (any season) also says how much of it is lit (`lit=yes` on the ways the router took).
- **Routing isn't steered by winter yet,** and why:
  - BRouter's data has no winter tags (they come from Overpass);
  - its no-go lines either block hard (a closed path would also block every crossing) or, with a weight, barely change the route (tested on the local BRouter: the same 6855 m route at weight 2 and 50, a different 6759 m one only with a hard line).

  So ways closed in winter come up in Heads-up with Avoid, as other hazards do. Polku's own graph router (planned for skiing, 15c) could prefer ploughed ways later.
- **Tests:** `tools/smoke.py winterroute` uses a made-up forecast along the recorded Laajavuori tile's ploughed cycleway. It checks the classes along it, the time (ploughed slower than summer but less than unknown ways), every Heads-up item, Off silencing it all, and the ice season on water. `tools/shoot.py` has `*-winter-route` and `desk-winter-time`.

**After #52: Winter as a trail colour (#53).** Winter needed a place among the trail colours too, where you'd look for it, not only in its own group.
- **Trails & difficulty gets a fifth choice, Winter** (Off / Difficulty / Uphill / Both / Winter). It draws the winter ways (Trailmap's classes, from OSM) at any time of year, so you can look before the snow comes. The map key follows it.
- While it's winter with another colour chosen, the group says so: the difficulty colours are faded and the winter ways show over them.
- **Winter colours explained** (phase 21's rule):
  - hovering a trail adds what its winter colour means ("❄ opens quickly after snow");
  - an OSM ski track with no trail under it (over a field or a lake) has a hover and a card of its own ("Ski track · In winter: keep off on foot and by bike · groomed for classic and skating · lit");
  - LIPAS's ski tracks, skating and snowmobile routes say what they're for in the hover, not "click to ride it".
  - **A ski track on a path, track or cycleway that walking and cycling aren't barred from is "groomed"** (teal, as on Trailmap: walking and cycling allowed, off the ski track itself). Only a ski track on its own, or one marked closed in winter, says keep off. A ski track running beside a cycleway is "beside it" on the cycleway's card, not the cycleway's own winter class (the nearest winter way within 10 m of the click).
- **Trail cards** say what winter means on a way where the winter ways are drawn ("In winter: Opens quickly after snow"). "Show all OSM tags" lists the winter tags (`mtb:winter`, `snowplowing`, `winter_service`, `bicycle:winter`, `foot:winter`, `seasonal`, the piste tags).
- **Tests:** `smoke.py winter` also picks Winter in the trail colours with winter off.
