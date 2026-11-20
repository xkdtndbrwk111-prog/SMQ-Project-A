
"use strict";
// Real STEP13-7 embedded samples (verified by SHA-256), no procedural synthesis.
// Audio playback is unlocked only by a user gesture, as browsers require.
window.HOJA_INTRO_AUDIO=(()=>{
 const names=["step_grass1", "step_grass2", "collect", "hop", "owlrise", "jumpy", "roach", "bonk", "land", "strongstart", "strong", "shell1", "stomp1", "stomp2", "stagestart", "alert", "clear"];
 const refs=Object.fromEntries(names.map(k=>[k,document.getElementById('sfx_'+k)]));
 let enabled=false,ctx=null,master=null,loading=null;
 const buffers=Object.create(null),lastAt=Object.create(null);
 const Ctx=window.AudioContext||window.webkitAudioContext;
 const decode=(ctx,uri)=>{
  const bin=atob(uri.slice(uri.indexOf(',')+1)),v=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)v[i]=bin.charCodeAt(i);
  return ctx.decodeAudioData(v.buffer);
 };
 async function load(){
  if(loading)return loading;
  loading=(async()=>{
   if(!Ctx)return;
   ctx=new Ctx();master=ctx.createGain();master.gain.value=.78;master.connect(ctx.destination);
   await ctx.resume();
   await Promise.all(names.map(async k=>{try{
    const el=refs[k];if(!el)return;
    let uri=el.getAttribute('src');
    if(!uri.startsWith('data:')){
     const r=await fetch(uri);if(!r.ok)throw Error('SFX fetch '+r.status);
     buffers[k]=await ctx.decodeAudioData(await r.arrayBuffer());
    } else buffers[k]=await decode(ctx,uri);
   }catch(e){console.warn('source SFX decode failed',k,e);}}));
  })();
  return loading;
 }
 function play(k,volume=.4,rate=1,gap=55){
  if(!enabled)return false;
  const now=performance.now();if(now-(lastAt[k]||-1e9)<gap)return false;lastAt[k]=now;
  const vol=Math.max(0,Math.min(1,volume)),speed=Math.max(.5,Math.min(2,rate));
  try{
   if(ctx&&ctx.state==='running'&&buffers[k]){
    const src=ctx.createBufferSource();src.buffer=buffers[k];src.playbackRate.value=speed;
    const gain=ctx.createGain();gain.gain.value=vol;src.connect(gain).connect(master);src.start();return true;
   }
   const orig=refs[k];if(!orig)return false;
   const el=orig.cloneNode(true);el.volume=vol*.78;el.playbackRate=speed;
   el.play().catch(()=>{});el.addEventListener('ended',()=>el.remove(),{once:true});return true;
  }catch(e){return false;}
 }
 function renderButton(){window.HOJA_AUDIO_CONTROL?.render?.();}
 function enable(){
  if(enabled)return;
  enabled=true;renderButton();
  load().then(()=>ctx?.resume?.()).catch(e=>console.warn('Audio unlock issue',e));
 }
 function disable(){
  enabled=false;renderButton();
 }
 function toggle(){if(enabled)disable();else enable();}
 document.addEventListener('DOMContentLoaded',renderButton);
 return {play,enable,disable,toggle,get enabled(){return enabled}};
})();

