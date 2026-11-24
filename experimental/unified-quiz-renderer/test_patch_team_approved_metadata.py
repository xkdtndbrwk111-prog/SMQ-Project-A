import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from patch_team_approved_metadata import *
class TestPatch(unittest.TestCase):
    def setUp(self): self.fixture=ANCHOR_START+'\n'+OLD_VALID+'\n'+OLD_Q+'\n'+OLD_DONE+'\n'+ANCHOR_END
    def test_source_metadata_preserved(self):
        result=patch_game(self.fixture)
        self.assertIn('approvedSource={row,bank:entry.data',result)
        self.assertIn('sourceChoiceIndices:options.map(v=>v.sourceIndex)',result)
    def test_mismatch_fails(self):
        with self.assertRaises(AssertionError): patch_game(self.fixture.replace(OLD_Q,'x'))
    def test_only_scoped_team_function(self):
        result=patch_game('BEFORE\n'+self.fixture+'\nAFTER')
        self.assertTrue(result.startswith('BEFORE\n'))
        self.assertTrue(result.endswith('\nAFTER'))
if __name__=='__main__': unittest.main()
