/** Team/single wrong-answer review controller. Never changes original score, rank, or winner. */
export function teamWrongAnswerRows({questions,done,teams}){
 if(!Array.isArray(questions)||!(done instanceof Map)||!Array.isArray(teams))throw new TypeError('TEAM_REVIEW_SOURCE_INVALID');
 const byNumber=new Map(questions.map(q=>[q.num,q])),items=[];
 for(const [number,record] of done){
  if(record?.correct!==false)continue;
  const q=byNumber.get(number);
  if(!q||!Number.isInteger(record.team)||!teams[record.team])throw Error('TEAM_REVIEW_RECORD_MISMATCH');
  if(!q.rendererQuestion||!q.rendererQuestion.id||!['MCQ','OX','SHORT'].includes(q.rendererQuestion.type))throw Error('TEAM_REVIEW_APPROVED_RENDER_DATA_REQUIRED');
  items.push(Object.freeze({id:'team:'+number,questionId:q.rendererQuestion.id,number,teamIndex:record.team,teamName:teams[record.team].name,type:q.rendererQuestion.type,rendererQuestion:q.rendererQuestion,originalCorrect:false}));
 }
 return Object.freeze(items.sort((a,b)=>a.number-b.number));
}
export function singleWrongAnswerRows(records){
 if(!Array.isArray(records))throw new TypeError('SINGLE_REVIEW_SOURCE_INVALID');
 return Object.freeze(records.filter(r=>r.correct===false).map((r,i)=>{
  if(!r.rendererQuestion||!r.rendererQuestion.id)throw Error('SINGLE_REVIEW_APPROVED_RENDER_DATA_REQUIRED');
  return Object.freeze({id:String(r.id??'single:'+(i+1)),questionId:r.rendererQuestion.id,type:r.rendererQuestion.type,rendererQuestion:r.rendererQuestion,originalCorrect:false});
 }));
}
export function createReviewSession(rows,onComplete=()=>{}){
 if(!Array.isArray(rows)||typeof onComplete!=='function')throw new TypeError('REVIEW_SESSION_INVALID');
 const ids=new Set();
 for(const r of rows){if(!r||typeof r.id!=='string'||ids.has(r.id)||!['MCQ','OX','SHORT'].includes(r.type)||!r.rendererQuestion)throw Error('REVIEW_SESSION_ROW_INVALID');ids.add(r.id);}
 const originals=Object.freeze(rows.slice());
 let pending=originals.slice(),thisRound=[],failed=[],index=0,phase='ready',round=0,notified=false;
 const log=[];
 const state=()=>Object.freeze({phase,round,remaining:pending.length,current:(phase==='asking'||phase==='answered')?thisRound[index]:null,originalCount:originals.length,complete:phase==='complete'});
 const finishZero=()=>{
  if(pending.length)throw Error('REVIEW_PENDING_NOT_EMPTY');
  phase='complete';if(!notified){notified=true;onComplete({rounds:round,reviewed:originals.length,log:log.slice()});}return state();
 };
 return Object.freeze({
  get state(){return state();},get log(){return Object.freeze(log.slice());},
  beginRound(){
   if(phase==='complete')return state();
   if(phase!=='ready'&&phase!=='roundEnd')throw Error('REVIEW_ROUND_STATE');
   if(!pending.length)return finishZero();
   thisRound=pending.slice();failed=[];index=0;round++;phase='asking';return state();
  },
  mark(correct){
   if(phase!=='asking'||typeof correct!=='boolean')throw Error('REVIEW_ANSWER_STATE');
   const row=thisRound[index];if(!correct)failed.push(row);
   log.push(Object.freeze({id:row.id,questionId:row.questionId,round,correct}));
   phase='answered';return state();
  },
  next(){
   if(phase!=='answered')throw Error('REVIEW_NEXT_STATE');
   if(++index<thisRound.length){phase='asking';return state();}
   pending=failed.slice();phase='roundEnd';return state();
  },
  finish(){
   if(phase==='complete')return state();
   if(phase!=='ready'&&phase!=='roundEnd')throw Error('REVIEW_FINISH_STATE');
   return finishZero();
  }
 });
}
/** Client precheck only. Server-side verified review completion remains to be built. */
export function canShowArcadeRanking({mode,unitCount,finish,reviewComplete}){
 return mode==='singleArcade'&&unitCount===1&&finish==='FINISH'&&reviewComplete===true;
}
