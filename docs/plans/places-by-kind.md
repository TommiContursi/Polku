# Places by kind (#121)

Part of [Say what it means](https://github.com/TommiContursi/Polku/milestone/2).
On a trip people look for water, toilets, shelter, food and help, and they
think of them by what they are, not by OpenStreetMap's keys. Today the map
has three switches for places (LIPAS's, OSM's outdoor places and Shops and
food), each hiding which kinds it holds and changing them with the sport;
search finds places by name only; and Check says nothing about the places
on the way. This plan puts every kind of place in one table, and the map,
Layers, search, the cards and Check all read it.

The idea comes from looking at how other mapping services decide about
places (#1275, items 1, 2 and 4): one catalogue of kinds, a first zoom and
a priority for each, and the details each kind's card shows. Polku learns
the logic and writes its own table from OpenStreetMap's tags and its wiki,
with its own groups, zooms and icons; nothing is taken from another app's
files (#1275's licence section).

The clickable mock-up is
[mockups/places-by-kind.html](mockups/places-by-kind.html).

## Choices

Each has one recommendation and what it costs. The user chooses; each
choice goes into #121's Decided list.

1. **Layers' Places: every kind its own switch, under its group's
   heading** (the mock-up's A). Places in the full Layers panel lists its
   groups (Help, Water and toilets, Food and shops, Sleep and shelter, Rest
   stops, Bike, On the water), each a small heading with its kinds as
   switches under it, and one **Back to Hike's places** at the foot when
   your choice differs from the sport's. The quick drawer gets a tile per
   group, which works as the Depths tile does: off turns the group's kinds
   off, on brings back the ones you had. *Cost:* medium; no new control.
   The full panel is long (24 switches), as All layers is meant to hold
   everything. *Instead* (B): a switch per group, with its kinds opening
   in place under it. Seven rows, but a group's switch that is on while
   only some of its kinds are is a new kind of control, proposed here
   rather than taken as given.
2. **Landmarks in the basemap, with no switch, in every sport.**
   Guideposts, information boards, springs, caves, tar kilns, bunkers,
   viewpoints and towers, sights and car parks are things you find your way
   by, like rocks and cliffs, so they're part of the map and listed in its
   Map key, not under a switch. Today most are behind **Outdoor places**,
   which Road and Run have off. *Cost:* small; Road and Run gain these
   marks from their zooms (guideposts from 15, car parks from 15.5).
   *Instead:* a Landmarks group under Places, with its switch per sport.
3. **Search by kind, near the map's middle or along the route.** Typing a
   kind ("water", "toilet", "hospital") lists the nearest places of that
   kind with their distance; with a route drawn, **Near the map · Along the
   route** chooses where. With the field empty, a row of chips searches the
   kinds people look for most with one tap. No search settings panel: what
   #121 asked of one is in these two. *Cost:* medium. *Instead:* a ⚙ in the
   search with what to search, where and how far.
4. **Check lists water, toilets and food shops on the way,** each with its
   distance along the route, in every land sport, and landing places and
   water on the water. It lists them whatever Layers shows, as Check is for
   reading before you go. *Cost:* medium. *Instead:* Check lists the kinds
   you have on in Layers, so one choice sets both.
5. **LIPAS's places become rows of the same kinds,** not a switch of their
   own: a lean-to is a lean-to whether LIPAS or OpenStreetMap has it, and
   where both have it within 80 m LIPAS's is shown (the rule `staysNear()`
   already has). **Huts & lean-tos** goes, and with it the kinds it hid per
   sport. *Cost:* medium; the stored choices move (see "What changes for
   saved settings"). *Instead:* LIPAS keeps its switch, beside the kinds.

The rest follows from #1222's and #1179's decisions, which go into the
table as rows rather than questions: shops and food from zoom 17 with their
names in purple and their defaults per sport (#1222); guideposts' own icon
from zoom 15, OSM's springs drawn above MML's, and a shelter with a fire
place keeping its own icon with its card saying so (#1179). One change to
#1222 goes with choice 1's groups: **pharmacies move from Shops and food to
Help**, where people look for them when something is wrong.

## Where it stands

- **Planned, 2026-11-21**, from #121, #1275's items 1, 2 and 4, the town's
  details plan (#1222) and the plan for MML's points beside OSM's (#1179).
- **The map's tiles checked** on 2026-11-21: OpenFreeMap's `poi` layer at
  Helsinki's centre and Nuuksio (zoom 14), to know what the map can fall
  back on beyond Polku's own data (the table's last column).
- **Waiting for #1179's points** (part 3 of the MML package under #1171,
  being built): the table's first part moves them in after it merges.

## The table

One table in `js/places.js`, one row per kind, in the order that decides a
feature's kind: each OpenStreetMap object takes the first row whose tags it
has, so the more particular kinds come first (a spring with
`drinking_water=yes` is a spring, and its card says the water is
drinkable). Everything that draws, lists, finds or describes a place reads
its row:

| Column | What it says | Read by |
|---|---|---|
| `id` | the kind's key (`water`, `lean-to`) | everything; stored choices |
| `name` | its words, singular and plural ("Drinking water", "Lean-tos and kotas") | Layers, cards, search, Check |
| `group` | its group, or `landmark` for the basemap | Layers, the quick drawer, search |
| `osm` | the tags that make an object this kind, from OSM's wiki | the OSM build, the map, the cards |
| `lipas`, `mml` | LIPAS's type codes and MML's classes that feed it | `js/lipas.js`, the map |
| `beyond` | OpenFreeMap's `poi` class to fall back on where Polku's own data doesn't reach, or none | the map, search |
| `icon` | its pictogram and the standard it starts from | the map, Layers' Map key, cards, search |
| `zoom` | its first zoom, and per sport where it matters | the map |
| `rank` | which keeps a crowded spot: 1 first | the map |
| `details` | the facts its card shows, and says "not mapped" where missing | cards |
| `on` | the sports that show it by default | Layers, the quick drawer |
| `words` | what someone types to find it, besides its name | search |
| `along` | whether Check lists it on the way, and in which sports | Check |

Zooms and ranks below are starting values: today's where a kind is drawn
now, the rest reasoned. The part that draws them checks each on Polku's
map at 390 × 844 and 1440 × 900 and changes what doesn't hold. The OSM
tags are each kind's usual ones from OpenStreetMap's wiki; the build part
counts what's mapped in the four countries before it settles them.

### The kinds

**Help** (a layer; red discs)

| Kind | OSM | Other sources | Zoom | Rank | Card | Beyond | Icon starts from |
|---|---|---|---|---|---|---|---|
| Hospital | `amenity=hospital` (`emergency=yes` says it has an emergency department) | | 12 | 1 | emergency, phone, opening hours | `hospital` | the road sign's H |
| Health centre | `amenity=clinic`, `amenity=doctors`, `healthcare=centre` | | 14 | 2 | opening hours, phone | `hospital` (clinic), `doctors` | a cross |
| Pharmacy | `amenity=pharmacy` | | 15 | 3 | opening hours | `pharmacy` | OSM standard style's |
| Defibrillator | `emergency=defibrillator` | | 15 | 1 | where it is (`defibrillator:location`), indoor, access, opening hours | none | ISO 7010's AED (E010) |
| Emergency access point | `highway=emergency_access_point` (with its `ref`) | | 14 | 2 | its reference, which the emergency number asks for | none | the sign on the ground, to check |
| Emergency phone | `emergency=phone` | | 15 | 2 | | none | ISO 7010's (E004) |

**Water and toilets** (a layer; blue discs)

| Kind | OSM | Other sources | Zoom | Rank | Card | Beyond | Icon starts from |
|---|---|---|---|---|---|---|---|
| Drinking water | `amenity=drinking_water`; `man_made=water_tap` or `water_well` with `drinking_water=yes` | | 14 | 2 | seasons, fee, opening hours | `drinking_water` | ISO 7001's drinking water |
| Water point | `amenity=water_point` | | 15 | 3 | seasons, fee | none | a tap and a can |
| Toilets | `amenity=toilets` | | 15.5 | 3 | fee, opening hours, wheelchair, disposal, seasons | `toilets` | ISO 7001's toilets |

**Food and shops** (a layer; names in purple, #1222)

| Kind | OSM | Zoom | Rank | Card | Beyond | Icon starts from |
|---|---|---|---|---|---|---|
| Groceries | `shop=supermarket`, `convenience`, `general`, `greengrocer`, `bakery` | 17 | 4 | opening hours | `grocery`, `bakery`, `shop` | a basket |
| Café | `amenity=cafe`, `amenity=ice_cream` | 17 | 5 | opening hours | `cafe`, `ice_cream` | a cup |
| Restaurant | `amenity=restaurant`, `amenity=fast_food` | 17 | 5 | opening hours, cuisine | `restaurant`, `fast_food` | a knife and fork |
| Pub and bar | `amenity=pub`, `amenity=bar` | 17 | 6 | opening hours | `beer`, `bar` | a glass |
| Fuel station | `amenity=fuel` | 16 | 5 | opening hours, toilets | `fuel` | a pump |
| Other shops | `shop=*` not above (#1222's clothes, alcohol, hairdresser, laundry) | 17 | 7 | opening hours | `shop`, `clothing_store`, `alcohol_shop`, `laundry` | a bag |

None upstairs or indoors (#1222's rule, so a shopping centre's shops don't
pile up on its roof). All of OpenFreeMap's ranks inside a kind stay as its
order where they crowd.

**Sleep and shelter** (a layer; brown and green discs, as LIPAS's)

| Kind | OSM | LIPAS | Zoom | Rank | Card | Beyond | Icon starts from |
|---|---|---|---|---|---|---|---|
| Wilderness hut | `tourism=wilderness_hut`, `alpine_hut` | 302 | 12 | 2 | fee, fire place, toilets, beds, booking | `lodging` (alpine hut) | Maastokartta's hut |
| Lean-to and kota | `amenity=shelter` with `shelter_type=lean_to` or `basic_hut` | 301 | 12 | 2 | fire place, toilets, drinking water | `shelter` | Maastokartta's laavu (today's `laavu`) |
| Campsite | `tourism=camp_site` | 202 | 13 | 3 | toilets, drinking water, fee | `campsite` | the road sign's tent |
| Outdoor lodge | | 304 | 13 | 3 | LIPAS's | | today's `hut` |
| Other shelter | `amenity=shelter` (picnic and weather shelters) | | 15 | 5 | shelter type, fire place | `shelter` | a roof |
| Hotel and hostel | `tourism=hotel`, `hostel`, `guest_house`, `motel`, `chalet` | | 16 | 6 | phone, website | `lodging` | a bed |

**Rest stops** (a layer)

| Kind | OSM | LIPAS | Zoom | Rank | Card | Beyond | Icon starts from |
|---|---|---|---|---|---|---|---|
| Fire place | `leisure=firepit`, `amenity=bbq` (standalone) | 206 | 13 | 3 | wood, seasons, fire warnings | `park` (bbq) | today's `lipas-fire` (#1179) |
| Picnic site | `tourism=picnic_site`, `leisure=picnic_table` | | 15 | 5 | fire place, toilets | `picnic_site` | a table |

**Bike** (a layer)

| Kind | OSM | Zoom | Rank | Card | Beyond | Icon starts from |
|---|---|---|---|---|---|---|
| Bike repair station | `amenity=bicycle_repair_station` | 15 | 3 | pump, tools, opening hours | none | a wrench |
| Bike shop | `shop=bicycle` | 15.5 | 4 | repair, rental, opening hours | `bicycle` | OSM standard style's bicycle |
| Air pump | `amenity=compressed_air`, `service:bicycle:pump=yes` | 16 | 4 | valves, fee | none | a pump |
| Bike rental | `amenity=bicycle_rental` | 15.5 | 5 | network, fee | `bicycle_rental` | a bicycle and a key |

**On the water** (a layer; blue discs)

| Kind | OSM | LIPAS | Zoom | Rank | Card | Beyond | Icon starts from |
|---|---|---|---|---|---|---|---|
| Landing place | `leisure=slipway`, `canoe=put_in` | 205 | 11 in Paddle, 14 | 2 | access, seasons | none | today's `landing` |
| Harbour | `leisure=marina`, `harbour=yes` | | 12 in Paddle, 14 | 3 | fuel, water, toilets, fee | `harbor` | INT 1's harbour (an anchor) |
| Boating service point | | 203 | 12 | 3 | LIPAS's | | today's `anchor` |
| Beach and swimming place | `leisure=swimming_area`, `leisure=bathing_place` | 3220, 3230 | 11 in Swim, 14 | 3 | water temperature from SYKE with its station and date (#121's note, 2026-10-18) | `swimming` | today's `swim` |

**Landmarks** (the basemap, no switch)

| Kind | OSM | Other sources | Zoom | Rank | Card | Beyond | Icon starts from |
|---|---|---|---|---|---|---|---|
| Guidepost | `tourism=information` with `information=guidepost` | | 15 | 3 | destinations where mapped | `information` (guidepost) | OSM standard style's (#1179) |
| Information board | `tourism=information` with `board` or `map`; visitor centres (`information=office`, `amenity=ranger_station`) | LIPAS 207 | 15.5, 13 for a visitor centre | 4 | operator, opening hours | `information` | ISO 7001's information (today's `info`) |
| Spring | `natural=spring` | MML 36100 | 15 | 4 | drinking water | none | Maastokartta's spring (#1179) |
| Viewpoint and tower | `tourism=viewpoint`; `man_made=tower` with `tower:type=observation` | LIPAS 204 | 13 | 3 | height, access | `attraction` (viewpoint) | today's `tower` |
| Cave entrance | `natural=cave_entrance` | | 15 | 5 | access | none | OSM standard style's arch (#1179) |
| Tar kiln | `historic=tar_kiln` | MML 45400 | 15 | 6 | | none | Maastokartta's tar pit (#1179) |
| Bunker | `military=bunker` | | 15 | 6 | access | none | #1179's |
| Sight | `tourism=attraction` | | 15.5 | 5 | website | `attraction` | today's |
| Car park | `amenity=parking` | MML 32421 | 15.5 named, 17 all (#1219) | 6 | fee, access, capacity | `parking` | today's P |

Peaks stay the basemap's labels (`label-peak`), as now. Shooting ranges
stay with **Military areas & shooting ranges** (a warning, not a place).

### Icons

Every kind is a white pictogram on a coloured disc with a white edge, as
LIPAS's places are drawn (`lipasIcon()` in `js/icons.js`, #1179's decision),
the disc's colour by group and the pictogram saying the kind, so nothing is
told by colour alone. Polku draws its own pictograms; each starts from a
standard, as #181's rule has it:

- **Help and the public services** (drinking water, toilets,
  information; the hospital's H and the campsite's tent from road signs):
  ISO 7001's public information symbols and ISO 7010's safety signs (the
  defibrillator's heart with a flash, the emergency phone), which people
  know from signs in Finland and abroad.
- **The terrain** (hut, laavu, spring, tar kiln): the Maastokartta's
  legend, as #1179 decided for its points.
- **The rest** (cave, guidepost, shops, café, bicycle): OSM's standard
  style's shapes, drawn again for Polku's disc.

### Priority and zoom on the map

Today each group of places is its own symbol layer, and LIPAS's points are
drawn even where they overlap (`icon-allow-overlap`). One order needs one
layer: every OSM and LIPAS place goes into one GeoJSON source (`places`),
drawn by one symbol layer whose `symbol-sort-key` is the kind's rank, so a
hospital keeps its spot over a café wherever they meet. LIPAS's points take
their place in that order rather than overlapping everything. A kind's
first zoom is a filter on the zoom; MapLibre evaluates the zoom in a filter
at whole zooms only, so a first zoom of 15.5 becomes 15 or 16 (the part
that draws it checks which reads better), or the layer is split in two at
that zoom with the same sort key. MML's springs and tar pits stay their own
layer under OSM's, so OSM's win where both have one (#1179). The same place
from LIPAS and OSM within 80 m shows once, LIPAS's (`staysNear()`'s rule).
Shops keep their purple names in the same layer, coloured by group.

### One home for the table

The app reads `js/places.js` directly. The OSM build is Python
(`tools/osm_data/builder.py`), so it reads the kinds' tags from
`tools/osm_data/place-kinds.json`, written from the table by a small node
script, and a test in the build's tests (beside `client.test.mjs`) fails
when the JSON and the table differ, so neither can drift from the other.

## The data

**OpenStreetMap from Polku's own build,** as the OSM data plan has it for
#121 ([osm-data-inventory.md](osm-data-inventory.md)): the `places`
product (zoom 12) holds only places to stay today (`is_stay()`), and the
`inspection` product (zoom 14) keeps objects with `amenity`, `tourism`,
`leisure`, `natural`, `barrier`, `ford`, `man_made` or `historic`, which
leaves out `shop`, `emergency`, `healthcare` and `military`. The table's
second part makes `places` hold every OSM kind of the table (nodes, ways
and relations as their centres, with their tags), in Finland, Sweden,
Norway and Estonia. #1179's part adds a small product for its points; the
second part folds those into `places` or builds on that product, whichever
is simpler once it has merged. The weekly build publishes it from `main`
on its own (docs/OSM_DATA.md); the app reads the new kinds only from a
manifest that says it has them, and until then draws what OpenFreeMap's
tiles have, as today.

**Beyond the four countries,** the map falls back on OpenFreeMap's `poi`
layer, which covers the world but has fixed classes and only at zoom 14
and closer: the table's `beyond` column. Checked at Helsinki's centre and
Nuuksio on 2026-11-21, it has hospitals and clinics, pharmacies, drinking
water, toilets, shelters, campsites, lodging, guideposts and boards,
viewpoints, picnic sites, barbecues, fuel, bicycle shops and rentals,
harbours, swimming areas and every shop and café; it has no
defibrillators, emergency access points, springs, caves, tar kilns,
bunkers, water points, repair stations or pumps. Where a kind has no
fallback, Layers says the kind isn't shown there in words, as it says of
the Finnish layers today (`AREA`, #1200), and filing a wider build goes on
#176. Search falls back on Photon's tag filter (`osm_tag`, which covers
the world) and Check says where it couldn't look.

**LIPAS** stays Finland's official source for its kinds, in Finland only,
read as now (`js/lipas.js`), each type feeding its kind's row.

**Missing data never looks complete:** a tile that failed or hasn't loaded
leaves its kinds unknown there, never empty. The map's message already
says when the OSM source fails; search and Check say "not checked" for the
stretch they couldn't read, with a retry, as Check does for its other
sources.

## Layers and the quick drawer

- **Places in the full panel** (choice 1, the mock-up's A): its groups as
  small headings (`menu-h`'s look, as `lg-title`), each kind a `tg` switch
  with its pictogram, the group's count in `lg-count` ("3 on"), **Map
  key** listing the landmarks drawn in the basemap, and **Back to Hike's
  places** (`btn small quiet`) when the switches differ from the sport's.
  A kind outside its data's area says so in words beside its name, as the
  Finnish layers do.
- **The quick drawer:** a tile per group (`places:water`, `places:help`…)
  in `QUICK_TILE`, behaving as Depths does: off turns the group's kinds off
  and remembers them, on brings them back (the sport's defaults the first
  time); its › shows the group's switches. `QUICK_PLACES`' per-sport names
  go, as the kinds are now in sight. Each sport's default tiles change
  where `lipasPoints` or `pois` were one (Hike's Places becomes Sleep and
  shelter, Paddle's becomes On the water, Run's becomes Water and toilets).
- **Defaults per sport:** the table's `on` column, replacing `pois`,
  `lipasPoints` and `shops` in `ACTIVITY_OVERLAYS` and the LIPAS point
  types in `ACTIVITIES`. Starting values: Help and Water and toilets on in
  every sport; Sleep and shelter in MTB, Gravel, Hike, Trail running,
  Paddle and Swim; Rest stops in MTB, Gravel, Hike and Trail running; Food
  and shops in Road, Gravel, Run and Hike (#1222); Bike in MTB, Gravel and
  Road; On the water in Paddle and Swim.

## Search

- **A kind's name or its words** ("water", "drinking", "toilet", "WC",
  "hospital", "AED", "shop", "laavu") give a group of results above
  Photon's names: the nearest places of that kind, five at most, each with
  its name (or the kind's when it has none) and its distance; a tap opens
  its card as a place found by name does.
- **Where:** near the map's middle, within 10 km, from the `places`
  tiles around it (zoom 12, as `staysNear()` reads `osmStays()`); with a
  route drawn, **Near the map · Along the route** (`seg small`) switches to
  places within 500 m of the route, in order along it with their distance
  from the start.
- **The kinds row:** with the field empty, under Recent, chips for Water,
  Toilets, Food, Shelter and Help search their kind at once (`chip`, in a
  row that scrolls sideways where it doesn't fit).
- **Position:** reading Polku's own tiles sends only which tiles (as the
  map does); beyond them, Photon's search gets the map's middle rounded to
  about a kilometre, PRODUCT.md's rule for nearby search, as search does
  today.
- **Words:** each row's `words` in English, the app's language; the
  Finnish ones that people type anyway ("laavu", "kota", "wc") too.

## The cards

A place's card takes its kind's name as its line, its pictogram as its
mark, and its row's `details` as what it shows, saying "not mapped" for a
detail its kind would have once OpenStreetMap's tags are in. This replaces
`PLACE_WANTS` in `js/facts.js`, so a spring never says its opening hours
are unknown and a toilet always says whether it costs. LIPAS's cards keep
LIPAS's facts. Opening hours when you get there (#859) builds on this row.

## Check: places on the way

A group in Check, **On the way** (choice 4): drinking water, toilets and
groceries within 300 m of the route on land, and landing places, harbours
and drinking water on the water, each a row with its distance from the
start and, where the route has times, when you'd reach it; a tap opens its
card. The kinds are the table's `along`. Where the `places` tiles failed or
the route goes beyond Polku's own data, Check says which stretch it
couldn't read ("Not checked"), never that there's no water. Long gaps
between water are worth saying too ("No drinking water mapped for 34 km");
the part that builds it decides with the user, from a mock-up of Check's
group.

## What changes for saved settings

The stored per-sport choices `pois`, `lipasPoints` and `shops` become the
kinds' own (`place:<id>`), read once from the old ones: `shops` on turns
Food and shops' kinds on, `lipasPoints` on turns on the LIPAS kinds that
sport had, and `pois` on turns on Rest stops and Water and toilets. The old
keys are then dropped (clarity over compatibility: one reader, no second
format). Share links carry no layers, so they don't change. The quick
drawer's edited tiles (`quickTiles`) swap `lipasPoints` and `pois` for the
matching group tiles. The parts that change them update their readers,
writers and smoke checks together.

## Every place it reaches

`PLACE_LAYERS` in `js/planner.js`, `INSPECTABLE` in `js/inspect.js` and
`inspectLayers()` in `js/hover.js` (the one `places` layer in place of
`poi-outdoor`, `poi-minor`, `poi-shops` and `lipas-point`), `LAYER_GROUPS`,
`counted()` and On now in `js/main.js`, `QUICK_TILE`, `QUICK_TILES`,
`QUICK_PLACES` and `ACTIVITY_OVERLAYS` in `js/config.js`, `staysNear()`
in `js/stops.js` (its OSM half reads the same tiles), `placeGroups()` in
`js/facts.js`, the place-layer lists in `tools/smoke.py`, and README,
USING, DEVELOPING and CHANGELOG.

## Building it

Each part is its own pull request from `main`, in
[Say what it means](https://github.com/TommiContursi/Polku/milestone/2),
and each closes nothing but the last, which fixes #121. Model and effort
as AGENTS.md has them.

1. **The table, with today's kinds** (after #1179's points merge, and
   clear of #1290's files or after it): `js/places.js` with every kind the
   map draws today, #1179's and #1222's included, and the map, its cards'
   `PLACE_WANTS`, `PLACE_LAYERS`, `INSPECTABLE` and the LIPAS point types
   read from it. Nothing changes on the screen; the smoke groups `layers`,
   `cards` and `quick` show it. *Strongest model, high.*
2. **The data:** the `places` product holds every OSM kind in the table,
   with the JSON and its drift test, built and published by the weekly
   build (or a manual run of it), and the app's reader. *Strongest model,
   high* (saved data's source, the build).
3. **Layers and the map:** the groups and switches of choice 1, the one
   `places` layer with its ranks and zooms, landmarks in the basemap
   (choice 2), LIPAS in the kinds (choice 5), the fallback beyond the four
   countries, the stored choices moved, the quick drawer's tiles. Checked
   beside the mock-up at 390 × 844 and 1440 × 900. *Strongest model,
   high.*
4. **The cards:** each kind's details from its row. *Strongest model,
   medium* (small, one module).
5. **Search by kind** (choice 3): the kinds' words, near the map and along
   the route, the kinds row, Photon's tag filter beyond. *Strongest model,
   high.*
6. **Check's On the way** (choice 4), from a mock-up of Check's group
   first. *Strongest model, high.*

## Not checked

- How many of each kind are mapped in the four countries (the build part
  counts them, and a kind with almost none waits).
- Whether one layer with every place holds its frame rate in a town at
  zoom 17 on a phone (Helsinki's centre had 1,092 restaurants in nine tiles
  at zoom 14).
- Photon's `osm_tag` filter's answers outside the four countries, and its
  terms for such use.
- Whether the zoom filter's whole-zoom limit is still MapLibre 5.24's.
