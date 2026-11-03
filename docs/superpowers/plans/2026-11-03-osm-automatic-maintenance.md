# Automatic OSM maintenance implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. The owner requested completing significant operational gaps now and already authorizes merges/publication. No further approval is needed for the specified existing-service automation.

**Goal:** Weekly four-country OSM updates reach production without a human reviewing every snapshot; failures and recovery reach the owner's GitHub inbox, and retained files stay within existing storage.

**Architecture:** Reuse complete country builds, positive sample/browser gates, guarded SFTP publisher and atomic rollback. Add publisher-owned maintenance metadata; delete only recognized old files within the dedicated root. A separate trusted-main GitHub workflow reports update/health outcomes and tests delivery. No delta processing or new provider.

**Tech stack:** Existing Python 3.14.3 standard library/Paramiko, GitHub Actions and OVH 100 GB hosting.

**Spec:** #706; weekly unattended operation, safe retention and tested alert delivery requested after #154's live migration. No app-consumer/lighting/area/border redesign.

## Constraints and decisions

- Current and predecessor releases are protected regardless of age. Keep at least the latest two recorded releases and all successful publications younger than 28 days.
- Delete only releases bearing valid publisher receipts matching their immutable manifest. Pre-upgrade unmarked files/releases are retained. Interrupted managed root staging can expire after 7 days; unrecorded final releases need 35 days. Unknown files, symlinks, unsafe paths or changed live pointers never authorize deletion.
- Preview deletion plans without writes; validate the whole plan before applying. Publisher verifies local input before cleanup. A conservative 80 GiB dedicated-root byte budget includes retained/unmanaged files and the incoming release; overflow fails before upload, with old live data retained.
- Preserve full SFTP readback, HTTP probes, original source/coverage checks, main-only environment, concurrency serialization, previous-pointer artifacts and rollback. Add no dependencies or accounts.
- Enable OSM_PUBLISH_ENABLED only after retention and alerts are deployed/tested. The owner now authorizes automatic publication after these gates; weekly snapshots no longer need a pin PR. Manual recovery selects an exact completed trusted-main build with successful snapshot/four-country/bundle jobs and one unexpired artifact.
- Alerts are one assigned GitHub issue per failing update/health category, updated without repeated comment spam and closed on corresponding recovery. A daily healthy old release cannot close a failed-update incident. Verify an actual bot-generated test alert in the owner's notifications.
- Do not edit tools/smoke.py while #669 owns it. Retention protection is checked by the already-registered rollback round-trip; all new tests run in existing Python CI discovery.

## Review focus

- Stale current/rollback targets must survive cleanup, including a rollback to an older source.
- Unknown/partial/symlinked files and pointer changes must fail closed before deletion or publication.
- A failed or cancelled build/publish must alert; a PR/fork run must not gain issue-write privileges or trigger an incident.
- Fresh 429/rate limits and existing UI failure semantics remain untouched.
- Repeated failures must not flood notifications; recovery must match the failed category.

## PR 1: Safe retention and publication records

Files: new tools/osm_data/maintenance.py and test_maintenance.py; tools/osm_data/publish.py and test_publish.py; docs/OSM_DATA.md and this plan.

Interfaces: record_publication(ftp, manifest, raw, previous); mark_upload(ftp, stage, manifest, raw); prune(ftp, apply=False, incoming_bytes=0, now=None) -> plan with retained/deleted paths and byte totals. All paths are relative to the existing dedicated SFTP root. publish.py gains inspect-retention; its protected publication path prunes after local validation, writes upload ownership before payload, records healthy promotion and preserves resume compatibility.

- [x] Write failing tests for 28-day retention, current/predecessor/latest-two protection, missing receipts, 7-day staging expiry, bad metadata/files/symlinks, pointer races, preview/no writes and budget rejection.
- [x] Run unittest modules and capture RED. Implement the minimal metadata/pruning functions and publisher integration. Extend registered rollback protection assertions; existing publication/resume failures must remain green.
- [x] Exercise the same pruner inside test-host's disposable directory; no live pointer is modified. Add a read-only protected retention preview operation.
- [x] Run Python/Node and focused osmdata checks, lint workflow, open draft PR, review, merge and run protected test-host plus inspect-retention.

## PR 2: Automatic gates, browser monitoring and alerts

Files: .github/workflows/osm-data.yml; new .github/workflows/osm-data-alerts.yml; tools/osm_data/alerts.py and test_alerts.py; operating/developer docs and factual release note.

Interfaces: alerts.classify(event) -> category/outcome/run URL or None; alerts.update_incident(client, category, outcome, run) -> issue state. REST uses GITHUB_TOKEN, bounded requests and no token logging. Only trusted same-repository main schedule/manual runs are considered. An explicit alert-test/recovery path uses an isolated test category.

- [x] Write failing guard/incident tests: main-only enabled build, failure/cancellation, untrusted PR/fork ignored, deduplication, separate health/update recovery and API failure visibility.
- [x] Add the separate workflow_run notification workflow, minimal issue-write permissions, assigned incidents and test operation. Add real four-country browser checks to daily monitoring and post-publication; preserve diagnostic artifacts and restore the previous pointer if post-publication consumer checks fail.
- [x] Run unit/focused checks and automatic review; merge. Execute alert test and prove the owner inbox entry, then recover it. Test live daily browser/HTTP monitoring.
- [ ] Enable the publication flag and run one full main build/update through the same automatic gates. Verify promoted manifest, all four countries/consumers, retained predecessor/metadata, notification/recovery behavior and storage plan. Do not claim a scheduled trigger itself ran before its date.
- [ ] Update operating docs/report with exact run IDs, checks, current automation and remaining material limits. Close #706 and release the claim only after the real update path is verified.


Retention review checkpoint: #707 2ce6db8 now records a verified pending intent
before pointer promotion. Its registered rollback case reproduced the stale
predecessor after an interrupted rollback; preview stays read-only, applied
retention repairs the matching receipt, and same-current retry preserves the
true predecessor. 75 Python / 24 Node and focused osmdata pass. Notification
and browser-health work is stacked on that parent in codex/osm-unattended-updates.

Live acceptance checkpoint, 2026-11-03: #707 and #711 are merged. Disposable
host retention passed in 41585081185; read-only production preview 41585423587
preserved all 12,630,966,699 bytes. #726 corrected actual dynamic run-name metadata.
Bot alert #728 reached the owner's inbox and main health run 41617124899 closed
it automatically after all 32 cases and 28 archives passed. One earlier unchanged
180-second browser deadline failure is tracked separately in #727. Publication
was enabled at 10:15:25 UTC; full main update 41617739415 is in progress.

Recovery checkpoint: remove the bootstrap run pin from manual inspect/resume,
using the existing release input and tested trusted-main bundle checks. This
allows an interrupted automatic update to resume without rebuilding or a pin PR.
No consumer, extraction, publication integrity or rollback gate changes.

Measured publication-budget correction (#732): the enabled run's artifact
download exceeded 32 minutes. Previously measured upload/readback/probes plus
the unchanged browser deadline and a possible full-readback rollback need over
103 minutes. Give future automatic/manual publication 120 minutes; retain the
180-second browser deadline and independent 90-minute rollback. The current run
is unchanged. The registered publication guard must fail on the old envelopes
and pass on the new ones before review and merge.

Interrupted-publication recovery (#737): the first enabled update reached its
old 90-minute limit after pointer promotion. Its complete archives were verified
and read-only retention preserved the pending original predecessor. A registered
resume regression reproduced a fresh runner saving the current release as its
own rollback target. Reuse the validated retention predecessor, reject a
mismatched immutable manifest, and prove an actual fake-host browser-failure
rollback without payload re-upload. Run independent live health before completing
the immutable release's receipt and final publication evidence.
