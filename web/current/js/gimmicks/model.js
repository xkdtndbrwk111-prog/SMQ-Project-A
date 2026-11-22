'use strict';
// Shared, deterministic gimmick model. Coordinates, distances and sizes are
// world pixels; time is elapsed simulation milliseconds. No Phaser or RNG.
window.HOJA_GIMMICK_MODEL=(()=>{
 const types=Object.freeze(['saw','pendulum','fan','flame']);
 function number(v,name,min,max,def){if(v===undefined)v=def;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`기믹 ${name} 범위 오류`);return v;}
 function one(v,name,options,def){if(v===undefined)v=def;if(!options.includes(v))throw Error(`기믹 ${name} 값 오류`);return v;}
 function normalize(raw){
  if(!raw||typeof raw!=='object'||!types.includes(raw.kind))throw Error('지원하지 않는 기믹 종류');
  const c={kind:raw.kind,x:number(raw.x,'x',0,8192),y:number(raw.y,'y',0,8192),w:number(raw.w,'너비',8,1024),h:number(raw.h,'높이',8,1024)};
  if(c.kind==='saw'){c.axis=one(raw.axis,'방향',['x','y'],'x');c.distance=number(raw.distance,'이동 거리',0,2048,96);c.speed=number(raw.speed,'속도',1,600,80);c.radius=number(raw.radius,'반지름',4,128,Math.min(c.w,c.h)/2);c.embedded=raw.embedded===true;}
  if(c.kind==='pendulum'){c.length=number(raw.length,'줄 길이',16,512,96);c.amplitude=number(raw.amplitude,'진폭',0,85,45);c.speed=number(raw.speed,'진동 속도',0.1,12,2);c.radius=number(raw.radius,'반지름',4,128,16);c.phase=number(raw.phase,'시작 위상',0,6.283185307179586,0);}
  if(c.kind==='fan'){c.direction=one(raw.direction,'바람 방향',['left','right','up','down'],'right');c.power=number(raw.power,'바람 세기',0,2000,300);c.period=number(raw.period,'작동 주기',100,60000,4000);c.on=number(raw.on,'작동 시간',0,c.period,c.period);c.phase=number(raw.phase,'시작 위상',0,c.period,0);}
  if(c.kind==='flame'){c.wait=number(raw.wait,'대기 시간',0,60000,1800);c.warn=number(raw.warn,'예고 시간',1,60000,600);c.active=number(raw.active,'분출 시간',1,60000,1200);c.cool=number(raw.cool,'종료 시간',1,60000,400);c.phase=number(raw.phase,'시작 위상',0,c.wait+c.warn+c.active+c.cool,0);}
  return Object.freeze(c);
 }
 function state(c,elapsed){
  const t=number(elapsed,'경과 시간',0,Number.MAX_SAFE_INTEGER,0);
  if(c.kind==='saw'){const p=c.distance?((t*c.speed/1000/c.distance)%2):0,offset=c.distance*(p<=1?p:2-p);return {kind:c.kind,x:c.x+c.w/2+(c.axis==='x'?offset:0),y:c.y+c.h/2+(c.axis==='y'?offset:0),radius:c.radius,angle:(t*c.speed/350)%360};}
  if(c.kind==='pendulum'){const a=Math.sin(t*c.speed/1000+c.phase)*c.amplitude*Math.PI/180;return {kind:c.kind,anchorX:c.x+c.w/2,anchorY:c.y,x:c.x+c.w/2+Math.sin(a)*c.length,y:c.y+Math.cos(a)*c.length,radius:c.radius,angle:a};}
  if(c.kind==='fan')return {kind:c.kind,x:c.x,y:c.y,w:c.w,h:c.h,direction:c.direction,power:c.power,active:(t+c.phase)%c.period<c.on};
  const p=(t+c.phase)%(c.wait+c.warn+c.active+c.cool),phase=p<c.wait?'wait':p<c.wait+c.warn?'warn':p<c.wait+c.warn+c.active?'active':'cool';return {kind:c.kind,x:c.x,y:c.y,w:c.w,h:c.h,phase,active:phase==='active'};
 }
 function rectHit(b,r){return b.right>r.x&&b.left<r.x+r.w&&b.bottom>r.y&&b.top<r.y+r.h;}
 function circleHit(b,c){const x=Math.max(b.left,Math.min(c.x,b.right)),y=Math.max(b.top,Math.min(c.y,b.bottom));return (x-c.x)**2+(y-c.y)**2<c.radius**2;}
 return Object.freeze({types,normalize,state,rectHit,circleHit});
})();
