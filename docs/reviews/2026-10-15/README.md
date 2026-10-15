# Technical findings verified on 15 October 2026

This is a dated evidence snapshot, not a second live task list. Linked GitHub
issues hold subsequent reproduction, decisions, ownership and resolution. The
approved order of work remains in [ROADMAP](../../ROADMAP.md); recommendations
below have not changed it. No application fixes were made for this assessment.

Start with [the GitHub findings index (#63)](https://github.com/TommiContursi/Polku/issues/63)
for current work and the focused issues linked below. Active fix PRs and later
browser results belong in those issues, so this snapshot does not become a
competing account of what is currently fixed.

## Scope and baseline

Codex reviewed the implementation and project documentation, then revisited the
initial findings with local dependency mocks and controlled browser runs. The
application baseline is `87310251253f319d6efc1c91198be525591832d2` (merged #61).
The full smoke run used `85f73ca`, whose application and tests are identical to
that baseline. The earlier comparison used `a737d9d` (#60). PR #62 subsequently
merged shared agent instructions; it did not fix these findings.

Confidence describes what the evidence establishes under the stated conditions,
not the frequency of failures in real use. Module probes are not a field safety
assessment, a physical-phone test or a complete service-worker lifecycle test.

The existing static ES-module architecture fits Polku. Its module boundaries,
central API handling, routing fallbacks, local persistence, recorded routing
fixtures and documented roadmap provide useful foundations. These findings call
for focused corrections and better failure coverage; they do not demonstrate a
need for a framework, backend, build system or architectural rewrite.

## Findings at the assessment date

| Finding | Evidence and impact | Classification / confidence |
|---|---|---|
| [Back to start (#65)](https://github.com/TommiContursi/Polku/issues/65) | Real button throws `TypeError: this.loop is not a function`; constructor state shadows the method. Two route points remain two. | Confirmed defect / high |
| [Concurrent API pacing (#66)](https://github.com/TommiContursi/Polku/issues/66) | Three mocked Valhalla calls dispatch within 2.6 ms; eight BRouter calls within 1.08 ms. Sequential Valhalla control waits 1165 ms. Slots are checked before they are reserved; retry dispatch also bypasses fresh accounting. | Confirmed defect / high for one-tab concurrency |
| [Incomplete water cache (#67)](https://github.com/TommiContursi/Polku/issues/67) | An identical retry reuses the incomplete result even after the mocked hazard source recovers. Changing the key reaches complete data. The missing-source warning remains visible: the failure is recovery, not concealed completeness. | Confirmed defect / high |
| [Offline preview and recovery (#68)](https://github.com/TommiContursi/Polku/issues/68) | A missing shell module reaches the network during preview. HTTP 503 wins over a good cached module; a rejected network request correctly uses that cache. A preview can therefore overstate offline readiness, and a server error can prevent startup. | Confirmed worker-logic defects / high; full lifecycle still to test |
| [Avoid areas in links (#69)](https://github.com/TommiContursi/Polku/issues/69) | A local avoidance circle is absent from the share URL and decoded route. Local saved routes retain it. A recipient can recalculate through the excluded place. | Confirmed serialization defect / high |
| [Weather completion order (#70)](https://github.com/TommiContursi/Polku/issues/70) | On the same analysis object, the newer departure completes first, then the old response replaces its wind result (`startSec` 2 → 1 while current departure is 2). | Confirmed ordering defect / high under controlled responses; frequency unmeasured |
| [Map state affects route settings (#71)](https://github.com/TommiContursi/Polku/issues/71) | A shared Flowy MTB style becomes saved Balanced when only map sport changes to Paddle. The route remains MTB but its routing key changes. Safety also takes map activity and a map-center Finland gate; that broader effect needs integration tests. | Confirmed style defect / high; broader safety impact remains a risk |
| [Missing terrain (#72)](https://github.com/TommiContursi/Polku/issues/72) | Rejected terrain requests yield NaN hiking time, infinite elevation bounds and zero ascent for a 124 m route. Failed DEM loads remain cached without a retry lifetime. | Confirmed calculation defect / high |
| [Magnification (#73)](https://github.com/TommiContursi/Polku/issues/73) | Restrictive viewport attributes and prevented Ctrl-wheel are confirmed. A synthetic event does not establish what every real browser permits. | Accessibility concern / high for policy, platform impact unverified |
| [Smoke synchronization (#74)](https://github.com/TommiContursi/Polku/issues/74) | Weather highlight and sheet geometry vary with frame progress; see below. | Reproduced test instability / strong headless-scheduling evidence; exact cause unresolved |
| [Trail rendering (#75)](https://github.com/TommiContursi/Polku/issues/75) | Historical MapLibre vertex-buffer length exception was not reproduced in three serial trail runs. | Unresolved renderer/dependency risk; no proven Polku root cause |

## Why 20/20 and later failures can both be true

The retained [original passing log](evidence/original-validation-green.log)
contains 20 passing groups. An [earlier validation log](evidence/original-validation-intermittent.log)
already fails the Weather-section highlight. Neither records enough launch
metadata to reconstruct the original invocation exactly.

The initial assessment used a launcher without the validation launcher's
background-throttling safeguards, fresh profiles, and two simultaneous browser
processes during part of the work. Those differences confounded the comparison.

Controlled repeats used unchanged `a737d9d`, Chromium 154.0.8037.57 on Debian 13,
Python 3.12.14, SwiftShader, a two-CPU quota and 8 GiB memory, one browser at a
time and equivalent copies of the same initial profile. The existing smoke
driver bypassed service workers. Assertions and application files were unchanged.
Routing used existing fixtures/straight legs, not bursts against public routers.
Ordinary tiles and weather still involved external services, so this was not a
fully frozen network fixture.

| Check | Previous launcher, serial | Validation flags, serial |
|---|---|---|
| Trail details | Pass | Pass |
| Water loops | Pass | Pass |
| Weather highlight after sport switch | Fail | Fail |
| Desktop side panel | Pass | Pass |
| Desktop bottom sheet | Fail | Fail |
| 390 × 844 | Fail | Fail |
| 360 × 740 | Fail | Pass |

The seven-group totals were 453.17 s and 403.41 s, including network/startup and
rendering waits. Logs: [previous launcher](evidence/baseline-raw.log),
[validation flags](evidence/baseline-validated.log).

In a visible page, animation-frame counts barely advanced across one-second
waits and geometry retained a previous sheet size. Bringing the page forward
alone did not fix it. Completing frames via CDP `Page.captureScreenshot` advanced
the counter to 154 and produced the following geometry without editing the app,
styles, timers or assertions:

| State, 390 × 844 | Sheet height | Controls bottom / sheet top |
|---|---:|---|
| Peek | 152 px | 680 / 684 px |
| Profile | 280 px | 552 / 556 px |
| Half | 422 px | 410 / 414 px |
| Full | 768 px | 64 / 68 px (controls hidden by app) |

The highlight also appeared after frames completed. See the browser
[ordinary](evidence/browser-probes.json) and
[frame-capture](evidence/browser-probes-framed.json) diagnostics. Screencasting
alone [still failed](evidence/current-main-screencast.log); it is not an
established fix. The evidence supports a headless compositor/synchronization
problem combined with fixed-wait assertions. It does not prove a persistent
product layout failure, certify physical devices, or identify an exact browser
engine root cause. The sport-highlight failure is separate from the confirmed
shared-style defect above.

The full current-application run remained **16/20 passed, 4/20 failed** in
785.11 s. Failures were sport-switch Weather highlight, 1440 × 900 bottom sheet,
390 × 844 and 360 × 740. All other groups passed, including trail details and
water loops. See [full log](evidence/current-main-full.log) and
[all group results](evidence/smoke-summary.json). These failures are retained,
not waived or reported as green.

The earlier 41 s water-loop observation exceeded a 40 s wall-clock budget. Three
serial repeats passed. This does not establish a routing correctness defect or
a real-phone regression; cold-area latency remains an existing backlog item.
The trail exception (`Length of new data is 18, which doesn't match current
length of 0`) is a real MapLibre WebGL buffer invariant, not a timeout. Its
absence in repeat runs does not resolve it.

## Recommended order, subject to the approved roadmap

1. **Back to start:** ordinary action, deterministic failure, small change.
   Test real entry points, a closing leg, preserved sports and one undo step.
2. **API pacing, then water-cache recovery:** separate bounded PRs, protecting
   public services and recovering from normally slow hazard sources. Test
   concurrency and complete-result cache reuse as positive controls.
3. **Offline trust and missing terrain:** separate PRs. Define unavailable-data
   behavior and a real-worker browser harness before changing cache logic.
4. **Avoid-link fidelity and latest weather results:** focused compatibility
   and completion-order fixes. They can move earlier if usage warrants it.
5. **Route-owned settings and safety:** agree state/persistence boundaries
   before phase 23b; preserve old links and intentional mixed-sport changes.
6. **Accessibility and measured mobile performance:** real-device evidence and
   gesture policy, aligned with phases 21/22.

Smoke synchronization can proceed as an independent tooling task. Keep geometry,
interaction and performance assertions; replace assumptions about elapsed waits
with bounded observation of the state being checked and useful timeout evidence.
Do not treat screenshot capture or longer sleeps as an already validated cure.

Either agent can implement and the other independently review. For the first
task, Codex implementing Back to start and Claude reviewing click/undo coverage
would be a small trial. Later, separate `net.js` work and approved phase 23a can
proceed on separate branches; coordinate and serialize overlapping `planner.js`
edits. GitHub issue/PR links record ownership, not a permanent hierarchy between
tools. Preserve the approved 23a → 21 sequence unless the user changes it.

## Risks and optional work without a confirmed defect

| Topic | What is known / next evidence needed |
|---|---|
| Partial offline saves and mixed shell versions | Shell-save failures can be suppressed, and unversioned resources merit interrupted-save/deployment tests. This is not evidence that every saved area fails. Investigate with the offline issue before proposing a cache redesign. |
| Water-grid completeness and cost | Missing/partial base tiles and synchronous grid work deserve failure fixtures and physical-device profiling. No new unsafe route or device-wide performance threshold was demonstrated. Keep the existing cold-area latency backlog item; measure data loading, grid construction and search separately before adding workers or complexity. |
| Input bounds, CSP and CDN integrity | Optional targeted hardening review of untrusted links/imports and external scripts. No new exploit was established; no urgent security rewrite is justified by this assessment. |
| FMI radar retirement | Existing BACKLOG records an end-November 2026 deadline. Recheck provider guidance in a dated research task; it was not independently revalidated here. |

## Reproducing and interpreting the evidence

The `evidence/` files are historical diagnostics, not the regression suite and
not passing-test assertions. They are retained unchanged from verification;
absolute `/workspace` and `/tmp` paths identify the original environment. JSON
results are observations, not guarantees about a future revision. No browser
profile, credentials or private user routes are included; route coordinates are
synthetic test inputs. Future fixes should add maintained tests under `tools/`.

The Node probe loads unchanged source into isolated VM modules, replacing only
browser services/dependency boundaries. It makes no real network calls. With
Node 24, from a checkout of the assessed application version:

```sh
node --experimental-vm-modules docs/reviews/2026-10-15/evidence/probes.mjs "$PWD" /tmp/polku-probes.json
```

Read [the probe](evidence/probes.mjs) alongside the
[first](evidence/probes-first-run.json) and [second](evidence/probes.json) results.
It logs known-bad behavior; exit zero means the diagnostic ran, not that the
application passed. Water routing and forecast boundaries are mocked. Offline
checks exercise worker functions with mocked caches/fetch, not browser install,
activation or cold offline navigation. Terrain uses rejected tile requests.

The retained [smoke wrapper](evidence/run_smoke.py) and
[browser diagnostic](evidence/browser_probes.py) are specific to the assessed
cloud runtime: `/usr/bin/chromium`, inherited `HTTPS_PROXY`, proxy trust, and
container launch flags including `--no-sandbox`. They are not recommended
browser settings for normal development. Use `tools/smoke.py` normally. To repeat
the historical comparison in an equivalent cloud runtime, start `serve.py`,
prepare two copies of one initial profile, then run serially:

```sh
python3 -B docs/reviews/2026-10-15/evidence/run_smoke.py "$PWD" raw /tmp/polku-profile-raw /tmp/polku-raw.log trails loops sports 1440x900 390x844 360x740
python3 -B docs/reviews/2026-10-15/evidence/run_smoke.py "$PWD" validated /tmp/polku-profile-validated /tmp/polku-validated.log trails loops sports 1440x900 390x844 360x740
python3 -B docs/reviews/2026-10-15/evidence/browser_probes.py "$PWD" validated /tmp/polku-profile-browser http://localhost:8765 /tmp/polku-browser.json
```

Keep commit, origin, dimensions, groups, initial cache and browser concurrency
fixed. Record external-service availability and actual timing. The original
profiles are not archived, so an exact replay of their network/cache state is
not possible. Offline fixes need separate tests with the worker active; the
ordinary smoke driver bypasses it.
