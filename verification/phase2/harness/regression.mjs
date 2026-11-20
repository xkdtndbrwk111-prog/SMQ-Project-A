import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const build=process.env.HOJA_BUILD||'legacy';
if(!['legacy','current'].includes(build))throw Error('Unknown HOJA_BUILD: '+build);
const prodDir=build==='current'?'dist-current':'dist';
const testDir=build==='current'?'dist-current-test':'dist-test';
const mode=process.env.HOJA_TEST_ONLY;
if(mode&&!['network','replay','settlement','explore'].includes(mode))throw Error('Unknown HOJA_TEST_ONLY: '+mode);
const resultDir=path.join(root,'verification/phase2/harness/results');
await mkdir(resultDir,{recursive:true});
const server=createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(![`/${prodDir}/`,`/${testDir}/`].some(prefix=>pathname.startsWith(prefix)))throw Error('unsupported root');
    const resolved=path.resolve(root,'.'+pathname);
    if(![prodDir,testDir].some(d=>resolved===path.join(root,d)||resolved.startsWith(path.join(root,d)+path.sep)))throw Error('bad path');
    const file=pathname.endsWith('/')?path.join(resolved,'index.html'):resolved;
    const buf=await readFile(file);
    res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'application/octet-stream');
    res.end(buf);
  } catch {res.writeHead(404);res.end('Not found');}
});
await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
const output={};
const deny=/(firebase|firestore|googleapis\.com\/.*(?:firestore|identitytoolkit)|script\.google\.com|script\.googleusercontent\.com)/i;
async function track(page){
  const requests=[],byRequest=new Map();page.on('request',r=>{const record={method:r.method(),url:r.url(),type:r.resourceType(),status:null};requests.push(record);byRequest.set(r,record)});
  const responses=[];page.on('response',r=>{responses.push({url:r.url(),status:r.status()});const record=byRequest.get(r.request());if(record)record.status=r.status()});
  const failures=[];page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  return {requests,responses,failures,errors};
}
async function sceneReady(page){
 await page.frameLocator('#hqArcadeFrame').locator('#scoreHud').waitFor({state:'visible',timeout:30000});
 const frame=page.frames().find(f=>f.url().includes('/arcade.html'));
 assert.ok(frame,'arcade frame found');
 try { await frame.waitForFunction(()=>!!window.HOJA_PHASER_APP?.scene()?.playerBody,null,{timeout:30000}); }
 catch(e){output.sceneDiagnostic=await frame.evaluate(()=>({boot:document.querySelector('#bootStatus')?.textContent,phaser:typeof window.Phaser,app:!!window.HOJA_PHASER_APP,scene:!!window.HOJA_PHASER_APP?.scene(),body:document.body.innerText.slice(0,1000)}));throw e;}
}
async function teacher(page){
 await page.goto(base+'/'+prodDir+'/',{waitUntil:'load'});
 const intro=page.locator('#frame');for(let i=0;i<3;i++)await intro.click();
 await page.getByRole('button',{name:'5학년'}).click();
 await page.getByRole('button',{name:'사회 2개 카트리지'}).click();
 await page.getByRole('button',{name:'조선 시대의 유교 문화 (시험 A) PAK 01'}).click();
 await page.getByRole('button',{name:/혼자 아케이드 선택한/}).click();
 await page.getByRole('button',{name:/학생 QR 만들기/}).click();
 await page.locator('#hojaQrOverlay').waitFor({state:'visible'});
 const qr=await page.locator('#hojaQrUrl').innerText();
 assert.ok(qr.includes('/play.html?'));
 await page.locator('#hojaQrClose').click();
 await page.getByRole('button',{name:/바로 플레이/}).click();
 await sceneReady(page);
 await new Promise(resolve=>setTimeout(resolve,500));
 return qr;
}
async function checkStaleQr(qr, parameter, expectedMessage) {
 const stale = new URL(qr);
 stale.searchParams.set(parameter, 'old-version');
 const context = await browser.newContext();
 try {
   const page = await context.newPage();
   const data = await track(page);
   await page.goto(stale.href, {waitUntil:'load'});
   const error = page.locator('#hojaStudentError');
   await error.waitFor({state:'visible'});
   assert.ok((await error.innerText()).includes(expectedMessage));
   assert.equal(await page.locator('#hojaStudentStart').isHidden(), true);
   assert.equal(page.frames().some(f => f.url().includes('/arcade.html')), false);
   return data;
 } finally { await context.close(); }
}
async function network(){
 const teacherContext=await browser.newContext();
 const t=await teacherContext.newPage();const ta=await track(t);
 output.network={teacher:ta};
 const qr=await teacher(t);
 await teacherContext.close();
 const studentContext=await browser.newContext();
 const s=await studentContext.newPage();const sa=await track(s);
 output.network.student=sa;
 await s.goto(qr,{waitUntil:'domcontentloaded',timeout:60000});
 await s.locator('#hojaStudentStart:not([disabled])').click({timeout:30000});
 await sceneReady(s);
 await new Promise(resolve=>setTimeout(resolve,500));
 await studentContext.close();
 const staleGame = await checkStaleQr(qr, 'gv', '게임이 새 버전');
 const staleCartridge = await checkStaleQr(qr, 'cv', '단원 문제가 바뀌어');
 output.network = {teacher:ta, student:sa, staleGame, staleCartridge};
 for(const [label,data] of Object.entries(output.network)){
   assert.equal(data.requests.filter(r=>deny.test(r.url)).length,0,`${label} forbidden requests`);
   assert.equal(data.requests.filter(r=>!r.url.startsWith(base+'/')&&!r.url.startsWith('https://cdn.jsdelivr.net/')).length,0,`${label} unexpected external requests`);
   assert.equal(data.failures.length,0,`${label} request failures`);
   assert.equal(data.errors.length,0,`${label} page errors: ${data.errors}`);
   assert.ok(data.requests.length>0,`${label} no requests captured`);
   assert.deepEqual(data.requests.filter(r=>r.status===null||r.status<200||r.status>=300),[],`${label} non-2xx or missing HTTP response`);
 }
 console.log('PASS network: teacher, generated student QR, stale game and cartridge versions, real HTTP responses');
}
async function replay(mode='replay'){
 const context=await browser.newContext();
 await context.addInitScript(()=>{
   let n=0x12345678;
   Math.random=()=>{n=(n+0x6d2b79f5)|0;let v=Math.imul(n^(n>>>15),n|1);v^=v+Math.imul(v^(v>>>7),v|61);return ((v^(v>>>14))>>>0)/4294967296;};
   Object.defineProperty(performance,'now',{value:()=>Date.now()-1704067200000});
   const raf=window.requestAnimationFrame.bind(window);
   window.requestAnimationFrame=callback=>raf(()=>callback(performance.now()));
   if(location.hostname==='127.0.0.1'){sessionStorage.setItem('HOJA_TEST_SEED','314159');sessionStorage.setItem('HOJA_TEST_PAUSE_START','1');}
 });
 const page=await context.newPage();
 await page.clock.install({time:new Date('2024-01-01T00:00:00Z')});
 await page.clock.pauseAt(new Date('2024-01-01T00:00:00Z'));
 const info=JSON.parse(await readFile(path.join(root,testDir,'BUILD.json')));
 const params=new URLSearchParams({m:'s',c:'test-joseon-a',cv:'19065b1d0fc5',gv:info.gameVersion,s:'spring'});
 await page.goto(`${base}/${testDir}/play.html?${params}`,{waitUntil:'load'});
 await page.locator('#hojaStudentStart:not([disabled])').click({timeout:30000});
 let frame;
 for(let i=0;i<100;i++){
   await page.clock.runFor(100);
   frame=page.frames().find(f=>f.url().includes('/arcade.html'));
   if(frame && await frame.evaluate(()=>!!window.HOJA_TEST_PROBE?.state()).catch(()=>false))break;
 }
 assert.ok(frame,'game frame');
 assert.ok(await frame.evaluate(()=>window.HOJA_TEST_PROBE.state()),'scene ready');
 await page.clock.runFor(100); // allow the queued scene pause to take effect
 await page.clock.pauseAt(new Date('2024-01-01T00:00:20Z')); // same absolute frame phase in both runs
 await frame.evaluate(()=>window.HOJA_PHASER_APP.scene().game.loop.stop());
 const trace=[];
 const sample=async(label)=>trace.push({label,...await frame.evaluate(()=>window.HOJA_TEST_PROBE.snapshot())});
 const key=async(type,code,value)=>frame.evaluate(({type,code,value})=>window.dispatchEvent(new KeyboardEvent(type,{code,key:value,bubbles:true})),{type,code,value});
 const step=async(count)=>{for(let i=0;i<count;i++) {await page.clock.runFor(16);await frame.evaluate(()=>window.HOJA_PHASER_APP.scene().game.step(performance.now(),16));}};
 await sample('start');
 await frame.evaluate(()=>window.HOJA_TEST_PROBE.resume());
 if(mode==='explore'){
   const wallStart=Date.now(), visited=new Set([0]);let reason='frame limit',stuck=0,lastX=128;
   await key('keydown','KeyD','d');await key('keydown','Comma',',');
   for(let i=0;i<40;i++){
     if(Date.now()-wallStart>120000){reason='120s wall limit';break;}
     await key('keydown','Period','.');await step(6);await key('keyup','Period','.');await step(24);
     const s=await frame.evaluate(()=>window.HOJA_TEST_PROBE.snapshot());
     visited.add(s.stage);trace.push({segment:i+1,...s});
     if(s.quiz){await key('keydown','Digit1','1');await key('keyup','Digit1','1');await step(80);}
     if(s.dying){await step(50);await key('keydown','Enter','Enter');await key('keyup','Enter','Enter');await step(30);}
     if(s.deaths>=3){reason='three deaths';break;}
     if(s.timeUp){reason='time expired';break;}
     if(s.clear&&s.stage===3){reason='finish';break;}
     if(Math.abs(s.player.x-lastX)<4)stuck++;else stuck=0;
     lastX=s.player.x;
     if(stuck>=8){reason='stuck for 240 frames';break;}
     await key('keydown','KeyW','w');await step(1);await key('keyup','KeyW','w');
   }
   await context.close();return {reason,visited:[...visited],trace};
 }
 await key('keydown','KeyD','d');
 await key('keydown','Period','.');
 await step(6);await key('keyup','Period','.');
 for(let i=0;i<4;i++){await step(15);await sample(`move-${(i+1)*15}`);}
 await key('keyup','KeyD','d');await step(10);await sample('stop');
 const opened=await frame.evaluate(()=>window.HOJA_TEST_PROBE.quiz());assert.equal(opened,true);
 await step(25);await sample('quiz');
 const answer=(await frame.evaluate(()=>window.HOJA_RUN_RECORD().at(-1).answerIndex))+1;
 await key('keydown',`Digit${answer}`,String(answer));await key('keyup',`Digit${answer}`,String(answer));await step(94);await sample('answer');
 if(mode==='settlement'){
   assert.equal(await frame.evaluate(()=>window.HOJA_TEST_PROBE.quizNext()),true,'second question');
   await step(25);
   const rec=await frame.evaluate(()=>window.HOJA_RUN_RECORD().at(-1));
   const wrong=(rec.answerIndex+1)%rec.choices.length+1;
   await key('keydown',`Digit${wrong}`,String(wrong));await key('keyup',`Digit${wrong}`,String(wrong));await step(94);
   assert.equal(await frame.evaluate(()=>window.HOJA_TEST_PROBE.collectFruit()),true,'fruit pickup by induced overlap');
   await frame.evaluate(()=>window.HOJA_TEST_PROBE.stage(3));await step(5);
   await frame.evaluate(()=>window.HOJA_TEST_PROBE.resume());await step(5);
   assert.equal((await frame.evaluate(()=>window.HOJA_TEST_PROBE.snapshot())).stage,3,'induced stage 4');
   assert.equal(await frame.evaluate(()=>window.HOJA_TEST_PROBE.finish()),true,'induced FINISH door double confirmation');
   await step(250);
   const before=await frame.evaluate(()=>({metrics:window.HOJA_TEST_PROBE.metrics(),records:window.HOJA_RUN_RECORD()}));
   const expected = JSON.parse(await readFile(path.join(root,'verification/phase2/harness/settlement-evidence.json'),'utf8'));
   assert.deepEqual(before, expected.before, 'fixed FINISH score breakdown (63) and original answers');
   const repeat=await frame.evaluate(()=>window.HOJA_TEST_PROBE.repeatSettlement());
   assert.deepEqual(repeat,before.metrics,'repeated settlement leaves score unchanged');
   await key('keydown','Enter','Enter');await key('keyup','Enter','Enter');
   assert.equal(await frame.evaluate(()=>window.HOJA_REVIEW.phase),'ask');
   const wrongRecord=before.records.find(r=>r.correct===false);const choice=wrongRecord.answerIndex+1;
   await key('keydown',`Digit${choice}`,String(choice));await key('keyup',`Digit${choice}`,String(choice));
   await key('keydown','Enter','Enter');await key('keyup','Enter','Enter');
   await key('keydown','Enter','Enter');await key('keyup','Enter','Enter');
   const after=await frame.evaluate(()=>({metrics:window.HOJA_TEST_PROBE.metrics(),records:window.HOJA_RUN_RECORD()}));
   assert.deepEqual(after,before,'original record and score survive review');
   assert.deepEqual(await frame.evaluate(()=>window.HOJA_REVIEW.log()), [{
     order:wrongRecord.order, familyId:wrongRecord.familyId, round:1, chosenIndex:wrongRecord.answerIndex, correct:true
   }], 'the wrong answer was corrected during review');
   await key('keydown','Enter','Enter');await key('keyup','Enter','Enter');
   const rank=await frame.locator('#hojaRankOverlay.is-open').innerText();
   assert.equal(rank,expected.rank,'FINISH ranking screen and score');
   await context.close();return {before,after,repeat,rank};
 }
 await frame.evaluate(()=>window.HOJA_TEST_PROBE.setTime(0));await step(7);await sample('timeout');
 await context.close();return trace;
}
async function deterministic(){
 const a=await replay();const b=await replay();output.replay={a,b};
 // Only player/enemy coordinates and velocities are rounded; all events, scores,
 // answer fields and times are compared exactly. Raw values remain in results.
 const normalize=(x,p='')=>typeof x==='number'&&/\/(?:player|enemies\/\d+)\/(?:x|y|vx|vy)$/.test(p)?Math.round(x*1e6)/1e6:Array.isArray(x)?x.map((v,i)=>normalize(v,`${p}/${i}`)):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,normalize(v,`${p}/${k}`)])):x;
 if(JSON.stringify(normalize(a))!==JSON.stringify(normalize(b)))throw Error('Replay mismatch: see results/last-run.json');
 assert.equal(a[0].seed,314159);
 assert.ok(a.find(s=>s.label==='stop').player.x>a[0].player.x+10,'right input moved player');
 assert.ok(a.some(s=>s.records.length>0),'quiz recorded');
 assert.equal(a.find(s=>s.label==='answer').metrics.quizPoints,10,'correct answer scored');
 assert.equal(a.at(-1).timeUp,true);
 const fixture=path.join(root,'verification/phase2/harness/baseline-trace.json');
 assert.deepEqual(normalize(a),JSON.parse(await readFile(fixture,'utf8')),'Phase 1 baseline trace');
 console.log('PASS deterministic replay: seed, input, clocks, state, quiz and timeout');
}
async function natural(){
 const result=await replay('explore');output.natural=result;
 console.log(`NATURAL stop=${result.reason} stages=${result.visited.join(',')}`);
 // The historical explorer does not verify cave return and surface door events.
 // Do not ever treat a count of visited stage IDs as a verified natural route.
 throw Error('Historical exploration is not a natural-route verification; event-based tests are required.');
}
async function settlement(){output.settlement=await replay('settlement');console.log('PASS induced finish, fruit, duplicate settlement, review and ranking');}
try {if(!mode||mode==='network')await network();if(!mode||mode==='replay')await deterministic();if(mode==='explore')await natural();if(!mode||mode==='settlement')await settlement();}
finally {await writeFile(path.join(resultDir,'last-run.json'),JSON.stringify(output,null,2));await browser.close();await new Promise(r=>server.close(r));}
