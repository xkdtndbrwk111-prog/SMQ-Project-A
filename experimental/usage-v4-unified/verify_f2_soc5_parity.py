#!/usr/bin/env python3
"""F2 local check: social 5-2 3-1/3-2 display parity between their APPROVED review page
(presentation/HOJA_SOC5_U3_1_U3_2_APPROVED_64Q_20261121.html inside the approved ZIP, renderer
v0.1.0-preview.2, run offline as-is) and the composed shared renderer (bridge v0.2 + extensions).
Compares question/choice DOM (inline styles stripped), stimulus panel and chosen layout per question.
Reports differences; it does not hide them. Usage: verify_f2_soc5_parity.py <qbank> <payloads.json> <composed.html>"""
import asyncio, json, sys, zipfile, glob
from pathlib import Path
from playwright.async_api import async_playwright
QB, PAY, COMP = sys.argv[1:4]
z = glob.glob(QB + '/approved/social/grade5/semester2/soc5-s2-u3-1-common/*.zip')[0]
APPROVED = zipfile.ZipFile(z).read('presentation/HOJA_SOC5_U3_1_U3_2_APPROVED_64Q_20261121.html').decode('utf-8')
UNITS = [u for u in json.loads(Path(PAY).read_text(encoding='utf-8')) if u['id'] in ('soc5-s2-u3-1-common', 'soc5-s2-u3-2-common')]
COMPOSED = Path(COMP).read_text(encoding='utf-8')
SNAP = """async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const s=document.getElementById('screen');
 const clean=h=>h.replace(/ style="[^"]*"/g,'');const st=document.getElementById('hqStimulus');const m=document.getElementById('hqMedia');
 return {q:clean(document.getElementById('hqQuestion').innerHTML),c:clean(document.getElementById('hqChoices').innerHTML),
  stim:st&&!st.hidden?clean(st.innerHTML):'',media:m&&!m.hidden?m.querySelectorAll('img').length:0,layout:s.dataset.layout,
  comp:document.getElementById('hqCard').dataset.composition||''}}"""
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True); ok = True
        for vp in ((1920, 1080), (1280, 720)):
            pages = []
            for html in (APPROVED, COMPOSED):
                c = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}); p = await c.new_page(); errs = []
                p.on('pageerror', lambda e, errs=errs: errs.append(str(e)[:120]))
                await p.route('**/*', lambda r: asyncio.ensure_future(r.continue_() if r.request.url.startswith('data:') else r.abort()))
                await p.set_content(html, wait_until='load'); pages.append((c, p, errs))
            ap, cp = pages[0][1], pages[1][1]
            await cp.evaluate('HOJA_APPROVED_RENDERER.embed()')
            n = 0; fields = {}; diffs = []
            for u in UNITS:
                await cp.evaluate('x=>HOJA_APPROVED_RENDERER.load(x)', u['payload'])
                for q in u['payload']['questions']:
                    mode = 'team' if q['type'] == 'SHORT' else 'solo'
                    await ap.evaluate("""([qid,mode])=>{state.version='concise';const q=DATA_CONCISE.find(x=>x.questionId===qid);state.unit=q.unit;
                        state.question=q.id;state.mode=mode;state.layout=defaultLayout(q);state.composition='auto';state.removed=null;renderQuestion();}""",
                        [q['questionId'], mode])
                    await cp.evaluate('a=>HOJA_APPROVED_RENDERER.show(a)', {'questionId': q['id'], 'mode': mode})
                    a = await ap.evaluate(SNAP); c = await cp.evaluate(SNAP); n += 1
                    d = [k for k in a if a[k] != c[k]]
                    for k in d: fields[k] = fields.get(k, 0) + 1
                    if d: diffs.append({'q': q['questionId'].split(':')[0][-8:] + ':' + q['localId'], 'fields': d,
                                        'layout': [a['layout'], c['layout']], 'comp': [a['comp'], c['comp']]})
            r = {'viewport': f'{vp[0]}x{vp[1]}', 'questions': n, 'equal': n - len(diffs), 'differ': len(diffs), 'differingFields': fields,
                 'examples': diffs[:5], 'jsErrorsApproved': pages[0][2][:2], 'jsErrorsComposed': pages[1][2][:2]}
            print(json.dumps(r, ensure_ascii=False), flush=True)
            ok &= not diffs and not pages[1][2]
            for c, _, _ in pages: await c.close()
        await b.close()
    print('F2_SOC5_PARITY_' + ('PASS' if ok else 'DIFFERS_REPORTED')); sys.exit(0)
asyncio.run(main())
