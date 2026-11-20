// 12 잔존 코드 정리 (Phase 1C) — 동작은 그대로, 쓰이지 않는 것만 뺀다.
//  - 부모: 실행 때 아케이드를 조립하던 코드(expandArcade, 공유 그림 표, 랭킹 문구 패치 표 — 약 18KB). 이제 빌드 때 조립한다.
//  - 부모: 개인 카트리지 화면 요소와 코드. 저장소 화면은 "목록을 못 읽었을 때 다시 시도" 화면으로만 남긴다.
//  - 부모: 문제 풀이 모드(무한 문제)로 들어가는 길을 막는다(버튼은 1B-7에서 제거됨). 그 화면 코드는 아직 남아 있다(Phase 2 모듈 분리 때 제거).
//  - 아케이드: 숨겨져 있던 개발용 키 안내(방향키·Space·Shift·R·P·M·F·B… 목록)를 뺀다.
const REPOSITORY = `
"use strict";
/* HOJA Phase 1C: 내장 카트리지 목록을 바로 연다(공용/개인 저장소 고르기 없음).
   목록을 읽지 못했을 때만 이 화면(#hojaRepoChoice)에 오류와 [다시 시도]를 보여 준다. */
window.HOJA_REPOSITORY=(()=>{
 let busy=false;
 const root=()=>document.getElementById('hojaRepoChoice');
 const feedback=()=>document.getElementById('hrNotice');
 function syncBack(){const b=document.getElementById('hojaSharedBack');if(b)b.hidden=root().hidden&&document.getElementById('hojaCatalog').hidden&&document.getElementById('hojaNextMode').hidden;}
 function hide(){root().hidden=true;busy=false;feedback().textContent='';feedback().hidden=true;document.getElementById('hrPublic').disabled=false;syncBack();}
 function show(){window.HOJA_LOADING?.hide?.();window.HOJA_CATALOG?.hide?.();window.HOJA_MODE_PREVIEW?.hide?.();
  const s=window.HOJA_ATTRACT_SCENE;if(s)s.pausedByUser=true;
  busy=false;feedback().textContent='';feedback().hidden=true;root().hidden=true;syncBack();launch();}
 async function launch(){
  if(busy)return;busy=true;feedback().textContent='';feedback().hidden=true;document.getElementById('hrPublic').disabled=true;root().hidden=true;syncBack();
  window.HOJA_LOADING?.show({purpose:'catalog'});
  try{
   const rows=await window.HOJA_B_LIVE.rpc('LIST');
   if(!Array.isArray(rows)||rows.some(x=>!x||typeof x.name!=='string'||!x.name.trim())||
      new Set(rows.map(x=>x.name)).size!==rows.length)throw new Error('카트리지 목록 형식 오류');
   const names=rows.map(x=>x.name);
   if(!names.length)throw new Error('내장 카트리지가 없습니다.');
   window.HOJA_B_LIVE.clear();
   window.HOJA_LOADING?.hide();window.HOJA_CATALOG?.setSheets(names,{repositoryKind:'PUBLIC'});
  }catch(error){window.HOJA_LOADING?.hide();root().hidden=false;syncBack();
    feedback().textContent='카트리지 목록을 읽지 못했습니다: '+window.HOJA_B_LIVE.showError(error);feedback().hidden=false;}
  finally{busy=false;document.getElementById('hrPublic').disabled=false;}
 }
 function back(){if(root().hidden)return false;hide();window.HOJA_ATTRACT_CONTROL?.restart?.();return true;}
 document.getElementById('hrPublic')?.addEventListener('click',()=>launch());
 return {show,hide,back,syncBack,get state(){return {kind:'BUILTIN',busy,visible:!root().hidden}}};
})();
`;
const REPO_HTML = `<section id="hojaRepoChoice" aria-label="카트리지 목록 불러오기" hidden>
 <div class="hrHeader"><div class="hcKicker">HOJA · CARTRIDGE</div><h2>카트리지 목록</h2><p>내장 카트리지 목록을 불러오지 못했습니다.</p></div>
 <div class="hrChoices">
  <button type="button" id="hrPublic" class="hrCard"><span class="hrIcon" aria-hidden="true">🔄</span><strong>다시 시도</strong><small>내장 카트리지 목록 다시 읽기</small></button>
 </div>
 <p id="hrNotice" role="alert" aria-live="assertive" class="hrPublicNotice" hidden></p>
</section>
`;
export default {
  title: '잔존 코드 정리',
  parent(P) {
    const G = /_script_hojaV051Gameplay\.js$/;
    P.editRange(G, '/* R17D TEST: 70 team portraits', 'async function launch(which,requested){',
      '/* HOJA Phase 1C: 실행 때 아케이드 조립 코드는 제거(빌드 때 tools/assemble_arcade.mjs로 조립). */\n ');
    P.editRange(G, '    const rankingPatch=', "    if(own!==loadId)return;const f=frame();f.src=", '');
    P.edit(G, 'getCanonicalArcade:expandArcade,', ''); // (위에서 지운 함수를 내보내던 자리)
    P.edit(G, 'async function launch(which,requested){', "async function launch(which,requested){\n  if(which!=='arcade')return; // Phase 1C: 문제 풀이 모드 없음");
    P.replaceBody(/^059_script_anon\.js$/, REPOSITORY);
    P.editRange(/^042_html\.html$/, '<section id="hojaRepoChoice"', '<section id="hojaCatalog"', REPO_HTML);
  },
  arcade(A) {
    A.replaceRe(/\n    <span class="cleanControlHelp">[^\n]*<\/span>/g, '', 1);
    A.editRange('    <span><kbd>←→</kbd>/<kbd>A D</kbd> 이동</span>', '    <span class="spacer"></span>', '');
  },
};
