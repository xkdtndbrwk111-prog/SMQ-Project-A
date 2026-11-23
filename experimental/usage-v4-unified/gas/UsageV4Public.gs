/* HOJA V4 PUBLIC statistics — pure V8 JS (no Sheets/Cache/network calls).
 * Project A single-GAS (40-6-U). Anyone may read the OUTPUT of publicView();
 * nothing here writes, deletes, re-aggregates storage or reads identities.
 *
 * project(): verified COMPLETE past days + committed raw tail (rows after the
 *   last sealed sourcePrefixEndRow up to the commit watermark). Every unsealed
 *   day in the tail (today, plus at most 3 not-yet-sealed earlier days right
 *   after midnight) is LIVE_PROVISIONAL. Any integrity doubt throws; callers
 *   must never translate a throw into zero counts.
 * publicView(): builds a NEW object from a fixed allowlist; label sanitizing
 *   and small-cell suppression (k=5) for cartridge combinations.
 */
var HOJA_USAGE_V4_PUBLIC=(function(){
 'use strict';
 const SCHEMA='HOJA_PUBLIC_USAGE_V4';
 const K_MIN=5,MAX_UNSEALED_PAST_DAYS=3,MAX_TAIL=25000,DAY=86400000;
 const OTHER_CART='기타 공개 카트리지',SMALL_CART='기타(소수)';
 const assert=(ok,code)=>{if(!ok)throw Error('HOJA_V4_PUBLIC_'+code);};
 const dayMs=d=>{
  assert(typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d),'DAY_FORMAT');
  const t=Date.parse(d+'T00:00:00.000Z');
  assert(Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===d,'DAY_INVALID');
  return t;
 };
 const dayFrom=ms=>new Date(ms).toISOString().slice(0,10);
 const EVENT_ID=/^[a-f0-9-]{32,40}$/i;
 /* A committed tail row must be a COMPLETE U3S1 PUBLIC game start. */
 function validTailRow(row){
  return Array.isArray(row)&&row.length>=15&&
   EVENT_ID.test(String(row[0]||'').trim())&&
   String(row[1]||'').trim()!==''&&
   /^\d{4}-\d{2}-\d{2}$/.test(String(row[2]||'').trim())&&
   ['SOLO','TEAM'].includes(String(row[3]||'').trim().toUpperCase())&&
   String(row[4]||'').trim()==='PUBLIC'&&
   /^[0-9]{1,11}(\|[0-9]{1,11}){0,4}$/.test(String(row[11]||'').trim())&&
   String(row[13]||'').trim()==='U3S1';
 }
 function project(core,past,tailRows,options){
  const o=options||{};
  assert(core&&typeof core.snapshot==='function'&&
   typeof core.validateSnapshot==='function','CORE_REQUIRED');
  assert(typeof o.hashBuckets==='function','SHA256_REQUIRED');
  assert(o.initialHistoryAudited===true,'HISTORY_NOT_AUDITED');
  const asOf=String(o.asOf||''),historyStart=String(o.historyStart||'');
  const asMs=dayMs(asOf);dayMs(historyStart);
  assert(historyStart<=asOf,'HISTORY_RANGE');
  assert(Array.isArray(past)&&Array.isArray(tailRows),'ROWS_REQUIRED');
  const prefix=o.certifiedPrefixEndRow,W=o.committedWatermark;
  assert(Number.isSafeInteger(prefix)&&prefix>=1,'PREFIX_REQUIRED');
  assert(Number.isSafeInteger(W)&&W>=prefix,'WATERMARK_BEHIND_SEALED_PREFIX');
  assert(tailRows.length===W-prefix,'TAIL_LENGTH_INCONSISTENT');
  assert(tailRows.length<=MAX_TAIL,'TAIL_TOO_LARGE');
  // 1) sealed history: contiguous COMPLETE days from historyStart
  const sealedEnd=past.length?past[past.length-1].date:dayFrom(dayMs(historyStart)-DAY);
  assert(sealedEnd<asOf,'SEALED_TODAY_OR_FUTURE');
  const expected=past.length?core.splitDayKeys(historyStart,sealedEnd):[];
  assert(expected.length===past.length,'HISTORICAL_COVERAGE_MISSING');
  let prev=o.initialPrefixEndRow===undefined?1:o.initialPrefixEndRow;
  assert(Number.isSafeInteger(prev)&&prev>=1,'INITIAL_PREFIX_INVALID');
  const maps=new Map(),daily=[];
  const add=(dim,key,n)=>{if(!maps.has(dim))maps.set(dim,new Map());
   const m=maps.get(dim);m.set(key,(m.get(key)||0)+n);};
  for(let i=0;i<past.length;i++){
   const s=past[i],date=expected[i];
   assert(s&&s.date===date,'MISSING_OR_UNSORTED_SEALED_DATE');
   const v=core.validateSnapshot(s,o.hashBuckets);
   const raw=Number(s.sourceRowCount),next=Number(s.sourcePrefixEndRow);
   assert(Number.isSafeInteger(raw)&&raw>=0&&next===prev+raw,'SOURCE_PREFIX_NOT_CONTIGUOUS');
   assert(Number(s.starts)+Number(s.retriesSuppressed||0)===raw,'SOURCE_ROW_START_PARITY');
   if(raw===0)assert(Number(s.sourceStartRow)===0&&Number(s.sourceEndRow)===0,'ZERO_DAY_ROW_RANGE');
   else assert(Number(s.sourceStartRow)===prev+1&&Number(s.sourceEndRow)===next,'SEALED_ROW_RANGE');
   prev=next;
   daily.push({date,count:v.starts});
   for(const b of v.buckets)add(b.dimension,b.key,Number(b.count));
  }
  assert(prev===prefix,'SOURCE_WATERMARK_MISMATCH');
  // 2) unsealed tail: strictly validated, non-decreasing, within (sealedEnd, asOf]
  const unsealed=core.splitDayKeys(dayFrom(dayMs(sealedEnd)+DAY),asOf);
  assert(unsealed.length-1<=MAX_UNSEALED_PAST_DAYS,'SEAL_STALE');
  const byDay=new Map(unsealed.map(d=>[d,[]]));
  const firstDay=new Map();let last='';
  for(const row of tailRows){
   assert(validTailRow(row),'PARTIAL_OR_UNEXPECTED_TAIL_ROW');
   const d=String(row[2]).trim();
   assert(byDay.has(d),'LATE_OR_FUTURE_EVENT_DAY');
   assert(d>=last,'UNSORTED_TAIL');last=d;
   const id=String(row[0]).trim();
   assert(!firstDay.has(id)||firstDay.get(id)===d,'CROSS_DAY_DUPLICATE_EVENT_ID');
   firstDay.set(id,d);
   byDay.get(d).push(row);
  }
  let todayStarts=0;
  for(const d of unsealed){
   const snap=core.snapshot(d,byDay.get(d),{coverageVerified:true});
   assert(snap.sourceRows===byDay.get(d).length&&snap.ignoredPrivate===0&&
    snap.ignoredOtherDay===0,'LIVE_SOURCE_COUNT');
   daily.push({date:d,count:snap.starts});
   for(const b of snap.buckets)add(b.dimension,b.key,b.count);
   if(d===asOf)todayStarts=snap.starts;
  }
  assert(daily.length===core.splitDayKeys(historyStart,asOf).length,'DAILY_COVERAGE');
  const dim=n=>maps.get(n)||new Map();
  const sum=n=>[...dim(n).values()].reduce((a,b)=>a+b,0);
  const all=daily.reduce((a,b)=>a+b.count,0),team=dim('MODE').get('TEAM')||0;
  for(const n of ['MODE','GRADE','SUBJECT','CARTRIDGE_COMBINATION'])
   assert(sum(n)===all,'TOTAL_PARITY_'+n);
  assert(sum('PUBLISHER')<=all&&sum('TEAM_SIZE')===team,'TOTAL_FACET_PARITY');
  const upto=n=>daily.slice(-n).reduce((a,r)=>a+r.count,0);
  return {asOf,historyStart,sealedThrough:past.length?sealedEnd:'',
   provisionalDays:unsealed.slice(),
   totals:{today:todayStarts,days7:upto(7),days30:upto(30),all},
   daily,maps};
 }
 // ---------- public allowlist ----------
 const CART_PART=/^[3-6]-(국어|영어|수학|사회|과학|도덕|음악|미술|체육|실과)-[^-|]{1,20}-.{1,60}$/;
 const RISKY=/@|https?:|www\.|\d{2,4}-\d{3,4}-\d{4}|학교|초등|중학|선생|교사|학생|[0-9]+반\b|[0-9]+반$/;
 function safeCartridgeLabel(label){
  const s=String(label==null?'':label).trim();
  if(!s||s.length>300)return OTHER_CART;
  const parts=s.split(' | ');
  if(parts.length>5)return OTHER_CART;
  for(const p of parts)if(!CART_PART.test(p)||RISKY.test(p))return OTHER_CART;
  return s;
 }
 const safeShortLabel=(label,max)=>{
  const s=String(label==null?'':label).trim();
  return s&&s.length<=max&&/^[가-힣A-Za-z0-9 ()·.]+$/.test(s)&&!RISKY.test(s)?s:'기타';
 };
 const fixedModes=new Set(['SOLO','TEAM']);
 function listOf(map,total,mapLabel){
  const merged=new Map();
  for(const [k,v] of map){const l=mapLabel(k);merged.set(l,(merged.get(l)||0)+v);}
  return [...merged].map(([label,count])=>({label,count,
   share:total?Math.round(count*10000/total)/100:0}))
   .sort((a,b)=>b.count-a.count||(a.label<b.label?-1:a.label>b.label?1:0));
 }
 function topCartridges(map,total){
  const merged=new Map();
  for(const [k,v] of map){const l=safeCartridgeLabel(k);merged.set(l,(merged.get(l)||0)+v);}
  let small=0;const kept=[];
  for(const [label,count] of merged){
   if(label!==OTHER_CART&&count<K_MIN)small+=count;
   else kept.push([label,count]);
  }
  if(small)kept.push([SMALL_CART,small]);
  return kept.map(([label,count])=>({label,count,
   share:total?Math.round(count*10000/total)/100:0}))
   .sort((a,b)=>b.count-a.count||(a.label<b.label?-1:a.label>b.label?1:0)).slice(0,20);
 }
 function publicView(p,meta){
  const m=meta||{};
  const dim=n=>p.maps.get(n)||new Map();
  const all=p.totals.all,team=dim('MODE').get('TEAM')||0;
  const int=x=>{assert(Number.isSafeInteger(x)&&x>=0,'COUNT');return x;};
  return {
   schema:SCHEMA,status:'OK',
   asOf:String(p.asOf),historyStart:String(p.historyStart),
   generatedAt:String(m.generatedAt||new Date().toISOString()),
   todayStatus:'LIVE_PROVISIONAL',historyStatus:'COMPLETE',
   provisionalDays:p.provisionalDays.map(String),
   cache:{ageSeconds:int(m.ageSeconds||0),maxAgeSeconds:int(m.maxAgeSeconds||0),
    stale:m.stale===true},
   totals:{today:int(p.totals.today),days7:int(p.totals.days7),
    days30:int(p.totals.days30),all:int(all)},
   daily:p.daily.map(r=>({date:String(r.date),count:int(r.count)})),
   mode:listOf(dim('MODE'),all,k=>fixedModes.has(k)?k:'기타'),
   teamCount:listOf(dim('TEAM_SIZE'),team,k=>/^[2-7]팀전$/.test(k)?k:'인원 미확인'),
   grade:listOf(dim('GRADE'),all,k=>/^[1-6]학년$/.test(k)?k:'기타'),
   subject:listOf(dim('SUBJECT'),all,k=>safeShortLabel(k,20)),
   publisher:listOf(dim('PUBLISHER'),all,k=>safeShortLabel(k,30)),
   topCartridges:topCartridges(dim('CARTRIDGE_COMBINATION'),all)
  };
 }
 /* Internal error text -> fixed public code; never leaks rows/IDs/messages. */
 function publicErrorCode(err){
  const s=String(err&&err.message||err||'');
  const table=[
   [/NOT_CONFIGURED|ISOLATION|CANARY|PRODUCTION_ID|NOT_INITIALIZED|AUDIT/,'NOT_CONFIGURED'],
   [/RATE_LIMIT/,'RATE_LIMITED'],
   [/SEAL_STALE/,'SEAL_STALE'],
   [/LATE_OR_FUTURE|UNSORTED|CROSS_DAY/,'LATE_OR_UNSORTED_EVENT'],
   [/PARTIAL|UNEXPECTED_TAIL/,'PARTIAL_ROW'],
   [/CHANGED_DURING_READ|BUSY/,'BUSY_RETRY'],
   [/TOO_LARGE|READ_LIMIT/,'READ_LIMIT'],
   [/DIGEST|PARITY|PREFIX|COVERAGE|SNAPSHOT|BUCKET|WATERMARK|SEALED|DUPLICATE|MISSING/,'INTEGRITY']
  ];
  for(const [re,code] of table)if(re.test(s))return code;
  return 'INTERNAL';
 }
 function unavailable(err,generatedAt){
  return {schema:SCHEMA,status:'UNAVAILABLE',code:publicErrorCode(err),
   generatedAt:String(generatedAt||new Date().toISOString())};
 }
 return Object.freeze({SCHEMA,K_MIN,MAX_UNSEALED_PAST_DAYS,validTailRow,project,
  publicView,publicErrorCode,unavailable,safeCartridgeLabel});
})();
