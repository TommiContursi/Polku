# Recover the shared geometry build

The first complete run (41776459874) passed all four country builds. Its geometry
job spent 41m52s downloading Europe and was cancelled at the 120-minute job limit
while compiling, after removing the source PBF. No geometry artifact or new
publication exists. Current release remains the verified 28 archives.

1. Add failing tests for reusing all four successful country inputs/releases from
   a completed main OSM run, including a cancelled geometry job. Reject feature/
   foreign/unfinished runs, missing country jobs, expired or duplicate artifacts.
   Reuse the existing source-run trust checks and exact file/hash/epoch validation.
2. Let the existing `build` operation accept its existing numeric `release` input
   as the source country run. Skip snapshot/country rebuilds, derive the dated
   Europe source from verified country inputs, rebuild geometry, and bundle old
   country artifacts with the new shared archive. Preserve main-only automatic
   publication, alerts, previous release, rollback and retention gates.
3. Give geometry a bounded 240-minute budget, within the documented GitHub job
   limit, on the same standard public runner. Record phase/root/tile progress,
   elapsed time, RSS and free disk. Keep the current disk and browser-size guards.
4. Install the existing pinned builder requirements only for generic smoke jobs
   containing osmdata; Linux run 41781381125 demonstrated missing pmtiles imports.
5. Run OSM unit/reader checks and the focused osmdata group, review and merge the
   independent operational PR. Recover from 41776459874 on main. Measure actual
   complete geometry/bundle/publication before claiming four-country area support.

No new dependency, service, paid runner, country PBF download to the Mac, or
relaxation of geometry completeness/publication checks. Existing UI waits stay
at eight hosted seconds and one bounded public mirror round.
