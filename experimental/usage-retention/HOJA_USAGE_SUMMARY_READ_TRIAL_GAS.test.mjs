import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const bridge=readFileSync('experimental/usage-retention/HOJA_USAGE_SUMMARY_READ_V1.js','utf8');
const adapter=readFileSync('experimental/usage-retention/HOJA_USAGE_SUMMARY_READ_TRIAL_GAS.gs','utf8');
const api=runInNewContext(bridge+';HOJA_USAGE_SUMMARY_READ_V1;');
const old=api.OLD,now=api.TRIAL;
const digest='a'.repeat(64);
function fixture({canary=true,production=false,copy=true,dateAsObject=false}={}){
 const rowDate=dateAsObject?new Date('2026-11-20T00:00:00Z'):'2026-11-20';
 const tables={
  '_HOJA_USAGE_TRIAL_ONLY':[['HOJA_RETENTION_SANDBOX_V1']],
  'USAGE_ROLLUP_MANIFEST':[old.manifest,
   [rowDate,1,'20261120-g000001','U3S1_ROLLUP_V1','COMPLETE',1000,'2026-11-21',2,0,2,digest,digest,'','','','FALSE','']],
  'USAGE_DAILY_TOTALS':[old.totals,
   [rowDate,1,'20261120-g000001','U3S1_ROLLUP_V1',2,2,0,0,0,0,0,0,'']],
  'USAGE_DAILY_DIMENSIONS':[old.dimensions,
   [rowDate,1,'20261120-g000001','U3S1_ROLLUP_V1','GRADE','6학년','6학년',2,''],
   [rowDate,1,'20261120-g000001','U3S1_ROLLUP_V1','SUBJECT','사회','사회',2,'']],
  'HOJA_TRIAL_RETENTION_MANIFEST':[now.manifest],
  'HOJA_TRIAL_DAILY_TOTALS':[now.totals],
  'HOJA_TRIAL_DAILY_DIMENSIONS':[now.dimensions],
  'HOJA_TRIAL_DAILY_FACETS':[now.facets]
 };
 if(!canary)tables._HOJA_USAGE_TRIAL_ONLY=[['BAD_CANARY']];
 const calls=[];
 const p={
  HOJA_USAGE_TRIAL_SPREADSHEET_ID:copy?'copy-sheet':'',
  SMQ_USAGE_SPREADSHEET_ID:production?'copy-sheet':'production-sheet',
 };
 const context={
  Date,
  Utilities:{formatDate(d,tz,fmt){assert.equal(tz,'Asia/Seoul');assert.equal(fmt,'yyyy-MM-dd');
   return d.toISOString().slice(0,10);}},
  PropertiesService:{getScriptProperties(){return {getProperty(k){return p[k]||'';}};}},
  SpreadsheetApp:{openById(id){
   calls.push('OPEN:'+id);assert.equal(id,'copy-sheet');
   return {getSheetByName(name){
    calls.push('TAB:'+name);
    if(name==='EVENT_LOG')throw Error('RAW_EVENT_LOG_MUST_NOT_BE_READ');
    if(!Object.hasOwn(tables,name))return null;
    const rows=tables[name];
    return {
     getLastRow(){return rows.length;},
     getLastColumn(){return Math.max(...rows.map(r=>r.length));},
     getRange(start,col,n=1,width=1){
      const data=Array.from({length:n},(_,i)=>
       Array.from({length:width},(_,j)=>rows[start+i-1]?.[col+j-1]??''));
      return {
       getValues(){return data;},
       getDisplayValues(){return data.map(r=>r.map(x=>String(x)))}
      };
     }
    };
   }};
  }}
 };
 return {execute:(day='2026-11-20')=>runInNewContext(bridge+'\n'+adapter+
  '\nhojaUsageSummaryReadTrialU1('+JSON.stringify(day)+')',context),calls,p,tables};
}
test('copied spreadsheet adapter reads only verified summaries and never reads EVENT_LOG',()=>{
 const f=fixture();
 const result=f.execute();
 assert.equal(result.ok,true);
 assert.equal(result.starts,2);
 assert.equal(result.rawRead,false);
 assert.equal(result.source,'COPIED_SHEET_AGGREGATES_ONLY');
 assert.equal(result.productionSwitchAllowed,false);
 assert.equal(f.calls.includes('TAB:EVENT_LOG'),false);
 assert.equal(f.calls.filter(x=>x.startsWith('TAB:')).length,8);
});
test('date values auto-coerced to Sheets Date are converted in KST',()=>{
 const result=fixture({dateAsObject:true}).execute();
 assert.equal(result.ok,true);assert.equal(result.days[0].date,'2026-11-20');
});
test('missing date produces explicit coverage gap, never zero',()=>{
 const result=fixture().execute('2026-11-19');
 assert.equal(result.ok,false);assert.equal(result.completeCoverage,false);
 assert.equal(result.starts,null);assert.equal(result.gaps[0].date,'2026-11-19');
});
test('canary missing or production ID equality blocks before summary sheet fetch',()=>{
 for(const f of [fixture({canary:false}),fixture({production:true}),fixture({copy:false})]){
  assert.throws(()=>f.execute(),/CANARY_REQUIRED|PRODUCTION_ID_REJECTED|TRIAL_ID_REQUIRED/);
  assert.equal(f.calls.includes('TAB:USAGE_ROLLUP_MANIFEST'),false);
 }
});
test('a corrupted table header is rejected without raw fallback',()=>{
 const f=fixture();f.tables.USAGE_DAILY_TOTALS[0][4]='playedCount';
 assert.throws(()=>f.execute(),/HEADER_MISMATCH/);
 assert.equal(f.calls.includes('TAB:EVENT_LOG'),false);
});
test('no mutation or raw events / network APIs in reader integration',()=>{
 const clean=adapter.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
 assert.doesNotMatch(clean,/(?:getSheetByName\s*\(\s*['"]EVENT_LOG|appendRow|deleteRows?|setValues?|clearContent|UrlFetchApp|ScriptApp|DriveApp)/);
});
