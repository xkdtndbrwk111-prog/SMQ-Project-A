#!/usr/bin/env python3
"""40-6-U D: R6 rerun on the REAL Apps Script engine, ISOLATED TEST deployment only.

R6a  server-only burst: 40 raw anonymous recordUsageStartU1 calls at once from
     2 fresh contexts after a COLD cache reset, no client retry (measures what
     the server alone now absorbs; perf = catalog source, lock wait/hold, total).
R6b  real client path: 8 fresh anonymous contexts load the GAME page (patched
     telemetry block), select one real PUBLIC cartridge through the game's own
     HOJA_B_LIVE RPCs, then call the game's own HOJA_USAGE.track() 5x each at
     the same moment = 40 starts, while a 9th context polls public stats.
     Pass = rows +40, 40 unique eventIds, 0 duplicate rows, watermark +40,
     public total +40, every client reports delivered (retries allowed).
R6c  lost reply: the same eventId re-sent 3x concurrently -> exactly one row.
Prints non-identifying evidence only (counts, codes, timings).
Usage: HOJA_U3_URL=<exec url> HOJA_U3_TOKEN=<token> python3 verify_real_gas_r6.py
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
CALL_MANY = """([fn,list])=>Promise.all(list.map(args=>new Promise(res=>{const t=performance.now();
 google.script.run.withSuccessHandler(v=>res({ok:true,v,ms:performance.now()-t}))
 .withFailureHandler(e=>res({ok:false,e:String(e&&e.message||e),ms:performance.now()-t}))[fn].apply(null,args);})))"""
EV = []

def log(tag, obj):
    line = f'{tag}: {json.dumps(obj, ensure_ascii=False)}'
    EV.append(line); print(line, flush=True)

async def user_frame(page, query='', need='google.script.run'):
    await page.goto(URL + query, wait_until='load', timeout=120000)
    for _ in range(240):
        for f in page.frames:
            try:
                if await f.evaluate(f"typeof google!=='undefined'&&!!google.script&&!!google.script.run&&({need.replace('google.script.run','true')})"):
                    return f
            except Exception:
                pass
        await asyncio.sleep(0.5)
    raise SystemExit('USER_FRAME_NOT_FOUND')

async def anon(browser, query='?view=stats', need='google.script.run'):
    ctx = await browser.new_context()          # fresh: no cookies, not signed in
    page = await ctx.new_page()
    return ctx, page, await user_frame(page, query, need)

async def call(f, fn, *args):
    return await f.evaluate(CALL, [fn, list(args)])

def pct(values, p):
    v = sorted(values); return round(v[min(len(v) - 1, int(len(v) * p))]) if v else None

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        c0, p0, f0 = await anon(browser)
        ev0 = await call(f0, 'hojaV4TestEvidenceU3', TOKEN)
        if not ev0.get('ok') or ev0['v'].get('b1') != 'HOJA_V4_40_6U_WRITE_COPY':
            raise SystemExit('NOT_THE_ISOLATED_TEST_PROJECT_ABORT_BEFORE_WRITES')
        log('R0_COPY_REVERIFY', {k: ev0['v'][k] for k in ('manifestComplete', 'rawRows', 'uniquePlays', 'retries', 'zeroDays',
            'bucketRows', 'srcShaOk', 'bucketShaOk', 'bucketSetOk', 'bad', 'watermark', 'sourceLastRow')})
        cat = await call(f0, 'hojaListPublicCartridges')
        assert cat['ok'], cat
        cid, cname = str(cat['v'][0]['cartridgeId']), cat['v'][0]['name']
        log('CATALOG', {'publicCartridges': len(cat['v'])})
        # ---------------- R6a: cold, server-only, no client retry ----------------
        await call(f0, 'hojaV4TestColdU3', TOKEN)
        start = (await call(f0, 'hojaV4TestTailU3', TOKEN, ev0['v']['sourceLastRow']))['v']['lastRow']
        a1, pa, fa = await anon(browser); a2, pb, fb = await anon(browser)
        def batch(n): return [[{'eventId': str(uuid.uuid4()), 'mode': 'SOLO', 'repositoryKind': 'PUBLIC', 'cartridgeIds': [cid],
                                'cartridgeCount': 1, 'teamCount': 1}] for _ in range(n)]
        t = time.time()
        ra, rb = await asyncio.gather(fa.evaluate(CALL_MANY, ['recordUsageStartU1', batch(20)]),
                                      fb.evaluate(CALL_MANY, ['recordUsageStartU1', batch(20)]))
        res = ra + rb
        perf = [x['v'].get('perf', {}) for x in res if x['ok']]
        fails = {}
        for x in res:
            if not x['ok']:
                k = x['e'].split(':')[-1].strip()[:50]; fails[k] = fails.get(k, 0) + 1
        tail = (await call(f0, 'hojaV4TestTailU3', TOKEN, start))['v']
        log('R6A_SERVER_ONLY_COLD_BURST', {'sent': 40, 'ok': len(perf), 'failures': fails, 'rowsAdded': tail['rowsAdded'],
            'uniqueEventIds': tail['uniqueEventIds'], 'duplicateRows': tail['duplicateRows'], 'invalidRows': tail['invalidRows'],
            'watermarkMinusLastRow': tail['watermark'] - tail['lastRow'], 'catalogSources': {s: sum(1 for p in perf if p.get('catalog') == s) for s in ('LIVE', 'CACHE')},
            'sheetsApiCalls': sum(p.get('sheetsApiCalls', 0) for p in perf),
            'lockWaitMs': {'p50': pct([p['lockWaitMs'] for p in perf], .5), 'p95': pct([p['lockWaitMs'] for p in perf], .95), 'max': pct([p['lockWaitMs'] for p in perf], 1)},
            'lockHoldMs': {'p50': pct([p['lockHoldMs'] for p in perf], .5), 'p95': pct([p['lockHoldMs'] for p in perf], .95), 'max': pct([p['lockHoldMs'] for p in perf], 1)},
            'serverTotalMs': {'p50': pct([p['totalMs'] for p in perf], .5), 'max': pct([p['totalMs'] for p in perf], 1)},
            'rpcMs': {'p50': pct([x['ms'] for x in res], .5), 'max': pct([x['ms'] for x in res], 1)}, 'seconds': round(time.time() - t, 1)})
        await a1.close(); await a2.close()
        # ---------------- R6b: real game page + patched client retry ----------------
        start_b = tail['lastRow']
        await call(f0, 'hojaV4TestClearCacheU3', TOKEN)
        s_before = (await call(f0, 'getPublicUsageStatisticsV4'))['v']
        games = []
        for _ in range(8):
            ctx, page, f = await anon(browser, '', "!!window.HOJA_B_LIVE&&!!window.HOJA_USAGE&&typeof window.HOJA_USAGE.status==='function'")
            games.append((ctx, page, f))
        log('R6B_GAME_PAGES', {'contexts': len(games), 'patchedClient': True})
        for _, _, f in games:   # the game's own RPC path, exactly as a player selecting one cartridge
            ok = await f.evaluate("""async (name)=>{const v=await window.HOJA_B_LIVE.rpc('GET',[name]);
              window.HOJA_B_LIVE.setSources(v);return window.HOJA_B_LIVE.sources.length}""", cname)
            assert ok == 1
        polls = []
        async def poll():
            for _ in range(10):
                await call(f0, 'hojaV4TestClearCacheU3', TOKEN)
                r = await call(f0, 'getPublicUsageStatisticsV4')
                polls.append(r['v'].get('totals', {}).get('all') if r['ok'] and r['v'].get('status') == 'OK' else r['v'].get('code', 'ERR'))
        t = time.time()
        fire = "()=>{for(let i=0;i<5;i++)window.HOJA_USAGE.track('SOLO',1);return window.HOJA_USAGE.status().tracked}"
        tracked = await asyncio.gather(*[f.evaluate(fire) for _, _, f in games])
        async def wait_all():
            for _ in range(600):
                st = await asyncio.gather(*[f.evaluate('window.HOJA_USAGE.status()') for _, _, f in games])
                if all(s['delivered'] + s['permanent'] >= 5 for s in st):
                    return st
                await asyncio.sleep(1)
            return st
        statuses, _ = await asyncio.gather(wait_all(), poll())
        secs = round(time.time() - t, 1)
        tail_b = (await call(f0, 'hojaV4TestTailU3', TOKEN, start_b))['v']
        await call(f0, 'hojaV4TestClearCacheU3', TOKEN)
        s_after = (await call(f0, 'getPublicUsageStatisticsV4'))['v']
        agg = {k: sum(s[k] for s in statuses) for k in ('tracked', 'delivered', 'duplicateIgnored', 'retries', 'permanent', 'queued', 'expired')}
        nums = [x for x in polls if isinstance(x, int)]
        log('R6B_REAL_CLIENT_40', {'tracked': sum(tracked), 'client': agg, 'rowsAdded': tail_b['rowsAdded'],
            'uniqueEventIds': tail_b['uniqueEventIds'], 'duplicateRows': tail_b['duplicateRows'], 'invalidRows': tail_b['invalidRows'],
            'watermarkMinusLastRow': tail_b['watermark'] - tail_b['lastRow'],
            'publicTotalDelta': (s_after.get('totals', {}).get('all', 0) - s_before.get('totals', {}).get('all', 0)) if s_after.get('status') == 'OK' and s_before.get('status') == 'OK' else 'UNAVAILABLE',
            'pollTotalsSeen': polls, 'monotone': nums == sorted(nums), 'seconds': secs,
            'lastErrors': sorted({s['lastError'].split(':')[-1].strip()[:50] for s in statuses if s['lastError']})})
        for ctx, _, _ in games: await ctx.close()
        # ---------------- R6c: lost reply / concurrent identical re-sends ----------------
        start_c = tail_b['lastRow']
        same = {'eventId': str(uuid.uuid4()), 'mode': 'SOLO', 'repositoryKind': 'PUBLIC', 'cartridgeIds': [cid], 'cartridgeCount': 1, 'teamCount': 1}
        rc = await f0.evaluate(CALL_MANY, ['recordUsageStartU1', [[same], [same], [same]]])
        tail_c = (await call(f0, 'hojaV4TestTailU3', TOKEN, start_c))['v']
        log('R6C_SAME_EVENT_X3', {'ok': sum(1 for x in rc if x['ok']), 'duplicateIgnored': sum(1 for x in rc if x['ok'] and x['v'].get('duplicateIgnored')),
            'failures': [x['e'].split(':')[-1].strip()[:50] for x in rc if not x['ok']], 'rowsAdded': tail_c['rowsAdded']})
        fin = await call(f0, 'hojaV4TestEvidenceU3', TOKEN)
        log('R6_FINAL_COPY_REVERIFY', {k: fin['v'][k] for k in ('manifestComplete', 'srcShaOk', 'bucketShaOk', 'bucketSetOk', 'bad',
            'watermark', 'sourceLastRow', 'publicCompute', 'publicComputeError')})
        await c0.close(); await browser.close()

asyncio.run(main())
