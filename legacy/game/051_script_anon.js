
"use strict";
// TEST adapter. Uses the canonical 64x64 ASCII frames already registered in
// hoja_shared_runtime.js; left: SLEEP (1fps), right: NAHANSANG Hi (8fps).
// No separately painted PNGs and no production Sheets calls.
const HOJA_LOADING_MESSAGES=["카트리지에 후후 불어보는 중", "문제 블록에 퀴즈를 채우는 중", "몬스터들에게 길을 비켜달라고 부탁하는 중", "부엉이가 정답을 훔쳐 갔는지 확인하는 중", "꽃의 향기를 확인하는 중", "호자가 아직 꿈나라에 있는지 확인하는 중", "지하 동굴의 지도를 펼쳐 보는 중", "과일 개수를 다시 세는 중", "나한상이 먼저 도착했는지 확인하는 중", "몬스터들에게 정답을 보여주지 않는 중", "지하 동굴의 조명 밝기를 확인하는 중", "수상한 길목을 다시 살펴보는 중", "비밀 과일을 몰래 숨기는 중", "엉뚱한 계절에 도착하지 않도록 확인하는 중", "호자에게 조금만 더 달려달라고 부탁하는 중", "유물 상자 안에 뭐가 들었는지 흔들어보는 중", "부엉이에게 오늘은 좀 쉬라고 설득하는 중", "밤하늘의 별을 반짝이게 만드는 중", "다음 무대의 풍경을 살펴보는 중", "계절별 지상맵을 하나씩 확인하는 중", "CSS가 또 삐져나왔는지 확인하는 중", "스크립트가 무사한지 세어보는 중", "어제 고친 버그가 돌아왔는지 확인하는 중", "방금 고친 코드를 다시 고치는 중", "일단 새 버전을 만드는 중", "잘 돌아가던 코드는 건드리지 않는 중", "흰 화면이 나오지 않기를 기도하는 중", "iPad에서도 똑같이 보이길 바라는 중", "겹친 UI를 조금씩 밀어내는 중", "카트리지 귀퉁이를 다시 붙이는 중", "CSS에게 화면 안에 있으라고 타이르는 중", "사라진 버튼을 찾아다니는 중", "타이머가 몰래 살아있는지 확인하는 중", "버그 하나를 잡고 두 개를 발견하는 중", "이번 버전은 정말 안정적이라고 믿어보는 중", "역사보리꼬리가 또 뭔가 만들고 있습니다", "역사보리꼬리가 유튜브 조회수는 잠시 잊어두는 중", "역사보리꼬리가 역사 이야기를 게임에 몰래 집어넣는 중", "역사보리꼬리가 웹툰 만들다가 갑자기 게임을 만드는 중", "역사보리꼬리가 버그를 발견하지 않기를 바라는 중", "치킨치킨디너치킨", "트랄렐로트랄랄라", "윙가르디움 레비오우싸~", "그 웹툰의 주인공 이름이 호자라는 걸 알고 있나요?", "그 웹툰의 또 다른 주인공은 나한상입니다", "호자가 코를 골지 않는지 확인하는 중", "나한상이 인사하는 프레임을 맞추는 중", "봄·여름·가을·겨울을 차례대로 정리하는 중", "박물관의 유물에 먼지가 쌓이지 않게 하는 중", "퀴즈 카트리지를 안전하게 꺼내는 중"];
const HOJA_LOADING=(function(){
 let ticker=0, startTime=0, active=false;
 const ids={root:'loadingOverlay',left:'loadingHoja',right:'loadingNahan',message:'loadingMessage',dots:'loadingDots'};
 function el(k){return document.getElementById(ids[k]||k);}
 function frames(group){
  const src=RAW_GROUPS[group]||[];
  if(!src.length)throw new Error('원본 JSON 애니메이션 없음: '+group);
  return src.map(frame=>makeHojaCanvas(frame).toDataURL('image/png'));
 }
 const hoja=frames('SLEEP'),nahan=frames('NAHANSANG Hi');
 function tick(){
   if(!active)return;
   const ms=performance.now()-startTime;
   // Square pixel aspect ratio guaranteed by 64x64 source and equal CSS width/height.
   el('left').src=hoja[Math.floor(ms/1000)%hoja.length];
   el('right').src=nahan[Math.floor(ms/125)%nahan.length];
   el('dots').textContent=['.','..','...','..'][Math.floor(ms/320)%4];
 }
 function show(options={}){
  hide();active=true;startTime=performance.now();
  el('message').textContent=HOJA_LOADING_MESSAGES[Math.floor(Math.random()*HOJA_LOADING_MESSAGES.length)];
  document.querySelector('.loadingNote').textContent=options.purpose==='questions'
    ?'선택한 단원의 문제 데이터를 불러오고 있습니다'
    :'카트리지 목록을 확인하고 있습니다';
  el('root').hidden=false;
  window.HOJA_CATALOG?.hide();
  // Same cadence for both frames, but animation source rates are independent.
  tick();ticker=setInterval(tick,125);
 }
 function hide(){
  active=false;if(ticker)clearInterval(ticker);ticker=0;
  el('root').hidden=true;
 }
 return {show,hide,messages:HOJA_LOADING_MESSAGES};
})();
window.HOJA_LOADING=HOJA_LOADING;

