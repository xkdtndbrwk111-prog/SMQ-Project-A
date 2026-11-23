// In-memory Apps Script mock for the 40-6-U single-GAS tests (no network).
// Cells are stored as display strings, like getDisplayValues() returns.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createContext,runInContext} from 'node:vm';

export const GAS_DIR='experimental/usage-v4-unified/gas';
export const GAS_FILES=['Code.gs','ApprovedActiveCatalog.gs','UsageV4Core.gs','UsageV4Public.gs','UsageV4Unified.gs'];
export const EVENT_HEADER=['eventId','timestamp','date','mode','repositoryKind','grade',
 'subject','publisher','cartridge','cartridgeCount','teamCount','cartridgeIds',
 'publicRepositoryNamespace','usageSchemaVersion','cartridgeTitlesJson'];
export const sha256=s=>createHash('sha256').update(String(s),'utf8').digest('hex');
const show=v=>v instanceof Date?v.toISOString():v==null?'':String(v);

export class MockSheet{
 constructor(ss,name,rows=[]){this.ss=ss;this.name=name;this.rows=rows.map(r=>r.map(show));}
 getName(){return this.name;}
 getParent(){return this.ss;}
 getLastRow(){let n=this.rows.length;while(n>0&&this.rows[n-1].every(v=>v===''))n--;return n;}
 getLastColumn(){return Math.max(0,...this.rows.map(r=>r.length));}
 appendRow(values){this.ss.trace.push('APPEND:'+this.name);
  if(this.ss.hooks.beforeAppend)this.ss.hooks.beforeAppend(this,values);
  this.rows.splice(this.getLastRow(),0,values.map(show));}
 getRange(row,col,n=1,w=1){
  const sheet=this;
  const cell=(r,c)=>String(sheet.rows[r-1]?.[c-1]??'');
  const put=(r,c,v)=>{while(sheet.rows.length<r)sheet.rows.push([]);
   const line=sheet.rows[r-1];while(line.length<c)line.push('');line[c-1]=show(v);};
  return {
   getDisplayValues(){sheet.ss.reads.push(sheet.name+'!'+row+':'+(row+n-1));
    const hook=sheet.ss.hooks.onRead;if(hook)hook(sheet,row,n);
    return Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>cell(row+i,col+j)));},
   getValues(){return this.getDisplayValues();},
   getDisplayValue(){return cell(row,col);},
   getValue(){return cell(row,col);},
   setValues(vals){sheet.ss.trace.push('WRITE:'+sheet.name);
    if(sheet.ss.hooks.onWrite)sheet.ss.hooks.onWrite(sheet,row,vals);
    vals.forEach((r,i)=>r.forEach((v,j)=>put(row+i,col+j,v)));},
   setValue(v){sheet.ss.trace.push('WRITE:'+sheet.name);put(row,col,v);},
   setNumberFormat(){return this;},
   createTextFinder(needle){return {matchEntireCell(){return this;},findAll(){
    const out=[];for(let i=0;i<n;i++)if(cell(row+i,col)===needle)out.push({getRow:()=>row+i});
    sheet.ss.trace.push('FIND:'+n);return out;}};}
  };
 }
}
export class MockSpreadsheet{
 constructor(id){this.id=id;this.sheets=new Map();this.trace=[];this.reads=[];this.hooks={};}
 getId(){return this.id;}
 getSheetByName(n){return this.sheets.get(n)||null;}
 insertSheet(n){this.trace.push('INSERT:'+n);const s=new MockSheet(this,n);this.sheets.set(n,s);return s;}
 add(n,rows){const s=new MockSheet(this,n,rows);this.sheets.set(n,s);return s;}
}
export function kstDay(ms){return new Date(ms+9*3600000).toISOString().slice(0,10);}

/* Loads the exact gas/*.gs files into one V8 context (= one GAS project). */
export function loadProject({spreadsheets,props={},now='2026-11-23T03:00:00Z',
 activeEmail='',effectiveEmail='owner@example.test',catalog}){
 const clock={ms:Date.parse(now)};
 class FixedDate extends Date{constructor(...a){super(...(a.length?a:[clock.ms]));}
  static now(){return clock.ms;}}
 const store=new Map(Object.entries(props));
 const cache=new Map(),trace=[];
 const locks={held:false,count:0};
 const env={
  Date:FixedDate,console:{error(){},log(){}},
  PropertiesService:{getScriptProperties(){return{
   getProperty:k=>store.has(k)?store.get(k):null,
   setProperty:(k,v)=>{trace.push('PROP:'+k);store.set(k,String(v));}}}},
  SpreadsheetApp:{openById(id){trace.push('OPEN:'+id);
   const ss=spreadsheets.get(id);if(!ss)throw Error('NO_SUCH_SPREADSHEET');return ss;},
   flush(){trace.push('FLUSH');}},
  LockService:{getScriptLock(){return{
   tryLock(){trace.push('LOCK');if(locks.held)return false;locks.held=true;locks.count++;return true;},
   waitLock(){this.tryLock();},
   releaseLock(){trace.push('UNLOCK');locks.held=false;}};}},
  CacheService:{getScriptCache(){return{
   get:k=>{const e=cache.get(k);return e&&e.exp>clock.ms?e.v:null;},
   put:(k,v,ttl)=>{cache.set(k,{v:String(v),exp:clock.ms+ttl*1000});},
   remove:k=>{cache.delete(k);}};}},
  Session:{getActiveUser:()=>({getEmail:()=>env.__active}),
   getEffectiveUser:()=>({getEmail:()=>effectiveEmail})},
  Utilities:{DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},
   computeDigest(_a,s){return [...createHash('sha256').update(String(s),'utf8').digest()]
    .map(b=>b>127?b-256:b);},
   formatDate(d,tz,f){if(tz!=='Asia/Seoul'||f!=='yyyy-MM-dd')throw Error('FORMAT');
    return kstDay(d.getTime());}},
  HtmlService:{XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},createHtmlOutputFromFile(name){
   const o={file:name,title:'',meta:[],setTitle(t){o.title=t;return o;},
    addMetaTag(k,v){o.meta.push([k,v]);return o;},setXFrameOptionsMode(){return o;}};return o;}},
  UrlFetchApp:{fetch(){throw Error('NETWORK_DISABLED_IN_TEST');}},
  ScriptApp:{getOAuthToken(){return 'x';},getScriptId(){return env.__scriptId;},newTrigger(){throw Error('TRIGGER_FORBIDDEN');}},
  __scriptId:'MOCK_ISOLATED_TEST_SCRIPT_ID_0001',
  __active:activeEmail
 };
 const ctx=createContext(env);
 for(const f of GAS_FILES)runInContext(readFileSync(GAS_DIR+'/'+f,'utf8'),ctx,{filename:f});
 const cat=catalog||[{sheetId:'101',title:'6-사회-천재-2단원'},{sheetId:'102',title:'5-수학-비상-3단원'}];
 ctx.__catalog=cat;
 runInContext('hojaPublicSheets_=function(){return {sheets:__catalog.map(x=>({title:x.title,sheetId:x.sheetId})),generation:"1",incarnationId:"a"};}',ctx);
 const call=(expr)=>{const r=runInContext(expr,ctx);return r===undefined?r:JSON.parse(JSON.stringify(r));};
 return {ctx,call,props:store,cache,trace,clock,locks,
  setNow(iso){clock.ms=Date.parse(iso);},
  setActive(email){env.__active=email;},
  rpc(name,...args){return call(name+'('+args.map(a=>JSON.stringify(a)).join(',')+')');}};
}
