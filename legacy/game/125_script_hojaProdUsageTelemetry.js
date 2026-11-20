
/* Anonymous, best-effort game start. Must never prevent game play. */
window.HOJA_USAGE=Object.freeze({
  track(mode,teamCount){
    try{
      const gs=window.google?.script?.run,sources=window.HOJA_B_LIVE?.sources;
      if(!gs||!Array.isArray(sources)||sources.length<1||sources.length>5)return;
      const ids=sources.map(x=>String(x?.data?.cartridgeId||'').trim());
      if(ids.some(x=>!/^[0-9]{1,11}$/.test(x)))return;
      const eventId=window.crypto?.randomUUID?.();
      if(!eventId)return;
      gs.withSuccessHandler(()=>{}).withFailureHandler(()=>{}).recordUsageStartU1({
        eventId,mode,repositoryKind:'PUBLIC',cartridgeCount:ids.length,
        cartridgeIds:ids,teamCount
      });
    }catch(_ignored){}
  }
});
