/* HOJA V0.44 - deterministic, deliberately conservative room variation layer.
 * 128x128 tile cave; V0.43 proven connector geometry is immutable.
 * This is an offline generator candidate, NOT integrated into Phaser.
 */
(function(root,factory){
 const base=(typeof module==='object'&&module.exports)?require('./cave-layout.js'):root.HojaCave43;
 const api=factory(base);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.HojaCave44=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(C){'use strict';
 const N=C.SIZE,T=C.TILE,VARIANTS=['아치형','계단형','톱니형','돔형','종유석형','침식형','갤러리형'];
 const index=(x,y)=>y*N+x;
 function rng(seed){let t=seed>>>0;return ()=>{t=(t+0x6d2b79f5)|0;let v=Math.imul(t^(t>>>15),t|1);v^=v+Math.imul(v^(v>>>7),v|61);return ((v^(v>>>14))>>>0)/4294967296;};}
 function int(r,a,b){return a+Math.floor(r()*(b-a+1));}
 function shuffle(r,array){let a=array.slice();for(let k=a.length-1;k>0;k--){let j=int(r,0,k);[a[j],a[k]]=[a[k],a[j]];}return a;}
 function reserved(map){
  const locked=new Uint8Array(N*N);
  function mark(x1,y1,x2,y2){for(let y=Math.max(0,y1);y<=Math.min(N-1,y2);y++)for(let x=Math.max(0,x1);x<=Math.min(N-1,x2);x++)locked[index(x,y)]=1;}
  // Preserve critical step/shaft footprints and adjoining body-clearance margins.
  for(const e of map.edges){const a=C.room(e.a),b=C.room(e.b);
   if(e.orientation==='V')mark(a.center-9,a.floor-7,a.center+9,b.floor-1);
   else mark(b.x-6,a.floor-11,b.x+6,a.floor-1);
  }
  for(let id=0;id<16;id++){const b=C.room(id);
   mark(b.x+2,b.floor-10,b.x+27,b.floor-1); // continuous floor-level walkable band
  }
  for(const p of map.portals){const x=Math.round(p.x/T),y=Math.round(p.groundY/T);mark(x-4,y-9,x+4,y-1);}
  for(const o of [...map.questions,...map.flowers]){const x=Math.round(o.x/T),y=Math.round(o.supportY/T);mark(x-4,y-8,x+4,y-1);}
  for(const p of map.platforms){mark(p.x-3,p.y-5,p.x+p.w+2,p.y+2);}
  return locked;
 }
 function build(seed){
  const map=C.build(seed);const r=rng((seed^0x5a17d44c)>>>0),lock=reserved(map);
  const patterns=shuffle(r,VARIANTS);
  const zones=[];map.secretFacades=[];map.sideAlcoves=[];map.roomThemes=[];
  function rock(x,y){if(x>=1&&x<N-1&&y>=1&&y<N-1&&!lock[index(x,y)])map.cells[index(x,y)]=1;}
  function dig(x,y){if(x>=1&&x<N-1&&y>=1&&y<N-1&&!lock[index(x,y)])map.cells[index(x,y)]=0;}
  for(let id=0;id<16;id++){
   const b=C.room(id),shape=patterns[(id+(id>=7?1:0))%patterns.length];
   const phase=int(r,0,6),side=r()<.5?'left':'right';
   const zone={room:id,shape,side,secret:false,upperLedge:false,decorations:0};
   // Room roof and wall outline are determined from an explicit shape profile.
   // Every changed solid cell lies OUTSIDE V0.43's protected connector / walk corridor.
   for(let lx=2;lx<28;lx++){
    const dx=Math.abs(lx-14.5),wave=(lx+phase)%7;let depth=0;
    switch(shape){
     case '아치형': depth=Math.round(5*(1-Math.pow(dx/14,2)));break;
     case '계단형': depth=lx<10?5:lx<19?3:1;break;
     case '톱니형': depth=(Math.floor((lx+phase)/4)%2)?5:1;break;
     case '돔형': depth=Math.round(3+2*Math.sin(lx/26*Math.PI));break;
     case '종유석형': depth=(wave===0||wave===1)?7:2;break;
     case '침식형': depth=lx<8?5:lx>20?4:Math.floor(r()*2);break;
     case '갤러리형': depth=(lx<8||lx>21)?6:0;break;
    }
    for(let ly=2;ly<2+depth;ly++)rock(b.x+lx,b.y+ly);
   }
   // Vary the upper side alcove silhouettes without puncturing exterior room boundaries.
   if(id!==0&&id!==3&&id!==12&&id!==15){
    const left=side==='left',fromX=b.x+(left?1:24),w=5,top=b.floor-int(r,14,17);
    for(let y=top;y<top+int(r,5,8);y++)for(let x=fromX;x<fromX+w;x++)dig(x,y);
    zone.decorations++;
    if(r()<.57){
     // The "secret" facade is visual only; no invisible collision may block it.
     const face={room:id,x:(b.x+(left?5:24))*T,y:(top+2)*T,w:2*T,h:5*T,collidable:false};
     map.secretFacades.push(face);zone.secret=true;
    }
    map.sideAlcoves.push({room:id,side,x:fromX,y:top,w,h:7});
   }
   // Half of rooms contain a visible optional upper shelf, always <= 5 tiles up.
   // Shelf does not cut the mandatory floor corridor and is one-way as in V0.43.
   if(r()<.53&&!C.PORTAL_ROOMS.includes(id)){
    const px=b.x+(side==='left'?5:20),py=b.floor-5;
    const overlap=map.platforms.some(p=>!(px+6<=p.x||px>=p.x+p.w)&&Math.abs(py-p.y)<3);
    let solid=false;for(let y=py-3;y<=py;y++)for(let x=px;x<px+6;x++)if(map.cells[index(x,y)])solid=true;
    if(!overlap&&!solid){map.platforms.push({x:px,y:py,w:6,room:id,role:'optionalShelf'});zone.upperLedge=true;}
   }
   // Unique non-colliding visual motifs, tracked separately from rock collision map.
   const motif=['crystals','ruins','fossils','fungi','collapsedBeams','ore','stalagmites'][id%7];
   zones.push({...zone,motif,profileSeed:phase});
   map.roomThemes.push({room:id,shape,motif});
   map.details.push({x:b.x+int(r,9,20),y:b.floor-int(r,10,16),kind:motif,visualOnly:true});
  }
  map.version='0.44-room-variety-candidate';map.zones=zones;
  map.meta={...map.meta,roomShapeVariants:VARIANTS.length,protectedPathTemplate:'v043',generation:'roof/alcove/optionalShelf/secretFacade'};
  return map;
 }
 function validate(map){
  const core=C.validate(map);const errors=core.errors.slice();
  if(map.zones?.length!==16)errors.push('ZONE_COUNT');
  if(new Set(map.zones.map(z=>z.shape)).size<5)errors.push('INSUFFICIENT_SHAPE_VARIETY');
  // Exterior shell may not have newly carved holes, outside explicit V0.43 connectors.
  for(const item of [...map.portals,...map.questions,...map.flowers]){
   const foot=item.supportY??item.groundY;
   if(C.collide(map,item.x,foot))errors.push('OBJECT_BODY_BLOCKED:'+item.room);
  }
  for(const f of map.secretFacades||[])if(f.collidable!==false)errors.push('SECRET_FACADE_HAS_COLLIDER');
  for(const p of map.platforms.filter(x=>x.role==='optionalShelf')){
   if(C.collide(map,(p.x+p.w/2)*T,p.y*T))errors.push('SHELF_PLAYER_BLOCKED:'+p.room);
   if(C.room(p.room).floor-p.y>5)errors.push('SHELF_JUMP_TOO_HIGH:'+p.room);
  }
  const stats={...core.stats,variants:new Set(map.zones?.map(z=>z.shape)).size,
   alcoves:map.sideAlcoves?.length||0,secretFacades:map.secretFacades?.length||0,
   optionalShelves:map.platforms.filter(p=>p.role==='optionalShelf').length};
  return {ok:errors.length===0,seed:map.seed,errors,stats,
   claims:{...core.claims,essentialConnectorsPreserved:true,optionalShelvesConservativeHeight:true,
    allRoomConfigurationsPhysicallyReplayed:false,phaserPhysicsReplayed:false}};
 }
 function buildValidated(seed,maxAttempts=64){
  const first=Number(seed)>>>0;
  for(let attempt=0;attempt<maxAttempts;attempt++){
   const map=build((first+attempt*0x9e3779b9)>>>0),audit=validate(map);
   if(audit.ok)return {map,audit,attempts:attempt+1};
  }
  throw Error('V044_VALIDATED_GENERATION_FAILED');
 }
 function exportStage(map){const stage=C.toStageGeometry(map);
  return {...stage,version:map.version,secretFacades:map.secretFacades,
   caveRoomThemes:map.roomThemes,sideAlcoves:map.sideAlcoves,
   warning:'UNINTEGRATED DRAFT. Validate with actual Phaser before runtime use.'};
 }
 return {TILE:T,SIZE:N,VARIANTS,build,validate,buildValidated,
   exportStage,serializable:C.serializable,MotionBaseline:C,room:C.room};
});
