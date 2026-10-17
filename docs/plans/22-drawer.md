# Phase 22: the drawer

The design. What's still to do, and its status, is on GitHub: [Phase 22b: the panel on desktop moves](https://github.com/TommiContursi/Polku/milestone/3) · [Phase 22c: cards to pull out](https://github.com/TommiContursi/Polku/milestone/10), phase issues #179, #186. The order of phases is in [ROADMAP](../ROADMAP.md).

Moved here verbatim from docs/ROADMAP.md on 2026-10-16 ([the last full ROADMAP](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/ROADMAP.md)). 22a is built (#60, #61); its design and what was built stay here, as the ground 22b and 22c build on.

## Phase 22 — The drawer (planned 2026-10-15)

Testing 15b showed the planner (the drawer) has outgrown its layout:
- **One long scroll:** drawing, checking and setting off all mean scrolling back and forth.
- **Handy tools buried in the ⋯ menu:** Round trip, Reverse, Back to start, distance marks and times. A new user won't look there.
- **Time & speed opens with the speed inputs,** far down the list. The time is what you want early; the speeds are a setting like the route style.
- **The leg you edit isn't marked on the map:** a leg opened in the waypoint list doesn't show which part of the line it is.
- **"Move to the left" is a yes/no dock,** where a panel you can move, resize and snap would suit a desktop better.

**Mock-up:** a design canvas of the drawer at 1440 and 390 px, with Route, Check and Go, the phone's peek, and the later ideas (22b, 22c, 23b). Its tabs link to each other in Play. It's a private canvas: https://claude.ai/artifact/VRcRprH6FnJQ8RTMGQk9By

**What it's for, moment by moment:**

| Moment | What you need | Where |
|---|---|---|
| An idea | a round trip from here, a LIPAS route, a place found in search | The start: the empty drawer's choices, and the first click's popup |
| Drawing | points and legs, the sport and routing per leg, the style, undo | Route |
| Checking | what's on the way, the climbs, the ground, the profile's colours | Check |
| Setting off | when, how long, the weather, stops, taking it along | Go |
| On the way | what's left, what's next, where you are | On the way (23b) |
| Afterwards | the track you rode | 23c |

**22a: three tabs (next).**
- **The start (no route yet):** Round trip is a first choice, not only a tool for a route you already have.
  - **The empty drawer** offers four choices:
    - Draw it;
    - **Round trip**, from where I am or a start picked on the map;
    - Ride a marked route (LIPAS);
    - Import a GPX or KML.

    How you go sits under them, to set before drawing.
  - **The first click on the map** sets the start right away, so drawing stays one click a point. Its popup offers a loop from there: a length or a time, then three loops.
- **Always on top:**
  - the summary (distance, time and arrival, ascent and descent) and Done;
  - **the profile, one, not two.** It's coloured as you choose (Gradient, Surface, Wind…, its chooser on it), with the legs and their points marked. It lights the open leg, marks the heads-up places, and later shows where you are. It's about 64 px, and ⤢ makes it taller; the separate profile chart goes;
  - the tabs, with undo, redo and ⋯ on the same row.
- **Route:**
  - the routing modes;
  - the waypoints and legs. **The leg you open, or point at, lights up on the map** (a glow, the rest faded) **and in the profile**;
  - Round trip, Reverse, Back to start and Import as buttons (Round trip stays here too, for a route you have);
  - **How you go:** the route style (which ways the router prefers) and your speed (how the time is counted), Easy / Normal / Fast / Custom, with the custom fields here. The speed inputs leave Time & speed.
- **Check:**
  - Heads-up (with its ⋯ and the hidden kinds);
  - the profile's colours in kilometres ("Gradient on this route": the breakdown bar and its key);
  - the climbs;
  - **On the map:** route colours, distance marks, times at the marks (out of ⋯).
- **Go:**
  - **the time first:** total, depart and arrive, and where it goes (by surface, uphill, the wind and snow, stops), with "your speed: Custom · change" leading to Route;
  - departure and the weather on the route;
  - stops and days;
  - Take it along: GPX, share link, save offline;
  - later, Start (23b).
- **⋯** keeps only Clear and the panel's place.
- **The phone's peek** is the summary, the short profile and the tabs. A tab opens the sheet at that tab, and the sheet's sizes stay as they are.
- **What stays:** a jump to a section (the Weather button, a summary link, a heads-up's place) opens its tab and lights the section up; share links and saved routes are unchanged.
- **Tests:**
  - tabs and jumps;
  - the header fitting at 360, 390 and 1440 px;
  - the leg highlight on the map;
  - every section reachable;
  - before and after shots of each tab.

**Built (22a), 2026-10-15.** One rule held it together: nothing the drawer had goes missing, and every part only moves. The header stays exactly as it was, since it's what you use while drawing on a phone (the routing modes, undo, Round trip) and it's what peek shows. The mock-up's slimmer header would have cost a tap per mode change. Below it, the profile, then the tabs.

| Part | Was | Now |
|---|---|---|
| Summary (distance, time from your departure, ascent and descent or carries), fold, Done, the sheet's handle and sizes, the side panel's width | header, edges | unchanged |
| Routing modes, the route's colours, the sport, Round trip, Style; show all, undo, redo, ⋯ (and the wide bar's extra tools) | header | unchanged |
| The profile: hover readout, drag to zoom, Whole route, the points on it, a climb's or heads-up's stretch, conditions for paddling | Profile section | **under the header, in sight at the profile size, half (short) and full**, with its colour choice and On map. A size button, kept. |
| The colours in kilometres | under the profile | Check, "Gradient on the route" (named by the colour shown) |
| At a glance: hardest climb (or headwind, high point), speed, style | top of the list | Check, at the top |
| Round trip: start, length, direction, the loops, More loops | its section | Route |
| Waypoints: names, drag to reorder, stops and nights, departure, changeovers, a leg's settings, up and down, remove; Reverse, All leg settings | its section | Route, as it was. Round trip, Back to start and Import are now beside Reverse. |
| Heads-up (Avoid, ⋯ to hide or correct OSM), climbs | their sections | Check |
| Departure and weather: the docked timeline, the weather on the route, the days | its section | Go |
| Route style: presets, its controls, wet ground, a leg's own | its section | Route, **How you go** |
| Your speeds (Easy / Normal / Fast / Custom, per sport, the craft) | Time & speed | Route, **How you go**, under the style |
| Where the time goes (by surface, uphill, the wind and snow, by sport, stops and nights) | Time & speed | Go, **Time**, opening with the total and the arrival. "Counted at your speed … change it" leads to How you go. |
| Distance marks, times at the marks | ⋯ | Check, **On the map** |
| Export GPX, Copy share link, Save offline | ⋯ | Go, **Take it along** |
| Reverse, Back to start | ⋯ | Route, under the list |
| Import GPX / KML; Clear route; the panel's place | ⋯ | still ⋯ (Import in Route too) |
| Each section's open or closed state | remembered | remembered |

New in 22a:
- **The tabs:** Route, Check (with the heads-up count) and Go (with the arrival time). The tab is remembered, and the arrow keys move between tabs. A jump to a section (the Weather button, the summary's time, Speed, Style, a link in the menus) opens its tab and lights the section up. A tap on a tab opens a folded sheet.
- **The start:** with no route, Route offers four choices:
  - Draw it;
  - Round trip, from where I am or a start on the map;
  - Ride a marked route;
  - Import.
- **The first click:** it sets the start, and a small card offers a loop from there in three lengths. The next click goes on drawing as before.
- **The lit leg:** pointing at a waypoint, a folded leg or a leg's settings lights that leg on the map (a soft glow) and in the profile. An open leg stays lit, which is how it works on a phone.
- **Tests:** `tools/smoke.py drawer` (at 1440 and 390 px) checks:
  - the header's controls;
  - every section in its tab, and each jump opening it;
  - the profile at the sheet's sizes and its size button;
  - the Route tools, How you go, ⋯, the stats, the marks' switches, Time and Take it along;
  - the start's choices, the first click's offer and the click after it;
  - the lit leg;
  - the arrow keys and the remembered tab.

**After 22a (#61, 2026-10-15), from testing it:**
- **The side panel is the default on desktop.** With the tabs it suits the map best: the map stays wide, and the tabs have the height. The bottom panel is one button away, at the end of the tabs' row, and in ⋯ and Settings as before. Dragging it comes in 22b.
- **Export GPX, Copy share link and Save offline are back in ⋯,** as well as in Go: they're wanted from any tab.
- **The route's points on the profile.** The numbered round marks on the profile were the climbs, and they looked like the waypoints, so on a round route they seemed to be in the wrong places. The profile now draws the route's own points as on the map: the start green, the vias numbered, the finish a dark square, with a faint line. The climbs became tags ("↑1") in their colour.
- **Fixed on the way:** switching tabs no longer sends the page a resize (it closed a menu opened just then). A key sent to the page itself no longer trips the keyboard shortcuts.

**22b: the panel on desktop moves.**
- Drag its header to dock it left, right or at the bottom; drop zones show while dragging.
- Resize it from its edge (the width is already yours on the side).
- Fold it to a pill.
- This replaces "Move to the left", and the map's controls make room on whichever side it's on.

**22c: cards to pull out (maybe).** A section's pop-out turns the profile or the time into a small card on the map. It snaps to the map's corners, stays while the panel is folded, and goes back with a click. Desktop only. Built only if 22a and 22b leave a need for it.

### From phase 24's review (2026-10-17), for 22b

The report is [docs/reviews/2026-10-17-design/](../reviews/2026-10-17-design/README.md); the desktop frame of [the planner's mock-up](mockups/phase-24-planner.html) shows it.
- **One way to close the planner on a desktop.** Today there are three: Plan in the search bar, the panel's Done, and Done by the map. The panel's Done stays; Plan in the search bar and by the map hide while planning, as Plan already does on phones. If the panel moves (left, right, bottom), its Done moves with it.
- **Show the whole route** joins the map's buttons (under zoom and 3D, #226) while part of the route is out of view, wherever the panel docks. The calmer planner (#233) does the same on phones.
- **The drawing tools float as a toolbox on a desktop too** (chosen on 2026-10-17 for the calmer planner, #233): the routing mode with its route style, undo and redo, at the map's top left beside the panel and below the top bar, clear of the map's buttons and 3D on the right and of the timeline at the bottom. When the panel docks right or at the bottom, the toolbox keeps to the panel's inner edge at the top of the map, and it moves with the panel while it's dragged.
