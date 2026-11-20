#!/usr/bin/env node
// HOJA Phase 1 — 아케이드 조립: 기존 Game.html이 실행할 때마다 하던 일(hojaV051Gameplay의 expandArcade +
// launch, Game.html L2862 스크립트 L185-237)을 빌드 때 똑같이 한다. 표·패치·코드는 원본 조각에서 그대로 읽는다:
//   1 gzip 해제본(legacy/decoded/arcade.html)
//   2 __HOJA_R17D_PORTRAIT_(HOJA|NAHANSANG)_NN__ 20개 <- 팀전 초상 JSON의 감정 그림(webp data URI)
//   3 __HOJA_R17D_SHARED_NN__ 44개 <- 부모 페이지 <img>/<audio> id의 src data URI (HOJA_R17D_SHARED_DOM 표)
//   4 시즌 자리표시자(첫 번째만, 원본과 같음), 랭킹 입력 문구 패치 3개(각각 한 번만 있어야 함),
//     'let ACTIVE_SCENE=null;' 뒤에 HOJA_TT_ARCADE_BRIDGE_SOURCE, </head> 앞에 hojaR17GInnerHudOff 스타일
//   node tools/assemble_arcade.mjs SEASON OUT.html     (SEASON: spring|summer|autumn|winter 또는 그대로 둘 'KEEP')
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const L = p => path.join(ROOT, 'legacy', p);
const man = JSON.parse(fs.readFileSync(L('MANIFEST.json'), 'utf8'));
const piece = re => { const p = man.pieces.find(x => re.test(x.file)); if (!p) throw new Error('조각 없음: ' + re); return fs.readFileSync(L(p.file), 'utf8'); };
const game = man.pieces.map(p => fs.readFileSync(L(p.file), 'utf8')).join('');

export function assemble(season) {
  const gameplay = piece(/_script_hojaV051Gameplay\.js$/);
  // the original's own tables, evaluated from its source text
  const grab = (name, open, close) => { const i = gameplay.indexOf(name); const a = gameplay.indexOf(open, i); let depth = 0, j = a; for (; j < gameplay.length; j++) { if (gameplay[j] === open) depth++; else if (gameplay[j] === close && --depth === 0) break; } return vm.runInNewContext('(' + gameplay.slice(a, j + 1) + ')'); };
  const SHARED = grab('const HOJA_R17D_SHARED_DOM=', '[', ']');
  const rankingPatch = grab('const rankingPatch=', '[', ']');
  const bridgeCtx = { window: {} }; vm.runInNewContext(piece(/_script_hojaTeacherToolsArcadeSourceV1\.js$/), bridgeCtx);
  const BRIDGE = bridgeCtx.window.HOJA_TT_ARCADE_BRIDGE_SOURCE;
  // (img or audio: the original reads getElementById(id).getAttribute('src'))
  const imgSrc = id => { const m = game.match(new RegExp(`<[a-zA-Z]+\\s[^>]*\\bid=["']${id}["'][^>]*>`)); if (!m) return ''; const s = m[0].match(/\bsrc=["']([^"']+)["']/); return s ? s[1] : ''; };
  const portraits = JSON.parse(fs.readFileSync(L('decoded/team_portraits.json'), 'utf8'));
  const emotions = ['01_NEUTRAL', '02_SURPRISED', '03_ANGRY', '04_TIRED', '05_SHY', '06_SAD', '07_SLEEPY', '08_EMBARRASSED', '09_SPARKLING', '10_CURIOUS'];
  let ptr = 0, dom = 0;
  let html = fs.readFileSync(L('decoded/arcade.html'), 'utf8')
    .replace(/__HOJA_R17D_PORTRAIT_(HOJA|NAHANSANG)_(\d{2})__/g, (t, ch, idx) => { const uri = portraits.characters?.[ch]?.emotions?.[emotions[+idx]]?.imageData; if (!uri || !uri.startsWith('data:image/webp;base64,')) throw new Error('초상 누락 ' + t); ptr++; return uri; })
    .replace(/__HOJA_R17D_SHARED_(\d{2})__/g, (t, i) => { const def = SHARED[+i]; const uri = def && imgSrc(def[0]); if (!uri || !uri.startsWith('data:') || !uri.includes(';base64,')) throw new Error('공유 그림 누락 ' + t); dom++; return uri; });
  if (ptr !== 20 || dom !== 44 || html.includes('__HOJA_R17D_')) throw new Error(`조립 검증 실패 ${ptr}/${dom}`);
  if (season !== 'KEEP') html = html.replace('__HOJA_ARCADE_SEASON__', season);
  for (const [before, after] of rankingPatch) {
    const first = html.indexOf(before);
    if (first < 0 || html.indexOf(before, first + before.length) >= 0) throw new Error('랭킹 패치 원본 불일치');
    html = html.slice(0, first) + after + html.slice(first + before.length);
  }
  if (!BRIDGE || !html.includes('let ACTIVE_SCENE=null;')) throw new Error('터치 연결 앵커 누락');
  html = html.replace('let ACTIVE_SCENE=null;', 'let ACTIVE_SCENE=null;' + BRIDGE);
  if (!html.includes('</head>')) throw new Error('</head> 없음');
  html = html.replace('</head>', '<style id="hojaR17GInnerHudOff">#hojaArcadeSharedControls{display:none!important;visibility:hidden!important;pointer-events:none!important}</style></head>');
  return html;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [season = 'spring', out] = process.argv.slice(2);
  const html = assemble(season);
  if (out) fs.writeFileSync(out, html);
  console.log(`assembled arcade (${season}): ${Buffer.byteLength(html)} bytes, sha256 ${crypto.createHash('sha256').update(html).digest('hex')}`);
}
