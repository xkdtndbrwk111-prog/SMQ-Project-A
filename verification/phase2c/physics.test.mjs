import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const url = new URL('../../web/current/js/physics.js', import.meta.url);
const window = {};
vm.runInNewContext(readFileSync(url, 'utf8'), {window});
const physics = window.HOJA_CREATE_PHYSICS(16);

test('one-way contact, strict body overlap and stomp assist boundaries', () => {
  const actor = {body:{prev:{y:95}, height:12, velocity:{y:0}}};
  const ledge = {body:{top:100}};
  assert.equal(physics.landsOnPlatform(actor, ledge), true);
  actor.body.prev.y = 95.01;
  assert.equal(physics.landsOnPlatform(actor, ledge), false);
  actor.body.prev.y = 91;
  actor.body.velocity.y = -1;
  assert.equal(physics.landsOnPlatform(actor, ledge), false);
  const player = {left:0,right:20,top:0,bottom:16,velocity:{y:36}};
  const enemy = {left:28,right:48,top:30,bottom:60,center:{y:45}};
  assert.equal(physics.overlapBodies(player,enemy), false);
  assert.equal(physics.isStomp(player,enemy), true);
  player.velocity.y = 35;
  assert.equal(physics.isStomp(player,enemy), false);
  assert.equal(physics.hojaPressedAgainstMovingPlatform({at:0,side:1},135,1), true);
  assert.equal(physics.hojaPressedAgainstMovingPlatform({at:0,side:1},136,1), false);
});

test('ground acceleration, ice and a buffered jump with early release', () => {
  const body = {
    velocity:{x:0,y:0}, setVelocityX(x){this.velocity.x=x;}, setVelocityY(y){this.velocity.y=y;},
    setMaxVelocity(){}, setAccelerationY(){}
  };
  const scene = {playerBody:{body},isOnIce:()=>false,keys:{jump:{isDown:true}},time:{now:100},
    coyoteMs:100, jumpBufferAt:0, emitDust(){}, squash(){}};
  physics.applyHorizontalMotion(scene,.016,100,true,1,false,false);
  assert.equal(body.velocity.x, 12.672);
  scene.isOnIce = () => true;
  physics.applyHorizontalMotion(scene,.016,116,true,1,false,false);
  assert.ok(Math.abs(body.velocity.x - 20.2752) < 1e-9);
  let jumps = 0;
  physics.applyVerticalMotion(scene,false,false,true,{jump(){jumps++;}});
  assert.equal(jumps,1);
  assert.ok(body.velocity.y < -690);
  const rising = body.velocity.y;
  scene.keys.jump.isDown = false;
  physics.applyVerticalMotion(scene,false,false,false,{});
  assert.equal(body.velocity.y, rising * .45);
  assert.equal(scene.jumpCut, true);
});
