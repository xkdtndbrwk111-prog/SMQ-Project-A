#!/usr/bin/env python3
"""F4 cache C5 (40-6AL) — REAL Chromium reproduction harness for the browser package cache block
(gas/ApprovedPackageCacheClient.html, or --block <file> to run an older copy for the pre-fix reproduction).
A minimal page carries the block over a tiny HOJA_B_LIVE adapter whose LIST returns catalog rows built from the
local runtime package INDEX (pinned commit 000..0) and whose GET (relay) answers from the same files. Pinned
raw.githubusercontent.com URLs are answered by a counting route with per-unit delays. Counts and ids only.

C5-1 protect-lifetime scenarios:
  P1  GET#1 [X(cached, oldest), V(slow download)] while GET#2 [W] (fast) needs space -> X must NOT be evicted
      while GET#1 is still running (pre-fix: the global protect.clear() in GET#2 un-protects X)
  P2  a failing GET (digest mismatch) releases its protection (the unit becomes evictable again)
  P3  two concurrent GETs of the same unit hold it until BOTH finish
C5-2 IndexedDB blocked / stalled scenarios (finite fallback, never unverified data):
  B1  indexedDB.open never answers (no success/error; 'blocked' fired) -> GET completes via verified download
  B2  real 'blocked' + versionchange across two tabs: a newer-version opener while the block holds v1 -> this page
      closes on versionchange; the cache keeps working via verified one-time downloads (no hang)
  B3  a transaction that never completes -> GET completes in bounded time via verified download
  B4  open error / transaction abort -> verified one-time run, nothing stored
Usage: verify_f4_cache_c5.py --packages DIR --json OUT [--block FILE] [--only P|B] [--deadline-ms 15000]"""
import argparse, asyncio, json, re, sys, time
from pathlib import Path
from playwright.async_api import async_playwright
HERE = Path(__file__).resolve().parent
RAW_RE = re.compile(r'^https://raw\.githubusercontent\.com/xkdtndbrwk111-prog/HOJA-QUESTION-BANK/[a-f0-9]{40}/(game-runtime/approved-packages/v1/([a-z0-9-]+)\.json)$')
PORT = 8811

def rows_from(pkdir):
    idx = json.loads((Path(pkdir) / 'game-runtime/approved-packages/v1/INDEX.json').read_text())
    out = []
    for p in idx['packages']:
        q = len(json.loads((Path(pkdir) / p['path']).read_text())['questions'])
        out.append({'name': p['cartridgeId'], 'cartridgeId': p['cartridgeId'], 'pkg': {'id': p['cartridgeId'], 'sha256': p['sha256'], 'path': p['path'],
                    'commit': '0' * 40, 'repo': 'xkdtndbrwk111-prog/HOJA-QUESTION-BANK', 'questionCount': q, 'sourceCommit': idx['sourceCommit']}})
    return out

def page_html(block, rows):
    adapter = """<script>window.__rows=%s;window.HOJA_B_LIVE={rpc(method,payload){
      if(method==='LIST')return Promise.resolve(JSON.parse(JSON.stringify(window.__rows)));
      if(method==='GET')return Promise.all(payload.map(n=>fetch('/relay/'+n).then(r=>{if(!r.ok)throw new Error('RELAY_DOWN');return r.json()}).then(d=>({sheetName:n,data:d}))));
      return Promise.reject(new Error('DENIED'))}};</script>""" % json.dumps(rows)
    return '<!doctype html><html><head></head><body>' + adapter + block + '</body></html>'

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--packages', required=True); ap.add_argument('--json', required=True); ap.add_argument('--block')
    ap.add_argument('--only'); ap.add_argument('--deadline-ms', type=int, default=15000)
    a = ap.parse_args()
    block = Path(a.block or HERE / 'gas/ApprovedPackageCacheClient.html').read_text(encoding='utf-8')
    rows = rows_from(a.packages); byid = {r['cartridgeId']: r for r in rows}
    html = page_html(block, rows)
    gh = {'ok': {}, 'delay': {}, 'tamper': set(), 'relay': 0}
    res, fails = {}, []
    def check(name, cond, detail):
        res[name] = {'pass': bool(cond), **detail}; (fails.append(name) if not cond else None)
        print(name, 'PASS' if cond else 'FAIL', json.dumps(detail), flush=True)
    async def route(r):
        u = r.request.url
        if u == f'http://127.0.0.1:{PORT}/h.html': return await r.fulfill(body=html, content_type='text/html; charset=utf-8')
        if u.startswith(f'http://127.0.0.1:{PORT}/relay/'):
            gh['relay'] += 1; n = u.rsplit('/', 1)[-1]
            return await r.fulfill(status=200, body=(Path(a.packages) / byid[n]['pkg']['path']).read_bytes(), content_type='application/json')
        m = RAW_RE.match(u)
        if m:
            uid = m.group(2)
            if gh['delay'].get(uid): await asyncio.sleep(gh['delay'][uid] / 1000)
            body = (Path(a.packages) / m.group(1)).read_bytes()
            if uid in gh['tamper']: body = body.replace(b'"explanation":"', b'"explanation":"X', 1)
            gh['ok'][uid] = gh['ok'].get(uid, 0) + 1
            return await r.fulfill(status=200, body=body, headers={'access-control-allow-origin': '*', 'cache-control': 'no-store'})
        await r.abort()
    ids = sorted(byid)
    X, V, W, Z = 'math5-s2-u4', 'eng5-ham-u10', 'soc6-s2-u3-1-common', 'soc5-s2-u3-1-common'
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        async def fresh(init=None):
            ctx = await b.new_context(); await ctx.route('**/*', route)
            if init: await ctx.add_init_script(init)
            p = await ctx.new_page(); await p.goto(f'http://127.0.0.1:{PORT}/h.html')
            await p.wait_for_function('!!window.HOJA_APPROVED_PACKAGE_CACHE'); await p.evaluate("window.HOJA_B_LIVE.rpc('LIST')")
            return ctx, p
        IDB = """(async([fn,arg])=>{const db=await new Promise((ok,no)=>{const q=indexedDB.open('hoja-approved-packages',1);
          q.onupgradeneeded=()=>q.result.createObjectStore('packages',{keyPath:'cartridgeId'});q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
          const out=await new Promise((ok,no)=>{const t=db.transaction('packages',fn==='list'?'readonly':'readwrite');const s=t.objectStore('packages');let r;
            if(fn==='list')r=s.getAll();if(fn==='put')for(const x of arg)s.put(x);if(fn==='touch'){const g=s.get(arg[0]);g.onsuccess=()=>{const v=g.result;v.lastUsedAt=arg[1];s.put(v)}}
            t.oncomplete=()=>ok(r?r.result.map(x=>({id:x.cartridgeId,bytes:x.bytes,lastUsedAt:x.lastUsedAt})):null);t.onerror=()=>no(t.error)});db.close();return out})"""
        async def idb(p, fn, arg=None): return await p.evaluate(IDB, [fn, arg])
        get = lambda p, names: p.evaluate("(n)=>window.HOJA_B_LIVE.rpc('GET',n).then(r=>r.map(x=>x.data.cartridgeId))", names)
        if a.only in (None, 'P'):
            # ---- P1 ----
            ctx, p = await fresh()
            await get(p, [X])                                          # X cached
            now = int(time.time() * 1000)
            await idb(p, 'touch', [X, now - 30 * 86400000])            # X is the OLDEST record
            used = sum(u['bytes'] + 512 for u in await idb(p, 'list'))
            fill = 10485760 - used - 300000                            # room for ~1 package only
            await idb(p, 'put', [{'cartridgeId': 'zz-fill', 'packageSha256': '1' * 64, 'bytes': fill, 'lastUsedAt': now - 20 * 86400000, 'text': 'f'}])
            gh['delay'] = {V: 2500}                                     # GET#1 keeps running while GET#2 stores W
            g1 = asyncio.ensure_future(get(p, [X, V]))
            await asyncio.sleep(0.6)                                   # GET#1 has read X from the cache (and touched it)
            # X is in use by GET#1 but NOT the newest record (lost touch / device clock step / another tab's touches):
            await idb(p, 'touch', [X, now - 30 * 86400000])
            await get(p, [W])                                          # GET#2: storing W needs space -> eviction
            mid = [u['id'] for u in await idb(p, 'list')]
            r1 = await g1; gh['delay'] = {}
            after = [u['id'] for u in await idb(p, 'list')]
            check('P1_parallel_get_keeps_in_use_unit', X in mid and r1 == [X, V],
                  {'xStoredWhileGet1Running': X in mid, 'storeAfterGet2': sorted(mid), 'storeAfterBoth': sorted(after), 'get1': r1})
            await ctx.close()
            # ---- P2 ----
            ctx, p = await fresh()
            await get(p, [X]); gh['tamper'] = {V}
            try: await get(p, [X, V]); failed = False
            except Exception: failed = True
            gh['tamper'] = set()
            prot = await p.evaluate("window.HOJA_APPROVED_PACKAGE_CACHE.diagnose().then(d=>d.protectedUnits||null)")
            check('P2_failed_get_releases_protection', failed and (prot == [] ), {'getFailed': failed, 'protectedAfter': prot})
            await ctx.close()
            # ---- P3 ----
            ctx, p = await fresh()
            gh['delay'] = {Z: 1500}
            ga = asyncio.ensure_future(get(p, [Z])); await asyncio.sleep(0.2)
            gb = asyncio.ensure_future(get(p, [Z])); await asyncio.sleep(0.3)
            during = await p.evaluate("window.HOJA_APPROVED_PACKAGE_CACHE.diagnose().then(d=>d.protectedUnits||null)")
            await ga; await gb; gh['delay'] = {}
            end = await p.evaluate("window.HOJA_APPROVED_PACKAGE_CACHE.diagnose().then(d=>d.protectedUnits||null)")
            check('P3_shared_unit_held_until_all_gets_finish', during == [Z] and end == [], {'protectedDuring': during, 'protectedAfter': end})
            await ctx.close()
        if a.only in (None, 'B'):
            dl = a.deadline_ms
            async def timed(p, names):
                t = time.time()
                try: r = await asyncio.wait_for(get(p, names), timeout=dl / 1000); err = None
                except asyncio.TimeoutError: r, err = None, 'HUNG>' + str(dl) + 'ms'
                except Exception as e: r, err = None, str(e)[:80]
                return r, err, round((time.time() - t) * 1000)
            # ---- B1: open never answers (fires 'blocked' only) ----
            ctx, p = await fresh("""(()=>{const o=indexedDB.open.bind(indexedDB);indexedDB.open=function(n,v){if(n!=='hoja-approved-packages')return o(n,v);
               const req={};setTimeout(()=>{req.onblocked&&req.onblocked(new Event('blocked'))},50);return req}})()""")
            gh['ok'] = {}
            r, err, ms = await timed(p, [X]); d = await p.evaluate('window.HOJA_APPROVED_PACKAGE_CACHE.diagnose()')
            check('B1_open_stalls_blocked_fallback_bounded', r == [X] and err is None and gh['ok'].get(X) == 1 and d['idb'] != 'OK',
                  {'result': r, 'error': err, 'ms': ms, 'downloads': gh['ok'].get(X), 'idb': d['idb']})
            await ctx.close()
            # ---- B2: real blocked/versionchange across two tabs ----
            ctx, p = await fresh(); await get(p, [X])
            p2 = await ctx.new_page(); await p2.goto(f'http://127.0.0.1:{PORT}/h.html')
            ev = await p2.evaluate("""()=>new Promise(ok=>{const q=indexedDB.open('hoja-approved-packages',2);let blocked=false;
               q.onupgradeneeded=()=>{};q.onblocked=()=>{blocked=true};q.onsuccess=()=>{q.result.close();ok({opened:true,blocked})};
               q.onerror=()=>ok({opened:false,blocked,err:String(q.error&&q.error.name)});setTimeout(()=>ok({opened:false,blocked,timeout:true}),8000)})""")
            gh['ok'] = {}
            r, err, ms = await timed(p, [W])
            check('B2_versionchange_from_newer_tab_no_hang', ev.get('opened') and r == [W] and err is None,
                  {'newerTabOpen': ev, 'result': r, 'error': err, 'ms': ms, 'downloads': gh['ok'].get(W)})
            await ctx.close()
            # ---- B3: transaction never completes ----
            ctx, p = await fresh("""(()=>{const T=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(){
               if(this.name!=='hoja-approved-packages')return T.apply(this,arguments);
               const fake={objectStore(){return {get(){return {}},put(){return {}},delete(){return {}},getAll(){return {}},openCursor(){return {}}}},abort(){}};return fake}})()""")
            gh['ok'] = {}
            r, err, ms = await timed(p, [X]); r2, err2, ms2 = await timed(p, [X])
            check('B3_transaction_stall_bounded_fallback', r == [X] and r2 == [X] and err is None and err2 is None and gh['ok'].get(X, 0) >= 1,
                  {'first': [r, err, ms], 'second': [r2, err2, ms2], 'downloads': gh['ok'].get(X)})
            await ctx.close()
            # ---- B4: open error and transaction abort ----
            for label, init in [('openError', """(()=>{const o=indexedDB.open.bind(indexedDB);indexedDB.open=function(n,v){if(n!=='hoja-approved-packages')return o(n,v);
                 const req={error:new DOMException('denied','UnknownError')};setTimeout(()=>req.onerror&&req.onerror(new Event('error')),10);return req}})()"""),
                                ('txAbort', """(()=>{const T=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(){const t=T.apply(this,arguments);
                 if(this.name==='hoja-approved-packages')setTimeout(()=>{try{t.abort()}catch(e){}},0);return t}})()""")]:
                ctx, p = await fresh(init); gh['ok'] = {}
                r, err, ms = await timed(p, [X]); d = await p.evaluate('window.HOJA_APPROVED_PACKAGE_CACHE.diagnose()')
                check('B4_' + label + '_verified_one_time', r == [X] and err is None and gh['ok'].get(X) == 1 and len(d['units']) == 0,
                      {'result': r, 'error': err, 'ms': ms, 'storedUnits': len(d['units']), 'idb': d['idb']})
                await ctx.close()
        await b.close()
    Path(a.json).write_text(json.dumps({'block': str(a.block or 'current'), 'scenarios': res, 'fails': fails}, indent=1))
    print('F4_CACHE_C5_' + ('PASS' if not fails else 'FAIL'), json.dumps(fails)); sys.exit(1 if fails else 0)

asyncio.run(main())
