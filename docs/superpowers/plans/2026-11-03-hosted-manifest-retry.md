# Hosted manifest retry implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. The owner authorized reasonable implementation choices, continued work and merging; do not pause for another execution choice.

**Goal:** Let an explicit OSM retry reach a recovered hosted source immediately.

**Architecture:** Replace only the shared failed manifest entry with a one-attempt manual retry marker. Forced way reads and existing trail/winter/water/lighting failure-reset handlers reuse it. The manual manifest request bypasses the network-down backoff while respecting a provider rate-limit pause; healthy pinned manifests and cached data remain intact.

**Tech Stack:** Existing browser ES modules, Node transport fixtures and focused browser smoke.

**Spec:** Issue #702; docs/OSM_DATA.md source-selection/retry rules.

## Global constraints

- Keep the 120-second background failure cooldown, request coalescing, eight-second hosted deadline and bounded existing mirror fallback.
- Reuse lighting UI/classification and current retry functions. No archive/schema/dependency/provider changes.
- Missing data must remain unavailable; successful empty results retain their meaning and provenance.
- Run focused groups only. Publication continues independently; do not restart it.

## Review focus

A normal read after failure must not refetch. Explicit retry must refetch; concurrent retries share the replacement. A retry must not discard a healthy pinned manifest. Lighting and route retry actions must retain their existing behavior.

### Task 1: Recover the shared source on manual retry

**Files:** js/osm-data.js; js/trails.js; js/winter.js; js/waterdata.js; js/lit.js; tools/osm_data/client.test.mjs; tools/osm_data/smoke_checks.js; docs/OSM_DATA.md; CHANGELOG.md.

**Interfaces:** Add forgetHostedFailures(url): void, resetting only a manifest entry with failedAt and marking one manual retry. StaticOSM.tile(xy, {force:true}) invokes it before ready(). Existing forgetFailures/forgetWinterFailures/forgetWaterFailures/forgetLitFailures invoke it for OSM_DATA_MANIFEST; no caller signatures change. The existing request() accepts retryDown=false; only this manual manifest retry opts in. That option bypasses only down-pause dispatch gates, retaining all new-response accounting, Retry-After processing and provider rate limits. Other callers keep their existing behavior.

- [ ] Add transport regressions for failed → recovered manifests: normal reads remain cooled down; forced reads and an explicit reset recover immediately; concurrent consumers fetch one replacement; healthy manifests remain pinned. Add the browser regression inside checkStaticOSM (already called by osmdata), and observe red failures before the fix.
- [ ] Implement the shared failed-entry reset and wire the existing retry handlers. Run Node/Python data checks and focused osmdata, lit, trails, winter, water and changelog checks on the final application commit.
- [ ] Document the retry semantics and release note. Commit/push a small Fix PR for #702, request review, address findings, then merge after CI/review under the owner's authorization. No additional dataset publication is needed.
