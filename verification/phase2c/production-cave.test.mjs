import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from '../phase2/harness/node_modules/playwright/index.mjs';
import {instrumentArcade} from '../../tools/current-test-probe.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
test('production cave culling creates and runs its default rendering path',async()=>{
 const dir=path.join(root,'dist-current-test');
 const source=await readFile(path.join(root,'web/current/arcade.html'),'utf8');
 const arcade=instrumentArcade(source,{keepProductionCave:true});
 const server=createServer(async(req,res)=>{
  try {
   const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\//,'')||'index.html';
   const file=path.resolve(dir,name);
   if(!file.startsWith(dir+path.sep))throw Error('invalid path');
   const data=name==='arcade.html'?Buffer.from(arcade):await readFile(file);
   res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':'text/html; charset=utf-8');
   res.end(data);
  } catch {res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try {
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.addInitScript(()=>{sessionStorage.setItem('HOJA_TEST_SEED','314159');window.HOJA_V047_FOV_SOFT=false;window.HOJA_V046_PREFERRED_VISION='probe';});
  const info=JSON.parse(await readFile(path.join(dir,'BUILD.json'),'utf8'));
  const params=new URLSearchParams({m:'s',c:'test-joseon-a',cv:'19065b1d0fc5',gv:info.gameVersion,s:'spring'});
  await page.goto('http://127.0.0.1:'+server.address().port+'/play.html?'+params,{waitUntil:'load'});
  await page.locator('#hojaStudentStart:not([disabled])').click({timeout:30000});
  const frame=page.frameLocator('#hqArcadeFrame');
  await frame.locator('#scoreHud').waitFor({state:'visible',timeout:30000});
  const game=page.frames().find(f=>f.url().includes('/arcade.html'));
  await game.waitForFunction(()=>!!window.HOJA_TEST_PROBE?.state(),null,{timeout:30000});
  await game.evaluate(()=>window.HOJA_TEST_PROBE.stage(4));
  await game.waitForFunction(()=>window.HOJA_TEST_PROBE.caveRenderState().stage===4 && window.HOJA_TEST_PROBE.caveRenderState().culled>0,null,{timeout:30000});
  await page.waitForTimeout(400);
  const result=await game.evaluate(()=>window.HOJA_TEST_PROBE.caveRenderState());
  assert.equal(result.stage,4);
  assert.deepEqual(await game.evaluate(()=>window.HOJA_TEST_PROBE.caveSettings()),{mode:'terrain',soft:true},'production ignores diagnostic overrides');
  assert.ok(result.culled>0,'cave scenery is present');
  assert.ok(result.collision.every(visible=>!visible),'collision-only graphics are hidden');
  assert.deepEqual(errors,[]);
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});
