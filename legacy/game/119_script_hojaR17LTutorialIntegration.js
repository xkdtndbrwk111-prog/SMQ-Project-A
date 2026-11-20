
(function(){'use strict';
 const STORAGE='hoja_tutorial_stage0_completed_v1';
 const overlay=document.getElementById('hojaTutOverlay'), frame=document.getElementById('hojaTutApp');
 const originalBack=document.getElementById('hojaSharedBack'),originalAudio=document.getElementById('hojaAudioTop');
 const originals=new Map();
 let running=false,finished=false,sessionCompleted=false,waiting=null,mode='practice',loading=null;
 function completed(){try{return sessionCompleted||localStorage.getItem(STORAGE)==='1';}catch(_e){return sessionCompleted;}}
 function save(){sessionCompleted=true;try{localStorage.setItem(STORAGE,'1');return true;}catch(_e){return false;}}
 async function decode(){
  if(loading)return loading;
  loading=(async()=>{if(typeof DecompressionStream!=='function')throw new Error('이 브라우저에서는 튜토리얼 압축 해제를 지원하지 않습니다.');
    const b=atob(document.getElementById('hojaR17KTutorialGzip').textContent.trim());
    const v=Uint8Array.from(b,c=>c.charCodeAt(0));
    const decoded=await new Response(new Blob([v]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    const patch='<scr'+'ipt>'+window.HOJA_TT_PRACTICE_SOURCE+'</scr'+'ipt>';
    return decoded.includes('</body>')?decoded.replace('</body>',patch+'</body>'):decoded+patch;
  })();return loading;
 }
 function syncAudio(){const a=window.HOJA_AUDIO_CONTROL;
   if(!running)return;
   try{frame.contentWindow?.postMessage({kind:'HOJA_TUTORIAL_AUDIO_STATE',sfxOn:a?.sfxOn!==false,musicOn:a?.musicOn!==false},'*');}catch(_){}
 }
 function backCapture(e){e.preventDefault();e.stopImmediatePropagation();close(false);}
 function mountSharedControls(){
   for(const el of [originalBack,originalAudio]){
     if(!el||originals.has(el))continue;
     const place=document.createComment('hoja tutorial shared control return');
     el.parentNode.insertBefore(place,el);
     originals.set(el,{place,hidden:el.hidden});
     overlay.appendChild(el);el.hidden=false;
   }
   originalBack?.addEventListener('click',backCapture,true);
   window.HOJA_AUDIO_CONTROL?.render?.();
 }
 function restoreSharedControls(){
   originalBack?.removeEventListener('click',backCapture,true);
   for(const [el,prior] of originals){
     prior.place?.replaceWith(el);
     el.hidden=prior.hidden;
   }
   originals.clear();window.HOJA_AUDIO_CONTROL?.render?.();
 }
 async function open(which='practice',after=null){
   if(running)return;
   running=true;finished=false;mode=which;waiting=after;
   overlay.hidden=false;document.body.style.overflow='hidden';mountSharedControls();
   window.HOJA_TUTORIAL_AUDIO_BRIDGE?.unlockFromGesture();
   // Existing music track is shared; it must be unlocked from a genuine player click.
   window.HOJA_AUDIO_CONTROL?.unlockFromGesture?.();
   try{const html=await decode();if(!running)return;
     frame.addEventListener('load',syncAudio,{once:true});frame.srcdoc=html;
   }catch(e){close(false);alert('튜토리얼을 열 수 없습니다: '+e.message);}
 }
 function close(continueArcade=false){
   if(!running)return;
   const action=waiting;
   running=false;window.HOJA_TUTORIAL_AUDIO_BRIDGE?.stopSnore();frame.removeAttribute('srcdoc');frame.src='about:blank';restoreSharedControls();overlay.hidden=true;
   document.body.style.overflow='';waiting=null;
   if(continueArcade&&mode==='arcade'&&finished&&typeof action==='function')action();
 }
 window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||!running)return;
   if(event.data?.kind==='HOJA_TUT_SHARED_PORTRAITS_REQUEST'){
     const bundle=JSON.parse(document.getElementById('hojaTeamR10PortraitAssets').textContent);
     const chars=['CHILJIDO_ELDER','HOJA','NAHANSANG'];
     const moods=['01_NEUTRAL','02_SURPRISED','03_ANGRY','04_TIRED','05_SHY','06_SAD','07_SLEEPY','08_EMBARRASSED','09_SPARKLING','10_CURIOUS'];
     const assets={};
     for(const ch of chars)for(let n=0;n<moods.length;n++)
       assets['portrait_'+ch+'_'+String(n+1).padStart(2,'0')+'.webp']=bundle.characters[ch].emotions[moods[n]].imageData;
     const audioRefs={'hojaTutSfx_dialogue': 'sfx_collect', 'hojaTutSfx_walk': 'sfx_step_grass1', 'hojaTutSfx_run': 'sfx_step_grass2', 'hojaTutSfx_jump': 'sfx_hop', 'hojaTutSfx_land': 'sfx_land', 'hojaTutSfx_door': 'sfx_stagestart', 'hojaTutSfx_enemy': 'sfx_stomp1', 'hojaTutSfx_stomp': 'sfx_strong', 'hojaTutSfx_question': 'sfx_collect', 'hojaTutSfx_right': 'hqSfx_correct', 'hojaTutSfx_wrong': 'hqSfx_wrong', 'hojaTutSfx_finish': 'sfx_clear'};
     const media={audio:{},images:{}};
     for(const [dest,src] of Object.entries(audioRefs)){
       const uri=document.getElementById(src)?.getAttribute('src')||'';
       if(!uri.startsWith('data:audio/'))throw new Error('R17S 공용 MP3 누락: '+src);
       media.audio[dest]=uri;
     }
     for(const [dest,src] of [['walk','hojaModeWalk'],['nahan_walk','nahanModeWalk']]){
       const uri=document.getElementById(src)?.getAttribute('src')||'';
       if(!uri.startsWith('data:image/png;'))throw new Error('R17S 공용 스프라이트 누락: '+src);
       media.images[dest]=uri;
     }
     event.source.postMessage({kind:'HOJA_TUT_SHARED_PORTRAITS',assets,media},'*');
     return;
   }
   if(event.data?.kind==='HOJA_TUT_NATIVE_SOURCE_REQUEST'){
     const requester=event.source;
     void window.HOJA_R17S_NATIVE_SOURCE.build().then(html=>{
       if(running&&frame.contentWindow===requester)
         requester.postMessage({kind:'HOJA_TUT_NATIVE_SOURCE_RESPONSE',html},'*');
     }).catch(error=>{
       if(running&&frame.contentWindow===requester)
         requester.postMessage({kind:'HOJA_TUT_NATIVE_SOURCE_ERROR',error:String(error.message||error)},'*');
     });
     return;
   }
   if(event.data?.kind==='HOJA_TUTORIAL_SFX_READY'){syncAudio();return;}
   if(event.data?.kind==='HOJA_TUTORIAL_COMPLETED'&&event.data.version==='v057'){
     finished=true;save();document.getElementById('hojaTutStatus').textContent='튜토리얼을 완료했습니다.';
   } else if(event.data?.kind==='HOJA_TUTORIAL_CONTINUE'&&event.data.version==='v057'){close(true);}
 });
 window.HOJA_TUTORIAL_GATE={open,startArcade(launch){if(completed())launch();else open('arcade',launch);},
   get state(){return {running,finished,completed:completed()};}};
})();
