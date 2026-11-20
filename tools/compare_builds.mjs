#!/usr/bin/env node
// Compare the Phase 1 build and materialized build without mutating either.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function list(dir,prefix=''){
 return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
  const r=path.posix.join(prefix,e.name),p=path.join(dir,e.name);
  if(e.isSymbolicLink())throw Error(`symlink: ${p}`);
  if(e.isDirectory())return list(p,r);
  if(!e.isFile())throw Error(`not a file: ${p}`);
  return [r];
 });
}
const a=path.join(root,'dist'),b=path.join(root,'dist-current');
const names=list(a);assert.deepEqual(list(b),names,'파일 목록 불일치');
for(const name of names){
 const one=fs.readFileSync(path.join(a,name)),two=fs.readFileSync(path.join(b,name));
 if(name==='BUILD.json'){
  const x=JSON.parse(one),y=JSON.parse(two);delete x.builtAt;delete y.builtAt;
  assert.deepEqual(y,x,`${name}: builtAt 제외한 메타데이터 불일치`);
 }else assert.ok(one.equals(two),`${name}: 바이트 불일치`);
 console.log('PASS '+name+(name==='BUILD.json'?' (builtAt 제외)':''));
}
console.log(`ALL PASS: ${names.length}개 파일`);
