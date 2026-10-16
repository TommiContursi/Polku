# Phase 24: design review

The design. What's still to do, and its status, is on GitHub: [Phase 24: design review](https://github.com/TommiContursi/Polku/milestone/1), phase issue #177. The order of phases is in [ROADMAP](../ROADMAP.md).

Moved here verbatim from docs/ROADMAP.md on 2026-10-16 ([the last full ROADMAP](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/ROADMAP.md)).

## Phase 24 — Design review (planned 2026-10-15; research first, no code)

Polku has grown one phase at a time, each designed on its own. An idea from testing (2026-10-15): look at the whole of it once, on a phone and on a desktop, with the design guidance that now exists as skills for coding agents. Small things found in testing show the need, for example the sheet that's hard to swipe ([#96](https://github.com/TommiContursi/Polku/issues/96)) and the map that doesn't always fit above it ([#88](https://github.com/TommiContursi/Polku/issues/88)).

**1. The tools, looked at first** (checked 2026-10-15; nothing installed yet):
- **Impeccable** ([impeccable.style](https://impeccable.style)): a free design skill for coding agents, with a public GitHub repository (its licence still to check). It has critique and audit commands, a detector with 59 checks for common AI-made design defaults that runs without a model, and checks that can run on pull requests. It installs as a Claude Code plugin or into Codex, with hooks that need approving.
- **Emil Kowalski's skills** ([emilkowal.ski/skill](https://emilkowal.ski/skill)): 16 skills, mostly about motion (review and improve animations, animation performance), plus Apple's interface principles for the web, small fixes that make a web app feel native on a phone, and a skill that tries to break a UI with worst-case data. The page doesn't state a licence; check the repository.
- Others to compare: a taste skill, web interface guidelines, awesome-design lists, image to code, and the Playwright CLI for checking motion.

Which to install, and where, is the user's call: plugins with hooks run on every session. They're tools for reviewing, never shipped in Polku.

**2. The review.** Run the chosen audits on the main flows at 390 × 844 and 1440 × 900, in light and dark:
- opening Polku;
- drawing a route;
- a round trip;
- Check and Go;
- Settings and the layers (the quick layer drawer, #123, has a mock-up and a plan to start from: [issue-123-layer-drawer.md](issue-123-layer-drawer.md));
- out on the trail (23a's heading).

Look at:
- touch targets;
- how the sheet moves;
- motion;
- type and spacing;
- contrast;
- what a phone user can reach with one thumb.

**3. The outcome:**
- a report in `docs/reviews/<date>-design/`, with screenshots;
- each finding worth doing becomes an issue labelled `enhancement`, or goes into the phase it belongs to (21, 22b, 20);
- ROADMAP updated.

**Not in it:**
- a redesign for its own sake;
- a new framework, dependency or build step;
- a generic look in place of Polku's own: the map first, plain words.
