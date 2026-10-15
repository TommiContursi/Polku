# Back to start — PR #64 verification

**Final result: 25/25 full smoke groups and 16/16 sport/size checks passed.**

Date: 2026-10-15. Issue: https://github.com/TommiContursi/Polku/issues/65
PR: https://github.com/TommiContursi/Polku/pull/64

## Versions and scope

Current main: `c48dc18b36e91f854107272ce4b970bd23c33222` (includes #77, #79, #81 and #82).
Final branch: `47901fd925624e15cd9d35ac68accb3204abbad5`.
Only `js/planner.js`, `tools/smoke.py` and `CHANGELOG.md` differ from main. BACKLOG and ROADMAP are unchanged from main: #82 removed the requirement for a Fix PR roadmap row. PR #64 is not merged.

Back to start has its own action name, separate from round-trip state. All three buttons call it. Closed routes cannot gain another closing leg; the wide toolbar button now disables too. Existing Undo and sport behavior are preserved.

## Reproduction

Open Plan, choose Straight line, and add two or more distinct map points. Click Back to start under the waypoint list, in the finish marker's menu, or in the wide bottom toolbar. Main throws `this.loop is not a function` and does not add a return leg. The branch adds one leg back to the start. One Undo restores the route.

The regression uses the actual DOM buttons, verifies closing geometry and mode, preserves existing points and sports, continues the last leg's sport, checks that a closed route cannot gain another leg or Undo step, clicks Undo and compares the complete route snapshot and history position. The finish-menu case includes an MTB-to-paddle route with straight legs. Console errors are checked. The three layouts are 1440×900, 390×844 and 1920×1080.

## Environment

macOS 26.6.2 (25G83), Python 3.9.6, Google Chrome 155.0.8059.40. Repository CDP driver, SwiftShader, reduced motion, service-worker bypass. Serial automated Chrome runs with separate fresh profiles, clean localStorage per page. Map tiles and weather remain external, so network conditions are not frozen. Routing uses fixtures or straight legs, not bursts against public routers.

External launcher (not a repository change):

```sh
#!/bin/sh
exec '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding "$@"
```

Typical full-suite command, from the checkout served on 8765:

```sh
POLKU_CHROME=../chrome-test-launcher POLKU_CHROME_PROFILE=../chrome-post82-full python3 tools/smoke.py
```

The unchanged-main comparison used the same driver and flags, `POLKU_URL=http://127.0.0.1:8766/`, and another fresh profile. The initial default-launcher attempt on older main timed out waiting for map readiness; a separate diagnostic found the app/map/tiles loaded with no console errors. Its exact startup cause remains unresolved; the launch flags are not claimed to be a proven cure.

## Full-suite comparison and Weather investigation

Before the last main update, the full `0842d4e` run passed 23/24 groups. Unchanged main `0875dc5` passed 20/21. Both failed only `the Weather button: Departure & weather not highlighted`. All Back to start groups and all five layout groups passed on the branch.

The Weather button calls `reveal('depart')`. Opening the section is synchronous, but its `sec-flash` class is added in `requestAnimationFrame`; the existing test checks after a fixed 150 ms. These paths and the sport-switch test are unchanged by #64. Focused instrumented runs retained the original assertion and passed on both versions: main called flash about 136 ms after the click, and the branch about 85 ms after. Both pages reported visible and no console errors. This establishes a pre-existing intermittent failure under these conditions and a timing-sensitive assertion; it does not isolate the exact cause of the failed full runs. See issue #74. No assertions, timeouts or repository driver settings were relaxed.

The full run on merge commit `9495d3b` was deliberately interrupted to add the closed-route regression after review; it is not counted as a completed suite.

## Review and preview

A separate read-only Codex reviewer found the toolbar duplicate-closure case at `7ca4668`; an actual browser test reproduced it. After the guard and disabled state were added, the reviewer checked `0842d4e`, then final `47901fd` against main `c48dc18`, and found no remaining actionable issues. The reviewer independently read the code and ran static checks; it did not independently run browser tests.

The visible Codex browser on 8765 was refreshed to the final code. Back to start changed the sample route from 2.15 km to 4.30 km, and Undo restored 2.15 km. Served `js/planner.js` and `js/net.js` matched the working checkout byte-for-byte. Planner SHA-256: `271f778c033963f7625732302f37a9d8e58ff465f9ed1eed02acfbaee6ada476`.

These checks cover desktop and emulated phone views, not physical-device field use or offline behavior. The service worker is bypassed by the smoke driver. No merge or deployment was performed.

The repeat on the previous branch completed 24/24, but the next main merge began during its final viewport; it is retained as history, not used as the final unchanged-checkout result.

## Final results on post-#82 main

- Full `python3 tools/smoke.py`: **25/25 passed**, exit 0, on final `47901fd`. This includes sports, pacing, water recovery, round trips, all three Back to start cases and all five layouts.
- Final Back to start regression against unchanged main `c48dc18` on 8766: **all three fail** with the original `this.loop is not a function` exception. The final script was run against the baseline server without modifying baseline app files.
- Before the additional guard, `7ca4668` passed waypoint and finish-menu cases but failed the toolbar case with a duplicate closing point and extra Undo step. The final suite verifies that case now passes.
- Screenshots: current main and final branch, 1440×900 and 390×844, captured through the repository's screenshot helper and converted to JPEG. Served planner source was checked against each checkout before capture.
- The working branch remained unchanged during its final full run. The earlier Weather failure, matching baseline failure and timing probes are retained below, not replaced by the passing result.

## Evidence files

- [Final full suite](logs/smoke-post82.log)
- [Final regression against unchanged main](logs/back-to-start-main82-red.log)
- [Duplicate-closure reproduction before the guard](logs/back-to-start-closed-red.log)
- [Earlier branch full run with Weather failure](logs/smoke-final.log)
- [Matched unchanged-main full run with Weather failure](logs/smoke-main79.log)
- [Main Weather timing probe](logs/highlight-main79.log)
- [Branch Weather timing probe](logs/highlight-final.log)

| View | Before | After |
|---|---|---|
| Desktop | [Before](before-back-to-start-desktop.jpg) | [After](after-back-to-start-desktop.jpg) |
| Phone | [Before](before-back-to-start-phone.jpg) | [After](after-back-to-start-phone.jpg) |

## Sport and size checks

MTB, gravel, road cycling, hike, trail run, run, paddle and swim each passed the same Back to start/closed-route/Undo regression at 1440×900 and 390×844, with timeline enabled: **16/16**, no console errors. The route/profile and responsive controls were also inspected in the captured views. These extra checks use straight legs. [Log](logs/back-to-start-final-sports.log).
