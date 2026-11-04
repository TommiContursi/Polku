# Hosted area selection and local inspection geometry (#696)

Spec: docs/superpowers/specs/2026-11-03-hosted-area-geometry-design.md and GitHub#696.
Primary history: #154; previous borders/maintenance are complete (#699/#706).
Execute inline in the existing owned isolated worktree, branch codex/696-hosted-areas,
base1f6a4e0. Owner authorized reasonable choices and verified merge/live delivery.
No further design-approval pause is needed for the technical choices recorded here.

## Goal and scope

Make existing areaAt() and generic nearby OSM details prefer local hosted geometry
in FI/SE/NO/EE. Preserve original type/ID/tags/topology/member roles, named/smallest
area preference, approximately5km outlines and the whole/cut/incomplete distinction.
No tile edge becomes shoreline. Exact selected-way tags still reuse loaded ways.
No new library/service/account/paid runner/router/basemap/provider migration.

## Measured design and interfaces

A throwaway full-source probe found192674 FI and39749 EE areas. Local parity agreed
with original whole rings at tile corners/interiors; prototype local gzip sizes
ranged from373B for an Inari interior tile to3941B for Kadrioru park. These omit final
member-path overhead and are not completed archive/browser measurements. Direct
missing-member roots were actually observed in both source PBFs, including protected
areas across other borders. Source timestamps are not mixed in any real build.

Use z13 for the initial shared geometry product, subject to complete measurements.
The schema2 payload is separate from complete-way schema1. Keep the manifest root and
all seven existing products unchanged; add one shared geometry archive (29 total).
Its source coverage is a GeometryCollection of the four actual country polygons.

Each tile identifies its z/x/y. Elements retain original typed IDs/tags and canonical
original-content SHA256, optional full generic bounds, local original fragments,
and optional area metadata (complete-source flag, original full bounds and per-outer
polygon east-edge inside intervals). Stable polygon keys derive from canonical
original outer-node cycles, not source iteration order. Fragments preserve original
way/node IDs, original node positions and nested original member index/ref/role
paths. Complete original segments are stored; only display output is clipped.

A point's containment is its east-edge seed parity toggled by original boundary
crossings from that point to the east edge. Half-open ownership must handle off-tile
vertices. Independent outers combine by union; holes toggle within their outer.
Containment seeds are never rendered. Unlocated source incompleteness is explicit
metadata; known-bounds invalid areas remain local uncertain candidates. A partial
member bound cannot prove absence. Generic query completeness and area-source
completeness are distinct.

Country jobs export sorted root catalogs (type/ID, area/inspection purpose, original
identity digest) and existing identity evidence. One shared job verifies inputs,
downloads the same dated/checksummed35.37GB Europe source on the existing free public
runner, checks exact epoch and uses installed osmium.IdTracker/back-reference
filtering to produce a small reference-complete subset with tags. Validate original
selected objects against country identity evidence. Delete the Europe input before
allocating the subset location index. Missing/cyclic/unresolved references remain
explicit, never complete negative answers. Do not download Europe to the browser or
local workstation. Record peak RAM, allocated disk, runtime and all output sizes.

### Public module seams

- tools/osm_data/geometry.py: area/inspection root predicates, canonical source
  serialization, tile geometry compilation, original-fragment/path handling and
  PMTiles schema2 validation; reference-complete input goes in, local archive plus
  measured metadata comes out. Reuse existing osmium/pmtiles and standard library.
- tools/osm_data/builder.py: keep existing products; collect/export original root
  IDs/purposes/digests during callbacks. Shared predicates/serialization may move
  to geometry.py and be imported directly, preserving current consumers.
- tools/osm_data/geometry_source.py CLI: trusted country geometry inputs + source PBF/MD5/
  dated snapshot -> validated filtered subset -> measured shared geometry artifact.
  All writes stay inside fresh staging; existing outputs are refused.
- tools/osm_data/bundle.py: verify geometry inputs/epoch/hashes, combine the one
  shared product with the existing country products, sources/licence and release ID.
- js/osm-geometry.js: schema2 validation and local geometry query primitives shared
  by the reader/measurement and existing consumers. No network outside request().
- js/osm-data.js: preserve schema1 reads; add optional named geometry schema2 and
  coverage GeometryCollection; preserve per-release cache/range/deadline behavior.
- js/ways.js areaAt(): hosted geometry first, current adapter/rules/result shape and
  bounded cached Overpass on absence/failure/incompleteness. Preserve test seeds.
- js/inspect.js osmDetails(): generic nearby uses local tagged node/way/relation
  geometry and actual member distance, retaining current ranking; selected exact
  tags keep existing raw ways/inspection reuse. No sequential long hosted retries.

## Global constraints

- Each original object copy must agree at a common source epoch. Conflicts fail.
- A valid empty tile, missing coverage, incomplete geometry and a failed read differ.
- All app calls use request(); valid immutable cache first; hosted whole attempt8s;
  existing independent mirror round15s interactive/30s background remains.
- Existing manifests without geometry keep working. Old clients ignore the additive
  dataset; new monitoring supports the current28 and extended29 archive sets.
- Never weaken a coverage/identity/empty/failure assertion to make a build pass.
- Physical-phone testing is not claimed from emulation. Offline changes require
  a real service-worker-active/network-offline fresh-page check.
- Keep the healthy live release/pointer until every candidate/publication gate passes.
  Existing guarded rollback, retained predecessor, retention80GiB budget and alerts
  remain. No new paid capacity is authorized or selected.
- Only affected smoke groups locally; no whole local app suite. Own preview port,
  leave other agents' servers/branches/files alone. Current open PRs are unrelated
  docs; recheck file ownership before editing shared global docs.

## PR1 — shared compiler, format and fixtures

### Task1: exact local geometry and original identity

Files: add tools/osm_data/geometry.py, tools/osm_data/test_geometry.py,
js/osm-geometry.js and its Node tests (run from existing client test entrypoint).
Tiny XML/PBF/PMTiles fixtures may be added under tools/fixtures; no country data.

1. Write literal failing tests before production code: a filled tile with no local
   boundary, ring hole/island/disconnected outers, concave/crossing/thin geometry,
   exact tile/vertex boundaries (including #699's off-tile midpoint regression),
   typed-ID collision, original node direction/position/member role/index/nesting,
   small whole area and a cut large area. Compare local membership with a separate
   original-ring point predicate, never the helper being tested.
2. Run `python -m unittest tools.osm_data.test_geometry -v` and the registered Node
   test entrypoint. Expected RED: missing geometry module/functions or unsupported
   schema2; inspect that failures describe the missing behavior.
3. Implement minimal local seeds/fragments and compiler using disk-backed staging.
   Match ring edges to original source ways by original node IDs, not rounded
   coordinates. Keep nested membership paths and source completeness explicit.
4. Add missing primitive/invalid ring/cycle/source-conflict tests. Watch each fail
   before its fix. Only complete source bounds can localize uncertainty; otherwise
   metadata must deny complete negatives. Source cut differs from viewport cut.
5. Run geometry tests, existing Python discovery and Node tests. Expected GREEN,
   old seven-product tests unchanged. Tiny archive decoding and cache/source
   metadata fixtures must exercise real PMTiles transport, not mock an answer.
6. Measure the compiler on retained/sample reference-complete FI/EE data; record
   original sample locations, complete raw/gzip/member overhead and resources.
   No country-wide browser transfer or new source publication is claimed.
7. Commit/push a draft PR on first verified checkpoint; issue Hand-over. Request
   @codex review only after all applicable checks pass, then authorized merge.

## PR2 — shared source completion, build and static reader

### Task2: export/complete/verify source geometry once

Files: builder.py, geometry_source.py, geometry.py, bundle.py, test_builder.py/test_geometry.py/
test_countries.py, .github/workflows/osm-data.yml, operating/build docs.
Interface: root purpose/digest catalog + current identity evidence -> same-epoch
reference-complete subset -> one shared schema2 geometry artifact + provenance.

1. Add RED fixtures with overlapping extracts, a missing border outer, missing
   nested member and mismatched epoch/root digest. Expected: original roots can
   be recovered from one complete reference source; conflicts are rejected.
2. Export root IDs/purposes/digests from existing callbacks, including original
   nodes/ways/relations in the current inspection classes and supported closed
   area ways/multipolygon/boundary relations. Preserve canonical identity hashes.
3. Validate input manifests and only needed root/identity files. Use native
   IdTracker to follow all required references in the dated Europe PBF, retain
   tags, verify any selected original copy against input identity evidence,
   and check all resulting reference completeness. Never infer whole bounds
   from the surviving members. Cycles/unresolved roots stay explicit.
4. Add one shared geometry job after the countries. Snapshot selection checks
   availability for all5 source files; geometry verifies exact header epoch.
   Download/check MD5+SHA, require actual free disk for input/subset reserve,
   remove the35.37GB source before subset indexing, collect time/RSS/disk/output
   measurements, and upload only geometry/evidence. No Europe upload/hosting.
5. Bundle waits for and validates that artifact, all four country input digests,
   common epoch, archive/schema/coverage/source provenance and original overlap
   evidence. Recompute immutable release identity. Preserve recovery/main-only
   publication gates and existing rollback/retention receipts.
6. Run complete OSM Python/Node tests and actionlint when available. Expected
   GREEN; mixed or incomplete build inputs cannot be promoted.

### Task3: additive reader and staged monitoring

Files: js/osm-data.js, js/osm-geometry.js, client.test.mjs, smoke_checks.js,
measure_browser.py, health.py/test_health.py and relevant docs.

1. Add RED real-transport tests for schema2 coordinates/tile identity, original
   fragments, sparse valid-empty geometry, missing optional product, malformed
   fragments, cache/coalescing, covered union/real gap and bounded source failure.
2. Add schema2 validation and GeometryCollection coverage using existing static
   transport/cache/manifest pin and eight-second deadline. Existing schema1
   results and lighting remain unchanged. Unknown formats fail into fallback.
3. Extend browser measurements to verify every archive actually present (28 old,
   29 extended), plus named geometry samples when published. Do not claim a new
   consumer is active before its integration. Add the geometry regression to the
   existing registered osmdata helper; do not edit other agents' smoke sections.
4. Run `python tools/smoke.py osmdata` in both sizes on the committed app head,
   Node/Python tests and PR CI/review. Expected GREEN with current old manifests
   and extended fixture/candidate manifests. Commit/push, Hand-over and merge.
5. Start one complete main build through the existing approved workflow; record
   source snapshots/epoch, all countries/shared geometry/bundle resources and
   browser checks. Let safety gates stop insufficient capacity/invalid geometry.
   Continue PR3 while independent build work runs; do not rebuild identical data
   merely because app consumer code changes. Reuse verified artifact/recovery.

## PR3 — existing consumers and actual live acceptance

### Task4: area picks and nearby inspection together

Files: js/ways.js, js/inspect.js, js/osm-geometry.js, client.test.mjs,
smoke_checks.js/measurement scripts, CHANGELOG/README/DEVELOPING/inventory.

1. Add RED tests through existing consumers for smallest named containing area,
   hole/island negative, a large interior with no nearby boundary, small whole
   perimeter, ~5km cut outline, no invented tile-edge line, original full tags,
   relation eligibility by member distance, source timestamps/attribution,
   incomplete candidates and both-source failure. Keep test seeds/held fetches.
2. Implement selection from the point's certified geometry tile; fetch only the
   nearby outline tiles for that selected original object. Deduplicate original
   segments by member path/way/node position and reject conflicting copies;
   draw only true source edges, clipped for display. Preserve return shape.
3. Generic nearby inspection uses the geometry product's existing tagged point/
   way/relation classes in one bounded hosted lookup, with exact member distance
   and current ranking. Exact known tags retain raw-way/inspection reuse. Missing
   old geometry manifests retain existing hosted/public behavior without long
   sequential source retries; published failure/incompleteness remains explicit.
4. Run focused `osmdata pickcard facts spotcard routecard changelog` plus any
   directly affected area group (inspect registration first); no complete local
   suite. Check 1440x900/390x844, MTB/paddle, route/timeline and actual map picking.
5. Measure actual full candidate/hosted Saimaa, Inari, a small lake/park and
   representative SE/NO/EE locations; genuine source/border gaps; cold/repeat
   bytes/latency; no normal Overpass for supported complete queries; empty/error
   distinctions; cache reuse and worker-active offline reload. Main health must
   verify old seven products and all newly published geometry URLs/consumers.
6. Commit/push; ready only after committed-head groups/CI pass; request @codex
   review and reproduce/fix substantive findings with RED/GREEN evidence.

### Task5: actual publication, documentation and claim release

Use the already authorized existing publisher/main-build/verified recovery only.
Confirm actual full hashes, all archive Range/CORS checks, predecessor/retention,
actual public manifest and deployed consumers. A code capability is not a live
coverage claim. Measure complete run limits before promising four-country area
support; any actual new cost/capacity decision is brought to the owner.

Update #154 canonical index, #696 scope/status/Hand-over and the final consumer/
previous source/new primary/published coverage/fallback/verified-or-remaining table.
Record actual run IDs/commits/resources, physical-phone and rollback limits and
any genuine unresolved upstream data problem. Finish with all work committed and
pushed, current live release healthy, and no unreleased claim left ambiguous.

## Review focus

The east-edge parity identity at exact vertices/tile edges and holes; stable
polygon identity across input order/winding; original member/node direction and
nested paths; no artificial shoreline; bounds of incomplete relations; old/new
manifest compatibility; exact epoch and root digest agreement; native reference
completion limits; temp-source/index disk peaks and free public-runner limits;
no hidden country download; failure/timeout/cache mutation; no monitoring gap or
false published-coverage claim. Compare local predicates to whole original rings.

## Execution checkpoints

- PR1 [#771](https://github.com/TommiContursi/Polku/pull/771) merged the compiler and format.
- PR2 [#772](https://github.com/TommiContursi/Polku/pull/772) merged source completion, optional shared reader, build and monitoring support. Its main build [41776459874](https://github.com/TommiContursi/Polku/actions/runs/41776459874) is the complete resource/publication gate.
- PR3 implements existing area/nearby consumers and full-tag reuse. Compiled fixture regressions cover named/smallest selection, islands, whole and clipped original edges, relation member proximity, timestamps, source failure and public failure. Actual four-country publication and deployed acceptance remain separate gates until the main build completes.
