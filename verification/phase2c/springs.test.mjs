import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const window = {};
vm.runInNewContext(readFileSync(new URL('../../web/current/js/springs.js', import.meta.url), 'utf8'), {window});
test('spring activates only on a descending overlapping player and resets after 150 ms', () => {
  let sounds = 0;
  const springs = window.HOJA_CREATE_SPRING_SYSTEM({spring:()=>sounds++});
  const image = {frames:[], setOrigin(){return this},setScale(){return this},setDepth(){return this},setFrame(frame){this.frames.push(frame)}};
  const effects = [];
  const scene = {add:{image:()=>image}, playerBody:{body:{velocity:{y:-1},right:30,left:10,bottom:80}},
    strongStomp:true, coyoteMs:3, bounce:(...a)=>effects.push(a), squash(){}, emitDust(){}, emitBurst(){}};
  springs.createSprings(scene,[{x:0,y:100}]);
  springs.updateSprings(scene,100);
  assert.equal(sounds,0);
  scene.playerBody.body.velocity.y=0;
  springs.updateSprings(scene,100);
  assert.equal(sounds,1);
  assert.deepEqual(effects,[[560,'spring']]);
  assert.equal(scene.strongStomp,false);
  assert.equal(scene.coyoteMs,0);
  scene.playerBody.body.left=99;
  springs.updateSprings(scene,251);
  assert.deepEqual(image.frames,[1,0]);
});
