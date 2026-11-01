# Finland OSM measurements, 2026-11-01

These are actual full-country builds and browser measurements, not regional
extrapolations. [Raw results](../measurements/osm-data-2026-11-01.json) include
checksums, sample coordinates, request ranges, browser version and outcomes.
No dataset has been deployed to OVH; localhost timings do not establish OVH
throughput or latency.

## Full Finland build

The Geofabrik source contains OSM data through 2026-10-31T21:23:06Z. Its size
is 774,468,258 bytes (738.6 MiB), SHA-256
`6e4ba0730c8fa4f71c35aa91a5cb3b9ce7f163daa84d886cd94f9b522dd3f80f`.
The builder inspected 101,413,767 nodes, 10,276,937 ways and 158,018 relations.
It retained 2,214,266 eligible ways, 24,489,366 ordered node references and
5,916 relevant route/restriction relations.

The first build took 425.093 seconds with peak RSS 1,927,020,544 bytes on an
Apple silicon Mac. Source + sparse node index + SQLite staging occupied about
3.1 GiB during an observed staging point; this is an observation, not the
maximum temporary-space requirement. Run logs and source remain in the local
workspace. The optional `/usr/bin/time -l` wrapper returned a sandbox sysctl
error after the builder completed; the duration/RSS above are the builder's
own measurements, not an asserted successful timing-wrapper exit.

A second complete build with the final release naming took 460.829 seconds.
Its archive SHA-256 is identical to the first build:
`11398e5b9ab9ccfa2ee7fd553345385bed3dfc8a248ecaff72cae163243b0b3e`.
This checks reproducibility across two full builds, in addition to the small
fixture test. The final release ID is
`20261031T212306Z-6e4ba0730c8f-11398e5b9ab9`.

| Representation | Data bytes | Files | Selection data |
| --- | ---: | ---: | --- |
| PMTiles JSON, complete ways | 679,838,796 | 1 archive | Original coordinates, nodes, tags and memberships |
| Individual gzip JSON tiles | 714,567,087 | 233,335 | Exactly the same compressed tile payloads |
| Ordinary MVT display tiles | Not built or measured | Not measured | A sole MVT store loses the complete geometry/topology needed here |

The individual-file alternative is measured by summing the actual generated
payloads, not by extrapolation. PMTiles reduces payload duplication through
archive deduplication and avoids 233,335 file uploads per release. Whole ways
appear in 2,912,668 tile references: 1.3154 copies per retained way. This cost
preserves uncut geometry and node IDs; no additional simplification is applied.

| Compressed tile size | Bytes |
| --- | ---: |
| Median | 2,097 |
| 95th percentile | 7,714 |
| 99th percentile | 17,115 |
| Maximum, Helsinki z14/9326/4742 | 310,682 |

The largest decoded JSON tile is 1,859,560 bytes. An isolated tile also needs
archive header/directory bytes on a cold reader. Current + previous + next
archives require about 2.04 GB, plus small metadata and any source backups.
OVH's account quota, file limits, throughput and bandwidth allowance remain
unverified; see the [host probe](osm-hosting-probe.md).

## Browser selection

Chrome 156.0.8078.74, desktop 1440 × 900 and a 390 × 844 mobile viewport.
The latter emulates a 4× slower CPU, 80 ms network latency and 10 Mbit/s download;
it is not a physical phone. Both cases start with cleared IndexedDB and browser
Cache Storage. Cases then share a page/reader, so the first area's selection
includes cold manifest/header/directory reads; later areas reuse directories.
The displayed byte counts are actual data response bytes, excluding app modules,
basemap, terrain, weather and protocol overhead. Timing covers way tile load,
nearest feature and complete joining, not DEM/weather completion or map paint.
Other map fetches and the repeated build were running on the same computer, so
these measurements are observations under local contention, not capacity promises.
The benchmark selects a fixed point on the initial nearby way for repeat tests.

| Area | Desktop first selection, ms | Emulated phone, ms | Data requests | Data bytes | Selected length, m |
| --- | ---: | ---: | ---: | ---: | ---: |
| Helsinki | 206.7 | 1570.3 | 5 | 630,363 | 383 |
| Rural central Finland | 15.3 | 205.0 | 2 | 13,708 | 299 |
| Nuuksio forest | 23.3 | 299.6 | 3 | 25,304 | 89 |
| Turku coast | 33.8 | 391.9 | 2 | 145,138 | 130 |
| Kilpisjarvi north | 93.4 | 1818.1 | 20 | 110,038 | 20735 |
| Tykkikallio Jyvaskyla | 12.8 | 192.9 | 1 | 68,119 | 23 |

Every repeated selection used zero data requests. Desktop repeats were at most
2.0 ms; the emulated phone's at most 6.6 ms. These cached timings are within the
browser timer's precision. Five source sample tiles independently cover dense
urban, rural, forest, coast and remote north; Jyväskylä additionally exercises
the area reported in #675/#676. All measured final picks ended on known data.
The longest observed pick was 20.74 km and used 110,038 bytes in 20 requests.
The largest observed selection transfer was 630,363 bytes in Helsinki; this
is an observed maximum across these cases, not a whole-country upper bound.
The bounded static walker can request up to 129 tiles (initial plus two ends
for 64 rounds). Using the measured largest tile for every request gives a
conservative payload bound around 40.1 MB plus directories; that scenario was
not observed. The normal selection still stops at 25 km, junctions, changed
names/references or loops, and says when a tile or growth budget is missing.

A final run on app commit `65b01ce` also passed all six selections and emitted
valid JSON: desktop 13.1–167.8 ms and emulated phone 198.2–1,966.5 ms. Its
complete request/selection results are retained as `final_browser` in the raw
evidence. This is a repeat observation, not a revised hosting claim.

The full-country check exposed a real truncation: the old six growth rounds
stopped the northern pick at 16.66 km with both ends unloaded, and another tap
extended it to 20.74 km. The new static-only budget completes it in one pick.
The `osmdata` smoke check failed before that change at both sizes and passed
afterwards. Public Overpass keeps its existing six-round budget. Unnamed-path
joining rules are unchanged; short mapped paths are not claimed fixed (#676).

A visible-browser click on Tykkikalliontie also opened its 173 m card immediately
from the archive, retaining cycling, surface, lighting, speed and terrain facts.
This was on the local preview, not an assertion about ducksoft.fi performance.

## Legacy comparison

One matching legacy z14 query in Jyväskylä, through the existing `overpass()`
mirror race and its 40-second per-mirror timeout, failed after 80,009.4 ms on
2026-11-01. The exact query, tile and error are in the raw results. The static
reader fetched that area's new tile in one request (68,119 bytes); geometry
selection measured 12.8 ms locally and 192.9 ms in the emulated phone case.
This compares the data paths for the same tile, not a production-network
speedup guarantee. No routing service was called for the measurements.

## Remaining verification

Live FTPS, rename atomicity, archive-path CORS/cache/compression, OVH large-file
serving and end-user latency need an approved deployment. Real iPhone/Android
performance and full-country bulk offline download were not tested. The latter
is not implemented: cached tiles are reused, while Save offline remains its
existing map/terrain/route operation. No whole local smoke suite was run.
