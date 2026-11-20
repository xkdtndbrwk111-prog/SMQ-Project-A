// 5 H 도움말 — 게임 안에서 H 키로 조작법을 열고 닫는다(튜토리얼 대신). 공용 엔진(arcade.html)에 넣는다.
// Phase 1C 간소화: WASD·쉼표·마침표 키 배치를 그림으로 보여 주고, 중복 조작·개발용 키 안내는 없다.
//  - HUD에는 작은 'H - 조작 도움말' 글자만(가상 버튼 아님). 화면 조작 버튼은 만들지 않는다.
//  - 싱글: 여는 동안 기존 일시정지(toggleManualPause)로 게임·시간이 멈춘다. 학급 대결(mode=class): 멈추지 않는다.
//  - 문제 풀이·오답 풀이·랭킹 이름 입력·이야기 대화 창이 열려 있으면 H를 무시한다.
//  - KeyboardEvent.code(KeyH)로 읽어 한글 자판에서도 동작한다.
const HELP = `
<style id="hojaP1BHelpStyle">
#hojaHelpHint{position:fixed;right:12px;top:68px;z-index:2147482000;padding:4px 9px;border-radius:7px;
  background:rgba(14,26,36,.62);color:#fff7dc;font:800 13px/1.2 system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  pointer-events:none;user-select:none;letter-spacing:.01em}
#hojaHelpHint b{display:inline-block;min-width:1.3em;margin-right:4px;padding:0 4px;border:2px solid #f3e2b8;border-radius:5px;text-align:center}
#hojaHelpOverlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;
  background:rgba(8,14,26,.72);font-family:system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif}
#hojaHelpOverlay[hidden]{display:none!important}
#hojaHelpCard{width:min(600px,94vw);max-height:92vh;overflow:auto;background:#fff7e6;color:#2b2420;border:4px solid #3b2a22;
  border-radius:14px;box-shadow:0 10px 0 #3b2a22;padding:16px 20px 14px;text-align:center}
#hojaHelpCard h2{margin:0 0 2px;font-size:clamp(20px,3.4vw,27px);font-weight:900}
#hojaHelpCard .sub{margin:0 0 12px;color:#7a5b48;font-size:13px;font-weight:700}
#hojaHelpCard .hkBoard{display:flex;gap:clamp(18px,5vw,48px);justify-content:center;align-items:flex-end;flex-wrap:wrap}
#hojaHelpCard .hkGroup{display:grid;gap:6px;justify-items:center}
#hojaHelpCard .hkRow{display:flex;gap:6px}
#hojaHelpCard .cap{width:clamp(64px,13vw,86px);min-height:clamp(64px,13vw,80px);display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:#fff!important;color:#2b2420!important;border:3px solid #3b2a22;border-bottom-width:7px;border-radius:10px;padding:4px 2px}
#hojaHelpCard .cap b{font:900 clamp(22px,4vw,30px)/1 system-ui,sans-serif}
#hojaHelpCard .cap i{font-style:normal;font-weight:800;font-size:clamp(11px,1.9vw,13px);margin-top:4px;color:#6c4a36;line-height:1.15}
#hojaHelpCard .cap.punct b{font-size:clamp(30px,5vw,40px)}
#hojaHelpCard .hkMore{display:flex;gap:10px 18px;justify-content:center;flex-wrap:wrap;margin:14px 0 0;font-weight:800;font-size:clamp(13px,2.2vw,15px)}
#hojaHelpCard .hkMore kbd{display:inline-block;min-width:1.6em;padding:1px 7px;margin-right:4px;border:2px solid #3b2a22;border-bottom-width:4px;
  border-radius:6px;background:#fff!important;color:#2b2420!important;font:900 .95em system-ui,sans-serif;text-shadow:none!important}
#hojaHelpCard .hkTip{margin:10px 0 0;color:#6c4a36;font-size:13px;font-weight:700}
#hojaHelpClose{display:block;margin:12px auto 0;padding:9px 24px;font:900 16px system-ui,sans-serif;color:#fff;background:#d9573b;
  border:3px solid #3b2a22;border-radius:10px;box-shadow:0 4px 0 #3b2a22;cursor:pointer}
</style>
<script id="hojaP1BHelp">
(function hojaHelp(){
  'use strict';
  var classMode=new URLSearchParams(location.search).get('mode')==='class';
  var open=false,pausedByHelp=false;
  var codeOf=function(e){var I=window.HOJA_P1C_INPUT;return I&&I.codeOf?I.codeOf(e):e.code;};
  var cap=function(k,label,cls){return '<span class="cap'+(cls?' '+cls:'')+'"><b>'+k+'</b><i>'+label+'</i></span>';};
  var ov=document.createElement('div');ov.id='hojaHelpOverlay';ov.hidden=true;ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','조작 도움말');
  ov.innerHTML='<div id="hojaHelpCard"><h2>조작 도움말</h2><p class="sub">'+
    (classMode?'학급 대결 중에는 도움말을 열어도 시간이 멈추지 않습니다.':'도움말을 보는 동안 게임이 잠시 멈춥니다.')+'</p>'+
    '<div class="hkBoard">'+
      '<div class="hkGroup"><div class="hkRow">'+cap('W','위 · 문')+'</div><div class="hkRow">'+cap('A','왼쪽')+cap('S','앉기 · 파이프')+cap('D','오른쪽')+'</div></div>'+
      '<div class="hkGroup"><div class="hkRow">'+cap(',','달리기','punct')+cap('.','점프','punct')+'</div></div>'+
    '</div>'+
    '<div class="hkMore"><span><kbd>H</kbd>도움말</span><span><kbd>Enter</kbd>확인 · 계속</span><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>문제 답 고르기</span></div>'+
    '<p class="hkTip">달리기: 쉼표(,)를 누른 채 A 또는 D · 공중에서 S: 내려찍기 · 한글 자판이어도 그대로 됩니다</p>'+
    '<button id="hojaHelpClose" type="button">닫기 (H)</button></div>';
  function blocked(){
    var rank=document.getElementById('hojaRankOverlay'),quiz=document.getElementById('quizOverlay');
    return !!(rank&&rank.classList.contains('is-open'))||!!(quiz&&quiz.classList.contains('active'))||
      !!(window.HOJA_REVIEW&&window.HOJA_REVIEW.isOpen)||
      !!(window.HOJA_EVENT_DIALOGUE_STATUS&&window.HOJA_EVENT_DIALOGUE_STATUS().open);
  }
  function show(){
    if(open||blocked())return;
    open=true;ov.hidden=false;
    if(window.HOJA_P1C_INPUT)window.HOJA_P1C_INPUT.releaseAll();
    if(!classMode&&window.HOJA_HELP_PAUSE)pausedByHelp=window.HOJA_HELP_PAUSE.pause();
  }
  function hide(){
    if(!open)return;
    open=false;ov.hidden=true;
    if(window.HOJA_P1C_INPUT)window.HOJA_P1C_INPUT.releaseAll();
    if(pausedByHelp&&window.HOJA_HELP_PAUSE)window.HOJA_HELP_PAUSE.resume();
    pausedByHelp=false;
    if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
  }
  window.addEventListener('keydown',function(e){
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    if(open){
      e.preventDefault();e.stopImmediatePropagation();
      if(!e.repeat&&(codeOf(e)==='KeyH'||e.code==='Escape'||codeOf(e)==='Enter'))hide();
      return;
    }
    if(codeOf(e)!=='KeyH'||e.repeat)return;
    if(e.target&&e.target.closest&&e.target.closest('input,select,textarea,[contenteditable=true]'))return;
    if(blocked())return;
    e.preventDefault();e.stopImmediatePropagation();show();
  },true);
  window.addEventListener('keyup',function(e){if(open){e.preventDefault();e.stopImmediatePropagation();}},true);
  function mount(){
    document.body.appendChild(ov);
    ov.addEventListener('click',function(e){if(e.target===ov)hide();});
    document.getElementById('hojaHelpClose').addEventListener('click',function(e){e.stopPropagation();hide();});
    // HUD의 작은 안내 글자(누르는 버튼이 아님). 점수 막대 바로 아래 오른쪽.
    var hint=document.createElement('div');hint.id='hojaHelpHint';hint.setAttribute('aria-hidden','true');hint.innerHTML='<b>H</b>- 조작 도움말';
    document.body.appendChild(hint);
    function place(){var h=document.getElementById('scoreHud');var r=h&&h.getBoundingClientRect();hint.style.top=Math.round((r&&r.height?r.bottom:58)+8)+'px';}
    place();window.addEventListener('resize',place,{passive:true});setTimeout(place,500);setTimeout(place,2000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  window.HOJA_HELP=Object.freeze({show:show,hide:hide,get open(){return open;},get classMode(){return classMode;}});
})();
</script>`;
export default {
  title: 'H 도움말 (H 키, 키 배치 그림, HUD 안내)',
  arcade(A) {
    // 장면(ACTIVE_SCENE)은 아케이드 즉시실행함수 안에 있다. 그 안에 '도움말용 멈춤/재개'만 내보낸다(장면 자체는 노출 안 함).
    A.edit('let ACTIVE_SCENE=null;', "let ACTIVE_SCENE=null;window.HOJA_HELP_PAUSE=Object.freeze({pause(){const s=ACTIVE_SCENE;if(!s||s.manualPaused||s.clear||s.timeUp||s.dying||s.quizActive||s.transitioning)return false;s.toggleManualPause();return true;},resume(){const s=ACTIVE_SCENE;if(s&&s.manualPaused)s.toggleManualPause();},get paused(){return !!(ACTIVE_SCENE&&ACTIVE_SCENE.manualPaused);}});");
    A.edit("const qaKeys=new Set(['B','C','F','G','H','I','J','K','N','Q','T','V','Y']);",
      "const qaKeys=new Set(['B','C','F','G','I','J','K','N','Q','T','V','Y']); // H: 도움말(Phase 1B)");
    A.beforeBodyEnd(HELP);
  },
};
