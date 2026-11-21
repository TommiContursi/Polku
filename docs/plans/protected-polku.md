# Protected Polku: a private repository, hosting on Cloudflare and a security check

The plan for #115. The decisions live in #115's description; this file holds the design
and the order. Written 2026-11-21 at `9e97774`, reviewed by Codex and by a fresh Claude
session the same day (on #1236); their findings are taken in.

## What changes for people using Polku

Nothing they should notice. polku.si keeps its address, so saved routes, settings, offline
areas, the service worker and every share link stay as they are. The map's data sources and
routing are called from the browser exactly as now. What changes behind it:

- polku.si is served by Cloudflare instead of GitHub Pages, built from the repository.
- Only the app's own files are published. Today the whole repository is: `polku.si/AGENTS.md`,
  `polku.si/docs/DEVELOPING.md` and `polku.si/tools/smoke.py` all answer (checked 2026-11-20).
- The published code is minified, without comments or source maps.
- The repository becomes private. The OSM data build moves to a public repository of its own.
- The site sends security headers, asks AI crawlers not to train on it, and states the
  copyright in every file.

## What was checked (2026-11-20)

| What | Found |
| --- | --- |
| Hosting | GitHub Pages straight (`server: GitHub.com`), `max-age=600`, `Last-Modified` per deploy |
| DNS | OVH nameservers (`ns103` / `dns103.ovh.net`); 4 A and 4 AAAA records to GitHub Pages; `www` a CNAME to `tommicontursi.github.io`; `ftp` a CNAME to the apex; mail at OVH: 3 MX, SPF, SRV `_autodiscover`, `_imaps`, `_submission`, CNAMEs `autoconfig`, `autodiscover`, `mail`, `imap`, `smtp`, `pop3`; no DKIM, DMARC or CAA |
| Redirects | `http://polku.si` 301 to `https://`; `https://www.polku.si/?r=x` 301 to `https://polku.si/?r=x` |
| GitHub domain verification | none: polku.si isn't a verified Pages domain (`protected_domain_state: null`) |
| DNSSEC | On: a DS record in the `.si` registry |
| Headers | No HSTS, no CSP, no frame protection; no `robots.txt` (also #873) |
| Keys in the browser | Only MML's, which is public by design (it is in every tile URL) |
| Licence | Already proprietary, "All rights reserved" |
| Forks, stars | 0 forks, 2 stars |
| Actions, 2026-10-21 to 11-20 | about 12,300 minutes in GitHub's usage report: the smoke suite 8,843, the OSM data build and checks about 3,400 (the suite counted job by job, 10,087, in "Actions budget") |
| GitHub-only features in use | the ruleset "Protect main" (no deletion or force push, PRs required, linear history); the environment `osm-data-production` holding the SFTP secrets, limited to `main` |

What follows from it:

- **On GitHub Free, a private repository unpublishes Pages at once**, ignores rulesets and
  can't use environments. So hosting moves first, and the repository goes private on
  **GitHub Pro** (4 $ a month), which keeps "Protect main" and the environments working.
- **Actions cost money in a private repository.** Pro includes 18 $ a month (about 3,000
  Linux minutes at 0.006 $ a minute). Public repositories stay free, so the OSM data build,
  which has needed many runs, moves to a public repository. The smoke suite alone used
  about three times Pro's allowance; "Actions budget" below keeps Polku within it.
- **Cloudflare's documented headers have no `Last-Modified`**, which `sw.js` uses to keep one deploy's files
  together (DEVELOPING, "One deploy's files per page"). The deploy gets an id of its own.
- **The app links to the repository** in the map's credits (`js/main.js`) and in What's new:
  `SOURCE` and `REPO` in `js/changelog.js`, and 297 links to issues inside `CHANGELOG.md`
  itself, one in nearly every heading. They would lead to a 404 for everyone but Tomba.
  `js/changelog.js` renders links into the repository as plain text and drops "Full changelog
  on GitHub"; the shipped entries stay as they are.
- **People can't report problems on GitHub** once it's private. They need another way.

## Hosting: Cloudflare Workers with static assets

Cloudflare builds from the private repository through its GitHub app, serves static files
free and without a request limit, reads a `_headers` file, and offers AI Crawl Control on the
free plan. Workers with static assets is where Cloudflare puts new work; Pages would also do.

**Why not stay on GitHub Pages with Pro:** an Actions deploy of the same minified `site/` would
need no DNS, DNSSEC or mail change and no change to `sw.js`. What Cloudflare buys is the
headers a `<meta>` tag can't set (HSTS, `frame-ancestors`, `X-Frame-Options`, the
`tdm-reservation` header) and AI Crawl Control. #115 chose Cloudflare on 2026-11-21 for those.

- **Published files are an allowlist**, so a new document is never published by accident:
  `index.html`, `sw.js`, `js/` (with `js/vendor/`), `css/`, `fonts/`, `img/`, `data/`,
  `profiles/`, `CHANGELOG.md` (What's new reads it), `LICENSE`, `THIRD_PARTY_NOTICES.md`,
  and what the build writes: `robots.txt`, `.well-known/tdmrep.json` and `_headers`. A check fails the build when a
  file the app requests is missing from it.
- **One build script** (`tools/site.sh` or similar) copies the allowlist into `site/`,
  minifies, writes the deploy id and the headers. Cloudflare runs it to publish, and a session
  runs it to test the built site (below); the app itself keeps running from the repository as
  it is, with no build step. `wrangler.jsonc` names the Worker and points it at `site/`;
  Cloudflare's build runs `npm ci`, `tools/site.sh` and then `npm run deploy`, whose script runs
  wrangler at an exact version (`npx --yes wrangler@…`), so a new release can't change a deploy;
  it isn't a devDependency, so no worktree installs it. A session
  runs `npm ci` once in its worktree; `node_modules/` and `site/` stay out of git. GitHub's
  smoke suite keeps testing the repository as it is.
- **Minified with esbuild**, pinned with its integrity hash in a lockfile (`package.json`
  and `package-lock.json`): each file
  transformed on its own (no bundling, so modules and `import.meta.url` stay as they are),
  comments and whitespace removed, local names shortened, no source maps. The one-line
  copyright comment is kept (`legalComments`). `js/vendor/` is published as it is. Whole-line
  comments are also stripped from `index.html` (13 lines) and `profiles/*.brf` (323 lines, the
  routing's reasons; BRouter ignores them).
- **The deploy id** is the commit Cloudflare builds (`WORKERS_CI_COMMIT_SHA`; a local build
  uses `git rev-parse HEAD`, the same value). It is sent on every file as the header
  `X-Polku-Deploy`, and stamped into Polku's own `.js` and `.css` files and `index.html` (the
  copyright comment carries it), so their hashes, and so their ETags, change with every deploy,
  as GitHub's do today. The rest isn't stamped: `js/vendor/` (versioned in its file names),
  fonts, images, `data/`, `profiles/` and `CHANGELOG.md`. A saved copy of one of those can
  carry an older id after a 304, and is then used only when the network fails. Otherwise an unchanged file
  would revalidate to a 304, and Cloudflare's docs don't say whether `_headers` headers come
  with a 304: the browser could keep an older deploy's id. `sw.js` isn't stamped either: the browser
  fetches it directly, never through the worker, and a stamp would install a new worker on
  every deploy, one that forgets the open pages' deploys and saved copies (`deployOf`,
  `savedFor`). `sw.js` reads the deploy-id header and
  falls back to `Last-Modified`, because parts 1a and 1b run on GitHub Pages for days before the DNS
  moves (and again after a rollback to Pages); the fallback goes in part 5. The
  `startfail` check that sets saved copies' `Last-Modified` changes with it. Locally, as now,
  files have no shared deploy time.
- **The same origin, exactly:** `https://polku.si`. A Workers custom domain serves the app,
  it doesn't redirect, so `www` is **not** added to the Worker: it would become a second Polku
  with its own storage and service worker, where nobody's saved routes are. Instead `www` gets
  a proxied placeholder record (`AAAA 100::`) and a redirect rule, 301 to `https://polku.si`
  with the path and query kept. **Always Use HTTPS** is turned on, so `http://` keeps
  redirecting. Before the DNS moves, the Worker's only address is `polku.<account>.workers.dev`:
  it is the **test address** until polku.si is served from Cloudflare (part 4), and is turned
  off in part 5 (`workers_dev: false`), so no copy stays public there. Preview URLs, a public
  address for every uploaded version, are off from the start (`preview_urls: false`): they would
  keep serving old builds, and nothing uses them.
- **Rollback:** Cloudflare keeps earlier versions, and one can be made current from its
  dashboard. Until part 5, the DNS can also point back to GitHub Pages (part 5 removes `sw.js`'s
  `Last-Modified` fallback and lengthens HSTS), and until DNSSEC is on at Cloudflare (Tomba's
  step 3.5) the nameservers can go back to OVH, whose zone stays as it was.
- **Previews:** builds for other branches are off at first: every branch would build, and
  those without the build script (`pr-screenshots` too) would fail. Turning them on for PR
  branches is a choice for later.
- **Zone features that rewrite pages** (Email Obfuscation, Rocket Loader and the like) stay off:
  they would change `index.html` and break the policy's hashes. Part 4 byte-compares the served
  `index.html` with `site/index.html`.

### Testing the built site

The smoke groups run against `site/` before the PR leaves draft: `serve.py` gets a way to
serve the built folder with the `_headers` rules applied, and with the policy enforced (it sends
`Content-Security-Policy-Report-Only` as `Content-Security-Policy`), so minification, the
headers and the policy are all tested together. The smoke checks load their fixtures and
helpers from the page's own server (`/tools/fixtures/…` in 22 places, `/tools/loading_checks.js`,
`/tools/osm_data/smoke_checks.js`), so the built mode serves `site/` and falls back to the
checkout for `/tools/` only. A failure that appears only on the built site is the build's, and
is fixed there. The app itself requests nothing outside the allowlist (checked 2026-11-21).

## Security headers

| Header | Value (to confirm while building) | Why |
| --- | --- | --- |
| `Strict-Transport-Security` | `max-age=86400` until part 5, then a year | HTTPS only. Short at first, so certificate trouble during a rollback to Pages can still be clicked through. No `includeSubDomains` or preload: preload is hard to undo |
| `Content-Security-Policy` | see below | stops injected scripts |
| `X-Content-Type-Options` | `nosniff` | files are read as what they are |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | services see polku.si, not the route in the address |
| `Permissions-Policy` | named features off only: camera, microphone, payment, USB, serial, HID and the like | Not report-only: it applies from the first deploy. "Everything else off" would break Share (`web-share`, `clipboard-write`, `js/planner.js:4223`, `js/cards.js:922`) and the compass (`accelerometer`, `gyroscope`, `magnetometer`, `js/heading.js:48`) |
| frame protection | `frame-ancestors 'none'` (and `X-Frame-Options: DENY`) | nobody can wrap polku.si in their page |
| `tdm-reservation` | `1`, but on the OFL fonts and the ODbL outlines | the EU text and data mining opt-out, below |

**The content security policy is strict where an attack starts and open where Polku needs
it.** Scripts: Polku's own files, unpkg's two versioned files (already loaded with integrity
hashes), and the two inline scripts in `index.html` by their hashes, computed in the build
after minifying. Workers: `'self' blob:` (the service worker, `js/offline.js:33`; the shadows'
module worker, `js/shadows.js:198`; MapLibre's from `blob:`). Styles: `'self'`, `https://unpkg.com`
(MapLibre's CSS) and `'unsafe-inline'`, because 36 `style` attributes are set through `h()` and
16 more are in HTML strings (the route's marks and the chart's dots take their colours there).
`default-src 'self'` covers the rest (fonts, frames, media), so a source a directive forgets
is blocked, and shows in the smoke groups run with the policy enforced, rather than left open. Connections stay open to any `https:`
address and to this computer, because Settings' own BRouter address can be anything
(`brouterUrl`, `js/router.js`). Images and tiles likewise. Images and connections also allow
`data:` and `blob:`: the rain radar and the no-radar hatch are drawn in the app and handed to
MapLibre as `data:` URLs (`toDataURL()` in `js/radar.js` and `js/wxmap.js`), and MapLibre
loads images both as image elements and through `fetch`. The service list in the rollout's first step below is
therefore built from the code's `fetch`, image and worker uses too, not only `config.js` and
`SOURCES`. `object-src 'none'`, `base-uri
'none'`, `form-action 'none'`. The policy allows no inline event handlers, so the one
in `index.html` (the start-failure banner's **Reload**, `onclick="polkuRestart()"`) moves to
`addEventListener` in the inline script, and the start-failure path is tested with the policy
enforced (the `startfail` smoke group). No other `on…=` attribute is in `index.html` or the code
(searched 2026-11-21).

**Rolled out so routing can't break:**

1. The policy is built from every service in `js/config.js` and `js/net.js`'s `SOURCES`, and
   from every image, `data:`/`blob:` URL and worker the code makes (searched for, not assumed).
2. It is sent first as `Content-Security-Policy-Report-Only`: it blocks nothing. Nothing
   collects reports: a report endpoint would receive the page's address, which carries `?r=`
   and `?pin=` share links, so positions would leave the device (PRODUCT.md). A violation
   shows only in the console of whoever has it open, and the workers' in their own consoles.
3. **The gates, then, are these two:** every feature walked through on the test address and
   on polku.si with the console open (and the workers' consoles): routing in every sport,
   water routes and carries, round trips, weather along the route with the radar, search,
   every layer, 3D and hover, offline save and preview, share links (old ones too), GPX and KML
   import, GPX export, Share and the compass (Tomba, on his phone), Settings' own BRouter, the
   start-failure banner; and the smoke groups against the built site with the policy **enforced**.
4. Then it is enforced on polku.si. A week of Tomba's own use in report-only mode before that
   is optional.

## Harder to copy

- **The private repository** hides what is worth most: the plans, reviews, tests, tools and
  history. What was public until now has probably been copied and stays so.
- **Only the app is published, minified and without comments** (above). Comments carry the
  reasons behind the design; names and structure are what a copier gets.
- **A copyright line** at the top of every file of Polku's own in `js/`, `css/` and `sw.js`,
  and as an HTML comment in `index.html`, added by the build (esbuild's `banner`), so the
  source files and the PRs beside it don't change, and a new file gets it on its own:
  `/*! © 2026 Tommi Contursi. All rights reserved. No text and data mining or AI training (EU 2019/790, art. 4(3)). See https://polku.si/LICENSE · <deploy id> */`
  (`sw.js` without the id). It travels with a copy. The address is one variable in
  `tools/site.sh`, so a new domain is a one-line change there.
- **The licence says it outright:** a sentence added to `LICENSE` that no permission is given
  for text and data mining or for training machine-learning models, which reserves the right
  under Article 4 of the EU copyright directive. Tomba approves the wording.
- **`robots.txt`:** Cloudflare's managed `robots.txt` (all plans) puts its maintained list of
  AI training crawlers, with `Content-signal: search=yes, ai-train=no`, in front of the site's
  own file. The repository's `robots.txt` then holds only the search part, allowing search
  engines (#873 adds the sitemap) but no address with a query: share links carry positions, and
  opening one routes through brouter.de. No crawler list to keep by hand.
- **`/.well-known/tdmrep.json`** and the `tdm-reservation: 1` header (the W3C TDM
  Reservation Protocol): the machine-readable opt-out, for the whole site but the OFL fonts and
  the OpenStreetMap-derived outlines, whose licences forbid any added term (OFL's condition 5,
  ODbL 4.7). It binds only rights Polku holds, as `LICENSE` says. Part 2 checks that the
  dot-folder is uploaded and answers on the test address.
- **Cloudflare AI Crawl Control:** known AI crawlers blocked, including those that ignore
  `robots.txt`. No header makes an AI say whom it fetches for; Cloudflare's signed-bot
  check (Web Bot Auth) and its crawler report are the closest.

Nothing here stops someone saving the page. The protection is legal (licence, notices, the
opt-out) and practical (the background hidden), not technical.

## The OSM data build in a public repository of its own

It has been the biggest variable cost, and it already stands apart: it publishes files to a
host, and Polku reads them from `OSM_DATA_MANIFEST`.

- **Moves:** `tools/osm_data/` except the app's reader tests and the app checks below
  (`preview.py` with `test_preview.py`, `measure_browser.py`, `smoke_checks.js`), the build and publish parts of the
  `osm-data.yml` and `osm-data-alerts.yml` workflows, the `osm-data-production` environment, its
  secrets and variables. Polku keeps an environment with the publishing secrets too, for
  promotion. The new repository starts without Polku's history.
- **Stays in Polku:** `js/osm-data.js`, `js/osm-geometry.js`, `client.test.mjs`,
  `geometry.test.mjs`, `tools/fixtures/osm-*`, the browser half of the `osmdata` smoke group,
  and a small job that runs the reader tests when those files change. Today `osm_data()` in
  `tools/smoke.py` first runs unit tests from `test_publish`, `test_builder` and `test_alerts`;
  those move with the build and run in its CI.
- **The release checks that need the app stay in Polku.** Today the build's checks start the
  app (`preview.py` serves it from the checkout with `js/config.js` pointed at the candidate),
  run `tools/smoke.py osmdata`, and measure it in a browser (`measure_browser.py`, which imports
  `tools/cdp.py` and `tools/smoke.py`); the daily health check measures too
  (`osm-data.yml`, lines 180–186, 387 and 460). Those need Polku's private code, so the split
  is: the public repository builds, checks the data on its own (hashes, schema, its Python
  tests) and uploads an unpromoted candidate. **No token goes to the public repository:** a
  repository dispatch needs a token with Contents write, which could read and push Polku's
  code. Instead Polku's own scheduled job finds a new candidate in the public manifest, runs
  the app's checks against it and promotes it; promotion waits for its next run. The daily
  check of the files runs in the public repository; the browser check, which needs the app,
  runs in Polku weekly with the promotion. If OVH allows a second SFTP user whose root is a candidates
  folder, that one goes to the public repository, so it can't write the production manifest. The public repository never checks out
  Polku. Part 6 measures these jobs' minutes first, since they run in the private repository;
  the build itself, the costly part, stays free.
- **Its licence** is Polku's own, all rights reserved: public to read, not to reuse, as Polku's
  code has been until now. The data it publishes keeps OpenStreetMap's ODbL notices.
- **The contract** is the manifest and the archives' format. A change to it needs a PR in
  each repository: the build's first, then Polku's reader with new fixtures.
- **Secrets can't be copied out of GitHub.** Tomba re-enters them in the new repository from
  OVH (or makes a new SFTP key). The new repository gets the same "Protect main" ruleset,
  free in a public repository.
- **Done when** a candidate the new repository uploaded has been promoted by Polku's job, and
  the new repository's daily check has passed; then the workflows leave Polku.

## Security check

A session of its own, reading the code for what an attacker controls and what they could
reach. Each finding is filed; each fix gets a smoke check that fails before it.

- **Text from outside put into the page:** about 242 places put HTML into the page (51
  `.innerHTML =`, 191 `html:` through `h()`); many are fixed icon strings. A session of its
  own, at least. GPX and KML
  names, share-link names (`pn`), OSM and LIPAS names and tags, search results, weather and
  warnings texts. `escapeHtml` (`js/ui.js`) exists; the check is that every one of them uses it.
- **Share links and the URL:** what `parseShared` and `parsePin` accept, and what a crafted
  link can make Polku do or fetch.
- **Imported files:** GPX and KML parsing, sizes and odd content.
- **Stored data:** what `localStorage` and IndexedDB hold (MML key, saved routes), and what
  a script could read.
- **The service worker:** what it caches and whose responses, its messages, and offline preview.
- **Outside links and scripts:** `rel="noopener"`, unpkg's integrity hashes.
- **GitHub:** workflows (pinned actions, permissions, no `pull_request_target`), secrets in the
  history (a scan before the repository goes private; anything found is rotated, since the
  history was public), and dependencies of the tools. The Cloudflare GitHub app's access is
  checked in part 2, and esbuild's lockfile in part 1b.
- **Accounts:** two-step sign-in, a passkey where offered, on GitHub, Cloudflare and OVH, and
  the transfer lock on polku.si at OVH. These are Tomba's; the check lists them.

## A backup outside GitHub

Today the code, the issues (where every decision lives) and the PRs exist only on GitHub and
in local clones. Cloudflare is no backup: it keeps built versions of the site, not the source.

- **A weekly workflow** pushes `main`, the other branches and the tags to a private
  repository on Bitbucket, which Tomba already has. `pr-screenshots` is left out: `main`'s whole
  history is about 13 MiB (a bare clone, 2026-11-21), while GitHub reports about 800 MB for the
  repository, nearly all of it screenshots. Atlassian's pricing page gives 1 GB a workspace
  on the free plan, and 2 GB (soft) and 4 GB (hard) a repository: it fits either way.
- **The same workflow exports the issues, PRs, comments and milestones** as JSON with the
  workflow's own token, and pushes them to a branch of their own in that repository (or a
  second one), so one Bitbucket credential is enough.
- **A restore is tried once** when it's set up: a clone from Bitbucket, and the JSON opened.
- A few minutes a week of Actions time.
- The Project's order isn't in the export: the workflow's token can't read a user's Project.
- Tomba's step: the Bitbucket repository and an access token with write access to it only,
  stored as a secret in GitHub.

## Actions budget

**Polku pays Pro's 4 $ a month and nothing more:** the budget is 0 $ over Pro's 18 $, with
**Stop usage when budget limit is reached** on. Without Pro (GitHub Free, 12 $ included) there
would be no 4 $, but "Protect main" and the OSM environment stop working in a private
repository: not worth it.

Measured from GitHub's API for 2026-10-21 to 11-20, rounded up per job as GitHub bills: 188
suite runs, 10,087 minutes. 43 whole-suite runs took 5,007 minutes (about 116 each), and 145
runs of a few groups took 5,080 (about 35 each); 150 of the runs came from Claude's branches.
That is over three times the 18 $ (about 3,000 minutes). To fit:

- **Groups run locally,** on a server of their own, as AGENTS.md has them, not on GitHub.
  GitHub runs a group only for a check that fails only on its runner.
- **The whole suite on GitHub at most about 20 times a month** (about 2,300 minutes): before a
  phase PR leaves draft and before a milestone closes. Part 1b writes this into AGENTS.md's
  "Testing".
- **The OSM data's daily check** of the files runs in the public repository, free. The browser
  check, which needs the app, runs in Polku weekly with the promotion instead of daily (4 to 5
  minutes a run).
- **The backup:** a few minutes a week.

When the allowance runs out, every Actions run stops until the next month, the OSM promotion
too: the groups still run locally, and the data waits a week or two.

## Tomba's steps

In the order they come. When one is next, a session gives click-by-click instructions, and
checks the result after it.

0. **Now, safe before anything is built:**
   - Verify polku.si for GitHub Pages, one TXT record at OVH ([GitHub's guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)),
     so nobody else can serve it from GitHub once Pages is off. Done when GitHub shows polku.si
     as verified.
   - Approve the licence sentence part 1a adds. Where people report problems is chosen later
     (decided 2026-11-21).
1. **Merge this plan** (#1236).
2. **Cloudflare, once part 1b has merged:** an account on the free plan with two-step sign-in;
   the Worker connected to the repository through Cloudflare's GitHub app, with **Only select
   repositories** (Polku alone); builds for other branches off. Done when the Worker has built
   `main` and its `workers.dev` address opens Polku; part 2 then checks it.
3. **The DNS to Cloudflare, once part 2 has passed.** Over two days, in this order:
   1. At OVH, DNSSEC off. Then a day's wait: the DS record's time to live is 2 hours, a day is
      safe.
   2. OVH's zone exported as a text file now, so it has the verification record from step 0.
      In Cloudflare, polku.si added and that file imported with **Proxy imported DNS
      records** unticked. Compared with OVH's list record by record; `ftp` deleted; every record
      DNS-only (grey cloud), since a proxied `mail`, `imap`, `smtp` or `pop3` breaks every mail
      client, and a proxied apex still on GitHub can loop under Flexible SSL. Always Use HTTPS,
      AI Crawl Control and the managed `robots.txt` on; Email Address Obfuscation and Rocket
      Loader off, since they rewrite pages. Done when every OVH record but `ftp` is there and
      none is proxied.
   3. At OVH, the nameservers changed to Cloudflare's two. polku.si is still served by GitHub
      meanwhile, so nothing changes for anyone. Done when Cloudflare shows the zone active, a
      session sees 1.1.1.1, 8.8.8.8 and 9.9.9.9 return Cloudflare's nameservers, and mail is
      sent and received in a mail client that uses `imap` and `smtp`.
   4. In Cloudflare, at a quiet hour, in this order: the apex's GitHub records deleted (4 A,
      4 AAAA); polku.si added to the Worker as its custom domain (Cloudflare makes its record);
      `www`'s CNAME deleted and a proxied `AAAA 100::` added in its place, with a redirect
      rule, 301 to `https://polku.si`, keeping the path and query. polku.si may not answer for a
      minute or two. Done when part 4's checks pass.
   5. A day after 3.3 at the earliest, so no resolver still asks OVH: DNSSEC on in Cloudflare,
      and its DS record added at OVH. A resolver still asking OVH would get a DS that doesn't
      match OVH's keys, and polku.si and its mail would fail for it ([Cloudflare's guidance](https://developers.cloudflare.com/learning-paths/dns-best-practices/concepts/phase-4/)).
      Done when a session sees polku.si validate.
4. **The OSM data's public repository, when part 6 asks:** the repository, its environment,
   and the SFTP secrets entered again from OVH (or a new SFTP key); a second SFTP user limited
   to a candidates folder, if OVH allows it. Done when the new repository's first run has
   uploaded a candidate.
5. **Bitbucket, when part 9 asks:** a private repository, and an access token with write access
   to it only, stored as a secret in GitHub. Done when the backup's first run has passed.
6. **Last: Pro and the private repository, once parts 5 and 6 and part 7's history scan are
   done:** GitHub Pro; an Actions budget of 0 $ with **Stop usage when budget limit is reached**
   on; a check that Codex's and Claude's GitHub access include the repository; GitHub Pages
   off; the repository made private. Done when polku.si, the OSM data and the sessions still
   work, which a session checks.

## Order

| Part | Who | What | Waits for | Done when |
| --- | --- | --- | --- | --- |
| 1a | session | The app ready for Cloudflare: `sw.js` reading `X-Polku-Deploy` with its `Last-Modified` fallback (and `startfail` with it), the start-failure banner's handler, What's new's links into the repository as plain text (its failure message too), the credits' `Polku © Tommi Contursi` as plain text, the licence sentence. Built in #1243; the copyright line moved to 1b's build, and where to report problems waits (both decided 2026-11-21) | this plan merged | merged, the groups it touches passing (`startfail` and `changelog` among them) |
| 1b | session | The built site: `tools/site.sh` with the copyright lines, esbuild with its lockfile, `wrangler.jsonc`, `_headers` with the policy report-only, `robots.txt`, `tdmrep.json`, `serve.py`'s built mode, AGENTS.md ("Testing", the built site) and DEVELOPING | 1a | merged, the groups it touches passing against `site/` with the policy enforced |
| 2 | session, Tomba | The `workers.dev` address checked: the headers, `tdmrep.json`, the walk-through (Share and the compass on Tomba's phone); the Cloudflare GitHub app sees only Polku | Tomba's step 2 | nothing in the walk-through fails or reports a violation |
| 3 | Tomba | The DNS to Cloudflare (step 3) | part 2 | step 3's checks pass |
| 4 | session, Tomba | polku.si on Cloudflare checked: the redirects (`curl -I http://polku.si/`, `https://www.polku.si/?r=x`, `/index.html?r=x` keeping the query), `index.html` byte for byte against a `site/` built at the same commit, share links, offline, routing, the walk-through | step 3.4 | all of it passes |
| 5 | session | The policy enforced; HSTS a year; `sw.js`'s `Last-Modified` fallback removed; `workers_dev` off; "GitHub Pages" made "Cloudflare" in AGENTS.md, PRODUCT.md and DEVELOPING | part 4, then a week on Cloudflare without trouble | merged, the groups it touches passing |
| 6 | session, Tomba (step 4) | The OSM data build moved | this plan merged | a candidate from the new repository promoted by Polku's job, its daily check passed, the workflows gone from Polku |
| 7 | session | The security check and its fixes, the history scan first | this plan merged | every finding filed; the history scanned and anything found rotated |
| 8 | Tomba | Pro, budget, private (step 6) | parts 5 and 6, part 7's history scan, step 0 | step 6's check passes |
| 9 | session, Tomba (step 5) | The backup to Bitbucket | this plan merged | one weekly run done, and a restore tried |

Parts 1a, 6, 7 and 9 can run side by side, each in a session of its own.

Later, each its own issue when chosen: the OSM archives (28 files, 11.2 GB) from OVH to
Cloudflare R2 at `data.polku.si` (free traffic, about 0.30 $ a month for storage, faster and
sturdier serving; it doesn't fix the build's Geofabrik download failures); Polku's own BRouter
(#858) behind a Cloudflare tunnel at `route.polku.si`, so the server's address stays hidden and
needs no open ports. It removes brouter.de's pauses but adds upkeep: the server's updates,
BRouter's releases, the weekly refresh of the Nordic routing data, monitoring, and a fallback
to brouter.de when it's down. It stays out of this phase: nothing in protecting the code needs
it.

**Not done:** a proxy for the outside services. Their limits are per address: through one
proxy every user would share one limit, and brouter.de pausing one user would pause all. It
would also send positions through Polku (PRODUCT.md).

## Open questions

- **Where people report problems** once GitHub is private, and **the licence sentence's
  wording:** Tomba's step 0.
- **Should `main` keep publishing polku.si,** or should a release be a tagged commit, with
  `main` going to the test address first (#115's review of 2026-10-18)? This plan keeps
  `main` publishing; a release step can come later.

## Sources

- [GitHub: changing a repository's visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)
- [GitHub: rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) and [environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) by plan
- [GitHub Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)
- [Cloudflare Workers Builds and GitHub](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/)
- [Cloudflare AI Crawl Control](https://developers.cloudflare.com/ai-crawl-control/) and [managed robots.txt](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/)
- [W3C TDM Reservation Protocol](https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240510/)
