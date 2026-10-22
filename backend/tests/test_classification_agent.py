import unittest
from unittest.mock import patch
from services import classification_agent as agent


def row(id='obs:one'):
    return {'posting':{'id':id,'posting_id':'p:one','title':'Java软件开发工程师','description':'使用 Java 开发后端服务',
                       'role_name':'待归类岗位','role_id':'role:unknown','source':'测试来源'},
            'skills':[{'name':'Java','id':'skill:java'}]}

def proposal():
    return {'decision':'classify','nature':'工程开发','role':'Java与JVM开发','reason':'标题和正文明确包含 Java 开发职责',
            'quotes':['Java软件开发工程师'],'confidence':0.8}

class ClassificationTests(unittest.TestCase):
    def test_abandoned_generation_is_retryable(self):
        with patch.object(agent,'query',return_value=[{'item':{'id':'obs:one','status':'generating','started_at':'2000-01-01T00:00:00+00:00'}}]):
            self.assertTrue(agent.records()['obs:one']['retryable'])

    def test_only_known_categories_and_literal_evidence_are_accepted(self):
        self.assertEqual(agent.validate_proposal(proposal(),row())['nature'],'工程开发')
        for bad in ({'role':'捏造的岗位方向'},{'quotes':['原文没有这句话']},{'confidence':float('nan')},{'confidence':True}):
            with self.assertRaises(ValueError):agent.validate_proposal({**proposal(),**bad},row())

    def test_insufficient_does_not_force_a_classification(self):
        value=agent.validate_proposal({**proposal(),'decision':'insufficient','quotes':[]},row())
        self.assertEqual(value['nature'],'');self.assertEqual(value['role'],'')

    def test_approved_overlay_is_bound_to_exact_source_observation(self):
        approved={'id':'obs:one','decision':'classify','approved_nature':'工程开发','approved_role':'Java与JVM开发'}
        with patch.object(agent,'query',return_value=[{'item':approved}]):
            original=row();new_version=row('obs:two');result=agent.apply_approved([original,new_version])
        self.assertEqual(result[0]['posting']['role_name'],'Java与JVM开发')
        self.assertEqual(result[1]['posting']['role_name'],'待归类岗位')
        self.assertEqual(original['posting']['role_name'],'待归类岗位')

    def test_non_it_approval_excludes_only_that_observation(self):
        with patch.object(agent,'query',return_value=[{'item':{'id':'obs:one','decision':'non_it'}}]):
            result=agent.apply_approved([row(),row('obs:two')])
        self.assertEqual([x['posting']['id'] for x in result],['obs:two'])

    def test_version_conflict_prevents_second_reviewer_overwrite(self):
        with patch.object(agent,'source_row',return_value=row()),patch.object(agent,'ensure_store'),patch.object(agent,'query',return_value=[]):
            with self.assertRaises(agent.ReviewConflict):agent.decide('obs:one','approve',1,'classify','工程开发','Java与JVM开发','已核对原文',1)

    def test_agent_persists_pending_not_approved(self):
        calls=[]
        def query(text,**params):
            calls.append((text,params))
            return [{'version':1}]
        with patch.object(agent,'source_row',return_value=row()),patch.object(agent,'context_rows',return_value=[row()]),patch.object(agent,'ensure_store'),patch.object(agent,'query',side_effect=query),patch.object(agent,'detail',return_value={}),patch('services.llm.complete',return_value={'raw':proposal(),'mock':False,'model':'test-model'}):
            agent.generate('obs:one',1)
        saved=[text for text,params in calls if 'suggestion_json=$suggestion' in text]
        self.assertTrue(saved);self.assertIn("status='pending'",saved[0])
        self.assertFalse(any("status='approved'" in text for text,params in calls))

    def test_invalid_llm_output_records_failure_without_applying(self):
        calls=[]
        def query(text,**params):calls.append(text);return [{'version':1}]
        with patch.object(agent,'source_row',return_value=row()),patch.object(agent,'context_rows',return_value=[row()]),patch.object(agent,'ensure_store'),patch.object(agent,'query',side_effect=query),patch('services.llm.complete',return_value={'raw':{**proposal(),'quotes':['编造引文']},'mock':False}):
            with self.assertRaises(ValueError):agent.generate('obs:one',1)
        self.assertTrue(any("status='failed'" in text for text in calls))
        self.assertFalse(any("status='pending'" in text for text in calls))

if __name__=='__main__':unittest.main()
