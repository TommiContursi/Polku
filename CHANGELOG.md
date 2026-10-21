# Changelog

What's new in [Polku](https://polku.si), from the latest updates back to the first release. These notes describe features available in the app, not work still in progress. For upcoming changes, see the [issues](https://github.com/TommiContursi/Polku/issues) and [roadmap](docs/ROADMAP.md).

## 2026-10-21

### A calmer planner: the sport, and what it changes ([#233](https://github.com/TommiContursi/Polku/issues/233))

The map's sport, each leg's sport and the sport of the legs you draw next are now kept apart, and changing one no longer quietly changes the others.

- From your first point, the drawing button names the sport of the next leg and its route style under the drawing mode, for example "Hike · Balanced". Where there's no room, the style is shortened and the sport stays whole.
- The drawing menu has the sport between the drawing modes and the route style. Pick a sport there for the legs you draw next: what you've drawn stays as it is, the map switches to that sport, and **Paddle** and **Swim** draw **Over water**. Under it is your speed in that sport, and **Change** opens your speeds right there; a change re-times your route. On a desktop the sport is a button on the toolbar, just before the route style.
- With a route drawn, picking another sport from the button beside the search asks what it's for. **The whole route** plans your route's legs again in the new sport, says how many routing calls that takes, and **Undo** brings back the route, its styles and the map's sport. **Only the legs you draw next** leaves the route as it is, and **Keep** changes nothing. A route on land can't be turned into a water route this way, and the menu says why. Each sport in the menu has a line on what the map shows for it, and the sports in your route are marked **your route**.
- Changing the map's sport no longer changes how your route is routed: the route keeps its own route style for each of its sports, after a reload and in a share link too ([#71](https://github.com/TommiContursi/Polku/issues/71)). Busy roads and road conditions are checked by each leg's own sport, and wherever the map is.
- A point you put on open water while drawing on land asks how you get there: **Paddle**, **Swim** or **Stay on land**, and in winter also over the ice (**Walk on the ice**, or ride or run). Paddle and Swim take the leg to the point over the water, keep the point where you tapped it and carry on in that sport. Over the ice the leg is a straight line, and Check says that **Polku can't see whether the ice holds**. Taps on a bridge, a ferry line or by the shore don't ask.
- **Draw it** says that you can change sport along the way, and **Go › Time** says which speeds the time is based on, with **Change**.
- At the start of a route, the sport has a row of its own under **Start a route**, saying what the map shows for it, so you see it before your first point. In each step it's a chip beside the route style it decides. **✕** at the top right closes the planner, as the other panels' ✕ does, and replaces **Close**. On a desktop, the button that moves the planner is beside it there too.
- The round trip's form is shorter: **Make 3 loops** says what it costs in routing calls, and the line under **Where I am** says what it sends.
- With Paddle, the sport menus (the button beside the search and the one at the start of a route) also have your craft: **Sea kayak**, **Canoe** or **SUP**. Polku keeps a canoe or a SUP to calmer water than a sea kayak, so it matters for a round trip on the water too.
- **Settings** no longer has a sport of its own: the sport is on the button beside the search. Settings lists your speeds for every sport, one line each, and a tap opens them. A change re-times your route when it has legs in that sport ([#87](https://github.com/TommiContursi/Polku/issues/87)).
- On a desktop 1440 px wide, **Save offline** and **Clear route** are now in **More**, to make room for the sport.

## 2026-10-20

### A round trip keeps only undo and redo in the toolbox ([#311](https://github.com/TommiContursi/Polku/issues/311))

While a round trip is open, the toolbox has only undo and redo: a tap on the map then picks a loop or moves its start, and draws nothing. The drawing mode, **More** and, on a desktop, **Done** come back once you take a loop or close the round trip. On a phone, the bottom of the round trip's form, with **Make 3 loops**, is no longer cut off by a few pixels.

### The ways to begin say Close

On a phone, the button beside **Start a route** now says **Close**: it puts the planner away, since nothing is done yet. After the first point it says **Done**, as before.

### A calmer planner: starting a route ([#233](https://github.com/TommiContursi/Polku/issues/233))

With no route yet, the planner offers four ways to begin, each with a line on what it does: **Draw it**, **Round trip**, **Marked routes** and **A file**. They're two by two on a phone and a row each on a desktop, and a tap or click on the map still starts drawing at once.

- The sport is at the top, in **Start a route · MTB ▾**. It opens the same sports as the button beside the search, and the two always match. The sport decides the route styles, the round trip's lengths and whether there are marked routes: Swim has none in LIPAS, so it has three ways.
- Each way has **‹ Ways to begin** at its top left, which brings the four back as they were, and the sport at its right. On a phone the back gesture does the same. Once you've taken a loop or a marked route there's a route, and **Undo** takes it back.
- **Draw it** says what to do and how Polku joins your points in the drawing mode you've chosen, and lets you pick the route style before the first leg. On a phone that's one row that opens the styles, and **Fine-tune** opens How you go's controls in place. A style picked before there's a route routes nothing. Straight lines don't use a route style, and it says so.
- After the first point, the planner says to tap the map for the next point and offers **Round trip from here** with three lengths and **Other…**. The card that used to open by the start and cover the map is gone, so four points take four taps ([#232](https://github.com/TommiContursi/Polku/issues/232)).
- The round trip is in the planner's peek: distance or time, the sport's lengths, **−** and **+** (5 km for bikes, 1 km on foot or on the water, 15 minutes by time) or a length you type, the direction, the route style and **Make 3 loops**. Picking a length makes no routing calls; Make 3 loops does. While the loops are made, the map waits: a tap on it adds no point and doesn't move the start ([#109](https://github.com/TommiContursi/Polku/issues/109)).
- The loops are cards side by side, the next one peeking in, and a list on a desktop. A tap on a card or on a loop's line on the map picks it and the map frames it; the picked one has **Use loop A**, and a note offers **Undo** ([#89](https://github.com/TommiContursi/Polku/issues/89)).
- From the ways to begin, a round trip starts where you tap the map, or at **Where I am**. It says that it sends your position to the router as the start, rounded to about a metre ([#281](https://github.com/TommiContursi/Polku/issues/281)).
- **Marked routes** lists LIPAS's routes for your sport in the map's view as cards, and the picked one's line glows on the map. A tap on a card or on a route's line picks it, and **Follow this route** makes it your route on its own line, with no routing. It lists them even with them off in **Layers**, and says so with **Show them**. If LIPAS isn't answering it says that, with **Retry**, and with none in view it suggests zooming out or **Find by name**.
- A marked route is followed, whatever the sport: the cards, a route's card on the map and its tip say **Follow this route**, not Ride ([#306](https://github.com/TommiContursi/Polku/issues/306)).
- The toolbox grows with the route. Before the first point it isn't there, apart from undo and redo when there's something to undo. The first point brings the drawing mode, undo, redo and **More**, and the first leg brings the route's actions, as far as there's room. New buttons fade in where they are, and the map's buttons don't move. **Back to start** isn't offered on a round trip, and on a desktop there's no **Done** before the first point.

### A calmer planner: the toolbox ([#233](https://github.com/TommiContursi/Polku/issues/233))

The planner's header now shows just your route: its distance, time and climb, with **Done** at their right on a phone. The drawing tools have a toolbox of their own, and the whole route's actions are on it where there's room, or in **More**.

- On a phone, the toolbox floats above the planner, beside the map's buttons. On a narrow phone, with large text or with the planner pulled up, it's the planner's first row instead. It holds the drawing mode, undo, redo and **More** (⋯).
- The drawing mode is one button, with the route style under its name. Tap it to draw the next legs with **Follow paths**, **Straight line** or **Over water**, or to pick a route style for the whole route. A leg you've drawn keeps its mode: select it on the map to change it. A leg with a style of its own keeps that style too.
- On a desktop, the toolbox is a toolbar on the planner's edge, with the three modes by name, the route style, undo and redo, **Show the whole route** and **Done**. Point at a button, or reach it with the keyboard, to see its name, its key and what it does. **P**, **S** and **W** pick the mode.
- **Reverse**, **Back to start**, **Share link**, **Export GPX**, **Save offline** and **Clear route** are on the toolbar or toolbox as far as the screen has room, and **More** has the rest, with a round trip from the start and importing a file. Nothing is in both places. After Clear route, a note offers **Undo**.
- On a desktop, the button that moves the planner between the left and the bottom is now in its header, next to the one that folds it.
- **Show the whole route** sits under **Locate** with the map's buttons whenever a route is on the map. On a desktop it's on the toolbar while you plan.
- While you plan, **Weather** and **T** open the weather timeline over the map, and the planner stays on its tab. On a phone the timeline sits just above the planner, with the toolbox and the map's buttons above it, and where there's no room for them above it (the planner pulled up, or a short phone), it sits on the planner under its numbers and **Done**; its ✕ or **Weather** closes it. Go still has the departure and the weather along the route ([#225](https://github.com/TommiContursi/Polku/issues/225)).
- The route's colours are now chosen only under the profile, in **Colour by** and **On map**. The sport is chosen with the sport button beside the search. **Round trip** is in More, in the Route tab's tools and at the start.
- On short phones with the planner pulled up, the map's buttons leave out the compass while north is up, then **3D**, so the others still fit. 3D is still in **Layers**.
- **Straight line** and **Over water** have new icons: a plain line, and waves under a dashed line.
- Undo and redo are greyed out until there's something to undo or redo, from the moment the planner opens ([#241](https://github.com/TommiContursi/Polku/issues/241)). A long route's numbers no longer run together on a narrow phone or with large text: they wrap onto lines of their own ([#242](https://github.com/TommiContursi/Polku/issues/242)). A tap on a control in the planner's header no longer folds the planner on a phone ([#251](https://github.com/TommiContursi/Polku/issues/251)).

### Rain radar ready for FMI's new feed ([#133](https://github.com/TommiContursi/Polku/issues/133))

Rain “now” in Finland uses FMI's replacement radar data, keeping light drizzle in proportion when the old feed is retired. Missing radar coverage stays distinct from dry weather. The backup radar remains available if the rain-rate layer cannot load. Both feeds use a fixed scale, so changing the map view does not change what the rain measurements mean.

### Fewer weather requests while zooming out ([#298](https://github.com/TommiContursi/Polku/issues/298))

The weather forecast waits for you to finish zooming out even while its first view is still loading. Forecasts already loaded or on the way count correctly towards the request budget, so they do not cause unnecessary coarser views or pauses. Forecast detail stays the same.

### Fixed: the map's buttons stay put while the map loads on a phone ([#292](https://github.com/TommiContursi/Polku/issues/292))

On a phone with the timeline left open, the map's buttons (compass, **Locate**, **3D**, **Weather**, **Layers**) used to show near the bottom of the screen, then jump up above the timeline a few seconds later, once the map had loaded. A tap meant for one of them could land on the map or on another button. The timeline and any weather layers you left on now open as Polku starts, and the buttons appear once they're in their place above it. When the forecast comes in, the timeline can still grow by a few pixels.

## 2026-10-18

### 3D terrain from a button on the map ([#226](https://github.com/TommiContursi/Polku/issues/226))

A **3D** button now sits with the map's buttons, under zoom on a desktop and under locate on a phone. A tap raises the terrain and tilts the map; another tap lays it flat again. The button is filled and underlined while 3D is on, and screen readers announce it as pressed.

- It's the same setting as **3D terrain** in **Layers → More**, so each always shows what the other did, after a reload too. How much the terrain is raised is still set there.
- The layer drawer no longer has a 3D terrain tile. MTB's fifth tile is now **Waymarked MTB**. If you chose your own tiles with 3D terrain among them, the drawer shows the others and leaves room to add one in **Edit**.

### Fixed: a quick tap on the map stays a tap on a busy phone ([#293](https://github.com/TommiContursi/Polku/issues/293))

When a phone was busy drawing the map, a quick tap could count as holding your finger down. The tap then opened the **This spot** menu, or started moving the route, and did nothing it should have. Polku now goes by how long your finger was really down: a quick tap adds a point, picks a loop or opens that part of the route's menu, and the route stays as it was. Holding your finger on the map still opens **This spot**, and holding the line still lets you drag it. A phone that vibrates on a hold may still buzz briefly on such a tap.

### Fixed: a click on the sport button keeps its menu open ([#245](https://github.com/TommiContursi/Polku/issues/245))

With a mouse, the sport button beside the search opens its menu as you move over it, and a click on the button used to close that menu again straight away. The click now keeps the menu open, so you can pick a sport. A second click, Esc or a click elsewhere still closes it. Touch and the keyboard work as before.

### Fixed: Settings stays on screen while you plan on a phone ([#240](https://github.com/TommiContursi/Polku/issues/240))

On a phone with the planner pulled up, **Settings** used to open partly above the top of the screen, so its heading and close button couldn't be reached. Settings now opens between the top bar and the planner, and its contents scroll. When the planner is pulled up too far to leave enough room, for example at full height or on a small or turned phone, Settings covers the planner instead. The planner is just as you left it when you close Settings.

### Fixed: green buttons are easier to read in dark mode ([#239](https://github.com/TommiContursi/Polku/issues/239))

In dark mode, buttons with white text on green now use a deeper green, so their labels and icons stand out more clearly. This includes the sport button beside the search, **Locate**, **Settings**, the **Weather** button while it's on, **Make 3 loops** and other main buttons, switches that are turned on, the layer drawer's **Done** button and ticks, and the compass in heading-up mode. Green text, icons and borders on dark backgrounds are unchanged, and so is light mode.

## 2026-10-17

### Find the right map layers faster ([#123](https://github.com/TommiContursi/Polku/issues/123))

The **Layers** button now opens a compact drawer with map previews and five useful layers for your current sport. You can switch layers on or off without leaving the map, open their detailed settings when needed, or choose **More** for the full collection.

- Each sport has its own five layers. MTB starts with trail colours, trail details, official routes, 3D terrain and rain radar; paddling starts with nautical marks, depths, ships, landing sites and wind.
- Layers with more settings are marked ›, which opens options such as the trail colour style, opacity or the individual depth layers.
- Layers that can't be shown are labelled: "Zoom in to see" when you need to zoom in, and "No data now" when their source isn't responding.
- **Edit** lets you replace the five shortcuts with your own favourites, and **Reset** restores the defaults. Layer choices are remembered separately for each sport.
- **More** opens the full layers panel and shows how many other layers are switched on.
- On phones, the drawer slides up from the bottom and can be dismissed with a swipe or a tap on the map; that tap doesn't add a point to your route. On desktop, the drawer opens beside the Layers button and stays open while you use the map.
- With a keyboard, press **L** to open the drawer, use the arrow keys to choose a base map, and press Esc to go back or close it.

### A smoother planner on phones ([#96](https://github.com/TommiContursi/Polku/issues/96))

The planner now follows your finger when you drag its handle, summary, tabs, profile header or the top of its list. Buttons in those areas still work normally when you tap them.

- When you let go, the planner settles at the nearest size. A quick flick always moves it at least one size, and you can catch the planner again while it's still moving.
- The map's buttons move once the planner has come to rest, instead of sliding along with it.
- With reduced motion turned on, the planner still follows your finger but changes size without sliding.
- The new layer drawer responds to swipes in the same way.

### Read release notes without leaving Polku ([#221](https://github.com/TommiContursi/Polku/issues/221))

Find **What's new** under **Settings → About Polku**. The notes open over your map without disturbing your route.

- The notes load when you open them, and the date of the latest update is shown at the top.
- When you're offline or the connection is slow, Polku can show a previously loaded copy and tells you that it's a saved copy. If the notes can't load, you can try again or open the full changelog on GitHub.

## 2026-10-16

### Compare alternative routes ([#125](https://github.com/TommiContursi/Polku/pull/125), [#212](https://github.com/TommiContursi/Polku/pull/212))

After you add a new point and pause, Polku may suggest up to two other ways to reach it. Alternatives appear in blue beneath your route, labelled with their extra distance and the share on paths and tracks, for example "Other way · +40 m · 22 % trails". Your own route gets a matching label, such as "This way · 61 % trails", so you can compare them at a glance.

- Tap an alternative to use it. Your previous route stays visible in grey until you add the next point, so you can switch back with one tap.
- Suggestions appear only for legs of 300 m or more, and only when the free routing service has capacity to spare, because each alternative needs an extra routing request. If you use your own routing server (set in Settings), suggestions always appear.
- You can also ask for alternatives at any time: tap part of the route and choose **Other ways**.
- The route you choose is kept through Undo, reloads, offline saving and share links. Changing that part's sport, style or points goes back to the default route.
- When **Heads-up** has found a shortcut through a way marked private, that shortcut is offered as one of the alternatives.

### Routes that are easier to follow ([#210](https://github.com/TommiContursi/Polku/pull/210))

Routes stand out more clearly against the map, with a subtle glow and moving arrows that show your direction of travel.

- The arrows only move while the route is on screen and Polku is in view. They pause when you leave the map alone for a while and start again when you touch it.
- The arrows stay still when reduced motion is turned on or 3D terrain is in use. You can turn them off under **Settings → Display → Moving arrows on the route**.

### Route breakdowns in one place

**Check → On the route** now brings the gradient, difficulty, surface, trail details and weather breakdowns together where data is available, grouped under Terrain, Ground and Weather. Each breakdown has its own coloured bar, legend and distances, and even short stretches are counted.

- Select a breakdown to colour both the route and its elevation profile. The breakdown in use is marked **Selected**.
- Hover over a category to highlight the matching stretches on the map. Keyboard users can step through the categories with the arrow keys and press Esc to clear the highlight.
- You can fold each group from its header, and Polku remembers which groups you've folded.

### Departure and arrival times

The departure-time control is now at the top of **Go**, and tapping the time estimate in the planner's summary takes you straight there. Arrival estimates update as soon as you change your start time.

Distance markers on the map show elapsed time and expected arrival time, with a separate switch for each in **Check → On the map**.

### Clearer warnings about private and restricted ways ([#116](https://github.com/TommiContursi/Polku/pull/116), [#117](https://github.com/TommiContursi/Polku/pull/117), [#124](https://github.com/TommiContursi/Polku/pull/124))

Polku now identifies ways marked private or closed in OpenStreetMap and tells you when a route uses or avoids them.

- Ways marked private or closed for your sport have purple dots beside them on the map from zoom level 14, so you can see why a route goes around them.
- **Heads-up** warns when a route uses such a way, and when it avoids one, along with the distance a shortcut would save. Tap the warning to see the shortcut on the map. Heads-up also tells you if one of your points was moved off such a way.
- The new **Ways marked private** route-style option lets you choose **Keep off** or **Short cuts ok**. Shortcuts are strictly opt-in: no preset turns them on, round trips always keep off, and ways explicitly marked as having no access stay closed.
- The **Short cut** button in Heads-up allows a shortcut for that leg only, and Undo reverses it. Your choice is kept in share links and saved routes.
- When Valhalla is used instead of BRouter, it may route through ways marked private, and Heads-up tells you so.
- If a tag looks wrong, you can leave a note for OpenStreetMap contributors from the warning's ⋯ menu.

**An OpenStreetMap tag does not establish whether access is legal.** In Finland, private roads and apartment-block yards are generally open on foot and by bike, while factory and military sites are not. Check signs and local rules before using a shortcut.

### Follow your position and heading ([#111](https://github.com/TommiContursi/Polku/pull/111))

The location marker now shows which way you're facing: from the compass while you stand still, and from your direction of travel once you're moving, which also works with your phone in a pocket. On an iPhone, Polku asks for access to the compass when you tap **Locate**.

- **Locate** centres the map and follows your position, with north up. On phones, a second tap turns the map to face your direction, and a third tap turns location off.
- Moving the map away pauses following, and **Follow** brings you back. Zooming and rotating don't stop it. When the planner is open, the map keeps your position visible above it.
- The marker turns grey if no new position has arrived for a minute.
- To save battery, location updates pause while the page is hidden.

The precise location that **Locate** follows is used only in the open page. It isn't saved with your route, included in share links or sent anywhere, and Polku doesn't remember the map view for your next visit while location is on. Share links no longer include the map view, and nearby search and ship information use an approximate map centre, accurate to about a kilometre, rather than your position. A round trip from **My location** is the exception you ask for: its loops start from your position, which is routed like any other start.

### Routes fit above the planner on phones ([#110](https://github.com/TommiContursi/Polku/pull/110))

The map now fits the route into the visible space above the planner, including when the planner is at full height. This also applies after importing a track, opening a shared route or choosing a round-trip suggestion.

You can now select a suggested loop by tapping it on the map, without moving its start point or losing the other suggestions.

### Fixed: dragging a route's midpoint

Dragging the handle in the middle of a route segment now adds exactly one new point, instead of sometimes creating a second, unwanted bend. A single Undo reverses the edit.

## 2026-10-15

### Plan for winter conditions ([#52](https://github.com/TommiContursi/Polku/pull/52), [#53](https://github.com/TommiContursi/Polku/pull/53), [#56](https://github.com/TommiContursi/Polku/pull/56))

Polku now brings snow, winter trails and seasonal restrictions into both the map and your route. **Winter** turns on automatically when there's 5 cm of snow or more, or you can choose **Auto**, **On** or **Off** in the layers panel. The sport button shows ❄ while winter mode is on.

- Snow depth, ploughed and unploughed paths, ski tracks, seasonal closures and other winter routes are shown on the map. Snow depth is also on the timeline.
- The **Winter** trail colour shows how quickly paths are likely to become usable after snowfall, at any time of year. Trail details describe winter conditions where they're mapped.
- Route estimates account for snow on the way, adding a little time on ploughed paths and more on trails.
- **Heads-up** warns about snowfall, slippery conditions around 0 °C, severe wind chill at your speed (with a frostbite risk from about −27 °C), winter closures, unploughed paths and stretches near ski tracks. **In the dark** also shows how much of the route is lit.
- Ski tracks and other restricted winter routes should be used only where permitted. Their details link to the operator's page for grooming status.

Paddlers and swimmers can view FMI's sea-ice charts, but **Polku cannot see the ice or assess whether it's safe to travel on**.

### A clearer planner: Route, Check and Go ([#60](https://github.com/TommiContursi/Polku/pull/60), [#61](https://github.com/TommiContursi/Polku/pull/61))

The planner is organised into three tabs:

- **Route** is where you draw and edit your trip, including round trips, route style and speeds.
- **Check** brings together conditions, climbs and warnings.
- **Go** handles departure, estimated arrival, sharing, GPX export and offline saving.

The elevation profile stays visible as you move between tabs, and waypoints and climbs are labelled separately in it. Route segments highlight on the map when you point at them in the planner. With no route yet, the planner offers to draw one, make a round trip, use a marked route or open a file.

On desktop, the planner opens on the left, and you can move it to the bottom of the screen and back. Export, share and offline actions are also available from the planner menu.

### Missing terrain no longer looks flat ([#94](https://github.com/TommiContursi/Polku/pull/94), [#101](https://github.com/TommiContursi/Polku/pull/101))

When elevation data is unavailable, Polku now identifies missing or estimated terrain instead of presenting a hilly route as flat. The summary shows "↑? ↓? m · no terrain", and the time is estimated from distance alone.

- Partly missing terrain appears as a grey dashed section in the profile, and the summary says "part estimated".
- **Heads-up** says what's missing and offers **Retry**. Polku also retries on its own, and immediately when you're back online.
- GPX exports leave out unknown elevations rather than inventing values.
- Uphill trail colours return as soon as the terrain data finishes loading, without a reload.

### More dependable routing ([#79](https://github.com/TommiContursi/Polku/pull/79), [#81](https://github.com/TommiContursi/Polku/pull/81))

Routing requests are now paced more carefully to avoid overloading free services, which could otherwise block your connection to brouter.de for a while. When the primary service is delayed, Polku uses an alternative.

- **Settings → Data sources** counts every routing request, including retries.
- Paddling routes are checked again when missing rock and shoal information becomes available. Until then, **Heads-up** tells you that the water route has not been fully checked.

### Your route keeps its sports ([#54](https://github.com/TommiContursi/Polku/pull/54), [#64](https://github.com/TommiContursi/Polku/pull/64))

Changing the sport used to view the map no longer silently changes the sports in your planned route. If you do want to convert the route, Polku offers that as a separate action.

- The planner's sport picker changes the route's main sport only, so a paddling leg in a cycling route stays a paddling leg. Undo brings the previous route back.
- **Back to start** works again from the waypoint list, the finish point's menu and the toolbar, and can be undone.
- When the planner jumps to a section, such as weather, speed or style, that section is briefly highlighted.

### Warnings, sharing and smaller screens ([#57](https://github.com/TommiContursi/Polku/pull/57), [#58](https://github.com/TommiContursi/Polku/pull/58), [#92](https://github.com/TommiContursi/Polku/pull/92))

- **Heads-up** now includes mapped obstacles such as fallen trees in every sport, even when the Trail details layer is off.
- You can hide warning categories you don't need from a warning's ⋯ menu. Hidden categories are listed at the end of Heads-up, so you can bring them back.
- The same menu lets you correct OpenStreetMap or leave a note for its mappers.
- Shared routes now include places you've chosen to avoid. Older links still work, with a warning if the places to avoid can't be read.
- When Polku runs from a saved copy because the server can't be reached, a banner says the copy may be out of date.
- On phones, map credits stay collapsed until you open them, leaving more room for the map.
- Smaller fixes: short routes show distances such as "at 40 m", rain "now" matches the radar, the route menu stays inside the window, and map details that grow move back into view.

## 2026-10-14

### Plan trips across several sports ([#43](https://github.com/TommiContursi/Polku/pull/43))

A route can now combine different sports, such as cycling to a lake, paddling across it and continuing on foot. Each leg uses the appropriate routing, speeds and safety checks, and Polku includes changeover time in the schedule.

- **Swim** joins the available sports, with open-water routes near the shore that keep away from boats, swimming-specific pacing, and beaches and swimming places from LIPAS.
- When a new leg is mostly on water while you're drawing a land route, Polku offers to paddle it.
- You can set your own changeover time at each waypoint.
- Shared and saved routes keep the sport of each leg and your changeover times.

### Breaks and overnight stops ([#49](https://github.com/TommiContursi/Polku/pull/49))

You can add breaks and overnight stops at waypoints. Arrival times, forecasts and sunset warnings adjust accordingly.

- Longer trips get a day-by-day schedule, with each day's distance, timing, overnight stop and weather. The forecast extends up to ten days while making its uncertainty clear.
- An overnight stop's menu suggests nearby huts, shelters and campsites within 3 km.
- Polku warns about overnight stops shorter than 5 hours, and about leaving a bike or boat behind when changing sports. If you're carrying it with you, such as a packraft or a folding bike, you can say so in the point's menu.
- Stops are kept in shared and saved routes and in GPX exports.
- Changeover times are no longer lost when you drag a point, and departure warnings show the correct sunset time.

### More round-trip options, including on the water ([#50](https://github.com/TommiContursi/Polku/pull/50))

Round-trip planning now supports paddling and swimming. Choose a starting point, target length and direction to see three suggested routes. On narrow waterways, Polku can suggest an out-and-back route instead. Each suggestion includes its estimated time and relevant water hazards.

If none suits you, **More loops** offers additional options in every sport, up to nine in total, without discarding the earlier ones.

### Safer water routing ([#40](https://github.com/TommiContursi/Polku/pull/40))

Paddling routes now take shipping lanes, nautical marks, rocks, shoals and expected wind conditions into account. Polku aims to cross shipping lanes directly rather than follow them, and **Heads-up** highlights potential hazards.

- The paddling route style has switches for fairways, rocks and shoals, and wind, and a Direct preset.
- Places you've chosen to avoid also work on water legs.

**Depth information is for reference only, not navigation.** Traficom's licence excludes route planning, so Polku doesn't use depths for routing. Always check real conditions and official navigational information before setting off.

### Easier route editing and inspection ([#44](https://github.com/TommiContursi/Polku/pull/44)–[#48](https://github.com/TommiContursi/Polku/pull/48))

Clicking or tapping a route opens the options for that section, including adding a point, changing its sport or route style, and avoiding a location. Dragging the line still reshapes the route, and clicking away from the line still adds points.

- Waypoints snap to nearby paths when **Follow paths** is selected, and points the route can't reach are marked with a dashed line.
- The elevation profile can show the sport of each part of a mixed route.
- Distance markers can show when you expect to reach them.
- Sunrise and sunset are included in route information, and **Heads-up** warns about travel after dark. Paddlers are reminded that a light is required on the water after dark.
- Route handles are back in place, and route colours no longer remain on the map after the route is cleared.

### Discover official routes and trail conditions ([#31](https://github.com/TommiContursi/Polku/pull/31)–[#37](https://github.com/TommiContursi/Polku/pull/37), [#39](https://github.com/TommiContursi/Polku/pull/39))

You can use an official **LIPAS** route as your own plan or add it to an existing route. Search now separates places, marked routes, facilities, map trails and coordinates, making results easier to browse.

- Trail details show width, visibility, wet or overgrown sections, gates, fallen trees and other mapped obstacles. These details can also appear in route warnings and profile colours.
- The rain radar shows measured rainfall more accurately, especially in light rain.
- Difficulty and uphill colours have separate opacity settings.

### First visit opens on Helsinki ([#41](https://github.com/TommiContursi/Polku/pull/41), [#42](https://github.com/TommiContursi/Polku/pull/42))

On a first visit, Polku opens on Helsinki and offers to find your location. Later visits return to your last map view. The map's credits now link to Polku's source code.

## 2026-10-13

### Create and edit round trips ([#27](https://github.com/TommiContursi/Polku/pull/27))

Pick a starting point, desired distance or duration, and direction to generate three suggested loops. Compare them, choose one and continue editing it like any other route.

### Choose how you want to travel ([#18](https://github.com/TommiContursi/Polku/pull/18)–[#20](https://github.com/TommiContursi/Polku/pull/20), [#24](https://github.com/TommiContursi/Polku/pull/24)–[#26](https://github.com/TommiContursi/Polku/pull/26))

Polku now supports road cycling, running and trail running alongside MTB, gravel riding, hiking and paddling. Set an easy, normal, fast or custom pace for each sport.

Sport-specific route styles let you choose a preset or adjust preferences for the whole route or an individual leg. Road cycling prioritises suitable paved roads, while other styles can account for wet ground after rainfall.

### Route editing and dependable routing ([#21](https://github.com/TommiContursi/Polku/pull/21)–[#23](https://github.com/TommiContursi/Polku/pull/23))

You can drag points or route segments on the map, rename or reorder waypoints, remove points and undo changes. Routing requests are managed to work more reliably with free services, with an alternative service when needed.

### A more flexible map and planner ([#4](https://github.com/TommiContursi/Polku/pull/4)–[#13](https://github.com/TommiContursi/Polku/pull/13), [#15](https://github.com/TommiContursi/Polku/pull/15)–[#17](https://github.com/TommiContursi/Polku/pull/17), [#29](https://github.com/TommiContursi/Polku/pull/29))

The planner adapts to desktop and phone screens, with a compact view that leaves room for the map. Map styles, layers and settings are easier to reach, and weather, departure time and route conditions share a timeline. The layer controls include sport-specific overlays and their opacity settings.

Weather information, rain radar, road works, route details and offline map areas are better integrated with the map. Polku also handles limits on free data services more gracefully, so an unavailable source is less likely to interrupt planning.

## 2026-10-12

### Introducing Polku ([#1](https://github.com/TommiContursi/Polku/pull/1)–[#3](https://github.com/TommiContursi/Polku/pull/3))

Polku begins as an outdoor map and route planner for Finland, built for mountain biking, gravel riding, hiking and paddling. It combines trail difficulty, climbs and elevation, 3D terrain, weather and wind information with routes you can create and adjust on the map.

It also includes road and weather conditions, incidents and road works, military-area information, places to avoid, weather cameras, ship information and nautical map layers. The goal is to bring useful planning information into one place without having to switch between several maps and services.
