import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '../phase2/harness/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../../',import.meta.url));
test('hidden cave cover masks bank edges and restores water occlusion on entry',async()=>{
 const dir=path.join(root,'dist-current-test');
 const server=createServer(async(req,res)=>{
  try {
   const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\//,'')||'index.html';
   const file=path.resolve(dir,name);
   if(!file.startsWith(dir+path.sep))throw Error('invalid path');
   const data=await readFile(file);
   res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':'text/html; charset=utf-8');
   res.end(data);
  } catch {res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  await page.addInitScript(()=>sessionStorage.setItem('HOJA_TEST_SEED','314159'));
  const info=JSON.parse(await readFile(path.join(dir,'BUILD.json'),'utf8'));
  const params=new URLSearchParams({m:'s',c:'test-joseon-a',cv:'19065b1d0fc5',gv:info.gameVersion,s:'spring'});
  await page.goto('http://127.0.0.1:'+server.address().port+'/play.html?'+params,{waitUntil:'load'});
  await page.locator('#hojaStudentStart:not([disabled])').click({timeout:30000});
  const frame=page.frameLocator('#hqArcadeFrame');
  await frame.locator('#scoreHud').waitFor({state:'visible',timeout:30000});
  const game=page.frames().find(f=>f.url().includes('/arcade.html'));
  await game.waitForFunction(()=>!!window.HOJA_TEST_PROBE?.state(),null,{timeout:30000});
  const [site]=await game.evaluate(()=>window.HOJA_TEST_PROBE.coverSites());
  assert.ok(site);
  const position=async y=>game.evaluate(({x,y})=>window.HOJA_TEST_PROBE.moveForCover(x,y),{x:(site.a+site.b)/2,y});
  await position(site.floor-120);
  await game.waitForFunction(()=>window.HOJA_TEST_PROBE.coverInfo()[0]?.alpha===1,null,{timeout:10000});
  const closed=await game.evaluate(()=>({cover:window.HOJA_TEST_PROBE.coverInfo()[0],banks:window.HOJA_TEST_PROBE.bankInfo()}));
  assert.equal(closed.cover.transparent,0);
  const intersects=(r,c)=>r.x<c.x+c.w&&r.x+r.w>c.x&&r.y<c.y+c.h&&r.y+r.h>c.y;
  const overlapping=closed.banks.filter(bank=>intersects(bank,closed.cover));
  assert.ok(overlapping.length>0,'fixed seed has cave cover and water-bank overlap');
  assert.ok(overlapping.every(bank=>bank.depth===11.4),'covered bank segments render beneath the facade');
  assert.ok(closed.banks.filter(bank=>!intersects(bank,closed.cover)).every(bank=>bank.depth===12.5),'other bank segments remain in front of the player');
  await position(site.floor+120);
  await game.waitForFunction(()=>window.HOJA_TEST_PROBE.coverInfo()[0]?.alpha===0,null,{timeout:10000});
  const entered=await game.evaluate(()=>window.HOJA_TEST_PROBE.bankInfo());
  assert.ok(entered.filter(bank=>intersects(bank,closed.cover)).every(bank=>bank.depth===12.5),'water occlusion returns when the cave is open');
  await position(site.floor-120);
  await game.waitForFunction(()=>window.HOJA_TEST_PROBE.coverInfo()[0]?.alpha===1,null,{timeout:10000});
  const restored=await game.evaluate(()=>window.HOJA_TEST_PROBE.bankInfo());
  assert.ok(restored.filter(bank=>intersects(bank,closed.cover)).every(bank=>bank.depth===11.4));
  await game.evaluate(()=>window.HOJA_TEST_PROBE.freezeCover());
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});
