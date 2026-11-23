import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from '../phase2/harness/node_modules/playwright/index.mjs';
const root=path.resolve(fileURLToPath(new URL('../../dist-current-test/',import.meta.url)));
test('marquee selection moves, duplicates and deletes a mixed group with undo',async()=>{
 const server=createServer(async(req,res)=>{try{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname));if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.png':'image/png'})[path.extname(f)]||'text/html');res.end(await readFile(f))}catch{res.writeHead(404).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
  const p=await browser.newPage({viewport:{width:1440,height:900}});p.on('dialog',d=>d.accept());await p.goto(`http://127.0.0.1:${server.address().port}/maker-compat.html`);await p.locator('#newProject').click();
  await p.evaluate(()=>{zoom=1;view={x:0,y:0};map().terrain.push({id:'test-terrain',x:5,y:6,w:3,h:1,kind:'platform'});map().objects.push({id:'test-enemy',type:'enemy',x:10,y:6,w:2,h:2,enemyType:'JUMPY',patrol:{mode:'pingpong',waypoints:[{x:10,y:6},{x:14,y:6}],speed:80}});render()});
  const box=await p.locator('#cv').boundingBox(),pt=(x,y)=>({x:box.x+x*16+3,y:box.y+y*16+3});
  await p.locator('#pickTool').click();await p.mouse.move(pt(3,4).x,pt(3,4).y);await p.mouse.down();await p.mouse.move(pt(13,10).x,pt(13,10).y,{steps:5});await p.mouse.up();
  assert.deepEqual((await p.evaluate(()=>[...selectedIds].sort())),['test-enemy','test-terrain']);assert.match(await p.locator('#props').innerText(),/2개 선택됨/);
  const bounds=await p.evaluate(()=>groupBounds(groupObjects())),center=await p.evaluate(b=>toScreen((b.left+b.right)/2,(b.top+b.bottom)/2),bounds);await p.mouse.move(box.x+center[0],box.y+center[1]);await p.mouse.down();await p.mouse.move(box.x+center[0]+64,box.y+center[1]+48,{steps:5});await p.mouse.up();
  const moved=await p.evaluate(()=>groupObjects().map(o=>({id:o.id,x:o.x,y:o.y,patrol:o.patrol})));assert.deepEqual(moved.map(o=>[o.x,o.y]),[[9,9],[14,9]]);assert.equal(moved[1].patrol.waypoints[1].x,18);
  await p.locator('#duplicate').click();assert.equal(await p.evaluate(()=>groupObjects().length),2);assert.deepEqual(await p.evaluate(()=>groupObjects().map(o=>[o.x,o.y])),[[11,11],[16,11]]);assert.equal(await p.evaluate(()=>map().objects.length),2);
  await p.locator('#deleteSelected').click();assert.equal(await p.evaluate(()=>map().objects.length),1);assert.equal(await p.evaluate(()=>map().terrain.length),2);
  await p.locator('#undo').click();assert.equal(await p.evaluate(()=>map().objects.length),2);assert.equal(await p.evaluate(()=>map().terrain.length),3);
  await p.evaluate(()=>{clearGroup();selectedId=null;zoom=.3;view={x:0,y:0};render()});const resizeBox=await p.locator('#cv').boundingBox();let anchor=await p.evaluate(()=>mapResizeHandles().right);assert.ok(anchor,'right resize handle visible');await p.mouse.move(resizeBox.x+anchor[0],resizeBox.y+anchor[1]);await p.mouse.down();await p.mouse.move(resizeBox.x+anchor[0]+48,resizeBox.y+anchor[1],{steps:5});await p.mouse.up();assert.equal(await p.evaluate(()=>map().width),138);assert.equal(await p.evaluate(()=>map().objects.length),2);
  anchor=await p.evaluate(()=>mapResizeHandles().bottom);assert.ok(anchor,'bottom resize handle visible');await p.mouse.move(resizeBox.x+anchor[0],resizeBox.y+anchor[1]);await p.mouse.down();await p.mouse.move(resizeBox.x+anchor[0],resizeBox.y+anchor[1]+48,{steps:5});await p.mouse.up();assert.equal(await p.evaluate(()=>map().height),42);
  await p.evaluate(()=>{map().theme='cave';drawProps()});const limits=await p.evaluate(()=>mapResizeLimits(map()));assert.ok(limits.width<=256&&limits.height<=128);await p.locator('#mw').fill('9999');await p.locator('#mw').press('Tab');assert.equal(await p.evaluate(()=>map().width),limits.width);assert.match(await p.locator('#status').innerText(),/한계점/);await p.locator('#mw').fill('32');await p.locator('#mw').press('Tab');assert.equal(await p.evaluate(()=>map().width),128,'ground not truncated by shrinking');
  await p.evaluate(()=>{map().theme='grassland';map().height=32;map().parallaxAnchorY=map().spawn.y;zoom=.3;view={x:0,y:0};drawProps();render()});let left=await p.evaluate(()=>mapResizeHandles().left);let first=await p.evaluate(()=>({spawn:{...map().spawn},obj:{x:map().objects[0].x,y:map().objects[0].y},anchor:map().parallaxAnchorY}));await p.mouse.move(resizeBox.x+left[0],resizeBox.y+left[1]);await p.mouse.down();await p.mouse.move(resizeBox.x+left[0]-48,resizeBox.y+left[1],{steps:5});await p.mouse.up();assert.equal(await p.evaluate(()=>map().width),138);assert.equal(await p.evaluate(()=>map().objects[0].x),first.obj.x+10);assert.equal(await p.evaluate(()=>map().spawn.x),first.spawn.x+10);assert.equal(await p.evaluate(()=>map().parallaxAnchorY),first.anchor);
  const top=await p.evaluate(()=>mapResizeHandles().top);await p.mouse.move(resizeBox.x+top[0],resizeBox.y+top[1]);await p.mouse.down();await p.mouse.move(resizeBox.x+top[0],resizeBox.y+top[1]-48,{steps:5});await p.mouse.up();assert.equal(await p.evaluate(()=>map().height),42);assert.equal(await p.evaluate(()=>map().objects[0].y),first.obj.y+10);assert.equal(await p.evaluate(()=>map().spawn.y),first.spawn.y+10);assert.equal(await p.evaluate(()=>map().parallaxAnchorY),first.anchor+10);


 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
});
