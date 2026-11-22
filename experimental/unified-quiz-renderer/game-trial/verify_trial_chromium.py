#!/usr/bin/env python3
"""Chromium smoke for the exact rebuilt trial Game.html. No GAS/production access.
The test deck hook is inserted into the in-memory HTML, never the repository.
"""
import argparse, asyncio, json, shutil
from pathlib import Path
from playwright.async_api import async_playwright

HERE=Path(__file__).resolve().parent
APPROVED=HERE.parent/'HOJA_APPROVED_RENDERER_BRIDGE.html'
HOOK='return {launch,back,stop,setServerQuestions,clearServerQuestions,getCanonicalArcade:expandArcade,get state()'

def const_json(s,name):
    mark='const '+name+'='
    return json.JSONDecoder().raw_decode(s[s.index(mark)+len(mark):])[0]

def social6_sources(s):
    qs=const_json(s,'DATA_CONCISE');imgs=const_json(s,'IMAGES');tags=const_json(s,'HOJA_RENDER_TAGS');meta=const_json(s,'UNIT_META')
    assert len(qs)==64 and len(imgs)==15 and len(tags)==64
    rows=[]
    for q in qs:
        typ={'MCQ':'MULTIPLE','OX':'OX','SHORT':'SUBJECTIVE'}[q['type']]
        if typ=='MULTIPLE':a=str(next(i+1 for i,c in enumerate(q['choices']) if c['id']==q['answer']['choiceId']))
        elif typ=='OX':a='O' if q['answer']['value'] else 'X'
        else:a=q['answer']['text']
        rows.append({'familyId':q['id'],'question':q['prompt'],'type':typ,'answer':a,
                     'options':[c['text'] for c in q.get('choices',[])], 'explanation':q.get('explanation',''), 'rendererQuestion':q})
    return [{'sheetName':'사회6 승인 시험용','data':{'questionSchemaVersion':2,'sourceSheetVersion':2,
            'questions':rows,'images':imgs,'tags':tags,'unitMeta':meta}}]

def instrument(s):
    assert s.count(HOOK)==1,'Solo engine changed unexpectedly'
    return s.replace(HOOK,'''return {launch,back,stop,setServerQuestions,clearServerQuestions,getCanonicalArcade:expandArcade,
     __qa:{forceNextType:(type)=>{const ix=deck.findIndex(i=>questions[i].type===type);if(ix<0)throw Error('NO_TYPE');
       deck.push(...deck.splice(ix,1));return questions[deck.at(-1)].approvedBinding.questionId;},
       peek:()=>questions[deck.at(-1)]},get state()''',1)

async def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--html',type=Path,required=True)
    parser.add_argument('--approved',type=Path,default=APPROVED)
    a=parser.parse_args()
    s=instrument(a.html.read_text())
    sources=social6_sources(a.approved.read_text())
    async with async_playwright() as pw:
        chrome=shutil.which('chromium') or shutil.which('google-chrome-stable') or shutil.which('google-chrome')
        options={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if chrome:options['executable_path']=chrome
        browser=await pw.chromium.launch(**options)
        page=await browser.new_page(viewport={'width':1280,'height':800})
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('dialog',lambda d:asyncio.create_task(d.dismiss()))
        await page.set_content(s,wait_until='domcontentloaded',timeout=90000)
        await page.evaluate('''(sources)=>{
          window.__hojaAudioPauseCalls=0;window.__hojaAudioResumeCalls=0;
          let paused=false;
          window.HOJA_ATTRACT_SCENE={pausedByUser:false,
            anims:{pauseAll:()=>{},resumeAll:()=>{}},
            tweens:{pauseAll:()=>{},resumeAll:()=>{}},
            scene:{
              isPaused:()=>paused,
              pause:()=>{paused=true;window.__hojaAudioPauseCalls++;},
              resume:()=>{paused=false;window.__hojaAudioResumeCalls++;},
              restart:()=>{}
            }};
          window.HOJA_B_LIVE={sources};window.HOJA_GAMEPLAY.setServerQuestions(sources);
          window.HOJA_GAMEPLAY.launch("quiz","spring");
          if(window.__hojaAudioPauseCalls!==1)throw Error('INTRO_NOT_PAUSED_FOR_SOLO');
        }''',sources)
        for kind,correctChoice,method in [('MC',True,'click'),('OX',False,'click'),('MC',False,'keyboard'),('OX',True,'keyboard')]:
            qid=await page.evaluate('(kind)=>window.HOJA_GAMEPLAY.__qa.forceNextType(kind)',kind)
            before=await page.evaluate('window.HOJA_GAMEPLAY.state')
            canonical=await page.evaluate('window.HOJA_GAMEPLAY.__qa.peek().rendererQuestion.answer')
            await page.evaluate('document.getElementById("hqBalloon").click()')
            want=3 if kind=='MC' else 2
            selector='iframe[id^="hojaTeamApproved"]'
            await page.wait_for_function('''(want)=>{const f=document.querySelector('iframe[id^="hojaTeamApproved"]');
              return f?.contentDocument?.querySelectorAll('#hqChoices button.hqChoice').length===want &&
                document.querySelector('#hqOverlay')?.hidden===false;}''',arg=want,timeout=20000)
            choices=await page.evaluate('''()=>[...document.querySelector('iframe[id^="hojaTeamApproved"]').contentDocument.querySelectorAll('#hqChoices button.hqChoice')].map(b=>b.dataset.choice)''')
            assert len(choices)==want,(kind,choices)
            if kind=='OX':assert choices==['true','false'],choices
            correctId=canonical['choiceId'] if kind=='MC' else str(canonical['value']).lower()
            selected=correctId if correctChoice else next(x for x in choices if x!=correctId)
            if method=='click':
                await page.frame_locator(selector).locator(f'button.hqChoice[data-choice="{selected}"]').click(timeout=15000)
            else:
                key=str(choices.index(selected)+1) if kind=='MC' else ('O' if selected=='true' else 'X')
                await page.frame_locator(selector).locator('body').press(key,timeout=15000)
            await page.wait_for_function('(value)=>window.HOJA_GAMEPLAY.state.answered===value',arg=before['answered']+1,timeout=12000)
            verdict=page.locator('#hojaSoloJudgment')
            await verdict.wait_for(state='visible',timeout=2000)
            label=await verdict.inner_text()
            assert ('정답' if correctChoice else '오답') in label,(kind,method,label)
            await page.wait_for_timeout(1250)
            after=await page.evaluate('window.HOJA_GAMEPLAY.state')
            assert not after['activeQuiz'] and after['answered']==before['answered']+1
            assert after['correct']==before['correct']+(1 if correctChoice else 0),(before,after)
            print('PASS',kind,method,qid,'verdict',label,'answered',after['answered'],'correct',after['correct'],flush=True)
        unexpected=[x for x in errors if 'Phaser is not defined' not in x and 'HojaSharedScene is not defined' not in x]
        assert not unexpected,'Unexpected browser errors '+repr(unexpected)
        await page.evaluate('''()=>{
          window.HOJA_FLOW.enterIntro({newRun:false});
          if(window.__hojaAudioResumeCalls!==1)throw Error('INTRO_NOT_RESUMED');
        }''')
        print('CHROMIUM_SOLO_MCQ_OX_SHORTCUT_VERDICT_AUDIO_GATE_PASS (audio gate mocked; actual audio playback not tested)')
        await browser.close()

if __name__=='__main__':asyncio.run(main())
