import unittest,sys
from pathlib import Path
from types import SimpleNamespace as NS
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from usage_audit import UsageMeter,attach_usage_meter
def response(tokens=30):return NS(usage=NS(model_dump=lambda:{'prompt_tokens':tokens-10,'completion_tokens':10,'total_tokens':tokens}))
def client(fn):return NS(chat=NS(completions=NS(create=fn)),close=lambda:None)
class AuditTests(unittest.TestCase):
 def test_unknown_is_not_zero(self):
  m=UsageMeter().attach(client(lambda **kw:NS(usage=None)));m.client.chat.completions.create()
  self.assertIsNone(m.snapshot()['total']);self.assertEqual(m.snapshot()['unknownCalls'],1)
 def test_reported_usage_is_counted_once(self):
  m=UsageMeter().attach(client(lambda **kw:response()));m.client.chat.completions.create()
  self.assertEqual(m.snapshot()['total'],30);self.assertEqual(m.snapshot()['calls'],1)
 def test_stream_usage_is_observed_without_changing_chunks(self):
  chunks=[NS(usage=None,content='hello'),response(55)]
  m=UsageMeter().attach(client(lambda **kw:iter(chunks)));result=list(m.client.chat.completions.create(stream=True))
  self.assertEqual(result,chunks);self.assertEqual(m.snapshot()['total'],55)
 def test_partial_error_retains_reported_lower_bound(self):
  def call(**kw):
   if kw.get('fail'):raise RuntimeError('fixture failure')
   return response(40)
  m=UsageMeter().attach(client(call));m.client.chat.completions.create()
  with self.assertRaises(RuntimeError):m.client.chat.completions.create(fail=True)
  self.assertIsNone(m.snapshot()['total']);self.assertEqual(m.snapshot()['knownTotal'],40);self.assertEqual(m.snapshot()['unknownCalls'],1)
 def test_independent_clients_never_include_each_other(self):
  a=UsageMeter().attach(client(lambda **kw:response(30)));b=UsageMeter().attach(client(lambda **kw:response(70)))
  a.client.chat.completions.create();b.client.chat.completions.create();self.assertEqual(a.snapshot()['total'],30);self.assertEqual(b.snapshot()['total'],70)
 def test_request_factory_handles_cached_and_rebuilt_clients_once(self):
  cached=client(lambda **kw:response(30));rebuilt=client(lambda **kw:response(50))
  agent=NS(_create_request_openai_client=lambda **kw:rebuilt if kw.get('reason')=='retry' else cached)
  meter=attach_usage_meter(agent)
  for reason in ['first','cached','retry']:agent._create_request_openai_client(reason=reason).chat.completions.create()
  self.assertEqual(meter.snapshot()['calls'],3);self.assertEqual(meter.snapshot()['total'],110)
 def test_no_observed_request_is_not_reported_as_zero_tokens(self):
  m=UsageMeter();self.assertIsNone(m.snapshot()['total']);self.assertEqual(m.snapshot()['calls'],0)
if __name__=='__main__':unittest.main()
