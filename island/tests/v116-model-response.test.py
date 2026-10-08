import io,json,sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from npc_model import ResidentModel,ModelError,parse_model_reply
class ModelReplyTests(unittest.TestCase):
 def test_complete_object_and_single_fence(self):
  for content in [' {"decisions":[]} ','\ufeff{"decisions":[]}','```json\n{"decisions":[]}\n```','```JSON\r\n{"decisions":[]}\r\n```','```\n{"decisions":[]}\n```']:
   with self.subTest(content=content):self.assertEqual(parse_model_reply(content,'stop'),{'decisions':[]})
 def test_partial_ambiguous_or_non_object_replies_rejected(self):
  for content in ['prefix {"decisions":[]}','{"decisions":[]} trailing','{} {}','```json\n{}\n```\n```json\n{}\n```','{"decisions":[','[]','null','1','{"x":NaN}','{"x":Infinity}','{"x":1,"x":2}',None,[]]:
   with self.subTest(content=content),self.assertRaises(ModelError) as caught:parse_model_reply(content,'stop')
   self.assertEqual(caught.exception.code,'model_response_format')
 def test_truncated_finish_is_never_salvaged(self):
  for reason in ['length','content_filter',None]:
   with self.assertRaises(ModelError) as caught:parse_model_reply('{"decisions":[]}',reason)
   self.assertEqual(caught.exception.code,'model_response_incomplete')
 def response(self,content,finish='stop'):
  return {'choices':[{'finish_reason':finish,'message':{'content':content}}],'usage':{'prompt_tokens':10,'completion_tokens':4,'total_tokens':14}}
 def call(self,response):
  requests=[]
  def provider(req,timeout):requests.append(json.loads(req.data));return io.BytesIO(json.dumps(response).encode())
  with patch.dict('os.environ',{'DEEPSEEK_API_KEY':'fixture-key-not-a-secret'}),patch('urllib.request.urlopen',provider):
   model=ResidentModel()
   try:answer=model.complete('Return decisions',{},max_tokens=1200);error=None
   except ModelError as e:answer=None;error=e
  self.assertEqual(len(requests),1);self.assertEqual(requests[0]['model'],'deepseek-flash');self.assertEqual(requests[0]['max_tokens'],1200);self.assertEqual(requests[0]['thinking'],{'type':'disabled'})
  return model,answer,error
 def test_fence_normalization_uses_one_call_and_preserves_usage(self):
  model,answer,error=self.call(self.response('```json\n{"decisions":[]}\n```'))
  self.assertIsNone(error);self.assertEqual(answer,{'decisions':[]});self.assertEqual(model.current_usage()['total'],14);self.assertEqual(model.current_usage()['calls'],1)
 def test_invalid_response_preserves_actual_usage_without_extra_model_calls(self):
  model,answer,error=self.call(self.response('{bad}'));self.assertIsNone(answer);self.assertEqual(error.code,'model_response_format');self.assertEqual(model.current_usage()['total'],14);self.assertEqual(model.current_usage()['calls'],1);self.assertEqual(model.last_success,0)
 def test_malformed_envelopes_are_typed_errors(self):
  for response in [[],{}, {'choices':[]},{'choices':[None]},{'choices':[{'message':None,'finish_reason':'stop'}]}]:
   with self.subTest(response=response):
    model,answer,error=self.call(response);self.assertIsNone(answer);self.assertEqual(error.code,'model_response_format');self.assertEqual(model.current_usage()['calls'],1)
if __name__=='__main__':unittest.main()
