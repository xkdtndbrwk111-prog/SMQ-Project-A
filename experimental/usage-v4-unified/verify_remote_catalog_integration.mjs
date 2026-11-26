// Isolated real-content integration. The simulated release exists ONLY in memory.
// Never treats the QA status, renderer result or this test as publication approval.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {runInContext} from 'node:vm';
import {gzipSync,gunzipSync} from 'node:zlib';
import {loadProject,MockSpreadsheet,GAS_DIR,sha256} from './mock_gas.mjs';
import {buildCopy,standardHistory,ISOLATED_PROPS,id} from './fixture.mjs';
import {qaPreviewCatalog} from './approved-catalog/qa_preview.mjs';

const root=resolve(process.argv[2]),dir=GAS_DIR+'/../approved-catalog/generated/';
const index=JSON.parse(readFileSync(dir+'approved-source-index.json'));
const report=JSON.parse(readFileSync(dir+'approved-content-report.json'));
const commit=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const repo='xkdtndbrwk111-prog/HOJA-QUESTION-BANK';
const qa=qaPreviewCatalog(index,report,{schemaVersion:'hoja-qa-preview-v1',purpose:'TEST_ONLY_QA_NOT_DEPLOYMENT',sourceCommit:index.sourceCommit,select:'ALL_READY'},
 {allowedScriptIds:['MOCK_ISOLATED_TEST_SCRIPT_ID_0001'],contentSource:{repo,commit}});
const {allowedScriptIds,...base}=qa;
const catalog={...base,buildType:'RELEASE',deploymentId:'HOJA15-ISOLATED-MOCK-ONLY',entries:base.entries.map(e=>({...e,deploymentStatus:'DEPLOYED'}))};
assert.equal(catalog.entries.length,27);
const {ss}=buildCopy({history:standardHistory()});
const p=loadProject({spreadsheets:new Map([['copy40',ss],['prod',new MockSpreadsheet('prod')],['cert',new MockSpreadsheet('cert')]]),
 props:{...ISOLATED_PROPS,HOJA_USAGE_APPROVED_ERA_START:'2026-11-23',HOJA_REMOTE_CATALOG_ENABLED:'1'}});
ss.trace=p.trace;
p.ctx.__testEmbedded={...catalog,entries:catalog.entries.slice(0,1)};
runInContext('HOJA_APPROVED_ACTIVE_CATALOG_=__testEmbedded',p.ctx);
runInContext(readFileSync(GAS_DIR+'/RemoteActiveCatalog.gs','utf8'),p.ctx);
p.ctx.Utilities.newBlob=x=>({getBytes:()=>Buffer.from(x),getDataAsString:()=>Buffer.from(x).toString('utf8')});
p.ctx.Utilities.gzip=b=>({getBytes:()=>gzipSync(b.getBytes())});
p.ctx.Utilities.ungzip=b=>({getDataAsString:()=>gunzipSync(b.getBytes()).toString('utf8')});
p.ctx.Utilities.base64Encode=b=>Buffer.from(b).toString('base64');
p.ctx.Utilities.base64Decode=s=>Buffer.from(s,'base64');
let body=JSON.stringify(catalog),generation=1,offline=false,fetches=0,packageFetches=0;
const catalogCommit='d'.repeat(40),prefix='https://raw.githubusercontent.com/'+repo+'/';
p.ctx.UrlFetchApp.fetch=url=>{
 fetches++;
 if(offline)throw Error('OFFLINE');
 let text;
 if(url===prefix+'main/game-runtime/active/v1/current.json')
  text=JSON.stringify({schemaVersion:'hoja-active-catalog-pointer-v1',generation,catalogCommit,catalogSha256:sha256(body)});
 else if(url===prefix+catalogCommit+'/game-runtime/active/v1/catalog.json')text=body;
 else throw Error('UNEXPECTED_CATALOG_URL');
 return {getResponseCode:()=>200,getContentText:()=>text};
};
p.setFetch(r=>{
 packageFetches++;
 const path=r.url.slice((prefix+commit+'/').length);
 assert.ok(r.url.startsWith(prefix+commit+'/'));
 assert.match(path,/^game-runtime\/approved-packages\/v1\/[a-z0-9-]+\.json$/);
 return {code:200,body:readFileSync(join(root,path),'utf8')};
});
// Each invocation is a separate GAS execution; reset only per-execution memo.
function rpc(name,...args){runInContext('hojaRemoteCatalogMemo_=undefined',p.ctx);return p.rpc(name,...args)}
const rows=rpc('hojaListPublicCartridges');
assert.equal(rows.length,27,'actual catalog must be accepted, not embedded fallback');
assert.equal(fetches,2);assert.equal(packageFetches,0);
assert.ok(rows.every(r=>r.pkg.pinRelay===true&&r.display.sourceTitle&&r.display.number));
let total=0;
for(const row of rows){
 const req={names:[row.name],pins:[{id:row.pkg.id,sha256:row.pkg.sha256}]};
 const [got]=rpc('hojaGetPublicQuestions',req);
 assert.equal(got.sheetName,row.name);
 assert.equal(got.data.cartridgeId,row.pkg.id);
 assert.equal(got.data.questions.length,row.pkg.questionCount);
 total+=got.data.questions.length;
}
assert.equal(total,835);
assert.equal(packageFetches,27);
assert.equal(fetches,2,'fresh catalog shared across calls');
const charlotte=rows.find(r=>r.cartridgeId==='kor5-s2-u6-charlotte');
assert.ok(charlotte);
const wrong={names:[charlotte.name],pins:[{id:charlotte.pkg.id,sha256:'0'.repeat(64)}]};
assert.throws(()=>rpc('hojaGetPublicQuestions',wrong),/APPROVED_CATALOG_CHANGED_RETRY/);
const qr=rpc('hojaJoinCreate',{mode:'quiz',season:'winter',names:[charlotte.name]});
assert.deepEqual(rpc('hojaJoinResolve',qr.code).names,[charlotte.name]);
const usage=rpc('recordUsageStartU1',{eventId:id(98),mode:'SOLO',repositoryKind:'PUBLIC',cartridgeIds:[charlotte.pkg.id],cartridgeCount:1,teamCount:1});
assert.ok(usage.ok);
const row=ss.getSheetByName('EVENT_LOG').rows.at(-1);
assert.equal(row[11],charlotte.pkg.id);assert.equal(row[13],'A1');
assert.equal(row[12],'APPROVED:'+index.sourceCommit.slice(0,12));
// New generation withdraws one unit. Stale list pins cannot serve it by relay.
generation=2;body=JSON.stringify({...catalog,entries:catalog.entries.filter(e=>e.cartridgeId!==charlotte.pkg.id)});
p.clock.ms+=301000;
assert.equal(rpc('hojaListPublicCartridges').length,26);
assert.throws(()=>rpc('hojaGetPublicQuestions',{names:[charlotte.name],pins:[{id:charlotte.pkg.id,sha256:charlotte.pkg.sha256}]}),/PROJECT_B_CARTRIDGE_NOT_PUBLIC/);
assert.throws(()=>rpc('recordUsageStartU1',{eventId:id(99),mode:'SOLO',repositoryKind:'PUBLIC',cartridgeIds:[charlotte.pkg.id],cartridgeCount:1,teamCount:1}),/USAGE_APPROVED_CARTRIDGE_NOT_ACTIVE/);
p.cache.clear();offline=true;p.clock.ms+=301000;
assert.equal(rpc('hojaListPublicCartridges').length,26,'durable fallback must not resurrect withdrawn unit');
console.log('REMOTE_CATALOG_INTEGRATION_PASS 27/835; list, pinned relay, join, A1 telemetry, withdrawal, durable recovery');
