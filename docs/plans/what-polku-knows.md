# What Polku knows, and where it shows (#382)

Every fact Polku works out or fetches, where it comes from, where it's read in full, and where else it shows on `main` (e3c8817, 2026-11-15). Made for the design round on #382, after drawings had dropped what Polku can do and let one topic spread to every screen: after the weather work, weather keys took the place of the route's key facts in a planner drawing, and its list lost the stretches' lines (how a stretch is drawn, its warnings, the dark).

**How to use it.** Before a screen is drawn, list the rows it carries and check the drawing against them, together with round 5's [inventory of what each element does](https://github.com/TommiContursi/Polku/blob/claude/design-system-round/docs/plans/design-system-directions.md#round-5-what-each-element-does-on-main). A new feature adds its row here before it's drawn. Draw on [the full route](#the-full-route), so nothing is left out because the sample route didn't have it.

**The rules:**
- **One home.** Each fact has one place where it's read in full, with its source and what's missing.
- **Summaries are chosen, not added.** A fact can be summarised elsewhere where it changes a decision. Each such place is listed in "Also shows", so a new one is a choice someone made, and two places saying the same thing in different words show up here.
- **A summary leads home** in one tap.
- **Missing never looks complete** (AGENTS.md): the home and every summary say when a source failed, answered late or covers part of the route.

The sources are `SOURCES` in `js/net.js` (Settings → Data sources); "the route" means what Polku works out from the route itself.

## The route

| Fact | From | Home | Also shows | When it's missing |
|---|---|---|---|---|
| Distance, time, moving time | the route, speeds (`js/speeds.js`) | The planner's numbers | The line when folded; each part's heading; a stretch's row; the desktop's sticky top row | — |
| Climb and descent | the terrain model | The profile | The planner's numbers (↑ ↓), a stretch's row, a part's heading, a point's card (height) | "↑? ↓?", and Check's Not checked |
| Sports, changeovers, stops, nights | your route | Route's list (parts, rows between them) | A key-facts row per sport; a point's card (Pass by · Stop · Night, Changeover, Take the bike along) | — |
| When you leave, when you're there | When (`js/when.js`) | When's menu | The trip's box, the start's row and card, the weather card, the time in the numbers, distance marks on the map | "no forecast yet", "the time has passed" |
| How each stretch is drawn | your route | A stretch's row (Follow paths, Freehand, Over water, a carry) | Edit this stretch; the toolbar's mode for the next leg | — |
| Route style and speed | your settings | Route style and Your speed (under the list) | A part's ⚙; Settings' Speeds and tiles by sport; the toolbar's mode | — |
| Which router drew it | BRouter, Valhalla when BRouter pauses | Check | A stretch drawn grey and dotted while it's routed | Check says a fallback drew it |
| Other ways to a waypoint | BRouter | On the map, in blue, with their extra length | A leg's card: Other ways | Only when pacing has room, not under 300 m |

## The ground

| Fact | From | Home | Also shows | When it's missing |
|---|---|---|---|---|
| MTB difficulty (S0–S6), uphill difficulty (↑S0–↑S5) | Polku OSM data, the terrain model | A spot's card (its grade as a badge) | Trail colours on the map; Colour by; the key facts (hardest climb, steep descent); Check | The grade isn't shown where it isn't mapped |
| Gradient | the terrain model | The profile | Colour by; a stretch's tooltip | As climb |
| Surface, way type, width, visibility | Polku OSM data, Overpass | A spot's card (What's here) | Colour by; key fact Unpaved (road bike); Check's breakdowns | "missing for 2.3 km" in What Polku looked at |
| Obstacles: fallen trees, gates, fences, fords, wet or overgrown | OpenStreetMap | Check (Good to know or Warnings), each with its card | A stretch's row (up to three by name); markers on the route | As trail details |
| Private and no-access ways | OpenStreetMap | Check | Route style's **Short cuts ok** | — |
| Military areas, shooting ranges | OpenStreetMap | Layers | Check, where the route crosses one | — |

## Weather and light

| Fact | From | Home | Also shows | When it's missing |
|---|---|---|---|---|
| Wind on the way (head, cross, tail), gusts | Open-Meteo | The weather card | Key fact (a water leg's wind, a headwind that adds time); a point's row with Weather on; Colour by Wind; the timeline's reading; time estimates | "Weather: couldn't be loaded" in the trip's box, and "forecast unavailable" in the same planner (two wordings, one fact) |
| Temperature, how it feels | Open-Meteo | The weather card | The trip's box (each day); a point's row; Colour by; cold warnings in Check | As above |
| Rain, snowfall | Open-Meteo, FMI radar, RainViewer | The weather card | Key fact; Colour by Rain; the timeline's map layers and legend | Radar hatched where it doesn't reach |
| Thunder | Open-Meteo, FMI lightning | The weather card's notes | Check (a warning); the timeline's Thunder layer | — |
| Waves (an estimate) | the route, the wind | The weather card (a paddle's highest waves) | Water routing's costs | Past the forecast: not checked |
| The dark, sunrise and sunset | the sun's position | A stretch's row ("1.53 km in the dark") | The trip's box; the weather card's dark section; Check's Daylight; a moon in the list where the dark starts | — |
| Lit ways | Polku OSM data | Layers (Lit ways) | — | A part whose lighting didn't load isn't dimmed; a message offers Retry |

## Traffic and roads

| Fact | From | Home | Also shows | When it's missing |
|---|---|---|---|---|
| Road works, incidents, slippery roads | Digitraffic | Check | Markers on the route | Check's Not checked |
| Busy roads | Digiroad | Check | — | As above |
| Road weather cameras | Digitraffic | A camera's card (24-hour time-lapse) | Layers | — |

## Water

| Fact | From | Home | Also shows | When it's missing |
|---|---|---|---|---|
| Fairways, buoys, lights, danger marks, speed limits | Väylävirasto | Layers (nautical) | Water routing keeps clear of hazards; Check's Water hazards | — |
| Charted depth | Traficom, **shown only, never routed on** | A lake's card | Layers | — |
| Carries | the water router | A stretch's row | The planner's numbers (carry, on a route with paddling) | — |
| Ships | Digitraffic (AIS) | A ship's card (Follow on map) | Layers | Position age shown |
| Sea ice | Copernicus (FMI's ice charts) | Layers (winter) | Check: the ice season | — |

## Winter

| Fact | From | Home | Also shows | When it's missing |
|---|---|---|---|---|
| Snow depth, measured snow | FMI | Layers, the timeline's Snow depth | Time estimates; winter mode's automatic choice | — |
| Winter ways, ploughed paths, ski tracks, skating, snowmobile routes | Polku OSM data, LIPAS | Layers (Winter) | Check's Winter ways | — |
| Freezing rain, cold | Open-Meteo | Check | The weather card's notes | — |

## Places and routes to follow

| Fact | From | Home | Also shows | When it's missing |
|---|---|---|---|---|
| Marked routes (hiking, MTB, cycling, paddling) | LIPAS | A marked route's card (Follow this route) | Search; the start's Marked routes; Layers | — |
| Lean-tos, huts, campfire and landing places | LIPAS, OpenStreetMap | A place's card | A point's card at a night: Places to sleep nearby; Layers; search | — |
| Places and addresses | Photon, LIPAS | Search | — | — |

## The map

| Fact | From | Home | Also shows | When it's missing |
|---|---|---|---|---|
| Base maps, hillshade, contours | Polku, MML, aerial photos | Layers | — | Aerial keeps the coarser image |
| 3D terrain, buildings, the sun's shadows, trees' shadows | the terrain model, OpenStreetMap, Meta's canopy heights | Layers (3D) and the 3D pad | Settings (3D height) | — |
| Where you are | the device, never sent unless asked | The location dot | Round trip from Where I am (rounded to about a metre) | — |

## Taking it along

| Fact | From | Home | Also shows | When it's missing |
|---|---|---|---|---|
| Offline coverage | Save offline | Preview offline | The whole route's card; More | — |
| Share link, GPX | your route | The whole route's card | The toolbar; More | — |

## What the table shows on `main`

- **Weather has the most homes and summaries:** the weather card, the trip's box, the key facts, the points' rows, Colour by, the timeline, Check. Two of them say the same missing forecast in different words.
- **Distance and time** are in five places, which is right for numbers read at a glance, but the stretch's row repeats its part's heading on a one-sport route.
- **Check is the home of most warnings,** and a stretch's row its summary. Drawings that drop the stretch's row lose the warnings' only place in the list.

## The full route

Every mock-up of a screen with a route, and the `anatomy` checks the plan proposes, use one route that has everything the table has a row for:
- three sports (MTB, then paddling with a carry, then running), with two changeovers and the bike left behind;
- a stop and a night, timed to leave on a date, so the dark falls on the way;
- a warning, a Good to know and a source that didn't answer;
- part of the route without terrain, and the weather failing for one day;
- snow on the ground, a lit way, a LIPAS route crossed and a lean-to near the night.

The logo canvas's "One route. Every sport." already draws a route like it. The recorded files in `tools/fixtures/` are the place for it, so no drawing or check calls a router.

## Not in this table

- **What the controls do** (taps, drags, holds, keys): round 5's inventory.
- **The drawing's states:** what Edit, Done, an open planner and an open card each show and allow. That's a question of its own, apart from the look.
