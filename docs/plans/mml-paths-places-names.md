# MML's paths, places and names beside OpenStreetMap's (#1171, #1173, #1174, #1179)

Part of [Map style](https://github.com/TommiContursi/Polku/milestone/5) (#181).
Four parts would add what the National Land Survey's (MML) background map
has and the map doesn't draw yet: paths and winter roads
([#1171](https://github.com/TommiContursi/Polku/issues/1171)), fire places,
springs and monuments ([#1173](https://github.com/TommiContursi/Polku/issues/1173)),
place names ([#1174](https://github.com/TommiContursi/Polku/issues/1174)),
and OpenStreetMap's guideposts, springs and caves
([#1179](https://github.com/TommiContursi/Polku/issues/1179)). Unlike the
bogs and rock, these are lines, points and names: one can't simply cover the
other, so where both sources have the same path, fire place or name, the map
would draw it twice. This plan measures how often that happens, weighs the
ways to avoid it, and asks seven questions, each with one recommendation.

## Where it stands

- **Plan, 2026-11-21.**
- **Built, part 1: guideposts and winter roads.** Guideposts are
  `poi-guidepost` from zoom 15 with a brown disc and a post with two signs,
  the first row of `PLACE_KINDS` (`js/config.js`), the list part 3's kinds
  join and the catalogue of place kinds (#121) takes over. MML's winter roads
  are `mml-winter-road` in **Winter ways**, in the look of OSM's winter-only
  ways, only while it's winter, on the vector bases (the Maastokartta draws its
  own), under LIPAS's routes. Their card says what they're for and that Polku
  can't see whether the ice holds.
- **Decided, 2026-11-21: the points are icons** in the map's style for
  places, not dots (on #1173 and #1179): [the look](#question-4-which-points).
- **Decided, 2026-11-21: all seven recommendations below,** on the Decided
  lists of [#1171](https://github.com/TommiContursi/Polku/issues/1171),
  [#1173](https://github.com/TommiContursi/Polku/issues/1173),
  [#1174](https://github.com/TommiContursi/Polku/issues/1174),
  [#1179](https://github.com/TommiContursi/Polku/issues/1179), and the order
  on [#181](https://github.com/TommiContursi/Polku/issues/181).

- **Built, part 2: names, first stage.** `mml-name` draws MML's names of
  the terrain areas (forests, bogs, fields, meadows, boulder fields), capes,
  isthmuses, shores, hollows, lost dwelling places, other terrain places, and
  in the water stones, shoals and rapids, by `lajikoodi` (read from MML's
  geographic names API, 2026-11-21). Big stones on land and named trees
  (`Maaston yksityiskohdat`, 1030105 and 1030110) weren't in the decided
  kinds and are left out.

## The questions

| # | Question | Recommended | Cost |
|---|---|---|---|
| 1 | MML's winter roads (#1171) | In the **Winter ways** layer, in the look OSM's winter-only ways already have, only while it's winter, with a note on the ice | Style layers and a card's words; no new data |
| 2 | MML's paths, forest tracks and drives where OSM has none (#1171) | The app's own distance test: only MML's pieces with no OSM way within 15 m, from zoom 14 | A new module of about 200 lines, no new requests |
| 3 | Where those paths are drawn (#1171) | In the basemap, in every sport, in a look of their own that isn't OSM's, with a card that says routes don't follow them | Part of question 2 |
| 4 | Points (#1173, #1179) | OSM's fire places, springs, caves and bunkers from Polku's own OSM data; MML's springs and tar pits in Finland under them; guideposts with an icon of their own (all of them icons, decided); MML's fire places, water holes, monuments, ancient monuments and protected areas left out | A new product in Polku's OSM data, then style layers |
| 5 | Which kinds of MML's names (#1174) | First the kinds OpenFreeMap's tiles don't name (bogs, forests, capes, fields…); lakes, islands, hills and bays later, with a test by name | Style layers; the later stage a small module |
| 6 | The names' language (#1174) | Finnish, else Swedish; a Sámi name on a second line where MML has one | Part of question 5 |
| 7 | The order | Guideposts and winter roads; names; the OSM points; the paths | Four PRs or more, each on its own |

Map-only screenshots, with MML's features added in loud study colours
(not a proposed look, except the winter roads), at 390 × 844 and 1440 × 900:
[Screenshots](#screenshots).

## How it was measured

On 2026-11-21, at eight places: four parks, **Nuuksio** (60.300, 24.540),
**Seitseminen** (61.937, 23.425), **Koli** (63.096, 29.807) and **Pallas**
(68.050, 24.070), and four everyday places, forests near **Keuruu**
(62.243, 24.645), **Ylöjärvi** (61.650, 23.350) and **Suomussalmi**
(64.900, 29.300), and **Sodankylä**'s village with the forest around it
(67.400, 26.600). Each is a block of 5 × 5 zoom-14 tiles, 20–35 km². The
names were also read at **Kuhmo** (64.160, 29.360), **Nauvo** (60.190,
21.910) and **Inari** (68.906, 27.030), for the Swedish and Sámi names.

- **MML:** the background map's vector tiles (`taustakartta` v21) with
  Polku's key, zooms 11–14, named from MML's
  [vector tile schema](https://www.maanmittauslaitos.fi/sites/maanmittauslaitos.fi/files/attachments/2023/07/vektoritiilien_skeema_202307.pdf)
  and its feature catalogue, *Maastotietokohteet 2025*.
- **OSM on the map:** OpenFreeMap's tiles (the 2026-11-15 build), as the
  map draws them.
- **OSM in full:** Polku's own OSM data (release
  `20261118T212102Z-four-74e26e2ba549880b`), the `inspection` product for
  points and `winter` for the winter-only ways. Overpass didn't answer from
  this machine on the day.
- **LIPAS:** its WFS, for campfire sites, lean-tos and snowmobile routes.
- **Overlap:** a point every 5 m along MML's line, and its distance to the
  nearest OSM way of any kind (paths, tracks and roads; not railways,
  ferries or lifts), 60 m in from the block's edge.

## 1. Paths, forest tracks and winter roads (#1171)

### What the tiles carry

MML's classes in `liikenne`, from zoom 13: path (polku, 12313), forest track
(ajopolku, 12316), winter road (talvitie, 12312), and footway and cycleway
(12314). In the catalogue's words (translated): a path is a narrow trodden
track, clearly visible in summer; a forest track is a way mainly for
tractors and other off-road vehicles; a winter road is a cleared track,
usually wider than 2 m, driven in winter by off-road vehicles and
snowmobiles, and marked snowmobile routes over 2 m wide count as winter
roads too.

Footways and the numbered roads are in OSM already (98–100 % within 15 m).
The smallest roads, drives (ajotie, 12141: private and forest roads), mostly
are, but not everywhere: 64 % of Sodankylä's 28.4 km and 62 % of
Suomussalmi's 14.4 km have an OSM way within 15 m (9.4 and 5.2 km of pieces
missing), and 90–100 % at the other places. So drives join question 2.

| Place | MML's paths | with OSM within 15 m | MML's forest tracks | with OSM within 15 m | OSM's paths | with MML within 15 m |
|---|---|---|---|---|---|---|
| Nuuksio | 87.4 km | 93 % | 20.9 km | 93 % | 128.2 km | 74 % |
| Seitseminen | 36.6 km | 85 % | 9.7 km | 88 % | 31.8 km | 91 % |
| Koli | 38.9 km | 83 % | 19.6 km | 89 % | 32.9 km | 94 % |
| Pallas | 23.9 km | 89 % | 3.2 km | 100 % | 29.5 km | 90 % |
| Keuruu forest | 31.8 km | 80 % | 29.6 km | 85 % | 42.5 km | 72 % |
| Ylöjärvi forest | 12.4 km | 23 % | 34.8 km | 68 % | 3.8 km | 35 % |
| Suomussalmi forest | 0.7 km | 4 % | 7.7 km | 5 % | none | |
| Sodankylä | 9.6 km | 52 % | 16.7 km | 68 % | 18.3 km | 96 % |

- **In the parks, OSM already has nearly all of MML's paths,** and more of
  its own: Nuuksio has 128 km of OSM path against MML's 87. The two lines
  lie on each other, likely because OSM's mappers have drawn from MML's maps
  (not checked): the median gap is 0.8–2.0 m and nine in ten are within
  3.4–7.3 m. On Polku's map
  (2.4 m a pixel at zoom 14 at Nuuksio, 0.6 m at 16, 0.15 m at 18), a
  1.6 m gap is under a pixel at 14, about 3 pixels at 16 and 11 at 18: two
  lines side by side from about zoom 16.
- **In everyday forests OSM has much less.** At Ylöjärvi, 9.3 km of MML's
  12.4 km of path and 10.7 km of its forest tracks have no OSM way within
  15 m; at Suomussalmi, 7.1 km of 7.7 km of forest track. MML's pieces of
  50 m or more with no OSM way within 15 m, path plus forest track: Nuuksio
  6.0 km, Seitseminen 6.2, Koli 8.3, Pallas 2.3, Keuruu 9.5, Ylöjärvi 20.0,
  Suomussalmi 7.7, Sodankylä 9.3.
- **By whole pieces** (one MML line in one tile), most are either all in
  OSM or not in it at all: in the four parks 78–87 % of the paths' length is
  in pieces wholly in OSM, 1–11 % in pieces wholly missing, and 5–13 % in
  pieces partly in it. At Keuruu 15 % and at Sodankylä 23 % of the path
  length is partly in it. So a rule that keeps or drops whole pieces would leave stubs and gaps;
  cutting each piece where OSM's way begins (below, way C) doesn't.

**Winter roads are almost all MML's alone.** Within 15 m of an OSM way:
Koli 8 % of 10.9 km, Pallas 24 % of 12.2 km, Suomussalmi 14 % of 11.7 km;
at Sodankylä 74 % of 18.1 km, where they run along OSM's paths. OSM's
`seasonal=winter`, the tag Polku's **Winter ways** draws as "There only in
winter (over ice or bog)", is on one way in the zoom-12 tile around each of
the eight places.
LIPAS's snowmobile routes run along 36 % of Sodankylä's winter roads and
none of the others. **At Koli, 58 % of the winter roads' length is over the
ice of Pielinen;** at Pallas, Suomussalmi and Sodankylä 30–48 % crosses bogs.

### Ways to avoid drawing a path twice

| Way | How | Code | Data | On a phone | What it gives |
|---|---|---|---|---|---|
| A. MML's in Finland instead of OSM's | OSM's paths hidden inside Finland's outline (MapLibre 5.24 can't test polygons that way, #1147, but these are lines) | A filter | None | Nothing | Loses OSM's extra paths, their MTB grades and trail details, the ways routes follow, and every path when MML's tiles don't load. Not recommended |
| B. All of MML's, fainter, under OSM's | Two style layers | Small | None | Nothing | A second line beside most paths in the parks from about zoom 16 ([Nuuksio](#screenshots)) |
| **C. The app's own distance test** (recommended) | A module reads MML's and OSM's ways from the tiles already loaded (`querySourceFeatures`), cuts MML's lines where an OSM way is within 15 m, keeps the pieces of 50 m or more, and draws them as a GeoJSON source | About 200 lines, and a smoke check with a recorded MML tile and an OpenFreeMap tile of the same place | No new requests | A few thousand distance tests a tile, once per tile (not measured on a phone) | Only the paths OSM lacks, from zoom 14. At 13, OpenFreeMap's tiles hold few paths (#1128: 21 against 94 in the zoom-14 tiles), so a test there would call most of MML's paths missing; there it could use Polku's own trail data (every path and track from 13, #1150), where Trail details is on |
| D. Matching in Polku's own data build | The OSM build compares MML's ways with OSM's and publishes the pieces OSM lacks as a product, drawn like the reedbeds | The build, its tests and publication; MML's data in the build first: #1155's archive from Kapsi's 22.8 GB GeoPackage. MML's own tiles for the whole country would be some 300,000 requests a build, against MML's terms for heavy use | A product a month | The least | The cleanest from zoom 13, but only after #1155, which waits |
| E. Only the classes OSM lacks | Winter roads, as question 1 | Style layers | None | Nothing | Winter roads only |

A style alone can't compare two sources' features: MapLibre's `distance`
measures against one fixed geometry written into the style, not against
another layer's features (not checked further).

### Question 1: winter roads

A winter road is a track for snowmobiles and off-road vehicles. Polku
already has two looks for winter's ways: OSM's `seasonal=winter` ways, cyan
dots in **Winter ways** with the words "There only in winter (over ice or
bog)", and LIPAS's snowmobile routes, an orange line in LIPAS's routes, both
drawn only while it's winter.

**Recommended: in the Winter ways layer, in the look of OSM's winter-only
ways, only while it's winter.** MML's winter roads are that kind of way: a
track that is there only in winter. Most of them aren't marked snowmobile
routes (LIPAS has one along 36 % of Sodankylä's and none at the other
places), so the snowmobile route's look would claim too much; where LIPAS
has a route on one, its orange line is drawn over it, as now. In summer a
winter road over a bog isn't a way at all, so it isn't drawn then. Its card
says, in words to settle: "Winter road, for snowmobiles and off-road
vehicles. There only in winter." and, as Koli's go over a lake's ice: "Over
the ice it's open only when its keeper says so. Polku can't see whether the
ice holds: check the ice yourself." The cost: two style layers in the Winter
ways group, from zoom 13, and the card's rows (#1175). The alternatives: the
snowmobile route's look, all year round in the basemap (a summer route would
seem to cross a bog or a lake), or left out.

**Beyond Finland:** OSM's winter-only ways, which the Winter ways layer
already draws, are the fallback and share the look.

### Question 2: paths and forest tracks where OSM has none

**Recommended: way C, from zoom 14,** for paths, forest tracks and drives.
It draws only what OSM lacks, so the
parks look as they do now ([Nuuksio, only the missing
pieces](#screenshots)), and the everyday forests gain what was missing
([Ylöjärvi](#screenshots)). It needs no new service, request or data, and
its work is a few thousand distances per tile. From zoom 13 can come later,
against Polku's trail data. Way D is the clean long-term home if #1155's
archive is built for other reasons; until then it costs the most. Way B is
the cheap alternative, at the cost of doubled lines in every park.

### Question 3: where they're drawn, and routing

Polku's routes follow OSM's ways only: a path that's only on MML's map is
never followed, and the router goes round it. That mustn't look like a
mistake. **Recommended: in the basemap, in every sport, in a look that isn't
OSM's, with a card that says so.**

- **The look:** the Maastokartta draws paths and forest tracks as thin black
  dashed lines, forest tracks with longer dashes. MML's pieces get those
  dashes in the paths' colour, without the halo OSM's paths have (the MTB
  grade's colour, or the plain band), so they don't read as an OSM path
  with no grade. Not by colour alone: the dashes and the missing band say
  it.
- **Its card** (with #1175's rows) says, in words to settle: "Path on the
  National Land Survey's map. Not in OpenStreetMap, so routes don't follow
  it: draw this stretch with Freehand." It also says MML surveys most
  terrain every 5–10 years, so a path may have grown over. **Not right?**
  opens OpenStreetMap's editor there: adding the path to OSM is what makes a
  route follow it.
- **The alternative:** a layer of its own under Layers, off by default. It
  keeps the basemap as it is, but most people would never see the paths.

**Beyond Finland:** no source the map uses has more paths than OSM beyond
Finland, so this part is Finland only. The wider version, the national
topographic data of Sweden (Lantmäteriet), Norway (Kartverket) and Estonia
(Maa-amet) where OSM has none, is filed as an issue once this is chosen
(their paths and licences not checked here).

## 2. Points: fire places, springs, guideposts, caves (#1173, #1179)

### What the tiles carry

In the eight blocks (MML's tiles at zoom 14; OSM from Polku's own data; the
catalogue's words translated):

| Kind | MML | OSM | Near each other | On the map today |
|---|---|---|---|---|
| Fire place | 25 (45710: a permitted fire place in a hiking area or a similar area in public use) | 26 standalone (`leisure=firepit`, `amenity=bbq`), and 19 shelters or picnic sites with `fireplace=yes` | Of MML's 25: 11 within 15 m of a standalone OSM fire place (13 within 60 m), 9 within 15 m of a shelter with one (13 within 60 m), 22 within 60 m of either | **No standalone ones:** OpenFreeMap's tiles carry no firepits at these places, so `poi-outdoor`'s firepit filter matches nothing. The shelters and picnic sites are drawn, without saying they have a fire place. LIPAS's campfire sites (2) and lean-tos (9), in its layer |
| Spring | 32 (36100: clearly visible, gives water all year round) | 12, one with `drinking_water=yes` | 11 of OSM's 12 within 15 m of an MML one, at the same spots | None: not in OpenFreeMap's tiles |
| Water hole | 77 (36400: a small area always under water, 100–1000 m², not part of the waters): a pond, not a well | | None near an OSM spring or well | None |
| Tar pit | 9 here, 37 in all the tiles read (45400: a pit for tar, charcoal or lime) | 1 | | None |
| Monument | 7 | 7 | 5 within 15 m | None (OpenFreeMap has them; no layer draws them) |
| Ancient monument | 5 (72330, the catalogue's point class for an ancient monument) | | None near | None |
| Guidepost | | 55 | | **From zoom 15.5, with the information icon** of boards and maps (`poi-minor`, checked at Nuuksio at 16.5) |
| Cave entrance | | 5 (Nuuksio) | | None: not in OpenFreeMap's tiles |
| Bunker | | Not measured (Polku's `inspection` product doesn't keep `military`) | | None |
| Protected area | 72202 national park, 72201 strict nature reserve, 72200 nature reserve (not 62200, as #1173 says: that's a restricted area) | OpenFreeMap's `park` | MML's areas outside OSM's: 0–1 % of each block | OSM's, from `park` |

### Ways to avoid an icon twice

Points are simpler than lines: the map's label collision already hides an
icon that would overlap one placed before it. A layer drawn above is placed
first, so OSM's points above MML's win where both have one. The springs'
pairs are within 15 m (11 of 11): about 25 pixels at zoom 16, close enough
for two icons to collide up to about zoom 16; from 17 a pair 15 m apart can
show as two icons.

| Way | For points | Cost |
|---|---|---|
| One source wins in Finland | MML's springs only, OSM's hidden inside Finland's outline | A filter. Loses OSM's drinking water and every spring where MML's tiles don't load |
| **Collision** (recommended to start) | OSM's above MML's, with the same icon | None beyond the layers. Pairs show as two icons from about zoom 17 |
| The app's own test | An MML point with an OSM one of its kind within 30 m isn't drawn | A small module, as way C. Only if doubles show from 17 |
| Matching in the build | As way D | Needs #1155 |

### Question 4: which points

**Recommended:**

- **OSM's fire places, springs, caves and bunkers from Polku's own OSM
  data,** a small product beside the reedbeds (#1154), for Finland, Sweden,
  Norway and Estonia: `leisure=firepit`, `amenity=bbq`, `fireplace=yes`,
  `natural=spring` with `drinking_water`, `natural=cave_entrance`,
  `military=bunker` and `historic=tar_kiln`. The fire icon is drawn for the
  standalone fire places only; a shelter or picnic site with
  `fireplace=yes` keeps its own icon, and its card says it has a fire place,
  so nothing is marked twice. The standalone fire places are the biggest
  gain here: as many as MML's (26 against 25), and the map draws none today.
- **MML's springs and tar pits in Finland, under OSM's,** with the same icons.
  MML has three times OSM's springs, and the tar pits are landmarks in the
  forest that only MML has. OSM's are drawn above, so where both have a
  spring, OSM's (with its drinking water, when it says) is the one shown.
- **Guideposts get an icon of their own** from zoom 15, from OpenFreeMap's
  tiles, everywhere: a junction's signpost isn't an information board.
- **Left out:** MML's fire places (only 3 of 25 have no OSM fire place or
  shelter with one within 60 m, and OSM's come with this part), water holes (small ponds, not water
  to drink), monuments and ancient monuments (7 and 5 here; for later if
  wanted, with the Finnish Heritage Agency's register for the ancient ones),
  and MML's protected areas (OSM's already cover them).

**The look** (decided 2026-11-21, on #1173 and #1179): every point is an
icon, as the map's other places are, never a dot or a bare mark: a white
pictogram on a coloured disc with a white edge, as LIPAS's places are drawn
(`lipasIcon()` and its `GLYPHS` in `js/icons.js`). A fire place uses the
campfire icon the map already has (`lipas-fire`, which OSM's firepits would
use today too). A spring, a tar pit, a guidepost, a cave entrance and a
bunker get pictograms of their own, their shapes from the standards (#181's
rule): the Maastokartta's spring and tar pit, and OSM's standard style's
guidepost (a post with two signs) and cave entrance (an arch), as neither
the Maastokartta nor ISOM has a guidepost. Each kind has its disc's colour
(a spring's in the water's blue), and the pictogram, not the colour, says
what it is. All in the basemap with the outdoor points (`poi-outdoor`), from
zoom 15 (fire places with the outdoor points, from 13), and LIPAS's places
above them all, as now. The rings and dots in the screenshots are study
colours only.

**Beyond Finland:** OSM's points come from Polku's own data in all four
countries. Beyond them the map draws none, as with the reedbeds (a known
limit). MML's springs and tar pits stay Finland only, with OSM's around them.

## 3. Place names (#1174)

### What the tiles carry

MML's `nimisto` layer: one point a name, with its kind (`lajikoodi`, `laji`),
`nimi_fin`, `nimi_swe`, `nimi_sme`, `nimi_smn`, `nimi_sms`, and the scale it
belongs to (`mittakaavarelevanssi`), so the tiles bring each name in from
the zoom MML chose, 11 to 14. The catalogue: the names the 1:25,000 map
prints, checked by the Institute for the Languages of Finland (Finnish and
Swedish) and the University of Oulu (Sámi); a place with several names has
them all.

At seven places (the four parks, Kuhmo, Nauvo, Inari), the share of MML's
names that OpenFreeMap's tiles also have, the same name within 2 km in any
of their layers:

| Kind | MML's names | Also in OpenFreeMap's tiles |
|---|---|---|
| Villages and hamlets | 41 | 93 % |
| Parts of towns | 21 | 86 % |
| Towns, municipalities, national parks, churches | 12 | 92 % |
| Lakes | 178 | 62 % |
| Islands and groups of islands | 128 | 45 % |
| Parts of lakes, sea bays and straits | 95 | 39 % |
| Streams | 26 | 46 % |
| Hills and groups of hills | 104 | 40 % |
| Houses (farms' names) | 232 | 19 % |
| Capes | 76 | 8 % |
| Fields | 31 | 6 % |
| Bogs | 65 | 2 % |
| Forests | 57 | 0 % |
| Hollows, meadows, isthmuses, shores, stones and shoals in water, lost dwelling places, other terrain places | 41 | 0 % |

So OpenFreeMap's tiles name the settlements and most lakes, and almost
none of the terrain: no bogs or forests, and 8 % of the capes (OSM itself
has some more, on areas the tiles don't name). Where both have a name,
it's close by: lakes 44 m apart at the median (77 % within 100 m), islands
39 m, hills 75 m, villages 181 m. At zoom 13 (4.7 m a pixel) 100 m is
21 pixels, so the labels collide and only one shows; from about 15 both
show ([Seitseminen](#screenshots)).

### Question 5: which kinds

**Recommended, in two stages:**

1. **First the kinds OpenFreeMap's tiles don't name:** bogs, forests,
   capes, isthmuses, shores, hollows, fields, meadows, scrub, boulder
   fields, stones and shoals in water, rapids, lost dwelling places and
   other terrain places. They overlap almost nowhere (0–8 %), so a style
   does it: one layer, Finland only, no test. Settlements, municipalities,
   parks and churches stay OSM's.
2. **Later, if wanted, lakes, islands, hills, bays and houses** with a test
   by name: the app hides an MML name when OpenFreeMap's loaded tiles have
   the same name within 1 km. The names would be on a source of their own
   (the same tiles from the browser's cache, as `ofmTrails` is), so a
   changed filter lays out only them. A small module (about 60 lines). Left
   to collision alone, they'd show twice from about zoom 15.

| Way | For names | Cost |
|---|---|---|
| **By kind** (recommended, stage 1) | MML's names only of the kinds OpenFreeMap's tiles don't name | A style layer. No doubles, as the kinds hardly overlap |
| Collision alone | Every kind, OSM's placed first | A style layer. Lakes, islands and hills twice from about zoom 15 |
| **A test by name** (stage 2) | Lakes, islands, hills, bays and houses only where OpenFreeMap's tiles lack the name within 1 km | About 60 lines, a source of its own |
| One source wins in Finland | MML's names for everything, OSM's place and water labels hidden inside Finland | A filter. No names at all where MML's tiles don't load, and peaks without OSM's heights |
| Matching in the build | | Needs MML's names in the build, #1155 |

### Question 6: the language

Polku's labels use OSM's `name`, the place's own language. MML's tiles don't
say which language is the place's own, but its terrain names are seldom in
two: at Nauvo none of 73 terrain names has both a Finnish and a Swedish name
(72 are Swedish only), at Nuuksio 3 of 37. At Inari 8 of 13 terrain names
have a Sámi name too (Inari Sámi on 28 of all 77 names there, Northern Sámi
on 3, Skolt Sámi on 2).

**Recommended:** the Finnish name, else the Swedish one, and a Sámi name on
a second line where MML has one, as MML's own maps print every name of a
place. Where MML gives two spellings in one name ("Käldöfjärden eller Käldö
fjärden"), only the first shows: 34 of Nauvo's 344 names have two, and they
make long labels ([Nauvo](#screenshots)); Nuuksio has one, Koli none. The
alternative: one name only, Sámi names left out. A bilingual village would read wrongly with
Finnish first ("Nauvo" where the place says Nagu, [Nauvo](#screenshots)), but
under question 5 the villages stay OSM's.

**The look:** the Maastokartta prints terrain names in black italic and
water names in blue. In Polku's palette: terrain names in the map's text
colour, italic, 11–12 px by MML's `prioriteetti`; rapids and other water
names in the water's text colour, italic, as Polku's lake names are. In the
basemap with the other names, placed after OSM's, so OSM's win a collision.

**Beyond Finland:** OSM has names of bogs, capes and hills (on
`natural=wetland`, `natural=cape`, `place=locality`), but OpenFreeMap's tiles
don't carry them, so the map has no source for them outside Finland today.
The wider version, those names from Polku's own OSM data in all four
countries, is filed as an issue once this is chosen.

## 4. The order (question 7)

Recommended, each its own PR in Map style, the strongest model at high:

1. **Guideposts' icon and the winter roads:** styles only, small.
2. **Names, first stage.**
3. **OSM's points in Polku's own OSM data,** published, then the map's
   points: OSM's fire places, springs, caves and bunkers, MML's springs and
   tar pits.
4. **Paths with the distance test,** from zoom 14.

Each part follows the earlier MML parts: what it adds joins the cards
(#1175's `INSPECTABLE` and rows), it says nothing new when MML's tiles fail
(the map's message already does), nothing of it is in offline areas (#1176),
and it has a smoke check with a recorded MML tile.

## Screenshots

Map-only, MTB, with the trail map; the study colours are drawn by a script
over `main` 1e8f70b4 and are not a proposed look, except the winter roads'.
The study's names are placed before the map's own labels, so where one of
today's labels is missing, the study's took its place: the plan places
MML's names after OSM's. Nuuksio is at zoom 14, where pieces OSM lacks are
in view; at 15.2 there were none.

| | 1440 × 900 | 390 × 844 |
|---|---|---|
| Nuuksio, all of MML's paths and forest tracks (magenta) | [1440](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/mml-paths-places-names/paths-nuuksio-all-1440.jpg?raw=true) | [390](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/mml-paths-places-names/paths-nuuksio-all-390.jpg?raw=true) |
| Nuuksio, only the pieces OSM lacks (way C) | [1440](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/mml-paths-places-names/paths-nuuksio-only-1440.jpg?raw=true) | [390](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/mml-paths-places-names/paths-nuuksio-only-390.jpg?raw=true) |
| Ylöjärvi forest, all of MML's | [1440](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/mml-paths-places-names/paths-ylojarvi-all-1440.jpg?raw=true) | [390](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/mml-paths-places-names/paths-ylojarvi-all-390.jpg?raw=true) |
| Ylöjärvi forest, only the pieces OSM lacks | [1440](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/mml-paths-places-names/paths-ylojarvi-only-1440.jpg?raw=true) | [390](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/mml-paths-places-names/paths-ylojarvi-only-390.jpg?raw=true) |
| Koli, winter roads over Pielinen's ice, in the look of question 1 | [1440](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/mml-paths-places-names/winter-koli-1440.jpg?raw=true) | [390](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/mml-paths-places-names/winter-koli-390.jpg?raw=true) |
| Koli, MML's fire places and springs (rings) and OSM's (dots) | [1440](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/mml-paths-places-names/points-koli-1440.jpg?raw=true) | [390](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/mml-paths-places-names/points-koli-390.jpg?raw=true) |
| Seitseminen, MML's names by kind | [1440](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/mml-paths-places-names/names-seitseminen-1440.jpg?raw=true) | [390](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/mml-paths-places-names/names-seitseminen-390.jpg?raw=true) |
| Nauvo, MML's names by kind (Swedish) | [1440](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/mml-paths-places-names/names-nauvo-1440.jpg?raw=true) | [390](https://github.com/TommiContursi/Polku/blob/pr-screenshots/claude/mml-paths-places-names/names-nauvo-390.jpg?raw=true) |

## Not checked

- How fast way C's test runs on a real phone, and whether MML's paths that
  OSM lacks still exist on the ground (MML's survey is 5–10 years old in
  places; OSM's mappers may have left some out on purpose).
- MapLibre's `distance` against another layer's lines or points, and
  `within` for points.
- That OSM's springs, drawn above MML's, win the collision in practice: the
  placement order was read from MapLibre's rules, not tried.
- Bunkers (not in the product read), and Overpass's live data (it didn't
  answer on the day).
- Swedish, Norwegian and Estonian topographic data for the wider versions.
- Names at places other than the seven, and how dense MML's terrain names
  are at zoom 11–12 in Lapland.
