# Phase 17: weather layers

The design. What's still to do, and its status, is on GitHub: [Phase 17: weather layers](https://github.com/TommiContursi/Polku/milestone/6), phase issue #182. The order of phases is in [ROADMAP](../ROADMAP.md).

Moved here verbatim from docs/ROADMAP.md on 2026-10-16 ([the last full ROADMAP](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/ROADMAP.md)).

## Phase 17 — Weather: clouds, thunder, snow, back in time (planned 2026-10-14)

From the backlog (2026-10-14):
- **New switches** under *Weather on the map*, on the timeline:
  - **clouds** (Open-Meteo low, mid and high cover);
  - **thunder** (FMI's lightning observations; Open-Meteo CAPE and lightning potential);
  - snow moved to phase 15a (the snow-depth fill and FMI's measured depths).
- **The timeline into the past:** the last 2–3 hours of FMI's radar (WMS `time`, kept about two weeks at 5 minutes), playing like the forecast, to see where the rain came from. Past wind and temperature from Open-Meteo's `past_hours`.
- **A check before heavy loads:** when a view would cost many calls to a free service, Polku asks first. That happens with a new layer zoomed out over half of Finland, or with history for every grid point.
  - The message: "This view needs about 450 weather calls (Open-Meteo allows 10 000 a day). Load it?" with *Load*, *Not now* and *Always for this layer*.
  - The numbers come from `net.js` (each service's limits and today's use).
  - Cheap views never ask: today's weather map stays under 60 points a view.

### The ideas it came from

From docs/BACKLOG.md (lines [72](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L72), [73](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L73), [74](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L74), [75](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L75), [76](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L76), [77](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L77), [78](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/BACKLOG.md#L78)), moved here on 2026-10-16 because it's part of this phase's design:

### Weather *(now ROADMAP phase 17, with a check before heavy loads)*
- **More weather on the map** *(2026-10-14)*:
  - **clouds:** Open-Meteo has low, mid and high cloud cover;
  - **thunder:** FMI's open data has lightning observations, and Open-Meteo has CAPE and lightning potential;
  - **snow:** Open-Meteo snowfall and snow depth, FMI snow depth (phase 15).
  - Each would be a switch under *Weather on the map*, on the timeline.
- **Timeline into the past** *(2026-10-14)*: a few hours back, to see how the rain has moved. FMI's radar layers keep about two weeks at 5 minutes (WMS `time`), so the last 2–3 hours could play like the forecast does.
