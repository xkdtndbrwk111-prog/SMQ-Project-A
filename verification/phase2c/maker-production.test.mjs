import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from '../phase2/harness/node_modules/playwright/index.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
test('production retains Maker import, map transition and return to base',async()=>{
 const dir=path.join(root,'dist-current');
 const server=createServer(async(req,res)=>{
  try {
   const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\//,'')||'index.html';
   const file=path.resolve(dir,name);
   if(!file.startsWith(dir+path.sep))throw Error('invalid path');
   res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':'text/html; charset=utf-8');
   res.end(await readFile(file));
  } catch {res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try {
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  const info=JSON.parse(await readFile(path.join(dir,'BUILD.json'),'utf8'));
  const params=new URLSearchParams({m:'s',c:'test-joseon-a',cv:'19065b1d0fc5',gv:info.gameVersion,s:'spring'});
  await page.goto('http://127.0.0.1:'+server.address().port+'/play.html?'+params,{waitUntil:'load'});
  await page.locator('#hojaStudentStart:not([disabled])').click({timeout:30000});
  await page.frameLocator('#hqArcadeFrame').locator('#scoreHud').waitFor({state:'visible',timeout:30000});
  const game=page.frames().find(f=>f.url().includes('/arcade.html'));
  const project={format:'HOJA_MAKER_PROJECT',schemaVersion:6101,title:'Test fixture',maps:['first','second'].map(id=>({id,name:id,width:32,height:24,theme:'grassland',spawn:{x:6,y:18},terrain:[{id:'floor',kind:'ground',x:0,y:22,w:32,h:2}],objects:[]}))};
  await game.evaluate(p=>window.HOJA_V061_IMPORT(p),project);
  assert.deepEqual(await game.evaluate(()=>window.HOJA_V061_STATUS()),{makerMode:true,stage:0,mapId:'first',project:'Test fixture'});
  await game.evaluate(()=>window.HOJA_V2_NEXT_STAGE());
  await game.waitForFunction(()=>window.HOJA_V061_STATUS().mapId==='second',null,{timeout:30000});
  assert.deepEqual(await game.evaluate(()=>window.HOJA_V061_STATUS()),{makerMode:true,stage:1,mapId:'second',project:'Test fixture'});
  await game.evaluate(()=>document.getElementById('v061ReturnBase').click());
  assert.equal((await game.evaluate(()=>window.HOJA_V061_STATUS())).makerMode,false);
  assert.deepEqual(errors,[]);
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});
