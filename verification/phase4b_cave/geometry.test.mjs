import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const c=vm.createContext({});c.window=c;vm.runInContext('Math.random=()=>{throw Error("gameplay RNG used")}',c);for(const name of ['cave-layout','cave-variation','cave-checkpoints'])vm.runInContext(await readFile(new URL(`../../web/current/js/world/${name}.js`,import.meta.url),'utf8'),c);
test('center vending point is on safe connected ground for multiple generated caves',()=>{
 for(const seed of [...Array.from({length:500},(_,i)=>i),999,2026,41805,314159,0xffffffff]){
  const {map}=c.HojaCave44.buildValidated((seed^0x49220049)>>>0,32),stage=c.HojaCave44.exportStage(map),portals=stage.cavePortals;
  const offsets=portals.map((p,i)=>{for(const dx of (i%2===0?[56,48,72,-56,-48]:[-56,-48,-72,56,48]))if(!c.HojaCave44.MotionBaseline.collide(map,p.x+dx,p.groundY))return dx;throw Error('no offset')});
  let choices;try{choices=c.HOJA_CAVE_CHECKPOINTS.choosePair({solids:stage.solids,portals,offsets,flowers:stage.flowers,enemies:stage.questionPoints.map(p=>({...p,type:'BALLOONEY'})),secrets:(map.secretFacades||[]).map(w=>({x:w.x/16,y:w.y/16,w:w.w/16,h:w.h/16}))});}catch(e){throw Error('seed '+seed+': '+e.message)}
  assert.deepEqual(Array.from(choices,x=>x.room),[5,10]);for(const choice of choices)assert.equal(c.HojaCave44.MotionBaseline.collide(map,choice.x,choice.groundY),false);assert.equal(JSON.stringify(choices),JSON.stringify(c.HOJA_CAVE_CHECKPOINTS.choosePair({solids:stage.solids,portals,offsets,flowers:stage.flowers,enemies:stage.questionPoints.map(p=>({...p,type:'BALLOONEY'})),secrets:(map.secretFacades||[]).map(w=>({x:w.x/16,y:w.y/16,w:w.w/16,h:w.h/16}))})));
 }
});
test('checkpoint proximity requires matching both horizontal and vertical position',()=>{const p={x:400,groundY:500};assert.ok(c.HOJA_CAVE_CHECKPOINTS.nearby(450,520,p));assert.ok(!c.HOJA_CAVE_CHECKPOINTS.nearby(450,700,p));assert.ok(!c.HOJA_CAVE_CHECKPOINTS.nearby(600,500,p));});
