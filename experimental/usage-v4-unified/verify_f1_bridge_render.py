#!/usr/bin/env python3
"""F1 local check: every READY approved package loads into the EXISTING bridge renderer
(HOJA_APPROVED_RENDERER_BRIDGE.html, unchanged) and every question can be shown.
Offline Chromium, all network aborted. Not a game E2E and not a GAS run.
Usage: python3 verify_f1_bridge_render.py <payloads.json from f1_real_content_probe.mjs>"""
import asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright
BRIDGE = Path(__file__).resolve().parents[1] / 'unified-quiz-renderer' / 'HOJA_APPROVED_RENDERER_BRIDGE.html'
UNITS = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
async def main():
    out = []
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        for size in ((1920, 1080), (1280, 720), (1024, 768)):
            ctx = await b.new_context(viewport={'width': size[0], 'height': size[1]})
            page = await ctx.new_page(); errors = []
            page.on('pageerror', lambda e: errors.append(str(e)[:120]))
            await page.route('**/*', lambda r: asyncio.ensure_future(r.abort()) if not r.request.url.startswith('data:') else asyncio.ensure_future(r.continue_()))
            await page.set_content(BRIDGE.read_text(encoding='utf-8'), wait_until='load')
            await page.evaluate('HOJA_APPROVED_RENDERER.embed()')
            shown = imgs = blank = 0; types = {}
            for u in UNITS:
                r = await page.evaluate("p=>HOJA_APPROVED_RENDERER.load(p)", u['payload'])
                assert r['count'] == len(u['payload']['questions']), u['id']
                for q in u['payload']['questions']:
                    mode = 'team' if q['type'] == 'SHORT' else 'solo'
                    await page.evaluate("a=>HOJA_APPROVED_RENDERER.show(a)", {'questionId': q['id'], 'mode': mode})
                    st = await page.evaluate("""()=>{const s=document.getElementById('screen');
                      const im=[...s.querySelectorAll('img')];
                      return {text:(s.innerText||'').trim().length, imgs:im.length, loaded:im.filter(i=>i.complete&&i.naturalWidth>0).length}}""")
                    shown += 1; types[q['type']] = types.get(q['type'], 0) + 1
                    if st['text'] == 0: blank += 1
                    if q['image'] and st['loaded'] < 1: imgs += 1
            out.append({'viewport': f'{size[0]}x{size[1]}', 'units': len(UNITS), 'shown': shown, 'types': types,
                        'blankScreens': blank, 'questionImagesNotRendered': imgs, 'jsErrors': errors[:5]})
            await ctx.close()
        await b.close()
    for o in out: print(json.dumps(o, ensure_ascii=False))
    ok = all(o['blankScreens'] == 0 and o['questionImagesNotRendered'] == 0 and not o['jsErrors'] and o['shown'] == 498 for o in out)
    print('F1_BRIDGE_RENDER_' + ('PASS' if ok else 'FAIL')); sys.exit(0 if ok else 1)
asyncio.run(main())
