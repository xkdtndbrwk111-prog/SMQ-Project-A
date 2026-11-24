#!/usr/bin/env node
// Phase 2B: build from the materialized web/current source. The legacy builder remains available.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { instrumentArcade } from './current-test-probe.mjs';
import { checkModuleOrder } from './check_module_order.mjs';
import { execFileSync } from 'node:child_process';

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
{
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

let reviewFiles={};
if(test){
 const {reviewArcade}=await import('./teacher_review/arcade.mjs');
 const reviewPath=path.join(root,'tools/teacher_review');
 reviewFiles['teacher-review.html']=fs.readFileSync(path.join(reviewPath,'index.html'),'utf8');
 reviewFiles['teacher-review.js']=fs.readFileSync(path.join(reviewPath,'client.js'),'utf8');
 reviewFiles['maker-compat.html']=fs.readFileSync(path.join(root,'tools/maker_compat/maker.html'),'utf8');
 reviewFiles['maker-fragment-system.js']=fs.readFileSync(path.join(root,'tools/maker_fragments/fragment-system.js'),'utf8');
 reviewFiles['fragment-practice.json']=JSON.stringify([1,2,3].map(n=>JSON.parse(fs.readFileSync(path.join(root,`verification/phase4e/fragments/practice-${n}.json`),'utf8'))));
 reviewFiles['maker-compat-boot.js']=fs.readFileSync(path.join(root,'tools/maker_compat/boot.js'),'utf8');
 const gp=fs.readFileSync(path.join(source,'js/parent-gameplay.js'),'utf8');
 const needle="f.src='arcade.html?season='";
 if(gp.split(needle).length!==2)throw Error('review host anchor missing');
 reviewFiles['js/teacher-review-gameplay.js']=gp.replace(needle,"f.src='teacher-review-arcade.html?season='");
 const course=JSON.parse(fs.readFileSync(path.join(root,'verification/phase4d/gimmick-course.json'),'utf8'));
 const windCourse=JSON.parse(fs.readFileSync(path.join(root,'verification/phase4d/wind-course.json'),'utf8'));
 const steppingCourse=JSON.parse(fs.readFileSync(path.join(root,'verification/phase4d/stepping-course.json'),'utf8'));
 const modesCourse=JSON.parse(fs.readFileSync(path.join(root,'verification/phase4d/stepping-modes-course.json'),'utf8'));
 reviewFiles['teacher-review-arcade.html']=reviewArcade(arcade,course,windCourse,steppingCourse,modesCourse);
 arcade=instrumentArcade(arcade);
 if(arcade.split('</body>').length!==2)throw Error('Maker 시험판 삽입 위치 오류');
 reviewFiles['maker-compat-arcade.html']=arcade.replace('</body>','<style>#hojaTestControls,#hojaTestDialogueControls{display:none!important}</style><script src="maker-compat-boot.js"></script></body>');
 for(const [name,data] of Object.entries(reviewFiles))files[name]=hash(data);
}
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
if((arcade.match(/__HOJA_ARCADE_BUILD_VERSION__/g)||[]).length!==1)throw Error('아케이드 버전 표지가 정확히 하나여야 합니다');
pages['arcade.html']=arcade.replace('__HOJA_ARCADE_BUILD_VERSION__',version);
if(test){
 pages['teacher-review-arcade.html']=reviewFiles['teacher-review-arcade.html'].replace('__HOJA_ARCADE_BUILD_VERSION__',version);
 pages['maker-compat-arcade.html']=reviewFiles['maker-compat-arcade.html'].replace('__HOJA_ARCADE_BUILD_VERSION__',version);
 const host='js/parent-gameplay.js';
 if(pages['play.html'].split(host).length!==2)throw Error('review page anchor missing');
 pages['teacher-review-play.html']=pages['play.html'].replace(host,'js/teacher-review-gameplay.js');
 pages['teacher-review.html']=reviewFiles['teacher-review.html'].replace('teacher-review.js',`teacher-review.js?v=${hash(reviewFiles['teacher-review.js']).slice(0,16)}`);
}
// Content-address local scripts so an old HTTP cache cannot supply a different build.
for(const name of Object.keys(pages)){
 pages[name]=pages[name].replace(/(<script\b[^>]*\bsrc=["'])(?:(js|vendor)\/)([^"'?]+)(["'])/g,(tag,start,folder,tail,end)=>{
  const file=folder+'/'+tail;
  if(!files[file])throw Error(name+': 스크립트 파일이 없습니다: '+file);
  return start+file+'?v='+files[file].slice(0,16)+end;
 });
}
const template=JSON.parse(fs.readFileSync(path.join(source,'BUILD.json'),'utf8'));
// Hash the exact bytes served, including every external module and cartridge.
const generated=test?['teacher-review.html','teacher-review.js','teacher-review-arcade.html','teacher-review-play.html','js/teacher-review-gameplay.js','maker-compat.html','maker-compat-arcade.html','maker-compat-boot.js','maker-fragment-system.js','fragment-practice.json']:[];
const outputFiles=[...production,...generated];
const artifacts = outputFiles.map(name => {
 const bytes = Object.hasOwn(pages,name) ? Buffer.from(pages[name]) : Object.hasOwn(reviewFiles,name)?Buffer.from(reviewFiles[name]):fs.readFileSync(path.join(source,name));
 return [name, {bytes:bytes.length, sha256:hash(bytes)}];
});
let revision=null,dirty=null;
if(test){try{revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();dirty=!!execFileSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}}
const info = {...template, gameVersion:version, testProbe:test, ...(test?{reviewSourceCommit:revision,reviewSourceDirty:dirty}:{}), builtAt:new Date().toISOString(),
 files:Object.fromEntries(artifacts)};
if(fs.existsSync(output)){
 const existing = paths(output);
 if(!existing.includes('BUILD.json'))throw Error('빌드 정보가 없는 폴더를 보존합니다.');
 const previous = JSON.parse(fs.readFileSync(path.join(output,'BUILD.json'),'utf8'));
 if(previous.testProbe!==test)throw Error('다른 종류의 빌드 출력이므로 삭제를 중단합니다.');
 const expected = new Set([...outputFiles,'BUILD.json']);
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
for(const f of outputFiles){const target=path.join(output,f);fs.mkdirSync(path.dirname(target),{recursive:true});
 if(Object.hasOwn(pages,f))fs.writeFileSync(target,pages[f]);else if(Object.hasOwn(reviewFiles,f))fs.writeFileSync(target,reviewFiles[f]);else fs.copyFileSync(path.join(source,f),target);
}
fs.writeFileSync(path.join(output,'BUILD.json'),JSON.stringify(info,null,1)+'\n');
console.log(`빌드 완료 → ${path.basename(output)}, 게임 버전 ${version}, 시험 훅 ${test?'포함':'없음'}`);
