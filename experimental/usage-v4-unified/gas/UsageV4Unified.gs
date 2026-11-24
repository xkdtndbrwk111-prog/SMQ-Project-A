/* HOJA V4 — Project A single-GAS adapter (40-6-U, ISOLATED COPY ONLY).
 * Requires sibling files: Code.gs (recordUsageStartU1), UsageV4Core.gs,
 * UsageV4Public.gs. Public RPCs defined here: getPublicUsageStatisticsV4().
 * Operator-only entrypoints: hojaV4OpsSealPendingDays(), hojaV4OpsStatus().
 * Everything else ends with '_' so google.script.run cannot reach it.
 *
 * NO deletion, NO archive, NO trigger installation, NO production switch.
 * The adapter refuses to open any spreadsheet unless
 *   HOJA_V4_UNIFIED_ISOLATION=COPY_40_6U_ONLY, the storage ID differs from the
 *   production and the certified-copy IDs, and both canary cells are present.
 * With the isolation property ABSENT the V4 layer is disabled: the writer keeps
 * the original U1 behaviour exactly and public stats answer NOT_CONFIGURED.
 *
 * Concurrency: one ScriptLock (same project) for writer and seal; the public
 * reader takes NO lock and reads only rows <= the commit watermark W, which the
 * writer advances only after append + flush + read-back verification.
 */
const HOJA_V4U_ISOLATION_PROP_='HOJA_V4_UNIFIED_ISOLATION';
const HOJA_V4U_ISOLATION_VALUE_='COPY_40_6U_ONLY';
const HOJA_V4U_PROD_PROP_='HOJA_USAGE_PRODUCTION_SPREADSHEET_ID';
const HOJA_V4U_CERT_PROP_='HOJA_USAGE_CERTIFIED_COPY_SPREADSHEET_ID';
const HOJA_V4U_WATERMARK_PROP_='HOJA_V4_COMMIT_WATERMARK';
const HOJA_V4U_CANARY_TAB_='_HOJA_USAGE_TRIAL_ONLY';
const HOJA_V4U_CANARY_A1_='HOJA_RETENTION_SANDBOX_V1';
const HOJA_V4U_CANARY_B1_='HOJA_V4_40_6U_WRITE_COPY';
const HOJA_V4U_MANIFEST_TAB_='HOJA_V4_DAILY_MANIFEST';
const HOJA_V4U_BUCKET_TAB_='HOJA_V4_DAILY_BUCKETS';
const HOJA_V4U_AUDIT_TAB_='HOJA_V4_BACKFILL_AUDIT';
const HOJA_V4U_MANIFEST_HEADER_=['date','generation','status','sourceStartRow',
 'sourceEndRow','sourceRowCount','publicStarts','contentDigest','bucketCount',
 'createdAt','verifiedAt','sourcePrefixEndRow','bucketDigest','retriesSuppressed'];
const HOJA_V4U_BUCKET_HEADER_=['date','generation','dimension','dimensionKey',
 'displayLabel','count'];
const HOJA_V4U_AUDIT_HEADER_=['scope','startDate','endDate','rawRows',
 'uniquePlays','duplicateRetries','zeroUseDays','bucketRows','sourceLastRow','validation'];
const HOJA_V4U_AUDIT_SCOPES_=['COPY_ONLY_CONNECTOR_SHA256_V4'];
const HOJA_V4U_LIMITS_={manifestRows:400,bucketRows:40000,tailRows:25000,
 dedupeWindowRows:25000,replayHits:12,writesPerMinute:300,recomputesPerMinute:20,
 freshSeconds:60,staleSeconds:600,sealDaysPerRun:7};
const HOJA_V4U_CACHE_FRESH_='HOJA_V4U_PUBLIC_FRESH_V1';
const HOJA_V4U_CACHE_GOOD_='HOJA_V4U_PUBLIC_GOOD_V1';
// 40-6-U D (R6): writer-side caches. Both are safe-direction: a stale entry can
// only widen the dedupe window or repeat a verification, never skip a guard.
const HOJA_V4U_SEALED_CACHE_='HOJA_V4U_SEALED_STATE_V1';
const HOJA_V4U_VERIFIED_CACHE_='HOJA_V4U_WRITER_VERIFIED_V1_';
const HOJA_V4U_VERIFIED_SECONDS_=300;

/* ----------------------------- basics ----------------------------- */
function hojaV4uSha256_(payload){
 return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
  String(payload),Utilities.Charset.UTF_8)
  .map(x=>(x<0?x+256:x).toString(16).padStart(2,'0')).join('');
}
function hojaV4uKstDay_(value){
 return Utilities.formatDate(value,'Asia/Seoul','yyyy-MM-dd');
}
function hojaV4uNextDay_(day){
 return new Date(Date.parse(day+'T00:00:00.000Z')+86400000).toISOString().slice(0,10);
}
function hojaV4uEnabled_(props){
 const flag=String(props.getProperty(HOJA_V4U_ISOLATION_PROP_)||'').trim();
 if(!flag)return false;
 if(flag!==HOJA_V4U_ISOLATION_VALUE_)throw Error('HOJA_V4U_ISOLATION_MODE_DENIED');
 return true;
}
function hojaV4uOpen_(props,opts){
 const storageId=String(props.getProperty(SMQ_USAGE_SPREADSHEET_ID_KEY_U1)||'').trim();
 const prod=String(props.getProperty(HOJA_V4U_PROD_PROP_)||'').trim();
 const cert=String(props.getProperty(HOJA_V4U_CERT_PROP_)||'').trim();
 if(!storageId||!prod||!cert)throw Error('HOJA_V4U_ISOLATION_IDS_NOT_CONFIGURED');
 if(storageId===prod||storageId===cert||prod===cert)
  throw Error('HOJA_V4U_PRODUCTION_ID_OR_CERTIFIED_COPY_REJECTED');
 for(const key of ['HOJA_PROD_RANKING_SPREADSHEET_ID'])
  if(String(props.getProperty(key)||'').trim()===storageId)
   throw Error('HOJA_V4U_PRODUCTION_ID_REJECTED');
 if(storageId===hojaProdPublicId_())throw Error('HOJA_V4U_PRODUCTION_ID_REJECTED');
 const tag=hojaV4uSha256_('W|'+storageId).slice(0,16);
 const ss=SpreadsheetApp.openById(storageId);
 // Writer only: the canary (+ EVENT_LOG header) verification of THIS storage id
 // is cached briefly; the key is bound to the storage id, so any property change
 // re-verifies. Readers and the seal always verify.
 const cache=opts&&opts.writer?CacheService.getScriptCache():null;
 const verified=cache?String(cache.get(HOJA_V4U_VERIFIED_CACHE_+tag)||''):'';
 if(!verified){
  const canary=ss.getSheetByName(HOJA_V4U_CANARY_TAB_);
  const marks=canary?canary.getRange(1,1,1,2).getDisplayValues()[0]:[];
  if(String(marks[0]||'').trim()!==HOJA_V4U_CANARY_A1_||
     String(marks[1]||'').trim()!==HOJA_V4U_CANARY_B1_)
   throw Error('HOJA_V4U_CANARY_REQUIRED');
  if(cache)cache.put(HOJA_V4U_VERIFIED_CACHE_+tag,'CANARY',HOJA_V4U_VERIFIED_SECONDS_);
 }
 const event=ss.getSheetByName(SMQ_USAGE_SHEET_U1);
 if(!event)throw Error('HOJA_V4U_EVENT_LOG_NOT_CONFIGURED');
 return {ss,props,storageId,event,tag,headerVerified:verified==='CANARY+HEADER'};
}
function hojaV4uReadWatermarkFull_(ctx){
 const raw=String(ctx.props.getProperty(HOJA_V4U_WATERMARK_PROP_)||'').trim();
 if(!raw)return null;
 let v;try{v=JSON.parse(raw);}catch(_e){throw Error('HOJA_V4U_WATERMARK_INVALID');}
 if(!v||v.tag!==ctx.tag||!Number.isSafeInteger(v.row)||v.row<1||
    (v.date!==undefined&&!/^\d{4}-\d{2}-\d{2}$/.test(String(v.date))))
  throw Error('HOJA_V4U_WATERMARK_INVALID');
 return v;
}
function hojaV4uReadWatermark_(ctx){
 const v=hojaV4uReadWatermarkFull_(ctx);
 return v?v.row:null;
}
/* `date` = KST date of the row at `row` (lets the writer skip one read). */
function hojaV4uWriteWatermark_(ctx,row,date){
 if(!Number.isSafeInteger(row)||row<1)throw Error('HOJA_V4U_WATERMARK_INVALID');
 const v={row,tag:ctx.tag};
 if(date&&/^\d{4}-\d{2}-\d{2}$/.test(String(date)))v.date=String(date);
 ctx.props.setProperty(HOJA_V4U_WATERMARK_PROP_,JSON.stringify(v));
}
function hojaV4uSealedInvalidate_(){
 try{CacheService.getScriptCache().remove(HOJA_V4U_SEALED_CACHE_);}catch(_e){}
}
/* Sealed state for the WRITER: only changes when the seal (same ScriptLock)
 * publishes a day, which invalidates this entry. */
function hojaV4uWriterSealedState_(ctx){
 const cache=CacheService.getScriptCache();
 const raw=cache.get(HOJA_V4U_SEALED_CACHE_);
 if(raw){
  try{const v=JSON.parse(raw);
   if(v&&v.tag===ctx.tag&&typeof v.lastDate==='string'&&Number.isSafeInteger(v.prefix)&&
      Number.isSafeInteger(v.windowStart))return Object.assign(v,{cached:true});
  }catch(_e){}
 }
 const st=hojaV4uManifestState_(ctx,false);
 const v={tag:ctx.tag,lastDate:st.lastDate,prefix:st.prefix,windowStart:st.windowStart};
 cache.put(HOJA_V4U_SEALED_CACHE_,JSON.stringify(v),21600);
 return Object.assign(v,{cached:false});
}
function hojaV4uTab_(ss,name,header,create){
 let sh=ss.getSheetByName(name);
 if(!sh){
  if(!create)throw Error('HOJA_V4U_TAB_MISSING_'+name);
  sh=ss.insertSheet(name);
  sh.getRange(1,1,1,header.length).setValues([header]);
 }
 const actual=sh.getRange(1,1,1,header.length).getDisplayValues()[0];
 if(header.some((h,i)=>actual[i]!==h))throw Error('HOJA_V4U_HEADER_MISMATCH_'+name);
 return sh;
}
function hojaV4uRows_(sh,width,limit,code){
 const n=sh.getLastRow()-1;
 if(n>limit)throw Error('HOJA_V4U_READ_LIMIT_'+code);
 return n>0?sh.getRange(2,1,n,width).getDisplayValues():[];
}
/* COMPLETE rows must form a contiguous leading run; only PREPARING may follow. */
function hojaV4uSealedState_(mrows){
 const complete=[],preparing=[];
 for(const r of mrows){
  if(r[2]==='COMPLETE'){
   if(preparing.length)throw Error('HOJA_V4U_MANIFEST_COMPLETE_AFTER_PREPARING');
   if(complete.length&&r[0]!==hojaV4uNextDay_(complete[complete.length-1][0]))
    throw Error('HOJA_V4U_MANIFEST_DATE_GAP');
   complete.push(r);
  }else if(r[2]==='PREPARING')preparing.push(r);
  else throw Error('HOJA_V4U_MANIFEST_STATUS_INVALID');
 }
 const last=complete[complete.length-1],prev=complete[complete.length-2];
 return {complete,preparing,lastDate:last?last[0]:'',
  prefix:last?Number(last[11]):1,
  windowStart:(prev?Number(prev[11]):1)+1};
}
function hojaV4uManifestState_(ctx,create){
 const m=hojaV4uTab_(ctx.ss,HOJA_V4U_MANIFEST_TAB_,HOJA_V4U_MANIFEST_HEADER_,create);
 const rows=hojaV4uRows_(m,HOJA_V4U_MANIFEST_HEADER_.length,
  HOJA_V4U_LIMITS_.manifestRows,'MANIFEST');
 return Object.assign(hojaV4uSealedState_(rows),{sheet:m,rows});
}
/* Rows after W that were appended but not committed (crash between append and
 * commit). Only complete, in-order, not-yet-sealed rows may be adopted. */
function hojaV4uRecoverWatermark_(ctx,sh,state,today){
 let W=hojaV4uReadWatermark_(ctx);
 const last=sh.getLastRow();
 const from=W===null?state.prefix:W;
 if(from<state.prefix)throw Error('HOJA_V4U_WATERMARK_BEHIND_SEALED_PREFIX');
 if(from>last)throw Error('HOJA_V4U_WATERMARK_AHEAD_OF_SOURCE_HOLD');
 if(last>from){
  if(last-from>HOJA_V4U_LIMITS_.tailRows)throw Error('HOJA_V4U_READ_LIMIT_TAIL');
  let floor=state.lastDate;
  if(from>state.prefix)floor=String(sh.getRange(from,3).getDisplayValue()||'').trim();
  const rows=sh.getRange(from+1,1,last-from,15).getDisplayValues();
  for(const row of rows){
   const d=String(row[2]||'').trim();
   if(!HOJA_USAGE_V4_PUBLIC.validTailRow(row)||d<floor||d>today||
      (state.lastDate&&d<=state.lastDate))
    throw Error('HOJA_V4U_UNCOMMITTED_TAIL_HOLD');
   floor=d;
  }
  hojaV4uWriteWatermark_(ctx,last,floor);W=last;
 }else if(W!==last){hojaV4uWriteWatermark_(ctx,last);W=last;}
 return W;
}
/* ------------------------------ writer ------------------------------ */
function hojaV4uWriterContext_(storageId){
 const props=PropertiesService.getScriptProperties();
 if(!hojaV4uEnabled_(props))return null;
 const ctx=hojaV4uOpen_(props,{writer:true});
 if(ctx.storageId!==storageId||ctx.ss.getId()!==storageId)
  throw Error('HOJA_V4U_WRITER_STORAGE_MISMATCH');
 const cache=CacheService.getScriptCache();
 const key='HOJA_V4U_W_'+Math.floor(Date.now()/60000);
 const n=Number(cache.get(key)||0);
 if(n>=HOJA_V4U_LIMITS_.writesPerMinute)throw Error('USAGE_RATE_LIMITED');
 cache.put(key,String(n+1),120);
 return ctx;
}
function hojaV4uMarkHeaderVerified_(ctx){
 try{CacheService.getScriptCache().put(HOJA_V4U_VERIFIED_CACHE_+ctx.tag,'CANARY+HEADER',
  HOJA_V4U_VERIFIED_SECONDS_);}catch(_e){}
}
/* Called INSIDE recordUsageStartU1's ScriptLock. Sealed-day / monotone-day /
 * eventId dedupe guard, append, flush, readback of exactly row W+1, then the
 * commit watermark. Spreadsheet calls in the lock (new event): getLastRow,
 * TextFinder, appendRow, flush, one 15-cell readback (+1 property write). */
function hojaV4uWriterAppend_(ctx,sh,usageRow){
 const schema=String(usageRow[13]);
 if(!Array.isArray(usageRow)||usageRow.length!==15||usageRow[4]!=='PUBLIC'||
    (schema!=='U3S1'&&schema!=='A1'))throw Error('HOJA_V4U_WRITER_SCHEMA');
 const today=String(usageRow[2]);
 const state=hojaV4uWriterSealedState_(ctx);
 if(state.lastDate&&today<=state.lastDate)throw Error('USAGE_V4_DAY_ALREADY_SEALED');
 const W=hojaV4uRecoverWatermark_(ctx,sh,state,today);
 if(W>1){
  const wm=hojaV4uReadWatermarkFull_(ctx);
  const prior=wm&&wm.row===W&&wm.date?wm.date:
   String(sh.getRange(W,3).getDisplayValue()||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(prior)||prior>today)
   throw Error('USAGE_V4_NON_MONOTONE_DAY');
 }
 const start=state.windowStart;
 if(W-start+1>HOJA_V4U_LIMITS_.dedupeWindowRows)throw Error('HOJA_V4U_DEDUPE_WINDOW_TOO_LARGE');
 const hits=W>=start?sh.getRange(start,1,W-start+1,1)
  .createTextFinder(String(usageRow[0])).matchEntireCell(true).findAll():[];
 if(hits.length>HOJA_V4U_LIMITS_.replayHits)throw Error('USAGE_V4_REPLAY_STORM');
 const sig=row=>JSON.stringify(row.map((x,i)=>i===1||i===2?null:
  String(x==null?'':x).trim()));
 const expected=sig(usageRow.map(x=>x instanceof Date?'':x));
 let originalDate='';
 for(const hit of hits){
  const old=sh.getRange(hit.getRow(),1,1,15).getDisplayValues()[0];
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(old[2]||''))||String(old[2])>today||
     sig(old)!==expected)throw Error('USAGE_EVENT_ID_CONFLICT');
  originalDate=originalDate||String(old[2]);
 }
 const base={ok:true,repositoryKind:'PUBLIC',cartridgeCount:Number(usageRow[9]),
  usageSchemaVersion:schema};
 // Same eventId already committed (e.g. the success reply was lost and the
 // client retried): idempotent, no new row.
 if(hits.length)return Object.assign(base,{duplicateIgnored:true,originalDate});
 sh.appendRow(usageRow);
 SpreadsheetApp.flush();
 const back=sh.getRange(W+1,1,1,15).getDisplayValues()[0];
 if(String(back[0]).trim()!==String(usageRow[0])||String(back[2]).trim()!==today||
    !HOJA_USAGE_V4_PUBLIC.validTailRow(back))
  throw Error('HOJA_V4U_COMMIT_READBACK_MISMATCH');
 hojaV4uWriteWatermark_(ctx,W+1,today);
 return base;
}
/* ------------------------------ daily seal ------------------------------ */
function hojaV4uRequireOperator_(){
 const active=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
 const owner=String(Session.getEffectiveUser().getEmail()||'').trim().toLowerCase();
 if(!active||!owner||active!==owner)throw Error('HOJA_V4_OPS_DENIED');
}
function hojaV4OpsSealPendingDays(){
 hojaV4uRequireOperator_();
 return hojaV4uSealPendingDays_(HOJA_V4U_LIMITS_.sealDaysPerRun);
}
function hojaV4OpsStatus(){
 hojaV4uRequireOperator_();
 const props=PropertiesService.getScriptProperties();
 if(!hojaV4uEnabled_(props))return {enabled:false};
 const ctx=hojaV4uOpen_(props),state=hojaV4uManifestState_(ctx,false);
 return {enabled:true,sealedThrough:state.lastDate,sealedPrefixEndRow:state.prefix,
  preparingRows:state.preparing.length,committedWatermark:hojaV4uReadWatermark_(ctx),
  sourceLastRow:ctx.event.getLastRow(),today:hojaV4uKstDay_(new Date()),
  autoSeal:{enabled:hojaV4uAutoSealEnabled_(props),last:hojaV4uAutoSealState_(props)}};
}
/* ------------------------- daily auto-seal (40-6AI-2) -------------------------
 * DISABLED by default and NEVER installed by code (no trigger-creating API call in any file). Intended target of ONE
 * installable time-driven trigger created by the owner in the isolated test project only, after the teacher's
 * approval and the read-only audit of the copy: everyDays(1).atHour(0).nearMinute(20) (KST project time zone),
 * optionally a second hourly trigger as retry. Each run seals ONLY finished days (< today KST) through the same
 * hojaV4uSealPendingDays_ path as the manual operator call (idempotent, raced-safe, PREPARING resume, HOLD on late
 * or partial rows). Its result is kept in HOJA_V4_AUTO_SEAL_STATE; a failure or HOLD is recorded and RE-THROWN so
 * Apps Script's trigger-failure e-mail makes it visible. Unsealed past days >= 3 => staleRisk (the public reader
 * fails closed with SEAL_STALE beyond 3). Manual sealing stays available and coexists. */
const HOJA_V4U_AUTO_SEAL_PROP_='HOJA_V4_AUTO_SEAL';
const HOJA_V4U_AUTO_SEAL_VALUE_='ENABLED_ISOLATED_COPY_ONLY';
const HOJA_V4U_AUTO_SEAL_STATE_PROP_='HOJA_V4_AUTO_SEAL_STATE';
function hojaV4uAutoSealEnabled_(props){
 return String(props.getProperty(HOJA_V4U_AUTO_SEAL_PROP_)||'').trim()===HOJA_V4U_AUTO_SEAL_VALUE_;
}
function hojaV4uAutoSealState_(props){
 try{return JSON.parse(props.getProperty(HOJA_V4U_AUTO_SEAL_STATE_PROP_)||'null')}catch(_e){return null}
}
function hojaV4OpsAutoSealDaily(){
 hojaV4uRequireOperator_();
 return hojaV4uAutoSeal_(new Date());
}
function hojaV4uPendingPastDays_(lastDate,today){
 if(!lastDate)return null;
 let n=0;for(let d=hojaV4uNextDay_(lastDate);d<today&&n<400;d=hojaV4uNextDay_(d))n++;
 return n;
}
function hojaV4uAutoSeal_(now){
 const props=PropertiesService.getScriptProperties();
 if(!hojaV4uAutoSealEnabled_(props))return {ok:true,skipped:'AUTO_SEAL_DISABLED'};   // no read, no write
 if(!hojaV4uEnabled_(props))return {ok:true,skipped:'V4_NOT_CONFIGURED'};
 const today=hojaV4uKstDay_(now),prev=hojaV4uAutoSealState_(props);
 let res,failure=null;
 try{
  const r=hojaV4uSealPendingDays_(HOJA_V4U_LIMITS_.sealDaysPerRun);
  const st=hojaV4uManifestState_(hojaV4uOpen_(props),false);
  const pending=hojaV4uPendingPastDays_(st.lastDate,today);
  res={ok:true,today,sealed:r.sealed.filter(x=>!x.raced).map(x=>x.date),raced:r.sealed.some(x=>x.raced),
   sealedThrough:st.lastDate,pendingPastDays:pending,staleRisk:pending>=3,consecutiveFailures:0};
 }catch(e){
  const msg=String(e&&e.message||e);
  const code=(msg.match(/HOJA_V4U?_[A-Z0-9_]+|USAGE_[A-Z0-9_]+/)||['AUTO_SEAL_ERROR'])[0];
  let pending=null;try{pending=hojaV4uPendingPastDays_(hojaV4uManifestState_(hojaV4uOpen_(props),false).lastDate,today)}catch(_e){}
  res={ok:false,today,error:code,hold:/HOLD|MANUAL_REVIEW|LATE_EVENT|PARTIAL|UNSORTED|PARITY|MISMATCH/.test(code),
   pendingPastDays:pending,staleRisk:pending===null||pending>=3,
   consecutiveFailures:(prev&&prev.ok===false?Number(prev.consecutiveFailures)||0:0)+1};
  failure=code;
 }
 res.at=now.toISOString();
 props.setProperty(HOJA_V4U_AUTO_SEAL_STATE_PROP_,JSON.stringify(res));
 if(failure)throw Error('HOJA_V4_AUTO_SEAL_FAILED '+failure+(res.hold?' (HOLD: manual review)':''));
 return res;
}
function hojaV4uSealPendingDays_(maxDays){
 const props=PropertiesService.getScriptProperties();
 if(!hojaV4uEnabled_(props))throw Error('HOJA_V4U_NOT_CONFIGURED');
 const ctx=hojaV4uOpen_(props),sealed=[];
 for(let i=0;i<maxDays;i++){
  const r=hojaV4uSealNextDay_(ctx);
  if(!r)break;
  sealed.push(r);
 }
 return {ok:true,sealed,rawDeletion:'HOLD',triggerInstalled:false};
}
function hojaV4uBucketRows_(date,gen,buckets){
 return buckets.map(b=>[date,gen,b.dimension,b.key,b.displayLabel,String(b.count)]);
}
function hojaV4uSealNextDay_(ctx){
 const sh=ctx.event,lock=LockService.getScriptLock();
 let today,state,W;
 if(!lock.tryLock(10000))throw Error('HOJA_V4U_SEAL_LOCK_TIMEOUT');
 try{
  // Cut point: every row of a day < today was committed before this lock.
  today=hojaV4uKstDay_(new Date());
  state=hojaV4uManifestState_(ctx,false);
  W=hojaV4uRecoverWatermark_(ctx,sh,state,today);
 }finally{lock.releaseLock();}
 if(!state.lastDate)throw Error('HOJA_V4U_SEAL_REQUIRES_CERTIFIED_HISTORY');
 const target=hojaV4uNextDay_(state.lastDate);
 if(target>=today)return null;
 const prefix=state.prefix;
 if(W-prefix>HOJA_V4U_LIMITS_.tailRows)throw Error('HOJA_V4U_READ_LIMIT_TAIL');
 const rows=W>prefix?sh.getRange(prefix+1,1,W-prefix,15).getDisplayValues():[];
 let lastDay='';
 for(const row of rows){
  const d=String(row[2]||'').trim();
  if(!HOJA_USAGE_V4_PUBLIC.validTailRow(row))throw Error('HOJA_V4U_SEAL_PARTIAL_ROW');
  if(d<target)throw Error('HOJA_V4U_SEAL_LATE_EVENT');
  if(d<lastDay)throw Error('HOJA_V4U_SEAL_UNSORTED');
  lastDay=d;
 }
 let count=0;
 while(count<rows.length&&String(rows[count][2]).trim()===target)count++;
 const dayRows=rows.slice(0,count);
 const snap=HOJA_USAGE_V4_CORE.snapshot(target,dayRows,{coverageVerified:true});
 if(snap.sourceRows!==count||snap.starts+snap.retriesSuppressed!==count)
  throw Error('HOJA_V4U_SEAL_COUNT_PARITY');
 const gen=hojaV4uSha256_(snap.canonicalSource);
 const bucketDigest=hojaV4uSha256_(JSON.stringify(snap.buckets));
 const expected=hojaV4uBucketRows_(target,gen,snap.buckets);
 const newPrefix=prefix+count;
 if(!lock.tryLock(10000))throw Error('HOJA_V4U_SEAL_LOCK_TIMEOUT');
 try{
  const now=hojaV4uManifestState_(ctx,false);
  if(now.lastDate!==state.lastDate||now.prefix!==prefix)
   return {date:target,raced:true};
  const b=hojaV4uTab_(ctx.ss,HOJA_V4U_BUCKET_TAB_,HOJA_V4U_BUCKET_HEADER_,false);
  const storedFor=()=>hojaV4uRows_(b,HOJA_V4U_BUCKET_HEADER_.length,
   HOJA_V4U_LIMITS_.bucketRows,'BUCKETS').filter(r=>r[0]===target);
  const m=now.sheet;
  const pending=now.preparing.filter(r=>r[0]===target);
  let mRow;
  if(pending.length){
   // Resume only an identical interrupted generation; anything else is manual.
   if(pending.length!==1||pending[0][1]!==gen||pending[0][12]!==bucketDigest||
      Number(pending[0][11])!==newPrefix||Number(pending[0][5])!==count||
      now.preparing.length!==1)
    throw Error('HOJA_V4U_SEAL_EXISTING_GENERATION_MANUAL_REVIEW');
   mRow=now.rows.indexOf(pending[0])+2;
   const have=storedFor();
   if(have.length===0&&expected.length){
    const start=b.getLastRow()+1;
    b.getRange(start,1,expected.length,6).setNumberFormat('@');
    b.getRange(start,1,expected.length,6).setValues(expected);
    SpreadsheetApp.flush();
   }else if(JSON.stringify(have)!==JSON.stringify(expected))
    throw Error('HOJA_V4U_SEAL_PARTIAL_BUCKETS_MANUAL_REVIEW');
  }else{
   if(now.preparing.length)throw Error('HOJA_V4U_SEAL_OTHER_PREPARING_MANUAL_REVIEW');
   if(storedFor().length)throw Error('HOJA_V4U_SEAL_ORPHAN_BUCKETS_MANUAL_REVIEW');
   hojaV4uSealedInvalidate_();
   mRow=m.getLastRow()+1;
   const created=new Date().toISOString();
   const mr=[target,gen,'PREPARING',count?prefix+1:0,count?newPrefix:0,count,
    snap.starts,gen,expected.length,created,'',newPrefix,bucketDigest,
    snap.retriesSuppressed];
   m.getRange(mRow,1,1,mr.length).setNumberFormat('@');
   m.getRange(mRow,1,1,mr.length).setValues([mr.map(String)]);
   SpreadsheetApp.flush();
   if(expected.length){
    const start=b.getLastRow()+1;
    b.getRange(start,1,expected.length,6).setNumberFormat('@');
    b.getRange(start,1,expected.length,6).setValues(expected);
    SpreadsheetApp.flush();
   }
  }
  const back=storedFor();
  if(JSON.stringify(back)!==JSON.stringify(expected))
   throw Error('HOJA_V4U_SEAL_READBACK_MISMATCH');
  const canonical=back.map(r=>({dimension:r[2],key:r[3],count:Number(r[5]),displayLabel:r[4]}));
  if(hojaV4uSha256_(JSON.stringify(canonical))!==bucketDigest)
   throw Error('HOJA_V4U_SEAL_BUCKET_DIGEST_MISMATCH');
  m.getRange(mRow,11).setValue(new Date().toISOString());SpreadsheetApp.flush();
  m.getRange(mRow,3).setValue('COMPLETE');SpreadsheetApp.flush();
  hojaV4uSealedInvalidate_();
  if(m.getRange(mRow,3).getDisplayValue()!=='COMPLETE')
   throw Error('HOJA_V4U_SEAL_PUBLISH_FAILED');
  return {date:target,starts:snap.starts,retriesSuppressed:snap.retriesSuppressed,
   sourceRowCount:count,buckets:expected.length,zeroDay:count===0};
 }finally{lock.releaseLock();}
}
/* ------------------------------ public reader ------------------------------ */
function hojaV4uHistoryStart_(ctx){
 const a=ctx.ss.getSheetByName(HOJA_V4U_AUDIT_TAB_);
 if(!a||a.getLastRow()!==2)throw Error('HOJA_V4U_AUDIT_REQUIRED');
 const rows=a.getRange(1,1,2,10).getDisplayValues();
 if(HOJA_V4U_AUDIT_HEADER_.some((h,i)=>rows[0][i]!==h))throw Error('HOJA_V4U_AUDIT_SCHEMA');
 if(!HOJA_V4U_AUDIT_SCOPES_.includes(rows[1][0])||!/^\d{4}-\d{2}-\d{2}$/.test(rows[1][1]))
  throw Error('HOJA_V4U_AUDIT_UNVERIFIED_HISTORY');
 return rows[1][1];
}
function hojaV4uApprovedEraStart_(props){
 const v=String(props.getProperty(HOJA_USAGE_ERA_PROP_)||'').trim();
 if(v&&!/^\d{4}-\d{2}-\d{2}$/.test(v))throw Error('HOJA_V4U_ERA_NOT_CONFIGURED');
 return v;
}
function hojaV4uComputePublic_(now){
 const props=PropertiesService.getScriptProperties();
 if(!hojaV4uEnabled_(props))throw Error('HOJA_V4U_NOT_CONFIGURED');
 const ctx=hojaV4uOpen_(props),today=hojaV4uKstDay_(now);
 for(let attempt=0;attempt<2;attempt++){
  const historyStart=hojaV4uHistoryStart_(ctx);
  // (1) summaries first ...
  const state=hojaV4uManifestState_(ctx,false);
  const mLast=state.sheet.getLastRow();
  const b=hojaV4uTab_(ctx.ss,HOJA_V4U_BUCKET_TAB_,HOJA_V4U_BUCKET_HEADER_,false);
  const brows=hojaV4uRows_(b,HOJA_V4U_BUCKET_HEADER_.length,HOJA_V4U_LIMITS_.bucketRows,'BUCKETS');
  // (2) ... then the monotone commit watermark, (3) then only committed tail rows.
  const W=hojaV4uReadWatermark_(ctx);
  if(W===null)throw Error('HOJA_V4U_WATERMARK_NOT_INITIALIZED');
  const prefix=state.prefix;
  if(W<prefix)throw Error('HOJA_V4U_WATERMARK_BEHIND_SEALED_PREFIX');
  if(W-prefix>HOJA_V4U_LIMITS_.tailRows)throw Error('HOJA_V4U_READ_LIMIT_TAIL');
  const tail=W>prefix?ctx.event.getRange(prefix+1,1,W-prefix,15).getDisplayValues():[];
  // (4) the seal may have flipped a day meanwhile: re-check and retry once.
  const again=state.sheet.getLastRow()===mLast&&
   hojaV4uSealedState_(hojaV4uRows_(state.sheet,HOJA_V4U_MANIFEST_HEADER_.length,
    HOJA_V4U_LIMITS_.manifestRows,'MANIFEST')).lastDate===state.lastDate&&
   b.getLastRow()-1===brows.length;
  if(!again)continue;
  if(state.complete.length&&state.complete[0][0]!==historyStart)
   throw Error('HOJA_V4U_HISTORY_START_MISMATCH');
  const sealedGen=new Map(state.complete.map(r=>[r[0],r[1]]));
  const preparingGen=new Set(state.preparing.map(r=>r[0]+'|'+r[1]));
  const perDay=new Map();
  for(const r of brows){
   if(sealedGen.get(r[0])===r[1]){
    if(!perDay.has(r[0]))perDay.set(r[0],[]);
    perDay.get(r[0]).push({dimension:r[2],key:r[3],count:Number(r[5]),displayLabel:r[4]});
   }else if(!preparingGen.has(r[0]+'|'+r[1]))
    throw Error('HOJA_V4U_UNEXPECTED_BUCKET_ROW');
  }
  let prev=1;
  const past=state.complete.map(r=>{
   const buckets=perDay.get(r[0])||[];
   if(r[1]!==r[7]||buckets.length!==Number(r[8]))
    throw Error('HOJA_V4U_BUCKET_GENERATION_MISMATCH');
   const s={schema:HOJA_USAGE_V4_CORE.SCHEMA,date:r[0],status:r[2],verified:!!r[10],
    starts:Number(r[6]),sourceDigest:r[7],bucketDigest:r[12],
    sourceStartRow:Number(r[3]),sourceEndRow:Number(r[4]),sourceRowCount:Number(r[5]),
    sourcePrefixEndRow:Number(r[11]),retriesSuppressed:Number(r[13]),buckets};
   prev=s.sourcePrefixEndRow;return s;
  });
  return HOJA_USAGE_V4_PUBLIC.project(HOJA_USAGE_V4_CORE,past,tail,{
   asOf:today,historyStart,initialHistoryAudited:true,initialPrefixEndRow:1,
   certifiedPrefixEndRow:prefix,committedWatermark:W,hashBuckets:hojaV4uSha256_,
   approvedEraStart:hojaV4uApprovedEraStart_(props)});
 }
 throw Error('HOJA_V4U_CHANGED_DURING_READ');
}
function hojaV4uWithAge_(json,now,stale){
 const v=JSON.parse(json);
 const age=Math.max(0,Math.floor((now.getTime()-Date.parse(v.generatedAt))/1000));
 v.cache={ageSeconds:age,maxAgeSeconds:stale?HOJA_V4U_LIMITS_.staleSeconds:
  HOJA_V4U_LIMITS_.freshSeconds,stale:stale===true};
 return v;
}
/* PUBLIC, anonymous, read-only. Takes no arguments (any are ignored). */
function getPublicUsageStatisticsV4(){
 const now=new Date(),generatedAt=now.toISOString();
 try{
  const cache=CacheService.getScriptCache();
  const fresh=cache.get(HOJA_V4U_CACHE_FRESH_);
  if(fresh)return hojaV4uWithAge_(fresh,now,false);
  const key='HOJA_V4U_RC_'+Math.floor(now.getTime()/60000);
  const n=Number(cache.get(key)||0);
  if(n>=HOJA_V4U_LIMITS_.recomputesPerMinute){
   const good=cache.get(HOJA_V4U_CACHE_GOOD_);
   if(good)return hojaV4uWithAge_(good,now,true);
   throw Error('HOJA_V4U_RATE_LIMIT');
  }
  cache.put(key,String(n+1),120);
  const view=HOJA_USAGE_V4_PUBLIC.publicView(hojaV4uComputePublic_(now),
   {generatedAt,ageSeconds:0,maxAgeSeconds:HOJA_V4U_LIMITS_.freshSeconds,
    approvedTitles:new Map(hojaApprovedActive_().entries.map(e=>[e.cartridgeId,e.title]))});
  const json=JSON.stringify(view);
  cache.put(HOJA_V4U_CACHE_FRESH_,json,HOJA_V4U_LIMITS_.freshSeconds);
  cache.put(HOJA_V4U_CACHE_GOOD_,json,HOJA_V4U_LIMITS_.staleSeconds);
  return view;
 }catch(err){
  console.error('HOJA_V4_PUBLIC_STATS',String(err&&err.message||err));
  return HOJA_USAGE_V4_PUBLIC.unavailable(err,generatedAt);
 }
}
