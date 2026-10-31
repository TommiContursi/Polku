# Settings: one place for Polku's preferences (#321)

A proposal for the user to choose from, 2026-10-31, on `main` at 349971f. The mock-up,
[issue-321-settings.html](mockups/issue-321-settings.html), shows today's panel beside two layouts, on a phone
and a desktop, light and dark. It covers #321's layout question for the
[Settings and accessibility](https://github.com/TommiContursi/Polku/milestone/17) milestone and gives each of
its planned settings a place. No app code until the user picks.

## What's wrong today

- **The order.** About Polku comes first, then eight sport rows. On a phone the panel is 62 % of the screen and
  about 2,000 px long, so Display starts a screen and a half down.
- **Preferences live elsewhere.** Distance marks and their times are in the planner's Check › On the map, 3D
  height is under 3D terrain in Layers, the Heads-up kinds you've hidden only show at the end of Check, and the
  quick tiles per sport can only be changed from the drawer's Edit. Recent searches can't be cleared at all.
- **No room to grow.** The milestone plans about twelve settings (#143, #199, #282, #324–#332) and none has a
  place yet.

## What moves, and what stays

Settings holds how Polku behaves. The map's choices stay in Layers, and the route's in the planner (#321).

| Preference | Where it is today | Proposal |
|---|---|---|
| Speeds per sport, paddle craft | Settings, and the planner's How you go | Settings → Your sports (both stay, #87) |
| The five quick tiles per sport | The Layers drawer's Edit | Also in Your sports, a sport's row; the drawer keeps Edit |
| Appearance, High contrast | Settings → Display | Stay |
| Moving arrows on the route | Settings → Display | → Your route on the map |
| Distance marks, arrival times, elapsed time | Check › On the map | → Your route on the map; Check's section goes |
| Details on hover, Trackpad rotates & tilts | Settings → Display | → Map and planner |
| 3D height (exaggeration) | Layers, under 3D terrain | → Map and planner; 3D on or off stays in Layers |
| The planner's place (desktop) | Settings, the planner's button and ⋯ | Map and planner; the planner keeps its button |
| Heads-up kinds you've hidden | The end of Check | Also Settings → Hidden in Check (#143); Check keeps its list |
| Recent searches | Search, kept with no way to clear | Settings → On this device: Clear (new, small) |
| Routing server, MML key | Settings, their own sections | Inside Data sources |
| What's new | Settings, first | About Polku, last |
| Winter: Auto, On, Off | Layers → Winter | Stays: it only decides what Winter's layers show |
| Route colours on the map | Check and the profile | Stay: chosen while reading the profile |
| Route style per sport | The planner's How you go | Stays (#321) |
| Base map, overlays, trail colours, 3D, timeline, weather layers | Layers | Stay: the map's choices |
| Panel width, sheet height, open sections, last view, tab | Remembered without asking | Not settings. Reset (#332) clears them, and When Polku opens (#329) decides the view |

## The groups, in order

1. **Your sports:** each sport's speeds and its five Layers tiles.
2. **Display:** Appearance, High contrast; planned: larger text (#325), colours for colour blindness (#324),
   less motion (#327), fewer effects (#330).
3. **Your route on the map:** moving arrows, distance marks, arrival and elapsed times; planned: trails show
   through the route (#199).
4. **Map and planner:** 3D height, details on hover, trackpad, the planner's place on a desktop; planned: turning
   the map with two fingers (#328), units (#326), when Polku opens (#329), keeping the screen on (#331).
5. **Hidden in Check:** each hidden kind with Show again (#143).
6. **Offline maps:** as today.
7. **On this device:** what Polku keeps here, Clear recent searches; planned: export and import (#282), reset
   settings (#332).
8. **Data sources:** the services' use, then the routing server and the MML key.
9. **About Polku:** What's new; planned: how to use, credits and licence (#321).

Most used first, the technical ones near the end, and About last, where every settings screen keeps it.
Languages (#184), saved routes (#157) and help (#114, #189) stay in their own work; Settings may link to them.
Search (#333) comes last, once these names settle.

## Two layouts

- **A: one list.** Today's single scroll with these groups. Nothing folds, so nothing takes a tap more than
  today. It grows to about 3,400 px with every planned setting.
- **B: folding groups (recommended).** The same groups as Layers' folding groups (`.lg-group`, the same
  control). Settings opens on the list of nine names, which fits one phone screen, and each group stays open
  or folded as you leave it. Every setting is then one tap away the first time, where today it's a scroll.

B is recommended because the list only grows, and Layers already teaches the control. It costs one tap the
first time, which PRODUCT.md's "no more taps" rule weighs against A's scrolling; that trade is the user's call.

## Decisions for the user

1. A or B.
2. Distance marks and their times move from Check to Settings (recommended: they're set once, not per route).
3. A Clear button for recent searches (recommended: Polku keeps them, so it should let you remove them).

## Building it, once chosen

One PR for #321: `renderSettingsPanel()` in `js/main.js` regrouped, the moves above (Check's On the map in
`js/planner.js` waits until #603 is merged, since it changes that file), `docs/USING.md`, the CHANGELOG and
smoke checks in the `settings` group. B adds no new motion: the folding is Layers' own. The planned settings
then land one issue at a time, each in its group.
