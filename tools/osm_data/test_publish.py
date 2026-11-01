"""Publication boundaries use in-memory SFTP and HTTP; no live credentials."""

import copy
from contextlib import ExitStack
from datetime import datetime, timezone
from email.message import Message
import ftplib
import hashlib
import io
import importlib.util
import json
from pathlib import Path
import posixpath
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import urlsplit

from tools.osm_data import publish
from tools.osm_data.publish import open_sftp as real_open_sftp


ROOT = '/home/example/www/polku-osm'
PUBLIC = 'https://data.example/polku-osm'
ENV = {'OSM_FTP_HOST': 'ftp.example', 'OSM_FTP_USER': 'user-private',
       'OSM_FTP_PASSWORD': 'password-private', 'OSM_FTP_ROOT': ROOT,
       'OSM_PUBLIC_URL': PUBLIC, 'OSM_ALLOW_PUBLISH': 'true',
       'OSM_SFTP_HOST_KEY_SHA256': 'SHA256:' + 'A' * 43}
ARCHIVE = b'PMTiles' + bytes(range(256)) * 40
LICENSE = b'OpenStreetMap contributors, ODbL 1.0\n'


def encoded(value):
    return json.dumps(value, sort_keys=True).encode()


def manifest(release):
    files = [{'path': name, 'bytes': len(data),
              'sha256': hashlib.sha256(data).hexdigest()}
             for name, data in [('ways.pmtiles', ARCHIVE), ('LICENSE.txt', LICENSE)]]
    return {'schema': 1, 'release': release,
            'source': {'timestamp': datetime.now(timezone.utc).isoformat()},
            'datasets': {'ways': {'url': 'ways.pmtiles', 'bytes': len(ARCHIVE),
                                  'sha256': files[0]['sha256']}}, 'files': files}


def pointer(value):
    result = copy.deepcopy(value)
    result['datasets']['ways']['url'] = f"releases/{value['release']}/ways.pmtiles"
    return result


class Response(io.BytesIO):
    def __init__(self, body, status=200, headers=None):
        super().__init__(body)
        self.status = status
        self.headers = Message()
        for name, value in (headers or {}).items():
            self.headers[name] = value


class Host:
    """The server enforces encrypted transfers and keeps atomic rename observable."""
    def __init__(self):
        self.files = {}
        self.dirs = {ROOT, ROOT + '/releases'}
        self.fail_upload = self.corrupt_upload = self.fail_pointer = False
        self.bad_range = self.bad_after_pointer = self.changed_manifest_after_pointer = False
        self.denied_login = False
        self.connections = self.pointer_writes = 0
        self.pointer_cache = 'no-cache'
        self.uploads = []
        self.unsafe = set()
        self.release_headers = {'Access-Control-Allow-Origin': '*',
                                'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
                                'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable'}

    def add_release(self, value, current=False):
        base = ROOT + '/releases/' + value['release']
        self.dirs.add(base)
        self.files.update({base + '/manifest.json': encoded(value),
                           base + '/ways.pmtiles': ARCHIVE, base + '/LICENSE.txt': LICENSE})
        if current:
            self.files[ROOT + '/current.json'] = encoded(pointer(value))

    def ftp(self, *args, **kwargs):
        host = self
        self.connections += 1
        _, user, password, _fingerprint = args
        if self.denied_login:
            raise ftplib.error_perm(f'530 {user} {password}')
        if (user, password) != (ENV['OSM_FTP_USER'], ENV['OSM_FTP_PASSWORD']):
            raise AssertionError('wrong credentials')

        class Connection:
            def __init__(self):
                self.path, self.protected = '/', True
            def connect(self, server, port=21, **kwargs):
                if server != 'ftp.example' or port != 21:
                    raise AssertionError('expected explicit FTPS on port 21')
            def login(self, user, passwd):
                if host.denied_login:
                    raise ftplib.error_perm(f'530 {user} {passwd}')
                if (user, passwd) != (ENV['OSM_FTP_USER'], ENV['OSM_FTP_PASSWORD']):
                    raise AssertionError('wrong credentials')
            def prot_p(self):
                self.protected = True
            def abs(self, path):
                if not self.protected:
                    raise AssertionError('unencrypted data operation')
                return posixpath.normpath(posixpath.join(self.path, path))
            def cwd(self, path):
                path = self.abs(path)
                if path not in host.dirs:
                    raise ftplib.error_perm('550 missing directory')
                self.path = path
            def pwd(self):
                return self.path
            def mkd(self, path):
                path = self.abs(path)
                if path in host.dirs:
                    raise ftplib.error_perm('550 exists')
                host.dirs.add(path)
                return path
            def nlst(self, path='.'):
                base = self.abs(path).rstrip('/') + '/'
                return [p for p in host.files.keys() | host.dirs if p.startswith(base) and '/' not in p[len(base):]]
            def remove(self, path):
                path = self.abs(path)
                if path not in host.files:
                    raise FileNotFoundError(2, 'No such file', path)
                del host.files[path]
            def rmd(self, path):
                path = self.abs(path)
                if path not in host.dirs or any(p.startswith(path + '/') for p in host.files):
                    raise OSError('Directory missing or not empty')
                host.dirs.remove(path)
            def size(self, path):
                path = self.abs(path)
                if path not in host.files:
                    raise ftplib.error_perm('550 missing')
                return len(host.files[path])
            def kind(self, path):
                path = self.abs(path)
                return 'other' if path in host.unsafe else 'directory' if path in host.dirs else 'file'
            def voidcmd(self, cmd):
                return '200 OK'
            def storbinary(self, cmd, body, *args, **kwargs):
                name = self.abs(cmd.removeprefix('STOR '))
                if host.fail_upload and name.endswith('ways.pmtiles'):
                    raise OSError('upload failed')
                data = body.read()
                offset = kwargs.get('rest')
                host.uploads.append((name, offset, len(data)))
                if offset is not None:
                    if len(host.files[name]) != offset:
                        raise OSError('Resume offset changed')
                    data = host.files[name] + data
                host.files[name] = data[:-1] + b'!' if host.corrupt_upload and name.endswith('ways.pmtiles') else data
            def retrbinary(self, cmd, callback, *args, **kwargs):
                name = self.abs(cmd.removeprefix('RETR '))
                if name not in host.files:
                    raise ftplib.error_perm('550 missing')
                callback(host.files[name])
            def replace(self, old, new):
                if new.endswith('/pointer.json'):
                    old, new = self.abs(old), self.abs(new)
                    if host.fail_pointer:
                        raise OSError('POSIX rename extension unsupported')
                    host.files[new] = host.files.pop(old)
                    return
                return self.rename(old, new)
            def rename(self, old, new):
                old, new = self.abs(old), self.abs(new)
                if new == ROOT + '/current.json':
                    if host.fail_pointer:
                        raise ftplib.error_perm('550 atomic overwrite unsupported')
                    host.pointer_writes += 1
                elif new in host.files or new in host.dirs:
                    raise ftplib.error_perm('550 immutable target exists')
                if old in host.files:
                    host.files[new] = host.files.pop(old)
                elif old in host.dirs:
                    host.dirs.remove(old)
                    host.dirs.add(new)
                    for path in list(host.files):
                        if path.startswith(old + '/'):
                            host.files[new + path[len(old):]] = host.files.pop(path)
                else:
                    raise ftplib.error_perm('550 missing rename source')
            def quit(self):
                pass
            close = quit
        return Connection()

    def http(self, req, **kwargs):
        path = urlsplit(req.full_url).path
        name = ROOT + path.removeprefix('/polku-osm')
        if name not in self.files:
            raise HTTPError(req.full_url, 404, 'missing', {}, None)
        if req.get_header('Origin') != 'https://polku.si':
            raise AssertionError('public probe must test app Origin')
        data = self.files[name]
        if self.changed_manifest_after_pointer and self.pointer_writes == 1 and path.endswith('/manifest.json'):
            changed = json.loads(data)
            changed['attribution'] = 'unexpected replacement'
            data = encoded(changed)
        headers = dict(self.release_headers)
        if path.endswith('/current.json'):
            headers['Cache-Control'] = self.pointer_cache
        headers['Content-Type'] = 'application/json' if path.endswith('.json') else 'application/vnd.pmtiles'
        byte_range = req.get_header('Range')
        if byte_range:
            start, end = map(int, byte_range.removeprefix('bytes=').split('-'))
            headers['Content-Range'] = f'bytes {start}-{end}/{len(data)}'
            headers['Content-Length'] = str(end - start + 1)
            bad = self.bad_range or (self.bad_after_pointer and self.pointer_writes == 1)
            return Response(data[start:end + 1], 200 if bad else 206, headers)
        headers['Content-Length'] = str(len(data))
        return Response(data, headers=headers)


class PublishTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.release_dir = Path(self.tmp.name) / 'new-release'
        self.release_dir.mkdir()
        self.new, self.old = manifest('new-release'), manifest('previous-release')
        for name, data in [('ways.pmtiles', ARCHIVE), ('LICENSE.txt', LICENSE), ('manifest.json', encoded(self.new))]:
            (self.release_dir / name).write_bytes(data)
        self.host = Host()
        self.host.add_release(self.old, current=True)
        self.previous = self.host.files[ROOT + '/current.json']
        patches = ExitStack()
        self.addCleanup(patches.close)
        patches.enter_context(patch.dict('os.environ', ENV, clear=True))
        patches.enter_context(patch.object(publish, 'open_sftp', self.host.ftp))
        patches.enter_context(patch.object(publish.urllib.request, 'urlopen', self.host.http))

    def test_verified_release_switches_pointer_and_saves_previous(self):
        publish.publish(self.release_dir)
        current = json.loads(self.host.files[ROOT + '/current.json'])
        self.assertEqual(current, pointer(self.new))
        self.assertTrue(any(p.read_bytes() == self.previous for p in self.release_dir.glob('rollback*.json')))
        self.assertEqual(self.host.files[ROOT + '/releases/new-release/LICENSE.txt'], LICENSE)
        self.assertFalse(any(p.endswith('.htaccess') for p in self.host.files))

    def stage(self, files):
        stage = '.upload-new-release-' + 'a' * 32
        self.host.dirs.add(ROOT + '/' + stage)
        self.host.files.update({ROOT + '/' + stage + '/' + name: data for name, data in files.items()})
        return stage

    def test_inspection_reports_partial_bytes_without_writes_or_approval(self):
        stage = self.stage({'ways.pmtiles': ARCHIVE[:4000]})
        before = dict(self.host.files), set(self.host.dirs)
        with patch.dict('os.environ', {'OSM_ALLOW_PUBLISH': ''}):
            result = publish.inspect_release(self.release_dir)
        self.assertEqual(result['candidates'][0]['path'], stage)
        self.assertEqual(result['candidates'][0]['files']['ways.pmtiles']['actual'], 4000)
        self.assertEqual((self.host.files, self.host.dirs), before)
        self.assertEqual(self.host.uploads, [])

    def test_resume_complete_stage_does_not_reupload_payload(self):
        self.stage({'ways.pmtiles': ARCHIVE, 'LICENSE.txt': LICENSE, 'manifest.json': encoded(self.new)})
        publish.publish(self.release_dir, resume=True)
        self.assertEqual(json.loads(self.host.files[ROOT + '/current.json']), pointer(self.new))
        self.assertTrue(all('/current.' in name for name, _, _ in self.host.uploads))

    def test_resume_partial_stage_verifies_prefix_and_sends_only_missing_suffix(self):
        stage = self.stage({'ways.pmtiles': ARCHIVE[:4000]})
        publish.publish(self.release_dir, resume=True)
        self.assertIn((ROOT + '/' + stage + '/ways.pmtiles', 4000, len(ARCHIVE) - 4000), self.host.uploads)
        self.assertEqual(self.host.files[ROOT + '/releases/new-release/ways.pmtiles'], ARCHIVE)

    def test_resume_rejects_corrupt_or_oversized_prefix_without_writing(self):
        for data in (b'wrong prefix', ARCHIVE + b'!'):
            with self.subTest(length=len(data)):
                self.stage({'ways.pmtiles': data})
                before = dict(self.host.files)
                with self.assertRaisesRegex(RuntimeError, 'prefix|larger'):
                    publish.publish(self.release_dir, resume=True)
                self.assertEqual(self.host.files, before)
                self.assertEqual(self.host.uploads, [])

    def test_resume_still_checks_complete_file_hash_before_promotion(self):
        self.stage({'ways.pmtiles': b'!' + ARCHIVE[1:], 'LICENSE.txt': LICENSE, 'manifest.json': encoded(self.new)})
        with self.assertRaisesRegex(RuntimeError, 'SHA-256'):
            publish.publish(self.release_dir, resume=True)
        self.assertEqual(self.host.files[ROOT + '/current.json'], self.previous)
        self.assertEqual(self.host.uploads, [])

    def test_resume_existing_immutable_release_verifies_without_payload_writes(self):
        self.host.add_release(self.new)
        publish.publish(self.release_dir, resume=True)
        self.assertTrue(all('/current.' in name for name, _, _ in self.host.uploads))

    def test_resume_refuses_missing_ambiguous_or_unsafe_staging(self):
        with self.assertRaisesRegex(RuntimeError, 'exactly one'):
            publish.publish(self.release_dir, resume=True)
        stage = self.stage({'ways.pmtiles': ARCHIVE[:4000]})
        other = ROOT + '/.upload-new-release-' + 'b' * 32
        self.host.dirs.add(other)
        with self.assertRaisesRegex(RuntimeError, 'exactly one'):
            publish.publish(self.release_dir, resume=True)
        self.host.dirs.remove(other)
        for unsafe in (ROOT + '/' + stage, ROOT + '/' + stage + '/ways.pmtiles'):
            self.host.unsafe = {unsafe}
            with self.assertRaisesRegex(RuntimeError, 'regular|directory'):
                publish.publish(self.release_dir, resume=True)
        self.assertEqual(self.host.uploads, [])

    def test_sftp_pipelines_writes_and_bounds_read_prefetch(self):
        events = []
        class File(io.BytesIO):
            def set_pipelined(self, enabled):
                events.append(('pipeline', enabled))
            def stat(self):
                return SimpleNamespace(st_size=len(ARCHIVE))
            def prefetch(self, file_size, max_concurrent_requests):
                events.append(('prefetch', file_size, max_concurrent_requests))
        class SFTP:
            def open(self, path, mode):
                return File(ARCHIVE if mode == 'rb' else b'')
        remote = publish.SFTPFiles(None, SFTP())
        remote.storbinary('STOR sample', io.BytesIO(ARCHIVE))
        chunks = []
        remote.retrbinary('RETR sample', chunks.append)
        self.assertIn(('pipeline', True), events)
        self.assertIn(('prefetch', len(ARCHIVE), 64), events)
        self.assertEqual(b''.join(chunks), ARCHIVE)

    def test_sftp_resume_uses_nontruncating_seek_and_surfaces_close_errors(self):
        events = []
        class File(io.BytesIO):
            def set_pipelined(self, enabled):
                pass
            def close(self):
                events.append(('body', self.getvalue()))
                super().close()
                raise OSError('deferred write error')
        class SFTP:
            def lstat(self, path):
                return SimpleNamespace(st_mode=0o100600)
            def stat(self, path):
                return SimpleNamespace(st_size=4)
            def open(self, path, mode):
                events.append(('open', mode))
                return File(b'abcd')
        remote = publish.SFTPFiles(None, SFTP())
        with self.assertRaisesRegex(OSError, 'deferred write error'):
            remote.storbinary('STOR sample', io.BytesIO(b'efgh'), rest=4)
        self.assertEqual(events, [('open', 'r+b'), ('body', b'abcdefgh')])
        with self.assertRaisesRegex(ValueError, 'offset'):
            remote.storbinary('STOR sample', io.BytesIO(b'efgh'), rest=3)

    def test_host_checks_disposable_files_without_touching_release_or_pointer(self):
        original_files, original_dirs = dict(self.host.files), set(self.host.dirs)
        with patch.dict('os.environ', {'OSM_ALLOW_PUBLISH': ''}):
            result = publish.test_host()
        self.assertTrue(result['sftp_write_and_rename'])
        self.assertTrue(result['posix_overwrite'])
        self.assertTrue(result['http_range_cors_and_cache'])
        self.assertEqual(self.host.files, original_files)
        self.assertEqual(self.host.dirs, original_dirs)
        self.assertEqual(self.host.pointer_writes, 0)

    def test_host_fails_safely_when_posix_overwrite_unsupported(self):
        original_files, original_dirs = dict(self.host.files), set(self.host.dirs)
        self.host.fail_pointer = True
        with self.assertRaisesRegex(RuntimeError, 'POSIX rename extension unsupported'):
            publish.test_host()
        self.assertEqual(self.host.files, original_files)
        self.assertEqual(self.host.dirs, original_dirs)

    def test_public_range_probe_uses_browser_user_agent(self):
        original_http = self.host.http
        def browser_only(request, **kwargs):
            if request.get_header('User-agent') != 'Mozilla/5.0':
                raise HTTPError(request.full_url, 403, 'blocked user agent', {}, None)
            return original_http(request, **kwargs)
        with patch.object(publish.urllib.request, 'urlopen', browser_only):
            body = publish.get(PUBLIC + '/releases/previous-release/ways.pmtiles',
                               (0, 10, len(ARCHIVE)), immutable=True)
        self.assertEqual(body, ARCHIVE[:10])

    def test_unsafe_root_and_missing_approval_fail_before_connect(self):
        for root in ['', '/', '/home/example/www', '/www/../polku-osm', '/www/polku-osm\r\nDELE x']:
            with self.subTest(root=root), patch.dict('os.environ', {'OSM_FTP_ROOT': root}):
                with self.assertRaises(ValueError):
                    publish.publish(self.release_dir)
        with patch.dict('os.environ', {'OSM_ALLOW_PUBLISH': ''}):
            with self.assertRaises(ValueError):
                publish.publish(self.release_dir)
        self.assertEqual(self.host.connections, 0)

    def test_local_corruption_stops_before_connect(self):
        (self.release_dir / 'ways.pmtiles').write_bytes(b'bad')
        with self.assertRaises(ValueError):
            publish.publish(self.release_dir)
        self.assertEqual(self.host.connections, 0)

    def test_upload_hash_and_http_failures_never_switch_pointer(self):
        for failure in ['fail_upload', 'corrupt_upload', 'bad_range']:
            with self.subTest(failure=failure):
                self.host = Host()
                self.host.add_release(self.old, current=True)
                setattr(self.host, failure, True)
                with patch.object(publish, 'open_sftp', self.host.ftp), patch.object(publish.urllib.request, 'urlopen', self.host.http):
                    with self.assertRaises((ValueError, RuntimeError)):
                        publish.publish(self.release_dir)
                self.assertEqual(self.host.files[ROOT + '/current.json'], self.previous)
                self.assertEqual(self.host.pointer_writes, 0)

    def test_existing_release_is_never_overwritten(self):
        self.host.add_release(self.new)
        before = dict(self.host.files)
        with self.assertRaises((ValueError, RuntimeError)):
            publish.publish(self.release_dir)
        self.assertEqual(self.host.files, before)

    def test_unsupported_pointer_overwrite_leaves_previous(self):
        self.host.fail_pointer = True
        with self.assertRaises((ValueError, RuntimeError)):
            publish.publish(self.release_dir)
        self.assertEqual(self.host.files[ROOT + '/current.json'], self.previous)

    def test_failed_post_switch_probe_restores_previous_pointer(self):
        self.host.bad_after_pointer = True
        with self.assertRaises((ValueError, RuntimeError)):
            publish.publish(self.release_dir)
        self.assertEqual(self.host.files[ROOT + '/current.json'], self.previous)

    def test_changed_immutable_manifest_after_promotion_restores_previous(self):
        self.host.changed_manifest_after_pointer = True
        with self.assertRaises((ValueError, RuntimeError)):
            publish.publish(self.release_dir)
        self.assertEqual(self.host.files[ROOT + '/current.json'], self.previous)

    def test_saved_rollback_roundtrip_keeps_both_releases(self):
        publish.publish(self.release_dir)
        saved = next(p for p in self.release_dir.glob('rollback*.json') if p.read_bytes() == self.previous)
        publish.rollback(saved)
        self.assertEqual(json.loads(self.host.files[ROOT + '/current.json']), json.loads(self.previous))
        self.assertIn(ROOT + '/releases/new-release/ways.pmtiles', self.host.files)
        self.assertIn(ROOT + '/releases/previous-release/ways.pmtiles', self.host.files)

    def test_rollback_still_requires_publication_approval(self):
        publish.publish(self.release_dir)
        saved = next(self.release_dir.glob('rollback*.json'))
        files = dict(self.host.files)
        with patch.dict('os.environ', {'OSM_ALLOW_PUBLISH': ''}):
            with self.assertRaisesRegex(ValueError, 'approval|approved'):
                publish.rollback(saved)
        self.assertEqual(self.host.files, files)

    def test_monitor_rejects_old_data_and_invalid_public_headers(self):
        old = pointer(self.old)
        old['source']['timestamp'] = '2000-01-01T00:00:00Z'
        self.host.files[ROOT + '/current.json'] = encoded(old)
        with self.assertRaises(ValueError):
            publish.check(PUBLIC + '/current.json')

        self.host.files[ROOT + '/current.json'] = self.previous
        self.host.release_headers['Access-Control-Allow-Origin'] = 'https://other.example'
        with self.assertRaises(ValueError):
            publish.check(PUBLIC + '/current.json')

    def test_monitor_runs_without_the_sftp_dependency(self):
        original_import = __import__
        def no_sftp(name, *args, **kwargs):
            if name == 'paramiko':
                raise ModuleNotFoundError('SFTP dependency is not installed in monitor jobs')
            return original_import(name, *args, **kwargs)
        with patch('builtins.__import__', side_effect=no_sftp):
            spec = importlib.util.spec_from_file_location('http_monitor', publish.__file__)
            monitor = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(monitor)
            monitor.check(PUBLIC + '/current.json')

    def test_monitor_rejects_an_immutable_or_freshly_cached_current_pointer(self):
        for policy in ['public, max-age=31536000, immutable', 'public, max-age=900', '']:
            with self.subTest(policy=policy):
                self.host.pointer_cache = policy
                with self.assertRaisesRegex(ValueError, 'current.json|revalidat'):
                    publish.check(PUBLIC + '/current.json')

    def test_credentials_are_redacted_from_failure(self):
        self.host.denied_login = True
        with self.assertRaises((ValueError, RuntimeError)) as raised:
            publish.publish(self.release_dir)
        self.assertNotIn(ENV['OSM_FTP_USER'], str(raised.exception))
        self.assertNotIn(ENV['OSM_FTP_PASSWORD'], str(raised.exception))

    def test_access_check_does_not_need_publication_approval_or_write_files(self):
        files, dirs = dict(self.host.files), set(self.host.dirs)
        with patch.dict('os.environ', {'OSM_ALLOW_PUBLISH': ''}):
            result = publish.verify_access()
        self.assertTrue(result['sftp_read_access'])
        self.assertEqual(result['public_status'], 200)
        self.assertEqual((self.host.files, self.host.dirs), (files, dirs))
        self.assertEqual(self.host.pointer_writes, 0)

    def test_access_check_reports_unpublished_http_without_changing_host(self):
        def forbidden(request, **kwargs):
            raise HTTPError(request.full_url, 403, 'forbidden', {}, None)
        files = dict(self.host.files)
        with patch.object(publish.urllib.request, 'urlopen', forbidden):
            result = publish.verify_access()
        self.assertTrue(result['sftp_read_access'])
        self.assertEqual(result['public_status'], 403)
        self.assertFalse(result['public_cors'])
        self.assertEqual(self.host.files, files)

    def test_host_key_mismatch_aborts_before_password_authentication(self):
        class Key:
            def asbytes(self):
                return b'an unexpected SSH host key'
        class Transport:
            authenticated = False
            closed = False
            def start_client(self, timeout=None):
                pass
            def get_remote_server_key(self):
                return Key()
            def auth_password(self, username, password):
                self.authenticated = True
            def close(self):
                self.closed = True
        transport = Transport()
        with patch('paramiko.Transport', return_value=transport):
            with self.assertRaisesRegex(ValueError, 'host key differs'):
                real_open_sftp('ftp.example', 'user', 'secret', ENV['OSM_SFTP_HOST_KEY_SHA256'])
        self.assertFalse(transport.authenticated)
        self.assertTrue(transport.closed)

    def test_missing_host_key_pin_rejects_access_without_connection(self):
        with patch.dict('os.environ', {'OSM_SFTP_HOST_KEY_SHA256': ''}):
            with self.assertRaisesRegex(ValueError, 'OSM_SFTP_HOST_KEY_SHA256'):
                publish.verify_access()
        self.assertEqual(self.host.connections, 0)

    def test_atomic_pointer_replace_uses_posix_rename_only(self):
        class Stub:
            posix_rename_calls = []
            def posix_rename(self, old, new):
                self.posix_rename_calls.append((old, new))
                raise OSError('POSIX rename extension unavailable')
        fake = Stub()
        remote = publish.SFTPFiles(None, fake)
        with self.assertRaisesRegex(OSError, 'extension unavailable'):
            remote.replace('pointer.tmp', 'current.json')
        self.assertEqual(fake.posix_rename_calls, [('pointer.tmp', 'current.json')])


if __name__ == '__main__':
    unittest.main()
