# 아케이드 오디오

`arcade.html`의 주 클로저에서 `js/audio.js`로 WebAudio 디코딩·샘플 재생, HTMLAudio 대체 재생, 음소거·음량과 BGM 감쇠를 옮겼다. HTML에 내장된 샘플과 효과음별 값은 기존 위치와 값을 사용한다. 클로저가 원래의 오디오 초기화 위치에서 팩터리를 호출하여 부모 메시지 및 제스처 수신 순서를 유지한다. 현재 장면과 남은 시간은 호출 시점에 읽는다.

`node --test verification/phase2c/audio.test.mjs`는 무음일 때의 난수 소비, 부모 음소거 메시지, 같은 샘플의 중복 제한, 학생 음량과 음높이를 검사한다. 실제 스피커 재생은 NOT RUN이다.

| 검사 | 결과 |
| --- | --- |
| 배포·시험 빌드, 정적 27개, 원본 무결성, Phase 1 기준판 해시 | PASS |
| 오디오 단위, 고정 입력과 기준 trace, 유도 FINISH·정산 및 복습 | PASS |
| 교사·학생 독립 브라우저, QR 진입, HTTP 응답 및 Firebase 0건 | PASS |
| 자연 4맵·동굴 왕래 | NOT RUN |
