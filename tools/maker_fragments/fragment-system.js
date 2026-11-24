'use strict';
// Test-tool library: map payloads retain the existing V0.61 data contract.
(function(root){
 const FORMAT='HOJA_MAKER_FRAGMENT',VERSION=1,T=16;
 const clone=value=>JSON.parse(JSON.stringify(value));
 const fail=message=>{throw Error(message)};
 const idOk=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,48}$/.test(value);
 function validate(f){
  if(!f||f.format!==FORMAT||f.schemaVersion!==VERSION)fail('지원하지 않는 조각 형식 또는 버전');
  if(!idOk(f.id))fail('조각 ID는 영문·숫자·밑줄·하이픈 1~48자여야 합니다');
  if(typeof f.name!=='string'||!f.name.trim())fail(f.id+': 이름이 없습니다');
  if(f.description!==undefined&&typeof f.description!=='string')fail(f.id+': 설명 오류');if(f.difficulty!==undefined&&!['easy','medium','hard'].includes(f.difficulty))fail(f.id+': 난이도 오류');if(f.dependencies!==undefined&&(!Array.isArray(f.dependencies)||f.dependencies.some(v=>typeof v!=='string')||new Set(f.dependencies).size!==f.dependencies.length))fail(f.id+': 의존성 목록 오류');
  const m=f.map;if(!m||!idOk(m.id)||!Number.isInteger(m.width)||m.width<4||m.width>512||!Number.isInteger(m.height)||m.height<24||m.height>256)fail(f.id+': 맵 ID 또는 크기 오류');
  if(!['grassland','autumn','tropics','winter','cave'].includes(m.theme))fail(f.id+': 지원하지 않는 테마');
  if(!Array.isArray(m.terrain)||!Array.isArray(m.objects)||!Array.isArray(m.events))fail(f.id+': terrain, objects, events 배열이 필요합니다');
  const ids=new Set();for(const o of [...m.terrain,...m.objects]){
   if(!idOk(o.id)||ids.has(o.id))fail(f.id+': ID가 없거나 중복됩니다: '+o.id);ids.add(o.id);
   if(![o.x,o.y,o.w,o.h].every(Number.isInteger)||o.x<0||o.y<0||o.w<1||o.h<1||o.x+o.w>m.width||o.y+o.h>m.height)fail(f.id+': 범위 밖 요소 '+o.id);
   if(o.patrol?.waypoints){if(!Array.isArray(o.patrol.waypoints)||o.patrol.waypoints.length<2)fail(f.id+': 순찰 경로 오류 '+o.id);for(const p of o.patrol.waypoints)if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x+o.w>m.width||p.y+o.h>m.height)fail(f.id+': 순찰 경로가 조각 밖입니다 '+o.id)}
   if(o.type==='gimmick'){if(!root.HOJA_GIMMICK_MODEL)fail('기믹 모델을 먼저 불러오세요');try{root.HOJA_GIMMICK_MODEL.normalize({...o.gimmick,x:o.x*T,y:o.y*T,w:o.w*T,h:o.h*T})}catch(e){fail(f.id+': '+o.id+' '+e.message)}}
   if(o.type==='pipe'){const n=(o.pipeLength??4)-4,d=o.orientation||'up';if(!Number.isInteger(n)||n<0||n>124||!['up','down','left','right'].includes(d)||(d==='up'&&o.y+o.h+n>m.height)||(d==='down'&&o.y-n<0)||(d==='left'&&o.x+o.w+n>m.width)||(d==='right'&&o.x-n<0))fail(f.id+': 토관 몸통 범위 오류 '+o.id)}
  }
  for(const e of m.events){if(!e||!idOk(e.id)||ids.has(e.id))fail(f.id+': 이벤트 ID 누락 또는 중복');ids.add(e.id);if(e.x!==undefined&&(!Number.isFinite(e.x)||e.x<0||e.x>=m.width))fail(f.id+': 이벤트 좌표 오류 '+e.id)}
  for(const o of [...m.terrain,...m.objects,...m.events])for(const key of ['eventId','triggerId','objectId'])if(o[key]&&!ids.has(o[key]))fail(f.id+': '+key+' 참조 누락 '+o[key]);
  const con=f.connectors;if(!con||!con.entry||!con.exit)fail(f.id+': 진입점과 출구가 필요합니다');
  for(const [side,c] of Object.entries({entry:con.entry,exit:con.exit})){if(c.kind!=='ground'||!Number.isInteger(c.y)||c.y<0||c.y>=m.height)fail(f.id+': '+side+' 연결점 오류');const edge=side==='entry'?0:m.width-1;if(!m.terrain.some(t=>t.kind==='ground'&&t.x<=edge&&t.x+t.w>edge&&t.y===c.y))fail(f.id+': '+side+'에 지정 높이의 지면이 없습니다')}
  return true;
 }
 function compile(fragments,options={}){
  if(!Array.isArray(fragments)||!fragments.length)fail('조각을 하나 이상 지정하세요');for(const f of fragments)validate(f);
  const theme=fragments[0].map.theme;if(fragments.some(f=>f.map.theme!==theme))fail('서로 다른 테마의 조각은 한 맵에 연결할 수 없습니다');
  for(let i=1;i<fragments.length;i++)if(fragments[i-1].connectors.exit.y!==fragments[i].connectors.entry.y)fail(`${i}→${i+1} 연결 불가: 지면 높이가 다릅니다`);
  const width=fragments.reduce((n,f)=>n+f.map.width,0),height=Math.max(24,...fragments.map(f=>f.map.height));if(width<32||width>512||height>256)fail('조합된 맵 크기는 32~512 × 24~256이어야 합니다');
  const id='fragment-stage',entries=[],byMap=new Map();let offset=0;for(let i=0;i<fragments.length;i++){const f=fragments[i],ids=new Map([...f.map.terrain,...f.map.objects,...f.map.events].map(o=>[o.id,`f${i+1}_${o.id}`]));const e={f,offset,ids};entries.push(e);if(!byMap.has(f.map.id))byMap.set(f.map.id,[]);byMap.get(f.map.id).push(e);offset+=f.map.width}
  const terrain=[],objects=[],events=[],warnings=[];for(const e of entries){for(const original of [...e.f.map.terrain,...e.f.map.objects]){
   const o=clone(original);o.id=e.ids.get(o.id);if(o.type==='gimmick'&&o.gimmick?.kind==='saw'){const c=root.HOJA_GIMMICK_MODEL.normalize({...o.gimmick,x:o.x*T,y:o.y*T,w:o.w*T,h:o.h*T}),start=(c.axis==='x'?c.x+c.w/2:c.y+c.h/2)-c.radius,end=(c.axis==='x'?c.x+c.w/2:c.y+c.h/2)+c.distance+c.radius,limit=(c.axis==='x'?e.f.map.width:e.f.map.height)*T;if(start<0||end>limit)warnings.push(`${e.f.id}: ${o.id} 톱날 이동 범위가 조각 경계를 넘습니다`)}o.x+=e.offset;for(const key of ['eventId','triggerId','objectId'])if(o[key])o[key]=e.ids.get(o[key]);if(o.patrol?.waypoints)for(const p of o.patrol.waypoints)p.x+=e.offset;
   if(o.targetMapId||o.targetPortalId){if(o.type==='pipe'&&o.pipeMode==='solid')fail(e.f.id+': solid 토관에 링크가 있습니다. 원본을 명시적으로 수정하세요');const candidates=byMap.get(o.targetMapId)||[],target=o.targetMapId===e.f.map.id?e:candidates.length===1?candidates[0]:null;if(!target||!target.ids.has(o.targetPortalId))fail(e.f.id+': 대상 참조를 찾을 수 없습니다: '+o.id);const targetObj=target.f.map.objects.find(x=>x.id===o.targetPortalId);if(!targetObj||!['pipe','maker_start','maker_goal'].includes(targetObj.type))fail(e.f.id+': 연결 대상은 문·토관·집이어야 합니다');o.targetMapId=id;o.targetPortalId=target.ids.get(o.targetPortalId)}
   (e.f.map.terrain.includes(original)?terrain:objects).push(o);
  }for(const event of e.f.map.events){const copy=clone(event);copy.id=e.ids.get(event.id);for(const key of ['eventId','triggerId','objectId'])if(copy[key])copy[key]=e.ids.get(copy[key]);if(Number.isFinite(copy.x))copy.x+=e.offset;events.push(copy)}}
  if(terrain.length>4000||objects.length>1200)fail('조합된 요소 수가 게임의 허용 한도를 초과합니다');
  const first=fragments[0].map,spawn=clone(first.spawn||{x:2,y:fragments[0].connectors.entry.y});if(!Number.isFinite(spawn.x)||!Number.isFinite(spawn.y)||spawn.x<0||spawn.x>=first.width||spawn.y<0||spawn.y>height)fail('시작 위치 오류');
  return {format:'HOJA_MAKER_PROJECT',schemaVersion:6101,title:options.title||'조각 연결 시험',maps:[{id,name:options.name||'조각 연결 맵',theme,width,height,spawn,terrain,objects,events}],fragmentSources:{schemaVersion:1,seed:options.seed??0,warnings,fragments:clone(fragments)}};
 }
 root.HOJA_FRAGMENT_SYSTEM=Object.freeze({FORMAT,VERSION,validate,compile});
})(globalThis);
