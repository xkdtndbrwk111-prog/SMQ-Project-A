
(()=>{'use strict';
let context=null;const buffers=new Map();let activeSnore=null;let lastAt=Object.create(null);let played=0;
function unlockFromGesture(){
 try{context=context||new (window.AudioContext||window.webkitAudioContext)();context.resume().catch(()=>{});}
 catch(_e){}
}
function decodeUri(uri){
 const comma=uri.indexOf(',');const bytes=atob(uri.slice(comma+1));
 return Uint8Array.from(bytes,c=>c.charCodeAt(0)).buffer;
}
async function playAudio(name,uri,vol){
 if(window.HOJA_AUDIO_CONTROL?.sfxOn===false)return;
 if(!context){return;}if(context.state!=='running')await context.resume().catch(()=>{});
 if(context.state!=='running')return;
 const now=performance.now();if(now-(lastAt[name]||-1e9)<110)return;lastAt[name]=now;
 try{
  let promise=buffers.get(name);if(!promise){promise=context.decodeAudioData(decodeUri(uri));buffers.set(name,promise);}
  const buffer=await promise;if(window.HOJA_AUDIO_CONTROL?.sfxOn===false)return;
  const src=context.createBufferSource(),gain=context.createGain();
  src.buffer=buffer;gain.gain.value=Math.max(0,Math.min(1,vol));src.connect(gain);gain.connect(context.destination);
  if(name==='sleep'&&activeSnore){try{activeSnore.stop();}catch(_){}}
  if(name==='sleep')activeSnore=src;
  src.onended=()=>{if(activeSnore===src)activeSnore=null;};src.start(0);played++;
 }catch(e){buffers.delete(name);console.warn('Tutorial SFX playback error',name,e);}
}
function stopSnore(){if(activeSnore){try{activeSnore.stop();}catch(_){}activeSnore=null;}}
window.addEventListener('message',e=>{
 const frame=document.getElementById('hojaTutApp'),overlay=document.getElementById('hojaTutOverlay');
 if(e.source!==frame?.contentWindow||overlay?.hidden)return;
 if(e.data?.kind==='HOJA_TUTORIAL_SFX_PLAY'&&/^[-_a-z0-9]+$/i.test(e.data.name||'')&&typeof e.data.source==='string'&&e.data.source.startsWith('data:audio/'))
   void playAudio(e.data.name,e.data.source,e.data.volume);
 else if(e.data?.kind==='HOJA_TUTORIAL_SFX_STOP_SNORE')stopSnore();
});
window.HOJA_TUTORIAL_AUDIO_BRIDGE={unlockFromGesture,stopSnore,get status(){return {context:context?.state||'uninitialized',cached:buffers.size,played}}};
})();
