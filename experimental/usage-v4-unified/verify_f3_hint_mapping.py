#!/usr/bin/env python3
"""F3-3 real answer-hint / choice-mapping assertions (replaces the empty `hint_leak` placeholder).

For EVERY non-SHORT question of the given units, on the given game HTML (release candidate), the
solo engine is driven question by question (an in-memory hook only reorders the deck; the
repository is untouched) and, while the question is shown and BEFORE answering, asserts:
  * MCQ: the shown choices (3 of the original 4) include the approved correct choiceId; OX shows O/X;
  * picture-only choices: the game's internal option labels (approved imageAlt used only as the
    legacy option key) appear nowhere in visible text, aria-label/title/alt of the game page or
    the renderer iframe -- the picture itself is the choice;
  * approved overlay doNotDisplay cues (e.g. q21 "8시 20분") appear nowhere visible;
then clicks the CORRECT choice and asserts the verdict says 정답 and the score/answered counters move.
Any failure exits nonzero. Usage: verify_f3_hint_mapping.py --html G --sources-dir D --report R [--units a,b]"""
import argparse, asyncio, json, re, sys
from pathlib import Path
from playwright.async_api import async_playwright

HOOK = 'return {launch,back,stop,setServerQuestions,clearServerQuestions,getCanonicalArcade:expandArcade,get state()'
SETTLE_MS = 700
SNAP = """(labels)=>{
  const f=document.querySelector('iframe[id^="hojaTeamApproved"]');const d=f.contentDocument;
  const attrs=doc=>[...doc.querySelectorAll('[aria-label],[title],[alt]')].map(e=>[e.getAttribute('aria-label'),e.getAttribute('title'),e.getAttribute('alt')].join(' ')).join(' ');
  const visible=(document.body.innerText||'')+' '+attrs(document)+' '+(d.body.innerText||'')+' '+attrs(d);
  return {choices:[...d.querySelectorAll('#hqChoices button.hqChoice')].map(b=>b.dataset.choice),
    leaks:labels.filter(l=>l&&visible.includes(l))};
}"""

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--html', required=True); ap.add_argument('--sources-dir', required=True); ap.add_argument('--report', required=True)
    ap.add_argument('--units'); ap.add_argument('--phaser'); ap.add_argument('--settle-ms', type=int, default=700); ap.add_argument('--fail-json')
    a = ap.parse_args()
    global SETTLE_MS; SETTLE_MS = a.settle_ms
    html = Path(a.html).read_text(encoding='utf-8')
    assert html.count(HOOK) == 1, 'SOLO_ENGINE_ANCHOR_CHANGED'
    html = html.replace(HOOK, '''return {launch,back,stop,setServerQuestions,clearServerQuestions,getCanonicalArcade:expandArcade,
      __qa:{forceId:(qid)=>{const ix=deck.findIndex(i=>questions[i].approvedBinding?.questionId===qid);if(ix<0)return false;
        deck.push(...deck.splice(ix,1));return true;}},get state()''', 1)
    report = json.loads(Path(a.report).read_text(encoding='utf-8'))
    cues = {}
    for e in report['entries']:
        mo = e.get('mediaOverlay')
        if mo: cues[mo['questionId']] = [re.sub(r'\s*\([^)]*\)\s*$', '', c).strip() for c in mo.get('doNotDisplay', [])]
    files = sorted(Path(a.sources_dir).glob('src_*.json'))
    if a.units: files = [f for f in files if f.stem[4:] in a.units.split(',')]
    totals = {'units': 0, 'questions': 0, 'mcq': 0, 'ox': 0, 'pictureChoice': 0, 'cueChecked': 0, 'leaks': 0, 'mappingFail': 0, 'verdictFail': 0}
    fails = []
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        for f in files:
            sources = json.loads(f.read_text(encoding='utf-8'))
            qs = [q for q in sources[0]['data']['questions'] if q['type'] in ('MULTIPLE', 'OX')]
            ctx = await b.new_context(viewport={'width': 1280, 'height': 800}); page = await ctx.new_page(); errs = []
            page.on('pageerror', lambda e: errs.append(str(e)[:120])); page.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
            await page.route('**/*', lambda r: asyncio.ensure_future(r.continue_() if r.request.url.startswith('data:') else r.abort()))
            await page.set_content(html, wait_until='domcontentloaded', timeout=180000)
            await page.evaluate('''(sources)=>{window.HOJA_ATTRACT_SCENE={pausedByUser:false,anims:{pauseAll(){},resumeAll(){}},tweens:{pauseAll(){},resumeAll(){}},
              scene:{isPaused:()=>true,pause(){},resume(){},restart(){}}};window.HOJA_B_LIVE={sources};
              window.HOJA_GAMEPLAY.setServerQuestions(sources);window.HOJA_GAMEPLAY.launch("quiz","spring");}''', sources)
            # 40-6V evidence: IDs/timestamps only (no question text or images)
            await page.evaluate('''()=>{window.__ev=[];const t0=performance.now();const L=(k,v)=>window.__ev.push([Math.round(performance.now()-t0),k,v]);window.__L=L;
              window.addEventListener('message',e=>{if(e.data&&e.data.type==='HOJA_UNIFIED_ANSWER')L('answerMsg',e.data.questionId+'|'+e.data.choiceId)},true);
              const f=document.querySelector('iframe[id^="hojaTeamApproved"]');if(f){const pm=f.contentWindow.postMessage.bind(f.contentWindow);
                f.contentWindow.postMessage=(m,o)=>{if(m&&m.action)L('cmd:'+m.action,m.action==='show'?m.payload.questionId+'|omit='+m.payload.omitChoiceId:'');return pm(m,o)};}}''')
            byRid = {q['rendererQuestion']['id']: q for q in sources[0]['data']['questions']}
            seen = set(); last_shown = ''
            for q in qs:
                if not await page.evaluate('(id)=>window.HOJA_GAMEPLAY.__qa.forceId(id)', q['rendererQuestion']['questionId']): continue
                before = await page.evaluate('window.HOJA_GAMEPLAY.state')
                await page.evaluate('(q)=>window.__L&&window.__L("balloon",q+" "+JSON.stringify(window.HOJA_GAMEPLAY.state))', q['rendererQuestion']['questionId'])
                await page.evaluate('document.getElementById("hqBalloon").click()')
                await page.wait_for_function('''()=>{const f=document.querySelector('iframe[id^="hojaTeamApproved"]');
                  return f?.contentDocument?.querySelectorAll('#hqChoices button.hqChoice').length>=2 && document.querySelector('#hqOverlay')?.hidden===false}''', timeout=20000)
                # judge the question the renderer ACTUALLY shows (a family may hold MC+OX variants; the engine picks one)
                # authoritative question = the LAST `show` command the game sent after this balloon (40-6V);
                # the renderer's default render after `load` is NOT the game's question.
                n_ev = await page.evaluate('window.__ev.length')
                await page.wait_for_function('''(n)=>window.__ev.slice(n).some(e=>e[1]==='cmd:show')''', arg=n_ev - 1, timeout=20000)
                show_q = await page.evaluate('''(n)=>window.__ev.slice(n).filter(e=>e[1]==='cmd:show').at(-1)[2].split('|')[0]''', n_ev - 1)
                await page.wait_for_function('''(q)=>{try{const w=document.querySelector('iframe[id^="hojaTeamApproved"]').contentWindow;
                  return w.current().questionId===q && !w.document.body.classList.contains('hojaAwaitShow')}catch(e){return false}}''', arg=show_q, timeout=20000)
                sid = await page.evaluate("document.querySelector('iframe[id^=hojaTeamApproved]').contentWindow.current().id")
                sq = byRid[sid]; rq = sq['rendererQuestion']; qid = rq['questionId']; seen.add(qid); last_shown = qid
                # wait until the drawn buttons belong to THIS question (current() can switch a frame before the DOM)
                await page.wait_for_function('''(ox)=>{const d=document.querySelector('iframe[id^="hojaTeamApproved"]').contentDocument;
                  const c=[...d.querySelectorAll('#hqChoices button.hqChoice')].map(b=>b.dataset.choice);
                  return ox ? c.join()==='true,false' : (c.length===3 && c.every(x=>/^c\\d+$/.test(x)))}''', arg=sq['type'] == 'OX', timeout=15000)
                picture = [c for c in rq.get('choices', []) if c.get('image') and not c.get('text')]
                labels = [o for o, c in zip(sq['options'], rq.get('choices', [])) if c.get('image') and not c.get('text')] if picture else []
                labels += cues.get(qid, [])
                snap = await page.evaluate(SNAP, labels)
                totals['questions'] += 1; totals['mcq' if sq['type'] == 'MULTIPLE' else 'ox'] += 1
                totals['pictureChoice'] += bool(picture); totals['cueChecked'] += bool(cues.get(qid))
                if snap['leaks']: totals['leaks'] += 1; fails.append({'q': qid, 'leak': snap['leaks']})
                correct = rq['answer']['choiceId'] if sq['type'] == 'MULTIPLE' else str(rq['answer']['value']).lower()
                if (sq['type'] == 'MULTIPLE' and (len(snap['choices']) != 3 or correct not in snap['choices'])) or \
                   (sq['type'] == 'OX' and snap['choices'] != ['true', 'false']):
                    totals['mappingFail'] += 1; fails.append({'q': qid, 'choices': snap['choices'], 'correct': correct}); continue
                await page.wait_for_timeout(SETTLE_MS)  # human-like reading pause before answering (0 = fastest possible)
                await page.evaluate('(c)=>window.__L&&window.__L("click",c)', correct + ' buttons=' + ','.join(snap['choices']) + ' familyId=' + str(sq.get('familyId')) + ' type=' + sq['type'])
                try:
                    # fast user: tap now; a tap the guard blocks (no answer registered) is retried, up to 4 taps
                    for tap in range(4):
                        await page.frame_locator('iframe[id^="hojaTeamApproved"]').locator(f'button.hqChoice[data-choice="{correct}"]').click(timeout=8000)
                        try:
                            await page.wait_for_function('(n)=>window.HOJA_GAMEPLAY.state.answered>=n', arg=before['answered'] + 1, timeout=1200); break
                        except Exception:
                            totals['blockedTapsRetried'] = totals.get('blockedTapsRetried', 0) + 1
                except Exception as ex:
                    # 40-6V: the button set changed between "ready" and the click -> record, do not hide
                    now = await page.evaluate('''()=>{const w=document.querySelector('iframe[id^="hojaTeamApproved"]').contentWindow;let cur=null;try{cur=w.current().questionId}catch(e){}
                      return {buttons:[...w.document.querySelectorAll('#hqChoices button.hqChoice')].map(b=>b.dataset.choice),rendererCurrent:cur,
                        overlayHidden:document.querySelector('#hqOverlay')?.hidden,state:window.HOJA_GAMEPLAY.state}}''')
                    totals['clickRace'] = totals.get('clickRace', 0) + 1
                    fails.append({'q': qid, 'clickRace': str(ex).splitlines()[0][:80], 'expected': correct, 'atClick': now,
                                  'events': await page.evaluate('window.__ev.slice(-14)')})
                    break
                await page.wait_for_function('(n)=>window.HOJA_GAMEPLAY.state.answered===n', arg=before['answered'] + 1, timeout=15000)
                after = await page.evaluate('window.HOJA_GAMEPLAY.state')
                # authority = the game's own score counter; the transient judgment banner is evidence only
                verdict = await page.evaluate("document.getElementById('hojaSoloJudgment')?.innerText||''")
                if after['correct'] != before['correct'] + 1:
                    await page.wait_for_timeout(1500)
                    ev = await page.evaluate('window.__ev.slice(-14)')
                    totals['verdictFail'] += 1; fails.append({'q': qid, 'verdict': verdict, 'before': before, 'after': after,
                        'final': await page.evaluate('window.HOJA_GAMEPLAY.state'), 'events': ev})
                await page.wait_for_function('()=>!window.HOJA_GAMEPLAY.state.activeQuiz', timeout=15000)
            for cq in cues:
                if cq.split(':')[0] == f.stem[4:] and cq not in seen: fails.append({'q': cq, 'cueQuestionNotShown': True})
            bad = [e for e in errs if 'Phaser' not in e and 'HojaSharedScene' not in e]
            if bad: fails.append({'unit': f.stem, 'jsErrors': bad[:3]})
            totals['units'] += 1
            print(f.stem[4:], json.dumps({k: totals[k] for k in ('questions', 'leaks', 'mappingFail', 'verdictFail')}), flush=True)
            await ctx.close()
        await b.close()
    print(json.dumps(totals, ensure_ascii=False))
    if fails:
        if a.fail_json: Path(a.fail_json).write_text(json.dumps(fails, ensure_ascii=False, indent=1))
        print('F3_HINT_MAPPING_FAIL ' + json.dumps(fails[:10], ensure_ascii=False)); sys.exit(1)
    print('F3_HINT_MAPPING_PASS')

asyncio.run(main())
