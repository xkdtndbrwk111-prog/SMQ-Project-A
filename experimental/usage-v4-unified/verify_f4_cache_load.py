#!/usr/bin/env python3
"""F4 C4 — classroom start measurement for the browser package cache (REAL Chromium, mock GAS, GitHub stand-in).
N students = N isolated browser contexts (separate storage, like separate devices: NO cache sharing between them)
start the SAME unit at the same moment. A small harness page carries the exact injected cache block
(gas/ApprovedPackageCacheClient.html) over a minimal HOJA_B_LIVE adapter (google.script.run -> mock GAS);
it measures package loading only, not game rendering. Two rounds: first entry (cold) and re-entry (warm, reload).
Modes: direct  = browser -> pinned GitHub URL (stand-in route, fixed latency)
       relay   = GitHub unreachable from the browser -> every cold student falls back to the GAS GET relay
Reports per round: GitHub requests, GAS GET calls, GAS relay fetches, cache hits, load ms p50/p95/max. Counts only.
NOTE: the mock GAS is one local Node process; GAS relay timings here are NOT Apps Script timings.
Usage: verify_f4_cache_load.py --catalog-dir D --packages P --port N --students 36 --unit math5-s2-u4 --mode direct|relay --json OUT"""
import argparse, asyncio, json, re, subprocess, statistics, sys, time
from pathlib import Path
from playwright.async_api import async_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from verify_f3_ui_e2e import STUB, backend
HERE = Path(__file__).resolve().parent
RAW_RE = re.compile(r'^https://raw\.githubusercontent\.com/xkdtndbrwk111-prog/HOJA-QUESTION-BANK/[a-f0-9]{40}/(game-runtime/approved-packages/v1/[a-z0-9-]+\.json)$')
ADAPTER = """<script>window.HOJA_B_LIVE={rpc(method,payload){return new Promise((ok,no)=>{
 const r=google.script.run.withSuccessHandler(ok).withFailureHandler(no);
 if(method==='LIST')r.hojaListPublicCartridges();else if(method==='GET')r.hojaGetPublicQuestions(payload);else no(new Error('DENIED'))})}};</script>"""

def pct(v, p):
    v = sorted(v); return v[min(len(v) - 1, int(round(p / 100 * (len(v) - 1))))] if v else None

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--catalog-dir', required=True); ap.add_argument('--packages', required=True); ap.add_argument('--json', required=True)
    ap.add_argument('--port', type=int, default=8796); ap.add_argument('--students', type=int, default=36)
    ap.add_argument('--unit', default='math5-s2-u4'); ap.add_argument('--mode', choices=['direct', 'relay'], default='direct')
    ap.add_argument('--github-latency-ms', type=int, default=150)
    a = ap.parse_args()
    block = (HERE / 'gas/ApprovedPackageCacheClient.html').read_text(encoding='utf-8')
    html = '<!doctype html><html><head>' + STUB.replace('PORT', str(a.port)) + '</head><body>' + ADAPTER + block + '</body></html>'
    srv = subprocess.Popen(['node', str(HERE / 'qa_mock_gas_server.mjs'), a.catalog_dir, str(a.port), a.packages], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    assert srv.stdout.readline().startswith('READY')
    gh = {'requests': 0}
    name = next(x['name'] for x in backend(a.port, '/rpc', {'fn': 'hojaListPublicCartridges', 'args': []})['v'] if x['cartridgeId'] == a.unit)
    rounds = {}
    try:
        async with async_playwright() as pw:
            b = await pw.chromium.launch(headless=True)
            async def route(r):
                u = r.request.url
                if u == f'http://127.0.0.1:{a.port}/h.html': return await r.fulfill(body=html, content_type='text/html; charset=utf-8')
                m = RAW_RE.match(u)
                if m:
                    gh['requests'] += 1
                    if a.mode == 'relay': return await r.abort('internetdisconnected')
                    await asyncio.sleep(a.github_latency_ms / 1000)
                    return await r.fulfill(status=200, body=(Path(a.packages) / m.group(1)).read_bytes(), headers={'access-control-allow-origin': '*', 'cache-control': 'no-store'})
                if u.startswith(f'http://127.0.0.1:{a.port}'): return await r.continue_()
                await r.abort()
            ctxs = []
            for _ in range(a.students):
                c = await b.new_context(); await c.route('**/*', route); p = await c.new_page(); ctxs.append((c, p))
            for rnd in ('cold_first_entry', 'warm_reentry_after_reload'):
                for c, p in ctxs:
                    await p.goto(f'http://127.0.0.1:{a.port}/h.html'); await p.wait_for_function('!!window.HOJA_APPROVED_PACKAGE_CACHE')
                    await p.evaluate("window.HOJA_B_LIVE.rpc('LIST')")
                st0 = backend(a.port); gh0 = gh['requests']
                async def one(p):
                    return await p.evaluate("""async(n)=>{const t=performance.now();const r=await window.HOJA_B_LIVE.rpc('GET',[n]);
                      const d=await window.HOJA_APPROVED_PACKAGE_CACHE.diagnose();
                      return {ms:Math.round(performance.now()-t),q:r[0].data.questions.length,hits:d.stats.hits,downloads:d.stats.downloads,relayed:d.stats.relayed,stored:d.units.length}}""", name)
                t = time.time(); out = await asyncio.gather(*[one(p) for _, p in ctxs]); wall = round((time.time() - t) * 1000)
                st1 = backend(a.port); ms = [o['ms'] for o in out]
                rounds[rnd] = {'students': a.students, 'allLoaded': all(o['q'] > 0 for o in out), 'githubRequests': gh['requests'] - gh0,
                               'gasGetCalls': st1['calls'][len(st0['calls']):].count('hojaGetPublicQuestions'), 'gasRelayFetches': len(st1['fetched']) - len(st0['fetched']),
                               'studentsServedFromCache': sum(1 for o in out if o['hits'] > 0), 'loadMs': {'p50': pct(ms, 50), 'p95': pct(ms, 95), 'max': max(ms)}, 'wallMs': wall}
                print(rnd, json.dumps(rounds[rnd]), flush=True)
            await b.close()
    finally:
        srv.terminate(); srv.wait()
    ok = rounds['cold_first_entry']['allLoaded'] and rounds['warm_reentry_after_reload']['allLoaded'] and \
         rounds['warm_reentry_after_reload']['githubRequests'] == 0 and rounds['warm_reentry_after_reload']['gasGetCalls'] == 0 and \
         rounds['warm_reentry_after_reload']['studentsServedFromCache'] == a.students
    if a.mode == 'direct': ok = ok and rounds['cold_first_entry']['gasGetCalls'] == 0 and rounds['cold_first_entry']['githubRequests'] == a.students
    else: ok = ok and rounds['cold_first_entry']['gasGetCalls'] == a.students
    Path(a.json).write_text(json.dumps({'mode': a.mode, 'unit': a.unit, 'githubLatencyMs': a.github_latency_ms, 'rounds': rounds}, indent=1))
    print('F4_CACHE_LOAD_' + a.mode.upper() + ('_PASS' if ok else '_FAIL')); sys.exit(0 if ok else 1)

asyncio.run(main())
