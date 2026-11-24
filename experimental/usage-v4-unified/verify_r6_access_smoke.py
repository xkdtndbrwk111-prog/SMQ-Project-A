#!/usr/bin/env python3
"""40-6AV: anonymous access smoke for the TEMPORARY isolated R6 test deployment (run BEFORE the R6 burst).
A fresh, signed-out Chromium context opens the web app and calls, through google.script.run:
  - hojaV4OpsStatus()                         operator-only (read-only)  -> must fail HOJA_V4_OPS_DENIED
  - hojaV4TestEvidenceU3 / TailU3 / ColdU3 / ClearCacheU3 with a WRONG and an EMPTY token -> must fail HOJA_V4_U3_TEST_DENIED
Write-capable functions (seal, setup, tamper) are deliberately NOT called: if a guard were broken they could write.
Prints call names and error codes only (no URL, ids, tokens or sheet values). Exit 1 on any non-denied result.
Usage: HOJA_U3_URL=<exec url> python3 verify_r6_access_smoke.py"""
import asyncio, os, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
URL = os.environ['HOJA_U3_URL']
CALL = """([fn,args])=>new Promise(res=>{const r=google.script.run.withSuccessHandler(v=>res({ok:true}))
 .withFailureHandler(e=>res({ok:false,e:String(e&&e.message||e)}));
 if(typeof r[fn]!=='function'){res({ok:false,e:'NOT_EXPOSED'});return;}r[fn].apply(r,args);})"""
CASES = [('hojaV4OpsStatus', [], 'HOJA_V4_OPS_DENIED')]
for fn, extra in [('hojaV4TestEvidenceU3', []), ('hojaV4TestTailU3', [1]), ('hojaV4TestColdU3', []), ('hojaV4TestClearCacheU3', [])]:
    for tok in ('wrong-token-40-6AV', ''):
        CASES.append((fn, [tok] + extra, 'HOJA_V4_U3_TEST_DENIED'))

async def main():
    bad = 0
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        ctx = await b.new_context(); page = await ctx.new_page()
        await page.goto(URL + '?view=stats', wait_until='load', timeout=120000)
        frame = None
        for _ in range(240):
            for f in page.frames:
                try:
                    if await f.evaluate("typeof google!=='undefined'&&!!google.script&&!!google.script.run"):
                        frame = f; break
                except Exception:
                    pass
            if frame: break
            await asyncio.sleep(0.5)
        if not frame:
            print('ACCESS_SMOKE_FAIL USER_FRAME_NOT_FOUND'); sys.exit(1)
        for fn, args, want in CASES:
            r = await frame.evaluate(CALL, [fn, args])
            code = 'OK(NOT DENIED)' if r['ok'] else ('DENIED' if want in r['e'] else 'OTHER_ERROR:' + r['e'].split(':')[-1].strip()[:40])
            ok = (not r['ok']) and want in r['e']
            bad += 0 if ok else 1
            tok = '' if fn == 'hojaV4OpsStatus' else (' token=' + ('wrong' if args[0] else 'empty'))
            print(f"{fn}{tok}: {code}", flush=True)
        await b.close()
    print('ACCESS_SMOKE_' + ('PASS' if bad == 0 else 'FAIL'), f'{len(CASES) - bad}/{len(CASES)} denied'); sys.exit(1 if bad else 0)

asyncio.run(main())
