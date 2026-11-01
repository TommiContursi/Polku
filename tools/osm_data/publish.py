#!/usr/bin/env python3
"""Guarded pinned-host-key SFTP publication; no hosting configuration is uploaded."""

import argparse
import base64
from contextlib import contextmanager
from datetime import datetime, timezone
import hmac
import hashlib
import errno
import io
import json
import os
from pathlib import Path
import posixpath
import re
import stat
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

    def kind(self, path):
        mode = self.sftp.lstat(path).st_mode
        return 'directory' if stat.S_ISDIR(mode) else 'file' if stat.S_ISREG(mode) else 'other'

    def remove(self, path):
        return self.sftp.remove(path)

    def rmd(self, path):
        return self.sftp.rmdir(path)

    def storbinary(self, command, body, rest=None):
        require(command.startswith('STOR '), 'Invalid upload command')
        path = command[5:]
        if rest is not None:
            require(self.kind(path) == 'file' and self.size(path) == rest, 'Resume offset or regular file changed')
        print(f'Upload {path} from byte {rest or 0}', flush=True)
        seen = rest or 0
        with self.sftp.open(path, 'r+b' if rest is not None else 'wb') as output:
            output.set_pipelined(True)
            if rest is not None:
                output.seek(rest)
            while chunk := body.read(1024 * 1024):
                output.write(chunk)
                seen += len(chunk)
                if seen // (64 * 1024 * 1024) != (seen - len(chunk)) // (64 * 1024 * 1024):
                    print(f'Uploaded {path}: {seen} bytes', flush=True)
            output.flush()
        print(f'Upload closed {path}: {seen} bytes', flush=True)

    def retrbinary(self, command, callback):
        require(command.startswith('RETR '), 'Invalid download command')
        print(f'Read back {command[5:]}', flush=True)
        seen = 0
        with self.sftp.open(command[5:], 'rb') as source:
            source.prefetch(file_size=source.stat().st_size, max_concurrent_requests=64)
            while chunk := source.read(1024 * 1024):
                callback(chunk)
                seen += len(chunk)
                if seen // (64 * 1024 * 1024) != (seen - len(chunk)) // (64 * 1024 * 1024):
                    print(f'Read back {command[5:]}: {seen} bytes', flush=True)
        print(f'Read back complete {command[5:]}: {seen} bytes', flush=True)

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
    import paramiko
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
        print(f'Verify full SHA-256 {path}', flush=True)
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
    # OVH can reject Python's default user agent, though browser requests succeed.
    headers = {'Origin': 'https://polku.si', 'Accept-Encoding': encoding,
               'User-Agent': 'Mozilla/5.0'}
    if byte_range:
        start, end, size = byte_range
        headers['Range'] = f'bytes={start}-{end - 1}'
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
        h = response.headers
        require(h.get('Access-Control-Allow-Origin') == '*', 'Public response needs wildcard CORS')
        require(not h.get('Content-Encoding'), 'Public data must not use HTTP Content-Encoding')
        if urlsplit(url).path.endswith('/current.json'):
            directives = {value.strip().lower() for value in h.get('Cache-Control', '').split(',')}
            require('immutable' not in directives and directives & {'no-cache', 'no-store', 'max-age=0'},
                    'current.json must disable caching or require revalidation')
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


def local_release(directory):
    raw = (directory / 'manifest.json').read_bytes()
    manifest = validate(json.loads(raw))
    for f in manifest['files']:
        path = directory / f['path']
        require(path.is_file() and not path.is_symlink() and path.stat().st_size == f['bytes']
                and digest_file(path) == f['sha256'], 'Local file integrity differs')
    return raw, manifest


def recovery_candidates(ftp, release):
    names = {posixpath.basename(p) for p in ftp.nlst()}
    stages = sorted(p for p in names if re.fullmatch(r'\.upload-' + re.escape(release) + r'-[a-f0-9]{32}', p))
    final = f'releases/{release}'
    if 'releases' in names:
        require(ftp.kind('releases') == 'directory', 'Releases needs a real directory')
        if release in {posixpath.basename(p) for p in ftp.nlst('releases')}:
            stages.append(final)
    return stages


def inspect_release(directory):
    """Report the interrupted release's metadata without modifying the host."""
    raw, manifest = local_release(Path(directory))
    expected = {f['path']: f['bytes'] for f in manifest['files']} | {'manifest.json': len(raw)}
    result = {'release': manifest['release'], 'candidates': []}
    with connection(settings()) as ftp:
        for base in recovery_candidates(ftp, manifest['release']):
            entry = {'path': base, 'kind': ftp.kind(base), 'files': {}}
            if entry['kind'] == 'directory':
                names = {posixpath.basename(p) for p in ftp.nlst(base)}
                for name, size in expected.items():
                    path = base + '/' + name
                    kind = ftp.kind(path) if name in names else 'missing'
                    entry['files'][name] = {'kind': kind, 'expected': size,
                                            'actual': ftp.size(path) if kind == 'file' else None}
            result['candidates'].append(entry)
    return result


def resume_upload(ftp, base, directory, manifest, raw):
    require(ftp.kind(base) == 'directory', 'Resume needs a real directory, not a symlink')
    names = {posixpath.basename(p) for p in ftp.nlst(base)}
    expected = {f['path']: f['bytes'] for f in manifest['files']} | {'manifest.json': len(raw)}
    require(names <= expected.keys(), 'Unexpected files in staging directory')
    sizes = {}
    # Check every partial prefix before writing anything; complete files get full hash verification below.
    for name, size in expected.items():
        path = base + '/' + name
        if name not in names:
            continue
        require(ftp.kind(path) == 'file', 'Resume needs regular files, not symlinks')
        actual = sizes[name] = ftp.size(path)
        require(actual <= size, 'Staged file is larger than local file')
        if actual < size:
            with (directory / name).open('rb') as body:
                def compare(chunk):
                    require(body.read(len(chunk)) == chunk, 'Staged file prefix differs')
                ftp.retrbinary('RETR ' + path, compare)
                require(body.tell() == actual, 'Staged file prefix size changed')
    for name, size in expected.items():
        actual = sizes.get(name)
        if actual == size:
            print(f'Reuse complete {base}/{name}: {size} bytes; full hash verification follows', flush=True)
            continue
        with (directory / name).open('rb') as body:
            body.seek(actual or 0)
            ftp.storbinary('STOR ' + base + '/' + name, body, rest=actual)


def publish(directory, resume=False):
    require(os.environ.get('OSM_ALLOW_PUBLISH') == 'true', 'Publication requires approved OSM_ALLOW_PUBLISH=true')
    directory = Path(directory)
    raw, manifest = local_release(directory)
    config = settings()
    with connection(config) as ftp:
        previous = previous_pointer(ftp)
        release = manifest['release']
        final = f'releases/{release}'
        if resume:
            candidates = recovery_candidates(ftp, release)
            if final in candidates:
                stage = final
                require(ftp.kind(final) == 'directory', 'Release needs a real directory')
                require(all(ftp.kind(final + '/' + f['path']) == 'file' for f in manifest['files'])
                        and ftp.kind(final + '/manifest.json') == 'file', 'Release needs regular files')
            else:
                require(len(candidates) == 1, 'Resume needs exactly one existing stage; inspect before proceeding')
                stage = candidates[0]
                resume_upload(ftp, stage, directory, manifest, raw)
        else:
            if 'releases' not in {posixpath.basename(p) for p in ftp.nlst()}:
                ftp.mkd('releases')
            require(release not in {posixpath.basename(p) for p in ftp.nlst('releases')}, 'Immutable release already exists')
            stage = f'.upload-{release}-{uuid.uuid4().hex}'
            ftp.mkd(stage)
            for f in manifest['files']:
                with (directory / f['path']).open('rb') as body:
                    ftp.storbinary('STOR ' + stage + '/' + f['path'], body)
            ftp.storbinary('STOR ' + stage + '/manifest.json', io.BytesIO(raw))
        samples = verify_remote(ftp, stage, manifest, raw)
        if stage != final:
            if 'releases' not in {posixpath.basename(p) for p in ftp.nlst()}:
                ftp.mkd('releases')
            print(f'Rename verified {stage} to {final}', flush=True)
            ftp.rename(stage, final)
        print('Verify public immutable release before pointer promotion', flush=True)
        probe(config[-2], manifest, raw, samples)
        print('Promote current.json and verify public pointer', flush=True)
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
        probe(config[-2], manifest, raw, samples)
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


def test_host():
    """Check live host SFTP/HTTP with tiny, isolated, automatically removed files."""
    config = settings()
    directory = 'host-test-' + uuid.uuid4().hex
    moved = directory + '-moved'
    body = b'Polku OVH transfer test: ' + bytes(range(32))
    replacement = b'{"test":2}'
    with connection(config) as ftp:
        active = None
        try:
            ftp.mkd(directory)
            active = directory
            ftp.storbinary('STOR ' + active + '/sample.pmtiles', io.BytesIO(body))
            require(ftp.size(active + '/sample.pmtiles') == len(body)
                    and retrieve(ftp, active + '/sample.pmtiles') == body,
                    'Disposable SFTP upload verification failed')
            ftp.storbinary('STOR ' + active + '/pointer.json', io.BytesIO(b'{"test":1}'))
            ftp.storbinary('STOR ' + active + '/pointer.tmp', io.BytesIO(replacement))
            ftp.replace(active + '/pointer.tmp', active + '/pointer.json')
            require(retrieve(ftp, active + '/pointer.json') == replacement,
                    'SFTP POSIX overwrite verification failed')
            ftp.rename(directory, moved)
            active = moved
            require(ftp.size(active + '/sample.pmtiles') == len(body),
                    'SFTP directory rename verification failed')
            sample = get(config[-2] + '/' + active + '/sample.pmtiles',
                         (0, 10, len(body)), immutable=True)
            require(sample == body[:10], 'OVH HTTP Range bytes differ from SFTP upload')
            return {'sftp_write_and_rename': True, 'posix_overwrite': True,
                    'http_range_cors_and_cache': True, 'test_cleanup': 'complete'}
        finally:
            if active is not None:
                # Only remove files in the uniquely named temporary test folder.
                for name in ('sample.pmtiles', 'pointer.tmp', 'pointer.json'):
                    try:
                        ftp.remove(active + '/' + name)
                    except OSError as error:
                        if error.errno != errno.ENOENT:
                            raise
                ftp.rmd(active)


def verify_access():
    """Check protected credentials and the configured path without writing host files."""
    config = settings()
    with connection(config) as ftp:
        ftp.nlst()
    request = urllib.request.Request(config[-2] + '/current.json', method='HEAD',
                                    headers={'Origin': 'https://polku.si', 'User-Agent': 'Mozilla/5.0'})
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
    publication = commands.add_parser('publish')
    publication.add_argument('directory', type=Path)
    publication.add_argument('--resume', action='store_true', help='Reuse the existing stage or immutable release; never start a new upload')
    commands.add_parser('inspect').add_argument('directory', type=Path)
    commands.add_parser('rollback').add_argument('--manifest', type=Path, required=True)
    commands.add_parser('check').add_argument('url')
    commands.add_parser('verify-access')
    commands.add_parser('test-host')
    args = parser.parse_args()
    try:
        if args.command == 'publish':
            publish(args.directory, resume=args.resume)
        elif args.command == 'inspect':
            print(json.dumps(inspect_release(args.directory), sort_keys=True))
            print('Metadata only; no remote files changed or hashes verified.')
            return
        elif args.command == 'rollback':
            rollback(args.manifest)
        elif args.command == 'test-host':
            print(json.dumps(test_host(), sort_keys=True))
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
