// 2 개인 카트리지 제거 — '공용/개인 카트리지' 고르기 화면을 없애고 내장 카트리지 목록으로 바로 간다.
export default {
  title: '개인 카트리지 제거',
  parent(P) {
    // 저장소 고르기 화면을 띄우는 대신 곧바로 (내장) 카트리지 목록을 연다
    P.edit(/^059_script_anon\.js$/,
      "kind=null;busy=false;feedback().textContent='';feedback().hidden=true;input().value='';panel().hidden=true;root().hidden=false;document.getElementById('hrPublic').disabled=false;syncBack();}",
      "kind=null;busy=false;feedback().textContent='';feedback().hidden=true;input().value='';panel().hidden=true;root().hidden=true;syncBack();launch('PUBLIC');}");
    P.edit(/^059_script_anon\.js$/, "document.getElementById('hrPrivate')?.addEventListener('click',openPrivate);", '');
    P.edit(/^059_script_anon\.js$/, "document.getElementById('hrEnter')?.addEventListener('click',enter);", '');
    // 카탈로그 첫 단계에서 '이전' -> (없어진 저장소 화면 대신) 처음 화면
    P.edit(/^057_script_anon\.js$/, "if(stage==='grade'){hide();window.HOJA_REPOSITORY?.show?.();return;}",
      "if(stage==='grade'){hide();window.HOJA_REPOSITORY?.hide?.();window.HOJA_ATTRACT_CONTROL?.restart?.();return;}");
    // 목록 읽기에 실패했을 때만 보이는 저장소 화면에서도 개인 카트리지 카드·입력창은 감춘다
    P.inject('head', '<style id="hojaP1BNoPrivate">#hrPrivate,#hrPrivatePanel{display:none!important}</style>');
  },
};
