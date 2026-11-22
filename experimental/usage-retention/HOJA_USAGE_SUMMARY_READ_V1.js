/* HOJA anonymous summary reader — pure, READ-ONLY Project A/B migration candidate.
 * No Apps Script APIs, sheet mutation, raw EVENT_LOG reads, triggers or RPC.
 * Does NOT mark a day covered just because it is absent from a summary.
 * Project B's existing code has not yet been integrated/deployed.
 */
var HOJA_USAGE_SUMMARY_READ_V1=(function(){
 'use strict';
 const OLD={
  manifest:['date','generationSeq','generation','schemaVersion','status','cutoffLastRow','cutoffAcceptedAt',
   'sourceEventCount','sourceU3EventCount','sourceLegacyEventCount','sourceEventIdDigest','sourceContentDigest',
   'startedAt','completedAt','verifiedAt','needsRebuild','notes'],
  totals:['date','generationSeq','generation','schemaVersion','eventCount','soloCount','teamCount',
   'team2Count','team3Count','team4Count','team5Count','team6Count','createdAt'],
  dimensions:['date','generationSeq','generation','schemaVersion','dimension','dimensionKey','displayLabel','count','createdAt']
 };
 const TRIAL={
  manifest:['generation','contentDigest','rawRowCount','uniqueStarts','status','createdAt','verifiedAt'],
  totals:['generation','date','gameId','mode','starts','completed','timeUp','otherEnded','unknownEnded',
   'correctTotal','answeredTotal','durationSecondsTotal','durationSamples','teamCountsJson'],
  dimensions:['generation','date','gameId','mode','grade','subject','publisher','cartridgeId','starts','completed',
   'timeUp','otherEnded','unknownEnded','correctTotal','answeredTotal','durationSecondsTotal',
   'durationSamples','teamCountsJson'],
  facets:['generation','date','gameId','mode','dimension','dimensionKey','displayLabel','count']
 };
 const DIGEST=/^[a-f0-9]{64}$/i,DATE=/^\d{4}-\d{2}-\d{2}$/;
 const validDay=d=>{
  if(!DATE.test(String(d||'')))return false;
  return new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
 };
 const assert=(v,why)=>{if(!v)throw Error('HOJA_SUMMARY_'+why);};
 const str=x=>String(x==null?'':x).trim();
 const count=(n,why)=>{
  const s=str(n);
  assert(/^\d+$/.test(s)&&Number.isSafeInteger(Number(s)),'BAD_COUNT_'+why);
  return Number(s);
 };
 const table=(rows,header,key)=>{
  assert(Array.isArray(rows)&&rows.length>=1,'MISSING_TAB_'+key);
  const h=rows[0];
  assert(Array.isArray(h)&&header.every((v,i)=>str(h[i])===v),'HEADER_'+key);
  return rows.slice(1).filter(r=>Array.isArray(r)&&r.some(v=>str(v)!==''));
 };
 const group=(list,dim)=>{
  const map=new Map();
  for(const r of list.filter(x=>x.dimension===dim)){
   assert(!map.has(r.dimensionKey),'DUPLICATE_FACET_'+dim);
   map.set(r.dimensionKey,r.count);
  }
  return Object.fromEntries([...map].sort((a,b)=>a[0].localeCompare(b[0])));
 };
 const sum=x=>x.reduce((a,b)=>a+b,0);
 const facetSum=(facets,dimension)=>sum(facets.filter(x=>x.dimension===dimension).map(x=>x.count));
 const getTables=input=>{
  assert(input&&typeof input==='object','INPUT');
  const old=input.old||{},trial=input.trial||{};
  return {
   old:{manifest:table(old.manifest,OLD.manifest,'old.manifest'),
    totals:table(old.totals,OLD.totals,'old.totals'),
    dimensions:table(old.dimensions,OLD.dimensions,'old.dimensions')},
   trial:{manifest:table(trial.manifest,TRIAL.manifest,'trial.manifest'),
    totals:table(trial.totals,TRIAL.totals,'trial.totals'),
    dimensions:table(trial.dimensions,TRIAL.dimensions,'trial.dimensions'),
    facets:trial.facets?table(trial.facets,TRIAL.facets,'trial.facets'):[]}
  };
 };
 function oldDay(rows,day){
  const records=rows.manifest.filter(r=>str(r[0])===day).sort((a,b)=>
   count(b[1],'OLD_SEQ')-count(a[1],'OLD_SEQ'));
  if(!records.length)return {available:false,reason:'NO_LEGACY_MANIFEST'};
  const latest=records[0],gen=str(latest[2]);
  if(records.length>1&&count(records[1][1],'OLD_SEQ')===count(latest[1],'OLD_SEQ'))
   return {available:false,reason:'DUPLICATE_LEGACY_GENERATION'};
  if(str(latest[4])!=='COMPLETE'||str(latest[15]).toUpperCase()==='TRUE')
   return {available:false,reason:'LEGACY_NOT_VERIFIED'};
  if(str(latest[3])!=='U3S1_ROLLUP_V1'||!DIGEST.test(str(latest[10]))||
   !DIGEST.test(str(latest[11]))||!gen)return {available:false,reason:'LEGACY_DIGEST_OR_SCHEMA'};
  const total=rows.totals.filter(r=>str(r[0])===day&&str(r[2])===gen);
  if(total.length!==1)return {available:false,reason:'LEGACY_TOTALS_MISSING_OR_DUPLICATE'};
  const t=total[0];
  if(str(t[3])!=='U3S1_ROLLUP_V1')return {available:false,reason:'LEGACY_TOTALS_SCHEMA'};
  let starts,solo,team,u3,legacy,teamCounts={},unknownTeamSize;
  try{
   starts=count(t[4],'TOTAL'),solo=count(t[5],'SOLO'),team=count(t[6],'TEAM');
   u3=count(latest[8],'SOURCE_U3'),legacy=count(latest[9],'SOURCE_LEGACY');
   assert(starts===solo+team&&starts===count(latest[7],'SOURCE')&&starts===u3+legacy,
    'LEGACY_TOTAL_PARITY');
   for(let n=2;n<=6;n++)teamCounts[n]=count(t[n+5],'TEAM_'+n);
   unknownTeamSize=team-sum(Object.values(teamCounts));
   assert(unknownTeamSize>=0,'LEGACY_TEAM_UNCLASSIFIED_NEGATIVE');
   const entries=rows.dimensions.filter(r=>str(r[0])===day&&str(r[2])===gen);
   const observed=new Set(),facets=[],cartridges=[];
   for(const r of entries){
    assert(str(r[3])==='U3S1_ROLLUP_V1','LEGACY_DIM_SCHEMA');
    const dimension=str(r[4]),dimensionKey=str(r[5]);
    assert(['GRADE','SUBJECT','PUBLISHER','CARTRIDGE'].includes(dimension),'LEGACY_DIM_TYPE');
    const k=JSON.stringify([dimension,dimensionKey]);
    assert(!observed.has(k),'LEGACY_DIM_DUPLICATE');
    observed.add(k);
    const e={dimension,dimensionKey,displayLabel:str(r[6]),count:count(r[7],'LEGACY_DIM')};
    (dimension==='CARTRIDGE'?cartridges:facets).push(e);
   }
   for(const dim of ['GRADE','SUBJECT'])
    assert(facetSum(facets,dim)===starts,'LEGACY_FACET_TOTAL_'+dim);
   assert(facetSum(facets,'PUBLISHER')<=starts,'LEGACY_PUBLISHER_OVERCOUNT');
   const choices=sum(cartridges.map(x=>x.count));
   assert(choices>=u3&&choices<=u3*5,'LEGACY_CARTRIDGE_SELECTIONS');
   return {available:true,authoritative:true,date:day,source:'U3S1_ROLLUP_V1',
    generation:gen,starts,solo,team,teamCounts,unknownTeamSize,
    facets,cartridges,cartridgeSelections:choices,
    complete:0,timeUp:0,unknownResult:starts,facetsReady:true,
    sourceU3Events:u3,sourceLegacyEvents:legacy};
  }catch(e){return {available:false,reason:String(e.message||e)};}
 }
 function trialDay(rows,day,allowCountOnly){
  const totalsForDate=rows.totals.filter(r=>str(r[1])===day);
  if(!totalsForDate.length)return {available:false,reason:'NO_TRIAL_TOTALS'};
  // Manifest order is chronological; do not promote a previous COMPLETE when a
  // more recent generation is incomplete or corrupt.
  const candidates=rows.manifest.filter(r=>totalsForDate.some(t=>str(t[0])===str(r[0])));
  if(!candidates.length)return {available:false,reason:'NO_TRIAL_MANIFEST'};
  const m=candidates[candidates.length-1],gen=str(m[0]),status=str(m[4]);
  const authorized=status==='COMPLETE'&&DIGEST.test(str(m[1]))&&str(m[1])===gen;
  const previewOnly=allowCountOnly&&status==='CONNECTOR_COUNT_VERIFIED';
  if(!authorized&&!previewOnly)
   return {available:false,blocked:status==='COMPLETE',
    reason:'TRIAL_NOT_PUBLISHED_OR_DIGEST_MISSING'};
  let starts,rawRows,solo=0,team=0,complete=0,timeUp=0,unknownResult=0;
  const teamCounts={},buckets=new Map(),facets=[],cartridges=[],observedDims=new Set();
  try{
   starts=count(m[3],'UNIQUE'),rawRows=count(m[2],'RAW');
   assert(starts<=rawRows,'TRIAL_RAW_PARITY');
   const entries=totalsForDate.filter(r=>str(r[0])===gen);
   for(const r of entries){
    const mode=str(r[3]),gameId=str(r[2]);
    assert(['SOLO','TEAM'].includes(mode),'TRIAL_MODE');
    const key=JSON.stringify([gameId,mode]);
    assert(!buckets.has(key),'TRIAL_DUPLICATE_MODE');
    const n=count(r[4],'TRIAL_STARTS'),c=count(r[5],'TRIAL_COMPLETE'),
     tu=count(r[6],'TRIAL_TIMEUP'),other=count(r[7],'TRIAL_OTHER'),unk=count(r[8],'TRIAL_UNKNOWN');
    assert(c+tu+other+unk===n,'TRIAL_OUTCOME_PARITY');
    complete+=c;timeUp+=tu;unknownResult+=unk;
    const teams=JSON.parse(str(r[13])||'{}');
    assert(teams&&typeof teams==='object'&&!Array.isArray(teams),'TRIAL_TEAM_JSON');
    let counted=0;
    for(const [k,v] of Object.entries(teams)){
     assert(/^[1-7]$/.test(k),'TRIAL_TEAM_SIZE');
     const c=count(v,'TRIAL_TEAM_BUCKET');
     assert(mode==='SOLO'?k==='1':k!=='1','TRIAL_TEAM_MODE');
     counted+=c;teamCounts[k]=(teamCounts[k]||0)+c;
    }
    assert(counted===n,'TRIAL_TEAM_TOTAL');
    (mode==='SOLO'?(solo+=n):(team+=n));
    buckets.set(key,n);
   }
   assert(solo+team===starts,'TRIAL_START_PARITY');
   const sourceDims=rows.dimensions.filter(r=>str(r[0])===gen&&str(r[1])===day);
   for(const r of sourceDims){
    const key=JSON.stringify(r.slice(1,8));assert(!observedDims.has(key),'TRIAL_DIM_DUPLICATE');
    observedDims.add(key);const n=count(r[8],'TRIAL_DIM');
    assert(buckets.has(JSON.stringify([str(r[2]),str(r[3])])),'TRIAL_DIM_UNKNOWN_MODE');
    const unit=str(r[7]);assert(unit!=='','TRIAL_EMPTY_CARTRIDGE');
    cartridges.push({dimension:'CARTRIDGE',dimensionKey:unit,displayLabel:unit,
     count:n,gameId:str(r[2]),mode:str(r[3]),grade:str(r[4]),
     subject:str(r[5]),publisher:str(r[6])});
   }
   const selections=sum(cartridges.map(x=>x.count));
   assert(selections>=starts&&selections<=5*starts,'TRIAL_CARTRIDGE_PARITY');
   const rawFacets=rows.facets.filter(r=>str(r[0])===gen&&str(r[1])===day);
   const observedFacet=new Set();
   for(const r of rawFacets){
    const dimension=str(r[4]),gameId=str(r[2]),mode=str(r[3]),label=str(r[5]);
    assert(['GRADE','SUBJECT','PUBLISHER'].includes(dimension),'TRIAL_FACET_TYPE');
    const key=JSON.stringify([gameId,mode,dimension,label]);
    assert(!observedFacet.has(key),'TRIAL_FACET_DUPLICATE');
    observedFacet.add(key);
    const n=count(r[7],'TRIAL_FACET');
    assert(buckets.has(JSON.stringify([gameId,mode])),'TRIAL_FACET_UNKNOWN_MODE');
    facets.push({dimension,dimensionKey:label,displayLabel:str(r[6]),
     count:n,gameId,mode});
   }
   const facetsReady=['GRADE','SUBJECT'].every(dim=>{
    // Per mode AND gameId parity, not only a grand total that could conceal
    // swapped grades between SOLO and TEAM.
    for(const [key,n] of buckets){
     const [g,mode]=JSON.parse(key);
     if(sum(facets.filter(f=>f.dimension===dim&&f.gameId===g&&f.mode===mode)
      .map(f=>f.count))!==n)return false;
    }
    return true;
   });
   assert(!facets.length||facetSum(facets,'PUBLISHER')<=starts,
    'TRIAL_PUBLISHER_OVERCOUNT');
   return {available:true,authoritative:authorized,date:day,
    source:authorized?'HOJA_USAGE_RETENTION_V1':'TRIAL_COUNT_VERIFIED_ONLY',
    generation:gen,starts,solo,team,teamCounts,unknownTeamSize:0,
    facets,cartridges,cartridgeSelections:selections,facetsReady,
    complete,timeUp,unknownResult,rawRows,
    reason:authorized?'':'COUNT_ONLY_NO_SHA256'};
  }catch(e){return {available:false,blocked:status==='COMPLETE',
    reason:String(e.message||e)};}
 }
 function chooseDay(data,day,allowCountOnly){
  const a=oldDay(data.old,day),b=trialDay(data.trial,day,allowCountOnly);
  if(b.blocked)return {available:false,reason:'PUBLISHED_TRIAL_CORRUPT: '+b.reason};
  // Check overlapping days before choosing a new source-of-truth. Never let
  // a fresh generation silently rewrite previously published play counts.
  if(a.available&&b.available&&(a.starts!==b.starts||a.solo!==b.solo||a.team!==b.team))
   return {available:false,reason:'OVERLAP_START_PARITY_MISMATCH',old:a,newer:b};
  if(a.available&&b.available&&b.facetsReady){
   for(const dimension of ['GRADE','SUBJECT','PUBLISHER']){
    const oldFacets=group(a.facets,dimension),newFacets=group(b.facets,dimension);
    if(JSON.stringify(oldFacets)!==JSON.stringify(newFacets))
     return {available:false,reason:'OVERLAP_FACET_PARITY_MISMATCH_'+dimension};
   }
   if(a.sourceU3Events>0&&a.cartridgeSelections!==b.cartridgeSelections)
    return {available:false,reason:'OVERLAP_SELECTION_PARITY_MISMATCH'};
  }
  if(b.available&&b.authoritative&&b.facetsReady)return b;
  if(a.available)return a;
  if(b.available&&allowCountOnly)return b;
  return {available:false,reason:a.reason+' / '+b.reason};
 }
 function readDates(input,dates,options){
  assert(Array.isArray(dates)&&dates.length>=1&&dates.length<=366,'DATE_LIST');
  for(const d of dates)assert(validDay(d),'DAY_FORMAT');
  assert(new Set(dates).size===dates.length,'DUPLICATE_DAYS');
  const data=getTables(input),allowCountOnly=!!options?.allowCountOnly;
  const resolved=dates.map(d=>chooseDay(data,d,allowCountOnly));
  const gaps=resolved.map((row,i)=>!row.available?{date:dates[i],reason:row.reason}:null).filter(Boolean);
  const starts=sum(resolved.filter(r=>r.available).map(r=>r.starts));
  const trusted=!gaps.length&&resolved.every(r=>r.authoritative===true&&r.facetsReady);
  return {ok:trusted,completeCoverage:!gaps.length,authoritative:trusted,
   rawRead:false,rawDeletion:'HOLD',starts:!gaps.length?starts:null,
   solo:!gaps.length?sum(resolved.map(r=>r.solo)):null,
   team:!gaps.length?sum(resolved.map(r=>r.team)):null,
   days:resolved.map((r,i)=>Object.assign({requestedDate:dates[i]},r)),gaps};
 }
 return Object.freeze({OLD,TRIAL,readDates});
})();