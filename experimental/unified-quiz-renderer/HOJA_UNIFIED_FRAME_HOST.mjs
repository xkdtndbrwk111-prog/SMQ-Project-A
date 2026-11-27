/** Command/event host for the original teacher-approved A/C/D renderer. No scoring here. */
export function createApprovedFrameHost({frame,onAnswer=()=>{},timeoutMs=6000}={}) {
 if(!frame||frame.tagName!=='IFRAME'||typeof onAnswer!=='function') throw Error('HOJA_FRAME_OPTIONS_REQUIRED');
 const pending=new Map();let seq=0,closed=false,activeId=null,accepted=false,generation=0;
 const reset=()=>{generation++;activeId=null;accepted=false};
 function onMessage(ev){
   if(closed||ev.source!==frame.contentWindow)return;
   const d=ev.data;if(!d||typeof d!=='object')return;
   if(d.type==='HOJA_UNIFIED_RESULT'){
     const job=pending.get(d.requestId);if(!job)return;
     clearTimeout(job.timer);pending.delete(d.requestId);
     if(d.ok)job.resolve(d);else job.reject(Error('HOJA_RENDERER_COMMAND_FAILED: '+d.error));
   } else if(d.type==='HOJA_UNIFIED_ANSWER'){
     if(typeof d.questionId!=='string'||d.questionId!==activeId||accepted||!d.choiceId)return;
     accepted=true;
     onAnswer(Object.freeze({questionId:d.questionId,choiceId:String(d.choiceId),choiceText:String(d.choiceText||'')}));
   }
 }
 window.addEventListener('message',onMessage);
 function request(action,payload){
   if(closed)return Promise.reject(Error('HOJA_FRAME_CLOSED'));
   if(!frame.contentWindow)return Promise.reject(Error('HOJA_FRAME_NOT_READY'));
   const requestId='hq-'+(++seq);
   return new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('HOJA_RENDERER_TIMEOUT: '+action))},timeoutMs);
     pending.set(requestId,{timer,resolve,reject});
     frame.contentWindow.postMessage({type:'HOJA_UNIFIED_COMMAND',action,payload,requestId},'*');
   });
 }
 return Object.freeze({
   async initialize(){await request('embed');await request('capture',true);return true},
   async load(payload){reset();return request('load',payload)},
   async show({questionId,mode='team',omitChoiceId=null}={}){
     if(typeof questionId!=='string'||!questionId)throw Error('HOJA_QUESTION_ID_REQUIRED');
     reset();const currentGeneration=generation;const response=await request('show',{questionId,mode,omitChoiceId});if(!closed&&generation===currentGeneration)activeId=questionId;return response;
   },
   async inspect(){return request('inspect')},
   suspend(){reset()},
   close(){
     if(closed)return;closed=true;reset();window.removeEventListener('message',onMessage);
     for(const job of pending.values()){clearTimeout(job.timer);job.reject(Error('HOJA_FRAME_CLOSED'))}
     pending.clear();
   }
 });
}
