// Window messages between the arcade iframe and its teacher or student host.
window.HOJA_CONNECT_ARCADE_HOST = function ({prepare, launch, showStatus}) {
  const pending = new Map();
  let sequence = 0;
  let started = false;

  window.HOJA_STEP10_RPC = (method, payload) => new Promise((resolve, reject) => {
    if (!['RANK_LIST', 'RANK_SAVE'].includes(method)) {
      reject(new Error('RPC_METHOD_DENIED'));
      return;
    }
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('랭킹 서버 응답 시간 초과'));
    }, 45000);
    pending.set(id, {resolve, reject, timer});
    parent.postMessage({type:'HOJA_V058_ARCADE_RPC', id, method, payload}, '*');
  });

  function fail(error) {
    showStatus('Project B 로딩 실패: ' + String(error?.message || error));
  }

  window.addEventListener('message', event => {
    if (event.source !== parent || !event.data || typeof event.data !== 'object') return;
    const message = event.data;
    if (message.type === 'HOJA_V058_ARCADE_RPC_RESULT') {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.ok) request.resolve(message.value);
      else request.reject(new Error(String(message.error || '랭킹 오류')));
      return;
    }
    if (message.type === 'HOJA_V058_ARCADE_ERROR') {
      fail(message.error);
      return;
    }
    if (message.type !== 'HOJA_V058_ARCADE_START' || started) return;
    try {
      const {names, sources} = message;
      if (!Array.isArray(names) || names.length !== sources?.length ||
          names.some((name, index) => name !== sources[index]?.sheetName)) {
        throw new Error('카트리지 이름 불일치');
      }
      prepare(sources, names);
      started = true;
      launch();
    } catch (error) {
      fail(error);
    }
  });
  showStatus('Project B 검증 완료 문제 수신 중…');
  parent.postMessage({type:'HOJA_V058_ARCADE_READY'}, '*');
};
