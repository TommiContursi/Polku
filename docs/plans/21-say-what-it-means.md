# Phase 21: say what it means

The design. What's still to do, and its status, is on GitHub: [Phase 21: say what it means](https://github.com/TommiContursi/Polku/milestone/2), phase issue #178. The order of phases is in [ROADMAP](../ROADMAP.md).

Moved here verbatim from docs/ROADMAP.md on 2026-10-16 ([the last full ROADMAP](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/ROADMAP.md)).

## Phase 21 — Say what it means (planned 2026-10-15; after 15b)

Polku draws many layers and colours. A colour is only useful if Polku also says what it means, and much of what Polku works out (wet or slippery ground, for one) is used but never shown. A big update, worth doing.

**The rule (for every layer and every phase from now on):**
- anything drawn in a colour, a pattern or a symbol says what it is, and what it means for you, in its hover and in its card;
- anything Polku works out and uses (in routing, timing or Heads-up) is shown where it applies, not only used.

**The audit:** one row per layer: hover, card, map key, and what's worked out but hidden. It starts from this list (2026-10-15):

| Layer or finding | Hover / card now | Missing |
|---|---|---|
| Difficulty halo, uphill stripe and arrows | S-grade and uphill % on trails | the arrows' meaning; "not graded yet" (white halo) |
| Trail details (width, visibility, wet, overgrown) | in the hover's bits | the drawn width class ("narrow, under 0.6 m") said as such |
| Gravel and road sports' warm casing (unpaved) | surface, when tagged | "drawn warm: unpaved" in words |
| Winter ways, LIPAS winter routes | explained (#53) | — |
| Places per sport (LIPAS kinds, OSM POI kinds) | name and type | which kinds a switch holds, and that the sport changes them |
| Snow wash, temperature, wind, rain fields | the timeline's readout under the pointer | a hover on the map itself, at least while the timeline is closed |
| Sea ice | none | the concentration at the spot (Copernicus GetFeatureInfo, JSON) and the chart's date |
| Depth areas, contours, soundings (Traficom) | none | the depth class at the spot, with "not for navigation" |
| Wet ground after rain (`wet: auto`, recentRain) | only in Route style | on trail hovers and cards in wet sports: "about 6 mm of rain in 24 h: roots and boardwalks slippery" |
| Road conditions, incidents, road works, traffic volume | yes | — |
| The route coloured on the map (grade, surface, wind, sport) | the planner's readout while planning | the same with the planner closed |
| The water router's rough water and keep-clear zones | Heads-up only | on the route's hover where it applies |
| LIPAS places, POIs, military areas | yes | — |

The table goes into this phase's PR filled in, with a test that every inspectable layer has a hover text and a card.

## What 21 takes (from the order of 2026-10-15)

- **21** takes:
  - the per-sport place kinds as switches;
  - a clicked road or trail highlighted as one OSM way (what its card is about);
  - "not winter here: 3 cm" said on the sport pill;
  - hovers on the weather fields.

### Not winter here: said where you look

From docs/BACKLOG.md (line [31](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L31)), moved here on 2026-10-16 because it's part of this phase's design:

- **Snow below Auto's threshold says nothing where you look** *(2026-10-15; goes with ROADMAP 21)*: at Paljakka a thawing first snow (FMI: 12 cm on 14 October, 3 cm the next morning) left winter off, right by the rule (on from 5 cm), while the route counted the forecast's 6 cm. Only the layers panel says why. A dim ❄ on the sport pill with "Not winter here: 3 cm of snow" would answer it where you look.

### A clicked road highlighted

From docs/BACKLOG.md (line [71](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L71)), moved here on 2026-10-16 because it's part of this phase's design:

- **A clicked road highlighted** *(2026-10-15; in ROADMAP phase 21)*: when not planning, a click on a road or trail could highlight the whole OSM way. The tiles cut a way at their edges; the exact way comes with "Show all OSM tags" (Overpass `out geom`), so highlight the tiles' part at once and the whole way once it's fetched.

### The water router's zones on the map

From docs/BACKLOG.md (line [92](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L92)), moved here on 2026-10-16 because it's part of this phase's design:

- **Show the keep-clear zones and the wind exposure on the map** while planning, so the route's bends explain themselves.

The per-sport place kinds ("Hidden settings", BACKLOG line 69) are in #121, which this phase takes.
