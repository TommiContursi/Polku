# Working on Polku

The rules for Claude Code, Codex and any other coding agent. `CLAUDE.md` only
imports this file, so keep every project rule here, and keep it short.

## What Polku is

An outdoor map and route planner for Finland, used on phones out on the trail
as much as on a desktop. A static site: `index.html`, plain ES modules and
MapLibre, with no build step and no backend. [polku.si](https://polku.si) is
GitHub Pages from `main`, so **merging a PR publishes it.**

Before bigger work, read [README.md](README.md),
[docs/DEVELOPING.md](docs/DEVELOPING.md) (the modules, the commands, how the
trickier parts work), the part of [docs/ROADMAP.md](docs/ROADMAP.md) you're
working on, [docs/BACKLOG.md](docs/BACKLOG.md) and the latest
[CHANGELOG.md](CHANGELOG.md) entries.

No framework, dependency, backend or build step without a real need and the
user's OK.

## What to work on

- **Phases** in ROADMAP's order, one phase per PR, unless the user changes it.
- **Confirmed bugs with a small fix** get a Fix PR of their own, between
  phases, at any time. Don't mix them into a phase. A bug that needs a design
  first gets a place in ROADMAP, with the user's OK.
- **Bugs, ideas and risks you notice but don't do now** go into BACKLOG as they
  come up, dated, saying where they came from.
- Docs and tooling PRs stay on their one subject.

## In the code

- **Every network call goes through `request()` in `js/net.js`**, so pacing,
  back-off and Settings → Data sources keep working. Map tiles and the service
  worker have their own paths.
- **Only free public services,** used within their terms. If one doesn't hold
  up, add a fallback or switch. **Never burst brouter.de:** it blocks the whole
  connection, the user's too (40 s for about 20 calls in 8 s, then half an hour
  after repeated bursts). Test routing against `tools/brouter-local.sh` or the
  recorded files in `tools/fixtures/`.
- **Traficom's depth data is shown, never routed on.** Its licence excludes
  route planning, so the water router and its warnings use Väylävirasto, OSM
  and SYKE only. Water routes are for planning, not navigation.
- **Missing, late or partial data never looks complete.** When weather,
  terrain, trail details or hazards fail, the route says so. Check what
  happens when a source fails, answers late, answers out of order, or comes
  back, not only the first good answer.
- **Saved routes, settings and share links keep working,** old ones too. When
  you change what's stored or linked, read the old format as well.
- **Don't break:** weather along the route, Heads-up and Avoid, water routing
  and carries, round trips, offline save and preview, GPX/KML import and GPX
  export, share links, 3D and hover.
- Follow the module that already does the job (DEVELOPING has the list). Keep
  fixes to the point; tidy only what makes the change simpler.
- Think of the phone outdoors: touch, small screens, battery, a bad network.
  Keyboard and screen readers too.

## Testing

- `python3 serve.py` serves http://localhost:8765. `window.polku` gives
  scripted access to the planner, the map and the state.
- **Do what a user does:** click, drag, undo, reload. A button being there
  proves nothing.
- **Every bug fix gets a check in `tools/smoke.py`** that fails before the fix
  and passes after it.
- **App changes pass `python3 tools/smoke.py`.** While working, run only the
  groups you touch: `python3 tools/smoke.py water loops`.
- Look at the change at **1440 × 900** and **390 × 844**, in MTB, gravel, hike
  and paddle (and any sport it touches), with a route drawn and the timeline
  open. Where your tool has a browser the user can watch (Claude Code's browser
  pane), test there.
- The smoke tests bypass the service worker. An offline change needs a check
  with the worker running and the network off.
- Headless Chrome runs with reduced motion, so `fitBounds` and `flyTo` fire
  `moveend` at once: call `map.once('moveend')` before moving the map.
- **A test that fails only sometimes:** write down the commit, the command, the
  browser and what was cached, and say whether it's Polku or the test machine.
  Never weaken a check or skip a test to get a pass; say what failed.

## Pull requests

- Branch from `main`, or from the previous phase if it isn't merged yet (say so
  in the PR). First check the branch and any uncommitted changes. Never work on
  another agent's branch.
- **Title** like the history, saying what changes for people using Polku:
  "Phase 22a: the drawer in three tabs", "Fix: the map's credits stay folded on
  phones", "Docs: …". Not `feat:` or `docs:`.
- **Body:** what changes for the user, how you tested it, what isn't done or
  is still unknown. "Fixes #65" for the issue it fixes.
- **Screenshots:** `tools/shoot.py OUTDIR before|after [scenes]` on `main` and
  on the branch, as JPEG on the `pr-screenshots` branch under `<branch>/`
  (no images in `main`), linked as
  `https://github.com/TommiContursi/Polku/blob/pr-screenshots/<branch>/<file>.jpg?raw=true`.
- **In the same PR:**
  - CHANGELOG, in plain words for people using Polku (not for docs or tooling);
  - the PR's row in ROADMAP's status table, written as **merged**: `main` only
    says so once it is;
  - BACKLOG: strike out what's fixed, add what you found.
- **Never push to `main` or merge** unless the user says so.

## Bugs and findings

- **A bug to reproduce or discuss gets a GitHub issue.** Search first, and add
  to the one that exists. Small ideas stay in BACKLOG.
- The issue says what goes wrong and for whom, how to make it happen, what
  should happen, the commit, and whether it's a **confirmed bug**, **a risk to
  look into**, or **a problem with the test machine**. There's a template:
  "Bug or technical finding".
- When you start on an issue, comment with your branch, so the other agent
  doesn't start on it too.
- **The issue is the one place for its status.** BACKLOG links to it in one
  line. "Fixes #n" closes it when the PR merges; anything closed without a fix
  says why.
- Claude and Codex may review each other's work. Disagree with evidence;
  neither one's earlier conclusion is final.

## Writing

- Plain, short English, like the CHANGELOG. Say what happens on the screen
  ("Back to start does nothing"), not what kind of defect it is ("a shadowed
  method").
- **Never quote the user's chat messages** in the repo, issues or PRs. Write what
  they asked for as a plan or an idea ("An idea from testing, 2026-10-15").
- Dates as dates (2026-10-15), never "today" or "last week".
