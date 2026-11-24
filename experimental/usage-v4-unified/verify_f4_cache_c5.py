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
  B5  REAL stall, no API stub: another tab holds a v1 connection that ignores versionchange and has a pending
      deleteDatabase; the cache's own indexedDB.open queues behind that delete and gets no answer -> bounded
      verified download; after the other tab lets go, the late connection must not stay open (a v2 open succeeds)
  B6a stall + tampered GitHub bytes -> GET FAILS closed (digest mismatch), no relay, nothing used or stored
  B6b stall + GitHub unreachable -> one-shot GAS relay (server-verified, SHA re-checked before any caching)
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
    gh = {'ok': {}, 'delay': {}, 'tamper': set(), 'down': set(), 'relay': 0}
    res, fails = {}, []
    def check(name, cond, detail):
        res[name] = {'pass': bool(cond), **detail}; (fails.append(name) if not cond else None)
        print(name, 'PASS' if cond else 'FAIL', json.dumps(detail), flush=True)
    async def route(r):
        u = r.request.url
        if u == f'http://127.0.0.1:{PORT}/h.html': return await r.fulfill(body=html, content_type='text/html; charset=utf-8')
        if u == f'http://127.0.0.1:{PORT}/blank.html': return await r.fulfill(body='<!doctype html><title>other tab</title>', content_type='text/html')
        if u.startswith(f'http://127.0.0.1:{PORT}/relay/'):
            gh['relay'] += 1; n = u.rsplit('/', 1)[-1]
            return await r.fulfill(status=200, body=(Path(a.packages) / byid[n]['pkg']['path']).read_bytes(), content_type='application/json')
        m = RAW_RE.match(u)
        if m:
            uid = m.group(2)
            if uid in gh['down']: return await r.abort('internetdisconnected')
            if gh['delay'].get(uid): await asyncio.sleep(gh['delay'][uid] / 1000)
            body = (Path(a.packages) / m.group(1)).read_bytes()
            if uid in gh['tamper']: body = body.replace(b'"explanation":"', b'"explanation":"X', 1)
            gh['ok'][uid] = gh['ok'].get(uid, 0) + 1
            return await r.fulfill(status=200, body=body, headers={'access-control-allow-origin': '*', 'cache-control': 'no-store'})
        await r.abort()
    ids = sorted(byid)
    X, V, W, Z = 'math5-s2-u4', 'eng5-ham-u10', 'soc6-s2-u3-1-common', 'soc5-s2-u3-1-common'
    async def bounded(coro, ms=None):
        # EVERY page call that can reach IndexedDB is time-bounded (attempt 1 hung on an unbounded diagnose())
        ms = ms or a.deadline_ms
        try: return await asyncio.wait_for(coro, timeout=ms / 1000), None
        except asyncio.TimeoutError: return None, 'HUNG>' + str(ms) + 'ms'
        except Exception as e: return None, str(e)[:80]
    async def diag(p):
        d, err = await bounded(p.evaluate('window.HOJA_APPROVED_PACKAGE_CACHE.diagnose()'))
        return d if d is not None else {'idb': 'DIAGNOSE_' + err, 'units': None}
    async def close(ctx):
        await bounded(ctx.close(), 10000)
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        async def fresh(init=None):
            ctx = await b.new_context(); await ctx.route('**/*', route)
            if init: await ctx.add_init_script(init)
            p = await ctx.new_page(); await p.goto(f'http://127.0.0.1:{PORT}/h.html')
            await p.wait_for_function('!!window.HOJA_APPROVED_PACKAGE_CACHE')
            _, err = await bounded(p.evaluate("window.HOJA_B_LIVE.rpc('LIST')"))
            if err: print('  (LIST in fresh page:', err + ')', flush=True)
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
                t = time.time(); r, err = await bounded(get(p, names), dl)
                return r, err, round((time.time() - t) * 1000)
            # ---- B1: open never answers (fires 'blocked' only) ----
            print('START B1', flush=True)
            ctx, p = await fresh("""(()=>{const o=indexedDB.open.bind(indexedDB);indexedDB.open=function(n,v){if(n!=='hoja-approved-packages')return o(n,v);
               const req={};setTimeout(()=>{req.onblocked&&req.onblocked(new Event('blocked'))},50);return req}})()""")
            gh['ok'] = {}
            r, err, ms = await timed(p, [X]); d = await diag(p)
            check('B1_open_stalls_blocked_fallback_bounded', r == [X] and err is None and gh['ok'].get(X) == 1 and d['idb'] != 'OK',
                  {'result': r, 'error': err, 'ms': ms, 'downloads': gh['ok'].get(X), 'idb': d['idb']})
            await close(ctx)
            # ---- B2: real blocked/versionchange across two tabs ----
            print('START B2', flush=True)
            ctx, p = await fresh(); await timed(p, [X])
            p2 = await ctx.new_page(); await p2.goto(f'http://127.0.0.1:{PORT}/h.html')
            ev = await p2.evaluate("""()=>new Promise(ok=>{const q=indexedDB.open('hoja-approved-packages',2);let blocked=false;
               q.onupgradeneeded=()=>{};q.onblocked=()=>{blocked=true};q.onsuccess=()=>{q.result.close();ok({opened:true,blocked})};
               q.onerror=()=>ok({opened:false,blocked,err:String(q.error&&q.error.name)});setTimeout(()=>ok({opened:false,blocked,timeout:true}),8000)})""")
            gh['ok'] = {}
            r, err, ms = await timed(p, [W])
            check('B2_versionchange_from_newer_tab_no_hang', ev.get('opened') and r == [W] and err is None,
                  {'newerTabOpen': ev, 'result': r, 'error': err, 'ms': ms, 'downloads': gh['ok'].get(W)})
            await close(ctx)
            # ---- B3: transaction never completes ----
            print('START B3', flush=True)
            ctx, p = await fresh("""(()=>{const T=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(){
               if(this.name!=='hoja-approved-packages')return T.apply(this,arguments);
               const fake={objectStore(){return {get(){return {}},put(){return {}},delete(){return {}},getAll(){return {}},openCursor(){return {}}}},abort(){}};return fake}})()""")
            gh['ok'] = {}
            r, err, ms = await timed(p, [X]); r2, err2, ms2 = await timed(p, [X])
            check('B3_transaction_stall_bounded_fallback', r == [X] and r2 == [X] and err is None and err2 is None and gh['ok'].get(X, 0) >= 1,
                  {'first': [r, err, ms], 'second': [r2, err2, ms2], 'downloads': gh['ok'].get(X)})
            await close(ctx)
            # ---- B4: open error and transaction abort ----
            for label, init in [('openError', """(()=>{const o=indexedDB.open.bind(indexedDB);indexedDB.open=function(n,v){if(n!=='hoja-approved-packages')return o(n,v);
                 const req={error:new DOMException('denied','UnknownError')};setTimeout(()=>req.onerror&&req.onerror(new Event('error')),10);return req}})()"""),
                                ('txAbort', """(()=>{const T=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(){const t=T.apply(this,arguments);
                 if(this.name==='hoja-approved-packages')setTimeout(()=>{try{t.abort()}catch(e){}},0);return t}})()""")]:
                print('START B4_' + label, flush=True)
                ctx, p = await fresh(init); gh['ok'] = {}
                r, err, ms = await timed(p, [X]); d = await diag(p)
                check('B4_' + label + '_verified_one_time', r == [X] and err is None and gh['ok'].get(X) == 1 and d['units'] is not None and len(d['units']) == 0,
                      {'result': r, 'error': err, 'ms': ms, 'storedUnits': None if d['units'] is None else len(d['units']), 'idb': d['idb']})
                await close(ctx)
            # ---- B5: REAL stall (no stub): pending deleteDatabase blocked by another tab's connection ----
            print('START B5', flush=True)
            ctx = await b.new_context(); await ctx.route('**/*', route)
            other = await ctx.new_page(); await other.goto(f'http://127.0.0.1:{PORT}/blank.html')
            hold = await other.evaluate("""()=>new Promise(ok=>{const q=indexedDB.open('hoja-approved-packages',1);
               q.onupgradeneeded=()=>q.result.createObjectStore('packages',{keyPath:'cartridgeId'});
               q.onsuccess=()=>{window.__held=q.result;window.__held.onversionchange=()=>{};   // ignores versionchange: never closes
                 const del=indexedDB.deleteDatabase('hoja-approved-packages');window.__del={blocked:false,done:false};
                 del.onblocked=()=>{window.__del.blocked=true};del.onsuccess=()=>{window.__del.done=true};
                 setTimeout(()=>ok({held:true,deleteBlocked:window.__del.blocked,deleteDone:window.__del.done}),300)}})""")
            p = await ctx.new_page(); await p.goto(f'http://127.0.0.1:{PORT}/h.html'); await p.wait_for_function('!!window.HOJA_APPROVED_PACKAGE_CACHE')
            _, lerr = await bounded(p.evaluate("window.HOJA_B_LIVE.rpc('LIST')"))
            gh['ok'] = {}
            r, err, ms = await timed(p, [X]); d = await diag(p)
            # the other tab lets go -> the queued delete finishes, the cache's late open then succeeds and must be closed at once
            await other.evaluate("window.__held.close()"); await asyncio.sleep(1.5)
            v2, v2err = await bounded(other.evaluate("""()=>new Promise(ok=>{const q=indexedDB.open('hoja-approved-packages',2);let blocked=false;
               q.onupgradeneeded=()=>{};q.onblocked=()=>{blocked=true};q.onsuccess=()=>{q.result.close();ok({opened:true,blocked})};
               q.onerror=()=>ok({opened:false,blocked});setTimeout(()=>ok({opened:false,blocked,timeout:true}),5000)})"""), 8000)
            delst = await other.evaluate('window.__del')
            check('B5_real_pending_delete_stall_bounded_and_late_conn_closed',
                  hold['deleteBlocked'] and not hold['deleteDone'] and r == [X] and err is None and gh['ok'].get(X) == 1 and d['idb'] != 'OK'
                  and v2 is not None and v2.get('opened') and not v2.get('blocked'),
                  {'otherTab': hold, 'listErr': lerr, 'result': r, 'error': err, 'ms': ms, 'downloads': gh['ok'].get(X),
                   'idb': d['idb'], 'idbState': d.get('idbState'), 'stats': {k: (d.get('stats') or {}).get(k) for k in ('idbBlocked', 'idbTimeouts', 'stored')},
                   'deleteAfterRelease': delst, 'v2OpenAfter': v2 or v2err})
            await close(ctx)
            # ---- B6: stall + tampered bytes (fail closed) / stall + GitHub down (relay one-shot) ----
            STALL = """(()=>{const o=indexedDB.open.bind(indexedDB);indexedDB.open=function(n,v){if(n!=='hoja-approved-packages')return o(n,v);
               const req={};setTimeout(()=>{req.onblocked&&req.onblocked(new Event('blocked'))},50);return req}})()"""
            print('START B6a', flush=True)
            ctx, p = await fresh(STALL); gh['ok'] = {}; gh['tamper'] = {X}; rl0 = gh['relay']
            r, err, ms = await timed(p, [X]); d = await diag(p); gh['tamper'] = set()
            check('B6a_stall_tampered_bytes_fail_closed', r is None and err is not None and 'DIGEST_MISMATCH' in err and gh['relay'] == rl0,
                  {'result': r, 'error': err, 'ms': ms, 'relayCalls': gh['relay'] - rl0, 'storedUnits': d['units'] if d['units'] is None else len(d['units'])})
            await close(ctx)
            print('START B6b', flush=True)
            ctx, p = await fresh(STALL); gh['ok'] = {}; gh['down'] = {X}; rl0 = gh['relay']
            r, err, ms = await timed(p, [X]); d = await diag(p); gh['down'] = set()
            check('B6b_stall_github_down_relay_one_shot', r == [X] and err is None and gh['relay'] - rl0 == 1 and (d.get('stats') or {}).get('relayed') == 1,
                  {'result': r, 'error': err, 'ms': ms, 'relayCalls': gh['relay'] - rl0, 'relayed': (d.get('stats') or {}).get('relayed'), 'idb': d['idb']})
            await close(ctx)
        await b.close()
    Path(a.json).write_text(json.dumps({'block': str(a.block or 'current'), 'scenarios': res, 'fails': fails}, indent=1))
    print('F4_CACHE_C5_' + ('PASS' if not fails else 'FAIL'), json.dumps(fails)); sys.exit(1 if fails else 0)

asyncio.run(main())
