# OSM data and its consumers

Inventory for [#154](https://github.com/TommiContursi/Polku/issues/154), checked against `d53e2fa` and the linked open issues on 2026-11-01. The initial integration serves the existing road/path selection data from a weekly Finland Geofabrik snapshot, with OVH as the first deployment target. The inventory also identifies which existing and planned features can use that source later. It does not set their priority or expand their implementation scope; [the Project](https://github.com/users/TommiContursi/projects/1) and their issues hold those decisions.

[PRODUCT.md](../../PRODUCT.md) requires missing or partial data to say so, and location requests to carry only what the requested answer needs. Those requirements also apply to a service of Polku's own. [DEVELOPING](../DEVELOPING.md#how-the-trickier-parts-work) describes the existing consumers.

## Current Overpass consumers

All seven importing modules use [js/osm.js](../../js/osm.js), directly through `overpass()` or through `cachedOverpass()`. Requests pass through [js/net.js](../../js/net.js). Cached answers are fresh for seven days; an older retained answer can be returned when the mirrors fail. A successful HTTP response with a `remark` or without an `elements` array is rejected.

| Consumer and entry point | Data requested today | Use of a weekly snapshot |
|---|---|---|
| [js/ways.js](../../js/ways.js), `loadWays()`; [js/pick.js](../../js/pick.js), `resolvePick()` and `wayUnder()` | z14 tiles of supported `highway` ways, whole geometry, ordered node IDs and tags; named route relations for hiking, foot, bicycle, MTB, running, ski and fitness trails. | Initial integration. Preserve the existing `slimWays()` result and selection rules. Both picks and desktop hover share this source. |
| [js/ways.js](../../js/ways.js), `areaAt()` | `is_in` at the tapped spot, rounded to four decimals: water, parks, nature reserves and protected/recreation areas, including relation outlines and whole-area bounds. Geometry is limited to roughly 5 km around the spot. | A later polygon/containment dataset can supply this. Highway ways alone cannot answer it. Keep outer/inner roles, bounds and the distinction between a complete and a cut outline. |
| [js/trails.js](../../js/trails.js), `trailTile()` and `detailsAlong()` | z13 tiles of trails and selected tracks/footways/cycleways, fences/walls/hedges, obstacle and ford nodes. `WAY_KEEP` and `NODE_KEEP` are the exact tag lists. | Suitable for static tiles later. Used by the map, route warnings and [js/uphill.js](../../js/uphill.js)'s explicit uphill tags; nodes and non-highway barriers must survive extraction. |
| [js/winter.js](../../js/winter.js), `winterTile()` and `winterAlong()` | z12 tiles selected by `mtb:winter`, `snowplowing`, `winter_service`, `bicycle:winter`, `foot:winter`, `seasonal=winter` or `piste:type=nordic`; geometry and `KEEP` tags. | Suitable for static tiles later. Include ski-only ways with no `highway` tag. The mapped maintenance class is separate from current snow or grooming observations. |
| [js/lit.js](../../js/lit.js), `litTile()` | z13 highway ways classified from `lit`. The query returns skeleton geometry in two sets, separated by an `out count` marker; `slimLit()` stores ID, binary class and coordinates. | Suitable for static tiles later. Keep the original `lit` value in source data so `limited`, `automatic` and other values remain distinguishable for [#657](https://github.com/TommiContursi/Polku/issues/657). Missing `lit` remains unknown. |
| [js/waterdata.js](../../js/waterdata.js), `hazTile()` / `osmHazards()` | z11 tiles of rock/obstruction/wreck seamark nodes, natural rock/reef/shoal nodes, and reef/shoal or rock/obstruction ways. | Suitable for a static hazard dataset later. Preserve point and line/polygon geometry plus hazard kind. Water routing's late-answer and missing-source behavior still applies. |
| [js/stops.js](../../js/stops.js), `osmStays()` / `staysNear()` | Nodes, ways and relations for campsites, huts and lean-tos around a night's point; tags and a point/centre. Merged with LIPAS and deduplicated within 80 m. | Suitable for a static places dataset later. Preserve object type, ID, coordinates and original tags, even though today's slim cache keeps fewer fields. |
| [js/inspect.js](../../js/inspect.js), `wayNear()` / `osmDetails()` | On-demand full tags: an exact way/node/relation by ID; otherwise a highway within 12 m or a place within 40 m. A way also needs geometry for nearest distance and length. | Can later use a complete object lookup. The initial kept-tag ways dataset cannot fulfil **All OpenStreetMap details**. This explicit detail request remains an Overpass consumer. |

`detailsAlong()` can load up to 40 trail tiles, `winterAlong()` up to 24 winter tiles and `osmHazards()` up to 16 hazard tiles. These are existing runtime limits, not coverage guarantees. [#490](https://github.com/TommiContursi/Polku/issues/490) separately tracks the water router's long-leg skip reporting.

## Other current sources

These OSM-derived or related features have independent data paths. Replacing `loadWays()` leaves them on their existing sources.

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
| [#122: clickable waymarked routes](https://github.com/TommiContursi/Polku/issues/122) | Route relation IDs/tags, ordered typed members and their roles, member-way geometry and any nested relations needed to assemble a route. Today's first route name per way is insufficient for a full route card. | Waymarked Trails API remains an alternative requiring its own terms/CORS check. LIPAS fixed-route assembly is an existing code pattern. |
| [#185: skiing](https://github.com/TommiContursi/Polku/issues/185), [#146: winter routing](https://github.com/TommiContursi/Polku/issues/146), [the skiing plan](15c-skiing.md) | A connected graph including ski-only ways, shared node IDs, piste/grooming/access/winter tags and lighting. | LIPAS ski tracks and the Helsinki service map add geometry; current grooming age, snow and ice observations stay on their providers. A weekly OSM build supplies mapped ways, not a working ski router. |
| [Phase 20 cartography](20-map-style.md), [#147: uphill width](https://github.com/TommiContursi/Polku/issues/147) | Original width, visibility, surface, bridge/tunnel/railing, access, `fixme` and `noexit` tags, plus places. | Terrain still comes from the DEM; LIPAS route categories remain LIPAS data. The initial way tag allowlist is not the complete source for all planned cartography. |
| [#275: ways out and remoteness](https://github.com/TommiContursi/Polku/issues/275), [#276: loops via places](https://github.com/TommiContursi/Polku/issues/276) | Roads with relevant access tags, parking, public-transport stops/stations, harbours and landing places, queryable beyond the currently loaded map. | LIPAS landing places and harbours supplement OSM. Route timing, sunset and routing remain their existing calculations/services. Which roads count as an exit is still undecided. |
| [#657: lighting coverage and schedules](https://github.com/TommiContursi/Polku/issues/657) | Original `lit` and related mapped tags, without flattening every lit value into `yes`. | Tievelho lighting intervals and LIPAS lit lengths are separate sources whose coverage/matching rules remain to be checked. |
| [#153: more water rocks](https://github.com/TommiContursi/Polku/issues/153), [#278: landing bans](https://github.com/TommiContursi/Polku/issues/278) | Existing OSM hazards and mapped protected-area/access/seasonal tags can contribute. | MML terrain-database rocks are another dataset. Actual landing bans require a source carrying the prohibition and dates: a protected-area boundary alone establishes neither a ban nor permission. Source research remains open. |
| [#279: routing on the device](https://github.com/TommiContursi/Polku/issues/279), [#176: other countries](https://github.com/TommiContursi/Polku/issues/176) | Retained source geometry, tags and topology can support later data builds. | Engine, package sizes, licensing compatibility and device performance require their own investigation. A Finland selection dataset supplies neither worldwide coverage nor an engine-specific routing package. |

## Source contract

The retained Geofabrik extract is the reusable source. A small consumer-specific tile is a derived product. Keep the derivation reproducible from that source rather than making a permanently narrowed road/path file the only available record.

For the initial selection product, preserve these properties of `waysQuery()` and `slimWays()`:

- The exact supported highway kinds and named route kinds in [js/ways.js](../../js/ways.js), the current `KEEP` tags and each original way ID.
- The ordered node ID sequence paired with the same complete geometry. `slimWays()` counts shared nodes to cut ways at junctions, then retains the endpoint IDs. [js/ways.js](../../js/ways.js)'s `index()` reconciles differently cut copies of a way across tiles; coordinate clipping, synthetic node IDs or simplified geometry would change that behavior.
- All matching relation memberships and their names before applying the existing first-relation-name reduction. Keep a deterministic relation order. A display label in place of membership loses information needed by both current joining and later route work.
- Tile selection equivalent to the current bbox query, including whole ways selected through their nodes. A way appearing in several tiles has the same ID, coordinates and tags. Empty, successfully built tiles are distinguishable from files missing because a build or request failed.

For later derived products, the raw source must also retain node objects and tags, non-highway ways, relations with ordered member type/ref/role, original tags and object types/IDs. Future place, barrier, winter, polygon and route consumers require different subsets; filtering everything through `ways.js`'s `KEEP` would silently discard them. Relation/way references near the extract boundary can still be incomplete, so the presence of a relation is not proof that its complete geometry was included.

Record the extract timestamp, build time, schema/build version and covered region with a published snapshot. A weekly build and a seven-day browser cache are separate ages: a newly fetched tile can already contain older source data. [#148](https://github.com/TommiContursi/Polku/issues/148) tracks the freshness UX; this inventory does not add refresh controls. Access, obstacles and seasonal tags reflect the snapshot and do not establish current trail conditions.

## Boundaries of this inventory

Initial integration changes the source of road/path selection data. Existing chain length, junction, name/ref, cycleway, opposite-carriageway and relation rules stay with [js/ways.js](../../js/ways.js); [#676](https://github.com/TommiContursi/Polku/issues/676) owns the investigation of short picks. [#675](https://github.com/TommiContursi/Polku/issues/675)'s card/loading work remains separate, as does #646's sheet smoke issue.

This audit read the consumers, plans and relevant issue bodies; it did not measure Finland-wide coverage, download size, build time, live-service performance or deployment behavior. The existing snapshots in `tools/fixtures/` and the smoke groups remain the implementation's verification material, not evidence of nationwide completeness. All non-initial consumers above keep their existing sources until separately integrated.
