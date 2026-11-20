# Phase 2A — Phase 1 기준판 (2026-11-20)

기준: `develop` 83e8ac161f713e4724eb8da34928fa53cb3b60f7. 기준 목록 `baseline.json`은 이 커밋의 배포용 빌드 전체 11개 파일의 SHA-256이다. `BUILD.json`의 `builtAt`만 제외한 후 JSON 키를 정렬해 해시한다. 따라서 나머지 메타데이터와 복사된 JS·카트리지·벤더 파일도 비교한다. 기준 목록은 의도적으로 갱신하지 않는 한 Phase 1 당시의 고정 증거다.

## 재현

```
node tools/build_web.mjs
node tools/check_web.mjs
python3 tools/legacy_split.py check
python3 tools/check_phase1_baseline.py
```

빌드 스크립트는 출력 디렉터리를 재귀 삭제하므로 기본 `dist` 외 경로를 지정할 때 주의한다. 시험 전용 `HOJA_TEST_PROBE=1` 빌드는 `dist-test`에만 두며 배포하지 않는다.

## 독립 검증

- PASS: 위 세 Phase 1 명령, 정적 검사 27개, 원본 재결합 SHA-256 `4ac5c4efc985c4c5d08f10a4410a48d7b49070c30fb10651a0c78cec6b3ecfc6`.
- PASS: 기준 목록과 재빌드 비교. `dist/js/student.js`에 시험 문자열을 추가했을 때 변경을 검출하고 복원 후 통과.
- PASS: 로컬 브라우저에서 교사 화면 → 시험 A → 혼자 아케이드 → 바로 플레이, 게임 표시·시간 감소·D 이동·H 도움말 열기/닫기.
- NOT RUN: 600초 실제 종료 결과, FINISH 전체 경로, 쓰러짐 Enter, 결산/복습/랭킹·중복 정산, 동일 시드와 입력 비교. 이 목록은 작업 완료를 뜻하지 않는다.
- 정적 Firebase 문자열 0건은 네트워크 요청을 직접 관찰한 결과가 아니다.
