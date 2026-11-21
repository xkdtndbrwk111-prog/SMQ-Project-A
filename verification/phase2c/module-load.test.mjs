import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '../phase2/harness/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dir=fileURLToPath(new URL('../../dist-current/',import.meta.url));
test('missing raft module produces visible specific startup error',async()=>{
 const server=createServer(async(req,res)=>{
  try {
   const name=new URL(req.url,'http://127.0.0.1').pathname.slice(1);
   const target=path.resolve(dir,name);
   if(!target.startsWith(dir))throw Error('bad path');
   const data=await readFile(target);
   res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');
   res.end(data);
  } catch {res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try {
  const page=await browser.newPage();
  await page.route(/\/js\/rafts\.js(?:\?.*)?$/,route=>route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+'/arcade.html',{waitUntil:'load'});
  const error=page.locator('#bootError');
  await error.waitFor({state:'visible',timeout:30000});
  assert.match(await error.innerText(),/HOJA_CREATE_RAFTS/);
  await page.unroute(/\/js\/rafts\.js(?:\?.*)?$/);
  await page.route(/\/js\/parent-services\.js(?:\?.*)?$/,route=>route.abort());
  for(const name of ['index.html','play.html']){
   await page.goto('http://127.0.0.1:'+server.address().port+'/'+name,{waitUntil:'load'});
   const alert=page.getByRole('alert');
   await alert.waitFor({state:'visible',timeout:30000});
   assert.match(await alert.innerText(),/HOJA_B_LIVE/);
  }

 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});
