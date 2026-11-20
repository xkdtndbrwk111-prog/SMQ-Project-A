// 5 H 도움말 — 게임 안에서 H 키 또는 화면의 H 버튼(터치)으로 조작법을 본다. (튜토리얼 대신)
// 공용 엔진(arcade.html)에 넣으므로 싱글·학급 대결이 같은 도움말을 쓴다.
//  - 싱글: 도움말을 여는 동안 게임이 멈춘다(기존 일시정지 기능 toggleManualPause 재사용 → 시간도 멈춤).
//  - 학급 대결(주소에 mode=class): 공정성을 위해 멈추지 않는다(Phase 3에서 연결).
//  - 문제 풀이 창, 랭킹 이름 입력 창, 이야기 대화 창이 열려 있으면 H를 무시한다.
// 기존 학생용 키 차단 목록(hojaStudentDisableQaKeys_)에서 H만 뺀다. 나머지 개발용 키는 그대로 막힌다.
const HELP = `
<style id="hojaP1BHelpStyle">
#hojaHelpBtn{position:fixed;right:12px;top:68px;z-index:2147482000;width:46px;height:46px;padding:0;border-radius:10px;
  border:2px solid #f3e2b8;background:rgba(18,32,44,.82);color:#fff7dc;font:900 22px/1 system-ui,sans-serif;cursor:pointer;
  box-shadow:0 3px 0 rgba(0,0,0,.45);touch-action:manipulation;-webkit-tap-highlight-color:transparent}
#hojaHelpBtn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,.45)}
#hojaHelpOverlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;
  background:rgba(8,14,26,.72);font-family:system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif}
#hojaHelpOverlay[hidden]{display:none!important}
#hojaHelpCard{width:min(560px,92vw);max-height:90vh;overflow:auto;background:#fff7e6;color:#2b2420;border:4px solid #3b2a22;
  border-radius:14px;box-shadow:0 10px 0 #3b2a22;padding:18px 22px 16px}
#hojaHelpCard h2{margin:0 0 4px;font-size:clamp(20px,3.4vw,28px);font-weight:900}
#hojaHelpCard .sub{margin:0 0 12px;color:#7a5b48;font-size:14px;font-weight:700}
#hojaHelpCard table{width:100%;border-collapse:collapse;font-size:clamp(14px,2.2vw,17px)}
#hojaHelpCard th{text-align:left;padding:7px 8px;width:38%;color:#4a3328;font-weight:900;border-top:1px solid #ecd9bf}
#hojaHelpCard td{padding:7px 8px;border-top:1px solid #ecd9bf;font-weight:700}
#hojaHelpCard kbd{display:inline-block;min-width:1.6em;padding:1px 6px;margin:1px 2px;border:2px solid #3b2a22;border-bottom-width:4px;
  border-radius:6px;background:#fff!important;color:#2b2420!important;font:800 .9em system-ui,sans-serif;text-align:center;text-shadow:none!important}
#hojaHelpClose{display:block;margin:14px auto 0;padding:10px 26px;font:900 17px system-ui,sans-serif;color:#fff;background:#d9573b;
  border:3px solid #3b2a22;border-radius:10px;box-shadow:0 4px 0 #3b2a22;cursor:pointer}
</style>
<script id="hojaP1BHelp">
(function hojaHelp(){
  'use strict';
  var classMode=new URLSearchParams(location.search).get('mode')==='class';
  var open=false,pausedByHelp=false;
  var ov=document.createElement('div');ov.id='hojaHelpOverlay';ov.hidden=true;ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','도움말');
  ov.innerHTML='<div id="hojaHelpCard"><h2>도움말 · 조작법</h2><p class="sub">'+
    (classMode?'학급 대결 중에는 도움말을 열어도 시간이 멈추지 않습니다.':'도움말을 보는 동안 게임이 잠시 멈춥니다.')+'</p><table>'+
    '<tr><th>이동</th><td><kbd>←</kbd><kbd>→</kbd> 또는 <kbd>A</kbd><kbd>D</kbd></td></tr>'+
    '<tr><th>달리기</th><td><kbd>Shift</kbd> 또는 <kbd>X</kbd> 누른 채 이동 · 같은 방향 두 번 누르기</td></tr>'+
    '<tr><th>점프</th><td><kbd>Space</kbd> <kbd>Z</kbd> <kbd>W</kbd> <kbd>↑</kbd></td></tr>'+
    '<tr><th>문 들어가기</th><td>문 앞에서 <kbd>W</kbd> 또는 <kbd>↑</kbd></td></tr>'+
    '<tr><th>앉기 · 파이프 들어가기</th><td><kbd>S</kbd> 또는 <kbd>↓</kbd></td></tr>'+
    '<tr><th>문제 풀기</th><td>숫자 <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 또는 보기를 눌러 고르기</td></tr>'+
    '<tr><th>다음으로</th><td><kbd>Enter</kbd></td></tr>'+
    '<tr><th>도움말 열기 · 닫기</th><td><kbd>H</kbd> 또는 화면 오른쪽 위 <kbd>H</kbd> 버튼</td></tr>'+
    '</table><button id="hojaHelpClose" type="button">닫기 (H)</button></div>';
  function blocked(){
    return !!(document.getElementById('hojaRankOverlay')&&document.getElementById('hojaRankOverlay').classList.contains('is-open'))||
      !!(document.getElementById('quizOverlay')&&document.getElementById('quizOverlay').classList.contains('active'))||
      !!(window.HOJA_EVENT_DIALOGUE_STATUS&&window.HOJA_EVENT_DIALOGUE_STATUS().open);
  }
  function show(){
    if(open||blocked())return;
    open=true;ov.hidden=false;
    if(!classMode&&window.HOJA_HELP_PAUSE)pausedByHelp=window.HOJA_HELP_PAUSE.pause();
    document.getElementById('hojaHelpClose').focus({preventScroll:true});
  }
  function hide(){
    if(!open)return;
    open=false;ov.hidden=true;
    if(pausedByHelp&&window.HOJA_HELP_PAUSE)window.HOJA_HELP_PAUSE.resume();
    pausedByHelp=false;
    if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
  }
  window.addEventListener('keydown',function(e){
    if(e.metaKey||e.ctrlKey||e.altKey||e.isComposing)return;
    if(open){
      e.preventDefault();e.stopImmediatePropagation();
      if(e.code==='KeyH'||e.key==='Escape'||e.key==='Enter'||e.key===' ')hide();
      return;
    }
    if(e.code!=='KeyH')return;
    if(e.target&&e.target.closest&&e.target.closest('input,select,textarea,[contenteditable=true]'))return;
    if(blocked())return;
    e.preventDefault();e.stopImmediatePropagation();show();
  },true);
  window.addEventListener('keyup',function(e){if(open){e.preventDefault();e.stopImmediatePropagation();}},true);
  function mount(){
    document.body.appendChild(ov);
    ov.addEventListener('click',function(e){if(e.target===ov)hide();});
    document.getElementById('hojaHelpClose').addEventListener('click',function(e){e.stopPropagation();hide();});
    // 아케이드 안 도구 묶음(#hojaStudentTools)은 부모 화면 HUD로 대체되어 숨겨져 있으므로, 점수 막대 바로 아래 오른쪽에 따로 둔다
    var b=document.createElement('button');b.id='hojaHelpBtn';b.type='button';b.textContent='H';
    b.title='도움말 (H)';b.setAttribute('aria-label','도움말 (H)');
    b.addEventListener('mousedown',function(e){e.preventDefault();});
    b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();b.blur();open?hide():show();});
    document.body.appendChild(b);
    function place(){var h=document.getElementById('scoreHud');var r=h&&h.getBoundingClientRect();b.style.top=Math.round((r&&r.height?r.bottom:58)+10)+'px';}
    place();window.addEventListener('resize',place,{passive:true});setTimeout(place,500);setTimeout(place,2000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  window.HOJA_HELP=Object.freeze({show:show,hide:hide,get open(){return open;},get classMode(){return classMode;}});
})();
</script>`;
export default {
  title: 'H 도움말 (키보드 H + 터치 버튼)',
  arcade(A) {
    // 장면(ACTIVE_SCENE)은 아케이드 즉시실행함수 안에 있다. 그 안에 '도움말용 멈춤/재개'만 내보낸다(장면 자체는 노출 안 함).
    A.edit('let ACTIVE_SCENE=null;', "let ACTIVE_SCENE=null;window.HOJA_HELP_PAUSE=Object.freeze({pause(){const s=ACTIVE_SCENE;if(!s||s.manualPaused||s.clear||s.timeUp||s.dying||s.quizActive||s.transitioning)return false;s.toggleManualPause();return true;},resume(){const s=ACTIVE_SCENE;if(s&&s.manualPaused)s.toggleManualPause();},get paused(){return !!(ACTIVE_SCENE&&ACTIVE_SCENE.manualPaused);}});");
    A.edit("const qaKeys=new Set(['B','C','F','G','H','I','J','K','N','Q','T','V','Y']);",
      "const qaKeys=new Set(['B','C','F','G','I','J','K','N','Q','T','V','Y']); // H: 도움말(Phase 1B)");
    A.beforeBodyEnd(HELP);
  },
};
