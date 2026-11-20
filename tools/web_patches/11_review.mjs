// 11 문항별 응답 기록 + 개인 오답 풀이 (Phase 1C, 마리오 2.0 오답 복기 흐름 계승)
// 기록(공용 엔진, 싱글·학급 대결 공통): 문항마다 카트리지·문제 묶음 ID·유형·문제·보기(화면에 나온 순서)·정답·
//   고른 보기·정답 여부·시간 초과 여부·풀이 시간(ms, 문제 창이 열린 뒤 고를 때까지). window.HOJA_RUN_RECORD()로 읽는다.
//   HOJA 문제 창에는 시간 제한이 없어 timedOut은 항상 false다(필드는 학급 분석용으로 둔다).
//   기록은 이 기기(아케이드 메모리) 안에만 있다. 싱글에서는 어디로도 보내지 않는다.
// 끝난 뒤: 결산 → [Enter] 틀린 문제 다시 풀기(회차마다, 다 맞힐 때까지 반복 가능) → 랭킹 화면(기존).
const REVIEW = `
<style id="hojaP1CReviewStyle">
#hojaReviewOverlay{position:fixed;inset:0;z-index:2147482500;display:flex;align-items:center;justify-content:center;
  background:rgba(8,14,26,.78);font-family:system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif}
#hojaReviewOverlay[hidden]{display:none!important}
#hojaReviewCard{width:min(640px,94vw);max-height:92vh;overflow:auto;background:#fff7e6;color:#2b2420;border:4px solid #3b2a22;
  border-radius:14px;box-shadow:0 10px 0 #3b2a22;padding:18px 22px 16px;text-align:center}
#hojaReviewCard .rvTop{margin:0;color:#7a5b48;font-weight:800;font-size:14px}
#hojaReviewCard h2{margin:4px 0 8px;font-size:clamp(22px,4vw,32px);font-weight:950}
#hojaReviewCard .rvScore{font:950 clamp(34px,7vw,52px)/1.1 system-ui,sans-serif;letter-spacing:.04em;margin:2px 0 8px}
#hojaReviewCard .rvStats{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px}
#hojaReviewCard .rvStats span{padding:4px 10px;border-radius:999px;background:#f3e2c4;font-weight:800;font-size:14px}
#hojaReviewCard .rvMsg{margin:8px 0 0;font-weight:800;font-size:clamp(15px,2.6vw,18px)}
#hojaReviewCard .rvQ{margin:6px 0 12px;font-weight:900;font-size:clamp(18px,3.2vw,25px);line-height:1.4;word-break:keep-all}
#hojaReviewChoices{display:grid;gap:8px;margin:0 auto;max-width:520px}
#hojaReviewChoices.ox{grid-template-columns:1fr 1fr}
#hojaReviewChoices button{display:flex;gap:8px;align-items:center;justify-content:flex-start;text-align:left;padding:10px 14px;
  font:800 clamp(15px,2.6vw,19px) system-ui,sans-serif;color:#2b2420;background:#fff;border:3px solid #3b2a22;border-radius:10px;cursor:pointer}
#hojaReviewChoices.ox button{justify-content:center;font-size:clamp(26px,5vw,36px)}
#hojaReviewChoices button .n{display:inline-block;min-width:1.6em;padding:0 4px;border-radius:6px;background:#3b2a22;color:#fff;text-align:center;font-size:.85em}
#hojaReviewChoices button.ans{background:#d9f5d6;border-color:#2e8b3d}
#hojaReviewChoices button.miss{background:#ffe1d6;border-color:#d9573b}
#hojaReviewChoices button:disabled{cursor:default}
#hojaReviewCard .rvFeedback{min-height:1.4em;margin:10px 0 0;font-weight:900;font-size:clamp(16px,2.8vw,20px)}
#hojaReviewCard .rvFeedback.ok{color:#2e8b3d}
#hojaReviewCard .rvFeedback.no{color:#b23a1d}
#hojaReviewActions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:14px}
#hojaReviewActions button{padding:10px 20px;font:900 16px system-ui,sans-serif;border:3px solid #3b2a22;border-radius:10px;box-shadow:0 4px 0 #3b2a22;cursor:pointer}
#hojaReviewActions .primary{background:#ffd36b;color:#2b2420}
#hojaReviewActions .secondary{background:#fff;color:#2b2420}
#hojaReviewCard .rvHint{margin:10px 0 0;color:#7a5b48;font-size:13px;font-weight:700}
</style>
<script id="hojaP1CReview">
(function hojaReview(){
  'use strict';
  var ov=document.createElement('div');ov.id='hojaReviewOverlay';ov.hidden=true;ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','결산과 오답 풀이');
  ov.innerHTML='<div id="hojaReviewCard"></div>';
  var card=function(){return document.getElementById('hojaReviewCard');};
  var st=null; // {data, done, pending, round, phase:'result'|'ask'|'answered'|'roundEnd', list, i, fixed, missed, chosen, all}
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
  function primary(label,fn){return {label:label,fn:fn,kind:'primary'};}
  function secondary(label,fn){return {label:label,fn:fn,kind:'secondary'};}
  var actions=[];
  function setActions(list){
    actions=list;var box=document.getElementById('hojaReviewActions');box.replaceChildren();
    list.forEach(function(a){var b=document.createElement('button');b.type='button';b.className=a.kind;b.textContent=a.label+(a.kind==='primary'?' (Enter)':'');
      b.addEventListener('click',function(e){e.stopPropagation();a.fn();});box.append(b);});
  }
  function renderResult(){
    st.phase='result';
    var m=st.data.metrics,n=st.pending.length,first=st.round===0;
    var msg=st.all===0?'이번 게임에서는 푼 문제가 없습니다.':
      n?(first?'틀린 문제가 '+n+'개 있습니다. 다시 풀어 볼까요?':'아직 틀린 문제가 '+n+'개 남았습니다.'):
      (first?'틀린 문제 없이 모두 맞혔습니다!':'오답을 모두 맞혔습니다!');
    card().innerHTML='<p class="rvTop">결산</p><h2>'+(st.data.reason==='시간 종료'?'시간 종료':'모든 스테이지 완료')+'</h2>'+
      '<div class="rvScore">'+esc(String(Math.floor(m.score||0)).padStart(6,'0'))+'</div>'+
      '<div class="rvStats"><span>물음표 '+m.found+'/25</span><span>정답 '+m.correct+'</span><span>오답 '+m.wrong+'</span><span>남은 시간 '+m.remainingSeconds+'초</span></div>'+
      '<p class="rvMsg">'+esc(msg)+'</p><div id="hojaReviewActions"></div>';
    setActions(n?[primary('틀린 문제 다시 풀기 ('+n+'문제)',startRound),secondary('랭킹 화면으로',finish)]:[primary('랭킹 화면으로',finish)]);
  }
  function startRound(){st.round++;st.list=st.pending.slice();st.i=0;st.fixed=0;st.missed=[];renderAsk();}
  function renderAsk(){
    st.phase='ask';st.chosen=null;
    var it=st.list[st.i],ox=it.type==='OX';
    card().innerHTML='<p class="rvTop">오답 풀이 '+st.round+'회차 · '+(st.i+1)+' / '+st.list.length+' · 게임 중 '+it.order+'번째 문제 · '+(ox?'OX':'객관식')+'</p>'+
      '<p class="rvQ">'+esc(it.question)+'</p><div id="hojaReviewChoices" class="'+(ox?'ox':'')+'"></div>'+
      '<p class="rvFeedback" id="hojaReviewFeedback"></p><div id="hojaReviewActions"></div><p class="rvHint">숫자 키 '+(ox?'1·2':'1·2·3')+' 또는 보기를 눌러 고르기</p>';
    var box=document.getElementById('hojaReviewChoices');
    it.choices.forEach(function(c,i){var b=document.createElement('button');b.type='button';
      b.innerHTML=(ox?'':'<span class="n">'+(i+1)+'</span>')+'<span>'+esc(c)+'</span>';b.setAttribute('aria-label',(i+1)+'번 '+c);
      b.addEventListener('click',function(e){e.stopPropagation();answer(i);});box.append(b);});
    setActions([]);
  }
  function answer(i){
    if(!st||st.phase!=='ask')return;
    var it=st.list[st.i];if(i<0||i>=it.choices.length)return;
    st.phase='answered';st.chosen=i;
    var right=i===it.answerIndex;
    if(right)st.fixed++;else st.missed.push(it);
    st.log.push({order:it.order,familyId:it.familyId,round:st.round,chosenIndex:i,correct:right});
    var btns=document.getElementById('hojaReviewChoices').children;
    for(var k=0;k<btns.length;k++){btns[k].disabled=true;if(k===it.answerIndex)btns[k].classList.add('ans');}
    if(!right&&btns[i])btns[i].classList.add('miss');
    var fb=document.getElementById('hojaReviewFeedback');
    fb.className='rvFeedback '+(right?'ok':'no');
    fb.textContent=right?'정답! 이번에는 맞혔습니다.':'정답은 「'+it.choices[it.answerIndex]+'」입니다.';
    setActions([primary(st.i+1<st.list.length?'다음 문제':'이번 회차 끝',next)]);
  }
  function next(){
    if(st.i+1<st.list.length){st.i++;renderAsk();return;}
    st.pending=st.missed.slice();
    st.phase='roundEnd';
    var left=st.pending.length;
    card().innerHTML='<p class="rvTop">오답 풀이 '+st.round+'회차 끝</p><h2>'+st.list.length+'문제 중 '+st.fixed+'문제를 맞혔습니다</h2>'+
      '<p class="rvMsg">'+(left?'아직 틀린 문제가 '+left+'개 남았습니다.':'오답을 모두 맞혔습니다!')+'</p><div id="hojaReviewActions"></div>';
    setActions([primary('결산 화면으로',renderResult)]);
  }
  function finish(){
    if(!st)return;var cb=st.done;st=null;ov.hidden=true;
    if(window.HOJA_P1C_INPUT)window.HOJA_P1C_INPUT.releaseAll();
    try{cb&&cb();}catch(err){console.error(err);}
  }
  function open(data,done){
    var rows=Array.isArray(data&&data.rows)?data.rows:[];
    st={data:data,done:done,round:0,all:rows.filter(function(r){return r.correct!==null;}).length,
      pending:rows.filter(function(r){return r.correct===false;}),log:[]};
    lastLog=st.log;
    ov.hidden=false;renderResult();
  }
  var lastLog=[];
  window.addEventListener('keydown',function(e){
    if(!st)return;
    e.stopImmediatePropagation();
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    e.preventDefault();
    if(e.repeat)return;
    if(e.code==='Enter'||e.code==='NumpadEnter'||(!e.code&&e.key==='Enter')){var p=actions.filter(function(a){return a.kind==='primary';})[0];if(p)p.fn();return;}
    if(st.phase==='ask'){var m=/^(Digit|Numpad)([1-4])$/.exec(e.code)||(!e.code&&/^()([1-4])$/.exec(e.key));if(m)answer(Number(m[2])-1);}
  },true);
  window.addEventListener('keyup',function(e){if(st){e.stopImmediatePropagation();}},true);
  function mount(){document.body.appendChild(ov);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  window.HOJA_REVIEW=Object.freeze({open:open,get isOpen(){return !!st;},get phase(){return st?st.phase:null;},
    answer:function(i){answer(i);},log:function(){return lastLog.map(function(x){return Object.assign({},x);});}});
})();
</script>`;
export default {
  title: '문항별 응답 기록 + 개인 오답 풀이',
  arcade(A) {
    // 문제 창이 열릴 때 기록 줄을 만든다(화면에 나온 보기 순서 그대로)
    A.edit('  RUN.step09History.push({key:q.familyKey,type:q.type,correct:null,points:0});',
      "  RUN.step09History.push({key:q.familyKey,type:q.type,correct:null,points:0,order:RUN.step09History.length+1,source:q.source||'',\n" +
      "    familyId:String(q.familyKey).split('\\u0000').slice(1).join('\\u0000'),q:q.q,choices:q.choices.slice(),answer:q.answer,\n" +
      '    chosen:null,timedOut:false,openedAt:performance.now(),ms:null});');
    // 답을 고르면: 고른 보기와 풀이 시간
    A.edit('function hojaStep09_3Answer_(q,correct,points){\n  if(!EXTERNAL_QUESTIONS?.length)return;\n  const row=RUN.step09History?.find(x=>x.key===q.familyKey);\n  if(!row||row.correct!==null)return;\n  row.correct=!!correct;\n  row.points=points;\n  hojaStep09_3RenderProgress_();\n}',
      'function hojaStep09_3Answer_(q,correct,points,chosen){\n  if(!EXTERNAL_QUESTIONS?.length)return;\n  const row=RUN.step09History?.find(x=>x.key===q.familyKey);\n  if(!row||row.correct!==null)return;\n  row.correct=!!correct;\n  row.points=points;\n' +
      '  row.chosen=Number.isInteger(chosen)?chosen:null;\n  row.ms=Math.max(0,Math.round(performance.now()-(row.openedAt??performance.now())));\n  hojaStep09_3RenderProgress_();\n}\n' +
      '/* HOJA Phase 1C: 문항별 응답 기록(이 기기 안에만). 싱글 오답 풀이와 학급 분석이 같은 형식을 쓴다. */\n' +
      'function hojaP1CRecordRow_(x){const c=Array.isArray(x.choices)?x.choices:[];return {order:x.order,cartridge:x.source,familyId:x.familyId,type:x.type,question:x.q,' +
      'choices:c.slice(),answerIndex:x.answer,answerText:c[x.answer]??null,chosenIndex:x.chosen,chosenText:x.chosen==null?null:(c[x.chosen]??null),' +
      'correct:x.correct,timedOut:!!x.timedOut,ms:x.ms};}\n' +
      'window.HOJA_RUN_RECORD=()=>(RUN.step09History||[]).map(hojaP1CRecordRow_);');
    A.edit('hojaStep09_3Answer_(q,true,10);', 'hojaStep09_3Answer_(q,true,10,index);');
    A.edit('hojaStep09_3Answer_(q,false,0);', 'hojaStep09_3Answer_(q,false,0,index);');
    // 게임이 끝나면 랭킹 창보다 먼저 결산·오답 풀이
    A.edit('function hojaRankShow_(scene, reason){\n  if(!EXTERNAL_QUESTIONS?.length)return;',
      'function hojaRankShow_(scene, reason){\n' +
      '  if(EXTERNAL_QUESTIONS?.length&&!HOJA_RANK_TEST_MODE_&&window.HOJA_REVIEW){\n' +
      '    if(window.HOJA_P1C_INPUT)window.HOJA_P1C_INPUT.releaseAll();\n' +
      '    window.HOJA_REVIEW.open({reason,metrics:hojaStep09_3Metrics_(scene),rows:window.HOJA_RUN_RECORD()},()=>hojaRankShowAfterReview_(scene,reason));\n' +
      '    return;\n  }\n  return hojaRankShowAfterReview_(scene,reason);\n}\n' +
      'function hojaRankShowAfterReview_(scene, reason){\n  if(!EXTERNAL_QUESTIONS?.length)return;');
    A.beforeBodyEnd(REVIEW);
  },
};
