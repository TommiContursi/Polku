#!/bin/sh
# Google Chrome for the smoke suite on GitHub's Ubuntu runner (.github/workflows/smoke.yml),
# set up like the development Mac's: an en-GB browser. tools/cdp.py adds the rest.
# With POLKU_NETLOG set to a folder, each Chrome writes its requests there, to be counted.
if [ -n "$POLKU_NETLOG" ]; then
  exec "${CHROME_BIN:-google-chrome}" --lang=en-GB --accept-lang=en-GB,en-US,en "--log-net-log=$POLKU_NETLOG/$$.json" "$@"
fi
exec "${CHROME_BIN:-google-chrome}" --lang=en-GB --accept-lang=en-GB,en-US,en "$@"
