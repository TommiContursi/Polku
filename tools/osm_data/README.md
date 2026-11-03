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
the requested tile. A border tile needing the union of extracts uses bounded
Overpass; cross-border ways remain whole within any selected archive. A missing
archive or wrong archive zoom/type/compression is a failure, never valid empty data.

Candidate payloads use gzip level 6: five real Finland samples took roughly half
the encoding time for 1–2.5% more bytes than level 9. Evidence:
`docs/measurements/osm-compression-2026-11-02.json`. Measurements include archive
bytes, stage/build duration, peak RSS and allocated staging blocks. CI separately
records runner free disk and browser cold/cache transfers in every country.
`measure_browser.py --country all` exercises the combined release with Overpass
forbidden. Phone measurements are Chrome emulation, not real-device evidence.
