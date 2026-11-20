# Phase 2C — 키보드 입력 분리 (2026-11-20)

기준 `b2d1147`. `arcade.html`에 있던 입력 IIFE를 `web/current/js/keyboard.js`의 팩토리로 옮겼다. 스크립트는 아케이드 주 IIFE 전에 동기 로드하고 팩토리 호출·키 이벤트 등록은 이전 `ACTIVE_SCENE` 선언 직후 동일한 위치에 둔다. Scene은 반환된 keys/DEAD를 사용하고 help/review 등은 기존 `window.HOJA_P1C_INPUT` API를 사용한다. Phaser 입력·키 매핑·물리 및 UI는 바꾸지 않았다. classic script이므로 ESM import를 도입하지 않았다.

- PASS: 배포/시험 빌드, 기존 27개 정적 검사(입력 소스 분리를 반영하고 모든 배포 텍스트에서 시험 훅 누출 검사), legacy 원본 재결합, Phase 1 기준 해시.
- PASS: 키보드 단위 시험 2개 — code/한글 fallback, 짧은 탭, 도움말·문제 차단, blur 해제, 기존 방향키·Space 비동작.
- PASS: 신규 빌드에서 독립 교사/학생 QR·HTTP 상태·Firebase 요청 0, 기존 고정 seed/입력 trace, 유도 FINISH 63점·중복 정산·복습 기록 불변. 개별 실행은 모두 종료 코드 0.
- 통합 브라우저 실행은 세 검사가 각각 PASS 출력한 뒤 정리 단계가 지연되어 중단했다(종료 코드 130). 각 검사 단독 재실행으로 정상 종료를 확인했으며 통합 실행의 정상 종료는 별도 미확인이다.
- NOT RUN: 자연 4맵·동굴 왕래 완주, 실제 기기, 전체 게임 시간 네트워크. 기존 trace·원본/기준 해시는 바꾸지 않았다.
