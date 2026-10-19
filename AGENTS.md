# Working on Polku

The rules for Claude Code, Codex and any other coding agent. `CLAUDE.md` only
imports this file, so keep every project rule here, and keep it short.

## What Polku is

An outdoor map and route planner for Finland, used on phones out on the trail
as much as on a desktop. Today a static site: `index.html`, plain ES modules
and MapLibre, with no build step and no backend. That's how it's built, not
what it must stay: PRODUCT.md keeps the commitments to people apart from it.
[polku.si](https://polku.si) is GitHub Pages from `main`, so **merging a PR
publishes it.**

Read what the task needs (this file is already loaded):

- **A fix:** its issue, the module's part of
  [docs/DEVELOPING.md](docs/DEVELOPING.md), and its smoke group.
- **A phase, or anything people see:** also its plan in
  [docs/plans/](docs/plans/), relevant issues in its milestone, and
  [PRODUCT.md](PRODUCT.md): who Polku is for, its principles and its
  accessibility baseline.
- [README.md](README.md), [docs/ROADMAP.md](docs/ROADMAP.md) and
  [CHANGELOG.md](CHANGELOG.md) only when the task changes them.

No framework, dependency, build step, backend, account or native code without
a real need and the user's OK: an issue first, with what people gain and what
it costs to build, run and maintain. None of them is ruled out when the gain
is real.

## What to work on

**GitHub holds what to do; the repo holds how things work.** The
[Project](https://github.com/users/TommiContursi/projects/1) holds live order
and priorities; milestones group deliveries; phase issues hold scope,
decisions and handovers; `docs/plans/` holds designs.

- **Start with the current milestone's outcome,** or the task the user
  selected. Resume handed-over work before picking a new task. Read the
  phase issue's current Hand-over, then the selected issue/PR. Check their
  state and remote commit before following an old
  next step. Fetch older decisions, code and plans only as needed. Before
  proposing a significant change, check the linked decisions and existing
  work in that area. Routine startup is not a backlog audit.
- **Claim before coding:** comment with branch and worker/session identity
  (Claude A, Claude B or Codex), and set the issue In progress. A phase is
  claimed on its phase issue. Check the current claim; take over after its
  release or the user says that session has stopped, never from age alone.
  Use the pushed branch and handover, not another worker's local state.
  Report missing GitHub permissions or unpublished work explicitly.
- **Follow the user's Project order,** Now top first; Later and Someday need
  the user's OK. Milestones group related work, not execution order. Check
  an issue's native Milestone when recording or selecting work; set it in
  the Project or issue when the approved scope makes placement clear.
  Keep existing milestones, names and phase issues; build approved parts.
  Future milestone names describe their product outcome.
- **Place findings in the roadmap before spending significant effort.**
  Search existing issues and check whether the behavior still exists, a
  merged fix already covers it, or an approved upcoming change will replace
  it. Add evidence to the same problem; group related findings. Put work
  within approved scope in its existing milestone; link findings covered
  by a redesign to that phase. Queue independent fixes in the open Fixes
  milestone and ideas in Someday. Only a delivery blocker or serious
  user-facing problem interrupts current work, including safety,
  reliability and accessibility regressions. Small means effort, not urgency.
- **Keep decisions with the work.** A larger investigation or scope/order
  change needs the user's decision. Close fixed, duplicate or obsolete
  issues with evidence; uncertainty stays explicit. At a delivery
  checkpoint, update its phase issue with what shipped, blockers and the
  next approved action; triage only the related work touched by that delivery.
- **One session, one issue** (or one part of a phase). Start a new session
  (or Codex thread) from the Hand-over at a checkpoint: the PR is ready, a
  part is done, or the next issue begins. In a session past about 300k
  tokens, or after a break of more than an hour, make that the next
  checkpoint, unless the session holds what a Hand-over can't carry: a
  design iteration with the user's feedback, or an investigation half done.
- **One coding session at a time,** unless the user starts more. Claude's
  two accounts and then Codex take turns: when one reaches its usage limit,
  the next takes over from the last Hand-over. More at once ran into the
  limits ([retro](docs/retros/2026-10-15-16.md)). No "status" session, and no
  subagents to verify or run the suite.
- **A Hand-over at every checkpoint.** When a part passes its smoke groups,
  commit, push (a draft PR at the first push), and comment on the claimed
  issue, headed "Hand-over", in 6–8 short lines: worker and claim
  active/released; branch/commit and PR; done; verified commands/run links,
  tested revision and environment; not verified; linked decisions;
  unresolved questions/blockers; next action. Link the current Hand-over
  from the phase/issue body. Reuse evidence whose revision and coverage still
  apply; an account/tool switch alone does not invalidate it. Write one
  before waiting for the user's answer/review. Never end a turn with
  uncommitted work; a worker with separate local state needs pushed work.
- Docs and tooling PRs stay on their one subject.

**Effort:** xhigh for code, design, plans, and anything touching routing,
saved data or share links; medium for docs, rebases and filing issues; never
`max` as a habit. Set it when the session starts, since the default is lower.
Changing effort mid-session keeps the prompt cache; changing the model sends
the whole conversation again, so change models only between sessions
([prompt caching](https://code.claude.com/docs/en/prompt-caching#changing-effort-level)).

## In the code

- **Every network call goes through `request()` in `js/net.js`**, so pacing,
  back-off and Settings → Data sources keep working. Map tiles and the service
  worker have their own paths.
- **Free public services,** used within their terms (a service of Polku's own,
  or a paid one, only as above). If one doesn't hold up, add a fallback or
  switch. **Never burst brouter.de:** it blocks the whole
  connection, the user's too (40 s for about 20 calls in 8 s, then half an hour
  after repeated bursts). Test routing against `tools/brouter-local.sh` or the
  recorded files in `tools/fixtures/`.
- **Traficom's depth data is shown, never routed on.** Its licence excludes
  route planning, so the water router and its warnings use Väylävirasto, OSM
  and SYKE only. Water routes are for planning, not navigation.
- **Location: private by default, local first, not local only** (PRODUCT.md).
  A position leaves the device only for something the person asked for, as
  precisely as it needs, once, to the service that answers, and the control
  says so. Never a stream, never in the background, never a track unless they
  export or share it. Rough requests get a rounded point, never a precise one:
  search and ships the map's middle to about a kilometre, the weather the
  nearest point of its forecast grid (about 3 km). Services of Polku's own,
  if it has any, keep the same rules and keep no history of anyone.
- **Missing, late or partial data never looks complete.** When weather,
  terrain, trail details or hazards fail, the route says so. Check what
  happens when a source fails, answers late, answers out of order, or comes
  back, not only the first good answer.
- **Saved routes, settings and share links keep working,** old ones too. When
  you change what's stored or linked, read the old format as well.
- **Don't break:** weather along the route, Heads-up and Avoid, water routing
  and carries, round trips, offline save and preview, GPX/KML import and GPX
  export, share links, 3D and hover.
- Follow the module that already does the job (DEVELOPING has the list).
  Match the change and verification to the outcome. Use skills when useful;
  add a refactor, helper, abstraction or dependency only for a demonstrated
  need in the task. A small visual edit stays a focused visual edit.
- Think of the phone outdoors: touch, one thumb, small screens, bright sun,
  battery, a bad network. **WCAG 2.2 AA is the baseline:** keyboard, screen
  readers, enlarged text, reduced motion, and nothing said by colour alone.
- **A new panel, sheet or way of working starts as a clickable mock-up** in
  `docs/plans/mockups/`, checked in the worst case too (360 px, 200 % zoom,
  long Finnish words). Use available design skills when helpful; small
  visual edits don't need a mock-up. The mock-up and a short plan are enough:
  no probe scripts, measurements or evidence files unless the user asks.
  The user chooses before it's built; #123's plan shows how.

## Testing

- `python3 serve.py` serves http://localhost:8765. `window.polku` gives
  scripted access to the planner, the map and the state.
- **When other agents are working too,** serve on a port of your own
  (`python3 serve.py 8771`) and point the tests at it
  (`POLKU_URL=http://localhost:8771/ python3 tools/smoke.py`). Never stop
  another agent's server.
- **To test another branch** (a PR to review, `main` to compare), make a
  worktree of its own (`git worktree add --detach <dir> <commit>`) and serve
  that on its own port. Never switch the branch of a checkout another session
  may be using: a test then runs half on one branch and half on the other.
- **Do what a user does:** click, drag, undo, reload. A button being there
  proves nothing.
- **Every bug fix has a regression check in `tools/smoke.py`** that fails
  before the fix and passes after it. Reuse an existing check when it
  demonstrates the bug; add or extend one only when coverage is missing.
- **App changes pass `python3 tools/smoke.py`.** While working, run only the
  groups you touch: `python3 tools/smoke.py water loops`.
- **A change people see:** look at it at **1440 × 900** and **390 × 844**, in
  the sports it touches (MTB and paddle when unsure), with a route drawn and
  the timeline open. Where your tool has a browser the user can watch (Claude
  Code's browser pane), test there.
- The smoke tests bypass the service worker. An offline change needs a check
  with the worker running and the network off.
- Headless Chrome runs with reduced motion, so `fitBounds` and `flyTo` fire
  `moveend` at once: call `map.once('moveend')` before moving the map.
- **A test that fails only sometimes:** write down the commit, the command, the
  browser and what was cached, and say whether it's Polku or the test machine.
  Never weaken a check or skip a test to get a pass; say what failed.

## Pull requests

- For new work, branch from `main`, or from the PR below yours if it isn't
  merged yet ("after #N" in the PR's first line). Check the branch and any
  uncommitted changes. Never change a branch another worker actively owns.
  After an agreed takeover, continue the handed-over pushed branch.
- **The repo squash-merges:** the PR's title and description become its one
  commit on `main`, so keep the description true as the PR changes. When the
  PR below yours is merged, rebase yours onto `main` without its commits
  (`git rebase --onto origin/main <old base>`), or it conflicts with the
  squashed copy of them.
- **Title** like the history, saying what changes for people using Polku:
  "Phase 22a: the drawer in three tabs", "Fix: the map's credits stay folded on
  phones", "Docs: …". Not `feat:` or `docs:`.
- **Body:** what changes for the user, how you tested it, what isn't done or
  is still unknown, plus the issues it found. Use "Fixes #65" only for issues
  fully delivered. Reference the phase issue in partial PRs; close it only
  when the whole phase is delivered and its acceptance checks are met.
- **Milestone:** the PR goes into its issue's milestone. An issue left open in
  a phase's milestone is moved on, with a reason, before the milestone closes.
- **Screenshots** of a change people see: `tools/shoot.py OUTDIR before|after
  [scenes]` on `main` and on the branch, as JPEG on the `pr-screenshots`
  branch under `<branch>/` (no images in `main`), linked as
  `https://github.com/TommiContursi/Polku/blob/pr-screenshots/<branch>/<file>.jpg?raw=true`.
- **In the same PR:**
  - CHANGELOG, as release notes (see "Release notes" below);
  - Review README.md when adding, changing or removing a user-facing
    capability. Update the relevant sections when the description becomes
    incomplete or inaccurate, preserving the existing factual style and useful
    qualifications. Update docs/USING.md when controls or workflows change.
    Keep release-by-release details in CHANGELOG.md;
  - for a phase: what was built in its plan in `docs/plans/`, and delivered
    parts/remaining acceptance on its phase issue. Partial PRs reference the
    phase and close only the issues they fully deliver;
  - DEVELOPING, where how something works has changed.
- **Offer a review** when a phase PR, or a fix that touches routing, saved
  data or share links, is ready: a fresh session (Claude or Codex, whichever
  has usage left) gets only the PR and issue links, tries to break the
  change, and comments on the PR; the author answers each finding with
  evidence. It runs when the user starts it, and never holds a PR in draft.
- **Drafts until verified.**
- **Never push to `main` or merge** unless the user says so. The user merges:
  say which PRs are ready (the ones not in draft, in their "after #N" order),
  and which wait and why.
- **When a milestone's last issue closes,** a short retro in `docs/retros/`:
  what cost time and what to keep, with the PRs and issues as evidence, and
  what changes in AGENTS.md because of it. Then the milestone is closed.

## Bugs and findings

- **Every bug gets a GitHub issue,** small ones too, and so does every
  improvement, idea and risk to watch, each with its kind (`bug`,
  `enhancement`, `idea`, `watch`) and its size. Search first, and add to the
  one that exists.
- The issue says what goes wrong and for whom, how to make it happen, what
  should happen, the commit, and whether it's a **confirmed bug**, **a risk to
  look into**, or **a problem with the test machine**. There's a template:
  "Bug or technical finding", and one for an idea. Write it so that someone
  who wasn't there can act on it: what you found, where in the code, what's
  still unknown.
- **The issue is the one place for its status,** so nothing to do is listed in
  the docs. "Fixes #n" closes it when the PR merges; anything closed without a
  fix says why (`duplicate`, `wontfix`, or done elsewhere).
- **Known limits** that are simply how Polku works, with nothing to do, go into
  DEVELOPING's "Known limits".
- Claude and Codex may review each other's work. Disagree with evidence;
  neither one's earlier conclusion is final.

## Writing

- Plain, natural English in complete sentences. Say what happens on the
  screen ("Back to start does nothing"), not what kind of defect it is ("a
  shadowed method").
- **Never quote the user's chat messages** in the repo, issues or PRs. Write what
  they asked for as a plan or an idea ("An idea from testing, 2026-10-15").
- Dates as dates (2026-10-15), never "today" or "last week".

## Release notes

`CHANGELOG.md` is shown in the app (**Settings → About Polku → What's new**),
so write it for people using Polku, like the entries already there.

- One entry per change people notice, under the date it ships. Related
  changes share one; tests, tooling and docs get none.
- Every bullet is a full sentence that names what it's about ("The arrows
  stay still…", not "**They stay still**…"). Bold only control names and
  safety notes.
- Say how it works now, not how it was built, and keep limits and safety
  notes.
- Shipped entries stay as they are: a later change gets its own entry, and an
  older one is changed only when it would now mislead.
