#!/usr/bin/env python3
"""Isolated team stability probe. Real pointer input; no production RPCs."""
import argparse, asyncio, json, time, traceback
from pathlib import Path
from playwright.async_api import async_playwright
from verify_f3_ui_e2e import STUB, backend, to_catalog, pick_unit, mode, approved_iframe
from verify_f3_team_full import answer

PROBE = r'''() => {
  const rows = window.__stability = [];
  const put = (kind, data={}) => { if (rows.length < 20000) rows.push({kind,t:performance.now(),...data}); };
  window.addEventListener('error', e => put('error',{message:e.message,source:e.filename,line:e.lineno,stack:e.error?.stack}));
  window.addEventListener('unhandledrejection', e => put('rejection',{message:String(e.reason),stack:e.reason?.stack}));
  const alert0=window.alert; window.alert=function(message){put('alert',{message:String(message),stack:new Error().stack});return alert0.apply(this,arguments)};
  try { new PerformanceObserver(list=>list.getEntries().forEach(e=>put('longtask',{duration:e.duration,start:e.startTime}))).observe({type:'longtask',buffered:true}); } catch(e) { put('observer-unavailable',{message:String(e)}); }
  let prev=performance.now(); function frame(now){if(now-prev>50)put('frame-gap',{duration:now-prev});prev=now;requestAnimationFrame(frame)} requestAnimationFrame(frame);
  window.addEventListener('message',e=>{if(e.data?.type?.startsWith('HOJA_UNIFIED'))put('iframe-message',{type:e.data.type,requestId:e.data.requestId})},true);
  const fetch0=window.fetch; window.fetch=function(...args){const start=performance.now();return fetch0.apply(this,args).then(r=>{put('fetch',{url:String(args[0]),duration:performance.now()-start,status:r.status});return r},e=>{put('fetch-error',{url:String(args[0]),duration:performance.now()-start,message:String(e)});throw e})};
  put('memory',{used:performance.memory?.usedJSHeapSize});
}'''

async def main():
    p=argparse.ArgumentParser(); p.add_argument('--html',required=True); p.add_argument('--phaser',required=True); p.add_argument('--github-packages',required=True); p.add_argument('--port',type=int,default=8790); p.add_argument('--units',required=True); p.add_argument('--channel',default=None); p.add_argument('--runs',type=int,default=10); a=p.parse_args()
    html=Path(a.html).read_text(encoding='utf-8').replace('<head>','<head>'+STUB.replace('PORT',str(a.port)),1); phaser=Path(a.phaser).read_bytes()
    uid=a.units; names={x['cartridgeId']:x['name'] for x in backend(a.port,'/rpc',{'fn':'hojaListPublicCartridges','args':[]})['v']}
    all_results=[]
    async with async_playwright() as pw:
      b=await pw.chromium.launch(headless=True,channel=a.channel,args=['--enable-unsafe-swiftshader'])
      print('BROWSER',json.dumps({'version':b.version,'channel':a.channel or 'chromium'}),flush=True)
      for run in range(a.runs):
        ctx=await b.new_context(viewport={'width':1280,'height':800}); await ctx.add_init_script('('+PROBE+')()'); page=await ctx.new_page(); dialogs=[]; errors=[]; step='setup'; result={'run':run+1}
        async def dialog(d):
          dialogs.append({'type':d.type,'message':d.message,'wallTime':time.time(),'step':step,'source':'javascript-dialog'}); await d.dismiss()
        page.on('dialog',lambda d: asyncio.create_task(dialog(d))); page.on('pageerror',lambda e: errors.append({'message':str(e),'step':step}))
        async def route(r):
          u=r.request.url
          if u==f'http://127.0.0.1:{a.port}/game.html': await r.fulfill(body=html,content_type='text/html; charset=utf-8')
          elif u.endswith('phaser.min.js'): await r.fulfill(body=phaser,content_type='application/javascript')
          elif u.startswith('https://raw.githubusercontent.com/xkdtndbrwk111-prog/HOJA-QUESTION-BANK/'):
            f=Path(a.github_packages)/u.split('/',6)[-1]; await r.fulfill(status=200 if f.is_file() else 404,body=f.read_bytes() if f.is_file() else b'',headers={'access-control-allow-origin':'*'})
          elif u.startswith(('data:',f'http://127.0.0.1:{a.port}')): await r.continue_()
          else: await r.abort()
        await page.route('**/*',route)
        try:
          await page.goto(f'http://127.0.0.1:{a.port}/game.html',wait_until='domcontentloaded',timeout=60000); await page.wait_for_timeout(5000)
          step='catalog'; await to_catalog(page); await pick_unit(page,names[uid]); step='five-player'; await mode(page,'함께 놀기','5'); await page.wait_for_timeout(2800)
          step='first-balloon'; start=time.perf_counter(); await page.locator('#htTeamBoard button.htBalloon:visible').first.click(timeout=20000)
          shown=await approved_iframe(page,1); assert shown['q'] and shown['n']>0,shown; result['firstQuestionMs']=(time.perf_counter()-start)*1000
          await page.evaluate('''()=>{window.__verdicts=[];window.__timing={};const t=window.__timing;
            const observe=()=>{const e=document.getElementById('hojaSoloJudgment');if(e&&e.getBoundingClientRect().width&&!t.verdict){t.verdict=performance.now();performance.mark('stability-verdict');window.__verdicts.push({node:e,text:e.innerText,t:t.verdict});requestAnimationFrame(()=>requestAnimationFrame(()=>{t.verdictPaint=performance.now();performance.mark('stability-verdict-paint');if(t.input)performance.measure('answer-to-verdict-paint','stability-input','stability-verdict-paint')}))}
            const p=document.querySelector('#htItemLayer .htPipeBtn');if(p&&p.getBoundingClientRect().width&&!t.pipe){t.pipe=performance.now();performance.mark('stability-pipe-visible');if(t.verdict)performance.measure('verdict-to-pipe','stability-verdict','stability-pipe-visible')}};
            new MutationObserver(observe).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','style','class']});
            const d=document.querySelector('iframe[id^="hojaTeamApproved"]').contentDocument;d.addEventListener('click',e=>{if(e.target.closest('button.hqChoice')&&!t.input){t.input=performance.now();performance.mark('stability-input')}},true);
          }''')
          step='answer'; start=time.perf_counter(); kind,correct=await answer(page,True); assert kind is not None, 'question not ready or answer unavailable'; result['answerInputMs']=(time.perf_counter()-start)*1000
          step='verdict'; await page.wait_for_function("window.__verdicts.some(v=>v.text.includes('정답'))",timeout=15000)
          step='pipe'; start=time.perf_counter(); pipe=page.locator('#htItemLayer .htPipeBtn:visible').first; await pipe.wait_for(state='visible',timeout=15000); result['pipeVisibleMs']=(time.perf_counter()-start)*1000; await pipe.click(timeout=10000)
          step='next-question'; start=time.perf_counter()
          for _ in range(8):
            if await page.locator('#htTeamBoard button.htBalloon:visible:not([disabled])').count() and not await page.locator('#htItemLayer:visible button:visible').count(): break
            buttons=page.locator('#htItemLayer button:visible'); n=await buttons.count()
            if n: await buttons.first.click(timeout=5000)
            await page.wait_for_timeout(500)
          await page.locator('#htTeamBoard button.htBalloon:visible:not([disabled])').first.click(timeout=15000); shown2=await approved_iframe(page,1); assert shown2['q']
          result.update({'nextQuestionMs':(time.perf_counter()-start)*1000,'status':'PASS','answerType':kind})
        except Exception as e:
          result.update({'status':'FAIL','step':step,'error':repr(e),'trace':traceback.format_exc()})
        try:
          result['events']=await page.evaluate('window.__stability||[]')
          result['timing']=await page.evaluate('window.__timing||{}')
          result['measures']=await page.evaluate("performance.getEntriesByType('measure').filter(x=>x.name.includes('verdict')).map(x=>({name:x.name,duration:x.duration}))")
        except Exception as e: result['eventReadError']=repr(e)
        result['dialogs']=dialogs; result['pageErrors']=errors
        if dialogs or errors: result['status']='FAIL'
        all_results.append(result); print('CASE',json.dumps(result,ensure_ascii=False),flush=True); await ctx.close()
      await b.close()
    passed=sum(x['status']=='PASS' for x in all_results); print('STABILITY_SUMMARY',json.dumps({'passed':passed,'total':len(all_results)}),flush=True)
    if passed!=len(all_results): raise SystemExit(1)

if __name__=='__main__': asyncio.run(main())

