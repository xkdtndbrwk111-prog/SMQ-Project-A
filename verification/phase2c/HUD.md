# 아케이드 HUD

`js/hud.js`가 Phaser HUD 생성·정렬, 카메라 확대에 따른 고정 배치, DOM HUD 갱신을 담당한다. `arcade.html`의 기존 Scene 메서드는 같은 시점에 현재 Scene을 전달한다. 변경 가능한 논리 화면 크기, 확대율, 맵별 문제 수와 RUN은 사용 시점에 읽는다. HUD 갱신 시 Scene의 점수·시간·정답/응답 수를 RUN에 반영하는 기존 순서도 유지한다. CSS·색상·폰트·화면 문구와 조작은 기존 파일의 값을 사용한다.

| 검사 | 결과 |
| --- | --- |
| `node --test verification/phase2c/hud.test.mjs` | PASS. 맵별·전체 문제 수, 30초 표시 경계, 점수와 타이머, 작은 뷰포트 DOM 배율과 카메라 보정 좌표 검사 |
| 배포·시험 빌드, 정적 27개, 원본 무결성 및 Phase 1 해시 | PASS |
| 독립 교사·학생 QR·HTTP 상태, Firebase 0건, 고정 입력 기준 trace, 유도 FINISH 63점·중복 정산과 복습·랭킹 | PASS |
| 자연 4맵·동굴 왕래, 장치별 화면의 픽셀 비교 | NOT RUN |
