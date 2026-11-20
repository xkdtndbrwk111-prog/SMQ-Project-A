import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const window={};
vm.runInNewContext(readFileSync(new URL('../../web/current/js/crumbles.js',import.meta.url),'utf8'),{window,Math});

test('16ms collapse warning, removal, occupied recovery block, and regrowth',()=>{
 let start=0,warning=0;
 const system=window.HOJA_CREATE_CRUMBLES({TILE:16,HOJA_V2_SURFACE_START:{autumn:4},HOJA_V2_ATLAS_COLS:22,SFX:{crumble(){start++},crumbleWarning(){warning++}}});
 const pb={left:4,right:20,top:58,bottom:100,blocked:{down:true},touching:{down:false}};
 const images=[];
 const scene={playerBody:{body:pb},add:{rectangle(){return {}},image(){const a={setDepth(){return this},setTint(){return this},setPosition(){return this},setAngle(){return this},setAlpha(){return this}};images.push(a);return a}},
  physics:{add:{staticGroup(){return {add(){}}},existing(obj){obj.body={enable:true}}}},
  tweens:{add(){}},emitLeaf(){}};
 const options={CRUMBLES:[{x:0,y:100,w:32,h:16}],STAGE:{theme:'autumn'},THEME:{terrain:'terrain'},HOJA_V2_RENDER:false};
 system.createCrumbles(scene,options);
 const item=scene.crumbles[0];
 system.updateCrumbles(scene,16);
 assert.equal(item.state,'shake');assert.equal(start,1);
 for(let i=0;i<33;i++) system.updateCrumbles(scene,16);
 assert.equal(warning,1);assert.equal(item.state,'gone');assert.equal(item.body.body.enable,false);
 for(let i=0;i<210;i++) system.updateCrumbles(scene,16);
 assert.equal(item.state,'gone');
 pb.left=100;pb.right=116;
 system.updateCrumbles(scene,16);
 assert.equal(item.state,'idle');assert.equal(item.body.body.enable,true);
 system.createCrumbles(scene,options);
 assert.notEqual(scene.crumbles[0],item);
});
