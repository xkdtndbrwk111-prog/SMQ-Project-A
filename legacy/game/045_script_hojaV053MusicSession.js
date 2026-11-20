
"use strict";
window.HOJA_AUDIO_CONTROL=(()=>{
 const bgm=document.getElementById('hojaBgm');
 const trackElements=[bgm,document.getElementById('hojaTrackMeadow'),document.getElementById('hojaTrackAfternoon')];
 const names=['기존 음악 · 64kbps','HOJA Meadow','HOJA Afternoon'];
 const trackSources=trackElements.map(el=>el.getAttribute('src'));
 let trackIndex=-1,musicOn=true,sfxOn=true,unlocked=false;
 const frame=()=>document.getElementById('hqArcadeFrame');
 function render(){
  document.querySelectorAll('.hojaMusicToggle').forEach(el=>{el.textContent='♫ 음악';el.setAttribute('aria-pressed',String(musicOn));el.title=(musicOn?'음악 켜짐 · 클릭하여 끄기':'음악 꺼짐 · 클릭하여 켜기')+' · '+(trackIndex<0?'인트로에서 선택':names[trackIndex]);});
  document.querySelectorAll('.hojaSfxToggle').forEach(el=>{el.textContent='♪ 효과음';el.setAttribute('aria-pressed',String(sfxOn));el.title=sfxOn?'효과음 켜짐 · 클릭하여 끄기':'효과음 꺼짐 · 클릭하여 켜기';});
  const old=document.getElementById('soundBtn');if(old){old.textContent='♫ 음악';old.setAttribute('aria-pressed',String(musicOn));old.title=trackIndex<0?'음악 선택 전':names[trackIndex];}
 }
 function syncArcade(){
  const f=frame();
  if(f?.contentWindow)try{f.contentWindow.postMessage({type:'HOJA_PARENT_AUDIO_STATE_V053',sfxOn:!!sfxOn},'*');}catch(_){}
  // Tutorial consumes the very same common music/SFX controls, including changes mid-session.
  const tf=document.getElementById('hojaTutApp');
  if(tf?.contentWindow&&!document.getElementById('hojaTutOverlay')?.hidden)
    try{tf.contentWindow.postMessage({kind:'HOJA_TUTORIAL_AUDIO_STATE',sfxOn:!!sfxOn,musicOn:!!musicOn},'*');}catch(_){}
 }
 function chooseNewRun(){
  trackIndex=Math.floor(Math.random()*3);
  const source=trackSources[trackIndex];
  if(source && bgm){
   if(bgm.getAttribute('src')!==source)bgm.src=source;
   bgm.loop=true;bgm.volume=.24;bgm.playbackRate=1;
   try{bgm.currentTime=0;}catch(_){}
   if(musicOn&&unlocked)bgm.play().catch(()=>{});
   else bgm.pause();
  }
  render();return trackIndex;
 }
 function unlockFromGesture(){
  unlocked=true;
  if(trackIndex<0)chooseNewRun();
  if(sfxOn)window.HOJA_INTRO_AUDIO?.enable?.();
  if(musicOn){bgm.volume=.24;bgm.play().catch(e=>console.warn('BGM playback blocked',e));}
  render();syncArcade();
 }
 function setMusic(on){
  musicOn=Boolean(on);
  if(musicOn){unlocked=true;if(trackIndex<0)chooseNewRun();bgm.volume=.24;bgm.play().catch(()=>{});}
  else bgm.pause();
  render();syncArcade();
 }
 function setSfx(on){
  sfxOn=Boolean(on);
  if(sfxOn){unlocked=true;window.HOJA_INTRO_AUDIO?.enable?.();}
  else window.HOJA_INTRO_AUDIO?.disable?.();
  render();syncArcade();
   if(!sfxOn)window.HOJA_TUTORIAL_AUDIO_BRIDGE?.stopSnore();
 }
 function toggleMusic(){setMusic(!musicOn)}
 function toggleSfx(){setSfx(!sfxOn)}
 document.addEventListener('click',e=>{
  const music=e.target.closest('.hojaMusicToggle');const sfx=e.target.closest('.hojaSfxToggle');
  if(!music&&!sfx)return;
  e.stopPropagation();
  if(music)toggleMusic();else toggleSfx();
 },true);
 window.addEventListener('DOMContentLoaded',render);
 frame()?.addEventListener('load',syncArcade);
 return {chooseNewRun,unlockFromGesture,setMusic,setSfx,toggleMusic,toggleSfx,syncArcade,render,get musicOn(){return musicOn},get sfxOn(){return sfxOn},get selectedTrack(){return trackIndex},get unlocked(){return unlocked},get bgm(){return bgm}};
})();
