#!/usr/bin/env python3
"""40-6-U3 REAL Apps Script anonymous e2e against an ISOLATED TEST deployment.

Each browser context is fresh (no Google cookies = anonymous). RPCs are issued
from inside the Apps Script user-HTML frame exactly as an anonymous visitor's
devtools could. Writes go ONLY to the 40-6U write copy configured in the test
project. Prints non-identifying evidence only (counts, codes, timings).
Usage: HOJA_U3_URL=<exec url> HOJA_U3_TOKEN=<token> python3 verify_real_gas_anonymous.py
"""
import asyncio, json, os, time, uuid
from playwright.async_api import async_playwright

URL = os.environ['HOJA_U3_URL']
TOKEN = os.environ['HOJA_U3_TOKEN']
CALL = """([fn,args])=>new Promise(res=>{
 const t=performance.now();
 const r=google.script.run.withSuccessHandler(v=>res({ok:true,v,ms:performance.now()-t}))
  .withFailureHandler(e=>res({ok:false,e:String(e&&e.message||e),ms:performance.now()-t}));
 if(typeof r[fn]!=='function'){res({ok:false,e:'NOT_EXPOSED_IN_CLIENT_STUB',ms:0});return;}
 r[fn].apply(r,args);})"""
CALL_MANY = """([fn,list])=>Promise.all(list.map(args=>new Promise(res=>{
 google.script.run.withSuccessHandler(v=>res({ok:true,v})).withFailureHandler(e=>res({ok:false,e:String(e&&e.message||e)}))[fn].apply(null,args);})))"""
EV = []

def log(tag, obj):
    line = f'{tag}: {json.dumps(obj, ensure_ascii=False)}'
    EV.append(line); print(line, flush=True)

async def user_frame(page, query=''):
    await page.goto(URL + query, wait_until='load', timeout=90000)
    for _ in range(120):
        for f in page.frames:
            try:
                if await f.evaluate("typeof google!=='undefined'&&!!google.script&&!!google.script.run"):
                    return f
            except Exception:
                pass
        await asyncio.sleep(0.5)
    raise SystemExit('USER_FRAME_NOT_FOUND')

async def anon(browser, query='?view=stats'):
    ctx = await browser.new_context()          # fresh: no cookies, not signed in
    page = await ctx.new_page()
    return ctx, page, await user_frame(page, query)

async def call(f, fn, *args):
    return await f.evaluate(CALL, [fn, list(args)])

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx, page, f = await anon(browser)
        # R0: evidence + 40-6U copy re-verification inside the real engine
        ev0 = await call(f, 'hojaV4TestEvidenceU3', TOKEN); log('R0_COPY_REVERIFY', ev0)
        # Safety: only the isolated test project has this token-guarded function and
        # the 40-6U B1 canary. Anything else (e.g. a production deployment) => stop before any write.
        if not ev0.get('ok') or ev0['v'].get('b1') != 'HOJA_V4_40_6U_WRITE_COPY':
            raise SystemExit('NOT_THE_ISOLATED_TEST_PROJECT_ABORT_BEFORE_WRITES')
        # R1: before any write the watermark is uninitialised -> NOT_CONFIGURED, not zero
        r1 = await call(f, 'getPublicUsageStatisticsV4'); log('R1_STATS_BEFORE_WRITE', r1)
        await page.wait_for_timeout(3000)
        err = await f.locator('#error').inner_text() if await f.locator('#error').is_visible() else ''
        log('R1_PAGE', {'errorVisible': bool(err), 'code': err[err.find('코드'):][:30] if err else '',
                        'tiles': await f.locator('#t-all').inner_text()})
        # R4: anonymous attack surface
        r4 = {}
        for fn, args in (('hojaV4OpsSealPendingDays', []), ('hojaV4OpsStatus', []), ('hojaV4TestSetupU3', []),
                         ('hojaV4uSealPendingDays_', [7]), ('hojaV4uComputePublic_', []), ('setupUsageRollupShadowU3S1', []),
                         ('installUsageRollupDailyTriggerU3S1', []), ('hojaV4TestEvidenceU3', ['wrong-token'])):
            res = await call(f, fn, *args); r4[fn] = 'OK!' if res['ok'] else res['e'][:90]
        log('R4_ANON_DENIED', r4)
        # catalog (public) -> a real playable PUBLIC cartridge id
        cat = await call(f, 'hojaListPublicCartridges')
        assert cat['ok'], cat
        cid = str(cat['v'][0]['cartridgeId']); log('CATALOG', {'publicCartridges': len(cat['v']), 'rpcMs': round(cat['ms'])})
        # R2: one anonymous game start
        eid = str(uuid.uuid4())
        req = {'eventId': eid, 'mode': 'SOLO', 'repositoryKind': 'PUBLIC', 'cartridgeIds': [cid], 'cartridgeCount': 1, 'teamCount': 1}
        r2 = await call(f, 'recordUsageStartU1', req); log('R2_RECORD', {'ok': r2['ok'], 'v': r2.get('v'), 'e': r2.get('e'), 'ms': round(r2['ms'])})
        # R5: identical replay / conflicting replay
        r5a = await call(f, 'recordUsageStartU1', req)
        r5b = await call(f, 'recordUsageStartU1', dict(req, mode='TEAM', teamCount=3))
        r5c = await call(f, 'recordUsageStartU1', dict(req, repositoryKind='PRIVATE'))
        log('R5_REPLAY', {'identical': r5a.get('v') or r5a.get('e'), 'conflict': r5b.get('e') or r5b.get('v'),
                          'private': r5c.get('v') or r5c.get('e')})
        await call(f, 'hojaV4TestClearCacheU3', TOKEN)
        r3 = await call(f, 'getPublicUsageStatisticsV4')
        s = r3['v']
        log('R3_STATS', {'status': s.get('status'), 'code': s.get('code'), 'totals': s.get('totals'), 'days': len(s.get('daily', [])),
                         'zeroDays': sum(1 for d in s.get('daily', []) if d['count'] == 0), 'provisional': s.get('provisionalDays'),
                         'keys': sorted(s.keys()), 'top': len(s.get('topCartridges', [])), 'rpcMs': round(r3['ms'])})
        await ctx.close()
        # R3 page render in another fresh anonymous context
        ctx, page, f = await anon(browser)
        await f.locator('#content').wait_for(state='visible', timeout=60000)
        log('R3_PAGE', {'all': await f.locator('#t-all').inner_text(), 'today': await f.locator('#t-today').inner_text(),
                        'banner': (await f.locator('#banner').inner_text())[:40]})
        await ctx.close()
        # R6: two anonymous contexts x 20 concurrent starts while a third polls stats
        before = (await call(f2 := (await anon(browser))[2], 'hojaV4TestEvidenceU3', TOKEN))['v']
        c1, p1, f1 = await anon(browser); c2, p2, f2b = await anon(browser); c3, p3, f3 = await anon(browser)
        def batch(n): return [[{'eventId': str(uuid.uuid4()), 'mode': 'SOLO', 'repositoryKind': 'PUBLIC', 'cartridgeIds': [cid],
                                'cartridgeCount': 1, 'teamCount': 1}] for _ in range(n)]
        polls = []
        async def poll():
            for _ in range(12):
                await call(f3, 'hojaV4TestClearCacheU3', TOKEN)
                r = await call(f3, 'getPublicUsageStatisticsV4')
                polls.append(r['v'].get('totals', {}).get('all') if r['ok'] else 'ERR')
        t = time.time()
        a, b, _ = await asyncio.gather(f1.evaluate(CALL_MANY, ['recordUsageStartU1', batch(20)]),
                                       f2b.evaluate(CALL_MANY, ['recordUsageStartU1', batch(20)]), poll())
        after = (await call(f3, 'hojaV4TestEvidenceU3', TOKEN))['v']
        fails = [x['e'][:60] for x in a + b if not x['ok']]
        log('R6_CONCURRENT', {'sent': 40, 'okReplies': sum(1 for x in a + b if x['ok']), 'failures': fails,
                              'rowsAdded': after['sourceLastRow'] - before['sourceLastRow'],
                              'watermarkAdded': after['watermark'] - before['watermark'],
                              'pollTotalsSeen': polls, 'monotone': all(isinstance(x, int) for x in polls) and polls == sorted(polls),
                              'seconds': round(time.time() - t, 1)})
        for c in (c1, c2, c3): await c.close()
        # R8: hash tamper on the copy -> UNAVAILABLE/INTEGRITY, then restore -> OK
        ctx, page, f = await anon(browser)
        t_on = await call(f, 'hojaV4TestTamperU3', TOKEN, True)
        bad = await call(f, 'getPublicUsageStatisticsV4')
        t_off = await call(f, 'hojaV4TestTamperU3', TOKEN, False)
        good = await call(f, 'getPublicUsageStatisticsV4')
        log('R8_TAMPER', {'tamper': t_on.get('v') or t_on.get('e'), 'during': bad['v'], 'restore': t_off.get('v') or t_off.get('e'),
                          'after': {'status': good['v'].get('status'), 'all': good['v'].get('totals', {}).get('all')}})
        # R9: timings (cache hit vs recompute) + final evidence
        hit = await call(f, 'getPublicUsageStatisticsV4')
        await call(f, 'hojaV4TestClearCacheU3', TOKEN)
        miss = await call(f, 'getPublicUsageStatisticsV4')
        fin = await call(f, 'hojaV4TestEvidenceU3', TOKEN)
        log('R9_TIMING', {'cacheHitMs': round(hit['ms']), 'recomputeMs': round(miss['ms']), 'evidenceMs': fin['v']['ms']})
        log('R9_FINAL_EVIDENCE', fin['v'])
        await ctx.close()
        # Game page still served anonymously at the default route
        ctx, page, f = await anon(browser, '')
        log('GAME_ROUTE', {'title': await page.title(), 'hasStatsDom': await f.locator('#t-all').count()})
        await ctx.close()
        await browser.close()

asyncio.run(main())
