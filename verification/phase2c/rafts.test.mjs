import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const window = {};
vm.runInNewContext(readFileSync(new URL('../../web/current/js/rafts.js',import.meta.url),'utf8'),{window});

test('16ms raft sequence sinks, disables collision and returns after player clears',()=>{
 let warnings=0,lands=0;
 const system=window.HOJA_CREATE_RAFTS({TILE:16,waterAtX:()=>110,SFX:{raftWarning(){warnings++},land(){lands++}}});
 const player={left:5,right:25,top:50,bottom:100,velocity:{y:0},blocked:{down:true},touching:{down:false},setVelocityY(v){this.velocity.y=v}};
 const group={children:[],add(o){this.children.push(o)}};
 const scene={time:{now:0},playerBody:{body:player},movingPlatformGroup:group,
  add:{rectangle(x,y,w,h){return {x,y,w,h}},image(){return {setDepth(){return this},setTint(){},clearTint(){},setPosition(){}}}},
  physics:{add:{existing(o){o.body={top:o.y-o.h/2,left:o.x-o.w/2,right:o.x+o.w/2,height:o.h,center:{x:o.x},checkCollision:{},
    setAllowGravity(){},setImmovable(){},setVelocity(x,y){this.vy=y},reset(x,y){this.top=y-this.height/2}}}}},
  emitBurst(){},cameras:{main:{shake(){}}}};
 const cfg={x:0,y:100,w:32,sink:12};
 system.createRafts(scene,[cfg]);
 const raft=scene.rafts[0], b=raft.bodyObj.body;
 assert.equal(group.children[0].__raft,raft);
 raft.touchAt=0;
 for(let i=0;i<80&&!raft.sunk;i++){
  scene.time.now+=16;
  player.bottom=b.top;raft.touchAt=scene.time.now;
  system.updateRafts(scene);
  b.top+=b.vy*.016;
 }
 assert.equal(raft.sunk,true);
 assert.equal(b.checkCollision.none,true);
 assert.equal(warnings,1);
 assert.equal(lands,1);
 player.left=200;player.right=220;
 for(let i=0;i<250&&raft.sunk;i++){
  scene.time.now+=16;
  system.updateRafts(scene);
  b.top+=b.vy*.016;
 }
 assert.equal(raft.sunk,false);
 assert.equal(b.checkCollision.none,false);
 assert.equal(b.checkCollision.up,true);
 system.createRafts(scene,[cfg]);
 assert.notEqual(scene.rafts[0],raft);
});
