// 3 튜토리얼 및 강제 실행 관문 제거 — 아케이드 시작 전에 연습모드를 먼저 돌리던 관문을 없애고 바로 아케이드를 연다.
// '연습모드' 카드도 뺀다(조작법은 게임 안 H 도움말로 대신함).
export default {
  title: '튜토리얼 및 강제 실행 관문 제거',
  parent(P) {
    P.edit(/^061_script_anon\.js$/,
      "selection='arcade';window.HOJA_TUTORIAL_GATE?.startArcade(()=>window.HOJA_GAMEPLAY.launch('arcade',season))",
      "selection='arcade';window.HOJA_GAMEPLAY.launch('arcade',season)");
    P.edit(/^061_script_anon\.js$/,
      "   const practiceCard=button('연습모드','호자 조작법 배우기 · 언제든 다시 연습',()=>{selection='practice';window.HOJA_TUTORIAL_GATE?.open('practice')});\n   practiceCard.classList.add('hmPractice');r.append(practiceCard);\n", '');
    P.dropBlock('hojaR17LTutorialIntegration'); // HOJA_TUTORIAL_GATE (관문 자체)
  },
};
