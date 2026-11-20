# 참조되지 않는 과거 진단 API 제거

`web/current/`에서 정의와 참조를 검색했다. F9 패널은 이전 단계에서 제거됐고 `HOJA_V064_PERF_READ`, `HOJA_V064_PERF_RESET`, `HOJA_V064_PERF_ACTION`은 제거 대상 API 블록 내부의 RESET 호출 외에 호출이 없다. 이 세 함수를 제거했다. `HOJA_V049_QA`, `HOJA_V050_QA`, `HOJA_STEP12_3_QUIZ_LAYOUT`도 현재 정본에서 선언 외 참조가 없는 공개 진단 API여서 제거했다. 이들의 원래 계산·렌더·물리 경로와 Maker의 `HOJA_V061_IMPORT`, `HOJA_V061_STATUS` 및 대화 호출은 유지한다.

배포·시험 빌드, 정적 검사와 스크립트 연결 확인 PASS. 기준 trace, 유도 FINISH 63점·재정산·복습·랭킹, 교사·학생 독립 QR 및 HTTP 상태·Firebase 0건 PASS. 별도로 남은 진단 UI 및 테스트 함수의 의존성 조사와 분리가 필요하다.
