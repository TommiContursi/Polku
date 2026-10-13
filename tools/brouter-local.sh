#!/usr/bin/env bash
# A BRouter server on this computer, for Polku: routes without brouter.de's shared limits.
#
#   tools/brouter-local.sh          # the first run downloads about 125 MB, then serves http://localhost:17777
#   tools/brouter-local.sh update   # fresh routing data first (brouter.de rebuilds it about daily)
#
# Then in Polku: Settings → Routing server → http://localhost:17777/brouter → Save.
# Needs Java 11 or newer (java -version). Everything goes to ~/.cache/polku-tools/brouter
# (POLKU_BROUTER_DIR to change it); PORT=… for another port. Ctrl+C stops it.
#
# What it downloads:
#   - the BRouter release (engine and stock profiles), github.com/abrensch/brouter, about 7 MB
#   - routing data for Finland: eight 5°×5° squares from brouter.de/brouter/segments4, about 116 MB
#   - the fastbike-lowtraffic profile Polku uses for road cycling (brouter.de serves it; it isn't in the release)
set -euo pipefail

VER=1.7.10
DIR="${POLKU_BROUTER_DIR:-$HOME/.cache/polku-tools/brouter}"
PORT="${PORT:-17777}"
TILES="E20_N60 E25_N60 E30_N60 E20_N65 E25_N65 E30_N65 E20_N70 E25_N70" # Finland (and a margin of Sweden, Norway and Estonia)

command -v java >/dev/null || { echo "Java is needed: install a JDK 11+ (e.g. brew install openjdk) and try again." >&2; exit 1; }
mkdir -p "$DIR/segments4" "$DIR/customprofiles"
cd "$DIR"

jar=$(find . -name "brouter-$VER-all.jar" -print -quit)
if [ -z "$jar" ]; then
  echo "Downloading BRouter ${VER}…"
  curl -fL --progress-bar -o "brouter-$VER.zip" "https://github.com/abrensch/brouter/releases/download/v$VER/brouter-$VER.zip"
  unzip -q -o "brouter-$VER.zip" -d "brouter-$VER" && rm "brouter-$VER.zip"
  jar=$(find . -name "brouter-$VER-all.jar" -print -quit)
fi
profiles=$(dirname "$(find . -path '*profiles2/lookups.dat' -print -quit)")
[ -n "$jar" ] && [ -d "$profiles" ] || { echo "The BRouter download doesn't look as expected (no jar or profiles2) in $DIR" >&2; exit 1; }

if [ ! -f "$profiles/fastbike-lowtraffic.brf" ]; then
  curl -fsL -o "$profiles/fastbike-lowtraffic.brf" "https://brouter.de/brouter/profiles2/fastbike-lowtraffic.brf" \
    || cp "$profiles/fastbike-verylowtraffic.brf" "$profiles/fastbike-lowtraffic.brf"
fi

for t in $TILES; do
  f="segments4/$t.rd5"
  if [ ! -s "$f" ] || [ "${1:-}" = update ]; then
    echo "Routing data ${t}…"
    # -z: only if brouter.de has a newer file than ours
    curl -fL --progress-bar -z "$f" -o "$f.part" "https://brouter.de/brouter/segments4/$t.rd5" && { [ -s "$f.part" ] && mv "$f.part" "$f" || rm -f "$f.part"; }
  fi
done

echo "BRouter on http://localhost:$PORT/brouter — in Polku: Settings → Routing server. Ctrl+C stops it."
# RouteServer <segmentdir> <profiledir> <customprofiledir> <port> <maxthreads> [bindaddress]
exec java -Xmx1024m -Xms128m -DmaxRunningTime=300 -cp "$jar" btools.server.RouteServer \
  segments4 "$profiles" customprofiles "$PORT" 4 127.0.0.1
