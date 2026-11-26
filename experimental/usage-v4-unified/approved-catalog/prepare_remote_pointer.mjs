#!/usr/bin/env node
// Prepare an immutable release pointer, never push or deploy from this program.
// Run on a trusted publisher with a protected main branch and an explicit approval manifest.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {activeApprovedCatalog} from './approved_catalog_normalizer.mjs';
import {verifyRemoteRelease} from './build_remote_active_catalog.mjs';

const COMMIT=/^[a-f0-9]{40}$/,SHA=/^[a-f0-9]{64}$/;
const digest=b=>createHash('sha256').update(b).digest('hex');
const DIR='game-runtime/active/v1/';
export function nextPointer(previous, catalogCommit, bytes, {bootstrap=false}={}){
 if(!COMMIT.test(catalogCommit))throw Error('CATALOG_COMMIT_INVALID');
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>350000)throw Error('CATALOG_SIZE');
 if(previous==null){
  if(!bootstrap)throw Error('BOOTSTRAP_EXPLICIT_REQUIRED');
 }else{
  if(bootstrap||previous.schemaVersion!=='hoja-active-catalog-pointer-v1'||
    !Number.isSafeInteger(previous.generation)||previous.generation<1||
    previous.generation>=Number.MAX_SAFE_INTEGER||
    !COMMIT.test(previous.catalogCommit)||!SHA.test(previous.catalogSha256))throw Error('PREVIOUS_POINTER_INVALID');
 }
 const sha=digest(bytes);
 if(previous&&previous.catalogSha256===sha&&previous.catalogCommit===catalogCommit)throw Error('NO_RELEASE_CHANGE');
 return {schemaVersion:'hoja-active-catalog-pointer-v1',generation:previous?previous.generation+1:1,catalogCommit,catalogSha256:sha};
}

function main(){
 const args=process.argv.slice(2);
 const opt=k=>{const i=args.indexOf(k);if(i<0||!args[i+1]||args[i+1].startsWith('--'))throw Error('REQUIRED '+k);return args[i+1]};
 const runtime=resolve(opt('--runtime')),catalogCommit=opt('--catalog-commit'),baseCommit=opt('--base-commit'),contentCommit=opt('--content-commit');
 for(const c of [catalogCommit,baseCommit,contentCommit])if(!COMMIT.test(c))throw Error('IMMUTABLE_COMMIT_REQUIRED');
 const git=(...a)=>execFileSync('git',['-C',runtime,...a],{maxBuffer:32*1024*1024});
 const blob=(c,p)=>git('show',c+':'+p);
 // Never publish a pointer to an unrelated catalog. Content and prior base must be ancestors.
 git('merge-base','--is-ancestor',baseCommit,catalogCommit);
 git('merge-base','--is-ancestor',contentCommit,catalogCommit);
 const json=p=>JSON.parse(readFileSync(p,'utf8'));
 const index=json(opt('--index')),deployment=json(opt('--deployment')),report=json(opt('--report'));
 const runtimeIndex=JSON.parse(blob(contentCommit,'game-runtime/approved-packages/v1/INDEX.json'));
 const expected=verifyRemoteRelease(activeApprovedCatalog(index,deployment),report,runtimeIndex,contentCommit,p=>{
   const b=blob(contentCommit,p);return {sha256:digest(b),bytes:b.length,data:JSON.parse(b.toString('utf8'))};
 });
 const actual=blob(catalogCommit,DIR+'catalog.json');
 if(!actual.equals(Buffer.from(JSON.stringify(expected,null,1)+'\n')))throw Error('CATALOG_NOT_EXACT_VERIFIED_OUTPUT');
 const names=git('ls-tree','--name-only',baseCommit,'--',DIR+'current.json').toString('utf8').trim();
 const prev=names?JSON.parse(blob(baseCommit,DIR+'current.json').toString('utf8')):null;
 // Ensure existing pointer is genuine before incrementing it.
 if(prev&&digest(blob(prev.catalogCommit,DIR+'catalog.json'))!==prev.catalogSha256)throw Error('PREVIOUS_POINTER_DIGEST');
 const pointer=nextPointer(prev,catalogCommit,actual,{bootstrap:args.includes('--bootstrap')});
 writeFileSync(resolve(opt('--out')),JSON.stringify(pointer,null,1)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'PREPARED_ONLY',baseCommit,...pointer}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main();
