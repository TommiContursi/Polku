# Polku's OpenStreetMap data

The build behind the OpenStreetMap data that [Polku](https://polku.si) reads: complete roads,
paths, lighting, trail details, winter ways, water hazards, overnight places, reedbeds,
full-tag inspection and area geometry for Finland, Sweden, Norway and Estonia, as static
PMTiles archives at `https://ducksoft.fi/polku-osm/`.

The repository is public so that its long builds run on GitHub's free runners. Its code
is not open source: see [LICENSE](LICENSE). The data keeps OpenStreetMap's licence.

## How a release reaches Polku

1. **Monday 03:17 UTC**, `osm-data.yml` picks one dated Geofabrik export shared by all four
   countries, builds each country, completes the area geometry from the same Europe export
   and bundles the four into one release. Hashes, the schema, sample roads in every country
   and the Python tests are checked before anything is uploaded.
2. **The upload** (only when `OSM_UPLOAD_ENABLED` is `true`) puts the release in
   `releases/<release>/`, reads every file back to check its SHA-256, checks the public
   Range, CORS and cache headers, and names it in `candidates/current.json`. The live
   `current.json` is not touched.
3. **Polku's own weekly job** finds the candidate (`publish.py candidate`), runs the app's
   checks against it in a browser, and promotes it with Polku's credentials in a job that holds
   only this repository's code at a pinned commit (`publish.py promote`). A job without
   credentials then checks polku.si in a browser (`health.py`), and another rolls back
   (`publish.py rollback`) if that fails. Rollback by hand is Polku's too. This repository never checks out Polku, and holds no token
   of Polku's.
4. **Daily at 07:17 UTC** this repository checks the live files: freshness (at most 14 days
   old), the manifest and Range reads of every archive. Polku's weekly job checks them in a
   browser.

A failed scheduled run opens a `watch` issue here, and a build that Geofabrik refused on
every failed job is re-run on new runners (`osm-data-alerts.yml`).

## The contract

Polku's reader (`js/osm-data.js`, `js/osm-geometry.js`) reads the manifest and the archives'
format described in [tools/osm_data/README.md](tools/osm_data/README.md). A change to either
is a PR here first, then a PR in Polku's reader with new fixtures. The fixtures in
`tools/fixtures/` are the same files as Polku's.

## Working on it

```sh
python3.14 -m venv .venv
.venv/bin/pip install --require-hashes -r tools/osm_data/requirements.txt -r tools/osm_data/sftp-requirements.txt
.venv/bin/python -m unittest discover -s tools/osm_data -p 'test_*.py'
```

The `.txt` files lock every package by hash, since the SFTP jobs hold the host's password. They
are made from the `.in` files, taking only releases at least two weeks old:

```sh
cd tools/osm_data
uv pip compile --generate-hashes --python-version 3.14 --universal --exclude-newer YYYY-MM-DD --no-header requirements.in -o requirements.txt
uv pip compile --generate-hashes --python-version 3.14 --universal --exclude-newer YYYY-MM-DD --no-header sftp-requirements.in -o sftp-requirements.txt
```

Building, the host's configuration, recovery and retention are in
[docs/OPERATIONS.md](docs/OPERATIONS.md).
