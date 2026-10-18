"""The jobs of .github/workflows/smoke.yml, as a GitHub Actions matrix on stdout ("matrix=…").

python3 .github/smoke_plan.py            the shards in .github/smoke-shards.json, after checking
                                         that every group and size is in exactly one of them
python3 .github/smoke_plan.py fit quick  one job with just these groups and sizes

Exits 1, saying why, when a group or size is in no shard or in two, or a name is unknown:
a new group must never be left out of CI without a word (#262).
"""
import json
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(here, '..', 'tools'))
import smoke  # noqa: E402

known = [n for n, _, _ in smoke.GROUPS] + smoke.SIZES
args = ' '.join(sys.argv[1:]).split()

if args:
    unknown = [a for a in args if a not in known]
    if unknown:
        sys.exit(f"No smoke group or size called {', '.join(unknown)}. Groups and sizes: {' '.join(known)}")
    shards = [args]
else:
    shards = json.load(open(os.path.join(here, 'smoke-shards.json')))['shards']
    named = [n for s in shards for n in s]
    problems = [f'{n} is in no job' for n in known if n not in named]
    problems += [f'{n} is in {named.count(n)} jobs' for n in dict.fromkeys(named) if named.count(n) > 1]
    problems += [f'{n} is no smoke group or size' for n in dict.fromkeys(named) if n not in known]
    if problems:
        sys.exit('.github/smoke-shards.json: ' + '; '.join(problems) + '. Every group and size goes in exactly one job.')

matrix = {'include': [{'shard': str(i + 1), 'groups': ' '.join(s)} for i, s in enumerate(shards)]}
print('matrix=' + json.dumps(matrix))
print(f'jobs={len(shards)}')
for m in matrix['include']:
    print(f"job {m['shard']}: {m['groups']}", file=sys.stderr)
