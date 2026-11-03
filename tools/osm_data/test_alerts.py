"""Operations failures reach one assigned incident and recover independently."""
import copy
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from tools.osm_data import alerts

REPO='TommiContursi/Polku'


def event(operation='build',conclusion='failure',branch='main'):
    return {'repository':{'full_name':REPO},'workflow':{'path':'.github/workflows/osm-data.yml'},'workflow_run':{'name':'OSM data / '+operation,'path':'.github/workflows/osm-data.yml','head_branch':branch,
        'head_repository':{'full_name':REPO},'event':'workflow_dispatch','display_title':'OSM data / '+operation,
        'id':123,'html_url':'https://github.com/'+REPO+'/actions/runs/123','conclusion':conclusion}}


class API:
    def __init__(self): self.issues=[];self.comments=[];self.created=0
    def request(self,method,path,body=None):
        if method=='GET': return [copy.deepcopy(i) for i in self.issues if i['state']=='open']
        if path.endswith('/comments'): self.comments.append(body);return {}
        if method=='POST':
            self.created+=1;value=dict(body,number=self.created,state='open',user={'login':'github-actions[bot]'})
            self.issues.append(value);return value
        issue=next(i for i in self.issues if path.endswith('/'+str(i['number'])));issue.update(body);return issue


class AlertTests(unittest.TestCase):
    def test_api_failure_is_visible_without_disclosing_token(self):
        api=alerts.GitHub('private-test-token')
        with patch.object(alerts.urllib.request,'urlopen',side_effect=HTTPError('https://api.github.com',403,'denied',{},None)):
            with self.assertRaisesRegex(RuntimeError,'HTTP 403') as error: api.request('GET','/repos/'+REPO+'/issues')
        self.assertNotIn('private-test-token',str(error.exception))

    def test_alert_workflow_never_runs_untrusted_code_with_write_permissions(self):
        workflow=(Path(__file__).resolve().parents[2]/'.github/workflows/osm-data-alerts.yml').read_text()
        condition=next(line.split('if:',1)[1].strip() for line in workflow.splitlines() if line.strip().startswith('if:'))
        self.assertIn('ref: main',workflow)
        self.assertNotIn('head_sha',workflow)
        for event,ref,branch,head,source,expected in [
            ('workflow_dispatch','refs/heads/main','main',REPO,'',True),
            ('workflow_dispatch','refs/heads/feature','main',REPO,'',False),
            ('workflow_run','refs/heads/main','main',REPO,'schedule',True),
            ('workflow_run','refs/heads/main','feature',REPO,'schedule',False),
            ('workflow_run','refs/heads/main','main','attacker/Polku','schedule',False),
            ('workflow_run','refs/heads/main','main',REPO,'pull_request',False)]:
            expression=condition
            for name,value in [('github.event.workflow_run.head_repository.full_name',head),('github.event.workflow_run.head_branch',branch),('github.event.workflow_run.event',source),('github.event_name',event),('github.repository',REPO),('github.ref',ref)]:
                expression=expression.replace(name,repr(value))
            self.assertEqual(eval(expression.replace('&&','and').replace('||','or'),{'__builtins__':{}}),expected)

    def test_only_trusted_main_operations_are_classified(self):
        self.assertEqual(alerts.classify(event(),REPO)['kind'],'update')
        for patch in [dict(head_branch='feature'),dict(event='pull_request'),dict(head_repository={'full_name':'attacker/Polku'}),dict(path='.github/workflows/other.yml')]:
            data=event();data['workflow_run'].update(patch);self.assertIsNone(alerts.classify(data,REPO))
        self.assertIsNone(alerts.classify(event('inspect-existing'),REPO))

    def test_webhook_uses_dynamic_run_name_and_workflow_path(self):
        data=event('check');del data['workflow_run']['display_title'];del data['workflow_run']['path']
        incident=alerts.classify(data,REPO)
        self.assertEqual(incident['kind'],'health');self.assertTrue(incident['failed'])

    def test_successful_build_without_publication_is_not_a_recovery(self):
        result=alerts.classify(event(conclusion='success'),REPO,jobs=[{'name':'publish','conclusion':'skipped'}])
        self.assertTrue(result['failed'])
        result=alerts.classify(event(conclusion='success'),REPO,jobs=[{'name':'publish','conclusion':'success'}])
        self.assertFalse(result['failed'])

    def test_cancellation_alerts_and_neutral_does_not_close_incidents(self):
        self.assertTrue(alerts.classify(event(conclusion='cancelled'),REPO)['failed'])
        self.assertIsNone(alerts.classify(event(conclusion='neutral'),REPO))

    def test_failure_is_assigned_and_repeated_failure_does_not_spam(self):
        api=API();incident=alerts.classify(event(),REPO)
        alerts.update_incident(api,REPO,incident);alerts.update_incident(api,REPO,incident)
        self.assertEqual(api.created,1);self.assertEqual(api.comments,[])
        self.assertEqual(api.issues[0]['assignees'],['TommiContursi'])
        self.assertIn('watch',api.issues[0]['labels'])
        self.assertIn('actions/runs/123',api.issues[0]['body'])

    def test_health_recovery_does_not_close_failed_update(self):
        api=API();alerts.update_incident(api,REPO,alerts.classify(event(),REPO))
        alerts.update_incident(api,REPO,alerts.classify(event('check','success'),REPO))
        self.assertEqual(api.issues[0]['state'],'open')
        alerts.update_incident(api,REPO,alerts.classify(event('build','success'),REPO,jobs=[{'name':'publish','conclusion':'success'}]))
        self.assertEqual(api.issues[0]['state'],'closed');self.assertEqual(len(api.comments),1)

    def test_healthy_runs_without_incidents_do_not_write(self):
        api=API();alerts.update_incident(api,REPO,alerts.classify(event('check','success'),REPO))
        self.assertEqual(api.created,0);self.assertEqual(api.comments,[])

    def test_unrelated_empty_issue_body_does_not_block_alerts(self):
        api=API();api.issues.append({'number':99,'body':None,'state':'open','user':{'login':'github-actions[bot]'}})
        alerts.update_incident(api,REPO,alerts.classify(event(),REPO))
        self.assertEqual(api.created,1)

    def test_user_issue_with_matching_marker_is_not_edited(self):
        api=API();issue={'number':99,'body':'<!-- polku-osm-incident:health -->','state':'open','user':{'login':'TommiContursi'}}
        api.issues.append(issue);alerts.update_incident(api,REPO,alerts.classify(event('check'),REPO))
        self.assertEqual(api.created,1);self.assertEqual(issue['body'],'<!-- polku-osm-incident:health -->')

    def test_invalid_run_link_cannot_enter_an_incident(self):
        data=event();data['workflow_run']['html_url']='https://attacker.example/run'
        with self.assertRaises(ValueError): alerts.classify(data,REPO)
