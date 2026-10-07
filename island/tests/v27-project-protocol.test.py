import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'server'))
from project_protocol import validate_preparation
class PreparationProtocol(unittest.TestCase):
 def setUp(self):self.world={'materials':[{'id':'wood'}],'recipes':[{'item':'lantern'}],'projects':[]}
 def check(self,rows,manual=True):return validate_preparation({'title':'岛屿筹备','targets':rows},self.world,manual)
 def test_valid(self):self.assertTrue(self.check([{'item':'lantern','quantity':1}])['ok'])
 def test_unknown(self):self.assertFalse(self.check([{'item':'unknown','quantity':1}])['ok'])
 def test_boolean(self):self.assertFalse(self.check([{'item':'wood','quantity':True}])['ok'])
 def test_zero(self):self.assertFalse(self.check([{'item':'wood','quantity':0}])['ok'])
 def test_duplicate(self):self.assertFalse(self.check([{'item':'wood','quantity':1},{'item':'wood','quantity':1}])['ok'])
 def test_automatic_rejected(self):self.assertFalse(self.check([{'item':'wood','quantity':1}],False)['ok'])
 def test_full(self):
  self.world['projects']=[{'status':'preparing'}]*3
  self.assertFalse(self.check([{'item':'wood','quantity':1}])['ok'])
if __name__=='__main__':unittest.main()
