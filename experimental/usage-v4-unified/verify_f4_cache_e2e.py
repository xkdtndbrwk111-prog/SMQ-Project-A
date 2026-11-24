#!/usr/bin/env python3
"""F4 (40-6AD) browser package cache E2E — REAL Chromium with a PERSISTENT profile (reload + browser restart).
The game page is the lite release-candidate Game.html (cache block injected) talking to the REAL single-GAS
sources in the mock engine (qa_mock_gas_server.mjs). The PINNED raw.githubusercontent.com package URLs are
answered by a counting browser route from locally built packages (the packages are NOT yet published on
GitHub) — every request the page makes to GitHub is counted per unit. Counts and ids only, no content.

Scenarios (each an assert; any failure -> exit 1):
  A  fresh profile, unit X via the real UI + a solo game start -> X downloaded once, stored, ONE A1 row
  B  same unit again (same page)                              -> 0 downloads (cache hit)
  C  page reload                                              -> 0 downloads
  D  browser closed and relaunched on the same profile        -> 0 downloads
  E  another unit Y                                           -> only Y downloaded
  F  new approved version of X (new commit + new SHA)         -> only X re-downloaded; Y still a hit
  G  stored X bytes tampered in IndexedDB                     -> detected, discarded, re-downloaded once
  H  GitHub unreachable: cached X still plays (0 successful downloads); uncached Z -> GAS relay used
  I  GitHub AND relay unreachable, uncached unit              -> clear error, NO A1 row
  J  IndexedDB unavailable                                    -> verified one-time run each load, nothing stored
  K  same unit requested concurrently in one page             -> 1 download
  L  two tabs, same uncached unit                             -> both succeed, 1 stored record (downloads <= 2)
  M  90-day-unused purge + 10 MiB LRU eviction with a protected in-use unit
  N  all 23 units: canonical bytes hash == catalog SHA, 732 questions; second pass 23 hits / 0 downloads
Usage: verify_f4_cache_e2e.py --html G --phaser P --port N --catalog-dir D --catalog-dir-v2 D2 --packages P1 --packages-v2 P2 --json OUT"""
import argparse, asyncio, json, re, subprocess, sys, tempfile, shutil, time, hashlib
from pathlib import Path
from playwright.async_api import async_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from verify_f3_ui_e2e import STUB, backend, to_catalog, pick_unit, mode

HERE = Path(__file__).resolve().parent
RAW_RE = re.compile(r'^https://raw\.githubusercontent\.com/xkdtndbrwk111-prog/HOJA-QUESTION-BANK/([a-f0-9]{40})/(game-runtime/approved-packages/v1/([a-z0-9-]+)\.json)$')

class GitHubStandIn:
    """Counting route for the pinned raw URLs. commit -> package dir. mode: ok | down."""
    def __init__(self, dirs): self.dirs = dirs; self.mode = 'ok'; self.ok = {}; self.failed = 0; self.delay_ms = 0
    def reset(self): self.ok = {}; self.failed = 0
    async def handle(self, route):
        m = RAW_RE.match(route.request.url)
        if not m: return await route.abort()
        if self.mode == 'down': self.failed += 1; return await route.abort('internetdisconnected')
        d = self.dirs.get(m.group(1)); f = (Path(d) / m.group(2)) if d else None
        if not f or not f.exists(): self.failed += 1; return await route.fulfill(status=404, body='', headers={'access-control-allow-origin': '*'})
        if self.delay_ms: await asyncio.sleep(self.delay_ms / 1000)
        self.ok[m.group(3)] = self.ok.get(m.group(3), 0) + 1
        await route.fulfill(status=200, body=f.read_bytes(), headers={'access-control-allow-origin': '*', 'content-type': 'text/plain; charset=utf-8',
                                                                       'cache-control': 'no-store'})
    @property
    def total(self): return sum(self.ok.values())

class Server:
    def __init__(self, port): self.port = port; self.proc = None
    def start(self, catalog_dir, packages=None):
        self.stop()
        args = ['node', str(HERE / 'qa_mock_gas_server.mjs'), str(catalog_dir), str(self.port)] + ([str(packages)] if packages else [])
        self.proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        line = self.proc.stdout.readline()
        assert line.startswith('READY'), ('MOCK_SERVER_NOT_READY', line)
    def stop(self):
        if self.proc: self.proc.terminate(); self.proc.wait(); self.proc = None

async def open_ctx(pw, profile, html, phaser, port, gh, no_idb=False):
    ctx = await pw.chromium.launch_persistent_context(profile, headless=True, viewport={'width': 1280, 'height': 800})
    if no_idb:
        await ctx.add_init_script("Object.defineProperty(window,'indexedDB',{configurable:true,get(){throw new DOMException('blocked','SecurityError')}})")
    async def route(r):
        u = r.request.url
        if u == f'http://127.0.0.1:{port}/game.html': await r.fulfill(body=html, content_type='text/html; charset=utf-8')
        elif u.endswith('phaser.min.js'): await r.fulfill(body=phaser, content_type='application/javascript')
        elif u.startswith('https://raw.githubusercontent.com/'): await gh.handle(r)
        elif u.startswith(('data:', f'http://127.0.0.1:{port}')): await r.continue_()
        else: await r.abort()
    await ctx.route('**/*', route)
    return ctx

async def new_page(ctx, port, dialogs=None):
    page = ctx.pages[0] if ctx.pages else await ctx.new_page()
    if dialogs is not None:
        page.on('dialog', lambda d: (dialogs.append(d.message[:200]), asyncio.ensure_future(d.dismiss())))
    await page.goto(f'http://127.0.0.1:{port}/game.html', wait_until='domcontentloaded', timeout=180000)
    await page.wait_for_function('!!window.HOJA_APPROVED_PACKAGE_CACHE&&!!window.HOJA_B_LIVE', timeout=120000)
    await page.wait_for_timeout(3000)
    return page

async def list_rows(page):
    return await page.evaluate("window.HOJA_B_LIVE.rpc('LIST')")

async def get_units(page, names):
    return await page.evaluate("""async(names)=>{const r=await window.HOJA_B_LIVE.rpc('GET',names);
      return r.map(x=>({sheetName:x.sheetName,n:x.data.questions.length,cid:x.data.cartridgeId}))}""", names)

async def diag(page): return await page.evaluate('window.HOJA_APPROVED_PACKAGE_CACHE.diagnose()')

async def main():
    ap = argparse.ArgumentParser()
    for k in ('--html', '--phaser', '--catalog-dir', '--catalog-dir-v2', '--packages', '--packages-v2', '--json'): ap.add_argument(k, required=True)
    ap.add_argument('--port', type=int, default=8790)
    ap.add_argument('--commit', default='0' * 40); ap.add_argument('--commit-v2', default='1' * 40)
    ap.add_argument('--x', default='math5-s2-u4'); ap.add_argument('--y', default='eng5-ham-u10'); ap.add_argument('--z', default='soc6-s2-u3-1-common')
    a = ap.parse_args()
    html = Path(a.html).read_text(encoding='utf-8').replace('<head>', '<head>' + STUB.replace('PORT', str(a.port)), 1)
    phaser = Path(a.phaser).read_bytes()
    gh = GitHubStandIn({a.commit: a.packages, a.commit_v2: a.packages_v2})
    srv = Server(a.port); srv.start(a.catalog_dir, a.packages)
    res = {}; fails = []
    def check(name, cond, detail):
        res[name] = {'pass': bool(cond), **detail}
        if not cond: fails.append(name)
        print(name, 'PASS' if cond else 'FAIL', json.dumps(detail, ensure_ascii=False), flush=True)
    prof = tempfile.mkdtemp(prefix='hoja-f4c-')
    try:
        async with async_playwright() as pw:
            rows = None
            # ---- A: fresh profile, real UI pick + solo start ----
            ctx = await open_ctx(pw, prof, html, phaser, a.port, gh); page = await new_page(ctx, a.port)
            names = {x['cartridgeId']: x['name'] for x in backend(a.port, '/rpc', {'fn': 'hojaListPublicCartridges', 'args': []})['v']}
            before = len(backend(a.port)['usageRows'])
            await to_catalog(page); await pick_unit(page, names[a.x]); await mode(page, '혼자 놀기', '문제 풀이 모드')
            await page.wait_for_timeout(2500)
            d = await diag(page); rowsA = backend(a.port)['usageRows'][before:]
            check('A_fresh_download_store_one_A1', gh.ok.get(a.x) == 1 and gh.total == 1 and any(u['id'] == a.x for u in d['units']) and len(rowsA) == 1 and rowsA[0]['ids'] == a.x,
                  {'downloads': dict(gh.ok), 'stored': [u['id'] for u in d['units']], 'usageRowsAdded': len(rowsA), 'idb': d['idb']})
            # ---- B: same unit again, same page ----
            gh.reset(); r = await get_units(page, [names[a.x]])
            check('B_same_unit_cache_hit', gh.total == 0 and r[0]['cid'] == a.x, {'downloads': gh.total, 'questions': r[0]['n']})
            # ---- C: reload ----
            gh.reset(); await page.reload(wait_until='domcontentloaded'); await page.wait_for_function('!!window.HOJA_APPROVED_PACKAGE_CACHE', timeout=120000)
            await list_rows(page); r = await get_units(page, [names[a.x]]); st = (await diag(page))['stats']
            check('C_reload_cache_hit', gh.total == 0 and st['hits'] == 1, {'downloads': gh.total, 'hits': st['hits']})
            await ctx.close()
            # ---- D: browser restart on the same profile ----
            gh.reset(); ctx = await open_ctx(pw, prof, html, phaser, a.port, gh); page = await new_page(ctx, a.port)
            await to_catalog(page); await pick_unit(page, names[a.x]); st = (await diag(page))['stats']
            check('D_browser_restart_cache_hit_via_ui', gh.total == 0 and st['hits'] == 1, {'downloads': gh.total, 'hits': st['hits']})
            # ---- E: another unit ----
            gh.reset(); r = await get_units(page, [names[a.y]])
            check('E_other_unit_only_it_downloads', gh.ok == {a.y: 1}, {'downloads': dict(gh.ok)})
            # ---- K: concurrent same-unit requests in one page (fresh unit Z, slow GitHub) ----
            gh.reset(); gh.delay_ms = 800
            await page.evaluate("""async(n)=>{const r=window.HOJA_B_LIVE.rpc;await Promise.all([r('GET',[n]),r('GET',[n]),r('GET',[n])])}""", names[a.z])
            gh.delay_ms = 0
            check('K_concurrent_same_unit_one_download', gh.ok.get(a.z) == 1, {'downloads': dict(gh.ok)})
            # ---- G: tamper the stored X bytes ----
            await page.evaluate("""async(id)=>{const db=await new Promise((ok,no)=>{const q=indexedDB.open('hoja-approved-packages',1);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
              await new Promise((ok,no)=>{const t=db.transaction('packages','readwrite');const s=t.objectStore('packages');const g=s.get(id);
              g.onsuccess=()=>{const r=g.result;r.text=r.text.replace('"explanation":"','"explanation":"X');s.put(r)};t.oncomplete=ok;t.onerror=()=>no(t.error)});db.close()}""", a.x)
            gh.reset(); s0 = (await diag(page))['stats']; r = await get_units(page, [names[a.x]]); s1 = (await diag(page))['stats']
            check('G_tampered_cache_discarded_and_redownloaded', gh.ok == {a.x: 1} and s1['discarded'] == s0['discarded'] + 1 and r[0]['cid'] == a.x,
                  {'downloads': dict(gh.ok), 'discarded': s1['discarded'] - s0['discarded']})
            # ---- H: GitHub unreachable ----
            gh.reset(); gh.mode = 'down'
            r = await get_units(page, [names[a.x]]); okx = r[0]['cid'] == a.x and gh.total == 0
            s0 = (await diag(page))['stats']
            # an uncached unit must fall back to the GAS relay (mock server answers it)
            uncached = next(c for c in names if c not in (a.x, a.y, a.z))
            r2 = await get_units(page, [names[uncached]]); s1 = (await diag(page))['stats']
            gh.mode = 'ok'
            check('H_github_down_cache_plays_uncached_uses_relay', okx and r2[0]['cid'] == uncached and s1['relayed'] == s0['relayed'] + 1,
                  {'cachedPlayedWithZeroDownloads': okx, 'relayedUncached': s1['relayed'] - s0['relayed'], 'relayResultCachedAfterHashCheck': uncached in [u['id'] for u in (await diag(page))['units']]})
            # ---- L: two tabs, same uncached unit ----
            gh.reset(); gh.delay_ms = 600
            tab2 = await ctx.new_page(); await tab2.goto(f'http://127.0.0.1:{a.port}/game.html', wait_until='domcontentloaded', timeout=180000)
            await tab2.wait_for_function('!!window.HOJA_APPROVED_PACKAGE_CACHE', timeout=120000); await list_rows(tab2)
            w = next(c for c in names if c not in (a.x, a.y, a.z, uncached))
            r1, r2 = await asyncio.gather(get_units(page, [names[w]]), get_units(tab2, [names[w]]))
            gh.delay_ms = 0; dd = await diag(page)
            check('L_two_tabs_same_unit', r1[0]['cid'] == w and r2[0]['cid'] == w and gh.ok.get(w, 0) <= 2 and [u['id'] for u in dd['units']].count(w) == 1,
                  {'downloads': gh.ok.get(w, 0), 'storedRecords': [u['id'] for u in dd['units']].count(w)})
            await tab2.close()
            # ---- M: 90-day purge + LRU with a protected unit ----
            now = int(time.time() * 1000)
            await page.evaluate("""async([now])=>{const db=await new Promise((ok,no)=>{const q=indexedDB.open('hoja-approved-packages',1);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
              await new Promise((ok,no)=>{const t=db.transaction('packages','readwrite');const s=t.objectStore('packages');
                s.put({cartridgeId:'zz-old-91-days',packageSha256:'0'.repeat(64),bytes:1000,lastUsedAt:now-91*86400000,text:'x'});
                t.oncomplete=ok;t.onerror=()=>no(t.error)});db.close()}""", [now])
            await list_rows(page); await page.wait_for_timeout(500)
            ids = [u['id'] for u in (await diag(page))['units']]
            purged = 'zz-old-91-days' not in ids
            # make X the OLDEST real record, then fill the store close to 10 MiB with newer synthetic records
            dd = await diag(page); used = dd['usedBytes']
            fill = 10485760 - used - 100000
            await page.evaluate("""async([id,now,fill])=>{const db=await new Promise((ok,no)=>{const q=indexedDB.open('hoja-approved-packages',1);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
              await new Promise((ok,no)=>{const t=db.transaction('packages','readwrite');const s=t.objectStore('packages');const g=s.get(id);
                g.onsuccess=()=>{const r=g.result;r.lastUsedAt=now-80*86400000;s.put(r)};
                const half=Math.floor(fill/2);
                s.put({cartridgeId:'zz-fill-a',packageSha256:'1'.repeat(64),bytes:half,lastUsedAt:now-70*86400000,text:'a'});
                s.put({cartridgeId:'zz-fill-b',packageSha256:'2'.repeat(64),bytes:fill-half,lastUsedAt:now-60*86400000,text:'b'});
                t.oncomplete=ok;t.onerror=()=>no(t.error)});db.close()}""", [a.x, now, fill])
            # request [X (protected, oldest), new unit V] -> storing V must evict fills (LRU), never X
            v = next(c for c in names if c not in (a.x, a.y, a.z, uncached, w))
            gh.reset(); s0 = (await diag(page))['stats']
            # X is cached (hit, then protected); V needs space
            r = await get_units(page, [names[a.x], names[v]]); dd = await diag(page); s1 = dd['stats']; ids = [u['id'] for u in dd['units']]
            check('M_purge_90d_and_LRU_protects_in_use', purged and a.x in ids and v in ids and 'zz-fill-a' not in ids and dd['usedBytes'] <= 10485760 and s1['evicted'] > s0['evicted'],
                  {'purged91d': purged, 'xKept': a.x in ids, 'newStored': v in ids, 'evicted': s1['evicted'] - s0['evicted'], 'usedBytes': dd['usedBytes'], 'limit': 10485760})
            await page.evaluate("""async()=>{const db=await new Promise((ok,no)=>{const q=indexedDB.open('hoja-approved-packages',1);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
              await new Promise((ok,no)=>{const t=db.transaction('packages','readwrite');const s=t.objectStore('packages');s.delete('zz-fill-a');s.delete('zz-fill-b');t.oncomplete=ok;t.onerror=()=>no(t.error)});db.close()}""")
            # ---- N: all 23 units ----
            rows = await list_rows(page); pk = {x['pkg']['id']: x for x in rows if x.get('pkg')}
            gh.reset(); s0 = (await diag(page))['stats']
            out = await page.evaluate("""async(rows)=>{const enc=new TextEncoder();const res=[];
              for(const r of rows){const g=await window.HOJA_B_LIVE.rpc('GET',[r.name]);const t=JSON.stringify(g[0].data);
                const h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(t)))].map(b=>b.toString(16).padStart(2,'0')).join('');
                res.push({id:r.pkg.id,ok:h===r.pkg.sha256,n:g[0].data.questions.length,imgs:Object.keys(g[0].data.images).length,tags:Object.keys(g[0].data.tags).length})}
              return res}""", [pk[k] for k in sorted(pk)])
            first = gh.total; s1 = (await diag(page))['stats']
            gh.reset()
            await page.evaluate("""async(rows)=>{for(const r of rows)await window.HOJA_B_LIVE.rpc('GET',[r.name])}""", [pk[k] for k in sorted(pk)])
            second = gh.total; s2 = (await diag(page))['stats']; dd = await diag(page)
            check('N_23_units_exact_and_second_pass_zero_downloads',
                  len(out) == 23 and all(x['ok'] for x in out) and sum(x['n'] for x in out) == 732 and second == 0 and s2['hits'] - s1['hits'] == 23,
                  {'units': len(out), 'shaOk': sum(x['ok'] for x in out), 'questions': sum(x['n'] for x in out), 'images': sum(x['imgs'] for x in out),
                   'tagEntries': sum(x['tags'] for x in out), 'firstPassDownloads': first, 'secondPassDownloads': second,
                   'secondPassHits': s2['hits'] - s1['hits'], 'storedUnits': len(dd['units']), 'usedBytes': dd['usedBytes']})
            await ctx.close()
            # ---- F: new approved version of X (catalog v2: new commit + new X SHA) ----
            srv.start(a.catalog_dir_v2, a.packages_v2); gh.reset()
            ctx = await open_ctx(pw, prof, html, phaser, a.port, gh); page = await new_page(ctx, a.port)
            await list_rows(page); r = await get_units(page, [names[a.x]]); r2 = await get_units(page, [names[a.y]])
            check('F_new_version_only_changed_unit_redownloaded', gh.ok == {a.x: 1}, {'downloads': dict(gh.ok)})
            await ctx.close()
            # ---- I: GitHub AND relay unreachable, uncached unit (fresh profile) -> error, no A1 ----
            srv.start(a.catalog_dir)   # no packages dir: the GAS relay cannot fetch either
            gh.reset(); gh.mode = 'down'; dialogs = []
            prof_i = tempfile.mkdtemp(prefix='hoja-f4c-i-')
            ctx = await open_ctx(pw, prof_i, html, phaser, a.port, gh); page = await new_page(ctx, a.port, dialogs)
            before = len(backend(a.port)['usageRows'])
            await to_catalog(page)
            try: await pick_unit(page, names[a.y]); reached = True
            except Exception: reached = False
            await page.wait_for_timeout(1500)
            after = len(backend(a.port)['usageRows'])
            check('I_no_network_no_cache_clear_error_no_A1', not reached and after == before and any('문제 로딩 실패' in m for m in dialogs),
                  {'modeScreenReached': reached, 'usageRowsAdded': after - before, 'dialog': [m[:80] for m in dialogs]})
            gh.mode = 'ok'; await ctx.close(); shutil.rmtree(prof_i, ignore_errors=True)
            # ---- J: IndexedDB unavailable ----
            srv.start(a.catalog_dir, a.packages); gh.reset()
            prof_j = tempfile.mkdtemp(prefix='hoja-f4c-j-')
            ctx = await open_ctx(pw, prof_j, html, phaser, a.port, gh, no_idb=True); page = await new_page(ctx, a.port)
            await list_rows(page); r1 = await get_units(page, [names[a.x]]); r2 = await get_units(page, [names[a.x]]); dd = await diag(page)
            check('J_indexeddb_unavailable_verified_one_time_runs', r1[0]['cid'] == a.x and r2[0]['cid'] == a.x and dd['idb'] == 'UNAVAILABLE' and gh.ok.get(a.x) == 2 and dd['stats']['stored'] == 0,
                  {'idb': dd['idb'], 'downloads': gh.ok.get(a.x), 'stored': dd['stats']['stored']})
            await ctx.close(); shutil.rmtree(prof_j, ignore_errors=True)
    finally:
        srv.stop(); shutil.rmtree(prof, ignore_errors=True)
    Path(a.json).write_text(json.dumps({'scenarios': res, 'fails': fails}, ensure_ascii=False, indent=1))
    print('F4_CACHE_E2E_' + ('PASS' if not fails else 'FAIL'), json.dumps(fails)); sys.exit(1 if fails else 0)

asyncio.run(main())
