/* 40-6-U3 TEST-ONLY file. Exists ONLY in the isolated test Apps Script project.
 * NOT part of the repository GAS bundle. Contains copy IDs + a one-time token. */
const HOJA_U3T_COPY_='<REDACTED_SPREADSHEET_ID>';
const HOJA_U3T_CERT_='<REDACTED_SPREADSHEET_ID>';
const HOJA_U3T_PROD_='<REDACTED_SPREADSHEET_ID>';
const HOJA_U3T_TOKEN_='<REDACTED_ONE_TIME_TOKEN>';
/* Run ONCE from the editor (owner). Writes only the copy's B1 canary + properties. */
function hojaV4TestSetupU3(){
 hojaV4uRequireOperator_();
 if(new Set([HOJA_U3T_COPY_,HOJA_U3T_CERT_,HOJA_U3T_PROD_]).size!==3)throw Error('IDS');
 const ss=SpreadsheetApp.openById(HOJA_U3T_COPY_);
 if(ss.getId()!==HOJA_U3T_COPY_)throw Error('COPY_ID');
 const c=ss.getSheetByName('_HOJA_USAGE_TRIAL_ONLY');
 if(!c||String(c.getRange(1,1).getDisplayValue()).trim()!=='HOJA_RETENTION_SANDBOX_V1')throw Error('A1_CANARY');
 const b1=String(c.getRange(1,2).getDisplayValue()).trim();
 if(b1&&b1!=='HOJA_V4_40_6U_WRITE_COPY')throw Error('B1_OCCUPIED');
 c.getRange(1,2).setValue('HOJA_V4_40_6U_WRITE_COPY');
 const p=PropertiesService.getScriptProperties();
 p.setProperties({SMQ_USAGE_SPREADSHEET_ID:HOJA_U3T_COPY_,
  HOJA_USAGE_PRODUCTION_SPREADSHEET_ID:HOJA_U3T_PROD_,
  HOJA_USAGE_CERTIFIED_COPY_SPREADSHEET_ID:HOJA_U3T_CERT_,
  HOJA_V4_UNIFIED_ISOLATION:'COPY_40_6U_ONLY',HOJA_V4_U3_TEST_TOKEN:HOJA_U3T_TOKEN_});
 return 'SETUP_OK '+JSON.stringify(hojaV4OpsStatus());
}
/* Token-guarded aggregate evidence (no IDs, no rows). Test deployment only. */
function hojaV4TestEvidenceU3(token){
 const want=PropertiesService.getScriptProperties().getProperty('HOJA_V4_U3_TEST_TOKEN')||'';
 if(!want||token!==want)throw Error('HOJA_V4_U3_TEST_DENIED');
 const t0=Date.now();
 const ctx=hojaV4uOpen_(PropertiesService.getScriptProperties());
 const ev=ctx.event,last=ev.getLastRow();
 const rows=ev.getRange(2,1,last-1,15).getDisplayValues();
 const st=hojaV4uManifestState_(ctx,false);
 const b=hojaV4uTab_(ctx.ss,HOJA_V4U_BUCKET_TAB_,HOJA_V4U_BUCKET_HEADER_,false);
 const brows=hojaV4uRows_(b,6,40000,'B');
 const tRead=Date.now()-t0;
 const ids=new Set();let raw=0,retries=0,uniq=0,zero=0,srcOk=0,bOk=0,setOk=0;const bad=[];
 let prev=1;
 for(const m of st.complete){
  const n=Number(m[5]),day=n?rows.slice(Number(m[3])-2,Number(m[4])-1):[];
  if(day.length!==n||day.some(r=>r[2]!==m[0])||Number(m[11])!==prev+n){bad.push('RANGE '+m[0]);}
  prev=Number(m[11]);
  const s=HOJA_USAGE_V4_CORE.snapshot(m[0],day,{coverageVerified:true});
  raw+=n;retries+=s.retriesSuppressed;uniq+=s.starts;if(!n)zero++;
  if(hojaV4uSha256_(s.canonicalSource)===m[7]&&m[1]===m[7])srcOk++;else bad.push('SRC '+m[0]);
  const stored=brows.filter(r=>r[0]===m[0]&&r[1]===m[1]).map(r=>({dimension:r[2],key:r[3],count:Number(r[5]),displayLabel:r[4]}));
  if(hojaV4uSha256_(JSON.stringify(stored))===m[12])bOk++;else bad.push('BKT '+m[0]);
  const a=JSON.stringify(stored.slice().sort((x,y)=>(x.dimension+x.key)<(y.dimension+y.key)?-1:1));
  const e=JSON.stringify(s.buckets.slice().sort((x,y)=>(x.dimension+x.key)<(y.dimension+y.key)?-1:1));
  if(a===e)setOk++;else bad.push('SET '+m[0]);
 }
 // public label suppression on the real combination names (counts only)
 const combos=new Map();
 for(const r of brows)if(r[2]==='CARTRIDGE_COMBINATION')combos.set(r[3],(combos.get(r[3])||0)+Number(r[5]));
 let hidden=0,hiddenCount=0,small=0;
 for(const [k,v] of combos){if(HOJA_USAGE_V4_PUBLIC.safeCartridgeLabel(k)!==k){hidden++;hiddenCount+=v;}else if(v<5)small++;}
 const t1=Date.now();let pub=null,pubErr='';
 try{const r=hojaV4uComputePublic_(new Date());pub={all:r.totals.all,today:r.totals.today,d7:r.totals.days7,d30:r.totals.days30,days:r.daily.length,prov:r.provisionalDays};}
 catch(e){pubErr=String(e.message);}
 return {sourceLastRow:last,manifestComplete:st.complete.length,preparing:st.preparing.length,
  sealedThrough:st.lastDate,sealedPrefix:st.prefix,rawRows:raw,uniquePlays:uniq,retries,zeroDays:zero,
  bucketRows:brows.length,srcShaOk:srcOk,bucketShaOk:bOk,bucketSetOk:setOk,bad:bad.slice(0,10),
  combos:combos.size,combosHiddenByNameRule:hidden,playsInHidden:hiddenCount,combosSmallUnder5:small,
  watermark:hojaV4uReadWatermark_(ctx),publicCompute:pub,publicComputeError:pubErr,
  ms:{readAll:tRead,verifyAll:t1-t0-tRead,publicCompute:Date.now()-t1},
  b1:String(ctx.ss.getSheetByName('_HOJA_USAGE_TRIAL_ONLY').getRange(1,2).getDisplayValue())};
}
/* R8 tamper test on the COPY only: on=true sets bucket row2 count to 999, on=false restores. */
function hojaV4TestTamperU3(token,on){
 const p=PropertiesService.getScriptProperties();
 const want=p.getProperty('HOJA_V4_U3_TEST_TOKEN')||'';
 if(!want||token!==want)throw Error('HOJA_V4_U3_TEST_DENIED');
 const ctx=hojaV4uOpen_(p);
 const cell=ctx.ss.getSheetByName(HOJA_V4U_BUCKET_TAB_).getRange(2,6);
 if(on===true){
  if(p.getProperty('HOJA_V4_U3_TAMPER_ORIG'))throw Error('ALREADY_TAMPERED');
  p.setProperty('HOJA_V4_U3_TAMPER_ORIG',String(cell.getDisplayValue()));cell.setValue('999');
 }else{
  const orig=p.getProperty('HOJA_V4_U3_TAMPER_ORIG');if(!orig)throw Error('NOT_TAMPERED');
  cell.setNumberFormat('@');cell.setValue(orig);p.deleteProperty('HOJA_V4_U3_TAMPER_ORIG');
 }
 SpreadsheetApp.flush();
 hojaV4TestClearCacheU3(token);
 return {tampered:on===true,cell:String(cell.getDisplayValue())==='999'};
}
function hojaV4TestClearCacheU3(token){
 const want=PropertiesService.getScriptProperties().getProperty('HOJA_V4_U3_TEST_TOKEN')||'';
 if(!want||token!==want)throw Error('HOJA_V4_U3_TEST_DENIED');
 const c=CacheService.getScriptCache();c.removeAll([HOJA_V4U_CACHE_FRESH_,HOJA_V4U_CACHE_GOOD_]);
 return true;
}
/* 40-6-U D (R6 rerun): counts only, never ids. Rows after `fromRow` up to the last row. */
function hojaV4TestTailU3(token,fromRow){
 const want=PropertiesService.getScriptProperties().getProperty('HOJA_V4_U3_TEST_TOKEN')||'';
 if(!want||token!==want)throw Error('HOJA_V4_U3_TEST_DENIED');
 const ctx=hojaV4uOpen_(PropertiesService.getScriptProperties());
 const last=ctx.event.getLastRow(),from=Number(fromRow);
 if(!Number.isSafeInteger(from)||from<1||from>last)throw Error('BAD_FROM');
 const rows=last>from?ctx.event.getRange(from+1,1,last-from,15).getDisplayValues():[];
 const ids=new Map(),schema={};
 let invalid=0;
 for(const r of rows){ids.set(r[0],(ids.get(r[0])||0)+1);schema[r[13]]=(schema[r[13]]||0)+1;
  if(!HOJA_USAGE_V4_PUBLIC.validTailRow(r))invalid++;}
 return {lastRow:last,rowsAdded:rows.length,uniqueEventIds:ids.size,
  duplicateRows:rows.length-ids.size,invalidRows:invalid,schema,watermark:hojaV4uReadWatermark_(ctx)};
}
/* Cold-start burst: drop the writer caches (catalog / sealed state / canary) and public caches. */
function hojaV4TestColdU3(token){
 const want=PropertiesService.getScriptProperties().getProperty('HOJA_V4_U3_TEST_TOKEN')||'';
 if(!want||token!==want)throw Error('HOJA_V4_U3_TEST_DENIED');
 const ctx=hojaV4uOpen_(PropertiesService.getScriptProperties());
 CacheService.getScriptCache().removeAll([HOJA_USAGE_CATALOG_CACHE_KEY_,HOJA_V4U_SEALED_CACHE_,
  HOJA_V4U_VERIFIED_CACHE_+ctx.tag,HOJA_V4U_CACHE_FRESH_,HOJA_V4U_CACHE_GOOD_]);
 return true;
}

/* F4 (40-6AB/AC): token-guarded tail check of NEW EVENT_LOG rows after `fromRow`. Returns, per row,
 * only public catalog facts: KST date, mode, schema, namespace, repository kind, whether every
 * cartridge id is an ACTIVE approved id (and those public approved ids), plus duplicate eventId count.
 * Never returns eventIds, timestamps, titles, sheet ids or any user data. */
function hojaV4TestTailF4(token,fromRow){
 const want=PropertiesService.getScriptProperties().getProperty('HOJA_V4_U3_TEST_TOKEN')||'';
 if(!want||token!==want)throw Error('HOJA_V4_U3_TEST_DENIED');
 const ctx=hojaV4uOpen_(PropertiesService.getScriptProperties());
 const last=ctx.event.getLastRow(),from=Number(fromRow);
 if(!Number.isSafeInteger(from)||from<1||from>last)throw Error('BAD_FROM');
 const rows=last>from?ctx.event.getRange(from+1,1,last-from,15).getDisplayValues():[];
 const active=new Set(hojaApprovedActive_().entries.map(e=>e.cartridgeId));
 const seen=new Map();
 const out=rows.map(r=>{seen.set(r[0],(seen.get(r[0])||0)+1);
  let ids=[];try{ids=JSON.parse(r[11]||'[]');}catch(e){ids=['UNPARSEABLE'];}
  const approved=Array.isArray(ids)&&ids.length>0&&ids.every(x=>active.has(String(x)));
  return {date:r[2],mode:r[3],repositoryKind:r[4],schema:r[13],namespace:r[12],
   allIdsActiveApproved:approved,approvedIds:approved?ids:[],cartridgeCount:r[9],teamCount:r[10],
   validTail:HOJA_USAGE_V4_PUBLIC.validTailRow(r)};});
 return {lastRow:last,rowsAdded:rows.length,uniqueEventIds:seen.size,duplicateRows:rows.length-seen.size,
  rows:out,watermark:hojaV4uReadWatermark_(ctx)};
}
