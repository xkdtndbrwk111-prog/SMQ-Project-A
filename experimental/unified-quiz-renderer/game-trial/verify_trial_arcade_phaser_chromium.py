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
 p.add_argument('--rounds',type=int,choices=[2,25],default=2)
 p.add_argument('--collision-first',action='store_true')
 p.add_argument('--finish-check',action='store_true')
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
  if args.rounds==25:
   # Speed only the QA in-memory renderer feedback delay; never edit the game source.
   anchor="        if(correct)this.celebrateCorrect();\n      },1100);"
   assert inner.count(anchor)==1,'Original approved arcade feedback-delay anchor changed'
   inner=inner.replace(anchor,anchor.replace('1100','150'),1)
  inner=inner.replace('window.HOJA_V049_QA=',
    'window.__QA_ACTIVE_SCENE__=()=>ACTIVE_SCENE;window.__QA_RUN__=()=>RUN;'+
    'window.__QA_STAGE_INDEX__=()=>STAGE_INDEX;'+
    'window.__QA_START_STAGE__=(index,fresh)=>{startStage(index,fresh);HOJA_RANK_TEST_MODE_=true;};'+
    'window.HOJA_V049_QA=',1)
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
  for i in range(args.rounds):
   before=await page.evaluate('''()=>{
    const w=document.getElementById('hqArcadeFrame').contentWindow,s=w.__QA_ACTIVE_SCENE__(),r=w.__QA_RUN__();
    return {score:s.score,answered:s.quizAnswered,correct:s.correctQuizCount,found:r.found}
   }''')
   await page.evaluate('''(input)=>{
    const {i,collisionFirst}=input;
    const w=document.getElementById('hqArcadeFrame').contentWindow;
    const s=w.__QA_ACTIVE_SCENE__();
    if(i===0 && collisionFirst){
      const target=s.enemies.find(e=>e.alive&&e.type==='BALLOONEY');
      if(!target)throw Error('NO_ORIGINAL_BALLOON_IN_WORLD');
      const original={x:s.playerBody.x,y:s.playerBody.y};
      const others=s.enemies.filter(e=>e!==target).map(e=>({e,alive:e.alive}));
      for(const {e} of others)e.alive=false;
      s.playerBody.body.reset(target.bodyObj.x,target.bodyObj.y);
      try{s.handlePlayerEnemyCollisions(performance.now())}
      finally{
        for(const {e,alive} of others)e.alive=alive;
        s.playerBody.body.reset(original.x,original.y);
      }
      if(!target.consumed||target.alive||!s.quizActive)throw Error('PHASER_COLLISION_BALLOON_NOT_CONSUMED');
      w.__QA_REAL_BALLOON_COLLISION__={memKey:target.memKey,found:w.__QA_RUN__().found};
      return;
    }
    const sprite=s.add.rectangle(s.playerBody.x,s.playerBody.y,12,18,0xffd055);
    const e={alive:true,type:'BALLOONEY',memKey:'qa-balloon-'+i,
      bodyObj:{x:s.playerBody.x,body:{center:{y:s.playerBody.y},enable:true},setActive(){}},
      sprite};
    s.showQuiz(e);
    if(!e.consumed || e.alive)throw Error('ORIGINAL_BALLOON_NOT_CONSUMED');
   }''',{'i':i,'collisionFirst':args.collision_first})
   if i==0 and args.collision_first:
    proof=await page.evaluate("document.getElementById('hqArcadeFrame').contentWindow.__QA_REAL_BALLOON_COLLISION__")
    assert proof and proof['found']==1,proof
    print('ARCADE_WORLD_BALLOON_COLLISION_HANDLER_PASS',proof,flush=True)
   # Match the ACTIVE canonical question, not stale buttons from the last iframe show().
   family=await page.evaluate("""()=>{
    const w=document.getElementById('hqArcadeFrame').contentWindow;
    return w.__QA_RUN__().step09History.at(-1).key.split('\\u0000').at(-1);
   }""")
   row=next(r for e in sources for r in e['data']['questions'] if r['familyId']==family)
   canonical=row['rendererQuestion']
   await page.wait_for_function("""(prompt)=>{
     const f=document.getElementById('hojaArcadeApprovedParentFrame');
     return f?.style.visibility==='visible' &&
       f?.contentDocument?.getElementById('hqQuestion')?.textContent?.trim()===prompt &&
       f?.contentDocument?.querySelectorAll('#hqChoices button.hqChoice').length>=2 &&
       document.getElementById('hojaArcadeApprovedParentOverlay')?.style.display==='block';
   }""",arg=canonical['prompt'],timeout=30000)
   answer=canonical['answer']
   correct_id=str(answer['value']).lower() if row['type']=='OX' else answer['choiceId']
   choices=await page.evaluate("""()=>{
    return [...document.querySelector('#hojaArcadeApprovedParentFrame').contentDocument.querySelectorAll('#hqChoices button.hqChoice')].map(b=>b.dataset.choice);
   }""")
   assert correct_id in choices,(family,choices,correct_id)
   choose_id=correct_id if i%2==0 else next(v for v in choices if v!=correct_id)
   await page.frame_locator('#hojaArcadeApprovedParentFrame').locator('button.hqChoice[data-choice="'+choose_id+'"]').click(timeout=15000)
   await page.wait_for_function('''(v)=>document.getElementById('hqArcadeFrame').contentWindow.__QA_ACTIVE_SCENE__()?.quizAnswered===v''',arg=i+1,timeout=10000)
   state=await page.evaluate('''()=>{
    const w=document.getElementById('hqArcadeFrame').contentWindow,s=w.__QA_ACTIVE_SCENE__(),r=w.__QA_RUN__();
    return {score:s.score,answered:s.quizAnswered,correct:s.correctQuizCount,
      found:r.found,history:r.step09History?.at(-1),paused:s.scene.isPaused()}
   }''')
   assert state['answered']==before['answered']+1,state
   assert state['found']==before['found']+1,state
   assert state['history'] and state['history']['correct'] is (i%2==0),state
   assert state['score']==before['score']+(10 if state['history']['correct'] else 0),(before,state)
   await page.wait_for_function('''()=>document.querySelector('#hojaArcadeApprovedParentOverlay')?.style.display==='none' ''',timeout=10000)
   await page.wait_for_function("""()=>{
    const w=document.getElementById('hqArcadeFrame').contentWindow;
    return w.__QA_ACTIVE_SCENE__()?.scene.isPaused()===false;
   }""",timeout=10000)
   print('ARCADE_ORIGINAL_SHOWQUIZ_FINISH_PASS',i+1,'expectedCorrect',i%2==0,state,flush=True)
  if args.rounds==25:
   totals=await page.evaluate("""()=>{
    const w=document.getElementById('hqArcadeFrame').contentWindow;
    const r=w.__QA_RUN__(),s=w.__QA_ACTIVE_SCENE__();
    return {found:r.found,answered:s.quizAnswered,correct:s.correctQuizCount,
      score:s.score,unique:r.step09Families.size,history:r.step09History.length,
      correctHistory:r.step09History.filter(h=>h.correct===true).length,
      points:r.step09History.reduce((sum,h)=>sum+h.points,0)};
   }""")
   assert totals=={'found':25,'answered':25,'correct':13,'score':130,
      'unique':25,'history':25,'correctHistory':13,'points':130},totals
   blocked=await page.evaluate("""()=>{
    const w=document.getElementById('hqArcadeFrame').contentWindow;
    const s=w.__QA_ACTIVE_SCENE__();
    const sprite=s.add.rectangle(s.playerBody.x,s.playerBody.y,12,18,0xffd055);
    const balloon={alive:true,type:'BALLOONEY',memKey:'qa-26-blocked',
      bodyObj:{x:s.playerBody.x,body:{center:{y:s.playerBody.y},enable:true},setActive(){}},
      sprite};
    s.showQuiz(balloon);
    return {consumed:!!balloon.consumed,alive:balloon.alive,
      found:w.__QA_RUN__().found,history:w.__QA_RUN__().step09History.length,
      warning:w.document.getElementById('step09State')?.textContent||''};
   }""")
   assert not blocked['consumed'] and blocked['alive'] and blocked['found']==25 and blocked['history']==25,blocked
   print('ARCADE_REAL_PHASER_25_BALLOON_DECK_PASS',totals,'blocked26th',blocked,flush=True)
   if args.finish_check:
    # Enter the LAST stage through the original game stage transition API.
    # Mark it test-only, so this run is NEVER eligible for server ranking writes.
    await page.evaluate("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow;
      w.__QA_START_STAGE__(3,false);
    }""")
    await page.wait_for_function("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow,s=w.__QA_ACTIVE_SCENE__();
      return w.__QA_STAGE_INDEX__()===3 && s?.doors?.some(d=>d.kind==='finish') && !s?.transitioning;
    }""",timeout=45000)
    await page.evaluate("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow,s=w.__QA_ACTIVE_SCENE__();
      const door=s.doors.find(d=>d.kind==='finish');
      s.enterDoor(door);
    }""")
    await page.wait_for_function("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow;
      return w.document.getElementById('step09RunResult')?.style.display==='block' &&
        document.getElementById('hojaArcadeReviewBar')?.style.display==='flex' &&
        window.HOJA_ARCADE_APPROVED_TRIAL?.state?.reviewCount===12 &&
        !w.document.getElementById('hojaRankOverlay')?.classList.contains('is-open');
    }""",timeout=25000)
    before_review=await page.evaluate("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow;
      return {metrics:w.HOJA_STEP09_3_TEST.metrics(),
        wrong:w.HOJA_STEP09_3_TEST.history().filter(x=>x.correct===false).map(x=>x.key)};
    }""")
    assert len(before_review['wrong'])==12,before_review
    for n,key in enumerate(before_review['wrong']):
      family=key.split(chr(0))[-1]
      expected=next(r['rendererQuestion']['prompt'] for e in sources for r in e['data']['questions'] if r['familyId']==family)
      await page.wait_for_function("""(x)=>{
        const f=document.getElementById('hojaArcadeApprovedParentFrame'),s=window.HOJA_ARCADE_APPROVED_TRIAL?.state;
        return s?.reviewIndex===x.index && s?.reviewCount===12 &&
          f?.style.visibility==='visible' &&
          f?.contentDocument?.getElementById('hqQuestion')?.textContent?.trim()===x.prompt;
      }""",arg={'index':n,'prompt':expected},timeout=20000)
      label=await page.locator('#hojaArcadeReviewLabel').inner_text()
      assert ('오답 복습 '+str(n+1)+'/12') in label and '정답:' in label,label
      await page.locator('#hojaArcadeReviewNext').click(timeout=15000)
    await page.wait_for_function("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow;
      return window.HOJA_ARCADE_APPROVED_TRIAL?.state?.reviewCount===0 &&
        document.getElementById('hojaArcadeApprovedParentOverlay')?.style.display==='none' &&
        w.document.getElementById('hojaRankOverlay')?.classList.contains('is-open');
    }""",timeout=20000)
    after_review=await page.evaluate("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow;
      return w.HOJA_STEP09_3_TEST.metrics();
    }""")
    assert before_review['metrics']==after_review,(before_review,after_review)
    print('ARCADE_REAL_PHASER_APPROVED_WRONG_REVIEW_PASS',len(before_review['wrong']),'unchangedScore',after_review['score'],flush=True)
    finish=await page.evaluate("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow;
      const result=w.HOJA_STEP09_3_TEST.result(),stats=w.HOJA_STEP09_3_TEST.metrics();
      const rank=w.HOJA_STEP10_RANK_UI.status();
      return {stage:w.__QA_STAGE_INDEX__(),result,stats,rank,
        title:w.document.getElementById('step09RunResultTitle')?.textContent,
        rankLabel:w.document.getElementById('hojaRankResultType')?.textContent,
        message:w.document.getElementById('hojaRankMessage')?.textContent};
    }""")
    assert finish['stage']==3 and finish['result']['verified']=='true',finish
    assert finish['stats']['found']==25 and finish['stats']['answered']==25 and finish['stats']['quizPoints']==130,finish
    assert finish['rank']['open'] and finish['rank']['serverSaved'] is False,finish
    assert finish['rankLabel']=='FINISH' and '전체 스테이지 완료' in finish['title'],finish
    assert '시험용 이동' in finish['message'],finish
    print('ARCADE_REAL_PHASER_FINISH_RESULT_RANK_READONLY_PASS',finish,flush=True)
    # Independent TIME UP path: no finish rank even with a valid test scene.
    await page.evaluate("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow;
      w.__QA_START_STAGE__(0,true);
    }""")
    await page.wait_for_function("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow;
      const s=w.__QA_ACTIVE_SCENE__();
      return w.__QA_STAGE_INDEX__()===0 && !!s?.playerBody &&
        !s.clear && !s.timeUp && s.remainingMs>0 &&
        s.scene?.isActive?.()===true &&
        w.document.getElementById('hojaRankOverlay')?.classList.contains('is-open')===false;
    }""",timeout=45000)
    await page.evaluate("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow;
      w.__QA_ACTIVE_SCENE__().startTimeUp();
    }""")
    await page.wait_for_function("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow;
      return w.document.getElementById('step09RunResult')?.style.display==='block' &&
        w.document.getElementById('hojaRankOverlay')?.classList.contains('is-open');
    }""",timeout=20000)
    timeout=await page.evaluate("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow;
      return {rank:w.HOJA_STEP10_RANK_UI.status(),
        title:w.document.getElementById('step09RunResultTitle')?.textContent,
        type:w.document.getElementById('hojaRankResultType')?.textContent,
        message:w.document.getElementById('hojaRankMessage')?.textContent};
    }""")
    assert timeout['type']=='TIME UP' and '시간 종료' in timeout['title'],timeout
    assert timeout['rank']['open'] and timeout['rank']['serverSaved'] is False,timeout
    assert '랭킹 등록은 FINISH로만' in timeout['message'],timeout
    print('ARCADE_REAL_PHASER_TIMEUP_RANK_READONLY_PASS',timeout,flush=True)
  await browser.close()

if __name__=='__main__':asyncio.run(run())
