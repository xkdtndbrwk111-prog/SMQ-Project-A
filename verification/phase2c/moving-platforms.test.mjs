import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const window = {};
vm.runInNewContext(readFileSync(new URL('../../web/current/js/moving-platforms.js', import.meta.url),'utf8'),{window});
const system = window.HOJA_CREATE_MOVING_PLATFORMS({TILE:16,HOJA_MAKER_IMAGES:new Map(),hojaV2CaveRow:()=>0,HOJA_V2_SURFACE_START:{spring:0},HOJA_V2_ATLAS_COLS:16,HOJA_CAVE_AMBIENT_TINT:0xffffff});

test('fixed 16ms platform frames turn at bounds, sync art, and recreate per stage',()=>{
 const groups=[];
 function body(){
  const b={vx:0,vy:0,friction:{},setAllowGravity(){},setImmovable(){},setVelocity(x,y){this.vx=x;this.vy=y}};
  return b;
 }
 const scene={textures:{exists:()=>false},anims:{},physics:{add:{group:()=>{const g={children:[],add(x){this.children.push(x)}};groups.push(g);return g},existing(o){o.body=body()}}},
  add:{rectangle(x,y){return {x,y}},image(){return {setDepth(){return this},setTint(){return this},setPosition(x,y){this.x=x;this.y=y}}}}};
 const cfg={x:0,y:100,w:32,h:16,axis:'x',min:0,max:64,speed:100};
 const options={MOVING_PLATFORMS:[cfg],HOJA_MAKER_MODE:false,STAGE:{theme:'spring'},THEME:{terrain:'ground'},HOJA_V2_RENDER:false};
 system.createMovingPlatforms(scene,options);
 const p=scene.movingPlatforms[0];
 for(let i=0;i<40;i++){system.updateMovingPlatforms(scene);p.bodyObj.x+=p.bodyObj.body.vx*.016;}
 assert.ok(p.bodyObj.x>=16 && p.bodyObj.x<=48.01);
 assert.equal(p.dir,-1);
 assert.equal(p.tiles[0].image.x.toFixed(6),(p.bodyObj.x-16+8-p.bodyObj.body.vx*.016).toFixed(6));
 system.createMovingPlatforms(scene,options);
 assert.equal(groups.length,2);
 assert.notEqual(scene.movingPlatforms[0],p);
 assert.equal(scene.movingPlatformGroup,groups[1]);
});

test('waypoint path reverses at ends and loop proceeds from its last point',()=>{
 const scene={movingPlatforms:[{cfg:{w:16,h:16,speed:30,pathMode:'pingpong',waypoints:[{x:0,y:0},{x:30,y:0}]},bodyObj:{x:38,y:8,body:{setVelocity(x,y){this.vx=x;this.vy=y}}},tiles:[]}]};
 const p=scene.movingPlatforms[0];
 system.updateMovingPlatforms(scene);
 assert.equal(p.pathIndex,0);
 assert.equal(p.bodyObj.body.vx,0);
 system.updateMovingPlatforms(scene);
 assert.equal(p.bodyObj.body.vx,-30);
 p.cfg.pathMode='loop';p.pathIndex=1;p.bodyObj.x=38;
 system.updateMovingPlatforms(scene);
 assert.equal(p.pathIndex,0);
});
