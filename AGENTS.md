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

Read what the task needs (this file is already loaded), and more only when
that leaves a question open:

- **A fix:** its issue, the module's part of
  [docs/DEVELOPING.md](docs/DEVELOPING.md), and its smoke group.
- **A phase, or anything people see:** also the latest Hand-over and what
  came after it, the part's sections of its plan in
  [docs/plans/](docs/plans/), relevant issues in its milestone, and
  [PRODUCT.md](PRODUCT.md): who Polku is for, its principles and its
  accessibility baseline.
- [README.md](README.md), [docs/ROADMAP.md](docs/ROADMAP.md) and
  [CHANGELOG.md](CHANGELOG.md) only when the task changes them. Older
  Hand-overs, reviews and threads are for looking things up: starting is not
  a backlog audit.

No framework, dependency, build step, backend, account or native code without
a real need and the user's OK: an issue first, with what people gain and what
it costs to build, run and maintain. None of them is ruled out when the gain
is real.

## What to work on

**GitHub holds what to do; the repo holds how things work.** The
[Project](https://github.com/users/TommiContursi/projects/1) holds the order
and priorities. A milestone groups the issues that ship together, not their
order. A phase issue holds its scope, decisions and Hand-overs, and
`docs/plans/` its design.

- **Start from the task the user picked, or the latest Hand-over** on the
  phase issue; otherwise from the Project's Now column, top first (Later and
  Someday need the user's OK). Trust a Hand-over for what ran on which
  commit, and check it against its PR and branch. What comes next is the
  user's latest choice and the plan's order on `main`, however recent the
  Hand-over. A review, an audit or a proposal decides nothing until the user
  chooses it (#352). When unsure, ask.
- **Claim it first:** a comment on the issue with your branch, saying which
  agent you are (Claude or Codex: all post as the user's GitHub account).
  A phase is claimed on its phase issue. Take over only when a
  claim is released or the user says its session has stopped, never because
  it's old: continue from its last Hand-over and pushed branch, and say so
  on the issue.
- **What you notice but don't do now** goes in your Hand-over (see "Bugs
  and findings"), and the work goes on: only a blocker or a serious problem
  for people using Polku (safety, reliability, accessibility) interrupts it.
  Small fixes go into the open Fixes milestone, each in a Fix PR of its own,
  never mixed into a phase; ideas wait in Someday.
- **The user decides** a larger investigation and any change of scope or
  order.
- **One session, one issue** (or one PR of a phase). A session carries its
  PR through to ready, across as many checkpoints as it takes: a token
  count never stops it mid-part. Start a new session (or Codex thread) from
  the Hand-over when the next issue begins, when a part is done and the
  context is past about 300k tokens, when the session reaches its usage
  limit, or when its context has been compacted and it starts losing track
  (repeating work, forgetting a decision). Write the Hand-over first.
- **Sessions side by side,** as many as the user starts: each has a claim
  and a branch of its own, and leaves alone the files another open PR
  changes. When one reaches its usage limit, the next continues from its
  last Hand-over. No "status" session. A subagent can do a wide search, but
  not verify the work or run the suite: those stay with the session.
- **A Hand-over at every checkpoint.** When a part passes its smoke groups,
  commit, push (a draft PR at the first push), and comment on the claimed
  issue, headed "Hand-over", in 6–8 short lines, no prose: who you are and
  whether the claim is released; branch, commit and PR; done; verified, with
  the exact commands and the commit they ran on; not verified; decisions,
  with links; next step, from the plan's order; what to watch out for;
  noticed, one line each.
  Write one too before a turn that waits for the user, so the answer can
  start a fresh session. Never end a turn with uncommitted work: #177 lost a
  whole claim.
- Docs and tooling PRs stay on their one subject.

**Model and effort,** picked when the session starts: Sonnet, or Opus at
medium, for docs, small fixes, rebases, filing issues and the weekly sweep;
Opus at high for a phase's part, multi-file work and hard bugs, including
anything touching routing, saved data or share links. Raise it to xhigh
only when high is stuck on the same problem; never `max` as a habit.
Mid-session, change effort, not models: a new model sends the whole
conversation again
([prompt caching](https://code.claude.com/docs/en/prompt-caching#changing-effort-level)).

## Engineering judgment

- **Evidence before fixes.** Observe the failure, form a falsifiable hypothesis, and test it before changing code. A plausible explanation is not a proven cause.
- **Fix causes, not symptoms.** Make the smallest change that addresses the demonstrated cause. Verify the failure before and after the fix.
- **Intermittent failures count.** Record conditions, isolate variables, and investigate proportionately. Don't invent a fix or rerun tests until they happen to pass.
- **Keep one clear implementation.** Reuse existing mechanisms. Avoid parallel code paths, unnecessary abstractions, defensive layers, and special cases without demonstrated value.
- **Fail clearly; recover appropriately.** Surface programming errors. Handle expected service failures without hiding missing data or losing the user's work.
- **Clarity over compatibility.** Clear code beats backward compatibility. Prefer one clear implementation over compatibility layers for superseded behavior or formats.
- **Prefer less complexity.** A new dependency, fallback, abstraction, or persistent state must justify its maintenance cost.
- **Stay focused.** Make surgical changes. Don't refactor unrelated code, build speculative infrastructure, or expand the task without a concrete reason.

## In the code

- **Every network call goes through `request()` in `js/net.js`**, so pacing,
  back-off and Settings → Data sources keep working. Map tiles and the service
  worker have their own paths.
- **Free public services,** used within their terms (a service of Polku's own,
  or a paid one, only as above). If one doesn't hold up, add a fallback or
  switch. **Never burst brouter.de:** it blocks the whole connection, the
  user's too (DEVELOPING, "The free services"). Test routing against
  `tools/brouter-local.sh` or the recorded files in `tools/fixtures/`.
- **Traficom's depth data is shown, never routed on.** Its licence excludes
  route planning, so the water router and its warnings use Väylävirasto, OSM
  and SYKE only. Water routes are for planning, not navigation.
- **Location: private by default, local first, not local only.** A position
  leaves the device only for something the person asked for, once, as
  precisely as it needs, to the service that answers, and the control says
  so: never a stream, in the background, or a track they didn't export or
  share. Before a change that sends a position or the map's middle, read
  PRODUCT.md's rule and its rounding.
- **Missing, late or partial data never looks complete.** When weather,
  terrain, trail details or hazards fail, the route says so. Check what
  happens when a source fails, answers late, answers out of order, or comes
  back, not only the first good answer.
- **Saved routes, settings and share links:** update the current readers,
  writers and tests together when formats change; don't retain old formats
  solely for backward compatibility.
- **Don't break:** weather along the route, Heads-up and Avoid, water routing
  and carries, round trips, offline save and preview, GPX/KML import and GPX
  export, share links, 3D and hover.
- Follow the module that already does the job (DEVELOPING has the list). Keep
  changes to the point: tidy only what makes the change simpler, and add a
  helper, abstraction or dependency only when the task needs one. Use skills
  where they help. Where one differs from this file, this file wins:
  same-commit runs count, the user decides scope and order (not a ledger),
  progress goes in Hand-overs, and only the user merges.
- Think of the phone outdoors: touch, one thumb, small screens, bright sun,
  battery, a bad network. **WCAG 2.2 AA is the baseline:** keyboard, screen
  readers, enlarged text, reduced motion, and nothing said by colour alone.
- **A new panel, sheet or way of working starts as a clickable mock-up** in
  `docs/plans/mockups/`, checked in the worst case too (360 px, 200 % zoom,
  long Finnish words), with the design skills that help. A small visual
  change needs none. The mock-up and a short plan are enough: no probe
  scripts, measurements or evidence files unless the user asks. The user
  chooses before it's built; #123's plan shows how.
- **One style, and don't redesign what works.** A control for a job the app
  already does is the one in DEVELOPING's "Shared controls", with its class,
  and a mock-up copies its CSS. A new kind is proposed to the user first. A
  mock-up keeps its earlier versions behind a switch, so they can be compared.

## Testing

- `python3 serve.py` serves http://localhost:8765. `window.polku` gives
  scripted access to the planner, the map and the state.
- **When other agents are working too,** serve on a port of your own
  (`python3 serve.py 8771`) and point the tests at it
  (`POLKU_URL=http://localhost:8771/ python3 tools/smoke.py`). Never stop
  another agent's server.
- **To test another branch,** make a worktree of its own
  (`git worktree add --detach <dir> <commit>`) and serve that on its own
  port. Never switch the branch of a checkout another session may be using:
  a test then runs half on one branch and half on the other.
- **Do what a user does:** click, drag, undo, reload. A button being there
  proves nothing.
- **Every bug fix has a check in `tools/smoke.py`** that fails before the fix
  and passes after it: an existing one if it shows the bug, else a new one.
- **App changes pass `python3 tools/smoke.py`:** while working, the groups
  you touch (`python3 tools/smoke.py water loops`); before the PR leaves
  draft, the whole suite once, on its last commit that changes the app. A
  check stays good for the commit it ran on, whoever ran it, and for any
  later commit whose files outside `docs/`, AGENTS.md, README.md and
  PRODUCT.md are the same: a docs-only commit, or a rebase onto one (the
  app reads `CHANGELOG.md`: run `changelog`).
- **A check that fails only sometimes,** or only in a whole run, goes in
  the Hand-over's noticed lines (or a comment on its issue): the commit, the
  command, the browser, what was cached and what else ran, what failed, and
  whether it passes alone. Never rerun until it's green, nor weaken or skip a
  check to pass.
- **A change people see:** look at it at **1440 × 900** and **390 × 844**, in
  the sports it touches (MTB and paddle when unsure), with a route drawn and
  the timeline open. Where your tool has a browser the user can watch (Claude
  Code's browser pane), test there.
- The smoke tests bypass the service worker. An offline change needs a check
  with the worker running and the network off.

## Pull requests

- Branch from `main`, or from the PR below yours if it isn't merged yet ("after
  #N" in the PR's first line). First check the branch and any uncommitted
  changes. Never work on another agent's branch unless it was handed over.
- **The repo squash-merges:** the PR's title and description become its one
  commit on `main`, so keep the description true as the PR changes. When the
  PR below yours is merged, rebase yours onto `main` without its commits
  (`git rebase --onto origin/main <old base>`), or it conflicts with the
  squashed copy of them.
- **Title** like the history, saying what changes for people using Polku:
  "Phase 22a: the drawer in three tabs", "Fix: the map's credits stay folded on
  phones", "Docs: …". Not `feat:` or `docs:`.
- **Body:** what changes for the user, how you tested it, what isn't done or
  is still unknown. "Fixes #65" for each issue it fixes in full, and the
  issues it found; no closing word ("fixes", "closed"…) before any other
  number, since merging closes it (#383 shut #233). A phase's parts refer
  to the phase issue; the last part fixes it. No attribution lines
  (`Co-Authored-By`, session links) in commits or PR bodies.
- **Milestone:** the PR goes into its issue's milestone. An issue left open in
  a phase's milestone is moved on, with a reason, before the milestone closes.
- **Screenshots** of a change people see, before and after, on the
  `pr-screenshots` branch (DEVELOPING, "Running it"). No images in `main`.
- **In the same PR:**
  - CHANGELOG, as release notes (see "Release notes" below);
  - README.md where a capability it describes is added, changed or removed,
    in its factual style and keeping its qualifications, and docs/USING.md
    where controls or workflows change;
  - for a phase's part: what was built, in its plan in `docs/plans/`;
  - DEVELOPING, where how something works has changed.
- **Offer a review** when a phase PR, or a fix that touches routing, saved
  data or share links, is ready: a fresh session (Claude or Codex, whichever
  has usage left) gets only the PR and issue links, tries to break the
  change, and comments on the PR; the author answers each finding with
  evidence. It runs when the user starts it, and never holds a PR in draft.
- **Drafts until verified.** When one leaves draft, comment `@codex review`
  on it, so the automatic review sees the finished change.
- **Never push to `main` or merge** unless the user says so. The user merges:
  say which PRs are ready (the ones not in draft, in their "after #N" order),
  and which wait and why.
- **When a milestone's last issue closes,** a short retro in `docs/retros/`:
  what cost time, what to keep and what changes in AGENTS.md, with the PRs
  and issues as evidence. Then the milestone is closed.

## Code Review Rules

Codex reviews each PR against this file as it is on the PR's branch. Treat
each of these as P1, and skip style nits:

- **Bloat:** code the task didn't need, a helper or abstraction with one
  caller, a defensive check or fallback nothing has shown is needed, a second
  way of doing what a module already does, old formats kept for compatibility,
  tidying of unrelated code.
- **Drift from this file:** network calls outside `request()`, a new
  dependency, build step or backend, a position leaving the device, Traficom
  data used for routing, missing data that looks complete, a control that
  isn't one of DEVELOPING's shared controls.
- **The PR itself:** a bug fix without its check in `tools/smoke.py`, a
  missing CHANGELOG, README, USING or DEVELOPING update, a title or closing
  word that breaks "Pull requests".

## Bugs and findings

- **File an issue only for a bug you reproduced on `main` that hurts people
  using Polku,** labelled `bug` with its size, once you've searched (a
  symptom that may share a cause goes on the issue that exists). File it
  before your next commit or the end of the turn: what happens, what should,
  for whom, where in the code, the commit. When your branch could be the
  cause, fix it there instead.
- **Everything else you notice** (a suspected bug, a risk, a check that
  failed for no clear reason, an idea) is one line in your Hand-over's
  noticed lines: what, where, the commit. An idea the user wants kept is a
  one-line `idea` issue.
- **The weekly sweep,** a routine on Mondays: a fresh session reads the
  noticed lines since the last sweep and asks the user which few are worth
  an issue. It comments on the "Weekly sweep" issue (the first sweep
  opens it): the commits it covered, what it found, what the user kept.
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
