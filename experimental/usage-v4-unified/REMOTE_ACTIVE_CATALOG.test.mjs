import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {gzipSync,gunzipSync} from 'node:zlib';
const source=readFileSync(new URL('./gas/RemoteActiveCatalog.gs',import.meta.url),'utf8');
const sha=s=>createHash('sha256').update(s).digest('hex');
const repo='xkdtndbrwk111-prog/HOJA-QUESTION-BANK';
const commit='a'.repeat(40), id='kor5-s2-u6-mom';
const cat={schemaVersion:'hoja-active-cartridge-catalog-v1',buildType:'RELEASE',sourceRepo:repo,sourceCommit:commit,deploymentId:'HOJA15-TEST',entries:[{cartridgeId:id,title:'엄마에게',subject:'korean',subjectLabel:'국어',grade:5,semester:2,unit:6,subunit:null,publisher:null,author:null,questionCount:28,effectiveSha256:'b'.repeat(64),packageSha256:'c'.repeat(64),contentPath:'game-runtime/approved-packages/v1/'+id+'.json',releaseId:'r1',deploymentStatus:'DEPLOYED'}],contentSource:{kind:'GITHUB_RAW_PINNED_V1',repo,commit}};
function fixture(){
 const props=new Map(),cache=new Map();let generation=1,body=JSON.stringify(cat),offline=false,now=100000000,calls=0,wrongDigest=false,failKey=null;const writes=[];
 const f={props,cache,writes,failKey(v){failKey=v},offline(v){offline=v},advance(n){now+=n},generation(n){generation=n},body(v){body=JSON.stringify(v)},wrongDigest(v){wrongDigest=v},get calls(){return calls}};
 f.get=function(embedded=cat){
  const ctx={HOJA_APPROVED_ID_RE_:/^[a-z0-9][a-z0-9-]{2,63}$/,hojaApprovedGameName_:e=>[e.grade,e.subjectLabel,e.title].join('-'),
   Date:{now:()=>now},Utilities:{DigestAlgorithm:{SHA_256:'sha'},Charset:{UTF_8:'utf8'},computeDigest:(_,s)=>Array.from(Buffer.from(sha(s),'hex')),newBlob:s=>({getBytes:()=>Buffer.from(s),getDataAsString:()=>Buffer.from(s).toString('utf8')}),gzip:b=>({getBytes:()=>gzipSync(b.getBytes())}),ungzip:b=>({getDataAsString:()=>gunzipSync(b.getBytes()).toString('utf8')}),base64Encode:b=>Buffer.from(b).toString('base64'),base64Decode:s=>Buffer.from(s,'base64')},
   PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)??null,setProperty:(k,v)=>{writes.push(k);if(failKey&&k.startsWith(failKey))throw Error('QUOTA');props.set(k,v)},deleteProperty:k=>props.delete(k)})},
   CacheService:{getScriptCache:()=>({get:k=>cache.get(k)??null,put:(k,v)=>cache.set(k,v)})},
   LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
   UrlFetchApp:{fetch:url=>{calls++;if(offline)throw Error('offline');const text=url.endsWith('current.json')?JSON.stringify({schemaVersion:'hoja-active-catalog-pointer-v1',generation,catalogCommit:commit,catalogSha256:wrongDigest?'0'.repeat(64):sha(body)}):body;return {getResponseCode:()=>200,getContentText:()=>text}}}};
  vm.createContext(ctx);vm.runInContext(source,ctx);ctx.embedded=embedded;return vm.runInContext('hojaRemoteCatalogGet_(embedded)',ctx);
 };return f;
}
test('off by default; no request',()=>{const f=fixture();assert.equal(f.get(),cat);assert.equal(f.calls,0)});
test('QA never uses remote',()=>{const f=fixture();f.props.set('HOJA_REMOTE_CATALOG_ENABLED','1');const qa={...cat,buildType:'QA_TEST_ONLY'};assert.equal(f.get(qa),qa);assert.equal(f.calls,0)});
test('verified remote and five minute cache',()=>{const f=fixture();f.props.set('HOJA_REMOTE_CATALOG_ENABLED','1');assert.equal(f.get().entries[0].title,'엄마에게');assert.equal(f.calls,2);f.get();assert.equal(f.calls,2)});
test('bad initial digest preserves embedded; no accepted head',()=>{const f=fixture();f.props.set('HOJA_REMOTE_CATALOG_ENABLED','1');f.wrongDigest(true);assert.equal(f.get(),cat);assert.equal(f.props.has('HOJA_REMOTE_CATALOG_ACCEPTED_HEAD_V1'),false)});
test('last verified cache on network failure then expiry',()=>{const f=fixture();f.props.set('HOJA_REMOTE_CATALOG_ENABLED','1');f.get();f.advance(300001);f.offline(true);assert.equal(f.get().entries[0].title,'엄마에게');f.advance(21600000);assert.throws(()=>f.get(),/REMOTE_CATALOG_UNAVAILABLE/)});
test('cache eviction recovers durable verified copy',()=>{const f=fixture();f.props.set('HOJA_REMOTE_CATALOG_ENABLED','1');f.get();f.cache.clear();f.advance(300001);f.offline(true);assert.equal(f.get().entries[0].title,'엄마에게')});
test('corrupt durable copy and empty cache fail closed',()=>{const f=fixture();f.props.set('HOJA_REMOTE_CATALOG_ENABLED','1');f.get();f.cache.clear();f.props.set('HOJA_REMOTE_CATALOG_STORE_V1_A_0','bad');f.offline(true);assert.throws(()=>f.get(),/REMOTE_CATALOG_UNAVAILABLE/)});
test('generation rollback rejected; higher generation accepts explicit rollback content',()=>{const f=fixture();f.props.set('HOJA_REMOTE_CATALOG_ENABLED','1');f.generation(2);f.get();f.advance(300001);f.generation(1);f.body({...cat,deploymentId:'OLD'});assert.equal(f.get().deploymentId,cat.deploymentId);f.generation(3);assert.equal(f.get().deploymentId,'OLD')});
test('reject nonrelease data even with correct hash',()=>{const f=fixture();f.props.set('HOJA_REMOTE_CATALOG_ENABLED','1');f.get();f.advance(300001);f.generation(2);f.body({...cat,buildType:'QA_TEST_ONLY'});assert.equal(f.get().buildType,'RELEASE')});

test('unchanged generation refreshes head only',()=>{const f=fixture();f.props.set('HOJA_REMOTE_CATALOG_ENABLED','1');f.get();const head=JSON.parse(f.props.get('HOJA_REMOTE_CATALOG_ACCEPTED_HEAD_V1'));f.writes.length=0;f.advance(300001);f.get();const refreshed=JSON.parse(f.props.get('HOJA_REMOTE_CATALOG_ACCEPTED_HEAD_V1'));assert.equal(refreshed.slot,head.slot);assert.ok(refreshed.checkedAt>head.checkedAt);assert.deepEqual(f.writes,['HOJA_REMOTE_CATALOG_ACCEPTED_HEAD_V1'])});
test('unchanged verified remote repairs corrupt durable slot',()=>{const f=fixture();f.props.set('HOJA_REMOTE_CATALOG_ENABLED','1');f.get();f.props.set('HOJA_REMOTE_CATALOG_STORE_V1_A_0','bad');f.advance(300001);f.get();assert.equal(JSON.parse(f.props.get('HOJA_REMOTE_CATALOG_ACCEPTED_HEAD_V1')).slot,'B');f.cache.clear();f.offline(true);assert.equal(f.get().deploymentId,cat.deploymentId)});
test('quota failure during inactive slot write preserves previous head',()=>{const f=fixture();f.props.set('HOJA_REMOTE_CATALOG_ENABLED','1');f.get();const head=f.props.get('HOJA_REMOTE_CATALOG_ACCEPTED_HEAD_V1');f.advance(300001);f.generation(2);f.body({...cat,deploymentId:'NEW'});f.failKey('HOJA_REMOTE_CATALOG_STORE_V1_B_');assert.equal(f.get().deploymentId,cat.deploymentId);assert.equal(f.props.get('HOJA_REMOTE_CATALOG_ACCEPTED_HEAD_V1'),head);f.cache.clear();f.offline(true);assert.equal(f.get().deploymentId,cat.deploymentId)});
