import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from party_protocol import validate_party
class CrossTemplateProtocolTest(unittest.TestCase):
 def setUp(self):
  self.contexts={t:{'template':t,'tags':[{'id':'stars'}],'fixedRoles':[{'id':i} for i in ([6,1,2] if t=='market' else [0,2] if t=='night' else [8,2])],'candidates':[{'id':3,'tags':['stars']}],'draft':{'id':t+'-1','version':2,'stamp':t+'-observed'}} for t in ['fishing','night','market']}
  self.world={'party':self.contexts['fishing'],'partyTemplates':self.contexts}
  self.args={'name':'海岛星光','description':'分享海岛故事','tags':['stars'],'difficulty':'easy','guestId':3,'guestReason':'星野熟悉星空'}
 def test_exact_selected_context_and_stamp(self):
  for t in self.contexts:
   r=validate_party({**self.args,'template':t,**({'fireworks':True} if t=='night' else {})},self.world,True);self.assertTrue(r['ok']);self.assertEqual(r['proposal']['template'],t);self.assertEqual(r['proposal']['expectedId'],t+'-1');self.assertEqual(r['proposal']['expectedStamp'],t+'-observed')
   if t=='night':self.assertTrue(r['proposal']['fireworks'])
   else:self.assertNotIn('fireworks',r['proposal'])
 def test_unknown_or_missing_target_never_becomes_fishing(self):
  for t in ['couture',{},None]:
   self.assertFalse(validate_party({**self.args,'template':t},self.world,True)['ok'])
  self.assertFalse(validate_party({**self.args,'template':'market'},{'party':self.contexts['fishing']},True)['ok'])
 def test_automatic_and_fixed_role_guest_rejected(self):
  self.assertFalse(validate_party({**self.args,'template':'night'},self.world,False)['ok'])
  self.contexts['market']['candidates'].append({'id':6,'tags':['stars']})
  self.assertFalse(validate_party({**self.args,'template':'market','guestId':6},self.world,True)['ok'])
 def test_any_real_running_event_blocks_new_proposal(self):
  self.contexts['fishing']['session']={'id':'active','phase':'checkin'}
  self.assertFalse(validate_party({**self.args,'template':'night'},self.world,True)['ok'])
 def test_wrong_template_fireworks_and_malformed_field_rejected(self):
  self.assertFalse(validate_party({**self.args,'template':'market','fireworks':True},self.world,True)['ok'])
  self.assertFalse(validate_party({**self.args,'template':'night','fireworks':1},self.world,True)['ok'])
  self.assertFalse(validate_party({**self.args,'template':'market','fireworks':0},self.world,True)['ok'])
if __name__=='__main__':unittest.main()
