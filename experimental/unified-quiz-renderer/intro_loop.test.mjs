import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import vm from 'node:vm';
const source=readFileSync(new URL('./game-trial/part-22.txt',import.meta.url),'utf8');
const start=source.indexOf('window.HOJA_TRIAL_SCENE_AUDIO=(()=>{');
const end=source.indexOf('\n\nwindow.HOJA_ARCADE_APPROVED_TRIAL=',start);
assert.ok(start>=0&&end>start);
function fixture(){
 const events=new EventEmitter(),ops=[];let paused=false,running=true;const calls=[];
 const scene={events,pausedByUser:false,scene:{isPaused:()=>paused,pause:()=>{calls.push('queue-pause');ops.push('pause')},resume:()=>{calls.push('queue-resume');ops.push('resume')}}};
 const loop={sleep:()=>{calls.push('sleep');running=false},wake:()=>{calls.push('wake');running=true}};
 const window={HOJA_ATTRACT_SCENE:scene,HOJA_ATTRACT_GAME:{loop},HOJA_FLOW:{enterIntro(){calls.push('intro')}}};
 vm.runInNewContext(source.slice(start,end),{window,console});
 function tick(){while(ops.length){let op=ops.shift();paused=op==='pause';calls.push('apply-'+op);if(paused)events.emit('pause')}}
 return {window,scene,calls,tick,get paused(){return paused},get running(){return running},events};
}
test('sleep follows applied scene pause and repeated suspend is idempotent',()=>{
 const f=fixture();f.window.HOJA_TRIAL_SCENE_AUDIO.suspendAttract();f.window.HOJA_TRIAL_SCENE_AUDIO.suspendAttract();
 assert.equal(f.running,true);assert.deepEqual(f.calls,['queue-pause']);f.tick();
 assert.equal(f.paused,true);assert.equal(f.running,false);assert.deepEqual(f.calls,['queue-pause','apply-pause','sleep']);
 f.window.HOJA_FLOW.enterIntro();assert.equal(f.running,true);f.tick();assert.equal(f.paused,false);assert.equal(f.events.listenerCount('pause'),0);
});
test('immediate return cancels pending sleep and queues ordered resume',()=>{
 const f=fixture();f.window.HOJA_TRIAL_SCENE_AUDIO.suspendAttract();f.window.HOJA_FLOW.enterIntro();f.tick();
 assert.equal(f.running,true);assert.equal(f.paused,false);assert.equal(f.calls.includes('sleep'),false);assert.equal(f.events.listenerCount('pause'),0);
});
test('user pause remains respected while intro loop wakes',()=>{
 const f=fixture();f.window.HOJA_TRIAL_SCENE_AUDIO.suspendAttract();f.tick();f.scene.pausedByUser=true;f.window.HOJA_FLOW.enterIntro();f.tick();
 assert.equal(f.running,true);assert.equal(f.paused,true);
});
