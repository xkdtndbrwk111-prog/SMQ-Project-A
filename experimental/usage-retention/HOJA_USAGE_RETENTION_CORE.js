/* HOJA anonymous usage retention — pure preview engine (trial only).
 * Safe in Apps Script V8 and Node VM; no SpreadsheetApp, deletes, triggers,
 * network, credentials, rankings, student names or device IDs.
 * Input: existing U3S1 EVENT_LOG 15-column arrays or anonymous event objects.
 * Daily: unique starts by eventId; per-cartridge counts are NOT total starts.
 * Monthly: sum ONLY completed, unique daily snapshot generations after verifying
 * that the full month has its day manifest entries (including zero-usage days).
 */
var HOJA_USAGE_RETENTION_CORE=(function(){
 'use strict';
 const HEADER=['eventId','timestamp','date','mode','repositoryKind','grade','subject','publisher',
  'cartridge','cartridgeCount','teamCount','cartridgeIds','publicRepositoryNamespace',
  'usageSchemaVersion','cartridgeTitlesJson'];
 const COUNT_FIELDS=['starts','completed','timeUp','otherEnded','unknownEnded',
  'correctTotal','answeredTotal','durationSecondsTotal','durationSamples'];
 const DAY=86400000;
 function assert(ok,message){if(!ok)throw Error('HOJA_USAGE_RETENTION_'+message);}
 function dateMs(s){
  assert(typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s),'DATE_FORMAT');
  const ms=Date.parse(s+'T00:00:00.000Z');
  assert(Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===s,'DATE_INVALID');
  return ms;
 }
 function dayKey(s){dateMs(s);return s;}
 function monthKey(s){return dayKey(s).slice(0,7);}
 function text(s,max){
  const v=String(s==null?'':s).trim();
  assert(v.length<=max,'TEXT_TOO_LONG');
  return v;
 }
 function addCounters(row,source){
  for(const k of COUNT_FIELDS)row[k]+=source[k]||0;
  for(const [k,v] of Object.entries(source.teamCounts||{}))
   row.teamCounts[k]=(row.teamCounts[k]||0)+v;
 }
 function zeroCounters(){return {
  starts:0,completed:0,timeUp:0,otherEnded:0,unknownEnded:0,
  correctTotal:0,answeredTotal:0,durationSecondsTotal:0,durationSamples:0,teamCounts:{}
 };}
 function legacyRow(row){
  assert(Array.isArray(row)&&row.length>=HEADER.length,'LEGACY_ROW_LENGTH');
  const r={};
  HEADER.forEach((k,i)=>r[k]=row[i]);
  return r;
 }
 function normalizeEvent(value){
  const r=Array.isArray(value)?legacyRow(value):value;
  assert(r&&typeof r==='object','EVENT_OBJECT');
  const eventId=text(r.eventId,80);
  assert(/^[a-f0-9-]{32,40}$/i.test(eventId),'EVENT_ID');
  assert(!r.repositoryKind||r.repositoryKind==='PUBLIC','ONLY_PUBLIC');
  const date=dayKey(String(r.date||''));
  const mode=text(r.mode,24).toUpperCase();
  assert(/^[A-Z0-9_-]{2,24}$/.test(mode),'MODE');
  // Historical U3S1 events did not record which game was running.
  const gameId=text(r.gameId||'HOJA_LEGACY',48).toUpperCase();
  assert(/^[A-Z0-9_-]{2,48}$/.test(gameId),'GAME_ID');
  const grade=text(r.grade||'',12);
  const subject=text(r.subject||'',64);
  const publisher=text(r.publisher||'',64);
  // Existing Project B TOP20 counts the original combined cartridge title
  // once per game, not each individual selected unit.
  const cartridgeCombination=text(r.cartridge||'이름 없는 카트리지',500);
  const ids=Array.isArray(r.cartridgeIds)?r.cartridgeIds:
   String(r.cartridgeIds||'').split('|').filter(Boolean);
  // Some actual pre-U3S1 EVENT_LOG rows have L:O entirely empty.
  // Preserve their play counts without inventing a unit identity. The unknown
  // bucket means no per-unit historical detail can be reconstructed.
  const sourceWasLegacy=Array.isArray(value);
  const cartridgeIds=(sourceWasLegacy&&!ids.length?['LEGACY_UNRESOLVED']:ids)
   .map(x=>text(x,64));
  assert(cartridgeIds.length>=1&&cartridgeIds.length<=5 &&
   new Set(cartridgeIds).size===cartridgeIds.length,'CARTRIDGES');
  const teamCount=r.teamCount==null||r.teamCount===''?(mode==='TEAM'?null:1):Number(r.teamCount);
  assert(Number.isInteger(teamCount)&&teamCount>=1&&teamCount<=7,'TEAM_COUNT');
  assert(mode!=='TEAM'||teamCount>=2,'TEAM_MIN');
  const outcome=text(r.outcome||'UNKNOWN',16).toUpperCase();
  assert(['UNKNOWN','COMPLETED','TIME_UP','OTHER'].includes(outcome),'OUTCOME');
  const correct=r.correctTotal==null?null:Number(r.correctTotal);
  const answered=r.answeredTotal==null?null:Number(r.answeredTotal);
  const duration=r.durationSeconds==null?null:Number(r.durationSeconds);
  if(correct!==null||answered!==null){
   assert(Number.isInteger(correct)&&Number.isInteger(answered)&&
    correct>=0&&answered>=correct,'ANSWER_COUNTS');
  }
  if(duration!==null)assert(Number.isFinite(duration)&&duration>=0&&duration<=86400,'DURATION');
  return {eventId,date,mode,gameId,grade,subject,publisher,cartridgeCombination,
   cartridgeIds:cartridgeIds.sort(),teamCount,outcome,
   correctTotal:correct,answeredTotal:answered,durationSeconds:duration};
 }
 function statsFor(e){
  const c=zeroCounters();
  c.starts=1;
  if(e.outcome==='COMPLETED')c.completed=1;
  else if(e.outcome==='TIME_UP')c.timeUp=1;
  else if(e.outcome==='OTHER')c.otherEnded=1;
  else c.unknownEnded=1;
  if(e.correctTotal!==null){c.correctTotal=e.correctTotal;c.answeredTotal=e.answeredTotal;}
  if(e.durationSeconds!==null){c.durationSecondsTotal=e.durationSeconds;c.durationSamples=1;}
  c.teamCounts[String(e.teamCount)]=1;
  return c;
 }
 function createGroup(map,fields){
  const id=JSON.stringify(fields);
  if(!map.has(id))
   map.set(id,Object.assign({key:fields},zeroCounters()));
  return map.get(id);
 }
 function sortedGroup(map,cols){
  return [...map.values()].sort((a,b)=>JSON.stringify(a.key).localeCompare(JSON.stringify(b.key)))
   .map(g=>Object.assign(Object.fromEntries(cols.map((name,i)=>[name,g.key[i]])),
    Object.fromEntries(COUNT_FIELDS.map(k=>[k,g[k]])),
    {teamCounts:Object.fromEntries(Object.entries(g.teamCounts).sort((a,b)=>Number(a[0])-Number(b[0])))}));
 }
 function dailySnapshot(rows){
  assert(Array.isArray(rows),'EVENT_ARRAY');
  const unique=new Map(),totals=new Map(),dims=new Map(),facets=new Map();
  let replayCount=0;
  for(const value of rows){
   const e=normalizeEvent(value);
   const fingerprint=JSON.stringify(e);
   if(unique.has(e.eventId)){
    assert(unique.get(e.eventId)===fingerprint,'EVENT_ID_CONFLICT');
    replayCount++;continue;
   }
   unique.set(e.eventId,fingerprint);
   const count=statsFor(e);
   addCounters(createGroup(totals,[e.date,e.gameId,e.mode]),count);
   // Legacy Project B GRADE/SUBJECT/PUBLISHER charts count each PLAY
   // once, not once per selected cartridge. Do not derive these from
   // multi-cartridge selection dimensions (which intentionally overcount).
   const facetSelections=[
    ['GRADE',e.grade?e.grade+'학년':'기타'],
    ['SUBJECT',e.subject||'기타'],
    ['CARTRIDGE_COMBINATION',e.cartridgeCombination]
   ];
   if(e.publisher)facetSelections.push(['PUBLISHER',e.publisher]);
   for(const [dimension,key] of facetSelections){
    const g=createGroup(facets,[e.date,e.gameId,e.mode,dimension,key]);
    g.starts++;
   }
   // Multi-cartridge sessions reveal selections, NOT which cartridge supplied
   // individual answers or duration. Never duplicate game-wide correct/time
   // totals into every selected cartridge's usage dimension.
   const selection=zeroCounters();
   selection.starts=1;
   selection.teamCounts[String(e.teamCount)]=1;
   for(const id of e.cartridgeIds)
    addCounters(createGroup(dims,[e.date,e.gameId,e.mode,e.grade,e.subject,e.publisher,id]),selection);
  }
  const totalRows=sortedGroup(totals,['date','gameId','mode']);
  const dimensionRows=sortedGroup(dims,['date','gameId','mode','grade','subject','publisher','cartridgeId']);
  const facetRows=sortedGroup(facets,['date','gameId','mode','dimension','dimensionKey'])
   .map(r=>({date:r.date,gameId:r.gameId,mode:r.mode,dimension:r.dimension,
    dimensionKey:r.dimensionKey,displayLabel:r.dimensionKey,count:r.starts}));
  return {schema:'HOJA_USAGE_RETENTION_V1',sourceRows:rows.length,
   uniqueStarts:unique.size,retriesSuppressed:replayCount,
   totals:totalRows,dimensions:dimensionRows,facets:facetRows,
   // Feed canonicalSource to Utilities.computeDigest(SHA_256) when wiring GAS.
   canonicalSource:JSON.stringify([...unique].sort((a,b)=>a[0].localeCompare(b[0])))};
 }
 function verifiedMonthDays(month,verifiedDays){
  assert(/^\d{4}-\d{2}$/.test(month),'MONTH_FORMAT');
  const first=dateMs(month+'-01');
  const parts=month.split('-').map(Number);
  const days=new Date(Date.UTC(parts[0],parts[1],0)).getUTCDate();
  assert(Array.isArray(verifiedDays),'VERIFIED_DAYS_REQUIRED');
  const set=new Set(verifiedDays);
  for(let day=1;day<=days;day++){
   const d=new Date(first+(day-1)*DAY).toISOString().slice(0,10);
   assert(set.has(d),'INCOMPLETE_MONTH_'+d);
  }
 }
 function monthlySnapshot(daily,month,verifiedDays){
  assert(daily&&daily.schema==='HOJA_USAGE_RETENTION_V1','DAILY_SCHEMA');
  verifiedMonthDays(month,verifiedDays);
  const totals=new Map(),dims=new Map(),facets=new Map(),seenTotals=new Set(),seenDims=new Set(),seenFacets=new Set();
  const merge=(rows,map,fields,seen)=>{
   for(const row of rows){
    if(monthKey(row.date)!==month)continue;
    assert(verifiedDays.includes(row.date),'UNVERIFIED_DAILY_ROW');
    const key=JSON.stringify(fields.map(f=>row[f]));
    const unique=row.date+'|'+key;
    assert(!seen.has(unique),'DUPLICATE_DAILY_GENERATION');
    seen.add(unique);
    addCounters(createGroup(map,[month,...fields.map(f=>row[f])]),row);
   }
  };
  merge(daily.totals,totals,['gameId','mode'],seenTotals);
  merge(daily.dimensions,dims,['gameId','mode','grade','subject','publisher','cartridgeId'],seenDims);
  for(const r of daily.facets||[]){
   if(monthKey(r.date)!==month)continue;
   assert(verifiedDays.includes(r.date),'UNVERIFIED_DAILY_FACET');
   const key=JSON.stringify([r.date,r.gameId,r.mode,r.dimension,r.dimensionKey]);
   assert(!seenFacets.has(key),'DUPLICATE_DAILY_FACET');
   seenFacets.add(key);
   const g=createGroup(facets,[month,r.gameId,r.mode,r.dimension,r.dimensionKey]);
   g.starts+=r.count;
  }
  return {schema:'HOJA_USAGE_RETENTION_MONTHLY_V1',month,
   totals:sortedGroup(totals,['month','gameId','mode']),
   dimensions:sortedGroup(dims,['month','gameId','mode','grade','subject','publisher','cartridgeId']),
   facets:sortedGroup(facets,['month','gameId','mode','dimension','dimensionKey'])
    .map(r=>({month:r.month,gameId:r.gameId,mode:r.mode,dimension:r.dimension,
      dimensionKey:r.dimensionKey,displayLabel:r.dimensionKey,count:r.starts})),
   verifiedDayCount:new Set(verifiedDays.filter(d=>d.slice(0,7)===month)).size};
 }
 function previewRawPurge(args){
  // Read-only: this function never deletes or mutates any sheet or row.
  assert(args&&typeof args==='object','PLAN_ARGS');
  const asOf=dateMs(args.asOf),rows=Array.isArray(args.rawDates)?args.rawDates:[];
  const manifests=args.dailyManifests||{};
  return [...new Set(rows.map(dayKey))].sort().map(date=>{
   const daysOld=Math.floor((asOf-dateMs(date))/DAY),reason=[],m=manifests[date];
   if(daysOld<=30)reason.push('RECENT_30_DAYS');
   if(args.summaryReadersReady!==true)reason.push('SUMMARY_READERS_NOT_READY');
   if(args.backupVerified!==true)reason.push('BACKUP_NOT_VERIFIED');
   if(!m||m.status!=='COMPLETE'||m.verified!==true)reason.push('DAILY_SUMMARY_NOT_VERIFIED');
   if(m&&(!Number.isSafeInteger(m.rawCount)||m.rawCount<0||
      !Number.isSafeInteger(m.summaryCount)||m.rawCount!==m.summaryCount))
    reason.push('COUNT_MISMATCH');
   if(m&&!/^[0-9a-f]{64}$/i.test(String(m.contentDigest||'')))
    reason.push('DIGEST_NOT_VERIFIED');
   return {date,daysOld,eligibleForFutureApprovedPurge:reason.length===0,holds:reason};
  });
 }
 function previewDailyCompaction(args){
  // Monthly rollup plans, no destructive operations. Retain the last 12 full
  // calendar months of daily summaries. Compact only older complete months.
  assert(args&&typeof args==='object','MONTH_PLAN_ARGS');
  const asOf=dayKey(args.asOf);
  const ym=asOf.slice(0,7).split('-').map(Number);
  const first=new Date(Date.UTC(ym[0],ym[1]-1-12,1)).toISOString().slice(0,7);
  const months=Array.isArray(args.dailyMonths)?args.dailyMonths:[];
  const manifest=args.monthlyManifests||{};
  return [...new Set(months)].sort().map(month=>{
   assert(/^\d{4}-\d{2}$/.test(month),'COMPACT_MONTH_FORMAT');
   dateMs(month+'-01');
   const reasons=[],m=manifest[month];
   if(month>=first)reasons.push('RECENT_12_MONTHS');
   if(args.summaryReadersReady!==true)reasons.push('MONTHLY_READERS_NOT_READY');
   if(args.backupVerified!==true)reasons.push('DAILY_BACKUP_NOT_VERIFIED');
   if(!m||m.status!=='COMPLETE'||m.verified!==true)
    reasons.push('MONTHLY_SUMMARY_NOT_VERIFIED');
   if(m&&(!Number.isInteger(m.dailyStarts)||!Number.isInteger(m.monthlyStarts)||
    m.dailyStarts!==m.monthlyStarts))reasons.push('MONTHLY_COUNT_MISMATCH');
   if(m&&!/^[0-9a-f]{64}$/i.test(String(m.contentDigest||'')))
    reasons.push('MONTHLY_DIGEST_NOT_VERIFIED');
   return {month,eligibleForFutureApprovedCompaction:reasons.length===0,holds:reasons};
  });
 }
 return Object.freeze({HEADER:HEADER.slice(),normalizeEvent,dailySnapshot,
  monthlySnapshot,previewRawPurge,previewDailyCompaction});
})();
