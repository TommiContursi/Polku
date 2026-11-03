# Komoot's route planner as a reference (2026-11-04)

What Komoot's web planner does well, pattern by pattern, with what Polku has today and what's worth taking. Written from using komoot.com/plan on 2026-11-04 (a Tampere MTB route, logged in) and the user's screenshots. It's a reference for the planner's content work (#660), not a plan: nothing here is decided, and Polku copies nothing it doesn't need. Komoot's screens aren't reproduced; the patterns are described.

## The first screen

| Komoot | Polku today | Worth taking |
|---|---|---|
| **One panel, one column:** Your Route, the route's images, Waypoints, Search place and Round trip, the alert line, Suggestions, Surfaces, Way types, Details (average speed, highest and lowest point). Nothing about time or weather. | The Route, Check and Go tabs; the profile and the numbers above them; time, weather and Take it along in Go. | The split: the panel is about the route and its waypoints; time and weather live on the chart. |
| **The bottom bar:** distance, time, gain, loss, Difficulty as a tag with a tooltip, speed as an editable value ("Moderate: 11.0 km/h ✎"), a sparkline of the profile, and Elevation ▾. | The numbers row with "from now" as a dotted link; Hardest climb under it; the profile at half. | Speed as a value you tap, in the numbers row; the sparkline as the profile's compact form (#742). |
| **The alert line:** "1 alert for this route · See details", one line in the panel; See details replaces the panel's content with the list, Back at the top. | Check's row above the numbers at the peek, which moves them when it arrives; Check's tab with three groups. | A count where you plan, the list one step away (#741, rethought). |

## Waypoints

| Komoot | Polku today | Worth taking |
|---|---|---|
| **Rows A and B** with the place's name, Add Waypoint as an empty row, a reorder button, the sport in the heading row. | The route's list: Start, each stretch, the end, with names and facts; Reorder. | The empty "Add" row as the way to add by search; the sport in the list's heading (Polku has it). |
| **Suggestions under the rows:** Home, Current location, Saved places. The next waypoint is found without leaving the panel. | Search in the top bar; Your location in the map's column; saved routes in Settings. | Current location and saved places as suggestions when adding a point, from the list. |
| **Round trip as a switch** beside Search place, not a separate way to begin. | Round trip as one of the four Ways to begin, and Round trip from the start in ⋯. | Nothing: Polku's start is the stronger design and the user keeps it. A switch could fit a route's list later. |
| **The URL carries the waypoints** (`p[0][name]`, `p[0][loc]`) before the route is saved. | Share links carry the route; the hash carries the view. | Nothing new; Polku's share link does this. |

## Route type and avoids

| Komoot | Polku today | Worth taking |
|---|---|---|
| **Route type** as six radios in a popover from the panel's sliders button: Best, Shortest, Quiet, Technical, Scenic, Less elevation; **Avoid** as four checkboxes: Ferries, Steps, Steep hills, Rough terrain. One popover, one place. | Route style (Balanced…) on the toolbar's mode button and in How you go, with the speeds; Avoid as a spot on the map and in Check. | One place for the route's settings, opened from the list's heading, so Route doesn't repeat them (#660's "settings' home"). |

## The map and its popups

| Komoot | Polku today | Worth taking |
|---|---|---|
| **A click on the map** opens a small popup at the spot: coordinates, then After (distance, time, climb from the start), Elevation, Incline, Surface, Way type, and one button, Add to route. On a route it's the same popup. There's no edit mode: the popup is the guard against accidental points. | A tap adds a point while editing; the line at the spot then the card while browsing; Edit and Done (#745). | The popup as the preview before the card: five facts and one action, the same for a spot and for the route. |
| **The popup changes with what's clicked, but keeps its shape.** An empty spot before a route: coordinates with a copy button, then two buttons, Set as new start (A) and Set as destination (B). A waypoint: its title (Starting Point), Customize ✎ to rename it, the coordinates, the five facts, then Round trip and Remove waypoint, with a bookmark, ⋯ and ✕ in its header. Each is one small card at the spot, every action in sight, nothing to scroll. | A point's card by tap with the facts, its actions on a hold or right click: Leave, Move, Rename, Remove, Round trip from here, Sport from here, Next stretch. | The same card shape for a spot and a point; Rename as a pencil by the title; the actions in sight without scrolling (the audit's point 2, #749). |
| **Round trip lives on the start's popup,** not on the toolbar: it replaces the route from the point you're looking at, so it sits where that point is. | Round trip from the start in ⋯; Round trip from here on a point's hold card. | Round trip from here as a point's action only, as it already is on the card; never on the toolbar (the user's decision, 2026-11-03). |
| **Street View** as one button on the popup, and the off-grid switch as the only setting there. | Nothing like Street View; Straight line as a mode of the next leg. | Nothing to take; noted for completeness. |
| **The toolbar** above the map: undo, redo, crop, select an area, avoid an area, hide, Map content ▾, Preferences ▾; Save route apart at the right. | The toolbar with the modes, the sport, Route style, undo, redo, the route's actions, ⋯. | Save apart from the drawing tools; the drawing tools few. |
| **Hover on the route** draws nothing; the chart does the explaining. | The hover readout on the route with distance, height, grade, surface and the wind, and the profile's marker. | Nothing: Polku's hover is better. |

## The chart

| Komoot | Polku today | Worth taking |
|---|---|---|
| **One chart, recoloured** by its menu: Elevation, Surfaces & Way types, Temperature, Precipitation, Wind, Sun & UV (the weather ones paid). | Colour by on the profile: gradient, surface, way type, difficulty, lit, wind, temperature, rain; Check's On the route breakdowns as bars; Go's wind bars and hour chips. | The bars and chips folded into the chart's legend: one chart, the lengths under it. |
| **Hover on the chart** gives After, Elevation, Incline, Surface and Way type at that point, and the map marks the spot. | The hover on the profile with the marker on the map, synced. | Nothing new; the tooltip's five facts as the stretch card's first line. |
| **Surfaces** as one bar (Paved 51 %, Unpaved 49 %, Unknown 1 %) with Show on route and Show details; **Way types** as one bar with the lengths listed. | Eleven breakdowns in Check › On the route, each with Use colours. | Two bars at most in the panel; the rest in the chart. |

## Why it feels smooth: the rules under the patterns

The tables say what; this says why, so the lessons carry over without copying the screens.

1. **The waypoints are the route.** Everything else is derived from them: the line, the numbers, the chart, the alert. There is no editing mode, because there is nothing to protect: a click asks what you mean (a popup with two actions), and undo covers the rest. Polku's Edit and Done exist because a bare tap draws; the popup is the other way to make a tap safe.
2. **Four surfaces, each with a fixed size and one job.** The panel (the route and its totals, scrolling), the bar (the numbers, never moving), the chart (everything along the route, expands by a chevron and the bar stays), the popup (one spot, five facts, one or two actions). Settings open in popovers and close. Nothing resizes under the pointer, and nothing about weather or time appears where the route is edited. Polku has the same four surfaces (the sheet, the numbers row, the profile, the cards) with the jobs mixed: the sheet holds the numbers, the chart and the settings, the cards hold facts and actions behind a hold, and Go holds what the chart should.
3. **Totals in the panel, distribution on the chart.** Surfaces are one bar with three percentages; way types one bar with lengths; the chart shows where each is. Polku shows the distribution eleven times as bars and once on the chart.
4. **A new state replaces the panel's content instead of adding to it.** Alerts, search, a waypoint's details each take the panel over with Back at the top; the map and the bar don't change. Polku opens cards over the sheet and tabs inside it, so two or three things show at once.
5. **One shape for every popup.** A spot, a waypoint, a highlight: the same card, the same order (title, coordinates, facts, actions), the same place. Learned once.
6. **Labels, not instructions.** "1 alert for this route · See details", "Set as new start", "Add to route". A question mark only where a term needs it (Technical, Rough terrain, Difficulty). No line tells you how to tap.
7. **Defaults you can read.** "Best (default)" is selected; the speed says "Moderate: 11.0 km/h ✎"; the difficulty is a tag. A setting shows its value where it applies, and the control is the value.
8. **The destructive action sits on the thing it destroys.** Round trip is on the start's popup; Remove on the waypoint's. The toolbar holds undo, redo and tools that act on the map, and Save apart.

**Not tested:** Komoot's phone app (only the web planner at the browser pane's width), dragging the route line to insert a waypoint, keyboard use, screen readers, a route with many waypoints, and the paid weather colourings. The benchmark is one MTB route in Tampere on 2026-11-04, about twenty minutes, plus the user's screenshots from Jyväskylä.

## What Polku has that Komoot doesn't

Keep these in sight; they're the reason to plan in Polku.

- The weather at the hour you're there, along the route, free.
- Darkness along the route from the departure, and the lit ways near it.
- Water routes, carries and the water's data; mixed sports on one route.
- Check's Finnish sources and what wasn't checked, said.
- No account, nothing sent that isn't needed, offline.

## Not to take

- An account, saved places on a server, Home as an address: Polku stays local first.
- The route's images: no backend.
- Paid weather on the chart: Polku's is free, and that's the point.
- A tutorial popover on every new control ("Got it").
