# Retro: Fixes: October 2026

Milestone: [Fixes: October 2026](https://github.com/TommiContursi/Polku/milestone/15?closed=1), closed on 2026-11-07.
What shipped: 59 issues and 43 PRs closed in it between 2026-10-16 and
2026-10-31. The 24 issues still open at its due date (2026-10-31) moved to
[Fixes: November 2026](https://github.com/TommiContursi/Polku/milestone/18)
on 2026-11-07.

## What cost us

**The smoke suite on GitHub was red or not running for most of the month.**
Runner-only and busy-run failures took whole PRs to fix (#394, #408, #422).
From #558 until #578 every run stopped in its `plan` job (#577), and the
first whole run after that failed in five of ten jobs (#579, still open).
Each one-off failure got a watch issue: 87 were open on 2026-11-07, and 30
of them closed that day with no new failure since 2026-10-31.
- *Since then:* sessions run only the groups they touch, and the whole suite
  waits for #579 (in AGENTS.md).
- *Next:* fix #579, run the whole suite once, and close the watches that
  don't fail again.

**Parallel Fix PRs conflicted in CHANGELOG.md.** Five Fix PRs opened side by
side on 2026-11-05 (#814 to #818) each needed `main` merged in again after
every merge, for CHANGELOG.md only (their Hand-overs on #722, #427, #463,
#399 and #769).

**The fixes landed late.** The milestone was due 2026-10-31, but 22 Fix PRs
merged on 2026-11-05, and 24 issues were still open at the due date.
The Monday sweep only started on 2026-10-26, so nobody flagged the leftovers
until it did.

**Watches sat in the milestone.** Flaky-check watches were filed into the
Fixes milestone until #504 (2026-10-25) took them out, and seven more were
filed into November's before 2026-11-07.

## Kept

- One Fix PR per bug, with a smoke check that fails before the fix.
- The Monday sweep, which plans the week and proposes closes, and changes
  nothing until the user says go.
- What waits on the user is assigned to them (#612), not labelled.
