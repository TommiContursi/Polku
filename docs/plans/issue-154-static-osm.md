# Finland's static OSM data

2026-11-01. Implementation decision for #154, following the user's request to
investigate, choose and build without stopping at a proposal. This is the
implementation's choice, not a separately approved hosting change.

## Architecture

Build the complete Geofabrik Finland extract weekly outside OVH. Keep the app
as plain ES modules. Publish immutable, checksummed releases behind a small
`current.json` pointer. The first theme is roads and paths for `loadWays()`;
routing, other Overpass consumers and the selection rules stay as they are.

The first candidate is PMTiles v3 with gzip-compressed JSON at z14. Each tile
holds complete intersecting OSM ways: IDs, ordered node IDs, original geometry
and tags, with route/restriction memberships. Geometry is neither clipped nor
simplified. The existing selector can therefore join across tiles. Full ways
are duplicated only where they intersect tiles; size and worst-tile measurements
decide whether that cost is acceptable. Other themes can use the same release
manifest and independent archives without adding downloads to routing.

Alternatives: individual gzip JSON tiles use the same schema without HTTP
Range, but require many files and uploads. Ordinary MVT/PMTiles display tiles
quantize and clip geometry and omit topology/tags; they would need a second
complete-feature store. A running Overpass/PostGIS service adds operational
requirements that shared hosting does not meet. Measure the first two static
options using the actual full-country build before finalizing the decision.

## Boundaries and failures

The extract's buffered country boundary defines coverage, including whole ways
crossing it; it does not promise arbitrary routing outside Finland. Preserve
the source timestamp and checksum and document the exact theme schema. Fail
on invalid input or incomplete geometries. A failed update must not replace
the working pointer. Readers pin one release for a page session and cache
tiles under that release, so updates cannot mix topology. Offline reuse is
for tiles already fetched, not a new download-entire-country feature.

The deployment tool uses explicit FTPS with certificate validation, a dedicated
empty directory, immutable release names and a verified atomic pointer rename.
No SSH, daemon, DNS change, existing website overwrite or credential creation.
Deployment remains disabled until approved credentials/configuration and actual
Range/CORS/cache/atomic-rename checks exist. The production app keeps its
existing source until the configured data URL is verified; tests and local
previews exercise the static integration before that switch.

## Implementation and checks

- [ ] Build and validate a deterministic Finland-wide roads archive; test a
  crossing between tiles, shared nodes, long segments, tags and memberships,
  missing geometry, checksum failures and repeatable output.
- [ ] Add the PMTiles reader through `request()` and release-scoped caching;
  test partial HTTP responses, missing/corrupt data, concurrent reads, offline
  reuse and that migrated way selection never asks Overpass.
- [ ] Add weekly build, artifacts, guarded FTPS publication, rollback and
  freshness monitoring. Test publication failure before pointer replacement.
- [ ] Measure full-country size/build resources plus urban, rural, forest,
  coastal and northern tiles. Compare individual-file transfer cost and the
  existing Overpass request. Test desktop/mobile-sized browsers separately
  from real devices, which are not available in this session.
- [ ] Update source inventory, installation/operations docs and developer
  docs; open a PR with exact verified results and remaining hosting actions.

Review focus: sparse empty tiles versus out-of-coverage data; failed release
publication; geometry crossing a tile without a node inside it; incomplete
relations at extract edges; cached tiles from different releases. Root runs
all verification; research agents do not run the suite.
