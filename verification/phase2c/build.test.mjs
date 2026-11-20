import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, cp, mkdir, writeFile, readFile, readdir, rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {after} from 'node:test';
import {rm} from 'node:fs/promises';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('complete distribution hashes, version changes and safe retirement of generated files', async () => {
 const temp = await mkdtemp(path.join(tmpdir(), 'hoja-current-build-'));
 after(() => rm(temp, {recursive:true, force:true}));
 const source = path.join(temp,'web/current');
 await mkdir(path.join(temp,'tools'), {recursive:true});
 for(const file of ['build_current.mjs','current-test-probe.mjs','current-baseline-hashes.json']) {
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
 const entries = await readdir(output,{recursive:true,withFileTypes:true});
 const names = entries.filter(e => e.isFile() && e.name !== 'BUILD.json')
   .map(e => path.relative(output, path.join(e.parentPath,e.name)));
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
});
