import test from 'node:test';
import assert from 'node:assert/strict';
import {teamWrongAnswerRows,createReviewSession,canShowArcadeRanking} from './HOJA_REVIEW_SESSION.mjs';
const q=(n,type='MCQ')=>({num:n,rendererQuestion:{id:'q'+n,type,prompt:'문항'+n}});
test('unplayed balloons do not enter review; team scores and answer records remain unchanged',()=>{
 const questions=Array.from({length:25},(_,i)=>q(i+1,i===8?'SHORT':'MCQ'));
 const done=new Map([[1,{correct:true,team:0}],[2,{correct:false,team:1}],[9,{correct:false,team:0}]]);
 const teams=[{name:'호자팀',score:90},{name:'나한팀',score:100}];
 const before=JSON.stringify({questions,done:[...done],teams});
 const rows=teamWrongAnswerRows({questions,done,teams});
 assert.deepEqual(rows.map(x=>x.number),[2,9]);assert.equal(rows[1].type,'SHORT');
 assert.equal(JSON.stringify({questions,done:[...done],teams}),before);
});
test('repeat wrong answers until all correct; completion callback only once',()=>{
 const questions=[q(1),q(2,'SHORT')],done=new Map([[1,{correct:false,team:0}],[2,{correct:false,team:0}]]);
 let n=0;const session=createReviewSession(teamWrongAnswerRows({questions,done,teams:[{name:'1팀',score:20}]}),()=>n++);
 assert.throws(()=>session.finish(),/REVIEW_PENDING_NOT_EMPTY/);
 session.beginRound();session.mark(false);session.next();session.mark(true);session.next();
 assert.equal(session.state.remaining,1);session.beginRound();session.mark(true);session.next();session.finish();session.finish();
 assert.equal(n,1);assert.equal(session.state.complete,true);
});
test('zero wrong answer finishes immediately',()=>{let n=0;const session=createReviewSession([],()=>n++);session.beginRound();session.finish();assert.equal(n,1)});
test('missing approved visual data blocks review',()=>{assert.throws(()=>teamWrongAnswerRows({questions:[{num:1}],done:new Map([[1,{correct:false,team:0}]]),teams:[{name:'1팀'}]}),/APPROVED_RENDER_DATA_REQUIRED/)});
test('only single-unit arcade FINISH after completed review can show ranking',()=>{
 assert.equal(canShowArcadeRanking({mode:'singleArcade',unitCount:1,finish:'FINISH',reviewComplete:true}),true);
 for(const p of [{mode:'singleArcade',unitCount:2,finish:'FINISH',reviewComplete:true},{mode:'singleQuiz',unitCount:1,finish:'FINISH',reviewComplete:true},{mode:'team',unitCount:1,finish:'FINISH',reviewComplete:true},{mode:'singleArcade',unitCount:1,finish:'FINISH',reviewComplete:false}])assert.equal(canShowArcadeRanking(p),false);
});