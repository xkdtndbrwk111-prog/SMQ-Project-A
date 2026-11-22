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
 p.add_argument('--keyboard-smoke',action='store_true')
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
  if args.keyboard_smoke:
   # These are real Chromium keyboard events in the active arcade iframe.
   # A/D movement and S crouch MUST flow through original Phaser update().
   arcade=page.frame_locator('#hqArcadeFrame')
   await arcade.locator('#gameViewport').click(position={'x':160,'y':150},timeout=12000)
   await page.wait_for_function("""()=>{
     const w=document.getElementById('hqArcadeFrame').contentWindow,s=w.__QA_ACTIVE_SCENE__();
     return s?.scene?.isActive?.()===true && !!s?.playerBody && !s.transitioning && !s.quizActive;
   }""",timeout=10000)
   start=await page.evaluate("""()=>{
     const s=document.getElementById('hqArcadeFrame').contentWindow.__QA_ACTIVE_SCENE__();
     return {x:s.playerBody.x,frame:s.game.loop.frame,stage:0};
   }""")
   try:
    await page.keyboard.down('d')
    await page.wait_for_function("""x=>{
      const s=document.getElementById('hqArcadeFrame').contentWindow.__QA_ACTIVE_SCENE__();
      return s?.keys.d.isDown && (s.playerBody.x>x+6 || s.playerBody.body.velocity.x>20);
    }""",arg=start['x'],timeout=9000)
   finally:
    await page.keyboard.up('d')
   after_d=await page.evaluate("document.getElementById('hqArcadeFrame').contentWindow.__QA_ACTIVE_SCENE__().playerBody.x")
   try:
    await page.keyboard.down('a')
    await page.wait_for_function("""x=>{
      const s=document.getElementById('hqArcadeFrame').contentWindow.__QA_ACTIVE_SCENE__();
      return s?.keys.a.isDown && (s.playerBody.x<x-6 || s.playerBody.body.velocity.x< -20);
    }""",arg=after_d,timeout=9000)
   finally:
    await page.keyboard.up('a')
   after_a=await page.evaluate("document.getElementById('hqArcadeFrame').contentWindow.__QA_ACTIVE_SCENE__().playerBody.x")
   await page.wait_for_function("""()=>{
     const b=document.getElementById('hqArcadeFrame').contentWindow.__QA_ACTIVE_SCENE__()?.playerBody?.body;
     return !!(b?.blocked?.down||b?.touching?.down);
   }""",timeout=7000)
   try:
    await page.keyboard.down('s')
    await page.wait_for_function("""()=>{
      const s=document.getElementById('hqArcadeFrame').contentWindow.__QA_ACTIVE_SCENE__();
      return s?.keys.s.isDown && s.hojaIsSitting===true && s.playerBody.body.height<=23;
    }""",timeout=7000)
   finally:
    await page.keyboard.up('s')
   await page.wait_for_function("""()=>{
     const s=document.getElementById('hqArcadeFrame').contentWindow.__QA_ACTIVE_SCENE__();
     return s?.hojaIsSitting===false && s.playerBody.body.height>=40;
   }""",timeout=7000)
   print('ARCADE_REAL_KEYBOARD_ADS_PHASER_PASS',{'startX':start['x'],'rightX':after_d,'leftX':after_a},flush=True)
   # Live Phaser key bindings: COMMA run and PERIOD jump, not Shift/X/Space/Z.
   mapping=await page.evaluate("""()=>{
     const w=document.getElementById('hqArcadeFrame').contentWindow,s=w.__QA_ACTIVE_SCENE__(),K=w.Phaser.Input.Keyboard.KeyCodes;
     return {run:s.keys.run.keyCode,comma:K.COMMA,jump:s.keys.jump.keyCode,period:K.PERIOD};
   }""")
   assert mapping['run']==mapping['comma'] and mapping['jump']==mapping['period'],mapping
   await arcade.locator('#gameViewport').click(position={'x':160,'y':150},timeout=12000)
   pre_help=await page.evaluate("""()=>{
     const w=document.getElementById('hqArcadeFrame').contentWindow,s=w.__QA_ACTIVE_SCENE__();
     w.__QA_H_KEY_LOG__=[];w.addEventListener('keydown',e=>{if(e.code==='KeyH')w.__QA_H_KEY_LOG__.push(e.code)},true);
     return {helpExists:!!w.document.getElementById('hojaTrialControlsHelp'),app:!!w.HOJA_PHASER_APP,
       appSceneMatches:w.HOJA_PHASER_APP?.scene?.()===s,
       focus:w.document.activeElement?.id,
       flags:{dying:s.dying,clear:s.clear,timeUp:s.timeUp,transitioning:s.transitioning,quizActive:s.quizActive,manualPaused:s.manualPaused}};
   }""")
   print('ARCADE_H_HELP_PRECHECK',pre_help,flush=True)
   await page.keyboard.press('h')
   help_probe=await page.evaluate("""()=>{
     const w=document.getElementById('hqArcadeFrame').contentWindow;
     return {seen:w.__QA_H_KEY_LOG__,display:w.document.getElementById('hojaTrialControlsHelp')?.style.display,
       paused:w.__QA_ACTIVE_SCENE__()?.manualPaused};
   }""")
   print('ARCADE_H_HELP_AFTER_KEY',help_probe,flush=True)
   await page.wait_for_function("""()=>{
     const w=document.getElementById('hqArcadeFrame').contentWindow;
     return w.document.getElementById('hojaTrialControlsHelp')?.style.display==='grid' &&
       w.__QA_ACTIVE_SCENE__()?.manualPaused===true;
   }""",timeout=9000)
   await page.keyboard.press('h')
   await page.wait_for_function("""()=>{
     const w=document.getElementById('hqArcadeFrame').contentWindow;
     return w.document.getElementById('hojaTrialControlsHelp')?.style.display==='none' &&
       w.__QA_ACTIVE_SCENE__()?.manualPaused===false;
   }""",timeout=9000)
   try:
    await page.keyboard.down(',')
    await page.keyboard.down('d')
    await page.wait_for_function("""()=>{
      const s=document.getElementById('hqArcadeFrame').contentWindow.__QA_ACTIVE_SCENE__();
      return s?.keys.run.isDown && s?.keys.d.isDown && s.playerBody.body.velocity.x>0;
    }""",timeout=9000)
   finally:
    await page.keyboard.up('d')
    await page.keyboard.up(',')
   await page.wait_for_function("""()=>{
     const b=document.getElementById('hqArcadeFrame').contentWindow.__QA_ACTIVE_SCENE__()?.playerBody?.body;
     return !!(b?.blocked?.down||b?.touching?.down);
   }""",timeout=9000)
   try:
    await page.keyboard.down('.')
    await page.wait_for_function("""()=>{
      const s=document.getElementById('hqArcadeFrame').contentWindow.__QA_ACTIVE_SCENE__();
      return s?.keys.jump.isDown && s.playerBody.body.velocity.y< -100;
    }""",timeout=9000)
   finally:
    await page.keyboard.up('.')
   await page.wait_for_function("""()=>{
     const b=document.getElementById('hqArcadeFrame').contentWindow.__QA_ACTIVE_SCENE__()?.playerBody?.body;
     return !!(b?.blocked?.down||b?.touching?.down) && b.velocity.y>=0;
   }""",timeout=14000)
   print('ARCADE_REAL_2_0_HELP_RUN_JUMP_KEYS_PASS',mapping,flush=True)
   # QA positions the hero near the real stage exit, then emits an ACTUAL W key.
   # Stage change is performed exclusively by original updateDoors()->enterDoor().
   await page.evaluate("""()=>{
     const w=document.getElementById('hqArcadeFrame').contentWindow,s=w.__QA_ACTIVE_SCENE__();
     const d=s.doors.find(x=>x.kind==='exit');
     if(!d)throw Error('ARCADE_STAGE_EXIT_DOOR_MISSING');
     const b=s.playerBody.body;
     b.reset(d.x,d.y-b.height/2);
     b.setVelocity(0,0);
   }""")
   await page.wait_for_function("""()=>{
     const s=document.getElementById('hqArcadeFrame').contentWindow.__QA_ACTIVE_SCENE__();
     const d=s?.doors?.find(x=>x.kind==='exit'),b=s?.playerBody?.body;
     return !!d&&!!b&&Math.abs(s.playerBody.x-d.x)<24&&
       Math.abs(b.bottom-d.y)<6&&(b.blocked.down||b.touching.down);
   }""",timeout=9000)
   try:
    await page.keyboard.down('w')
    await page.wait_for_function("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow;
      return w.__QA_STAGE_INDEX__()===1 &&
        w.__QA_ACTIVE_SCENE__()?.scene.isActive()===true;
    }""",timeout=18000)
   finally:
    await page.keyboard.up('w')
   print('ARCADE_REAL_W_EXIT_STAGE_TRANSITION_PASS',flush=True)
   # Each death uses the original scene death dialog and original respawn routine.
   # No QA call to continueHojaAfterDeath: send real Chromium keyboard events.
   for death_key in ['w','a','s','d',',','.','Enter']:
    before=await page.evaluate("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow,s=w.__QA_ACTIVE_SCENE__(),r=w.__QA_RUN__();
      return {score:s.score,found:r.found,history:r.step09History.length,deaths:r.deaths||0};
    }""")
    await page.evaluate("document.getElementById('hqArcadeFrame').contentWindow.__QA_ACTIVE_SCENE__().startDeath('pit')")
    await page.wait_for_function("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow;
      return w.document.getElementById('hojaDeathOverlay')?.classList.contains('is-open') &&
        w.__QA_ACTIVE_SCENE__()?._hojaDeathDialogOpen===true;
    }""",timeout=10000)
    await page.keyboard.press(death_key)
    await page.wait_for_function("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow,s=w.__QA_ACTIVE_SCENE__();
      return s && s.dying===false && !s._hojaDeathDialogOpen &&
        !w.document.getElementById('hojaDeathOverlay').classList.contains('is-open');
    }""",timeout=10000)
    after=await page.evaluate("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow,s=w.__QA_ACTIVE_SCENE__(),r=w.__QA_RUN__();
      return {score:s.score,found:r.found,history:r.step09History.length,deaths:r.deaths||0,
        invuln:s.invulnUntil>s.time.now};
    }""")
    assert after['deaths']==before['deaths']+1 and after['invuln'],(death_key,before,after)
    assert all(after[k]==before[k] for k in ['score','found','history']),(death_key,before,after)
   print('ARCADE_REAL_DEATH_7_KEYS_RESPAWN_PASS',flush=True)
   # Restore stage 1 and the fresh 600s run before the existing full 25 quiz QA.
   await page.evaluate("""()=>{
     const w=document.getElementById('hqArcadeFrame').contentWindow;
     w.__QA_START_STAGE__(0,true);
   }""")
   await page.wait_for_function("""()=>{
     const w=document.getElementById('hqArcadeFrame').contentWindow;
     return w.__QA_STAGE_INDEX__()===0 &&
       w.__QA_ACTIVE_SCENE__()?.scene.isActive()===true &&
       w.__QA_RUN__().found===0 &&
       w.__QA_RUN__().step09History.length===0 &&
       !w.__QA_ACTIVE_SCENE__().transitioning;
   }""",timeout=16000)
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
        const bar=document.getElementById('hojaArcadeReviewBar');
        return s?.reviewIndex===x.index && s?.reviewCount===12 &&
          f?.style.visibility==='visible' &&
          !!bar && f.getBoundingClientRect().top>=bar.getBoundingClientRect().bottom-1 &&
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
    # Existing Code.gs accepts NFC Hangul, Latin and numbers 2-6 chars.
    # All browser RPCs below are read-only: never touch GAS or saved rank records.
    rank_frame=page.frame_locator('#hqArcadeFrame')
    name_input=rank_frame.locator('#hojaRankName')
    enter=rank_frame.locator('#hojaRankEnter')
    for value,normalized in [('호자','호자'),('김하늘','김하늘'),
                             ('ABC123','ABC123'),('ab','AB'),('A9','A9'),
                             ('가나다라마바','가나다라마바')]:
      await name_input.fill(value)
      assert (await name_input.input_value())==normalized,(value,await name_input.input_value())
      assert await enter.is_enabled(),value
    for invalid in ['A','SEX','XES','EXS','SXE']:
      await name_input.fill(invalid)
      assert not await enter.is_enabled(),invalid
    # Korean IME must not be sanitized while it is composing a syllable.
    ime_state=await name_input.evaluate("""el=>{
      el.value='';
      el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
      el.value='ㅎ';
      el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,data:'ㅎ'}));
      const inProgress=el.value;
      el.value='하';
      el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));
      return {inProgress,final:el.value};
    }""")
    assert ime_state=={'inProgress':'ㅎ','final':'하'},ime_state
    await name_input.fill('호자')
    await page.evaluate("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow;
      w.__QA_RANK_RPC_CALLS__=[];
      w.HOJA_STEP10_RPC=async(method,payload)=>{
        w.__QA_RANK_RPC_CALLS__.push({method,payload});
        if(method!=='RANK_LIST')throw Error('LIVE_RANK_WRITE_FORBIDDEN');
        return {rows:[
          {name:'김하늘',score:900,correct:22,found:25},
          {name:'ABC123',score:800,correct:20,found:25},
          {name:'A9',score:700,correct:18,found:25},
          {name:'SEX',score:1000,correct:25,found:25},
          {name:'TOOLONG',score:650,correct:17,found:25},
          {name:'a9',score:600,correct:16,found:25}
        ]};
      };
    }""")
    await enter.click(timeout=12000)
    await page.wait_for_function("""()=>{
      const w=document.getElementById('hqArcadeFrame').contentWindow;
      return w.document.getElementById('hojaRankListPhase')?.hidden===false;
    }""",timeout=16000)
    rank_names=await rank_frame.locator('#hojaRankRows .hojaRankRow span:nth-child(2)').all_text_contents()
    visible=[x.strip() for x in rank_names if x.strip()!='---']
    assert visible==['김하늘','ABC123','A9'],visible
    rpc_calls=await page.evaluate("document.getElementById('hqArcadeFrame').contentWindow.__QA_RANK_RPC_CALLS__")
    assert [r['method'] for r in rpc_calls]==['RANK_LIST'],rpc_calls
    print('ARCADE_RANK_KOREAN_2_TO_6_IME_READONLY_LIST_PASS',visible,ime_state,flush=True)
    await rank_frame.locator('#hojaRankClose').click()

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
