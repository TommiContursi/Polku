# Stones, shoals and rapids in water routing (#153)

The water router keeps clear of OpenStreetMap's rocks and shoals, but OSM has few of them away from the coast's charted rocks. MML's background map (`taustakartta` v21), which the map already draws from (#1160, #1168, #1186), has stones in the water, stone fields and shoals at sea and on lakes alike, under CC BY 4.0. This plan says how the router reads them, how far it keeps from each, and asks one question: what a route does at rapids.

## Where it stands

- **Plan, 2026-11-20.**
- **Decided, 2026-11-20** (on #153's description): built now, at sea and on lakes alike, from MML's background-map tiles with Polku's key or the person's own: stones in the water at and above the surface, stone fields in the water and shoals join the water router's keep-clear zones.

## What MML's tiles have (checked 2026-11-20)

- **Classes:** stones at the surface (38512) and above it (38513) are points in `maasto_piste`, in zoom 14's tiles only. Stone fields in the water (38600) and shoals (38700) are areas in `maasto_alue`, in zooms 12–14 and 13–14. Rapids (38200) are lines in `vesisto_viiva`, zooms 11–14. Zoom 14's tiles have every one of them.
- **How exact:** each feature carries MML's positional accuracy (`sijaintitarkkuus`). Stones above the surface are within 5–7.5 m, stones at the surface within 10–12.5 m, stone fields and shoals within 10–12.5 m (1,439 features in 595 tiles).
- **How many:** 25 tiles (about 6 × 6 km) held 304 stones and 126 stone fields and shoals off Kotka, 69 stones off Porvoo, 72 off Nauvo and 61 on Saimaa, where OSM had 33 rocks in all of southern Näsijärvi (#153).
- **Size:** a zoom-14 tile is 31 kB at the median and up to 84 kB, sent uncompressed, and the browser may keep it a day (`max-age=86400`).
- **Outside Finland** MML answers every tile, empty: 314 bytes with no features, at Tallinn and in the Gulf of Finland's middle. Inside Finland every tile has features, at sea too (the sea's own area, 36211). `FINLAND_BOUNDS` includes Tallinn, so the box can't tell them apart: an empty tile can.

## 1. How the router reads them

The hidden map draws a leg's water at 3 m a pixel or coarser, which is MapLibre's zoom 13.1–13.7 across Finland: it loads zoom 13's tiles at best, and lower ones for longer legs. Stones are in zoom 14's tiles only.

| | How | Gets the stones | When MML is slow or fails |
|---|---|---|---|
| A. The `mml` source on the hidden map | Drawn with the water, at the hidden map's zoom | No: zoom 13 at best, so no stones | The water itself waits for MML (its `idle` takes every source), up to 20 s; which tiles failed is hard to tell |
| **B. Zoom 14's tiles read directly** (recommended) | The tiles over the leg's box, read and turned into rocks and areas, drawn as OSM's are | Yes, every class | A source of its own, as Syke's depths: 2.5 s, then routed without it, with Not checked and Retry |
| C. The tiles the main map has loaded | `querySourceFeatures()` | Only where the map was at zoom 14 | Nothing to say what's missing |

**Recommended: B.**

- **Which tiles:** zoom 14's over the leg's box, when the box overlaps `FINLAND_BOUNDS`, at most 64 of them: legs up to about 5 km. A leg needing more is routed without them, and Check says "not checked, the leg is too long", as for the other sources (#490). The wider second try a long carry makes (`attempt()` at 1.1) reads its own box, and the tiles both boxes share are read once: each tile is kept for the session, as OSM's rocks are.
- **The network:** through `request()`, as a source of its own (`mml`, "National Land Survey" in Settings → Data sources), at the address and key the map's `mml` source uses, so the browser's cache has the tiles the map has shown at zoom 14. As the depth files: no back-off and a 10 s deadline, so one that fails pauses nothing else and one that hangs is asked again. A tile that failed is asked again in two minutes, and at once on Retry.
- **Reading a tile:** the vector-tile reader in `js/shadows.js`, made to read any layer, so there's one reader. Only the classes above are kept.
- **Not complete where it isn't:** a tile with no features at all counts as outside MML's map. The router measures how much of the leg's water lies in tiles MML covered, as it does for Syke's surveyed water, and What Polku looked at says so.
- **OSM's rocks stay everywhere,** beside MML's: no code to switch between them, and neither set has all the other's. They're the fallback beyond Finland that AGENTS.md asks for (#1201), and where MML doesn't answer they're still there.
- **Offline:** offline saves keep OpenFreeMap's tiles, not MML's (`sw.js`), so offline a leg is routed with OSM's rocks and Not checked says MML's didn't load, unless the browser still has the tiles from that day. MML's tiles in offline saves would be a part of their own.
- **A leg saved before** (no `checked.stones`) is routed again when the route loads online, as #1187 does for the depths.
- **Tests** answer MML's address from recorded tiles in `tools/fixtures/` (the ones #1186 records off Kotka and on Kitkajoki), never live MML.

## 2. How far to keep clear

| What | MML's accuracy | Keep-clear zone | Why |
|---|---|---|---|
| Stone at the surface (38512) | 10–12.5 m | **25 m**, as OSM's rocks | Awash: hard to see in waves or against the sun |
| Stone above the surface (38513) | 5–7.5 m | **15 m** | Seen in time; MML places it closer |
| Stone field (38600), shoal (38700) | 10–12.5 m | **The area and 15 m round it**, as OSM's reefs and shoals | |

All three cost ten times as much to paddle through, as OSM's rocks do, so a narrow strait is still crossed where there's no short way round, and none of them makes a carry: a cell of land costs 22. **Rocks & shoals: Ignore** turns them off with the rest. No new setting.

Measured on 25 tiles at each place, the zones cover this share of the water, and of the water within 100 m of the shore:

| | Kotka | Porvoo | Nauvo | Saimaa |
|---|---|---|---|---|
| These zones | 4.4 % / 14.6 % | 1.3 % / 2.8 % | 0.7 % / 1.1 % | 1.1 % / 7.6 % |
| 25 m round every stone, areas + 15 m | 5.0 % / 16.8 % | 2.2 % / 5.0 % | 0.8 % / 1.5 % | 1.2 % / 8.6 % |

The second row is the same 25 m for the stones you see as for the awash ones. Kotka's archipelago is the densest seen.

**Not included:** stones under the surface (38511, 0.3–1.5 m deep). The decision names stones at and above the surface. A kayak or a canoe floats over 0.3 m, but a SUP's fin may not. A question for later.

**Check:** a route that still passes through a zone gets "Close to a marked rock or shoal" under Good to know, as now, its note naming MML's map too. The build counts the items on a route through Kotka's archipelago with **Near the shore**, and if a route gets more than a few, passes close together become one item.

## 3. Rapids: a question

Nothing in the router or Check reads rapids today, so a river route goes through them without a word.

- **MML:** rapids (38200) as lines along the river, in zoom 14's tiles the router reads anyway: 8 lines over Ruunaa, 37 m to 987 m long. No grade.
- **OSM:** 696 rapids in Finland (549 points, 143 lines), none with a whitewater grade. OpenFreeMap's tiles have none, so they'd come with OSM's rocks: from Polku's hosted OSM data (Finland, Sweden, Norway and Estonia) and from Overpass elsewhere. That adds `waterway=rapids` to the OSM build's hazards product and to the rocks' Overpass query; the hosted data has them once the build next publishes.

| | What the route does | For | Against |
|---|---|---|---|
| **A. Warn, and Avoid carries round** (recommended) | Stays on the river. Check's Warnings say "Rapids for 330 m" at their place: how hard they are isn't known, so look at them from the shore first, and carry round if unsure. The item's **Avoid it** puts places to avoid along the whole rapid, and the router carries round on land, with the carries it already makes | The person decides, rapid by rapid; no new setting | A route through rapids until they choose |
| B. Carry round every rapid | Rapids cost as much as land, so the router carries round each, and Check says so | Never through rapids unwarned | Wrong for small rapids most paddlers run and for whitewater; the data can't tell a riffle from a fall |
| C. A route style: Run or Carry round | A new **Rapids** control | One choice for the whole route | A new setting; still blind to grade |

**Recommended: A, from MML's tiles in Finland and OSM's rapids everywhere,** both at once as with the rocks: AGENTS.md asks for a fallback beyond Finland (#1201). What Polku looked at gains a row "Rapids": "the National Land Survey and OpenStreetMap" where MML's map covers the route's water, "OpenStreetMap" beyond it. Avoid's circle is at most 150 m round today, too small for a rapid longer than about 270 m, so a rapid's item carries circles along its length, as a group of fallen trees does.

## 4. How Polku says it

- **Route style, Rocks & shoals** (paddling and swimming): "Keeps clear of marked dangers: isolated-danger and cardinal marks (Väylävirasto), stones, stone fields and shoals on the National Land Survey's map in Finland, and the rocks, reefs and shoals in OpenStreetMap." The depths' sentence stays.
- **What Polku looked at, Rocks and shoals:** "the National Land Survey and OpenStreetMap" when MML covered all the route's water; "OpenStreetMap; the National Land Survey's for 2.1 of 6.4 km on the water" when part; "OpenStreetMap: outside the National Land Survey's map" when none; "the National Land Survey didn't answer" when its tiles failed. Only the first is ✓ in Finland.
- **Not checked:** "Stones and shoals from the National Land Survey didn't load", with Retry, and "Stones and shoals: not checked, the leg is too long".
- **README, USING, DEVELOPING and CHANGELOG** in the same PR. The CHANGELOG, something like: "Paddling routes keep clear of the stones, stone fields and shoals on the National Land Survey's map, at sea and on lakes, beside OpenStreetMap's rocks. Water routes are for planning, not navigation: keep a lookout."

## What the build reaches

- `js/shadows.js` (the reader), `js/waterdata.js` (the source, its tiles and failures), `js/water.js` (the zones and the water MML covered), `js/planner.js` (What Polku looked at, Not checked, saved legs), `js/net.js` (the source), `js/styles.js` (Rocks & shoals).
- `tools/smoke.py`: `water` checks from recorded tiles, each failing before and passing after: a leg keeps clear of a recorded stone; MML failing, answering late and coming back; a leg too long; a tile outside MML's map.
- Saved routes and share links keep their format.

## Not in this part

- Stones under the surface (38511); weirs, dams and locks (#856); OSM's rapids; MML's tiles in offline saves.

## As built

- **Stones, stone fields and shoals,** as sections 1, 2 and 4 recommend, in [#1202](https://github.com/TommiContursi/Polku/pull/1202). The tiles are read by `decodeTile()` in `js/vectortile.js`, which the shadows' buildings now share.
- **Measured off Kotka** with live tiles: legs between the islands go 1–5 % farther than on `main`, with **Near the shore** and without. A straight leg over a recorded stone at the surface passes 27 m from it, where `main` passes 0 m (smoke's `water_mml`).
- **Grazes aren't items:** the first build gave a leg through Kotka's archipelago up to seven "Close to a marked rock or shoal" items of 2–6 m each, every one the edge of a zone. A rock's or shoal's event shorter than two cells is no longer an item, as for shallow water (#1187).
- **Not done:** rapids (the question in section 3); MML's tiles in offline saves.
