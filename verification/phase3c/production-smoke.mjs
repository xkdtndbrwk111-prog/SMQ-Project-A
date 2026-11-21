import {chromium} from '../phase2/harness/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
try{
 const tc=await browser.newContext(),sc=await browser.newContext({viewport:{width:1280,height:900}}),sc2=await browser.newContext(),t=await tc.newPage(),s=await sc.newPage(),s2=await sc2.newPage();
 await t.setViewportSize({width:1366,height:768});await t.goto(process.env.HOJA_TEACHER_URL);await t.getByText('대결 방 만들기').click();await t.locator('#qr img').waitFor();const url=await t.locator('#qr img').getAttribute('data-join-url');
 for(const [page,name] of [[s,'시험'],[s2,'연습']]){await page.goto(url);await page.locator('#name').fill(name);await page.locator('#join').click();}
 await t.getByText('참가 학생 2명',{exact:false}).waitFor();for(const [name,team] of [['시험','A팀'],['연습','B팀']])await t.locator('.person').filter({hasText:name}).getByRole('button',{name:team}).click();
 await t.locator('.person').filter({hasText:'연습'}).getByText('B팀 · 대기 중',{exact:false}).waitFor();await t.screenshot({path:'verification/phase3c/screenshots/teacher-lobby-lan.png',fullPage:true});await t.locator('#start').click();await t.locator('.team-card').first().waitFor();assert.equal(await t.locator('.team-card.leading').count(),2,'equal teams share the lead');await s.locator('#play').click();await s.frameLocator('iframe').locator('#scoreHud').waitFor({state:'visible',timeout:60000});const f=s.frames().find(x=>x.url().includes('/arcade.html'));assert.equal(await f.evaluate(()=>typeof window.HOJA_TEST_PROBE),'undefined');await s.screenshot({path:'verification/phase3c/screenshots/student-game.png'});console.log('PASS: production LAN QR, two teams share tie, real arcade, no test probe');await tc.close();await sc.close();await sc2.close();
}finally{await browser.close();}
