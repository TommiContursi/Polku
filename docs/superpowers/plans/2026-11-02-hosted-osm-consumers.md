# Hosted OSM consumers implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax. The owner authorized reasonable implementation choices and continuous execution; only material product/cost decisions and consequential publication require approval.

**Goal:** Serve existing OSM selection, details and checks locally by tile from ducksoft.fi across Finland, Sweden, Norway and Estonia, retaining bounded public mirror fallback.

**Architecture:** Extend the existing Python/osmium → SQLite → gzip JSON PMTiles pipeline and `StaticOSM` reader. Add optional named datasets without replacing the existing ways/lighting schema, publish immutable releases through the guarded SFTP publisher, and migrate consumers through one shared hosted-first entry point. Country archives are a provisional choice pending complete-build measurements; country jobs bound peak disk/memory and avoid a 35 GB Europe input.

**Tech Stack:** Plain browser ES modules, existing vendored PMTiles, IndexedDB, Python 3.14.3, osmium 4.3.2, pmtiles 3.7.0, existing GitHub Actions/SFTP publication.

**Spec:** #154 and the requirements below extend `docs/plans/issue-154-fallback-lighting.md`. Code base: d84fd6a. No open PR overlaps these data modules (2026-11-02).

## Requirements and global constraints

- Include road/path picks and route memberships, trail details/obstacles/barriers, mapped winter maintenance/access and ski-only ways, existing overnight places, water hazards, existing lighting, full-tag inspection and lake/park/protected-area picks where practical.
- Reuse lighting classification, tiles, map feedback and retry behavior. Do not implement additional lighting meanings/sources (#657).
- Valid hosted cache first; hosted data for actual extract coverage next; cached Overpass/mirror fallback when unavailable or uncovered. Preserve seven-day public-cache freshness and stale-on-error behavior. No parallel public request during healthy hosted operation.
- Bound the entire hosted attempt and public fallback round, including bodies. Keep every configured mirror; avoid querying Kumi/Private Coffee's same service twice. Coalesce manifest and tile requests; do not repeat failed manifests per tile.
- Valid empty, absent coverage/dataset, incomplete geometry and request failure remain distinguishable. Missing data must reach existing Not checked/error/retry behavior, never become a successful empty check. Retain source timestamps/attribution.
- Preserve original type/ID, all required tags, full way geometry, ordered nodes, route member order/roles/count and polygon outer/inner geometry. Retain complete source artifacts.
- Use clipping polygons, never country rectangles as proof of coverage. Overlapping archives deduplicate by type/ID; conflicting duplicate objects fail rather than silently changing geometry. Border tiles without a complete coverage proof use fallback. No whole-country browser downloads.
- No router, basemap, weather, LIPAS or unrelated provider migration. No dependency/backend/service added without a demonstrated need and approval.
- Existing manual publication, reviewed artifact pin, host-key protection, atomic promotion, rollback and daily monitor remain. Only the owner merges/publishes. Old clients must keep reading old ways/lighting during rollout; optional new datasets fall back until published.
- Run focused smoke groups locally; never run the complete local suite. Full suite only through GitHub under AGENTS.md's green-main gate. Never end with uncommitted work.

## Review focus

1. A gate or ski track without `highway` survives extraction; absent tiles are valid empty only inside declared coverage (Task 1).
2. A hung body or many simultaneous consumers terminates within one hosted deadline plus one public round, sharing requests (Task 1).
3. Exact object IDs and node/way/relation ID collisions return full tags for the requested object, not the nearest substitute (Task 2).
4. A lake hole, multipolygon island, large outline or incomplete border relation never produces a falsely complete selection (Task 2).
5. Overlapping country extracts and cross-border ways retain stable topology/memberships; uncovered boundary strips fail over explicitly (Task 3).

## Release sequence and acceptance

| PR | Independently useful deliverable | Gate before ready / publication |
|---|---|---|
| 1 | Trail/barrier, winter, hazard and overnight datasets plus their existing consumers; shared source policy. | Fixture extraction parity, empty/failure/cached/offline behavior, focused `osmdata trails winter water stops pickcard lit` checks. Current live manifest remains usable and falls back for missing optional products. Finland full build measured before publishing these products. |
| 2, after 1 | Full-tag inspection; measured lake/park/protected-area representation follow-up #696. | Exact-ID/nearby and concurrent raw/adapted reads; `osmdata facts spotcard routecard pickcard`. Large/incomplete areas retain bounded public fallback with the measured obstacle documented. |
| 3, after 2 | Four-country build matrix, manifest packaging/reader selection and complete measured candidates. | All four complete builds, source/coverage checks, border/conflict fixtures, browser cold/repeat transfer/latency with Overpass forbidden, archive/disk/RSS/time/artifact/hosting budget report. Owner reviews artifact and merges, then separately approves protected publication. Fresh live-manifest/Range/browser verification required before claiming published coverage. |

Each PR includes its factual DEVELOPING/README/release-note updates; no new controls or motion. PRs may ship in this order without waiting for later parts. A failed new build never promotes a pointer; retain predecessor and rollback artifacts. Do not change the reviewed publish-existing artifact pin until the candidate actually passes.

### Task 1: Existing detail/check consumers

**Files:** modify `tools/osm_data/builder.py`, `test_builder.py`, `js/osm-data.js`, `js/osm.js`, `js/trails.js`, `js/winter.js`, `js/waterdata.js`, `js/stops.js`, `js/lit.js`, `js/ways.js`, `js/net.js`, `js/planner.js`; tests `tools/osm_data/client.test.mjs`, `smoke_checks.js`, `tools/smoke.py`; docs `docs/OSM_DATA.md`, `tools/osm_data/README.md`, `docs/plans/osm-data-inventory.md`, `docs/DEVELOPING.md`, README/CHANGELOG as needed.

**Interfaces:** retain `StaticOSM(url, dataset='ways', zoom=14).tile([x,y], {force}) -> {schema:1,elements,source}`. Add `hostedTile(url, dataset, zoom, [x,y], fallback, options={}) -> Promise<Overpass-shaped JSON>` in `js/osm-data.js`; caller's existing slim adapter runs after source choice. Datasets: `trails` z13, `winter` z12, `hazards` z11, `places` z12. Existing `ways` z14 and `lit` z13 remain byte-compatible. Places retain type/ID/tags and centre, deduplicated across requested tiles.

- [ ] Write builder fixtures with a gate/ford node, fence, tagged track, ski-only way, reef and campsite node/way/relation. Assert literal IDs, original tags/nodes/geometry, z13/12/11 membership, relation centre and deterministic archives. Write transport tests for optional datasets, cached/empty reads, concurrent failures and bounded fallback; run to demonstrate missing products/policy.
- [ ] Generalize the current staging/archive selection to include these exact existing query predicates. Reuse `segment_tiles`; retain source feature records once in staging. Relation centres need all available members and must be marked incomplete when unavailable. Empty products still have a valid empty archive/metadata.
- [ ] Implement shared hosted policy, finite manifest failure cooldown and whole-read deadline without losing Range/body/schema validation. Keep old manifests valid. Route all seven existing consumers through it, retain existing slim outputs, retry/listener/late-water behavior and seven-day fallback caches. Use one public round (15 seconds interactive, at most 30 seconds background). Preserve provenance in cached tile results and correct source-specific failure wording.
- [ ] Run Python builder/publisher/preview tests, Node reader/source tests and the named focused smoke groups; failures caused by the environment are recorded separately. Commit PR 1; push/open draft, mark ready only after its checks pass. Record exact commit/evidence in #154.

### Task 2: Inspection and areas

**Files:** modify builder/tests, `js/osm-data.js`, `js/inspect.js`, `js/ways.js`, transport/smoke tests, inventory/schema/operations docs and factual README/CHANGELOG.

**Interfaces:** `hostedTile` from Task 1; `inspection` z14 contains all highways plus objects matching existing nearby-place tag keys, full tags and centre/geometry; `areas` z12 contains supported water/leisure/boundary polygons, original identity/tags/bounds and outer/inner rings. Keep `wayNear(ll,id)`, `osmDetails({type,id,ll})` and `areaAt(ll)` return shapes unchanged. Full-tag requests outside the extracted object classes must use fallback, never return a false absent object.

- [ ] Add failing fixtures for exact ID distinct from nearest, mixed object types with identical IDs, motorway tags, a shelter relation, multipolygon outer/inner rings, point in a hole, area wholly containing a tile, open/incomplete ring and an area whose whole extent exceeds the display box.
- [ ] Reuse osmium's existing area assembly to build valid supported polygons, index interiors as well as edges, and retain original rings/identity. Measure largest tile and refuse oversized/incomplete tiles explicitly; do not silently omit objects. If real area sizes require a separate clipped-containment representation beyond the existing payload limits, document the exact measured case and a bounded follow-up rather than shipping incorrect polygons.
- [ ] Implement area containment and existing ~5 km outline presentation with whole/cut distinction. Reuse raw hosted ways and inspection tiles for full tags, searching the local query radius across tile boundaries and deduplicating by type/ID. Unsupported exact objects retain bounded Overpass.
- [ ] Run builder/client tests and focused inspection/pick smoke groups. Commit/push PR 2 based on PR 1, update #154 with implemented and measured limits.

### Task 3: Four-country coverage and release candidates

**Files:** modify builder CLI/country validation, reader and its tests, publisher validation/tests only where schema requires it, preview/measurement tools, `.github/workflows/osm-data.yml`, country clipping assets and documentation. Add `tools/osm_data/bundle.py` and its tests for release assembly if country archives win the measurements.

**Interfaces:** retain schema 1 top-level manifest and original `ways`/`lit` keys for Finland. Additional dataset entries carry `kind`, `country`, `source`, `coverage`, archive metadata and distinct safe filenames. `StaticOSM` selects matching kind/zoom and checks actual per-archive polygon coverage. Bundle source timestamp is the oldest constituent timestamp; retain each source's digest/URL/timestamp and each archive's coverage. Flat files keep the existing publisher/current/rollback format.

- [ ] Write failing tests for four country coverage selection, rectangle false positives, overlapping identical/conflicting type/ID records, cross-border full ways and memberships, missing country/product, mixed timestamps, unsafe paths and deterministic bundle hashes. Country assertions use literal Helsinki, Stockholm, Oslo, Tallinn, Haparanda/Tornio, Kilpisjärvi and Kiruna coordinates.
- [ ] Build countries separately from checksum-verified synchronized Geofabrik sources and their actual clipping polygons; do not concatenate duplicate IDs. Bundle immutable country archives; choose the first wholly covered tile deterministically, compare duplicates whenever multiple archives must contribute. Conservative uncovered border tiles use public fallback. Missing geometry/relations must not advertise complete area coverage.
- [ ] Add matrix jobs with bounded resources and candidate-only artifacts; retain protected publishing behavior. Run complete four-country candidates on Actions. Record source/archive sizes, build seconds, peak RSS and disk, tile p50/p95/p99/max. Compare shared archive merging costs with country assembly; finalize country choice from evidence. Stop short of any new paid runner/storage decision.
- [ ] Extend `measure_browser.py` to exercise each migrated dataset at representative coordinates in all four countries; count manifest/Range/public requests and bytes, measure cold desktop/390x844 emulation and cache repeats. Include covered empty tiles and border/outage checks; normal covered operation must make zero Overpass calls. Validate no single request downloads an archive.
- [ ] Check CI job/artifact limits and existing OVH quota/large-file verification against measured files; document unknown account limits. Run focused checks and eligible CI, commit/push PR 3. Provide reviewed candidate IDs and exact publication/rollback sequence for owner approval. Final table distinguishes implemented/client-tested from actually published/live-verified coverage per consumer.

## Inspection evidence and limits (before implementation)

- Main d84fd6a has hosted ways + lighting. #688/#694 are merged. #154's latest publication hand-over reports live release `20261101T212136Z-be6fdbc1839f-09c08f6d8465` (Finland only), verified by run 41436323356; this session has not independently fetched the live pointer.
- Direct live-manifest retrieval is blocked by this environment's network/browser URL policy. Do not circumvent it. Use existing release artifacts as historical candidate evidence, and leave live verification explicitly pending until authorized access is available.
- Current workflow is Finland-only: 120-minute build, 90-minute publish, 14-day source/release retention, 90-day rollback pointers, reviewed artifact pin 41423123110. Documentation's old bootstrap pin is stale.
- Existing complete Finland measurement: ~680 MB ways + ~47 MB lighting, ~608 seconds, ~1.86 GB peak RSS; historical, not a measurement of this expanded build. Geofabrik's 2026-11-02 index lists approximately 738 MB Finland, 904 MB Sweden, 1.3 GB Norway, 118 MB Estonia versus 32.9 GB Europe (https://download.geofabrik.de/europe.html).
- Local free disk is ~7.5 GiB. Full four-country staging must use measured CI jobs, not fill the user's disk. Installed dependencies are isolated in `work/venv`.

## Area representation decision, 2026-11-02

The whole-polygon model was measured against the complete retained Finland PBF. Among 192,674 supported areas, Saimaa alone has 654,393 ring points (15,499,852 raw / 4,674,607 gzip bytes of compact geometry before nodes/tags/members), across 1,287 z12 bounding-box tiles. Repeating complete polygons would make a small local request heavy; indexing only perimeter tiles would miss containment. The necessary clipped containment and nearby-outline representation is tracked in #696, with holes, original topology and border/incomplete-geometry acceptance. Task 2 ships full-tag inspection and bounds the existing area query to one 15-second mirror round; it does not advertise hosted area coverage. Evidence is in `docs/measurements/osm-areas-2026-11-02.json`. The remaining migration and four-country work continue independently.


## Execution checkpoints

1. #695: extraction/consumers and shared policy pass focused groups and full Finland
   candidate 41502174378. It proposes this explicit passed artifact as the protected
   manual publication target, so Finland details can ship independently. Application
   code 4ad5253 is unchanged by the pin-only commit 4b39e8c.
2. #697: exact full tags and broad inspection pass extraction, reader and card checks.
   The review reproduced concurrent raw/adapted response sharing; 3db8063 separates
   adapters while sharing transport. The regression fails before and passes after
   in both browser sizes; 17 Node checks and all named card groups pass. Area
   representation is the measured follow-up #696, not advertised as hosted.
3. #698: all four complete builds passed in run 41509553858; assembly compared
   20,766,245 unique represented objects and 142,922 identical duplicate copies.
   Final consumer/cache/border verification 41525059421 passed 32 covered cases
   with zero Overpass and zero additional selected-way full-tag requests. Complete
   data total 11.224 GB; max OS RSS 6.64 GB; longest country build 84.20 min.
   The 25 GiB disk preflight guards measured staging. The reviewed publication
   target is proposed as 41509553858 / nordic-osm-release, still owner-controlled.
   Negative country-coverage inheritance checks pass in Node and browser; final
   checks are 58 Python / 20 Node plus named focused groups and actionlint.
   Published coverage is not claimed: actual host quota, bulk publication, >2 GiB
   public Range and live pointer verification remain behind approval. Border
   union/merge is measured follow-up #699; area/nearby relation geometry is #696.
