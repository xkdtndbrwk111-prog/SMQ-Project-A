import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../phase2/harness/node_modules/playwright/index.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=path.join(root,'dist-current-test');
test('seasonal scenery, vertical parallax and lowered water preserve gameplay bounds',async()=>{
 const server=createServer(async(req,res)=>{try{const n=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html',f=path.resolve(dir,n);if(!f.startsWith(dir+path.sep))throw Error('path');res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.png':'image/png','.ogg':'audio/ogg'})[path.extname(f)]||'text/html');res.end(await readFile(f));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{const page=await browser.newPage({viewport:{width:1280,height:720}});await page.addInitScript(()=>sessionStorage.setItem('HOJA_TEST_SEED','314159'));const b=JSON.parse(await readFile(path.join(dir,'BUILD.json'),'utf8')),q=new URLSearchParams({m:'s',c:'test-joseon-a',cv:'19065b1d0fc5',gv:b.gameVersion,s:'spring'});await page.goto(`http://127.0.0.1:${server.address().port}/play.html?${q}`);await page.locator('#hojaStudentStart:not([disabled])').click({timeout:30000});await page.frameLocator('#hqArcadeFrame').locator('#scoreHud').waitFor({state:'visible',timeout:30000});const f=page.frames().find(x=>x.url().includes('/arcade.html'));await f.waitForFunction(()=>!!window.HOJA_TEST_PROBE?.state());await f.addStyleTag({content:'#hojaTestControls,#hojaTestDialogueControls{display:none!important}'});
 const screenshotDir=path.join(root,'verification/phase4c/screenshots/season-regression');await mkdir(screenshotDir,{recursive:true});let waterCount=0;
 for(const [stage,name] of [[0,'spring'],[1,'autumn'],[2,'tropics'],[3,'winter']]){
  await f.evaluate(i=>window.HOJA_TEST_PROBE.phase4bStage(i,'start'),stage);await f.waitForTimeout(650);await f.evaluate(()=>window.HOJA_TEST_PROBE.freezeCover());
  const result=await f.evaluate(()=>({layers:window.HOJA_TEST_PROBE.visualAt(0),water:window.HOJA_TEST_PROBE.waterInfo()}));
  for(const w of result.water.visuals){waterCount++;assert.equal(w.surfaceY,w.physicsSurfaceY,'visual is 16px below the previous lower-bank waterline');assert.equal(w.surfaceY,Math.max(w.leftTop,w.rightTop)+16);assert.ok(w.backLeft<w.leftX&&w.backRight>w.rightX,'water extends behind both banks');}
  for(const layer of result.layers){if(['bgHills','bgForeground','thTroWaters','thWinHills','thWinFore'].includes(layer.key)){assert.ok(layer.tileY>0);assert.ok(layer.texture.startsWith('hojaRaisedBackground_'));assert.equal(layer.sourceHeight,416);}else assert.equal(layer.tileY,0);}
  const initial=result.layers;const later=await f.evaluate(()=>window.HOJA_TEST_PROBE.visualAt(10000));for(const layer of initial){const next=later.find(x=>x.key===layer.key);assert.equal(next.y,layer.y);if(layer.drift)assert.ok(Math.abs(next.x-layer.x-layer.drift*10)<0.01);}
  await f.locator('#gameViewport').screenshot({path:path.join(screenshotDir,`${name}-ground.png`)});
  await f.evaluate(()=>window.HOJA_TEST_PROBE.moveVisual(600,300));const high=await f.evaluate(()=>window.HOJA_TEST_PROBE.visualAt(0));for(const l of high)assert.ok(Number.isFinite(l.y));await f.locator('#gameViewport').screenshot({path:path.join(screenshotDir,`${name}-high.png`)});
  if(result.water.visuals.length){const w=result.water.visuals[0];await f.evaluate(({x,y})=>window.HOJA_TEST_PROBE.moveVisual(x,y),{x:(w.leftX+w.rightX)/2,y:w.surfaceY+90});await f.locator('#gameViewport').screenshot({path:path.join(screenshotDir,`${name}-water.png`)});}
  await page.setViewportSize({width:960,height:540});await f.waitForTimeout(300);const resized=await f.evaluate(()=>window.HOJA_TEST_PROBE.visualAt(10000));for(const layer of resized){const previous=initial.find(x=>x.key===layer.key);assert.equal(layer.tileY,previous.tileY);assert.equal(layer.texture,previous.texture);}await f.locator('#gameViewport').screenshot({path:path.join(screenshotDir,`${name}-resized.png`)});await page.setViewportSize({width:1280,height:720});
  await f.evaluate(i=>window.HOJA_TEST_PROBE.phase4bStage(i,'start'),stage);await f.waitForTimeout(350);const reentry=await f.evaluate(()=>window.HOJA_TEST_PROBE.visualAt(0));for(const layer of reentry){const previous=initial.find(x=>x.key===layer.key);assert.equal(layer.tileY,previous.tileY);assert.equal(layer.texture,previous.texture);}
 }
 assert.ok(waterCount>0,'real generated maps contain water gaps');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
