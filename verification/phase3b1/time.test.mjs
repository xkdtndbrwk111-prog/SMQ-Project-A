import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../phase2/harness/node_modules/playwright/index.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('game initializes 900 seconds and applies configured palette and radar boundaries',async()=>{
 const dir=path.join(root,'dist-current-test');
 const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';const f=path.resolve(dir,name);if(!f.startsWith(dir+path.sep))throw Error('bad path');res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':name.endsWith('.ogg')?'audio/ogg':'text/html; charset=utf-8');res.end(await readFile(f))}catch{res.writeHead(404).end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{const page=await browser.newPage();await page.addInitScript(()=>sessionStorage.setItem('HOJA_TEST_PAUSE_START','1'));const info=JSON.parse(await readFile(path.join(dir,'BUILD.json'),'utf8'));const q=new URLSearchParams({m:'s',c:'test-joseon-a',cv:'19065b1d0fc5',gv:info.gameVersion,s:'spring'});
 await page.goto(`http://127.0.0.1:${server.address().port}/play.html?${q}`,{waitUntil:'load'});await page.locator('#hojaStudentStart:not([disabled])').click({timeout:30000});const frame=page.frames().find(x=>x.url().includes('/arcade.html'));await frame.waitForFunction(()=>!!window.HOJA_TEST_PROBE?.state(),null,{timeout:30000});
 const info900=await frame.evaluate(()=>({settings:window.HOJA_TEST_PROBE.timeSettings(),state:window.HOJA_TEST_PROBE.state(),a:window.HOJA_TEST_PROBE.palette(200001),b:window.HOJA_TEST_PROBE.palette(200000),c:window.HOJA_TEST_PROBE.palette(100001),d:window.HOJA_TEST_PROBE.palette(100000),policy600:window.HOJA_TEST_PROBE.timePolicy(600)}));
 assert.equal(info900.state.sec,900);assert.deepEqual(info900.settings,{durationSeconds:900,sunsetSeconds:200,nightSeconds:100,guideSeconds:100});assert.deepEqual([info900.a,info900.b,info900.c,info900.d],[0,1,8,9]);assert.deepEqual(info900.policy600,{durationSeconds:600,sunsetSeconds:133,nightSeconds:67,guideSeconds:67});
 await frame.evaluate(()=>window.HOJA_TEST_PROBE.setDuration(600));await frame.waitForFunction(()=>window.HOJA_TEST_PROBE.state()?.sec===600,null,{timeout:30000});assert.equal((await frame.evaluate(()=>window.HOJA_TEST_PROBE.timeSettings())).guideSeconds,67);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
