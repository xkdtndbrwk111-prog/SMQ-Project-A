#!/usr/bin/env python3
"""40-6-U2 offline anonymous browser test for gas/Stats.html.

No Google login, no cookies, no network (every request is aborted). The page
is loaded in a fresh incognito-like Chromium context; google.script.run is a
stub that returns responses produced by the REAL gas/*.gs code on the
synthetic fixture (make_stats_payloads.mjs). This is NOT a real Apps Script
web-app e2e test.
Usage: python3 verify_stats_chromium.py <payloads.json>
"""
import asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright

HTML = Path(__file__).with_name('gas').joinpath('Stats.html').read_text(encoding='utf-8')
P = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))

STUB = """
window.__calls=[];
window.google={script:{run:(function(){
 function runner(ok,fail){return new Proxy({},{get:function(_t,name){
  if(name==='withSuccessHandler')return function(f){return runner(f,fail);};
  if(name==='withFailureHandler')return function(f){return runner(ok,f);};
  return function(){window.__calls.push({name:name,args:arguments.length});
   var r=window.__RESP;setTimeout(function(){if(r==='__FAIL__')fail(new Error('x'));else ok(JSON.parse(JSON.stringify(r)));},5);};
 }});}
 return runner(function(){},function(){});})()}};
"""

async def page_with(browser, resp, viewport):
    ctx = await browser.new_context(viewport=viewport)  # fresh context: no cookies/session
    page = await ctx.new_page()
    reqs, errors = [], []
    await page.route('**/*', lambda route: (reqs.append(route.request.url), asyncio.ensure_future(route.abort())))
    page.on('pageerror', lambda e: errors.append(str(e)))
    # set_content does not run init scripts: inject the stub as the first script
    stub = '<script>window.__RESP=' + json.dumps(resp).replace('</', '<\\/') + ';' + STUB + '</script>'
    await page.set_content(HTML.replace('<head>', '<head>' + stub, 1), wait_until='load')
    await page.wait_for_timeout(150)
    return ctx, page, reqs, errors

async def main():
    results = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=['--no-sandbox'])
        ok = P['ok']
        # 1) desktop happy path
        ctx, page, reqs, errors = await page_with(browser, ok, {'width': 1280, 'height': 900})
        calls = await page.evaluate('window.__calls')
        assert calls == [{'name': 'getPublicUsageStatisticsV4', 'args': 0}], calls
        t = ok['totals']
        for sel, v in (('#t-today', t['today']), ('#t-7', t['days7']), ('#t-30', t['days30']), ('#t-all', t['all'])):
            assert (await page.locator(sel).inner_text()) == f"{v:,}", sel
        assert await page.locator('#content').is_visible()
        assert not await page.locator('#error').is_visible()
        banner = await page.locator('#banner').inner_text()
        assert '잠정' in banner and '확정되지 않은 1일' in banner, banner
        n = len(ok['daily'])
        assert await page.locator('#chart rect').count() == 2 * n + 1  # bar + hit target (+pattern rect)
        assert await page.locator('#daily-table tr').count() == n
        prov_rows = await page.locator('#daily-table tr', has_text='잠정').count()
        assert prov_rows == len(ok['provisionalDays'])
        assert await page.locator('#top tr').count() == len(ok['topCartridges'])
        assert '개인전' in await page.locator('#l-mode').inner_text()
        assert '7팀전' in await page.locator('#l-team').inner_text()
        # hover tooltip on a bar
        box = await page.locator('#chart').bounding_box()
        await page.mouse.move(box['x'] + box['width'] - 10, box['y'] + box['height'] / 2)
        tip = await page.locator('#tip').inner_text()
        assert ok['daily'][-1]['date'] in tip and '잠정' in tip, tip
        # manual refresh throttled (button disabled for 10 s after a call)
        assert await page.locator('#refresh').is_disabled()
        assert reqs == [] and errors == [], (reqs, errors)
        await page.screenshot(path=str(Path(sys.argv[1]).with_name('stats_desktop.png')), full_page=True)
        results.append('desktop OK')
        await ctx.close()
        # 2) mobile: no horizontal overflow
        ctx, page, reqs, errors = await page_with(browser, ok, {'width': 375, 'height': 812})
        sw = await page.evaluate('document.documentElement.scrollWidth')
        assert sw <= 375, sw
        assert reqs == [] and errors == []
        await page.screenshot(path=str(Path(sys.argv[1]).with_name('stats_mobile.png')), full_page=True)
        results.append('mobile OK')
        await ctx.close()
        # 3) stale view is labelled
        ctx, page, reqs, errors = await page_with(browser, P['stale'], {'width': 1280, 'height': 900})
        assert '120초 전 집계' in await page.locator('#banner').inner_text()
        await ctx.close(); results.append('stale OK')
        # 4) failures never show numbers
        for key, code in (('integrity', 'INTEGRITY'), ('notConfigured', 'NOT_CONFIGURED'), ('__FAIL__', 'NETWORK')):
            resp = '__FAIL__' if key == '__FAIL__' else P[key]
            ctx, page, reqs, errors = await page_with(browser, resp, {'width': 1280, 'height': 900})
            assert await page.locator('#error').is_visible()
            assert code in await page.locator('#error').inner_text()
            assert not await page.locator('#content').is_visible()
            for sel in ('#t-today', '#t-7', '#t-30', '#t-all'):
                assert (await page.locator(sel).inner_text()) == '', sel
            assert reqs == [] and errors == [], (reqs, errors)
            await ctx.close(); results.append(f'{key} -> {code} OK')
        # 5) hostile label text is rendered as text, never markup
        evil = json.loads(json.dumps(ok))
        evil['topCartridges'][0]['label'] = '<img src=x onerror="window.__xss=1">'
        evil['subject'][0]['label'] = '<script>window.__xss=2</script>'
        ctx, page, reqs, errors = await page_with(browser, evil, {'width': 1280, 'height': 900})
        assert await page.evaluate('window.__xss') is None
        assert await page.locator('#top img').count() == 0
        assert '<img' in await page.locator('#top').inner_text()
        await ctx.close(); results.append('xss text-only OK')
        await browser.close()
    print('\n'.join(results))
    print('U2_STATS_CHROMIUM_PASS')

asyncio.run(main())
