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
import argparse, asyncio, json, re, subprocess, sys, urllib.request
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
    print('UI_STEP',STEP['last'],flush=True)
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
    print('UI_STEP',STEP['last'],flush=True)
    idx = await asyncio.wait_for(page.evaluate("""async(label)=>{const rows=await window.HOJA_B_LIVE.rpc('LIST');const row=rows.find(r=>r.name.endsWith('-'+label));const dynamic=row?.display;return [...document.querySelectorAll('#hojaCatalog button.hcPak')]
      .findIndex(b=>{const want=[label];if(dynamic)want.push(dynamic.number+'. '+dynamic.title);
        // HOJA 1.5 display-only layer renames approved cards to '<number>. <short title>' (identity unchanged)
        const d=document.getElementById('hoja15-approved-cartridge-display-v1')?.textContent||'';
        for(const m of d.matchAll(/"sourceTitle":\s*"([^"]+)",\s*"number":\s*"([^"]+)",\s*"title":\s*"([^"]+)"/g))if(m[1]===label)want.push(m[2]+'. '+m[3]);
        return [b.querySelector('.hcUnitName')?.dataset.fullLabel,b.title].some(t=>want.includes((t||'').trim()))})}""", label),timeout=30)
    assert idx >= 0, ('UNIT_CARD_NOT_FOUND', label)
    await page.locator('#hojaCatalog button.hcPak').nth(idx).click()
    await page.wait_for_function("!document.getElementById('hojaNextMode').hidden", timeout=60000)
    sel = await page.locator('#hcNextSelected').inner_text()
    assert sel.strip(), ('SELECTED_LABEL', sel)

async def mode(page, *labels):
    for t in labels:
        STEP['last']='mode:'+t; print('UI_STEP',STEP['last'],flush=True)
        b = page.locator('#hmSelections button.hmPick', has_text=t).first
        await b.wait_for(state='visible', timeout=20000); await b.click(); await page.wait_for_timeout(1200)

async def approved_iframe(page, want_min=2):
    await page.wait_for_function("""(n)=>{const f=document.querySelector('iframe[id^="hojaTeamApproved"]'),d=f?.contentDocument;
      return !!f&&!!d&&!document.getElementById('hqOverlay').hidden&&f.getBoundingClientRect().width>0&&
        getComputedStyle(f).visibility==='visible'&&!d.body.classList.contains('hojaAwaitShow')&&
        d.querySelectorAll('#hqChoices button.hqChoice').length>=n}""", arg=want_min, timeout=30000)
    return await page.evaluate("""()=>{const d=document.querySelector('iframe[id^="hojaTeamApproved"]').contentDocument;
      return {q:(d.getElementById('hqQuestion')?.innerText||'').trim(),n:d.querySelectorAll('#hqChoices button.hqChoice').length,
       imgs:[...d.querySelectorAll('#hqMedia img, #hqChoices img')].filter(i=>i.complete&&i.naturalWidth>0).length,
       choiceText:[...d.querySelectorAll('#hqChoices .hqChoiceLabel')].map(x=>x.innerText.trim())}}""")

GH_HITS = []
async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--html', required=True); ap.add_argument('--phaser', required=True)
    ap.add_argument('--github-packages', help='F4: answer pinned raw.githubusercontent.com package URLs from this local dir (packages not yet published)'); ap.add_argument('--port', type=int, default=8765); ap.add_argument('--units', required=True); ap.add_argument('--fail-shot')
    ap.add_argument('--flow',choices=['SOLO','TEAM','BOTH'],default='BOTH')
    a = ap.parse_args()
    html = Path(a.html).read_text(encoding='utf-8').replace('<head>', '<head>' + STUB.replace('PORT', str(a.port)), 1)
    if a.flow in ('SOLO','BOTH') and 'const jumpHeight=t=>4*amplitude*t*(1-t)' in html:
        subprocess.run(['node', str(Path(__file__).with_name('verify_solo_jump.mjs')), a.html], check=True, timeout=15)
    phaser = Path(a.phaser).read_bytes()
    print('UI_BACKEND_LIST_START',flush=True)
    names = {x['cartridgeId']: x['name'] for x in backend(a.port, '/rpc', {'fn': 'hojaListPublicCartridges', 'args': []})['v']}
    results = []
    print('UI_CHROMIUM_START',flush=True)
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True,timeout=30000,args=['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
        for uid in a.units.split(','):
            for flow in (('SOLO','TEAM') if a.flow=='BOTH' else (a.flow,)):
                STEP['last']='start:'+uid+':'+flow; print('UI_STEP',STEP['last'],flush=True)
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
                STEP['last']='page-goto'; print('UI_STEP',STEP['last'],flush=True)
                await page.goto(f'http://127.0.0.1:{a.port}/game.html', wait_until='domcontentloaded', timeout=60000)
                assert await page.evaluate('window.isSecureContext && typeof crypto.randomUUID === "function"')
                await page.wait_for_timeout(5000)
                STEP['last']='catalog-open'; print('UI_STEP',STEP['last'],flush=True)
                await asyncio.wait_for(to_catalog(page),timeout=45)
                await asyncio.wait_for(pick_unit(page, names[uid]),timeout=90)
                # Selected via actual catalog UI.
                if flow == 'SOLO':
                    await mode(page, '혼자 놀기', '문제 풀이 모드')
                    direct=page.locator('#hoja15JoinLayer.open .h15Big',has_text='바로 시작하기')
                    await direct.wait_for(state='visible',timeout=15000)
                    STEP['last']='solo-direct'; print('UI_STEP',STEP['last'],flush=True)
                    await direct.click(timeout=15000)
                    await page.wait_for_function("window.HOJA_GAMEPLAY?.state?.page==='quiz'&&!document.getElementById('hojaGamePlay').hidden&&window.HOJA_GAMEPLAY.state.answered===0", timeout=30000)
                    STEP['last']='solo-jump-key'; print('UI_STEP',STEP['last'],flush=True)
                    # A supported player input: Space triggers a real jump. Do not mistake the
                    # preloaded, hidden renderer's first question for the opened question.
                    # Record real key delivery and frame timing, without changing game state.
                    await page.evaluate("""()=>{window.__jumpTrace=[];const t0=performance.now(),push=(kind,e)=>{const p=document.getElementById('hqCharacter'),b=document.getElementById('hqBalloon'),pr=p?.getBoundingClientRect(),br=b?.getBoundingClientRect();window.__jumpTrace.push({kind,t:Math.round(performance.now()-t0),key:e?.code,defaultPrevented:e?.defaultPrevented,state:window.HOJA_GAMEPLAY.state,player:pr?[pr.x,pr.y,pr.width,pr.height]:null,balloon:br?[br.x,br.y,br.width,br.height]:null,transform:p?.style.transform})};window.addEventListener('keydown',e=>push('key',e),true);let n=0;const tick=()=>{push('raf');if(++n<180&&performance.now()-t0<6000)requestAnimationFrame(tick)};requestAnimationFrame(tick)}""")
                    await page.keyboard.press('Space')
                    try:
                        await page.wait_for_function("window.HOJA_GAMEPLAY.state.activeQuiz&&!document.getElementById('hqOverlay').hidden",timeout=15000)
                    except Exception:
                        diag=await page.evaluate("""()=>{const r=id=>{const e=document.getElementById(id),b=e?.getBoundingClientRect();return b?{x:b.x,y:b.y,w:b.width,h:b.height,hidden:e.hidden}:null};return {state:window.HOJA_GAMEPLAY.state,balloon:r('hqBalloon'),player:r('hqCharacter'),stage:r('hqStage'),active:document.activeElement?.id,trace:(window.__jumpTrace||[]).filter((x,i,a)=>x.kind==='key'||x.state.jumping||i<8||i===a.length-1).slice(0,60)}}""")
                        print('SOLO_JUMP_DIAG',json.dumps(diag,ensure_ascii=False),flush=True)
                        raise
                    shown = await approved_iframe(page)
                    kinds = await page.evaluate("""()=>[...document.querySelector('iframe[id^="hojaTeamApproved"]').contentDocument
                      .querySelectorAll('#hqChoices button.hqChoice')].map(b=>b.dataset.choice)""")
                    key = 'O' if kinds == ['true', 'false'] else '1'
                    STEP['last'] = 'solo-answer key=' + key + ' choices=' + ','.join(kinds)
                    # real player input: click the first shown choice button inside the approved renderer
                    # Preserve real pointer input; do not force or synthesize an answer.
                    try:
                        await page.frame_locator('iframe[id^="hojaTeamApproved"]').locator('button.hqChoice').first.click(timeout=15000)
                    except Exception:
                        try:
                            diag = await asyncio.wait_for(page.evaluate("""()=>{const f=document.querySelector('iframe[id^="hojaTeamApproved"]'),d=f?.contentDocument,b=d?.querySelector('button.hqChoice');
                              const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
                              const st=e=>e?{display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility,pointer:getComputedStyle(e).pointerEvents}:null;
                              const fr=rect(f),br=rect(b),el=fr&&br?document.elementFromPoint(fr.x+br.x+br.w/2,fr.y+br.y+br.h/2):null;
                              const inner=br?d.elementFromPoint(br.x+br.w/2,br.y+br.h/2):null;
                              return {frame:fr,frameStyle:st(f),button:br,buttonStyle:b?{display:d.defaultView.getComputedStyle(b).display,visibility:d.defaultView.getComputedStyle(b).visibility,pointer:d.defaultView.getComputedStyle(b).pointerEvents,disabled:b.disabled}:null,
                                parentHit:el?.id||el?.className,innerHit:inner?.id||inner?.className,awaitingShow:f?.contentWindow?.HOJA_RENDERER_INPUT_GUARD?.awaitingShow,
                                qid:b?.dataset.hojaQid,current:f?.contentWindow?.current?.()?.id,body:d?.body?.className,overlayHidden:document.getElementById('hqOverlay')?.hidden,joinView:window.HOJA15_JOIN?.view};}"""),timeout=5)
                            print('SOLO_CLICK_DIAG',json.dumps(diag,ensure_ascii=False),flush=True)
                        except Exception as de:
                            print('SOLO_CLICK_DIAG_FAILED',repr(de),flush=True)
                        raise
                    try:
                        await page.wait_for_function("window.HOJA_GAMEPLAY.state.answered===1", timeout=15000)
                    except Exception:
                        st = await page.evaluate("JSON.stringify(window.HOJA_GAMEPLAY.state)")
                        STEP['last'] += ' state=' + st[:200]
                        raise
                    verdict = await page.locator('#hojaSoloJudgment').inner_text(timeout=2000)
                    assert ('정답' in verdict) or ('오답' in verdict), ('VERDICT', verdict)
                    # A second question must open by an actual pointer click on the balloon.
                    # Hit-test first, then use the real mouse instead of force-clicking a moving node.
                    await page.wait_for_function("!window.HOJA_GAMEPLAY.state.activeQuiz&&!document.getElementById('hqBalloon').hidden",timeout=5000)
                    STEP['last']='solo-balloon-pointer'; print('UI_STEP',STEP['last'],flush=True)
                    for attempt in range(5):
                        point=await page.evaluate("""()=>{const e=document.getElementById('hqBalloon'),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:document.elementFromPoint(x,y)===e}}""")
                        print('SOLO_BALLOON_HIT',json.dumps(point),flush=True)
                        if point['hit']: await page.mouse.click(point['x'],point['y'])
                        try:
                            await page.wait_for_function("window.HOJA_GAMEPLAY.state.activeQuiz&&!document.getElementById('hqOverlay').hidden",timeout=1500)
                            break
                        except Exception:
                            if attempt==4: raise
                    await approved_iframe(page)
                    choices=page.frame_locator('iframe[id^="hojaTeamApproved"]').locator('button.hqChoice')
                    first=await choices.first.get_attribute('data-choice')
                    await page.keyboard.press('O' if first=='true' else '1')
                    await page.wait_for_function("window.HOJA_GAMEPLAY.state.answered===2",timeout=10000)
                    await page.locator('#hojaSoloJudgment').wait_for(state='visible',timeout=2000)
                    print('SOLO_POINTER_AND_KEYBOARD_PASS',flush=True)
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
        print('F3_UI_E2E_FAIL at ' + STEP['last'] + ' ' + repr(e)[:6000]); sys.exit(1)
if __name__ == '__main__':
    asyncio.run(run())
