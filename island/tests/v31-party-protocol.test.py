import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from party_protocol import validate_party
class PartyProtocolTest(unittest.TestCase):
 def setUp(self):
  self.world={'party':{'tags':[{'id':'nature'},{'id':'sea'}],'candidates':[{'id':4,'tags':['nature']}],'draft':{'id':'event-1','version':3}}}
  self.args={'name':'花园海风','description':'一起等潮汐','tags':['nature'],'difficulty':'easy','guestId':4,'guestReason':'莉安熟悉花园布置'}
 def test_valid_and_bound_to_observed_version(self):
  r=validate_party(self.args,self.world,True);self.assertTrue(r['ok']);self.assertEqual(r['proposal']['expectedVersion'],3);self.assertEqual(r['proposal']['expectedId'],'event-1')
 def test_manual_only(self):self.assertFalse(validate_party(self.args,self.world,False)['ok'])
 def test_known_matching_guest(self):
  for guest in [True,15,'4']:
   self.assertFalse(validate_party({**self.args,'guestId':guest},self.world,True)['ok'])
  self.assertFalse(validate_party({**self.args,'tags':['sea']},self.world,True)['ok'])
 def test_bounded_tags_and_description(self):
  for update in [{'tags':['nature','nature']},{'tags':['unknown']},{'description':'a'*201},{'name':''},{'difficulty':'hard'},{'tags':[{}]}]:
   self.assertFalse(validate_party({**self.args,**update},self.world,True)['ok'])
 def test_active_session_blocks_new_event(self):
  self.world['party']['session']={'phase':'running'};self.assertFalse(validate_party(self.args,self.world,True)['ok'])
if __name__=='__main__':unittest.main()
