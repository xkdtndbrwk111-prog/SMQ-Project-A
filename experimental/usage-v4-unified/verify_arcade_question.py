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
      await page.evaluate("""()=>{if(typeof window.HOJA_TT_ARCADE_BRIDGE_SOURCE!=='string')throw Error('ARCADE_BRIDGE_MISSING');window.HOJA_TT_ARCADE_BRIDGE_SOURCE+=`\nwindow.__testArcadePosition=()=>({x:ACTIVE_SCENE?.playerBody?.x,y:ACTIVE_SCENE?.playerBody?.y,answered:ACTIVE_SCENE?.quizAnswered,correct:ACTIVE_SCENE?.correctQuizCount,remainingMs:ACTIVE_SCENE?.remainingMs,quizActive:ACTIVE_SCENE?.quizActive,dying:ACTIVE_SCENE?.dying,paused:ACTIVE_SCENE?.manualPaused,deathDialog:ACTIVE_SCENE?._hojaDeathDialogOpen,keyD:ACTIVE_SCENE?.keys?.d?.isDown,keyShift:ACTIVE_SCENE?.keys?.run?.isDown,keyA:ACTIVE_SCENE?.keys?.a?.isDown,bodyVx:ACTIVE_SCENE?.playerBody?.body?.velocity?.x,bodyVy:ACTIVE_SCENE?.playerBody?.body?.velocity?.y});\n`;}""")
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
      arcade=page.frame_locator('#hqArcadeFrame')
      await arcade.locator('#gameViewport canvas').first.click(timeout=15000)
      for _ in range(4):
        await page.keyboard.press('Enter');await page.wait_for_timeout(400)
      await page.evaluate("""()=>{const w=document.getElementById('hqArcadeFrame').contentWindow;w.__testArcadeKeys=[];for(const t of ['keydown','keyup'])w.addEventListener(t,e=>{if(['KeyA','KeyD'].includes(e.code))w.__testArcadeKeys.push({type:t,code:e.code,trusted:e.isTrusted,time:performance.now()})},true)}""")
      for key,code in (('a','KeyA'),('d','KeyD')):
        origin=await page.evaluate("document.getElementById('hqArcadeFrame').contentWindow.__testArcadePosition()")
        assert isinstance(origin.get('x'),(int,float)),('ARCADE_POSITION_MISSING',origin)
        await page.keyboard.down(key)
        try:
          await page.wait_for_function("v=>{const w=document.getElementById('hqArcadeFrame').contentWindow,p=w.HOJA_V064_PERF_READ(),x=w.__testArcadePosition().x;return p.connection==='OK'&&!p.paused&&(x-v.origin)*v.direction>1}",arg={'origin':origin['x'],'direction':-1 if key=='a' else 1},timeout=15000)
          movement=await page.evaluate("document.getElementById('hqArcadeFrame').contentWindow.HOJA_V064_PERF_READ()")
          destination=await page.evaluate("document.getElementById('hqArcadeFrame').contentWindow.__testArcadePosition()")
          if key=='a':await page.wait_for_timeout(1500)  # move away from the observed initial right-side obstruction
        except Exception:
          diag=await page.evaluate("""()=>{const f=document.getElementById('hqArcadeFrame'),w=f.contentWindow;return {outerFocus:document.activeElement?.id,innerFocus:f.contentDocument.activeElement?.tagName,keys:w.__testArcadeKeys,perf:w.HOJA_V064_PERF_READ()}}""")
          print('ARCADE_MOVEMENT_DIAGNOSTIC',{'key':key,'details':diag},flush=True);raise
        finally:await page.keyboard.up(key)
        keys=await page.evaluate("document.getElementById('hqArcadeFrame').contentWindow.__testArcadeKeys")
        assert any(x['type']=='keydown' and x['code']==code and x['trusted'] for x in keys),('ARCADE_KEYDOWN_NOT_DELIVERED',keys)
        print('ARCADE_REAL_KEY_MOVEMENT_PASS',{'code':code,'from':origin,'to':destination,'movingRatio':movement['movingRatio'],'keys':keys},flush=True)
      reached=False
      await page.keyboard.down('d');await page.keyboard.down('Shift')
      try:
        for i in range(180):
          await page.keyboard.down('Space');await page.wait_for_timeout(180);await page.keyboard.up('Space');await page.wait_for_timeout(320)
          if i%20==0: print('ARCADE_PLAYER_PROGRESS',i,await page.evaluate("document.getElementById('hqArcadeFrame').contentWindow.__testArcadePosition()"),flush=True)
          if await page.evaluate("!!window.HOJA_ARCADE_APPROVED_TRIAL?.state?.activeId"):
            reached=True;break
      finally:
        await page.keyboard.up('Shift');await page.keyboard.up('d')
      if reached:
        await page.wait_for_function("(()=>{let f=document.getElementById('hojaArcadeApprovedParentFrame');return f&&getComputedStyle(f).visibility==='visible'&&f.contentWindow?.current?.()&&f.contentDocument?.querySelectorAll('#hqChoices button.hqChoice').length})()",timeout=30000)
        q=await page.evaluate("document.getElementById('hojaArcadeApprovedParentFrame').contentWindow.current()")
        before=await page.evaluate("document.getElementById('hqArcadeFrame').contentWindow.__testArcadePosition()")
        assert before['quizActive'],before
        await page.wait_for_timeout(2000)
        during=await page.evaluate("document.getElementById('hqArcadeFrame').contentWindow.__testArcadePosition()")
        assert during['quizActive'] and during['remainingMs']==before['remainingMs'],('CLOCK_CHANGED_DURING_QUESTION',before,during)
        frame=page.frame_locator('#hojaArcadeApprovedParentFrame')
        if q['type']=='SHORT':
          await frame.locator('button.hqChoice').first.click();await frame.locator('button.teacher-judge.correct').first.click()
        else:
          import json
          value=q['answer'].get('value');choice=(json.dumps(value) if isinstance(value,bool) else str(value)) if q['type']=='OX' else q['answer']['choiceId']
          await frame.locator('button.hqChoice[data-choice="'+choice+'"]' ).click()
        await page.wait_for_function("n=>document.getElementById('hqArcadeFrame').contentWindow.__testArcadePosition().answered>n",arg=before['answered'],timeout=30000)
        await page.wait_for_function("(()=>{let x=document.getElementById('hqArcadeFrame').contentWindow.__testArcadePosition();return !x.quizActive})()",timeout=30000)
        after=await page.evaluate("document.getElementById('hqArcadeFrame').contentWindow.__testArcadePosition()")
        assert after['answered']==before['answered']+1 and after['correct']==before['correct']+1,(before,after)
        await page.wait_for_timeout(1200)
        resumed=await page.evaluate("document.getElementById('hqArcadeFrame').contentWindow.__testArcadePosition()")
        assert 0<after['remainingMs']-resumed['remainingMs']<5000,(after,resumed)
        assert abs(resumed['x']-after['x'])<200,(after,resumed)
        print('ARCADE_PLAYER_QUESTION_ANSWERED_PASS',q['type'],before,after,resumed,flush=True)
      else: raise AssertionError('ARCADE_PLAYER_QUESTION_NOT_REACHED')
      await page.evaluate("window.HOJA_ATTRACT_CONTROL.restart()")
      await page.wait_for_function("window.HOJA_ATTRACT_GAME.loop.running&&!window.HOJA_ATTRACT_SCENE.scene.isPaused()",timeout=15000)
      t0=await page.evaluate('window.HOJA_ATTRACT_SCENE.elapsedMs');await page.wait_for_timeout(1000);t1=await page.evaluate('window.HOJA_ATTRACT_SCENE.elapsedMs')
      assert 200<t1-t0<1600,('INTRO_TIME_DELTA',t0,t1)
      print('ARCADE_INTRO_RESTART_PASS',round(t1-t0),flush=True)
      # Observe scene animation and SFX requests; this does not assess audible hardware output.
      await page.evaluate("""()=>{const a=window.HOJA_INTRO_AUDIO;window.__introSfxCalls=[];const play=a.play;a.play=function(...args){const result=play.apply(this,args);window.__introSfxCalls.push({name:args[0],accepted:result});return result}}""")
      first=await page.evaluate("({x:window.HOJA_ATTRACT_SCENE.hoja.x,frame:window.HOJA_ATTRACT_SCENE.hoja.frame.name,enabled:window.HOJA_INTRO_AUDIO.enabled})")
      await page.wait_for_timeout(1800)
      last=await page.evaluate("({x:window.HOJA_ATTRACT_SCENE.hoja.x,frame:window.HOJA_ATTRACT_SCENE.hoja.frame.name,calls:window.__introSfxCalls})")
      assert first['x']!=last['x'] or first['frame']!=last['frame'],('INTRO_ANIMATION_STATIC',first,last)
      assert first['enabled'] and any(x['accepted'] for x in last['calls']),('INTRO_SFX_NOT_EMITTED',first,last)
      print('ARCADE_INTRO_ANIMATION_SFX_REQUEST_PASS',{'audioEnabled':first['enabled'],'sfxCalls':len(last['calls'])},flush=True)
      assert not errors and not dialogs,(errors,dialogs)
      print('ARCADE_ISOLATED_PASS',flush=True);await browser.close()
if __name__=='__main__':asyncio.run(main())
