/* HOJA usage retention — Apps Script READ-ONLY preview for a COPIED TEST sheet.
 * Do not paste into or deploy to the existing production Project A GAS.
 * Requires HOJA_USAGE_RETENTION_CORE.js loaded into the same isolated trial GAS.
 * Script property HOJA_USAGE_TRIAL_SPREADSHEET_ID must point at a COPY.
 * Hard stops if the trial ID matches production usage/rank/catalog.
 * NO append, clear, delete, trigger installation or external calls.
 */
function hojaUsageRetentionPreviewTrialU1(){
  const properties=PropertiesService.getScriptProperties();
  const trialId=String(properties.getProperty('HOJA_USAGE_TRIAL_SPREADSHEET_ID')||'').trim();
  if(!trialId)throw Error('HOJA_USAGE_TRIAL_SPREADSHEET_ID_REQUIRED');
  const guarded=[
    'SMQ_USAGE_SPREADSHEET_ID','HOJA_PROD_RANKING_SPREADSHEET_ID',
    'HOJA_PROD_PUBLIC_SPREADSHEET_ID'
  ];
  for(const key of guarded){
    const current=String(properties.getProperty(key)||'').trim();
    if(current&&trialId===current)throw Error('HOJA_USAGE_TRIAL_EQUALS_PRODUCTION_'+key);
  }
  if(typeof HOJA_USAGE_RETENTION_CORE==='undefined')
    throw Error('HOJA_USAGE_RETENTION_CORE_NOT_INSTALLED');

  const ss=SpreadsheetApp.openById(trialId),sh=ss.getSheetByName('EVENT_LOG');
  if(!sh)throw Error('HOJA_USAGE_TRIAL_EVENT_LOG_MISSING');
  const required=HOJA_USAGE_RETENTION_CORE.HEADER;
  if(sh.getLastColumn()<required.length)throw Error('HOJA_USAGE_TRIAL_HEADER_SHORT');
  const header=sh.getRange(1,1,1,required.length).getDisplayValues()[0];
  // Existing production schema physically has an empty heading in K1, while
  // K2:K contains the real numeric teamCount. Do NOT alter production headers.
  if(!required.every((x,i)=>header[i]===x || (i===10 && header[i]==='')))
    throw Error('HOJA_USAGE_TRIAL_SCHEMA_MISMATCH');
  const count=sh.getLastRow()-1;
  const maxRows=10000; // Never accidentally load an unbounded full sheet.
  const selectedDay=String(properties.getProperty('HOJA_USAGE_TRIAL_DAY')||'').trim();
  if(selectedDay&&!/^\\d{4}-\\d{2}-\\d{2}$/.test(selectedDay))
    throw Error('HOJA_USAGE_TRIAL_DAY_FORMAT');
  if(count>maxRows&&!selectedDay)
    throw Error('HOJA_USAGE_TRIAL_DAY_REQUIRED_FOR_LARGE_SHEET');
  const data=[];
  const normalizeRow=row=>{
    if(row[2] instanceof Date)row[2]=Utilities.formatDate(row[2],'Asia/Seoul','yyyy-MM-dd');
    else row[2]=String(row[2]||'').trim();
    // Old U3S1 records may lack trailing optional columns. An empty value is
    // not fabricated into a known cartridge ID; CORE marks it unresolved.
    while(row.length<required.length)row.push('');
    return row;
  };
  if(!selectedDay){
    for(let start=2;start<=count+1;start+=500){
      const batch=Math.min(500,count+2-start);
      const chunk=sh.getRange(start,1,batch,required.length).getValues();
      for(const row of chunk)data.push(normalizeRow(row));
    }
  }else{
    // Read only the C date column from the entire event grid, in bounded pages.
    // Fetch complete event rows only for requested day; never truncate a day.
    for(let start=2;start<=count+1;start+=500){
      const batch=Math.min(500,count+2-start);
      const dates=sh.getRange(start,3,batch,1).getValues();
      let first=-1;
      for(let j=0;j<=batch;j++){
        const cell=j<batch?dates[j][0]:null;
        const date=cell instanceof Date?
          Utilities.formatDate(cell,'Asia/Seoul','yyyy-MM-dd'):String(cell||'').trim();
        const selected=(j<batch&&date===selectedDay);
        if(selected&&first===-1)first=j;
        if(!selected&&first!==-1){
          const n=j-first;
          const rows=sh.getRange(start+first,1,n,required.length).getValues();
          for(const row of rows)data.push(normalizeRow(row));
          first=-1;
          if(data.length>maxRows)throw Error('HOJA_USAGE_TRIAL_DAY_TOO_MANY_ROWS');
        }
      }
    }
    if(!data.length)throw Error('HOJA_USAGE_TRIAL_DAY_NO_MATCH');
  }
  const snapshot=HOJA_USAGE_RETENTION_CORE.dailySnapshot(data);
  const digest=Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,snapshot.canonicalSource,Utilities.Charset.UTF_8
  ).map(x=>(x<0?x+256:x).toString(16).padStart(2,'0')).join('');

  // Return only aggregate values. No event IDs, names, IP or identifiers logged.
  return {
    ok:true,schema:snapshot.schema,source:'TRIAL_COPY_ONLY',
    rawRows:snapshot.sourceRows,uniqueStarts:snapshot.uniqueStarts,
    retriesSuppressed:snapshot.retriesSuppressed,
    totalBuckets:snapshot.totals.length,dimensionBuckets:snapshot.dimensions.length,
    canonicalContentSha256:digest,
    totals:snapshot.totals,dimensions:snapshot.dimensions
  };
}
