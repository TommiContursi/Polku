# Polku roadmap: planner, layout, sports, editing, smarter routes

Status: **approved 2026-10-13.** Each phase below ships as one PR. Do them in order unless this file says otherwise, and update the status table after every PR.

Also approved:
- On desktop the Plan button moves into the search bar (phase 1).
- Route preferences go into share links as a short `p=` parameter (phase 9).

| # | Phase | Branch | PR | Status |
|---|---|---|---|---|
| 0 | UI polish (Plan button, Weather button, grouped chips) | `ui-polish` | [#12](https://github.com/TommiContursi/Polku/pull/12) | merged |
| 1 | Planner panel: side panel on desktop, peek / half / full sheet on phones | `planner-panel` | [#13](https://github.com/TommiContursi/Polku/pull/13) | in review |
| 2 | One clock, and paddling conditions instead of a water "profile" | `one-clock` | #14 → re-landed as [#15](https://github.com/TommiContursi/Polku/pull/15) | merged (#14 went into the stacked base by accident; #15 brought it to `main`) |
| 3 | Map chrome: activity pill, base map switcher, rail and thumb reach | `map-chrome` | [#16](https://github.com/TommiContursi/Polku/pull/16) | merged |
| 4 | Layers, legend and Settings — and one place for each kind of control | `layers-settings` | [#17](https://github.com/TommiContursi/Polku/pull/17) | merged |
| 5 | More sports: road, trail run and run join the four we have | `sports` | [#18](https://github.com/TommiContursi/Polku/pull/18) | in review |
| 6 | My speeds: Easy / Normal / Fast and custom, per sport | `speeds` | — | |
| 7 | Editing on the map: drag the line, live preview, long-press, point menu | `edit-on-map` | — | |
| 8 | Waypoint list: reorder, rename, delete, undo for everything | `waypoints` | — | |
| 9 | Route preferences: avoid ↔ prefer sliders, mapped to BRouter | `route-prefs` | — | |
| 10 | Round trips: 3 generated loops, ranked, with the cost shown | `round-trips` | — | |
| — | Winter sports (ski, snowshoe) | — | — | later; the sports model in phase 5 leaves room |
| — | Strava & Garmin (see the end of this file) | — | — | later: research and plan first, no code yet |

## Why this order

- **1 and 2 come first.** They fix the biggest complaint: while planning you see panels, not the map. They also build the panel that phases 6–10 all add to: speed chip, waypoint list, preferences and round trips.
- **3 before 5.** Seven sports don't fit the current activity row, so the activity pill has to exist first.
- **4 next to 3.** Base maps leave Layers in phase 3, so Layers can then be cut down to overlays only.
- **6 after 5.** Speeds are set per sport, so the timing model gets one rewrite, not two.
- **7–8 before 9–10.** Generated loops have to be editable like any other route. Ranking them needs the preference model from phase 9 and the speeds from phase 6, which turn a target time into a distance.

## What I saw (1440 × 900 and 390 × 844, MTB, gravel, hike and paddle, with a route and the timeline open)

- **Desktop:**
  - The planner sheet (468 px, 52 vh) and the timeline (189 px) stack.
  - With a route open, about 225 px of map is left in the middle, above both.
  - The route itself is usually hidden behind them.
- **Phone:**
  - The sheet takes 439 of 844 px.
  - Its content is 725 px tall, so the elevation chart starts at the bottom edge.
  - The activity row wraps ("Hike &⏎run").
  - The planner's toolbar has 10 icons in a row.
- **Two departure controls:**
  - The timeline says "Also your route's departure"; the planner has its own "Start: Now" select.
  - They're linked, but you have to learn that.
- **Paddle:**
  - A 10.6 km lake route reports 17 m up and 17 m down.
  - The chart shows a 95–105 m wiggle with spikes at the carries; it's DEM noise on water.
  - The Terrain chips (Gradient) mean nothing there.
- **Layers:**
  - 12 sections and 32 switches.
  - The content is 3,082 px tall, but only 356 px is visible while planning.
  - Base maps, Data sources, Offline maps and the MML key are all in the same list.
- **Switching activity re-routes every leg,** which costs one BRouter call per leg. With seven sports people will switch more, so the per-leg cache matters more.

## Facts checked against the services

- **BRouter `profile:xxx=value` URL parameters** override a profile's variables.
  - Confirmed in the source (`ServerHandler.java`) and with a live call to brouter.de.
  - The stock `gravel`, `trekking`, `fastbike` and `hiking-mountain` profiles expose these as variables:
    - `consider_traffic` and `consider_elevation`;
    - `avoid_unsafe` and `prefer_unpaved_paths`;
    - `avoid_steep_inclines` and `hiking_routes_preference`;
    - `allow_steps`, plus more.
  - The stock `mtb` profile exposes almost nothing.
- **BRouter round trips:** `engineMode=4&roundTripDistance=<radius m>&direction=<deg>`, plus optional `roundTripPoints` and `allowSamewayback`.
  - One request returns a whole loop.
  - Tested on brouter.de: a 1.5 km radius near Tampere gave an 8.1 km loop (about 5.4 × the radius).
- **Custom profiles:** a profile can be uploaded with `POST /brouter/profile`, which returns a `custom_…` id (limit 100,000 characters).
  - How long brouter.de keeps one isn't documented, so Polku must re-upload when an id is refused.
- **The public BRouter server is shared.**
  - It queues requests and refuses when busy (short max wait).
  - Everything that routes often (live drag, sliders, loops) needs debounce, abort and the per-leg cache, and goes through `request('brouter', …)` in [js/net.js](../js/net.js).

---

## Phase 1 — Planner panel

**Goal:** the map stays visible while planning.

**Changes**
- **Desktop (≥ 900 px), a left side panel** (about 380 px wide) under the search, instead of the bottom sheet.
  - The map keeps about 74 % of a 1440 px screen (now about 47 %, or 25 % with the timeline open).
  - It has two states:
    - **Open:** full height, scrolls.
    - **Minimised:** a compact card with the peek content.
- **Phones and narrow windows: a bottom sheet with three snap points.**
  - **Peek** (about 112 px): drag handle, then distance · time · ascent, then routing mode (follow paths / straight / over water) and Done.
  - **Half** (about 50 %).
  - **Full** (about 92 %, with the map's top edge still showing).
  - You switch by dragging the handle, tapping it, or with <kbd>↑</kbd> / <kbd>↓</kbd> while the handle is focused.
- **Auto-peek.**
  - Tapping the map to add a point, dragging a point, or panning while planning drops the phone sheet to peek.
  - It stays there until you expand it, so it never jumps back up on its own.
  - Desktop doesn't auto-collapse, because the side panel doesn't cover the map.
- **Collapsible sections:** Profile, Climbs, Heads-up and Weather.
  - Later phases add Waypoints, Preferences and Round trip.
  - Each section header shows a one-line summary when collapsed, e.g. "Heads-up · 4" or "Weather · 2 °C, light wind, dry".
  - Open/closed state is remembered (`polku:sections`).
- **Toolbar.**
  - Kept in view: undo, redo, reverse, back to start.
  - In a ⋯ menu: import GPX/KML, export GPX, share link, save offline, clear.
  - No more wrapping on phones.
- **Map padding.**
  - `map.setPadding()` follows the panel, so `fitBounds`, "focus this climb" and the visual centre all respect the visible area.
  - This replaces the hand-made padding in `focusRange` and the offline/share fits.
- **The Plan button.**
  - Desktop: it moves into the search bar as a route icon (like Google's directions button), right where the side panel opens. This partly reverses #12, but #12 assumed a bottom sheet.
  - Phones: keep the bottom pill from #12.
- **Dev tooling.**
  - Commit `tools/shoot.py`, the headless-Chrome screenshot script used for #12. It produces before/after shots at both widths.
  - Commit `tools/smoke.py`: load the app, draw a straight-line route (no API calls), cycle the panel states, and fail on console errors or any overlap between known UI boxes.

- **Resizable width** (added after review). Drag the grip on the side panel's right edge (340 px to about 60 % of the screen).
  - The width is remembered; double-click switches between narrow and wide.
  - A wide panel puts the chip groups side by side again (container query).

**Built (PR #13)**
- Everything above.
- **Undo fix:** a second `snapshot()` method (offline save) had silently replaced the undo one, so undo after adding a point did nothing. It's now `routeSnapshot()`.
- **Attribution:** it collapses to its (i) while planning.
- **Full phone sheet:** it hides the map chrome under it.
- **Toasts:** they stay below the search bar.
- **Timeline:** it sits above the attribution line.
- **Phones:** the +/− buttons are hidden on touch phones (pinch zooms), pulled forward from phase 3.
- **Tooling:** `tools/shoot.py` and `tools/smoke.py` (`tools/cdp.py` drives headless Chrome; fixtures in `tools/fixtures/`).

**Cut**
- Momentum/fling physics: three snap points are enough.
- A separate landscape-phone layout.

**Risks**
- Sheet drag vs map gestures. [js/gestures.js](../js/gestures.js) sends pinches over the UI to the map, so the handle needs `touch-action: none` and its own pointer handling.
- iOS Safari: `100vh`, the safe-area inset and the bottom bar. Use `dvh` with a `vh` fallback.
- Every place that reads `--sheet-h` has to learn about the side panel: toast, track card, 3D pad, attribution, the offline banner and modal cards.
- Tablets around 768–1024 px: pick the breakpoint by trying both layouts.

**Done when** at 1440 and 390 px, a 3-point route stays visible while drawing and dragging, the sections remember their state, and smoke.py passes.

## Phase 2 — One clock, and paddling conditions

**Changes**
- **One departure control.**
  - While planning, the timeline docks into the planner as a **Departure & weather** section.
  - It's the same DOM and logic ([js/wxmap.js](../js/wxmap.js)), moved into the panel instead of floating. The strip already shows your ride as a band.
  - The floating bar comes back when you close the planner.
  - The planner's own "Start" select goes away.
  - Peek shows "Depart 14:00 → back 15:40"; tapping it opens the section.
- **No stacking.**
  - The floating timeline and the planner are never both on the map.
  - On phones the floating timeline is already hidden while planning; desktop now matches.
- **Wide profile for long routes** (from review of phase 1).
  - An expand button on the profile lays the chart across the map, right of the side panel (or full width on phones in landscape).
  - Drag on the chart to zoom into a stretch; the map fits that stretch. A reset button zooms back out.
- **Timeline width.**
  - Docked, it follows the (resizable) panel width.
  - Floating, it gets an edge grip to drag it wider, like the panel, and the width is remembered.
- **Paddle.**
  - The elevation chart is replaced by a **conditions chart** along the route:
    - wind and gusts, with head / cross / tail colours;
    - direction arrows;
    - temperature and rain;
    - carries marked.
  - The Terrain chips are hidden; Ground becomes "Way type" (water / carry).
  - Stats show Carry and the strongest headwind instead of Ascent / Descent.
  - Ascent and descent on water samples are no longer counted ([js/analysis.js](../js/analysis.js)); carries still count.

**Built (PR #14)**
- Everything above, except a separate wide-profile overlay. It turned out unnecessary: the resizable side panel, the bottom dock and chart zoom cover long routes.
- **Planner position on desktop** (from review). The ⋯ menu moves the planner between:
  - **left:** the side panel;
  - **bottom:** a full-width panel. Its peek is one slim bar, with the summary, routing modes and common tools on a single row.
- **The bottom panel when wide:**
  - the lists sit in columns: Climbs | Heads-up | Departure & weather (wider);
  - sections are always open there;
  - the accordions stay for the side panel and phones.
- **Desktop also has a red Plan fab at the bottom right,** besides the one in the search bar.
- **Gestures:** over panels (planner, Layers, dialogs, timeline), wheel and pinch no longer move the map. Pinch / Ctrl+wheel over the profile zooms the profile.
- **Profile zoom:**
  - drag (mouse) or double-tap (touch) zooms;
  - "Whole route" resets;
  - the map frames the stretch.
- **Floating timeline** (when not planning, desktop):
  - drag the title bar to move it and the edge grip to resize it; both are remembered;
  - double-click resets it;
  - it never covers the button column.
- **Paddle:**
  - a conditions chart: wind area coloured by head / cross / tail, gusts dashed, direction arrows, rain bars, carries in orange;
  - summary shows Carry; stats show headwind share and the strongest wind;
  - chips are Way type and the weather ones only;
  - ascent no longer counts water.

**Cut**
- Waves, currents and fetch modelling, which have no free source with browser (CORS) access.
- A separate departure picker for return trips.

**Risks**
- [js/wxmap.js](../js/wxmap.js) assumes the bar is absolutely positioned. The strip's ResizeObserver and the play/scrub handlers must survive being moved into the panel.
- Timeline weather toggles (Wind, Temperature, Rain) still drive map layers while docked.

## Phase 3 — Map chrome

**Changes**
- **Activity pill.**
  - Only the active sport shows, as a pill beside the search.
  - It opens to the others on hover (desktop) or tap (touch), and closes after you pick one.
  - That frees the second row on both widths, and leaves room for seven sports and, later, winter.
- **Base map switcher**, Google Maps style.
  - A square thumbnail button at the bottom left shows the base map you'd switch to.
  - It opens a row of thumbnails: Trail map, Maastokartta, Aerial, Aerial FI, Plain, Night, and MML when a key exists.
  - The thumbnails are small static images made once with `tools/shoot.py` (about 6 × 8 KB webp in `img/base/`), not live mini-maps.
  - 3D terrain also gets a spot in the switcher.
- **Rail and thumb reach.**
  - Phones:
    - Layers, Weather, 3D and locate move to a bottom-right column above the Plan pill.
    - The compass appears only when the map is rotated.
    - +/− are hidden on touch, since pinch zooms (already done in phase 1).
  - Desktop keeps the top-right rail and zoom.
  - smoke.py checks for overlaps at 1440 × 900, 1024 × 768, 390 × 844 and 360 × 740, across the rail, zoom, compass, Plan/Done, timeline, planner and toasts.

**Built (PR #16)**
- **The sport pill** sits in the top row, after the search. It opens on hover (mouse) or tap, works with arrow keys, and closes on pick, Escape or an outside tap. Phones show its icon only.
- **The base map switcher** sits at the bottom left, beside the planner when it's open.
  - It opens thumbnails of every base, with a short note and the 3D terrain switch.
  - "More layers…" opens Layers, and the Base map section is gone from there.
  - Thumbnails come from `tools/thumbs.py`. Aerial reuses the NLS photo, so no Esri-derived image is stored.
- **Phones:**
  - Layers, Legend, Weather and a new Locate button form a column at the bottom right, above the Plan pill. The column rises above the timeline when it's open (`--wx-h`).
  - The compass sits top right; 3D moves to the switcher.
  - While planning, only Layers stays.
- **Space:** everything that sat under the old activity row moved up (side panel top 64 px, zoom hint and compass at 62 px).
- **Bottom-panel columns** are a flexible row, so an empty list (no climbs on a lake) gives its room to Departure & weather.

**Cut**
- Custom base-map ordering.
- Per-base opacity.

**Risks**
- How discoverable the pill is (it needs a chevron and the sport's name, not just an icon).
- Thumbnails going stale when styles change. Regenerating them is one command.

## Phase 4 — Layers, legend and Settings

**Changes**
- **Layers: overlays only**, grouped and collapsible.
  - Groups: Trails & routes, Water, Places, Traffic & safety, Weather, Terrain & shading.
  - Each group header shows how many overlays are on.
  - An **"On now"** row of chips at the top: tap × to switch one off.
  - The per-activity defaults stay, with a "Reset to defaults for MTB" link.
- **Legend merged into Layers.**
  - Each active overlay can expand to show its own legend.
  - MTB difficulty, uphill and the route colours sit with their layers.
  - The Legend rail button goes away.
- **Settings panel** (gear icon). It holds:
  - Data sources (the usage readout), Offline maps and the MML key;
  - Details on hover, Trackpad rotates & tilts, and High contrast;
  - later, the speed presets.

**Built (PR #17)**, widened after the user's review: buttons were hard to connect, and they moved between screen sizes.
- **Where things live, at every size:**
  - **Top bar:** what you do (search, Plan, sport, ⚙ Settings).
  - **Bottom right:** what the map shows and how you look at it. One column: Layers (a thumbnail of the base map), Weather, compass, locate, zoom (desktop). It rides above a bottom planner and an open phone timeline, and stays visible while planning; only a full planner hides it.
- **What went:**
  - the top-right rail;
  - the separate base switcher (merged into Layers);
  - the Legend button and panel (keys moved next to their layers);
  - the 3D button (in Layers → Terrain & 3D);
  - MapLibre's own zoom and compass. Polku's buttons replace them; MapLibre's geolocate stays hidden, for the location dot.
- **Layers:**
  - "Map for MTB — your sport sets the trail colours and which layers start on" with a Change link;
  - base map thumbnails;
  - **On now** chips (× turns one off; weather layers too) and "Reset to MTB defaults";
  - folding groups that remember their state and say how many are on: Trails & difficulty, Marked routes, Places, Water & nautical, Traffic & safety, Roads, Weather on the map, Terrain & 3D;
  - each with its **Map key**.
- **Settings:**
  - Sport (with what it changes);
  - Route planner position (left / bottom, desktop);
  - Display (high contrast, hover details, trackpad);
  - Offline maps, Data sources, MML key.
- **Switching sport says what it changed**, in a toast: "Gravel: unpaved roads highlighted, gravel routing, traffic and road works. Change any of it in Layers."
- **Duplicates are labelled:** "Also the pill beside the search", and the Timeline switch "also the Weather button (T)".

**Cut**
- Overlay search.
- Drag-to-reorder overlays.

**Risks**
- The legend fragments now live in `renderLegend` ([js/main.js](../js/main.js)) and have to be split per layer.
- Don't lose anyone's saved `overlaysByActivity`.

## Phase 5 — More sports

**Changes**
- A sports registry in [js/config.js](../js/config.js) replaces the `act === 'mtb'` checks in style.js, analysis.js, planner.js, safety.js, weather.js and main.js (about 45 places). Each sport has:
  - a group (bike / foot / water, and snow later);
  - a BRouter profile and a timing model;
  - its warnings, its profile chips and the style flavour;
  - LIPAS routes and points, and default overlays.

| Sport | BRouter | Timing model | LIPAS routes | Defaults worth noting |
|---|---|---|---|---|
| MTB | `mtb` | bike, mtb:scale slows trails | 4411 MTB, 4412, 4405 | difficulty halo, uphill |
| Gravel | `gravel` | bike | 4412 cycling | traffic, road works |
| Road cycling *(new)* | `fastbike-lowtraffic` | bike, paved | 4412 cycling | busy roads, road works, road conditions, waymarked cycling |
| Hike | `hiking-mountain` | walking (Tobler) | 4405, 4404, 4403 | huts, lean-tos |
| Trail run *(new)* | `hiking-mountain` | running pace with grade adjustment, trail factor | 4405, 4404, 4401 fitness trails | huts, water points |
| Run *(new)* | try `hiking-mountain` vs `trekking` on a few Tampere routes, pick one; a custom profile comes in phase 9 | running pace on flat, grade-adjusted | 4401 lit fitness trails, 4403 | lit trails |
| Paddle | `river` + Polku's water router | craft speed, wind | 4451, 4452 | depths, nautical, ships |

- Share links keep working: `a=hike` still means Hike, and new ids are added.
- A link shared from a newer Polku opened in an older one falls back to MTB, as now.
- The default timing models reproduce today's times for MTB, gravel, hike and paddle, so nothing moves before phase 6.

**Built (PR #18)**
- **Sports:** MTB, Gravel, Road cycling, Hike, Trail run, Run, Paddle. Each has a `group` (bike / foot / water; "snow" is the slot for winter).
  - Helpers: `groupOf()` and `OFFROAD_BIKE`, for where ↑S grades apply.
  - The sport checks in style, analysis, planner and chart now use the group.
- **BRouter:**
  - Road cycling uses `fastbike-lowtraffic`.
  - Run and Trail run use `hiking-mountain`: on three Tampere routes it kept to footways and cycleways, while `trekking` put a city run 39 % on main roads.
- **Timing:**
  - MTB, gravel, hike and paddle are unchanged.
  - Road: 27 km/h paved, 800 m/h climbing.
  - Run: 10.5 km/h paved / 9.5 trail; Trail run: 10 / 8.5. Both are grade-adjusted with Minetti's cost of running; Trail run never drops below a brisk hike on steep climbs.
- **Warnings:** Road gets "Unpaved for N m — rough on road tyres"; Trail run gets "Very steep — walk it".
- **Map styles:**
  - Road: trails dimmed, cycleways wider, unpaved roads marked.
  - Run and Trail run: the hiking path emphasis.
- **LIPAS:** 4401 fitness trails (kuntorata) and 4406 multi-use routes added.
- **Default layers:**
  - Road: cycling routes, traffic, road works, road conditions, cameras.
  - Run: fitness and walking routes, road works.
  - Trail run: hiking routes and huts.
- **Compatibility:** `a=hike` share links and saved settings still open Hike ("Hike & run" became "Hike"). Unknown sports fall back to MTB.
- **Phones:** the Plan button is the same size as the rest of the map column (review note).

**Cut**
- Winter (planned, not built).
- E-bike.
- Heart-rate or power-based timing.

**Risks**
- Choosing the Run profile. Test it; don't guess.
- LIPAS layer names for 4401 (fitness trails): check with a WFS DescribeFeatureType call before relying on them.
- Style flavours in [js/style.js](../js/style.js) for road and run: keep them small, by reusing the gravel and hike branches.

## Phase 6 — My speeds

**Changes**
- `estimateTime` takes a speed model instead of hard-coded numbers.
- **Easy / Normal / Fast** presets per sport, plus **Custom**, in your own terms:

| Sport | Custom fields |
|---|---|
| Bikes (MTB, gravel, road) | km/h on paved, on gravel and on trail, plus climbing rate (m/h) |
| Run, trail run | pace in min/km on the flat (trail run adds a trail factor) |
| Hike | walking speed in km/h on the flat |
| Paddle | craft speed in km/h. The Sea kayak / Canoe / SUP choice moves in here |

- **Where it shows:**
  - The time stat reads "1 h 40 min · Normal ▾"; tapping it opens a small popover.
  - Settings shows all sports at once.
- **What happens on change:**
  - Changing a speed recomputes time, then route weather, since arrival times move.
  - It costs no routing calls; only weather, and only if the arrival hours change.
- **Storage:** values are stored locally as `polku:speeds`, never in share links.

**Cut**
- Learning speeds from GPX history; maybe later.
- Per-surface speeds for running.

**Risks**
- Sensible preset numbers. Calibrate Normal to today's values.
- Weather refetch storms while typing: debounce. The weather cache usually means no calls anyway.

## Phase 7 — Editing on the map

**Changes**
- **Drag the line.**
  - Pressing on the route starts a new via point under the finger, then drags it.
  - The two neighbouring legs are re-routed **live**:
    - debounced about 350 ms;
    - previous requests aborted;
    - at most 1 request in flight per leg;
    - the per-leg cache reused.
  - A dashed straight preview shows while a request is pending.
  - Releasing commits one undo step.
- **Dragging a point** previews live the same way. Today it only updates on dragend.
- **Ghost midpoint handles** on each leg when hovering the route (desktop).
- **Touch.**
  - Hit areas of 44 px (the visible dots stay 22–24 px).
  - **Long-press** the map (500 ms) to add a point.
  - Map panning is disabled while a point or the line is being dragged, so there's no accidental pan.
- **Point menu:**
  - remove;
  - the next leg as follow paths / straight / over water;
  - avoid here;
  - set as start, set as finish.
- **Gentle on BRouter:**
  - A drag costs at most about 3 requests per second of motion, and usually 1–2 in all.
  - Counted in the usage readout.

**Cut**
- Multi-select and snapping to POIs.

**Risks**
- Marker drag vs the hover tooltip vs the map's own `dragPan`.
- Live re-analysis is too heavy to run on every preview: run it only on commit, and draw only the geometry while dragging.

## Phase 8 — Waypoint list and undo

**Changes**
- A **Waypoints** section in the planner lists Start, Via 1…n and Finish, with distance from the start. Each point can be:
  - reordered by its drag handle or with ↑/↓ buttons (the buttons are for keyboard and screen readers);
  - renamed (names go into the GPX export and the offline snapshot);
  - deleted;
  - focused on the map.
- **Undo/redo covers everything:**
  - points;
  - leg modes;
  - avoided places;
  - names, order, reverse and loop;
  - imported tracks.
- **Waypoint names stay on the device.** Share links stay as they are (`r`, `m`, `a`).

**Cut**
- Turn-by-turn instructions.
- Notes per waypoint.

**Risks**
- Reordering changes which legs exist, so fixed (imported) legs must split and merge correctly. The logic already exists in `insertPoint` and `removePoint`.

## Phase 9 — Route preferences

**Changes**
- **Sliders per sport, from avoid to prefer**, in five steps. Where each applies:
  - **busy roads and road crossings:** all sports except paddle;
  - **big climbs:** all;
  - **technical trails:** bikes, trail run;
  - **unpaved surface:** bikes, run.
- **How they reach BRouter:**
  - **Polku profiles** live in `profiles/*.brf`, derived from the stock ones. Each adds variables for traffic, crossings (node tags), climbs, mtb:scale and surface.
  - Each is uploaded once per profile version with `POST /brouter/profile`.
  - The returned `custom_…` id is cached locally and re-uploaded if refused.
  - Slider positions become `profile:xxx=` parameters.
  - **Fallback:** if upload fails, use the stock profiles' own variables (`consider_traffic`, `consider_elevation`, `prefer_unpaved_paths`, `avoid_steep_inclines` and so on), with fewer steps.
- **What shows in the UI:**
  - Active preferences appear as small badges in the planner header ("Quiet roads · Few climbs").
  - Changing one re-routes every leg (one request per leg), behind a short "Apply" debounce.
- **Share links get a short `p=` parameter.** The preferences shape the route, so the person opening the link gets the same line.

**Cut**
- Per-leg preferences.
- Ranking `alternativeidx` 0–3 ourselves, which costs 4× the calls. Keep it as a last resort only.

**Risks**
- How long brouter.de keeps uploaded profiles isn't documented. Profile scripting needs care: a broken profile fails every route, so validate with a test request after upload.
- Wording the sliders so they're honest about what BRouter actually does.

## Phase 10 — Round trips

**Changes**
- **Input:**
  - A start point (the map centre, a tap, or my location).
  - A target distance, or a target time turned into distance with the speed model from phase 6.
  - An optional direction.
- **Three candidates.**
  - Each one is one BRouter round-trip request, at radius ≈ distance ÷ 5.4, recalibrated per sport.
  - Directions are spread 120° apart, or around the chosen direction.
  - One automatic retry if a loop misses the target by more than 25 %.
  - So 3–4 requests per generation. The panel shows this up front, and how many this hour.
  - Soft cap: about 5 generations per 10 minutes.
- **Ranking (all done locally, no extra calls):**
  - each loop runs through Polku's own analysis: profile, difficulty, warnings and hazards;
  - it's scored against the target and the preferences from phase 9;
  - candidates appear as coloured lines with cards (distance, ascent, time, hardest climb, unpaved %, heads-up count).
- **Picking one** turns it into a normal route. The loop's geometry is split at 4–6 via points into fixed legs, so editing re-routes only the legs you touch.

**Cut**
- More than 3 candidates.
- "Surprise me".
- Point-to-point "explore".

**Risks**
- How round-trip load affects brouter.de.
- Loops that come back on the same road. Use `allowSamewayback=0` and flag big overlaps when scoring.

---

## Later: Strava & Garmin (not started; research first, no code)

The user's brief, kept here so it isn't lost. When it's time, the first deliverable is research and a phased plan, not code.

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

The user expects the smallest first step to be option A plus a FIT course export. Phases 6 (speeds) and 10 (ranking) are built so that history can plug in later.

## Where things live (keep for every phase)

- **Top bar:** search, Plan, sport pill, ⚙ Settings.
- **Bottom right:** one column — Layers, Weather, compass, locate, zoom — then Plan.
- **Layers panel** (opens beside its button) is what the map shows. **Settings** (opens under the ⚙) is how Polku behaves.
- A control may appear in two places only if both say so (e.g. sport, weather layers).
- Phones use the same places. Panels become bottom sheets there, and touch phones drop the +/−.
- New settings go in Settings (e.g. speeds in phase 6, with a quick chip in the planner). New map layers go in a Layers group.

## Planner layout contract (keep for phases 6–10)

- **Summary bar** (always visible, both layouts): distance · time (from departure) · ascent or carry, routing mode, undo/redo, ⋯, Done.
  - The speed chip (phase 6) and preference badges (phase 9) go here, next to the time; there is room in the one-row bottom bar.
  - The ⋯ menu keeps every tool, so the narrow layouts never need more icons.
- **Sections** are added with `this.section(id, title, …)`. Waypoints (8), Preferences (9) and Round trip (10) are new sections.
  - In the side panel and on phones they fold, and their state is remembered.
  - In a wide bottom panel they are grid columns (see `.sheet-cols` in `css/app.css`).
- **Camera fits** use `planner.viewPadding()`.

## How to work on this (for any session)

- **Branches:** one per phase, from `main` after the previous phase is merged. If it isn't merged yet, branch from it and say so in the PR.
- **Testing:**
  - Work in the browser pane inside Claude Code (the user prefers to watch there). `python3 serve.py` serves http://localhost:8765.
  - Check MTB, gravel, hike and paddle (plus the new sports once they exist) at **1440 × 900** and **390 × 844**, with a route drawn and the timeline open.
  - Run `tools/smoke.py` once it exists. `window.polku` gives scripted access (planner, map, state).
- **Screenshots:**
  - `tools/shoot.py OUTDIR before|after [scenes]` while on `main` and on the branch.
  - Convert to JPEG and push them to the `pr-screenshots` branch under `<branch>/`, so no images go into `main`.
  - Link them in the PR as `https://github.com/TommiContursi/Polku/blob/pr-screenshots/<branch>/<file>.jpg?raw=true`.
- **Network:**
  - Every network call goes through `request()` in [js/net.js](../js/net.js), so limits, back-off and the usage readout keep working.
  - Only free public services, and no backend.
- **Don't regress:**
  - weather along the route, warnings and Avoid, water routing and carries;
  - offline save and preview, GPX/KML import and GPX export;
  - share links (`r`, `m`, `a`), 3D and hover details.
- **Merging publishes to polku.si,** so merge only when the user says so.
- **After each PR,** update the status table at the top and note anything that changed in the plan.
