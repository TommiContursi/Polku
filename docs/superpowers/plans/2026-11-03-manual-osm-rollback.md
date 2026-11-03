# Manual OSM rollback implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. The owner authorized continuation and merging; do not pause for another integration choice.

**Goal:** Keep explicit protected rollback available while scheduled OSM publication is disabled.

**Architecture:** Change the existing rollback job's eligibility to manual dispatch on main. Keep its protected environment, approval variable, immutable release validation, full SFTP/HTTP verification and atomic promotion unchanged.

**Tech Stack:** Existing GitHub Actions, Python unittest and focused osmdata smoke.

**Spec:** Issue #700; existing release operating rules in docs/OSM_DATA.md.

## Global constraints

- No secrets, account settings, scheduling flag or hosting configuration changes.
- Keep rollback restricted to manual dispatch on main, using osm-data-production.
- Do not rebuild, delete or overwrite immutable archives. Existing publication continues independently.
- Use the standard osmdata entry point for the regression; no whole local suite.

## Review focus

Manual rollback must work with an absent/false scheduling flag. Feature branches, scheduled jobs and push events must stay ineligible. Publisher approval and rollback round-trip tests must still pass; an eligibility test must not issue a live rollback.

### Task 1: Restore manual recovery eligibility

**Files:** .github/workflows/osm-data.yml; tools/osm_data/test_publish.py; tools/smoke.py; docs/OSM_DATA.md.

**Interfaces:** Existing workflow_dispatch operation=rollback, release=immutable release ID; existing publish.py rollback --manifest. No new runtime interface.

- [ ] Add a rollback eligibility matrix to PublishTests and register it in osmdata: manual/main/flag absent, false and true succeeds; non-main, schedule, push and another operation fail. Evaluate the checked-in job condition, not a copied predicate. Run the check against main and observe failure.
- [ ] Replace the rollback job's scheduling-flag dependency with github.ref == refs/heads/main, matching publish-existing's protected manual model. Run all Python/Node data checks and focused osmdata smoke; no network-side rollback in tests.
- [ ] Document manual rollback independence from scheduled publication. Commit/push a small Fix PR for #700 in Fixes: November 2026; request automated review, address findings and merge under the owner's standing authorization after CI passes.
