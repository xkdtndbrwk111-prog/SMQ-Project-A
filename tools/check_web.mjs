#!/usr/bin/env node
// HOJA Phase 1B — 빌드 결과(dist) 정적 검사. 하나라도 어기면 종료 코드 1.
//  1 Firebase 미사용: firebase / firestore / firebaseio / gstatic firebasejs / identitytoolkit 문자열 0건
//  2 Apps Script 미사용: google.script.run / withSuccessHandler / script.google.com 0건
//  3 외부 스크립트: Phaser(jsDelivr, 버전 고정) 외에는 없음. 나머지 src는 같은 서버의 파일만
//  4 모든 인라인·로컬 <script> 문법 검사(vm.Script로 컴파일만, 실행 안 함)
//  5 제거 확인: 팀전·튜토리얼 블록, 개인 카트리지 진입, F9 진단, 교사 도구 터치 시험 연결이 없음
//  6 학생 화면 연결: play.html에만 student.js, index.html에만 teacher_qr.js
//   node tools/check_web.mjs [DIST=dist]
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { checkModuleOrder } from './check_module_order.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.resolve(ROOT, process.argv[2] || 'dist');
const read = f => fs.readFileSync(path.join(dist, f), 'utf8');
let fails = 0;
const ok = (cond, label, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`); if (!cond) fails++; };

const textFiles = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(html|js|json|md)$/.test(e.name)) textFiles.push(path.relative(dist, p)); } })(dist);

// 1, 2
const count = re => textFiles.reduce((n, f) => n + (read(f).match(re) || []).length, 0);
ok(count(/firebase|firestore|firebaseio|identitytoolkit/gi) === 0, 'Firebase 문자열 0건', `${textFiles.length}개 파일 검사`);
ok(count(/google\.script|withSuccessHandler|script\.google\.com/g) === 0, 'Apps Script 호출 0건');

// 3, 4
const pages = ['index.html', 'play.html', 'arcade.html'];
const external = new Set();
let inlineCount = 0, syntaxFail = [];
for (const pg of pages) {
  const t = read(pg);
  for (const m of t.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1], body = m[2];
    const src = attrs.match(/\bsrc=["']([^"']+)["']/)?.[1];
    if (src) {
      if (/^(https?:)?\/\//.test(src)) external.add(src);
      else { const f = path.join(dist, src.split('?')[0]); if (!fs.existsSync(f)) syntaxFail.push(`${pg}: 없는 파일 ${src}`); else try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: src }); } catch (e) { syntaxFail.push(`${src}: ${e.message}`); } }
      continue;
    }
    const type = attrs.match(/\btype=["']([^"']+)["']/)?.[1] || '';
    if (type && !/javascript|module/.test(type)) continue;
    inlineCount++;
    try { new vm.Script(body, { filename: `${pg}#${inlineCount}` }); } catch (e) { syntaxFail.push(`${pg} 인라인 #${inlineCount}: ${e.message}`); }
  }
}
const allowed = [...external].every(u => /^https:\/\/cdn\.jsdelivr\.net\/npm\/phaser@\d+\.\d+\.\d+\//.test(u));
ok(allowed, '외부 스크립트는 Phaser(jsDelivr, 버전 고정)뿐', [...external].join(', ') || '없음');
ok(syntaxFail.length === 0, `스크립트 문법 (인라인 ${inlineCount}개 + 로컬 파일)`, syntaxFail.join(' | '));

// 5
const idx = read('index.html'), ply = read('play.html'), arc = read('arcade.html');
const keyboard = fs.existsSync(path.join(dist,'js/keyboard.js')) ? read('js/keyboard.js') : '';
const b0 = JSON.parse(read('BUILD.json'));
if(fs.existsSync(path.join(dist,'js/arcade-host.js'))){
  const orderErrors=checkModuleOrder({'index.html':idx,'play.html':ply,'arcade.html':arc});
  ok(orderErrors.length===0, '모듈 동기 로드와 초기화 순서',orderErrors.join(' | '));
}

const gone = (t, re) => !re.test(t);
for (const [label, re] of [
  ['팀전 블록', /id="hojaTeam(V067Runtime|R10PortraitAssets|V067Assets)"/],
  ['팀전 실행 호출', /HOJA_TEAM_TEST\.launch/],
  ['튜토리얼 블록·관문', /id="hojaR17(KTutorialGzip|LTutorialIntegration|STutorialNativeBridge)"|id="hojaTutOverlay"/],
  ['연습모드 카드', /'연습모드'/],
  ['문제 풀이 모드 버튼', /button\('문제 풀이 모드'/],
  ['개인 카트리지 클릭 연결', /getElementById\('hrPrivate'\)\?\.addEventListener/],
  ['F9 진단 전달', /HOJA_V063_PERF_TOGGLE'\},'\*'\)/],
  ['교사 도구 터치 시험 연결', /HOJA_TT_TOUCH_V1/],
  ['gzip 아케이드 상수', /HOJA_V051_ARCADE_GZIP='/],
]) ok(gone(idx, re) && gone(ply, re), `제거됨: ${label}`);
ok(gone(arc, /id="hojaV063Perf(Style|Script)"/), '제거됨: 아케이드 F9 성능 패널');
ok(/id="hojaP1BHelp"/.test(arc) && /qaKeys=new Set\(\['B','C','F','G','I'/.test(arc), 'H 도움말 들어감, H만 차단 목록에서 빠짐');
ok(!/__HOJA_ARCADE_SEASON__';<\/script><style id="hojaV055ArcadeSharedHud">/.test(arc), '아케이드 시즌은 주소(?season=)로 정함');

// 5-1 Phase 1C 조작·도움말·기록
ok(!/addKey\(/.test(arc) && !/hojaDoubleTapRun\(this/.test(arc) && /const HOJA_P1C_INPUT=/.test(arc), '키 입력은 code 기반 관리자뿐 (Phaser addKey·두 번 누르기 달리기 없음)');
ok(/CODE=\{KeyA:'left',KeyD:'right',KeyW:'up',KeyS:'down',Comma:'run',Period:'jump',Enter:'enter'\}/.test(arc+keyboard), '조작표: A·D·W·S·쉼표·마침표·Enter (키 하나 = 동작 하나)');
ok(!/jumpPressed=spacePressed\|\|zPressed\|\|\(upPressed/.test(arc), 'W 점프 없음');
ok(!/<kbd>(Space|Shift|←→|↑|↓)<\/kbd>/.test(arc) && !/O\/X 문제는 O·X 키/.test(arc), '중복·개발용 키 안내 없음');
ok(!/HOJA_TT_ARCADE/.test(arc) && !/id="hojaHelpBtn"|hojaHelpBtn'/.test(arc), '가상 입력 경로·터치 조작 버튼 없음');
ok(/id="hojaP1CReview"/.test(arc) && /window\.HOJA_RUN_RECORD=/.test(arc), '결산·오답 풀이와 문항별 응답 기록 들어감');
ok(count(/HOJA_TEST_PROBE/g)===0 && b0.testProbe === false, '시험 전용 확인 함수 없음(배포본)');
if(fs.existsSync(path.join(dist,'js/arcade-host.js')))
  ok(count(/HOJA_PHASER_APP|HOJA_STEP09_3_TEST|HOJA_STEP12_6_HUD_TEST|HOJA_STEP10_RANK_UI|HOJA_V064_PERF_|HOJA_V049_QA|HOJA_V050_QA|HOJA_STEP12_3_QUIZ_LAYOUT/g)===0, '과거 시험용 게임 조작 API 없음(배포본)');

// 6
ok(/src="js\/student\.js"/.test(ply) && !/src="js\/student\.js"/.test(idx), 'student.js는 play.html에만');
ok(/src="js\/teacher_qr\.js"/.test(idx) && !/src="js\/teacher_qr\.js"/.test(ply), 'teacher_qr.js는 index.html에만');
const b = JSON.parse(read('BUILD.json'));
ok(idx.includes(`gameVersion:'${b.gameVersion}'`) && ply.includes(`gameVersion:'${b.gameVersion}'`), `두 화면의 게임 버전 일치 (${b.gameVersion})`);
const cat = JSON.parse(read('cartridges/catalog.json'));
ok(cat.cartridges.every(c => fs.existsSync(path.join(dist, c.path))), `내장 카트리지 파일 ${cat.cartridges.length}개 있음`);

console.log(fails ? `FAIL ${fails}건` : 'ALL PASS');
process.exit(fails ? 1 : 0);
