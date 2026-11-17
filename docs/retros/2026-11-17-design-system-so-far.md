# Retro: Design system, so far

Milestone: [Design system](https://github.com/TommiContursi/Polku/milestone/22), still open. This retro was written on 2026-11-17, at the user's request, before the milestone closed. Its purpose is that the next sessions don't repeat how this work went.

**What shipped:**
- #1039: the mock-up and `docs/plans/controls-inventory.md`.
- #1045: clearer buttons, sizes by the pointer.
- #1046: values and chips on the key's face.
- #1048: the chosen segment in green.
- #1049: Settings' ⓘ.
- #1053: 390 px in AGENTS.md.

**Open:**
- #1050: the planner in Mine 8's shape (draft).
- #1052: Layers' ⓘ (ready).
- #1054: Mine 9's typefaces to compare (draft, another session's).
- #1023: the directions document (draft, from round 1).

**The way here:**
- 2026-10-22: #382 started, with rounds 1 to 5 of looks.
- 2026-11-15: a proof canvas ("Polku: the frame"), round 6, "Polku, yksi runko" (a proposal to fix the structure before the surface), then the grouped mock-up's versions Mine to Mine 8.
- 2026-11-16: a work package of seven small PRs. Four merged, then the user asked for fewer, larger PRs. #1050 grew into the whole planner.
- #382 holds 36 Hand-overs, 30 of them on 2026-11-15 and 16.

## What cost us

**Decisions lived in too many places.** The user's choices were spread over:
- the mock-up's comment threads, about 20 of them;
- chat in several sessions;
- Hand-overs that paraphrased earlier Hand-overs;
- DESIGN.md, which kept every superseded rule beside the new one.

Some examples:
- "No white fill for the groups" was in a Hand-over, with nothing from the user behind it. The user then chose the white fill.
- On 2026-11-16 DESIGN.md held four type scales, three spacing rules and four row heights at once ([#1050's review](https://github.com/TommiContursi/Polku/pull/1050#issuecomment-6931766739), point 12).
- Question c of the work package (fades, scrollbars) was answered in a mock-up thread and in chat, but not on #382. The review couldn't find it.
- Mine 9 (#1054) appeared in another session with no decision behind it.

**The mock-up was called a sketch, and then used too little, and in places followed too closely.** "Mine 8 is a sketch" was right, but the first build of #1050 took only its structure. It left out the keys' looks, the sideways rows with their fades, the quiet scrollbar and the list's finish, which the user had asked for on the mock-up. The user said the mock-ups aren't made in vain. At other points the build copied Mine 8 where it didn't work:
- the profile's ⌃ on the chart covered the wind arrows;
- the list's actions in a sideways row hid **Clear route**;
- the sport ball at the list's left was undone, as the user preferred it on the line.

**The first look the user saw was unfinished.** The planner was shown after its structure was in (headings, groups, the head), before the keys, rows and list matched the mock-up. The user found it hurried and asked whether it could go to production. Each later round answered one more list of the user's findings: the headings inside their groups, the list's keys in a grid, Done's style, the text sizes, the spacing.

**Rules already decided were broken and found only later.** None of these were on the build's checklist, though each was written in DEVELOPING, AGENTS.md or a smoke check:
- #742: the chart doesn't move as the sheet does. Broken by When over the profile, and found by the review session.
- #741: nothing moves when Check answers late. Found in the code before a check failed.
- #690: actions stay in sight. Broken by the sideways keys, and found by the user.
- 390 px as the smallest width. Tested at 360 instead.
- Dark mode's 4.5:1, the focus after a view change, and whole words in a heading. All found by the review session.

**Smoke runs were slow and noisy, and some results were misread:**
- Runs overlapped with screenshot runs and with each other.
- One frozen worktree was moved to a new commit while a run still used it.
- A `pkill -f polku-chrome` may have stopped another session's Chrome.
- Two failures were blamed on the change before main was checked: `panels`' wheel is flaky on main too (#470), and `best_time` fails only at some hours.
- Two were the checks' own timing: a key fact tapped while hidden at half; a step's scroll a frame after the check's `scrollTop`.
- #1051 (Arrive by after 21:00) and #1056 (a duplicate of #470) were filed along the way.

**#1049 did Settings' ⓘ but left Layers out.** The user saw it. #1052 then hid the depth layers' "not for navigation" behind the ⓘ, and the review found it.

**The work grew past what one PR can be reviewed as.** #1050 changes the head, the order, the groups, the headings, the type, the spacing, the list, the scrollbar and the docs. Its review found 13 points, and each round of fixes reached into all of them.

**A planner-only type scale.** Five roles were added on `.sheet` (`--pl-*`), eight of their ten values equal to existing `--font-*` tokens, applied by an override list with high specificity. The review called it a second system beside the first. Whether words step down with a mouse in the whole app is still the user's open question.

## Kept

- A fresh review session that gets only the PR and issue links. It found the real breakages.
- `sideways()` in `js/ui.js`: one helper for every row that scrolls sideways. It replaced the timeline's own copy.
- One class for a group (`pl-group`) and one for a section's heading (`pl-h`), with the heading inside its group.
- Diagnostics before fixes: printing the state at the failing line found both smoke timing faults and the key fact tapped at half.
- Small PRs with one decision each (#1045 to #1049): each was tried and merged within hours.

## What changes in AGENTS.md

These are proposals for the user to decide; nothing here is applied:
1. **One home for a decision.** A choice made in a mock-up thread or in chat goes onto its issue, in a comment headed "Decided by the user", the same day, before it's built on. A Hand-over links to it rather than retelling it. A paraphrase isn't a decision.
2. **DESIGN.md says only what's true now.** A change that replaces a rule removes the old one in the same PR, rather than adding a "built" note beside it.
3. **Before showing a build made from a mock-up:**
   - put it beside the mock-up element by element, at 390 × 844 and 1440 × 900;
   - list what differs and why (left out, or done better), in the PR;
   - list the rules the touched area already has (DEVELOPING's section, the smoke groups' names) and check each.
4. **A mock-up's version is chosen on its issue before it's built.** A new version (Mine 9) says on the issue what it proposes and waits for the user.
5. **Smoke runs:**
   - one run at a time, alone on the machine;
   - a frozen worktree per commit, never moved while a run uses it;
   - never `pkill` a pattern another session's Chrome may match;
   - before calling a failure the change's, run the same group on main.
6. **A PR still carries one decision.** Fewer, larger PRs meant the whole planner in one, which made it hard to review. A package of several PRs, each drawn on the whole mock-up, keeps both the whole and the review.
7. **The design system is one list.** Type, spacing, row heights and the kinds of control are each written once, in DESIGN.md and DEVELOPING's Shared controls. A screen's own scale (`--pl-*`) needs the user's OK first.

## For the next session

- Start from [the latest Hand-over on #382](https://github.com/TommiContursi/Polku/issues/382) and #1050's review and answers.
- **Open decisions:**
  - words a size smaller with a mouse in the whole app;
  - /review-animations on #1050;
  - Mine 9 (#1054);
  - #1055, the rain said twice with two distances.
- **Not built:**
  - "yksi runko"'s living pattern page and its `anatomy` check;
  - Settings' and Layers' headings inside their groups;
  - the cards' places;
  - the toolbar's keys (#1042).
