import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createHash} from 'node:crypto';
const core=readFileSync('experimental/usage-retention/HOJA_USAGE_V4_CORE.js','utf8');
const gas=readFileSync('experimental/usage-retention/HOJA_USAGE_V4_TRIAL_GAS.gs','utf8');
const headers=['eventId','timestamp','date','mode','repositoryKind','grade',
 'subject','publisher','cartridge','cartridgeCount','',
 'cartridgeIds','publicRepositoryNamespace','usageSchemaVersion','cartridgeTitlesJson'];
const row=(n,date,opts={})=>[
 String(n).padStart(32,'0'),'2026-11-20T12:00:00Z',date,opts.mode||'SOLO',
 opts.kind||'PUBLIC','6','영어','천재','영어 10단원 | 영어 11단원',2,opts.team??1,
 '101|102','PUBLIC:TEST','U3S1','["영어10","영어11"]'
];
function make({badCanary=false,ack=true,unsorted=false}={}){
 const p={HOJA_USAGE_TRIAL_SPREADSHEET_ID:'isolated-copy',
  HOJA_USAGE_PRODUCTION_SPREADSHEET_ID:'live-original',
  HOJA_USAGE_V4_TRIAL_WRITE_ACK:ack?'COPIED_SHEET_ONLY':''};
 const source=unsorted?
  [headers,row(1,'2026-11-20'),row(2,'2026-09-23')]:
  [headers,row(1,'2026-09-23'),row(2,'2026-11-20'),
   row(3,'2026-11-20',{mode:'TEAM',team:7}),row(4,'2026-11-22')];
 const tabs=new Map([
  ['EVENT_LOG',source],
  ['_HOJA_USAGE_TRIAL_ONLY',[[badCanary?'INVALID':'HOJA_RETENTION_SANDBOX_V1']]]
 ]);
 const writes=[];
 let fail=null,locked=false;
 const makeSheet=name=>({
  getLastRow(){return tabs.get(name).length;},
  getLastColumn(){return Math.max(...tabs.get(name).map(x=>x.length));},
  getRange(start,col,rs=1,cols=1){
   const data=()=>Array.from({length:rs},(_,i)=>
     Array.from({length:cols},(_,j)=>tabs.get(name)[start+i-1]?.[col+j-1]??''));
   const assign=x=>{
    assert.notEqual(name,'EVENT_LOG','LIVE RAW EVENTS MUST NEVER BE WRITTEN');
    if(fail===name&&start>1)throw Error('SIMULATED_INTERRUPTED_WRITE');
    writes.push({name,start,n:x.length});
    const old=tabs.get(name);
    x.forEach((r,i)=>{
     const nr=start+i-1;while(old.length<=nr)old.push([]);
     r.forEach((v,j)=>old[nr][col+j-1]=v);
    });
   };
   return {
    getDisplayValues(){return data().map(r=>r.map(x=>String(x)));},
    getValues(){return data();},
    getValue(){return data()[0][0];},
    setValues(v){assign(v);return this;},
    setValue(v){assign([[v]]);return this;},
    setNumberFormat(v){assert.equal(v,'@');return this;}
   };
  }
 });
 const ss={
  getSheetByName(n){return tabs.has(n)?makeSheet(n):null;},
  insertSheet(n){if(tabs.has(n))throw Error('DUPLICATE_TAB');tabs.set(n,[]);return makeSheet(n);}
 };
 const env={
  Date,
  PropertiesService:{getScriptProperties(){return {getProperty(k){return p[k]||'';}};}},
  SpreadsheetApp:{openById(id){assert.equal(id,'isolated-copy');return ss;},flush(){}},
  Utilities:{
   DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},
   formatDate(d,tz,fmt){assert.equal(tz,'Asia/Seoul');assert.equal(fmt,'yyyy-MM-dd');return '2026-11-23';},
   computeDigest(alg,msg,charset){
    assert.equal(alg,'SHA_256');assert.equal(charset,'UTF_8');
    return [...createHash('sha256').update(msg).digest()];
   }
  },
  LockService:{getScriptLock(){return {
   tryLock(){if(locked)return false;locked=true;return true;},
   releaseLock(){assert.equal(locked,true);locked=false;}
  };}}
 };
 const ctx=createContext(env);runInContext(core+'\n'+gas,ctx);
 return {
  p,tabs,writes,
  preview:date=>runInContext('hojaV4PreviewDailyTrialU1('+JSON.stringify(date)+')',ctx),
  write:date=>runInContext('hojaV4WriteDailyTrialU1('+JSON.stringify(date)+')',ctx),
  setFail:v=>fail=v
 };
}
test('V4 copied-sheet preview reads real K-empty schema and preserves 7-person team',()=>{
 const a=make();const p=a.preview('2026-11-20');
 assert.equal(p.ok,true);
 assert.equal(p.sourceRowCount,2);
 assert.equal(p.publicStarts,2);
 assert.equal(p.sourceStartRow,3);
 assert.equal(p.sourceEndRow,4);
 assert.equal(p.earliestPublicDay,'2026-09-23');
 assert.equal(p.buckets.find(x=>x.dimension==='TEAM_SIZE').key,'7팀전');
 assert.equal(p.buckets.find(x=>x.dimension==='CARTRIDGE_COMBINATION').count,2);
 assert.match(p.sourceDigest,/^[a-f0-9]{64}$/);
 assert.equal(a.writes.length,0);
});
test('V4 copy writer publishes COMPLETE only after row readback, original EVENT_LOG unchanged',()=>{
 const t=make(),before=JSON.stringify(t.tabs.get('EVENT_LOG'));
 const result=t.write('2026-11-20');
 assert.equal(result.ok,true);assert.equal(result.replayed,false);
 assert.equal(t.tabs.get('HOJA_V4_DAILY_MANIFEST')[1][2],'COMPLETE');
 assert.equal(t.tabs.get('HOJA_V4_DAILY_BUCKETS')[1][2],'CARTRIDGE_COMBINATION');
 assert.equal(t.tabs.get('HOJA_V4_DAILY_MANIFEST')[1][6],2);
 assert.equal(JSON.stringify(t.tabs.get('EVENT_LOG')),before);
 assert.equal(t.writes.some(x=>x.name==='EVENT_LOG'),false);
});
test('V4 copy writer is idempotent after COMPLETE and checks stored dimensions on retry',()=>{
 const t=make();t.write('2026-11-20');
 const counts=[...t.tabs].map(([k,v])=>[k,v.length]);
 assert.equal(t.write('2026-11-20').replayed,true);
 assert.deepEqual([...t.tabs].map(([k,v])=>[k,v.length]),counts);
 t.tabs.get('HOJA_V4_DAILY_BUCKETS')[1][5]='999';
 assert.throws(()=>t.write('2026-11-20'),/REPLAY_BUCKET_MISMATCH/);
});
test('zero-event day inside verified full date-column scan produces COMPLETE zero day',()=>{
 const t=make();const r=t.write('2026-11-21');
 assert.equal(r.starts,0);assert.equal(r.buckets,0);
 assert.equal(t.tabs.get('HOJA_V4_DAILY_MANIFEST')[1][2],'COMPLETE');
 assert.equal(t.write('2026-11-21').replayed,true);
});
test('failed bucket write leaves PREPARING marker and retries fail closed',()=>{
 const t=make();t.setFail('HOJA_V4_DAILY_BUCKETS');
 assert.throws(()=>t.write('2026-11-20'),/SIMULATED_INTERRUPTED_WRITE/);
 assert.equal(t.tabs.get('HOJA_V4_DAILY_MANIFEST')[1][2],'PREPARING');
 t.setFail(null);
 assert.throws(()=>t.write('2026-11-20'),/EXISTING_GENERATION_MANUAL_REVIEW/);
});
test('mutating today is rejected; production ID, canary, acknowledge gate writes',()=>{
 assert.throws(()=>make().write('2026-11-23'),/TODAY_IS_MUTABLE/);
 const a=make();a.p.HOJA_USAGE_PRODUCTION_SPREADSHEET_ID='isolated-copy';
 assert.throws(()=>a.write('2026-11-20'),/PRODUCTION_ISOLATION_REQUIRED/);
 assert.equal(a.writes.length,0);
 const b=make({badCanary:true});
 assert.throws(()=>b.write('2026-11-20'),/CANARY_REQUIRED/);
 assert.equal(b.writes.length,0);
 const c=make({ack:false});
 assert.throws(()=>c.write('2026-11-20'),/MANUAL_WRITE_ACK_REQUIRED/);
 assert.equal(c.writes.length,0);
});
test('unsorted event dates block any row write and reject boundary-based undercount',()=>{
 const t=make({unsorted:true});
 assert.throws(()=>t.write('2026-11-20'),/UNSORTED_SOURCE_DATE/);
 assert.equal(t.writes.length,0);
});
test('no raw deletion, production RPC, ranking or scheduled triggers in copied GAS writer',()=>{
 const text=gas.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
 assert.doesNotMatch(text,/(?:deleteRows?|clearContent|ScriptApp|UrlFetchApp|doGet|doPost|HOJA_RANKING|_SMQ_RANKING)\s*[.(]/);
});
