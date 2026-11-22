'use strict';
// Visual placement and checkpoint geometry use only generated stage geometry.
// They never call the gameplay RNG or alter the generator's objects.
window.HOJA_STAGE_DECOR=(()=>{
 const T=16;
 const ATLASES={
  grassland:{path:'assets/decoration/grassland/Grassland_entities (16 x 16).png',items:[['flower-tree',144,16,48,48],['sign',48,80,16,16],['wood-fence',80,80,48,16],['short-fence',80,80,16,16]]},
  plants:{path:'assets/decoration/grassland/Extra_plants (16 x 16).png',items:[['flower-bed',80,32,64,32]]},
  autumn:{path:'assets/decoration/autumn/Autumn_entities (16 x 16).png',items:[['autumn-tree',16,16,48,48],['forest-rail',224,48,80,32]]},
  tropics:{path:'assets/decoration/tropics/Tropics_entities (16 x 16).png',items:[['palm',16,16,48,48],['shore-rail',80,48,48,16],['short-rail',80,48,16,16],['shore-rock',144,48,16,16],['pier',176,32,80,32]]},
  winter:{path:'assets/decoration/winter/Winter_entities (16 x 16).png',items:[['snow-tree',16,16,48,48],['snow-fence',144,16,48,16],['short-snow-fence',144,16,16,16],['snow-rock',16,80,16,16]]},
  flowers:{path:'assets/decoration/universal/Flowers (16 x 16).png',items:[['flower',0,0,16,16],['flowers-pink',16,0,16,16],['flowers-yellow',32,0,16,16]]},
  street:{path:'assets/decoration/universal/Snack_machine_Bench_Trash_bin (16 x 16).png',items:[['vending-machine',16,16,32,32],['bench',48,16,48,32],['bin',96,16,16,32]]},
  house:{path:'assets/decoration/universal/House (112 x 96).png',items:[['village-house',0,0,112,96]]},
  rock:{path:'assets/decoration/universal/Rock_shape (16 x 16).png',items:[['rock',0,0,16,16]]}
 };
 const PALETTES={grassland:['grassland','plants','flowers','street','house'],autumn:['autumn','grassland','flowers','rock'],tropics:['tropics','flowers','rock'],winter:['winter','street','rock']};
 const MIX={
  grassland:[['grassland:flower-tree','flowers:flower','plants:flower-bed'],['grassland:wood-fence','grassland:sign','street:bench','house:village-house','grassland:short-fence'],['flowers:flowers-yellow','grassland:flower-tree','flowers:flowers-pink']],
  autumn:[['autumn:autumn-tree','flowers:flowers-yellow','rock:rock'],['autumn:forest-rail','grassland:wood-fence','grassland:short-fence','autumn:autumn-tree'],['rock:rock','flowers:flower','autumn:forest-rail']],
  tropics:[['tropics:palm','tropics:shore-rock','flowers:flower'],['tropics:shore-rail','tropics:short-rail','tropics:pier','tropics:shore-rock'],['tropics:palm','rock:rock','flowers:flowers-yellow']],
  winter:[['winter:snow-rock','winter:snow-tree','winter:snow-fence','winter:short-snow-fence'],['street:bench','winter:snow-fence','winter:short-snow-fence','winter:snow-rock'],['winter:snow-tree','winter:short-snow-fence','winter:snow-rock','rock:rock']]
 };
 function hash(a,b){let x=(Math.imul((a|0)^0x39b21,b|0)^0x9e3779b9)>>>0;x=Math.imul(x^(x>>>16),0x7feb352d)>>>0;return(x^(x>>>15))>>>0;}
 function atlasList(theme){return PALETTES[theme]||[];}
 function item(id){const [sheet,name]=id.split(':');const def=ATLASES[sheet]?.items.find(a=>a[0]===name);if(!def)throw Error('Missing decoration '+id);return {sheet,name,rect:def.slice(1)};}
 function ground(solids,x,width){let found=null;for(const s of solids){if(s.kind!=='ground'||s.cave||s.slab||x-width/2<s.x+T||x+width/2>s.x+s.w-T)continue;if(found===null||s.y<found)found=s.y;}return found;}
 function checkpoint({solids,start,end,blocked=[],clear=()=>true}){
  const line=(start+end)/2,candidates=[];
  for(const s of solids){if(s.kind!=='ground'||s.cave||s.slab||s.w<96)continue;for(let x=Math.ceil((s.x+48)/T)*T;x<=s.x+s.w-48;x+=T){
   if(x<=start+64||x>=end-64||ground(solids,x,64)!==s.y||!clear(x,s.y))continue;
   const overlap=blocked.some(b=>Math.abs(b.x-x)<(b.radius||64)&&Math.abs((b.y??s.y)-s.y)<160);
   if(!overlap)candidates.push({x,y:s.y});
  }}
  if(!candidates.length)throw Error('No safe ground for midpoint checkpoint');
  candidates.sort((a,b)=>Math.abs(a.x-line)-Math.abs(b.x-line)||a.x-b.x);
  return {start,line,mid:candidates[0].x,midY:candidates[0].y,end};
 }
 function crossed(a,b,line){return Number.isFinite(a)&&Number.isFinite(b)&&((a<line&&b>=line)||(a>line&&b<=line));}
 function plan({theme,solids,start,end,blocked=[],enemies=[],seed=0}){
  const bands=MIX[theme];if(!bands)return [];
  const result=[], span=end-start;
  for(let i=0;i<Math.floor(span/180);i++){
   const zone=Math.min(2,Math.floor(i*180/span*3)),pool=bands[zone],n=hash(seed,i+1);
   const fallback={grassland:'flowers:flower',autumn:'rock:rock',tropics:'tropics:shore-rock',winter:'winter:snow-rock'}[theme];
   const options=[...pool.slice(n%pool.length),...pool.slice(0,n%pool.length),fallback];
   if(theme==='grassland'&&zone===1){
    if(!result.some(p=>p.name==='bench'))options.unshift('street:bench');
    if(!result.some(p=>p.name==='village-house'))options.unshift('house:village-house');
   }
   const target=start+100+i*180+(n%49);
   for(const id of options){
    const chosen=item(id);
    if(result.slice(-2).some(p=>p.name===chosen.name))continue;
    const [,,w,h]=chosen.rect,scale=chosen.sheet==='house'||chosen.sheet==='street'?1:2,width=w*scale;
    let location=null;
    for(let offset=0;offset<=224&&!location;offset+=16)for(const sign of offset?[1,-1]:[1]){
     const x=Math.round((target+sign*offset)/T)*T,y=ground(solids,x,width);
     if(y===null||x-width/2<start+48||x+width/2>end-80)continue;
     if(blocked.some(b=>Math.abs(b.x-x)<(b.radius||64)+width/2&&Math.abs((b.y??y)-y)<h*scale+24))continue;
     if(enemies.filter(e=>Math.abs(e.x-x)<120&&Math.abs(e.y-y)<160).length>=3)continue;
     if(result.some(b=>Math.abs(b.x-x)<(b.width+width)/2+20))continue;
     location={x,y};break;
    }
    if(location){result.push({...chosen,...location,width,height:h*scale,scale,flip:!!(hash(seed,i+100)&1),zone});break;}
   }
  }
  return result;
 }
 return Object.freeze({ATLASES,atlasList,item,ground,checkpoint,crossed,plan});
})();
