// Produces getPublicUsageStatisticsV4() responses from the REAL gas/*.gs code
// running on the synthetic isolated-copy fixture (mock GAS), for the offline
// anonymous browser test. Usage: node make_stats_payloads.mjs <out.json>
import {writeFileSync} from 'node:fs';
import {loadProject,MockSpreadsheet} from './mock_gas.mjs';
import {buildCopy,standardHistory,ISOLATED_PROPS,id} from './fixture.mjs';

function world(props=ISOLATED_PROPS){
 const {ss}=buildCopy({history:standardHistory()});
 const map=new Map([['copy40',ss],['prod',new MockSpreadsheet('prod')],['cert',new MockSpreadsheet('cert')]]);
 const p=loadProject({spreadsheets:map,props,now:'2026-11-23T03:00:00Z'});
 return {...p,ss};
}
const req=(n,team=1,ids=['101'])=>({eventId:id(n),mode:team===1?'SOLO':'TEAM',repositoryKind:'PUBLIC',
 cartridgeIds:ids,cartridgeCount:ids.length,teamCount:team});
const out={};
{
 const w=world();
 for(let i=0;i<6;i++)w.rpc('recordUsageStartU1',req(100+i,i%2?1:3));
 w.setNow('2026-11-23T15:10:00Z'); // 00:10 KST next day: yesterday still provisional
 w.rpc('recordUsageStartU1',req(200,7));
 out.ok=w.rpc('getPublicUsageStatisticsV4');
 w.setNow('2026-11-23T15:12:00Z');
 w.cache.delete('HOJA_V4U_PUBLIC_FRESH_V1');
 w.cache.set('HOJA_V4U_RC_'+Math.floor(w.clock.ms/60000),{v:'20',exp:w.clock.ms+60000});
 out.stale=w.rpc('getPublicUsageStatisticsV4');
 w.setNow('2026-11-23T15:20:00Z');
 w.ss.getSheetByName('HOJA_V4_DAILY_BUCKETS').rows[1][5]='999';
 out.integrity=w.rpc('getPublicUsageStatisticsV4');
}
{
 const w=world({SMQ_USAGE_SPREADSHEET_ID:'copy40'});
 out.notConfigured=w.rpc('getPublicUsageStatisticsV4');
}
writeFileSync(process.argv[2],JSON.stringify(out,null,1));
console.log(JSON.stringify({ok:out.ok.status,totals:out.ok.totals,stale:out.stale.cache,
 integrity:out.integrity,notConfigured:out.notConfigured.code}));
