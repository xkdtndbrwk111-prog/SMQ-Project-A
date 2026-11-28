#!/usr/bin/env python3
"""Chrome arcade entry and intro-only loop separation, isolated mock."""
import argparse, asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from verify_f3_ui_e2e import STUB, backend, to_catalog, pick_unit, mode

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
      # Test fixture simulates the already-completed tutorial; the actual arcade opens through UI.
      await page.evaluate("localStorage.setItem('hoja_tutorial_stage0_completed_v1','1')")
      # Test-only read-only hook inside the arcade closure; it never changes game state.
      await page.evaluate("""()=>{if(typeof window.HOJA_TT_ARCADE_BRIDGE_SOURCE!=='string')throw Error('ARCADE_BRIDGE_MISSING');window.HOJA_TT_ARCADE_BRIDGE_SOURCE+=`\nwindow.__testArcadePosition=()=>({x:ACTIVE_SCENE?.playerBody?.x,remainingMs:ACTIVE_SCENE?.remainingMs,quizActive:ACTIVE_SCENE?.quizActive,hitStop:ACTIVE_SCENE?.hitStopActive,dying:ACTIVE_SCENE?.dying,paused:ACTIVE_SCENE?.manualPaused,clear:ACTIVE_SCENE?.clear,transitioning:ACTIVE_SCENE?.transitioning});\n`;}""")
      await mode(page,'혼자 놀기','아케이드 모드')
      direct=page.locator('#hoja15JoinLayer.open .h15Big',has_text='바로 시작하기')
      if await direct.is_visible():await direct.click()
      await page.wait_for_function("window.HOJA_GAMEPLAY?.state?.page==='arcade'&&!document.getElementById('hojaGamePlay').hidden",timeout=30000)
      await page.wait_for_function("(()=>{const f=document.getElementById('hqArcadeFrame');return !f.hidden&&!!f.contentWindow?.Phaser&&!!f.contentDocument?.querySelector('canvas')})()",timeout=60000)
      state=await page.evaluate("({introPaused:window.HOJA_ATTRACT_SCENE.scene.isPaused(),introRunning:window.HOJA_ATTRACT_GAME.loop.running,arcadeCanvas:document.getElementById('hqArcadeFrame').contentDocument.querySelectorAll('canvas').length})")
      assert state['introPaused'] and not state['introRunning'] and state['arcadeCanvas']>0,state
      print('ARCADE_ENTRY_INTRO_PAUSED_PASS',state,flush=True)
      await page.wait_for_function("(()=>{const w=document.getElementById('hqArcadeFrame')?.contentWindow;return !!w?.HOJA_V064_PERF_READ?.().ready})()",timeout=60000)
      await page.wait_for_function("(()=>{const w=document.getElementById('hqArcadeFrame')?.contentWindow;const p=w?.HOJA_V064_PERF_READ?.();return p?.connection==='OK'&&p.sampleCount>0&&!p.paused})()",timeout=30000)
      perf=await page.evaluate("document.getElementById('hqArcadeFrame').contentWindow.HOJA_V064_PERF_READ()")
      print('ARCADE_PHASER_LOOP_ACTIVE_PASS',{'fps':perf.get('fps'),'sampleCount':perf.get('sampleCount')},flush=True)
      import json
      samples=[]
      for i in range(11):
        samples.append(await page.evaluate("""()=>{const f=document.getElementById('hqArcadeFrame'),w=f.contentWindow,s=w.__testArcadePosition(),p=w.HOJA_V064_PERF_READ();return {...s,wall:performance.now(),fps:p.fps,frameCount:p.sampleCount,visibility:f.contentDocument.visibilityState}}"""))
        if i<10: await page.wait_for_timeout(1000)
      print('ARCADE_CLOCK_WALL_SAMPLES',json.dumps(samples,ensure_ascii=False),flush=True)
      assert not errors and not dialogs,(errors,dialogs)
      await browser.close()
if __name__=='__main__':asyncio.run(main())
