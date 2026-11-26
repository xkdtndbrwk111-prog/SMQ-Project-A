#!/usr/bin/env python3
"""Chromium on actual Game.html and isolated remote reader; no live GAS/Sheets."""
import argparse, asyncio, json, hashlib, re
from pathlib import Path
from playwright.async_api import async_playwright
from verify_f3_ui_e2e import STUB, backend
async def main():
    ap=argparse.ArgumentParser()
    for k in ('html','phaser','packages'): ap.add_argument('--'+k,required=True)
    ap.add_argument('--port',type=int,required=True)
    a=ap.parse_args()
    url=f'http://127.0.0.1:{a.port}/game.html'
    html=Path(a.html).read_text(encoding='utf8').replace('<head>','<head>'+STUB.replace('PORT',str(a.port)),1)
    phaser=Path(a.phaser).read_bytes()
    root=Path(a.packages)
    idx=json.loads((root/'game-runtime/approved-packages/v1/INDEX.json').read_text())
    pins={e['cartridgeId']:e for e in idx['packages']}
    assert len(pins)==29
    downloads=[]; relay=[]; offline=False
    print('BROWSER_CACHE_BEGIN',flush=True)
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True)
        ctx=await browser.new_context(viewport={'width':1280,'height':800})
        async def route(r):
            u=r.request.url
            if u==url: return await r.fulfill(body=html,content_type='text/html; charset=utf-8')
            if u.endswith('phaser.min.js'): return await r.fulfill(body=phaser,content_type='application/javascript')
            if u.startswith('https://raw.githubusercontent.com/xkdtndbrwk111-prog/HOJA-QUESTION-BANK/'):
                m=re.fullmatch(r'https://raw.githubusercontent.com/xkdtndbrwk111-prog/HOJA-QUESTION-BANK/[a-f0-9]{40}/(game-runtime/approved-packages/v1/([a-z0-9-]+)\.json)',u)
                if not m: return await r.abort()
                if offline: return await r.abort('internetdisconnected')
                b=(root/m[1]).read_bytes(); assert hashlib.sha256(b).hexdigest()==pins[m[2]]['sha256']
                downloads.append(m[2]);return await r.fulfill(body=b,headers={'access-control-allow-origin':'*','content-type':'application/json; charset=utf-8'})
            if u==f'http://127.0.0.1:{a.port}/rpc':
                body=r.request.post_data
                if body:
                    d=json.loads(body)
                    if d.get('fn')=='hojaGetPublicQuestions': relay.append(d['args'])
                return await r.continue_()
            if u.startswith(('data:',f'http://127.0.0.1:{a.port}')):return await r.continue_()
            return await r.abort()
        await ctx.route('**/*',route)
        page=await ctx.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        async def load():
            await page.goto(url,wait_until='domcontentloaded',timeout=120000)
            await page.wait_for_function('!!window.HOJA_APPROVED_PACKAGE_CACHE&&!!window.HOJA_B_LIVE',timeout=90000)
            rows=await asyncio.wait_for(page.evaluate("window.HOJA_B_LIVE.rpc('LIST')"),timeout=60)
            assert len(rows)==29 and all(r['pkg']['pinRelay'] for r in rows),rows[:1]
            assert set(r['cartridgeId'] for r in rows)==set(pins)
            return rows
        rows=await load()
        print('BROWSER_LIST_PASS',len(rows),flush=True)
        # Leave one science unit uncached for the pinned relay test.
        target=next(r for r in rows if r['cartridgeId']=='sci5-s2-u4-common')
        other=[r for r in rows if r!=target]
        async def get(rs):
            n=0
            for r in rs:
                try:
                    n+=await asyncio.wait_for(page.evaluate("""async(r)=>{const [g]=await window.HOJA_B_LIVE.rpc('GET',[r.name]);if(g.data.cartridgeId!==r.cartridgeId||g.data.questions.length!==r.pkg.questionCount)throw Error('bad unit '+r.cartridgeId);return g.data.questions.length}""",r),timeout=75)
                except Exception:
                    print('BROWSER_GET_FAILED',r['cartridgeId'],'downloads',len(downloads),'relay',len(relay),flush=True)
                    raise
            return n
        assert await get(other)==867
        assert len(downloads)==28 and not relay,(len(downloads),len(relay))
        print('BROWSER_DIRECT_PASS 28/867',flush=True)
        offline=True
        assert await get([target])==32
        assert relay and relay[-1][0]['pins']==[{'id':target['pkg']['id'],'sha256':target['pkg']['sha256']}],relay[-1]
        offline=False
        print('BROWSER_PINNED_RELAY_PASS',flush=True)
        # A canonical relay may not persist if server JSON reserializes; direct
        # retrieval then fills it. All units must survive an actual page reload.
        assert await get(rows)==899
        before=len(downloads);beforeRelay=len(relay)
        first=await page.evaluate('window.HOJA_APPROVED_PACKAGE_CACHE.diagnose()')
        print('CACHE_BEFORE_RELOAD',json.dumps(first,ensure_ascii=False),flush=True)
        rows=await load()
        print('BROWSER_RELOAD_LIST_PASS',flush=True)
        assert await get(rows)==899
        diag=await page.evaluate('window.HOJA_APPROVED_PACKAGE_CACHE.diagnose()')
        print('CACHE_AFTER_RELOAD',json.dumps(diag,ensure_ascii=False),flush=True)
        assert len(downloads)==before and len(relay)==beforeRelay,{'redownloaded':downloads[before:],'relayCount':len(relay)-beforeRelay,'beforeState':first['idbState'],'afterState':diag['idbState']}
        assert diag['idb']=='OK' and len(diag['units'])==29 and diag['usedBytes']<=10485760,diag
        assert not errors,errors
        print('REMOTE_BROWSER_CACHE_PASS 29/899 direct, pinned relay, reload cache; bytes='+str(diag['usedBytes']),flush=True)
        await browser.close()
if __name__=='__main__':asyncio.run(main())
