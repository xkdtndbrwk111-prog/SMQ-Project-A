
"use strict";
/* V0.5.8 direct Apps Script HtmlService adapter. Production Project B read-only.
 * Only the already audited server's public RPC methods are called. */
window.HOJA_B_LIVE=(()=>{
 const METHODS=['LIST','GET','RANK_LIST','RANK_SAVE'];
 let sources=null,names=[],serial=0,rankInFlight=0;
 const getFrame=()=>document.getElementById('hqArcadeFrame');
 const showError=e=>String(e?.message||e||'알 수 없는 서버 오류');
 function rpc(method,payload){
  if(!METHODS.includes(method))return Promise.reject(new Error('RPC_METHOD_DENIED'));
  const gs=window.google?.script?.run;
  if(!gs)return Promise.reject(new Error('Apps Script 웹앱 연결이 없습니다. 배포된 /exec 주소에서 실행해 주세요.'));
  return new Promise((resolve,reject)=>{
   let finished=false;
   const timeout=window.setTimeout(()=>{if(!finished){finished=true;reject(new Error('서버 응답 시간 초과'))}},45000);
   const success=value=>{if(finished)return;finished=true;clearTimeout(timeout);resolve(value)};
   const failure=error=>{if(finished)return;finished=true;clearTimeout(timeout);reject(new Error(showError(error)))};
   const runner=gs.withSuccessHandler(success).withFailureHandler(failure);
   try{
    if(method==='LIST')runner.hojaListPublicCartridges();
    else if(method==='GET')runner.hojaGetPublicQuestions(payload);
    else if(method==='RANK_LIST')runner.hojaRankList(payload);
    else if(method==='RANK_SAVE')runner.hojaRankSave(payload);
   }catch(error){failure(error)}
  });
 }
 function setSources(values){
  if(!Array.isArray(values)||!values.length||values.length>5)throw new Error('카트리지 1~5개가 필요합니다.');
  if(values.some(e=>!e||typeof e.sheetName!=='string'||!Array.isArray(e.data?.questions)))throw new Error('Project B 응답이 올바르지 않습니다.');
  window.HOJA_GAMEPLAY?.setServerQuestions?.(values);
  sources=values;
  names=values.map(x=>x.sheetName);
 }
 function clear(){sources=null;names=[];window.HOJA_GAMEPLAY?.clearServerQuestions?.();}
 function sendFrame(obj){const f=getFrame();if(f?.contentWindow)f.contentWindow.postMessage(obj,'*')}
 window.addEventListener('message',async event=>{
  const f=getFrame();if(!f?.contentWindow||event.source!==f.contentWindow)return;
  const msg=event.data;if(!msg||typeof msg!=='object')return;
  if(msg.type==='HOJA_V058_ARCADE_READY'){
   if(sources)sendFrame({type:'HOJA_V058_ARCADE_START',sources,names});
   else sendFrame({type:'HOJA_V058_ARCADE_ERROR',error:'선택한 카트리지 문제가 없습니다.'});
   return;
  }
  if(msg.type!=='HOJA_V058_ARCADE_RPC')return;
  const id=msg.id,method=msg.method;
  if(!Number.isSafeInteger(id)||id<1||rankInFlight>=2)return;
  // Read/Save rankings only for the currently selected single public cartridge.
  if(names.length!==1||!['RANK_LIST','RANK_SAVE'].includes(method)||
      (method==='RANK_LIST'&&msg.payload!==names[0])||
      (method==='RANK_SAVE'&&msg.payload?.cartridge!==names[0])){
   sendFrame({type:'HOJA_V058_ARCADE_RPC_RESULT',id,ok:false,error:'랭킹은 단일 공용 카트리지의 정상 완주 기록만 지원합니다.'});
   return;
  }
  rankInFlight++;
  try{const value=await rpc(method,msg.payload);sendFrame({type:'HOJA_V058_ARCADE_RPC_RESULT',id,ok:true,value})}
  catch(error){sendFrame({type:'HOJA_V058_ARCADE_RPC_RESULT',id,ok:false,error:showError(error)})}
  finally{rankInFlight--}
 });
 return {rpc,setSources,clear,get sources(){return sources},get names(){return names.slice()},showError};
})();
