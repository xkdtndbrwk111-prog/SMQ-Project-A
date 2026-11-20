# Phase 2C — 개인 오답 복습 경계 분리 (2026-11-20)

입력 분리 후 기준 `601eb55`. 아케이드 HTML의 `hojaP1CReview` IIFE를 `web/current/js/review.js`로 옮겼다. 같은 HTML 위치에서 동기 classic script로 로드하고 기존 `window.HOJA_REVIEW` open/isOpen/phase/answer/log, callback, key capture와 DOM 마운트 순서는 유지한다. CSS·화면 문구·점수·원본 기록은 변경하지 않는다.

- PASS: 배포·시험 빌드, 정적 27개, legacy 원본 무결성·Phase 1 해시, 키보드 단위 시험.
- PASS: 복습 모듈 단위 브라우저 시험 — 오답 재시도 2회차, 원본 데이터 불변, 완료 callback 1회.
- PASS: 기존 기준 trace, 유도 FINISH 63점·중복 정산 방지·복습 전후 원본 기록, 독립 교사·학생 QR/HTTP 상태/Firebase 요청 0. 각 과정 종료 코드 0.
- NOT RUN: 자연 4맵/동굴 완주, 실기기, 전체 플레이 시간 네트워크. 기준 trace 및 원본은 수정하지 않았다.
