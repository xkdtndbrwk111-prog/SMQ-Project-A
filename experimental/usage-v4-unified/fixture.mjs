// Synthetic isolated-copy fixture (no real event IDs / personal data).
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {MockSpreadsheet,EVENT_HEADER,sha256} from './mock_gas.mjs';

const core=runInContext(readFileSync('experimental/usage-v4-unified/gas/UsageV4Core.gs','utf8')+
 '\nHOJA_USAGE_V4_CORE',createContext({Date}));
export const CORE=core;
export const id=n=>String(n).padStart(32,'0');
export function game(n,date,{mode='SOLO',team=1,ts,cart='101'}={}){
 const title=cart==='101'?'6-사회-천재-2단원':'5-수학-비상-3단원';
 const [g,s,p]=cart==='101'?['6','사회','천재']:['5','수학','비상'];
 return [id(n),ts||date+'T01:00:00.000Z',date,mode,'PUBLIC',g,s,p,title,'1',String(team),
  cart,'PUBLIC:public-catalog','U3S1',JSON.stringify([title])];
}
export const MANIFEST_HEADER=['date','generation','status','sourceStartRow','sourceEndRow',
 'sourceRowCount','publicStarts','contentDigest','bucketCount','createdAt','verifiedAt',
 'sourcePrefixEndRow','bucketDigest','retriesSuppressed'];
export const BUCKET_HEADER=['date','generation','dimension','dimensionKey','displayLabel','count'];
export const AUDIT_HEADER=['scope','startDate','endDate','rawRows','uniquePlays',
 'duplicateRetries','zeroUseDays','bucketRows','sourceLastRow','validation'];

/* history: [{date, rows:[eventRow...]}] contiguous; all sealed COMPLETE. */
export function buildCopy({history,tail=[],storageId='copy40',canaryB1='HOJA_V4_40_6U_WRITE_COPY'}={}){
 const ss=new MockSpreadsheet(storageId);
 const events=[EVENT_HEADER.slice()],manifest=[MANIFEST_HEADER.slice()],buckets=[BUCKET_HEADER.slice()];
 let prefix=1;
 for(const day of history){
  const snap=core.snapshot(day.date,day.rows,{coverageVerified:true});
  const gen=sha256(snap.canonicalSource),bd=sha256(JSON.stringify(snap.buckets));
  const start=prefix+1;prefix+=day.rows.length;events.push(...day.rows);
  manifest.push([day.date,gen,'COMPLETE',day.rows.length?start:0,day.rows.length?prefix:0,
   day.rows.length,snap.starts,gen,snap.buckets.length,'2026-11-23T00:00:00Z',
   '2026-11-23T00:00:00Z',prefix,bd,snap.retriesSuppressed]);
  for(const b of snap.buckets)buckets.push([day.date,gen,b.dimension,b.key,b.displayLabel,String(b.count)]);
 }
 events.push(...tail);
 ss.add('EVENT_LOG',events);
 ss.add('HOJA_V4_DAILY_MANIFEST',manifest);
 ss.add('HOJA_V4_DAILY_BUCKETS',buckets);
 ss.add('HOJA_V4_BACKFILL_AUDIT',[AUDIT_HEADER.slice(),['COPY_ONLY_CONNECTOR_SHA256_V4',
  history[0].date,history[history.length-1].date,String(prefix-1),'0','0','0',
  String(buckets.length-1),String(prefix),'FULL_SOURCE_AND_BUCKET_SHA256_PASS_NOT_ACTUAL_GAS_EXECUTION']]);
 ss.add('_HOJA_USAGE_TRIAL_ONLY',[['HOJA_RETENTION_SANDBOX_V1',canaryB1]]);
 return {ss,sealedPrefix:prefix};
}
export const ISOLATED_PROPS={SMQ_USAGE_SPREADSHEET_ID:'copy40',
 HOJA_V4_UNIFIED_ISOLATION:'COPY_40_6U_ONLY',
 HOJA_USAGE_PRODUCTION_SPREADSHEET_ID:'prod',
 HOJA_USAGE_CERTIFIED_COPY_SPREADSHEET_ID:'cert'};
/* 4 sealed days: retry duplicate, verified zero day, TEAM 7. Unique 6, raw 7. */
export function standardHistory(){
 return [
  {date:'2026-11-19',rows:[game(1,'2026-11-19'),game(1,'2026-11-19',{ts:'2026-11-19T01:00:09.000Z'}),
   game(2,'2026-11-19',{cart:'102'})]},
  {date:'2026-11-20',rows:[]},
  {date:'2026-11-21',rows:[game(3,'2026-11-21',{mode:'TEAM',team:7}),game(4,'2026-11-21')]},
  {date:'2026-11-22',rows:[game(5,'2026-11-22'),game(6,'2026-11-22',{mode:'TEAM',team:2,cart:'102'})]}
 ];
}
