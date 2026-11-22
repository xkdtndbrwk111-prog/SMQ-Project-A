/* Read-only integration adapter for an ISOLATED COPIED SHEET test project.
 * Requires HOJA_USAGE_SUMMARY_READ_V1.js loaded into that trial Apps Script.
 * Never install in production A/B until both consumers have been reviewed.
 * Does not call EVENT_LOG, append, delete, clear, trigger or URL fetch.
 */
function hojaUsageSummaryReadTrialU1(dateKeys){
  const props=PropertiesService.getScriptProperties();
  const trialId=String(props.getProperty('HOJA_USAGE_TRIAL_SPREADSHEET_ID')||'').trim();
  if(!trialId)throw Error('HOJA_SUMMARY_TRIAL_ID_REQUIRED');
  for(const p of ['SMQ_USAGE_SPREADSHEET_ID','HOJA_PROD_RANKING_SPREADSHEET_ID',
   'HOJA_PROD_PUBLIC_SPREADSHEET_ID']){
    const prod=String(props.getProperty(p)||'').trim();
    if(prod&&prod===trialId)throw Error('HOJA_SUMMARY_PRODUCTION_ID_REJECTED_'+p);
  }
  if(typeof HOJA_USAGE_SUMMARY_READ_V1==='undefined')
    throw Error('HOJA_SUMMARY_BRIDGE_NOT_LOADED');
  const ss=SpreadsheetApp.openById(trialId),canary=ss.getSheetByName('_HOJA_USAGE_TRIAL_ONLY');
  if(!canary||canary.getRange(1,1).getDisplayValues()[0][0]!=='HOJA_RETENTION_SANDBOX_V1')
    throw Error('HOJA_SUMMARY_TRIAL_CANARY_REQUIRED');
  const schema=HOJA_USAGE_SUMMARY_READ_V1;
  const readTab=(name,headers,dateCol)=>{
    const sh=ss.getSheetByName(name);
    if(!sh)throw Error('HOJA_SUMMARY_TAB_NOT_FOUND_'+name);
    const width=headers.length,usedRows=sh.getLastRow();
    if(usedRows<1||sh.getLastColumn()<width)
      throw Error('HOJA_SUMMARY_HEADER_SHORT_'+name);
    if(usedRows>25000||usedRows*width>100000)
      throw Error('HOJA_SUMMARY_READ_LIMIT_'+name);
    const header=sh.getRange(1,1,1,width).getDisplayValues()[0];
    if(headers.some((h,i)=>String(header[i]||'').trim()!==h))
      throw Error('HOJA_SUMMARY_HEADER_MISMATCH_'+name);
    const out=[header];
    for(let start=2;start<=usedRows;start+=500){
      const batch=Math.min(500,usedRows-start+1);
      const data=sh.getRange(start,1,batch,width).getValues();
      for(const row of data){
        if(dateCol>=0&&row[dateCol] instanceof Date)
          row[dateCol]=Utilities.formatDate(row[dateCol],'Asia/Seoul','yyyy-MM-dd');
        out.push(row);
      }
    }
    return out;
  };
  const old={},trial={};
  for(const key of ['manifest','totals','dimensions']){
    const name={manifest:'USAGE_ROLLUP_MANIFEST',totals:'USAGE_DAILY_TOTALS',
     dimensions:'USAGE_DAILY_DIMENSIONS'}[key];
    old[key]=readTab(name,schema.OLD[key],0);
  }
  for(const key of ['manifest','totals','dimensions','facets']){
    const name={manifest:'HOJA_TRIAL_RETENTION_MANIFEST',
      totals:'HOJA_TRIAL_DAILY_TOTALS',dimensions:'HOJA_TRIAL_DAILY_DIMENSIONS',
      facets:'HOJA_TRIAL_DAILY_FACETS'}[key];
    trial[key]=readTab(name,schema.TRIAL[key],key==='manifest'?-1:1);
  }
  const selected=Array.isArray(dateKeys)?dateKeys:[dateKeys];
  const countOnly=props.getProperty('HOJA_USAGE_TRIAL_ALLOW_COUNT_ONLY')==='PREVIEW_ONLY';
  const report=schema.readDates({old,trial},selected,{allowCountOnly:countOnly});
  return {
    ...report,
    source:'COPIED_SHEET_AGGREGATES_ONLY',
    spreadsheetIsolated:true,
    // No fallback to raw EVENT_LOG. Coverage gaps require a separate
    // safe rollup operation, not a fabricated 0 or a live raw scan.
    // A validated trial copy is still NOT production deployment approval.
    productionSwitchAllowed:false
  };
}
