# Product

<!-- impeccable:product-schema 1 -->

What Polku is for and who it serves, for design work by people and coding agents. Written 2026-10-17 from the repo and the maker's answers; on 2026-10-18 the commitments to people were set apart from how Polku is built today, and the location principle became private by default, local first, not local only. How Polku works is in [docs/DEVELOPING.md](docs/DEVELOPING.md), what it does in [README.md](README.md) and [docs/USING.md](docs/USING.md), the rules for working on it in [AGENTS.md](AGENTS.md).

## Platform

web

## Users

Polku began as its maker's own tool for mountain biking, paddling and multi-sport trips. It's meant for outdoor people of every kind: in Finland first, in other countries later.

Two kinds of user count the same:
- **Someone opening Polku for the first time** understands it and starts planning without a tutorial.
- **An experienced planner** (S-grades, fairways, forecasts, route styles, overnight stops) finds the deep tools near at hand when they want them.

The same person is in different situations at different moments, and the situation, more than the device, decides what they need:
- planning a long or complex route at home, on a desktop;
- quickly checking a trail, its conditions or the weather;
- out on the trail on a phone: moving, a quick glance, one thumb, wet or cold hands, bright sun;
- looking back at a trip afterwards.

The sports: mountain biking, gravel and road cycling, hiking, trail running, running, paddling (sea kayak, canoe, SUP) and swimming, and trips that combine them. Skiing is planned (phase 15c).

## Product Purpose

One outdoor app for exploring, planning, navigating and recording, in place of a set of separate ones (Trailmap, Strava, Komoot, Windy.app, Orca and the National Land Survey's maps). Someone finds places and trails, plans a route, understands its terrain, weather and hazards, follows it outdoors, records the trip and looks back at it, and each step feels like part of the same app, not a tool bolted on.

**Where it stands (2026-10-17):** exploring and planning are built, and on the trail the heading and Follow me (23a). On the way (23b), your track (23c) and alerts on the way (23d) are planned; see [docs/ROADMAP.md](docs/ROADMAP.md).

**Success, a year on:** Polku feels mature and polished, people enjoy using it, trust it on real trips and come back to it. Success isn't counted in users or in features: it's being useful, trustworthy and a pleasure to use.

## Positioning

What Polku does that its neighbours don't do together:
- **One route, many sports:** each leg has its own sport, and the time counts the changeovers. Cycle to the shore, paddle across, run on an island.
- **The weather when you get there:** the forecast at the estimated time you reach each part of the route, with the wind changing the timing.
- **Water routes worked out in the browser:** wave estimates from open water upwind for each craft, shipping lanes crossed straight, mapped hazards kept clear, carries flagged.
- **Finland's open data in one map:** the National Land Survey's terrain maps, LIPAS routes and places, Väylävirasto fairways, Fintraffic road conditions and ships, FMI weather, radar and sea ice.
- **Uphill difficulty for every trail,** worked out from the terrain.
- **Free, with no account needed, and your data kept with you:** routes, settings and offline areas stay on your device, and nothing is sent that a request doesn't need.

## Operating Context

- **Desktop and phone needn't look the same.** A desktop can offer a denser, more advanced planning screen. A phone puts quick actions and what matters now first, for use outdoors. Both reach every feature, with controls and information arranged around what the person is doing at that moment.
- **Outdoors:** a bad network, battery, sunlight, gloves, movement. Save offline and Preview offline cover the map, terrain and route along it.
- **In the browser** at [polku.si](https://polku.si) today; on an iPhone, added to the home screen to keep offline data. Native apps aren't decided (#195).
- **Routes travel** as share links, GPX and KML imports, and GPX exports.
- **How it's built:** GitHub issues hold what to do, [docs/ROADMAP.md](docs/ROADMAP.md) the order of the phases, [docs/plans/](docs/plans/) their designs, [docs/plans/mockups/](docs/plans/mockups/) clickable mock-ups. Merging to `main` publishes the site.

## Capabilities and Constraints

**What it does:** the full list is in [README.md](README.md); the controls in [docs/USING.md](docs/USING.md); what changed, and when, in [CHANGELOG.md](CHANGELOG.md).

**Commitments that every design keeps** (the full rules are in [AGENTS.md](AGENTS.md)):
- **Free, with no account needed.** If accounts ever come (to sync between devices, say), they're optional, and nothing that works without one starts needing one.
- **Where you are, and where you've been, is yours:** private by default, local first, not local only.
  - Following you, On the way and recorded tracks work on your device. Nothing streams your position, sends it in the background or keeps a history of it anywhere else, unless you export, share or (one day) sync it.
  - A position goes out only for something you ask for that needs it, such as a route or a round trip from where you are: only as precise as that answer needs, once per request, and only to the service that answers. The control or its note says so in words, without a confirmation for every request.
  - Requests that only need a rough idea of where you are get a rounded point, never a precise one: nearby search and ships the map's middle to about a kilometre, the weather the nearest point of its forecast grid, about 3 km apart. Share links leave out the map's view.
  - Where it's practical, Polku works things out on your device instead, as it does water routes.
  - **Services of Polku's own** (the server that serves the app, a router or an API, if it ever has them) follow the same rules: they get only what a request needs, keep logs no longer than running them needs, build no history of you, and the README says what they keep.
- **Services are used within their terms,** and never overloaded.
- **Missing, late or partial data never looks complete.** When weather, terrain, trail details or hazards fail, the route says so.
- **Water routes are for planning, not navigation.** Traficom's depths are shown, never routed on.
- **Nothing Polku does is removed to make it simpler,** and nothing used today takes more taps, more scrolling or a new hidden view (phase 24's rules, [docs/plans/24-design-review.md](docs/plans/24-design-review.md)).
- **Saved routes, settings and share links use one current format.** When it changes, its readers, writers and tests change together, and old formats aren't kept only for compatibility (AGENTS.md). A route or link Polku can't read any more says so, and never opens as something else.
- **Languages:** English now; Finnish and Swedish planned (phase 18), so words must translate and leave room for longer ones.

**How it's built today.** These are decisions that serve the commitments above, a starting point rather than permanent requirements. Each is looked at again when a better way gives people enough to justify its cost:
- A static web app: `index.html`, plain ES modules, MapLibre GL JS from a CDN, served by GitHub Pages. No build step, no backend, no accounts.
- Free public services (BRouter with Valhalla standing in, Open-Meteo, Overpass, LIPAS, FMI, Digitraffic and others), so some answers come slowly or not at all. Water routes are worked out in the browser.
- One website for every device; offline areas in the browser's storage.
- **To change one** (a service of Polku's own, such as a weekly data build (#154), a token exchange (#188) or sync; native apps (#195); routing on the device (#279); a build step, a framework or a dependency): an issue that says what people gain and what it costs to build, run and maintain, and the maker's OK. Whatever changes keeps the commitments.

**Polku's words:** Plan; the planner's tabs Route, Check and Go; Heads-up and Avoid; Other ways; Round trip; Route style and How you go; Save offline and Preview offline; Follow me; On the way (planned); Layers and Settings; S0–S6 and ↑S0–↑S5 for difficulty.

**Code licensing:** Polku's original code is proprietary, with all rights reserved; see [LICENSE](LICENSE). Third-party rights are preserved in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The service is currently free; this source-code licence does not rule out future freemium or commercial use. Any future integration of copyleft code needs a compatibility check first (#279).

**Not decided yet:**
- which countries come after Finland, and when (#176);
- Strava and Garmin (phase 16, research first);
- native apps for iPhone and Android, and what they'd do that a web page can't, such as tracking with the screen off (#195);
- routing on the device, in the browser or in a native app (#279);
- a service of Polku's own, if one ever earns its cost.

## Brand Commitments

- **The name:** Polku, Finnish for "path"; the site is [polku.si](https://polku.si). An independent project by [@TommiContursi](https://github.com/TommiContursi).
- **The mark:** a dashed path in a rounded square, inline in `index.html` (logo and favicon).
- **The voice:** plain, short English, as in the CHANGELOG. It says what happens on the screen and what something means for you, and is honest about limits ("for planning, not navigation", "estimated", "didn't load").
- **Polku's own look, not a generic one:** the map first, plain words (phase 24's plan).
- **Visual quality matters:** Polku should look and feel thoughtfully designed and polished, and accessibility or depth never excuses less.

## Evidence on Hand

- **Screenshots:** the README's, on the `pr-screenshots` branch; any scene again with `tools/shoot.py`.
- **Measurements of the planner** (controls on screen, map in view, taps for common tasks) at 390 × 844 and 1440 × 900, in [docs/plans/24-design-review.md](docs/plans/24-design-review.md) (2026-10-16, at 2333453).
- **A benchmark:** notes on Strava's route builder, in the same plan.
- **A mock-up:** the quick layer drawer, [docs/plans/mockups/issue-123-layer-drawer.html](docs/plans/mockups/issue-123-layer-drawer.html), with its review in [docs/plans/issue-123-layer-drawer.md](docs/plans/issue-123-layer-drawer.md).
- **A code review:** [docs/reviews/2026-10-15/](docs/reviews/2026-10-15/README.md).
- **Recorded routes and data** for tests: `tools/fixtures/` (for example `route-kauppi-mtb.json`).
- **None of these exist, so never make them up:** testimonials, user numbers, usage data (Polku collects none, by design), press, ratings or reviews by users.

## Product Principles

1. **Complex things made intuitive, not removed.** Depth stays; it's arranged so that what's needed now is near and the rest is a step away.
2. **The moment decides, not the device.** Planning at home, a quick check, on the way, afterwards: each gets the controls and information it needs. Phone and desktop may differ in how, never in what's possible.
3. **Trust on a real trip.** Estimates say they're estimates, missing data says it's missing, and the limits are said plainly where they apply.
4. **One app, not a toolbox.** Finding, planning, going, recording and looking back lead into each other.
5. **Free, private and light.** No account needed, nothing sent that isn't needed, local first, easy on the battery and a bad network.

## Accessibility & Inclusion

- **WCAG 2.2 AA is the baseline,** built in from the start, not added afterwards.
- **Outdoors asks for more:** legible in bright sun, usable while moving, with wet or cold hands and at a glance. Controls in reach of one thumb, forgiving touch targets, the important numbers and warnings easy to read in hard conditions.
- **Keyboards, screen readers and enlarged text** work on phone and desktop alike, even where their patterns differ. What's done on the map has a practical alternative where possible.
- **Nothing essential depends on colour, a gesture or the map alone.** Route information is also said in words.
- **Polku follows the person's settings:** larger text, reduced motion, light or dark.
- **Light or dark is the person's choice:** Automatic follows the device and is the default; Light and Dark in Settings set it for Polku alone, on this device, and Match the map makes it dark over the aerial photos and the night map and light over the drawn maps.
- **Known gaps (2026-10-17):** the page blocks pinch-zoom (`user-scalable=no` in `index.html`), looked at in #73; the top bar may sit under a notch in a home-screen app (#134); taps flash and hover colours stay on phones (#208).
- The aim is an app that's comfortable and reliable for everyone, not one that only passes an audit.
