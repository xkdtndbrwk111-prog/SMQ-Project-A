
window.addEventListener('keydown',event=>{if(event.code==='F9'&&window.HOJA_GAMEPLAY?.state?.page==='arcade'){event.preventDefault();document.getElementById('hqArcadeFrame')?.contentWindow?.postMessage({kind:'HOJA_V063_PERF_TOGGLE'},'*');}},{capture:true});
window.HOJA_V055_BIND_ARCADE=(frame)=>{
 try{
  const doc=frame?.contentDocument, c=window.HOJA_AUDIO_CONTROL;
  if(!doc||!c)return;
  const back=doc.getElementById('hojaArcadeBack'),music=doc.getElementById('hojaArcadeMusic'),sfx=doc.getElementById('hojaArcadeSfx');
  if(!back||!music||!sfx)return;
  const sync=()=>{music.setAttribute('aria-pressed',String(c.musicOn));sfx.setAttribute('aria-pressed',String(c.sfxOn))};
  back.onclick=(ev)=>{ev.stopPropagation();window.HOJA_GAMEPLAY?.back?.()};
  music.onclick=(ev)=>{ev.stopPropagation();c.toggleMusic();sync()};
  sfx.onclick=(ev)=>{ev.stopPropagation();c.toggleSfx();sync()};
  doc.getElementById('hojaArcadeSharedControls').dataset.ready='true';sync();
 }catch(err){console.warn('V055 arcade HUD bind failed',err)}
};
window.HOJA_V055_WATCH_ARCADE=(frame)=>{
 let attempts=0;
 const poll=()=>{
  if(frame?.contentDocument?.getElementById('hojaArcadeBack')){window.HOJA_V055_BIND_ARCADE(frame);return;}
  if(++attempts<180)window.requestAnimationFrame(poll);
 };
 window.requestAnimationFrame(poll);
};
