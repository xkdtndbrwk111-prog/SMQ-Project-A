import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createHash} from 'node:crypto';

const core=readFileSync('experimental/usage-retention/HOJA_USAGE_RETENTION_CORE.js','utf8');
const previewSource=readFileSync('experimental/usage-retention/HOJA_USAGE_RETENTION_TRIAL_GAS.gs','utf8');
const writerSource=readFileSync('experimental/usage-retention/HOJA_USAGE_RETENTION_TRIAL_WRITER.gs','utf8');
const header=['eventId','timestamp','date','mode','repositoryKind','grade','subject','publisher',
 'cartridge','cartridgeCount','teamCount','cartridgeIds','publicRepositoryNamespace',
 'usageSchemaVersion','cartridgeTitlesJson'];
const mkrow=(n,ids='101')=>[
 String(n).padStart(32,'0'),new Date('2026-11-20T00:00:00Z'),'2026-11-20','SOLO',
 'PUBLIC','6','사회','','사회',ids.split('|').length,1,ids,'PUBLIC:copy','U3S1','[]'
];
function fixture({ack=true,canary=true,rows=[mkrow(1,'101|102'),mkrow(2,'101')]}={}){
 const p={'HOJA_USAGE_TRIAL_SPREADSHEET_ID':'copy','SMQ_USAGE_SPREADSHEET_ID':'production',
  'HOJA_USAGE_TRIAL_WRITE_ACK':ack?'COPIED_SHEET_ONLY':''};
 const writes=[];
 const contents=new Map([
  ['EVENT_LOG',[header,...rows]],
  ['_HOJA_USAGE_TRIAL_ONLY',canary?[['HOJA_RETENTION_SANDBOX_V1']]:[['WRONG']]],
 ]);
 const ss={
  getSheetByName(name){return contents.has(name)?makeSheet(name):null;},
  insertSheet(name){contents.set(name,[]);return makeSheet(name);}
 };
 let failOn=null;
 function makeSheet(name){
  return {
   getName(){return name;},
   getLastRow(){return contents.get(name).length;},
   getLastColumn(){return Math.max(0,...contents.get(name).map(r=>r.length));},
   getRange(start,col,num=1,width=1){
    const tab=contents.get(name);
    const slice=()=>Array.from({length:num},(_,i)=>
      Array.from({length:width},(_,k)=>tab[start+i-1]?.[col+k-1]??''));
    const assign=matrix=>{
     if(failOn===name)throw Error('SIMULATED_INTERRUPTED_WRITE');
     writes.push({name,start,col,len:matrix.length});
     for(let i=0;i<matrix.length;i++){
      const y=start+i-1;
      while(tab.length<=y)tab.push([]);
      for(let k=0;k<matrix[i].length;k++)tab[y][col+k-1]=matrix[i][k];
     }
    };
    return {
     getValues:()=>slice(),getDisplayValues:()=>slice().map(r=>r.map(v=>String(v))),
     getValue:()=>slice()[0][0],
     setValues(matrix){assign(matrix);return this;},
     setValue(value){assign([[value]]);return this;},
     setNumberFormat(fmt){assert.equal(fmt,'@');return this;}
    };
   }
  };
 }
 let locked=false;
 const sandbox={
  Date,
  PropertiesService:{getScriptProperties(){return {getProperty(k){return p[k]||'';}};}},
  SpreadsheetApp:{
   openById(id){if(id!=='copy')throw Error('MUST_NOT_READ_PRODUCTION');return ss;},
   flush(){}
  },
  LockService:{getScriptLock(){return {
   tryLock(){if(locked)return false;locked=true;return true;},
   releaseLock(){assert.equal(locked,true);locked=false;}
  };}},
  Utilities:{
   DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},
   formatDate(d,tz,fmt){
    assert.equal(tz,'Asia/Seoul');assert.equal(fmt,'yyyy-MM-dd');
    return d.toISOString().slice(0,10);
   },
   computeDigest(a,s,c){assert.equal(a,'SHA_256');assert.equal(c,'UTF_8');
    return Array.from(createHash('sha256').update(s).digest());}
  }
 };
 const context=createContext(sandbox);
 runInContext(core+'\n'+previewSource+'\n'+writerSource,context);
 return {run:()=>runInContext('hojaUsageRetentionWriteTrialU1()',context),
  writes,contents,p,setFail:(name)=>{failOn=name;}};
}

test('missing manual write confirmation blocks all writes',()=>{
 const t=fixture({ack:false});
 assert.throws(()=>t.run(),/TRIAL_WRITE_ACK_REQUIRED/);
 assert.equal(t.writes.length,0);
});

test('missing canary blocks all writes',()=>{
 const t=fixture({canary:false});
 assert.throws(()=>t.run(),/TRIAL_CANARY_REQUIRED/);
 assert.equal(t.writes.length,0);
});

test('copied sheet: summary rows + verified manifest; EVENT_LOG untouched',()=>{
 const t=fixture();
 const snapshot=JSON.stringify(t.contents.get('EVENT_LOG'));
 const result=t.run();
 assert.equal(result.ok,true);assert.equal(result.replayed,false);
 assert.equal(result.uniqueStarts,2);
 assert.equal(result.dailyTotalRows,1);
 assert.equal(result.dailyDimensionRows,2);
 assert.equal(t.contents.get('HOJA_TRIAL_RETENTION_MANIFEST')[1][4],'COMPLETE');
 assert.equal(t.contents.get('HOJA_TRIAL_DAILY_TOTALS')[1][4],2);
 assert.equal(t.contents.get('HOJA_TRIAL_DAILY_DIMENSIONS')[1][8],2);
 assert.equal(JSON.stringify(t.contents.get('EVENT_LOG')),snapshot);
 assert.equal(t.writes.some(x=>x.name==='EVENT_LOG'),false);
});

test('replay same SHA-256 is idempotent; does not append extra rows',()=>{
 const t=fixture();
 const a=t.run(),counts=[...t.contents].map(([key,value])=>[key,value.length]);
 const b=t.run();
 assert.equal(b.replayed,true);
 assert.equal(a.generation,b.generation);
 assert.deepEqual([...t.contents].map(([key,value])=>[key,value.length]),counts);
});

test('incomplete generation stops and remains visible for manual review',()=>{
 const t=fixture();t.setFail('HOJA_TRIAL_DAILY_TOTALS');
 assert.throws(()=>t.run(),/SIMULATED_INTERRUPTED_WRITE/);
 assert.equal(t.contents.get('HOJA_TRIAL_RETENTION_MANIFEST')[1][4],'PREPARING');
 t.setFail(null);
 assert.throws(()=>t.run(),/INCOMPLETE_GENERATION_REVIEW_REQUIRED/);
 assert.equal(t.contents.get('HOJA_TRIAL_RETENTION_MANIFEST').length,2);
});

test('wrong production ID guard stops even with a canary',()=>{
 const t=fixture();
 t.p['SMQ_USAGE_SPREADSHEET_ID']='copy';
 assert.throws(()=>t.run(),/TRIAL_EQUALS_PRODUCTION/);
 assert.equal(t.writes.length,0);
});

test('trial writer contains no deletion, raw clearing, trigger or external RPC',()=>{
 const clean=writerSource.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
 assert.doesNotMatch(clean,/(?:deleteRows?|clearContent|ScriptApp|UrlFetchApp|doPost)\s*[.(]/);
});
