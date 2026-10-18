# Project progress and roadmap checks

## Design

Priority (Now, Next, Later, Someday) says when work matters. Status (Triage,
Ready, In progress, In review, Blocked, Done) says what is happening. GitHub
issues, their explicit closing PR links and the project fields remain the
source of truth. The roadmap retains the user-approved phase order.

A Python standard-library tool reads complete, paginated API snapshots.
It can claim an issue, record an explicit status, reconcile progress and
print a bounded focus report. Reconciliation is a dry run unless applied;
only closed issues become Done. A draft or changes-requested linked PR
means In progress; otherwise open linked PRs mean In review. Blocked is an
explicit decision that reconciliation preserves until the issue closes.
Open issues with merged PRs are never assumed complete. New issues enter
Triage without being promoted into Now.

GitHub Actions runs trusted default-branch code on metadata events and
every six hours. No AI calls, PR-head execution with project credentials,
automatic prioritisation, issue closure, merging or deployment. A report
flags stale work, missing cards, a crowded Now queue, recent discoveries,
and closed phase issues still in the roadmap. Agents use this evidence to
recommend the next delivery; the user retains phase-order decisions.

## Implementation plan

- [x] Add failing offline tests for status transitions, partial deliveries,
  multiple PRs, reopened issues, pagination, dry runs and idempotence.
- [x] Implement the shared tool and configurable project field names.
- [x] Wire metadata reconciliation, periodic reporting and credential-free
  PR tests. Require project configuration explicitly, with no silent skip.
- [x] Update agent instructions, roadmap rules and finding triage. Document
  one-time field migration, credentials and exact verification commands.
- [ ] Run focused tests, review the diff and open a draft PR. Live project
  setup stays unverified until a project-authorised credential is available.

## Review focus

- A phase with several PRs stays open until its issue is actually closed.
- A merged partial PR cannot complete the parent issue.
- Blocked work does not become active because a PR is opened.
- Pagination and API failures cannot silently produce a partial snapshot.
- Legacy priority values must be preserved before changing Status options.
