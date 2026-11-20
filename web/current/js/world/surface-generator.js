'use strict';
// Templates are prepared once at boot. STAGES later also receives the cave.
window.HOJA_CREATE_SURFACE_GENERATOR = function ({ STAGES, THEMES, TILE, T, F, DECOR_SCALE, stageQuestionCount }) {
  // ===========================================================================
  // V0.26 RANDOM MAPS
  // Each stage template is cut into hand-made segments at flat ground (F),
  // then every run re-assembles them: first/last segment fixed (doors),
  // middle segments shuffled and randomly mirrored, walker enemies re-cast
  // from the stage roster, hidden-quiz stones re-assigned. Every result is
  // checked with the same rules as the offline validator (goal reachable, no
  // traps, every '?' / flower reachable); failed rolls are re-drawn.
  // ===========================================================================
  const WALKER_TYPES=['JUMPY','ROACH','HERMIE','MARTIAN','ROBOT','CIRCUIT'];

  function mulberry32(a){
    return function(){
      a|=0;a=a+0x6D2B79F5|0;
      let t=Math.imul(a^a>>>15,1|a);
      t=t+Math.imul(t^t>>>7,61|t)^t;
      return((t^t>>>14)>>>0)/4294967296;
    };
  }

  function decorWidthTiles(st,d){
    const list=THEMES[st.theme].decor[d[1]];
    if(!list||!list.length)return 2;
    return list[(d[2]||0)%list.length][0].length*DECOR_SCALE;
  }

  // ---------------------------------------------------------------- checks ---
  const _H=140,_gUp=(2*140/(24*24))*3600,_gDown=_gUp*1.7,_run=7.2*60,_BODY_W=36;
  function _reach(rise,vx,h){
    if(rise>h-6)return -1;
    const vy0=Math.sqrt(2*_gUp*h),t1=vy0/_gUp,t2=Math.sqrt(2*(h-rise)/_gDown);
    return vx*(t1+t2);
  }
  function checkStage(st){
    const crit=[];
    const surfaces=[];
    st.solids.forEach(s=>surfaces.push({l:s.x,r:s.x+s.w,y:s.y,kind:s.kind}));
    (st.moving||[]).forEach(m=>{
      if(m.axis==='x')surfaces.push({l:m.min,r:m.max,y:m.y,kind:'moving'});
      else{
        surfaces.push({l:m.x,r:m.x+m.w,y:m.min,kind:'moving'});
        surfaces.push({l:m.x,r:m.x+m.w,y:m.max,kind:'moving'});
      }
    });
    (st.crumbles||[]).forEach(c=>surfaces.push({l:c.x,r:c.x+c.w,y:c.y,kind:'crumble'}));
    (st.rafts||[]).forEach(c=>{
      surfaces.push({l:c.x,r:c.x+c.w,y:c.y,kind:'raft'});
      surfaces.push({l:c.x,r:c.x+c.w,y:c.y+c.sink,kind:'raft'});
    });
    (st.springs||[]).forEach(p=>surfaces.push({l:p.x,r:p.x+32,y:p.y,kind:'spring'}));
    const grounds=st.solids.filter(s=>s.kind==='ground');
    const groundTop=x=>{let b=null;for(const s of grounds)if(x>=s.x&&x<s.x+s.w)b=b===null?s.y:Math.min(b,s.y);return b};
    const reachable=(a,b)=>{
      if(a===b)return false;
      if(b.kind==='spring')return a.y===b.y&&a.l<=b.l&&a.r>=b.r;
      const rise=a.y-b.y,gap=Math.max(0,b.l-a.r,a.l-b.r);
      if(a.kind==='spring')return rise<=16*TILE&&gap<=4*TILE;
      if(rise<=0){
        const t=Math.sqrt(2*(-rise+_H)/_gDown)+Math.sqrt(2*_H/_gUp);
        return gap<=_run*t*0.8;
      }
      const d=_reach(rise,_run,_H*1.12);
      if(d<0)return false;
      if(b.kind==='ground'&&gap===0)return true;
      return gap<=d*0.75-_BODY_W/2;
    };
    // adjacency once (surfaces ~100 → cheap)
    const adj=surfaces.map(a=>surfaces.filter(b=>reachable(a,b)));
    const idx=new Map(surfaces.map((s,i)=>[s,i]));
    const bfs=(from)=>{
      const seen=new Set([from]),q=[from];
      while(q.length){const u=q.shift();for(const b of adj[idx.get(u)])if(!seen.has(b)){seen.add(b);q.push(b);}}
      return seen;
    };
    const sx=st.start*TILE,gx=st.goal*TILE;
    const startS=surfaces.find(s=>s.kind==='ground'&&sx>=s.l&&sx<s.r&&s.y===groundTop(sx));
    const goalS=surfaces.find(s=>s.kind==='ground'&&gx>=s.l&&gx<s.r&&s.y===groundTop(gx));
    if(!startS||!goalS){crit.push('no start/goal ground');return crit;}
    const seen=bfs(startS);
    if(!seen.has(goalS))crit.push('goal unreachable');
    // no traps: reverse reachability from the goal
    const radj=surfaces.map(()=>[]);
    surfaces.forEach((a,i)=>adj[i].forEach(b=>radj[idx.get(b)].push(a)));
    const canReachGoal=new Set([goalS]);const rq=[goalS];
    while(rq.length){const u=rq.shift();for(const a of radj[idx.get(u)])if(!canReachGoal.has(a)){canReachGoal.add(a);rq.push(a);}}
    for(const s of seen)if(!canReachGoal.has(s)){crit.push(`trap at x${Math.round(s.l/16)}`);break;}
    const touchable=(x,y)=>[...seen].some(s=>x>=s.l-3*TILE&&x<=s.r+3*TILE&&s.y-y>=-8&&s.y-y<=(s.kind==='spring'?17*TILE:_H+42));
    (st.flowers||[]).forEach(f=>{if(!touchable(f.x,f.y))crit.push(`flower x${Math.round(f.x/16)}`);});
    st.enemies.filter(e=>e.type==='BALLOONEY').forEach(e=>{if(!touchable(e.x,e.y-25))crit.push(`balloon x${Math.round(e.x/16)}`);});
    (st.secrets||[]).forEach(b=>{
      const bottom=b.y+32;
      if(![...seen].some(s=>s.kind!=='spring'&&s.l<b.x+28&&s.r>b.x+4&&s.y-bottom>=44&&s.y-bottom<=150))crit.push(`secret x${b.x/16}`);
    });
    for(const [a,b] of st.water){
      const L=grounds.some(s=>Math.abs(s.x+s.w-a*TILE)<.01),R=grounds.some(s=>Math.abs(s.x-b*TILE)<.01);
      if(!L||!R)crit.push(`water bank ${a}-${b}`);
    }
    for(const c of st.checkpoints)if(groundTop(c*TILE)===null)crit.push(`checkpoint ${c}`);
    return crit;
  }

  // --------------------------------------------------------------- segments ---
  function _crossesCut(st,X){
    // Nothing may straddle the cut; enemies / water / caves keep a small margin.
    const R=(x,w)=>x<X&&x+w>X;
    for(const s of st.solids)if(s.kind!=='ground'&&R(s.x,s.w))return true;
    for(const c of st.crumbles||[])if(R(c.x,c.w))return true;
    for(const r of st.rafts||[])if(R(r.x,r.w))return true;
    for(const m of st.moving||[]){
      if(m.axis==='x'){if(R(m.min,m.max-m.min))return true;}
      else if(R(m.x,m.w))return true;
    }
    for(const b of st.bricks)if(R(b.x,32))return true;
    for(const p of st.springs||[])if(R(p.x,32))return true;
    for(const p of st.secrets||[])if(R(p.x,32))return true;
    for(const f of st.flowers||[])if(Math.abs(f.x-X)<TILE)return true;
    for(const e of st.enemies)if(Math.abs(e.x-X)<TILE*1.5)return true;
    for(const [a,b] of st.caves||[])if(T(a)-2*TILE<X&&T(b)+2*TILE>X)return true;
    for(const [a,b] of st.water)if(T(a)-2*TILE<X&&T(b)+2*TILE>X)return true;
    for(const d of st.decor)if(T(d[0])<X&&T(d[0]+decorWidthTiles(st,d))>X)return true;
    return false;
  }

  function findCuts(st){
    const grounds=st.solids.filter(s=>s.kind==='ground');
    const ok=t=>{
      const X=T(t);
      const g=grounds.find(s=>s.y===F&&!s.slab&&!s.cave&&s.x<=X-T(2)&&s.x+s.w>=X+T(2));
      if(!g)return false;
      if(grounds.some(s=>s.x<X+T(2)&&s.x+s.w>X-T(2)&&s.y<F))return false;
      return !_crossesCut(st,X);
    };
    const cuts=[];
    let pos=0;
    const lastAllowed=st.goal-12;
    while(true){
      let best=null;
      for(let t=pos+24;t<=Math.min(pos+80,lastAllowed);t++){
        if(!ok(t))continue;
        if(best===null||Math.abs(t-(pos+36))<Math.abs(best-(pos+36)))best=t;
      }
      if(best===null)break;
      cuts.push(best);pos=best;
    }
    return cuts;
  }

  function extractSegment(st,A,B){
    const XA=T(A),XB=T(B);
    const inX=x=>x>=XA&&x<XB;
    const rel=o=>({...o,x:o.x-XA});
    const seg={w:B-A,theme:st.theme,solids:[],crumbles:[],rafts:[],moving:[],bricks:[],springs:[],
      secrets:[],flowers:[],enemies:[],water:[],caves:[],decor:[],checkpoints:[],goal:null,start:null};
    for(const s of st.solids){
      if(s.kind==='ground'){
        const l=Math.max(s.x,XA),r=Math.min(s.x+s.w,XB);
        if(r>l)seg.solids.push({...s,x:l-XA,w:r-l});
      }else if(inX(s.x))seg.solids.push(rel(s));
    }
    for(const k of ['crumbles','rafts','moving','bricks','springs','secrets','flowers'])
      for(const o of st[k]||[])if(inX(o.x)){
        const c=rel(o);
        if(k==='moving'&&o.axis==='x'){c.min=o.min-XA;c.max=o.max-XA;}
        seg[k].push(c);
      }
    for(const e of st.enemies)if(inX(e.x))
      seg.enemies.push({...e,x:e.x-XA,min:Math.max(e.min,XA+TILE)-XA,max:Math.min(e.max,XB-TILE)-XA});
    for(const [a,b] of st.water)if(a>=A&&a<B)seg.water.push([a-A,b-A]);
    for(const [a,b] of st.caves||[])if(a>=A&&a<B)seg.caves.push([a-A,b-A]);
    for(const d of st.decor)if(d[0]>=A&&d[0]+decorWidthTiles(st,d)<=B)seg.decor.push([d[0]-A,d[1],d[2]]);
    for(const c of st.checkpoints)if(c>=A&&c<B)seg.checkpoints.push(c-A);
    if(st.goal>=A&&st.goal<B)seg.goal=st.goal-A;
    if(st.start>=A&&st.start<B)seg.start=st.start-A;
    return seg;
  }

  function segmentStage(st){
    const cuts=findCuts(st);
    const edges=[0,...cuts,st.worldW];
    const segs=[];
    for(let i=0;i<edges.length-1;i++)segs.push(extractSegment(st,edges[i],edges[i+1]));
    return segs;
  }
  const STAGE_SEGMENTS=STAGES.map(segmentStage);

  // Keep exactly 5 unique ? pickups in each surface stage. For each generated
  // layout, remove extras by deterministic list order (no recreation on return).
  function capSurfaceQuestions(st){
    let count=stageQuestionCount(st);
    while(count>5){
      const e=st.enemies.findIndex(v=>v.type==='BALLOONEY');
      if(e>=0)st.enemies.splice(e,1);
      else if(st.secrets.length)st.secrets.pop();
      else {const b=st.bricks.find(v=>v.hiddenQuiz);if(b)b.hiddenQuiz=false;else break;}
      count--;
    }
    if(count!==5)throw new Error(`Surface level ${st.id} has ${count} ? pickups, expected 5`);
    return st;
  }

  // --------------------------------------------------------------- assembly ---
  function placeSegment(out,seg,O,mirror,st){
    const XO=T(O),W=T(seg.w);
    const rx=(x,w)=>mirror?XO+W-x-w:XO+x;     // rect left
    const cx=x=>mirror?XO+W-x:XO+x;           // centre point
    for(const s of seg.solids)out.solids.push({...s,x:rx(s.x,s.w)});
    for(const c of seg.crumbles)out.crumbles.push({...c,x:rx(c.x,c.w)});
    for(const r of seg.rafts)out.rafts.push({...r,x:rx(r.x,r.w)});
    for(const m of seg.moving){
      const n={...m,x:rx(m.x,m.w)};
      if(m.axis==='x'){n.min=mirror?XO+W-m.max:XO+m.min;n.max=mirror?XO+W-m.min:XO+m.max;}
      out.moving.push(n);
    }
    for(const b of seg.bricks)out.bricks.push({...b,x:rx(b.x,32)});
    for(const p of seg.springs)out.springs.push({...p,x:rx(p.x,32)});
    for(const p of seg.secrets)out.secrets.push({...p,x:rx(p.x,32)});
    for(const f of seg.flowers)out.flowers.push({...f,x:cx(f.x)});
    for(const e of seg.enemies)out.enemies.push({...e,x:cx(e.x),
      min:mirror?XO+W-e.max:XO+e.min,max:mirror?XO+W-e.min:XO+e.max});
    const rt=(a,b)=>mirror?[O+seg.w-b,O+seg.w-a]:[O+a,O+b];
    for(const [a,b] of seg.water)out.water.push(rt(a,b));
    for(const [a,b] of seg.caves)out.caves.push(rt(a,b));
    for(const d of seg.decor){
      const wd=decorWidthTiles(st,d);
      out.decor.push([mirror?O+seg.w-d[0]-wd:O+d[0],d[1],d[2]]);
    }
    // tile cell c covers [c,c+1) → mirrored cell is w-c-1
    for(const c of seg.checkpoints)out.checkpoints.push(mirror?O+seg.w-c-1:O+c);
    if(seg.goal!==null)out.goal=O+seg.goal;
    if(seg.start!==null)out.start=O+seg.start;
  }

  function assembleStage(tpl,segs,rnd){
    const first=segs[0],last=segs[segs.length-1];
    const mid=segs.slice(1,-1);
    for(let i=mid.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[mid[i],mid[j]]=[mid[j],mid[i]];}
    const order=[{seg:first,m:false},...mid.map(seg=>({seg,m:rnd()<.5})),{seg:last,m:false}];
    const out={id:tpl.id,theme:tpl.theme,worldW:0,goal:tpl.goal,start:tpl.start,checkpoints:[],
      solids:[],crumbles:[],rafts:[],moving:[],bricks:[],springs:[],secrets:[],flowers:[],
      enemies:[],water:[],caves:[],decor:[]};
    let O=0;
    for(const {seg,m} of order){
      placeSegment(out,seg,O,m,tpl);
      if(O>0)out.checkpoints.push(O+1);           // checkpoint at every join (cuts guarantee ±2 flat tiles)
      O+=seg.w;
    }
    out.worldW=O;
    out.checkpoints=[...new Set(out.checkpoints)].sort((a,b)=>a-b);
    // walker enemies re-cast from this stage's own walker roster
    const roster=[...new Set(tpl.enemies.map(e=>e.type).filter(t=>WALKER_TYPES.includes(t)))];
    if(roster.length>1)for(const e of out.enemies)if(WALKER_TYPES.includes(e.type))e.type=roster[Math.floor(rnd()*roster.length)];
    // hidden-quiz stones re-assigned (same count)
    const hidden=out.bricks.filter(b=>b.hiddenQuiz).length;
    out.bricks.forEach(b=>b.hiddenQuiz=false);
    const pool=[...out.bricks];
    for(let i=0;i<hidden&&pool.length;i++){pool.splice(Math.floor(rnd()*pool.length),1)[0].hiddenQuiz=true;}
    out.segmentOrder=order.map(o=>(segs.indexOf(o.seg))+(o.m?'m':''));
    return out;
  }

  function generateRunStages(seed){
    const rnd=mulberry32(seed>>>0);
    return STAGES.map((tpl,i)=>{
      if(i===4)return tpl;
      const segs=STAGE_SEGMENTS[i];
      if(segs.length<4)return capSurfaceQuestions(tpl);                // nothing to shuffle
      for(let attempt=0;attempt<30;attempt++){
        const st=assembleStage(tpl,segs,rnd);
        if(checkStage(st).length===0)return capSurfaceQuestions(st);
      }
      return capSurfaceQuestions(tpl);             // validated hand-made fallback
    });
  }
  return { generateRunStages, capSurfaceQuestions, mulberry32 };
};
