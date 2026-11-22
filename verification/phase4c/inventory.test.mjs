import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('./runtime-inventory.json',import.meta.url),'utf8'));
test('runtime records include the required seeds, stages, checkpoints and five questions per stage',()=>{
 assert.deepEqual(data.seeds.map(s=>s.seed),[0,1,42,999,2026,41805,314159,4294967295]);
 for(const run of data.seeds){assert.deepEqual(run.stages.map(s=>s.theme),['grassland','autumn','tropics','winter','cave']);for(const stage of run.stages){assert.equal(stage.seed,run.seed);assert.equal(stage.questions.length,5);assert.equal(stage.checkpoints.length,stage.theme==='cave'?6:3);assert.ok(stage.enemies.length>0);assert.ok(stage.enemies.every(e=>e.body.w>0&&e.body.h>0&&Number.isFinite(e.x)&&Number.isFinite(e.y)));}}
});
test('natural keyboard evidence is bounded and does not claim a completed route',async()=>{
 const r=JSON.parse(await readFile(new URL('./natural-keyboard-attempt.json',import.meta.url),'utf8'));assert.equal(r.seed,314159);assert.ok(r.trace.length>1);assert.ok(['three deaths','clear','time up','80-action limit','90-second limit'].includes(r.stopReason));if(r.stopReason!=='clear')assert.ok(!r.trace.some(x=>x.clear));
});
