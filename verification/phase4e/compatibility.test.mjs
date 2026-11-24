import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from '../phase2/harness/node_modules/playwright/index.mjs';
const root=path.resolve(fileURLToPath(new URL('../../dist-current-test/',import.meta.url)));
test('실제 V0.61 편집기와 현재 게임의 반복 Play Test 및 응답 계약',async()=>{
 const server=createServer(async(req,res)=>{try{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname));if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.png':'image/png','.ogg':'audio/ogg'})[path.extname(f)]||'text/html');res.end(await readFile(f));}catch{res.writeHead(404).end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});page.on('dialog',d=>d.accept());
  await page.goto(`http://127.0.0.1:${server.address().port}/maker-compat.html`);
  const [file]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);const sample=JSON.parse(await readFile(await file.path(),'utf8'));
  assert.equal(sample.schemaVersion,6101);assert.ok(sample.maps[0].objects.some(o=>o.type==='saw'));assert.match(await page.locator('#validation').innerText(),/검증 통과/);
  const conflicting=structuredClone(sample);conflicting.maps[0].objects.find(o=>o.id==='pipe_a').pipeMode='solid';
  await page.locator('#file').setInputFiles({name:'solid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(conflicting))});assert.match(await page.locator('#validation').innerText(),/빈 토관/);assert.equal(await page.evaluate(()=>project.maps[0].objects.find(o=>o.id==='pipe_a').pipeMode),'solid');
  const extended=structuredClone(sample);extended.extraFuture={kept:123};extended.maps[0].objects.push({id:'future',type:'gimmick',x:4,y:18,w:2,h:4,gimmick:{kind:'flame',length:5,active:3000,customFuture:123}});
  await page.locator('#file').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(extended))});
  const [out]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);assert.deepEqual(JSON.parse(await readFile(await out.path(),'utf8')),extended);
  await page.locator('#file').setInputFiles({name:'sample.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(sample))});
  const [child]=await Promise.all([page.waitForEvent('popup'),page.locator('#play').click()]);await child.waitForFunction(()=>window.HOJA_V061_STATUS?.().project==='HOJA V0.61 샘플 프로젝트',null,{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('현재 게임이'),null,{timeout:10000});
  await child.waitForFunction(()=>!!window.HOJA_TEST_PROBE?.state(),null,{timeout:30000});await child.evaluate(()=>HOJA_TEST_PROBE.stage(1));await child.waitForFunction(()=>HOJA_V061_STATUS().stage===1);await page.locator('#play').click();await child.waitForFunction(()=>HOJA_V061_STATUS().stage===0,null,{timeout:30000});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('현재 게임이'),null,{timeout:10000});
  await page.evaluate(()=>{project.title='변경 B'});await page.locator('#play').click();await child.waitForFunction(()=>window.HOJA_V061_STATUS().project==='변경 B',null,{timeout:30000});
  await page.evaluate(()=>{project.title='빠른 A';play();project.title='빠른 B';play()});await child.waitForFunction(()=>window.HOJA_V061_STATUS().project==='빠른 B',null,{timeout:30000});
  // Legacy messages continue to work; invalid input returns an error and does not lock the queue.
  await page.evaluate(()=>{window.replies=[];window.addEventListener('message',e=>{if(e.source===hojaTestWindow)window.replies.push(e.data)});});
  await page.evaluate(()=>hojaTestWindow.postMessage({kind:'HOJA_V061_LOAD',requestId:'bad',project:{}},location.origin));
  await page.waitForFunction(()=>window.replies.some(x=>x.requestId==='bad'&&x.kind==='HOJA_V061_ERROR'));
  await page.evaluate(()=>{project.title='수정 후 재시도';hojaTestWindow.postMessage({kind:'HOJA_V061_LOAD',project:structuredClone(project)},location.origin)});
  await child.waitForFunction(()=>window.HOJA_V061_STATUS().project==='수정 후 재시도');
  await page.evaluate(()=>hojaTestWindow.postMessage({kind:'HOJA_V061_LOAD',requestId:'mismatch',gameVersion:'wrong',project:structuredClone(project)},location.origin));
  await page.waitForFunction(()=>window.replies.some(x=>x.requestId==='mismatch'&&x.kind==='HOJA_V061_ERROR'));
  await page.evaluate(()=>hojaTestWindow.postMessage({kind:'HOJA_V061_LOAD',requestId:'bad-data',dataVersion:999,project:structuredClone(project)},location.origin));await page.waitForFunction(()=>window.replies.some(x=>x.requestId==='bad-data'&&x.kind==='HOJA_V061_ERROR'));
  await child.evaluate(()=>window.postMessage({kind:'HOJA_V061_LOAD',project:{format:'HOJA_MAKER_PROJECT',schemaVersion:6101,title:'untrusted',maps:[]}},location.origin));
  await page.waitForTimeout(300);assert.equal(await child.evaluate(()=>HOJA_V061_STATUS().project),'수정 후 재시도');
  // An old saw and a new gimmick remain separate at runtime; a linked copy is deliberate.
  const linked=structuredClone(sample);for(const m of linked.maps)for(const o of m.objects)if(o.type==='pipe'&&o.targetMapId)o.pipeMode='linked';
  linked.title='토관과 톱날';linked.maps[0].objects.push({id:'new-saw',type:'gimmick',x:20,y:20,w:4,h:4,gimmick:{kind:'saw',axis:'x',distance:128,speed:45,radius:28,embedded:true}});
  await page.locator('#file').setInputFiles({name:'linked.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(linked))});await page.locator('#play').click();
  await child.waitForFunction(()=>window.HOJA_V061_STATUS().project==='토관과 톱날',null,{timeout:30000});await child.waitForTimeout(2000);console.log('maker saw status',JSON.stringify(await child.evaluate(()=>({old:HOJA_TEST_PROBE.makerHazards(),modern:HOJA_TEST_PROBE.phase4dInfo()}))));assert.ok((await child.evaluate(()=>HOJA_TEST_PROBE.phase4dInfo()?.states||[])).some(x=>x.kind==='saw')); 
  assert.ok((await child.evaluate(()=>HOJA_TEST_PROBE.makerHazards())).length>0);
  await page.evaluate(()=>{document.querySelector('#status').textContent='유지';window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:hojaTestWindow,data:{kind:'HOJA_V061_LOADED',requestId:'stale',mapCount:99}}))});assert.equal(await page.locator('#status').innerText(),'유지');
  const attacker=createServer((req,res)=>res.end('<!doctype html><title>other origin</title>'));await new Promise(r=>attacker.listen(0,'127.0.0.1',r));
  try{const other=await browser.newPage();await other.goto(`http://127.0.0.1:${attacker.address().port}/`);const [foreign]=await Promise.all([other.waitForEvent('popup'),other.evaluate(url=>window.foreign=window.open(url),`http://127.0.0.1:${server.address().port}/maker-compat-arcade.html`)]);await foreign.waitForFunction(()=>!!window.HOJA_V061_STATUS,null,{timeout:30000});await other.evaluate(p=>window.foreign.postMessage({kind:'HOJA_V061_LOAD',project:p},'*'),sample);await other.waitForTimeout(1200);assert.equal((await foreign.evaluate(()=>HOJA_V061_STATUS())).project,null);await foreign.close();await other.close();}finally{attacker.closeAllConnections();await new Promise(r=>attacker.close(r))}
  await child.close();const [again]=await Promise.all([page.waitForEvent('popup'),page.locator('#play').click()]);await again.waitForFunction(()=>window.HOJA_V061_STATUS?.().project==='토관과 톱날',null,{timeout:30000});
  await again.close();const [silent]=await Promise.all([page.waitForEvent('popup'),page.evaluate(()=>{hojaTestWindow=window.open('/cartridges/catalog.json','silent-test')})]);await page.evaluate(()=>play());const timedOutId=await page.evaluate(()=>hojaTestRequest);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('시간 초과'),null,{timeout:18000});await page.evaluate(id=>{for(let i=0;i<2;i++)window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:hojaTestWindow,data:{kind:'HOJA_V061_LOADED',requestId:id,mapCount:99}}))},timedOutId);assert.match(await page.locator('#status').innerText(),/시간 초과/);await silent.close();
  console.log('PASS: actual editor→game, repeat, changed project, validation, schema round trip, error/retry, legacy, version mismatch, wrong source, reopen');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
