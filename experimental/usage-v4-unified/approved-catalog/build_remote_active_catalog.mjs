#!/usr/bin/env node
// Build-only candidate. No publication or deployment is performed here.
// The existing normalizer remains the authority for teacher approval, effective pins,
// rights acknowledgement and renderer/question gates.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {activeApprovedCatalog} from './approved_catalog_normalizer.mjs';

export function verifyRemoteRelease(active, report, runtimeIndex, contentCommit, readPackage) {
  const fail=(msg)=>{throw new Error('REMOTE_CATALOG_'+msg)};
  const sha=/^[a-f0-9]{64}$/;
  const commit=/^[a-f0-9]{40}$/;
  const repo='xkdtndbrwk111-prog/HOJA-QUESTION-BANK';
  if(!active||active.schemaVersion!=='hoja-active-cartridge-catalog-v1'||active.sourceRepo!==repo||
    !commit.test(active.sourceCommit)||!commit.test(contentCommit)||!active.deploymentId||
    !Array.isArray(active.entries)||!active.entries.length||active.entries.length>1000||
    (active.buildType&&active.buildType!=='RELEASE')) fail('ACTIVE_INVALID');
  if(!report||report.sourceCommit!==active.sourceCommit||!Array.isArray(report.entries)||
    !runtimeIndex||runtimeIndex.schemaVersion!=='hoja-game-runtime-packages-v1'||
    runtimeIndex.sourceCommit!==active.sourceCommit||!Array.isArray(runtimeIndex.packages))fail('SOURCE_DRIFT');
  function uniqueMap(rows){
    const m=new Map();for(const r of rows){if(!r||typeof r.cartridgeId!=='string'||m.has(r.cartridgeId))fail('DUPLICATE_ID');m.set(r.cartridgeId,r)}return m;
  }
  const reports=uniqueMap(report.entries),packages=uniqueMap(runtimeIndex.packages);
  uniqueMap(active.entries);
  const names=new Set();
  const entries=active.entries.map(e=>{
    const id=e.cartridgeId, r=reports.get(id), p=packages.get(id);
    const path='game-runtime/approved-packages/v1/'+id+'.json';
    if(!/^[a-z0-9][a-z0-9-]{2,63}$/.test(id)||/^\d+$/.test(id)||!sha.test(e.effectiveSha256)||
       e.deploymentStatus!=='DEPLOYED'||!Number.isSafeInteger(e.questionCount)||e.questionCount<1||
       !e.title||!e.releaseId||!r||r.status!=='READY'||!p||p.path!==path||
       !sha.test(p.sha256)||r.packageSha256!==p.sha256||!Number.isSafeInteger(p.bytes)||p.bytes<1)fail('ENTRY_INVALID:'+id);
    const raw=readPackage(path);
    if(!raw||raw.sha256!==p.sha256||raw.bytes!==p.bytes)fail('PACKAGE_BYTES:'+id);
    const d=raw.data;
    if(!d||d.cartridgeId!==id||d.questionSchemaVersion!==2||!Array.isArray(d.questions)||
      d.questions.length!==e.questionCount||!d.images||!d.tags||!d.unitMeta)fail('PACKAGE_SCHEMA:'+id);
    const clean=v=>String(v==null?'':v).replace(/[-_–—|/·\s]+/g,' ').trim();
    const parts=[String(e.grade)];if(e.semester===1||e.semester===2)parts.push(e.semester+'학기');
    parts.push(clean(e.subjectLabel)||'기타');if(e.subject==='english')parts.push(clean(e.publisher)+(e.author?'('+clean(e.author)+')':'')||'출판사 미구분');
    parts.push(String(e.title));const name=parts.join('-');
    if(names.has(name)||name.length>180)fail('GAME_NAME:'+id);names.add(name);
    return {...e,packageSha256:p.sha256,contentPath:path};
  });
  return {...active,buildType:'RELEASE',entries,contentSource:{kind:'GITHUB_RAW_PINNED_V1',repo,commit:contentCommit}};
}

function main(){
 const args=process.argv.slice(2);
 const required=k=>{const i=args.indexOf(k);if(i<0||!args[i+1]||args[i+1].startsWith('--'))throw Error('REQUIRED '+k);return args[i+1]};
 const json=p=>JSON.parse(readFileSync(p,'utf8'));
 const index=json(required('--index')),deployment=json(required('--deployment')),report=json(required('--report'));
 const runtime=resolve(required('--runtime')),out=resolve(required('--out'));
 const git=(...args)=>execFileSync('git',['-C',runtime,...args],{encoding:'utf8',maxBuffer:32*1024*1024}).trim();
 const contentCommit=required('--content-commit');
 if(!/^[a-f0-9]{40}$/.test(contentCommit)||git('rev-parse','HEAD')!==contentCommit)throw Error('RUNTIME_COMMIT_MISMATCH');
 // Read immutable Git blobs rather than working-tree files (including uncommitted edits).
 const readBlob=path=>execFileSync('git',['-C',runtime,'show',contentCommit+':'+path],{maxBuffer:32*1024*1024});
 const runtimeIndex=JSON.parse(readBlob('game-runtime/approved-packages/v1/INDEX.json').toString('utf8'));
 const active=activeApprovedCatalog(index,deployment);
 const catalog=verifyRemoteRelease(active,report,runtimeIndex,contentCommit,path=>{
   const b=readBlob(path);return {sha256:createHash('sha256').update(b).digest('hex'),bytes:b.length,data:JSON.parse(b.toString('utf8'))};
 });
 writeFileSync(out,JSON.stringify(catalog,null,1)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'CANDIDATE_ONLY',entries:catalog.entries.length,questions:catalog.entries.reduce((n,e)=>n+e.questionCount,0),contentCommit}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main();
