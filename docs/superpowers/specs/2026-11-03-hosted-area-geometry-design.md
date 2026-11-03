# Local OSM area and relation geometry (#696)

The owner selected #696 after the completed #699 border reader. The existing
seven products and automatic maintenance remain live. This extends existing
lake/park/protected-area selection and nearby full-tag inspection only.

## Existing behavior and constraints

`areaAt()` selects a named area before unnamed ones, then the smallest original
bounding box. It returns original type/ID/tags, original outline runs within
approximately5km, outer runs and whether the whole area fits the query box.
The existing15s cached mirror round remains fallback. Nearby inspection needs
actual member distance within40m; a relation centre cannot prove that distance.
A source with unlocatable missing members cannot prove a complete negative.

Keep original identities, tags, node order and relation membership/roles; holes,
islands and disconnected outers; explicit source completeness versus viewport
cutting; source timestamps and attribution. No artificial tile boundary may be
drawn as shoreline. Downloads stay local. Existing way/lighting data formats,
release pins, mirrors, retention, rollback and alerts remain compatible.

## Approaches considered and technical choice

Repeating whole polygons is measured unsuitable: Saimaa alone has654393 ring
points/4.67MB gzip before topology, across1287 z12 bounding-box tiles. A full-object
lookup still makes a local click download that whole polygon. General polygon
boolean clipping would add geometry-library/invalid-ring handling and artificial
boundary bookkeeping; no new dependency has been selected or approved.

The technical choice for the measurement is local ray parity plus original
outline/member fragments, reusing osmium's existing area assembly. For each
polygon and tile, retain the inside intervals on the tile's east edge. A point's
membership is its east-edge interval parity toggled by original boundary
crossings between the point and that edge. Only original segments intersecting
the tile are needed. Holes use ring parity; independent outer polygons combine
by union. Half-open endpoint ownership is mandatory, including vertices outside
the tile sharing the query coordinate. Store full interval endpoints when
necessary so tile-edge queries match the original whole-polygon predicate.

The containment intervals are derived data and never rendered. Original
fragments preserve source way/node IDs, source member index/path/role and node
positions; clipping for the displayed query box adds no invented shoreline.
A small area's complete outline can still be assembled and reported whole.
This choice is the implementer's proposal under the owner's authorization to
make reasonable technical choices, not a newly requested product behavior.

## Data and completeness

Add one optional shared `geometry` PMTiles product covering the union of the four actual country clipping polygons. Its schema is separate
from complete-way schema1; the manifest root and seven existing products stay
schema1. Each element retains original type/ID/tags and an original-content
identity digest. Local polygons carry east-edge intervals and source segments;
member fragments retain original references, order/roles and geometry. Original
whole bounds are advertised only when proven complete. Nested relation paths
must preserve references and detect cycles rather than inventing geometry.

An invalid area whose complete member geometry has known bounds is an explicit
uncertain candidate within those bounds. Missing/unlocatable required members
must remain explicit incompleteness, including dataset-level inability to prove
negative queries if no sound local bound exists. Do not invent a bound from
only the available members. Measure actual missing-member cases before claiming
that generic nearby inspection is fully covered in any country. Exact-ID tags
and area containment have distinct completeness requirements.

Build overlap checks continue comparing original canonical identities at one
source epoch. Runtime local fragments combine only when original identity and
overlapping fragments agree; incomplete copies never overwrite proven geometry.
The existing country union proof decides source coverage; it does not repair
missing original geometry.

## Measured source completion and shared archive choice

The retained full sources were probed independently: Finland192674 areas in209.8s,
2.647GB peakRSS; Estonia39749 areas in27.4s,0.549GB. Local prototype samples were
373B for an Inarijärvi interior z13 tile,1287B for Ülemiste and3941B for Kadrioru.
These sizes retain node IDs but omit final member-path overhead; they are not
finished archive/browser-transfer claims. Full-ring and local parity agreed at
interior and tile-edge samples, including empty/island examples.

Actual sources contradict an assumption of complete cross-border relations:
the probes found8 directly incomplete selected FI relations and13 EE relations,
including protected areas beyond the four-country extracts. Assembling some
closed rings alone does not prove the original relation was complete. A partial
bound from present members cannot localize all missing geometry.

Use one shared geometry build after the four country jobs. Country jobs export
small root-ID/purpose/digest catalogs plus their existing identity evidence.
A shared job selects the same dated Geofabrik Europe source as those countries,
checks MD5/SHA256 and exact replication epoch, and uses the installed osmium
IdTracker/back-reference filtering to obtain a reference-complete subset for
those roots (preserving tags). The actual HTTP HEAD on2026-11-03 gave
35367859950B for Europe. This file is temporary CI input only, deleted after the
small complete subset is written; it is neither hosted nor downloaded by a map
consumer. Native reference completion, rather than another service/library,
also supports nested relations; any unresolved/cyclic references remain explicit.

Validate selected original objects against country identity evidence, then
compile one shared local archive with a GeometryCollection of actual country
coverage polygons. This avoids repeating reference completion and runtime
country-fragment reconciliation. New generic nearby inspection reads the same
local product for its existing tagged node/way/relation classes; exact selected
ways still reuse their original cached ways. Seven existing country products
stay intact; the extended release has29 archives. Confirm whole-build RAM/disk,
source download/processing and archive/browser transfers before publishing.

The repository is public; the existing standard GitHub runner remains free
([GitHub runner documentation](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)).
No paid runner/service/account is selected. Check real free disk before the
35.37GB temporary input; never assume the documented minimum or prior observed
85GB free is a guarantee. Geometry extraction must release that source before
allocating its subset node index. A resource failure keeps the old live release.

## Delivery and release sequence

PR1 adds the common geometry compiler/format and regression fixtures. PR2 wires
root catalogs, shared source completion/build, additive static reading and
publication checks for both the current28 and extended29 archives. PR3 integrates
area selection and nearby inspection together using that shared data, with real
consumer/failure/cache/phone-emulation measurements. No consumer duplicates
extraction or reader work. Full data publication follows candidate/browser gates
and actual deployed verification; support is never inferred from client code.

No live geometry coverage is claimed before a full synchronized four-country
build, actual resource/transfer measurements, all existing publication gates
and deployed consumer verification. New clients must work with old manifests
without geometry, and old clients with the additive manifest. The current live
release stays available throughout; failed candidate/health checks preserve or
restore the predecessor. Use the existing weekly full build/publisher/host.

## Acceptance

Saimaa, Inarijärvi, a small lake and park, islands/holes/disconnected outers,
source/tile/query-box borders, duplicate/conflicting identities, malformed or
missing members, all four target countries, valid empty answers, cache reuse,
source failure/public failure and offline reload. Normal supported complete
queries make0 Overpass requests. Measure cold/repeat bytes/latency, archive size,
complete build RSS/disk/time and publication limits before claiming support.
No router/basemap/weather/LIPAS migration or new service/dependency/account.

Primary API/source references: [osmium area geometry](https://docs.osmcode.org/pyosmium/latest/user_manual/03-Working-with-Geometries/),
[area assembly](https://docs.osmcode.org/pyosmium/latest/reference/Area/), and
[Geofabrik extraction](https://download.geofabrik.de/technical.html).
Actual source completeness and produced manifests remain authoritative.
