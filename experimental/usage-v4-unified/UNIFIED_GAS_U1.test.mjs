// 40-6-U1: Project A single GAS — writer / daily seal / public reader (mock GAS).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadProject,GAS_DIR,GAS_FILES,MockSpreadsheet,EVENT_HEADER} from './mock_gas.mjs';
import {buildCopy,standardHistory,ISOLATED_PROPS,game,id,CORE} from './fixture.mjs';

const req=(n,{team=1,ids=['101']}={})=>({eventId:id(n),mode:team===1?'SOLO':'TEAM',
 repositoryKind:'PUBLIC',cartridgeIds:ids,cartridgeCount:ids.length,teamCount:team});
function world({props=ISOLATED_PROPS,history=standardHistory(),tail=[],now='2026-11-23T03:00:00Z',
 canaryB1,extra={}}={}){
 const {ss,sealedPrefix}=buildCopy({history,tail,canaryB1});
 const map=new Map([['copy40',ss],['prod',new MockSpreadsheet('prod')],['cert',new MockSpreadsheet('cert')]]);
 const p=loadProject({spreadsheets:map,props:{...props,...extra},now});
 ss.trace=p.trace;
 return {...p,ss,sealedPrefix,ev:ss.getSheetByName('EVENT_LOG'),
  m:ss.getSheetByName('HOJA_V4_DAILY_MANIFEST'),b:ss.getSheetByName('HOJA_V4_DAILY_BUCKETS'),
  W:()=>JSON.parse(p.props.get('HOJA_V4_COMMIT_WATERMARK')||'null')?.row??null};
}

// ---------------- RPC surface ----------------
test('public RPC surface of the whole single GAS project equals the allowlist',()=>{
 const pub=new Set();
 for(const f of GAS_FILES)for(const m of readFileSync(GAS_DIR+'/'+f,'utf8')
  .matchAll(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm))if(!m[1].endsWith('_'))pub.add(m[1]);
 assert.deepEqual([...pub].sort(),['doGet','getPublicUsageStatisticsV4','hojaGetPublicQuestions',
  'hojaListPublicCartridges','hojaRankList','hojaRankSave','hojaV4OpsSealPendingDays',
  'hojaV4OpsStatus','recordUsageStartU1'].sort());
 const src=readFileSync(GAS_DIR+'/UsageV4Unified.gs','utf8');
 for(const ops of ['hojaV4OpsSealPendingDays','hojaV4OpsStatus'])
  assert.match(src,new RegExp('function '+ops+'\\(\\)\\{\\n hojaV4uRequireOperator_\\(\\);'));
 assert.match(src,/function getPublicUsageStatisticsV4\(\)\{/,'public reader takes no parameters');
 for(const f of GAS_FILES){const s=readFileSync(GAS_DIR+'/'+f,'utf8');
  // Code.gs keeps the existing ranking deleteRow contract; V4 files never delete.
  assert.doesNotMatch(s,/ScriptApp\.newTrigger|deleteSheet|clearContents?\s*\(/,f);
  if(f!=='Code.gs')assert.doesNotMatch(s,/deleteRows?\s*\(/,f);
  if(f!=='UsageV4Core.gs')assert.doesNotMatch(s,/getUsageStatisticsU2|requireUsageStatisticsAccessU3_|hojaV4PreviewDailyTrialU1|getUsageStatisticsU4TrialShadow/,f);
 }
});
test('V4 CORE in the GAS bundle is byte-identical to the certified experimental core',()=>{
 assert.equal(readFileSync(GAS_DIR+'/UsageV4Core.gs','utf8'),
  readFileSync('experimental/usage-retention/HOJA_USAGE_V4_CORE.js','utf8'));
});
test('anonymous callers cannot run operator functions',()=>{
 const w=world();
 for(const fn of ['hojaV4OpsSealPendingDays','hojaV4OpsStatus'])
  assert.throws(()=>w.rpc(fn),/HOJA_V4_OPS_DENIED/);
 w.setActive('someone-else@example.test');
 assert.throws(()=>w.rpc('hojaV4OpsSealPendingDays'),/HOJA_V4_OPS_DENIED/);
 assert.equal(w.trace.filter(x=>x.startsWith('OPEN')).length,0);
});
test('doGet routes only ?view=stats to Stats; everything else stays the game',()=>{
 const w=world();
 assert.equal(w.call('doGet({parameter:{view:"stats"}}).file'),'Stats');
 for(const e of ['undefined','{}','{parameter:{}}','{parameter:{view:"STATS"}}',
  '{parameter:{view:["stats"]}}','{parameter:{view:"admin"}}','{parameter:{room:"x"}}'])
  assert.equal(w.call('doGet('+e+').file'),'Game',e);
});

// ---------------- isolation ----------------
test('isolation property absent => original U1 behaviour, stats NOT_CONFIGURED',()=>{
 const props={SMQ_USAGE_SPREADSHEET_ID:'copy40'};
 const w=world({props});
 const before=w.ev.getLastRow();
 assert.equal(w.rpc('recordUsageStartU1',req(50)).ok,true);
 w.rpc('recordUsageStartU1',req(50));
 assert.equal(w.ev.getLastRow(),before+2,'legacy path unchanged (no V4 dedupe)');
 assert.equal(w.W(),null);
 const s=w.rpc('getPublicUsageStatisticsV4');
 assert.deepEqual(Object.keys(s).sort(),['code','generatedAt','schema','status']);
 assert.equal(s.status,'UNAVAILABLE');assert.equal(s.code,'NOT_CONFIGURED');
});
test('wrong isolation value / production / certified copy / missing 2nd canary are refused before append',()=>{
 const cases=[{extra:{HOJA_V4_UNIFIED_ISOLATION:'YES'}},
  {extra:{HOJA_USAGE_PRODUCTION_SPREADSHEET_ID:'copy40'}},
  {extra:{HOJA_USAGE_CERTIFIED_COPY_SPREADSHEET_ID:'copy40'}},
  {extra:{HOJA_USAGE_CERTIFIED_COPY_SPREADSHEET_ID:''}},
  {extra:{HOJA_PROD_RANKING_SPREADSHEET_ID:'copy40'}},
  {canaryB1:''}];
 for(const c of cases){
  const w=world(c),before=w.ev.getLastRow();
  assert.throws(()=>w.rpc('recordUsageStartU1',req(60)),/HOJA_V4U_/,JSON.stringify(c));
  assert.equal(w.ev.getLastRow(),before);
  assert.equal(w.rpc('getPublicUsageStatisticsV4').status,'UNAVAILABLE');
 }
});

// ---------------- writer ----------------
test('writer: first append commits watermark; identical replay adds 0 rows; conflict refused',()=>{
 const w=world();
 const r=w.rpc('recordUsageStartU1',req(100));
 assert.equal(r.ok,true);assert.equal(w.ev.getLastRow(),w.sealedPrefix+1);
 assert.equal(w.W(),w.sealedPrefix+1);
 w.setNow('2026-11-23T03:05:00Z');
 const again=w.rpc('recordUsageStartU1',req(100));
 assert.equal(again.duplicateIgnored,true);assert.equal(w.ev.getLastRow(),w.sealedPrefix+1);
 assert.throws(()=>w.rpc('recordUsageStartU1',req(100,{team:3})),/USAGE_EVENT_ID_CONFLICT/);
 assert.throws(()=>w.rpc('recordUsageStartU1',req(100,{ids:['102']})),/USAGE_EVENT_ID_CONFLICT/);
 assert.equal(w.ev.getLastRow(),w.sealedPrefix+1);
 // the append and its guard happen strictly inside one ScriptLock
 const t=w.trace.join(' ');
 assert.match(t,/LOCK .*APPEND:EVENT_LOG FLUSH .*PROP:HOJA_V4_COMMIT_WATERMARK UNLOCK/);
});
test('writer: replay of an event from the last sealed day is not counted again',()=>{
 const w=world();
 const replay={eventId:id(5),mode:'SOLO',repositoryKind:'PUBLIC',cartridgeIds:['101'],cartridgeCount:1,teamCount:1};
 // historical row 5 has namespace PUBLIC:public-catalog; the live writer writes the real
 // namespace, so content differs => conflict (fail-closed, no silent double count).
 const before=w.ev.getLastRow();
 assert.throws(()=>w.rpc('recordUsageStartU1',replay),/USAGE_EVENT_ID_CONFLICT/);
 assert.equal(w.ev.getLastRow(),before);
 // a writer-created event replayed the next day (same content) => duplicateIgnored
 w.rpc('recordUsageStartU1',req(200));
 w.setNow('2026-11-24T02:00:00Z');
 const r=w.rpc('recordUsageStartU1',req(200));
 assert.equal(r.duplicateIgnored,true);assert.equal(r.originalDate,'2026-11-23');
 assert.equal(w.ev.getLastRow(),before+1);
});
test('writer: clock regression into a sealed day and future-dated last row are refused',()=>{
 const w=world({now:'2026-11-22T05:00:00Z'});
 assert.throws(()=>w.rpc('recordUsageStartU1',req(300)),/USAGE_V4_DAY_ALREADY_SEALED/);
 const w2=world({tail:[game(301,'2026-11-25')]});
 assert.throws(()=>w2.rpc('recordUsageStartU1',req(302)),/HOJA_V4U_UNCOMMITTED_TAIL_HOLD/);
 assert.equal(w2.ev.getLastRow(),w2.sealedPrefix+1);
});
test('writer: rate limit per minute and replay storm',()=>{
 const w=world();
 for(let i=0;i<300;i++)w.cache.set('HOJA_V4U_W_'+Math.floor(w.clock.ms/60000),{v:String(300),exp:w.clock.ms+60000});
 const before=w.ev.getLastRow();
 assert.throws(()=>w.rpc('recordUsageStartU1',req(400)),/USAGE_RATE_LIMITED/);
 assert.equal(w.ev.getLastRow(),before);
});
test('writer: crash between append and commit is adopted later; partial orphan holds',()=>{
 const w=world();
 // simulate: row appended + flushed but watermark write lost
 w.rpc('recordUsageStartU1',req(500));
 w.ev.rows.push(game(501,'2026-11-23'));             // complete orphan
 assert.equal(w.W(),w.sealedPrefix+1);
 const stats1=w.rpc('getPublicUsageStatisticsV4');
 assert.equal(stats1.totals.today,1,'reader never reads past the commit watermark');
 w.rpc('recordUsageStartU1',req(502));
 assert.equal(w.W(),w.sealedPrefix+3);
 const w2=world();
 w2.rpc('recordUsageStartU1',req(510));
 const partial=game(511,'2026-11-23');partial[4]='';partial[13]='';
 w2.ev.rows.push(partial);
 assert.throws(()=>w2.rpc('recordUsageStartU1',req(512)),/UNCOMMITTED_TAIL_HOLD/);
 const s=w2.rpc('getPublicUsageStatisticsV4');
 assert.equal(s.status,'OK');assert.equal(s.totals.today,1,'partial row beyond W is invisible');
});

// ---------------- public reader ----------------
const ALLOWED_KEYS=['asOf','cache','daily','generatedAt','grade','historyStart','historyStatus',
 'mode','provisionalDays','publisher','schema','status','subject','todayStatus',
 'topCartridges','totals'];
test('reader: exact numbers from sealed summaries + committed tail, fixed allowlist, no secrets',()=>{
 const w=world();
 w.rpc('recordUsageStartU1',req(600,{team:7}));
 w.rpc('recordUsageStartU1',req(601));
 w.rpc('recordUsageStartU1',req(601));                 // replay suppressed at write time
 w.cache.clear();
 const s=w.rpc('getPublicUsageStatisticsV4');
 assert.equal(s.status,'OK');
 assert.deepEqual(Object.keys(s).sort(),ALLOWED_KEYS);
 assert.deepEqual(s.totals,{today:2,days7:8,days30:8,all:8});
 assert.deepEqual(s.daily.map(x=>x.count),[2,0,2,2,2]);
 assert.equal(s.daily[1].date,'2026-11-20','verified zero day present as 0');
 assert.deepEqual(s.provisionalDays,['2026-11-23']);
 assert.equal(s.mode.find(x=>x.label==='TEAM').count,3);
 assert.ok(!('teamCount' in s)&&!JSON.stringify(s).includes('팀전'),'team-size distribution is not published');
 assert.equal(s.grade.reduce((a,x)=>a+x.count,0),8);
 assert.equal(s.subject.reduce((a,x)=>a+x.count,0),8);
 const json=JSON.stringify(s);
 for(const bad of [id(600),id(1),'copy40','prod','cert','PUBLIC:','U3S1','sourcePrefix',
  'watermark','eventId','101|','HOJA_V4_','retries'])assert.ok(!json.includes(bad),bad);
 // no lock, no writes, no full EVENT_LOG scan by the public reader
 const t0=w.trace.length,reads0=w.ss.reads.length;w.cache.clear();
 w.rpc('getPublicUsageStatisticsV4');
 const t=w.trace.slice(t0);
 assert.ok(!t.some(x=>/LOCK|WRITE|APPEND|PROP|INSERT/.test(x)),t.join(' '));
 const evReads=w.ss.reads.slice(reads0).filter(x=>x.startsWith('EVENT_LOG!'));
 assert.deepEqual(evReads,['EVENT_LOG!'+(w.sealedPrefix+1)+':'+(w.sealedPrefix+2)]);
});
test('reader: small cells and non-standard cartridge names are suppressed',()=>{
 const w=world();
 const pub=w.call('HOJA_USAGE_V4_PUBLIC.safeCartridgeLabel("6-사회-천재-2단원 | 5-수학-비상-3단원")');
 assert.equal(pub,'6-사회-천재-2단원 | 5-수학-비상-3단원');
 for(const bad of ['서울수락초 6학년 2반 사회','6-사회-천재-김선생님 자료','6-사회-천재-a@b.com',
  'https://x.y','6-사회-천재-010-1234-5678'])
  assert.equal(w.call('HOJA_USAGE_V4_PUBLIC.safeCartridgeLabel('+JSON.stringify(bad)+')'),'기타 공개 카트리지',bad);
 for(let i=0;i<4;i++)w.rpc('recordUsageStartU1',req(1300+i));
 const s=w.rpc('getPublicUsageStatisticsV4');
 assert.equal(s.status,'OK');
 // 101 alone: 4 history + 4 today = 8 (>=5) public; 102 alone: 2 (<5) => merged
 assert.deepEqual(s.topCartridges.map(x=>[x.label,x.count]),[['6-사회-천재-2단원',8],['기타(소수)',2]]);
 assert.ok(s.topCartridges.every(x=>x.count>=5||x.label==='기타(소수)'||x.label==='기타 공개 카트리지'));
 assert.equal(s.topCartridges.reduce((a,x)=>a+x.count,0),s.totals.all);
});
test('reader: integrity failures are UNAVAILABLE with no numbers (never shown as 0)',()=>{
 const mutate={
  corruptBucket:w=>{w.b.rows[1][5]='999';},
  dropZeroDay:w=>{w.m.rows.splice(2,1);},
  breakPrefix:w=>{w.m.rows[3][11]='99';},
  lateEventInTail:w=>{w.ev.rows.push(game(700,'2026-11-21'));w.props.set('HOJA_V4_COMMIT_WATERMARK',
   JSON.stringify({row:w.sealedPrefix+1,tag:JSON.parse(w.props.get('HOJA_V4_COMMIT_WATERMARK')).tag}));},
  futureEventInTail:w=>{w.ev.rows.push(game(701,'2026-11-24'));w.props.set('HOJA_V4_COMMIT_WATERMARK',
   JSON.stringify({row:w.sealedPrefix+1,tag:JSON.parse(w.props.get('HOJA_V4_COMMIT_WATERMARK')).tag}));},
  partialCommittedRow:w=>{const r=game(702,'2026-11-23');r[0]='';w.ev.rows.push(r);w.props.set('HOJA_V4_COMMIT_WATERMARK',
   JSON.stringify({row:w.sealedPrefix+1,tag:JSON.parse(w.props.get('HOJA_V4_COMMIT_WATERMARK')).tag}));},
  watermarkForOtherStorage:w=>{w.props.set('HOJA_V4_COMMIT_WATERMARK',JSON.stringify({row:w.sealedPrefix,tag:'0000000000000000'}));},
  preparingInMiddle:w=>{w.m.rows[2][2]='PREPARING';},
  unexpectedBucket:w=>{w.b.rows.push(['2026-11-23','x','MODE','SOLO','SOLO','1']);},
  auditMissing:w=>{w.ss.sheets.delete('HOJA_V4_BACKFILL_AUDIT');}
 };
 for(const [name,fn] of Object.entries(mutate)){
  const w=world();
  w.props.set('HOJA_V4_COMMIT_WATERMARK',JSON.stringify({row:w.sealedPrefix,
   tag:w.call('hojaV4uSha256_("W|copy40").slice(0,16)')}));
  fn(w);w.cache.clear();
  const s=w.rpc('getPublicUsageStatisticsV4');
  assert.equal(s.status,'UNAVAILABLE',name);
  assert.deepEqual(Object.keys(s).sort(),['code','generatedAt','schema','status'],name);
  assert.ok(!('totals' in s),name);
 }
});
test('reader: watermark not initialised => NOT_CONFIGURED (not zero)',()=>{
 const w=world();
 const s=w.rpc('getPublicUsageStatisticsV4');
 assert.equal(s.status,'UNAVAILABLE');assert.equal(s.code,'NOT_CONFIGURED');
});
test('reader: cache 60s, recompute cap, stale flagged; integrity errors are not masked by stale',()=>{
 const w=world();w.rpc('recordUsageStartU1',req(800));
 const a=w.rpc('getPublicUsageStatisticsV4');assert.equal(a.cache.ageSeconds,0);
 const r0=w.ss.reads.length;
 w.setNow('2026-11-23T03:00:30Z');
 const b=w.rpc('getPublicUsageStatisticsV4');
 assert.equal(w.ss.reads.length,r0,'served from cache');assert.equal(b.cache.ageSeconds,30);
 w.setNow('2026-11-23T03:02:00Z');
 w.cache.set('HOJA_V4U_RC_'+Math.floor(w.clock.ms/60000),{v:'20',exp:w.clock.ms+60000});
 const c=w.rpc('getPublicUsageStatisticsV4');
 assert.equal(c.status,'OK');assert.equal(c.cache.stale,true);assert.equal(c.cache.ageSeconds,120);
 w.setNow('2026-11-23T03:03:00Z');
 w.b.rows[1][5]='999';
 const d=w.rpc('getPublicUsageStatisticsV4');
 assert.equal(d.status,'UNAVAILABLE');assert.equal(d.code,'INTEGRITY');
 w.setNow('2026-11-23T03:20:00Z');
 w.cache.set('HOJA_V4U_RC_'+Math.floor(w.clock.ms/60000),{v:'20',exp:w.clock.ms+60000});
 const e=w.rpc('getPublicUsageStatisticsV4');
 assert.equal(e.status,'UNAVAILABLE');assert.equal(e.code,'RATE_LIMITED');
});

// ---------------- daily seal / midnight ----------------
test('midnight: yesterday stays LIVE_PROVISIONAL until sealed; seal is exact, idempotent and zero-day safe',()=>{
 const w=world();w.setActive('owner@example.test');
 w.rpc('recordUsageStartU1',req(900));w.rpc('recordUsageStartU1',req(901,{team:4}));
 w.setNow('2026-11-23T15:00:30Z');                     // 00:00:30 KST 11-24
 w.rpc('recordUsageStartU1',req(902));
 w.cache.clear();
 const pre=w.rpc('getPublicUsageStatisticsV4');
 assert.deepEqual(pre.provisionalDays,['2026-11-23','2026-11-24']);
 assert.deepEqual(pre.totals,{today:1,days7:9,days30:9,all:9});
 const sealed=w.rpc('hojaV4OpsSealPendingDays');
 assert.deepEqual(sealed.sealed.map(x=>[x.date,x.starts,x.zeroDay]),[['2026-11-23',2,false]]);
 const last=w.m.rows[w.m.rows.length-1];
 assert.equal(last[2],'COMPLETE');assert.match(last[1],/^[a-f0-9]{64}$/);
 assert.equal(Number(last[11]),w.sealedPrefix+2);
 w.cache.clear();
 const post=w.rpc('getPublicUsageStatisticsV4');
 assert.deepEqual(post.totals,pre.totals,'sealing never changes numbers');
 assert.deepEqual(post.daily,pre.daily);
 assert.deepEqual(post.provisionalDays,['2026-11-24']);
 assert.equal(w.rpc('hojaV4OpsSealPendingDays').sealed.length,0,'idempotent');
 // two silent days later: both zero days sealed only after the cut point
 w.setNow('2026-11-26T01:00:00Z');
 const z=w.rpc('hojaV4OpsSealPendingDays');
 assert.deepEqual(z.sealed.map(x=>[x.date,x.starts,x.zeroDay]),
  [['2026-11-24',1,false],['2026-11-25',0,true]]);
 w.cache.clear();
 const after=w.rpc('getPublicUsageStatisticsV4');
 assert.equal(after.totals.all,9);
 assert.deepEqual(after.daily.slice(-3).map(x=>x.count),[1,0,0]);
 // writer now refuses sealed day 11-25 (clock regression)
 w.setNow('2026-11-25T05:00:00Z');
 assert.throws(()=>w.rpc('recordUsageStartU1',req(903)),/DAY_ALREADY_SEALED/);
});
test('seal: more than 3 unsealed past days => SEAL_STALE (fail-closed, not zero)',()=>{
 const w=world();w.rpc('recordUsageStartU1',req(950));
 w.setNow('2026-11-27T03:00:00Z');w.cache.clear();
 const s=w.rpc('getPublicUsageStatisticsV4');
 assert.equal(s.status,'UNAVAILABLE');assert.equal(s.code,'SEAL_STALE');
});
test('seal: interrupted after PREPARING resumes the identical generation; reader ignores PREPARING buckets',()=>{
 const w=world();w.setActive('owner@example.test');
 w.rpc('recordUsageStartU1',req(960));w.rpc('recordUsageStartU1',req(961,{team:3}));
 w.setNow('2026-11-24T02:00:00Z');
 let crash=true;
 w.ss.hooks.onWrite=(sheet)=>{if(crash&&sheet.name==='HOJA_V4_DAILY_BUCKETS'){crash=false;throw Error('QUOTA');}};
 assert.throws(()=>w.rpc('hojaV4OpsSealPendingDays'),/QUOTA/);
 assert.equal(w.m.rows[w.m.rows.length-1][2],'PREPARING');
 assert.equal(w.locks.held,false,'lock released after failure');
 w.cache.clear();
 const mid=w.rpc('getPublicUsageStatisticsV4');
 assert.equal(mid.status,'OK');assert.deepEqual(mid.provisionalDays,['2026-11-23','2026-11-24']);
 const r=w.rpc('hojaV4OpsSealPendingDays');
 assert.equal(r.sealed[0].date,'2026-11-23');
 assert.equal(w.m.rows.filter(x=>x[0]==='2026-11-23').length,1,'no duplicate manifest row');
 w.cache.clear();
 const done=w.rpc('getPublicUsageStatisticsV4');
 assert.deepEqual(done.totals,mid.totals);
});
test('seal: tampered PREPARING generation requires manual review',()=>{
 const w=world();w.setActive('owner@example.test');
 w.rpc('recordUsageStartU1',req(970));
 w.setNow('2026-11-24T02:00:00Z');
 w.m.rows.push(['2026-11-23','f'.repeat(64),'PREPARING','9','9','1','1','f'.repeat(64),'3','x','','9','e'.repeat(64),'0']);
 assert.throws(()=>w.rpc('hojaV4OpsSealPendingDays'),/MANUAL_REVIEW/);
});

// ---------------- same-GAS concurrency (interleavings) ----------------
test('concurrency: writer commits while reader is mid-read => reader shows a consistent cut, never partial',()=>{
 const w=world();w.rpc('recordUsageStartU1',req(1000));w.cache.clear();
 let injected=false;
 w.ss.hooks.onRead=(sheet)=>{
  if(!injected&&sheet.name==='HOJA_V4_DAILY_BUCKETS'){injected=true;
   w.ss.hooks.onRead=null;
   // a concurrent game start (different execution) appends + commits
   w.ctx.__l=null;w.rpc('recordUsageStartU1',req(1001));
   // and another start is mid-append: row present, not yet committed
   const r=game(1002,'2026-11-23');r[13]='';w.ev.rows.push(r);
  }};
 const s=w.rpc('getPublicUsageStatisticsV4');
 assert.equal(s.status,'OK');
 assert.ok([1,2].includes(s.totals.today),'old or new committed cut only: '+s.totals.today);
 assert.equal(s.totals.all,6+s.totals.today);
});
test('concurrency: seal flips a day while reader reads the tail => retry gives identical totals',()=>{
 const w=world();w.setActive('owner@example.test');
 w.rpc('recordUsageStartU1',req(1100));w.rpc('recordUsageStartU1',req(1101));
 w.setNow('2026-11-24T01:00:00Z');w.cache.clear();
 const base=w.rpc('getPublicUsageStatisticsV4');w.cache.clear();
 let fired=false;
 w.ss.hooks.onRead=(sheet,row)=>{
  if(!fired&&sheet.name==='EVENT_LOG'){fired=true;w.ss.hooks.onRead=null;w.rpc('hojaV4OpsSealPendingDays');}};
 const s=w.rpc('getPublicUsageStatisticsV4');
 assert.ok(fired);assert.equal(s.status,'OK');
 assert.deepEqual(s.totals,base.totals);assert.deepEqual(s.daily,base.daily);
});
test('concurrency: seal cannot run while the writer holds the ScriptLock',()=>{
 const w=world();w.setActive('owner@example.test');w.setNow('2026-11-24T01:00:00Z');
 w.locks.held=true;
 assert.throws(()=>w.rpc('hojaV4OpsSealPendingDays'),/SEAL_LOCK_TIMEOUT/);
 assert.throws(()=>w.rpc('recordUsageStartU1',req(1200)),/USAGE_APPEND_LOCK_TIMEOUT/);
 w.locks.held=false;
});

// ---------------- 61-day shaped parity (synthetic) ----------------
test('synthetic 61-day history: raw rows - retries = plays; zero days explicit; buckets hash-verified',()=>{
 const start=Date.parse('2026-09-23T00:00:00Z'),history=[];let n=0,raw=0;
 const zero=new Set([5,17,33,48]);
 for(let i=0;i<61;i++){
  const date=new Date(start+i*86400000).toISOString().slice(0,10),rows=[];
  if(!zero.has(i))for(let k=0;k<(i%7)+1;k++){n++;rows.push(game(n,date,{mode:k%3?'SOLO':'TEAM',team:k%3?1:2+(k%6),cart:k%2?'101':'102'}));}
  if(i===5+1||i===36)rows.push(rows[0].slice(0,1).concat([date+'T09:00:00Z'],rows[0].slice(2)));
  raw+=rows.length;history.push({date,rows});
 }
 const w=world({history,now:'2026-11-23T03:00:00Z'});
 w.props.set('HOJA_V4_COMMIT_WATERMARK',JSON.stringify({row:w.sealedPrefix,tag:w.call('hojaV4uSha256_("W|copy40").slice(0,16)')}));
 const s=w.rpc('getPublicUsageStatisticsV4');
 assert.equal(s.status,'OK');
 assert.equal(raw-2,n);assert.equal(s.totals.all,n);
 assert.equal(s.daily.length,62);assert.equal(s.daily.filter(x=>x.count===0).length,5);
 assert.equal(w.sealedPrefix,raw+1);
 void CORE;void EVENT_HEADER;
});
