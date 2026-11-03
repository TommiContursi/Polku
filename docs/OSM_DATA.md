# Operating static OSM data

The #154 pipeline builds roads, paths, lighting and existing outdoor details outside the
web host and serves complete features through static PMTiles archives. The app source
is selected by `OSM_DATA_MANIFEST` in `js/config.js`. Data publication is separate
from app activation; changing the app URL does not upload data or change OVH.

See the [dependency inventory](plans/osm-data-inventory.md),
[architecture decision](plans/issue-154-static-osm.md),
[measured OVH capabilities](plans/osm-hosting-probe.md),
[Finland build and browser measurements](plans/osm-data-measurements.md), and
[build/schema reference](../tools/osm_data/README.md).

## Published release, verified 2026-11-03

Release `20261101T212136Z-four-d5f8341920573573` is live at ducksoft.fi, with
all seven products in Finland, Sweden, Norway and Estonia (28 archives,
11,224,332,376 bytes). Source epoch: 2026-11-01T21:21:36Z. Actual extract
polygons determine coverage; uncertain coarse border tiles retain fallback.

[Publication 41536808345](https://github.com/TommiContursi/Polku/actions/runs/41536808345)
verified all remote hashes and public archive Range/CORS/cache headers before
and after atomic promotion, completing 2026-11-02 at 23:22 UTC (2026-11-03 at
01:22 Helsinki time). The 59 min 32 s job fits the existing 90-minute budget;
upload took 25 min 7.9 s and full readback 20 min 15.8 s. Production ranges
above 2 GiB passed. Every archive is below 4 GiB, so that capability remains
unmeasured. The previous pointer and release files are retained.

The refreshed hosting dashboard showed 4.5 GB used of 100 GB, about 95.5 GB
available, immediately before publication. Independent
[monitor 41577858145](https://github.com/TommiContursi/Polku/actions/runs/41577858145)
passed on 2026-11-03 at 04:24 UTC. Live polku.si browser measurements passed
32 covered desktop/phone-emulated consumer cases with zero Overpass requests,
zero repeat downloads and zero extra selected-way tag requests. See the
[compact live receipt](measurements/osm-live-2026-11-03.json).

Scheduled publication remains disabled (`OSM_PUBLISH_ENABLED` unset). No
hosting settings or secrets changed. This immutable release is already
published: do not upload it again. Future snapshots require review of a new
successful build, a PR updating the pinned target, and explicit manual
publication. Monitoring and protected manual rollback work with that flag off.

## Build and preview

Use Python 3.14.3 with `tools/osm_data/requirements.txt`. There is no new app
build step. A Linux GitHub runner or an ordinary development computer builds
the data; no process runs on OVH. Keep source, temporary staging and output
outside Git history (`osm-build/` is ignored).

```sh
python3.14 -m venv osm-build/venv
osm-build/venv/bin/pip install -r tools/osm_data/requirements.txt
curl --fail --location --retry 3 https://download.geofabrik.de/europe/finland-latest.osm.pbf -o osm-build/finland.osm.pbf
curl --fail --location --retry 3 https://download.geofabrik.de/europe/finland-latest.osm.pbf.md5 -o osm-build/finland.osm.pbf.md5
osm-build/venv/bin/python tools/osm_data/builder.py osm-build/finland.osm.pbf osm-build/release --md5 osm-build/finland.osm.pbf.md5
osm-build/venv/bin/python tools/osm_data/preview.py --release osm-build/release --port 8796
```

Open `http://127.0.0.1:8796/`. The preview substitutes the data URL in its HTTP
response only; the checked-in production setting stays unchanged. Its data
path supports Range and CORS. For a browser check, use the normal smoke tool:

```sh
POLKU_URL=http://127.0.0.1:8796/ python tools/smoke.py osmdata pickcard facts
POLKU_URL=http://127.0.0.1:8796/ python tools/osm_data/measure_browser.py > osm-build/browser-measurements.json
```

`osmdata` checks exact archive decoding, concurrent/repeated reads, complete
ways across a boundary, route memberships, coverage in nearby countries,
host failure/fallback, the six-round public growth budget, lighting meanings,
IndexedDB reuse and missing offline data. The real-archive check also exercises
a long northern selection.
The measurement script asserts complete/stable picks; `--country all` covers 16 locations in desktop and phone-emulated profiles plus border controls. Set `POLKU_URL=https://polku.si/` to measure the actual deployed site instead of a preview.

## Host configuration

The existing target is `https://ducksoft.fi/polku-osm/`. No setup change is
needed for this release. For a new deployment, obtain owner approval and use a
dedicated directory and an FTP account restricted to it. Keep the existing
website's files and configuration out of this account's reach. Confirm that
the account's current terms allow a public Polku data service and its traffic;
free storage alone does not establish that permission.

The owner must approve and install the sample
[`hosting.htaccess`](../tools/osm_data/hosting.htaccess) in that dedicated
directory, or configure equivalent headers through OVH. It disables directory
listing and HTTP gzip/Brotli for archives, sets MIME types, wildcard read-only
CORS and exposed Range headers, immutable release caching and revalidated
`current.json`. It is never uploaded by the publisher. PMTiles' internal gzip
compression stays enabled. Check the actual CDN as well as Apache.

Before enabling publication, verify SFTP on port 22 with the OVH server's
independently authenticated SSH host-key SHA256 fingerprint pinned in GitHub,
sufficient quota, directory rename, and POSIX atomic rename-over-existing-file.
Never trust a fingerprint based only on an unauthenticated ssh-keyscan result. Use disposable files in the dedicated
directory to establish the last capability; a sequential successful rename
alone does not prove atomicity. The publisher requires the operator's approval
and never deletes a live pointer to emulate an overwrite.

Create a GitHub environment named `osm-data-production`, restricted to the
approved branch, with deployment review protection where supported. Add these
environment secrets through GitHub's secret UI, never in source or chat:

| Secret | Value |
| --- | --- |
| `OSM_FTP_HOST` | OVH's FTP/SFTP hostname (existing secret name retained), without a scheme or port |
| `OSM_FTP_USER` | The dedicated FTP account |
| `OSM_FTP_PASSWORD` | Its password (reused for SFTP) |
| `OSM_SFTP_HOST_KEY_SHA256` | Independently verified SSH host-key fingerprint, `SHA256:...` (not the output of an unverified scan alone) |

Repository variables (the monitor needs the public URL outside the deployment
environment) are:

| Variable | Value |
| --- | --- |
| `OSM_FTP_ROOT` | Absolute FTP path ending in `/polku-osm` |
| `OSM_PUBLIC_URL` | HTTPS base URL, without a trailing slash |
| `OSM_PUBLISH_ENABLED` | Leave unset until setup is approved and atomic replacement verified; then `true` |

`OSM_ALLOW_PUBLISH=true` is supplied only by the guarded deployment jobs; for
an approved local operation set it explicitly. No secrets, variables or
environments were changed by this implementation.

## Publication and activation

The historical first release was published successfully in
[run 41387631098](https://github.com/TommiContursi/Polku/actions/runs/41387631098)
on 2026-11-02, reusing the complete stage left by the timed-out first attempt.
Full remote hashes, public probes and atomic pointer promotion passed; the
archive was not uploaded again. The existing
[monitor](https://github.com/TommiContursi/Polku/actions/runs/41388087711) passed.
See the [live measurements](plans/osm-data-measurements.md#live-ovh-verification-2026-11-02)
for that earlier release. App activation is already on main; do not republish an immutable release.

The protected **publish-existing** operation on `main` currently downloads the already-published, reviewed successful
`nordic-osm-release` from pinned successful run `41509553858`, checks local and remote
hashes, tests public Range/CORS and switches `current.json` only after
verification. It does not rebuild or enable unattended publication. Artifacts
expire after 14 days. While `OSM_PUBLISH_ENABLED` remains off, weekly builds
produce candidate artifacts only: review a successful fresh build and update
the pinned artifact run ID through a PR before manually publishing that next
release. The protected environment still applies; app activation is separate.

If this operation is interrupted, do not start another full upload. Run
**inspect-existing** on `main` first: it downloads the same artifact and reports
the exact release's staging/final file sizes without changing the host. Metadata
alone does not prove integrity. Then **resume-existing** reuses the immutable
release if already renamed, or requires exactly one matching staging directory.
It rejects symlinks, unexpected files, oversized files and mismatching partial
prefixes. Complete files are not uploaded again; partial files are read and
compared with the local artifact before only their missing suffix is sent.
Every file still passes full remote SHA-256 verification before rename, public
probes and pointer promotion. A corrupt complete file or ambiguous staging
fails for inspection instead of silently overwriting data or starting over.
Neither recovery operation deletes files or changes hosting configuration.

SFTP writes are pipelined and reads prefetch at most 64 concurrent requests,
avoiding a network round trip for every 32 KiB packet. Logs show transfer
phases and byte progress every 64 MiB; the 90-minute job limit is unchanged.


All production write operations run on `main` through the protected
`osm-data-production` environment. For a changed credential or host,
**verify-access** checks pinned-host-key SFTP login, directory listing and public
manifest HTTP/CORS without writing files. It does not prove upload, Range or
rename capability. The default manual operation is a read-only check.

Run **Polku OSM data → test-host** first. This writes only tiny disposable files into a unique `host-test-*` subdirectory of `polku-osm`, checks SFTP upload/readback, POSIX rename-over-existing, directory rename and public HTTP Range/CORS/cache, then removes its test folder. It never touches the real `current.json`, and it works without enabling publication.

Run **Actions → Polku OSM data → build**. Weekly builds are scheduled Monday
at 03:17 UTC. Build checks, transformation, gzip validation, country count and
extent gates, and full-country browser checks all run before publication.
The source must be at most 14 days old. The workflow retains source and release
artifacts for 14 days and rollback pointers for 90 days; GitHub artifact quota
must accommodate these. Preserve the source artifact outside GitHub if a
particular historical snapshot must remain reproducible after that retention.

For an authorized manual or enabled scheduled publication, the publisher first checks every local file's SHA-256
and size. It uploads into a unique staging directory, reads every file back
through encrypted SFTP to verify its entire hash, then renames the directory to
`releases/<release>/`. Release IDs include the source digest and a digest of all
dataset records and coverage, so
changed extraction code can publish the same upstream snapshot safely.

Before switching `current.json`, it checks the public immutable manifest and
exact bytes at the archive's beginning, middle and end, plus 2/4 GiB offsets
when applicable. Checks require correct 206/Content-Range/length, CORS, MIME,
cache headers and no HTTP compression under both identity and browser-like
Accept-Encoding. Current production archives reach 3.38 GB, and their >2 GiB
probes passed. No current archive reaches 4 GiB; retain those probes for future files.

Only then is a temporary pointer renamed over `current.json`. The old pointer
is retained as a rollback artifact. A failed post-switch check attempts to
restore it; failure of that restoration is reported explicitly. Interrupted
uploads and failed probes leave the previous pointer and release untouched.
Staging and orphan releases are retained for inspection, never deleted blindly.

`OSM_DATA_MANIFEST` in `js/config.js` already points to the verified absolute
`current.json` URL. App activation and data publication remain separate operations.
All supported consumers prefer valid hosted cache, then covered hosted tiles,
then cached Overpass/mirror fallback for unavailable or uncovered data. All four
addresses stay configured; Kumi and Private Coffee advertise the same service,
so a bounded round does not query that service twice. If both sources fail,
the existing unavailable-data message remains. Area selection, unsupported
classes and ambiguous nearby relations retain bounded public queries.

Full-country manifests embed each dataset's attributed Geofabrik clipping
polygon, not just its rectangular extent. An uncached tile must fit wholly
inside one extract; tiles requiring an unproven union use Overpass. The historical
Finland-only manifest also uses `data/finland-coverage.geojson`. Cached tiles can be
used without loading that asset offline. A valid covered empty tile does not
trigger an Overpass query.

Readers pin a release for a page session. Full ways, tags and ordered node IDs
stay intact in the archive; the existing card adapter keeps its displayed tag
subset and coordinate precision. Static selection allows 64 loading rounds
(a selection using Overpass keeps six) and retains the existing 25 km, junction, name and route
rules. A selection hitting a limit or failed tile keeps the existing incomplete
selection message. Unnamed paths can still be short; #676's rule decision is
separate. Data changes neither route calculation nor basemap rendering.

## Monitoring, rollback and retention

The workflow checks the public manifest and Range access daily at 07:17 UTC
when `OSM_PUBLIC_URL` is configured, independently of unattended publication.
Source age over 14 days, changed manifests and
broken browser headers fail the job. A failed weekly build also fails its run
without publishing. Enable GitHub Actions failure notifications for the owner;
the implementation does not send email or create a separate notification
service. Inspect the run summary and uploaded browser evidence.

The manual **check** operation also works while unattended publication is off.
It needs only Python's standard library. It rejects a `current.json` response
that is immutable or can remain fresh without revalidation; release files keep
their immutable caching policy.

Run the protected **rollback** workflow on `main` with an existing release ID.
This explicit operation works while `OSM_PUBLISH_ENABLED` is unset or false;
it does not enable scheduled publication. It retrieves the
immutable manifest, verifies the existing files through SFTP and public HTTP,
and switches the pointer through the same guarded path. It does not rebuild or
overwrite release files. The equivalent approved local commands are:

```sh
python tools/osm_data/publish.py publish osm-build/release
python tools/osm_data/publish.py rollback --manifest osm-build/release/rollback-UUID.json
python tools/osm_data/publish.py check https://ducksoft.fi/polku-osm/current.json
```

Keep the current release, its predecessor and at least four weeks of releases
for cached clients. There is no automatic deletion or website-wide cleanup.
The original ways-only archive used about 0.68 GB. Expanded country products
require the current candidate measurements below; do not budget from that old
number. Current + previous + next must all fit before promotion. The verified
pre-publication dashboard had about 95.5 GB available of 100 GB. Recheck capacity
for future releases; the receipt is not a live quota monitor. Monitor actual storage,
traffic and artifact costs; an upload that exhausts quota fails before promotion.

Tiles already fetched are stored under the immutable release URL in IndexedDB
and reused offline where storage remains available. There is no automatic
country download and no addition to **Save offline** in this PR. Missing tiles
offline fail visibly. Cached manifests can allow older data during an outage;
the public monitor establishes freshness, not the age of an offline copy.

The data host sees the requested release and approximate selected area through
byte ranges, along with ordinary HTTP connection information. Set the host's
access-log retention to the shortest operationally necessary period before
activation; its actual logging configuration has not been inspected. No
background position stream or location history is added.

## Licensing

Each release includes OSM attribution and the ODbL link in `LICENSE.txt`, the
manifest and archive metadata. Redistribute the derived database under ODbL,
retain source identification and attribution, and provide the database as
required. Polku's source-code licence remains separate. The map already credits
OSM; Geofabrik is recorded as the extract provider. Build dependencies and the
browser reader keep their own notices in `THIRD_PARTY_NOTICES.md`.

## Expanded detail/check datasets

The builder also emits `trails.pmtiles` (z13), `winter.pmtiles` (z12), `hazards.pmtiles` (z11) and `places.pmtiles` (z12), with all original tags and complete ways. Gates/fords and other supported point obstacles survive independently of highways. Overnight relation centres require complete referenced member bounds; an incomplete relation fails the build instead of becoming an empty search. Empty products have one empty sentinel tile because the existing PMTiles writer requires an entry; missing tiles within declared coverage are valid empty results.

These products are now published in all four countries and use the shared reader. Clients also tolerate older manifests lacking optional products, falling back to existing sources. The migration plan records the independently testable extraction, inspection and country rollout PRs. Whole hosted operations stop after eight seconds; fallback uses one bounded public-provider round. Existing lighting semantics and the manual publisher/rollback/monitor remain.

Failed manifest reads cool down for 120 seconds during normal/background use.
An explicit path or trail/winter/water/lighting retry resets only that failed
entry and shares one new manifest attempt, bypassing a network-down pause while
honoring provider rate limits. Healthy pinned releases and cached tiles remain.

## Full-tag inspection and area follow-up

`inspection.pmtiles` (z14) includes all highways, existing point/place tag classes and supported detail objects, retaining original tags and way geometry. Complete referenced relation bounds supply centres; original member identities and roles remain. Incomplete generic relations retain exact tags but set dataset `nearby_complete:false`, so nearby queries fall back rather than claiming completeness. A relation centre alone cannot prove its members are within a 40 m search; an ambiguous closer relation uses the public query. Exact selected ways can already reuse the published ways product.

Area selection remains on one 15-second public round. Its different data representation is tracked in [#696](https://github.com/TommiContursi/Polku/issues/696). The actual Finland geometry probe is in `docs/measurements/osm-areas-2026-11-02.json`: Saimaa's compact geometry alone is 4.67 MB gzip and has 654,393 points. Correct local transfers require clipped containment and nearby original outlines, with holes and incomplete relation geometry preserved. Whole-polygon repetition is not being shipped as a substitute.


## Four-country rollout and limits

The country matrix builds Finland, Sweden, Norway and Estonia separately on
standard public `ubuntu-24.04` runners (4 CPU, 16 GB RAM, 14 GB SSD;
[GitHub runner documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job)).
No paid larger runner or account setting is introduced. The 120-minute country
and 30-minute bundle deadlines, archive size guards, full hash validation and
browser checks must pass before treating four-country coverage as available.
CI logs record free disk; staging allocation and peak RSS are also in measurements.
Actual uploads and the publication fit the configured limits; artifact account allowance and future OVH free space remain operator checks.
14-day source/country/bundle retention duplicates some bytes deliberately for
reproducibility; daily monitoring does not rebuild or upload these artifacts.

The workflow first chooses one completed dated Geofabrik export shared by all
four countries. Country sources must have identical replication timestamps.
Their actual clipping polygons and hashes are retained; overlapping original
objects are compared by type/ID and canonical content. A conflict fails assembly.
Country archives preserve whole ways and original relation references, while
browser reads remain local Range requests. Assembly hard-links the country
files on one filesystem and adds a manifest; it does not duplicate country data
inside a shared archive. Finland's original dataset names/root coverage remain
compatible with old clients. Each added record identifies its country, kind,
coverage and source timestamp. A tile requiring a union of border polygons
conservatively falls back, rather than promising coverage from a rectangle.

After a complete candidate exists, `verify-candidate` with its numeric build run
ID in `release` reuses `nordic-osm-release` without rebuilding or publishing.
It checks file hashes and required road samples in every country, then current
consumers in all four countries, cached selected-way
tags, real border tiles and an outside-coverage control. Every normal covered OSM
consumer forbids Overpass; independent LIPAS/Väylä requests are excluded from these
OSM measurements. The small `osm-candidate-verification` artifact records the
named sample counts and desktop/phone-emulated results. This read-only job has no production environment
or credentials and cannot promote a pointer.

Release order: #695 added detailed products/consumers, #697 full-tag objects,
and #698 the complete country build/reader. Each worked with the old manifest.
All are merged. The owner authorized publication of the reviewed successful
41509553858 / `nordic-osm-release`; protected run 41536808345 completed it.
Existing atomic promotion, full SFTP readback, Range probes, rollback pointers
and daily monitoring remain. #701 makes manual rollback independent of the
scheduled-publication flag; #703 repairs explicit retry after manifest failure.

Before any next publication, review the new candidate's country/resource and
consumer evidence, check current + previous + next storage, and compare transfer
time with the protected 90-minute budget. After promotion, re-read the live
pointer and exercise actual consumers and monitoring. Client support and
candidate artifacts alone do not prove publication.


## Completed candidate evidence, 2026-11-02

Build 41509553858 and final consumer verification 41525059421 passed. Candidate
`20261101T212136Z-four-d5f8341920573573` has 28 products / 11,224,332,376 archive
bytes. The common source epoch is 2026-11-01T21:21:36Z; 142,922 duplicate copies
among 20,766,245 unique represented objects match their original content.
`docs/measurements/osm-four-country-2026-11-02.json` records source hashes,
archive sizes, tile distributions, complete OS time/RSS and browser transfers.

The original candidate predates the repaired named-sample gate and contains empty
sample measurements. Independent verification 41533288819 passed the fixed archive
checks and all 14 required road samples across the four countries, then repeated
32 covered desktop/phone-emulated consumer cases and border controls. Every
required sample has roads; normal consumers made zero Overpass or extra selected-way
tag requests. The two gate regressions also run through `tools/smoke.py osmdata`.
The candidate archives and hashes remain unchanged.

Complete country times were FI 52.53, SE 60.50, NO 84.20 and EE 6.41 minutes.
Maximum process RSS was 6.64 GB; maximum allocated staging at archive completion
was 18.17 GB. Actual standard runners had 85 GB free. Since this exceeds the
nominal documented 14 GB disk allowance, all full country/assembly/verification
jobs require 25 GiB free before downloading. No larger paid runner is configured.
The earlier candidate's internal FI/SE memory counter preceded final validation;
the committed report uses complete OS measurements, and the counter is corrected.

The immutable combined ZIP is 11,224,486,691 bytes (artifact 13178219451, expires
2026-11-16T21:03:12Z). One full download took 8 min 24 s. Current consumers passed
32 covered desktop/phone-emulated cases with zero Overpass; selected-way tags
added zero network. Large-offset client/preview reads reached byte 3,298,798,068.
The largest PMTiles archive is 3.38 GB. Production >2 GiB Range probes, full
SFTP publication/readback and actual OVH preflight have since passed; see the
published-release receipt above. Three full releases use 33.67 GB;
five use 56.12 GB, or 67.35 GB with a sixth candidate, excluding other files.
Existing manual retention and rollback rules remain; no automatic deletion.

Border probes deliberately preserve coverage fallback: Tornio/Haparanda,
Svinesund and Narva serve z14 ways/inspection but fall back for coarser products;
Kilpisjärvi falls back for z11 hazards. A correct joint-coverage proof and local
merge are the measured follow-up #699. These limits must not be reported as a
host outage or a complete empty result. The outside control fails coverage for
all products. Missing country metadata is rejected rather than inheriting another
country's footprint. Area/ambiguous nearby-relation geometry remains #696.

The promoted live manifest and independent monitor now confirm all four-country
products. Live consumer measurements are separate from the CI preview timings
above. Physical phones, an actual production rollback and the whole local app
suite were not exercised; focused failure/rollback checks passed. A sporadic
pre-CSS test setup warning is tracked in #704, with no product failure reproduced.
