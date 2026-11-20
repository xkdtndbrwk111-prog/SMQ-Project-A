
"use strict";
/* Public/private entry gate matches Project A RC3 navigation semantics.
   Isolated demo ONLY: no actual participation-code verification or private sheet read. */
window.HOJA_REPOSITORY=(()=>{
 let kind=null,busy=false;
 const root=()=>document.getElementById('hojaRepoChoice');
 const panel=()=>document.getElementById('hrPrivatePanel');
 const input=()=>document.getElementById('hrCode');
 const feedback=()=>document.getElementById('hrNotice');
 function syncBack(){const b=document.getElementById('hojaSharedBack');if(b)b.hidden=root().hidden&&document.getElementById('hojaCatalog').hidden&&document.getElementById('hojaNextMode').hidden;}
 function hide(){root().hidden=true;panel().hidden=true;busy=false;feedback().textContent='';feedback().hidden=true;document.getElementById('hrPublic').disabled=false;syncBack();}
 function show(){window.HOJA_LOADING?.hide?.();window.HOJA_CATALOG?.hide?.();window.HOJA_MODE_PREVIEW?.hide?.();
  const s=window.HOJA_ATTRACT_SCENE;if(s)s.pausedByUser=true;
  kind=null;busy=false;feedback().textContent='';feedback().hidden=true;input().value='';panel().hidden=true;root().hidden=false;document.getElementById('hrPublic').disabled=false;syncBack();}
 function openPrivate(){if(busy)return;panel().hidden=false;feedback().textContent='개인 카트리지는 아직 Project B 인증 API가 연결되지 않아 사용할 수 없습니다.';feedback().hidden=false;input().focus();}
 async function launch(next){
  if(busy||next!=='PUBLIC')return;busy=true;kind=next;feedback().textContent='';feedback().hidden=true;document.getElementById('hrPublic').disabled=true;root().hidden=true;syncBack();
  window.HOJA_LOADING?.show({purpose:'catalog'});
  try{
   const rows=await window.HOJA_B_LIVE.rpc('LIST');
   if(!Array.isArray(rows)||rows.some(x=>!x||typeof x.name!=='string'||!x.name.trim())||
      new Set(rows.map(x=>x.name)).size!==rows.length)throw new Error('공개 카트리지 목록 응답 오류');
   const names=rows.map(x=>x.name);
   if(!names.length)throw new Error('게시된 공용 카트리지가 없습니다.');
   // Valid public sheet names are accepted even if their display naming differs.
   window.HOJA_B_LIVE.clear();
   window.HOJA_LOADING?.hide();window.HOJA_CATALOG?.setSheets(names,{repositoryKind:'PUBLIC'});
  }catch(error){window.HOJA_LOADING?.hide();root().hidden=false;syncBack();
    feedback().textContent='공개 카트리지 조회 실패: '+window.HOJA_B_LIVE.showError(error);feedback().hidden=false;}
  finally{busy=false;document.getElementById('hrPublic').disabled=false;}
 }
 function enter(){feedback().textContent='개인 카트리지는 인증 연동 전까지 사용할 수 없습니다.';feedback().hidden=false;}

 function back(){if(root().hidden)return false;hide();window.HOJA_ATTRACT_CONTROL?.restart?.();return true;}
 document.getElementById('hrPublic')?.addEventListener('click',()=>launch('PUBLIC'));
 document.getElementById('hrPrivate')?.addEventListener('click',openPrivate);
 document.getElementById('hrEnter')?.addEventListener('click',enter);
 input()?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.stopPropagation();enter();}});
 return {show,hide,back,syncBack,get state(){return {kind,busy,visible:!root().hidden}}};
})();

