#!/usr/bin/env python3
"""Team approved iframe smoke on the EXACT rebuilt branch trial.
Uses synthetic GAS responses in memory. Does not call GAS or write scores.
"""
import argparse, asyncio, shutil
from pathlib import Path
from playwright.async_api import async_playwright
from verify_trial_chromium import social6_sources

HERE=Path(__file__).resolve().parent
APPROVED=HERE.parent/'HOJA_APPROVED_RENDERER_BRIDGE.html'
async def main():
    p=argparse.ArgumentParser()
    p.add_argument('--html',type=Path,required=True)
    args=p.parse_args()
    sources=social6_sources(APPROVED.read_text())
    s=args.html.read_text()
    async with async_playwright() as pw:
        chrome=shutil.which('chromium') or shutil.which('google-chrome-stable') or shutil.which('google-chrome')
        opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if chrome:opts['executable_path']=chrome
        browser=await pw.chromium.launch(**opts)
        page=await browser.new_page(viewport={'width':1280,'height':800})
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('dialog',lambda d:asyncio.create_task(d.dismiss()))
        await page.set_content(s,wait_until='domcontentloaded',timeout=90000)
        await page.evaluate('''(sources)=>{
          window.HOJA_B_LIVE={sources};
          window.HOJA_GAMEPLAY.setServerQuestions(sources);
          window.HOJA_GAMEPLAY.launch('quiz','spring');
          window.HOJA_TEAM_TEST.launch(2,'spring');
        }''', sources)
        await page.wait_for_timeout(2800)
        await page.evaluate('''()=>{const b=document.querySelector('#htTeamBoard button.htBalloon');
          if(!b)throw Error('TEAM_BALLOON_NOT_FOUND');b.click()}''')
        await page.wait_for_function('''()=>{
          const f=document.getElementById('hojaTeamApprovedTrialFrame');
          const doc=f?.contentDocument;
          const text=doc?.getElementById('hqQuestion')?.textContent?.trim();
          return Boolean(text&&document.querySelector('#hojaGamePlay')?.dataset.mode==='team'&&
            !document.querySelector('#hqOverlay')?.hidden);
        }''',timeout=30000)
        d=await page.evaluate('''()=>{
          const doc=document.getElementById('hojaTeamApprovedTrialFrame').contentDocument;
          return {text:doc.getElementById('hqQuestion').textContent.trim(),
            choices:doc.querySelectorAll('#hqChoices button.hqChoice').length,
            teacher:!!doc.querySelector('#hqChoices .teacher-reveal-btn'),
            cardLayout:doc.getElementById('screen')?.dataset.layout};
        }''')
        assert d['text'] and (d['choices'] in (2,3) or d['teacher']), d
        print('CHROMIUM_TEAM_APPROVED_FIRST_BALLOON_PASS',repr(d),flush=True)
        unexpected=[e for e in errors if 'Phaser is not defined' not in e and 'HojaSharedScene is not defined' not in e]
        assert not unexpected,'Unexpected browser errors '+repr(unexpected)
        await browser.close()
if __name__=='__main__':asyncio.run(main())
