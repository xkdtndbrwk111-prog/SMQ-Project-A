import {chromium} from '../phase2/harness/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=path.join(root,'dist-current-test');
const seeds=[0,1,42,999,2026,41805,314159,0xffffffff];
const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html',file=path.resolve(dir,name);if(!file.startsWith(dir+path.sep))throw Error('invalid');const ct={'.js':'text/javascript','.json':'application/json','.png':'image/png','.ogg':'audio/ogg'}[path.extname(file)]||'text/html; charset=utf-8';res.setHeader('Content-Type',ct);res.end(await readFile(file));}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
const build=JSON.parse(await readFile(path.join(dir,'BUILD.json'),'utf8'));
const report={baseline:'599ad311ade249d5b62f31b0f344de24afa37e3d',method:'Runtime-generated scenes, initial spawn geometry; no gameplay change. Stage changes are induced. Flags are triage, not confirmed defects.',seeds:[]};
const near=(e,x,y,r=160)=>Number.isFinite(x)&&Math.abs(e.x-x)<=r&&(!Number.isFinite(y)||Math.abs(e.y-y)<=192);
const hit=(a,b)=>a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t;
function classify(a){
 const checkpoints=a.surfaceCheckpoint?[{type:'start',x:a.surfaceCheckpoint.start},{type:'mid',x:a.surfaceCheckpoint.mid,y:a.surfaceCheckpoint.midY},{type:'end',x:a.surfaceCheckpoint.end}]:a.caveCheckpoints?[...a.caveCheckpoints.portals.map((p,i)=>({type:'portal'+i,x:p.anchor.x,y:p.anchor.groundY})),...a.caveCheckpoints.machines.map((p,i)=>({type:'machine'+i,x:p.x,y:p.groundY}))]:[];
 const questions=[...a.enemies.filter(e=>e.type==='BALLOONEY').map(e=>({x:e.x,y:e.y,type:'balloon'})),...a.bricks.filter(b=>b.hiddenQuiz).map(b=>({x:b.x,y:b.y,type:'hidden-brick'})),...a.secrets.map(o=>({x:o.x,y:o.y,type:'secret'}))];
 const flags={body_inside_ground:0,spawn_over_water:0,ground_actor_over_water_without_static_support:0,near_checkpoint:0,patrol_over_water:0,patrol_support_gaps:0};
 const enemies=a.enemies.map(e=>{const box={l:e.x-e.body.w/2,r:e.x+e.body.w/2,t:e.y-e.body.h,b:e.y};const embedded=a.solids.some(s=>s.kind==='ground'&&hit(box,{l:s.x,r:s.x+s.w,t:s.y,b:s.y+s.h}));const water=a.water.filter(([l,r])=>e.x>=l*16&&e.x<r*16);const patrolWater=a.water.filter(([l,r])=>Number.isFinite(e.min)&&Number.isFinite(e.max)&&e.min<r*16&&e.max>l*16);const close=checkpoints.filter(c=>near(e,c.x,c.y,96));
  const flying=['OWL','BLANKEY','BALLOONEY'].includes(e.type),supportAt=x=>a.solids.some(s=>x>=s.x&&x<s.x+s.w&&Math.abs(s.y-e.y)<=4)||a.moving.some(s=>x>=s.x&&x<s.x+s.w&&Math.abs(s.y-e.y)<=4)||a.rafts.some(s=>x>=s.x&&x<s.x+s.w&&Math.abs(s.y-e.y)<=4)||a.crumbles.some(s=>x>=s.x&&x<s.x+s.w&&Math.abs(s.y-e.y)<=4);
  const supported=supportAt(e.x),unsupportedWater=!flying&&water.length>0&&!supported;
  const samples=[];if(!flying&&Number.isFinite(e.min)&&Number.isFinite(e.max)&&e.max>=e.min)for(let x=e.min;x<=e.max;x+=16)if(!supportAt(x))samples.push(x);
  flags.body_inside_ground+=Number(embedded);flags.spawn_over_water+=Number(water.length>0);flags.ground_actor_over_water_without_static_support+=Number(unsupportedWater);flags.near_checkpoint+=Number(close.length>0);flags.patrol_over_water+=Number(patrolWater.length>0);flags.patrol_support_gaps+=Number(samples.length>0);
  return {...e,kind:flying?'airborne_or_hovering':'ground_actor',flags:{embedded,water:water.length>0,supportedAtSpawn:supported,unsupportedWater,checkpoint:close.map(c=>c.type),patrolWater:patrolWater.length>0,patrolSupportGapSamples:samples},nearby:{solids:a.solids.filter(s=>near(e,s.x+s.w/2,s.y,Math.min(384,s.w/2+128))).map(s=>({x:s.x,y:s.y,w:s.w,h:s.h,kind:s.kind,cave:!!s.cave,slab:!!s.slab})),water:a.water.filter(([l,r])=>e.x>=l*16-160&&e.x<=r*16+160),moving:a.moving.filter(o=>near(e,o.x,o.y)),crumbles:a.crumbles.filter(o=>near(e,o.x,o.y)),rafts:a.rafts.filter(o=>near(e,o.x,o.y)),flowers:a.flowers.filter(o=>near(e,o.x,o.y)),questions:questions.filter(o=>near(e,o.x,o.y)),checkpoints:checkpoints.filter(o=>near(e,o.x,o.y,160))}};
 });
 const typeCounts={};for(const e of enemies)typeCounts[e.type]=(typeCounts[e.type]||0)+1;
 return {seed:a.seed,stage:a.stage,theme:a.theme,caveStatus:a.caveStatus,segmentOrder:a.segmentOrder,start:a.start,goal:a.goal,checkpoints,pipes:a.pipes,solids:a.solids,water:a.water,caves:a.caves,moving:a.moving,crumbles:a.crumbles,rafts:a.rafts,springs:a.springs,flowers:a.flowers,questions,flags,typeCounts,enemies};
}
try{for(const seed of seeds){
 const ctx=await browser.newContext();try{await ctx.addInitScript(seed=>{if(location.hostname==='127.0.0.1')sessionStorage.setItem('HOJA_TEST_SEED',String(seed));},seed);const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const params=new URLSearchParams({m:'s',c:'test-joseon-a',cv:'19065b1d0fc5',gv:build.gameVersion,s:'spring'});await page.goto(`http://127.0.0.1:${server.address().port}/play.html?${params}`);await page.locator('#hojaStudentStart:not([disabled])').click({timeout:30000});await page.frameLocator('#hqArcadeFrame').locator('#scoreHud').waitFor({state:'visible',timeout:30000});const frame=page.frames().find(f=>f.url().includes('/arcade.html'));await frame.waitForFunction(()=>!!window.HOJA_TEST_PROBE?.phase4cAudit(),null,{timeout:30000});const stages=[];
 for(let i=0;i<5;i++){if(i){await frame.evaluate(i=>window.HOJA_TEST_PROBE.phase4cStage(i),i);await frame.waitForFunction(i=>window.HOJA_TEST_PROBE?.phase4cAudit()?.stage===i,i,{timeout:30000});}const data=await frame.evaluate(()=>window.HOJA_TEST_PROBE.phase4cAudit());if(data.seed!==seed)throw Error(`seed mismatch expected ${seed} got ${data.seed}`);stages.push(classify(data));}
 if(errors.length)throw Error(`seed ${seed}: ${errors.join('; ')}`);report.seeds.push({seed,stages});console.log('PASS runtime seed',seed,stages.map(s=>`${s.theme}:${s.enemies.length}`).join(' '));
 }finally{await ctx.close();}}
 await writeFile(path.join(root,'verification/phase4c/runtime-inventory.json'),JSON.stringify(report,null,2)+'\n');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
