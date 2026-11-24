/**
 * HOJA Ground AutoTile v0.2 — solid earth, vertical cliffs enabled.
 * GrafxKid Seasonal Tilesets: 16×16, 17 atlas columns, same layout in 4 seasons.
 * Heights are INTEGER y-rows (smaller = higher) for each x-column.
 * Every [x,y] where y>=height[x] is solid. No platforms, caves, holes, or physics.
 * A cliff is adjacent columns with arbitrary difference in top row.
 * Cliff foot joints use source atlas's (3,3)/(5,3) inner earth corners and
 * (2,3)/(6,3) ground-top transition caps. Never bridge via 1-step slopes.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports) module.exports=api;
 else root.HOJA_GROUND_AUTOTILE=api;
})(typeof window!=='undefined'?window:globalThis, function(){
 'use strict';
 const TILE_SIZE=16, ATLAS_COLUMNS=17;
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 const hash=(a,b)=>((Math.imul(a+13,198491317)^Math.imul(b+3,6542989))>>>0);
 function filled(heights,x,row){
  const idx=clamp(x,0,heights.length-1);
  return row>=heights[idx];
 }
 function chooseTile(heights,x,row,seedIndex=x){
  if(!Array.isArray(heights)||!Number.isInteger(x)||x<0||x>=heights.length)return null;
  const top=heights[x];
  if(!Number.isInteger(top)||row<top)return null;
  const L=heights[clamp(x-1,0,heights.length-1)];
  const R=heights[clamp(x+1,0,heights.length-1)];
  const leftOpen=row<L, rightOpen=row<R;
  const seed=hash(seedIndex,Math.floor(row/2));
  if(row===top){
   // Taller neighbor is immediately beside this lower floor at a cliff foot.
   if(L<top&&R<top)return [4,1]; // narrow valley: full opaque surface
   if(L<top)return [6,3];       // right-hand bottom floor at a drop
   if(R<top)return [2,3];       // left-hand bottom floor before a rise
   if(leftOpen&&rightOpen)return [11,1]; // one-column crest
   if(leftOpen)return [3,1];    // high ledge, exposed left upper cap
   if(rightOpen)return [5,1];   // high ledge, exposed right upper cap
   // All chosen surfaces below are full-width, opaque (no gaps).
   return [4,1];
  }
  // Explicit junction at the foot of a vertical face (height delta can be >1).
  if(L===row&&L>top)return [3,3];  // low left floor connects into tall right wall
  if(R===row&&R>top)return [5,3];  // tall left wall connects into low right floor
  if(leftOpen&&rightOpen)return [11,2];
  if(leftOpen)return [3,2];       // left wall shaft
  if(rightOpen)return [5,2];      // right wall shaft
  // Deep, completely solid earth; avoid transparent edge/bottom atlas variants.
  const soil=[[4,2],[4,3],[4,4],[4,5]];
  return soil[seed%soil.length];
 }
 function validate(heights,{minTop=3,maxTop=15,rows=17}={}){
  const errors=[];
  if(!Array.isArray(heights)||!heights.length)return {ok:false,errors:['HEIGHTMAP_MISSING'],solidTiles:0,steps:0,cliffs:0,maxDrop:0,width:0,holes:0,floating:0};
  let solidTiles=0,steps=0,cliffs=0,maxDrop=0;
  for(let x=0;x<heights.length;x++){
   const row=heights[x];
   if(!Number.isInteger(row)||row<minTop||row>maxTop||row>=rows)errors.push(`HEIGHT_RANGE:${x}`);
   else solidTiles+=rows-row;
   if(x>0&&Number.isInteger(row)&&Number.isInteger(heights[x-1])){
    const delta=Math.abs(row-heights[x-1]);
    if(delta){steps++; if(delta>=2)cliffs++; maxDrop=Math.max(maxDrop,delta);}
   }
  }
  return {ok:errors.length===0,errors,solidTiles,steps,cliffs,maxDrop,width:heights.length,holes:0,floating:0};
 }
 // Edit a contiguous, ground-attached run of columns. NO smoothing propagation.
 function paint(heights,target,delta,{minTop=3,maxTop=15,brushWidth=8}={}){
  if(!Array.isArray(heights)||!heights.length)return [];
  const out=heights.slice();
  const c=clamp(Math.round(target),0,out.length-1);
  const n=clamp(Math.floor(brushWidth)||1,1,out.length);
  const start=clamp(c-Math.floor(n/2),0,out.length-n);
  const amount=Number.isFinite(delta)?Math.trunc(delta):0;
  for(let x=start;x<start+n;x++)out[x]=clamp(out[x]+amount,minTop,maxTop);
  return out;
 }
 function walls(heights){
  if(!Array.isArray(heights))return [];
  const result=[];
  for(let x=1;x<heights.length;x++){
   const left=heights[x-1],right=heights[x];
   if(!Number.isInteger(left)||!Number.isInteger(right)||left===right)continue;
   result.push({x,left,right,direction:right>left?'drop':'rise',height:Math.abs(right-left)});
  }
  return result;
 }
 // Convert the existing collision rectangles to a padded surface height map.
 // Gaps stay empty (Infinity); cave floors are separate layers, never filled in.
 function fromSolids(solids){
  const ground=solids.filter(s=>s.kind==='ground'&&!s.cave&&s.w>0&&s.h>0);
  if(!ground.length)return {min:0,heights:[]};
  for(const s of ground)if(![s.x,s.y,s.w,s.h].every(v=>Number.isFinite(v)&&Math.abs(v/TILE_SIZE-Math.round(v/TILE_SIZE))<1e-6))throw Error('GROUND_GRID_ALIGNMENT');
  const min=Math.min(...ground.map(s=>Math.round(s.x/TILE_SIZE)))-1;
  const end=Math.max(...ground.map(s=>Math.round((s.x+s.w)/TILE_SIZE)))+1;
  const heights=Array(end-min).fill(Infinity);
  for(const s of ground){const first=Math.round(s.x/TILE_SIZE)-min,last=Math.round((s.x+s.w)/TILE_SIZE)-min,top=Math.round(s.y/TILE_SIZE);for(let x=first;x<last;x++)heights[x]=Math.min(heights[x],top);}
  return {min,heights};
 }
 // Maker maps can contain stacked/disconnected solid rectangles in one column.
 // Keep the real occupied intervals instead of filling gaps below the topmost one.
 function fromRectangles(solids){
  const ground=solids.filter(s=>s.kind==='ground'&&!s.cave&&s.w>0&&s.h>0);
  if(!ground.length)return {min:0,tile:()=>null};
  for(const s of ground)if(![s.x,s.y,s.w,s.h].every(v=>Number.isFinite(v)&&Math.abs(v/TILE_SIZE-Math.round(v/TILE_SIZE))<1e-6))throw Error('GROUND_GRID_ALIGNMENT');
  const min=Math.min(...ground.map(s=>Math.round(s.x/TILE_SIZE)))-1,end=Math.max(...ground.map(s=>Math.round((s.x+s.w)/TILE_SIZE)))+1,columns=Array.from({length:end-min},()=>[]);
  for(const s of ground){const left=Math.round(s.x/TILE_SIZE)-min,right=Math.round((s.x+s.w)/TILE_SIZE)-min,top=Math.round(s.y/TILE_SIZE),bottom=Math.round((s.y+s.h)/TILE_SIZE);for(let x=left;x<right;x++)columns[x].push([top,bottom]);}
  for(let x=0;x<columns.length;x++){const sorted=columns[x].sort((a,b)=>a[0]-b[0]),merged=[];for(const part of sorted){const last=merged[merged.length-1];if(last&&part[0]<=last[1])last[1]=Math.max(last[1],part[1]);else merged.push([...part]);}columns[x]=merged;}
  function heightAt(index,row){const col=columns[index];if(!col)return Infinity;for(const [top,bottom] of col){if(row<bottom)return top;}return Infinity;}
  return {min,tile(worldColumn,row){const i=worldColumn-min,center=heightAt(i,row);if(!Number.isInteger(center)||row<center)return null;return chooseTile([heightAt(i-1,row),center,heightAt(i+1,row)],1,row,i);}};
 }
 function soilTile(x,row){const soil=[[4,2],[4,3],[4,4],[4,5]];return soil[hash(x,Math.floor(row/2))%soil.length];}
 function waterVisual(g,overlap=TILE_SIZE*2){
  if(!g||![g.leftX,g.rightX,g.leftTop,g.rightTop,overlap].every(Number.isFinite)||g.rightX<=g.leftX||overlap<0)throw Error('WATER_VISUAL_BOUNDS');
  return {left:g.leftX-overlap,right:g.rightX+overlap,width:g.rightX-g.leftX+2*overlap,surfaceY:Math.max(g.leftTop,g.rightTop)};
 }
 return Object.freeze({TILE_SIZE,ATLAS_COLUMNS,chooseTile,validate,paint,walls,filled,fromSolids,fromRectangles,soilTile,waterVisual});
});
