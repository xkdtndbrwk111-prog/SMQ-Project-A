# 완주와 시간 종료 정산

`arcade.html`에 있던 과일 정산, 마지막 맵 시간·과일 보너스, 기록 지표 계산, 결과 표시를 `js/settlement.js`가 담당한다. Scene은 FINISH·시간 종료의 연출과 호출 시점을 결정한다. 정산은 그 Scene과 한 게임 동안 유지하는 RUN 객체를 사용한다. 시간 보너스의 Scene 플래그와 과일 보너스의 RUN 플래그는 다른 수명을 가진다. 결과 화면이 열리면 기존 복습·랭킹 흐름으로 전달한다.

| 검사 | 결과 |
| --- | --- |
| `node --test verification/phase2c/settlement.test.mjs` | PASS. 중복 호출 후 문제 10·과일 5·시간 48·기타 0, 63점. 응답 기록과 결과 검증 표시 확인 |
| 배포·시험 빌드, 기존 정적 27개, 원본 무결성·기준판 해시 | PASS |
| 독립 교사·학생, QR 진입·HTTP 상태와 Firebase 요청 0건, 고정 입력 trace, 유도 FINISH·재정산·복습·랭킹 | PASS |
| 자연 4맵·동굴 왕래 | NOT RUN |
