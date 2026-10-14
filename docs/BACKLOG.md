# Polku backlog: bugs, ideas, things to watch

Everything noticed but not done yet, so nothing gets lost between phases. The
ordered plan lives in [ROADMAP.md](ROADMAP.md); when an item here becomes
work, it moves there (or into a fix PR) and is ticked off here.

Each item says where it came from and when. *User* means the user's own note
or idea.

## Bugs and quirks

- **Rain labels at "now" come from the forecast.** The small "0.2 mm/h" labels stay on while the FMI radar draws "now", so they can disagree. Show the radar's rate at "now", or hide them. *(2026-10-14, while fixing the radar)*
- **The timeline can say "· radar" instead of "· FMI radar"** until it redraws: the label is set before FMI's image arrives. *(2026-10-14)*
- **The uphill band has one width.** Uphill grades come from the vector tiles, which have no width, so in Uphill mode the band doesn't follow the trail's width; the centre line does. Grading the trail-details ways instead would fix it. *(2026-10-14, user)*
- **Trail-detail tiles are cached a week,** so a fallen tree cleared yesterday still shows. *(2026-10-14; see "Fresher trail data" below)*
- **Smoke (headless Chrome) can fail the phone sheet heights** when the machine is short of network connections or CPU: seen once, not reproduced. Watch for it. *(2026-10-14)*
- **On a 360 px phone the summary's "↓57 m" nearly touches Done.** *(2026-10-14)*

## Ideas

### Weather
- **More weather on the map** *(user, 2026-10-14)*:
  - **clouds:** Open-Meteo has low, mid and high cloud cover;
  - **thunder:** FMI's open data has lightning observations, and Open-Meteo has CAPE and lightning potential;
  - **snow:** Open-Meteo snowfall and snow depth, FMI snow depth (phase 15).
  - Each would be a switch under *Weather on the map*, on the timeline.
- **Timeline into the past** *(user, 2026-10-14)*: a few hours back, to see how the rain has moved. FMI's radar layers keep about two weeks at 5 minutes (WMS `time`), so the last 2–3 hours could play like the forecast does.

### Routes and search *(user, 2026-10-14; planned as phase 12c)*
- Ride a LIPAS route, add one to yours, and find routes and stops in search (see ROADMAP 12c).
- Search: grouped results, recent searches, "near me" categories (lean-to, campfire site, parking, water).
- OSM route relations (Waymarked Trails) as rideable routes.

### Your own things
- **Saved places** *(user, 2026-10-14)*: star a place and find it again, starting on the device (export and import). They'd sync only if a login comes; see phase 16's backend question.
- **Saved routes:** a list of routes, not just the last one.

### Trail details
- **Fresher trail data:** show a tile's age in the key, a "Refresh trail details here" action, or a background refresh for tiles over a day old (Trailmap's makers have had trouble with data that only updates a few times a day). *(2026-10-14)*
- **Uphill band at the trail's width:** see Bugs.
- **Static trail tiles** (PMTiles built weekly by a GitHub Action from Geofabrik's Finland extract) if Overpass stays flaky. *(phase 12 design)*

### Planner
- The route's colour sits in the header and in the profile *(done in #37)*.
- **Avoid profiles** ("Avoid obstacles and faint trails") with Polku's own BRouter profiles, if warnings and ranking turn out not to be enough. *(phase 12 design; the user chose warnings first)*

## Things to watch (possible future issues)

- **FMI retires its old radar layers at the end of November 2026,** including `suomi_rr_eureffin`, which "now" reads. Polku falls back to reflectivity on its own, but that overstates drizzle. Find the replacement before then (ROADMAP, phase 12 "Later"). **Dated.**
- **brouter.de pauses busy devices** ("retry later"; escalates to about 30 minutes). Never burst-test it: use the local BRouter (`tools/brouter-local.sh`). Valhalla on FOSSGIS stands in.
- **Overpass mirrors are flaky:** 504s on every mirror at times while building phase 12. Trail details are best-effort and cached; route warnings from BRouter don't depend on it.
- **Free tiers if Polku gets popular:**
  - Open-Meteo: 10 000 calls a day per IP, non-commercial;
  - Overpass: 10 000 a day in `net.js`;
  - FMI: 20 000 a day;
  - GitHub Pages: about 100 GB a month of bandwidth.
  - The counters are in Settings → data sources.
- **OpenFreeMap's tile URLs change weekly;** saved offline areas use version-free keys (`sw.js`).
- **LIPAS search costs one request per route type** (the WFS refuses several types at once): keep it debounced and cached.
