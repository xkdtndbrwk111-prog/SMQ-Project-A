/* HOJA V0.42 independent procedural cave generator / validation lab.
 * Source of Truth: V0.41 P_CFG (jumpHeight 140px; body 36x42px; tile 16px).
 * NOT a Phaser physics simulator, NOT integrated with game.
 * Public-domain style original algorithm; generated output uses user-provided assets only when imported later.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HojaCave43 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';
const TILE=16, SIZE=128, ROWS=4, COLS=4, ROOM=30, OFFSET=4;
const BODY={width:36,height:42}, JUMP_HEIGHT=140, CERT_STEP_TILES=5;
const MARK={AIR:0,ROCK:1};
const PORTAL_ROOMS=[0,3,12,15];
function rng(seed){ let t=seed>>>0;return ()=>{t=(t+0x6d2b79f5)|0;let v=Math.imul(t^(t>>>15),t|1);v^=v+Math.imul(v^(v>>>7),v|61);return ((v^(v>>>14))>>>0)/4294967296;}; }
function int(r,a,b){return a+Math.floor(r()*(b-a+1));}
function shuffled(r,a){const out=a.slice();for(let i=out.length-1;i>0;i--){const j=int(r,0,i);[out[i],out[j]]=[out[j],out[i]];}return out;}
function xy(id){return {row:Math.floor(id/COLS),col:id%COLS};}
function room(id){const p=xy(id);const x=OFFSET+p.col*ROOM,y=OFFSET+p.row*ROOM;return {id,...p,x,y,floor:y+27,center:x+15};}
function buildEdges(){const e=[];for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const a=r*COLS+c;if(c<COLS-1)e.push({a,b:a+1,orientation:'H'});if(r<ROWS-1)e.push({a,b:a+COLS,orientation:'V'});}return e;}
const ALL_EDGES=buildEdges();
function makeGraph(r){
  // Randomized spanning tree ensures all sixteen rooms are reached.
  const group=Array.from({length:ROWS*COLS},(_,i)=>i);
  function find(i){while(group[i]!==i){group[i]=group[group[i]];i=group[i];}return i;}
  const selected=[];
  for(const e of shuffled(r,ALL_EDGES)){
    const a=find(e.a),b=find(e.b);
    if(a!==b){group[a]=b;selected.push({...e,secret:false,core:true});}
  }
  const inTree=new Set(selected.map(e=>e.a+':'+e.b));
  // Up to 4 loops; selected passages may be masked behind a passable facade.
  const remain=shuffled(r,ALL_EDGES.filter(e=>!inTree.has(e.a+':'+e.b)));
  const extras=int(r,2,4);
  for(let k=0;k<extras;k++)selected.push({...remain[k],secret:k===0||((k===1)&&r()<.5),core:false});
  // Make 1-2 LEAF passages of the spanning tree secret (true optional discovery).
  const degree=new Int16Array(ROWS*COLS);
  for(const e of selected.filter(e=>e.core)){degree[e.a]++;degree[e.b]++;}
  const leaves=shuffled(r,selected.filter(e=>e.core &&
    ((degree[e.a]===1&&!PORTAL_ROOMS.includes(e.a))||(degree[e.b]===1&&!PORTAL_ROOMS.includes(e.b)))));
  if(leaves.length)leaves[0].secret=true;
  return selected.map(e=>({...e,forward:true,backward:true}));
}
function build(seed){
  seed=(Number(seed)>>>0);
  const r=rng(seed),grid=new Uint8Array(SIZE*SIZE).fill(MARK.ROCK);
  const platforms=[], doors=[], details=[], misc=[],edges=makeGraph(r);
  const index=(x,y)=>y*SIZE+x;
  function carve(x,y,w,h){for(let j=Math.max(0,y);j<Math.min(SIZE,y+h);j++)for(let i=Math.max(0,x);i<Math.min(SIZE,x+w);i++)grid[index(i,j)]=MARK.AIR;}
  // Carve generously proportioned rooms, retaining a continuous solid floor.
  for(let id=0;id<ROWS*COLS;id++){
    const b=room(id);
    carve(b.x+2,b.y+2,26,25);
    // Non-collidable decals do not affect a certified path.
    for(let k=0;k<int(r,2,7);k++)details.push({x:b.x+int(r,3,26),y:b.y+int(r,4,22),kind:['ore','beam','crack'][int(r,0,2)]});
    if(!PORTAL_ROOMS.includes(id)&&r()<.65){
      // Optional one-way ledge, only 4 tiles above the regular room floor.
      const side=r()<.5?4:21;
      platforms.push({x:b.x+side,y:b.floor-4,w:6,room:id,role:'ledge'});
    }
  }
  for(const edge of edges){
    const a=room(edge.a), b=room(edge.b);
    if(edge.orientation==='H'){
      const boundary=b.x, y=a.floor;
      carve(boundary-3,y-7,6,7);
      doors.push({x:boundary,y:y-3,edge:edge.a+':'+edge.b,orientation:'H',secret:edge.secret});
    }else{
      const x=a.center, topFloor=a.floor, bottomFloor=b.floor;
      // Fourteen tiles wide: an ordinary running/standing jump can cross
      // the opening; six reversible five-tile-height landings connect levels.
      const lx=x-7;
      carve(lx,topFloor-3,14,bottomFloor-topFloor+3);
      let prevX=0;
      for(let k=0;k<=5;k++){
        const sy=bottomFloor-(k+1)*CERT_STEP_TILES;
        const sx=lx+(k%2?7:2);
        platforms.push({x:sx,y:sy,w:5,room:edge.b,role:'stair',edge:edge.a+':'+edge.b,step:k});
        prevX=sx;
      }
      doors.push({x,y:(topFloor+bottomFloor)/2,edge:edge.a+':'+edge.b,orientation:'V',secret:edge.secret});
    }
  }
  // The 4 portals live in corner rooms. Put portals well away from stairs.
  const portals=PORTAL_ROOMS.map((id,i)=>{
    const b=room(id); const x=b.x+(i%2===0?7:23),groundY=b.floor;
    return {id:i,room:id,target:i,x:x*TILE,groundY:groundY*TILE};
  });
  // Safety placement: reserve right/left regions with a guaranteed solid floor.
  const slots=[];
  for(let id=0;id<16;id++){
    const b=room(id);
    for(const dx of [7,23]){
      const x=(b.x+dx)*TILE,y=(b.floor-2)*TILE;
      if(portals.some(p=>Math.hypot(p.x-x,p.groundY-y)<6*TILE))continue;
      slots.push({x,y,room:id,supportY:b.floor*TILE});
    }
  }
  const claimed=[],pick=(kind,n)=>{
    const chosen=[];
    const candidates=shuffled(r,slots).filter(p=>!claimed.some(c=>Math.hypot(c.x-p.x,c.y-p.y)<8*TILE));
    // Spread rewards across rooms and aim for exploration beyond start.
    for(const p of candidates){
      if(chosen.length===n)break;
      if(chosen.some(c=>c.room===p.room))continue;
      if(claimed.some(c=>Math.hypot(c.x-p.x,c.y-p.y)<8*TILE))continue;
      chosen.push({...p,kind});
    }
    if(chosen.length!==n)throw Error('ITEM_PLACEMENT_CAPACITY');
    claimed.push(...chosen);return chosen;
  };
  const questions=pick('question',5), flowers=pick('flower',3);
  const lanterns=shuffled(r,Array.from({length:16},(_,i)=>i))
    .filter(id=>!PORTAL_ROOMS.includes(id)).slice(0,7).map(id=>{const b=room(id);return {x:(b.x+25)*TILE,y:(b.floor-2)*TILE,room:id};});
  // Default spawn is top-left portal, other portals must be reversible.
  const map={version:'0.43-safe-connector-candidate',seed,width:SIZE,height:SIZE,tile:TILE,rows:ROWS,cols:COLS,
    cells:grid,edges,platforms,portals,questions,flowers,lanterns,doors,details,
    player:{...BODY,jumpHeight:JUMP_HEIGHT},meta:{randomRooms:16,hasRequiredSpecialMoves:false}};
  return map;
}
function collide(map,x,yFoot){
  // Player is centered on x with feet at yFoot. Probe inner body rectangle
  // with a 1px epsilon, so standing on the floor isn't a collision.
  const L=(x-BODY.width/2+1)/TILE,R=(x+BODY.width/2-1)/TILE;
  const T=(yFoot-BODY.height+1)/TILE,B=(yFoot-1)/TILE;
  for(let ty=Math.floor(T);ty<=Math.floor(B);ty++)for(let tx=Math.floor(L);tx<=Math.floor(R);tx++){
    if(tx<0||tx>=SIZE||ty<0||ty>=SIZE||map.cells[ty*SIZE+tx])return true;
  }
  return false;
}
function nodeGraph(map){
  const g=Array.from({length:16},()=>[]);
  for(const e of map.edges){if(e.forward!==false)g[e.a].push(e.b);if(e.backward!==false)g[e.b].push(e.a);}
  return g;
}
function reachable(g,s){const seen=new Set([s]),q=[s];let h=0;while(h<q.length){const a=q[h++];for(const b of g[a])if(!seen.has(b)){seen.add(b);q.push(b);}}return seen;}
function certOpening(map,e){
  const a=room(e.a),b=room(e.b);
  if(e.orientation==='H'){
    const y=a.floor;
    if(y!==b.floor)return false;
    for(let x=b.x-2;x<=b.x+2;x++){
      if(collide(map,(x+.5)*TILE,y*TILE))return false;
      if(map.cells[y*SIZE+x]!==MARK.ROCK)return false;
    }
    return true;
  }
  const pads=map.platforms.filter(p=>p.role==='stair'&&p.edge===e.a+':'+e.b).sort((a,b)=>a.step-b.step);
  if(pads.length!==6)return false;
  const elevations=[b.floor,...pads.map(p=>p.y),a.floor];
  for(let k=0;k<elevations.length-1;k++)if(Math.abs(elevations[k+1]-elevations[k])>CERT_STEP_TILES)return false;
  for(const p of pads){
    const px=(p.x+p.w/2)*TILE;
    if(collide(map,px,p.y*TILE))return false;
    // Five tiles rise, launch/landing horizontal range 2-3 tiles, which is
    // below the conservative 140px jump ceiling. Not a full Phaser sim.
    if(Math.abs(px-a.center*TILE)>6*TILE)return false;
  }
  // opening through the upper room floor really exists
  for(let tx=a.center-7;tx<a.center+7;tx++)if(map.cells[a.floor*SIZE+tx])return false;
  return true;
}
function validate(map){
  const errors=[],stats={};
  if(map.width!==SIZE||map.height!==SIZE||map.cells.length!==SIZE*SIZE)errors.push('BAD_DIMENSIONS');
  if(map.edges.length<15)errors.push('GRAPH_TOO_SPARSE');
  const graph=nodeGraph(map);
  const arrival=reachable(graph,0);
  if(arrival.size!==16)errors.push('UNREACHABLE_ROOMS');
  for(const roomId of PORTAL_ROOMS)if(reachable(graph,roomId).size!==16){errors.push('PORTAL_CANNOT_REACH_ALL:'+roomId);break;}
  // In a directed graph, incoming and outgoing connectivity must both hold.
  const reversed=Array.from({length:16},()=>[]);
  for(let a=0;a<16;a++)for(const b of graph[a])reversed[b].push(a);
  if(reachable(reversed,0).size!==16)errors.push('ONE_WAY_TRAP');
  for(let roomId=0;roomId<16;roomId++)if(reachable(graph,roomId).size!==16){errors.push('CANNOT_ESCAPE_ROOM:'+roomId);break;}
  for(const e of map.edges)if(!certOpening(map,e)){errors.push('INVALID_CONNECTOR:'+e.a+'-'+e.b);break;}
  if(map.portals.length!==4||new Set(map.portals.map(p=>p.room)).size!==4)errors.push('PORTAL_COUNT');
  if(map.questions.length!==5)errors.push('QUESTION_COUNT');
  if(map.flowers.length!==3)errors.push('FLOWER_COUNT');
  const all=[...map.questions,...map.flowers];
  for(const [i,p] of all.entries()){
    if(!arrival.has(p.room)){errors.push('ITEM_IN_UNREACHABLE_ROOM:'+i);continue;}
    if(collide(map,p.x,p.supportY))errors.push('ITEM_ROOM_BLOCKED:'+i);
    if(map.cells[Math.floor(p.supportY/TILE)*SIZE+Math.floor(p.x/TILE)]!==MARK.ROCK)
      errors.push('ITEM_NO_FLOOR:'+i);
    if(map.portals.some(portal=>Math.abs(portal.x-p.x)<38&&
       Math.abs(portal.groundY-p.y)<78))errors.push('ITEM_PIPE_OVERLAP:'+i);
    if(all.some((q,j)=>j!==i&&Math.hypot(p.x-q.x,p.y-q.y)<2*TILE))errors.push('ITEM_ITEM_OVERLAP:'+i);
  }
  for(let i=0;i<map.portals.length;i++){
    const p=map.portals[i];
    if(!arrival.has(p.room)||collide(map,p.x,p.groundY)||
      map.cells[(p.groundY/TILE)*SIZE+Math.floor(p.x/TILE)]!==MARK.ROCK)
      errors.push('PORTAL_INVALID:'+i);
  }
  // Every generated walkable ledge should lead back to a room's main floor.
  for(let i=0;i<map.platforms.length;i++){
    const p=map.platforms[i];
    if(p.role==='ledge'&&p.y<room(p.room).floor-7)errors.push('LEDGE_TOO_HIGH:'+i);
    if(!arrival.has(p.room)||collide(map,(p.x+p.w/2)*TILE,p.y*TILE))errors.push('LEDGE_INVALID:'+i);
  }
  stats.rooms=16;stats.edges=map.edges.length;stats.loops=map.edges.length-15;
  stats.secretPassages=map.edges.filter(e=>e.secret).length;
  stats.questions=map.questions.length;stats.flowers=map.flowers.length;
  stats.portals=map.portals.length;stats.stairs=map.platforms.filter(p=>p.role==='stair').length;
  stats.caveCells=map.cells.filter(c=>c===0).length;
  return {ok:errors.length===0,seed:map.seed,errors,stats,
    claims:{graphBidirectional:true,connectorGeometry:true,playerBodyClearance:true,
      phaserPhysicsReplayed:false,allPossiblePlayerPositionsCertified:false}};
}
function buildValidated(seed, maxAttempts=64){
  const first=Number(seed)>>>0;
  for(let attempt=0;attempt<maxAttempts;attempt++){
    const candidate=build((first+attempt*0x9e3779b9)>>>0);
    const audit=validate(candidate);
    if(audit.ok)return {map:candidate,audit,attempts:attempt+1};
  }
  throw Error('FAILED_TO_GENERATE_SAFE_CAVE after '+maxAttempts+' attempts');
}
function toStageGeometry(map){
  // Lossless rock collision rectangles. Compress row-runs and stack identical runs.
  const rows=[],rectangles=[];
  for(let y=0;y<SIZE;y++){
    const runs=[];let x=0;
    while(x<SIZE){if(map.cells[y*SIZE+x]!==MARK.ROCK){x++;continue;}
      const left=x;while(x<SIZE&&map.cells[y*SIZE+x]===MARK.ROCK)x++;
      runs.push({x:left,w:x-left,y,h:1});}
    rows.push(runs);
  }
  const active=new Map();
  for(let y=0;y<SIZE;y++){
    const next=new Map();
    for(const s of rows[y]){
      const k=s.x+':'+s.w;
      if(active.has(k)){const old=active.get(k);old.h++;next.set(k,old);}
      else{const o={...s};rectangles.push(o);next.set(k,o);}
    }
    active.clear();for(const [k,v] of next)active.set(k,v);
  }
  return {
    id:5,theme:'cave',worldW:SIZE*TILE,worldH:SIZE*TILE,
    solids:[...rectangles.map(s=>({x:s.x*TILE,y:s.y*TILE,w:s.w*TILE,h:s.h*TILE,kind:'ground'})),
      ...map.platforms.map(s=>({x:s.x*TILE,y:s.y*TILE,w:s.w*TILE,h:TILE,kind:'platform'}))],
    cavePortals:map.portals.map(p=>({...p})),
    flowers:map.flowers.map(p=>({x:p.x,y:p.y})),
    questionPoints:map.questions.map(p=>({x:p.x,y:p.y})),
    doorFacades:map.doors.filter(d=>d.secret).map(d=>({...d})),
    notes:'DRAFT geometry export; needs Phaser Arcade scene integration and collision replay before production.'
  };
}
function serializable(map){return {...map,cells:Array.from(map.cells)};}
return {TILE,SIZE,ROWS,COLS,ROOM,BODY,JUMP_HEIGHT,CERT_STEP_TILES,PORTAL_ROOMS,
  build,buildValidated,validate,toStageGeometry,serializable,nodeGraph,reachable,room,collide};
});
