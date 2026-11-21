import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async name=>JSON.parse(await readFile(new URL(name,import.meta.url),'utf8'));
test('isolated rehearsal targets a demo-only, loopback and deny-all environment',async()=>{
 const plan=await read('scenarios.json'),config=await read('emulator/firebase.json');
 assert.match(plan.projectId,/^demo-/);
 assert.deepEqual(Object.keys(config.emulators).sort(),['auth','firestore','singleProjectMode','ui']);
 for(const name of ['auth','firestore'])assert.equal(config.emulators[name].host,'127.0.0.1');
 assert.equal(config.emulators.ui.enabled,false);
 assert.equal(config.firestore.rules,'firestore.rules');
 const rules=await readFile(new URL('emulator/firestore.rules',import.meta.url),'utf8');
 assert.match(rules,/allow read, write: if false/);
 assert.doesNotMatch(rules,/allow\s+\w+(?:\s*,\s*\w+)*\s*:\s*if\s+true/);
});
test('scenario inventory retains all critical categories without duplicate ids',async()=>{
 const plan=await read('scenarios.json'),ids=plan.scenarios.map(s=>s.id),areas=new Set(plan.scenarios.map(s=>s.area));
 assert.equal(ids.length,new Set(ids).size);
 for(const s of plan.scenarios)assert.ok(s.action&&s.expected);
 for(const name of ['isolation','access','joining','reconnect','settlement','timing','versions','regression','field'])assert.ok(areas.has(name),name);
});
