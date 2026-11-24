/* COPY-ONLY V4 trial append guard: never activate in production.
 * Project A holds the existing ScriptLock across guard and original append.
 * The source of truth remains the unmodified historical EVENT_LOG.
 * Full event-ID search is correct but too expensive for production use.
 */
function hojaV4UsageTrialGuardU4_(sheet,candidate,storageId){
  const props=PropertiesService.getScriptProperties();
  const copyId=String(props.getProperty('HOJA_USAGE_TRIAL_SPREADSHEET_ID')||'').trim();
  const productionId=String(props.getProperty('HOJA_USAGE_PRODUCTION_SPREADSHEET_ID')||'').trim();
  if(!copyId||!productionId||copyId===productionId||storageId!==copyId)
    throw Error('HOJA_V4_APPEND_TRIAL_COPY_ONLY');
  const parent=sheet.getParent();
  if(!parent||parent.getId()!==copyId)
    throw Error('HOJA_V4_APPEND_TRIAL_PARENT_MISMATCH');
  const canary=parent.getSheetByName('_HOJA_USAGE_TRIAL_ONLY');
  if(!canary||String(canary.getRange(1,1).getDisplayValue()).trim()!=='HOJA_RETENTION_SANDBOX_V1')
    throw Error('HOJA_V4_APPEND_TRIAL_CANARY_MISSING');
  if(!Array.isArray(candidate)||candidate.length!==15||
     String(candidate[4])!=='PUBLIC'||String(candidate[13])!=='U3S1')
    throw Error('HOJA_V4_APPEND_TRIAL_SCHEMA');
  const day=String(candidate[2]||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw Error('HOJA_V4_APPEND_TRIAL_DATE_INVALID');
  const last=sheet.getLastRow();
  if(last<1)throw Error('HOJA_V4_APPEND_TRIAL_MISSING_HEADER');
  if(last>1){
    const prior=String(sheet.getRange(last,3).getDisplayValue()||'').trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(prior)||prior>day)
      throw Error('HOJA_V4_APPEND_TRIAL_NON_MONOTONE_DAY');
    const hits=sheet.getRange(2,1,last-1,1)
      .createTextFinder(String(candidate[0])).matchEntireCell(true).findAll();
    if(hits.length>12)throw Error('HOJA_V4_APPEND_TRIAL_REPLAY_STORM');
    const signature=row=>JSON.stringify(row.map((x,i)=>
      i===1||i===2?null:String(x==null?'':x).trim()));
    const expected=signature(candidate);
    for(const hit of hits){
      const old=sheet.getRange(hit.getRow(),1,1,15).getDisplayValues()[0];
      if(!/^\d{4}-\d{2}-\d{2}$/.test(String(old[2]||''))||
         String(old[2])>day||signature(old)!==expected)
        throw Error('HOJA_V4_APPEND_TRIAL_EVENT_ID_CONFLICT');
    }
    if(hits.length)return {
      ok:true,repositoryKind:'PUBLIC',cartridgeCount:Number(candidate[9]),
      usageSchemaVersion:'U3S1',duplicateIgnored:true,
      originalDate:String(sheet.getRange(hits[0].getRow(),3).getDisplayValue())
    };
  }
  return null;
}
