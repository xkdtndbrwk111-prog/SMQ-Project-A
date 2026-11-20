// 6 내장 카트리지 연결 — Apps Script(google.script.run) 대신 게임과 함께 배포되는 cartridges/ 폴더를 읽는다.
//   LIST -> cartridges/catalog.json 의 이름 목록, GET -> 카트리지 파일(Project B 응답과 같은 모양)
//   RANK_LIST / RANK_SAVE -> 시험판에서는 연결하지 않음(별도 Apps Script + Sheets는 승인 후, B안)
// 사용 기록 전송(HOJA_USAGE, google.script.run)은 아무 일도 하지 않게 바꾼다.
const RPC = `function catalog(){
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
 `;
export default {
  title: '내장 카트리지 연결',
  parent(P) {
    const re = /^055_script_anon\.js$/;
    P.edit(re, '/* V0.5.8 direct Apps Script HtmlService adapter. Production Project B read-only.\n * Only the already audited server\'s public RPC methods are called. */',
      '/* HOJA Phase 1B: 내장 카트리지(cartridges/catalog.json + 파일). Apps Script 연결 없음. */');
    P.edit(re, 'let sources=null,names=[],serial=0,rankInFlight=0;', 'let sources=null,names=[],serial=0,rankInFlight=0,catalogPromise=null;');
    // 원래 rpc 함수 전체(google.script.run 호출)를 바꾼다
    P.editRange(re, 'function rpc(method,payload){', 'function setSources(values){', RPC);
    P.edit(re, 'return {rpc,setSources,clear,', 'return {rpc,catalog,setSources,clear,');
    P.replaceBody(/_script_hojaProdUsageTelemetry\.js$/,
      '\n/* HOJA Phase 1B: 사용 기록을 보내지 않는다(Apps Script 연결 없음). */\nwindow.HOJA_USAGE=Object.freeze({track(){}});\n');
    P.copy('cartridges', 'cartridges');
  },
  arcade(A) {
    // 아케이드 안 STEP09 시험 패널의 Apps Script 직접 호출(google.script.run)도 끊는다.
    // (원래도 google.script.run이 없는 페이지에서는 실행되지 않던 경로)
    A.editRange("    if(!hostReady || !window.google?.script?.run){", "  window.HOJA_STEP10_RPC=rpc;",
      "    reject(new Error('시험판: 외부 서버에 연결하지 않습니다.'));\n  });\n");
    A.edit('hostReady=!!window.google?.script?.run;', 'hostReady=false;');
  },
};
