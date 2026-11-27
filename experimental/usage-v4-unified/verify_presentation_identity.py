#!/usr/bin/env python3
"""Isolated real iframe: reject old presentation for the same question, accept real click."""
import argparse, asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from verify_f3_ui_e2e import STUB, backend, to_catalog, pick_unit

async def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--html',required=True);ap.add_argument('--phaser',required=True)
    ap.add_argument('--packages',required=True);ap.add_argument('--port',type=int,default=8790)
    ap.add_argument('--unit',default='sci5-s2-heat-common');ap.add_argument('--channel',default=None)
    a=ap.parse_args();html=Path(a.html).read_text(encoding='utf-8').replace('<head>','<head>'+STUB.replace('PORT',str(a.port)),1);phaser=Path(a.phaser).read_bytes()
    names={x['cartridgeId']:x['name'] for x in backend(a.port,'/rpc',{'fn':'hojaListPublicCartridges','args':[]})['v']}
    async with async_playwright() as pw:
      browser=await pw.chromium.launch(headless=True,channel=a.channel,args=['--enable-unsafe-swiftshader'])
      page=await browser.new_page(viewport={'width':1280,'height':800});errors=[];dialogs=[]
      page.on('pageerror',lambda e:errors.append(str(e)))
      async def dialog(d):
        dialogs.append(d.message);await d.dismiss()
      page.on('dialog',lambda d:asyncio.create_task(dialog(d)))
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
      await to_catalog(page);await pick_unit(page,names[a.unit])
      await page.evaluate('''async()=>{
        const bank=window.HOJA_B_LIVE.sources[0].data;
        const q=bank.questions.find(x=>x.rendererQuestion?.type==='MCQ').rendererQuestion;
        const frame=document.createElement('iframe');frame.id='testPresentationFrame';
        frame.style.cssText='position:fixed;inset:0;z-index:99999;width:100%;height:100%;border:0';document.body.appendChild(frame);
        await new Promise(resolve=>{frame.onload=resolve;frame.srcdoc=window.HOJA_TRIAL_APPROVED_HTML});
        window.__testIds=[];frame.contentWindow.addEventListener('message',ev=>{if(ev.data?.type==='HOJA_UNIFIED_COMMAND'&&ev.data.action==='show')window.__testIds.push(ev.data.requestId)});
        window.__testAnswers=[];const h=window.HOJA_UNIFIED_TRIAL_CORE.createApprovedFrameHost({frame,onAnswer:a=>window.__testAnswers.push(a)});window.__testHost=h;
        await h.initialize();await h.load({questions:[q],images:bank.images||bank.rendererImages,tags:bank.tags||bank.rendererTags,unitMeta:bank.unitMeta,mode:'team'});
        await h.show({questionId:q.id,mode:'team'});await h.show({questionId:q.id,mode:'team'});
        if(window.__testIds.length!==2||window.__testIds[0]===window.__testIds[1])throw Error('PRESENTATION_ID_REUSED');
        window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,data:{type:'HOJA_UNIFIED_ANSWER',questionId:q.id,presentationId:window.__testIds[0],choiceId:q.answer.choiceId}}));
        await new Promise(r=>setTimeout(r,100));if(window.__testAnswers.length)throw Error('STALE_ANSWER_ACCEPTED');
      }''')
      await page.frame_locator('#testPresentationFrame').locator('button.hqChoice').first.click(timeout=15000)
      await page.wait_for_function('window.__testAnswers.length===1',timeout=5000)
      await page.evaluate("window.__testHost.close();document.getElementById('testPresentationFrame').remove()")
      assert not errors and not dialogs,(errors,dialogs)
      print('PRESENTATION_IDENTITY_REAL_IFRAME_PASS',flush=True);await browser.close()
if __name__=='__main__':asyncio.run(main())
