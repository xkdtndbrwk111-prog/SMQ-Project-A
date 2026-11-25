'use strict';
// Shared, deterministic gimmick model. Coordinates, distances and sizes are
// world pixels; time is elapsed simulation milliseconds. No Phaser or RNG.
window.HOJA_GIMMICK_MODEL=(()=>{
 const types=Object.freeze(['saw','pendulum','fan','flame','stepping_blocks','spike_head']);
 function number(v,name,min,max,def){if(v===undefined)v=def;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`기믹 ${name} 범위 오류`);return v;}
 function one(v,name,options,def){if(v===undefined)v=def;if(!options.includes(v))throw Error(`기믹 ${name} 값 오류`);return v;}
 function normalize(raw){
  if(!raw||typeof raw!=='object'||!types.includes(raw.kind))throw Error('지원하지 않는 기믹 종류');
  const c={kind:raw.kind,x:number(raw.x,'x',0,8192),y:number(raw.y,'y',0,8192),w:number(raw.w,'너비',8,1024),h:number(raw.h,'높이',8,1024)};
  if(c.kind==='saw'){c.axis=one(raw.axis,'방향',['x','y'],'x');c.distance=number(raw.distance,'이동 거리',0,2048,96);c.speed=number(raw.speed,'속도',1,600,80);c.radius=number(raw.radius,'반지름',4,128,Math.min(c.w,c.h)/2);c.embedded=raw.embedded===true;}
  if(c.kind==='pendulum'){c.length=number(raw.length,'줄 길이',16,512,96);c.amplitude=number(raw.amplitude,'진폭',0,85,45);c.speed=number(raw.speed,'진동 속도',0.1,12,2);c.radius=number(raw.radius,'반지름',4,128,16);c.phase=number(raw.phase,'시작 위상',0,6.283185307179586,0);}
  if(c.kind==='fan'){c.direction=one(raw.direction,'바람 방향',['left','right','up','down'],'right');c.power=number(raw.power,'바람 세기',0,2000,300);c.period=number(raw.period,'작동 주기',100,60000,4000);c.on=number(raw.on,'작동 시간',0,c.period,c.period);c.phase=number(raw.phase,'시작 위상',0,c.period,0);}
  if(c.kind==='flame'){if(raw.activation!==undefined)c.activation=one(raw.activation,'작동 방식',['timer','on_step'],'timer');c.length=number(raw.length,'불꽃 길이',1,6,1);if(!Number.isInteger(c.length))throw Error('기믹 불꽃 길이 오류');c.wait=number(raw.wait,'대기 시간',0,60000,1800);c.warn=number(raw.warn,'예고 시간',1,60000,600);c.active=number(raw.active,'분출 시간',1,60000,1200);c.cool=number(raw.cool,'종료 시간',1,60000,400);c.phase=number(raw.phase,'시작 위상',0,c.wait+c.warn+c.active+c.cool,0);}
  if(c.kind==='spike_head'){c.range=number(raw.range,'감지 거리',16,2048,400);c.drop=number(raw.drop,'최대 낙하 거리',16,8192,4096);c.fallSpeed=number(raw.fallSpeed,'낙하 속도',1,1200,600);c.returnSpeed=number(raw.returnSpeed,'복귀 속도',1,600,100);c.wait=number(raw.wait,'충돌 후 대기',0,10000,700);}
  if(c.kind==='stepping_blocks'){
   c.direction=one(raw.direction,'이동 방향',['left','right'],'right');c.activation=one(raw.activation,'출발 방식',['auto','on_step'],'auto');
   c.count=number(raw.count,'벽돌 수',2,20,5);if(!Number.isInteger(c.count))throw Error('기믹 벽돌 수 오류');
   c.interval=number(raw.interval,'블록 이동 간격',200,5000,800);
   if(raw.path!==undefined){
    if(!Array.isArray(raw.path)||raw.path.length<c.count+1||raw.path.length>c.count+60)throw Error('기믹 경로 길이 오류');
    c.path=Object.freeze(raw.path.map((p,i)=>{if(!Array.isArray(p)||p.length!==2||!p.every(Number.isInteger)||p.some(v=>Math.abs(v)>128)||(i===0&&(p[0]!==0||p[1]!==0)))throw Error('기믹 경로 좌표 오류');if(i&&Math.abs(p[0]-raw.path[i-1][0])+Math.abs(p[1]-raw.path[i-1][1])!==1)throw Error('기믹 경로 연결 오류');if(c.x+p[0]*32<0||c.y+p[1]*32<0||c.x+p[0]*32>8192||c.y+p[1]*32>8192)throw Error('기믹 경로 범위 오류');return Object.freeze([...p]);}));
    if(new Set(c.path.map(p=>p.join(','))).size!==c.path.length)throw Error('기믹 경로 중복 오류');c.steps=c.path.length-c.count;
   }else{c.steps=number(raw.steps,'순찰 칸 수',1,60,15);if(!Number.isInteger(c.steps))throw Error('기믹 순찰 칸 수 오류');}
  }
  return Object.freeze(c);
 }
 function state(c,elapsed){
  const t=number(elapsed,'경과 시간',0,Number.MAX_SAFE_INTEGER,0);
  if(c.kind==='spike_head')return {kind:c.kind,x:c.x,y:c.y,w:c.w,h:c.h,phase:'idle'};
  if(c.kind==='saw'){const p=c.distance?((t*c.speed/1000/c.distance)%2):0,offset=c.distance*(p<=1?p:2-p);return {kind:c.kind,x:c.x+c.w/2+(c.axis==='x'?offset:0),y:c.y+c.h/2+(c.axis==='y'?offset:0),radius:c.radius,angle:(t*c.speed/350)%360};}
  if(c.kind==='pendulum'){const a=Math.sin(t*c.speed/1000+c.phase)*c.amplitude*Math.PI/180;return {kind:c.kind,anchorX:c.x+c.w/2,anchorY:c.y,x:c.x+c.w/2+Math.sin(a)*c.length,y:c.y+Math.cos(a)*c.length,radius:c.radius,angle:a};}
  if(c.kind==='fan')return {kind:c.kind,x:c.x,y:c.y,w:c.w,h:c.h,direction:c.direction,power:c.power,active:(t+c.phase)%c.period<c.on};
  if(c.kind==='stepping_blocks'){
   const tick=Math.floor(t/c.interval),cycle=2*c.steps,position=n=>{const p=n%cycle;return p<=c.steps?p:cycle-p;};
   const offset=position(tick),next=position(tick+1),progress=(t%c.interval)/c.interval,sign=c.direction==='right'?1:-1;
   const index=(i,k)=>k+((i-k)%c.count+c.count)%c.count;
   const point=n=>c.path?{x:c.x+c.path[n][0]*32,y:c.y+c.path[n][1]*32}:{x:c.x+sign*n*32,y:c.y};
   return {kind:c.kind,offset,progress,x:c.x,y:c.y,blocks:Array.from({length:c.count},(_,i)=>{const from=index(i,offset),to=index(i,next),distance=Math.abs(to-from),walk=progress*distance,part=Math.min(Math.floor(walk),Math.max(0,distance-1)),fraction=distance?walk-part:0,dir=Math.sign(to-from),a=point(from+part*dir),b=point(from+(part+(distance?1:0))*dir);return {id:i,x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,moving:distance>0};})};
  }
  const p=(t+c.phase)%(c.wait+c.warn+c.active+c.cool),phase=p<c.wait?'wait':p<c.wait+c.warn?'warn':p<c.wait+c.warn+c.active?'active':'cool';return {kind:c.kind,x:c.x,y:c.y,w:c.w,h:c.h,length:c.length,rise:phase!=='active'?0:(p-c.wait-c.warn)<220?0:(p-c.wait-c.warn)<440?.5:(p-c.wait-c.warn)<2440?1:(p-c.wait-c.warn)<2660?.5:0,phase,active:phase==='active'};
 }
 function rectHit(b,r){return b.right>r.x&&b.left<r.x+r.w&&b.bottom>r.y&&b.top<r.y+r.h;}
 function circleHit(b,c){const x=Math.max(b.left,Math.min(c.x,b.right)),y=Math.max(b.top,Math.min(c.y,b.bottom));return (x-c.x)**2+(y-c.y)**2<c.radius**2;}
 return Object.freeze({types,normalize,state,rectHit,circleHit});
})();
