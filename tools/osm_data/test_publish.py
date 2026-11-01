"""Publication boundaries use in-memory FTPS and HTTP; no live credentials."""

import copy
from datetime import datetime, timezone
from email.message import Message
import ftplib
import hashlib
import io
import json
from pathlib import Path
import posixpath
import ssl
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import urlsplit

from tools.osm_data import publish


ROOT = '/home/example/www/polku-osm'
PUBLIC = 'https://data.example/polku-osm'
ENV = {'OSM_FTP_HOST': 'ftp.example', 'OSM_FTP_USER': 'user-private',
       'OSM_FTP_PASSWORD': 'password-private', 'OSM_FTP_ROOT': ROOT,
       'OSM_PUBLIC_URL': PUBLIC, 'OSM_ALLOW_PUBLISH': 'true'}
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
        context = kwargs['context']
        if context.verify_mode != ssl.CERT_REQUIRED or not context.check_hostname:
            raise AssertionError('TLS certificate validation disabled')
        self.connections += 1

        class Connection:
            def __init__(self):
                self.path, self.protected = '/', False
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
            def size(self, path):
                path = self.abs(path)
                if path not in host.files:
                    raise ftplib.error_perm('550 missing')
                return len(host.files[path])
            def voidcmd(self, cmd):
                return '200 OK'
            def storbinary(self, cmd, body, *args, **kwargs):
                name = self.abs(cmd.removeprefix('STOR '))
                if host.fail_upload and name.endswith('ways.pmtiles'):
                    raise OSError('upload failed')
                data = body.read()
                host.files[name] = data[:-1] + b'!' if host.corrupt_upload and name.endswith('ways.pmtiles') else data
            def retrbinary(self, cmd, callback, *args, **kwargs):
                name = self.abs(cmd.removeprefix('RETR '))
                if name not in host.files:
                    raise ftplib.error_perm('550 missing')
                callback(host.files[name])
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
        self.enterContext(patch.dict('os.environ', ENV, clear=True))
        self.enterContext(patch.object(publish.ftplib, 'FTP_TLS', self.host.ftp))
        self.enterContext(patch.object(publish.urllib.request, 'urlopen', self.host.http))

    def test_verified_release_switches_pointer_and_saves_previous(self):
        publish.publish(self.release_dir)
        current = json.loads(self.host.files[ROOT + '/current.json'])
        self.assertEqual(current, pointer(self.new))
        self.assertTrue(any(p.read_bytes() == self.previous for p in self.release_dir.glob('rollback*.json')))
        self.assertEqual(self.host.files[ROOT + '/releases/new-release/LICENSE.txt'], LICENSE)
        self.assertFalse(any(p.endswith('.htaccess') for p in self.host.files))

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
                with patch.object(publish.ftplib, 'FTP_TLS', self.host.ftp), patch.object(publish.urllib.request, 'urlopen', self.host.http):
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

    def test_credentials_are_redacted_from_failure(self):
        self.host.denied_login = True
        with self.assertRaises((ValueError, RuntimeError)) as raised:
            publish.publish(self.release_dir)
        self.assertNotIn(ENV['OSM_FTP_USER'], str(raised.exception))
        self.assertNotIn(ENV['OSM_FTP_PASSWORD'], str(raised.exception))


if __name__ == '__main__':
    unittest.main()
