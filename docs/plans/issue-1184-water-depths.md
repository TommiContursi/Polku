# Lake depths in water routing (#1184)

The water router keeps clear of marked rocks, shipping lanes and rough water, but it doesn't know how deep the water is. Syke's lake soundings are open (CC BY 4.0) and may be routed on, unlike Traficom's charted depths. This plan says what Syke's data can and can't tell a paddler, and asks three questions, each with one recommendation: where the depths come from at route time, what counts as shallow and what the router does about it, and how Polku says so.

## Where it stands

- **Plan, 2026-11-20.** Waiting for the user's answers to the three questions below. Nothing is built yet.

## What Syke's data is (checked 2026-11-20)

- **The licence.** The dataset's own record, [Järvien ja jokien luotauspisteet](https://ckan.ymparisto.fi/dataset/jarvien-ja-jokien-luotauspisteet), says the data is among Syke's open data (CC BY 4.0) and gives no access limits. So does [Järvien ja jokien syvyysaineisto](https://ckan.ymparisto.fi/dataset/jarvien-ja-jokien-syvyysaineisto), the depth areas and contours Syke makes from the soundings. Syke asks for the licensor and the data's name: "Source: Finnish Environment Institute (Syke), lake and river soundings".
- **What's in it.** 8.0 million soundings, measured by boat since 1998, each with a depth in metres. The depth is at each lake's own survey level (`luotaustaso`, Tuusulanjärvi's is N60 +37.74 m), not at today's water: a regulated lake can be half a metre or more lower in late summer or winter. The bulk download was last changed on 2017-03-20.
- **Where.** 1,922 lakes, parts of lakes and stretches of river: 693 of them over 1 km², 84 over 10 km². None of the sea. The large lakes with fairways are mostly missing: the tiles tried over Näsijärvi, Jyväsjärvi, Kallavesi, Oulujärvi, Pielinen, Inarijärvi, Vesijärvi and southern Päijänne had no soundings. Their depths are Traficom's, which Polku only shows.
- **How shallow it goes.** A survey boat seldom goes into the shallowest water: 33,812 soundings are under 0.5 m (0.4 %), in 801 of the lakes, and 7,910 under 0.3 m. So water with no shallow sounding isn't known to be deep: the shallows near the shore and between the survey lines weren't measured. Three lakes:

  | Lake | Soundings | Under 1 m | Under 0.5 m | Under 0.3 m |
  |---|---|---|---|---|
  | Tuusulanjärvi (5.9 km², 3.2 m deep on average) | 5,592 | 9 | 0 | 0 |
  | Hernejärvi (2.8 km², 2.3 m on average) | 9,627 | 4,487 | 1,874 | 558 |
  | Unari (29 km², 5.0 m on average) | 221,736 | 13,197 | 2,417 | 1,334 |

- **The depth areas and contours** go from 0–1.5 m to 1.5–3, 3–6 and 6–10 m: their shallowest class can't tell 0.3 m from 1.4 m.
- **Syke's services** answer any website (CORS): the soundings at `https://paikkatiedot.ymparisto.fi/geoserver/syke_luotauspisteet/wfs` (`syke_luotauspisteet:Luotauspiste`, field `syvyys_m`), the depth areas and contours at `https://paikkatiedot.ymparisto.fi/geoserver/inspire_el/wfs` (`EL.Syvyysalue`, `EL.ContourLine`, `EL.SpotElevation`), at most 10,000 features an answer. [Syke's interface page](https://www.syke.fi/fi/ymparistotieto/avoimet-rajapinnat/paikkatietorajapinnat) requires an application's own identifier for long-term or heavy use of its WFS, asked from Syke's GIS support.

## 1. Where the depths come from

| | How | Size and speed | When it fails | Costs |
|---|---|---|---|---|
| **A. Syke's WFS at route time** | Per tile: the shallow soundings, and Syke's depth areas to know where it surveyed | Shallow soundings 1–3 kB a tile in 0.1 s; the depth areas 300–800 kB a tile where Syke surveyed. A long leg's first route could load several MB | Not checked with Retry, as Väylävirasto and OpenStreetMap today | An identifier from Syke first (the user asks; Syke keeps the contact details). Every person's routes load Syke's server |
| **B. Polku's own depth files, made once from Syke's download** (recommended) | A script in `tools/` turns Syke's bulk files into one small file per tile: the shallow soundings, and where Syke surveyed (its depth areas, at about 50 m) | A few kB a tile, about 1–3 MB in all (an estimate: the build measures it), from polku.si itself | Not checked with Retry, as above; Syke being down doesn't matter | The script, run again only when Syke updates the data; the files in this repository |
| C. MML's background map tiles | The depth contours in the tiles Polku already loads | Already loaded on the map, at zoom 13–14 only | Not in offline areas; Polku's shared MML key (#1148) | Contour lines at 1.5, 3 and 6 m only, and the tiles mark them as MML's own (`aineistolahde` 1) even where Syke made them, so nothing tells surveyed water from water nobody surveyed |
| D. A product in `tools/osm_data` | As B, in the OSM build's release on its own host | As B | As B | The OSM build's protected publication for data that isn't OSM's |

**Recommended: B.** It is the only way that can say, along each leg, where Syke surveyed and where it didn't, without loading hundreds of kilobytes a tile on a phone; it puts no load on Syke and needs no identifier. Syke's data hasn't changed since 2017, so the files rarely need making again. It needs your OK under AGENTS.md's rule on build steps: the script runs by hand, the app stays a static site and reads plain files.

How B works at route time:

- The files are one per z10 tile, as Väylävirasto's fairways are (about 20 × 10 km), only where Syke surveyed, with an index of which tiles exist, so a leg over the sea or a large lake asks for nothing.
- They are read through `request()` (the `polku` source) and kept on the device in IndexedDB, as OSM's rocks are. A leg waits 2.5 s for them, as for the other water sources; a late answer routes the leg again.
- Offline: what has been loaded once stays. Offline areas don't save any of the water router's sources today; that stays as it is.
- Rejected on the way: Syke's map images drawn into the router's grid (its WMS ignores a style of Polku's own), and asking Syke how many soundings a tile has (a whole tile counts as surveyed when only a pond in it is).

## 2. What counts as shallow, and what the router does

A kayak or a canoe floats in about 0.2 m of water and a SUP's fin needs about 0.3 m. Syke's data can't tell those apart: few soundings go under 0.5 m, and the water may be lower than when it was surveyed. What it can show is where the survey boat found shallow ground, where stones are likely to lie nearer the surface between the soundings.

**Recommended:**

- **Shallow is a sounding under 0.5 m at the survey level,** the same for a kayak, a canoe and a SUP. At 1.0 m, half of Hernejärvi's soundings would count, water every paddler goes through.
- **The router keeps off shallow water where that's a small detour, and crosses it where there's no other way.** Water within 20 m of a shallow sounding costs four times as much to paddle through (a marked rock's keep-clear zone costs ten times as much), drawn into the grid the way keep-clear zones are. It's part of **Rocks & shoals: Keep clear**, so **Ignore** turns it off with the rest; no new setting.
- **Check says where the route still crosses it,** under Good to know, with its place on the route.
- **Swimming doesn't use it:** shallow water lets a swimmer stand.

The alternatives: 1.0 m (most of a shallow lake's shore counts), a number for each craft (the data can't tell 0.2 m from 0.3 m), only saying it in Check (the route doesn't change), or never routing through shallow water (a leg would carry over land rather than cross a shallow strait it can paddle).

## 3. How Polku says it

Water routes are for planning, not navigation (PRODUCT.md). The words never say the water is deep enough, clear or safe: no shallow sounding isn't deep water.

- **Check, Good to know:** "Shallow water, under 0.5 m when surveyed", with the note "Syke's lake soundings, at the lake's survey level: the water may be lower now, and stones can lie nearer the surface between the soundings". It can be hidden as "Shallow water". A round trip's card on the water says "shallow water" beside "near rocks".
- **What Polku looked at,** a row "Lake depths": "Syke's soundings" when all the route's water was surveyed, "Syke's soundings, for 2.1 of 6.4 km on the water" when part of it was, and "not surveyed where this route goes" when none was. The row "Depths: shown on the map, never used for routes" becomes "Sea depths: shown on the map, never used for routes (Traficom's licence)".
- **Not checked,** when the depth files didn't load, as for the other water sources: "Lake depths: didn't load", with Retry.
- **Route style, Rocks & shoals:** its text ends "Keeps off water Syke surveyed under 0.5 m deep, in the lakes it surveyed; elsewhere Polku doesn't know the depth, so keep a lookout." in place of "Polku doesn't know depths, so keep a lookout for the rest."
- **README:** the data sources table gains "Lake depths for routing | Syke's lake soundings (CC BY 4.0), about 1,900 lakes", beside Traficom's displayed depths; the bold note and the limits say the router uses lake depths only where Syke surveyed (none of the sea, few of the large lakes) and still can't see stones or today's water level.
- **CHANGELOG,** something like: "Paddling routes keep off water that Syke's lake soundings found under half a metre deep, where the way round is short, and Check says where a route still crosses it. Syke surveyed about 1,900 lakes and none of the sea, and its depths are at each lake's survey level, so the water may be lower: keep a lookout."
- **PRODUCT.md** keeps its line: Traficom's depths are shown, never routed on. **AGENTS.md** already allows Syke's data.

## What the build reaches

- `tools/syke_depths.py` (new) and `data/depths/` (its files).
- `js/waterdata.js`: the depth tiles beside OSM's rocks, in `waterInputs()`'s `want`, `missing` and `skipped`, `forgetWaterFailures()` and `prefetchWater()`; the header comment.
- `js/water.js`: the shallow zones and the surveyed water drawn in `rasteriseCosts()`, the cost in `astar()`, a `shallow` event and the surveyed length in `eventsAlong()`; the header comment.
- `js/planner.js`: `waterWarnings()`, the round trip's card, `lookedAt()`, and the source's name in Not checked and `answered('water')`.
- `js/styles.js` (Rocks & shoals), `js/net.js` (what the `polku` source loads), `tools/smoke.py` (a `water` check from a recorded depth file in `tools/fixtures/`, failing before and passing after, and the checks that read "never used for routes"), and the docs: README, USING, DEVELOPING's water routing section, CHANGELOG.
- Saved routes and share links keep their format: the depths are asked for at route time, like the rocks.

## Not in this part

- Traficom's depths at sea: an agreement with Traficom, the user's to ask for (#1184's comment of 2026-11-20).
- MML's stones in the water for the router (#153), and rapids (#856).
- Syke's soundings as a layer on the map.
