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

function setupUsageRollupShadowU3S1(){
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
  map[k]=(map[k]||0)+(Number(inc)||0);
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

function smqUsageBuildRawSnapshotU3S_(eventSh,dateKey,cutoffLastRow){
  const rawRows=smqUsageReadEventRowsU3S_(eventSh,cutoffLastRow);
  const events=[];
  const seenEventIds={};
  const duplicateIds=[];
  let sourceLegacyEventCount=0;
  let sourceU3EventCount=0;

  const dims={
    GRADE:{},
    SUBJECT:{},
    PUBLISHER:{},
    CARTRIDGE:{}
  };
  const cartridgeLabelChoice={};

  let solo=0,team=0;
  const teamCounts={2:0,3:0,4:0,5:0,6:0};

  rawRows.forEach(row=>{
    const d=smqUsageCanonicalTextU3S_(row.display[2],20);
    const repo=smqUsageCanonicalTextU3S_(row.display[4],20).toUpperCase();
    if(d!==dateKey||repo!=='PUBLIC')return;

    const eventId=smqUsageCanonicalTextU3S_(row.display[0],80);
    if(!eventId)throw new Error('USAGE_ROLLUP_EVENT_ID_MISSING_ROW_'+row.rowNumber);
    if(seenEventIds[eventId]){
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

  if(duplicateIds.length){
    throw new Error(
      'USAGE_ROLLUP_DUPLICATE_EVENT_ID:'+
      [...new Set(duplicateIds)].sort().join(',')
    );
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
  const headerIndex={};
  SMQ_USAGE_MANIFEST_HEADERS_U3S.forEach((h,i)=>headerIndex[h]=i+1);
  Object.keys(patch).forEach(k=>{
    if(!headerIndex[k])throw new Error('USAGE_MANIFEST_FIELD_INVALID:'+k);
    manifestSh.getRange(rowNumber,headerIndex[k]).setValue(patch[k]);
  });
}

function smqUsageLatestCompleteManifestU3S_(manifestSh,dateKey){
  const rows=smqUsageManifestRowsU3S_(manifestSh);
  const candidates=[];
  rows.forEach((r,i)=>{
    if(
      smqUsageStoredDateKeyU3S_(r[0])===dateKey &&
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

function runUsageRollupDateU3S1(dateKey){
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
      startedAt,'','','FALSE',''
    ]);
    SpreadsheetApp.flush();
    manifestRow=manifestSh.getLastRow();
  }finally{
    lock.releaseLock();
  }

  try{
    const snapshot=smqUsageBuildRawSnapshotU3S_(eventSh,target,cutoffLastRow);
    const createdAt=new Date();

    totalsSh.appendRow([
      target,generationSeq,generation,SMQ_USAGE_ROLLUP_SCHEMA_U3S,
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
        target,generationSeq,generation,SMQ_USAGE_ROLLUP_SCHEMA_U3S,
        d.dimension,d.dimensionKey,d.displayLabel,d.count,createdAt
      ]);
      dimsSh.getRange(
        dimsSh.getLastRow()+1,1,rows.length,SMQ_USAGE_DIM_HEADERS_U3S.length
      ).setValues(rows);
    }

    SpreadsheetApp.flush();

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

    smqUsageUpdateManifestU3S_(manifestSh,manifestRow,{
      status:'COMPLETE'
    });
    SpreadsheetApp.flush();

    const published=smqUsageFindManifestRowU3S_(manifestSh,target,generation);
    if(!published || String(published.row[4]||'').toUpperCase()!=='COMPLETE'){
      throw new Error('USAGE_ROLLUP_COMPLETE_PUBLISH_FAILED');
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
  }catch(err){
    try{
      smqUsageUpdateManifestU3S_(manifestSh,manifestRow,{
        status:'FAILED',
        completedAt:new Date(),
        notes:String(err&&err.message||err).slice(0,500)
      });
      SpreadsheetApp.flush();
    }catch(_ignored){}
    throw err;
  }
}

function runUsageRollupYesterdayU3S1(){
  return runUsageRollupDateU3S1(smqUsageYesterdayKeyU3S_());
}

function runUsageRollupDailyU3S1(){
  return runUsageRollupYesterdayU3S1();
}

function installUsageRollupDailyTriggerU3S1(){
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

function runUsageRollupParityDateU3S2(dateKey){
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

function runUsageRollupYesterdayParityU3S2(){
  return runUsageRollupParityDateU3S2(smqUsageYesterdayKeyU3S_());
}

function runUsageRollupLatestParityU3S2(){
  const ss=smqUsageRollupStorageU3S_();
  const manifestSh=ss.getSheetByName(SMQ_USAGE_ROLLUP_MANIFEST_SHEET_U3S);
  if(!manifestSh||manifestSh.getLastRow()<2){
    throw new Error('USAGE_ROLLUP_COMPLETE_GENERATION_NOT_FOUND');
  }

  const rows=smqUsageManifestRowsU3S_(manifestSh);
  const dates=[...new Set(
    rows
      .filter(r=>String(r[4]||'').toUpperCase()==='COMPLETE')
      .map(r=>smqUsageStoredDateKeyU3S_(r[0]))
      .filter(Boolean)
  )].sort().reverse();

  if(!dates.length)throw new Error('USAGE_ROLLUP_COMPLETE_GENERATION_NOT_FOUND');
  return runUsageRollupParityDateU3S2(dates[0]);
}

/**
 * Test-only helper for Astra's content-digest requirement.
 * It does NOT edit the sheet. It proves that changing an aggregate-bearing field
 * while preserving eventId changes the canonical content digest.
 */
function runUsageContentDigestSelfTestU3S2(){
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
