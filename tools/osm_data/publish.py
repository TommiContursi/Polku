#!/usr/bin/env python3
"""Guarded pinned-host-key SFTP publication; no hosting configuration is uploaded."""

import argparse
import base64
from contextlib import contextmanager
from datetime import datetime, timezone
import hmac
import hashlib
import io
import json
import os
from pathlib import Path
import posixpath
import re
import paramiko
import urllib.request
from urllib.error import HTTPError
from urllib.parse import urlsplit
import uuid


NAME = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]{0,120}\Z')
BLOCK = 4096
MAX_JSON = 2 * 1024 * 1024


def require(ok, message):
    if not ok:
        raise ValueError(message)


def public_url(url):
    p = urlsplit(url)
    require(p.scheme == 'https' and p.hostname and not p.username and not p.password
            and not p.query and not p.fragment and not any(ord(c) < 33 for c in url),
            'Public URL must be HTTPS without credentials, query or fragment')
    return url.rstrip('/')


def validate(manifest, pointed=False):
    release = manifest.get('release', '')
    require(manifest.get('schema') == 1 and isinstance(release, str) and NAME.fullmatch(release), 'Invalid release manifest')
    files = manifest.get('files', [])
    require(isinstance(files, list) and files, 'Manifest files are required')
    names = set()
    for f in files:
        name = f.get('path', '')
        require(isinstance(name, str) and NAME.fullmatch(name) and name not in {'current.json', 'manifest.json'}
                and name not in names, 'Unsafe or duplicate release file')
        require(type(f.get('bytes')) is int and f['bytes'] >= 0
                and re.fullmatch('[a-f0-9]{64}', f.get('sha256', '')), 'Invalid file integrity metadata')
        names.add(name)
    require('LICENSE.txt' in names and manifest.get('datasets'), 'Release needs datasets and LICENSE.txt')
    for dataset in manifest['datasets'].values():
        prefix = f'releases/{release}/' if pointed else ''
        name = dataset.get('url', '').removeprefix(prefix)
        require(dataset.get('url') == prefix + name and name in names and name.endswith('.pmtiles'), 'Unsafe dataset URL')
        entry = next(f for f in files if f['path'] == name)
        require(entry['bytes'] == dataset.get('bytes') and entry['sha256'] == dataset.get('sha256') and entry['bytes'] > 0,
                'Dataset and file integrity disagree')
    return manifest


def current(manifest):
    result = json.loads(json.dumps(manifest))
    for dataset in result['datasets'].values():
        dataset['url'] = f"releases/{result['release']}/{posixpath.basename(dataset['url'])}"
    return result


def settings():
    values = [os.environ.get('OSM_' + key, '') for key in ('FTP_HOST', 'FTP_USER', 'FTP_PASSWORD', 'FTP_ROOT', 'PUBLIC_URL', 'SFTP_HOST_KEY_SHA256')]
    host, user, password, root, url, fingerprint = values
    require(all(values), 'Missing SFTP publication settings, including OSM_SFTP_HOST_KEY_SHA256')
    require(re.fullmatch(r'[A-Za-z0-9.-]+', host), 'Invalid SFTP hostname')
    require(re.fullmatch(r'SHA256:[A-Za-z0-9+/]{43}', fingerprint), 'Invalid pinned SSH host key SHA256 fingerprint')
    require(root.startswith('/') and root.endswith('/polku-osm') and root == posixpath.normpath(root)
            and '\\' not in root and not any(p in {'.', '..'} for p in root.split('/'))
            and not any(ord(c) < 32 or ord(c) == 127 for c in root), 'Unsafe FTP root: require a dedicated /polku-osm directory')
    return host, user, password, root, public_url(url), fingerprint


class SFTPFiles:
    """Small FTP-like file-operation facade; all transfers are SSH-encrypted."""
    def __init__(self, transport, sftp):
        self.transport, self.sftp = transport, sftp

    def cwd(self, path):
        self.sftp.chdir(path)

    def nlst(self, path='.'):
        return self.sftp.listdir(path)

    def mkd(self, path):
        return self.sftp.mkdir(path)

    def size(self, path):
        return self.sftp.stat(path).st_size

    def storbinary(self, command, body):
        require(command.startswith('STOR '), 'Invalid upload command')
        with self.sftp.open(command[5:], 'wb') as output:
            while chunk := body.read(1024 * 1024):
                output.write(chunk)
            output.flush()

    def retrbinary(self, command, callback):
        require(command.startswith('RETR '), 'Invalid download command')
        with self.sftp.open(command[5:], 'rb') as source:
            while chunk := source.read(1024 * 1024):
                callback(chunk)

    def rename(self, old, new):
        # Immutable directory moves never overwrite an existing release.
        return self.sftp.rename(old, new)

    def replace(self, old, new):
        # POSIX rename-over-existing is mandatory for atomic pointer switching.
        # Do not delete current.json or fall back to an unsafe SFTP rename.
        return self.sftp.posix_rename(old, new)

    def close(self):
        try:
            self.sftp.close()
        finally:
            self.transport.close()


def open_sftp(host, user, password, expected_fingerprint):
    """Verify the server key *before* sending credentials, with no TOFU fallback."""
    transport = paramiko.Transport((host, 22))
    try:
        transport.start_client(timeout=30)
        key = transport.get_remote_server_key()
        actual = 'SHA256:' + base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode('ascii').rstrip('=')
        require(hmac.compare_digest(actual, expected_fingerprint),
                'SFTP server host key differs from pinned fingerprint; stop and verify with OVH')
        transport.auth_password(username=user, password=password)
        require(transport.is_authenticated(), 'SFTP authentication failed')
        client = paramiko.SFTPClient.from_transport(transport)
        require(client is not None, 'SFTP subsystem unavailable')
        return SFTPFiles(transport, client)
    except BaseException:
        transport.close()
        raise


@contextmanager
def connection(config):
    host, user, password, root, _, fingerprint = config
    remote = None
    try:
        remote = open_sftp(host, user, password, fingerprint)
        remote.cwd(root)
        yield remote
    except Exception as error:
        message = str(error).replace(password, '[redacted]').replace(user, '[redacted]')
        raise RuntimeError(message) from None
    finally:
        if remote is not None:
            remote.close()


def retrieve(ftp, path):
    result = bytearray()
    def take(chunk):
        require(len(result) + len(chunk) <= MAX_JSON, 'Manifest exceeds size limit')
        result.extend(chunk)
    ftp.retrbinary('RETR ' + path, take)
    return bytes(result)


def offsets(size):
    starts = {0, max(0, size // 2 - BLOCK // 2), max(0, size - BLOCK)}
    starts.update(n for n in (2 ** 31, 2 ** 32) if n < size)
    return [(s, min(s + BLOCK, size)) for s in sorted(starts)]


def digest_file(path):
    sha = hashlib.sha256()
    with path.open('rb') as body:
        for chunk in iter(lambda: body.read(1024 * 1024), b''):
            sha.update(chunk)
    return sha.hexdigest()


def verify_remote(ftp, base, manifest, raw):
    samples = {}
    for f in manifest['files']:
        path, size = base + '/' + f['path'], f['bytes']
        require(ftp.size(path) == size, 'Uploaded file size differs')
        sha, seen = hashlib.sha256(), 0
        chunks = {s: bytearray() for s, _ in offsets(size)}
        def take(chunk):
            nonlocal seen
            sha.update(chunk)
            for start, end in offsets(size):
                a, b = max(start, seen), min(end, seen + len(chunk))
                if a < b:
                    chunks[start].extend(chunk[a - seen:b - seen])
            seen += len(chunk)
        ftp.retrbinary('RETR ' + path, take)
        require(seen == size and sha.hexdigest() == f['sha256'], 'Uploaded file SHA-256 differs')
        samples[f['path']] = {s: bytes(data) for s, data in chunks.items()}
    require(ftp.size(base + '/manifest.json') == len(raw) and retrieve(ftp, base + '/manifest.json') == raw,
            'Uploaded manifest differs')
    return samples


def get(url, byte_range=None, immutable=False, encoding='gzip, br'):
    headers = {'Origin': 'https://polku.si', 'Accept-Encoding': encoding}
    if byte_range:
        start, end, size = byte_range
        headers['Range'] = f'bytes={start}-{end - 1}'
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
        h = response.headers
        require(h.get('Access-Control-Allow-Origin') == '*', 'Public response needs wildcard CORS')
        require(not h.get('Content-Encoding'), 'Public data must not use HTTP Content-Encoding')
        if immutable:
            cache = h.get('Cache-Control', '').lower()
            require('immutable' in cache and 'max-age=31536000' in cache, 'Release needs immutable cache headers')
        mime = h.get('Content-Type', '').split(';')[0].strip().lower()
        if byte_range:
            require(response.status == 206 and h.get('Content-Range') == f'bytes {start}-{end - 1}/{size}', 'Invalid HTTP Range response')
            exposed = {v.strip().lower() for v in h.get('Access-Control-Expose-Headers', '').split(',')}
            require('*' in exposed or {'content-range', 'accept-ranges', 'content-length'} <= exposed, 'Range headers must be exposed to browsers')
            require(h.get('Accept-Ranges') == 'bytes' and h.get('Content-Length') == str(end - start), 'Invalid range length headers')
            require(mime in {'application/vnd.pmtiles', 'application/octet-stream'}, 'Invalid archive MIME type')
            body = response.read(end - start + 1)
            require(len(body) == end - start, 'Range body length differs')
        else:
            require(response.status == 200 and mime == 'application/json', 'Invalid manifest HTTP response')
            body = response.read(MAX_JSON + 1)
            require(len(body) <= MAX_JSON, 'Manifest exceeds size limit')
        return body


def probe(url, manifest, raw, samples=None):
    base = f"{url}/releases/{manifest['release']}"
    require(get(base + '/manifest.json', immutable=True) == raw, 'Public manifest differs')
    for dataset in manifest['datasets'].values():
        name, size = posixpath.basename(dataset['url']), dataset['bytes']
        for start, end in offsets(size):
            for encoding in ('identity', 'gzip, br'):
                body = get(base + '/' + name, (start, end, size), True, encoding)
                if samples:
                    require(body == samples[name][start], 'Public archive bytes differ')


def replace_pointer(ftp, raw):
    name = f'current.{uuid.uuid4().hex}.tmp'
    ftp.storbinary('STOR ' + name, io.BytesIO(raw))
    require(ftp.size(name) == len(raw) and retrieve(ftp, name) == raw, 'Temporary pointer differs')
    # OSM_ALLOW_PUBLISH is set only after the operator verifies atomic overwrite on this host.
    ftp.replace(name, 'current.json')


def promote(ftp, url, manifest, previous, directory, samples, release_raw):
    if previous is not None:
        (directory / f'rollback-{uuid.uuid4().hex}.json').write_bytes(previous)
    raw = json.dumps(current(manifest), sort_keys=True, separators=(',', ':')).encode()
    replace_pointer(ftp, raw)
    try:
        require(get(url + '/current.json') == raw, 'Promoted pointer differs')
        probe(url, manifest, release_raw, samples)
    except Exception:
        if previous is None:
            raise RuntimeError('Promotion verification failed; no previous pointer exists') from None
        try:
            replace_pointer(ftp, previous)
            require(get(url + '/current.json') == previous, 'Restored pointer differs')
        except Exception:
            raise RuntimeError('Promotion verification failed; rollback also failed; use the saved rollback manifest') from None
        raise RuntimeError('Promotion verification failed; previous pointer restored') from None


def previous_pointer(ftp):
    if 'current.json' not in {posixpath.basename(p) for p in ftp.nlst()}:
        return None
    raw = retrieve(ftp, 'current.json')
    validate(json.loads(raw), pointed=True)
    return raw


def publish(directory):
    require(os.environ.get('OSM_ALLOW_PUBLISH') == 'true', 'Publication requires approved OSM_ALLOW_PUBLISH=true')
    directory = Path(directory)
    raw = (directory / 'manifest.json').read_bytes()
    manifest = validate(json.loads(raw))
    for f in manifest['files']:
        path = directory / f['path']
        require(path.is_file() and not path.is_symlink() and path.stat().st_size == f['bytes']
                and digest_file(path) == f['sha256'], 'Local file integrity differs')
    config = settings()
    with connection(config) as ftp:
        previous = previous_pointer(ftp)
        if 'releases' not in {posixpath.basename(p) for p in ftp.nlst()}:
            ftp.mkd('releases')
        release = manifest['release']
        require(release not in {posixpath.basename(p) for p in ftp.nlst('releases')}, 'Immutable release already exists')
        stage, final = f'.upload-{release}-{uuid.uuid4().hex}', f'releases/{release}'
        ftp.mkd(stage)
        for f in manifest['files']:
            with (directory / f['path']).open('rb') as body:
                ftp.storbinary('STOR ' + stage + '/' + f['path'], body)
        ftp.storbinary('STOR ' + stage + '/manifest.json', io.BytesIO(raw))
        samples = verify_remote(ftp, stage, manifest, raw)
        ftp.rename(stage, final)
        probe(config[-2], manifest, raw, samples)
        promote(ftp, config[-2], manifest, previous, directory, samples, raw)


def rollback(manifest_path):
    require(os.environ.get('OSM_ALLOW_PUBLISH') == 'true', 'Publication requires approved OSM_ALLOW_PUBLISH=true')
    path = Path(manifest_path)
    target = validate(json.loads(path.read_bytes()), pointed=True)
    config = settings()
    with connection(config) as ftp:
        previous = previous_pointer(ftp)
        base = f"releases/{target['release']}"
        raw = retrieve(ftp, base + '/manifest.json')
        manifest = validate(json.loads(raw))
        require(current(manifest) == target, 'Rollback manifest differs from immutable release')
        samples = verify_remote(ftp, base, manifest, raw)
        probe(config[-1], manifest, raw, samples)
        promote(ftp, config[-2], manifest, previous, path.parent, samples, raw)


def check(url):
    url = public_url(url)
    require(url.endswith('/current.json'), 'Check needs the current.json URL')
    manifest = validate(json.loads(get(url)), pointed=True)
    stamp = datetime.fromisoformat(manifest['source']['timestamp'].replace('Z', '+00:00'))
    require(stamp.tzinfo is not None and 0 <= (datetime.now(timezone.utc) - stamp).total_seconds() <= 14 * 86400,
            'OSM source timestamp is stale or in the future')
    base = url.removesuffix('/current.json')
    raw = get(f"{base}/releases/{manifest['release']}/manifest.json", immutable=True)
    release = validate(json.loads(raw))
    require(current(release) == manifest, 'Current pointer differs from immutable manifest')
    probe(base, release, raw)


def verify_access():
    """Check protected credentials and the configured path without writing host files."""
    config = settings()
    with connection(config) as ftp:
        ftp.nlst()
    request = urllib.request.Request(config[-2] + '/current.json', method='HEAD',
                                    headers={'Origin': 'https://polku.si'})
    try:
        response = urllib.request.urlopen(request, timeout=30)
    except HTTPError as error:
        response = error
    with response:
        return {'sftp_read_access': True, 'public_status': response.status,
                'public_cors': response.headers.get('Access-Control-Allow-Origin') == '*'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('publish').add_argument('directory', type=Path)
    commands.add_parser('rollback').add_argument('--manifest', type=Path, required=True)
    commands.add_parser('check').add_argument('url')
    commands.add_parser('verify-access')
    args = parser.parse_args()
    try:
        if args.command == 'publish':
            publish(args.directory)
        elif args.command == 'rollback':
            rollback(args.manifest)
        elif args.command == 'verify-access':
            print(json.dumps(verify_access(), sort_keys=True))
            print('Only pinned-host-key SFTP read access checked; no files written or publication verified.')
            return
        else:
            check(args.url)
    except Exception as error:
        parser.exit(1, f'{args.command} failed: {error}\n')
    print(f'{args.command}: verified')


if __name__ == '__main__':
    main()
