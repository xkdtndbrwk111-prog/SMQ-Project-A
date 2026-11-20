/* HOJA Phase 1B — 학생 화면(play.html): 싱글 QR로 들어와 바로 아케이드.
   카탈로그·저장소·모드 선택·로그인·대기실·시작 신호 없음. 첫 화면의 [시작] 한 번(소리 재생 허용용 터치)만 있다.
   QR 확인: m=s(싱글) · gv(게임 버전) · c/cv(카트리지 id/버전)가 지금 배포본과 같아야 한다.
   다르면 막고 "선생님께 새 QR을 요청하세요"를 보여 준다. 파이어베이스·앱스 스크립트를 쓰지 않음(카트리지는 같은 서버의 파일). */
(function () {
  'use strict';
  const css = `
html.hojaStudentPage #hojaSharedBack,html.hojaStudentPage #hojaRepoChoice,html.hojaStudentPage #hojaCatalog,
html.hojaStudentPage #hojaNextMode{display:none!important}
#hojaStudentGate{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(ellipse at 50% 20%,#2f6d86,#10283a 70%,#081522);color:#fff6dc;
  font-family:system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;text-align:center}
#hojaStudentGate[hidden]{display:none!important}
#hojaStudentGate .sgCard{width:min(560px,92vw)}
#hojaStudentGate h1{margin:0;font-size:clamp(40px,9vw,76px);font-weight:950;letter-spacing:.04em;text-shadow:0 5px 0 #0a1a26}
#hojaStudentGate .sgMode{margin:2px 0 18px;font-weight:800;font-size:clamp(15px,2.6vw,20px);color:#ffd77a}
#hojaStudentGate .sgUnits{margin:0 0 18px;font-weight:800;font-size:clamp(16px,2.8vw,22px)}
#hojaStudentGate .sgStatus{min-height:1.4em;margin:0 0 14px;font-weight:700;font-size:15px;color:#cfe6f0}
#hojaStudentGate .sgError{margin:0 0 14px;padding:12px 14px;border-radius:10px;background:#ffe1d6;color:#7d220c;
  border:3px solid #d9573b;font-weight:800;font-size:clamp(15px,2.6vw,19px);line-height:1.45}
#hojaStudentGate .sgError[hidden]{display:none}
#hojaStudentStart{padding:16px 46px;font:950 clamp(22px,4.4vw,32px) system-ui,sans-serif;color:#2b2420;background:#ffd36b;
  border:4px solid #2b2420;border-radius:14px;box-shadow:0 7px 0 #2b2420;cursor:pointer}
#hojaStudentStart:disabled{opacity:.45;cursor:default}
#hojaStudentStart[hidden]{display:none}
#hojaStudentGate .sgHint{margin:16px 0 0;font-size:14px;color:#a9cbd9;font-weight:700}`;
  const style = document.createElement('style'); style.id = 'hojaStudentStyle'; style.textContent = css; document.head.appendChild(style);
  document.documentElement.classList.add('hojaStudentPage');

  const gate = document.createElement('div'); gate.id = 'hojaStudentGate';
  gate.innerHTML = '<div class="sgCard"><h1>HOJA</h1><p class="sgMode">혼자 아케이드</p><p class="sgUnits" id="hojaStudentUnits"></p>' +
    '<p class="sgError" id="hojaStudentError" hidden></p><p class="sgStatus" id="hojaStudentStatus">문제를 준비하는 중…</p>' +
    '<button type="button" id="hojaStudentStart" disabled>시작</button><p class="sgHint" id="hojaStudentHint">이동 <b>A D</b> · 점프 <b>.</b> · 달리기 <b>,</b> · 게임 중 <b>H</b>: 조작 도움말</p></div>';
  const $ = id => document.getElementById(id);
  let ready = false, season = 'spring', played = false;

  // 교사용 흐름 끊기: 인트로가 끝나거나 눌려도 저장소/카탈로그로 가지 않는다
  if (window.HOJA_REPOSITORY) window.HOJA_REPOSITORY.show = function () {};

  function fail(text) {
    ready = false; $('hojaStudentError').textContent = text; $('hojaStudentError').hidden = false;
    $('hojaStudentStatus').textContent = ''; $('hojaStudentStart').hidden = true; $('hojaStudentHint').hidden = true;
  }
  const ASK = ' 선생님께 새 QR을 요청하세요.';
  async function prepare() {
    const q = new URLSearchParams(location.search);
    if (q.get('m') !== 's') return fail('싱글 아케이드용 QR이 아닙니다.' + ASK);
    if (!q.get('gv') || q.get('gv') !== window.HOJA_BUILD?.gameVersion) return fail('게임이 새 버전으로 바뀌어 이 QR로는 들어갈 수 없습니다.' + ASK);
    const ids = String(q.get('c') || '').split(',').filter(Boolean), vers = String(q.get('cv') || '').split(',').filter(Boolean);
    if (!ids.length || ids.length > 5 || ids.length !== vers.length || new Set(ids).size !== ids.length) return fail('QR 정보가 올바르지 않습니다.' + ASK);
    const s = q.get('s'); season = /^(spring|summer|autumn|winter)$/.test(s || '') ? s : 'spring';
    let list;
    try { list = await window.HOJA_B_LIVE.catalog(); } catch (e) { return fail('문제 목록을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.'); }
    const picked = ids.map(id => list.find(c => c.id === id));
    if (picked.some(x => !x)) return fail('QR에 있는 단원을 찾을 수 없습니다.' + ASK);
    if (picked.some((x, i) => x.version !== vers[i])) return fail('단원 문제가 바뀌어 이 QR로는 들어갈 수 없습니다.' + ASK);
    $('hojaStudentUnits').textContent = picked.map(x => x.unit || x.name).join(' · ');
    try {
      const results = await window.HOJA_B_LIVE.rpc('GET', picked.map(x => x.name));
      window.HOJA_B_LIVE.setSources(results);
    } catch (e) { return fail('문제를 불러오지 못했습니다: ' + window.HOJA_B_LIVE.showError(e)); }
    ready = true; $('hojaStudentStatus').textContent = '준비 완료! 시작을 누르세요.';
    const b = $('hojaStudentStart'); b.disabled = false; b.focus({ preventScroll: true });
  }
  function start() {
    if (!ready) return;
    window.HOJA_AUDIO_CONTROL?.unlockFromGesture?.();
    const sc = window.HOJA_ATTRACT_SCENE;
    if (sc) { sc.pausedByUser = true; sc.anims?.pauseAll?.(); sc.tweens?.pauseAll?.(); }
    window.HOJA_LOADING?.hide?.();
    if (played) { try { window.HOJA_B_LIVE.setSources(window.HOJA_B_LIVE.sources); } catch (_) { } } // 다시 하기: 문제 순서 새로 섞기
    played = true; gate.hidden = true;
    window.HOJA_GAMEPLAY.launch('arcade', season);
  }
  // 게임 안 '이전'/'처음으로' → 카탈로그·모드 선택 대신 이 화면으로
  window.HOJA_STUDENT_BACK = function () {
    gate.hidden = false;
    $('hojaStudentStatus').textContent = '다시 하려면 시작을 누르세요.';
    $('hojaStudentStart').textContent = '다시 하기';
    $('hojaStudentStart').focus({ preventScroll: true });
  };
  function mount() {
    document.body.appendChild(gate);
    // 인트로(클릭 3번 → 저장소) 등 뒤쪽 화면으로 입력이 새지 않게 막는다
    for (const t of ['click', 'pointerdown', 'pointerup', 'mousedown', 'touchstart']) gate.addEventListener(t, e => e.stopPropagation());
    $('hojaStudentStart').addEventListener('click', start);
    window.addEventListener('keydown', e => {
      if (gate.hidden) return;
      e.stopImmediatePropagation();
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(); }
    }, true);
    prepare();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.HOJA_STUDENT = Object.freeze({ get ready() { return ready; }, get season() { return season; }, start });
})();
