// 40-6-U3 (mock GAS part): boundaries, request storms and scale. This is NOT
// a real Apps Script engine run; real-engine results are reported separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProject,MockSpreadsheet} from './mock_gas.mjs';
import {buildCopy,standardHistory,ISOLATED_PROPS,id,game} from './fixture.mjs';

function world({history=standardHistory(),now='2026-11-23T03:00:00Z'}={}){
 const {ss,sealedPrefix}=buildCopy({history});
 const map=new Map([['copy40',ss],['prod',new MockSpreadsheet('prod')],['cert',new MockSpreadsheet('cert')]]);
 const p=loadProject({spreadsheets:map,props:ISOLATED_PROPS,now});
 ss.trace=p.trace;
 return {...p,ss,sealedPrefix,ev:ss.getSheetByName('EVENT_LOG'),m:ss.getSheetByName('HOJA_V4_DAILY_MANIFEST')};
}
const req=(n,team=1)=>({eventId:id(n),mode:team===1?'SOLO':'TEAM',repositoryKind:'PUBLIC',
 cartridgeIds:['101'],cartridgeCount:1,teamCount:team});

test('KST midnight boundary: 23:59:59.999 and 00:00:00.000 land on different days',()=>{
 const w=world();
 w.setNow('2026-11-23T14:59:59.999Z');w.rpc('recordUsageStartU1',req(1));
 w.setNow('2026-11-23T15:00:00.000Z');w.rpc('recordUsageStartU1',req(2));
 const rows=w.ev.rows.slice(-2).map(r=>r[2]);
 assert.deepEqual(rows,['2026-11-23','2026-11-24']);
 w.cache.clear();
 const s=w.rpc('getPublicUsageStatisticsV4');
 assert.deepEqual(s.daily.slice(-2).map(x=>x.count),[1,1]);
 assert.equal(s.totals.today,1);
});
test('request storm: 2,000 anonymous reads within one minute => at most 1 recompute, all OK',()=>{
 const w=world();w.rpc('recordUsageStartU1',req(10));w.cache.clear();
 const r0=w.ss.reads.length;let ok=0;
 for(let i=0;i<2000;i++){w.setNow(new Date(Date.parse('2026-11-23T03:10:00Z')+i*25).toISOString());
  if(w.rpc('getPublicUsageStatisticsV4').status==='OK')ok++;}
 assert.equal(ok,2000);
 const evReads=w.ss.reads.slice(r0).filter(x=>x.startsWith('EVENT_LOG')).length;
 assert.ok(evReads<=1,'EVENT_LOG tail reads: '+evReads);
});
test('recompute cap: when the fresh cache keeps expiring, recomputes per minute stay <= 20',()=>{
 const w=world();w.rpc('recordUsageStartU1',req(11));w.cache.clear();
 let stale=0;
 const minute=Math.floor(Date.parse('2026-11-23T03:20:00Z')/60000);
 for(let i=0;i<200;i++){
  w.setNow(new Date(minute*60000+i*250).toISOString());
  w.cache.delete('HOJA_V4U_PUBLIC_FRESH_V1');           // adversarial: every call misses
  const s=w.rpc('getPublicUsageStatisticsV4');
  assert.equal(s.status,'OK');if(s.cache.stale)stale++;
 }
 assert.equal(Number(w.cache.get('HOJA_V4U_RC_'+minute).v),20);
 assert.equal(stale,180);
});
test('scale: 61 sealed days x ~65 buckets + 20,000-row live tail computes within limits',()=>{
 const start=Date.parse('2026-09-23T00:00:00Z'),history=[];let n=0;
 for(let i=0;i<61;i++){
  const date=new Date(start+i*86400000).toISOString().slice(0,10),rows=[];
  for(let k=0;k<290;k++){n++;rows.push(game(n,date,{mode:k%4?'SOLO':'TEAM',team:k%4?1:2+(k%6),cart:k%2?'101':'102'}));}
  history.push({date,rows});
 }
 const w=world({history});
 const tag=w.call('hojaV4uSha256_("W|copy40").slice(0,16)');
 for(let k=0;k<20000;k++)w.ev.rows.push(game(1e6+k,'2026-11-23'));
 w.props.set('HOJA_V4_COMMIT_WATERMARK',JSON.stringify({row:w.sealedPrefix+20000,tag}));
 const t=Date.now();
 const s=w.rpc('getPublicUsageStatisticsV4');
 const ms=Date.now()-t;
 assert.equal(s.status,'OK');assert.equal(s.totals.all,n+20000);assert.equal(s.totals.today,20000);
 assert.ok(ms<20000,'node compute ms '+ms);
 // beyond the tail limit fail-closed (not truncated, not zero)
 for(let k=0;k<5001;k++)w.ev.rows.push(game(2e6+k,'2026-11-23'));
 w.props.set('HOJA_V4_COMMIT_WATERMARK',JSON.stringify({row:w.sealedPrefix+25001,tag}));
 w.cache.clear();
 const big=w.rpc('getPublicUsageStatisticsV4');
 assert.equal(big.status,'UNAVAILABLE');assert.equal(big.code,'READ_LIMIT');
});
test('safe stop/recovery: seal crash mid-way leaves numbers unchanged and resumes exactly once',()=>{
 const w=world();w.setActive('owner@example.test');
 for(let i=0;i<5;i++)w.rpc('recordUsageStartU1',req(100+i,i%2?1:5));
 w.setNow('2026-11-24T00:30:00Z');w.cache.clear();
 const before=w.rpc('getPublicUsageStatisticsV4');
 for(const failAt of ['HOJA_V4_DAILY_MANIFEST','HOJA_V4_DAILY_BUCKETS']){
  let armed=true;
  w.ss.hooks.onWrite=s=>{if(armed&&s.name===failAt){armed=false;throw Error('EXCEEDED_MAXIMUM_EXECUTION_TIME');}};
  try{w.rpc('hojaV4OpsSealPendingDays');}catch(e){assert.match(e.message,/EXCEEDED/);}
  w.ss.hooks.onWrite=null;
  w.cache.clear();
  const mid=w.rpc('getPublicUsageStatisticsV4');
  assert.equal(mid.status,'OK',failAt);assert.deepEqual(mid.totals,before.totals,failAt);
 }
 const r=w.rpc('hojaV4OpsSealPendingDays');
 assert.equal(r.sealed.length,1);
 assert.equal(w.m.rows.filter(x=>x[0]==='2026-11-23').length,1);
 w.cache.clear();
 assert.deepEqual(w.rpc('getPublicUsageStatisticsV4').totals,before.totals);
});
test('writer under concurrent appends: 300 starts from many executions -> exact rows, monotone W',()=>{
 const w=world();const ws=[];
 for(let i=0;i<300;i++){
  w.setNow(new Date(Date.parse('2026-11-23T03:30:00Z')+i*1000).toISOString());
  w.rpc('recordUsageStartU1',req(5000+i,(i%7)+1===1?1:(i%7)+1));
  if(i%10===0)w.rpc('recordUsageStartU1',req(5000+i,(i%7)+1===1?1:(i%7)+1)); // replays
  ws.push(JSON.parse(w.props.get('HOJA_V4_COMMIT_WATERMARK')).row);
 }
 assert.ok(ws.every((x,i)=>i===0||x===ws[i-1]+1));
 assert.equal(w.ev.getLastRow(),w.sealedPrefix+300);
 w.cache.clear();
 assert.equal(w.rpc('getPublicUsageStatisticsV4').totals.today,300);
});
