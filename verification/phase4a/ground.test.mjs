import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const ctx={window:{},Math:Object.create(Math)};ctx.Math.random=()=>{throw Error('renderer must not use random');};vm.runInNewContext(await readFile(new URL('../../web/current/js/world/ground-autotile.js',import.meta.url),'utf8'),ctx);const a=ctx.window.HOJA_GROUND_AUTOTILE;const T=16;const rect=(x,y,w,h,extra={})=>({x:x*T,y:y*T,w:w*T,h:h*T,kind:'ground',...extra});
test('actual ground rectangles form padded columns without filling gaps or cave floors',()=>{const solids=[rect(0,10,2,8),rect(2,4,2,14),rect(6,12,2,6),rect(3,1,2,2,{kind:'platform'}),rect(4,16,2,2,{cave:true})],before=JSON.stringify(solids);const grid=a.fromSolids(solids);assert.equal(grid.heights[0],Infinity);assert.deepEqual(Array.from(grid.heights.slice(1,9)),[10,10,4,4,Infinity,Infinity,12,12]);assert.equal(JSON.stringify(solids),before);assert.equal(a.chooseTile(grid.heights,5,10),null);});
test('six to ten tile rise and drop keep vertical walls and the reference foot joins',()=>{const h=[10,10,4,4,14,14],up=a.walls(h);assert.equal(up[0].height,6);assert.equal(up[1].height,10);assert.deepEqual(Array.from(a.chooseTile(h,2,4)),[3,1]);assert.deepEqual(Array.from(a.chooseTile(h,2,9)),[3,2]);assert.deepEqual(Array.from(a.chooseTile(h,2,10)),[3,3]);assert.deepEqual(Array.from(a.chooseTile(h,3,13)),[5,2]);assert.deepEqual(Array.from(a.chooseTile(h,3,14)),[5,3]);});
test('soil variation is deterministic and geometry misalignment fails explicitly',()=>{assert.deepEqual(Array.from(a.soilTile(17,24)),Array.from(a.soilTile(17,24)));assert.throws(()=>a.fromSolids([{x:1,y:16,w:16,h:16,kind:'ground'}]),/GROUND_GRID_ALIGNMENT/);});
test('visual water extends under both banks and uses the lower bank without changing physics',()=>{const gap={leftX:100,rightX:220,leftTop:96,rightTop:144,surfaceY:160};const v=a.waterVisual(gap,32);assert.deepEqual(JSON.parse(JSON.stringify(v)),{left:68,right:252,width:184,surfaceY:144});assert.equal(gap.surfaceY,160);const reverse=a.waterVisual({...gap,leftTop:144,rightTop:96},32);assert.equal(reverse.surfaceY,144);});

test('Maker rectangles join cliffs and steps without filling stacked gaps',()=>{
 const rects=[{kind:'ground',x:0,y:10*16,w:5*16,h:8*16},{kind:'ground',x:5*16,y:4*16,w:3*16,h:14*16},{kind:'ground',x:10*16,y:10*16,w:4*16,h:8*16},{kind:'ground',x:11*16,y:2*16,w:2*16,h:2*16}];
 const g=a.fromRectangles(rects);
 assert.deepEqual(Array.from(g.tile(4,10)),[2,3]);
 assert.deepEqual(Array.from(g.tile(5,4)),[3,1]);
 assert.deepEqual(Array.from(g.tile(5,10)),[3,3]);
 assert.equal(g.tile(8,10),null);
 assert.ok(g.tile(11,2));
 assert.equal(g.tile(11,5),null);
 assert.ok(g.tile(11,10));
});

test('Maker narrow columns and suspended edges retain both outlines',()=>{
 const g=a.fromRectangles([rect(2,2,1,5),rect(0,4,2,2),rect(3,4,2,2)]);
 const parts=(x,y)=>Array.from(g.pieces(x,y),v=>Array.from(v));
 assert.deepEqual(parts(2,3),[[3,2],[5,2],[3,2],[5,2]],'one-column vertical section has both edges');
 assert.deepEqual(parts(0,5).slice(2),[[3,6],[4,6]],'exposed underside has a bottom outline');
 assert.equal(g.pieces(7,3),null,'empty space stays empty');
 const t=a.fromRectangles([rect(2,2,1,5),rect(0,4,2,3)]);
 assert.deepEqual(parts(2,4).length,4);
 assert.deepEqual(Array.from(t.pieces(2,4)[1]),[5,2],'exposed edge is kept at a one-sided junction');
 const strip=a.fromRectangles([rect(0,0,3,1)]);
 assert.deepEqual(Array.from(strip.pieces(1,0)[2]),[10,3],'one-tile-thick ledge has an underside');
});
