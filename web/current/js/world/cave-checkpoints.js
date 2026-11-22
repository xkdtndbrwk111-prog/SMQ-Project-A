'use strict';
// Placement is computed from collision geometry without touching map generation
// or consuming gameplay randomness. Visibility/physics remain scene-owned.
window.HOJA_CAVE_CHECKPOINTS=(()=>{
 const TILE=16,SIDE=128,MIN=34*TILE,MAX=94*TILE;
 const hit=(a,b)=>a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t;
 function reachable(solids,anchor){
  const n=SIDE, cells=new Uint8Array(n*n);
  for(const s of solids){if(s.kind!=='ground')continue;
   const x0=Math.max(0,Math.floor(s.x/TILE)),x1=Math.min(n,Math.ceil((s.x+s.w)/TILE));
   const y0=Math.max(0,Math.floor(s.y/TILE)),y1=Math.min(n,Math.ceil((s.y+s.h)/TILE));
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)cells[y*n+x]=1;
  }
  const free=new Uint8Array(n*n);
  for(let y=3;y<n;y++)for(let x=2;x<n-2;x++){
   const cx=x*TILE+8,foot=y*TILE;
   const l=Math.floor((cx-18)/TILE),r=Math.floor((cx+17)/TILE),t=Math.floor((foot-42)/TILE),b=Math.floor((foot-1)/TILE);
   let clear=true;for(let yy=t;yy<=b&&clear;yy++)for(let xx=l;xx<=r;xx++)if(cells[yy*n+xx]){clear=false;break;}
   if(clear)free[y*n+x]=1;
  }
  const ax=Math.floor(anchor.x/TILE),ay=Math.round(anchor.groundY/TILE);let start=-1;
  for(let rad=0;rad<=5&&start<0;rad++)for(let dy=-rad;dy<=rad&&start<0;dy++)for(let dx=-rad;dx<=rad;dx++){
   const x=ax+dx,y=ay+dy;if(x>=0&&x<n&&y>=0&&y<n&&free[y*n+x]){start=y*n+x;break;}
  }
  const seen=new Uint8Array(n*n);if(start<0)return seen;
  const queue=new Int32Array(n*n);let head=0,tail=0;queue[tail++]=start;seen[start]=1;
  while(head<tail){const p=queue[head++],x=p%n,y=(p/n)|0;for(const q of [p-1,p+1,p-n,p+n]){
   if(q<0||q>=n*n||!free[q]||seen[q])continue;
   if(Math.abs(q%n-x)+Math.abs((q/n|0)-y)!==1)continue;seen[q]=1;queue[tail++]=q;
  }}
  return seen;
 }
 function candidatesFor({solids,portals,offsets,flowers=[],enemies=[],moving=[],crumbles=[],springs=[],secrets=[]},reserveScale=1,machineScale=2){
  if(!solids?.length||portals?.length!==4||offsets?.length!==4)throw Error('CAVE_CHECKPOINT_INPUT');
  const seen=reachable(solids,{x:portals[0].x+offsets[0],groundY:portals[0].groundY});
  const physical=solids.map(o=>({l:o.x,r:o.x+o.w,t:o.y,b:o.y+o.h}));
  const special=[...crumbles.map(o=>({l:o.x,r:o.x+o.w,t:o.y,b:o.y+(o.h||16)})),
   ...moving.map(o=>({l:o.axis==='x'?o.min:o.x,r:o.axis==='x'?o.max:o.x+o.w,t:o.axis==='y'?o.min:o.y,b:o.axis==='y'?o.max+(o.h||16):o.y+(o.h||16)})),
   ...springs.map(o=>({l:o.x-16,r:o.x+48,t:o.y-80,b:o.y+16})),
   ...secrets.map(o=>({l:o.x*TILE,r:(o.x+o.w)*TILE,t:o.y*TILE,b:(o.y+o.h)*TILE}))];
  const reserved=[...portals.map(p=>({x:p.x,y:p.groundY,rx:128,ry:128})),
   ...flowers.map(p=>({x:p.x,y:p.y,rx:80,ry:128})),
   ...enemies.map(p=>({x:p.x,y:p.y,rx:p.type==='BALLOONEY'?96:80,ry:128}))];
  const candidates=[],lines=new Map();
  for(const s of solids){if((s.kind!=='ground'&&s.kind!=='platform')||s.y<MIN||s.y>MAX)continue;
   const key=s.kind+':'+s.y;if(!lines.has(key))lines.set(key,{y:s.y,kind:s.kind,parts:[]});
   lines.get(key).parts.push([s.x,s.x+s.w]);
  }
  for(const line of lines.values()){
   line.parts.sort((a,b)=>a[0]-b[0]);
   for(let x=MIN+48;x<=MAX-48;x+=TILE){
    const y=line.y,half=16*machineScale+2,box={l:x-half,r:x+half,t:y-(32*machineScale+6),b:y};let edge=box.l;
    for(const [left,right] of line.parts){if(left>edge)break;if(right>edge)edge=right;if(edge>=box.r)break;}
    if(edge<box.r)continue;
    if(physical.some(r=>hit(box,r))||special.some(r=>hit(box,r)))continue;
    if(reserved.some(o=>Math.abs(o.x-x)<o.rx*reserveScale&&Math.abs(o.y-y)<o.ry*reserveScale))continue;
    const tx=Math.floor(x/TILE),ty=Math.round(y/TILE);
    if(!seen[ty*SIDE+tx])continue;
    const col=Math.floor((x/TILE-4)/30),row=Math.floor((y/TILE-1-4)/30);
    if((col!==1&&col!==2)||(row!==1&&row!==2))continue;
    candidates.push({x,groundY:y,room:row*4+col,support:line.kind,scale:machineScale});
   }
  }
  candidates.sort((a,b)=>(a.support==='ground'?0:1)-(b.support==='ground'?0:1)||((a.x-1024)**2+(a.groundY-1024)**2)-((b.x-1024)**2+(b.groundY-1024)**2)||a.groundY-b.groundY||a.x-b.x);
  return candidates;
 }
 function choosePair(options){
  const strict=candidatesFor(options);let first=strict.find(c=>c.room===5),second=strict.find(c=>c.room===10);
  if(!first||!second){const relaxed=candidatesFor(options,.65);first=first||relaxed.find(c=>c.room===5);second=second||relaxed.find(c=>c.room===10);}
  if(!first||!second){const compact=candidatesFor(options,.65,1.5);first=first||compact.find(c=>c.room===5);second=second||compact.find(c=>c.room===10);}
  if(!first||!second)throw Error('CAVE_CHECKPOINT_NO_SAFE_GROUND_IN_CENTRAL_ROOMS');
  return [first,second];
 }
 function nearby(x,feet,point,radiusX=90,radiusY=40){return Math.abs(x-point.x)<=radiusX&&Math.abs(feet-point.groundY)<=radiusY;}
 return Object.freeze({choosePair,nearby});
})();
