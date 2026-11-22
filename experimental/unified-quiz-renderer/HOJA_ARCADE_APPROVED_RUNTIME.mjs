/* Trial-only parent/inner arcade transport. No score computation, no fallback renderer. */
import {createApprovedArcadeCatalog,resolveApprovedArcadeChoice} from './HOJA_ARCADE_APPROVED_MAPPING.mjs';

function substituteOnce(s,oldText,newText) {
 const n=s.split(oldText).length-1;
 if(n!==1)throw Error('ARCADE_INNER_ANCHOR_COUNT_'+n+': '+oldText.slice(0,32));
 return s.replace(oldText,newText);
}
const CHILD_SCRIPT=[
 '<script id="hojaArcadeApprovedChildTrial">',
 "(()=>{'use strict';",
 ' let active=null,serial=0,review=null;',
 " const send=data=>parent.postMessage(data,'*');",
 ' window.HOJA_ARCADE_APPROVED_BRIDGE=Object.freeze({',
 '  open(question,finish){',
 "   if(window===parent||!question?.familyKey||!Array.isArray(question.choices)||typeof finish!=='function')throw Error('ARCADE_CHILD_NOT_READY');",
 "   if(active)throw Error('ARCADE_CHILD_ALREADY_OPEN');",
 "   const id='ha-'+(++serial);",
 '   active={id,finish,responded:false};',
 "   send({type:'HOJA_ARCADE_APPROVED_OPEN',id,question:{familyKey:question.familyKey,type:question.type,choices:question.choices.slice(),answer:question.answer}});",
 '   return true;',
 '  },',
 "  verdict(correct){if(active)send({type:'HOJA_ARCADE_APPROVED_VERDICT',id:active.id,correct:!!correct})},",
 '  close(){if(!active)return;const id=active.id;active=null;send({type:\'HOJA_ARCADE_APPROVED_CLOSE\',id})},',
 '  startReview(rows,onDone){',
 "   if(active||review||typeof onDone!=='function'||!Array.isArray(rows))throw Error('ARCADE_REVIEW_BAD_STATE');",
 "   const wrong=rows.filter(x=>x&&x.correct===false&&(x.type==='MC'||x.type==='OX')&&typeof x.key==='string');",
   '   if(!wrong.length)return false;',
 "   const id='hr-'+(++serial);review={id,onDone};",
 "   send({type:'HOJA_ARCADE_APPROVED_REVIEW_START',id,wrong:wrong.map(x=>({key:x.key,type:x.type}))});",
   '   return true;',
   '  }',
 ' });',
 " window.addEventListener('message',ev=>{",
 "  if(ev.source!==parent)return;",
 "  const d=ev.data;",
 "  if(d?.type==='HOJA_ARCADE_APPROVED_REVIEW_DONE'){",
 "   if(!review||review.id!==d.id)return;",
 "   const done=review.onDone;review=null;done();return;",
 '  }',
 "  if(d?.type!=='HOJA_ARCADE_APPROVED_SELECT')return;",
 '  if(!active||active.id!==d.id||active.responded||!Number.isInteger(d.index))return;',
 '  active.responded=true;active.finish(d.index);',
 ' });',
 '})();',
 '</scr'+'ipt>'
].join('\n');

export function patchApprovedArcadeInnerHTML(html){
 if(typeof html!=='string'||html.length<400000||!html.includes('hojaV058ServerGate'))throw Error('ARCADE_APPROVED_INNER_HTML_REQUIRED');
 if(html.includes('hojaArcadeApprovedChildTrial'))throw Error('ARCADE_APPROVED_ALREADY_PATCHED');
 let s=html;
 s=substituteOnce(s,
 '  closeQuizOverlay(){\n    this.quizToken=(this.quizToken||0)+1;',
 '  closeQuizOverlay(){\n    this.quizToken=(this.quizToken||0)+1;\n    window.HOJA_ARCADE_APPROVED_BRIDGE?.close();');
 s=substituteOnce(s,
 '      const correct=index===q.answer;\n      const btn=choices.children[index];',
 '      const correct=index===q.answer;\n      window.HOJA_ARCADE_APPROVED_BRIDGE?.verdict(correct);\n      const btn=choices.children[index];');
 s=substituteOnce(s,
 "        overlay.classList.remove('active','hojaQuizSuccess');\n        this.quizActive=false;",
 "        overlay.classList.remove('active','hojaQuizSuccess');\n        window.HOJA_ARCADE_APPROVED_BRIDGE?.close();\n        this.quizActive=false;");
 s=substituteOnce(s,
 '      },650);\n    };\n\n    q.choices.forEach((label,index)=>{',
 '      },1100);\n    };\n\n    q.choices.forEach((label,index)=>{');
 s=substituteOnce(s,
 '    q.choices.forEach((label,index)=>{',
 "    // Approved parent renderer owns display only. The original finish(index) below owns score.\n"+
 "    window.HOJA_ARCADE_APPROVED_BRIDGE.open({familyKey:q.familyKey,type:q.type,choices:q.choices,answer:q.answer},finish);\n"+
 "    overlay.classList.add('active');\n"+
 "    this.scene.pause();\n"+
 "    return;\n"+
 "    // Original buttons preserved but not reached during the trial.\n"+
 '    q.choices.forEach((label,index)=>{');
 s=substituteOnce(s,
 "  const eligible=reason==='전체 스테이지 완료'&&verified&&!!HOJA_RANK_CARTRIDGE_&&!HOJA_RANK_TEST_MODE_;",
 "  const eligible=reason==='전체 스테이지 완료'&&verified&&m.found===25&&m.answered===25&&m.usedFamilies===25&&!!HOJA_RANK_CARTRIDGE_&&!HOJA_RANK_TEST_MODE_;");
 s=substituteOnce(s,
 '  hojaStep09_3RenderProgress_();\n  hojaRankShow_(scene,reason);\n}',
 '  hojaStep09_3RenderProgress_();\n  if(!window.HOJA_ARCADE_APPROVED_BRIDGE?.startReview?.(RUN.step09History||[],()=>hojaRankShow_(scene,reason)))\n    hojaRankShow_(scene,reason);\n}');
 return substituteOnce(s,'</body>',CHILD_SCRIPT+'\n</body>');
}

export function createApprovedArcadeRuntime({core,getApprovedHTML,getArcadeFrame,getContainer}){
 if(!core?.createApprovedFrameHost||!core?.teamApprovedPayload)throw Error('ARCADE_APPROVED_CORE_REQUIRED');
 let catalog=null,active=null,overlay=null,frame=null,host=null,loading=null,epoch=0,focus=-1,review=null,reviewBar=null,reviewLabel=null,reviewNext=null;
 const wrong=new Map();
 function ensureUI(){
  if(overlay)return;
  const root=getContainer();if(!root)throw Error('ARCADE_APPROVED_CONTAINER_REQUIRED');
  overlay=document.createElement('div');overlay.id='hojaArcadeApprovedParentOverlay';
  overlay.style.cssText='position:absolute;left:0;right:0;top:62px;bottom:0;z-index:5000;background:#071421;display:none;';
  frame=document.createElement('iframe');frame.id='hojaArcadeApprovedParentFrame';frame.title='교사 승인 HOJA 아케이드 문제';
  frame.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;background:#071421';
  overlay.append(frame);
  reviewBar=document.createElement('div');reviewBar.id='hojaArcadeReviewBar';
  reviewBar.style.cssText='position:absolute;left:0;right:0;top:0;z-index:12;min-height:65px;max-height:32%;overflow:auto;display:none;align-items:center;gap:12px;padding:9px 14px;background:#12293e;color:#fff3cc;font:800 16px/1.5 system-ui';
  reviewLabel=document.createElement('span');reviewLabel.id='hojaArcadeReviewLabel';reviewLabel.style.cssText='flex:1;min-width:0;white-space:normal';
  reviewNext=document.createElement('button');reviewNext.id='hojaArcadeReviewNext';reviewNext.type='button';
  reviewNext.style.cssText='flex:none;min-width:120px;padding:7px 12px;border:2px solid #83c9be;border-radius:8px;background:#23555a;color:#fff;font-weight:bold;cursor:pointer';
  reviewNext.onclick=()=>{
    if(!review||review.loading)return;
    ++review.index;
    if(review.index>=review.items.length)finishReview();
    else showReviewItem();
  };
  reviewBar.append(reviewLabel,reviewNext);overlay.append(reviewBar);root.append(overlay);
 }
 function answer(d){
  const a=active;if(!a||a.responded||d.questionId!==a.mapping.binding.questionId)return;
  const ix=a.mapping.choiceIdToArcadeIndex[d.choiceId];
  if(!Number.isInteger(ix))return;
  a.responded=true;
  getArcadeFrame()?.contentWindow?.postMessage({type:'HOJA_ARCADE_APPROVED_SELECT',id:a.id,index:ix},'*');
 }
 function ensureHost(){
  if(loading)return loading;
  ensureUI();
  loading=new Promise((resolve,reject)=>{
   frame.addEventListener('load',async()=>{
    try{
     frame.contentWindow?.addEventListener('keydown',shortcut,true);
     host=core.createApprovedFrameHost({frame,onAnswer:answer,timeoutMs:15000});
     await host.initialize();
     await host.load(catalog.payload);
     resolve(host);
    }catch(err){reject(err)}
   },{once:true});
   frame.addEventListener('error',()=>reject(Error('ARCADE_APPROVED_FRAME_LOAD_FAILED')),{once:true});
   const html=getApprovedHTML();
   if(typeof html!=='string'||!html.includes('HOJA_APPROVED_RENDERER')){reject(Error('ARCADE_APPROVED_RENDERER_REQUIRED'));return}
   frame.srcdoc=html;
  });
  return loading;
 }
 function showLoading(){
  overlay.querySelector('#hojaArcadeApprovedLoading')?.remove();
  const label=document.createElement('div');
  label.id='hojaArcadeApprovedLoading';label.setAttribute('role','status');
  label.style.cssText='position:absolute;inset:0;z-index:9;display:grid;place-items:center;background:#071421;color:#e7f5ff;font:800 clamp(22px,3vw,34px) system-ui';
  label.textContent='승인 문제를 준비하는 중…';
  overlay.append(label);
 }
 function error(err){
  console.error('[HOJA arcade approved]',err);
  ensureUI();frame.style.visibility='hidden';overlay.style.display='block';
  overlay.querySelector('#hojaArcadeApprovedLoading')?.remove();
  const label=document.createElement('div');label.id='hojaArcadeApprovedError';label.setAttribute('role','alert');
  label.style.cssText='position:absolute;inset:20%;z-index:11;padding:30px;display:grid;place-items:center;text-align:center;color:#ffcccc;background:#501a26;border:3px solid #f9b1b1;border-radius:18px;font:bold 23px system-ui';
  label.textContent='승인 문제 연결 오류: '+String(err?.message||err)+' · 뒤로 가기로 종료하세요.';
  overlay.querySelector('#hojaArcadeApprovedError')?.remove();overlay.append(label);
 }
 async function open(msg){
  if(!catalog||typeof msg.id!=='string'||active){error(Error('ARCADE_APPROVED_REQUEST_INVALID'));return}
  let mapping;
  try{mapping=resolveApprovedArcadeChoice(catalog,msg.question,core)}
  catch(e){error(e);return}
  const local=++epoch;focus=-1;active={id:msg.id,mapping,responded:false,familyKey:msg.question.familyKey,kind:msg.question.type};
  ensureUI();frame.style.top='0';frame.style.height='100%';frame.style.visibility='hidden';overlay.style.display='block';showLoading();
  try{
   const h=await ensureHost();
   if(local!==epoch||active?.id!==msg.id)return;
   await h.show({questionId:mapping.binding.questionId,mode:'solo',omitChoiceId:mapping.binding.omitChoiceId});
   if(local!==epoch||active?.id!==msg.id)return;
   overlay.querySelector('#hojaArcadeApprovedLoading')?.remove();frame.style.visibility='visible';
  }catch(e){if(local===epoch)error(e)}
 }
 function verdict(msg){
  if(!active||active.id!==msg.id||!active.responded)return;
  if(msg.correct===false)wrong.set(active.familyKey+'\u0000'+active.kind,active.mapping);
  const mark=document.createElement('div');mark.id='hojaArcadeApprovedJudgment';
  mark.setAttribute('role','status');mark.setAttribute('aria-live','assertive');
  mark.style.cssText='position:absolute;inset:0;z-index:10;display:grid;place-items:center;pointer-events:none;background:#07142190;color:#fff;font:bold clamp(28px,5vw,54px) system-ui';
  mark.textContent=msg.correct?'✓ 정답! +10점':'✕ 오답 · 0점';
  overlay?.querySelector('#hojaArcadeApprovedJudgment')?.remove();overlay?.append(mark);
 }
 function close(msg){
  if(msg&&active?.id!==msg.id)return;
  ++epoch;active=null;host?.suspend();
  overlay?.querySelector('#hojaArcadeApprovedJudgment')?.remove();
  overlay?.querySelector('#hojaArcadeApprovedError')?.remove();
  overlay?.querySelector('#hojaArcadeApprovedLoading')?.remove();
  if(frame){frame.style.visibility='hidden';frame.style.top='0';frame.style.height='100%';}
  if(reviewBar)reviewBar.style.display='none';
  if(overlay)overlay.style.display='none';
 }

 function finishReview(){
  const current=review;
  if(!current)return;
  review=null;
  close();
  getArcadeFrame()?.contentWindow?.postMessage({type:'HOJA_ARCADE_APPROVED_REVIEW_DONE',id:current.id},'*');
 }
 async function showReviewItem(){
  const current=review;
  if(!current||current.index>=current.items.length)return;
  const item=current.items[current.index],token=++epoch;
  current.loading=true;
  ensureUI();overlay.style.display='block';frame.style.visibility='hidden';showLoading();
  const binding=item.mapping.binding,q=binding.rendererQuestion;
  const answerText=q.type==='OX'?(q.answer.value?'O':'X'):
    (q.choices?.find(x=>x.id===q.answer?.choiceId)?.text||'정답 정보를 확인하세요');
  reviewLabel.textContent='오답 복습 '+(current.index+1)+'/'+current.items.length+' · 정답: '+answerText;
  reviewNext.textContent=current.index===current.items.length-1?'복습 마치기':'다음 오답';
  reviewBar.style.display='flex';
  const barHeight=Math.ceil(reviewBar.getBoundingClientRect().height);
  frame.style.top=barHeight+'px';frame.style.bottom='0';frame.style.height='auto';
  try{
   const h=await ensureHost();
   if(token!==epoch||review!==current)return;
   await h.show({questionId:binding.questionId,mode:'review',omitChoiceId:binding.omitChoiceId});
   if(token!==epoch||review!==current)return;
   overlay.querySelector('#hojaArcadeApprovedLoading')?.remove();
   frame.style.visibility='visible';
   current.loading=false;
  }catch(e){if(token===epoch)error(e)}
 }
 function startReview(msg){
  if(active||review||!catalog||typeof msg.id!=='string'||!Array.isArray(msg.wrong)){
   error(Error('ARCADE_REVIEW_BAD_REQUEST'));return;
  }
  let items;
  try{
   const keys=new Set();
   items=msg.wrong.map(x=>{
    if(!x||typeof x.key!=='string'||(x.type!=='MC'&&x.type!=='OX'))throw Error('ARCADE_REVIEW_INVALID_ROW');
    const key=x.key+'\u0000'+x.type,mapping=wrong.get(key);
    if(!mapping||keys.has(key))throw Error('ARCADE_REVIEW_WRONG_MAPPING_MISSING_OR_DUPLICATE');
    keys.add(key);return {key,mapping};
   });
   if(!items.length)throw Error('ARCADE_REVIEW_EMPTY_REQUEST');
  }catch(e){error(e);return}
  review={id:msg.id,items,index:0,loading:false};
  showReviewItem();
 }
 function shortcut(ev){
  if(review)return;
  if(frame?.style.visibility!=='visible')return;
  if(!active||active.responded||ev.repeat||ev.isComposing||ev.ctrlKey||ev.altKey||ev.metaKey)return;
  if(['INPUT','TEXTAREA','SELECT'].includes(ev.target?.tagName)||ev.target?.isContentEditable)return;
  const buttons=[...(frame?.contentDocument?.querySelectorAll('#hqChoices button.hqChoice')||[])];
  if(!buttons.length)return;
  const code=ev.code,arrows=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
  let index=-1;
  if(/^Digit[123]$/.test(code)||/^Numpad[123]$/.test(code))index=Number(code.at(-1))-1;
  else if(active.mapping.binding.rendererQuestion.type==='OX'&&(code==='KeyO'||code==='KeyX'))
   index=buttons.findIndex(b=>b.dataset.choice===(code==='KeyO'?'true':'false'));
  else if(!arrows.includes(code)&&code!=='Enter'&&code!=='NumpadEnter'&&code!=='Space')return;
  ev.preventDefault();ev.stopImmediatePropagation();
  if(arrows.includes(code)){
   focus=(focus+(code==='ArrowLeft'||code==='ArrowUp'?-1:1)+buttons.length)%buttons.length;
   buttons[focus].focus();
   buttons.forEach((b,i)=>b.style.outline=i===focus?'4px solid #ffdb67':'');
   return;
  }
  if(index<0)index=focus>=0?focus:0;
  buttons[index]?.click();
 }
 function onMessage(ev){
  if(!getArcadeFrame()?.contentWindow||ev.source!==getArcadeFrame().contentWindow||!ev.data||typeof ev.data!=='object')return;
  if(ev.data.type==='HOJA_ARCADE_APPROVED_OPEN')open(ev.data);
  else if(ev.data.type==='HOJA_ARCADE_APPROVED_VERDICT')verdict(ev.data);
  else if(ev.data.type==='HOJA_ARCADE_APPROVED_CLOSE')close(ev.data);
  else if(ev.data.type==='HOJA_ARCADE_APPROVED_REVIEW_START')startReview(ev.data);
 }
 window.addEventListener('message',onMessage);
 window.addEventListener('keydown',shortcut,true);
 return Object.freeze({
  configure(sources){review=null;wrong.clear();close();catalog=createApprovedArcadeCatalog(sources,core);return catalog.count},
  patchHTML(html){if(!catalog)throw Error('ARCADE_APPROVED_NOT_CONFIGURED');return patchApprovedArcadeInnerHTML(html)},
  reset(){review=null;wrong.clear();close();catalog=null;host?.close();frame?.remove();overlay?.remove();host=null;frame=null;overlay=null;reviewBar=null;reviewLabel=null;reviewNext=null;loading=null},
  get state(){return {configured:!!catalog,count:catalog?.count||0,activeId:active?.id||null,reviewIndex:review?.index??null,reviewCount:review?.items.length??0}}
 });
}
