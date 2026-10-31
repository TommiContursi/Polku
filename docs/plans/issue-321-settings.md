# Settings: one place for Polku's preferences (#321)

A proposal for the user to choose from, 2026-10-31, on `main` at 349971f. The mock-up,
[issue-321-settings.html](mockups/issue-321-settings.html), shows today's panel beside two layouts, on a phone
and a desktop, light and dark. It covers #321's layout question for the
[Settings and accessibility](https://github.com/TommiContursi/Polku/milestone/17) milestone and gives each of
its planned settings a place.

**Chosen 2026-10-31: B, folding groups.** Built in one PR the same day; see "What was built" at the end. Distance marks are in both Settings and Layers (decision 2).

## What's wrong today

- **The order.** About Polku comes first, then eight sport rows. On a phone the panel is 62 % of the screen and
  about 2,000 px long, so Display starts a screen and a half down.
- **Preferences live elsewhere.** 3D
  height is under 3D terrain in Layers, the Heads-up kinds you've hidden only show at the end of Check, and the
  quick tiles per sport can only be changed from the drawer's Edit. Recent searches can't be cleared at all.
- **No room to grow.** The milestone plans about twelve settings (#143, #199, #282, #324–#332) and none has a
  place yet.

## What moves, and what stays

Settings holds how Polku behaves. The map's choices stay in Layers, and the route's in the planner (#321).

| Preference | Where it is today | Proposal |
|---|---|---|
| Speeds per sport, paddle craft | Settings, and the planner's How you go | Settings → Speeds and tiles by sport (both stay, #87) |
| The five quick tiles per sport | The Layers drawer's Edit | Also in Speeds and tiles by sport, a sport's row; the drawer keeps Edit |
| Appearance, High contrast | Settings → Display | Stay |
| Moving arrows on the route | Settings → Display | → Route arrows and marks; also in Layers › Your route |
| Distance marks, arrival times, elapsed time | Layers › Your route (since #424; the proposal had them in Check) | Also in Route arrows and marks; Layers keeps them |
| Details on hover, Trackpad rotates & tilts | Settings → Display | → Map and planner |
| 3D height (exaggeration) | Layers, under 3D terrain | Also in Map and planner; Layers keeps it, with 3D on or off |
| The planner's place (desktop) | Settings, the planner's button and ⋯ | Map and planner; the planner keeps its button |
| Heads-up kinds you've hidden | The end of Check | Also Settings → Hidden Heads-up (#143); Check keeps its list |
| Recent searches | Search, kept with no way to clear | Settings → Saved on this device: Clear (new, small) |
| Routing server, MML key | Settings, their own sections | Inside Data sources |
| What's new | Settings, first | About Polku, last |
| Winter: Auto, On, Off | Layers → Winter | Stays: it only decides what Winter's layers show |
| Route colours on the map | Check and the profile | Stay: chosen while reading the profile |
| Route style per sport | The planner's How you go | Stays (#321) |
| Base map, overlays, trail colours, 3D, timeline, weather layers | Layers | Stay: the map's choices |
| Panel width, sheet height, open sections, last view, tab | Remembered without asking | Not settings. Reset (#332) clears them, and When Polku opens (#329) decides the view |

## The groups, in order

1. **Speeds and tiles by sport:** each sport's speeds and its five Layers tiles.
2. **Display:** Appearance, High contrast; planned: text and buttons as Smaller, Standard or Larger (#325;
   Smaller is new, for a denser desktop), colours for colour blindness (#324), less motion (#327), fewer
   effects (#330).
3. **Language and units:** planned: language, Automatic (the device's), English, Suomi or Svenska (#184), and
   units (#326).
4. **Route arrows and marks:** moving arrows, distance marks, arrival and elapsed times, the same switches
   as Layers' Your route; planned: trails show through the route (#199).
5. **Map and planner:** a row that opens Layers (the base map, trails, 3D, the timeline and weather on the map
   stay there, and this is where someone looking for them in Settings finds the way), 3D height, details on hover, trackpad, the planner's place on a desktop; planned: turning
   the map with two fingers (#328), when Polku opens, where you left off or a fresh start (#329), keeping the screen on (#331).
6. **Hidden Heads-up:** each hidden kind with Show again (#143).
7. **Offline maps:** as today.
8. **Saved on this device:** what Polku keeps here, Clear recent searches; planned: export and import (#282), reset
   settings (#332).
9. **Strava and Garmin:** planned (#188): connect each, optional, with what it's for. Not a button of its own
   beside ⚙: it's set up once, and the top bar has no room on a phone. Where they're used (send a route to
   Garmin in Go › Take it along, your Strava history in Layers) gets its own entry when it's built.
10. **Data sources:** the services' use, then the routing server and the MML key.
11. **About Polku:** What's new; planned: how to use, credits and licence (#321).

Most used first, the technical ones near the end, and About last, where every settings screen keeps it. Saved
routes (#157) and help (#114, #189) stay in their own work; Settings may link to them. Search (#333) comes
last, once these names settle.

**Planned settings ship greyed, marked Coming** (the user's choice, 2026-10-31): the control as it will be,
disabled and grey the way the app greys a switch it can't use now (`.tg.off`, `.seg button:disabled`),
with a Coming tag beside its name so a screen reader says why. Each issue then makes its control work. Every new row is Polku's plain row (`row` in `rows`, with `val`), its
tag the inline `cur`. The
mock-up's Planned switch shows them greyed or as they'll work.

## Two layouts

- **A: one list.** Today's single scroll with these groups. Nothing folds, so nothing takes a tap more than
  today. It grows to about 3,400 px with every planned setting.
- **B: folding groups (chosen).** The same groups as Layers' folding groups (`.lg-group`, the same
  control). Settings opens on the list of eleven names, which fits one phone screen, and each group stays open
  or folded as you leave it. Every setting is then one tap away the first time, where today it's a scroll.

B is recommended because the list only grows, and Layers already teaches the control. It costs one tap the
first time, which PRODUCT.md's "no more taps" rule weighs against A's scrolling; that trade is the user's call.

## Decisions for the user

1. A or B: **B**, chosen 2026-10-31.
2. Distance marks: they had already moved from Check to Layers › Your route in #424. The user's rule (2026-10-31): a setting can be in two places, so it's found where people look for it. The marks and arrows are in both, and so is 3D height.
3. A Clear button for recent searches: yes.

## Building it

One PR for #321: `renderSettingsPanel()` in `js/main.js` regrouped into B's folding groups, the moves above,
`docs/USING.md`, the CHANGELOG and smoke checks in the groups the moves touch (`panels`, `marks`, `heads`,
`quick`, `appearance`). It starts once #603 and #610 are merged, since both change `js/main.js`,
`js/planner.js`, the CHANGELOG and `tools/smoke.py`. B adds no new motion: the folding is Layers' own. The
planned settings then land one issue at a time, each in its group.

## What was built (2026-10-31)

- `renderSettingsPanel()` in `js/main.js` builds the eleven groups above with `layerGroup()`, all folded the first time.
- Planned settings (#184, #188, #199, #282, #324–#332 and About's two rows) are their controls disabled, greyed by `.coming` and tagged Coming.
- A sport's speed row also lists its quick tiles; its Edit opens the drawer's editor for that sport (`quickStep('edit', sport)`).
- Two places, one control: 3D height (`heightRange()`) in Map and planner and under Layers' 3D terrain; the arrows (`arrowsToggle()`) and marks (`planner.marksSwitches()`) in Route arrows and marks and Layers' Your route.
- Hidden Heads-up lists `hiddenKinds()` with Show again (#143); Check keeps its list.
- Saved on this device: recent searches' count and Clear.
- `tools/smoke.py settings` checks the groups, Coming, Show again, Clear, 3D height, the open groups over a reload and Edit for another sport, at 390 × 844; the groups the change touched open Settings' groups first.
