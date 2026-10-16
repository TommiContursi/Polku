# #123: a quick layer drawer

The design. What's still to do, and its status, is on GitHub: [#123](https://github.com/TommiContursi/Polku/issues/123), in the milestone [Phase 24: design review](https://github.com/TommiContursi/Polku/milestone/1). The order of phases is in [ROADMAP](../ROADMAP.md).

Planned 2026-10-16: a mock-up and this plan first, reviewed with design skills for coding agents, then the user's answers to its four questions (below). Nothing built yet.

## Why

Changing the map quickly (another base map, or one layer such as terrain or trails) means opening the full Layers panel: 11 groups and 37 switches, about 2,300 px of scrolling at 1440 × 900 (measured at 5d3470c). On a phone the panel covers most of the map, and the base maps come only after the "On now" chips. An idea from testing (2026-10-16): a quick drawer first, like Google Maps' layer chooser.

## The mock-up

- **In the repo:** [mockups/issue-123-layer-drawer.html](mockups/issue-123-layer-drawer.html). Not wired to the app; open it from `python3 serve.py` at `/docs/plans/mockups/issue-123-layer-drawer.html`. It's clickable: maps, tiles, a tile's ›, Edit, More, ✕ and Layers work, and the phone sheets follow a swipe. `?frame=<id>` shows one frame at full size, `&w=360&h=740` at another size, `?data=worst` with the worst case (Finnish, an MML key, a dozen more on). The map pictures are on the `pr-screenshots` branch.
- **The same mock-up as a private page,** like 22a's canvas, with its pictures inside, so it opens on a phone: https://claude.ai/artifact/BkPy7oGi6r77kLJmt5qMzh

## Decided (2026-10-16)

- **The tiles follow the sport,** five and More. A tile that holds more than one setting has a › side that opens them, so they're easy to reach.
- **You can choose your own tiles** (Edit), and reset them to the sport's.
- **A sheet on a phone,** closed with a swipe, with the same swipe as every other sheet (the planner's, #96). The edit view's Done goes to the bottom, in thumb reach.
- **More opens the full panel as it is.** Regrouping it waits for phase 21, with #119 (Ships under Water) and #121 (places by kind).

## The drawer

- **Layers (and L) opens the drawer,** not the full panel. More opens the full panel.
- **Map:** the base maps as thumbnails, three to a row: Trail map, Maastokartta, Aerial, Aerial FI, Plain, Night. With an MML key, MML WMTS takes Maastokartta's place while it's the map you have on, so there are always six (a seventh left a row of one and grew the sheet to 72–82 % of a phone).
- **On the map:** five tiles for your sport, two to a row, and More, which says how many other layers are on ("3 more on"), so nothing on is hidden.
  - A tile turns the same switch (or switches) as in the full panel.
  - A tile with more settings (trail colours, depths, rain, temperature, 3D) has a › side, its own 44 px button: it opens those settings in the drawer, one step in, with ‹ back. They're the same switches as the tile's group in the full panel. The step in keeps the sheet's height.
- **Phone (under 720 px wide):** a sheet from the bottom, over the planner's peek, which comes back as it was. About half a 390 × 844 screen (56 %), 66 % of a 360 × 740 one; never taller than the room below the top bar (its body scrolls, the header with ✕ stays).
- **Desktop:** a card beside the Layers button, its bottom level with the button's, where today's panel opens. In a window under 560 px high it reaches down to the bottom, like today's panel.
- **Closing:** ✕, Esc, Layers again; on a phone also a swipe down, or a tap on the map. That tap does nothing else (no waypoint while planning). On a desktop the card stays while you use the map, like today's panel.
- **Status on the tile, not in a toast** (a toast would sit behind the sheet): "Zoom in to see" while its layer doesn't show at this zoom; "No data now" when its source fails. Missing data never looks complete.

## The tiles per sport

› marks a tile with more settings. **Bold** tiles are on by default (the sport's `ACTIVITY_OVERLAYS` and trail defaults today).

| Sport | The five tiles | More on by default |
|---|---|---|
| MTB | **Trail colours** ›, **Trail details**, **Official routes**, 3D terrain ›, Rain radar › | 3 |
| Gravel | **Busy roads**, **Road works**, Paved roads, Waymarked cycling, Rain radar › | 4 |
| Road | **Busy roads**, **Road works**, **Road conditions**, **Waymarked cycling**, Wind | 2 |
| Hike | **Waymarked hiking**, **Official routes**, **Huts & lean-tos**, **Trail details**, Rain radar › | 2 |
| Trail run | Trail colours ›, **Trail details**, **Official routes**, **Huts & lean-tos**, Rain radar › | 2 |
| Run | **Official routes**, **Road works**, Outdoor places, Temperature ›, Rain radar › | 0 |
| Paddle | **Nautical marks**, **Depths** ›, **Ships**, **Landing sites & lean-tos**, Wind | 4 |
| Swim | **Depths** ›, **Shipping lanes**, **Ships**, **Beaches & swimming places**, Wind | 2 |

- **What each turns:** one switch each, as in the full panel, except three. **Trail colours** is `trailColors` off, or back to the colours you last had for that sport (Difficulty for MTB, Uphill for trail run). **Depths** is Traficom's depth areas, contours and soundings together: on while any is on; off turns all three off, on brings back the ones you had. **Huts & lean-tos** (and the landing sites, beaches) is LIPAS points, named for the sport.
- **Depths say "not for navigation"** on the tile: Traficom's data is shown, never routed on.
- **In winter** (Polku's winter on), the sport's own five swap the weather tile for Winter ways on land and Sea ice on water. Tiles you chose yourself aren't changed.

## Your own tiles

- **Edit** sits beside the tiles' heading. In it, a tap on a tile takes it off and a chip adds one: any switch in the full panel. Five per sport.
- **Reset to MTB's tiles** and **Done** sit at the bottom, in thumb reach; a swipe down is Done too.
- **Two resets, kept apart:** "Reset to MTB's tiles" (which tiles) is in Edit; "Reset to MTB defaults" (which layers are on) stays in the full panel, as today.
- Changing the order of the tiles: later, if wanted (drag in Edit).

## One swipe for every sheet (with #96)

Today the planner's sheet follows the finger by changing its height, only from its handle and the gaps between its buttons, and snaps by position alone (`bindSheet()`, `js/planner.js:3331-3366`). #96 asks for flicks and for dragging from the body. The drawer needs the same gesture, so it's built once, as `js/sheet.js`, with whichever of #96 and #123 comes first, and both sheets use it. Checked with the design skills (2026-10-16), and tried in the mock-up:

- **Where:** the handle and the header (also over its buttons: a drag that starts on a button becomes a drag, and a tap stays a tap), and the body when it's scrolled to the top and you drag down. On iOS that last one needs a `touchmove` listener that isn't passive, because iOS has no `touch-action: pan-down`.
- **Follows the finger 1:1** from where you grabbed it, after about 10 px, with `transform` (not the height). The planner's `--sheet-h`, which the map's buttons follow, changes once, at the end.
- **On release it aims for where a flick would come to rest** (Apple's projection, deceleration 0.998), and goes to the size nearest that. A quick flick (about 1 px/ms or more) moves one size in its direction, whatever the distance.
- **Past the first or last size it resists** (rubber-banding), instead of stopping dead.
- **It settles with a spring** (damping about 0.85, response 0.3 s), starting at the finger's speed, and can be grabbed again mid-way.
- **Sizes:** the drawer has closed, quick and all layers (a swipe up is More); the planner keeps peek, profile, half and full. Whether a swipe below the peek closes the planner is #96's to decide.
- **A second finger is ignored;** the pointer is captured, so the drag goes on outside the sheet.
- **Reduced motion:** the sheet still follows the finger, but sizes change without travel (a short fade).
- **Starting values,** to tune on a real phone (iOS and Android): the browser's device emulation can't show how a swipe feels.

## Motion

- **Phone:** the sheet slides up in 260 ms (`cubic-bezier(0.32, 0.72, 0, 1)`) and down in 180 ms.
- **Desktop:** the card grows from the button (scale 0.96 and fade, origin at the button), 160 ms in and 120 ms out.
- **L opens it at once,** with no animation: nothing animates for the keyboard.
- **A step in or out** (a tile's settings, Edit, More) slides 28 px and fades, 220 ms.
- **A press** scales a tile to 0.97 in 120 ms.
- **Reduced motion:** fades only. **Reduced transparency:** a solid background.

## Touch, keyboard and screen readers

- **Every target is 44 px or more,** measured in the mock-up at 390 × 844, 360 × 740, 1440 × 900, 1280 × 600 and a 390 phone at 200 % zoom.
- **A press answers when the finger lands** (`:active`). Hover shows only with a mouse. No grey flash and no text selection on a tap. #208 does the same for the rest of Polku.
- **Clear of the home indicator:** the sheet's bottom padding adds `env(safe-area-inset-bottom)`. The top bar's notch is #134.
- **Keyboard:**
  - L opens the drawer with focus on the chosen map.
  - The maps are one radio group: the arrow keys move and choose.
  - Tab goes on to the tiles, their ›, Edit and More.
  - Esc steps back, then closes, with focus back on Layers.
- **Screen readers:**
  - The drawer is a dialog labelled "Map layers", modal on a phone and not on a desktop, like today's panel.
  - The maps are radios.
  - A tile is a toggle with its label and small print ("Trail colours, Difficulty, pressed"); its › is "Trail colours: settings".
  - More says "More: all layers, 3 more on".
- **"On" is said by a check and a thicker border,** not by colour alone. Text is at least 4.5:1: an "on" tile's label is 5.25:1 in light and 4.9:1 in dark.
- **Long labels (phase 18 brings Finnish and Swedish):** the drawer has its `lang`, so words hyphenate, and a word breaks rather than overflows. At 200 % zoom the maps go to two columns and the tiles to one (a container query).

## How it remembers

- **The tiles change the same state as the full panel,** so nothing new is stored for them:
  - layers per sport (`overlaysByActivity`, through `setOverlay`);
  - trail colours and details per sport (`trailsByActivity`, through `setTrail`);
  - hillshade, contours, 3D and the weather fields, for all sports, as today.
- **New in settings:**
  - `quickTiles`: your own tiles, per sport, only for sports you've edited;
  - in `trailsByActivity`, the colours to bring back when the Trail colours tile is turned on again.
- **Old settings** have neither, so they get the sport's tiles and its default colours. A tile id this version doesn't know is skipped.
- **Share links and saved routes** don't carry layers: nothing changes for them.

## What changes, in the build

- `index.html`: the drawer's element beside `#layers-panel`; Layers gets `aria-controls` and `aria-expanded` for it.
- `js/config.js`: the tiles per sport (`QUICK_TILES`) and what each tile turns, beside `ACTIVITY_OVERLAYS`.
- `js/main.js`:
  - `renderQuickLayers()`, beside `renderLayersPanel()`, reusing `setOverlay`, `setTrail`, `set3d`, `setWeather`, `BASES` and `thumb()`;
  - `openPanel()` learns the drawer and its steps (a tile's settings, Edit, all layers);
  - L, Esc, the map tap that closes it;
  - `quickTiles`, the tiles' status.
- `js/sheet.js` (new): the one swipe, used by `js/planner.js` (`bindSheet()`) and the drawer.
- `css/app.css`: the drawer, its tiles and steps, sheet and card, motion, reduced motion and transparency.
- `img/base/`: thumbnails at 240 × 160 for the bigger tiles (today's are 128 × 128), and Aerial's own (today it shares Aerial FI's). The service worker keeps same-origin files once seen, so the drawer loads them when the app is idle, to have them offline.
- `tools/smoke.py`: a `quick` group (below). `tools/shoot.py`: scenes for the drawer, its steps and Edit, at both sizes.
- Docs:
  - `docs/USING.md`: Layers and the L key;
  - `README.md` if it describes Layers;
  - the CHANGELOG;
  - `docs/DEVELOPING.md`: the layers section and `js/sheet.js`.

## Smoke checks (`tools/smoke.py quick`)

- **Opening and closing:** Layers and L open the drawer, not the full panel. Esc closes it with focus back on Layers; Layers again closes it.
- **The base maps:** a thumbnail changes the base map and the Layers button's picture, and the drawer stays open. An MML key with MML WMTS on still shows six maps.
- **The tiles:**
  - Each tile, in every sport, turns the same state as its switch in the full panel, both ways (the panel shows it; turning it off there un-presses the tile).
  - It's remembered per sport after a reload. Switching sport changes the tiles.
  - Trail colours brings back the sport's last colours. Depths turns its three switches together. More's count matches what else is on.
- **A tile's settings:** › opens them, ‹ comes back, and the sheet keeps its height.
- **Edit:** take a tile off and add one; kept after a reload; "Reset to MTB's tiles" restores the five. Old settings without `quickTiles` load with the sport's tiles.
- **More:** it opens the full panel, unchanged, and ‹ comes back.
- **The swipe** (touch events through CDP at 390 × 844):
  - a drag down on the header closes the drawer;
  - a short slow drag springs back;
  - a flick closes it;
  - a drag up opens all layers;
  - a tap on a tile still toggles it;
  - the planner's sheet changes size by the same gestures (#96).
- **Phone (390 × 844 and 360 × 740):**
  - the sheet fits below the top bar, and every target is 44 px or more;
  - with the planner at peek, the peek is back as it was after closing;
  - the tap on the map that closes it adds no point.
- **Desktop:** at 1440 × 900 and 1280 × 600 the card sits beside the button, within the map and clear of the side panel; with the bottom panel, above it.
- **Status:** a tile turned on below its zoom says "Zoom in to see"; a tile whose source fails says so.

## How it fits phase 24's review

#123 is in phase 24's milestone, so that the review can decide the drawer's design before it's built:

- **The mock-up is where the review starts its "Settings and the layers" flow.** It's in the repo, so the review can change it and screenshot any frame at any size. The skills used here (emil-design-eng, apple-design, mobile-native, break-ui) are Emil Kowalski's, which the review lists.
- **Left to tune with the review:**
  - the sheet's height on small phones (66–74 % at 360 × 740, with Finnish);
  - short Finnish words that still break at 360 px beside a › ("Sadetut-ka");
  - the swipe's numbers, on real phones;
  - which switches Edit offers.
- **Close neighbours in the review:** #96 (the same swipe), #208 (tap and hover on phones), #73 (zoom and enlarged text), #134 (the notch).
- **The build** is its own PR after the review, "Fixes #123".

## The design review of the mock-up (2026-10-16)

Done with the skills above, at 390 × 844, 360 × 740, 1440 × 900, 1280 × 600, 844 × 390 and a 390 phone at 200 % zoom, with the demo data and the worst case:

| Found | What changed |
|---|---|
| At 200 % zoom the sheet ran off the top: no ✕, labels overlapping | A height limit below the top bar, a body that scrolls, fewer columns when narrow |
| In a 1280 × 600 window or a phone on its side, the desktop card ran past the top | A height limit; under 560 px high it reaches down to the bottom |
| A Finnish word (Rantautumispaikat) overflowed its tile at 360 px | Hyphenation with `lang`, and breaking anywhere rather than overflowing |
| A seventh map (MML key) left a row of one | MML WMTS takes Maastokartta's place |
| An "on" tile's small print was 3.9:1 | Full colour: 5.25:1 |
| Edit's Done (34 px), its link (26 px) and the chips (36 px) were under 44 px | 44 px or more |
| A toast ("Zoom in…") would sit behind the sheet | The tile says it |
| The card on a phone (the alternative) overflowed with Finnish and covered 78 % | The sheet, as decided |

Found for the rest of Polku: #208. Already covered elsewhere: #73 (zoom is turned off for the page), #134 (no safe-area padding).

## Not in it

- New layers or data sources, or network calls: the drawer only turns switches that exist.
- Changes to the full panel beyond the way back from it. Regrouping it is for phase 21, with #119 and #121.
- Share links and saved routes: unchanged.
