import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';

const core=readFileSync('experimental/usage-retention/HOJA_USAGE_RETENTION_CORE.js','utf8');
const script=readFileSync('experimental/usage-retention/HOJA_USAGE_RETENTION_TRIAL_GAS.gs','utf8');
const headers=['eventId','timestamp','date','mode','repositoryKind','grade','subject','publisher',
 'cartridge','cartridgeCount','teamCount','cartridgeIds','publicRepositoryNamespace',
 'usageSchemaVersion','cartridgeTitlesJson'];
const row=(n,date='2026-11-19')=>[
 String(n).padStart(32,'0'),'2026-11-19T12:00:00Z',date,'SOLO','PUBLIC','6','사회','',
 '사회',1,1,'101','PUBLIC:trial','U3S1','[]'
];
function preview({rows=[row(1),row(2)],props={},header=headers,lastRow}={}){
 const calls=[];
 const p={'HOJA_USAGE_TRIAL_SPREADSHEET_ID':'copied-trial-id',
  'SMQ_USAGE_SPREADSHEET_ID':'real-production-id',...props};
 const sheet={
  getLastRow(){return lastRow??rows.length+1;},
  getLastColumn(){return headers.length;},
  getRange(start,col,num,count){
   assert.ok((col===1&&count===15)||(col===3&&count===1));
   return {
    getDisplayValues(){return [header];},
    getValues(){
      return Array.from({length:num},(_,i)=>{
       const r=rows[start+i-2]||[];
       return col===3?[r[2]??'']:[...r];
      });
    }
   };
  }
 };
 const fake={
  Date,
  PropertiesService:{getScriptProperties(){return {getProperty(k){return p[k]||'';}};}},
  SpreadsheetApp:{openById(id){calls.push('read:'+id);
   if(id!=='copied-trial-id')throw Error('REAL_SHEET_ACCESS_BLOCKED');
   return {getSheetByName(name){assert.equal(name,'EVENT_LOG');return sheet;}};}},
  Utilities:{
   DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},
   formatDate(d,tz,fmt){
    assert.equal(tz,'Asia/Seoul');assert.equal(fmt,'yyyy-MM-dd');
    return d.toISOString().slice(0,10);
   },
   computeDigest(algo,string,charset){
    assert.equal(algo,'SHA_256');assert.equal(charset,'UTF_8');
    return [...createHash('sha256').update(string).digest()];
   }
  }
 };
 return {value:()=>runInNewContext(core+'\n'+script+'\nhojaUsageRetentionPreviewTrialU1()',fake),
  calls};
}

test('copied trial spreadsheet: aggregation, digest and no writes',()=>{
 const t=preview();
 const value=t.value();
 assert.equal(value.source,'TRIAL_COPY_ONLY');
 assert.equal(value.rawRows,2);
 assert.equal(value.uniqueStarts,2);
 assert.equal(value.totalBuckets,1);
 assert.equal(value.totals[0].starts,2);
 assert.match(value.canonicalContentSha256,/^[0-9a-f]{64}$/);
 assert.deepEqual(t.calls,['read:copied-trial-id']);
});

test('date auto-coercion in spreadsheet is normalized',()=>{
 const r=row(1);r[2]=new Date('2026-11-19T00:00:00Z');
 const result=preview({rows:[r]}).value();
 assert.equal(result.totals[0].date,'2026-11-19');
});

test('production ID equality always blocks the trial preview',()=>{
 for(const key of ['SMQ_USAGE_SPREADSHEET_ID','HOJA_PROD_RANKING_SPREADSHEET_ID',
  'HOJA_PROD_PUBLIC_SPREADSHEET_ID']){
  const t=preview({props:{[key]:'copied-trial-id'}});
  assert.throws(()=>t.value(),/HOJA_USAGE_TRIAL_EQUALS_PRODUCTION_/);
  assert.equal(t.calls.length,0);
 }
});

test('no configured trial ID: fail before fetching sheets',()=>{
 const t=preview({props:{'HOJA_USAGE_TRIAL_SPREADSHEET_ID':''}});
 assert.throws(()=>t.value(),/HOJA_USAGE_TRIAL_SPREADSHEET_ID_REQUIRED/);
 assert.equal(t.calls.length,0);
});

test('full header parity is required and malformed schema fails closed',()=>{
 const changed=[...headers];changed[11]='cartridgeName';
 assert.throws(()=>preview({header:changed}).value(),/HOJA_USAGE_TRIAL_SCHEMA_MISMATCH/);
});

test('preview limit blocks partial snapshots; no silent truncation',()=>{
 const t=preview({lastRow:10002});
 assert.throws(()=>t.value(),/HOJA_USAGE_TRIAL_DAY_REQUIRED_FOR_LARGE_SHEET/);
});


test('actual source format allows physical blank K1 while K events retain team count',()=>{
 const h=[...headers];h[10]='';
 const r=row(1);r[3]='TEAM';r[10]=7;
 const out=preview({header:h,rows:[r]}).value();
 assert.equal(out.totals[0].teamCounts['7'],1);
});

test('17k sheet selected day scans only date column and does not truncate result',()=>{
 const rows=Array.from({length:11000},(_,i)=>row(i+1,i>=10996?'2026-11-20':'2026-11-19'));
 const out=preview({rows,props:{'HOJA_USAGE_TRIAL_DAY':'2026-11-20'}}).value();
 assert.equal(out.rawRows,4);
 assert.equal(out.uniqueStarts,4);
 assert.equal(out.totals[0].date,'2026-11-20');
});

test('invalid date filter rejects before scan',()=>{
 assert.throws(()=>preview({props:{'HOJA_USAGE_TRIAL_DAY':'11/20/2026'}}).value(),
  /HOJA_USAGE_TRIAL_DAY_FORMAT/);
});

test('legacy row with no stored unit IDs is counted without fake unit attribution',()=>{
 const r=row(1);r[11]='';r[9]=1;
 const result=preview({rows:[r]}).value();
 assert.equal(result.uniqueStarts,1);
 assert.equal(result.dimensions[0].cartridgeId,'LEGACY_UNRESOLVED');
});

test('the trial GAS source cannot mutate or delete data',()=>{
 assert.doesNotMatch(script.replace(/\/\*[\s\S]*?\*\//g,''),
  /(?:deleteRows?|clearContent|appendRow|setValues?|installTrigger|newTrigger)\s*[.(]/);
});
