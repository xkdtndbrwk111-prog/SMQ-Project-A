/** HOJA QUIZ 2.0 - PRODUCTION CANDIDATE (NOT DEPLOYED).
 * Public Project B catalog read-only. Ranking lives in its own production spreadsheet.
 * Existing U3S1 EVENT_LOG remains the source of truth for usage.
 * This file REPLACES the old Mario Code.gs after review, not before.
 */
/* Project B PUBLIC source is fixed to the same proven spreadsheet as HOJA TEST.
 * Deliberately no Script Properties dependency for cartridge listing.
 * Project B remains read-only: hojaApiGet_ only uses GET.
 */
const HOJA_PROD_PUBLIC_SPREADSHEET_ID_ = '1t9uQP-0qyPJ33bBPcJvn6T9bLmfidiDhJOlWjUJGfN4';
function hojaProdPublicId_() {
  return HOJA_PROD_PUBLIC_SPREADSHEET_ID_;
}
const HOJA_CATALOG_TAB_ = '_SMQ_PUBLIC_CATALOG';
const HOJA_CATALOG_HEADERS_ = [
  'recordType','schemaVersion','repository','incarnationId','generation',
  'completeMarker','entryCount','sheetId','questionCount','rowCount','bundleCount','sheetSchema'
];
const HOJA_V1_HEADERS_ = ['유형','문제','정답','보기1','보기2','보기3','보기4'];
const HOJA_SHEETS_API_ = 'https://sheets.googleapis.com/v4/spreadsheets/';
const HOJA_V2_HEADERS_ = ['묶음ID','유형','문제','정답','보기1','보기2','보기3','보기4'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Game')
    .setTitle('HOJA QUIZ 2.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}



function hojaApiGet_(path) {
  const url = HOJA_SHEETS_API_ + encodeURIComponent(hojaProdPublicId_()) + path;
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    muteHttpExceptions: true,
    followRedirects: false
  });
  if (response.getResponseCode() !== 200) {
    let reason = 'UNKNOWN';
    try {
      const err = JSON.parse(response.getContentText()).error;
      reason = (err.details || []).find(d => d.reason)?.reason
        || err.errors?.[0]?.reason
        || err.status
        || reason;
    } catch (_) {}

    throw new Error(
      'SHEETS_HTTP_' + response.getResponseCode() + '_' + reason
    );
  }
  try { return JSON.parse(response.getContentText()); }
  catch (_) { throw new Error('PROJECT_B_RESPONSE_INVALID'); }
}

function hojaPublicName_(name) {
  const n=String(name||'').trim();
  return !!n && n.length<=180 && !/^_SMQ_/i.test(n) &&
    !/^🔒/.test(n) && !['모둠점수','ASSET','ASSETS','SETTINGS','CONFIG','SOLO_RANKING','의견'].includes(n.toUpperCase());
}

function hojaCatalogRead_() {
  // Read a bounded registry; entries beyond this limit fail closed.
  const range="'"+HOJA_CATALOG_TAB_+"'!A1:L1000";
  const doc=hojaApiGet_('/values/'+encodeURIComponent(range)+'?valueRenderOption=FORMATTED_VALUE');
  const rows=doc?.values;
  if(!Array.isArray(rows)||rows.length<3||rows.length>1000)
    throw new Error('PROJECT_B_CATALOG_INVALID');
  if(!HOJA_CATALOG_HEADERS_.every((h,i)=>String(rows[0]?.[i]??'').trim()===h))
    throw new Error('PROJECT_B_CATALOG_SCHEMA_INVALID');
  const meta=rows[1];
  const count=Number(meta?.[6]);
  if(meta?.[0]!=='META'||meta[1]!=='1'||meta[2]!=='PUBLIC'||
    !/^[a-f0-9]{16,64}$/i.test(String(meta[3]||''))||
    !/^\d+$/.test(String(meta[4]||''))||meta[5]!=='COMPLETE'||
    !Number.isInteger(count)||count<1||count>998||rows.length!==count+2)
    throw new Error('PROJECT_B_CATALOG_INCOMPLETE');
  const ids=new Set(),entries=[];
  for(const r of rows.slice(2)){
    const id=String(r?.[7]??'');
    const questionCount=Number(r?.[8]),rowCount=Number(r?.[9]),bundleCount=Number(r?.[10]);
    if(r?.[0]!=='ENTRY'||r?.[1]!=='1'||r?.[2]!=='PUBLIC'||
      r?.[3]!==meta[3]||r?.[4]!==meta[4]||
      !/^\d{1,11}$/.test(id)||ids.has(id)||
      ![questionCount,rowCount,bundleCount].every(v=>Number.isInteger(v)&&v>=0&&v<=3000)||
      !['V2','LEGACY'].includes(r?.[11]))
      throw new Error('PROJECT_B_CATALOG_ENTRY_INVALID');
    ids.add(id);
    entries.push({sheetId:id,questionCount,rowCount,bundleCount,schema:r[11]});
  }
  return {entries,generation:String(meta[4]),incarnationId:String(meta[3])};
}

function hojaPublicSheets_() {
  const catalog=hojaCatalogRead_();
  const metadata=hojaApiGet_('?fields='+encodeURIComponent('sheets(properties(sheetId,title,index,hidden))'));
  if(!metadata||!Array.isArray(metadata.sheets))throw new Error('PROJECT_B_CATALOG_INVALID');
  const sheetById=new Map();
  metadata.sheets.forEach(item=>{
    const p=item?.properties;
    if(!p||!Number.isSafeInteger(Number(p.sheetId)))return;
    const id=String(p.sheetId);
    if(sheetById.has(id))throw new Error('PROJECT_B_CATALOG_DUPLICATE');
    sheetById.set(id,p);
  });
  const seenNames=new Set();
  const sheets=catalog.entries.map(entry=>{
    const p=sheetById.get(entry.sheetId);
    if(!p||p.hidden===true||!hojaPublicName_(p.title))
      throw new Error('PROJECT_B_PUBLIC_ENTRY_NOT_AVAILABLE');
    const title=String(p.title).trim();
    if(seenNames.has(title))throw new Error('PROJECT_B_CATALOG_DUPLICATE');
    seenNames.add(title);
    return {title,sheetId:entry.sheetId,index:Number(p.index)||0,
      schema:entry.schema,questionCount:entry.questionCount,rowCount:entry.rowCount};
  });
  return {sheets:sheets.sort((a,b)=>a.index-b.index),
    generation:catalog.generation,incarnationId:catalog.incarnationId};
}

function hojaListPublicCartridges() {
  return hojaPublicSheets_().sheets.map(p=>({name:p.title,cartridgeId:p.sheetId}));
}

function hojaRows_(name) {
  const range="'" + name.replace(/'/g,"''") + "'!A1:H3001";
  const response=hojaApiGet_('/values/' + encodeURIComponent(range) + '?valueRenderOption=FORMATTED_VALUE');
  if(!response||!Array.isArray(response.values)||response.values.length>3001)
    throw new Error('PROJECT_B_QUESTION_RANGE_INVALID');
  return response.values.map(row=>{
    if(!Array.isArray(row))throw new Error('PROJECT_B_QUESTION_ROW_INVALID');
    return Array.from({length:8},(_,i)=>String(row[i]??'').trim());
  });
}

function hojaReadCartridge_(sheet) {
  const rows=hojaRows_(sheet.title);
  if(!rows.length)throw new Error('PROJECT_B_SCHEMA_INVALID');
  const legacy=sheet.schema==='LEGACY';
  const expected=legacy?HOJA_V1_HEADERS_:HOJA_V2_HEADERS_;
  if(!expected.every((h,i)=>rows[0][i]===h))throw new Error('PROJECT_B_SCHEMA_INVALID');
  const questions=[],familyOrder=new Map(),variants=new Set();
  rows.slice(1).forEach((r,index)=>{
    if(r.every(v=>!v))return;
    // Legacy sheets have no bundle ID; each row is its own question family.
    const id=legacy?'legacy_row_'+(index+2):r[0];
    const shift=legacy?0:1;
    const rawType=r[0+shift],question=r[1+shift],answer=r[2+shift];
    if(!id||!question)throw new Error('PROJECT_B_QUESTION_INVALID');
    let type,variantType,options;
    if(rawType==='OX퀴즈'||rawType==='OX'){
      type='OX';variantType='ox';options=['O','X'];
      if(answer!=='O'&&answer!=='X')throw new Error('PROJECT_B_OX_INVALID');
    }else if(rawType==='객관식'||rawType==='MULTIPLE'){
      type='MULTIPLE';variantType='multiple';options=r.slice(3+shift,7+shift);
      if(!/^[1-4]$/.test(answer)||options.some(v=>!v)||new Set(options).size!==4)
        throw new Error('PROJECT_B_MC_INVALID');
    }else if(rawType==='주관식'||rawType==='SUBJECTIVE'){
      type='SUBJECTIVE';variantType='subjective';options=[];
    }else throw new Error('PROJECT_B_TYPE_INVALID');
    const variantKey=id+'\u0000'+variantType;
    if(variants.has(variantKey))throw new Error('PROJECT_B_DUPLICATE_VARIANT');
    variants.add(variantKey);
    if(!familyOrder.has(id))familyOrder.set(id,familyOrder.size+1);
    questions.push({num:questions.length+1,sourceNum:questions.length+1,
      familyId:id,familyOrder:familyOrder.get(id),variantType,type,
      question,answer,options,isNull:false});
  });
  return {questionSchemaVersion:2,sourceSheetVersion:legacy?1:2,
    cartridgeId:sheet.sheetId,questions};
}

function hojaGetPublicQuestions(names) {
  if(!Array.isArray(names)||!names.length||names.length>5||
     names.some(n=>typeof n!=='string'||!n.trim()||n.trim().length>180)||
     new Set(names.map(n=>n.trim())).size!==names.length)
    throw new Error('PROJECT_B_SELECTION_INVALID');
  const snapshot=hojaPublicSheets_();
  const selected=names.map(raw=>{
    const name=raw.trim();
    const sheet=snapshot.sheets.find(p=>p.title===name);
    if(!sheet)throw new Error('PROJECT_B_CARTRIDGE_NOT_PUBLIC');
    return sheet;
  });
  const data=selected.map(sheet=>({sheetName:sheet.title,data:hojaReadCartridge_(sheet)}));
  // Recheck after reading: if publication state changed during retrieval,
  // the request fails rather than returning a stale private question payload.
  const final=hojaPublicSheets_();
  if(final.generation!==snapshot.generation||final.incarnationId!==snapshot.incarnationId||
     selected.some(p=>!final.sheets.some(now=>now.sheetId===p.sheetId&&now.title===p.title)))
    throw new Error('PROJECT_B_CATALOG_CHANGED_RETRY');
  return data;
}


/* Production ranking sheet only. Public question bank remains GET-only. */
const HOJA_RANK_PROP_ = 'HOJA_PROD_RANKING_SPREADSHEET_ID';
const HOJA_RANK_TAB_ = 'HOJA_RANKING';
const HOJA_RANK_HEADERS_ = ['cartridge','name','score','correct','found','remainingSeconds','createdAt','runId','finish','deviceId'];
const HOJA_RANK_FORBIDDEN_ = ['SEX','XES','EXS','SXE'];
function hojaRankNormalizeName_(v) {
  return String(v == null ? '' : v).normalize('NFC').replace(/[a-z]/g,c=>c.toUpperCase());
}
function hojaRankValidName_(v) {
  return /^[가-힣A-Z0-9]{2,6}$/.test(v) && !HOJA_RANK_FORBIDDEN_.includes(v);
}

/* Ranking sheet must be provisioned and verified separately before production deployment. */
function hojaRankSheet_() {
  const id=PropertiesService.getScriptProperties().getProperty(HOJA_RANK_PROP_);
  if(!id || id===hojaProdPublicId_())throw new Error('HOJA_PROD_RANK_NOT_CONFIGURED');
  const sheet=SpreadsheetApp.openById(id).getSheetByName(HOJA_RANK_TAB_);
  if(!sheet)throw new Error('HOJA_RANK_TAB_NOT_FOUND');
  const header=sheet.getRange(1,1,1,HOJA_RANK_HEADERS_.length).getDisplayValues()[0];
  if(!HOJA_RANK_HEADERS_.every((h,i)=>header[i]===h))throw new Error('HOJA_RANK_SCHEMA_INVALID');
  return sheet;
}
function hojaRankCartridge_(v) {
  if(typeof v!=='string'||!v.trim()||!hojaPublicSheets_().sheets.some(p=>p.title===v.trim()))
    throw new Error('RANK_CARTRIDGE_DENIED');
  return v.trim();
}
function hojaRankRows_(sheet,cartridge) {
  const last=sheet.getLastRow();
  if(last<=1)return [];
  const raw=sheet.getRange(2,1,last-1,HOJA_RANK_HEADERS_.length).getValues();
  return raw.map((r,i)=>({row:i+2,cartridge:String(r[0]),name:hojaRankNormalizeName_(r[1]),score:Number(r[2]),
    correct:Number(r[3]),found:Number(r[4]),remainingSeconds:Number(r[5]),
    createdAt:r[6] instanceof Date?r[6].getTime():Number(r[6])||0,runId:String(r[7]),finish:String(r[8]),deviceId:String(r[9]||'')}))
   .filter(x=>x.cartridge===cartridge&&hojaRankValidName_(x.name)&&Number.isInteger(x.score))
   .sort((a,b)=>b.score-a.score||a.createdAt-b.createdAt||a.row-b.row);
}
function hojaRankPublicRows_(rows) {
  return rows.slice(0,25).map(x=>({name:x.name,score:x.score,correct:x.correct,found:x.found}));
}
function hojaRankList(cartridge) {
  const name=hojaRankCartridge_(cartridge);
  return {rows:hojaRankPublicRows_(hojaRankRows_(hojaRankSheet_(),name))};
}
function hojaRankSave(payload) {
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('RANK_INVALID_REQUEST');
  const cartridge=hojaRankCartridge_(payload.cartridge);
  const name=hojaRankNormalizeName_(payload.name);
  const score=Number(payload.score),found=Number(payload.found),correct=Number(payload.correct);
  const remainingSeconds=Number(payload.remainingSeconds);
  const runId=String(payload.runId||'');
  const deviceId=String(payload.deviceId||'');
  if(!hojaRankValidName_(name))throw new Error('RANK_INVALID_NAME');
  if(payload.finish!=='FINISH')throw new Error('RANK_FINISH_REQUIRED');
  if(!Number.isInteger(score)||score<0||score>100000||!Number.isInteger(found)||found<0||found>25||
     !Number.isInteger(correct)||correct<0||correct>found||!Number.isInteger(remainingSeconds)||
     remainingSeconds<0||remainingSeconds>600||score<10*correct)throw new Error('RANK_INVALID_SCORE');
  if(!/^[a-zA-Z0-9_-]{12,80}$/.test(runId))throw new Error('RANK_INVALID_RUN_ID');
  if(!/^[a-zA-Z0-9_-]{16,80}$/.test(deviceId))throw new Error('RANK_DEVICE_ID_INVALID');
  const lock=LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet=hojaRankSheet_();
    let rows=hojaRankRows_(sheet,cartridge);
    const sameRun=rows.find(r=>r.runId===runId);
    if(sameRun){
      if(sameRun.deviceId!==deviceId)throw new Error('RANK_RUN_DEVICE_MISMATCH');
      const duplicates=rows.filter(r=>r.deviceId===deviceId && r.row!==sameRun.row);
      if(duplicates.length && payload.replaceConfirmed!==true){
        return {requiresReplace:true,replayed:true,current:{name:sameRun.name,score:sameRun.score},
          existing:{name:duplicates[0].name,score:duplicates[0].score},rows:hojaRankPublicRows_(rows)};
      }
      for(const prior of duplicates.sort((a,b)=>b.row-a.row))sheet.deleteRow(prior.row);
      if(duplicates.length)rows=hojaRankRows_(sheet,cartridge);
      for(const extra of rows.slice(25).sort((a,b)=>b.row-a.row))sheet.deleteRow(extra.row);
      rows=hojaRankRows_(sheet,cartridge);
      const rank=rows.findIndex(r=>r.runId===runId);
      return {saved:rank>=0,rank:rank>=0?rank+1:null,rows:hojaRankPublicRows_(rows),replayed:true};
    }
    const previous=rows.filter(r=>r.deviceId===deviceId);
    if(previous.length && payload.replaceConfirmed!==true){
      return {requiresReplace:true,existing:{name:previous[0].name,score:previous[0].score},
        rows:hojaRankPublicRows_(rows)};
    }
    const targetRow=previous.length?previous[0].row:sheet.getLastRow()+1;
    sheet.getRange(targetRow,2).setNumberFormat('@');
    sheet.getRange(targetRow,1,1,HOJA_RANK_HEADERS_.length).setValues([[cartridge,name,score,correct,found,remainingSeconds,new Date(),runId,'FINISH',deviceId]]);
    for(const prior of previous.filter(r=>r.row!==targetRow).sort((a,b)=>b.row-a.row))sheet.deleteRow(prior.row);
    rows=hojaRankRows_(sheet,cartridge);
    for(const extra of rows.slice(25).sort((a,b)=>b.row-a.row))sheet.deleteRow(extra.row);
    rows=hojaRankRows_(sheet,cartridge);
    const rank=rows.findIndex(r=>r.runId===runId);
    return {saved:rank>=0,rank:rank>=0?rank+1:null,rows:hojaRankPublicRows_(rows),updated:previous.length>0};
  }finally{lock.releaseLock();}
}
/* ------------------------------------------------------------------------
 * U3S1 compatibility — same log format, same ScriptLock and same spreadsheet.
 * Unlike legacy Mario, validates cartridge IDs against the current Project B
 * PUBLIC catalog. This is anonymous public game-start telemetry only.
 * No private data and no quiz/scores/rankings appended here.
 * ------------------------------------------------------------------------ */
const SMQ_USAGE_SPREADSHEET_ID_KEY_U1 = 'SMQ_USAGE_SPREADSHEET_ID';
const SMQ_USAGE_SHEET_U1 = 'EVENT_LOG';
const SMQ_USAGE_HEADERS_U1 = [
  'eventId','timestamp','date','mode','repositoryKind','grade','subject','publisher',
  'cartridge','cartridgeCount','teamCount','cartridgeIds',
  'publicRepositoryNamespace','usageSchemaVersion','cartridgeTitlesJson'
];
function hojaUsageText_(x,max){
  return String(x==null?'':x).replace(/[\r\n\t]+/g,' ').trim().slice(0,max);
}
function hojaUsageClassification_(names){
  const meta=names.map(name=>{
    const m=/^([3-6])-(국어|영어|수학|사회)-([^-]+)-/.exec(name);
    return m?{grade:m[1],subject:m[2],publisher:m[3]}:{grade:'',subject:'',publisher:''};
  });
  const common=field=>meta.every(m=>m[field]===meta[0]?.[field])?meta[0]?.[field]||'':'';
  return {grade:common('grade'),subject:common('subject'),publisher:common('publisher')};
}
function recordUsageStartU1(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('USAGE_INVALID_REQUEST');
  const eventId=hojaUsageText_(payload.eventId,80);
  if(!/^[a-f0-9-]{32,40}$/i.test(eventId))throw new Error('USAGE_EVENT_ID_INVALID');
  const mode=hojaUsageText_(payload.mode,8).toUpperCase();
  const repo=hojaUsageText_(payload.repositoryKind,8).toUpperCase();
  if(repo==='PRIVATE')return {ok:true,ignored:true,reason:'PRIVATE_NOT_COLLECTED'};
  if(repo!=='PUBLIC')throw new Error('USAGE_REPOSITORY_INVALID');
  if(mode!=='SOLO'&&mode!=='TEAM')throw new Error('USAGE_MODE_INVALID');
  const ids=Array.isArray(payload.cartridgeIds)?payload.cartridgeIds.map(x=>String(x||'').trim()):[];
  const count=Number(payload.cartridgeCount);
  if(!Number.isInteger(count)||count<1||count>5||ids.length!==count||new Set(ids).size!==count||
     ids.some(id=>!/^[0-9]{1,11}$/.test(id)))throw new Error('USAGE_CARTRIDGE_IDS_INVALID');
  const teams=mode==='SOLO'?1:Number(payload.teamCount);
  if(mode==='TEAM'&&(!Number.isInteger(teams)||teams<2||teams>7))throw new Error('USAGE_TEAM_COUNT_INVALID');
  const listing=hojaPublicSheets_().sheets;
  const byId=new Map(listing.map(s=>[String(s.sheetId),String(s.title)]));
  const names=ids.map(id=>{
    if(!byId.has(id))throw new Error('USAGE_PUBLIC_CARTRIDGE_NOT_PLAYABLE');
    return byId.get(id);
  });
  const statsId=String(PropertiesService.getScriptProperties()
    .getProperty(SMQ_USAGE_SPREADSHEET_ID_KEY_U1)||'').trim();
  if(!statsId)throw new Error('USAGE_STORAGE_NOT_CONFIGURED');
  if(statsId===hojaProdPublicId_())throw new Error('USAGE_STORAGE_WRONG_SPREADSHEET');
  const sh=SpreadsheetApp.openById(statsId).getSheetByName(SMQ_USAGE_SHEET_U1);
  if(!sh)throw new Error('USAGE_SHEET_NOT_FOUND');
  // Preserve existing 15-column schema and all historical rows; never recreate.
  const actual=sh.getRange(1,1,1,SMQ_USAGE_HEADERS_U1.length).getDisplayValues()[0];
  if(actual[0]!=='eventId'||actual[1]!=='timestamp'||actual[2]!=='date'||
     actual[11]!=='cartridgeIds'||actual[13]!=='usageSchemaVersion')
    throw new Error('USAGE_SHEET_SCHEMA_INVALID');
  const extra=hojaUsageClassification_(names);
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw new Error('USAGE_APPEND_LOCK_TIMEOUT');
  try{
    const now=new Date(),date=Utilities.formatDate(now,'Asia/Seoul','yyyy-MM-dd');
    sh.appendRow([
      eventId,now,date,mode,'PUBLIC',extra.grade,extra.subject,extra.publisher,
      hojaUsageText_(names.join(' | '),500),names.length,teams,ids.join('|'),
      'PUBLIC:'+hojaProdPublicId_(),'U3S1',JSON.stringify(names)
    ]);
    SpreadsheetApp.flush();
    return {ok:true,repositoryKind:'PUBLIC',cartridgeCount:names.length,usageSchemaVersion:'U3S1'};
  }finally{lock.releaseLock()}
}
