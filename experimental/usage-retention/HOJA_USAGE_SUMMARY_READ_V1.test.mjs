import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('experimental/usage-retention/HOJA_USAGE_SUMMARY_READ_V1.js','utf8');
const api=runInNewContext(source+';HOJA_USAGE_SUMMARY_READ_V1;');
const clone=x=>JSON.parse(JSON.stringify(x));
const digest='a'.repeat(64),gen='20261120-g000001',v1gen='b'.repeat(64);
const H=api.OLD,T=api.TRIAL;
function sheet(headers,rows){return [headers.slice(),...rows];}
function demo(){
 const old={
  manifest:sheet(H.manifest,[['2026-11-20',1,gen,'U3S1_ROLLUP_V1','COMPLETE',
   17667,'2026-11-21',581,581,0,digest,digest,'2026-11-21','2026-11-21','2026-11-21','FALSE','']]),
  totals:sheet(H.totals,[['2026-11-20',1,gen,'U3S1_ROLLUP_V1',581,443,138,91,26,13,0,1,'2026-11-21']]),
  dimensions:sheet(H.dimensions,[
   ['2026-11-20',1,gen,'U3S1_ROLLUP_V1','GRADE','6학년','6학년',305,''],
   ['2026-11-20',1,gen,'U3S1_ROLLUP_V1','GRADE','5학년','5학년',236,''],
   ['2026-11-20',1,gen,'U3S1_ROLLUP_V1','GRADE','기타','기타',40,''],
   ['2026-11-20',1,gen,'U3S1_ROLLUP_V1','SUBJECT','영어','영어',541,''],
   ['2026-11-20',1,gen,'U3S1_ROLLUP_V1','SUBJECT','기타','기타',40,''],
   ['2026-11-20',1,gen,'U3S1_ROLLUP_V1','PUBLISHER','천재(함)','천재(함)',435,''],
   ['2026-11-20',1,gen,'U3S1_ROLLUP_V1','PUBLISHER','YBM(김)','YBM(김)',103,''],
   ['2026-11-20',1,gen,'U3S1_ROLLUP_V1','PUBLISHER','비상','비상',3,''],
   ['2026-11-20',1,gen,'U3S1_ROLLUP_V1','CARTRIDGE','PUBLIC:unitA','A',500,''],
   ['2026-11-20',1,gen,'U3S1_ROLLUP_V1','CARTRIDGE','PUBLIC:unitB','B',163,'']
  ])
 };
 const trial={
  manifest:sheet(T.manifest,[['CONNECTOR-TEST-20261120','COUNT_ONLY',581,581,'CONNECTOR_COUNT_VERIFIED','2026-11-23','2026-11-23']]),
  totals:sheet(T.totals,[
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','SOLO',443,0,0,0,443,0,0,0,0,'{"1":443}'],
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','TEAM',138,0,0,0,138,0,0,0,0,'{"2":91,"3":26,"4":13,"6":1,"7":7}']
  ]),
  dimensions:sheet(T.dimensions,[
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','SOLO','6','영어','천재','101',443,0,0,0,443,0,0,0,0,'{"1":443}'],
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','TEAM','5','영어','천재','102',220,0,0,0,220,0,0,0,0,'{"2":220}']
  ]),
  facets:sheet(T.facets,[
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','SOLO','GRADE','6학년','6학년',230],
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','SOLO','GRADE','5학년','5학년',180],
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','SOLO','GRADE','기타','기타',33],
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','TEAM','GRADE','6학년','6학년',75],
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','TEAM','GRADE','5학년','5학년',56],
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','TEAM','GRADE','기타','기타',7],
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','SOLO','SUBJECT','영어','영어',410],
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','SOLO','SUBJECT','기타','기타',33],
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','TEAM','SUBJECT','영어','영어',131],
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','TEAM','SUBJECT','기타','기타',7],
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','SOLO','PUBLISHER','천재(함)','천재(함)',310],
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','SOLO','PUBLISHER','YBM(김)','YBM(김)',100],
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','TEAM','PUBLISHER','천재(함)','천재(함)',125],
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','TEAM','PUBLISHER','YBM(김)','YBM(김)',3],
   ['CONNECTOR-TEST-20261120','2026-11-20','HOJA_LEGACY','TEAM','PUBLISHER','비상','비상',3]
  ])
 };
 return {old,trial};
}
test('existing U3S COMPLETE day provides truthful Project B daily report',()=>{
 const data=demo(),x=api.readDates(data,['2026-11-20']);
 assert.equal(x.ok,true);
 assert.equal(x.rawRead,false);
 assert.equal(x.starts,581);
 assert.equal(x.solo,443);
 assert.equal(x.team,138);
 assert.equal(x.days[0].source,'U3S1_ROLLUP_V1');
 assert.equal(x.days[0].teamCounts[2],91);
 assert.equal(x.days[0].unknownTeamSize,7);// never claim 7-person teams from old schema
 assert.equal(x.days[0].cartridgeSelections,663);
});
test('current Project B without any V1 tabs can read existing U3S COMPLETE summaries',()=>{
 const d=demo();const r=api.readDates({old:d.old},['2026-11-20']);
 assert.equal(r.ok,true);
 assert.equal(r.starts,581);
 assert.equal(r.days[0].source,'U3S1_ROLLUP_V1');
});
test('partial V1 family installation is not silently ignored',()=>{
 const d=demo();
 assert.throws(()=>api.readDates({old:d.old,trial:{manifest:d.trial.manifest}},['2026-11-20']),/MISSING_TAB/);
});
test('count-verified connector trial is NOT authoritative and legacy wins',()=>{
 const x=api.readDates(demo(),['2026-11-20'],{allowCountOnly:true});
 assert.equal(x.ok,true);assert.equal(x.days[0].source,'U3S1_ROLLUP_V1');
});
test('trial-only count check is displayable as PREVIEW, not a production reader',()=>{
 const data=demo();
 data.old.manifest=[H.manifest];
 const x=api.readDates(data,['2026-11-20'],{allowCountOnly:true});
 assert.equal(x.ok,false);
 assert.equal(x.completeCoverage,true);
 assert.equal(x.starts,581);
 assert.equal(x.days[0].authoritative,false);
});
test('missing day is never interpreted as zero plays',()=>{
 const x=api.readDates(demo(),['2026-11-19','2026-11-20']);
 assert.equal(x.ok,false);assert.equal(x.completeCoverage,false);assert.equal(x.starts,null);
 assert.equal(x.gaps[0].date,'2026-11-19');
});
test('bad aggregate and stale latest generation fail closed',()=>{
 for(const damage of [
  data=>{data.old.totals[1][4]=580;},
  data=>{data.old.manifest[1][15]='TRUE';},
  data=>{data.old.manifest[1][4]='FAILED';},
  data=>{data.old.dimensions[1][7]=100;},
  data=>{data.old.manifest.push(['2026-11-20',2,'broken','U3S1_ROLLUP_V1','PREPARING']);},
  data=>{data.old.totals.push(clone(data.old.totals[1]));}
 ]){
  const d=demo();damage(d);
  const r=api.readDates(d,['2026-11-20']);
  assert.equal(r.ok,false,JSON.stringify(r.gaps));
  assert.equal(r.starts,null);
 }
});
test('mismatched real-style trial counts block mixed-source comparison',()=>{
 const d=demo();d.trial.totals[1][4]=442;
 // In preview mode trial is rejected because SOLO teams no longer match starts,
 // and the existing U3S still provides the authoritative answer.
 const x=api.readDates(d,['2026-11-20'],{allowCountOnly:true});
 assert.equal(x.ok,true);
 assert.equal(x.days[0].source,'U3S1_ROLLUP_V1');
});
test('a matching new COMPLETE + SHA + facets may supersede U3S; no double count',()=>{
 const d=demo();d.trial.manifest[1]=[v1gen,v1gen,581,581,'COMPLETE','2026-11-23','2026-11-23'];
 for(const key of ['totals','dimensions','facets'])for(const row of d.trial[key].slice(1))row[0]=v1gen;
 const x=api.readDates(d,['2026-11-20']);
 assert.equal(x.ok,true,JSON.stringify(x.gaps));
 assert.equal(x.starts,581);
 assert.equal(x.days[0].source,'HOJA_USAGE_RETENTION_V1');
 assert.equal(x.days[0].teamCounts['7'],7);
 assert.equal(x.days[0].unknownTeamSize,0);
});
test('published V1 facet mismatch blocks legacy fallback and summary cutover',()=>{
 const d=demo();d.trial.manifest[1]=[v1gen,v1gen,581,581,'COMPLETE','',''];
 for(const key of ['totals','dimensions','facets'])for(const row of d.trial[key].slice(1))row[0]=v1gen;
 d.trial.facets.find(x=>x[4]==='GRADE'&&x[5]==='6학년')[7]-=1;
 const x=api.readDates(d,['2026-11-20']);
 assert.equal(x.ok,false);
 assert.match(x.gaps[0].reason,/PUBLISHED_TRIAL_CORRUPT/);
});
test('invalid SHA or future date or duplicate day is rejected',()=>{
 const d=demo();
 d.trial.manifest[1]=[v1gen,'invalid',581,581,'COMPLETE','',''];
 for(const key of ['totals','dimensions','facets'])for(const row of d.trial[key].slice(1))row[0]=v1gen;
 assert.equal(api.readDates(d,['2026-11-20']).ok,false);
 assert.throws(()=>api.readDates(d,['2026-11-20','2026-11-20']),/DUPLICATE_DAYS/);
 assert.throws(()=>api.readDates(d,['2026-02-30']),/DAY_FORMAT/);
});
test('reader source contains no raw EVENT_LOG read, writing APIs, ScriptApp or UrlFetchApp',()=>{
 const code=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
 assert.doesNotMatch(code,/(?:getRange|SpreadsheetApp|appendRow|deleteRows?|clearContent|ScriptApp|UrlFetchApp)\s*[.(]/);
});
