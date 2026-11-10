# Static OSM builder

Use Python 3.14 or newer; the pinned PMTiles writer uses its deterministic gzip
defaults. Install the two pinned build-only dependencies in a virtual environment:

```sh
python3.14 -m venv work/osm-venv
work/osm-venv/bin/pip install -r tools/osm_data/requirements.txt
work/osm-venv/bin/python -m unittest tools.osm_data.test_builder
```

Download Geofabrik's complete country `.osm.pbf` and its adjacent `.md5`
file. Preserve both outside the repository and deployable release directory.
The builder reads the expected MD5 and computes MD5/SHA-256 before processing
any OSM objects. It requires the PBF replication timestamp to be no more than
14 days old, checks the selected country's minimum counts and sample coverage, then writes a fresh
directory atomically:

```sh
work/osm-venv/bin/python tools/osm_data/builder.py \
  work/finland-latest.osm.pbf work/finland-release \
  --md5 work/finland-latest.osm.pbf.md5
```

An existing output directory is refused. Temporary SQLite staging and a sparse
disk-backed node-location index are created beside the output and removed after
success or failure. Keep several times the source size free for staging. No
network requests or publication happen in the builder.

The output has seven PMTiles products, `manifest.json`, `measurements.json`,
`identities.jsonl.gz` and `LICENSE.txt`. The manifest identifies the exact source and checksums every
deployable file except itself. Its local dataset URL is relative to this
immutable release directory. The publication tool gives `current.json` a URL
under `releases/<release>/`; it does not modify this release's manifest.
Release IDs contain the source timestamp, source digest and a digest of every
dataset record plus coverage. Lighting-only changes can therefore be published
for an unchanged source snapshot. Timing measurements do not affect identity.

`ways.pmtiles` is PMTiles v3, unknown tile type, gzip tile compression, z14.
Each uncompressed tile is `{ "schema": 1, "elements": [...] }`. Complete
intersecting ways have Overpass-shaped `type`, `id`, `tags`, ordered `nodes`
and `geometry: [{lon, lat}, ...]`. Coordinates retain OSM's seven decimal
places. Every tag is retained. Geometry is neither clipped nor simplified;
segments crossing a tile are included even when neither endpoint lies in it.

`lit.pmtiles` uses the same complete way format at z13, without relations. It
includes every highway with an original `lit` tag, including motorways excluded
from selection. The app keeps the existing lit/unlit classifications; other
values remain unknown. Fixtures without any lighting omit the optional dataset;
a full country release requires it. Measurements include lighting counts, tile
sizes and sample tiles. No hosting change is needed to serve the second archive.

Route and restriction relations carry their original tags and ID. Their
`members` include only eligible ways in this tile; each member has `type`,
`ref`, its unchanged `role`, and `index`, its zero-based original position.
`member_count` is the original total including omitted members. Off-tile ways,
node members (including restriction via-nodes) and nested relations are absent.
Use the retained source PBF for complete relation lists. Relation subsets are
descriptive memberships and must not be used as complete routing restrictions.
Only relations tagged `type=route` supply route names to the existing selector.

Elements are ordered by way ID, followed by relation ID. Tile data and PMTiles
metadata are reproducible for an identical source on the supported runtime;
build time/resource measurements and the manifest's build time vary.

Empty tiles are omitted. Bounds are the extent of complete eligible source
ways, not a country polygon or a promise of coverage beyond the extract.
Full-country manifests also embed the attributed extract clipping
polygon (the CLI's checksum-recorded `--coverage country.poly`), used to decide when the global
Overpass fallback is required. The archive metadata and licence repeat this limit.

Measurements include source node/way/relation counts, eligible way counts and
node references, membership and way duplication, raw/gzip tile percentiles and
maximum tile, five named sample tiles, archive size, build duration and peak
resident memory. `source_nodes` counts all input nodes;
`eligible_node_references` counts ordered references including shared nodes.
The individual gzip JSON comparison uses the exact same tile payloads, so its
reported total is the bytes and number of files needed without PMTiles.

## Additional named products

The same stage emits trail/barrier nodes and ways at z13, winter ways at z12 (including ski tracks without highways), water hazards at z11, and overnight places at z12. Predicates mirror the existing browser queries, before their slim display adapters. Features retain original type/ID, all tags, way nodes/geometry and place centres. Place relation members/roles are retained, and unavailable member geometry rejects the build. Gzip tiles above 8 MiB or decoded JSON above 32 MiB reject the candidate. `measurements.json.products` reports counts and compressed/raw tile distributions.

These optional datasets are additive to schema 1; old clients continue reading ways/lighting, and new clients fall back when a product has not been published.

The z14 inspection product adds all highways and the existing amenity/tourism/leisure/natural/barrier/ford/man_made/historic object classes. It preserves type/ID and complete way nodes/geometry; relation members stay descriptive original references. Missing generic relation members are recorded with `incomplete:true`, and dataset `nearby_complete:false` prevents falsely complete proximity queries. Missing overnight relation members still fail the build.

## Four-country candidate

`--country finland|sweden|norway|estonia --coverage country.poly --snapshot YYMMDD`
builds a complete country. The workflow selects one completed dated export shared
by all four countries, then requires exactly equal PBF replication timestamps.
Latest sources remain supported for individual local builds. Preserve the PBF,
MD5 and polygon together. No bounding rectangle proves complete coverage.

Run `python -m tools.osm_data.bundle OUTPUT FI_RELEASE SE_RELEASE NO_RELEASE EE_RELEASE`
on the same filesystem. It verifies every file hash and every overlapping original
object digest, retaining type/ID namespaces, ordered way geometry/nodes and original
relation references/roles. Conflicting objects, mixed epochs or missing products
reject the bundle. Archives are hard-linked, not recompressed or concatenated.
The sorted identity evidence is build-only; retained source/country artifacts
provide the original objects.

Finland keeps the original dataset keys; other records add `kind`, `country`,
`source`, `bounds` and actual `coverage`. Root Finland coverage remains conservative
for old clients. New readers select the first archive whose polygon wholly covers
the requested tile. A border tile can use the proven union of equal-epoch extract polygons; required
parts are read in parallel and original copies must agree. Real gaps use bounded
Overpass. Cross-border ways remain whole within any selected archive. A missing
archive or wrong archive zoom/type/compression is a failure, never valid empty data.

Candidate payloads use gzip level 6: five real Finland samples took roughly half
the encoding time for 1–2.5% more bytes than level 9. Evidence:
`docs/measurements/osm-compression-2026-11-02.json`. Measurements include archive
bytes, stage/build duration, peak RSS and allocated staging blocks. CI separately
records runner free disk and browser cold/cache transfers in every country.
`measure_browser.py --country all` exercises the combined release with Overpass
forbidden. Phone measurements are Chrome emulation, not real-device evidence.

## Local geometry format

`geometry.compile_geometry()` compiles a reference-complete source subset and
selected original roots into one z13 PMTiles product. This build-only API is
separate from the seven country products. Its dataset descriptor is schema 2;
the enclosing release manifest remains schema 1. Publishing and consumer
activation are separate steps; a compiler test is not evidence of live coverage.
The delivery sequence and acceptance criteria are in
[the implementation plan](../../docs/superpowers/plans/2026-11-04-hosted-area-geometry.md).

A tile is `{schema:2,tile:[13,x,y],elements:[...]}`. Each element retains its
original type/ID/tags/content SHA256, generic complete bounds (or `null` when
incomplete), an inspection-purpose flag and local original fragments. Way
fragments carry original ordered node IDs/coordinates, full original node count,
original starting position and original content digest. Their nested membership
path entries are `[parentRelationID, originalIndex, type, ref, role, memberCount]`.
Primitive roots have an empty path. Neither coordinates nor topology are simplified.

Area metadata has independent source completeness and full outline bounds;
label members do not enlarge those bounds. A tile-local polygon has a stable
outer-node-cycle key, inside intervals on its east edge and `[fragmentIndex,
segmentOffset, inner]` pointers to actual original segments. `containsArea()`
uses ray parity from those intervals. An interior tile can have a containing
area and no boundary fragments. Intervals are never drawn as shoreline.

Native osmium assembly is checked against original outline edges. Missing
references cannot prove full bounds or a complete negative result. Invalid rings
with fully known bounds remain local incomplete candidates. Assembly may remove
doubled spurs/shared borders only when the removed graph has no cycle; losing a
closed cycle is rejected. Original fragments still preserve those source nodes.
Unknown area bounds set `areas_complete:false`; unknown generic geometry sets
`nearby_complete:false`. These flags are distinct from a successful empty tile.

The compiler uses disk-backed primitive/tile staging and node locations. It
rejects original identity conflicts, existing outputs and tiles above the
8 MiB compressed/32 MiB decoded browser limits, and exposes the archive only on
success. Its receipt records output sizes, time, peak process RSS and allocated
staging blocks. The caller supplies actual coverage polygons and verified source
provenance; bounding rectangles limit indexing and never certify coverage.

Run `python -m unittest tools.osm_data.test_geometry -v` and
`node --test tools/osm_data/client.test.mjs`. The checked JSON fixture is decoded
from real compiler output and compared byte-for-content by the Python test;
Node and the registered `osmdata` browser check exercise the same local predicate.
The retained Inari/Saimaa sample measurements are in
[the geometry measurement](../../docs/measurements/osm-local-geometry-2026-11-04.json).

## Shared reference completion and optional 29th archive

Each country build now exports `geometry-roots.jsonl.gz`: sorted rows
`[type,id,area,inspection,originalSHA256]`. This catalog and the existing original
identity evidence are checksummed build inputs, excluded from browser releases.
The shared job downloads those inputs, verifies their hashes and common
epoch, and completes the area roots' references from the dated Europe PBF.
The archive reports `nearby_complete:false`; the country inspection archives
continue to serve full tags and supported nearby objects. Original area tags
are retained; native reference completion uses explicit depth 10. Selected copies
must agree with every available original country identity.

```sh
python -m tools.osm_data.geometry_source osm-build/europe.osm.pbf osm-build/geometry \
  osm-build/inputs/osm-finland-geometry-inputs osm-build/inputs/osm-sweden-geometry-inputs \
  osm-build/inputs/osm-norway-geometry-inputs osm-build/inputs/osm-estonia-geometry-inputs \
  --md5 osm-build/europe.md5 --snapshot YYMMDD --remove-source
python -m tools.osm_data.bundle osm-build/release FI_RELEASE SE_RELEASE NO_RELEASE EE_RELEASE \
  --geometry osm-build/geometry
```

The optional removal flag is for the sibling temporary CI input only. Normal
local builds preserve their input. The Europe file is deleted after subsetting,
before allocating the subset location index. It is never uploaded or downloaded
by the app. The job requires the actual reference size plus 25 GiB free before
download and 25 GiB after download, and records RAM/time/allocated staging peaks.
The existing free public runner and hosting/publisher remain in use; a failed
resource or source gate leaves the current release intact.

The bundle verifies the geometry receipt against all four exact input manifests,
root/identity hashes, source epoch, coverage collection, archive header and source
provenance. It adds one shared `geometry.pmtiles` and its measurements to the
existing 28 products. Original country keys and the enclosing manifest schema
remain unchanged. New clients accept old manifests without geometry; old clients
ignore the optional product. The reader uses the existing ranges, cache pin and
whole-attempt deadline, including valid sparse schema 2 empties and explicit
completeness flags. Country coverage collections use the same exact union proof.

When geometry is published, candidate/live checks require all 29 archive URLs and
six lake/park containment locations in both browser profiles, alongside the
existing 32 consumer cases. Without it, the verified 28-archive checks remain.
The new format's whole-country measurements and live coverage must be established
by a completed run; the small retained-source measurements do not establish them.

The shared geometry CLI emits phase, object/tile progress and resource records
to stderr without changing its JSON result or archive bytes. The workflow allows
300 minutes for download and compilation, with a 130-minute download step.
Weekly and manual production builds add the area archive after all four country
jobs pass, then assemble the same-epoch bundle. If an earlier build's country
jobs passed, `geometry-candidate`
with the existing `release` input set to their run ID reuses the eight verified
country artifacts; it does not download country PBFs or rebuild those archives.
The separate candidate concurrency group keeps the experiment independent of
live checks and weekly country updates. The same-epoch reference, area
completeness, size and publication checks remain.
