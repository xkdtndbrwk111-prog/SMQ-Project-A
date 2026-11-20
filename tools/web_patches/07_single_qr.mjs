// 7 싱글 QR 진입 구조(교사 쪽) — 모드는 두 개만: '혼자 아케이드'와 '학급 대결'.
//   혼자 아케이드 -> [바로 플레이] 이 기기에서 시작 / [학생 QR 만들기] 학생용 싱글 QR (play.html, m=s)
//   학급 대결     -> Phase 3에서 Firebase(별도 비운영 프로젝트)로 연결 — 지금은 '준비 중' 안내만
// 문제 풀이 모드(무한 문제)·연습모드·팀 수 고르기는 화면에서 빠진다.
const RENDER = `  if(stage==='root'){
   title().textContent='게임 모드 선택';hint().textContent='진행 방식을 골라 주세요.';
   r.append(button('혼자 아케이드','선택한 단원으로 HOJA 아케이드 · 개인 랭킹',()=>{stage='solo'}));
   r.append(button('학급 대결','20~30명이 함께 겨루기',()=>{stage='class'}));
  }else if(stage==='solo'){
   title().textContent='혼자 아케이드';hint().textContent='이 기기에서 바로 하거나, 학생용 QR을 만드세요.';
   r.append(button('바로 플레이','이 기기에서 아케이드 시작',()=>{selection='arcade';window.HOJA_GAMEPLAY.launch('arcade',season)}));
   r.append(button('학생 QR 만들기','학생이 QR을 찍으면 바로 아케이드',()=>{selection='qr';window.HOJA_SINGLE_QR?.open(season)}));
  }else if(stage==='class'){
   title().textContent='학급 대결';hint().textContent='학급 대결은 다음 단계(Phase 3)에서 연결됩니다.';
   const soon=document.createElement('button');soon.type='button';soon.className='hmPick';soon.disabled=true;
   const st=document.createElement('strong');st.textContent='준비 중';const sm=document.createElement('small');sm.textContent='학급 QR · 실시간 순위 · 결과 분석';
   soon.append(st,sm);r.append(soon);
  }
`;
export default {
  title: '싱글 QR 진입 구조 (교사 화면: 모드 2개 + 학생 QR)',
  parent(P) {
    P.editRange(/^061_script_anon\.js$/, "  if(stage==='root'){", '  if(deal){', RENDER);
    P.edit(/^061_script_anon\.js$/, "if(stage==='solo'||stage==='team'){stage='root';", "if(stage==='solo'||stage==='class'){stage='root';");
    P.inject('body', '<script src="vendor/qrcode.js"></script>\n<script src="js/teacher_qr.js"></script>', 'index');
    P.copy('web/vendor', 'vendor');
    P.copy('web/js/teacher_qr.js', 'js/teacher_qr.js');
  },
};
