import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createServer} from 'node:http';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {chromium} from '../phase2/harness/node_modules/playwright/index.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
for(const finalCorrect of [false,true]) test(`24th answer continues and 25th ${finalCorrect?'correct':'wrong'} answer settles once despite competing endings`,async()=>{
 const dir=path.join(root,'dist-current-test');const server=createServer(async(req,res)=>{try{const n=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html',f=path.resolve(dir,n);if(!f.startsWith(dir+path.sep))throw Error('bad');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.json')?'application/json':n.endsWith('.ogg')?'audio/ogg':'text/html; charset=utf-8');res.end(await readFile(f));}catch{res.writeHead(404).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{const page=await browser.newPage();const info=JSON.parse(await readFile(path.join(dir,'BUILD.json'),'utf8'));const q=new URLSearchParams({m:'s',c:'test-joseon-a',cv:'19065b1d0fc5',gv:info.gameVersion,s:'spring'});
 await page.goto(`http://127.0.0.1:${server.address().port}/play.html?${q}`,{waitUntil:'load'});await page.locator('#hojaStudentStart:not([disabled])').click({timeout:30000});await page.frameLocator('#hqArcadeFrame').locator('#scoreHud').waitFor({state:'visible',timeout:30000});const f=page.frames().find(x=>x.url().includes('/arcade.html'));await f.waitForFunction(()=>!!window.HOJA_TEST_PROBE?.state(),null,{timeout:30000});
 assert.equal(await f.evaluate(()=>window.HOJA_TEST_PROBE.collectFruit()),true);
 await f.evaluate(()=>window.HOJA_TEST_PROBE.primeAnswers(23));
 async function answerLast(correct=false){const rec=await f.evaluate(()=>window.HOJA_RUN_RECORD().at(-1));const choice=correct?rec.answerIndex:(rec.answerIndex+1)%rec.choices.length;await f.locator('#quizChoices button').nth(choice).click();return rec;}
 assert.equal(await f.evaluate(()=>window.HOJA_TEST_PROBE.quiz()),true);await answerLast(true);await f.waitForTimeout(800);
 let snap=await f.evaluate(()=>({metrics:window.HOJA_TEST_PROBE.metrics(),reason:window.HOJA_TEST_PROBE.endReason()}));assert.equal(snap.metrics.answered,24);assert.equal(snap.reason,null);
 assert.equal(await f.evaluate(()=>window.HOJA_TEST_PROBE.quizNext()),true);await answerLast(finalCorrect);
 assert.equal(await f.evaluate(()=>window.HOJA_TEST_PROBE.endReason()),'QUIZ_25');
 assert.match(await f.locator('#quizFeedback').innerText(),finalCorrect?/정답/:/오답/);
 await f.evaluate(()=>window.HOJA_TEST_PROBE.raceEnd());
 await f.locator('#hojaReviewOverlay:not([hidden])').waitFor({timeout:5000});assert.match(await f.locator('#hojaReviewCard').innerText(),/문제 25개 완료/);
 const before=await f.evaluate(()=>({metrics:window.HOJA_TEST_PROBE.metrics(),records:window.HOJA_RUN_RECORD(),reason:window.HOJA_TEST_PROBE.endReason()}));
 assert.equal(before.metrics.answered,25);assert.equal(before.metrics.usedFamilies,25);assert.equal(before.metrics.flowerBonus,5);assert.equal(before.metrics.quizPoints,finalCorrect?20:10);assert.equal(before.metrics.score,finalCorrect?25:15);assert.equal(before.metrics.timeBonus,0);assert.equal(before.reason,'QUIZ_25');
 // Comparison only: the existing FINISH formula would add this much, pending policy approval.
 const hypotheticalFinishBonus=Math.round(before.metrics.remainingSeconds*before.metrics.found/25);assert.ok(hypotheticalFinishBonus>0);
 assert.deepEqual(await f.evaluate(()=>window.HOJA_TEST_PROBE.repeatSettlement()),before.metrics);
 await f.locator('#hojaReviewActions button').nth(1).click();
 assert.match(await f.locator('#hojaRankOverlay').innerText(),/25문항 완료 랭킹 정책 확인 중/);
 await f.evaluate(data=>window.HOJA_REVIEW.open({reason:'문제 25개 완료',metrics:data.metrics,rows:data.records},()=>{}),before);
 await f.locator('#hojaReviewActions button').first().click();const rec=before.records.find(r=>r.correct===false);await f.locator('#hojaReviewChoices button').nth(rec.answerIndex).click();
 const after=await f.evaluate(()=>({metrics:window.HOJA_TEST_PROBE.metrics(),records:window.HOJA_RUN_RECORD(),reason:window.HOJA_TEST_PROBE.endReason()}));assert.deepEqual(after,before);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
