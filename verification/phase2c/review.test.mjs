import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '../phase2/harness/node_modules/playwright/index.mjs';
import {fileURLToPath} from 'node:url';
const review=fileURLToPath(new URL('../../web/current/js/review.js',import.meta.url));
test('wrong answer repeats, correction preserves original and completes once',async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try {
  const page=await browser.newPage();await page.setContent('<!doctype html><html><body></body></html>');await page.addScriptTag({path:review});
  const data={reason:'시간 종료',metrics:{score:10,found:1,correct:0,wrong:1,remainingSeconds:0},rows:[{order:1,familyId:'f1',type:'OX',question:'문항',choices:['O','X'],answerIndex:0,chosenIndex:1,correct:false}]};
  await page.evaluate(d=>{window.input=d;window.done=0;window.HOJA_REVIEW.open(d,()=>window.done++)},data);
  await page.getByRole('button',{name:/틀린 문제 다시 풀기/}).click();
  await page.getByRole('button',{name:'2번 X'}).click();
  await page.getByRole('button',{name:/이번 회차 끝/}).click();
  await page.getByRole('button',{name:/결산 화면으로/}).click();
  await page.getByRole('button',{name:/틀린 문제 다시 풀기/}).click();
  await page.getByRole('button',{name:'1번 O'}).click();
  await page.getByRole('button',{name:/이번 회차 끝/}).click();
  await page.getByRole('button',{name:/결산 화면으로/}).click();
  await page.getByRole('button',{name:/랭킹 화면으로/}).click();
  const result=await page.evaluate(()=>({input:window.input,done:window.done,log:window.HOJA_REVIEW.log(),open:window.HOJA_REVIEW.isOpen}));
  assert.deepEqual(result.input,data);assert.equal(result.done,1);assert.equal(result.open,false);
  assert.deepEqual(result.log.map(x=>({round:x.round,correct:x.correct})),[{round:1,correct:false},{round:2,correct:true}]);
 }finally{await browser.close();}
});
