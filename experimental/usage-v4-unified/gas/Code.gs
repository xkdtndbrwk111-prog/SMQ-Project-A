/** HOJA QUIZ 2.0 — Project A SINGLE GAS, 40-6-U ISOLATED TEST BUILD (NOT DEPLOYED).
 * Derived from repository-root Code.gs (production candidate, unchanged).
 * Differences: doGet() routes ?view=stats to the anonymous public statistics
 * page; recordUsageStartU1() adds the V4 writer guard + commit watermark only
 * when HOJA_V4_UNIFIED_ISOLATION=COPY_40_6U_ONLY (see UsageV4Unified.gs).
 * UsageRollupU3S.gs is intentionally NOT part of this project (anonymous RPC
 * exposure finding F-1 in docs/HOJA_USAGE_V4_40_6_U0_DESIGN_20261123.md).
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

function doGet(e) {
  // Only the exact value ?view=stats opens statistics; everything else (QR,
  // existing links, unknown parameters) keeps serving the unchanged game.
  const view=e&&e.parameter&&typeof e.parameter.view==='string'?e.parameter.view:'';
  if(view==='stats'){
    return HtmlService.createHtmlOutputFromFile('Stats')
      .setTitle('HOJA QUIZ 공개 이용 통계')
      .addMetaTag('viewport','width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createHtmlOutputFromFile('Game')
    .setTitle('HOJA QUIZ 1.5')   // teacher (40-6CH): browser tab / app name
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
  const qa=hojaApprovedGameCatalog_(); // 40-6 F3: approved catalog when one is in use
  if(qa){
    // F4 (40-6AD): with a pinned public content source, each row also carries the TRUSTED package pin the
    // browser cache needs (the game itself only reads row.name).
    const src=hojaApprovedSource_(qa);
    return qa.entries.map(e=>{const row={name:hojaApprovedGameName_(e),cartridgeId:e.cartridgeId};
      if(src)row.pkg={id:e.cartridgeId,sha256:e.packageSha256,path:e.contentPath,commit:src.commit,repo:src.repo,
        questionCount:e.questionCount,sourceCommit:qa.sourceCommit,pinRelay:true};
      row.display={sourceTitle:e.title,number:String(e.unit)+(e.subunit==null?'':'-'+e.subunit),title:e.title};
      return row;});
  }
  const sheets=hojaPublicSheets_().sheets;
  hojaUsageCatalogPut_(sheets); // warms the telemetry cache: the game lists before it starts
  return sheets.map(p=>({name:p.title,cartridgeId:p.sheetId}));
}

/* 40-6-U D (R6): game-start telemetry validates LEGACY public ids against a
 * short-lived cache of the same public catalog instead of two Sheets API calls
 * per start (17/40 SHEETS_HTTP_429 in the real R6 run). Question loading still
 * uses the live catalog with its recheck. A cartridge unpublished within the
 * TTL can only still be COUNTED (never served) for at most this many seconds. */
const HOJA_USAGE_CATALOG_CACHE_KEY_='HOJA_USAGE_PUBLIC_CATALOG_V1';
const HOJA_USAGE_CATALOG_CACHE_SECONDS_=300;
function hojaUsageCatalogPut_(sheets){
  try{
    CacheService.getScriptCache().put(HOJA_USAGE_CATALOG_CACHE_KEY_,
      JSON.stringify({sheets:sheets.map(s=>({sheetId:String(s.sheetId),title:String(s.title)}))}),
      HOJA_USAGE_CATALOG_CACHE_SECONDS_);
  }catch(_e){} // cache is an optimisation only
}
function hojaUsageLegacyCatalog_(perf){
  const hit=CacheService.getScriptCache().get(HOJA_USAGE_CATALOG_CACHE_KEY_);
  if(hit){
    try{const v=JSON.parse(hit);
      if(v&&Array.isArray(v.sheets)){perf.catalog='CACHE';return v.sheets;}}catch(_e){}
  }
  const t=Date.now();
  const sheets=hojaPublicSheets_().sheets;
  perf.catalog='LIVE';perf.catalogMs=Date.now()-t;perf.sheetsApiCalls+=2;
  hojaUsageCatalogPut_(sheets);
  return sheets.map(s=>({sheetId:String(s.sheetId),title:String(s.title)}));
}

/* 40-6-U B: approved (HOJA-QUESTION-BANK) cartridges. The ONLY runtime list source
 * is the build-time generated HOJA_APPROVED_ACTIVE_CATALOG_ (ApprovedActiveCatalog.gs):
 * teacher deployment-approved, effective-SHA-pinned ids.
 * F4 (40-6AD): package CONTENT is either embedded (HOJA_APPROVED_CONTENT_, legacy) or, when the
 * catalog declares contentSource GITHUB_RAW_PINNED_V1, fetched per selected unit from the PUBLIC
 * HOJA-QUESTION-BANK at a FIXED 40-hex commit (never a branch / moving HEAD) and accepted only if
 * its SHA-256 equals the catalog packageSha256. Host + repo are allowlisted here, not in data. */
const HOJA_APPROVED_ID_RE_=/^[a-z0-9][a-z0-9-]{2,63}$/;
const HOJA_APPROVED_RAW_HOST_='https://raw.githubusercontent.com/';
const HOJA_APPROVED_RAW_REPOS_=Object.freeze(['xkdtndbrwk111-prog/HOJA-QUESTION-BANK']);
const HOJA_APPROVED_PATH_RE_=/^[A-Za-z0-9][A-Za-z0-9_-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*\.json$/;
const HOJA_APPROVED_IMAGE_RE_=/^data:image\/(webp|png|jpeg|gif|svg\+xml);base64,[A-Za-z0-9+\/=]+$/;
const HOJA_APPROVED_CACHE_PREFIX_='HOJA_AQ1_';
const HOJA_APPROVED_CACHE_CHUNK_=90000;
const HOJA_APPROVED_CACHE_SECONDS_=21600;
/* Validates the catalog's remote content source (null = embedded content). Throws on anything else. */
function hojaApprovedSource_(c){
  if(!Object.prototype.hasOwnProperty.call(c,'contentSource'))return null;
  const s=c.contentSource;
  if(!s||typeof s!=='object'||s.kind!=='GITHUB_RAW_PINNED_V1'||
     HOJA_APPROVED_RAW_REPOS_.indexOf(String(s.repo))<0||!/^[a-f0-9]{40}$/.test(String(s.commit)))
    throw new Error('APPROVED_CONTENT_SOURCE_INVALID');
  for(const e of c.entries){
    const path=String(e.contentPath||'');
    if(!HOJA_APPROVED_PATH_RE_.test(path)||path.indexOf('..')>=0||path.length>200)
      throw new Error('APPROVED_CONTENT_SOURCE_INVALID');
  }
  return s;
}
function hojaApprovedActive_(){
  const c=typeof HOJA_APPROVED_ACTIVE_CATALOG_==='object'?HOJA_APPROVED_ACTIVE_CATALOG_:null;
  if(!c||c.schemaVersion!=='hoja-active-cartridge-catalog-v1'||!Array.isArray(c.entries)||
     !/^[a-f0-9]{40}$/.test(String(c.sourceCommit)))throw new Error('APPROVED_CATALOG_INVALID');
  const type=c.buildType||'RELEASE';
  // F1: a TEST-ONLY QA preview catalog is refused anywhere but the isolated 40-6U test project.
  if(type==='QA_TEST_ONLY'){
    if(!hojaV4uEnabled_(PropertiesService.getScriptProperties()))
      throw new Error('APPROVED_QA_CATALOG_REQUIRES_ISOLATED_TEST_PROJECT');
    // Q02 second defense: a QA bundle is bound at build time to the isolated project's script id.
    const allowed=Array.isArray(c.allowedScriptIds)?c.allowedScriptIds:[];
    if(!allowed.length||allowed.indexOf(ScriptApp.getScriptId())<0)
      throw new Error('APPROVED_QA_CATALOG_SCRIPT_ID_NOT_ALLOWED');
  }else if(type!=='RELEASE')throw new Error('APPROVED_CATALOG_INVALID');
  hojaApprovedSource_(c);
  // Remote reader is opt-in, and never runs for an isolated QA or empty legacy catalog.
  return typeof hojaRemoteCatalogGet_==='function'?hojaRemoteCatalogGet_(c):c;
}
/* 40-6 F3/F3-2: the game's existing LIST/GET RPCs serve the approved catalog when
 *  - the TEST-ONLY QA catalog is embedded (refused outside the isolated project), or
 *  - the RELEASE catalog has teacher-deployment-approved entries AND the approved era has
 *    started (HOJA_USAGE_APPROVED_ERA_START <= today KST). Active entries before the era
 *    start fail closed (never silently fall back to, or mix with, the legacy Sheets list).
 * RELEASE with 0 active entries (today) keeps the legacy behaviour unchanged. */
function hojaApprovedGameCatalog_(){
  const c=hojaApprovedActive_();
  if(c.buildType!=='QA_TEST_ONLY'&&!c.entries.length)return null;
  // Two active units must never resolve to the same game catalog name (fail closed, explicitly).
  const names=c.entries.map(hojaApprovedGameName_);
  if(new Set(names).size!==names.length)throw new Error('APPROVED_GAME_NAME_COLLISION');
  if(c.buildType==='QA_TEST_ONLY')return c;
  const today=Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd');
  if(!hojaUsageEra_(PropertiesService.getScriptProperties(),today).approved)
    throw new Error('APPROVED_ACTIVE_BEFORE_ERA_START');
  return c;
}
/* The game's catalog screen groups entries by parsing "grade-[N학기-]subject-[publisher-]label".
 * Approved entries are named in that convention from APPROVED metadata only, so they group by
 * grade/subject(/publisher) and the shown label is the approved title. GET maps the same name back. */
function hojaApprovedGameName_(e){
  const clean=v=>String(v==null?'':v).replace(/[-_–—|/·\s]+/g,' ').trim();
  const parts=[String(e.grade)];
  if(e.semester===1||e.semester===2)parts.push(e.semester+'학기');
  parts.push(clean(e.subjectLabel)||'기타');
  if(e.subject==='english')parts.push(clean(e.publisher)+(e.author?'('+clean(e.author)+')':'')||'출판사 미구분');
  parts.push(String(e.title));
  return parts.join('-');
}
function hojaApprovedIdsByTitle_(cat,names){
  if(!Array.isArray(names)||!names.length||names.length>5||
     names.some(n=>typeof n!=='string'||!n.trim()||n.trim().length>400)||
     new Set(names.map(n=>n.trim())).size!==names.length)throw new Error('PROJECT_B_SELECTION_INVALID');
  return names.map(n=>{
    const hits=cat.entries.filter(e=>hojaApprovedGameName_(e)===n.trim());
    if(hits.length!==1)throw new Error('PROJECT_B_CARTRIDGE_NOT_PUBLIC');
    return hits[0].cartridgeId;
  });
}
function hojaListApprovedCartridges(){
  const c=hojaApprovedActive_();
  return c.entries.map(e=>({cartridgeId:e.cartridgeId,title:e.title,
    grade:e.grade,semester:e.semester,subject:e.subjectLabel,publisher:e.publisher,
    unit:e.unit,questionCount:e.questionCount,qaPreview:c.buildType==='QA_TEST_ONLY'}));
}
/* F1: lazy, per-unit approved content (only the selected units are loaded). The package
 * text is SHA-256 pinned by the SAME active catalog that list/usage validation use. */
function hojaGetApprovedQuestions(ids){
  return hojaGetApprovedQuestionsFromCatalog_(hojaApprovedActive_(),ids);
}
function hojaGetApprovedQuestionsFromCatalog_(cat,ids){
  const active=new Map(cat.entries.map(e=>[e.cartridgeId,e]));
  if(!Array.isArray(ids)||!ids.length||ids.length>5||new Set(ids).size!==ids.length||
     ids.some(id=>typeof id!=='string'||!HOJA_APPROVED_ID_RE_.test(id)))
    throw new Error('APPROVED_SELECTION_INVALID');
  if(ids.some(id=>!active.has(id)))throw new Error('APPROVED_CARTRIDGE_NOT_ACTIVE');
  const entries=ids.map(id=>active.get(id));
  const source=hojaApprovedSource_(cat);
  if(source&&entries.some(e=>!/^[a-f0-9]{64}$/.test(String(e.packageSha256))))
    throw new Error('APPROVED_CONTENT_DIGEST_MISMATCH');
  const texts=source?hojaApprovedFetchTexts_(source,entries):entries.map(hojaApprovedEmbeddedText_);
  return entries.map((e,i)=>({sheetName:e.title,data:hojaApprovedParse_(e,texts[i])}));
}
function hojaApprovedEmbeddedText_(e){
  const reg=typeof HOJA_APPROVED_CONTENT_==='object'&&HOJA_APPROVED_CONTENT_?HOJA_APPROVED_CONTENT_:{};
  const p=Object.prototype.hasOwnProperty.call(reg,e.cartridgeId)?reg[e.cartridgeId]:null;
  if(!p||typeof p.load!=='function')throw new Error('APPROVED_CONTENT_NOT_PACKAGED');
  if(!/^[a-f0-9]{64}$/.test(String(e.packageSha256))||p.packageSha256!==e.packageSha256)
    throw new Error('APPROVED_CONTENT_DIGEST_MISMATCH');
  const text=p.load();
  if(hojaV4uSha256_(text)!==e.packageSha256)throw new Error('APPROVED_CONTENT_DIGEST_MISMATCH');
  return text;
}
/* Remote (F4): cache (re-verified) -> one parallel fetchAll for the misses -> verify -> cache.
 * Any network error, non-200, redirect or digest mismatch fails the WHOLE request (no partial game). */
function hojaApprovedFetchTexts_(source,entries){
  const out=entries.map(e=>hojaApprovedCacheGet_(e.packageSha256));
  const miss=[];out.forEach((t,i)=>{if(t==null)miss.push(i);});
  if(miss.length){
    const reqs=miss.map(i=>({url:HOJA_APPROVED_RAW_HOST_+source.repo+'/'+source.commit+'/'+entries[i].contentPath,
      method:'get',muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true}));
    let res;
    try{res=UrlFetchApp.fetchAll(reqs);}catch(_e){throw new Error('APPROVED_CONTENT_FETCH_FAILED');}
    if(!Array.isArray(res)||res.length!==reqs.length)throw new Error('APPROVED_CONTENT_FETCH_FAILED');
    miss.forEach((i,k)=>{
      const r=res[k];
      if(!r||r.getResponseCode()!==200)throw new Error('APPROVED_CONTENT_FETCH_FAILED');
      const text=r.getContentText('UTF-8');
      if(hojaV4uSha256_(text)!==entries[i].packageSha256)throw new Error('APPROVED_CONTENT_DIGEST_MISMATCH');
      out[i]=text;
    });
    miss.forEach(i=>hojaApprovedCachePut_(entries[i].packageSha256,out[i]));
  }
  return out;
}
/* Cache is an optimisation only: every read is re-hashed; failures fall back to a fetch. */
function hojaApprovedCacheGet_(sha){
  try{
    const c=CacheService.getScriptCache();const head=c.get(HOJA_APPROVED_CACHE_PREFIX_+sha+'_n');
    const n=Number(head);if(!Number.isSafeInteger(n)||n<1||n>40)return null;
    const keys=[];for(let i=0;i<n;i++)keys.push(HOJA_APPROVED_CACHE_PREFIX_+sha+'_'+i);
    const got=c.getAll(keys);const parts=keys.map(k=>got[k]);
    if(parts.some(p=>typeof p!=='string'))return null;
    const text=parts.join('');
    return hojaV4uSha256_(text)===sha?text:null;
  }catch(_e){return null;}
}
function hojaApprovedCachePut_(sha,text){
  try{
    const n=Math.ceil(text.length/HOJA_APPROVED_CACHE_CHUNK_);if(n<1||n>40)return;
    const v={};for(let i=0;i<n;i++)v[HOJA_APPROVED_CACHE_PREFIX_+sha+'_'+i]=text.slice(i*HOJA_APPROVED_CACHE_CHUNK_,(i+1)*HOJA_APPROVED_CACHE_CHUNK_);
    const c=CacheService.getScriptCache();c.putAll(v,HOJA_APPROVED_CACHE_SECONDS_);
    c.put(HOJA_APPROVED_CACHE_PREFIX_+sha+'_n',String(n),HOJA_APPROVED_CACHE_SECONDS_);
  }catch(_e){}
}
/* Structure + media/tag checks on a digest-verified package. */
function hojaApprovedParse_(e,text){
  let data;
  try{data=JSON.parse(text);}catch(_e){throw new Error('APPROVED_CONTENT_INVALID');}
  if(!data||data.cartridgeId!==e.cartridgeId||data.questionSchemaVersion!==2||!Array.isArray(data.questions)||
     data.questions.length!==e.questionCount||!data.images||typeof data.images!=='object'||Array.isArray(data.images)||
     !data.unitMeta||typeof data.unitMeta!=='object'||!data.tags||typeof data.tags!=='object'||Array.isArray(data.tags)||
     data.questions.some(q=>!q||!q.rendererQuestion||!q.familyId||!q.type))
    throw new Error('APPROVED_CONTENT_INVALID');
  for(const k of Object.keys(data.images))
    if(typeof data.images[k]!=='string'||!HOJA_APPROVED_IMAGE_RE_.test(data.images[k]))
      throw new Error('APPROVED_CONTENT_MEDIA_INVALID');
  for(const q of data.questions){
    const r=q.rendererQuestion;
    const refs=(r.image?[r.image]:[]).concat((Array.isArray(r.media)?r.media:[]).filter(m=>m&&m.kind==='image').map(m=>m.asset));
    if(refs.some(a=>typeof a!=='string'||!Object.prototype.hasOwnProperty.call(data.images,a)))
      throw new Error('APPROVED_CONTENT_MEDIA_INVALID');
  }
  for(const k of Object.keys(data.tags))
    if(!data.tags[k]||typeof data.tags[k]!=='object')throw new Error('APPROVED_CONTENT_TAGS_INVALID');
  return data;
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
  const qa=hojaApprovedGameCatalog_(); // 40-6 F3: approved catalog when one is in use
  // the game requires sheetName === the requested catalog name (GET contract)
  if(qa){
    const pinned=names&&!Array.isArray(names)&&typeof names==='object';
    const selected=pinned?names.names:names;
    const ids=hojaApprovedIdsByTitle_(qa,selected);
    if(pinned){
      const pins=names.pins;
      if(!Array.isArray(pins)||pins.length!==ids.length||
        pins.some((p,i)=>!p||p.id!==ids[i]||p.sha256!==qa.entries.find(e=>e.cartridgeId===ids[i]).packageSha256))
          throw Error('APPROVED_CATALOG_CHANGED_RETRY');
    }
    return hojaGetApprovedQuestionsFromCatalog_(qa,ids).map((r,i)=>({sheetName:selected[i].trim(),data:r.data}));
  }
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
/* Era boundary (40-6-U C): Script Property HOJA_USAGE_APPROVED_ERA_START (yyyy-MM-dd).
 * Unset            -> only LEGACY public ids are recorded (approved ids refused).
 * today <  start   -> LEGACY only.   today >= start -> APPROVED only.
 * One KST day therefore never mixes legacy and approved rows, and the 61-day
 * legacy history (17,670) is never re-labelled or added to approved usage. */
const HOJA_USAGE_ERA_PROP_='HOJA_USAGE_APPROVED_ERA_START';
function hojaUsageEra_(props,today){
  const start=String(props.getProperty(HOJA_USAGE_ERA_PROP_)||'').trim();
  if(!start)return {start:'',approved:false};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start))throw new Error('USAGE_ERA_CONFIG_INVALID');
  return {start,approved:today>=start};
}
function hojaUsageCommon_(values){
  return values.every(v=>v===values[0])?String(values[0]==null?'':values[0]):'';
}
function recordUsageStartU1(payload){
  const t0=Date.now();
  const perf={catalog:'NONE',catalogMs:0,sheetsApiCalls:0,lockWaitMs:0,lockHoldMs:0,totalMs:0};
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
  const legacyIds=ids.every(id=>/^[0-9]{1,11}$/.test(id));
  const approvedIds=ids.every(id=>HOJA_APPROVED_ID_RE_.test(id)&&!/^[0-9]+$/.test(id));
  if(!Number.isInteger(count)||count<1||count>5||ids.length!==count||new Set(ids).size!==count||
     !(legacyIds||approvedIds))throw new Error('USAGE_CARTRIDGE_IDS_INVALID');
  const teams=mode==='SOLO'?1:Number(payload.teamCount);
  if(mode==='TEAM'&&(!Number.isInteger(teams)||teams<2||teams>7))throw new Error('USAGE_TEAM_COUNT_INVALID');
  const props=PropertiesService.getScriptProperties();
  const era=hojaUsageEra_(props,Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd'));
  let fields;
  if(legacyIds){
    if(era.approved)throw new Error('USAGE_LEGACY_CATALOG_RETIRED');
    const byId=new Map(hojaUsageLegacyCatalog_(perf).map(s=>[s.sheetId,s.title]));
    const names=ids.map(id=>{
      if(!byId.has(id))throw new Error('USAGE_PUBLIC_CARTRIDGE_NOT_PLAYABLE');
      return byId.get(id);
    });
    const extra=hojaUsageClassification_(names);
    fields={grade:extra.grade,subject:extra.subject,publisher:extra.publisher,
      cartridge:hojaUsageText_(names.join(' | '),500),ids:ids.join('|'),
      namespace:'PUBLIC:'+hojaProdPublicId_(),schema:'U3S1',titles:JSON.stringify(names),n:names.length};
  }else{
    if(!era.start)throw new Error('USAGE_APPROVED_ERA_NOT_STARTED');
    if(!era.approved)throw new Error('USAGE_APPROVED_ERA_NOT_STARTED');
    const cat=hojaApprovedActive_();
    const byId=new Map(cat.entries.map(e=>[e.cartridgeId,e]));
    // Stable-ID grouping: A+B and B+A are the same combination.
    const sorted=ids.slice().sort();
    const entries=sorted.map(id=>{
      if(!byId.has(id))throw new Error('USAGE_APPROVED_CARTRIDGE_NOT_ACTIVE');
      return byId.get(id);
    });
    perf.catalog='EMBEDDED';
    fields={grade:hojaUsageCommon_(entries.map(e=>e.grade)),
      subject:hojaUsageCommon_(entries.map(e=>e.subjectLabel)),
      publisher:hojaUsageCommon_(entries.map(e=>e.publisher||'')),
      cartridge:sorted.join(' + '),ids:sorted.join('|'),
      namespace:'APPROVED:'+String(cat.sourceCommit).slice(0,12),schema:'A1',
      titles:JSON.stringify(entries.map(e=>e.title)),n:entries.length};
  }
  const statsId=String(props.getProperty(SMQ_USAGE_SPREADSHEET_ID_KEY_U1)||'').trim();
  if(!statsId)throw new Error('USAGE_STORAGE_NOT_CONFIGURED');
  if(statsId===hojaProdPublicId_())throw new Error('USAGE_STORAGE_WRONG_SPREADSHEET');
  const v4=hojaV4uWriterContext_(statsId); // null => original U1 behaviour (V4 verifies storage itself)
  const sh=v4?v4.event:SpreadsheetApp.openById(statsId).getSheetByName(SMQ_USAGE_SHEET_U1);
  if(!sh)throw new Error('USAGE_SHEET_NOT_FOUND');
  // Preserve existing 15-column schema and all historical rows; never recreate.
  if(!v4||!v4.headerVerified){
    const actual=sh.getRange(1,1,1,SMQ_USAGE_HEADERS_U1.length).getDisplayValues()[0];
    if(actual[0]!=='eventId'||actual[1]!=='timestamp'||actual[2]!=='date'||
       actual[11]!=='cartridgeIds'||actual[13]!=='usageSchemaVersion')
      throw new Error('USAGE_SHEET_SCHEMA_INVALID');
    if(v4)hojaV4uMarkHeaderVerified_(v4);
  }
  const lock=LockService.getScriptLock();
  const tw=Date.now();
  if(!lock.tryLock(20000))throw new Error('USAGE_APPEND_LOCK_TIMEOUT');
  const th=Date.now();perf.lockWaitMs=th-tw;
  try{
    const now=new Date(),date=Utilities.formatDate(now,'Asia/Seoul','yyyy-MM-dd');
    // The day may have rolled over while waiting: re-check the era for the row date.
    if(hojaUsageEra_(props,date).approved!==era.approved)throw new Error('USAGE_ERA_CHANGED_RETRY');
    const usageRow=[
      eventId,now,date,mode,'PUBLIC',fields.grade,fields.subject,fields.publisher,
      fields.cartridge,fields.n,teams,fields.ids,fields.namespace,fields.schema,fields.titles
    ];
    let result;
    if(v4){
      // V4 (isolated copy only): sealed-day / monotone-day / dedupe guard and
      // commit watermark, all inside this same ScriptLock.
      result=hojaV4uWriterAppend_(v4,sh,usageRow);
    }else{
      sh.appendRow(usageRow);
      SpreadsheetApp.flush();
      result={ok:true,repositoryKind:'PUBLIC',cartridgeCount:fields.n,usageSchemaVersion:fields.schema};
    }
    perf.lockHoldMs=Date.now()-th;perf.totalMs=Date.now()-t0;
    return Object.assign(result,{perf});
  }finally{lock.releaseLock()}
}
