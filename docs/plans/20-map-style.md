# Phase 20: map style

The design. What's still to do, and its status, is on GitHub: [Phase 20: map style](https://github.com/TommiContursi/Polku/milestone/5), phase issue #181. The order of phases is in [ROADMAP](../ROADMAP.md).

Moved here verbatim from docs/ROADMAP.md on 2026-10-16 ([the last full ROADMAP](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/ROADMAP.md)).

## Phase 20 — Map style (planned 2026-10-15)

The goal: how roads and the other elements are drawn (the cartography), and LIPAS routes as switches by kind (cycling, mountain biking, hiking, walking), as in Trailmap. The reference for the look: Tapio Kaasalainen's Mapnik styles, based on OSM Bright (likely older than Trailmap's current ones):
- github.com/TapioKn/MTB-kartta_full (summer) and github.com/TapioKn/MTB-kartta_winter (winter): CartoCSS (`roads.mss`, `paths_and_tracks.mss`, `constructs.mss`, `palette.mss`, `labels.mss`), for Mapnik.
- **Neither repository has a licence** (all rights reserved by default), and Trailmap's licence page names its MTB style "Antti Nissinen & Tapio Kaasalainen" with none either. So they're a **visual guide only**: Polku draws its own rules in MapLibre from the same ideas (Trailmap's tagging guide describes each element). Porting any of their code would need Tapio's permission first.
- **The work:**
  - roads, cycleways by surface, footways, tracks, paths by width and visibility;
  - bridges with railings, tunnels faded;
  - parking by access, shelters, huts, firepits, viewpoints, bunkers;
  - fixme and no-exit marks;
  - LIPAS routes by category (Cycling, Mountain biking, Hiking, Walking / outdoors) as their own switches.

  Compare against Trailmap's views of the same places (as in phase 12a).

**Other countries, for later** (Trailmap's licence page, support.trailmap.fi/info/lisenssit, 2026-10-15). Trailmap uses these national open maps; each needs checking for keys, CORS and terms before Polku could use it:
- **Norway:** Kartverket Topografisk norgeskart (CC BY 4.0).
- **Sweden:** Lantmäteriet Topografisk webbkarta (open data).
- **Denmark:** Klimadatastyrelsen DTK/25 (CC BY 4.0).
- **Spain:** IGN Mapa Topográfico Nacional (CC BY 4.0).
- **Estonia:** Maa- ja Ruumiamet põhikaart and ortofoto (open data).
- **Orienteering maps:** Mapant and Mapant España (CC BY 4.0).
- **Trailmap's own stack** for comparison: GraphHopper and OSRM for routing, Planetiler, Tippecanoe and TileServer GL for tiles, OpenMapTiles, MapLibre.

### A glowing route line

From docs/BACKLOG.md (line [70](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L70)), moved here on 2026-10-16 because it's part of this phase's design:

- **A glowing route line** *(2026-10-15; in ROADMAP phase 20)*: a stronger neon halo as an option beside the plain red line, to make the route stand out over busy layers.

**Done ahead of the phase in #198 (2026-10-16):** a soft glow, brighter on the leg under the pointer, and chevrons moving along the route the way it goes (`js/routeflow.js`). What's left for this phase: how strong the glow is against the new map style.

Other countries' maps are an idea of their own now: #176.
