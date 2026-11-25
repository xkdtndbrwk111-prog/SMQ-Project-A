import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from '../phase2/harness/node_modules/playwright/index.mjs';
const root=path.resolve(fileURLToPath(new URL('../../dist-current-test/',import.meta.url)));
test('step flame and occupied lifts in Maker runtime',async()=>{
 const server=createServer(async(req,res)=>{try{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname));if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp'})[path.extname(f)]||'text/html');res.end(await readFile(f))}catch{res.writeHead(404).end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
  const p=await browser.newPage({viewport:{width:1440,height:900}});p.on('dialog',d=>d.accept());await p.goto(`http://127.0.0.1:${server.address().port}/maker-compat.html`);await p.locator('#newProject').click();
  await p.getByRole('button',{name:'장치',exact:true}).click();
  for(const id of ['sinking','rising','g_flame','g_reactive_flame'])assert.equal(await p.locator(`#catalog [data-type="${id}"]`).count(),1,id);
  for(const type of ['sinking','rising']){
   await p.evaluate(type=>{const m=map();m.height=64;m.spawn={x:24,y:16};m.terrain=[{id:'floor',x:0,y:60,w:128,h:4,kind:'ground'}];m.objects=[{id:'lift',type,x:22,y:20,w:4,h:1,sinkDepth:16,sinkSpeed:100,returnSpeed:100}];refresh()},type);
   const [game]=await Promise.all([p.waitForEvent('popup'),p.locator('#play').click()]);game.on('pageerror',e=>console.log('GAME ERROR',e.message));await game.waitForFunction(()=>window.HOJA_TEST_PROBE?.sinkPlatformInfo().length===1,null,{timeout:30000});await game.bringToFront();
   await game.waitForFunction(type=>{const x=HOJA_TEST_PROBE.sinkPlatformInfo()[0];return x.occupied&&(type==='sinking'?x.top>x.base+100:x.top<x.base-100)},type,{timeout:10000});
   const info=await game.evaluate(()=>HOJA_TEST_PROBE.sinkPlatformInfo()[0]);assert.equal(info.texture,type==='rising'?'hojaRisePlatform':'hojaSinkPlatform');assert.equal(info.active,true);
   await game.keyboard.down('d');await game.waitForFunction(()=>!HOJA_TEST_PROBE.sinkPlatformInfo()[0].occupied,null,{timeout:5000});await game.keyboard.up('d');await game.waitForFunction(()=>Math.abs(HOJA_TEST_PROBE.sinkPlatformInfo()[0].top-HOJA_TEST_PROBE.sinkPlatformInfo()[0].base)<2,null,{timeout:7000});assert.equal((await game.evaluate(()=>HOJA_TEST_PROBE.sinkPlatformInfo()[0])).active,true);await game.close();
  }
  await p.evaluate(()=>{const m=map();m.height=40;m.spawn={x:21,y:16};m.terrain=[{id:'floor',x:0,y:22,w:128,h:3,kind:'ground'}];m.objects=[{id:'fire',type:'gimmick',x:20,y:18,w:6,h:4,gimmick:{kind:'flame',activation:'on_step',wait:0,warn:2400,active:3000,cool:900,length:5}}];refresh()});
  const [game]=await Promise.all([p.waitForEvent('popup'),p.locator('#play').click()]);game.on('pageerror',e=>console.log('GAME ERROR',e.message));await game.waitForFunction(()=>window.HOJA_TEST_PROBE?.reactiveFlameInfo().length===1,null,{timeout:30000});await game.bringToFront();await game.waitForFunction(()=>HOJA_TEST_PROBE.reactiveFlameInfo()[0].phase==='warn',null,{timeout:10000});
  const samples=await game.evaluate(async()=>{const a=[];while(true){const f=HOJA_TEST_PROBE.reactiveFlameInfo()[0];if(f.phase!=='warn')return a;a.push({ms:f.ms,button:f.button});await new Promise(r=>setTimeout(r,45))}});
  const count=(min,max)=>samples.filter(x=>x.ms>=min&&x.ms<max).reduce((a,x,i,arr)=>a+(i>0&&x.button!==arr[i-1].button?1:0),0);assert.ok(count(1400,2300)>count(100,1000),'blink accelerates');
  assert.equal((await game.evaluate(()=>HOJA_TEST_PROBE.reactiveFlameInfo()[0])).phase,'active');await game.waitForFunction(()=>HOJA_TEST_PROBE.wallDiagnostic().dying,null,{timeout:5000});await game.close();
  await p.evaluate(()=>{const m=map();m.objects.push({id:'robot',type:'enemy',enemyType:'ROBOT',x:24,y:20,w:2,h:2});refresh()});
  const [enemyGame]=await Promise.all([p.waitForEvent('popup'),p.locator('#play').click()]);enemyGame.on('pageerror',e=>console.log('GAME ERROR',e.message));await enemyGame.waitForFunction(()=>window.HOJA_TEST_PROBE?.reactiveFlameInfo().length===1&&HOJA_TEST_PROBE.flameEnemies().length>0,null,{timeout:30000});await enemyGame.bringToFront();await enemyGame.waitForFunction(()=>HOJA_TEST_PROBE.reactiveFlameInfo()[0].phase==='warn',null,{timeout:10000});await enemyGame.evaluate(()=>HOJA_TEST_PROBE.moveVisual(200,300));
  assert.equal((await enemyGame.evaluate(()=>HOJA_TEST_PROBE.flameEnemies())).find(e=>e.type==='ROBOT').alive,true);
  await enemyGame.waitForFunction(()=>HOJA_TEST_PROBE.reactiveFlameInfo()[0].phase==='active',null,{timeout:6000});await enemyGame.evaluate(()=>HOJA_TEST_PROBE.placeFlameEnemy('ROBOT',368,305));await enemyGame.waitForFunction(()=>HOJA_TEST_PROBE.flameEnemies().some(e=>e.type==='ROBOT'&&!e.alive),null,{timeout:6000});await enemyGame.close();
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
});
