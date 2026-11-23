import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
const load=(name,exportName)=>runInNewContext(readFileSync(name,'utf8')+';'+exportName);
const core=load('experimental/usage-retention/HOJA_USAGE_V4_CORE.js','HOJA_USAGE_V4_CORE');
const tail=load('experimental/usage-retention/HOJA_USAGE_V4_LIVE_TAIL.js','HOJA_USAGE_V4_LIVE_TAIL');
const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');
const json=x=>JSON.parse(JSON.stringify(x));
const row=(n,date,opts={})=>[
 String(n).padStart(32,'0'),'2026-11-23T08:00:00Z',date,opts.mode||'SOLO',
 opts.kind||'PUBLIC','6','영어','천재',opts.combo||'영어 10 | 영어 11',
 2,opts.team??1,'101|102','PUBLIC:TEST','U3S1','["영어 10","영어 11"]'
];
function fixture(){
 let prefix=1;
 const d=[
  ['2026-11-20',[row(1,'2026-11-20')]],
  ['2026-11-21',[]],
  ['2026-11-22',[row(2,'2026-11-22',{mode:'TEAM',team:7})]]
 ];
 const past=d.map(([date,rows])=>{
  const snap=core.snapshot(date,rows,{coverageVerified:true});
  const previous=prefix;prefix+=rows.length;
  return {
   schema:core.SCHEMA,date,starts:snap.starts,buckets:json(snap.buckets),
   sourceDigest:sha(snap.canonicalSource),
   bucketDigest:sha(JSON.stringify(json(snap.buckets))),
   status:'COMPLETE',verified:true,sourceRowCount:rows.length,
   sourcePrefixEndRow:prefix,sourceStartRow:rows.length?previous+1:0,
   sourceEndRow:rows.length?prefix:0,retriesSuppressed:snap.retriesSuppressed
  };
 });
 const today=[row(3,'2026-11-23'),row(4,'2026-11-23',{mode:'TEAM',team:7})];
 return {past,today,prefix,opts:{
  asOf:'2026-11-23',historyStart:'2026-11-20',initialHistoryAudited:true,
  certifiedPrefixEndRow:prefix,sourceLastRow:prefix+today.length,
  hashBuckets:sha,accessRole:'OWNER'}
 };
}
test('only mutable today tail is included on top of source-hashed COMPLETE past',()=>{
 const f=fixture(),r=tail.project(core,f.past,f.today,f.opts);
 assert.equal(r.ok,true);
 assert.equal(r.todayStatus,'LIVE_PROVISIONAL');
 assert.equal(r.productionSwitchAllowed,false);
 assert.equal(r.preview.totals.all,4);
 assert.equal(r.preview.totals.today,2);
 assert.equal(r.preview.totals.days7,4);
 assert.equal(r.preview.totals.days30,4);
 assert.equal(r.preview.daily.length,4);
 assert.equal(r.preview.daily.find(x=>x.date==='2026-11-21').count,0);
 assert.equal(r.preview.teamCount.find(x=>x.label==='7팀전').count,2);
 assert.equal(r.preview.topCartridges.reduce((n,x)=>n+x.count,0),4);
 assert.equal(r.summary.certifiedPrefixEndRow,3);
 assert.equal(r.summary.mutableTodayRawRows,2);
});
test('same event ID repeated today with later timestamp does not double-count play',()=>{
 const f=fixture(),duplicate=[...f.today[0]];
 duplicate[1]='2026-11-23T08:00:30Z';f.today.push(duplicate);
 f.opts.sourceLastRow++;
 const r=tail.project(core,f.past,f.today,f.opts);
 assert.equal(r.preview.totals.today,2);
 assert.equal(r.preview.totals.all,4);
 assert.equal(r.summary.todayRetriesSuppressed,1);
 assert.equal(r.summary.mutableTodayRawRows,3);
});
test('late, stale, future or partially read tail all fail closed',()=>{
 for(const badDate of ['2026-11-22','2026-11-24','']) {
  const f=fixture();f.today.push(row(6,badDate));f.opts.sourceLastRow++;
  assert.throws(()=>tail.project(core,f.past,f.today,f.opts),/LATE_OR_FUTURE_EVENT_DAY/);
 }
 const f=fixture();f.opts.sourceLastRow++;
 assert.throws(()=>tail.project(core,f.past,f.today,f.opts),/TAIL_LENGTH_INCONSISTENT/);
 const g=fixture();g.opts.certifiedPrefixEndRow--;
 assert.throws(()=>tail.project(core,g.past,g.today,g.opts),/TAIL_LENGTH_INCONSISTENT|SOURCE_WATERMARK_MISMATCH/);
});
test('historical completeness, source prefix, source SHA and per-day BUCKET SHA enforced',()=>{
 for(const mut of [
  f=>f.past.splice(1,1),
  f=>f.past[1].status='PREPARING',
  f=>f.past[2].sourcePrefixEndRow++,
  f=>f.past[0].sourceStartRow++,
  f=>f.past[0].buckets[0].count=99,
  f=>f.opts.initialHistoryAudited=false,
 ]){
  const f=fixture();mut(f);
  assert.throws(()=>tail.project(core,f.past,f.today,f.opts),/HOJA_V4_/);
 }
});
test('PRIVATE/unknown within today is ignored but must still have today date',()=>{
 const f=fixture();f.today.push(row(9,'2026-11-23',{kind:'PRIVATE'}));
 f.opts.sourceLastRow++;
 const r=tail.project(core,f.past,f.today,f.opts);
 assert.equal(r.preview.totals.today,2);
 assert.equal(r.summary.mutableTodayRawRows,3);
});
test('no production RPC, sheet reads or storage mutation from pure projector',()=>{
 const code=readFileSync('experimental/usage-retention/HOJA_USAGE_V4_LIVE_TAIL.js','utf8')
  .replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
 assert.doesNotMatch(code,/(?:SpreadsheetApp|DriveApp|ScriptApp|UrlFetchApp|deleteRows?|setValues?|clearContent)\s*[.(]/);
});
