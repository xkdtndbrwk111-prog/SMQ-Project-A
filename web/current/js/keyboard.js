// Keyboard input factory; initialized by the arcade at its original startup point.
window.HOJA_CREATE_INPUT=()=>{
  const mk=()=>({isDown:false,isUp:true,_justDown:false,_justUp:false,timeDown:0,timeUp:0,repeats:0,enabled:true});
  const CODE={KeyA:'left',KeyD:'right',KeyW:'up',KeyS:'down',Comma:'run',Period:'jump',Enter:'enter'};
  const keys={left:mk(),right:mk(),up:mk(),down:mk(),run:mk(),jump:mk(),enter:mk()};
  const DEAD=Object.freeze(mk()); // 예전 키 이름·개발용 키: 절대 눌리지 않음
  // code가 빈 값('')이나 'Unidentified'로 오는 입력 환경(일부 화면 키보드·원격 입력)만: 같은 물리 키의 글자로 판별.
  // 영문·한글 두벌식 자리(A=ㅁ, D=ㅇ, W=ㅈ, S=ㄴ, H=ㅗ). 다른 키를 같은 동작에 더하는 것이 아니다.
  const BY_KEY={a:'KeyA',A:'KeyA','ㅁ':'KeyA',d:'KeyD',D:'KeyD','ㅇ':'KeyD',w:'KeyW',W:'KeyW','ㅈ':'KeyW',s:'KeyS',S:'KeyS','ㄴ':'KeyS',
    h:'KeyH',H:'KeyH','ㅗ':'KeyH',',':'Comma','.':'Period',Enter:'Enter'};
  const codeOf=e=>(e.code&&e.code!=='Unidentified')?e.code:(BY_KEY[e.key]||'');
  // 키를 떼도 '막 눌림'(_justDown)은 게임이 읽을 때까지 남긴다(Phaser 키와 같음: 아주 짧게 톡 친 점프도 들어감).
  // releaseAll(창 전환·도움말·문제 창 등)은 남은 눌림까지 지운다.
  function release(name,drop){const k=keys[name];if(k.isDown){k.isDown=false;k.isUp=true;k._justUp=true;k.timeUp=performance.now();}if(drop)k._justDown=false;}
  function releaseAll(){for(const n in keys)release(n,true);}
  function blocked(e){
    if(e.target&&e.target.closest&&e.target.closest('input,textarea,select,[contenteditable=true]'))return true;
    if(window.HOJA_HELP&&window.HOJA_HELP.open)return true;
    if(window.HOJA_REVIEW&&window.HOJA_REVIEW.isOpen)return true;
    const rank=document.getElementById('hojaRankOverlay');if(rank&&rank.classList.contains('is-open'))return true;
    const quiz=document.getElementById('quizOverlay');if(quiz&&quiz.classList.contains('active'))return true;
    if(window.HOJA_EVENT_DIALOGUE_STATUS&&window.HOJA_EVENT_DIALOGUE_STATUS().open)return true;
    return false;
  }
  window.addEventListener('keydown',e=>{
    const name=CODE[codeOf(e)];if(!name)return;
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(blocked(e)){releaseAll();return;}
    if(name!=='enter')e.preventDefault();
    const k=keys[name];
    if(!k.isDown){k.isDown=true;k.isUp=false;k._justDown=true;k._justUp=false;k.timeDown=performance.now();k.repeats=0;}
    else k.repeats++;
  },true);
  window.addEventListener('keyup',e=>{const name=CODE[codeOf(e)];if(name)release(name,false);},true);
  window.addEventListener('blur',releaseAll);
  window.addEventListener('pagehide',releaseAll);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll();});
  const state=()=>{const o={};for(const n in keys)o[n]=keys[n].isDown;return o;};
  window.HOJA_P1C_INPUT=Object.freeze({releaseAll,state,codeOf,codes:Object.freeze({...CODE})});
  return Object.freeze({keys,DEAD,releaseAll});
};
