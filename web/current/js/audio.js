'use strict';
window.HOJA_CREATE_AUDIO=function({activeScene,remainingMs}){
  // ---------------------------------------------------------------------------
  // SFX — V0.19
  // Every sound is an embedded, pre-compressed asset (mono 22.05kHz MP3).
  // Each <audio> data URI is decoded ONCE into a WebAudio buffer; playback
  // creates a cheap BufferSource with rate/volume variation. No synthesis.
  // HTMLAudio clone playback is kept only as a fallback for browsers without
  // WebAudio / decodeAudioData.
  // ---------------------------------------------------------------------------
  let AUDIO_CTX=null;
  let AUDIO_MASTER=null;
  let AUDIO_MUTED=true;
  // V0.5.3: the parent screen owns BGM; only original gameplay SFX are local.
  window.addEventListener('message',function(evt){
   if(!evt.data||evt.data.type!=='HOJA_PARENT_AUDIO_STATE_V053')return;
   AUDIO_MUTED=!Boolean(evt.data.sfxOn);
   const gameMusic=document.getElementById('hojaBgm');if(gameMusic){gameMusic.muted=true;gameMusic.pause();}
  },false);
  let HOJA_STUDENT_VOLUME=1; // relative to original per-sound volumes
  const SAMPLE_BUFFERS=Object.create(null);
  const SAMPLE_LAST_AT=Object.create(null);
  let HOJA_ACTIVE_SNORE=null;
  const BGM_VOLUME=.25;
  // V0.59 — time-limited BGM ducking on milestones and major impacts.
  // Small duck only: no new audio files, no global mute/tempo changes.
  let HOJA_BGM_DUCK_UNTIL=0;
  let HOJA_BGM_DUCK_FACTOR=1;
  let HOJA_BGM_DUCK_TIMER=null;
  function hojaBgmDuck(ms=160,factor=.64){
    if(AUDIO_MUTED)return;
    const until=performance.now()+ms;
    if(until>HOJA_BGM_DUCK_UNTIL)HOJA_BGM_DUCK_UNTIL=until;
    HOJA_BGM_DUCK_FACTOR=Math.min(HOJA_BGM_DUCK_FACTOR,factor);
    const el=document.getElementById('hojaBgm');
    if(el)el.volume=BGM_VOLUME*HOJA_BGM_DUCK_FACTOR*HOJA_STUDENT_VOLUME;
    if(HOJA_BGM_DUCK_TIMER!==null)clearTimeout(HOJA_BGM_DUCK_TIMER);
    const restore=()=>{
      const remaining=HOJA_BGM_DUCK_UNTIL-performance.now();
      if(remaining>1){HOJA_BGM_DUCK_TIMER=setTimeout(restore,remaining);return;}
      HOJA_BGM_DUCK_UNTIL=0;HOJA_BGM_DUCK_FACTOR=1;HOJA_BGM_DUCK_TIMER=null;
      if(el)el.volume=BGM_VOLUME*HOJA_STUDENT_VOLUME;
    };
    HOJA_BGM_DUCK_TIMER=setTimeout(restore,ms);
  }
  function hojaBgmDuckReset(){
    if(HOJA_BGM_DUCK_TIMER!==null)clearTimeout(HOJA_BGM_DUCK_TIMER);
    HOJA_BGM_DUCK_TIMER=null;HOJA_BGM_DUCK_UNTIL=0;HOJA_BGM_DUCK_FACTOR=1;
    const el=document.getElementById('hojaBgm');if(el)el.volume=BGM_VOLUME*HOJA_STUDENT_VOLUME;
  }
  // V0.33: No hurry warning SFX. 100s only accelerates the existing BGM.
  function startBgm(){ const silentBgm=document.getElementById('hojaBgm');if(silentBgm){silentBgm.muted=true;silentBgm.pause();}return;

    const el=document.getElementById('hojaBgm');
    if(!el||AUDIO_MUTED)return;
    el.volume=BGM_VOLUME*HOJA_STUDENT_VOLUME*(performance.now()<HOJA_BGM_DUCK_UNTIL?HOJA_BGM_DUCK_FACTOR:1);
    // With pitch correction off this is the classic urgent chiptune double speed.
    const fast=remainingMs()<=100000;
    el.playbackRate=fast?1.5:1;
    if('preservesPitch' in el)el.preservesPitch=false;
    if('webkitPreservesPitch' in el)el.webkitPreservesPitch=false;
    if(!el.paused)return;
    const p=el.play();
    if(p&&typeof p.catch==='function')p.catch(()=>{}); // user gesture required by browsers
  }
  function syncBgm(){
    const el=document.getElementById('hojaBgm');
    if(!el)return;
    const scene=activeScene();
    const blocked=AUDIO_MUTED || (scene&&(
      scene.manualPaused||scene.timeUp||
      scene.clear&&scene.clearElapsedMs>7000));
    if(blocked){el.pause();return;}
    startBgm();
  }

  const SAMPLE_SFX_IDS=Object.freeze({
    jump:'sfx_jump',
    playerhurt:'sfx_playerhurt',
    jumpy:'sfx_jumpy',
    shellkick:'sfx_shellkick',
    owlrise:'sfx_owlrise',
    owldash:'sfx_owldash',
    quiz:'sfx_quiz',
    blankey:'sfx_blankey',
    stomp1:'sfx_stomp1',
    stomp2:'sfx_stomp2',
    strong:'sfx_strong',
    strongstart:'sfx_strongstart',
    shell1:'sfx_shell1',
    shell2:'sfx_shell2',
    stone1:'sfx_stone1',
    stone2:'sfx_stone2',
    land:'sfx_land',
    roach:'sfx_roach',
    bonk:'sfx_bonk',
    correct:'sfx_correct',
    wrong:'sfx_wrong',
    clear:'sfx_clear',
    hop:'sfx_hop',
    stagestart:'sfx_stagestart',
    alert:'sfx_alert',
    glitch:'sfx_glitch',
    step_grass1:'sfx_step_grass1',
    step_grass2:'sfx_step_grass2',
    step_wood1:'sfx_step_wood1',
    step_wood2:'sfx_step_wood2',
    step_sand1:'sfx_step_sand1',
    step_sand2:'sfx_step_sand2',
    step_snow1:'sfx_step_snow1',
    step_snow2:'sfx_step_snow2',
    collect:'sfx_collect',
    sleep:'sfx_sleep'
  });

  function audioCtx(){
    if(!AUDIO_CTX){
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx)return null;
      try{
        AUDIO_CTX=new Ctx();
        AUDIO_MASTER=AUDIO_CTX.createGain();
        AUDIO_MASTER.gain.value=HOJA_STUDENT_VOLUME;
        AUDIO_MASTER.connect(AUDIO_CTX.destination);
      }catch(_){AUDIO_CTX=null;return null;}
    }
    return AUDIO_CTX;
  }

  function dataUriToArrayBuffer(uri){
    const comma=uri.indexOf(',');
    const bin=atob(uri.slice(comma+1));
    const out=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
    return out.buffer;
  }

  function decodeBuffer(ac,ab){
    return new Promise((resolve,reject)=>{
      try{
        const p=ac.decodeAudioData(ab,resolve,reject);
        if(p&&typeof p.then==='function')p.then(resolve,reject);
      }catch(err){reject(err)}
    });
  }

  async function preloadSampleSfx(){
    const ac=audioCtx();
    if(!ac)return;
    await Promise.all(Object.entries(SAMPLE_SFX_IDS).map(async([key,id])=>{
      const el=document.getElementById(id);
      if(!el)return;
      try{
        SAMPLE_BUFFERS[key]=await decodeBuffer(ac,dataUriToArrayBuffer(el.getAttribute('src')));
      }catch(err){
        console.warn('SFX decode failed',key,err);
      }
    }));
  }

  function unlockAudio(){
    const ac=audioCtx();
    if(ac&&ac.state==='suspended')ac.resume().catch(()=>{});
  }
  window.addEventListener('keydown',()=>{unlockAudio();syncBgm();});
  window.addEventListener('pointerdown',()=>{unlockAudio();syncBgm();});

  function stopHojaSnore(){
    const a=HOJA_ACTIVE_SNORE;
    HOJA_ACTIVE_SNORE=null;
    if(!a)return;
    try{
      if(a.src){
        const t=a.ctx.currentTime;
        a.gain.gain.cancelScheduledValues(t);
        a.gain.gain.setValueAtTime(a.gain.gain.value,t);
        a.gain.gain.linearRampToValueAtTime(0,t+.055);
        a.src.stop(t+.06);
      }else if(a.el){a.el.pause();a.el.currentTime=0;}
    }catch(_){}
  }
  function playSampleSfx(key,volume=.55,rate=1,minGapMs=35){
    if(AUDIO_MUTED)return false;

    // Same sound requested several times in one frame (e.g. a shell clearing
    // a crowd) is collapsed instead of stacking into a loud spike.
    const now=performance.now();
    if(now-(SAMPLE_LAST_AT[key]||-1e9)<minGapMs)return true;
    SAMPLE_LAST_AT[key]=now;
    if(key==='sleep')stopHojaSnore();

    const vol=Math.max(0,Math.min(1,volume));
    const r=Math.max(.5,Math.min(2,rate));
    const ac=AUDIO_CTX;
    const buf=SAMPLE_BUFFERS[key];

    if(ac&&buf){
      if(ac.state==='suspended')ac.resume().catch(()=>{});
      try{
        const src=ac.createBufferSource();
        src.buffer=buf;
        src.playbackRate.value=r;
        const g=ac.createGain();
        g.gain.value=vol;
        src.connect(g).connect(AUDIO_MASTER);
        if(key==='sleep'){
          const item={src,gain:g,ctx:ac};
          HOJA_ACTIVE_SNORE=item;
          src.onended=()=>{if(HOJA_ACTIVE_SNORE===item)HOJA_ACTIVE_SNORE=null;};
        }
        src.start();
        return true;
      }catch(_){}
    }

    // Fallback: HTMLAudio clone.
    const id=SAMPLE_SFX_IDS[key];
    const baseEl=id?document.getElementById(id):null;
    if(!baseEl)return false;
    try{
      const el=baseEl.cloneNode(true);
      el.volume=vol*HOJA_STUDENT_VOLUME;
      el.playbackRate=r;
      if('preservesPitch' in el)el.preservesPitch=false;
      if(key==='sleep')HOJA_ACTIVE_SNORE={el};
      const p=el.play();
      if(p&&typeof p.catch==='function')p.catch(()=>{});
      el.addEventListener('ended',()=>{
        if(HOJA_ACTIVE_SNORE?.el===el)HOJA_ACTIVE_SNORE=null;
        el.remove();
      },{once:true});
      return true;
    }catch(_){
      return false;
    }
  }

  function playSampleVariant(keys,volume=.55,rateJitter=.04){
    const key=keys[Math.floor(Math.random()*keys.length)];
    const rate=1+(Math.random()*2-1)*rateJitter;
    return playSampleSfx(key,volume,rate);
  }

  function jitter(amount){return 1+(Math.random()*2-1)*amount}

  const SFX={
    jump(){playSampleSfx('jump',.54,jitter(.02))},
    sleep(){return playSampleSfx('sleep',.58,jitter(.025),1400)},
    // Combo ladder: every extra stomp in one airtime raises the pitch a step.
    stomp(combo=1){
      const k=Math.max(0,Math.min(8,(combo|0)-1));
      playSampleVariant(['stomp1','stomp2'],.58,.03);
      if(k>0)playSampleSfx('hop',.30,Math.min(2,1+k*.12),0);
    },
    // A single shell may hit several enemies on one frame. Keep the original
    // variant samples but cap overlap at the event group level.
    shellHit(){
      const now=performance.now();
      if(now-(SFX._shellLastAt||-1e9)<60)return;
      SFX._shellLastAt=now;
      playSampleVariant(['shell1','shell2'],.62,.045);
    },
    comboCue(level){
      playSampleSfx('collect',level>=3?.38:.29,level>=3?1.52:1.20,70);
      hojaBgmDuck(level>=3?215:155,level>=3?.50:.64);
    },
    raftWarning(){playSampleSfx('land',.20,1.35,120)},
    crumbleWarning(){playSampleSfx('stone1',.24,1.46,130)},
    bonk(){playSampleSfx('bonk',.54,.96*jitter(.03))},
    skid(){playSampleSfx('shellkick',.52,1)},
    strongStart(){playSampleSfx('strongstart',.50,.92)},
    strongImpact(){playSampleSfx('strong',.72,.94);hojaBgmDuck(150,.63)},
    stoneCrack(){playSampleSfx('stone1',.58,.98)},
    stoneBreak(){playSampleSfx('stone2',.68,.92)},
    land(){playSampleSfx('land',.34,jitter(.025))},
    quiz(){playSampleSfx('quiz',.42,1)},
    correct(){playSampleSfx('correct',.55,1);hojaBgmDuck(190,.58)},
    wrong(){playSampleSfx('wrong',.50,1)},
    death(){playSampleSfx('playerhurt',.68,.94)},
    clear(){playSampleSfx('clear',.62,1)},
    hop(){playSampleSfx('hop',.40,jitter(.04),60)},
    stageStart(){playSampleSfx('stagestart',.48,1)},
    enemyJump(){playSampleSfx('jumpy',.40,jitter(.035))},
    owlWake(){playSampleSfx('owlrise',.48,1)},
    owlDash(){playSampleSfx('owldash',.46,1)},
    roachAlert(){playSampleSfx('roach',.38,1.12)},
    ghostAlert(){playSampleSfx('blankey',.36,1.08)},
    hermieWake(){playSampleSfx('jumpy',.30,.82)},
    martianAlert(){playSampleSfx('alert',.40,1.08,250)},
    martianCharge(){playSampleSfx('shellkick',.42,1.18)},
    robotStun(){playSampleVariant(['shell1','shell2'],.60,.04)},
    robotReboot(){playSampleSfx('shell2',.36,.78)},
    circuitAlert(){playSampleSfx('glitch',.42,1,250)},
    // Reuse existing samples; these cues never consume gameplay randomness.
    gimmickSaw(){playSampleSfx('owldash',.15,1.35,900)},
    gimmickPendulum(){playSampleSfx('shellkick',.16,.80,900)},
    gimmickFan(){playSampleSfx('owlrise',.12,.70,900)},
    gimmickFlame(){playSampleSfx('strongstart',.28,.85,400)},
    gimmickBlocks(){playSampleSfx('stone1',.18,1.35,250)},
    spring(){playSampleSfx('jumpy',.62,1.08,60)},
    collect(){playSampleSfx('collect',.55,1.1,40)},
    crumble(){playSampleSfx('stone1',.32,1.35,120)},
    step(kind,loud=false){
      const k=`step_${kind}${Math.random()<.5?1:2}`;
      playSampleSfx(k,loud?.30:.16,jitter(.06),60);
    }
  };
  function toggleSound(){
      AUDIO_MUTED=!AUDIO_MUTED;
      if(AUDIO_MUTED)stopHojaSnore();
      const btn=document.getElementById('soundBtn');
      if(btn)btn.textContent=AUDIO_MUTED?'소리 끔':'소리 켬';
      if(!AUDIO_MUTED)audioCtx();
      syncBgm();
  }

  function setVolume(value){
      HOJA_STUDENT_VOLUME=Math.max(0,Math.min(1,value));
      if(AUDIO_MASTER)AUDIO_MASTER.gain.value=HOJA_STUDENT_VOLUME;
      const bgm=document.getElementById('hojaBgm');
      if(bgm)bgm.volume=BGM_VOLUME*HOJA_STUDENT_VOLUME*HOJA_BGM_DUCK_FACTOR;
  }

  return {SFX,hojaBgmDuckReset,syncBgm,unlockAudio,playSampleSfx,stopHojaSnore,preloadSampleSfx,
    toggleSound,setVolume,loadedSamples:()=>Object.keys(SAMPLE_BUFFERS).length,
    get muted(){return AUDIO_MUTED;},get volume(){return HOJA_STUDENT_VOLUME;}};
};
