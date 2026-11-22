/* Project B getUsageStatisticsU2() response projection — SHADOW / NOT LIVE.
 * Pure JS; consumes ONLY validated summary-reader day results. Never reads
 * EVENT_LOG, ranks, names, emails, class IDs, IPs, storage, or network.
 * Designed from user-supplied Project B UsageU2.gs (2026-11-23).
 * The live RPC and Google Creator/OWNER authorization remain unchanged.
 */
var HOJA_PROJECT_B_USAGE_SHADOW_V1=(function(){
 'use strict';
 const DAY=86400000;
 const assert=(truth,reason)=>{if(!truth)throw Error('HOJA_PROJECT_B_SHADOW_'+reason);};
 const isDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&
   new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 const dayMs=d=>{assert(isDay(d),'BAD_DATE');return Date.parse(d+'T00:00:00Z');};
 const shareRows=(map,total)=>[...map].map(([label,count])=>({
    label,count,share:total?count*100/total:0
   })).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'ko'));
 const sum=arr=>arr.reduce((a,b)=>a+b,0);
 const add=(map,key,n)=>map.set(key,(map.get(key)||0)+n);
 const finiteInt=(v,label)=>{
  assert(Number.isSafeInteger(v)&&v>=0,'BAD_COUNT_'+label);
  return v;
 };
 const dayRange=(from,to)=>{
  const a=dayMs(from),b=dayMs(to);
  assert(b>=a&&(b-a)/DAY<=365,'DATE_RANGE_OVER_LIMIT');
  const result=[];
  for(let k=a;k<=b;k+=DAY)result.push(new Date(k).toISOString().slice(0,10));
  return result;
 };
 const selectedWindow=(table,asOf,n)=>{
  const end=dayMs(asOf),keys=[];
  for(let i=n-1;i>=0;i--)keys.push(new Date(end-i*DAY).toISOString().slice(0,10));
  if(keys.some(k=>!table.has(k)))return null;
  return sum(keys.map(k=>table.get(k)));
 };
 function project(report,{accessRole,asOf}){
  assert(['OWNER','CREATOR'].includes(accessRole),'ACCESS_ROLE');
  assert(report&&report.ok===true&&report.authoritative===true&&
   report.completeCoverage===true&&!report.rawRead,'READER_NOT_AUTHORITATIVE');
  assert(Array.isArray(report.days)&&report.days.length>0,'DAY_ROWS');
  const today=asOf||new Date().toISOString().slice(0,10);
  dayMs(today);
  const days=new Map(),mode=new Map(),teamCounts=new Map(),grade=new Map(),
   subject=new Map(),publisher=new Map(),combinations=new Map();
  let total=0,solo=0,team=0,unknownTeams=0,combinationReady=true;
  for(const r of report.days){
   assert(r.available===true&&r.authoritative===true&&r.facetsReady===true,'DAY_UNVERIFIED');
   const date=r.requestedDate||r.date;
   dayMs(date);
   assert(r.date===date&&!days.has(date),'DUPLICATE_OR_BAD_DAY');
   const starts=finiteInt(r.starts,'STARTS'),s=finiteInt(r.solo,'SOLO'),t=finiteInt(r.team,'TEAM');
   assert(starts===s+t,'DAY_MODE_TOTAL');
   total+=starts;solo+=s;team+=t;days.set(date,starts);
   const facets=Array.isArray(r.facets)?r.facets:[];
   for(const dim of ['GRADE','SUBJECT','PUBLISHER','CARTRIDGE_COMBINATION']){
    const target=dim==='GRADE'?grade:dim==='SUBJECT'?subject:dim==='PUBLISHER'?publisher:combinations;
    const entries=facets.filter(f=>f.dimension===dim);
    let n=0;
    for(const f of entries){
     const key=String(f.dimensionKey==null?'':f.dimensionKey);
     const count=finiteInt(f.count,'FACET');
     assert(key.length>0,'FACET_KEY');
     n+=count;
     add(target,key,count);
    }
    if(dim==='GRADE'||dim==='SUBJECT')assert(n===starts,'FACET_PARITY_'+dim);
    if(dim==='PUBLISHER')assert(n<=starts,'PUBLISHER_OVERCOUNT');
    if(dim==='CARTRIDGE_COMBINATION'&&n!==starts)combinationReady=false;
   }
   let knownTeam=0;
   for(const [size,countRaw] of Object.entries(r.teamCounts||{})){
    assert(/^[1-7]$/.test(String(size)),'TEAM_SIZE');
    const value=finiteInt(countRaw,'TEAM_SIZE_COUNT');
    if(size==='1'){assert(value===s,'SOLO_TEAM_SIZE');continue;}
    knownTeam+=value;add(teamCounts,size+'팀전',value);
   }
   const rest=finiteInt(r.unknownTeamSize||0,'UNKNOWN_TEAM');
   assert(knownTeam+rest===t,'TEAM_TOTAL_PARITY');
   unknownTeams+=rest;
  }
  if(unknownTeams)add(teamCounts,'인원 미확인',unknownTeams);
  assert(total===report.starts&&solo===report.solo&&team===report.team,'REPORT_PARITY');
  const allDays=[...days].sort((a,b)=>a[0].localeCompare(b[0]));
  // The old UI constructs a contiguous day-series including zero-usage
  // dates. Missing, unverified days are NOT safe to fill with zero.
  const completeRange=dayRange(allDays[0][0],allDays[allDays.length-1][0]);
  assert(completeRange.length===days.size,'GAP_IN_SELECTED_DAYS');
  const limitations=['ALL_TIME_HISTORY_START_NOT_CERTIFIED'];
  if(!days.has(today))limitations.push('TODAY_NOT_COVERED_BY_VERIFIED_DAILY_SUMMARY');
  if(!combinationReady)limitations.push('HISTORICAL_COMBINED_CARTRIDGE_TOP20_NOT_AVAILABLE');
  if(unknownTeams)limitations.push('LEGACY_TEAM_SIZE_7_OR_OTHER_NOT_CLASSIFIED');
  const totals={
   today:days.has(today)?days.get(today):null,
   days7:selectedWindow(days,today,7),
   days30:selectedWindow(days,today,30),
   // Original getUsageStatisticsU2() includes all PUBLIC raw history.
   // Without a certified absolute history start, do not fake an "all" value.
   all:null
  };
  const preview={
   generatedAt:new Date().toISOString(),accessRole,scope:'PUBLIC_ONLY',
   totals,daily:allDays.map(([date,count])=>({date,count})),
   mode:shareRows(new Map([['SOLO',solo],['TEAM',team]].filter(r=>r[1]>0)),total),
   teamCount:shareRows(teamCounts,team),
   repositoryKind:total?[{label:'PUBLIC',count:total,share:100}]:[],
   grade:shareRows(grade,total),subject:shareRows(subject,total),
   publisher:shareRows(publisher,total),
   topCartridges:combinationReady?shareRows(combinations,total).slice(0,20):null
  };
  return {
   ok:true,source:'VERIFIED_SUMMARIES_ONLY',shadowOnly:true,
   productionSwitchAllowed:false,rawRead:false,rawDeletion:'HOLD',
   selectedRange:{from:allDays[0][0],to:allDays[allDays.length-1][0],starts:total},
   originalRpc:'getUsageStatisticsU2',
   preview,limitations
  };
 }
 return Object.freeze({project});
})();
