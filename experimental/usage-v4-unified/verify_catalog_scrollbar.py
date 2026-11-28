#!/usr/bin/env python3
"""Browser test: actual release display block + catalog CSS/markup, simulated card inventory."""
import argparse
import asyncio
import re
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    p=argparse.ArgumentParser()
    p.add_argument('--html',required=True)
    a=p.parse_args()
    source=Path(a.html).read_text(encoding='utf-8')
    styles='\n'.join(re.findall(r'<style\b[^>]*>.*?</style>',source,re.S|re.I))
    script=re.search(r'<script id="hoja15-approved-cartridge-display-v1">.*?</script>',source,re.S).group()
    # Actual catalog class and rail/multi-controls layout; no game engine/RPC dependency.
    tag=re.search(r'<[^>]+id="hojaCatalog"[^>]*>',source).group()
    tag=re.sub(r'\s+hidden(?=\s|>)','',tag)
    # A game panel needs a viewport-sized parent, as it has in the complete game.
    close='</'+re.match(r'<(\w+)',tag).group(1)+'>'
    fixture=('<html><head>'+styles+'<style>html,body{margin:0;width:100%;height:100%;}#fixture{position:relative;width:100vw;height:100vh;}</style></head><body><div id="fixture">'+tag+
        '<div class="hcHeader"><div class="hcKicker">HOJA · EXPEDITION PAK</div><div id="hcTitle" class="hcTitle">단원 카트리지 선택</div><div id="hcContext" class="hcContext">6학년 · 사회</div></div>'
        '<div id="hcRail" class="hcRail"></div><div id="hcMultiControls" class="hcMultiControls"><label><input id="hcMultiToggle" type="checkbox">다중 선택</label></div><div class="hcFoot"></div>'+close+'</div><div id="hcNextSelected"></div>'
        '<script>window.HOJA_B_LIVE={rpc:()=>Promise.resolve([])};</script>'+script+'</body></html>')
    populate="""n=>{const rail=document.getElementById('hcRail');rail.replaceChildren(...Array.from({length:n},(_,i)=>{const b=document.createElement('button');b.className='hcPak isUnit';b.type='button';b.innerHTML='<span class="hcFace"><strong class="hcUnitName">단원 '+(i+1)+'</strong></span>';b.onclick=()=>b.classList.toggle('chosen');return b}));rail.scrollLeft=0;}"""
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True)
        for w,h in [(1533,852),(1280,720),(390,844),(700,400)]:
            page=await browser.new_page(viewport={'width':w,'height':h})
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            await page.set_content(fixture,wait_until='domcontentloaded')
            bar=page.locator('#hoja15CatalogScrollbar')
            rail=page.locator('#hcRail')
            await page.evaluate(populate,1)
            await bar.wait_for(state='hidden')
            await page.evaluate(populate,7)
            await bar.wait_for(state='visible')
            info=await page.evaluate("""()=>{const r=document.getElementById('hcRail'),b=document.getElementById('hoja15CatalogScrollbar'),m=document.getElementById('hcMultiControls');return {max:r.scrollWidth-r.clientWidth,railBottom:r.getBoundingClientRect().bottom,barTop:b.getBoundingClientRect().top,barBottom:b.getBoundingClientRect().bottom,multiTop:m.getBoundingClientRect().top,viewport:innerHeight,display:getComputedStyle(b).display}}""")
            assert info['max']>1 and info['barTop']>=info['railBottom']-1 and info['barBottom']<=info['multiTop']+1 and info['barBottom']<=h,info
            await bar.focus();await page.keyboard.press('End')
            await page.wait_for_function("Math.abs(hcRail.scrollLeft-(hcRail.scrollWidth-hcRail.clientWidth))<=2")
            assert int(await bar.input_value())==1000
            await page.keyboard.press('Home')
            await page.wait_for_function("hcRail.scrollLeft<=1")
            await page.keyboard.press('ArrowRight')
            await page.wait_for_function("hcRail.scrollLeft>10")
            # Native rail scroll updates the custom control.
            await rail.evaluate("(r)=>r.scrollLeft=(r.scrollWidth-r.clientWidth)/2")
            await page.wait_for_function("Math.abs(+document.getElementById('hoja15CatalogScrollbar').value-500)<=4")
            # Click the track toward the end, then select the last card.
            bb=await bar.bounding_box()
            await page.mouse.click(bb['x']+bb['width']-2,bb['y']+bb['height']/2)
            await page.wait_for_function("hcRail.scrollLeft>(hcRail.scrollWidth-hcRail.clientWidth)*0.8")
            await page.locator('#hcRail button').last.click()
            assert await page.locator('#hcRail button').last.evaluate("b=>b.classList.contains('chosen')")
            await page.locator('#hcMultiToggle').check()
            await bar.wait_for(state='visible')
            await page.evaluate(populate,1)
            await bar.wait_for(state='hidden')
            await page.evaluate(populate,7)
            await bar.wait_for(state='visible')
            # Browser resize into a wide enough rail hides it; restore the viewport.
            await page.evaluate(populate,2)
            if w>=700: await bar.wait_for(state='hidden')
            await page.evaluate(populate,7)
            await bar.wait_for(state='visible')
            assert not errors,errors
            print('CATALOG_SCROLLBAR_PASS',w,h,info,flush=True)
            await page.close()
        await browser.close()

if __name__=='__main__':asyncio.run(main())
