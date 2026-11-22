import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';

const source=readFileSync(resolve('experimental/usage-retention/HOJA_USAGE_RETENTION_CORE.js'),'utf8');
const api=runInNewContext(source+';HOJA_USAGE_RETENTION_CORE;');
const json=x=>JSON.parse(JSON.stringify(x));
function id(n){return String(n).padStart(32,'0');}
function event(n,patch={}){
 return {eventId:id(n),date:'2026-11-20',mode:'SOLO',repositoryKind:'PUBLIC',
  gameId:'HOJA_ARCADE',cartridgeIds:['101'],...patch};
}
function legacyRow(n,{mode='SOLO',date='2026-11-20',ids='101',teams=1}={}){
 return [id(n),'2026-11-20T12:00:00Z',date,mode,'PUBLIC','6','사회','',
  '사회',ids.split('|').length,teams,ids,'PUBLIC:tested','U3S1','[]'];
}
function monthDays(y,m){
 const n=new Date(Date.UTC(y,m,0)).getUTCDate();
 return Array.from({length:n},(_,i)=>String(y)+'-'+String(m).padStart(2,'0')+'-'+String(i+1).padStart(2,'0'));
}

test('U3S1 15-column EVENT_LOG is understood without editing the source',()=>{
 assert.equal(api.HEADER.length,15);
 const result=api.dailySnapshot([legacyRow(1),legacyRow(2,{mode:'TEAM',teams:7})]);
 assert.equal(result.uniqueStarts,2);
 assert.equal(result.totals.find(x=>x.mode==='TEAM').teamCounts['7'],1);
 assert.equal(result.totals[0].completed+result.totals[0].unknownEnded,1);
 assert.ok(result.totals.every(x=>x.gameId==='HOJA_LEGACY'));
});

test('two selected cartridges count as ONE play, TWO cartridge selections',()=>{
 const rows=[event(1,{cartridgeIds:['102','101']}),event(1,{cartridgeIds:['101','102']})];
 const result=api.dailySnapshot(rows);
 assert.equal(result.sourceRows,2);
 assert.equal(result.uniqueStarts,1);
 assert.equal(result.retriesSuppressed,1);
 assert.equal(result.totals[0].starts,1);
 assert.equal(result.dimensions.length,2);
 assert.equal(result.dimensions.reduce((v,x)=>v+x.starts,0),2);
});

test('same eventId with divergent event content rejects entire archive',()=>{
 assert.throws(()=>api.dailySnapshot([event(1),event(1,{mode:'TEAM',teamCount:2})]),/EVENT_ID_CONFLICT/);
});

test('daily stores sum and denominators rather than misleading averages',()=>{
 const r=api.dailySnapshot([
  event(1,{outcome:'COMPLETED',correctTotal:8,answeredTotal:10,durationSeconds:120}),
  event(2,{outcome:'COMPLETED',correctTotal:3,answeredTotal:10,durationSeconds:180}),
  event(3),event(4,{outcome:'TIME_UP'})
 ]);
 assert.equal(r.totals[0].starts,4);
 assert.equal(r.totals[0].completed,2);
 assert.equal(r.totals[0].timeUp,1);
 assert.equal(r.totals[0].unknownEnded,1);
 assert.equal(r.totals[0].correctTotal,11);
 assert.equal(r.totals[0].answeredTotal,20);
 assert.equal(r.totals[0].durationSecondsTotal,300);
 assert.equal(r.totals[0].durationSamples,2);
});

test('monthly aggregation preserves summed starts and cartridge counts',()=>{
 const rows=[
  event(1,{date:'2024-02-01',cartridgeIds:['101','102']}),
  event(2,{date:'2024-02-29',outcome:'COMPLETED',durationSeconds:240}),
  event(3,{date:'2024-03-01'})
 ];
 const daily=api.dailySnapshot(rows);
 const month=api.monthlySnapshot(daily,'2024-02',monthDays(2024,2));
 assert.equal(month.verifiedDayCount,29);
 assert.equal(month.totals[0].starts,2);
 assert.equal(month.totals[0].completed,1);
 assert.equal(month.totals[0].durationSecondsTotal,240);
 assert.equal(month.dimensions.find(x=>x.cartridgeId==='101').starts,2);
 assert.equal(month.dimensions.find(x=>x.cartridgeId==='102').starts,1);
});

test('monthly requires all days including zero-usage days verified',()=>{
 const daily=api.dailySnapshot([event(1,{date:'2024-02-01'})]);
 assert.throws(()=>api.monthlySnapshot(daily,'2024-02',['2024-02-01']),/INCOMPLETE_MONTH_2024-02-02/);
});

test('monthly detects two distinct COMPLETE generations for same daily key',()=>{
 const daily=api.dailySnapshot([event(1,{date:'2024-02-01'})]);
 daily.totals.push(json(daily.totals[0]));
 assert.throws(()=>api.monthlySnapshot(daily,'2024-02',monthDays(2024,2)),/DUPLICATE_DAILY_GENERATION/);
});

test('preview never authorizes purge without every safety prerequisite',()=>{
 const old='2026-09-01',recent='2026-11-10';
 const args={asOf:'2026-11-23',rawDates:[old,recent],
  summaryReadersReady:false,backupVerified:false,dailyManifests:{}};
 const first=json(api.previewRawPurge(args));
 assert.equal(first.find(x=>x.date===old).eligibleForFutureApprovedPurge,false);
 assert.ok(first.find(x=>x.date===old).holds.includes('SUMMARY_READERS_NOT_READY'));
 assert.ok(first.find(x=>x.date===recent).holds.includes('RECENT_30_DAYS'));
 const approved=api.previewRawPurge({...args,summaryReadersReady:true,backupVerified:true,
  dailyManifests:{[old]:{status:'COMPLETE',verified:true,rawCount:10,summaryCount:10,
   contentDigest:'a'.repeat(64)}}});
 assert.equal(approved.find(x=>x.date===old).eligibleForFutureApprovedPurge,true);
 assert.equal(approved.find(x=>x.date===recent).eligibleForFutureApprovedPurge,false);
 // This is only a preview: there is no delete function or SpreadsheetApp import.
 assert.doesNotMatch(source.replace(/\/\*[\s\S]*?\*\//g,''), /(?:deleteRows?|SpreadsheetApp|ScriptApp|DriveApp)\s*[.(]/);
});

test('count mismatch, absent digest or unverified manifest HOLD the purge',()=>{
 const props={asOf:'2026-11-23',rawDates:['2026-09-01'],
  summaryReadersReady:true,backupVerified:true};
 for(const m of [
  {status:'FAILED',verified:true,rawCount:10,summaryCount:10,contentDigest:'a'.repeat(64)},
  {status:'COMPLETE',verified:true,rawCount:10,summaryCount:9,contentDigest:'a'.repeat(64)},
  {status:'COMPLETE',verified:true,rawCount:10,summaryCount:10,contentDigest:''}
 ]){
  const result=api.previewRawPurge({...props,dailyManifests:{'2026-09-01':m}});
  assert.equal(result[0].eligibleForFutureApprovedPurge,false);
 }
});

test('summary never copies user-identifying fields',()=>{
 const e=event(1,{name:'학생실명',school:'학교이름',deviceId:'sample-device',ip:'192.0.2.1'});
 const jsonResult=JSON.stringify(api.dailySnapshot([e]));
 for(const secret of ['학생실명','학교이름','sample-device','192.0.2.1'])
  assert.ok(!jsonResult.includes(secret),secret);
});

test('input validation fails closed on malformed dates, answer counts and team sizes',()=>{
 for(const bad of [
  event(1,{date:'2026-02-29'}),
  event(1,{cartridgeIds:[]}),
  event(1,{teamCount:8}),
  event(1,{outcome:'COMPLETED',correctTotal:4,answeredTotal:3}),
 ]){
  assert.throws(()=>api.dailySnapshot([bad]),/HOJA_USAGE_RETENTION_/);
 }
});

test('1000 raw event rows compress into one daily total without losing starts',()=>{
 const rows=Array.from({length:1000},(_,i)=>event(i+1));
 const result=api.dailySnapshot(rows);
 assert.equal(result.uniqueStarts,1000);
 assert.equal(result.totals.length,1);
 assert.equal(result.dimensions.length,1);
 assert.equal(result.totals[0].starts,1000);
});

test('snapshot is deterministic regardless of original row order',()=>{
 const rows=[event(3),event(1,{cartridgeIds:['102']}),event(2,{mode:'TEAM',teamCount:7})];
 const first=api.dailySnapshot(rows),second=api.dailySnapshot([...rows].reverse());
 assert.equal(first.canonicalSource,second.canonicalSource);
 assert.deepEqual(json(first.totals),json(second.totals));
 assert.deepEqual(json(first.dimensions),json(second.dimensions));
});

test('daily-to-monthly eligibility uses only completely expired calendar months',()=>{
 const months=['2025-10','2025-11','2026-10'];
 const props={asOf:'2026-11-23',dailyMonths:months,
  summaryReadersReady:true,backupVerified:true,
  monthlyManifests:{'2025-10':{status:'COMPLETE',verified:true,dailyStarts:100,
   monthlyStarts:100,contentDigest:'a'.repeat(64)}}};
 const rows=api.previewDailyCompaction(props);
 assert.equal(rows.find(x=>x.month==='2025-10').eligibleForFutureApprovedCompaction,true);
 assert.ok(rows.find(x=>x.month==='2025-11').holds.includes('RECENT_12_MONTHS'));
 assert.ok(rows.find(x=>x.month==='2026-10').holds.includes('RECENT_12_MONTHS'));
});

test('monthly count mismatch, missing manifest and unverified digest hold daily compaction',()=>{
 for(const manifest of [
  {},
  {'2025-10':{status:'COMPLETE',verified:true,dailyStarts:5,monthlyStarts:4,contentDigest:'a'.repeat(64)}},
  {'2025-10':{status:'COMPLETE',verified:true,dailyStarts:5,monthlyStarts:5,contentDigest:'invalid'}}
 ]){
  const p=api.previewDailyCompaction({asOf:'2026-11-23',dailyMonths:['2025-10'],
   summaryReadersReady:true,backupVerified:true,monthlyManifests:manifest});
  assert.equal(p[0].eligibleForFutureApprovedCompaction,false);
  assert.ok(p[0].holds.length>=1);
 }
});
