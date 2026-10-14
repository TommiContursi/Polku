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
- **Share links re-route imported GPX tracks.** A fixed leg from a file travels as its two ends only, so whoever opens the link gets a routed leg, not your track. LIPAS legs now travel as references (12c); a GPX track would need its line in the link (too long for a URL) or a short-link service. *(2026-10-14)*
- **The tests ran on cached files when the dev server was down** (the headless profile's service worker answered), so they could pass on old code. Fixed 2026-10-14: `tools/cdp.py` stops without a dev server and bypasses the service worker. *(2026-10-14)*
- **The opened attribution on a phone** (tap the ⓘ) runs three lines and under the Plan button until it's closed again. *(2026-10-14)*
- **A tall card on a short screen** (a LIPAS route's card with Ride, about 330 px) can sit under the top bar at 600 px of height. *(2026-10-14)*

## Ideas

### Weather *(now ROADMAP phase 17, with a check before heavy loads)*
- **More weather on the map** *(user, 2026-10-14)*:
  - **clouds:** Open-Meteo has low, mid and high cloud cover;
  - **thunder:** FMI's open data has lightning observations, and Open-Meteo has CAPE and lightning potential;
  - **snow:** Open-Meteo snowfall and snow depth, FMI snow depth (phase 15).
  - Each would be a switch under *Weather on the map*, on the timeline.
- **Timeline into the past** *(user, 2026-10-14)*: a few hours back, to see how the rain has moved. FMI's radar layers keep about two weeks at 5 minutes (WMS `time`), so the last 2–3 hours could play like the forecast does.

### Routes and search *(user, 2026-10-14)*
- ~~Ride a LIPAS route, add one to yours, and find routes and stops in search~~ *(done in 12c)*.
- ~~Search: grouped results, recent searches~~ *(done in 12c)*; still to do: "near me" categories (lean-to, campfire site, parking, water).
- **Loops inside a LIPAS network** (Laajavuoren ulkoilureitit: "Vuorenlenkki 5 km, Kuntolenkki 8.5 km…"): LIPAS doesn't name its parts (`reitti_nimi_fi` is empty), so Ride takes the longest line through them. Picking a loop by clicking its stretches one after another would let you ride "Kuntolenkki". *(12c)*
- **Snap a LIPAS line to the paths:** LIPAS lines are drawn by hand, about one point every 40–75 m, so a ride can cut corners off the real path. An optional "follow the paths" pass (one BRouter call with the line's points as via points) would fix the profile and trail details, at the cost of one call. *(12c)*
- OSM route relations (Waymarked Trails) as rideable routes.

### Water *(phase 13, 2026-10-14)*
- **Depths for routing:** Traficom's hydrographic licence excludes route planning; an agreement with Traficom (copyright@traficom.fi) would allow it. Ask whether a free, non-commercial paddling planner can get one.
- **Water rocks from the NLS terrain database** ("vesikivi", CC BY 4.0) with the user's own free NLS API key, the way Polku's optional MML layers work.
- **A static water-hazards file** (OSM rocks, reefs and shoals for Finland, built weekly by a GitHub Action from Geofabrik's extract), if Overpass stays unreliable. All four mirrors failed while building phase 13.
- **Wind beyond waves:** a headwind or crosswind cost per craft (a canoe in a crosswind), and gusts; the forecast at each leg's own hour on long trips.
- **Show the keep-clear zones and the wind exposure on the map** while planning, so the route's bends explain themselves.
- **Multisport** (ROADMAP phase 13b, OK'd).

### Your own things
- **Saved places** *(user, 2026-10-14)*: star a place and find it again, starting on the device (export and import). They'd sync only if a login comes; see phase 16's backend question.
- **Saved routes:** a list of routes, not just the last one.

### Trail details
- **Fresher trail data:** show a tile's age in the key, a "Refresh trail details here" action, or a background refresh for tiles over a day old (Trailmap's makers have had trouble with data that only updates a few times a day). *(2026-10-14)*
- **Uphill band at the trail's width:** see Bugs.
- **Static trail tiles** (PMTiles built weekly by a GitHub Action from Geofabrik's Finland extract) if Overpass stays flaky. *(phase 12 design)*

### Planner
- The route's colour sits in the header and in the profile *(done in #37)*.
- **A quick point on the line** (Alt-click, say) if two clicks for a point (#48: a click opens the part's menu, "Add a point here" is its first button) feel slow. Dragging already makes one. *(2026-10-14)*
- **More grab handles along long legs,** by their length on screen, so it's clear the whole line can be dragged, not just its middle. *(2026-10-14, from the user's question about extra points on long legs)*
- **Avoid profiles** ("Avoid obstacles and faint trails") with Polku's own BRouter profiles, if warnings and ranking turn out not to be enough. *(phase 12 design; the user chose warnings first)*

## Things to watch (possible future issues)

- **FMI retires its old radar layers at the end of November 2026,** including `suomi_rr_eureffin`, which "now" reads. Polku falls back to reflectivity on its own, but that overstates drizzle. Find the replacement before then (ROADMAP, phase 12 "Later"). **Dated.**
- **brouter.de pauses busy devices** ("retry later"; escalates to about 30 minutes). Never burst-test it: use the local BRouter (`tools/brouter-local.sh`). Valhalla on FOSSGIS stands in.
- **Overpass mirrors are flaky:** 504s on every mirror at times while building phases 12 and 13. Trail details are best-effort and cached; route warnings from BRouter don't depend on it. The water router waits 2.5 s for OSM's rocks, then routes without them and re-routes when they arrive.
- **Traficom's licence:** its depth layers are shown "not for navigation" and never used for routing. If Traficom changes the licence or asks, the layers can be dropped from Paddle's defaults. **Watch.**
- **Free tiers if Polku gets popular:**
  - Open-Meteo: 10 000 calls a day per IP, non-commercial;
  - Overpass: 10 000 a day in `net.js`;
  - FMI: 20 000 a day;
  - GitHub Pages: about 100 GB a month of bandwidth.
  - The counters are in Settings → data sources.
- **OpenFreeMap's tile URLs change weekly;** saved offline areas use version-free keys (`sw.js`).
- **LIPAS search costs three requests** per query (12c: the combined layers `lipas_kaikki_reitit` / `lipas_kaikki_pisteet` take one filter for every type). If LIPAS renames or drops those layers, search loses its routes and stops (Places still work).
