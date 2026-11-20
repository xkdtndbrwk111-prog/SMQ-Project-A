
"use strict";
// Only the choreography is intro-specific. Sprite textures, frame rates, terrain
// rasterizer, parallax constructor and particles are inherited from STEP13-7.
// Intro uses a uniform integer 2x camera zoom in BOTH phases.
// STEP13-7 Hoja/monster/terrain source geometry stays byte-identical.
// Pixel invariant: every 64x64 character texel maps to a square 2x2 display pixel.
// Camera zoom and character sprite scale are INTEGER and identical on both axes.
// In particular never use 1.5x camera zoom for the 64x64 character art.
let ATTRACT_W=960;
const ATTRACT_H=540, ATTRACT_TOTAL=35;
function hojaIntroMeasureWidth(){
 const rect=document.getElementById('frame')?.getBoundingClientRect();
 if(!rect||rect.width<=0||rect.height<=0)return 960;
 return Math.max(540,Math.min(2200,Math.round(ATTRACT_H*rect.width/rect.height)));
}
const PHASE1_ZOOM=2, PHASE2_ZOOM=2; // uniformly scaled square source pixels in BOTH phases
const CHASE_SPEED=270, CHASE_CAMERA_LEAD=280, NAHAN_FINAL_WORLD_X=1990;
// Chase world-frame camera width becomes 480 at 2x; a 280px lead keeps Hoja in view.
// Nahan at 1990 enters from the right ~3sec after the chase starts.
// Scene timings: Nahan passes first; monsters follow from THE SAME LEFT entrance.
// Intro-only timeline, not a modification of original STEP13-7 scene physics.
const BEATS=Object.freeze({
 stopStart:3.5,stopEnd:4.75,flower:8.2,nahanRush:10.0,nahanGone:12.75,
 monsters:13.05,harass:16.15,stomp:18.60,impact:19.02,
 heroExit:19.23,black:21.18,chase:21.62,
 nahanChaseShow:24.50,logo:29.10
});
const GROUNDLINE_FRACTION=0.79; // Keep the ground near its previous screen row when zooming out.
const HERO_FOOT=F, FLOWER_X=595, LOCK_CAMERA_LEFT=255;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
class HojaAttractScene extends HojaSharedScene {
 init(data){this.elapsedMs=(data && Number(data.seek)||0)*1000;this.pausedByUser=false;this.stompTriggered=false;this.lastFootFx=-1;}
 create(){
  // Season is settled BEFORE the Phaser scene registers textures, background or V2 ground.
  this.introSeason=applyIntroSeason(window.HOJA_SEASON_SESSION.current());
  document.getElementById('frame')?.setAttribute('data-intro-season',this.introSeason);
  // Exact STEP13-7 registration and animator code. Source ASCII remains 64x64.
  const assetIds=[...Object.keys(HOJA_ASSET_MAP)];
  for(const id of assetIds){
   const item=HOJA_ASSET_MAP[id],el=document.getElementById(id);
   if(!el || !el.naturalWidth)throw new Error('Game art not loaded: '+id);
   if(this.textures.exists(item.key))continue;
   if(item.sheet)this.textures.addSpriteSheet(item.key,el,{frameWidth:item.sheet[0],frameHeight:item.sheet[1]});
   else this.textures.addImage(item.key,el);
  }
  // Register actual STEP13-7 four-season parallax layers once; these are
  // native 288x208 source images, never independent re-painted approximations.
  for(const id of [...new Set(Object.values(INTRO_SEASON_THEMES).flatMap(x=>x.bg.map(layer=>layer.key)))]){
    if(this.textures.exists(id))continue;
    if(Object.values(HOJA_ASSET_MAP).some(x=>x.key===id))continue;
    const el=document.getElementById(id);
    if(!el?.naturalWidth)throw new Error('HOJA season image missing: '+id);
    this.textures.addImage(id,el);
  }
  // Exactly five Kenney Emotes (Pixel Style 3, original 16x16 PNG) as
  // intro-only textures; no runtime fetch, no other Kenney asset included.
  for(const mood of ['question','music','sweat','alarm','heart']){
   const tag=document.getElementById('kenney_emote_'+mood);
   if(!tag||!tag.naturalWidth||!tag.naturalHeight)throw new Error('Kenney emote failed: '+mood);
   const key='hoja_kenney_'+mood;
   if(!this.textures.exists(key))this.textures.addImage(key,tag);
  }
  this.registerHojaTextures();
  this.createHojaAnimations();
  this.cameras.main.setZoom(this.phaseZoom(this.elapsedMs/1000));
  this.cameras.main.roundPixels=true;
  const introSkyColors={spring:'#51b8ec',summer:'#51b8ec',autumn:'#fff3d8',winter:'#fff8ff'};
  this.cameras.main.setBackgroundColor(introSkyColors[this.introSeason]);
  this.createBackground();
  // Responsive intro: all seasonal TileSprites cover the widened logical viewport.
  // Keep the vertical origin untouched (same terrain / sea baseline and pixels).
  if(this.bgLayers){
   for(const layer of this.bgLayers){
    layer.sprite.setPosition(ATTRACT_W/2,layer.sprite.y);
    layer.sprite.setSize(Math.max(layer.sprite.width,ATTRACT_W+480),layer.sprite.height);
   }
  }
  // The STEP13-7 V2 terrain rasterizer receives a real authored solid (no V0.2 tiles).
  this.hojaV2DeleteStaleTextures();
  // Extend the actual source-V2 solid on exact 16px tile boundaries to cover
  // EVERY camera-visible point of the now longer pursuit and logo scene.
  // No painted filler, duplicated CSS strip, or extension of production files.
  let farthestCameraRight=0;
  for(let t=0;t<=ATTRACT_TOTAL+.001;t+=.05){
   farthestCameraRight=Math.max(farthestCameraRight,this.cameraLeft(t,this.heroAt(t))+ATTRACT_W/this.phaseZoom(t));
  }
  const neededTerrainW=Math.ceil((farthestCameraRight+128)/TILE)*TILE;
  SOLIDS[0].w=Math.max(SOLIDS[0].w,neededTerrainW);
  this.attractTerrainEnd=SOLIDS[0].x+SOLIDS[0].w;
  this.hojaV2DrawSolid(SOLIDS[0],false);
  this.hoja=this.add.sprite(250,HERO_FOOT,'hoja_IDLE_0').setOrigin(.5,61/64).setScale(1,1).setDepth(12).setFlipX(true);
  this.introHappyEye=hojaPickHappyEye();
  attachHojaEyeOverlay(this,()=>this.introEyeMood||null);
  this.hoja.play('hoja-walk');
  // The supplied studio file contains 4 WALK and 6 HI original 64×64 frames.
  // They are already rasterized by registerHojaTextures() using the SAME source
  // palette, resolution and 61/64 bottom anchor as Hoja; no new PNG redraw.
  const mkNahan=(key,group,rate)=>{
   if(!RAW_GROUPS[group]||!RAW_GROUPS[group].length)throw new Error('Missing Nahan source group: '+group);
   if(!this.anims.exists(key))this.anims.create({key,
     frames:RAW_GROUPS[group].map((_,i)=>({key:`hoja_${group}_${i}`})),
     frameRate:rate,repeat:-1});
  };
  mkNahan('nahan-walk','NAHANSANG walk',14);
  mkNahan('nahan-hi','NAHANSANG Hi',8);
  this.nahan=this.add.sprite(-90,HERO_FOOT,'hoja_NAHANSANG walk_0')
    .setOrigin(.5,61/64).setScale(1,1).setDepth(14).setVisible(false);
  this.nahanPose='';
  this.playerBody={x:this.hoja.x}; // only used by the exact source defeat effect
  this.heroAnimName='hoja-walk';
  this.flower=this.add.sprite(FLOWER_X,HERO_FOOT+1,'flower_0').setOrigin(.5,1).setScale(1.3).setDepth(9);
  this.enemies=[
    this.enemy('JUMPY','jumpyIdle',125,'jumpy',false),
    this.enemy('HERMIE','hermieCrawl',70,'hermie',false),
    this.enemy('ROACH','roachRun',15,'roach',false),
    this.enemy('OWL','owlFly',-40,'owl',true),
    // STEP13-7's real 32x32 BLANKEY (4 frames); glides horizontally, never bobs.
    this.enemy('BLANKEY','blankeyFloat',-125,'blankey',true)
  ];
  // Original Kenney Pixel Style 3 texture, NOT custom Phaser geometry/text.
  // 16x16 source art * world scale 2 * integer 2x camera = square 4x4 display pixels.
  this.emoteSprite=this.add.image(0,0,'hoja_kenney_question')
    .setOrigin(.5,1).setScale(2,2).setDepth(90).setVisible(false);
  this.bubbleMood='';
  this.lastRumbleTick=-1;this.lastRumbleBurst=-1;
  // Original gameplay particles only, no synthetic blob overlay.
  // Large ellipse/drawn clouds removed by request. Original dust particles only.
  this.lastSoundTime=this.elapsedMs/1000;this.lastStepSound=-1;this.lastRumbleSound=-1;
  this.sweat=[];
  for(let i=0;i<3;i++)this.sweat.push(this.add.rectangle(0,0,3,5,0x39c5fa,1).setDepth(27).setVisible(false));
  this.overlay=this.add.rectangle(0,0,ATTRACT_W,ATTRACT_H,0x000000,1)
    .setOrigin(0,0).setScrollFactor(0).setDepth(200).setVisible(false);
  this.lastCameraLeft=0;
  this.lastCameraTop=HERO_FOOT-(ATTRACT_H/this.phaseZoom(this.elapsedMs/1000))*GROUNDLINE_FRACTION;
  if(window.HOJA_INTRO_PENDING_PHASE2){
   this.elapsedMs=(BEATS.chase+.12)*1000;
   window.HOJA_INTRO_PENDING_PHASE2=false;
  }
  this.drawAt(this.elapsedMs/1000,0,true);
  window.HOJA_ATTRACT_SCENE=this;
  document.getElementById('status').textContent='Phaser · STEP 13-7 공통 렌더링';
 }
 enemy(type,texture,x,name,air){
  const n=this.textures.get(texture).frameTotal-1;
  const anim='hoja-attract-'+name;
  if(!this.anims.exists(anim)){
   this.anims.create({key:anim,frames:this.anims.generateFrameNumbers(texture,{start:0,end:Math.max(0,n-1)}),
     frameRate: name==='owl'?9:9,repeat:-1});
  }
  const sprite=this.add.sprite(x,HERO_FOOT,texture,0).setOrigin(.5,1).setScale(2).setDepth(11).setVisible(false);
  sprite.play(anim);
  return {type,texture,sprite,x,air,alive:true,initialX:x};
 }
 heroAt(t){
  let x=250,anim='hoja-walk',dy=0;
  if(t<BEATS.stopStart)x=250+47*t;
  else if(t<BEATS.stopEnd){
   // Cubic Hermite slowing: enter at the walking velocity, exit at zero.
   // This removes the abrupt stationary pose visible around 4.5 seconds.
   const u=(t-BEATS.stopStart)/(BEATS.stopEnd-BEATS.stopStart);
   const h00=2*u*u*u-3*u*u+1, h10=u*u*u-2*u*u+u;
   const h01=-2*u*u*u+3*u*u;
   x=h00*(250+47*BEATS.stopStart)+h10*(47*(BEATS.stopEnd-BEATS.stopStart))+h01*452;
  }else if(t<7.05){x=452;anim='hoja-idle';if(t>6.15&&t<6.90)dy=-Math.abs(Math.sin((t-6.15)*7))*6;}
  else if(t<BEATS.flower){x=lerp(452,540,ease((t-7.05)/1.15));anim='hoja-run';}
  else if(t<BEATS.stomp){x=540;anim='hoja-idle';
   if(t>=BEATS.harass)dy=-Math.abs(Math.sin(t*12))*3;}
  else if(t<BEATS.impact){x=540;anim='jump';const u=(t-BEATS.stomp)/(BEATS.impact-BEATS.stomp);dy=-52*Math.sin(Math.PI*u);}
  else if(t<BEATS.heroExit){x=540;anim='sit';}
  else if(t<BEATS.black){x=540+(t-BEATS.heroExit)*290;anim='hoja-run';}
  else {x=980+Math.max(0,t-BEATS.chase)*CHASE_SPEED;anim='hoja-run';}
  return {x,anim,dy};
 }
 cameraLeft(t,p){
  // Blend following -> fixed camera as Hoja coasts to a stop.
  if(t<BEATS.stopStart)return Math.max(0,p.x-235);
  if(t<5.05)return lerp(Math.max(0,250+47*BEATS.stopStart-235),LOCK_CAMERA_LEFT,ease((t-BEATS.stopStart)/1.55));
  if(t<BEATS.chase)return LOCK_CAMERA_LEFT;
  return Math.max(0,p.x-CHASE_CAMERA_LEAD);
 }
 phaseZoom(t){return t<BEATS.chase?PHASE1_ZOOM:PHASE2_ZOOM;}
 updateNahan(t){
  // First entrance: Nahan runs LEFT -> RIGHT, ahead of the monsters.
  // Final entrance: fixed world position; moving chase camera reveals him from
  // the RIGHT, then leaves him behind at the LEFT. He never slides in place.
  const first=t>=BEATS.nahanRush&&t<BEATS.nahanGone;
  const last=t>=BEATS.chase&&t<ATTRACT_TOTAL;
  const worldX=NAHAN_FINAL_WORLD_X;
  const visibleInFinal=last; // camera culls stationary Nahan naturally.
  if(!first&&!visibleInFinal){this.nahan.setVisible(false);return;}
  const pose=first?'nahan-walk':'nahan-hi';
  if(this.nahanPose!==pose){this.nahan.play(pose,true);this.nahanPose=pose;}
  if(first){
   this.nahan.setPosition(-45+(t-BEATS.nahanRush)*455,HERO_FOOT);
   this.nahan.setDepth(14).setFlipX(false);
  }else{
   // Fixed, grounded and facing the viewer; only the CAMERA crosses him.
   this.nahan.setPosition(worldX,HERO_FOOT);
   // Phase 2: strictly below Hoja/enemies but above rendered V2 ground (depth 0).
   this.nahan.setDepth(2).setFlipX(false);
  }
  const left=this.lastCameraLeft, right=left+ATTRACT_W/this.phaseZoom(t);
  this.nahan.setVisible(this.nahan.x>=left-32&&this.nahan.x<=right+32);
 }
 setHeroPose(p,t){
  this.hoja.setPosition(p.x,HERO_FOOT+p.dy).setFlipX(true);
  this.playerBody.x=p.x;
  if(p.anim==='jump'){
   const fr=clamp(Math.floor((t-BEATS.stomp)/(BEATS.impact-BEATS.stomp)*5),0,4);
   this.hoja.stop();this.hoja.setTexture('hoja_JUMP_'+fr);this.heroAnimName='jump';
  }else if(p.anim==='sit'){
   this.hoja.stop();this.hoja.setTexture('hoja_SIT_0');this.heroAnimName='sit';
  }else if(this.heroAnimName!==p.anim){
   this.hoja.play(p.anim,true);this.heroAnimName=p.anim;
  }
 }
 placeEnemies(t,p){
  const chase=t>=BEATS.chase;
  const present=t>=BEATS.monsters && t<BEATS.black;
  const harassment=t>=BEATS.harass&&t<BEATS.stomp;
  const crowd=ease((t-15.85)/.3);
  const approach=ease((t-BEATS.monsters)/2.65);
  const surround=[-68,70,-91,36,66],close=[-35,33,-18,12,38];
  for(let i=0;i<this.enemies.length;i++){
   const e=this.enemies[i],spr=e.sprite;
   if(!present&&!chase){spr.setVisible(false);continue;}
   if(present&&t>=BEATS.impact){
    if(!this.stompTriggered)spr.setVisible(false);
    continue; // copied STEP13-7 defeat tween owns positioning after impact
   }
   if(!e.alive&&!chase){spr.setVisible(false);continue;}
   let x=e.initialX,y=HERO_FOOT;
   if(chase){
    // Owl remains well behind Hoja; BLANKEY glides on a fixed horizontal lane.
    const trail=[40,80,120,160,200][i];
    x=p.x-trail+Math.sin(t*7+i*1.9)*3;
    y=e.type==='BLANKEY'?HERO_FOOT-110:(e.type==='OWL'?HERO_FOOT-95+Math.sin(t*7+i)*18:HERO_FOOT);
   }else{
    // ALL attackers enter behind Nahan, FROM THE LEFT; they then close in
    // around an unsuspecting Hoja and cover his silhouette at depth > 12.
    const target=p.x+lerp(surround[i],close[i],crowd);
    x=lerp(e.initialX,target,approach);
    if(e.type==='BLANKEY'){
     // BLANKEY glides without bobbing; smoothly descends toward Hoja's right flank as the crowd closes.
     y=HERO_FOOT-lerp(108,52,crowd);
    }else if(e.air){
     const altitude=lerp(104,55,crowd);
     y=HERO_FOOT-altitude+Math.sin(t*6.5+i)*7;
    }else if(harassment){
     const u=t-BEATS.harass;
     x+=Math.sin(u*13.5+i*1.85)*5;
     y=HERO_FOOT-Math.abs(Math.sin(u*10+i*1.4))*2;
    }
   }
   // Blue slime JUMPY now hops for its entire moving duration, even during
   // initial approach and the second chase. Ground contact repeats each cycle.
   if(e.type==='JUMPY'){
    const started=chase?BEATS.chase:BEATS.monsters;
    const phase=((t-started)*1.85)%1;
    y=HERO_FOOT-25*Math.max(0,Math.sin(Math.PI*phase));
   }
   spr.setDepth(harassment?17+i:11);
   if(chase){spr.setFlipY(false).setAngle(0).setScale(2).setAlpha(1);}
   spr.setPosition(x,y).setFlipX(p.x<x).setVisible(true);
  }
 }
 triggerStomp(t,p){
  if(this.stompTriggered||t<BEATS.impact||t>=BEATS.impact+.15)return;
  this.stompTriggered=true;
  // These are VERBATIM inherited STEP13-7 methods, not a Canvas imitation.
  this.emitDust(p.x,HERO_FOOT,14,70);
  this.emitBurst(p.x,HERO_FOOT-6,18,0xfff3b0,1.0);
  this.emitShockwave(p.x,HERO_FOOT-2,94);
  this.cameras.main.shake(135,.008);
  for(const e of this.enemies){
   e.alive=false;
   e.sprite.setVisible(true);
   // Keep physical underside/flight coordinate; don't force the owl onto the ground.
   this.playEnemyDefeat(e,'strong');
  }
 }
 updateParallax(camLeft){
  if(!this.bgLayers)return;
  const zoom=this.phaseZoom(this.elapsedMs/1000), bgScreenScale=zoom, bgObjectScale=bgScreenScale/Math.max(.01,zoom);
  const inv=1/this.bgLayerScale;
  for(const layer of this.bgLayers){
   layer.sprite.tilePositionX=(camLeft*layer.xFactor)*inv;
   layer.sprite.setScale(bgObjectScale);
   // Keep clouds high but raise the actual mountain/forest artwork so it
   // appears ABOVE the grass surface. Offsets are in original 288x208 texels.
   // Changing tilePositionY never stretches individual source pixels.
   const verticalSourceOffsets={bgSky:0,bgCloud1:0,bgCloud2:12,bgHills:40,bgForeground:42};
   layer.sprite.tilePositionY=layer.verticalOffset??verticalSourceOffsets[layer.key]??0;
  }
 }
 // Intro-specific emotion cues using only the 5 bundled Kenney image textures.
 // Flower inspection alternates heart / music every 0.7 seconds.
 updateEmotionBubble(t,p){
  let mood='';
  if(t>=6.15&&t<7.08)mood='question';
  else if(t>=BEATS.flower&&t<11.28){
   mood=(Math.floor((t-BEATS.flower)/.7)%2===0)?'heart':'music';
  }
  else if(t>=11.30&&t<13.55)mood='question';
  else if(t>=13.55&&t<15.05)mood='alarm';
  else if(t>=BEATS.harass&&t<18.10)mood='sweat';
  else if(t>=18.10&&t<BEATS.stomp)mood='alarm';
  if(!mood){this.emoteSprite.setVisible(false);this.bubbleMood='';return;}
  if(this.bubbleMood!==mood){
   this.emoteSprite.setTexture('hoja_kenney_'+mood);
   this.bubbleMood=mood;
  }
  // Place the emote just above/right of Hoja's head. Uniform 2x world scale.
  // Source pixel edges stay crisp and characters are not rescaled.
  const bob=Math.round(Math.sin(t*3.2)*1.1);
  this.emoteSprite.setPosition(Math.round(p.x+22),Math.round(HERO_FOOT-82+p.dy+bob))
    .setVisible(true);
 }
 updateHarassDust(t,p){
  if(t<BEATS.harass||t>=BEATS.stomp)return;
  // The actual STEP13-7 particle functions; only the event frequency and
  // placement are scripted for this fast comedic melee.
  // More ORIGINAL STEP13-7 particles, not opaque ellipses or drawn cloud shapes.
  // Each puff is an independent short-lived particle; keep upper bodies legible.
  const tick=Math.floor((t-BEATS.harass)*1000/68);
  if(this.lastRumbleTick!==tick){
   this.lastRumbleTick=tick;
   const sway=Math.sin(t*13)*18;
   this.emitDust(p.x+sway,HERO_FOOT-2,8,43);
   this.emitDust(p.x-25-sway*.5,HERO_FOOT-9,5,25);
   this.emitDust(p.x+20+sway*.4,HERO_FOOT-13,5,23);
  }
  const burst=Math.floor((t-BEATS.harass)*1000/245);
  if(this.lastRumbleBurst!==burst){
   this.lastRumbleBurst=burst;
   this.emitBurst(p.x+Math.sin(t*13)*15,HERO_FOOT-24,4,0xf8edce,.1);
   if(burst%2===0)this.cameras.main.shake(60,.0014);
  }
 }
 updateSceneSfx(t,p){
  const previous=this.lastSoundTime??t;
  this.lastSoundTime=t;
  if(!window.HOJA_INTRO_AUDIO?.enabled)return;
  const cues=[
   [4.60,'land',.21,1.16], [6.22,'collect',.33,1.23],
   [8.25,'collect',.26,1.45], [10.02,'hop',.42,1.15],
   [11.33,'alert',.35,1.15], [13.07,'roach',.35,1.1],
   [13.63,'owlrise',.36,1.05], [15.0,'jumpy',.32,.98],
   [BEATS.stomp,'strongstart',.50,.92], [BEATS.impact,'strong',.72,.94],
   [BEATS.impact+.12,'stomp1',.48,1], [BEATS.heroExit,'hop',.35,1.2],
   [BEATS.chase+.06,'roach',.26,1.2], [BEATS.nahanChaseShow,'collect',.25,1.25],
   [BEATS.logo+.25,'clear',.38,1]
  ];
  // No catch-up noise on a seek/scene restart; only crossing current cues.
  for(const [at,key,vol,rate] of cues){
   if(previous<=at && t>at && t-previous<.22)window.HOJA_INTRO_AUDIO.play(key,vol,rate);
  }
  const stepRun=(t>0&&t<BEATS.stopStart)||(t>=7.05&&t<BEATS.flower)||(t>=BEATS.heroExit&&t<BEATS.black)||(t>=BEATS.chase);
  if(stepRun){
   const tick=Math.floor(t*1000/(t<BEATS.stopStart?285:205));
   if(tick!==this.lastStepSound){this.lastStepSound=tick;
    window.HOJA_INTRO_AUDIO.play(tick%2?'step_grass1':'step_grass2',.13,t<BEATS.stopStart?1:1.25);
   }
  }
  if(t>=BEATS.harass&&t<BEATS.stomp){
   const tick=Math.floor((t-BEATS.harass)*1000/260);
   if(tick!==this.lastRumbleSound){this.lastRumbleSound=tick;
    window.HOJA_INTRO_AUDIO.play(tick%3===0?'bonk':tick%2?'stomp2':'shell1',.38, .88+(tick%3)*.09);
   }
  }
 }
 updateFx(t,p,delta){
  const running=(t>=7.05&&t<BEATS.flower)||(t>=BEATS.heroExit&&t<BEATS.black)||(t>=BEATS.chase);
  if(running){
   const tick=Math.floor(t*1000/105);
   if(tick!==this.lastFootFx){
    this.lastFootFx=tick;
    this.emitDust(p.x-13,HERO_FOOT,2,12);
   }
  }
  this.updateEmotionBubble(t,p);
  this.updateHarassDust(t,p);
  this.updateSceneSfx(t,p);
  for(let i=0;i<this.sweat.length;i++){
   const el=this.sweat[i],visible=t>=BEATS.chase;
   const u=(t*2.2+i/3)%1;
   el.setPosition(p.x+24+i*4,HERO_FOOT-50+u*14).setAlpha(1-u).setVisible(visible);
  }
 }
 drawAt(t,delta,initial=false){
  const p=this.heroAt(t);
  this.setHeroPose(p,t);
  // Flower: react as soon as Hoja stops to look at it (8.2s).
  // Straight eyes begin at the actual Hoja/Nahan crossing, not at rush onset.
  const nahanPass=(BEATS.nahanRush+(540+45)/455); // worldX: -45 + 455*(t-nahanRush) = Hoja x540
  this.introEyeMood=t>=BEATS.flower&&t<nahanPass?this.introHappyEye:
                    t>=nahanPass&&t<13.55?'blank':null;
  const zoom=this.phaseZoom(t),cx=this.cameraLeft(t,p),
        top=HERO_FOOT-(ATTRACT_H/zoom)*GROUNDLINE_FRACTION;
  this.cameras.main.setZoom(zoom);
  this.cameras.main.centerOn(cx+ATTRACT_W/(2*zoom),top+ATTRACT_H/(2*zoom));
  this.lastCameraLeft=cx;this.lastCameraTop=top;
  this.updateParallax(cx);
  this.updateNahan(t);
  // Fail visibly if later scene edits unintentionally introduce stretched art.
  if(Math.abs(this.hoja.scaleX-this.hoja.scaleY)>1e-8||Math.abs(this.nahan.scaleX-this.nahan.scaleY)>1e-8){
   throw new Error('CHARACTER_PIXEL_RATIO_INVALID');
  }
  // Bottom-center origin is planted at the same exact world Y on every frame.
  // A small 3-degree lean is a rooted flower swaying, never floating up/down.
  this.flower.setTexture('flower_'+(Math.floor(t*4)%2))
    .setPosition(FLOWER_X,HERO_FOOT+1).setAngle(Math.sin(t*2.25)*3);
  this.placeEnemies(t,p);
  if(t>=BEATS.impact && t<BEATS.impact+.13)this.triggerStomp(t,p);
  if(t>=BEATS.impact+.72 && !this.stompTriggered && t<BEATS.black)for(const e of this.enemies)e.sprite.setVisible(false);
  this.updateFx(t,p,delta);
  this.overlay.setVisible(false);
  document.getElementById('blackCut').style.opacity=(t>=BEATS.black&&t<BEATS.chase)?'1':'0';
  const logo=document.getElementById('hojaLogo');
  // User click-2 opens phase 2 and displays the sign immediately.
  const shortcutLogo=!!window.HOJA_INTRO_SHORTCUT_LOGO && t>=BEATS.chase;
  const showLogo=t>=BEATS.logo || shortcutLogo;
  const u=shortcutLogo?1:ease((t-BEATS.logo)/1.05);
  logo.style.opacity=showLogo?'1':'0';
  logo.style.transform=`translate(-50%, ${-530*(1-u)+u*25}px)`;
  document.getElementById('elapsed').textContent=t.toFixed(1)+' / '+ATTRACT_TOTAL.toFixed(0)+'초';
  document.getElementById('progress').style.width=(t/ATTRACT_TOTAL*100)+'%';
 }
 update(time,delta){
  if(this.pausedByUser)return;
  this.elapsedMs+=Math.min(60,delta);
  if(this.elapsedMs>=ATTRACT_TOTAL*1000){
   this.elapsedMs=ATTRACT_TOTAL*1000;
   this.pausedByUser=true;
   if(window.HOJA_REPOSITORY)window.HOJA_REPOSITORY.show();
   return;
  }
  this.drawAt(this.elapsedMs/1000,delta);
 }
}
// DOM embedded asset IDs mirror actual <img id=...> registration from Game.html.
const HOJA_ASSET_MAP={
 sgSky:{key:'bgSky'},sgCloud1:{key:'bgCloud1'},sgCloud2:{key:'bgCloud2'},
 sgHills:{key:'bgHills'},sgForeground:{key:'bgForeground'},
 paV2Terrain:{key:'paV2Terrain',sheet:[16,16]},
 enJumpyIdle:{key:'jumpyIdle',sheet:[32,32]},
 enHermieCrawl:{key:'hermieCrawl',sheet:[32,32]},
 enRoachRun:{key:'roachRun',sheet:[32,32]},
 enOwlFly:{key:'owlFly',sheet:[32,32]},
 enBlankeyFloat:{key:'blankeyFloat',sheet:[32,32]},
 enOwlIdle:{key:'owlIdle',sheet:[32,32]},
 flower_0:{key:'flower_0'},flower_1:{key:'flower_1'}
};
let attractGame=null;
async function bootAttract(){
 try{
  if(!window.Phaser)throw new Error('Phaser 엔진 다운로드 실패: 인터넷 연결을 확인하세요.');
  const images=[...document.querySelectorAll('img[data-hoja-asset],img[data-hoja-season-asset]')];
  await Promise.all(images.map(el=>el.decode?.()||Promise.resolve()));
  ATTRACT_W=hojaIntroMeasureWidth();
  attractGame=new Phaser.Game({
   type:Phaser.AUTO,parent:'phaserRoot',width:ATTRACT_W,height:ATTRACT_H,
   backgroundColor:'#51b8ec',pixelArt:true,roundPixels:true,
   render:{antialias:false,antialiasGL:false,roundPixels:true},
   scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:ATTRACT_W,height:ATTRACT_H},
   scene:[HojaAttractScene]
  });
  window.HOJA_ATTRACT_GAME=attractGame;
 }catch(err){
  document.getElementById('status').textContent='인트로 실행 오류';
  document.getElementById('status').style.color='#ffb9ae';
  const notice=document.getElementById('hojaIntroError');
  notice.textContent='호자 인트로 엔진을 불러오지 못했습니다. 인터넷 연결을 확인하고 페이지를 새로고침해 주세요.\n'+err.message;
  notice.style.whiteSpace='pre-line';notice.classList.add('visible');
  console.error(err);
 }
}
window.addEventListener('load',bootAttract);
window.HOJA_ATTRACT_CONTROL={
 restart(){window.HOJA_FLOW?.enterIntro?.();
  window.HOJA_INTRO_CLICKS?.reset();const s=window.HOJA_ATTRACT_SCENE;if(!s)return;
  s.pausedByUser=false;s.anims.resumeAll?.();s.tweens.resumeAll?.();document.getElementById('pauseBtn').textContent='일시정지';s.scene.restart({seek:0});},
 seek(seconds){window.HOJA_FLOW?.enterIntro?.({newRun:false});window.HOJA_INTRO_CLICKS?.reset();
  const s=window.HOJA_ATTRACT_SCENE;if(!s)return;
  s.pausedByUser=false;s.anims.resumeAll?.();s.tweens.resumeAll?.();document.getElementById('pauseBtn').textContent='일시정지';s.scene.restart({seek:Math.max(0,Math.min(ATTRACT_TOTAL-.1,seconds))});},
 togglePause(){const s=window.HOJA_ATTRACT_SCENE;if(!s)return;
  s.pausedByUser=!s.pausedByUser;
  if(s.pausedByUser){s.anims.pauseAll?.();s.tweens.pauseAll?.();}else{s.anims.resumeAll?.();s.tweens.resumeAll?.();}
  document.getElementById('pauseBtn').textContent=s.pausedByUser?'이어보기':'일시정지';}
};

