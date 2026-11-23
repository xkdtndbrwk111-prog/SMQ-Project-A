import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createContext,runInContext} from 'node:vm';
const paths=[
 'experimental/usage-retention/HOJA_USAGE_V4_CORE.js',
 'experimental/usage-retention/HOJA_USAGE_V4_TRIAL_GAS.gs',
 'experimental/usage-retention/HOJA_USAGE_V4_LIVE_TAIL.js',
 'experimental/usage-retention/HOJA_USAGE_V4_LIVE_TRIAL_GAS.gs'
];
const sources=paths.map(x=>readFileSync(x,'utf8'));
const rawCore=runInContext(sources[0]+'\nHOJA_USAGE_V4_CORE',createContext({Date}));
const hash=s=>createHash('sha256').update(s).digest('hex');
const d=x=>JSON.parse(JSON.stringify(x));
function game(n,date,{mode='SOLO',team=1}={}){
 return [String(n).padStart(32,'0'),'2026-11-23T00:15:00Z',date,mode,'PUBLIC',
  '6','사회','','사회 2단원',1,team,'101','PUBLIC:TEST','U3S1','["사회2"]'];
}
function setup({deny=false,late=false,wrongCanary=false,corruptBucket=false,
 dropZeroDay=false,extraToday=false}={}){
 const events=[game(1,'2026-11-20'),game(2,'2026-11-22'),
  game(3,late?'2026-11-22':'2026-11-23')];
 if(extraToday)events.push(game(4,'2026-11-23',{mode:'TEAM',team:7}));
 const certHeaders=['scope','startDate','endDate','rawRows','uniquePlays',
  'duplicateRetries','zeroUseDays','bucketRows','sourceLastRow','validation'];
 const mHeaders=['date','generation','status','sourceStartRow','sourceEndRow',
  'sourceRowCount','publicStarts','contentDigest','bucketCount','createdAt',
  'verifiedAt','sourcePrefixEndRow','bucketDigest','retriesSuppressed'];
 const bHeaders=['date','generation','dimension','dimensionKey','displayLabel','count'];
 const dates=['2026-11-20','2026-11-21','2026-11-22'];
 const historical=[events[0],events[1]],buckets=[],manifest=[];
 let prefix=1;
 for(const date of dates){
  const rows=historical.filter(r=>r[2]===date),
   r=rawCore.snapshot(date,rows,{coverageVerified:true});
  const gen=hash(r.canonicalSource),bd=hash(JSON.stringify(d(r.buckets))),previous=prefix;
  prefix+=rows.length;
  manifest.push([date,gen,'COMPLETE',rows.length?previous+1:0,
   rows.length?prefix:0,rows.length,r.starts,gen,r.buckets.length,
   '2026-11-23','2026-11-23',prefix,bd,r.retriesSuppressed]);
  for(const b of r.buckets)
   buckets.push([date,gen,b.dimension,b.key,b.displayLabel,String(b.count)]);
 }
 if(corruptBucket)buckets[0][5]='999';
 const tabs=new Map([
  ['_HOJA_USAGE_TRIAL_ONLY',[[wrongCanary?'BAD':'HOJA_RETENTION_SANDBOX_V1']]],
  ['HOJA_V4_BACKFILL_AUDIT',[certHeaders,[
   'COPY_ONLY_CONNECTOR_SHA256_V4','2026-11-20','2026-11-22',
   2,2,0,1,buckets.length,3,
   'FULL_SOURCE_AND_BUCKET_SHA256_PASS_NOT_ACTUAL_GAS_EXECUTION']]],
  ['HOJA_V4_DAILY_MANIFEST',[mHeaders,...(dropZeroDay?manifest.filter(x=>x[0]!=='2026-11-21'):manifest)]],
  ['HOJA_V4_DAILY_BUCKETS',[bHeaders,...buckets]],
  ['EVENT_LOG',[['eventId','timestamp','date','mode','repositoryKind','grade',
   'subject','publisher','cartridge','cartridgeCount','teamCount',
   'cartridgeIds','publicRepositoryNamespace','usageSchemaVersion',
   'cartridgeTitlesJson'],...events]]
 ]);
 const trace=[],state={authCalls:0};
 const props={
  HOJA_USAGE_TRIAL_SPREADSHEET_ID:'test-copy',
  HOJA_USAGE_PRODUCTION_SPREADSHEET_ID:'production-id'
 };
 const env={
  Date:class FixedDate extends Date{
   constructor(...args){super(...(args.length?args:['2026-11-23T00:10:00Z']));}
   static now(){return Date.parse('2026-11-23T00:10:00Z');}
  },
  PropertiesService:{getScriptProperties(){return{getProperty(k){return props[k]||'';}};}},
  requireUsageStatisticsAccessU3_(token){
   trace.push('AUTH');state.authCalls++;
   if(deny)throw Error('USAGE_ACCESS_DENIED');
   assert.equal(token,'valid-token');
   return {role:'OWNER'};
  },
  SpreadsheetApp:{openById(id){
   trace.push('OPEN');assert.equal(id,'test-copy');
   return {
    getSheetByName(name){
     trace.push('TAB:'+name);
     if(!tabs.has(name))return null;
     const grid=tabs.get(name);
     return {
      getName(){return name;},
      getLastRow(){trace.push('LAST:'+name);return grid.length;},
      getLastColumn(){return Math.max(...grid.map(x=>x.length));},
      getRange(start,col,n=1,width=1){
       trace.push('RANGE:'+name+':'+start+':'+n);
       if(name==='EVENT_LOG'&&start<=3)throw Error('HISTORICAL_RAW_READ_FORBIDDEN');
       const data=Array.from({length:n},(_,i)=>
        Array.from({length:width},(_,j)=>grid[start+i-1]?.[col+j-1]??''));
       return {getDisplayValues(){return data.map(r=>r.map(x=>String(x)));},
        getValue(){return data[0][0];}};
      }
     };
    }
   };
  }},
  Utilities:{
   formatDate(date,tz,fmt){
    assert.equal(tz,'Asia/Seoul');assert.equal(fmt,'yyyy-MM-dd');
    return new Date(date.getTime()+9*3600_000).toISOString().slice(0,10);
   },
   DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},
   computeDigest(kind,s,encoding){
    assert.equal(kind,'SHA_256');assert.equal(encoding,'UTF_8');
    return [...createHash('sha256').update(s).digest()];
   }
  }
 };
 const ctx=createContext(env);runInContext(sources.join('\n'),ctx);
 const run=()=>runInContext('getUsageStatisticsU4TrialShadow("valid-token")',ctx);
 return{run,trace,tabs,state,props,prefix};
}
test('existing U2 contract returns from complete summaries + only today raw A:O tail',()=>{
 const t=setup(),r=t.run();
 assert.equal(r.preview.totals.all,3);
 assert.equal(r.preview.totals.today,1);
 assert.equal(r.preview.totals.days7,3);
 assert.equal(r.preview.daily.length,4);
 assert.equal(r.preview.daily[1].count,0);
 assert.equal(r.productionSwitchAllowed,false);
 assert.equal(r.todayStatus,'LIVE_PROVISIONAL');
 assert.equal(r.summary.verifiedPastDays,3);
 assert.equal(t.trace.filter(x=>x.startsWith('RANGE:EVENT_LOG')).length,1);
 assert.ok(t.trace.includes('RANGE:EVENT_LOG:4:1'));
 assert.ok(t.trace.indexOf('AUTH')<t.trace.indexOf('OPEN'));
});
test('today extra team7 entry is included without historical raw reread',()=>{
 const t=setup({extraToday:true}),result=t.run();
 assert.equal(result.preview.totals.all,4);
 assert.equal(result.preview.totals.today,2);
 assert.equal(result.preview.teamCount.find(x=>x.label==='7팀전').count,1);
 assert.deepEqual(t.trace.filter(x=>x.startsWith('RANGE:EVENT_LOG')),[ 'RANGE:EVENT_LOG:4:2' ]);
});
test('real Project B revocation denies request BEFORE spreadsheet access',()=>{
 const t=setup({deny:true});
 assert.throws(()=>t.run(),/USAGE_ACCESS_DENIED/);
 assert.equal(t.trace[0],'AUTH');
 assert.equal(t.trace.includes('OPEN'),false);
});
test('late event after sealed watermark stops stats instead of silently miscounting',()=>{
 const t=setup({late:true});
 assert.throws(()=>t.run(),/HOJA_V4_LIVE_LATE_OR_FUTURE_EVENT_DAY/);
});
test('a missing zero day, mutated bucket or false canary rejects trial read',()=>{
 for(const options of [{dropZeroDay:true},{corruptBucket:true},{wrongCanary:true}]){
  const t=setup(options);
  assert.throws(()=>t.run(),/HOJA_V4_/);
 }
});
test('pure trial RPC cannot replace production getUsageStatisticsU2 or mutate original',()=>{
 const src=sources.at(-1).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
 assert.doesNotMatch(src,/function\s+getUsageStatisticsU2\s*\(/);
 assert.doesNotMatch(src,/(?:appendRow|deleteRows?|clearContent|setValues?|ScriptApp|UrlFetchApp)\s*[.(]/);
});
