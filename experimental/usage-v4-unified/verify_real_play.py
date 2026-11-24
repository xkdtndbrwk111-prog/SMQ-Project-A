#!/usr/bin/env python3
"""40-6BF: REAL deployed web app play check (signed-out Chromium, real Apps Script iframe, real GitHub packages).
Reuses the offline drivers' UI steps on the game's own frame inside Google's sandbox iframes:
  SOLO-QUIZ  intro -> 공개 카트리지 -> unit -> 혼자 놀기 -> 문제 풀이 모드 -> every balloon/question answered with the
             KEYBOARD (digit of the drawn choice), alternately right/wrong; each verdict must match the intended answer;
             no SHORT question in SOLO; result screen numbers == answers given; '다시 풀기' + '모드 선택' present.
  SOLO-ARCADE 혼자 놀기 -> 아케이드 모드: real Phaser loads (CDN) inside the arcade frame, canvas present, no page error.
  TEAM       함께 놀기 -> 2 teams -> full game (teacher judges SHORT) -> final -> 우승 -> 오답 복습 (count == wrong answers,
             scores unchanged by review) -> '오답 복습 완료'.
Counts/ids only. Usage: HOJA_URL=<exec url> verify_real_play.py --solo u1,u2 --arcade u --team u"""
import argparse, asyncio, json, os, re, sys
from pathlib import Path
from playwright.async_api import async_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from verify_f3_ui_e2e import to_catalog, pick_unit, mode
from verify_f3_team_full import question_open, answer, click_first, IFR

URL = os.environ['HOJA_URL']

async def game_frame(page):
    for _ in range(240):
        for f in page.frames:
            try:
                if await f.evaluate("!!document.getElementById('hojaRepoChoice')&&!!window.HOJA_B_LIVE"): return f
            except Exception: pass
        await asyncio.sleep(0.5)
    raise AssertionError('GAME_FRAME_NOT_FOUND')

async def open_game(b):
    ctx = await b.new_context(viewport={'width': 1280, 'height': 800}); page = await ctx.new_page(); errs = []
    page.on('pageerror', lambda e: errs.append(str(e)[:160])); page.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
    await page.goto(URL, wait_until='load', timeout=180000)
    fr = await game_frame(page)
    await fr.wait_for_timeout(4000)
    rows = await fr.evaluate("window.HOJA_B_LIVE.rpc('LIST')")
    names = {r['pkg']['id']: r['name'] for r in rows if r.get('pkg')}
    return ctx, page, fr, names, errs

async def drawn(fr):
    return await fr.evaluate(f"""()=>{{const w=document.querySelector('{IFR}').contentWindow;const q=w.current();
      const bs=[...w.document.querySelectorAll('#hqChoices button.hqChoice')];
      return {{id:q.id,type:q.type,ans:q.answer,choices:bs.map(b=>b.dataset.choice||''),stamped:bs.length>0&&bs.every(b=>b.dataset.hojaQid===q.id)}}}}""")

async def solo_quiz(b, uid):
    ctx, page, fr, names, errs = await open_game(b)
    await to_catalog(fr); await pick_unit(fr, names[uid]); await mode(fr, '혼자 놀기', '문제 풀이 모드')
    await fr.wait_for_function("window.HOJA_GAMEPLAY?.state?.answered===0", timeout=60000)
    given = right = keyboard_ok = 0; types = {}; mismatches = []
    for _ in range(1500):
        if await fr.evaluate("document.getElementById('hqStage')?.dataset.quizFinished==='true'"): break
        if await question_open(fr):
            info = await drawn(fr)
            if not info['stamped']: await fr.wait_for_timeout(250); continue
            assert info['type'] != 'SHORT', ('SHORT_IN_SOLO', info['id'])
            want = given % 2 == 0
            correct = info['ans']['choiceId'] if info['type'] == 'MCQ' else str(info['ans']['value']).lower()
            pick = correct if want else next(c for c in info['choices'] if c != correct)
            key = str(info['choices'].index(pick) + 1)
            before = (await fr.evaluate("window.HOJA_GAMEPLAY.state"))['answered']
            await fr.frame_locator(IFR).locator('body').press(key)          # real keyboard input in the question frame
            try:
                await fr.wait_for_function("(n)=>window.HOJA_GAMEPLAY.state.answered>n", arg=before, timeout=4000); keyboard_ok += 1
            except Exception:
                await fr.frame_locator(IFR).locator(f'button.hqChoice[data-choice="{pick}"]').click(timeout=8000)
                await fr.wait_for_function("(n)=>window.HOJA_GAMEPLAY.state.answered>n", arg=before, timeout=8000)
            verdict = await fr.evaluate("document.getElementById('hqFeedback')?.textContent||''")
            if ('정답' in verdict and '오답' not in verdict) != want: mismatches.append([info['id'], want, verdict[:20]])
            given += 1; right += want; types[info['type']] = types.get(info['type'], 0) + 1
            await fr.wait_for_timeout(1500); continue
        try: await fr.locator('#hqBalloon').click(force=True, timeout=3000)
        except Exception: pass
        await fr.wait_for_timeout(500)
    else:
        raise AssertionError(('SOLO_NOT_FINISHED', given))
    res = await fr.evaluate("""()=>({answered:+document.getElementById('hqResultAnswered').textContent,correct:+document.getElementById('hqResultCorrect').textContent,
      pct:document.getElementById('hqResultPercent').textContent,shown:!document.getElementById('hqResult').hidden,
      retry:!!document.getElementById('hqResultRetry'),back:!!document.getElementById('hqResultBack')})""")
    st = await fr.evaluate("window.HOJA_GAMEPLAY.state")
    ok = res['shown'] and res['answered'] == given == st['answered'] and res['correct'] == right == st['correct'] and not mismatches and res['retry'] and res['back']
    await fr.locator('#hqResultBack').click(timeout=8000); await fr.wait_for_timeout(1500)
    back_ok = await fr.evaluate("document.getElementById('hojaGamePlay')?.hidden===true")
    bad = [e for e in errs if 'ResizeObserver' not in e]
    out = {'unit': uid, 'answered': given, 'correctGiven': right, 'byType': types, 'keyboardAnswers': keyboard_ok, 'result': res, 'verdictMismatches': mismatches,
           'backToModeSelect': back_ok, 'pageErrors': bad}
    await ctx.close()
    return ok and back_ok and not bad, out

async def solo_arcade(b, uid):
    ctx, page, fr, names, errs = await open_game(b)
    await to_catalog(fr); await pick_unit(fr, names[uid]); await mode(fr, '혼자 놀기', '아케이드 모드')
    ver = None
    for _ in range(120):
        ver = await fr.evaluate("(()=>{try{return document.getElementById('hqArcadeFrame')?.contentWindow?.Phaser?.VERSION||null}catch(e){return 'ERR'}})()")
        if ver and ver != 'ERR': break
        # arcade opens with the story dialogue first ("Enter 또는 Space로 대화를 이어가세요"): advance it like a player
        await page.keyboard.press('Enter')
        await fr.wait_for_timeout(700)
    await fr.wait_for_timeout(3000)
    canvas = await fr.evaluate("(()=>{try{const d=document.getElementById('hqArcadeFrame').contentDocument;const c=d.querySelector('canvas');return c?[c.width,c.height]:null}catch(e){return 'ERR'}})()")
    info = await fr.evaluate("document.getElementById('hqArcadeInfo')?.textContent||''")
    bad = [e for e in errs if 'ResizeObserver' not in e]
    out = {'unit': uid, 'phaser': ver, 'canvas': canvas, 'arcadeInfo': info[:80], 'pageErrors': bad}
    await ctx.close()
    return bool(ver and ver != 'ERR' and canvas and canvas != 'ERR' and '실패' not in info and not bad), out

async def team_full(b, uid):
    ctx, page, fr, names, errs = await open_game(b)
    await to_catalog(fr); await pick_unit(fr, names[uid]); await mode(fr, '함께 놀기', '2')
    await fr.wait_for_timeout(3000)
    types = {}; answered = wrong = 0; review_mode = False; reviewed = 0; scores_before = None; final_seen = False; heading = ''
    for _ in range(1200):
        await fr.wait_for_timeout(350)
        if review_mode and await fr.evaluate("(()=>{const b=document.getElementById('hojaTeamReviewNext');return !!b&&b.style.display!=='none'})()"):
            await fr.locator('#hojaTeamReviewNext').click(force=True); await fr.wait_for_timeout(900); continue
        if await question_open(fr):
            if review_mode:
                t, _ = await answer(fr, True)
                if t is None: continue
                reviewed += 1
            else:
                want = answered % 2 == 0
                t, _ = await answer(fr, want)
                if t is None: continue
                answered += 1; wrong += (not want); types[t] = types.get(t, 0) + 1
            await fr.wait_for_timeout(900); continue
        desc = await fr.evaluate("document.querySelector('#htItemLayer .htModalDesc')?.textContent||''")
        if '오답 복습 완료' in desc: break
        if await click_first(fr, '#htFinalNext'): final_seen = True; await fr.wait_for_timeout(1600); continue
        start = fr.locator('#htItemLayer button', has_text='오답 복습 시작')
        if await start.count() and await start.first.is_visible():
            label = await start.first.inner_text()
            count = int(re.search(r'\((\d+)문항\)', label).group(1))
            assert count == wrong, ('REVIEW_COUNT', count, wrong)
            heading = await fr.evaluate("document.querySelector('#htItemLayer .htModalTitle')?.textContent||''")
            assert '우승' in heading, heading
            scores_before = await fr.evaluate("[...document.querySelectorAll('[id^=\"htFinalDetail-\"]')].map(e=>e.textContent)")
            await start.first.click(); review_mode = True; await fr.wait_for_timeout(1200); continue
        for sel in ('#htItemLayer .htPipeBtn', '#htItemLayer .htPeachCell', '#htItemLayer .htItemActions button', '#htItemLayer button.htPrimary', '#htItemLayer button'):
            if await click_first(fr, sel): break
        else:
            if not await click_first(fr, '#htTeamBoard button.htBalloon'): await fr.wait_for_timeout(500)
    else:
        raise AssertionError(('TEAM_NOT_FINISHED', answered, wrong, reviewed))
    scores_after = await fr.evaluate("[...document.querySelectorAll('[id^=\"htFinalDetail-\"]')].map(e=>e.textContent)")
    bad = [e for e in errs if 'ResizeObserver' not in e]
    out = {'unit': uid, 'turnsAnswered': answered, 'byType': types, 'wrongGiven': wrong, 'reviewAsked': reviewed, 'winnerHeading': heading[:40],
           'finalScores': scores_after, 'scoresUnchangedByReview': scores_after == scores_before, 'pageErrors': bad}
    await ctx.close()
    return final_seen and review_mode and reviewed == wrong and scores_after == scores_before and not bad, out

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--solo', default=''); ap.add_argument('--arcade', default=''); ap.add_argument('--team', default='')
    a = ap.parse_args(); fails = []
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True, args=['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
        for kind, fn, units in (('SOLO_QUIZ', solo_quiz, a.solo), ('SOLO_ARCADE', solo_arcade, a.arcade), ('TEAM_FULL', team_full, a.team)):
            for uid in [u for u in units.split(',') if u]:
                try: ok, out = await fn(b, uid)
                except Exception as e: ok, out = False, {'unit': uid, 'error': repr(e)[:1500]}
                print(kind, 'PASS' if ok else 'FAIL', json.dumps(out, ensure_ascii=False), flush=True)
                if not ok: fails.append(kind + ':' + uid)
        await b.close()
    print('REAL_PLAY_' + ('PASS' if not fails else 'FAIL'), json.dumps(fails)); sys.exit(1 if fails else 0)

if __name__ == '__main__':
    asyncio.run(main())
