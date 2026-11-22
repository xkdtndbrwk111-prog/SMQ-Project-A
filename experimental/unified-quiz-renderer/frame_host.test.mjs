import test from 'node:test';
import assert from 'node:assert/strict';
import {createApprovedFrameHost} from './HOJA_UNIFIED_FRAME_HOST.mjs';
function fixture() {
 const listeners=new Set(),commands=[];
 const old=globalThis.window;
 globalThis.window={addEventListener:(k,f)=>{if(k==='message')listeners.add(f)},removeEventListener:(k,f)=>{if(k==='message')listeners.delete(f)}};
 const frame={tagName:'IFRAME',contentWindow:{postMessage(c){
   commands.push(c);queueMicrotask(()=>send({type:'HOJA_UNIFIED_RESULT',requestId:c.requestId,ok:true,data:c.action}));
 }}};
 const send=(data,source=frame.contentWindow)=>{for(const f of listeners)f({data,source})};
 return {frame,send,commands,cleanup:()=>{globalThis.window=old}};
}
test('same approved renderer: command routing, deduplication, teacher verdict',async()=>{
 const f=fixture(),answers=[];try{
  const h=createApprovedFrameHost({frame:f.frame,onAnswer:v=>answers.push(v)});
  await h.initialize();await h.load({questions:[{id:'q1'}]});await h.show({questionId:'q1',mode:'team'});
  assert.deepEqual(f.commands.map(v=>v.action),['embed','capture','load','show']);
  f.send({type:'HOJA_UNIFIED_ANSWER',questionId:'q1',choiceId:'c2'});
  f.send({type:'HOJA_UNIFIED_ANSWER',questionId:'q1',choiceId:'c3'});
  assert.equal(answers.length,1);
  await h.show({questionId:'q2',mode:'review'});
  f.send({type:'HOJA_UNIFIED_ANSWER',questionId:'q1',choiceId:'c1'});
  f.send({type:'HOJA_UNIFIED_ANSWER',questionId:'q2',choiceId:'teacher:false'});
  assert.equal(answers.length,2);assert.equal(answers[1].choiceId,'teacher:false');
  h.close();
 }finally{f.cleanup()}
});
test('foreign frames, suspended or stale questions cannot submit',async()=>{
 const f=fixture(),answers=[];try{
  const h=createApprovedFrameHost({frame:f.frame,onAnswer:v=>answers.push(v)});
  await h.show({questionId:'q1'});
  f.send({type:'HOJA_UNIFIED_ANSWER',questionId:'q1',choiceId:'c1'},{});
  h.suspend();f.send({type:'HOJA_UNIFIED_ANSWER',questionId:'q1',choiceId:'c1'});
  assert.equal(answers.length,0);h.close();
 }finally{f.cleanup()}
});
