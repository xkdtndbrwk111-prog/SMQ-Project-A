#!/usr/bin/env python3
"""40-6CF: HOJA 1.5 single-mode join code / QR — offline two-device E2E (no Google access).
The exact bundle Game.html runs in Chromium; google.script.run is answered by the REAL gas/*.gs (incl. Hoja15Join.gs)
in the mock engine (qa_mock_gas_server.mjs, started with HOJA_JOIN_TEST_URL=<fake /exec>), approved packages come from a
local QBank checkout through the browser's own F4 cache path. Separate browser contexts = separate devices.
  TEACHER  catalog -> unit -> 혼자 놀기 -> 아케이드 모드: two-option menu; 학생 참여 코드: big 6-digit code + QR that DECODES
           (jsQR, test-only) to <exec>?join=<code>; 재발급 gives a new code and the old one stops working; 바로 시작하기 (quiz)
           starts the normal quiz; practice/team menus unchanged.
  STUDENT1 opens <page>?join=<arcade code> -> arcade starts by itself (tutorial already done) with the teacher's units.
  STUDENT2 manual entry: typo -> clear error; right quiz code -> quiz with the same units; reload + same code -> package
           served from the browser cache (0 new GitHub package fetches).
Usage: verify_hoja15_join_e2e.py --html <bundle Game.html> --phaser <phaser.min.js> --packages <qbank checkout>
       --jsqr <jsQR.js> --port <mock port> --unit <cartridgeId> [--screens <dir>]"""
import argparse, asyncio, json, re, sys
from pathlib import Path
from playwright.async_api import async_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from verify_f3_ui_e2e import STUB, backend, to_catalog, pick_unit, mode

URL_STUB = "<script>window.google.script.url={getLocation(cb){setTimeout(()=>cb({hash:'',parameter:Object.fromEntries(new URLSearchParams(location.search)),parameters:{}}),0)}};</script>"

async def main():
    ap = argparse.ArgumentParser()
    for k in ('--html', '--phaser', '--packages', '--jsqr'): ap.add_argument(k, required=True)
    ap.add_argument('--port', type=int, required=True); ap.add_argument('--unit', required=True); ap.add_argument('--unit2', default='')
    ap.add_argument('--screens')
    a = ap.parse_args()
    html = Path(a.html).read_text(encoding='utf-8').replace('<head>', '<head>' + STUB.replace('PORT', str(a.port)) + URL_STUB, 1)
    phaser = Path(a.phaser).read_bytes(); jsqr = Path(a.jsqr).read_text()
    rows = backend(a.port, '/rpc', {'fn': 'hojaListPublicCartridges', 'args': []})['v']
    names = {x['cartridgeId']: x['name'] for x in rows}
    units = [names[a.unit]] + ([names[a.unit2]] if a.unit2 else [])
    shots = Path(a.screens) if a.screens else None
    if shots: shots.mkdir(parents=True, exist_ok=True)
    out = {}; fails = []; gh = []
    def ok(c, m): (None if c else fails.append(m))
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True, args=['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
        async def device(w=1280, h=800, tutorial_done=False):
            ctx = await b.new_context(viewport={'width': w, 'height': h}); page = await ctx.new_page(); errs = []
            page.on('pageerror', lambda e: errs.append(str(e)[:160])); page.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
            async def route(r):
                u = r.request.url
                if u.split('?')[0] == f'http://127.0.0.1:{a.port}/game.html': await r.fulfill(body=html, content_type='text/html; charset=utf-8')
                elif u.endswith('phaser.min.js'): await r.fulfill(body=phaser, content_type='application/javascript')
                elif u.startswith('https://raw.githubusercontent.com/xkdtndbrwk111-prog/HOJA-QUESTION-BANK/'):
                    rel = u.split('/', 6)[-1]; f = Path(a.packages) / rel; gh.append(rel.rsplit('/', 1)[-1])
                    await r.fulfill(status=200 if f.is_file() else 404, body=f.read_bytes() if f.is_file() else b'', headers={'access-control-allow-origin': '*'})
                elif u.startswith(('data:', f'http://127.0.0.1:{a.port}')): await r.continue_()
                else: await r.abort()
            await page.route('**/*', route)
            if tutorial_done:
                await ctx.add_init_script("try{for(const k of Object.keys(localStorage));}catch(e){}")
            return ctx, page, errs
        async def shot(page, name):
            if shots: await page.screenshot(path=str(shots / name))
        async def wait_game(page, which, timeout=90000):
            await page.wait_for_function("(w)=>window.HOJA_GAMEPLAY?.state?.page===w&&!document.getElementById('hojaGamePlay').hidden", arg=which, timeout=timeout)
            return await page.evaluate("(window.HOJA_B_LIVE.sources||[]).map(s=>s.sheetName)")
        base = f'http://127.0.0.1:{a.port}/game.html'
        # ---------------- TEACHER
        tctx, t, terr = await device(1920, 1080)
        await t.goto(base, wait_until='domcontentloaded', timeout=180000); await t.wait_for_timeout(5000)
        await to_catalog(t)
        for n in units: await pick_unit(t, n) if n == units[0] else None
        await mode(t, '혼자 놀기')
        solo_cards = await t.evaluate("[...document.querySelectorAll('#hmSelections button.hmPick strong')].map(s=>s.textContent)")
        ok(solo_cards == ['아케이드 모드', '문제 풀이 모드', '연습모드'], 'SOLO_MENU_CHANGED ' + json.dumps(solo_cards, ensure_ascii=False))
        await mode(t, '아케이드 모드')
        await t.wait_for_selector('#hoja15JoinLayer.open #hoja15JoinIssue', timeout=15000)
        menu = await t.evaluate("[...document.querySelectorAll('#hoja15JoinLayer .h15Big')].map(b=>b.firstChild.textContent)")
        ok(menu == ['학생 참여 코드', '바로 시작하기'], 'MENU ' + json.dumps(menu, ensure_ascii=False))
        ok(await t.evaluate("document.getElementById('hojaGamePlay').hidden"), 'GAME_STARTED_BEFORE_CHOICE')
        await shot(t, 'join_menu_arcade_1920.png')
        await t.click('#hoja15JoinIssue')
        await t.wait_for_selector('#hoja15JoinDigits', timeout=30000)
        code1 = re.sub(r'\D', '', await t.inner_text('#hoja15JoinDigits'))
        info = await t.evaluate("""(lib)=>{eval(lib);const c=document.querySelector('#hoja15JoinLayer .h15Qr canvas');
          const x=c.getContext('2d').getImageData(0,0,c.width,c.height);const r=jsQR(x.data,c.width,c.height);
          const d=document.getElementById('hoja15JoinDigits').getBoundingClientRect(),q=c.getBoundingClientRect();
          return {decoded:r&&r.data,link:c.dataset.text||'',textUnder:[...document.querySelectorAll('#hoja15JoinLayer .h15Info > div')].map(e=>e.className),digitsPx:parseFloat(getComputedStyle(document.getElementById('hoja15JoinDigits')).fontSize),
            qrPx:Math.round(q.width),fits:q.right<=innerWidth&&q.bottom<=innerHeight&&d.right<=innerWidth&&d.bottom<=innerHeight}}""", jsqr)
        out['teacherCode'] = {'digits': len(code1), **{k: v for k, v in info.items() if k not in ('decoded', 'link')},
                              'qrDecodesToLink': info['decoded'] == info['link'], 'linkEndsWithJoin': info['link'].endswith('?join=' + code1)}
        ok(len(code1) == 6 and info['decoded'] == info['link'] and info['link'].endswith('/exec?join=' + code1), 'QR_OR_CODE')
        ok(info['digitsPx'] >= 120 and info['qrPx'] >= 600 and info['fits'], 'BOARD_SIZE ' + json.dumps(info))
        ok(info['textUnder'] == ['h15Label', 'h15Digits', 'h15Actions'], 'ONLY_LABEL_AND_NUMBER ' + json.dumps(info['textUnder']))   # 40-6CH
        await shot(t, 'join_code_1920.png')
        for vw, vh, nm in ((1280, 720, '1280'), (390, 844, '390')):
            await t.set_viewport_size({'width': vw, 'height': vh}); await t.wait_for_timeout(300)
            fit = await t.evaluate("(()=>{const r=[...document.querySelectorAll('#hoja15JoinDigits,#hoja15JoinLayer .h15Qr canvas')].map(e=>e.getBoundingClientRect());return r.every(b=>b.left>=0&&b.right<=innerWidth+1)})()")
            ok(fit, 'RESPONSIVE_' + nm); await shot(t, f'join_code_{nm}.png')
        await t.set_viewport_size({'width': 1920, 'height': 1080})
        # reissue: new code, old code revoked
        await t.click('#hoja15JoinReissue'); await t.wait_for_function("(c)=>{const e=document.getElementById('hoja15JoinDigits');return e&&e.textContent.replace(/\\D/g,'')!==c}", arg=code1, timeout=30000)
        code2 = re.sub(r'\D', '', await t.inner_text('#hoja15JoinDigits'))
        old = backend(a.port, '/rpc', {'fn': 'hojaJoinResolve', 'args': [code1]})
        ok(code2 != code1 and not old['ok'] and 'NOT_FOUND' in old['e'], 'REISSUE')
        out['reissue'] = {'newCodeDiffers': code2 != code1, 'oldCode': old.get('e', 'STILL_VALID').split(':')[-1].strip()}
        # back -> menu -> back closes; quiz: menu -> 바로 시작하기 starts the normal quiz
        await t.click('#hoja15JoinCodeBack'); await t.wait_for_selector('#hoja15JoinBack'); await t.click('#hoja15JoinBack')
        ok(await t.evaluate("!document.getElementById('hoja15JoinLayer').classList.contains('open')&&!document.getElementById('hojaNextMode').hidden"), 'BACK_TO_SOLO_MENU')
        await mode(t, '문제 풀이 모드'); await t.wait_for_selector('#hoja15JoinLayer.open #hoja15JoinIssue', timeout=15000)
        await t.click('#hoja15JoinIssue'); await t.wait_for_selector('#hoja15JoinDigits', timeout=30000)
        quiz_code = re.sub(r'\D', '', await t.inner_text('#hoja15JoinDigits'))
        await t.click('#hoja15JoinTeacherStart')
        tsrc = await wait_game(t, 'quiz'); ok(tsrc == units, 'TEACHER_DIRECT_QUIZ_UNITS')
        out['teacherDirectQuiz'] = {'started': True, 'units': len(tsrc)}
        # ---------------- STUDENT 1: QR link (arcade), tutorial already completed on this device
        s1ctx, s1, s1err = await device(1180, 820)
        await s1ctx.add_init_script("try{localStorage.setItem('__probe','1')}catch(e){}")
        await s1.goto(base, wait_until='domcontentloaded', timeout=180000); await s1.wait_for_timeout(1500)
        await s1.evaluate("""()=>{for(let i=0;i<localStorage.length;i++){}}""")
        tut_key = await s1.evaluate("""()=>{const s=[...document.scripts].map(x=>x.textContent).find(t=>t.includes('function completed(){try{return sessionCompleted'));
          const m=s&&s.match(/const STORAGE=['"]([^'"]+)['"]/);return m?m[1]:null}""")
        ok(bool(tut_key), 'TUTORIAL_KEY_NOT_FOUND')
        if tut_key: await s1.evaluate("(k)=>localStorage.setItem(k,'1')", tut_key)
        gh_before = len(gh)
        await s1.goto(base + '?join=' + code2, wait_until='domcontentloaded', timeout=180000)
        s1src = await wait_game(s1, 'arcade')
        ok(s1src == units, 'STUDENT_QR_ARCADE_UNITS')
        await s1.wait_for_function("(()=>{try{return !!document.getElementById('hqArcadeFrame').contentWindow.Phaser}catch(e){return false}})()", timeout=90000)
        out['studentQrArcade'] = {'started': True, 'units': len(s1src), 'packageFetches': len(gh) - gh_before, 'noSelectionScreens':
                                  await s1.evaluate("document.getElementById('hojaCatalog').hidden&&document.getElementById('hojaNextMode').hidden")}
        await shot(s1, 'student_qr_arcade.png')
        # ---------------- STUDENT 2: manual code, typo first, then reload -> cache hit
        s2ctx, s2, s2err = await device(820, 1180)
        await s2.goto(base, wait_until='domcontentloaded', timeout=180000); await s2.wait_for_timeout(5000)
        await s2.wait_for_selector('#hoja15JoinEntry.show', timeout=30000)
        await s2.click('#hoja15JoinEntry'); await s2.fill('#hoja15JoinInput', '000001' if quiz_code != '000001' else '000002'); await s2.press('#hoja15JoinInput', 'Enter')
        await s2.wait_for_function("(document.getElementById('hoja15JoinErr')?.textContent||'').length>0", timeout=30000)
        typo = await s2.inner_text('#hoja15JoinErr'); ok('찾을 수 없' in typo, 'TYPO_MESSAGE ' + typo)
        await shot(s2, 'student_typo.png')
        gh_before = len(gh)
        await s2.fill('#hoja15JoinInput', quiz_code); await s2.click('#hoja15JoinGo')
        s2src = await wait_game(s2, 'quiz'); first_fetch = len(gh) - gh_before
        ok(s2src == units, 'STUDENT_MANUAL_QUIZ_UNITS')
        gh_before = len(gh)
        await s2.goto(base + '?join=' + quiz_code, wait_until='domcontentloaded', timeout=180000)
        await wait_game(s2, 'quiz'); second_fetch = len(gh) - gh_before
        ok(second_fetch == 0, 'CACHE_NOT_REUSED ' + str(second_fetch))
        out['studentManualQuiz'] = {'typoMessage': typo, 'started': True, 'units': len(s2src), 'firstLoadPackageFetches': first_fetch, 'sameDeviceReloadPackageFetches': second_fetch}
        await shot(s2, 'student_manual_quiz.png')
        errs = [e for e in terr + s1err + s2err if 'ResizeObserver' not in e]
        ok(not errs, 'PAGE_ERRORS ' + json.dumps(errs, ensure_ascii=False)[:400]); out['pageErrors'] = len(errs)
        await b.close()
    st = backend(a.port)
    out['rpcCalls'] = {k: st['calls'].count(k) for k in sorted(set(st['calls']))}
    print(json.dumps(out, ensure_ascii=False, indent=1))
    print('HOJA15_JOIN_E2E_' + ('PASS' if not fails else 'FAIL'), json.dumps(fails, ensure_ascii=False)); sys.exit(1 if fails else 0)

if __name__ == '__main__':
    asyncio.run(main())
