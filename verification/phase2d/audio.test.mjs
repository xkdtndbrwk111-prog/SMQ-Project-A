import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../phase2/harness/node_modules/playwright/index.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=path.join(root,'dist-current');
const ids=['hojaBgm','hojaTrackMeadow','hojaTrackAfternoon'];
test('shared music is byte-identical to baseline and playable',async()=>{
 const baseline=execFileSync('git',['show','7b599b7:web/current/index.html'],{cwd:root,maxBuffer:8*1024*1024,encoding:'utf8'});
 const current=await readFile(path.join(dir,'index.html'),'utf8'),student=await readFile(path.join(dir,'play.html'),'utf8');
 for(const id of ids){
  const before=baseline.match(new RegExp(`<audio id="${id}"[^>]*src="data:audio/ogg;base64,([^"]+)"`));
  const after=current.match(new RegExp(`<audio id="${id}"[^>]*src="([^"]+)"`));
  assert.ok(before&&after);assert.ok(student.includes(after[1]));
  const bytes=await readFile(path.join(dir,after[1]));
  assert.deepEqual(bytes,Buffer.from(before[1],'base64'));
  assert.ok(after[1].includes(createHash('sha256').update(bytes).digest('hex').slice(0,16)));
 }
 const server=createServer(async(req,res)=>{try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';const file=path.resolve(dir,name);
  if(!file.startsWith(dir+path.sep))throw Error('invalid path');const bytes=await readFile(file);
  res.setHeader('Content-Type',name.endsWith('.ogg')?'audio/ogg':name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':'text/html; charset=utf-8');
  if(req.headers.range){const m=req.headers.range.match(/^bytes=(\d+)-(\d*)$/);if(m){const a=Number(m[1]),b=m[2]?Number(m[2]):bytes.length-1;res.writeHead(206,{'Accept-Ranges':'bytes','Content-Range':`bytes ${a}-${b}/${bytes.length}`,'Content-Length':b-a+1});return res.end(bytes.subarray(a,b+1));}}
  res.end(bytes);
 }catch{res.writeHead(404).end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
  for(const id of ids){const result=await page.evaluate(async id=>{const a=document.getElementById(id);a.muted=true;await a.play();await new Promise(r=>setTimeout(r,350));const result={time:a.currentTime,ready:a.readyState,error:a.error?.code||null};a.pause();return result},id);assert.equal(result.error,null);assert.ok(result.ready>=2&&result.time>0,`${id}: ${JSON.stringify(result)}`)}
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
