# The National Land Survey's open data on the map (#181)

Part of [Map style](https://github.com/TommiContursi/Polku/milestone/5):
terrain is [#1147](https://github.com/TommiContursi/Polku/issues/1147), property
boundaries [#1148](https://github.com/TommiContursi/Polku/issues/1148). In
Finland, the map gains terrain from the National Land Survey's (MML)
topographic database (Maastotietokanta): bogs by class first, then rock,
boulders, cliffs, reeds and power lines. Property boundaries
(kiinteistörajat) become a layer of their own that you can turn on and off.
Outside Finland the map stays as it is, on OpenFreeMap's tiles and OSM.

## Where it stands

- **Researched, 2026-11-19.** Services, access, licence, coverage and CORS
  were checked, and a vector-tile archive was built from two real map sheets
  (below).
- **Decided, 2026-11-20: MML's own vector tiles first, with Polku's API
  key in the app** (on #1147 and #1148), kept out of plain sight in the
  source; a person's own key from Settings is used instead when they have
  one. Polku's own archive, decided earlier the same day, is kept for later
  in [#1155](https://github.com/TommiContursi/Polku/issues/1155).
- **Built, 2026-11-20:** property boundaries and their plots (#1157,
  #1159), bogs (#1160), rock, cliffs, reeds and power lines (#1168),
  the water's marks and lake depths (#1186), heath, open forest land and open
  ground (#1169), and a tap on the terrain (#1175).
  What was built is in [Drawing](#drawing) and [Parts](#parts); the
  decisions made while building are in the "Decided" lists of
  [#1147](https://github.com/TommiContursi/Polku/issues/1147), [#1170](https://github.com/TommiContursi/Polku/issues/1170),
  [#1148](https://github.com/TommiContursi/Polku/issues/1148) and
  [#1169](https://github.com/TommiContursi/Polku/issues/1169). More of MML's
  classes are filed as their own issues ([Parts](#parts)).

## What people get

- **Bogs where they are.** Around Seitseminen (61.937, 23.425) at zoom 13,
  Polku draws OSM's wetlands, one generic pattern over a few areas, while
  other mapping services show bogs on most of the ground around the
  trails. The two map sheets
  there (about 300 km²) hold 1,766 bog areas and 1,079 areas of
  paludified land (soistuma) in MML's data.
- **What a bog is like to cross:** open or wooded, and easier or harder to
  cross, as MML's surveyors classed it.
- **Rock and stone:** 6,354 rock areas and rock symbols, 1 boulder field,
  107 sparse-boulder points and 549 stones in those two sheets.
- **Cliffs** (252 in the two sheets), **reeds** (36 points) and
  **overgrowing water** (8 areas).
- **Power lines** (98 line pieces; pylons of high-voltage lines where there are
  any), landmarks people steer by in the forest.
- **Property boundaries,** from zoom 14, for knowing whose land you're on
  (for example, where everyman's rights end and a yard begins).

## The data

MML's open data is CC BY 4.0. Attribution names MML, the dataset and its
date ("© Maanmittauslaitos, Maastotietokanta 11/2026"). Coverage is Finland
only. The classes come from MML's feature catalogue,
[Maastotietokohteet 2025](https://www.maanmittauslaitos.fi/sites/maanmittauslaitos.fi/files/attachments/2025/11/Maastotietokohteet_2025_ulkoinen.pdf):

| Class | Code | Geometry | Note |
| --- | --- | --- | --- |
| Bog, open, easier to cross | 35411 | area | Bogs are 1,000 m² or more; drained bogs included |
| Bog, wooded, easier to cross | 35412 | area | |
| Bog, open, hard to cross | 35421 | area | |
| Bog, wooded, hard to cross | 35422 | area | |
| Paludified land (soistuma) | 35300 | area | |
| Overgrowing water (maatuva vesialue) | 38300 | area | |
| Reeds (kaislikko) | 38100 | point | A symbol, not the reeds' extent |
| Rock area (kallioalue) | 34100 | area and point | |
| Boulder field (kivikko) | 34700 | area | |
| Sparse boulders (harva louhikko) | 34200 | point | |
| Stone (kivi) | 34600 | point | |
| Cliff (jyrkänne) | 34400 | line | Drawn with its direction |
| Rock fissure (kalliohalkeama) | 34500 | line | |
| Power line, 110 kV and more | 22311 | line | |
| Power line, 20–110 kV | 22312 | line | |
| High-voltage pylon | 22392 | point | |

MML has no scrub class. Its nearest are dwarf-shrub heath (varvikko, 39120)
and open forest land (avoin metsämaa, 39110, mostly clear-cuts), drawn with
meadows, open shore land, fields, sand and the forest symbols by #1169: its
classes and zooms are in DEVELOPING.

"Easier" and "hard to cross" are MML's survey classes, not a promise about
today's ground: the map's words say so, and nothing about passability is
read from them. Most terrain other than roads and names is re-surveyed from
aerial photos every 5–10 years.

MML is replacing this database with its new national one (KMTK); the
map-oriented product, Karttatieto, is due in 2027, and MML recommends the
current database for maps until then
([timetable](https://www.maanmittauslaitos.fi/kartat-ja-paikkatieto/aineistot-ja-rajapinnat/maastotiedot-ja-niiden-hankinta/maastotiedot)).
The tile URL names its version (`v21`), so a new schema comes as a new
version, not as a quietly emptied map.

## Delivery

Checked 2026-11-19 from this machine, with `Origin: https://polku.si`:

| Way | Access | What it gives | Checked |
| --- | --- | --- | --- |
| MML's vector tiles (`avoin-karttakuva…/vectortiles`) | API key | MML's own tile schema, styled by Polku | 401 without a key; CORS allows polku.si. With a key: see below |
| MML's property tiles (`kiinteisto-avoin/v3`) | API key | Property boundaries and property IDs as vector tiles | 401 without a key; CORS allows polku.si |
| MML's OGC API Features | API key | GeoJSON by area | 401 without a key; no CORS header on the refusal |
| Kapsi's mirror, downloads | none | The whole topographic database as one GeoPackage (`mtkmaasto.zip`, 22.8 GB, dated 2026-11-04), and the property map as vector files per map sheet (updated 2026-11-16) | Listed and sized; two terrain sheets downloaded |
| Kapsi's mirror, property WMS | none | Property boundaries as PNG, from about 1:25,000 (zoom 14), property IDs near 1:3,000 | 200, `Access-Control-Allow-Origin: *`, 0.2–8 s a tile |

MML's API keys are free, but each needs an account. A key in a static site
is public, and MML's open terms leave its protection to the key's owner,
exclude high-volume use and allow restrictions. Kapsi is run by
volunteers and documents outages; Polku already leaves its rasters out of
offline areas.

### Kept for later: Polku's own archive, built from Kapsi's downloads ([#1155](https://github.com/TommiContursi/Polku/issues/1155))

A monthly job on GitHub's runner downloads the GeoPackage, keeps only the
classes above, writes them as vector tiles into one PMTiles archive with
GDAL, and publishes it next to the OSM data on the existing host
(`ducksoft.fi/polku-osm/`, today 12.5 GB a week, published by the OSM data
workflow). The app reads it with the PMTiles library it already vendors
(`js/vendor/pmtiles-4.5.0.js`), through a MapLibre protocol, as
`js/shadows.js` and `js/winter.js` already add theirs. The property
boundaries come the same way, from Kapsi's per-sheet vector files.

- **For people:** no account or key, and Polku decides what's drawn, in
  its own colours and at its own zooms.
- **To build:** a new workflow job, GDAL as a build-only tool (nothing new
  in the app: the spike used the GDAL inside `pyogrio`'s pinned pip wheel,
  as the OSM build pins its Python tools), and a manifest with the dataset's date for the
  attribution. Data changes need a release, as the OSM data does.
- **Measured on two sheets (N4112L and N4112R, Seitseminen):** GDAL 3.10
  read the shapefiles in ETRS-TM35FIN and wrote a single-layer archive,
  10,250 features, zooms 10–14: 2.07 MB in 7.7 s. The largest tile is 131 KB
  at zoom 10, 37 KB at zoom 12 and 5.9 KB at zoom 14. One zoom-14 tile,
  decoded, holds the class codes as numbers (34100, 35300, 35412); GDAL's
  own read-back showed the field empty, so the codes in the other tiles
  weren't checked.
- **The input:** `mtkmaasto.zip` holds one file, `mtkmaasto.gpkg`,
  deflated, 52.4 GB unpacked (its zip directory, read with range requests,
  2026-11-20). The OSM builds' runners had 85 GB free, so the job streams
  the download into the unpacked file rather than keeping the zip as well.
- **Not measured:** the whole country's size and largest tile (scaling the
  two sheets by area gives about 2 GB; Lapland's large bogs may differ),
  the runner's time and disk for the 22.8 GB input, and the per-sheet
  property files.

### Chosen: MML's own tiles with Polku's key

One key, from an account, written into the app. Least code: a vector source
and its layers, no build job. Costs: the key is public (MML's key
instructions mention no way to limit a key to one site), every visitor's
tiles count against it, and availability and volume are on MML's terms.
Settings already takes a person's own key for MML's raster maps; tying the
bogs to that would give most people no bogs at all.

**Checked with a key, 2026-11-20** (background map `taustakartta`, v20 and
v21):

- Zooms 0–14, so the map overzooms from 15 on, as with OpenFreeMap. Tile
  URL `…/vectortiles/taustakartta/wmts/1.0.0/taustakartta/default/v21/WGS84_Pseudo-Mercator/{z}/{y}/{x}.pbf`.
- **At zoom 14 its classes match the database.** In five zoom-14 tiles at
  Seitseminen, compared with the same tiles built from the map sheets:
  bogs of each class, paludified land, overgrowing water, reeds (as
  points), rock, stones, sparse boulders and cliffs, nearly feature for
  feature (cliffs 5 of 5 and 16 of 17, sparse boulders 21 of 21). Power
  lines (22312) matched in one tile and were missing in two where the
  older sheets have them; whether they were removed since is not checked.
- At zooms 12–13 the bogs are there, with fewer rock areas and no points.
  v21 carries more than v20 at zoom 13 (paludified land and rock).
- Tile sizes 7–77 KB from zoom 10 to 14 at Seitseminen; first byte in
  0.07–0.13 s from this machine, against 0.21 s for a byte range from the
  OSM data host.
- **Property boundaries** (`kiinteisto-avoin/v3/kiinteistojaotus`): zooms
  0–14, with boundary lines, property IDs, parcels, boundary markers and
  their kinds. In central Jyväskylä a zoom-14 tile is 181 KB and a zoom-16
  one 13 KB; first byte about 0.1 s.

### Property boundaries as Kapsi's raster

The smallest change: one raster overlay, as `maastoOverlay` is today
(`wmsTiles()`'s PNG form, since Kapsi serves this layer only as PNG). Its
tiles are fixed black lines with black IDs on a transparent ground, which
can't be recoloured (only lightened, for the Night and Aerial maps). A
first try on polku.si in Jyväskylä at zoom 15 showed thin black lines among
the building outlines and paths; it wasn't repeated on Night or Aerial.
Not recommended.

## How it fits the map

- **Sources.** Vector sources for MML's background map (`taustakartta`,
  v21) and property map (`kiinteistojaotus`, v3), with Finland's bounds, so
  nothing is asked for outside Finland. Map tiles have their own path, not
  `request()`, as OpenFreeMap's do. A position never leaves the device
  beyond the tiles of the area on screen, as with every map tile.
- **The key.** Polku's key sits in `js/config.js` scrambled, not as plain
  text, so it doesn't show in the source or to scrapers; the browser still
  sends it, and anyone can read it from a tile's address, so it is not a
  secret. A person's own key from Settings (`s.mmlKey`, which already
  turns on MML's raster maps) is used instead when they have one. Sending
  the key in a header instead would keep it out of tile addresses, but MML
  then asks the browser for a preflight on every tile, doubling the
  requests.
- **When it fails.** MML refusing the key, or not answering, leaves the
  OSM-based map under it: OSM's wetlands and rock show, cliffs and power
  lines are missing, and a message says so once, and again only after a
  tile has loaded in between (#1160, #1168). Property boundaries show "No
  data now" in the Layers panel, as other overlays do (#1157). A tile with
  nothing in it is a successful empty tile.
- **Offline.** Offline areas don't save MML's tiles; offline, the layers
  are missing and the message says so.
- **Attribution.** "© Maanmittauslaitos" with the dataset, CC BY 4.0. The
  dataset's date is left out, since the tiles are live.
- **Bases.** Terrain on the Trail, Plain and Night maps. The Maastokartta
  and MML bases already draw these classes, and the aerial maps show the
  ground itself; neither gets the terrain. Property boundaries on every
  base.

## Drawing

As built. Each part was checked at 390 × 844 and 1440 × 900, on the Trail,
Plain and Night maps, in MTB and paddle; its PR lists what else it covered.

- **Bogs** (#1160) from zoom 11, over OSM's wetland pattern and under OSM's
  reedbeds, with one opaque image per class, so MML's class covers OSM's
  wetland where both have one and OSM's stays elsewhere (decided on #1147:
  not a filter by Finland's outline, which MapLibre can't do for polygons).
  Open bogs keep OSM's blue dashes; wooded bogs have them on the forest's
  green; hard-to-cross bogs have unbroken lines. Paludified land gets
  sparse short dashes from zoom 13, under OSM's wetlands, and overgrowing
  water the dashes on the water's blue, over OSM's lakes (#1177). MML's
  lakes are drawn over OSM's wetlands, so a marsh OSM cuts out of a lake
  reads as water (#1177). The patterns are `bog()` and `wetland()` in
  `js/icons.js`.
- **Rock** (#1168) from zoom 13, over OSM's rock in the same grey (decided
  on #1147), boulder fields dotted; from zoom 14, small rocks, stones and
  sparse boulders as marks. Rock fissures aren't drawn: none were in the
  tiles seen.
- **Cliffs** from zoom 13, a dark line with ticks on its lower side, which
  in MML's data is the right of the line's direction. **Power lines** as
  thin grey lines from zoom 13, pylons as small crosses from zoom 15.
  Cliffs, power lines and the marks are drawn over the water, so a cliff on
  a shore and a line across a lake show.
- **Reeds** as one tuft each from zoom 14, over the water, not under OSM's
  reedbeds as first planned (decided on #1147: MML's reed points lie in the
  water).
- **The water** (#1170), marks in the basemap (decided on #1170): stones under
  the surface (T), at it (+) and above it (⊥) from zoom 14, as MML's own
  map and Traficom's charts draw them; shoals and stone fields as light lines across the water from zoom
  13, stone fields with triangles; rapids as a row of white ovals along the
  river from zoom 11, as MML's own map draws them (bars across read as a
  ladder, decided on #1170 by #181's rule on standard symbols); which way a river flows as an arrow from zoom 14; jetties
  as dark lines from zoom 14, with OSM's piers everywhere in the same look.
  Over the water and Traficom's depths, under the buildings.
- **Lake depths** (#1170), under the existing **Depth contours** and
  **Depth soundings** switches (decided on #1170: one layer with
  Traficom's): MML's depth contours with their depths, and its depth points,
  from zoom 13. MML's tiles have none at sea or on charted lakes, so the two
  sources don't overlap. Syke's dataset record says Syke makes the lake
  depth contours and delivers them to MML (#1184). They're drawn in
  Traficom's look, so the two read as one (decided on #1170). A lake's
  surface height is a label in the basemap, "94.6 m a.s.l.", from zoom 13.
- **Heath, open forest land and open ground** (#1169): heath a flat pale
  olive tint from zoom 11, open forest land the Maastokartta's diagonal
  hatch in the forest's green from zoom 13, meadows, open shores, fields and
  sand in OSM's colours, and the forest symbols from zoom 14 (decided on
  #1169). OSM's heath and scrub have the same looks and are drawn over OSM's
  forest everywhere; MML's are drawn over OSM's and under paludified land
  and the bogs. In the basemap, not a layer: it's the ground, and open
  forest land is a survey class, not a logging notice (#861 stays apart).
- **Property boundaries** (#1157) on every base, in orange (lighter on
  Night and the aerial maps), from zoom 14, property IDs from zoom 16, in
  the Layers panel under Terrain, off by default, with an **Opacity**
  slider. A plot is tinted under the mouse pointer and when picked, which
  opens a card with its property ID (#1159); **Plot under the pointer** is
  its own switch, on at first. No transition.
- **Tap and hover** (#1175): a tap or a click on the terrain opens the
  card the map's other things use, naming what it is, and the pointer's
  tooltip says the same. A bog's card has its survey class, easier or hard
  to cross, from zoom 13's tiles, with the survey's caveat; zoom 12's
  classes are generalised and zoom 11's have none, so further out it says
  to zoom in. The areas (bogs, paludified land, overgrowing water, rock, boulder
  fields) count under the point only, and only where they're the ground
  drawn there (not under a lake, a town, a building or OSM's own rock or
  wetland), after the water and a property's plot
  and before a park; the lines and marks, and overgrowing water, come
  before the water they're drawn over. MML's lake is the water's where OSM has
  none (a marsh OSM's lake leaves a hole for, a pond in a bog), though the
  card's name is OSM's area around it. Nothing is outlined, as a tile's piece of a bog
  would stop at the tile's edge: the card's pin marks the spot, a point its
  ring. Nothing new is drawn, so there's no basemap or layer to weigh.

## Parts

1. **Property boundaries** ([#1148](https://github.com/TommiContursi/Polku/issues/1148)): the key, the
   property source, failure state, attribution and the layer (#1157); the
   plot under the pointer and the picked plot (#1159). Done.
2. **Bogs, paludified land and overgrowing water** ([#1147](https://github.com/TommiContursi/Polku/issues/1147)): the terrain
   source, after #1146 and #1154 (#1160). Done.
3. **Rock, boulders, stones, cliffs, reeds and power lines** ([#1147](https://github.com/TommiContursi/Polku/issues/1147)) (#1168).
   Done.
4. **Stones, shoals, rapids, flow, jetties and lake depths** ([#1170](https://github.com/TommiContursi/Polku/issues/1170)) (#1186).
5. **Heath, clear-cuts and open ground** ([#1169](https://github.com/TommiContursi/Polku/issues/1169)): with the forest
   symbols and OSM's heath and scrub in the same looks (#1203).
6. **A tap on the terrain** ([#1175](https://github.com/TommiContursi/Polku/issues/1175)): its card and the pointer's
   tooltip, for the water's stones, shoals and rapids too. Done.
7. Later, each its own issue in Map style: paths
   and winter roads where OSM has none (#1171), fences, gates, ski lifts and
   masts (#1172), fire places, springs and monuments (#1173), place names
   (#1174), MML's tiles in offline areas (#1176), and Polku's own archive
   (#1155).

## Not checked

- The other mapping services at a power line and at property boundaries,
  close up: the browser pane was hidden and the map didn't draw.
- For the archive (#1155): the whole-country build's size, time and disk,
  and the GeoPackage's tables and field names (the spike read the
  per-sheet shapefiles).
- On a phone: none of the parts was tried by touch on a real phone.
