
"use strict";
/* HOJA V0.5.8 mode selector: four canonical seasonal maps, clean gather/deal, shared layer & ground scroll. TEST only. */
window.HOJA_MODE_PREVIEW=(()=>{
 let stage='root',selection=null,teamCount=null,lastTime=0,raf=0,elapsed=0,season='spring';
 let busy=false,transitionTimer=0;
 const host=()=>document.getElementById('hojaNextMode');
 const title=()=>document.getElementById('hmTitle');
 const rail=()=>document.getElementById('hmSelections');
 const hint=()=>document.getElementById('hmSelectionHint');
 const asset=id=>document.getElementById(id);
 const H=416,G=H-60;let W=960;
 const SEASONS=Object.freeze({
  spring:{name:'봄',sky:'#50bbff',ground:'#885a45',terrain:'paV2Terrain',v2Family:0,bg:['sgSky','sgCloud1','sgCloud2','sgHills','sgForeground']},
  summer:{name:'여름',sky:'#50bbff',ground:'#b27c57',terrain:'paV2Terrain',v2Family:0,bg:['thTroSky','thTroCloudsBG','thTroClouds','thTroWaters']},
  autumn:{name:'가을',sky:'#fff3d8',ground:'#743e45',terrain:'paV2Terrain',v2Family:4,bg:['thAutDistant','thAutRow2','thAutRow1','thAutPiles','thAutTrees','thAutLeafTop']},
  winter:{name:'겨울',sky:'#fff8ff',ground:'#a66567',terrain:'paV2Terrain',v2Family:8,bg:['thWinMountain','thWinHills','thWinFore']}
 });
 const SEASON_KEYS=Object.keys(SEASONS);
 function selectSeason(requested){
   const pick=Object.prototype.hasOwnProperty.call(SEASONS,requested)
       ? requested : window.HOJA_SEASON_SESSION.current();
   season=pick;
   host().dataset.season=pick;
   host().querySelector('.hmLandscape')?.setAttribute('aria-label',
        'HOJA '+SEASONS[pick].name+' 스테이지 · 호자와 나한상, 몬스터 이동 애니메이션');
 }
 function clearSeason(){delete host().dataset.season;}
 // Every ground actor advances at exactly 53 world px/sec; offsets are deliberately spaced.
 // Hoja original 64x64 WALK is left-facing, so horizontal mirror is required for rightward movement.
 const actors=[
  {key:'hojaModeWalk',frames:8,offset:100,sw:64,sh:64,type:'hoja',sz:64,flip:true},
  {key:'nahanModeWalk',frames:4,offset:400,sw:64,sh:64,type:'nahan',sz:64},
  {key:'enJumpyIdle',frames:2,offset:700,sw:32,sh:32,type:'jumpy',sz:56},
  {key:'enHermieCrawl',frames:2,offset:1000,sw:32,sh:32,type:'hermie',sz:56},
  {key:'enRoachRun',frames:2,offset:1300,sw:32,sh:32,type:'roach',sz:56},
  {key:'enOwlFly',frames:3,offset:1600,sw:32,sh:32,type:'owl',sz:54},
  {key:'enBlankeyFloat',frames:4,offset:1900,sw:32,sh:32,type:'ghost',sz:54}
 ];
  // The mode selector draws from its own 8-frame WALK PNG, not the Phaser scene.
  // Cache the same native 64x64 closed-eye overlay used in arcade/intro.
  // Only eye pixels are changed; WALK artwork, fps, position and mirroring stay intact.
  const modeHojaClosedEyes=new Array(8);
  function modeHojaClosedEye(frameIndex){
    if(!modeHojaClosedEyes[frameIndex]){
      const source=RAW_GROUPS.WALK?.[frameIndex];
      if(source)modeHojaClosedEyes[frameIndex]=makeHojaEyeOverlayCanvas(source,'close eye');
    }
    return modeHojaClosedEyes[frameIndex]||null;
  }
 // Seven actors share 53px/sec and form a seamless 7 x 300px loop.
 // Even BLANKEY-to-Hoja wraparound is 300px, so nobody appears isolated.
 const SHARED_SPEED=53, TRAVEL_PERIOD=2100;
 const syncBack=()=>window.HOJA_CATALOG?.syncBack?.();
 function sound(){window.HOJA_AUDIO_CONTROL?.unlockFromGesture?.();const a=window.HOJA_INTRO_AUDIO;if(a?.enabled)a.play('collect',.42,1.18,65);}
 function button(label,subtitle,next){const b=document.createElement('button');b.type='button';b.className='hmPick';const st=document.createElement('strong');st.textContent=label;const sm=document.createElement('small');sm.textContent=subtitle;b.append(st);if(subtitle){b.append(sm)}b.addEventListener('click',e=>{e.stopPropagation();transitionTo(next)});return b;}
 function transitionTo(commit){
  if(busy)return;busy=true;sound();const buttons=Array.from(rail().querySelectorAll('.hmPick'));
  const bounds=rail().getBoundingClientRect();const centerX=bounds.left+bounds.width/2,centerY=bounds.top+bounds.height/2;
  buttons.forEach(b=>{const r=b.getBoundingClientRect();b.style.setProperty('--hm-gx',Math.round(centerX-(r.left+r.width/2))+'px');b.style.setProperty('--hm-gy',Math.round(centerY-(r.top+r.height/2))+'px');b.classList.add('hmGather');b.disabled=true;});
  transitionTimer=setTimeout(()=>{transitionTimer=0;try{commit();if(!host().hidden)render(true);}finally{busy=false;}},415);
 }
 function render(deal=false){
  const r=rail();r.replaceChildren();r.className='hmSelections';
  if(stage==='root'){
   title().textContent='게임 모드 선택';hint().textContent='원하는 게임 방식을 선택하세요.';
   r.append(button('혼자 놀기','',()=>{stage='solo'}));
   r.append(button('함께 놀기','',()=>{stage='team'}));
  }else if(stage==='solo'){
   title().textContent='혼자 놀기';hint().textContent='도전할 방식을 골라 주세요.';
   r.append(button('아케이드 모드','HOJA 횡스크롤 게임 · 랭킹 등록 기능',()=>{selection='arcade';window.HOJA_TUTORIAL_GATE?.startArcade(()=>window.HOJA_GAMEPLAY.launch('arcade',season))}));
   r.append(button('문제 풀이 모드','무한 문제 풀이 모드',()=>{selection='quiz';window.HOJA_GAMEPLAY.launch('quiz',season)}));
   const practiceCard=button('연습모드','호자 조작법 배우기 · 언제든 다시 연습',()=>{selection='practice';window.HOJA_TUTORIAL_GATE?.open('practice')});
   practiceCard.classList.add('hmPractice');r.append(practiceCard);
  }else if(stage==='team'){
   title().textContent='함께 놀기 · 팀 수 선택';hint().textContent='2~7팀 중 하나를 선택하세요.';r.classList.add('teamCount');
   for(let i=2;i<=7;i++)r.append(button(String(i),i+'팀',()=>{selection='team';teamCount=i;window.HOJA_TEAM_TEST.launch(i,season)}));

  }
  if(deal){
   // Measure the *new* buttons after layout: each travels from the SAME center
   // to its true slot, regardless of 2/6 cards, wrapping or viewport size.
   const rect=r.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
   Array.from(r.querySelectorAll('.hmPick')).forEach(b=>{
    const p=b.getBoundingClientRect();
    b.style.setProperty('--hm-deal-x',Math.round(cx-(p.left+p.width/2))+'px');
    b.style.setProperty('--hm-deal-y',Math.round(cy-(p.top+p.height/2))+'px');
    b.classList.add('hmDeal');b.addEventListener('animationend',()=>b.classList.remove('hmDeal'),{once:true});setTimeout(()=>{if(b.isConnected)b.classList.remove('hmDeal');},650);
   });
  }
  syncBack();
 }
 function cancel(){if(transitionTimer)clearTimeout(transitionTimer);transitionTimer=0;busy=false;}
 function back(){if(busy){cancel();render();return true;}if(stage==='solo'||stage==='team'){stage='root';render();return true;}return false;}
 function show(requestedSeason){cancel();stage='root';selection=null;teamCount=null;selectSeason(requestedSeason);host().hidden=false;elapsed=0;lastTime=0;render();paint();start();}
 function hide(){cancel();host().hidden=true;stop();clearSeason();}
 function demo(requestedSeason){window.HOJA_LOADING?.hide?.();window.HOJA_REPOSITORY?.hide?.();document.getElementById('hojaCatalog').hidden=true;show(requestedSeason);syncBack();}
 function frame(ctx,image,sx,sy,sw,sh,dx,dy,dw,dh,flip){if(!image||(image.complete===undefined?!(image.width>0):(!image.complete||!image.naturalWidth)))return;ctx.save();if(flip){ctx.translate(Math.round(dx+dw),0);ctx.scale(-1,1);dx=0;}ctx.drawImage(image,sx,sy,sw,sh,Math.round(dx),Math.round(dy),Math.round(dw),Math.round(dh));ctx.restore();}
  function paint(){
   const c=document.getElementById('hmSeasonCanvas');const ctx=c?.getContext('2d');if(!ctx)return;
   const viewport=c.parentElement?.getBoundingClientRect();
   if(!viewport?.width||!viewport.height)return;
   // Match the *entire* canvas aspect to the visible viewport. Uniform pixels,
   // no squeezed source textures, clipping line or separate hand-painted top.
   const logicalWidth=Math.max(240,Math.round(H*viewport.width/viewport.height));
   if(c.width!==logicalWidth||c.height!==H){c.width=logicalWidth;c.height=H;}
   W=logicalWidth;
   const theme=SEASONS[season];
   ctx.imageSmoothingEnabled=false;
   ctx.clearRect(0,0,W,H);
   ctx.fillStyle=theme.sky;ctx.fillRect(0,0,W,H);
   const worldScroll=Math.floor(elapsed*SHARED_SPEED);
   // Original seasonal parallax assets only. Repeat EACH source layer on its
   // natural 288px period, speed up towards the terrain, preserve tile boundaries.
   theme.bg.forEach((key,index)=>{
    const im=asset(key);if(!im?.naturalWidth)return;
    const width=im.naturalWidth*2;
    const speed=theme.bg.length===1?1:(.30+.70*(index/(theme.bg.length-1)));
    const shift=Math.floor(worldScroll*speed)%width;
    const y=G-im.naturalHeight*2+20;
    for(let x=-shift-width;x<W;x+=width)ctx.drawImage(im,Math.round(x),Math.round(y),width,im.naturalHeight*2);
   });
   // Foreground and V2 ground tiles use exactly the SAME 53px/s world offset.
   // All surfaces remain repeated, integer aligned, and drawn only from paV2Terrain.
   const terrain=asset('paV2Terrain');const tileShift=worldScroll%32;
   ctx.fillStyle=theme.ground;ctx.fillRect(0,G,W,H-G);
   if(terrain?.naturalWidth){
    const topY=theme.v2Family*16,bodyY=(theme.v2Family+1)*16,centerX=7*16;
    for(let x=-tileShift;x<W;x+=32){
     frame(ctx,terrain,centerX,topY,16,16,x,G,32,32);
     for(let y=G+32;y<H;y+=32)frame(ctx,terrain,centerX,bodyY,16,16,x,y,32,32);
    }
   }
   actors.forEach(a=>{
    const im=asset(a.key);if(!im?.naturalWidth)return;
    const x=((a.offset+elapsed*SHARED_SPEED)%TRAVEL_PERIOD)-90;
    const fps=a.type==='hoja'?12:a.type==='nahan'?10:8;
    const idx=Math.floor(elapsed*fps)%a.frames;
    let y=G-a.sz+3,w=a.sz,h=a.sz;
    if(a.type==='jumpy'){
     const cycle=(elapsed*2.45)%1;
     const lift=24*Math.max(0,Math.sin(cycle*Math.PI));
     h=Math.round(a.sz*(cycle<.12?.87:1));y=G-h+3-lift;
    }
    if(a.type==='owl')y=G-139+Math.sin(elapsed*2)*7;
    if(a.type==='ghost')y=G-118;
    frame(ctx,im,idx*a.sw,0,a.sw,a.sh,x,y,w,h,!!a.flip);
     // Shared 3.5s / 140ms blink pattern (including the occasional double blink).
     // Draw in precisely the same position and mirrored orientation as the WALK frame.
     if(a.type==='hoja'&&hojaEyeNameAt(performance.now(),null)==='close eye'){
       const eyes=modeHojaClosedEye(idx);
       if(eyes)frame(ctx,eyes,0,0,64,64,x,y,w,h,!!a.flip);
     }
   });
  }
 function tick(t){if(host().hidden){raf=0;return;}if(lastTime)elapsed+=Math.min(.05,(t-lastTime)/1000);lastTime=t;paint();raf=requestAnimationFrame(tick);}
 function start(){if(!raf){lastTime=0;raf=requestAnimationFrame(tick)}}
 function stop(){if(raf)cancelAnimationFrame(raf);raf=0;lastTime=0;}
 return {show,hide,back,demo,get state(){return {stage,selection,teamCount,busy,season,sharedSpeed:SHARED_SPEED}}};
})();

