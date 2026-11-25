/* HOJA 1.5 — explicit picture split takes precedence over MCQ-only auto eligibility. */
(function(){
 'use strict';
 if(window.HOJA_RENDERER_SPLIT_LOCK_EXT)return;
 const css=document.createElement('style');css.id='hojaSplitLockExtStyle';
 css.textContent=`
 #screen #hqCard[data-composition="split"][data-kind="OX"] #hqChoices{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:minmax(0,1fr);gap:calc(10px * var(--u));}
 #screen #hqCard[data-composition="split"][data-kind="OX"] .hqChoice{min-width:0;min-height:0;padding:calc(4px * var(--u));}
 #screen #hqCard[data-composition="split"][data-kind="SHORT"] #hqChoices{min-height:0!important;min-width:0;overflow:hidden!important;}
 #screen #hqCard[data-composition="split"][data-kind="SHORT"] #hqChoices .teacher-answer{min-width:0;overflow-wrap:anywhere;}
 #screen #hqCard[data-composition="split"][data-kind="SHORT"] #hqChoices .teacher-actions{gap:calc(8px * var(--u));}
 #screen #hqCard[data-composition="split"][data-kind="SHORT"] #hqChoices .teacher-judge{min-width:0;overflow-wrap:anywhere;}
 `;document.head.append(css);
 const baseSelect=selectComposition;
 selectComposition=function(){
   const q=current(),card=document.getElementById('hqCard'),media=document.getElementById('hqMedia'),stim=document.getElementById('hqStimulus');
   const eligible=(state.layout==='C'||state.layout==='D')&&!media.hidden&&!q.choices?.some(c=>c.image);
   const hint=q.layoutHint||q.renderTags?.layout?.rendererHint;
   if(eligible&&(state.composition==='split'||(state.composition!=='stack'&&hint==='split'))){
     const chosen=stim.hidden?'split':stim.classList.contains('stimulus-dialogue')?'dialogue-image':'picture-stimulus';
     state.choiceLongest=[...document.querySelectorAll('#hqChoices .hqChoiceLabel')].map(x=>x.textContent.trim()).reduce((a,b)=>b.length>a.length?b:a,'');
     state.choiceMaxLines=0;
     card.dataset.composition=chosen;state.appliedComposition=chosen;
     state.compositionReason='명시적 좌우 배치 지정 우선';document.getElementById('compositionReason').textContent=state.compositionReason;return;
   }
   return baseSelect();
 };
 const baseMeasure=measureAndFit;
 measureAndFit=function(){
   baseMeasure();
   const card=document.getElementById('hqCard');if(card.dataset.composition!=='split')return;
   const choices=document.getElementById('hqChoices'),u=Number(state.res.split('x')[1])/720;
   if(current().type==='OX'){
     for(const b of choices.querySelectorAll('.hqChoice')){
       const label=b.querySelector('.hqChoiceLabel');if(!label)continue;
       const available=Math.min(b.clientWidth,b.clientHeight)-8*u;
       b.style.fontSize=Math.max(12,Math.min(120*u,available*.78))+'px';
     }
   }else if(current().type==='SHORT'){
     const answer=choices.querySelector('.teacher-answer');if(!answer)return;
     answer.style.removeProperty('font-size');
     const start=parseFloat(getComputedStyle(answer).fontSize)||43*u;
     for(let n=start;n>=18*u;n-=Math.max(1,u)){
       answer.style.setProperty('font-size',n+'px','important');
       if(choices.scrollHeight<=choices.clientHeight+2&&answer.scrollWidth<=answer.clientWidth+2)break;
     }
   }
 };
 window.HOJA_RENDERER_SPLIT_LOCK_EXT=Object.freeze({version:2});
})();
