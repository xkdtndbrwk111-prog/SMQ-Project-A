"use strict";
/* HOJA Phase 1B: 내장 카트리지(cartridges/catalog.json + 파일). Apps Script 연결 없음. */
window.HOJA_B_LIVE=(()=>{
 const METHODS=['LIST','GET','RANK_LIST','RANK_SAVE'];
 let sources=null,names=[],rankInFlight=0,catalogPromise=null;
 const getFrame=()=>document.getElementById('hqArcadeFrame');
 const showError=e=>String(e?.message||e||'알 수 없는 서버 오류');
 function catalog(){
  if(!catalogPromise)catalogPromise=fetch('cartridges/catalog.json',{cache:'no-cache'})
   .then(r=>{if(!r.ok)throw new Error('내장 카트리지 목록을 읽지 못했습니다 ('+r.status+')');return r.json();})
   .then(j=>{if(!Array.isArray(j?.cartridges)||!j.cartridges.length)throw new Error('내장 카트리지 목록이 비어 있습니다.');return j.cartridges;})
   .catch(e=>{catalogPromise=null;throw e;});
  return catalogPromise;
 }
 async function readCartridge(entry){
  const r=await fetch(entry.path,{cache:'no-cache'});
  if(!r.ok)throw new Error('카트리지를 읽지 못했습니다: '+entry.name);
  return {sheetName:entry.name,data:await r.json()};
 }
 async function rpc(method,payload){
  if(!METHODS.includes(method))throw new Error('RPC_METHOD_DENIED');
  if(method==='LIST')return (await catalog()).map(c=>({name:c.name}));
  if(method==='GET'){
   const list=await catalog(),want=Array.isArray(payload)?payload:[payload];
   return Promise.all(want.map(name=>{const e=list.find(c=>c.name===name);if(!e)throw new Error('없는 카트리지: '+name);return readCartridge(e);}));
  }
  throw new Error('랭킹 서버가 연결되지 않은 시험판입니다. (점수는 저장되지 않습니다)');
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
 return {rpc,catalog,setSources,clear,get sources(){return sources},get names(){return names.slice()},showError};
})();
