/* HOJA / SMQ usage statistics V4 — NEW ENGINE (experimental, pure V8 JS).
 * Historical semantic compatibility: Project B getUsageStatisticsU2().
 * Data boundary: only PUBLIC events, with a valid Asia/Seoul day.
 * One source event => one play and one combined-title selection, while
 * each separately selected PUBLIC unit gets its own UNIT_SELECTION count.
 * No network, spreadsheet calls, ranking, student/device/IP identifiers,
 * token/session logic, deletion or scheduler. Auth remains Project B's.
 * A verified ZERO-usage day is a snapshot, never a fabricated missing day.
 */
var HOJA_USAGE_V4_CORE=(function(){
 'use strict';
 const SCHEMA='HOJA_USAGE_V4_DAILY_V1',DAY_MS=86400000;
 const HEADER=['eventId','timestamp','date','mode','repositoryKind','grade',
  'subject','publisher','cartridge','cartridgeCount','teamCount',
  'cartridgeIds','publicRepositoryNamespace','usageSchemaVersion','cartridgeTitlesJson'];
 const dims=['MODE','TEAM_SIZE','GRADE','SUBJECT','PUBLISHER','CARTRIDGE_COMBINATION',
  'UNIT_SELECTION'];
 const assert=(ok,what)=>{if(!ok)throw Error('HOJA_V4_'+what);};
 const str=(v,max=1024)=>{
  const s=String(v==null?'':v).trim();
  assert(s.length<=max,'TEXT_LENGTH');return s;
 };
 const dateMs=d=>{
  assert(typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d),'DATE_FORMAT');
  const ms=Date.parse(d+'T00:00:00.000Z');
  assert(Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===d,'DATE_INVALID');
  return ms;
 };
 const keyDate=ms=>new Date(ms).toISOString().slice(0,10);
 const shares=(map,total)=>[...map].map(([label,count])=>({
  label,count,share:total?count*100/total:0
 })).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'ko'));
 const validInt=(n,label)=>assert(Number.isSafeInteger(n)&&n>=0,'COUNT_'+label);
 const add=(map,k,n=1)=>map.set(k,(map.get(k)||0)+n);
 const normalize=(row)=>{
  assert(Array.isArray(row)&&row.length>=11,'ROW');
  const kind=str(row[4],32).toUpperCase();
  if(kind!=='PUBLIC')return null; // PRIVATE / unknown ignored, always
  const date=str(row[2],32);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null; // existing U2 behavior
  dateMs(date);
  const eventId=str(row[0],128);
  assert(eventId,'MISSING_EVENT_ID');
  const mode=str(row[3],32).toUpperCase()||'기타';
  const grade=str(row[5],32);
  const subject=str(row[6],128)||'기타';
  const publisher=str(row[7],128);
  const combo=str(row[8],1024)||'이름 없는 카트리지';
  const sizeRaw=str(row[10],24),size=Number(sizeRaw);
  const teamSize=mode==='TEAM'&&sizeRaw&&Number.isInteger(size)&&size>=2&&size<=7?
   size:null;
  const idsText=str(row[11],2048),namespace=str(row[12],256);
  const ids=idsText?idsText.split('|').map(x=>str(x,128)).filter(Boolean):[];
  const uniqueIds=new Set(ids);
  assert(ids.length<=5&&uniqueIds.size===ids.length,'SELECTED_UNIT_IDS');
  let titles=[];
  if(row[14]!=null&&String(row[14]).trim()){
   try{const parsed=JSON.parse(String(row[14]));
    if(Array.isArray(parsed))titles=parsed.map(x=>str(x,256));
   }catch(_err){} // malformed optional historical metadata is unresolved
  }
  const units=ids.length&&namespace.startsWith('PUBLIC:')?
   ids.map((id,i)=>({key:namespace+'|SHEET:'+id,label:titles[i]||('sheet '+id)})):[];
  return {
   eventId,date,mode,teamSize,grade:grade?grade+'학년':'기타',subject,publisher,
   combination:combo,units,unresolvedUnits:units.length===0
  };
 };
 function snapshot(date,rows,options){
  const target=str(date,32);dateMs(target);
  assert(Array.isArray(rows),'INPUT_ROWS');
  const opts=options||{};
  assert(opts.coverageVerified===true,'COVERAGE_NOT_VERIFIED');
  const counts=Object.fromEntries(dims.map(k=>[k,new Map()]));
  const unitLabels=new Map();
  const ids=new Set(),events=[];
  let ignoredPrivate=0,ignoredOtherDay=0,starts=0,unknownUnitStarts=0;
  for(const r of rows){
   const e=normalize(r);
   if(!e){ignoredPrivate++;continue;}
   if(e.date!==target){ignoredOtherDay++;continue;}
   assert(!ids.has(e.eventId),'DUPLICATE_EVENT_ID');
   ids.add(e.eventId);events.push(e);starts++;
   add(counts.MODE,e.mode);
   if(e.mode==='TEAM')add(counts.TEAM_SIZE,e.teamSize?e.teamSize+'팀전':'인원 미확인');
   add(counts.GRADE,e.grade);add(counts.SUBJECT,e.subject);
   if(e.publisher)add(counts.PUBLISHER,e.publisher);
   add(counts.CARTRIDGE_COMBINATION,e.combination);
   if(e.unresolvedUnits)unknownUnitStarts++;
   else for(const item of e.units){
    add(counts.UNIT_SELECTION,item.key);
    unitLabels.set(item.key,item.label);
   }
  }
  const buckets=[];
  for(const dimension of dims)
   for(const [key,count] of counts[dimension]){
    validInt(count,'BUCKET');
    buckets.push({dimension,key,count,
     displayLabel:dimension==='UNIT_SELECTION'?(unitLabels.get(key)||key):key});
   }
  buckets.sort((a,b)=>a.dimension.localeCompare(b.dimension)||
   a.key.localeCompare(b.key));
  const total=dimension=>buckets.filter(r=>r.dimension===dimension)
   .reduce((n,r)=>n+r.count,0);
  for(const dim of ['MODE','GRADE','SUBJECT','CARTRIDGE_COMBINATION'])
   assert(total(dim)===starts,'PARITY_'+dim);
  assert(total('PUBLISHER')<=starts,'PARITY_PUBLISHER');
  const teams=counts.MODE.get('TEAM')||0;
  assert(total('TEAM_SIZE')===teams,'PARITY_TEAM_SIZE');
  // No PII or eventId is exposed in published counters. Hash a deterministic
  // source proof only in the isolated GAS writer; do not store canonicalSource
  // in public spreadsheets or return it to the Manager UI.
  const canonicalSource=JSON.stringify(events.sort((a,b)=>a.eventId.localeCompare(b.eventId)));
  return {
   schema:SCHEMA,date:target,starts,buckets,
   unitSelectionCount:total('UNIT_SELECTION'),unknownUnitStarts,
   ignoredPrivate,ignoredOtherDay,sourceRows:rows.length,
   canonicalSource
  };
 }
 function validateSnapshot(day,hashBuckets){
  assert(typeof hashBuckets==='function','SHA256_VERIFIER_REQUIRED');
  assert(day&&day.schema===SCHEMA,'SNAPSHOT_SCHEMA');
  const date=str(day.date,32);dateMs(date);
  assert(day.status==='COMPLETE'&&day.verified===true,'SNAPSHOT_UNPUBLISHED');
  assert(/^[a-f0-9]{64}$/i.test(String(day.sourceDigest||'')),'SNAPSHOT_DIGEST');
  assert(/^[a-f0-9]{64}$/i.test(String(day.bucketDigest||'')),'SNAPSHOT_BUCKET_DIGEST');
  assert(hashBuckets(JSON.stringify(day.buckets))===day.bucketDigest,
   'SNAPSHOT_BUCKET_DIGEST_MISMATCH');
  const starts=Number(day.starts);validInt(starts,'STARTS');
  assert(Array.isArray(day.buckets),'SNAPSHOT_BUCKETS');
  const seen=new Set(),totals=new Map();
  for(const r of day.buckets){
   assert(dims.includes(r.dimension),'BUCKET_KIND');
   const key=str(r.key,1024);assert(key,'BUCKET_EMPTY_KEY');
   const id=JSON.stringify([r.dimension,key]);
   assert(!seen.has(id),'DUPLICATE_BUCKET');seen.add(id);
   const count=Number(r.count);validInt(count,'BUCKET');
   totals.set(r.dimension,(totals.get(r.dimension)||0)+count);
  }
  for(const kind of ['MODE','GRADE','SUBJECT','CARTRIDGE_COMBINATION'])
   assert((totals.get(kind)||0)===starts,'SNAPSHOT_PARITY_'+kind);
  assert((totals.get('PUBLISHER')||0)<=starts,'SNAPSHOT_PUBLISHER');
  const teams=day.buckets.find(x=>x.dimension==='MODE'&&x.key==='TEAM')?.count||0;
  assert((totals.get('TEAM_SIZE')||0)===teams,'SNAPSHOT_TEAM_SIZE');
  return {date,starts,buckets:day.buckets};
 }
 const splitDayKeys=(from,to)=>{
  const a=dateMs(from),b=dateMs(to);assert(b>=a,'BAD_RANGE');
  const n=Math.round((b-a)/DAY_MS)+1;
  assert(n<=366,'MAX_DAYS');
  return Array.from({length:n},(_,i)=>keyDate(a+i*DAY_MS));
 };
 function report(allSnapshots,opts){
  assert(opts&&typeof opts==='object','OPTIONS');
  const asOf=str(opts.asOf,32),historyStart=str(opts.historyStart,32);
  dateMs(asOf);dateMs(historyStart);
  assert(historyStart<=asOf,'HISTORY_RANGE');
  assert(opts.initialHistoryAudited===true,'HISTORY_START_NOT_AUDITED');
  assert(Array.isArray(allSnapshots),'SNAPSHOTS');
  const byDate=new Map();
  for(const s of allSnapshots){
   const valid=validateSnapshot(s,opts.hashBuckets);
   assert(valid.date>=historyStart&&valid.date<=asOf,'SNAPSHOT_OUTSIDE_RANGE');
   assert(!byDate.has(valid.date),'DUPLICATE_DATE');
   byDate.set(valid.date,valid);
  }
  const days=splitDayKeys(historyStart,asOf);
  const missing=days.filter(d=>!byDate.has(d));
  assert(missing.length===0,'MISSING_DAILY_COVERAGE_'+missing[0]);
  const ordered=days.map(date=>byDate.get(date));
  const total=ordered.reduce((n,r)=>n+r.starts,0);
  const mappings=Object.fromEntries(dims.map(x=>[x,new Map()]));
  const daily=[];
  for(const row of ordered){
   daily.push({date:row.date,count:row.starts});
   for(const b of row.buckets)add(mappings[b.dimension],b.key,b.count);
  }
  const window=n=>ordered.slice(-n).reduce((a,b)=>a+b.starts,0);
  const mode=shares(mappings.MODE,total),team=mode.find(x=>x.label==='TEAM')?.count||0;
  const teamCount=shares(mappings.TEAM_SIZE,team);
  const grade=shares(mappings.GRADE,total),subject=shares(mappings.SUBJECT,total);
  const publisher=shares(mappings.PUBLISHER,total);
  const topCartridges=shares(mappings.CARTRIDGE_COMBINATION,total).slice(0,20);
  const today=byDate.get(asOf).starts;
  const totals={today,days7:window(7),days30:window(30),all:total};
  return {
   generatedAt:opts.generatedAt||new Date().toISOString(),scope:'PUBLIC_ONLY',
   accessRole:opts.accessRole||'',totals,daily,mode,teamCount,
   repositoryKind:total?[{label:'PUBLIC',count:total,share:100}]:[],
   grade,subject,publisher,topCartridges,
   // The original RPC remains unchanged. This field is only in trial envelope.
   __meta:{schema:SCHEMA,historyStart,asOf,coverageDays:days.length,
    source:'VERIFIED_V4_SUMMARIES_ONLY',unitSelections:
     [...mappings.UNIT_SELECTION.values()].reduce((a,b)=>a+b,0)}
  };
 }
 return Object.freeze({SCHEMA,HEADER:HEADER.slice(),normalize,snapshot,
  validateSnapshot,report,splitDayKeys});
})();
