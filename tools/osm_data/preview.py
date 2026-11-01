"""Preview Polku with a local release: python tools/osm_data/preview.py --release DIR."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


class Preview(SimpleHTTPRequestHandler):
    def __init__(self, *args, release, directory=None, **kwargs):
        self.release = Path(release).resolve()
        self.allowed = {f['path'] for f in json.loads(
            (self.release / 'manifest.json').read_bytes())['files']} | {'manifest.json'}
        self.data = self.immutable = False
        self.remaining = None
        super().__init__(*args, directory=directory or Path(__file__).resolve().parents[2], **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'public, max-age=31536000, immutable'
                         if self.immutable else 'no-cache')
        if self.data:
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Range, If-Match')
            self.send_header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
        super().end_headers()

    def do_OPTIONS(self):
        self.data = unquote(urlsplit(self.path).path).startswith('/__osm/')
        self.send_response(204)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def list_directory(self, path):
        self.send_error(404)

    def send_head(self):
        path = unquote(urlsplit(self.path).path)
        self.remaining = None
        self.data = path == '/__osm' or path.startswith('/__osm/')
        if path == '/js/config.js':
            source = (Path(self.directory) / 'js/config.js').read_text(encoding='utf-8')
            marker = "OSM_DATA_MANIFEST = ''"
            if source.count(marker) != 1:
                return self.send_error(500, 'Expected one empty OSM_DATA_MANIFEST setting')
            url = f'http://127.0.0.1:{self.server.server_port}/__osm/current.json'
            body = source.replace(marker, f"OSM_DATA_MANIFEST = '{url}'").encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            return io.BytesIO(body)
        if not self.data:
            return super().send_head()
        name = path.removeprefix('/__osm/')
        name = 'manifest.json' if name == 'current.json' else name
        file = (self.release / name).resolve()
        if name not in self.allowed or '..' in Path(name).parts or self.release not in file.parents or not file.is_file():
            return self.send_error(404)
        self.immutable = name != 'manifest.json'
        total = file.stat().st_size
        start, end = 0, total - 1
        value = self.headers.get('Range')
        if value is not None:
            match = re.fullmatch(r'bytes=(\d*)-(\d*)', value)
            try:
                if not match or not any(match.groups()):
                    raise ValueError()
                first, last = match.groups()
                start = int(first) if first else max(0, total - int(last))
                end = min(int(last), total - 1) if first and last else total - 1
                if start > end or start >= total or (not first and int(last) == 0):
                    raise ValueError()
            except ValueError:
                self.send_response(416)
                self.send_header('Content-Range', f'bytes */{total}')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return None
        stream = file.open('rb')
        stream.seek(start)
        self.remaining = end - start + 1
        self.send_response(206 if value is not None else 200)
        self.send_header('Content-Type', 'application/octet-stream' if name.endswith('.pmtiles') else self.guess_type(str(file)))
        self.send_header('Content-Length', str(self.remaining))
        self.send_header('Accept-Ranges', 'bytes')
        if value is not None:
            self.send_header('Content-Range', f'bytes {start}-{end}/{total}')
        self.end_headers()
        return stream

    def copyfile(self, source, outputfile):
        if self.remaining is None:
            return super().copyfile(source, outputfile)
        while self.remaining:
            chunk = source.read(min(self.remaining, 1024 * 1024))
            if not chunk:
                break
            outputfile.write(chunk)
            self.remaining -= len(chunk)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--release', type=Path, required=True)
    parser.add_argument('--port', type=int, default=8796)
    args = parser.parse_args()
    handler = partial(Preview, release=args.release.resolve(strict=True))
    with ThreadingHTTPServer(('127.0.0.1', args.port), handler) as server:
        print(f'Polku preview: http://127.0.0.1:{server.server_port}/', flush=True)
        server.serve_forever()
