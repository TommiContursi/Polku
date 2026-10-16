# Phase 16: Strava & Garmin

The design. What's still to do, and its status, is on GitHub: [Phase 16: Strava & Garmin](https://github.com/TommiContursi/Polku/milestone/12), phase issue #188. The order of phases is in [ROADMAP](../ROADMAP.md).

Moved here verbatim from docs/ROADMAP.md on 2026-10-16 ([the last full ROADMAP](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/ROADMAP.md)).

## Phase 16 — Strava & Garmin (research and plan only)

- The brief is in **Later: Strava & Garmin** below.
- **Deliverables:**
  - local import of a Strava bulk export or a GPX/FIT folder into a heatmap in IndexedDB;
  - FIT course export for Garmin devices;
  - the OAuth options (a tiny serverless token exchange) and what Strava's and Garmin's APIs and terms actually allow;
  - using the history to calibrate speeds per sport (phase 6), and in route style and round trips to prefer familiar places or explore new ones.
- Written here as findings and a plan; **no code until the user OKs it.**

## Later: Strava & Garmin (not started; research first, no code)

The brief, kept here so it isn't lost. When it's time, the first deliverable is research and a phased plan, not code.

1. **Sending routes.**
   - Check what Strava's API actually allows (it probably can't create routes; verify).
   - Check what Garmin requires: the Courses API through the Garmin Connect Developer Program, which needs approval.
   - Compare with what works without approval: GPX export (exists) and a FIT course export to copy onto a device.
2. **My own activities as a heatmap.**
   - **Option A, no backend:** import a Strava bulk-export zip or a folder of GPX/FIT files, build the heatmap in the browser and store it in IndexedDB.
   - **Option B:** Strava OAuth with a tiny serverless token exchange (e.g. a Cloudflare Worker). Check Strava's current API terms and rate limits.
3. **Using the history.**
   - Estimate real speeds per activity; this feeds the presets from phase 6.
   - In route generation (phase 10), prefer familiar or new places by ranking candidates on how much they overlap the heatmap.
4. **Privacy:** data stays on the device unless the user chooses otherwise.

The smallest first step is expected to be option A plus a FIT course export. Phases 6 (speeds) and 10 (ranking) are built so that history can plug in later.
