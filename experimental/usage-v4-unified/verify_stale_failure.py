#!/usr/bin/env python3
"""Deliver an old renderer failure after the real team game hides its question."""
import argparse, asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright
from verify_f3_ui_e2e import STUB, backend, to_catalog, pick_unit, mode, approved_iframe

async def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--html',required=True);ap.add_argument('--phaser',required=True)
    ap.add_argument('--packages',required=True);ap.add_argument('--port',type=int,default=8790)
    ap.add_argument('--channel',default=None);ap.add_argument('--failure',choices=['embed','load','show'],default='show');a=ap.parse_args()
    html=Path(a.html).read_text(encoding='utf-8').replace('<head>','<head>'+STUB.replace('PORT',str(a.port)),1)
    phaser=Path(a.phaser).read_bytes()
    names={x['cartridgeId']:x['name'] for x in backend(a.port,'/rpc',{'fn':'hojaListPublicCartridges','args':[]})['v']}
    async with async_playwright() as pw:
      browser=await pw.chromium.launch(headless=True,channel=a.channel,args=['--enable-unsafe-swiftshader'])
      page=await browser.new_page(viewport={'width':1280,'height':800});dialogs=[];errors=[]
      async def dialog(d):
        dialogs.append(d.message);await d.dismiss()
      page.on('dialog',lambda d:asyncio.create_task(dialog(d)))
      page.on('pageerror',lambda e:errors.append(str(e)))
      async def route(r):
        u=r.request.url
        if u==f'http://127.0.0.1:{a.port}/game.html':await r.fulfill(body=html,content_type='text/html; charset=utf-8')
        elif u.endswith('phaser.min.js'):await r.fulfill(body=phaser,content_type='application/javascript')
        elif u.startswith('https://raw.githubusercontent.com/xkdtndbrwk111-prog/HOJA-QUESTION-BANK/'):
          f=Path(a.packages)/u.split('/',6)[-1];await r.fulfill(status=200 if f.is_file() else 404,body=f.read_bytes() if f.is_file() else b'',headers={'access-control-allow-origin':'*'})
        elif u.startswith(('data:',f'http://127.0.0.1:{a.port}')):await r.continue_()
        else:await r.abort()
      await page.route('**/*',route)
      await page.goto(f'http://127.0.0.1:{a.port}/game.html',wait_until='domcontentloaded',timeout=60000);await page.wait_for_timeout(5000)
      await to_catalog(page);await pick_unit(page,names['sci5-s2-heat-common'])
      await page.evaluate('''action=>{window.__injectedFaults=0;
        const js=`<script>window.addEventListener('message',function(e){
          if(e.source===parent&&e.data?.type==='HOJA_UNIFIED_COMMAND'&&e.data.action===${JSON.stringify(action)}&&!parent.__injectedFaults){
            parent.__injectedFaults++;e.stopImmediatePropagation();setTimeout(()=>{parent.__lateFailureSent=true;parent.postMessage({type:'HOJA_UNIFIED_RESULT',requestId:e.data.requestId,ok:false,error:'QA_INJECTED_FAILURE'},'*')},2000);
          }},true)<\\/script>`;
        window.HOJA_TRIAL_APPROVED_HTML=window.HOJA_TRIAL_APPROVED_HTML.replace('<head>','<head>'+js);
      }''',a.failure)
      await mode(page,'함께 놀기','2')
      await page.locator('#htTeamBoard button.htBalloon').first.click(timeout=30000)
      await page.wait_for_function('window.__injectedFaults===1',timeout=10000)
      await page.evaluate("window.HOJA_TEAM_APPROVED_TRIAL.hide();document.getElementById('hqOverlay').hidden=true")
      await page.wait_for_timeout(4000)
      hidden=await page.evaluate("document.getElementById('hqOverlay').hidden")
      assert await page.evaluate('window.__lateFailureSent===true') and hidden and not dialogs and not errors and await page.locator('#hojaRendererRetry').count()==0,(hidden,dialogs,errors)
      print('STALE_FAILURE_AFTER_HIDE_PASS',flush=True)
      await browser.close()
if __name__=='__main__':asyncio.run(main())
