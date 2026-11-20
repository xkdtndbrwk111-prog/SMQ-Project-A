// Test-only dialogue preview buttons and sample scripts.
export const dialogueButtons = `<div id="hojaTestDialogueControls" style="position:fixed;top:90px;left:0;z-index:2147483647;background:#fff"><button id="hojaDialoguePreviewBtn" type="button" title="선택한 이벤트 대사만 즉시 미리보기 (시험판)">▶ 호자 감정 10종 대사 미리보기</button><button id="mixedDialoguePreviewBtn" type="button" title="호자와 나한상이 번갈아 대화하는 통합 테스트">▶ 호자 ↔ 나한상 통합 대화</button><button id="nahanDialoguePreviewBtn" type="button" title="나한상 10가지 감정을 순서대로 확인">▶ 나한상 감정 10종 대사 미리보기</button></div>`;

export const dialoguePreviewBindings = `  const previewBtn=document.getElementById('hojaDialoguePreviewBtn');
  const NAHAN_SAMPLE=[
    {"speaker": "NAHAN", "emotion": 1, "text": "어서 오너라, 호자. 이곳에는 오래된 이야기가 숨겨져 있단다."},
    {"speaker": "NAHAN", "emotion": 2, "text": "허허! 네가 이렇게 빨리 올 줄은 몰랐구나!"},
    {"speaker": "NAHAN", "emotion": 3, "text": "안 된다! 소중한 유물에 손대서는 안 돼!"},
    {"speaker": "NAHAN", "emotion": 4, "text": "아이고… 오랜 세월을 지켰더니 조금 피곤하구나."},
    {"speaker": "NAHAN", "emotion": 5, "text": "그리 칭찬하니 나도 쑥스럽구나."},
    {"speaker": "NAHAN", "emotion": 6, "text": "잊힌 유물의 이야기를 생각하면 마음이 아프구나."},
    {"speaker": "NAHAN", "emotion": 7, "text": "잠깐만… 조금만 눈을 붙여도 되겠느냐?"},
    {"speaker": "NAHAN", "emotion": 8, "text": "어이쿠! 저 문이 저절로 열리는구나!"},
    {"speaker": "NAHAN", "emotion": 9, "text": "하하! 드디어 비밀의 문이 열렸구나!"},
    {"speaker": "NAHAN", "emotion": 10, "text": "흠, 이 문양은 무슨 뜻일까?"}
  ];
  const MIXED_R23_SAMPLE=[
    {speaker:'호자',emotion:1,text:'안녕하세요, 나한상! 여기는 어디예요?'},
    {speaker:'나한상',emotion:1,text:'어서 오너라. 오래된 이야기가 잠들어 있는 곳이지.'},
    {speaker:'호자',emotion:2,text:'우와! 저 유물이 갑자기 빛나고 있어요!'},
    {speaker:'나한상',emotion:4,text:'허허... 오래 기다렸더니 조금 지치는구나.'},
    {speaker:'호자',emotion:9,text:'괜찮아요! 같이 비밀을 밝혀봐요!'},
    {speaker:'나한상',emotion:9,text:'좋다! 빛나는 유물의 수수께끼를 풀어보자꾸나.'}
  ];
  document.getElementById('mixedDialoguePreviewBtn')?.addEventListener('click',()=>start({lines:MIXED_R23_SAMPLE}));
  document.getElementById('nahanDialoguePreviewBtn')?.addEventListener('click',()=>start({lines:NAHAN_SAMPLE}));
  previewBtn.addEventListener('click',()=>start());
`;
