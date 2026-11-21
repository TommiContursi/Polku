"""Tiny no-cache static server for local development: python3 serve.py [port] [--site]

--site serves the built site (site/, from tools/site.sh) as Cloudflare would: with site/_headers' headers, and the
content security policy enforced rather than report-only, so the smoke groups test the policy too. A violation, the
pages' or the workers', is printed as "CSP violation: …" (reported to this server only; the published site collects
none, since a report carries the page's address and share links' positions). /tools/ still comes from the checkout, for
the smoke checks' fixtures and helpers (#115)."""
import http.server
import json
import os
import re
import sys
from urllib.parse import urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, 'site')


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Built(NoCache):
    def translate_path(self, path):
        self.directory = ROOT if urlsplit(path).path.startswith('/tools/') else SITE
        return super().translate_path(path)

    def guess_type(self, path):
        # a Content-Type rule replaces the guessed type, as on Cloudflare
        url = urlsplit(self.path).path
        return next((v for p, n, v in RULES if n == 'Content-Type' and p.match(url)), None) or super().guess_type(path)

    def end_headers(self):
        path, sent = urlsplit(self.path).path, []
        for pattern, name, value in RULES:
            if pattern.match(path) and name != 'Content-Type':
                # "! Name" removes what earlier rules added, as on Cloudflare
                sent = [h for h in sent if h[0] != name] if value is None else sent + [(name, value)]
        for name, value in sent:
            self.send_header(name, value + ('; report-uri /__csp' if name == 'Content-Security-Policy' else ''))
        super().end_headers()

    def do_POST(self):
        if self.path != '/__csp':
            return self.send_error(405)
        r = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or '{}').get('csp-report', {})
        print(f"CSP violation: {r.get('effective-directive') or r.get('violated-directive')} blocked {r.get('blocked-uri')} "
              f"in {r.get('document-uri')} ({r.get('source-file', '')}:{r.get('line-number', '')})", file=sys.stderr, flush=True)
        self.send_response(204)
        self.end_headers()


def rules(file):
    """site/_headers as (path pattern, header, value): a pattern line, then its indented 'Name: value' lines"""
    out, pattern = [], None
    for line in open(file, encoding='utf-8'):
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        if not line[0].isspace():
            pattern = re.compile('^' + re.escape(line.strip()).replace(r'\*', '.*') + '$')
            continue
        if line.strip().startswith('!'):
            out.append((pattern, line.strip()[1:].strip(), None))
            continue
        name, value = (s.strip() for s in line.split(':', 1))
        out.append((pattern, 'Content-Security-Policy' if name == 'Content-Security-Policy-Report-Only' else name, value))
    return out


class Server(http.server.ThreadingHTTPServer):
    # Python's default queue of 5 waiting connections overflowed with a page's burst of module requests, and macOS reset
    # the ones over it: one module missing, and the app never started (#409)
    request_queue_size = 128


if __name__ == "__main__":
    os.chdir(ROOT)
    args = [a for a in sys.argv[1:] if a != '--site']
    port = int(args[0]) if args else 8765
    if '--site' in sys.argv:
        RULES = rules(os.path.join(SITE, '_headers'))
    Server(("127.0.0.1", port), Built if '--site' in sys.argv else NoCache).serve_forever()
