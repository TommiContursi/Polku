# Polku roadmap

**GitHub holds what to do; the repo holds how things work.** Every bug, improvement, idea and risk to watch is a GitHub issue, which holds its status. This file says how the order is decided, the order of the phases, and what holds for all of them. How to work on Polku is in [AGENTS.md](../AGENTS.md).

- **The board:** [Polku](https://github.com/users/TommiContursi/projects/1): Now, Next, Later, Someday. Work is picked from Now, top first.
- **[Milestones](https://github.com/TommiContursi/Polku/milestones):** one for each planned phase, with its phase issue and the issues that belong to it, and one for each round of fixes.
- **Labels:** the kind, `bug`, `enhancement`, `idea` or `watch`, and the size, `small`, `medium` or `big`.
- **Designs:** [docs/plans/](plans/), one file for each planned phase. Finished phases are in [plans/done.md](plans/done.md).
- **Retros:** [docs/retros/](retros/), one for each finished milestone.
- **What shipped:** the [CHANGELOG](../CHANGELOG.md), and closed milestones and issues.

## How the order is decided

- **The user decides the order of the phases.** A change comes as a docs PR that edits the table below, with the user's OK.
- **One phase at a time,** one PR each, in this order. A phase's PR takes its row out of the table and writes what was built into its plan.
- **Confirmed bugs with a small fix** go into the open round of fixes (milestone "Fixes N") and are fixed between phases, in Fix PRs of their own. A bug that needs a design first goes into a phase's milestone, with the user's OK.
- **Improvements the user wants** (`enhancement`): a small one is done in a PR of its own when the user picks it; a bigger one goes into its phase's milestone.
- **Ideas** (`idea`) wait in Someday until the user picks one. Then it becomes an `enhancement`, with a size and a place on the board.
- **Risks to watch** (`watch`) say when to look again: a date (in the title, and the board's Due field) or a trigger. A dated one moves to Now in time.
- **The board follows this:** Now holds what's being worked on and what to pick next; Next what comes after it; Later the phases further down; Someday the rest.

## The order (re-planned 2026-10-15)

| # | Phase | Size | Why here | Issue | Plan |
|---|---|---|---|---|---|
| 1 | **21, say what it means** | big | Every layer explained, nothing worked out kept hidden. It goes before the map's look changes (20) and before the wording is translated (18). | #178 | [21](plans/21-say-what-it-means.md) |
| 2 | **22b, the panel on desktop moves** | medium | Desktop only; 22a's tabs first show how much the panel still needs to move. | #179 | [22](plans/22-drawer.md) |
| 3 | **23b, on the way** | medium–big | Needs 22a's drawer (it becomes the On the way view) and 23a's heading. | #180 | [23](plans/23-out-on-the-trail.md) |
| 4 | **20, map style** | big | Builds on 21; the route's glow goes with the map's look. | #181 | [20](plans/20-map-style.md) |
| 5 | **17, weather layers** | medium | | #182 | [17](plans/17-weather.md) |
| 6 | **23c, your track** | medium | After 23b: it records what 23b follows. | #183 | [23](plans/23-out-on-the-trail.md) |
| 7 | **18, languages** | big | Once the words have settled through 21 and 22. | #184 | [18](plans/18-languages.md) |
| 8 | **15c, skiing** | big | When there's snow to test on (December–January), whatever its place here. | #185 | [15](plans/15c-skiing.md) |
| 9 | **22c, cards to pull out** | medium | Only if 22a and 22b haven't made it unnecessary. | #186 | [22](plans/22-drawer.md) |
| 10 | **23d, alerts on the way** | small–medium | After real use of 23b shows what's worth a buzz. | #187 | [23](plans/23-out-on-the-trail.md) |
| 11 | **16, Strava & Garmin** | research | Outside accounts and terms. | #188 | [16](plans/16-strava-garmin.md) |
| 12 | **19, help and a tutorial** | big | Last, when the rest holds still. | #189 | [19](plans/19-help.md) |

**Waiting for the user's OK (proposed by phase 24, 2026-10-17):** a calmer route planner as a phase of its own (#233), designed in two iterations: [its plan](plans/issue-233-calmer-planner.md) and [the mock-up](plans/mockups/phase-24-planner.html). One place for each thing, 44 px targets on phones, the drawing tools as a toolbox (one drop-down on phones, a toolbar on the desktop panel's edge), round trips in the peek, one menu for the whole route, Done leading to the route's view, Check by how serious and how sure, and long waypoint lists. In four parts, each a PR: the toolbox and the peek; round trips; Done and the route's view; Check and the waypoints. The review suggests it after Fixes 2's header bugs (#239–#242, #251) and #226, and before 22b, since 22b moves the same panel; the place in the order, and the menu's name, are the user's call.

**Phase 24's milestone stays open** for #123's build (with #96) and the real-phone checks of #73 and #134; its row is out of the order since the review itself is done (#177).

**Dated, outside the order:** #133, a rain-rate source before FMI retires the layer Polku's rain "now" reads, by 2026-11-30.

## What holds for every phase

**Where things live:**
- **Top bar:** search, Plan, sport pill, ⚙ Settings.
- **Bottom right:** one column, top to bottom: compass, locate, zoom, Weather, Layers, Plan (most used nearest the thumb). The scale bar and the attribution (i) are bottom left, so the column reaches the corner.
- **Layers panel** (opens beside its button) is what the map shows. **Settings** (opens under the ⚙) is how Polku behaves.
- A control may appear in two places only if both say so (e.g. sport, weather layers).
- Phones use the same places. Panels become bottom sheets there, and touch phones drop the +/−.
- New settings go in Settings. New map layers go in a Layers group.

**Where you are stays on your device** (phase 23's rule): it's never sent anywhere, not even to Polku, and a recorded track is yours to save or delete.

## Before 2026-10-16

This file held the plans, the designs and a status table of every phase, 1,744 lines. [The last full ROADMAP](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/ROADMAP.md) is where older issues' line numbers point. Its designs are in [docs/plans/](plans/), unchanged, and the ideas, limits and risks of docs/BACKLOG.md are issues.
