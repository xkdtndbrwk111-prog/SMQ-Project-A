import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context={window:{},Math:Object.create(Math)};
context.Math.random=()=>{throw Error('gameplay RNG must not be called')};
vm.runInNewContext(await readFile(new URL('../../web/current/js/world/stage-decor.js',import.meta.url),'utf8'),context);
const api=context.window.HOJA_STAGE_DECOR;
test('checkpoint chooses safe ground near the center and crosses at the machine in either direction',()=>{
 const solids=[{kind:'ground',x:0,y:200,w:400},{kind:'ground',x:500,y:280,w:500}];
 const cp=api.checkpoint({solids,start:64,end:936,theme:'grassland',blocked:[{x:550,y:280,radius:32}]});
 assert.equal(cp.line,cp.mid);assert.notEqual(cp.mid,500);assert.ok(cp.mid<400||cp.mid>500);
 const cleared=api.checkpoint({solids,start:64,end:936,theme:'grassland',clear:x=>x<300||x>700});assert.ok(cleared.mid<300||cleared.mid>700,'platform clearance is mandatory');
 assert.ok(api.crossed(cp.mid-10,cp.mid+10,cp.line));assert.ok(api.crossed(cp.mid+10,cp.mid-10,cp.line));assert.ok(!api.crossed(490,510,cp.line),'old center no longer triggers a distant machine');for(const theme of ['autumn','tropics','winter'])assert.equal(api.checkpoint({solids,start:64,end:936,theme}).line,500,theme+' preserves the existing center line');
});
test('per-theme decorations are deterministic, grounded, and avoid reservations',()=>{
 const solids=[{kind:'ground',x:0,y:300,w:1800},{kind:'ground',x:1900,y:250,w:1800}];
 for(const theme of ['grassland','autumn','tropics','winter']){
  const opts={theme,solids,start:80,end:3500,seed:314159,blocked:[{x:1000,y:300,radius:100}]};
  const a=api.plan(opts),b=api.plan(opts);assert.ok(a.length);assert.equal(JSON.stringify(a),JSON.stringify(b));
  for(const p of a){assert.equal(api.ground(solids,p.x,p.width),p.y);assert.ok(Math.abs(p.x-1000)>=100+p.width/2||Math.abs(p.y-300)>=p.height+24);assert.ok(p.rect[2]>0&&p.rect[3]>0);}
 }
});
test('generated and mirrored stage geometry supports safe placement across several seeds',async()=>{
 const c=vm.createContext({});c.window=c;
 for(const file of ['cave-layout','cave-variation','themes','surface-templates','surface-generator','stage-decor'])vm.runInContext(await readFile(new URL(`../../web/current/js/world/${file}.js`,import.meta.url),'utf8'),c);
 const dims={TILE:16,T:x=>x*16,F:880,WORLD_H:1248};
 for(const seed of [0,1,2,3,4,5,6,7,8,9,17,42,123,999,2026,41805,314159,0xffffffff]){
  const templates=c.HOJA_CREATE_SURFACE_TEMPLATES(dims),count=st=>st.enemies.filter(e=>e.type==='BALLOONEY').length+st.bricks.filter(b=>b.hiddenQuiz).length+st.secrets.length;
  const gen=c.HOJA_CREATE_SURFACE_GENERATOR({...dims,STAGES:templates,THEMES:c.HOJA_CREATE_THEMES(),DECOR_SCALE:2,stageQuestionCount:count});templates.push(c.HojaCave44.buildValidated(seed).map);
  for(const st of gen.generateRunStages(seed).slice(0,4)){
   const start=st.start*16,end=st.goal*16,blocked=[...st.water.map(([a,b])=>({x:(a+b)*8,radius:(b-a)*8+24})),...st.caves.map(([a,b])=>({x:(a+b)*8,radius:(b-a)*8+16}))];
   const clear=(x,y)=>{
    const hit=(a,b,w,h)=>x-34<a+w&&x+34>a&&y-68<b+h&&y>b;
    return !st.solids.some(o=>o.kind!=='ground'&&hit(o.x,o.y,o.w,o.h))&&!st.bricks.some(o=>hit(o.x,o.y,32,32))&&!(st.crumbles||[]).some(o=>hit(o.x,o.y,o.w,o.h||16));
   };
   const cp=c.HOJA_STAGE_DECOR.checkpoint({solids:st.solids,start,end,theme:st.theme,blocked,clear});assert.equal(c.HOJA_STAGE_DECOR.ground(st.solids,cp.mid,64),cp.midY);assert.equal(cp.line,st.theme==='grassland'?cp.mid:(start+end)/2,'only the meadow save line changes');
   const props=c.HOJA_STAGE_DECOR.plan({theme:st.theme,solids:st.solids,start,end,seed,blocked,enemies:st.enemies});
   for(const p of props)assert.equal(c.HOJA_STAGE_DECOR.ground(st.solids,p.x,p.width),p.y);
  }
 }
});

test('tropical short rail uses the complete source fence',()=>{const short=api.item('tropics:short-rail'),full=api.item('tropics:shore-rail');assert.deepEqual(Array.from(short.rect),Array.from(full.rect));assert.equal(short.rect[2],48);});
