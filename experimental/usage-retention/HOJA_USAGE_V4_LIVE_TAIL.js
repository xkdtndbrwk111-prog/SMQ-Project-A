/* HOJA V4 certified-history + mutable-today tail, independent pure JS.
 * Caller must have already verified that the live tail begins immediately
 * after the final SEALED historical sourcePrefixEndRow.
 * Historical days: COMPLETE + SHA256 checked, including explicit 0-use days.
 * Today: LIVE_PROVISIONAL, recomputed per request; never published/deleted.
 * Does not read Sheets or decide OWNER/GOOGLE CREATOR authorization.
 */
var HOJA_USAGE_V4_LIVE_TAIL=(function(){
 'use strict';
 const assert=(yes,code)=>{if(!yes)throw Error('HOJA_V4_LIVE_'+code);};
 const toDay=d=>{
  assert(typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d),'DAY_FORMAT');
  const time=Date.parse(d+'T00:00:00.000Z');
  assert(Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===d,'DAY_INVALID');
  return time;
 };
 const dayFrom=ms=>new Date(ms).toISOString().slice(0,10);
 const share=(map,total)=>[...map].map(([label,count])=>({
  label,count,share:total?count*100/total:0
 })).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'ko'));
 function project(core,past,todayRows,options){
  const opts=options||{};
  assert(core&&typeof core.snapshot==='function'&&
   typeof core.validateSnapshot==='function','CORE_REQUIRED');
  const asOf=String(opts.asOf||''),historyStart=String(opts.historyStart||'');
  const asMs=toDay(asOf),firstMs=toDay(historyStart);
  assert(firstMs<asMs,'NO_CERTIFIED_PREVIOUS_DAY');
  assert(opts.initialHistoryAudited===true,'INITIAL_HISTORY_NOT_AUDITED');
  assert(typeof opts.hashBuckets==='function','SHA256_REQUIRED');
  assert(Array.isArray(past)&&Array.isArray(todayRows),'ROWS_REQUIRED');
  const prefix=opts.certifiedPrefixEndRow,last=opts.sourceLastRow;
  assert(Number.isSafeInteger(prefix)&&prefix>=1,'CERTIFIED_WATERMARK_REQUIRED');
  assert(Number.isSafeInteger(last)&&last>=prefix,'SOURCE_LAST_ROW_INVALID');
  assert(todayRows.length===last-prefix,'TAIL_LENGTH_INCONSISTENT');
  assert(todayRows.length<=25000,'TAIL_TOO_LARGE');
  const yesterday=dayFrom(asMs-86400000),expectedDays=core.splitDayKeys(historyStart,yesterday);
  assert(past.length===expectedDays.length,'HISTORICAL_COVERAGE_MISSING');
  const historical=[],buckets=new Map(),modes=new Map(),daily=[];
  let prevPrefix=opts.initialPrefixEndRow===undefined?1:opts.initialPrefixEndRow;
  assert(Number.isSafeInteger(prevPrefix)&&prevPrefix>=1,'INITIAL_PREFIX_INVALID');
  function addDimension(b){
   if(!buckets.has(b.dimension))buckets.set(b.dimension,new Map());
   const m=buckets.get(b.dimension);
   m.set(b.key,(m.get(b.key)||0)+b.count);
  }
  for(let i=0;i<past.length;i++){
   const s=past[i],date=expectedDays[i];
   assert(s.date===date,'MISSING_OR_UNSORTED_CERTIFIED_DATE_'+date);
   const validated=core.validateSnapshot(s,opts.hashBuckets);
   const rawCount=Number(s.sourceRowCount),newPrefix=Number(s.sourcePrefixEndRow);
   assert(Number.isSafeInteger(rawCount)&&rawCount>=0&&
    Number.isSafeInteger(newPrefix)&&newPrefix===prevPrefix+rawCount,
    'SOURCE_PREFIX_NOT_CONTIGUOUS_'+date);
   assert(Number(s.starts)+Number(s.retriesSuppressed||0)===rawCount,
    'SOURCE_ROW_START_PARITY_'+date);
   if(rawCount===0)assert(Number(s.sourceStartRow)===0&&Number(s.sourceEndRow)===0,
    'ZERO_DAY_ROW_RANGE_'+date);
   else assert(Number(s.sourceStartRow)===prevPrefix+1&&
    Number(s.sourceEndRow)===newPrefix,'SEALED_SOURCE_ROW_RANGE_'+date);
   prevPrefix=newPrefix;
   historical.push(validated);
   daily.push({date,count:validated.starts});
   for(const b of validated.buckets)addDimension(b);
  }
  assert(prevPrefix===prefix,'SOURCE_WATERMARK_MISMATCH');
  for(const row of todayRows){
   assert(Array.isArray(row)&&String(row[2]||'').trim()===asOf,
    'LATE_OR_FUTURE_EVENT_DAY');
  }
  const live=core.snapshot(asOf,todayRows,{coverageVerified:true});
  assert(live.sourceRows===todayRows.length,'LIVE_SOURCE_COUNT');
  daily.push({date:asOf,count:live.starts});
  for(const b of live.buckets)addDimension(b);
  const dim=name=>buckets.get(name)||new Map();
  const sum=name=>[...dim(name).values()].reduce((n,v)=>n+v,0);
  const all=daily.reduce((n,x)=>n+x.count,0),team=dim('MODE').get('TEAM')||0;
  for(const d of ['MODE','GRADE','SUBJECT','CARTRIDGE_COMBINATION'])
   assert(sum(d)===all,'TOTAL_PARITY_'+d);
  assert(sum('PUBLISHER')<=all&&sum('TEAM_SIZE')===team,'TOTAL_FACET_PARITY');
  const upto=n=>daily.slice(-n).reduce((a,r)=>a+r.count,0);
  const preview={
   generatedAt:opts.generatedAt||new Date().toISOString(),
   scope:'PUBLIC_ONLY',accessRole:opts.accessRole||'',
   totals:{today:live.starts,days7:upto(7),days30:upto(30),all},
   daily,mode:share(dim('MODE'),all),teamCount:share(dim('TEAM_SIZE'),team),
   repositoryKind:all?[{label:'PUBLIC',count:all,share:100}]:[],
   grade:share(dim('GRADE'),all),subject:share(dim('SUBJECT'),all),
   publisher:share(dim('PUBLISHER'),all),
   topCartridges:share(dim('CARTRIDGE_COMBINATION'),all).slice(0,20)
  };
  return {
   ok:true,source:'VERIFIED_V4_PAST_PLUS_MUTABLE_COPY_TODAY',
   todayStatus:'LIVE_PROVISIONAL',historyStatus:'COMPLETE',
   productionSwitchAllowed:false,rawDeletion:'HOLD',
   originalRpcUnmodified:true,
   preview,summary:{
    asOf,historyStart,verifiedPastDays:expectedDays.length,
    certifiedPrefixEndRow:prefix,observedSourceLastRow:last,
    mutableTodayRawRows:todayRows.length,todayUniqueStarts:live.starts,
    todayRetriesSuppressed:live.retriesSuppressed,
    legacyRetriesExcludedFromAll:past.reduce((n,x)=>n+Number(x.retriesSuppressed||0),0)
   }
  };
 }
 return Object.freeze({project});
})();
