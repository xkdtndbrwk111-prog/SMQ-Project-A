import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyRemoteRelease} from './build_remote_active_catalog.mjs';
const hash='a'.repeat(64), commit='b'.repeat(40), id='kor5-s2-u6-mom', path='game-runtime/approved-packages/v1/'+id+'.json';
const a={schemaVersion:'hoja-active-cartridge-catalog-v1',sourceRepo:'xkdtndbrwk111-prog/HOJA-QUESTION-BANK',sourceCommit:commit,deploymentId:'TEST',entries:[{cartridgeId:id,effectiveSha256:hash,deploymentStatus:'DEPLOYED',questionCount:1,title:'엄마에게',releaseId:'r1',grade:5,semester:2,subject:'korean',subjectLabel:'국어'}]};
const r={sourceCommit:commit,entries:[{cartridgeId:id,status:'READY',packageSha256:hash}]};
const p={schemaVersion:'hoja-game-runtime-packages-v1',sourceCommit:commit,packages:[{cartridgeId:id,path,sha256:hash,bytes:20}]};
const raw={sha256:hash,bytes:20,data:{cartridgeId:id,questionSchemaVersion:2,questions:[{}],images:{},tags:{},unitMeta:{}}};
test('valid release retains exact SHA and immutable commit',()=>{const out=verifyRemoteRelease(a,r,p,commit,()=>raw);assert.equal(out.entries[0].packageSha256,hash);assert.equal(out.contentSource.commit,commit)});
for(const [name,fn] of [
 ['QA',()=>verifyRemoteRelease({...a,buildType:'QA_TEST_ONLY'},r,p,commit,()=>raw)],
 ['source drift',()=>verifyRemoteRelease(a,{...r,sourceCommit:'c'.repeat(40)},p,commit,()=>raw)],
 ['mutable content ref',()=>verifyRemoteRelease(a,r,p,'main',()=>raw)],
 ['wrong hash',()=>verifyRemoteRelease(a,r,p,commit,()=>({...raw,sha256:'d'.repeat(64)}))],
 ['wrong question count',()=>verifyRemoteRelease(a,r,p,commit,()=>({...raw,data:{...raw.data,questions:[]}}))],
 ['duplicate ID',()=>verifyRemoteRelease(a,r,{...p,packages:[...p.packages,...p.packages]},commit,()=>raw)],
 ['not deployed',()=>verifyRemoteRelease({...a,entries:[{...a.entries[0],deploymentStatus:'NOT_DEPLOYED'}]},r,p,commit,()=>raw)],
 ['blocked package',()=>verifyRemoteRelease(a,{...r,entries:[{...r.entries[0],status:'BLOCKED'}]},p,commit,()=>raw)],
 ['wrong path',()=>verifyRemoteRelease(a,r,{...p,packages:[{...p.packages[0],path:'other.json'}]},commit,()=>raw)]
])test('reject '+name,()=>assert.throws(fn,/REMOTE_CATALOG_/));
