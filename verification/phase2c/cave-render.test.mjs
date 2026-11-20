import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {caveRenderTestSource,caveRenderProductionSource} from '../../tools/current-test-cave-render.mjs';

function run(source,theme,isCurrent){
 const item=(active,bounds,visible=true)=>({active,visible,getBounds:()=>bounds,setVisible(value){this.visible=value}});
 const collisions=[item(true,{}),item(false,{},false)];
 const scenery=[item(true,{left:0,right:12,top:0,bottom:12},false),item(true,{left:40,right:50,top:0,bottom:10}),item(false,{left:0,right:5,top:0,bottom:5},false)];
 const scene={hojaStep136CollisionOnly:collisions,hojaStep136Cullables:scenery};
 const context=vm.createContext({ACTIVE_SCENE:isCurrent?scene:{},STAGE:{theme},document:{querySelectorAll:()=>[]}});
 vm.runInContext(source+'\nthis.systems={camera:HOJA_STEP134_DIAG,tiles:HOJA_STEP135_DIAG,cull:HOJA_STEP136_DIAG};',context);
 context.systems.camera.resetOnStageChange();
 context.systems.cull.applyVisibility(scene,{L:0,R:20,T:0,B:20});
 return {collisions:collisions.map(x=>x.visible),scenery:scenery.map(x=>x.visible),
  hiddenTerrain:context.systems.tiles.isTerrainHidden(scene),hiddenExtra:context.systems.tiles.isExtraHidden(scene,scenery[0])};
}

test('production cave culler matches prior default for active, inactive and non-cave scenes',()=>{
 for(const [theme,isCurrent] of [['cave',true],['cave',false],['winter',true]]){
  assert.deepEqual(run(caveRenderProductionSource,theme,isCurrent),run(caveRenderTestSource,theme,isCurrent));
 }
 assert.deepEqual(run(caveRenderProductionSource,'cave',true),{
  collisions:[false,false],scenery:[true,false,false],hiddenTerrain:false,hiddenExtra:false
 });
});
