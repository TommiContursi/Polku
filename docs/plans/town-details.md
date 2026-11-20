# The town's details (#181)

Part of [Map style](https://github.com/TommiContursi/Polku/milestone/5).
Polku is for moving through towns too: riding to the shop, exploring a
city on foot, finding the way out to the trails. #181's Decided list
(2026-11-20) names the town's details: one-way arrows, parking areas, shop
names and bridges, with steps already done (#1181). Codex's list adds small
green spaces and the density of marks. This plan says what the map's tiles
carry for each, how each would look, whether it belongs in the basemap or
in a layer of its own, how it works beyond Finland, and from which zoom it
shows. Nothing is built yet.

## Choices

Each has one recommendation and what it costs. The screenshots show the
recommendations together, drawn on a sketch that is never merged.

1. **One-way arrows** ([#1217](https://github.com/TommiContursi/Polku/issues/1217)): a small grey arrow along one-way
   streets from zoom 16, everywhere. The tiles can't say whether bikes may
   ride both ways, so the arrow is for traffic; a way's card already says
   whether bikes may (from Polku's own OSM data). *Cost:* small, one
   layer and one icon. *Instead:* arrows from Polku's own way data,
   with a different mark where bikes may ride both ways. That is a new
   loader, and it covers only Finland, Sweden, Norway and Estonia.
2. **Bridges and tunnels** ([#1218](https://github.com/TommiContursi/Polku/issues/1218)): a dark edge on bridges (roads
   from zoom 14, paths from 15), bridge decks drawn as areas, and footways
   and paths in tunnels at half strength as cycle paths already are.
   *Cost:* small. *Instead:* bridges' edges on roads only.
3. **Car parks** ([#1219](https://github.com/TommiContursi/Polku/issues/1219)): in Finland, MML's public car parks as light
   grey areas from zoom 14 with a P from 15; OSM's P marks thinned to the
   named ones from 15.5 and the rest from 17. Car park areas beyond Finland
   are filed as [#1216](https://github.com/TommiContursi/Polku/issues/1216), from Polku's own OSM data. *Cost:* small.
   *Instead:* MML's orange, as on the Maastokartta, which reads as a main road
   in Polku's colours.
4. **Parks and small green spaces** ([#1220](https://github.com/TommiContursi/Polku/issues/1220)): the town's land use
   drawn under the land cover, so the parks and lawns it hides show; parks
   and gardens in a clearer green; parks' names from zoom 15. *Cost:*
   small, but the land use's new place touches every town on every vector
   map (the shots at zooms 12, 13 and 15 show how little changes in Finnish
   suburbs). *Instead:* the clearer green and the names only, leaving the
   parks hidden in Tallinn's and Stockholm's districts.
5. **Fewer marks in a town** ([#1221](https://github.com/TommiContursi/Polku/issues/1221)): gates from zoom 16, giving way to
   each other and to names until 17. On a phone in Helsinki's centre, 165
   marks at zoom 15 become 40. *Cost:* small. *Instead:* gates from zoom 17
   (none at 16), or from 16 drawn even where they overlap (39 at 16).
6. **Shops and food** ([#1222](https://github.com/TommiContursi/Polku/issues/1222)): a layer of its own under Layers ›
   Places, icons and names from zoom 17, the first of #121's places by
   kind. *Cost:* medium: a new switch, its defaults per sport, and the
   docs. **Which sports have it on** is part of the choice; the
   recommendation is on in Road, Gravel, Run and Hike, off in MTB, Trail
   running, Paddle and Swim.
7. **House numbers** ([#1223](https://github.com/TommiContursi/Polku/issues/1223)), not in #181's list: small and quiet from
   zoom 17. *Cost:* small, one label layer. *Instead:* leave them out.

The order to build them is at the end.

## Where it stands

- **Planned, 2026-11-21.** Tiles checked at Helsinki's, Tampere's and
  Jyväskylä's centres, Stockholm's Gamla stan and Tallinn's centre (nine
  zoom-14 tiles each, one zoom-13 and one zoom-12 tile), and MML's tiles at
  the three Finnish ones.
- **Drawn** on the branch `claude/town-details-sketch` (at 91505ae3,
  from `main` at 1e8f70b4), which is never a pull request. Each part is
  built from `main` in its own issue.
- **Found while planning:** [#1224](https://github.com/TommiContursi/Polku/issues/1224), protected areas' names are hard to
  read on the Night map (2.7:1).

## What the tiles carry

OpenFreeMap's planet tiles (`20261115`), zooms 12 to 14; nothing is in
tiles beyond 14, so the map draws zoom 15 and up from zoom 14's tiles.
"Nine tiles" is the 3 × 3 block of zoom-14 tiles around each centre, about
3.7 × 3.7 km at Helsinki.

| Detail | In OpenFreeMap's tiles | In MML's tiles (Finland) | Kind of gap |
|---|---|---|---|
| One-way | `transportation.oneway` on roads from zoom 12, on paths at 14; 952 to 3,085 one-way pieces in the nine tiles; every one 1 (no −1 seen); no `oneway:bicycle` | `liikenne.yksisuuntaisuus` 1 or 2, from zoom 13; no bike exception either | style; bike exceptions missing from both |
| Bridges and tunnels | `brunnel` on roads from zoom 12, on paths at 14; bridge decks as `transportation` polygons of class `bridge`, 16 to 59 in the nine tiles | `tasosijainti` (1 and 2 bridge, −11 tunnel) | style |
| Car parks | no areas; `poi` points of class `parking` at zoom 14 only: 904, 1,663, 1,228, 424 and 3,266 in the nine tiles, 0.3 to 32 % named; no `parking=street_side`, access or fee | areas of class 32421 (motor traffic area) in `liikenne` from zoom 13: 41, 28 and 58 in the nine tiles; median 2,342 m², largest 33,100 m² | geometry missing beyond Finland |
| Shops and food | `poi` at zoom 14 only (zooms 12 and 13 hold only stations and ferry terminals): 270 to 2,110 shops and 184 to 1,782 restaurants in the nine tiles; over 90 % named; `rank`, `level`, `indoor` | named places (`nimisto`), no shops | style |
| Parks and green spaces | `landcover` class `grass` (park, garden, grass, flowerbed, village green…) at zoom 14; at 13 only the large ones; city parks' names as `poi` class `park` (127 to 396, 45 to 80 % named); the `park` layer holds only protected areas | parks (32900, updates ended 04/2025) | style; land use hides some |
| House numbers | `housenumber` at zoom 14: 561 to 2,339 in the nine tiles | addresses as ranges on road lines | style |

Polku's own OSM data (`tools/osm_data/builder.py`) has no car parks: its
products are trails, hazards, places, inspection, winter and wetlands.

## The parts

### One-way arrows

[#1217](https://github.com/TommiContursi/Polku/issues/1217). **What people get:** which way a street goes, before
riding into it, in towns everywhere.

- **The look.** OSM's standard map draws a thin arrow along the road from
  zoom 16, every 180 px, in a grey darkened from the road's edge, and in
  the cycle paths' blue on one-way cycle paths. MML's Maastokartta has no
  one-way mark. Polku's: a 14 × 8 px arrow with a stem and a head, every
  200 px, `#6b6458` on the Trail map (5.9:1 on a white street, 4.2:1 on a
  main road's yellow) and `#aaa498` on the Night map (4.3:1 on its
  streets); `#1f2fa0` on one-way cycle paths. Names win where the two
  overlap.
- **Shapes already in use.** The route's chevrons are white with a dark
  edge and have no stem; the uphill arrows are double chevrons. The water's
  flow arrow (#1170) has the same shape: both mean "this way along the
  line", one blue on a river, the other grey on a road.
- **Not on parking aisles or driveways:** the sketch showed a car park's
  lanes full of arrows.
- **For traffic only.** The tiles have no `oneway:bicycle`, and
  Helsinki's one-way streets often let bikes ride both ways. The arrow
  doesn't say bikes can't; a way's card says whether they can
  ("One way for cars, both ways for bikes", `js/facts.js`). This goes into
  DEVELOPING's Known limits.
- **Basemap.** It's how the street works, like its name.
- **Beyond Finland:** the same, from the same tiles.

### Bridges and tunnels

[#1218](https://github.com/TommiContursi/Polku/issues/1218). **What people get:** a bridge reads as a bridge, over water and
over a road or a railway, and an underpass reads as one.

- **Today.** A road on a bridge looks the same as one on the ground, and
  only the water under it tells. Roads in tunnels have a dashed edge at
  half strength, and cycle paths in tunnels are at half strength, but
  footways and paths in tunnels are drawn at full strength.
- **The look.** OSM's standard map draws a black edge on bridges (roads
  from zoom 13 or 14, paths from 14 or 15, over their white band) and a
  grey dashed edge on tunnels, their fill lighter. MML's Maastokartta draws
  the bridge's stretch of road black, and a tunnel as dashed edges. Polku's:
  the road's edge turns `#2c2721` on a bridge from zoom 14 (`#c9c2b5` on
  the Night map); paths, footways, cycle paths and tracks on a bridge get
  the same edge about 1 px wide each side of their band from zoom 15;
  bridge decks mapped as areas in the ground's colour with that edge from
  zoom 15. Tunnels: footways, steps and paths at half strength, as cycle
  paths.
- **Basemap.** Physical, and part of the road.
- **Beyond Finland:** the same, from the same tiles (Stockholm's bridges
  are in the screenshots).

### Car parks

[#1219](https://github.com/TommiContursi/Polku/issues/1219), and [#1216](https://github.com/TommiContursi/Polku/issues/1216) beyond Finland. **What people get:** where to
leave a car at a trailhead or a shop, and what the open asphalt between
the buildings is.

- **Today.** A car park is drawn as whatever land use is around it. With
  **Outdoor places** on, every OSM car park point gets a P from zoom 15.5:
  about 35 on a desktop screen in Tampere's centre at zoom 16, and in
  Helsinki many are kerbside spaces the tiles can't tell apart.
- **The data.** OpenFreeMap has only points. MML's class 32421 is a motor
  traffic area: public car parks of 1,000 m² and more, in built-up areas
  private ones of a hectare and more, and rest and loading areas outside
  towns. In the tiles from zoom 13.
- **The look.** OSM's standard map: a light grey area with a darker edge
  from zoom 14 or 15, and a blue P from 14 for large car parks and from 17
  for all. MML's Maastokartta: an orange area, which in Polku's colours
  reads as a main road, so OSM's grey wins. Polku's: `#dcdcd8` with a
  `#9a9488` edge on the Trail map (`#25282d` and `#454a52` on the Night
  map) from zoom 14; the grey is close to the town's ground (1.2:1), so the
  edge and the P carry it.
- **P marks.** A P on each of MML's areas from zoom 15, placed before OSM's
  P marks, so OSM's P on the same car park gives way; OSM's named P marks
  from 15.5 and the rest from 17.
- **Basemap or layer.** The area in the basemap: it's ground. The P marks
  stay with **Outdoor places**, where they are today.
- **Beyond Finland.** P marks only, from OSM's points. Car park areas
  beyond Finland need OSM's areas from Polku's own OSM data, as reedbeds
  were added: [#1216](https://github.com/TommiContursi/Polku/issues/1216).

### Parks and small green spaces

[#1220](https://github.com/TommiContursi/Polku/issues/1220). **What people get:** a town's parks and lawns, and their names,
for finding the way and a place to stop.

- **Today.** The town's land use (residential, commercial, retail,
  industrial, cemeteries) is drawn over the land cover. Of 10,779 green
  areas in the 45 zoom-14 tiles, over 1,200 lie inside a land-use area
  and are hidden. In Tallinn and Stockholm, districts are mapped as land
  use (282 and 266 green areas inside them), so whole parks are missing:
  Toompea at zoom 15. In
  Finland, mostly lawns inside commercial areas. Parks, gardens and lawns
  are one pale green, the same luminance as the town's ground (1.05:1). City
  parks have no names.
- **The look.** OSM's standard map draws parks a light green (lighter than
  its lawns and gardens), and names them in dark green italic from zoom 17,
  large ones earlier. MML's Maastokartta draws parks green and sports
  areas a pale yellow-green. Polku's: parks, gardens, village greens and
  recreation grounds `#d3ebbf` on the Trail map and `#1e3524` on the Night
  map, under the forest, so a wooded park keeps its trees; lawns keep
  today's green; pitches and playgrounds stay over the land cover. Names
  from zoom 15 in the protected areas' green italic (5.0:1 on the park).
- **The land use's new place** shows little in Finnish suburbs at zooms 12,
  13 and 15 (the Jyväskylä and Pakila shots) and a lot in Tallinn's and Stockholm's
  centres.
- **Basemap.** Ground and its names.
- **Beyond Finland:** the same, and that's where it matters most.

### Shops and food

[#1222](https://github.com/TommiContursi/Polku/issues/1222). **What people get:** the shop, café or bakery on the way, and
names to find a corner by.

- **The look.** OSM's standard map draws shops' icons in purple from zoom
  17 (supermarkets and department stores from 16) and their names in
  purple. MML's Maastokartta has no shops. Polku's: the map's own icons
  (OpenFreeMap's sprite, as **Outdoor places** uses), names in purple
  (`#7a2e8a` on the Trail map, 8.1:1 on its halo; `#d6b8e6` on the Night
  map), from zoom 17. The tiles' `rank` decides which come first where they
  crowd. None upstairs (`level` 1 and up) or `indoor`: a shopping centre's
  shops would pile up on its roof.
- **Kinds.** Shops, supermarkets, clothes shops, off-licences, bakeries,
  restaurants, cafés, fast food, bars, pubs, ice cream, pharmacies,
  hairdressers and launderettes: what the tiles call `shop`, `grocery`,
  `clothing_store`, `alcohol_shop`, `bakery`, `restaurant`, `cafe`,
  `fast_food`, `bar`, `beer`, `ice_cream`, `pharmacy`, `hairdresser` and
  `laundry`.
- **A layer of its own.** Shops aren't ground, and a trail map has no use
  for them. #121 plans places by kind, each with a switch (Food, Help,
  Water and toilets); this is its first, **Shops and food** under Layers ›
  Places, so #121 starts from it.
- **Beyond Finland:** the same, from the same tiles.

### Fewer marks in a town

[#1221](https://github.com/TommiContursi/Polku/issues/1221). **What people get:** a town map at zoom 15 that shows the
streets, not a layer of gate marks.

- **Today.** The trail details draw every gate from zoom 15, even where
  they overlap. In a town most are courtyard gates on the pavements: on a
  phone in Helsinki's centre at zoom 15, 130 of the 165 marks.
- **The change.** Gates (open and closed) from zoom 16, giving way to each
  other and to names until 17, then all of them. Fallen trees, stiles, cycle
  barriers and fords stay from zoom 15. A closed gate on a route still gets
  its Heads-up item.
- **Beyond Finland:** the same (Tallinn's centre had 63 gates on a phone at
  zoom 15).

### House numbers

[#1223](https://github.com/TommiContursi/Polku/issues/1223). Not in #181's list; the idea of 2026-10-31 on #181 lists
house numbers among what helps finding the way in a town. From zoom 17,
10 px, `#7d7468` on the Trail map and `#9aa1a9` on the Night map, giving
way to every other name. Basemap, everywhere.

## Zooms and density

What each part adds, by the map's zoom:

| Zoom | Added | Taken away |
|---|---|---|
| 14 | MML's car park areas (Finland); bridges' edges on roads | |
| 15 | P on MML's car parks (Finland); paths' bridge edges and bridge decks; parks' names | gates (to 16) |
| 15.5 | OSM's named P marks (as now, but only named ones) | OSM's unnamed P marks (to 17) |
| 16 | one-way arrows; gates, giving way to each other and to names | |
| 17 | every gate; every P; shops and food; house numbers | |

Marks on a phone (390 × 844, MTB, Trail map), counted with MapLibre's
placed symbols on `main` (1e8f70b4) and the sketch (91505ae3):

| Place | Zoom 15 | Zoom 16 | Zoom 17 |
|---|---|---|---|
| Helsinki's centre | 165 → 40 (gates 130 → 0, park names +5) | 61 → 49 (gates 39 → 15, arrows +10, park names +2) | 10 → 49 (house numbers +18, shops +15, arrows +6) |
| Tampere's centre | 52 → 42 (gates 17 → 0, park names +10) | 26 → 31 (park names +6, arrows +3) | 5 → 14 |
| Tallinn's centre | 119 → 63 (gates 63 → 0, park names +10) | 63 → 60 (arrows +14, gates 21 → 13, unnamed P marks 15 → 0) | 19 → 55 (shops +16, house numbers +11, arrows +7) |

Zoom 17 fills up again in a busy street, with shops on: the screenshots
show whether it still reads.

## Screenshots

Map only, before (`main` at 1e8f70b4) and after (the sketch at 91505ae3),
MTB, with the sport's own layers on. On the `pr-screenshots` branch under
`claude/town-details-plan/`.

| Scene | Trail, 1440 × 900 | Night, 1440 × 900 | Trail, 390 × 844 | Night, 390 × 844 |
|---|---|---|---|---|
| Helsinki's centre, zoom 16 | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-hki-desktop.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-hki-desktop.jpg?raw=true) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-hki-night-desktop.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-hki-night-desktop.jpg?raw=true) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-hki-phone.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-hki-phone.jpg?raw=true) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-hki-night-phone.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-hki-night-phone.jpg?raw=true) |
| Helsinki's centre, zoom 17 | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-hki17-desktop.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-hki17-desktop.jpg?raw=true) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-hki17-night-desktop.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-hki17-night-desktop.jpg?raw=true) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-hki17-phone.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-hki17-phone.jpg?raw=true) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-hki17-night-phone.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-hki17-night-phone.jpg?raw=true) |
| Helsinki's centre, zoom 15 (gates) | | | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-hki15-phone.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-hki15-phone.jpg?raw=true) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-hki15-night-phone.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-hki15-night-phone.jpg?raw=true) |
| Tampere, Hämeensilta, zoom 16 (bridges, parks) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-tre-desktop.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-tre-desktop.jpg?raw=true) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-tre-night-desktop.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-tre-night-desktop.jpg?raw=true) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-tre-phone.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-tre-phone.jpg?raw=true) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-tre-night-phone.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-tre-night-phone.jpg?raw=true) |
| Tampere, Ratina, zoom 16 (car parks) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-treP-desktop.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-treP-desktop.jpg?raw=true) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-treP-night-desktop.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-treP-night-desktop.jpg?raw=true) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-treP-phone.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-treP-phone.jpg?raw=true) | |
| Tampere, the station's underpasses, zoom 17 (tunnels) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-tun-desktop.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-tun-desktop.jpg?raw=true) | | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-tun-phone.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-tun-phone.jpg?raw=true) | |
| Stockholm, Gamla stan, zoom 16 (bridges) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-sth-desktop.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-sth-desktop.jpg?raw=true) | | | |
| Stockholm, Vasastan, zoom 15 (parks) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-sthpark-desktop.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-sthpark-desktop.jpg?raw=true) | | | |
| Tallinn, Toompea, zoom 15 (parks, gates) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-tlnpark-desktop.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-tlnpark-desktop.jpg?raw=true) | | | |
| Tallinn's centre, zoom 17 (shops, arrows) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-tln17-desktop.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-tln17-desktop.jpg?raw=true) | | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-tln17-phone.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-tln17-phone.jpg?raw=true) | |
| Jyväskylä, zoom 12 (the town and its forests) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-kort12-desktop.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-kort12-desktop.jpg?raw=true) | | | |
| Helsinki, Pakila, zoom 13 (a suburb) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-pak13-desktop.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-pak13-desktop.jpg?raw=true) | | | |
| Jyväskylä, Kortepohja, zoom 15 (a suburb) | [before](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/before-kort15-desktop.jpg?raw=true), [after](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/town-details-plan/after-kort15-desktop.jpg?raw=true) | | | |

## Not checked

- High contrast, the Plain map, the aerial photos and the Maastokartta
  bases; Paddle and the other sports beyond MTB.
- A real phone outdoors; the browser pane was hidden, so every view here
  was drawn in headless Chrome.
- 3D, and taps and hover on the new layers (the sketch doesn't add them to
  `PLACE_LAYERS` or `INSPECTABLE`, so it can't be tapped).
- Whether the tiles' one-way pieces are ever −1: none of the about 9,600
  seen at zoom 14 were.
- Car parks at a trailhead outside a town.

## Building it

Each part is its own pull request from `main`, in
[Map style](https://github.com/TommiContursi/Polku/milestone/5), on the
strongest model at high effort. The parts that touch the same code go one
after another in one session:

1. **The roads:** fewer marks ([#1221](https://github.com/TommiContursi/Polku/issues/1221)), then bridges and tunnels
   ([#1218](https://github.com/TommiContursi/Polku/issues/1218)), then one-way arrows ([#1217](https://github.com/TommiContursi/Polku/issues/1217)). All in `addRoads()`; fewer
   marks first, as it gives the most for the least.
2. **The ground:** parks ([#1220](https://github.com/TommiContursi/Polku/issues/1220)), then car parks ([#1219](https://github.com/TommiContursi/Polku/issues/1219)). Both in
   the land fills; car parks' P marks also in the places.
3. **The places:** shops and food ([#1222](https://github.com/TommiContursi/Polku/issues/1222)), then house numbers
   ([#1223](https://github.com/TommiContursi/Polku/issues/1223)).
4. **Later:** car parks beyond Finland ([#1216](https://github.com/TommiContursi/Polku/issues/1216)), with Polku's own OSM
   data's next build.

Every part reaches the places that name its layers: `PLACE_LAYERS` in
`js/planner.js`, `INSPECTABLE` in `js/inspect.js` (with a row for each MML
class in the cards, #1175), `inspectLayers()` in `js/hover.js`, and the layer
lists in `tools/smoke.py`. Each adds a smoke check in `layers` and runs that
group, with `changelog` for its release notes.
