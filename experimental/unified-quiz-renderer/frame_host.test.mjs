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

test('late show responses cannot reactivate stale or suspended questions',async()=>{
 const listeners=new Set(),commands=[],answers=[],old=globalThis.window;
 globalThis.window={addEventListener:(_,f)=>listeners.add(f),removeEventListener:(_,f)=>listeners.delete(f)};
 const frame={tagName:'IFRAME',contentWindow:{postMessage:c=>commands.push(c)}};
 const send=data=>listeners.forEach(f=>f({data,source:frame.contentWindow}));
 try{
  const h=createApprovedFrameHost({frame,onAnswer:v=>answers.push(v)});
  const first=h.show({questionId:'old'}),second=h.show({questionId:'new'});
  send({type:'HOJA_UNIFIED_RESULT',requestId:commands[1].requestId,ok:true});await second;
  send({type:'HOJA_UNIFIED_RESULT',requestId:commands[0].requestId,ok:true});await first;
  send({type:'HOJA_UNIFIED_ANSWER',questionId:'old',choiceId:'c1'});
  send({type:'HOJA_UNIFIED_ANSWER',questionId:'new',choiceId:'c2'});
  assert.deepEqual(answers.map(a=>a.questionId),['new']);
  const third=h.show({questionId:'third'});h.suspend();
  send({type:'HOJA_UNIFIED_RESULT',requestId:commands[2].requestId,ok:true});await third;
  send({type:'HOJA_UNIFIED_ANSWER',questionId:'third',choiceId:'c1'});
  assert.equal(answers.length,1);h.close();
 }finally{globalThis.window=old}
});
