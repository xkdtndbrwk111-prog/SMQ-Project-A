'use strict';
window.HOJA_CREATE_SETTLEMENT=function({run,activeScene,hasQuestions,pointsPerFlower,totalQuestions,closeRanking,showRanking}){
  function finalizeFlowerBonus(scene){
    const flowers=run.stages?.reduce((n,mem)=>n+(mem?.flowers?.size||0),0)||0;
    if(!run.flowerBonusGiven){
      run.flowerBonusGiven=true;
      run.flowerBonus=flowers*pointsPerFlower;
      scene.score+=run.flowerBonus;
      run.score=scene.score;
    }
    return {flowers,bonus:run.flowerBonus||0};
  }

  function finalizeFinish(scene){
    if(scene.timeBonusGiven)return;
    // Leftover time counts only in proportion to '?' found, so skipping
    // questions to finish fast never beats finding them.
    scene.timeBonusGiven=true;
    const sec=Math.ceil(scene.remainingMs/1000);
    scene.timeBonus=Math.round(sec*run.found/totalQuestions);
    if(scene.timeBonus>0)scene.awardScore(scene.timeBonus,scene.playerBody.x,scene.playerBody.body.top,'TIME BONUS');
    scene.timeBonusSec=sec;
    const flowerResult=finalizeFlowerBonus(scene);
    scene.finalFlowerCount=flowerResult.flowers;
    scene.finalFlowerBonus=flowerResult.bonus;
  }

  function hojaStep09_3Metrics_(scene=activeScene()){
    const hist=run.step09History||[];
    const answered=hist.filter(x=>x.correct!==null).length;
    const correct=hist.filter(x=>x.correct===true).length;
    const quizPoints=hist.reduce((a,x)=>a+x.points,0);
    const score=scene?.score??run.score;
    const flowers=run.stages?.reduce((n,m)=>n+(m?.flowers?.size||0),0)||0;
    const flowerBonus=run.flowerBonus||0;
    const timeBonus=scene?.timeBonus||0;
    return {found:run.found,usedFamilies:run.step09Families?.size||0,answered,correct,
      wrong:answered-correct,quizPoints,score,flowers,flowerBonus,timeBonus,
      otherPoints:score-quizPoints-flowerBonus-timeBonus,
      remainingSeconds:Math.ceil(Math.max(0,scene?.remainingMs??run.remainingMs)/1000)};
  }
  function hojaStep09_3RenderProgress_(){
    if(!hasQuestions())return;
    const el=document.getElementById('step09Progress');
    if(!el)return;
    const m=hojaStep09_3Metrics_();
    el.style.display='block';
    el.textContent=`만난 문제 ${m.found}/25 · 답변 ${m.answered} · 정답 ${m.correct} · 문제 점수 ${m.quizPoints}점`;
  }
  function hojaStep09_3ResetDisplay_(){
    closeRanking();
    const el=document.getElementById('step09RunResult');if(el)el.style.display='none';
    hojaStep09_3RenderProgress_();
  }
  function hojaStep09_3ShowResult_(scene,reason){
    if(!hasQuestions())return;
    const el=document.getElementById('step09RunResult');
    const title=document.getElementById('step09RunResultTitle');
    const body=document.getElementById('step09RunResultBody');
    if(!el||!title||!body)return;
    const m=hojaStep09_3Metrics_(scene);
    const valid=m.usedFamilies===m.found && m.answered<=m.found && m.found<=25 &&
      m.quizPoints===m.correct*10 && m.otherPoints>=0;
    title.textContent='STEP 09-3 · '+reason+' · '+(valid?'문항·점수 정산 확인':'문항·점수 정산 확인 필요');
    body.textContent=`물음표 발견 ${m.found}/25 · 고유 문제 ${m.usedFamilies}/25 · 답변 ${m.answered}개\n`+
      `정답 ${m.correct}개 · 오답 ${m.wrong}개 · 미답변 ${m.found-m.answered}개\n`+
      `문제 점수 +${m.quizPoints} · 탐험 기타 점수 +${m.otherPoints}\n`+
      `과일 ${m.flowers}개(+${m.flowerBonus}) · 시간 보너스 +${m.timeBonus}\n`+
      `남은 시간 ${m.remainingSeconds}초 · 최종 점수 ${String(m.score).padStart(6,'0')}`;
    el.style.display='block';
    el.dataset.verified=String(valid);
    hojaStep09_3RenderProgress_();
    showRanking(scene,reason);
  }
  return {
    finalizeFlowerBonus, finalizeFinish, hojaStep09_3Metrics_, hojaStep09_3RenderProgress_,
    hojaStep09_3ResetDisplay_, hojaStep09_3ShowResult_
  };
};
