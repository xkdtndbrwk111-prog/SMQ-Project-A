/* =========================================================
   SMQ Project A — U3-S1 Shadow Rollup Writer + U3-S2 Parity Harness
   2026-09-23

   APPROVED SCOPE
   - Project A owns append + rollup because Project A owns recordUsageStartU1().
   - Shadow only. Project B still reads raw EVENT_LOG.
   - No raw deletion.
   - No archive automation.
   - No production Statistics Source-of-Truth switch.
   ========================================================= */

const SMQ_USAGE_ROLLUP_TOTALS_SHEET_U3S = 'USAGE_DAILY_TOTALS';
const SMQ_USAGE_ROLLUP_DIMENSIONS_SHEET_U3S = 'USAGE_DAILY_DIMENSIONS';
const SMQ_USAGE_ROLLUP_MANIFEST_SHEET_U3S = 'USAGE_ROLLUP_MANIFEST';
const SMQ_USAGE_ROLLUP_SCHEMA_U3S = 'U3S1_ROLLUP_V1';
const SMQ_USAGE_ROLLUP_RECOVERY_SCHEMA_U3S = 'U3S1_ROLLUP_V2';
const SMQ_USAGE_ROLLUP_RECOVERY_POLICY_U3S = 'COUNT_ALL';
const SMQ_USAGE_EVENT_SCHEMA_U3S = 'U3S1';
const SMQ_USAGE_ROLLUP_TZ_U3S = 'Asia/Seoul';

const SMQ_USAGE_TOTALS_HEADERS_U3S = [
  'date','generationSeq','generation','schemaVersion',
  'eventCount','soloCount','teamCount',
  'team2Count','team3Count','team4Count','team5Count','team6Count',
  'createdAt'
];

const SMQ_USAGE_DIM_HEADERS_U3S = [
  'date','generationSeq','generation','schemaVersion',
  'dimension','dimensionKey','displayLabel','count','createdAt'
];

const SMQ_USAGE_MANIFEST_HEADERS_U3S = [
  'date','generationSeq','generation','schemaVersion','status',
  'cutoffLastRow','cutoffAcceptedAt',
  'sourceEventCount','sourceU3EventCount','sourceLegacyEventCount',
  'sourceEventIdDigest','sourceContentDigest',
  'startedAt','completedAt','verifiedAt',
  'needsRebuild','notes'
];

function smqUsageRollupStorageU3S_(){
  const id = String(
    PropertiesService.getScriptProperties().getProperty(SMQ_USAGE_SPREADSHEET_ID_KEY_U1) || ''
  ).trim();
  if(!id) throw new Error('USAGE_STORAGE_NOT_CONFIGURED');
  return SpreadsheetApp.openById(id);
}

function smqUsageEnsureSheetU3S_(ss,name,headers){
  let sh=ss.getSheetByName(name);
  if(!sh) sh=ss.insertSheet(name);

  if(sh.getLastRow()===0){
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return sh;
  }

  const width=Math.max(headers.length,sh.getLastColumn());
  const existing=sh.getRange(1,1,1,width).getDisplayValues()[0];
  const mismatch=headers.some((h,i)=>String(existing[i]||'').trim()!==h);
  if(mismatch){
    throw new Error('USAGE_ROLLUP_HEADER_MISMATCH:'+name);
  }
  return sh;
}

/* Recovery must not create or repair storage as a side effect. Setup remains
   a separately approved operation; this helper only validates existing tabs. */
function smqUsageRequireSheetU3S_(ss,name,headers){
  const sh=ss.getSheetByName(name);
  if(!sh||sh.getLastRow()<1)throw new Error('USAGE_ROLLUP_NOT_SETUP:'+name);
  const width=Math.max(headers.length,sh.getLastColumn());
  const existing=sh.getRange(1,1,1,width).getDisplayValues()[0];
  const mismatch=headers.some((h,i)=>String(existing[i]||'').trim()!==h);
  if(mismatch)throw new Error('USAGE_ROLLUP_HEADER_MISMATCH:'+name);
  return sh;
}

function setupUsageRollupShadowU3S1_(){
  const ss=smqUsageRollupStorageU3S_();
  const totals=smqUsageEnsureSheetU3S_(ss,SMQ_USAGE_ROLLUP_TOTALS_SHEET_U3S,SMQ_USAGE_TOTALS_HEADERS_U3S);
  const dims=smqUsageEnsureSheetU3S_(ss,SMQ_USAGE_ROLLUP_DIMENSIONS_SHEET_U3S,SMQ_USAGE_DIM_HEADERS_U3S);
  const manifest=smqUsageEnsureSheetU3S_(ss,SMQ_USAGE_ROLLUP_MANIFEST_SHEET_U3S,SMQ_USAGE_MANIFEST_HEADERS_U3S);
  SpreadsheetApp.flush();
  return {
    ok:true,
    spreadsheetId:ss.getId(),
    sheets:[totals.getName(),dims.getName(),manifest.getName()],
    sourceOfTruth:'RAW_EVENT_LOG',
    rawDeletion:'HOLD'
  };
}

function smqUsageDateKeyU3S_(d){
  return Utilities.formatDate(d,SMQ_USAGE_ROLLUP_TZ_U3S,'yyyy-MM-dd');
}

/* Google Sheets may coerce an appended "yyyy-MM-dd" string into a Date cell.
   All rollup key comparisons must normalize that cell back to the canonical
   Asia/Seoul yyyy-MM-dd key instead of using String(cellValue). */
function smqUsageStoredDateKeyU3S_(v){
  if(v instanceof Date && !isNaN(v.getTime())){
    return smqUsageDateKeyU3S_(v);
  }
  const s=String(v==null?'':v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:'';
}

function smqUsageYesterdayKeyU3S_(){
  const now=new Date();
  const noon=new Date(now.getTime());
  noon.setHours(12,0,0,0);
  noon.setDate(noon.getDate()-1);
  return smqUsageDateKeyU3S_(noon);
}

function smqUsageValidatePastDateU3S_(dateKey){
  const d=String(dateKey||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('USAGE_ROLLUP_DATE_INVALID');
  const today=smqUsageDateKeyU3S_(new Date());
  if(d>=today) throw new Error('USAGE_ROLLUP_REQUIRES_PAST_DATE');
  return d;
}

function smqUsageUtf8DigestU3S_(text){
  const bytes=Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text||''),
    Utilities.Charset.UTF_8
  );
  return bytes.map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}

function smqUsageCanonicalTextU3S_(v,maxLen){
  let s=String(v==null?'':v).replace(/[\r\n\t]+/g,' ').trim();
  if(Number.isFinite(maxLen)&&maxLen>0)s=s.slice(0,maxLen);
  return s;
}

function smqUsageTimestampIsoU3S_(raw,display){
  if(raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString();
  const s=smqUsageCanonicalTextU3S_(display||raw,80);
  const parsed=new Date(s);
  return isNaN(parsed.getTime())?'':parsed.toISOString();
}

function smqUsageParseIdsU3S_(v){
  const raw=smqUsageCanonicalTextU3S_(v,1000);
  if(!raw)return [];
  const ids=raw.split('|').map(x=>x.trim()).filter(Boolean);
  if(ids.some(x=>!/^\d+$/.test(x)))return [];
  return ids;
}

function smqUsageParseTitlesJsonU3S_(v){
  const raw=String(v==null?'':v).trim();
  if(!raw)return [];
  try{
    const x=JSON.parse(raw);
    if(!Array.isArray(x))return [];
    return x.map(v=>smqUsageCanonicalTextU3S_(v,500));
  }catch(_e){
    return [];
  }
}

function smqUsageMapIncU3S_(map,key,inc){
  const k=String(key==null?'':key);
  const current=Object.prototype.hasOwnProperty.call(map,k)?map[k]:0;
  map[k]=current+(Number(inc)||0);
}

function smqUsageReadEventRowsU3S_(eventSh,cutoffLastRow){
  const last=Math.max(1,Math.min(Number(cutoffLastRow)||1,eventSh.getLastRow()));
  if(last<2)return [];

  const width=Math.max(15,eventSh.getLastColumn());
  const range=eventSh.getRange(2,1,last-1,width);
  const values=range.getValues();
  const display=range.getDisplayValues();

  return values.map((r,i)=>({
    rowNumber:i+2,
    values:r,
    display:display[i]
  }));
}

function smqUsageDuplicateDiagnosticsU3S_(duplicateIds){
  const counts=Object.create(null);
  duplicateIds.forEach(id=>smqUsageMapIncU3S_(counts,id,1));
  const keys=Object.keys(counts).sort();
  return {
    duplicateEventIdCount:keys.length,
    duplicateRowCount:duplicateIds.length,
    duplicateEventIdDigest:keys.length
      ?smqUsageUtf8DigestU3S_(JSON.stringify(keys))
      :''
  };
}

function smqUsageDuplicateFailureMessageU3S_(diagnostics){
  return [
    'USAGE_ROLLUP_DUPLICATE_EVENT_ID',
    'count='+diagnostics.duplicateEventIdCount,
    'rows='+diagnostics.duplicateRowCount,
    'digest='+diagnostics.duplicateEventIdDigest
  ].join(';');
}

function smqUsageBuildRawSnapshotU3S_(eventSh,dateKey,cutoffLastRow,options){
  const opts=options||{};
  const duplicatePolicy=String(opts.duplicatePolicy||'FAIL').toUpperCase();
  if(!['FAIL','COUNT_ALL'].includes(duplicatePolicy)){
    throw new Error('USAGE_ROLLUP_DUPLICATE_POLICY_INVALID');
  }
  const rawRows=smqUsageReadEventRowsU3S_(eventSh,cutoffLastRow);
  const events=[];
  const seenEventIds=Object.create(null);
  const duplicateIds=[];
  let sourceLegacyEventCount=0;
  let sourceU3EventCount=0;

  const dims={
    GRADE:Object.create(null),
    SUBJECT:Object.create(null),
    PUBLISHER:Object.create(null),
    CARTRIDGE:Object.create(null)
  };
  const cartridgeLabelChoice=Object.create(null);

  let solo=0,team=0;
  const teamCounts={2:0,3:0,4:0,5:0,6:0};

  rawRows.forEach(row=>{
    const d=smqUsageCanonicalTextU3S_(row.display[2],20);
    const repo=smqUsageCanonicalTextU3S_(row.display[4],20).toUpperCase();
    if(d!==dateKey||repo!=='PUBLIC')return;

    const eventId=smqUsageCanonicalTextU3S_(row.display[0],80);
    if(!eventId)throw new Error('USAGE_ROLLUP_EVENT_ID_MISSING_ROW_'+row.rowNumber);
    if(Object.prototype.hasOwnProperty.call(seenEventIds,eventId)){
      duplicateIds.push(eventId);
    }else{
      seenEventIds[eventId]=true;
    }

    const timestampIso=smqUsageTimestampIsoU3S_(row.values[1],row.display[1]);
    const mode=smqUsageCanonicalTextU3S_(row.display[3],8).toUpperCase()||'기타';
    const gradeRaw=smqUsageCanonicalTextU3S_(row.display[5],20);
    const gradeLabel=gradeRaw?gradeRaw+'학년':'기타';
    const subject=smqUsageCanonicalTextU3S_(row.display[6],100)||'기타';
    const publisher=smqUsageCanonicalTextU3S_(row.display[7],200);
    const cartridgeText=smqUsageCanonicalTextU3S_(row.display[8],1000);
    const cartridgeCount=Math.max(0,Math.floor(Number(row.display[9])||0));
    const teamCount=Math.floor(Number(row.display[10])||0);
    const cartridgeIds=smqUsageParseIdsU3S_(row.display[11]);
    const repositoryNamespace=smqUsageCanonicalTextU3S_(row.display[12],300);
    const usageSchemaVersion=smqUsageCanonicalTextU3S_(row.display[13],50);
    const cartridgeTitles=smqUsageParseTitlesJsonU3S_(row.display[14]);

    if(mode==='SOLO')solo++;
    else if(mode==='TEAM'){
      team++;
      if(teamCount>=2&&teamCount<=6)teamCounts[teamCount]++;
    }

    smqUsageMapIncU3S_(dims.GRADE,gradeLabel,1);
    smqUsageMapIncU3S_(dims.SUBJECT,subject,1);
    if(publisher)smqUsageMapIncU3S_(dims.PUBLISHER,publisher,1);

    const u3Valid=
      usageSchemaVersion===SMQ_USAGE_EVENT_SCHEMA_U3S &&
      /^PUBLIC:.+/.test(repositoryNamespace) &&
      cartridgeIds.length>0 &&
      cartridgeIds.length===cartridgeCount &&
      cartridgeTitles.length===cartridgeIds.length &&
      !!timestampIso;

    if(u3Valid){
      sourceU3EventCount++;

      /* One multi-cartridge game contributes +1 to EACH selected public cartridge.
         Therefore CARTRIDGE dimension sum may exceed eventCount. */
      cartridgeIds.forEach((id,idx)=>{
        const key=repositoryNamespace+'|SHEET:'+id;
        smqUsageMapIncU3S_(dims.CARTRIDGE,key,1);

        const candidate={
          label:cartridgeTitles[idx]||('sheet '+id),
          timestampIso,
          eventId
        };
        const prev=cartridgeLabelChoice[key];

        if(
          !prev ||
          candidate.timestampIso>prev.timestampIso ||
          (
            candidate.timestampIso===prev.timestampIso &&
            candidate.eventId>prev.eventId
          )
        ){
          cartridgeLabelChoice[key]=candidate;
        }
      });
    }else{
      sourceLegacyEventCount++;
    }

    /* Canonical content digest uses semantic normalized values in fixed key order.
       Array order is PRESERVED exactly as stored; duplicates are not deduplicated. */
    events.push({
      eventId,
      timestampIso,
      date:d,
      repositoryKind:'PUBLIC',
      mode,
      teamCount:mode==='TEAM'?teamCount:1,
      grade:gradeRaw,
      subject,
      publisher,
      cartridge:cartridgeText,
      cartridgeCount,
      cartridgeIds,
      publicRepositoryNamespace:repositoryNamespace,
      usageSchemaVersion,
      cartridgeTitles
    });
  });

  const duplicateDiagnostics=smqUsageDuplicateDiagnosticsU3S_(duplicateIds);
  if(duplicateDiagnostics.duplicateEventIdCount&&duplicatePolicy!=='COUNT_ALL'){
    /* Never expose an eventId in an exception, manifest note, RPC response,
       or log. The digest is sufficient to correlate repeated diagnostics. */
    throw new Error(smqUsageDuplicateFailureMessageU3S_(duplicateDiagnostics));
  }

  events.sort((a,b)=>
    a.eventId.localeCompare(b.eventId) ||
    a.timestampIso.localeCompare(b.timestampIso)
  );

  const eventIds=events.map(e=>e.eventId);
  const sourceEventIdDigest=smqUsageUtf8DigestU3S_(JSON.stringify(eventIds));
  const sourceContentDigest=smqUsageUtf8DigestU3S_(JSON.stringify(events));

  const dimensionRows=[];
  ['GRADE','SUBJECT','PUBLISHER','CARTRIDGE'].forEach(dimension=>{
    Object.keys(dims[dimension]).sort().forEach(key=>{
      let label=key;
      if(dimension==='CARTRIDGE'){
        label=cartridgeLabelChoice[key]&&cartridgeLabelChoice[key].label
          ? cartridgeLabelChoice[key].label
          : key;
      }
      dimensionRows.push({
        dimension,
        dimensionKey:key,
        displayLabel:label,
        count:dims[dimension][key]
      });
    });
  });

  return {
    sourceEventCount:events.length,
    sourceU3EventCount,
    sourceLegacyEventCount,
    sourceEventIdDigest,
    sourceContentDigest,
    duplicateEventIdCount:duplicateDiagnostics.duplicateEventIdCount,
    duplicateRowCount:duplicateDiagnostics.duplicateRowCount,
    duplicateEventIdDigest:duplicateDiagnostics.duplicateEventIdDigest,
    totals:{
      eventCount:events.length,
      soloCount:solo,
      teamCount:team,
      team2Count:teamCounts[2],
      team3Count:teamCounts[3],
      team4Count:teamCounts[4],
      team5Count:teamCounts[5],
      team6Count:teamCounts[6]
    },
    dimensions:dimensionRows
  };
}

function smqUsageManifestRowsU3S_(manifestSh){
  if(manifestSh.getLastRow()<2)return [];
  return manifestSh.getRange(
    2,1,manifestSh.getLastRow()-1,SMQ_USAGE_MANIFEST_HEADERS_U3S.length
  ).getValues();
}

function smqUsageNextGenerationSeqU3S_(manifestSh,dateKey){
  let max=0;
  smqUsageManifestRowsU3S_(manifestSh).forEach(r=>{
    if(smqUsageStoredDateKeyU3S_(r[0])===dateKey){
      const n=Number(r[1])||0;
      if(n>max)max=n;
    }
  });
  return max+1;
}

function smqUsageGenerationIdU3S_(dateKey,seq){
  return dateKey.replace(/-/g,'')+'-g'+String(seq).padStart(6,'0');
}

function smqUsageFindManifestRowU3S_(manifestSh,dateKey,generation){
  const rows=smqUsageManifestRowsU3S_(manifestSh);
  for(let i=0;i<rows.length;i++){
    if(
      smqUsageStoredDateKeyU3S_(rows[i][0])===dateKey &&
      String(rows[i][2]||'')===generation
    ){
      return {rowNumber:i+2,row:rows[i]};
    }
  }
  return null;
}

function smqUsageUpdateManifestU3S_(manifestSh,rowNumber,patch){
  const headerIndex=Object.create(null);
  SMQ_USAGE_MANIFEST_HEADERS_U3S.forEach((h,i)=>headerIndex[h]=i+1);
  Object.keys(patch).forEach(k=>{
    if(!headerIndex[k])throw new Error('USAGE_MANIFEST_FIELD_INVALID:'+k);
    manifestSh.getRange(rowNumber,headerIndex[k]).setValue(patch[k]);
  });
}

function smqUsageLatestCompleteManifestU3S_(manifestSh,dateKey,schemaVersion){
  const expectedSchema=String(schemaVersion||SMQ_USAGE_ROLLUP_SCHEMA_U3S);
  const rows=smqUsageManifestRowsU3S_(manifestSh);
  const candidates=[];
  rows.forEach((r,i)=>{
    if(
      smqUsageStoredDateKeyU3S_(r[0])===dateKey &&
      String(r[3]||'')===expectedSchema &&
      String(r[4]||'').toUpperCase()==='COMPLETE' &&
      String(r[15]||'').toUpperCase()!=='TRUE'
    ){
      candidates.push({
        rowNumber:i+2,
        date:smqUsageStoredDateKeyU3S_(r[0]),
        generationSeq:Number(r[1])||0,
        generation:String(r[2]||''),
        schemaVersion:String(r[3]||''),
        status:String(r[4]||''),
        cutoffLastRow:Number(r[5])||1,
        sourceEventCount:Number(r[7])||0,
        sourceU3EventCount:Number(r[8])||0,
        sourceLegacyEventCount:Number(r[9])||0,
        sourceEventIdDigest:String(r[10]||''),
        sourceContentDigest:String(r[11]||''),
        needsRebuild:String(r[15]||'').toUpperCase()==='TRUE'
      });
    }
  });

  candidates.sort((a,b)=>
    b.generationSeq-a.generationSeq ||
    b.generation.localeCompare(a.generation)
  );
  return candidates[0]||null;
}

/* R14-V2 P0-C1: every V1/V2 writer sharing these three sheets must reserve,
   append and flush under the SAME ScriptLock. Snapshot calculation and
   generation read-back are deliberately outside this short write section.
   Other GAS script projects do not share this ScriptLock. */
function smqUsageWriteGenerationRowsU3S_(
  totalsSh,dimsSh,dateKey,generationSeq,generation,schema,snapshot,createdAt
){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw new Error('USAGE_ROLLUP_GENERATION_WRITE_LOCK_TIMEOUT');
  try{
    totalsSh.appendRow([
      dateKey,generationSeq,generation,schema,
      snapshot.totals.eventCount,
      snapshot.totals.soloCount,
      snapshot.totals.teamCount,
      snapshot.totals.team2Count,
      snapshot.totals.team3Count,
      snapshot.totals.team4Count,
      snapshot.totals.team5Count,
      snapshot.totals.team6Count,
      createdAt
    ]);
    if(snapshot.dimensions.length){
      const rows=snapshot.dimensions.map(d=>[
        dateKey,generationSeq,generation,schema,
        d.dimension,d.dimensionKey,d.displayLabel,d.count,createdAt
      ]);
      // getLastRow, setValues and flush must remain within this lock.
      dimsSh.getRange(
        dimsSh.getLastRow()+1,1,rows.length,SMQ_USAGE_DIM_HEADERS_U3S.length
      ).setValues(rows);
    }
    SpreadsheetApp.flush();
  }finally{
    lock.releaseLock();
  }
}

function smqUsageReadGenerationTotalsU3S_(sh,dateKey,generation){
  if(sh.getLastRow()<2)return null;
  const rows=sh.getRange(
    2,1,sh.getLastRow()-1,SMQ_USAGE_TOTALS_HEADERS_U3S.length
  ).getValues();
  const matches=rows.filter(r=>
    smqUsageStoredDateKeyU3S_(r[0])===dateKey &&
    String(r[2]||'')===generation
  );
  if(matches.length!==1)return null;
  const r=matches[0];
  return {
    eventCount:Number(r[4])||0,
    soloCount:Number(r[5])||0,
    teamCount:Number(r[6])||0,
    team2Count:Number(r[7])||0,
    team3Count:Number(r[8])||0,
    team4Count:Number(r[9])||0,
    team5Count:Number(r[10])||0,
    team6Count:Number(r[11])||0
  };
}

function smqUsageReadGenerationDimensionsU3S_(sh,dateKey,generation){
  if(sh.getLastRow()<2)return [];
  const rows=sh.getRange(
    2,1,sh.getLastRow()-1,SMQ_USAGE_DIM_HEADERS_U3S.length
  ).getValues();

  return rows
    .filter(r=>smqUsageStoredDateKeyU3S_(r[0])===dateKey&&String(r[2]||'')===generation)
    .map(r=>({
      dimension:String(r[4]||''),
      dimensionKey:String(r[5]||''),
      displayLabel:String(r[6]||''),
      count:Number(r[7])||0
    }))
    .sort((a,b)=>
      a.dimension.localeCompare(b.dimension) ||
      a.dimensionKey.localeCompare(b.dimensionKey)
    );
}

function smqUsageSameJsonU3S_(a,b){
  return JSON.stringify(a)===JSON.stringify(b);
}

function smqUsageVerifyGenerationU3S_(totalsSh,dimsSh,dateKey,generation,snapshot){
  const storedTotals=smqUsageReadGenerationTotalsU3S_(totalsSh,dateKey,generation);
  const storedDims=smqUsageReadGenerationDimensionsU3S_(dimsSh,dateKey,generation);
  const expectedDims=snapshot.dimensions.slice().sort((a,b)=>
    a.dimension.localeCompare(b.dimension) ||
    a.dimensionKey.localeCompare(b.dimensionKey)
  );

  const totalsOk=!!storedTotals&&smqUsageSameJsonU3S_(storedTotals,snapshot.totals);
  const dimensionsOk=smqUsageSameJsonU3S_(storedDims,expectedDims);

  return {
    ok:totalsOk&&dimensionsOk,
    totalsOk,
    dimensionsOk,
    storedTotals,
    expectedTotals:snapshot.totals,
    storedDimensionCount:storedDims.length,
    expectedDimensionCount:expectedDims.length
  };
}

/* SEC-PROD-02 P0-B G1' — guarded automatic shadow rollup only.
   Anonymous callers can still reach the public daily handler; this guard
   limits repeated computation, but it is NOT authentication. */
const SMQ_USAGE_AUTO_MAX_ATTEMPTS_U3S_ = 3;
const SMQ_USAGE_AUTO_COOLDOWN_MS_U3S_ = 30*60*1000;
const SMQ_USAGE_PREPARING_MAX_AGE_MS_U3S_ = 15*60*1000;

function smqUsageStartedAtMsU3S_(v){
  if(v==null||v==='')return null;
  const d=v instanceof Date?v:new Date(v);
  const t=d.getTime();
  return Number.isFinite(t)?t:null;
}

/* Must be invoked while holding the SAME script lock that appends PREPARING.
   Returns an idempotent skip result, or null when a generation may be claimed. */
function smqUsageGuardStartU3S_(manifestSh,dateKey,now,isAutomatic){
  const rows=smqUsageManifestRowsU3S_(manifestSh)
    .map((r,i)=>({r,rowNumber:i+2,seq:Number(r[1])||0}))
    .filter(x=>smqUsageStoredDateKeyU3S_(x.r[0])===dateKey)
    .sort((a,b)=>b.seq-a.seq || b.rowNumber-a.rowNumber);
  const skip=reason=>({ok:true,skipped:true,date:dateKey,reason});
  const latest=rows[0];
  if(!latest)return null;
  const status=String(latest.r[4]||'').toUpperCase();
  const needsRebuild=String(latest.r[15]||'').toUpperCase()==='TRUE';

  if(isAutomatic&&status==='COMPLETE'&&!needsRebuild){
    return skip('ALREADY_COMPLETE');
  }
  if(status==='PREPARING'){
    const since=smqUsageStartedAtMsU3S_(latest.r[12]);
    if(since===null||since>now.getTime())return skip('PREPARING_TIMESTAMP_INVALID');
    if(now.getTime()-since<SMQ_USAGE_PREPARING_MAX_AGE_MS_U3S_){
      return skip('IN_PROGRESS');
    }
    /* Apps Script executions are limited in duration; abandon a clearly
       stale PREPARING row without replacing any prior COMPLETE generation. */
    smqUsageUpdateManifestU3S_(manifestSh,latest.rowNumber,{
      status:'FAILED',completedAt:now,notes:(String(latest.r[16]||'').startsWith('AUTO;')?'AUTO;':'')+'STALE_PREPARING'
    });
    SpreadsheetApp.flush();
  }else if(!['FAILED','COMPLETE'].includes(status)){
    return skip('UNKNOWN_MANIFEST_STATUS');
  }

  /* A prior valid COMPLETE stays authoritative even if a later attempt failed.
     This prevents automatic calls from needlessly regenerating an older day. */
  if(isAutomatic&&rows.some(x=>
    String(x.r[4]||'').toUpperCase()==='COMPLETE'&&
    String(x.r[15]||'').toUpperCase()!=='TRUE'
  ))return skip('ALREADY_COMPLETE');

  if(!isAutomatic)return null; /* Explicit private manual repair is separate. */
  const today=smqUsageDateKeyU3S_(now);
  const attempts=rows.filter(x=>
    String(x.r[16]||'').startsWith('AUTO;')&&
    smqUsageStartedAtMsU3S_(x.r[12])!==null&&
    smqUsageDateKeyU3S_(new Date(smqUsageStartedAtMsU3S_(x.r[12])))===today
  );
  if(attempts.length>=SMQ_USAGE_AUTO_MAX_ATTEMPTS_U3S_)return skip('RETRY_BUDGET');
  const lastTime=smqUsageStartedAtMsU3S_(latest.r[12]);
  if(status==='FAILED'||status==='PREPARING'){
    if(lastTime!==null && now.getTime()-lastTime<SMQ_USAGE_AUTO_COOLDOWN_MS_U3S_){
      return skip('RETRY_BUDGET');
    }
  }
  return null;
}

/* G2 observation only. Do not log, persist, or return the trigger UID. */
function smqUsageObserveTriggerUidU3S_(e){
  let match='UNAVAILABLE';
  const uidType=e?typeof e.triggerUid:'undefined';
  if(!e||!(uidType==='string'||(uidType==='number'&&Number.isFinite(e.triggerUid)))){
    match='ABSENT';
  }else{
    const uid=String(e.triggerUid);
    try{
      const handler='runUsageRollupDailyU3S1';
      const found=ScriptApp.getProjectTriggers().some(t=>
        t.getHandlerFunction()===handler &&
        String(t.getUniqueId())===uid
      );
      match=found?'MATCH':'MISMATCH';
    }catch(_ignored){match='UNAVAILABLE';}
  }
  console.log('SMQ_USAGE_ROLLUP_TRIGGER_UID_MATCH='+(match==='MATCH'));
}

function runUsageRollupDateU3S1_(dateKey,automaticRun){
  const isAutomatic=automaticRun===true;
  const target=smqUsageValidatePastDateU3S_(dateKey);
  const ss=smqUsageRollupStorageU3S_();
  const eventSh=ss.getSheetByName(SMQ_USAGE_SHEET_U1);
  if(!eventSh)throw new Error('USAGE_SHEET_NOT_FOUND');

  const totalsSh=smqUsageEnsureSheetU3S_(
    ss,SMQ_USAGE_ROLLUP_TOTALS_SHEET_U3S,SMQ_USAGE_TOTALS_HEADERS_U3S
  );
  const dimsSh=smqUsageEnsureSheetU3S_(
    ss,SMQ_USAGE_ROLLUP_DIMENSIONS_SHEET_U3S,SMQ_USAGE_DIM_HEADERS_U3S
  );
  const manifestSh=smqUsageEnsureSheetU3S_(
    ss,SMQ_USAGE_ROLLUP_MANIFEST_SHEET_U3S,SMQ_USAGE_MANIFEST_HEADERS_U3S
  );

  const startedAt=new Date();
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw new Error('USAGE_ROLLUP_CUTOFF_LOCK_TIMEOUT');

  let generationSeq,generation,manifestRow,cutoffLastRow,cutoffAcceptedAt;
  try{
    /* Check status and claim must happen under ONE lock, before append.
       Returning from try still releases the lock in finally. */
    const skipResult=smqUsageGuardStartU3S_(manifestSh,target,new Date(),isAutomatic);
    if(skipResult)return skipResult;
    /* Same lock as recordUsageStartU1(). Append timestamp/date/flush must finish
       before writers release it. The finalizer records its accepted cutoff here.
       Full calculation happens AFTER release. */
    SpreadsheetApp.flush();
    cutoffAcceptedAt=new Date();
    cutoffLastRow=eventSh.getLastRow();

    generationSeq=smqUsageNextGenerationSeqU3S_(manifestSh,target);
    generation=smqUsageGenerationIdU3S_(target,generationSeq);

    manifestSh.appendRow([
      target,generationSeq,generation,SMQ_USAGE_ROLLUP_SCHEMA_U3S,'PREPARING',
      cutoffLastRow,cutoffAcceptedAt,
      '','','','','',
      startedAt,'','','FALSE',isAutomatic?'AUTO;':'MANUAL;'
    ]);
    SpreadsheetApp.flush();
    manifestRow=manifestSh.getLastRow();
  }finally{
    lock.releaseLock();
  }

  let snapshot;
  try{
    snapshot=smqUsageBuildRawSnapshotU3S_(eventSh,target,cutoffLastRow);
    const createdAt=new Date();

    smqUsageWriteGenerationRowsU3S_(
      totalsSh,dimsSh,target,generationSeq,generation,
      SMQ_USAGE_ROLLUP_SCHEMA_U3S,snapshot,createdAt
    );

    const verify=smqUsageVerifyGenerationU3S_(
      totalsSh,dimsSh,target,generation,snapshot
    );
    if(!verify.ok){
      throw new Error(
        'USAGE_ROLLUP_READBACK_MISMATCH:'+JSON.stringify({
          totalsOk:verify.totalsOk,
          dimensionsOk:verify.dimensionsOk,
          storedDimensionCount:verify.storedDimensionCount,
          expectedDimensionCount:verify.expectedDimensionCount
        })
      );
    }

    const verifiedAt=new Date();

    smqUsageUpdateManifestU3S_(manifestSh,manifestRow,{
      sourceEventCount:snapshot.sourceEventCount,
      sourceU3EventCount:snapshot.sourceU3EventCount,
      sourceLegacyEventCount:snapshot.sourceLegacyEventCount,
      sourceEventIdDigest:snapshot.sourceEventIdDigest,
      sourceContentDigest:snapshot.sourceContentDigest,
      verifiedAt
    });
    SpreadsheetApp.flush();

    /* COMPLETE is the final publish marker.
       Write/flush completedAt first; publish status only after that succeeds.
       A failed newer generation never replaces an older COMPLETE. */
    smqUsageUpdateManifestU3S_(manifestSh,manifestRow,{
      completedAt:new Date(),
      needsRebuild:'FALSE'
    });
    SpreadsheetApp.flush();

    // Ensure V1 manifest evidence is readable BEFORE publishing COMPLETE.
    const pending=smqUsageFindManifestRowU3S_(manifestSh,target,generation);
    const r=pending&&pending.row;
    if(!r ||
       Number(r[1])!==generationSeq ||
       String(r[3])!==SMQ_USAGE_ROLLUP_SCHEMA_U3S ||
       String(r[4]).toUpperCase()!=='PREPARING' ||
       Number(r[5])!==cutoffLastRow ||
       Number(r[7])!==snapshot.sourceEventCount ||
       Number(r[8])!==snapshot.sourceU3EventCount ||
       Number(r[9])!==snapshot.sourceLegacyEventCount ||
       String(r[10]||'')!==snapshot.sourceEventIdDigest ||
       String(r[11]||'')!==snapshot.sourceContentDigest ||
       !r[13] || !r[14] ||
       String(r[15]).trim().toUpperCase()!=='FALSE'){
      throw new Error('USAGE_ROLLUP_V1_COMMIT_READY_READBACK_MISMATCH');
    }

    // No post-COMPLETE read-back, and the FAILED cleanup catch ends here.

  }catch(err){
    try{
      smqUsageUpdateManifestU3S_(manifestSh,manifestRow,{
        status:'FAILED',
        completedAt:new Date(),
        notes:((isAutomatic?'AUTO;':'MANUAL;')+String(err&&err.message||err)).slice(0,500)
      });
      SpreadsheetApp.flush();
    }catch(_ignored){}
    throw err;
  }
  try{
    smqUsageUpdateManifestU3S_(manifestSh,manifestRow,{status:'COMPLETE'});
    SpreadsheetApp.flush();
  }catch(err){
    // The final status may be durable even if its ACK or flush failed.
    // Preserve this generation and require a read-only parity check.
    const safe=smqUsageRecoverySafeErrorU3S_(err);
    throw new Error('USAGE_ROLLUP_V1_PUBLISH_UNKNOWN;code='+safe.code+
      ';digest='+safe.errorDigest);
  }
    return {
      ok:true,
      date:target,
      generationSeq,
      generation,
      status:'COMPLETE',
      cutoffLastRow,
      sourceEventCount:snapshot.sourceEventCount,
      sourceU3EventCount:snapshot.sourceU3EventCount,
      sourceLegacyEventCount:snapshot.sourceLegacyEventCount,
      sourceEventIdDigest:snapshot.sourceEventIdDigest,
      sourceContentDigest:snapshot.sourceContentDigest,
      sourceOfTruth:'RAW_EVENT_LOG'
    };
}

/* =========================================================
   R14-V2 isolated duplicate-event recovery.

   Security boundary:
   - Every recovery/diagnostic entry point ends in "_", so it is not exposed
     through google.script.run.
   - The public daily handler is NOT reused for a date-selected repair.
   - This code never deletes or edits EVENT_LOG rows.
   - V1 FAILED rows remain append-only evidence.
   ========================================================= */

function smqUsageRecoveryRowsU3S_(manifestSh,dateKey){
  return smqUsageManifestRowsU3S_(manifestSh)
    .map((r,i)=>({r,rowNumber:i+2,seq:Number(r[1])||0}))
    .filter(x=>smqUsageStoredDateKeyU3S_(x.r[0])===dateKey)
    .sort((a,b)=>b.seq-a.seq||b.rowNumber-a.rowNumber);
}

function smqUsageIsDuplicateFailureU3S_(row){
  return String(row[3]||'')===SMQ_USAGE_ROLLUP_SCHEMA_U3S &&
    String(row[4]||'').toUpperCase()==='FAILED' &&
    String(row[16]||'').indexOf('USAGE_ROLLUP_DUPLICATE_EVENT_ID')>=0;
}

function smqUsageRecoveryClaimDecisionU3S_(manifestSh,dateKey){
  const rows=smqUsageRecoveryRowsU3S_(manifestSh,dateKey);
  // An invalid status is evidence, not an instruction to try a fresh generation.
  // Detect it before COMPLETE/PREPARING skips so it is never silently hidden.
  if(rows.some(x=>!['FAILED','COMPLETE','PREPARING'].includes(
    String(x.r[4]||'').trim().toUpperCase()
  ))){
    throw new Error('USAGE_ROLLUP_RECOVERY_UNKNOWN_MANIFEST_STATUS');
  }
  const existingComplete=rows.find(x=>
    String(x.r[3]||'')===SMQ_USAGE_ROLLUP_RECOVERY_SCHEMA_U3S &&
    String(x.r[4]||'').toUpperCase()==='COMPLETE' &&
    String(x.r[15]||'').toUpperCase()!=='TRUE'
  );
  if(existingComplete){
    return {
      skip:{
        ok:true,
        skipped:true,
        date:dateKey,
        generationSeq:existingComplete.seq,
        generation:String(existingComplete.r[2]||''),
        schemaVersion:SMQ_USAGE_ROLLUP_RECOVERY_SCHEMA_U3S,
        policy:SMQ_USAGE_ROLLUP_RECOVERY_POLICY_U3S,
        reason:'ALREADY_RECOVERED'
      }
    };
  }

  const existingV1Complete=rows.find(x=>
    String(x.r[3]||'')===SMQ_USAGE_ROLLUP_SCHEMA_U3S &&
    String(x.r[4]||'').toUpperCase()==='COMPLETE' &&
    String(x.r[15]||'').toUpperCase()!=='TRUE'
  );
  if(existingV1Complete){
    return {
      skip:{
        ok:true,
        skipped:true,
        date:dateKey,
        generationSeq:existingV1Complete.seq,
        generation:String(existingV1Complete.r[2]||''),
        schemaVersion:SMQ_USAGE_ROLLUP_SCHEMA_U3S,
        policy:'FAIL',
        reason:'ALREADY_COMPLETE'
      }
    };
  }

  const inProgress=rows.find(x=>
    String(x.r[3]||'')===SMQ_USAGE_ROLLUP_RECOVERY_SCHEMA_U3S &&
    String(x.r[4]||'').toUpperCase()==='PREPARING'
  );
  if(inProgress){
    return {
      skip:{
        ok:true,
        skipped:true,
        date:dateKey,
        generationSeq:inProgress.seq,
        generation:String(inProgress.r[2]||''),
        schemaVersion:SMQ_USAGE_ROLLUP_RECOVERY_SCHEMA_U3S,
        policy:SMQ_USAGE_ROLLUP_RECOVERY_POLICY_U3S,
        reason:'RECOVERY_IN_PROGRESS'
      }
    };
  }

  const failedV1=rows.find(x=>smqUsageIsDuplicateFailureU3S_(x.r));
  if(!failedV1){
    throw new Error('USAGE_ROLLUP_RECOVERY_DUPLICATE_FAILURE_NOT_FOUND');
  }
  return {failedV1};
}

function smqUsageRecoverySuccessNoteU3S_(snapshot){
  return [
    'RECOVERY',
    'policy='+SMQ_USAGE_ROLLUP_RECOVERY_POLICY_U3S,
    'duplicateEventIdCount='+snapshot.duplicateEventIdCount,
    'duplicateRowCount='+snapshot.duplicateRowCount,
    'duplicateEventIdDigest='+snapshot.duplicateEventIdDigest
  ].join(';').slice(0,500);
}

function smqUsageRecoverySafeErrorU3S_(err){
  const raw=String(err&&err.message||err||'UNKNOWN');
  const code=(raw.split(/[;:]/)[0].replace(/[^A-Z0-9_]/gi,'_')||'UNKNOWN').slice(0,80);
  const errorDigest=smqUsageUtf8DigestU3S_(raw);
  return {
    code,
    errorDigest,
    note:(
      'RECOVERY;policy='+SMQ_USAGE_ROLLUP_RECOVERY_POLICY_U3S+
      ';FAILED;code='+code+';errorDigest='+errorDigest
    ).slice(0,500)
  };
}

function smqUsageVerifyRecoveryManifestU3S_(
  manifestSh,dateKey,generationSeq,generation,cutoffLastRow,snapshot,notes,status
){
  const found=smqUsageFindManifestRowU3S_(manifestSh,dateKey,generation);
  if(!found)return {ok:false,reason:'MANIFEST_NOT_FOUND'};
  const r=found.row;
  const expectedStatus=String(status||'PREPARING').toUpperCase();
  const ok=
    Number(r[1])===Number(generationSeq) &&
    String(r[3]||'')===SMQ_USAGE_ROLLUP_RECOVERY_SCHEMA_U3S &&
    String(r[4]||'').toUpperCase()===expectedStatus &&
    Number(r[5])===Number(cutoffLastRow) &&
    Number(r[7])===snapshot.sourceEventCount &&
    Number(r[8])===snapshot.sourceU3EventCount &&
    Number(r[9])===snapshot.sourceLegacyEventCount &&
    String(r[10]||'')===snapshot.sourceEventIdDigest &&
    String(r[11]||'')===snapshot.sourceContentDigest &&
    !!r[14] &&
    String(r[15]).trim().toUpperCase()==='FALSE' &&
    String(r[16]||'')===notes &&
    (expectedStatus!=='COMPLETE'||!!r[13]);
  return {
    ok,
    reason:ok?'OK':'MANIFEST_READBACK_MISMATCH',
    rowNumber:found.rowNumber,
    completedAtPresent:!!r[13]
  };
}

/* Private, date-selected administrator recovery core. A separately approved
   temporary administrator runner may call this function, but it must never be
   renamed or wrapped as a public google.script.run RPC. */
function runUsageRollupRecoveryDateU3S1_(dateKey){
  const target=smqUsageValidatePastDateU3S_(dateKey);
  const ss=smqUsageRollupStorageU3S_();
  const eventSh=ss.getSheetByName(SMQ_USAGE_SHEET_U1);
  if(!eventSh)throw new Error('USAGE_SHEET_NOT_FOUND');

  const totalsSh=smqUsageRequireSheetU3S_(
    ss,SMQ_USAGE_ROLLUP_TOTALS_SHEET_U3S,SMQ_USAGE_TOTALS_HEADERS_U3S
  );
  const dimsSh=smqUsageRequireSheetU3S_(
    ss,SMQ_USAGE_ROLLUP_DIMENSIONS_SHEET_U3S,SMQ_USAGE_DIM_HEADERS_U3S
  );
  const manifestSh=smqUsageRequireSheetU3S_(
    ss,SMQ_USAGE_ROLLUP_MANIFEST_SHEET_U3S,SMQ_USAGE_MANIFEST_HEADERS_U3S
  );

  const startedAt=new Date();
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw new Error('USAGE_ROLLUP_RECOVERY_LOCK_TIMEOUT');

  let generationSeq,generation,manifestRow,cutoffLastRow,cutoffAcceptedAt;
  try{
    const decision=smqUsageRecoveryClaimDecisionU3S_(manifestSh,target);
    if(decision.skip)return decision.skip;

    SpreadsheetApp.flush();
    cutoffAcceptedAt=new Date();
    cutoffLastRow=eventSh.getLastRow();
    generationSeq=smqUsageNextGenerationSeqU3S_(manifestSh,target);
    generation=smqUsageGenerationIdU3S_(target,generationSeq);

    manifestSh.appendRow([
      target,generationSeq,generation,SMQ_USAGE_ROLLUP_RECOVERY_SCHEMA_U3S,'PREPARING',
      cutoffLastRow,cutoffAcceptedAt,
      '','','','','',
      startedAt,'','','FALSE',
      'RECOVERY;policy='+SMQ_USAGE_ROLLUP_RECOVERY_POLICY_U3S
    ]);
    SpreadsheetApp.flush();
    manifestRow=manifestSh.getLastRow();
  }finally{
    lock.releaseLock();
  }

  let snapshot;
  try{
    snapshot=smqUsageBuildRawSnapshotU3S_(
      eventSh,target,cutoffLastRow,
      {duplicatePolicy:SMQ_USAGE_ROLLUP_RECOVERY_POLICY_U3S}
    );
    if(snapshot.duplicateEventIdCount<1){
      throw new Error('USAGE_ROLLUP_RECOVERY_DUPLICATES_NOT_PRESENT');
    }

    const createdAt=new Date();
    smqUsageWriteGenerationRowsU3S_(
      totalsSh,dimsSh,target,generationSeq,generation,
      SMQ_USAGE_ROLLUP_RECOVERY_SCHEMA_U3S,snapshot,createdAt
    );

    const generationVerify=smqUsageVerifyGenerationU3S_(
      totalsSh,dimsSh,target,generation,snapshot
    );
    if(!generationVerify.ok){
      throw new Error('USAGE_ROLLUP_RECOVERY_GENERATION_READBACK_MISMATCH');
    }

    const notes=smqUsageRecoverySuccessNoteU3S_(snapshot);
    smqUsageUpdateManifestU3S_(manifestSh,manifestRow,{
      sourceEventCount:snapshot.sourceEventCount,
      sourceU3EventCount:snapshot.sourceU3EventCount,
      sourceLegacyEventCount:snapshot.sourceLegacyEventCount,
      sourceEventIdDigest:snapshot.sourceEventIdDigest,
      sourceContentDigest:snapshot.sourceContentDigest,
      verifiedAt:new Date(),
      needsRebuild:'FALSE',
      notes
    });
    SpreadsheetApp.flush();

    const manifestVerify=smqUsageVerifyRecoveryManifestU3S_(
      manifestSh,target,generationSeq,generation,cutoffLastRow,
      snapshot,notes,'PREPARING'
    );
    if(!manifestVerify.ok){
      throw new Error('USAGE_ROLLUP_RECOVERY_'+manifestVerify.reason);
    }

    /* Publication contract: every fallible verification happens while the
       row is still PREPARING. COMPLETE is one final status-cell write and no
       read/verification follows it. Therefore an ambiguous final write can
       leave only PREPARING/FAILED, or a COMPLETE that was fully preverified. */
    smqUsageUpdateManifestU3S_(manifestSh,manifestRow,{completedAt:new Date()});
    SpreadsheetApp.flush();

    const commitReady=smqUsageVerifyRecoveryManifestU3S_(
      manifestSh,target,generationSeq,generation,cutoffLastRow,
      snapshot,notes,'PREPARING'
    );
    if(!commitReady.ok||!commitReady.completedAtPresent){
      throw new Error('USAGE_ROLLUP_RECOVERY_COMMIT_READY_READBACK_FAILED');
    }

    // Fully verified; exit the error-cleanup region before publication.
  }catch(err){
    const safe=smqUsageRecoverySafeErrorU3S_(err);
    try{
      smqUsageUpdateManifestU3S_(manifestSh,manifestRow,{
        status:'FAILED',completedAt:new Date(),notes:safe.note
      });
      SpreadsheetApp.flush();
    }catch(_ignored){}
    throw new Error(
      'USAGE_ROLLUP_RECOVERY_FAILED;code='+safe.code+';digest='+safe.errorDigest
    );
  }
  try{
    smqUsageUpdateManifestU3S_(manifestSh,manifestRow,{status:'COMPLETE'});
    SpreadsheetApp.flush();
  }catch(err){
    // No writes to FAILED here: the final status may be durable already.
    const safe=smqUsageRecoverySafeErrorU3S_(err);
    throw new Error(
      'USAGE_ROLLUP_RECOVERY_PUBLISH_UNKNOWN;code='+safe.code+
      ';digest='+safe.errorDigest
    );
  }
    return {
      ok:true,
      date:target,
      generationSeq,
      generation,
      schemaVersion:SMQ_USAGE_ROLLUP_RECOVERY_SCHEMA_U3S,
      status:'COMPLETE',
      policy:SMQ_USAGE_ROLLUP_RECOVERY_POLICY_U3S,
      cutoffLastRow,
      sourceEventCount:snapshot.sourceEventCount,
      sourceU3EventCount:snapshot.sourceU3EventCount,
      sourceLegacyEventCount:snapshot.sourceLegacyEventCount,
      sourceEventIdDigest:snapshot.sourceEventIdDigest,
      sourceContentDigest:snapshot.sourceContentDigest,
      duplicateEventIdCount:snapshot.duplicateEventIdCount,
      duplicateRowCount:snapshot.duplicateRowCount,
      duplicateEventIdDigest:snapshot.duplicateEventIdDigest,
      sourceOfTruth:'RAW_EVENT_LOG',
      rawDeletion:'HOLD'
    };
}

/* Read-only duplicate-failure diagnosis. Raw eventIds and old manifest notes
   are deliberately excluded from the result. */
function smqUsageDiagnoseFailedDuplicateDatesU3S1_(){
  const ss=smqUsageRollupStorageU3S_();
  const eventSh=ss.getSheetByName(SMQ_USAGE_SHEET_U1);
  const manifestSh=ss.getSheetByName(SMQ_USAGE_ROLLUP_MANIFEST_SHEET_U3S);
  if(!eventSh||!manifestSh)throw new Error('USAGE_ROLLUP_NOT_SETUP');

  const failures=smqUsageManifestRowsU3S_(manifestSh)
    .map((r,i)=>({r,rowNumber:i+2,seq:Number(r[1])||0}))
    .filter(x=>smqUsageIsDuplicateFailureU3S_(x.r))
    .sort((a,b)=>b.seq-a.seq||b.rowNumber-a.rowNumber);
  const seenDates=Object.create(null);
  const result=[];
  failures.forEach(x=>{
    const dateKey=smqUsageStoredDateKeyU3S_(x.r[0]);
    if(!dateKey||seenDates[dateKey])return;
    seenDates[dateKey]=true;
    const cutoffLastRow=Math.max(1,Number(x.r[5])||1);
    const snapshot=smqUsageBuildRawSnapshotU3S_(
      eventSh,dateKey,cutoffLastRow,
      {duplicatePolicy:SMQ_USAGE_ROLLUP_RECOVERY_POLICY_U3S}
    );
    result.push({
      date:dateKey,
      generationSeq:x.seq,
      cutoffLastRow,
      sourceEventCount:snapshot.sourceEventCount,
      sourceEventIdDigest:snapshot.sourceEventIdDigest,
      sourceContentDigest:snapshot.sourceContentDigest,
      duplicateEventIdCount:snapshot.duplicateEventIdCount,
      duplicateRowCount:snapshot.duplicateRowCount,
      duplicateEventIdDigest:snapshot.duplicateEventIdDigest,
      writeCount:0
    });
  });
  return result;
}

/* Read-only post-recovery parity for V2. It does not mark needsRebuild or
   mutate any sheet; remediation remains a separately approved operation. */
function smqUsageVerifyRecoveryDateU3S1_(dateKey){
  const target=smqUsageValidatePastDateU3S_(dateKey);
  const ss=smqUsageRollupStorageU3S_();
  const eventSh=ss.getSheetByName(SMQ_USAGE_SHEET_U1);
  const totalsSh=ss.getSheetByName(SMQ_USAGE_ROLLUP_TOTALS_SHEET_U3S);
  const dimsSh=ss.getSheetByName(SMQ_USAGE_ROLLUP_DIMENSIONS_SHEET_U3S);
  const manifestSh=ss.getSheetByName(SMQ_USAGE_ROLLUP_MANIFEST_SHEET_U3S);
  if(!eventSh||!totalsSh||!dimsSh||!manifestSh){
    throw new Error('USAGE_ROLLUP_NOT_SETUP');
  }
  const selected=smqUsageLatestCompleteManifestU3S_(
    manifestSh,target,SMQ_USAGE_ROLLUP_RECOVERY_SCHEMA_U3S
  );
  if(!selected)throw new Error('USAGE_ROLLUP_RECOVERY_COMPLETE_NOT_FOUND');
  const snapshot=smqUsageBuildRawSnapshotU3S_(
    eventSh,target,selected.cutoffLastRow,
    {duplicatePolicy:SMQ_USAGE_ROLLUP_RECOVERY_POLICY_U3S}
  );
  const generationVerify=smqUsageVerifyGenerationU3S_(
    totalsSh,dimsSh,target,selected.generation,snapshot
  );
  const digestOk=
    snapshot.sourceEventCount===selected.sourceEventCount &&
    snapshot.sourceU3EventCount===selected.sourceU3EventCount &&
    snapshot.sourceLegacyEventCount===selected.sourceLegacyEventCount &&
    snapshot.sourceEventIdDigest===selected.sourceEventIdDigest &&
    snapshot.sourceContentDigest===selected.sourceContentDigest;
  return {
    ok:digestOk&&generationVerify.ok,
    date:target,
    generationSeq:selected.generationSeq,
    generation:selected.generation,
    schemaVersion:SMQ_USAGE_ROLLUP_RECOVERY_SCHEMA_U3S,
    policy:SMQ_USAGE_ROLLUP_RECOVERY_POLICY_U3S,
    digestOk,
    totalsOk:generationVerify.totalsOk,
    dimensionsOk:generationVerify.dimensionsOk,
    sourceEventCount:snapshot.sourceEventCount,
    duplicateEventIdCount:snapshot.duplicateEventIdCount,
    duplicateRowCount:snapshot.duplicateRowCount,
    duplicateEventIdDigest:snapshot.duplicateEventIdDigest,
    writeCount:0,
    sourceOfTruth:'RAW_EVENT_LOG',
    rawDeletion:'HOLD'
  };
}

function runUsageRollupYesterdayU3S1_(){
  return runUsageRollupDateU3S1_(smqUsageYesterdayKeyU3S_());
}

function runUsageRollupDailyU3S1(e){
  smqUsageObserveTriggerUidU3S_(e);
  return runUsageRollupDateU3S1_(smqUsageYesterdayKeyU3S_(),true);
}

function installUsageRollupDailyTriggerU3S1_(){
  const handler='runUsageRollupDailyU3S1';
  ScriptApp.getProjectTriggers().forEach(t=>{
    if(t.getHandlerFunction()===handler)ScriptApp.deleteTrigger(t);
  });

  const trigger=ScriptApp.newTrigger(handler)
    .timeBased()
    .atHour(0)
    .nearMinute(15)
    .everyDays(1)
    .inTimezone(SMQ_USAGE_ROLLUP_TZ_U3S)
    .create();

  return {
    ok:true,
    handler,
    timezone:SMQ_USAGE_ROLLUP_TZ_U3S,
    note:'00:15 is an operational safety window, not the correctness boundary.'
  };
}

function runUsageRollupParityDateU3S2_(dateKey){
  const target=smqUsageValidatePastDateU3S_(dateKey);
  const ss=smqUsageRollupStorageU3S_();
  const eventSh=ss.getSheetByName(SMQ_USAGE_SHEET_U1);
  const totalsSh=ss.getSheetByName(SMQ_USAGE_ROLLUP_TOTALS_SHEET_U3S);
  const dimsSh=ss.getSheetByName(SMQ_USAGE_ROLLUP_DIMENSIONS_SHEET_U3S);
  const manifestSh=ss.getSheetByName(SMQ_USAGE_ROLLUP_MANIFEST_SHEET_U3S);
  if(!eventSh||!totalsSh||!dimsSh||!manifestSh){
    throw new Error('USAGE_ROLLUP_NOT_SETUP');
  }

  const selected=smqUsageLatestCompleteManifestU3S_(manifestSh,target);
  if(!selected)throw new Error('USAGE_ROLLUP_COMPLETE_GENERATION_NOT_FOUND');

  const snapshot=smqUsageBuildRawSnapshotU3S_(
    eventSh,target,selected.cutoffLastRow
  );
  const verify=smqUsageVerifyGenerationU3S_(
    totalsSh,dimsSh,target,selected.generation,snapshot
  );

  const digestOk=
    snapshot.sourceEventCount===selected.sourceEventCount &&
    snapshot.sourceU3EventCount===selected.sourceU3EventCount &&
    snapshot.sourceLegacyEventCount===selected.sourceLegacyEventCount &&
    snapshot.sourceEventIdDigest===selected.sourceEventIdDigest &&
    snapshot.sourceContentDigest===selected.sourceContentDigest;

  const ok=digestOk&&verify.ok;

  if(!ok){
    smqUsageUpdateManifestU3S_(manifestSh,selected.rowNumber,{
      needsRebuild:'TRUE',
      notes:(
        'PARITY_MISMATCH '+
        new Date().toISOString()+
        ' digestOk='+digestOk+
        ' totalsOk='+verify.totalsOk+
        ' dimensionsOk='+verify.dimensionsOk
      ).slice(0,500)
    });
    SpreadsheetApp.flush();
  }

  return {
    ok,
    date:target,
    generationSeq:selected.generationSeq,
    generation:selected.generation,
    digestOk,
    totalsOk:verify.totalsOk,
    dimensionsOk:verify.dimensionsOk,
    sourceEventCount:snapshot.sourceEventCount,
    sourceU3EventCount:snapshot.sourceU3EventCount,
    sourceLegacyEventCount:snapshot.sourceLegacyEventCount,
    needsRebuild:!ok,
    rawReadMode:'SHADOW_FULL_PREFIX_SCAN_TO_CUTOFF',
    sourceOfTruth:'RAW_EVENT_LOG',
    rawDeletion:'HOLD'
  };
}

function runUsageRollupYesterdayParityU3S2_(){
  return runUsageRollupParityDateU3S2_(smqUsageYesterdayKeyU3S_());
}

function runUsageRollupLatestParityU3S2_(){
  const ss=smqUsageRollupStorageU3S_();
  const manifestSh=ss.getSheetByName(SMQ_USAGE_ROLLUP_MANIFEST_SHEET_U3S);
  if(!manifestSh||manifestSh.getLastRow()<2){
    throw new Error('USAGE_ROLLUP_COMPLETE_GENERATION_NOT_FOUND');
  }

  const rows=smqUsageManifestRowsU3S_(manifestSh);
  const dates=[...new Set(
    rows
      .filter(r=>
        String(r[3]||'')===SMQ_USAGE_ROLLUP_SCHEMA_U3S &&
        String(r[4]||'').toUpperCase()==='COMPLETE'
      )
      .map(r=>smqUsageStoredDateKeyU3S_(r[0]))
      .filter(Boolean)
  )].sort().reverse();

  if(!dates.length)throw new Error('USAGE_ROLLUP_COMPLETE_GENERATION_NOT_FOUND');
  return runUsageRollupParityDateU3S2_(dates[0]);
}

/**
 * Test-only helper for Astra's content-digest requirement.
 * It does NOT edit the sheet. It proves that changing an aggregate-bearing field
 * while preserving eventId changes the canonical content digest.
 */
function runUsageContentDigestSelfTestU3S2_(){
  const baseEvent=[{
    eventId:'same-event-id',
    timestampIso:'2026-09-23T12:00:00.000Z',
    date:'2026-09-23',
    repositoryKind:'PUBLIC',
    mode:'SOLO',
    teamCount:1,
    grade:'5',
    subject:'영어',
    publisher:'비상',
    cartridge:'A',
    cartridgeCount:1,
    cartridgeIds:['123'],
    publicRepositoryNamespace:'PUBLIC:test',
    usageSchemaVersion:'U3S1',
    cartridgeTitles:['A']
  }];

  const altered=JSON.parse(JSON.stringify(baseEvent));
  altered[0].mode='TEAM';
  altered[0].teamCount=4;

  const a=smqUsageUtf8DigestU3S_(JSON.stringify(baseEvent));
  const b=smqUsageUtf8DigestU3S_(JSON.stringify(altered));

  const result={
    ok:a!==b,
    sameEventId:true,
    digestChanged:a!==b,
    originalDigest:a,
    alteredDigest:b
  };

  console.log(JSON.stringify(result));

  /* Fail-closed self-test: Apps Script editor does not surface return values.
     With this assertion, "execution completed" itself is runtime evidence. */
  if(!result.ok || !result.digestChanged){
    throw new Error('USAGE_CONTENT_DIGEST_SELF_TEST_FAILED');
  }

  return result;
}
