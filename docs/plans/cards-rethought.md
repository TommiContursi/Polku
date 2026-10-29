# #574: cards, rethought

The design. What's still to do, and its status, is on GitHub: [#574](https://github.com/TommiContursi/Polku/issues/574), which holds the user's decisions of 2026-10-29 and now includes #561, #562, #564 and #565.

**Where it stands (2026-10-29): a mock-up to choose from.** It decides nothing until the user chooses. Where #574's decisions don't cover a case, the mock-up shows it and asks ([Questions](#questions-for-you)). Nothing in the app changes yet.

## Why

Today a tap on a trail opens a big card with about three facts, while the small hover says more ("Path · ↑S2 13 % · unpaved"). Which facts show depends on the sport, so in Gravel an S3 trail's card leaves its grade out (#561). The card has many buttons at once, most of them not needed most of the time. A tap on a street or a long trail doesn't show what was picked. The map's other things (road works, sea marks, the water's depth) still open an older popup with its own look (#564), and road works' dates have no year (#565).

## The mock-up

[mockups/cards-rethought.html](mockups/cards-rethought.html), served at `/docs/plans/mockups/cards-rethought.html` from `python3 serve.py`. It's built on the app's own map, style, modules and data: the map is `js/style.js`'s, the controls `css/app.css`'s, the heights `js/dem.js`'s, the colours `js/chart.js`'s `colorAt()`, and every request goes through `request()` in `js/net.js`. The scenes are real places in Tampere, picked from OpenStreetMap on 2026-10-29.

- **On a Mac** (a window 1,000 px wide or more): the scenes and settings on the left, and **Today** and **New** side by side at the size you choose (Phone 390, Phone 360, 200 %, Desktop 1440 × 900). A tap in one frame is made in the other too, so the two stay side by side.
- **On an iPhone:** the Mac serves the folder to the network, and Safari opens the page. `serve.py` listens only on this computer, so use Python's own server from the folder that has this branch (`.claude/worktrees/561-card-facts` until #566 is merged, then the repository's own), with the Mac and the iPhone on the same Wi-Fi:

  ```bash
  python3 -m http.server 8807 --bind 0.0.0.0
  ```

  Then open `http://<the Mac's name>.local:8807/docs/plans/mockups/cards-rethought.html` on the iPhone (the name is in System Settings → General → Sharing → Local hostname). macOS may ask whether Python may accept connections: allow it. Over plain `http` on the network, Share and the clipboard don't work (the page isn't a secure context), and **Copy my choices** shows the text to copy instead.
- **When Overpass is busy:** the ways come from Overpass as the app asks it for a tap (three mirrors at once, `race`). When none answers in 25 s, the mock-up uses a recording of the scenes' ways made on 2026-10-29 (`cards-rethought-ways.json`, about 1 MB; the lake's and the park's outlines from Nominatim), and the card says so. `&rec=1` in the address uses the recording at once.
- **The bar** at the top: the scene (it opens the scenes, the moment, your sport, At a fork, the data and the buttons) and **Today · New**.
- **Today** is the spot's card as `main` builds it at the same spot: the same map features, `describe()` from `js/hover.js` and `spotNums()` from `js/facts.js`, as `planner.openSpotCard()` does; the old popup for road works. Trail details aren't loaded in the mock-up, so Today's line lacks their width and visibility words in MTB, Hike and Trail run.

### The scenes

| Scene | Where | What it shows |
|---|---|---|
| A trail with an MTB grade | An S3 path in Kauppi, in Gravel | The case #561 found: Today leaves the grade out. New: S3 in the line, the facts in groups, the profile. |
| A path with almost nothing mapped | A path in Kauppi tagged `highway=path` only | "Not mapped: surface, width, MTB grade, visibility." in one quiet line, with Not right? |
| A cycleway shared with walkers | Kauppi's lit cycleway, 21 tags | A lot mapped: lit, 3 m, fine gravel, a ski track in winter. |
| A cycleway separate from walkers | Asphalt, 4.5 m, lit | Bikes colour by "separate from walkers". |
| A street with cycle lanes | Erkkilänkatu | "Cycle lane" in the line; Bikes on the profile. |
| A long street in many pieces | Hämeenkatu | The name joins its pieces; the card says how many. |
| A street with two carriageways | Kalevantie | One name, two one-way sides: a question. |
| A named trail across kinds | Kuntokolmonen | The name joins cycleways and a track. |
| Unnamed paths in a forest | Kauppi | The rule for unnamed ways, and what a fork does. |
| A lake, a park | Iidesjärvi, Sorsapuisto | The outline drawn; the card's own facts. |
| A LIPAS place | Kauppi | A place from LIPAS as its own card. |
| A point on your route | The recorded Kauppi route (`tools/fixtures/route-kauppi-mtb.json`) | When you're there, how far along, the profile up to it. No routing. |
| Road works | Live from Fintraffic, the nearest in Tampere | The same card, with the years (#565). |
| The card's heights on a phone | Kauppi's cycleway | The line at the spot, then the card, then all of it. |
| Editing | The S3 path | A tap adds a point; a hold or a right-click opens the card with the actions. |

**Data** has four settings: Real; Worst case (a long Finnish name, every fact, six places at the spot); Nothing mapped (only the kind of way); and Sources fail (the weather, the heights and LIPAS don't answer, and each says so).

## What the mock-up shows, by #574's decisions

1. **One pick at a time.** A new tap replaces the pick; ✕ or Escape closes it.
2. **The pick drawn like a route:** a soft dark shadow, a white casing and its colours, so it reads apart from the red route. An area gets its outline. Road works and points get a ring or their own colour. The shadow and the outline's ink are new map colours (`#0b1220` and `#111827`), neither red nor blue.
3. **What one thing is:** pieces join when one ends where the next begins and they share a name; unnamed pieces join while their kind (path, footpath, cycleway, track, steps, street, road) stays the same. A footway that bikes may use counts as a cycleway. The card says how many pieces it joined ("1.2 km long, 15 pieces"). A long street loads the tiles its ends run into, up to sixteen, and stops at 25 km.
4. **The same facts for everyone.** Your sport changes Today's card and the map's trail colours, never the new card. **Colour by** remembers the last choice (in the browser) and starts at Grade.
5. **Browsing:** on a phone, a tap draws the pick and shows the line at the spot (its name or kind, and how you get along it). A tap on the line opens the card at the foot of the screen. On a desktop, the hover shows the same line at the pointer and draws the way under it plainly; a click pins it and opens the card at the spot (`card-float`, as today).
6. **The card:** its head (the pick's mark, its name or kind, the line, ✕); its length, up and down; a small profile coloured as the map, with Colour by's choices under it, only those it has data for, and the words for each colour with their lengths (never colour alone); the facts in groups (Getting along, Surface, Difficulty, Weather here now); "Not mapped: …" with Not right?; the places at the spot as their own rows. A fact that changes along the way says how much of each ("asphalt 800 m, sett 400 m") and how much isn't mapped. This answers #562: every way's tags are asked for, whatever the sport, so "Not mapped" means OpenStreetMap doesn't have it; when the ways didn't load, the card says that instead.
7. **Editing:** a tap adds a point. A hold (the app's ring, 500 ms) or a right-click opens the same card, with the actions under its profile.
8. **One model for everything you can tap:** a way, an area, a LIPAS place, a point on your route and road works all open the same card, in the same place.
9. **The buttons:** every button on today's cards (45, from `js/cards.js`, `js/card.js` and `js/inspect.js`), with what it does and when it's needed, each switchable between On the card, Long-press menu and Gone. Back, Fold and "You're not editing"'s Edit are listed but not drawn in the mock-up's card. The choice is in the address, so a link keeps it, and **Copy my choices** writes it as text for #574.

### The card's heights on a phone

The card opens at its first height: its head, its numbers, the profile, Colour by and its quiet row, never more than 62 % of the room under the bar. With a long name (three lines at 360 px) the quiet row falls below that height, a swipe away. A swipe up (or a tap on the grip) shows all of it, up to the top bar; a swipe down goes back, then to the line. Inside the card the facts scroll at the second height only.

### Motion

As DESIGN.md's Motion section says, reviewed with /emil-design-eng on 2026-10-29:
- **The line at the spot** fades in from 0.96 in `--t-open` (180 ms) on `--ease-out`, from the spot upwards, as a transition (`@starting-style`), so a quick second tap catches it mid-way. It shrinks to 97 % while pressed.
- **The card's sheet** slides up in `--t-sheet` (260 ms) on `--ease-drawer` and goes down in `--t-open`. Its heights change on the same curve. A drag on its grip follows the finger; a flick (0.11 px/ms or faster) counts as a swipe however short.
- **The desktop's card** grows from 0.97 at the corner nearest its spot, in `--t-open`.
- **The pick on the map** has no motion: picking happens many times a day.
- **With reduced motion,** each of them only fades.

### New controls (proposed, not yet in DEVELOPING's Shared controls)

- **The line at the spot** (`cr-line`): the hover's words as a 44 px button above the spot's pin.
- **The card's sheet** (`cr-sheet`): the card at the foot of the screen, with the sheet's grip and its two heights.
- **The small profile** (`cr-prof`) and **Colour by on a card** (`way-chips` with `chip`, the shared chips), with its words (`cr-legend`).
- **Not mapped** (`cr-unmapped`): one quiet line, Not right? at its end.
- **Its CSS:** the mock-up links `css/app.css` instead of copying the controls it uses into a marked block, as DEVELOPING's "Shared controls" asks, because it runs the app's own modules: its look follows `app.css` until the build. The new controls' CSS is its own marked block at the top of the page.
- **Two new colour scales:** Bikes (separate from walkers, shared with walkers, cycleway, cycle lane, cycle track beside it, cycleway alongside, on a trail, for walkers, with traffic, no bikes) and Lit (lit, not lit, not mapped). Their colours are a first proposal.

## Questions for you

These are cases #574 doesn't decide. Each is in the mock-up to try.

1. **At a fork:** where a piece meets two or more that continue it with the same name (or kind), which way does the pick go? **Straight on** (the least turn; the mock-up's start), **Every branch** (drawn, the profile following the straightest), or **Stop** at the fork.
2. **Two carriageways:** Kalevantie joins 32 pieces into 3.06 km, but only the side that was tapped: its two one-way sides seldom share an end. Is the street one thing, both sides?
3. **A side street with the same name:** Finnish streets often branch under one name (a -tie with its spurs). At a T, the branch isn't a continuation, so it's left out. Is that right?
4. **A name on some pieces only:** Kuntokolmonen is named on 9 pieces, but unnamed ones sit between them, so the pick joins only 2. OpenStreetMap often keeps a trail's name on a route relation instead. Should a pick follow a route it's part of, when there is one?
5. **Roundabouts and loops:** a way that comes back to where it began stops there.
6. **Long roads:** a named road joins until 25 km, or until the tiles stop loading. Should a pick stop sooner, at a town's edge or where the road's number changes?
7. **Unnamed paths in a forest:** joining while the kind stays the same turns a network of paths into one long pick. Try Unnamed paths in a forest with each At a fork. Should unnamed paths stop at every junction instead?
8. **Colour by Difficulty** colours by the MTB grade where there is one, else by the hiking (SAC) grade. Two choices, MTB and Hiking, would say it more plainly.
9. **The desktop's hover** draws the way under the pointer plainly, before a click. Keep it, or the line only?
10. **The buttons:** where each goes (the panel). The mock-up starts with the route's actions (Add to my route, Start here, End here, Round trip from here, Avoid this spot) in the long-press menu: while browsing they're a hold away, where today they're on the card. PRODUCT.md asks that nothing used today takes more taps or a new hidden view; a hold isn't a tap more, but it is hidden. What's here › starts as Gone, as its facts are on the card now.

## What building it costs

- **Ways for every tap.** The trail details load only trails (`js/trails.js`). A card for any way needs every way's tags: one Overpass query per tile, cached a week, as the trail details are. On 2026-10-29 a z13 tile of every way in central Tampere timed out on the public mirrors, so the mock-up asks z14 tiles (a quarter of the area). A long street loads the tiles its ends reach. Overpass is the slowest and least reliable of Polku's sources; the card shows the tile's own facts at once and fills in as the ways come.
- **The tap's spot** goes to Overpass for an area's outline (`is_in`), as Not right? and All OpenStreetMap details already do. It isn't your position. The weather here asks the forecast grid's point, never the spot.
- **What it changes in the app:** `js/cards.js` (one card), `js/card.js` (the sheet and its heights), `js/facts.js` (the facts in groups, by length along the way), `js/hover.js` (the same line), `js/inspect.js` (the old popups go), `js/planner.js` (taps and holds), `js/style.js` (the pick's layers), `js/chart.js` (Bikes and Lit), `css/app.css`, and `tools/smoke.py`'s `spotcard`, `facts`, `routecard` and `crosshair` groups, with new ones for the join and the old popups.
- **Its checks:** the join on recorded ways (`tools/fixtures/`), the heights at 360 px and 200 %, keyboard and screen reader (the card's grip is a button; the line at the spot is one), missing and late data, and a phone in the sun.

## Checked

On 2026-10-29, in headless Chrome through `tools/cdp.py` (light, reduced motion, touch on the phone sizes), with a script that opens each scene, opens its card at both heights, and measures it:
- **390 × 844:** all 16 scenes, on real data. **360 × 740 and 200 %** (195 × 422 at twice the size): 8 scenes each, on real data and the worst case. **390:** nothing mapped and the sources failing. **1440 × 900:** 4 scenes, at the card's spot.
- **What it measured:** nothing runs out of its card, the card stays below the bar and on the screen, and the controls on a phone's card are 44 px or more.
- **What it found, fixed in the mock-up:** at 200 % the bar squeezed the scene's name to one letter (it now wraps, and the card stays below it), and the point card's note couldn't wrap.
- **Found in the app:** #576. A bridge dips to the water in a profile; Hämeenkatu's card shows it at Hämeensilta ("steep up" on a flat street), and so would a route's.
- **Also seen:** the lake's tap landed by its shore (now at its deepest point); a LIPAS scene with LIPAS failing picked the path under it (it now says LIPAS didn't answer); the desktop's card took the focus on a click (no longer).
- **In the browser pane:** the trail scene at 390, light and dark, by taps on the line and the card; Today's card for the same spot (#561's case: no grade in Gravel).
- **Not checked:** a real iPhone and a hold by touch; dark mode beyond the pane's own; most scenes on live Overpass: it timed out much of the day, so the measurements ran on the recording. The S3 trail and Hämeenkatu also ran live, in the browser pane.

## Left out

- Building it in the app.
- The planner's sheet and its stops (#233), and following the route along the profile (#508).
- The trail details' own layer (width and visibility drawn on the map), in the mock-up's Today.
- Sea marks, the water's depth and busy roads: they open the same card as road works; the mock-up shows road works.
- A real hold's feel on a phone: try it on the iPhone.
