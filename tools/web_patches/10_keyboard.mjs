// 10 키보드 조작 통일 (Phase 1C, 마리오 2.0 조작 체계 계승)
//   A 왼쪽 · D 오른쪽 · W 위·문 · S 앉기·아래 파이프 · 쉼표(,) 달리기 · 마침표(.) 점프 · H 도움말 · Enter 확인·계속
//   한 동작에 키 하나. 방향키·Space·Z·X·Shift·같은 방향 두 번 누르기 달리기·W 점프는 없앤다.
//   KeyboardEvent.code로 읽는다(한글 자판에서도 같은 자리의 키). Phaser 키(keyCode 기반)는 더 이상 등록하지 않는다.
//   키 고정 방지: 창 포커스 잃음·화면 숨김·도움말·문제 풀이·랭킹·대화 창이 열리면 모든 키를 뗀 상태로 만든다.
//   게임 물리·바닥·몬스터·맵은 바꾸지 않는다(점프 높이·달리기 속도 등 그대로, 누르는 키만 바뀜).
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INPUT = `
/* HOJA Phase 1C: 키보드 입력(KeyboardEvent.code). 키 하나 = 동작 하나 */
const HOJA_P1C_INPUT=(()=>{
  const mk=()=>({isDown:false,isUp:true,_justDown:false,_justUp:false,timeDown:0,timeUp:0,repeats:0,enabled:true});
  const CODE={KeyA:'left',KeyD:'right',KeyW:'up',KeyS:'down',Comma:'run',Period:'jump',Enter:'enter'};
  const keys={left:mk(),right:mk(),up:mk(),down:mk(),run:mk(),jump:mk(),enter:mk()};
  const DEAD=Object.freeze(mk()); // 예전 키 이름·개발용 키: 절대 눌리지 않음
  // code가 빈 값('')이나 'Unidentified'로 오는 입력 환경(일부 화면 키보드·원격 입력)만: 같은 물리 키의 글자로 판별.
  // 영문·한글 두벌식 자리(A=ㅁ, D=ㅇ, W=ㅈ, S=ㄴ, H=ㅗ). 다른 키를 같은 동작에 더하는 것이 아니다.
  const BY_KEY={a:'KeyA',A:'KeyA','ㅁ':'KeyA',d:'KeyD',D:'KeyD','ㅇ':'KeyD',w:'KeyW',W:'KeyW','ㅈ':'KeyW',s:'KeyS',S:'KeyS','ㄴ':'KeyS',
    h:'KeyH',H:'KeyH','ㅗ':'KeyH',',':'Comma','.':'Period',Enter:'Enter'};
  const codeOf=e=>(e.code&&e.code!=='Unidentified')?e.code:(BY_KEY[e.key]||'');
  // 키를 떼도 '막 눌림'(_justDown)은 게임이 읽을 때까지 남긴다(Phaser 키와 같음: 아주 짧게 톡 친 점프도 들어감).
  // releaseAll(창 전환·도움말·문제 창 등)은 남은 눌림까지 지운다.
  function release(name,drop){const k=keys[name];if(k.isDown){k.isDown=false;k.isUp=true;k._justUp=true;k.timeUp=performance.now();}if(drop)k._justDown=false;}
  function releaseAll(){for(const n in keys)release(n,true);}
  function blocked(e){
    if(e.target&&e.target.closest&&e.target.closest('input,textarea,select,[contenteditable=true]'))return true;
    if(window.HOJA_HELP&&window.HOJA_HELP.open)return true;
    if(window.HOJA_REVIEW&&window.HOJA_REVIEW.isOpen)return true;
    const rank=document.getElementById('hojaRankOverlay');if(rank&&rank.classList.contains('is-open'))return true;
    const quiz=document.getElementById('quizOverlay');if(quiz&&quiz.classList.contains('active'))return true;
    if(window.HOJA_EVENT_DIALOGUE_STATUS&&window.HOJA_EVENT_DIALOGUE_STATUS().open)return true;
    return false;
  }
  window.addEventListener('keydown',e=>{
    const name=CODE[codeOf(e)];if(!name)return;
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(blocked(e)){releaseAll();return;}
    if(name!=='enter')e.preventDefault();
    const k=keys[name];
    if(!k.isDown){k.isDown=true;k.isUp=false;k._justDown=true;k._justUp=false;k.timeDown=performance.now();k.repeats=0;}
    else k.repeats++;
  },true);
  window.addEventListener('keyup',e=>{const name=CODE[codeOf(e)];if(name)release(name,false);},true);
  window.addEventListener('blur',releaseAll);
  window.addEventListener('pagehide',releaseAll);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll();});
  const state=()=>{const o={};for(const n in keys)o[n]=keys[n].isDown;return o;};
  window.HOJA_P1C_INPUT=Object.freeze({releaseAll,state,codeOf,codes:Object.freeze({...CODE})});
  return Object.freeze({keys,DEAD,releaseAll});
})();
`;
const KEYS = `    const I=HOJA_P1C_INPUT,X=I.DEAD;
    // HOJA Phase 1C: A·D·W·S·쉼표·마침표·Enter만. 예전 이름(a/d/w/s/z/x)과 개발용 키는 눌리지 않는 키.
    this.keys={left:I.keys.left,right:I.keys.right,up:I.keys.up,down:I.keys.down,run:I.keys.run,jump:I.keys.jump,enter:I.keys.enter,
      a:X,d:X,w:X,s:X,z:X,x:X,reset:X,pause:X,sound:X,fps:X,bg:X,lampPerf:X,cull:X,hurryTest:X,visionSoft:X,emergency:X,
      profile:X,scaleBench:X,scaleQuick:X,renderBench:X};
    I.releaseAll();
`;
export default {
  title: '키보드 조작 통일 (A·D·W·S·쉼표·마침표·H·Enter, code 기반)',
  arcade(A) {
    A.edit('let ACTIVE_SCENE=null;', 'let ACTIVE_SCENE=null;' + INPUT);
    // Phaser 키 등록 + Space 기본 동작 막기 → 위 입력 관리자
    A.editRange('    this.keys={\n      left:this.input.keyboard.addKey(K.LEFT)', '    this.hojaDoubleTap=hojaNewDoubleTapState();', KEYS);
    A.edit("    this.keys.chunkToggle=this.input.keyboard.addKey('Y');\n    this.keys.chunkBench=this.input.keyboard.addKey('I');\n    this.keys.vision=this.input.keyboard.addKey('V');\n    this.keys.caveLight=this.input.keyboard.addKey('L');",
      '    this.keys.chunkToggle=this.keys.chunkBench=this.keys.vision=this.keys.caveLight=HOJA_P1C_INPUT.DEAD; // 개발용 키 없음');
    // 같은 방향 두 번 누르기 달리기 제거(달리기는 쉼표 하나)
    A.edit('const doubleTapRun=hojaDoubleTapRun(this.hojaDoubleTap,time,left,right);', 'const doubleTapRun=false; // Phase 1C: 두 번 누르기 달리기 없음');
    // W는 위·문 진입만, 점프는 마침표 하나
    A.edit('const jumpPressed=spacePressed||zPressed||(upPressed&&!usedDoor);', 'const jumpPressed=spacePressed||zPressed; // Phase 1C: W 점프 없음');
    A.edit('    const jumpHeld=this.keys.jump.isDown||this.keys.z.isDown||\n      this.keys.up.isDown||this.keys.w.isDown;', '    const jumpHeld=this.keys.jump.isDown;');
    // 스테이지 넘기기: Enter 하나
    A.edit('      const pressed=Phaser.Input.Keyboard.JustDown(this.keys.enter)||\n        Phaser.Input.Keyboard.JustDown(this.keys.jump)||\n        Phaser.Input.Keyboard.JustDown(this.keys.z);',
      '      const pressed=Phaser.Input.Keyboard.JustDown(this.keys.enter);');
    A.edit('`Enter / Space ▶ 스테이지 ${STAGE_INDEX+2}`', '`Enter ▶ 스테이지 ${STAGE_INDEX+2}`');
    A.edit("? 'R · 처음부터 다시'", "? ''");
    A.edit('↑ 한 번 더: 끝내기', 'W 한 번 더: 끝내기');
    // 쓰러짐 창 계속: Enter 하나
    A.edit("if(ev.code!=='Enter'&&ev.code!=='Space')return;", "if(ev.code!=='Enter')return;");
    // 이야기 대화 넘기기: Enter 하나 (Esc 닫기는 그대로)
    A.edit("else if(['Enter',' ','ArrowRight'].includes(ev.key))advance();", "else if(ev.code==='Enter')advance();");
    // 문제 풀이: 숫자 키(또는 보기 클릭)만. 방향키 이동·Enter/Space 고르기·O/X 키 제거
    A.editRange("      if(q.type==='OX'){\n        const oi=", "    window.addEventListener('keydown',this.quizKeyHandler);",
      "      if(!(ev.code in map))return;\n      ev.preventDefault();\n      if(ev.repeat||performance.now()-openedAt<250)return;\n      finish(map[ev.code]);\n    };\n    HOJA_P1C_INPUT.releaseAll();\n");
    A.edit('<div id="quizHint">숫자 1~3 · 방향키로 고르고 Enter · O/X 문제는 O·X 키</div>', '<div id="quizHint">숫자 키 1·2·3 또는 보기를 눌러 고르기</div>');
    A.edit("        overlay.classList.remove('active','hojaQuizSuccess');\n        this.quizActive=false;\n        this.scene.resume();",
      "        overlay.classList.remove('active','hojaQuizSuccess');\n        this.quizActive=false;\n        HOJA_P1C_INPUT.releaseAll();\n        this.scene.resume();");
    A.edit("    if(choices)choices.dataset.locked='0';\n    this.quizActive=false;\n  }", "    if(choices)choices.dataset.locked='0';\n    this.quizActive=false;\n    HOJA_P1C_INPUT.releaseAll();\n  }");
    // 교사 도구용 방향키 터치 수신부(가상 입력) 제거 — 보내는 쪽은 1B-9에서 이미 제거됨
    const ctx = { window: {} };
    const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'legacy/MANIFEST.json'), 'utf8'));
    const p = man.pieces.find(x => /_script_hojaTeacherToolsArcadeSourceV1\.js$/.test(x.file));
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'legacy', p.file), 'utf8'), ctx);
    A.edit(ctx.window.HOJA_TT_ARCADE_BRIDGE_SOURCE, '');
  },
};
