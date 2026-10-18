# Project progress and focus

The [project](https://github.com/users/TommiContursi/projects/1) separates
**Priority** (Now, Next, Later, Someday) from **Status** (Triage, Ready,
In progress, In review, Blocked, Done). Priority is a decision about when;
Status records what is actually happening. The user approves phase order.

## One-time setup

The repository connection used to prepare this change cannot read or edit
personal Projects settings or repository secrets. These steps must be
completed by an owner-authorised local Codex/Claude session or in GitHub.

1. Export the existing project table as TSV as a backup. Create the
   single-select **Priority** field with Now, Next, Later and Someday.
   If those values are currently in **Status**, copy every existing value
   into Priority first, including archived items and PR cards. Verify the
   copy before changing Status. Preserve existing board order.
2. Configure Status with Triage, Ready, In progress, In review, Blocked and
   Done. Set existing open issues to Triage initially and retain Done for
   closed issues; the first sync reconstructs progress from linked PRs.
   For claimed work with no PR, use the claim command below. Old claims
   need a one-time review against their latest handover.
3. Group the main board by Priority and show Status as a field. Use an
   issues-only view (`type:Issue`); PRs remain linked development evidence.
   Use a second view grouped by Status when reviewing active work. This
   automation updates issue cards, not independent PR or draft-note cards.
4. Turn off built-in Status-changing workflows to avoid competing writers,
   including Item added, Item closed, Item reopened, PR merged, PR linked,
   review approved and changes requested. Leave Auto-close issue off:
   changing a card must not close an issue. Auto-add and sub-issue auto-add
   can remain enabled. Inspect the red warnings in the UI separately;
   this change does not claim to repair their unknown causes.
5. For this user-owned project, GitHub documents a classic personal access
   token with `project` and `repo` scopes. Set an expiry, create it in your
   own account and save it as the repository Actions secret
   `POLKU_PROJECT_TOKEN`. Never paste it into a chat, issue, file or commit.
   The ordinary `GITHUB_TOKEN` cannot access Projects. Local commands use
   `GH_TOKEN`, `GITHUB_TOKEN`, or the credential from `gh auth token`.
6. Run the read-only command below, inspect its proposed moves, then apply
   and rerun it. Verify representative issue cards in GitHub. After this
   PR is merged, run **Actions → Project progress → Run workflow** once
   without Apply, then with Apply. Scheduled runs start on the default
   branch after merging; merging alone does not configure fields/secrets.

Authentication reference:
https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions

```sh
python3 tools/project.py sync
python3 tools/project.py sync --apply
python3 tools/project.py sync
```

The final dry run should propose no further changes. A failed API call
fails the run visibly; successful earlier writes may already exist.
Rerunning reconciles them. Mutation requests are never blindly retried.
Do not remove legacy Status values until their priorities are preserved:
the tool deliberately refuses to overwrite them.

## Starting, handing over and resuming

At a session's start, read `python3 tools/project.py focus`. It is a compact
report of the approved first phase, active work, Now, recent findings,
possible groups and inconsistencies. Then read the selected issue and its
last handover. A missing credential is a blocker to automated board
updates, not evidence that the board is current; report it explicitly.

Claiming both records the contributor/branch and updates the card:

```sh
python3 tools/project.py claim 233 --agent Codex --branch codex/phase-25a
python3 tools/project.py claim 233 --agent 'Claude Code' --branch claude/phase-25a
python3 tools/project.py status 233 Blocked --reason 'Waiting for the agreed prerequisite PR.'
python3 tools/project.py status 233 Ready --reason 'The prerequisite merged; ready to resume.'
```

Do not steal active work: check the existing claim and handover before
using claim. Takeovers follow AGENTS.md. A claim is an agent action, not
something GitHub can infer from an unpushed local branch. Blocked is an
explicit decision, and remains so until explicitly released or closed.
Keep the usual handover at every checkpoint. Run sync after making a PR
ready or requesting changes if you need the board updated immediately.

## What updates automatically

- New repository issues are added as Triage. Their Priority is left empty
  until triage, so a new finding cannot jump into Now by itself.
- An open closing-linked draft PR, or any closing-linked PR with changes
  requested, means In progress. Otherwise open closing-linked PRs mean
  In review. These are readiness signals, not proof that checks passed.
- Use real Development/closing links (`Fixes #n`) for the issues the PR
  fully delivers. A mention or `Part of #n` is not such a link. For a
  multi-PR phase, claim the parent explicitly and link each PR to the
  independently complete child issue; do not close the parent prematurely.
- Closed issues become Done. A merged PR alone never completes an open
  issue. Reopened issues previously marked Done become Ready, unless an
  active PR provides a stronger signal. Closed unmerged PRs never mean Done.
- With several linked PRs, any draft or changes-requested one keeps the
  issue In progress. Explicit Blocked takes precedence while it is open.
- Archived cards are not restored or changed automatically; open archived
  issues appear in the report for review.

Issue and PR metadata events reconcile the complete snapshot, so coalesced event runs
do not leave only the latest event reflected. Six-hourly runs recover from
missed events and attach a focus report to the Actions job summary. Manual
runs default to report-only. Scheduled/event runs apply progress changes.
Review submissions and dismissals are picked up by the six-hourly run or
by `sync --apply` in an active session. No credential is exposed to the
PR-sourced `pull_request_review` workflow context.
No priority decisions, issue closure, duplicate merging or AI calls occur.

The privileged workflow always checks out the repository's default branch,
never a PR head. PR tests use a separate workflow with no project secret.
Keep that boundary when modifying this tooling.

## Keeping focus

Now holds one main delivery and its necessary blockers, normally at most
three issue cards. Parent/child views show the delivery without putting
every small task at the top level. A child can be tracked separately
without being promoted to Now.

For every discovery, search related work first, then decide: blocks the
current delivery, important but independent, or unconfirmed/low impact.
Only the first category interrupts the agreed delivery, apart from an
urgent user-impacting regression. Keep the evidence; link related findings
to a parent outcome or an existing issue. Different symptoms may have
different causes, so shared titles or milestones are investigation leads,
not automatic duplicate decisions. Small describes effort, not urgency.

After each delivery, briefly check what shipped, its remaining blockers,
and the next step. After three merged PRs since the last focus review,
after seven days, or when a supposedly small blocker consumes a focused
session, reassess direction. This is a review trigger, not an instruction
to stop useful work mechanically. The report shows the count and age;
agents must recognise the growing-blocker trigger during the session.

A real focus review recommends one next delivery, user benefit, remaining
blockers and what can wait. Record its reasoning on the current phase or
delivery issue, then update `focus_reviewed_at` in `.github/project.json`
to that review's UTC time in the next PR. The timestamp records when the
review actually happened, not when an automatic report ran. No second task
list or AI-generated daily issue is created.

## Verification

```sh
python3 -W error -m py_compile tools/project.py tools/test_project.py
python3 -m unittest discover -s tools -p test_project.py -v
```

Offline tests cover inference and reporting, not permission to access the
live project. Live acceptance also needs the one-time setup above and a
dry/apply/dry check: a draft PR issue, ready PR issue, explicitly blocked
issue, closed issue and a multi-PR phase. Confirm a second run is a no-op
and that all Priority values stayed unchanged. No browser smoke suite is
needed: no application code changes.
