"""Tiny no-cache static server for local development: python3 serve.py [port]"""
import http.server
import os
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # Python's default queue of 5 waiting connections overflowed with a page's burst of module requests, and macOS reset
    # the ones over it: one module missing, and the app never started (#409)
    request_queue_size = 128


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    Server(("127.0.0.1", port), NoCache).serve_forever()
