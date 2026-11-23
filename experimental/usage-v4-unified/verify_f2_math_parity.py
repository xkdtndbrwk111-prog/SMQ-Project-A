#!/usr/bin/env python3
"""F2 local check: math display parity between the APPROVED math review HTML (HOJA-QUESTION-BANK,
run offline as-is) and the composed shared renderer (bridge + media ext + math ext) fed the math
packages. Per question (both pages same viewport, same version/mode): #hqQuestion and #hqChoices
DOM, the #screen math flags and the chosen A/C/D layout must be equal. Not pixel parity: the two
pages' base CSS builds differ. Usage: python3 verify_f2_math_parity.py <qbank> <payloads.json> <composed.html>"""
import asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright
QB, PAY, COMP = sys.argv[1:4]
APPROVED = (Path(QB) / 'approved/math/grade5-6/semester2/HOJA_MATH_187_APPROVED_REVIEW_UI4_20261122.html').read_text(encoding='utf-8')
UNITS = [u for u in json.loads(Path(PAY).read_text(encoding='utf-8')) if u['payload']['questions'][0].get('displayProfile')]
COMPOSED = Path(COMP).read_text(encoding='utf-8')
SNAP = """async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const s=document.getElementById('screen');
 const clean=h=>h.replace(/ style="[^"]*"/g,'');
 return {q:clean(document.getElementById('hqQuestion').innerHTML),c:clean(document.getElementById('hqChoices').innerHTML),
  flags:[s.dataset.mathGridChoice||'',s.dataset.mathPartGrid||'',s.dataset.mathReviewLines||''].join('|'),layout:s.dataset.layout,
  fr:document.querySelectorAll('#hqQuestion .hoja-fraction,#hqChoices .hoja-fraction').length,
  im:document.querySelectorAll('#hqQuestion .hoja-inline-math,#hqChoices .hoja-inline-math').length}}"""
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True); res = []; ok = True
        for vp in ((1920, 1080), (1280, 720)):
            pages = []
            for html in (APPROVED, COMPOSED):
                c = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}); p = await c.new_page(); errs = []
                p.on('pageerror', lambda e, errs=errs: errs.append(str(e)[:120]))
                await p.route('**/*', lambda r: asyncio.ensure_future(r.continue_() if r.request.url.startswith('data:') else r.abort()))
                await p.set_content(html, wait_until='load'); pages.append((c, p, errs))
            ap, cp = pages[0][1], pages[1][1]
            await cp.evaluate('HOJA_APPROVED_RENDERER.embed()')
            n = eq = 0; diffs = []; fr = im = 0
            for u in UNITS:
                await cp.evaluate('x=>HOJA_APPROVED_RENDERER.load(x)', u['payload'])
                for q in u['payload']['questions']:
                    mode = 'team' if q['type'] == 'SHORT' else 'solo'
                    await ap.evaluate("""([id,mode])=>{state.version='concise';const q=DATA_CONCISE.find(x=>x.id===id);state.unit=q.unit;state.question=id;
                        state.mode=mode;state.layout=defaultLayout(q);state.composition='auto';state.removed=null;renderQuestion();}""", [q['id'], mode])
                    await cp.evaluate('a=>HOJA_APPROVED_RENDERER.show(a)', {'questionId': q['id'], 'mode': mode})
                    a = await ap.evaluate(SNAP); c = await cp.evaluate(SNAP); n += 1
                    fr += c['fr']; im += c['im']
                    if a == c: eq += 1
                    else: diffs.append({'id': q['id'], 'fields': [k for k in a if a[k] != c[k]]})
            r = {'viewport': f'{vp[0]}x{vp[1]}', 'mathQuestions': n, 'domEqual': eq, 'differ': len(diffs), 'fractionsRendered': fr,
                 'inlineMathRendered': im, 'diffs': diffs[:6], 'jsErrorsApproved': pages[0][2][:3], 'jsErrorsComposed': pages[1][2][:3]}
            print(json.dumps(r, ensure_ascii=False), flush=True); res.append(r)
            ok &= not diffs and not pages[1][2]
            for c, _, _ in pages: await c.close()
        await b.close()
    print('F2_MATH_PARITY_' + ('PASS' if ok else 'FAIL')); sys.exit(0 if ok else 1)
asyncio.run(main())
