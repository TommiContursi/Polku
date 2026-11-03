# OVH SFTP publication fix

The protected read-only job on 2026-11-01 failed with `500 This security scheme is not implemented` when trying explicit FTPS on port 21. The user confirmed OVH SFTP is enabled. The connection now uses SFTP over SSH on port 22.

## Security and rollout

- The existing `OSM_FTP_HOST`, `OSM_FTP_USER`, `OSM_FTP_PASSWORD`, and `OSM_FTP_ROOT` settings are retained for compatibility, but mean SFTP credentials and directory.
- `OSM_SFTP_HOST_KEY_SHA256` is required. Verify the host public-key fingerprint with OVH or an existing independently verified connection **before** storing it in the protected `osm-data-production` environment. Merely running `ssh-keyscan` on an untrusted network cannot authenticate the server.
- The SSH host key is checked before the password is sent; any mismatch fails closed. No plain FTP fallback.
- Immutable directory publication uses SFTP `rename`. The active `current.json` pointer requires OpenSSH's `posix-rename@openssh.com` extension for atomic replacement; **no unsafe delete-then-rename fallback**.
- The `verify-access` operation only authenticates, reads the dedicated directory listing, and issues HTTP HEAD. No uploads, writes, or host configuration changes.
- After merging this PR, use `verify-access` on `main`, then test a disposable upload and atomic replacement separately with owner approval. Only after validating live Range/CORS/cache, transfer size, and atomicity should `OSM_PUBLISH_ENABLED` be set to `true`.
- This PR does not configure GitHub secrets, DNS, OVH or the `OSM_DATA_MANIFEST` source.
