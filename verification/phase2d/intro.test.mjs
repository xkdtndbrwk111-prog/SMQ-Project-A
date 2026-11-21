import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('shared intro is the original synchronous script at the original position',()=>{
 const baseline=execFileSync('git',['show','7b599b7:web/current/index.html'],{cwd:root,maxBuffer:8*1024*1024,encoding:'utf8'});
 const match=baseline.match(/<script>\n("use strict";\n\/\/ HOJA STEP13-7 SHARED PHASER SNAPSHOT[\s\S]*?)<\/script>/);
 assert.ok(match);assert.equal(readFileSync(root+'web/current/js/intro-shared.js','utf8'),match[1]);
 for(const name of ['index','play']){
  const html=readFileSync(root+'web/current/'+name+'.html','utf8');
  assert.ok(html.indexOf('<script src="js/intro-shared.js"></script>')>html.indexOf('id="nahanModeWalk"'));
  assert.ok(html.indexOf('<script src="js/intro-shared.js"></script>')<html.indexOf('<script id="hojaV053MusicSession">'));
  assert.match(html,/typeof makeHojaCanvas!==.function./);
 }
});
