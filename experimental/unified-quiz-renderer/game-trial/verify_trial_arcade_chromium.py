#!/usr/bin/env python3
"""Exact 25-part rebuilt HTML: arcade inner srcdoc -> parent approved iframe.
Transport test only. Phaser world balloon/collisions NOT simulated.
"""
import argparse,asyncio,shutil
from pathlib import Path
from playwright.async_api import async_playwright,TimeoutError as PWTimeout
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
        # Transport-only: prevent the real Phaser boot scene from asynchronously
        # closing the synthetic child request before the parent renderer finishes.
        # The dedicated real-Phaser workflow tests game lifecycle separately.
        blocked=[0]
        async def block_phaser(route):
            blocked[0]+=1
            await route.abort()
        await page.route('**/phaser.min.js',block_phaser)
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
            family_id=question['familyKey'].split(chr(0))[-1]
            prompt=next(r['rendererQuestion']['prompt'] for e in sources for r in e['data']['questions'] if r['familyId']==family_id)
            try:
                await page.wait_for_function('''e=>{
                  const f=document.getElementById('hojaArcadeApprovedParentFrame');
                  return f?.style.visibility==='visible' &&
                    f?.contentDocument?.getElementById('hqQuestion')?.textContent?.trim()===e.prompt &&
                    f?.contentDocument?.querySelectorAll('#hqChoices button.hqChoice').length===e.count &&
                    document.getElementById('hojaArcadeApprovedParentOverlay')?.style.display==='block';
                }''',arg={'prompt':prompt,'count':choices},timeout=75000)
            except PWTimeout:
                diag=await page.evaluate('''()=>{
                  const f=document.getElementById('hojaArcadeApprovedParentFrame'),a=document.getElementById('hqArcadeFrame'),o=document.getElementById('hojaArcadeApprovedParentOverlay');
                  return {parent:window.HOJA_ARCADE_APPROVED_TRIAL?.state,arcadeReady:typeof a?.contentWindow?.HOJA_ARCADE_APPROVED_BRIDGE?.open==='function',
                   frame:!!f,visibility:f?.style.visibility,text:f?.contentDocument?.getElementById('hqQuestion')?.textContent?.slice(0,120),
                   options:[...(f?.contentDocument?.querySelectorAll('#hqChoices button.hqChoice')||[])].map(x=>x.dataset.choice),
                   overlay:o?.style.display,error:o?.querySelector('#hojaArcadeApprovedError')?.textContent,loading:!!o?.querySelector('#hojaArcadeApprovedLoading')};
                }''')
                print('ARCADE_TRANSPORT_LOAD_TIMEOUT',diag,flush=True)
                raise
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
        assert blocked[0]>=1,'Unexpected: no Phaser resource was isolated'
        print('ARCADE_TRANSPORT_ONLY_PHASER_BLOCKED',blocked[0],flush=True)
        await browser.close()
if __name__=='__main__':asyncio.run(run())
