import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const types = ['jumpy','owl','hermie','roach','blankey','ballooney','martian','robot','circuit'];
const window = {};
for (const file of ['system', ...types]) {
  const url = new URL('../../web/current/js/enemies/' + file + '.js', import.meta.url);
  vm.runInNewContext(readFileSync(url, 'utf8'), {window});
}
const system = window.HOJA_ENEMIES;

test('registers the original sprite sheets in order and binds the matching body', () => {
  const textures = [];
  system.registerTextures((...args)=>textures.push(args),(...args)=>textures.push(args));
  assert.deepEqual(textures.map(row=>row[0]), [
    'jumpyIdle','jumpyLeap','owlIdle','owlFly','hermieCrawl','hermieShell','roachRun','blankeyFloat',
    'balloonFly','martianIdle','martianRun','robotIdle','robotMove','robotHurt','circuitIdle','circuitRun','balloonStatic'
  ]);
  assert.deepEqual(textures.find(row=>row[0] === 'robotMove'), ['robotMove','enRobotMove',32,32]);
  assert.deepEqual(textures.at(-1), ['balloonStatic','enBalloonStatic']);
  assert.equal(system.types.BALLOONEY.body.h, 50);
});

const samples = [
  ['JUMPY','IDLE','AIR',87,-312,'jumpyLeap'],
  ['OWL','PERCH','RISE',0,0,'owlFly'],
  ['HERMIE','GO','STOP',35,0,'hermieCrawl'],
  ['ROACH','PATROL','FLEE',-47,0,'roachRun'],
  ['BLANKEY','FLOAT','CHASE',46,0,'blankeyFloat'],
  ['MARTIAN','PATROL','ALERT',0,-150,'martianIdle'],
  ['ROBOT','STUN','PATROL',0,0,'robotHurt'],
  ['CIRCUIT','PATROL','MIRROR',80,0,'circuitRun'],
  ['BALLOONEY','IDLE','QUESTION',0,0,'balloonStatic']
];
for (const [type, initial, state, vx, vy, expectedTexture] of samples) {
  test(type + ' enters the expected state, moves and selects its sprite', () => {
    const body = {
      bottom:100,center:{y:85},velocity:{x:0,y:0},blocked:{down:true},touching:{},
      setVelocity(x,y){this.velocity={x,y};},setVelocityX(x){this.velocity.x=x;},setVelocityY(y){this.velocity.y=y;},
      setAccelerationY(){},setAllowGravity(){},setAcceleration(){}
    };
    const sprite = {setPosition(){return this;},setFlipX(){return this;},setAlpha(){return this;},
      setTexture(key){this.texture=key;return this;}};
    const enemy = {type,alive:true,bodyObj:{body,x:50,y:85},sprite,state:initial,step:0,dir:1,timer:1,
      min:0,max:100,baseY:100,phase:0,stationary:true};
    const scene = {enemies:[enemy],playerBody:{x:70,body:{bottom:100,velocity:{x:100}}},facing:1,
      ledgeAhead:()=>false,shouldTurnAround:()=>false,telegraphEnemy(){}};
    const cues = new Proxy({}, {get:()=>()=>{}});
    system.update(scene, 200, 16, false, cues, ()=>false);
    assert.equal(enemy.state, state);
    assert.deepEqual(body.velocity, {x:vx,y:vy});
    assert.equal(sprite.texture, expectedTexture);
    assert.equal(enemy.step, 1);
  });
}
