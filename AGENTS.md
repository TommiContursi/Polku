# Working on Polku

These instructions apply to Claude Code, Codex and other coding agents.

## Project and references

Polku is a lightweight outdoor map and route planner for Finland: a static site,
plain browser ES modules and MapLibre, with no build step or backend. Understand
the route-planning experience and the map, including use outdoors on a phone.

Before substantial work, read [README.md](README.md),
[docs/DEVELOPING.md](docs/DEVELOPING.md), the relevant parts of
[docs/ROADMAP.md](docs/ROADMAP.md), [docs/BACKLOG.md](docs/BACKLOG.md) and recent
[CHANGELOG.md](CHANGELOG.md) entries. DEVELOPING describes module responsibilities,
tools and release conventions; ROADMAP gives the approved order of work.

Preserve this architecture unless evidence justifies a change. Prefer simple,
maintainable solutions. Adding a framework, dependency, backend or build system
requires a demonstrated need and the user's approval.

## Implementation

- Follow the responsibilities and conventions of existing modules. Keep fixes
  focused; avoid unrelated refactoring. Incremental architectural improvements
  are welcome when they concretely simplify the work.
- Use `request()` in `js/net.js` for public-service API calls, following the
  existing map-tile and service-worker paths for their own traffic. Keep services
  free and respect their terms, pacing, back-off and usage accounting.
- Preserve existing routes, settings, saved data and share links. Consider older
  stored formats and links when changing serialization or routing keys.
- Missing, stale or partial geographic, weather, terrain and safety data must
  not silently look complete or reliable. Check recovery and cache invalidation,
  not just the first successful response. Water routes remain planning aids,
  not navigation; respect the documented restrictions on depth data.
- Consider desktop and mobile usability, touch and keyboard interactions,
  accessibility, rendering cost, battery use and offline behavior.

## Verification

- Investigate root causes and test actual user actions, not just whether a
  button or label exists. Add a regression test for each fixed bug.
- Where relevant, test failures, missing data, asynchronous completion order,
  cancellation and recovery. Use local fixtures and mocked services; routing
  probes belong on the local BRouter, never in bursts against public routers.
- Run the appropriate existing checks before proposing a change. Start with
  targeted groups while iterating; application changes must pass
  `python3 tools/smoke.py` and the relevant desktop/mobile checks described in
  DEVELOPING. Serve locally with `python3 serve.py`.
- Record the commit, command, browser/launcher, cache state and relevant timing
  conditions when investigating inconsistent results. Separate application
  defects from test instability and environment limitations. Never bypass a
  failing test or weaken assertions to obtain a green run; report unresolved
  failures and their evidence.
- The smoke driver bypasses the service worker. Offline changes need separate
  checks with the worker active and the network unavailable.

## Workflow and collaboration

- Follow the approved roadmap unless the user approves different priorities.
  Use focused feature branches and pull requests. Never push directly to `main`
  or merge your own PR without approval: merging publishes to polku.si.
- Before editing, inspect the branch, worktree and uncommitted changes. Do not
  overwrite another contributor's unfinished work or work concurrently on the
  same branch; use separate branches/worktrees and coordinate through GitHub.
- Claude Code and Codex are independent contributors. Either may review the
  other's work. Respect existing work while evaluating its decisions on evidence;
  neither tool's earlier conclusions are authoritative.
- Review for correctness, maintainability, reliability and user experience.
  Challenge assumptions with concrete reasons. Explain the benefit of an
  alternative; avoid subjective criticism and unnecessary rewrites.
- GitHub and repository documentation are the shared source of truth. Explain
  each change's user impact, validation and remaining limitations in the PR.
  Follow DEVELOPING's changelog, roadmap, backlog and screenshot conventions
  when shipping behavior or advancing a phase; keep infrastructure-only PRs
  focused and describe their scope in the PR.
