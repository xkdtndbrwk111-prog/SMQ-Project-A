/* Project B V4 UsageU2-compatible READ-ONLY TRIAL RPC.
 * Isolated GAS test project + COPIED usage spreadsheet ONLY.
 * Required sibling sources: HOJA_USAGE_V4_CORE.js,
 * HOJA_USAGE_V4_TRIAL_GAS.gs, HOJA_USAGE_V4_LIVE_TAIL.js,
 * and existing Project B requireUsageStatisticsAccessU3_ authorization.
 * Do NOT rename/overwrite live getUsageStatisticsU2; no production deployment.
 * Today is provisional and is read only from the final sealed source watermark.
 */
function getUsageStatisticsU4TrialShadow(creatorToken){
  // The Project B authorization check MUST happen before even opening Sheets.
  const access=requireUsageStatisticsAccessU3_(creatorToken);
  if(!access||!['OWNER','CREATOR'].includes(access.role))
    throw Error('HOJA_V4_LIVE_TRIAL_AUTHORITY_DENIED');
  if(typeof HOJA_USAGE_V4_CORE==='undefined'||
     typeof HOJA_USAGE_V4_LIVE_TAIL==='undefined')
    throw Error('HOJA_V4_LIVE_TRIAL_DEPENDENCIES_MISSING');
  const {ss}=hojaV4TrialStorage_();
  const audit=ss.getSheetByName('HOJA_V4_BACKFILL_AUDIT');
  if(!audit||audit.getLastRow()!==2)
    throw Error('HOJA_V4_LIVE_TRIAL_HISTORY_AUDIT_REQUIRED');
  const auditRows=audit.getRange(1,1,2,10).getDisplayValues();
  if(auditRows[0].join('|')!==['scope','startDate','endDate','rawRows',
    'uniquePlays','duplicateRetries','zeroUseDays','bucketRows',
    'sourceLastRow','validation'].join('|'))
    throw Error('HOJA_V4_LIVE_TRIAL_AUDIT_SCHEMA');
  const cert=auditRows[1];
  if(cert[0]!=='COPY_ONLY_CONNECTOR_SHA256_V4'||
     cert[9]!=='FULL_SOURCE_AND_BUCKET_SHA256_PASS_NOT_ACTUAL_GAS_EXECUTION')
    throw Error('HOJA_V4_LIVE_TRIAL_UNVERIFIED_HISTORY');
  const now=hojaV4KstDay_(new Date());
  const yesterday=hojaV4KstDay_(new Date(Date.now()-86400000));
  const first=cert[1],end=cert[2];
  if(!first||first>=now||end>yesterday)
    throw Error('HOJA_V4_LIVE_TRIAL_CERT_DATES_INVALID');
  const expected=HOJA_USAGE_V4_CORE.splitDayKeys(first,yesterday);
  const manifest=ss.getSheetByName('HOJA_V4_DAILY_MANIFEST'),
    buckets=ss.getSheetByName('HOJA_V4_DAILY_BUCKETS'),
    original=ss.getSheetByName('EVENT_LOG');
  if(!manifest||!buckets||!original)
    throw Error('HOJA_V4_LIVE_TRIAL_MISSING_TABS');
  const manifestWidth=HOJA_V4_MANIFEST_HEADER.length,
    bucketWidth=HOJA_V4_BUCKET_HEADER.length;
  const readHeader=(sh,header)=>{
    if(sh.getLastRow()<1||sh.getLastColumn()<header.length)
      throw Error('HOJA_V4_LIVE_TRIAL_BAD_TAB_'+sh.getName());
    const actual=sh.getRange(1,1,1,header.length).getDisplayValues()[0];
    if(header.some((h,i)=>actual[i]!==h))
      throw Error('HOJA_V4_LIVE_TRIAL_HEADER_MISMATCH_'+sh.getName());
  };
  readHeader(manifest,HOJA_V4_MANIFEST_HEADER);
  readHeader(buckets,HOJA_V4_BUCKET_HEADER);
  const mLast=manifest.getLastRow(),bLast=buckets.getLastRow();
  if(mLast>367||bLast>24000)
    throw Error('HOJA_V4_LIVE_TRIAL_SUMMARY_READ_LIMIT');
  const mrows=mLast>1?manifest.getRange(2,1,mLast-1,manifestWidth).getDisplayValues():[];
  const brows=bLast>1?buckets.getRange(2,1,bLast-1,bucketWidth).getDisplayValues():[];
  const perDay=new Map(),sourceDays=new Set();
  for(const row of brows){
    const date=row[0],gen=row[1];
    if(!perDay.has(date))perDay.set(date,[]);
    perDay.get(date).push({generation:gen,
      dimension:row[2],key:row[3],displayLabel:row[4],count:Number(row[5])});
  }
  const past=[];let lastPrefix=1;
  if(mrows.length!==expected.length)
    throw Error('HOJA_V4_LIVE_TRIAL_UNSEALED_DATE_GAP');
  for(let i=0;i<mrows.length;i++){
    const r=mrows[i],date=expected[i],b=perDay.get(date)||[];
    if(r[0]!==date||r[2]!=='COMPLETE'||sourceDays.has(date))
      throw Error('HOJA_V4_LIVE_TRIAL_MISSING_COMPLETE_DAY_'+date);
    sourceDays.add(date);
    if(r[1]!==r[7]||b.length!==Number(r[8])||
       b.some(x=>x.generation!==r[1]))
      throw Error('HOJA_V4_LIVE_TRIAL_BUCKET_GENERATION_MISMATCH_'+date);
    if(Number(r[11])!==lastPrefix+Number(r[5]))
      throw Error('HOJA_V4_LIVE_TRIAL_SOURCE_PREFIX_GAP_'+date);
    lastPrefix=Number(r[11]);
    past.push({
      schema:HOJA_USAGE_V4_CORE.SCHEMA,date,
      status:r[2],verified:!!r[10],starts:Number(r[6]),
      sourceDigest:r[7],bucketDigest:r[12],
      sourceStartRow:Number(r[3]),sourceEndRow:Number(r[4]),
      sourceRowCount:Number(r[5]),sourcePrefixEndRow:lastPrefix,
      retriesSuppressed:Number(r[13]),
      buckets:b.map(x=>({dimension:x.dimension,key:x.key,
        count:x.count,displayLabel:x.displayLabel}))
    });
  }
  // Certified zero-use days intentionally have no bucket rows.
  for(const date of perDay.keys())
    if(!sourceDays.has(date))
      throw Error('HOJA_V4_LIVE_TRIAL_UNEXPECTED_BUCKET_DATE_'+date);
  if(end!==expected[expected.length-1])
    throw Error('HOJA_V4_LIVE_TRIAL_BACKFILL_CERT_OUTDATED');
  if(lastPrefix!==Number(cert[8]))
    throw Error('HOJA_V4_LIVE_TRIAL_CERT_SOURCE_WATERMARK_MISMATCH');
  const lastRow=original.getLastRow();
  const newRows=lastRow-lastPrefix;
  if(newRows<0||newRows>25000)
    throw Error('HOJA_V4_LIVE_TRIAL_MUTABLE_TAIL_LIMIT');
  const tail=newRows?
    original.getRange(lastPrefix+1,1,newRows,15).getDisplayValues():[];
  // A partial flush must never be misread as a valid zero-usage event.
  for(const row of tail){
    if(!Array.isArray(row)||row.length!==15||
       !/^[a-f0-9-]{32,40}$/i.test(String(row[0]||'').trim())||
       !String(row[1]||'').trim()||String(row[2]||'').trim()!==now||
       !['SOLO','TEAM'].includes(String(row[3]||'').trim().toUpperCase())||
       String(row[4]||'').trim()!=='PUBLIC'||
       String(row[13]||'').trim()!=='U3S1')
      throw Error('HOJA_V4_LIVE_TRIAL_PARTIAL_OR_UNEXPECTED_TAIL_ROW');
  }
  if(original.getLastRow()!==lastRow||
     manifest.getLastRow()!==mLast||buckets.getLastRow()!==bLast)
    throw Error('HOJA_V4_LIVE_TRIAL_SOURCE_CHANGED_DURING_READ');
  const result=HOJA_USAGE_V4_LIVE_TAIL.project(HOJA_USAGE_V4_CORE,past,tail,{
    asOf:now,historyStart:first,initialHistoryAudited:true,
    initialPrefixEndRow:1,certifiedPrefixEndRow:lastPrefix,
    sourceLastRow:lastRow,hashBuckets:hojaV4Sha256_,
    accessRole:access.role
  });
  return {
    source:'COPY_ONLY_V4_TRIAL',
    rawDeletion:'HOLD',productionSwitchAllowed:false,
    todayStatus:'LIVE_PROVISIONAL',preview:result.preview,
    summary:result.summary
  };
}
