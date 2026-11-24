#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
globalThis.window=globalThis;
await import('../../web/current/js/gimmicks/model.js');
await import('./fragment-system.js');
const [command,...paths]=process.argv.slice(2);
try{
 if(!['validate','compile'].includes(command)||!paths.length)throw Error('사용법: node tools/maker_fragments/cli.mjs validate|compile 조각.json [...]');
 const fragments=await Promise.all(paths.map(async p=>JSON.parse(await readFile(p,'utf8'))));
 if(command==='validate'){for(const f of fragments)HOJA_FRAGMENT_SYSTEM.validate(f);console.log(`PASS: ${fragments.length}개 조각`)}
 else console.log(JSON.stringify(HOJA_FRAGMENT_SYSTEM.compile(fragments),null,2));
}catch(e){console.error('FAIL:',e.message);process.exitCode=1}
