// 8 학생용 인터페이스 분리 — play.html은 같은 엔진·같은 소리 설정을 쓰되 교사용 화면(인트로 메뉴·저장소·
// 카탈로그·모드 선택)을 쓰지 않는다. QR 확인 → [시작] → 아케이드 → 끝나면 다시 이 화면.
// 게임 안 '이전/처음으로'는 학생 화면에서 카탈로그가 아니라 시작 화면으로 돌아온다(HOJA_STUDENT_BACK).
export default {
  title: '학생용 인터페이스 분리 (play.html)',
  parent(P) {
    P.edit(/_script_hojaV051Gameplay\.js$/,
      "function back(){stop();page='';host().hidden=true;window.HOJA_MODE_PREVIEW.show(season);",
      "function back(){if(typeof window.HOJA_STUDENT_BACK==='function'){stop();page='';host().hidden=true;window.HOJA_STUDENT_BACK();window.HOJA_AUDIO_CONTROL?.render?.();return;}stop();page='';host().hidden=true;window.HOJA_MODE_PREVIEW.show(season);");
    P.inject('body', '<script src="js/student.js"></script>', 'play');
    P.copy('web/js/student.js', 'js/student.js');
  },
};
