#!/bin/sh
# Builds the published site into site/ (#115, docs/plans/protected-polku.md): only the app's files, from an allowlist,
# so a new document is never published by accident; Polku's own code minified, without comments or source maps, with
# the copyright line and the deploy's id; robots.txt and the text and data mining opt-out; and _headers, the headers
# Cloudflare sends. Cloudflare runs it to publish (npm ci && tools/site.sh); a session runs it to test the built site
# (python3 serve.py PORT --site, DEVELOPING's "The built site").
set -eu
cd "$(dirname "$0")/.."
ORIGIN=https://polku.si # the site's address: a new domain is this line
DEPLOY=${WORKERS_CI_COMMIT_SHA:-$(git rev-parse HEAD)}
ESBUILD=node_modules/.bin/esbuild # (npm ci installs the pinned one; npx could fetch another)
COPYRIGHT="© 2026 Tommi Contursi. All rights reserved. No text and data mining or AI training (EU 2019/790, art. 4(3)). See $ORIGIN/LICENSE"

rm -rf site
mkdir site
cp -R index.html sw.js js css fonts img data profiles CHANGELOG.md LICENSE THIRD_PARTY_NOTICES.md site/
find site -name .DS_Store -delete

# Each file on its own, not bundled, so modules and import.meta.url stay as they are. The copyright line carries the
# deploy's id in every file of Polku's own but sw.js, so each deploy changes their ETags; a changed sw.js would install
# a new worker, which forgets the open pages' deploys and saved copies. js/vendor/ is published as it is. sw.js is a
# classic script, so its top-level names are left alone.
"$ESBUILD" $(find js -name '*.js' -not -path 'js/vendor/*') --outbase=js --outdir=site/js --format=esm \
  --minify --legal-comments=none --charset=utf8 --log-level=warning --banner:js="/*! $COPYRIGHT · $DEPLOY */"
"$ESBUILD" css/app.css --outfile=site/css/app.css \
  --minify --legal-comments=none --charset=utf8 --log-level=warning --banner:css="/*! $COPYRIGHT · $DEPLOY */"
"$ESBUILD" sw.js --outfile=site/sw.js \
  --minify --legal-comments=none --charset=utf8 --log-level=warning --banner:js="/*! $COPYRIGHT */"

# Search engines are welcome: Cloudflare's managed robots.txt puts its list of AI training crawlers in front of this
mkdir site/.well-known
printf 'User-agent: *\nAllow: /\n' > site/robots.txt
# the W3C TDM Reservation Protocol: text and data mining reserved for the whole site
printf '[{ "location": "/", "tdm-reservation": 1 }]\n' > site/.well-known/tdmrep.json

node --input-type=module - "$COPYRIGHT · $DEPLOY" "$DEPLOY" <<'EOF'
import { readFileSync as read, writeFileSync as write, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { transformSync } from 'esbuild';

const [copyright, deploy] = process.argv.slice(2);
const files = (dir) => readdirSync(dir, { recursive: true }).map((f) => `${dir}/${f}`);

// index.html: the copyright line after the doctype, whole-line comments out, the inline scripts minified and hashed
// for the policy
const hashes = [];
const html = read('index.html', 'utf8')
  .replace(/^[ \t]*<!--(?:(?!-->)[^])*-->[ \t]*\n/gm, '')
  .replace(/^<!doctype html>\n/i, (d) => `${d}<!-- ${copyright} -->\n`)
  .replace(/<script>([^]*?)<\/script>/g, (_, js) => {
    const code = transformSync(js, { minify: true, charset: 'utf8' }).code.trim();
    hashes.push(`'sha256-${createHash('sha256').update(code).digest('base64')}'`);
    return `<script>${code}</script>`;
  });
if (!html.includes(copyright) || hashes.length !== 2) throw new Error('index.html: no doctype, or not two inline scripts');
write('site/index.html', html);

// BRouter's profiles without their whole-line comments (the reasons behind the routing; BRouter ignores them)
for (const f of files('site/profiles')) write(f, read(f, 'utf8').replace(/^[ \t]*#.*\n/gm, ''));

// the files index.html, the worker and the code name must be published
const wanted = [...html.matchAll(/(?:src|href)="(?!https?:|data:|#)([^"]+)"/g)].map((m) => m[1]);
for (const f of ['sw.js', ...files('js').filter((f) => f.endsWith('.js') && !f.startsWith('js/vendor/'))])
  for (const m of read(f, 'utf8').matchAll(/['"`]((?:fonts|img|data|profiles|css|js)\/[\w./-]+\.\w+|CHANGELOG\.md)['"`]/g)) wanted.push(m[1]);
const missing = [...new Set(wanted)].filter((f) => !existsSync(`site/${f}`));
if (missing.length) throw new Error(`not published, but the app asks for: ${missing.join(', ')}`);

// The headers (the plan's "Security headers"). The policy is report-only until the plan's part 5 enforces it;
// serve.py --site enforces it already. Images and connections stay open to any https: address and to this computer
// (Settings' own BRouter), and to data: and blob: (the radar's images, MapLibre's). Permissions-Policy turns off only
// features Polku doesn't use: Share and the compass need theirs.
const scripts = [...html.matchAll(/<script src="(https:[^"]+)"/g)].map((m) => m[1]);
const local = 'http://localhost:* http://127.0.0.1:*';
const policy = [
  "default-src 'self'",
  `script-src 'self' ${scripts.join(' ')} ${hashes.join(' ')}`,
  "style-src 'self' https://unpkg.com 'unsafe-inline'",
  "worker-src 'self' blob:",
  `img-src 'self' https: data: blob: ${local}`,
  `connect-src 'self' https: data: blob: ${local}`,
  "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
].join('; ');
write('site/_headers', `/*
  X-Polku-Deploy: ${deploy}
  Strict-Transport-Security: max-age=86400
  Content-Security-Policy-Report-Only: ${policy}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), midi=(), display-capture=()
  X-Frame-Options: DENY
  tdm-reservation: 1
`);
EOF
echo "site/ built for $ORIGIN, deploy $DEPLOY"
