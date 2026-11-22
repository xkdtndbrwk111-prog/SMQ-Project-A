'use strict';
// Original Pixel Adventure images already bundled for Maker; no generated art.
window.HOJA_CREATE_GIMMICKS=(images)=>{
 const model=window.HOJA_GIMMICK_MODEL;if(!model)throw Error('기믹 모델이 없습니다');
 const assets={saw:['Free/Traps/Saw/On (38x38).png',38,38],ball:['Free/Traps/Spiked Ball/Spiked Ball.png',28,28],chain:['Free/Traps/Spiked Ball/Chain.png',8,8],fanOn:['Free/Traps/Fan/On (24x8).png',24,8],fanOff:['Free/Traps/Fan/Off.png',24,8],fireOn:['Free/Traps/Fire/On (16x32).png',16,32],fireOff:['Free/Traps/Fire/Off.png',16,32]};
 function key(scene,name){const [path,w,h]=assets[name],id='hojaGimmick_'+name;if(!scene.textures.exists(id)){const source=images?.get(path);if(!source)throw Error('Maker 기믹 이미지 누락: '+path);scene.textures.addSpriteSheet(id,source,{frameWidth:w,frameHeight:h});}return id;}
 function make(scene,c){
  const all=[],add=name=>{const o=scene.add.sprite(0,0,key(scene,name),0).setDepth(10);all.push(o);return o;};
  let main,chain=[];
  if(c.kind==='pendulum'){for(let i=0;i<Math.ceil(c.length/8);i++)chain.push(add('chain'));main=add('ball');}
  else main=add(c.kind==='saw'?'saw':c.kind==='fan'?'fanOn':'fireOn');
  return {all,main,chain};
 }
 function paint(scene,e,s,t){
  const c=e.cfg,a=e.art,frame=Math.floor(t/90);
  if(c.kind==='saw'){a.main.setPosition(s.x,s.y).setDisplaySize(s.radius*2,s.radius*2).setFrame(frame%8);return;}
  if(c.kind==='pendulum'){a.chain.forEach((part,i)=>{const f=(i+.5)/a.chain.length;part.setPosition(s.anchorX+(s.x-s.anchorX)*f,s.anchorY+(s.y-s.anchorY)*f);});a.main.setPosition(s.x,s.y).setDisplaySize(s.radius*2,s.radius*2);return;}
  if(c.kind==='fan'){
   const horizontal=s.direction==='left'||s.direction==='right';
   const x=s.direction==='right'?s.x:s.direction==='left'?s.x+s.w:s.x+s.w/2;
   const y=s.direction==='down'?s.y:s.direction==='up'?s.y+s.h:s.y+s.h/2;
   const angle={up:0,right:90,down:180,left:270}[s.direction];
   a.main.setTexture(key(scene,s.active?'fanOn':'fanOff'),s.active?frame%4:0).setPosition(x,y).setAngle(angle).setDisplaySize(horizontal?Math.min(24,s.h):Math.min(24,s.w),8);return;
  }
  a.main.setTexture(key(scene,s.phase==='active'?'fireOn':'fireOff'),s.phase==='active'?frame%3:0).setPosition(s.x+s.w/2,s.y+s.h/2).setDisplaySize(s.w,s.h);
  if(s.phase==='warn')a.main.setAlpha(frame%2?.55:1);else a.main.setAlpha(1);
 }
 function inView(scene,c){const v=scene.cameras?.main?.worldView;if(!v)return true;let left=c.x,top=c.y,right=c.x+c.w,bottom=c.y+c.h;if(c.kind==='saw'){if(c.axis==='x')right+=c.distance;else bottom+=c.distance;left-=c.radius;top-=c.radius;right+=c.radius;bottom+=c.radius;}if(c.kind==='pendulum'){left-=c.length+c.radius;right+=c.length+c.radius;bottom+=c.length+c.radius;}return right>=v.x-128&&left<=v.x+v.width+128&&bottom>=v.y-128&&top<=v.y+v.height+128;}
 function intersectsViewport(scene,s){const v=scene.cameras?.main?.worldView;return !v||(s.x+s.w>v.x&&s.x<v.x+v.width&&s.y+s.h>v.y&&s.y<v.y+v.height);}
 function create(scene,configs){
  if(!Array.isArray(configs))throw Error('기믹 목록 오류');
  const entries=configs.map(raw=>{const cfg=model.normalize(raw),art=make(scene,cfg);return {cfg,art};});let elapsed=0;
  for(const e of entries)paint(scene,e,model.state(e.cfg,0),0);
  return {entries,get elapsed(){return elapsed;},snapshot(){return entries.map(e=>({...model.state(e.cfg,elapsed)}));},
   update(delta){if(!Number.isFinite(delta)||delta<0)throw Error('기믹 시간 오류');if(scene.manualPaused||scene.quizActive||scene.dying||scene.timeUp||scene.clear||scene.transitioning)return;elapsed+=delta;const body=scene.playerBody?.body;if(!body||!body.enable)return;
    for(const e of entries){const s=model.state(e.cfg,elapsed),visible=inView(scene,e.cfg);e.art.all.forEach(o=>o.setVisible(visible));if(visible)paint(scene,e,s,elapsed);
     if(e.cfg.kind==='fan'){if(s.active&&model.rectHit(body,s)){const amount=s.power*Math.min(delta,35)/1000;if(s.direction==='left')body.setVelocityX(body.velocity.x-amount);if(s.direction==='right')body.setVelocityX(body.velocity.x+amount);if(s.direction==='up')body.setVelocityY(body.velocity.y-amount);if(s.direction==='down')body.setVelocityY(body.velocity.y+amount);}}
     else if(e.cfg.kind==='flame'?s.active&&intersectsViewport(scene,s)&&model.rectHit(body,{x:s.x+s.w*.2,y:s.y,w:s.w*.6,h:s.h*.55}):model.circleHit(body,s)){scene.startDeath('enemy');if(scene.dying)return;}
    }
   },destroy(){for(const e of entries)for(const o of e.art.all)o.destroy();}};
 }
 return Object.freeze({create});
};
