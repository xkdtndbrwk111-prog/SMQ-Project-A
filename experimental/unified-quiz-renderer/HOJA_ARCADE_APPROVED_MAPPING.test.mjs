import test from 'node:test';
import assert from 'node:assert/strict';
import {bindTeamApprovedQuestion,teamApprovedPayload} from './HOJA_TEAM_APPROVED_BINDING.mjs';
import {createApprovedArcadeCatalog,resolveApprovedArcadeChoice} from './HOJA_ARCADE_APPROVED_MAPPING.mjs';
const core={bindTeamApprovedQuestion,teamApprovedPayload};
const mk=()=>{
 const questions=[];
 for(let i=0;i<26;i++){
  const id='q'+i;
  if(i===1){
   questions.push({familyId:id,type:'OX',question:'OX?',answer:'X',
    rendererQuestion:{id,type:'OX',prompt:'OX?',answer:{value:false}}});
  }else{
   questions.push({familyId:id,type:'MULTIPLE',question:'MC?',answer:'4',options:['red','blue','green','gold'],
    rendererQuestion:{id,type:'MCQ',prompt:'MC?',choices:[
     {id:'r',text:'red'},{id:'b',text:'blue'},{id:'g',text:'green'},{id:'y',text:'gold'}
    ],answer:{choiceId:'y'}}});
  }
 }
 return [{sheetName:'사회6',data:{questionSchemaVersion:2,sourceSheetVersion:2,questions,images:{},tags:Object.fromEntries(questions.map(q=>[q.rendererQuestion.id,{layout:{type:'A'}}])),unitMeta:{grade:6}}}];
};
test('approved catalog retains canonical renderer questions and 4-source choices',()=>{
 const cat=createApprovedArcadeCatalog(mk(),core);
 assert.equal(cat.count,26);assert.equal(cat.payload.questions.length,26);assert.equal(cat.payload.questions[0].choices.length,4);
});
test('arcade MC3 mixed choice order maps renderer ID to existing scorer index',()=>{
 const cat=createApprovedArcadeCatalog(mk(),core);
 const a=resolveApprovedArcadeChoice(cat,{familyKey:'사회6\u0000q0',type:'MC',choices:['green','gold','red'],answer:1},core);
 assert.equal(a.choiceIdToArcadeIndex.y,1);assert.equal(a.choiceIdToArcadeIndex.g,0);
 assert.equal(a.binding.omitChoiceId,'b');
});
test('arcade OX reverse order maps true/false and preserves scorer answer',()=>{
 const cat=createApprovedArcadeCatalog(mk(),core);
 const a=resolveApprovedArcadeChoice(cat,{familyKey:'사회6\u0000q1',type:'OX',choices:['X','O'],answer:0},core);
 assert.equal(a.choiceIdToArcadeIndex.true,1);assert.equal(a.choiceIdToArcadeIndex.false,0);
});
test('scorer answer mismatch is rejected, never silently awarded',()=>{
 const cat=createApprovedArcadeCatalog(mk(),core);
 assert.throws(()=>resolveApprovedArcadeChoice(cat,{familyKey:'사회6\u0000q0',type:'MC',choices:['green','gold','red'],answer:0},core),/SCORER_ANSWER_MISMATCH/);
 assert.throws(()=>resolveApprovedArcadeChoice(cat,{familyKey:'사회6\u0000q1',type:'OX',choices:['X','O'],answer:1},core),/OX_SCORER_ANSWER_MISMATCH/);
});
test('unapproved, missing metadata, ambiguous and forged choices are rejected',()=>{
 const cat=createApprovedArcadeCatalog(mk(),core);
 assert.throws(()=>resolveApprovedArcadeChoice(cat,{familyKey:'사회6\u0000fake',type:'MC',choices:['green','gold','red'],answer:1},core),/UNAPPROVED/);
 assert.throws(()=>resolveApprovedArcadeChoice(cat,{familyKey:'사회6\u0000q0',type:'MC',choices:['gold','gold','red'],answer:0},core));
 const bad=mk();delete bad[0].data.tags;
 assert.throws(()=>createApprovedArcadeCatalog(bad,core),/METADATA/);
});
