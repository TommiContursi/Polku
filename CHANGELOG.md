# Changelog

What's new in [Polku](https://polku.si), from the latest updates back to the first release. These notes describe features available in the app, not work still in progress. For upcoming changes, see the [issues](https://github.com/TommiContursi/Polku/issues) and [roadmap](docs/ROADMAP.md).

## 2026-10-31

### The stretch you pick stands out on the map ([#83](https://github.com/TommiContursi/Polku/issues/83))

- The leg or stretch you open or point at in the planner, and a climb or an item of Check you pick, is now drawn over the route, wider, with a dark edge (a white one on the aerial photos and the night map), and the rest of the route fades while it's lit. You can see at once where it starts and ends. It keeps its leg's colour, blue on the water, and the arrows still show the way.

## 2026-10-30

### Choices in Layers and Settings fade to their new look ([#540](https://github.com/TommiContursi/Polku/issues/540))

- A tile in the layer drawer, a base map, a chip such as **Settings → Display → Appearance** or a paddling craft, and a speed such as **Slow** or **Fast** now fade to their chosen look instead of snapping, as Layers' switches do. After you pick a speed from the keyboard, the focus stays on it.
- In **Settings → Your speeds**, a sport's speeds fade in as you open them, and its arrow turns. In **Layers**, a group's rows fade in as you open it.
- Opened from the keyboard, they're there at once. With reduced motion, they fade and nothing slides or turns.

### The map's buttons answer a press, and menus open from their button ([#540](https://github.com/TommiContursi/Polku/issues/540))

- The map's buttons and the top bar's (Locate, zoom, 3D, the compass, Weather, Layers, Plan, Settings and the sport) shrink a little while you press them, as the planner's buttons do, and a button that turns on or off fades to its new colour. In Layers, the base maps' pictures and the On now chips do the same.
- The sport's menu and the menus that open from a button, such as the planner's ⋯, grow out of their button as they open and shrink back into it as they close. A menu that opens again in its place, as when you pick Paddle's craft, is there at once, and one with no room beside its button fades in and out instead.
- The first tooltip on the planner's buttons grows in from its button after its short wait; the next one, as you move along the buttons, is there at once.
- Opened from the keyboard, a menu or a tooltip is there at once. With reduced motion, they fade instead, and nothing shrinks or grows.
- A new light or dark look, or more contrast, changes everywhere at once: the buttons no longer catch up with the panels.

### A lighter look over the map, and the route in magenta ([#547](https://github.com/TommiContursi/Polku/issues/547))

- What floats over the map is now glass that lets the map show through. The top bar, the planner, the timeline, the toolbox, Layers, Settings and, on a desktop, the card at a point sit on a reading glass that stays one calm tone over any map, and the map's buttons on a whiter glass, so they read as one group. Each has a light inner edge and a soft outline, so it stands apart from the map under it, in light and in dark.
- Words on the glass are a darker grey, green and red, so they stay readable over the busiest map. The menus, popups and dialogs stay solid.
- The route is magenta, apart from every red the map draws, such as the S3 trails, the no-bike ticks and LIPAS's hiking routes, and from them with colour blindness too. A straight line is a darker magenta, dashed.
- The Weather button's time ahead and the timeline's ⚑ are in a darker magenta, and a pink in dark, so they're readable on the glass in dark too ([#559](https://github.com/TommiContursi/Polku/issues/559)).
- Red is for danger only: **Remove**, **Delete** and Check's warnings share one red.
- **High contrast** in Settings → Display, and your device's settings for more contrast or less transparency, turn the glass solid. More contrast also makes grey words darker and lines heavier, and gives every panel and button a clear outline. **High contrast** still thickens the trails too.
- The word **Layers** on its button sits on a darker band, so it's readable over a light map ([#588](https://github.com/TommiContursi/Polku/issues/588)). On a phone the logo is the green mark alone. In dark, Check's warning box is solid and a switch's chosen choice is lighter than its track.

### Fixed: a mouse drags the planner in a narrow window ([#585](https://github.com/TommiContursi/Polku/issues/585))

- In a window too narrow for the side panel, or with the planner at the bottom, a mouse drags the folded planner's line and its handle up to open it, as a finger does.
- A quick mouse drag on the open planner's handle moves it too, instead of doing nothing.

## 2026-10-29

### Choose light or dark in Settings ([#323](https://github.com/TommiContursi/Polku/issues/323))

- **Settings → Display → Appearance** chooses how Polku looks: **Automatic**, **Light**, **Dark** or **Match the map**. Automatic is the default: Polku is light or dark as your device is, and changes when the device does, also while Polku is open.
- **Light** and **Dark** keep Polku that way, whatever your device is set to.
- **Match the map** makes Polku dark over the aerial photos and the night map, and light over the Trail map, Plain, Maastokartta and MML, so the panels sit calmly over the map you're looking at. It changes as you pick another map, and never changes the map.
- Your choice is kept on this device, and Polku opens in it without a flash of the other look. In dark, a browser that colours its bar to match the page makes it dark, not green.
- **High contrast** stays a setting of its own.

### With reduced motion, the planner's list scrolls at once and the routing bar stays put ([#540](https://github.com/TommiContursi/Polku/issues/540))

- With reduced motion turned on, or when a key press opens it, the planner's list jumps to a section it opens for you, such as Leave or the weather along the route, instead of scrolling to it.
- While a leg is being routed, the bar across the planner's top waits a moment before it shows, so a quick answer shows no bar, and then fades in. With reduced motion it stays in place and fades in and out instead of sliding across.

### The folded planner says when a leg is being routed ([#580](https://github.com/TommiContursi/Polku/issues/580))

- With the planner folded to its line, the line says **Routing…** before the route's numbers while a leg is being routed, and the bar stays across the top of the line.

### The planner folds and opens more smoothly ([#569](https://github.com/TommiContursi/Polku/issues/569))

- On a phone, the planner and its folded line fade into each other when you tap **⌄** or the line, as they do when you swipe. Before, the planner went blank for a moment.
- The map's buttons, the toolbox and the timeline move with the planner as it changes size, so they no longer disappear behind it or jump ahead of it. On a desktop with the planner at the bottom, the map's buttons beside it stay where they are.
- The planner changes size on the same curve as the Layers drawer, and gets smaller a little faster than it grows.
- On a phone, the planner slides down off the screen when you put it away and slides back up when you open it again, as the Layers drawer does.
- From the keyboard the planner changes size and opens or closes at once. With reduced motion turned on it changes size at once and fades in and out instead of sliding.
- **⋯** no longer fades in again each time the planner opens from its line.
- On a desktop, a card's **⌄** pressed with the keyboard folds and opens the card at once.

### On a phone, cards open at the foot of the screen with the planner closed too ([#570](https://github.com/TommiContursi/Polku/issues/570), [#572](https://github.com/TommiContursi/Polku/issues/572))

- With the planner closed, a tap on a trail, a place or a warning on your route opens its card at the foot of the screen, as it does while you plan, instead of in a window over the map. It slides up and back down as the planner does. **⌄** folds it to a line and **✕** closes it, and the planner stays closed.
- With the timeline open, a card at full height has the timeline on it under the card's name, instead of off the screen.

## 2026-10-28

### The planner and its cards fold to one line ([#338](https://github.com/TommiContursi/Polku/issues/338), [#303](https://github.com/TommiContursi/Polku/issues/303), [#434](https://github.com/TommiContursi/Polku/issues/434))

When the map matters more, the planner and its cards fold out of the way to one line and come back as they were.

- On a phone, **⌄** at the planner's top right, or a swipe down, folds the planner to one line: how many things there are to read before you go, and the route's numbers. A tap anywhere on the line, or a swipe up, opens it as it was.
- A second swipe down, or **✕** at the line's end, puts the planner away. Your route stays on the map, and **Open** in the note or **Plan** brings the planner back. A single swipe always stops at the line.
- Folded, the toolbox keeps how the next leg is drawn, **Undo** and **Redo**, since a tap on the map still adds a point.
- A card, such as a point's, folds the same way to its name and its first two numbers: a point's line says when you get there and how far it is from the start. A card without numbers says something of its own: the whole route its distance and time, a place its kind, **Sport from here** the sport chosen, **Edit this stretch** its two ends, and **Places to sleep nearby** how many it found. A swipe up opens a card to its own height, and to the full height only when it needs it. Before, a swipe up on a card closed it. From its line, a swipe down or ✕ closes the card, and the planner is as it was under it.
- In the route's view, **⋯** sits at the left of ⌄'s row when the planner is open all the way, so the list has more room.
- On a desktop, **⌄** in the planner's header folds the planner down to its line at the foot of the map, with the toolbar beside it, in place of **Minimise**, and **✕** beside it puts the planner away while you draw. With the planner at the bottom, it folds to its line with the toolbar on it. A card on the map folds to its title row with its own ⌄, saying the same beside its name, its foot staying where it was.
- At 200 % zoom, or wherever the planner's summary would cover more than half the screen, the planner rests at its line, and opened all the way its whole sheet scrolls, so the list can be reached. On the line, each number stays whole with its unit.
- The map's buttons no longer go under the top bar when the planner or a start step is raised. Where there's no room they step aside: Weather first (it's also **T** and in Layers), then **Show the whole route** (then in ⋯), then **Show my location**.
- The map's buttons no longer slide after the planner as it changes size: they move once, to where it's going.

### The planner's toolbar is at the bottom on a desktop ([#468](https://github.com/TommiContursi/Polku/issues/468), [#387](https://github.com/TommiContursi/Polku/issues/387))

On a desktop the planner's toolbar sits at the bottom whichever side the planner is on, as the toolbox does on a phone.

- With the planner at the side, the toolbar is at the foot of the map along the planner's edge, with the map's scale and credits just above it. With the planner at the bottom, it stays on the planner's top edge.
- The map's buttons are level with the toolbar now, so in a laptop-sized window more of the route's actions are in **More**. In a narrow window the toolbar shortens its names, and in the narrowest it takes a second row rather than run under the map's buttons.
- Moving the planner between the side and the bottom, with its place button or in Settings, frames your route again clear of it, as **Show the whole route** does. Before, the route could end up under the planner.

## 2026-10-27

### Fixed: switches in Layers move, and keep the keyboard's place ([#540](https://github.com/TommiContursi/Polku/issues/540))

- A switch in Layers, such as **Trail details** or **Wind**, now slides its knob and fades its colour when you turn it on or off, as the switches in Settings did already. A choice such as the trail colours' **Off / Difficulty / Uphill** fades to the one you picked. With reduced motion turned on in your phone or computer, the colours still fade and nothing slides.
- After you turn a switch in Layers on or off from the keyboard, the focus stays on it, so you can go on from there.

### Settings and dialogs open the way Layers does ([#540](https://github.com/TommiContursi/Polku/issues/540))

- **Settings** now grows quickly out of the ⚙ button, as Layers does from its button, and closes at once. Opened from the keyboard, it appears at once.
- Dialogs, such as **What's new**, **Save offline** and a road camera's card, fade in and grow a little from the middle (a card from its corner), and the dim behind them fades in too.
- With reduced motion turned on in your phone or computer, they only fade.

### Fixed: notes fade in ([#540](https://github.com/TommiContursi/Polku/issues/540))

- A note at the bottom of the map, such as **Undo** after clearing a route, now rises a little and fades in instead of appearing all at once, and it goes a little quicker than it came. With reduced motion turned on in your phone or computer, it only fades.

### Fixed: the compass needle turns the short way past south ([#540](https://github.com/TommiContursi/Polku/issues/540))

- When you turned the map past south, the compass needle spun almost a full turn the wrong way before pointing north again. Now it turns the short way, as far as the map does.

## 2026-10-26

### Marked routes are easier to pick on the map ([#308](https://github.com/TommiContursi/Polku/issues/308))

A marked route on the map shows that it can be picked, and which one you picked.

- With a mouse, the pointer is a hand over a marked route (LIPAS), and the whole route lights up while the pointer is on it, before you click. A place's icon, a warning marker or your own route on the same line is what a click opens there, so the route doesn't light.
- A route you click or tap on the map stays lit while its card is open, so it's clear which route it was.
- While you plan a route, the map doesn't open marked routes' cards: **Marked routes** in the planner's start is where to pick one.

### Fixed: closing a card leaves the map where you moved it ([#513](https://github.com/TommiContursi/Polku/issues/513))

- Closing a card, with **✕**, Esc or the back gesture, leaves the map where you moved it. Going back a step in Draw it, Marked routes or a round trip does too.

### Fixed: the Avoided place menu on a phone at 200 % ([#440](https://github.com/TommiContursi/Polku/issues/440))

On a phone with the text enlarged to 200 %, tapping a place you avoid opened a menu wider than the screen, with **Stop avoiding** partly off its right edge. Now the menu is never wider than the screen less 8 px each side, and the map's buttons step aside while it's open. With the planner's sheet open on such a small screen, the sheet can still cover the menu's lower part.

### Fixed: the track's card leaves the end of an imported track in view ([#131](https://github.com/TommiContursi/Polku/issues/131))

After you import a GPX or KML file, the map frames the track with room for its card (**Analyse & edit**) at the bottom, so the end of the track is no longer under the card, with the planner open or put away.

### Fixed: the map stays still when you press the route or open a card as its numbers come in ([#467](https://github.com/TommiContursi/Polku/issues/467), [#513](https://github.com/TommiContursi/Polku/issues/513))

Just after the route was shown whole, its numbers could come in, the sheet grow, and the map frame the route again a moment later, even if you had pressed the map or opened a card in that moment. The press then missed the route, or the card slid down the screen and off it. Now the map frames the route again only if you haven't pressed it, moved it or opened a card since.

## 2026-10-25

### The map's cards: hold the map to see what's there ([#233](https://github.com/TommiContursi/Polku/issues/233), [#345](https://github.com/TommiContursi/Polku/issues/345))

Hold the map, or right-click it, to see what's there and what you can do. Ways, places and official routes open on the same card as your route's points, and a spot can be shared.

- Holding the map still for half a second (a ring fills under your finger), or a right-click, opens a card for the spot: what the map has there, how far it is from your route, its height and your sport's fact of the way. A tap is still a tap, and moving your finger is still the map's.
- **+ Add to my route** puts the spot where it adds the least to your route, between two points or after the end, and the note says which point it follows. Within 30 m of the line it adds a point on the line. With no route it starts one. **Start here** and **End here** add a new start or end, and **Undo** takes them back.
- A tap on a place's icon (a shelter, a campfire site, a toilet, a peak, an obstacle or a LIPAS place) shows its card instead of adding a point, even while you draw. A tap beside it still adds a point.
- Holding the route still while you draw opens **Edit this stretch**, and so does a right-click on it. Hold it a moment and drag, and it still reshapes the route. The first point's peek says how to see what's there.
- **What's here** says what the map knows, your sport's details of the way first and what it doesn't know said so, as “? not mapped”. A place has its details in groups. **All OpenStreetMap details** asks OpenStreetMap once for its own data, and adds what it says to the card. **Copy** puts the spot's coordinates on the clipboard.
- **Not right?** opens OpenStreetMap's note page at the spot, which needs no account, or its editor for that way or place; a LIPAS place opens LIPAS's page.
- **Share** opens your phone's share sheet with a link to the spot, its name and its coordinates, or copies the link and says so. The link opens Polku at the spot with a pin and its card, and carries only the spot and the map's view, never your route or where you are.
- **Weather here ›** opens the timeline held at the spot, with a pin on it, until you close the timeline or pick another spot.
- With the planner put away, a tap on a way, a place or an official route opens the same card, with the same **What's here**. Ships, sea marks, road works and the water's depth keep their own cards.
- With a keyboard, Tab to the map for a crosshair in its middle and the keys listed on the map: the arrows move the map, **Enter** does what a tap does there, **Shift+F10** or the menu key what holding does, and **Esc** closes the card.

### The route's card, the list in sections, when you leave, and what stands out ([#233](https://github.com/TommiContursi/Polku/issues/233), [#364](https://github.com/TommiContursi/Polku/issues/364), [#424](https://github.com/TommiContursi/Polku/issues/424), [#471](https://github.com/TommiContursi/Polku/issues/471))

A tap on the route shows a card for it, Route's list is in sections, a route can leave on any day, and a line under the route's numbers says what stands out.

- A tap on the route shows what's there: the way's name, three numbers for your sport (when you'd be there, how steep, the difficulty, the trail grade or the surface; on the water the wind and temperature), and the stretch's most serious warning. A number the map doesn't have says so in its place. **Add a point here** is right at the spot. **This stretch** runs from one point you see to the next, **Edit this stretch** sets its sport, how it's drawn and its style in one step of **Undo**, and **What's here** lists what the map knows of the way. The route's card also has **On the profile**, **Avoid this spot** and **The whole route**.
- The route's last point is the **End** everywhere, GPX included. The start's card has **Back to start** first while you draw.
- Route's list is in sections: a new one where the sport changes, at a stop and at a night, then a section a day. Each says its distance, time and climb, the weather at its end and what's to read before you go on it. A row for each point you see and for each stretch between them; the points that only shape a stretch fold under it. **Reorder** moves points with a grip, **Earlier** and **Later**; a finger holds a row first, so scrolling never drags.
- **Leave** opens your phone's own date and time picker, for any day ahead, on the start's card and in Go. Once set, it says the day and the time, and **Now** on its line leaves now again. More than ten days ahead it says there's no forecast yet; sunset and the dark still count.
- The date stays with the route on this device, after a reload, and in share links: with one set, **Share link** says it includes when you leave. A route or link whose date has passed opens leaving now, and says when it was planned for.
- A night can be a stay of several: **Stay** with − and +, then **Go on at** with your phone's clock, its line the day you go on.
- **Export GPX** writes the planned times in each waypoint's description ("Leave Sat 31 Oct, 07:30", "There at 09:12"), and none on the track, which apps such as Strava would read as a recorded activity.
- A line under the route's numbers says what stands out: a water leg's wind, rain on the way, a headwind that adds a quarter of an hour, or unpaved on a road bike. Otherwise it shows the sport's usual fact: a trip's hardest day, the hardest climb on a bike, the high point on foot. Weather that isn't known is said beside it. A route of two sports has a row for each. A tap opens where it's told in full, and Check's top keeps them all.
- **Climbs** marks the hardest with **Hardest**, by one measure a sport (the uphill grade on an MTB or gravel bike, height times gradient otherwise), and names it at its top.
- Route opens with **How you go** and **Your speed**, each a step of its own with **Back**. Go opens with **Leave**, when you'd be there and where the time goes, then **Your speed**. The marks on the route (distances and times) are under **Your route** in all layers while a route is drawn.
- Past the forecast's ten days the route says so: the profile goes grey in the weather's colours with **No forecast yet** where it ends, Check's **Not checked** says from where, and the wind, the rain, the cold and the waves aren't judged there by the forecast's last hour, as they were. The time leaves the wind out there. A paddle more than two days ahead is routed by the ten-day forecast's wind.

### Fixed: GPX's planned times when you leave now ([#506](https://github.com/TommiContursi/Polku/issues/506))

Leaving now, **Export GPX** wrote Leave at the minute you exported and the times you'd be there from when the forecast came, so "Leave 11:32" could come before "There at 11:26". Now Leave is the moment the route's times are counted from, as on the screen.

### Fixed: How you go on a route of more than one sport

On a route in more than one sport, such as a bike ride with a paddled leg, **How you go** showed only the main sport's style and said it was for the whole route. Now Route has a **How you go** for each of the route's sports, and each says which legs a change routes again.

### Fixed: Undo after opening a route brings back when you left ([#506](https://github.com/TommiContursi/Polku/issues/506))

After opening a saved route or one saved offline in place of the route you had, **Undo** brought the route back but kept the opened route's time to leave. Now it leaves when it did before, and **Redo** brings back the opened route's time.

### Fixed: Polku waits out BRouter's request to slow down ([#480](https://github.com/TommiContursi/Polku/issues/480))

When brouter.de asked Polku to retry later while another route was still on its way, that route's answer could cancel the wait, and the next legs went straight back to brouter.de. Asking again too soon can block your whole connection to it for minutes. Now Polku keeps waiting as long as it was asked to.

### Fixed: a link with a stay of more than 30 nights ([#506](https://github.com/TommiContursi/Polku/issues/506))

A link changed by hand to stay more than 30 nights at a point opened with a stay of one night. Now it stays 30, the most a stay can be, as a break longer than a day is a day.

## 2026-10-24

### Fixed: shared routes aren't put on the ice ([#479](https://github.com/TommiContursi/Polku/issues/479))

A shared route that began with a straight line opened with that leg drawn onto the ice, and Check warned "On the ice" in any season. Sharing it again carried the mistake into the new link. Now only the legs the link puts on the ice are there.

### Fixed: the timeline keeps its height when its forecast comes in ([#301](https://github.com/TommiContursi/Polku/issues/301))

On a phone with the weather timeline open, the timeline grew a little when its forecast came in, or came in again after you moved the map, and the map's buttons above it moved up with it: 3 px, or 20 px with **Snow depth** on. Now the timeline keeps the room its reading needs from the start, so the buttons stay where your finger expects them.

### Fixed: the map stays put under your finger when the warnings come in ([#446](https://github.com/TommiContursi/Polku/issues/446))

Just after the route was shown whole, the map could frame it again when the row of warnings came in, even while you were pressing the route to add a point or dragging a leg's handle. The press then missed the route, or the drag moved the map. Now a press on the map, or any change to the route, keeps the map where it is.

### Fixed: the elevation chart is whole with warnings to read ([#444](https://github.com/TommiContursi/Polku/issues/444))

With the planner at the size that shows the elevation chart, the row of warnings to read before you go took the chart's room on a small phone, and the chart's bottom ran off the screen. At that size the row now folds away, as the route's stats do, and comes back at the peek. The warnings stay on the map and in Check.

### Fixed: the warnings' ✕ is as easy to tap as the planner's other buttons ([#443](https://github.com/TommiContursi/Polku/issues/443))

On a phone, the ✕ that marks all the warnings read, at the end of their row at the planner's peek, was narrower than the planner's other buttons. Now it's as wide as they are, 44 px.

### Fixed: the warnings' count leaves the map its room on a phone on its side ([#438](https://github.com/TommiContursi/Polku/issues/438))

With large text on a phone turned on its side, the row of warnings to read before you go pushed the top of the planner under the top bar. Now, in a window that short, the count sits in the line of the route's numbers, before **Done**, as it does on a small phone, and **All read** in Check marks them all.

## 2026-10-23

### Fixed: Settings and all layers open whole over a raised planner on a desktop ([#257](https://github.com/TommiContursi/Polku/issues/257))

On a desktop with the planner at the bottom and pulled up high, **Settings** opened with no height, only its **✕** showing, and **More** in the layer drawer did the same to all layers, under the planner. Now, when the planner leaves them less than a small panel's room above it, they open over the planner at their full height, as they do on phones.

### Fixed: Clear route takes the warning's stretch and short cut with it ([#126](https://github.com/TommiContursi/Polku/issues/126))

With a warning's card open, **Clear route** left the warning's stretch glowing on the map and in the profile, with the dashed short cut through a way marked private, and the card stayed open for a route that was gone. **Undo** back to one point did the same. Now they go with the route and the card closes. **Undo** brings the route back without them, until you tap the warning again.

### Fixed: the timeline says where its reading is from, whole ([#243](https://github.com/TommiContursi/Polku/issues/243))

On a phone, the weather timeline's reading beside the strip said where it was read cut short, as "map c". Now "map centre" shows whole, on two short lines beside the temperature where there's no room for one, and the reading is no taller than before. A note there, such as "Weather paused…", shows up to three lines instead of one cut short, and the whole note is in its tooltip.

### Fixed: the search works on a phone zoomed to 200 % ([#375](https://github.com/TommiContursi/Polku/issues/375))

On a phone zoomed to 200 %, the search box was squeezed to a few pixels between the logo and the sport, so you couldn't see or tap into it, and **Settings** ran off the screen. Now, in a window that narrow, the search is its magnifier, and a tap on it opens the field across the top bar, with its results under it. **Escape**, a result or a tap elsewhere folds it back. On the narrowest screens the logo steps aside, so the search, the sport and **Settings** all fit.

### Fixed: the profile stays readable when it's narrow or the route has many points ([#242](https://github.com/TommiContursi/Polku/issues/242))

On a phone zoomed to 200 %, the profile's **Colour by** and **On map** were printed over each other, and its distance labels ran together. Now **Colour by** and its choice take rows of their own, with **On map** under them, and a distance label that would touch the one before it is left out. On a long route, the profile's marks no longer pile up on top of each other. A point too near the mark before it to tell apart is left out there, and the start and the end always show. A climb's tag (**↑1**) that would cover another is left out, the biggest climbs first, and every tag stays whole on the profile.

### Fixed: the map's cards stay on the screen at 200 % ([#435](https://github.com/TommiContursi/Polku/issues/435))

On a phone zoomed to 200 %, a card the map opens for a tap, such as a path's, a ford's or a marked route's, ran off the side of the screen, under the map's buttons, so its words and its buttons were cut off. A warning's card with the planner closed sat under the buttons too. Now the card is as wide as the screen less a small margin, and the map's buttons step aside while it's open and come back when it closes. A card taller than the screen scrolls, a long name breaks on the card, and a fact's value goes under its name when there's no room beside it. On a phone at its usual size, the card still opens beside the map's buttons.
### Check says how serious and how sure, and shows each warning on the route ([#233](https://github.com/TommiContursi/Polku/issues/233))

Heads-up is now Check's three groups, and each warning is marked where it is on the route.

- Check opens with **Read before you go**, for what can stop you, turn you back or hurt, in a red box. **Not checked** lists a source that didn't answer, with **Retry**, and **Worth a look** lists sections to know about. Each group is in order along the route.
- Each warning says where it comes from: live from Fintraffic with the time, from the map, an estimate, calculated, or the routing service.
- A source that doesn't answer stays in Not checked until it answers, so a missing check never looks like nothing on the way. That covers the terrain, the water's sources, Fintraffic, trail details, winter ways and the forecast. **What Polku looked at**, under the groups, lists each source and what it said.
- Check's tab shows how many to read before you go, in red, and a "?" while something wasn't checked.
- A tap on a warning shows its card: how serious, where and how long, where it comes from, and its one action (**Avoid it**, **Short cut**, **Use BRouter** or **Retry**). Every card ends with hiding its kind and a way to check or correct where it comes from: a note to OpenStreetMap's mappers, Fintraffic's traffic situation, or the weather, the climbs or your stops in the planner. **Retry** says it's asking, and says so when the source still didn't answer. On a phone **‹ ›** step along the route, and **All in Check** goes back to the list. Its stretch glows on the map and in the profile, and a climb's does too when you tap it.
- With the planner at its peek, a row above the numbers says how many to read before you go and how many weren't checked. A tap on it shows the first. With large text on a small phone, the count sits beside the route's numbers instead, so the map keeps its room, and **All read** in Check marks them all.
- The row's **✕** marks them all read, with **Undo**, and the row stays away until a warning is new or changes. **Got it** on a card marks one read, and **All read** marks a whole group in Check. Read warnings keep their place in Check and on the map. What you've read stays with the route on this device; share links don't carry it, and another route (an imported track, a round trip, an official route, a saved area) starts with nothing read. **Undo** brings back the route before with what you'd read on it. A source that answers and then fails again is unread again, after a reload too.
- Markers on the route show what to read before you go (a red triangle) and what wasn't checked there (a dashed "?"). While Check is open they show what's worth a look too (an eye). Close ones merge with their count, and a tap or a press shows the most serious first. A marker at a point or a leg's handle sits just beside it, so you can see and tap it.
- A stretch a source didn't cover is dashed on the route. With the planner closed the triangles stay, and a tap on one opens its card above it, whole on a phone's screen, with **Open the planner at it**.
- Rough water says which departure its forecast is for.

**Safety note:** Polku checks only what its sources know. Nothing listed doesn't mean a way is open, safe or allowed, a warning you've marked read is still true, and signs on the ground win.

### Fixed: Undo after Clear route brings back what you'd read ([#439](https://github.com/TommiContursi/Polku/issues/439))

When you cleared the route, drew a new one and marked a warning read there, then undid back to the old route, the old route came back with the new route's read marks, so a warning on it could start out read. Now each route comes back with what you'd read on it.

### Fixed: the sport menu stays open when the snow answers ([#392](https://github.com/TommiContursi/Polku/issues/392))

Polku looks up the snow where you are when it opens, and again after you move the map 8 km or more. When that answer came in just after you had opened the sport menu, it closed the menu, so your next tap opened it again, and a keyboard's focus left the menu. Now the menu stays open, with the focus and your choices where they were. Where the snow turns winter on, the sport pill still gets its snow badge.

### Fixed: the sport menu ends at Swim ([#374](https://github.com/TommiContursi/Polku/issues/374))

The sport menu, under the green sport pill, no longer shows the word "null" under **Swim**. It was there for every sport but Paddle. With Paddle, the menu still ends with your craft.

### Fixed: a note and its Undo stay on screen ([#381](https://github.com/TommiContursi/Polku/issues/381))

A note that came just as the one before it went away, such as "Via 1 removed" or "Route cleared", could vanish at once, and its **Undo** with it. So could the note that follows your answer to "This point is on the water": the one with **Undo** after **Paddle** or **Swim**, and the safety note after **Walk on the ice**. Now each note stays for its own time, unless a newer note takes its place.

### The same controls look the same, and read clearly ([#382](https://github.com/TommiContursi/Polku/issues/382))

Polku keeps its look, but a control that does the same job now looks the same wherever it is, and every word reads clearly in both themes.

- **Plan** is green now, like every other main action. Red is kept for your route and for danger.
- A chosen chip looks the same everywhere: a green tint with a green border and black words, in Layers, the weather timeline and the menus as in the round trip.
- A switch is one height in each place, 44 px to touch on a phone and 36 px with a mouse. The chosen choice is white, with black words and its icon in green. A switch that's off has a grey edge, so you can see it in sunlight.
- The round trip's own length, and a stop's or a changeover's minutes, are one box now: **−**, the number and **+**. You can still type the number.
- The start's sport, **Fine-tune in How you go** and Settings' **Your speeds** are plain rows, like those on a point's card, with black icons.
- Small headings are one size, 12 px capitals, and the titles of the map's cards match the planner's.
- With a keyboard, every control shows the same green ring where the focus is, and the sport menu and the **⋯** menus show it too.
- A button's words wrap inside it rather than running out of it, with large text or long words. On a point's card with large text, a long name wraps on the card, and a row's value goes under its name when the card is narrow.
- Climbs' badges, the letters of round-trip loops, the condition pills, Check's count and the weather layers' chips in Layers are easier to read, in both themes. The hint for dropping a GPX or KML file is on a card of its own, not on the map.
- In the layer drawer, a layer that's on keeps its green border, icon and tick, and its name is black.
- Buttons, chips, tiles and switches shrink a little while you press them, so you know the press counted. With reduced motion, they don't.

### Fixed: Polku finishes opening when a map tile fails to load ([#393](https://github.com/TommiContursi/Polku/issues/393))

When the last map tile Polku waited for failed to load, for example a water depth tile while Traficom's service had trouble, Polku didn't finish opening until you moved the map. Until then your saved route, a shared route and the planner you left open didn't come back. Now Polku opens once the map has every tile it could get, and a tile that failed only leaves its piece of the map empty.

## 2026-10-22

### Fixed: red words are easier to read in dark mode ([#370](https://github.com/TommiContursi/Polku/issues/370))

In dark mode, red words such as **Remove** and **Delete**, **Avoid** in Heads-up and the red pills are a lighter red now, so they read as clearly as the rest of the text. The icons of incidents and road works in Heads-up, and the red edge of **Remove** on a desktop's card, take the same red. Light mode and the map are unchanged.

### A point's card, the same on a phone and a desktop ([#233](https://github.com/TommiContursi/Polku/issues/233))

A tap or click on a point of your route opens its card. On a phone it's in the planner, at your thumb, with the point ringed and in sight above it; undo and redo stay, and the rest of the toolbox steps aside. On a desktop the card opens at the point, small enough to leave the map in view, and the point's row in the planner's list lights up.

- The card gives the point's name and three numbers: when you'd get **there at**, how far it is **from the start**, and its **height**. The start gives when **you leave**, with **Leave at**. While the route is being worked out after a change, a number waits as a dash in its place; one Polku doesn't know says so there.
- **At this point** is one switch, **Pass by**, **Stop** or **Night**, showing what happens there now. A stop has its minutes with **−** and **+**, and says when you get there and go on. A night has **Go on at**, the hour you go on the next morning, and **Places to sleep nearby**, which lists the lean-tos, huts and campsites within 3 km; a tap on one moves the night there.
- **Sport from here** lists the sports, with **your route** on the route's own. A pick changes the legs from the point to the next change of sport, or to the end, in one step of Undo; a paddle leg drawn by following paths goes over water. **Paddle** has your craft under it, **Sea kayak**, **Canoe** or **SUP**, for all your paddle legs. A change of sport has its changeover minutes and **Take the bike along**.
- **Next stretch, to …** names the point it goes to and opens that leg's settings.
- **Move** works without dragging: a note asks you to tap where the point goes, and the next tap moves it there; **Cancel** or **Escape** leaves it where it was, and dragging still works. **Rename** lets you type the name where it's shown, with **Save**.
- **Start here** and **End here** say what they remove, and Undo brings it back. On a loop, **Start here** starts the same loop from that point. The start and the end have **Reverse**, and the end **Back to start**, except on a loop. **Remove** is apart at the bottom, in red, and its note has **Undo**.
- On a desktop the edits are buttons, two a row, and **Remove** a red button of its own; point at one for what it does.
- **✕**, **Escape**, the phone's back gesture and a tap on the map close the card; the tap adds no point. The planner is then as it was, at the same size and scroll. The card follows its point when you move it or undo, and closes when the point is gone.
- While you're not editing, the card has the point's stop or night and the start's leaving time, and the planner's note with **Edit**.
- With large text or a narrow phone, the card takes half the screen at most and scrolls inside. Undo, redo and its close button go on a row of their own above the name, and its numbers one to a row, so names and numbers are never cut.

## 2026-10-21

### Fixed: the labels under your route's numbers are never cut short ([#356](https://github.com/TommiContursi/Polku/issues/356))

The small words under the planner's numbers, such as "distance", "from now" and "ascent · descent", are a little larger now. Where there's no room for a label on one line, for example on a narrow phone or with large text, it goes onto a second line instead of being cut short with "…". The numbers themselves stay on one line.

### Done keeps your route open to read ([#233](https://github.com/TommiContursi/Polku/issues/233), [#238](https://github.com/TommiContursi/Polku/issues/238))

**Done** now ends editing instead of closing the planner. Your route stays open to read, check and take along: above its numbers are its name, its sports and **Kept on this device**. The drawing tools go and **More** stays. **Edit**, where **Done** was, takes you back to drawing, and undo still has everything you did.

- While you're not editing, a tap on the map shows what's there, as with the planner closed, instead of adding a point. A tap on your route opens that part's menu, and the points stay where they are. **Route** lists the points without their controls, with **Edit**.
- On a phone the toolbox then has only **More**. On a desktop the toolbar has **Show the whole route**, **More** and **Edit**, and **E** is **Done** or **Edit**.
- **✕** at the top right closes the planner. Your route stays on the map, and a note says so, with **Open**. **Plan** opens the planner again as you left it, at the size you left it.
- After a reload, the planner opens again if it was open, as you left it. A shared route opens ready to read.
- **Route from here**, **Add to route**, a round trip, a file and a marked route to follow go back to editing on their own.
- On a phone, a note shown while the planner is closed stays left of the map's buttons, and its buttons are a finger's size.
- On a desktop, **Plan** in the map's buttons stays **Plan** while the planner is open, and closes it; it used to say **Done**.

### The start of a route asks one thing at a time ([#233](https://github.com/TommiContursi/Polku/issues/233))

Opened from **Start a route**, the round trip now asks only where it starts: tap the map, or **Where I am**. On a phone that leaves most of the map free for the tap. Once it has a start, the rest of the form appears: **How long**, with a switch for **Distance** or **Time**, the sport's lengths, or **Other…**, which opens a field for a length of your own with **−** and **+**; then the route style and the direction; and **Make 3 loops** last. The map moves so that the start stays in sight above the form.

- The sport has its row right under the top row in every step, as under **Start a route**: in **Draw it**, the round trip and **Marked routes**. It stays in one place as you go from one to another, and it has a border, like the four ways under it.
- On a phone, the round trip shows three lengths and **Other…** in one row, and the route style and the direction are two buttons side by side. On a desktop there's room for four lengths: in the side panel each choice has a row of its own, and with the planner at the bottom the form is in two columns, the sport and the start on the left and the rest on the right, with **Make 3 loops** across both.
- **Start a route** has a line less: the **Draw it** card now says that a tap on the map starts drawing. **Draw it** says what to do in one line under its heading, and its route style is a button like the toolbar's.
- After your first point, **✕** at the top right closes the planner, as in the start and its steps, where it said **Done**. On a phone the **✕** is a finger's size again: it had become smaller than the other buttons.

### A calmer planner: the sport, and what it changes ([#233](https://github.com/TommiContursi/Polku/issues/233))

The map's sport, each leg's sport and the sport of the legs you draw next are now kept apart, and changing one no longer quietly changes the others.

- From your first point, the drawing button names the sport of the next leg and its route style under the drawing mode, for example "Hike · Balanced". Where there's no room, the style is shortened and the sport stays whole.
- The drawing menu has the sport between the drawing modes and the route style. Pick a sport there for the legs you draw next: what you've drawn stays as it is, the map switches to that sport, and **Paddle** and **Swim** draw **Over water**. Under it is your speed in that sport, and **Change** opens your speeds right there; a change re-times your route. On a desktop the sport is a button on the toolbar, just before the route style.
- With a route drawn, picking another sport from the button beside the search asks what it's for. **The whole route** plans your route's legs again in the new sport, says how many routing calls that takes, and **Undo** brings back the route, its styles and the map's sport. **Only the legs you draw next** leaves the route as it is, and **Keep** changes nothing. A route on land can't be turned into a water route this way, and the menu says why. Each sport in the menu has a line on what the map shows for it, and the sports in your route are marked **your route**.
- Changing the map's sport no longer changes how your route is routed: the route keeps its own route style for each of its sports, after a reload and in a share link too ([#71](https://github.com/TommiContursi/Polku/issues/71)). Busy roads and road conditions are checked by each leg's own sport, and wherever the map is.
- A point you put on open water while drawing on land asks how you get there: **Paddle**, **Swim** or **Stay on land**, and in winter also over the ice (**Walk on the ice**, or ride or run). Paddle and Swim take the leg to the point over the water, keep the point where you tapped it and carry on in that sport. Over the ice the leg is a straight line, and Check says that **Polku can't see whether the ice holds**. Taps on a bridge, a ferry line or by the shore don't ask.
- **Draw it** says that you can change sport along the way, and **Go › Time** says which speeds the time is based on, with **Change**.
- At the start of a route, the sport has a row of its own under **Start a route**, saying what the map shows for it, so you see it before your first point. **✕** at the top right closes the planner, as the other panels' ✕ does, and replaces **Close**. On a desktop, the button that moves the planner is beside it there too.
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
