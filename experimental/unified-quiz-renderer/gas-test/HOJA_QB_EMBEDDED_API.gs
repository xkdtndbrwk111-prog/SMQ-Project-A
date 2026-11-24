/** Test-only embedded approved bank. NO external sheet reads/writes. */
function hojaEmbeddedListApproved_(){return hojaApprovedCatalog_().map(x=>({name:x.name,cartridgeId:x.cartridgeId}));}
function hojaEmbeddedGetApproved_(names){
  if(!Array.isArray(names)||names.length<1||names.length>5||names.some(n=>typeof n!=='string'||!n.trim())||new Set(names.map(n=>n.trim())).size!==names.length)throw Error('APPROVED_TRIAL_SELECTION_INVALID');
  const list=hojaApprovedCatalog_();
  return names.map(raw=>{
    const unit=list.find(x=>x.name===raw.trim());if(!unit)throw Error('APPROVED_TRIAL_CARTRIDGE_NOT_FOUND');
    const data=unit.getData();
    if(data.questionSchemaVersion!==2||data.sourceSheetVersion!==2||!Array.isArray(data.questions)||data.questions.length<25||!data.images||!data.tags||!data.unitMeta||data.questions.some(q=>!q.rendererQuestion||!q.familyId||!q.type))throw Error('APPROVED_TRIAL_CONTENT_INVALID');
    return {sheetName:unit.name,data};
  });
}
function hojaEmbeddedSelfTest_(){return hojaApprovedCatalog_().map(x=>{const d=x.getData();return {id:x.cartridgeId,name:x.name,questions:d.questions.length,images:Object.keys(d.images).length,tags:Object.keys(d.tags).length};});}
