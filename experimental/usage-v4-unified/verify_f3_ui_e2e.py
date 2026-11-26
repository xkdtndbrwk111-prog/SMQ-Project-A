#!/usr/bin/env python3
"""F3-2 UI E2E (offline Chromium): the exact trial 7MB game + composed renderer, every RPC served by
the REAL single-GAS sources in the mock engine (qa_mock_gas_server.mjs over a QA bundle). Phaser 4.2.1
is served from a local npm-packed file in place of the CDN (as the repo's Phaser CI does).

Flow per selected unit, driven ONLY by visible UI clicks/keys:
  intro frame clicks -> [공개 카트리지] -> LIST -> grade / subject / (publisher) / unit cards -> GET ->
  SOLO : [혼자 놀기] -> [문제 풀이 모드] -> balloon -> approved iframe question -> answer -> verdict
  TEAM : [함께 놀기] -> [2] -> balloon -> approved iframe question shown
and the backend must show: usage rows A1 with the approved id, watermark == last row.
Every check is an assert; any failure exits nonzero.
Usage: verify_f3_ui_e2e.py --html <trial.html> --phaser <phaser.min.js> --port 8765 --units id1,id2,..."""
import argparse, asyncio, json, re, sys, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright

STUB = """<script>window.google={script:{run:(function(){function r(ok,fail){return new Proxy({},{get(_,n){
 if(n==='withSuccessHandler')return f=>r(f,fail);if(n==='withFailureHandler')return f=>r(ok,f);
 return (...args)=>{fetch('http://127.0.0.1:PORT/rpc',{method:'POST',body:JSON.stringify({fn:n,args})}).then(x=>x.json())
  .then(d=>d.ok?ok&&ok(d.v):fail&&fail(new Error(d.e))).catch(e=>fail&&fail(e));};}})}
 return r(null,null)})()}};</script>"""

def backend(port, path='/state', body=None):
    req = urllib.request.Request(f'http://127.0.0.1:{port}{path}', data=json.dumps(body).encode() if body else None, method='POST' if body else 'GET')
    return json.loads(urllib.request.urlopen(req, timeout=60).read())

def parse_name(name):
    m = re.match(r'^([1-6])-(?:([12])학기-)?([^-]+)-(.+)$', name)
    grade, sem, subject, tail = m.groups()
    if subject == '영어':
        pub, label = tail.split('-', 1)
        return grade, subject, pub, label
    return grade, subject, None, tail

STEP = {'page': None, 'last': ''}
async def click_card(page, text):
    STEP['last'] = 'card:' + text
    btn = page.locator('#hojaCatalog button.hcPak', has_text=text).first
    await btn.wait_for(state='visible', timeout=20000)
    await btn.click()

async def to_catalog(page):
    # HOJA 1.5: the intro goes straight to the built-in catalog (no public/private choice); older builds still show it.
    for _ in range(6):
        if await page.evaluate("!document.getElementById('hojaRepoChoice').hidden||!document.getElementById('hojaCatalog').hidden"): break
        await page.locator('#frame').click(position={'x': 200, 'y': 200}); await page.wait_for_timeout(700)
    if await page.evaluate("!document.getElementById('hojaCatalog').hidden"): return
    assert await page.evaluate("!document.getElementById('hojaRepoChoice').hidden"), 'REPOSITORY_SCREEN_NOT_REACHED'
    await page.locator('#hrPublic').click()
    await page.wait_for_function("!document.getElementById('hojaCatalog').hidden", timeout=30000)

async def pick_unit(page, name):
    grade, subject, pub, label = parse_name(name)
    await click_card(page, grade + '학년'); await click_card(page, subject)
    if pub: await click_card(page, pub)
    # exact full approved label (several titles share long prefixes)
    STEP['last'] = 'unit:' + label
    idx = await page.evaluate("""async(label)=>{const rows=await window.HOJA_B_LIVE.rpc('LIST');const row=rows.find(r=>r.name.endsWith('-'+label));const dynamic=row?.display;return [...document.querySelectorAll('#hojaCatalog button.hcPak')]
      .findIndex(b=>{const want=[label];if(dynamic)want.push(dynamic.number+'. '+dynamic.title);
        // HOJA 1.5 display-only layer renames approved cards to '<number>. <short title>' (identity unchanged)
        const d=document.getElementById('hoja15-approved-cartridge-display-v1')?.textContent||'';
        for(const m of d.matchAll(/"sourceTitle":\s*"([^"]+)",\s*"number":\s*"([^"]+)",\s*"title":\s*"([^"]+)"/g))if(m[1]===label)want.push(m[2]+'. '+m[3]);
        return [b.querySelector('.hcUnitName')?.dataset.fullLabel,b.title].some(t=>want.includes((t||'').trim()))})}""", label)
    assert idx >= 0, ('UNIT_CARD_NOT_FOUND', label)
    await page.locator('#hojaCatalog button.hcPak').nth(idx).click()
    await page.wait_for_function("!document.getElementById('hojaNextMode').hidden", timeout=60000)
    sel = await page.locator('#hcNextSelected').inner_text()
    assert sel.strip(), ('SELECTED_LABEL', sel)

async def mode(page, *labels):
    for t in labels:
        b = page.locator('#hmSelections button.hmPick', has_text=t).first
        await b.wait_for(state='visible', timeout=20000); await b.click(); await page.wait_for_timeout(1200)

async def approved_iframe(page, want_min=2):
    await page.wait_for_function("""(n)=>{const f=document.querySelector('iframe[id^="hojaTeamApproved"]');
      return f?.contentDocument?.querySelectorAll('#hqChoices button.hqChoice').length>=n}""", arg=want_min, timeout=30000)
    return await page.evaluate("""()=>{const d=document.querySelector('iframe[id^="hojaTeamApproved"]').contentDocument;
      return {q:(d.getElementById('hqQuestion')?.innerText||'').trim(),n:d.querySelectorAll('#hqChoices button.hqChoice').length,
       imgs:[...d.querySelectorAll('#hqMedia img, #hqChoices img')].filter(i=>i.complete&&i.naturalWidth>0).length,
       choiceText:[...d.querySelectorAll('#hqChoices .hqChoiceLabel')].map(x=>x.innerText.trim())}}""")

GH_HITS = []
async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--html', required=True); ap.add_argument('--phaser', required=True)
    ap.add_argument('--github-packages', help='F4: answer pinned raw.githubusercontent.com package URLs from this local dir (packages not yet published)'); ap.add_argument('--port', type=int, default=8765); ap.add_argument('--units', required=True); ap.add_argument('--fail-shot')
    a = ap.parse_args()
    html = Path(a.html).read_text(encoding='utf-8').replace('<head>', '<head>' + STUB.replace('PORT', str(a.port)), 1)
    phaser = Path(a.phaser).read_bytes()
    names = {x['cartridgeId']: x['name'] for x in backend(a.port, '/rpc', {'fn': 'hojaListPublicCartridges', 'args': []})['v']}
    results = []
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        for uid in a.units.split(','):
            for flow in ('SOLO', 'TEAM'):
                before = backend(a.port)
                ctx = await b.new_context(viewport={'width': 1280, 'height': 800}); page = await ctx.new_page(); errs = []
                page.on('pageerror', lambda e: errs.append(str(e)[:140])); page.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
                async def route(r):
                    u = r.request.url
                    if u == f'http://127.0.0.1:{a.port}/game.html': await r.fulfill(body=html, content_type='text/html; charset=utf-8')
                    elif u.endswith('phaser.min.js'): await r.fulfill(body=phaser, content_type='application/javascript')
                    elif a.github_packages and u.startswith('https://raw.githubusercontent.com/xkdtndbrwk111-prog/HOJA-QUESTION-BANK/'):
                        rel = u.split('/', 6)[-1]; f = Path(a.github_packages) / rel  # .../<owner>/<repo>/<commit>/<path>
                        GH_HITS.append(rel.rsplit('/', 1)[-1] + ('' if f.is_file() else ':404'))
                        await r.fulfill(status=200 if f.is_file() else 404, body=f.read_bytes() if f.is_file() else b'', headers={'access-control-allow-origin': '*'})
                    elif u.startswith(('data:', f'http://127.0.0.1:{a.port}')): await r.continue_()
                    else: await r.abort()
                await page.route('**/*', route)
                STEP['page'] = page
                # served from http://127.0.0.1 (a secure context, like the real https Apps Script page:
                # crypto.randomUUID exists); the body is the exact bundle Game.html
                await page.goto(f'http://127.0.0.1:{a.port}/game.html', wait_until='domcontentloaded', timeout=180000)
                assert await page.evaluate('window.isSecureContext && typeof crypto.randomUUID === "function"')
                await page.wait_for_timeout(5000)
                await to_catalog(page)
                await pick_unit(page, names[uid])
                if flow == 'SOLO':
                    await mode(page, '혼자 놀기', '문제 풀이 모드')
                    direct=page.locator('#hoja15JoinLayer.open .h15Big',has_text='바로 시작하기')
                    if await direct.count(): await direct.click()
                    await page.wait_for_function("window.HOJA_GAMEPLAY?.state?.answered===0", timeout=30000)
                    await page.locator('#hqBalloon').click(force=True, timeout=20000)  # the balloon floats (never 'stable'); a player clicks it in motion
                    shown = await approved_iframe(page)
                    kinds = await page.evaluate("""()=>[...document.querySelector('iframe[id^="hojaTeamApproved"]').contentDocument
                      .querySelectorAll('#hqChoices button.hqChoice')].map(b=>b.dataset.choice)""")
                    key = 'O' if kinds == ['true', 'false'] else '1'
                    STEP['last'] = 'solo-answer key=' + key + ' choices=' + ','.join(kinds)
                    # real player input: click the first shown choice button inside the approved renderer
                    await page.frame_locator('iframe[id^="hojaTeamApproved"]').locator('button.hqChoice').first.click(timeout=15000)
                    try:
                        await page.wait_for_function("window.HOJA_GAMEPLAY.state.answered===1", timeout=15000)
                    except Exception:
                        st = await page.evaluate("JSON.stringify(window.HOJA_GAMEPLAY.state)")
                        STEP['last'] += ' state=' + st[:200]
                        raise
                    verdict = await page.locator('#hojaSoloJudgment').inner_text()
                    assert ('정답' in verdict) or ('오답' in verdict), ('VERDICT', verdict)
                else:
                    await mode(page, '함께 놀기', '2')
                    await page.wait_for_timeout(2800)
                    STEP['last'] = 'team-balloon'
                    await page.locator('#htTeamBoard button.htBalloon').first.click(timeout=20000)
                    shown = await approved_iframe(page, 1)  # SHORT shows the teacher reveal control only
                    assert await page.evaluate("document.querySelector('#hojaGamePlay')?.dataset.mode==='team'")
                    verdict = 'team question shown'
                await page.wait_for_timeout(1500)
                after = backend(a.port)
                new_rows = after['usageRows'][len(before['usageRows']):]
                STEP['last'] = 'usage client=' + str(await page.evaluate("JSON.stringify(window.HOJA_USAGE?.status?.()||null)")) + \
                  ' sources=' + str(await page.evaluate("JSON.stringify((window.HOJA_B_LIVE?.sources||[]).map(x=>x?.data?.cartridgeId))"))
                assert len(new_rows) == 1, ('USAGE_ROWS', new_rows)
                assert new_rows[0]['schema'] == 'A1' and new_rows[0]['ids'] == uid and new_rows[0]['ns'] == 'APPROVED', new_rows
                assert new_rows[0]['mode'] == ('SOLO' if flow == 'SOLO' else 'TEAM'), new_rows
                assert after['watermarkMinusLastRow'] == 0
                assert shown['q'] and shown['n'] >= 1, shown
                hint_leak = any(t and t in shown['q'] for t in [])
                bad = [e for e in errs if 'ResizeObserver' not in e]
                assert not bad, ('JS_ERRORS', bad)
                r = {'unit': uid, 'flow': flow, 'choicesShown': shown['n'], 'imagesShown': shown['imgs'], 'verdict': verdict[:30],
                     'usageRow': new_rows[0]['schema'] + ':' + new_rows[0]['mode'], 'telemetryRpcOk': True}
                results.append(r); print(json.dumps(r, ensure_ascii=False), flush=True)
                await ctx.close()
        await b.close()
    print('F3_UI_E2E_PASS ' + json.dumps({'cases': len(results)}))
    if a.github_packages: print('GITHUB_STANDIN_REQUESTS', len(GH_HITS), 'distinct', len(set(GH_HITS)), 'notFound', sum(h.endswith(':404') for h in GH_HITS))

async def run():
    try:
        await main()
    except Exception as e:
        shot = None
        if STEP['page'] is not None and len(sys.argv) and '--fail-shot' in sys.argv:
            shot = sys.argv[sys.argv.index('--fail-shot') + 1]
            try: await STEP['page'].screenshot(path=shot)
            except Exception: pass
        print('F3_UI_E2E_FAIL at ' + STEP['last'] + ' ' + repr(e)[:300]); sys.exit(1)
if __name__ == '__main__':
    asyncio.run(run())
