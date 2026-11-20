// 9 개발용 조작 기능 비활성화 (학생·교사 게임 화면)
//  - F9 성능 진단 패널: 아케이드의 패널(스타일+스크립트)과 부모 페이지의 F9 전달을 뺀다
//  - 교사 도구용 localhost 터치 시험 연결(TEST ONLY)과 그 원본 소스 블록을 뺀다
//    (아케이드 안 터치 수신부는 부모 창 메시지만 받으며, 보내는 쪽이 없어져 동작하지 않는다)
//  - 아케이드의 시험용 버튼 묶음(.cleanLabControls)은 원본에서 이미 display:none!important — 그대로 둔다
//  - 아케이드의 개발 키(B C F G I J K N Q T V Y)는 원본의 학생용 차단(hojaStudentDisableQaKeys_)으로 막힌다. H는 도움말.
//  - Maker·개발 Lab은 이 빌드에 들어가지 않는다(원본 저장소에 그대로 보존)
export default {
  title: '개발용 조작 기능 비활성화',
  parent(P) {
    P.edit(/_script_hojaV055ArcadeParentBinder\.js$/,
      "window.addEventListener('keydown',event=>{if(event.code==='F9'&&window.HOJA_GAMEPLAY?.state?.page==='arcade'){event.preventDefault();document.getElementById('hqArcadeFrame')?.contentWindow?.postMessage({kind:'HOJA_V063_PERF_TOGGLE'},'*');}},{capture:true});\n", '');
    P.dropBlock('hojaTeacherToolsTouchV1');
    P.dropBlock('hojaTeacherToolsArcadeSourceV1');
  },
  arcade(A) {
    A.removeBlock('style', 'hojaV063PerfStyle');
    A.removeBlock('script', 'hojaV063PerfScript');
  },
};
