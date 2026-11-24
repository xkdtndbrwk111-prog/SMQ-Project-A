import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
const code=readFileSync('experimental/usage-retention/HOJA_USAGE_V4_SHA256_AUDIT_ONLY.js','utf8');
const sha=runInNewContext(code+';HOJA_USAGE_V4_SHA256_AUDIT_ONLY;').sha256;
test('SHA256 matches Node native for UTF-8 Korean, emoji and multi-block V4 canonical source',()=>{
 for(const sample of ['', 'abc','한글 문제은행','😄', '한글💯'.repeat(100),
  JSON.stringify([{date:'2026-11-20',grade:'6학년',publisher:'천재',teamCount:7}])]){
  const expected=createHash('sha256').update(sample,'utf8').digest('hex');
  assert.equal(sha(sample),expected);
 }
});
