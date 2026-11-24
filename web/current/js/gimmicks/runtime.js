'use strict';
// Original Pixel Adventure images already bundled for Maker; no generated art.
window.HOJA_CREATE_GIMMICKS=(images,sfx)=>{
 const model=window.HOJA_GIMMICK_MODEL;if(!model)throw Error('기믹 모델이 없습니다');
 const assets={saw:['Free/Traps/Saw/On (38x38).png',38,38],ball:['Free/Traps/Spiked Ball/Spiked Ball.png',28,28],chain:['Free/Traps/Spiked Ball/Chain.png',8,8],fanOn:['Free/Traps/Fan/On (24x8).png',24,8],fanOff:['Free/Traps/Fan/Off.png',24,8],dust:['Free/Other/Dust Particle.png',16,16],fireOn:['Free/Traps/Fire/On (16x32).png',16,32],fireOff:['Free/Traps/Fire/Off.png',16,32],brick:['Free/Traps/Blocks/Idle.png',22,22]};
 assets.spikeHead=['Free/Traps/Spike Head/Idle.png',54,52];
 assets.spikeHit=['Free/Traps/Spike Head/Bottom Hit (54x52).png',54,52];
 function key(scene,name){const [path,w,h]=assets[name],id='hojaGimmick_'+name;if(!scene.textures.exists(id)){const source=images?.get(path);if(!source)throw Error('Maker 기믹 이미지 누락: '+path);scene.textures.addSpriteSheet(id,source,{frameWidth:w,frameHeight:h});}return id;}
 function make(scene,c){
  const all=[],add=name=>{const o=scene.add.sprite(0,0,key(scene,name),0).setDepth(10);all.push(o);return o;};
  let main,chain=[],particles=[],flameExtension=null,button=null,platform=null,collider=null,blocks=[],blockBodies=[],blockColliders=[];
  if(c.kind==='stepping_blocks'){
   for(let i=0;i<c.count;i++){
    // The original 22px canvas contains a complete 16px block with a 3px
    // transparent border. Preserve the image and use a separate 32px body.
    const art=scene.add.image(c.x+16,c.y+16,key(scene,'brick'),0).setScale(2).setDepth(7);
    const hit=scene.add.rectangle(c.x+16,c.y+16,32,32,0,0);
    scene.physics.add.existing(hit,true);
    blockColliders.push(scene.physics.add.collider(scene.playerBody,hit,null,scene.playerOneWayProcess,scene));
    all.push(art);blocks.push(art);blockBodies.push(hit);
   }
   return {all,blocks,blockBodies,blockColliders};
  }
  if(c.kind==='pendulum'){for(let i=0;i<Math.ceil(c.length/8);i++)chain.push(add('chain'));main=add('ball');}
  else main=add(c.kind==='saw'?'saw':c.kind==='fan'?'fanOn':c.kind==='spike_head'?'spikeHead':'fireOn');
  if(c.kind==='saw'&&c.embedded)main.setCrop(0,0,38,19);
  if(c.kind==='fan')for(let i=0;i<8;i++)particles.push(add('dust'));
  if(c.kind==='flame'){
   if(c.length>1)flameExtension=add('fireOn').setCrop(0,0,16,15);
   button=add('fireOn').setCrop(4,23,8,7);
   platform=scene.add.rectangle(c.x+c.w/2,c.y+c.h*.6,c.w,6,0,0);
   scene.physics.add.existing(platform,true);
   collider=scene.physics.add.collider(scene.playerBody,platform,null,scene.playerOneWayProcess,scene);
  }
  return {all,main,chain,particles,flameExtension,button,platform,collider};
 }
 function paint(scene,e,s,t){
  const c=e.cfg,a=e.art,frame=Math.floor(t/90);
  if(c.kind==='stepping_blocks'){
   s.blocks.forEach((p,i)=>{const art=a.blocks[i],hit=a.blockBodies[i],x=p.x+16,y=p.y+16;art.setDepth(p.moving?8:7);if(art.x!==x||art.y!==y){art.setPosition(x,y);hit.setPosition(x,y);hit.body.updateFromGameObject();}});return;
  }
  if(c.kind==='saw'){a.main.setPosition(s.x,s.y).setDisplaySize(s.radius*2,s.radius*2).setFrame(frame%8);return;}
  if(c.kind==='spike_head'){const shake=s.phase==='warn'?Math.sin((s.warnMs||0)*.065)*3:0;a.main.setTexture(key(scene,s.phase==='landed'?'spikeHit':'spikeHead'),s.phase==='landed'?Math.min(3,Math.floor((s.landedMs||0)/90)):0).setPosition(s.x+s.w/2+shake,s.y+s.h/2).setDisplaySize(s.w,s.h);return;}
  if(c.kind==='pendulum'){a.chain.forEach((part,i)=>{const f=(i+.5)/a.chain.length;part.setPosition(s.anchorX+(s.x-s.anchorX)*f,s.anchorY+(s.y-s.anchorY)*f);});a.main.setPosition(s.x,s.y).setDisplaySize(s.radius*2,s.radius*2);return;}
  if(c.kind==='fan'){
   const horizontal=s.direction==='left'||s.direction==='right';
   const x=s.direction==='right'?s.x:s.direction==='left'?s.x+s.w:s.x+s.w/2;
   const y=s.direction==='down'?s.y:s.direction==='up'?s.y+s.h:s.y+s.h/2;
   const angle={up:0,right:90,down:180,left:270}[s.direction];
   a.main.setTexture(key(scene,s.active?'fanOn':'fanOff'),s.active?Math.floor(t/35)%4:0).setPosition(x,y).setAngle(angle).setDisplaySize(horizontal?s.h:s.w,8);
   a.particles.forEach((p,i)=>{const f=((t/900+i/a.particles.length)%1),q=((i*37)%83+8)/100,along=(s.direction==='left'||s.direction==='up')?1-f:f;
    p.setPosition(horizontal?s.x+s.w*along:s.x+s.w*q,horizontal?s.y+s.h*q:s.y+s.h*along).setDisplaySize(8,8).setAlpha(.65).setVisible(s.active);});return;
  }
  a.main.setTexture(key(scene,s.phase==='active'?'fireOn':'fireOff'),s.phase==='active'?frame%3:0).setPosition(s.x+s.w/2,s.y+s.h/2).setDisplaySize(s.w,s.h);
  a.main.setAlpha(1);
  // Reapply the crop after setTexture: Phaser resets it on frame changes.
  // The original 16x32 image includes a platform below the flame.
  if(a.flameExtension)a.flameExtension.setTexture(key(scene,'fireOn'),frame%3).setCrop(0,0,16,15).setPosition(s.x+s.w/2,s.y+s.h/2).setDisplaySize(s.w,s.h+2*(s.length-1)*s.h*6/32*s.rise).setVisible(s.phase==='active'&&s.rise>0);
  a.button.setPosition(s.x+s.w/2,s.y+s.h/2).setDisplaySize(s.w,s.h).setVisible(s.phase==='warn'&&frame%2===0);
 }
 function inView(scene,c){const v=scene.cameras?.main?.worldView;if(!v)return true;let left=c.x,top=c.y,right=c.x+c.w,bottom=c.y+c.h;if(c.kind==='spike_head')bottom+=c.drop;if(c.kind==='saw'){if(c.axis==='x')right+=c.distance;else bottom+=c.distance;left-=c.radius;top-=c.radius;right+=c.radius;bottom+=c.radius;}if(c.kind==='pendulum'){left-=c.length+c.radius;right+=c.length+c.radius;bottom+=c.length+c.radius;}if(c.kind==='flame')top-=(c.length-1)*c.h*6/32;if(c.kind==='stepping_blocks'){if(c.path){left=Math.min(left,...c.path.map(p=>c.x+p[0]*32));right=Math.max(right,...c.path.map(p=>c.x+p[0]*32+32));top=Math.min(top,...c.path.map(p=>c.y+p[1]*32));bottom=Math.max(bottom,...c.path.map(p=>c.y+p[1]*32+32));}else if(c.direction==='right')right+=(c.steps+c.count)*32;else left-=(c.steps+c.count)*32;}return right>=v.x-128&&left<=v.x+v.width+128&&bottom>=v.y-128&&top<=v.y+v.height+128;}
 function intersectsViewport(scene,s){const v=scene.cameras?.main?.worldView,top=s.y-(s.length-1)*s.h*6/32;return !v||(s.x+s.w>v.x&&s.x<v.x+v.width&&s.y+s.h>v.y&&top<v.y+v.height);}
 // A short gap between neighbouring winds must remain a true no-wind area.
 function inWind(body,s){const x=(body.left+body.right)/2,y=(body.top+body.bottom)/2;return x>=s.x&&x<s.x+s.w&&y>=s.y&&y<s.y+s.h;}
 // Sample the traversed path, including the player's previous physics position,
 // so a delayed frame cannot skip across a moving circular hazard.
 function crossed(body,c,from,to){
  const n=Math.min(256,Math.max(1,Math.ceil((to-from)/12)));
  const w=body.right-body.left,h=body.bottom-body.top,px=Number.isFinite(body.prev?.x)?body.prev.x:body.left,py=Number.isFinite(body.prev?.y)?body.prev.y:body.top;
  for(let i=0;i<=n;i++){const f=i/n,x=px+(body.left-px)*f,y=py+(body.top-py)*f;if(model.circleHit({left:x,right:x+w,top:y,bottom:y+h},model.state(c,from+(to-from)*f)))return true;}
  return false;
 }
 function create(scene,configs){
  if(!Array.isArray(configs))throw Error('기믹 목록 오류');
  const entries=configs.map(raw=>{const cfg=model.normalize(raw),art=make(scene,cfg);return {cfg,art,warnShown:false,warnCycle:null,localElapsed:0,nextSoundAt:0,lastSoundTick:-1,lastFlameSoundCycle:null,started:cfg.kind!=='stepping_blocks'||cfg.activation==='auto',head:cfg.kind==='spike_head'?{y:cfg.y,phase:'idle',landedMs:0}:null};});let elapsed=0;
  for(const e of entries)paint(scene,e,model.state(e.cfg,0),0);
  return {entries,get elapsed(){return elapsed;},snapshot(){return entries.map(e=>e.cfg.kind==='spike_head'?({...model.state(e.cfg,elapsed),...e.head}):e.cfg.kind==='stepping_blocks'?({...model.state(e.cfg,e.localElapsed),started:e.started}):({...model.state(e.cfg,elapsed)}));},
   update(delta){if(!Number.isFinite(delta)||delta<0)throw Error('기믹 시간 오류');if(scene.manualPaused||scene.quizActive||scene.dying||scene.timeUp||scene.clear||scene.transitioning)return;scene.hojaHorizontalWind=0;const before=elapsed;elapsed+=delta;const body=scene.playerBody?.body;if(!body||!body.enable)return;
    for(const e of entries){
     if(e.cfg.kind==='spike_head'){
      const c=e.cfg,h=e.head,old=h.y;let limit=c.y+c.drop;
      for(const group of [scene.solidGroup,scene.oneWayGroup,scene.brickGroup,scene.pipeGroup,scene.movingPlatformGroup,scene.crumbleGroup])for(const obj of group?.getChildren?.()||[]){const b=obj.body;if(b&&b.enable!==false&&b.right>c.x&&b.left<c.x+c.w&&b.top>=c.y+c.h-1)limit=Math.min(limit,b.top-c.h);}
      if(h.phase==='idle'&&body.right>c.x-24&&body.left<c.x+c.w+24&&body.top>=c.y+c.h&&body.top<=c.y+c.h+c.range){h.phase='warn';h.warnMs=0;}
      else if(h.phase==='warn'){h.warnMs+=delta;if(h.warnMs>=500)h.phase='fall';}
      else if(h.phase==='fall'){h.y=Math.min(limit,h.y+c.fallSpeed*delta/1000);if(h.y>=limit){h.phase='landed';h.landedMs=0;}}
      else if(h.phase==='landed'){h.landedMs+=delta;if(h.landedMs>=c.wait)h.phase='return';}
      else if(h.phase==='return'){h.y=Math.max(c.y,h.y-c.returnSpeed*delta/1000);if(h.y<=c.y){h.phase='reload';h.reloadMs=0;}}
      else if(h.phase==='reload'){h.reloadMs+=delta;if(h.reloadMs>=2000)h.phase='idle';}
      const state={...model.state(c,elapsed),...h},visible=inView(scene,c);e.art.all.forEach(o=>o.setVisible(visible));if(visible)paint(scene,e,state,elapsed);
      if(model.rectHit(body,{x:c.x,y:Math.min(old,h.y),w:c.w,h:c.h+Math.abs(h.y-old)})){scene.hojaGimmickHit='spike_head';try{scene.startDeath('enemy');}finally{scene.hojaGimmickHit=null;}if(scene.dying)return;}
      continue;
     }
     if(e.cfg.kind==='stepping_blocks'){
      if(!e.started){const grounded=!!(body.blocked?.down||body.touching?.down);const blocks=model.state(e.cfg,0).blocks;if(grounded&&blocks.some(p=>body.bottom>=p.y-4&&body.bottom<=p.y+4&&body.right>p.x+6&&body.left<p.x+26))e.started=true;}
      if(e.started)e.localElapsed+=delta;
     }
     const s=model.state(e.cfg,e.cfg.kind==='stepping_blocks'?e.localElapsed:elapsed),visible=inView(scene,e.cfg),cycle=e.cfg.kind==='flame'?Math.floor((elapsed+e.cfg.phase)/(e.cfg.wait+e.cfg.warn+e.cfg.active+e.cfg.cool)):null,warned=e.cfg.kind==='flame'&&e.warnCycle===cycle;e.art.all.forEach(o=>o.setVisible(visible));
     if(e.cfg.kind==='flame')e.warnShown=warned;
     if(visible){if(e.cfg.kind==='flame'&&s.active&&!warned){paint(scene,e,{...s,phase:'warn',active:false},elapsed);e.warnShown=true;e.warnCycle=cycle;}else{paint(scene,e,s,elapsed);if(e.cfg.kind==='flame'&&s.phase==='warn'){e.warnShown=true;e.warnCycle=cycle;}}}
     // Short nearby cues only; no wall-clock timers or RNG affect the game.
     const px=(body.left+body.right)/2,py=(body.top+body.bottom)/2;
     const pos=e.cfg.kind==='stepping_blocks'?s.blocks[0]:s;
     const near=visible&&Math.hypot(px-(pos.x+(pos.w||0)/2),py-(pos.y+(pos.h||0)/2))<520;
     if(e.cfg.kind==='flame'){
      if(near&&s.active&&warned&&e.lastFlameSoundCycle!==cycle){sfx?.gimmickFlame?.();e.lastFlameSoundCycle=cycle;}
     }else if(e.cfg.kind==='stepping_blocks'){
      const tick=Math.floor(e.localElapsed/e.cfg.interval);
      if(near&&e.started&&tick!==e.lastSoundTick)sfx?.gimmickBlocks?.();
      e.lastSoundTick=tick;
     }else if(near&&elapsed>=e.nextSoundAt&&(e.cfg.kind!=='fan'||s.active)){
      ({saw:sfx?.gimmickSaw,pendulum:sfx?.gimmickPendulum,fan:sfx?.gimmickFan}[e.cfg.kind])?.();
      e.nextSoundAt=elapsed+1800;
     }
     if(e.cfg.kind==='stepping_blocks')continue;
     if(e.cfg.kind==='fan'){if(s.active&&inWind(body,s)){const grounded=!!(body.blocked?.down||body.touching?.down),amount=s.power*Math.min(delta,100)/1000;const opposingCap=grounded?Math.max(12,252-s.power*.3):Math.max(90,252-s.power*.2);if(s.direction==='left'){if(s.power>0)scene.hojaHorizontalWind=-1;body.setVelocityX(Math.min(body.velocity.x-amount*(grounded?1:.6),opposingCap));}if(s.direction==='right'){if(s.power>0)scene.hojaHorizontalWind=1;body.setVelocityX(Math.max(body.velocity.x+amount*(grounded?1:.6),-opposingCap));}if(s.direction==='up')body.setVelocityY(Math.min(body.velocity.y-amount,-Math.min(150,s.power*.15)));if(s.direction==='down')body.setVelocityY(Math.min(180,Math.max(body.velocity.y+amount,Math.min(150,s.power*.15))));}}
     else if(e.cfg.kind==='flame'?s.active&&warned&&intersectsViewport(scene,s)&&model.rectHit(body,{x:s.x+s.w*.2,y:s.y-(s.length-1)*s.h*6/32*s.rise,w:s.w*.6,h:s.h*.55+(s.length-1)*s.h*6/32*s.rise}):crossed(body,e.cfg,before,elapsed)){scene.hojaGimmickHit=e.cfg.kind;try{scene.startDeath('enemy');}finally{scene.hojaGimmickHit=null;}if(scene.dying)return;}
    }
   },destroy(){for(const e of entries){e.art.collider?.destroy();e.art.platform?.destroy();for(const c of e.art.blockColliders||[])c.destroy();for(const b of e.art.blockBodies||[])b.destroy();for(const o of e.art.all)o.destroy();}}};
 }
 return Object.freeze({create});
};
