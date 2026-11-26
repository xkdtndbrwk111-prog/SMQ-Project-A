import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {nextPointer} from './prepare_remote_pointer.mjs';
const bytes=Buffer.from('{"test":1}'), commit='a'.repeat(40), next='b'.repeat(40);
const sha=createHash('sha256').update(bytes).digest('hex');
test('explicit bootstrap only',()=>{assert.throws(()=>nextPointer(null,commit,bytes),/BOOTSTRAP/);assert.deepEqual(nextPointer(null,commit,bytes,{bootstrap:true}),{schemaVersion:'hoja-active-catalog-pointer-v1',generation:1,catalogCommit:commit,catalogSha256:sha})});
test('monotonic publication and explicit rollback as a newer generation',()=>{const p=nextPointer(null,commit,bytes,{bootstrap:true});const p2=nextPointer(p,next,Buffer.from('{"test":2}'));assert.equal(p2.generation,2);assert.equal(nextPointer(p2,commit,bytes).generation,3)});
test('reject replay, branch refs, invalid previous and duplicate bootstrap',()=>{const p=nextPointer(null,commit,bytes,{bootstrap:true});assert.throws(()=>nextPointer(p,commit,bytes),/NO_RELEASE_CHANGE/);assert.throws(()=>nextPointer(p,'main',bytes),/COMMIT/);assert.throws(()=>nextPointer({...p,generation:0},next,bytes),/PREVIOUS/);assert.throws(()=>nextPointer(p,next,bytes,{bootstrap:true}),/PREVIOUS/)});
