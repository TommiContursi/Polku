# Third-party notices

Polku's [proprietary licence](LICENSE) applies only to its original material.
The following third-party material retains its own licences and attribution.

## BRouter profiles (MIT)

The profiles below are modified versions of the stock profiles distributed
by [BRouter](https://github.com/abrensch/brouter), downloaded from
[brouter.de](https://brouter.de/brouter/profiles2/).

| File | Upstream profile |
| --- | --- |
| `profiles/polku-road.brf` | `fastbike-lowtraffic.brf` |
| `profiles/polku-road-shortcuts.brf` | `fastbike-lowtraffic.brf`, through `polku-road.brf` |
| `profiles/polku-gravel.brf` | `gravel.brf` (quaelnix) |
| `profiles/polku-mtb.brf` | `mtb.brf` (Poutnik) |
| `profiles/polku-hike.brf` | `hiking-mountain.brf` (Poutnik) |

Existing author credits and source comments are retained in the files.
Polku's changes add preferences for unpaved main roads and optional routing
through ways marked private. `tools/make_profiles.py` also contains upstream
profile excerpts used to generate the variants.

The upstream portions, including those excerpts, remain under BRouter's
[MIT licence](https://github.com/abrensch/brouter/blob/master/LICENSE),
reproduced below. Polku's original additions are covered by [LICENSE](LICENSE);
this does not restrict reuse of the upstream portions under MIT. Include this
MIT notice with copies or substantial portions of the upstream material,
including profiles distributed or uploaded separately from this repository.

```text
The MIT License (MIT)

Copyright (c) 2019 BRouter contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Bundled development skills (MIT)

The skills in `.agents/skills/`, also linked from `.claude/skills/`, come from
[Emil Kowalski's skills](https://github.com/emilkowalski/skill), as recorded in
`skills-lock.json`. Copyright (c) 2026 Emil Kowalski. Their complete MIT licence
is retained in [.agents/skills/LICENSE](.agents/skills/LICENSE).

## Browser libraries loaded from a CDN

The static OSM reader also bundles PMTiles 4.5.0 (BSD-3-Clause) and its fflate
decompressor (MIT) in `js/vendor/pmtiles-4.5.0.js`. This is the upstream npm
browser distribution with its source-map reference removed and one ES module
export appended. Complete notices are retained in
[pmtiles-LICENSE.txt](js/vendor/pmtiles-LICENSE.txt) and
[fflate-LICENSE.txt](js/vendor/fflate-LICENSE.txt). The reader loads only when
static OSM data is selected; there is no app bundling step.

`index.html` loads these libraries from unpkg; their distributions are not
vendored in this repository. Their licences and bundled third-party notices
continue to apply, including to browser-cached copies.

| Library | Licence and notices |
| --- | --- |
| MapLibre GL JS 5.24.0 | [BSD-3-Clause and bundled notices](https://unpkg.com/maplibre-gl@5.24.0/LICENSE.txt), including Mapbox GL JS, glfx.js and d3-color |
| maplibre-contour 0.1.1 | [BSD-3-Clause and bundled notices](https://unpkg.com/maplibre-contour@0.1.1/LICENSE), including d3-contour and vt-pbf |

## Map data and services

© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
OpenStreetMap data is licensed under the
[Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Its attribution and applicable database share-alike obligations remain in
force; Polku's licence does not relicense that data, including OSM-derived
material in test fixtures.

Other map data and services retain their own terms. See [README.md's data
credits](README.md#data--credits) and the in-app attribution. Permission to use
third-party code does not itself grant permission to use a hosted service
commercially or beyond its usage limits.
