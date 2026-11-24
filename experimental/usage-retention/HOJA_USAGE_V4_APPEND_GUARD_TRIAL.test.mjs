import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const src=readFileSync('Code.gs','utf8'),start=src.indexOf('function recordUsageStartU1(payload){');
assert.ok(start>0,'U1 append must exist');
const fn=src.slice(start);
const guard=readFileSync('experimental/usage-retention/HOJA_USAGE_V4_APPEND_GUARD_TRIAL.gs','utf8');
const headers=['eventId','timestamp','date','mode','repositoryKind','grade','subject','publisher',
 'cartridge','cartridgeCount','teamCount','cartridgeIds','publicRepositoryNamespace',
 'usageSchemaVersion','cartridgeTitlesJson'];
const id=n=>String(n).padStart(32,'0');
const request=(n,team=1)=>({eventId:id(n),mode:team===1?'SOLO':'TEAM',
 repositoryKind:'PUBLIC',cartridgeIds:['101'],cartridgeCount:1,teamCount:team});
function setup({storage='copy',copy='copy',production='original',canary=true,
 flag='COPIED_SHEET_ONLY',at='2026-11-23T00:15:00Z'}={}){
 const props={SMQ_USAGE_SPREADSHEET_ID:storage,HOJA_USAGE_TRIAL_SPREADSHEET_ID:copy,
  HOJA_USAGE_PRODUCTION_SPREADSHEET_ID:production,HOJA_USAGE_V4_TRIAL_APPEND_GATE:flag};
 const events=[headers.slice()],trace=[];
 const marker={getRange(){return{getDisplayValue(){
  return canary?'HOJA_RETENTION_SANDBOX_V1':'INVALID';}};}};
 const parent={getId(){return storage;},getSheetByName(name){
  return name==='_HOJA_USAGE_TRIAL_ONLY'?marker:name==='EVENT_LOG'?sheet:null;}};
 const sheet={
  getParent(){return parent;},getLastRow(){return events.length;},
  getRange(row,col,n=1,width=1){return{
   getDisplayValues(){return Array.from({length:n},(_,i)=>Array.from(
    {length:width},(_,j)=>String(events[row+i-1]?.[col+j-1]??'')));},
   getDisplayValue(){return String(events[row-1]?.[col-1]??'');},
   createTextFinder(needle){return{matchEntireCell(){return this;},
    findAll(){return events.slice(1).flatMap((r,i)=>String(r[col-1])===needle?
     [{getRow(){return i+2;}}]:[]);}};}
  };},
  appendRow(row){trace.push('APPEND');events.push(row.map((x,i)=>i===1?
   x.toISOString():String(x)));}
 };
 class FixedDate extends Date{constructor(...args){super(...(args.length?args:[at]));}}
 const env={Date:FixedDate,
  SMQ_USAGE_SPREADSHEET_ID_KEY_U1:'SMQ_USAGE_SPREADSHEET_ID',
  SMQ_USAGE_SHEET_U1:'EVENT_LOG',SMQ_USAGE_HEADERS_U1:headers,
  hojaUsageText_(x,max){return String(x==null?'':x).replace(/[\r\n\t]+/g,' ').trim().slice(0,max);},
  hojaProdPublicId_(){return 'public-catalog';},
  hojaPublicSheets_(){return{sheets:[{sheetId:'101',title:'6-사회-공통-테스트'}]};},
  hojaUsageClassification_(){return{grade:'6',subject:'사회',publisher:''};},
  PropertiesService:{getScriptProperties(){return{getProperty(k){return props[k]||'';}};}},
  SpreadsheetApp:{openById(name){trace.push('OPEN:'+name);
   assert.equal(name,storage);return parent;},flush(){trace.push('FLUSH');}},
  LockService:{getScriptLock(){return{tryLock(){trace.push('LOCK');return true;},
   releaseLock(){trace.push('UNLOCK');}};}},
  Utilities:{formatDate(date,tz,fmt){assert.equal(tz,'Asia/Seoul');
   assert.equal(fmt,'yyyy-MM-dd');
   return new Date(date.getTime()+9*3600000).toISOString().slice(0,10);}}
 };
 const ctx=createContext(env);runInContext(guard+'\n'+fn,ctx);
 return {call:payload=>runInContext('recordUsageStartU1('+JSON.stringify(payload)+')',ctx),
  events,props,trace};
}
test('A original U1 COPY-ONLY first append and identical retry are one row',()=>{
 const t=setup(),a=t.call(request(1));assert.equal(a.ok,true);
 assert.equal(t.events[1][2],'2026-11-23');assert.equal(t.events[1][13],'U3S1');
 assert.equal(t.call(request(1)).duplicateIgnored,true);
 assert.equal(t.events.length,2);assert.equal(t.trace.filter(x=>x==='APPEND').length,1);
});
test('conflicting same ID gameplay fails closed',()=>{
 const t=setup();t.call(request(1));
 assert.throws(()=>t.call(request(1,7)),/HOJA_V4_APPEND_TRIAL_EVENT_ID_CONFLICT/);
 assert.equal(t.events.length,2);
});
test('a replay from the previous date does not become a new today play',()=>{
 const t=setup();
 t.events.push([id(3),'2026-11-22T08:00:00Z','2026-11-22','SOLO',
  'PUBLIC','6','사회','','6-사회-공통-테스트','1','1','101',
  'PUBLIC:public-catalog','U3S1','["6-사회-공통-테스트"]']);
 const r=t.call(request(3));
 assert.equal(r.duplicateIgnored,true);assert.equal(r.originalDate,'2026-11-22');
 assert.equal(t.events.length,2);
});
test('future day at last raw row blocks nonmonotonic append',()=>{
 const t=setup();
 t.events.push([id(100),'','2026-11-24',...Array(12).fill('')]);
 assert.throws(()=>t.call(request(4)),/HOJA_V4_APPEND_TRIAL_NON_MONOTONE_DAY/);
 assert.equal(t.events.length,2);
});
test('wrong store/marker/ambiguous original ID fails before appending',()=>{
 for(const options of [{storage:'original'},{canary:false},
  {copy:'original',production:'original'}]){
  const t=setup(options);
  assert.throws(()=>t.call(request(2)),/HOJA_V4_APPEND_TRIAL_/);
  assert.equal(t.events.length,1);
  assert.ok(t.trace.includes('LOCK'));assert.ok(t.trace.includes('UNLOCK'));
 }
});
test('when opt-in is missing, original U1 append behavior is unchanged',()=>{
 const t=setup({flag:''});assert.equal(t.call(request(1)).ok,true);
 t.call(request(1));assert.equal(t.events.length,3);
});
test('branch append still owns exactly one sheet append inside its ScriptLock',()=>{
 assert.match(fn,/HOJA_USAGE_V4_TRIAL_APPEND_GATE/);
 assert.equal((fn.match(/sh\.appendRow\(/g)||[]).length,1);
 assert.ok(fn.indexOf('const flag=')>fn.indexOf('try{'));
 assert.doesNotMatch(guard,/deleteRows?\s*\(|clearContent\s*\(|ScriptApp\.newTrigger/);
});
