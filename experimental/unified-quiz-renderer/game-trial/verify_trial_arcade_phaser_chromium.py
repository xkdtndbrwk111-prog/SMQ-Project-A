#!/usr/bin/env python3
"""Exact trial HTML + actual Phaser 4.2.1 + original arcade HojaScene.showQuiz().
Uses QA-injected synthetic balloons, not naturally piloted player collision.
No GAS, live ranking, or production writes.
"""
import argparse,asyncio,shutil
from pathlib import Path
from playwright.async_api import async_playwright,TimeoutError as PWTimeout
from verify_trial_chromium import social6_sources

ROOT=Path(__file__).resolve().parent

async def run():
 p=argparse.ArgumentParser()
 p.add_argument('--html',type=Path,required=True)
 p.add_argument('--phaser',type=Path,required=True)
 args=p.parse_args()
 assert args.phaser.is_file() and args.phaser.stat().st_size>500_000,'Phaser 4.2.1 library unavailable'
 sources=social6_sources((ROOT.parent/'HOJA_APPROVED_RENDERER_BRIDGE.html').read_text())
 original=args.html.read_text()
 async with async_playwright() as pw:
  chrome=shutil.which('chromium') or shutil.which('google-chrome-stable')
  config={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
  if chrome:config['executable_path']=chrome
  browser=await pw.chromium.launch(**config)
  page=await browser.new_page(viewport={'width':1280,'height':800})
  console_errors=[];loaded=[0]
  page.on('pageerror',lambda e:console_errors.append(str(e)))
  page.on('dialog',lambda d:asyncio.create_task(d.dismiss()))
  async def phaser_route(route):
   loaded[0]+=1
   await route.fulfill(path=str(args.phaser),content_type='application/javascript')
  await page.route('**/phaser.min.js',phaser_route)
  await page.set_content(original,wait_until='domcontentloaded',timeout=90000)
  await page.evaluate('''(sources)=>{
   window.HOJA_B_LIVE.setSources(sources);
   window.HOJA_ARCADE_APPROVED_TRIAL.configure(sources);
   const host=document.getElementById('hojaGamePlay');
   host.hidden=false;host.dataset.mode='arcade';
   document.getElementById('hqArcadeFrame').hidden=false;
  }''',sources)
  inner=await page.evaluate('window.HOJA_GAMEPLAY.getCanonicalArcade()')
  assert inner.count('window.HOJA_V049_QA=')==1
  inner=inner.replace('window.HOJA_V049_QA=',
    'window.__QA_ACTIVE_SCENE__=()=>ACTIVE_SCENE;window.__QA_RUN__=()=>RUN;window.HOJA_V049_QA=',1)
  await page.evaluate('''(inner)=>{
    document.getElementById('hqArcadeFrame').srcdoc=inner;
  }''',inner)
  try:
   await page.wait_for_function('''()=>{
    const w=document.getElementById('hqArcadeFrame')?.contentWindow;
    return typeof w?.HOJA_STEP10_RPC==='function' && typeof w?.__QA_ACTIVE_SCENE__==='function';
   }''',timeout=60000)
   await page.evaluate('''(sources)=>{
    document.getElementById('hqArcadeFrame').contentWindow.postMessage({
      type:'HOJA_V058_ARCADE_START',sources,names:sources.map(s=>s.sheetName)
    },'*');
   }''',sources)
   await page.wait_for_function('''()=>{
    const w=document.getElementById('hqArcadeFrame')?.contentWindow;
    return !!w?.__QA_ACTIVE_SCENE__?.() &&
      w.document.getElementById('gameViewport')?.dataset.boot==='ready';
   }''',timeout=90000)
  except PWTimeout:
   diag=await page.evaluate('''()=>{
    const w=document.getElementById('hqArcadeFrame')?.contentWindow;
    return {boot:w?.document?.getElementById('bootStatus')?.textContent,
      error:w?.document?.getElementById('bootError')?.textContent,
      phaser:!!w?.Phaser,scene:!!w?.__QA_ACTIVE_SCENE__?.(),
      parent:document.getElementById('hqArcadeInfo')?.textContent}
   }''')
   print('REAL_PHASER_ARCADE_BOOT_BLOCKED',diag,'requests',loaded,'errors',console_errors[-8:],flush=True)
   raise
  print('ARCADE_REAL_PHASER_BOOT_PASS version',
   await page.evaluate("document.getElementById('hqArcadeFrame').contentWindow.Phaser.VERSION"),
   'phaserScriptsServed',loaded[0],flush=True)
  # Drive actual original showQuiz(e) method, not a synthetic callback.
  for i in range(2):
   before=await page.evaluate('''()=>{
    const w=document.getElementById('hqArcadeFrame').contentWindow,s=w.__QA_ACTIVE_SCENE__(),r=w.__QA_RUN__();
    return {score:s.score,answered:s.quizAnswered,correct:s.correctQuizCount,found:r.found}
   }''')
   await page.evaluate('''(i)=>{
    const w=document.getElementById('hqArcadeFrame').contentWindow;
    const s=w.__QA_ACTIVE_SCENE__();
    const sprite=s.add.rectangle(s.playerBody.x,s.playerBody.y,12,18,0xffd055);
    const centerY=s.playerBody.y;
    const e={alive:true,type:'BALLOONEY',memKey:'qa-balloon-'+i,
      bodyObj:{x:s.playerBody.x,body:{center:{y:centerY},enable:true},setActive(){}},
      sprite};
    s.showQuiz(e);
    if(!e.consumed || e.alive)throw Error('ORIGINAL_BALLOON_NOT_CONSUMED');
   }''',i)
   await page.wait_for_function('''()=>document.querySelector('#hojaArcadeApprovedParentOverlay')?.style.display==='block' &&
    !!document.querySelector('#hojaArcadeApprovedParentFrame')?.contentDocument?.querySelector('#hqChoices button.hqChoice')''',timeout=30000)
   # Choose the original approved answer on first question and a wrong answer on second.
   family=await page.evaluate("""()=>{
    const w=document.getElementById('hqArcadeFrame').contentWindow;
    return w.__QA_RUN__().step09History.at(-1).key.split('\\u0000').at(-1);
   }""")
   row=next(r for e in sources for r in e['data']['questions'] if r['familyId']==family)
   canonical=row['rendererQuestion']
   answer=canonical['answer']
   correct_id=str(answer['value']).lower() if row['type']=='OX' else answer['choiceId']
   choices=await page.evaluate("""()=>{
    return [...document.querySelector('#hojaArcadeApprovedParentFrame').contentDocument.querySelectorAll('#hqChoices button.hqChoice')].map(b=>b.dataset.choice);
   }""")
   assert correct_id in choices,(family,choices,correct_id)
   choose_id=correct_id if i==0 else next(v for v in choices if v!=correct_id)
   await page.frame_locator('#hojaArcadeApprovedParentFrame').locator('button.hqChoice[data-choice="'+choose_id+'"]').click(timeout=15000)
   await page.wait_for_function('''(v)=>document.getElementById('hqArcadeFrame').contentWindow.__QA_ACTIVE_SCENE__()?.quizAnswered===v''',arg=i+1,timeout=10000)
   state=await page.evaluate('''()=>{
    const w=document.getElementById('hqArcadeFrame').contentWindow,s=w.__QA_ACTIVE_SCENE__(),r=w.__QA_RUN__();
    return {score:s.score,answered:s.quizAnswered,correct:s.correctQuizCount,
      found:r.found,history:r.step09History?.at(-1),paused:s.scene.isPaused()}
   }''')
   assert state['answered']==before['answered']+1,state
   assert state['found']==before['found']+1,state
   assert state['history'] and state['history']['correct'] is (i==0),state
   assert state['score']==before['score']+(10 if state['history']['correct'] else 0),(before,state)
   await page.wait_for_function('''()=>document.querySelector('#hojaArcadeApprovedParentOverlay')?.style.display==='none' ''',timeout=10000)
   await page.wait_for_function("""()=>{
    const w=document.getElementById('hqArcadeFrame').contentWindow;
    return w.__QA_ACTIVE_SCENE__()?.scene.isPaused()===false;
   }""",timeout=10000)
   print('ARCADE_ORIGINAL_SHOWQUIZ_FINISH_PASS',i+1,'expectedCorrect',i==0,state,flush=True)
  await browser.close()

if __name__=='__main__':asyncio.run(run())
