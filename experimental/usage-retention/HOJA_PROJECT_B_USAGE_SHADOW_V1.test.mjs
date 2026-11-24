import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync('experimental/usage-retention/HOJA_PROJECT_B_USAGE_SHADOW_V1.js','utf8');
const bridge=readFileSync('experimental/usage-retention/HOJA_PROJECT_B_USAGE_SHADOW_TRIAL_GAS.gs','utf8');
const project=runInNewContext(source+';HOJA_PROJECT_B_USAGE_SHADOW_V1;').project;
const get=(facetRows,kind)=>facetRows.filter(f=>f.dimension===kind);
const facet=(dimension,key,count,mode='SOLO')=>({
 dimension,dimensionKey:key,displayLabel:key,count,gameId:'HOJA_LEGACY',mode});
const legacyFacets=[
 facet('GRADE','5학년',236),facet('GRADE','6학년',305),facet('GRADE','기타',40),
 facet('SUBJECT','영어',541),facet('SUBJECT','기타',40),
 facet('PUBLISHER','천재(함)',435),facet('PUBLISHER','YBM(김)',103),facet('PUBLISHER','비상',3)
];
const old={
 available:true,authoritative:true,facetsReady:true,date:'2026-11-20',requestedDate:'2026-11-20',
 source:'U3S1_ROLLUP_V1',starts:581,solo:443,team:138,
 teamCounts:{2:91,3:26,4:13,5:0,6:1},unknownTeamSize:7,
 facets:legacyFacets
};
const newFacets=[
 ...get(legacyFacets,'GRADE'),...get(legacyFacets,'SUBJECT'),...get(legacyFacets,'PUBLISHER'),
 facet('CARTRIDGE_COMBINATION','영어 10단원 | 영어 11단원',300),
 facet('CARTRIDGE_COMBINATION','영어 12단원',281)
];
const newer={...old,source:'HOJA_USAGE_RETENTION_V1',
 teamCounts:{1:443,2:91,3:26,4:13,6:1,7:7},unknownTeamSize:0,
 facets:newFacets
};
function report(day=old){return {ok:true,authoritative:true,completeCoverage:true,rawRead:false,
 starts:day.starts,solo:day.solo,team:day.team,days:[day],gaps:[]};}
const args={accessRole:'OWNER',asOf:'2026-11-23'};
test('Project B original U2 payload keys preserved in honest single-date shadow projection',()=>{
 const r=project(report(old),args);
 assert.equal(r.ok,true);
 assert.equal(r.shadowOnly,true);
 assert.equal(r.productionSwitchAllowed,false);
 assert.equal(r.preview.accessRole,'OWNER');
 assert.equal(r.preview.scope,'PUBLIC_ONLY');
 assert.deepEqual(Object.keys(r.preview.totals).sort(),['all','days30','days7','today'].sort());
 assert.equal(r.preview.totals.all,null);
 assert.equal(r.preview.totals.today,null);
 assert.equal(r.preview.totals.days7,null);
 assert.equal(r.preview.daily[0].count,581);
 assert.equal(r.preview.mode.reduce((n,x)=>n+x.count,0),581);
 assert.equal(r.preview.grade.reduce((n,x)=>n+x.count,0),581);
 assert.equal(r.preview.subject.reduce((n,x)=>n+x.count,0),581);
 assert.equal(r.preview.publisher.reduce((n,x)=>n+x.count,0),541);
 assert.equal(r.preview.topCartridges,null);
 assert.equal(r.preview.teamCount.find(x=>x.label==='인원 미확인').count,7);
 assert.equal(r.preview.teamCount.reduce((n,x)=>n+x.count,0),138);
 assert.ok(r.limitations.includes('HISTORICAL_COMBINED_CARTRIDGE_TOP20_NOT_AVAILABLE'));
});

test('with a COMPLETE V1 combo facet, 2 selected cartridges still rank as one original group',()=>{
 const r=project(report(newer),{accessRole:'CREATOR',asOf:'2026-11-20'});
 assert.equal(r.preview.totals.today,581);
 assert.deepEqual(JSON.parse(JSON.stringify(r.preview.topCartridges.map(x=>[x.label,x.count]))),[
  ['영어 10단원 | 영어 11단원',300],['영어 12단원',281]
 ]);
 assert.equal(r.preview.teamCount.find(x=>x.label==='7팀전').count,7);
 assert.equal(r.preview.teamCount.some(x=>x.label==='인원 미확인'),false);
 assert.equal(r.preview.topCartridges[0].share,300*100/581);
 assert.equal(r.preview.repositoryKind[0].label,'PUBLIC');
 assert.equal(r.preview.repositoryKind[0].count,581);
});
test('incomplete TOP20 facet never gets silently converted from individual unit sums',()=>{
 const r=project(report({...newer,facets:newFacets.filter(x=>x.dimension!=='CARTRIDGE_COMBINATION')}),
  {accessRole:'OWNER',asOf:'2026-11-20'});
 assert.equal(r.preview.topCartridges,null);
 assert.ok(r.limitations.includes('HISTORICAL_COMBINED_CARTRIDGE_TOP20_NOT_AVAILABLE'));
});
test('verified zero-use date may be represented as zero, missing day must not',()=>{
 const zero={...old,date:'2026-11-21',requestedDate:'2026-11-21',starts:0,solo:0,team:0,
  unknownTeamSize:0,teamCounts:{2:0,3:0,4:0,5:0,6:0},facets:[]};
 const r=project(report(zero),{accessRole:'OWNER',asOf:'2026-11-21'});
 assert.equal(r.preview.totals.today,0);
 assert.equal(r.preview.daily[0].count,0);
 assert.equal(r.preview.topCartridges?.length,0);
});
test('missing, corrupt, partial or unauthorized summary fails closed',()=>{
 for(const changed of [
  {...report(),ok:false},
  {...report(),authoritative:false},
  {...report(),completeCoverage:false},
  {...report(),rawRead:true},
  {...report(),days:[{...old,facets:[...legacyFacets.filter(x=>x.dimension!=='GRADE')]}]},
  {...report(),days:[{...old,team:137}]},
 ]){
  assert.throws(()=>project(changed,args),/HOJA_PROJECT_B_SHADOW_/);
 }
 assert.throws(()=>project(report(),{accessRole:'EDIT_CODE',asOf:'2026-11-23'}),/ACCESS_ROLE/);
});
test('nonconsecutive dates do not fabricate missing zero-use days',()=>{
 const day2={...old,date:'2026-11-22',requestedDate:'2026-11-22'};
 const r={ok:true,authoritative:true,completeCoverage:true,rawRead:false,
 starts:1162,solo:886,team:276,days:[old,day2]};
 assert.throws(()=>project(r,args),/GAP_IN_SELECTED_DAYS/);
});

test('parallel shadow RPC verifies Project B access BEFORE reading any summaries',()=>{
 const trace=[];
 const fakeReport=report(newer);
 const run=(result)=>{
  const env={
   Date,
   requireUsageStatisticsAccessU3_(token){trace.push('AUTH:'+token);if(result instanceof Error)throw result;return result;},
   hojaUsageSummaryReadTrialU1(dates){trace.push('READ:'+dates[0]);return fakeReport;}
  };
  return runInNewContext(source+'\n'+bridge+
   '\ngetUsageStatisticsU3ShadowTrial("token",["2026-11-20"],"2026-11-20")',env);
 };
 let data=run({role:'OWNER'});
 assert.equal(data.preview.totals.today,581);
 assert.deepEqual(trace.splice(0),['AUTH:token','READ:2026-11-20']);
 assert.throws(()=>run(new Error('USAGE_ACCESS_DENIED')),/USAGE_ACCESS_DENIED/);
 assert.deepEqual(trace.splice(0),['AUTH:token']);
 assert.throws(()=>run({role:'EDIT_CODE'}),/ACCESS_DENIED/);
 assert.deepEqual(trace.splice(0),['AUTH:token']);
 data=run({role:'CREATOR'});
 assert.equal(data.preview.accessRole,'CREATOR');
 assert.equal(data.productionSwitchAllowed,false);
 assert.deepEqual(trace.splice(0),['AUTH:token','READ:2026-11-20']);
});
test('shadow sources have no destructive operation or raw EVENT_LOG access',()=>{
 for(const code of [source,bridge]){
  const plain=code.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
  assert.doesNotMatch(plain,/(?:EVENT_LOG|getRange|appendRow|deleteRows?|clearContent|UrlFetchApp|ScriptApp|DriveApp)\s*[.(]/);
 }
 assert.doesNotMatch(bridge,/\bfunction\s+getUsageStatisticsU2\s*\(/);
});
