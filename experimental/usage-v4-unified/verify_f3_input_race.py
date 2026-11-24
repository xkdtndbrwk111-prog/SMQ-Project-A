#!/usr/bin/env python3
"""F3-3 / 40-6V-W input-race test (offline Chromium; IDs and numbers only).

A "fast student": after the balloon opens, tap the first choice the INSTANT any choice is visible —
a real pointer press/release at its screen position, without waiting for the game's own `show`.
Per tap we record the question visible at tap time (renderer current()), the game's question (last
`show` command), whether an answer was registered (answered +1) and the score movement.
  hazard  = an answer was registered while the visible question was NOT the game's question
  dropped = the tap registered nothing (guard/host blocked it); the student simply taps again
After each probe the question is answered normally so the run advances.
Exit 1 if any hazard is observed (use on the FIXED build); --expect-hazard inverts that for the
pre-fix reproduction (exit 0 only if at least one hazard was reproduced).
Usage: verify_f3_input_race.py --html G --sources-dir D --units a,b [--per-unit 12] [--expect-hazard]"""
import argparse, asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright

IFR = 'iframe[id^="hojaTeamApproved"]'

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--html', required=True); ap.add_argument('--sources-dir', required=True); ap.add_argument('--units', required=True)
    ap.add_argument('--per-unit', type=int, default=12); ap.add_argument('--expect-hazard', action='store_true'); ap.add_argument('--json'); ap.add_argument('--delays', default='0', help='ms after a choice becomes visible, cycled per probe (input-loss sweep)')
    a = ap.parse_args()
    html = Path(a.html).read_text(encoding='utf-8')
    delays = [int(x) for x in a.delays.split(',')]; by_delay = {}
    tot = {'probes': 0, 'registered': 0, 'hazard': 0, 'dropped': 0, 'registeredCorrectlyForGameQuestion': 0, 'scorerMismatch': 0}; cases = []
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        for uid in a.units.split(','):
            src = json.loads((Path(a.sources_dir) / f'src_{uid}.json').read_text(encoding='utf-8'))
            byq = {q['rendererQuestion']['questionId']: q for q in src[0]['data']['questions']}
            ctx = await b.new_context(viewport={'width': 1280, 'height': 800}); page = await ctx.new_page()
            await page.route('**/*', lambda r: asyncio.ensure_future(r.continue_() if r.request.url.startswith('data:') else r.abort()))
            await page.set_content(html, wait_until='domcontentloaded', timeout=180000)
            await page.evaluate('''(s)=>{window.HOJA_ATTRACT_SCENE={pausedByUser:false,anims:{pauseAll(){},resumeAll(){}},tweens:{pauseAll(){},resumeAll(){}},
              scene:{isPaused:()=>true,pause(){},resume(){},restart(){}}};window.HOJA_B_LIVE={sources:s};
              window.HOJA_GAMEPLAY.setServerQuestions(s);window.HOJA_GAMEPLAY.launch("quiz","spring");
              window.__shows=[];const f=document.querySelector('iframe[id^="hojaTeamApproved"]');const pm=f.contentWindow.postMessage.bind(f.contentWindow);
              f.contentWindow.postMessage=(m,o)=>{if(m&&m.action==='show')window.__shows.push(m.payload.questionId);return pm(m,o)};}''', src)
            for i in range(a.per_unit):
                st0 = await page.evaluate('window.HOJA_GAMEPLAY.state')
                if not await page.evaluate("!document.getElementById('hqBalloon').hidden"): break
                n_show = await page.evaluate('window.__shows.length')
                await page.evaluate('document.getElementById("hqBalloon").click()')
                # tap the instant ANY choice button is visible (no wait for the game's show)
                tap = None
                for _ in range(400):
                    tap = await page.evaluate(f'''()=>{{const f=document.querySelector('{IFR}');if(!f||document.querySelector('#hqOverlay')?.hidden)return null;
                      const d=f.contentDocument;const b=[...d.querySelectorAll('#hqChoices button.hqChoice')].find(x=>{{const r=x.getBoundingClientRect();
                        return r.width>0&&r.height>0&&getComputedStyle(x).visibility!=='hidden'&&d.defaultView.getComputedStyle(d.getElementById('hqChoices')).visibility!=='hidden'}});
                      if(!b)return null;const fr=f.getBoundingClientRect(),r=b.getBoundingClientRect();let cur=null;try{{cur=f.contentWindow.current().questionId}}catch(e){{}}
                      return {{x:fr.left+r.left+r.width/2,y:fr.top+r.top+r.height/2,visibleQ:cur,choice:b.dataset.choice}}}}''')
                    if tap: break
                    await page.wait_for_timeout(2)
                if not tap: continue
                delay = delays[tot['probes'] % len(delays)]
                if delay:
                    await page.wait_for_timeout(delay)
                    tap2 = await page.evaluate(f'''(c)=>{{const f=document.querySelector('{IFR}');const d=f.contentDocument;
                      const b=d.querySelector('#hqChoices button.hqChoice[data-choice="'+c+'"]')||d.querySelector('#hqChoices button.hqChoice');if(!b)return null;
                      const fr=f.getBoundingClientRect(),r=b.getBoundingClientRect();return {{x:fr.left+r.left+r.width/2,y:fr.top+r.top+r.height/2}}}}''', tap['choice'])
                    if tap2: tap.update(tap2)
                # the question visible AT THE TAP INSTANT (not when the choices first appeared)
                tap['visibleQ'] = await page.evaluate(f"(()=>{{try{{return document.querySelector('{IFR}').contentWindow.current().questionId}}catch(e){{return null}}}})()")
                await page.mouse.click(tap['x'], tap['y'])
                await page.wait_for_timeout(1200)
                st1 = await page.evaluate('window.HOJA_GAMEPLAY.state')
                # the game's question: what the renderer holds once the game's show has completed (nothing else draws
                # until the next balloon); the show-command log is kept as a cross-check when available
                game_q = await page.evaluate(f"(()=>{{try{{return document.querySelector('{IFR}').contentWindow.current().questionId}}catch(e){{return null}}}})()")
                logged = await page.evaluate('(n)=>window.__shows.slice(n).at(-1)||null', n_show)
                if logged and logged != game_q: raise AssertionError(('SHOW_LOG_DISAGREES', logged, game_q))
                reg = st1['answered'] == st0['answered'] + 1
                hazard = reg and tap['visibleQ'] != game_q
                tot['probes'] += 1; tot['registered'] += reg; tot['hazard'] += hazard; tot['dropped'] += (not reg)
                tot['registeredCorrectlyForGameQuestion'] += (reg and not hazard)
                # direct scorer check (40-6X): for a registered tap, the game's correct-count must move by exactly
                # (tapped choice == approved answer of the GAME's question)
                gq = byq.get(game_q, {}).get('rendererQuestion', {})
                ans = gq.get('answer', {})
                expected = (tap['choice'] == ans.get('choiceId')) if gq.get('type') == 'MCQ' else (tap['choice'] == str(ans.get('value')).lower())
                scorer_ok = (not reg) or (st1['correct'] - st0['correct'] == int(expected))
                tot['scorerMismatch'] += (not scorer_ok)
                bd = by_delay.setdefault(delay, {'taps': 0, 'registered': 0, 'hazard': 0}); bd['taps'] += 1; bd['registered'] += reg; bd['hazard'] += hazard
                cases.append({'unit': uid, 'probe': i, 'delayMs': delay, 'visibleQAtTap': tap['visibleQ'], 'gameQ': game_q, 'tappedChoice': tap['choice'],
                              'type': gq.get('type'), 'registered': reg, 'hazard': hazard, 'expectedCorrect': expected if reg else None,
                              'answeredBefore': st0['answered'], 'answeredAfter': st1['answered'], 'correctBefore': st0['correct'], 'correctAfter': st1['correct'],
                              'scorerOk': scorer_ok})
                if not reg:  # answer the game's question normally to advance
                    await page.wait_for_function(f'''(q)=>{{try{{const w=document.querySelector('{IFR}').contentWindow;return w.current().questionId===q&&!w.document.body.classList.contains('hojaAwaitShow')}}catch(e){{return false}}}}''', arg=game_q, timeout=15000)
                    rq = byq[game_q]['rendererQuestion']
                    c = rq['answer']['choiceId'] if rq['type'] == 'MCQ' else str(rq['answer']['value']).lower()
                    await page.frame_locator(IFR).locator(f'button.hqChoice[data-choice="{c}"]').click()
                    await page.wait_for_function('(n)=>window.HOJA_GAMEPLAY.state.answered===n', arg=st0['answered'] + 1, timeout=15000)
                await page.wait_for_function('()=>!window.HOJA_GAMEPLAY.state.activeQuiz', timeout=15000)
            blocked = await page.evaluate(f"(()=>{{try{{return document.querySelector('{IFR}').contentWindow.HOJA_RENDERER_INPUT_GUARD?.blocked??null}}catch(e){{return null}}}})()")
            print(uid, json.dumps({k: tot[k] for k in tot}), 'guardBlocked', blocked, flush=True)
            await ctx.close()
        await b.close()
    if a.json: Path(a.json).write_text(json.dumps({'totals': tot, 'byDelayMs': by_delay, 'cases': cases}, ensure_ascii=False, indent=1))
    print(json.dumps(tot)); print('byDelayMs', json.dumps(by_delay))
    if a.expect_hazard:
        print('F3_INPUT_RACE_PREFIX_' + ('HAZARD_REPRODUCED' if tot['hazard'] else 'NOT_REPRODUCED')); sys.exit(0 if tot['hazard'] else 1)
    bad = tot['hazard'] or tot['scorerMismatch']
    print('F3_INPUT_RACE_' + ('PASS' if not bad else 'FAIL')); sys.exit(1 if bad else 0)

asyncio.run(main())
