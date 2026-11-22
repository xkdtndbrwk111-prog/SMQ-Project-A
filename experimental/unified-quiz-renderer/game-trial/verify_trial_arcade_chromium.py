#!/usr/bin/env python3
"""Exact 25-part rebuilt HTML: arcade inner srcdoc -> parent approved iframe.
Transport test only. Phaser world balloon/collisions NOT simulated.
"""
import argparse,asyncio,shutil
from pathlib import Path
from playwright.async_api import async_playwright
from verify_trial_chromium import social6_sources
ROOT=Path(__file__).resolve().parent

def case(sources,typ):
    entry,row=next((e,x) for e in sources for x in e['data']['questions']
             if x['type']==typ and (typ!='OX' or x['answer']=='X'))
    cq=row['rendererQuestion']
    if typ=='MULTIPLE':
        cs=cq['choices']
        good=next(c for c in cs if c['id']==cq['answer']['choiceId'])
        wrong=[c for c in cs if c['id']!=good['id']]
        selected=[wrong[0],good,wrong[1]]
        return {'familyKey':entry['sheetName']+'\u0000'+row['familyId'],
                'type':'MC','choices':[c['text'] for c in selected],'answer':1},good['id'],1
    return {'familyKey':entry['sheetName']+'\u0000'+row['familyId'],
            'type':'OX','choices':['X','O'],'answer':0},'false',0

async def run():
    p=argparse.ArgumentParser();p.add_argument('--html',type=Path,required=True);args=p.parse_args()
    sources=social6_sources((ROOT.parent/'HOJA_APPROVED_RENDERER_BRIDGE.html').read_text())
    html=args.html.read_text()
    async with async_playwright() as pw:
        chrome=shutil.which('chromium') or shutil.which('google-chrome')
        opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if chrome:opts['executable_path']=chrome
        browser=await pw.chromium.launch(**opts)
        page=await browser.new_page(viewport={'width':1280,'height':800})
        page.on('dialog',lambda d:asyncio.create_task(d.dismiss()))
        await page.set_content(html,wait_until='domcontentloaded',timeout=90000)
        await page.evaluate('''(sources)=>{
          window.HOJA_B_LIVE.setSources(sources);
          window.HOJA_ARCADE_APPROVED_TRIAL.configure(sources);
          const host=document.getElementById('hojaGamePlay');
          host.hidden=false;host.dataset.mode='arcade';
          const f=document.getElementById('hqArcadeFrame');f.hidden=false;
          window.__QA_ARCADE_FINISH=[];
        }''',sources)
        content=await page.evaluate('window.HOJA_GAMEPLAY.getCanonicalArcade()')
        assert 'hojaArcadeApprovedChildTrial' in content
        await page.evaluate('''(content)=>{document.getElementById('hqArcadeFrame').srcdoc=content}''',content)
        await page.wait_for_function('''()=>typeof document.getElementById('hqArcadeFrame')?.contentWindow?.HOJA_ARCADE_APPROVED_BRIDGE?.open==='function' ''',timeout=30000)
        for typ in ('MULTIPLE','OX'):
            question,answer_id,expected=case(sources,typ)
            await page.evaluate('''(q)=>{
              const win=document.getElementById('hqArcadeFrame').contentWindow;
              win.HOJA_ARCADE_APPROVED_BRIDGE.open(q,index=>{
                window.__QA_ARCADE_FINISH.push({index,expected:q.answer});
                win.HOJA_ARCADE_APPROVED_BRIDGE.verdict(index===q.answer);
                setTimeout(()=>win.HOJA_ARCADE_APPROVED_BRIDGE.close(),1500);
              });
            }''',question)
            choices=3 if typ=='MULTIPLE' else 2
            await page.wait_for_function('''n=>{
              const f=document.getElementById('hojaArcadeApprovedParentFrame');
              return f?.contentDocument?.querySelectorAll('#hqChoices button.hqChoice').length===n &&
                document.getElementById('hojaArcadeApprovedParentOverlay')?.style.display==='block';
            }''',arg=choices,timeout=30000)
            loc=page.frame_locator('#hojaArcadeApprovedParentFrame')
            if typ=='OX':
                # Keyboard event must enter the nested approved iframe, not the arcade parent.
                await loc.locator('button.hqChoice[data-choice="'+answer_id+'"]').focus()
                await page.keyboard.press('x')
            else:
                await loc.locator('button.hqChoice[data-choice="'+answer_id+'"]').click(timeout=15000)
            await page.wait_for_function('''v=>window.__QA_ARCADE_FINISH.length===v''',arg=1 if typ=='MULTIPLE' else 2,timeout=8000)
            observed=await page.evaluate('window.__QA_ARCADE_FINISH.at(-1)')
            assert observed['index']==expected,observed
            await page.wait_for_selector('#hojaArcadeApprovedJudgment',timeout=3000)
            await page.wait_for_function('''()=>document.getElementById('hojaArcadeApprovedParentOverlay')?.style.display==='none' ''',timeout=10000)
            print('ARCADE_IFRAME_TRANSPORT_PASS',typ,'index',observed['index'],flush=True)
        await browser.close()
if __name__=='__main__':asyncio.run(run())
