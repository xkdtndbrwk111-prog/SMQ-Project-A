/* HOJA retention shadow writer — for a COPY OF THE SHEET ONLY.
 * Never deploy to production. Never delete original EVENT_LOG records.
 * Requires CORE.js + TRIAL_GAS.gs in an isolated GAS test project.
 * To opt in, both:
 * 1) Script property HOJA_USAGE_TRIAL_WRITE_ACK = COPIED_SHEET_ONLY
 * 2) Cell A1 of existing _HOJA_USAGE_TRIAL_ONLY tab = HOJA_RETENTION_SANDBOX_V1
 * The canary tab must be added manually to the COPIED spreadsheet. This code
 * deliberately cannot create the canary or change the production source.
 */
function hojaUsageRetentionWriteTrialU1(){
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('HOJA_USAGE_TRIAL_WRITE_ACK')!=='COPIED_SHEET_ONLY')
    throw Error('HOJA_RETENTION_TRIAL_WRITE_ACK_REQUIRED');

  const trialId=String(props.getProperty('HOJA_USAGE_TRIAL_SPREADSHEET_ID')||'').trim();
  if(!trialId)throw Error('HOJA_RETENTION_TRIAL_ID_REQUIRED');
  for(const name of ['SMQ_USAGE_SPREADSHEET_ID','HOJA_PROD_RANKING_SPREADSHEET_ID',
   'HOJA_PROD_PUBLIC_SPREADSHEET_ID']){
    if(trialId===String(props.getProperty(name)||'').trim())
      throw Error('HOJA_RETENTION_TRIAL_EQUALS_PRODUCTION_'+name);
  }
  const ss=SpreadsheetApp.openById(trialId);
  const canary=ss.getSheetByName('_HOJA_USAGE_TRIAL_ONLY');
  if(!canary||canary.getRange(1,1).getDisplayValues()[0][0]!=='HOJA_RETENTION_SANDBOX_V1')
    throw Error('HOJA_RETENTION_TRIAL_CANARY_REQUIRED');

  const lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw Error('HOJA_RETENTION_TRIAL_LOCK_TIMEOUT');
  try{
    const preview=hojaUsageRetentionPreviewTrialU1();
    const gen=preview.canonicalContentSha256;
    const manifestHeader=['generation','contentDigest','rawRowCount','uniqueStarts','status','createdAt','verifiedAt'];
    const totalHeader=['generation','date','gameId','mode','starts','completed','timeUp',
     'otherEnded','unknownEnded','correctTotal','answeredTotal','durationSecondsTotal',
     'durationSamples','teamCountsJson'];
    const dimHeader=['generation','date','gameId','mode','grade','subject','publisher',
     'cartridgeId','starts','completed','timeUp','otherEnded','unknownEnded',
     'correctTotal','answeredTotal','durationSecondsTotal','durationSamples','teamCountsJson'];
    const requireTab=(name,header)=>{
      let sh=ss.getSheetByName(name);
      if(!sh)sh=ss.insertSheet(name);
      if(sh.getLastRow()===0){
        sh.getRange(1,1,1,header.length).setValues([header]);
      }else{
        const actual=sh.getRange(1,1,1,header.length).getDisplayValues()[0];
        if(header.some((x,i)=>x!==actual[i]))
          throw Error('HOJA_RETENTION_TRIAL_HEADER_MISMATCH_'+name);
      }
      return sh;
    };
    const manifest=requireTab('HOJA_TRIAL_RETENTION_MANIFEST',manifestHeader);
    const totals=requireTab('HOJA_TRIAL_DAILY_TOTALS',totalHeader);
    const dims=requireTab('HOJA_TRIAL_DAILY_DIMENSIONS',dimHeader);
    if(manifest.getLastRow()>1){
      const existing=manifest.getRange(2,1,manifest.getLastRow()-1,manifestHeader.length).getValues();
      for(const row of existing){
        if(String(row[0])!==gen)continue;
        if(row[4]==='COMPLETE')
          return {ok:true,replayed:true,source:'TRIAL_COPY_ONLY',
            generation:gen,rawRows:preview.rawRows,uniqueStarts:preview.uniqueStarts};
        throw Error('HOJA_RETENTION_TRIAL_INCOMPLETE_GENERATION_REVIEW_REQUIRED');
      }
    }
    const createdAt=new Date();
    const manifestRow=manifest.getLastRow()+1;
    manifest.getRange(manifestRow,1,1,manifestHeader.length).setValues([[
      gen,gen,preview.rawRows,preview.uniqueStarts,'PREPARING',createdAt,''
    ]]);
    SpreadsheetApp.flush();

    const num=(r,k)=>Number(r[k]||0);
    const counts=r=>JSON.stringify(r.teamCounts||{});
    const totalRows=preview.totals.map(r=>[
      gen,r.date,r.gameId,r.mode,num(r,'starts'),num(r,'completed'),num(r,'timeUp'),
      num(r,'otherEnded'),num(r,'unknownEnded'),num(r,'correctTotal'),
      num(r,'answeredTotal'),num(r,'durationSecondsTotal'),num(r,'durationSamples'),counts(r)
    ]);
    const dimRows=preview.dimensions.map(r=>[
      gen,r.date,r.gameId,r.mode,r.grade,r.subject,r.publisher,r.cartridgeId,
      num(r,'starts'),num(r,'completed'),num(r,'timeUp'),num(r,'otherEnded'),
      num(r,'unknownEnded'),num(r,'correctTotal'),num(r,'answeredTotal'),
      num(r,'durationSecondsTotal'),num(r,'durationSamples'),counts(r)
    ]);
    const writeVerified=(sheet,rows,width)=>{
      if(!rows.length)return;
      const start=sheet.getLastRow()+1;
      // Force dates to remain YYYY-MM-DD text rather than locale-coerced dates.
      sheet.getRange(start,2,rows.length,1).setNumberFormat('@');
      const range=sheet.getRange(start,1,rows.length,width);
      range.setValues(rows);
      SpreadsheetApp.flush();
      const actual=range.getValues();
      if(JSON.stringify(actual)!==JSON.stringify(rows))
        throw Error('HOJA_RETENTION_TRIAL_READBACK_MISMATCH_'+sheet.getName());
    };
    writeVerified(totals,totalRows,totalHeader.length);
    writeVerified(dims,dimRows,dimHeader.length);
    if(totalRows.reduce((sum,row)=>sum+row[4],0)!==preview.uniqueStarts)
      throw Error('HOJA_RETENTION_TRIAL_TOTAL_COUNT_MISMATCH');
    manifest.getRange(manifestRow,7).setValue(new Date());
    SpreadsheetApp.flush();
    manifest.getRange(manifestRow,5).setValue('COMPLETE');
    SpreadsheetApp.flush();
    const recorded=manifest.getRange(manifestRow,5).getValue();
    if(recorded!=='COMPLETE')throw Error('HOJA_RETENTION_TRIAL_PUBLISH_FAILED');
    return {ok:true,replayed:false,source:'TRIAL_COPY_ONLY',generation:gen,
      rawRows:preview.rawRows,uniqueStarts:preview.uniqueStarts,
      dailyTotalRows:totalRows.length,dailyDimensionRows:dimRows.length};
  }finally{
    lock.releaseLock();
  }
}
