// 1 팀전 제거 — 팀전(함께 놀기) 스크립트·스타일·팀 초상 JSON(약 2.4MB)을 뺀다.
// 아케이드가 쓰던 감정 그림 20장은 빌드 때 arcade.html에 이미 들어가므로 부모 페이지에는 필요 없다.
// 모드 선택 화면의 '함께 놀기' 버튼은 04(모드 선택 재구성)에서 학급 대결로 바뀐다.
export default {
  title: '팀전 제거',
  parent(P) {
    for (const id of [
      'hojaR12TeamGridMC3', 'hojaR15SevenCharacterRankHudStyles',
      'hojaTeamV067Style', 'hojaTeamV067R5Fixes', 'hojaTeamV067Assets', 'hojaTeamR10PortraitAssets',
      'hojaR13NahanHiSixFrames', 'hojaTeamR14FruitBoltStyles', 'hojaTeamV067Runtime',
      'hojaTeamV067R7UnifiedScoreFx', 'hojaTeamV067R7SpriteClip', 'hojaTeamV067R8RoundsRankingFinal',
      'hojaTeamV067R9BingoAndScoreRow', 'hojaR10PortraitAndOXStyles', 'hojaR11PortraitQuestionPipePolish',
      'hojaR12BStablePortraitAlignment', 'hojaR13ArcadeQuizPeachNahanMirror', 'hojaR16SteppedTeamScoreplates',
      'hojaR17FCorrectImpactStyles',
    ]) P.dropBlock(id);
    // 모드 선택: 팀 수 고르기 단계로 가는 길을 끊는다(버튼 자체는 04에서 바뀜)
    P.edit(/^061_script_anon\.js$/, "r.append(button('함께 놀기','',()=>{stage='team'}));", '');
    P.edit(/^061_script_anon\.js$/, "for(let i=2;i<=7;i++)r.append(button(String(i),i+'팀',()=>{selection='team';teamCount=i;window.HOJA_TEAM_TEST.launch(i,season)}));", '');
  },
};
