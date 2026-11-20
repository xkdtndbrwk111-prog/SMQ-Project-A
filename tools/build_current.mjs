#!/usr/bin/env node
// Phase 2B: build from the materialized web/current source. The legacy builder remains available.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { instrumentArcade } from './current-test-probe.mjs';
import { checkModuleOrder } from './check_module_order.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'web/current');
const test=process.env.HOJA_TEST_PROBE==='1';
const output=path.join(root,test?'dist-current-test':'dist-current');
if(process.argv.length!==2)throw Error('출력 경로를 지정할 수 없습니다.');
if(fs.existsSync(output)&&fs.lstatSync(output).isSymbolicLink())throw Error('출력 경로에 심볼릭 링크를 사용할 수 없습니다.');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
function paths(dir,prefix=''){
 return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
  const rel=path.posix.join(prefix,e.name),p=path.join(dir,e.name);
  if(e.isSymbolicLink())throw Error(`소스에 심볼릭 링크 사용 불가: ${rel}`);
  if(e.isDirectory())return paths(p,rel);
  if(!e.isFile())throw Error(`지원하지 않는 소스: ${rel}`);
  return [rel];
 });
}
const all=paths(source);const production=all.filter(x=>x!=='BUILD.json');
const files=Object.fromEntries(production.map(p=>[p,hash(fs.readFileSync(path.join(source,p)))]));
const baseline=JSON.parse(fs.readFileSync(path.join(root,'tools/current-baseline-hashes.json'),'utf8'));
const unchanged=JSON.stringify(Object.entries(files).sort())===JSON.stringify(Object.entries(baseline.files).sort());
let arcade=fs.readFileSync(path.join(source,'arcade.html'),'utf8');
if(arcade.includes('src="js/arcade-host.js"')){
 const sourcePages={'arcade.html':arcade};
 for(const page of ['index.html','play.html'])sourcePages[page]=fs.readFileSync(path.join(source,page),'utf8');
 const errors=checkModuleOrder(sourcePages);
 for(const [name,html] of Object.entries(sourcePages)){
  for(const match of html.matchAll(/<script\b[^>]*\bsrc=["'](js\/[^"']+)["']/g)){
   if(!production.includes(match[1]))errors.push(name+': 스크립트 파일이 없습니다: '+match[1]);
  }
 }
 if(errors.length)throw Error('모듈 검사 실패: '+errors.join(' | '));
}

if(test)arcade=instrumentArcade(arcade);
// Preserve Phase 1 QR compatibility at the frozen baseline. Any source asset change
// produces a new version, including copied scripts and cartridge files.
const version=unchanged&&!test?baseline.gameVersion:hash(JSON.stringify(Object.entries(files).sort())+'\0'+hash(arcade)+'\0'+(test?'test':'production')).slice(0,10);
const pages={};
for(const name of ['index.html','play.html']){
 const input=fs.readFileSync(path.join(source,name),'utf8');
 const re=/(<script id="hojaBuildInfo">window\.HOJA_BUILD=Object\.freeze\(\{gameVersion:')[0-9a-f]{10}(',page:'(?:index|play)'\}\);<\/script>)/g;
 const matches=[...input.matchAll(re)];
 if(matches.length!==1)throw Error(`${name}: 빌드 버전 표지가 정확히 하나여야 합니다`);
 pages[name]=input.replace(re,`$1${version}$2`);
}
pages['arcade.html']=arcade;
const template=JSON.parse(fs.readFileSync(path.join(source,'BUILD.json'),'utf8'));
// Hash the exact bytes served, including every external module and cartridge.
const artifacts = production.map(name => {
 const bytes = Object.hasOwn(pages,name) ? Buffer.from(pages[name]) : fs.readFileSync(path.join(source,name));
 return [name, {bytes:bytes.length, sha256:hash(bytes)}];
});
const info = {...template, gameVersion:version, testProbe:test, builtAt:new Date().toISOString(),
 files:Object.fromEntries(artifacts)};
if(fs.existsSync(output)){
 const existing = paths(output);
 if(!existing.includes('BUILD.json'))throw Error('빌드 정보가 없는 폴더를 보존합니다.');
 const previous = JSON.parse(fs.readFileSync(path.join(output,'BUILD.json'),'utf8'));
 if(previous.testProbe!==test)throw Error('다른 종류의 빌드 출력이므로 삭제를 중단합니다.');
 const expected = new Set([...production,'BUILD.json']);
 for(const name of existing){
  if(expected.has(name))continue;
  const recorded = previous.files?.[name];
  const bytes = fs.readFileSync(path.join(output,name));
  if(!recorded || recorded.bytes!==bytes.length || recorded.sha256!==hash(bytes))
   throw Error('출력 폴더의 예기치 않거나 수정된 파일을 보존합니다: '+name);
 }
}
fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});
for(const f of production){const target=path.join(output,f);fs.mkdirSync(path.dirname(target),{recursive:true});
 if(Object.hasOwn(pages,f))fs.writeFileSync(target,pages[f]);else fs.copyFileSync(path.join(source,f),target);
}
fs.writeFileSync(path.join(output,'BUILD.json'),JSON.stringify(info,null,1)+'\n');
console.log(`빌드 완료 → ${path.basename(output)}, 게임 버전 ${version}, 시험 훅 ${test?'포함':'없음'}`);
