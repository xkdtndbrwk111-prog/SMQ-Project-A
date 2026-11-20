// Response record owns no game state; dependencies are supplied by the host.
window.HOJA_CREATE_RECORD=({run:RUN,hasQuestions,onProgress,now})=>{
function hojaStep09_3Open_(q){
  if(!q||!q.familyKey||!['MC','OX'].includes(q.type)||
     !Array.isArray(q.choices)||q.choices.length!==(q.type==='OX'?2:3)||
     !Number.isInteger(q.answer)||q.answer<0||q.answer>=q.choices.length)return false;
  if(!RUN.step09Families)RUN.step09Families=new Set();
  if(!RUN.step09History)RUN.step09History=[];
  if(RUN.step09Families.size>=25||RUN.step09Families.has(q.familyKey))return false;
  RUN.step09Families.add(q.familyKey);
  RUN.step09History.push({key:q.familyKey,type:q.type,correct:null,points:0,order:RUN.step09History.length+1,source:q.source||'',
    familyId:String(q.familyKey).split('\u0000').slice(1).join('\u0000'),q:q.q,choices:q.choices.slice(),answer:q.answer,
    chosen:null,timedOut:false,openedAt:now(),ms:null});
  return true;
}
function hojaStep09_3Answer_(q,correct,points,chosen){
  if(!hasQuestions())return;
  const row=RUN.step09History?.find(x=>x.key===q.familyKey);
  if(!row||row.correct!==null)return;
  row.correct=!!correct;
  row.points=points;
  row.chosen=Number.isInteger(chosen)?chosen:null;
  row.ms=Math.max(0,Math.round(now()-(row.openedAt??now())));
  onProgress();
}
/* HOJA Phase 1C: 문항별 응답 기록(이 기기 안에만). 싱글 오답 풀이와 학급 분석이 같은 형식을 쓴다. */
function hojaP1CRecordRow_(x){const c=Array.isArray(x.choices)?x.choices:[];return {order:x.order,cartridge:x.source,familyId:x.familyId,type:x.type,question:x.q,choices:c.slice(),answerIndex:x.answer,answerText:c[x.answer]??null,chosenIndex:x.chosen,chosenText:x.chosen==null?null:(c[x.chosen]??null),correct:x.correct,timedOut:!!x.timedOut,ms:x.ms};}

return Object.freeze({hojaStep09_3Open_,hojaStep09_3Answer_,rows:()=>(RUN.step09History||[]).map(hojaP1CRecordRow_)});
};
