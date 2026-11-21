import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../../web/current/arcade.html',import.meta.url),'utf8');
const match=html.match(/^  updateFps\(time,delta\)\{\n[\s\S]*?^  }/m);
assert.ok(match,'production FPS update method');

function simulate({manual=false,scale=2,delta=40}={}){
 const calls=[];
 const context=vm.createContext({FPS_VISIBLE:true,QUALITY_MANUAL:manual,RS:scale,changeQualityMode:(...args)=>calls.push(args)});
 const scene=vm.runInContext('({fpsSamples:[],fpsShownAt:0,lowFpsWindows:0,\n'+match[0]+'})',context);
 for(let i=0;i<8;i++)scene.updateFps(5000+i*500,delta);
 return {calls,low:scene.lowFpsWindows,samples:scene.fpsSamples.length};
}
test('automatic quality still changes after six slow windows and respects manual and scale settings',()=>{
 assert.deepEqual(simulate().calls,[[1,false]]);
 assert.deepEqual(simulate({manual:true}).calls,[]);
 assert.deepEqual(simulate({scale:1}).calls,[]);
 assert.deepEqual(simulate({delta:16}).calls,[]);
});
