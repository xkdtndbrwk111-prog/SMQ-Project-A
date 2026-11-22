#!/usr/bin/env python3
"""Local-only anonymous HOJA aggregate dashboard smoke; no live sheets or RPC."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright

HTML=Path(__file__).with_name('HOJA_USAGE_RETENTION_DASHBOARD_TRIAL.html')

async def main():
 assert HTML.is_file()
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1280,'height':800})
  requests=[]
  page.on('request',lambda request:requests.append(request.url))
  errors=[]
  page.on('pageerror',lambda ex:errors.append(str(ex)))
  await page.set_content(HTML.read_text(encoding='utf-8'),wait_until='load')
  await page.locator('#example').click()
  assert await page.locator('#starts').inner_text()=='14'
  assert await page.locator('#done').inner_text()=='7'
  assert await page.locator('#timedout').inner_text()=='2'
  assert await page.locator('#unknown').inner_text()=='5'
  assert await page.locator('#units tr').count()==3
  assert await page.locator('#days .day').count()==3
  assert '가상' in await page.locator('#status').inner_text()
  payload={
   'schema':'HOJA_USAGE_RETENTION_V1','source':'TRIAL_COPY_ONLY',
   'totals':[{'date':'2026-11-22','gameId':'HOJA_ARCADE','mode':'SOLO',
    'starts':3,'completed':1,'timeUp':0,'unknownEnded':2}],
   'dimensions':[{'gameId':'HOJA_ARCADE',
    'cartridgeId':'<img src=x onerror=alert(1)>','starts':2}]
  }
  await page.locator('#file').set_input_files({
   'name':'aggregates.json','mimeType':'application/json',
   'buffer':json.dumps(payload,ensure_ascii=False).encode('utf-8')
  })
  assert await page.locator('#starts').inner_text()=='3'
  assert await page.locator('#units tr').count()==1
  assert '<img src=x' in await page.locator('#units tr').first.inner_text()
  assert await page.locator('#units img').count()==0,'Unsafe HTML injection'
  assert await page.locator('#status').inner_text()!=''
  await page.locator('#file').set_input_files({
   'name':'wrong.json','mimeType':'application/json','buffer':b'{"schema":"WRONG"}'
  })
  assert '불러오기 실패' in await page.locator('#status').inner_text()
  assert not requests,requests
  assert not errors,errors
  print('HOJA_ANONYMOUS_DASHBOARD_OFFLINE_CHROMIUM_PASS',flush=True)
  await browser.close()

if __name__=='__main__':asyncio.run(main())
