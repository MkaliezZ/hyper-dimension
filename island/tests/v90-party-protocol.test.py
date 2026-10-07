import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from party_protocol import validate_party
class FireworksProtocolTest(unittest.TestCase):
 def setUp(self):
  self.contexts={t:{'template':t,'tags':[{'id':'stars'}],'fixedRoles':[{'id':i} for i in ([1,3,12] if t=='fireworks' else [13,7,2,0,4,12] if t=='couture' else [6,1,2] if t=='market' else [0,2] if t=='night' else [8,2])],'candidates':[{'id':14,'tags':['stars']}],'draft':{'id':t+'-1','version':2,'stamp':t+'-observed'}} for t in ['fishing','night','market','couture','fireworks']}
  self.world={'party':self.contexts['fishing'],'partyTemplates':self.contexts}
  self.args={'name':'星潮三幕','description':'和伙伴们观测海风并亲手编排烟花','tags':['stars'],'difficulty':'easy','guestId':14,'guestReason':'青禾关心花园终曲'}
 def test_fifth_template_keeps_its_exact_context_and_stamp(self):
  r=validate_party({**self.args,'template':'fireworks'},self.world,True)
  self.assertTrue(r['ok']);p=r['proposal'];self.assertEqual(p['template'],'fireworks')
  self.assertEqual(p['expectedId'],'fireworks-1');self.assertEqual(p['expectedVersion'],2);self.assertEqual(p['expectedStamp'],'fireworks-observed');self.assertNotIn('fireworks',p)
 def test_fixed_jobs_are_not_additional_guests(self):
  for i in [1,3,12]:
   self.contexts['fireworks']['candidates'].append({'id':i,'tags':['stars']})
   self.assertFalse(validate_party({**self.args,'template':'fireworks','guestId':i},self.world,True)['ok'])
 def test_no_automatic_event_and_missing_context_cannot_fall_back_to_fishing(self):
  self.assertFalse(validate_party({**self.args,'template':'fireworks'},self.world,False)['ok'])
  self.assertFalse(validate_party({**self.args,'template':'fireworks'},{'party':self.contexts['fishing']},True)['ok'])
 def test_running_fireworks_blocks_other_templates_and_other_templates_block_fireworks(self):
  for active,requested in [('fireworks','couture'),('market','fireworks')]:
   self.contexts[active]['session']={'id':'running','phase':'checkin'}
   self.assertFalse(validate_party({**self.args,'template':requested},self.world,True)['ok'])
   del self.contexts[active]['session']
 def test_six_shell_party_is_not_the_night_optional_one_shell_flag(self):
  self.assertFalse(validate_party({**self.args,'template':'fireworks','fireworks':True},self.world,True)['ok'])
  night=validate_party({**self.args,'template':'night','fireworks':True},self.world,True)
  self.assertTrue(night['ok']);self.assertTrue(night['proposal']['fireworks'])
if __name__=='__main__':unittest.main()
