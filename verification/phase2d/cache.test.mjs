import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,cp,mkdir,readFile,appendFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from '../phase2/harness/node_modules/playwright/index.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('cached old scripts cannot mask changed content',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'hoja-cache-test-'));let server,browser;
 try{
  await mkdir(path.join(temp,'tools'),{recursive:true});
  for(const file of ['build_current.mjs','current-test-probe.mjs','current-baseline-hashes.json','check_module_order.mjs','current-test-benchmarks.mjs','current-test-cave-render.mjs','current-test-profiler.mjs','current-test-actions.mjs','current-test-controls.mjs','current-test-dialogue.mjs','current-test-control-methods.mjs','current-test-vision-metrics.mjs','current-test-fps.mjs'])await cp(path.join(root,'tools',file),path.join(temp,'tools',file));
  await cp(path.join(root,'web/current'),path.join(temp,'web/current'),{recursive:true});
  function build(){const r=spawnSync(process.execPath,['tools/build_current.mjs'],{cwd:temp,encoding:'utf8',env:{...process.env,HOJA_TEST_PROBE:'0'}});assert.equal(r.status,0,r.stderr)}
  build();const dir=path.join(temp,'dist-current');
  const seen=[];server=createServer(async(req,res)=>{try{
   const u=new URL(req.url,'http://127.0.0.1');const name=u.pathname.slice(1)||'index.html';const f=path.resolve(dir,name);if(!f.startsWith(dir+path.sep))throw Error('bad');
   if(name==='js/parent-services.js')seen.push(u.search);
   res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':name.endsWith('.ogg')?'audio/ogg':'text/html; charset=utf-8');
   res.setHeader('Cache-Control',name.endsWith('.html')?'no-cache':'public, max-age=3600');res.end(await readFile(f));
  }catch{res.writeHead(404).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
  const page=await browser.newPage();const url=`http://127.0.0.1:${server.address().port}/`;
  await page.goto(url,{waitUntil:'load'});const oldVersion=await page.evaluate(()=>window.HOJA_BUILD.gameVersion);
  assert.equal(await page.evaluate(()=>window.__phase2dCacheMarker),undefined);
  await appendFile(path.join(temp,'web/current/js/parent-services.js'),'\nwindow.__phase2dCacheMarker="new";\n');build();
  const html=await readFile(path.join(dir,'index.html'),'utf8');
  for(const m of html.matchAll(/<script\b[^>]*src="((?:js|vendor)\/[^"?]+)\?v=([a-f0-9]{16})"/g)){
   const bytes=await readFile(path.join(dir,m[1]));assert.equal(m[2],createHash('sha256').update(bytes).digest('hex').slice(0,16));
  }
  // A tab from before versioned iframe URLs must not silently launch a new engine.
  await page.evaluate(()=>{document.getElementById('hqArcadeFrame').src='arcade.html?season=spring'});
  const oldParentFrame=page.frameLocator('#hqArcadeFrame');
  await oldParentFrame.locator('#bootError').waitFor({state:'attached',timeout:30000});
  assert.match(await oldParentFrame.locator('#bootError').textContent(),/새 버전/);
  await page.reload({waitUntil:'load'});
  assert.equal(await page.evaluate(()=>window.__phase2dCacheMarker),'new');
  assert.notEqual(await page.evaluate(()=>window.HOJA_BUILD.gameVersion),oldVersion);
  assert.equal(seen.length,2);assert.notEqual(seen[0],seen[1]);
  await page.goto(url+'arcade.html?gv='+oldVersion,{waitUntil:'load'});
  const error=page.locator('#bootError');await error.waitFor({state:'visible'});
  assert.match(await error.innerText(),/새 버전/);
  assert.equal(await page.locator('#phaserRoot canvas').count(),0);
 }finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true})}
});
