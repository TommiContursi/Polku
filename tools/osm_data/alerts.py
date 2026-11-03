"""Assigned, deduplicated GitHub incidents for trusted OSM operations."""
import argparse
import json
import os
from pathlib import Path
import re
import urllib.request
from urllib.error import HTTPError

OPERATIONS={'build':'update','publish-existing':'update','resume-existing':'update','check':'health','rollback':'rollback'}
TITLES={'update':'OSM data update failed','health':'OSM data health check failed','rollback':'OSM data rollback failed','test':'OSM alert delivery test'}


def classify(event,repository,jobs=None):
    run=event.get('workflow_run',{})
    if (run.get('name')!='Polku OSM data' or run.get('head_branch')!='main'
        or run.get('head_repository',{}).get('full_name')!=repository
        or run.get('event') not in {'schedule','workflow_dispatch'}): return None
    title=run.get('display_title','')
    if not title.startswith('OSM data / '): return None
    operation=title.removeprefix('OSM data / ')
    if operation not in OPERATIONS or run.get('conclusion') in {'neutral','skipped'}: return None
    url=run.get('html_url','')
    if not re.fullmatch(r'https://github\.com/'+re.escape(repository)+r'/actions/runs/[0-9]+',url):
        raise ValueError('Invalid operations run URL')
    failed=run.get('conclusion')!='success'
    reason=run.get('conclusion','missing conclusion')
    if operation=='build' and not failed:
        failed=not any(job.get('name')=='publish' and job.get('conclusion')=='success' for job in (jobs or []))
        if failed: reason='build completed without successful publication'
    return {'kind':OPERATIONS[operation],'failed':failed,'url':url,'reason':reason,'operation':operation}


def update_incident(api,repository,incident):
    kind=incident['kind'];marker='<!-- polku-osm-incident:'+kind+' -->'
    issues=api.request('GET','/repos/'+repository+'/issues?state=open&labels=watch&creator=github-actions%5Bbot%5D&per_page=100')
    if len(issues)>=100: raise RuntimeError('Too many open bot watch issues; inspect alert deduplication')
    matching=[issue for issue in issues if marker in (issue.get('body') or '')
              and issue.get('user',{}).get('login')=='github-actions[bot]' and not issue.get('pull_request')]
    if len(matching)>1: raise RuntimeError('Duplicate OSM incidents; inspect before updating')
    issue=matching[0] if matching else None
    if incident['failed']:
        body=(marker+'\n\n'+('This is an intentional delivery test, not a production outage.\n\n' if kind=='test' else '')
              +'The '+incident['operation']+' operation needs attention: '+incident['reason']+'.\n\n'
              +'Latest run: '+incident['url']+'\n\n'
              +'Open the failed job for diagnostics. Publication verifies before switching; a failed build/transfer keeps the previous release. '
              +'A health failure can affect users; Polku retains cached/Overpass fallback and explicit missing-data states. '
              +'This issue updates on repeated failure and closes after the corresponding successful recovery. A healthy old release does not clear a failed update.')
        if issue:
            api.request('PATCH','/repos/'+repository+'/issues/'+str(issue['number']),{'body':body})
        else:
            issue=api.request('POST','/repos/'+repository+'/issues',{'title':TITLES[kind],'body':body,'labels':['watch'],
                                                                  'assignees':[repository.split('/')[0]]})
    elif issue:
        path='/repos/'+repository+'/issues/'+str(issue['number'])
        api.request('POST',path+'/comments',{'body':'Recovered and verified: '+incident['url']})
        api.request('PATCH',path,{'state':'closed','state_reason':'completed'})
    return issue['number'] if issue else None


class GitHub:
    def __init__(self,token):
        if not token: raise ValueError('Missing operations GitHub token')
        self.token=token

    def request(self,method,path,body=None):
        request=urllib.request.Request('https://api.github.com'+path,method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={'Authorization':'Bearer '+self.token,'Accept':'application/vnd.github+json',
                     'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json','User-Agent':'Polku-OSM-operations'})
        try:
            with urllib.request.urlopen(request,timeout=20) as response:
                return json.load(response)
        except HTTPError as error:
            raise RuntimeError('GitHub operations API returned HTTP '+str(error.code)) from None


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--test',choices=['failure','recovery'])
    args=parser.parse_args();repository=os.environ['GITHUB_REPOSITORY']
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repository): raise ValueError('Invalid repository')
    api=GitHub(os.environ.get('GITHUB_TOKEN',''))
    if args.test:
        run=os.environ['GITHUB_RUN_ID']
        if not run.isdigit(): raise ValueError('Invalid test run ID')
        incident={'kind':'test','failed':args.test=='failure','reason':'intentional test','operation':'alert delivery test',
                  'url':'https://github.com/'+repository+'/actions/runs/'+run}
    else:
        event=json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
        incident=classify(event,repository)
        if incident and incident['operation']=='build' and event['workflow_run']['conclusion']=='success':
            run=event['workflow_run']['id']
            if type(run) is not int or run<=0: raise ValueError('Invalid run ID')
            jobs=api.request('GET','/repos/'+repository+'/actions/runs/'+str(run)+'/jobs?per_page=100')['jobs']
            incident=classify(event,repository,jobs=jobs)
    if incident:
        number=update_incident(api,repository,incident)
        print(json.dumps({'kind':incident['kind'],'failed':incident['failed'],'issue':number}))
    else: print('No trusted OSM operations incident to report')


if __name__=='__main__': main()
