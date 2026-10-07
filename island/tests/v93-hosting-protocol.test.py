import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from party_protocol import validate_party
class HostingProtocol(unittest.TestCase):
 def setUp(self):
  self.context={'template':'night','tags':[{'id':'stars'}],'candidates':[],'fixedRoles':[{'id':0},{'id':2}],'draft':{'id':'night-1','version':3,'stamp':'actual-observed'}}
  self.world={'partyTemplates':{'night':self.context}}
  self.args={'template':'night','name':'现有星灯夜集','description':'原约定','tags':['stars'],'difficulty':'normal','guestId':None,'guestReason':'','fireworks':False}
 def test_explicit_boolean_bound_to_observed_version(self):
  r=validate_party({**self.args,'autoHost':True},self.world,True)
  self.assertTrue(r['ok']);self.assertIs(r['proposal']['autoHost'],True);self.assertEqual(r['proposal']['expectedStamp'],'actual-observed')
 def test_plain_design_has_no_implicit_hosting(self):
  for extra in [{},{'autoHost':False}]:
   r=validate_party({**self.args,**extra},self.world,True);self.assertTrue(r['ok']);self.assertNotIn('autoHost',r['proposal'])
 def test_invalid_boolean_and_automatic_calls_rejected(self):
  for v in [1,0,'true',None,[],{}]:self.assertFalse(validate_party({**self.args,'autoHost':v},self.world,True)['ok'])
  self.assertFalse(validate_party({**self.args,'autoHost':True},self.world,False)['ok'])
 def test_current_event_already_running(self):
  self.context['session']={'phase':'running'}
  self.assertFalse(validate_party({**self.args,'autoHost':True},self.world,True)['ok'])
if __name__=='__main__':unittest.main()
