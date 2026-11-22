/* HOJA V4 rebuild — ISOLATED, COPIED-SPREADSHEET Apps Script only.
 * Requires HOJA_USAGE_V4_CORE.js included in a SEPARATE test project.
 * Never deploy this file into Project A or B production.
 * No raw deletion, scheduled jobs, ranking/student information or RPC wiring.
 * This trial implementation ALWAYS reads only a separate, canary-marked copy.
 */
const HOJA_V4_MANIFEST_HEADER=['date','generation','status','sourceStartRow',
 'sourceEndRow','sourceRowCount','publicStarts','contentDigest','bucketCount',
 'createdAt','verifiedAt','sourcePrefixEndRow','bucketDigest'];
const HOJA_V4_BUCKET_HEADER=['date','generation','dimension','dimensionKey',
 'displayLabel','count'];
function hojaV4Sha256_(payload){
 return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
  String(payload),Utilities.Charset.UTF_8)
  .map(x=>(x<0?x+256:x).toString(16).padStart(2,'0')).join('');
}
function hojaV4KstDay_(value){
 return Utilities.formatDate(value,'Asia/Seoul','yyyy-MM-dd');
}
function hojaV4TrialStorage_(){
 const p=PropertiesService.getScriptProperties();
 const trial=String(p.getProperty('HOJA_USAGE_TRIAL_SPREADSHEET_ID')||'').trim();
 const prod=String(p.getProperty('HOJA_USAGE_PRODUCTION_SPREADSHEET_ID')||'').trim();
 if(!trial||!prod||trial===prod)throw Error('HOJA_V4_TRIAL_PRODUCTION_ISOLATION_REQUIRED');
 for(const key of ['SMQ_USAGE_SPREADSHEET_ID','HOJA_PROD_RANKING_SPREADSHEET_ID',
  'HOJA_PROD_PUBLIC_SPREADSHEET_ID']){
  const id=String(p.getProperty(key)||'').trim();
  if(id&&trial===id)throw Error('HOJA_V4_TRIAL_PRODUCTION_ID_REJECTED');
 }
 const ss=SpreadsheetApp.openById(trial);
 const canary=ss.getSheetByName('_HOJA_USAGE_TRIAL_ONLY');
 if(!canary||canary.getRange(1,1).getDisplayValues()[0][0]!=='HOJA_RETENTION_SANDBOX_V1')
  throw Error('HOJA_V4_TRIAL_CANARY_REQUIRED');
 return {ss,p};
}
function hojaV4ScanDateIndexTrial_(sh,requestedDay){
 const last=sh.getLastRow();
 const dates=[],minKey={date:null,row:0},maxKey={date:null,row:0};
 let prev=null,first=0,end=0,starts=0,headPublic='',prefixEnd=1;
 for(let start=2;start<=last;start+=500){
  const n=Math.min(500,last-start+1);
  // Only columns C:E (date, mode, kind), not raw event details.
  const chunk=sh.getRange(start,3,n,3).getDisplayValues();
  for(let i=0;i<n;i++){
   const rowNumber=start+i;
   const day=String(chunk[i][0]||'').trim();
   if(!/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw Error('HOJA_V4_TRIAL_BAD_DATE_ROW_'+rowNumber);
   if(prev&&day<prev)
    throw Error('HOJA_V4_TRIAL_UNSORTED_SOURCE_DATE_ROW_'+rowNumber);
   prev=day;
   if(!headPublic&&String(chunk[i][2]||'').trim().toUpperCase()==='PUBLIC')
    headPublic=day;
   if(day<=requestedDay)prefixEnd=rowNumber;
   if(day===requestedDay){
    if(!first)first=rowNumber;
    end=rowNumber;starts++;
   }else if(first&&day>requestedDay){
    // Still scan the entire date column to detect appended out-of-order rows.
   }
  }
 }
 return {first,end,rawRows:starts,sourcePrefixEndRow:prefixEnd,sourceLastRow:last,
  earliestPublicDay:headPublic,sourceLatestDay:prev||''};
}
function hojaV4PreviewDailyTrialU1(day){
 const date=String(day||'').trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('HOJA_V4_TRIAL_DATE_REQUIRED');
 const {ss}=hojaV4TrialStorage_();
 const sh=ss.getSheetByName('EVENT_LOG');
 if(!sh)throw Error('HOJA_V4_TRIAL_SOURCE_MISSING');
 const header=sh.getRange(1,1,1,15).getDisplayValues()[0];
 const expected=HOJA_USAGE_V4_CORE.HEADER;
 if(expected.some((x,i)=>header[i]!==x&&!(i===10&&header[i]==='')))
  throw Error('HOJA_V4_TRIAL_SOURCE_HEADER_MISMATCH');
 const scanned=hojaV4ScanDateIndexTrial_(sh,date);
 if(!scanned.earliestPublicDay)
  throw Error('HOJA_V4_TRIAL_NO_PUBLIC_HISTORY');
 if(scanned.earliestPublicDay&&date<scanned.earliestPublicDay)
  throw Error('HOJA_V4_TRIAL_BEFORE_PUBLIC_HISTORY_START');
 if(scanned.rawRows>25000)throw Error('HOJA_V4_TRIAL_DAY_TOO_LARGE');
 const rows=scanned.rawRows?
  sh.getRange(scanned.first,1,scanned.rawRows,15).getDisplayValues():[];
 const snapshot=HOJA_USAGE_V4_CORE.snapshot(date,rows,{coverageVerified:true});
 const hex=hojaV4Sha256_(snapshot.canonicalSource);
 const bucketDigest=hojaV4Sha256_(JSON.stringify(snapshot.buckets));
 if(sh.getLastRow()!==scanned.sourceLastRow)
  throw Error('HOJA_V4_TRIAL_SOURCE_CHANGED_DURING_SCAN');
 return {ok:true,source:'ISOLATED_COPY_ONLY',date,sourceDigest:hex,
  bucketDigest,
  sourceStartRow:scanned.first,sourceEndRow:scanned.end,
  sourcePrefixEndRow:scanned.sourcePrefixEndRow,
  sourceRowCount:scanned.rawRows,publicStarts:snapshot.starts,
  earliestPublicDay:scanned.earliestPublicDay,sourceLatestDay:scanned.sourceLatestDay,
  sourceLastRow:scanned.sourceLastRow,buckets:snapshot.buckets,
  unknownUnitStarts:snapshot.unknownUnitStarts};
}
function hojaV4TrialTab_(ss,name,header){
 let sh=ss.getSheetByName(name);
 if(!sh)sh=ss.insertSheet(name);
 if(sh.getLastRow()<1)sh.getRange(1,1,1,header.length).setValues([header]);
 const actual=sh.getRange(1,1,1,header.length).getDisplayValues()[0];
 if(header.some((v,i)=>v!==actual[i]))throw Error('HOJA_V4_TRIAL_HEADER_'+name);
 return sh;
}
function hojaV4TrialStoredRows_(sh,width){
 const n=sh.getLastRow()-1;
 return n>0?sh.getRange(2,1,n,width).getDisplayValues():[];
}
function hojaV4TrialBucketRows_(preview){
 return preview.buckets.map(b=>[preview.date,preview.sourceDigest,b.dimension,
  b.key,b.displayLabel,String(b.count)]);
}
function hojaV4WriteDailyTrialU1(day){
 const {ss,p}=hojaV4TrialStorage_();
 if(p.getProperty('HOJA_USAGE_V4_TRIAL_WRITE_ACK')!=='COPIED_SHEET_ONLY')
  throw Error('HOJA_V4_TRIAL_MANUAL_WRITE_ACK_REQUIRED');
 const date=String(day||'').trim();
 if(date>=hojaV4KstDay_(new Date()))
  throw Error('HOJA_V4_TRIAL_TODAY_IS_MUTABLE');
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(10000))throw Error('HOJA_V4_TRIAL_LOCK_FAILED');
 try{
  const pvw=hojaV4PreviewDailyTrialU1(date),gen=pvw.sourceDigest;
  const m=hojaV4TrialTab_(ss,'HOJA_V4_DAILY_MANIFEST',HOJA_V4_MANIFEST_HEADER);
  const b=hojaV4TrialTab_(ss,'HOJA_V4_DAILY_BUCKETS',HOJA_V4_BUCKET_HEADER);
  const expected=hojaV4TrialBucketRows_(pvw);
  const existing=hojaV4TrialStoredRows_(m,HOJA_V4_MANIFEST_HEADER.length)
   .filter(row=>row[0]===date);
  if(existing.length){
   if(existing.length!==1||existing[0][1]!==gen||existing[0][2]!=='COMPLETE')
    throw Error('HOJA_V4_TRIAL_EXISTING_GENERATION_MANUAL_REVIEW');
   const stored=hojaV4TrialStoredRows_(b,HOJA_V4_BUCKET_HEADER.length)
    .filter(row=>row[0]===date&&row[1]===gen);
   if(JSON.stringify(stored)!==JSON.stringify(expected))
    throw Error('HOJA_V4_TRIAL_REPLAY_BUCKET_MISMATCH');
   if(existing[0][12]!==pvw.bucketDigest||
     Number(existing[0][3])!==pvw.sourceStartRow||
     Number(existing[0][4])!==pvw.sourceEndRow||
     Number(existing[0][5])!==pvw.sourceRowCount||
     Number(existing[0][11])!==pvw.sourcePrefixEndRow||
     Number(existing[0][6])!==pvw.publicStarts||
     Number(existing[0][8])!==expected.length)
    throw Error('HOJA_V4_TRIAL_REPLAY_MANIFEST_MISMATCH');
   return {ok:true,replayed:true,date,starts:pvw.publicStarts,
    buckets:expected.length};
  }
  const now=new Date();
  const row=m.getLastRow()+1;
  const mr=[date,gen,'PREPARING',pvw.sourceStartRow,pvw.sourceEndRow,
   pvw.sourceRowCount,pvw.publicStarts,gen,expected.length,now,'',
   pvw.sourcePrefixEndRow,pvw.bucketDigest];
  m.getRange(row,1,1,mr.length).setValues([mr]);SpreadsheetApp.flush();
  if(expected.length){
   const start=b.getLastRow()+1;
   b.getRange(start,1,expected.length,expected[0].length).setNumberFormat('@');
   b.getRange(start,1,expected.length,expected[0].length).setValues(expected);
   SpreadsheetApp.flush();
  }
  const check=hojaV4TrialStoredRows_(b,HOJA_V4_BUCKET_HEADER.length)
   .filter(r=>r[0]===date&&r[1]===gen);
  if(JSON.stringify(check)!==JSON.stringify(expected))
   throw Error('HOJA_V4_TRIAL_READBACK_MISMATCH');
  const readbackCanonical=check.map(r=>({dimension:r[2],key:r[3],
   count:Number(r[5]),displayLabel:r[4]}));
  if(hojaV4Sha256_(JSON.stringify(readbackCanonical))!==pvw.bucketDigest)
   throw Error('HOJA_V4_TRIAL_BUCKET_DIGEST_MISMATCH');
  if(pvw.sourceRowCount<pvw.publicStarts||pvw.buckets.length!==expected.length)
   throw Error('HOJA_V4_TRIAL_COUNT_MISMATCH');
  m.getRange(row,11).setValue(new Date());SpreadsheetApp.flush();
  m.getRange(row,3).setValue('COMPLETE');SpreadsheetApp.flush();
  if(m.getRange(row,3).getValue()!=='COMPLETE')
   throw Error('HOJA_V4_TRIAL_PUBLISH_FAILED');
  return {ok:true,replayed:false,date,starts:pvw.publicStarts,
   buckets:expected.length,source:'ISOLATED_COPY_ONLY'};
 }finally{
  lock.releaseLock();
 }
}
