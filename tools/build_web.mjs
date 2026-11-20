#!/usr/bin/env node
// HOJA Phase 1B — 웹 시험판 빌드.
//   legacy/game/* (Game.html 무손실 조각, 수정하지 않음) + tools/web_patches/*.mjs (번호 순서대로 적용)
//   -> dist/index.html   교사 화면 (카트리지 선택 · 모드 선택 · 싱글 QR)
//      dist/play.html    학생 화면 (싱글 QR로 바로 아케이드)
//      dist/arcade.html  미리 조립한 아케이드 (기존에는 실행할 때마다 gzip을 풀어 srcdoc으로 만들던 것)
//      dist/BUILD.json   빌드 정보 (게임 버전 = QR이 담는 gv)
// 모든 수정은 "정확히 한 번 나오는 원문"을 바꾸는 방식이다. 원문이 없거나 두 번 이상 나오면 빌드를 멈춘다.
//   node tools/build_web.mjs [OUT_DIR=dist]
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import { assemble } from './assemble_arcade.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const once = (text, before, after, where) => {
  const i = text.indexOf(before);
  if (i < 0 || text.indexOf(before, i + before.length) >= 0) throw new Error(`[${where}] 원문이 정확히 한 번 있어야 함: ${before.slice(0, 90)}`);
  return text.slice(0, i) + (typeof after === 'function' ? after(before) : after) + text.slice(i + before.length);
};

// ---- 부모 페이지 조각
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'legacy/MANIFEST.json'), 'utf8'));
const pieces = man.pieces.map(p => ({ file: p.file.replace(/^game\//, ''), text: fs.readFileSync(path.join(ROOT, 'legacy', p.file), 'utf8'), dropped: false }));
const findPiece = re => { const hit = pieces.filter(p => re.test(p.file)); if (hit.length !== 1) throw new Error('조각을 하나로 특정할 수 없음: ' + re); return hit[0]; };

const P = {
  /** 조각 하나에서 원문을 정확히 한 번 바꾼다 */
  edit(re, before, after) { const p = findPiece(re); p.text = once(p.text, before, after, p.file); },
  /** start(포함)부터 end(제외) 직전까지를 바꾼다. start·end 모두 정확히 한 번 있어야 한다 */
  editRange(re, start, end, after) {
    const p = findPiece(re); const a = p.text.indexOf(start), b = p.text.indexOf(end, a);
    if (a < 0 || b < 0 || p.text.indexOf(start, a + 1) >= 0 || p.text.indexOf(end, b + 1) >= 0) throw new Error(`[${p.file}] 범위 표지 오류: ${start.slice(0, 60)}`);
    p.text = p.text.slice(0, a) + after + p.text.slice(b);
  },
  /** 조각 본문 전체를 바꾼다(작은 블록 교체용) */
  replaceBody(re, body) { findPiece(re).text = body; },
  /** <script>/<style> 블록을 태그째 지운다 (id로) */
  dropBlock(id) { const p = findPiece(new RegExp(`^\\d{3}_(script|style)_${id}\\.`)); if (p.dropped) throw new Error('이미 지움: ' + id); p.dropped = true; },
  head: { index: [], play: [] },
  body: { index: [], play: [] },
  /** </head> 앞 / </body> 앞에 넣을 것 (pages: 'index' | 'play' | 'both') */
  inject(where, html, pages = 'both') { for (const pg of pages === 'both' ? ['index', 'play'] : [pages]) P[where][pg].push(html); },
  copies: [],
  /** dist로 복사할 파일/폴더: [저장소 안 경로, dist 안 경로] */
  copy(from, to) { P.copies.push([from, to]); },
  notes: [],
};

// ---- 아케이드 (조립 후 수정)
let arcade = assemble('KEEP');
const A = {
  edit(before, after) { arcade = once(arcade, before, after, 'arcade'); },
  removeBlock(tag, id) {
    const re = new RegExp(`<${tag} id="${id}">[\\s\\S]*?</${tag}>\\n?`, 'g');
    const n = (arcade.match(re) || []).length; if (n !== 1) throw new Error(`아케이드 블록 ${id}: ${n}개`);
    arcade = arcade.replace(re, '');
  },
  editRange(start, end, after) {
    const a = arcade.indexOf(start), b = arcade.indexOf(end, a);
    if (a < 0 || b < 0 || arcade.indexOf(start, a + 1) >= 0) throw new Error(`[arcade] 범위 표지 오류: ${start.slice(0, 60)}`);
    arcade = arcade.slice(0, a) + after + arcade.slice(b);
  },
  /** 정규식 치환: 맞는 곳이 정확히 count개여야 한다 */
  replaceRe(re, after, count) {
    const n = (arcade.match(re) || []).length; if (n !== count) throw new Error(`[arcade] ${re} : ${n}개 (기대 ${count})`);
    arcade = arcade.replace(re, after);
  },
  beforeBodyEnd(html) { const i = arcade.lastIndexOf('</body>'); if (i < 0) throw new Error('아케이드 </body> 없음'); arcade = arcade.slice(0, i) + html + '\n' + arcade.slice(i); },
};

// ---- 기본 변경(Phase 1B 기반): 아케이드를 미리 조립한 파일로 실행
// 시즌: 원본은 첫 번째 자리표시자만 시즌 이름으로 바꿨다. 같은 자리를 주소의 ?season= 으로 정한다.
A.edit(`window.HOJA_ARCADE_SEASON='__HOJA_ARCADE_SEASON__';</script><style id="hojaV055ArcadeSharedHud">`,
  `window.HOJA_ARCADE_SEASON=(function(){var s=new URLSearchParams(location.search).get('season');return /^(spring|summer|autumn|winter)$/.test(s||'')?s:'spring';})();</script><style id="hojaV055ArcadeSharedHud">`);
// 부모: gzip 풀기 + srcdoc 대신 arcade.html 주소로 연다. 큰 gzip 상수(약 0.7MB)는 더 이상 쓰지 않으니 뺀다.
{
  const g = findPiece(/_script_hojaV051Gameplay\.js$/);
  const a = g.text.indexOf("const HOJA_V051_ARCADE_GZIP='"), b = g.text.indexOf('\n', a);
  if (a < 0 || g.text.indexOf("const HOJA_V051_ARCADE_GZIP='", a + 1) >= 0) throw new Error('GZIP 상수 위치');
  g.text = g.text.slice(0, a) + '/* HOJA Phase 1B: 아케이드는 빌드 때 조립한 arcade.html로 연다(tools/build_web.mjs). */' + g.text.slice(b);
  const s = g.text.indexOf('    let restoredBase=(await expandArcade())');
  const e = g.text.indexOf('const f=frame();f.srcdoc=src;', s);
  if (s < 0 || e < 0) throw new Error('아케이드 실행부 위치');
  g.text = g.text.slice(0, s) + "    if(own!==loadId)return;const f=frame();f.src='arcade.html?season='+encodeURIComponent(season)+(window.HOJA_ARCADE_QUERY||'');" + g.text.slice(e + 'const f=frame();f.srcdoc=src;'.length);
}

// ---- 번호 붙은 변경 묶음
const patchDir = path.join(ROOT, 'tools/web_patches');
const patchFiles = fs.existsSync(patchDir) ? fs.readdirSync(patchDir).filter(f => /^\d{2}_.*\.mjs$/.test(f)).sort() : [];
const applied = [];
for (const f of patchFiles) {
  const mod = (await import(pathToFileURL(path.join(patchDir, f)).href)).default;
  mod.parent?.(P);
  mod.arcade?.(A);
  applied.push({ file: f, title: mod.title });
}

// ---- 시험 전용 확인 함수 (HOJA_TEST_PROBE=1 일 때만, 배포용 dist에는 절대 넣지 않음)
const TEST_PROBE = process.env.HOJA_TEST_PROBE === '1';
if (TEST_PROBE) {
  A.edit('let PENDING_SEED=null;', "let PENDING_SEED=Number(sessionStorage.getItem('HOJA_TEST_SEED'))||null;");
  A.edit('    this.showStageBanner();\n    this.updateHUD();\n    syncBgm();', '    this.showStageBanner();\n    this.updateHUD();\n    syncBgm();\n    if(sessionStorage.getItem(\'HOJA_TEST_PAUSE_START\')===\'1\')this.scene.pause();');
  A.edit('let ACTIVE_SCENE=null;', 'let ACTIVE_SCENE=null;window.HOJA_TEST_PROBE=Object.freeze({' +
    'state(){const s=ACTIVE_SCENE;if(!s||!s.playerBody)return null;const b=s.playerBody.body;return {x:Math.round(s.playerBody.x),y:Math.round(s.playerBody.y),vx:Math.round(b.velocity.x),vy:Math.round(b.velocity.y),' +
    'grounded:!!(b.blocked.down||b.touching.down),sitting:!!s.hojaIsSitting,quiz:!!s.quizActive,paused:!!s.manualPaused,timeUp:!!s.timeUp,clear:!!s.clear,sec:Math.ceil(s.remainingMs/1000),found:RUN.found,stage:STAGE_INDEX};},' +
    'quiz(){const s=ACTIVE_SCENE;const e=(s.enemies||[]).find(x=>x&&x.type===\'BALLOONEY\'&&!x.dead&&x.bodyObj&&x.bodyObj.active!==false);if(!e)return false;s.showQuiz(e);return true;},' +
    'setTime(sec){const s=ACTIVE_SCENE;s.remainingMs=sec*1000;RUN.remainingMs=s.remainingMs;},' +
    'death(){ACTIVE_SCENE.startDeath(\'pit\');},' +
    'metrics(){return {...hojaStep09_3Metrics_()};},resume(){ACTIVE_SCENE.scene.resume();},' +
    'snapshot(){const s=ACTIVE_SCENE;if(!s?.playerBody?.body)return null;const b=s.playerBody.body;return {' +
    'seed:RUN.seed,stage:STAGE_INDEX,remainingMs:s.remainingMs,score:s.score,found:RUN.found,deaths:RUN.deaths,' +
    'player:{x:s.playerBody.x,y:s.playerBody.y,vx:b.velocity.x,vy:b.velocity.y,blocked:{...b.blocked},touching:{...b.touching}},' +
    'enemies:(s.enemies||[]).map(e=>({type:e.type,key:e.memKey,state:e.state,alive:e.alive,consumed:e.consumed,x:e.bodyObj?.x,y:e.bodyObj?.y,vx:e.bodyObj?.body?.velocity.x,vy:e.bodyObj?.body?.velocity.y})),' +
    'quiz:!!s.quizActive,dying:!!s.dying,clear:!!s.clear,timeUp:!!s.timeUp,records:window.HOJA_RUN_RECORD(),metrics:hojaStep09_3Metrics_()};}});');
  // Separate, visibly marked controls for focused manual regression tests.
  // These call actual game paths; they do not establish that a natural route is reachable.
  A.beforeBodyEnd(`<div id="hojaTestControls" style="position:fixed;left:0;bottom:0;z-index:2147483647;background:#fff;color:#000;padding:8px">
    TEST ONLY · <button id="hojaTestDeath">쓰러짐 유도</button>
    <button id="hojaTestQuiz">문제 열기</button>
    <button id="hojaTestTimeout">2초 후 종료</button>
  </div><script>
  document.getElementById('hojaTestDeath').onclick=()=>window.HOJA_TEST_PROBE.death();
  document.getElementById('hojaTestQuiz').onclick=()=>window.HOJA_TEST_PROBE.quiz();
  document.getElementById('hojaTestTimeout').onclick=()=>window.HOJA_TEST_PROBE.setTime(2);
  </script>`);
  if (!process.argv[2]) process.argv[2] = 'dist-test';
}

// ---- 합치기
const DROP = '\u0000HOJA_DROP\u0000';
let base = pieces.map(p => (p.dropped ? DROP : p.text)).join('');
const dropCount = pieces.filter(p => p.dropped).length;
const dropRe = new RegExp(`\\n?<(script|style)\\b[^>]*>${DROP}</(script|style)>`, 'g');
if ((base.match(dropRe) || []).length !== dropCount) throw new Error('지운 블록 태그 짝이 맞지 않음');
base = base.replace(dropRe, '');

const gameVersion = sha(base + '\u0000' + arcade).slice(0, 10);
const page = name => {
  const build = `<script id="hojaBuildInfo">window.HOJA_BUILD=Object.freeze({gameVersion:'${gameVersion}',page:'${name}'});</script>`;
  let t = once(base, '</head>', build + P.head[name].join('') + '</head>', name);
  const i = t.lastIndexOf('</body>'); if (i < 0) throw new Error('</body> 없음');
  return t.slice(0, i) + P.body[name].join('\n') + '\n' + t.slice(i);
};

const out = path.resolve(ROOT, process.argv[2] || 'dist');
if (TEST_PROBE && out !== path.join(ROOT, 'dist-test')) {
  throw new Error('시험 전용 빌드 출력은 dist-test만 허용합니다.');
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const files = { 'index.html': page('index'), 'play.html': page('play'), 'arcade.html': arcade };
for (const [n, t] of Object.entries(files)) fs.writeFileSync(path.join(out, n), t);
for (const [from, to] of P.copies) fs.cpSync(path.join(ROOT, from), path.join(out, to), { recursive: true });
const info = {
  gameVersion, testProbe: TEST_PROBE, builtAt: new Date().toISOString(), source: man.sha256, patches: applied,
  files: Object.fromEntries(Object.entries(files).map(([n, t]) => [n, { bytes: Buffer.byteLength(t), sha256: sha(t) }])),
};
fs.writeFileSync(path.join(out, 'BUILD.json'), JSON.stringify(info, null, 1) + '\n');
console.log(`빌드 완료 → ${path.relative(ROOT, out)}  게임 버전 ${gameVersion}`);
for (const [n, v] of Object.entries(info.files)) console.log(`  ${n}: ${v.bytes.toLocaleString()} bytes`);
for (const a of applied) console.log(`  적용: ${a.file} — ${a.title}`);
