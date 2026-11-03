# Shared hosted OSM border tiles (#699)

## Goal and authority

Issue #699 is the spec; #154 indexes the complete migration and #706 records
completed automatic maintenance. Serve a local tile from the existing equal-epoch
country archives when their actual clipping-polygon union covers it. Genuine
gaps still use the existing bounded Overpass mirrors. Lighting is reused.
The owner has authorized reasonable implementation choices, merging and live
publication; execute inline without another approval pause.

## Design and release sequence

One independently testable reader PR, then its existing Pages deployment and
live-source verification. No archive/schema change or 11 GB rebuild is needed.
The already published archives preserve original objects; do not generate a
second border dataset. Prebuilt certified border tiles would add extraction,
publication and old-client coordination for a problem the four local readers
can solve. A new polygon dependency is unnecessary for four clipping polygons.

Use a vertical sweep of the requested geographic tile. Partition its x extent
at local boundary vertices, crossings with its horizontal sides, and all local
segment intersections. Between adjacent events the boundary ordering cannot
change. At each slab midpoint, pair ring crossings to obtain polygon interior
intervals (holes excluded), then require their union to cover the full tile's
y extent. Closed polygon boundaries cover the limiting event lines as well.
Do not round coordinates, add an epsilon that can erase a real gap, or infer
coverage from corners/bounding rectangles. Prefer one wholly covering archive;
otherwise discard redundant archives only while the union still covers.

Read contributing archives in parallel under the existing eight-second whole
attempt. Preserve per-archive cache keys, shared manifest pin and PMTiles readers.
Deduplicate nodes/ways/full relations by original type/ID and exact structured
content, ignoring object-key order but preserving array order. Road route
relations have deliberately tile-local member subsets: require identical tags,
original member count and other metadata, merge members by original index,
reject conflicts and sort by that index. Preserve full original references and
roles. Never mutate a cached country payload while merging it. Require all
contributing source epochs to agree with the pinned release. Union provenance
lists each contributing country/source and retains timestamp/attribution.

## Global constraints

- No new dependency, service, paid runner, dataset format or hosting change.
- All network traffic continues through request(); no country-wide browser downloads.
- A failed required archive, incomplete geometry, conflicting identity or epoch
  is unavailable data, never a successful partial/empty tile.
- Covered empty remains successful; missing coverage and real gaps remain fallback.
- Existing selection, detail, lighting, winter, hazard, place and inspection
  adapters/caches, retries, mirror deadlines, release pins and rollback stay intact.
- #696 area/ambiguous nearby-relation geometry remains separate.
- Reuse this owned isolated worktree; leave other sessions' branches/servers alone.
- Focused local groups only, as AGENTS.md requires. GitHub CI and automatic
  @codex review must pass before the authorized merge.

## Task 1: joint coverage and contributing reads

Files: js/osm-data.js; tools/osm_data/client.test.mjs;
tools/osm_data/smoke_checks.js (already registered by tools/smoke.py osmdata).
Interface: StaticOSM.tile() retains its JSON shape. ready().manifest remains
available to existing diagnostics; its archive descriptors are internal.

1. Add transport-fixture tests through StaticOSM for adjacent/overlapping
   polygons, filled and unfilled holes, concave gaps, disconnected pieces,
   exact edge contact, narrow gaps and crossing edges. Include real FI/SE/NO/EE
   clipping polygons and the Narva/outside negative controls.
2. Run the new tests before changing production code. Expected: jointly covered
   fixtures and Tornio/Svinesund coarse products fail with missing coverage.
3. Extend the existing coverage proof and selection in place, choosing only
   necessary local archives. Retain legacy single-country cache behavior.
4. Run node --test tools/osm_data/client.test.mjs. Expected: geometry and existing
   schema/Range/timeout/retry tests pass. Record test counts and timing.
5. Commit the tested reader slice; first push opens a draft PR with #699 scope.

## Task 2: safe object union, failure and cache regressions

Files: js/osm-data.js; tools/osm_data/client.test.mjs;
tools/osm_data/smoke_checks.js; tiny deterministic PMTiles fixtures only if needed.
Interfaces: merged elements retain original typed identities, complete ordered
way geometry/nodes and relation roles/indexes; source.sources describes the union.

1. Before implementation, add tests that fail for typed-ID collisions,
   identical copies, complementary indexed route members, conflicting tags,
   geometry/nodes/member order/index/role/count, mixed epochs, malformed geometry,
   a failed required archive and valid empty unions. Use real PMTiles decoding.
2. Add browser regressions to the already registered osmdata function for
   contributing reads, deduplication, IndexedDB reuse in a fresh reader while
   offline, incomplete-part failure and bounded fallback propagation. Assert
   no unneeded archive requests and no normal public fallback.
3. Implement minimal shared merge/provenance logic; cached parts remain immutable.
4. Run Node and focused browser osmdata. Expected: all pass; one failed part
   cannot return partial/empty success; retries reuse healthy parts.
5. Commit/push; leave an issue Hand-over with exact head/checks.

## Task 3: real published borders, documentation and delivery

Files: tools/osm_data/measure_browser.py; docs/OSM_DATA.md;
docs/DEVELOPING.md; README.md; CHANGELOG.md;
docs/measurements/osm-border-2026-11-03.json; this plan.

1. Strengthen existing border measurement assertions: all seven products hosted
   at Tornio/Haparanda and Svinesund; genuine Narva gaps/outside remain uncovered.
   Measure actual archive URLs, range bytes, cold/repeat latency and provenance
   at desktop 1440x900 and phone emulation 390x844. Assert cache reuse and zero
   normal Overpass requests. Re-run representative existing four-country cases.
2. Run the complete existing OSM Python discovery, Node tests and focused osmdata
   plus changelog on the last app-changing commit. Expected: green. Do not
   start the complete app suite locally.
3. Update the operating coverage rules, measured consumer table and #154/#699
   evidence. No new build/storage cost; document actual extra local border
   transfer and numerical/real-device limits honestly.
4. Commit/push, mark ready and request @codex review. Inspect CI/review, reproduce
   and fix substantive findings with a failing regression first.
5. Under the owner's standing authorization merge once verified. Check the
   successful Pages deployment and actual deployed reader against the live
   immutable dataset. Record a final issue Hand-over/release claim.

## Acceptance and review focus

All seven current products at jointly covered Tornio/Svinesund tiles use only
local hosted ranges, with correct original objects and timestamps and no normal
Overpass. Interior country behavior, real unhosted gaps, bounded failures, empty
results, cache reuse and old published manifests remain correct. Pay particular
attention to sweep events at tile edges/holes and almost touching segments;
relation member subsets versus full ordered lists; cache mutation during merge;
failed contributors and aborts; redundant or mixed-epoch sources; and honest
post-deployment coverage claims. Physical phones remain a stated verification
limit, never described as tested by Chrome emulation.

## Implementation checkpoint (2026-11-03)

Tasks1/2 are implemented in fcb3a18; their overlapping reader work was committed
together so no independently usable commit loses complementary route members.
Task3 preview measurements pass against the actually published release
`20261102T212126Z-four-a730845df91e58bc`:32 country cases/all28 archive URLs,
all7 products and real selection/tag/detail consumers at Tornio/Svinesund in
both profiles. Narva coarse gaps and the outside control remain uncovered.
The existing registered browser check fails both sizes with the unchanged
241b3a7 reader and passes with the new reader. Node39/39, Python97/97; the
stalled-contributor check reaches fallback at8001ms. Complete raw timing/Range
and provenance evidence is condensed in the committed border receipt.

PR #746 is the single reader release; actual deployed verification follows CI
and automatic code review. Existing archives/schema/pointer are unchanged.
