/* HOJA Phase 1B — 교사 화면: 학생용 싱글 QR 만들기.
   QR 주소: play.html?m=s&c=<카트리지 id,...>&cv=<카트리지 버전,...>&gv=<게임 버전>&s=<시즌>
   - m=s  : 싱글 아케이드 입장(학급 대결 QR은 Phase 3에서 다른 주소·다른 m 값으로 따로 만든다)
   - cv/gv: 학생 화면이 지금 배포된 카트리지·게임과 다르면 입장을 막는다(→ 교사에게 새 QR 요청)
   서버 없이 브라우저 안에서 그린다(vendor/qrcode.js, MIT). 파이어베이스·앱스 스크립트를 쓰지 않음. */
(function () {
  'use strict';
  const css = `
#hojaQrOverlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;
  background:rgba(6,12,22,.78);font-family:system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif}
#hojaQrOverlay[hidden]{display:none!important}
#hojaQrCard{width:min(560px,94vw);max-height:94vh;overflow:auto;background:#fff7e6;color:#2b2420;border:4px solid #3b2a22;
  border-radius:16px;box-shadow:0 10px 0 #3b2a22;padding:18px 20px;text-align:center}
#hojaQrCard h2{margin:0;font-size:clamp(20px,3.2vw,28px);font-weight:900}
#hojaQrCard .qrSub{margin:4px 0 10px;color:#6c5240;font-weight:700;font-size:14px}
#hojaQrImg{width:min(330px,70vw);height:auto;image-rendering:pixelated;background:#fff;border:3px solid #3b2a22;border-radius:8px}
#hojaQrUnits{margin:8px 0 0;font-weight:800;font-size:15px}
#hojaQrUrl{margin:8px 0 0;font:600 12px ui-monospace,Menlo,monospace;color:#4a3a30;word-break:break-all;user-select:all}
.hojaQrNote{margin:10px 0 0;padding:8px 10px;border-radius:8px;font-weight:700;font-size:13px;text-align:left}
.hojaQrNote.warn{background:#ffe1d6;color:#8a2a12;border:2px solid #d9573b}
.hojaQrNote.info{background:#e9f3ff;color:#21486e;border:2px solid #7aa7d6}
#hojaQrActions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px}
#hojaQrActions button{padding:9px 16px;font:900 15px system-ui,sans-serif;border:3px solid #3b2a22;border-radius:10px;
  box-shadow:0 4px 0 #3b2a22;cursor:pointer;background:#ffd36b;color:#2b2420}
#hojaQrActions button.close{background:#d9573b;color:#fff}`;
  const style = document.createElement('style'); style.id = 'hojaQrStyle'; style.textContent = css; document.head.appendChild(style);
  const el = document.createElement('div'); el.id = 'hojaQrOverlay'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '학생용 싱글 QR');
  el.innerHTML = '<div id="hojaQrCard"><h2>학생용 싱글 QR</h2><p class="qrSub">학생이 찍으면 바로 아케이드가 시작됩니다.</p>' +
    '<img id="hojaQrImg" alt="학생 입장 QR 코드"><p id="hojaQrUnits"></p><p id="hojaQrUrl"></p><div id="hojaQrNotes"></div>' +
    '<div id="hojaQrActions"><button type="button" id="hojaQrCopy">주소 복사</button><button type="button" id="hojaQrOpen">학생 화면 열어 보기</button>' +
    '<button type="button" class="close" id="hojaQrClose">닫기</button></div></div>';
  const $ = id => document.getElementById(id);
  let url = '';
  function note(kind, text) { const p = document.createElement('p'); p.className = 'hojaQrNote ' + kind; p.textContent = text; $('hojaQrNotes').append(p); }
  function close() { el.hidden = true; }
  async function open(season) {
    const live = window.HOJA_B_LIVE, names = live?.names || [];
    if (!names.length) { window.alert('먼저 카트리지(단원)를 골라 주세요.'); return; }
    let list;
    try { list = await live.catalog(); } catch (e) { window.alert('내장 카트리지 목록을 읽지 못했습니다: ' + live.showError(e)); return; }
    const picked = names.map(n => list.find(c => c.name === n));
    if (picked.some(x => !x)) { window.alert('선택한 카트리지를 내장 목록에서 찾을 수 없습니다.'); return; }
    const families = new Set((live.sources || []).flatMap(e => e.data.questions.filter(q => q.type === 'OX' || q.type === 'MULTIPLE').map(q => e.sheetName + '::' + q.familyId)));
    $('hojaQrNotes').replaceChildren();
    if (families.size < 25) { window.alert('아케이드는 고유 문제 묶음 25개 이상이 필요합니다. 단원을 더 골라 주세요.'); return; }
    const params = new URLSearchParams({
      m: 's', c: picked.map(x => x.id).join(','), cv: picked.map(x => x.version).join(','),
      gv: window.HOJA_BUILD.gameVersion, s: season || 'spring',
    });
    url = new URL('play.html?' + params, location.href).href;
    const q = window.qrcode(0, 'M'); q.addData(url, 'Byte'); q.make();
    $('hojaQrImg').src = q.createDataURL(8, 32);
    $('hojaQrUnits').textContent = picked.map(x => x.unit || x.name).join(' · ');
    $('hojaQrUrl').textContent = url;
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))
      note('warn', '지금 주소(' + location.host + ')는 이 컴퓨터에서만 열립니다. 태블릿에서 찍으려면 교사 화면을 이 컴퓨터의 네트워크 주소(예: http://192.168.x.x:포트/)로 다시 열고 QR을 만드세요.');
    if (picked.length > 1) note('info', '여러 단원을 섞은 게임입니다. 결과는 볼 수 있지만 개인 랭킹에는 오르지 않습니다(단일 카트리지만 랭킹 대상).');
    note('info', '시험판: 랭킹 서버가 연결되지 않아 점수는 저장되지 않습니다. 게임이나 카트리지가 바뀌면 이 QR은 막히므로 새로 만들어 주세요.');
    el.hidden = false; $('hojaQrClose').focus({ preventScroll: true });
  }
  function mount() {
    document.body.appendChild(el);
    el.addEventListener('click', e => { e.stopPropagation(); if (e.target === el) close(); });
    $('hojaQrClose').addEventListener('click', close);
    $('hojaQrOpen').addEventListener('click', () => { if (url) window.open(url, '_blank', 'noopener'); });
    $('hojaQrCopy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); $('hojaQrCopy').textContent = '복사됨'; setTimeout(() => { $('hojaQrCopy').textContent = '주소 복사'; }, 1500); }
      catch { window.prompt('주소를 복사하세요', url); }
    });
    window.addEventListener('keydown', e => { if (!el.hidden) { e.stopImmediatePropagation(); if (e.key === 'Escape') close(); } }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.HOJA_SINGLE_QR = Object.freeze({ open, close, get url() { return url; } });
})();
