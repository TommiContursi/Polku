# Hosted OSM fallback and lighting implementation plan

> Execute in this session, task by task, using the existing plain-module and
> Python data-build architecture. The user selected fallback + lighting, then
> trail details/barriers; no additional hosting service is requested.

**Goal:** Keep Polku useful globally during hosted-data failures and move the
lighting overlay off its normal Overpass path.

**Architecture:** Prefer the hosted snapshot and its cached data; use the
existing cached Overpass pool when required data is unavailable or outside
the extract. Publish a small lighting archive beside the existing ways archive
through the same immutable release, with no hosting-setting changes.

**Base:** After #686 (`claude/fix-674-675`), preserving its immediate map piece,
pending retry and one-round interactive Overpass budget. Joining rules remain
owned by #676; additional lighting meanings/sources remain owned by #657.

## Constraints and review focus

- Finland-first is not Finland-only: test Tallinn, Stockholm, Oslo and Kiruna.
- A bounding box is not coverage. Geofabrik's 5,254-byte Finland clipping
  polygon is an OSM produced work; retain its source and attribution.
- Use only tiles wholly inside the extract coverage; boundary tiles can use
  Overpass. Cached tiles remain usable offline. Empty covered tiles are valid.
- Healthy hosted requests must not also query Overpass. Failure fallback must
  retain caching, existing public-service limits and the six-round public
  growth budget, rather than the static source's 64-round budget.
- Keep original lighting values and existing lit/unlit classifications. Include
  lit motorways and other highways excluded from the road-selection product.
- A lighting-only archive change must produce a new immutable release ID.
- Keep publication manual and protected. Never overwrite releases, delete
  production files, enable unattended publication or change hosting settings.

## 1. Reader and global road/path fallback

Files: `js/osm-data.js`, `js/ways.js`, small attributed coverage data,
`tools/osm_data/client.test.mjs`, `tools/osm_data/smoke_checks.js` and smoke hooks.

- [x] Add failing checks for hosted success without Overpass, failed-host
  fallback, out-of-coverage global selection, cached offline reuse and the
  public growth limit.
- [x] Let `StaticOSM` select a named dataset and expected zoom; preserve all
  response/schema/geometry/range checks. Cache the page's manifest even when a
  requested optional dataset is absent. Update callers together.
- [x] Validate polygon coverage, including holes/concavities, before fetching
  uncached tiles. For the already published Finland manifest, use the small
  attributed clipping asset; new full-country manifests carry coverage.
- [x] Fall back through `cachedOverpass()` only on unavailable hosted data or
  uncovered tiles. Preserve held-source test behavior and valid empty tiles.
- [x] Run the relevant JS/unit and OSM/card smoke checks; commit.

## 2. Finland lighting build

Files: `tools/osm_data/builder.py`, `test_builder.py`, schema/operations docs
and the existing workflow's reviewed build-artifact pin when available.

- [x] Add failing tests for original lit values, motorway coverage, deterministic
  output and release identity when lighting changes independently of ways.
- [x] Stage lit highways alongside the existing road product; write z13
  `lit.pmtiles` without clipping geometry. Keep primary-way counts/relations
  accurate and retain the complete source PBF for future products.
- [x] Add the lighting dataset/file metadata and extract coverage to full
  releases. Derive release identity from all dataset content, excluding timing
  measurements. Preserve existing publication/rollback verification.
- [x] Run builder and publication checks, then build/measure the real Finland
  source. Compare size and latency with the existing ways archive; commit.

## 3. Lighting integration and review

Files: `js/lit.js`, source descriptions, lighting/OSM smoke checks, docs and
CHANGELOG. Reuse the existing binary overlay result format and UI.

- [x] Test lit/unlit/unknown values, healthy static transport without Overpass,
  missing optional dataset, hosted failure and non-Finland fallback.
- [x] Read z13 lighting tiles from the shared source; fall back to the existing
  query and `slimLit()` path when necessary. Do not change #657's semantics.
- [x] Verify live-like local preview, cold-cache performance, mobile behavior
  and failure handling. Build an Actions artifact without publishing; record
  the exact run for reviewed manual publication after merge.
- [x] Open/update the PR with actual results and activation boundaries; wait
  for owner merge/publication approval where required.

## Local verification, 2026-11-02

- Full source timestamp: 2026-10-31T21:23:06Z. Build took 607.786 s and
  1,863,221,248 bytes peak RSS; no source download or publication was needed.
- Selection: 2,214,266 ways; 233,335 tiles; 679,838,796 bytes. Archive SHA-256
  remains `11398e5b9ab9ccfa2ee7fd553345385bed3dfc8a248ecaff72cae163243b0b3e`.
- Lighting: 272,147 highways; 11,980 tiles; 46,531,673 bytes. Archive SHA-256
  is `603f7943ea3cc54b93c1a8ecafe626224db8fccd7f69ceb4b0ae0c1ce7748b38`.
- Ten reader checks and 44 builder/publication/preview checks pass. The added
  publication check verifies both archives and rejects broken lighting ranges.
- Desktop/390×844 Chrome smoke groups `osmdata`, `pickcard`, `changelog`, and
  the lighting UI/fallback group pass. The lighting failure fixture deliberately
  omits the optional hosted dataset so it still exercises the public fallback.
- Cold lighting reads in six locations: desktop 5–81 ms; phone emulation
  (4× CPU, 80 ms, 10 Mbit/s) 98–1,122 ms. Repeats made no network requests.
  These are local Range-server measurements, not OVH or physical-phone results.
- The former Kilpisjärvi growth sample reaches a border tile; the correct
  behavior now requires fallback there. The interior Rovaniementie sample
  completes 25.1 km with no public query or unloaded end.
- Joining diagnostics remain on #676; Settings failure visibility is #687.
- Actions build [41423123110](https://github.com/TommiContursi/Polku/actions/runs/41423123110)
  passed 44 Python checks, ten reader checks, full-country browser checks and
  six desktop/phone measurements, then retained the source and release artifacts.
  It used the next upstream snapshot, 2026-11-01T21:21:36Z; release
  `20261101T212136Z-be6fdbc1839f-09c08f6d8465`. Local figures above describe
  the 2026-10-31 source, not this newer artifact. The reviewed manual-publication
  pin now names that successful run. Nothing has been published.
- The existing production monitor passed again. A live Tallinn attempt exhausted
  its Overpass round; fallback restores the global path but cannot guarantee
  public-provider availability. Nearby-country transport/coverage checks remain
  controlled so they do not depend on a healthy public server.

## Follow-on work already requested

- Trail details/barriers follow lighting, including point obstacles and
  non-highway barriers absent from the current road product.
- Audit Settings → Data sources against actual calls and failures. Current
  counts are attempts, not proof of success; tiles use separate paths and
  Overpass deliberately bypasses global backoff. Report and fix verified
  visibility gaps without inventing a new dashboard.
- Reproduce short picks near Tykkikalliontie under #676, recording lengths and
  stop reasons from the complete source. Show measured alternatives before
  changing the user's earlier unnamed-path junction rule.
