# OSM weekly update recovery

> Execute in the existing recovery checkout with Superpowers executing-plans and verify the live pointer after promotion.

**Goal.** Restore unattended updates for the 28 published country archives while #696's optional geometry build is measured and repaired.

The November 9 build failed on the large water-box smoke expectation after #897 split skipped checks from missing replies. The November 4 geometry run reached 2,174,000 of 8,187,243 roots at the 240-minute limit. The daily check on November 9 verified the previous live release.

1. In `tools/osm_data/smoke_checks.js`, reproduce the oversize-water failure with `tools/smoke.py osmdata`. Require the oversized box to report OpenStreetMap as skipped, with no OSM hazard read, and the small hosted lookup to report neither missing nor skipped. Run both browser sizes.
2. In `.github/workflows/osm-data.yml`, run geometry only when a main `geometry-candidate` dispatch selects a trusted country build in `release`. The weekly bundle requires all four successful country jobs. A geometry dispatch requires successful geometry and cannot promote the pointer. Check both paths and rejection on failure or cancellation in `tools/osm_data/test_publish.py`.
3. In `tools/osm_data/publish.py`, reject a candidate without geometry if the current pointer already has it, before any maintenance or upload. Explicit rollback retains its existing contract. Add a failing test for ordinary and resumed publication before writing the guard.
4. Update `docs/OSM_DATA.md`. Run Python OSM tests, Node client tests and scoped smoke on the committed head. Merge the focused fix, run a normal main build and verify the actual publication and alert closure.
5. Separately rebase #778 and measure geometry generation against the recorded bottleneck before another full run. Retain source identities, geometry completeness, local reads and the existing mirror round. Keep the area consumers behind actual archive and browser acceptance in all four countries.
