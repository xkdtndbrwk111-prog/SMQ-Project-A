// 40-6-U2: anonymous attacker view of the single Project A GAS (mock GAS) +
// static compatibility checks for the game and the public statistics page.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadProject,MockSpreadsheet,GAS_DIR} from './mock_gas.mjs';
import {buildCopy,standardHistory,ISOLATED_PROPS,id} from './fixture.mjs';

function world(){
 const {ss}=buildCopy({history:standardHistory()});
 const map=new Map([['copy40',ss],['prod',new MockSpreadsheet('prod')],['cert',new MockSpreadsheet('cert')]]);
 const p=loadProject({spreadsheets:map,props:ISOLATED_PROPS,now:'2026-11-23T03:00:00Z'});
 ss.trace=p.trace;
 p.rpc('recordUsageStartU1',{eventId:id(1),mode:'SOLO',repositoryKind:'PUBLIC',
  cartridgeIds:['101'],cartridgeCount:1,teamCount:1});
 return {...p,ss,ev:ss.getSheetByName('EVENT_LOG')};
}
const strip=s=>{const c=JSON.parse(JSON.stringify(s));delete c.generatedAt;delete c.cache;return c;};

test('anonymous: public reader ignores every argument and returns only the allowlisted aggregate',()=>{
 const w=world();
 const base=w.rpc('getPublicUsageStatisticsV4');
 assert.equal(base.status,'OK');
 for(const args of [[{from:'2000-01-01',to:'2099-01-01'}],['EVENT_LOG','A1:O99999'],
  [{raw:true,eventIds:true,includeMeta:true}],[{__proto__:{admin:true}}],[null,undefined,1e9]]){
  w.cache.clear();
  const t0=w.trace.length;
  const s=w.call('getPublicUsageStatisticsV4.apply(null,'+JSON.stringify(args)+')');
  assert.deepEqual(strip(s),strip(base),JSON.stringify(args));
  assert.ok(!w.trace.slice(t0).some(x=>/LOCK|WRITE|APPEND|PROP|INSERT/.test(x)));
 }
 const json=JSON.stringify(base);
 for(const bad of ['copy40','prod','cert',id(1),'PUBLIC:','U3S1','EVENT_LOG','HOJA_V4'])
  assert.ok(!json.includes(bad),bad);
});
test('anonymous: operator functions denied before touching storage',()=>{
 const w=world(),t0=w.trace.length;
 for(const f of ['hojaV4OpsSealPendingDays','hojaV4OpsStatus'])
  assert.throws(()=>w.call(f+'({force:true})'),/HOJA_V4_OPS_DENIED/);
 assert.ok(!w.trace.slice(t0).some(x=>x.startsWith('OPEN')));
});
test('anonymous: hostile game-start payloads append nothing and never echo storage IDs',()=>{
 const w=world(),before=w.ev.getLastRow();
 const bad=[null,[],'x',{},{eventId:id(2),mode:'SOLO',repositoryKind:'PUBLIC',cartridgeIds:['999'],cartridgeCount:1},
  {eventId:'not-a-uuid',mode:'SOLO',repositoryKind:'PUBLIC',cartridgeIds:['101'],cartridgeCount:1},
  {eventId:id(3),mode:'ADMIN',repositoryKind:'PUBLIC',cartridgeIds:['101'],cartridgeCount:1},
  {eventId:id(4),mode:'TEAM',teamCount:99,repositoryKind:'PUBLIC',cartridgeIds:['101'],cartridgeCount:1},
  {eventId:id(5),mode:'SOLO',repositoryKind:'PUBLIC',cartridgeIds:['101','101'],cartridgeCount:2},
  {eventId:id(6),mode:'SOLO',repositoryKind:'PUBLIC',cartridgeIds:['101'],cartridgeCount:6},
  {eventId:id(7)+'=1+1',mode:'SOLO',repositoryKind:'PUBLIC',cartridgeIds:['101'],cartridgeCount:1},
  {eventId:id(8),mode:'SOLO',repositoryKind:'MANAGER',cartridgeIds:['101'],cartridgeCount:1}];
 for(const p of bad){
  let out='';
  try{out=JSON.stringify(w.rpc('recordUsageStartU1',p));}catch(e){out=String(e.message);}
  assert.ok(!/copy40|prod|cert/.test(out),out);
 }
 const priv=w.rpc('recordUsageStartU1',{eventId:id(9),mode:'SOLO',repositoryKind:'PRIVATE',cartridgeIds:['101'],cartridgeCount:1});
 assert.equal(priv.ignored,true);
 assert.equal(w.ev.getLastRow(),before);
});
test('doGet: no parameter can select another HTML file',()=>{
 const w=world();
 for(const v of ['../Code','Code','UsageV4Unified','Stats ','stats\u0000','Game'])
  assert.equal(w.call('doGet({parameter:{view:'+JSON.stringify(v)+'}}).file'),'Game',v);
});
test('existing game RPCs in the single GAS are byte-identical to the root production candidate',()=>{
 const fn=(src,name)=>{const i=src.indexOf('function '+name+'(');assert.ok(i>=0,name);
  const j=src.indexOf('\n}',i+1);return src.slice(i,j+2).trim();}; // to the column-0 closing brace
 const root=readFileSync('Code.gs','utf8'),uni=readFileSync(GAS_DIR+'/Code.gs','utf8');
 for(const n of ['hojaApiGet_','hojaPublicName_','hojaCatalogRead_','hojaPublicSheets_',
  'hojaRows_','hojaReadCartridge_',
  'hojaRankNormalizeName_','hojaRankValidName_','hojaRankSheet_','hojaRankCartridge_',
  'hojaRankRows_','hojaRankPublicRows_','hojaRankList','hojaRankSave','hojaUsageText_',
  'hojaUsageClassification_'])assert.equal(fn(uni,n),fn(root,n),n);
 // 40-6-U D: the ONLY intended difference in this function is warming the
 // telemetry catalog cache; the returned contract is unchanged.
 // 40-6 F3: the only other intended difference is the 2-line QA-catalog route at the top of
 // hojaListPublicCartridges / hojaGetPublicQuestions (inactive with the RELEASE catalog).
 const noQa=t=>t.replace(/\n\s*const qa=hojaApprovedQaCatalog_\(\);[^\n]*\n\s*if\(qa\)return [^\n]*/,'');
 assert.equal(noQa(fn(uni,'hojaGetPublicQuestions')),fn(root,'hojaGetPublicQuestions'));
 const strip=t=>noQa(t).replace(/\n\s*const sheets=hojaPublicSheets_\(\)\.sheets;\n\s*hojaUsageCatalogPut_\(sheets\);[^\n]*\n\s*return sheets\.map/,'\n  return hojaPublicSheets_().sheets.map');
 assert.equal(strip(fn(uni,'hojaListPublicCartridges')),fn(root,'hojaListPublicCartridges'));
});
test('Stats.html: lazy single RPC, no external resources, data rendered as text only',()=>{
 const html=readFileSync(GAS_DIR+'/Stats.html','utf8');
 const rpcs=[...html.matchAll(/\.(get[A-Za-z0-9]+|hoja[A-Za-z0-9]+|record[A-Za-z0-9]+)\(\)/g)].map(m=>m[1]);
 assert.deepEqual([...new Set(rpcs)],['getPublicUsageStatisticsV4']);
 assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=|@import|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
 assert.equal((html.match(/innerHTML/g)||[]).length,1,'only the static SVG pattern');
 assert.match(html,/defs\.innerHTML='<pattern id="hatch"/);
});
test('assembled single GAS: Game.html bytes unchanged and game never calls statistics',()=>{
 const out=mkdtempSync(join(tmpdir(),'hoja-u2-'));
 try{
  const r=JSON.parse(execFileSync('python3',['experimental/usage-v4-unified/build_unified_gas.py','--output',join(out,'gas')]).toString());
  assert.equal(r.gameSha256,'4ac5c4efc985c4c5d08f10a4410a48d7b49070c30fb10651a0c78cec6b3ecfc6');
  // 40-6-U D: exactly the telemetry block is replaced; every other byte is the verified game
  assert.equal(r.telemetryBlockOldSha256,'18bc5697b7e812e6237e000131ab556a0a2b5c078dad92f729e38c5bdf828aa2');
  const game=readFileSync(join(out,'gas','Game.html'),'utf8');
  assert.ok(game.includes('hoja_usage_pending_v1')&&!game.includes('withFailureHandler(()=>{}).recordUsageStartU1'));
  assert.ok(!game.includes('getPublicUsageStatisticsV4')&&!game.includes('view=stats'));
  for(const rpc of ['hojaListPublicCartridges','hojaGetPublicQuestions','hojaRankList','hojaRankSave','recordUsageStartU1'])
   assert.ok(game.includes(rpc),rpc);
 }finally{rmSync(out,{recursive:true,force:true});}
});
