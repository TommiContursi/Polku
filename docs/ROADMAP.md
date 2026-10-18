# Polku roadmap

**[The GitHub Project](https://github.com/users/TommiContursi/projects/1) is
the live roadmap.** The user changes phase order and priorities there without
a commit. [AGENTS.md](../AGENTS.md) explains how workers select, verify and
hand over work.

- **Project:** Roadmap shows the existing phase issues in editable order;
  Current delivery shows the selected outcome and blockers; Triage groups
  findings awaiting a decision. Priority is Now/Next/Later/Someday; progress
  Status is Triage/Ready/In progress/Blocked/Done. Linked PRs show their own
  draft/review state. Closing an issue records its reason, not necessarily
  a shipped feature.
- **[Milestones](https://github.com/TommiContursi/Polku/milestones):** retain
  the existing phase and Fixes groups. Phase issues hold acceptance,
  dependencies, decisions and a link to the current Hand-over.
- **Designs:** [plans/](plans/) holds implementation designs;
  [plans/done.md](plans/done.md) preserves finished phases.
- **Delivered work:** merged PRs and closed issues, user-facing
  [CHANGELOG](../CHANGELOG.md), and [retros/](retros/).
- **Watch items:** retain their dates/triggers in their issues and the
  Project's Due field. A deadline needs a priority decision, not an
  automatic claim.

Native Project workflows maintain routine add/close/reopen transitions.
Workers record claims and blockers explicitly. No synchronizer, periodic
AI review or second status document is needed. Smoke-test automation remains
in [#268](https://github.com/TommiContursi/Polku/issues/268).

Before merging this transition, preserve all existing Project values and
migrate the approved phase order, dependencies and dated exceptions from
[the 2026-10-18 roadmap snapshot](https://github.com/TommiContursi/Polku/blob/6b1e2932cab389cfc9e9367918d126a38f5d2047/docs/ROADMAP.md).
Verify the live views and workflows before relying on them. That snapshot is
migration evidence, not a second live backlog.

## What holds for every phase

**Where things live:**
- **Top bar:** search, Plan, sport pill, ⚙ Settings.
- **Bottom right:** one column, top to bottom: compass, locate, zoom, Weather, Layers, Plan (most used nearest the thumb). The scale bar and the attribution (i) are bottom left, so the column reaches the corner.
- **Layers panel** (opens beside its button) is what the map shows. **Settings** (opens under the ⚙) is how Polku behaves.
- A control may appear in two places only if both say so (e.g. sport, weather layers).
- Phones use the same places. Panels become bottom sheets there, and touch phones drop the +/−.
- New settings go in Settings. New map layers go in a Layers group.

**Where you are is yours** ([PRODUCT.md](../PRODUCT.md), revised 2026-10-18): private by default, local first, not local only. Following you, On the way and recorded tracks work on the device, and nothing streams your position or sends it in the background. A position goes out only for something you ask for, as precisely as it needs, and the control says so. A recorded track is yours to save, export or delete.

## Before 2026-10-16

This file held the plans, the designs and a status table of every phase, 1,744 lines. [The last full ROADMAP](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/ROADMAP.md) is where older issues' line numbers point. Its designs are in [docs/plans/](plans/), unchanged, and the ideas, limits and risks of docs/BACKLOG.md are issues.
