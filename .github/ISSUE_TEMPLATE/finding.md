---
name: Bug or technical finding
about: Record reproducible behavior or an investigation for Polku
---

## Classification and impact

Confirmed defect / risk or investigation / test-environment failure / optional
improvement. Who is affected, confidence and its limits, proposed priority and why.

Triage: blocks the current delivery / important but independent / unconfirmed
or low impact. Explain why it needs attention now, if it does. Small is an
effort estimate, not urgency. A new finding does not automatically enter Now.

## Evidence and reproduction

Affected commit, steps or fixture/command, expected versus actual result, relevant
code/log links. For browser tests: browser/device, cache and service-worker state,
timing/concurrency and whether services are mocked. State what is not yet known.

## Completion and regression checks

Observable acceptance checks, failure/recovery cases and compatibility to preserve.
For an investigation, describe what evidence would resolve it.

## Related work

Existing issues, the milestone or phase plan (docs/plans/) it belongs to,
dependencies, active contributor and branch/PR when work starts. A
recommendation here does not change approved priorities.

Search related findings first. Link a parent delivery or shared investigation
when useful; add evidence to an existing issue for the same problem. Keep
separate issues when their completion can be verified independently.

Labels: the kind (`bug` for a confirmed defect, `watch` for a risk to look
into) and the size (`small`, `medium`, `big`).

