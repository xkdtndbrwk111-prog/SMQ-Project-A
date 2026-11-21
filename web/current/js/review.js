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
    card().innerHTML='<p class="rvTop">결산</p><h2>'+(st.data.reason==='시간 종료'?'시간 종료':st.data.reason==='문제 25개 완료'?'문제 25개 완료':'모든 스테이지 완료')+'</h2>'+
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
