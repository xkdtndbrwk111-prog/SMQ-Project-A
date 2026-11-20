// 4 튜토리얼 전용 리소스 제거 — 튜토리얼 화면(gzip 약 0.55MB), 튜토리얼용 아케이드 패치, 오디오·스페이스 중계,
// 연습 카드 크기 스타일, 교사 도구의 연습 화면 연결, 튜토리얼 iframe 자리를 뺀다.
export default {
  title: '튜토리얼 전용 리소스 제거',
  parent(P) {
    for (const id of ['hojaR17KTutorialOverlayCSS', 'hojaR17PTutorialHostSpaceRelay', 'hojaR17KTutorialGzip',
      'hojaR17MTutorialAudioBridge', 'hojaR17STutorialArcadeDelta', 'hojaR17STutorialNativeBridge',
      'hojaR17QPracticeCardSize', 'hojaTeacherToolsPracticeSourceV8']) P.dropBlock(id);
    P.edit(/^108_html\.html$/, '<div id="hojaTutOverlay" hidden><iframe id="hojaTutApp" title="호자 연습모드" allow="autoplay; fullscreen" allowfullscreen></iframe><span id="hojaTutStatus" hidden role="status" aria-live="polite"></span></div>\n', '');
  },
};
