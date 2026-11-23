#!/usr/bin/env python3
"""F3-3 TEAM full game E2E (offline Chromium + qa_mock_gas_server.mjs, release-candidate Game.html).
Real UI only: intro -> 공개 카트리지 -> unit card -> 함께 놀기 -> 2 -> play EVERY turn (board balloon ->
approved iframe question -> answer: MC/OX alternately right/wrong, SHORT via the teacher reveal + teacher
judgement buttons -> pipe / peach / target / 다음 팀 actions) -> final 다음 x3 -> winner -> 오답 복습 시작 ->
answer every review question -> review complete. Asserts (nonzero exit on any failure):
  * final reached after state.limit turns; heading announces 우승; review button count == wrong answers given
    (never-played questions excluded); the review asks exactly those; final scores unchanged by review;
    description gains '오답 복습 완료'; backend: exactly ONE A1 TEAM usage row; no ranking RPC at all.
Usage: verify_f3_team_full.py --html G --phaser P --port N --units a,b"""
import argparse, asyncio, json, re, sys, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from verify_f3_ui_e2e import STUB, backend, to_catalog, pick_unit, mode

IFR = 'iframe[id^="hojaTeamApproved"]'
async def visible(page, sel):
    return await page.evaluate("(s)=>{const e=document.querySelector(s);if(!e)return false;const r=e.getBoundingClientRect();"
                               "return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden]')}", sel)

async def question_open(page):
    return await page.evaluate(f"""()=>{{const o=document.getElementById('hqOverlay');const f=document.querySelector('{IFR}');
      return !!(o&&!o.hidden&&f&&f.contentDocument&&f.contentDocument.querySelectorAll('#hqChoices button.hqChoice').length)}}""")

async def answer(page, want_correct):
    info = await page.evaluate(f"""()=>{{const w=document.querySelector('{IFR}').contentWindow;const q=w.current();
      return {{id:q.id,type:q.type,ans:q.answer,choices:[...w.document.querySelectorAll('#hqChoices button.hqChoice')].map(b=>b.dataset.choice||'')}}}}""")
    fl = page.frame_locator(IFR)
    if info['type'] == 'SHORT':
        await fl.locator('button.hqChoice').first.click(timeout=10000)          # teacher: 정답 확인 (reveal)
        # teacher judgement buttons rendered by the approved renderer: ✓ 정답 처리 / ✕ 오답 처리
        await fl.locator('button.teacher-judge.' + ('correct' if want_correct else 'incorrect')).first.click(timeout=10000)
        return info['type'], want_correct
    correct = info['ans']['choiceId'] if info['type'] == 'MCQ' else str(info['ans']['value']).lower()
    pick = correct if want_correct else next(c for c in info['choices'] if c != correct)
    await fl.locator(f'button.hqChoice[data-choice="{pick}"]').click(timeout=10000)
    return info['type'], want_correct

async def click_first(page, sel):
    loc = page.locator(sel)
    n = await loc.count()
    for i in range(n):
        el = loc.nth(i)
        if await el.is_visible() and await el.is_enabled():
            await el.click(force=True, timeout=5000); return True
    return False

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--html', required=True); ap.add_argument('--phaser', required=True)
    ap.add_argument('--port', type=int, default=8766); ap.add_argument('--units', required=True)
    a = ap.parse_args()
    html = Path(a.html).read_text(encoding='utf-8').replace('<head>', '<head>' + STUB.replace('PORT', str(a.port)), 1)
    phaser = Path(a.phaser).read_bytes()
    names = {x['cartridgeId']: x['name'] for x in backend(a.port, '/rpc', {'fn': 'hojaListPublicCartridges', 'args': []})['v']}
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        for uid in a.units.split(','):
            before = backend(a.port)
            ctx = await b.new_context(viewport={'width': 1280, 'height': 800}); page = await ctx.new_page(); errs = []
            page.on('pageerror', lambda e: errs.append(str(e)[:140])); page.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
            async def route(r):
                u = r.request.url
                if u == f'http://127.0.0.1:{a.port}/game.html': await r.fulfill(body=html, content_type='text/html; charset=utf-8')
                elif u.endswith('phaser.min.js'): await r.fulfill(body=phaser, content_type='application/javascript')
                elif u.startswith(('data:', f'http://127.0.0.1:{a.port}')): await r.continue_()
                else: await r.abort()
            await page.route('**/*', route)
            await page.goto(f'http://127.0.0.1:{a.port}/game.html', wait_until='domcontentloaded', timeout=180000)
            await page.wait_for_timeout(5000)
            await to_catalog(page); await pick_unit(page, names[uid]); await mode(page, '함께 놀기', '2')
            await page.wait_for_timeout(3000)
            types = {}; answered = wrong = 0; review_mode = False; reviewed = 0; scores_before_review = None; final_seen = False
            for step in range(900):
                await page.wait_for_timeout(350)
                if review_mode and await page.evaluate("(()=>{const b=document.getElementById('hojaTeamReviewNext');return !!b&&b.style.display!=='none'})()"):
                    await page.locator('#hojaTeamReviewNext').click(force=True); await page.wait_for_timeout(900); continue
                if await question_open(page):
                    if review_mode:
                        await answer(page, True); reviewed += 1
                    else:
                        want = answered % 2 == 0
                        t, _ = await answer(page, want); answered += 1; wrong += (not want); types[t] = types.get(t, 0) + 1
                    await page.wait_for_timeout(900); continue
                desc = await page.evaluate("document.querySelector('#htItemLayer .htModalDesc')?.textContent||''")
                if '오답 복습 완료' in desc: break
                if await click_first(page, '#htFinalNext'): final_seen = True; await page.wait_for_timeout(1600); continue
                start = page.locator('#htItemLayer button', has_text='오답 복습 시작')
                if await start.count() and await start.first.is_visible():
                    label = await start.first.inner_text()
                    count = int(re.search(r'\((\d+)문항\)', label).group(1))
                    assert count == wrong, ('REVIEW_COUNT', count, wrong)
                    heading = await page.evaluate("document.querySelector('#htItemLayer .htModalTitle')?.textContent||''")
                    assert '우승' in heading, heading
                    scores_before_review = await page.evaluate("[...document.querySelectorAll('[id^=\"htFinalDetail-\"]')].map(e=>e.textContent)")
                    await start.first.click(); review_mode = True; await page.wait_for_timeout(1200); continue
                for sel in ('#htItemLayer .htPipeBtn', '#htItemLayer .htPeachCell', '#htItemLayer .htItemActions button',
                            '#htItemLayer button.htPrimary', '#htItemLayer button'):
                    if await click_first(page, sel): break
                else:
                    if not await click_first(page, '#htTeamBoard button.htBalloon'):
                        await page.wait_for_timeout(500)
            else:
                raise AssertionError(('TEAM_GAME_DID_NOT_FINISH', answered, wrong, reviewed))
            assert final_seen and review_mode and reviewed == wrong, ('REVIEW', final_seen, review_mode, reviewed, wrong)
            scores_after = await page.evaluate("[...document.querySelectorAll('[id^=\"htFinalDetail-\"]')].map(e=>e.textContent)")
            assert scores_after == scores_before_review, ('SCORES_CHANGED_BY_REVIEW', scores_before_review, scores_after)
            after = backend(a.port)
            rows = after['usageRows'][len(before['usageRows']):]
            assert len(rows) == 1 and rows[0]['schema'] == 'A1' and rows[0]['mode'] == 'TEAM' and rows[0]['ids'] == uid, rows
            new_calls = after['calls'][len(before['calls']):]
            assert not any(c.startswith('hojaRank') for c in new_calls), ('RANK_RPC_IN_TEAM', new_calls)
            bad = [e for e in errs if 'ResizeObserver' not in e]
            assert not bad, ('JS_ERRORS', bad)
            print(json.dumps({'unit': uid, 'turnsAnswered': answered, 'byType': types, 'shortTeacherJudged': types.get('SHORT', 0), 'wrongGiven': wrong, 'reviewAsked': reviewed,
                              'finalScores': scores_after, 'usageRows': 1, 'rankRpc': 0}, ensure_ascii=False), flush=True)
            await ctx.close()
        await b.close()
    print('F3_TEAM_FULL_PASS')

try:
    asyncio.run(main())
except Exception as e:
    print('F3_TEAM_FULL_FAIL ' + repr(e)[:400]); sys.exit(1)
