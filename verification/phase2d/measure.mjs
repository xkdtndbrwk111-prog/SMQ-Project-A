import {chromium} from '../phase2/harness/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url)), dir=path.join(root,'dist-current');
const server=createServer(async(req,res)=>{try{
 const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).slice(1)||'index.html';
 const file=path.resolve(dir,name);if(!file.startsWith(dir+path.sep))throw Error('bad path');
 const data=await readFile(file),ext=path.extname(file);
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.ogg':'audio/ogg','.png':'image/png'})[ext]||'application/octet-stream');
 res.setHeader('Cache-Control',ext==='.html'||name==='BUILD.json'?'no-cache':'public, max-age=3600');
 if(process.env.HOJA_MEASURE_GZIP==='1'&&/\.(html|js|json|css)$/.test(name)&&/gzip/.test(req.headers['accept-encoding']||'')){res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding');res.end(gzipSync(data))}else res.end(data);
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
const out={method:`Chrome CDP encodedDataLength; loopback server ${process.env.HOJA_MEASURE_GZIP==='1'?'gzip text':'uncompressed'}, HTML no-cache, other files max-age=3600; CDN uses its own headers; fixed Math.random seed 314159 for comparable track choice; warm is same browser context`,build:JSON.parse(await readFile(path.join(dir,'BUILD.json'),'utf8')).gameVersion,files:{},runs:[]};
async function walk(d,prefix=''){for(const x of await readdir(d,{withFileTypes:true})){const n=path.posix.join(prefix,x.name);if(x.isDirectory())await walk(path.join(d,x.name),n);else out.files[n]=(await stat(path.join(d,x.name))).size}}
await walk(dir);
async function run(kind,context,warm){
 const page=await context.newPage(),cdp=await context.newCDPSession(page), entries=new Map(), failures=[],errors=[];
 await page.addInitScript(()=>{let x=314159;Math.random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296}});
 page.on('requestfailed',r=>failures.push(r.url()+': '+r.failure()?.errorText));page.on('pageerror',e=>errors.push(String(e)));
 await cdp.send('Network.enable');
 cdp.on('Network.requestWillBeSent',e=>{if(!e.request.url.startsWith('data:'))entries.set(e.requestId,{url:e.request.url,type:e.type,bytes:0,cache:false})});
 cdp.on('Network.requestServedFromCache',e=>{const v=entries.get(e.requestId);if(v)v.cache=true});
 cdp.on('Network.responseReceived',e=>{const v=entries.get(e.requestId);if(v){v.status=e.response.status;v.cache||=e.response.fromDiskCache||e.response.fromServiceWorker}});
 cdp.on('Network.loadingFinished',e=>{const v=entries.get(e.requestId);if(v)v.bytes=e.encodedDataLength});
 let t=performance.now();
 if(kind==='teacher'){
 await page.goto(base+'/',{waitUntil:'load'});const pageLoadMs=performance.now()-t;
 for(let i=0;i<3;i++)await page.locator('#frame').click();
 await page.getByRole('button',{name:'5학년'}).click();await page.getByRole('button',{name:'사회 2개 카트리지'}).click();
 await page.getByRole('button',{name:'조선 시대의 유교 문화 (시험 A) PAK 01'}).click();
 await page.getByRole('button',{name:/혼자 아케이드 선택한/}).click();
 t=performance.now();await page.getByRole('button',{name:/바로 플레이/}).click();
 await page.frameLocator('#hqArcadeFrame').locator('#scoreHud').waitFor({state:'visible',timeout:30000});
 const frame=page.frames().find(f=>f.url().includes('/arcade.html'));await frame.waitForFunction(()=>document.querySelector('#bootStatus.hidden')&&document.querySelector('#phaserRoot canvas'),null,{timeout:30000});
 out.runs.push({kind,warm,pageLoadMs,sceneReadyMs:performance.now()-t});
 }else{
 const qs=new URLSearchParams({m:'s',c:'test-joseon-a',cv:'19065b1d0fc5',gv:out.build,s:'spring'});
 await page.goto(base+'/play.html?'+qs,{waitUntil:'load'});const pageLoadMs=performance.now()-t;
 t=performance.now();await page.locator('#hojaStudentStart:not([disabled])').click({timeout:30000});
 await page.frameLocator('#hqArcadeFrame').locator('#scoreHud').waitFor({state:'visible',timeout:30000});
 const frame=page.frames().find(f=>f.url().includes('/arcade.html'));await frame.waitForFunction(()=>document.querySelector('#bootStatus.hidden')&&document.querySelector('#phaserRoot canvas'),null,{timeout:30000});
 out.runs.push({kind,warm,pageLoadMs,sceneReadyMs:performance.now()-t});
 }
 await page.waitForTimeout(500);const items=[...entries.values()];const result=out.runs.at(-1);
 Object.assign(result,{requests:items.length,transferredBytes:items.reduce((s,e)=>s+e.bytes,0),cached:items.filter(e=>e.cache).length,resources:items,failures,errors});
 assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);await page.close();
}
try{for(const kind of ['teacher','student']){const ctx=await browser.newContext();await run(kind,ctx,false);await run(kind,ctx,true);await ctx.close()}
 const name=process.argv[2];if(!/^[a-z0-9-]+$/.test(name||''))throw Error('측정 이름 필요');await writeFile(path.join(root,'verification/phase2d',name+'.json'),JSON.stringify(out,null,2)+'\n');
 console.log(JSON.stringify(out.runs.map(({resources,...r})=>r),null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
