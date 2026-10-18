#!/bin/sh
# Google Chrome for the smoke suite on GitHub's Ubuntu runner (.github/workflows/smoke.yml),
# set up like the development Mac's: an en-GB browser with a mouse (the runner has none, so
# (hover: hover) and (pointer: fine) would be false on desktop pages; phone pages get touch from
# tools/cdp.py's emulation). tools/cdp.py adds the rest.
# With POLKU_NETLOG set to a folder, each Chrome writes its requests there, to be counted.
MOUSE=--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4
if [ -n "$POLKU_NETLOG" ]; then
  exec "${CHROME_BIN:-google-chrome}" --lang=en-GB --accept-lang=en-GB,en-US,en "$MOUSE" "--log-net-log=$POLKU_NETLOG/$$.json" "$@"
fi
exec "${CHROME_BIN:-google-chrome}" --lang=en-GB --accept-lang=en-GB,en-US,en "$MOUSE" "$@"
