# Phase 23: out on the trail

The design. What's still to do, and its status, is on GitHub: [Phase 23b: on the way](https://github.com/TommiContursi/Polku/milestone/4) · [Phase 23c: your track](https://github.com/TommiContursi/Polku/milestone/7) · [Phase 23d: alerts on the way](https://github.com/TommiContursi/Polku/milestone/11), phase issues #180, #183, #187. The order of phases is in [ROADMAP](../ROADMAP.md).

Moved here verbatim from docs/ROADMAP.md on 2026-10-16 ([the last full ROADMAP](https://github.com/TommiContursi/Polku/blob/9bb3051e04aab1a11376f88445abba78f2946515/docs/ROADMAP.md)). 23a is built (#111); what was built stays here, as the ground 23b–23d build on.

## Phase 23 — Out on the trail: where you are and the way on (planned 2026-10-15)

*(The approach below was confirmed on 2026-10-15.)* Location in Polku today is a dot. On the trail it could do more: show which way you face, follow you, show how far along the route you are, and record where you went. All of it uses what the phone already has (its GPS and compass, through the browser) and no server.

**The rules:**
- **Your position stays on your device by default** (PRODUCT.md's location principle, revised 2026-10-18: private by default, local first, not local only). Following you, On the way and your track work on the device; nothing streams your position or sends it in the background, and a recorded track is yours to save, export or delete. A position goes out only for something you ask for, once: Route from here sends it to the routing service as the route's start, and says so.
- **It works offline** in areas saved with Save offline. Routing again (Route from here) needs a network until routing on the device exists (#279).
- **The browser's limits** (a native app might not have them, #195):
  - location needs HTTPS and your OK;
  - the compass needs a tap to allow it on iPhones;
  - a web page isn't tracked with the screen off, so On the way keeps the screen awake (Wake Lock) and says so;
  - Polku added to the home screen runs full screen.
- **Battery:** On the way asks for positions about once a second while it's on, and stops when you Stop or Pause.

**23a: which way you face (small).**
- The dot gets a cone for your heading: the compass when standing, the GPS's own course when moving (above about 1 m/s, where the compass in a pocket is unreliable).
- Its accuracy circle stays.
- A follow-me button keeps the map on you, north up or facing ahead.

**Built (23a), 2026-10-16** (`js/locate.js`, `js/heading.js`, `js/compass.js`; PR #111):
- **Polku watches the GPS itself** instead of MapLibre's geolocate control, so it can stop while the page is hidden, glide the dot between fixes and follow without resetting your zoom (MapLibre's zoomed back to 15 on every fix, and any zoom stopped it).
- **Locate goes off → following (north stays up) → facing ahead → off.** Facing ahead is the compass button's heading-up, so either button turns it on or off, and on a desktop (no compass) the second tap turns location off. Following stops on a pan or when something else moves the map elsewhere; zooming, pinching and turning keep it. After a pan Locate reads **Follow**.
- **The heading:** the compass when slower than 1 m/s (back below 0.7), the GPS's course above it, or a course worked out from 8 m of way when the GPS gives none. On Android, from the absolute orientation with the phone's tilt allowed for; on iOS, its own compass heading, asked for on the Locate tap. Both read magnetic north (#135).
- **Where the dot sits:** the middle of the map that the planner leaves free (its `viewPadding`). Facing ahead turns the map about the dot.
- **Battery:** the GPS at high accuracy, fixes up to a second old; the compass only while the cone or heading-up shows; frames only while the dot or the map is still moving; a small dead band before the map turns; nothing while hidden.
- **Privacy:** fixes stay in the page's memory. While location is on, `main.js` keeps no map view; share links drop the `#zoom/lat/lon`; search's bias and the ships query use the map's middle to two decimals. The smoke check feeds a GPS and a compass of its own and checks nothing it sends or stores has the fixes.

**23b: on the way.**
- **Start** in Go turns the drawer into On the way (see the mock-up). Your position is snapped to the route, only ever forwards, so a loop's crossings don't confuse it.
- **On the map and the profile:** the done part is grey, and your place is marked in the profile.
- **The numbers:** what's left (distance, time at your pace today, from how you've gone so far against the plan) and when you'll arrive.
- **The next heads-up ahead,** with how far ("In 600 m: log across the trail"), and the weather ahead ("light rain from 12:10").
- **Off the route:** about 40 m off for 20 s says by how much and where the route is, with "Route from here" (one routing call, which sends your position as the route's start and says so) to rejoin it.
- **Pause and Stop;** the screen stays awake while it's on.

**23c: your track.**
- Recorded while On the way runs: time, position, height and accuracy, kept on the device (IndexedDB).
- Shown on the map in its own colour.
- Saved as GPX.
- Compared with the plan (moving time, pace by surface), which can tune your speeds if you want.

**23d: alerts, and handing the route on (later).**
- **A buzz and a short sound** before a heads-up item and when off the route. Vibration works on Android, not on iPhones.
- **"Open in a navigation app":** the GPX through the phone's share sheet to OsmAnd, Organic Maps or the like, for turn-by-turn directions Polku won't do itself. BRouter can add turn hints to its GPX, worth a look then.
