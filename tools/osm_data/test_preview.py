"""Exercise the local archive preview through real loopback HTTP requests."""

from functools import partial
from http.client import HTTPConnection
from http.server import HTTPServer
import json
from pathlib import Path
import tempfile
from threading import Thread
import unittest

from tools.osm_data.preview import Preview


class PreviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.repo, self.release = root / 'repo', root / 'release'
        (self.repo / 'js').mkdir(parents=True)
        self.release.mkdir()
        self.config = "export const OSM_DATA_MANIFEST = '';\nexport const OTHER = true;\n"
        (self.repo / 'js/config.js').write_text(self.config)
        (self.repo / 'index.html').write_text('Polku preview')
        (self.release / 'ways.pmtiles').write_bytes(b'0123456789abcdef')
        (self.release / 'private.txt').write_text('not listed')
        (root / 'outside.txt').write_text('outside release')
        (self.release / 'escape.pmtiles').symlink_to(root / 'outside.txt')
        self.manifest = json.dumps({'datasets': {'ways': {'url': 'ways.pmtiles'}},
                                    'files': [{'path': 'ways.pmtiles'},
                                              {'path': 'escape.pmtiles'}]}).encode()
        (self.release / 'manifest.json').write_bytes(self.manifest)
        self.server = HTTPServer(('127.0.0.1', 0), partial(
            Preview, release=self.release, directory=self.repo))
        self.thread = Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.close_server)
        self.base = f'http://127.0.0.1:{self.server.server_port}'

    def close_server(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()

    def request(self, path, method='GET', **headers):
        connection = HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        try:
            connection.request(method, path, headers=headers)
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def test_ranges_deliver_original_bytes_and_clamp_the_end(self):
        for value, expected, content_range in [
            ('bytes=3-6', b'3456', 'bytes 3-6/16'),
            ('bytes=12-', b'cdef', 'bytes 12-15/16'),
            ('bytes=-3', b'def', 'bytes 13-15/16'),
            ('bytes=14-999', b'ef', 'bytes 14-15/16'),
        ]:
            with self.subTest(value=value):
                status, headers, body = self.request('/__osm/ways.pmtiles',
                    Range=value, **{'Accept-Encoding': 'gzip, br'})
                self.assertEqual((status, body), (206, expected))
                self.assertEqual(headers['Content-Range'], content_range)
                self.assertEqual(int(headers['Content-Length']), len(expected))
                self.assertEqual(headers['Access-Control-Allow-Origin'], '*')
                self.assertIn('Content-Range', headers['Access-Control-Expose-Headers'])
                self.assertIn('immutable', headers['Cache-Control'])
                self.assertEqual(headers['Accept-Ranges'], 'bytes')
                self.assertNotIn('Content-Encoding', headers)

    def test_invalid_or_outside_ranges_return_416(self):
        for value in ['bytes=16-', 'bytes=7-2', 'bytes=-0', 'bytes=-',
                      'bytes=0-1,4-5', 'invalid']:
            with self.subTest(value=value):
                status, headers, _ = self.request('/__osm/ways.pmtiles', Range=value)
                self.assertEqual(status, 416)
                self.assertEqual(headers['Content-Range'], 'bytes */16')

    def test_head_matches_get_headers_without_body(self):
        for extra, expected in [({}, 200), ({'Range': 'bytes=2-5'}, 206)]:
            status, headers, body = self.request('/__osm/ways.pmtiles', 'HEAD', **extra)
            self.assertEqual((status, body), (expected, b''))
            self.assertEqual(headers['Content-Length'], '16' if expected == 200 else '4')

    def test_manifest_and_config_are_served_without_changing_source(self):
        status, headers, body = self.request('/__osm/current.json')
        self.assertEqual((status, body), (200, self.manifest))
        self.assertEqual(headers['Content-Type'], 'application/json')
        self.assertIn('no-cache', headers['Cache-Control'])
        status, headers, body = self.request('/js/config.js')
        self.assertEqual(status, 200)
        self.assertIn(f"OSM_DATA_MANIFEST = '{self.base}/__osm/current.json'", body.decode())
        self.assertIn('export const OTHER = true;', body.decode())
        self.assertIn('no-cache', headers['Cache-Control'])
        self.assertEqual((self.repo / 'js/config.js').read_text(), self.config)
        self.assertEqual(self.request('/index.html')[2], b'Polku preview')

    def test_data_namespace_blocks_unlisted_files_traversal_and_symlink_escape(self):
        for path in ['/__osm/', '/__osm/private.txt', '/__osm/../outside.txt',
                     '/__osm/%2e%2e/outside.txt', '/__osm/escape.pmtiles']:
            with self.subTest(path=path):
                self.assertEqual(self.request(path)[0], 404)
        status, headers, _ = self.request('/__osm/ways.pmtiles', 'OPTIONS')
        self.assertEqual(status, 204)
        self.assertEqual(headers['Access-Control-Allow-Origin'], '*')
        self.assertIn('Range', headers['Access-Control-Allow-Headers'])


if __name__ == '__main__':
    unittest.main()
