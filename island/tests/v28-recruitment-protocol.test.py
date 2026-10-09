import sys, unittest, json, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from recruited_agent import run_recruitment, checked_steps, PARENT_TOOLS, CHILD_TOOLS

class Registry:
    def __init__(self): self.rows = {}
    def register(self, **kw): self.rows[kw['name']] = kw

class DelegationTests(unittest.TestCase):
    def run_case(self, behavior='normal', packet=None):
        registry=Registry();agents=[]
        class FakeAgent:
            def __init__(self, **kw):
                self.session_id=kw['session_id'];self._parent_session_id=kw['parent_session_id']
                self.model=kw['model'];self._fallback_chain=kw['fallback_model']
                self.valid_tool_names=set(PARENT_TOOLS if self._parent_session_id is None else CHILD_TOOLS)
                if behavior=='leak': self.valid_tool_names.add('document_read')
                self.session_prompt_tokens=30;self.session_completion_tokens=5;self.session_total_tokens=35
                self.session_input_tokens=10;self.session_cache_read_tokens=20;self.session_api_calls=2
                agents.append(self)
            def run_conversation(self, message, **kw):
                call=lambda name,args:json.loads(registry.rows[name]['handler'](args))
                if behavior=='text_only': return {'final_response':'已经完成'}
                if self._parent_session_id is None:
                    ctx=call('recruitment_observe',{})
                    ids=[x['id'] for x in ctx['steps']]
                    first=call('recruitment_delegate',{'stepIds':ids})
                    if behavior=='repeat':
                        second=call('recruitment_delegate',{'stepIds':ids})
                        assert second['replayed'] and second['child']==first['child']
                    if behavior=='parent_failure': return {'failed':True,'error':'network'}
                else:
                    ctx=call('recruitment_observe_child',{})
                    ids=[x['id'] for x in ctx['steps']]
                    if behavior=='invalid_child': ids=['not-allowed']
                    if behavior in ['partial_chain', 'decline_chain']:
                        partial=call('recruitment_take_step',{'stepIds':[ids[-1]],'intent':'只采集，等前置到齐再制作'})
                        assert not partial['ok'] and '前置' in partial['error']
                        if behavior=='decline_chain':return {'final_response':'只愿意采集'}
                    reply=call('recruitment_take_step',{'stepIds':ids,'intent':'真实动作后交付'})
                    if behavior=='invalid_child': assert not reply['ok']
                return {'final_response':'已接受计划，等待到岛'}
        os.environ.setdefault('DEEPSEEK_API_KEY','fixture-no-secret')
        result=run_recruitment(packet or {'payload':{'steps':[{'id':'plan:wood','quantity':2}], 'project':{'id':'plan'}}},FakeAgent,registry)
        return result,agents
    def test_real_constructor_lineage_and_accepted_tool_evidence(self):
        result,agents=self.run_case()
        self.assertEqual(len(agents),2)
        self.assertEqual(agents[1]._parent_session_id,agents[0].session_id)
        self.assertEqual(result['child']['acceptedSteps'],['plan:wood'])
        self.assertEqual(result['parent']['usage']['input']+result['parent']['usage']['output'],35)
        self.assertEqual(result['parent']['usage']['cacheRead'],20)
    def test_duplicate_delegation_uses_same_child(self):
        _,agents=self.run_case('repeat');self.assertEqual(len(agents),2)
    def test_untrusted_child_cannot_accept_nonexistent_work(self):
        with self.assertRaisesRegex(RuntimeError,'没有完成真实子委派'):self.run_case('invalid_child')
    def test_plain_text_success_is_not_execution(self):
        with self.assertRaises(RuntimeError):self.run_case('text_only')
    def test_parent_failure_after_child_acceptance_is_not_success(self):
        with self.assertRaises(RuntimeError):self.run_case('parent_failure')
    def test_document_or_recursive_tool_leak_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError,'tool boundary'):self.run_case('leak')
    def chain_packet(self):
        return {'payload':{'steps':[{'id':'plan:lantern','item':'lantern','quantity':2,'dependsOn':['plan:wax']},{'id':'plan:wax','item':'wax','quantity':2,'dependsOn':[]}], 'project':{'id':'plan','targets':{'lantern':2}}}}
    def test_waiting_final_target_can_be_accepted_before_its_materials(self):
        result,_=self.run_case(packet=self.chain_packet())
        self.assertEqual(result['child']['acceptedSteps'],['plan:lantern','plan:wax'])
    def test_dropped_final_target_requires_a_real_corrected_tool_acceptance(self):
        result,_=self.run_case('partial_chain',self.chain_packet())
        self.assertEqual(result['child']['acceptedSteps'],['plan:lantern','plan:wax'])
        events=[e for e in result['events'] if e['tool']=='recruitment_take_step']
        self.assertEqual([e['status'] for e in events],['rejected','done'])
    def test_declining_final_target_does_not_register_a_complete_chain(self):
        with self.assertRaisesRegex(RuntimeError,'没有完成真实子委派'):self.run_case('decline_chain',self.chain_packet())
    def test_step_limits_and_duplicate_inputs(self):
        for value in [[],['a']*2,['a']*7,['foreign'],[{}],None]:
            with self.assertRaises(ValueError):checked_steps(value,{'a'})
if __name__=='__main__':unittest.main()
