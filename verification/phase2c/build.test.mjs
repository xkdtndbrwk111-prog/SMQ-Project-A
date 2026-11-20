import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, cp, mkdir, writeFile, readFile, readdir, rename, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {after} from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('complete distribution hashes, version changes and safe retirement of generated files', async () => {
 const temp = await mkdtemp(path.join(tmpdir(), 'hoja-current-build-'));
 after(() => rm(temp, {recursive:true, force:true}));
 const source = path.join(temp,'web/current');
 await mkdir(path.join(temp,'tools'), {recursive:true});
 for(const file of ['build_current.mjs','current-test-probe.mjs','current-baseline-hashes.json','check_module_order.mjs','current-test-benchmarks.mjs']) {
   await cp(path.join(root,'tools',file), path.join(temp,'tools',file));
 }
 await cp(path.join(root,'web/current'), source, {recursive:true});
 function build() {
   return spawnSync(process.execPath, ['tools/build_current.mjs'], {cwd:temp, encoding:'utf8',
     env:{...process.env, HOJA_TEST_PROBE:'0'}});
 }
 const output = path.join(temp,'dist-current');
 const manifest = async () => JSON.parse(await readFile(path.join(output,'BUILD.json')));
 const added = 'js/retired.js';
 await writeFile(path.join(source,added),'// module');
 assert.equal(build().status,0);
 const first = await manifest();
 async function filesIn(dir) {
   const names = [];
   for (const entry of await readdir(dir, {withFileTypes:true})) {
     const full = path.join(dir, entry.name);
     if (entry.isDirectory()) names.push(...await filesIn(full));
     else names.push(path.relative(output, full));
   }
   return names;
 }
 const names = (await filesIn(output)).filter(name => name !== 'BUILD.json');
 assert.deepEqual(Object.keys(first.files).sort(),names.sort());
 for(const [name,entry] of Object.entries(first.files)) {
   const bytes=await readFile(path.join(output,name));
   assert.deepEqual(entry,{bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 await rename(path.join(source,added),path.join(source,'js/replacement.js'));
 await writeFile(path.join(output,added),'personal edit');
 assert.notEqual(build().status,0);
 assert.equal(await readFile(path.join(output,added),'utf8'),'personal edit');
 await writeFile(path.join(output,added),'// module');
 assert.equal(build().status,0);
 assert.notEqual((await manifest()).gameVersion,first.gameVersion);
 await assert.rejects(readFile(path.join(output,added)),{code:'ENOENT'});
 await writeFile(path.join(output,'personal.txt'),'keep');
 assert.notEqual(build().status,0);
 assert.equal(await readFile(path.join(output,'personal.txt'),'utf8'),'keep');
 await rm(path.join(output,'personal.txt'));
 const arcadePath=path.join(source,'arcade.html');
 const original=await readFile(arcadePath,'utf8');
 await writeFile(arcadePath,original.replace('<script src="js/arcade-host.js"></script>',''));
 assert.notEqual(build().status,0,'build refuses missing host script tag');
 await writeFile(arcadePath,original);
 const hostPath=path.join(source,'js/arcade-host.js');
 await rename(hostPath,hostPath+'.retired');
 assert.notEqual(build().status,0,'build refuses missing host script file');

});
