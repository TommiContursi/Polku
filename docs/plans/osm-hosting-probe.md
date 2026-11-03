# OSM data on ducksoft.fi: hosting probe

Needs you: approve the account-specific hosting changes and supply a protected
publication credential before any upload. No live configuration was changed.
Next: validate a small archive on its intended public path after those changes.
Left: account capabilities, large-file limits, browser access and atomic rename
are unverified.

## Decision

The existing host is a plausible candidate, not a verified archive host. HTTPS
and small static byte ranges work on `ducksoft.fi`; the current responses lack
CORS, and text responses can be compressed before byte ranges are applied.
`data.ducksoft.fi` did not resolve from the probe machine. An unrelated static
file returning 206 does not establish that a new PMTiles path, a large file,
its MIME mapping, CORS or its publication process will work.

The candidate pipeline stores gzip-compressed JSON tiles inside PMTiles.
Internal tile compression is intentional; HTTP compression of the whole
archive must be disabled so PMTiles byte offsets address the original file.
Individual full-file gzip JSON tiles are a separate comparison: their encoding
and reader must agree, but they do not require byte-range access.

## Measured public responses

Read-only requests ran on 1 November 2026, 18:59–19:06 UTC, using Python's
default TLS certificate validation. All requests sent
`Origin: https://polku.si`. Static-file checks used HEAD plus GET ranges
`bytes=0-15` and `bytes=16-31`, with `Accept-Encoding: identity`, then a
`bytes=0-15` request advertising `gzip, br`. Range response bodies were read
and their actual lengths checked; this was not inferred from Accept-Ranges.

| Public URL | Observed response | What it establishes |
| --- | --- | --- |
| `https://ducksoft.fi/` | 200 HTML, Apache/PHP; ignored the initial `bytes=0-511` request | HTTPS works; a WordPress page is not a static archive probe. |
| `https://data.ducksoft.fi/` | Name resolution failed: `nodename nor servname provided, or not known` | This machine could not reach the proposed hostname; DNS/TLS/site mapping remains unverified. |
| `https://ducksoft.fi/robots.txt` | HEAD 200, 74 bytes, `text/plain`; identity GETs 206, exactly 16 bytes each, `Content-Range: bytes 0-15/74` and `bytes 16-31/74` | Small static ranges work on this path. No Cache-Control or ETag was returned. |
| `https://ducksoft.fi/file/footer_ducksoft.png` | HEAD 200, 2,351 bytes, `image/png`; both identity GETs 206 with exact ranges and 16-byte bodies | Small binary ranges work. `Cache-Control: max-age=900`; Last-Modified present; ETag absent. |
| `https://ducksoft.fi/wp-content/themes/jupiter/assets/stylesheet/min/full-styles.6.12.3.css?ver=1765449490` | HEAD 200, 150,229 bytes, `text/css`; both identity GETs 206 with exact ranges and 16-byte bodies | Largest file size established by these probes is only 150,229 bytes. `Cache-Control: max-age=900`; Last-Modified present; ETag absent. |

None of those responses returned Access-Control-Allow-Origin or
Access-Control-Expose-Headers. An OPTIONS request on the PNG with
`Access-Control-Request-Method: GET` and
`Access-Control-Request-Headers: range,if-match` returned 200 and
`Allow: HEAD,GET,POST,OPTIONS`, but no CORS response headers. That is not a
successful browser preflight.

With `Accept-Encoding: gzip, br`, the PNG retained the original bytes and no
Content-Encoding. The CSS returned `Content-Encoding: gzip` and
`Content-Range: bytes 0-15/26838`; robots.txt similarly returned gzip and
`bytes 0-15/91`. Both bodies contained only the first 16 bytes of a gzip
representation. This directly demonstrates that successful identity ranges
on this host do not guarantee usable ranges with a browser's normal encoding
negotiation. A browser reader cannot rely on setting Accept-Encoding itself.

For a small existing file, the measurements can be repeated without uploading:

```sh
curl --fail --silent --show-error --dump-header - --output /dev/null \
  --header 'Origin: https://polku.si' \
  --header 'Range: bytes=0-15' \
  --header 'Accept-Encoding: identity' \
  'https://ducksoft.fi/file/footer_ducksoft.png'
```

Repeat with `Accept-Encoding: gzip, br`, then a second range and OPTIONS.
Do not use an unbounded GET to probe an unknown large resource if it ignores
Range; cap the download and stop when 200 replaces the required 206.

## OVH restrictions and capacity

The [current worldwide contracts index](https://www.ovhcloud.com/en/terms-and-conditions/contracts/)
links to [Web Hosting terms, version dated 4 May 2026](https://contract.eu.ovhapis.com/1.0/pdf/Special_terms_Webhosting-we.pdf).
That link resolved during this investigation to
[version 6.0](https://storage.gra.cloud.ovh.net/v1/AUTH_325716a587c64897acbef9a4a4726e38/contracts/2ad93d1-Special_terms_Webhosting-WE-6.0.pdf).
The relevant provisions are:

- Section 5.1.1 confines stored content to material directly linked to the
  client's website.
- Section 5.1.2 disallows intensive public bandwidth usage or harming other
  customers; OVH can impose limitations and terminate for non-compliance.
- Section 2.2 says shared-resource performance is not guaranteed unless
  stated otherwise. Section 2.3 leaves backup and recovery planning with
  the customer.

These are current public worldwide terms, not proof of the contracting entity,
accepted version or terms attached to this particular account. An old public
2010 contract has a broader file-hosting prohibition; it is not used as the
current rule here. Confirm the applicable contract and, if needed, ask OVH
whether Polku's public data archive and expected traffic fit this plan before
making it a production dependency. This investigation did not contact OVH.

The stated 100 GB plan and 97 GB free are user-provided capacity figures;
the account quota was not inspected. No hard maximum static-file size or FTP
file-count limit was established from the official documentation consulted.
PHP upload limits do not establish the limit for binary FTP uploads.

Capacity arithmetic, using the reported decimal GB figures:

| Retention policy | Upper bound before metadata and growth |
| --- | --- |
| Active and new release only | Less than 48.5 GB per complete release |
| Previous, active and new release during publication | Less than 32.3 GB per complete release |
| Previous, active and new release while keeping at least 50 GB free | Less than 15.7 GB per complete release, assuming 3 GB of unrelated existing data |

These are storage budgets, not measured per-file limits or a promise of
acceptable traffic. Leave additional space for site growth and failed uploads.
The 50%-free option preserves OVH's documented prerequisite for a whole-storage
[Control Panel restore](https://docs.ovhcloud.com/en/guides/web-cloud/web-hosting/ftp-save-and-backup):
OVH stages the restored copy before replacing existing content. That restore
would affect other sites sharing the storage, so archive rollback should use
its own manifest rather than restoring the whole hosting account.

OVH's [technical specifications](https://docs.ovhcloud.com/en/guides/web-cloud/web-hosting/hosting-technical-specificities)
require passive FTP and describe the shared infrastructure. Its
[FTP connection guide](https://docs.ovhcloud.com/en/guides/web-cloud/web-hosting/ftp-connection)
lists the required server, port, user and password; SSH availability depends on
the plan. The newer [FileZilla guide](https://docs.ovhcloud.com/en/guides/web-cloud/web-hosting/ftp-filezilla-user-guide)
says SFTP can be activated on most plans, including plans without shell access.
Neither SFTP nor an SSH shell was assumed or checked for this account.

OVH supports directory-scoped
[.htaccess configuration](https://docs.ovhcloud.com/en/guides/web-cloud/web-hosting/htaccess-how-to-protect-wordpress),
and documents Cache-Control headers and changing versioned filenames in its
[CDN guide](https://docs.ovhcloud.com/en/guides/web-cloud/web-hosting/cdn-how-to-use-cdn).
Specific modules, inherited WordPress rules and any CDN/WAF configuration on
the intended data path remain unverified. The CDN guide's 1 GB Prewarm limit
is specific to that feature, not an established general static-file cap.

## Required path behavior

Configure only the approved data document root or data directory. Do not change
ducksoft.fi's WordPress rules, PHP settings, certificates or existing caches
as a side effect. A dedicated subdomain requires its own OVH site mapping,
DNS and valid TLS certificate before it can be used.

For the intended archive URL, require:

- GET/HEAD and exact 206 byte responses, stable full file length, correct
  Content-Range, and the exact original bytes at more than one offset.
- CORS on normal, partial and error responses: allow the public reader
  origin, allow GET/HEAD and Range/If-Match, expose ETag, Content-Range and
  Accept-Ranges. OPTIONS must succeed for the headers the reader sends.
  Public unauthenticated data can use wildcard origin without cookies.
- Explicit archive MIME, such as `application/octet-stream`, and no HTTP
  Content-Encoding, even when the request advertises gzip/br. Leave internal
  PMTiles tile compression intact. Apache documents
  [disabling gzip by path](https://httpd.apache.org/docs/2.4/mod/mod_deflate.html);
  also exclude any Brotli or CDN transformation on that path.
- Immutable release URLs with `Cache-Control: public, max-age=31536000, immutable`;
  the small stable manifest uses revalidation (`Cache-Control: no-cache`).
  Do not overwrite bytes at an existing archive URL.

[Protomaps' hosting documentation](https://docs.protomaps.com/pmtiles/cloud-storage)
specifies Range-capable storage and browser CORS, including Range/If-Match,
exposed ETag and OPTIONS support. A MIME rule alone will not satisfy these.

## Secure publication without assuming SSH

This is the required publication sequence, not a performed deployment:

1. Build and validate locally or in CI. Record upstream source URL and timestamp,
   extraction scope, tool versions, counts, coverage, byte sizes and SHA-256 for
   every output. Preserve the existing source/licence attribution alongside it.
2. Serialize publishing and rollback through one CI concurrency group. Use a
   protected environment with manual approval while hosting capabilities are
   being established. Give the deployment credential access only to the data
   directory if the plan permits it; never commit it or write it into logs.
3. Verify explicit FTPS on the account's actual FTP endpoint: AUTH TLS with
   certificate/hostname verification and encrypted data transfers (PROT P),
   passive mode and binary transfer. Fail if TLS is unavailable. Do not fall
   back to plain FTP or disable certificate verification. FTPS support and its
   certificate hostname have not been verified on this account. If unavailable,
   stop and select a verified secure transfer method with the owner.
4. Create a unique `releases/<release-id>/` directory. Upload every file with a
   temporary name and check remote sizes; finish each file with FTP RNFR/RNTO.
   Never reuse a release ID or overwrite the active release's files. A failed
   build or transfer leaves the current manifest untouched.
5. Before promotion, read the new public URLs over HTTPS. Stream a full
   SHA-256/size check once per output; for the archive also check first, middle
   and last byte ranges against local bytes, browser-like compression, CORS,
   MIME and caching. Probe an actual large output at offsets above 2 GiB and
   4 GiB if its size crosses those boundaries. Complete a browser read from
   Polku's origin. Neither a tiny sample nor a successful FTP upload proves
   large-file HTTP behavior.
6. Upload the new complete manifest to a unique temporary filename beside
   `manifest.json`; it points only at the verified immutable release URLs.
   Preserve the old manifest locally and as an immutable release artifact.
   Promote with same-directory RNFR/RNTO replacing `manifest.json`.
7. Treat atomic replacement as a prerequisite, not an FTP guarantee. Verify on
   two disposable manifests that the endpoint permits replacement and readers
   see complete old or new JSON without a missing/partial interval. FTP defines
   rename commands but does not guarantee this server's filesystem semantics.
   If replacement fails, stop; deleting the live manifest before renaming is
   not an acceptable substitute. Do not assume symlinks or `mv` are available.
8. Fetch the stable manifest again and verify its release and all public paths.
   Roll back by uploading the preserved old manifest to a new temporary name,
   then using the same verified atomic replacement. Keep referenced releases
   for at least the client cache/offline lifetime; prune only unreferenced old
   releases after that window. Retain a known good release during a new upload.

The [curl manual](https://curl.se/docs/manpage.html#--ssl-reqd) describes
`--ssl-reqd` for explicit TLS and `--netrc-file` for a protected credential file.
Use an ephemeral file with mode 0600 outside the checkout, then remove it after
the job. Credentials must not be placed in the command line or FTP URL.
[RFC 4217](https://www.rfc-editor.org/rfc/rfc4217) defines encrypted FTP control
and data channels; [RFC 959](https://www.rfc-editor.org/rfc/rfc959) defines the
RNFR/RNTO rename sequence. No remote shell is needed for this design.

## Credentials, capability checks and owner approval

- [ ] Confirm the actual plan, contracting entity/accepted terms, current free
  space and whether these public data files and projected traffic are allowed.
- [ ] Approve the exact public base URL, remote data directory, DNS/site mapping
  and TLS work if `data.ducksoft.fi` is selected. Confirm isolation from the
  existing website and back up any affected configuration.
- [ ] Supply the FTP endpoint, port, login and password through a protected
  secret mechanism; verify directory restriction and FTPS certificate/data
  channel protection. An OVH account password is not required for routine
  publication. Account-level configuration may need the owner separately.
- [ ] Approve the scoped CORS, MIME, compression and cache configuration; prove
  actual .htaccess/module/CDN/WAF behavior on the intended path.
- [ ] Approve a small disposable upload/rename probe, then verify replacement
  of an existing manifest, the real output size and large offsets when present.
- [ ] Configure protected CI secrets/environment, serial publishing, retention
  and rollback; approve the first production manifest promotion separately.

No credentials, uploads, DNS changes, hosting changes, CI secrets or production
promotion were performed. No load or maximum-file stress test was run; the
highest observed static Content-Length was 150,229 bytes. All capability claims
above remain scoped to the exact public resources and requests measured.
