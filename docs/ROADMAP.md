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
| 9 | Route style: presets and fine-tuning per sport, whole route or per leg, wet ground auto (redesigned) | `route-prefs` | [#24](https://github.com/TommiContursi/Polku/pull/24) | merged |
| 9½ | Planner layout pass: rows that don't squeeze, one section order, ascent with descent, a "profile" sheet size | `sheet-columns` | [#25](https://github.com/TommiContursi/Polku/pull/25) | merged |
| 10 | Round trips: 3 generated loops, ranked, with the cost shown (+ Round trip & Style in the header, bottom panel by default) | `round-trips` | [#27](https://github.com/TommiContursi/Polku/pull/27) | merged |
| 11 | Layers: every control in every sport, opacity per overlay, paddle soundings, "On now" first | `layers-fixes` | [#29](https://github.com/TommiContursi/Polku/pull/29) | merged |
| 12a | Trail details on the map: width, visibility, overgrown and wet, fallen trees, gates, fences, fords; hover and click | `trail-details` | [#31](https://github.com/TommiContursi/Polku/pull/31) | merged |
| 12b | Trail details along the route: Heads-up, Width and Visibility profile colours (+ review fixes) | `trail-route` | [#33](https://github.com/TommiContursi/Polku/pull/33) | merged |
| 12c | LIPAS routes into the planner (ride one, add one), routes and stops in search | `lipas-routes` | [#39](https://github.com/TommiContursi/Polku/pull/39) | merged |
| 13 | Water routing: fairways, rocks and marks, wind (no depths: licence, see the phase) | `water-routing` | [#40](https://github.com/TommiContursi/Polku/pull/40) | merged |
| — | First visit: open on Helsinki and ask for your location; later visits open where you left off | `first-visit` | [#41](https://github.com/TommiContursi/Polku/pull/41) | merged |
| — | A README with screenshots, a changelog, developer notes in docs/, Polku and its maker in the map's credits | `readme` | [#42](https://github.com/TommiContursi/Polku/pull/42) | merged |
| 13b | Multisport routes: a sport per leg (in the waypoint list too), changeovers, time per sport, Swim as a sport | `multisport` | [#43](https://github.com/TommiContursi/Polku/pull/43) | merged |
| — | The route on the map: a click opens the planner, a tap or right-click opens a menu for that part, LIPAS routes easier to pick | `route-menu` | [#44](https://github.com/TommiContursi/Polku/pull/44) | merged |
| — | Fix: route points stacked down off the route (from #43); tests could run on cached files | `marker-fix` | [#45](https://github.com/TommiContursi/Polku/pull/45) | merged |
| — | Reading the route: points snap onto the path, a tap beside a menu only closes it, the sport on the profile and map, distance marks, departure at the start, sunrise and sunset | `route-read` | [#46](https://github.com/TommiContursi/Polku/pull/46) | merged |
| — | Fix: a cleared route left its colours (and wind arrows) on the map | `clear-colours` | [#47](https://github.com/TommiContursi/Polku/pull/47) | merged |
| — | One click for the route: a click or a tap on the line, or on a leg's handle, opens that part's menu (no point added by mistake) | `route-click` | [#48](https://github.com/TommiContursi/Polku/pull/48) | merged |
| 13c | Stops and nights, days, a longer forecast, overnight spots, the gear check | `stops` | [#49](https://github.com/TommiContursi/Polku/pull/49) | merged |
| 14 | Round trips for paddling, and "More loops" in every sport | `paddle-loops` | [#50](https://github.com/TommiContursi/Polku/pull/50) | PR open |
| 15 | Winter research and plan (docs) | `winter` | [#51](https://github.com/TommiContursi/Polku/pull/51) | merged |
| 15a | Winter on the map: Auto / On / Off, the snow layer with FMI's measured depths, OSM's winter ways, LIPAS ski tracks, skating and snowmobile routes, sea ice | `winter-conditions` | [#52](https://github.com/TommiContursi/Polku/pull/52) | merged |
| — | Winter as a trail colour (Trails & difficulty: Off / Difficulty / Uphill / Both / Winter), any time of year; winter on the trail cards | `winter-colours` | [#53](https://github.com/TommiContursi/Polku/pull/53) | PR open |
| 15b | Winter on the route: keep off ski tracks, lit ways after dark, time in snow, winter Heads-up, paddling in the ice season | `winter-route` | — | next |
| 15c | Skiing (when it's winter) | `skiing` | — | planned |
| 21 | Say what it means: every colour and line explained in its hover and card, and everything Polku works out shown, not only used (an audit of every layer) | `explain` | — | planned, after 15b |
| 20 | Map style: how roads, cycleways, paths and the rest are drawn (Trailmap's cartography as a guide); LIPAS routes by category (cycling, MTB, hiking, walking) | `map-style` | — | planned |
| 16 | Strava & Garmin (research and plan only; no code until OK) | `strava-garmin` | — | planned |
| 17 | Weather: clouds, thunder, snow, the timeline back in time; a check before heavy loads | `weather-layers` | — | planned |
| 18 | Languages: English, Finnish and Swedish, with a switcher in Settings (your browser's language by default) | `languages` | — | planned |
| 19 | Help and a tutorial (the last phase: when the rest has settled) | `help` | — | planned |

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
  - with a mouse the drag starts after 4 px of movement (a plain click added a via point; since #48 it opens that part's menu);
  - on touch, hold the line for 300 ms first (a short buzz where supported), so a swipe across it still pans the map; map panning is off until the release;
  - the new point appears under the pointer; the release is one undo step.
- **Live re-routing while dragging** (`beginEdit` / `editTo` / `previewLeg` / `fetchPreview` / `endEdit`):
  - only the two legs beside the point change, and only their geometry is drawn; the analysis, the coloured line and the hover readout wait for the release;
  - per leg: a request when the pointer rests for 250 ms, or every 0.7 s at most while it moves, one at a time and each allowed to finish; an answer for a spot the pointer has left is still drawn (grey dashed, joined to the pointer), better than a straight line;
  - measured: a quick drag costs 2 requests (one per leg), a 3.6 s continuous drag 12 in all;
  - `router.js` shares requests in flight (`shared()`): the release reuses the preview's request for the final spot instead of repeating it; a request is cancelled only when every caller has given up;
  - straight legs update instantly, imported tracks only move their end, water legs are routed on release (the water router is too heavy for every move).
- **Adding a point on the line costs nothing:** `splitLeg()` splits the current geometry at the nearest spot, and both halves keep their routing key. Undo, "Start here" and turning a loop round are free too.
- **Leg handles:** a small ring in the middle of each leg (drag it, or click it for a via point; since #48 a click opens that part's menu); hidden where the leg is under 120 px on screen and while dragging.
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
- **Rain "now": FMI's rain rate, built in #35** (found 2026-10-14; the user's screenshots: pink and pouring over Jyväskylä in drizzle).
  - **Cause:** the reflectivity composite (`radar_finland_cappi_dbzh`, Marshall–Palmer) said 2–9 mm/h; FMI's corrected rain rate said 0.01–0.05. In autumn the melting layer is low, and reflectivity overstates light rain.
  - **Built:** `js/radar.js` reads `suomi_rr_eureffin`: 16-bit, mm/h × 100 (from its own colour map: 7 = 0.07 mm/h … 2513 = 25 mm/h), the same values whatever box is asked for, and shown from 0.1 mm/h.
  - Light rain is drawn fainter (strength grows with the rate), so drizzle no longer paints the map purple.
  - If that layer stops answering, reflectivity takes over on its own.
  - **Ruled out:** `radar_finland_cappi_rate` (its 8-bit GeoTIFF is stretched per request: the same pixel read 103 in one box and 17–22 in another), WCS (disabled on FMI's server) and FMI's styled map tiles (evaluation only).
- **Before the end of November 2026: a rain-rate source to replace `suomi_rr_eureffin`.** It's one of the old layers FMI retires then; the reflectivity fallback is right in showers but wrong in drizzle. Candidates:
  - FMI's open radar composites on AWS (rain-rate GeoTIFFs in EPSG:3067, about 1 km; check CORS, size and compression);
  - a new rain-rate layer, if FMI's download service publishes one with fixed values;
  - otherwise, a reflectivity correction for the melting layer (temperature from the forecast).
- **Fresher trail data.** Tiles are cached a week, so a fallen tree cleared yesterday still shows. Trailmap's makers have had trouble with detail loading and data that only updates a few times a day. Options:
  - show the tiles' age in the key;
  - a "Refresh trail details here" action;
  - refetch in the background when a tile you're looking at is older than a day, within the Overpass budget.
- **Uphill band at the trail's width:** today the uphill grades come from the vector tiles, which have no width. Grading the OSM ways (trail details) instead would let the uphill band follow width too.
- **Overpass load:** if the public mirrors stay this flaky (504s were common while building 12), consider the static PMTiles option from the 12 design.

## Phase 12c — LIPAS routes & search (OK'd and built 2026-10-14)

**The user's ask:** use the existing routes (LIPAS) in planning: add one to a route, or choose to ride one. Make them findable in search, and develop search further. Later, the user's own saved places, perhaps with a login (see [BACKLOG.md](BACKLOG.md)).

**What Polku does today**
- **LIPAS on the map:** official routes and stops (lean-tos, huts, campfire and landing sites) are drawn per sport. They load by area from LIPAS's WFS (`js/lipas.js`, cached per z9 tile).
- **The card:** a click opens name, type, municipality, length, notes, Website and LIPAS links, plus *Route from here*, *Add to route* and *Avoid*. Those use the clicked *point*, not the route.
- **Search** (`js/search.js`): places from Photon (OSM) and coordinates. LIPAS routes and stops aren't in it.

**Checked (2026-10-14)**
- LIPAS's WFS takes name filters across all of Finland, one type per request (`CQL_FILTER=nimi_fi ILIKE '%…%'`). "koko kierros" returned five cycling routes around Tampere (Pyhä 117 km, Näsi 338 km…) as LineStrings with their properties.
- Useful properties: length (`reitin_pituus_km`), municipality, surface, width (`reitin_leveys_m`), lit km, rest stops (`taukopaikat_lkm`), website, notes.
- Asking for several types at once, or for only some properties, failed. So search makes one small request per route type, and the geometry is fetched only when you pick a result.

**Design**
- **Ride a LIPAS route.** On its card, *Ride this route* makes its line the planned route, the way a GPX import does: fixed legs, **no routing calls**. It also:
  - starts at the end nearest to you (or the map centre), and keeps loops as loops;
  - takes the route's name;
  - stitches multi-part routes end to end, routing the gaps.
  - Then everything else applies: profile, Heads-up, trail details, style, editing (moving a via point re-routes only that leg).
- **Add a LIPAS route to yours.** *Add to route* on the card routes from your route's end to the LIPAS route's nearer end, then follows it as fixed legs. Today the button adds just the clicked spot.
- **Search, one box, results grouped:**
  - *Places* (Photon, as now);
  - *Routes* (LIPAS, by name, all route types: "Pyhä", "koko kierros", "Laajavuori"), each with type, municipality and length;
  - *Stops* (LIPAS lean-tos, huts and campfire sites by name);
  - *Trails* (named paths on the loaded map, e.g. "Rantapolku");
  - *Coordinates*.
  - Picking a route fits it on the map and opens its card, with *Ride this route* one tap away.
  - Recent searches are kept on the device.
  - LIPAS is asked only from 3 characters, debounced, with answers cached per query, through `net.js` ("lipas", already counted).
- **Later** (BACKLOG): your own saved places, starting on the device (star a place, export or import), synced only if a login ever comes (phase 16's backend question); "near me" categories in search; OSM route relations (Waymarked Trails) as rideable routes.

**Test**
- Ride Pyhä Koko kierros (117 km) with zero routing calls, and add a LIPAS route to an existing route.
- Search "koko kierros", "laajavuori", "laavu".
- Smoke, from recorded LIPAS answers: the ride makes fixed legs, and search groups its results.

**Built (12c)**
- **What LIPAS's routes really look like** (186 places around Jyväskylä and the Tampere "Koko kierros" routes, checked 2026-10-14): every part is a LineString, but a place has up to 232 parts (`reitti_id`). Some are one line (Multamäen MTB-lenkki, Pyhä Koko kierros), some a chain or a loop of parts, some a loop with a spur to a car park, some a network of fitness loops (Laajavuoren ulkoilureitit). LIPAS's EPSG:4326 output is rounded to 4 decimals (up to 11 m off), so Polku asks for EPSG:3067 and converts it itself (`geo.js tm35ToLonLat`, checked against LIPAS's own output). The map's LIPAS lines use it too.
- **Making one line of the parts** (`lipas.js rideOf`):
  - part ends within 20 m meet at a junction, and loose ends within 400 m are bridged;
  - if the parts can be ridden one after another, each once (an Euler path: chain, loop, figure of eight), that's the ride, going as straight on as it can at junctions;
  - a loop with a spur (two odd junctions close together) rides the spur out and back;
  - parts not joined to the rest (a shortcut or a side trail LIPAS didn't connect) are left out, and the card says how much;
  - a network that can't be ridden in one line rides the stretch you clicked (or the longest), and says so.
  - Gaps under 30 m are drawn across; longer ones (and a loop's last gap, like Pyhä's 131 m) are routed legs.
  - Around Jyväskylä, about nine places in ten ride as one line.
- **Ride this route** (card): the line becomes the plan as fixed legs, so no routing calls. A loop gets two via points, so it can be dragged and has a finish of its own. It takes the route's name, and undo brings your old route back. A one-way route starts at the end nearer you (your location if Polku knows it, else the map's centre).
- **Add to route** (card): a routed leg from your route's end to the LIPAS route's nearer end (a loop: its nearest point, ridden round back to it), then the line.
- **The card** says what riding gives before you tap ("18 km · a loop. Follows LIPAS's line: no routing needed", or "A network of trails: riding takes the stretch you clicked"). It asks LIPAS once for all the parts (kept for the session).
- **Share links** carry LIPAS legs as references (`lr=0:4411.615379.1.0.6004,…`: leg, type, place, parts, metres along), not their line. Opening one fetches the place and clips the line, with no routing. If LIPAS doesn't answer, those legs are routed. Older links and imported GPX legs work as before.
- **Search, grouped** (`search.js`):
  - Groups: Coordinates · Recent · Places (Photon) · Routes (LIPAS) · Stops (LIPAS) · Trails on the map (named paths in the loaded tiles, no request).
  - A group that arrives later goes below the ones showing, so nothing moves under your finger.
  - A path named like a LIPAS route, and Photon's copies of trails already listed, are dropped.
  - Routes rank by how well the name matches, your sport's route types, and nearness.
  - LIPAS is asked from 3 characters: three small requests (routes near and in all Finland, stops near), names and types only, from the combined layers `lipas_kaikki_reitit` / `lipas_kaikki_pisteet`, which do take one filter over every type. Answers are kept per query.
  - Picking a route fits it, draws it on top at any zoom (`lipas-pick`), and opens its card. A stop flies there and opens its card.
  - Your last six picks are on the device (Recent).
- **Tests:** `tools/smoke.py lipas` finds Multamäen MTB-lenkki and two stops by "multam" from a recorded file (`tools/fixtures/lipas-multamaki.json`), rides it (3 fixed legs, a loop, 18 km), and rebuilds it from its share link, all with no routing request. Scenes are in `tools/shoot.py` (`*-search-lipas`, `*-lipas-card`, `*-lipas-ride`).

## Phase 13 — Water routing (built 2026-10-14; redesigned on what the data allows)

**Before:** `js/water.js` rendered OpenFreeMap water white on black in a hidden map, added streams as a cost, ran A* with a shore cost and a land cost for carries, then straightened. Phase 9 added "near the shore" and carry costs.

**The plan was** costs for fairways, shallows (per craft), rocks, shoals and marks, and the wind, with Heads-up saying why the route went where it did.

**Checked (2026-10-14): what may be used for routing**
- **Traficom's depth data can't be.** Its WFS (`inspirepalvelu/rajoitettu/wfs`) has depth areas with `DRVAL1`/`DRVAL2` and is open to browsers. But the hydrographic data licence grants use "for other than navigational purposes", and counts route planning as navigation; Traficom's page says navigational use needs an agreement (copyright@traficom.fi). Its open depth data covers the sea and only the Vuoksi, Kymijoki and Kokemäenjoki watercourses inland. Polku keeps showing Traficom's depth layers (with "not for navigation" in their attribution, as the licence asks), but the router doesn't read them.
- **SYKE's lake depths are open** (CC BY 4.0, CORS, `paikkatiedot.ymparisto.fi/geoserver/inspire_el/wfs`). But they cover 1,922 mostly small lakes (not Näsijärvi, Päijänne, Jyväsjärvi, Keitele, Vesijärvi or Längelmävesi), and their shallowest class is 0–1.5 m, which can't tell a kayak's 0.3 m. Not used; SYKE also asks intensive users for an identifier.
- **Väylävirasto's fairways and marks are CC BY 4.0** with no navigation clause.
  - Fairway areas carry the design draught (`mitoitussyvays`), so shipping lanes (7–15 m) and small-boat routes (1.8–4 m) can be told apart; harbour basins are a type.
  - Aids to navigation give isolated-danger and cardinal marks.
- **OpenStreetMap (ODbL)** has rocks, reefs and shoals, sparsely: southern Näsijärvi had 33 rocks, 3 reefs and 3 shoals. Overpass was failing on every mirror at times while testing.
- **NLS terrain database water rocks** ("vesikivi") need an API key: a later option with the user's own key, as Polku's MML layers already do.

**Built**
- **A second, synchronous drawing of the same window** (canvas, the hidden map's projection: about 15 ms) marks each cell:
  - its fairway class;
  - a keep-clear zone: 45 m round isolated-danger marks; 55 m round cardinal marks, centred 35 m to the side they warn of; 25 m round OSM rocks; reef and shoal areas plus 15 m;
  - places you avoid (now honoured on water legs too).
- **Costs:** a shipping lane ×4 (so it's crossed straight, not followed), a harbour basin ×2, a small-boat route ×1.1, a keep-clear zone ×10, an avoided place ×60.
- **Wind:** the forecast at the leg's start (`at`: departure plus the way so far at your craft's speed). For each water cell, the fetch (open water upwind, to 8 km, the window's edge counting as 2 km more) gives a wave height (JONSWAP, Hs = 0.0016·U·√(F/g), with a quarter of the gust). Water rougher than half your craft's comfortable wave (sea kayak 0.35 m, canoe 0.25, SUP 0.2) costs more and more.
- **String-pulling keeps to the costs:** a straightened line may not cost more than the way A* found (3 % slack), so it can't cut through a keep-clear zone or slant along a lane.
- **Heads-up** (`planner.waterWarnings`):
  - "Crosses the Särkän väylä" (the lane's name from Väylävirasto), "Along a shipping lane for 1.2 km", "Through a harbour basin";
  - "Close to a marked rock or shoal" (only when the way had to pass one);
  - "Rough for a SUP: waves up to about 0.3 m" with the wind;
  - "Not checked on the water: OpenStreetMap didn't answer".
- **Sources that are slow don't hold up a route.** Each gets 4 s, then the leg is routed without it. When the answer arrives (cached: OSM hazards per z11 tile for a week), the planner re-routes those legs by itself. While you look at the map in Paddle at zoom 11+, the hazards and fairways for the view are fetched ahead.
- **Route style for Paddle** gains Fairways (Cross straight / Ignore), Rocks & shoals (Keep clear / Ignore) and Wind (Keep sheltered / Ignore), and a "Direct" preset (fairways and wind ignored). Changing the departure hour or the craft re-routes water legs. `water.js` keeps routes per wind class (direction to 45°, speed to 2 m/s), so re-timing mostly costs nothing.
- **Tests:**
  - `tools/smoke.py water` uses recorded Väylävirasto data (`tools/fixtures/water-helsinki.json`), a fixed 10 m/s southerly and no OSM. It checks that the lane is crossed (no longer inside it than when fairways are ignored), that a rock put on the direct line is kept clear of, that the planner's Heads-up names the crossing, and that no routing requests are made.
  - `tools/water_probe.py` measures before and after per leg.

**Measured** (`tools/water_probe.py`, headless Chrome, a fresh profile, so the first leg in an area also waits for its data):

| Leg | Before | After (sea kayak) | After (SUP) | What changed |
|---|---|---|---|---|
| Helsinki: Kaivopuisto → Suomenlinna | 1.41 km · 754 ms | 1.41 km · 93 ms | 1.46 km · 78 ms | Crosses the Särkän väylä straight in 78 m (before: about 200 m slanting through it). The SUP keeps out of 0.3 m waves (10 m/s southerly). |
| Turku: Ruissalo → Hirvensalo | 8.15 km · 318 ms | 8.18 km · 4.3 s | 8.18 km · 4.3 s | Harbour basin noted (348 m). Overpass didn't answer in time, so it was routed without OSM's rocks (and is re-routed when they come). |
| Näsijärvi: Mustalahti → Siilinkari | 6.08 km · 99 ms | 6.21 km · 2.5 s (first data) | 6.47 km · 209 ms | Only small-boat fairways here (draught 1.8–2.4 m), so no fairway notes. The SUP takes 0.4 km more to stay in calmer water (6.5 m/s, SE). |
| Kokemäenjoki at Pori | 7.77 km · 195 ms | 7.82 km · 4.1 s | 7.82 km · 4.1 s | A river: nothing to avoid; Overpass didn't answer in time. |

- **Grid cells are the same as before** (0.8–1.2 million per leg). Once a window's data is in, the extra time per leg is 10–30 ms for drawing the costs, about 10 ms for the wind, and up to 1.3× the A* time. The rest of "After" is waiting for data the first time.
- The wait for a source was then cut from 4 s to 2.5 s, since the leg is re-routed when the data arrives anyway.

## Phase 13b — Multisport routes (OK'd 2026-10-14; before phase 14)

**The user's answers (2026-10-14):**
- **Flexible:** any sport after any other, with the suggestions below.
- **Swim is a sport of its own, in the sport switcher.** The rule: any sport a leg can have is also a sport in the switcher.
- **Before phase 14.**
- **Each leg's sport is also in the waypoint list,** next to Follow / Straight / Water and the leg's style, for easy editing. The changeover time goes on the waypoint's row.
- **Stops and nights** *(user, 2026-10-14)*: a waypoint can be a stop of its own, not only a changeover. Examples are a break ("Lunch, 1 h") or a night ("Sleep at the lean-to, go on at 08:00"), on a bike tour, a hike or a paddling trip.
  - The time after a stop moves on by its length, so arrival times, the route weather and the timeline's shaded band follow. Day 2 starts when you say.
  - The summary shows days for a trip over midnight: "Day 1: 62 km · 4 h 10 · Day 2: 48 km · 3 h 20", with each day's weather.
  - Overnight spots nearby are suggested from LIPAS (lean-tos, huts, campsites) and OSM (shelters, campsites).
  - The forecast reaches 49 hours today (`forecast_hours=49`). Multi-day trips need up to about 7 days: Open-Meteo has 16, at more data per call. Polku would say when a day is beyond the forecast, or turning less certain.
  - Share links carry the stops (`st=`: point, minutes or the time to go on).

**The user's ask:** "consider multisport activity route planning". For example: bike to a lake and paddle across; hike to a lake with a packraft; swimrun (run and swim in turns); triathlon training. Later (phase 15), ski and skate on ice.

**What Polku has:**
- The sport is the route's (the pill), and it sets the router, speeds, layers, Heads-up and colours.
- Each leg already has its own route style and its own way of routing: Follow paths, Straight or Over water.
- Water legs carry over land on foot.

**Proposal**
- **A sport per leg.** Each leg may have its own sport; the default is the route's. The leg's sport picks its router (BRouter's profile; Paddle, and a new Swim, use the water router), its style controls, its speeds and its Heads-up rules (trail details on bike and foot legs, the water notes above on water legs).
  - Set it in the point menu ("From here: Paddle ▾"), in a leg's settings row, or with "Change sport here" on the line.
  - **A hint while drawing:** clicking on water while drawing a land sport offers "Paddle from here?"; clicking on land while paddling offers "Carry, or go on foot or by bike?".
- **Changeovers.** A point where the sport changes is a changeover. Its marker shows both sports, and it has a changeover time, editable in its menu (about 15 min bike↔paddle, 10 hike↔paddle, 1 run↔swim). The time counts in the total and moves the weather timeline.
- **Gear check.** Heads-up warns when you leave something behind and don't come back for it: "Your bike stays at the shore (km 12) — the route doesn't come back there". Each changeover says whether the gear is *carried along* (packraft, folding kayak) or *left here*.
- **Time and profile per sport.** The summary splits the time, for example "Bike 22 km · 1 h 05 · Paddle 6 km · 1 h 10 · changeovers 25 min". The profile gets a band with each leg's sport. MTB and uphill colours apply to bike legs.
- **Weather** uses each leg's own speed for arrival times, and each sport's wind rules (paddling's wind classes on water legs).
- **Share links:** an `s=` parameter with one letter per leg, only when a route mixes sports, so single-sport links stay as they are.
- **Swim** as a sport (open water, about 2–3 km/h; near the shore; fairways strongly avoided), for swimrun and triathlon.
- **Later:** multisport round trips (phase 10 and 14 loops are single-sport); a "Swimrun" preset that switches run and swim at the water's edge by itself.

**Built (13b), 2026-10-14.** Split like 12a/12b: the sport per leg here; stops, nights and the gear check in **13c**.
- **A sport per leg** (`planner.legSport(i)`): a leg's own sport, else the route's. A water leg in a land sport counts as Paddle, as Polku already timed it. Each leg is routed by its sport:
  - its BRouter profile;
  - its style (yours for that sport, unless the leg has its own);
  - its craft on the water (Swim for swim legs);
  - its speeds, warnings and trail details.
- **Where to set it:**
  - the leg's row in the waypoint list (a sport picker beside Follow / Straight / Water and the style);
  - the point menu ("Next leg");
  - **a hint while drawing**: a new leg that's mostly water in a land sport offers "Paddle it"; one mostly on land while paddling or swimming offers the land sport. It reads the water drawn on the map, with no request.
  - A new leg goes on in the sport of the one before.
- **Changeovers:**
  - The default time depends on the pair: bike ↔ paddle 15 min, foot ↔ paddle 10, swim ↔ run 1, swim ↔ bike 3, bike ↔ foot 5.
  - The minutes can be edited on the waypoint's row and in its menu.
  - They're added to the time, so arrival times and the weather on the route move on by them.
  - The marker gets the next sport's badge.
- **Time & speed:** the speeds of every sport in the route, and "By sport" (distance, moving time, speed) plus the changeovers. The surface breakdown leaves the changeovers out.
- **Swim is a sport** in the switcher:
  - the water router near the shore, keeping out of every fairway where it can;
  - a pace per 100 m (2:24 by default);
  - wind ratings for swimmers;
  - LIPAS beaches and swimming places on the map and in search;
  - land between swims goes on foot.
- **Share links** carry `s=` (one letter per leg, `-` for the route's sport) and `cw=` (changeover minutes you set). The saved route and offline areas keep both. Old links are unchanged.
- **Tests:** `tools/smoke.py multi` builds a ride → paddle → run route with straight legs (no routing). It checks each leg's sport, the 15- and 10-minute changeovers (one then set to 3), the time per sport, the badges and the list, and the share link and the saved route. Scenes are `*-multisport` and `*-multisport-time`, routed on the local BRouter.

## Between 13b and 13c — reading the route (built 2026-10-14)

*(User, 2026-10-14, after #44)*:
- "the route balls are off from where they should be, hundreds of metres" (fixed in #45: a CSS rule from #43);
- "with Follow paths, the balls should snap to trails / roads";
- "on mobile, tapping outside a small modal to close it adds a new point; add an × too";
- "it isn't easy to see the sport of each section: show it on the profile and on the map, and under every chart style as a line and an icon";
- "km / time on the route line?";
- "change the start time in the waypoint menu";
- "sunrise and sunset, important especially for kayaking".

What was built:
- **Snapping** (`planner.snapPoints`): after routing, a point whose legs all follow paths moves onto the line, where the router joined the way (BRouter's own ends: 2–96 m at the user's test spot). It doesn't snap if the legs disagree or it's over 400 m; straight, water and imported legs keep your spot. Leg keys follow, so nothing is routed again. A gap that's left is drawn as a thin dashed line (`route-gap`).
- **Menus:** an × on every planner menu. A click or tap that starts while a menu or card is open just closes it (the planner adds nothing; on touch, the inspector doesn't open the next card).
- **The sport on the profile:**
  - a "Sport" colour mode (group *Route*), with "On map" colouring the route line;
  - a strip under the profile in every colour mode, coloured by sport with its icon, for a multisport route (`chart.js drawSports`).
- **Distance marks** on the route line: every 1, 5, 10 or 25 km by length, optionally with the time you'd be there. Both are switched in the planner's ⋯ menu (on, times off) and remembered.
- **Departure** from the start point's menu and the start's row in the waypoint list (the timeline's hours), kept in step with the timeline.
- **The sun** (`js/sun.js`, the sunrise equation, no service):
  - "Sunrise · sunset · dark from" at the start in Departure & weather, or midnight sun or polar night (with its midday twilight).
  - Heads-up: "After sunset (18:18) for 3 km" and "In the dark for 2 km", at the times you'd be there, with a light reminder (required on the water).
  - Checked: Helsinki 14 October 07:57 / 18:17, midsummer 03:55 / 22:51, Utsjoki's polar day and night.
- **Tests:** `smoke.py routebits` covers sunrise and sunset, the strip, Sport, the marks and their switch, the sun line, snapping without routing again, a click beside a menu, and the menus' × and departure.

## Phase 13c — Stops and nights (built 2026-10-14, #49)

From 13b's plan *(user, 2026-10-14)*:
- **A stop at any waypoint:** a break ("Lunch, 1 h") or a night ("go on at 08:00"). The time after it moves on, and the route's weather follows.
- **Days** for a trip over midnight, with each day's weather.
- **Overnight spots** suggested nearby: LIPAS lean-tos, huts and campsites; OSM shelters.
- **A longer forecast for multi-day trips:** up to about 7 days from Open-Meteo, saying where it's beyond the forecast.
- **The gear check:** Heads-up warns when a sport's gear stays at a changeover the route doesn't come back to. Each changeover says *left here* or *carried along* (a packraft, a folding kayak).
- Share links carry the stops (`st=`).

**Built (13c), 2026-10-14** (`js/stops.js`, `planner.js`, `weather.js`):
- **A stop at any via point** (`planner.pstop`, kept with the point like its name, so it survives a drag, a reorder and undo):
  - **a break:** minutes;
  - **a night:** the hour you go on ("on at 08:00"). It lasts until that hour comes round after you arrive (local time, so summer time is right), with the changeover inside it.
  - Set in the point's menu (No stop / Break / Night), in its waypoint row (a ⏸ button and a chip with the minutes or the hour), or with **Stop here** in a part of the route's menu (a point there with a 30 min break).
- **Timing** (`planner.timed`): the waits are worked out in order along the route, because a night depends on when you get there. The wind's times are used once they're in, so arrival times, the route weather, the distance marks' times, the sun warnings and the timeline's band all move on by them.
- **Waypoint rows** show when you'd get to each point (with the day when it isn't the day you leave), and a night's length.
- **Days** (`tripDays`, `dayWeather`), under Departure & weather for a trip with nights: each day's date and hours, distance, moving time, climbing, where you sleep, and its temperature, strongest wind and rain. A tap on a day shows it on the profile and the map. The summary shows the moving time, with "2 days" under it.
- **Places to sleep nearby** (`staysNear`), in a night's menu: LIPAS lean-tos, huts, lodges and campsites, and OpenStreetMap's campsites, huts and lean-tos within 3 km (one LIPAS request and one Overpass query, cached). LIPAS's answer shows first, then OSM's adds to it. **Go here** moves the point there and names it after the place. Measured in Nuuksio: 1 LIPAS lean-to and 7 OSM campsites and huts, about 2–6 s (Overpass is the slow one).
- **A longer forecast:** when the trip ends more than 46 h from now, the route's points are asked for 10 days (`forecast_hours=240`), cached apart from the map's 49-hour cells. Departure & weather says where it's more than three days ahead ("less certain"), or where the forecast runs out.
- **The gear check** (`gearChecks`): changing out of a bike or a boat leaves it there, unless **Take the bike along** (or the kayak) is switched on in that point's menu (a packraft, a folding bike). Heads-up says "Your bike is still at Via 1" when the route goes on with it from somewhere else (over 300 m away), and "Your sea kayak stays at Via 2" when the route doesn't come back for it. MTB to gravel is the same bike, and on foot or swimming there's nothing to leave.
- **A short night:** Heads-up warns when a night gives under 5 hours, for example arriving at 03:00 and going on at 08:00.
- **Share links** carry `st=` (`1:45,2:n0800`: a 45 min break at point 1, a night at point 2 going on at 08:00) and `cg=` (points where the gear goes along). The saved route, offline areas and undo keep both. Old links are unchanged.
- **GPX export** puts the stop in each waypoint's description ("Night · on at 08:30").
- **Fixed on the way:**
  - dragging a point lost your changeover minutes there (only its name moved with it);
  - changed changeover minutes weren't saved until the next route change;
  - "Depart → back 16:40" said *back* for one-way routes too ("there" now, with the day for a trip over midnight);
  - leaving after sunset, the dark warnings gave the departure as the time of sunset or dusk (`sun.js darkness()` now also returns the sun's own times, `sunFrom` / `sunTo`).
- **Menus scroll** when they're taller than the room above the planner (a night's menu with its places), and move again when the places list makes them wider.
- **Tests:** `tools/smoke.py stops` builds MTB → paddle → MTB on straight legs (no routing). It checks:
  - the gear warning, and that it goes when the bike is taken along;
  - a 45 min break plus the 15 min changeover;
  - a night ending at 08:00;
  - "2 days", the two days and their moving time;
  - the sun's own time when leaving after dusk;
  - the badges, rows, Time & speed and the menu;
  - a short night;
  - undo, a drag, the share link and the saved route.
  
  `tools/shoot.py` has `*-stops`, `*-stops-list`, `*-stop-menu` (a Nuuksio overnighter on the local BRouter, with live places to sleep) and `*-gear`.

## Phase 14 — Round trips for paddling (and more loops for every sport) (built 2026-10-14, #50)

- **After 13 and 13b,** so loops use the new water costs. Same card UI as phase 10.
- **More loops** *(user, 2026-10-14)*: if none of the first three suit you, a "More loops" button, or swiping or scrolling past the third card, makes three more. They go in other directions and with other via points. Each costs routing calls in land sports (counted, and paced like the first three); paddling loops cost CPU only. This applies to every sport, not just paddling.
- **Generation:** `roundtrip.js` with the opposite water check. Via points must be *on* water: nudged along the circle onto open water, and away from shore by the near-shore setting. Legs are routed with Polku's own water router, so there are no routing API calls, but there is CPU, so measure the time for 3 candidates; fewer via points (3) and a coarser grid if needed.
- **Ranking:** distance match, open-water exposure (share of the loop far from shore), wind (headwind share from the route weather; one cached forecast lookup per candidate), carries, and anything Heads-up from phase 13.
- **Test:** loops from Tampere (Näsijärvi and Pyhäjärvi), the Helsinki archipelago and a river town.

**Built (14), 2026-10-14** (`js/roundtrip.js`, `planner.js generateLoops`, `water.js`, `waterdata.js`):
- **Round trips for Paddle and Swim,** with the same cards as on land. The legs go through Polku's own water router, so there are no routing calls: it's computing time on the device, and the water data (fairways, marks, OSM rocks) is fetched once for the area, cached per tile.
- **From the water:** a click on land (a shore, a car park by the lake) starts the loops from the nearest water, up to 1 km away (`nearestWater`).
- **Via points on the water** (`planWater`): three per loop (four legs of A*, not five). Each one is moved along the circle, nearer the start or further out, to a spot with water 40 m round it. With "Near the shore" it also has to be within 350 m of land.
  - The loop's straight lines are checked for land, where carries would come.
  - A ring that would cross over 30 % land gives way to **out and back**: one turning point half the length away, on the water. That's what a river gets.
- **Picked by:** distance match, carrying (a loop carrying over 200 m tries another direction first; over 400 m, or a quarter of its length, isn't shown), paddling the same water twice (except out and back, which says so), and the water router's notes (shipping lanes, rough water for your craft at your departure, rocks). The wind counts through the router, which keeps out of rough water; the headwind share isn't scored.
- **Cards for the water:** time, carrying, out and back, the shipping lanes, rough water, rocks.
- **Detour factor:** 1.0 for paddling and swimming (water routes ride about the circle), measured on the places below.
- **Time:** at most nine loops tried, and no more replacing after 12 s.
- **More loops** (every sport): a card after the loops makes three more in directions not tried yet. The first ones stay, up to nine loops (A–I, each its own colour), and "Closest match" moves to the best of all of them. When every direction has been tried, the circle turns 10°. On land it's one more round trip of the five per 10 minutes (up to six routing calls); on the water there's no routing call. It replaces "Other directions". The user asked for "a button (or just swiping)"; it's a card at the end of the list, not a swipe, because on land each round costs routing calls.
- **Fixed on the way** (`water.js`): legs routed side by side (a paddle route's, now a loop's) shared one hidden map. A grid's projection followed the map's current view, so the next leg's view could shift a leg's line while its A* ran. Each grid now keeps its own projection, and the legs take turns to draw. Measured on a three-leg Näsijärvi route: side by side gave 66 and 69 m of carrying where one at a time gave 62 and 61; now both give 62 and 61.
- **Waiting for slow sources** (`waterdata.js`): a source that made a leg wait 2.5 s in vain isn't waited for again for 20 s (an answer that has come in meanwhile still counts). Without this, a round trip's twelve legs could each wait for the same slow Overpass. A picked loop's legs that went without a source are routed again (from the cache by then).

**Measured** (headless Chrome, live water data, the final code with the area's data cached):

| Start | Target | Loops (first three, then More) | Time: three · More |
|---|---|---|---|
| Näsijärvi, Mustalahti (Tampere) | 10 km | 10.2, 9.2, 8.9 · 10.1, 9.1, 15.5 km; no carries | 4.1 s · 3.7 s |
| Pyhäjärvi, Pyynikki (Tampere) | 10 km | 9.2, 10.7, 7.0 · 10.1, 10.5, 14.9 km; no carries | 4.5 s · 3.1 s |
| Kaivopuisto (Helsinki archipelago) | 12 km | 12.0, 11.1, 13.9 · 12.3, 11.5, 12.3 km; the shipping lanes noted; 36 m carry at most | 5.3 s · 3.3 s |
| Kokemäenjoki at Pori (a river) | 8 km | 8.1, 9.1, 12.6 · 9.0 km, all out and back; 185 m carry at most | 2.9 s · 9.2 s (one more found) |
| Swim, Hietaniemi (Helsinki) | 2 km | 2.0, 1.8, 2.9 · 1.9, 1.8, 2.4 km; no carries | 3.7 s · 1.5 s |

- **The first run in an area** also fetches its fairways, marks and rocks: 8–18 s in these tests, and 26–28 s before the area's data was fetched once up front.

- **Tests:** `tools/smoke.py loops` uses the recorded Helsinki fairways and a fixed wind. It checks:
  - the river case: the nearest water, and out and back first;
  - the Round trip button for Paddle and Swim;
  - loops near 8 km with little carrying, starting at the water;
  - the cards and More loops (new directions, letters A…);
  - a picked loop becoming water legs that aren't routed again;
  - no routing calls.
  
  `tools/shoot.py` has `*-paddle-loops`, `desk-river-loops` and `*-more-loops`.

## Phase 17 — Weather: clouds, thunder, snow, back in time (planned 2026-10-14)

From the backlog *(user, 2026-10-14)*:
- **New switches** under *Weather on the map*, on the timeline:
  - **clouds** (Open-Meteo low, mid and high cover);
  - **thunder** (FMI's lightning observations; Open-Meteo CAPE and lightning potential);
  - snow moved to phase 15a (the snow-depth fill and FMI's measured depths).
- **The timeline into the past:** the last 2–3 hours of FMI's radar (WMS `time`, kept about two weeks at 5 minutes), playing like the forecast, to see where the rain came from. Past wind and temperature from Open-Meteo's `past_hours`.
- **A check before heavy loads** *(user)*: when a view would cost many calls to a free service, Polku asks first. That happens with a new layer zoomed out over half of Finland, or with history for every grid point.
  - The message: "This view needs about 450 weather calls (Open-Meteo allows 10 000 a day). Load it?" with *Load*, *Not now* and *Always for this layer*.
  - The numbers come from `net.js` (each service's limits and today's use).
  - Cheap views never ask: today's weather map stays under 60 points a view.

## Between 13b and 13c — the route on the map (built 2026-10-14)

*(User, 2026-10-14)*: "when the route editor is closed, it should be possible to activate it by clicking the route"; "LIPAS routes are difficult to click or choose with the finger: it often activates the trail or road behind"; "on mobile, touching the route adds a new point; that is not always what is wanted"; "think the way of editing parts of the route by clicking, right-clicking or touching: what settings should be editable".
- **The planner closed:** a click or tap on your route opens it, with the menu for that part of the route. Hovering it (desktop) says "Your route · click to edit it".
- **A menu for a part of the route** (`planner.openLegMenu`), opened by a tap on the line (touch) or a right-click (desktop), and since #48 by a mouse click too:
  - "Add a point here" first;
  - then the leg's own settings: its sport, how it's routed (Follow / Straight / Water) and its style;
  - "Avoid this spot";
  - "On the profile", which zooms the profile to that leg, and the map follows.
  - 13c adds "Stop here" to it.
- **A click on the line (mouse) still added a via point,** and a drag still reshapes the route: quick for a mouse, and undo is there. A finger got the menu first, since a tap is easily a mistake. Hold-and-drag still reshapes, and the menu's first button adds the point. *Changed in #48, below.*

**One click for the route (built 2026-10-14, #48)**

*(User, 2026-10-14)*: "It is logical that touching the route opens the modal and asks adding a point. But clicking it with left mouse just simply adds more points… Maybe it should happen from the left click instead of right at least if we want to unify the mobile and desktop."
- **A click on the line opens that part's menu,** as a tap does: mouse and finger work the same. "Add a point here" is its first button, so a point is two clicks away, and never added by mistake.
- **A click on a leg's handle** (the ring in its middle) opens the same menu, at the handle.
- **Unchanged:** a drag on the line or a handle reshapes the route (it adds a point where you let go); a click on the map away from the route adds a point; a right-click on the line opens the menu, elsewhere the spot menu.
- **Hover readout** on the line (desktop) ends with "Click for options · drag to reshape", and the planner's hint says "click a point or the line for options".
- **Tests:** `routemenu` in `tools/smoke.py` checks that a click, a handle click and a tap each open the menu and add no point (it fails on the old code); `tools/shoot.py` has `desk-leg-click`, `desk-leg-handle`, `phone-leg-handle` and `desk-leg-hover`.
- **LIPAS routes over trails:**
  - A click there picks the LIPAS route (its card has "The path under it ›").
  - The trail's card has "Part of: … ›" back to the route.
  - Taps search a wider box than the mouse (14 px against 7).

## Phase 18 — Languages (planned 2026-10-14)

*(User, 2026-10-14)*: a language switcher in Settings, with flags: English, Finnish, Swedish. By default, the browser's or phone's language (`navigator.languages`); English otherwise.
- **All text in one place per language** (`js/i18n/en.js`, `fi.js`, `sv.js`), looked up by key. English is the fallback for anything not yet translated.
- **Formats follow the language** (`Intl`): numbers, dates and times, km and m.
- **What doesn't translate:** the map's own labels (OpenFreeMap has `name:fi` / `name:sv` for place names, a style choice) and sources' wording (LIPAS's Finnish names stay).
- **Flags with the language's name beside them,** since a flag is a country, not a language (Swedish in Finland). Remembered on the device; `?lang=` in links.
- **Before the help and tutorial** (phase 19), so those are written once per language.

## Phase 19 — Help and a tutorial (planned 2026-10-14; the last phase)

*(User, 2026-10-14: "we need a tutorial or proper help … as a last thing".)* This comes when the features have settled, so it doesn't go stale:
- **A first-run tour** of a few steps: sport, plan a route by clicking, the profile and Heads-up, layers, weather. It can be skipped and reopened from Settings.
- **Help in place:** a "?" in each planner section and Layers group, opening a short page that explains it, with pictures.
- **A help page** (HTML, in the repo): what each sport does, where the data comes from and how fresh it is, what costs calls, offline areas, sharing, keyboard shortcuts.
- Written for new users, tested on someone who hasn't used Polku.

## Phase 15 — Winter (researched 2026-10-14)

*(User, 2026-10-14)*: "start the winter project now"; "you can also do your own thinking and researching about winter project, the roadmap is just a guide"; "can't snow be drawn on the map as a layer to fill areas?"

The research brief this replaces asked about: sports for a snow group; ski tracks from LIPAS, OSM and municipal grooming status (Jyväskylä first); FMI snow depth; FMI sea ice and SYKE / Copernicus lake ice; effects on paddling and on winter sports crossing ice; the safety wording; the season. All of it is answered below.

### What there is (checked with single requests, 2026-10-14)

| Source | What | Coverage, freshness | Licence | Browser access |
|---|---|---|---|---|
| **LIPAS** WFS | `4402` ski tracks (classic and/or skate, lit km, length, width, rest stops, the operator's web page), `1550` skating routes on natural ice, `3240` winter swimming places, `4421`/`4422` snowmobile routes and trails, `4440` skijoring tracks, `304` ski huts, `4640` ski parks | All of Finland, the facility registry (no grooming status). Jyväskylä: 35 ski-track places in 134 parts | CC BY 4.0 | CORS ok (Polku uses it already) |
| **OSM** (Overpass) | `piste:type=nordic` with `piste:grooming` (classic / skating / classic+skating / scooter), `lit`, `piste:difficulty`; also `skitour`, `hike` (snowshoe), `ice_road=yes`, `mtb:winter`, `winter_service` / `snowplowing` | Jyväskylä: 355 ski-track ways, 97 % with grooming, half with lighting. 90 % share a track, path or footway; **10 % are ski-only ways** (across fields and lakes, often the links between networks) | ODbL | CORS ok |
| **BRouter** | `lookups.dat` knows the piste tags, but its routing data **leaves out ski-only ways**: a test profile on the local BRouter rode 3.7 km of tracks between two Laajavuori tracks, every metre on a way that's also a path or cycleway, and took 7 km for 3.3 km | — | — | — |
| **Helsinki region service map** (`api.hel.fi/servicemap/v2`) | Service 191 ski tracks (232, as lines): `ski_trail_maintenance` (each grooming, timed: 24 000 last winter) and `ski_trail_condition` (good / satisfactory / poor / closed / snowless / littered); skating fields (frozen / ploughed / freezing started / closed), skating routes (9), winter swimming places (45), measured water temperature at beaches | Helsinki, Espoo, Vantaa, Kauniainen, some of Kirkkonummi and its neighbours; live in season | CC BY 4.0 | CORS `*` |
| **Fluent Outdoors** (finlandoutdoors.fi; 45 municipalities listed, Jyväskylä, Kuopio, Oulu, Rovaniemi, Joensuu, Mikkeli…) | Every track with `status` (open / closed) and `maintenance.latest` (last groomed), as GeoJSON | Live in season | **Terms forbid reuse, integration into another service and automated access without written permission** (Fluent Outdoors käyttöehdot, 2022). The data mostly belongs to the municipalities | CORS `*`, but **not to be used** |
| **FMI** open data, `snow_aws` | Measured snow depth, hourly, 107 stations | All of Finland | CC BY 4.0 | CORS `*` |
| **Open-Meteo** `snow_depth`, `snowfall` | Model snow depth and snowfall, hourly forecast | Everywhere; Saariselkä had 2 cm on 14 October | CC BY 4.0, non-commercial free tier | Polku's weather calls already: still one call per location (under 10 variables) |
| **Copernicus Marine** WMTS, FMI's Baltic products | Sea ice **concentration** (1 km) and **thickness** (from SAR, 500 m), daily, from FMI's ice charts | The Baltic, in the ice season | Free and open, with attribution | WMTS without an account, CORS `*` |
| **SYKE** Hydrologiarajapinta (OData) | Lake **ice thickness** at stations (`Jaanpaksuus`, about every 10 days), freeze-up and break-up dates (`JaatJaanlahto`), surface water temperature (`LampoPintavesi`) | Dozens of lakes (46 stations in the first 500 rows of last winter); sparse | CC BY 4.0 (SYKE asks to be told about apps) | CORS `*` |
| Copernicus Lake Ice Extent (250 m, daily) and HR-S&I snow cover (20 m) | Lake ice and snow cover from satellites | Europe | Free | **Needs an account** (CDSE / Cryoland WMS answered 403): not for Polku |
| **Digitraffic** maintenance tracking | Ploughing, salting, sanding with times | State roads, and Kuopio only among municipalities | CC BY 4.0 | CORS ok |

### The user's answers (2026-10-14)
1. "I'm not too familiar with different types of ski activities. You can decide. Let's not make this too complicated at the beginning."
2. On winter as presets or sports: "in Trailmap winter is one of the map layers… Maybe it could be a toggle in settings to allow winter calculation or have own winter settings section in the layer menu. But I feel this should be connected somehow automatically to the time of the year, day and weather the user is browsing the page."
3. "Maybe we should still consider these winter sports like skiing to be something we develop when it's winter. For now we could focus on existing sports and how they work in winter conditions and what type of data we could pull to help planning, let's say cycling in winter."

### The plan

**15a and 15b — Winter conditions for the sports there are (now), in two PRs: the map, then the route**
- **Winter switches itself on** from the date and the time on the timeline, and from the snow and temperature where you're looking: FMI's measured depth near the map's centre, else Open-Meteo's. It's shown as a chip ("Winter: 12 cm of snow"). The override is in Settings and in a **Winter** group in the layers menu: *Auto / On / Off*.
- **Winter layers** (the Winter group, on by themselves in winter):
  - **snow depth as a filled layer** (Open-Meteo on the weather grid, with no extra calls), with FMI's 107 measured depths on top;
  - fresh snow (the last 24 h and the forecast);
  - **ploughed and winter-maintained ways** (`winter_service`, `snowplowing`);
  - winter trail riding (`mtb:winter` 1–3: how soon a path opens after snow);
  - **groomed ski tracks** (LIPAS and OSM, to keep bikes and boots off), and snowmobile routes;
  - sea ice (FMI's charts) and SYKE's lake-ice stations;
  - lit ways where it's dark.
- **Routing in winter** (the route styles stay; winter adjusts them):
  - **Bikes:** prefer ploughed ways and `mtb:winter` trails, keep off groomed ski tracks, and lean to lit ways after dark. Road and gravel prefer winter-maintained roads.
  - **On foot:** ploughed paths; ski tracks only to cross.
  - **Paddle:** a strong warning in the ice season (sea-ice charts, SYKE's freeze-up and break-up dates). Polku never says the water is open.
- **Time in winter:** slower in snow by depth and fresh snow (bikes most, on foot less, little on ploughed ways), from 15a's snow along the route.
- **Heads-up in winter:**
  - snow depth and fresh snow on the way;
  - **slippery:** around 0 °C after rain or thaw, and freezing rain from Open-Meteo's weather codes (Digitraffic's road conditions already show on roads);
  - cold and wind chill (frostbite from about −27 °C felt);
  - darkness with unlit stretches;
  - paths that may not be open in winter (unploughed, `mtb:winter` absent or slow).
- **Summer-only things step back** in winter (beaches, water temperature, wet-ground routing).
- **Ice wording, a rule for every screen:** Polku never says or implies ice is safe.

**What Trailmap does in winter** *(viewed with the user's Plus account, 2026-10-14; nothing changed there, none of its tiles or keys used)*:
- **Winter is a map profile** beside MTB, Gravel, Walking, Other and Own. Each profile has its own layer settings and "Reset profile defaults".
- **The winter map drops** difficulty, trail visibility, surface and width, and draws:
  - **ways by how they open after snow**, using the community tag `mtb:winter`: 1 opens quickly (the sure picks), 2 / `yes` opens clearly slower, 3 opens slowly or not at all (mostly walkers), no tag means not known;
  - **groomed (maintained) trails**;
  - **ploughed cycleways** (`snowplowing` / `winter_service` = yes, and no / limited for not ploughed);
  - **no access in winter** (`bicycle:winter=no`, `foot:winter=no`, `mtb:winter=no`; usually a ski-track base), as a red and white chequer;
  - **ski-track bases** as double lines, coloured by source (OSM or LIPAS);
  - **skating routes**;
  - **winter-only ways** (`seasonal=winter`) at full strength: paths over ice or bog.
- Tag meanings: Trailmap's mapping guide, wiki.trailmap.fi/fi/kartoitus/tagit ("Trailmap MTB Talvikartta").
- **BRouter knows none of these winter tags** (only `lit` and the piste tags), so they can't steer its routing.
- **So Polku's winter:**
  - **BRouter, through route-style parameters:** keep off ski tracks, and prefer lit ways after dark.
  - **Overpass tiles** (as trail details load now) for the winter tags. Polku draws them like Trailmap's winter map, as a **Winter** colour mode for the profile and the route, and as Heads-up ("Opens slowly after snow: 2.4 km", "Not ploughed: 1.2 km", "No cycling in winter (ski track): 300 m", with Avoid).

**15c — Skiing (when it's winter, so there's snow to test on)**
- One **Ski** sport, kept simple: styles Classic / Skate / Any track, Any first.
- Its own router over the area's ski tracks (OSM's, which BRouter misses in part, joined with LIPAS and the Helsinki service map). Grooming age where it's open, links to the operator elsewhere.
- Ski timing, a short walk to the nearest track, and the same ice rules.

**Built (15a: winter on the map), 2026-10-15** (`js/winter.js`, `main.js`, `style.js`, `wxmap.js`, `weather.js`):
- **Winter Auto / On / Off,** in a **Winter** group in the layers panel (open while it's winter). Auto looks at the snow where you are when the map stops moving (again after 8 km): FMI's nearest station within 60 km, else the forecast model at the map centre. Winter comes on from 5 cm and goes off below 2 cm, so it doesn't flicker at the edge. The sport pill shows ❄ while it's winter, with the snow in its tooltip.
- **The snow layer** (the user's ask), on the timeline as **Snow** and in Layers:
  - Open-Meteo's `snow_depth` on the weather grid as a cool wash from 1 cm (to 120 cm), with no extra calls (8 variables a call);
  - FMI's measured depths on top (107 stations, hourly; a grey 0 where there's none);
  - the readout says "12 cm of snow".
- **Winter ways** (OSM, z12 Overpass tiles, a week's cache, zoom 11+), in Trailmap's winter classes:
  - opens quickly / more slowly / slowly after snow (`mtb:winter` 1, 2 / yes, 3);
  - ploughed and not ploughed (`snowplowing`, `winter_service`);
  - no access in winter (red and white: `bicycle:winter` / `foot:winter` / `mtb:winter` = no);
  - OSM's ski tracks as a pink double line;
  - winter-only ways (`seasonal=winter`).

  The summer difficulty colours fade to 30 % meanwhile. Laajavuori (Jyväskylä): 114 ski-track parts, 58 and 69 quick and slower opening, 37 ploughed, 14 not.
- **LIPAS in winter:** ski tracks (`4402`, a magenta double line), skating routes on natural ice (`1550`) and snowmobile routes (`4421`, dashed). Their cards say what they're for instead of "Ride this route" ("A ski track: keep off it on foot and by bike…"), with the operator's website for the grooming status.
- **Sea ice** (Paddle and Swim, in winter): FMI's daily Baltic ice concentration through Copernicus Marine's WMTS. A `seaice://` protocol keys out the open water, so only the ice shows over the sea.
- **Tests:**
  - `tools/smoke.py winter` checks the classes, FMI's WFS answer, Auto's thresholds and On / Off, a recorded Laajavuori tile drawn, LIPAS's ski tracks asked for, the layers going with Off, and the Snow chip.
  - `tools/shoot.py` has `*-winter`, `*-winter-layers` and `*-snow`.

**After #52: Winter as a trail colour (#53)** *(user, 2026-10-15)*: "did you implement a toggle for winter MTB difficulty? I can't see it in the trails & difficulty setting."
- **Trails & difficulty gets a fifth choice, Winter** (Off / Difficulty / Uphill / Both / Winter). It draws the winter ways (Trailmap's classes, from OSM) at any time of year, so you can look before the snow comes. The map key follows it.
- While it's winter with another colour chosen, the group says so: the difficulty colours are faded and the winter ways show over them.
- **Winter colours explained** *(user, 2026-10-15: "it is not enough to add a color coding … and assume that the user understands what eg purple means")*:
  - hovering a trail adds what its winter colour means ("❄ opens quickly after snow");
  - an OSM ski track with no trail under it (over a field or a lake) has a hover and a card of its own ("Ski track · In winter: keep off on foot and by bike · groomed for classic and skating · lit");
  - LIPAS's ski tracks, skating and snowmobile routes say what they're for in the hover, not "click to ride it".
- **Trail cards** say what winter means on a way where the winter ways are drawn ("In winter: Opens quickly after snow"). "Show all OSM tags" lists the winter tags (`mtb:winter`, `snowplowing`, `winter_service`, `bicycle:winter`, `foot:winter`, `seasonal`, the piste tags).
- **Tests:** `smoke.py winter` also picks Winter in the trail colours with winter off.

## Phase 21 — Say what it means (planned 2026-10-15; after 15b)

*(User, 2026-10-15)*: "it is not enough to add a color coding or layer over a route/road/track and assume that the user understands what eg purple means. We have so many different layers and features. The info should be visible in the hover/click modal. Same goes with many other details like if you know that the road is wet/slippery or other information that you calculate but do not show to user. This might be a big update but worth of considering."

**The rule (for every layer and every phase from now on):**
- anything drawn in a colour, a pattern or a symbol says what it is, and what it means for you, in its hover and in its card;
- anything Polku works out and uses (in routing, timing or Heads-up) is shown where it applies, not only used.

**The audit:** one row per layer: hover, card, map key, and what's worked out but hidden. It starts from this list (2026-10-15):

| Layer or finding | Hover / card now | Missing |
|---|---|---|
| Difficulty halo, uphill stripe and arrows | S-grade and uphill % on trails | the arrows' meaning; "not graded yet" (white halo) |
| Trail details (width, visibility, wet, overgrown) | in the hover's bits | the drawn width class ("narrow, under 0.6 m") said as such |
| Gravel and road sports' warm casing (unpaved) | surface, when tagged | "drawn warm: unpaved" in words |
| Winter ways, LIPAS winter routes | explained (#53) | — |
| Snow wash, temperature, wind, rain fields | the timeline's readout under the pointer | a hover on the map itself, at least while the timeline is closed |
| Sea ice | none | the concentration at the spot (Copernicus GetFeatureInfo, JSON) and the chart's date |
| Depth areas, contours, soundings (Traficom) | none | the depth class at the spot, with "not for navigation" |
| Wet ground after rain (`wet: auto`, recentRain) | only in Route style | on trail hovers and cards in wet sports: "about 6 mm of rain in 24 h: roots and boardwalks slippery" |
| Road conditions, incidents, road works, traffic volume | yes | — |
| The route coloured on the map (grade, surface, wind, sport) | the planner's readout while planning | the same with the planner closed |
| The water router's rough water and keep-clear zones | Heads-up only | on the route's hover where it applies |
| LIPAS places, POIs, military areas | yes | — |

The table goes into this phase's PR filled in, with a test that every inspectable layer has a hover text and a card.

## Phase 20 — Map style (planned 2026-10-15)

*(User, 2026-10-14/15)*: "by map styles I mean how roads are drawn and other elements"; "LIPAS routes are in Trailmap categorized behind a few toggles (Cycling, Mountain biking, Hiking, Walking / outdoors)"; and the styles' designer: Tapio Kaasalainen's Mapnik styles, "probably the old styles and not the new but still", based on OSM Bright:
- github.com/TapioKn/MTB-kartta_full (summer) and github.com/TapioKn/MTB-kartta_winter (winter): CartoCSS (`roads.mss`, `paths_and_tracks.mss`, `constructs.mss`, `palette.mss`, `labels.mss`), for Mapnik.
- **Neither repository has a licence** (all rights reserved by default), and Trailmap's licence page names its MTB style "Antti Nissinen & Tapio Kaasalainen" with none either. So they're a **visual guide only**: Polku draws its own rules in MapLibre from the same ideas (Trailmap's tagging guide describes each element). Porting any of their code would need Tapio's permission first.
- **The work:**
  - roads, cycleways by surface, footways, tracks, paths by width and visibility;
  - bridges with railings, tunnels faded;
  - parking by access, shelters, huts, firepits, viewpoints, bunkers;
  - fixme and no-exit marks;
  - LIPAS routes by category (Cycling, Mountain biking, Hiking, Walking / outdoors) as their own switches.

  Compare against Trailmap's views of the same places (as in phase 12a).

**Other countries, for later** (Trailmap's licence page, support.trailmap.fi/info/lisenssit, 2026-10-15). Trailmap uses these national open maps; each needs checking for keys, CORS and terms before Polku could use it:
- **Norway:** Kartverket Topografisk norgeskart (CC BY 4.0).
- **Sweden:** Lantmäteriet Topografisk webbkarta (open data).
- **Denmark:** Klimadatastyrelsen DTK/25 (CC BY 4.0).
- **Spain:** IGN Mapa Topográfico Nacional (CC BY 4.0).
- **Estonia:** Maa- ja Ruumiamet põhikaart and ortofoto (open data).
- **Orienteering maps:** Mapant and Mapant España (CC BY 4.0).
- **Trailmap's own stack** for comparison: GraphHopper and OSRM for routing, Planetiler, Tippecanoe and TileServer GL for tiles, OpenMapTiles, MapLibre.

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
- **The header, in four groups, in the same order at every size** (#37, the user's OK): **Draw** (Follow paths · Straight · Over water) · **Colour** (the route's colours: the profile's "Colour by" and "On map" in one native list, plus "Plain line"; both places stay in step) · **Route** (Sport · Round trip · Style) · **Edit** (Fit · Undo · Redo · ⋯), then Done.
- **The header never spills over** (#34, #37). Labels change with the sport and the style, so `planner.js` `fitHeader()` measures, on width changes and label changes, and picks the first arrangement that fits:
  1. one line, if the breakpoint allows it;
  2. one slim line: only the active mode keeps its label, and the extra tools stay in ⋯ (`.slim`);
  3. two lines (`.two-line`);
  4. Colour and the Route buttons on a line of their own (`.stack`);
  5. compact labels: the colour as its swatch, the sport's icon, the style without "Style:" (`.tight`);
  6. Round trip as its icon (`.tightest`);
  7. the routing modes as icons, so they share a line with the tools (`.tighter`).
  - `python3 tools/smoke.py header` checks nothing sticks out of the sheet at 360, 600, 700, 760 and 1300 px (bottom dock), with the longest sport name (Road cycling) and the Technical style.
- **The planner opens at the bottom by default** for everyone new (`plannerDock` defaults to `bottom`; the side panel is a choice in ⋯ and Settings).
- **The always-visible summary** is distance · time · ascent and descent together (↑42 ↓62 m); the stats row under it has the rest (hardest climb, speed, style; for paddling the wind and carry figures). On phones the stats are three even columns.
- **Bottom sheet sizes:** peek (the summary) · **profile** (the summary plus the elevation chart and its colours; the stats fold away; height measured from the content, at most 45 % of the screen) · half · full. Drag snaps to the nearest; a tap on the handle toggles between peek and your last size; arrow keys step through them. `tools/smoke.py` checks the profile size shows the whole chart.

## How to work on this (for any session)

- **Branches:** one per phase, from `main` after the previous phase is merged. If it isn't merged yet, branch from it and say so in the PR.
- **Bugs, ideas and things to watch** go into [BACKLOG.md](BACKLOG.md) as they come up (the user's ask, 2026-10-14). An item moves here when it becomes work, and is ticked off there.
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
