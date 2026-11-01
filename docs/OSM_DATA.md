# Operating Finland's static OSM data

The #154 implementation builds Finland's roads and paths outside the web host
and serves complete features through a static PMTiles archive. The production
switch in `js/config.js` is empty until a real publication has passed its checks.
Merging this implementation does not deploy data, change DNS or change OVH.

See the [dependency inventory](plans/osm-data-inventory.md),
[architecture decision](plans/issue-154-static-osm.md),
[measured OVH capabilities](plans/osm-hosting-probe.md),
[Finland build and browser measurements](plans/osm-data-measurements.md), and
[build/schema reference](../tools/osm_data/README.md).

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
ways across a boundary, route memberships, IndexedDB reuse and missing offline
data. When the preview configures a real archive, it also checks that the
northern selection completes beyond the old six-round Overpass budget.
The measurement script asserts complete/stable picks in six named places.

## Prepare OVH after owner approval

The first target can be `https://ducksoft.fi/polku-osm/`; a subdomain is optional.
Neither the directory nor `data.ducksoft.fi` was created in this work. Use a
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

GitHub makes this new manual workflow available once its file is on the default
branch ([workflow_dispatch documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)).
Before merging, an approved first publication can use the same builder and
`publish.py` locally from this branch, with the protected credentials supplied
to that process. It still uses verified automated transfers, not manual uploads.

If the deployment environment permits only `main`, merge the SFTP fix
with `OSM_PUBLISH_ENABLED` unset and the app's source setting empty. Add the
verified `OSM_SFTP_HOST_KEY_SHA256` environment secret. Then run
**Finland OSM data → verify-access** first. This protected operation checks pinned-host-key SFTP
login and directory listing, and reports the public manifest's HTTP/CORS status.
It writes no hosting files and does not prove upload, Range or rename capability.
The default manual operation is this read-only check; full publication stays gated.

Run **Finland OSM data → test-host** first. This writes only tiny disposable files into a unique `host-test-*` subdirectory of `polku-osm`, checks SFTP upload/readback, POSIX rename-over-existing, directory rename and public HTTP Range/CORS/cache, then removes its test folder. It never touches the real `current.json`, and it works without enabling publication.

Run **Actions → Finland OSM data → build**. Weekly builds are scheduled Monday
at 03:17 UTC. Build checks, transformation, gzip validation, country count and
extent gates, and full-country browser checks all run before publication.
The source must be at most 14 days old. The workflow retains source and release
artifacts for 14 days and rollback pointers for 90 days; GitHub artifact quota
must accommodate these. Preserve the source artifact outside GitHub if a
particular historical snapshot must remain reproducible after that retention.

With publication enabled, the publisher first checks every local file's SHA-256
and size. It uploads into a unique staging directory, reads every file back
through encrypted SFTP to verify its entire hash, then renames the directory to
`releases/<release>/`. Release IDs include both source and archive digests, so
changed extraction code can publish the same upstream snapshot safely.

Before switching `current.json`, it checks the public immutable manifest and
exact bytes at the archive's beginning, middle and end, plus 2/4 GiB offsets
when applicable. Checks require correct 206/Content-Range/length, CORS, MIME,
cache headers and no HTTP compression under both identity and browser-like
Accept-Encoding. The current measured Finland archive is below 1 GiB, so
larger-file capabilities remain unverified.

Only then is a temporary pointer renamed over `current.json`. The old pointer
is retained as a rollback artifact. A failed post-switch check attempts to
restore it; failure of that restoration is reported explicitly. Interrupted
uploads and failed probes leave the previous pointer and release untouched.
Staging and orphan releases are retained for inspection, never deleted blindly.

After live publication and browser verification from `https://polku.si`, set
`OSM_DATA_MANIFEST` in `js/config.js` to the verified absolute `current.json`
URL in a small activation PR. This initial PR leaves it empty. With a static
source configured, migrated road/path requests never fall back to public
Overpass; failure keeps the existing card's unavailable-data message. Other
Overpass consumers still use their current sources.

Readers pin a release for a page session. Full ways, tags and ordered node IDs
stay intact in the archive; the existing card adapter keeps its displayed tag
subset and coordinate precision. Static selection allows 64 loading rounds
(Overpass keeps six) and retains the existing 25 km, junction, name and route
rules. A selection hitting a limit or failed tile keeps the existing incomplete
selection message. Unnamed paths can still be short; #676's rule decision is
separate. Data changes neither route calculation nor basemap rendering.

## Monitoring, rollback and retention

The workflow checks the public manifest and Range access daily at 07:17 UTC
after publication is enabled. Source age over 14 days, changed manifests and
broken browser headers fail the job. A failed weekly build also fails its run
without publishing. Enable GitHub Actions failure notifications for the owner;
the implementation does not send email or create a separate notification
service. Inspect the run summary and uploaded browser evidence.

Run the **rollback** workflow with an existing release ID. It retrieves the
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
The measured archive uses about 0.68 GB per release; current + previous + next
use about 2.04 GB before source backups and other files. The reported 97 GB
free is owner-provided, not a verified account quota. Monitor actual storage,
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
