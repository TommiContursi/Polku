# Protected Polku: a private repository, hosting on Cloudflare and a security check

The plan for #115. The decisions live in #115's description; this file holds the design
and the order. Written 2026-11-21 at `9e97774`, for review before anything is built.

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
| DNS | OVH nameservers (`ns103` / `dns103.ovh.net`), mail at OVH (MX and SPF), `www` is a CNAME to `tommicontursi.github.io` |
| DNSSEC | On: a DS record in the `.si` registry |
| Headers | No HSTS, no CSP, no frame protection; no `robots.txt` (also #873) |
| Keys in the browser | Only MML's, which is public by design (it is in every tile URL) |
| Licence | Already proprietary, "All rights reserved" |
| Forks, stars | 0 forks, 2 stars |
| Actions, 2026-10-21 to 11-20 | about 12,300 minutes: the smoke suite 8,843 (149 runs), the OSM data build and checks about 3,400 |
| GitHub-only features in use | the ruleset "Protect main" (no deletion or force push, PRs required, linear history); the environment `osm-data-production` holding the SFTP secrets, limited to `main` |

What follows from it:

- **On GitHub Free, a private repository unpublishes Pages at once**, ignores rulesets and
  can't use environments. So hosting moves first, and the repository goes private on
  **GitHub Pro** (4 $ a month), which keeps "Protect main" and the environments working.
- **Actions cost money in a private repository.** Pro includes 18 $ a month (about 3,000
  Linux minutes at 0.006 $ a minute). Public repositories stay free, so the OSM data build,
  which has needed many runs, moves to a public repository, and the smoke suite runs within
  a monthly budget set in GitHub's billing (Tomba's step).
- **Cloudflare sends no `Last-Modified`**, which `sw.js` uses to keep one deploy's files
  together (DEVELOPING, "One deploy's files per page"). The deploy gets an id of its own.
- **The app links to the repository** in the map's credits (`js/main.js`) and in What's new
  (`SOURCE` and `REPO` in `js/changelog.js`). They would lead to a 404 for everyone but Tomba.
- **People can't report problems on GitHub** once it's private. They need another way.

## Hosting: Cloudflare Workers with static assets

Cloudflare builds from the private repository through its GitHub app, serves static files
free and without a request limit, reads a `_headers` file, and offers AI Crawl Control on the
free plan. Workers with static assets is where Cloudflare puts new work; Pages would also do.

- **Published files are an allowlist**, so a new document is never published by accident:
  `index.html`, `sw.js`, `js/` (with `js/vendor/`), `css/`, `fonts/`, `img/`, `data/`,
  `profiles/`, `CHANGELOG.md` (What's new reads it), `LICENSE`, `THIRD_PARTY_NOTICES.md`,
  `robots.txt`, `.well-known/tdmrep.json` and `_headers`. A check fails the build when a
  file the app requests is missing from it.
- **One build script** (`tools/site.sh` or similar) copies the allowlist into `site/`,
  minifies, writes the deploy id and the headers. Cloudflare runs it; nothing else does, and
  the app keeps running from the repository as it is, with no build step locally.
- **Minified with esbuild**, a pinned version fetched in Cloudflare's build only: each file
  transformed on its own (no bundling, so modules and `import.meta.url` stay as they are),
  comments and whitespace removed, local names shortened, no source maps. The one-line
  copyright comment is kept (`legalComments`). `js/vendor/` is published as it is.
- **The deploy id** comes from the commit Cloudflare builds and is sent as a header on every
  file. `sw.js` reads it where it read `Last-Modified`. Locally, as now, files have no shared
  deploy time.
- **The same origin, exactly:** `https://polku.si`. `www.polku.si` redirects to it.
- **Rollback:** Cloudflare keeps earlier versions, and one can be made current from its
  dashboard. Until the repository is private, the DNS can also point back to GitHub Pages.
- **Previews:** Cloudflare can serve each branch at its own address, not indexed. Useful for
  testing on a phone before merging; `main` still publishes polku.si.

### Testing the built site

The smoke groups run against `site/` before the PR leaves draft: `serve.py` gets a way to
serve the built folder with the `_headers` rules applied, so minification, the headers and the
content security policy are all tested together. A failure that appears only on the built
site is the build's, and is fixed there.

## Security headers

| Header | Value (to confirm while building) | Why |
| --- | --- | --- |
| `Strict-Transport-Security` | `max-age=31536000` | HTTPS only, for a year. No `includeSubDomains` or preload at first: preload is hard to undo |
| `Content-Security-Policy` | see below | stops injected scripts |
| `X-Content-Type-Options` | `nosniff` | files are read as what they are |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | services see polku.si, not the route in the address |
| `Permissions-Policy` | location, compass and motion for Polku itself; camera, microphone and the rest off | |
| frame protection | `frame-ancestors 'none'` (and `X-Frame-Options: DENY`) | nobody can wrap polku.si in their page |
| `tdm-reservation` | `1` | the EU text and data mining opt-out, below |

**The content security policy is strict where an attack starts and open where Polku needs
it.** Scripts: Polku's own files, unpkg's two versioned files (already loaded with integrity
hashes), and the two inline scripts in `index.html` by their hashes, computed in the build
after minifying; MapLibre's workers from `blob:`. Connections stay open to any `https:`
address and to this computer, because Settings' own BRouter address can be anything
(`brouterUrl`, `js/router.js`). Images and tiles likewise. `object-src 'none'`, `base-uri
'none'`, `form-action 'none'`.

**Rolled out so routing can't break:**

1. The policy is built from every service in `js/config.js` and `js/net.js`'s `SOURCES`.
2. It is sent first as `Content-Security-Policy-Report-Only`: it reports, blocks nothing.
   On the test address, then on polku.si for a week.
3. During that week every feature is walked through with the console open: routing in every
   sport, water routes and carries, round trips, weather along the route, search, every
   layer, 3D and hover, offline save and preview, share links (old ones too), GPX and KML
   import, GPX export, Settings' own BRouter.
4. The smoke groups pass against the built site with the policy on.
5. Only then is it enforced.

## Harder to copy

- **The private repository** hides what is worth most: the plans, reviews, tests, tools and
  history. What was public until now has probably been copied and stays so.
- **Only the app is published, minified and without comments** (above). Comments carry the
  reasons behind the design; names and structure are what a copier gets.
- **A copyright line** at the top of every file of Polku's own in `js/`, `css/` and `sw.js`:
  `/*! © 2026 Tommi Contursi. All rights reserved. See https://polku.si/LICENSE */`. It
  survives minifying and travels with a copy.
- **The licence says it outright:** a sentence added to `LICENSE` that no permission is given
  for text and data mining or for training machine-learning models, which reserves the right
  under Article 4 of the EU copyright directive. Tomba approves the wording.
- **`robots.txt`:** search engines allowed (search keeps finding Polku, #873 adds the
  sitemap), AI training crawlers disallowed (GPTBot, ClaudeBot, CCBot, Google-Extended,
  Applebot-Extended, Bytespider, Meta-ExternalAgent and the others on Cloudflare's list), and
  a `Content-Signal: search=yes, ai-train=no` line.
- **`/.well-known/tdmrep.json`** and the `tdm-reservation: 1` header (the W3C TDM
  Reservation Protocol): the machine-readable opt-out.
- **Cloudflare AI Crawl Control:** known AI crawlers blocked, including those that ignore
  `robots.txt`. No header makes an AI say whom it fetches for; Cloudflare's signed-bot
  check (Web Bot Auth) and its crawler report are the closest.

Nothing here stops someone saving the page. The protection is legal (licence, notices, the
opt-out) and practical (the background hidden), not technical.

## The OSM data build in a public repository of its own

It has been the biggest variable cost, and it already stands apart: it publishes files to a
host, and Polku reads them from `OSM_DATA_MANIFEST`.

- **Moves:** `tools/osm_data/` except the app's reader tests, the `osm-data.yml` and
  `osm-data-alerts.yml` workflows, the `osm-data-production` environment, its secrets and
  variables. The new repository starts without Polku's history.
- **Stays in Polku:** `js/osm-data.js`, `js/osm-geometry.js`, `client.test.mjs`,
  `geometry.test.mjs`, `tools/fixtures/osm-*`, the `osmdata` smoke group, and a small job that
  runs the reader tests when those files change.
- **The contract** is the manifest and the archives' format. A change to it needs a PR in
  each repository: the build's first, then Polku's reader with new fixtures.
- **Secrets can't be copied out of GitHub.** Tomba re-enters them in the new repository from
  OVH (or makes a new SFTP key). The new repository gets the same "Protect main" ruleset,
  free in a public repository.
- **Done when** the new repository has published one release and its daily check has passed;
  then the workflows are removed from Polku.

## Security check

A session of its own, reading the code for what an attacker controls and what they could
reach. Each finding is filed; each fix gets a smoke check that fails before it.

- **Text from outside put into the page:** about 45 `innerHTML` and `html:` uses. GPX and KML
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
  history was public), dependencies of the tools.
- **Accounts:** two-step sign-in, a passkey where offered, on GitHub, Cloudflare and OVH, and
  the transfer lock on polku.si at OVH. These are Tomba's; the check lists them.

## Tomba's steps

Each comes with click-by-click instructions in its PR or Hand-over when it is next.

1. Cloudflare account with two-step sign-in; the Workers project from the repository; the
   test address checked by a session.
2. DNSSEC off at OVH, then a day's wait (the DS record's time to live is 2 hours; a day is
   safe). Nameservers to Cloudflare after checking that the MX, SPF and any DKIM records were
   copied. `polku.si` and `www` added to the project. DNSSEC on again at Cloudflare, with its
   DS record added at OVH. AI Crawl Control on. A test e-mail sent and received.
3. The new public repository for the OSM data build, its environment and secrets.
4. GitHub Pro, a monthly Actions budget that stops runs when reached, a check that Codex's
   and Claude's GitHub access include the repository, GitHub Pages off, and the repository
   made private.

## Order

| Part | Who | What | Waits for |
| --- | --- | --- | --- |
| 1 | session | The built site: allowlist, minifying, deploy id in `sw.js`, headers with the policy report-only, `robots.txt`, `tdmrep.json`, copyright lines, the licence sentence, the repository links out of the app, `serve.py` for the built folder, AGENTS.md and DEVELOPING | review of this plan |
| 2 | Tomba | Cloudflare project and test address (step 1) | part 1 merged |
| 3 | Tomba | DNS to Cloudflare (step 2) | part 2 checked |
| 4 | session | Check polku.si on Cloudflare: headers, share links, offline, routing, the console | part 3 |
| 5 | session | The policy enforced, after a clean week | part 4 |
| 6 | session, Tomba | The OSM data build moved (step 3) | can start after this plan's review |
| 7 | session | The security check and its fixes | can start after this plan's review |
| 8 | Tomba | Pro, budget, private (step 4) | parts 4 and 6 |

Later, each its own issue when chosen: the OSM archives (28 files, 11.2 GB) from OVH to
Cloudflare R2 at `data.polku.si` (free traffic, about 0.30 $ a month for storage, faster and
sturdier serving; it doesn't fix the build's Geofabrik download failures); a BRouter of
Polku's own behind a Cloudflare tunnel, if a server is available.

**Not done:** a proxy for the outside services. Their limits are per address: through one
proxy every user would share one limit, and brouter.de pausing one user would pause all. It
would also send positions through Polku (PRODUCT.md).

## Open questions

- **Where people report problems** once GitHub is private. Proposal: an e-mail address on
  polku.si, shown in Settings → About Polku.
- **The licence sentence's wording,** for Tomba to approve.
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
