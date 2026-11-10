# OSM data and its consumers

Inventory for [#154](https://github.com/TommiContursi/Polku/issues/154), updated on 2026-11-03 after actual four-country publication. The [operating guide](../OSM_DATA.md) and [live receipt](../measurements/osm-live-2026-11-03.json) record the release, source epoch, measurements and verification. The published manifest and current code determine coverage, rather than this inventory's earlier Finland-only assumptions.

[PRODUCT.md](../../PRODUCT.md) requires missing or partial data to say so, and location requests to carry only what the requested answer needs. Those requirements also apply to Polku's own source.

## Existing OSM consumers

Valid hosted cache is preferred, then covered hosted tiles, then the existing public cache/mirrors when coverage is absent or the hosted source fails. Static operations have an eight-second whole-operation deadline. Fallback is one bounded independent-provider round: 15 seconds for interactive/hazard/place queries and 30 seconds for background layers. All mirror addresses remain configured; Kumi/Private Coffee is one service and is not queried twice per round. Public caches retain their seven-day freshness and stale-on-error rules. A valid empty tile differs from absent coverage, incomplete geometry and failed requests. Source timestamps and attribution survive the adapters and caches.

All seven products below are published for Finland, Sweden, Norway and Estonia. A requested tile must fit one actual extract polygon or its proved union with other hosted countries; national bounding rectangles do not establish coverage. Jointly covered border tiles combine only contributing local ranges, preserving original typed objects and indexed route memberships ([#699](https://github.com/TommiContursi/Polku/issues/699)). Genuine gaps retain bounded fallback; see [border measurements](../measurements/osm-border-2026-11-03.json).

| Consumer and entry point | Hosted product and retained data | Fallback or limit |
|---|---|---|
| [js/ways.js](../../js/ways.js), `loadWays()`; [js/pick.js](../../js/pick.js), `resolvePick()` / `wayUnder()` | ways z14: supported highways, full tags/geometry, ordered original node IDs and named route relation memberships. Picks and desktop hover share this source. | Public cache/mirrors; original joining and selection rules remain. |
| [js/trails.js](../../js/trails.js), `trailTile()` / `detailsAlong()` | trails z13: supported trails, standalone obstacles/ford nodes, fences/walls/hedges, full original tags and geometry. Map layers, route checks and uphill tags share it. | Public cache/mirrors; missing details stay explicit. |
| [js/winter.js](../../js/winter.js), `winterTile()` / `winterAlong()` | winter z12: maintenance/access/winter tags, including ski-only ways without a highway tag. | Public cache/mirrors. Mapped maintenance is separate from current grooming/snow observations. |
| [js/lit.js](../../js/lit.js), `litTile()` | Existing lit z13 integration, extended to the four country archives. Original lit values remain in source; classification and UI were reused. | Public cache/mirrors; missing lit tags remain unknown, failed areas are not dimmed. |
| [js/waterdata.js](../../js/waterdata.js), `hazTile()` / `osmHazards()` | hazards z11: existing seamark/natural rock, reef, shoal, obstruction and wreck query subsets with point/way geometry. | Public cache/mirrors; oversized/unavailable checks are marked missing, not empty. |
| [js/stops.js](../../js/stops.js), `osmStays()` / `staysNear()` | places z12: existing campsite/hut/shelter nodes, ways and complete relation centres, typed IDs and original tags. | Public cache/mirrors. LIPAS remains independent and deduplicated within 80 m. Incomplete referenced place geometry rejects the build. |
| [js/inspect.js](../../js/inspect.js), `wayNear()` / `osmDetails()` | Exact selected ways reuse raw ways. inspection z14 adds all highways and existing place/detail classes, preserving exact typed IDs, tags and way geometry. | Exact area tags reuse the loaded area. Ambiguous nearby relations still need the public query for member geometry. Unsupported classes and failed/incomplete/uncovered queries retain bounded public fallback. Older manifests can still answer supported inspection queries. |
| [js/ways.js](../../js/ways.js), `areaAt()` | Optional shared geometry z13: exact local containment, original nearby boundary segments, full tags/IDs/member paths and holes. Named-first/smallest-bounds selection and whole-only perimeter measurement remain. | One eight-second hosted budget for point and outline phases, then one 15-second public round on absent coverage/incomplete/failed geometry. Valid empty results need no fallback. Actual geometry publication/acceptance is recorded in [#696](https://github.com/TommiContursi/Polku/issues/696). |

`detailsAlong()` can load up to 40 trail tiles, `winterAlong()` up to 24 winter tiles and `osmHazards()` up to 16 hazard tiles. These are existing runtime limits, not coverage guarantees. [#490](https://github.com/TommiContursi/Polku/issues/490) separately tracks the water router's long-leg skip reporting.

## Other current sources

These OSM-derived or related features retain their independent data paths. The hosted OSM migration does not replace them.

| Feature | Owning source and code |
|---|---|
| Base map, road/path display, map POIs, military/park areas and named trails found on loaded tiles | OpenFreeMap vector tiles: [js/config.js](../../js/config.js), [js/style.js](../../js/style.js), [js/search.js](../../js/search.js). Their tile schema is a subset/transformation of OSM. |
| Land routes, route styles and most route tags | BRouter in [js/router.js](../../js/router.js), with `processUnusedTags=1` and node tags attached to route intervals; [js/valhalla.js](../../js/valhalla.js) supplies fallback geometry and translated attributes. Static selection data does not replace either routing engine or its graph. |
| Place-name search | Photon, through [js/search.js](../../js/search.js). A category query or local index would be a separate integration. |
| Marked hiking, cycling and MTB overlays | Waymarked Trails raster tiles in [js/config.js](../../js/config.js). Raster pictures do not supply relation members or clickable objects. |
| Water/land mask and waterways used by the browser's water router | OpenFreeMap vector layers rendered by [js/water.js](../../js/water.js). A hazard file replaces only the OSM hazard input. |
| Elevations, grades and climbs | Mapterhorn DEM, [js/dem.js](../../js/dem.js) and [js/analysis.js](../../js/analysis.js); [js/uphill.js](../../js/uphill.js) also reads trail-detail tags. OSM tags alone cannot supply measured terrain. |
| Official routes, outdoor facilities and nearby places | LIPAS WFS, [js/lipas.js](../../js/lipas.js), also merged into sleep search by [js/stops.js](../../js/stops.js). |
| Fairways and navigation marks | Väylävirasto, [js/nautical.js](../../js/nautical.js). Traficom depths in [js/inspect.js](../../js/inspect.js) are display-only under the existing licence rule. |
| Forecasts, measured snow, sea ice, road incidents/conditions and ships | Open-Meteo, FMI/Copernicus and Fintraffic in [js/weather.js](../../js/weather.js), [js/winter.js](../../js/winter.js) and [js/safety.js](../../js/safety.js). These need their own updates and cannot come from an OSM snapshot. |
| Save offline | [js/offline.js](../../js/offline.js) explicitly saves OpenFreeMap/DEM assets and a route snapshot; [sw.js](../../sw.js) handles its own asset requests. Existing Overpass caches use [js/idb.js](../../js/idb.js). Hosting a static file does not by itself include it in a saved offline area. |

## Planned needs and the source that fits

These mappings come from existing plans and open issues. They describe reusable data, rather than additional features for #154.

| Existing plan or issue | Static OSM contribution | Dynamic or other-source contribution |
|---|---|---|
| [#121: places by kind](https://github.com/TommiContursi/Polku/issues/121), [#160: sleep along a route](https://github.com/TommiContursi/Polku/issues/160), [phase 21](21-say-what-it-means.md) | Nodes/ways/relations for help, drinking water, toilets, food, shops, sleep/shelter and bicycle services; tags and geometry for per-kind and along-route queries. | LIPAS remains useful for official facilities. Live availability is not established by an OSM tag. Search design and category rules remain with their issues. |
| [#341: climbing places](https://github.com/TommiContursi/Polku/issues/341) | Both `sport=climbing` and `climbing=*`, with tags distinguishing outdoor areas, crags, boulders, individual routes and indoor facilities; preserve access/seasonal information and existing guide URLs. | Additional TheTopo links require verified per-place mapping or a permitted provider dataset. No guide content, guessed URLs or coverage equivalence follows from the OSM snapshot. |
| [#122: clickable waymarked routes](https://github.com/TommiContursi/Polku/issues/122) | Route relation IDs/tags, ordered typed members and their roles, member-way geometry and any nested relations needed to assemble a route. The current first-name display adapter is insufficient for a full route card; raw memberships remain available. | Waymarked Trails API remains an alternative requiring its own terms/CORS check. LIPAS fixed-route assembly is an existing code pattern. |
| [#185: skiing](https://github.com/TommiContursi/Polku/issues/185), [#146: winter routing](https://github.com/TommiContursi/Polku/issues/146), [the skiing plan](15c-skiing.md) | A connected graph including ski-only ways, shared node IDs, piste/grooming/access/winter tags and lighting. | LIPAS ski tracks and the Helsinki service map add geometry; current grooming age, snow and ice observations stay on their providers. A weekly OSM build supplies mapped ways, not a working ski router. |
| [Phase 20 cartography](20-map-style.md), [#147: uphill width](https://github.com/TommiContursi/Polku/issues/147) | Original width, visibility, surface, bridge/tunnel/railing, access, `fixme` and `noexit` tags, plus places. | Terrain still comes from the DEM; LIPAS route categories remain LIPAS data. Original tags are retained, but new rendered classes still need their own design and extraction assessment. |
| [#275: ways out and remoteness](https://github.com/TommiContursi/Polku/issues/275), [#276: loops via places](https://github.com/TommiContursi/Polku/issues/276) | Roads with relevant access tags, parking, public-transport stops/stations, harbours and landing places, queryable beyond the currently loaded map. | LIPAS landing places and harbours supplement OSM. Route timing, sunset and routing remain their existing calculations/services. Which roads count as an exit is still undecided. |
| [#657: lighting coverage and schedules](https://github.com/TommiContursi/Polku/issues/657) | Original `lit` and related mapped tags, without flattening every lit value into `yes`. | Tievelho lighting intervals and LIPAS lit lengths are separate sources whose coverage/matching rules remain to be checked. |
| [#153: more water rocks](https://github.com/TommiContursi/Polku/issues/153), [#278: landing bans](https://github.com/TommiContursi/Polku/issues/278) | Existing OSM hazards and mapped protected-area/access/seasonal tags can contribute. | MML terrain-database rocks are another dataset. Actual landing bans require a source carrying the prohibition and dates: a protected-area boundary alone establishes neither a ban nor permission. Source research remains open. |
| [#279: routing on the device](https://github.com/TommiContursi/Polku/issues/279), [#176: other countries](https://github.com/TommiContursi/Polku/issues/176) | Retained source geometry, tags and topology can support later data builds. | Engine, package sizes, licensing compatibility and device performance require their own investigation. Four-country selection archives supply neither worldwide coverage nor an engine-specific routing package. |

## Source contract

The retained Geofabrik extract is the reusable source. A small consumer-specific tile is a derived product. Keep the derivation reproducible from that source rather than making a permanently narrowed road/path file the only available record.

For the selection product, preserve these properties of `waysQuery()` and `slimWays()`:

- The exact supported highway kinds and named route kinds in [js/ways.js](../../js/ways.js), the current `KEEP` tags and each original way ID.
- The ordered node ID sequence paired with the same complete geometry. `slimWays()` counts shared nodes to cut ways at junctions, then retains the endpoint IDs. [js/ways.js](../../js/ways.js)'s `index()` reconciles differently cut copies of a way across tiles; coordinate clipping, synthetic node IDs or simplified geometry would change that behavior.
- All matching relation memberships and their names before applying the existing first-relation-name reduction. Keep a deterministic relation order. A display label in place of membership loses information needed by both current joining and later route work.
- Tile selection equivalent to the current bbox query, including whole ways selected through their nodes. A way appearing in several tiles has the same ID, coordinates and tags. Empty, successfully built tiles are distinguishable from files missing because a build or request failed.

The raw source and current derived products retain node objects and tags, non-highway ways, relations with ordered member type/ref/role, original tags and object types/IDs. Place, barrier, winter, polygon and route consumers need different subsets; filtering everything through `ways.js`'s `KEEP` would silently discard them. Relation/way references near the extract boundary can still be incomplete, so the presence of a relation is not proof that its complete geometry was included.

Record the extract timestamp, build time, schema/build version and covered region with a published snapshot. A weekly build and a seven-day browser cache are separate ages: a newly fetched tile can already contain older source data. [#148](https://github.com/TommiContursi/Polku/issues/148) tracks the freshness UX; this inventory does not add refresh controls. Access, obstacles and seasonal tags reflect the snapshot and do not establish current trail conditions.

## Boundaries and verification

The migration changes existing OSM data sources. Chain length, junction, name/ref, cycleway, opposite-carriageway and route-membership rules remain with [js/ways.js](../../js/ways.js); [#676](https://github.com/TommiContursi/Polku/issues/676) owns the separate investigation of short picks. It does not add category search, a routing engine or a basemap.

The independently testable sequence was #695 (detail products and consumers), #697 (full-tag objects) and #698 (complete four-country build and reader), followed by the protected publication. #701 repairs manual rollback while scheduled publication stays disabled; #703 repairs explicit retry after a failed manifest without bypassing provider rate limits. The [implementation plan](../superpowers/plans/2026-11-02-hosted-osm-consumers.md) records acceptance criteria and checkpoints.

The complete build measured all four countries, 28 archives and 11.224 GB. Assembly compared overlapping objects by original type/ID, tags, geometry, ordered topology and relation references, rejecting conflicts or mismatched epochs. Country-specific archives bound build resources and keep downloads local. Original Finland keys keep the existing live client working through the additive schema change.

The protected publisher verified full remote hashes and all public archive headers/ranges, including offsets above 2 GiB, before and after atomic promotion. Independent monitoring passed. Live polku.si browser measurements cover 16 locations in two profiles, all seven products and real consumer adapters, with zero normal Overpass requests, cached repeat reads and selected-way tags adding no network. Border and outside-coverage controls match conservative polygon coverage. See [live evidence](../measurements/osm-live-2026-11-03.json) and the historical [build/preview benchmark](../measurements/osm-four-country-2026-11-02.json).

Focused checks also cover hosted/public failure, deadlines, valid empty data, incomplete geometry, stale/offline caches and concurrent raw/adapted reads. Physical phones and the whole local app suite were not tested. Area/ambiguous relation geometry (#696) and joint border coverage/merge (#699) retain explicit bounded fallback.
