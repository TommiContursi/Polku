# Polku

Polku is an outdoor map and route planner for Finland. These are the words for what people plan and read in it: use them on the screen, in the docs and in issues.

## Language

### The route

**Route**:
The line you draw on the map: its waypoints and the legs between them.
_Avoid_: course, track (a track is a recorded line in a file)

**Waypoint**:
A numbered place on the route. At each one you pass by, stop or spend the night.
_Avoid_: point, via

**Place**:
Anything on the map you can find or tap: a search result, a LIPAS site, a lean-to. Added to the route, it becomes a waypoint.
_Avoid_: POI

**Spot**:
A point on the map that isn't a place or your route: where you held the map, or tapped it while browsing. Its card is "This spot".
_Avoid_: location, pin (a pin is the mark a card puts on the map)

**Leg**:
The way from one waypoint to the next, in one sport and one drawing mode.
_Avoid_: segment

**Stretch**:
The way from one waypoint where something happens (the start, a stop, a changeover, a night, the end) to the next. The waypoints you only pass by fold under it.

**Part**:
One sport's run of the trip, ending where the sport changes, at a night or at the end. A stop is a wait inside its part.
_Avoid_: section, segment

**Stop**:
A wait at a waypoint, inside its part.
_Avoid_: break

**Changeover**:
The waypoint where the sport changes, with the time it takes to change over.

**Night**:
A night spent at a waypoint. The morning after starts the next day's part.

### How you go

**Sport**:
How you travel a leg: MTB, hike or sea kayak, for example.
_Avoid_: mode, activity

**The map's sport**:
The sport the map shows its layers for, chosen beside the search.

**Drawing mode**:
How a leg follows the map: Follow paths, Freehand or Over water.
_Avoid_: routing mode

**Alternative routes**:
Up to two other ways for a leg, drawn on the map to pick from.
_Avoid_: Other ways (its old name, until the rename's PR)

**Route style**:
How the router weighs the ways for the whole route: Balanced or Flowy trails, for example.

**Toolbar**:
The bar for drawing: Done or Edit, the drawing mode, undo and redo, the route's tools and More.
_Avoid_: toolbox

### The trip

**Trip**:
The route with a departure, so it has times, days, the weather and the dark.
_Avoid_: journey, tour

**Departure**:
When you leave. The controls say Leave now and Leave at….
_Avoid_: start time (the start is the first waypoint)

**Arrival**:
When you're there. Arrive by… sets it, and Polku works out the departure.

**Best time to leave**:
The departures the weather along the route favours.
_Avoid_: When to go

### Reading the trip

**Check**:
Polku's look over the trip: its warnings and what's good to know.

**Warning**:
Something on the trip to act on before you go or on the way.
_Avoid_: heads-up, alert

**Good to know**:
Something on the trip to keep in mind.
_Avoid_: Worth a look

**Profile**:
The route's height along its length.
_Avoid_: hill chart, elevation graph

**On the route**:
What the route is made of: its gradient, surface, way type and width, for example.

**Colour by**:
The choice of what colours the route and the profile.

**Card**:
What opens for one thing on the map (a waypoint, a leg, a place, a way, a spot, a warning), one at a time, with ‹ Back to the one before. A tap opens it, and a hold the same card.
_Avoid_: popup, panel, sheet (the sheet is what a card sits in on a phone)

**Hold**:
Touching the map and keeping the finger still for half a second; on a desktop, a right click. A shortcut to the card a tap opens, never the only way to anything, so the screen doesn't need to name it.
_Avoid_: long press, long tap

**Readout**:
The few words a desktop's pointer shows on the route or a way before a click: where it is, its height and grade, the way and its surface.
_Avoid_: tooltip (a tooltip names a button), hover card

**Size**:
How far the planner is raised on a phone: the line, the peek, half or full.
_Avoid_: stop (a stop is a wait at a waypoint), fold level

**Weather card**:
The trip's weather: where you'll be, at the time you're there.
_Avoid_: weather window

**Weather timeline**:
The map's weather hour by hour, not tied to the route.

**Weather line**:
The weather card folded to one line: the map's weather at its hour, and the strip that sets the hour. In the sheet's place on a phone, at the toolbar's end on a desktop.
_Avoid_: weather bar, weather toolbar
