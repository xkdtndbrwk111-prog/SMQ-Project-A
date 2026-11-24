import test from 'node:test';
import assert from 'node:assert/strict';
import {bindTeamApprovedQuestion,teamRendererAnswerIndex,teamApprovedPayload} from './HOJA_TEAM_APPROVED_BINDING.mjs';
const bank={images:{'map.webp':'data:image/webp;base64,AAAA'},tags:{q1:{layout:{preferredLayout:'C'}}},unitMeta:{u1:{label:'6학년 사회'}}};
const question={id:'q1',unit:'u1',type:'MCQ',prompt:'지도',image:'map.webp',choices:[
{id:'c1',text:'한강'},{id:'c2',text:'금강'},{id:'c3',text:'영산강'},{id:'c4',text:'낙동강'}],answer:{choiceId:'c4'},renderTags:{layout:{preferredLayout:'C'}}};
const q={num:3,type:'MC3',choices:['낙동강','한강','금강'],sourceChoiceIndices:[3,0,1],answer:0,approvedSource:{row:{rendererQuestion:question},bank,questionId:'q1'}};
test('C layout and canonical 4->3 answers survive',()=>{
 const b=bindTeamApprovedQuestion(q);
 assert.equal(b.omitChoiceId,'c3');assert.equal(b.rendererQuestion.renderTags.layout.preferredLayout,'C');
 assert.equal(teamRendererAnswerIndex(b,'c4'),0);assert.equal(teamRendererAnswerIndex(b,'c1'),1);
 assert.throws(()=>teamRendererAnswerIndex(b,'c3'),/UNKNOWN_CHOICE/);
 assert.deepEqual(teamApprovedPayload([b]).questions,[question]);
});
test('no approved question means explicit failure',()=>{
 assert.throws(()=>bindTeamApprovedQuestion({...q,approvedSource:{row:{},bank}}),/APPROVED_QUESTION_REQUIRED/);
});
test('missing map means explicit failure',()=>{
 assert.throws(()=>bindTeamApprovedQuestion({...q,approvedSource:{row:{rendererQuestion:question},bank:{...bank,images:{}}}}),/MISSING_IMAGE/);
});
test('wrong option mapping cannot produce unrelated score',()=>{
 assert.throws(()=>bindTeamApprovedQuestion({...q,choices:['한강','금강','영산강'],sourceChoiceIndices:[0,1,2]}),/ANSWER_MISMATCH/);
});
test('OX canonical answer mapping',()=>{
 const ox={id:'ox1',unit:'u1',type:'OX',answer:{value:false},renderTags:{layout:{preferredLayout:'A'}}};
 const b=bindTeamApprovedQuestion({num:1,type:'OX',answer:1,approvedSource:{row:{rendererQuestion:ox},bank}});
 assert.equal(teamRendererAnswerIndex(b,'false'),1);
});
test('teacher SHORT mapping',()=>{
 const short={id:'s1',unit:'u1',type:'SHORT',answer:{text:'한반도'},renderTags:{layout:{preferredLayout:'A'}}};
 assert.equal(bindTeamApprovedQuestion({num:1,type:'SUBJECTIVE',answerText:'한반도',approvedSource:{row:{rendererQuestion:short},bank}}).rendererQuestion.type,'SHORT');
});
test('duplicate approved questions are rejected',()=>{
 const b=bindTeamApprovedQuestion(q);assert.throws(()=>teamApprovedPayload([b,b]),/DUPLICATE/);
});
