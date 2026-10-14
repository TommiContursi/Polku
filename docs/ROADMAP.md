# Polku roadmap: planner, layout, sports, editing, smarter routes

Status: **approved 2026-10-13.** Each phase below ships as one PR. Do them in order unless this file says otherwise, and update the status table after every PR.

Also approved:
- On desktop the Plan button moves into the search bar (phase 1).
- Route preferences go into share links as a short `p=` parameter (phase 9).

| # | Phase | Branch | PR | Status |
|---|---|---|---|---|
| 0 | UI polish (Plan button, Weather button, grouped chips) | `ui-polish` | [#12](https://github.com/TommiContursi/Polku/pull/12) | merged |
| 1 | Planner panel: side panel on desktop, peek / half / full sheet on phones | `planner-panel` | [#13](https://github.com/TommiContursi/Polku/pull/13) | merged |
| 2 | One clock, and paddling conditions instead of a water "profile" | `one-clock` | #14 → re-landed as [#15](https://github.com/TommiContursi/Polku/pull/15) | merged (#14 went into the stacked base by accident; #15 brought it to `main`) |
| 3 | Map chrome: activity pill, base map switcher, rail and thumb reach | `map-chrome` | [#16](https://github.com/TommiContursi/Polku/pull/16) | merged |
| 4 | Layers, legend and Settings — and one place for each kind of control | `layers-settings` | [#17](https://github.com/TommiContursi/Polku/pull/17) | merged |
| 5 | More sports: road, trail run and run join the four we have | `sports` | [#18](https://github.com/TommiContursi/Polku/pull/18) | merged |
| 6 | My speeds: Easy / Normal / Fast and custom, per sport | `speeds` | [#19](https://github.com/TommiContursi/Polku/pull/19), tweaks [#20](https://github.com/TommiContursi/Polku/pull/20) | merged |
| 7 | Editing on the map: drag the line, live preview, long-press, point menu (+ a compact profile colour menu) | `edit-on-map` | [#21](https://github.com/TommiContursi/Polku/pull/21) | merged |
| 7½ | Routing that holds up: pacing, batching, routes kept on refresh, Valhalla stand-in | `brouter-pacing` | [#22](https://github.com/TommiContursi/Polku/pull/22) | merged |
| 8 | Waypoint list: reorder, rename, delete, undo for everything (+ road names, show the whole route) | `waypoints` | [#23](https://github.com/TommiContursi/Polku/pull/23) | merged |
| 9 | Route style: presets and fine-tuning per sport, whole route or per leg, wet ground auto (redesigned) | `route-prefs` | [#24](https://github.com/TommiContursi/Polku/pull/24) | in review |
| 9½ | Planner layout pass: rows that don't squeeze, one section order, ascent with descent, a "profile" sheet size | `sheet-columns` | [#25](https://github.com/TommiContursi/Polku/pull/25) | in review |
| 10 | Round trips: 3 generated loops, ranked, with the cost shown (+ Round trip & Style in the header, bottom panel by default) | `round-trips` | [#27](https://github.com/TommiContursi/Polku/pull/27) | merged |
| 11 | Layers: every control in every sport, opacity per overlay, paddle soundings, "On now" first | `layers-fixes` | [#29](https://github.com/TommiContursi/Polku/pull/29) | PR open |
| 12a | Trail details on the map: width, visibility, overgrown and wet, fallen trees, gates, fences, fords; hover and click | `trail-details` | [#31](https://github.com/TommiContursi/Polku/pull/31) | merged |
| 12b | Trail details along the route: Heads-up, Width and Visibility profile colours (+ review fixes) | `trail-route` | [#33](https://github.com/TommiContursi/Polku/pull/33) | PR open |
| 13 | Water routing: fairways, shallows, rocks and marks, shore and wind, depth coverage | `water-routing` | — | planned |
| 14 | Round trips for paddling | `paddle-loops` | — | planned |
| 15 | Winter: snow sports, ski tracks, snow depth, ice (research first, then build) | `winter` | — | planned |
| 16 | Strava & Garmin (research and plan only; no code until OK) | `strava-garmin` | — | planned |

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

**Built (PR #19)**
- **`js/speeds.js`:**
  - defaults (Normal = the model's numbers exactly; hike 5.04 km/h is Tobler on the flat);
  - presets Easy ×0.8 / Fast ×1.2 / Custom;
  - storage `polku:speeds`;
  - display in the user's units (pace for runners);
  - a plain-words explanation per sport;
  - `renderSpeedEditor()`, shared by the planner and Settings.
- **`estimateTime` takes `opt.speeds`:** bike paved/unpaved/trail/vam, run paved/trail, hike walk, craft km/h. Running got paved and trail speeds after all; it was cheap.
- **Planner:**
  - a **Speed** item in the stats row (preset and values) opens **Time & speed**;
  - that section holds the craft (paddle, moved from the profile), presets, editable values (editing makes it Custom) and "How it's estimated";
  - **On this route** shows distance, time and speed by paved / gravel / trail / water / carries, uphill time, and what the wind adds or saves.
- **On change:** `planner.retime()` recomputes the times without routing or the DEM, then the route weather after 400 ms.
- **Settings → Speeds:** the same editor, for any sport.

**Cut**
- Learning speeds from GPX history; that's for the Strava/Garmin history work.

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

**Built (PR #21)**
- **Drag the line** (`onLinePress`):
  - with a mouse the drag starts after 4 px of movement (a plain click still adds a via point);
  - on touch, hold the line for 300 ms first (a short buzz where supported), so a swipe across it still pans the map; map panning is off until the release;
  - the new point appears under the pointer; the release is one undo step.
- **Live re-routing while dragging** (`beginEdit` / `editTo` / `previewLeg` / `fetchPreview` / `endEdit`):
  - only the two legs beside the point change, and only their geometry is drawn; the analysis, the coloured line and the hover readout wait for the release;
  - per leg: a request when the pointer rests for 250 ms, or every 0.7 s at most while it moves, one at a time and each allowed to finish; an answer for a spot the pointer has left is still drawn (grey dashed, joined to the pointer), better than a straight line;
  - measured: a quick drag costs 2 requests (one per leg), a 3.6 s continuous drag 12 in all;
  - `router.js` shares requests in flight (`shared()`): the release reuses the preview's request for the final spot instead of repeating it; a request is cancelled only when every caller has given up;
  - straight legs update instantly, imported tracks only move their end, water legs are routed on release (the water router is too heavy for every move).
- **Adding a point on the line costs nothing:** `splitLeg()` splits the current geometry at the nearest spot, and both halves keep their routing key. Undo, "Start here" and turning a loop round are free too.
- **Leg handles:** a small ring in the middle of each leg (drag it, or click it for a via point); hidden where the leg is under 120 px on screen and while dragging.
- **Touch targets:** points sit in a 44 px invisible target on touch screens (30 px with a mouse); leg handles 36 px.
- **Point menu:** distance from the start; next leg Follow / Straight / Water; for via points **Start here** / **Finish here** (a loop turns round instead, same route); for the finish **Back to start**; Remove. It pans into view, clear of the top bar and the planner.
- **Spot menu:** long-press the map (550 ms) or right-click: **Add a point here** / **Avoid this spot** while planning, **Route from here** / **Add to my route** / **Avoid this spot** otherwise. "Avoid here" lives here rather than in the point menu: a via point is where you *do* want to go. No menu after a right-drag rotate.
- **Profile colours, compact** (the user's note on #20): the three rows of chips became one line under the chart, "Colour by [Gradient ▾]" (a native menu grouped Terrain / Ground / Weather) and an "On map" switch; a panel at least 1080 px wide shows the chips in one row instead.
- **Tests:** `tools/smoke.py` drags the line in every layout (mouse on desktop, hold-and-drag on touch) and checks one new point under the pointer, one undo step, no pan and panning back on; `tools/shoot.py` has `desk/phone-drag`, `-point-menu`, `-spot-menu` and `phone-profile`.

**Cut**
- Multi-select and snapping to POIs.
- Escape to cancel a drag (undo does it).

**Risks**
- Marker drag vs the hover tooltip vs the map's own `dragPan`.
- Live re-analysis is too heavy to run on every preview: run it only on commit, and draw only the geometry while dragging.

## Fix between 7 and 8 — routing that holds up on free services

The user hit "Couldn't route this leg" in easy places (Jyväskylä, Ainolanranta). Cause: brouter.de's per-address limit (403 "Please, retry later!"), which our live drag and per-leg calls ran into, and which Polku treated as a failure.

**Built (PR #22)**
- **Pacing** (`net.js` `pace`): brouter.de at most 5 calls / 10 s and 12 / minute; calls beyond wait for a slot. A 403 "retry later" is a back-off (1, 2, 4… min), not an error. A dropped connection gets one retry.
- **Batching** (`router.js` `routeRun`): consecutive auto legs without avoided places go in one call, split at the track point nearest each via point (falls back to one call per leg if a split doesn't hold). A 20-leg route, a sport change or a share link: 1 call.
- **Routes survive a refresh:** `save()` stores the routed geometry and way tags (a table of distinct tag sets); `loadSaved()` restores them with their keys. Measured: refresh = 0 calls.
- **Valhalla stand-in** (`valhalla.js`): FOSSGIS's Valhalla (the routing openstreetmap.org uses; no key; 1 call/s, attribution + "fix the map") routes a leg when brouter.de is paused, down, can't route it, or would keep it waiting over 6 s. Mountain / Cross / Road bicycle and pedestrian costing; `trace_attributes` gives use, road class, surface, names and SAC scale, translated to OSM tags. Two calls per batch. Heads-up: "N legs routed by Valhalla", the attribution, and **Use BRouter**. Paddling has no stand-in (waits). Drag previews never use it.
- **Waiting, not failing:** a leg the service can't take now is dashed with a straight stand-in for the totals, Heads-up says why (a pause, or your server not answering) and when, and it routes on its own when the service is back. Real failures say so in plain words and get a **Retry**.
- **Your own BRouter (optional):** Settings → Routing server (checked with one test route before saving); `tools/brouter-local.sh` downloads BRouter 1.7.10 and Finland's routing data (~125 MB) and serves it on localhost:17777.

**Later**
- Road names along the route: Valhalla's `trace_attributes` already returns them; BRouter doesn't. For BRouter legs, read them from the vector tiles' `transportation_name` layer (phase 8).

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

**Built (PR #23)**
- **Waypoints section** (`renderWaypoints`, between Profile and Departure; its own column in a wide bottom panel):
  - a row per point: its marker badge, the name (an input: rename in place, Enter or leaving the field saves, Escape cancels), and below it the label when a name stands in for it, the distance from the start and the road it's on;
  - **↑ / ↓** buttons (labelled for screen readers), **remove**, and a **grip** to drag (pointer events; a line marks where it drops; one undo step);
  - **Reverse direction** under the list (the user's note on #23; the same as Reverse in the tools);
  - click a row: the map eases to the point, centred in the part the planner leaves free, and its marker pulses.
- **Names** (`pname`, a WeakMap from point to name: points move as arrays, so names follow them through reorder, reverse and drags; snapshots copy them for undo). Shown on the marker's tooltip and the point menu; saved with the route and the offline snapshot; written into GPX `<wpt><name>`. Never in share links.
- **Auto names:** a point without a name shows the road or path it's on: Valhalla's tags when it routed the leg, else the loaded tiles (`js/names.js`: `transportation_name` segments in a 0.002° grid, rebuilt after the map moves; indoor corridors skipped). The list refreshes when new tiles bring names.
- **Reorder** (`movePointTo`): legs whose two ends stay neighbours are kept (no routing); an imported track the other way round is turned round; new neighbours get a new leg in the mode the point's outgoing leg had. Routing for the new legs is batched (#22).
- **Undo covers everything:** snapshots now include names and the route's name; points, leg modes, avoided places, reverse, loop, start/finish here, imports, drags, renames and reorders are all one step each.
- **Road names on the route:** the hover readout and the profile tooltip lead with the name ("Hämeenkatu · cycleway · paving stones"). Only ways running within 35° of the route's direction count, so a street crossing under or over it isn't taken for it.
- **Show the whole route** (the user's note): a ⛶ tool in the planner's header row (always visible) and <kbd>F</kbd>; opening the planner while the route is entirely off screen frames it.
- **Bug found on the way:** `easeTo({ padding })` leaves the padding on the map (MapLibre keeps it), so every later `fitBounds` with the planner's padding counted it twice and silently did nothing on a phone. Points are now centred with `offset`; `tools/smoke.py` checks the map keeps no padding.

**Cut**
- Turn-by-turn instructions.
- Notes per waypoint.

**Risks**
- Reordering changes which legs exist, so fixed (imported) legs must split and merge correctly. The logic already exists in `insertPoint` and `removePoint`.

## Phase 9 — Route style (redesigned 2026-10-13, before building)

The user asked to think this through first: comprehensive and useful per sport, and maybe per leg rather than only for the whole route. The first plan (generic avoid ↔ prefer sliders, custom profiles uploaded to brouter.de) is replaced by this one.

**What we found out**
- **No uploads needed.** BRouter's `profile:name=value` URL parameters override *any* global variable of a stock profile, not only the ones brouter-web shows (source: `BExpressionContext._parseFile` injects them as assignments, and `BExpression.parse` protects that value against the profile's own first assignment). Uploading custom profiles would cost extra calls, has no documented retention, and a broken profile would fail every route; we don't need it.
- **What each profile can really be steered with** (so the controls stay honest):

  | Sport (profile) | Terrain | Technical | Climbs | Traffic | Other |
  |---|---|---|---|---|---|
  | MTB (`mtb`) | `MTB_factor` −3…3 (off-road ↔ roads), `path_preference` | `consider_smoothness` (on: S2 ×5, S3 ×15, S4+ banned; off: no difficulty penalty) | `hills` 0–2 | `avoid_unsafe` | `iswet`, `allow_steps`, `cycleroutes_pref` |
  | Gravel (`gravel`) | `prefer_unpaved_paths` | — | `consider_elevation`, `avoid_steep_inclines` | `consider_traffic_estimate` | `prefer_forests`, `prefer_rivers`, `avoid_towns`, `avoid_noise`, `prefer_cycle_routes`, `assume_wet_conditions` |
  | Road (`fastbike-lowtraffic`) | (always paved) | — | `uphillcost` with `consider_elevation` | `consider_traffic`, `avoid_unsafe` | `stick_to_cycleroutes` / `ignore_cycleroutes`, `allow_steps` |
  | Hike, trail run, run (`hiking-mountain`) | `hiking_routes_preference` (marked trails) | `SAC_scale_limit`, `SAC_scale_preferred` | `consider_elevation` | (via `consider_noise`, `consider_town`) | `consider_forest`, `consider_river`, `iswet`, `allow_steps` |
  | Paddle (Polku's water router) | — | — | — | — | shore cost (near shore ↔ open water), carry cost |

- **Valhalla** (the stand-in) takes the nearest equivalents: bicycle `use_roads`, `use_hills`, `avoid_bad_surfaces`; pedestrian `use_hills`, `use_tracks`, `max_hiking_difficulty`, `step_penalty`.

**Design**
1. **A "Route style" per sport**, set like "My speeds" (phase 6): a **Style** item in the planner's stats row ("Flowy trails") opens a **Route style** section.
   - **Presets first**, in riders' words. MTB: Balanced · Flowy trails · Technical · Smooth & easy · Roads to the trail. Gravel: Balanced · Gravel grinder · Mostly paved · Scenic. Road: Balanced · Quiet roads · Flat · Direct. Hike: Balanced · Nature paths · Easy paths · Mountain. Trail run: Balanced · Trails · Flatter · Technical ok. Run: Balanced · Green & quiet · Flat · Direct. Paddle: Balanced · Near the shore · No carries.
   - **Fine-tune** under the presets: only the controls the sport's profile really has (the table above), each a 2–3 step segmented control with a one-line plain explanation. Touching one makes the style **Custom**. Balanced = the stock profile with no parameters, so nothing changes for anyone who doesn't touch it.
2. **Whole route by default, per leg when you want it.** The style describes you and the sport, so it's the route's. But mixed days are real (ride the road to the trailhead, then trails; walk out of town, then a mountain path), so any leg can have **its own style**: the point menu's "Next leg" gets a **Style** choice (the route's, or a preset), and the Route style section gets a scope switch: *Whole route* / *Leg 2 → 3*. Legs with their own style are marked in the waypoint list between their points. Legs are routed separately anyway, so this costs nothing extra; runs of legs with the same style are still batched.
3. **Wet ground: automatic.** MTB, gravel, hike and trail run have a "wet" switch (muddy paths cost more). Default **Auto**: rain in the last 24 h at the start (Open-Meteo `past_days`, one cached call) turns it on, and the section says why ("6 mm yesterday — avoiding muddy paths"). Manual Yes / No too.
4. **What it changed.** After a style change, one line compares with the route before: "Flowy trails: +0.8 km · trails 41 → 63 % · +40 m climbing". No extra calls: the previous route is still in memory.
5. **Costs.** A style change re-routes the auto legs: batched, so usually one call; debounced 700 ms while you click through the controls. Drag previews use the leg's style.
6. **Share links** carry the style so the line matches: `p=` (the route's style, a short code) and `ps=` (legs with their own). Defaults are left out, so old links are unchanged. The style per sport is remembered on the device (`polku:styles`); the route's style is saved with the route.
7. **Paddle** gets the same section through Polku's own water router: *near the shore* (cold water, wind: stay within reach of land) ↔ *open water ok*, and *carries: avoid / fine*. No service involved.

**Build and verify**
- `js/styles.js`: the catalogue (presets, controls, parameters per profile, Valhalla mapping, codes); the planner section and Style item; per-leg styles; Auto wet; the comparison line; share links; tests.
- **Every preset is checked to really change routes** on three test areas (Kauppi, Tampere: MTB; Ainolanranta, Jyväskylä: city riding and running; Nuuksio: hiking), with values tuned until each step makes a visible difference. Tuning needs many routing calls, so it runs against a local BRouter (`tools/brouter-local.sh`), never in bursts against brouter.de.

**Built (PR #24)** — approved as designed, with these findings from tuning
- **`js/styles.js`** holds the catalogue: per sport, presets and controls; each step lists its BRouter variables, Valhalla options and (paddle) water-router options. `routerOf(sport, style, wet)` turns a style into `{ profile, params, valhalla, water, key }`; `encodeStyle` / `decodeStyle` make the share codes (`flowy`, `balanced~r1~c1`, `scenic~f8`, `~Wy` for wet).
- **Tuning (local BRouter, `tools/style_probe.py --presets`):** every preset changes its sport's test route. What was dropped or changed because it didn't: MTB `hills` 2–3 (same as 1), road "Direct" preset (traffic matters only in places, so it stays a control), run "Flat" + no stairs (the flatter line used steps), trail run "Technical ok" (SAC grades are rare outside the fells) → "Nature".
- **Road cycling** found the biggest gap: the stock road profile costs gravel main roads like asphalt, so 13–32 % of rural road rides were unpaved. `profiles/polku-road.brf` (stock plus `unpaved_mainroad_factor`) makes **Paved roads** the road default: Tampere–Orivesi 13 → 0 % unpaved for +1.2 km. Uploaded once per session as `custom_polku-road-1` (one shared file on the server, not one per visitor); a 500 means the server dropped it: upload again and retry once, without counting it as an outage; if it can't be used, the stock profile routes with a note.
- **Planner:** a **Style** item in the stats row; the **Route style** section (presets, controls with one-line help, wet ground with the reason, the last change's effect, a scope switch when editing a leg); **Style** in the point menu for the next leg; legs with their own style marked in the waypoint list. Styles are in undo, the saved route, offline snapshots and share links (`p=`, `ps=`); the route's style is remembered per sport (`polku:styles`), a shared link's isn't.
- **Costs:** a style change re-routes after 700 ms, batched by style (one call for a route in one style). The routing key includes the style, so cached and saved legs are reused when the style is the same.
- **Wet ground:** Open-Meteo `past_days=1` at the start, one call per place and hour; 3 mm in 24 h turns "auto" on.
- **Paddling:** "Near the shore" measures shore distance in metres (about 250 m), makes open water cost more the further out, and stops the straightening from cutting across open water; carries get their own cost. On Näsijärvi the route moves from the middle of the lake to the west shore and islands, for +0.5 km.
- **Valhalla** gets the style's options when it stands in (checked: MTB Technical → `use_roads 0`, `avoid_bad_surfaces 0`).

**Cut**
- Ranking BRouter's `alternativeidx` 0–3 ourselves (4× the calls).
- Lit ways for evening runs: BRouter's foot profile has no variable for it (Valhalla's `use_lit` would, but it's only the stand-in).
- "Seek hills" for training: BRouter costs can't reward climbing.

**Risks**
- Some parameters change little on Finnish data (e.g. SAC scale is rarely tagged outside Lapland): the controls say what they do, and the tuning pass drops any that don't show a difference.
- Per-leg styles add UI: they stay one menu choice away and are invisible until used.

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

**Built (PR #27)**
- **Polku makes the loops, BRouter routes them** (`js/roundtrip.js`). BRouter's own round-trip mode just puts points on an arc around the start; doing it here means a loop is an ordinary route (start → 4 via points → start), so route styles, the Valhalla stand-in, caching and editing all apply, and picking a loop is free.
- **Shape:** the start sits *on* a circle and the via points go round it (clockwise), so the loop rides a ring, not out-and-back spokes. Radius = target ÷ (2π × the sport's detour factor), calibrated with `tools/loop_probe.py` on 5 places × 4 sports × 3 directions against a local BRouter.
- **Water first:** a via point in a lake or the sea fails or sends the route the long way round (measured: 190× the target from Kuopio, 2.8× from Tampere heading north over Näsijärvi). Before routing, the map frames the loops' reach and its loaded tiles' water polygons are read (`querySourceFeatures`, any base map): 12 directions are scored by how wet their circle is, via points are nudged along the circle off the water, and the three driest directions at least 60° apart are routed. Same places, water-aware: the worst of the bad cases gone (Tampere 0.81–1.29×, Kuopio run 0.85–0.97×).
- **One call per loop** (`router.routeLoop`, the whole line, with `correctMisplacedViaPoints` to trim spurs). A loop that fails, rides over 1.6× the target or more than half of it twice is replaced by the next direction; one under 0.8× or over 1.25× is resized once; at most 6 calls a go, 5 goes per 10 minutes (the panel says both).
- **Ranking, locally:** each loop goes through Polku's analysis (time, climbing, heads-up) and is scored on distance fit, riding the same way twice (`twiceShare`: within 15 m of a part 300 m+ away along it) and heads-up. Cards: distance, time, climbing, trails % (unpaved % for road and gravel), ridden twice, heads-up, "via Valhalla" if it stood in.
- **Picking one:** its via points move onto the line (nearest spot, in order), so the legs split exactly and nothing is routed again; one undo step; it's a loop, so "Start here" turns it round.
- **Inputs:** start (map centre, my location, route start, or a click on the map), length (km or time, turned into km with your speeds; presets per sport), direction (any, 8 compass points, or "into the wind first" for bikes: the wind at the start from the forecast, so you come home with it behind you).
- **Where:** "Or make a round trip" in an empty planner, "Round trip…" in the ⋯ menu, "Round trip from here" in the long-press / right-click menu. Once there are loops, the choices fold into one line so the cards come first (phones especially).
- **Not for paddling yet** (it would need many runs of Polku's own water router); the panel says so.

**Cut**
- More than 3 candidates.
- "Surprise me".
- Point-to-point "explore".

**Risks**
- How round-trip load affects brouter.de.
- Loops that come back on the same road. Use `allowSamewayback=0` and flag big overlaps when scoring.

---

## Phases 11–16 (added 2026-10-13, plan OK'd 2026-10-14)

Same way of working: one PR per phase, screenshots at 1440 and 390 px, `tools/smoke.py` passing, this file updated. Free public services only, no backend (phase 16 may *propose* one), every call through `js/net.js`, share links keep working, no regressions. Phases 15 and 16 start with research written here; 16 waits for an OK before any code.

## Phase 11 — Layers: quick fixes

**What changes**
- **Every layer and control in every sport.** The sport only sets which layers *start* on (`ACTIVITY_OVERLAYS`), never what you may turn on. Today the trail controls are MTB-only: `state.activity === 'mtb'` gates the Difficulty / Uphill / Both switch, the difficulty and uphill numbers, the uphill overlay (`uphill.setEnabled`) and their map key (`main.js` around lines 275, 423–426, 532–549). They become a **Trail colours** control for everyone: *Off / Difficulty / Uphill / Both*, with a default per sport (MTB: Difficulty; others: Off), plus the two number toggles. The pass also audits `style.js` and the Layers groups for any other sport gate.
- **Opacity per raster overlay.** A slider (10–100 %) right under each raster overlay's toggle while it's on: Maastokartta (transparent), the MML overlay, depth areas, contours, soundings, shipping lanes, Waymarked Trails, radar. Remembered per layer (`settings.overlayOpacity[id]`); the defaults are today's (`RASTER_OVERLAYS[id].opacity`, Maastokartta 0.4). Applied as `raster-opacity`, so a drag updates the map without a style rebuild.
- **Paddle defaults: soundings on** (with depth areas, contours and fairways, which already are).
  - **Checked 2026-10-13:** Traficom's WMS (`julkinen.traficom.fi/inspirepalvelu/rajoitettu/wms`) answers *any* origin with `Access-Control-Allow-Origin: *`. `Sounding_P`, `DepthArea_A` and `DepthContour_L` returned real images over the Helsinki archipelago for `Origin: https://polku.si` and for `https://example.org` alike. The README's note ("only localhost and polku.si; elsewhere a proxy") is out of date and gets corrected. The phase confirms it in the browser on polku.si itself (the deployed site), and if a layer doesn't load there, it says what a proxy would take instead.
- **"On now" first.** The chips of what's on (each with ×), and *Reset to <sport> defaults*, move to the top of the Layers panel, under the sport header.

**Test**
- Smoke: for every sport the Layers panel has the Trail colours control; an opacity set on one overlay survives a reload.
- Screenshots: Layers in paddle and in hike, with trail colours and the opacity slider; MTB unchanged.

**Risks**
- The uphill layer reads DEM tiles and Overpass (`mtb:scale:uphill`) for whatever is in view. Off by default outside MTB, so the cost only comes when someone turns it on.

**Built (PR #29)**
- **Trails & difficulty in every sport.** One control, *Off / Difficulty / Uphill / Both*, plus the Difficulty numbers and Uphill numbers toggles, for every sport. MTB starts on Difficulty, the others on Off. What you choose is remembered per sport (`settings.trailsByActivity`), like the overlays, so turning on uphill colours for a hike doesn't change MTB. Settings from before (one global choice, which was MTB's) move to MTB once.
  - The `act === 'mtb'` gates are gone from `style.js` (difficulty halo on paths and tracks, uphill line and labels, difficulty labels), `configureLayers` (`uphill.setEnabled`), the map key, and hover and click details (MTB difficulty shows in any sport with trail colours on).
  - The hike, run and paddle styling of paths stays as it was while trail colours are Off.
- **Opacity sliders** (10–100 %, steps of 5) right under each raster layer's switch while it's on:
  - the overlays: depth areas, contours, soundings, shipping lanes, Waymarked Trails, Maastokartta, the MML overlay;
  - the weather fields: Rain (radar and forecast together) and Temperature.
  - A drag sets `raster-opacity` live (no style rebuild); the value is saved on release in `settings.overlayOpacity` (keyed by overlay id, and `wx:rain` / `wx:temp`), and style rebuilds read it. Defaults are unchanged.
- **Paddle: soundings on** by default, with depth areas, contours and shipping lanes.
  - Checked again 2026-10-14 from the deployed site: a CORS fetch from `https://polku.si` got real PNG tiles for all three depth layers over the Helsinki archipelago (8–22 KB each). No proxy needed. The README's limits note is corrected, and says what a proxy would take if Traficom ever starts checking origins.
- **"On now" first**, right under the sport header: the chips (each with ×), now with one for the trail colours too, and *Reset to <sport> defaults*, which resets the trail colours as well as the overlays.
- **Smoke:** a new `layers` check (`python3 tools/smoke.py layers`):
  - every sport has the same switches and the trail colours control;
  - "On now" is the first section;
  - every raster overlay that's on has its slider, and so does Rain;
  - paddle has soundings on;
  - a slider changes the map, and 30 % survives a reload.
  - Against `main` it fails on exactly these points.

## Phase 12 — Trail details & obstacles (redesigned 2026-10-14, OK'd; 12a built)

**The goal, in the user's words:** looking at the map, understand what a trail is like before going there. Not just its difficulty, which Polku already shows well, but how wide it is, how visible it is on the ground, how rough it is, and whether something is in the way: fallen trees, gates, fords, wet spots. The same information should help when planning: seen along the route, warned about, and preferred or avoided where possible. Build on what's there (trail colours, profile colours, Heads-up, route styles) rather than adding separate controls.

**What Polku does today**
- **Map:** the difficulty halo (`mtb_scale` from the vector tiles), uphill colours, surface only as "paved / unpaved" (the tiles carry no more), `bicycle=no` ticks. OpenFreeMap's tiles have no width, visibility, smoothness, SAC or obstacles.
- **Hover and click:** difficulty, uphill grade, surface, access, bridge. Everything else only after **"Show all OSM tags"**, one way at a time (an Overpass call per click).
- **Route:** BRouter's answer already carries way tags per stretch (`router.js` reads `WayTags`). The analysis uses `highway`, `surface`, `mtb:scale`, `mtb:scale:uphill`, `sac_scale`, `bicycle`, `access`. Heads-up has steps, no cycling, technical S3+, steep, unpaved for road tyres, SAC T4+ for hikers, each with **Avoid** (a no-go circle). **Node tags (gates, fords) are never read**, and width, visibility and obstacles never reach the analysis.

**What the data supports (checked 2026-10-14)**
- **Finland** (Geofabrik's taginfo for Finland, data of 2026-10-12): 307 600 `highway=path` ways.

  | on paths | share | note |
  |---|---|---|
  | `mtb:scale` | 54 % | already shown |
  | `surface` | 34 % | |
  | `width` | 24 % | mostly 0.2–1 m: 0.5 (15 200), 1 (11 900), 0.3 (9 100), 0.4 (8 400), 0.6 (7 600) |
  | `trail_visibility` | 22 % | good 28 500 · excellent 18 300 · intermediate 14 800 · bad 7 200 · horrible 1 300 · no 530 (all elements) |
  | `informal=yes` | 13 % | |
  | `sac_scale` | 3 % | |
  | `obstacle` (on the way) | 1.3 % | |
  | `smoothness` | 1 % | 1.4 % of tracks; `tracktype` is on 23 % of tracks |

  **Wet:** `surface=mud` on 3 300 paths, `bridge=boardwalk` (pitkospuut) on 3 300, `obstacle=mud` 275.

  **Obstacles:**
  - `obstacle=vegetation` 4 200 (overgrown);
  - `obstacle=fallen_tree` 2 100, of which **1 830 are nodes**;
  - `barrier=log` 660 nodes and `barrier=fallen_tree` 66;
  - trail barriers: cycle barrier 390, stile 45, kissing gate 25;
  - `ford` 4 700;
  - `barrier=gate` 30 000 and `lift_gate` 3 700, mostly on roads and forest roads.
- **The Finnish conventions** (the OSM Trails Finland / Trailmap tag guide, wiki.trailmap.fi/fi/kartoitus/tagit) match what mappers do:
  - width classes < 0.6 · 0.6–0.9 (also untagged) · 0.9–1.8 · ≥ 1.8 m (drawn like a track);
  - `trail_visibility` intermediate and worse is drawn faint, and paths through clear-cuts or storm damage get `bad`;
  - `obstacle=fallen_tree` marks a tree you can't realistically ride over (a jumpable one raises `mtb:scale` instead);
  - `obstacle=vegetation` marks an overgrown path;
  - `surface=mud` marks anything significantly wet, bogs included;
  - all kinds of gates are drawn alike.
- **Per area** (Overpass, paths, footways, bridleways and tracks):
  - **Kauppi** (Tampere, about 3.7 × 2.8 km): 2 155 ways. `mtb:scale` 66 %, width 38 %, visibility 12 % (faint 8 %). 63 obstacle nodes, 8 trail barriers, 16 fords, 25 muddy and 20 obstacle ways.
  - **Keskuspuisto** (Helsinki, 3.3 × 4.4 km): 3 452 ways. `mtb:scale` 25 %, width 18 %, visibility 5 %, informal 26 %. 9 obstacle nodes, 23 fords.
  - **Not measured:** Laajavuori, Nuuksio and rural Kainuu. The public Overpass servers answered 504 on all three mirrors, again and again.
  - **So:** rich where riders map (the MTB areas), thin elsewhere. Width and visibility are worth drawing. Smoothness and SAC on paths are too sparse to be a map mode.
- **BRouter** (lookups of 1.7.10, and a local server):
  - **Its data has:** `trail_visibility`, `smoothness`, `sac_scale`, `mtb:scale`, `mtb:scale:uphill`, `obstacle` (`vegetation`, `fallen_tree`), `ford`, `informal`, `bridge` and `tracktype` on ways; `barrier` (gate … log, fallen_tree, windfall, debris) and `ford` on nodes.
  - **Not:** `width` at all, and `obstacle` on nodes, which is how most Finnish fallen trees are mapped.
  - **Its answers carry only the tags the profile uses.** With `profile:processUnusedTags=1` they carry the rest, and the route doesn't change. Verified: a Kauppi MTB route went from 11 way keys to more than 30, `trail_visibility` and `bridge` included. Node tags (crossings, kerbs, barriers) come either way.
  - **No stock profile reads** `trail_visibility`, `obstacle` or `informal`. `mtb.brf` prices `smoothness` (`consider_smoothness`) and fords (tied to `Hill_factor`); `hiking-mountain.brf` prices `sac_scale`; barriers only matter for access.
- **Overpass:** one tile query (ways with any of the detail keys, plus obstacle, barrier and ford nodes, `out tags geom qt`):
  - a z14 tile, about 1.2 km here (not 2.4 km: Finland is at 60–70° N), took 81 KB and 8 s in Kauppi (117 ways, 25 nodes), and 93 KB and 0.8 s in Keskuspuisto;
  - so **z13 tiles** (about 2.3 km) are the unit: roughly 300–400 KB of JSON each, about 25 for a 10 × 10 km riding area, cached for a week;
  - heavier queries over 4 km boxes got 504s from every mirror several times in ten minutes. **Trail details are therefore best-effort and cached, and nothing on the route that BRouter already knows depends on Overpass.**

**Design**

*Map: one "Trail details" switch, in Layers → Trails & difficulty*
- **Defaults:** on for MTB, hike and trail run, off for the other sports, remembered per sport (phase 11's `trailsByActivity`). It gets an "On now" chip and a map key.
- **Data:** from zoom 14. Icons from zoom 15.
- **Difficulty keeps the colour.** The details use other channels, so they can all be on with difficulty or uphill colours, as on Trailmap and in the JOSM style:
  - **Width as line thickness**, the guide's classes: < 0.6 m thin, 0.6–0.9 m and untagged as today, 0.9–1.8 m thicker, ≥ 1.8 m like a track.
  - **Visibility as fading:** intermediate at 75 %; bad, horrible and no at 45 % with a dotted centre line. Good and excellent are drawn normally.
  - **Overgrown** (`obstacle=vegetation`): short green ticks beside the line. **Wet** (`surface=mud`, `obstacle=mud`): blue ticks.
  - **Icons:**
    - *fallen tree*: `obstacle=fallen_tree` on nodes, repeated along ways that carry it, plus `barrier=log`, `fallen_tree`, `windfall`, `debris`;
    - *gate*: every kind, red when there's no access;
    - *stile / kissing gate*;
    - *cycle barrier*;
    - *ford*.
- **How:** the tiles' paths have no OSM ids or detail tags. An overlay on top can't make a narrow trail look narrower than the tile line under it, so inside the tiles that have loaded, *all* trails come from Overpass and are drawn from OSM, and a `within` filter hides the vector tiles' own trail lines there. That's 262 trails in the Tykkikallio tile, so it costs little more than fetching only the detailed ones. Elsewhere the tiles draw trails as before.
- **One query per place:** the uphill layer's own z12 query for `mtb:scale:uphill` moves into these z13 tiles.

*Hover and click*
- The cached details show at once, e.g. "0.4 m wide · faint (bad) · overgrown · fallen tree here · boardwalk", plus smoothness, SAC and informal where tagged. "Show all OSM tags" stays for the rest.

*Planning*
- **Along the route, for free:**
  - **What:** `processUnusedTags=1` on every BRouter call gives visibility, smoothness, SAC, overgrown, fallen-tree and muddy ways, fords, boardwalks and barrier nodes, with no extra call.
  - **Kept out of the leg keys,** so saved routes and caches stay valid; older legs just lack the details until they're routed again.
  - **Valhalla stand-in legs** carry fewer tags; the details say so.
- **From the trail-details tiles:** width, and fallen trees on nodes. These are only the tiles the route crosses (capped at about 40), fetched while a route exists in a sport with Trail details on.
- **Heads-up**, each with Avoid as today, grouped when they repeat ("Fallen trees ×3 · km 2.1, 4.5, 6.0"):
  - fallen trees and logs within about 8 m of the route;
  - fords;
  - stiles, kissing gates and cycle barriers (bike sports: "lift the bike over");
  - faint stretches of 100 m or more ("hard to follow: have the map ready");
  - overgrown stretches of 100 m or more;
  - muddy stretches of 50 m or more;
  - boardwalks of 100 m or more, only when it has rained (the route style's wet check, Open-Meteo): "slippery when wet".
  - Round trips rank these by themselves, since the score already counts Heads-up items.
- **Profile colours:** *Width* and *Visibility* chips join the *Ground* group, with the breakdown bar (e.g. "< 0.6 m 3.1 km · 0.6–0.9 m 2.4 km · not tagged 8 km"). The route readout on hover adds width, visibility, smoothness and SAC where known.
- **Route style: one new choice, "Avoid obstacles and faint trails"**, for MTB, hike and trail run, off by default.
  - **How:** Polku's own MTB and hiking profiles, copies of the stock `mtb.brf` and `hiking-mountain.brf` with about 15 added lines, uploaded the way the road profile already is (`CUSTOM_PROFILES`, falling back to the stock profile with a note). They add costs for:
    - `trail_visibility` bad, horrible and no;
    - `obstacle=fallen_tree|vegetation` and `surface=mud` ways;
    - `barrier=log|fallen_tree|windfall|debris|stile|kissing_gate|cycle_barrier` nodes.
  - **Tuned** with `tools/style_probe.py` on the local BRouter, and the existing "what it changed" line shows the effect.
  - **Can't:**
    - width: it's not in BRouter's data;
    - fallen trees mapped as nodes: `obstacle` isn't in BRouter's node table. Those are warned about, with Avoid;
    - Valhalla legs: Valhalla has no such options.

**Where it lands in the UI**

| Where | What's new |
|---|---|
| Layers → Trails & difficulty | "Trail details" switch (default per sport), its map key, an "On now" chip |
| Map | thickness, fading, ticks; icons from z15 |
| Hover and click | the details, without "Show all OSM tags" |
| Planner → Heads-up | fallen trees, fords, barriers, faint, overgrown, wet stretches; Avoid; grouped |
| Planner → profile colours (*Ground*) | Width, Visibility |
| Planner → Route style | "Avoid obstacles and faint trails" (MTB, hike, trail run) |

**Left out, and why**
- **Smoothness and SAC as map modes:** 1 % and 3 % of Finnish paths, and `mtb:scale` (54 %) already says how rough a path is. They appear in hover, click and the route readout.
- **One trail-character colour mode at a time (the old plan):** not needed once width, visibility and obstacles use thickness, fading and icons, so difficulty colours never have to be turned off to see them.
- **Text labels for width or visibility (as in JOSM):** clutter on a riding map; hover gives the value.
- **"Wet" guessed from bogs:** the base map already draws wetland. Saying "through a bog, no boardwalk mapped" on routes is possible from the loaded tiles but noisy; later, if wanted.
- **`informal=yes`:** 13 % of paths, 26 % in Helsinki's Central Park. Everyman's right makes it mostly irrelevant, so it's shown in the popup only.
- **Static trail-detail tiles:** a PMTiles file built weekly by a GitHub Action from Geofabrik's Finland extract and served from GitHub Pages would remove Overpass from the map. It's a bigger change (a build pipeline, a 50–100 MB file, Pages limits) and is worth it only if Overpass proves too flaky in use. Not now.

**Budget**
- **Map:** z13 tiles (about 2.3 km), fetched only at zoom 14+ with Trail details on, at most 6 at a time (today's cap), and cached a week in IndexedDB. A failed tile is retried after 2 minutes, and the Layers note says "OpenStreetMap server busy".
- **Route corridor:** up to about 40 tiles, mostly the same ones.
- **BRouter:** no extra calls; answers grow a little with `processUnusedTags`.

**Two PRs, so neither drags**
- **12a — Map and details:** the z13 trail-details tiles (and the uphill layer on them), the Trail details layer and icons, hover and click.
- **12b — Route:** `processUnusedTags`, Heads-up items, Width and Visibility profile colours, corridor tiles, the avoid profiles and their route-style choice.

**Test**
- **Places:** Kauppi, Laajavuori, Nuuksio, Keskuspuisto, with the local BRouter for routes and the avoid profiles (`style_probe.py` cases).
- **Smoke, with a fixture tile** (no live Overpass in smoke): the details layer draws, icons appear at z15, and Heads-up lists a fallen tree and a ford on a fixture route.
- **Screenshots:** Kauppi at z15–16 with Trail details on (MTB and hike), hover on a faint trail, Heads-up with obstacles, the Width profile.

**Risks**
- **Patchy tagging:** the key and the details say "from OpenStreetMap, where mapped" and link to fixing the map.
- **Overpass load:** best-effort, cached, one query per tile, only at zoom 14+.
- **The custom profiles depend on brouter.de accepting uploads,** as the road profile does today; the stock profile is the fallback.

**Questions for the user, and the answers (2026-10-14)**
1. Trail details on by default for MTB, hike and trail run? **Yes: try it, change it if we don't like it.**
2. Polku's own MTB and hiking BRouter profiles for "Avoid obstacles and faint trails"? Or keep phase 12 to warnings and ranking only. **Warnings and ranking are enough for now.** So 12b has no avoid profiles; the Avoid button (a no-go circle) stays the way round an obstacle.
3. Two PRs (12a, 12b), or one? **12a and 12b.**

**Built (12a, PR #31)**
- **Tiles:** `js/trails.js`, one Overpass query per z13 tile, cached a week in IndexedDB (`js/osm.js`, which now holds the Overpass client for everyone). Each tile has:
  - every trail (path, bridleway, steps, MTB-graded footways) with its tags;
  - tracks, footways and cycleways only when they have obstacles, fords, mud, visibility or `mtb:scale:uphill`;
  - **fences, walls and hedges**, and gates, stiles, cycle barriers, fallen trees and fords **anywhere in the tile**. A user caught the water tower's locked gate on Tykkikallio missing: it sits on a service road and in a fence, not on a trail.
  - Size: the Tykkikallio tile is 192 KB of JSON (5–13 s) and 62 KB stored: 263 trails, 105 fences, walls and hedges, 33 obstacles.
- **Drawing, in Trailmap's and the JOSM style's language:**
  - inside the tiles that have loaded, trails are drawn from OSM, and a `within` filter hides the vector tiles' own trail lines there;
  - difficulty keeps the colour of the band, and the band's width follows `width` (< 0.6 m thinner, 0.9–1.8 m and ≥ 1.8 m thicker);
  - `trail_visibility` intermediate and bad get a dotted centre line and a lighter band; horrible and no show the colour only;
  - overgrown and wet stretches: bold round dots, green on one side and blue on the other (made bolder after the user compared them with Trailmap);
  - fences: brown dashes (hedges green, walls grey) from z15;
  - icons from z15: fallen tree or log, gate, gate with no access (red, `access=no` / `locked=yes`), stile or kissing gate, cycle barrier, ford.
  - It all has a map key under Trails & difficulty.
- **Switch:** "Trail details" in Layers → Trails & difficulty, on by default for MTB, hike and trail run and remembered per sport. It has an "On now" chip, and a busy toast at most every 10 minutes if Overpass fails. Tiles load from zoom 14, and loaded ones still draw down to zoom 12.
- **Hover:** width, visibility, overgrown, wet, fallen trees and boardwalk.
- **Click:** the same rows, plus smoothness, SAC and informal, and "Show all OSM tags" now fetches that exact way. An obstacle opens its own card: what it is, a "may have been cleared" note for fallen trees, its OSM tags, and a "Gone? Fix the map" link.
- **The uphill layer** takes its `mtb:scale:uphill` overrides from the same tiles; its own z12 query is gone.
- **Smoke:** `python3 tools/smoke.py trails` uses a recorded tile (`tools/fixtures/trails-tykkikallio.json`, © OpenStreetMap contributors), so smoke never calls Overpass. It checks:
  - trails are drawn from OSM and the tiles' lines are hidden there;
  - narrow, wide and faint trails are present;
  - icons and fences show up close;
  - the fallen tree opens its card;
  - road cycling starts with trail details off.

**Built (12b, PR #33)**
- **BRouter's own tags, for free:** every call asks for `profile:processUnusedTags=1`, so the answer carries trail visibility, obstacles, fords, boardwalks and smoothness, not just what the profile prices. The parameter is outside every cache key, so saved and cached routes stay valid.
  - Gates, logs, fallen trees, stiles, cycle barriers and fords at nodes ride along as `node:*` tags on the stretch that ends there, so splitting, reversing and saving routes keep them.
  - Checked on the local BRouter and once on brouter.de (`barrier=log` and both visibility values came back).
- **Along the route** (`analysis.js` `trailDetailsOf`):
  - per sample: trail or not, width class, visibility, overgrown, wet, fallen trees, ford, boardwalk;
  - the obstacles at nodes, at their exact place.
  - **With trail details on, the map's own tiles** (`trails.js` `detailsAlong`, up to 40 z13 tiles, cached) add width (not in BRouter's data) and fallen trees mapped as points (not in its node table). They also fill in visibility, overgrown and wet where the router said nothing, e.g. on Valhalla legs.
  - Matching rules: within 5 m and roughly the same direction; a road never takes a footway's tags.
  - Obstacles both sources know are deduped by place (≤ 15 m).
- **Heads-up** (`trailWarnings`), each with Avoid:
  - stretches: hard to follow (100 m+, *barely visible* where it's `horrible` or `no`), overgrown (100 m+), wet or muddy (50 m+), fallen trees on the trail, fords;
  - boardwalks of 100 m+ only when it has rained ("slippery when wet", the route style's wet check);
  - points: logs and fallen trees ("may have been cleared since"), stiles and kissing gates ("lift the bike over" for bikes), cycle barriers, gates with no access, fords.
  - Rows carry the map's own icons.
  - Three or more of the same kind fold into one row ("Fallen trees and logs ×3 · at km 1.2, 2.4, 3.9"); its Avoid marks them all in one undo step.
  - Round trips count them in their score and on their cards.
- **Profile colours:** *Width* and *Visibility* join *Ground* (not for road cycling or paddling), with breakdown bars (under 0.6 m · 0.6–0.9 · 0.9–1.8 · 1.8+ · not mapped · road or track). The hover readout adds width, visibility and smoothness.
- **Smoke:** `trails` now also restores a recorded BRouter route over Tykkikallio (`tools/fixtures/route-tykkikallio-mtb.json`) and checks:
  - exactly one log heads-up (the router and the tile both know it);
  - a faint stretch, and width along the route;
  - the icons, and the Width breakdown;
  - zero routing requests.
  - The layout checks hold Overpass back now: in headless Chrome, tiles loading live froze the page long enough to fail the sheet timing.
- **Review fixes in the same PR:**
  - **Uphill colours:** as wide as the difficulty band, with the trails' centre lines redrawn on top, so Uphill reads like Difficulty with trail details on. The switch-off-and-on bug was fixed in #32.
  - **Opacity sliders for the trail colours,** one for difficulty and one for uphill (both show in *Both*; the plain halo stays).
  - **On now and Base map fold away** like the other Layers groups (open unless you close them).
  - **The profile's *Both*:** climbs by uphill grade, the rest by MTB difficulty.
  - **A sport button in the planner header,** a native list next to Round trip and Style.
  - **Rain animation:** the number of drops follows the rate. Drizzle is a few short, faint streaks; full density from about 4 mm/h. Before, drizzle looked like pouring.
  - **The trail lines read from their own vector source** (the same OpenFreeMap tiles, from the HTTP cache), so a coverage change re-lays out only the trails, not the whole map. Trail details publish from zoom 13.
  - The Settings counter says what Overpass is for: trail details, uphill tags and click details.

**Later (from the 12 review, not built)**
- **Rain "now" from FMI's rain-rate product, not reflectivity** (found 2026-10-14).
  - **The problem:** in Jyväskylä at 06:30, the reflectivity composite Polku reads (`radar_finland_cappi_dbzh`, 28–38 dBZ, Marshall–Palmer) said 2–9 mm/h, drawn pink and pouring. FMI's own corrected rain rate (`radar_finland_cappi_rate`, GetFeatureInfo) said 0.003–0.01 mm/h; the forecast said 0.3 and the user saw drizzle. In autumn the melting layer is low, and reflectivity overstates light rain (the "bright band").
  - **What to do:** read the rain-rate layer instead. Its 8-bit GeoTIFF from the WMS is rescaled (raw 8 ≈ 0.01 mm/h), not mm/h, and a WCS GetCoverage probe in EPSG:3857 was refused. So find the right request: WCS in its native EPSG:3067 and draw it as an image quad; FMI's download service; or a 16-bit or float GeoTIFF from the WMS.
  - **Until then:** the drop count follows the rate (12b), but "now" still trusts reflectivity.
- **Fresher trail data.** Tiles are cached a week, so a fallen tree cleared yesterday still shows. Trailmap's makers have had trouble with detail loading and data that only updates a few times a day. Options:
  - show the tiles' age in the key;
  - a "Refresh trail details here" action;
  - refetch in the background when a tile you're looking at is older than a day, within the Overpass budget.
- **Uphill band at the trail's width:** today the uphill grades come from the vector tiles, which have no width. Grading the OSM ways (trail details) instead would let the uphill band follow width too.
- **Overpass load:** if the public mirrors stay this flaky (504s were common while building 12), consider the static PMTiles option from the 12 design.

## Phase 13 — Water routing

**Today:** `js/water.js` renders OpenFreeMap water white on black in a hidden map, adds streams as a cost, runs A* with a shore cost and a land cost for carries, then straightens. Phase 9 added "near the shore" and carry costs.

**Add costs to the same grid**
- **Fairways** (`vaylaalueet_uusi` from the Väylävirasto WFS that `nautical.js` already loads): a cost per cell inside a fairway. The cheapest path then crosses it straight rather than following it.
- **Shallow areas:** cells shallower than a minimum per craft (sea kayak about 0.3 m, canoe 0.3, SUP 0.2, rowing boat 0.5) cost a lot or are blocked. Source to settle in the phase:
  - Traficom's depth areas as **vector** (a WFS with `DRVAL1`/`DRVAL2`, if Traficom's INSPIRE service has one);
  - or the `DepthArea_A` **WMS** drawn into the hidden map, with its fixed colours mapped back to depth classes.
- **Rocks, shoals and marks:** a buffer (about 30 m) around underwater rocks and obstructions (Traficom layers, to be identified) and around isolated-danger and cardinal marks (Väylävirasto aids to navigation, loaded by `nautical.js`).
- **Optional:** "stay within N m of shore" as a setting (phase 9 has near-shore on or off), and **wind exposure**: open-water cells cost more with a strong onshore or side wind, from the route weather already fetched.

**Coverage and gaps**
- Check what's open and usable from a browser for the **sea** (Traficom charts) and **lakes** (SYKE lake depth data: WMS/WFS, licence, CORS), and Väylävirasto's inland charts.
- Where a leg has no depth data, Heads-up says so ("No depth data for this lake — shallows aren't avoided").

**UI**
- **Paddling Route style controls:** Fairways (avoid / ignore), Minimum depth (from the craft, editable), Shoals and rocks (keep clear / ignore), Shore (as now), Carries (as now), Wind (avoid exposure / ignore).
- **A note on why the route went where it did,** in Heads-up: "kept out of the fairway", "around a shoal", "close to shore because of the wind".

**Test**
- Before/after legs: Näsijärvi (Tampere; fairway and inland depth), a coastal archipelago route (Turku or Helsinki), a river (e.g. Kokemäenjoki).
- Keep grid size and time per leg in check: report the milliseconds and grid cells per leg before and after, and cap the extra data per leg.

**Risks**
- Depth rasters at the wrong resolution. WMS colour mapping depends on the style staying fixed, so test it against a known chart.

## Phase 14 — Round trips for paddling

- **After 13,** so loops use the new water costs. Same card UI as phase 10.
- **Generation:** `roundtrip.js` with the opposite water check. Via points must be *on* water: nudged along the circle onto open water, and away from shore by the near-shore setting. Legs are routed with Polku's own water router, so there are no routing API calls, but there is CPU, so measure the time for 3 candidates; fewer via points (3) and a coarser grid if needed.
- **Ranking:** distance match, open-water exposure (share of the loop far from shore), wind (headwind share from the route weather; one cached forecast lookup per candidate), carries, and anything Heads-up from phase 13.
- **Test:** loops from Tampere (Näsijärvi and Pyhäjärvi), the Helsinki archipelago and a river town.

## Phase 15 — Winter (research first, then build)

Winter is close in Finland, so this comes before Strava. **Research first, written here before coding:**
- **Sports for a "snow" group:** cross-country ski (classic / skate), snowshoe, winter walk, fat bike. For each: timing (speeds and snow effects), routing profile (BRouter has no ski profile: does its `lookups.dat` know `piste:type`? If not, do ski tracks need a small graph of our own from Overpass, as the water router does for water?), and default layers.
- **Ski tracks (latu):**
  - LIPAS ski-track types and their attributes (lighting, length, style);
  - OSM `piste:type=nordic` with `piste:grooming` (classic / skating) and `lit`;
  - whether any municipality (**Jyväskylä first**) publishes grooming status ("latu ajettu", last groomed) through an open API: URL, format, licence, CORS.
  Show tracks by style and lighting, with grooming age where known.
- **Snow:** snow depth from FMI open-data observations (stations), as a layer and along the route.
- **Ice:**
  - sea ice from FMI (Baltic ice charts: concentration, thickness);
  - lake ice from SYKE (thickness observations, satellite ice cover) or Copernicus Lake Ice Extent.
  For each: coverage, update frequency, resolution, licence, CORS and limits.
- **Effects to build:**
  - paddle warns about, or refuses, routes on frozen water;
  - winter sports may cross ice only where the data says it's frozen, always with a clear warning;
  - summer-only layers and warnings step back in winter.
- **Safety wording, a rule for every screen:** ice data is sparse and quickly out of date. Polku never says or implies that ice is safe to walk, ski or cycle on.
- **Season:** suggest winter sports when snow depth or the date says it's winter, without forcing it.
- **Found while researching phase 12 (2026-10-14):**
  - BRouter's `lookups.dat` *does* know `piste:type`, `piste:grooming` and `piste:difficulty`, and with `processUnusedTags=1` they come back along a route (1.4 km of a 5.9 km Kauppi route).
  - Finnish winter trail riding has a community tag, `mtb:winter=1/2/3` (how fast a path opens after snowfall; unofficial, used by Trailmap's winter map), plus `seasonal=winter` and `snowplowing` / `winter_service` on cycleways (wiki.trailmap.fi/fi/kartoitus/tagit).

## Phase 16 — Strava & Garmin (research and plan only)

- The brief is in **Later: Strava & Garmin** below.
- **Deliverables:**
  - local import of a Strava bulk export or a GPX/FIT folder into a heatmap in IndexedDB;
  - FIT course export for Garmin devices;
  - the OAuth options (a tiny serverless token exchange) and what Strava's and Garmin's APIs and terms actually allow;
  - using the history to calibrate speeds per sport (phase 6), and in route style and round trips to prefer familiar places or explore new ones.
- Written here as findings and a plan; **no code until the user OKs it.**

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
- **Bottom right:** one column, top to bottom — compass, locate, zoom, Weather, Layers, Plan (most used nearest the thumb). The scale bar and the attribution (i) are bottom left, so the column reaches the corner.
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

## Planner layout contract — sections and sizes (updated in #25)

- **One reading order everywhere:** Profile → Waypoints → Heads-up → Climbs → Departure & weather → Route style → Time & speed. Waypoints is near the top because it's what you edit; the settings come last. Each section folds and remembers it (side panel and phones).
- **Wide bottom panel** (container ≥ 900 px), always open, in rows: the profile across the top; then Waypoints · Heads-up and Climbs stacked in one column · Departure & weather; then Route style · Time & speed. Columns grow from a minimum width and wrap rather than squeeze; a section alone on a row lays its parts side by side (Departure: timeline | weather on the route; Time & speed: editor | on this route). Row breaks are `.sec-break` elements; the stack is `.sec-stack` (`display: contents` when narrow).
- **The header (always visible, also when folded to the summary)** carries the big choices in words: **the sport**, **Round trip** and **Style: …** (#27, the user's note: starting was confusing with round trips in ⋯; the sport button since #33). On a phone or the side panel they have a line of their own above the routing modes; from 560 px they sit right after the modes; from 1240 px the whole header is one line, and the common tools come out of ⋯ from 1560 px.
- **The header never spills over** (#34; the user's screenshot after the sport button joined it, a ~700 px window). Labels change with the sport and the style, so `planner.js` `fitHeader()` measures, on width changes and label changes, and picks the first arrangement that fits:
  1. one line, if the breakpoint allows it;
  2. two lines (`.two-line`);
  3. the quick buttons on a line of their own (`.stack`);
  4. compact labels: the sport's icon, the style without "Style:" (`.tight`);
  5. the routing modes as icons, so they share a line with the tools (`.tighter`).
  - `python3 tools/smoke.py header` checks nothing sticks out of the sheet at 360, 600, 700, 760 and 1300 px (bottom dock), with the longest sport name (Road cycling) and the Technical style.
- **The planner opens at the bottom by default** for everyone new (`plannerDock` defaults to `bottom`; the side panel is a choice in ⋯ and Settings).
- **The always-visible summary** is distance · time · ascent and descent together (↑42 ↓62 m); the stats row under it has the rest (hardest climb, speed, style; for paddling the wind and carry figures). On phones the stats are three even columns.
- **Bottom sheet sizes:** peek (the summary) · **profile** (the summary plus the elevation chart and its colours; the stats fold away; height measured from the content, at most 45 % of the screen) · half · full. Drag snaps to the nearest; a tap on the handle toggles between peek and your last size; arrow keys step through them. `tools/smoke.py` checks the profile size shows the whole chart.

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
  - Only free public services, and no backend: polku.si is GitHub Pages, and the user doesn't want a server. If a service doesn't hold up for our use, add a fallback or switch, don't get stuck on it.
  - **Never burst brouter.de while testing.** It blocks the whole connection (the user's too): 40 s for ~20 calls in 8 s, then half an hour after repeated bursts (2026-10-13). Test routing against `tools/brouter-local.sh` (Settings → Routing server) or a stand-in that answers in BRouter's GeoJSON format; one-off real calls are fine.
- **Don't regress:**
  - weather along the route, warnings and Avoid, water routing and carries;
  - offline save and preview, GPX/KML import and GPX export;
  - share links (`r`, `m`, `a`), 3D and hover details.
- **Merging publishes to polku.si,** so merge only when the user says so.
- **After each PR,** update the status table at the top and note anything that changed in the plan.
