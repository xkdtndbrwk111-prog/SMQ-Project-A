
"use strict";
/* HOJA V0.6.7 R17 TEAM BALANCE isolated TEST module. 
   R16 scoreplate design only, preserving R15 assets/ranks and R14 fruit flight.
   
   Project A team-play rule port; no Project B/Ranking/Sheets writes.
   Reuses HOJA's actual #hqCard question UI, #hqOverlay, balloon/pipe/fruit/enemy sprite assets.
*/
window.HOJA_TEAM_TEST=(()=>{
 const $=id=>document.getElementById(id);
 const COLORS=['#e7655c','#49bc82','#ef8bae','#65c7ee','#529ae5','#a483ea','#52beb9'];
 const shuffle=(a)=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 const assets={};
 const TEAM_CHARACTERS=['HOJA','NAHANSANG','SUMAKSAE','CHILJIDO_ELDER','MURYEONG_KING','BANGASAYUSANG','GWANGGAETO_KING'];
 const TEAM_NAMES=['호자','나한상','수막새','칠지도','무령왕','반가사유상','광개토대왕'];
  const PORTRAITS=JSON.parse(document.getElementById('hojaTeamR10PortraitAssets').textContent);
  let teamEmotion=Array(7).fill('01_NEUTRAL'), emotionTimers=new Map(), portraitLayoutQueued=false;
  const SFX_GAIN='correct',SFX_LOSS='wrong';
 const bgSrc=id=>($(id)?.getAttribute('src')||'');
 const SPRITES={FRUIT:{frames:1},JUMPY:{frames:2},HERMIE:{frames:2},ROACH:{frames:2},OWL:{frames:3},BLANKEY:{frames:4},NAHAN:{frames:7,klass:'htNahanGreet'}};
 const SEASON_BG_IDS={spring:['sgSky','sgCloud1','sgCloud2','sgHills','sgForeground'],summer:['thTroSky','thTroCloudsBG','thTroClouds','thTroWaters'],autumn:['thAutDistant','thAutRow2','thAutRow1','thAutPiles','thAutTrees','thAutLeafTop'],winter:['thWinMountain','thWinHills','thWinFore']};
 let state=null,modal=null,modeEpoch=0;
 let visibleScores=null,fxBusy=false,fxRunId=0;
 let rankCards=null,rankLastOrder='',rankFinalScores=null,roundTimer=0,finalRaf=0,finalBusy=false;
 const rankPulse=new Map();
 let finalResults=null,finalStage=0;
 const fxTimers=new Set();
 function stopFx(){fxRunId++;fxBusy=false;visibleScores=null;for(const t of fxTimers)clearTimeout(t);fxTimers.clear();$('htFxLayer')?.replaceChildren();}
 function fxLater(ms,run,token){const t=setTimeout(()=>{fxTimers.delete(t);if(token===fxRunId&&state)run();},ms);fxTimers.add(t);return t;}
 function scoreSnapshot(){return state.teams.map(t=>t.score);}

 const phaseIs=(...args)=>!!state&&args.includes(state.phase);
 function stopRoundAndFinal(){
   clearTimeout(roundTimer);roundTimer=0; if(finalRaf)cancelAnimationFrame(finalRaf);finalRaf=0;finalBusy=false;finalResults=null;finalStage=0;rankFinalScores=null;
   const banner=$('htRoundAnnouncement');if(banner)banner.hidden=true;
 }
 function ensureRoundHud(){
   if(!rankCards){
     const top=$('hojaGamePlay').querySelector('.hqTop');const row=document.createElement('div');row.id='htRankHud';row.setAttribute('aria-label','실시간 팀 점수 순위');
     top.insertBefore(row,$('hqModeLabel'));rankCards=new Map();
   }
   if(!$('htRoundAnnouncement')){
     const overlay=document.createElement('div');overlay.id='htRoundAnnouncement';overlay.hidden=true;overlay.setAttribute('aria-live','assertive');
     const caption=document.createElement('span');caption.id='htRoundAnnouncementSub';caption.textContent='HOJA TEAM BATTLE';
     const title=document.createElement('strong');title.id='htRoundAnnouncementTitle';overlay.append(caption,title);$('hqStage').append(overlay);
   }
 }
 function clearRankPulse(){
   for(const value of rankPulse.values())clearTimeout(value.timer);
   rankPulse.clear();
 }
 function rankBand(rank,count){
   const edge=Math.max(1,Math.floor((count+1)/3));
   return rank<edge?'top':rank>=count-edge?'bottom':'middle';
 }
 function rankEmotion(team,rank,count){
   const pulse=rankPulse.get(team);
   if(pulse)return pulse.emotion;
   const band=rankBand(rank,count);
   if(band==='top')return team%2===0?'09_SPARKLING':'05_SHY';
   if(band==='bottom')return team%2===0?'06_SAD':'04_TIRED';
   return team%2===0?'01_NEUTRAL':'07_SLEEPY';
 }
 function updateRankPortrait(team,rank,total,score){
   const card=rankCards.get(team), emotion=rankEmotion(team,rank,total);
   const source=PORTRAITS.characters[TEAM_CHARACTERS[team]]?.emotions?.[emotion];
   if(!card||!source)return;
   const image=card.querySelector('.htRankPortrait');
   // Rank displays are independent of the emotion state/timers of side portraits.
   if(image.dataset.emotion!==emotion){
     image.src=source.imageData;image.dataset.emotion=emotion;
     // Crop 384px transparent artwork to its visible silhouette, in a fixed 62px square.
     const bb=source.visibleBounds||[0,0,384,384],w=Math.max(1,bb[2]-bb[0]),h=Math.max(1,bb[3]-bb[1]);
     const scale=Math.min(60/w,60/h);
     image.style.width=(384*scale)+'px';image.style.height=(384*scale)+'px';
     image.style.left=((62-w*scale)/2-bb[0]*scale)+'px';
     image.style.top=((62-h*scale)/2-bb[1]*scale)+'px';
   }
   card.querySelector('.htRankPlace').textContent=String(rank+1)+'위';
   card.setAttribute('aria-label',`${rank+1}위 ${state.teams[team].name}, ${Math.round(score)}점`);
   card.title=`${rank+1}위 · ${state.teams[team].name} · ${Math.round(score)}점`;
   card.classList.toggle('rankUp',rankPulse.get(team)?.direction==='up');
   card.classList.toggle('rankDown',rankPulse.get(team)?.direction==='down');
 }
 function renderRanking(){
   if(!state||!rankCards)return;
   const row=$('htRankHud'), scores=rankFinalScores||visibleScores||state.teams.map(t=>t.score);
   const sorted=state.teams.map((_,i)=>i).sort((a,b)=>scores[b]-scores[a]||a-b);
   const previous=rankLastOrder?rankLastOrder.split(',').map(Number):[];
   for(let i=0;i<state.teams.length;i++){
     let card=rankCards.get(i);
     if(!card){
       card=document.createElement('div');card.className='htRankCard';card.dataset.team=String(i);
       const face=document.createElement('span');face.className='htRankFace';
       const image=document.createElement('img');image.className='htRankPortrait';image.alt='';image.decoding='async';image.draggable=false;
       face.append(image);
       const place=document.createElement('span');place.className='htRankPlace';
       card.append(face,place);rankCards.set(i,card);row.append(card);
     }
   }
   // Pulse only when actual rank changes, not when side-score portraits react.
   if(previous.length===sorted.length){
     for(let rank=0;rank<sorted.length;rank++){
       const id=sorted[rank],was=previous.indexOf(id);
       if(was<0||was===rank)continue;
       const prior=rankPulse.get(id);if(prior)clearTimeout(prior.timer);
       const epoch=state.epoch;
       const direction=rank<was?'up':'down';
       const emotion=direction==='up'?'09_SPARKLING':'06_SAD';
       const timer=setTimeout(()=>{rankPulse.delete(id);if(state&&state.epoch===epoch)renderRanking();},1500);
       rankPulse.set(id,{direction,emotion,timer});
     }
   }
   sorted.forEach((id,rank)=>updateRankPortrait(id,rank,sorted.length,scores[id]));
   const order=sorted.join(',');
   if(rankLastOrder!==order){
     const old=new Map();for(const [id,card] of rankCards)if(card.isConnected){const r=card.getBoundingClientRect();old.set(id,{left:r.left,top:r.top});}
     sorted.forEach(id=>row.append(rankCards.get(id)));
     for(const id of sorted){const card=rankCards.get(id),from=old.get(id);if(!from)continue;
       const after=card.getBoundingClientRect(),dx=from.left-after.left,dy=from.top-after.top;
       if(Math.abs(dx)>1||Math.abs(dy)>1)card.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:670,easing:'cubic-bezier(.22,.86,.27,1)'});
     }
     rankLastOrder=order;
   }
 }

 function announceRound(){
   if(!state||state.phase==='final')return;
   clearTimeout(roundTimer);roundTimer=0;ensureRoundHud();
   const total=Math.floor(state.limit/state.teams.length),round=Math.floor(state.turn/state.teams.length)+1;
   const final=round===total;state.phase='round';paint();
   const banner=$('htRoundAnnouncement');banner.classList.toggle('final',final);
   $('htRoundAnnouncementTitle').textContent=final?'FINAL ROUND':`${round}라운드`;banner.hidden=false;
   const epoch=state.epoch,turn=state.turn;
   roundTimer=setTimeout(()=>{roundTimer=0;if(!state||state.epoch!==epoch||state.turn!==turn||state.phase!=='round')return;banner.hidden=true;state.phase='board';paint();},final?2150:1650);
 }

  function portraitFor(index){
    const id=TEAM_CHARACTERS[index], key=teamEmotion[index]||'01_NEUTRAL';
    return PORTRAITS.characters[id]?.emotions?.[key]||null;
  }
  function portraitImage(index){
    const item=portraitFor(index);
    return item?.imageData||'';
  }
  function updatePortraitImage(index){
    const wrap=$('htTeamPortrait-'+index),image=$('htPortraitImage-'+index);
    if(!wrap||!image)return;
    const item=portraitFor(index);if(!item)return;
    if(image.dataset.emotion!==teamEmotion[index]){image.src=item.imageData;image.dataset.emotion=teamEmotion[index];}
    queuePortraitLayout();
  }
  function resetEmotionTimers(){for(const t of emotionTimers.values())clearTimeout(t);emotionTimers.clear();}
  function setTeamEmotion(index,key,restoreMs=0){
    if(!state||index<0||index>=state.teams.length)return;
    const current=emotionTimers.get(index);if(current){clearTimeout(current);emotionTimers.delete(index);}
    teamEmotion[index]=key;updatePortraitImage(index);
    if(restoreMs>0){const epoch=state.epoch;const timer=setTimeout(()=>{
       emotionTimers.delete(index);if(!state||state.epoch!==epoch)return;
       if(index===state.active&&state.phase==='question')return;
       setTeamEmotion(index,'01_NEUTRAL');
    },restoreMs);emotionTimers.set(index,timer);}
  }
  function reactToVerdict(ok){
    if(!state)return;
    const emotions=ok?['09_SPARKLING','02_SURPRISED','05_SHY']:['06_SAD','08_EMBARRASSED','04_TIRED'];
    setTeamEmotion(state.active,emotions[Math.floor(Math.random()*emotions.length)],4200);
  }
  // R16: one continuous path powers both the STEP silhouette and active ember.
  // The SVG stroke and the CSS offset-path use the exact same geometry at every resize.
  function updateScorePlateGeometry(index){
    const card=$('htTeamScore-'+index);if(!card)return null;
    const width=card.offsetWidth,height=card.offsetHeight;if(width<10||height<10)return null;
    const leftColumn=index%2===0, notchY=Math.round(height*.56);
    const scoreWidth=width*.60, nameWidth=width-scoreWidth;
    const split=leftColumn?nameWidth:scoreWidth;
    const r=Math.max(3,Math.min(13,height*.115,Math.min(scoreWidth,nameWidth)*.18));
    const W=width,H=height,S=split,N=notchY,R=r;
    const n=v=>Math.round(v*100)/100;
    let d;
    if(leftColumn){
      // Mirrored ㄴ: high score area on the RIGHT, lower narrow name LEFT.
      d=`M ${n(S+R)} ${n(2)} L ${n(W-R-2)} 2 Q ${n(W-2)} 2 ${n(W-2)} ${n(R+2)} `+
        `L ${n(W-2)} ${n(H-R-2)} Q ${n(W-2)} ${n(H-2)} ${n(W-R-2)} ${n(H-2)} `+
        `L ${n(R+2)} ${n(H-2)} Q 2 ${n(H-2)} 2 ${n(H-R-2)} `+
        `L 2 ${n(N+R)} Q 2 ${n(N+2)} ${n(R+2)} ${n(N+2)} `+
        `L ${n(S-R)} ${n(N+2)} Q ${n(S-2)} ${n(N+2)} ${n(S-2)} ${n(N-R)} `+
        `L ${n(S-2)} ${n(R+2)} Q ${n(S-2)} 2 ${n(S+R)} 2 Z`;
    }else{
      // ㄴ: high score area on the LEFT, lower narrow name RIGHT.
      d=`M ${n(R+2)} 2 L ${n(S-R)} 2 Q ${n(S+2)} 2 ${n(S+2)} ${n(R+2)} `+
        `L ${n(S+2)} ${n(N-R)} Q ${n(S+2)} ${n(N+2)} ${n(S+R)} ${n(N+2)} `+
        `L ${n(W-R-2)} ${n(N+2)} Q ${n(W-2)} ${n(N+2)} ${n(W-2)} ${n(N+R)} `+
        `L ${n(W-2)} ${n(H-R-2)} Q ${n(W-2)} ${n(H-2)} ${n(W-R-2)} ${n(H-2)} `+
        `L ${n(R+2)} ${n(H-2)} Q 2 ${n(H-2)} 2 ${n(H-R-2)} `+
        `L 2 ${n(R+2)} Q 2 2 ${n(R+2)} 2 Z`;
    }
    const svg=card.querySelector('.htScoreContour');
    if(svg){svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.querySelector('path')?.setAttribute('d',d);}
    card.style.setProperty('--htScoreTrace',`path("${d}")`);
    const score=card.querySelector('.htTeamPts'),name=card.querySelector('.htTeamName');
    const scoreText=score?.textContent||'0', chars=Array.from(scoreText).length;
    const area=Math.max(23,scoreWidth-10);
    const scoreSize=Math.min(78,Math.max(19,area/Math.max(1,chars*.68)));
    card.style.setProperty('--htScoreFont',n(scoreSize)+'px');
    const nameText=name?.textContent||'';
    const count=Array.from(nameText).length;
    const nameSize=Math.min(23,Math.max(9,(nameWidth-7)/Math.max(1,count*.97)));
    card.style.setProperty('--htNameFont',n(nameSize)+'px');
    return {width,top:card.offsetTop,nameCenter:leftColumn?nameWidth/2:scoreWidth+nameWidth/2,notchY};
  }

  function layoutPortraits(){
    portraitLayoutQueued=false;
    if(!state)return;
    for(let index=0;index<state.teams.length;index++){
      const unit=$('htTeamUnit-'+index),card=$('htTeamScore-'+index),wrap=$('htTeamPortrait-'+index),image=$('htPortraitImage-'+index),pose=portraitFor(index);
      if(!unit||!card||!wrap||!image||!pose)continue;
      const flipped=index===0;
      const ax=flipped?384-Number(pose.imageAnchor.x):Number(pose.imageAnchor.x),ay=Number(pose.imageAnchor.y);
      image.style.transform=flipped?'scaleX(-1)':'';
      // R11: Preserve strict zero-offset anchors but use a SIDE-BIASED point on each card.
      // Odd-numbered teams are on the left column, even-numbered teams on the right.
      // Both anchors continue to coincide; only the target on the card is moved.
      // Use layout-box offsets, NOT getBoundingClientRect(): the full unit may
      // currently be scaled/rotated by a score reaction, which must never
      // distort the portrait anchor calculations between emotion frames.
      const plate=updateScorePlateGeometry(index);
      if(!plate)continue;
      const {width:cardWidth,top:cardTop,nameCenter,notchY}=plate;
      // In R16 the strict anchor touches the TOP of the narrow, stepped name zone.
      // It never jumps when different emotion images are swapped.
      const targetX=card.offsetLeft+nameCenter;
      const targetY=cardTop+notchY;
      const rawBounds=pose.visibleBounds||[0,0,384,384];
      const bounds=flipped?[384-Number(rawBounds[2]),Number(rawBounds[1]),384-Number(rawBounds[0]),Number(rawBounds[3])]:rawBounds;
      const stage=$('hqStage'),board=$('htTeamBoard');
      const unitStageX=board.offsetLeft+unit.parentElement.offsetLeft+unit.offsetLeft;
      const stageX=unitStageX+targetX, margin=6;
      // Preserve the EXACT image/name-panel anchor coincidence by shrinking the
      // portrait if needed, rather than translating the anchor independently.
      let maxScale=Math.min(.36,Math.max(.1,(targetY-6)/Math.max(1,ay-Number(bounds[1]))),cardWidth/395);
      if(ax>Number(bounds[0]))maxScale=Math.min(maxScale,Math.max(.05,(stageX-margin)/(ax-Number(bounds[0]))));
      if(Number(bounds[2])>ax)maxScale=Math.min(maxScale,Math.max(.05,(stage.clientWidth-margin-stageX)/(Number(bounds[2])-ax)));
      const scale=Math.max(.05,maxScale);
      const w=384*scale,h=384*scale;
      wrap.style.left=(targetX-ax*scale)+'px';wrap.style.top=(targetY-ay*scale)+'px';
      wrap.style.width=w+'px';wrap.style.height=h+'px';
      image.style.width=w+'px';image.style.height=h+'px';
      wrap.dataset.layoutReady='true';
    }
  }
  function queuePortraitLayout(){if(portraitLayoutQueued)return;portraitLayoutQueued=true;requestAnimationFrame(layoutPortraits);}
  function placeItemPanelInCenter(){
    const stage=$('hqStage'),center=$('htBoardCenter'),layer=$('htItemLayer');
    if(!stage||!center||!layer)return;
    const sr=stage.getBoundingClientRect(),cr=center.getBoundingClientRect();
    // Full modal remains available for final ranking only; items and pipes use center lane.
    const left=Math.max(0,cr.left-sr.left),width=Math.min(cr.width,sr.width-left);
    layer.style.setProperty('--ht-modal-left',left+'px');
    layer.style.setProperty('--ht-modal-width',Math.max(0,width)+'px');
  }
  function onScoreReaction(index,kind){
    if(!state||index>=state.teams.length)return;
    const arr=kind==='gain'?['09_SPARKLING','05_SHY','02_SURPRISED']:['06_SAD','08_EMBARRASSED','04_TIRED'];
    setTeamEmotion(index,arr[Math.floor(Math.random()*arr.length)],3200);
  }
 const act=(label,click,cls='')=>{const b=document.createElement('button');b.type='button';b.className='htAction '+cls;b.textContent=label;if(click)b.addEventListener('click',click);return b;};
 function init(){
   if(modal)return;
   const st=$('hqStage'),board=document.createElement('div');board.id='htTeamBoard';board.hidden=true;
   const left=document.createElement('div');left.className='htScores';left.id='htLeft';
   const center=document.createElement('div');center.className='htBoardCenter';
   const themeBg=document.createElement('div');themeBg.id='htThemeBg';
   const fx=document.createElement('div');fx.id='htFxLayer';
   const status=document.createElement('div');status.id='htStatus';status.className='htBoardStatus';
   const grid=document.createElement('div');grid.id='htBalloonGrid';grid.className='htBalloonGrid';
   const foot=document.createElement('div');foot.id='htFoot';foot.className='htBoardFoot';
   center.append(status,grid,foot);
   st.append(themeBg);
   const right=document.createElement('div');right.id='htRight';right.className='htScores';board.append(left,center,right);st.append(fx);
   const layer=document.createElement('div');layer.id='htItemLayer';layer.hidden=true;layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');
   const card=document.createElement('div');card.className='htModalCard';layer.append(card);modal=card;
   st.append(board,layer);
   ensureRoundHud();
   const arcadeSrc=$('hqArcadeFrame'); void arcadeSrc;
   const src=node=>node?.getAttribute('src')||'';
   assets.balloon='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAAzklEQVR4nGNgGAWjYGABI6UGSIvI/ccn//TNI4rsYKJEMz0Ayb5DD7EnW+3wqpfxPoTCJzVEh08IwkIOV4j905mKwme6ko1VHSxEiQ3JoR+ChEKOXEBsSA76EBx1IKUAZ/zTKu2hA0JpcdCH4KgDKQWjDqQUjDqQUjDqQErBaGuGUjDqQEoB1fokxIKR1ydBB7CQvFD2AkVcxD4Mhf/m4CoUvkGXBAMDw0juF6MDXCGJDsgNORgYviEIA7hyN6m5FRcYOSGICwz7EBwFlAIA5LZNOp7+Wa0AAAAASUVORK5CYII=';
   assets.balloonsByTeam=["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAAzklEQVR4nGNgGAWjYGABI6UGSIvI/ccn//TNI4rsYKJEMz0Ayb5DD7EzgXZ41ZusP4TCJzVEh08IwkIOV4iJTZiKwn9VkI1VHSxEiQ3JoR+ChEKOXEBsSA76EBx1IKUAZ/zTKu2hA0JpcdCH4KgDKQWjDqQUjDqQUjDqQErBaGuGUjDqQEoB1fokxIKR1ydBB7CQbDFSRBH3kJdF4e94+BiFX3PuPgMDw0juF6MDXCGJDsgNORgYviEIA7hyN6m5FRcYOSGICwz7EBwFlAIAnadNOpq+xXkAAAAASUVORK5CYII=","data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAA1ElEQVR4nGNgGAWjYGABI6UGSIvI/ccn//TNI4rsYKJEMz0AC6ka0ENMb0UKfg0Rc1DUkxqigz4EifYNLORwhdgWy3wUvs/xiVjVXYqYw8DAQHxIDv0QJBRy5AJiQ3LQh+CoAykFOOOfVmkPHRBKi4M+BEcdSCkYdSClYNSBlIJRB1IKRlszlIJRB1IKqNYnIRaMvD4JOoCFpHieDYq4uJUGCv/lsRuo/ElHGBgYRnK/GB3gCkl0QG7IwcDwDUEYwJW7Sc2tuMDICUFcYNiH4CigFAAATwlNasRnM7YAAAAASUVORK5CYII=","data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAAzklEQVR4nGNgGAWjYGABI6UGSIvI/ccn//TNI4rsYKJEMz0Ayb5DD7Er5RPwqtfpLEDhkxqiwycEYSGHK8T4spxR+J+m7cWqDhaixIbk0A9BQiFHLiA2JAd9CI46kFKAM/5plfbQAaG0OOhDcNSBlIJRB1IKRh1IKRh1IKVgtDVDKRh1IKWAan0SYsHI65OgA1hIdvlEoYh7aZuh8LddPYXCL9uyjIGBYST3i9EBrpBEB+SGHAwM3xCEAVy5m9TciguMnBDEBYZ9CI4CSgEAi/ZNOmIlJ6kAAAAASUVORK5CYII=","data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAArklEQVR42mNgGAWjYGABI6UGSIvI/ccn//TNI4rsYBp2IYgeYl6bL+BVv83XgKIQHT4hCAs5XCE2Q48ZhZ9x6S/eECU2JId+CBIKOXIBsSE56ENw1IE0S4O0SnukpsXRKB514KgDRx046sDR1sxoa2bUgfTpk1A77Q3/frF2aRuKuLydFwr/4aFtKPyr3VUjvF9MbEiiA3JDbviHIKHcTWpuHQ1BXGDYh+AooBQAAHHWTTphefbbAAAAAElFTkSuQmCC","data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAAzElEQVR4nGNgGAWjYGABI6UGSIvI/ccn//TNI4rsYKJEMz0Ayb5DDzHztuN41Z+sskThkxqiwycEYSGHK8RWR/Og8EOXfsGqDhaixIbk0A9BQiFHLiA2JAd9CI46kFKAM/5plfbQAaG0OOhDcNSBlIJRB1IKRh1IKRh1IKVgtDVDKRh1IKWAan0SYsHI65OgA1hIyoU1oIhLGrij8J9f2InCf7QKon7k9ovRAa6QRAfkhhwMDN8QhAFcuZvU3IoLjJwQxAWGfQiOAkoBAOoXTTqS/Vg3AAAAAElFTkSuQmCC","data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAAzklEQVR4nGNgGAWjYGABI6UGSIvI/ccn//TNI4rsYKJEMz0Ayb5DD7HO/DN41ZdPNEHhkxqiwycEYSGHK8Qii9hR+Mv7fmJVBwtRYkNy6IcgoZAjFxAbkoM+BEcdSCnAGf+0SnvogFBaHPQhOOpASsGoAykFow6kFIw6kFIw2pqhFIw6kFJAtT4JsWDk9UnQASwkw9yaUcSNNT1R+Gevb0fhr9pVy8DAMJL7xegAV0iiA3JDDgaGbwjCAK7cTWpuxQVGTgjiAsM+BEcBpQAAYOZNOq81hiQAAAAASUVORK5CYII=","data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAAzklEQVR4nGNgGAWjYGABI6UGSIvI/ccn//TNI4rsYKJEMz0Ayb5DDzHzVbPxqj8ZlorCJzVEh08IwkIOV4itNrdA4YeePIFVHSxEiQ3JoR+ChEKOXEBsSA76EBx1IKUAZ/zTKu2hA0JpcdCH4KgDKQWjDqQUjDqQUjDqQErBaGuGUjDqQEoB1fokxIKR1ydBB7CQlMtPQhGXtLZE4T8/ehyF/2jiPAYGhpHcL0YHuEISHZAbcjAwfEMQBnDlblJzKy4wckIQFxj2ITgKKAUA21dNOko6QPgAAAAASUVORK5CYII="];
   assets.balloonNoOwner="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAAzklEQVR4nGNgGAWjYGABI6UGSIvI/ccn//TNI4rsYKJEMz0Ayb5DD7Gsujq86qc1NaHwSQ3R4ROCsJDDFWIVyaEo/I65q7Gqg4UosSE59EOQUMiRC4gNyUEfgqMOpBTgjH9apT10QCgtDvoQHHUgpWDUgZSCUQdSCkYdSCkYbc1QCkYdSCmgWp+EWDDy+iToABaSRm4eKOIWFmYo/BMnTqHwz+3awcDAMJL7xegAV0iiA3JDDgaGbwjCAK7cTWpuxQVGTgjiAsM+BEcBpQAAqndNOv5MSy0AAAAASUVORK5CYII=";
   assets.pipe=window.HOJA_TEAM_EMBED_ASSETS?.pipe||'';
   assets.fruits=(window.HOJA_TEAM_EMBED_ASSETS?.fruits||[]).slice();
   assets.nahan=window.HOJA_TEAM_EMBED_ASSETS?.nahanGreetFallback||src($('nahanModeWalk'));
   assets.nahanHi=window.HOJA_TEAM_R13_NAHAN_HI;
   assets.seasons=Object.fromEntries(Object.entries(SEASON_BG_IDS).map(([k,ids])=>[k,ids.map(bgSrc)]));
   assets.owl=src($('enOwlFly'));
   assets.jumpy=src($('enJumpyIdle'));
   assets.hermie=src($('enHermieCrawl'));
   assets.roach=src($('enRoachRun'));
   assets.blankey=src($('enBlankeyFloat'));
   $('hqPlayBack').addEventListener('click',event=>{if(!state)return;event.preventDefault();event.stopImmediatePropagation();back();},true);
   $('hqStage').addEventListener('keydown',event=>{if(!state||state.phase==='question')return;if(event.key==='Escape'){event.preventDefault();back();}},true);
   window.addEventListener('resize',()=>{if(state)requestAnimationFrame(()=>{fitSquareBoard();placeItemPanelInCenter();queuePortraitLayout();});},{passive:true});
 }
 function getHudCells(){return [...$('hqHud').querySelectorAll('.hqHudCell')];}
 function updateHud(){
   if(!state){$('hqHud').hidden=true;return;}
   $('hqHud').hidden=true;ensureRoundHud();
   const round=Math.floor(state.turn/state.teams.length)+1,finalRound=Math.floor(state.limit/state.teams.length);
   $('hqModeLabel').textContent=state.phase==='final'?'결과 발표':round===finalRound?'FINAL ROUND':`${round}라운드`;
   renderRanking();
 }
 function fitSquareBoard(){
   const grid=$('htBalloonGrid'),center=$('htBoardCenter');if(!grid||!center||!state)return;
   const rect=center.getBoundingClientRect();
   const size=Math.max(120,Math.floor(Math.min(rect.width,rect.height)-2));
   grid.style.width=size+'px';grid.style.height=size+'px';
 }
 function applySeasonTheme(key){
   const bg=$('htThemeBg'); if(!bg)return;
   const srcs=(assets.seasons&&assets.seasons[key])||assets.seasons.spring||[];
   bg.replaceChildren(...srcs.filter(Boolean).map((s,i)=>{const im=document.createElement('img');im.className='layer-'+i;im.src=s;im.alt='';return im;}));
   const board=$('htTeamBoard'); if(board) board.dataset.season=key;
 }
 function getScoreCard(index){return document.getElementById('htTeamScore-'+index);}
 function scoreNode(index){return getScoreCard(index)?.querySelector('.htTeamPts')||null;}
 // R17A: Score-transfer origins and destinations are the numeric score zones,
 // not the center of the L-shaped plate (which is biased toward portraits).
 function scoreFlightTarget(index){const card=getScoreCard(index);return card?.querySelector('.htScoreZone')||card||null;}
  // R17B: Score-hit badges must escape the isolated scoreplate/portrait layer.
  // Keep the old card-relative right:10px/top:10px position, but draw in the
  // existing pointer-transparent topmost effect layer (#htFxLayer).
  function showTopScorePop(index,kind,label,fruitHit=false){
    const card=getScoreCard(index),layer=particleLayer();
    if(!card||!layer)return;
    const cr=card.getBoundingClientRect(),lr=layer.getBoundingClientRect();
    const pop=document.createElement(fruitHit?'span':'div');
    pop.className='htScorePop '+(kind==='gain'?'gain':'loss')+(fruitHit?' htFruitHitPop':'');
    pop.textContent=label;
    pop.style.right=(lr.right-cr.right+10)+'px';
    pop.style.top=(cr.top-lr.top+10)+'px';
    layer.append(pop);
    setTimeout(()=>pop.remove(),fruitHit?500:1180);
    return pop;
  }
 function easeOutCubic(t){return 1-Math.pow(1-t,3)}
 function pulseScoreCard(index,kind,label){
   const card=getScoreCard(index),unit=$('htTeamUnit-'+index); if(!card||!unit)return;
   // R11: Animate the portrait AND the score card as a single rigid group.
   const cls=kind==='gain'?'scoreGain':'scoreLoss';
   unit.classList.remove('scoreGain','scoreLoss'); void unit.offsetWidth; unit.classList.add(cls);
    showTopScorePop(index,kind,label);
    setTimeout(()=>unit.classList.remove(cls),1100);
   onScoreReaction(index,kind);
   window.HOJA_V055_SFX?.(kind==='gain'?SFX_GAIN:SFX_LOSS);
 }
 function animateScore(index,from,to,kind,label,delay=0){
   const run=()=>{const node=scoreNode(index); if(!node)return; pulseScoreCard(index,kind,label); const start=performance.now(), dur=900; const fromN=Number(from)||0, toN=Number(to)||0;
     const tick=now=>{const t=Math.min(1,(now-start)/dur),v=Math.round(fromN+(toN-fromN)*easeOutCubic(t)); node.textContent=String(v); if(t<1) requestAnimationFrame(tick); else {node.textContent=String(toN);updateScorePlateGeometry(index);}};
     requestAnimationFrame(tick);
   };
   if(delay>0)setTimeout(run,delay); else run();
 }
 function particleLayer(){return $('htFxLayer');}
 function pointFor(el,layer){const br=layer.getBoundingClientRect(), r=el.getBoundingClientRect(); return {x:r.left-br.left+r.width/2,y:r.top-br.top+r.height/2};}
 function spawnParticleBurstAt(x,y,kind='gain',count=12){const layer=particleLayer(); if(!layer)return; for(let i=0;i<count;i++){const p=document.createElement('span'); p.className='htParticle '+kind; p.style.left=x+'px'; p.style.top=y+'px'; layer.append(p); const ang=(Math.PI*2*i)/count + Math.random()*0.45; const dist=18+Math.random()*28; requestAnimationFrame(()=>{p.style.transition='transform .6s ease, opacity .6s ease'; p.style.transform=`translate(${Math.cos(ang)*dist}px,${Math.sin(ang)*dist}px) scale(.2)`; p.style.opacity='0';}); setTimeout(()=>p.remove(),650);} }
 function spawnParticlesAlong(sx,sy,tx,ty,kind='gain',count=14,delay=0){const layer=particleLayer(); if(!layer)return; const dx=tx-sx, dy=ty-sy; for(let i=0;i<count;i++){setTimeout(()=>{const p=document.createElement('span'); p.className='htParticle '+kind; p.style.left=sx+'px'; p.style.top=sy+'px'; layer.append(p); const k=(i+1)/(count+1), px=sx+dx*k + (Math.random()*18-9), py=sy+dy*k + (Math.random()*18-9); requestAnimationFrame(()=>{p.style.transition='transform .55s ease-out, opacity .55s ease-out'; p.style.transform=`translate(${px-sx}px,${py-sy}px) scale(${.8+Math.random()*.4})`; p.style.opacity='0';}); setTimeout(()=>p.remove(),580);}, delay+i*36);} }
 function spawnTransfer(fromIndex,toIndex,label,kind='swap'){
   const layer=particleLayer(), a=pointTeam(fromIndex), b=pointTeam(toIndex); if(!layer||!a||!b)return;
   const fx=document.createElement('div'); fx.className='htTransfer '+kind; fx.textContent=label; fx.style.left=a.x+'px'; fx.style.top=a.y+'px'; layer.append(fx); spawnParticlesAlong(a.x,a.y,b.x,b.y,kind,16,0);
   requestAnimationFrame(()=>{fx.style.transform=`translate(${b.x-a.x}px,${b.y-a.y}px) scale(1.06)`; fx.style.opacity='0';}); setTimeout(()=>{spawnParticleBurstAt(b.x,b.y,kind,10); fx.remove();},960);
 }
 function spawnTransferFromElToCard(el,toIndex,label,kind='gain'){
   const layer=particleLayer(), b=pointTeam(toIndex); if(!layer||!b||!el)return; const a=pointFor(el,layer);
   const fx=document.createElement('div'); fx.className='htTransfer '+kind; fx.textContent=label; fx.style.left=a.x+'px'; fx.style.top=a.y+'px'; layer.append(fx); spawnParticlesAlong(a.x,a.y,b.x,b.y,kind,14,0);
   requestAnimationFrame(()=>{fx.style.transform=`translate(${b.x-a.x}px,${b.y-a.y}px) scale(1.02)`; fx.style.opacity='0';}); setTimeout(()=>{spawnParticleBurstAt(b.x,b.y,kind,10); fx.remove();},900);
 }
 function spawnCenterTo(index,label,kind='gain'){
   const layer=particleLayer(), b=pointTeam(index); if(!layer||!b)return; const br=layer.getBoundingClientRect(), sx=br.width/2, sy=br.height/2;
   const fx=document.createElement('div'); fx.className='htTransfer '+kind; fx.textContent=label; fx.style.left=sx+'px'; fx.style.top=sy+'px'; layer.append(fx); spawnParticlesAlong(sx,sy,b.x,b.y,kind,16,0);
   requestAnimationFrame(()=>{fx.style.transform=`translate(${b.x-sx}px,${b.y-sy}px) scale(1.04)`; fx.style.opacity='0';}); setTimeout(()=>{spawnParticleBurstAt(b.x,b.y,kind,10); fx.remove();},940);
 }
 function oneVisual(type,payload={}){
   let src=''; if(type==='FRUIT') src=(assets.fruits||[])[payload.index||0]||''; else if(type==='JUMPY') src=assets.jumpy; else if(type==='HERMIE') src=assets.hermie; else if(type==='ROACH') src=assets.roach; else if(type==='OWL') src=assets.owl; else if(type==='BLANKEY') src=assets.blankey; else if(type==='NAHAN') src=assets.nahanHi||assets.nahan;
   return {kind:'sprite',type,src,frames:(SPRITES[type]||SPRITES.FRUIT).frames||1,klass:(SPRITES[type]||{}).klass||'',badge:payload.badge||'',count:payload.count||1};
 }


 /* R7: the same score-effects engine is used by all item kinds. It locks
    Next Team until visual amounts have actually counted to their final values. */
 function sourceOnModal(){return modal?.querySelector('.htItemSpriteClip, .htItemSpriteImg, .htAnimSprite, .htItemArt') || modal;}
 function snapPoint(el){const layer=particleLayer();if(!layer||!el||!el.isConnected)return null;return pointFor(el,layer);}
 function pointTeam(index){const layer=particleLayer(),zone=scoreFlightTarget(index);return layer&&zone?pointFor(zone,layer):null;}
 function pointItem(){return snapPoint(sourceOnModal())||{x:particleLayer()?.offsetWidth/2||0,y:particleLayer()?.offsetHeight/2||0};}
 function sparkleTrip(a,b,kind,label,token,travel=620){
   const layer=particleLayer();if(!layer||!a||!b||token!==fxRunId)return;
   const orb=document.createElement('div');orb.className='htFxOrb '+kind;orb.textContent=label;
   orb.style.left=a.x+'px';orb.style.top=a.y+'px';layer.append(orb);
   const dx=b.x-a.x,dy=b.y-a.y;
   const motion=orb.animate([
     {transform:'translate(-50%,-50%) scale(.55)',opacity:0,offset:0},
     {transform:`translate(calc(-50% + ${dx*.2}px),calc(-50% + ${dy*.2-12}px)) scale(.85)`,opacity:.72,offset:.20},
     {transform:`translate(calc(-50% + ${dx*.52}px),calc(-50% + ${dy*.52-32}px)) scale(1.08)`,opacity:.87,offset:.53},
     {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.68)`,opacity:.78,offset:1}
   ],{duration:travel,easing:'ease-in-out',fill:'forwards'});
   // Actual glowing particle objects, not only a floating text label.
   for(let i=0;i<12;i++){
     fxLater(i*38,()=>{
       const p=document.createElement('span');p.className='htFxEmber '+kind;
       const t=i/12;const x=a.x+dx*t,y=a.y+dy*t-22*Math.sin(Math.PI*t);
       p.style.left=x+'px';p.style.top=y+'px';layer.append(p);
       p.animate([{transform:'scale(1)',opacity:1},{transform:`translate(${Math.random()*34-17}px,${Math.random()*34-17}px) scale(.12)`,opacity:0}],{duration:500,fill:'forwards'}).finished.finally(()=>p.remove());
     },token);
   }
   fxLater(travel,()=>{motion.cancel();orb.remove();spawnParticleBurstAt(b.x,b.y,kind,9);},token);
 }
 /* R14: Each fruit is one +10 firebolt, taking a separate curved route.
    Keep the authoritative total in state.teams; stage only its visible value. */
 function fruitCurvePoint(a,b,t,bend){
   const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||1;
   const arc=4*t*(1-t)*bend;
   const layer=particleLayer(),w=layer?.clientWidth||Infinity,h=layer?.clientHeight||Infinity;
   return {x:Math.max(14,Math.min(w-14,a.x+dx*t-dy/dist*arc)),
           y:Math.max(14,Math.min(h-14,a.y+dy*t+dx/dist*arc))};
 }
 function fruitFlightOrigins(count){
   const nodes=[...modal.querySelectorAll('.htItemSpriteClip.fruit')];
   const fallback=pointItem();
   return Array.from({length:count},(_,i)=>{
     const node=nodes[i];if(node&&node.isConnected)return snapPoint(node)||fallback;
     return {x:fallback.x+(i-(count-1)/2)*22,y:fallback.y+(i%2?9:-9)};
   });
 }
 function fruitFirebolt(origin,target,index,count,token,travel){
   const layer=particleLayer();if(!layer||!origin||!target||token!==fxRunId)return;
   const bends=[-75,58,-32,103,19];
   const bend=bends[index%5]+Math.floor(index/5)*17;
   const orb=document.createElement('span');orb.className='htFruitFirebolt';
   orb.dataset.fruitFlight=String(index+1);
   orb.dataset.fruitBend=String(bend);
   orb.setAttribute('aria-hidden','true');
   orb.style.left=origin.x+'px';orb.style.top=origin.y+'px';
   layer.append(orb);
   const frames=[];
   for(let k=0;k<=16;k++){
     const t=k/16,p=fruitCurvePoint(origin,target,t,bend);
     frames.push({offset:t,transform:`translate(calc(-50% + ${p.x-origin.x}px),calc(-50% + ${p.y-origin.y}px)) scale(${t<.12?.72:t>.90?.63:1})`,opacity:t===0?0:(t===1?.86:1)});
   }
   const motion=orb.animate(frames,{duration:travel,easing:'linear',fill:'forwards'});
   // A few fading sparks stay on this bolt's OWN curved route, not a shared line.
   for(let k=1;k<=6;k++){
     fxLater(Math.round(travel*k/8),()=>{
       const p=fruitCurvePoint(origin,target,k/8,bend);
       const ember=document.createElement('span');ember.className='htFruitAfterglow';
       ember.style.left=p.x+'px';ember.style.top=p.y+'px';layer.append(ember);
       const drift=(index%2?1:-1)*(5+k);
       const smoke=ember.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:.85},{transform:`translate(calc(-50% + ${drift}px),calc(-50% - ${8+k*2}px)) scale(.12)`,opacity:0}],{duration:250,easing:'ease-out',fill:'forwards'});
       smoke.finished.then(()=>ember.remove()).catch(()=>ember.remove());
     },token);
   }
   fxLater(travel,()=>{motion.cancel();orb.remove();spawnParticleBurstAt(target.x,target.y,'gain',4);},token);
 }
 function settleOneFruit(index,from,count,token){
   if(token!==fxRunId||!state||!visibleScores)return;
   const next=from+count*10;
   visibleScores[index]=next;const node=scoreNode(index);if(node)node.textContent=String(next);
   if(count===1){pulseScoreCard(index,'gain','+10');}
   else{
     // Repeated little hits while the portrait and score card share one wobble.
     const card=getScoreCard(index);
      if(card)showTopScorePop(index,'gain','+10',true);
     if(node){node.classList.remove('htFruitScoreTick');void node.offsetWidth;node.classList.add('htFruitScoreTick');setTimeout(()=>node.classList.remove('htFruitScoreTick'),180);}
   }
   renderRanking();
 }
 function afterScoreArrival(index,from,to,token){
   if(token!==fxRunId||!state)return;
   const kind=to>=from?'gain':'loss'; const delta=to-from;
   if(!delta){const node=scoreNode(index);if(node)node.textContent=String(to);return;}
   // Animations operate on the actual score card (no repaint during the sequence).
   animateScore(index,from,to,kind,`${delta>0?'+':''}${delta}`);
 }
 function runUnifiedScoreFx(tx){
   const token=++fxRunId;
   const before=tx.before || scoreSnapshot(),after=scoreSnapshot();
   visibleScores=before.slice();
   fxBusy=true;
   const advance=modal?.querySelector('.htItemActions .htAction');
   if(advance){advance.disabled=true;advance.textContent='점수 정산 중…';}
   const me=Number.isInteger(tx.me)?tx.me:state.active;
   const target=tx.target;
   const item=pointItem();
   const at=(delay,fn)=>fxLater(delay,fn,token);
   const team=(index)=>pointTeam(index);
   const delta=(index)=>after[index]-before[index];
   let until=0;
   switch(tx.kind){
     case 'fruit':{
       const d=delta(me),n=Number(tx.fruitCount)||d/10;
       // Never pretend fractional fruit counts: only 10-point fruit rewards use this path.
       if(d>0&&d%10===0&&Number.isInteger(n)&&n===d/10&&n<=5){
         const origins=fruitFlightOrigins(n),destination=team(me);
         const stagger=120,baseFlight=570;
         for(let i=0;i<n;i++){
           const travel=baseFlight+i*28,launch=i*stagger;
           at(launch,()=>fruitFirebolt(origins[i],destination,i,n,token,travel));
           at(launch+travel,()=>settleOneFruit(me,before[me],i+1,token));
         }
         // The next turn must remain locked until ALL five firebolts have landed.
         until=(n-1)*stagger+baseFlight+(n-1)*28+720;
       }else if(d){
         // Fallback for future non-standard rewards; no score calculation changes.
         sparkleTrip(item,team(me),'gain',`+${d}`,token);
         at(650,()=>afterScoreArrival(me,before[me],after[me],token));until=1750;
       }
       break;}
     case 'gain':{
       const d=delta(me);if(d){sparkleTrip(item,team(me),'gain',`+${d}`,token);at(650,()=>afterScoreArrival(me,before[me],after[me],token));until=1750;}
       break;}
     case 'loss':{
       const d=delta(me);if(d){sparkleTrip(team(me),item,'loss',String(d),token);at(650,()=>afterScoreArrival(me,before[me],after[me],token));until=1750;}
       break;}
     case 'steal':{
       const d=delta(me),lost=before[target]-after[target];
       if(d>0&&lost>0){const start=tx.origin||item;sparkleTrip(start,team(target),'loss',`-${lost}`,token);
         at(650,()=>{afterScoreArrival(target,before[target],after[target],token);sparkleTrip(team(target),team(me),'gain',`+${d}`,token);});
         at(1320,()=>afterScoreArrival(me,before[me],after[me],token));until=2420;}
       break;}
     case 'swap':{
       if(target!==me&&(delta(me)!==0||delta(target)!==0)){
         if(tx.origin)sparkleTrip(tx.origin,team(target),'swap','교환',token,420);
         at(tx.origin?450:50,()=>{
           sparkleTrip(team(me),team(target),'swap',`${before[me]}`,token,780);
           sparkleTrip(team(target),team(me),'swap',`${before[target]}`,token,780);
         });
         const arrive=(tx.origin?450:50)+800;
         at(arrive,()=>{afterScoreArrival(me,before[me],after[me],token);afterScoreArrival(target,before[target],after[target],token);});
         until=arrive+1100;
       }
       break;}
   }
   if(!until)until=200;
   at(until,()=>{
     fxBusy=false;visibleScores=null;
     for(let i=0;i<after.length;i++){const node=scoreNode(i);if(node)node.textContent=String(after[i]);}
     renderRanking();
     if(advance){advance.disabled=false;advance.textContent='다음 팀';}
   });
 }
 function fromServer(sources){
   const families=new Map();
   if(!Array.isArray(sources)||!sources.length||sources.length>5)throw Error('Project B에서 선택한 문제 묶음이 없습니다.');
   for(const entry of sources){
     if(!entry?.data||entry.data.questionSchemaVersion!==2||![1,2].includes(entry.data.sourceSheetVersion)||!Array.isArray(entry.data.questions))throw Error('문제 데이터 스키마를 확인하세요.');
     for(const row of entry.data.questions){
       if(row?.isNull===true)continue;
       const key=String(entry.sheetName||'')+'::'+String(row?.familyId||'');
       if(!String(row?.familyId||'').trim()||!String(row?.question||'').trim())continue;
       const type=row.type;let q=null;
       if(type==='SUBJECTIVE'&&String(row.answer||'').trim()){
         q={type:'SUBJECTIVE',text:String(row.question),answerText:String(row.answer),explanation:String(row.explanation||'')};
       }else if(type==='OX'&&['O','X'].includes(String(row.answer).toUpperCase())){
         q={type:'OX',text:String(row.question),choices:['O','X'],answer:['O','X'].indexOf(String(row.answer).toUpperCase()),explanation:String(row.explanation||'')};
       }else if(type==='MULTIPLE'&&Array.isArray(row.options)&&[3,4].includes(row.options.filter(x=>String(x??'').trim()).length)&&['1','2','3','4'].includes(String(row.answer))){
         // Team mode uses 3 choices. Keep the correct answer even when legacy Project B provides 4.
         const valid=row.options.map((text,i)=>({text:String(text??'').trim(),correct:i===Number(row.answer)-1})).filter(v=>v.text);
         if(!valid.some(v=>v.correct))continue;
         const correctItem=valid.find(v=>v.correct);
         const distractors=shuffle(valid.filter(v=>!v.correct)).slice(0,2);
         if(distractors.length!==2)continue;
         const options=shuffle([correctItem,...distractors]);
         q={type:'MC3',text:String(row.question),choices:options.map(v=>v.text),answer:options.findIndex(v=>v.correct),explanation:String(row.explanation||'')};
       }
       if(!q)continue;
       const f=families.get(key)||[];
       if(!f.some(x=>x.type===q.type))f.push(q);
       families.set(key,f);
     }
   }
   if(families.size<25)throw Error('고유 문제 묶음이 '+families.size+'개입니다. 팀전에는 25개가 필요합니다.');
   const selected=shuffle([...families.values()]).slice(0,25).map(v=>shuffle(v)[0]);
   return arrangeBoard(selected);
 }
 function arrangeBoard(list){
   const deck=shuffle(list),board=Array(25).fill(null);
   const byType=type=>{const i=deck.findIndex(q=>q.type===type);return i>=0?deck.splice(i,1)[0]:deck.shift();};
   // Project A's strong bingo cells preferentially hold subjective problems.
   shuffle([13,1,5,21,25]).forEach(num=>{board[num-1]=byType('SUBJECTIVE')});
   shuffle([2,3,4,6,10,11,15,16,20,22,23,24]).forEach(num=>{board[num-1]=byType('OX')});
   for(let i=0;i<25;i++)if(!board[i])board[i]=deck.shift();
   return board.map((q,i)=>({...q,num:i+1}));
 }
 function launch(count,season='spring'){
   init();stopFx();stopRoundAndFinal();clearRankPulse();rankLastOrder='';if(rankCards){for(const node of rankCards.values())node.remove();rankCards.clear();}count=Number(count);
   if(!Number.isInteger(count)||count<2||count>7)throw Error('팀 수는 2~7팀만 지원합니다.');
   let questions;
   try{questions=fromServer(window.HOJA_B_LIVE?.sources)}catch(error){
     // Published Project B question data is mandatory in Apps Script live play.
     // Keep the selected mode visible rather than switching to an offline TEST page.
     window.alert('팀전을 시작할 수 없습니다: '+String(error?.message||error)+'\n고유 문제 묶음 25개 이상을 가진 공개 카트리지를 선택하세요.');
     return;
   }
   window.HOJA_GAMEPLAY?.stop?.();
   hideBlockingStartLayers();
   const host=$('hojaGamePlay');window.HOJA_MODE_PREVIEW?.hide?.();host.hidden=false;host.dataset.mode='team';
   $('hqArcadeFrame').hidden=true;$('hqStage').hidden=false;$('hqHud').hidden=false;$('hqOverlay').hidden=true;$('hqResult').hidden=true;
   $('hqModeLabel').textContent=`함께 놀기 · ${count}팀`;
   $('htTeamBoard').hidden=false;$('htItemLayer').hidden=true;
   modeEpoch++;resetEmotionTimers();teamEmotion=Array(7).fill('01_NEUTRAL');
   state={epoch:modeEpoch,phase:'board',season,teams:Array.from({length:count},(_,i)=>({name:TEAM_NAMES[i],score:0})),questions,
     done:new Map(),bingo:new Map(),active:0,turn:0,limit:Math.floor(25/count)*count,
     current:null,pending:[],selectionLocked:false,itemApplied:false,finalShown:false};
   applySeasonTheme(season||'spring');
   paint();announceRound();window.HOJA_USAGE?.track?.('TEAM',count);
 }
 function back(){
   stopFx();stopRoundAndFinal();resetEmotionTimers();clearRankPulse();rankLastOrder='';modeEpoch++;state=null;$('hqOverlay').hidden=true;$('htItemLayer').hidden=true;$('htTeamBoard').hidden=true;
   $('hojaGamePlay').hidden=true;delete $('hojaGamePlay').dataset.mode;$('hqHud').hidden=true;
   window.HOJA_MODE_PREVIEW?.show?.(window.HOJA_SEASON_SESSION?.current?.()||'spring');
 }
 function owner(num){const x=state.done.get(num);if(!x)return null;return state.bingo.has(num)?state.bingo.get(num):(x.correct?x.team:null);}
 
function paint(){
  if(!state)return;
  updateHud();
  const round=Math.floor(state.turn/state.teams.length)+1;
  const lastRound=state.turn>=state.limit-state.teams.length;
  $('htStatus').textContent=(state.phase==='final'?'게임 종료':lastRound?'FINAL ROUND':`${state.teams.length}팀 · ${round}라운드`);
  $('htFoot').textContent=`진행 ${state.turn}/${state.limit}턴 · 총 25개 풍선 · ${state.teams[state.active]?.name||''} 차례`;
  // R12B FIX: Preserve existing portrait and score DOM nodes between ALL phases.
  // Previously left/right.replaceChildren() rebuilt every 384px image on each
  // pipe click; before two queued animation frames resized portraits, all
  // seven could flash at their intrinsic size. Keeping nodes is the root fix.
  const left=$('htLeft'),right=$('htRight');
  const keep=new Set();
  state.teams.forEach((team,index)=>{
    const parent=index%2===0?left:right;
    let unit=$('htTeamUnit-'+index);
    let card, image;
    if(!unit){
      unit=document.createElement('div');unit.className='htTeamUnit';unit.id='htTeamUnit-'+index;
      card=document.createElement('div');card.id='htTeamScore-'+index;card.className='htTeamScore';
      const name=document.createElement('div');name.className='htTeamName';
      const points=document.createElement('div');points.className='htTeamPts';
      const nameZone=document.createElement('div');nameZone.className='htNameZone';nameZone.append(name);
      const scoreZone=document.createElement('div');scoreZone.className='htScoreZone';scoreZone.append(points);
      const contour=document.createElementNS('http://www.w3.org/2000/svg','svg');
      contour.classList.add('htScoreContour');contour.setAttribute('aria-hidden','true');
      contour.setAttribute('preserveAspectRatio','none');
      const shape=document.createElementNS('http://www.w3.org/2000/svg','path');
      shape.classList.add('htScoreShapePath');contour.append(shape);
      card.append(contour,scoreZone,nameZone);
      const portrait=document.createElement('div');portrait.className='htTeamPortrait';portrait.id='htTeamPortrait-'+index;
      image=document.createElement('img');image.id='htPortraitImage-'+index;image.alt=team.name+' 감정 일러스트';
      image.decoding='async';image.draggable=false;
      portrait.append(image);unit.append(portrait,card);
      image.src=portraitImage(index);image.dataset.emotion=teamEmotion[index];
    }else{
      card=unit.querySelector('.htTeamScore');image=unit.querySelector('.htTeamPortrait img');
      if(image.dataset.emotion!==teamEmotion[index]){
        image.src=portraitImage(index);image.dataset.emotion=teamEmotion[index];
      }
    }
    if(unit.parentElement!==parent)parent.append(unit);
    keep.add(unit);
    card.classList.toggle('active',index===state.active);
    card.style.setProperty('--team',COLORS[index]);
    card.querySelector('.htTeamName').textContent=team.name;
    card.querySelector('.htTeamPts').textContent=String(visibleScores?.[index]??team.score);
    let spark=card.querySelector('.htFuseSpark');
    if(index===state.active&&!spark){
      spark=document.createElement('span');spark.className='htFuseSpark';spark.setAttribute('aria-hidden','true');card.append(spark);
    }else if(index!==state.active&&spark)spark.remove();
  });
   // R16B: Reserve the RIGHT fourth lane for the webtoon at ALL team counts (2–7).
   // Exactly one reusable anchor is kept across paints and score/emotion updates.
   // Without an explicit fourth-row slot, 2/4/6-team modes previously had no banner.
  let emptyRight=right.querySelector('.htTeamEmptySlot');
  if(!emptyRight){emptyRight=document.createElement('div');emptyRight.className='htTeamEmptySlot';right.append(emptyRight);}
  keep.add(emptyRight);
  if(!emptyRight.querySelector('.htWebtoonTeamBanner')){
      const anchor=document.createElement('a');anchor.className='htWebtoonTeamBanner hojaWebtoonLink';
      anchor.href='https://comic.naver.com/challenge/detail?titleId=851281&no=1';
      anchor.target='_blank';anchor.rel='noopener noreferrer';
      anchor.setAttribute('aria-label','호자 웹툰 박물관이야기 새 탭에서 보기');
      anchor.title='호자 웹툰 새 탭에서 열기';
      const image=document.createElement('img');image.src=$('hojaWebtoonIntroImage').src;
      image.width=320;image.height=166;image.decoding='async';image.alt='서울시교육청에서 대차게 까인 박물관이야기 웹툰';
      anchor.append(image);
      // The game is in #frame: suppress only event bubbling, NEVER navigation.
      anchor.addEventListener('click',event=>event.stopPropagation());
      anchor.addEventListener('pointerdown',event=>event.stopPropagation());
      anchor.addEventListener('mousedown',event=>event.stopPropagation());
      emptyRight.append(anchor);
  }
  for(const parent of [left,right]){
    for(const child of [...parent.children])if(!keep.has(child))child.remove();
  }
  const grid=$('htBalloonGrid');grid.replaceChildren();
  for(const q of state.questions){
    const done=state.done.has(q.num);const n=owner(q.num);
    const b=document.createElement('button');b.type='button';b.className='htBalloon'+(done?' solved':'')+(state.phase==='final'&&!done?' unused':'');
    b.disabled=done||state.phase!=='board';b.setAttribute('aria-label',`${q.num}번 문제${done?' 해결됨':''}`);
    if(done&&n!==null)b.style.setProperty('--team',COLORS[n]);else if(done)b.style.setProperty('--team','#4c6674');
    const im=document.createElement('img');im.src=done?(n!==null?assets.balloonsByTeam[n]:assets.balloonNoOwner):assets.balloon;im.alt='';const num=document.createElement('span');num.className='htBalloonNumber';num.textContent=done&&n!==null?`${n+1}`:done?'×':String(q.num);
    b.append(im,num);b.addEventListener('click',()=>openQuestion(q.num));grid.append(b);
  }
  // Ensure a freshly created unit receives final portrait geometry immediately.
  // Never reveal an intrinsic 384px portrait on the next paint.
  layoutPortraits();
  requestAnimationFrame(()=>{fitSquareBoard();placeItemPanelInCenter();queuePortraitLayout();});
}

 /* R13: Only the measured STEP12-4 text-fitting approach is adapted from arcade.
    No arcade rules, scoring, time or network methods are reused. */
 let teamFitQueued=false;
 function teamQuizLines(el){
   if(!el||!el.firstChild)return 0;
   const r=document.createRange();r.selectNodeContents(el);
   const rects=Array.from(r.getClientRects()).filter(v=>v.width>0&&v.height>0);
   const ys=[];for(const box of rects)if(!ys.some(y=>Math.abs(y-box.top)<2))ys.push(box.top);
   return ys.length;
 }
 function teamQuestionFits(el,slot,maxLines){
   if(slot.clientWidth<=0||slot.clientHeight<=0)return false;
   const lines=teamQuizLines(el),a=el.getBoundingClientRect(),b=slot.getBoundingClientRect();
   return lines>=1&&lines<=maxLines&&a.height<=b.height+1&&a.width<=b.width+1&&
      el.scrollWidth<=slot.clientWidth+1&&el.scrollHeight<=slot.clientHeight+1;
 }
 function fitTeamQuestion(){
   teamFitQueued=false;
   if(!state||state.phase!=='question'||$('hqOverlay')?.hidden)return;
   const card=$('hqCard'),q=$('hqQuestion'),slot=$('hqQuestionArea'),choices=$('hqChoices');
   if(!card||!q||!slot||!choices||!slot.clientHeight||!slot.clientWidth)return;
   const kind=card.dataset.quizKind,ox=kind==='OX',subjective=kind==='SUBJECTIVE';
   const maxQ=Math.max(12,Math.floor(Math.min(slot.clientHeight/1.09,slot.clientWidth*.6)));
   const fits=limit=>{let low=12,high=maxQ,best=12;while(low<=high){const size=(low+high)>>1;
     card.style.setProperty('--ht-r13-question-size',size+'px');
     if(teamQuestionFits(q,slot,limit)){best=size;low=size+1;}else high=size-1;
   }return best;};
   const q2=fits(2),q3=fits(3),selected=(!q2||q3>q2*(ox?1.16:1.14))?q3:q2;
   card.style.setProperty('--ht-r13-question-size',Math.max(12,selected)+'px');
   q.classList.toggle('hojaQuizMultiline',teamQuizLines(q)>1);
   if(ox){
      const size=Math.max(36,Math.round(Math.min(140,choices.clientHeight*.72,choices.clientWidth*.36)));
      card.style.setProperty('--ht-r13-ox-size',size+'px');return;
   }
   if(subjective)return;
   const labels=[...choices.querySelectorAll('.hqChoiceLabel')];
   const buttons=[...choices.querySelectorAll('.hqChoice')];if(!labels.length)return;
   const w=card.clientWidth,h=card.clientHeight;
   const maxSize=Math.max(24,Math.round(Math.min(124,w*.095,h*.165)));
   const minSize=Math.min(maxSize,Math.max(21,Math.round(Math.min(w,h)*.037)));
   let chosen=minSize;
   for(let size=maxSize;size>=minSize;size--){
      card.style.setProperty('--ht-r13-choice-size',size+'px');
      const fit=labels.every((label,i)=>{const btn=buttons[i];if(!btn)return false;
         const sty=getComputedStyle(btn),space=btn.clientHeight-(parseFloat(sty.paddingTop)||0)-(parseFloat(sty.paddingBottom)||0)-4;
         return space>=size*1.05&&label.scrollHeight<=space+1&&label.scrollWidth<=label.clientWidth+1;
      });
      if(fit){chosen=size;break;}
   }
   card.style.setProperty('--ht-r13-choice-size',chosen+'px');
 }
 function requestTeamQuestionFit(){if(teamFitQueued)return;teamFitQueued=true;requestAnimationFrame(fitTeamQuestion);}
 window.addEventListener('resize',requestTeamQuestionFit,{passive:true});
 document.addEventListener('fullscreenchange',requestTeamQuestionFit);
 if(document.fonts?.ready)document.fonts.ready.then(requestTeamQuestionFit).catch(()=>{});

function openQuestion(number){
   if(!phaseIs('board')||state.done.has(number)||state.turn>=state.limit)return;
   const q=state.questions[number-1];if(!q)return;
   state.current=q;state.phase='question';paint();setTeamEmotion(state.active,'10_CURIOUS');
   const card=$('hqCard'),choices=$('hqChoices');card.dataset.quizKind=q.type;choices.replaceChildren();
   $('hqType').textContent=`${state.teams[state.active].name} · QUESTION ${String(number).padStart(2,'0')} · ${q.type==='SUBJECTIVE'?'주관식':q.type==='OX'?'O / X':'객관식'}`;
   $('hqQuestion').textContent=q.text;$('hqFeedback').textContent='';$('hqHint').textContent=q.type==='SUBJECTIVE'?'학생이 구두로 답합니다. 교사가 정답을 공개한 후 판정하세요.':'정답을 선택하세요.';
   if(q.type==='SUBJECTIVE'){
     choices.append(act('정답 확인',()=>{
       if(!phaseIs('question'))return;choices.replaceChildren();const answer=document.createElement('div');answer.className='htAnswerReveal';answer.textContent='정답: '+q.answerText;
       choices.append(answer,act('정답 처리 → 토관 선택',()=>verdict(true),'htPrimary'),act('오답 처리',()=>verdict(false),'htDanger'));
       $('hqHint').textContent='교사가 정답·오답을 판정합니다.';requestTeamQuestionFit();
     },'htPrimary'));
   }else{
     q.choices.forEach((text,i)=>{
       const b=document.createElement('button');b.className='hqChoice';b.type='button';b.dataset.answer=q.type==='OX'?text:'';
       const num=document.createElement('span');num.className='hqChoiceNumber';num.textContent=(i+1)+'.';const label=document.createElement('span');label.className='hqChoiceLabel';label.textContent=text;
       b.append(num,label);b.addEventListener('click',()=>{if(!phaseIs('question'))return;verdict(i===q.answer);});choices.append(b);
     });
   }
   $('hqOverlay').hidden=false;
   requestTeamQuestionFit();
 }
 function showCorrectImpact(){
   const fx=$('htFxLayer');if(!fx)return;
   fx.querySelector('.htCorrectImpact')?.remove();
   const impact=document.createElement('div');impact.className='htCorrectImpact';
   impact.setAttribute('aria-live','polite');impact.setAttribute('role','status');
   const inner=document.createElement('div');inner.className='htCorrectImpactInner';
   const title=document.createElement('strong');title.className='htCorrectImpactTitle';title.textContent='정답!';
   const sub=document.createElement('span');sub.className='htCorrectImpactSub';sub.textContent='아이템 선택 기회 획득!';
   inner.append(title,sub);impact.append(inner);
   for(let i=0;i<14;i++){
     const star=document.createElement('i');star.className='htCorrectSpark';star.setAttribute('aria-hidden','true');
     star.style.setProperty('--angle',(i*360/14)+'deg');
     star.style.setProperty('--dist',(130+(i%3)*38)+'px');
     impact.append(star);
   }
   fx.append(impact);
 }
 function openCorrectPipes(){
   const round=Math.floor(state.turn/state.teams.length)+1;
   const lowScore=Math.min(...state.teams.map(t=>t.score));
   const allowNegative=!(round>=3&&state.teams[state.active].score===lowScore);
   state.pending=Array.from({length:3},()=>rollItem(round,allowNegative));state.phase='pipes';
   display('정답! 토관을 선택하세요','세 개의 토관 중 하나를 선택하면 아이템이 공개됩니다.',[],[]);
   const row=document.createElement('div');row.className='htPipeSelect';
   state.pending.forEach((item,index)=>{
     const b=document.createElement('button');b.className='htPipeBtn';b.type='button';
     const img=document.createElement('img');img.src=assets.pipe;img.alt='HOJA 토관';
     const t=document.createElement('span');t.textContent=(index+1)+'번 토관';b.append(img,t);
     b.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();selectPipe(index);});row.append(b);
   });
   modal.append(row);
 }
 function verdict(ok){
   if(!phaseIs('question')||!state.current)return;
   state.phase='resolving';const num=state.current.num;
   if(state.done.has(num))return;
   state.done.set(num,{team:state.active,correct:!!ok});
   reactToVerdict(!!ok);
   window.HOJA_V055_SFX?.(ok?'correct':'wrong');
   if(!ok){
     $('hqOverlay').hidden=true;paint();
     display('오답입니다',state.current.explanation||'이번 문제는 점수를 획득하지 못했습니다.',[oneVisual('JUMPY')],[act('다음 팀',finishTurn,'htPrimary')]);
     return;
   }
   // Hold the correct answer on screen for a short, visible success hit.
   // No bonus score yet: the selected pipe determines the item as before.
   const q=state.current;
   if(q.type!=='SUBJECTIVE'){
     [...$('hqChoices').children].forEach((button,index)=>{
       button.disabled=true;
       button.classList.toggle('correct',index===q.answer);
       if(index!==q.answer)button.style.opacity='.55';
     });
   }
   showCorrectImpact();
   const epoch=state.epoch,active=state.active,fxToken=fxRunId;
   fxLater(790,()=>{
     if(!state||state.epoch!==epoch||state.phase!=='resolving'||state.active!==active||state.current?.num!==num)return;
     $('htFxLayer')?.querySelector('.htCorrectImpact')?.remove();
     $('hqOverlay').hidden=true;paint();openCorrectPipes();
   },fxToken);
 }
 function rollItem(round,allowNegative){
   const coin=()=>({type:'FRUIT',value:[10,20,30,40,50][Math.floor(Math.random()*5)]});
   const jumpy=()=>({type:'JUMPY',value:[10,20,30][Math.floor(Math.random()*3)]});
   const hermie=()=>({type:'HERMIE',value:[10,20,30][Math.floor(Math.random()*3)]});
   if(round===1)return coin();
   let pool;
   if(round===2)pool=[[.5,coin],[.25,hermie],[.25,jumpy]];
   else if(allowNegative)pool=[[.1,()=>({type:'OWL'})],[.1,()=>({type:'ROACH'})],[.1,()=>({type:'NAHAN'})],[.175,coin],[.175,hermie],[.175,jumpy],[.175,()=>({type:'BLANKEY'})]];
   else pool=[[.1,()=>({type:'OWL'})],[.1,()=>({type:'NAHAN'})],[.4,coin],[.4,hermie]];
   // R17: Seven-team mode has no bingo, so its NAHAN ownership item never appears.
   // Keep the old no-candidate suppression for 2–6 teams; renormalize remaining weights.
   if(state.teams.length===7||!getPeachCandidates().length){pool=pool.filter(([,f])=>f().type!=='NAHAN');const total=pool.reduce((a,x)=>a+x[0],0);pool=pool.map(([p,f])=>[p/total,f]);}
   let r=Math.random();for(const [p,f] of pool){r-=p;if(r<0)return f();}return pool[pool.length-1][1]();
 }
 function getPeachCandidates(){if(!state)return[];return [...state.done.keys()].filter(num=>{
    if(state.bingo.get(num)===state.active)return false;
    const d=state.done.get(num);return !(d.correct&&d.team===state.active&&!state.bingo.has(num));
   });}
 
function selectPipe(index){
  if(!phaseIs('pipes'))return; const item=state.pending[index];if(!item)return;
  state.phase='item';state.pending=[];
  const me=state.active,teams=state.teams,team=teams[me];
  const before=scoreSnapshot();
  let art=[],name='',description='',tx=null;
  switch(item.type){
    case 'FRUIT':{
      const count=Math.max(1,item.value/10);team.score+=item.value;
      name='과일 획득!';description=`과일 ${count}개 · +${item.value}점`;
      art=Array.from({length:count},(_,i)=>oneVisual('FRUIT',{index:i%Math.max(1,assets.fruits.length)}));
      tx={kind:'fruit',me,before,fruitCount:count};break;}
    case 'JUMPY':{
      const prev=team.score;team.score=Math.max(0,team.score-item.value);
      name='점피의 습격!';description=`${prev-team.score}점 감소 (0점 미만으로 내려가지 않습니다)`;
      art=[oneVisual('JUMPY')];tx={kind:'loss',me,before};break;}
    case 'ROACH':{
      name='적의 습격!';
      if(teams.length>=6){
        const prev=team.score;team.score=Math.max(0,prev-30);
        description=`${prev-team.score}점 감소 (6~7팀은 최대 30점, 0점 아래로 내려가지 않습니다)`;
      }else{
        team.score=0;description='현재 팀 점수가 0점으로 초기화되었습니다.';
      }
      art=[oneVisual('ROACH')];tx={kind:'loss',me,before};break;}
    case 'BLANKEY':{
      const indices=teams.map((_,i)=>i).filter(i=>i!==me);
      const low=indices.reduce((x,i)=>teams[i].score<teams[x].score?i:x,indices[0]);
      [team.score,teams[low].score]=[teams[low].score,team.score];
      name='블랭키의 장난!';description=`가장 점수가 낮은 ${teams[low].name}과 점수를 교환했습니다.`;
      art=[oneVisual('BLANKEY')];tx={kind:'swap',me,target:low,before};break;}
    case 'HERMIE':{
      name='허미의 등껍질!';description=`다른 팀 한 곳에서 최대 ${item.value}점을 빼앗아 옵니다.`;
      art=[oneVisual('HERMIE')];
      chooseTarget(name,description,art,(idx,origin)=>{
        const snap=scoreSnapshot(),taken=Math.min(item.value,Math.max(0,teams[idx].score));
        teams[idx].score-=taken;team.score+=taken;
        showResult(name,`${teams[idx].name}에게서 ${taken}점을 빼앗아 왔습니다.`,art,
          {kind:'steal',me,target:idx,before:snap,origin});
      });return;}
    case 'OWL':{
      name='부엉이의 선택!';description='점수를 교환할 팀을 선택하세요. 우리 팀을 선택하면 점수를 유지합니다.';
      art=[oneVisual('OWL')];
      chooseTarget(name,description,art,(idx,origin)=>{
        const snap=scoreSnapshot();if(idx!==me)[team.score,teams[idx].score]=[teams[idx].score,team.score];
        showResult(name,idx===me?'우리 팀을 선택하여 점수를 유지했습니다.':`${teams[idx].name}과 점수를 교환했습니다.`,art,
          {kind:'swap',me,target:idx,before:snap,origin});
      },true);return;}
    case 'NAHAN':{
      team.score+=20;name='나한상의 인사!';description='기본 +20점! 이미 해결된 빙고 칸 하나의 소유권을 변경하세요.';
      art=[oneVisual('NAHAN')];peachBoard(name,description,art,before);return;}
  }
  showResult(name,description,art,tx,{fromPipe:true});
}
function chooseTarget(name,description,images,apply,includeSelf=false){
  if(!phaseIs('item'))return;state.phase='target';display(name,description,images,[]);
  const row=document.createElement('div');row.className='htItemActions';modal.append(row);
  state.teams.forEach((team,i)=>{
    if(!includeSelf&&i===state.active)return;
    const b=act(team.name+` (${team.score}점)`,()=>{if(!phaseIs('target'))return;const origin=snapPoint(b);state.phase='item';apply(i,origin);});b.style.borderColor=COLORS[i];row.append(b);
  });
}
function peachBoard(name,description,images,before){
  state.phase='peach';display(name,description,images,[]);
  const eligible=new Set(getPeachCandidates()),grid=document.createElement('div');grid.className='htPeachGrid';
  for(let n=1;n<=25;n++){
    const b=document.createElement('button');b.type='button';b.className='htPeachCell';b.textContent=n;b.disabled=!eligible.has(n);
    const ownerTeam=owner(n);if(ownerTeam!==null)b.style.background=COLORS[ownerTeam];
    b.addEventListener('click',()=>{if(!phaseIs('peach')||!eligible.has(n))return;state.bingo.set(n,state.active);showResult('나한상의 선물',`+20점 및 ${n}번 칸의 빙고 소유권을 ${state.active+1}팀으로 변경했습니다.`,images,{kind:'gain',me:state.active,before});});grid.append(b);
  }modal.append(grid);
}
 function finishTurn(){
   if(!phaseIs('result','resolving')||fxBusy||finalBusy)return;
   stopFx();setTeamEmotion(state.active,'01_NEUTRAL');state.turn++;state.current=null;state.pending=[];
   if(state.turn>=state.limit){showFinal();return;}
   state.active=(state.active+1)%state.teams.length;state.phase='board';$('htItemLayer').hidden=true;
   if(state.turn%state.teams.length===0)announceRound();else paint();
 }
 // R17: Bingo reward table (2–6 teams), 7-team mode disables bingo entirely.
 const HT_R17_BINGO_POINTS={2:40,3:70,4:100,5:100,6:100,7:0};
 function buildFinalResults(){
   if(!state)return[];
   const teamCount=state.teams.length;
   const bingoPoints=HT_R17_BINGO_POINTS[teamCount]??0;
   const requiredCells=teamCount>=5&&teamCount<=6?4:5;
   return state.teams.map((t,i)=>{
     const correct=[...state.done.values()].filter(d=>d.correct&&d.team===i).length;
     const owned=new Set();for(let n=1;n<=25;n++)if(owner(n)===i)owned.add(n);
     const lines=[];for(let r=0;r<5;r++)lines.push([1,2,3,4,5].map(c=>r*5+c));
     for(let c=1;c<=5;c++)lines.push([0,5,10,15,20].map(x=>x+c));
     lines.push([1,7,13,19,25],[5,9,13,17,21]);
     // Count each physical row/column/diagonal once, even when all 5 cells are owned.
     const bingo=bingoPoints?lines.filter(line=>line.filter(n=>owned.has(n)).length>=requiredCells).length:0;
     const bingoBonus=bingo*bingoPoints;
     return {index:i,name:t.name,base:t.score,correct,bingo,answerBonus:correct*10,bingoBonus,total:t.score+correct*10+bingoBonus};
   });
 }
 function showFinal(){
   if(!state||state.finalShown)return;stopRoundAndFinal();state.finalShown=true;state.phase='final';
   finalResults=buildFinalResults();finalStage=0;paint();display('최종 점수 정산','먼저 각 팀이 획득한 기본 점수를 공개합니다.',[],[]);
   modal.classList.add('htFinalSequence');
   const kicker=document.createElement('div');kicker.className='htFinalKicker';kicker.id='htFinalKicker';kicker.textContent='BASE SCORE';
   modal.insertBefore(kicker,modal.firstChild);
   const grid=document.createElement('div');grid.id='htFinalGrid';grid.className='htFinalGrid';
   finalResults.forEach(res=>{
     const card=document.createElement('div');card.className='htFinalCard';card.id='htFinalCard-'+res.index;card.style.setProperty('--winner-color',COLORS[res.index]);
     const name=document.createElement('div');name.className='htFinalTeamName';name.textContent=res.name;
     const score=document.createElement('strong');score.className='htFinalScore';score.id='htFinalScore-'+res.index;score.textContent=String(res.base);
     const detail=document.createElement('div');detail.className='htFinalDetail';detail.id='htFinalDetail-'+res.index;detail.textContent='기본 점수';
     card.append(name,score,detail);grid.append(card);
   });modal.append(grid);
   const controls=document.createElement('div');controls.className='htItemActions htFinalActions';
   const next=act('정답 보너스 공개',advanceFinal,'htPrimary');next.id='htFinalNext';controls.append(next);modal.append(controls);
   window.HOJA_V055_SFX?.('correct');
 }
 function advanceFinal(){
   if(!state||state.phase!=='final'||finalBusy||!finalResults||finalStage>=3)return;
   finalBusy=true;const next=$('htFinalNext');next.disabled=true;
   let stage=++finalStage;
   // Seven-team mode skips the entire bingo bonus reveal stage.
   if(state.teams.length===7&&stage===2)stage=finalStage=3;
   const heading=modal.querySelector('.htModalTitle'),desc=modal.querySelector('.htModalDesc');
   const kicker=$('htFinalKicker');const targets=finalResults.map(r=>stage===1?r.base+r.answerBonus:stage===2?r.total:r.total);
   if(stage===1){kicker.textContent='ANSWER BONUS';heading.textContent='정답 보너스';desc.textContent='정답 1개당 +10점';}
   else if(stage===2){
     kicker.textContent='BINGO BONUS';heading.textContent='빙고 보너스';
     const cells=state.teams.length>=5?'4칸 이상':'5칸 완성';
     desc.textContent=`빙고 1줄(${cells})당 +${HT_R17_BINGO_POINTS[state.teams.length]}점`;
   }
   else{kicker.textContent='FINAL RESULT';heading.textContent='최종 결과';desc.textContent='';}
   if(stage===3){
     const max=Math.max(...finalResults.map(r=>r.total)),winners=finalResults.filter(r=>r.total===max);
     heading.textContent=winners.length===1?`${winners[0].name} 우승!`:'공동 우승!';
     desc.textContent=winners.map(r=>r.name).join(' · ')+'  |  '+max+'점';
     modal.classList.add('htWinnerRevealed');
     finalResults.forEach(r=>{$('htFinalCard-'+r.index).classList.toggle('winner',r.total===max);$('htFinalCard-'+r.index).classList.toggle('notWinner',r.total!==max);$('htFinalDetail-'+r.index).textContent=`최종 ${r.total}점`;});
     next.remove();const again=act('다시 시작',()=>launch(state.teams.length,state.season),'htPrimary');const exit=act('모드 선택',back,'htSecondary');modal.querySelector('.htFinalActions').append(again,exit);
     rankFinalScores=finalResults.map(r=>r.total);renderRanking();window.HOJA_V055_SFX?.('correct');finalBusy=false;return;
   }
   const starts=finalResults.map(r=>stage===1?r.base:r.base+r.answerBonus),duration=1250,epoch=state.epoch;
   const begin=performance.now();
   const tick=now=>{
     if(!state||state.epoch!==epoch||state.phase!=='final')return;
     const t=Math.min(1,(now-begin)/duration),ease=1-Math.pow(1-t,3);
     finalResults.forEach((r,i)=>{$('htFinalScore-'+r.index).textContent=String(Math.round(starts[i]+(targets[i]-starts[i])*ease));});
     if(t<1)finalRaf=requestAnimationFrame(tick);
     else{finalRaf=0;finalResults.forEach((r,i)=>{
       $('htFinalScore-'+r.index).textContent=String(targets[i]);
       $('htFinalDetail-'+r.index).textContent=stage===1?`정답 ${r.correct}개 +${r.answerBonus}점`:(r.bingo?`빙고 ${r.bingo}줄 +${r.bingoBonus}점`:'완성된 빙고 없음 · +0점');
     });
     next.disabled=false;next.textContent=stage===1&&state.teams.length!==7?'빙고 보너스 공개':'최종 우승 팀 공개';finalBusy=false;window.HOJA_V055_SFX?.('correct');}
   };
   finalRaf=requestAnimationFrame(tick);
 }

function showResult(title,desc,images,tx=null,options={}){
  state.phase='result';visibleScores=tx?.before?.slice()||null;paint();
  display(title,desc,images,[act('다음 팀',finishTurn,'htPrimary')]);
  if(!tx)return;
  if(options.fromPipe){
    // Do not spawn a full-strength glowing +score orb in the same frame as a pipe click.
    const epoch=modeEpoch, advance=modal?.querySelector('.htItemActions .htAction');
    fxBusy=true;
    if(advance){advance.disabled=true;advance.textContent='아이템 공개 중…';}
    setTimeout(()=>{
      if(epoch!==modeEpoch||!state||state.phase!=='result')return;
      runUnifiedScoreFx(tx);
    },240);
  }else runUnifiedScoreFx(tx);
}
function display(title,desc,images=[],actions=[]){
  $('hqOverlay').hidden=true;$('htItemLayer').hidden=false;$('htItemLayer').classList.toggle('htFinalFull',state?.phase==='final');placeItemPanelInCenter();modal.classList.remove('htFinalSequence','htWinnerRevealed');modal.replaceChildren();
  const h=document.createElement('h2');h.className='htModalTitle';h.textContent=title;
  const p=document.createElement('p');p.className='htModalDesc';p.textContent=desc;modal.append(h,p);
  if(images.length){const strip=document.createElement('div');strip.className='htItemArt';
    images.forEach((rawVis,visIdx)=>{
      if(!rawVis)return;
      const vis=typeof rawVis==='string'?{src:rawVis,frames:1,type:'STATIC'}:rawVis;
      const count=vis.type==='FRUIT'?Math.max(1,vis.count||1):1;
      for(let j=0;j<count;j++){
        const wrap=document.createElement('div');wrap.className='htItemVisual';
        const clip=document.createElement('div');clip.className='htItemSpriteClip '+(vis.type==='FRUIT'?'fruit':vis.type==='NAHAN'?'nahan':'enemy');
        const frames=Math.max(1,Number(vis.frames)||1);clip.style.setProperty('--frames',String(frames));
        const im=document.createElement('img');im.className='htSpriteSheet';im.src=vis.type==='FRUIT'?(assets.fruits[(visIdx+j)%Math.max(1,assets.fruits.length)]||vis.src):vis.src;
        im.alt='';im.draggable=false;clip.append(im);wrap.append(clip);
        if(vis.badge){const badge=document.createElement('span');badge.className='htItemBadge';badge.textContent=vis.badge;wrap.append(badge);}
        strip.append(wrap);
      }
    });modal.append(strip);}
  if(actions.length){const row=document.createElement('div');row.className='htItemActions';actions.forEach(b=>row.append(b));modal.append(row);}
  // Keep the background/side scoreboards unchanged. Only soften the content replacement.
  if(state?.phase==='item'||state?.phase==='result'||state?.phase==='target'||state?.phase==='peach'){
    modal.animate([{opacity:.88},{opacity:1}],{duration:160,easing:'ease-out'});
  }
}

 // R2: explicit offline TEST entry. Imported questions never call Project B or ranking RPC.
 function hideBlockingStartLayers(){
   window.HOJA_LOADING?.hide?.();window.HOJA_REPOSITORY?.hide?.();
   for(const id of ['hojaCatalog']){const x=$(id);if(x)x.hidden=true;}
 }
 return Object.freeze({launch,back});
})();

