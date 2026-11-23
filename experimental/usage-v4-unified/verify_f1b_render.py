#!/usr/bin/env python3
"""F1-B local check (offline Chromium, every request aborted except data: URIs).
For every approved package question, render it in (a) the UNCHANGED bridge and (b) the composed
renderer (bridge + media extension). Questions without media[] must produce an IDENTICAL #screen
DOM (after the renderer's own 2-frame measurement). Questions with media[] must show every media
item in source order with its approved caption and every image decoded. Not a game E2E / GAS run.
Usage: python3 verify_f1b_render.py <payloads.json> <composed.html>"""
import asyncio, json, sys, hashlib
from pathlib import Path
from playwright.async_api import async_playwright
BRIDGE = (Path(__file__).resolve().parents[1] / 'unified-quiz-renderer' / 'HOJA_APPROVED_RENDERER_BRIDGE.html').read_text(encoding='utf-8')
UNITS = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
COMPOSED = Path(sys.argv[2]).read_text(encoding='utf-8')
SNAP = """async()=>{await HOJA_APPROVED_RENDERER.stable();const s=document.getElementById('screen');
 const m=document.getElementById('hqMedia');const imgs=[...m.querySelectorAll('img')];
 await Promise.all(imgs.map(i=>i.decode().catch(()=>null)));
 return {html:s.outerHTML,text:(s.innerText||'').trim().length,figs:m.querySelectorAll('figure').length,
  caps:[...m.querySelectorAll('figure>figcaption')].map(c=>c.textContent),
  imgs:imgs.length,loaded:imgs.filter(i=>i.complete&&i.naturalWidth>0).length,freq:m.querySelectorAll('.hojaFreq').length}}"""
async def page_for(b, html, vp):
    ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]})
    page = await ctx.new_page(); errs = []
    page.on('pageerror', lambda e: errs.append(str(e)[:120]))
    await page.route('**/*', lambda r: asyncio.ensure_future(r.continue_() if r.request.url.startswith('data:') else r.abort()))
    await page.set_content(html, wait_until='load')
    await page.evaluate('HOJA_APPROVED_RENDERER.embed()')
    return ctx, page, errs
async def main():
    results, ok = [], True
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        for vp in ((1920, 1080), (1280, 720), (1024, 768), (390, 844)):
            c1, p1, e1 = await page_for(b, BRIDGE, vp); c2, p2, e2 = await page_for(b, COMPOSED, vp)
            n = same = diff = media_ok = media_bad = blank = prof = 0; bad = []
            for u in UNITS:
                for p in (p1, p2): await p.evaluate('x=>HOJA_APPROVED_RENDERER.load(x)', u['payload'])
                for q in u['payload']['questions']:
                    arg = {'questionId': q['id'], 'mode': 'team' if q['type'] == 'SHORT' else 'solo'}
                    await p1.evaluate('a=>HOJA_APPROVED_RENDERER.show(a)', arg); await p2.evaluate('a=>HOJA_APPROVED_RENDERER.show(a)', arg)
                    a = await p1.evaluate(SNAP); c = await p2.evaluate(SNAP); n += 1
                    if c['text'] == 0: blank += 1
                    if q.get('displayProfile'):
                        prof += 1  # intentionally enhanced (approved display profile); parity checked by verify_f2_math_parity.py
                    elif q.get('media'):
                        exp_imgs = sum(1 for m in q['media'] if m['kind'] == 'image')
                        labels = [m['label'] for m in q['media'] if m.get('label')]
                        good = (c['figs'] == len(q['media']) and c['imgs'] == exp_imgs and c['loaded'] == exp_imgs and
                                all(l in c['caps'] for l in labels) and c['freq'] == sum(1 for m in q['media'] if m['kind'] == 'frequency'))
                        media_ok += good; media_bad += (not good)
                        if not good: bad.append(q['id'])
                    elif a['html'] == c['html']: same += 1
                    else: diff += 1; bad.append(q['id'])
            r = {'viewport': f'{vp[0]}x{vp[1]}', 'questions': n, 'noMediaIdenticalDom': same, 'noMediaDomDiffers': diff,
                 'profileQuestions': prof, 'mediaQuestionsOk': media_ok, 'mediaQuestionsBad': media_bad, 'blank': blank, 'jsErrors': (e1 + e2)[:5], 'bad': bad[:8]}
            results.append(r); print(json.dumps(r, ensure_ascii=False), flush=True)
            ok &= diff == 0 and media_bad == 0 and blank == 0 and not (e1 + e2)
            await c1.close(); await c2.close()
        await b.close()
    print('F1B_RENDER_' + ('PASS' if ok else 'FAIL')); sys.exit(0 if ok else 1)
asyncio.run(main())
