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
  (below). Nothing is built in the app.
- **Decided, 2026-11-20: MML's own vector tiles first, with Polku's API
  key in the app** (on #1147 and #1148), kept out of plain sight in the
  source; a person's own key from Settings is used instead when they have
  one. Polku's own archive, decided earlier the same day, is kept for later
  in [#1155](https://github.com/TommiContursi/Polku/issues/1155).
- **Waits on #1146 and #1154** for the bogs and reeds: in Finland, MML's
  bogs and OSM's wetlands would otherwise be drawn twice
  ([Drawing](#drawing)). Property boundaries, rock, cliffs and power lines
  don't wait.

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
and open forest land (avoin metsämaa, 39110, mostly clear-cuts); whether to
draw them is the user's call.

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
v21; the key isn't in the repo):

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
  OSM-based map under it, and the map's data status says MML's tiles
  didn't load. A tile with nothing in it is a successful empty tile.
- **Offline.** Offline areas don't save MML's tiles at first; offline, the
  layers are missing and the map says so.
- **Attribution.** "© Maanmittauslaitos" with the dataset, CC BY 4.0.
- **Bases.** Terrain on the Trail, Plain and Night maps. The Maastokartta
  and MML bases already draw these classes, and the aerial maps show the
  ground itself; neither gets the terrain. Property boundaries on every
  base.

## Drawing

- **Order.** After the landcover fills (`lc-*`) and before hillshade,
  water and roads, so routes, trails and labels stay on top.
- **Bogs.** One pattern per class from zoom 11, after MML's own map
  legend
  ([the terrain map's legend, 2025](https://www.maanmittauslaitos.fi/sites/maanmittauslaitos.fi/files/attachments/2025/09/maastokartta_karttamerkkien_selite_2025.pdf)):
  blue horizontal dashes, sparse for easier bogs and dense for hard ones,
  with the forest's tint kept on wooded bogs. Paludified land and
  overgrowing water get lighter variants. The patterns are drawn in
  `js/icons.js`, as the wetland pattern in #1146 is.
- **Double drawing.** OSM's wetlands (#1146) and MML's bogs cover the same
  ground in Finland. Recommended: inside Finland's coverage MML's bogs are
  drawn and OSM's wetland pattern isn't; outside, OSM's stays. Which one
  wins is the user's call, and this part starts after #1146 is merged, as
  it changes `lc-wetland-pattern`.
- **Rock, boulders, cliffs** from zoom 13: a grey rock fill, dots for
  boulders, a cliff line with ticks on its lower side. OpenFreeMap's tiles
  also carry OSM cliffs (`mountain_peak`, `class=cliff`): in Finland one of
  the two is drawn, not both.
- **Reeds** as small symbols at their points from zoom 14, never filled
  areas. **Power lines** as thin grey lines from zoom 13, pylons from 15.
- **Property boundaries** from zoom 14 in a colour of their own (not black,
  not a trail colour), property IDs from zoom 17, in the Layers panel under
  Terrain, off by default.
- **Hover and tap.** A tap on a bog says its class in words ("Open bog,
  hard to cross (MML survey class)"); on a property, its ID.
- Each part is checked at 390 × 844 and 1440 × 900, on Trail and Night, in
  MTB and paddle, in 3D, and with high contrast.

## Parts

Each is its own PR with its smoke check, map-only screenshots, CHANGELOG,
DESIGN.md and DEVELOPING.

1. **Property boundaries** ([#1148](https://github.com/TommiContursi/Polku/issues/1148)): the key, the property source, failure
   state and attribution, and the layer.
2. **Rock, boulders, cliffs and power lines** ([#1147](https://github.com/TommiContursi/Polku/issues/1147)): the terrain source.
3. **Bogs, overgrowing water and reeds** ([#1147](https://github.com/TommiContursi/Polku/issues/1147)), after #1146 and #1154,
   with OSM's wetlands turned off inside Finland.
4. Later: MML's tiles in offline areas; Polku's own archive
   ([#1155](https://github.com/TommiContursi/Polku/issues/1155)).

## Open questions for the user

- Which source wins where MML's bogs and OSM's wetlands overlap.
- Whether dwarf-shrub heath and open forest land are drawn.

## Not checked

- The other mapping services at a power line and at property boundaries,
  close up: the browser pane was hidden and the map didn't draw.
- For the archive (#1155): the whole-country build's size, time and disk,
  and the GeoPackage's tables and field names (the spike read the
  per-sheet shapefiles).
- How OSM's wetlands are turned off inside Finland only. A fill layer
  can't simply be filtered by a polygon, so this decides how "MML wins in
  Finland" is built; it blocks the bogs part's design.
