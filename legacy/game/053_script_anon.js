
window.addEventListener('load',()=>{document.getElementById('logoL').src=document.getElementById('hojaPortrait').src;document.getElementById('logoR').src=document.getElementById('nahanPortrait').src});

"use strict";
window.HOJA_INTRO_SHORTCUT_LOGO=false;
window.HOJA_INTRO_PENDING_PHASE2=false;
window.HOJA_INTRO_CLICKS=(()=>{
 let count=0;
 function reset(){count=0;window.HOJA_INTRO_SHORTCUT_LOGO=false;window.HOJA_INTRO_PENDING_PHASE2=false;}
 function isPhase2(){const s=window.HOJA_ATTRACT_SCENE;return !!window.HOJA_INTRO_SHORTCUT_LOGO||!!window.HOJA_INTRO_PENDING_PHASE2||!!(s&&s.elapsedMs>=BEATS.chase*1000);}
 function toRepository(){count=3;const s=window.HOJA_ATTRACT_SCENE;if(s){s.pausedByUser=true;s.anims.pauseAll?.();s.tweens.pauseAll?.();}window.HOJA_REPOSITORY?.show?.();}
 function advance(event){
  if(event?.target?.closest?.('#hojaRepoChoice,#hojaCatalog,#hojaNextMode,#hojaSharedBack,.hojaAudioTop'))return count;
  if(!document.getElementById('loadingOverlay').hidden||!document.getElementById('hojaRepoChoice').hidden||!document.getElementById('hojaCatalog').hidden||!document.getElementById('hojaNextMode').hidden)return count;
  // When PHASE 2 is already playing (naturally or via click-2), one click finishes intro.
  if(isPhase2()){toRepository();return count;}
  count=Math.min(count+1,3);
  if(count===1){window.HOJA_AUDIO_CONTROL?.unlockFromGesture?.();}
  else if(count===2){
   window.HOJA_INTRO_SHORTCUT_LOGO=true;
   const s=window.HOJA_ATTRACT_SCENE;
   if(s){s.pausedByUser=false;s.anims.resumeAll?.();s.tweens.resumeAll?.();document.getElementById('pauseBtn').textContent='일시정지';s.scene.restart({seek:BEATS.chase+.12});}
   else window.HOJA_INTRO_PENDING_PHASE2=true;
  }else if(count===3)toRepository();
  return count;
 }
 document.getElementById('frame')?.addEventListener('click',advance);
 return {advance,reset,isPhase2,get count(){return count}};
})();;

