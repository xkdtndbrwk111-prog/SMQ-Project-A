import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';

const source=readFileSync('experimental/usage-retention/HOJA_USAGE_V4_CORE.js','utf8');
const raw=runInNewContext(source+';HOJA_USAGE_V4_CORE;');
const v4={...raw,report:(days,options)=>raw.report(days,{...options,hashBuckets:digest})};
const json=x=>JSON.parse(JSON.stringify(x));
const digest=c=>createHash('sha256').update(c).digest('hex');
function row(n,{date='2026-11-20',mode='SOLO',repo='PUBLIC',grade='6',subject='영어',
 publisher='천재(함)',combo='영어 10 | 영어 11',team=1,ids='101|102'}={}){
 return [String(n).padStart(32,'0'),'2026-11-20T10:00:00Z',date,mode,repo,
  grade,subject,publisher,combo,ids?ids.split('|').length:0,team,ids,
  'PUBLIC:TEST','U3S1',ids?'["영어10","영어11"]':''];
}
function published(date,rows,options={}){
 const r=v4.snapshot(date,rows,{coverageVerified:true});
 return {schema:r.schema,date:r.date,starts:r.starts,buckets:json(r.buckets),
   status:'COMPLETE',verified:true,sourceDigest:digest(r.canonicalSource),
   bucketDigest:digest(JSON.stringify(json(r.buckets))),
   ...options};
}
const count=(day,dim,key)=>day.buckets.find(r=>r.dimension===dim&&r.key===key)?.count||0;
test('ignore PRIVATE/unknown and retain only PUBLIC valid date starts',()=>{
 const day=published('2026-11-20',[
  row(1),row(2,{repo:'PRIVATE'}),row(3,{repo:'unknown'}),
  row(4,{date:'2026-11-19'}),row(5,{mode:'TEAM',team:7}),
 ]);
 assert.equal(day.starts,2);
 assert.equal(count(day,'MODE','SOLO'),1);
 assert.equal(count(day,'MODE','TEAM'),1);
 assert.equal(count(day,'TEAM_SIZE','7팀전'),1);
 assert.equal(count(day,'CARTRIDGE_COMBINATION','영어 10 | 영어 11'),2);
 assert.equal(count(day,'UNIT_SELECTION','PUBLIC:TEST|SHEET:101'),2);
 assert.equal(count(day,'UNIT_SELECTION','PUBLIC:TEST|SHEET:102'),2);
 assert.equal(count(day,'GRADE','6학년'),2);
});
test('original combo TOP20 count does not multiply selected unit counts',()=>{
 const day=published('2026-11-20',[
  row(1),row(2),row(3,{combo:'영어 12단원',ids:'103'}),
 ]);
 assert.equal(day.starts,3);
 assert.equal(count(day,'CARTRIDGE_COMBINATION','영어 10 | 영어 11'),2);
 assert.equal(count(day,'CARTRIDGE_COMBINATION','영어 12단원'),1);
 assert.equal(count(day,'UNIT_SELECTION','PUBLIC:TEST|SHEET:101'),2);
 assert.equal(count(day,'UNIT_SELECTION','PUBLIC:TEST|SHEET:103'),1);
 assert.equal(day.buckets.filter(r=>r.dimension==='UNIT_SELECTION')
  .reduce((n,r)=>n+r.count,0),5);
});
test('older 11-field PUBLIC events count plays without inventing selected unit IDs',()=>{
 const sourceRow=row(1,{ids:''}).slice(0,11);
 const snap=v4.snapshot('2026-11-20',[sourceRow],{coverageVerified:true});
 assert.equal(snap.starts,1);
 assert.equal(snap.unitSelectionCount,0);
 assert.equal(snap.unknownUnitStarts,1);
 assert.equal(snap.buckets.some(r=>r.dimension==='UNIT_SELECTION'),false);
 assert.equal(snap.buckets.find(r=>r.dimension==='CARTRIDGE_COMBINATION').count,1);
});
test('new summary rejects event ID duplicates but never silently deduplicates historical starts',()=>{
 assert.throws(()=>v4.snapshot('2026-11-20',[row(1),row(1)],{coverageVerified:true}),
  /DUPLICATE_EVENT_ID/);
 assert.throws(()=>v4.snapshot('2026-11-20',[row(1)],{}),/COVERAGE_NOT_VERIFIED/);
});
test('7 teams and unknown team size preserve explicit grand total and percentages',()=>{
 const day=published('2026-11-20',[
  row(1,{mode:'TEAM',team:2}),
  row(2,{mode:'TEAM',team:7}),
  row(3,{mode:'TEAM',team:0}),
  row(4,{mode:'SOLO',team:1}),
 ]);
 assert.equal(day.starts,4);
 assert.equal(count(day,'TEAM_SIZE','2팀전'),1);
 assert.equal(count(day,'TEAM_SIZE','7팀전'),1);
 assert.equal(count(day,'TEAM_SIZE','인원 미확인'),1);
 const r=v4.report([day],{asOf:'2026-11-20',historyStart:'2026-11-20',
  initialHistoryAudited:true,accessRole:'OWNER'});
 assert.equal(r.totals.all,4);
 assert.equal(r.teamCount.reduce((a,x)=>a+x.count,0),3);
 assert.equal(r.teamCount.find(x=>x.label==='7팀전').share,100/3);
});
test('full certified range including explicit zero days permits exact all-time + 7d + 30d',()=>{
 const dates=v4.splitDayKeys('2026-09-23','2026-11-23');
 const reports=dates.map(d=>{
  const events=d==='2026-09-23'?[row(1,{date:d})]:
   d==='2026-11-20'?[row(2,{date:d}),row(3,{date:d,mode:'TEAM',team:7})]:[];
  return published(d,events);
 });
 const output=v4.report(reports,{asOf:'2026-11-23',historyStart:'2026-09-23',
  initialHistoryAudited:true,accessRole:'CREATOR'});
 assert.equal(output.totals.all,3);
 assert.equal(output.totals.today,0);
 assert.equal(output.totals.days7,2);
 assert.equal(output.totals.days30,2);
 assert.equal(output.daily.length,62);
 assert.equal(output.daily.find(x=>x.date==='2026-11-21').count,0);
 assert.equal(output.repositoryKind[0].label,'PUBLIC');
 assert.equal(output.topCartridges[0].count,3);
 assert.equal(output.__meta.unitSelections,6);
});
test('a missing/failed day or unverified history start never manufactures 0 or all-time',()=>{
 const days=v4.splitDayKeys('2026-11-19','2026-11-23').map(d=>published(d,[]));
 const opts={asOf:'2026-11-23',historyStart:'2026-11-19',initialHistoryAudited:true};
 assert.throws(()=>v4.report(days.filter(x=>x.date!=='2026-11-21'),opts),
  /MISSING_DAILY_COVERAGE_2026-11-21/);
 assert.throws(()=>v4.report(days,{...opts,initialHistoryAudited:false}),
  /HISTORY_START_NOT_AUDITED/);
 assert.throws(()=>v4.report(days.map(x=>x.date==='2026-11-22'?
  {...x,status:'PREPARING'}:x),opts),/SNAPSHOT_UNPUBLISHED/);
 assert.throws(()=>v4.report([...days,days[0]],opts),/DUPLICATE_DATE/);
});
test('corruption in stored summary buckets is rejected before Manager can read',()=>{
 const day=published('2026-11-20',[row(1)]);
 const patch=(mutate)=>{const v=json(day);mutate(v);return v;};
 for(const x of [
  patch(d=>d.buckets.find(r=>r.dimension==='GRADE').count=99),
  patch(d=>d.buckets.push({...d.buckets[0]})),
  patch(d=>d.sourceDigest='bad'),
  patch(d=>d.bucketDigest='bad'),
 ]){
  assert.throws(()=>v4.report([x],{asOf:'2026-11-20',
   historyStart:'2026-11-20',initialHistoryAudited:true}),/HOJA_V4_/);
 }
});
test('the U2 display data structure survives as expected, without raw rows or PII',()=>{
 const r=v4.report([published('2026-11-20',[
  row(1,{combo:'영어 10단원',grade:'5',publisher:'천재'}),
  row(2,{combo:'영어 11단원',mode:'TEAM',team:6}),
 ])],{asOf:'2026-11-20',historyStart:'2026-11-20',
  initialHistoryAudited:true,accessRole:'OWNER'});
 for(const key of ['totals','daily','mode','teamCount','repositoryKind',
   'grade','subject','publisher','topCartridges'])
  assert.ok(Object.hasOwn(r,key),key);
 assert.equal(r.totals.all,2);
 assert.equal(r.mode.reduce((a,x)=>a+x.share,0),100);
 const text=JSON.stringify(r);
 assert.doesNotMatch(text,/EVENT_LOG|studentName|deviceId|email|eventId|token/);
});
test('bad historical schema row and impossible date fail safely',()=>{
 assert.throws(()=>v4.snapshot('2026-02-29',[],{coverageVerified:true}),/DATE_INVALID/);
 assert.throws(()=>v4.snapshot('2026-11-20',[row(1).slice(0,9)],
  {coverageVerified:true}),/ROW/);
});
test('V4 core is pure; it cannot mutate Sheets or schedule retention',()=>{
 const clean=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
 assert.doesNotMatch(clean,/(?:SpreadsheetApp|DriveApp|ScriptApp|UrlFetchApp|deleteRows?|clearContent)\s*[.(]/);
});
