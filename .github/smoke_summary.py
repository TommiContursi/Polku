"""The summary of .github/workflows/smoke.yml, in Markdown on stdout: the result, the Chrome
version, every FAIL with its detail lines, the time per step, and the requests per host.

python3 .github/smoke_summary.py smoke.log --netlog DIR --save-hosts hosts.tsv   one job
python3 .github/smoke_summary.py */smoke.log --hosts */hosts.tsv                 all of them
"""
import argparse
import collections
import glob
import json
import os
import re

ap = argparse.ArgumentParser()
ap.add_argument('logs', nargs='+')
ap.add_argument('--netlog', help="a folder of Chrome net logs, to count the requests in")
ap.add_argument('--hosts', nargs='*', default=[], help='requests per host already counted (host<TAB>n)')
ap.add_argument('--save-hosts', help='where to write the requests per host')
ap.add_argument('--jobs', type=int, help='how many jobs should have left a log')
a = ap.parse_args()

log = []
for path in a.logs:
    log += open(path, encoding='utf-8', errors='replace').read().splitlines()
ok = sum(line.startswith('ok  ') for line in log)
fails = []
for i, line in enumerate(log):
    if line.startswith('FAIL'):
        block = [line]
        for more in log[i + 1:]:
            if not more[:1].isspace():  # its detail lines, and a stack trace's
                break
            block.append(more)
        fails.append('\n'.join(block))
times = [m.groups() for m in (re.match(r'time (.+) (\d+) s$', line) for line in log) if m]
chrome = sorted({line.strip() for line in log if line.startswith('Chrome ')}) or ['Chrome: not logged']

lost = a.jobs and a.jobs > len(a.logs)
out = [f"## Smoke suite: {'passed' if not fails and ok and not lost else 'failed'}", '']
if lost:
    out += [f'**Only {len(a.logs)} of {a.jobs} jobs left a log:** see the failed jobs.', '']
out += [f"{ok} checks ok, {len(fails)} FAIL, {sum(int(s) for _, s in times) // 60} min in the steps. {', '.join(chrome)}.", '']
if fails:
    out += ['### FAIL', '', '```', '\n'.join(fails), '```', '']
if times:
    out += ['### Time per step', '', '| Step | s |', '| --- | ---: |'] + [f'| {n} | {s} |' for n, s in times] + ['']

hosts = collections.Counter()
for path in a.hosts:
    for line in open(path, encoding='utf-8'):
        h, _, n = line.strip().partition('\t')
        if n.isdigit():
            hosts[h] += int(n)
# from Chrome's net logs (one per Chrome the suite started)
for path in glob.glob(os.path.join(a.netlog, '*.json')) if a.netlog else []:
    start = None
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            line = line.strip().rstrip(',')
            if start is None and line.startswith('{"constants"'):
                try:
                    start = json.loads(line.split(',"events"')[0] + '}')['constants']['logEventTypes']['URL_REQUEST_START_JOB']
                except Exception:
                    start = -1
                continue
            if f'"type":{start}' not in line or '"url"' not in line:
                continue
            try:
                url = json.loads(line)['params']['url']
            except Exception:
                continue
            m = re.match(r'https?://([^/:]+)', url)
            if m and m.group(1) not in ('localhost', '127.0.0.1'):
                hosts[m.group(1)] += 1
if a.save_hosts:
    with open(a.save_hosts, 'w', encoding='utf-8') as f:
        f.writelines(f'{h}\t{n}\n' for h, n in hosts.most_common())
if hosts:
    own = re.compile(r'(^|\.)(google\.com|googleapis\.com|gstatic\.com|gvt1\.com|googleusercontent\.com)$')
    chromes = sum(n for h, n in hosts.items() if own.search(h))
    out += [f'### Requests to other hosts: {sum(hosts.values()) - chromes}', '',
            f"Every request the pages made, those Chrome's cache answered too; not counting Chrome's own {chromes} to Google.", '',
            '| Host | Requests |', '| --- | ---: |']
    out += [f'| {h} | {n} |' for h, n in hosts.most_common() if not own.search(h)] + ['']
print('\n'.join(out))
